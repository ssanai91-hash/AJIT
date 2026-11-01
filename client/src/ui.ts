// 화면 아래쪽(DOM): 이름표·말풍선, 행동 버튼, 채팅, 시트들
import { TRACKS, WHISKIES } from '../../shared/catalog';
import { GLASS_MAX, type BarEvent, type BarState, type ChatLine } from '../../shared/core';
import { SCENE_H, SCENE_W, SEATS } from '../../shared/layout';
import { ASSET, createGame, type BarScene } from './game';
import { Jukebox } from './music';
import type { Transport } from './transport';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const hhmm = (t: number) => new Date(t).toTimeString().slice(0, 5);
const ago = (t: number) => {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`;
};

export class App {
  s!: BarState;
  scene!: BarScene;
  game!: Phaser.Game;
  juke = new Jukebox();
  private k = 1;                       // 장면 1픽셀 = CSS k픽셀
  private renderedChat = 0;
  private bubbles = new Map<string, HTMLElement>();
  private sheetKind = '';
  private sheetArg: unknown = null;

  constructor(private t: Transport, private demo: boolean) {}

  start() {
    const { game, scene } = createGame($('game'), {
      onReady: () => this.layout(),
      onSeatTap: (seat, id) => this.onSeat(seat, id),
      onBottleTap: (w) => this.openSheet('whisky', w),
      onJukeboxTap: () => this.openSheet('music'),
    });
    this.game = game; this.scene = scene;
    $('demoBadge').hidden = !this.demo;
    this.icons();
    this.bind();
    this.t.onState(s => this.onState(s));
    this.t.onEvent(e => this.onEvent(e));
    this.t.onClosed(why => this.flash(why, 6000));
    addEventListener('resize', () => this.layout());
    setInterval(() => this.tickToast(), 200);
    setInterval(() => this.scene.ambient(!!this.s && this.s.music.pausedAt === null && this.juke.enabled), 2200);
    this.layout();
  }

  // ── 크기: 정수배 확대 ─────────────────────────────
  layout() {
    const app = $('app');
    const dpr = window.devicePixelRatio || 1;
    const W = app.clientWidth, H = app.clientHeight;
    let s = Math.max(1, Math.floor((W * dpr) / SCENE_W));
    while (s > 1 && (SCENE_H * s) / dpr > H * 0.5) s--;      // 채팅 자리 확보
    const cssW = (SCENE_W * s) / dpr, cssH = (SCENE_H * s) / dpr;
    const stage = $('stage'), g = $('game');
    stage.style.width = g.style.width = `${cssW}px`;
    stage.style.height = g.style.height = `${cssH}px`;
    this.k = cssW / SCENE_W;
    this.game?.scale.refresh();
    if (this.s) this.renderTags();
  }

  private icons() {
    const set = (cls: string, url: string, size: string, pos = 'center') => {
      document.querySelectorAll<HTMLElement>(`.${cls}`).forEach(el => {
        el.style.backgroundImage = `url(${url})`; el.style.backgroundSize = size; el.style.backgroundPosition = pos;
      });
    };
    set('ico-bottle', ASSET.bottle_01, '10px 20px');
    set('ico-pour', ASSET.glass_level_4, '16px 16px');
    set('ico-sip', ASSET.glass_level_2, '16px 16px');
    set('ico-toast', ASSET.fx_sparkle, '20px 20px');
    set('ico-wave', ASSET.char_01_front, '60px 120px', '-30px -100px');
    document.querySelector<HTMLElement>('.ico-wave')!.style.width = '15px';
  }

  // ── 상태 ────────────────────────────────────────
  private onState(s: BarState) {
    const first = !this.s;
    this.s = s;
    this.scene.render(s, this.t.me);
    $('barName').textContent = s.name;
    const all = Object.values(s.members);
    $('onlineCount').textContent = `${all.filter(m => m.online).length}/${all.length}명 접속`;
    document.title = `${s.name} · 아지트`;
    this.renderTags();
    this.renderChat(first);
    this.renderActions();
    this.renderMusic();
    const sh = $('sheet');
    const busy = (sh.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT') || !!document.getElementById('linkOut')?.childElementCount;
    if (!sh.hidden && !busy && ['music', 'member', 'menu'].includes(this.sheetKind)) this.openSheet(this.sheetKind, this.sheetArg, true);
  }

  private get me() { return this.s?.members[this.t.me]; }

  private renderTags() {
    const ov = $('overlay');
    const s = this.s; const k = this.k;
    const seen = new Set<string>();
    s.seats.forEach((id, i) => {
      if (!id) return;
      const m = s.members[id]; const d = SEATS[i];
      seen.add(id);
      let tag = ov.querySelector<HTMLElement>(`.tag[data-id="${id}"]`);
      if (!tag) { tag = document.createElement('div'); tag.className = 'tag'; tag.dataset.id = id; ov.append(tag); }
      tag.textContent = m.nick;
      tag.classList.toggle('me', id === this.t.me);
      tag.classList.toggle('away', !m.online);
      tag.classList.toggle('owner', id === s.ownerId);
      const headTop = d.facing === 'front' ? d.y + 1 : d.y + 1;
      tag.style.left = `${(d.x + 12) * k}px`; tag.style.top = `${headTop * k}px`;
      const b = this.bubbles.get(id);
      if (b) { b.style.left = tag.style.left; b.style.top = `${headTop * k - 16}px`; }
    });
    ov.querySelectorAll<HTMLElement>('.tag').forEach(t => { if (!seen.has(t.dataset.id!)) t.remove(); });
  }

  private bubble(memberId: string, text: string) {
    const i = this.s.seats.indexOf(memberId);
    if (i < 0) return;
    this.bubbles.get(memberId)?.remove();
    const b = document.createElement('div');
    b.className = 'bubble'; b.textContent = text;
    $('overlay').append(b);
    this.bubbles.set(memberId, b);
    this.renderTags();
    const life = Math.min(9000, 3500 + text.length * 120);
    setTimeout(() => b.classList.add('fade'), life);
    setTimeout(() => { b.remove(); if (this.bubbles.get(memberId) === b) this.bubbles.delete(memberId); }, life + 450);
  }

  private renderChat(first: boolean) {
    const box = $('chat');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    const fresh = this.s.chat.filter(l => l.id > this.renderedChat);
    for (const l of fresh) box.append(this.chatLine(l));
    if (fresh.length) this.renderedChat = fresh.at(-1)!.id;
    while (box.children.length > 120) box.firstElementChild!.remove();
    if (first || atBottom || fresh.some(l => l.memberId === this.t.me)) box.scrollTop = box.scrollHeight;
  }

  private chatLine(l: ChatLine) {
    const el = document.createElement('div');
    if (l.system) { el.className = 'line sys'; el.innerHTML = `<span class="txt">${esc(l.text)}</span>`; return el; }
    el.className = 'line' + (l.memberId === this.t.me ? ' mine' : '');
    el.innerHTML = `<span class="who">${esc(l.nick)}</span><span class="txt">${esc(l.text)}</span><span class="at">${hhmm(l.at)}</span>`;
    return el;
  }

  private renderActions() {
    const m = this.me; if (!m) return;
    const q = (a: string) => document.querySelector<HTMLButtonElement>(`[data-act="${a}"]`)!;
    q('pour').disabled = !m.whisky || m.level >= GLASS_MAX;
    q('sip').disabled = m.level < 1;
  }

  private renderMusic() {
    const tr = TRACKS.find(t => t.id === this.s.music.trackId)!;
    const playing = this.s.music.pausedAt === null;
    $('musicTitle').textContent = !this.juke.enabled ? '소리 켜기' : playing ? tr.title : `${tr.title} (멈춤)`;
    $('musicChip').classList.toggle('playing', playing && this.juke.enabled);
    $('musicChip').classList.toggle('muted', !this.juke.enabled);
    this.juke.update(this.s.music, () => this.t.serverNow());
  }

  // ── 순간 연출 ────────────────────────────────────
  private onEvent(e: BarEvent) {
    this.scene.event(e);
    const nick = (id: string) => this.s?.members[id]?.nick ?? '친구';
    switch (e.type) {
      case 'say': this.bubble(e.memberId, e.text); break;
      case 'toastResult':
        if (!e.solo) this.juke.clink();
        else if (e.participants[0] === this.t.me) this.flash('아무도 안 와서 혼자 잔을 들었어요');
        if (!e.solo && e.participants.includes(this.t.me)) this.flash('🥃 오늘도 수고했다!');
        break;
      case 'pour': if (e.memberId === this.t.me) this.juke.pour(); break;
      case 'toastStart': if (e.by !== this.t.me) this.juke.blip(); break;
      case 'kicked': if (e.memberId === this.t.me) this.flash('방장이 바에서 내보냈어요', 8000); break;
      case 'enter': if (e.memberId !== this.t.me && !e.first) this.juke.blip(); void nick; break;
    }
  }

  private tickToast() {
    const tb = $('toastBanner');
    const toast = this.s?.toast;
    if (!toast) { tb.hidden = true; return; }
    const left = Math.max(0, Math.ceil((toast.deadline - this.t.serverNow()) / 1000));
    const mine = toast.by === this.t.me;
    const joined = toast.participants.includes(this.t.me);
    const n = toast.participants.length;
    $('toastText').textContent = mine
      ? `건배 제안! 함께 드는 중 ${n}명 · ${left}`
      : `${this.s.members[toast.by]?.nick ?? '친구'}님이 건배를 제안했어요 · ${left}`;
    const btn = $<HTMLButtonElement>('toastJoin');
    btn.hidden = mine; btn.disabled = joined; btn.textContent = joined ? '잔 들었음' : '참여하기';
    tb.hidden = false;
  }

  // ── 입력 ────────────────────────────────────────
  private async act(a: Parameters<Transport['act']>[0]) {
    const r = await this.t.act(a);
    if ('error' in r) this.flash(r.error);
    return 'ok' in r;
  }

  private bind() {
    $('composer').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const inp = $<HTMLInputElement>('chatInput');
      const text = inp.value.trim(); if (!text) return;
      if (await this.act({ t: 'chat', text })) inp.value = '';
    });
    $('actions').addEventListener('click', (ev) => {
      const a = (ev.target as HTMLElement).closest('button')?.dataset.act;
      if (a === 'whisky') this.openSheet('whisky', this.me?.whisky || null);
      if (a === 'pour') this.act({ t: 'pour' });
      if (a === 'sip') this.act({ t: 'sip' });
      if (a === 'toast') this.act({ t: 'toastPropose' });
      if (a === 'wave') this.act({ t: 'wave' });
    });
    $('toastJoin').addEventListener('click', () => this.act({ t: 'toastJoin' }));
    $('musicChip').addEventListener('click', async () => {
      if (!this.juke.enabled) { await this.juke.enable(); this.renderMusic(); this.flash('소리를 켰어요 · 다들 같은 구간을 듣고 있어요'); }
      else this.openSheet('music');
    });
    $('menuBtn').addEventListener('click', () => this.openSheet('menu'));
    $('sheetBackdrop').addEventListener('click', () => this.closeSheet());
    $('sheet').addEventListener('click', (ev) => this.onSheetClick(ev));
  }

  private onSeat(seat: number, id: string | null) {
    if (!id) { this.act({ t: 'sit', seat }).then(ok => ok && this.flash('자리를 옮겼어요')); return; }
    this.openSheet('member', id);
  }

  flash(msg: string, ms = 2200) {
    const f = $('flash'); f.textContent = msg; f.hidden = false;
    clearTimeout((f as any)._t); (f as any)._t = setTimeout(() => { f.hidden = true; }, ms);
  }

  // ── 시트 ────────────────────────────────────────
  private closeSheet() { $('sheet').hidden = true; $('sheetBackdrop').hidden = true; this.sheetKind = ''; }

  private portrait(charId: number, variant: number, scale = 2) {
    // 정면 대기 첫 프레임을 변형 색으로: 장면에서 만든 텍스처를 빌려 쓴다
    const key = `c${charId}_f_${variant}`;
    const src = this.scene.textures.exists(key) ? (this.scene.textures.get(key).getSourceImage() as HTMLCanvasElement).toDataURL() : ASSET[`char_${String(charId).padStart(2, '0')}_front`];
    return `<div class="portrait" style="background-image:url(${src});background-size:${96 * scale}px ${192 * scale}px;width:${24 * scale}px;height:${32 * scale}px"></div>`;
  }

  openSheet(kind: string, arg: unknown = null, refresh = false) {
    const sh = $('sheet');
    const s = this.s; const me = this.me;
    if (!s || !me) return;
    this.sheetKind = kind; this.sheetArg = arg;
    const isOwner = s.ownerId === this.t.me;
    let html = `<button class="close" type="button" data-x="close" aria-label="닫기">✕</button>`;
    if (kind === 'whisky') {
      const sel = (arg as number) || me.whisky || 0;
      const w = WHISKIES.find(x => x.id === sel);
      html += `<h2>술장</h2><p class="sub">고른 병과 잔이 내 자리에 놓이고 친구들에게도 보여요.</p><div class="whisky-grid">` +
        WHISKIES.map(x => `<button type="button" class="whisky${x.id === sel ? ' on' : ''}" data-w="${x.id}">
          <img src="${ASSET[`bottle_${String(x.id).padStart(2, '0')}`]}" alt=""><b>${esc(x.name)}</b><small>${esc(x.kind)}</small></button>`).join('') +
        `</div><div class="whisky-note">${w ? `<b style="color:var(--amber-hi);font-weight:normal">${esc(w.name)}</b> · ${esc(w.note)}` : '병을 눌러 설명을 보세요.'}</div>
        <div class="row"><button class="btn primary" type="button" data-x="pickpour" ${w ? '' : 'disabled'}>이 술로 따르기</button>
        ${me.whisky && me.whisky !== sel ? '' : ''}</div>`;
    } else if (kind === 'music') {
      const mu = s.music; const cur = TRACKS.find(t => t.id === mu.trackId)!;
      html += `<h2>주크박스</h2><p class="sub">지금 「${esc(cur.title)}」 ${mu.pausedAt === null ? '재생 중' : '멈춤'} · 늦게 와도 같은 구간부터 들어요.${isOwner ? '' : ' 재생·멈춤은 방장만 할 수 있어요.'}</p>
        <div class="list">` + TRACKS.map(t => `<div class="item${t.id === mu.trackId ? ' on' : ''}"><span class="grow">${esc(t.title)}</span>
          <button class="btn" type="button" data-req="${t.id}">신청</button></div>`).join('') + `</div>` +
        (mu.queue.length ? `<p class="sub" style="margin-top:10px">신청곡: ${mu.queue.map(q => `${esc(TRACKS.find(t => t.id === q.trackId)!.title)}(${esc(s.members[q.by]?.nick ?? '')})`).join(' → ')}</p>` : '') +
        `<div class="row">${isOwner ? `<button class="btn primary" type="button" data-x="${mu.pausedAt === null ? 'pause' : 'play'}">${mu.pausedAt === null ? '멈춤' : '재생'}</button>
          <button class="btn" type="button" data-x="next">다음 곡</button>` : ''}
          <button class="btn" type="button" data-x="${this.juke.enabled ? 'mute' : 'unmute'}">${this.juke.enabled ? '내 소리 끄기' : '소리 켜기'}</button></div>
        <label class="sub" style="display:flex;gap:10px;align-items:center;margin-top:12px">내 음량<input id="vol" type="range" min="0" max="1" step="0.05" value="${this.juke.volume}" style="flex:1"></label>`;
    } else if (kind === 'member') {
      const m = s.members[arg as string];
      if (!m) return this.closeSheet();
      const mine = m.id === this.t.me;
      const w = WHISKIES.find(x => x.id === m.whisky);
      html += `<div style="display:flex;gap:14px;align-items:center">${this.portrait(m.charId, m.variant)}
        <div><h2>${esc(m.nick)}${m.id === s.ownerId ? ' <small style="color:var(--amber)">방장</small>' : ''}</h2>
        <p class="sub" style="margin:0">${m.online ? '바에 있어요' : `졸고 있어요 · 마지막 접속 ${ago(m.lastSeen)}`}<br>
        ${w ? `${esc(w.name)} · 잔 ${m.level}/${GLASS_MAX}` : '아직 술을 고르지 않았어요'}
        ${m.lastSay ? `<br>마지막 한마디: “${esc(m.lastSay)}”` : ''}</p></div></div>
        <div class="row">${mine ? `<button class="btn primary" type="button" data-x="reroll">캐릭터 다시 뽑기</button>` : ''}
        ${isOwner && !mine ? `<button class="btn" type="button" data-x="rejoin">재입장 링크 만들기</button><button class="btn danger" type="button" data-x="kick">내보내기</button>` : ''}</div>
        <div id="linkOut"></div>`;
    } else if (kind === 'menu') {
      const members = Object.values(s.members);
      html += `<h2>${esc(s.name)}</h2><p class="sub">고정 멤버 ${members.length}/8명 · 접속하지 않은 친구는 자리에서 졸고 있어요.</p>
        <div class="list">` + members.map(m => `<button type="button" class="item" data-member="${m.id}" style="text-align:left">
          ${this.portrait(m.charId, m.variant, 1)}<span class="grow">${esc(m.nick)}${m.id === this.t.me ? ' (나)' : ''}</span>
          <small>${m.online ? '접속 중' : ago(m.lastSeen)}</small></button>`).join('') + `</div>
        <div class="row"><button class="btn primary" type="button" data-x="invite">친구 초대 링크</button>
        ${isOwner ? `<button class="btn" type="button" data-x="rename">바 이름 바꾸기</button>` : ''}</div>
        <div id="linkOut"></div>
        <p class="sub" style="margin-top:16px">글꼴: 갈무리 (OFL) · 그림: 임시 도트 v0.1</p>`;
    }
    sh.innerHTML = html;
    sh.hidden = false; $('sheetBackdrop').hidden = false;
    if (!refresh) sh.scrollTop = 0;
    $<HTMLInputElement>('vol')?.addEventListener('input', (e) => this.juke.setVolume(+(e.target as HTMLInputElement).value));
  }

  private async onSheetClick(ev: Event) {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-x],[data-w],[data-req],[data-member]');
    if (!el) return;
    const x = el.dataset.x;
    if (el.dataset.w) return this.openSheet('whisky', +el.dataset.w);
    if (el.dataset.req) { if (await this.act({ t: 'musicRequest', trackId: +el.dataset.req })) this.flash('신청했어요'); return; }
    if (el.dataset.member) return this.openSheet('member', el.dataset.member);
    switch (x) {
      case 'close': return this.closeSheet();
      case 'pickpour': {
        const w = this.sheetArg as number;
        if (await this.act({ t: 'pick', whisky: w })) { if (this.me!.level < GLASS_MAX) await this.act({ t: 'pour' }); this.closeSheet(); }
        return;
      }
      case 'play': case 'pause': case 'next': await this.act({ t: 'musicControl', cmd: x }); return;
      case 'mute': this.juke.mute(); this.renderMusic(); return this.openSheet('music', null, true);
      case 'unmute': await this.juke.enable(); this.renderMusic(); return this.openSheet('music', null, true);
      case 'reroll': await this.act({ t: 'reroll' }); return;
      case 'kick': {
        if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = '정말 내보낼까요? 한 번 더 누르세요'; return; }
        if (await this.act({ t: 'kick', memberId: this.sheetArg as string })) this.closeSheet();
        return;
      }
      case 'invite': case 'rejoin': {
        const url = x === 'invite' ? await this.t.inviteUrl() : await this.t.rejoinUrl(this.sheetArg as string);
        const out = $('linkOut');
        if (!url) { out.innerHTML = `<p class="sub" style="margin-top:10px">체험판에서는 링크를 만들 수 없어요. 서버를 올리면 이 버튼으로 초대 링크가 나와요.</p>`; return; }
        out.innerHTML = `<div class="copybox"><input id="linkBox" readonly value="${esc(url)}"><button class="btn" type="button" data-x="copy">복사</button></div>`;
        return;
      }
      case 'copy': {
        const inp = $<HTMLInputElement>('linkBox');
        try { await navigator.clipboard.writeText(inp.value); this.flash('링크를 복사했어요'); }
        catch { inp.select(); this.flash('길게 눌러 복사해 주세요'); }
        return;
      }
      case 'rename': {
        const out = $('linkOut');
        out.innerHTML = `<form class="copybox" id="renameForm"><input id="renameBox" maxlength="20" value="${esc(this.s.name)}"><button class="btn" type="submit">저장</button></form>`;
        $('renameForm').addEventListener('submit', async (e) => { e.preventDefault(); if (await this.act({ t: 'rename', name: $<HTMLInputElement>('renameBox').value })) this.flash('바 이름을 바꿨어요'); });
        return;
      }
    }
  }
}
