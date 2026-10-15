// =====================================================================
//  기체 종류 · 새 임무 (숲길 통과 · 타임 레이스 · 정찰 · 타격)
//  속도·크기는 공개 제원 수준의 근사값 (기체 이름은 형상 참고용)
// =====================================================================
const AF = {
  x2d: { tag: 'X2D', name: 'Skydio X2D', sub: '정찰 쿼드 · 66 cm · 1.3 kg', cls: 'quad', top: 13.9, vmax: { train: 9, easy: 12, sport: 13.9 }, tilt: { train: 25, easy: 32, sport: 38 }, climb: 6, sink: 4, yaw: 120, tw: 1.15, R: 0.24, endur: 35, drop: true,
    note: '자세 안정 · 정지 비행 · 투하 장치' },
  anafi: { tag: 'ANAFI', name: 'Parrot ANAFI USA', sub: '소형 정찰 쿼드 · 37 cm · 0.5 kg', cls: 'quad', top: 14.7, vmax: { train: 9, easy: 12, sport: 14.7 }, tilt: { train: 25, easy: 32, sport: 40 }, climb: 4, sink: 4, yaw: 140, tw: 1.15, R: 0.17, endur: 32, reconD: 520,
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
    // 실속 보호: 속도가 실속 속도 가까이 떨어지면 상승각을 줄임
    const mg = (V - a.stall * 1.12) / (a.stall * 0.35); if (mg < 1) gt = Math.min(gt, Math.max(-0.15, mg) * 28 * DEG);
    DR.pitch += (gt - DR.pitch) * (1 - Math.exp(-dt * 2.2));
    DR.roll += (ir * a.bank * DEG - DR.roll) * (1 - Math.exp(-dt * 2.8));
    S.boosting = !!IN.boost;
    const vt = IN.boost ? a.top : IN.thr >= 0 ? a.cruise + IN.thr * (a.top - a.cruise) : a.cruise + IN.thr * (a.cruise - a.stall - 2);
    V += clamp(vt - V, -4, 4) * dt * 0.9;
  } else {
    // 수동(자세 안정): 스틱 = 기울기·상승각, 놓으면 수평으로 돌아옴 (고도 유지·지면 회피 없음, 실속 가능)
    const gt = -ip * 40 * DEG, rt = ir * Math.min(70, a.bank * 1.3) * DEG;
    DR.pitch += clamp(gt - DR.pitch, -a.prate * DEG * dt, a.prate * DEG * dt);
    DR.roll += clamp(rt - DR.roll, -a.rrate * DEG * dt, a.rrate * DEG * dt);
    S.boosting = !!IN.boost;
    const thr = IN.boost ? 1 : clamp(0.55 + IN.thr * 0.45, 0, 1), thrust = thr * a.top * 0.42, drag = 0.42 * a.top * (V / a.top) * (V / a.top);
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
  if (isMission() && !(a.kam && S.kind === 'strike')) comm(`${CS}, CONTROL, we lost your feed. Relaunching from the start point.`, '영상 끊김 · 출발점에서 재발진');
  else if (a.kam && S.kind === 'strike') comm('Miss, no effect on target. Next drone is up.', '빗나감 · 다음 기체 발진');
}
function deadTick(dt) { S.deadT -= dt; if (S.deadT <= 0) { respawn(); } }

// ---------------- 임무 ----------------
// ---- 사방댐 2곳 (정사영상에서 읽은 위치): 콘크리트 둑 + 위쪽 물웅덩이 ----
const DAMS = (function () {
  const L = SITE.dams || []; if (!L.length || !TER.h) return [];
  const conc = mat(0xb9b5ab, { roughness: 0.9 }), top = mat(0xd3cfc4, { roughness: 0.85 });
  const wm = new THREE.MeshStandardMaterial({ color: 0x2f4c47, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.9, depthWrite: false });
  return L.map(dm => {
    const n = dm.pool.length, pc = dm.pool.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0]);
    const a = W(dm.a[0], dm.a[1], 0), b = W(dm.b[0], dm.b[1], 0), mid = a.clone().lerp(b, 0.5);
    const crest = Math.max(W(pc[0], pc[1], 0).y + 1.2, terrainAt(mid.x, mid.z) + 2.5);
    const len = Math.hypot(b.x - a.x, b.z - a.z), yaw = -Math.atan2(b.z - a.z, b.x - a.x), bottom = Math.min(a.y, b.y, terrainAt(mid.x, mid.z)) - 3;
    const wall = new THREE.Mesh(UBOX, conc); wall.scale.set(len + 3, crest - bottom, 1.5); wall.position.set(mid.x, (crest + bottom) / 2, mid.z); wall.rotation.y = yaw;
    wall.castShadow = wall.receiveShadow = true; scene.add(wall); boxCol(wall, 'dam');
    const cap = new THREE.Mesh(UBOX, top); cap.scale.set(len + 3.2, 0.25, 1.7); cap.position.set(mid.x, crest + 0.12, mid.z); cap.rotation.y = yaw; scene.add(cap);
    const sh = new THREE.Shape(dm.pool.map(p => { const w = W(p[0], p[1], 0); return new THREE.Vector2(w.x, -w.z); }));
    const water = new THREE.Mesh(new THREE.ShapeGeometry(sh), wm); water.rotation.x = -Math.PI / 2; water.position.y = crest - 0.45; water.receiveShadow = true; water.userData.heat = 0; scene.add(water);
    return { wall, water, crest };
  });
})();
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
  // 링 20개: 높이·좌우를 바꿔 가며 약 27 m 간격
  const L = [], alts = [4, 6, 9, 5, 12, 16, 8, 4, 7, 14, 20, 11, 6, 4, 9, 15, 22, 10, 6, 5], lats = [0, 3, -3, 2, -2, 0, 3, -3, 1.5, -1.5, 0, 3, -3, 2, -2, 0, 1.5, -1.5, 2.5, 0];
  for (let i = 0; i < alts.length; i++) {
    const s = 30 + i * (PATHL.total - 50) / (alts.length - 1), q0 = PATHL.at(s), la = lats[i];
    const q = Object.assign({}, q0, { d: q0.d - q0.ts * la, s: q0.s + q0.td * la }), cp = passCP('RING ' + (i + 1), q, 0, alts[i], alts[i], 3.2);
    cp.q = q; cp.alt = alts[i]; cp.mk = W(q.d, q.s, alts[i]); cp.c = cp.mk.clone(); const tor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), mat(i === alts.length - 1 ? 0x5dff9a : 0xffc828, { emissive: 0x332200, roughness: 0.4 }));
    tor.position.copy(cp.c); tor.lookAt(cp.c.clone().add(cp.n)); MSG.race.add(tor); cp.mesh = tor; L.push(cp);
  }
  return L;
})();
// 정찰 대상: 수치지형도의 실제 건물 (출발점에서 고르게 떨어진 것)
const RECON = (function () {
  const out = []; if (!VEC || !VEC.bld || !CRS_C) return out;
  const st = BY.pad_start, B = VEC.bld.map(b => ({ b, d: Math.hypot(b[0] - st.down, b[1] - st.side) })).filter(x => x.d > 100 && x.d < 640).sort((p, q) => p.d - q.d);
  for (const x of B) { if (out.length >= 9) break; if (out.some(o => Math.hypot(o.b[0] - x.b[0], o.b[1] - x.b[1]) < 110)) continue; out.push(x); }
  return out.map((x, i) => { const [d, s, w, l, ang, h] = x.b, tp = W(d, s, h * 0.6);
    return { kind: 'ms', t: 'recon', wl: `${Math.round(w)}×${Math.round(l)} m`, d, s, label: '', tp, mk: W(d, s, h + 6), need: 1.5, pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y + 15))]; } }; });
})();
// 타격 표적 (가상의 표적 차량 3대)
const STRIKE = (function () {
  if (!PATHL) return [];
  const L = [], body = mat(0x59604a, { roughness: 0.85 }), dark = mat(0x2c3026, { roughness: 0.9 }), mark = mat(0xff3b30, { roughness: 0.6, emissive: 0x220000 });
  [[150, 5], [235, -6], [320, 5], [400, -4], [475, 4]].forEach(([s, off], i) => {
    const q = PATHL.at(Math.min(s, PATHL.total - 8)), d = q.d - q.ts * off, sd = q.s + q.td * off, c = W(d, sd, 0), yaw = Math.atan2(q.ts, q.td);
    const g = new THREE.Group(); g.position.copy(c); g.rotation.y = Math.PI / 2 - yaw; MSG.strike.add(g);
    const hull = new THREE.Mesh(UBOX, body); hull.scale.set(2.4, 1.3, 5.2); hull.position.y = 1.05; g.add(hull);
    const cab = new THREE.Mesh(UBOX, body); cab.scale.set(2.2, 0.9, 1.6); cab.position.set(0, 2.05, -1.4); g.add(cab);
    for (const sx of [-1.25, 1.25]) for (const z of [-1.7, 0, 1.7]) { const w = new THREE.Mesh(UCYL, dark); w.scale.set(0.5, 0.35, 0.5); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.5, z); g.add(w); }
    const x = new THREE.Mesh(UBOX, mark); x.scale.set(1.6, 0.04, 1.6); x.position.set(0, 1.72, 0.6); g.add(x);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.heat = 0.28; } });
    const col = boxCol(hull, 'stk'); col.off = true;
    L.push({ kind: 'ms', t: 'strike', label: `표적 ${i + 1} · 차량`, g, col, parts: g.children.filter(x => x.isMesh), c: c.clone().add(new V3(0, 1.4, 0)), mk: c.clone().add(new V3(0, 5, 0)), hull,
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
  if (kind === 'recon') L = reconPick();
  if (kind === 'fire') L = firePick();
  if (kind === 'strike') L = strikePick();
  const SC = scenStart(kind, a); if (SC) L = SC;
  L.forEach(o => { o.done = false; o.miss = false; }); S.msNear = null; MS.list = L; MS.kind = kind; MS.t0 = 0; MS.events = []; S.decoyHit = 0;
  // 시작 위치: 고정익·자폭 고정익은 공중에서
  const p0 = startPos(), o = msObj(); let h = startHead();
  if (o) { const d = o.mk.clone().sub(p0); h = Math.atan2(d.x, -d.z); }
  if (a.cls === 'wing') { p0.y = groundAt(p0.x, p0.z) + (a.kam ? 45 : 30); wingAir(p0, h); } else resetDrone(p0, h);
  MS.launch = { p: DR.p.clone(), h };
  S.respawn = null;
  if (ENV.ir) { irSet(false); irSet(true); }   // 바뀐 열 세기 반영
  MS.par = msPar(kind, L); briefShow(kind, L);
}
function msNext(msg, col) {
  const o = msObj(); if (!o) return;
  o.done = true; sfx('good'); showMsg(msg || (o.label + ' ✓'), col || '#5dff9a', 1.3);
  MS.idx++; while (MS.list[MS.idx] && MS.list[MS.idx].done) MS.idx++; S.recT = 0; commAck(o, S.kind);
  S.respawn = S.kind === 'strike' ? null : { p: DR.p.clone(), h: DR.h };
  renderList();
  if (MS.idx >= MS.list.length) msFinish();
}
// 통과점 면을 앞으로 지났으면 true(안쪽)/false(바깥), 안 지났으면 null
function passCross(o, prev, cur) {
  const a = _mv.subVectors(prev, o.c).dot(o.n), b = _mv.subVectors(cur, o.c).dot(o.n);
  if (!(a < 0 && b >= 0)) return null;
  const t = a / (a - b), x = prev.clone().lerp(cur, t), lat = _mv.subVectors(x, o.c).dot(o.r);
  if (o.ring) return x.distanceTo(o.c) <= o.ring - DR.R * 0.5;
  const h = x.y - terrainAt(x.x, x.z); return Math.abs(lat) <= o.hw && h >= o.y0 && h <= o.y1;
}
// 통과점 하나만 실패로 두고 다음 목표로
function msSkip() {
  const o = msObj(); if (!o) return;
  o.done = true; o.miss = true; sfx('bad'); showMsg(o.label + ' ✗ → NEXT', '#ff9a40', 1.3);
  comm(`${CS}, CONTROL. You missed that checkpoint. Press on to the next.`, `${o.label} 실패 · 다음 목표로`);
  MS.idx++; while (MS.list[MS.idx] && MS.list[MS.idx].done) MS.idx++; S.recT = 0;
  S.respawn = { p: DR.p.clone(), h: DR.h }; renderList();
  if (MS.idx >= MS.list.length) msFinish();
}
function msStep(prev, cur, dt) {
  const o = msObj(); if (!o || !DR.alive) return;
  if (o.t === 'pass') {
    // 숲길·능선: 놓치고 지나가면 그 통과점만 실패(✗)로 두고 다음으로 (레이스는 되돌아와야 함)
    if (S.kind !== 'race') {
      for (let j = MS.idx + 1; j <= Math.min(MS.idx + 2, MS.list.length - 1); j++) {
        const q = MS.list[j]; if (q.t !== 'pass' || passCross(q, prev, cur) !== true) continue;
        const missed = []; for (let k = MS.idx; k < j; k++) if (!MS.list[k].done) { MS.list[k].miss = true; missed.push(MS.list[k].label); }
        for (let k = MS.idx; k < j; k++) MS.list[k].done = true;
        MS.idx = j; comm(`${CS}, CONTROL. You missed a checkpoint. Press on.`, `${missed.join(', ')} 실패 · 계속 진행`);
        msNext(`${missed.join(' · ')} ✗ → ${q.label} ✓`, '#ff9a40'); return;
      }
      const nx = MS.list[MS.idx + 1];
      if (nx && nx.c) {
        const A = o.c, dx = nx.c.x - A.x, dz = nx.c.z - A.z, L2 = dx * dx + dz * dz, dA = Math.hypot(cur.x - A.x, cur.z - A.z);
        if (dA < 20) S.msNear = o;
        const u = L2 > 1 ? ((cur.x - A.x) * dx + (cur.z - A.z) * dz) / L2 : 0;
        if (S.msNear === o && u > 0.5) { msSkip(); return; }
      }
    }
    const r = passCross(o, prev, cur);
    if (r === true) msNext(); else if (r === false && S.bumpT <= 0) { showMsg(L2('MISS · 다시 통과', 'MISS · fly through again'), '#ff9a40', 1); sfx('bad'); S.bumpT = 0.6; }
  } else if (o.t === 'fire') fireStep(cur, dt);
  else if (o.t === 'strikeAll') strikeAim(o, cur);
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
  const so = msObj(); if (!so || so.t !== 'strikeAll') return false;
  const o = STRIKE.find(t => !t.dead && (() => { const l = t.hull.worldToLocal(DR.p.clone()); return Math.abs(l.x) < 0.5 + 0.9 / 2.4 && Math.abs(l.y) < 0.5 + 0.9 / 1.3 && Math.abs(l.z) < 0.5 + 0.9 / 5.2; })());
  if (!o) return false;
  if (o.decoy) {   // 기만체: 가시광으로는 같지만 열화상으로는 차가움
    o.dead = true; o.col.off = true; o.hull.material = mat(0x1d1d1b, { roughness: 1 }); S.decoyHit++; S.pen += 20;
    spawnImpact(o.c.clone(), true); sfx('crash'); shake = 0.15; DR.alive = false; S.deadT = 1.8; droneM.g.visible = false;
    showMsg('DECOY +20s', '#ff9a40', 1.8); comm(`Negative, ${CS}, that was a decoy. Confirm heat signature before you commit.`, '기만체였음. 돌입 전 열 신호(T) 확인할 것.'); return true;
  }
  const err = Math.hypot(DR.p.x - o.c.x, DR.p.z - o.c.z);
  S.hitsS++; S.errS.push(err); o.dead = true; o.col.off = true;
  o.hull.material = mat(0x1d1d1b, { roughness: 1 });
  spawnImpact(o.c.clone(), true); spawnImpact(DR.p.clone(), true); sfx('crash'); rumble(1, 1, 400); shake = 0.2;
  DR.alive = false; S.deadT = 1.8; droneM.g.visible = false;
  sfx('good'); showMsg(`HIT · 중심에서 ${err.toFixed(1)} m`, '#5dff9a', 1.4); so.label = strikeLabel(); renderList();
  { const left = STRIKE.filter(t => !t.decoy && !t.dead).length; comm(left ? `Good hit, target destroyed. ${left} remaining. Next drone is up.` : 'Good effect on all targets. Cease fire, cease fire.', left ? `명중 확인. 남은 표적 ${left}대. 다음 기체 발진.` : '모든 표적 무력화. 사격 중지.'); }
  if (S.hitsS >= STRIKE.filter(t => !t.decoy).length) { so.done = true; MS.idx++; msFinish(); }
  return true;
}
function msFinish() {
  S.finished = true; S.running = false; if (REC) LAST_REC = recFinish();
  comm(`Mission complete. Good work, ${CS}. CONTROL out.`, '임무 완료 · 수고했음.');
  setTimeout(() => {
    if (S.state !== 'run') return;
    S.state = 'result'; ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden');
    const a = AFc(), total = S.t + S.pen, nm = MS_NAME[S.kind];
    ui.resSub.textContent = `${nm} · ${a.name} · ${MODES[SET.diff].name}`;
    const G = msGrade(total), rows = [[L2('등급', 'Grade'), `<b style="color:${G.c};font-size:18px">${G.g}</b> (${L2('기준', 'par')} ${fmt(MS.par || 0)})`], ['비행 시간', fmt(S.t)], ['벌점', '+' + S.pen.toFixed(0) + ' s'], ['합계', fmt(total)], ['충돌', S.impacts + ' 회']];
    if (S.kind === 'strike') rows.push(['명중', S.hitsS + ' / ' + STRIKE.filter(t => !t.decoy).length], [L2('기만체 타격', 'Decoys hit'), (S.decoyHit || 0) + L2(' 대', '')], ['기체 손실(빗나감)', (S.lost || 0) + ' 대'], ['평균 오차', (S.errS.reduce((x, y) => x + y, 0) / Math.max(1, S.errS.length)).toFixed(1) + ' m']);
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
  if (S.kind === 'strike') h += `<div><b>HIT</b>${S.hitsS || 0}/${STRIKE.filter(t => !t.decoy).length}</div><div><b>LOST</b>${S.lost || 0}</div>`;
  else if (isMission()) h += `<div><b>HIT</b>${S.impacts}</div>`;
  if (S.kind === 'fire') { const n = FIRE.filter(f => f.on && f.active && !f.done).length, w = FIRE.filter(f => f.on && !f.active).length; h += `<div style="color:#ffb070">FIRE ${n}${w ? ' +' + w : ''}</div>`; }
  if (o && o.t === 'fire') h += o.inView ? `<div style="color:#ffb070">HOT ${Math.min(100, S.recT / o.need * 100).toFixed(0)}% ●</div>` : o.seenVis ? '<div style="color:#9aa6ad">열화상(T)으로 확인</div>' : `<div style="color:#9aa6ad">${ENV.ir ? 'IR 수색 중' : '열화상 끔 · T'}</div>`;
  h += scenOsd(o);
  if (o && o.t === 'recon') h += `<div style="color:${o.inView ? '#5dff9a' : '#9aa6ad'}">REC ${Math.min(100, S.recT / o.need * 100).toFixed(0)}%${o.inView ? ' ●' : ' · 화면 가운데나 아래 카메라에 담기'}</div>`;
  return h;
}
function msListHTML() {
  return MS.list.map((o, i) => { const cls = i === MS.idx ? 'cur' : o.miss ? 'miss' : o.done ? 'done' : ''; return `<div class="${cls}">${o.miss ? '✗' : o.done ? '✓' : i === MS.idx ? '▶' : '·'} ${o.label}</div>`; }).join('');
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
    const cat = a.kam ? 'kam' : a.cls === 'wing' ? 'wing' : id === 'fpv' ? 'fpv' : 'quad'; b.dataset.cat = cat;
    const catN = { quad: L2('정찰 쿼드', 'Recon quad'), fpv: L2('FPV', 'FPV'), wing: L2('고정익', 'Fixed-wing'), kam: L2('자폭', 'Loitering') }[cat];
    b.innerHTML = `<svg viewBox="0 0 64 48" aria-hidden="true">${AF_ICON[id]}</svg><i class="cat">${catN}</i><b>${a.name}</b><small>${a.sub}</small>` +
      `<span class="spec">최고 ${Math.round(a.top * 3.6)} km/h · ${a.endur}분</span><span class="nt">${a.note}</span>`;
    b.onclick = () => { MENU.afNote = ''; setAirframe(id); afUI(); };
    box.appendChild(b);
  }
  const HAS = { forest: !!FLANE, race: RACE.length > 0, recon: RECON.length > 0, strike: STRIKE.length > 0, fire: FIRE.length > 0, sar: !!SAR, track: !!TRACK, ridge: !!RIDGE };
  document.querySelectorAll('#msGrid [data-ms]').forEach(b => { b.dataset.site = HAS[b.dataset.ms] !== false ? '1' : '0'; b.classList.remove('off'); b.title = ''; });
  if (typeof msVis === 'function') msVis();
  // 훈련장 고르기 (두 곳 이상일 때만)
  const sp = $('sitePick'), L = sitesAll();
  if (sp) { $('sitePickWrap').style.display = L.length < 2 ? 'none' : ''; sp.innerHTML = '';
    for (const st of L) { const b = document.createElement('button'); b.className = 'stc' + (st.id === SITE.id ? ' on' : ''); b.innerHTML = `<b>${stName(st)}</b><small>${st.flat ? '평지 · 기본 장애물 코스' : '실제 지형 · ' + (st.course ? '경로 따라 배치한 코스' : 'DEM')}</small>`;
      b.onclick = () => { if (st.id === SITE.id) return; siteSelect(st.id); location.reload(); }; sp.appendChild(b); } }
  const segA = $('segAcro'); if (segA) segA.querySelectorAll('button').forEach(x => x.classList.toggle('on', (x.dataset.v === '1') === !!SET.acro));
  if (typeof MENU !== 'undefined' && $('msDetail')) { menuAfPanel(); menuDetail(); }
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
  for (let i = 0; i < 8; i++) {
    let q, d, s, tries = 0;
    do { q = PATHL.at(60 + r() * (PATHL.total - 100)); const off = (r() < 0.5 ? -1 : 1) * (45 + r() * 90); d = q.d - q.ts * off; s = q.s + q.td * off; tries++; }
    while (tries < 30 && (L.some(f => Math.hypot(f.d - d, f.s - s) < 70) || (FLANE && FLANE.clear.some(p => Math.hypot(p[0] - d, p[1] - s) < 10))));
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
    if (!f.on || !f.active) continue;
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
    MSG.sar.visible = true; SAR.kit = null; sarRandom();
    const L = [{ kind: 'ms', t: 'sarfind', label: '실종자 수색 · 구역 반경 80 m', tp: SAR.tp, mk: SAR.area, need: 1.5, pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y))]; } }];
    if (a.drop) L.push({ kind: 'ms', t: 'sarkit', label: '구조 키트 투하 (5 m 이내)', mk: SAR.c.clone().add(new V3(0, 8, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } });
    if (a.cls === 'wing') L.push(passCP('복귀 · 출발점 상공 통과', { d: BY.pad_start.down, s: BY.pad_start.side, td: 1, ts: 0 }, 0, 35, 35, 14));
    else L.push({ kind: 'ms', t: 'land', label: '출발 패드로 복귀 · 착륙', mk: startPos().add(new V3(0, 1.5, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } });
    return L;
  }
  if (kind === 'track' && TRACK) {
    MSG.track.visible = true; TRACK.go = false; S.trT = 0; S.trWin = 0; trackRandom();
    const p0 = trackPose(TRACK.s); TRACK.g.position.copy(p0.p); TRACK.g.rotation.y = -p0.h;
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
    if (!T.go && cur.distanceTo(vp.p) < 220) { T.go = true; showMsg('차량 출발 · 추적 시작', '#ffc828', 1.6); comm(`${CS}, target is moving. You have the eye, keep it.`, '표적 차량 이동 시작 · 관측 유지'); }
    const tp = vp.p.clone().add(new V3(0, 1, 0)), dd = cur.distanceTo(tp), see = sensorSees(tp, cur, 320);
    o.close = dd < 25; o.inView = see && !o.close;
    if (T.go) { S.trWin += dt; if (o.inView) S.trT += dt; }
    o.mk.copy(vp.p).add(new V3(0, 12, 0));
    if (S.trT >= o.need) { S.trackOK = true; comm('Good track, we have what we need. Break off and RTB.', '추적 완료 · 이탈 후 복귀'); msNext(`추적 성공 · ${S.trT.toFixed(0)}초 / ${S.trWin.toFixed(0)}초`, '#5dff9a'); }
    else if (T.s >= T.total - 1) { S.trackOK = false; msNext(`차량 도착 · 추적 ${S.trT.toFixed(0)}초 (부족)`, '#ff9a40'); }
  }
}
function scenTick(dt) {
  WIND.t += dt; msEvents(dt); commTick(dt);
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

// =====================================================================
//  임무 진행 (매번 달라지는 배치 · 브리핑 · 무전 · 시간에 따른 사건 · 등급)
// =====================================================================
const L2 = (ko, en) => window.SIM_LANG === 'en' ? en : ko;
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function nearOrder(L, p) { const out = [], rest = L.slice(); let c = p; while (rest.length) { let k = 0, bd = 1e9; rest.forEach((o, i) => { const d = Math.hypot(o.tp.x - c.x, o.tp.z - c.z); if (d < bd) { bd = d; k = i; } }); c = rest[k].tp; out.push(rest.splice(k, 1)[0]); } return out; }
function reconPick() {
  const L = nearOrder(shuffle(RECON).slice(0, Math.min(4, RECON.length)), startPos());
  L.forEach((o, i) => { o.label = `정찰 ${i + 1} · 건물 (${o.wl})`; o.done = false; }); return L;
}
// 산불: 후보 8곳 중 5곳, 3곳은 처음부터 · 2곳은 나중에 신고
function firePick() {
  MSG.fire.visible = true; S.fireRep = [];
  FIRE.forEach(f => { f.on = false; f.g.visible = false; f.done = false; f.spread = false; });
  const P = shuffle(FIRE).slice(0, 5), when = [0, 0, 0, 40 + Math.random() * 20, 85 + Math.random() * 25];
  P.forEach((f, i) => { f.on = true; f.ignT = when[i]; f.active = when[i] === 0; f.g.visible = f.active; f.label = `불씨 ${i + 1} · 수색 구역 반경 50 m`; });
  return P;
}
function fireStep(cur, dt) {
  for (const f of MS.list) {
    if (f.done || !f.active) continue;
    const vis = sensorSees(f.tp, cur, (AFc().reconD || 260) * 0.8);
    f.inView = vis && ENV.ir; f.seenVis = vis && !ENV.ir;
    f.recT = f.inView ? (f.recT || 0) + dt : Math.max(0, (f.recT || 0) - dt * 0.4);
    if (f.recT >= f.need) {
      const xy = to5186(f.d, f.s); flashPhoto(); f.done = true; S.fireRep.push(xy); sfx('good'); commAck(f, 'fire');
      showMsg(xy ? `불씨 보고 ✓ X ${xy[0].toFixed(0)} · Y ${xy[1].toFixed(0)}` : '불씨 보고 ✓', '#ffb070', 1.6);
      MS.idx = MS.list.findIndex(x => !x.done); if (MS.idx < 0) { MS.idx = MS.list.length; msFinish(); } renderList(); return;
    }
  }
  const o = msObj(); if (o) S.recT = o.recT || 0;
}
// 타격: 차량 5대 중 실물 3대(엔진 열) · 기만체 2대(차가움)
function strikeLabel() { const n = STRIKE.filter(t => !t.decoy).length; return L2(`실물 표적 타격 ${S.hitsS || 0}/${n} · 기만체 ${STRIKE.length - n}대 섞임`, `Hit real targets ${S.hitsS || 0}/${n} · ${STRIKE.length - n} decoys mixed in`); }
function strikePick() {
  MSG.strike.visible = true; S.hitsS = 0;
  const roles = shuffle([0, 0, 0, 1, 1]);
  STRIKE.forEach((t, i) => { t.decoy = !!roles[i]; t.dead = false; t.col.off = false; if (!t.hull.userData.m0) t.hull.userData.m0 = t.hull.material; t.hull.material = t.hull.userData.m0; t.parts.forEach(p => p.userData.heat = t.decoy ? 0.0 : 0.5); });
  return [{ kind: 'ms', t: 'strikeAll', label: strikeLabel(), mk: STRIKE[0].mk.clone(), pts(p) { return [p.clone(), this.mk.clone()]; } }];
}
function strikeAim(o, cur) { let b = null, bd = 1e9; for (const t of STRIKE) { if (t.dead) continue; const d = t.c.distanceTo(cur); if (d < bd) { bd = d; b = t; } } if (b) o.mk.copy(b.c); }
// 기준 시간 · 등급
function msPar(kind, L) {
  const a = AFc(), v = a.cls === 'wing' ? a.cruise : Math.min(a.top, 12);
  if (kind === 'forest') return (FLANE ? FLANE.total : 400) / Math.min(v, 6) + 15;
  if (kind === 'race') return (PATHL ? PATHL.total : 500) / (v * 0.85) + 10;
  if (kind === 'ridge') return (RIDGE ? RIDGE.len : 900) / (v * 0.8) + 20;
  if (kind === 'recon') return 60 + L.length * 45;
  if (kind === 'fire') return 200;
  if (kind === 'strike') return 150;
  if (kind === 'sar') return 220;
  if (kind === 'track') return 150;
  return 180;
}
function msGrade(total) {
  if (S.kind === 'track') return S.trackOK ? { g: S.trT / Math.max(1, S.trWin) > 0.8 ? 'S' : 'A', c: '#5dff9a' } : { g: 'C', c: '#ff6060' };
  const r = total / Math.max(1, MS.par || 1);
  return r <= 1 ? { g: 'S', c: '#ffc828' } : r <= 1.3 ? { g: 'A', c: '#5dff9a' } : r <= 1.7 ? { g: 'B', c: '#4fe3ff' } : { g: 'C', c: '#ff9a40' };
}
// 무전 (화면 아래 가운데, 몇 초 뒤 사라짐)
let radioT = 0;
function radio(text) { const el = $('radio'); if (!el) return; el.innerHTML = '<b>📻</b> ' + text; el.classList.add('show'); radioT = 5; sfx('good'); }
// 브리핑
const BRIEF = window.SIM_LANG === 'en' ? {
  forest: ['Forest trail', 'Follow a narrow trail cut through the forest beside the main route: gates, tight gaps and fallen trunks to the finish.', 'Trees are 2–3 m apart. Stay low, under the canopy (below 3 m AGL).'],
  race: ['Valley time race', 'Fly through the rings along the valley, in order, as fast as you can.', 'Boost (BST) takes you to the airframe top speed. Miss a ring and you must come back through it.'],
  recon: ['Building recon', 'Find and photograph 4 random real buildings from the topo map.', 'Hold each building centered on screen or in the belly cam for 1.5 s. Targets change every run.'],
  strike: ['Vehicle strike', '5 vehicles: 3 real, 2 decoys. Hit only the real ones.', 'They look identical in daylight. In thermal (T) the real ones show engine heat. Hitting a decoy costs +20 s.'],
  fire: ['Wildfire watch', '3 hotspots reported in the forest. More reports may come in during the flight.', 'Find each hotspot with thermal (T) and report its coordinates. After 150 s a hotspot spreads (+15 s).'],
  sar: ['Search & rescue', 'A hiker is missing near the trails. The location changes every run.', 'Under the canopy only thermal shows them. The radio narrows the area over time. Drop the kit, then return and land.'],
  track: ['Vehicle tracking', 'Keep a car driving on a real road in view for 60 s.', 'Closer than 25 m and you are spotted (no tracking time). The car changes speed and stops now and then.'],
  ridge: ['Ridge run', 'Climb to the summit along a DEM-derived ridge and come down another ridge.', 'Ridges are windy. Pass the rings in order.']
} : {
  forest: ['숲 속 좁은 길', '주 경로 옆 숲 속에 낸 좁은 길을 따라 게이트·좁은 틈·쓰러진 나무를 지나 결승까지.', '나무 사이는 2~3 m. 수관 아래(지면 3 m 이하)로 낮게 날 것.'],
  race: ['계곡 타임 레이스', '계곡을 따라 놓인 링을 순서대로 최단 시간에 통과.', '부스트(BST)로 기체 최고 속도까지. 링을 빗나가면 되돌아와 다시 통과.'],
  recon: ['건물 정찰', '수치지형도에 있는 실제 건물 중 무작위 4곳을 찾아 촬영.', '건물을 화면 가운데나 아래 카메라에 1.5초 담기. 매번 대상이 바뀜.'],
  strike: ['차량 표적 타격', '차량 5대 중 실물은 3대, 나머지 2대는 기만체. 실물만 골라 돌입.', '가시광으로는 똑같음. 열화상(T)에서 엔진 열이 있는 차량이 실물. 기만체를 치면 +20초.'],
  fire: ['산불 감시', '숲 속 불씨 3곳이 신고됨. 비행 중 추가 신고가 들어올 수 있음.', '열화상(T)으로 불씨를 찾아 좌표 보고. 신고 후 150초가 지나면 번져서 +15초.'],
  sar: ['실종자 수색·구조', '등산로 근처에서 실종자 신고. 위치는 매번 다름.', '숲 아래는 열화상으로만 보임. 시간이 지나면 무전으로 구역이 좁혀짐. 찾으면 키트 투하 후 복귀 착륙.'],
  track: ['차량 추적', '실제 도로를 달리는 차량을 60초 동안 시야에 유지.', '25 m 안으로 붙으면 노출(추적 시간 안 쌓임). 차량은 속도를 바꾸고 중간에 서기도 함.'],
  ridge: ['능선 종주', 'DEM 분석으로 뽑은 능선을 따라 정상까지 올라갔다가 다른 능선으로 내려옴.', '능선은 바람이 셈. 링을 순서대로 통과.']
};
function briefShow(kind, L) {
  const b = BRIEF[kind], el = $('brief'); if (!b || !el) return;
  const cond = [WIND.lv ? (WIND.lv === 1 ? L2('바람 약 3 m/s', 'Wind 3 m/s') : L2('바람 강 7 m/s', 'Wind 7 m/s')) : L2('바람 없음', 'No wind'), ENV.night ? L2('밤', 'Night') : L2('낮', 'Day'), AFc().name].join(' · ');
  el.innerHTML = `<div class="bc"><div class="bt">BRIEFING</div><h3>${b[0]}</h3><p>${b[1]}</p><p class="bn">${b[2]}</p><div class="bm">${cond} · ${L2('기준 시간', 'Par time')} ${fmt(MS.par)}</div><button class="primary" id="briefGo">${L2('시작', 'Start')}</button></div>`;
  el.classList.remove('hidden'); S.brief = true;
  const go = () => { el.classList.add('hidden'); S.brief = false; commStart(kind); };
  $('briefGo').onclick = go; el.onpointerdown = e => { if (e.target === el) go(); };
  BRIEF_GO = go;
}
let BRIEF_GO = null;
// 시간에 따른 사건 (불씨 추가·번짐, 실종자 구역 좁힘, 차량 정차·속도 변화)
function msEvents(dt) {
  if (S.state !== 'run' || S.brief || !isMission()) return;
  MS.t0 += dt; const t = MS.t0;
  if (S.kind === 'fire') {
    for (const [i, f] of MS.list.entries()) {
      if (!f.active && t >= f.ignT) { f.active = true; f.g.visible = true; comm(`${CS}, CONTROL. New fire report, hotspot ${i + 1}, grid ${grid(f.d, f.s)}. Over.`, `새 산불 신고 · 불씨 ${i + 1} (지도 표시 구역)`); renderList(); if (MS.idx >= MS.list.length || MS.list[MS.idx].done) MS.idx = i; }
      if (f.active && !f.done && !f.spread && t - f.ignT > 150) { f.spread = true; S.pen += 15; comm(`${CS}, hotspot ${i + 1} is spreading. Expedite your report.`, `불씨 ${i + 1} 번짐 · +15초`); f.g.scale.setScalar(1.8); }
    }
  }
  if (S.kind === 'sar') {
    const o = msObj();
    if (o && o.t === 'sarfind') {
      if (!MS.h1 && t > 60) { MS.h1 = true; o.mk.lerp(SAR.tp.clone().setY(o.mk.y), 0.55); o.label = L2('실종자 수색 · 구역 반경 40 m', 'Find the hiker · area radius 40 m'); comm(`${CS}, CONTROL. Witness report, subject within four zero meters of the marked area. Over.`, '목격 제보 · 수색 구역 반경 40 m'); renderList(); }
      if (!MS.h2 && t > 130) { MS.h2 = true; o.mk.lerp(SAR.tp.clone().setY(o.mk.y), 0.6); o.label = L2('실종자 수색 · 구역 반경 20 m', 'Find the hiker · area radius 20 m'); comm('Phone ping narrows it to two zero meters. Look under the canopy, use thermal.', '휴대전화 위치 · 반경 20 m, 열화상으로 수관 아래 확인'); renderList(); }
    }
  }
  if (S.kind === 'track' && TRACK && TRACK.go) {
    const T = TRACK; T.tt = (T.tt || 0) + dt;
    if (T.stopT > 0) { T.stopT -= dt; T.v = 0; if (T.stopT <= 0) comm('Target is moving again. Stay on it.', '차량 다시 출발 · 계속 추적'); }
    else { T.v = T.base * (0.8 + 0.35 * Math.sin(T.tt * 0.11 + T.ph)); if (T.stops.length && T.s > T.stops[0]) { T.stops.shift(); T.stopT = 6 + Math.random() * 6; comm('Target has stopped. Hold your standoff, keep eyes on.', '차량 정차 · 거리 유지하며 관측'); } }
  }
}
// 실종자·차량 무작위 배치 (scenStart 에서 부름)
const SAR_POOL = (function () {
  if (!SAR) return [];
  const st = BY.pad_start, P = [];
  for (const a of VEC.trail) for (let i = 0; i < a.length; i += 6) { const d = a[i], s = a[i + 1], dist = Math.hypot(d - st.down, s - st.side); if (dist > 220 && dist < 520 && INB(d, s) && !P.some(p => Math.hypot(p[0] - d, p[1] - s) < 90)) P.push([d, s]); }
  return P.length ? P : [[SAR.d, SAR.s]];
})();
function sarRandom() {
  const q = SAR_POOL[Math.floor(Math.random() * SAR_POOL.length)], d = q[0] + (Math.random() - 0.5) * 12, s = q[1] + (Math.random() - 0.5) * 12, c = W(d, s, 0);
  SAR.d = d; SAR.s = s; SAR.c.copy(c); SAR.tp.copy(c).add(new V3(0, 0.3, 0)); SAR.g.position.copy(c); SAR.g.rotation.y = Math.random() * 6.28;
  const ang = Math.random() * 6.283; SAR.area.copy(W(d + Math.cos(ang) * 45, s + Math.sin(ang) * 45, 30)); MS.h1 = MS.h2 = false;
}
function trackRandom() { const T = TRACK; T.s = Math.random() * T.total * 0.25; T.base = 7 + Math.random() * 3; T.ph = Math.random() * 6; T.tt = 0; T.stopT = 0; T.stops = [T.s + 400 + Math.random() * 300, T.s + 1100 + Math.random() * 400]; }

// =====================================================================
//  무전 교신 (영어 · 원격 통제소가 지시). 화면 표시 + 무전 잡음 + 영어 음성(설정)
// =====================================================================
const CS = 'EAGLE ONE';
const PHON = { A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const DIG = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
// 코스 좌표 -> MGRS 8자리 (예: 52S CF 1693 7959)
function grid(d, s) {
  try {
    const en = projector(SITE.crs, 'EPSG:32652')(SITE_X.toEN(d, s)), e = en[0], n = en[1], zone = 52;
    const set = zone % 6 || 6, cols = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'][(set - 1) % 3], rows = zone % 2 ? 'ABCDEFGHJKLMNPQRSTUV' : 'FGHJKLMNPQRSTUVABCDE';
    const c = cols[Math.floor(e / 1e5) - 1], r = rows[Math.floor(n / 1e5) % 20], ee = String(Math.floor(e % 1e5 / 10)).padStart(4, '0'), nn = String(Math.floor(n % 1e5 / 10)).padStart(4, '0');
    return `${zone}S ${c}${r} ${ee} ${nn}`;
  } catch (e) { return '—'; }
}
// 음성용: 격자 글자는 음성 문자, 숫자는 한 자리씩
function speakify(t) {
  return t.replace(/(?:grid )?(\d+)S ([A-Z])([A-Z]) (\d{4}) (\d{4})/gi, (m, z, a, b, x, y) => `grid ${PHON[a]} ${PHON[b]}, ${x.split('').map(d => DIG[+d]).join(' ')}, ${y.split('').map(d => DIG[+d]).join(' ')}`)
    .replace(/\bEAGLE ONE\b/g, 'Eagle One').replace(/\bCONTROL\b/g, 'Control').replace(/\bRTB\b/g, 'R T B');
}
const COMM = { q: [], busy: 0, voice: null };
function pickVoice() { try { const V = speechSynthesis.getVoices(); COMM.voice = V.find(v => /en-US/.test(v.lang) && /Male|David|Guy|Daniel|Alex/i.test(v.name)) || V.find(v => /^en/.test(v.lang)) || null; } catch (e) { } }
try { speechSynthesis.onvoiceschanged = pickVoice; pickVoice(); } catch (e) { }
// 말하는 동안 무전 잡음 (대역 제한 잡음 + 흔들림 + 지직거림)
function commStatic(on, dur) {
  const ctx = AU.ctx; if (!ctx || !AU.master) return;
  if (COMM.st) { try { COMM.st.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); COMM.st.s.stop(ctx.currentTime + 0.3); } catch (e) { } COMM.st = null; }
  if (!on) return;
  const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true;
  // 잡음은 말소리 대역(300~3000 Hz)을 피해 높은 쪽 '쉬' 소리로, 작게
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200; const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 7000; bp.Q.value = 0.5;
  const g = ctx.createGain(); g.gain.value = 0.0001; s.connect(hp); hp.connect(bp); bp.connect(g); g.connect(AU.master); s.start(t);
  const T = Math.min(dur || 6, 20);
  // 아주 옅은 쉬 소리만 (말소리를 가리지 않게)
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.0035, t + 0.15);
  g.gain.setValueAtTime(0.0035, t + T); g.gain.exponentialRampToValueAtTime(0.0001, t + T + 0.2); s.stop(t + T + 0.3);
  COMM.st = { s, g };
}
function squelch(open) {
  const ctx = AU.ctx; if (!ctx || !AU.master) return; const t = ctx.currentTime;
  noiseHit(t, 'bandpass', 2600, 0.8, open ? 0.035 : 0.03, open ? 0.08 : 0.12, AU.master);
  const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = open ? 1300 : 900; g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08); o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + 0.1);
}
// en: 영어 교신, ko: 한국어 자막 (한국어 화면에서만)
function comm(en, ko, from) {
  if (S.state !== 'run' && S.state !== 'result') return;
  COMM.q.push({ en, ko, from: from || 'CONTROL' }); if (COMM.q.length > 4) COMM.q.shift();
}
// 음성: 실제 발화가 끝날 때까지 다음 교신을 기다림 (글자 수 추정으로 끊기지 않게)
COMM.sp = false; COMM.spT = 0; COMM.ok = false;
function voiceUnlock() { // 첫 터치/클릭에서 음성 엔진 깨우기 (브라우저 자동재생 정책)
  if (COMM.ok || !window.speechSynthesis) return; COMM.ok = true;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); pickVoice(); } catch (e) { }
}
['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, voiceUnlock, { once: true, passive: true }));
function commSpeechDone() { COMM.sp = false; COMM.busy = Math.min(COMM.busy, 0.5); radioT = Math.min(radioT, 1.2); commStatic(false); squelch(false); if (MUS.bus && AU.ctx) musicSetLevel(); }
// 기기에 영어 음성이 없으면(예: Quest 브라우저) 내장 합성기를 별도 작업 스레드에서 돌려 소리를 만듦 (GPL 구성 요소, 이때만 불러옴)
const TTSW = { w: null, ok: null, id: 0, cb: {} };
function ttsWorker() {
  if (TTSW.w || TTSW.ok === false) return TTSW.w;
  try { const w = new Worker((window.SIM_BASE || '') + 'lib/tts-worker.js'); w.onmessage = e => { if (e.data && e.data.ready) { TTSW.ready = true; return; } const c = TTSW.cb[e.data.id]; delete TTSW.cb[e.data.id]; if (c) c(e.data); }; w.onerror = ev => { TTSW.ok = false; TTSW.w = null; COMM.fbErr = 'worker load: ' + (ev && ev.message || 'error'); }; TTSW.w = w; } catch (e) { TTSW.ok = false; COMM.fbErr = 'worker: ' + e.message; }
  return TTSW.w;
}
function needFallbackVoice() { if (window.SIM_VR || COMM.webFail) return true; try { return !speechSynthesis.getVoices().some(v => /^en/i.test(v.lang)); } catch (e) { return true; } }
function commEngine() { return needFallbackVoice() ? (TTSW.ok === false ? 'none' : 'synth') : 'web'; }
function vrVoiceTest() {
  if (AU.ctx && AU.ctx.state !== 'running') try { AU.ctx.resume(); } catch (e) { }
  const t = 'Eagle One, Control. Radio check. How copy? Over.';
  if (needFallbackVoice()) { ttsWorker(); commSpeakFallback(t, 4); } else commSpeak(t, 4);
}
setTimeout(() => { if (SET.voice !== false && needFallbackVoice()) ttsWorker(); }, window.SIM_VR ? 500 : 3000);   // 미리 불러 둠
function commSpeakFallback(text, est) {
  const myId = (COMM.cur = (COMM.cur || 0) + 1); COMM.sp = true;
  const done = () => { if (COMM.cur === myId) commSpeechDone(); };
  if (COMM.src) { try { COMM.src.stop(); } catch (e) { } COMM.src = null; }
  const w = ttsWorker(), id = ++TTSW.id;
  if (!w || !AU.ctx) { COMM.fbErr = !w ? 'worker' : 'no audio context'; setTimeout(done, est * 900); return; }
  COMM.fbState = 'synth'; TTSW.cb[id] = d => {
    if (d.err) COMM.fbErr = d.err; COMM.fbState = d.buf ? 'decode' : 'noaudio';
    if (COMM.cur !== myId || !d.buf) return done();
    AU.ctx.decodeAudioData(d.buf).then(b => {
      if (COMM.cur !== myId) return; const c = AU.ctx, s = c.createBufferSource(); s.buffer = b;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400;
      const g = c.createGain(); g.gain.value = 1.5; s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(AU.master); s.onended = done; s.start(); COMM.src = s; COMM.fbOk = true;
    }).catch(e => { COMM.fbErr = 'decode: ' + (e && e.message || e); done(); });
  };
  w.postMessage({ id, text });
  setTimeout(() => { if (COMM.cur === myId) done(); }, Math.max(10, est * 2.2) * 1000);
}
function commSpeak(text, est) {
  if (needFallbackVoice() && TTSW.ok !== false && ttsWorker()) return commSpeakFallback(text, est);
  const done = () => { if (COMM.cur === myId) commSpeechDone(); };
  const myId = (COMM.cur = (COMM.cur || 0) + 1);
  COMM.sp = true; COMM.spT = est;
  const parts = text.match(/[^.!?]+[.!?]*/g) || [text]; let i = 0, started = false;
  const next = () => {
    if (COMM.cur !== myId) return;
    if (i >= parts.length) return done();
    const t = parts[i++].trim(); if (!t) return next();
    const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'; if (COMM.voice) u.voice = COMM.voice;
    u.rate = 1.0; u.pitch = 0.9; u.volume = 1;
    u.onstart = () => { started = true; }; u.onend = next; u.onerror = (e) => { if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; if (!started && i === 1) COMM.err = (COMM.err || 0) + 1; next(); };
    (COMM.keep = COMM.keep || []).push(u); if (COMM.keep.length > 8) COMM.keep.shift(); // GC 방지
    try { speechSynthesis.speak(u); } catch (e) { next(); }
  };
  try { if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); setTimeout(next, 120); } else next(); } catch (e) { done(); }
  // 안전장치: 음성이 전혀 시작되지 않으면(차단/미지원) 자막 시간 후 해제
  setTimeout(() => { if (COMM.cur === myId && !started) { COMM.webFail = true; done(); } }, 2500);
  setTimeout(() => { if (COMM.cur === myId) done(); }, Math.max(8, est * 1.8) * 1000);
}
function commTick(dt) {
  if (!COMM.sp) COMM.busy -= dt; radioT -= dt;
  if (radioT <= 0 && !COMM.sp) { const el = $('radio'); if (el) el.classList.remove('show'); }
  if (COMM.busy > 0 || !COMM.q.length) return;
  const m = COMM.q.shift(), el = $('radio'); if (!el) return;
  el.innerHTML = `<div class="rf">📻 ${m.from}</div><div class="re">${m.en}</div>` + (window.SIM_LANG !== 'en' && m.ko ? `<div class="rk">${m.ko}</div>` : '');
  const sp = speakify(m.en), dur = Math.max(3.5, sp.length / 13);
  el.classList.add('show'); radioT = dur + 1; COMM.busy = dur + 0.6;
  squelch(true); commStatic(true, dur + 0.4);
  if (SET.voice !== false && window.speechSynthesis) {
    if (MUS.bus && AU.ctx) MUS.bus.gain.setTargetAtTime(musicLevel() * 0.25, AU.ctx.currentTime, 0.1);
    COMM.busy = 999; radioT = 999; commSpeak(sp, dur);
  } else setTimeout(() => squelch(false), dur * 900);
}
// 임무 시작 교신
function commStart(kind) {
  const w = WIND.lv ? `Winds ${WIND.lv === 1 ? 'three' : 'seven'} meters per second from west-northwest. ` : '';
  const n = ENV.night ? 'Night ops, keep your strobes on. ' : '';
  const T = {
    forest: [`${CS}, CONTROL. Cleared for launch. Proceed into the forest trail, stay low under the canopy. ${w}Over.`, '이륙 허가. 숲길로 진입, 수관 아래로 낮게.'],
    race: [`${CS}, CONTROL. Range is hot. Rings are set along the valley. Go when ready. ${w}`, '코스 준비 완료. 계곡 링 따라 출발.'],
    recon: [`${CS}, CONTROL. Four structures tasked for imagery. First target, grid ${MS.list[0] ? grid(MS.list[0].d, MS.list[0].s) : '—'}. ${n}Over.`, '건물 4곳 촬영 임무. 첫 대상 좌표 전달.'],
    strike: [`${CS}, CONTROL. Five vehicles in the valley, two are decoys. Positive ID by thermal before you commit. Cleared hot.`, '차량 5대 중 2대 기만체. 열화상으로 식별 후 돌입. 공격 허가.'],
    fire: [`${CS}, CONTROL. Fire watch requested. Three hotspots reported, report grids as you find them. ${w}Over.`, '산불 감시 요청. 불씨 3곳, 찾는 대로 좌표 보고.'],
    sar: [`${CS}, CONTROL. Missing hiker, last seen near the trail. Search the marked area, use thermal under the trees. ${n}Over.`, '실종자 수색. 표시 구역, 나무 아래는 열화상.'],
    track: [`${CS}, CONTROL. Target vehicle on the forest road. Close in, then maintain standoff and keep eyes on for sixty seconds.`, '도로의 표적 차량 추적. 접근 후 거리 유지, 60초 관측.'],
    ridge: [`${CS}, CONTROL. Ridge run approved. Expect gusts on the crest. ${w}`, '능선 비행 승인. 능선 위 돌풍 주의.']
  }[kind];
  if (T) comm(T[0], T[1]);
}
let COMM_LAST = 0;
function commAck(o, kind) {   // 목표 하나 끝났을 때
  const left = MS.list.filter(x => !x.done).length;
  if (kind === 'recon') return comm(`Copy imagery. ${left ? `Next structure, grid ${(() => { const x = MS.list.find(y => !y.done); return x ? grid(x.d, x.s) : '—'; })()}.` : 'All imagery received.'}`, left ? '촬영 확인. 다음 대상 좌표 전달.' : '촬영 모두 수신.');
  if (kind === 'fire') return comm(`Copy hotspot, grid ${grid(o.d, o.s)}. Fire crews dispatched.${left ? '' : ' All reported.'}`, `불씨 좌표 접수, 진화대 출동.${left ? '' : ' 모두 보고됨.'}`);
  if (kind === 'sar' && o.t === 'sarfind') return comm(`Copy, subject located at grid ${grid(SAR.d, SAR.s)}. ${AFc().drop ? 'Drop the rescue kit within five meters.' : 'Return to base.'}`, `실종자 위치 확인. ${AFc().drop ? '구조 키트 5 m 이내 투하.' : '복귀.'}`);
  if (kind === 'sar' && o.t === 'sarkit') return comm('Good drop, kit on the ground. Ground team is en route. RTB.', '키트 전달 확인. 구조대 이동 중. 복귀.');
  if (kind === 'forest' || kind === 'race' || kind === 'ridge') {
    const done = MS.list.length - left, half = Math.floor(MS.list.length / 2);
    if (o.label && /정상|Summit/.test(o.label)) return comm(`Summit reached. Nice work, ${CS}. Head down the far ridge.`, '정상 도착. 반대편 능선으로 하강.');
    if (done === half) return comm(`Halfway. ${S.pen ? 'Watch your clearances.' : 'Looking clean, keep it up.'}`, `절반 통과. ${S.pen ? '간격 주의.' : '깔끔함, 계속.'}`);
    if (left === 1) return comm('Final gate ahead. Bring it home.', '마지막 통과점. 마무리.');
  }
}

