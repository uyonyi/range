// =====================================================================
//  기체 종류 · 새 임무 (숲길 통과 · 타임 레이스 · 정찰 · 타격)
//  속도·크기는 공개 제원 수준의 근사값 (기체 이름은 형상 참고용)
// =====================================================================
const AF = {
  x2d: { tag: 'X2D', name: 'Skydio X2D', sub: '정찰 쿼드 · 66 cm · 1.3 kg', cls: 'quad', top: 13.9, vmax: { train: 7.5, easy: 10, sport: 13.9 }, tilt: { train: 20, easy: 28, sport: 38 }, climb: 6, sink: 4, yaw: 120, tw: 1.15, R: 0.24, endur: 35, drop: true,
    note: '자세 안정 · 정지 비행 · 투하 장치' },
  anafi: { tag: 'ANAFI', name: 'Parrot ANAFI USA', sub: '소형 정찰 쿼드 · 37 cm · 0.5 kg', cls: 'quad', top: 14.7, vmax: { train: 7.5, easy: 11, sport: 14.7 }, tilt: { train: 20, easy: 30, sport: 40 }, climb: 4, sink: 4, yaw: 140, tw: 1.15, R: 0.17, endur: 32, reconD: 520,
    note: '32배 줌 · 먼 거리 정찰 · IP53' },
  fpv: { tag: 'FPV', name: 'FPV 레이싱', sub: '5인치 · 0.65 kg', cls: 'quad', top: 39, vmax: { train: 12, easy: 24, sport: 39 }, tilt: { train: 30, easy: 50, sport: 72 }, climb: 15, sink: 9, yaw: 320, tw: 3.5, R: 0.13, endur: 5, acro: true,
    note: '매우 빠름 · 스포츠에서 수동(Acro) 선택' },
  fw: { tag: 'RAVEN', name: 'RQ-11B Raven', sub: '고정익 정찰 · 손 투척 · 날개 1.37 m · 2.1 kg', cls: 'wing', cruise: 13, top: 22.6, stall: 8.7, span: 1.37, R: 0.45, endur: '60~90', bank: 50, nmax: 1.8, minAgl: 26, prate: 70, rrate: 160,
    note: '정지 불가 · 선회로 방향 전환 · 실속 주의' },
  puma: { tag: 'PUMA', name: 'RQ-20B Puma', sub: '고정익 정찰 · 날개 2.8 m · 6.1 kg', cls: 'wing', cruise: 14, top: 23, stall: 10.3, span: 2.8, R: 0.9, endur: 210, bank: 45, nmax: 1.6, minAgl: 30, prate: 50, rrate: 90, reconD: 600,
    note: '3.5시간 체공 · 큰 날개로 안정적 · 선회 반경 큼' },
  kfpv: { tag: 'K-FPV', name: '자폭 FPV', sub: '7인치 · 탄두 모형 · 1.6 kg', cls: 'quad', top: 30, vmax: { train: 12, easy: 20, sport: 30 }, tilt: { train: 30, easy: 45, sport: 65 }, climb: 10, sink: 8, yaw: 240, tw: 2.2, R: 0.17, endur: 8, acro: true, kam: true,
    note: '부딪히면 기폭 · 표적에 직접 돌입' },
  kfw: { tag: 'K-FW', name: '자폭 고정익', sub: '배회형 · 날개 0.7 m', cls: 'wing', cruise: 26, top: 44, stall: 15, span: 0.7, R: 0.3, endur: 15, bank: 60, nmax: 2.6, minAgl: 10, prate: 90, rrate: 220, kam: true,
    note: '공중 발사 · 급강하로 표적 돌입' }
};
const AF_IDS = Object.keys(AF);
AF_IDS.forEach(k => AF[k].id = k);
const MS_OK = { course: ['x2d'], forest: ['x2d', 'anafi', 'fpv', 'kfpv'], race: ['x2d', 'anafi', 'fpv', 'fw', 'puma', 'kfw'], recon: ['x2d', 'anafi', 'fw', 'puma'], fire: ['x2d', 'anafi', 'fw', 'puma'], sar: ['x2d', 'anafi', 'fw', 'puma'], track: ['x2d', 'anafi', 'fw', 'puma'], ridge: ['x2d', 'anafi', 'fpv', 'fw', 'puma'], strike: ['kfpv', 'kfw'], free: AF_IDS, tutorial: ['x2d'], demo: ['x2d'] };
if (!AF[SET.af]) SET.af = 'x2d';
const MS_NAME = { forest: '숲길 통과', race: '타임 레이스', recon: '정찰', strike: '타격', fire: '산불 감시', sar: '수색·구조', track: '차량 추적', ridge: '능선 종주' };
function AFc() { return AF[SET.af] || AF.x2d; }
function isMission(k) { k = k || S.kind; return k === 'forest' || k === 'race' || k === 'recon' || k === 'strike' || k === 'fire' || k === 'sar' || k === 'track' || k === 'ridge'; }
// 난이도 + 기체 -> 비행 특성
function effMode() {
  const m = MODES[SET.diff], a = AFc(); if (a.id === 'x2d') return m;
  const o = Object.assign({}, m); o.vmax = a.vmax[SET.diff]; o.maxTilt = a.tilt[SET.diff] * DEG;
  o.yawRate = a.yaw * DEG * (SET.diff === 'train' ? 0.45 : SET.diff === 'easy' ? 0.7 : 1);
  if (a.acro && SET.acro && SET.diff === 'sport') { o.althold = false; o.acro = true; o.brake = 0; }
  return o;
}

