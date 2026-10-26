
// =====================================================================
//  game state
// =====================================================================
const MODES = {
  train: { name: 'TRAINING', gps: true, maxTilt: 25 * DEG, vmax: 9, yawRate: 95 * DEG, althold: true, brake: 2.6, assist: 1.0, autoYaw: true, margin: 0.22, hitPen: 2 },
  easy: { name: 'EASY', gps: true, maxTilt: 32 * DEG, vmax: 12, yawRate: 120 * DEG, althold: true, brake: 1.3, assist: 0.45, autoYaw: false, margin: 0.1, hitPen: 3 },
  // ATTI: 위치 유지(GPS) 없음 · 놓아도 안 멈추고 관성·바람으로 흐름 · 고도 유지만 · 부스트 없음 → 스틱을 민 만큼(기울기) 속도가 남
  atti: { name: 'ATTI', maxTilt: 30 * DEG, vmax: 12, yawRate: 110 * DEG, althold: true, brake: 0, assist: 0, autoYaw: false, margin: 0, hitPen: 3, atti: true },
  sport: { name: 'SPORT', maxTilt: 38 * DEG, vmax: 14, yawRate: 220 * DEG, althold: false, brake: 0, assist: 0, autoYaw: false, margin: 0, hitPen: 5 }
};
const ZOOMS = [{ d: 4.5, h: 1.5, fov: 62 }, { d: 2.6, h: 0.9, fov: 58 }, { d: 1.8, h: 0.6, fov: 56 }];   // 추적 카메라 거리 프리셋 (멀리·보통·가까이) · Z 키
// 추적 카메라: 거리는 슬라이더(SET.camDist, 1.5~8 m)로 이어서 조절, 프리셋(Z)은 슬라이더 값을 바꿔 줌
function zoomCfg() { const d = clamp(+SET.camDist || (ZOOMS[SET.zoom] || ZOOMS[1]).d, 1.5, 8); return { d, h: d * 0.34, fov: 56 + clamp((d - 2) / 4, 0, 1) * 7 }; }
const SET = { belly: true, guide: true, keymap: 'A', zoom: 1, diff: 'train', ghost: true, ghostSrc: 'ref', tilt: 15, showPath: false, light: false, assist: true, autoFull: true, af: 'x2d', acro: false, night: false, wind: 0, voice: true, vrMode: 1, vrModeW: 1, vrScreen: 'space', vrScr2: 1, vrCam: 'fpv', vrPip: 0, vrMap: true };
// 저장 구조: 일반 설정은 평탄, 종목별 설정은 하위 묶음 (c1: 1종 실기). 구버전(평탄 c1xxx 키)도 읽음
const SET_GROUPS = ['c1'];
try { const s = JSON.parse(localStorage.getItem('hroc_fpv_settings') || '{}'); for (const g of SET_GROUPS) { const sub = s[g]; delete s[g]; if (sub && typeof sub === 'object') for (const k in sub) SET[g + k] = sub[k]; } Object.assign(SET, s); } catch (e) { }
if (!SET.vrScr2) { SET.vrScreen = 'space'; SET.vrScr2 = 1; }   // VR 기본 화면: 공간 고정 (한 번 바꿔 줌, 그 뒤엔 고른 값 유지)
if (!MODES[SET.diff]) SET.diff = 'train';
// 비행 방식은 세 축으로 나눠 저장: 비행 모드(mode: gps·atti·man·acro) · 보조 단계(assistLv 2·1·0) · 비행감(feel: train·std·real). SET.diff/acro/assist 는 여기서 파생 (기존 코드 호환)
function modeSync() {
  if (!SET.mode) { SET.mode = SET.diff === 'atti' ? 'atti' : SET.diff === 'sport' ? (SET.acro ? 'acro' : 'man') : 'gps'; SET.assistLv = SET.diff === 'train' ? 2 : SET.diff === 'easy' ? 1 : 0; SET.feel = SET.diff === 'train' ? 'train' : SET.diff === 'easy' ? 'std' : 'real'; }
  if (!['train', 'std', 'real'].includes(SET.feel)) SET.feel = 'std'; if (SET.assistLv == null) SET.assistLv = 2;
  SET.diff = SET.mode === 'atti' ? 'atti' : SET.mode === 'gps' ? (SET.assistLv >= 2 ? 'train' : 'easy') : 'sport';
  SET.acro = SET.mode === 'acro'; SET.assist = SET.assistLv > 0;
}
function setDiff(v) {   // 옛 난이도 값 → 세 축 (VR 메뉴 등)
  SET.mode = v === 'atti' ? 'atti' : v === 'sport' ? (SET.mode === 'acro' ? 'acro' : 'man') : 'gps'; SET.assistLv = v === 'train' ? 2 : v === 'easy' ? 1 : 0; SET.feel = v === 'train' ? 'train' : v === 'easy' ? 'std' : 'real'; modeSync();
}
modeSync();
const SET_KEYS = ['camDist', 'rumble', 'mode', 'assistLv', 'feel', 'rates', 'ratesY', 'thrHover', 'fov', 'boostFov', 'belly', 'guide', 'keymap', 'zoom', 'diff', 'ghost', 'ghostSrc', 'tilt', 'assist', 'autoFull', 'af', 'acro', 'night', 'wind', 'voice', 'vrMode', 'vrScreen', 'vrCam', 'vrPip', 'vrMap', 'vrScr2', 'vrModeW', 'hud', 'expo', 'tod', 'wx', 'wxFx'];
function saveSet() {
  try { const o = {}; for (const k of SET_KEYS) if (SET[k] !== undefined) o[k] = SET[k];
    for (const g of SET_GROUPS) { const sub = {}; let n = 0; for (const k in SET) if (k.startsWith(g) && k.length > g.length && SET[k] !== undefined) { sub[k.slice(g.length)] = SET[k]; n++; } if (n) o[g] = sub; }   // 종목 설정은 접두사로 모아 묶음 (새 키를 따로 등록할 필요 없음)
    localStorage.setItem('hroc_fpv_settings', JSON.stringify(o)); } catch (e) { } }

const DR = { p: new V3(), v: new V3(), h: 0, pitch: 0, roll: 0, landed: true, thrust: 0, R: 0.24, alive: true };
const S = {
  state: 'menu', kind: 'course', t: 0, running: false, finished: false, objIdx: 0, objState: [], pen: 0, impacts: 0, payloads: 3,
  cam: 1, respawn: null, scan: 0, wasInside: false, landT: 0, simT: 0, ghostT: 0, demoEvents: 0, hits: 0, misses: 0,
  hitCD: 0, stun: 0, bumpT: 0, flyT: 0, scanned: false
};
const PAY = [];
const CAMS = ['FPV', 'CHASE', 'TOP'];