// =====================================================================
//  화면 배치 편집 (창 위치·크기·숨기기). 기기 종류별(터치/PC)로 따로 저장
// =====================================================================
const LY_ITEMS = [
  ['osd', '비행 정보', 'Flight data'], ['obj', '다음 과제', 'Next task'], ['list', '과제 목록', 'Task list'], ['map', '지도', 'Map'], ['belly', '아래 카메라', 'Belly cam'],
  ['radio', '무전', 'Radio'], ['guide', '안내 문구', 'Guide'], ['bottom', '상태 표시', 'Status'], ['scope', '투하 조준', 'Drop scope'],
  ['tbBoost', 'BST', 'BST'], ['tbDrop', 'DROP', 'DROP'], ['tbCam', 'CAM', 'CAM'], ['tbReset', '⟲', '⟲'], ['tbBelly', '↓CAM', '↓CAM'], ['tbIR', 'IR', 'IR'], ['tbAssist', 'AST', 'AST'], ['tbZoom', 'ZM', 'ZM'], ['tbGuide', 'GD', 'GD'], ['tbFull', '⛶', '⛶'], ['tbPause', '❚❚', '❚❚']
];
const LY = { key: 'hroc_layout_' + (IS_TOUCH ? 'touch' : 'desk'), d: {}, edit: false, sel: null };
try { LY.d = JSON.parse(localStorage.getItem(LY.key) || '{}'); } catch (e) { }
// 버튼 기본 배치가 바뀌었으니 예전에 저장한 버튼 위치는 한 번 지움 (다른 창 위치는 유지)
if (!LY.d.__v3) { for (const k of Object.keys(LY.d)) if (/^tb/.test(k)) delete LY.d[k]; LY.d.__v3 = 1; try { localStorage.setItem(LY.key, JSON.stringify(LY.d)); } catch (e) { } }
// 휴대폰 기본 배치 (사용자가 정해 준 배치 기준). x,y = 왼쪽 위 / cx,cy = 가운데 (화면 비율)
LY.def = IS_TOUCH ? {
  osd: { x: 0.045, y: 0.016 }, obj: { x: 0.257, y: 0.016 }, bottom: { x: 0.262, y: 0.112, s: 0.55 }, map: { x: 0.046, y: 0.327 }, belly: { x: 0.046, y: 0.679 }, scope: { x: 0.194, y: 0.699 }, radio: { x: 0.335, y: 0.789 },
  // 버튼: 오른쪽 위 한 줄 (간격 54 px, 오른쪽 끝 기준) + 그 아래 BST·DROP 가운데 높이 맞춤
  // 4개씩 두 줄, 오른쪽 끝 정렬: [GD AST ⛶ ❚❚] / [IR CAM ↓CAM ZM], 그 아래 BST·DROP 가운데 높이 맞춤
  tbGuide: { r: 174, t: 10 }, tbAssist: { r: 120, t: 10 }, tbFull: { r: 66, t: 10 }, tbPause: { r: 12, t: 10 },
  tbIR: { r: 174, t: 64 }, tbCam: { r: 120, t: 64 }, tbBelly: { r: 66, t: 64 }, tbZoom: { r: 12, t: 64 },
  tbDrop: { r: 12, t: 122 }, tbBoost: { r: 102, t: 132 }, tbReset: { r: 172, t: 138, h: true }
} : {};
function lySave() { try { localStorage.setItem(LY.key, JSON.stringify(LY.d)); } catch (e) { } }
function lyApply() {
  for (const [id] of LY_ITEMS) {
    const el = $(id); if (!el) continue; const c = LY.d[id] || LY.def[id];
    if (!c) { el.style.left = el.style.top = el.style.right = el.style.bottom = el.style.transform = el.style.transformOrigin = ''; el.classList.remove('lyHide'); continue; }
    const cs = getComputedStyle(el), s = c.s || 1, W = innerWidth, H = innerHeight, w = (el.offsetWidth || parseFloat(cs.width) || 46) * s, h = (el.offsetHeight || parseFloat(cs.height) || 46) * s;   // 숨겨진 동안엔 CSS 크기로
    if (id === 'obj') el.style.textAlign = 'left';   // 옮긴 경우 왼쪽 정렬 (가운데 정렬이면 상자가 밀림)
    let L = null, T = null;   // 화면 기준 위치
    if (c.r !== undefined) { L = W - c.r - w; T = c.t; }
    else if (c.cx !== undefined) { L = c.cx * W - w / 2; T = c.cy * H - h / 2; }
    else if (c.x !== undefined) { L = c.x * W; T = c.y * H; }
    if (L !== null) {
      L = clamp(L, 0, Math.max(0, W - w)); T = clamp(T, 0, Math.max(0, H - h));
      const op = el.offsetParent, pr = op ? op.getBoundingClientRect() : { left: 0, top: 0 };   // 부모 상자 기준으로 바꿈
      el.style.left = Math.round(L - pr.left) + 'px'; el.style.top = Math.round(T - pr.top) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
    }
    el.style.transformOrigin = 'top left'; el.style.transform = L !== null || c.s ? `scale(${s})` : '';
    el.classList.toggle('lyHide', !!c.h);
  }
}
addEventListener('resize', () => setTimeout(lyApply, 50));
function lyName(id) { const it = LY_ITEMS.find(x => x[0] === id); return it ? (window.SIM_LANG === 'en' ? it[2] : it[1]) : id; }
function lyBar() {
  const b = $('lyBar'), sel = LY.sel, c = sel ? (LY.d[sel] || LY.def[sel] || {}) : null;
  b.innerHTML = `<span class="ln">${sel ? lyName(sel) : L2('창을 끌어서 옮기기 · 눌러서 고르기', 'Drag to move · tap to select')}</span>` +
    (sel ? `<button data-a="m">−</button><span class="sz">${Math.round((c.s || 1) * 100)}%</span><button data-a="p">+</button><button data-a="h">${c.h ? L2('보이기', 'Show') : L2('숨기기', 'Hide')}</button><button data-a="r1">${L2('이 창 원래대로', 'Reset item')}</button>` : '') +
    `<button data-a="ra">${L2('전체 초기화', 'Reset all')}</button><button class="primary" data-a="ok">${L2('완료', 'Done')}</button>`;
  b.querySelectorAll('button').forEach(x => x.onclick = e => { e.stopPropagation(); const a = x.dataset.a, d = sel && (LY.d[sel] = LY.d[sel] || Object.assign({}, LY.def[sel] || {}));
    if (a === 'm') d.s = Math.max(0.5, Math.round(((d.s || 1) - 0.1) * 10) / 10); if (a === 'p') d.s = Math.min(1.8, Math.round(((d.s || 1) + 0.1) * 10) / 10);
    if (a === 'h') d.h = !d.h; if (a === 'r1') delete LY.d[sel]; if (a === 'ra') { LY.d = { __v3: 1 }; LY.sel = null; }
    if (a === 'ok') return lyEdit(false);
    lySave(); lyApply(); lyBar(); });
}
function lyEdit(on) {
  LY.edit = on; document.body.classList.toggle('lyEditing', on); $('lyBar').classList.toggle('hidden', !on);
  const r = $('radio'); if (on && r && !r.classList.contains('show')) { r.innerHTML = '<div class="rf">📻 CONTROL</div><div class="re">EAGLE ONE, CONTROL. Radio check. Over.</div>'; r.classList.add('show'); radioT = 1e9; } else if (!on && r) { radioT = 0; }
  if (on) { ui.pause.classList.add('hidden'); ui.hud.classList.remove('hidden'); LY.sel = null; lyBar(); }
  else { lySave(); if (S.state === 'pause') ui.pause.classList.remove('hidden'); }
}
// 끌기
(function () {
  let drag = null;
  addEventListener('pointerdown', e => {
    if (!LY.edit || (e.target.closest && e.target.closest('#lyBar'))) return;
    // 손가락 아래에 있는 창 (맨 위 것부터) — 터치 조작 영역이 위에 덮여 있어도 찾음
    let el = null; for (let i = LY_ITEMS.length - 1; i >= 0 && !el; i--) { const c = $(LY_ITEMS[i][0]); if (!c) continue; const r = c.getBoundingClientRect(); if (r.width > 2 && r.height > 2 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom && getComputedStyle(c).display !== 'none') el = c; }
    if (!el) return;
    e.preventDefault(); e.stopPropagation(); const r = el.getBoundingClientRect(); drag = { el, id: el.id, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false }; LY.sel = el.id; lyBar();
  }, true);
  addEventListener('pointermove', e => {
    if (!drag) return; e.preventDefault(); drag.moved = true; const d = LY.d[drag.id] = LY.d[drag.id] || Object.assign({}, LY.def[drag.id] || {});
    delete d.cx; delete d.cy; delete d.r; delete d.t; d.x = (e.clientX - drag.dx) / innerWidth; d.y = (e.clientY - drag.dy) / innerHeight; lyApply();
  }, true);
  addEventListener('pointerup', () => { if (drag) { lySave(); drag = null; } }, true);
})();
$('bLayout').onclick = () => lyEdit(true);
lyApply();

