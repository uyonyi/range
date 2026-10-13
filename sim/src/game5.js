// =====================================================================
//  기체 종류 · 새 임무 (숲길 통과 · 타임 레이스 · 정찰 · 타격)
//  속도·크기는 공개 제원 수준의 근사값 (기체 이름은 형상 참고용)
// =====================================================================
const AF = {
  x2d: { tag: 'X2D', name: '정찰 쿼드', sub: 'X2D형 · 66 cm · 1.3 kg', cls: 'quad', top: 13.9, vmax: { train: 7.5, easy: 10, sport: 13.9 }, tilt: { train: 20, easy: 28, sport: 38 }, climb: 6, sink: 4, yaw: 120, tw: 1.15, R: 0.24, endur: 35, drop: true,
    note: '자세 안정 · 정지 비행 · 투하 장치' },
  anafi: { tag: 'ANAFI', name: '소형 정찰 쿼드', sub: 'ANAFI USA형 · 37 cm · 0.5 kg', cls: 'quad', top: 14.7, vmax: { train: 7.5, easy: 11, sport: 14.7 }, tilt: { train: 20, easy: 30, sport: 40 }, climb: 4, sink: 4, yaw: 140, tw: 1.15, R: 0.17, endur: 32, reconD: 520,
    note: '32배 줌 · 먼 거리 정찰 · IP53' },
  fpv: { tag: 'FPV', name: 'FPV 레이싱', sub: '5인치 · 0.65 kg', cls: 'quad', top: 39, vmax: { train: 12, easy: 24, sport: 39 }, tilt: { train: 30, easy: 50, sport: 72 }, climb: 15, sink: 9, yaw: 320, tw: 3.5, R: 0.13, endur: 5, acro: true,
    note: '매우 빠름 · 스포츠에서 수동(Acro) 선택' },
  fw: { tag: 'FW', name: '고정익 정찰기', sub: '손 투척형 · 날개 1.4 m', cls: 'wing', cruise: 15, top: 25, stall: 9, span: 1.4, R: 0.45, endur: 60, bank: 50, nmax: 1.8, minAgl: 26, prate: 70, rrate: 160,
    note: '정지 불가 · 선회로 방향 전환 · 실속 주의' },
  kfpv: { tag: 'K-FPV', name: '자폭 FPV', sub: '7인치 · 탄두 모형 · 1.6 kg', cls: 'quad', top: 30, vmax: { train: 12, easy: 20, sport: 30 }, tilt: { train: 30, easy: 45, sport: 65 }, climb: 10, sink: 8, yaw: 240, tw: 2.2, R: 0.17, endur: 8, acro: true, kam: true,
    note: '부딪히면 기폭 · 표적에 직접 돌입' },
  kfw: { tag: 'K-FW', name: '자폭 고정익', sub: '배회형 · 날개 0.7 m', cls: 'wing', cruise: 26, top: 44, stall: 15, span: 0.7, R: 0.3, endur: 15, bank: 60, nmax: 2.6, minAgl: 10, prate: 90, rrate: 220, kam: true,
    note: '공중 발사 · 급강하로 표적 돌입' }
};
const AF_IDS = Object.keys(AF);
AF_IDS.forEach(k => AF[k].id = k);
const MS_OK = { course: ['x2d'], forest: ['x2d', 'anafi', 'fpv', 'kfpv'], race: ['x2d', 'anafi', 'fpv', 'fw', 'kfw'], recon: ['x2d', 'anafi', 'fw'], fire: ['x2d', 'anafi', 'fw'], strike: ['kfpv', 'kfw'], free: AF_IDS, tutorial: ['x2d'], demo: ['x2d'] };
if (!AF[SET.af]) SET.af = 'x2d';
const MS_NAME = { forest: '숲길 통과', race: '타임 레이스', recon: '정찰', strike: '타격', fire: '산불 감시' };
function AFc() { return AF[SET.af] || AF.x2d; }
function isMission(k) { k = k || S.kind; return k === 'forest' || k === 'race' || k === 'recon' || k === 'strike' || k === 'fire'; }
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
    const vt = IN.thr >= 0 ? a.cruise + IN.thr * (a.top - a.cruise) : a.cruise + IN.thr * (a.cruise - a.stall - 2);
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
  if (l > 560) { const dh = wrapA(Math.atan2(-rx, rz) - DR.h); DR.h += clamp(dh, -1, 1) * 0.6 * dt; if (S.msgCD <= 0) { showMsg('AREA LIMIT · 선회', '#ff9a40', 1); S.msgCD = 2; } }
  const cg = Math.cos(DR.pitch);
  DR.v.set(Math.sin(DR.h) * V * cg, Math.sin(DR.pitch) * V - (stall ? 2.5 : 0), -Math.cos(DR.h) * V * cg);
  DR.p.addScaledVector(DR.v, dt); DR.thrust = assist ? clamp(0.5 + IN.thr * 0.5, 0.2, 1) : clamp(0.55 + IN.thr * 0.45, 0, 1);
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
  MS.idx = 0; S.lost = 0; S.hitsS = 0; S.errS = []; S.recT = 0; S.deadT = 0; S.running = true;
  const a = AFc(); let L = [];
  if (kind === 'forest' && FLANE) L = FLANE.cps.map(c => passCP(c.label, c.q, c.hw, c.y0, c.y1));
  if (kind === 'race') { L = RACE; MSG.race.visible = true; const k = a.cls === 'wing' ? 2.2 : 1; RACE.forEach(r => { r.ring = 3.2 * k; r.mesh.scale.setScalar(3.2 * k); const al = a.cls === 'wing' ? r.alt * 0.8 + 30 : r.alt; r.c = W(r.q.d, r.q.s, al); r.mk = r.c.clone(); r.mesh.position.copy(r.c); }); }
  if (kind === 'recon') L = RECON;
  if (kind === 'fire') { L = FIRE; MSG.fire.visible = true; FIRE.forEach(f => f.done = false); S.fireRep = []; }
  if (kind === 'strike') { L = STRIKE; MSG.strike.visible = true; STRIKE.forEach(t => { t.col.off = false; if (!t.hull.userData.m0) t.hull.userData.m0 = t.hull.material; }); }
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
  document.querySelectorAll('#msGrid [data-ms]').forEach(b => {
    const ok = (MS_OK[b.dataset.ms] || []).includes(SET.af); b.disabled = !ok; b.classList.toggle('off', !ok);
    b.title = ok ? '' : '이 기체로는 할 수 없는 임무';
  });
  const segA = $('segAcro'); if (segA) segA.querySelectorAll('button').forEach(x => x.classList.toggle('on', (x.dataset.v === '1') === !!SET.acro));
}
document.querySelectorAll('#segAcro button').forEach(b => b.addEventListener('click', () => { SET.acro = b.dataset.v === '1'; saveSet(); afUI(); }));
setAirframe(SET.af); afUI();

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
  groundMat.emissive.set(ir ? (n ? 0x1a1a1a : 0x2e2e2e) : 0x000000);
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

Object.assign(window.__sim, { FIRE, irSet, ENV, envApply, AF, setAirframe, MS, msObj, FLANE, RACE, RECON, STRIKE, effMode });
})();
