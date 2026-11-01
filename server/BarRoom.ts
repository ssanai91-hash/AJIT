import { Room, type Client } from '@colyseus/core';
import { randomBytes } from 'node:crypto';
import { BarCore, RuleError, type Action, type ChatLine } from '../shared/core.js';
import type { Store } from './db.js';

export const cryptoRand = () => randomBytes(4).readUInt32BE() / 0x1_0000_0000;

interface UserData { memberId: string }

/**
 * 바 하나 = Colyseus 방 하나. 방 코드(code)별로 하나만 존재한다 (filterBy code).
 * 상태 동기화는 8명 규모라 '전체 상태 스냅샷' 방송으로 단순하게 처리한다.
 */
export class BarRoom extends Room {
  static store: Store;
  core!: BarCore;
  private conns = new Map<string, number>();    // memberId -> 접속 수 (여러 탭 허용)
  private flushQueued = false;
  private savedChatId = 0;

  onCreate(options: { code: string }) {
    const saved = BarRoom.store.load(options.code);
    if (!saved) throw new Error('없는 바예요');
    this.core = new BarCore(saved, Date.now, cryptoRand);
    // 서버 재시작 시 모두 오프라인으로 시작
    for (const m of Object.values(this.core.state.members)) m.online = false;
    this.savedChatId = this.core.state.chatSeq;
    this.maxClients = 32;
    this.setMetadata({ code: options.code });

    this.onMessage('act', (client, a: Action) => this.handle(client, () => this.core.act(this.mid(client), a)));
    this.onMessage('time', () => Date.now());
    this.onMessage('history', (_client, msg: { before: number }) =>
      BarRoom.store.chatHistory(this.core.state.code, Number(msg?.before) || Number.MAX_SAFE_INTEGER));
    this.onMessage('rejoinLink', (client, msg: { memberId: string }) => {
      if (this.mid(client) !== this.core.state.ownerId) return { error: '방장만 발급할 수 있어요' };
      const t = this.core.secrets.memberTokens[msg?.memberId];
      return t ? { memberToken: t } : { error: '없는 멤버예요' };
    });
    this.onMessage('inviteLink', (client) => {
      if (!this.core.state.members[this.mid(client)]) return { error: '멤버가 아니에요' };
      return { inviteToken: this.core.secrets.inviteToken };
    });

    this.clock.setInterval(() => { this.core.tick(); this.flush(); }, 250);
  }

  onJoin(client: Client<{ userData: UserData }>, options: { nick?: string; inviteToken?: string; memberToken?: string }) {
    let r;
    try { r = this.core.join(options ?? {}); }
    catch (e) { throw e instanceof RuleError ? new Error(e.message) : e; }
    client.userData = { memberId: r.memberId };
    this.conns.set(r.memberId, (this.conns.get(r.memberId) ?? 0) + 1);
    client.send('welcome', { memberId: r.memberId, memberToken: r.memberToken, serverNow: Date.now() });
    this.flush(true);
  }

  onDrop(client: Client<{ userData: UserData }>) {
    // 휴대폰 화면 꺼짐·터널 등 잠깐 끊김: 20초간 같은 연결로 복귀 허용
    if (!client.userData?.memberId) return;   // 입장 실패한 연결
    this.allowReconnection(client, 20);
  }

  onReconnect(client: Client<{ userData: UserData }>) {
    client.send('state', this.core.state);
  }

  onLeave(client: Client<{ userData: UserData }>) {
    const id = client.userData?.memberId;
    if (!id) return;
    const n = (this.conns.get(id) ?? 1) - 1;
    if (n <= 0) { this.conns.delete(id); this.core.disconnect(id); }
    else this.conns.set(id, n);
    this.flush(true);
  }

  onDispose() {
    BarRoom.store.save(this.core.state, this.core.secrets);
  }

  private mid(client: Client<{ userData: UserData }>) { return client.userData!.memberId; }

  private handle(client: Client<{ userData: UserData }>, fn: () => void) {
    try {
      fn();
      this.core.tick();
      this.flush();
      return { ok: true };
    } catch (e) {
      if (e instanceof RuleError) return { error: e.message };
      console.error(e);
      return { error: '서버 오류' };
    }
  }

  /** 변경 사항을 한 번에 모아 방송하고 저장한다 */
  private flush(force = false) {
    const events = this.core.drain();
    for (const ev of events) {
      this.broadcast('ev', ev);
      if (ev.type === 'kicked') {
        for (const c of this.clients) if ((c.userData as UserData)?.memberId === ev.memberId) c.leave(4001);
      }
    }
    if (!events.length && !force && this.core.state.chatSeq === this.savedChatId && !this.dirty()) return;
    if (this.flushQueued) return;
    this.flushQueued = true;
    setImmediate(() => {
      this.flushQueued = false;
      const s = this.core.state;
      this.broadcast('state', s);
      const fresh: ChatLine[] = s.chat.filter(l => l.id > this.savedChatId);
      if (fresh.length) { BarRoom.store.appendChat(s.code, fresh); this.savedChatId = s.chatSeq; }
      BarRoom.store.save(s, this.core.secrets);
      this.lastJson = JSON.stringify(s);
    });
  }

  private lastJson = '';
  private dirty() { return JSON.stringify(this.core.state) !== this.lastJson; }
}
