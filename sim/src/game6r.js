// =====================================================================
//  조종사 로그인 · 점수 · 랭킹 (서버: server/worker.js · Cloudflare Worker + D1)
//  공개판에만 서버 주소(window.SIM_API, build.py)가 들어감 · 없으면 로그인·랭킹은 숨기고 예전처럼 이름만 입력
//  아이디 = 조종사 이름 (같은 이름은 한 명만 · 띄어쓰기·대소문자 무시) · 비밀번호 = 숫자 4자리 (개인 번호 쓰지 않게 안내)
//  코스·임무를 끝내면 점수(0~100)가 그 코스의 랭킹에 올라감 · 사람마다 코스별 최고 점수 하나 (같으면 짧은 시간)
//  시험: index.html?test&api=http://localhost:8790&login  (node server/dev.mjs)
// =====================================================================
// ---- 이름 검사 (서버와 같은 규칙: server/worker.js) ----
const NM_BAD_KO = ['시발', '씨발', '씨바', '시바', '씨빨', '시빨', '쉬발', '쓰발', '씌발', '싸발', '좆', '좃', '씹', '존나', '졸라', '병신', '븅신', '빙신', '등신', '지랄', '염병', '옘병', '개새', '개색', '개섹', '개세', '새끼', '섀끼', '쌔끼', '새기', '미친놈', '미친년', '미친새', '닥쳐', '꺼져', '엠창', '애미', '니미', '느금', '니엄마', '니애미', '창녀', '걸레년', '보지', '자지', '섹스', '쎅스', '성교', '강간', '자위', '딸딸이', '야동', '쌍놈', '쌍년', '호로', '후장', '틀딱', '한남충', '김치녀', '된장녀', '맘충', '급식충', '메갈', '일베', '홍어', '짱깨', '쪽바리', '깜둥', '나치', '히틀러', '자살', '살인', '테러', '마약', '필로폰', '대마초', '도박'];
const NM_BAD_EN = ['fuck', 'fuk', 'fck', 'phuck', 'shit', 'bitch', 'bastard', 'asshole', 'dickhead', 'cunt', 'pussy', 'porn', 'rape', 'nigg', 'faggot', 'fagot', 'retard', 'slut', 'whore', 'nazi', 'hitler', 'cocksuck', 'motherf', 'jerkoff', 'wank', 'penis', 'vagina', 'boob', 'suicide', 'terror'];
const NM_RES = ['admin', 'administrator', 'root', 'system', 'moderator', 'operator', 'staff', 'official', 'control', 'guest', 'null', 'undefined', 'test', '관리자', '운영자', '운영진', '시스템', '공식', '손님', '게스트', '컨트롤', '관제'];
function nmNorm(s) { return String(s || '').normalize('NFKC').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim(); }
function nmKey(s) { return nmNorm(s).toLowerCase().replace(/[\s_\-.]/g, ''); }
function nmBadWord(name) {
  const ko = name.replace(/[^가-힣]/g, ''), en2 = name.toLowerCase().replace(/[^a-z]/g, '');
  const en = name.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
  return NM_BAD_KO.some(w => ko.includes(w)) || NM_BAD_EN.some(w => en.includes(w.replace(/(.)\1+/g, '$1')) || en2.includes(w));
}
function nmCheck(raw) {
  const name = nmNorm(raw), n = [...name].length;
  if (n < 2 || n > 12) return { ok: false, err: 'len' };
  if (!/^[가-힣a-zA-Z0-9 _\-]+$/.test(name) || /^[0-9 _\-]+$/.test(name)) return { ok: false, err: 'chars' };
  if (nmBadWord(name)) return { ok: false, err: 'word' };
  const k = nmKey(name); if (NM_RES.some(w => /[가-힣]/.test(w) ? k.includes(w) : k === w || k.startsWith(w) && w.length >= 4)) return { ok: false, err: 'reserved' };
  return { ok: true, name, key: k };
}
// 손님 이름(이 기기에만 쓰는 표시 이름)도 욕설·비하 단어는 막음 → 문제 있으면 안내 문구, 없으면 ''
function pilotNameBad(v) { v = nmNorm(v); return v && nmBadWord(v) ? L2('쓸 수 없는 단어가 들어 있습니다 · 다른 이름을 지어 주세요', 'That name contains a word that is not allowed · choose another') : ''; }
function rkErr(r) {
  const e = r && r.err;
  return ({
    len: L2('이름은 2~12자로 지어 주세요', 'Use 2–12 characters'),
    chars: L2('한글·영문·숫자·띄어쓰기·_ - 만 쓸 수 있습니다 (숫자만은 안 됨)', 'Letters, digits, spaces, _ and - only (not digits only)'),
    word: L2('쓸 수 없는 단어가 들어 있습니다', 'Contains a word that is not allowed'),
    reserved: L2('운영자·시스템처럼 보이는 이름은 쓸 수 없습니다', 'Names that look official are not allowed'),
    taken: L2('이미 있는 이름입니다 · 다른 이름을 지어 주세요', 'That name is taken · choose another'),
    pin: L2('비밀번호는 숫자 4자리입니다', 'The PIN is 4 digits'),
    pin2: L2('비밀번호 확인이 다릅니다', 'The two PINs do not match'),
    no_user: L2('등록되지 않은 이름입니다 · 처음이면 “새 조종사 등록”', 'No pilot with that name · new here? Register'),
    wrong: L2(`비밀번호가 맞지 않습니다 · 남은 기회 ${r && r.left} 번`, `Wrong PIN · ${r && r.left} tries left`),
    locked: L2(`여러 번 틀려 잠시 잠겼습니다 · ${Math.max(1, Math.ceil(((r && r.wait) || 600) / 60))}분 뒤 다시`, `Too many tries · locked for ${Math.max(1, Math.ceil(((r && r.wait) || 600) / 60))} min`),
    token: L2('로그인이 만료되었습니다 · 다시 로그인해 주세요', 'Your login expired · please log in again'),
    net: L2('랭킹 서버에 연결하지 못했습니다 · 잠시 뒤 다시', 'Could not reach the ranking server · try again later'),
  })[e] || L2('서버 오류 · 잠시 뒤 다시', 'Server error · try again later');
}
const rkEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---- 상태 · 서버 ----
const RK = { api: '', acct: null, busy: false, last: null, me: null, meAt: 0, board: null, seq: 0, test: /[?&]test/.test(location.search) };
{
  let api = window.SIM_API || '';
  if (RK.test) { const m = location.search.match(/[?&]api=([^&]+)/), u = m ? decodeURIComponent(m[1]) : ''; api = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u) ? u : ''; }   // 시험 판은 이 컴퓨터의 시험 서버만
  RK.api = String(api).replace(/\/+$/, '');
  try { const a = JSON.parse(localStorage.getItem('fpvsim_acct') || 'null'); if (RK.api && a && a.name && a.token) RK.acct = a; } catch (e) { }
  if (RK.acct) SET.pilot = RK.acct.name;
}
function rkMe() { return RK.guestNow ? null : RK.acct; }   // 지금 쓰는 계정 (게스트로 고르면 이번에는 없음 · 저장된 계정은 그대로)
async function rkCall(path, body) {
  if (!RK.api) return { ok: false, err: 'net' };
  const ctl = typeof AbortController === 'function' ? new AbortController() : null, tm = setTimeout(() => { try { ctl && ctl.abort(); } catch (e) { } }, 10000);
  try {   // text/plain → 미리 묻는 요청(CORS preflight) 없이 바로
    const r = await fetch(RK.api + path, body ? { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body), signal: ctl && ctl.signal } : { signal: ctl && ctl.signal, cache: 'no-store' });
    return await r.json();
  } catch (e) { return { ok: false, err: 'net' }; } finally { clearTimeout(tm); }
}
function acctSet(a) {
  RK.acct = a; RK.me = null; RK.guestNow = false;
  try { if (a) { localStorage.setItem('fpvsim_acct', JSON.stringify(a)); localStorage.setItem('fpvsim_pilot', a.name); } else localStorage.removeItem('fpvsim_acct'); } catch (e) { }
  if (a) { SET.pilot = a.name; const i = $('pilotName'); if (i) i.value = a.name; }
  acctSync();
}
// 랭킹에 올리는 비행: 장애물 코스 · 임무 (튜토리얼·자유 비행·기준 비행·1종 연습 제외) · 공개 현장에서만 (내 DEM 제외)
function rkKindOk(k) { return k === 'course' || (isMission(k) && !(typeof isC1 === 'function' && isC1(k))); }
function rkSiteOk() { return !SITE.flat && (window.SIM_SITES || []).some(s => s.id === SITE.id); }
function rkBoard(k) { return (k + '_' + String(SITE_KEY).toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 20); }   // 현장·코스 배치가 바뀌면 랭킹도 따로
function rkKindOf(board) { return String(board).split('_')[0]; }
function rkKindName(k) { return k === 'course' ? L2('장애물 코스', 'Obstacle course') : MS_NAME[k] || k; }
function rkKinds() { return ['course', 'forest', 'race', 'ridge', 'field', 'recon', 'track', 'fire', 'sar', 'strike'].filter(k => (k === 'course' || MS_NAME[k] !== undefined) && msTile(k)); }

