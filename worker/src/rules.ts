// 고화질 바의 방 규칙 (순수 로직, Cloudflare·테스트 공용)
// 멤버는 방장이 미리 정해 둔 고정 캐릭터. 누구나 링크로 들어와 '빈 캐릭터'를 골라 자기 것으로 만든다.

export const WHISKY_COUNT = 12;
export const GLASS_MAX = 4;
export const CHAT_KEEP = 80;
export const CHAT_MAX = 200;
export const TOAST_MS = 5000;
export const EMO = ['neutral', 'smile', 'laugh', 'surprised', 'sad', 'worried', 'annoyed', 'tipsy', 'sleepy'] as const;
export type Emo = (typeof EMO)[number];
export const EMO_LABEL: Record<Emo, string> = {
  neutral: '기본', smile: '미소', laugh: '큰웃음', surprised: '놀람', sad: '슬픔', worried: '걱정', annoyed: '짜증', tipsy: '알딸딸', sleepy: '졸림',
};

export interface Member {
  id: string;          // 캐릭터 키 (chansu, jungin, sungyeol)
  name: string;
  owner: boolean;
  seated: boolean;     // 나가기를 누르기 전까지 자리 유지
  claimed: boolean;    // 누군가 이 캐릭터를 자기 것으로 가져갔는지
  whisky: number;      // 1~12
  level: number;       // 0~4
  emo: Emo;
  emoUntil: number;
  lastSeen: number;
}

export interface Line { seq: number; who: string; kind: 'say' | 'emo' | 'sys'; text: string; emo?: Emo; at: number }

export interface Toast { by: string; participants: string[]; deadline: number }

export interface State {
  name: string;
  members: Record<string, Member>;
  order: string[];
  toast: Toast | null;
  chat: Line[];
  seq: number;
}

export type Ev =
  | { type: 'say'; id: string; text: string }
  | { type: 'pour'; id: string }
  | { type: 'sip'; id: string }
  | { type: 'wave'; id: string }
  | { type: 'emo'; id: string; emo: Emo }
  | { type: 'typing'; id: string }
  | { type: 'toastStart'; by: string; deadline: number }
  | { type: 'toastResult'; participants: string[] }
  | { type: 'enter'; id: string }
  | { type: 'leave'; id: string };

export type Action =
  | { t: 'chat'; text: string }
  | { t: 'pick'; whisky: number }
  | { t: 'pour' }
  | { t: 'sip' }
  | { t: 'wave' }
  | { t: 'emo'; emo: Emo }
  | { t: 'typing' }
  | { t: 'toast' }
  | { t: 'release'; id: string };   // 방장: 친구가 휴대폰을 바꿨을 때 자리 비우기

export class RuleError extends Error {}

export const ROSTER = [
  { id: 'chansu', name: '찬수', whisky: 5, owner: false },
  { id: 'sungyeol', name: '숭열', whisky: 6, owner: true },
  { id: 'jungin', name: '정인', whisky: 8, owner: false },
];

export function initialState(now: number): State {
  const members: Record<string, Member> = {};
  for (const r of ROSTER) members[r.id] = { id: r.id, name: r.name, owner: r.owner, claimed: false, seated: false, whisky: r.whisky, level: 2, emo: 'neutral', emoUntil: 0, lastSeen: 0 };
  return { name: '숭열이네 바', members, order: ROSTER.map((r) => r.id), toast: null, chat: [{ seq: 1, who: '', kind: 'sys', text: '바가 문을 열었어요', at: now }], seq: 1 };
}

export function pushLine(s: State, l: Omit<Line, 'seq'>) {
  s.chat.push({ seq: ++s.seq, ...l });
  if (s.chat.length > CHAT_KEEP) s.chat.splice(0, s.chat.length - CHAT_KEEP);
}

/** 행동 적용. 반환: 모두에게 보낼 순간 연출, 저장 필요 여부 */
export function apply(s: State, id: string, a: Action, now: number): { evs: Ev[]; save: boolean; alarm?: number } {
  const m = s.members[id];
  if (!m) throw new RuleError('멤버가 아니에요');
  switch (a.t) {
    case 'chat': {
      const text = String(a.text ?? '').replace(/\s+/g, ' ').trim();
      if (!text) throw new RuleError('빈 메시지예요');
      if (text.length > CHAT_MAX) throw new RuleError(`${CHAT_MAX}자까지 쓸 수 있어요`);
      const emo = m.emoUntil > now ? m.emo : 'neutral';
      pushLine(s, { who: id, kind: 'say', text, emo, at: now });
      return { evs: [{ type: 'say', id, text }], save: true };
    }
    case 'pick': {
      const w = Math.floor(Number(a.whisky));
      if (!(w >= 1 && w <= WHISKY_COUNT)) throw new RuleError('없는 위스키예요');
      if (m.whisky !== w) { m.whisky = w; m.level = 0; }
      return { evs: [], save: true };
    }
    case 'pour':
      m.level = GLASS_MAX;
      return { evs: [{ type: 'pour', id }], save: true };
    case 'sip':
      if (m.level < 1) throw new RuleError('잔이 비었어요. 먼저 따르세요');
      m.level -= 1;
      return { evs: [{ type: 'sip', id }], save: true };
    case 'wave':
      return { evs: [{ type: 'wave', id }], save: false };
    case 'typing':
      return { evs: [{ type: 'typing', id }], save: false };
    case 'emo': {
      throw new RuleError('감정 기능은 준비 중이에요');
    }
    case 'toast': {
      // 진행 중인 건배가 있으면 참여, 없으면 제안
      if (s.toast && now < s.toast.deadline) {
        if (!s.toast.participants.includes(id)) s.toast.participants.push(id);
        return { evs: [], save: true };
      }
      s.toast = { by: id, participants: [id], deadline: now + TOAST_MS };
      return { evs: [{ type: 'toastStart', by: id, deadline: s.toast.deadline }], save: true, alarm: s.toast.deadline };
    }
    case 'release': {
      if (!m.owner) throw new RuleError('방장만 자리를 비울 수 있어요');
      const t = s.members[a.id];
      if (!t || t.owner) throw new RuleError('비울 수 없는 자리예요');
      t.claimed = false;
      pushLine(s, { who: '', kind: 'sys', text: `${t.name} 자리를 비웠어요. 초대 링크로 다시 고를 수 있어요`, at: now });
      return { evs: [], save: true };
    }
    default:
      throw new RuleError('알 수 없는 요청이에요');
  }
}

/** 건배 마감 처리 */
export function resolveToast(s: State, now: number): Ev[] {
  if (!s.toast || now < s.toast.deadline) return [];
  const ps = s.toast.participants.filter((p) => s.members[p]);
  s.toast = null;
  if (ps.length >= 2) pushLine(s, { who: '', kind: 'sys', text: `${ps.map((p) => s.members[p].name).join(', ')} 건배! 오늘도 수고했다`, at: now });
  else pushLine(s, { who: '', kind: 'sys', text: `${s.members[ps[0]]?.name ?? '누군가'}님이 혼자 잔을 들었어요`, at: now });
  return [{ type: 'toastResult', participants: ps }];
}

export function token() {
  const b = new Uint8Array(18); crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
