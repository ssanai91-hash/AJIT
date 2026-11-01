import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BarCore, RuleError, musicPosition } from '../../shared/core.js';

function setup() {
  let t = 1_000_000;
  const clock = { now: () => t, add: (ms: number) => { t += ms; } };
  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const init = BarCore.create('TEST01', '우리 바', t, rand);
  const core = new BarCore(init, clock.now, rand);
  const inv = init.secrets.inviteToken;
  return { core, clock, inv };
}

test('첫 입장자가 방장, 자동 착석, 정원 8명', () => {
  const { core, inv } = setup();
  const a = core.join({ nick: '숭열', inviteToken: inv });
  assert.equal(core.state.ownerId, a.memberId);
  assert.equal(core.state.members[a.memberId].seat, 0);
  for (let i = 1; i < 8; i++) core.join({ nick: '친구' + i, inviteToken: inv });
  assert.throws(() => core.join({ nick: '아홉째', inviteToken: inv }), RuleError);
  assert.throws(() => core.join({ nick: '가짜', inviteToken: 'wrong' }), RuleError);
});

test('끊겨도 자리 유지(졸기), 멤버 토큰으로 같은 자리 복귀', () => {
  const { core, inv } = setup();
  const a = core.join({ nick: '숭열', inviteToken: inv });
  const b = core.join({ nick: '철수', inviteToken: inv });
  core.disconnect(b.memberId);
  assert.equal(core.state.members[b.memberId].online, false);
  assert.equal(core.state.seats[1], b.memberId);
  const back = core.join({ memberToken: b.memberToken });
  assert.equal(back.memberId, b.memberId);
  assert.equal(core.state.members[b.memberId].online, true);
  assert.equal(Object.keys(core.state.members).length, 2);
  void a;
});

test('자리 바꾸기: 빈 자리만', () => {
  const { core, inv } = setup();
  const a = core.join({ nick: 'A', inviteToken: inv });
  const b = core.join({ nick: 'B', inviteToken: inv });
  assert.throws(() => core.act(a.memberId, { t: 'sit', seat: 1 }), RuleError);
  core.act(a.memberId, { t: 'sit', seat: 5 });
  assert.equal(core.state.seats[0], null);
  assert.equal(core.state.seats[5], a.memberId);
  void b;
});

test('위스키: 고르기 → 따르기 → 한 모금 4번 → 빈 잔', () => {
  const { core, inv } = setup();
  const a = core.join({ nick: 'A', inviteToken: inv }).memberId;
  assert.throws(() => core.act(a, { t: 'pour' }), /위스키를 골라/);
  core.act(a, { t: 'pick', whisky: 3 });
  core.act(a, { t: 'pour' });
  assert.equal(core.state.members[a].level, 4);
  assert.throws(() => core.act(a, { t: 'pour' }), /가득/);
  for (let i = 0; i < 4; i++) core.act(a, { t: 'sip' });
  assert.throws(() => core.act(a, { t: 'sip' }), /비었/);
  assert.throws(() => core.act(a, { t: 'pick', whisky: 13 }), RuleError);
});

test('채팅: 200자 제한, 초당 1회, 최근 50개 유지', () => {
  const { core, clock, inv } = setup();
  const a = core.join({ nick: 'A', inviteToken: inv }).memberId;
  core.act(a, { t: 'chat', text: '안녕' });
  assert.throws(() => core.act(a, { t: 'chat', text: '또' }), /천천히/);
  assert.throws(() => { clock.add(1000); core.act(a, { t: 'chat', text: 'x'.repeat(201) }); }, /200자/);
  for (let i = 0; i < 60; i++) { clock.add(1000); core.act(a, { t: 'chat', text: 'm' + i }); }
  assert.equal(core.state.chat.length, 50);
  assert.equal(core.state.chat.at(-1)!.text, 'm59');
  assert.equal(core.state.members[a].lastSay, 'm59');
});

test('건배: 5초 안에 참여한 사람끼리, 혼자면 solo, 30초 재사용 대기', () => {
  const { core, clock, inv } = setup();
  const a = core.join({ nick: 'A', inviteToken: inv }).memberId;
  const b = core.join({ nick: 'B', inviteToken: inv }).memberId;
  const c = core.join({ nick: 'C', inviteToken: inv }).memberId;
  core.drain();
  core.act(a, { t: 'toastPropose' });
  assert.throws(() => core.act(b, { t: 'toastPropose' }), /진행 중/);
  clock.add(3000); core.act(b, { t: 'toastJoin' });
  clock.add(2001); core.tick();
  assert.throws(() => core.act(c, { t: 'toastJoin' }), /끝났/);
  const res = core.drain().find(e => e.type === 'toastResult');
  assert.deepEqual(res, { type: 'toastResult', participants: [a, b], solo: false });

  assert.throws(() => core.act(a, { t: 'toastPropose' }), /30초/);
  core.act(c, { t: 'toastPropose' });
  clock.add(5000); core.tick();
  const solo = core.drain().find(e => e.type === 'toastResult');
  assert.deepEqual(solo, { type: 'toastResult', participants: [c], solo: true });
});

test('음악: 방장만 제어, 늦게 와도 같은 위치, 일시정지 보존, 신청곡 순서', () => {
  const { core, clock, inv } = setup();
  const owner = core.join({ nick: 'A', inviteToken: inv }).memberId;
  const b = core.join({ nick: 'B', inviteToken: inv }).memberId;
  assert.throws(() => core.act(b, { t: 'musicControl', cmd: 'play' }), /방장/);
  core.act(owner, { t: 'musicControl', cmd: 'play' });
  clock.add(7000);
  assert.equal(musicPosition(core.state.music, clock.now()), 7000);
  core.act(owner, { t: 'musicControl', cmd: 'pause' });
  clock.add(60000);
  assert.equal(musicPosition(core.state.music, clock.now()), 7000);
  core.act(owner, { t: 'musicControl', cmd: 'play' });
  clock.add(1000);
  assert.equal(musicPosition(core.state.music, clock.now()), 8000);

  core.act(b, { t: 'musicRequest', trackId: 3 });
  core.act(owner, { t: 'musicControl', cmd: 'next' });
  assert.equal(core.state.music.trackId, 3);
  // 곡이 끝나면 신청곡 자동 재생
  core.act(b, { t: 'musicRequest', trackId: 2 });
  clock.add(36000); core.tick();
  assert.equal(core.state.music.trackId, 2);
  assert.equal(core.state.music.queue.length, 0);
});

test('방장만 내보내기, 내보낸 멤버 토큰 무효', () => {
  const { core, inv } = setup();
  const a = core.join({ nick: 'A', inviteToken: inv }).memberId;
  const b = core.join({ nick: 'B', inviteToken: inv });
  assert.throws(() => core.act(b.memberId, { t: 'kick', memberId: a }), /방장/);
  core.act(a, { t: 'kick', memberId: b.memberId });
  assert.equal(core.state.seats[1], null);
  assert.throws(() => core.join({ memberToken: b.memberToken }), RuleError);
});