// ---- 로그인 창 ----
let acMode = 'login';
function acctPanel() {
  let el = $('acctPanel'); if (el) return el;
  el = document.createElement('div'); el.id = 'acctPanel'; el.className = 'panel hidden rkp';
  el.innerHTML = `<div class="card acard">
    <h1>PILOT LOGIN</h1><h2>${L2('조종사 로그인 · 코스·임무를 끝내면 점수가 랭킹에 올라갑니다', 'Pilot login · finish a course or mission to post your score')}</h2>
    <div class="atabs"><button data-m="login">${L2('로그인', 'Log in')}</button><button data-m="reg">${L2('새 조종사 등록', 'New pilot')}</button></div>
    <div class="agrid"><div><label class="afld">${L2('조종사 이름', 'Pilot name')} <small>${L2('아이디 · 랭킹에 표시 · 2~12자', 'Your ID · shown on the leaderboard · 2–12 characters')}</small><input id="acName" maxlength="12" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
    <div id="acNm" class="amsg"></div></div>
    <div><label class="afld">${L2('비밀번호', 'PIN')} <small>${L2('숫자 4자리', '4 digits')}</small><input id="acPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="current-password"></label>
    <label class="afld reg">${L2('비밀번호 확인', 'Repeat PIN')}<input id="acPin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password"></label></div></div>
    <p class="awarn">⚠ ${L2('연습용 간단한 비밀번호입니다. 은행·휴대폰·카드 비밀번호처럼 개인적으로 쓰는 번호는 쓰지 마세요.', 'This is a simple practice PIN. Do not use a number you use anywhere else (bank, phone, cards).')}</p>
    <p id="acMsg" class="amsg"></p>
    <div class="btns"><button class="primary" id="acGo"></button><button id="acGuest">${L2('손님으로 계속', 'Continue as guest')}</button></div>
    <p class="note">${L2('같은 이름은 한 사람만 쓸 수 있습니다 (띄어쓰기·대소문자 구분 없음) · 욕설·비하·운영자처럼 보이는 이름은 쓸 수 없습니다 · 이 기기에 로그인 상태가 남습니다 · 손님은 기록이 이 기기에만 남습니다', 'One pilot per name (spaces and case ignored) · no offensive or official-looking names · you stay logged in on this device · guests keep records on this device only')}</p></div>`;
  document.body.appendChild(el);
  const nm = $('acName'), p1 = $('acPin'), p2 = $('acPin2');
  el.querySelectorAll('.atabs button').forEach(b => b.onclick = () => acModeSet(b.dataset.m));
  [p1, p2].forEach(i => i.addEventListener('input', () => { const v = i.value.replace(/\D/g, '').slice(0, 4); if (v !== i.value) i.value = v; }));
  let seq = 0, tmr = 0;
  nm.addEventListener('input', () => {   // 등록: 쓸 수 있는 이름인지 바로 확인 (규칙 → 서버 중복)
    clearTimeout(tmr); const out = $('acNm'); if (acMode !== 'reg') { out.textContent = ''; return; }
    const c = nmCheck(nm.value); if (!nm.value.trim()) { out.textContent = ''; return; }
    if (!c.ok) { out.className = 'amsg bad'; out.textContent = '✗ ' + rkErr(c); return; }
    out.className = 'amsg dim'; out.textContent = L2('확인 중…', 'Checking…'); const my = ++seq;
    tmr = setTimeout(async () => { const r = await rkCall('/check?name=' + encodeURIComponent(c.name)); if (my !== seq || acMode !== 'reg') return; out.className = 'amsg ' + (r.ok ? 'good' : 'bad'); out.textContent = r.ok ? '✓ ' + L2('쓸 수 있는 이름입니다', 'Name available') : '✗ ' + rkErr(r); }, 380);
  });
  nm.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); p1.focus(); } });
  p1.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (acMode === 'reg') p2.focus(); else acSubmit(); } });
  p2.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); acSubmit(); } });
  $('acGo').onclick = acSubmit;
  $('acGuest').onclick = () => { if (RK.acct) RK.guestNow = true; acctSync(); acctClose(); };
  return el;
}
function acModeSet(m) {
  acMode = m; const el = acctPanel(); el.classList.toggle('isreg', m === 'reg');
  el.querySelectorAll('.atabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('acGo').textContent = m === 'reg' ? L2('등록하고 시작', 'Register and start') : L2('로그인', 'Log in');
  $('acPin').autocomplete = m === 'reg' ? 'new-password' : 'current-password';
  $('acMsg').textContent = ''; $('acNm').textContent = ''; if (m === 'reg' && $('acName').value) $('acName').dispatchEvent(new Event('input'));
}
function acctOpen(m, after) {
  if (!RK.api) return; const el = acctPanel(); RK.after = after || null;
  acModeSet(m || 'login'); $('acPin').value = $('acPin2').value = '';
  const pre = RK.acct ? RK.acct.name : SET.pilot; if (!$('acName').value && pre && nmCheck(pre).ok) $('acName').value = pre;
  el.classList.remove('hidden');
  const focus = () => { const g = $('pinGate'); if (g && !g.classList.contains('hidden')) { setTimeout(focus, 300); return; } if (!IS_TOUCH && !el.classList.contains('hidden')) try { ($('acName').value ? $('acPin') : $('acName')).focus(); } catch (e) { } };
  setTimeout(focus, 60);
}
function acctClose() { const el = $('acctPanel'); if (el) el.classList.add('hidden'); RK.after = null; try { document.activeElement && document.activeElement.blur(); } catch (e) { } }
async function acSubmit() {
  if (RK.busy) return; const msg = $('acMsg'), say = (t, c) => { msg.className = 'amsg ' + (c || 'bad'); msg.textContent = t; };
  const name = nmNorm($('acName').value), pin = $('acPin').value, pin2 = $('acPin2').value;
  if (acMode === 'reg') { const c = nmCheck(name); if (!c.ok) return say(rkErr(c)); if (!/^\d{4}$/.test(pin)) return say(rkErr({ err: 'pin' })); if (pin !== pin2) return say(rkErr({ err: 'pin2' })); }
  else { if ([...name].length < 2) return say(L2('조종사 이름을 입력해 주세요', 'Enter your pilot name')); if (!/^\d{4}$/.test(pin)) return say(rkErr({ err: 'pin' })); }
  RK.busy = true; $('acGo').disabled = true; say(L2('확인 중…', 'Checking…'), 'dim');
  const r = await rkCall(acMode === 'reg' ? '/register' : '/login', { name, pin });
  RK.busy = false; $('acGo').disabled = false;
  if (!r.ok) { say(rkErr(r)); if (r.err === 'wrong') { $('acPin').value = ''; $('acPin').focus(); } return; }
  const after = RK.after; acctSet({ name: r.name, token: r.token }); say('', 'dim'); acctClose();
  rkFlush(); if (after) after();
}

function rkResume() { RK.guestNow = false; RK.me = null; if (RK.acct) { SET.pilot = RK.acct.name; const i = $('pilotName'); if (i) i.value = RK.acct.name; rkToast('🔑 ' + RK.acct.name + ' · ' + L2('로그인됨', 'logged in')); } acctSync(); }
function rkToast(t) { let e = $('rkToast'); if (!e) { e = document.createElement('div'); e.id = 'rkToast'; e.className = 'rktoast'; document.body.appendChild(e); } e.textContent = t; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); clearTimeout(rkToast.t); rkToast.t = setTimeout(() => e.classList.remove('on'), 2400); }
// 첫 화면: 인트로가 끝나고 로고가 뜨면 고르기 — 🔑 기존 계정 (이 기기에 저장된 아이디면 비밀번호 없이 바로) · 👤 게스트 · ✚ 새로 가입  (template.html 의 첫 화면이 부름)
window.__bootPick = function (el, done) {
  if (!RK.api) return false; const a = RK.acct;
  el.innerHTML = `<button data-k="acct" class="primary">🔑 ${L2('기존 계정으로 로그인', 'Log in with my account')}<small>${a ? rkEsc(a.name) + ' · ' + L2('이 기기에 저장됨', 'saved on this device') : L2('아이디 · 비밀번호 4자리', 'name + 4-digit PIN')}</small></button>` +
    `<button data-k="guest">👤 ${L2('게스트로 비행', 'Fly as guest')}<small>${L2('랭킹 없이 둘러보기', 'no leaderboard')}</small></button>` +
    `<button data-k="reg">✚ ${L2('새로 가입', 'Sign up')}<small>${L2('조종사 이름 + 숫자 4자리', 'pilot name + 4 digits')}</small></button>`;
  el.onclick = e => {
    const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k; done();
    if (k === 'acct') { if (a) rkResume(); else setTimeout(() => acctOpen('login'), 250); }
    else if (k === 'guest') { RK.guestNow = !!a; acctSync(); rkToast('👤 ' + L2('게스트로 비행 · 랭킹에 기록되지 않습니다', 'Flying as guest · not ranked')); }
    else if (k === 'reg') { RK.guestNow = !!a; acctSync(); setTimeout(() => acctOpen('reg'), 250); }
  };
  return true;
};

