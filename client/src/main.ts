import './style.css';
import { startBots } from './bots';
import { connectNet, LocalTransport, savedToken, type Transport } from './transport';
import { App } from './ui';

declare const __DEMO__: boolean;

const entry = document.getElementById('entry')!;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function showEntry(html: string, onSubmit: (f: HTMLFormElement) => Promise<void>) {
  entry.innerHTML = html;
  entry.hidden = false;
  const form = entry.querySelector('form')!;
  const err = entry.querySelector<HTMLElement>('.err')!;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button')!; btn.disabled = true; err.textContent = '';
    try { await onSubmit(form); entry.hidden = true; }
    catch (x: any) { err.textContent = x?.message ?? '들어가지 못했어요. 잠시 후 다시 해 주세요'; btn.disabled = false; }
  });
}

function run(t: Transport, demo: boolean) { new App(t, demo).start(); }

async function boot() {
  await document.fonts.load('14px Galmuri11').catch(() => {});

  if (__DEMO__) {
    showEntry(`
      <h1>숭열이네 위스키 바</h1>
      <p>단골 친구들이 늘 앉아 있는 우리만의 바.<br>체험판에서는 가상 친구 여섯 명이 먼저 와 있어요.</p>
      <form><label for="nick">내 닉네임<input id="nick" name="nick" maxlength="10" value="숭열" required></label>
      <button class="btn primary" type="submit">바에 들어가기</button><div class="err"></div></form>`,
      async (f) => {
        const nick = (f.elements.namedItem('nick') as HTMLInputElement).value.trim() || '나';
        const t = new LocalTransport('숭열이네 바');
        const me = t.joinAs(nick);
        t.me = me;
        startBots(t, me);
        run(t, true);
        t.flush();
      });
    return;
  }

  const q = new URLSearchParams(location.search);
  const code = q.get('r');
  const memberToken = q.get('m') ?? (code ? savedToken(code) : null);

  // 1) 이미 멤버: 바로 입장
  if (code && memberToken) {
    try {
      const t = await connectNet({ code, memberToken });
      history.replaceState(null, '', `?r=${code}`);
      return run(t, false);
    } catch { /* 토큰 만료·추방 → 초대 링크로 다시 */ }
  }
  // 2) 초대 링크로 처음 온 친구
  const invite = q.get('i');
  if (code && invite) {
    const info = await fetch(`/api/rooms/${code}`).then(r => r.ok ? r.json() : null).catch(() => null);
    showEntry(`
      <h1>${esc(info?.name ?? '우리 바')}</h1>
      <p>친구가 바에 초대했어요. 회원가입 없이 닉네임만 정하면 자리가 생겨요.${info ? `<br>지금 멤버 ${info.members}/8명` : ''}</p>
      <form><label for="nick">내 닉네임<input id="nick" name="nick" maxlength="10" required></label>
      <button class="btn primary" type="submit">바에 들어가기</button><div class="err"></div></form>`,
      async (f) => {
        const nick = (f.elements.namedItem('nick') as HTMLInputElement).value;
        const t = await connectNet({ code, inviteToken: invite, nick });
        history.replaceState(null, '', `?r=${code}`);
        run(t, false);
      });
    return;
  }
  // 3) 방장: 새 바 만들기
  showEntry(`
    <h1>우리만의 바 만들기</h1>
    <p>바를 만들고 초대 링크를 친구들에게 보내세요. 최대 8명이 고정 멤버가 돼요.</p>
    <form><label for="barname">바 이름<input id="barname" name="barname" maxlength="20" placeholder="숭열이네 바" required></label>
    <label for="nick">내 닉네임<input id="nick" name="nick" maxlength="10" required></label>
    <button class="btn primary" type="submit">바 열기</button><div class="err"></div></form>`,
    async (f) => {
      const name = (f.elements.namedItem('barname') as HTMLInputElement).value;
      const nick = (f.elements.namedItem('nick') as HTMLInputElement).value;
      const r = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }).then(r => r.json());
      const t = await connectNet({ code: r.code, inviteToken: r.inviteToken, nick });
      history.replaceState(null, '', `?r=${r.code}`);
      run(t, false);
    });
}

boot();
