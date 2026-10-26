// =====================================================================
//  시험장 진행: 시험위원 방송 · 응시자 구호 · 비행 전 점검 · 조종기 점검 · 시동 · 구술
//  음성은 기기 음성 합성(speechSynthesis)만 씀 · 시험위원 지시문과 구호는 앱이 쓴 예시 문구
// =====================================================================
const C1V = { micOn: false, rec: null, heard: '', heardT: 0 };
function c1VoicePick() {
  try { const vs = speechSynthesis.getVoices(), lang = window.SIM_LANG === 'en' ? 'en' : 'ko'; return vs.filter(v => v.lang && v.lang.toLowerCase().startsWith(lang)); } catch (e) { return []; }
}
// who: 'ex' 시험위원 (낮고 차분) · 'me' 응시자 구호 (높고 빠르게, 다른 목소리가 있으면 그것)
// ---- 미리 만든 음성 묶음 (한국어: Mimic3 KSS 음성 · 영어: Kokoro) · 없거나 못 찾으면 기기 음성 합성 ----
const C1A = { st: 'none', idx: null, buf: null, ab: {}, until: 0 };
function c1ALoad() {
  if (C1A.st !== 'none') return; C1A.st = 'loading';
  const ib = document.getElementById('c1vb'), ii = document.getElementById('c1vi');
  if (ib && ii) { try { const s = atob(ib.textContent.trim()), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); C1A.buf = u.buffer; C1A.idx = JSON.parse(ii.textContent); C1A.st = 'ready'; } catch (e) { C1A.st = 'fail'; } return; }
  if (location.protocol === 'file:') { C1A.st = 'fail'; return; }
  const base = (window.SIM_BASE || '') + 'lib/c1_voice';
  Promise.all([fetch(base + '.json').then(r => r.json()), fetch(base + '.bin').then(r => r.arrayBuffer())]).then(([i, b]) => { C1A.idx = i; C1A.buf = b; C1A.st = 'ready'; }).catch(() => { C1A.st = 'fail'; });
}
function c1AKey(text, who) {
  const L = window.SIM_LANG === 'en' ? 'en' : 'ko', k = `${L}|${who}|${text}`; if (!C1A.idx) return null;
  if (C1A.idx[k]) return k;
  const g = `${L}|${who}|` + (L === 'ko' ? text.replace(/^응시자 [^,]+,/, '응시자,') : text.replace(/^Candidate [^,]+,/, 'Candidate,')); return C1A.idx[g] ? g : null;
}
function c1APlay(k) {
  const ctx = AU.ctx; if (!ctx) return false;
  try { if (ctx.state !== 'running') ctx.resume(); } catch (e) { }
  const [o, l] = C1A.idx[k];
  const go = b => { const s = ctx.createBufferSource(); s.buffer = b; const gn = ctx.createGain(); gn.gain.value = 1.6; s.connect(gn); gn.connect(AU.master || ctx.destination);
    const t0 = Math.max(ctx.currentTime + 0.02, C1A.until); s.start(t0); C1A.until = t0 + b.duration + 0.15; };
  if (C1A.ab[k]) go(C1A.ab[k]); else ctx.decodeAudioData(C1A.buf.slice(o, o + l)).then(b => { C1A.ab[k] = b; go(b); }).catch(() => { });
  return true;
}
function c1Say(text, who) {
  if (C1A.st === 'none') c1ALoad();
  const ak = C1A.st === 'ready' ? c1AKey(text, who) : null;
  const dur = ak ? C1A.idx[ak][2] + 0.35 : Math.max(1.4, text.length * (window.SIM_LANG === 'en' ? 0.065 : 0.13) + 0.5);
  c1Caption(text, who, dur); C1.sayUntil = Math.max(C1.sayUntil || 0, C1.t || 0) + dur;
  if (who === 'me') { C1.meUntil = C1.sayUntil; C1.lastMe = text; } else { C1.exUntil = C1.sayUntil; C1.lastEx = text; }   // 구호가 끝날 때까지 단계 완료를 기다리기 위한 시각
  (C1V.log = C1V.log || []).push((ak ? '' : '[NOKEY] ') + (who === 'me' ? 'ME: ' : 'EX: ') + text); if (C1V.log.length > 300) C1V.log.shift();
  try {
    if (ak && SET.c1voice !== false) { if (!TEST) c1APlay(ak); C1V.nRec = (C1V.nRec || 0) + 1; }
    else if (window.speechSynthesis && !TEST && SET.c1voice !== false) {   // 무전 음성 설정과 따로 (무전을 꺼도 시험장 안내는 나옴)
      const u = new SpeechSynthesisUtterance(text), vs = c1VoicePick();
      u.lang = window.SIM_LANG === 'en' ? 'en-US' : 'ko-KR';
      if (vs.length) u.voice = who === 'me' && vs.length > 1 ? vs[1] : vs[0];
      u.pitch = who === 'me' ? 1.25 : 0.85; u.rate = who === 'me' ? 1.15 : 0.98; u.volume = 1;
      u.onstart = () => { C1V.ok = true; C1V.err = null; };
      u.onerror = e => { if (e.error === 'interrupted' || e.error === 'canceled') return; C1V.err = e.error || 'error'; c1Ev('ttsErr', { err: C1V.err }); };
      (C1V.utts = C1V.utts || []).push(u); if (C1V.utts.length > 8) C1V.utts.shift();   // 크롬: 참조가 없으면 말하다 끊기는 문제 방지
      try { speechSynthesis.resume(); } catch (e) { }
      speechSynthesis.speak(u);
      if (who === 'ex') sfx('good');   // 안내 시작음 (음성이 안 나오는 기기에서도 알림)
    } else if (who === 'ex') sfx('good');
  } catch (e) { }
  return dur;
}
// 휴대폰(특히 아이폰)·일부 브라우저는 화면을 한 번 누른 뒤에야 음성이 나옴 → 첫 터치·키 입력 때 빈 음성으로 열어 둠
function c1VoiceUnlock() {
  try { if (typeof initAudio === 'function') initAudio(); if (AU.ctx && AU.ctx.state !== 'running') AU.ctx.resume(); } catch (e) { }
  if (C1V.unlocked || !window.speechSynthesis) return; C1V.unlocked = true;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; u.lang = window.SIM_LANG === 'en' ? 'en-US' : 'ko-KR'; speechSynthesis.speak(u); speechSynthesis.resume(); } catch (e) { }
}
['pointerdown', 'keydown', 'touchend'].forEach(ev => document.addEventListener(ev, () => { if (isC1() || S.state === 'menu') c1VoiceUnlock(); }, { capture: true, passive: true }));
function c1VoiceStatus() {
  if (C1A.st === 'ready') return SET.c1voice === false ? L2('🔇 시험장 음성 꺼짐 (🔊 버튼)', '🔇 Test-field voice off (🔊)') : (!AU.ctx || AU.ctx.state !== 'running' ? L2('🔈 화면을 한 번 누르면 소리가 납니다', '🔈 Tap the screen once to enable sound') : '');
  if (!window.speechSynthesis) return L2('🔇 이 브라우저는 음성 합성을 지원하지 않습니다', '🔇 No speech synthesis in this browser');
  if (SET.c1voice === false) return L2('🔇 시험장 음성 꺼짐 (🔊 버튼)', '🔇 Test-field voice off (🔊)');
  if (C1V.err) return L2(`🔇 음성 오류 (${C1V.err}) · 화면을 한 번 누른 뒤 🔊 로 시험`, `🔇 Voice error (${C1V.err}) · tap the screen, then test with 🔊`);
  let all = []; try { all = speechSynthesis.getVoices(); } catch (e) { }
  if (all.length && !c1VoicePick().length) return L2('🔇 기기에 한국어 음성이 없습니다 · 기기 설정에서 한국어 음성(TTS) 데이터를 설치하세요', '🔇 No English voice on this device');
  return '';
}
function c1VoiceTest() { C1V.err = null; c1VoiceUnlock(); const vs = c1VoicePick(); c1Say(L2('음성 안내 시험입니다. 잘 들리십니까?', 'Voice check. Can you hear me?') + (vs.length ? '' : ''), 'ex'); }
function c1Caption(text, who, dur) {
  let el = $('c1cap'); if (!el) { el = document.createElement('div'); el.id = 'c1cap'; document.body.appendChild(el); }
  if (IS_TOUCH && who === 'me') { el.classList.remove('on'); return; }   // 모바일: 내 구호는 패널 대화창에 있으니 자막은 시험위원만
  el.innerHTML = `<b>${who === 'me' ? L2('🗣 응시자', '🗣 Candidate') : L2('📢 시험위원', '📢 Examiner')}</b> ${text}`; el.className = who === 'me' ? 'me on' : 'on';
  clearTimeout(c1Caption.t); c1Caption.t = setTimeout(() => el.classList.remove('on'), (dur + 1.2) * 1000);
}
// 구호: 지금 단계의 구호를 버튼·키(Q)로 → 기기 음성이 대신 외침 · 마이크(음성인식)로 직접 말하면 그대로 기록
function c1CallDo(how) {
  const st = c1Cur(); if (!st || !st.call || st.callSaid) return false;
  const tx = L2(st.call.ko, st.call.en); if (how !== 'voice' && tx) c1Say(tx, 'me');
  st.callSaid = how; c1Ev('call', { how, text: st.call.ko });
  // 실제 시험처럼: 구호(이상무)를 외치면 그 단계 완료 → 다음으로 (다음 버튼 따로 안 눌러도 됨)
  if (!_c1conf && (st.k === 'prep' || (st.k === 'arm' && !st.csc) || st.k === 'disarm')) c1Confirm();
  return true;
}
function c1Heard(text) {
  const t = text.replace(/\s+/g, '').toLowerCase(); C1V.heard = text; C1V.heardT = 3;
  const st = c1Cur(); if (!st) return;
  if (st.call && !st.callSaid && st.call.kw.some(k => t.includes(k.toLowerCase()))) c1CallDo('voice');
  if (st.k === 'callout' && /비상|emergency/.test(t)) c1Key('KeyE', true);
}
function c1Mic(on) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (on && !SR) { showMsg(L2('이 브라우저는 음성인식을 지원하지 않습니다 · 버튼(Q)으로 구호', 'No speech recognition in this browser · use the call button (Q)'), '#ffc828', 2.5); C1V.micOn = false; return; }
  C1V.micOn = !!on;
  if (!on) { try { C1V.rec && C1V.rec.stop(); } catch (e) { } C1V.rec = null; return; }
  const r = new SR(); r.lang = window.SIM_LANG === 'en' ? 'en-US' : 'ko-KR'; r.continuous = true; r.interimResults = true;
  r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) c1Heard(e.results[i][0].transcript); };
  r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { C1V.micOn = false; showMsg(L2('마이크 권한이 없습니다', 'Microphone permission denied'), '#ff9a40', 2); } };
  r.onend = () => { if (C1V.micOn && C1V.rec === r) try { r.start(); } catch (e) { } };
  try { r.start(); C1V.rec = r; showMsg(L2('🎤 음성 구호 인식 켬 (인터넷 필요할 수 있음)', '🎤 Voice calls on (may need internet)'), '#5dff9a', 2); } catch (e) { C1V.micOn = false; }
}
function c1Arm(how) {
  if (C1.armed) return; C1.armed = true; C1.tArm = C1.t; c1Ev('arm', { how }); sfx('good');
  if (how === 'btn') c1CallDo('btn');
}

