// 방 규칙의 단일 원본. 서버(Colyseus)와 체험판(브라우저 안 가상 서버)이 똑같이 이 코드를 쓴다.
// 규격서 [2] 메시지 규칙서 v0.1 구현.

import { TRACKS, WHISKIES } from './catalog.js';

export const SEAT_COUNT = 8;
export const MAX_MEMBERS = 8;
export const CHAR_COUNT = 12;
export const VARIANT_COUNT = 25;       // 헤어 5 × 옷 5 (임시)
export const GLASS_MAX = 4;
export const CHAT_KEEP = 50;
export const CHAT_MAX_LEN = 200;
export const CHAT_INTERVAL_MS = 1000;
export const TOAST_WINDOW_MS = 5000;
export const TOAST_COOLDOWN_MS = 30000;
export const WAVE_COOLDOWN_MS = 3000;
export const QUEUE_MAX = 10;
export const NICK_MAX = 10;

export interface Member {
  id: string;
  nick: string;
  charId: number;     // 1~12
  variant: number;    // 0~24
  seat: number;       // 0~7, -1 = 서 있음
  online: boolean;
  lastSeen: number;
  lastSay: string;
  lastSayAt: number;
  whisky: number;     // 0 = 없음, 1~12
  level: number;      // 0~4
}

export interface ChatLine { id: number; memberId: string; nick: string; text: string; at: number; system?: boolean }

export interface Toast { by: string; participants: string[]; deadline: number }

export interface Music { trackId: number; startedAt: number; pausedAt: number | null; queue: { trackId: number; by: string }[] }

export interface BarState {
  code: string;
  name: string;
  ownerId: string;
  seats: (string | null)[];
  members: Record<string, Member>;
  toast: Toast | null;
  music: Music;
  chat: ChatLine[];
  chatSeq: number;
}

// 화면에 보내지 않는 비밀 정보
export interface Secrets {
  inviteToken: string;
  memberTokens: Record<string, string>;   // memberId -> token
}

export type BarEvent =
  | { type: 'enter'; memberId: string; first: boolean }
  | { type: 'leave'; memberId: string }
  | { type: 'say'; memberId: string; text: string }
  | { type: 'sip'; memberId: string }
  | { type: 'pour'; memberId: string }
  | { type: 'wave'; memberId: string }
  | { type: 'toastStart'; by: string; deadline: number }
  | { type: 'toastJoin'; memberId: string }
  | { type: 'toastResult'; participants: string[]; solo: boolean }
  | { type: 'kicked'; memberId: string };

export type Action =
  | { t: 'sit'; seat: number }
  | { t: 'reroll' }
  | { t: 'pick'; whisky: number }
  | { t: 'pour' }
  | { t: 'sip' }
  | { t: 'chat'; text: string }
  | { t: 'toastPropose' }
  | { t: 'toastJoin' }
  | { t: 'musicRequest'; trackId: number }
  | { t: 'musicControl'; cmd: 'play' | 'pause' | 'next' }
  | { t: 'wave' }
  | { t: 'kick'; memberId: string }
  | { t: 'rename'; name: string };

export class RuleError extends Error {}

type Rand = () => number;

export class BarCore {
  state: BarState;
  secrets: Secrets;
  private lastChat: Record<string, number> = {};
  private lastToast: Record<string, number> = {};
  private lastWave: Record<string, number> = {};
  private events: BarEvent[] = [];

  constructor(
    init: { state: BarState; secrets: Secrets },
    private now: () => number = Date.now,
    private rand: Rand = Math.random,
  ) {
    this.state = init.state;
    this.secrets = init.secrets;
  }

  static create(code: string, name: string, now = Date.now(), rand: Rand = Math.random) {
    const state: BarState = {
      code, name: name.slice(0, 20) || '우리 바', ownerId: '',
      seats: Array(SEAT_COUNT).fill(null),
      members: {}, toast: null,
      music: { trackId: TRACKS[0].id, startedAt: now, pausedAt: now, queue: [] },
      chat: [], chatSeq: 0,
    };
    return { state, secrets: { inviteToken: token(rand), memberTokens: {} } as Secrets };
  }

  /** 쌓인 이벤트를 꺼낸다 (서버가 방송) */
  drain(): BarEvent[] { const e = this.events; this.events = []; return e; }

  // ── 입장 ──────────────────────────────────────────────

