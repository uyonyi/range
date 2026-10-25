// =====================================================================
//  VR (Quest 등): 1종 연습은 고글 화면이 아니라 조종자 자리(P)에 서서 맨눈으로 기체를 보는 방식
//  · 머리를 돌려 기체를 따라 봄 · 왼손 앞 아래에 안내판 · A 확인 · X 비상(점검 때는 불량) · Y 모드 · R트리거 구호 · B 메뉴
// =====================================================================
var C1XR = { rig: null, cam: null, board: null, t: 0, sel: 0, selT: 0 };
function c1VRon() { return ((typeof XR_ON !== 'undefined' && XR_ON && !XR.menu) || window.C1_VRTEST) && isC1() && S.state !== 'menu'; }
function c1XRInit() {
  if (C1XR.rig) return;
  const rig = new THREE.Group(); scene.add(rig); const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 9000); rig.add(cam);
  const b = vrPlane(0.62, 0.42, 1024, 694, { depthTest: false }); b.m.position.set(-0.32, 1.02, -0.5); b.m.rotation.set(-0.62, 0.42, 0, 'YXZ'); b.m.renderOrder = 30; rig.add(b.m);
  Object.assign(C1XR, { rig, cam, board: b });
}
function c1XRUpdate(dt) {
  c1XRInit(); const R = C1XR.rig;
  const at = C1.introCam ? c1W(-9, -7.5, 0) : c1W(0, 0, 0);
  const raise = XR.local ? c1p('eye') : 0;   // 바닥 기준 공간이 없으면 눈높이만큼 올림 (안내판은 그만큼 내림)
  R.position.copy(at); R.position.y += raise; C1XR.board.m.position.y = 1.02 - raise;
  R.rotation.set(0, -C1S.h, 0); R.updateMatrixWorld(true);
  if (window.C1_VRTEST) { C1XR.cam.position.set(0, c1p('eye'), 0); C1XR.cam.updateMatrixWorld(); C1XR.cam.lookAt(DR.p); C1XR.cam.aspect = innerWidth / innerHeight; C1XR.cam.updateProjectionMatrix(); }
  C1XR.board.m.visible = S.state === 'run' || S.state === 'pause' || S.state === 'result';
  if (S.brief && !window.C1_VRTEST) { C1XR.briefT = C1XR.briefT == null ? 8 : C1XR.briefT - dt; if (C1XR.briefT <= 0 && typeof BRIEF_GO === 'function' && BRIEF_GO) { BRIEF_GO(); C1XR.briefT = null; } } else C1XR.briefT = null;
  // 점검·구술 고르기: 오른쪽 스틱 위아래
  const st = c1Cur(); C1XR.selT -= dt;
  if (st && st.k === 'oral' && st.qs && C1XR.selT <= 0) { if (IN.pitch > 0.6) { C1XR.sel = (C1XR.sel + 3) % 4; C1XR.selT = 0.3; } else if (IN.pitch < -0.6) { C1XR.sel = (C1XR.sel + 1) % 4; C1XR.selT = 0.3; } }
  C1XR.t -= dt; if (C1XR.t > 0) return; C1XR.t = 0.2; c1BoardDraw();
}
function c1BoardDraw() {
  const B = C1XR.board, g = B.cv.getContext('2d'), W2 = B.cv.width, H2 = B.cv.height, st = c1Cur(), m = C1.M[C1.mi];
  g.clearRect(0, 0, W2, H2); g.fillStyle = 'rgba(10,14,20,.9)'; vrRR(g, 0, 0, W2, H2, 26); g.fill(); g.strokeStyle = '#c9a2ff'; g.lineWidth = 4; vrRR(g, 2, 2, W2 - 4, H2 - 4, 24); g.stroke();
  let y = 22; const line = (t, col, sz, wt) => { g.fillStyle = col || '#e8eef3'; g.font = `${wt || 600} ${sz || 30}px system-ui, sans-serif`; const ws = String(t).split(' '); let ln = ''; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > W2 - 56 && ln) { g.fillText(ln, 28, y); y += (sz || 30) * 1.25; ln = w; } else ln = tl; } if (ln) { g.fillText(ln, 28, y); y += (sz || 30) * 1.25; } };
  g.textBaseline = 'top';
  if (S.brief) {   // 브리핑: 고글 화면이 없으니 안내판에 (A·트리거로 시작 · 8초 뒤 자동 시작)
    const b = BRIEF[S.kind] || []; line('BRIEFING', '#4fe3ff', 26, 700); line(b[0] || '', '#fff', 32, 800); line(b[1] || '', '#e8eef3', 24); line(L2('A 버튼 또는 트리거 = 시작', 'A button or trigger = start') + (C1XR.briefT != null ? ` (${Math.max(0, Math.ceil(C1XR.briefT))})` : ''), '#5dff9a', 26, 700); return; }
  line((C1.exam ? L2('1종 모의평가', 'CLASS 1 · MOCK') : C1.demo ? L2('1종 시범비행', 'CLASS 1 · DEMO') : L2('1종 학습', 'CLASS 1 · LEARN')) + ' · ' + C1.mode.toUpperCase() + (C1.armed ? ' · ARMED' : ' · SAFE') + (C1.ref ? ' · ' + L2('기준', 'REF') + ' ' + C1.ref.toFixed(1) + ' m' : ''), '#c9a2ff', 24, 700);
  if (m) line(`${C1.mi + 1}. ${m.name}`, '#fff', 34, 800);
  if (st) line(st.lab, '#ffc828', 27);
  if (st && st.k === 'inspect' && st.open && !st.done) {
    const i = C1INS.findIndex(it => !st.ans[it.id]), it = C1INS[i];
    if (it) { const bad = st.fault === it.id; line(`${i + 1}/${C1INS.length} ${L2(it.ko, it.en)}: ${L2((bad ? it.bad : it.ok)[0], (bad ? it.bad : it.ok)[1])}`, '#fff', 28); line(L2('A = 정상 · X = 불량', 'A = OK · X = faulty'), '#7fd0ff', 26); }
  } else if (st && st.k === 'oral' && st.qs && !st.done) {
    const x = st.qs[st.qi], lang = window.SIM_LANG === 'en' ? 1 : 0; line(x.q.q[lang], '#fff', 27, 700);
    x.ord.forEach((ai, k) => line(`${k === C1XR.sel ? '▶ ' : '   '}${x.q.a[ai][lang]}`, k === C1XR.sel ? '#5dff9a' : '#cfd6da', 24));
    line(L2('오른쪽 스틱 위아래로 고르고 A', 'Right stick up/down, then A'), '#7fd0ff', 22);
  } else {
    if (st && st.call) { const c = L2(st.call.ko, st.call.en); line((st.callSaid ? '✓ ' : '📣 ') + (st.call.count ? (c ? c + ' → ' : '') + L2('정지. 하나…다섯', 'hold, one…five') : c), st.callSaid ? '#5dff9a' : '#7fd0ff', 24); }
    const M = c1M(), e = st && st.err; let r = `${L2('스키드', 'Skid')} ${M.alt.toFixed(1)} m · ${L2('기수', 'Hdg')} ${c1Wrap(M.hdg).toFixed(0)}°`;
    if (!C1.exam && e) { if (e.lat != null) r += ` · ${L2('위치', 'Pos')} ${e.lat.toFixed(1)}`; if (e.alt != null && st.k !== 'land' && st.k !== 'emg') r += ` · ${L2('고도', 'Ht')} ${(e.alt >= 0 ? '+' : '') + e.alt.toFixed(1)}`; if (st.k === 'hold') r += ` · ${L2('정지', 'Hold')} ${st.armedEval ? st.t.toFixed(1) : '–'}/${st.T}s`; }
    line(r, '#cfd6da', 24);
    if (st && st.k === 'rc') { const sn = st.seen || {}; line(['thr+', 'thr-', 'yaw-', 'yaw+', 'pitch+', 'pitch-', 'roll-', 'roll+'].map(k => (sn[k] ? '✓' : '·') + k.replace('thr', 'T').replace('yaw', 'R').replace('pitch', 'E').replace('roll', 'A')).join(' '), '#cfd6da', 22); }
  }
  const cap = $('c1cap'); if (cap && cap.classList.contains('on')) line(cap.textContent, '#ffd27a', 24);
  if (S.state === 'result') line(L2('결과는 웹 화면 · B 메뉴', 'Results on the web page · B menu'), '#fff', 26);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '500 20px system-ui, sans-serif'; g.fillText(L2('A 확인 · X 비상 · Y 모드 · R트리거 구호 · B 메뉴', 'A ok · X emergency · Y mode · R-trigger call · B menu'), 28, H2 - 58);
  g.fillText(C1DISC(), 28, H2 - 32);
  B.tex.needsUpdate = true;
}

c1Place();
if (window.__sim) Object.assign(window.__sim, { WIND, C1, C1P, C1RULES, C1PT, C1EV, C1S, c1Key, c1M, c1W, C1V, C1XR, c1XRUpdate, c1InspectAuto, c1OralAuto, c1CallDo, c1Heard, C1INS, C1Q, c1UV, c1Jump, c1Cur, c1SkidOnPad, c1CenterOnPad, c1Wrap, c1Log, c1Build, c1Flow, getDroneM: () => droneM, getFLANE: () => (typeof FLANE !== 'undefined' ? FLANE : null), AF, AF_IDS, MS_OK, TOUCH, isC1 });