// ---------------- 데이터 출처 ----------------
const EN_ = window.SIM_LANG === 'en';
const CRED_AF = [
  ['Skydio X2D', 'Skydio X2D Color/Thermal 데이터시트 (크기 66×56×20 cm, 1.3 kg, 50 km/h, 35분)', 'Skydio X2D Color/Thermal datasheet (66×56×20 cm, 1.3 kg, 50 km/h, 35 min)'],
  ['Parrot ANAFI USA', 'Parrot ANAFI USA 백서 (0.5 kg, 14.7 m/s, 상승·하강 4 m/s, 32분)', 'Parrot ANAFI USA white paper (0.5 kg, 14.7 m/s, 4 m/s climb/descent, 32 min)'],
  ['RQ-11B Raven · RQ-20B Puma', '미 해군 Group 1 소형 무인기 제원표 · 미 공군 RQ-11B 제원표', 'U.S. Navy Group 1 sUAS fact file · U.S. Air Force RQ-11B fact sheet'],
  ['FPV · 자폭 FPV · 자폭 고정익', '특정 제품이 아닌 일반적인 성능 범위로 잡은 가상 기체', 'Generic airframes with typical performance ranges (not a specific product)']
];
function credHTML() {
  const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  let h = '<h3>' + (EN_ ? 'Training site · ' : '훈련장 · ') + stName(SITE) + '</h3><table>';
  if (SITE.credits) h += SITE.credits.map(c => row(EN_ ? c[2] : c[0], EN_ ? c[3] : c[1])).join('');
  else h += row(EN_ ? 'Terrain' : '지형', SITE.flat ? (EN_ ? 'Flat ground (no terrain data)' : '평지 (지형 데이터 없음)') : (stSrc(SITE) || '-'));
  h += row(EN_ ? 'Course' : '코스', SITE.flat ? (EN_ ? 'Standard obstacle course layout' : '기본 장애물 코스 배치') : (EN_ ? 'Obstacles laid along a user-specified route' : '사용자가 지정한 경로를 따라 장애물 배치'));
  h += '</table><h3>' + (EN_ ? 'Airframe specs' : '기체 제원') + '</h3><table>' + CRED_AF.map(c => row(c[0], EN_ ? c[2] : c[1])).join('') + '</table>';
  h += '<h3>' + (EN_ ? 'Software' : '소프트웨어') + '</h3><table>' + row('three.js r149', 'MIT') + row('geotiff.js 2.1', 'MIT') + row('proj4js 2.11', 'MIT') + '</table>';
  h += `<div class="note">${EN_ ? 'Speeds, sizes and handling approximate public specifications. Map data: National Geographic Information Institute (NGII), Korea.' : '속도·크기·조종 특성은 공개 제원 수준의 근사값입니다. 지도 자료 출처: 국토교통부 국토지리정보원.'}</div>`;
  return h;
}
$('bCred').onclick = () => { $('credBody').innerHTML = credHTML(); $('credPanel').classList.remove('hidden'); };
$('credClose').onclick = () => $('credPanel').classList.add('hidden');
// 화면 아래 작은 출처 (현장 자료가 있을 때)
(function () { const el = $('attrib'); if (!el) return; el.textContent = SITE.credits ? (EN_ ? 'Map data © NGII Korea · 1:5,000 topo map · orthoimage 2025 · Copernicus DEM GLO-30' : '지도 자료 © 국토지리정보원 · 수치지형도 1:5,000 · 정사영상 2025 · Copernicus DEM GLO-30') : ''; })();