  /**
   * 입장. memberToken이 맞으면 기존 멤버로 복귀, 아니면 inviteToken으로 신규 가입.
   * 반환: memberId와 (신규일 때) 새 memberToken
   */
  join(opts: { nick?: string; inviteToken?: string; memberToken?: string }): { memberId: string; memberToken: string } {
    const s = this.state;
    if (opts.memberToken) {
      const id = Object.keys(this.secrets.memberTokens).find(k => this.secrets.memberTokens[k] === opts.memberToken);
      if (id && s.members[id]) {
        const m = s.members[id];
        m.online = true; m.lastSeen = this.now();
        this.events.push({ type: 'enter', memberId: id, first: false });
        this.system(`${m.nick}님이 바에 들어왔어요`);
        return { memberId: id, memberToken: opts.memberToken };
      }
    }
    if (!opts.inviteToken || opts.inviteToken !== this.secrets.inviteToken) throw new RuleError('초대 링크가 올바르지 않아요');
    if (Object.keys(s.members).length >= MAX_MEMBERS) throw new RuleError('바가 꽉 찼어요 (최대 8명)');
    const nick = cleanNick(opts.nick);
    if (!nick) throw new RuleError('닉네임을 입력해 주세요');
    if (Object.values(s.members).some(m => m.nick === nick)) throw new RuleError('이미 있는 닉네임이에요');

    const id = 'm' + token(this.rand).slice(0, 8);
    const seat = s.seats.findIndex(x => x === null);
    const m: Member = {
      id, nick, charId: 1 + Math.floor(this.rand() * CHAR_COUNT), variant: Math.floor(this.rand() * VARIANT_COUNT),
      seat, online: true, lastSeen: this.now(), lastSay: '', lastSayAt: 0, whisky: 0, level: 0,
    };
    s.members[id] = m;
    if (seat >= 0) s.seats[seat] = id;
    if (!s.ownerId) s.ownerId = id;
    const mt = token(this.rand);
    this.secrets.memberTokens[id] = mt;
    this.events.push({ type: 'enter', memberId: id, first: true });
    this.system(`${nick}님이 처음으로 바에 왔어요!`);
    return { memberId: id, memberToken: mt };
  }

  /** 접속 끊김. 자리는 유지되고 '졸기' 상태가 된다 */
  disconnect(memberId: string) {
    const m = this.state.members[memberId];
    if (!m || !m.online) return;
    m.online = false; m.lastSeen = this.now();
    this.state.toast?.participants && (this.state.toast.participants = this.state.toast.participants.filter(p => p !== memberId));
    this.events.push({ type: 'leave', memberId });
  }

  // ── 행동 ──────────────────────────────────────────────

  act(memberId: string, a: Action) {
    const s = this.state;
    const m = s.members[memberId];
    if (!m) throw new RuleError('멤버가 아니에요');
    const now = this.now();

    switch (a.t) {
      case 'sit': {
        if (!Number.isInteger(a.seat) || a.seat < 0 || a.seat >= SEAT_COUNT) throw new RuleError('없는 자리예요');
        if (s.seats[a.seat] && s.seats[a.seat] !== memberId) throw new RuleError('이미 누가 앉아 있어요');
        if (m.seat >= 0) s.seats[m.seat] = null;
        s.seats[a.seat] = memberId; m.seat = a.seat;
        return;
      }
      case 'reroll': {
        m.charId = 1 + Math.floor(this.rand() * CHAR_COUNT);
        m.variant = Math.floor(this.rand() * VARIANT_COUNT);
        return;
      }
      case 'pick': {
        if (!WHISKIES.some(w => w.id === a.whisky)) throw new RuleError('없는 위스키예요');
        if (m.whisky !== a.whisky) { m.whisky = a.whisky; m.level = 0; }
        return;
      }
      case 'pour': {
        if (!m.whisky) throw new RuleError('먼저 위스키를 골라 주세요');
        if (m.level >= GLASS_MAX) throw new RuleError('잔이 가득 찼어요');
        m.level = GLASS_MAX;
        this.events.push({ type: 'pour', memberId });
        return;
      }
      case 'sip': {
        if (m.level < 1) throw new RuleError('잔이 비었어요');
        m.level -= 1;
        this.events.push({ type: 'sip', memberId });
        return;
      }
      case 'chat': {
        const text = String(a.text ?? '').replace(/\s+/g, ' ').trim();
        if (!text) throw new RuleError('빈 메시지예요');
        if (text.length > CHAT_MAX_LEN) throw new RuleError(`${CHAT_MAX_LEN}자까지 쓸 수 있어요`);
        if (now - (this.lastChat[memberId] ?? 0) < CHAT_INTERVAL_MS) throw new RuleError('조금 천천히 말해 주세요');
        this.lastChat[memberId] = now;
        m.lastSay = text; m.lastSayAt = now;
        this.pushChat({ memberId, nick: m.nick, text, at: now });
        this.events.push({ type: 'say', memberId, text });
        return;
      }
      case 'toastPropose': {
        if (s.toast) throw new RuleError('이미 건배가 진행 중이에요');
        if (now - (this.lastToast[memberId] ?? -Infinity) < TOAST_COOLDOWN_MS) throw new RuleError('건배는 30초에 한 번만 제안할 수 있어요');
        this.lastToast[memberId] = now;
        s.toast = { by: memberId, participants: [memberId], deadline: now + TOAST_WINDOW_MS };
        this.events.push({ type: 'toastStart', by: memberId, deadline: s.toast.deadline });
        return;
      }
      case 'toastJoin': {
        if (!s.toast || now > s.toast.deadline) throw new RuleError('건배가 이미 끝났어요');
        if (!s.toast.participants.includes(memberId)) {
          s.toast.participants.push(memberId);
          this.events.push({ type: 'toastJoin', memberId });
        }
        return;
      }
      case 'musicRequest': {
        if (!TRACKS.some(t => t.id === a.trackId)) throw new RuleError('없는 곡이에요');
        if (s.music.queue.length >= QUEUE_MAX) throw new RuleError('신청곡이 가득 찼어요');
        s.music.queue.push({ trackId: a.trackId, by: memberId });
        this.system(`${m.nick}님이 「${TRACKS.find(t => t.id === a.trackId)!.title}」을 신청했어요`);
        return;
      }
      case 'musicControl': {
        if (memberId !== s.ownerId) throw new RuleError('음악은 방장만 조작할 수 있어요');
        const mu = s.music;
        if (a.cmd === 'pause' && mu.pausedAt === null) mu.pausedAt = now;
        else if (a.cmd === 'play' && mu.pausedAt !== null) { mu.startedAt += now - mu.pausedAt; mu.pausedAt = null; }
        else if (a.cmd === 'next') {
          const nextId = mu.queue.length ? mu.queue.shift()!.trackId : nextTrack(mu.trackId);
          mu.trackId = nextId; mu.startedAt = now; mu.pausedAt = null;
        }
        return;
      }
      case 'wave': {
        if (now - (this.lastWave[memberId] ?? -Infinity) < WAVE_COOLDOWN_MS) throw new RuleError('잠깐만요');
        this.lastWave[memberId] = now;
        this.events.push({ type: 'wave', memberId });
        return;
      }
      case 'kick': {
        if (memberId !== s.ownerId) throw new RuleError('방장만 내보낼 수 있어요');
        if (a.memberId === memberId) throw new RuleError('방장은 나갈 수 없어요');
        const k = s.members[a.memberId];
        if (!k) throw new RuleError('없는 멤버예요');
        if (k.seat >= 0) s.seats[k.seat] = null;
        delete s.members[a.memberId];
        delete this.secrets.memberTokens[a.memberId];
        this.system(`${k.nick}님이 바를 떠났어요`);
        this.events.push({ type: 'kicked', memberId: a.memberId });
        return;
      }
      case 'rename': {
        if (memberId !== s.ownerId) throw new RuleError('방장만 바 이름을 바꿀 수 있어요');
        const n = String(a.name ?? '').trim().slice(0, 20);
        if (!n) throw new RuleError('이름을 입력해 주세요');
        s.name = n;
        return;
      }
      default:
        throw new RuleError('알 수 없는 요청이에요');
    }
  }