// ---- 비행 전 점검 (상태를 보고 정상/불량 판정 · 모의평가는 40% 확률로 이상 한 가지) ----
const C1INS = [
  { id: 'prop', ko: '프로펠러 체결·파손', en: 'Propellers: fixed, undamaged', ok: ['단단히 고정 · 손상 없음', 'Tight · no damage'], bad: ['한 장 끝에 금 · 손으로 흔들면 유격', 'Crack at one tip · play when shaken'] },
  { id: 'arm', ko: '암·폴딩 잠금', en: 'Arms / folding locks', ok: ['4개 모두 잠김', 'All four locked'], bad: ['오른쪽 뒤 암 잠금 풀림', 'Rear-right arm lock open'] },
  { id: 'skid', ko: '스키드·볼트·너트', en: 'Skids, bolts, nuts', ok: ['조임 정상', 'Tight'], bad: ['왼쪽 스키드 볼트 풀림', 'Left skid bolt loose'] },
  { id: 'bat', ko: '기체 배터리', en: 'Flight battery', ok: ['장착·잠금 · 셀당 4.18 V', 'Seated, locked · 4.18 V/cell'], bad: ['셀당 3.62 V (충전 부족)', '3.62 V/cell (not charged)'] },
  { id: 'tx', ko: '조종기 배터리', en: 'Transmitter battery', ok: ['85 %', '85 %'], bad: ['9 % · 저전압 경고', '9 % · low-voltage warning'] },
  { id: 'gps', ko: 'GPS·컴퍼스', en: 'GPS / compass', ok: ['위성 16개 · 컴퍼스 정상', '16 satellites · compass OK'], bad: ['위성 5개 · 컴퍼스 교정 필요', '5 satellites · compass calibration needed'] }
];
function c1Modal(html) {
  let el = $('c1m'); if (!el) { el = document.createElement('div'); el.id = 'c1m'; document.body.appendChild(el); }
  el.innerHTML = `<div class="box">${html}</div>`; el.classList.remove('hidden'); return el;
}
function c1ModalClose() { const el = $('c1m'); if (el) el.classList.add('hidden'); }
function c1InspectUI(st) {
  const ans = st.ans = {};
  const row = it => { const bad = st.fault === it.id; return `<tr><td>${L2(it.ko, it.en)}</td><td class="${bad ? 'warn' : ''}">${L2((bad ? it.bad : it.ok)[0], (bad ? it.bad : it.ok)[1])}</td><td><button data-i="${it.id}" data-v="ok">${L2('정상', 'OK')}</button><button data-i="${it.id}" data-v="bad">${L2('불량', 'Fault')}</button></td></tr>`; };
  const el = c1Modal(`<h3>${L2('비행 전 점검', 'Pre-flight inspection')}</h3><p class="dim">${L2('기체와 조종기를 확인하고 항목마다 상태를 판정하십시오. 이상이 있으면 불량을 고르면 조치(기체 교체) 후 진행합니다.', 'Check the aircraft and transmitter and judge each item. Mark a fault and it is fixed (aircraft swap) before you continue.')}</p>
<table>${C1INS.map(row).join('')}</table><button class="primary" id="c1InsGo" disabled>${L2('점검 완료', 'Inspection done')}</button>`);
  el.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => { ans[b.dataset.i] = b.dataset.v; el.querySelectorAll(`button[data-i="${b.dataset.i}"]`).forEach(x => x.classList.toggle('on', x === b)); $('c1InsGo').disabled = Object.keys(ans).length < C1INS.length; });
  $('c1InsGo').onclick = () => c1InspectDone(st);
}
function c1InspectDone(st) {
  if (st.done) return; st.done = true; c1ModalClose();
  const wrong = C1INS.filter(it => (st.ans[it.id] === 'bad') !== (st.fault === it.id)).map(it => it.id);
  c1Ev('inspect', { fault: st.fault, answers: st.ans, wrong });
  if (wrong.length) c1Fail(st, 'inspect', { wrong, fault: st.fault });
  if (st.fault && st.ans[st.fault] === 'bad') c1Say(L2('이상 확인. 조치 후 진행하십시오.', 'Fault confirmed. Fix it, then continue.'), 'ex');
  if (st.call && !st.callSaid) c1CallDo('auto');   // 점검을 마치면 보고 구호가 자동으로 나감 (버튼 없이)
}
function c1InspectAuto(correct) { const st = c1Cur(); if (!st || st.k !== 'inspect' || st.done) return; st.ans = {}; C1INS.forEach(it => st.ans[it.id] = correct ? (st.fault === it.id ? 'bad' : 'ok') : 'ok'); if (!correct && !st.fault) st.ans[C1INS[0].id] = 'bad'; c1InspectDone(st); }

