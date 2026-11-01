// 아지트 실시간 서버 (Cloudflare Workers + Durable Objects)
//  - 정적 화면: wrangler의 assets(public/)가 먼저 응답
//  - /api/bar       : 멤버 목록(누가 비었는지, 누가 접속 중인지)
//  - /api/bar/ws    : 웹소켓. 첫 메시지 hello로 입장(토큰 복귀 또는 초대 코드로 캐릭터 선택)
// 바 하나 = Durable Object 하나. 아무도 없으면 잠들고(비용 0), 상태는 내장 SQLite 저장소에 영구 보관.
import { DurableObject } from 'cloudflare:workers';
import { apply, initialState, pushLine, resolveToast, RuleError, token, type Action, type Ev, type State } from './rules';

export interface Env {
  BAR: DurableObjectNamespace<BarRoom>;
  ASSETS: Fetcher;
  INVITE_CODE?: string;
}

interface Att { id: string }

export class BarRoom extends DurableObject<Env> {
  private s!: State;
  private tokens: Record<string, string> = {};       // 캐릭터 id → 토큰 (화면에 절대 안 보냄)
  private lastChat = new Map<string, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get<State>('state')) ?? initialState(Date.now());
      this.tokens = (await ctx.storage.get<Record<string, string>>('tokens')) ?? {};
    });
  }

  private online(): Set<string> {
    const on = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment() as Att | null; if (a?.id) on.add(a.id); }
    return on;
  }

  private publicState() {
    const on = this.online();
    return { ...this.s, online: [...on], now: Date.now() };
  }

  private async save() {
    await this.ctx.storage.put({ state: this.s, tokens: this.tokens });
  }

  private broadcast(msg: unknown, except?: WebSocket) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment() as Att | null;
      if (!a?.id) continue;                 // 아직 입장 안 한 연결
      try { ws.send(data); } catch { /* 끊긴 연결 */ }
    }
  }

  private emit(evs: Ev[]) { for (const ev of evs) this.broadcast({ type: 'ev', ev }); }
  private pushState() { this.broadcast({ type: 'state', state: this.publicState() }); }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.endsWith('/ws')) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);          // 잠들어도 연결 유지 (Hibernation API)
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    // 멤버 목록
    const on = this.online();
    return Response.json({
      name: this.s.name,
      inviteRequired: !!this.env.INVITE_CODE,
      members: this.s.order.map((id) => {
        const m = this.s.members[id];
        return { id, name: m.name, owner: m.owner, claimed: m.claimed, online: on.has(id), lastSeen: m.lastSeen };
      }),
    });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    let msg: any;
    try { msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return; }
    const att = ws.deserializeAttachment() as Att | null;
    const now = Date.now();

    // ── 입장 ──
    if (!att?.id) {
      if (msg?.t !== 'hello') return ws.send(JSON.stringify({ type: 'err', msg: '먼저 입장해 주세요' }));
      let id: string | undefined;
      let newToken: string | undefined;
      if (msg.token) id = Object.keys(this.tokens).find((k) => this.tokens[k] === msg.token && this.s.members[k]?.claimed);
      if (!id && msg.claim) {
        const m = this.s.members[msg.claim];
        if (this.env.INVITE_CODE && msg.invite !== this.env.INVITE_CODE) return this.reject(ws, '초대 링크가 올바르지 않아요');
        if (!m) return this.reject(ws, '없는 캐릭터예요');
        if (m.claimed) return this.reject(ws, `${m.name}은(는) 이미 주인이 있어요`);
        m.claimed = true;
        newToken = token();
        this.tokens[m.id] = newToken;
        id = m.id;
        pushLine(this.s, { who: '', kind: 'sys', text: `${m.name}님이 처음으로 바에 왔어요!`, at: now });
      }
      if (!id) return this.reject(ws, '입장 정보가 없어요. 초대 링크로 다시 들어와 주세요', true);
      const wasOn = this.online().has(id);
      ws.serializeAttachment({ id } satisfies Att);
      this.s.members[id].lastSeen = now;
      if (!wasOn && !newToken) pushLine(this.s, { who: '', kind: 'sys', text: `${this.s.members[id].name}님이 바에 들어왔어요`, at: now });
      await this.save();
      ws.send(JSON.stringify({ type: 'welcome', me: id, token: newToken ?? msg.token }));
      this.pushState();
      if (!wasOn) this.emit([{ type: 'enter', id }]);
      return;
    }

    // ── 행동 ──
    const id = att.id;
    if (msg?.t === 'chat') {
      const last = this.lastChat.get(id) ?? 0;
      if (now - last < 500) return ws.send(JSON.stringify({ type: 'err', msg: '조금 천천히 말해 주세요' }));
      this.lastChat.set(id, now);
    }
    try {
      const r = apply(this.s, id, msg as Action, now);
      if (r.alarm) await this.ctx.storage.setAlarm(r.alarm);
      if (r.save) { this.s.members[id].lastSeen = now; await this.save(); this.pushState(); }
      this.emit(r.evs);
    } catch (e) {
      if (e instanceof RuleError) ws.send(JSON.stringify({ type: 'err', msg: e.message }));
      else throw e;
    }
  }

  private reject(ws: WebSocket, msg: string, forget = false) {
    ws.send(JSON.stringify({ type: 'err', msg, fatal: true, forget }));
    ws.close(4001, 'rejected');
  }

  async webSocketClose(ws: WebSocket) { await this.left(ws); }
  async webSocketError(ws: WebSocket) { await this.left(ws); }

  private async left(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Att | null;
    if (!a?.id) return;
    ws.serializeAttachment(null);
    const still = this.ctx.getWebSockets().some((w) => w !== ws && (w.deserializeAttachment() as Att | null)?.id === a.id);
    if (still) return;
    this.s.members[a.id].lastSeen = Date.now();
    await this.save();
    this.pushState();
    this.emit([{ type: 'leave', id: a.id }]);
  }

  async alarm() {
    const evs = resolveToast(this.s, Date.now());
    if (evs.length) { await this.save(); this.pushState(); this.emit(evs); }
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/bar' || url.pathname === '/api/bar/ws') {
      const stub = env.BAR.get(env.BAR.idFromName('main'));
      return stub.fetch(req);
    }
    if (url.pathname.startsWith('/api/')) return new Response('not found', { status: 404 });
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