// ---------------- 기체 형상 ----------------
function partsKit(ghost) {
  const g = new THREE.Group(), gm = ghost ? new THREE.MeshBasicMaterial({ color: 0x55e6ff, transparent: true, opacity: 0.38, depthWrite: false }) : null;
  const m = c => gm || c;
  const add = (geo, mt, x, y, z, sx, sy, sz, par) => { const me = new THREE.Mesh(geo, mt); me.position.set(x, y, z); if (sx) me.scale.set(sx, sy, sz); me.castShadow = !ghost; (par || g).add(me); return me; };
  const LM = c => gm || new THREE.MeshBasicMaterial({ color: c });
  return { g, m, add, LM, gm };
}
function propHub(K, x, y, z, r, blades, up, col) {
  const hub = new THREE.Group(); hub.position.set(x, y, z); K.g.add(hub);
  const bm = K.m(mat(col || 0x222428, { roughness: 0.45 }));
  for (let i = 0; i < blades; i++) { const a = i / blades * Math.PI * 2, b = K.add(UBOX, bm, Math.cos(a) * r * 0.5, 0, Math.sin(a) * r * 0.5, r, 0.003, r * 0.2, hub); b.rotation.y = -a; b.rotation.x = 0.2; }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), K.gm || new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2; hub.add(disc);
  return hub;
}
function makeQuadFPV(ghost, kam) {
  const K = partsKit(ghost), S7 = kam ? 1.45 : 1;
  const carbon = K.m(mat(0x161718, { roughness: 0.4, metalness: 0.3 })), mot = K.m(mat(kam ? 0x55606a : 0xc0392b, { roughness: 0.35, metalness: 0.7 }));
  K.add(UBOX, carbon, 0, 0, 0, 0.05 * S7, 0.006, 0.16 * S7);
  const props = [];
  for (const [x, z] of [[0.085, -0.075], [-0.085, -0.075], [0.085, 0.075], [-0.085, 0.075]]) {
    const X = x * S7, Z = z * S7, a = K.add(UBOX, carbon, X / 2, 0, Z / 2, 0.018, 0.005, Math.hypot(X, Z)); a.rotation.y = Math.atan2(X, Z);
    K.add(UCYL, mot, X, 0.012, Z, 0.014 * S7, 0.018, 0.014 * S7);
    props.push(propHub(K, X, 0.024, Z, 0.064 * S7, 3, 1, kam ? 0x30343a : 0x1d6fd8));
  }
  K.add(UBOX, K.m(mat(0x2b2e33, { roughness: 0.6 })), 0, 0.022, 0.01, 0.034 * S7, 0.03, 0.07 * S7);       // 배터리
  K.add(UBOX, K.m(mat(0x111111, { roughness: 0.3 })), 0, 0.02, -0.06 * S7, 0.03, 0.03, 0.025);             // 카메라
  K.add(UCYL, K.m(mat(0x0a1420, { roughness: 0.05, metalness: 0.6 })), 0, 0.02, -0.074 * S7, 0.008, 0.006, 0.008).rotation.x = Math.PI / 2;
  if (!kam) K.add(UBOX, K.m(mat(0x1a1a1a, { roughness: 0.3 })), 0, 0.05, -0.02, 0.04, 0.03, 0.03);         // 액션캠
  else {   // 탄두 모형 (아래 원통) + 안테나
    const w = K.add(UCYL, K.m(mat(0x5a6646, { roughness: 0.7 })), 0, -0.04, -0.02, 0.032, 0.2, 0.032); w.rotation.x = Math.PI / 2;
    const n = K.add(USPH, K.m(mat(0x5a6646, { roughness: 0.7 })), 0, -0.04, -0.12, 0.032, 0.032, 0.03);
    K.add(UCYL6, carbon, 0.02, 0.06, 0.09, 0.003, 0.08, 0.003).rotation.x = -0.4;
  }
  const ledG = K.add(USPH, K.LM(0x30ff60), 0.03, -0.01, 0.09 * S7, 0.006, 0.006, 0.006), ledR = K.add(USPH, K.LM(0xff3030), -0.03, -0.01, 0.09 * S7, 0.006, 0.006, 0.006);
  return { g: K.g, props, cans: [], leds: [ledG, ledR] };
}
function makeWing(ghost, kam) {
  const K = partsKit(ghost), L = kam ? 0.62 : 1.0, span = kam ? 0.7 : 1.4;
  const body = K.m(mat(kam ? 0x59624a : 0xc9ced3, { roughness: 0.55 })), dark = K.m(mat(0x2a2d31, { roughness: 0.5 })), wingM = K.m(mat(kam ? 0x4d5640 : 0xe1e4e7, { roughness: 0.5 }));
  const f = K.add(UCAP, body, 0, 0, 0, kam ? 0.045 : 0.055, L * 0.62, kam ? 0.045 : 0.06); f.rotation.x = Math.PI / 2;
  if (kam) {   // 앞·뒤 두 쌍 날개 (튜브 발사형)
    K.add(UBOX, wingM, 0, 0.03, -0.12, span, 0.008, 0.07); K.add(UBOX, wingM, 0, -0.02, 0.2, span * 0.85, 0.008, 0.06);
    K.add(UBOX, wingM, 0, 0.06, 0.26, 0.006, 0.09, 0.05);
    K.add(USPH, K.m(mat(0x1b1d1f, { roughness: 0.2 })), 0, -0.035, -0.3, 0.03, 0.025, 0.03);   // 아래 카메라
  } else {
    K.add(UBOX, wingM, 0, 0.05, -0.08, span, 0.012, 0.18);
    for (const sx of [-1, 1]) K.add(UBOX, wingM, sx * span * 0.5, 0.075, -0.06, 0.012, 0.05, 0.14);   // 날개 끝
    K.add(UBOX, dark, 0, 0.02, 0.45, 0.012, 0.012, 0.42);                                          // 꼬리 붐
    K.add(UBOX, wingM, 0, 0.03, 0.66, 0.42, 0.008, 0.1);                                          // 수평 꼬리
    K.add(UBOX, wingM, 0, 0.1, 0.67, 0.008, 0.15, 0.1);                                           // 수직 꼬리
    K.add(USPH, K.m(mat(0x1b1d1f, { roughness: 0.2 })), 0, -0.05, -0.3, 0.04, 0.035, 0.04);
  }
  const props = [propHub(K, 0, 0, L * 0.34 + 0.02, kam ? 0.07 : 0.1, 2, 1)];
  props[0].rotation.x = Math.PI / 2;
  const ledG = K.add(USPH, K.LM(0x30ff60), span / 2, 0.05, -0.08, 0.01, 0.01, 0.01), ledR = K.add(USPH, K.LM(0xff3030), -span / 2, 0.05, -0.08, 0.01, 0.01, 0.01);
  return { g: K.g, props, cans: [], leds: [ledG, ledR], wing: true };
}
function makeModel(id, ghost) {
  if (id === 'fpv') return makeQuadFPV(ghost, false);
  if (id === 'kfpv') return makeQuadFPV(ghost, true);
  if (id === 'fw') return makeWing(ghost, false);
  if (id === 'puma') { const w = makeWing(ghost, false); w.g.scale.setScalar(2.0); return w; }
  if (id === 'anafi') {   // X2D 형상을 줄이고 투하 장치·안테나는 뗌
    const d = makeDrone(ghost); d.g.scale.setScalar(0.56); d.cans.forEach(c => d.g.remove(c)); d.g.children.filter(c => c.geometry === UCYL6).forEach(c => d.g.remove(c)); d.cans = []; return d;
  }
  if (id === 'kfw') return makeWing(ghost, true);
  return makeDrone(ghost);
}
let MODEL_ID = 'x2d';
function setAirframe(id) {
  if (!AF[id]) id = 'x2d'; SET.af = id; saveSet();
  if (MODEL_ID !== id) {
    scene.remove(droneM.g); droneM = makeModel(id, false); scene.add(droneM.g);
    scene.remove(ghostM.g); ghostM = makeModel(id, true); ghostM.g.visible = false; scene.add(ghostM.g);
    MODEL_ID = id;
  }
  DR.R = AFc().R;
  ui.payload.style.display = AFc().drop ? '' : 'none';
}

// ---------------- 고정익 비행 ----------------
function camK() { const a = AFc(); return a.cls === 'wing' ? 2.4 : a.id === 'anafi' || a.id === 'fpv' ? 0.85 : 1; }
function wingAir(p, h) {   // 공중에서 시작 (손 투척·발사 직후)
  const a = AFc(); DR.p.copy(p); DR.p.y = Math.max(DR.p.y, groundAt(p.x, p.z) + 25); DR.h = h; DR.as = a.cruise; DR.pitch = 0; DR.roll = 0; DR.landed = false; DR.alive = true;
  DR.v.set(Math.sin(h) * a.cruise, 0, -Math.cos(h) * a.cruise); DR.altT = DR.p.y;
}
function stepWing(dt) {
  const a = AFc(), assist = SET.assist && SET.diff !== 'sport';
  const stun = S.stun > 0 ? 0.3 : 1; if (S.stun > 0) S.stun -= dt;
  const ip = IN.pitch * stun, ir = IN.roll * stun, iy = IN.yaw * stun;
  let V = DR.as || a.cruise;
  const stall = V < a.stall;
  if (assist) {
    // 고도 유지: 스틱 놓으면 그 고도, 땅이 가까우면 자동 상승
    if (Math.abs(ip) > 0.05) DR.altT = DR.p.y;
    const ahead = Math.max(terrainAt(DR.p.x, DR.p.z), terrainAt(DR.p.x + DR.v.x * 2.5, DR.p.z + DR.v.z * 2.5), terrainAt(DR.p.x + DR.v.x * 5, DR.p.z + DR.v.z * 5));
    let gt = Math.abs(ip) > 0.05 ? -ip * 28 * DEG : clamp((DR.altT - DR.p.y) * 0.06, -0.3, 0.3);
    if (DR.p.y - ahead < a.minAgl && !a.kam) { gt = Math.max(gt, 0.25 + (a.minAgl - (DR.p.y - ahead)) * 0.03); DR.altT = Math.max(DR.altT, ahead + a.minAgl); }
    DR.pitch += (gt - DR.pitch) * (1 - Math.exp(-dt * 2.2));
    DR.roll += (ir * a.bank * DEG - DR.roll) * (1 - Math.exp(-dt * 2.8));
    S.boosting = !!IN.boost;
    const vt = IN.boost ? a.top : IN.thr >= 0 ? a.cruise + IN.thr * (a.top - a.cruise) : a.cruise + IN.thr * (a.cruise - a.stall - 2);
    V += clamp(vt - V, -4, 4) * dt * 0.9;
  } else {
    DR.pitch += -ip * a.prate * DEG * dt; DR.roll += ir * a.rrate * DEG * dt;
    DR.pitch = clamp(DR.pitch, -75 * DEG, 75 * DEG); DR.roll = clamp(DR.roll, -85 * DEG, 85 * DEG);
    const thr = clamp(0.55 + IN.thr * 0.45, 0, 1), thrust = thr * a.top * 0.42, drag = 0.42 * a.top * (V / a.top) * (V / a.top);
    V += (thrust - drag) * dt;
  }
  // 오르면 느려지고 내려가면 빨라짐 (에너지)
  V -= G * Math.sin(DR.pitch) * dt * 0.85;
  if (stall) { DR.pitch -= (0.9 + (a.stall - V) * 0.12) * dt; DR.roll *= Math.exp(-dt * 0.5); }
  V = clamp(V, 3, a.kam ? a.top * 1.12 : a.top * 1.18); DR.as = V;
  // 선회: 하중 배수 한계 (nmax) 안에서만 돌고, 넘게 기울이면 양력이 모자라 기수가 내려감
  const nreq = 1 / Math.max(0.05, Math.cos(DR.roll)), nl = Math.min(nreq, a.nmax);
  DR.h += Math.sign(DR.roll) * G * Math.sqrt(Math.max(0, nl * nl - 1)) / Math.max(V, 6) * dt + iy * 0.35 * dt;
  if (nreq > a.nmax) DR.pitch -= (1 - nl * Math.cos(DR.roll)) * G / Math.max(V, 6) * dt;
  V -= (nl - 1) * 1.1 * dt;
  // 비행 구역 밖이면 자동 선회
  const rx = DR.p.x, rz = DR.p.z + 150, l = Math.hypot(rx, rz);
  if (l > 680) { const dh = wrapA(Math.atan2(-rx, rz) - DR.h); DR.h += clamp(dh, -1, 1) * 0.6 * dt; if (S.msgCD <= 0) { showMsg('AREA LIMIT · 선회', '#ff9a40', 1); S.msgCD = 2; } }
  const cg = Math.cos(DR.pitch);
  DR.v.set(Math.sin(DR.h) * V * cg, Math.sin(DR.pitch) * V - (stall ? 2.5 : 0), -Math.cos(DR.h) * V * cg);
  DR.v.add(windAt(DR.p)); DR.p.addScaledVector(DR.v, dt); DR.thrust = assist ? clamp(0.5 + IN.thr * 0.5, 0.2, 1) : clamp(0.55 + IN.thr * 0.45, 0, 1);
  if (DR.p.y > groundAt(DR.p.x, DR.p.z) + 150) { DR.p.y = groundAt(DR.p.x, DR.p.z) + 150; DR.altT = Math.min(DR.altT, DR.p.y); }
  S.stallW = stall;
  // 지면·장애물·나무 = 추락 (자폭기는 기폭)
  if (DR.p.y < groundAt(DR.p.x, DR.p.z) + 0.15) return lostDrone('GROUND');
  const hit = collide(DR.p, DR.R) || STREES.col(DR.p, DR.R);
  if (hit) return lostDrone(hit.tag);
}
// 기체 잃음: 추락 / 자폭 기폭
function lostDrone(why) {
  if (!DR.alive) return;
  const a = AFc();
  if (a.kam && S.kind === 'strike') { if (strikeDetonate()) return; }
  DR.alive = false; S.deadT = 1.6; S.impacts++; S.lost = (S.lost || 0) + 1;
  spawnImpact(DR.p.clone(), true); sfx('crash'); rumble(1, 0.8, 300); shake = 0.15;
  if (S.kind === 'strike') showMsg(why === 'stk' ? 'HIT' : 'MISS · 기체 손실', '#ff6060', 1.6);
  else { showMsg(a.kam ? 'DETONATED · 기체 손실' : 'CRASH · 기체 손실', '#ff5050', 1.6); if (S.kind === 'race' || S.kind === 'forest' || S.kind === 'recon') S.pen += 10; }
  droneM.g.visible = false;
}
function deadTick(dt) { S.deadT -= dt; if (S.deadT <= 0) { respawn(); } }