// ---- 구술 문항 (앱 작성 예시 · 공식 출제 문항 아님 · 세부평가기준의 5개 항목 분류를 따름) ----
const C1Q = [
  { cat: 'ac', q: ['무인멀티콥터 1종의 구분 기준으로 맞는 것은?', 'Which defines a class-1 unmanned multicopter?'], a: [['최대이륙중량 25 kg 초과, 연료 제외 자체중량 150 kg 이하', 'MTOW over 25 kg, empty weight (excl. fuel) up to 150 kg'], ['최대이륙중량 7 kg 초과 25 kg 이하', 'MTOW over 7 kg up to 25 kg'], ['자체중량 25 kg 초과 기체만', 'Empty weight over 25 kg only'], ['최대이륙중량 2 kg 초과 7 kg 이하', 'MTOW over 2 kg up to 7 kg']] },
  { cat: 'ac', q: ['리튬폴리머 배터리 셀 1개의 완충 전압은 대략?', 'Roughly what is a full-charge LiPo cell voltage?'], a: [['4.2 V', '4.2 V'], ['3.7 V', '3.7 V'], ['3.0 V', '3.0 V'], ['5.0 V', '5.0 V']] },
  { cat: 'ac', q: ['비행제어기에서 기수 방향(방위)을 알려 주는 센서는?', 'Which flight-controller sensor gives heading?'], a: [['지자기 센서(컴퍼스)', 'Magnetometer (compass)'], ['기압 센서', 'Barometer'], ['자이로 센서', 'Gyroscope'], ['GPS 수신기만', 'GPS receiver alone']] },
  { cat: 'pi', q: ['실기시험표준서의 응시 요건으로 맞는 것은?', 'Which is a practical-test requirement in the standard?'], a: [['최근 2년 이내 학과시험 합격', 'Passed the written test within the last 2 years'], ['학과시험은 기간 제한 없이 인정', 'Written test valid with no time limit'], ['비행경력 없이 응시 가능', 'No flight experience needed'], ['구술시험 면제', 'Oral exam waived']] },
  { cat: 'pi', q: ['조종자 준수사항으로 맞는 것은?', 'Which is a pilot rule?'], a: [['주류 등을 섭취한 상태로 비행하지 않는다', 'Never fly under the influence of alcohol'], ['인구 밀집 지역 상공에서 물건을 떨어뜨려도 된다', 'Dropping objects over crowds is allowed'], ['비행 중 휴대폰으로 영상 통화를 해도 된다', 'Video calls while flying are fine'], ['안전성 인증은 선택 사항이다', 'Safety certification is optional']] },
  { cat: 'pi', q: ['시험 당일 표준서가 요구하는 소지 서류는?', 'Which document does the standard require on test day?'], a: [['유효한 항공신체검사증명서', 'A valid aviation medical certificate'], ['비행기록 원본 전체', 'All original flight logs'], ['기체 구매 영수증', 'Aircraft purchase receipt'], ['보험 증서 원본', 'Original insurance policy']] },
  { cat: 'as', q: ['NOTAM(항공고시보)이란?', 'What is a NOTAM?'], a: [['항공 시설·절차·위험 등 운항에 필요한 정보를 알리는 고시', 'Notice of facilities, procedures or hazards relevant to flight'], ['조종자 자격 시험 일정표', 'A licence exam timetable'], ['기체 정비 기록부', 'An aircraft maintenance log'], ['드론 판매 허가증', 'A drone sales permit']] },
  { cat: 'as', q: ['승인 없이 비행할 수 없는 고도 기준은?', 'Above what height is approval required?'], a: [['지표·수면 또는 물건 상단에서 150 m 이상', '150 m or more above ground, water or structure'], ['50 m 이상', '50 m or more'], ['300 m 이상', '300 m or more'], ['고도 제한 없음', 'No limit']] },
  { cat: 'as', q: ['관제권 안에서 비행하려면?', 'To fly inside a control zone you need…'], a: [['비행 승인을 받아야 한다', 'Flight approval'], ['신고 없이 낮게 날면 된다', 'Nothing if you stay low'], ['GPS 모드면 자유롭게 가능하다', 'Nothing in GPS mode'], ['야간에만 가능하다', 'Night-only flying']] },
  { cat: 'gk', q: ['유인 항공기와 마주쳤을 때 무인비행장치는?', 'Meeting a crewed aircraft, the unmanned aircraft must…'], a: [['진로를 양보하고 피한다', 'Give way and keep clear'], ['고도를 높여 위로 지나간다', 'Climb over it'], ['그대로 진행한다', 'Carry on'], ['속도를 높여 먼저 지나간다', 'Speed up to pass first']] },
  { cat: 'gk', q: ['비행 중 GPS 신호를 잃었을 때 알맞은 조치는?', 'GPS lost in flight — what do you do?'], a: [['자세모드로 직접 조종해 안전한 곳에 착륙', 'Fly manually in attitude mode and land somewhere safe'], ['스틱을 놓고 기다린다', 'Let go of the sticks and wait'], ['최대 속도로 이륙 지점까지 직진', 'Fly flat out to the takeoff point'], ['시동을 바로 끈다', 'Shut the motors off at once']] },
  { cat: 'gk', q: ['비행 중 기체 배터리 저전압 경고가 뜨면?', 'Low-battery warning in flight — what next?'], a: [['가까운 안전한 곳에 즉시 착륙', 'Land at the nearest safe spot now'], ['남은 기동을 끝내고 착륙', 'Finish the remaining tasks first'], ['고도를 높여 기다린다', 'Climb and wait'], ['경고를 끈다', 'Silence the warning']] },
  { cat: 'eo', q: ['이륙 중 모터 이상(소음·진동·한쪽 쏠림)을 느끼면?', 'Abnormal motor (noise, vibration, yaw) during takeoff?'], a: [['즉시 이륙을 포기하고 착륙 후 시동을 끈다', 'Abort, land and shut down at once'], ['출력을 높여 빨리 올라간다', 'Add power and climb away'], ['기준고도까지 올라간 뒤 판단한다', 'Climb to reference height, then decide'], ['조종기를 끈다', 'Switch the transmitter off']] },
  { cat: 'eo', q: ['이륙 직후 기체가 한쪽으로 쏠려 제어가 어려우면?', 'Just after liftoff the aircraft drifts and is hard to control?'], a: [['주변에 크게 알리고 가장 가까운 안전한 곳에 바로 착륙', 'Warn people loudly and land at the nearest safe spot'], ['계속 상승해 바람을 피한다', 'Keep climbing out of the wind'], ['시험위원에게 조종기를 넘긴다', 'Hand the transmitter to the examiner'], ['기수를 계속 돌려 본다', 'Keep spinning the nose']] },
  { cat: 'eo', q: ['이륙을 포기한 뒤 해야 할 일은?', 'After aborting a takeoff you should…'], a: [['시동을 끄고 배터리를 분리한 뒤 원인을 점검', 'Shut down, disconnect the battery and find the cause'], ['바로 다시 이륙해 본다', 'Try another takeoff at once'], ['기록 없이 넘어간다', 'Move on without noting it'], ['프로펠러를 손으로 돌려 본다', 'Spin the props by hand while armed']] }
];
const C1QCAT = { ac: ['기체', 'Aircraft'], pi: ['조종자', 'Pilot'], as: ['공역·비행장', 'Airspace & aerodrome'], gk: ['일반지식·비상절차', 'General & emergency'], eo: ['이륙 중 엔진 고장·이륙 포기', 'Engine failure on takeoff'] };
function c1OralUI(st) {
  const pick = Object.keys(C1QCAT).map(c => { const L = C1Q.filter(q => q.cat === c); return L[Math.floor(Math.random() * L.length)]; });
  st.qs = pick.map(q => { const ord = [0, 1, 2, 3].sort(() => Math.random() - 0.5); return { q, ord, ans: null }; }); st.qi = 0;
  const show = () => {
    const x = st.qs[st.qi], lang = window.SIM_LANG === 'en' ? 1 : 0;
    if (st.qi === 0 || !st.spoke) { }
    c1Say(x.q.q[lang], 'ex');
    const el = c1Modal(`<h3>${L2('구술시험', 'Oral exam')} ${st.qi + 1} / 5 · ${C1QCAT[x.q.cat][lang]}</h3><p class="q">${x.q.q[lang]}</p>${x.ord.map(i => `<button class="opt" data-a="${i}">${x.q.a[i][lang]}</button>`).join('')}<p class="dim">${L2('앱이 쓴 예시 문항입니다 · 실제 구술은 시험위원이 묻고 답을 듣고 판단합니다.', 'App-written example questions · the real oral exam is asked and judged by the examiner.')}</p>`);
    el.querySelectorAll('.opt').forEach(b => b.onclick = () => c1OralAns(st, +b.dataset.a));
  };
  st.show = show; show();
}
function c1OralAns(st, a) {
  const x = st.qs[st.qi]; if (!x || x.ans != null) return; x.ans = a; c1Ev('oral', { cat: x.q.cat, q: x.q.q[0], ok: a === 0 });
  if (a !== 0) c1Fail(st, 'oral', { cat: x.q.cat });
  st.qi++; if (st.qi < st.qs.length) st.show(); else { st.done = true; c1ModalClose(); }
}
function c1OralAuto(nOk) { const st = c1Cur(); if (!st || st.k !== 'oral' || !st.qs) return; for (let i = 0; i < 5 && !st.done; i++) c1OralAns(st, i < nOk ? 0 : 1); }

