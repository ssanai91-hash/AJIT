// 1차 임시 음악: 저작권 걱정 없는 칩튠을 휴대폰에서 직접 합성한다.
// 모든 휴대폰이 같은 악보(시드 고정)를 '서버 시각 기준 같은 위치'부터 연주 → 같은 구간을 함께 듣는다.
import { TRACKS } from '../../shared/catalog';
import { musicPosition, type Music } from '../../shared/core';

interface Note { t: number; dur: number; freq: number; voice: 'bass' | 'chord' | 'lead' | 'hat'; vel: number }

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

/** 곡마다 결정적으로 같은 악보를 만든다 */
function compose(trackId: number): { notes: Note[]; len: number } {
  const tr = TRACKS.find(t => t.id === trackId)!;
  const len = tr.durationMs / 1000;
  const r = rng(trackId * 7919);
  const notes: Note[] = [];
  const spec = {
    1: { beats: 4, bpm: 120, prog: [[45, 0], [45, 0], [50, 0], [45, 0], [52, 0], [50, 0], [45, 0], [52, 0]], scale: [0, 3, 5, 6, 7, 10], swing: 0.16 },
    2: { beats: 4, bpm: 90, prog: [[50, 1], [55, 0], [48, 1], [53, 1], [50, 1], [43, 0], [48, 1], [45, 0]], scale: [0, 2, 3, 5, 7, 9, 10], swing: 0.12 },
    3: { beats: 3, bpm: 120, prog: [[48, 1], [45, 2], [50, 2], [43, 1], [48, 1], [53, 1], [43, 1], [48, 1]], scale: [0, 2, 4, 7, 9], swing: 0 },
  }[trackId as 1 | 2 | 3]!;
  const beat = 60 / spec.bpm;
  const bar = beat * spec.beats;
  const bars = Math.round(len / bar);
  for (let b = 0; b < bars; b++) {
    const [root, q] = spec.prog[b % spec.prog.length];
    const third = q === 1 ? 3 : q === 2 ? 3 : 4;   // 0=7th 블루스, 1=마이너, 2=마이너
    const chord = [root + 12, root + 12 + third, root + 19, root + 12 + (q === 0 ? 10 : 10)];
    const t0 = b * bar;
    for (let k = 0; k < spec.beats; k++) {
      const tb = t0 + k * beat;
      // 워킹 베이스
      const walk = [0, 7, 12, 7, 0, 5, 7, 10][(b * spec.beats + k) % 8];
      notes.push({ t: tb, dur: beat * 0.9, freq: midi(root - 12 + walk), voice: 'bass', vel: k === 0 ? 1 : 0.8 });
      // 하이햇 (스윙)
      notes.push({ t: tb, dur: 0.03, freq: 0, voice: 'hat', vel: 0.6 });
      notes.push({ t: tb + beat * (0.5 + spec.swing), dur: 0.02, freq: 0, voice: 'hat', vel: 0.35 });
    }
    // 코드: 2·4박 (왈츠는 2·3박)
    for (const k of spec.beats === 3 ? [1, 2] : [1, 3])
      for (const n of chord) notes.push({ t: t0 + k * beat, dur: beat * 0.45, freq: midi(n), voice: 'chord', vel: 0.5 });
    // 멜로디: 4마디 단위로 반복되는 동기
    if (b % 8 >= 2) {
      const motifR = rng(trackId * 31 + (b % 4));
      let step = 0;
      while (step < spec.beats * 2) {
        const len8 = motifR() < 0.6 ? 1 : 2;
        if (motifR() < 0.72) {
          const deg = spec.scale[Math.floor(motifR() * spec.scale.length)];
          const oct = motifR() < 0.3 ? 12 : 0;
          const sw = step % 2 ? spec.swing * beat : 0;
          notes.push({ t: t0 + step * beat / 2 + sw, dur: len8 * beat / 2 * 0.85, freq: midi(root + 24 + deg + oct), voice: 'lead', vel: 0.55 + motifR() * 0.3 });
        }
        step += len8;
      }
    }
    void r;
  }
  return { notes, len: bars * bar };
}

