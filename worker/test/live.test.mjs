// 로컬 서버(wrangler dev)에 휴대폰 여러 대가 붙는 상황 시험:  npx wrangler dev 실행 후 node test/live.test.mjs
import WebSocket from 'ws';
import assert from 'node:assert/strict';

const BASE = process.env.AJIT_URL ?? 'http://127.0.0.1:8787';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(BASE).hostname)) throw new Error('이 시험은 빈 로컬 서버에서만 실행하세요');
const WS = BASE.replace(/^http/, 'ws') + '/api/bar/ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function phone(hello) {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS);
    const p = { ws, state: null, evs: [], errs: [], me: null, token: null, closed: false };
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', ...hello })));
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.type === 'welcome') { p.me = m.me; p.token = m.token; resolve(p); }
      if (m.type === 'state') p.state = m.state;
      if (m.type === 'ev') p.evs.push(m.ev);
      if (m.type === 'err') { p.errs.push(m.msg); if (m.fatal) resolve(p); }
    });
    ws.on('close', () => { p.closed = true; });
  });
}
const send = (p, o) => p.ws.send(JSON.stringify(o));
async function until(fn, ms = 4000) { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('시간 초과'); await sleep(30); } }
const ok = (name) => console.log('  ✓', name);

console.log('아지트 실시간 서버 시험');

// 1) 공개 입장, 감정 기능은 임시 중지
const info = await (await fetch(BASE + '/api/bar')).json();
assert.equal(info.inviteRequired, false);
assert.equal(info.emotionsEnabled, false); ok('초대 코드 없는 공개 입장, 감정 기능 중지');

// 2) 숭열·찬수 입장
const sy = await phone({ claim: 'sungyeol' });
assert.equal(sy.me, 'sungyeol'); assert.ok(sy.token);
let cs = await phone({ claim: 'chansu' });
assert.equal(cs.me, 'chansu'); ok('초대 코드 없이 숭열·찬수 캐릭터 선택');

// 3) 같은 캐릭터를 새 기기로 옮기고 이전 토큰을 폐기
const dup = await phone({ claim: 'chansu' });
assert.equal(dup.me, 'chansu');
assert.notEqual(dup.token, cs.token);
await until(() => cs.closed);
assert.ok(cs.errs.some((e) => /다른 기기/.test(e)));
const stale = await phone({ token: cs.token });
assert.ok(stale.errs.length); cs = dup;
ok('새 기기로 이동, 이전 연결 종료·토큰 폐기');

await until(() => sy.state?.online?.length === 2);
const roster = await (await fetch(BASE + '/api/bar')).json();
assert.deepEqual(roster.members.filter((m) => m.claimed).map((m) => m.id).sort(), ['chansu', 'sungyeol']);
ok('멤버 목록에 주인·접속 상태 반영');

// 4) 채팅 → 상대 화면에 말풍선 이벤트 + 대화 기록
send(cs, { t: 'chat', text: '숭열 왔냐!' });
await until(() => sy.evs.some((e) => e.type === 'say' && e.text === '숭열 왔냐!'));
assert.ok(sy.state.chat.some((l) => l.who === 'chansu' && l.text === '숭열 왔냐!')); ok('채팅이 서로 보임');

// 5) 따르기·한 모금
send(sy, { t: 'pick', whisky: 5 }); send(sy, { t: 'pour' }); send(sy, { t: 'sip' });
await until(() => cs.state.members.sungyeol.level === 3 && cs.evs.some((e) => e.type === 'sip' && e.id === 'sungyeol'));
assert.equal(cs.state.members.sungyeol.whisky, 5); ok('술 고르기·따르기·한 모금이 상대 화면에 반영');

// 6) 예전 화면이 감정 요청을 보내도 기본 얼굴 유지
send(cs, { t: 'emo', emo: 'laugh' });
await until(() => cs.errs.some((e) => /감정 기능은 준비 중/.test(e)));
assert.equal(sy.state.members.chansu.emo, 'neutral');
assert.ok(!sy.evs.some((e) => e.type === 'emo')); ok('감정 요청 차단, 기본 얼굴 유지');

// 7) 입력 중 표시
send(cs, { t: 'typing' });
await until(() => sy.evs.some((e) => e.type === 'typing' && e.id === 'chansu')); ok('입력 중 표시 전달');

// 8) 건배: 숭열 제안, 찬수 참여 → 5초 뒤 둘이 건배
send(sy, { t: 'toast' });
await until(() => cs.evs.some((e) => e.type === 'toastStart'));
send(cs, { t: 'toast' });
await until(() => cs.evs.some((e) => e.type === 'toastResult'), 8000);
const tr = cs.evs.find((e) => e.type === 'toastResult');
assert.deepEqual(tr.participants.sort(), ['chansu', 'sungyeol']); ok('건배 제안·참여·결과 (5초 마감)');

// 9) 찬수 나갔다가 토큰으로 복귀 → 같은 캐릭터, 잔 상태 유지
cs.ws.close();
await until(() => sy.state.online.length === 1);
assert.ok(sy.evs.some((e) => e.type === 'leave' && e.id === 'chansu')); ok('나가면 접속 해제 표시');
const cs2 = await phone({ token: cs.token });
assert.equal(cs2.me, 'chansu');
await until(() => cs2.state?.online?.length === 2);
assert.equal(cs2.state.members.chansu.emo, 'neutral'); ok('토큰으로 같은 캐릭터·기본 얼굴 복귀');

// 10) 잘못된 토큰 → 다시 고르라고 안내
const ghost = await phone({ token: 'nope' });
assert.match(ghost.errs[0], /입장 정보/); ok('모르는 토큰은 다시 고르기로');

// 11) 방장만 자리 비우기
send(cs2, { t: 'release', id: 'jungin' });
await until(() => cs2.errs.some((e) => /방장만/.test(e))); ok('방장이 아니면 자리 비우기 불가');

for (const p of [sy, cs2]) p.ws.close();
console.log('모두 통과');
process.exit(0);