document.querySelectorAll('#segVoice button').forEach(b => { b.classList.toggle('on', (b.dataset.v === '1') === (SET.voice !== false)); b.addEventListener('click', () => { SET.voice = b.dataset.v === '1'; saveSet(); document.querySelectorAll('#segVoice button').forEach(x => x.classList.toggle('on', x === b)); if (!SET.voice) try { speechSynthesis.cancel(); } catch (e) { } }); });

// =====================================================================
//  시작 화면: 격납고(기체 회전 미리 보기) · 임무 트리맵 · 임무 현장 미리 보기
// =====================================================================
const MENU = { ms: 'course', cf: null, cR: 60, cH: 20, a: 0, ri: 0, tt: 0, models: {}, dbl: 0 };
try { const v = localStorage.getItem('hroc_menu_ms'); if (v) MENU.ms = v; } catch (e) { }
const MS_CAT = { course: 'train', forest: 'train', race: 'train', ridge: 'train', tutorial: 'train', free: 'train', demo: 'train', recon: 'recon', track: 'recon', fire: 'rescue', sar: 'rescue', strike: 'strike' };
const CAT_C = { train: '#4fe3ff', recon: '#5dff9a', rescue: '#ffaa4d', strike: '#ff5d5d' };
const AF_C = { quad: '#5aa9ff', fpv: '#b48cff', wing: '#4fe3c0', kam: '#ff6a5d' };
const CAT_N = () => ({ train: L2('비행 훈련', 'FLIGHT TRAINING'), recon: L2('정찰·감시', 'RECON · SURVEILLANCE'), rescue: L2('재난·구조', 'DISASTER · RESCUE'), strike: L2('타격', 'STRIKE') });
const MDESC = () => ({
  course: [L2('장애물 코스', 'Obstacle course'), L2('게이트 · 슬라롬 · 벙커 · 정찰 · 투하 · 정밀 착륙까지 이어지는 기본 훈련 코스.', 'The core course: gates, slalom, bunker, recon, payload drops and a precision landing.'), L2('입문 난이도와 가이드로 익힌 뒤 스포츠에서 기록 단축.', 'Learn it on Training with the guide on, then chase your time on Sport.')],
  tutorial: [L2('튜토리얼', 'Tutorial'), L2('장애물 하나씩 설명을 보고 연습. 처음이라면 여기부터.', 'Practice one obstacle at a time with explanations. Start here if you are new.'), L2('정찰 쿼드(X2D)로만 진행.', 'Flown with the recon quad (X2D) only.')],
  free: [L2('자유 비행', 'Free flight'), L2('시간·목표 없이 지형과 기체를 익히는 비행.', 'No timer, no objectives: get to know the terrain and the airframe.'), L2('모든 기체 사용 가능. 열화상(T)·밤·바람도 시험해 보기.', 'Every airframe allowed. Try thermal (T), night and wind.')],
  demo: [L2('기준 비행 보기', 'Reference flight'), L2('장애물 코스를 모범 비행으로 자동 재생.', 'Watch an automatic reference run through the obstacle course.'), L2('경로와 고도를 눈에 익혀 두기.', 'Memorize the line and the altitudes.')]
});
function msInfo(k) { const b = BRIEF[k] || MDESC()[k] || [k, '', '']; return { t: b[0], d: b[1], tip: b[2] }; }
function msAvail(k) {
  const HAS = { forest: !!FLANE, race: RACE.length > 0, recon: RECON.length > 0, strike: STRIKE.length > 0, fire: FIRE.length > 0, sar: !!SAR, track: !!TRACK, ridge: !!RIDGE };
  const site = HAS[k] !== false, af = (MS_OK[k] || []).includes(SET.af);
  return { ok: site && af, site, af, why: !site ? L2('이 훈련장에는 없는 임무', 'Not available at this site') : !af ? L2('선택한 기체로는 할 수 없는 임무 · 아래 추천 기체를 고르세요', 'Not possible with this airframe · pick a recommended one below') : '' };
}
function afCat(a) { return a.kam ? 'kam' : a.cls === 'wing' ? 'wing' : a.id === 'fpv' ? 'fpv' : 'quad'; }
// RPG 식 능력치 (공개 제원 근사값을 0~1 로)
function afStats(a) {
  const e = typeof a.endur === 'string' ? parseFloat(a.endur.split('~').pop()) : a.endur, top = a.top * 3.6;
  const agi = a.cls === 'wing' ? a.rrate / 230 : clamp(a.yaw / 330 * 0.5 + a.tw / 3.6 * 0.5, 0, 1);
  const stb = a.cls === 'wing' ? clamp(0.4 + a.span * 0.17, 0, 1) : clamp(1 - (a.tilt.sport - 38) / 55, 0.2, 1);
  return [
    [L2('속도', 'SPD'), top / 160, Math.round(top) + ' km/h'],
    [L2('체공', 'END'), Math.log(e) / Math.log(210), (typeof a.endur === 'string' ? a.endur : e) + L2('분', ' min')],
    [L2('기동', 'AGI'), agi, a.cls === 'wing' ? L2('선회', 'bank ') + a.bank + '°' : a.yaw + '°/s'],
    [L2('안정', 'STB'), stb, a.cls === 'wing' ? L2('실속 ', 'stall ') + Math.round(a.stall * 3.6) : L2('기울기 ', 'tilt ') + a.tilt.sport + '°'],
    [L2('센서', 'SNS'), (a.reconD || 260) / 600, (a.reconD || 260) + ' m']
  ];
}
function afTags(a) {
  const t = [];
  if (a.cls === 'wing') t.push(L2('정지 불가', 'No hover')); else t.push(L2('정지 비행', 'Hover'));
  if (a.drop) t.push(L2('투하 장치', 'Payload drop'));
  if (a.acro) t.push('Acro');
  if (a.id === 'anafi') t.push(L2('32배 줌', '32× zoom'));
  if (a.id === 'puma' || a.id === 'fw') t.push(L2('손 투척', 'Hand launch'));
  if (a.kam) t.push(L2('탄두 · 1회용', 'Warhead · expendable'));
  return t;
}
function menuAfPanel() {
  const a = AFc(), cat = afCat(a), col = AF_C[cat];
  const catN = { quad: L2('정찰 쿼드', 'RECON QUAD'), fpv: 'FPV', wing: L2('고정익', 'FIXED-WING'), kam: L2('자폭', 'LOITERING') }[cat];
  const w = document.querySelector('.afStageW'); if (w) w.style.setProperty('--cc', col);
  const inf = $('afInfo'); if (inf) inf.innerHTML = `<i class="cat">${catN}</i><b>${a.name}</b><small>${a.sub}</small><div class="tags">${afTags(a).map(x => `<span>${x}</span>`).join('')}</div>`;
  const st = $('afStats'); if (st) { st.style.setProperty('--cc', col); st.innerHTML = afStats(a).map(r => `<span class="k">${r[0]}</span><span class="sbar"><i style="width:${Math.round(clamp(r[1], 0.04, 1) * 100)}%"></i></span><span class="v">${r[2]}</span>`).join('') + `<span class="note2">${a.note}</span>`; }
}
function menuBest(k) {
  let key = k === 'course' ? 'hroc_fpv_best_' + SET.diff + SITE_KEY : isMission(k) ? 'hroc_ms_best_' + k + '_' + SET.af + '_' + SET.diff + SITE_KEY : null, b = null;
  if (key) try { b = parseFloat(localStorage.getItem(key)); } catch (e) { }
  return b > 0 ? b : null;
}
function menuDetail() {
  const k = MENU.ms, cat = MS_CAT[k] || 'train', inf = msInfo(k), av = msAvail(k), col = CAT_C[cat];
  document.querySelectorAll('#msGrid [data-ms]').forEach(b => b.classList.toggle('sel', b.dataset.ms === k));
  const box = $('msDetail'); if (!box) return; box.style.setProperty('--cc', col);
  document.querySelector('.msStageW').style.setProperty('--cc', col);
  $('mdCat').textContent = CAT_N()[cat]; $('mdTitle').textContent = inf.t; $('mdDesc').textContent = inf.d; $('mdTip').textContent = inf.tip;
  const ok = MS_OK[k] || [];
  $('mdAf').innerHTML = (ok.length === AF_IDS.length ? '' : ok.map(id => `<button data-af="${id}" class="${id === SET.af ? 'on' : ''}">${AF[id].name}</button>`).join(''));
  $('mdAf').querySelectorAll('button').forEach(b => b.onclick = () => { MENU.afNote = ''; setAirframe(b.dataset.af); afUI(); });
  const best = menuBest(k), meta = [];
  if (isMission(k)) meta.push(L2('기준 ', 'Par ') + fmt(msPar(k, [1, 2, 3, 4])));
  if (best) meta.push(L2('내 최고 ', 'Best ') + `<b>${fmt(best)}</b>`);
  meta.push(AFc().name + ' · ' + { train: L2('입문', 'Training'), easy: L2('쉬움', 'Easy'), sport: L2('스포츠', 'Sport') }[SET.diff]);
  $('mdMeta').innerHTML = meta.join(' · ');
  $('msGo').disabled = !av.ok; $('msGo').textContent = k === 'tutorial' ? L2('단계 고르기 ▶', 'Choose a step ▶') : k === 'demo' ? L2('재생 ▶', 'Play ▶') : L2('출격 ▶', 'Launch ▶');
  $('mdWhy').textContent = av.why || MENU.afNote || '';
  if (typeof vrBtnUpdate === 'function' && VR_OK) vrBtnUpdate();
  const no = $('msStageNo'); if (no) { no.classList.toggle('on', !av.site); no.textContent = av.site ? '' : L2('이 훈련장에는 없는 임무입니다', 'This mission is not available at this site'); }
  menuShow(k);
}
// 임무 종류 탭: 고른 종류의 임무만 보여 줌 (이 훈련장에 없는 임무는 숨김)
const MS_GRP = ['basic', 'skill', 'mission'];
function msTile(k) { return document.querySelector(`#msGrid [data-ms="${k}"]`); }
function msVis() {
  const g = MENU.g || 'basic';
  document.querySelectorAll('#msTabs [data-g]').forEach(b => b.classList.toggle('on', b.dataset.g === g));
  document.querySelectorAll('#msGrid [data-ms]').forEach(b => b.classList.toggle('hid', b.dataset.g !== g || b.dataset.site === '0'));
}
function msInGrp(g) { return [...document.querySelectorAll(`#msGrid [data-g="${g}"]`)].filter(b => b.dataset.site !== '0').map(b => b.dataset.ms); }
function menuTab(g) {
  const L = msInGrp(g); if (!L.length) return;
  const last = (MENU.lastIn || {})[g]; menuSel(L.includes(last) ? last : L[0]);
}
function menuSel(k, go) {
  const t = msTile(k); if (!t || t.dataset.site === '0') k = 'course';
  MENU.ms = k; MENU.g = msTile(k).dataset.g; (MENU.lastIn = MENU.lastIn || {})[MENU.g] = k;
  try { localStorage.setItem('hroc_menu_ms', k); } catch (e) { }
  // 고른 기체로 못 하는 임무면 알맞은 기체로 바꿔 줌
  const ok = MS_OK[k] || [];
  if (ok.length && !ok.includes(SET.af)) { const prev = AFc().name; MENU.afNote = L2(`${prev} 로는 할 수 없어 ${AF[ok[0]].name} 로 바꿨습니다`, `Switched from ${prev} to ${AF[ok[0]].name} for this mission`); setAirframe(ok[0]); afUI(); }
  else if (k !== MENU.prevMs) MENU.afNote = '';
  MENU.prevMs = k; msVis(); menuDetail(); if (go) menuGo();
}
document.querySelectorAll('#msTabs [data-g]').forEach(b => b.addEventListener('click', () => menuTab(b.dataset.g)));
function menuGo() {
  const k = MENU.ms; if (!msAvail(k).ok) return;
  if (k === 'tutorial') openTutMenu(); else startRun(k);
}
document.querySelectorAll('#msGrid [data-ms]').forEach(b => {
  b.addEventListener('click', () => { const now = performance.now(), again = MENU.ms === b.dataset.ms && now - MENU.dbl < 450; MENU.dbl = now; if (again) menuGo(); else menuSel(b.dataset.ms); });
});
$('msGo').onclick = menuGo;
// ---- 임무 현장 미리 보기 (메뉴 뒤 카메라) ----
function menuShow(k) {
  Object.values(MSG).forEach(g => g.visible = false);
  const a = AFc(), kw = a.cls === 'wing' ? 2.2 : 1;
  if (k === 'race' && RACE.length) { MSG.race.visible = true; RACE.forEach(r => { r.mesh.scale.setScalar(3.2 * kw); r.mesh.position.copy(W(r.q.d, r.q.s, a.cls === 'wing' ? r.alt * 0.8 + 30 : r.alt)); }); }
  if (k === 'ridge' && RIDGE) { MSG.ridge.visible = true; RIDGE.list.forEach(r => { const c = W(r.q.d, r.q.s, a.cls === 'wing' ? 38 : 15); r.mesh.position.copy(c); r.mesh.scale.setScalar(4 * kw); r.mesh.lookAt(c.clone().add(r.n)); }); }
  if (k === 'fire' && FIRE.length) { MSG.fire.visible = true; FIRE.forEach((f, i) => { f.on = f.active = i < 3; f.g.visible = i < 3; f.g.scale.setScalar(1); }); }
  if (k === 'sar' && SAR) MSG.sar.visible = true;
  if (k === 'track' && TRACK) { MSG.track.visible = true; if (!(TRACK.s > 0)) TRACK.s = TRACK.total * 0.2; }
  if (k === 'strike' && STRIKE.length) { MSG.strike.visible = true; STRIKE.forEach(t => { t.dead = false; if (t.hull.userData.m0) t.hull.material = t.hull.userData.m0; t.g.visible = true; }); }
}
function menuPrev(k) {
  const pd = CRS_C ? BY.pad_start.down : 60, ps = CRS_C ? BY.pad_start.side : 0, T = !!TER.h;
  const P = (d, s, y, R, h, spd) => ({ f: W(d, s, y), d, s, R, h, spd: spd || 0.06 });
  if (k === 'forest' && FLANE) { const q = FLANE.at(FLANE.total * 0.2); return P(q.d, q.s, 3, 16, 9, 0.05); }
  if (k === 'race' && RACE.length) { const r = RACE[4]; return P(r.q.d, r.q.s, r.alt, 34, 8); }
  if (k === 'ridge' && RIDGE) { const t = RIDGE.list.find(c => c.top) || RIDGE.list[0]; return P(t.q.d, t.q.s, 15, 80, 30, 0.035); }
  if (k === 'recon' && RECON.length) { const r = RECON[MENU.ri % RECON.length]; return P(r.d, r.s, 6, 60, 34, 0.05); }
  if (k === 'fire' && FIRE.length) { const f = FIRE[0]; return P(f.d, f.s, 5, 50, 26, 0.05); }
  if (k === 'sar' && SAR) return P(SAR.d, SAR.s, 1, 20, 26, 0.07);
  if (k === 'strike' && STRIKE.length && PATHL) { const q = PATHL.at(235); return P(q.d, q.s, 2, 30, 22, 0.05); }
  if (k === 'track' && TRACK) return { f: TRACK.g.position.clone().add(new V3(0, 1, 0)), R: 34, h: 26, spd: 0.08, dyn: true };
  if (k === 'tutorial') return P(pd, ps, 1, 13, 5, 0.08);
  if (k === 'free') return P(pd, ps, 0, T ? 170 : 70, T ? 75 : 30, 0.025);
  return P(pd, ps, 0, T ? 48 : 38, T ? 24 : 16, k === 'demo' ? 0.09 : 0.05);
}
function menuCam(dt) {
  const pv = menuPrev(MENU.ms);
  if (MENU.ms === 'track' && TRACK && MSG.track.visible) {
    TRACK.s = (TRACK.s + 9 * dt) % Math.max(1, TRACK.total - 5); const vp = trackPose(TRACK.s); TRACK.g.position.copy(vp.p); TRACK.g.rotation.y = -vp.h;
    pv.f.copy(vp.p).add(new V3(0, 1, 0));
  }
  const k = 1 - Math.exp(-dt * 3.5);
  if (!MENU.cf) { MENU.cf = pv.f.clone(); MENU.cR = pv.R; MENU.cH = pv.h; }
  MENU.cf.lerp(pv.f, pv.dyn ? 1 - Math.exp(-dt * 8) : k); MENU.cR += (pv.R - MENU.cR) * k; MENU.cH += (pv.h - MENU.cH) * k;
  MENU.a += dt * pv.spd; MENU.tt += dt;
  if (MENU.ms === 'recon' && MENU.tt > 9) { MENU.tt = 0; MENU.ri++; }
  const c = MENU.cf, x = c.x + Math.sin(MENU.a) * MENU.cR, z = c.z + Math.cos(MENU.a) * MENU.cR;
  camera.position.set(x, Math.max(c.y + MENU.cH, terrainAt(x, z) + (SITE.trees && MENU.ms !== 'forest' ? 20 : 6)), z); camera.up.set(0, 1, 0); camera.lookAt(c.x, c.y + 1, c.z);
  camera.fov = 55; camera.updateProjectionMatrix();
  const tag = $('msStageTag');
  if (tag && (MENU._tagT = (MENU._tagT || 0) - dt) <= 0) { MENU._tagT = 0.5; let g = ''; if (pv.d !== undefined && !SITE.flat) try { g = grid(pv.d, pv.s); } catch (e) { } tag.innerHTML = `<b>●</b> LIVE · ${stName(SITE)}${g ? ' · ' + g : ''}`; }
}
function menuFocus() { return MENU.cf || (CRS_C ? W(BY.pad_start.down, BY.pad_start.side, 0) : W(60, 0, 0)); }
// ---- 격납고 회전 무대 (같은 렌더러로 그려 2D 캔버스에 복사) ----
const HG = (function () {
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 4 / 3, 0.05, 100);
  sc.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a1e22, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); sc.add(key);
  const rim = new THREE.DirectionalLight(0x7fc8ff, 1.1); rim.position.set(-4, 2, -5); sc.add(rim);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x0f161b, transparent: true, opacity: 0.85 })); pad.rotation.x = -Math.PI / 2; sc.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.7 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; sc.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.61, 64), new THREE.MeshBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.35 })); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.002; sc.add(ring2);
  return { sc, cam, pad, ring, ring2, cur: null, id: null, sz: 1, a: 0.6 };
})();
function hgModel() {
  const id = SET.af; if (HG.id === id) return;
  if (HG.cur) HG.sc.remove(HG.cur);
  if (!MENU.models[id]) { const m = makeModel(id, false), g = m.g; g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); MENU.models[id] = g; }
  const g = MENU.models[id]; g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g), s = bb.getSize(new V3()), c = bb.getCenter(new V3());
  const r = Math.max(s.x, s.z, s.y * 1.6) * 0.5;
  HG.sz = r; HG.lift = -bb.min.y + r * 0.12; HG.cx = c.x; HG.cz = c.z;
  HG.pad.scale.setScalar(r * 1.05); HG.ring.scale.setScalar(r * 1.05); HG.ring2.scale.setScalar(r * 1.05);
  const col = new THREE.Color(AF_C[afCat(AFc())]); HG.ring.material.color.copy(col); HG.ring2.material.color.copy(col);
  HG.sc.add(g); HG.cur = g; HG.id = id;
}
const _hv = new THREE.Vector2();
function menuStage(cv) { const r = cv.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return null; const dpr = renderer.getPixelRatio(), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return { w, h, cw: r.width, ch: r.height }; }
function menuRenderPre(dt) {
  const cv = $('afStage'); if (!cv || ui.menu.classList.contains('hidden')) return;
  const st = menuStage(cv); if (!st) return;
  hgModel(); renderer.getSize(_hv);
  const cw = Math.min(st.cw, _hv.x), ch = Math.min(st.ch, _hv.y);
  HG.a += (dt || 0.016) * 0.45; const g = HG.cur; g.rotation.y = HG.a; g.position.set(-HG.cx, HG.lift + Math.sin(HG.a * 2.2) * HG.sz * 0.03, -HG.cz);
  if (g.userData.props) g.userData.props.forEach(p => p.rotation.y += 0.6);
  HG.cam.aspect = cw / ch; HG.cam.position.set(0, HG.sz * 1.05, HG.sz * 2.9); HG.cam.lookAt(0, HG.sz * 0.3, 0); HG.cam.updateProjectionMatrix();
  renderer.setViewport(0, 0, cw, ch); renderer.setScissor(0, 0, cw, ch); renderer.setScissorTest(true);
  renderer.setClearColor(0x0b1116, 1); renderer.clear(); renderer.render(HG.sc, HG.cam);
  const x2 = cv.getContext('2d'), dpr = renderer.getPixelRatio(), H = renderer.domElement.height;
  x2.clearRect(0, 0, st.w, st.h); x2.drawImage(renderer.domElement, 0, H - ch * dpr, cw * dpr, ch * dpr, 0, 0, st.w, st.h);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, _hv.x, _hv.y); renderer.setClearColor(0x000000, 1);
}
function menuRenderPost() {
  const cv = $('msStage'); if (!cv || ui.menu.classList.contains('hidden')) return;
  const st = menuStage(cv); if (!st) return;
  const src = renderer.domElement, W0 = src.width, H0 = src.height, ar = st.w / st.h;
  let sw = W0, sh = W0 / ar; if (sh > H0) { sh = H0; sw = H0 * ar; }
  const x2 = cv.getContext('2d'); x2.drawImage(src, (W0 - sw) / 2, (H0 - sh) / 2, sw, sh, 0, 0, st.w, st.h);
}
document.addEventListener('keydown', e => {
  if (S.state !== 'menu' || ui.menu.classList.contains('hidden') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) return;
  if (['setPanel', 'recPanel', 'helpPanel', 'tutMenu', 'kbPanel', 'credPanel'].some(p => $(p) && !$(p).classList.contains('hidden'))) return;
  // 좌우: 같은 종류 안에서 · 위아래: 종류 바꾸기
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { const gi = MS_GRP.indexOf(MENU.g || 'basic'), d = e.code === 'ArrowUp' ? -1 : 1; menuTab(MS_GRP[(gi + d + MS_GRP.length) % MS_GRP.length]); e.preventDefault(); return; }
  const L = msInGrp(MENU.g || 'basic'), i = L.indexOf(MENU.ms), d = e.code === 'ArrowLeft' ? -1 : 1;
  menuSel(L[(i + d + L.length) % L.length]); e.preventDefault();
});