// ---- 1단계(조종사): 로그인 상태 · 로그아웃 · 계정 삭제 / 손님이면 로그인 단추 ----
function acctBox() {
  let b = $('acctBox'); if (b || !RK.api) return b; const i = $('pilotName'); if (!i) return null;
  b = document.createElement('div'); b.id = 'acctBox'; b.className = 'acctbox'; i.insertAdjacentElement('afterend', b);
  b.addEventListener('click', async e => {
    const a = e.target.closest('button'); if (!a) return; const act = a.dataset.a;
    if (act === 'in') acctOpen('login'); else if (act === 'reg') acctOpen('reg'); else if (act === 'resume') rkResume();
    else if (act === 'out') { acctSet(null); }
    else if (act === 'del') b.classList.add('deling');
    else if (act === 'delno') { b.classList.remove('deling'); acctSync(); }
    else if (act === 'delgo') {
      const pin = b.querySelector('.acdel input').value, m = b.querySelector('.acdel em');
      if (!/^\d{4}$/.test(pin)) { m.textContent = rkErr({ err: 'pin' }); return; }
      m.textContent = L2('지우는 중…', 'Deleting…'); const r = await rkCall('/delete', { name: RK.acct.name, pin });
      if (!r.ok) { m.textContent = rkErr(r); return; }
      b.classList.remove('deling'); acctSet(null); const h = b.querySelector('.acout span'); if (h) h.textContent = L2('계정과 랭킹 기록을 지웠습니다', 'Account and leaderboard records deleted');
    }
  });
  return b;
}
function acctSync() {
  const b = acctBox(), i = $('pilotName'); if (!b || !i) return; const a = rkMe(), sv = RK.guestNow && RK.acct;
  i.classList.toggle('hidden', !!a); b.classList.remove('deling');
  b.innerHTML = a ? `<div class="acin"><b>🔑 ${rkEsc(a.name)}</b><span>${L2('로그인됨 · 코스·임무를 끝내면 점수가 랭킹에 올라갑니다', 'Logged in · finished courses and missions go on the leaderboard')}</span><button data-a="out">${L2('로그아웃', 'Log out')}</button><button data-a="del" class="mini">${L2('계정 삭제', 'Delete account')}</button></div>` +
    `<div class="acdel"><span>${L2('계정과 랭킹 기록을 모두 지웁니다 · 비밀번호 4자리', 'Deletes your account and leaderboard records · enter your PIN')}</span><input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"><button data-a="delgo" class="danger">${L2('지우기', 'Delete')}</button><button data-a="delno">${L2('취소', 'Cancel')}</button><em></em></div>`
    : `<div class="acout"><span>${L2('손님 비행 · 기록은 이 기기에만 남고 랭킹에는 오르지 않습니다', 'Guest · records stay on this device and are not ranked')}</span>${sv ? `<button data-a="resume" class="primary">🔑 ${rkEsc(sv.name)}</button><button data-a="in">${L2('다른 계정', 'Other account')}</button>` : `<button data-a="in" class="primary">🔑 ${L2('로그인', 'Log in')}</button><button data-a="reg">${L2('새 조종사 등록', 'New pilot')}</button>`}</div>`;
  const w = $('wzWho'); if (w && MENU.step === 3) w.textContent = `${pilotName()} · ${AFc().name}`;
}

