// 서버 연결 방식 두 가지를 같은 모양으로 감싼다.
//  - NetTransport  : 진짜 서버(Colyseus)
//  - LocalTransport: 체험판. 브라우저 안에서 같은 규칙 코드(BarCore)를 돌린다
import { BarCore, RuleError, type Action, type BarEvent, type BarState } from '../../shared/core';

export type Reply = { ok: true } | { error: string };

export interface Transport {
  me: string;
  serverNow(): number;
  act(a: Action): Promise<Reply>;
  onState(cb: (s: BarState) => void): void;
  onEvent(cb: (e: BarEvent) => void): void;
  inviteUrl(): Promise<string | null>;
  rejoinUrl(memberId: string): Promise<string | null>;
  onClosed(cb: (why: string) => void): void;
}

type Cb<T> = (v: T) => void;

class Emitter {
  stateCbs: Cb<BarState>[] = [];
  eventCbs: Cb<BarEvent>[] = [];
  closedCbs: Cb<string>[] = [];
  onState(cb: Cb<BarState>) { this.stateCbs.push(cb); }
  onEvent(cb: Cb<BarEvent>) { this.eventCbs.push(cb); }
  onClosed(cb: Cb<string>) { this.closedCbs.push(cb); }
  emitState(s: BarState) { for (const cb of this.stateCbs) cb(s); }
  emitEvent(e: BarEvent) { for (const cb of this.eventCbs) cb(e); }
}

// ── 체험판 ─────────────────────────────────────────

export class LocalTransport extends Emitter implements Transport {
  me = '';
  core: BarCore;
  private timer: number;

  constructor(name: string) {
    super();
    this.core = new BarCore(BarCore.create('DEMO00', name));
    this.timer = window.setInterval(() => { this.core.tick(); this.flush(); }, 200);
  }

  serverNow() { return Date.now(); }

  joinAs(nick: string) {
    const r = this.core.join({ nick, inviteToken: this.core.secrets.inviteToken });
    this.flush();
    return r.memberId;
  }

  /** 가상 친구가 행동할 때 */
  actAs(memberId: string, a: Action) {
    try { this.core.act(memberId, a); this.core.tick(); this.flush(); return true; }
    catch (e) { if (e instanceof RuleError) return false; throw e; }
  }

  async act(a: Action): Promise<Reply> {
    try { this.core.act(this.me, a); this.core.tick(); this.flush(); return { ok: true }; }
    catch (e) { if (e instanceof RuleError) return { error: e.message }; throw e; }
  }

  flush() {
    for (const e of this.core.drain()) this.emitEvent(e);
    this.emitState(structuredClone(this.core.state));
  }

  async inviteUrl() { return null; }
  async rejoinUrl() { return null; }
  stop() { clearInterval(this.timer); }
}

// ── 진짜 서버 ─────────────────────────────────────

const LS_KEY = (code: string) => `ajit.member.${code}`;
export function savedToken(code: string) { try { return localStorage.getItem(LS_KEY(code)); } catch { return null; } }
function saveToken(code: string, t: string) { try { localStorage.setItem(LS_KEY(code), t); } catch { /* 저장 불가 브라우저 */ } }

export async function connectNet(opts: { code: string; nick?: string; inviteToken?: string; memberToken?: string }): Promise<Transport> {
  const { Client } = await import('@colyseus/sdk');
  const client = new Client(location.origin);
  const room = await client.joinOrCreate('bar', opts);
  const t = new (class extends Emitter implements Transport {
    me = '';
    offset = 0;
    serverNow() { return Date.now() + this.offset; }
    act(a: Action) { return new Promise<Reply>(res => room.send('act', a, (r: Reply) => res(r))); }
    async inviteUrl() {
      const r = await new Promise<any>(res => room.send('inviteLink', {}, res));
      return r.inviteToken ? `${location.origin}${location.pathname}?r=${opts.code}&i=${r.inviteToken}` : null;
    }
    async rejoinUrl(memberId: string) {
      const r = await new Promise<any>(res => room.send('rejoinLink', { memberId }, res));
      return r.memberToken ? `${location.origin}${location.pathname}?r=${opts.code}&m=${r.memberToken}` : null;
    }
  })();
  room.onMessage('state', (s: BarState) => t.emitState(s));
  room.onMessage('ev', (e: BarEvent) => t.emitEvent(e));
  room.onLeave((code: number) => { for (const cb of t.closedCbs) cb(code === 4001 ? '방장이 내보냈어요' : '연결이 끊겼어요'); });
  await new Promise<void>(res => room.onMessage('welcome', (w: { memberId: string; memberToken: string }) => {
    t.me = w.memberId; saveToken(opts.code, w.memberToken); res();
  }));
  // 서버 시계 맞추기 (음악 동기화용): 왕복 시간의 절반을 보정
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const sv = await new Promise<number>(res => room.send('time', {}, res));
    const rtt = Date.now() - t0;
    if (i === 0 || rtt < (t as any).bestRtt) { (t as any).bestRtt = rtt; t.offset = sv + rtt / 2 - Date.now(); }
  }
  return t;
}