// =====================================================================
//  VR 판 (sim/vr · Quest 브라우저) — FPV 고글 화면
//  지형·드론은 드론 카메라로 한 번만 그려 화면 텍스처에 담고, 헤드셋에는 어두운 방 + 큰 화면 + 메뉴만 그림.
//  (머리 움직임으로 세상이 흔들리지 않아 멀미가 적고, 장면을 두 번 그리지 않아 빠름)
//  모드 2: 왼쪽 스틱 상승·회전 / 오른쪽 스틱 전후·좌우   모드 1: 왼쪽 스틱 전후·회전 / 오른쪽 스틱 상승·좌우
//  오른쪽 트리거 투하 · 왼쪽 트리거 부스트 · A 확인 · B 메뉴 · X 다시 · Y 화면 앞으로 · 왼쪽 스틱 누르기 화면 고정 방식
// =====================================================================
const IS_VR = !!window.SIM_VR;
const XR = { sess: null, prev: {}, menu: false, userExit: false, ctl: [], hover: null, src: null, osdT: 0, mT: 0, frames: 0 };
const VRS = new THREE.Scene(); VRS.background = new THREE.Color(0x06090c);
VRS.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1));
const VR_HEAD = new THREE.Group(), VR_SPACE = new THREE.Group(); VRS.add(VR_HEAD); VRS.add(VR_SPACE);
const VR_RT = new THREE.WebGLRenderTarget(1280, 720, { samples: 4 }); VR_RT.texture.encoding = renderer.outputEncoding;
function vrPlane(w, h, cw, ch, opt) {
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial(Object.assign({ map: tex, transparent: true, depthWrite: false, toneMapped: false }, opt || {})));
  m.renderOrder = 10; return { cv, tex, m };
}
const VR_SCR = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), new THREE.MeshBasicMaterial({ map: VR_RT.texture }));
const VR_OSD = vrPlane(2.4, 1.35, 960, 540); VR_OSD.m.position.z = 0.003; VR_SCR.add(VR_OSD.m);
const VR_FRAME = new THREE.Mesh(new THREE.PlaneGeometry(2.48, 1.43), new THREE.MeshBasicMaterial({ color: 0x0b1116 })); VR_FRAME.position.z = -0.003; VR_SCR.add(VR_FRAME);
const VR_PIP = { rt: new THREE.WebGLRenderTarget(560, 315), cam: new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 3000) }; VR_PIP.rt.texture.encoding = renderer.outputEncoding;
VR_PIP.m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.394), new THREE.MeshBasicMaterial({ map: VR_PIP.rt.texture })); VR_PIP.m.position.set(1.2 - 0.38, -0.675 + 0.26, 0.006); VR_SCR.add(VR_PIP.m);
{ const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.414), new THREE.MeshBasicMaterial({ color: 0xffc828 })); fr.position.z = -0.001; VR_PIP.m.add(fr); }
const VR_MAP = (function () { const t = new THREE.CanvasTexture(ui.map); t.encoding = THREE.sRGBEncoding; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.833), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.95, toneMapped: false }));
  m.position.set(-1.2 - 0.29, 0.675 - 0.4165, 0); m.visible = false; VR_SCR.add(m); return { t, m }; })();