// ---- 점수 올리기 (결과 화면) ----
function rkResLine() {
  let d = $('resRank'); if (d) return d; const b = $('resBest'); if (!b) return null;
  d = document.createElement('div'); d.id = 'resRank'; d.className = 'resrank'; b.insertAdjacentElement('afterend', d);
  d.addEventListener('click', e => { const a = e.target.closest('button'); if (!a) return; if (a.dataset.a === 'in') { if (RK.guestNow && RK.acct) { rkResume(); rkSend(RK.last); } else acctOpen('login', () => rkSend(RK.last)); } else if (a.dataset.a === 'rank') rankOpen(RK.last && RK.last.k); });
  return d;
}
function rkSubmit(R) {   // debriefShow 에서 부름 (코스·임무 완료 때 한 번)
  const d = rkResLine(); if (d) d.innerHTML = ''; RK.last = null;
  if (!RK.api || !rkKindOk(S.kind) || !rkSiteOk() || !(R.total > 0)) return;
  RK.last = { k: S.kind, sent: false, b: { kind: rkBoard(S.kind), score: R.sc, grade: R.g, time: Math.round(R.total * 100) / 100, diff: SET.diff, af: SET.af } };
  if (rkMe()) rkSend(RK.last);
  else if (d) d.innerHTML = `<span>🏆 ${L2('로그인하면 이 점수가 랭킹에 올라갑니다', 'Log in to post this score to the leaderboard')}</span><button data-a="in">🔑 ${L2('로그인 · 등록', 'Log in / register')}</button><button data-a="rank">${L2('랭킹 보기', 'Leaderboard')}</button>`;
}
async function rkSend(run) {
  const d = rkResLine(), me = rkMe(); if (!run || run.sent || !me) return; run.sent = true;
  if (d) d.innerHTML = `<span class="dim">🏆 ${L2('랭킹에 올리는 중…', 'Posting to the leaderboard…')}</span>`;
  const r = await rkCall('/score', Object.assign({ token: me.token }, run.b)); RK.me = null;
  if (run !== RK.last || !d) { if (!r.ok && r.err === 'net') rkQueue(run.b); return; }
  const btn = `<button data-a="rank">${L2('랭킹 보기', 'Leaderboard')}</button>`;
  if (r.ok) d.innerHTML = `<span class="${r.best ? 'good' : ''}">🏆 ${L2(`랭킹 ${r.rank}위 / ${r.n}명`, `Rank ${r.rank} of ${r.n}`)} · ${r.best ? L2('개인 최고 기록!', 'Personal best!') : L2(`개인 최고 ${r.score}점 유지`, `Your best stays ${r.score}`)}</span>${btn}`;
  else if (r.err === 'net') { rkQueue(run.b); d.innerHTML = `<span class="dim">🏆 ${L2('서버에 연결하지 못했습니다 · 다음에 접속하면 자동으로 올립니다', 'Server unreachable · it will be posted automatically next time')}</span>`; }
  else if (r.err === 'token') { acctSet(null); run.sent = false; d.innerHTML = `<span>🏆 ${rkErr(r)}</span><button data-a="in">🔑 ${L2('로그인', 'Log in')}</button>`; }
  else d.innerHTML = `<span class="dim">🏆 ${rkErr(r)}</span>`;
}
// 연결이 안 될 때 남겨 두었다가 다음에 올림 (같은 조종사일 때만 · 최대 20개)
function rkQueue(b) { try { const q = JSON.parse(localStorage.getItem('fpvsim_rank_q') || '[]'); q.push({ n: rkMe() && rkMe().name, b }); localStorage.setItem('fpvsim_rank_q', JSON.stringify(q.slice(-20))); } catch (e) { } }
async function rkFlush() {
  if (!RK.api || !RK.acct || RK.flushing) return; let q = []; try { q = JSON.parse(localStorage.getItem('fpvsim_rank_q') || '[]'); } catch (e) { }
  if (!q.length) return; RK.flushing = true; const keep = [];
  for (const it of q) { if (!RK.acct || it.n !== RK.acct.name) { keep.push(it); continue; } const r = await rkCall('/score', Object.assign({ token: RK.acct.token }, it.b)); if (!r.ok && r.err === 'net') keep.push(it); }
  try { localStorage.setItem('fpvsim_rank_q', JSON.stringify(keep)); } catch (e) { } RK.flushing = false; RK.me = null;
}

