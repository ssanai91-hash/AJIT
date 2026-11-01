// 실제 서버를 띄우고 휴대폰 여러 대가 접속한 상황을 흉내 낸다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client, type Room } from '@colyseus/sdk';
import { createServer } from '../index.js';
import { Store } from '../db.js';
import type { BarState, BarEvent } from '../../shared/core.js';

const PORT = 25670;
const server = createServer(new Store(':memory:'));
await server.listen(PORT);
after(() => server.gracefullyShutdown(false));

const URL = `http://localhost:${PORT}`;

interface Phone { room: Room; state: BarState | null; events: BarEvent[]; me: string; token: string }

async function phone(opts: object): Promise<Phone> {
  const room = await new Client(URL).joinOrCreate('bar', opts);
  const p: Phone = { room, state: null, events: [], me: '', token: '' };
  room.onMessage('state', (s: BarState) => { p.state = s; });
  room.onMessage('ev', (e: BarEvent) => { p.events.push(e); });
  await new Promise<void>(res => room.onMessage('welcome', (w: any) => { p.me = w.memberId; p.token = w.memberToken; res(); }));
  return p;
}
const act = (p: Phone, a: object) => new Promise<any>(res => p.room.send('act', a, (r: any) => res(r)));
const until = async (cond: () => boolean, ms = 3000) => {
  const t0 = Date.now();
  while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await new Promise(r => setTimeout(r, 20)); }
};

test('바 생성 → 3명 입장 → 행동 동기화 → 건배 → 끊김·복귀', async () => {
  const created = await (await fetch(`${URL}/api/rooms`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '숭열이네 바' }),
  })).json();
  assert.match(created.code, /^[A-Z0-9]{6}$/);
  const base = { code: created.code, inviteToken: created.inviteToken };

  const a = await phone({ ...base, nick: '숭열' });
  const b = await phone({ ...base, nick: '철수' });
  const c = await phone({ ...base, nick: '영희' });

  await assert.rejects(new Client(URL).joinOrCreate('bar', { code: created.code, inviteToken: 'bad', nick: 'x' }));

  await until(() => Object.keys(c.state?.members ?? {}).length === 3 && Object.keys(a.state?.members ?? {}).length === 3);
  assert.equal(a.state!.ownerId, a.me);
  assert.equal(a.state!.name, '숭열이네 바');

  // B가 위스키 → A 화면에도 반영
  assert.deepEqual(await act(b, { t: 'pick', whisky: 2 }), { ok: true });
  await act(b, { t: 'pour' });
  await act(b, { t: 'sip' });
  await until(() => a.state!.members[b.me].level === 3);
  assert.ok(a.events.some(e => e.type === 'sip' && e.memberId === b.me));

  // 규칙 위반은 오류 응답
  assert.match((await act(c, { t: 'sip' })).error, /비었/);
  assert.match((await act(b, { t: 'musicControl', cmd: 'play' })).error, /방장/);

  // 채팅
  await act(c, { t: 'chat', text: '오늘 한잔 각?' });
  await until(() => b.state!.chat.some(l => l.text === '오늘 한잔 각?'));

  // 건배: A 제안, B 참여, C 구경
  await act(a, { t: 'toastPropose' });
  await until(() => c.events.some(e => e.type === 'toastStart'));
  await act(b, { t: 'toastJoin' });
  await until(() => c.events.some(e => e.type === 'toastResult'), 7000);
  const r = c.events.find(e => e.type === 'toastResult') as any;
  assert.deepEqual(r.participants.sort(), [a.me, b.me].sort());

  // B 연결 끊김 → 졸기 상태, 자리 유지
  const bSeat = a.state!.members[b.me].seat;
  await b.room.leave(true);
  await until(() => a.state!.members[b.me].online === false);
  assert.equal(a.state!.seats[bSeat], b.me);

  // B 멤버 토큰으로 복귀 → 같은 자리, 같은 잔
  const b2 = await phone({ code: created.code, memberToken: b.token });
  assert.equal(b2.me, b.me);
  await until(() => a.state!.members[b.me].online === true);
  assert.equal(b2.state!.members[b.me].seat, bSeat);
  assert.equal(b2.state!.members[b.me].level, 3);

  // 서버 시계
  const t = await new Promise<number>(res => a.room.send('time', {}, (v: number) => res(v)));
  assert.ok(Math.abs(t - Date.now()) < 1000);

  for (const p of [a, b2, c]) await p.room.leave(true);
});