export class Jukebox {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private timer = 0;
  private song: { trackId: number; notes: Note[]; len: number } | null = null;
  private scheduledUntil = 0;           // 곡 시간(초) 기준으로 어디까지 예약했는지
  private anchor = 0;                   // ctx.currentTime - 곡위치
  private state: Music | null = null;
  private serverNow: () => number = Date.now;
  volume = 0.7;

  get enabled() { return !!this.ctx && this.ctx.state === 'running'; }

  /** '소리 켜기' 버튼에서만 호출 (브라우저 자동재생 차단 때문) */
  async enable() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.55; this.musicBus.connect(lp);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    await this.ctx.resume();
    this.resync();
    this.timer ||= window.setInterval(() => this.pump(), 100);
  }

  mute() {
    this.ctx?.suspend();
  }

  setVolume(v: number) { this.volume = v; if (this.ctx) this.master.gain.value = v; }

  update(state: Music, serverNow: () => number) {
    const changed = !this.state || this.state.trackId !== state.trackId || this.state.startedAt !== state.startedAt || this.state.pausedAt !== state.pausedAt;
    this.state = state; this.serverNow = serverNow;
    if (changed) this.resync();
  }

  private resync() {
    if (!this.ctx || !this.state) return;
    // 이미 예약한 음 정리
    this.musicBus.disconnect();
    const lp = this.master; void lp;
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.55;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600; f.connect(this.master);
    this.musicBus.connect(f);
    if (this.state.pausedAt !== null) { this.song = null; return; }
    if (!this.song || this.song.trackId !== this.state.trackId) this.song = { trackId: this.state.trackId, ...compose(this.state.trackId) };
    const pos = musicPosition(this.state, this.serverNow()) / 1000;
    this.anchor = this.ctx.currentTime - pos + 0.05;
    this.scheduledUntil = pos;
  }

  private pump() {
    if (!this.ctx || !this.song || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime - this.anchor;      // 곡 시간 (루프 누적)
    const until = now + 0.4;
    const { notes, len } = this.song;
    let t = this.scheduledUntil;
    while (t < until) {
      const loop = Math.floor(t / len);
      const segEnd = Math.min(until, (loop + 1) * len);
      const a = t - loop * len, b = segEnd - loop * len;
      for (const n of notes) if (n.t >= a && n.t < b) this.play(n, this.anchor + loop * len + n.t);
      t = segEnd;
    }
    this.scheduledUntil = until;
  }

  private play(n: Note, at: number) {
    const ctx = this.ctx!; if (at < ctx.currentTime) return;
    const g = ctx.createGain(); g.connect(this.musicBus);
    if (n.voice === 'hat') {
      const s = ctx.createBufferSource(); s.buffer = this.noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      s.connect(hp); hp.connect(g);
      g.gain.setValueAtTime(0.06 * n.vel, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      s.start(at, Math.random() * 0.4, 0.06); return;
    }
    const o = ctx.createOscillator();
    o.type = n.voice === 'bass' ? 'triangle' : n.voice === 'chord' ? 'square' : 'square';
    o.frequency.value = n.freq;
    const peak = (n.voice === 'bass' ? 0.32 : n.voice === 'chord' ? 0.035 : 0.06) * n.vel;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + n.dur);
    if (n.voice === 'lead') { o.detune.setValueAtTime(-20, at); o.detune.linearRampToValueAtTime(0, at + 0.06); }
    o.connect(g); o.start(at); o.stop(at + n.dur + 0.02);
  }

  // ── 효과음 ──
  clink() {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    for (const [f, d] of [[2637, 0], [3136, 0.07], [2093, 0.14]] as const) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(this.master);
      const at = ctx.currentTime + d;
      g.gain.setValueAtTime(0.18, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.start(at); o.stop(at + 0.55);
    }
  }
  pour() {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
    const g = ctx.createGain(); s.connect(bp); bp.connect(g); g.connect(this.master);
    const at = ctx.currentTime;
    bp.frequency.setValueAtTime(500, at); bp.frequency.linearRampToValueAtTime(1400, at + 0.5);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.25, at + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
    s.start(at, 0, 0.6);
  }
  blip() {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'square'; o.frequency.value = 880;
    o.connect(g); g.connect(this.master); const at = ctx.currentTime;
    g.gain.setValueAtTime(0.04, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.08); o.start(at); o.stop(at + 0.1);
  }
}