// ---- 랭킹 창 ----
function rankPanel() {
  let el = $('rankPanel'); if (el) return el;
  el = document.createElement('div'); el.id = 'rankPanel'; el.className = 'panel hidden rkp';
  el.innerHTML = `<div class="card rcard"><h1>RANKING</h1><h2 id="rkSub"></h2><div id="rkTabs" class="rktabs"></div><div id="rkMe" class="rkme"></div><div id="rkList" class="rklist"></div>
    <div class="btns"><button class="primary" id="rkClose">${L2('닫기', 'Close')}</button><button id="rkLogin">🔑 ${L2('로그인 · 등록', 'Log in / register')}</button><button id="rkRe">↻</button></div></div>`;
  document.body.appendChild(el);
  $('rkClose').onclick = rankClose; $('rkRe').onclick = () => rankLoad(true);
  $('rkLogin').onclick = () => { if (RK.guestNow && RK.acct) { rkResume(); rankLoad(true); } else acctOpen('login', () => rankLoad(true)); };
  el.addEventListener('click', e => { if (e.target === el) rankClose(); const b = e.target.closest('#rkTabs button'); if (b) { RK.board = b.dataset.k; rankLoad(); } });
  return el;
}
function rankOpen(k) {
  if (!RK.api) return; const el = rankPanel(), L = rkKinds();
  RK.board = L.includes(k) ? k : L.includes(RK.board) ? RK.board : L[0] || 'course';
  el.classList.remove('hidden'); rankLoad(true);
}
function rankClose() { const el = $('rankPanel'); if (el) el.classList.add('hidden'); }
async function rankLoad(fresh) {
  const L = rkKinds(), k = RK.board, list = $('rkList'), me = $('rkMe'); if (!list) return;
  $('rkTabs').innerHTML = L.map(x => `<button data-k="${x}" class="${x === k ? 'on' : ''}">${rkEsc(rkKindName(x))}</button>`).join('');
  $('rkSub').textContent = L2('코스·임무별 최고 점수 · 같은 점수면 짧은 시간 순 · ', 'Best score per course or mission · ties go to the faster time · ') + stName(SITE);
  $('rkLogin').classList.toggle('hidden', !!rkMe());
  list.innerHTML = `<div class="rkempty">${L2('불러오는 중…', 'Loading…')}</div>`; me.innerHTML = '';
  const board = rkBoard(k), my = ++RK.seq;
  const [r, m] = await Promise.all([rkCall('/rank?kind=' + encodeURIComponent(board) + '&limit=50'), rkMe() && (fresh || !RK.me || Date.now() - RK.meAt > 30000) ? rkCall('/me', { token: rkMe().token }) : Promise.resolve(null)]);
  if (my !== RK.seq || RK.board !== k) return;
  if (m) { if (m.ok) { RK.me = m; RK.meAt = Date.now(); } else if (m.err === 'token') acctSet(null); }
  if (!r.ok) { list.innerHTML = `<div class="rkempty">${rkErr(r)}</div>`; return; }
  const ac = rkMe(), mine = ac && RK.me && RK.me.best ? RK.me.best.find(b => b.kind === board) : null, myKey = ac ? nmKey(ac.name) : '';
  me.innerHTML = ac ? (mine ? `🔑 <b>${rkEsc(ac.name)}</b> · ${L2(`${mine.rank}위 / ${mine.n}명`, `rank ${mine.rank} of ${mine.n}`)} · ${mine.score}${L2('점', ' pts')} ${mine.grade || ''} · ${fmt(mine.time)} · ${L2(`${mine.runs}번 비행`, `${mine.runs} runs`)}` : `🔑 <b>${rkEsc(ac.name)}</b> · ${L2('이 코스 기록 없음 · 끝까지 비행하면 올라갑니다', 'No record here yet · finish a run to post one')}`)
    : L2('손님은 랭킹에 오르지 않습니다 · 로그인하면 다음 비행부터 기록됩니다', 'Guests are not ranked · log in and your next finished run is posted');
  const row = (x, i) => `<div class="rkr${myKey && nmKey(x.name) === myKey ? ' me' : ''}"><i>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</i><b>${rkEsc(x.name)}</b><span class="s">${x.score}<em class="g${rkEsc(x.grade)}">${rkEsc(x.grade)}</em></span><span class="t">${fmt(x.time)}</span><span class="d">${MODES[x.diff] ? MODES[x.diff].name : rkEsc(x.diff)} · ${AF[x.af] ? AF[x.af].tag : rkEsc(String(x.af).toUpperCase())}</span><span class="w">${(d => `${d.getMonth() + 1}/${d.getDate()}`)(new Date(x.at))}</span></div>`;
  let h = r.list.map(row).join('');
  if (mine && mine.rank > r.list.length) h += `<div class="rkgap">⋯</div>` + row({ name: ac.name, score: mine.score, grade: mine.grade, time: mine.time, diff: mine.diff, af: mine.af, at: mine.at }, mine.rank - 1);
  list.innerHTML = h || `<div class="rkempty">${L2('아직 기록이 없습니다 · 첫 기록의 주인공이 되어 보세요', 'No records yet · be the first')}</div>`;
  if (r.n > r.list.length) list.insertAdjacentHTML('beforeend', `<div class="rkgap">${L2(`전체 ${r.n}명 중 상위 ${r.list.length}명`, `Top ${r.list.length} of ${r.n}`)}</div>`);
}
function rkModal() { return ['acctPanel', 'rankPanel'].some(id => { const e = $(id); return e && !e.classList.contains('hidden'); }); }   // 열려 있으면 메뉴 단축키(Enter 출격 등)를 쉬게 함

