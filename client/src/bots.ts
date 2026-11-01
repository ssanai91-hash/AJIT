// 체험판의 가상 친구들. 진짜 친구가 들어오면 이 파일은 쓰이지 않는다.
import type { LocalTransport } from './transport';

const FRIENDS = ['철수', '영희', '민준', '지수', '태호', '수진'];
const LINES = [
  '오늘 회의만 네 개 했다 ㅋㅋ', '이 노래 좋네', '난 피트 계열이 좋더라', '셰리문 한 잔 더?', '주말에 캠핑 갈 사람',
  '야 이거 진짜 바에 앉아있는 느낌이다', '건배 한 번 하자', '숭열이 또 위스키 바꿨네', '다음엔 랜선 집들이 하자',
  '퇴근!!', '배고프다… 안주는 없냐', '음악 좀 바꿔봐 방장님', '잠 온다 zzz', '이번 주도 수고했다 다들',
];

export function startBots(t: LocalTransport, me: string) {
  const ids = FRIENDS.map(n => t.joinAs(n));
  const core = t.core;
  // 처음 분위기: 몇 명은 이미 잔이 있고, 수진은 졸고 있음
  ids.forEach((id, k) => {
    if (k % 2 === 0) { t.actAs(id, { t: 'pick', whisky: [2, 8, 3][k / 2] }); t.actAs(id, { t: 'pour' }); }
  });
  core.disconnect(ids[5]);
  core.disconnect(ids[4]);
  // 입장 알림 줄은 정리하고 한 줄로
  core.state.chat = [{ id: ++core.state.chatSeq, memberId: '', nick: '', text: '단골 친구들이 먼저 와 있어요. 태호·수진은 자리에서 졸고 있어요', at: Date.now(), system: true }];
  t.flush();
  // 첫 대화
  const opening: [number, string][] = [[0, '왔냐!'], [1, '어서 와~ 자리 비워놨어'], [2, '오늘 뭐 마실래?']];
  opening.forEach(([k, txt], n) => setTimeout(() => t.actAs(ids[k], { t: 'chat', text: txt }), 1200 + n * 1800));

  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const online = () => ids.filter(id => core.state.members[id]?.online);

  const loop = () => {
    const ons = online();
    const id = pick(ons.length ? ons : ids);
    const m = core.state.members[id];
    const r = Math.random();
    if (!m) return;
    if (core.state.toast && !core.state.toast.participants.includes(id)) {
      // 건배에는 대부분 참여
      for (const o of online()) if (Math.random() < 0.8) setTimeout(() => t.actAs(o, { t: 'toastJoin' }), 600 + Math.random() * 2500);
    } else if (!m.online) {
      if (r < 0.15) { core.join({ memberToken: core.secrets.memberTokens[id] }); t.flush(); }
    } else if (r < 0.32) t.actAs(id, { t: 'chat', text: pick(LINES) });
    else if (r < 0.5) { if (!m.whisky) t.actAs(id, { t: 'pick', whisky: 1 + Math.floor(Math.random() * 12) }); else if (m.level === 0) t.actAs(id, { t: 'pour' }); else t.actAs(id, { t: 'sip' }); }
    else if (r < 0.56) t.actAs(id, { t: 'wave' });
    else if (r < 0.6 && ons.length > 2) t.actAs(id, { t: 'toastPropose' });
    else if (r < 0.63 && ons.length > 2) { core.disconnect(id); t.flush(); }
    setTimeout(loop, 2500 + Math.random() * 4000);
  };
  setTimeout(loop, 7000);
  // 사용자가 건배를 제안하면 친구들이 반응
  t.onEvent(e => {
    if (e.type === 'toastStart' && e.by === me)
      for (const o of online()) if (Math.random() < 0.85) setTimeout(() => t.actAs(o, { t: 'toastJoin' }), 700 + Math.random() * 3000);
    if (e.type === 'say' && e.memberId === me && Math.random() < 0.7) {
      const o = pick(online()); if (o) setTimeout(() => t.actAs(o, { t: 'chat', text: pick(['ㅋㅋㅋ 인정', '오 그래?', '맞아맞아', '그니까', '건배각인데?', '😂']) }), 1500 + Math.random() * 2000);
    }
  });
}