  /** 주기적으로 호출: 건배 마감, 곡 넘김 처리. 다음에 깨워야 할 시각(없으면 null) 반환 */
  tick(): number | null {
    const s = this.state;
    const now = this.now();
    if (s.toast && now >= s.toast.deadline) {
      const participants = s.toast.participants.filter(id => s.members[id]);
      s.toast = null;
      const solo = participants.length < 2;
      this.events.push({ type: 'toastResult', participants, solo });
      if (!solo) this.system(`🥃 ${participants.map(id => s.members[id].nick).join(', ')} 건배! 오늘도 수고했다!`);
    }
    const mu = s.music;
    if (mu.pausedAt === null) {
      const dur = TRACKS.find(t => t.id === mu.trackId)!.durationMs;
      if (now - mu.startedAt >= dur && mu.queue.length) {
        const next = mu.queue.shift()!;
        mu.trackId = next.trackId; mu.startedAt = now;
      }
      // 신청곡이 없으면 같은 곡이 루프된다 (위치 = 경과 % 길이)
    }
    let wake: number | null = s.toast ? s.toast.deadline : null;
    if (mu.pausedAt === null && mu.queue.length) {
      const end = mu.startedAt + TRACKS.find(t => t.id === mu.trackId)!.durationMs;
      wake = wake === null ? end : Math.min(wake, end);
    }
    return wake;
  }

  private system(text: string) {
    this.pushChat({ memberId: '', nick: '', text, at: this.now(), system: true });
  }

  private pushChat(l: Omit<ChatLine, 'id'>) {
    const s = this.state;
    s.chat.push({ id: ++s.chatSeq, ...l });
    if (s.chat.length > CHAT_KEEP) s.chat.splice(0, s.chat.length - CHAT_KEEP);
  }
}

/** 음악 재생 위치(ms). 화면은 서버 시각 기준으로 이 값을 계산해서 재생한다 */
export function musicPosition(mu: Music, serverNow: number): number {
  const dur = TRACKS.find(t => t.id === mu.trackId)!.durationMs;
  const t = (mu.pausedAt ?? serverNow) - mu.startedAt;
  return ((t % dur) + dur) % dur;
}

function nextTrack(id: number) {
  const i = TRACKS.findIndex(t => t.id === id);
  return TRACKS[(i + 1) % TRACKS.length].id;
}

function cleanNick(n?: string) {
  return String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, NICK_MAX);
}

function token(rand: Rand) {
  let s = '';
  const c = 'abcdefghijkmnpqrstuvwxyz23456789';
  for (let i = 0; i < 22; i++) s += c[Math.floor(rand() * c.length)];
  return s;
}