// ---- 붙이기: 단추 · 키 · 시작할 때 ----
if (RK.api) {
  acctSync();
  { const m = document.querySelector('#menuCard .wzmid'); if (m) { const b = document.createElement('button'); b.id = 'bRank'; b.textContent = '🏆 ' + L2('랭킹', 'Ranking'); b.onclick = () => rankOpen(MENU.ms); m.appendChild(b); } }
  { const r = document.querySelector('#result .btns'); if (r) { const b = document.createElement('button'); b.id = 'bRank2'; b.textContent = '🏆 ' + L2('랭킹', 'Ranking'); b.onclick = () => rankOpen(S.kind); r.appendChild(b); } }
  window.addEventListener('keydown', e => {   // 로그인·랭킹 창: Esc 로 닫기 (게임 키로 넘기지 않음)
    if (e.key !== 'Escape' || !rkModal()) return; const g = $('pinGate'); if (g && !g.classList.contains('hidden')) return;
    e.stopImmediatePropagation(); e.preventDefault(); if ($('rankPanel') && !$('rankPanel').classList.contains('hidden')) rankClose(); else acctClose();
  }, true);
  if (RK.test && /[?&]login/.test(location.search) && !RK.acct) setTimeout(() => acctOpen('login'), 30);   // 시험용: 로그인 창 바로 (보통은 첫 화면 로고에서 고름)
  if (RK.acct) setTimeout(rkFlush, 4000);
}
if (window.__sim) Object.assign(window.__sim, { RK, rkMe, rkSubmit, rankOpen, acctOpen, acctSet, nmCheck, Sref: () => S, finishRun: () => finishRun(), MUSref: () => MUS, AUref: () => AU });