const VR_MENU = vrPlane(1.3, 1.3 * 1080 / 1024, 1024, 1080); VR_MENU.btns = []; VR_MENU.m.visible = false; VRS.add(VR_MENU.m);
// 컨트롤러 광선
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i); VRS.add(c);
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(0, 0, 0), new V3(0, 0, -4)]), new THREE.LineBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.8 }));
  ln.visible = false; c.add(ln); c.userData.ln = ln;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0x4fe3ff })); c.add(tip);
  c.addEventListener('connected', e => { c.userData.hand = e.data && e.data.handedness; });
  c.addEventListener('disconnected', () => { c.userData.hand = null; });
  XR.ctl.push(c);
}
// 머리 고정 화면: XR 이 머리 위치를 갱신한 직후(그리기 바로 전)에 따라 붙임 -> 흔들림 없음
XR.headP = new V3(0, 1.6, 0); XR.headQ = new THREE.Quaternion();
VRS.onBeforeRender = () => { XR.headP.copy(camera.position); XR.headQ.copy(camera.quaternion); VR_HEAD.position.copy(camera.position); VR_HEAD.quaternion.copy(camera.quaternion); VR_HEAD.updateMatrixWorld(true); };
// XR 이 게임 카메라에 머리 위치를 덮어쓰므로, 그린 뒤 드론 카메라 위치로 되돌림
VRS.onAfterRender = () => { if (XR.camP) { camera.position.copy(XR.camP); camera.quaternion.copy(XR.camQ); camera.updateMatrixWorld(); } };
function vrApplyCam() { S.cam = CAMS.indexOf(SET.vrCam === 'chase' ? 'CHASE' : 'FPV'); }
function vrEnv(v) {
  if (v === 'ir') { irSet(!ENV.ir); return; }
  SET.night = v === 'night'; ENV.night = SET.night; saveSet(); envApply(); if (ENV.ir) irSet(false); syncTime();
}
function voiceInfo() {
  try { const V = speechSynthesis.getVoices(), en = V.filter(v => /^en/i.test(v.lang)); return { n: V.length, en: en.length, name: COMM.voice ? COMM.voice.name : (en[0] ? en[0].name : '') }; } catch (e) { return { n: 0, en: 0, name: '' }; }
}
function vrScreenMode(m) {
  SET.vrScreen = m === 'space' ? 'space' : 'head'; saveSet();
  (SET.vrScreen === 'head' ? VR_HEAD : VR_SPACE).add(VR_SCR); VR_SCR.position.set(0, SET.vrScreen === 'head' ? 0 : 0, -2.0); VR_SCR.rotation.set(0, 0, 0);
  if (SET.vrScreen === 'space') vrRecenter();
}
function vrRecenter() {   // 공간 고정: 지금 바라보는 쪽 앞에 화면을 놓음
  const fw = new V3(0, 0, -1).applyQuaternion(XR.headQ); const yaw = Math.atan2(-fw.x, -fw.z);
  VR_SPACE.position.set(XR.headP.x, XR.headP.y || 1.6, XR.headP.z); VR_SPACE.rotation.set(0, yaw, 0);
}
// ---- 세션 ----
async function vrStart() {
  if (!navigator.xr || XR.sess) return;
  let sess; try { sess = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] }); } catch (e) { vrOverlay(L2('VR을 시작할 수 없습니다. 다시 눌러 주세요.', 'Could not start VR. Please try again.')); return; }
  XR.sess = sess; XR.userExit = false; renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(window.XR_FB || 1.0); renderer.xr.setReferenceSpaceType('local-floor');
  try { await renderer.xr.setSession(sess); }
  catch (e) { try { renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(sess); } catch (e2) { try { sess.end(); } catch (e3) { } XR.sess = null; renderer.xr.enabled = false; return; } }
  try { renderer.xr.setFoveation(1); } catch (e) { }
  XR_ON = true; XR.prev = {}; vrApplyCam();
  sess.addEventListener('end', vrEnded);
  const wake = () => { try { if (!AU.ctx) initAudio(); if (AU.ctx && AU.ctx.state !== 'running') AU.ctx.resume(); } catch (e) { } }; sess.addEventListener('selectstart', wake); sess.addEventListener('select', wake); sess.addEventListener('squeezestart', wake); wake();
  sess.addEventListener('visibilitychange', () => { if (sess.visibilityState !== 'visible' && (S.state === 'run' || S.state === 'demo')) { togglePause(); XR.autoPaused = true; } else if (sess.visibilityState === 'visible' && XR.autoPaused && S.state === 'pause') { togglePause(); XR.autoPaused = false; } });
  $('vrBack').classList.add('hidden');
  vrScreenMode(SET.vrScreen);
  if (S.state === 'pause') { XR.menu = false; togglePause(); } else vrMenuOpen();
  XR.recenter = 2;   // 첫 프레임들에서 머리 위치가 잡히면 화면·메뉴 위치를 다시 맞춤
  last = performance.now();
  renderer.setAnimationLoop((t, f) => { if (f) frame(performance.now()); });
}
function vrStop() { XR.userExit = true; if (XR.sess) try { XR.sess.end(); } catch (e) { } }
function vrEnded() {
  renderer.setAnimationLoop(null); XR_ON = false; XR.sess = null; renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = true;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  last = performance.now(); if (!TEST) requestAnimationFrame(frame);
  if (XR.afterExit === 'video') {   // VR 메뉴에서 '영상 저장': 2D 화면에서 리플레이를 재생하며 녹화
    XR.afterExit = null; $('vrBack').classList.add('hidden'); S.cam = CAMS.indexOf(SET.vrCam === 'chase' ? 'CHASE' : 'FPV');
    exportReplayVideo(LAST_REC, ok => { if (IS_VR) ui.menu.classList.add('hidden'); vrOverlay(ok ? L2('영상을 저장했습니다. 다운로드 폴더(파일 앱)에서 볼 수 있습니다.', 'Video saved to your Downloads folder.') : L2('영상을 만들지 못했습니다.', 'Could not create the video.'), L2('VR 시작', 'Start VR')); });
    return;
  }
  if (S.state === 'run' || S.state === 'demo') togglePause();
  vrOverlay(XR.userExit ? '' : L2('VR이 멈췄습니다. 버튼을 누르면 하던 비행을 이어 갑니다.', 'VR was interrupted. Press the button to continue your flight.'), XR.userExit ? L2('VR 시작', 'Start VR') : L2('VR로 돌아가기', 'Back to VR'));
}
function vrOverlay(msg, btn) {
  const o = $('vrBack'); if (!o) return; o.classList.remove('hidden');
  if (msg) $('vrBackD').textContent = msg; if (btn) $('vrBackGo').textContent = btn;
}
// ---- 컨트롤러 입력 (readInput 끝에서 부름) ----
function xrPads() {
  const srcs = XR.src || (XR.sess ? XR.sess.inputSources : []); let L = null, R = null;
  for (const s of srcs) if (s && s.gamepad) { if (s.handedness === 'left') L = s.gamepad; else if (s.handedness === 'right') R = s.gamepad; }
  return { L, R };
}
function xrInput(dt) {
  const { L: Lg, R: Rg } = xrPads();
  const ax = (g, i) => (g && g.axes && g.axes.length > i ? g.axes[i] || 0 : 0), bt = (g, i) => !!(g && g.buttons && g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
  const edge = (k, on) => { const e = on && !XR.prev[k]; XR.prev[k] = on; return e; };
  const rt = edge('rt', bt(Rg, 0)), lt = edge('lt', bt(Lg, 0)), A = edge('a', bt(Rg, 4)), B = edge('b', bt(Rg, 5)), X = edge('x', bt(Lg, 4)), Y = edge('y', bt(Lg, 5)), LS = edge('ls', bt(Lg, 3)), RS = edge('rs', bt(Rg, 3));
  if ((rt || lt || A || B) && AU.ctx && AU.ctx.state !== 'running') try { AU.ctx.resume(); } catch (e) { }
  if (XR.menu) { if (rt || A) vrMenuClick('right'); if (lt) vrMenuClick('left'); if (B && S.state === 'pause') vrResume(); return; }
  if (S.state === 'replay') {   // 리플레이: A 재생·멈춤 · 오른쪽 스틱 좌우 5초 · Y 속도 · 왼쪽 스틱 누르기 카메라 · B 메뉴
    const sx = ax(Rg, 2); if (edge('sr', sx > 0.7)) replayKey('ArrowRight'); if (edge('sl', sx < -0.7)) replayKey('ArrowLeft');
    if (A) replayKey('Space'); if (LS) replayKey('KeyC'); if (Y) { const L = [0.5, 1, 2, 4]; RP.speed = L[(L.indexOf(RP.speed) + 1) % L.length]; replayUI(); }
    if (B) { if (VID.on) return; replayEnd(); vrMenuOpen(); }
    return;
  }
  const lx = ax(Lg, 2), ly = -ax(Lg, 3), rx = ax(Rg, 2), ry = -ax(Rg, 3);
  const st = SET.vrMode === 1 ? { thr: ry, yaw: lx, pitch: ly, roll: rx } : { thr: ly, yaw: lx, pitch: ry, roll: rx };
  let any = false;
  for (const k in st) { const v = shape(st[k], 0.1); if (Math.abs(v) > Math.abs(IN[k])) { IN[k] = v; any = true; } }
  if (any) IN.src = 'VR';
  if (Lg && Lg.buttons[0] && Lg.buttons[0].value > 0.4) IN.boost = true;
  if (rt) pressed.push('Space');
  if (A) { if (S.state === 'result') startRun(S.kind); else pressed.push('Enter'); }
  if (B) vrMenuOpen();
  if (Y) { const L = [0, 90, 60, 45]; SET.vrPip = L[(L.indexOf(SET.vrPip | 0) + 1) % L.length]; saveSet(); showMsg(SET.vrPip ? L2('하부 카메라 ', 'Lower camera ') + SET.vrPip + '°' : L2('하부 카메라 끔', 'Lower camera off'), '#ffc828', 1); }
  if (LS) { SET.vrCam = SET.vrCam === 'chase' ? 'fpv' : 'chase'; saveSet(); vrApplyCam(); showMsg(SET.vrCam === 'chase' ? L2('뒤에서 추적', 'Chase view') : 'FPV', '#4fe3ff', 1); }
  if (RS) irSet(!ENV.ir);
}
// ---- VR 안 메뉴 ----
const VR_MS = () => [['course', L2('장애물 코스', 'Obstacle course')], ['forest', L2('숲길 통과', 'Forest trail')], ['race', L2('타임 레이스', 'Time race')], ['ridge', L2('능선 종주', 'Ridge run')], ['free', L2('자유 비행', 'Free flight')], ['demo', L2('기준 비행 보기', 'Reference flight')]];
const VR_AF = ['x2d', 'anafi', 'fpv', 'kfpv'];
const VR_MS2 = () => [['recon', L2('정찰', 'Recon')], ['track', L2('차량 추적', 'Vehicle track')], ['fire', L2('산불 감시', 'Wildfire watch')], ['sar', L2('수색·구조', 'Search & rescue')], ['strike', L2('타격', 'Strike')]];
function vrMenuOpen() {   // 비행 중이면 멈춰 두고(계속하기 가능), 끝났으면 메뉴로
  if (S.state === 'run' || S.state === 'demo') togglePause(); else if (S.state !== 'pause' && S.state !== 'menu') toMenu();
  XR.menu = true; XR.menuPlace = true; XR.hover = null; XR.mT = 0;
}
function vrResume() { XR.menu = false; if (S.state === 'pause') togglePause(); vrApplyCam(); if (SET.vrScreen === 'space') vrRecenter(); }
function vrRR(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
function vrMenuDraw() {
  const P = VR_MENU, g = P.cv.getContext('2d'), W2 = P.cv.width, H2 = P.cv.height; P.btns = [];
  const paused = S.state === 'pause';
  g.clearRect(0, 0, W2, H2); g.fillStyle = 'rgba(10,15,19,.94)'; vrRR(g, 0, 0, W2, H2, 30); g.fill();
  g.textBaseline = 'top'; g.fillStyle = '#ffc828'; g.font = '800 42px system-ui, sans-serif'; g.fillText('FPV VR · ' + stName(SITE), 36, 24);
  g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '500 21px system-ui, sans-serif'; g.fillText(L2('컨트롤러로 가리키고 트리거로 선택', 'Point with a controller, pull the trigger'), 36, 76);
  const btn = (id, x, y, w, h, label, on, dis, hot) => {
    const hv = XR.hover === id && !dis; g.fillStyle = dis ? 'rgba(255,255,255,.04)' : on ? '#4fe3ff' : hot ? (hv ? '#ffd95a' : '#ffc828') : hv ? 'rgba(79,227,255,.35)' : 'rgba(255,255,255,.09)';
    vrRR(g, x, y, w, h, 12); g.fill(); if (hv) { g.strokeStyle = hot ? '#fff' : '#4fe3ff'; g.lineWidth = 4; g.stroke(); }
    g.fillStyle = dis ? 'rgba(255,255,255,.3)' : on || hot ? '#071016' : '#e8eef2'; g.font = `700 ${h >= 76 ? 30 : 22}px system-ui, sans-serif`; g.textBaseline = 'middle';
    const tw = g.measureText(label).width; g.fillText(label, x + (w - tw) / 2, y + h / 2); g.textBaseline = 'top';
    if (!dis) P.btns.push({ id, x, y, w, h });
  };
  let y = 112;
  const hasRec = !!(REC && REC.s.length > 1) || !!(LAST_REC && LAST_REC.s && LAST_REC.s.length > 1);
  if (paused) {
    const kn = (MS_NAME[S.kind] || ({ course: L2('장애물 코스', 'Obstacle course'), free: L2('자유 비행', 'Free flight'), demo: L2('기준 비행', 'Reference flight') })[S.kind] || S.kind);
    btn('resume', 36, y, 280, 80, '▶ ' + L2('계속하기', 'Resume'), false, false, true); btn('restart', 328, y, 212, 80, '↺ ' + L2('처음부터', 'Restart'), false);
    btn('replay', 552, y, 212, 80, L2('리플레이', 'Replay'), false, !hasRec); btn('video', 776, y, 212, 80, '⬇ ' + L2('영상 저장', 'Save video'), false, !hasRec); y += 96;
  } else if (hasRec) { btn('replay', 36, y, 460, 70, '▶ ' + L2('마지막 비행 리플레이', 'Replay last flight'), false); btn('video', 528, y, 460, 70, '⬇ ' + L2('마지막 비행 영상 저장', 'Save last flight video'), false); y += 84; }
  const L = VR_MS().concat(VR_MS2());
  L.forEach(([k, n], i) => btn('ms:' + k, 36 + (i % 4) * 240, y + Math.floor(i / 4) * 84, 228, 74, n, !paused && false, msAvail(k).site === false));
  y += Math.ceil(L.length / 4) * 84 + 10;
  const RH = 60, RW = 50, row = (yy, lbl) => { g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '600 22px system-ui, sans-serif'; g.fillText(lbl, 36, yy + 14); };
  const afN = id => ({ x2d: 'Skydio X2D', anafi: 'ANAFI', fpv: L2('FPV 레이싱', 'FPV racer'), kfpv: L2('자폭 FPV', 'Kamikaze FPV') })[id];
  row(y, L2('기체', 'Drone')); VR_AF.forEach((id, i) => btn('af:' + id, 190 + i * 200, y, 188, RW, afN(id), SET.af === id, paused)); y += RH;
  row(y, L2('난이도', 'Difficulty')); [['train', L2('입문', 'Training')], ['easy', L2('쉬움', 'Easy')], ['sport', L2('스포츠', 'Sport')]].forEach(([v, n], i) => btn('diff:' + v, 190 + i * 200, y, 188, RW, n, SET.diff === v)); y += RH;
  row(y, L2('스틱', 'Sticks')); [[2, L2('모드 2', 'Mode 2')], [1, L2('모드 1', 'Mode 1')]].forEach(([v, n], i) => btn('mode:' + v, 190 + i * 200, y, 188, RW, n, (SET.vrMode || 2) === v)); y += RH;
  row(y, L2('카메라', 'Camera')); [['fpv', 'FPV', SET.vrCam !== 'chase'], ['c0', L2('추적 멀리', 'Chase far'), SET.vrCam === 'chase' && (SET.zoom | 0) === 0], ['c1', L2('추적 보통', 'Chase mid'), SET.vrCam === 'chase' && (SET.zoom | 0) === 1], ['c2', L2('추적 가까이', 'Chase near'), SET.vrCam === 'chase' && (SET.zoom | 0) === 2]].forEach(([v, n, on], i) => btn('cam:' + v, 190 + i * 200, y, 188, RW, n, on)); y += RH;
  row(y, L2('하부 카메라', 'Lower cam')); [[0, L2('끔', 'Off')], [90, '90°'], [60, '60°'], [45, '45°']].forEach(([v, n], i) => btn('pip:' + v, 190 + i * 200, y, 188, RW, n, (SET.vrPip | 0) === v)); y += RH;
  row(y, L2('환경', 'Light')); [['day', L2('낮', 'Day'), !SET.night && !ENV.ir], ['night', L2('밤', 'Night'), !!SET.night && !ENV.ir], ['ir', L2('열화상', 'Thermal'), !!ENV.ir]].forEach(([v, n, on], i) => btn('env:' + v, 190 + i * 200, y, 188, RW, n, on)); y += RH;
  row(y, L2('표시', 'Display')); btn('scr:head', 190, y, 188, RW, L2('고글 화면', 'Goggles'), SET.vrScreen !== 'space'); btn('scr:space', 390, y, 188, RW, L2('공간 화면', 'Fixed screen'), SET.vrScreen === 'space');
  btn('map', 590, y, 188, RW, L2('지도', 'Map'), SET.vrMap !== false); btn('guide', 790, y, 188, RW, L2('경로 안내', 'Guide'), !!SET.guide); y += RH + 4;
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '500 19px system-ui, sans-serif';
  g.fillText(((SET.vrMode || 2) === 2 ? L2('모드 2: 왼쪽 스틱 상승·회전 / 오른쪽 스틱 전후·좌우', 'Mode 2: left stick climb·yaw / right stick fwd·side') : L2('모드 1: 왼쪽 스틱 전후·회전 / 오른쪽 스틱 상승·좌우', 'Mode 1: left stick fwd·yaw / right stick climb·side')), 36, y);
  g.fillText(L2('R트리거 투하 · L트리거 부스트 · A 확인 · B 메뉴/계속 (처음부터 다시는 메뉴에서)', 'R-trigger drop · L-trigger boost · A ok · B menu/resume (restart from the menu)'), 36, y + 26);
  g.fillText(L2('Y 하부 카메라 · 왼쪽 스틱 누르기 카메라 전환 · 오른쪽 스틱 누르기 열화상', 'Y lower cam · L-stick click camera · R-stick click thermal'), 36, y + 52);
  const vi = voiceInfo(), eng = commEngine(), au = AU.ctx ? AU.ctx.state : L2('없음', 'none');
  g.fillStyle = eng === 'none' ? 'rgba(255,154,122,.95)' : 'rgba(93,255,154,.85)';
  g.fillText(L2('무전 음성: ', 'Radio voice: ') + (eng === 'synth' ? L2('내장 합성기', 'built-in synthesizer') + (TTSW.w ? '' : L2(' (불러오는 중)', ' (loading)')) : eng === 'web' ? vi.name : L2('없음 · 자막만', 'none · subtitles only')) + (COMM.fbOk ? ' ✓' : '') + L2(' · 오디오 ', ' · audio ') + au + (COMM.fbErr ? ' · ' + String(COMM.fbErr).slice(0, 40) : ''), 36, y + 78);
  btn('vtest', 36, H2 - 76, 300, 56, L2('🔊 음성 테스트', '🔊 Voice test'), false);
  btn('exit', W2 - 280, H2 - 76, 244, 56, L2('VR 끝내기', 'Exit VR'), false);
  g.fillStyle = 'rgba(255,255,255,.3)'; g.font = '500 16px monospace'; g.fillText('VR5', 360, H2 - 56);
  P.tex.needsUpdate = true;
}
const _vr = new THREE.Raycaster(), _vp = new V3(), _vq = new THREE.Quaternion();
function vrMenuHit(c) {
  if (!c || !VR_MENU.m.visible) return null;
  _vp.setFromMatrixPosition(c.matrixWorld); _vq.setFromRotationMatrix(c.matrixWorld);
  _vr.set(_vp.clone(), new V3(0, 0, -1).applyQuaternion(_vq));
  const h = _vr.intersectObject(VR_MENU.m, false)[0]; if (!h || !h.uv) return null;
  const x = h.uv.x * VR_MENU.cv.width, y = (1 - h.uv.y) * VR_MENU.cv.height;
  return { b: VR_MENU.btns.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h), dist: h.distance };
}
function vrCtl(hand) { return XR.ctl.find(c => c.userData.hand === hand) || null; }
function vrMenuClick(hand) {
  const r = vrMenuHit(vrCtl(hand)) || vrMenuHit(vrCtl(hand === 'right' ? 'left' : 'right')); if (!r || !r.b) return;
  const id = r.b.id; sfx('good'); XR.mT = 0;
  if (id === 'exit') { vrStop(); return; }
  if (id === 'resume') { vrResume(); return; }
  if (id === 'restart') { XR.menu = false; startRun(S.kind); vrApplyCam(); if (SET.vrScreen === 'space') vrRecenter(); return; }
  if (id === 'vtest') { vrVoiceTest(); return; }
  if (id === 'replay') { if (REC) LAST_REC = recFinish(); XR.menu = false; replayStart(LAST_REC, 'menu'); vrApplyCam(); if (SET.vrCam !== 'chase' && S.cam !== 0) S.cam = 0; return; }
  if (id === 'video') { if (REC) LAST_REC = recFinish(); XR.afterExit = 'video'; vrStop(); return; }
  if (id === 'map') { SET.vrMap = SET.vrMap === false; saveSet(); return; }
  if (id === 'guide') { SET.guide = !SET.guide; saveSet(); return; }
  if (id.startsWith('diff:')) { SET.diff = id.slice(5); saveSet(); return; }
  if (id.startsWith('mode:')) { SET.vrMode = +id.slice(5); saveSet(); return; }
  if (id.startsWith('scr:')) { vrScreenMode(id.slice(4)); return; }
  if (id.startsWith('cam:')) { const v = id.slice(4); if (v === 'fpv') SET.vrCam = 'fpv'; else { SET.vrCam = 'chase'; SET.zoom = +v.slice(1); } saveSet(); vrApplyCam(); return; }
  if (id.startsWith('zoom:')) { SET.zoom = +id.slice(5); saveSet(); return; }
  if (id.startsWith('pip:')) { SET.vrPip = +id.slice(4); saveSet(); return; }
  if (id.startsWith('env:')) { vrEnv(id.slice(4)); return; }
  if (id.startsWith('af:')) { if (S.state === 'pause') return; setAirframe(id.slice(3)); afUI(); return; }
  if (id.startsWith('ms:')) { const k = id.slice(3); menuSel(k); if (!msAvail(k).ok) return; XR.menu = false; startRun(k); vrApplyCam(); if (SET.vrScreen === 'space') vrRecenter(); }
}
// ---- 화면 위 OSD (실제 FPV 고글처럼 영상 위에 글자) ----
function vrOsdDraw() {
  const { cv, tex } = VR_OSD, g = cv.getContext('2d'), W2 = 1280, H2 = 720; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.setTransform(cv.width / W2, 0, 0, cv.height / H2, 0, 0);
  const sh = (t, x, y, sz, col, al) => { g.font = `700 ${sz}px system-ui, sans-serif`; g.textAlign = al || 'left'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(t, x, y); g.fillStyle = col || '#fff'; g.fillText(t, x, y); };
  g.textBaseline = 'top';
  const box = (lines, col) => { g.fillStyle = 'rgba(6,10,14,.82)'; vrRR(g, 190, 190, 900, 340, 22); g.fill(); g.strokeStyle = col; g.lineWidth = 3; g.stroke(); let y = 220; lines.forEach(([t, sz, c]) => { const ws = String(t).split(' '); let ln = ''; g.font = `700 ${sz}px system-ui, sans-serif`; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 840 && ln) { sh(ln, 220, y, sz, c); y += sz * 1.25; ln = w; } else ln = tl; } if (ln) { sh(ln, 220, y, sz, c); y += sz * 1.35; } }); };
  if (S.brief) { const b = $('brief'); box([['BRIEFING', 30, '#4fe3ff'], [b && b.querySelector('h3') ? b.querySelector('h3').textContent : '', 40, '#fff'], [b && b.querySelector('p') ? b.querySelector('p').textContent : '', 26, '#cfd6da'], [L2('A 버튼: 시작', 'A button: start'), 30, '#ffc828']], '#4fe3ff'); tex.needsUpdate = true; return; }
  if (S.state === 'result') { box([[($('resTitle') || {}).textContent || '', 44, '#5dff9a'], [($('resSub') || {}).textContent || '', 28, '#e8eef2'], [L2('A 다시 · B 메뉴', 'A again · B menu'), 30, '#ffc828']], '#5dff9a'); tex.needsUpdate = true; return; }
  if (S.state === 'pause') { box([[L2('일시 정지', 'PAUSED'), 44, '#ffc828'], [L2('B: 메뉴', 'B: menu'), 30, '#e8eef2']], '#ffc828'); tex.needsUpdate = true; return; }
  if (S.state === 'menu') { tex.needsUpdate = true; return; }
  if (S.state === 'replay' && RP.rec) { const s0 = RP.rec.s[0][0], e0 = RP.rec.s[RP.rec.s.length - 1][0]; sh(`REPLAY  ${fmt(RP.t - s0)} / ${fmt(e0 - s0)}  ×${RP.speed}${RP.playing ? '' : '  ❚❚'}`, W2 / 2, 22, 40, '#4fe3ff', 'center');
    sh(L2('A 재생·멈춤 · 오른쪽 스틱 ←→ 5초 · Y 속도 · 왼쪽 스틱 누르기 카메라 · B 메뉴', 'A play/pause · R-stick ←→ 5 s · Y speed · L-stick click camera · B menu'), W2 / 2, H2 - 60, 26, '#e8eef2', 'center'); }
  const sb = S.state === 'demo' ? ghostS : S.state === 'replay' ? RP.pose : DR, gh = groundAt(sb.p.x, sb.p.z), sp = sb.v ? sb.v.length() : 0;
  // 화면 좌표: 게임 카메라(드론 카메라·추적 카메라)로 3D 점을 투영
  const prj = p => { const q = p.clone().project(camera); return { x: (q.x + 1) / 2 * W2, y: (1 - q.y) / 2 * H2, front: q.z < 1 && q.z > -1 }; };
  // 수평선 (기울기·높낮이)
  { const f = new V3(0, 0, -1).applyQuaternion(camera.quaternion); f.y = 0; if (f.lengthSq() > 1e-4) { f.normalize(); const r = new V3(-f.z, 0, f.x), c = camera.position.clone().addScaledVector(f, 1000);
    const a = prj(c.clone().addScaledVector(r, -600)), b = prj(c.clone().addScaledVector(r, 600)); if (a.front && b.front) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.setLineDash([26, 14]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); } } }
  // 진행 방향 표시 (1초 뒤 위치): 지금 실제로 날아가는 쪽
  if (sp > 0.6) { const m = prj(sb.p.clone().addScaledVector(sb.v, 1.0)); if (m.front && m.x > 0 && m.x < W2 && m.y > 0 && m.y < H2) {
    g.strokeStyle = '#5dff9a'; g.lineWidth = 5; g.beginPath(); g.arc(m.x, m.y, 16, 0, Math.PI * 2); g.moveTo(m.x - 40, m.y); g.lineTo(m.x - 16, m.y); g.moveTo(m.x + 16, m.y); g.lineTo(m.x + 40, m.y); g.moveTo(m.x, m.y - 16); g.lineTo(m.x, m.y - 30); g.stroke(); } }
  // 다음 목표 표시: 화면 안이면 마름모, 밖이면 가장자리 화살표
  const o = isMission() ? msObj() : curObj();
  if (o && o.mk && S.state !== 'demo') { const t = o.mk.clone().project(camera), beh = t.z > 1; let x = t.x, y = t.y; if (beh) { x = -x; y = -y; }
    const inside = !beh && Math.abs(x) < 0.92 && Math.abs(y) < 0.88, dist = camera.position.distanceTo(o.mk);
    if (inside) { const px = (x + 1) / 2 * W2, py = (1 - y) / 2 * H2; g.strokeStyle = '#ffc828'; g.lineWidth = 4; g.beginPath(); g.moveTo(px, py - 22); g.lineTo(px + 22, py); g.lineTo(px, py + 22); g.lineTo(px - 22, py); g.closePath(); g.stroke(); sh(Math.round(dist) + ' m', px, py + 28, 28, '#ffc828', 'center'); }
    else { const k = Math.max(Math.abs(x) / 0.88, Math.abs(y) / 0.8), ex = x / k, ey = y / k, px = (ex + 1) / 2 * W2, py = (1 - ey) / 2 * H2, an = Math.atan2(-ey, ex);
      g.save(); g.translate(px, py); g.rotate(an); g.fillStyle = '#ffc828'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(34, 0); g.lineTo(-14, -24); g.lineTo(-4, 0); g.lineTo(-14, 24); g.closePath(); g.stroke(); g.fill(); g.restore();
      sh(Math.round(dist) + ' m', px - Math.cos(an) * 60, py - Math.sin(an) * 60 - 14, 28, '#ffc828', 'center'); } }
  // 큰 숫자 계기
  sh(fmt(S.t || 0), 40, 26, 56, '#fff');
  sh(`${Math.round(sp * 3.6)}`, W2 - 150, 22, 64, '#fff', 'right'); sh('km/h', W2 - 40, 44, 30, '#cfd6da', 'right');
  sh(`${(sb.p.y - gh).toFixed(1)}`, W2 - 150, 92, 56, '#fff', 'right'); sh(L2('m 고도', 'm AGL'), W2 - 40, 108, 26, '#cfd6da', 'right');
  const vs = sb.v ? sb.v.y : 0; sh((vs > 0.15 ? '▲ ' : vs < -0.15 ? '▼ ' : '■ ') + Math.abs(vs).toFixed(1) + ' m/s', W2 - 40, 156, 30, Math.abs(vs) > 3 ? '#ff9a40' : '#e8eef2', 'right');
  { const hdg = ((((SITE.brg || 0) + (sb.h || 0) * 180 / Math.PI) % 360) + 360) % 360; sh(String(Math.round(hdg)).padStart(3, '0') + '°', W2 / 2, 76, 34, '#e8eef2', 'center'); }
  if (o && S.state !== 'replay') sh('▸ ' + (o.label || MS_NAME[S.kind] || ''), W2 / 2, 22, 42, '#ffc828', 'center');
  if (S.state === 'demo') sh(L2('기준 비행', 'REFERENCE FLIGHT'), W2 / 2, 22, 40, '#4fe3ff', 'center');
  if (ENV.ir) sh('IR', 40, 96, 34, '#ff9a40');
  if (!isMission() && S.kind === 'course') sh('M84 ' + '●'.repeat(Math.max(0, S.payloads || 0)), 40, H2 - 70, 34, '#ffc828');
  if (SET.vrPip) sh(L2('하부 ', 'LOWER ') + SET.vrPip + '°', W2 - 40, H2 - 252, 24, '#ffc828', 'right');
  const r = $('radio'); if (r && r.classList.contains('show')) { const t = r.querySelector('.re') ? r.querySelector('.re').textContent : r.textContent; g.font = '600 28px system-ui, sans-serif'; const ws = t.split(' '); let ln = ''; const L = []; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 980 && ln) { L.push(ln); ln = w; } else ln = tl; } if (ln) L.push(ln); L.slice(-2).forEach((l, i) => sh(l, W2 / 2, H2 - 112 + i * 36, 28, '#9fe9ff', 'center')); }
  const m = $('objMsg'); if (m && m.classList.contains('show') && m.textContent.trim()) sh(m.textContent.trim(), W2 / 2, H2 / 2 + 90, 44, m.style.color || '#5dff9a', 'center');
  // 등고선 지도 (화면 왼쪽 가운데)
  if (SET.vrMap !== false && ui.map) { const mw = 198, mh = 330, mx = 26, my = 150; g.globalAlpha = 0.92; g.fillStyle = 'rgba(6,10,14,.75)'; g.fillRect(mx - 4, my - 4, mw + 8, mh + 8); g.filter = 'brightness(1.6) contrast(1.15)'; g.drawImage(ui.map, mx, my, mw, mh); g.filter = 'none'; g.globalAlpha = 1; g.strokeStyle = 'rgba(255,200,40,.8)'; g.lineWidth = 2; g.strokeRect(mx - 4, my - 4, mw + 8, mh + 8); }
  // 경로 안내 문구 (예: 고도 내리기 3.2 m (왼쪽 스틱 ↓))
  if (SET.guide) { const ge = $('guide'); if (ge && !ge.classList.contains('hidden')) { const L = [...ge.children].map(e => [e.textContent, e.className]).filter(x => x[0]).slice(0, 3); L.forEach(([t, c], i) => sh(t, W2 / 2, H2 - 200 + i * 38, 30, c === 'ok' ? '#5dff9a' : c === 'warn' ? '#ff9a40' : '#4fe3ff', 'center')); } }
  if (SET.vrCam !== 'chase') { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(W2 / 2 - 22, H2 / 2); g.lineTo(W2 / 2 - 7, H2 / 2); g.moveTo(W2 / 2 + 7, H2 / 2); g.lineTo(W2 / 2 + 22, H2 / 2); g.moveTo(W2 / 2, H2 / 2 + 7); g.lineTo(W2 / 2, H2 / 2 + 16); g.stroke(); }
  g.textAlign = 'left'; tex.needsUpdate = true;
}
// ---- 매 프레임 (그리기 직전): 드론 카메라 영상을 화면 텍스처로 ----
function xrTick(dt) {
  XR.frames++;
  if (S.state === 'menu' && !XR.menu) vrMenuOpen();
  if (XR.recenter > 0 && XR.headP.y > 0.3 && XR.frames > 2) { XR.recenter--; if (SET.vrScreen === 'space') vrRecenter(); XR.menuPlace = true; }
  // 메뉴 판: 열 때 눈앞 1.5 m (화면보다 앞)
  VR_MENU.m.visible = XR.menu;
  if (XR.menu) {
    if (XR.menuPlace) { XR.menuPlace = false; const H = XR.headP, fw = new V3(0, 0, -1).applyQuaternion(XR.headQ), yaw = Math.atan2(-fw.x, -fw.z); VR_MENU.m.position.set(H.x - Math.sin(yaw) * 1.5, H.y - 0.15, H.z - Math.cos(yaw) * 1.5); VR_MENU.m.rotation.set(0, yaw, 0); VR_MENU.m.updateMatrixWorld(true); }
    let hv = null; for (const c of XR.ctl) { const r = vrMenuHit(c); if (r && r.b) hv = r.b.id; }
    if (hv !== XR.hover || (XR.mT -= dt) <= 0) { XR.hover = hv; XR.mT = 0.3; vrMenuDraw(); }
  }
  XR.ctl.forEach(c => c.userData.ln.visible = !!c.userData.hand && (XR.menu || S.state === 'result'));
  VR_SCR.visible = true;
  // 지형 장면을 드론 카메라(게임 카메라)로 화면 텍스처에 그림
  renderer.shadowMap.autoUpdate = false; if (XR.frames % 2 === 0) renderer.shadowMap.needsUpdate = true;   // 그림자는 2프레임에 한 번
  camera.aspect = 16 / 9; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  XR.osdT -= dt; if (XR.osdT <= 0) { XR.osdT = 0.1; vrOsdDraw(); }
  const cur = renderer.getRenderTarget(); renderer.xr.enabled = false;
  renderer.setRenderTarget(VR_RT); renderer.clear(); renderer.render(scene, camera);
  // 하부 카메라 (각도 고정, 기체 진행 방향 기준)
  const pipOn = (SET.vrPip | 0) > 0 && !XR.menu && S.state !== 'result'; VR_PIP.m.visible = pipOn;
  if (pipOn && XR.frames % 2 === 0) { const sb = S.state === 'demo' ? ghostS : DR, c = VR_PIP.cam, dv = droneM.g.visible; droneM.g.visible = false;
    c.position.copy(sb.p).add(new V3(0, -0.12, 0)); c.rotation.set(-(SET.vrPip | 0) * DEG, -sb.h, 0, 'YXZ'); c.updateMatrixWorld();
    const sa = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(VR_PIP.rt); renderer.clear(); renderer.render(scene, c); renderer.shadowMap.autoUpdate = sa; droneM.g.visible = dv; }
  renderer.setRenderTarget(cur); renderer.xr.enabled = true;
  (XR.camP = XR.camP || new V3()).copy(camera.position); (XR.camQ = XR.camQ || new THREE.Quaternion()).copy(camera.quaternion);
}
// ---- 리플레이를 영상(WebM/MP4)으로 저장 (PC 리플레이 막대·VR 메뉴) ----
const VID = { mr: null, chunks: [], on: false, stopping: false, rec: null, done: null };
function vidMime() { for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { } return ''; }
function vidTag(t) { let e = $('vidTag'); if (!e) { e = document.createElement('div'); e.id = 'vidTag'; e.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:70;padding:8px 16px;border-radius:20px;background:rgba(10,13,16,.85);color:#fff;font:600 15px system-ui,sans-serif;border:1px solid #ff5050'; document.body.appendChild(e); } e.style.display = t ? '' : 'none'; if (t) e.textContent = t; }
function exportReplayVideo(rec, onDone) {
  if (VID.on) return;
  if (!rec || !rec.s || rec.s.length < 2) { showMsg(L2('저장할 비행 기록이 없습니다', 'No flight to save'), '#ff6060', 1.5); if (onDone) onDone(false); return; }
  const cv = renderer.domElement; if (typeof MediaRecorder === 'undefined' || !cv.captureStream) { showMsg(L2('이 브라우저는 영상 저장을 지원하지 않습니다', 'This browser cannot record video'), '#ff6060', 2); if (onDone) onDone(false); return; }
  const cam = S.cam; replayStart(rec, 'menu'); S.cam = cam; replaySeek(rec.s[0][0]); RP.speed = 1; RP.playing = true;
  const mime = vidMime(); let mr;
  try { mr = new MediaRecorder(cv.captureStream(30), Object.assign({ videoBitsPerSecond: 6000000 }, mime ? { mimeType: mime } : {})); } catch (e) { showMsg(L2('영상을 만들 수 없습니다', 'Could not record video'), '#ff6060', 2); if (onDone) onDone(false); return; }
  Object.assign(VID, { mr, chunks: [], on: true, stopping: false, rec, done: onDone || null });
  mr.ondataavailable = e => { if (e.data && e.data.size) VID.chunks.push(e.data); };
  mr.onstop = () => {
    VID.on = false; vidTag('');
    const type = mr.mimeType || mime || 'video/webm', ext = /mp4/.test(type) ? 'mp4' : 'webm', blob = new Blob(VID.chunks, { type });
    const d = new Date(), z = n => String(n).padStart(2, '0'), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `fpv_${rec.kind || 'flight'}_${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}.${ext}`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 8000);
    VID.blobSize = blob.size; replayEnd(); showMsg(L2('영상 저장 완료', 'Video saved'), '#5dff9a', 2);
    const cb = VID.done; VID.done = null; if (cb) cb(true);
  };
  mr.start(500); vidTag('● REC 0%');
}
function vidTick() {
  if (!VID.on || VID.stopping) return;
  const s = VID.rec.s, s0 = s[0][0], end = s[s.length - 1][0], pc = Math.round(clamp((RP.t - s0) / Math.max(1e-6, end - s0), 0, 1) * 100);
  vidTag(L2('● 영상 만드는 중 ', '● Recording video ') + pc + '%');
  if (S.state !== 'replay' || RP.t >= end) { VID.stopping = true; setTimeout(() => { if (VID.mr && VID.mr.state !== 'inactive') VID.mr.stop(); }, 700); }
}
if ($('rpVid')) $('rpVid').onclick = () => { if (RP.rec) exportReplayVideo(RP.rec); };
// ---- 2D 쪽 ----
var VR_OK = { ok: false };
if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { VR_OK.ok = !!ok; vrBtnUpdate(); vrPageInit(); }).catch(() => vrPageInit());
else setTimeout(vrPageInit, 0);
function vrPageInit() {
  if (!IS_VR) return;
  ui.menu.classList.add('hidden');
  vrOverlay(VR_OK.ok ? '' : L2('이 기기·브라우저는 VR을 지원하지 않습니다. Quest 브라우저에서 열어 주세요.', 'This device or browser does not support VR. Open this page in the Quest browser.'));
  $('vrBackGo').disabled = !VR_OK.ok;
}
function vrBtnUpdate() {   // PC 판: VR 기기에서 열면 VR 판으로 가는 버튼
  const b = $('msGoVR'); if (!b) return;
  b.classList.toggle('hidden', IS_VR || !VR_OK.ok || !window.SIM_VR_URL);
  b.textContent = L2('Quest VR 버전 열기', 'Open the Quest VR version');
}
if ($('msGoVR')) $('msGoVR').onclick = () => { if (window.SIM_VR_URL) location.href = window.SIM_VR_URL + (window.SIM_LANG === 'en' ? 'en.html' : ''); };
if ($('vrBackGo')) $('vrBackGo').onclick = () => vrStart();

setAirframe(SET.af); afUI(); menuSel(MENU.ms);
Object.assign(window.__sim, { VID, exportReplayVideo, RP, getLastRec: () => LAST_REC, VR_MAP, vrMenuOpen, commEngine, TTSW, commSpeak, VR_PIP_RT: VR_PIP.rt, ENV, XR, VRS, VR_MENU, VR_OSD, VR_SCR, VR_RT, vrMenuClick, vrMenuHit, vrStart, vrStop, xrInput, VR_OK, getXR: () => XR_ON, DAMS, MENU, menuSel, menuGo, menuTab, LY, lyEdit, lyApply, comm, grid, COMM, WIND, windAt, SAR, TRACK, RIDGE, FIRE, irSet, ENV, envApply, AF, setAirframe, MS, msObj, FLANE, RACE, RECON, STRIKE, effMode });
})();
