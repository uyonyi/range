// ---- 진행 ----
function c1Start(a) {
  c1Site(); C1G.visible = true; C1ON = !C1S.real; if (C1.hidObj) C1.hidObj.forEach(g => { g.visible = false; });   // msStart 가 다시 켠 코스 시설물 재숨김
  Object.assign(C1, { on: true, exam: S.kind === 'class1x', demo: S.kind === 'class1d', dm: null, sayUntil: 0, mode: 'gps', view: 'pilot', armed: false, ref: null, refDesc: null, mi: 0, si: 0, ev: [], t: 0, az: 0, yr: 0, hold: null, touch: null, crash: null, over: false, tArm: null, altT: null, modeLog: [] });
  C1.ei.set(0, 0, 0);
  C1.side = SET.c1side === 1 ? 1 : -1;
  C1.M = c1Build(C1.side);
  C1.M.forEach(m => { m.done = false; m.miss = false; m.fail = false; m.why = []; m.label = m.name; m.steps.forEach(s => { s.T = s.T || c1R('hoverT'); }); });
  S.cam = 1; ui.map.style.display = 'none'; document.body.classList.add('c1on');
  c1Panel(true); c1ALoad(); c1Sun(); if ((typeof XR_ON !== 'undefined' && XR_ON) || window.C1_VRTEST) c1XRInit();
  c1Ev('start', { exam: C1.exam, side: C1.side < 0 ? 'left-first' : 'right-first', profile: C1P.ver, rules: C1RULES.ver, wind: WIND.lv });
  return C1.M;
}
function c1StartPose() { return { p: c1W(C1PT.H[0], C1PT.H[1], c1p('skidDrop')), h: C1S.h }; }
// 단계 충족 표시: 안내창에 ✓ 와 짧은 알림음 (모의평가에서도)
function c1OkFlash(st) {
  if (!st || ['ann', 'oral', 'inspect'].includes(st.k)) return;
  const bad = st.fails && st.fails.length; C1.ok = { text: (bad ? '✗ ' : '✓ ') + st.lab.split(' · ')[0].split(' (')[0], bad: !!bad, t: 2.2 };
  try { if (AU.ctx && !TEST) { const o = AU.ctx.createOscillator(), g = AU.ctx.createGain(); o.frequency.value = bad ? 330 : 880; g.gain.setValueAtTime(0.0001, AU.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, AU.ctx.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, AU.ctx.currentTime + 0.18); o.connect(g); g.connect(AU.master || AU.ctx.destination); o.start(); o.stop(AU.ctx.currentTime + 0.2); } } catch (e) { }
}
function c1Count(x) {
  if (!x || !x.call || !x.call.count || x.callSaid !== 'btn' || x.arrT == null) return;
  if (!x.stopSaid) { x.stopSaid = true; c1Say(L2('정지.', 'Hold.'), 'me'); return; }
  const n = Math.min(5, Math.floor(C1.t - x.arrT + 1e-6)); if (n > (x.cnt || 0)) { x.cnt = n; c1Say(L2(['하나', '둘', '셋', '넷', '다섯'], ['one', 'two', 'three', 'four', 'five'])[n - 1], 'me'); }
}
function c1Next() {
  const m = C1.M[C1.mi]; if (!m) return;
  C1.si++; c1Ev('stepDone');
  if (C1.si >= m.steps.length) {
    m.done = true; m.miss = !!m.fail; C1.si = 0; C1.mi++; MS.idx = C1.mi;
    sfx(m.fail ? 'bad' : 'good'); if (!C1.exam || m.unrated) showMsg(m.name + (m.unrated ? ' · ' + L2('교관 확인', 'instructor check') : m.fail ? ' · U' : ' · S'), m.fail ? '#ff9a40' : '#5dff9a', 1.4);
    renderList();
    if (C1.mi >= C1.M.length) { c1Finish('done'); return; }
    const nm = C1.M[C1.mi]; if (nm.needMode) nm.tStart = C1.t;
  }
  const st = c1Cur(); if (st) { st.t0 = C1.t; if (st.k === 'prep' || st.k === 'disarm' || st.k === 'arm' || st.k === 'callout') st.wait = true; }
}
function c1Cur() { const m = C1.M[C1.mi]; return m ? m.steps[C1.si] : null; }
function c1Step(prev, cur, dt) {
  if (!C1.on || C1.over) return;
  C1.t += dt;
  const m = C1.M[C1.mi], st = c1Cur(); if (!m || !st) return;
  if (C1.crash) {
    const c = C1.crash; C1.crash = null; c1Fail(st, 'crash', c); sfx('crash'); shake = 0.08;
    if (C1.exam) { c1Finish('crash'); return; }
    showMsg(L2('충돌 · 이 기동을 처음부터', 'Crash · restart this manoeuvre'), '#ff5050', 1.8); c1Jump(C1.mi, true); return;
  }
  const M = c1M();
  // 종합: 안전거리 14 m · 안전라인 (조종자 앞쪽 기준선 뒤로 오면 침범)
  if (!DR.landed && (Math.hypot(M.u, M.v) < c1R('safeR') || M.v < 0.6)) { C1.safeT = (C1.safeT || 0) + dt; if (C1.safeT > 0.5 && !C1.safeLogged) { C1.safeLogged = true; c1Ev('safe', { u: +M.u.toFixed(1), v: +M.v.toFixed(1) }); C1.safeBad = true; if (!C1.exam) showMsg(c1WhyTxt('safe'), '#ff5050', 1.4); } } else { C1.safeT = 0; C1.safeLogged = false; }
  // 정상접근: 모든 세부 기동을 자세·수동 모드로 (모드 전환 단계 이후)
  if (m.needMode && C1.si > m.steps.findIndex(x => x.k === 'mode') && C1.mode === 'gps' && !st.fails?.includes('mode')) c1Fail(st, 'mode');
  const fn = C1EV[st.k], done = fn && fn(st, M, dt);
  // 버튼으로 정지 구호를 했으면 정지 지점 도착 때 "정지", 그 뒤 1초마다 "하나…다섯" (단계가 먼저 끝나도 다섯까지, 움직이면 멈춤)
  if (st.call && st.call.count && st.armedEval) { if (st.arrT == null || C1.t - st.arrT > st.t + 0.6) { st.arrT = C1.t - st.t; st.cnt = Math.floor(st.t); } }
  c1Count(st); if (C1V.cst && C1V.cst !== st) { if (M.hs > 0.6 || (C1V.cst.cnt || 0) >= 5 || C1.t - C1V.cst.arrT > 6.5) C1V.cst = null; else c1Count(C1V.cst); }
  // 구호(기기 음성)가 아직 나오는 중이면 끝날 때까지 다음 단계로 넘어가지 않음 (직접 말한 구호는 바로)
  if (done && st.callSaid && st.callSaid !== 'voice' && C1.t < (C1.meUntil || 0) - 0.15 && !st.call.count) { st.waitSay = true; return; }
  if (done) { st.waitSay = false; if (st.call && st.call.count && st.arrT != null && (st.cnt || 0) < 5) C1V.cst = st; if (st.call && st.call.after && st.callSaid === 'btn') c1Say(L2(st.call.after[0], st.call.after[1]), 'me'); c1OkFlash(st); c1Next(); }
}
let _c1dk = false;
function fromDemo(k) { return _c1dk || ['KeyC', 'PadRB', 'KeyZ', 'KeyR'].includes(k) || /^Digit[1-9]$/.test(k); }
function c1DK(k) { _c1dk = true; try { c1Key(k); } finally { _c1dk = false; } }
function c1Key(k, fromVoice) {
  if (!isC1() || S.state !== 'run') return false;
  const st = c1Cur();
  if (C1.demo && !fromDemo(k)) return !['Escape', 'KeyP', 'KeyM', 'Tab', 'KeyF'].includes(k);   // 시범비행: 시점·시야·건너뛰기만 사용자 입력
  if (k === 'KeyY') { c1Mode(); return true; }
  if (k === 'KeyH' || k === 'KeyG') { c1GpsToggle(); return true; }   // GPS 스위치 (보조 버튼·H 키)
  if (st && st.k === 'inspect' && st.open && !st.done && (XR_ON || window.C1_VRTEST) && (k === 'Enter' || k === 'KeyE' || k === 'Space')) {   // VR: 항목마다 A 정상 / X 불량
    const it = C1INS.find(x => !st.ans[x.id]); if (it) { st.ans[it.id] = k === 'KeyE' ? 'bad' : 'ok'; sfx('good'); } if (C1INS.every(x => st.ans[x.id])) c1InspectDone(st); return true; }
  if (st && st.k === 'oral' && st.qs && !st.done && (XR_ON || window.C1_VRTEST) && k === 'Enter') { c1OralAns(st, st.qs[st.qi].ord[C1XR.sel]); C1XR.sel = 0; return true; }
  if (k === 'KeyQ') { if (!c1CallDo('btn') && st && st.call && !C1.exam) showMsg(L2('이 단계 구호는 이미 했습니다', 'Call already made for this step'), '#9aa6ad', 1); return true; }
  if (k === 'KeyE') { if (st && st.k === 'callout' && !st.wait2) { st.wait2 = true; c1CallDo(fromVoice ? 'voice' : 'btn'); c1Ev('callout'); showMsg(L2('"비상!"', '"EMERGENCY!"'), '#ff5050', 1.2); sfx('bad'); c1Next(); const n = c1Cur(); if (n) n.t0 = C1.t; } return true; }
  if (k === 'KeyZ') { const L = [1, 1.3, 0.8], i = (L.indexOf(SET.c1zoom || 1) + 1) % 3; SET.c1zoom = L[i]; saveSet(); showMsg(L2('조종자 시야 ', 'Pilot view ') + [L2('기본', 'normal'), L2('넓게', 'wide'), L2('좁게 (확대)', 'narrow (zoom in)')][i], '#fff', 0.9); return true; }
  if (k === 'KeyC' || k === 'PadRB') { if (!C1.exam) { C1.view = C1.view === 'pilot' ? 'chase' : 'pilot'; showMsg(C1.view === 'pilot' ? L2('조종자 시점', 'Pilot view') : L2('추적 시점 (학습용)', 'Chase view (learning)'), '#4fe3ff', 1); } else showMsg(L2('모의평가는 조종자 시점만', 'Mock check uses the pilot view only'), '#ffc828', 1); return true; }
  if (k === 'Enter' || k === 'Space' || k === 'PadA') { c1Confirm(); return true; }
  if (k === 'KeyR' || k === 'PadY') { if (!C1.exam) { c1Jump(C1.mi, true); showMsg(L2('이 기동 다시', 'Restart this manoeuvre'), '#c9a2ff', 1); } return true; }
  if (k === 'KeyN') { if (!C1.exam) { c1Ev('skipStep'); const m = C1.M[C1.mi]; if (m) m.skipped = true; c1Next(); } return true; }
  if (/^Digit[1-9]$/.test(k) && !C1.exam) { c1Jump(+k.slice(5)); return true; }
  return false;
}
let _c1conf = false;
function c1Confirm() { if (_c1conf) return; _c1conf = true; try { c1Confirm0(); } finally { _c1conf = false; } }
function c1Confirm0() {
  const st = c1Cur(); if (!st) return;
  if (st.k === 'prep') { if (st.call) c1CallDo('btn'); c1Ev('confirm'); c1Next(); }
  else if (st.k === 'arm') { if (DR.landed) { c1Arm('btn'); c1Next(); } }
  else if (st.k === 'disarm') { if (DR.landed && Math.hypot(DR.v.x, DR.v.z) < 0.3) { C1.armed = false; if (st.call) c1CallDo('btn'); c1Ev('disarm'); c1Next(); } else showMsg(L2('착지 후 시동 종료', 'Land first, then shut down'), '#ffc828', 1); }
}
function c1GpsToggle() {
  C1.mode = C1.mode === 'gps' ? 'atti' : 'gps'; C1.hold = null; C1.altT = null; C1.ei.set(0, 0, 0);
  c1Ev('mode', { mode: C1.mode, by: 'gpsSwitch' }); showMsg(c1ModeName(), C1.mode === 'gps' ? '#5dff9a' : '#ffb030', 1.4); sfx('good');
}
function c1Mode() {
  const L = ['gps', 'atti', 'manual']; C1.mode = L[(L.indexOf(C1.mode) + 1) % 3]; C1.hold = null; C1.altT = null; C1.ei.set(0, 0, 0);
  c1Ev('mode', { mode: C1.mode }); showMsg(c1ModeName(), '#c9a2ff', 1.2);
}
function c1ModeName() { return { gps: L2('GPS 모드 (위치·고도 유지)', 'GPS mode (position + height hold)'), atti: L2('자세제어 ATTI (고도 유지 · 위치 유지 없음)', 'ATTI (height hold · no position hold)'), manual: L2('수동 (고도 유지 없음)', 'Manual (no height hold)') }[C1.mode]; }
// ---- 공간 가이드 (학습·시범): 3D 목표 기체(반투명) · 기체 아래 수직선 · 위에서 본 위치 게이지 ----
function c1Aid3D(st) {
  const G0 = C1G; if (!G0) return;
  if (!C1.ghost) {
    const gm = makeC1(true); C1.ghost = gm.g; C1.ghost.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.opacity = 0.32; o.material.color && o.material.color.set(0x7fe0ff); } o.castShadow = false; }); G0.add(C1.ghost);
    C1.dropV = new Float32Array(6); C1.poleV = new Float32Array(6);
    C1.drop = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(C1.dropV, 3)), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.75 })); C1.drop.frustumCulled = false; G0.add(C1.drop);
    C1.dropRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })); C1.dropRing.rotation.x = -Math.PI / 2; G0.add(C1.dropRing);
    C1.tgtRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })); C1.tgtRing.rotation.x = -Math.PI / 2; G0.add(C1.tgtRing);
    C1.tgtPole = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(C1.poleV, 3)), new THREE.LineBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.8 })); C1.tgtPole.frustumCulled = false; G0.add(C1.tgtPole);
  }
  const air = st && !DR.landed && C1.armed, sd = c1p('skidDrop');
  C1.drop.visible = C1.dropRing.visible = !!air;
  if (air) { const gy = c1Gnd() + 0.03, D = C1.dropV; D[0] = DR.p.x; D[1] = DR.p.y; D[2] = DR.p.z; D[3] = DR.p.x; D[4] = gy; D[5] = DR.p.z; C1.drop.geometry.attributes.position.needsUpdate = true;
    const ld = C1.drop.geometry.attributes.lineDistance || (C1.drop.geometry.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(2), 1)), C1.drop.geometry.attributes.lineDistance); ld.array[1] = DR.p.y - gy; ld.needsUpdate = true; C1.dropRing.position.set(DR.p.x, gy, DR.p.z); }
  const T = st && c1Tgt(st);
  C1.ghost.visible = C1.tgtRing.visible = C1.tgtPole.visible = !!T;
  if (!T) return;
  const p = c1W(T.u, T.v, T.alt + sd); C1.ghost.position.copy(p); C1.ghost.rotation.set(0, -(C1S.h + (T.hdg || 0) * DEG), 0);
  const gp = c1W(T.u, T.v, 0.04); C1.tgtRing.position.copy(gp); const r = st.alongTol ? 1 : c1R('posTol'); C1.tgtRing.scale.set(r, r, 1);
  { const V = C1.poleV; V[0] = gp.x; V[1] = gp.y; V[2] = gp.z; V[3] = p.x; V[4] = p.y; V[5] = p.z; C1.tgtPole.geometry.attributes.position.needsUpdate = true; }
}
// 지금 단계의 목표 (u, v, 고도, 기수) — 없으면 null
function c1Tgt(st) {
  const ref = C1.ref || 4;
  if (st.k === 'hold') return { u: st.at[0], v: st.at[1], alt: st.altWin ? ref + st.altWin[0] + 0.5 : c1AltTgt(st), hdg: st.hdg };
  if (st.k === 'climb') return { u: st.at[0], v: st.at[1], alt: 4, hdg: 0 };
  if (st.k === 'xfer') return { u: st.to[0], v: st.to[1], alt: ref, hdg: 0 };
  if (st.k === 'move') return { u: st.to[0], v: st.to[1], alt: ref + (st.r1 || 0), hdg: st.hdg };
  if (st.k === 'land' || st.k === 'emg') return { u: st.pad[0], v: st.pad[1], alt: 0, hdg: st.hdg || 0 };
  if (st.k === 'arc') return { u: st.start[0], v: st.start[1], alt: ref, hdg: null };
  return null;
}
function c1Gauge(st, M) {
  let cv = $('c1g'); if (!cv) { cv = document.createElement('canvas'); cv.id = 'c1g'; document.body.appendChild(cv); }
  const show = !!st && !C1.exam && !(typeof XR_ON !== 'undefined' && XR_ON) && S.state !== 'menu' && ['climb', 'hold', 'move', 'arc', 'emg', 'land', 'xfer'].includes(st.k) && !C1.over;
  cv.classList.toggle('hidden', !show); if (!show) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const small = W < 200, fs = small ? 9 : 11, foot = small ? 13 : 18, SZ = H - foot - 6, cx = 4 + SZ / 2, cy = 4 + SZ / 2, Rr = SZ / 2 - 2;
  const ref = C1.ref || 4, T = c1Tgt(st), pT = c1R('posTol'), aT = c1R('altTol');
  // 기준점: 이동·원주는 경로 위 가장 가까운 점, 나머지는 목표점
  let c = [T.u, T.v], span, dist = Math.hypot(M.u - T.u, M.v - T.v), info = '';
  if (st.k === 'move') { const a = st.from, b = st.to, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), al = clamp(((M.u - a[0]) * dx + (M.v - a[1]) * dy) / L, 0, L); c = [a[0] + dx / L * al, a[1] + dy / L * al]; span = 4; info = `${L2('남은', 'to go')} ${Math.max(0, L - al).toFixed(1)} m`; }
  else if (st.k === 'arc') { const du = M.u - st.c[0], dv = M.v - st.c[1], r = Math.hypot(du, dv) || 1; c = [st.c[0] + du / r * st.R, st.c[1] + dv / r * st.R]; span = 4; info = `◯ ${Math.min(360, Math.round(st.sweep || 0))}°`; }
  else { span = clamp(dist * 1.35, 2.4, 30); info = `${L2('목표까지', 'to target')} ${dist.toFixed(1)} m`; }
  const X = u => cx + (u - c[0]) / span * Rr, Y = v => cy - (v - c[1]) / span * Rr;
  g.save(); g.beginPath(); g.arc(cx, cy, Rr, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(40,70,40,.55)'; g.fillRect(cx - Rr, cy - Rr, Rr * 2, Rr * 2);
  // 1 m · 5 m 눈금 원
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.setLineDash([3, 3]);
  for (const k of [1, 2, 5, 10, 20]) { const rr = k / span * Rr; if (rr > 8 && rr < Rr * 0.98) { g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke(); } }
  g.setLineDash([]);
  // 경로·허용범위
  g.fillStyle = 'rgba(93,255,154,.18)'; g.strokeStyle = 'rgba(93,255,154,.85)'; g.lineWidth = 1.5;
  if (st.k === 'move') { const a = st.from, b = st.to, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * pT, ny = dx / L * pT;
    g.beginPath(); g.moveTo(X(a[0] + nx), Y(a[1] + ny)); g.lineTo(X(b[0] + nx), Y(b[1] + ny)); g.lineTo(X(b[0] - nx), Y(b[1] - ny)); g.lineTo(X(a[0] - nx), Y(a[1] - ny)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(79,227,255,.9)'; g.beginPath(); g.moveTo(X(a[0]), Y(a[1])); g.lineTo(X(b[0]), Y(b[1])); g.stroke(); }
  else if (st.k === 'arc') { g.lineWidth = 2 * pT / span * Rr; g.strokeStyle = 'rgba(93,255,154,.22)'; g.beginPath(); g.arc(X(st.c[0]), Y(st.c[1]), st.R / span * Rr, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(79,227,255,.9)'; g.beginPath(); g.arc(X(st.c[0]), Y(st.c[1]), st.R / span * Rr, 0, Math.PI * 2); g.stroke(); }
  if (st.k !== 'arc') { const tx = X(T.u), ty = Y(T.v);
    if (st.alongTol) { const w = pT / span * Rr, h = st.alongTol / span * Rr; g.fillRect(tx - w, ty - h, w * 2, h * 2); g.strokeRect(tx - w, ty - h, w * 2, h * 2); }
    else { const rr = (st.k === 'emg' ? 1.5 : pT) / span * Rr; g.beginPath(); g.arc(tx, ty, rr, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.strokeStyle = '#5dff9a'; g.beginPath(); g.moveTo(tx - 5, ty); g.lineTo(tx + 5, ty); g.moveTo(tx, ty - 5); g.lineTo(tx, ty + 5); g.stroke(); }
  // 지나온 길
  const tr = C1.gtr || (C1.gtr = []); tr.push([M.u, M.v]); if (tr.length > 60) tr.shift();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); tr.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.stroke();
  // 기체 (삼각형 = 기수 방향)
  const off = st.k === 'move' || st.k === 'arc' ? Math.hypot(M.u - c[0], M.v - c[1]) : dist, ratio = off / (st.k === 'emg' ? 1.5 : pT);
  const col = ratio < 0.5 ? '#7dffa8' : ratio < 1 ? '#ffd166' : '#ff7a6a', th = M.hdg * DEG, fx = Math.sin(th), fy = -Math.cos(th);
  let dx = X(M.u), dy = Y(M.v); const outR = Math.hypot(dx - cx, dy - cy) > Rr - 6; if (outR) { const k = (Rr - 8) / Math.hypot(dx - cx, dy - cy); dx = cx + (dx - cx) * k; dy = cy + (dy - cy) * k; }
  g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.moveTo(dx + fx * 9, dy + fy * 9); g.lineTo(dx - fx * 6 + fy * 6, dy - fy * 6 - fx * 6); g.lineTo(dx - fx * 6 - fy * 6, dy - fy * 6 + fx * 6); g.closePath(); g.fill(); g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(cx, cy, Rr, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `${fs}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText(L2('먼 쪽', 'far'), cx, 4 + fs); g.fillText(L2('조종자', 'pilot'), cx, cy + Rr - 3);
  // 고도 막대
  const bx = 4 + SZ + (small ? 8 : 14), bw = small ? 12 : 16, top = 8 + fs, bot = 4 + SZ, tgtA = st.k === 'climb' ? 4 : T.alt, hmax = Math.max(8, tgtA + 3, M.alt + 1), yA = a => bot - clamp(a, 0, hmax) / hmax * (bot - top);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(bx, top, bw, bot - top);
  const band = st.k === 'climb' ? [c1R('refMin'), c1R('refMax')] : st.altWin ? [ref + st.altWin[0], ref + st.altWin[1]] : (st.k === 'land' || st.k === 'emg') ? null : [tgtA - aT, tgtA + aT];
  if (band) { g.fillStyle = 'rgba(93,255,154,.45)'; g.fillRect(bx, yA(band[1]), bw, yA(band[0]) - yA(band[1])); }
  const aOk = !band || (M.alt >= band[0] && M.alt <= band[1]); g.fillStyle = aOk ? '#7dffa8' : '#ffd166';
  const ay = yA(M.alt); g.beginPath(); g.moveTo(bx + bw + 7, ay - 5); g.lineTo(bx + bw + 1, ay); g.lineTo(bx + bw + 7, ay + 5); g.fill(); g.fillRect(bx - 2, ay - 1, bw + 4, 2);
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(M.alt.toFixed(1) + 'm', bx + bw + 9, ay + 4);
  g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(L2('고도', 'alt'), bx - 2, 4 + fs);
  // 아래 글: 목표까지 · 기수
  const he = T.hdg == null ? null : c1Wrap(T.hdg - M.hdg);
  g.font = `${small ? 10 : 12}px system-ui,sans-serif`; g.textAlign = 'left'; g.fillStyle = col; g.fillText(info, 6, H - 5);
  if (he != null) { g.textAlign = 'right'; g.fillStyle = Math.abs(he) <= c1R('hdgTol') * 0.5 ? '#7dffa8' : Math.abs(he) <= c1R('hdgTol') ? '#ffd166' : '#ff7a6a'; g.fillText(Math.abs(he) < 1 ? `${L2('기수', 'nose')} 0°` : `${L2('기수', 'nose')} ${Math.round(Math.abs(he))}° ${he > 0 ? L2('좌', 'L') : L2('우', 'R')}`, W - 6, H - 5); }
}
// ---- 연습 코치: 지금 무엇을 얼마나 고치면 되는지 (모드2 스틱 기준 · 기체 기준 방향) ----
function c1Coach(st, M) {
  const out = [], th = M.hdg * DEG, F = [Math.sin(th), Math.cos(th)], Rt = [Math.cos(th), -Math.sin(th)], wrap = c1Wrap;
  const ref = C1.ref || 4, pT = c1R('posTol'), aT = c1R('altTol'), hT = st.k === 'emg' ? c1R('hdgTolEmg') : c1R('hdgTol');
  const f1 = x => Math.abs(x).toFixed(Math.abs(x) < 10 ? 1 : 0);
  const lv = r => r < 0.5 ? 'cg' : r < 1 ? 'cy' : 'cr';
  const add = (ratio, html) => out.push({ ratio, html: `<div class="${lv(ratio)}">${html}</div>` });
  const side = Math.abs(wrap(M.hdg)) > 45 ? ` <i>(${L2('기체 기준', 'from the aircraft')})</i>` : '';
  // 위치: 목표점까지 차이를 기체 앞/옆으로 나눠 스틱으로
  const pos = (du, dv, tol, what) => {
    const fw = du * F[0] + dv * F[1], rt = du * Rt[0] + dv * Rt[1], d = Math.hypot(du, dv); if (d < 0.12) return;
    const parts = [];
    if (Math.abs(fw) >= 0.12) parts.push(fw > 0 ? L2(`엘리베이터 ↑ 앞으로 ${f1(fw)} m`, `elevator ↑ forward ${f1(fw)} m`) : L2(`엘리베이터 ↓ 뒤로 ${f1(fw)} m`, `elevator ↓ back ${f1(fw)} m`));
    if (Math.abs(rt) >= 0.12) parts.push(rt > 0 ? L2(`에일러론 → 오른쪽 ${f1(rt)} m`, `aileron → right ${f1(rt)} m`) : L2(`에일러론 ← 왼쪽 ${f1(rt)} m`, `aileron ← left ${f1(rt)} m`));
    add(d / tol, `${what || L2('위치', 'Position')} <b>${d.toFixed(1)} m</b> ${L2('벗어남', 'off')} → ${parts.join(' · ')}${side}`);
  };
  const alt = (tgt, tol) => { const e = tgt - M.alt; if (Math.abs(e) < 0.08) return; add(Math.abs(e) / tol, `${L2('고도', 'Height')} <b>${f1(e)} m ${e > 0 ? L2('낮음', 'low') : L2('높음', 'high')}</b> → ${e > 0 ? L2('스로틀 ↑ 살짝', 'throttle ↑ a little') : L2('스로틀 ↓ 살짝', 'throttle ↓ a little')} <i>(${L2('목표', 'target')} ${tgt.toFixed(1)} m ±${tol})</i>`); };
  const hdg = (tgt, tol) => { const e = wrap(tgt - M.hdg); if (Math.abs(e) < 3) return; add(Math.abs(e) / tol, `${L2('기수가', 'Nose')} <b>${f1(e)}° ${e > 0 ? L2('왼쪽으로', 'left') : L2('오른쪽으로', 'right')}</b> ${L2('틀어짐', 'of target')} → ${e > 0 ? L2('러더 → (오른쪽으로)', 'rudder → (right)') : L2('러더 ← (왼쪽으로)', 'rudder ← (left)')} <i>(±${tol}°)</i>`); };
  const good = t => `<div class="cg">✓ ${t}</div>`;
  let lead = '';
  if (st.k === 'climb') {
    const lo = c1R('refMin'), hi = c1R('refMax');
    if (M.alt < lo - aT) { lead = M.vy < 0.2 && M.alt > 0.6 ? `<div class="cr">⚠ ${L2('상승이 멈췄어요 — 기준고도(3~5 m)까지 한 번에 올리기', 'Climb stalled — go up to 3–5 m in one go')}</div>` : `<div class="cy">⬆ ${L2('스로틀 ↑ 로 3~5 m 까지 멈추지 말고 상승', 'Throttle ↑ — climb to 3–5 m without stopping')} <i>(${L2('지금', 'now')} ${M.alt.toFixed(1)} m)</i></div>`; }
    else if (M.alt > hi + aT) lead = `<div class="cr">⬇ ${L2('5 m 넘음 → 스로틀 ↓ 로 범위 안으로', 'Above 5 m → throttle ↓ back into range')}</div>`;
    else lead = good(L2('기준고도 범위 안 — 스로틀 중립으로 멈추면 이 높이가 기준고도가 됩니다', 'In range — centre the throttle; this height becomes your reference'));
    pos(st.at[0] - M.u, st.at[1] - M.v, pT); hdg(0, hT);
  } else if (st.k === 'hold') {
    const du = st.at[0] - M.u, dv = st.at[1] - M.v, d = Math.hypot(du, dv);
    if (!st.armedEval && d > 1.5) lead = `<div class="cy">➜ ${L2('목표 지점까지', 'To the point')} <b>${d.toFixed(1)} m</b> — ${L2('2 m 전부터 천천히 감속', 'ease off from 2 m out')}</div>`;
    else if (st.armedEval) { const left = Math.max(0, st.T - st.t); lead = left > 0 ? `<div class="cg">⏱ ${L2('정지 중', 'Holding')} ${st.t.toFixed(1)} / ${st.T} s — ${L2('스틱은 중립, 아주 작은 수정만', 'sticks centred, tiny corrections only')}</div>` : good(L2('정지 완료', 'Hold complete')); }
    if (st.altWin) { const lo = ref + st.altWin[0], hi = ref + st.altWin[1]; if (M.alt < lo) add((lo - M.alt) / aT, `${L2('고도', 'Height')} <b>${(lo - M.alt).toFixed(1)} m ${L2('더 올리기', 'more')}</b> → ${L2('스로틀 ↑', 'throttle ↑')} <i>(${L2('기준+2 m 이상', 'ref +2 m or more')})</i>`); else if (M.alt > hi) alt(hi, aT); }
    else alt(c1AltTgt(st), aT);
    pos(du, dv, st.posWatch === 'xy' ? pT : pT); hdg(st.hdg, hT);
  } else if (st.k === 'move') {
    const a = st.from, b = st.to, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const al = (M.u - a[0]) * ux + (M.v - a[1]) * uy, cr = -(M.u - a[0]) * uy + (M.v - a[1]) * ux, sp = clamp(al / L, 0, 1);
    const vAl = DR.v.x * (Math.cos(C1S.h) * ux + Math.sin(C1S.h) * uy) + DR.v.z * (Math.sin(C1S.h) * ux - Math.cos(C1S.h) * uy);
    const pc = Math.round(sp * 100), rem = Math.max(0, L - al);
    if (st.alongTol && Math.abs(al - L) <= st.alongTol) lead = `<div class="cg">✓ ${L2('E 인정 범위(전후 ±5 m) 안 — 여기서 멈추면 정지로 넘어갑니다', 'Inside the E zone (±5 m) — stop here to start the hold')} <i>(E ${al - L >= 0 ? '+' : ''}${(al - L).toFixed(1)} m)</i></div>`;
    else if (sp > 0.06 && sp < 0.94 && Math.abs(vAl) < c1R('stopV') + 0.1) lead = `<div class="cr">⚠ ${L2('멈추면 감점 — 같은 속도로 계속 이동', 'Stopping costs points — keep moving at the same speed')}</div>`;
    else if (vAl > 2.6) lead = `<div class="cy">🐢 ${L2('조금 천천히 — 지나치기 쉬워요', 'A bit slower — easy to overshoot')} <i>(${vAl.toFixed(1)} m/s)</i></div>`;
    else lead = `<div class="cg">➜ ${pc}% · ${L2('남은 거리', 'to go')} ${rem.toFixed(1)} m · ${Math.max(0, vAl).toFixed(1)} m/s${rem < 3 && rem > 0.3 ? ' — ' + L2('감속 준비', 'start easing off') : ''}</div>`;
    // 경로 옆으로 벗어남 (기체 기준 좌우/앞뒤로 바꿔 안내)
    const pu = -uy * cr, pv = ux * cr; pos(-pu, -pv, pT, L2('경로에서', 'Off the line by'));
    alt(ref + (st.r0 || 0) + ((st.r1 || 0) - (st.r0 || 0)) * clamp(al / L, 0, 1), aT); hdg(st.hdg, hT);
  } else if (st.k === 'arc') {
    const du = M.u - st.c[0], dv = M.v - st.c[1], r = Math.hypot(du, dv), e = r - st.R, sw = Math.round(st.sweep || 0);
    lead = `<div class="cg">◯ ${Math.min(360, sw)}° / 360° · ${L2('반경', 'radius')} ${r.toFixed(1)} m (${st.R} m)</div>`;
    if (Math.abs(e) > 0.12) pos(-du / r * e, -dv / r * e, pT, e > 0 ? L2('원 바깥으로', 'Outside the circle') : L2('원 안쪽으로', 'Inside the circle'));
    const tang = c1Wrap(Math.atan2(du, dv) / DEG + 90 * (st.dir < 0 ? 1 : -1)); hdg(tang, hT); alt(ref, aT);
    if (M.hs < 0.35 && sw > 10 && sw < 340) lead = `<div class="cr">⚠ ${L2('원주 중간에 멈추지 않기 — 에일러론+러더를 함께 계속', 'Don\'t stop mid-circle — keep aileron and rudder going together')}</div>`;
  } else if (st.k === 'emg') {
    const need = Math.max(c1R('emgRefDefault'), C1.refDesc || 0) * c1R('emgRatio'), vs = -M.vy;
    lead = M.alt > 0.3 ? `<div class="${vs >= need ? 'cg' : 'cr'}">⬇ ${L2('하강', 'Descent')} <b>${Math.max(0, vs).toFixed(1)} m/s</b> ${vs >= need ? '✓' : '— ' + L2('더 빠르게 (스로틀 ↓ 크게)', 'faster (throttle ↓ more)')} <i>(${L2('필요', 'need')} ≥ ${need.toFixed(1)} m/s)</i></div>` : '';
    pos(st.pad[0] - M.u, st.pad[1] - M.v, 2.5, L2('비상 착륙장(F)까지', 'To the emergency pad (F)'));
  } else if (st.k === 'land') {
    const du = st.pad[0] - M.u, dv = st.pad[1] - M.v, d = Math.hypot(du, dv);
    lead = d > 0.4 ? `<div class="cy">⬇ ${L2('먼저 패드 중앙 위로 맞추고 내려오기', 'Line up over the pad centre first, then descend')}</div>` : M.alt > 1 ? `<div class="cg">⬇ ${L2('천천히 강하', 'Descend slowly')} <i>(${M.alt.toFixed(1)} m)</i></div>` : `<div class="cg">⬇ ${L2('1 m 아래 — 아주 천천히, 접지하면 스로틀 끝까지 ↓', 'Below 1 m — very gently; on touchdown throttle fully ↓')}</div>`;
    pos(du, dv, pT, L2('패드 중심에서', 'From the pad centre')); hdg(st.hdg, hT);
  } else if (st.k === 'xfer') {
    const du = st.to[0] - M.u, dv = st.to[1] - M.v; lead = `<div class="cg">➜ ${L2('다음 위치로 이동 (평가 제외)', 'Move to the next position (not scored)')} · ${Math.hypot(du, dv).toFixed(1)} m</div>`;
  } else if (st.k === 'arm' && st.csc && !C1.armed) lead = `<div class="cy">🔑 ${L2('두 스틱을 아래·안쪽으로 0.5초 (또는 다음 ▶)', 'Both sticks down-and-in for 0.5 s (or NEXT ▶)')}</div>`;
  else if (st.k === 'mode') lead = `<div class="cy">🔀 ${st.gps ? L2('GPS 스위치 ON (H 또는 GPS 버튼)', 'GPS switch ON (H or the GPS button)') : L2('GPS 스위치 OFF → ATTI (H 또는 GPS 버튼) · 이제 바람에 흐르는 것을 직접 잡아야 함', 'GPS switch OFF → ATTI (H or the GPS button) · you now correct drift yourself')}</div>`;
  else if (st.k === 'callout') lead = `<div class="cr">📣 ${L2('"비상!" 외치기 (🚨 비상 버튼 또는 E)', 'Call "Emergency!" (🚨 button or E)')}</div>`;
  if (!lead && !out.length) return '';
  out.sort((x, y) => y.ratio - x.ratio);
  const fixes = out.filter(o => o.ratio >= 0.3).slice(0, 3).map(o => o.html).join('');
  const ok = (['hold', 'move', 'arc', 'land', 'climb'].includes(st.k) && !fixes) ? good(L2('위치·고도·기수 모두 허용범위 안 — 그대로 유지', 'Position, height and heading all in limits — hold it')) : '';
  return lead + fixes + ok;
}
// ---- 시범비행: 자동 조종이 시험 순서대로 비행 (구호·정지 세기·관전 포인트 안내) ----
const C1TIP = {
  pre: ['호명 → 기체 점검 구호 → 조종기 점검(스틱 끝까지) 구호 → 공역·풍향·풍속 확인 구호. 구호를 외치면 다음 단계로 넘어갑니다.', 'Call-up → airframe check call → transmitter check (full stick travel) call → airspace and wind call. Each call moves you on.'],
  to: ['시동 → 3~5 m 기준고도까지 한 번에 상승(중간에 멈추면 감점) → 정지 5초 → 조종면 점검 구호 → 호버링 위치(A)로.', 'Start → climb in one go to a 3–5 m reference height (no stopping) → hold 5 s → control check call → move to the hover point (A).'],
  hov: ['제자리에서 기수만 90°씩 돌리고 각 방향에서 정지 5초. 위치 ±1 m · 고도 ±0.5 m · 기수 ±15° 안.', 'Turn only the nose 90° at a time and hold 5 s each way. Position ±1 m · height ±0.5 m · heading ±15°.'],
  fb: ['A → E 40 m 전진, 다시 A 로 후진. 일정한 속도로 중간에 멈추지 않기, 끝에서 정지 5초.', 'Forward 40 m from A to E, then back to A. Steady speed with no stops; hold 5 s at each end.'],
  tri: ['옆으로 수평 이동 → 45° 사선 상승(A 위 +7.5 m) → 반대쪽으로 45° 사선 하강 → A 로 복귀. 오르내리는 기울기가 일정해야 합니다.', 'Level sideways → 45° climb to A +7.5 m → 45° descent to the other side → back to A. Keep the slope steady.'],
  cir: ['기수를 진행 방향으로 돌리며(러더턴) 반경 7.5 m 원을 일정한 속도로. 출발점에서 정지 후 기수 전방.', 'Fly a 7.5 m circle nose-first (rudder turn) at a steady speed. Hold at the start, then nose forward.'],
  emg: ['2 m 상승 → "비상!" → 즉시 빠르게(평소 1.5배) 하강하며 비상 착륙장(F)에 착지. 내려오다 멈추지 않기.', 'Climb 2 m → "Emergency!" → descend at once, fast (1.5× normal), to the emergency pad (F). No pauses on the way down.'],
  nrm: ['GPS 끄기(ATTI) → 위치 유지가 없어 바람에 흐르는 것을 직접 잡으며 H 로 접근 → 중심축 맞춰 착륙.', 'GPS off (ATTI) → no position hold, so correct the drift yourself on the way to H → land on the centre axis.'],
  xw: ['GPS 다시 켜기 → 바람 쪽으로 기수를 돌린 측면 자세로 H 까지 직선 접근 → 착륙.', 'GPS back on → nose turned into the wind, fly sideways straight to H → land.'],
  post: ['시동 끄고 아워미터·전원 OFF → 외관 점검 → 배터리 분리 구호.', 'Shut down, hour meter, power off → airframe check → battery removal call.'],
  oral: ['구술 5문항. 시범에서는 정답을 골라 보여 줍니다.', 'Five oral questions. The demo picks the right answers.']
};
function c1DemoBanner(m) {
  let b = $('c1demo'); if (!b) { b = document.createElement('div'); b.id = 'c1demo'; document.body.appendChild(b); b.title = L2('누르면 접기/펴기', 'Tap to fold/unfold'); b.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); b._open = b.classList.contains('small'); b.classList.toggle('small', !b._open); }; }
  const learn = !C1.demo && !C1.exam, key = m ? m.id + '|' + C1.mi + '|' + (window.SIM_LANG || 'ko') : '';
  if (b._k !== key) { b._k = key; b._t = C1.t; }
  const on = (C1.demo || learn) && !C1.over && S.state !== 'menu' && m && C1TIP[m.id]; b.classList.toggle('hidden', !on); if (!on) return;
  const tip = C1TIP[m.id];
  if (b._h !== key) { b._h = key; b.innerHTML = `<b>${C1.demo ? '▶ ' + L2('시범비행', 'DEMO') : '📘 ' + L2('요령', 'HOW TO')} ${C1.mi + 1}/${C1.M.length} · ${m.name}</b><span>${L2(tip[0], tip[1])}</span>`; b._open = null; }
  b.classList.toggle('small', b._open != null ? !b._open : (C1.t - b._t > (C1.demo ? 10 : 15)));
}
function c1DemoCtl() {
  const st = c1Cur(); if (!st || C1.over) { IN.pitch = IN.roll = IN.yaw = 0; IN.thr = -1; return; }
  const M = c1M(), ref = C1.ref || 4, g = G, wrap = d => ((d + 180) % 360 + 360) % 360 - 180, cl1 = x => clamp(x, -1, 1), cl01 = x => clamp(x, 0, 1);
  const FW = [Math.sin(DR.h), -Math.cos(DR.h)], RT = [Math.cos(DR.h), Math.sin(DR.h)];
  const D = C1.dm || (C1.dm = { cd: 0, si: -1 }); if (D.si !== C1.mi * 100 + C1.si) { D.si = C1.mi * 100 + C1.si; D.t0 = C1.t; D.n = 0; }
  const idle = C1.t >= (C1.sayUntil || 0) - 0.05, age = C1.t - D.t0;
  const press = (k, wait) => { if (C1.t >= D.cd && age >= (wait == null ? 1.0 : wait) && idle) { c1DK(k); D.cd = C1.t + 0.6; return true; } return false; };
  let tu = M.u, tv = M.v, ta = M.alt, th = M.hdg, vmax = 1.2, vzO = null, ff = 0, still = false, fix = null;
  const flight = ['climb', 'hold', 'move', 'arc', 'xfer', 'emg', 'land'].includes(st.k);
  // 구호: 이동 전에 먼저 외치고(음성이 끝난 뒤) 움직임 · 정지 구호는 도착 후 세기는 앱이 함
  const callFirst = st.call && !st.callSaid && ['move', 'arc', 'xfer', 'climb', 'mode'].includes(st.k);
  if (st.call && !st.callSaid && st.k === 'hold') press('KeyQ', 0.2);
  if (callFirst) press('KeyQ', 0.6);
  if (st.k === 'inspect') { if (st.open && !st.done && age > 3 && idle) c1InspectAuto(true); still = true; }
  else if (st.k === 'oral') { if (st.qs && !st.done && age > 3 && idle) c1OralAuto(5); still = true; }
  else if (st.k === 'ann') still = true;
  else if (st.k === 'rc') { if (!st.callSaid && age > 1) { const seq = [{ thr: 1 }, { thr: -1 }, { yaw: 1 }, { yaw: -1 }, { pitch: 1 }, { pitch: -1 }, { roll: 1 }, { roll: -1 }]; const i = Math.floor((age - 1) / 0.45); fix = i < seq.length ? Object.assign({ thr: 0, yaw: 0, pitch: 0, roll: 0 }, seq[i]) : null; if (i >= seq.length) press('KeyQ', 0); } if (!fix) fix = { thr: 0, yaw: 0, pitch: 0, roll: 0 }; if (C1.mode !== 'gps') press('KeyH', 0.5); still = true; }
  else if (st.k === 'ctl') { const seq = [{ pitch: 0.25 }, { pitch: -0.25 }, { roll: 0.25 }, { roll: -0.25 }, { yaw: 0.3 }, { yaw: -0.3 }]; const i = Math.floor(age / 0.6); if (i < seq.length) fix = Object.assign({ pitch: 0, roll: 0, yaw: 0 }, seq[i]); else if (!st.callSaid) press('KeyQ', 0); }
  else if (st.k === 'prep') { press(st.call ? 'KeyQ' : 'Enter', 1.2); still = true; }
  else if (st.k === 'arm') { if (st.call && !st.callSaid) press('KeyQ', 1.0); else press('Enter', 1.0); still = true; }
  else if (st.k === 'disarm') { if (DR.landed && M.hs < 0.2) { if (st.call && !st.callSaid) press('KeyQ', 0.8); else press('Enter', 0.8); } still = DR.landed; }
  else if (st.k === 'mode') { if (st.callSaid && C1.t >= D.cd) { if (st.gps ? C1.mode !== 'gps' : C1.mode === 'gps') press('KeyH', 0.3); } still = DR.landed; }
  else if (st.k === 'callout') { press('KeyE', 0.6); }
  if (st.k === 'climb') { tu = st.at[0]; tv = st.at[1]; ta = 4.0; th = 0; }
  else if (st.k === 'hold') { tu = st.at[0]; tv = st.at[1]; ta = st.altWin ? ref + st.altWin[0] + 0.8 : ref + (st.r || 0); th = st.hdg; }
  else if (st.k === 'xfer') { tu = st.to[0]; tv = st.to[1]; ta = ref; th = 0; }
  else if (st.k === 'move') {
    const a = st.from, b = st.to, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const sp = cl01(((M.u - a[0]) * ux + (M.v - a[1]) * uy + 2.0) / L); tu = a[0] + dx * sp; tv = a[1] + dy * sp;
    const sp0 = cl01(((M.u - a[0]) * ux + (M.v - a[1]) * uy) / L); ta = ref + (st.r0 || 0) + ((st.r1 || 0) - (st.r0 || 0)) * sp0; th = st.hdg; vmax = (st.r0 || st.r1) ? 0.7 : 1.3;
    if (st.r0 || st.r1) { const vAl = DR.v.x * ux + (-DR.v.z) * uy; ff = ((st.r1 || 0) - (st.r0 || 0)) / L * vAl; }
  } else if (st.k === 'arc') {
    const dir = st.dir < 0 ? 1 : -1, thp = Math.atan2(M.u - st.c[0], M.v - st.c[1]) / DEG, ah = (thp + dir * 25) * DEG;
    tu = st.c[0] + Math.sin(ah) * st.R; tv = st.c[1] + Math.cos(ah) * st.R; ta = ref; th = wrap(thp + 90 * dir); vmax = 1.4;
    if (st.sweep > 320) { tu = st.start[0]; tv = st.start[1]; vmax = 0.8; }
  } else if (st.k === 'emg') { tu = st.pad[0]; tv = st.pad[1]; ta = 0; th = 0; vmax = 3.5; vzO = -2.0; }
  else if (st.k === 'land') { tu = st.pad[0]; tv = st.pad[1]; ta = 0; th = st.hdg; vmax = 0.8; vzO = Math.hypot(M.u - tu, M.v - tv) < 0.4 ? -0.6 : 0; }
  if (callFirst && flight) { tu = M.u; tv = M.v; ta = DR.landed ? 0 : M.alt; th = M.hdg; vzO = DR.landed ? -1 : null; }
  let vu = (tu - M.u) * 0.9, vv = (tv - M.v) * 0.9; const vl = Math.hypot(vu, vv); if (vl > vmax) { vu *= vmax / vl; vv *= vmax / vl; }
  const hh = C1S.h, vx = Math.cos(hh) * vu + Math.sin(hh) * vv, vz = Math.sin(hh) * vu - Math.cos(hh) * vv;
  let pit, rol;
  if (C1.mode === 'gps') { pit = (vx * FW[0] + vz * FW[1]) / C1P.gpsV.v; rol = (vx * RT[0] + vz * RT[1]) / C1P.gpsV.v; }
  else { const ax = (vx - DR.v.x) * 1.6, az = (vz - DR.v.z) * 1.6, tm = C1P.tiltMax.v * DEG; pit = Math.atan((ax * FW[0] + az * FW[1]) / g) / tm; rol = Math.atan((ax * RT[0] + az * RT[1]) / g) / tm; }
  const he = wrap(th - M.hdg);
  const vzd = vzO != null ? vzO : Math.max(-1.2, Math.min(1.5, ff + (ta - M.alt) * 1.5));
  let thr;
  if (C1.mode === 'manual') { const aUp = C1P.thrustMaxN.v / C1P.flightKg.v - g; thr = ((vzd - M.vy) * 2.5) / (vzd - M.vy >= 0 ? aUp * 0.6 : g * 0.55); }
  else thr = vzd > 0 ? vzd / C1P.climb.v : vzd / C1P.sink.v;
  if (still || (!flight && DR.landed)) { thr = DR.landed ? -1 : thr; pit = rol = 0; }
  if (DR.landed && (st.k === 'land' || st.k === 'emg' || st.k === 'disarm')) { thr = -1; pit = rol = 0; }
  IN.pitch = cl1(pit); IN.roll = cl1(rol); IN.yaw = cl1(he * 0.05); IN.thr = cl1(thr);
  if (fix) for (const k in fix) IN[k] = fix[k];
}
// 학습: 기동 번호로 바로 이동 (1~9)
function c1Jump(i, again) {
  i = clamp(i | 0, 0, C1.M.length - 1); if (!C1.M[i]) return;
  const fresh = c1Build(C1.side)[i]; fresh.label = fresh.name; fresh.done = false; fresh.miss = false; fresh.why = []; fresh.steps.forEach(s => s.T = s.T || c1R('hoverT')); C1.M[i] = fresh;
  for (let j = i; j < C1.M.length; j++) { C1.M[j].done = false; C1.M[j].miss = false; }
  C1.mi = i; C1.si = 0; MS.idx = i; C1.ref = C1.ref || 4; C1.hold = null; C1.altT = null; C1.ei.set(0, 0, 0); C1.touch = null; C1.crash = null;
  const ref = C1.ref, sb = C1.side < 0 ? C1PT.B : C1PT.D, f = C1.side < 0 ? C1PT.FB : C1PT.FD;
  const air = (uv, r) => ({ p: c1W(uv[0], uv[1], ref + (r || 0) + c1p('skidDrop')), gnd: false });
  const pose = [{ p: c1W(0, 15, c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }, air(C1PT.A), air(C1PT.A), air(C1PT.A), air(C1PT.H), air(C1PT.H), { p: c1W(f[0], f[1], c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }][i] || air(C1PT.H);
  resetDrone(pose.p, C1S.h); DR.landed = pose.gnd; C1.az = 0; C1.yr = 0;
  C1.armed = (i > 0 && !pose.gnd) || i === 1; if (i === 0) { C1.ref = null; C1.tArm = null; } C1.introCam = false; c1ModalClose();
  C1.mode = 'gps';
  c1Ev('jump', { to: C1.M[i].id, again: !!again }); renderList();
  const st = c1Cur(); if (st) { st.t0 = C1.t; st.wait = true; }
  if (!again) showMsg(C1.M[i].name, '#c9a2ff', 1.2);
}

// ---- 화면 ----
function c1Panel(show) {
  let el = $('c1p');
  if (!el) {
    const css = document.createElement('style');
    css.textContent = `#c1p{position:fixed;left:10px;top:112px;width:290px;max-height:calc(100vh - 230px);overflow:auto;z-index:6;background:rgba(10,14,20,.64);border:1px solid rgba(201,162,255,.5);border-radius:10px;color:#e8eef3;font:13px/1.35 system-ui,sans-serif;padding:8px 10px;pointer-events:auto}
#c1p.hidden{display:none}#c1p .t{cursor:move;user-select:none;-webkit-user-select:none;touch-action:none}#c1p .t::before{content:'⠿ ';opacity:.6}#c1p .t::after{content:'▾';float:right;opacity:.75;padding-left:6px}#c1p.mini .t::after{content:'▸'}#c1p.mini .s,#c1p.mini .cl,#c1p.mini .r,#c1p.mini canvas,#c1p.mini .note{display:none}#c1p.mini .co div:nth-child(n+2){display:none}#c1p .t{font-weight:700;color:#c9a2ff;font-size:12px;letter-spacing:.04em}#c1p .m{font-size:15px;font-weight:700;margin-top:2px}#c1p .s{color:#ffc828;margin:2px 0 4px}
#c1p .r{display:grid;grid-template-columns:auto 1fr;gap:1px 8px;font-variant-numeric:tabular-nums}#c1p .r b{font-weight:600;color:#9fb0bd}#c1p .bad{color:#ff7a5a}#c1p .ok{color:#5dff9a}
#c1p .bt{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}#c1p .bt button{flex:1 1 auto;min-width:56px;padding:6px 4px;border-radius:6px;border:1px solid #4a5560;background:#1d252d;color:#e8eef3;font-size:12px}
#c1p canvas{width:100%;height:auto;max-height:150px;object-fit:contain;margin-top:6px;border-radius:6px;background:#1b2a1a}#c1p .note{color:#8f9aa3;font-size:11px;margin-top:4px}
body.c1on #tbBoost,body.c1on #tbDrop,body.c1on #tbPhoto,body.c1on #tbGuide,body.c1on #tbBelly,body.c1on #tbIR{display:none!important}
#c1p .cl{color:#7fd0ff;margin:2px 0}#c1p .bt button#c1Gp.on{background:#1f5a32;border-color:#5dff9a;color:#bfffd2;font-weight:700}#c1p .bt button#c1Gp.off{background:#5a3a14;border-color:#ffb030;color:#ffe2b0;font-weight:700}
#c1p i.pb{display:inline-block;width:70px;height:7px;background:#2a333c;border-radius:4px;vertical-align:middle;overflow:hidden}#c1p i.pb i{display:block;height:100%;background:#5dff9a}#c1p .okf{font-weight:700;font-size:14px}.dlg{margin:4px 0 2px;display:flex;flex-direction:column;gap:3px}.dlg.hidden{display:none}.dlg .ex,.dlg .me{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:5px 8px;border-radius:8px;font-size:12.5px;line-height:1.4}.dlg .ex{background:rgba(255,200,40,.10);border-left:3px solid #ffc828}.dlg .ex b{color:#ffc828}.dlg .me{background:rgba(127,208,255,.10);border-left:3px solid #7fd0ff}.dlg .me b{color:#7fd0ff}.dlg .me span{flex:1 1 100%;color:#fff;font-weight:600}.dlg .me em{font-style:normal;color:#7dffa8;font-size:11.5px}.dlg .me.wait span{font-weight:400;color:#c9d4dc}.dlg .me i{font-style:normal;color:#9fb3c8;font-size:10.5px}.dlg #c1SayB{flex:0 0 auto;padding:7px 14px;border-radius:8px;border:1px solid #7fd0ff;background:#14506e;color:#fff;font-weight:700;font-size:13px;animation:c1need 1s ease-in-out infinite}.dlg #c1SayB small{margin-left:5px;font-size:9px;opacity:.7;border:1px solid #6a7580;border-radius:3px;padding:0 2px}.dlg .nx{font-size:11.5px;color:#9fb3c8;padding:0 8px}body.touch .dlg .ex{display:none}body.touch .dlg{margin:1px 0}body.touch .dlg .me{padding:2px 6px;font-size:11px;flex-wrap:nowrap;gap:6px}body.touch .dlg .me b,body.touch .dlg .me i{display:none}body.touch .dlg .me span{flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}body.touch .dlg #c1SayB{padding:4px 10px;font-size:12px}body.touch .dlg .nx{display:none}body.touch .dlg #c1SayB small{display:none}body.touch #c1p{display:flex;flex-direction:column}body.touch #c1p>*{flex:0 0 auto;min-height:0}body.touch #c1p .co,body.touch .tip{flex:0 1 auto;overflow:hidden}body.touch #c1p .bts{margin-top:auto}body.touch #c1p .m{display:none}body.touch #c1p .t{font-size:11px}#c1p .co{margin:3px 0;font-size:12.5px;line-height:1.45}#c1p .co:empty{display:none}#c1p .co div{padding:1px 0}#c1p .co .cg{color:#7dffa8}#c1p .co .cy{color:#ffd166}#c1p .co .cr{color:#ff7a6a}#c1p .co i{font-style:normal;color:#9fb3c8;font-size:11px}#c1p .co b{color:#fff}body.touch #c1p .co{font-size:11px;margin:1px 0}body.touch #c1p .co div:nth-child(n+2){display:none}body.touch #c1p .co div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#c1p .bt.main button{flex:1 1 0;font-size:13px;padding:8px 4px;font-weight:700}#c1p .bt.sub{margin-top:4px}#c1p .bt.sub button{flex:1 1 auto;min-width:0;font-size:11px;padding:4px 3px;background:#151c22}#c1p .bt button#c1Em{background:#4a1a1a;border-color:#ff6060;color:#ffd0d0}body.touch #c1p .bts{display:flex;gap:3px;margin-top:3px}body.touch #c1p .bts .bt{margin:0;flex:1 1 0}body.touch #c1p .bts .bt.main{flex:1.3 1 0}body.touch #c1p .bt button{white-space:nowrap;overflow:hidden;letter-spacing:-.3px}#c1p .bt button small{margin-left:4px;font-size:9px;opacity:.6;border:1px solid #6a7580;border-radius:3px;padding:0 2px}body.touch #c1p .bt button small{display:none}#c1p .bt button.need{background:#14506e;border-color:#7fd0ff;color:#fff;font-weight:700;animation:c1need 1s ease-in-out infinite}@keyframes c1need{0%,100%{box-shadow:0 0 0 0 rgba(127,208,255,0);filter:brightness(1)}50%{box-shadow:0 0 0 4px rgba(127,208,255,.75);filter:brightness(1.45)}}#c1p.demo .bts,body.touch #c1p.demo .bts{display:none}body.c1demo #c1btnW{display:none}#c1demo{position:fixed;left:50%;transform:translateX(-50%);top:58px;z-index:30;max-width:min(680px,92vw);background:rgba(20,16,40,.72);border:1px solid #c9a2ff;border-radius:8px;padding:6px 12px;color:#efe6ff;font-size:13px;line-height:1.45;pointer-events:auto;cursor:pointer}#c1demo.small{padding:3px 10px;font-size:12px}#c1demo.small span{display:none}#c1demo.small b::after{content:' ▸';opacity:.7}#c1demo b{color:#c9a2ff;margin-right:6px}#c1demo.hidden{display:none}body.touch #c1demo{top:auto;bottom:8px;font-size:11px;max-width:60vw}#c1p .cl i{color:#9aa6ad;font-style:normal}#c1p .bt button.on{background:#2c5a36;border-color:#5dff9a}
#c1cap{position:fixed;left:50%;top:136px;transform:translateX(-50%);max-width:min(760px,92vw);background:rgba(8,12,18,.86);border:1px solid #ffc828;border-radius:10px;padding:8px 14px;color:#fff;font:15px/1.4 system-ui,sans-serif;z-index:8;opacity:0;transition:opacity .25s;pointer-events:none}
#c1cap.on{opacity:1}#c1cap b{color:#ffc828;margin-right:6px}#c1cap.me{border-color:#7fd0ff}#c1cap.me b{color:#7fd0ff}
#c1m{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}#c1m.hidden{display:none}
#c1m .box{background:#11161c;border:1px solid #c9a2ff;border-radius:12px;padding:14px 16px;max-width:min(640px,94vw);max-height:90vh;overflow:auto;color:#e8eef3;font:14px/1.45 system-ui,sans-serif}
#c1m h3{margin:0 0 6px;color:#c9a2ff}#c1m table{width:100%;border-collapse:collapse;margin:8px 0}#c1m td{padding:5px 4px;border-bottom:1px solid #26303a;vertical-align:middle}
#c1m td button{margin:0 2px;padding:6px 10px;border-radius:6px;border:1px solid #4a5560;background:#1d252d;color:#e8eef3}#c1m td button.on{background:#2c5a36;border-color:#5dff9a}
#c1m .primary{margin-top:6px;padding:9px 16px;border-radius:8px;border:0;background:#ffc828;color:#111;font-weight:700}#c1m .primary:disabled{opacity:.4}
#c1m .opt{display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px;border-radius:8px;border:1px solid #4a5560;background:#1d252d;color:#e8eef3;font-size:14px}#c1m .q{font-size:16px;font-weight:600}#c1m .dim{color:#8f9aa3;font-size:12px}
body.touch #c1p .s,body.touch #c1p .cl,body.touch #c1p .m,body.touch #c1p .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.touch #c1p{left:150px;right:280px;top:36px;width:auto;max-height:calc(38vh - 40px);overflow:hidden;padding:4px 8px;font-size:11px;line-height:1.25}
body.touch #c1p .r,body.touch #c1p canvas,body.touch #c1p .note{display:none}body.touch #c1p .m{font-size:12px;margin:0}body.touch #c1p .s{margin:1px 0}
body.touch #c1An,body.touch #c1Mic,body.touch #c1Md,body.touch #c1Vw{display:none}
body.touch #c1p .bt{flex-wrap:nowrap;margin-top:3px;gap:3px}body.touch #c1p .bt button{min-width:0;padding:5px 3px;font-size:11px}
body.touch #c1p.chk .t,body.touch #c1p.chk .cl{display:none}body.touch #c1p.chk .r{display:flex;flex-wrap:wrap;gap:0 6px;font-size:10px}body.touch #c1p.chk .r span{margin-right:6px}body.touch #c1p.mini{max-height:none}
body.touch #c1cap{top:calc(38% + 4px);font-size:13px;max-width:60vw}
body.c1on #objNext,body.c1on #list,body.c1on #bottom,body.c1on #c1demo{display:none!important}
#c1p{top:108px;width:300px;max-height:calc(100vh - 120px)}
#c1p.split{width:250px;top:108px;max-height:calc(100vh - 300px)}
.c1w{position:fixed;z-index:6;color:#e8eef3;font:13px/1.35 system-ui,sans-serif;pointer-events:auto}.c1w.hidden,body:not(.c1on) .c1w{display:none}
#c1tipW{left:50%;top:12px;transform:translateX(-50%);width:min(680px,60vw)}#c1tipW .tip{margin:0;background:rgba(10,14,20,.72);border:1px solid rgba(201,162,255,.45);border-left:3px solid #c9a2ff;border-radius:8px;padding:5px 10px;font-size:12.5px}
#c1dlgW{left:50%;bottom:22px;transform:translateX(-50%);width:min(620px,calc(100vw - 540px))}#c1dlgW .dlg{margin:0;background:rgba(10,14,20,.72);border:1px solid rgba(127,208,255,.35);border-radius:10px;padding:6px 8px}#c1dlgW .dlg .me span{flex:1 1 auto}#c1dlgW .dlg .me{font-size:14px}#c1dlgW .dlg .ex{font-size:12.5px}
#c1btnW{right:12px;top:60px;width:150px}#c1btnW .bts{display:flex;flex-direction:column;gap:5px;background:rgba(10,14,20,.6);border:1px solid rgba(201,162,255,.35);border-radius:10px;padding:8px}#c1btnW .bt{display:flex;flex-wrap:wrap;gap:4px;margin:0}#c1btnW .bt.main{flex-direction:column}#c1btnW .bt.main button{width:100%;padding:9px 6px;font-size:13px;font-weight:700;border-radius:6px;border:1px solid #4a5560;background:#1d252d;color:#e8eef3}#c1btnW .bt.main button small{margin-left:4px;font-size:9px;opacity:.6;border:1px solid #6a7580;border-radius:3px;padding:0 2px}#c1btnW .bt.sub button{flex:1 1 44%;padding:5px 3px;font-size:11px;border-radius:6px;border:1px solid #4a5560;background:#151c22;color:#e8eef3}#c1btnW #c1More{flex:1 1 100%}
#c1btnW .bt button#c1Gp.on{background:#1f5a32;border-color:#5dff9a;color:#bfffd2}#c1btnW .bt button#c1Gp.off{background:#5a3a14;border-color:#ffb030;color:#ffe2b0}#c1btnW .bt button#c1Em{background:#4a1a1a;border-color:#ff6060;color:#ffd0d0}#c1btnW .bt button.need{background:#14506e;border-color:#7fd0ff;color:#fff;animation:c1need 1s ease-in-out infinite}#c1btnW .bt button.on{background:#2c5a36;border-color:#5dff9a}
body.c1on:not(.touch) #c1cap{display:none}
#c1p .m{display:flex;justify-content:space-between;align-items:baseline;gap:6px}#c1p .m .dots{font-size:10px;letter-spacing:1px;color:#c9a2ff;white-space:nowrap}
.tip{margin:3px 0;padding:4px 7px;border-left:3px solid #c9a2ff;background:rgba(201,162,255,.10);border-radius:4px;font-size:12px;line-height:1.45;color:#e6dcff;cursor:pointer}.tip:empty{display:none}.tip:not(.open) span{display:none}.tip b{color:#c9a2ff}
#c1p .s{font-size:14px;font-weight:600}
#c1p:not(.more) .bt.sub{display:none}body:not(.c1more) #c1btnW .bt.sub{display:none}#c1p #c1More{flex:0 0 34px}#c1p.more #c1More{background:#2f3a46}
#c1p .bt.main{flex-wrap:nowrap}#c1p .bt.main button{font-size:12.5px;white-space:nowrap;min-width:0;padding:7px 3px}#c1p .bt.main button small{display:none}#c1p canvas{display:none}#c1p.map canvas{display:block}#c1p .note{display:none}#c1p.map .note{display:block}
#c1cap{top:10px;font-size:14px;padding:6px 12px}
#c1g{position:fixed;right:12px;bottom:14px;z-index:6;width:236px;height:168px;pointer-events:none;border-radius:10px;background:rgba(10,14,20,.6);border:1px solid rgba(127,208,255,.35)}#c1g.hidden{display:none}
body.touch #c1g{right:auto;left:50%;transform:translateX(-50%);top:auto;bottom:44px;width:min(132px,15.5vw);height:calc(min(132px,15.5vw)*0.72)}
body.touch .tip,body.touch #c1p .cl{display:none}
body.touch #c1p .bts{flex-wrap:wrap}body.touch #c1p .bts .bt.main{flex:1 1 100%}body.touch #c1p .bts .bt.sub{flex:1 1 100%;margin-top:2px}body.touch #c1p:not(.more) .bts .bt.sub{display:none}
body.touch #c1p #c1More{flex:0 0 26px}
body.touch #c1cap{top:auto;bottom:6px}
@media (max-width:700px),(max-height:500px){#c1p{width:230px;font-size:11px;top:86px;left:6px;padding:6px 8px;max-height:calc(100vh - 96px)}#c1p canvas,#c1p .note{display:none}#c1p .m{font-size:13px}#c1p .bt button{padding:8px 4px}}`;
    document.head.appendChild(css);
    el = document.createElement('div'); el.id = 'c1p'; el.className = 'hidden';
    el.innerHTML = `<div class="t" id="c1T"></div><div class="m" id="c1Mn"></div><div class="tip" id="c1Tip"></div><div class="s" id="c1St"></div>
<div class="dlg" id="c1Dlg"></div><div class="cl" id="c1Cl"></div><div class="co" id="c1Co"></div><div class="r" id="c1R"></div>
<div class="bts"><div class="bt main"><button id="c1Ok" title="${L2('완료하고 다음 단계로 (키보드 Enter)', 'Done, go to next step (Enter key)')}">${L2('다음 ▶', 'NEXT ▶')}<small>Enter</small></button><button id="c1Em" title="${L2('비상 선언 (키보드 E)', 'Declare emergency (E key)')}">${L2('🚨 비상', '🚨 EMER')}<small>E</small></button><button id="c1Gp" title="${L2('GPS 스위치 (H)', 'GPS switch (H)')}">GPS</button><button id="c1More" title="${L2('설정 더보기', 'More settings')}">⋯</button></div><div class="bt sub"><button id="c1Md">${L2('모드 Y', 'MODE Y')}</button><button id="c1Hr">🕐</button><button id="c1Vw">${L2('시점 C', 'VIEW C')}</button><button id="c1An">📢</button><button id="c1Vo">🔊</button><button id="c1Mic">🎤</button><button id="c1MapB" title="${L2('시험장 지도 보기', 'Show the field map')}">🗺</button></div></div>
<canvas id="c1Map" width="260" height="200"></canvas><div class="note" id="c1Note"></div><div class="note">${C1DISC()}</div>`;
    document.body.appendChild(el);
    if (!IS_TOUCH) {   // 데스크톱: 한 창 대신 작은 창 넷 — 왼쪽 위 상태·코치 / 위 가운데 요령 / 아래 가운데 대화(구호) / 오른쪽 위 버튼 → 가운데 작업 영역을 비움
      const mk = (id) => { const w = document.createElement('div'); w.id = id; w.className = 'c1w'; document.body.appendChild(w); return w; };
      mk('c1tipW').appendChild($('c1Tip')); mk('c1dlgW').appendChild($('c1Dlg')); mk('c1btnW').appendChild(el.querySelector('.bts'));
      el.classList.add('split');
    }
    const tap = (id, k) => { const b = $(id); b.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); c1Key(k); }; };
    $('c1More').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); el.classList.toggle('more'); document.body.classList.toggle('c1more', el.classList.contains('more')); };
    $('c1MapB').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); SET.c1map = !SET.c1map; saveSet(); };
    $('c1Tip').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); C1.tipOpen = !$('c1Tip').classList.contains('open'); };
    tap('c1Ok', 'Enter'); tap('c1Md', 'KeyY'); tap('c1Gp', 'KeyH');
    $('c1Hr').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); const L = [9, 11, 13, 15, 17]; SET.c1hour = L[(L.indexOf(SET.c1hour | 0) + 1) % L.length] || 11; saveSet(); c1Sun(); showMsg(L2('시험 시각 ', 'Test time ') + SET.c1hour + L2('시 · 해 위치·그림자 반영', ':00 · sun and shadows updated'), '#ffc828', 1.6); }; tap('c1Em', 'KeyE'); tap('c1Vw', 'KeyC');
    el.addEventListener('pointerdown', e => { const b = e.target.closest('#c1SayB'); if (b) { e.stopPropagation(); e.preventDefault(); c1Key('KeyQ'); } });
    $('c1An').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); SET.c1ann = SET.c1ann === false; saveSet(); c1AnnBtn(); showMsg(SET.c1ann === false ? L2('시험위원 지시 방송 끔 (응시자 구호로 진행)', 'Examiner announcements off (candidate-led)') : L2('시험위원 지시 방송 켬', 'Examiner announcements on'), '#ffc828', 1.6); };
    $('c1Vo').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); if (SET.c1voice === false) { SET.c1voice = true; saveSet(); } c1VoiceUnlock(); c1VoiceTest(); };
    $('c1Vo').oncontextmenu = e => { e.preventDefault(); SET.c1voice = SET.c1voice === false; saveSet(); showMsg(SET.c1voice === false ? L2('시험장 음성 끔', 'Test-field voice off') : L2('시험장 음성 켬', 'Test-field voice on'), '#ffc828', 1.4); };
    // 제목줄: 끌어서 옮기기 · 짧게 누르면 접기/펴기 · 두 번 누르면 원래 자리 (자리·접힘은 기기별로 기억)
    const tb = $('c1T'); let dg = null;
    tb.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); const r = el.getBoundingClientRect(); dg = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, w: r.width, mv: false }; try { tb.setPointerCapture(e.pointerId); } catch (_) { } };
    tb.onpointermove = e => { if (!dg || IS_TOUCH) return; const dx = e.clientX - dg.x, dy = e.clientY - dg.y; if (!dg.mv && Math.hypot(dx, dy) < 6) return; dg.mv = true; c1PanelPos(dg.l + dx, dg.t + dy, dg.w); };   // 모바일: 자리 고정 (스틱 영역과 겹치지 않게)
    tb.onpointerup = e => { if (!dg) return; const d = dg; dg = null; const k = IS_TOUCH ? 'c1posT' : 'c1posP';
      if (d.mv) { const r = el.getBoundingClientRect(); SET[k] = [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; saveSet(); return; }
      const now = performance.now(); if (now - (tb._last || 0) < 350) { SET[k] = null; saveSet(); c1PanelPos(); tb._last = 0; return; } tb._last = now;
      el.classList.toggle('mini'); SET.c1mini = el.classList.contains('mini'); saveSet(); };
    tb.title = L2('끌어서 옮기기 · 누르면 접기/펴기 · 두 번 누르면 원래 자리', 'Drag to move · tap to fold/unfold · double-tap to reset');
    el.classList.toggle('mini', !!SET.c1mini); c1PanelPos();
    $('c1Mic').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); c1Mic(!C1V.micOn); $('c1Mic').classList.toggle('on', C1V.micOn); };
  }
  el.classList.toggle('hidden', !show); document.querySelectorAll('.c1w').forEach(w => w.classList.toggle('hidden', !show)); c1AnnBtn(); if (!show) { const b = $('c1demo'); if (b) b.classList.add('hidden'); }
}
function c1PanelPos(x, y, w) {
  const el = $('c1p'); if (!el) return; const k = IS_TOUCH ? 'c1posT' : 'c1posP';
  if (IS_TOUCH) { SET.c1posT = null; el.style.left = el.style.top = el.style.right = el.style.width = ''; return; }   // 모바일은 기본 자리만
  if (x == null && SET[k]) [x, y, w] = SET[k];
  if (x == null) { el.style.left = el.style.top = el.style.right = el.style.width = ''; return; }
  const W = innerWidth, H = innerHeight, ww = Math.min(w || el.offsetWidth, W - 8);
  x = clamp(x, 4 - ww * 0.7, W - ww * 0.3); y = clamp(y, 0, H - 28);
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.right = 'auto'; el.style.width = ww + 'px';
}
function c1AnnBtn() { const b = $('c1An'); if (b) { b.classList.toggle('on', SET.c1ann !== false); b.title = L2('시험위원 지시 방송 켜기/끄기', 'Examiner announcements on/off'); } }
let _c1ui = 0;
function c1Tick(dt) {
  if (!isC1() || !C1G) return;
  if (C1.pilotFig) C1.pilotFig.visible = C1.view !== 'pilot' || !!C1.introCam || S.state === 'menu';
  c1NavTick();
  if (C1V.heardT > 0) C1V.heardT -= dt; if (C1.ok && C1.ok.t > 0) C1.ok.t -= dt;
  if (ui.modeTag && (S.state === 'run' || S.state === 'pause')) ui.modeTag.textContent = 'C1 · ' + (C1.mode === 'gps' ? 'GPS ON' : C1.mode === 'atti' ? 'GPS OFF (ATTI)' : 'MANUAL') + (C1.armed ? ' · ARMED' : '');
  if (C1.ribbons) c1RibbonTick();
  if (C1.sock) { const w = c1Wind(c1W(-16, 10, 4)); const sp = Math.hypot(w.x, w.z); C1.sock.rotation.set(0, 0, 0); C1.sock.lookAt(C1.sock.position.clone().add(new V3(w.x || 0.001, -Math.max(0, 3 - sp) * 0.6, w.z))); C1.sock.rotateX(Math.PI / 2); }
  const run = S.state === 'run' || S.state === 'pause';
  const st = run ? c1Cur() : null, aids = !C1.exam && run && st;
  C1.aidBox.visible = C1.aidLine.visible = C1.aidArrow.visible = false;
  c1Aid3D(aids ? st : null);
  c1Gauge(run ? st : null, c1M());
  if (aids) {
    const ref = C1.ref || 4;
    if (st.k === 'hold' || st.k === 'xfer') {
      const at = st.at || st.to, h0 = st.altWin ? ref + st.altWin[0] : ref + (st.r || 0) - c1R('altTol'), h1 = st.altWin ? ref + st.altWin[1] : ref + (st.r || 0) + c1R('altTol');
      C1.aidBox.visible = true; C1.aidBox.rotation.y = -C1S.h; C1.aidBox.scale.set(c1R('posTol'), Math.max(0.05, h1 - h0), st.alongTol ? st.alongTol : c1R('posTol'));
      C1.aidBox.position.copy(c1W(at[0], at[1], (h0 + h1) / 2 + c1p('skidDrop')));
      C1.aidArrow.visible = st.hdg != null; if (st.hdg != null) { const hd = st.hdg * DEG; C1.aidArrow.position.copy(c1W(at[0] + Math.sin(hd) * 1.6, at[1] + Math.cos(hd) * 1.6, h1 + c1p('skidDrop') + 0.2)); C1.aidArrow.rotation.set(-Math.PI / 2, 0, -(hd + C1S.h)); }
    } else if (st.k === 'move' || st.k === 'arc' || st.k === 'climb' || st.k === 'land' || st.k === 'emg') {
      const pts = [], sd = c1p('skidDrop');
      if (st.k === 'move') { for (let i = 0; i <= 20; i++) { const s = i / 20; pts.push(c1W(st.from[0] + (st.to[0] - st.from[0]) * s, st.from[1] + (st.to[1] - st.from[1]) * s, ref + (st.r0 || 0) + ((st.r1 || 0) - (st.r0 || 0)) * s + sd)); } }
      else if (st.k === 'arc') { for (let i = 0; i <= 72; i++) { const a = (180 + (st.dir < 0 ? 1 : -1) * i * 5) * DEG; pts.push(c1W(st.c[0] + Math.sin(a) * st.R, st.c[1] + Math.cos(a) * st.R, ref + sd)); } }
      else { const at = st.at || st.pad; pts.push(c1W(at[0], at[1], sd), c1W(at[0], at[1], (st.k === 'climb' ? 5 : ref + 2) + sd)); }
      C1.aidLine.geometry.setFromPoints(pts); C1.aidLine.visible = true;
    }
  }
  _c1ui -= dt; if (_c1ui > 0) return; _c1ui = 0.1;
  const el = $('c1p'); if (!el || el.classList.contains('hidden')) return;
  const m = C1.M[C1.mi], M = c1M();
  $('c1T').textContent = (C1.exam ? L2('1종 모의평가', 'CLASS 1 · MOCK') : C1.demo ? L2('1종 시범비행', 'CLASS 1 · DEMO') : L2('1종 학습', 'CLASS 1 · LEARN')) + ' · ' + { gps: 'GPS', atti: 'ATTI', manual: 'MANUAL' }[C1.mode] + (C1.armed ? ' · ARMED' : ' · SAFE') + (C1.ref ? ` · ${L2('기준', 'REF')} ${C1.ref.toFixed(1)} m` : '');
  { const dots = m ? m.steps.map((x, i) => i < C1.si ? '●' : i === C1.si ? '◉' : '○').join('') : '';
    $('c1Mn').innerHTML = m ? `<span>${C1.mi + 1}/${C1.M.length} · ${m.name}</span><span class="dots">${dots}</span>` : '';
    const tp = $('c1Tip'), tip = m && C1TIP[m.id], key = m ? m.id + C1.mi : '';
    if (C1.tipKey !== key) { C1.tipKey = key; C1.tipT = C1.t; C1.tipOpen = null; }
    const open = C1.demo || (C1.tipOpen != null ? C1.tipOpen : C1.t - C1.tipT < 15);
    if (tip && !C1.exam) { tp.innerHTML = `<b>📘 ${L2('요령', 'How to')}${open ? '' : ' ▸'}</b> <span>${L2(tip[0], tip[1])}</span>`; tp.classList.toggle('open', open); } else tp.innerHTML = ''; }
  el.classList.toggle('map', !!SET.c1map && !C1.exam);
  $('c1St').textContent = st ? ((IS_TOUCH && m) ? `${C1.mi + 1}/${C1.M.length} · ` : '') + st.lab : '';
  { // 대화창: 시험위원 마지막 지시 → 내 구호 (외치기 버튼 / 말하는 중 / 완료) → 그 다음에 일어날 일
    const dg = $('c1Dlg'); let h = '';
    const callTx = st && st.call ? L2(st.call.ko, st.call.en) : '';
    const ex = C1.lastEx && SET.c1ann !== false ? C1.lastEx : '';
    if (ex) h += `<div class="ex"><b>📢 ${L2('시험위원', 'Examiner')}</b><span>${ex}</span></div>`;
    if (st && st.call && callTx) {
      const speaking = C1.t < (C1.meUntil || 0) - 0.1 && st.callSaid;
      if (st.k === 'inspect' && !st.callSaid) h += `<div class="me wait"><b>🗣 ${L2('응시자', 'Me')}</b><span>${L2('점검을 마치면 보고 구호가 자동으로 나갑니다', 'Report call is made for you after the check')}</span></div>`;
      else if (!st.callSaid) h += `<div class="me need"><b>🗣 ${L2('응시자', 'Me')}</b><span>“${callTx}”</span><button id="c1SayB">${L2('외치기', 'Say it')}<small>Q</small></button><i>${L2('🎤 직접 말해도 됩니다', '🎤 or say it yourself')}</i></div>`;
      else h += `<div class="me done"><b>🗣 ${L2('응시자', 'Me')}</b><span>“${callTx}”</span><em>${speaking ? L2('말하는 중…', 'speaking…') : '✓ ' + (st.callSaid === 'voice' ? L2('직접 말함', 'spoken') : st.callSaid === 'auto' ? L2('자동', 'auto') : L2('완료', 'done'))}</em></div>`;
      if (st.call.count) h += `<div class="nx">→ ${L2('도착해 멈추면 “정지. 하나…다섯” 은 자동으로', 'On arrival the “hold, one…five” count is automatic')}</div>`;
      else if (st.waitSay) h += `<div class="nx">→ ${L2('구호가 끝나면 다음 단계', 'Next step after the call')}</div>`;
    } else if (st && (st.k === 'prep' || st.k === 'arm' || st.k === 'disarm') && !C1.demo) h += `<div class="nx">→ ${L2('다음 ▶ (Enter) 로 진행', 'NEXT ▶ (Enter) to continue')}</div>`;
    if (C1V.heardT > 0) h += `<div class="nx">🎤 ${C1V.heard}</div>`;
    dg.innerHTML = h; dg.classList.toggle('hidden', !h);
    const cl = $('c1Cl'); const vs = c1VoiceStatus(); cl.innerHTML = vs ? `<i style="color:#ffb070">${vs}</i>` : ''; }
  { const co = $('c1Co'); if (co) co.innerHTML = (!C1.exam && !C1.demo && st) ? c1Coach(st, M) : ''; }
  const e = st && st.err, f = (x, d) => (x >= 0 ? '+' : '') + x.toFixed(d || 1), cls = (x, t) => Math.abs(x) <= t ? 'ok' : 'bad';
  let r = C1.exam ? `<b>${L2('스키드 높이', 'Skid h')}</b><span>${M.alt.toFixed(2)} m</span><b>${L2('기수', 'Heading')}</b><span>${c1Wrap(M.hdg).toFixed(0)}°</span>` : '';
  if (false) {
    if (e.lat != null) r += `<b>${L2('위치 오차', 'Pos err')}</b><span class="${cls(e.lat, c1R('posTol'))}">${f(e.lat, 2)} m</span>`;
    if (e.alt != null && st.k !== 'land' && st.k !== 'emg') r += `<b>${L2('고도 오차', 'Height err')}</b><span class="${cls(e.alt, c1R('altTol'))}">${f(e.alt, 2)} m</span>`;
    if (e.hdg != null) r += `<b>${L2('기수 오차', 'Hdg err')}</b><span class="${cls(e.hdg, st.k === 'emg' ? 45 : 15)}">${f(e.hdg, 0)}°</span>`;
    if (st.k === 'hold') r += `<b>${L2('정지', 'Hold')}</b><span class="${st.armedEval && st.t >= st.T ? 'ok' : ''}">${st.armedEval ? st.t.toFixed(1) : '–'} / ${st.T} s</span>`;
  }
  if (!C1.exam && m && m.fail) r += `<b>${L2('판정', 'Verdict')}</b><span class="bad">U · ${m.why.map(w => c1WhyTxt(w.why)).filter((x, i, a) => a.indexOf(x) === i).join(', ')}</span>`;
  if (st && st.k === 'rc') { const sn = st.seen || {}, ck = k => sn[k] ? '✓' : '·'; r = `<b>${L2('스로틀', 'Throttle')}</b><span>↑${ck('thr+')} ↓${ck('thr-')}</span><b>${L2('러더', 'Rudder')}</b><span>←${ck('yaw-')} →${ck('yaw+')}</span><b>${L2('엘리베이터', 'Elevator')}</b><span>↑${ck('pitch+')} ↓${ck('pitch-')}</span><b>${L2('에일러론', 'Aileron')}</b><span>←${ck('roll-')} →${ck('roll+')}</span><b>${L2('모드 스위치', 'Mode switch')}</b><span class="${C1.mode === 'gps' ? 'ok' : 'bad'}">${C1.mode.toUpperCase()}</span>`; }
  if (st && st.k === 'ctl') { const sn = st.seen || {}, ck = k => sn[k] ? '✓' : '·'; r += `<b>${L2('점검 조작', 'Checks')}</b><span>${L2('전', 'F')}${ck('p+')} ${L2('후', 'B')}${ck('p-')} ${L2('좌', 'L')}${ck('r-')} ${L2('우', 'R')}${ck('r+')} ${L2('러더', 'Rud')}${ck('y-')}${ck('y+')}</span>`; }
  if (st && st.k === 'arm' && st.csc) r += `<b>${L2('시동', 'Start')}</b><span>${L2('두 스틱 아래·안쪽 0.5초 (키보드 S+A+↓+→)', 'Both sticks down-in 0.5 s (keys S+A+↓+→)')}</span>`;
  { const needCall = !!(st && st.call && !st.callSaid && st.k !== 'inspect'), needOk = !C1.demo && !!(st && (st.k === 'prep' || (st.k === 'arm' && DR.landed) || (st.k === 'disarm' && DR.landed && Math.hypot(DR.v.x, DR.v.z) < 0.3)));
    const ob = $('c1Ok'); if (ob) ob.classList.toggle('need', needOk && !needCall); el.classList.toggle('demo', !!C1.demo); document.body.classList.toggle('c1demo', !!C1.demo); c1DemoBanner(m); }
  { const gp = $('c1Gp'); if (gp) { gp.textContent = C1.mode === 'gps' ? 'GPS ON' : C1.mode === 'atti' ? 'GPS OFF' : 'MANUAL'; gp.className = C1.mode === 'gps' ? 'on' : 'off'; } const hb = $('c1Hr'); if (hb) hb.textContent = '🕐 ' + (SET.c1hour || 11) + L2('시', ':00'); }
  if (st && st.k === 'hold' && st.armedEval) { const pc = Math.min(1, st.t / st.T); r += `<b>${L2('정지', 'Hold')}</b><span><i class="pb"><i style="width:${(pc * 100).toFixed(0)}%"></i></i> ${st.t.toFixed(1)} / ${st.T} s${pc >= 1 ? ' ✓' : ''}</span>`; }
  if (C1.ok && C1.ok.t > 0) r = `<span class="okf ${C1.ok.bad ? 'bad' : 'ok'}" style="grid-column:1/3">${C1.ok.text}</span>` + r;
  $('c1R').innerHTML = r; el.classList.toggle('chk', !!st && (st.k === 'rc' || st.k === 'ctl' || (st.k === 'arm' && st.csc)));
  $('c1Note').textContent = L2('1종 실기시험 기준 참고 연습용 · 공식 시험·교육시간 인정 여부 미확인', 'Reference practice for the class-1 practical test · not an official test or training hours') + (C1.exam ? '' : L2(' · 숫자 1~9 = 기동 바로가기 · N = 다음 단계', ' · keys 1–9 jump to a manoeuvre · N = next step'));
  const cv = $('c1Map'); if (cv && !C1.exam) c1DrawMap(cv, st, M); else if (cv) cv.style.display = 'none';
}
function c1DrawMap(cv, st, M) {
  cv.style.display = ''; const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height, ox = W2 / 2, oy = H2 - 14;
  const k = Math.min((H2 - 24) / 70, W2 / 40); const XX = u => ox + u * k, YY = v => oy - v * k;
  g.clearRect(0, 0, W2, H2); g.fillStyle = '#20301f'; g.fillRect(0, 0, W2, H2);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.strokeRect(XX(C1FIELD.u0), YY(C1FIELD.v1), (C1FIELD.u1 - C1FIELD.u0) * k, (C1FIELD.v1 - C1FIELD.v0) * k);
  g.beginPath(); g.arc(XX(0), YY(22.5), 7.5 * k, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,208,64,.5)'; g.beginPath(); g.arc(XX(0), YY(0), 14 * k, Math.PI, 2 * Math.PI); g.stroke();
  g.fillStyle = '#fff'; g.font = '10px system-ui'; g.textAlign = 'center';
  for (const [n, uv] of Object.entries(C1PT)) { const isPad = n === 'H' || n[0] === 'F'; g.fillStyle = isPad ? (n === 'H' ? '#9aa6b2' : '#c05050') : '#fff'; if (isPad) g.fillRect(XX(uv[0] - 1), YY(uv[1] + 1), 2 * k, 2 * k); else { g.beginPath(); g.arc(XX(uv[0]), YY(uv[1]), 2.5, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.fillText(n[0], XX(uv[0]) + 8, YY(uv[1]) - 3); }
  if (st && (st.at || st.to)) { const t = st.at || st.to; g.strokeStyle = '#5dff9a'; g.strokeRect(XX(t[0] - 1), YY(t[1] + (st.alongTol || 1)), 2 * k, 2 * (st.alongTol || 1) * k); }
  if (st && st.k === 'move') { g.strokeStyle = '#4fe3ff'; g.beginPath(); g.moveTo(XX(st.from[0]), YY(st.from[1])); g.lineTo(XX(st.to[0]), YY(st.to[1])); g.stroke(); }
  const x = XX(M.u), y = YY(M.v), h = M.hdg * DEG; g.fillStyle = '#ffc828'; g.beginPath(); g.moveTo(x + Math.sin(h) * 7, y - Math.cos(h) * 7); g.lineTo(x + Math.sin(h + 2.5) * 5, y - Math.cos(h + 2.5) * 5); g.lineTo(x + Math.sin(h - 2.5) * 5, y - Math.cos(h - 2.5) * 5); g.fill();
}
// 조종자 시점: P 에서 눈높이 · 기체를 따라 시선만 돌림 (육안 시점의 근사)
const _c1cg = new V3(), _c1ct = new V3(), _c1cv = new V3(), _c1cw = new V3();
function c1Camera(dt, subj) {
  if (!C1 || !isC1() || S.state === 'menu') return false;
  if (C1.view === 'chase' && !C1.exam) {
    const fw = new V3(Math.sin(subj.h), 0, -Math.cos(subj.h)), want = subj.p.clone().addScaledVector(fw, -7).add(new V3(0, 3, 0)); want.y = Math.max(want.y, C1S.y + 0.8);
    camPos.lerp(want, 1 - Math.exp(-dt * 5)); camera.position.copy(camPos); camLook.lerp(subj.p, 1 - Math.exp(-dt * 9)); camera.lookAt(camLook); camera.fov = 60; camera.near = 0.05; return true;
  }
  if (C1.introCam) {   // 대기 천막에서 시험장을 바라봄 (호명 방송 중)
    camera.position.copy(c1W(-9, -3.6, 1.7)); camLook.copy(c1W(0, 24, 2)); camera.up.set(0, 1, 0); camera.lookAt(camLook); camera.fov = 55; camera.near = 0.1; return true;
  }
  camera.position.copy(c1W(0, 0, c1p('eye')));
  // 기체와 그 아래 바닥(지점·고깔·그림자)이 함께 보이도록: 둘 사이를 바라보고 화각을 넓힘
  const gy = C1S.y, gp = _c1cg.set(subj.p.x, Math.min(subj.p.y, gy), subj.p.z), tgt = _c1ct.copy(subj.p).lerp(gp, 0.4);
  camLook.lerp(tgt, 1 - Math.exp(-dt * 7)); if (camLook.distanceTo(tgt) > 30) camLook.copy(tgt);
  camera.up.set(0, 1, 0); camera.lookAt(camLook);
  const d = camera.position.distanceTo(subj.p), a = _c1cv.copy(subj.p).sub(camera.position).angleTo(_c1cw.copy(gp).sub(camera.position)) / DEG;
  const want = clamp(Math.max(2 * Math.atan(7.5 / Math.max(d, 1)) / DEG, a * 1.7 + 6) * (SET.c1zoom || (C1.demo ? 0.75 : 1)), 24, 75);   // 시범비행은 조금 당겨서
  camera.fov += (want - camera.fov) * (1 - Math.exp(-dt * 3)); camera.near = 0.1;
  return true;
}

// ---- 결과 · 기록 ----
function c1Finish(why) {
  if (C1.over) return; C1.over = true; S.finished = true; S.running = false; if (REC) LAST_REC = recFinish();
  c1Ev('end', { why });
  setTimeout(() => {
    if (S.state !== 'run') return;
    S.state = 'result'; ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden'); c1Panel(false);
    $('resTitle').textContent = C1.exam ? L2('1종 모의평가 결과', 'CLASS 1 · MOCK CHECK') : L2('1종 학습 결과', 'CLASS 1 · PRACTICE');
    ui.resSub.textContent = `${pilotName()} · ${C1P.label[window.SIM_LANG === 'en' ? 'en' : 'ko']} · ${L2('기준고도', 'Ref height')} ${C1.ref ? C1.ref.toFixed(1) + ' m' : '–'}`;
    const V = m => m.unrated ? L2('교관 확인 필요', 'Instructor check') : m.skipped ? L2('미평가 (건너뜀)', 'Not rated (skipped)') : !m.done ? L2('미수행', 'Not flown') : m.fail ? 'U' : 'S';
    const rows = C1.M.map((m, i) => [`${i + 1}. ${m.name}`, `<b style="color:${m.unrated || m.skipped || !m.done ? '#c9a2ff' : m.fail ? '#ff7a5a' : '#5dff9a'}">${V(m)}</b>` + (m.fail ? ` <span class="dim">${m.why.map(w => c1WhyTxt(w.why)).filter((x, j, a) => a.indexOf(x) === j).join(', ')}</span>` : '')]);
    rows.push([L2('구술 (기체·조종자·공역·일반지식·이륙중 엔진고장 · 각 1문)', 'Oral (aircraft · pilot · airspace · general · engine failure on takeoff)'), L2('미평가 · 교관 확인 필요', 'Unrated · instructor')]);
    rows.push([L2('공중경계 · 계획성 · 판단력 · 규칙 준수 · 조작 원활성', 'Lookout · planning · judgement · rules · smoothness'), L2('미평가 · 교관 확인 필요', 'Unrated · instructor')]);
    { const calls = []; C1.M.forEach(m => m.steps.forEach(s => { if (s.call) calls.push(s); })); const v = calls.filter(s => s.callSaid === 'voice').length, b = calls.filter(s => s.callSaid === 'btn').length;
      rows.push([L2('구호 (교육 관행 예시 · 채점 외, "비상"만 기준서 필수)', 'Calls (training practice · not scored, only "emergency" is required)'), `${v + b} / ${calls.length} · ${L2('음성', 'voice')} ${v} · ${L2('버튼', 'button')} ${b}`]); }
    { const ins = C1.ev.find(e => e.type === 'inspect'); if (ins) rows.push([L2('비행 전 점검 판정', 'Pre-flight inspection'), (ins.fault ? L2('이상 항목: ', 'Fault: ') + ins.fault : L2('이상 없음', 'No fault')) + ' · ' + (ins.wrong.length ? `<b style="color:#ff7a5a">${L2('오판정 ', 'misjudged ')}${ins.wrong.join(', ')}</b>` : L2('판정 정확', 'judged correctly'))]); }
    { const o = C1.ev.filter(e => e.type === 'oral'); if (o.length) rows.push([L2('구술 (앱 예시 문항 · 앱 채점)', 'Oral (app examples · app-scored)'), `${o.filter(x => x.ok).length} / ${o.length}`]); }
    rows.push([L2('안전거리 14 m · 안전라인', 'Safety radius 14 m · line'), C1.safeBad ? `<b style="color:#ff7a5a">${L2('침범 기록 있음', 'Infringed')}</b>` : L2('침범 기록 없음', 'No infringement logged')]);
    rows.push([L2('비행 시간', 'Flight time'), fmt(S.t)], [L2('비상 강하 기준 속도', 'Emergency descent reference'), C1.refDesc ? C1.refDesc.toFixed(2) + ' m/s (' + L2('삼각 하강 평균', 'triangle descent mean') + ')' : c1R('emgRefDefault') + ' m/s (' + L2('앱 기본값', 'app default') + ')']);
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    const sc = $('resScore'); if (sc) sc.innerHTML = `<div style="color:#c9a2ff;font-size:13px;margin:6px 0">${L2('앱 모의판정 (규칙 ', 'App mock verdict (rules ')}${C1RULES.ver}) · ${L2('공식 시험 합격·자격 판정이 아닙니다', 'not an official pass or certificate')}<br>${C1DISC()}</div>`;
    const db = $('resDebrief'); if (db) db.innerHTML = `<h4>${L2('판정 근거 (이벤트)', 'Evidence (events)')}</h4>` + C1.ev.filter(e => e.type === 'U').slice(0, 30).map(e => `<div class="ln"><span>${fmt(e.t)} ${e.step}</span><span class="bad">${c1WhyTxt(e.why)}</span></div>`).join('') || '';
    ui.resBest.textContent = '';
    let b = $('c1Exp'); if (!b) { b = document.createElement('button'); b.id = 'c1Exp'; b.textContent = L2('기록 JSON 내보내기', 'Export log (JSON)'); $('bMenu2').parentNode.insertBefore(b, $('bMenu2')); b.onclick = c1Export; }
    b.style.display = '';
    c1Save();
  }, 1200);
}
function c1Log() {
  return { schema: 'c1-log-1', app: 'FPV Terrain Trainer · class-1 practice', when: new Date().toISOString(), mode: S.kind, exam: C1.exam, side: C1.side < 0 ? 'left-first' : 'right-first',
    profile: C1P, rules: C1RULES, ref: C1.ref, refDesc: C1.refDesc, wind: { level: WIND.lv, dir: [+WIND.dir.x.toFixed(3), +WIND.dir.z.toFixed(3)] }, t: +C1.t.toFixed(2),
    manoeuvres: C1.M.map(m => ({ id: m.id, name: m.name, done: !!m.done, verdict: m.unrated ? 'instructor' : m.skipped ? 'skipped' : !m.done ? 'not-flown' : m.fail ? 'U' : 'S', why: m.why })),
    events: C1.ev };
}
function c1Export() {
  try { const blob = new Blob([JSON.stringify(c1Log(), null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'class1_log_' + Date.now() + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  catch (e) { showMsg(L2('내보내기 실패', 'Export failed'), '#ff5050', 1.5); }
}
const C1_KEY = 'fpvsim_class1_runs_v1';   // 기존 기록과 섞이지 않는 새 저장 이름
function c1Save() {
  const L = c1Log(), sum = { when: L.when, mode: L.mode, side: L.side, ref: L.ref, profile: C1P.ver, rules: C1RULES.ver, t: L.t, v: L.manoeuvres.map(m => m.verdict) };
  try { const a = JSON.parse(localStorage.getItem(C1_KEY) || '[]'); a.unshift(sum); localStorage.setItem(C1_KEY, JSON.stringify(a.slice(0, 30))); }
  catch (e) { C1.memRuns = (C1.memRuns || []).concat([sum]); showMsg(L2('브라우저 저장 불가 · 이번 기록은 메모리에만', 'Storage blocked · kept in memory only'), '#ffc828', 2); }
}

// 임무별 허용 기체 목록에서 없는 기체는 뺌 (민간판에서 기체를 지운 경우 대비)
Object.keys(MS_OK).forEach(k => { MS_OK[k] = MS_OK[k].filter(id => AF[id]); });

// ---- 민간 일반 비행판 (window.SIM_CIVIL): 타격·자폭·투하·차량 추적 진입점과 기체·판정 연결을 끊음 ----
if (window.SIM_CIVIL) {
  for (const k of ['kfpv', 'kfw']) { delete AF[k]; const i = AF_IDS.indexOf(k); if (i >= 0) AF_IDS.splice(i, 1); }
  Object.keys(MS_OK).forEach(k => { MS_OK[k] = MS_OK[k].filter(id => AF[id]); });
  for (const k of ['strike', 'track']) { delete MS_OK[k]; delete MS_NAME[k]; }
  AF.x2d.drop = false; AF.x2d.note = L2('자세 안정 · 정지 비행', 'Stabilised · hover');
  if (!AF[SET.af]) SET.af = 'x2d';
  // 장애물 코스: 투하 과제를 빼고, 튜토리얼 단계의 과제 번호를 다시 맞춤 (투하만 있는 단계는 뺌)
  { const rm = new Set(); OBJS.forEach((o, i) => { if (o.kind === 'drop') rm.add(i); });
    const map = i => i - [...rm].filter(r => r < i).length;
    for (let li = LESSONS.length - 1; li >= 0; li--) { const L = LESSONS[li]; if (/투하|^Drop/i.test(L.title)) { LESSONS.splice(li, 1); continue; } if (!L.range) continue; const keep = []; for (let i = L.range[0]; i <= L.range[1]; i++) if (!rm.has(i)) keep.push(map(i)); if (keep.length) L.range = [keep[0], keep[keep.length - 1]]; }
    for (let i = OBJS.length - 1; i >= 0; i--) if (rm.has(i)) { if (OBJS[i].hint) OBJS[i].hint.visible = false; OBJS.splice(i, 1); }
    // 사람 실루엣·이동 표적 모형은 감추고 충돌도 끔
    for (const id of ['ivan_grp1', 'ivan_grp2', 'mit']) { const b = OBJ[id]; if (!b) continue; b.g.visible = false; const c0 = b.world(0, 0, 0); COLL.forEach(c => { if (c.c && c.c.distanceTo(c0) < (id === 'mit' ? 18 : 6)) c.off = true; }); }
  }
  dropPayload = function () { };                                                    // 투하 동작 없음
  const _sr = startRun; startRun = function (k) { if (k === 'strike' || k === 'track') k = 'free'; return _sr(k); };
  const _ss = scenStart; scenStart = function (k, a) { const L = _ss(k, a); return L && k === 'sar' ? L.filter(o => o.t !== 'sarkit') : L; };   // 수색: 키트 투하 단계 없음
  strikePick = function () { return []; };
}