Object.assign(C1EV, {
  ann(st) { if (SET.c1ann === false) { C1.introCam = false; if (!st.skipLogged) { st.skipLogged = true; c1Ev('annOff'); } return true; } if (st.t1 == null) { st.t1 = C1.t + c1Say(L2(st.ko, st.en), 'ex'); if (C1.M[C1.mi] && C1.M[C1.mi].id === 'pre' && C1.si === 0) C1.introCam = true; } if (C1.t >= st.t1) { C1.introCam = false; return true; } return false; },
  inspect(st) { if (!st.open) { st.open = true; st.fault = Math.random() < (C1.exam ? 0.4 : 0.5) ? C1INS[Math.floor(Math.random() * C1INS.length)].id : null; if (window.C1_FAULT !== undefined) st.fault = window.C1_FAULT; c1InspectUI(st); } return !!st.done; },
  rc(st) {
    const sn = st.seen || (st.seen = {}), a = { thr: IN.thr, yaw: IN.yaw, pitch: IN.pitch, roll: IN.roll };
    for (const k in a) { if (a[k] > 0.85) sn[k + '+'] = 1; if (a[k] < -0.85) sn[k + '-'] = 1; }
    st.err = null; return (Object.keys(sn).length >= 8 || st.callSaid) && C1.mode === 'gps' && Math.abs(IN.thr) < 0.3 && Math.abs(IN.pitch) < 0.3;   // 이상무 구호를 하면 다음으로
  },
  arm(st, M, dt) {
    if (C1.armed) return true;
    if (st.csc) { const g = IN.thr < -0.8 && IN.pitch < -0.8 && Math.abs(IN.yaw) > 0.8 && Math.abs(IN.roll) > 0.8 && Math.sign(IN.yaw) !== Math.sign(IN.roll); st.g = g ? (st.g || 0) + dt : 0; if (st.g > 0.5) { c1Arm('csc'); return true; } }
    return false;
  },
  ctl(st, M, dt) {
    const lat = Math.hypot(M.u - st.at[0], M.v - st.at[1]); st.err = { lat, alt: M.alt - (C1.ref || 4), hdg: c1Wrap(M.hdg) };
    c1Dev(st, 'pos', lat > c1R('posTol'), { lat: +lat.toFixed(2) }, dt); c1Dev(st, 'alt', Math.abs(st.err.alt) > c1R('altTol'), { alt: +M.alt.toFixed(2) }, dt);
    const sn = st.seen || (st.seen = {}); for (const [k, v] of [['p', IN.pitch], ['r', IN.roll], ['y', IN.yaw]]) { if (v > 0.12) sn[k + '+'] = 1; if (v < -0.12) sn[k + '-'] = 1; }
    st.okT = (Object.keys(sn).length >= 6 || st.callSaid) && c1Still(M) ? (st.okT || 0) + dt : 0;   // 이상무 구호를 하면 다음으로 (조작 확인은 기록만)
    if (st.okT > 0.8) { c1Ev('ctlChk', { seen: Object.keys(sn), byCall: !!st.callSaid }); return true; }
    return false;
  },
  oral(st) { if (!st.open) { st.open = true; c1OralUI(st); } return !!st.done; }
});