function resetDrone(pos, heading) {
  DR.p.copy(pos); DR.v.set(0, 0, 0); DR.h = heading; DR.pitch = 0; DR.roll = 0; DR.alive = true; DR.q = null; DR.w = null; DR.om = 0;
  DR.landed = pos.y <= groundAt(pos.x, pos.z) + 0.07; DR.thrust = 0; S.stun = 0;
  for (const k in ks) ks[k] = 0;
}
function startHead() { return -num(BY.pad_start.yaw, 0) * DEG; }
function startPos() { const ps = BY.pad_start; const p = W(ps.down, ps.side, 0); p.y = groundAt(p.x, p.z) + 0.06; return p; }
function startRun(kind) {
  enterFull(); if (typeof rvLoad === 'function') rvLoad();
  if (typeof c1Menu === 'function') c1Menu(kind);
  S.keysT = 0; S.keysShow = false; document.body.classList.toggle('calm', kind === 'tutorial' || (typeof isC1 === 'function' && isC1(kind)));   // 훈련·시험 모드는 차분한 톤
  S.kind = kind; S.state = kind === 'demo' ? 'demo' : 'run'; S.t = 0; S.running = false; S.finished = false; S.objIdx = 0;
  S.objState = OBJS.map(() => 0); S.objNear = -1; S.pen = 0; S.impacts = 0; S.payloads = 3; S.respawn = null; S.scan = 0; S.wasInside = false; S.landT = 0;
  S.ghostT = 0; S.demoEvents = 0; S.hits = 0; S.misses = 0; S.scanned = false; S.flyT = 0; S.hitCD = 0; S.orbSum = 0; S.orbA = null; S.boosting = false; S.bellyOv = null; BOOST.on = false; { const b = $('tbBoost'); if (b) b.classList.remove('on'); }
  PAY.forEach(p => scene.remove(p.m)); PAY.length = 0;
  droneM.cans.forEach(c => c.visible = true); ghostM.cans.forEach(c => c.visible = true);
  resetDrone(startPos(), startHead()); DR.R = AFc().R; droneM.g.visible = true;
  if (!isMission(kind)) { if (kind === 'free' && AFc().cls === 'wing' && typeof rwyMapView === 'function') rwyMapView(); else mapView('course'); }
  dbfStart(); if (kind !== 'demo') { S.lastKind = kind; LAST_REC = null; } ORDER.m = null; commReset();   // 이전 비행 기록·명령·무전이 섞이지 않게
  if (isMission(kind)) msStart(kind);
  else { Object.values(MSG).forEach(g => g.visible = false); STRIKE.forEach(t => t.col.off = true); MS.list = []; MS.launch = null; if (AFc().cls === 'wing' && typeof wingRwyOK === 'function' && wingRwyOK(AFc())) { wingGround(); MS.launch = { p: DR.p.clone(), h: DR.h }; } else if (AFc().cls === 'wing') { const p = startPos(); p.y += 30; wingAir(p, startHead()); } }
  if (kind === 'demo') S.cam = 1;
  S._fromDemo = kind === 'demo';
  OBJS.forEach(o => { if (o.hint) o.hint.visible = false; });
  ui.menu.classList.add('hidden'); ui.pause.classList.add('hidden'); ui.result.classList.add('hidden'); ui.hud.classList.remove('hidden'); lyApply();
  ui.list.classList.toggle('hidden', kind !== 'course' && !isMission(kind));
  renderList(); updateTags();
  S.tut = null; $('tut').classList.add('hidden'); $('rp').classList.add('hidden'); ui.hud.classList.remove('replaying');
  if (kind !== 'demo' && kind !== 'tutorial') recStart(); else REC = null;   // 모든 임무 기록 (리플레이·영상)
  showMsg(isMission(kind) ? MS_NAME[kind] + ' · ' + AFc().name : kind === 'course' ? ((IS_TOUCH || XR_ON) ? (XR_ON && vrStickMode() === 1 ? 'READY · 오른쪽 스틱 위로 이륙' : 'READY · 왼쪽 스틱 위로 이륙') : 'READY · ' + keyName(KB.up) + ' = TAKEOFF') : kind === 'free' ? 'FREE FLIGHT · ' + AFc().name : kind === 'tutorial' ? '' : 'REFERENCE FLIGHT', '#ffc828', 2.2);
  initAudio(); musicStart();
  COMM.q.length = 0; if (kind === 'course') setTimeout(() => comm(`${CS}, CONTROL. Course is clear, cleared for takeoff. ${WIND.lv ? 'Winds ' + (WIND.lv === 1 ? 'three' : 'seven') + ' meters per second. ' : ''}Over.`, '코스 이상 없음 · 이륙 허가'), 1500);
}
function curObj() {
  if (S.state === 'menu' || S.state === 'replay' || S.state === 'result') return null;
  if (S.kind === 'course') return OBJS[S.objIdx];
  if (S.kind === 'tutorial') return tutObj();
  if (isMission()) return msObj();
  return null;
}
function completeObj(status, msg, col) {
  const o = curObj(); if (!o) return;
  S.objState[S.objIdx] = status; dbfObj(o.label, status === 1);
  if (o.hint) o.hint.visible = false;
  S.respawn = { p: DR.p.clone(), h: DR.h };
  if (status === 1) sfx('good'); else sfx('bad');
  showMsg(msg || (o.label + (status === 1 ? ' ✓' : ' ✗')), col || (status === 1 ? '#5dff9a' : '#ff6060'), 1.4);
  S.objIdx++; S.scan = 0; S.wasInside = false; S.landT = 0; S.scanned = false; S.orbSum = 0; S.orbA = null;
  if (S.kind === 'tutorial') tutAfterObj(); else if (S.objIdx >= OBJS.length) finishRun(); else if (S.kind === 'course' && status === 1) courseCall(o, OBJS[S.objIdx]);
  renderList();
}
function finishRun() {
  S.finished = true; S.running = false;
  comm(`${CS}, CONTROL. Course complete, good flying. CONTROL out.`, '코스 완주 · 수고했음');
  const rec = recFinish();
  setTimeout(() => {
    if (S.state !== 'run') return;
    S.state = 'result'; ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden'); if ($('resTitle')) $('resTitle').textContent = 'COURSE COMPLETE'; { const rp = $('resPhotos'); if (rp) rp.style.display = 'none'; }
    const total = S.t + S.pen, done = S.objState.filter(v => v === 1).length;
    ui.resSub.textContent = `${pilotName()} · ${MODES[SET.diff].name} · 과제 ${done}/${OBJS.length} 성공`;
    const rows = [['비행 시간', fmt(S.t)], ['벌점', '+' + S.pen.toFixed(0) + ' s'], ['합계', fmt(total)], ['충돌', S.impacts + ' 회'],
      ['투하 명중', S.hits + ' / 3'], ['기준 비행 (영상)', fmt(GH.total)]];
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td></tr>`).join('');
    debriefShow(done, OBJS.length, GH.total * 1.25);
    const key = 'hroc_fpv_best_' + SET.diff + SITE_KEY; let best = null;
    try { best = parseFloat(localStorage.getItem(key)); } catch (e) { }
    if (!best || total < best) { try { localStorage.setItem(key, String(total)); } catch (e) { } saveBest(rec); ui.resBest.textContent = '★ 최고 기록 갱신 (리플레이·고스트로 저장됨)'; }
    else ui.resBest.textContent = '최고 기록 ' + fmt(best);
    refreshBest();
  }, 1600);
}
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; }

// ---------------- 충돌 = 벌점 + 튕김 (게임은 계속) ----------------
function impact(n, vn) {
  DR.v.addScaledVector(n, -vn * 1.4); DR.v.multiplyScalar(0.45);
  if (AFc().kam && S.state === 'run') { lostDrone('impact'); return; }   // 자폭기: 부딪히면 기폭
  if (S.hitCD > 0) return;
  S.hitCD = 0.8; S.impacts++; S.stun = 0.45; shake = 0.07;
  const pen = MODES[SET.diff].hitPen;
  if ((S.kind === 'course' || isMission()) && S.running) S.pen += pen;
  spawnImpact(DR.p.clone(), false, true); sfx('crash'); rumble(0.9, 0.6, 230);
  ui.flash.style.opacity = 0.3; setTimeout(() => { ui.flash.style.opacity = 0; }, 110);
  showMsg('IMPACT' + ((S.kind === 'course' || isMission()) && S.running ? ` +${pen}s` : ''), '#ff5050', 1.1);
}
function respawn() {
  if (S.state === 'run' && S.running) DBF.resp++;
  if (S.kind === 'tutorial' && S.tut) { const st = S.tut.startPose; const p = st.p.clone(); if (!st.landed) p.y = Math.max(p.y, groundAt(p.x, p.z) + 1.0); resetDrone(p, st.h); if (st.landed) DR.landed = true; S.scanned = false; S.scan = 0; S.wasInside = false; S.tut.hold = 0; if (LESSONS[S.tut.i].custom) S.tut.step = 0; else S.objIdx = LESSONS[S.tut.i].range[0]; PAY.forEach(p => scene.remove(p.m)); PAY.length = 0; droneM.cans.forEach(c => c.visible = true); tutRender(); return; }
  if (isMission() || AFc().cls === 'wing') {
    let p, h; const o = curObj();
    if (S.kind === 'strike' || !S.respawn) { p = (MS.launch ? MS.launch.p : startPos()).clone(); h = MS.launch ? MS.launch.h : startHead(); }
    else { p = S.respawn.p.clone(); h = S.respawn.h; }
    if (o && o.mk) { const d = o.mk.clone().sub(p); h = Math.atan2(d.x, -d.z); }
    if (AFc().cls === 'wing') { if (!MS.launch || S.respawn) p.y += 12; wingAir(p, h); } else { p.y = Math.max(p.y, groundAt(p.x, p.z) + 1.2); resetDrone(p, h); }
    DR.alive = true; droneM.g.visible = true; return;
  }
  let p, h;
  if (S.respawn) { p = S.respawn.p.clone(); h = S.respawn.h; p.y = Math.max(p.y, groundAt(p.x, p.z) + 1.2); }
  else { p = startPos(); h = startHead(); }
  const o = curObj();
  if (o && o.mk && S.respawn) { const d = o.mk.clone().sub(p); h = Math.atan2(d.x, -d.z); }
  resetDrone(p, h);
  if (S.kind !== 'course') droneM.cans.forEach(c => c.visible = true);
}

// =====================================================================
//  통과 대상 정보 (조준 표시 · 통과 보조 공용)
// =====================================================================
function openingOf(o) {
  if (!o) return null;
  const b = o.b;
  if (o.kind === 'pass') {
    const p = b.pass;
    if (p.kind === 'sq') return { b, lx: 0, lz: (p.z0 + p.z1) / 2, hx: (p.x1 - p.x0) / 2, hz: (p.z1 - p.z0) / 2, ly: 0 };
    if (p.kind === 'ring') return { b, lx: 0, lz: p.zc, hx: p.r, hz: p.r, ly: 0 };
    if (p.kind === 'tri') return { b, lx: 0, lz: p.A[1] + (p.C[1] - p.A[1]) / 3, hx: (p.B[0] - p.A[0]) / 2, hz: (p.C[1] - p.A[1]) / 2, ly: 0, czc: p.A[1] + (p.C[1] - p.A[1]) / 2 };
    if (p.kind === 'tunnel') return { b, lx: 0, lz: p.zc, hx: p.r, hz: p.r, ly: -p.L / 2 };
  }
  if (o.kind === 'slalom') return { b, lx: o.sg * 0.9, lz: 2.0, hx: 0.65, hz: 1.5, ly: 0, noVert: true };
  if (o.kind === 'bunker') {
    if (S.scanned) { const w2 = b.win2; return { b, side: true, lx: w2.x, ly: 0, lz: w2.zc, hx: (w2.y1 - w2.y0) / 2, hz: (w2.z1 - w2.z0) / 2 }; }
    const w = b.win; return { b, lx: w.xc, lz: w.zc, hx: (w.x1 - w.x0) / 2, hz: (w.z1 - w.z0) / 2, ly: w.y };
  }
  return null;
}

// =====================================================================
//  physics
// =====================================================================
const FWD = new V3(), RGT = new V3(), _ax = new V3(), _ay = new V3();
// 수색 과제: 구역(o.search) 안에 들어오면 정확한 위치 안내를 끔 (눈·열화상으로 찾기)
function searchIn(o, p) { return !!(o && o.search && o.mk && p && Math.hypot(o.mk.x - p.x, o.mk.z - p.z) < o.search.r); }
function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function stepDrone(dt) {
  if (!DR.alive) { deadTick(dt); return; }
  if (AFc().cls === 'wing') { stepWing(dt); return; }
  if (typeof isC1 === 'function' && isC1() && AFc().c1) { c1Phys(dt); return; }
  const md = effMode(), afc = AFc();
  if (md.acro) { stepAcro(dt); droneGround(dt); return; }
  DR.q = null;
  const grounded = DR.landed && IN.thr <= 0.05;
  const boost = !!IN.boost && !grounded && boostZone() && !md.atti; S.boosting = boost;
  const vmaxB = boost ? Math.max(md.vmax, afc.top) : md.vmax, tiltB = md.maxTilt + (boost ? 15 * DEG : 0);
  const k = G * Math.tan(tiltB) / vmaxB;
  // 반응: 실제 기체처럼 1초 안팎에 속도가 붙고 멈추도록 (최고 속도는 그대로, 가속·감속만 빠르게)
  const kk = md.atti ? k : Math.max(k, 1 / (SET.diff === 'train' ? 1.25 : SET.diff === 'easy' ? 1.0 : 0.85)), ksc = kk / k;   // ATTI: 공기 저항만으로 천천히 멈춤
  const a = 1 - Math.exp(-dt / 0.11);
  const stun = S.stun > 0 ? 0.25 : 1;
  let ip = IN.pitch * stun, ir = IN.roll * stun, iy = IN.yaw * stun;
  if (S.stun > 0) { ir += Math.sin(S.simT * 40) * 0.35; S.stun -= dt; }
  if (md.acro && !grounded) {   // 수동(Acro): 스틱 = 기울기 속도, 놓아도 수평으로 돌아오지 않음
    DR.pitch = clamp(DR.pitch + ip * 210 * DEG * dt, -80 * DEG, 80 * DEG); DR.roll = clamp(DR.roll + ir * 210 * DEG * dt, -80 * DEG, 80 * DEG);
  } else {
    DR.pitch += ((grounded ? 0 : ip * tiltB) - DR.pitch) * a;
    DR.roll += ((grounded ? 0 : ir * md.maxTilt) - DR.roll) * a;
  }
  const o = curObj(), assistOn = SET.assist && md.assist > 0;
  if (!grounded) {
    DR.h += iy * md.yawRate * dt;
    // 자동 방향 보조 (입문): 회전 입력이 없으면 다음 과제 쪽으로 천천히 돌아감
    if (md.autoYaw && assistOn && !IN.head && o && o.mk && !o.search && Math.abs(iy) < 0.05 && (Math.abs(ip) > 0.1 || Math.hypot(DR.v.x, DR.v.z) > 1.2)) {
      const op = openingOf(o); let tp = o.mk;
      if (op) tp = op.b.world(op.lx, op.ly - 0.0, op.lz);
      if (GUIDE.next) tp = GUIDE.next;
      const d = tp.clone().sub(DR.p); if (Math.hypot(d.x, d.z) > 1.5) {
        const want = Math.atan2(d.x, -d.z); const dh = wrapA(want - DR.h);
        DR.h += clamp(dh, -1, 1) * 55 * DEG * dt;
      }
    }
  }
  FWD.set(Math.sin(DR.h), 0, -Math.cos(DR.h)); RGT.set(Math.cos(DR.h), 0, Math.sin(DR.h));
  let vyAssist = 0;
  if (!grounded) {
    const af = G * Math.tan(DR.pitch), ar = G * Math.tan(DR.roll);
    const wv = windAt(DR.p); if (md.gps && SET.assist) wv.multiplyScalar(0.06);   // 바람: 공기에 대한 속도로 저항 · GPS 모드(입문·쉬움)는 기체가 바람을 거슬러 기울여 위치를 지킴
    DR.v.x += ((FWD.x * af + RGT.x * ar) * ksc - kk * (DR.v.x - wv.x)) * dt;
    DR.v.z += ((FWD.z * af + RGT.z * ar) * ksc - kk * (DR.v.z - wv.z)) * dt;
    // 브레이크 (스틱을 놓으면 멈춤)
    if (md.brake > 0 && Math.abs(ip) < 0.05 && Math.abs(ir) < 0.05) { const f = Math.exp(-md.brake * dt), w2 = windAt(DR.p), ww = !SET.assist ? 1 : md.gps ? 0 : 0.3; DR.v.x = w2.x * ww + (DR.v.x - w2.x * ww) * f; DR.v.z = w2.z * ww + (DR.v.z - w2.z * ww) * f; }
    // 통과 보조: 열린 곳 가운데로 살짝 끌어당김
    if (assistOn && o) {
      const op = openingOf(o);
      if (op && !op.side) {
        const l = op.b.local(DR.p), dly = l.ly - op.ly;
        _ax.copy(op.b.world(1, 0, 0)).sub(op.b.world(0, 0, 0));          // 물체 로컬 x (옆) 방향
        _ay.copy(op.b.world(0, 1, 0)).sub(op.b.world(0, 0, 0));          // 물체 로컬 y (통과) 방향
        const vf = DR.v.dot(_ay);
        if (dly > -10 && dly < 0.3 && vf > 0.6) {
          const f = md.assist * (1 - Math.max(0, -dly) / 10);
          const ex = l.lx - op.lx, vx = DR.v.dot(_ax);
          const acx = clamp(-ex * 3.2 - vx * 1.6, -6, 6) * f;
          DR.v.addScaledVector(_ax, acx * dt);
          if (!op.noVert) vyAssist = clamp(-(l.lz - op.lz) * 1.8, -2.5, 2.5) * f;
        }
      }
    }
  }
  if (md.althold) {
    let tv = IN.thr > 0 ? IN.thr * afc.climb : IN.thr * afc.sink;
    if (Math.abs(IN.thr) < 0.05) tv += vyAssist;
    // 지형 추종 (입문: 지면 위 높이 유지 / 쉬움: 오르막에서 부딪히지 않게만)
    if (TER.h && assistOn && Math.abs(IN.thr) < 0.05 && !grounded && vyAssist === 0) {   // 게이트 통과 보조 중엔 끔
      const la = 0.6, g0 = terrainAt(DR.p.x, DR.p.z), g1 = terrainAt(DR.p.x + DR.v.x * la, DR.p.z + DR.v.z * la), rate = (g1 - g0) / la;
      tv += md.autoYaw ? rate : Math.max(0, rate);
    }
    DR.v.y += (tv - DR.v.y) * (1 - Math.exp(-dt / 0.28));
    DR.thrust = clamp(0.5 + IN.thr * 0.35 + Math.hypot(DR.pitch, DR.roll) * 0.4, 0, 1);
    if (grounded) { DR.v.y = Math.min(DR.v.y, 0); DR.thrust = 0.08; }
  } else {
    const T = G * (1 + IN.thr * afc.tw);
    const ay = (grounded ? 0 : T * Math.cos(DR.pitch) * Math.cos(DR.roll) - G) - 0.35 * DR.v.y;
    DR.v.y += ay * dt; DR.thrust = grounded ? 0.08 : clamp(0.5 + IN.thr * 0.45, 0.05, 1);
    if (grounded) DR.v.y = Math.min(DR.v.y, 0);
  }
  droneGround(dt);
}
// ---- 수동(Acro) FPV 물리: 쿼터니언 자세 · Actual Rates · 추력 ∝ 회전수² · 모터 지연 · 2차 항력 (힘 기반, 플립·배면 가능) ----
const _qd = new THREE.Quaternion(), _bu = new V3(), _ar = new V3(), _ve = new THREE.Euler(0, 0, 0, 'YXZ');
function actualRate(x, c, m, e) { const a = Math.abs(x); return x * c + Math.max(0, m - c) * a * (Math.pow(x, 5) * e + x * (1 - e)); }   // Betaflight rc.c applyActualRates
const RATE_PRESET = { train: [55, 320, 0.4], std: [70, 670, 0.54], real: [70, 670, 0.54], racer: [200, 620, 0] };
function feelRates(ax) { const r = ax === 'y' ? (SET.ratesY || SET.rates) : SET.rates; return (r && r.length === 3) ? r : RATE_PRESET.std; }
function hoverThr(twr, idle) { return (Math.sqrt(1 / twr) - idle) / (1 - idle); }   // 정지 비행 스틱 위치 (0..1)
function thrHoverCenter() { const v = SET.thrHover || 'auto'; return v === 'auto' ? IN.src !== 'PAD' : v === '1'; }   // 키보드·터치는 중앙 = 정지 비행
function stepAcro(dt) {
  const afc = AFc(), m = afc.mass || 0.65, twr = afc.twr || 4.5, idle = 0.05, tauM = afc.tauM || 0.1, tauR = 0.04;
  if (!DR.q) { DR.q = new THREE.Quaternion(); eul.set(-DR.pitch, -DR.h, -DR.roll); DR.q.setFromEuler(eul); DR.w = new V3(); DR.om = DR.landed ? 0 : Math.sqrt(1 / twr); }
  const stun = S.stun > 0 ? 0.25 : 1; if (S.stun > 0) S.stun -= dt;
  // 스로틀 0..1: 조종기는 하단 = 아이들, 키보드·터치는 중앙 = 정지 비행 (Throttle Mid 와 같은 역할)
  let t01; const hs = hoverThr(twr, idle);
  if (!thrHoverCenter()) t01 = (IN.thr + 1) / 2; else t01 = IN.thr >= 0 ? hs + IN.thr * (1 - hs) : hs * (1 + IN.thr);
  const grounded = DR.landed && t01 < hs * 0.6;
  const u = grounded ? 0 : idle + (1 - idle) * clamp(t01, 0, 1);
  DR.om += (u - DR.om) * (1 - Math.exp(-dt / tauM));
  const T = twr * m * G * DR.om * DR.om;
  const [rc, rm, re] = feelRates('p'), [yc, ym, ye] = feelRates('y');
  const wp = actualRate(IN.pitch * stun, rc, rm, re) * DEG, wr = actualRate(IN.roll * stun, rc, rm, re) * DEG, wy = actualRate(IN.yaw * stun, yc, ym, ye) * DEG;
  const kr = 1 - Math.exp(-dt / tauR);
  DR.w.x += (wp - DR.w.x) * kr; DR.w.y += (wy - DR.w.y) * kr; DR.w.z += (wr - DR.w.z) * kr;
  if (!grounded) {   // 기체 축 회전: 앞으로 밀면 기수 내림(-X) · 오른쪽 요(-Y) · 오른쪽 롤(-Z)  (모델 좌표계: 앞 -Z · 오른쪽 +X · 위 +Y)
    _ar.set(-DR.w.x, -DR.w.y, -DR.w.z); const ang = _ar.length() * dt;
    if (ang > 1e-7) { _ar.normalize(); _qd.setFromAxisAngle(_ar, ang); DR.q.multiply(_qd).normalize(); }
  } else { _ve.setFromQuaternion(DR.q, 'YXZ'); eul.set(0, _ve.y, 0); DR.q.setFromEuler(eul); DR.w.set(0, 0, 0); }
  _ve.setFromQuaternion(DR.q, 'YXZ'); DR.pitch = -_ve.x; DR.h = -_ve.y; DR.roll = -_ve.z;
  _bu.set(0, 1, 0).applyQuaternion(DR.q); DR.upY = _bu.y;
  const wv = windAt(DR.p), rvx = DR.v.x - wv.x, rvy = DR.v.y - wv.y, rvz = DR.v.z - wv.z, sp = Math.hypot(rvx, rvy, rvz);
  const cda = afc.cda || (2 * m * G * Math.tan(60 * DEG) / (1.225 * afc.top * afc.top)), kq = 0.5 * 1.225 * cda / m, kl = 0.08;   // 최고 속도 = 60° 기울기에서 추력·항력 균형
  const aT = grounded ? 0 : T / m;
  DR.v.x += (_bu.x * aT - (kq * sp + kl) * rvx) * dt; DR.v.y += (_bu.y * aT - G - (kq * sp + kl) * rvy) * dt; DR.v.z += (_bu.z * aT - (kq * sp + kl) * rvz) * dt;
  if (grounded) { DR.v.y = Math.min(DR.v.y, 0); DR.v.x *= Math.exp(-9 * dt); DR.v.z *= Math.exp(-9 * dt); }
  DR.thrust = Math.max(0.05, DR.om); S.boosting = false;
  FWD.set(Math.sin(DR.h), 0, -Math.cos(DR.h)); RGT.set(Math.cos(DR.h), 0, Math.sin(DR.h));
}
// ---- 공통: 이동 · 지면 · 장애물 · 구역 경계 ----
function droneGround(dt) {
  DR.p.addScaledVector(DR.v, dt);
  // 지면
  const gh = groundAt(DR.p.x, DR.p.z) + 0.06;
  if (DR.p.y < gh) {
    const hs = Math.hypot(DR.v.x, DR.v.z), vy = DR.v.y;
    DR.p.y = gh;
    if (vy < -4.5 || hs > 7 || (DR.q && DR.upY < 0.6)) { impact(new V3(0, 1, 0), Math.min(vy, -2)); DR.v.y = Math.abs(vy) * 0.3; if (DR.q) { _ve.setFromQuaternion(DR.q, 'YXZ'); eul.set(0, _ve.y, 0); DR.q.setFromEuler(eul); DR.w.set(0, 0, 0); } }
    else { DR.v.y = Math.max(DR.v.y, 0); DR.v.x *= Math.exp(-9 * dt); DR.v.z *= Math.exp(-9 * dt); if (!DR.landed && vy < -0.8) rumble(0.25 + Math.min(0.4, -vy * 0.1), 0.2, 110); DR.landed = true; }
  } else if (DR.p.y > gh + 0.03) DR.landed = false;
  if (DR.p.y > gh + 120) { DR.p.y = gh + 120; DR.v.y = Math.min(DR.v.y, 0); }   // 지면 위 120 m 제한
  // 장애물
  for (let it = 0; it < 2; it++) {
    const hit = collide(DR.p, DR.R) || STREES.col(DR.p, DR.R); if (!hit) break;
    const vn = DR.v.dot(hit.n);
    DR.p.addScaledVector(hit.n, hit.pen + 0.003);
    if (vn < -2.5) impact(hit.n, vn);
    else { if (vn < 0) DR.v.addScaledVector(hit.n, -vn * 1.2); DR.v.multiplyScalar(0.85); if (S.bumpT <= 0) { sfx('bad'); rumble(0.45, 0.35, 120); S.bumpT = 0.4; } }
  }
  // 비행 구역 경계: 밀어냄
  const rx = DR.p.x, rz = DR.p.z + 150, l = Math.hypot(rx, rz);
  if (l > FLY_R) {
    const nx = rx / l, nz = rz / l; DR.p.x -= nx * (l - FLY_R); DR.p.z -= nz * (l - FLY_R);
    const vo = DR.v.x * nx + DR.v.z * nz; if (vo > 0) { DR.v.x -= nx * vo * 1.5; DR.v.z -= nz * vo * 1.5; }
    if (S.msgCD <= 0) { showMsg('AREA LIMIT', '#ff9a40', 1); S.msgCD = 2; }
  }
}
S.msgCD = 0;

// ---------------- payloads ----------------
function dropPayload(fromPos, fromVel, ghost) {
  if (!ghost && !AFc().drop) return;
  if (!ghost && isMission() && S.kind !== 'sar') { showMsg(L2x('투하 포드가 비어 있습니다', 'Payload pod is empty'), '#ff9a40', 1.2); sfx('bad'); return; }   // 투하가 필요 없는 임무
  const meshes = ghost && ghost !== 'demo' && ghost !== 'replay' ? ghostM.cans : droneM.cans;
  if (!ghost && S.kind === 'course' && S.payloads <= 0) { showMsg('NO PAYLOAD', '#ff6060', 1); sfx('bad'); return; }
  const can = meshes.find(c => c.visible); if (can) can.visible = false;
  if (!ghost && S.kind === 'course') S.payloads--;
  if (!ghost && S.kind === 'tutorial' && !meshes.some(c => c.visible)) setTimeout(() => droneM.cans.forEach(c => c.visible = true), 1500);   // 연습(튜토리얼)만 자동 보충
  if (!ghost && S.kind === 'free' && !can) { showMsg(L2x('투하물 없음 · 착륙하면 재장전', 'No payload · land to reload'), '#ff6060', 1.2); sfx('bad'); return; }
  if (!ghost && S.kind === 'sar') { if ((S.kits | 0) <= 0) { showMsg(L2x('구조 키트 없음', 'No rescue kits left'), '#ff6060', 1.2); sfx('bad'); return; } S.kits--; }
  if (!ghost) recEvent({ k: 'drop', p: [fromPos.x, fromPos.y, fromPos.z], v: [fromVel.x, fromVel.y, fromVel.z] });
  const kit = S.kind === 'sar';
  const m = kit ? new THREE.Mesh(UBOX, mat(0xff6a00, { roughness: 0.7 })) : new THREE.Mesh(UCYL, mat(0x7c8288, { roughness: 0.45, metalness: 0.5 })); if (kit) m.scale.set(0.12, 0.08, 0.16); else m.scale.set(0.022, 0.12, 0.022); m.castShadow = true;
  m.position.copy(fromPos).add(new V3(0, -0.08, 0)); scene.add(m);
  PAY.push({ m, v: fromVel.clone(), spin: new V3(Math.random() * 6, 0, Math.random() * 6), ghost, course: !ghost && (S.kind === 'course' || S.kind === 'tutorial'), kit });
  sfx('drop');
}
const _pp = new V3();
function updatePayloads(dt) {
  for (let i = PAY.length - 1; i >= 0; i--) {
    const P = PAY[i]; P.v.y -= G * dt; P.v.multiplyScalar(1 - 0.08 * dt);
    _pp.copy(P.m.position); P.m.position.addScaledVector(P.v, dt);
    P.m.rotation.x += P.spin.x * dt; P.m.rotation.z += P.spin.z * dt;
    const hitObj = collide(P.m.position, 0.03, c => c.tag === 'tank' || c.tag === 'ivan' || c.tag === 'mit' || c.tag === 'bunker' || c.tag === 'gate');
    const pg = groundAt(P.m.position.x, P.m.position.z) + 0.03;
    if (P.m.position.y <= pg || hitObj) {
      const pos = P.m.position.clone(); if (pos.y < pg) pos.y = pg;
      PAY.splice(i, 1);
      if (P.kit) { P.m.position.copy(pos); setTimeout(() => scene.remove(P.m), 20000); sarKit(pos); sfx('good'); continue; }
      scene.remove(P.m);
      spawnImpact(pos, true); sfx('bang');
      if (P.course) evalDrop(pos, hitObj);
      else if (S.kind === 'free' && !P.ghost) { const r = nearestTarget(pos); showMsg(r ? `${r.name} ${r.hit ? 'HIT' : 'MISS ' + r.d.toFixed(1) + ' m'}` : 'IMPACT', r && r.hit ? '#5dff9a' : '#ffc828', 1.4); }
    }
  }
}
function mitX(t) { const b = OBJ.mit; return b.amp * Math.sin(t * 3.5 / b.amp); }
function targetEval(name, pos, hitObj, mitT) {
  if (name === 'ivan') {
    const b = OBJ.ivan_grp1; let dm = 1e9;
    for (const bd of b.boards) { const w = b.world(bd[0], 0, 0); dm = Math.min(dm, Math.hypot(w.x - pos.x, w.z - pos.z)); }
    return { name: 'IVAN', d: dm, hit: dm <= 1.4 || !!(hitObj && hitObj.c.tag === 'ivan') };
  }
  if (name === 'mit') {
    const b = OBJ.mit; const w = b.world(mitT === undefined ? b.car.position.x : mitX(mitT), 0, 0); const d = Math.hypot(w.x - pos.x, w.z - pos.z);
    return { name: 'MIT', d, hit: d <= 1.6 || !!(hitObj && hitObj.c.tag === 'mit') };
  }
  const b = OBJ.tank, l = b.local(pos); const dx = Math.max(0, Math.abs(l.lx) - b.foot.x), dy = Math.max(0, Math.abs(l.ly) - b.foot.y);
  const d = Math.hypot(dx, dy); return { name: 'TANK', d, hit: d <= 0.6 || !!(hitObj && hitObj.c.tag === 'tank') };
}
function nearestTarget(pos, mitT) {
  let best = null; for (const n of ['ivan', 'mit', 'tank']) { const r = targetEval(n, pos, null, mitT); r.key = n; if (!best || r.d < best.d) best = r; }
  return best && best.d < 25 ? best : null;
}
function evalDrop(pos, hitObj) {
  const o = curObj();
  if (!o || o.kind !== 'drop') { refundPayload(o && o.kind === 'orbit' ? 'ORBIT FIRST · 투하물 낭비' : 'NOT A DROP TASK · 투하물 낭비'); return; }
  const r = targetEval(o.target, pos, hitObj);
  if (r.hit) { S.hits++; rumble(0.5, 1.0, 160); completeObj(1, `${r.name} HIT ✓`); return; }
  if (r.d > 25) { refundPayload(`TOO FAR (${r.d.toFixed(0)} m) · 투하물 낭비`); return; }
  if (S.kind === 'tutorial') { showMsg(`MISS ${r.d.toFixed(1)} m · 다시 시도`, '#ff9a40', 1.6); sfx('bad'); return; }
  // 한 번 투하하면 맞든 안 맞든 다음 과제로 (빗나가면 +10초)
  S.pen += S.kind === 'course' ? 10 : 0; S.misses++;
  completeObj(2, `MISS ${r.d.toFixed(1)} m${S.kind === 'course' ? ' · +10s' : ''} → NEXT`, '#ff9a40');
}
function refundPayload(msg) {   // 실제처럼: 한 번 떨어뜨린 투하물은 돌아오지 않음 (튜토리얼만 보충)
  if (S.kind === 'tutorial') { S.payloads = Math.min(3, S.payloads + 1); const c = droneM.cans.find(c => !c.visible); if (c) c.visible = true; }
  showMsg(msg + (S.kind === 'course' ? L2x(` · 남은 ${S.payloads}개`, ` · ${S.payloads} left`) : ''), '#ffc828', 1.8); sfx('bad');
}
// 드론 조명: 기본은 밤에 자동으로 켬 · L 키 / 패드 오른쪽 스틱 누르기 / VR X / 터치 💡 로 직접 켜고 끔
function lightOn() { return S.lightOv != null ? S.lightOv : (!!SET.light || (ENV.night && !ENV.ir)); }
function L2x(ko, en) { return window.SIM_LANG === 'en' ? en : ko; }
// 자유 비행: 착륙해서 2초 있으면 재장전
function reloadTick(dt) {
  if (S.state !== 'run' || S.kind !== 'free' || !AFc().drop || !DR.landed || droneM.cans.every(c => c.visible)) { S.reloadT = 0; return; }
  S.reloadT = (S.reloadT || 0) + dt; if (S.reloadT >= 2) { droneM.cans.forEach(c => c.visible = true); S.reloadT = 0; showMsg(L2x('재장전 완료', 'Reloaded'), '#5dff9a', 1.2); sfx('good'); }
}
// 부스트: 켜기/끄기 (어디서나 사용). 켜면 기체 최고 속도까지
const BOOST = { on: false };
function boostToggle(v) { BOOST.on = v === undefined ? !BOOST.on : !!v; const b = $('tbBoost'); if (b) b.classList.toggle('on', BOOST.on); if (S.state === 'run') showMsg(BOOST.on ? 'BOOST ON' : 'BOOST OFF', BOOST.on ? '#ff9a40' : '#9aa6ad', 0.8); }
function boostZone() { return true; }
function boostZoneOld() {
  if (S.kind === 'free') return true;
  const o = curObj(); if (!o || o.kind !== 'pass' || !o.b.pass || o.b.pass.kind !== 'tunnel') return false;
  return o.b.world(0, -o.b.pass.L / 2, o.b.pass.zc).distanceTo(DR.p) > 25;
}
// 낙하 예측 (공기저항 근사)
function predictImpact(p, v) {
  // 경사지: 낙하 지점의 지면 높이로 몇 번 반복해 맞춤
  let gy = groundAt(p.x, p.z), t = 0, kf = 1, x = p.x, z = p.z;
  for (let k = 0; k < 4; k++) {
    const h = Math.max(p.y - 0.11 - gy, 0), vy = v.y;
    t = (vy + Math.sqrt(vy * vy + 2 * G * h)) / G; kf = 1 - 0.04 * t;
    x = p.x + v.x * t * kf; z = p.z + v.z * t * kf; gy = groundAt(x, z);
  }
  return { p: new V3(x, gy + 0.03, z), t };
}

// ---------------- objectives check ----------------
const _prevP = new V3();
// 통과형 과제(게이트·슬라롬): 이번 프레임에 면을 지났는지 -> { inside, fwd, x } 또는 null
function passTest(o, prev, cur, mg) {
    const a = o.b.local(prev), b = o.b.local(cur);
    if ((a.ly < 0) === (b.ly < 0)) return null;
    const f = a.ly / (a.ly - b.ly), x = lerp(a.lx, b.lx, f), z = lerp(a.lz, b.lz, f), fwd = a.ly < 0;
    let inside = false;
    if (o.kind === 'slalom') inside = o.sg > 0 ? (x > 0.15 - mg && x < 6) : (x < -0.15 + mg && x > -6);
    else {
      const p = o.b.pass;
      if (p.kind === 'sq') inside = x > p.x0 - mg && x < p.x1 + mg && z > p.z0 - mg && z < p.z1 + mg;
      else if (p.kind === 'ring' || p.kind === 'tunnel') inside = Math.hypot(x, z - p.zc) < p.r + mg;
      else if (p.kind === 'tri') {
        const s = (P, Q) => (Q[0] - P[0]) * (z - P[1]) - (Q[1] - P[1]) * (x - P[0]); const s1 = s(p.A, p.B), s2 = s(p.B, p.C), s3 = s(p.C, p.A);
        inside = (s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0);
        if (!inside && mg > 0) { const cx = 0, cz = p.A[1] + (p.C[1] - p.A[1]) / 3; inside = Math.hypot(x - cx, z - cz) < (p.B[0] - p.A[0]) / (2 * Math.sqrt(3)) + mg; }
      }
    }
    return { inside, fwd, x };
}
function checkObjectives(prev, cur, dt) {
  const o = curObj(); if (!o || !DR.alive) return;
  const mg = MODES[SET.diff].margin;
  if (o.kind === 'custom') { tutCustomCheck(cur, dt); return; }
  if (o.kind === 'takeoff') { if (cur.y > groundAt(cur.x, cur.z) + 0.8) { S.running = true; completeObj(1, 'GO!', '#ffc828'); } return; }
  // 놓치고 지나감 -> 그 과제만 실패(✗)로 두고 다음 목표로 (벌점 없음)
  //  ① 다음·그다음 게이트를 제대로 통과했거나 ② 지금 과제 근처(20 m)에 왔다가 다음 과제까지 구간의 절반을 넘어감
  if (S.kind === 'course' && o.kind !== 'takeoff' && o.kind !== 'land') {
    for (let j = S.objIdx + 1; j <= Math.min(S.objIdx + 2, OBJS.length - 1); j++) {
      const q = OBJS[j]; if (q.kind !== 'pass' && q.kind !== 'slalom') continue;
      const r = passTest(q, prev, cur, mg); if (!(r && r.inside && r.fwd)) continue;
      const missed = [];
      for (let k = S.objIdx; k < j; k++) { S.objState[k] = 2; if (OBJS[k].hint) OBJS[k].hint.visible = false; missed.push(OBJS[k].label); }
      S.objIdx = j; S.scan = 0; S.wasInside = false; S.scanned = false; S.orbSum = 0; S.orbA = null;
      comm(`${CS}, CONTROL. You missed ${missed.length > 1 ? 'two obstacles' : 'one'}. Press on.`, `${missed.join(', ')} 실패 · 계속 진행`);
      completeObj(1, `${missed.join(' · ')} ✗ → ${q.label} ✓`, '#ff9a40');
      return;
    }
    const anc = q => q.kind === 'orbit' && q.b ? q.b.world(0, 0, 0) : q.mk;   // 오빗 안내점(mk)은 드론을 따라 원 위를 돌므로 탱크 중심으로 잼
    const oA = anc(o); let nx = null; for (let k = S.objIdx + 1; k < OBJS.length; k++) { const q = OBJS[k], qa = anc(q); if (q.kind !== 'drop' && qa && oA && Math.hypot(qa.x - oA.x, qa.z - oA.z) > 10) { nx = q; break; } }   // 방향은 고정된 다음 과제로 잼 (투하 표적은 움직이거나 같은 자리라 제외)
    if (nx && oA && !(o.kind === 'drop' && PAY.some(p => p.course))) {
      const A = oA, nA = anc(nx), dx = nA.x - A.x, dz = nA.z - A.z, L2 = dx * dx + dz * dz, dA = Math.hypot(cur.x - A.x, cur.z - A.z);
      if (dA < 20) S.objNear = S.objIdx;
      const u = L2 > 1 ? ((cur.x - A.x) * dx + (cur.z - A.z) * dz) / L2 : 0;
      if (((S.objNear === S.objIdx && u > 0.5) || u > 0.85) && !(o.kind === 'orbit' && dA < 26 && Math.abs(S.orbSum) > 0.3)) {   // 가까이 안 와도 다음 과제 쪽으로 85% 넘게 가면 건너뜀
        comm(`${CS}, CONTROL. You missed that one. Press on to the next.`, `${o.label} 실패 · 다음 목표로`);
        completeObj(2, `${o.label} ✗ → NEXT`, '#ff9a40'); return;
      }
    }
  }
  if (o.kind === 'pass' || o.kind === 'slalom') {
    const r = passTest(o, prev, cur, mg); if (!r) return;
    const { inside, fwd, x } = r;
    if (inside && fwd) completeObj(1);
    else if (inside && !fwd) { showMsg('WRONG WAY', '#ff6060', 1); sfx('bad'); }
    else if (o.kind === 'slalom' && fwd && Math.abs(x) < 6) { showMsg(`WRONG SIDE · ${o.sg > 0 ? 'RIGHT' : 'LEFT'}`, '#ff6060', 1.2); sfx('bad'); }
    return;
  }
  if (o.kind === 'orbit') {
    const c = o.b.world(0, 0, 0), dx = cur.x - c.x, dz = cur.z - c.z, r = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
    if (r > 5 && r < 24) { if (S.orbA !== null) S.orbSum += wrapA(ang - S.orbA); S.orbA = ang; } else S.orbA = null;
    if (Math.abs(S.orbSum) >= Math.PI * 2) completeObj(1, 'ORBIT ✓ · TOP ATTACK');
    return;
  }
  if (o.kind === 'drop') {
    if (S.payloads <= 0 && !PAY.some(p => p.course)) { S.pen += 15; completeObj(2, `${o.label} MISSED +15s`); }
    return;
  }
  if (o.kind === 'bunker') {
    const ins = insideBunker(cur);
    if (ins) { S.scan += dt; S.wasInside = true; if (S.scan >= 1.5 && !S.scanned) { S.scanned = true; showMsg('SCAN COMPLETE · EXIT', '#5dff9a', 1.8); sfx('chime'); } }
    else if (S.wasInside) {
      const l = o.b.local(cur);
      if (S.scanned) completeObj(1, l.lx < -o.b.inner.x ? 'RECON ✓ · LEFT WINDOW' : 'RECON ✓');
      else { S.wasInside = false; S.scan = 0; showMsg('SCAN INCOMPLETE', '#ff6060', 1); }
    }
    return;
  }
  if (o.kind === 'land') {
    const l = o.b.local(cur); const on = Math.hypot(l.lx, l.ly) < 0.62 + mg && DR.landed && DR.v.length() < 0.8;
    S.landT = on ? S.landT + dt : 0;
    if (S.landT > 0.8) completeObj(1, 'LANDED ✓');
  }
}
function insideBunker(p) {
  const b = OBJ.bunker1, l = b.local(p), n = b.inner;
  return Math.abs(l.lx) < n.x && l.ly > n.y0 && l.ly < n.y1 && l.lz < n.z && l.lz > 0;
}

// =====================================================================
//  cameras
// =====================================================================
const camPos = new V3(), camLook = new V3(), qBody = new THREE.Quaternion(), qTilt = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
let shake = 0, topH = 0;
function updateCamera(dt, subj) {
  if (typeof c1Camera === 'function' && c1Camera(dt, subj)) { if (shake > 0) { camera.position.add(new V3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0)); shake *= Math.exp(-dt * 8); } camera.updateProjectionMatrix(); return; }
  const mode = CAMS[S.cam];
  if (subj.q) qBody.copy(subj.q); else { eul.set(-visPitch(subj), -subj.h, -subj.roll); qBody.setFromEuler(eul); }
  const fwd = new V3(Math.sin(subj.h), 0, -Math.cos(subj.h));
  camera.up.set(0, 1, 0);
  if (mode === 'FPV') {
    qTilt.setFromAxisAngle(new V3(1, 0, 0), (AFc().cls === 'wing' ? 0 : SET.tilt) * DEG);
    camera.quaternion.copy(qBody).multiply(qTilt);
    camera.position.copy(subj.p).add(new V3(0, 0.02, -0.12).applyQuaternion(qBody));
    camera.fov = (SET.fov || 82) + (S.boosting && SET.boostFov !== 0 ? 8 : 0); camera.near = 0.03;
  } else if (mode === 'CHASE') {
    let want;
    if (insideBunker(subj.p)) {
      const b = OBJ.bunker1, n = b.inner;
      const lw = b.local(subj.p.clone().addScaledVector(fwd, -1.4).add(new V3(0, 0.35, 0)));
      want = b.world(clamp(lw.lx, -n.x + 0.18, n.x - 0.18), clamp(lw.ly, n.y0 + 0.18, n.y1 - 0.18), clamp(lw.lz, 0.4, n.z - 0.2));
      camPos.lerp(want, 1 - Math.exp(-dt * 12));
    } else {
      const Z = zoomCfg(); want = subj.p.clone().addScaledVector(fwd, -Z.d * camK()).add(new V3(0, Z.h * camK(), 0));
      want.y = Math.max(want.y, groundAt(want.x, want.z) + 0.35);
      camPos.lerp(want, 1 - Math.exp(-dt * 9));   // 가속할 때 카메라가 처져서 멀어 보이지 않게
    }
    camera.position.copy(camPos);
    camLook.lerp(subj.p.clone().addScaledVector(fwd, 1.5).add(new V3(0, 0.2, 0)), 1 - Math.exp(-dt * 9));
    camera.lookAt(camLook); camera.fov = zoomCfg().fov + (innerHeight > innerWidth ? 10 : 0) + (S.boosting && SET.boostFov !== 0 ? 9 : 0); camera.near = 0.05;
  } else {
    // TOP: 드론 뒤쪽 위에서 비스듬히 내려다봄 (방향은 천천히 따라감)
    topH += wrapA(subj.h - topH) * (1 - Math.exp(-dt * 1.8));
    const tf = new V3(Math.sin(topH), 0, -Math.cos(topH));
    const tz = [1.3, 1, 0.68][SET.zoom] || 1; const want = subj.p.clone().addScaledVector(tf, -7 * tz).add(new V3(0, 17 * tz, 0));
    camPos.lerp(want, 1 - Math.exp(-dt * 4));
    camera.position.copy(camPos);
    camLook.lerp(subj.p.clone().addScaledVector(tf, 4), 1 - Math.exp(-dt * 6));
    camera.lookAt(camLook); camera.fov = 55; camera.near = 0.1;
  }
  if (shake > 0) { camera.position.add(new V3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)); shake *= Math.exp(-dt * 8); }
  camera.updateProjectionMatrix();
}

// =====================================================================
//  HUD
// =====================================================================
const $ = id => document.getElementById(id);
const ui = {
  hud: $('hud'), osd: $('osd'), objNext: $('objNext'), objMsg: $('objMsg'), list: $('list'), map: $('map'), stk: $('stk'),
  payload: $('payload'), camTag: $('camTag'), modeTag: $('modeTag'), cross: $('cross'), arrow: $('arrow'), flash: $('flash'),
  menu: $('menu'), pause: $('pause'), result: $('result'), resSub: $('resSub'), resTable: $('resTable'), resBest: $('resBest'), best: $('best'),
  brk: $('brk'), brkLbl: $('brkLbl'), fpm: $('fpm'), scope: $('scope'), scopeC: $('scopeC'), scopeTxt: $('scopeTxt'), scopeBar: $('scopeBar')
};
let msgTimer = 0;
function showMsg(t, col, dur) { if (t) { S.lastMsg = t; S.lastMsgT = S.t; } if (t && REC) recEvent({ k: 'msg', text: t, col }); ui.objMsg.textContent = t; ui.objMsg.style.color = col || '#fff'; ui.objMsg.classList.add('show'); msgTimer = dur || 1.2; }
function renderList() {
  if (isMission()) { ui.list.innerHTML = msListHTML(); return; }
  if (S.kind !== 'course') { ui.list.innerHTML = ''; return; }
  let html = ''; const sl = OBJS.map((o, i) => o.kind === 'slalom' ? i : -1).filter(i => i >= 0);
  OBJS.forEach((o, i) => {
    if (o.kind === 'slalom') {
      if (i !== sl[0]) return;
      const st = sl.map(j => S.objState[j]); const cur = sl.includes(S.objIdx);
      const done = st.filter(v => v === 1).length, all = st.every(v => v > 0);
      html += `<div class="${cur ? 'cur' : all ? 'done' : ''}">${all ? '✓' : cur ? '▶' : '·'} SLALOM ${done}/6</div>`; return;
    }
    const s = S.objState[i]; const cls = i === S.objIdx ? 'cur' : s === 1 ? 'done' : s === 2 ? 'miss' : '';
    html += `<div class="${cls}">${s === 1 ? '✓' : s === 2 ? '✗' : i === S.objIdx ? '▶' : '·'} ${o.label}</div>`;
  });
  ui.list.innerHTML = html;
}
function updateTags() {
  ui.camTag.textContent = 'CAM ' + CAMS[S.cam];
  ui.modeTag.textContent = AFc().tag + ' · ' + (S.state === 'replay' ? 'REPLAY' : S.kind === 'tutorial' ? 'TUTORIAL · ' + MODES[SET.diff].name : S.kind === 'demo' ? 'REFERENCE' : (SET.acro && AFc().acro && SET.diff === 'sport' ? 'ACRO' : MODES[SET.diff].name) + (SET.assist && MODES[SET.diff].assist ? ' · ASSIST' : ''));
  ui.cross.classList.toggle('hidden', CAMS[S.cam] !== 'FPV');
}
// 미니맵
// 비행 구역: 중심 (down 150, side 0), 반지름 650 m (쿼드 경계) · 임무 사건은 이 안 (FLY_R_SAFE) 에만 둠
const FLY_C = { x: 0, z: -150 }, FLY_R = MID ? 1000 : 650, FLY_R_SAFE = MID ? 900 : 560;   // 중간 지형이 있으면 반경 1 km
function flyL(p) { return Math.hypot(p.x - FLY_C.x, p.z - FLY_C.z); }
const MAPV_COURSE = (function () {
  if (!CRS_C) return { d0: -24, d1: 340, s0: -112, s1: 90 };
  // 전용 코스: 경로·장애물을 다 담는 범위 (세로 300 : 가로 180 비율 유지)
  let d0 = 1e9, d1 = -1e9, s0 = 1e9, s1 = -1e9;
  for (const q of CRS_C.path.concat(D.objs.map(o => [o.down, o.side]))) { d0 = Math.min(d0, q[0]); d1 = Math.max(d1, q[0]); s0 = Math.min(s0, q[1]); s1 = Math.max(s1, q[1]); }
  d0 -= 30; d1 += 30; s0 -= 30; s1 += 30;
  const kd = (d1 - d0) / 300, ks = (s1 - s0) / 180, k = Math.max(kd, ks), dc = (d0 + d1) / 2, sc = (s0 + s1) / 2;
  return { d0: dc - 150 * k, d1: dc + 150 * k, s0: sc - 90 * k, s1: sc + 90 * k };
})();
let MAPV = MAPV_COURSE, mapBg = document.createElement('canvas'); mapBg.width = 180; mapBg.height = 300;
const MAP_CACHE = {};
function mxy(down, side) { return [(side - MAPV.s0) / (MAPV.s1 - MAPV.s0) * 180, (MAPV.d1 - down) / (MAPV.d1 - MAPV.d0) * 300]; }
function drawMapBg() {
  const g = mapBg.getContext('2d'); g.clearRect(0, 0, 180, 300);
  if (TER.h) {   // 음영기복 + 등고선 (5 m 간격, 25 m 마다 굵게)
    const id = g.createImageData(180, 300), kd = (MAPV.d1 - MAPV.d0) / 300, ks = (MAPV.s1 - MAPV.s0) / 180, CI = kd <= 1.6 ? 5 : kd <= 3.2 ? 10 : 20;   // 넓은 지도는 등고선 간격을 넓힘
    const hAt = (x, y) => terrainAt(MAPV.s0 + x * ks, -(MAPV.d1 - y * kd));
    for (let y = 0; y < 300; y++) for (let x = 0; x < 180; x++) {
      const z = hAt(x, y), zx = (hAt(x + 1, y) - hAt(x - 1, y)) / (2 * ks), zy = (hAt(x, y + 1) - hAt(x, y - 1)) / (2 * kd);
      const sh = Math.max(0, Math.min(1, 0.55 + (-zx + zy) * 0.6)), o = (y * 180 + x) * 4;
      const c0 = Math.floor(z / CI), lineA = [hAt(x + 1, y), hAt(x, y + 1)].some(v => Math.floor(v / CI) !== c0);
      const major = lineA && [hAt(x + 1, y), hAt(x, y + 1)].some(v => Math.floor(v / (CI * 5)) !== Math.floor(z / (CI * 5)));
      const v = 40 + sh * 70; id.data[o] = v * 0.9; id.data[o + 1] = v; id.data[o + 2] = v * 0.85; id.data[o + 3] = 150;
      if (lineA) { id.data[o] = 200; id.data[o + 1] = 170; id.data[o + 2] = 110; id.data[o + 3] = major ? 230 : 120; }
    }
    g.putImageData(id, 0, 0);
  }
  const rect = (d0, d1, s0, s1, c) => { const a = mxy(d1, s0), b = mxy(d0, s1); g.fillStyle = c; g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); };
  if (CRS_C) {   // 경로 + 100 m 눈금
    g.strokeStyle = 'rgba(255,200,40,.55)'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); CRS_C.path.forEach((q, i) => { const p = mxy(q[0], q[1]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '9px Menlo,monospace'; let acc = 0, nx = 100;
    for (let i = 1; i < CRS_C.path.length; i++) { const a = CRS_C.path[i - 1], b = CRS_C.path[i]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc >= nx) { const p = mxy(b[0], b[1]); g.fillRect(p[0] - 2, p[1] - 2, 4, 4); g.fillText(nx + 'm', p[0] + 5, p[1] + 3); nx += 100; } }
  } else {
  rect(-6, 335, -15, 15, 'rgba(255,200,40,.10)'); rect(0, 365, -64, -33, 'rgba(120,180,90,.12)');
  g.strokeStyle = 'rgba(255,200,40,.45)'; g.setLineDash([3, 3]); const a = mxy(335, -15), b = mxy(-6, 15); g.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); g.setLineDash([]);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.font = '9px Menlo,monospace';
  for (const d of [100, 200, 300]) { const p = mxy(d, -15); g.fillRect(p[0], p[1], 30 / (MAPV.s1 - MAPV.s0) * 180, 1); g.fillText(d + 'm', mxy(d, 17)[0], p[1] + 3); }
  }
  for (const o of D.objs) {
    const p = mxy(o.down, o.side);
    const col = { pad: '#fff', gate_sq: '#ffc828', gate_tri: '#ffc828', ring: '#ffc828', pole: '#e0b020', bunker: '#c09060', tunnel: '#9aa', tank: '#a3b26a', mit: '#a3b26a', ivan_group: '#a3b26a' }[o.type] || 'rgba(200,200,200,.45)';
    g.fillStyle = col; const s = ['building', 'hipbld', 'pavilion', 'bleacher', 'shelter', 'tank'].includes(o.type) ? 5 : 3; g.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
  }
  if (window.__RWY) {   // 활주로: 테두리 있는 흰 띠 + 이륙 방향 시단 표시 + RWY 글자
    if (window.__RWY.apron) {   // 계류장(회색) + 유도로 + H 패드(노란 점)
      const ap = window.__RWY.apron.map(v => mxy(-v.z, v.x)); g.fillStyle = 'rgba(170,170,160,.85)'; g.beginPath(); ap.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill();
      const A0 = window.__RWY.a, B0 = window.__RWY.b, m0 = mxy(-(A0.z + B0.z) / 2, (A0.x + B0.x) / 2), m1 = [(ap[0][0] + ap[1][0]) / 2, (ap[0][1] + ap[1][1]) / 2]; g.strokeStyle = 'rgba(80,80,80,.95)'; g.lineWidth = 2; g.beginPath(); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]); g.stroke();
      g.fillStyle = '#ffc828'; window.__RWY.pads.forEach(p => { const q = mxy(-p.z, p.x); g.beginPath(); g.arc(q[0], q[1], 1.8, 0, 6.283); g.fill(); });
    }
    const A = window.__RWY.a, B = window.__RWY.b, p = mxy(-A.z, A.x), q = mxy(-B.z, B.x), w = Math.max(3, 12 / (MAPV.s1 - MAPV.s0) * 180 * 1.6);
    g.setLineDash([]); g.lineCap = 'butt'; g.strokeStyle = 'rgba(10,12,14,.9)'; g.lineWidth = w + 2.5; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    g.strokeStyle = '#e8e8e2'; g.lineWidth = w; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    g.fillStyle = '#40ff70'; g.beginPath(); g.arc(p[0], p[1], 2.4, 0, 6.283); g.fill();
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = -(q[1] - p[1]), ny = q[0] - p[0], nl = Math.hypot(nx, ny) || 1;
    g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.7)'; g.fillText('RWY', mx + nx / nl * 11 + 0.8, my + ny / nl * 11 + 3.8); g.fillStyle = '#ffffff'; g.fillText('RWY', mx + nx / nl * 11, my + ny / nl * 11 + 3);
  }
  if (window.__OUTER) {   // 바깥 지역(임의): 길 · 건물
    const O = window.__OUTER; g.setLineDash([]); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const rd of O.roads) { g.strokeStyle = rd.w >= 6 ? 'rgba(235,225,200,.8)' : 'rgba(210,200,175,.6)'; g.lineWidth = rd.w >= 6 ? 1.6 : 1; g.beginPath(); rd.p.forEach(([x, z], i) => { const q = mxy(-z, x); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); }
    for (const [x, z, k] of O.blds) { const q = mxy(-z, x); g.fillStyle = k === 'gh' ? 'rgba(230,240,245,.85)' : k === 'shop' ? '#e0a040' : '#d8d0c0'; g.fillRect(q[0] - 1, q[1] - 1, 2, 2); }
  }
  // 비행 구역 경계 (점선 원)
  { const c = mxy(-FLY_C.z, FLY_C.x), e = mxy(-FLY_C.z + FLY_R, FLY_C.x), r = Math.abs(e[1] - c[1]); g.strokeStyle = 'rgba(255,90,90,.55)'; g.lineWidth = 1.2; g.setLineDash([5, 4]); g.beginPath(); g.arc(c[0], c[1], r, 0, 7); g.stroke(); g.setLineDash([]); }
}
drawMapBg(); MAP_CACHE.course = mapBg;
// 지도 범위: 코스 = 코스 둘레 / 임무 = 그 임무의 사건·구역이 다 들어오게 (배경은 한 번 만들어 둠)
// 지도 크게 보기: 지도 누르기(클릭·탭)·J 키·VR 메뉴 → 비행 구역 전체를 크게 · 다시 누르면 원래대로
const MAPZ = { on: false, keep: null };
function mapZoom(on) {
  if (on === MAPZ.on) return;
  if (on) { MAPZ.keep = { bg: mapBg, V: MAPV }; mapView('area', [[-FLY_C.z, FLY_C.x, FLY_R + 30]]); }
  else if (MAPZ.keep) { mapBg = MAPZ.keep.bg; MAPV = MAPZ.keep.V; MAPZ.keep = null; }
  MAPZ.on = on; ui.map.classList.toggle('big', on);
}
ui.map.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); mapZoom(!MAPZ.on); });
function mapView(key, pts, once) {
  if (MAPZ.on && key !== 'area') { MAPZ.on = false; MAPZ.keep = null; ui.map.classList.remove('big'); }   // 새 비행이 시작되면 기본 지도로
  if (!pts || !pts.length) key = 'course';
  if (MAP_CACHE[key] && !once) { mapBg = MAP_CACHE[key]; MAPV = MAP_CACHE[key].V; return; }
  let d0 = 1e9, d1 = -1e9, s0 = 1e9, s1 = -1e9;
  for (const [d, s, r] of pts) { d0 = Math.min(d0, d - (r || 0)); d1 = Math.max(d1, d + (r || 0)); s0 = Math.min(s0, s - (r || 0)); s1 = Math.max(s1, s + (r || 0)); }
  d0 -= 40; d1 += 40; s0 -= 40; s1 += 40;
  const kd = (d1 - d0) / 300, ks = (s1 - s0) / 180, k = Math.max(kd, ks, 1.0), dc = (d0 + d1) / 2, sc = (s0 + s1) / 2;
  MAPV = { d0: dc - 150 * k, d1: dc + 150 * k, s0: sc - 90 * k, s1: sc + 90 * k };
  mapBg = document.createElement('canvas'); mapBg.width = 180; mapBg.height = 300; drawMapBg(); mapBg.V = MAPV; if (!once) MAP_CACHE[key] = mapBg;
}
MAP_CACHE.course.V = MAPV_COURSE;
function drawMap(gpos) {
  const g = ui.map.getContext('2d'); g.clearRect(0, 0, 180, 300); g.drawImage(mapBg, 0, 0);
  const toDS = p => [-p.z, p.x];
  const o = curObj();
  if (o && o.mk && o.search) { const [d, s] = toDS(o.mk); const p = mxy(d, s), q = mxy(d + o.search.r, s), rr = Math.max(5, Math.hypot(q[0] - p[0], q[1] - p[1])); g.strokeStyle = 'rgba(255,200,40,.9)'; g.fillStyle = 'rgba(255,200,40,.14)'; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.beginPath(); g.arc(p[0], p[1], rr, 0, 7); g.fill(); g.stroke(); g.setLineDash([]); }
  // 산불: 다른 신고 구역(번호)과 보고 끝난 불씨(✓) 도 지도에
  if (S.kind === 'fire' && isMission() && MS.list) { g.font = '700 10px monospace'; MS.list.forEach((x, i) => { if (!x.mk) return;
    if (x.done) { const q = mxy(...toDS(x.tp)); g.fillStyle = '#9aa6ad'; g.fillText('✓' + (i + 1), q[0] + 3, q[1] - 2); g.beginPath(); g.arc(q[0], q[1], 2, 0, 7); g.fill(); return; }
    if (!x.active) return; const p = mxy(...toDS(x.mk)); if (x !== o) { const q = mxy(...toDS(x.mk.clone().add(new V3(0, 0, -x.search.r)))), rr = Math.max(5, Math.hypot(q[0] - p[0], q[1] - p[1])); g.strokeStyle = 'rgba(255,200,40,.5)'; g.setLineDash([3, 3]); g.beginPath(); g.arc(p[0], p[1], rr, 0, 7); g.stroke(); g.setLineDash([]); }
    g.fillStyle = '#ffc828'; g.fillText(String(i + 1), p[0] - 3, p[1] + 4); }); }
  if (o && o.mk && o.search && S.kind === 'sar') { const p = mxy(...toDS(o.mk)); g.font = '700 10px monospace'; g.fillStyle = '#ffc828'; g.fillText('SAR', p[0] - 9, p[1] + 4); }
  else if (o && o.mk && !o.search) { const [d, s] = toDS(o.mk); const p = mxy(d, s); g.strokeStyle = '#ffc828'; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], 6 + Math.sin(performance.now() / 200) * 1.5, 0, 7); g.stroke(); }
  if (gpos) { const [d, s] = toDS(gpos); const p = mxy(d, s); g.fillStyle = '#4fe3ff'; g.beginPath(); g.arc(p[0], p[1], 3, 0, 7); g.fill(); }
  if (S.state !== 'demo') {
    const src = S.state === 'replay' ? RP.pose : DR;
    const [d, s] = toDS(src.p); const p = mxy(d, s); g.save(); g.translate(clamp(p[0], 4, 176), clamp(p[1], 4, 296));
    const pu = 7 + (performance.now() / 120 % 8); g.strokeStyle = `rgba(255,60,90,${0.9 - (pu - 7) / 9})`; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, pu, 0, 7); g.stroke();   // 퍼지는 고리
    g.rotate(src.h); g.fillStyle = '#ff2d55'; g.strokeStyle = '#000'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 7); g.lineTo(0, 3); g.lineTo(-7, 7); g.closePath(); g.stroke(); g.fill(); g.restore();
  }
}
function drawSticks() {
  const g = ui.stk.getContext('2d'); g.clearRect(0, 0, 150, 70);
  const box = (x, sx, sy) => {
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.strokeRect(x, 4, 62, 62); g.beginPath(); g.moveTo(x + 31, 4); g.lineTo(x + 31, 66); g.moveTo(x, 35); g.lineTo(x + 62, 35); g.strokeStyle = 'rgba(255,255,255,.12)'; g.stroke();
    g.lineWidth = 2.2; g.strokeStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(x + 31 - 7, 35); g.lineTo(x + 31 + 7, 35); g.moveTo(x + 31, 35 - 7); g.lineTo(x + 31, 35 + 7); g.stroke(); g.lineWidth = 1;   // 가운데(중립) 십자
    g.fillStyle = '#ffc828'; g.beginPath(); g.arc(x + 31 + sx * 27, 35 - sy * 27, 5, 0, 7); g.fill();
  };
  box(4, IN.yaw, IN.thr); box(82, IN.roll, IN.pitch);
}
// 화면 좌표
const _np = new V3();
function toScreen(p) { _np.copy(p).project(camera); return { x: (_np.x + 1) / 2 * innerWidth, y: (1 - _np.y) / 2 * innerHeight, behind: _np.z > 1 }; }
// 낙하 예측점 표시 (3D)
const impactRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0xffc828, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
impactRing.rotation.x = -Math.PI / 2; impactRing.renderOrder = 6; impactRing.visible = false; scene.add(impactRing);
function updateTargeting(subj) {
  const o = curObj(), fpv = CAMS[S.cam] === 'FPV', running = S.state === 'run' && DR.alive && !(S.tut && S.tut.st === 'intro');
  // 1) 게이트 조준 브래킷 + 비행 방향 표시
  const op = running ? openingOf(o) : null;
  let fpmPos = null;
  if (running && fpv && DR.v.length() > 1.0) {
    const s = toScreen(DR.p.clone().addScaledVector(DR.v, 1.2));
    if (!s.behind) { fpmPos = s; ui.fpm.style.left = (s.x - 14) + 'px'; ui.fpm.style.top = (s.y - 8) + 'px'; }
  }
  ui.fpm.classList.toggle('hidden', !fpmPos);
  if (op && CAMS[S.cam] !== 'TOP') {
    const b = op.b, cz = op.czc !== undefined ? op.czc : op.lz;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => toScreen(op.side ? b.world(op.lx, op.ly + sx * op.hx, cz + sz * op.hz) : b.world(op.lx + sx * op.hx, op.ly, cz + sz * op.hz)));
    const c = b.world(op.lx, op.ly, op.lz), dist = c.distanceTo(subj.p);
    if (pts.every(p => !p.behind) && dist < 60) {
      let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
      const mw = 28; if (x1 - x0 < mw) { const m = (x0 + x1) / 2; x0 = m - mw / 2; x1 = m + mw / 2; } if (y1 - y0 < mw) { const m = (y0 + y1) / 2; y0 = m - mw / 2; y1 = m + mw / 2; }
      ui.brk.classList.remove('hidden');
      Object.assign(ui.brk.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
      // 정렬 여부: 비행 방향 표시(또는 화면 중앙)가 브래킷 안에 있는지
      const ref = fpmPos || { x: innerWidth / 2, y: innerHeight / 2 };
      const ok = ref.x > x0 && ref.x < x1 && ref.y > y0 && ref.y < y1;
      ui.brk.classList.toggle('ok', ok);
      ui.brkLbl.textContent = `${dist.toFixed(0)} m`;
    } else ui.brk.classList.add('hidden');
  } else ui.brk.classList.add('hidden');
  // 2) 투하 조준경
  let tgtKey = null;
  if (running && o && o.kind === 'drop') tgtKey = o.target;
  const pr = running ? predictImpact(DR.p, DR.v) : null;
  if (running && (S.kind === 'free' || (S.kind === 'tutorial' && !tgtKey))) { const n = nearestTarget(pr.p, S.simT + pr.t); if (n && n.d < 18) tgtKey = n.key; }
  $('keys').classList.toggle('hidden', !!(tgtKey && pr));
  { const kEl = $('keys'); if (kEl) kEl.classList.toggle('fade', S.t > 45 && !S.keysShow && S.state === 'run'); }   // 조작 안내: 비행 45초 뒤 서서히 숨김 (? 또는 F1 로 다시)
  if (!tgtKey || !pr) { ui.scope.classList.add('hidden'); impactRing.visible = false; return; }
  const ev = targetEval(tgtKey, pr.p, null, S.simT + pr.t);
  ui.scope.classList.remove('hidden');
  impactRing.visible = true; impactRing.position.copy(pr.p).setY(pr.p.y + 0.03);
  impactRing.material.color.set(ev.hit ? 0x5dff9a : 0xffc828);
  const g = ui.scopeC.getContext('2d'), Wd = 170, sc = 170 / 30;   // 30 m 폭
  g.clearRect(0, 0, Wd, Wd); g.save(); g.translate(Wd / 2, Wd / 2);
  g.strokeStyle = 'rgba(255,255,255,.18)'; for (const r of [5, 10]) { g.beginPath(); g.arc(0, 0, r * sc, 0, 7); g.stroke(); }
  g.beginPath(); g.moveTo(-Wd / 2, 0); g.lineTo(Wd / 2, 0); g.moveTo(0, -Wd / 2); g.lineTo(0, Wd / 2); g.stroke();
  const f = new V3(Math.sin(DR.h), 0, -Math.cos(DR.h)), rgt = new V3(Math.cos(DR.h), 0, Math.sin(DR.h));
  const S2 = w => { const d = new V3(w.x - pr.p.x, 0, w.z - pr.p.z); return [d.dot(rgt) * sc, -d.dot(f) * sc]; };
  g.fillStyle = ev.hit ? '#5dff9a' : '#ff6a5a'; g.strokeStyle = g.fillStyle;
  if (tgtKey === 'ivan') { const b = OBJ.ivan_grp1; for (const bd of b.boards) { const [x, y] = S2(b.world(bd[0], 0, 0)); g.fillRect(x - 3, y - 3, 6, 6); g.beginPath(); g.arc(x, y, 1.4 * sc, 0, 7); g.stroke(); } }
  else if (tgtKey === 'mit') { const b = OBJ.mit; const [x, y] = S2(b.world(mitX(S.simT + pr.t), 0, 0)); g.fillRect(x - 3, y - 3, 6, 6); g.beginPath(); g.arc(x, y, 1.6 * sc, 0, 7); g.stroke(); const [x2, y2] = S2(b.world(b.car.position.x, 0, 0)); g.globalAlpha = 0.4; g.fillRect(x2 - 2, y2 - 2, 4, 4); g.globalAlpha = 1; }
  else { const b = OBJ.tank, fx = b.foot.x + 0.6, fy = b.foot.y + 0.6; const cs = [[-fx, -fy], [fx, -fy], [fx, fy], [-fx, fy]].map(([x, y]) => S2(b.world(x, y, 0))); g.beginPath(); cs.forEach((c, i) => i ? g.lineTo(c[0], c[1]) : g.moveTo(c[0], c[1])); g.closePath(); g.stroke(); g.globalAlpha = 0.18; g.fill(); g.globalAlpha = 1; }
  g.strokeStyle = '#ffc828'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.moveTo(0, -8); g.lineTo(0, 8); g.stroke(); g.lineWidth = 1;
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(0, -Wd / 2 + 4); g.lineTo(5, -Wd / 2 + 12); g.lineTo(-5, -Wd / 2 + 12); g.fill();
  g.restore();
  ui.scopeTxt.innerHTML = ev.hit ? '<b style="color:#5dff9a">DROP NOW</b>' : `${ev.name} · OFFSET ${ev.d.toFixed(1)} m · ${pr.t.toFixed(1)} s`;
  ui.scopeBar.style.width = (clamp(1 - ev.d / 15, 0, 1) * 100) + '%';
  ui.scopeBar.style.background = ev.hit ? '#5dff9a' : '#ffc828';
  ui.scope.classList.toggle('ok', ev.hit);
}
function updateHUD(dt, subj) {
  msgTimer -= dt; if (msgTimer <= 0) ui.objMsg.classList.remove('show');
  const spd = subj.v ? subj.v.length() * 3.6 : 0;
  const o = curObj();
  const sIn = searchIn(o, subj.p), dist = o && o.mk && !sIn ? (o.search ? Math.max(0, Math.hypot(o.mk.x - subj.p.x, o.mk.z - subj.p.z) - o.search.r) : o.mk.distanceTo(subj.p)) : null;
  const tm = S.state === 'replay' ? RP.t - RP.rec.s[0][0] : (S.kind === 'course' || isMission()) ? S.t : S.kind === 'demo' ? S.ghostT : S.flyT;
  ui.osd.innerHTML = `<div class="big">${fmt(tm)}${(S.kind === 'course' || isMission()) && S.pen ? ` <span style="color:#ff7070;font-size:16px">+${S.pen}s</span>` : ''}</div>` +
    `<div><b>ALT</b>${Math.max(0, agl(subj.p) - 0.06).toFixed(1)} m${TER.h ? ` <span style="color:#9aa6ad;font-size:.75em">MSL ${(subj.p.y + SITE.base).toFixed(0)}</span>` : ''}</div>` + `<div><b>SPD</b>${spd.toFixed(0)} km/h</div>` +
    (dist !== null ? `<div><b>${o.search ? 'AREA' : 'DIST'}</b>${dist.toFixed(0)} m</div>` : sIn ? `<div style="color:#ffc828">${L2x('수색 구역 안', 'IN SEARCH AREA')}</div>` : '') +
    (S.kind === 'course' ? `<div><b>HIT</b>${S.impacts}</div>` : '') +
    (o && o.kind === 'orbit' ? `<div style="color:#4fe3ff">ORBIT ${Math.min(100, Math.abs(S.orbSum) / (Math.PI * 2) * 100).toFixed(0)}%</div>` : '') +
    (S.state === 'run' && (isMission() || AFc().cls === 'wing') ? msOsd() : '') + (S.state === 'run' ? windOsd(subj.p) : '') +
    (S.boosting ? '<div style="color:#ff9a40">BOOST ▲▲</div>' : '') +
    (S.state !== 'demo' && insideBunker(subj.p) ? `<div style="color:#5dff9a">SCAN ${Math.min(100, S.scan / 1.5 * 100).toFixed(0)}%</div>` : '');
  if (S.kind === 'course') {
    ui.objNext.style.display = '';
    ui.objNext.innerHTML = o ? `NEXT ▸ ${o.label}<small>${S.objIdx + 1}/${OBJS.length}</small>` : 'COURSE COMPLETE';
  } else if (isMission() && S.state !== 'replay') { ui.objNext.style.display = ''; ui.objNext.innerHTML = o ? `NEXT ▸ ${o.label}<small>${MS.idx + 1}/${MS.list.length}</small>` : 'MISSION COMPLETE'; }
  else if (S.kind === 'tutorial' && S.tut) { ui.objNext.style.display = ''; ui.objNext.innerHTML = `LESSON ${S.tut.i + 1} ▸ ${o ? o.label : 'COMPLETE'}`; }
  else if (S.state === 'replay') { ui.objNext.style.display = ''; ui.objNext.innerHTML = `REPLAY <small>${RP.rec.kind === 'course' ? MODES[RP.rec.diff] ? MODES[RP.rec.diff].name : '' : 'FREE'} ×${RP.speed}</small>`; }
  else if (S.kind === 'demo') { ui.objNext.style.display = ''; ui.objNext.innerHTML = `REFERENCE FLIGHT <small>${fmt(S.ghostT)} / ${fmt(GH.total)}</small>`; }
  else ui.objNext.style.display = 'none';
  const podE = isMission() && S.kind !== 'sar' && S.state === 'run', kitM = S.kind === 'sar' && S.state === 'run', n = podE ? 0 : kitM ? S.kits | 0 : S.kind === 'course' && S.state === 'run' ? S.payloads : droneM.cans.filter(c => c.visible).length;
  const ak = actionKind(); ui.payload.innerHTML = ak === 'report' ? '📷 REPORT' : podE ? 'POD —' : (kitM ? 'KIT ' : 'M84 ') + [0, 1, 2].slice(0, kitM ? 2 : 3).map(i => `<i class="${i < n ? '' : 'used'}"></i>`).join('');
  ui.arrow.classList.add('hidden');   // 예전 가장자리 삼각형은 navArrow(game3d, 방향+거리) 로 대체
  drawSticks();
  updateTargeting(subj);
}

// =====================================================================
//  ghost / main loop
// =====================================================================
const ghostS = { p: new V3(), v: new V3(), h: 0, pitch: 0, roll: 0 };
const _gp = new V3(), _gn = new V3();
function updateGhost(t, dt) {
  GH.at(t, _gp); GH.at(t + 0.15, _gn);
  const vel = _gn.clone().sub(_gp).divideScalar(0.15);
  const hs = Math.hypot(vel.x, vel.z);
  if (hs > 0.3) {
    const nh = Math.atan2(vel.x, -vel.z); const dh = wrapA(nh - ghostS.h);
    const step = dh * (1 - Math.exp(-dt * 6)); ghostS.h += step;
    const rate = step / Math.max(dt, 1e-3);
    ghostS.roll = lerp(ghostS.roll, clamp(Math.atan(hs * rate / G), -0.55, 0.55), 1 - Math.exp(-dt * 5));
  } else ghostS.roll = lerp(ghostS.roll, 0, 1 - Math.exp(-dt * 5));
  ghostS.pitch = lerp(ghostS.pitch, clamp(hs * 0.028, 0, 0.5), 1 - Math.exp(-dt * 4));
  ghostS.v.copy(vel); ghostS.p.copy(_gp);
}
// 고정익의 pitch 는 '상승각'(+ 위), 쿼드는 '앞으로 숙임'(+ 아래) -> 그릴 때 부호를 맞춤
function visPitch(st) { return st !== ghostS && AFc().cls === 'wing' ? -st.pitch : st.pitch; }
function placeModel(mdl, st) { mdl.g.position.copy(st.p); if (st.q) mdl.g.quaternion.copy(st.q); else { eul.set(-visPitch(st), -st.h, -st.roll); mdl.g.quaternion.setFromEuler(eul); } }
let last = performance.now(), acc = 0;
const STEP = 1 / 120;
function handleKeys() {
  while (pressed.length) {
    const k = pressed.shift();
    if (RCUI.open) continue;
    if (k === 'Digit0' || k === 'Numpad0') { document.body.classList.toggle('nohud'); if (S.state !== 'menu') showMsg(document.body.classList.contains('nohud') ? 'UI OFF (0)' : 'UI ON', '#fff', 0.8); continue; }
    if (!S.brief && typeof c1Key === 'function' && c1Key(k)) continue;
    if (S.brief && (k === 'Enter' || k === 'Space' || k === 'PadA' || (k === 'KeyQ' && typeof isC1 === 'function' && isC1()))) { if (BRIEF_GO) BRIEF_GO(); continue; }
    if (k === 'KeyF') { toggleFull(); continue; }
    if (k === KB.boost) { boostToggle(); continue; }
    if (k === 'KeyT') { irSet(!ENV.ir); continue; }
    if (k === 'KeyB') { MUS.on = !MUS.on; musicSetLevel(); saveMusic(); syncSeg(); if (S.state !== 'menu') showMsg(MUS.on ? 'MUSIC ON' : 'MUSIC OFF', '#fff', 0.8); continue; }
    if (S.state === 'replay') { replayKey(k.replace(/^(MV_|X_)/, '')); continue; }
    if (S.state === 'menu') {
      if (k === 'Escape') { if (!closePanels() && MENU.step > 1) wizGo(MENU.step - 1); continue; }
      if (['setPanel', 'recPanel', 'helpPanel', 'tutMenu', 'kbPanel'].some(p => !$(p).classList.contains('hidden'))) continue;
      if (k === 'Enter' || k === 'PadA') { if (MENU.step < 3) wizGo(MENU.step + 1); else menuGo(); } else if (k === 'KeyT' && MENU.step === 3) openTutMenu(); continue;
    }
    if (S.state === 'result') { if (k === 'Enter' || k === 'PadA') startRun(S.lastKind || S.kind); else if (k === 'KeyV' || k === 'KeyH') replayStart(LAST_REC, 'result'); else if (k === 'Escape') toMenu(); continue; }
    if (k === 'Escape') { togglePause(); continue; }
    if (S.state === 'pause') continue;
    if ((k === 'Enter' || k === 'PadA') && S.state === 'run' && photoMission()) { missionPhoto(); continue; }   // 산불·수색: 사진 찍어 보고
    if (S.kind === 'tutorial' && S.tut) {
      if (S.tut.st === 'intro' && (k === 'Enter' || k === 'Space' || k === 'X_Space' || k === 'PadA')) { tutFly(); continue; }
      if (S.tut.st === 'done') { if (k === 'Enter' || k === 'Space' || k === 'X_Space' || k === 'PadA') { tutNext(); continue; } if (k === 'KeyR') { tutRetry(); continue; } }
    }
    if (k === 'KeyC' || k === 'PadRB') { S.cam = [2, 0, 1][S.cam]; updateTags(); }
    else if (k === 'PadLB') { S.cam = (S.cam + 2) % 3; updateTags(); }
    else if (k === 'KeyX' || k === 'PadLeft') { const vis = bellyMode() !== null; S.bellyOv = { val: !vis, idx: S.objIdx }; showMsg(!vis ? 'BELLY CAM ON' : 'BELLY CAM OFF', '#fff', 0.8); }
    else if (k === 'KeyV') { SET.guide = !SET.guide; saveSet(); syncSeg(); showMsg(SET.guide ? 'GUIDE ON' : 'GUIDE OFF', '#fff', 0.8); }
    else if (k === 'Slash' || k === 'F1') { S.keysShow = !S.keysShow; if (S.keysShow) S.keysT = 0; }
    else if (k === 'KeyZ') { SET.zoom = (SET.zoom + 1) % 3; SET.camDist = ZOOMS[SET.zoom].d; saveSet(); if (typeof syncSeg === 'function') syncSeg(); showMsg('ZOOM ' + ['FAR', 'MID', 'NEAR'][SET.zoom] + ' · ' + SET.camDist.toFixed(1) + ' m', '#fff', 0.7); }
    else if (k === 'KeyP') { SET.showPath = !SET.showPath; GH.line.visible = SET.showPath; }
    else if (k === 'KeyJ') { mapZoom(!MAPZ.on); }
    else if (k === 'KeyL') { S.lightOv = !lightOn(); showMsg(S.lightOv ? L2x('조명 켬', 'LIGHT ON') : L2x('조명 끔', 'LIGHT OFF'), '#ffe9a0', 0.9); }
    else if (k === 'KeyM') { AU.on = !AU.on; showMsg(AU.on ? 'SOUND ON' : 'SOUND OFF', '#fff', 0.8); if (AU.master) AU.master.gain.value = AU.on ? 0.55 : 0; }
    else if (k === 'KeyH') { SET.assistLv = SET.assist ? 0 : 2; modeSync(); saveSet(); updateTags(); syncSeg(); showMsg(SET.assist ? 'ASSIST ON' : 'ASSIST OFF', '#fff', 0.8); }
    else if (k === 'PadUp') { SET.tilt = Math.min(40, SET.tilt + 5); saveSet(); syncSeg(); showMsg('CAM TILT ' + SET.tilt + '°', '#fff', 0.7); }
    else if (k === 'PadDown') { SET.tilt = Math.max(0, SET.tilt - 5); saveSet(); syncSeg(); showMsg('CAM TILT ' + SET.tilt + '°', '#fff', 0.7); }
    if (S.state !== 'run') continue;
    if (S.tut && S.tut.st !== 'fly') continue;
    if (k === 'Space' && DR.alive) { if (actionKind() === 'report') missionPhoto(); else dropPayload(DR.p, DR.v, false); }   // 투하 버튼 = 임무에 따라 투하 / 사진 보고
    else if (k === 'KeyR') respawn();
    else if (k === 'KeyN' && isMission() && S.running && msObj()) { S.pen += 20; msNext('SKIPPED +20s', '#ff9a40'); }
    else if (k === 'KeyN' && S.kind === 'course' && S.running && curObj() && curObj().kind !== 'land') { S.pen += 20; completeObj(2, 'SKIPPED +20s', '#ff9a40'); }
  }
}
function togglePause() {
  if (S.state === 'run' || S.state === 'demo') { S.prevState = S.state; S.state = 'pause'; ui.pause.classList.remove('hidden'); musicSetLevelPaused(true); }
  else if (S.state === 'pause') { S.state = S.prevState; ui.pause.classList.add('hidden'); last = performance.now(); musicSetLevelPaused(false); }
}
function musicSetLevelPaused(p) { if (MUS.bus && AU.ctx) MUS.bus.gain.setTargetAtTime(musicLevel() * (p ? 0.4 : 1), AU.ctx.currentTime, 0.2); }
let flagT = 0, REC_T0_SET = false;
const TEST = /[?&]test/.test(location.search);
let XR_ON = false;   // VR(WebXR) 중: 화면 갱신은 XR 세션이 돌림
function frame(now, noRender) {
  if (!TEST && !XR_ON) requestAnimationFrame(frame);
  let dt = Math.max(0, Math.min((now - last) / 1000, 0.1)); last = now;
  readInput(dt);
  rumbleTick(dt); gpnTick(dt); handleKeys();
  if (RCUI.open) rcPanelUpdate();
  const playing = S.state === 'run' || S.state === 'demo';
  if (S.state === 'pause') dt = 0;
  S.simT += dt; S.msgCD -= dt;
  if (OBJ.mit) OBJ.mit.update(S.simT);
  flagT += dt;
  if (flagMesh) {
    const pos = flagMesh.geometry.attributes.position, base = flagMesh.userData.base;
    for (let i = 0; i < pos.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; pos.setZ(i, Math.sin(x * 3.2 - flagT * 6 + y * 0.8) * 0.12 * x / 1.8); pos.setY(i, y - x * 0.08); }
    pos.needsUpdate = true; if ((flagT * 60 | 0) % 3 === 0) flagMesh.geometry.computeVertexNormals();
  }
  let subj = DR;
  skyU.time.value = S.simT;
  const tutHold = S.kind === 'tutorial' && S.tut && S.tut.st !== 'fly';
  if (S.state === 'run') {
    if (!tutHold && !S.brief) {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP; _prevP.copy(DR.p); stepDrone(STEP); S.bumpT -= STEP; S.hitCD -= STEP;
        if (S.kind === 'course' || S.kind === 'tutorial') checkObjectives(_prevP, DR.p, STEP); else if (isMission()) msStep(_prevP, DR.p, STEP);
      }
    }
    if (S.running && !S.finished && !S.brief && (S.kind === 'course' || isMission())) S.t += dt;
    S.flyT += dt;
    if (S.running && !REC_T0_SET && REC) { REC.t0 = S.flyT; REC_T0_SET = true; }
    if (!S.running) REC_T0_SET = false;
    recTick(dt);
    updatePayloads(dt);
  } else if (S.state === 'demo') {
    S.ghostT += dt; updatePayloads(dt);
    while (S.demoEvents < GH.events.length && GH.events[S.demoEvents].t <= S.ghostT) {
      const ev = GH.events[S.demoEvents++]; if (ev.label.startsWith('DROP')) dropPayload(ghostS.p, ghostS.v, 'demo'); showMsg(ev.label.replace(/^_.*/, ''), '#ffc828', 1.2);
    }
    if (S.ghostT > GH.total + 2.5) toMenu();
  } else if (S.state === 'replay') { replayTick(dt); subj = RP.pose; }
  const ghostOn = S.state === 'demo' || (S.state === 'pause' && S.prevState === 'demo');   // 고스트 드론은 기준 비행 보기에서만
  if (ghostOn) { if (S.state === 'demo' || !bestGhostPose(S.ghostT)) updateGhost(S.ghostT, Math.max(dt, 1e-3)); placeModel(ghostM, ghostS); ghostM.g.visible = S.ghostT > 0 && ghostS.p.distanceTo(DR.p) > 2.5; }
  else ghostM.g.visible = false;
  const demoing = S.state === 'demo' || (S.state === 'pause' && S.prevState === 'demo');
  if (demoing) { subj = ghostS; placeModel(droneM, ghostS); ghostM.g.visible = false; } else if (S.state === 'replay') placeModel(droneM, RP.pose); else placeModel(droneM, DR);
  const spinRate = 40 + (S.state === 'replay' ? RP.pose.thrust : DR.thrust) * 60;
  droneM.props.forEach((p, i) => p.rotation.y += (i % 2 ? 1 : -1) * (demoing ? 70 : spinRate) * dt);
  ghostM.props.forEach((p, i) => p.rotation.y += (i % 2 ? 1 : -1) * 70 * dt);
  droneM.leds[0].visible = droneM.leds[1].visible = (S.simT * 2 % 1) < 0.5;
  const o = curObj();
  OBJS.forEach(ob => { if (ob.hint) ob.hint.visible = false; if (ob.hint2) { ob.hint1.visible = false; ob.hint2.visible = false; } });
  if (o && o.kind === 'bunker') { o.hint = S.scanned ? o.hint2 : o.hint1; o.mk = S.scanned ? o.mk2 : o.mk1; }
  if (o) {
    if (o.hint) { o.hint.visible = true; o.hint.material.opacity = (o.kind === 'drop' || o.kind === 'land' ? 0.45 : 0.16) + 0.1 * Math.sin(S.simT * 5); if (o.follow) { const w = OBJ.mit.world(OBJ.mit.car.position.x, 0, 0); o.hint.position.set(w.x, 0.05, w.z); o.mk.set(w.x, 4.2, w.z); } }
    marker.visible = !!o.mk && !searchIn(o, subj.p); if (marker.visible) { marker.position.copy(o.mk).add(new V3(0, Math.sin(S.simT * 3) * 0.15, 0)); marker.rotation.y += dt * 2; const d = camera.position.distanceTo(marker.position); const sc = Math.max(1, d / 22); marker.scale.set(sc, sc * 1.5, sc); }
  } else marker.visible = false;
  const subjPos = subj.p;
  const inB = S.state !== 'menu' && insideBunker(subjPos);
  const nearB = OBJ.bunker1 && OBJ.bunker1.world(0, 0, 1.5).distanceTo(subjPos) < 5;
  hemi.intensity = lerp(hemi.intensity, inB ? 0.04 : envHemi(), 1 - Math.exp(-dt * 5));
  spot.intensity = lerp(spot.intensity, (lightOn() || inB || nearB) && S.state !== 'menu' && !(typeof isC1 === 'function' && isC1() && !ENV.night) ? 4.5 : 0, 1 - Math.exp(-dt * 8));
  { eul.set(-visPitch(subj), -subj.h, -subj.roll); const q = new THREE.Quaternion().setFromEuler(eul);
    spot.position.copy(subjPos).add(new V3(0, 0, -0.14).applyQuaternion(q)); spotT.position.copy(subjPos).add(new V3(0, -0.6, -3).applyQuaternion(q)); spotT.updateMatrixWorld(); }
  if (S.state === 'run' && tutHold && S.tut.st === 'intro') tutCamera(dt);
  else if (S.state === 'menu') menuCam(dt);
  else updateCamera(dt, subj);
  camera.updateMatrixWorld();
  updateGuide(subj);
  droneM.g.visible = (DR.alive || S.state !== 'run') && !(CAMS[S.cam] === 'FPV' && S.state !== 'menu' && S.state !== 'result' && !(tutHold && S.tut.st === 'intro'));
  $('vig').classList.toggle('hidden', !(CAMS[S.cam] === 'FPV' && (S.state === 'run' || S.state === 'replay') && !(tutHold && S.tut.st === 'intro')));
  const focus = S.state === 'menu' ? menuFocus() : subjPos;
  sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(SUN_DIR, 120);
  sky.position.copy(camera.position);
  updateFX(dt); envTick(dt); scenTick(dt); reloadTick(dt);
  if (playing || S.state === 'pause' || S.state === 'replay') { updateHUD(dt, subj); drawMap(ghostOn && ghostM.g.visible ? ghostS.p : null); }
  audioUpdate(demoing ? 0.55 : S.state === 'replay' ? RP.pose.thrust : DR.thrust, subj.v ? subj.v.length() : 0, (S.state === 'run' && !tutHold && !(DR.landed && IN.thr <= 0.05)) || S.state === 'demo' || (S.state === 'replay' && RP.playing));
  if (XR_ON) xrTick(dt);   // VR: 드론 카메라 영상을 화면 텍스처로 먼저 그림
  if (!noRender) { const mn = S.state === 'menu' && !XR_ON; if (mn) menuRenderPre(dt); (typeof c1VRon === 'function' && c1VRon() && C1XR.cam) ? renderer.render(scene, C1XR.cam) : renderer.render(XR_ON ? VRS : scene, camera); if (!XR_ON) renderBelly(); if (mn) menuRenderPost(); }
}
