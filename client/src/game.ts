// 바 장면 (Phaser 3). 256×224 도트 해상도로 그리고 화면에는 정수배로 키운다.
import Phaser from 'phaser';
import type { BarEvent, BarState, Member } from '../../shared/core';
import { ANIM, FRAME_H, FRAME_W, FURNITURE, HAIR_RAMPS, LAMPS, SCENE_H, SCENE_W, SEATS, SHELF_BOTTLES, SHIRT_RAMPS, type AnimName } from '../../shared/layout';

const files = import.meta.glob('../../assets/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const ASSET: Record<string, string> = {};
for (const [p, url] of Object.entries(files)) {
  const name = p.split('/').pop()!.replace('.png', '');
  if (!name.startsWith('_')) ASSET[name] = url;
}

export interface SceneHooks {
  onSeatTap(seat: number, memberId: string | null): void;
  onBottleTap(whisky: number): void;
  onJukeboxTap(): void;
  onReady(): void;
}

interface SeatView {
  chair: Phaser.GameObjects.Image;
  char: Phaser.GameObjects.Sprite;
  bottle: Phaser.GameObjects.Image;
  glass: Phaser.GameObjects.Image;
  zzz: Phaser.GameObjects.Image;
  texKey: string;
  memberId: string | null;
  online: boolean;
  busyUntil: number;
}

const hexRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export class BarScene extends Phaser.Scene {
  hooks!: SceneHooks;
  seats: SeatView[] = [];
  jukebox!: Phaser.GameObjects.Sprite;
  sparkles!: Phaser.GameObjects.Group;
  private pending: { s: BarState; me: string } | null = null;
  private ready = false;

  constructor() { super('bar'); }

  preload() {
    for (const [k, url] of Object.entries(ASSET)) {
      if (k === 'furn_jukebox') this.load.spritesheet(k, url, { frameWidth: 32, frameHeight: 48 });
      else if (k === 'furn_lamp') this.load.spritesheet(k, url, { frameWidth: 16, frameHeight: 32 });
      else this.load.image(k, url);
    }
  }

  create() {
    this.add.image(0, 0, 'bg_room').setOrigin(0).setDepth(0);
    for (const f of FURNITURE) {
      if (f.key === 'furn_jukebox') continue;
      this.add.image(f.x, f.y, f.key).setOrigin(0).setDepth(f.key === 'furn_table' ? 5 : 1);
    }
    // 은은한 조명 빛 (가산 합성)
    const glow = this.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    for (const l of LAMPS) for (let r = 34; r > 0; r -= 6) { glow.fillStyle(0xb5651d, 0.035); glow.fillCircle(l.x + 8, l.y + 34, r); }
    this.tweens.add({ targets: glow, alpha: { from: 0.85, to: 1 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });

    this.anims.create({ key: 'lamp', frames: this.anims.generateFrameNumbers('furn_lamp', {}), frameRate: 0.8, repeat: -1 });
    for (const l of LAMPS) this.add.sprite(l.x, l.y, 'furn_lamp').setOrigin(0).setDepth(2).play({ key: 'lamp', startFrame: (l.x / 80) % 2 });
    this.anims.create({ key: 'juke', frames: this.anims.generateFrameNumbers('furn_jukebox', {}), frameRate: 2, repeat: -1 });
    const jf = FURNITURE.find(f => f.key === 'furn_jukebox')!;
    this.jukebox = this.add.sprite(jf.x, jf.y, 'furn_jukebox').setOrigin(0).setDepth(1).setInteractive({ useHandCursor: true });
    this.jukebox.on('pointerup', () => this.hooks.onJukeboxTap());

    for (const b of SHELF_BOTTLES) {
      const z = this.add.zone(b.x - 3, b.y - 2, 14, 24).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.hooks.onBottleTap(b.id));
    }

    SEATS.forEach((def, i) => {
      const chair = this.add.image(def.chair.x, def.chair.y, def.chair.key).setOrigin(0).setFlipX(def.chair.flip)
        .setDepth(def.behindTable ? 3 : 6);
      const char = this.add.sprite(def.x, def.y, '__DEFAULT').setOrigin(0).setDepth(def.behindTable ? 4 : 7).setVisible(false);
      const bottle = this.add.image(def.bottle.x, def.bottle.y, 'bottle_01').setOrigin(0).setDepth(8).setVisible(false);
      const glass = this.add.image(def.glass.x, def.glass.y, 'glass_level_0').setOrigin(0).setDepth(8).setVisible(false);
      const zzz = this.add.image(def.x + 14, def.y - 6, 'fx_zzz').setOrigin(0).setDepth(9).setVisible(false);
      this.tweens.add({ targets: zzz, y: def.y - 10, alpha: { from: 1, to: 0.3 }, duration: 1600, repeat: -1, ease: 'Stepped', easeParams: [4] });
      const hit = this.add.zone(def.x - 2, def.y - 2, FRAME_W + 4, FRAME_H + 4).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(20);
      hit.on('pointerup', () => this.hooks.onSeatTap(i, this.seats[i].memberId));
      this.seats.push({ chair, char, bottle, glass, zzz, texKey: '', memberId: null, online: false, busyUntil: 0 });
    });
    this.sparkles = this.add.group();
    this.ready = true;
    if (this.pending) this.render(this.pending.s, this.pending.me);
    this.hooks.onReady();
  }

  /** 캐릭터 + 색상 변형 텍스처 (머리·옷 키 색을 바꿔 끼움) */
  private charTexture(charId: number, side: boolean, variant: number) {
    const key = `c${charId}_${side ? 's' : 'f'}_${variant}`;
    if (this.textures.exists(key)) return key;
    const base = this.textures.get(`char_${String(charId).padStart(2, '0')}_${side ? 'side' : 'front'}`).getSourceImage() as HTMLImageElement;
    const cv = document.createElement('canvas'); cv.width = base.width; cv.height = base.height;
    const cx = cv.getContext('2d')!; cx.drawImage(base, 0, 0);
    const img = cx.getImageData(0, 0, cv.width, cv.height);
    const map = new Map<number, number[]>();
    const hair = HAIR_RAMPS[variant % HAIR_RAMPS.length], shirt = SHIRT_RAMPS[Math.floor(variant / HAIR_RAMPS.length) % SHIRT_RAMPS.length];
    HAIR_RAMPS[0].forEach((c, i) => { const [r, g, b] = hexRgb(c); map.set((r << 16) | (g << 8) | b, hexRgb(hair[i])); });
    SHIRT_RAMPS[0].forEach((c, i) => { const [r, g, b] = hexRgb(c); map.set((r << 16) | (g << 8) | b, hexRgb(shirt[i])); });
    const d = img.data;
    for (let p = 0; p < d.length; p += 4) {
      if (!d[p + 3]) continue;
      const to = map.get((d[p] << 16) | (d[p + 1] << 8) | d[p + 2]);
      if (to) { d[p] = to[0]; d[p + 1] = to[1]; d[p + 2] = to[2]; }
    }
    cx.putImageData(img, 0, 0);
    const tex = this.textures.addCanvas(key, cv)!;
    for (let i = 0; i < 24; i++) tex.add(i, 0, (i % 4) * FRAME_W, Math.floor(i / 4) * FRAME_H, FRAME_W, FRAME_H);
    for (const [name, a] of Object.entries(ANIM)) {
      this.anims.create({
        key: `${key}:${name}`, frameRate: a.fps, repeat: name === 'idle' || name === 'sleep' ? -1 : 0,
        frames: Array.from({ length: a.frames }, (_, f) => ({ key, frame: a.row * 4 + f })),
      });
    }
    return key;
  }

  /** 전체 상태를 장면에 반영 */
  render(s: BarState, me: string) {
    if (!this.ready) { this.pending = { s, me }; return; }
    SEATS.forEach((def, i) => {
      const v = this.seats[i];
      const m: Member | undefined = s.seats[i] ? s.members[s.seats[i]!] : undefined;
      v.memberId = m?.id ?? null;
      if (!m) {
        v.char.setVisible(false); v.bottle.setVisible(false); v.glass.setVisible(false); v.zzz.setVisible(false); v.texKey = '';
        return;
      }
      const key = this.charTexture(m.charId, def.facing !== 'front', m.variant);
      const wasOnline = v.online;
      v.online = m.online;
      v.char.setVisible(true).setFlipX(def.facing === 'left');
      if (v.texKey !== key || wasOnline !== m.online) { v.texKey = key; v.busyUntil = 0; this.idle(i); }
      v.zzz.setVisible(!m.online);
      v.bottle.setVisible(m.whisky > 0);
      if (m.whisky) v.bottle.setTexture(`bottle_${String(m.whisky).padStart(2, '0')}`);
      v.glass.setVisible(m.whisky > 0 && this.time.now >= v.busyUntil).setTexture(`glass_level_${m.level}`);
    });
    this.jukebox.anims.isPlaying !== (s.music.pausedAt === null) &&
      (s.music.pausedAt === null ? this.jukebox.play('juke') : this.jukebox.stop());
  }

  private seatOf(memberId: string) { return this.seats.findIndex(v => v.memberId === memberId); }

  private idle(i: number) {
    const v = this.seats[i];
    if (!v.texKey) return;
    v.char.play(`${v.texKey}:${v.online ? 'idle' : 'sleep'}`, true);
    if (v.memberId) v.glass.setVisible(v.bottle.visible);
  }

  private once(i: number, anim: AnimName, repeat = 0, holdGlass = false) {
    const v = this.seats[i];
    if (i < 0 || !v.texKey) return;
    const a = ANIM[anim];
    const ms = (a.frames / a.fps) * 1000 * (repeat + 1);
    v.busyUntil = this.time.now + ms;
    if (holdGlass) v.glass.setVisible(false);
    v.char.play({ key: `${v.texKey}:${anim}`, repeat });
    v.char.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.idle(i));
  }

  private sparkle(i: number) {
    const d = SEATS[i];
    const s = this.add.image(d.x + 12, d.y - 4, 'fx_sparkle').setDepth(10);
    this.tweens.add({ targets: s, y: d.y - 14, scale: { from: 0.5, to: 1 }, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Stepped', easeParams: [6], onComplete: () => s.destroy() });
  }

  private note() {
    const s = this.add.image(this.jukebox.x + 12, this.jukebox.y - 2, 'fx_note').setDepth(10);
    this.tweens.add({ targets: s, y: s.y - 18, x: s.x + Phaser.Math.Between(-8, 8), alpha: { from: 1, to: 0 }, duration: 1500, ease: 'Stepped', easeParams: [6], onComplete: () => s.destroy() });
  }

  ambient(playing: boolean) { if (playing && Math.random() < 0.5) this.note(); }

  event(e: BarEvent) {
    if (!this.ready) return;
    switch (e.type) {
      case 'say': { const i = this.seatOf(e.memberId); if (i >= 0 && this.time.now >= this.seats[i].busyUntil) this.once(i, 'talk', 2); break; }
      case 'sip': this.once(this.seatOf(e.memberId), 'sip', 0, true); break;
      case 'wave': this.once(this.seatOf(e.memberId), 'wave', 1); break;
      case 'enter': { const i = this.seatOf(e.memberId); if (i >= 0) this.time.delayedCall(100, () => this.once(i, 'wave', 1)); break; }
      case 'toastResult':
        for (const id of e.participants) {
          const i = this.seatOf(id);
          if (i < 0) continue;
          this.once(i, 'cheers', 0, true);
          // 마지막 프레임(잔을 높이 든 모습)에서 잠깐 멈춤
          this.time.delayedCall(450, () => { this.seats[i].char.anims.pause(); this.sparkle(i); });
          this.time.delayedCall(1600, () => { this.seats[i].char.anims.resume(); });
        }
        break;
      case 'pour': { const i = this.seatOf(e.memberId); if (i >= 0) this.tweens.add({ targets: this.seats[i].glass, y: { from: SEATS[i].glass.y - 2, to: SEATS[i].glass.y }, duration: 240, ease: 'Bounce' }); break; }
    }
  }
}

export function createGame(parent: HTMLElement, hooks: SceneHooks) {
  const scene = new BarScene();
  scene.hooks = hooks;
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: SCENE_W, height: SCENE_H, pixelArt: true, roundPixels: true,
    backgroundColor: '#1f2e2a', banner: false, audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
    scene,
  });
  return { game, scene };
}