// ---------------- 임무 ----------------
const MSG = { race: new THREE.Group(), strike: new THREE.Group(), recon: new THREE.Group(), fire: new THREE.Group() };
Object.values(MSG).forEach(g => { g.visible = false; scene.add(g); });
const MS = { list: [], idx: 0 };
const _mv = new V3();
// 코스 경로 위 거리 s 의 점 (down, side, 방향)
const PATHL = (function () {
  if (!CRS_C) return null; const P = CRS_C.path, cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { total: cum[cum.length - 1], at(s) { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const u = clamp((s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), 0, 1), a = P[i - 1], b = P[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { d: a[0] + (b[0] - a[0]) * u, s: a[1] + (b[1] - a[1]) * u, td: (b[0] - a[0]) / l, ts: (b[1] - a[1]) / l }; } };
})();
const wdir = q => { const a = W(q.d, q.s, 0), b = W(q.d + q.td, q.s + q.ts, 0); return b.sub(a).setY(0).normalize(); };
// 통과점 (평면 + 열린 범위): 길 위 점 q, 열린 폭 hw, 지면 위 y0~y1
function passCP(label, q, hw, y0, y1, ring) {
  const c = W(q.d, q.s, 0), n = wdir(q), r = new V3(-n.z, 0, n.x);
  const mid = c.clone().add(new V3(0, (y0 + y1) / 2, 0));
  return { kind: 'ms', t: 'pass', label, c, n, r, hw, y0, y1, ring, mk: mid.clone(),
    pts(p) { return [p.clone(), mid.clone().addScaledVector(n, -6), mid.clone(), mid.clone().addScaledVector(n, 3)]; } };
}
// 레이스 링
const RACE = (function () {
  if (!PATHL) return [];
  const L = [], alts = [4, 7, 12, 6, 16, 9, 5, 14, 22, 8, 5];
  for (let i = 0; i < alts.length; i++) {
    const s = 30 + i * (PATHL.total - 50) / (alts.length - 1), q = PATHL.at(s), cp = passCP('RING ' + (i + 1), q, 0, alts[i], alts[i], 3.2);
    cp.q = q; cp.alt = alts[i]; cp.mk = W(q.d, q.s, alts[i]); cp.c = cp.mk.clone(); const tor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), mat(i === alts.length - 1 ? 0x5dff9a : 0xffc828, { emissive: 0x332200, roughness: 0.4 }));
    tor.position.copy(cp.c); tor.lookAt(cp.c.clone().add(cp.n)); MSG.race.add(tor); cp.mesh = tor; L.push(cp);
  }
  return L;
})();
// 정찰 대상: 수치지형도의 실제 건물 (출발점에서 고르게 떨어진 것)
const RECON = (function () {
  const out = []; if (!VEC || !VEC.bld || !CRS_C) return out;
  const st = BY.pad_start, B = VEC.bld.map(b => ({ b, d: Math.hypot(b[0] - st.down, b[1] - st.side) })).filter(x => x.d > 100 && x.d < 640).sort((p, q) => p.d - q.d);
  for (const x of B) { if (out.length >= 5) break; if (out.some(o => Math.hypot(o.b[0] - x.b[0], o.b[1] - x.b[1]) < 110)) continue; out.push(x); }
  return out.map((x, i) => { const [d, s, w, l, ang, h] = x.b, tp = W(d, s, h * 0.6);
    return { kind: 'ms', t: 'recon', label: `정찰 ${i + 1} · 건물 (${Math.round(w)}×${Math.round(l)} m)`, tp, mk: W(d, s, h + 6), need: 1.5, pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y + 15))]; } }; });
})();
// 타격 표적 (가상의 표적 차량 3대)
const STRIKE = (function () {
  if (!PATHL) return [];
  const L = [], body = mat(0x59604a, { roughness: 0.85 }), dark = mat(0x2c3026, { roughness: 0.9 }), mark = mat(0xff3b30, { roughness: 0.6, emissive: 0x220000 });
  [[200, 5], [340, -5], [470, 4]].forEach(([s, off], i) => {
    const q = PATHL.at(Math.min(s, PATHL.total - 8)), d = q.d - q.ts * off, sd = q.s + q.td * off, c = W(d, sd, 0), yaw = Math.atan2(q.ts, q.td);
    const g = new THREE.Group(); g.position.copy(c); g.rotation.y = Math.PI / 2 - yaw; MSG.strike.add(g);
    const hull = new THREE.Mesh(UBOX, body); hull.scale.set(2.4, 1.3, 5.2); hull.position.y = 1.05; g.add(hull);
    const cab = new THREE.Mesh(UBOX, body); cab.scale.set(2.2, 0.9, 1.6); cab.position.set(0, 2.05, -1.4); g.add(cab);
    for (const sx of [-1.25, 1.25]) for (const z of [-1.7, 0, 1.7]) { const w = new THREE.Mesh(UCYL, dark); w.scale.set(0.5, 0.35, 0.5); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.5, z); g.add(w); }
    const x = new THREE.Mesh(UBOX, mark); x.scale.set(1.6, 0.04, 1.6); x.position.set(0, 1.72, 0.6); g.add(x);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.heat = 0.28; } });
    const col = boxCol(hull, 'stk'); col.off = true;
    L.push({ kind: 'ms', t: 'strike', label: `표적 ${i + 1} · 차량`, g, col, c: c.clone().add(new V3(0, 1.4, 0)), mk: c.clone().add(new V3(0, 5, 0)), hull,
      pts(p) { return [p.clone(), this.c.clone()]; } });
  });
  return L;
})();
function msObj() { return MS.list[MS.idx] || null; }
function msStart(kind) {
  Object.values(MSG).forEach(g => g.visible = false);
  STRIKE.forEach(t => { t.col.off = true; t.dead = false; t.hull.material = t.hull.userData.m0 || t.hull.material; });
  if (FLANE) FLANE.G.visible = true;
  MS.idx = 0; S.lost = 0; S.kitErr = undefined; S.sarXY = null; S.hitsS = 0; S.errS = []; S.recT = 0; S.deadT = 0; S.running = true;
  const a = AFc(); let L = [];
  if (kind === 'forest' && FLANE) L = FLANE.cps.map(c => passCP(c.label, c.q, c.hw, c.y0, c.y1));
  if (kind === 'race') { L = RACE; MSG.race.visible = true; const k = a.cls === 'wing' ? 2.2 : 1; RACE.forEach(r => { r.ring = 3.2 * k; r.mesh.scale.setScalar(3.2 * k); const al = a.cls === 'wing' ? r.alt * 0.8 + 30 : r.alt; r.c = W(r.q.d, r.q.s, al); r.mk = r.c.clone(); r.mesh.position.copy(r.c); }); }
  if (kind === 'recon') L = RECON;
  if (kind === 'fire') { L = FIRE; MSG.fire.visible = true; FIRE.forEach(f => f.done = false); S.fireRep = []; }
  if (kind === 'strike') { L = STRIKE; MSG.strike.visible = true; STRIKE.forEach(t => { t.col.off = false; if (!t.hull.userData.m0) t.hull.userData.m0 = t.hull.material; }); }
  const SC = scenStart(kind, a); if (SC) L = SC;
  L.forEach(o => o.done = false); MS.list = L; MS.kind = kind;
  // 시작 위치: 고정익·자폭 고정익은 공중에서
  const p0 = startPos(), o = msObj(); let h = startHead();
  if (o) { const d = o.mk.clone().sub(p0); h = Math.atan2(d.x, -d.z); }
  if (a.cls === 'wing') { p0.y = groundAt(p0.x, p0.z) + (a.kam ? 45 : 30); wingAir(p0, h); } else resetDrone(p0, h);
  MS.launch = { p: DR.p.clone(), h };
  S.respawn = null;
}
function msNext(msg, col) {
  const o = msObj(); if (!o) return;
  o.done = true; sfx('good'); showMsg(msg || (o.label + ' ✓'), col || '#5dff9a', 1.3);
  MS.idx++; S.recT = 0;
  S.respawn = S.kind === 'strike' ? null : { p: DR.p.clone(), h: DR.h };
  renderList();
  if (MS.idx >= MS.list.length) msFinish();
}
function msStep(prev, cur, dt) {
  const o = msObj(); if (!o || !DR.alive) return;
  if (o.t === 'pass') {
    const a = _mv.subVectors(prev, o.c).dot(o.n), b = _mv.subVectors(cur, o.c).dot(o.n);
    if (a < 0 && b >= 0) {
      const t = a / (a - b), x = prev.clone().lerp(cur, t), lat = _mv.subVectors(x, o.c).dot(o.r);
      let ok;
      if (o.ring) ok = x.distanceTo(o.c) <= o.ring - DR.R * 0.5;
      else { const h = x.y - terrainAt(x.x, x.z); ok = Math.abs(lat) <= o.hw && h >= o.y0 && h <= o.y1; }
      if (ok) msNext(); else if (S.bumpT <= 0) { showMsg('MISS · 다시 통과', '#ff9a40', 1); sfx('bad'); S.bumpT = 0.6; }
    }
  } else if (o.t === 'fire') fireCheck(o, cur, dt);
  else if (o.t === 'sarfind' || o.t === 'land' || o.t === 'track') scenStep(o, cur, dt);
  else if (o.t === 'recon') {
    const inView = sensorSees(o.tp, cur, AFc().reconD || 260);
    o.inView = inView;
    if (inView) { S.recT += dt; if (S.recT >= o.need) { flashPhoto(); msNext('PHOTO ✓ ' + o.label.split(' · ')[0], '#5dff9a'); } }
    else S.recT = Math.max(0, S.recT - dt * 0.3);
  }
}
// 센서 시야: 앞 화면 가운데 또는 아래 카메라(수직) 시야 안
function sensorSees(tp, cur, maxD) {
  const d = tp.distanceTo(cur), sp = toScreen(tp), x = sp.x / innerWidth * 2 - 1, y = 1 - sp.y / innerHeight * 2;
  const front = !sp.behind && Math.abs(x) < 0.35 && Math.abs(y) < 0.45 && d > 15 && d < maxD;
  const dy = cur.y - tp.y, h = Math.hypot(tp.x - cur.x, tp.z - cur.z), nadir = dy > 6 && dy < maxD && h < dy * 0.5;
  return front || nadir;
}
function flashPhoto() { ui.flash.style.background = '#fff'; ui.flash.style.opacity = 0.55; setTimeout(() => { ui.flash.style.opacity = 0; ui.flash.style.background = ''; }, 140); }
// 자폭: 가까운 표적에 맞았는지
function strikeDetonate() {
  const o = msObj(); if (!o || o.t !== 'strike') return false;
  const l = o.hull.worldToLocal(DR.p.clone()), inX = Math.abs(l.x) < 0.5 + 0.9 / 2.4, inY = Math.abs(l.y) < 0.5 + 0.9 / 1.3, inZ = Math.abs(l.z) < 0.5 + 0.9 / 5.2;
  const hit = inX && inY && inZ;
  if (!hit) return false;
  const err = Math.hypot(DR.p.x - o.c.x, DR.p.z - o.c.z);
  S.hitsS++; S.errS.push(err); o.dead = true; o.col.off = true;
  o.hull.material = mat(0x1d1d1b, { roughness: 1 });
  spawnImpact(o.c.clone(), true); spawnImpact(DR.p.clone(), true); sfx('crash'); rumble(1, 1, 400); shake = 0.2;
  DR.alive = false; S.deadT = 1.8; droneM.g.visible = false;
  msNext(`HIT · 중심에서 ${err.toFixed(1)} m`, '#5dff9a');
  return true;
}
function msFinish() {
  S.finished = true; S.running = false;
  setTimeout(() => {
    if (S.state !== 'run') return;
    S.state = 'result'; ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden');
    const a = AFc(), total = S.t + S.pen, nm = MS_NAME[S.kind];
    ui.resSub.textContent = `${nm} · ${a.name} · ${MODES[SET.diff].name}`;
    const rows = [['비행 시간', fmt(S.t)], ['벌점', '+' + S.pen.toFixed(0) + ' s'], ['합계', fmt(total)], ['충돌', S.impacts + ' 회']];
    if (S.kind === 'strike') rows.push(['명중', S.hitsS + ' / ' + STRIKE.length], ['기체 손실(빗나감)', (S.lost || 0) + ' 대'], ['평균 오차', (S.errS.reduce((x, y) => x + y, 0) / Math.max(1, S.errS.length)).toFixed(1) + ' m']);
    else if (S.lost) rows.push(['기체 손실', S.lost + ' 대']);
    if (S.kind === 'sar' && S.sarXY) rows.push(['실종자 위치 (EPSG:5186)', S.sarXY[0].toFixed(0) + ', ' + S.sarXY[1].toFixed(0)]);
    if (S.kind === 'sar' && S.kitErr !== undefined) rows.push(['키트 오차', S.kitErr.toFixed(1) + ' m']);
    if (S.kind === 'track') rows.push(['추적 유지', S.trT.toFixed(0) + ' / ' + S.trWin.toFixed(0) + ' s'], ['판정', S.trackOK ? '성공' : '실패']);
    if (S.kind === 'ridge' && RIDGE) rows.push(['정상 해발', RIDGE.top.toFixed(0) + ' m']);
    if (S.kind === 'fire') (S.fireRep || []).forEach((xy, i) => xy && rows.push(['불씨 ' + (i + 1) + ' (EPSG:5186)', xy[0].toFixed(0) + ', ' + xy[1].toFixed(0)]));
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td></tr>`).join('');
    const key = 'hroc_ms_best_' + S.kind + '_' + a.id + '_' + SET.diff + SITE_KEY; let best = null;
    try { best = parseFloat(localStorage.getItem(key)); } catch (e) { }
    if (!best || total < best) { try { localStorage.setItem(key, String(total)); } catch (e) { } ui.resBest.textContent = '★ 최고 기록 갱신'; }
    else ui.resBest.textContent = '최고 기록 ' + fmt(best);
  }, 1400);
}
function msOsd() {
  const o = msObj(), a = AFc(); let h = '';
  if (a.cls === 'wing') h += `<div><b>AS</b>${((DR.as || 0) * 3.6).toFixed(0)} km/h</div>` + (S.stallW ? '<div style="color:#ff5050">STALL ▼</div>' : '');
  if (S.kind === 'strike') h += `<div><b>HIT</b>${S.hitsS || 0}/${STRIKE.length}</div><div><b>LOST</b>${S.lost || 0}</div>`;
  else if (isMission()) h += `<div><b>HIT</b>${S.impacts}</div>`;
  if (o && o.t === 'fire') h += o.inView ? `<div style="color:#ffb070">HOT ${Math.min(100, S.recT / o.need * 100).toFixed(0)}% ●</div>` : o.seenVis ? '<div style="color:#9aa6ad">열화상(T)으로 확인</div>' : `<div style="color:#9aa6ad">${ENV.ir ? 'IR 수색 중' : '열화상 끔 · T'}</div>`;
  h += scenOsd(o);
  if (o && o.t === 'recon') h += `<div style="color:${o.inView ? '#5dff9a' : '#9aa6ad'}">REC ${Math.min(100, S.recT / o.need * 100).toFixed(0)}%${o.inView ? ' ●' : ' · 화면 가운데나 아래 카메라에 담기'}</div>`;
  return h;
}
function msListHTML() {
  return MS.list.map((o, i) => { const cls = i === MS.idx ? 'cur' : o.done ? 'done' : ''; return `<div class="${cls}">${o.done ? '✓' : i === MS.idx ? '▶' : '·'} ${o.label}</div>`; }).join('');
}

// ---------------- 시작 화면: 기체 카드 · 임무 ----------------
const AF_ICON = {
  x2d: '<path d="M22 18l-12-8M42 18l12-8M22 30l-12 8M42 30l12 8" stroke="currentColor" stroke-width="3"/><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor"/><circle cx="54" cy="10" r="7" fill="none" stroke="currentColor"/><circle cx="10" cy="38" r="7" fill="none" stroke="currentColor"/><circle cx="54" cy="38" r="7" fill="none" stroke="currentColor"/><rect x="24" y="12" width="16" height="24" rx="7" fill="currentColor"/>',
  fpv: '<path d="M18 12l28 24M46 12L18 36" stroke="currentColor" stroke-width="3"/><circle cx="16" cy="10" r="8" fill="none" stroke="currentColor"/><circle cx="48" cy="10" r="8" fill="none" stroke="currentColor"/><circle cx="16" cy="38" r="8" fill="none" stroke="currentColor"/><circle cx="48" cy="38" r="8" fill="none" stroke="currentColor"/><rect x="27" y="18" width="10" height="12" fill="currentColor"/>',
  fw: '<rect x="29" y="4" width="6" height="40" rx="3" fill="currentColor"/><rect x="4" y="14" width="56" height="6" rx="2" fill="currentColor"/><rect x="20" y="38" width="24" height="4" fill="currentColor"/>',
  kfpv: '<path d="M18 12l28 24M46 12L18 36" stroke="currentColor" stroke-width="3"/><circle cx="16" cy="10" r="8" fill="none" stroke="currentColor"/><circle cx="48" cy="10" r="8" fill="none" stroke="currentColor"/><circle cx="16" cy="38" r="8" fill="none" stroke="currentColor"/><circle cx="48" cy="38" r="8" fill="none" stroke="currentColor"/><rect x="28" y="8" width="8" height="32" rx="4" fill="#ff6a3d"/>',
  anafi: '<path d="M24 18l-10-7M40 18l10-7M24 30l-10 7M40 30l10 7" stroke="currentColor" stroke-width="3"/><circle cx="14" cy="11" r="6" fill="none" stroke="currentColor"/><circle cx="50" cy="11" r="6" fill="none" stroke="currentColor"/><circle cx="14" cy="37" r="6" fill="none" stroke="currentColor"/><circle cx="50" cy="37" r="6" fill="none" stroke="currentColor"/><rect x="26" y="12" width="12" height="24" rx="5" fill="currentColor"/>',
  puma: '<rect x="29" y="6" width="6" height="36" rx="3" fill="currentColor"/><rect x="1" y="15" width="62" height="5" rx="2" fill="currentColor"/><rect x="22" y="37" width="20" height="4" fill="currentColor"/>',
  kfw: '<rect x="29" y="4" width="6" height="40" rx="3" fill="#ff6a3d"/><rect x="10" y="12" width="44" height="4" rx="2" fill="currentColor"/><rect x="14" y="32" width="36" height="4" rx="2" fill="currentColor"/>'
};
function afUI() {
  const box = $('afCards'); if (!box) return; box.innerHTML = '';
  for (const id of AF_IDS) {
    const a = AF[id], b = document.createElement('button'); b.className = 'afc' + (id === SET.af ? ' on' : ''); b.dataset.af = id;
    b.innerHTML = `<svg viewBox="0 0 64 48" aria-hidden="true">${AF_ICON[id]}</svg><b>${a.name}</b><small>${a.sub}</small>` +
      `<span class="spec">최고 ${Math.round(a.top * 3.6)} km/h · ${a.endur}분</span><span class="nt">${a.note}</span>`;
    b.onclick = () => { setAirframe(id); afUI(); };
    box.appendChild(b);
  }
  const HAS = { forest: !!FLANE, race: RACE.length > 0, recon: RECON.length > 0, strike: STRIKE.length > 0, fire: FIRE.length > 0, sar: !!SAR, track: !!TRACK, ridge: !!RIDGE };
  document.querySelectorAll('#msGrid [data-ms]').forEach(b => {
    const site = HAS[b.dataset.ms] !== false, ok = (MS_OK[b.dataset.ms] || []).includes(SET.af) && site; b.disabled = !ok; b.classList.toggle('off', !ok);
    b.title = ok ? '' : !site ? '이 훈련장에는 없는 임무' : '이 기체로는 할 수 없는 임무';
  });
  // 훈련장 고르기 (두 곳 이상일 때만)
  const sp = $('sitePick'), L = sitesAll();
  if (sp) { $('sitePickWrap').style.display = L.length < 2 ? 'none' : ''; sp.innerHTML = '';
    for (const st of L) { const b = document.createElement('button'); b.className = 'stc' + (st.id === SITE.id ? ' on' : ''); b.innerHTML = `<b>${stName(st)}</b><small>${st.flat ? '평지 · 기본 장애물 코스' : '실제 지형 · ' + (st.course ? '경로 따라 배치한 코스' : 'DEM')}</small>`;
      b.onclick = () => { if (st.id === SITE.id) return; siteSelect(st.id); location.reload(); }; sp.appendChild(b); } }
  const segA = $('segAcro'); if (segA) segA.querySelectorAll('button').forEach(x => x.classList.toggle('on', (x.dataset.v === '1') === !!SET.acro));
}
document.querySelectorAll('#segAcro button').forEach(b => b.addEventListener('click', () => { SET.acro = b.dataset.v === '1'; saveSet(); afUI(); }));

// =====================================================================
//  밤 · 열화상 · 산불 감시
// =====================================================================
const ENV = { night: !!SET.night, ir: false };
const DAY0 = { sun: sun.intensity, sunC: sun.color.clone(), hs: hemi.color.clone(), hg: hemi.groundColor.clone(), fog: scene.fog.color.clone(), fn: scene.fog.near, ff: scene.fog.far };
const STARS = (function () {
  const n = 1400, p = new Float32Array(n * 3), r = rng(91);
  for (let i = 0; i < n; i++) { const u = r() * 2 * Math.PI, v = Math.acos(r() * 0.95), R = 2200; p[i * 3] = Math.sin(v) * Math.cos(u) * R; p[i * 3 + 1] = Math.cos(v) * R; p[i * 3 + 2] = Math.sin(v) * Math.sin(u) * R; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 2, sizeAttenuation: false, fog: false })); m.visible = false; scene.add(m); return m;
})();
function envHemi() { return ENV.ir ? 0.55 : ENV.night ? 0.3 : 0.5; }
function envApply() {
  const n = ENV.night, ir = ENV.ir;
  sun.intensity = ir ? (n ? 0.15 : 0.6) : n ? 0.32 : DAY0.sun; sun.color.copy(n ? new THREE.Color(0x9fb4ff) : DAY0.sunC);
  hemi.color.copy(n ? new THREE.Color(0x4a5f8a) : DAY0.hs); hemi.groundColor.copy(n ? new THREE.Color(0x0c0c10) : DAY0.hg);
  const bg = ir ? (n ? 0x0b0b0b : 0x2a2a2a) : n ? 0x05070d : null;
  sky.visible = bg === null; scene.background = bg === null ? null : new THREE.Color(bg);
  scene.fog.color.copy(bg === null ? DAY0.fog : new THREE.Color(bg));
  scene.fog.near = n ? 60 : DAY0.fn; scene.fog.far = n ? 1100 : DAY0.ff;
  STARS.visible = n && !ir;
  spot.distance = n ? 45 : 14; spot.angle = n ? 0.6 : 0.7;
  // 밤: 게이트·링은 LED 테두리처럼 빛나게
  const glow = n && !ir; if (FLANE) FLANE.gateM.emissive.set(glow ? 0x803000 : 0x000000); RACE.forEach(r => r.mesh.material.emissive.set(glow ? 0x664400 : 0x332200));
  groundMat.emissive.set(ir ? (n ? 0x262626 : 0x484848) : 0x000000);
  renderer.domElement.style.filter = ir ? 'grayscale(1) contrast(1.35) brightness(1.2)' : '';
  $('irTag') && $('irTag').classList.toggle('hidden', !ir);
}
// 열화상: 재질을 열 세기(회색)로 바꿈. 사진 바닥은 그대로 (흑백이 되면 맨땅=밝고 숲=어두움)
const IR_MAT = new Map(), IR_ORIG = new Map();
function irMat(m, heat, ib) {
  const k = m.uuid + ':' + heat + ':' + ENV.night + ':' + ib; if (IR_MAT.has(k)) return IR_MAT.get(k);
  const c = m.color ? m.color : new THREE.Color(0.5, 0.5, 0.5), l = (0.3 * c.r + 0.59 * c.g + 0.11 * c.b);
  const base = (ib !== undefined ? ib : clamp(0.28 + l * 0.3, 0.2, 0.55)) * (ENV.night ? 0.55 : 1), amb = ENV.night ? 0.05 : 0.1, e = Math.min(1, heat + amb);
  const nm = new THREE.MeshLambertMaterial({ color: new THREE.Color(base, base, base), emissive: new THREE.Color(e, e, e), vertexColors: !!m.vertexColors, side: m.side, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite });
  IR_MAT.set(k, nm); return nm;
}
function irSet(on) {
  const was = ENV.ir; ENV.ir = on; envApply(); if (was === on) return;
  scene.traverse(o => {
    if (!o.isMesh || o === sky) return;
    if (o.userData.irOnly) { o.visible = on; return; }
    if (on) {
      const m = o.material; if (Array.isArray(m) || !m || m.isMeshBasicMaterial || m.isShaderMaterial || m.map) return;
      IR_ORIG.set(o, m); o.material = irMat(m, o.userData.heat || 0, o.userData.irBase);
    } else if (IR_ORIG.has(o)) o.material = IR_ORIG.get(o);
  });
  if (!on) IR_ORIG.clear();
  showMsg(on ? 'THERMAL · 백색=고온' : 'VISIBLE', on ? '#ffffff' : '#9ad7ff', 1);
}
// 산불 불씨: 숲 속 5곳. 가시광으로는 연기만(또는 안 보임), 열화상으로는 밝게
const FIRE = (function () {
  if (!PATHL || !SITE.trees) return [];
  const r = rng(2026), L = [];
  const smokeM = new THREE.MeshLambertMaterial({ color: 0x9a9a96, transparent: true, opacity: 0.22, depthWrite: false });
  const hotM = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), plumeM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
  const emberM = new THREE.MeshBasicMaterial({ color: 0xff7a22, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 5; i++) {
    let q, d, s, tries = 0;
    do { q = PATHL.at(60 + r() * (PATHL.total - 100)); const off = (r() < 0.5 ? -1 : 1) * (45 + r() * 90); d = q.d - q.ts * off; s = q.s + q.td * off; tries++; }
    while (tries < 30 && (L.some(f => Math.hypot(f.d - d, f.s - s) < 90) || (FLANE && FLANE.clear.some(p => Math.hypot(p[0] - d, p[1] - s) < 10))));
    const c = W(d, s, 0), g = new THREE.Group(); g.position.copy(c); MSG.fire.add(g);
    const hot = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), hotM); hot.rotation.x = -Math.PI / 2; hot.position.y = 0.25; hot.userData.irOnly = true; hot.visible = false; g.add(hot);
    const pl = new THREE.Mesh(UCYL, plumeM); pl.scale.set(1.4, 16, 1.4); pl.position.y = 8; pl.userData.irOnly = true; pl.visible = false; g.add(pl);
    const em = new THREE.Mesh(USPH, emberM); em.scale.set(0.9, 0.35, 0.9); em.position.y = 0.3; g.add(em);
    const puffs = []; for (let k = 0; k < 7; k++) { const p = new THREE.Mesh(USPH, smokeM); p.userData.ph = k / 7; g.add(p); puffs.push(p); }
    // 신고 지점: 실제 위치에서 조금 떨어진 곳 (수색 구역 반경 50 m)
    const ang = r() * 6.283, dist = 15 + r() * 25, area = W(d + Math.cos(ang) * dist, s + Math.sin(ang) * dist, 30);
    L.push({ kind: 'ms', t: 'fire', label: `불씨 ${i + 1} · 수색 구역 반경 50 m`, d, s, tp: c.clone().add(new V3(0, 0.6, 0)), mk: area, need: 1.2, g, em, puffs,
      pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y))]; } });
  }
  return L;
})();
function to5186(d, s) { try { const en = SITE_X.toEN(d, s); return projector(SITE.crs, 'EPSG:5186')(en); } catch (e) { return null; } }
function fireCheck(o, cur, dt) {
  const inView = sensorSees(o.tp, cur, (AFc().reconD || 260) * 0.8);
  o.inView = inView && ENV.ir; o.seenVis = inView && !ENV.ir;
  if (o.inView) { S.recT += dt; if (S.recT >= o.need) { const xy = to5186(o.d, o.s); flashPhoto(); msNext(xy ? `불씨 보고 ✓ X ${xy[0].toFixed(0)} · Y ${xy[1].toFixed(0)}` : '불씨 보고 ✓', '#ffb070'); S.fireRep = (S.fireRep || []).concat([xy]); } }
  else S.recT = Math.max(0, S.recT - dt * 0.4);
}
let envT = 0;
function envTick(dt) {
  envT += dt;
  if (!MSG.fire.visible) return;
  for (const f of FIRE) {
    f.em.material.opacity = 0.55 + 0.35 * Math.sin(envT * 9 + f.d) * Math.sin(envT * 5.3);
    f.em.visible = !ENV.ir && (ENV.night || true);
    for (const p of f.puffs) { const u = (envT * 0.12 + p.userData.ph) % 1; p.position.set(Math.sin(u * 7 + f.s) * 1.5 * u, 1 + u * 22, Math.cos(u * 5) * 1.2 * u); const k = 1 + u * 4; p.scale.set(k, k, k); p.visible = !ENV.ir && !ENV.night; }
  }
}
document.querySelectorAll('#segTime button').forEach(b => b.addEventListener('click', () => { SET.night = b.dataset.v === '1'; ENV.night = SET.night; saveSet(); envApply(); if (ENV.ir) { irSet(false); } syncTime(); }));
function syncTime() { document.querySelectorAll('#segTime button').forEach(x => x.classList.toggle('on', (x.dataset.v === '1') === !!SET.night)); }
envApply(); syncTime();


// =====================================================================
//  바람 · 수색구조 · 차량 추적 · 능선 종주
// =====================================================================
// 바람: 서북서에서 불어옴. 높이(로그 분포)·능선 노출·돌풍 반영
const WIND = { lv: SET.wind || 0, dir: new V3(Math.sin(112 * DEG), 0, -Math.cos(112 * DEG)), t: 0 };
const _wv = new V3();
function windAt(p) {
  if (!WIND.lv || !TER.h) return _wv.set(0, 0, 0);
  const base = WIND.lv === 1 ? 3 : 7, g0 = terrainAt(p.x, p.z), agl = Math.max(0.5, p.y - g0);
  const prof = clamp(Math.log((agl + 1) / 0.4) / Math.log(40 / 0.4), 0.15, 1.25);
  const m = (terrainAt(p.x + 90, p.z) + terrainAt(p.x - 90, p.z) + terrainAt(p.x, p.z + 90) + terrainAt(p.x, p.z - 90)) / 4;
  const expo = clamp(1 + (g0 - m) / 45, 0.55, 1.6);
  const t = WIND.t, gust = 1 + 0.28 * Math.sin(t * 0.9 + p.x * 0.01) * Math.sin(t * 0.37) + 0.12 * Math.sin(t * 2.3 + p.z * 0.02);
  const sw = 0.18 * Math.sin(t * 0.21);   // 방향 흔들림
  const c = Math.cos(sw), s = Math.sin(sw), dx = WIND.dir.x * c - WIND.dir.z * s, dz = WIND.dir.x * s + WIND.dir.z * c;
  const k = base * prof * expo * gust; return _wv.set(dx * k, 0, dz * k);
}
function windOsd(p) {
  if (!WIND.lv || !TER.h) return '';
  const w = windAt(p), sp = Math.hypot(w.x, w.z), rel = wrapA(Math.atan2(w.x, -w.z) - DR.h);
  return `<div><b>WIND</b>${sp.toFixed(1)} m/s <span style="display:inline-block;transform:rotate(${(rel / DEG).toFixed(0)}deg)">↑</span></div>`;
}
document.querySelectorAll('#segWind button').forEach(b => b.addEventListener('click', () => { SET.wind = +b.dataset.v; WIND.lv = SET.wind; saveSet(); syncWind(); }));
function syncWind() { document.querySelectorAll('#segWind button').forEach(x => x.classList.toggle('on', +x.dataset.v === (SET.wind || 0))); }
syncWind();

// 코스 좌표 점 목록 -> 2 m 간격 world 경로
function polyWorld(pts, step) {
  const out = []; step = step || 2;
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let t = 0; t < L; t += step) { const u = t / L; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); } }
  out.push(pts[pts.length - 1]); return out;
}
const INB = (d, s) => d > GD0 + 30 && d < GD1 - 30 && s > GS0 + 30 && s < GS1 - 30;

// ---- 수색·구조: 숲 속 소로 근처의 실종자 ----
const SAR = (function () {
  if (!VEC || !VEC.trail || !CRS_C) return null;
  const st = BY.pad_start, r = rng(515); let best = null;
  for (const a of VEC.trail) for (let i = 0; i < a.length; i += 2) {
    const d = a[i], s = a[i + 1], dist = Math.hypot(d - st.down, s - st.side);
    if (dist > 260 && dist < 480 && INB(d, s) && (!best || Math.abs(dist - 380) < Math.abs(best.dist - 380))) best = { d, s, dist };
  }
  if (!best) return null;
  const d = best.d + 7, s = best.s - 5, c = W(d, s, 0);
  const g = new THREE.Group(); g.position.copy(c); MSG.sar = MSG.sar || new THREE.Group(); scene.add(MSG.sar); MSG.sar.visible = false; MSG.sar.add(g);
  const jacket = mat(0xd9541e, { roughness: 0.8 }), pants = mat(0x2d3640, { roughness: 0.9 }), skin = mat(0xc99a7a, { roughness: 0.8 });
  const torso = new THREE.Mesh(UCAP, jacket); torso.scale.set(0.2, 0.32, 0.14); torso.rotation.z = Math.PI / 2; torso.position.set(0, 0.2, 0); g.add(torso);
  const legs = new THREE.Mesh(UBOX, pants); legs.scale.set(0.8, 0.16, 0.3); legs.position.set(-0.75, 0.1, 0); g.add(legs);
  const head = new THREE.Mesh(USPH, skin); head.scale.setScalar(0.12); head.position.set(0.48, 0.2, 0); g.add(head);
  const pack = new THREE.Mesh(UBOX, mat(0x3d5a3a, { roughness: 0.9 })); pack.scale.set(0.45, 0.3, 0.35); pack.position.set(0.1, 0.18, 0.4); g.add(pack);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.userData.heat = m.material === jacket || m.material === skin ? 0.85 : 0.5; } });
  const ang = r() * 6.283, area = W(d + Math.cos(ang) * 45, s + Math.sin(ang) * 45, 30);
  return { d, s, c, tp: c.clone().add(new V3(0, 0.3, 0)), area, g };
})();
// ---- 차량 추적: 실제 도로(수치지형도)를 따라 달리는 차량 ----
const TRACK = (function () {
  if (!VEC || !VEC.road || !CRS_C) return null;
  const segs = VEC.road.map(a => { const p = []; for (let i = 0; i < a.length; i += 2) p.push([a[i], a[i + 1]]); return p; });
  // 가장 긴 도로에서 시작해 끝이 이어지는 도로를 붙임
  const len = p => p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);
  const cand = segs.filter(p => len(p) > 300 && len(p) < 3000).sort((a, b) => len(b) - len(a));
  if (!cand.length) return null;
  let route = cand[0].slice();
  for (let k = 0; k < 3; k++) { const e = route[route.length - 1]; const nx = segs.find(p => p !== cand[0] && Math.hypot(p[0][0] - e[0], p[0][1] - e[1]) < 8); if (!nx) break; route = route.concat(nx.slice(1)); }
  route = route.filter(q => INB(q[0], q[1]));
  if (route.length < 10) return null;
  const P = polyWorld(route, 2).map(q => W(q[0], q[1], 0));
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z));
  const g = new THREE.Group(); MSG.track = MSG.track || new THREE.Group(); scene.add(MSG.track); MSG.track.visible = false; MSG.track.add(g);
  const body = mat(0x2f3b45, { roughness: 0.5, metalness: 0.3 }), glass = mat(0x1a2530, { roughness: 0.1, metalness: 0.6 }), tire = mat(0x151515, { roughness: 0.9 });
  const add = (geo, m, x, y, z, sx, sy, sz) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; g.add(me); return me; };
  add(UBOX, body, 0, 0.75, 0, 1.85, 0.8, 4.6); add(UBOX, body, 0, 1.4, 0.3, 1.7, 0.6, 2.6); add(UBOX, glass, 0, 1.42, -1.0, 1.6, 0.5, 0.05);
  for (const x of [-0.9, 0.9]) for (const z of [-1.45, 1.45]) { const w = add(UCYL, tire, x, 0.36, z, 0.36, 0.28, 0.36); w.rotation.z = Math.PI / 2; }
  g.traverse(m => { if (m.isMesh) m.userData.heat = m.material === tire ? 0.45 : 0.35; });
  return { P, cum, total: cum[cum.length - 1], g, s: 0, v: 8.5 };
})();
function trackPose(s) {
  const T = TRACK; let i = 1; while (i < T.cum.length - 1 && T.cum[i] < s) i++;
  const u = clamp((s - T.cum[i - 1]) / Math.max(1e-6, T.cum[i] - T.cum[i - 1]), 0, 1), a = T.P[i - 1], b = T.P[i];
  const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u; return { p: new V3(x, groundAt(x, z), z), h: Math.atan2(b.x - a.x, -(b.z - a.z)) };
}
// ---- 능선 종주: DEM 에서 '높은 곳을 따라가는' 최소 비용 경로 (GIS 분석) ----
const RIDGE = (function () {
  if (!TER.h || !CRS_C || !SITE.trees) return null;
  const n = TER.n, st = TER.step, H = TER.h, idx = (ix, iy) => iy * n + ix;
  const cell = (d, s) => [clamp(Math.round((s - GS0) / st), 0, n - 1), clamp(Math.round((GD1 - d) / st), 0, n - 1)];
  const ds = (ix, iy) => [GD1 - iy * st, GS0 + ix * st];
  let mn = 1e9, mx = -1e9, top = 0; const m = 12;
  for (let iy = m; iy < n - m; iy++) for (let ix = m; ix < n - m; ix++) { const h = H[idx(ix, iy)]; mn = Math.min(mn, h); if (h > mx) { mx = h; top = idx(ix, iy); } }
  function path(a, b, avoid) {
    const N = n * n, dist = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), heap = [];
    const push = (k, v) => { heap.push([v, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const L = 2 * i + 1, R = L + 1; let s = i; if (L < heap.length && heap[L][0] < heap[s][0]) s = L; if (R < heap.length && heap[R][0] < heap[s][0]) s = R; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return t; };
    dist[a] = 0; push(a, 0);
    while (heap.length) {
      const [dv, k] = pop(); if (k === b) break; if (dv > dist[k]) continue;
      const ix = k % n, iy = (k / n) | 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue; const jx = ix + ox, jy = iy + oy; if (jx < 2 || jy < 2 || jx >= n - 2 || jy >= n - 2) continue;
        const j = idx(jx, jy), low = (mx - H[j]) / Math.max(1, mx - mn), step = Math.hypot(ox, oy) * st * (1 + 9 * low * low) * (avoid && avoid[j] ? 4 : 1);
        if (dv + step < dist[j]) { dist[j] = dv + step; prev[j] = k; push(j, dist[j]); }
      }
    }
    const out = []; for (let k = b; k >= 0; k = prev[k]) { out.push(k); if (k === a) break; } return out.reverse();
  }
  const sp = BY.pad_start, lp = BY.pad_land, [ax, ay] = cell(sp.down, sp.side), [bx, by] = cell(lp.down, lp.side);
  const up = path(idx(ax, ay), top);
  const avoid = new Uint8Array(n * n); for (const k of up) { const ix = k % n, iy = (k / n) | 0; for (let oy = -10; oy <= 10; oy++) for (let ox = -10; ox <= 10; ox++) { const x = ix + ox, y = iy + oy; if (x >= 0 && y >= 0 && x < n && y < n) avoid[idx(x, y)] = 1; } }
  const down = path(top, idx(bx, by), avoid);
  const all = up.concat(down.slice(1)).map(k => ds(k % n, (k / n) | 0));
  // 70 m 마다 체크포인트
  const cps = []; let acc = 0;
  for (let i = 1; i < all.length; i++) { acc += Math.hypot(all[i][0] - all[i - 1][0], all[i][1] - all[i - 1][1]); const isTop = i === up.length - 1; if ((acc >= 70 && i < all.length - 6) || isTop) { cps.push({ q: { d: all[i][0], s: all[i][1], td: all[Math.min(all.length - 1, i + 1)][0] - all[i - 1][0], ts: all[Math.min(all.length - 1, i + 1)][1] - all[i - 1][1] }, top: isTop }); acc = 0; } }
  cps.forEach(c => { const l = Math.hypot(c.q.td, c.q.ts) || 1; c.q.td /= l; c.q.ts /= l; });
  const g = new THREE.Group(); MSG.ridge = MSG.ridge || new THREE.Group(); scene.add(MSG.ridge); MSG.ridge.visible = false; MSG.ridge.add(g);
  const list = cps.map((c, i) => { const cp = passCP(c.top ? `정상 (해발 ${(mx + SITE.base).toFixed(0)} m)` : '능선 ' + (i + 1), c.q, 0, 15, 15, 4); cp.q = c.q; cp.alt = 15;
    const tor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 40), mat(c.top ? 0xff4d4d : 0x4fe3ff, { emissive: c.top ? 0x330000 : 0x002233, roughness: 0.4 })); g.add(tor); cp.mesh = tor; return cp; });
  const flag = new THREE.Mesh(UBOX, mat(0xff4d4d)); const tw = W(ds(top % n, (top / n) | 0)[0], ds(top % n, (top / n) | 0)[1], 0); flag.position.copy(tw).add(new V3(0, 3, 0)); flag.scale.set(0.08, 6, 0.08); g.add(flag);
  return { list, top: mx + SITE.base, len: all.length * st };
})();
function scenStart(kind, a) {
  ['sar', 'track', 'ridge'].forEach(k => MSG[k] && (MSG[k].visible = false));
  if (kind === 'sar' && SAR) {
    MSG.sar.visible = true; SAR.kit = null;
    const L = [{ kind: 'ms', t: 'sarfind', label: '실종자 수색 · 구역 반경 80 m', tp: SAR.tp, mk: SAR.area, need: 1.5, pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y))]; } }];
    if (a.drop) L.push({ kind: 'ms', t: 'sarkit', label: '구조 키트 투하 (5 m 이내)', mk: SAR.c.clone().add(new V3(0, 8, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } });
    if (a.cls === 'wing') L.push(passCP('복귀 · 출발점 상공 통과', { d: BY.pad_start.down, s: BY.pad_start.side, td: 1, ts: 0 }, 0, 35, 35, 14));
    else L.push({ kind: 'ms', t: 'land', label: '출발 패드로 복귀 · 착륙', mk: startPos().add(new V3(0, 1.5, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } });
    return L;
  }
  if (kind === 'track' && TRACK) {
    MSG.track.visible = true; TRACK.s = 0; TRACK.go = false; S.trT = 0; S.trWin = 0;
    const p0 = trackPose(0); TRACK.g.position.copy(p0.p); TRACK.g.rotation.y = -p0.h;
    return [{ kind: 'ms', t: 'track', label: '차량 추적 · 시야에 60초 유지', mk: p0.p.clone().add(new V3(0, 12, 0)), need: 60, pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y))]; } }];
  }
  if (kind === 'ridge' && RIDGE) {
    MSG.ridge.visible = true; const k = a.cls === 'wing' ? 2.2 : 1;
    RIDGE.list.forEach(r => { r.ring = 4 * k; const al = a.cls === 'wing' ? 38 : 15; r.c = W(r.q.d, r.q.s, al); r.mk = r.c.clone(); r.mesh.position.copy(r.c); r.mesh.scale.setScalar(4 * k); r.mesh.lookAt(r.c.clone().add(r.n)); });
    return RIDGE.list;
  }
  return null;
}
function scenStep(o, cur, dt) {
  if (o.t === 'sarfind') {
    const d = o.tp.distanceTo(cur), vis = sensorSees(o.tp, cur, ENV.ir ? (AFc().reconD || 260) * 0.8 : 45);
    o.inView = vis; if (vis) { S.recT += dt; if (S.recT >= o.need) { const xy = to5186(SAR.d, SAR.s); flashPhoto(); S.sarXY = xy; msNext(xy ? `실종자 발견 ✓ X ${xy[0].toFixed(0)} · Y ${xy[1].toFixed(0)}` : '실종자 발견 ✓', '#5dff9a'); } } else S.recT = Math.max(0, S.recT - dt * 0.4);
  } else if (o.t === 'land') {
    const pad = startPos(); if (DR.landed && Math.hypot(DR.p.x - pad.x, DR.p.z - pad.z) < 2.5) msNext('착륙 ✓', '#5dff9a');
  } else if (o.t === 'track') {
    const T = TRACK, vp = trackPose(T.s);
    if (!T.go && cur.distanceTo(vp.p) < 220) { T.go = true; showMsg('차량 출발 · 추적 시작', '#ffc828', 1.6); }
    const tp = vp.p.clone().add(new V3(0, 1, 0)), dd = cur.distanceTo(tp), see = sensorSees(tp, cur, 320);
    o.close = dd < 25; o.inView = see && !o.close;
    if (T.go) { S.trWin += dt; if (o.inView) S.trT += dt; }
    o.mk.copy(vp.p).add(new V3(0, 12, 0));
    if (S.trT >= o.need) { S.trackOK = true; msNext(`추적 성공 · ${S.trT.toFixed(0)}초 / ${S.trWin.toFixed(0)}초`, '#5dff9a'); }
    else if (T.s >= T.total - 1) { S.trackOK = false; msNext(`차량 도착 · 추적 ${S.trT.toFixed(0)}초 (부족)`, '#ff9a40'); }
  }
}
function scenTick(dt) {
  WIND.t += dt;
  if (TRACK && MSG.track && MSG.track.visible && TRACK.go && S.state === 'run') {
    TRACK.s = Math.min(TRACK.total, TRACK.s + TRACK.v * dt); const vp = trackPose(TRACK.s), ah = trackPose(Math.min(TRACK.total, TRACK.s + 3));
    TRACK.g.position.copy(vp.p); TRACK.g.rotation.y = -vp.h; TRACK.g.rotation.x = Math.atan2(ah.p.y - vp.p.y, 3) * 1;
  }
}
// 구조 키트가 땅에 닿았을 때
function sarKit(pos) {
  const o = msObj(); if (!o || o.t !== 'sarkit') return false;
  const e = Math.hypot(pos.x - SAR.c.x, pos.z - SAR.c.z); S.kitErr = e;
  if (e <= 5) msNext(`키트 전달 ✓ ${e.toFixed(1)} m`, '#5dff9a'); else { showMsg(`키트 ${e.toFixed(1)} m · 5 m 안으로 다시`, '#ff9a40', 1.6); sfx('bad'); }
  return true;
}
function scenOsd(o) {
  if (!o) return '';
  if (o.t === 'sarfind') return `<div style="color:${o.inView ? '#5dff9a' : '#9aa6ad'}">${o.inView ? 'TARGET ' + Math.min(100, S.recT / o.need * 100).toFixed(0) + '% ●' : ENV.ir ? 'IR 수색 중' : '숲 아래는 열화상(T)'}</div>`;
  if (o.t === 'track') return `<div style="color:${o.inView ? '#5dff9a' : o.close ? '#ff9a40' : '#9aa6ad'}">TRACK ${S.trT.toFixed(0)}/${o.need}s${o.close ? ' · 너무 가까움' : o.inView ? ' ●' : TRACK.go ? ' · 시야 밖' : ' · 접근하면 출발'}</div>`;
  return '';
}

// 한국어 / English
(function langTog() {
  const cur = window.SIM_LANG === 'en' ? 'en' : 'ko';
  document.querySelectorAll('#langTog button').forEach(b => { b.classList.toggle('on', b.dataset.l === cur);
    b.onclick = () => { if (b.dataset.l === cur) return; try { localStorage.setItem('fpvsim_lang', b.dataset.l); } catch (e) { }
      if (window.SIM_DUAL) location.reload(); else location.href = b.dataset.l === 'en' ? 'en.html' : 'index.html'; }; });
})();
setAirframe(SET.af); afUI();
Object.assign(window.__sim, { WIND, windAt, SAR, TRACK, RIDGE, FIRE, irSet, ENV, envApply, AF, setAirframe, MS, msObj, FLANE, RACE, RECON, STRIKE, effMode });
})();
