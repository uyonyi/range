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
  const o = Object.assign({}, m), dk = a.vmax[SET.diff] ? SET.diff : 'easy'; o.vmax = a.vmax[dk]; o.maxTilt = a.tilt[dk] * DEG;
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
// 임무 지도 범위: 그 임무에서 나올 수 있는 사건·구역 전부 + 출발점 ([down, side, 반지름])
function missionMapPts(kind, run) {   // run: 이번 비행에 정해진 위치만 (산불·수색·정찰·추적은 매번 다름)
  const P = [], add = (p, r) => { if (p) P.push([-p.z, p.x, r || 0]); }, st = startPos(); add(st, 30);
  if (run && kind === 'fire') { MS.list.forEach(f => { add(f.mk, 115); add(f.tp, 20); }); return P; }
  if (run && kind === 'sar' && SAR) { add(SAR.area, 125); add(SAR.tp, 70); add(SAR.pkP, 20); return P; }
  if (run && kind === 'recon') { MS.list.forEach(o => add(o.tp, 40)); return P; }
  if (run && kind === 'track' && TRACK) { for (let t = TRACK.s; t <= (TRACK.endS || TRACK.total); t += 40) add(trackPose(t).p, 30); return P; }
  if (kind === 'fire') FIRE.filter(f => flyL(f.tp) <= FLY_R_SAFE - 60).forEach(f => add(f.tp, 190));
  else if (kind === 'sar') SAR_POOL.forEach(([d, s]) => add(W(d, s, 0), 215));
  else if (kind === 'recon') RECON.forEach(r => add(r.tp, 30));
  else if (kind === 'strike') STRIKE.forEach(t => add(t.c, 30));
  else if (kind === 'race') RACE.forEach(r => add(r.c || r.mk, 20));
  else if (kind === 'ridge' && RIDGE) RIDGE.list.forEach(r => add(r.c || r.mk, 20));
  else if (kind === 'forest' && FLANE) FLANE.cps.forEach(c => add(W(c.q.d, c.q.s, 0), 20));
  else if (kind === 'track') { add(new V3(FLY_C.x, 0, FLY_C.z), FLY_R_SAFE); }
  return P;
}
function msStart(kind) {
  Object.values(MSG).forEach(g => g.visible = false);
  STRIKE.forEach(t => { t.col.off = true; t.dead = false; t.hull.material = t.hull.userData.m0 || t.hull.material; });
  if (FLANE) FLANE.G.visible = true;
  MS.idx = 0; S.photos = []; PH.lastSim = undefined; S.lost = 0; droneM.cans.forEach(c => c.visible = kind === 'sar'); S.kitErr = undefined; S.sarXY = null; S.hitsS = 0; S.errS = []; S.recT = 0; S.deadT = 0; S.running = true;
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
  try { const run = ['fire', 'sar', 'recon', 'track'].includes(kind); mapView('ms_' + kind, missionMapPts(kind, run), run); } catch (e) { mapView('course'); }
}
function msNext(msg, col) {
  const o = msObj(); if (!o) return;
  o.done = true; dbfObj(o.label, true); sfx('good'); showMsg(msg || (o.label + ' ✓'), col || '#5dff9a', 1.3);
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
  o.done = true; o.miss = true; dbfObj(o.label, false); sfx('bad'); showMsg(o.label + ' ✗ → NEXT', '#ff9a40', 1.3);
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
        if ((S.msNear === o && u > 0.5) || u > 0.85) { msSkip(); return; }
      }
    }
    const r = passCross(o, prev, cur);
    if (r === true) msNext(); else if (r === false && S.bumpT <= 0) { showMsg(L2('MISS · 다시 통과', 'MISS · fly through again'), '#ff9a40', 1); sfx('bad'); S.bumpT = 0.6; }
  } else if (o.t === 'fire') fireStep(cur, dt);
  else if (o.t === 'strikeAll') strikeAim(o, cur);
  else if (o.t === 'sarfind' || o.t === 'land' || o.t === 'track') scenStep(o, cur, dt);
  else if (o.t === 'recon') {
    const inView = sensorSees(o.tp, cur, AFc().reconD || 260);
    o.inView = inView; if (inView) o.seenT = S.simT;   // 사진은 직접 찍어 보고 (SPACE·Enter·📷·A·R트리거)
  }
}
// 센서 시야: 앞 화면 가운데 또는 아래 카메라(수직) 시야 안
const _sv = new V3();
function sensorSees(tp, cur, maxD) {
  maxD *= wxSense();
  const d = tp.distanceTo(cur), sp = toScreen(tp), x = sp.x / innerWidth * 2 - 1, y = 1 - sp.y / innerHeight * 2;
  const front = !sp.behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.92 && d > 3 && d < maxD;   // 화면에 보이면 (가장자리 조금 빼고)
  if (front) return true;
  const dy = cur.y - tp.y, h = Math.hypot(tp.x - cur.x, tp.z - cur.z);
  if (dy > 3 && dy < maxD && h < dy * 0.85) return true;   // 바로 아래 (아래 카메라)
  // 지금 켜져 있는 아래 카메라 화면(PC 작은 창 · VR 하부 카메라)에 보이면
  const lc = XR_ON && (SET.vrPip | 0) > 0 ? VR_PIP.cam : (typeof bellyMode === 'function' && bellyMode() !== null ? bellyCam : null);
  if (lc && d < maxD) { _sv.copy(tp).project(lc); if (_sv.z < 1 && Math.abs(_sv.x) < 0.95 && Math.abs(_sv.y) < 0.95) return true; }
  return false;
}
// ---- 사진 보고: 지금 카메라 화면을 작은 사진으로 (좌표·시각 표시) ----
const PH = { rt: null, lut: null, last: null, lastT: 0 };
// ---- 임무 후 브리핑: 점수(과제·시간·안전) · 비행 기록 · 벌점 내역 · 과제별 시간 ----
const DBF = { dist: 0, vmax: 0, altMax: 0, resp: 0, pens: [], objs: [], pen0: 0 };
function dbfStart() { Object.assign(DBF, { dist: 0, vmax: 0, altMax: 0, resp: 0, pens: [], objs: [], pen0: 0, flyT: 0 }); }
function dbfObj(label, ok) { if (S.state === 'run') DBF.objs.push({ label: String(label || ''), ok, t: S.t }); }
function dbfTick(dt) {
  if (S.state !== 'run' || !S.running) return;
  if (DR.alive && !DR.landed) { const v = DR.v.length(); DBF.dist += v * dt; DBF.vmax = Math.max(DBF.vmax, v); DBF.flyT += dt; DBF.altMax = Math.max(DBF.altMax, DR.p.y - groundAt(DR.p.x, DR.p.z)); }
  if (S.pen > DBF.pen0 + 0.01) { DBF.pens.push({ t: S.t, d: S.pen - DBF.pen0, why: S.lastMsg && S.t - (S.lastMsgT || 0) < 2 && /\+\s?\d+\s?(s|초)|MISS|IMPACT|SKIP|번짐|spread/i.test(S.lastMsg) ? S.lastMsg : (S.kind === 'fire' ? L2('불씨 번짐', 'fire spread') : '') }); DBF.pen0 = S.pen; }
}
function dbfScore(ok, n, par) {
  const total = S.t + S.pen, r = n ? ok / n : 1, tf = par > 0 ? clamp(par / Math.max(1, total), 0, 1) : 1, cf = Math.max(0, 1 - 0.1 * (S.impacts || 0) - 0.15 * DBF.resp - 0.2 * (S.lost || 0));
  const a = Math.round(55 * r), b = Math.round(30 * tf), c = Math.round(15 * cf), sc = a + b + c;
  return { sc, a, b, c, g: sc >= 90 ? 'S' : sc >= 80 ? 'A' : sc >= 65 ? 'B' : sc >= 50 ? 'C' : 'D', col: sc >= 90 ? '#ffc828' : sc >= 80 ? '#5dff9a' : sc >= 65 ? '#4fe3ff' : '#ff9a40', total, par };
}
function debriefShow(ok, n, par) {
  const R = dbfScore(ok, n, par); DBF.last = Object.assign({ ok, n }, R);
  const el = $('resScore'); if (el) el.innerHTML = `<span class="sc">${R.sc}</span><span class="gr" style="color:${R.col}">${R.g}</span><span class="pt">${L2('과제', 'Tasks')} ${R.a}/55 · ${L2('시간', 'Time')} ${R.b}/30 · ${L2('안전', 'Safety')} ${R.c}/15<br>${L2('합계', 'Total')} ${fmt(R.total)} · ${L2('기준', 'Par')} ${fmt(par || 0)}</span>`;
  const ln = (a, b, cls) => `<div class="ln"><span>${a}</span><span class="${cls || ''}">${b}</span></div>`;
  let h = `<h4>${L2('비행 기록', 'FLIGHT')}</h4>` + ln(L2('비행 거리', 'Distance'), (DBF.dist >= 1000 ? (DBF.dist / 1000).toFixed(2) + ' km' : DBF.dist.toFixed(0) + ' m')) + ln(L2('최고 속도', 'Top speed'), (DBF.vmax * 3.6).toFixed(0) + ' km/h') +
    ln(L2('평균 속도', 'Average speed'), (DBF.flyT > 1 ? DBF.dist / DBF.flyT * 3.6 : 0).toFixed(0) + ' km/h') + ln(L2('최고 고도 (지면 위)', 'Max height (AGL)'), DBF.altMax.toFixed(1) + ' m') +
    ln(L2('충돌 · 재출발', 'Impacts · restarts'), `${S.impacts || 0} · ${DBF.resp}`, (S.impacts || DBF.resp) ? 'bad' : 'ok');
  if (S.photos && S.photos.length) h += ln(L2('사진 (인정 / 전체)', 'Photos (valid / taken)'), `${S.photos.filter(p => p.ok).length} / ${S.photos.length}`);
  h += `<h4>${L2('벌점 내역', 'PENALTIES')} · +${S.pen.toFixed(0)} s</h4>` + (DBF.pens.length ? DBF.pens.map(p => ln(`${fmt(p.t)} ${p.why || L2('벌점', 'penalty')}`, '+' + p.d.toFixed(0) + ' s', 'bad')).join('') : `<div class="dim">${L2('없음', 'None')}</div>`);
  if (DBF.objs.length) { let pt = 0; h += `<h4>${L2('과제별 기록', 'TASKS')} · ${ok}/${n}</h4>` + DBF.objs.map((o, i) => { const s = ln(`${i + 1}. ${o.ok ? '✓' : '✗'} ${o.label}`, `${fmt(o.t)} <span class="dim">(+${(o.t - pt).toFixed(1)})</span>`, o.ok ? 'ok' : 'bad'); pt = o.t; return s; }).join(''); }
  const d = $('resDebrief'); if (d) d.innerHTML = h;
}
// ---- 항공(UAS)식 계기: 피치 사다리 · 속도/고도 테이프 · HSI(방위 원판 + 목표 방위 바늘 + 바람) ----
function hudMode() { const m = SET.hud || 'auto'; return m === 'auto' ? (AFc().cls === 'wing' ? 'uas' : 'fpv') : m; }
function uasDraw(g, W, H, sb, o, sIn, hsiY) {
  if (!sb || !sb.p) return;
  const GRN = '#7dffb0', CY = '#4fe3ff', DEGR = Math.PI / 180;
  const T = (t, x, y, sz, col, al) => { g.font = `700 ${sz}px system-ui, sans-serif`; g.textAlign = al || 'left'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(t, x, y); g.fillStyle = col || '#fff'; g.fillText(t, x, y); };
  const prj = p => { const q = p.clone().project(camera); return { x: (q.x + 1) / 2 * W, y: (1 - q.y) / 2 * H, ok: q.z < 1 && q.z > -1 }; };
  // 피치 사다리 (실제 수평선 기준 ±10·20·30°)
  const f = new V3(0, 0, -1).applyQuaternion(camera.quaternion); f.y = 0;
  if (f.lengthSq() > 1e-4) { f.normalize(); const r = new V3(-f.z, 0, f.x), c0 = camera.position, a = prj(c0.clone().addScaledVector(f, 1000).addScaledVector(r, -100)), b = prj(c0.clone().addScaledVector(f, 1000).addScaledVector(r, 100));
    if (a.ok && b.ok) { let ux = b.x - a.x, uy = b.y - a.y; const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L; g.strokeStyle = GRN; g.lineWidth = 2.5;
      for (let e = -30; e <= 30; e += 10) { const d = f.clone().multiplyScalar(Math.cos(e * DEGR)); d.y = Math.sin(e * DEGR); const c = prj(c0.clone().addScaledVector(d, 1000)); if (!c.ok || Math.abs(c.x - W / 2) > W * 0.42 || Math.abs(c.y - H / 2) > H * 0.4) continue;
        const w = e === 0 ? W * 0.22 : 70, gp = e === 0 ? 70 : 26; g.setLineDash(e < 0 ? [10, 8] : []); g.beginPath(); g.moveTo(c.x - ux * w, c.y - uy * w); g.lineTo(c.x - ux * gp, c.y - uy * gp); g.moveTo(c.x + ux * gp, c.y + uy * gp); g.lineTo(c.x + ux * w, c.y + uy * w); g.stroke(); g.setLineDash([]);
        if (e) { T(String(Math.abs(e)), c.x + ux * (w + 20), c.y + uy * (w + 20), 17, GRN, 'center'); T(String(Math.abs(e)), c.x - ux * (w + 20), c.y - uy * (w + 20), 17, GRN, 'center'); } }
      // 경사(뱅크) 표시: 수평선 기울기
      const bank = Math.atan2(uy, ux) / DEGR; if (Math.abs(bank) > 3) T((bank > 0 ? 'R ' : 'L ') + Math.abs(bank).toFixed(0) + '°', W / 2, H / 2 + 64, 18, GRN, 'center'); } }
  // 기체 기준 표시 (가운데 고정 W 모양)
  g.strokeStyle = '#ffc828'; g.lineWidth = 4; g.beginPath(); g.moveTo(W / 2 - 70, H / 2); g.lineTo(W / 2 - 26, H / 2); g.lineTo(W / 2 - 13, H / 2 + 13); g.lineTo(W / 2, H / 2); g.lineTo(W / 2 + 13, H / 2 + 13); g.lineTo(W / 2 + 26, H / 2); g.lineTo(W / 2 + 70, H / 2); g.stroke();
  // 테이프 (속도 왼쪽 · 고도 오른쪽)
  const tape = (x, val, ppu, step, lab, unit, side, dec) => {
    const h = 300, y0 = H / 2, w = 74, x0 = side < 0 ? x - w : x; g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(x0, y0 - h / 2, w, h); g.strokeStyle = GRN; g.lineWidth = 2; g.strokeRect(x0, y0 - h / 2, w, h);
    g.save(); g.beginPath(); g.rect(x0, y0 - h / 2, w, h); g.clip(); const r0 = Math.floor((val - h / 2 / ppu) / step) * step;
    for (let v = r0; v <= val + h / 2 / ppu; v += step) { const y = y0 - (v - val) * ppu, big = Math.round(v / step) % (lab / step) === 0, tx = side < 0 ? x : x0;
      g.strokeStyle = GRN; g.beginPath(); g.moveTo(tx, y); g.lineTo(tx - side * (big ? 16 : 9), y); g.stroke(); if (big && v >= 0) T(String(Math.round(v)), side < 0 ? x - 22 : x0 + 22, y, 17, GRN, side < 0 ? 'right' : 'left'); }
    g.restore();
    const bw = 92, bx = side < 0 ? x - bw - 4 : x0 + 4; g.fillStyle = '#071016'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.rect(bx, y0 - 20, bw, 40); g.fill(); g.stroke();
    T(val.toFixed(dec || 0), bx + bw / 2, y0, 26, '#fff', 'center'); T(unit, side < 0 ? x - w / 2 : x0 + w / 2, y0 - h / 2 - 16, 17, GRN, 'center'); };
  const sp = sb.v ? sb.v.length() : 0, agl = sb.p.y - groundAt(sb.p.x, sb.p.z), vs = sb.v ? sb.v.y : 0;
  tape(W / 2 - W * 0.2, sp * 3.6, 4, 5, 10, 'km/h', -1, 0);
  tape(W / 2 + W * 0.2, Math.max(0, agl), 12, 1, 5, 'AGL m', 1, 1);
  T((vs > 0.15 ? '▲ ' : vs < -0.15 ? '▼ ' : '■ ') + Math.abs(vs).toFixed(1) + ' m/s', W / 2 + W * 0.2 + 37, H / 2 + 170, 18, Math.abs(vs) > 3 ? '#ff9a40' : GRN, 'center');
  // HSI
  const hx = W / 2, hy = hsiY || H - 128, R = 92, hdg = ((((SITE.brg || 0) + (sb.h || 0) / DEGR) % 360) + 360) % 360, wdeg = v => (SITE.brg || 0) + Math.atan2(v.x, -v.z) / DEGR;
  g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(hx, hy, R + 8, 0, 7); g.fill(); g.strokeStyle = GRN; g.lineWidth = 2; g.stroke();
  for (let d = 0; d < 360; d += 5) { const a = (d - hdg - 90) * DEGR, big = d % 30 === 0, mid = d % 10 === 0, r1 = R - (big ? 14 : mid ? 9 : 5);
    g.strokeStyle = GRN; g.lineWidth = big ? 2.5 : 1.5; g.beginPath(); g.moveTo(hx + Math.cos(a) * R, hy + Math.sin(a) * R); g.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); g.stroke();
    if (big) T(({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' })[d] || String(d / 10), hx + Math.cos(a) * (R - 28), hy + Math.sin(a) * (R - 28), d % 90 === 0 ? 19 : 15, d === 0 ? '#ffc828' : GRN, 'center'); }
  g.fillStyle = '#ffc828'; g.beginPath(); g.moveTo(hx, hy - R - 2); g.lineTo(hx - 9, hy - R - 16); g.lineTo(hx + 9, hy - R - 16); g.closePath(); g.fill();   // 기수 표시
  g.fillStyle = '#071016'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.rect(hx - 34, hy - R - 50, 68, 30); g.fill(); g.stroke(); T(String(Math.round(hdg)).padStart(3, '0') + '°', hx, hy - R - 35, 20, '#fff', 'center');
  // 기체 모양 (원판 가운데)
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(hx, hy - 16); g.lineTo(hx, hy + 14); g.moveTo(hx - 14, hy - 2); g.lineTo(hx + 14, hy - 2); g.moveTo(hx - 6, hy + 12); g.lineTo(hx + 6, hy + 12); g.stroke();
  // 목표 방위 바늘 (수색 구역 안에서는 감춤)
  if (o && o.mk && !sIn) { const d = o.mk.clone().sub(sb.p), brg = ((wdeg(d) % 360) + 360) % 360, a = (brg - hdg - 90) * DEGR, dist = o.search ? Math.max(0, Math.hypot(d.x, d.z) - o.search.r) : Math.hypot(d.x, d.z);
    g.strokeStyle = CY; g.fillStyle = CY; g.lineWidth = 4; g.beginPath(); g.moveTo(hx - Math.cos(a) * (R - 18), hy - Math.sin(a) * (R - 18)); g.lineTo(hx + Math.cos(a) * (R - 22), hy + Math.sin(a) * (R - 22)); g.stroke();
    g.save(); g.translate(hx + Math.cos(a) * (R - 18), hy + Math.sin(a) * (R - 18)); g.rotate(a); g.beginPath(); g.moveTo(10, 0); g.lineTo(-10, -9); g.lineTo(-10, 9); g.closePath(); g.fill(); g.restore();
    T(L2('목표 ', 'TGT ') + String(Math.round(brg)).padStart(3, '0') + '°', hx - R - 22, hy - 14, 18, CY, 'right'); T((dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m'), hx - R - 22, hy + 12, 18, CY, 'right'); }
  // 바람 (불어오는 쪽에서 화살표)
  if (WIND.lv) { const wv = windAt(sb.p), ws = Math.hypot(wv.x, wv.z); if (ws > 0.3) { const from = ((wdeg(wv) + 180) % 360 + 360) % 360, a = (from - hdg - 90) * DEGR; g.strokeStyle = '#ff9a40'; g.lineWidth = 3; g.beginPath(); g.moveTo(hx + Math.cos(a) * (R + 20), hy + Math.sin(a) * (R + 20)); g.lineTo(hx + Math.cos(a) * (R - 40), hy + Math.sin(a) * (R - 40)); g.stroke();
    T(L2('바람 ', 'WIND ') + String(Math.round(from)).padStart(3, '0') + '° ' + ws.toFixed(0) + ' m/s', hx + R + 22, hy + 12, 17, '#ff9a40', 'left'); } }
  T('GS ' + (sp * 3.6).toFixed(0), hx + R + 22, hy - 14, 18, GRN, 'left');
}
// PC 화면: 겹쳐 그리는 캔버스 (가상 높이 720 기준으로 크기 맞춤)
function uasPC(sb, o) {
  let cv = $('uasHud'); const on = !XR_ON && hudMode() === 'uas' && (S.state === 'run' || S.state === 'replay' || S.state === 'demo') && S.cam === 0;
  document.body.classList.toggle('uas', on);
  if (!on) { if (cv) cv.style.display = 'none'; return; }
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'uasHud'; document.body.appendChild(cv); }
  cv.style.display = ''; const dpr = Math.min(2, devicePixelRatio || 1), Wp = innerWidth, Hp = innerHeight; if (cv.width !== Math.round(Wp * dpr) || cv.height !== Math.round(Hp * dpr)) { cv.width = Math.round(Wp * dpr); cv.height = Math.round(Hp * dpr); cv.style.width = Wp + 'px'; cv.style.height = Hp + 'px'; }
  const g = cv.getContext('2d'), s = Hp / 720 * dpr, VW = Wp / Hp * 720; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.setTransform(s, 0, 0, s, 0, 0);
  document.body.style.setProperty('--hsiH', Math.round(260 * Hp / 720) + 'px');
  uasDraw(g, VW, 720, sb, o, searchIn(o, sb.p), 720 - 150);
}
function photoMission() { return S.kind === 'fire' || S.kind === 'sar' || S.kind === 'recon' || S.kind === 'track'; }
// 투하 버튼이 하는 일: 코스·자유 = 투하 / 산불·정찰·추적·수색(찾기 전) = 사진 보고 / 그 밖 = 없음
function actionKind() {
  if (!isMission()) return AFc().drop ? 'drop' : 'none';
  if (S.kind === 'sar') { const o = msObj(); return o && o.t === 'sarkit' ? 'drop' : 'report'; }
  if (S.kind === 'fire' || S.kind === 'recon' || S.kind === 'track') return 'report';
  return 'none';
}
function snapPhoto(cap, tp) {
  try {
    const W0 = 384, H0 = 216; if (!PH.rt) { PH.rt = new THREE.WebGLRenderTarget(W0, H0); PH.lut = new Uint8Array(256); for (let i = 0; i < 256; i++) PH.lut[i] = Math.round(255 * Math.pow(i / 255, 1 / 2.2)); }
    const xe = renderer.xr.enabled, cur = renderer.getRenderTarget(), asp = camera.aspect; renderer.xr.enabled = false; camera.aspect = 16 / 9; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    PH.via = 'main'; let cam = camera;   // 목표가 화면 밖(바로 아래 등)이면 짐벌을 목표 쪽으로 돌려 찍음
    const seen = (c) => { const q = tp.clone().project(c); return q.z < 1 && q.z > -1 && Math.abs(q.x) < 0.8 && Math.abs(q.y) < 0.8; };
    if (tp && !seen(camera)) { const lc = XR_ON && (SET.vrPip | 0) > 0 ? VR_PIP.cam : (typeof bellyMode === 'function' && bellyMode() !== null ? bellyCam : null); if (lc && seen(lc)) { cam = lc; PH.via = 'lower'; } }
    if (tp && cam === camera && !seen(camera)) { PH.via = 'gimbal'; { cam = PH.cam || (PH.cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 4000)); cam.position.copy(DR.p).add(new V3(0, -0.15, 0)); cam.lookAt(tp); cam.updateMatrixWorld(); } }
    renderer.setRenderTarget(PH.rt); renderer.clear(); renderer.render(scene, cam); const px = new Uint8Array(W0 * H0 * 4); renderer.readRenderTargetPixels(PH.rt, 0, 0, W0, H0, px);
    renderer.setRenderTarget(cur); renderer.xr.enabled = xe; camera.aspect = asp; camera.updateProjectionMatrix();
    const c = document.createElement('canvas'); c.width = W0; c.height = H0; const g = c.getContext('2d'), id = g.createImageData(W0, H0), lin = PH.rt.texture.encoding !== THREE.sRGBEncoding;
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) { const s = ((H0 - 1 - y) * W0 + x) * 4, d = (y * W0 + x) * 4; for (let k = 0; k < 3; k++) id.data[d + k] = lin ? PH.lut[px[s + k]] : px[s + k]; id.data[d + 3] = 255; }
    g.putImageData(id, 0, 0);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, H0 - 34, W0, 34); g.fillStyle = '#ffc828'; g.font = '700 13px monospace'; g.fillText(cap[0] || '', 8, H0 - 19); g.fillStyle = '#fff'; g.font = '12px monospace'; g.fillText(cap[1] || '', 8, H0 - 5);
    g.textAlign = 'right'; g.fillStyle = '#9fe9ff'; g.fillText(({ main: L2('주 카메라', 'MAIN CAM'), lower: L2('하부 카메라', 'LOWER CAM'), gimbal: L2('짐벌 회전', 'GIMBAL') })[PH.via] || '', W0 - 8, H0 - 19); g.textAlign = 'left';
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.strokeRect(W0 / 2 - 30, H0 / 2 - 30, 60, 60);
    return c;
  } catch (e) { return null; }
}
function photoAdd(c, label, xy, ok) {
  if (!c) return; const url = c.toDataURL('image/jpeg', 0.82); (S.photos = S.photos || []).push({ url, label, xy, ok, t: S.t });
  const im = new Image(); im.src = url; PH.last = im; PH.lastOk = ok; PH.lastT = 3;
  let el = $('photoPop'); if (!el) { el = document.createElement('img'); el.id = 'photoPop'; el.style.cssText = 'position:fixed;right:14px;top:120px;width:220px;border-radius:8px;border:2px solid #5dff9a;z-index:40;box-shadow:0 4px 18px rgba(0,0,0,.5);transition:opacity .4s'; document.body.appendChild(el); }
  el.src = url; el.style.borderColor = ok ? '#5dff9a' : '#ff9a40'; el.style.opacity = 1; clearTimeout(PH.tm); PH.tm = setTimeout(() => { el.style.opacity = 0; }, 2600);
}
function missionPhoto() {
  if (!DR.alive) return;
  if (PH.lastSim !== undefined && Math.abs(S.simT - PH.lastSim) < 0.3) return; PH.lastSim = S.simT;   // 같은 버튼이 두 번 들어와도 한 장만
  flashPhoto(); sfx('drop');
  const now = new Date(), hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ' · ' + pilotName(), o = msObj();
  const xyS = (d, s) => { const xy = to5186(d, s); return xy ? `X ${xy[0].toFixed(0)}  Y ${xy[1].toFixed(0)}` : ''; };
  if (S.kind === 'fire') {
    const f = MS.list.find(x => x.active && !x.done && (x.inView || (ENV.ir && S.simT - (x.seenT ?? -9) < 1.5)));
    if (f) { comm('Control, Eagle One. Hotspot confirmed. Photo and grid sent.', '이글 원: 불씨 확인 · 사진과 좌표 전송', OP); const xy = to5186(f.d, f.s); photoAdd(snapPhoto([L2('불씨 확인 · 열화상', 'HOTSPOT · THERMAL') + '  ' + hm, xyS(f.d, f.s)], f.tp), f.label, xy, true); fireReport(f, xy); return; }
    const seen = MS.list.find(x => x.active && !x.done && x.seenVis);
    photoAdd(snapPhoto([L2('사진 · 확인 불가', 'PHOTO · UNCONFIRMED') + '  ' + hm, '']), '', null, false);
    showMsg(seen ? L2('연기는 찍혔지만 불씨 확인 불가 · 열화상(T)으로 다시', 'Smoke only · switch to thermal (T) and retake') : L2('사진에 불씨 없음 · 화면 가운데에 두고 찍기', 'No hotspot in frame · center it and retake'), '#ff9a40', 1.8); return;
  }
  if (S.kind === 'recon' && o && o.t === 'recon') {
    if (o.inView || S.simT - (o.seenT ?? -9) < 1.5) { comm('Control, Eagle One. Imagery sent.', '이글 원: 사진 전송', OP); photoAdd(snapPhoto([L2('정찰 사진', 'RECON IMAGE') + '  ' + hm, o.label.split(' · ')[0]], o.tp), o.label, to5186(o.d || 0, o.s || 0), true); msNext('PHOTO ✓ ' + o.label.split(' · ')[0], '#5dff9a'); return; }
    photoAdd(snapPhoto([L2('사진 · 대상 없음', 'PHOTO · NO TARGET') + '  ' + hm, '']), '', null, false); showMsg(L2('사진에 대상 건물 없음 · 화면 가운데(또는 아래 카메라)에 담고 다시', 'Target not in frame · center it and retake'), '#ff9a40', 1.8); return;
  }
  if (S.kind === 'track' && o && o.t === 'track') {
    const ok = !!o.inView; photoAdd(snapPhoto([(ok ? L2('추적 차량', 'TRACKED VEHICLE') : L2('사진', 'PHOTO')) + '  ' + hm, ''], ok && TRACK ? trackPose(TRACK.s).p : null), o.label, null, ok);
    if (ok) { comm('Control, Eagle One. Imagery sent.', '이글 원: 사진 전송', OP); showMsg(L2('차량 사진 보고 ✓', 'Vehicle photo reported ✓'), '#5dff9a', 1.4); } else showMsg(L2('사진에 차량 없음', 'Vehicle not in frame'), '#ff9a40', 1.4); return;
  }
  if (S.kind === 'sar' && o && o.t === 'sarfind') {
    if (o.inView || S.simT - (o.seenT ?? -9) < 1.5) { comm('Control, Eagle One. Subject located. Photo and grid sent.', '이글 원: 실종자 발견 · 사진과 좌표 전송', OP); const xy = to5186(SAR.d, SAR.s); S.sarXY = xy; photoAdd(snapPhoto([L2('실종자 발견', 'SUBJECT FOUND') + '  ' + hm, xyS(SAR.d, SAR.s)], SAR.tp), o.label, xy, true); msNext(xy ? `실종자 발견 · 사진 보고 ✓ X ${xy[0].toFixed(0)} · Y ${xy[1].toFixed(0)}` : '실종자 발견 · 사진 보고 ✓', '#5dff9a'); return; }
    photoAdd(snapPhoto([L2('사진 · 확인 불가', 'PHOTO · UNCONFIRMED') + '  ' + hm, '']), '', null, false);
    showMsg(L2('사진에 실종자 없음 · 가까이(열화상은 멀리서도) 화면 가운데에', 'No subject in frame · get closer (or use thermal) and center it'), '#ff9a40', 1.8); return;
  }
  photoAdd(snapPhoto([L2('사진', 'PHOTO') + '  ' + hm, '']), '', null, false);
}
function orderTick() {   // 휴대폰: 📻 버튼(눌러 펼치기) · PC·VR: 일시정지 메뉴에 표시
  { const po = $('pauseOrder'); if (po) { const t = ORDER.m ? ((window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en) : ''; po.style.display = t ? '' : 'none'; if (po.dataset.t !== t) { po.dataset.t = t; po.innerHTML = `<b>${L2('📻 마지막 명령', '📻 LAST ORDER')}</b>${t}`; } } }
  let el = $('orderBox'); const on = !!ORDER.m && S.state === 'run' && (isMission() || S.kind === 'course') && !XR_ON && IS_TOUCH;
  if (!el) { if (!on) return; el = document.createElement('div'); el.id = 'orderBox'; (ui.hud || document.body).appendChild(el); el.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); el.classList.toggle('open'); el.classList.remove('new'); }); }
  el.style.display = on ? '' : 'none'; if (!on) return; const t = (window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en; if (el.dataset.t !== t) { el.dataset.t = t; el.innerHTML = `<b>${L2('📻 명령', '📻 ORDER')}<i>▾</i></b><span>${t}</span>`; if (!el.classList.contains('open')) el.classList.add('new'); }
}
function actionUI() { const b = $('tbDrop'); if (!b) return; const k = S.state === 'run' ? actionKind() : 'drop', t = k === 'report' ? '📷 REPORT' : k === 'none' ? '—' : 'DROP'; if (b.dataset.k !== k) { b.dataset.k = k; b.textContent = t; b.style.borderColor = k === 'report' ? '#5dff9a' : ''; b.style.color = k === 'report' ? '#5dff9a' : ''; b.style.fontSize = k === 'report' ? '13px' : ''; } }
function photoTick(dt) { { const lb = $('tbLight'); if (lb) lb.classList.toggle('off', !lightOn()); } wxTick(dt); orderTick(); actionUI(); dbfTick(dt); try { uasPC(S.state === 'demo' ? ghostS : S.state === 'replay' ? RP.pose : DR, isMission() ? msObj() : curObj()); } catch (e) { } if (PH.lastT > 0) PH.lastT -= dt; const b = $('tbPhoto'); if (b) b.classList.add('hidden'); }   // 투하 버튼이 사진 보고를 겸함
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
    const a = AFc(), total = S.t + S.pen, nm = MS_NAME[S.kind]; if ($('resTitle')) $('resTitle').textContent = 'MISSION COMPLETE';
    ui.resSub.textContent = `${pilotName()} · ${nm} · ${a.name} · ${MODES[SET.diff].name}`;
    const G = msGrade(total), rows = [['비행 시간', fmt(S.t)], ['벌점', '+' + S.pen.toFixed(0) + ' s'], ['합계', fmt(total)], ['충돌', S.impacts + ' 회']];
    if (S.kind === 'strike') rows.push(['명중', S.hitsS + ' / ' + STRIKE.filter(t => !t.decoy).length], [L2('기만체 타격', 'Decoys hit'), (S.decoyHit || 0) + L2(' 대', '')], ['기체 손실(빗나감)', (S.lost || 0) + ' 대'], ['평균 오차', (S.errS.reduce((x, y) => x + y, 0) / Math.max(1, S.errS.length)).toFixed(1) + ' m']);
    else if (S.lost) rows.push(['기체 손실', S.lost + ' 대']);
    if (S.kind === 'sar' && S.sarXY) rows.push(['실종자 위치 (EPSG:5186)', S.sarXY[0].toFixed(0) + ', ' + S.sarXY[1].toFixed(0)]);
    if (S.kind === 'sar' && S.kitErr !== undefined) rows.push(['키트 오차', S.kitErr.toFixed(1) + ' m']);
    if (S.kind === 'track') rows.push(['추적 유지', S.trT.toFixed(0) + ' / ' + S.trWin.toFixed(0) + ' s'], [L2('최대 노출', 'Peak exposure'), Math.round(TRACK.susMax || 0) + '%'], [L2('발각', 'Spotted'), TRACK.burn ? L2('예 (-30)', 'yes (-30)') : L2('아니오', 'no')], ['판정', S.trackOK ? '성공' : '실패']);
    if (S.kind === 'ridge' && RIDGE) rows.push(['정상 해발', RIDGE.top.toFixed(0) + ' m']);
    if (S.kind === 'fire') (S.fireRep || []).forEach((xy, i) => xy && rows.push(['불씨 ' + (i + 1) + ' (EPSG:5186)', xy[0].toFixed(0) + ', ' + xy[1].toFixed(0)]));
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td></tr>`).join('');
    debriefShow(MS.list.filter(x => x.done && !x.miss).length, MS.list.length, MS.par || 0);
    const ph = (S.photos || []).filter(p => p.ok), rp = $('resPhotos');
    if (rp) { rp.style.display = ph.length ? 'flex' : 'none'; rp.innerHTML = ph.map((p, i) => `<figure><a href="${p.url}" download="report_${S.kind}_${i + 1}.jpg"><img src="${p.url}" alt=""></a>${L2('보고 ', 'Report ')}${i + 1}${p.xy ? ' · ' + p.xy[0].toFixed(0) + ', ' + p.xy[1].toFixed(0) : ''}</figure>`).join(''); }
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
  if (o && o.t === 'fire') h += o.inView ? `<div style="color:#5dff9a">● ${L2('불씨 포착 · Enter/📷 촬영', 'HOTSPOT · Enter/📷 to photo')}</div>` : o.seenVis ? '<div style="color:#9aa6ad">열화상(T)으로 확인</div>' : `<div style="color:#9aa6ad">${ENV.ir ? 'IR 수색 중' : '열화상 끔 · T'}</div>`;
  h += scenOsd(o);
  if (o && o.t === 'recon') h += `<div style="color:${o.inView ? '#5dff9a' : '#9aa6ad'}">${o.inView ? '● ' + L2('건물 포착 · SPACE/📷 보고', 'TARGET · SPACE/📷 to report') : L2('화면 가운데나 아래 카메라에 담기', 'Center it or use the lower camera')}</div>`;
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
if (!SET.tod) SET.tod = SET.night ? 'night' : 'day'; if (!SET.wx) SET.wx = 'clear';
const ENV = { night: SET.tod === 'night', dusk: SET.tod === 'dusk', wx: SET.wx, ir: false };
// 비·눈 오는 해질녘: 구름 낀 어두운 하늘 + 지평선에 흐린 주황 띠
const DUSK_WET_BG = (function () { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#24272f'); gr.addColorStop(0.45, '#45434b'); gr.addColorStop(0.64, '#7a6660'); gr.addColorStop(0.72, '#8c705e'); gr.addColorStop(1, '#3a3536'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
const SUN0 = SUN_DIR.clone(), DUSK_BG = (function () { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1d2a4a'); gr.addColorStop(0.42, '#6a4f72'); gr.addColorStop(0.62, '#e0875a'); gr.addColorStop(0.72, '#f3b06a'); gr.addColorStop(1, '#5a4636'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
const DAY0 = { sun: sun.intensity, sunC: sun.color.clone(), hs: hemi.color.clone(), hg: hemi.groundColor.clone(), fog: scene.fog.color.clone(), fn: scene.fog.near, ff: scene.fog.far };
const STARS = (function () {
  const n = 1400, p = new Float32Array(n * 3), r = rng(91);
  for (let i = 0; i < n; i++) { const u = r() * 2 * Math.PI, v = Math.acos(r() * 0.95), R = 2200; p[i * 3] = Math.sin(v) * Math.cos(u) * R; p[i * 3 + 1] = Math.cos(v) * R; p[i * 3 + 2] = Math.sin(v) * Math.sin(u) * R; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 2, sizeAttenuation: false, fog: false })); m.visible = false; scene.add(m); return m;
})();
function envHemi() { return ENV.ir ? 0.55 : ENV.night ? 0.3 : 0.5; }
function envApply() {
  const n = ENV.night, ir = ENV.ir, dk = ENV.dusk && !n, wx = ENV.wx || 'clear', wet = wx !== 'clear';
  // 해질녘: 낮은 서쪽 해·주황 하늘·긴 그림자 / 비·눈: 흐림(해 약하게)·안개 짙게
  SUN_DIR.copy(dk ? new V3(-0.86, 0.2, -0.34).normalize() : SUN0);
  sun.intensity = ir ? (n ? 0.15 : 0.6) : n ? 0.32 : dk ? 0.85 : DAY0.sun * (wet ? 0.45 : 1); sun.color.copy(n ? new THREE.Color(0x9fb4ff) : dk ? new THREE.Color(0xffa565) : wet ? new THREE.Color(0xdfe4ea) : DAY0.sunC);
  hemi.color.copy(n ? new THREE.Color(0x4a5f8a) : dk ? new THREE.Color(0x9a7a8e) : wet ? new THREE.Color(0xb9c2cc) : DAY0.hs); hemi.groundColor.copy(n ? new THREE.Color(0x0c0c10) : dk ? new THREE.Color(0x3a2a20) : DAY0.hg);
  const wxBg = wx === 'snow' ? 0xc9ced4 : 0x8e969e, bg = ir ? (n ? 0x0b0b0b : 0x2a2a2a) : n ? 0x05070d : dk ? 'dusk' : wet ? wxBg : null;
  sky.visible = bg === null; scene.background = bg === null ? null : bg === 'dusk' ? (wet ? DUSK_WET_BG : DUSK_BG) : new THREE.Color(bg);
  // 안개 색은 하늘보다 어둡게: 먼 산이 밝은 띠(눈 덮인 산처럼)로 뜨지 않고 어두운 능선 실루엣으로 겹쳐 보이게
  const fogC = bg === null ? DAY0.fog : bg === 'dusk' ? (wet ? 0x4f4a4e : 0x6a5662) : wx === 'rain' && !n && !ir ? 0x737b82 : bg;
  scene.fog.color.copy(fogC instanceof THREE.Color ? fogC : new THREE.Color(fogC));
  scene.fog.near = n ? 60 : wet ? 15 : dk ? 60 : DAY0.fn; scene.fog.far = n ? (wet ? 600 : 1100) : wx === 'snow' ? 330 : wx === 'rain' ? (dk ? 420 : 480) : dk ? 1300 : DAY0.ff;
  wxSetup();
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
  const smokeM = new THREE.MeshLambertMaterial({ color: 0xc4c0b8, transparent: true, opacity: 0.3, depthWrite: false, fog: false });
  const hotM = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), plumeM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
  const emberM = new THREE.MeshBasicMaterial({ color: 0xff7a22, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  const scorchM = new THREE.MeshBasicMaterial({ color: 0x14100c, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const flameM = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const flameM2 = new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const sparkM = new THREE.PointsMaterial({ color: 0xffa040, size: 0.35, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const FL_GEO = new THREE.ConeGeometry(1, 1, 7, 1, true).translate(0, 0.5, 0);
  for (let i = 0; i < 8; i++) {
    let q, d, s, tries = 0;
    do { q = PATHL.at(60 + r() * (PATHL.total - 100)); const off = (r() < 0.5 ? -1 : 1) * (45 + r() * 90); d = q.d - q.ts * off; s = q.s + q.td * off; tries++; }
    while (tries < 30 && (L.some(f => Math.hypot(f.d - d, f.s - s) < 70) || (FLANE && FLANE.clear.some(p => Math.hypot(p[0] - d, p[1] - s) < 10))));
    const c = W(d, s, 0), g = new THREE.Group(); g.position.copy(c); MSG.fire.add(g);
    const hot = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), hotM); hot.rotation.x = -Math.PI / 2; hot.position.y = 0.25; hot.userData.irOnly = true; hot.visible = false; g.add(hot);
    const pl = new THREE.Mesh(UCYL, plumeM); pl.scale.set(1.4, 16, 1.4); pl.position.y = 8; pl.userData.irOnly = true; pl.visible = false; g.add(pl);
    const em = new THREE.Mesh(USPH, emberM); em.scale.set(0.9, 0.35, 0.9); em.position.y = 0.3; g.add(em);
    // 발화점: 그을린 땅 + 일렁이는 불꽃 (숲 바닥에서 나무 높이까지) + 튀어 오르는 불티
    const sc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24), scorchM); sc.rotation.x = -Math.PI / 2; sc.position.y = 0.12; sc.renderOrder = 1; g.add(sc);
    const flames = []; for (let k = 0; k < 9; k++) { const fl = new THREE.Mesh(FL_GEO, k % 3 ? flameM : flameM2); const a = r() * 6.283, rr = k < 3 ? r() * 1.2 : 1 + r() * 2.8; fl.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); fl.userData.h = k < 3 ? 9 + r() * 6 : 3 + r() * 4; fl.userData.w = k < 3 ? 1.1 + r() * 0.7 : 0.6 + r() * 0.6; /* 가운데 3개는 나무 위로 솟는 불길 */ fl.userData.ph = r() * 6; g.add(fl); flames.push(fl); }
    const sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3)), sparkM); sparks.userData.s = Array.from({ length: 40 }, () => [r() * 6.283, r(), r()]); sparks.frustumCulled = false; g.add(sparks);
    const puffs = []; for (let k = 0; k < 14; k++) { const p = new THREE.Mesh(USPH, smokeM.clone()); p.userData.ph = k / 14; p.userData.j = r(); g.add(p); puffs.push(p); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff8a30, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.scale.set(9, 6, 1); glow.position.y = 2; glow.visible = false; g.add(glow);
    // 신고 지점: 실제 위치에서 조금 떨어진 곳 (수색 구역 반경 50 m)
    const ang = r() * 6.283, dist = 15 + r() * 25, area = W(d + Math.cos(ang) * dist, s + Math.sin(ang) * dist, 30);
    L.push({ kind: 'ms', t: 'fire', label: `불씨 ${i + 1} · 수색 구역 반경 50 m`, d, s, tp: c.clone().add(new V3(0, 0.6, 0)), mk: area, need: 1.2, g, em, puffs, glow, flames, sparks, sc, search: { r: 110 },
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
    if (f.flames) { const wv0 = windAt(f.g.position), lx = clamp(wv0.x * 0.06, -0.35, 0.35), lz = clamp(wv0.z * 0.06, -0.35, 0.35);
      for (const fl of f.flames) { const u = fl.userData, fk = 0.75 + 0.25 * Math.sin(envT * 11 + u.ph) * Math.sin(envT * 6.3 + u.ph * 2); fl.visible = !ENV.ir; fl.scale.set(u.w * (0.85 + 0.2 * fk), u.h * fk, u.w * (0.85 + 0.2 * fk)); fl.rotation.set(lz, u.ph, -lx); }
      const a = f.sparks.geometry.attributes.position.array, ss = f.sparks.userData.s; f.sparks.visible = !ENV.ir;
      for (let k = 0; k < ss.length; k++) { const q = ss[k], t = (envT * (0.35 + q[1] * 0.3) + q[2]) % 1; a[k * 3] = Math.cos(q[0] + t * 3) * (0.5 + t * 2) + wv0.x * t * 1.2; a[k * 3 + 1] = 1 + t * 14; a[k * 3 + 2] = Math.sin(q[0] + t * 3) * (0.5 + t * 2) + wv0.z * t * 1.2; }
      f.sparks.geometry.attributes.position.needsUpdate = true; f.sparks.material.opacity = 0.9; }
    // 연기 기둥: 바람 쪽으로 기울며 60 m 가까이 올라감 (멀리서도 보이는 단서)
    const wv = windAt(f.g.position.clone().setY(f.g.position.y + 30)), wl = Math.hypot(wv.x, wv.z), wx = wl > 0.1 ? wv.x / wl : 0.6, wz = wl > 0.1 ? wv.z / wl : 0.3, lean = 10 + wl * 5, big = f.spread ? 1.5 : 1;
    for (const p of f.puffs) { const u = (envT * 0.07 + p.userData.ph) % 1, j = p.userData.j; p.position.set(wx * lean * Math.pow(u, 1.4) * 2.2 + Math.sin(u * 7 + f.s + j * 6) * 2 * u, 1 + u * 58 * big, wz * lean * Math.pow(u, 1.4) * 2.2 + Math.cos(u * 5 + j * 6) * 2 * u); const k = (2 + u * 11) * big; p.scale.set(k, k * 0.85, k); p.material.opacity = (f.done ? 0.6 : 0.8) * Math.min(1, u * 5) * Math.pow(1 - u, 0.8) + 0.05; p.material.color.setHex(f.done ? 0x5f5b55 : 0xf6f4ef); p.visible = !ENV.ir && !ENV.night; }   // 새 신고 = 흰 연기 · 보고 끝 = 회색 연기
    if (f.glow) { f.glow.visible = ENV.night && !ENV.ir; f.glow.material.opacity = 0.55 + 0.35 * Math.sin(envT * 7 + f.d); f.glow.scale.set(9 * big, 6 * big, 1); }
  }
}
// ---- 날씨: 비(빗줄기)·눈(눈송이) 입자 · 드론 주변 상자 안에서만 내리고 따라다님 ----
const WX = { g: null, rain: null, snow: null, N: 2600, B: 46, H: 34 };
function wxSetup() {
  const wx = ENV.wx || 'clear';
  if (!WX.g) { WX.g = new THREE.Group(); WX.g.frustumCulled = false; scene.add(WX.g); }
  if (wx === 'rain' && !WX.rain) { const N = WX.N, pos = new Float32Array(N * 6); for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * WX.B, y = Math.random() * WX.H - WX.H / 2, z = (Math.random() - 0.5) * WX.B; pos.set([x, y, z, x, y - 0.7, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); WX.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c4d0, transparent: true, opacity: 0.45, depthWrite: false })); WX.rain.frustumCulled = false; WX.g.add(WX.rain); }
  if (wx === 'snow' && !WX.snow) { const N = WX.N, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) pos.set([(Math.random() - 0.5) * WX.B, Math.random() * WX.H - WX.H / 2, (Math.random() - 0.5) * WX.B], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); WX.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false })); WX.snow.frustumCulled = false; WX.g.add(WX.snow); }
  if (WX.rain) WX.rain.visible = wx === 'rain' && !ENV.ir; if (WX.snow) WX.snow.visible = wx === 'snow' && !ENV.ir;
}
// ---- 눈 쌓임: 위를 향한 면(땅·나무 윗면·지붕)을 하얗게 (쉐이더에 덧칠) ----
const SNOW_U = { value: 0 }, SNOW = { patched: false, k: 0 };
function snowify(m) {
  if (!m || m.userData.snowy || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial)) return; m.userData.snowy = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uSnow = SNOW_U;
    sh.vertexShader = 'varying float vSnowN;\n' + sh.vertexShader.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n  { vec3 snN = objectNormal;\n  #ifdef USE_INSTANCING\n  snN = mat3(instanceMatrix) * snN;\n  #endif\n  vSnowN = normalize(mat3(modelMatrix) * snN).y; }');
    sh.fragmentShader = 'uniform float uSnow; varying float vSnowN;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.83, 0.87), uSnow * smoothstep(0.45, 0.92, vSnowN));'); };
  const ck = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => ''; m.customProgramCacheKey = () => ck() + '|snow'; m.needsUpdate = true;
}
function snowPatch() {   // 처음 눈이 올 때 한 번: 장면의 지형·나무·건물 재질에 덧칠 (드론·하늘 제외)
  if (SNOW.patched) return; SNOW.patched = true;
  const skip = new Set(); [droneM && droneM.g, ghostM && ghostM.g, sky].forEach(o => o && o.traverse(c => skip.add(c)));
  scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && !skip.has(o) && o !== GRASS) (Array.isArray(o.material) ? o.material : [o.material]).forEach(snowify); });
}
function wxTick(dt) {
  // 눈: 몇 초에 걸쳐 쌓이고, 그치면 서서히 녹음 · 풀은 눈 속에 묻힘
  { const want = (ENV.wx === 'snow' && !ENV.ir) ? 1 : 0; if (want && !SNOW.patched) snowPatch(); SNOW.k += clamp(want - SNOW.k, -dt / 6, dt / 6); SNOW_U.value = SNOW.k * 0.85; if (typeof GRASS !== 'undefined' && GRASS) GRASS.visible = SNOW.k < 0.5; }
  if (!WX.g || (ENV.wx || 'clear') === 'clear') return;
  // 입자는 땅에 고정: 묶음은 드론을 따라가되, 드론이 움직인 만큼 입자를 반대로 옮김 -> 날아가면 비·눈이 스쳐 지나감
  const c = (S.state === 'replay' && RP.pose) ? RP.pose.p : DR.p;
  if (!WX.last) WX.last = c.clone();
  const dx = c.x - WX.last.x, dy = c.y - WX.last.y, dz = c.z - WX.last.z, jump = dx * dx + dy * dy + dz * dz > 400;   // 20 m 넘게 순간 이동(재시작 등)이면 그대로 둠
  if (!WX.vel) WX.vel = new V3();
  if (!jump && dt > 0) WX.vel.lerp(new V3(dx / dt, dy / dt, dz / dt), 1 - Math.exp(-dt * 12)); else WX.vel.set(0, 0, 0);
  WX.last.copy(c); WX.g.position.set(c.x, c.y, c.z);
  const mx = jump ? 0 : dx, my = jump ? 0 : dy, mz = jump ? 0 : dz;
  const wv = windAt(c), B = WX.B, H = WX.H, half = B / 2, hh = H / 2, t = performance.now() / 1000, dv = WX.vel;
  const wrap = (a, i) => { if (a[i] < -half) a[i] += B; else if (a[i] > half) a[i] -= B; };
  const wrapY = (a, i) => { if (a[i] < -hh) a[i] += H; else if (a[i] > hh) a[i] -= H; };
  if (WX.rain && WX.rain.visible) { const a = WX.rain.geometry.attributes.position.array, EXP = 0.045;
    for (let i = 0, j = 0; i < a.length; i += 6, j++) {
      const fall = 7.5 + (j % 9) * 0.25;   // 빗방울 낙하 속도 7.5~9.5 m/s
      a[i] += wv.x * dt - mx; a[i + 1] += -fall * dt - my; a[i + 2] += wv.z * dt - mz; wrap(a, i); wrapY(a, i + 1); wrap(a, i + 2);
      // 줄기 = 카메라가 본 상대 속도 × 노출 시간 (호버링: 수직 짧게, 전진: 앞에서 날아오듯 기울고 길게)
      let rx = wv.x - dv.x, ry = -fall - dv.y, rz = wv.z - dv.z; const L = Math.hypot(rx, ry, rz) * EXP, k = L > 2.2 ? 2.2 / L : 1;
      a[i + 3] = a[i] - rx * EXP * k; a[i + 4] = a[i + 1] - ry * EXP * k; a[i + 5] = a[i + 2] - rz * EXP * k;
    }
    WX.rain.geometry.attributes.position.needsUpdate = true; }
  if (WX.snow && WX.snow.visible) { const a = WX.snow.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { const k = i * 0.37; a[i] += (wv.x * 0.6 + Math.sin(t * 0.9 + k) * 0.5) * dt - mx; a[i + 2] += (wv.z * 0.6 + Math.cos(t * 0.7 + k) * 0.5) * dt - mz; a[i + 1] -= 1.1 * dt + my; wrapY(a, i + 1); wrap(a, i); wrap(a, i + 2); }
    WX.snow.geometry.attributes.position.needsUpdate = true; }
}
function setTod(v) { SET.tod = v; SET.night = v === 'night'; ENV.night = SET.night; ENV.dusk = v === 'dusk'; saveSet(); if (ENV.ir) irSet(false); envApply(); syncTime(); }
function setWxFx(on) { SET.wxFx = !!on; saveSet(); syncTime(); if (S.state === 'run') showMsg(on ? L2('기상 영향 켬 · 돌풍·시야 감소', 'Weather effects on · gusts, reduced visibility') : L2('기상 영향 끔', 'Weather effects off'), '#4fe3ff', 1.2); }
document.querySelectorAll('#segWxFx button').forEach(b => b.addEventListener('click', () => setWxFx(b.dataset.v === '1')));
function setWx(v) {
  if (v !== 'clear' && S.kind === 'fire' && (S.state === 'run' || S.state === 'pause')) { showMsg(L2('산불 감시 중에는 비·눈을 고를 수 없습니다', 'No rain or snow during a wildfire watch'), '#ff9a40', 1.6); syncTime(); return; }
  SET.wx = v; ENV.wx = v; saveSet(); envApply(); syncTime(); if (S.state === 'menu' && typeof menuSel === 'function' && MENU.ms) menuSel(MENU.ms);
}
document.querySelectorAll('#segWx button, #segWx2 button').forEach(b => b.addEventListener('click', () => setWx(b.dataset.v)));
document.querySelectorAll('#segTime button, #segTime2 button').forEach(b => b.addEventListener('click', () => setTod(b.dataset.v === '1' ? 'night' : b.dataset.v === '2' ? 'dusk' : 'day')));
document.querySelectorAll('#segNone').forEach(b => b.addEventListener('click', () => { SET.night = b.dataset.v === '1'; ENV.night = SET.night; saveSet(); envApply(); if (ENV.ir) { irSet(false); } syncTime(); }));
function syncExpo() { document.querySelectorAll('#segExpo button').forEach(x => x.classList.toggle('on', x.dataset.v === stickExpo(false))); }
document.querySelectorAll('#segExpo button').forEach(b => b.addEventListener('click', () => { SET.expo = b.dataset.v; saveSet(); syncExpo(); }));
syncExpo();
function syncHud() { document.querySelectorAll('#segHud button').forEach(x => x.classList.toggle('on', x.dataset.v === (SET.hud || 'auto'))); }
document.querySelectorAll('#segHud button').forEach(b => b.addEventListener('click', () => { SET.hud = b.dataset.v; saveSet(); syncHud(); }));
syncHud();
function syncTime() { const tv = SET.tod === 'night' ? '1' : SET.tod === 'dusk' ? '2' : '0'; document.querySelectorAll('#segTime button, #segTime2 button').forEach(x => x.classList.toggle('on', x.dataset.v === tv)); document.querySelectorAll('#segWx button, #segWx2 button').forEach(x => x.classList.toggle('on', x.dataset.v === (SET.wx || 'clear'))); document.querySelectorAll('#segWxFx button').forEach(x => x.classList.toggle('on', (x.dataset.v === '1') === !!SET.wxFx)); }
envApply(); syncTime();


// =====================================================================
//  바람 · 수색구조 · 차량 추적 · 능선 종주
// =====================================================================
// 바람: 서북서에서 불어옴. 높이(로그 분포)·능선 노출·돌풍 반영
const WIND = { lv: SET.wind || 0, dir: new V3(Math.sin(112 * DEG), 0, -Math.cos(112 * DEG)), t: 0 };
const _wv = new V3();
function wxFxOn() { return !!SET.wxFx && (ENV.wx === 'rain' || ENV.wx === 'snow'); }
// 기상 영향(옵션): 비·눈이면 바람이 없어도 돌풍이 불고, 가끔 강한 돌풍이 지나감 · 눈·카메라 탐지 거리 줄어듦
function wxSense() { return !wxFxOn() ? 1 : ENV.wx === 'snow' ? (ENV.ir ? 0.8 : 0.6) : (ENV.ir ? 0.85 : 0.72); }
function windAt(p) {
  const fx = wxFxOn(); if ((!WIND.lv && !fx) || !TER.h) return _wv.set(0, 0, 0);
  const base = Math.max(WIND.lv === 1 ? 3 : WIND.lv === 2 ? 7 : 0, fx ? (ENV.wx === 'snow' ? 3.5 : 2.5) : 0), g0 = terrainAt(p.x, p.z), agl = Math.max(0.5, p.y - g0);
  const prof = clamp(Math.log((agl + 1) / 0.4) / Math.log(40 / 0.4), 0.15, 1.25);
  const m = (terrainAt(p.x + 90, p.z) + terrainAt(p.x - 90, p.z) + terrainAt(p.x, p.z + 90) + terrainAt(p.x, p.z - 90)) / 4;
  const expo = clamp(1 + (g0 - m) / 45, 0.55, 1.6);
  const t = WIND.t, gf = fx ? 1.9 : 1, burst = fx ? Math.max(0, Math.sin(t * 0.13 + 1.7)) ** 12 * 1.4 : 0, gust = 1 + gf * (0.28 * Math.sin(t * 0.9 + p.x * 0.01) * Math.sin(t * 0.37) + 0.12 * Math.sin(t * 2.3 + p.z * 0.02)) + burst;
  const sw = 0.18 * Math.sin(t * 0.21);   // 방향 흔들림
  const c = Math.cos(sw), s = Math.sin(sw), dx = WIND.dir.x * c - WIND.dir.z * s, dz = WIND.dir.x * s + WIND.dir.z * c;
  const k = base * prof * expo * gust; return _wv.set(dx * k, 0, dz * k);
}
function windOsd(p) {
  if ((!WIND.lv && !wxFxOn()) || !TER.h) return '';
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
  // 등산객: 배낭에 기대 반쯤 누운 자세 · 한쪽 팔은 드론이 가까이 오면 흔듦
  const jacket = mat(0xd9541e, { roughness: 0.75 }), pants = mat(0x2d3640, { roughness: 0.9 }), skin = mat(0xc99a7a, { roughness: 0.8 }), boot = mat(0x3a2a1c, { roughness: 0.9 }), cap = mat(0x2a5d8a, { roughness: 0.8 }), packM = mat(0x3d5a3a, { roughness: 0.9 });
  const P = new THREE.Group(); P.rotation.z = 0.22; P.position.y = 0.05; g.add(P);   // 상체를 살짝 세움
  const put = (geo, m, x, y, z, sx, sy, sz, rz, rx) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); if (rz) me.rotation.z = rz; if (rx) me.rotation.x = rx; P.add(me); return me; };
  const torso = put(UCAP, jacket, 0.05, 0.2, 0, 0.17, 0.24, 0.13, Math.PI / 2);
  put(UCAP, jacket, 0.3, 0.24, 0, 0.12, 0.1, 0.18, Math.PI / 2);                 // 어깨
  put(UCYL, skin, 0.47, 0.24, 0, 0.05, 0.08, 0.05, Math.PI / 2);                 // 목
  const head = put(USPH, skin, 0.6, 0.25, 0, 0.11, 0.12, 0.1);
  put(USPH, cap, 0.63, 0.31, 0, 0.115, 0.07, 0.105, -0.5);                       // 모자
  for (const z of [-0.1, 0.1]) { put(UCAP, pants, -0.5, 0.11, z, 0.075, 0.36, 0.075, Math.PI / 2); put(UBOX, boot, -0.95, 0.13, z, 0.12, 0.16, 0.1); }
  put(UCAP, jacket, 0.08, 0.17, 0.2, 0.055, 0.22, 0.055, Math.PI / 2 + 0.3);     // 왼팔 (몸 옆)
  const arm = new THREE.Group(); arm.position.set(0.32, 0.27, -0.2); arm.rotation.z = Math.PI / 2 + 0.2; P.add(arm);
  { const u = new THREE.Mesh(UCAP, jacket); u.scale.set(0.055, 0.2, 0.055); u.position.y = 0.2; arm.add(u); const hnd = new THREE.Mesh(USPH, skin); hnd.scale.setScalar(0.05); hnd.position.y = 0.46; arm.add(hnd); }
  const pack = put(UBOX, packM, 0.38, 0.12, 0, 0.42, 0.32, 0.5);                 // 등 뒤 배낭 (베개처럼)
  put(UBOX, mat(0x6b6f52, { roughness: 0.9 }), 0.38, 0.3, 0, 0.36, 0.06, 0.46);  // 배낭 덮개
  { const pole = put(UCYL, mat(0x8c939a, { roughness: 0.4, metalness: 0.7 }), -0.2, 0.03, 0.55, 0.012, 1.1, 0.012, Math.PI / 2 - 0.15); pole.rotation.y = 0.5; }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.userData.heat = m.material === jacket || m.material === skin ? 0.85 : 0.5; } });
  const ang = r() * 6.283, area = W(d + Math.cos(ang) * 45, s + Math.sin(ang) * 45, 30);
  const pk = new THREE.Group(); { const b = new THREE.Mesh(UBOX, mat(0xe0b020, { roughness: 0.8 })); b.scale.set(0.45, 0.28, 0.32); b.position.y = 0.14; pk.add(b); const s2 = new THREE.Mesh(UBOX, mat(0x2d3640)); s2.scale.set(0.5, 0.05, 0.08); s2.position.y = 0.3; pk.add(s2); } MSG.sar.add(pk);
  const sig = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: false })); sig.scale.set(0.035, 0.035, 1); sig.visible = false; MSG.sar.add(sig);
  return { d, s, c, tp: c.clone().add(new V3(0, 0.3, 0)), area, g, pk, sig, pkP: new V3(), arm, wave: 0 };
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
  // SUV: 차체·보닛·실내(유리)·범퍼·그릴·바퀴(휠)·사이드미러·루프랙·번호판 · 앞쪽 = -z
  const body = mat(0x6a7783, { roughness: 0.42, metalness: 0.12 }), glass = mat(0x16222c, { roughness: 0.12, metalness: 0.3 }), tire = mat(0x121212, { roughness: 0.92 }),
    trim = mat(0x1b1d20, { roughness: 0.7 }), rim = mat(0x9aa2aa, { roughness: 0.35, metalness: 0.8 }), plate = mat(0xe8e8e0, { roughness: 0.6 });
  const add = (geo, m, x, y, z, sx, sy, sz, rx) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); if (rx) me.rotation.x = rx; me.castShadow = true; g.add(me); return me; };
  add(UBOX, body, 0, 0.78, 0.05, 1.86, 0.62, 4.5);                       // 아래 차체
  add(UBOX, body, 0, 1.0, -1.65, 1.8, 0.2, 1.1, 0.08);                  // 보닛 (살짝 기울게)
  add(UBOX, body, 0, 1.43, 0.45, 1.72, 0.62, 2.55);                     // 실내 상자
  add(UBOX, glass, 0, 1.43, 0.45, 1.74, 0.4, 2.3);                      // 옆 유리 띠
  add(UBOX, glass, 0, 1.38, -0.93, 1.62, 0.04, 0.72, -0.95);            // 앞 유리 (기울임)
  add(UBOX, glass, 0, 1.44, 1.73, 1.6, 0.46, 0.04);                     // 뒤 유리
  add(UBOX, body, 0, 1.76, 0.45, 1.7, 0.05, 2.45);                      // 지붕
  for (const x of [-0.68, 0.68]) add(UBOX, trim, x, 1.83, 0.45, 0.05, 0.06, 2.0);   // 루프랙
  add(UBOX, trim, 0, 0.55, -2.33, 1.92, 0.26, 0.22); add(UBOX, trim, 0, 0.55, 2.33, 1.92, 0.26, 0.22);   // 범퍼
  add(UBOX, trim, 0, 0.84, -2.31, 1.1, 0.26, 0.05);                     // 그릴
  add(UBOX, plate, 0, 0.56, -2.45, 0.52, 0.12, 0.02); add(UBOX, plate, 0, 0.72, 2.31, 0.52, 0.12, 0.02);
  for (const x of [-1.0, 1.0]) add(UBOX, trim, x, 1.25, -0.72, 0.16, 0.12, 0.08);   // 사이드미러
  for (const x of [-0.9, 0.9]) for (const z of [-1.45, 1.45]) {
    add(UBOX, trim, x * 1.02, 0.66, z, 0.06, 0.34, 1.0);                // 휠 아치
    const w = add(UCYL, tire, x, 0.37, z, 0.37, 0.27, 0.37); w.rotation.z = Math.PI / 2;
    const h = add(UCYL, rim, x * 1.06, 0.37, z, 0.22, 0.02, 0.22); h.rotation.z = Math.PI / 2;
  }
  // 등화: 전조등·후미등(브레이크등)은 빛나는 재질 + 밤에는 땅을 비추는 전조등 빛과 빛 줄기
  const headM = new THREE.MeshBasicMaterial({ color: 0x3a3a36, toneMapped: false }), tailM = new THREE.MeshBasicMaterial({ color: 0x3a0c0c, toneMapped: false });
  for (const x of [-0.64, 0.64]) { add(UBOX, headM, x, 0.9, -2.31, 0.42, 0.14, 0.05).castShadow = false; add(UBOX, tailM, x * 1.06, 0.95, 2.31, 0.34, 0.17, 0.05).castShadow = false; }
  add(UBOX, tailM, 0, 1.76, 1.72, 0.5, 0.04, 0.03).castShadow = false;   // 보조 제동등
  const headL = new THREE.SpotLight(0xfff0d0, 0, 75, 0.5, 0.55, 1.3); headL.position.set(0, 0.95, -2.4); headL.target.position.set(0, -0.6, -24); g.add(headL); g.add(headL.target);
  g.traverse(m => { if (m.isMesh && !m.material.isMeshBasicMaterial) m.userData.heat = m.material === tire ? 0.45 : m.material === trim ? 0.42 : 0.35; });
  const lights = { headM, tailM, headL, brk: 0, vPrev: 0 };
  return { P, cum, total: cum[cum.length - 1], g, s: 0, v: 8.5, lt: lights, sus: 0 };
})();
function trackPose(s) {
  const T = TRACK; let i = 1; while (i < T.cum.length - 1 && T.cum[i] < s) i++;
  const u = clamp((s - T.cum[i - 1]) / Math.max(1e-6, T.cum[i] - T.cum[i - 1]), 0, 1), a = T.P[i - 1], b = T.P[i];
  const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u; return { p: new V3(x, groundAt(x, z), z), h: Math.atan2(b.x - a.x, -(b.z - a.z)) };
}
// 차량 등화: 밤·해질녘·비에는 전조등 · 감속·정차 때 브레이크등 (출발 전에는 시동 꺼짐)
function trackLights(dt, running) {
  const T = TRACK, L = T && T.lt; if (!L) return;
  const dark = (ENV.night || ENV.dusk) && !ENV.ir, on = running && (dark || (ENV.wx && ENV.wx !== 'clear'));
  const dec = dt > 0 ? (L.vPrev - T.v) / dt : 0; L.vPrev = T.v;
  const brake = running && (T.v < 0.3 || dec > 0.6); L.brk += ((brake ? 1 : 0) - L.brk) * Math.min(1, dt * 10);
  L.headM.color.setHex(on ? 0xfff6dc : running ? 0x8a8a80 : 0x3a3a36);
  L.tailM.color.setRGB(0.23 + (on ? 0.35 : 0.05) + L.brk * 0.75, 0.04 + L.brk * 0.08, 0.04 + L.brk * 0.06);
  L.headL.intensity = on && dark ? (ENV.night ? 7 : 3.5) : 0;
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
  for (let i = 1; i < all.length; i++) { acc += Math.hypot(all[i][0] - all[i - 1][0], all[i][1] - all[i - 1][1]); const isTop = i === up.length - 1; if ((acc >= 100 && i < all.length - 6) || isTop) { cps.push({ q: { d: all[i][0], s: all[i][1], td: all[Math.min(all.length - 1, i + 1)][0] - all[i - 1][0], ts: all[Math.min(all.length - 1, i + 1)][1] - all[i - 1][1] }, top: isTop }); acc = 0; } }
  cps.forEach(c => { const l = Math.hypot(c.q.td, c.q.ts) || 1; c.q.td /= l; c.q.ts /= l; });
  const g = new THREE.Group(); MSG.ridge = MSG.ridge || new THREE.Group(); scene.add(MSG.ridge); MSG.ridge.visible = false; MSG.ridge.add(g);
  const list = cps.map((c, i) => { const cp = passCP(c.top ? `정상 (해발 ${(mx + SITE.base).toFixed(0)} m)` : '능선 ' + (i + 1), c.q, 0, 15, 15, 4); cp.q = c.q; cp.alt = 15;
    const tor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 40), mat(c.top ? 0xff4d4d : 0x4fe3ff, { emissive: c.top ? 0x330000 : 0x002233, roughness: 0.4 })); g.add(tor); cp.mesh = tor; return cp; });
  const flag = new THREE.Mesh(UBOX, mat(0xff4d4d)); const tw = W(ds(top % n, (top / n) | 0)[0], ds(top % n, (top / n) | 0)[1], 0); flag.position.copy(tw).add(new V3(0, 3, 0)); flag.scale.set(0.08, 6, 0.08); g.add(flag);
  return { list, top: mx + SITE.base, len: all.length * st };
})();
function scenStart(kind, a) {
  ['sar', 'track', 'ridge'].forEach(k => MSG[k] && (MSG[k].visible = false)); if (STREES.unscorch) STREES.unscorch();
  if (kind === 'sar' && SAR) {
    MSG.sar.visible = true; SAR.kit = null; sarRandom();
    S.kits = 2; SAR.pkFound = false;
    const L = [{ kind: 'ms', t: 'sarfind', label: L2('실종자 수색 · 구역 반경 120 m', 'Find the hiker · area radius 120 m'), tp: SAR.tp, mk: SAR.area, search: { r: 120 }, need: 1.5, pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y))]; } }];
    if (a.drop) L.push({ kind: 'ms', t: 'sarkit', label: '구조 키트 투하 (5 m 이내)', mk: SAR.c.clone().add(new V3(0, 8, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } });
    if (a.cls === 'wing') L.push(passCP('복귀 · 출발점 상공 통과', { d: BY.pad_start.down, s: BY.pad_start.side, td: 1, ts: 0 }, 0, 35, 35, 14));
    else L.push({ kind: 'ms', t: 'land', label: '출발 패드로 복귀 · 착륙', mk: startPos().add(new V3(0, 1.5, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } });
    return L;
  }
  if (kind === 'track' && TRACK) {
    MSG.track.visible = true; TRACK.go = false; S.trT = 0; S.trWin = 0; trackRandom();
    const p0 = trackPose(TRACK.s); TRACK.g.position.copy(p0.p); TRACK.g.rotation.y = -p0.h;
    TRACK.sus = 0; TRACK.susMax = 0; TRACK.warn = false; TRACK.burn = false; TRACK.lt.vPrev = 0; trackLights(0, false);
    const L = [{ kind: 'ms', t: 'track', label: L2('차량 추적 · 들키지 말고 60초 관측', 'Vehicle track · 60 s unseen'), mk: p0.p.clone().add(new V3(0, 12, 0)), need: 60, pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y))]; } }];
    if (a.cls === 'wing') L.push(passCP('복귀 · 출발점 상공 통과', { d: BY.pad_start.down, s: BY.pad_start.side, td: 1, ts: 0 }, 0, 35, 35, 14));
    else L.push({ kind: 'ms', t: 'land', label: '출발 패드로 복귀 · 착륙', mk: startPos().add(new V3(0, 1.5, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } });
    return L;
  }
  if (kind === 'ridge' && RIDGE) {
    MSG.ridge.visible = true; const k = a.cls === 'wing' ? 2.2 : 1;
    RIDGE.list.forEach(r => { r.ring = 6 * k; const al = a.cls === 'wing' ? 38 : 18; r.c = W(r.q.d, r.q.s, al); r.mk = r.c.clone(); r.mesh.position.copy(r.c); r.mesh.scale.setScalar(6 * k); r.mesh.lookAt(r.c.clone().add(r.n)); });
    return RIDGE.list;
  }
  return null;
}
function scenStep(o, cur, dt) {
  if (o.t === 'sarfind') {
    const d = o.tp.distanceTo(cur), vis = sensorSees(o.tp, cur, ENV.ir ? (AFc().reconD || 260) * 0.8 : (ENV.night ? (lightOn() ? 40 : 18) : 75));
    o.inView = vis; if (vis) o.seenT = S.simT;
  } else if (o.t === 'land') {
    const pad = startPos(); if (DR.landed && Math.hypot(DR.p.x - pad.x, DR.p.z - pad.z) < 2.5) msNext('착륙 ✓', '#5dff9a');
  } else if (o.t === 'track') {
    const T = TRACK, vp = trackPose(T.s);
    if (!T.go && cur.distanceTo(vp.p) < 220) { T.go = true; showMsg('차량 출발 · 추적 시작', '#ffc828', 1.6); comm(`${CS}, target is moving. You have the eye, keep it.`, '표적 차량 이동 시작 · 관측 유지'); }
    const tp = vp.p.clone().add(new V3(0, 1, 0)), dd = cur.distanceTo(tp), see = sensorSees(tp, cur, 320);
    o.close = dd < 25; o.inView = see && !o.close;
    if (T.go) { S.trWin += dt; if (o.inView) S.trT += dt; }
    // 들킴: 운전자 시야(차 앞쪽 ±40°), 가까움, 낮은 고도(프로펠러 소리)일수록 빨리 참 · 안전하면 서서히 내려감
    if (T.go) {
      const fx = Math.sin(vp.h), fz = -Math.cos(vp.h), rx = cur.x - vp.p.x, rz = cur.z - vp.p.z, dh = Math.hypot(rx, rz), hy = cur.y - vp.p.y, front = dh > 1 ? (rx * fx + rz * fz) / dh : 0;
      // 운전자 시야: 앞유리(정면 ±50°, 올려다보는 각 35° 아래, 200 m 안) > 옆 유리(±50~110°, 25° 아래, 100 m 안)
      const el = Math.atan2(Math.max(0, hy), Math.max(1, dh)) / DEG; let r = 0; o.seen = false;
      if (front > 0.64 && el < 35 && dh < 200) { r += 45 * (1 - dh / 200) + 10; o.seen = true; }
      else if (front > -0.34 && el < 25 && dh < 100) { r += 15 * (1 - dh / 100); o.seen = true; }
      if (dd < 60) r += (60 - dd) * 1.5;                       // 가까우면 소리·모습
      if (hy < 35 && dh < 100) r += (35 - Math.max(0, hy)) * 0.8;   // 낮으면 프로펠러 소리
      if (ENV.night) r *= lightOn() ? 1.5 : 0.6;               // 밤: 조명을 켜면 훨씬 잘 보임
      if (ENV.wx === 'rain') r *= 0.75;
      T.sus = clamp(T.sus + (r * 0.55 - 6) * dt, 0, 100); T.susMax = Math.max(T.susMax || 0, T.sus);
      if (!T.warn && T.sus >= 45) { T.warn = true; sfx('bad'); showMsg(L2('노출 주의 · 거리를 벌릴 것', 'Exposure · back off'), '#ff9a40', 1.6); comm(`${CS}, CONTROL. Driver is looking around. Back off and increase your standoff.`, '운전자가 주변을 살핌 · 뒤로 빠져 거리 넓힐 것'); }
      if (T.warn && T.sus < 20) T.warn = false;
      if (T.sus >= 100 && !T.burn) {
        T.burn = true; S.trackOK = false; S.pen += 30; T.base *= 1.7; T.stops = []; T.stopT = 0;
        comm(`${CS}, you have been spotted. Target is evading. Break off and RTB.`, '발각됨 · 표적 도주 · 추적 중단하고 복귀');
        o.done = true; o.miss = true; dbfObj(o.label, false); sfx('bad'); showMsg(L2('발각 · 추적 실패 (-30) · 복귀', 'SPOTTED · track failed (-30) · RTB'), '#ff6060', 2.4);
        MS.idx++; while (MS.list[MS.idx] && MS.list[MS.idx].done) MS.idx++; S.recT = 0; renderList(); if (MS.idx >= MS.list.length) msFinish();
        return;
      }
    }
    o.mk.copy(vp.p).add(new V3(0, 12, 0));
    if (S.trT >= o.need) { S.trackOK = true; comm('Good track, we have what we need. Break off and RTB.', '추적 완료 · 이탈 후 복귀'); msNext(`추적 성공 · ${S.trT.toFixed(0)}초 / ${S.trWin.toFixed(0)}초`, '#5dff9a'); }
    else if (T.s >= (T.endS || T.total) - 1) { S.trackOK = false; msNext(`차량 도착 · 추적 ${S.trT.toFixed(0)}초 (부족)`, '#ff9a40'); }
  }
}
function scenTick(dt) {
  photoTick(dt); WIND.t += dt; msEvents(dt); commTick(dt); if (S.kind === 'sar') sarClues(dt, DR.p);
  if (TRACK && MSG.track && MSG.track.visible && TRACK.go && S.state === 'run') {
    TRACK.s = Math.min(TRACK.endS || TRACK.total, TRACK.s + TRACK.v * dt); const vp = trackPose(TRACK.s), ah = trackPose(Math.min(TRACK.total, TRACK.s + 3));
    TRACK.g.position.copy(vp.p); TRACK.g.rotation.y = -vp.h; TRACK.g.rotation.x = Math.atan2(ah.p.y - vp.p.y, 3) * 1;
  }
  if (TRACK && MSG.track && MSG.track.visible) trackLights(S.state === 'pause' ? 0 : dt, !!TRACK.go);
  if (S.kind === 'sar' && SAR) sarWave(dt);
}
// 조난자: 드론이 70 m 안에 오면 팔을 들어 흔듦 (발견 뒤에도 계속)
function sarWave(dt) {
  if (!SAR || !SAR.arm || !MSG.sar || !MSG.sar.visible) return;
  const near = S.state === 'run' && DR.p.distanceTo(SAR.c) < 70; SAR.wave += ((near ? 1 : 0) - SAR.wave) * Math.min(1, dt * 2.5);
  const t = performance.now() / 1000, w = SAR.wave;
  SAR.arm.rotation.z = (Math.PI / 2 + 0.2) * (1 - w) + 0.15 * w; SAR.arm.rotation.x = w * Math.sin(t * 7) * 0.55;
}
// 구조 키트가 땅에 닿았을 때
function sarKit(pos) {
  const o = msObj(); if (!o || o.t !== 'sarkit') return false;
  const e = Math.hypot(pos.x - SAR.c.x, pos.z - SAR.c.z); S.kitErr = e;
  if (e <= 5) { comm('Control, Eagle One. Kit away.', '이글 원: 키트 투하 완료', OP); msNext(`키트 전달 ✓ ${e.toFixed(1)} m`, '#5dff9a'); } else if ((S.kits | 0) > 0) { showMsg(`키트 ${e.toFixed(1)} m · 5 m 안으로 다시 (남은 ${S.kits}개)`, '#ff9a40', 1.6); sfx('bad'); } else { S.pen += 30; msSkip(); }
  return true;
}
function scenOsd(o) {
  if (!o) return '';
  if (o.t === 'sarfind') return `<div style="color:${o.inView ? '#5dff9a' : '#9aa6ad'}">${o.inView ? '● ' + L2('실종자 포착 · Enter/📷 촬영', 'SUBJECT · Enter/📷 to photo') : ENV.ir ? 'IR 수색 중' : '숲 아래는 열화상(T)'}</div>`;
  if (o.t === 'track') { const su = Math.round(TRACK.sus || 0), sc = su >= 70 ? '#ff6060' : su >= 40 ? '#ff9a40' : '#5dff9a';
    return `<div style="color:${o.inView ? '#5dff9a' : o.close ? '#ff9a40' : '#9aa6ad'}">TRACK ${S.trT.toFixed(0)}/${o.need}s${o.close ? ' · 너무 가까움' : o.inView ? ' ●' : TRACK.go ? ' · 시야 밖' : ' · 접근하면 출발'}</div>`
      + `<div style="color:${sc}">${L2('노출', 'EXPOSURE')}${o.seen ? L2(' · 운전자 시야', ' · in view') : ''} <span style="display:inline-block;width:70px;height:7px;background:rgba(255,255,255,.15);vertical-align:middle"><i style="display:block;height:100%;width:${su}%;background:${sc}"></i></span> ${su}%</div>`; }
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
  const ok = RECON.filter(r => flyL(r.tp) <= FLY_R_SAFE), pool = ok.length >= 4 ? ok : RECON.slice().sort((a, b) => flyL(a.tp) - flyL(b.tp));
  const L = nearOrder(shuffle(pool).slice(0, Math.min(4, pool.length)), startPos());
  L.forEach((o, i) => { o.label = `정찰 ${i + 1} · 건물 (${o.wl})`; o.done = false; }); return L;
}
// 산불: 후보 8곳 중 5곳, 3곳은 처음부터 · 2곳은 나중에 신고
function firePick() {
  MSG.fire.visible = true; S.fireRep = [];
  FIRE.forEach(f => { f.on = false; f.g.visible = false; f.done = false; f.spread = false; });
  const P = shuffle(FIRE.filter(f => flyL(f.tp) <= FLY_R_SAFE - 60)).slice(0, 4), when = [0, 1e9, 1e9, 1e9];   // 한 곳씩: 보고하면 다음 신고
  P.forEach((f, i) => { f.on = true; f.ignT = when[i] + i * 0.05; f.active = false; f.g.visible = false; f.recT = 0; f.g.scale.setScalar(1);
    for (let t = 0; t < 24; t++) { const ang = Math.random() * 6.283, dist = 35 + Math.random() * 45; f.mk = W(f.d + Math.cos(ang) * dist, f.s + Math.sin(ang) * dist, 30); if (flyL(f.mk) <= FLY_R - 120) break; } f.search = { r: 110 };
    f.label = L2(`연기 신고 ${i + 1} · 수색 구역 반경 110 m`, `Smoke report ${i + 1} · search radius 110 m`); });
  return P;
}
function fireReport(f, xy) {   // 사진으로 보고한 불씨 처리 · 다음 신고는 몇 초 뒤 새로 피어오름
  f.done = true; dbfObj(f.label, true); S.fireRep.push(xy); sfx('good'); commAck(f, 'fire');
  showMsg(xy ? `불씨 사진 보고 ✓ X ${xy[0].toFixed(0)} · Y ${xy[1].toFixed(0)}` : '불씨 사진 보고 ✓', '#ffb070', 1.8);
  const nx = MS.list.find(x => !x.active && !x.done); if (nx) nx.ignT = MS.t0 + 5 + Math.random() * 6;
  MS.idx = MS.list.findIndex(x => !x.done); if (MS.idx < 0) { MS.idx = MS.list.length; msFinish(); } renderList();
}
function fireStep(cur, dt) {
  for (const f of MS.list) {
    if (f.done || !f.active) continue;
    const vis = sensorSees(f.tp, cur, (AFc().reconD || 260) * 0.8);
    f.inView = vis && ENV.ir; f.seenVis = vis && !ENV.ir; if (f.inView) f.seenT = S.simT;
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
  if (kind === 'fire') return 260;
  if (kind === 'strike') return 150;
  if (kind === 'sar') return 220;
  if (kind === 'track') return 150;
  return 180;
}
function msGrade(total) {
  if (S.kind === 'track') return S.trackOK ? { g: S.trT / Math.max(1, S.trWin) > 0.8 && (TRACK.susMax || 0) < 45 ? 'S' : 'A', c: '#5dff9a' } : { g: TRACK.burn ? 'D' : 'C', c: '#ff6060' };
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
  fire: ['Wildfire watch', 'Smoke reports come in by radio with a bearing and a rough distance. Only a wide search area is marked, not the fire itself.', 'One report at a time: find the smoke column (it leans with the wind; at night look for the glow), switch to thermal (T), center the hotspot and press Enter / 📷 / A to photograph it. Report it and the next one comes in. After 150 s a fire spreads (+15 s).'],
  sar: ['Search & rescue', 'A hiker is missing near the trails. Only a wide search area is marked; the location changes every run.', 'Clues: his yellow pack near where he went missing, signal-mirror flashes (a flashlight at night), and body heat in thermal under the canopy. Center him and press Enter / 📷 / A to photograph and report. 2 rescue kits: drop one within 5 m.'],
  track: ['Vehicle tracking', 'Keep a car on a real road in view for 60 s without being spotted.', 'Being in the driver\'s view (ahead, low angle), close or low fills the exposure gauge; when it is full you are spotted (fail, -30, RTB). Stay behind it and high. At night turn your light off (L) to stay hidden.'],
  ridge: ['Ridge run', 'Climb to the summit along a DEM-derived ridge and come down another ridge.', 'Ridges are windy. Pass the rings in order.']
} : {
  forest: ['숲 속 좁은 길', '주 경로 옆 숲 속에 낸 좁은 길을 따라 게이트·좁은 틈·쓰러진 나무를 지나 결승까지.', '나무 사이는 2~3 m. 수관 아래(지면 3 m 이하)로 낮게 날 것.'],
  race: ['계곡 타임 레이스', '계곡을 따라 놓인 링을 순서대로 최단 시간에 통과.', '부스트(BST)로 기체 최고 속도까지. 링을 빗나가면 되돌아와 다시 통과.'],
  recon: ['건물 정찰', '수치지형도에 있는 실제 건물 중 무작위 4곳을 찾아 촬영.', '건물을 화면 가운데나 아래 카메라에 1.5초 담기. 매번 대상이 바뀜.'],
  strike: ['차량 표적 타격', '차량 5대 중 실물은 3대, 나머지 2대는 기만체. 실물만 골라 돌입.', '가시광으로는 똑같음. 열화상(T)에서 엔진 열이 있는 차량이 실물. 기만체를 치면 +20초.'],
  fire: ['산불 감시', '무전으로 연기 신고가 방위·대략 거리로 들어옴. 지도에는 넓은 수색 구역만 표시되고 불 위치는 안 나옴.', '한 번에 한 곳씩: 바람에 기우는 연기 기둥(밤에는 불빛)을 찾아가 열화상(T)으로 불씨를 화면 가운데에 두고 Enter·📷·A 버튼으로 사진 보고. 보고하면 다음 신고가 들어옴. 150초가 지나면 번져서 +15초.'],
  sar: ['실종자 수색·구조', '등산로 근처 실종자 신고. 지도에는 넓은 수색 구역만 표시, 위치는 매번 다름.', '단서: 근처에 떨어진 노란 배낭, 신호 거울 반짝임(밤에는 손전등), 숲 아래 체온(열화상). 찾으면 화면 가운데에 두고 Enter·📷·A 버튼으로 사진 보고. 구조 키트 2개 · 5 m 안에 투하.'],
  track: ['차량 추적', '실제 도로를 달리는 차량을 들키지 않고 60초 동안 시야에 유지.', '운전자 시야(차 앞쪽·낮은 각도)·근접·저고도면 노출 게이지가 차고, 가득 차면 발각(실패·-30·복귀). 차 뒤쪽 높이 유지 권장. 밤에는 드론 조명을 끄면(L) 덜 들킴.'],
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
      if (!f.active && t >= f.ignT) { f.active = true; f.g.visible = true; if (STREES.scorch) STREES.scorch(f.g.position, 9); const bd = fromLaunch(f.mk); comm(`${f.ignT > 1 ? 'New report. ' : ''}Smoke sighted, bearing ${bd.brgW}, about ${bd.distW} meters from launch point.`, `${f.ignT > 1 ? '새 신고 · ' : ''}연기 목격 · 방위 ${bd.brg}° · 출발점에서 약 ${bd.dist} m (지도 구역)`); if (f.ignT > 1) comm('Eagle One, wilco.', '이글 원, 수행하겠음.', OP); renderList(); if (MS.idx >= MS.list.length || MS.list[MS.idx].done) MS.idx = i; }
      if (f.active && !f.done && !f.spread && t - f.ignT > 150) { f.spread = true; S.pen += 15; comm(`${CS}, hotspot ${i + 1} is spreading. Expedite your report.`, `불씨 ${i + 1} 번짐 · +15초`); f.g.scale.setScalar(1.8); }
    }
  }
  if (S.kind === 'sar') {
    const o = msObj();
    if (o && o.t === 'sarfind') {
      if (!MS.h1 && t > 70) { MS.h1 = true; if (o.search.r > 60) { sarNarrow(o, 60, 25 + Math.random() * 10); comm(`${CS}, CONTROL. Witness report, subject within six zero meters of the new marked area. Over.`, '목격 제보 · 수색 구역 반경 60 m로 좁힘'); } }
      if (!MS.h2 && t > 150) { MS.h2 = true; if (o.search.r > 25) { sarNarrow(o, 25, 8 + Math.random() * 6); comm('Phone ping narrows it to two five meters. Look under the canopy, use thermal.', '휴대전화 위치 · 반경 25 m, 열화상으로 수관 아래 확인'); } }
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
  for (const a of VEC.trail) for (let i = 0; i < a.length; i += 6) { const d = a[i], s = a[i + 1], dist = Math.hypot(d - st.down, s - st.side); if (dist > 220 && dist < 520 && INB(d, s) && flyL(W(d, s, 0)) <= 470 && !P.some(p => Math.hypot(p[0] - d, p[1] - s) < 90)) P.push([d, s]); }
  return P.length ? P : [[SAR.d, SAR.s]];
})();
function sarRandom() {
  const q = SAR_POOL[Math.floor(Math.random() * SAR_POOL.length)], d = q[0] + (Math.random() - 0.5) * 12, s = q[1] + (Math.random() - 0.5) * 12, c = W(d, s, 0);
  SAR.d = d; SAR.s = s; SAR.c.copy(c); SAR.tp.copy(c).add(new V3(0, 0.3, 0)); SAR.g.position.copy(c); SAR.g.rotation.y = Math.random() * 6.28;
  for (let t = 0; t < 24; t++) { const ang = Math.random() * 6.283, ad = 55 + Math.random() * 40; SAR.area.copy(W(d + Math.cos(ang) * ad, s + Math.sin(ang) * ad, 30)); if (flyL(SAR.area) <= FLY_R - 130) break; } MS.h1 = MS.h2 = false;   // 수색 구역이 비행 구역 안에 들어오게
  for (let t = 0; t < 24; t++) { const pa = Math.random() * 6.283, pd = 45 + Math.random() * 25; SAR.pkP.copy(W(d + Math.cos(pa) * pd, s + Math.sin(pa) * pd, 0)); if (flyL(SAR.pkP) <= FLY_R_SAFE) break; } SAR.pk.position.copy(SAR.pkP); SAR.pk.rotation.y = Math.random() * 6.28; SAR.pk.visible = true; SAR.pkFound = false;
  SAR.sig.position.copy(c).add(new V3(0, 0.9, 0)); SAR.sigT = Math.random() * 3;
}
// 실종자 수색 구역을 좁힘 (가운데는 여전히 실제 위치와 조금 어긋나게)
function sarNarrow(o, r, off) { const a = Math.random() * 6.283; o.mk.copy(W(SAR.d + Math.cos(a) * off, SAR.s + Math.sin(a) * off, 30)); o.search.r = r; o.label = L2(`실종자 수색 · 구역 반경 ${r} m`, `Find the hiker · area radius ${r} m`); renderList(); }
// 출발점 기준 방위·거리 (무전용)
function brgFrom(o, p) {   // o 에서 p 까지 방위(진북)·거리 (무전용 낱말 포함)
  if (!o || !p) return { brg: '000', dist: 0, brgW: 'zero zero zero', distW: 'fifty' };
  const dx = p.x - o.x, dz = p.z - o.z, h = Math.atan2(dx, -dz), brg = ((Math.round(((SITE.brg || 0) + h * 180 / Math.PI) / 5) * 5) % 360 + 360) % 360, dist = Math.max(50, Math.round(Math.hypot(dx, dz) / 50) * 50);
  return { brg: String(brg).padStart(3, '0'), dist, brgW: String(brg).padStart(3, '0').split('').map(c => DIG[+c]).join(' '), distW: numWords(dist) };
}
function fromLaunch(p) {
  if (!p) return brgFrom(null, null);
  const st = startPos(), dx = p.x - st.x, dz = p.z - st.z, h = Math.atan2(dx, -dz), brg = ((Math.round(((SITE.brg || 0) + h * 180 / Math.PI) / 5) * 5) % 360 + 360) % 360, dist = Math.max(50, Math.round(Math.hypot(dx, dz) / 50) * 50);
  return { brg: String(brg).padStart(3, '0'), dist, brgW: String(brg).padStart(3, '0').split('').map(c => DIG[+c]).join(' '), distW: numWords(dist) };
}
function numWords(n) { const U = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'], h = Math.floor(n / 100), r = n % 100; return [h ? (h >= 10 ? 'one thousand' : U[h] + ' hundred') : '', r === 50 ? 'fifty' : r ? String(r) : ''].filter(Boolean).join(' '); }
// 실종자 단서: 배낭(가까이 가야 보임) · 신호 거울 반짝임(낮)/손전등(밤)
function sarClues(dt, cur) {
  if (!SAR || !MSG.sar || !MSG.sar.visible) return;
  const o = msObj(), searching = o && o.t === 'sarfind' && S.state === 'run';
  SAR.sigT = (SAR.sigT || 0) + dt; const per = ENV.night ? 1.2 : 3.6, ph = SAR.sigT % per;
  SAR.sig.visible = searching && !ENV.ir && ph < (ENV.night ? 0.25 : 0.14) && cur.distanceTo(SAR.tp) < (ENV.night ? 420 : 260);
  if (SAR.sig.visible) SAR.sig.material.color.setHex(ENV.night ? 0xfff2c0 : 0xffffff);
  if (searching && !SAR.pkFound && SAR.pk.visible && sensorSees(SAR.pkP.clone().setY(SAR.pkP.y + 0.2), cur, 40)) {
    S.pkT = (S.pkT || 0) + dt;
    if (S.pkT > 0.8) { SAR.pkFound = true; flashPhoto(); showMsg(L2('단서 발견 · 실종자 배낭', 'Clue found · the hiker’s pack'), '#ffc828', 1.6); sfx('good');
      if (o.search.r > 35) sarNarrow(o, 35, 10 + Math.random() * 8); comm(`Copy, that's his pack. He can't be far, search within three zero meters.`, '배낭 확인 · 반경 30 m 안을 수색'); }
  } else S.pkT = 0;
}
function trackRandom() { const T = TRACK; T.s = Math.random() * T.total * 0.25;
  { const endAt = s0 => { for (let s = s0; s <= T.total; s += 10) if (flyL(trackPose(s).p) > FLY_R_SAFE) return s; return T.total; }; let e = endAt(T.s), tries = 0; while (e - T.s < 800 && tries++ < 20) { T.s = Math.random() * T.total * 0.5; if (flyL(trackPose(T.s).p) > FLY_R_SAFE) continue; e = endAt(T.s); } T.endS = e; /* 비행 구역 밖으로 나가는 곳에서 끝 */ }
  T.base = 7 + Math.random() * 3; T.ph = Math.random() * 6; T.tt = 0; T.stopT = 0; T.stops = [T.s + 400 + Math.random() * 300, T.s + 1100 + Math.random() * 400]; }

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
const ORDER = { m: null };
function commReset() {   // 새 비행: 남은 무전·자막·사진 미리보기 정리
  COMM.q.length = 0; COMM.cur = (COMM.cur || 0) + 1; COMM.sp = false; COMM.busy = 0; try { if (COMM.src) COMM.src.stop(); } catch (e) { } COMM.src = null;
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { } try { commStatic(false); } catch (e) { }
  const r = $('radio'); if (r) r.classList.remove('show'); const pp = $('photoPop'); if (pp) pp.style.opacity = 0; if (typeof PH !== 'undefined') PH.lastT = 0;
}
const OP = 'EAGLE ONE';   // 드론 운용자(우리 쪽) 무전 · 다른 목소리
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
function comm(en, ko, from, tag) {
  if (S.state !== 'run' && S.state !== 'result') return;
  if (tag) COMM.q = COMM.q.filter(m => m.tag !== tag);   // 같은 종류(코스 안내)는 최신 것만
  COMM.q.push({ en, ko, from: from || 'CONTROL', tag }); if (COMM.q.length > 6) COMM.q.shift();
}
// 코스 음성 안내: 과제를 마칠 때마다 다음 과제를 불러 줌 (슬라럼 같은 연속 과제는 처음·끝만)
function courseCallSay(l) { return String(l).replace(/360°/g, 'three sixty').replace(/H-PAD/g, 'H pad').replace(/\s*·\s*/g, ', ').replace(/\s*\(([^)]*)\)/g, ', $1').replace(/\bLOW\b/g, 'Low').replace(/\b([A-Z])([A-Z]{3,})\b/g, (m, a, b) => a + b.toLowerCase()).replace(/(\d+)\/(\d+)/g, '$1 of $2'); }
function courseCall(done, next) {
  if (!next || !next.label) return;
  const k = l => String(l).split(/[ ·]/)[0];
  if (done && k(done.label) === k(next.label) && /SLALOM/.test(next.label)) return;
  comm(`Next, ${courseCallSay(next.label)}.`, L2('다음: ', 'Next: ') + next.label, 'CONTROL', 'nav');
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
  try { const inl = document.getElementById('ttsw'), src = inl ? URL.createObjectURL(new Blob([inl.textContent.split('<\\/script>').join('<' + '/script>')], { type: 'text/javascript' })) : (window.SIM_BASE || '') + 'lib/tts-worker.js'; const w = new Worker(src); w.onmessage = e => { if (e.data && e.data.ready) { TTSW.ready = true; return; } const c = TTSW.cb[e.data.id]; delete TTSW.cb[e.data.id]; if (c) c(e.data); }; w.onerror = ev => { TTSW.ok = false; TTSW.w = null; COMM.fbErr = 'worker load: ' + (ev && ev.message || 'error'); }; TTSW.w = w; } catch (e) { TTSW.ok = false; COMM.fbErr = 'worker: ' + e.message; }
  return TTSW.w;
}
// 자연스러운 무전 음성: 미리 만들어 둔 음성 조각(Kokoro-82M, Apache-2.0)을 이어 붙여 재생. 없는 말이 섞이면 기존 엔진으로
const RV = { idx: null, buf: null, ab: {}, st: 'none' };
function rvLoad() {
  if (RV.st !== 'none') return; RV.st = 'loading';
  const ib = document.getElementById('rvb'), ii = document.getElementById('rvi');
  if (ib && ii) { try { const s = atob(ib.textContent.trim()), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); RV.buf = u.buffer; RV.idx = JSON.parse(ii.textContent); RV.st = 'ready'; } catch (e) { RV.st = 'fail'; COMM.rvErr = 'inline: ' + e.message; } return; }
  if (location.protocol === 'file:') { RV.st = 'fail'; return; }   // 한 파일판인데 음성 묶음이 없으면 기존 엔진
  const base = (window.SIM_BASE || '') + 'lib/radio_voice';
  Promise.all([fetch(base + '.json').then(r => r.ok ? r.json() : Promise.reject('json ' + r.status)), fetch(base + '.bin').then(r => r.ok ? r.arrayBuffer() : Promise.reject('bin ' + r.status))])
    .then(([i, b]) => { RV.idx = i; RV.buf = b; RV.st = 'ready'; }).catch(e => { RV.st = 'fail'; COMM.rvErr = String(e); });
}
setTimeout(rvLoad, window.SIM_VR ? 300 : 1500);
const RV_U = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' '), RV_T = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
function rvNumW(n) { return n < 20 ? RV_U[n] : n < 100 ? RV_T[Math.floor(n / 10) - 2] + (n % 10 ? ' ' + RV_U[n % 10] : '') : String(n); }
function rvNorm(t) { return String(t).toLowerCase().replace(/\d+/g, m => ' ' + rvNumW(+m) + ' ').match(/[a-z']+/g) || []; }
function rvPlan(text, spk) {   // 가장 긴 조각부터 맞춰 나감 (문장 단위 조각이면 억양이 자연스러움) · spk 'op' = 드론 운용자 목소리
  if (RV.st !== 'ready' || SET.voiceEng === 'synth') return null;
  const w = rvNorm(text), out = [], pre = spk === 'op' ? 'op|' : ''; let i = 0;
  while (i < w.length) { let hit = 0; for (let L = Math.min(40, w.length - i); L >= 1; L--) { const k = pre + w.slice(i, i + L).join(' '); if (RV.idx[k]) { out.push(k); hit = L; break; } } if (!hit) return null; i += hit; }
  return out.length ? out : null;
}
function rvBuf(k) { if (RV.ab[k]) return Promise.resolve(RV.ab[k]); const [o, l] = RV.idx[k]; return AU.ctx.decodeAudioData(RV.buf.slice(o, o + l)).then(b => (RV.ab[k] = b)); }
function rvSpeak(plan, est) {
  const myId = (COMM.cur = (COMM.cur || 0) + 1); COMM.sp = true;
  const done = () => { if (COMM.cur === myId) commSpeechDone(); };
  if (COMM.src) { try { COMM.src.stop(); } catch (e) { } COMM.src = null; }
  if (!AU.ctx) { setTimeout(done, est * 900); return; }
  Promise.all(plan.map(rvBuf)).then(bs => {
    if (COMM.cur !== myId) return; const c = AU.ctx;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 280; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
    const g = c.createGain(); g.gain.value = 1.35; hp.connect(lp); lp.connect(g); g.connect(AU.master);
    let t = c.currentTime + 0.06; const S2 = [];
    bs.forEach((b, i) => { const s = c.createBufferSource(); s.buffer = b; s.connect(hp); s.start(t); S2.push(s); t += b.duration + (plan[i].replace('op|', '').indexOf(' ') > 0 && i < bs.length - 1 && plan[i + 1].replace('op|', '').indexOf(' ') > 0 ? 0.14 : 0.03); });
    S2[S2.length - 1].onended = done; COMM.src = { stop() { S2.forEach(s => { try { s.stop(); } catch (e) { } }); } }; COMM.rvOk = true;
  }).catch(e => { COMM.rvErr = 'decode: ' + (e && e.message || e); done(); });
  setTimeout(() => { if (COMM.cur === myId) done(); }, Math.max(12, est * 2.5) * 1000);
}
function needFallbackVoice() { if (window.SIM_VR || COMM.webFail) return true; try { return !speechSynthesis.getVoices().some(v => /^en/i.test(v.lang)); } catch (e) { return true; } }
function commEngine() { return RV.st === 'ready' && SET.voiceEng !== 'synth' ? 'natural' : needFallbackVoice() ? (TTSW.ok === false ? 'none' : 'synth') : 'web'; }
function vrVoiceTest() {
  if (AU.ctx && AU.ctx.state !== 'running') try { AU.ctx.resume(); } catch (e) { }
  const t = 'Eagle One, Control. Radio check. How copy? Over.';
  const pl = rvPlan(t); if (pl) return rvSpeak(pl, 4);
  if (needFallbackVoice()) { ttsWorker(); commSpeakFallback(t, 4); } else commSpeak(t, 4);
}
setTimeout(() => { if (SET.voice !== false && needFallbackVoice() && RV.st !== 'ready') ttsWorker(); }, window.SIM_VR ? 2500 : 4000);   // 미리 불러 둠
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
  const pl = rvPlan(text, COMM.spk); if (pl) return rvSpeak(pl, est);
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
    u.rate = 1.0; u.pitch = COMM.spk === 'op' ? 1.15 : 0.9; u.volume = 1;
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
  if (m.from === 'CONTROL' && !/missed/i.test(m.en)) ORDER.m = { en: m.en, ko: m.ko, t: S.t };   // 마지막 명령은 화면에 남김
  const sp = speakify(m.en), dur = Math.max(3.5, sp.length / 13);
  COMM.spk = m.from === 'CONTROL' ? '' : 'op';
  el.classList.add('show'); radioT = dur + 1; COMM.busy = dur + 0.6;
  squelch(true); commStatic(true, dur + 0.4);
  if (SET.voice !== false && (RV.st === 'ready' || window.speechSynthesis || (needFallbackVoice() && TTSW.ok !== false))) {
    if (AU.ctx && AU.ctx.state !== 'running') try { AU.ctx.resume(); } catch (e) { }
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
    recon: (() => { const b = kind === 'recon' && MS.list[0] && MS.list[0].tp ? fromLaunch(MS.list[0].tp) : null; return [`${CS}, CONTROL. Four structures tasked for imagery. ${b ? `First structure bearing ${b.brgW}, about ${b.distW} meters from launch point.` : ''} ${n}Over.`, `건물 4곳 촬영 임무.${b ? ` 첫 대상: 출발점에서 방위 ${b.brg}° · 약 ${b.dist} m` : ''}`]; })(),
    strike: [`${CS}, CONTROL. Five vehicles in the valley, two are decoys. Positive ID by thermal before you commit. Cleared hot.`, '차량 5대 중 2대 기만체. 열화상으로 식별 후 돌입. 공격 허가.'],
    fire: [`${CS}, CONTROL. Fire watch requested. Smoke reports coming in, locate each fire, confirm with thermal and report. ${w}Over.`, '산불 감시 요청. 연기 신고가 들어옴. 직접 찾아 열화상으로 확인 후 보고.'],
    sar: (() => { const b = kind === 'sar' && SAR ? fromLaunch(SAR.area) : null; return [`${CS}, CONTROL. Missing hiker, last seen near the trail. ${b ? `Search area bearing ${b.brgW}, about ${b.distW} meters from launch point.` : ''} Sweep the area, look for his pack and signal flashes, use thermal under the trees. ${n}Over.`, `실종자 수색.${b ? ` 수색 구역: 출발점에서 방위 ${b.brg}° · 약 ${b.dist} m.` : ''} 구역을 훑으며 배낭·신호 반짝임, 나무 아래는 열화상.`]; })(),
    track: [`${CS}, CONTROL. Target vehicle on the forest road. Do not get spotted. Stay out of its front, keep high and well back, and keep eyes on for sixty seconds.`, '도로의 표적 차량 추적. 들키지 말 것 · 차 앞쪽 피하고 높게, 멀찍이 뒤에서 60초 관측.'],
    ridge: [`${CS}, CONTROL. Ridge run approved. Expect gusts on the crest. ${w}`, '능선 비행 승인. 능선 위 돌풍 주의.']
  }[kind];
  if (T) { comm(T[0], T[1]); if (isMission(kind)) comm('Eagle One, wilco.', '이글 원, 수행하겠음.', OP); }
}
let COMM_LAST = 0;
function commAck(o, kind) {   // 목표 하나 끝났을 때
  const left = MS.list.filter(x => !x.done).length;
  if (kind === 'recon') { const x = MS.list.find(y => !y.done), b = x ? brgFrom(DR.p, x.tp) : null; return comm(`Copy imagery. ${b ? `Next structure bearing ${b.brgW}, about ${b.distW} meters from your position.` : 'All imagery received.'}`, b ? `촬영 확인. 다음 대상: 현 위치에서 방위 ${b.brg}° · 약 ${b.dist} m` : '촬영 모두 수신.'); }
  if (kind === 'recon-old') return comm(`Copy imagery. ${left ? `Next structure, grid ${(() => { const x = MS.list.find(y => !y.done); return x ? grid(x.d, x.s) : '—'; })()}.` : 'All imagery received.'}`, left ? '촬영 확인. 다음 대상 좌표 전달.' : '촬영 모두 수신.');
  if (kind === 'fire') return comm(`Copy imagery, hotspot confirmed at grid ${grid(o.d, o.s)}. Fire crews dispatched.${left ? ' Stand by for the next report.' : ' All reported.'}`, `사진 접수 · 불씨 확인, 진화대 출동.${left ? ' 다음 신고 대기.' : ' 모두 보고됨.'}`);
  if (kind === 'sar' && o.t === 'sarfind') return comm(`Copy imagery, subject located at grid ${grid(SAR.d, SAR.s)}. ${AFc().drop ? 'Drop the rescue kit within five meters.' : 'Return to base.'}`, `실종자 위치 확인. ${AFc().drop ? '구조 키트 5 m 이내 투하.' : '복귀.'}`);
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
  ['tbBoost', 'BST', 'BST'], ['tbDrop', 'DROP', 'DROP'], ['tbCam', 'CAM', 'CAM'], ['tbReset', '⟲', '⟲'], ['tbBelly', '↓CAM', '↓CAM'], ['tbIR', 'IR', 'IR'], ['tbLight', '💡', '💡'], ['tbAssist', 'AST', 'AST'], ['tbZoom', 'ZM', 'ZM'], ['tbGuide', 'GD', 'GD'], ['tbFull', '⛶', '⛶'], ['tbPause', '❚❚', '❚❚']
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
  tbLight: { r: 228, t: 64 }, tbIR: { r: 174, t: 64 }, tbCam: { r: 120, t: 64 }, tbBelly: { r: 66, t: 64 }, tbZoom: { r: 12, t: 64 },
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
  const site = HAS[k] !== false, af = (MS_OK[k] || []).includes(SET.af), wx = !(k === 'fire' && (SET.wx === 'rain' || SET.wx === 'snow'));   // 비·눈 오는 날은 산불 감시 없음
  return { ok: site && af && wx, site, af, wx, why: !site ? L2('이 훈련장에는 없는 임무', 'Not available at this site') : !wx ? L2('비·눈 오는 날에는 산불 감시를 하지 않습니다 · 날씨를 맑음으로', 'No wildfire watch in rain or snow · set the weather to clear') : !af ? L2('선택한 기체로는 할 수 없는 임무 · 아래 추천 기체를 고르세요', 'Not possible with this airframe · pick a recommended one below') : '' };
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
  $('msGo').disabled = !av.ok; $('msGo').textContent = MENU.mode === 'vr' ? (k === 'demo' ? L2('VR로 재생 ▶ (헤드셋 착용)', 'Play in VR ▶') : L2('VR로 출격 ▶ (헤드셋 착용)', 'Launch in VR ▶ (put on the headset)')) : k === 'tutorial' ? L2('단계 고르기 ▶', 'Choose a step ▶') : k === 'demo' ? L2('재생 ▶', 'Play ▶') : L2('출격 ▶', 'Launch ▶');
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
  if (MENU.mode === 'vr') { if (k === 'tutorial') { const w = $('mdWhy'); if (w) w.textContent = L2('튜토리얼은 컴퓨터 판에서만 · VR에서는 장애물 코스부터', 'Tutorial is on the computer version only'); return; } if (!VR_OK.ok) { const w = $('mdWhy'); if (w) w.textContent = L2('이 기기는 VR을 지원하지 않습니다', 'This device does not support VR'); return; } XR.pending = k; vrStart(); return; }
  if (k === 'tutorial') openTutMenu(); else startRun(k);
}
document.querySelectorAll('#msGrid [data-ms]').forEach(b => {
  b.addEventListener('click', () => { const now = performance.now(), again = MENU.ms === b.dataset.ms && now - MENU.dbl < 450; MENU.dbl = now; if (again) menuGo(); else menuSel(b.dataset.ms); });
});
$('msGo').onclick = menuGo;
if ($('bPauseOpt')) $('bPauseOpt').onclick = () => openPanel('optPanel');
if ($('bPauseCtl')) $('bPauseCtl').onclick = () => { openPanel('ctlPanel'); try { kbHelp(); } catch (e) { } };
setInterval(() => { const w = $('pauseWho'); if (w && S.state === 'pause') { const lk = S.lastKind || S.kind; w.textContent = L2('현재 임무: ', 'Mission: ') + (MS_NAME[lk] || ({ course: L2('장애물 코스', 'Obstacle course'), free: L2('자유 비행', 'Free flight'), tutorial: L2('튜토리얼', 'Tutorial'), demo: L2('기준 비행', 'Reference flight') })[lk] || lk) + ' · ' + AFc().name + ' · ' + pilotName(); } }, 400);
// ---- 첫 화면 3단계: 1 조종사 이름 → 2 기체 → 3 코스 (각 단계 뒤로 가기) ----
MENU.step = 0; const HAS_INTRO = !!(window.SIM_VR || window.SIM_VR_URL); MENU.mode = window.SIM_VR ? 'vr' : 'pc';
try { SET.pilot = localStorage.getItem('hroc_pilot') || ''; } catch (e) { SET.pilot = ''; }
function pilotName() { return SET.pilot || L2('조종사', 'Pilot'); }
function wizGo(n) {
  n = Math.max(HAS_INTRO ? 0 : 1, Math.min(3, n | 0)); const c = $('menuCard'); if (!c) return;
  if (MENU.step === 1 && n > 1) { const v = ($('pilotName').value || '').trim().slice(0, 16); SET.pilot = v; try { localStorage.setItem('hroc_pilot', v); } catch (e) { } }
  MENU.step = n; c.dataset.step = n; closePanels();
  if (n === 1) { const i = $('pilotName'); i.value = SET.pilot || ''; setTimeout(() => { try { i.focus(); i.select(); } catch (e) { } }, 30); }
  if (n === 2) { afUI(); }
  if (n === 3) { menuSel(MENU.ms); const w = $('wzWho'); if (w) w.textContent = `${pilotName()} · ${AFc().name}`; const g = $('msGo'); if (g) g.textContent = MENU.mode === 'vr' ? L2('VR로 출격 ▶ (헤드셋 착용)', 'Launch in VR ▶ (put on the headset)') : L2('출격 ▶', 'Launch ▶'); }
  const md = $('wzMode'); if (md) { md.style.display = HAS_INTRO ? '' : 'none'; md.textContent = MENU.mode === 'vr' ? '🥽 VR' : '🖥 PC'; }
  if ($('wz1Back')) $('wz1Back').style.visibility = HAS_INTRO ? '' : 'hidden';
  try { window.dispatchEvent(new Event('resize')); } catch (e) { }
  if (ui.menu) ui.menu.scrollTop = 0;
}
if ($('pilotName')) { $('pilotName').value = SET.pilot || ''; $('pilotName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); wizGo(2); } }); }
[['wz1Next', 2], ['wz2Back', 1], ['wz2Next', 3], ['wz3Back', 2]].forEach(([id, n]) => { if ($(id)) $(id).onclick = () => wizGo(n); });
if ($('bOpt')) $('bOpt').onclick = () => openPanel('optPanel');
if ($('bCtl')) $('bCtl').onclick = () => { openPanel('ctlPanel'); try { kbHelp(); } catch (e) { } };
if ($('optClose')) $('optClose').onclick = () => closePanels();
if ($('ctlClose')) $('ctlClose').onclick = () => closePanels();
if ($('bHelp2')) $('bHelp2').onclick = () => openPanel('helpPanel');
if ($('bRC2')) $('bRC2').onclick = () => { closePanels(); rcOpen(); };
if ($('wzVR')) $('wzVR').onclick = () => { if (window.SIM_VR_URL) location.href = window.SIM_VR_URL + (window.SIM_LANG === 'en' ? 'en.html' : ''); };
setInterval(() => { const a = $('padStatus'), b = $('padStatus2'); if (a && b) b.textContent = a.textContent; }, 1000);
setTimeout(() => wizGo(HAS_INTRO ? 0 : 1), 0);
// 첫 화면 비밀번호 (간단한 출입 확인용 · 이 기기에서 한 번 맞히면 기억)
// 입장 번호: 번호 자체는 코드에 두지 않고, 소금+SHA-256 1만2천 번 반복한 값만 둔다.
// 기억 값은 중간 단계(5천 번) 값이라 코드에 없는 값이고, 나머지를 돌려 확인한다.
function sha256hex(str) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const b = unescape(encodeURIComponent(str)), l = b.length, n = ((l + 9 + 63) >> 6) << 4, w = new Array(n).fill(0);
  for (let i = 0; i < l; i++) w[i >> 2] |= b.charCodeAt(i) << (24 - (i & 3) * 8);
  w[l >> 2] |= 0x80 << (24 - (l & 3) * 8); w[n - 1] = l * 8;
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]; const W = new Array(64);
  const r = (x, y) => (x >>> y) | (x << (32 - y));
  for (let o = 0; o < n; o += 16) {
    for (let i = 0; i < 64; i++) W[i] = i < 16 ? w[o + i] | 0 : (r(W[i-2],17) ^ r(W[i-2],19) ^ (W[i-2] >>> 10)) + W[i-7] + (r(W[i-15],7) ^ r(W[i-15],18) ^ (W[i-15] >>> 3)) + W[i-16] | 0;
    let [A, B, C, D, E, F, G, H] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = H + (r(E,6) ^ r(E,11) ^ r(E,25)) + ((E & F) ^ (~E & G)) + K[i] + W[i] | 0, t2 = (r(A,2) ^ r(A,13) ^ r(A,22)) + ((A & B) ^ (A & C) ^ (B & C)) | 0;
      H = G; G = F; F = E; E = D + t1 | 0; D = C; C = B; B = A; A = t1 + t2 | 0;
    }
    h = h.map((v, i) => v + [A, B, C, D, E, F, G, H][i] | 0);
  }
  return h.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
}
function pinStretch(x, from, to) { for (let i = from; i < to; i++) x = sha256hex('fpv~' + i + '~' + x); return x; }
(function pinGate() {
  const SALT = 'k7Qx2#range', MID = 5000, N = 12000, FIN = '667c6eac4841dacac28af88ce9febae877dcf0556f15edc5211601d0f51bb8eb', KEY = 'hroc_pin_ok', el = $('pinGate'); if (!el) return;
  const okMid = m => typeof m === 'string' && /^[0-9a-f]{64}$/.test(m) && pinStretch(m, MID, N) === FIN;
  let ok = false; try { ok = okMid(localStorage.getItem(KEY)); } catch (e) { }
  if (ok || window.SIM_UNLOCKED || /[?&]test/.test(location.search)) return;   // 암호로 잠근 파일은 이미 문구 암호를 거쳤으므로 다시 묻지 않음
  el.classList.remove('hidden'); let v = '';
  const dots = $('pinDots'), msg = $('pinMsg'), draw = () => [...dots.children].forEach((d, i) => d.classList.toggle('on', i < v.length));
  let wrong = 0, lockUntil = 0;
  const press = k => {
    if (performance.now() < lockUntil) return;
    if (k === 'del') v = v.slice(0, -1); else if (/^\d$/.test(k) && v.length < 4) v += k; draw();
    if (v.length !== 4) return;
    const mid = pinStretch(SALT + v, 0, MID);
    if (pinStretch(mid, MID, N) === FIN) { try { localStorage.setItem(KEY, mid); } catch (e) { } el.classList.add('hidden'); window.removeEventListener('keydown', kd, true); return; }
    wrong++; const wait = wrong >= 5 ? Math.min(30, 5 * (wrong - 4)) : 0; lockUntil = performance.now() + wait * 1000;
    msg.textContent = wait ? L2(`번호가 맞지 않습니다 · ${wait}초 뒤 다시`, `Wrong code · retry in ${wait}s`) : L2('번호가 맞지 않습니다', 'Wrong code');
    dots.classList.remove('bad'); void dots.offsetWidth; dots.classList.add('bad'); setTimeout(() => { v = ''; draw(); }, 350);
  };
  $('pinPad').querySelectorAll('button').forEach(b => b.addEventListener('click', () => press(b.dataset.k || b.textContent)));
  const kd = e => { if (el.classList.contains('hidden')) return; e.stopImmediatePropagation(); e.preventDefault(); if (/^Digit\d$|^Numpad\d$/.test(e.code)) press(e.code.slice(-1)); else if (e.key === 'Backspace') press('del'); };
  window.addEventListener('keydown', kd, true);
})();
// 처음 화면: 컴퓨터 / VR 갈림길 (PC 판과 VR 판은 서로 다른 주소)
function vrUrlAbs() { try { return new URL((window.SIM_VR_URL || '') + (window.SIM_LANG === 'en' ? 'en.html' : ''), location.href).href; } catch (e) { return ''; } }
if ($('introPC')) $('introPC').onclick = () => { if (window.SIM_VR) location.href = (window.SIM_BASE || '../') + (window.SIM_LANG === 'en' ? 'en.html' : ''); else wizGo(1); };
if ($('introVR')) $('introVR').onclick = () => {
  const n = $('introNote');
  if (window.SIM_VR) { if (VR_OK.ok) wizGo(1); else if (n) n.textContent = L2('이 기기·브라우저는 VR을 지원하지 않습니다. Meta Quest 헤드셋의 브라우저에서 이 주소를 열어 주세요.', 'This device or browser does not support VR. Open this address in the Meta Quest browser.'); return; }
  if (VR_OK.ok) { location.href = vrUrlAbs(); return; }
  if (n) n.innerHTML = L2('VR은 Meta Quest 헤드셋의 브라우저에서 엽니다: ', 'Open VR in the Meta Quest browser: ') + `<b style="color:#4fe3ff;user-select:all">${vrUrlAbs().replace(/^https?:\/\//, '')}</b>`;
};
if ($('wz1Back')) $('wz1Back').onclick = () => wizGo(0);
if ($('wzMode')) $('wzMode').onclick = () => wizGo(0);
// ---- 임무 현장 미리 보기 (메뉴 뒤 카메라) ----
function menuShow(k) {
  Object.values(MSG).forEach(g => g.visible = false);
  const a = AFc(), kw = a.cls === 'wing' ? 2.2 : 1;
  if (k === 'race' && RACE.length) { MSG.race.visible = true; RACE.forEach(r => { r.mesh.scale.setScalar(3.2 * kw); r.mesh.position.copy(W(r.q.d, r.q.s, a.cls === 'wing' ? r.alt * 0.8 + 30 : r.alt)); }); }
  if (k === 'ridge' && RIDGE) { MSG.ridge.visible = true; RIDGE.list.forEach(r => { const c = W(r.q.d, r.q.s, a.cls === 'wing' ? 38 : 18); r.mesh.position.copy(c); r.mesh.scale.setScalar(6 * kw); r.mesh.lookAt(c.clone().add(r.n)); }); }
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
    TRACK.s = (TRACK.s + 9 * dt) % Math.max(1, TRACK.total - 5); TRACK.v = 9; const vp = trackPose(TRACK.s); TRACK.g.position.copy(vp.p); TRACK.g.rotation.y = -vp.h; trackLights(dt, true);
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
  if (MENU.step !== 3 || ['setPanel', 'recPanel', 'helpPanel', 'tutMenu', 'kbPanel', 'credPanel', 'optPanel', 'ctlPanel'].some(p => $(p) && !$(p).classList.contains('hidden'))) return;
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
//  오른쪽 트리거 투하 · 왼쪽 트리거 부스트 · A 확인 · B 메뉴 · X 조명 · Y 하부 카메라 · 왼쪽 스틱 누르기 카메라 · 오른쪽 스틱 누르기 열화상
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
VR_PIP.m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.394), new THREE.MeshBasicMaterial({ map: VR_PIP.rt.texture })); VR_PIP.m.position.set(-1.2 + 0.40, -0.675 + 0.26, 0.006); VR_SCR.add(VR_PIP.m);
{ const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.414), new THREE.MeshBasicMaterial({ color: 0xffc828 })); fr.position.z = -0.001; VR_PIP.m.add(fr); }
const VR_MAP = (function () { const t = new THREE.CanvasTexture(ui.map); t.encoding = THREE.sRGBEncoding; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.833), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.95, toneMapped: false }));
  m.position.set(-1.2 - 0.29, 0.675 - 0.4165, 0); m.visible = false; VR_SCR.add(m); return { t, m }; })();
const VR_MENU = vrPlane(1.3, 1.3 * 1170 / 1024, 1024, 1170); VR_MENU.btns = []; VR_MENU.m.visible = false; VRS.add(VR_MENU.m);
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
  setTod(v === 'night' ? 'night' : v === 'dusk' ? 'dusk' : 'day');
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
  xrPlanesPatch();
  let sess; try { sess = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] }); } catch (e) { XR.pending = null; vrOverlay(L2('VR을 시작할 수 없습니다. 다시 눌러 주세요.', 'Could not start VR. Please try again.')); return; }
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
  $('vrNote') && $('vrNote').classList.add('hidden');
  if (XR.pending) { const k = XR.pending; XR.pending = null; XR.menu = false; startRun(k); vrApplyCam(); }
  else if (S.state === 'pause') { XR.menu = false; togglePause(); } else vrMenuOpen();
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
    exportReplayVideo(LAST_REC, ok => { toMenu(); vrOverlay(ok ? L2('영상을 저장했습니다. 다운로드 폴더(파일 앱)에서 볼 수 있습니다.', 'Video saved to your Downloads folder.') : L2('영상을 만들지 못했습니다.', 'Could not create the video.'), L2('VR 시작', 'Start VR')); });
    return;
  }
  if (XR.userExit && (S.state === 'run' || S.state === 'demo' || S.state === 'pause')) toMenu(); else if (S.state === 'run' || S.state === 'demo') togglePause();
  vrOverlay(XR.userExit ? '' : L2('VR이 멈췄습니다. 버튼을 누르면 하던 비행을 이어 갑니다.', 'VR was interrupted. Press the button to continue your flight.'), XR.userExit ? L2('VR 시작', 'Start VR') : L2('VR로 돌아가기', 'Back to VR'));
}
function vrOverlay(msg, btn) {   // VR 판 2D 화면: 메뉴(3단계 코스 화면) 위에 안내 줄
  const o = $('vrBack'); if (o) o.classList.add('hidden');
  ui.pause.classList.add('hidden'); ui.menu.classList.remove('hidden'); if (MENU.step < 3) wizGo(3);
  const n = $('vrNote'), r = $('vrResume'), paused = S.state === 'pause';
  if (n) { n.classList.toggle('hidden', !msg); $('vrNoteT').textContent = msg || ''; }
  if (r) { r.classList.toggle('hidden', !paused); r.onclick = () => vrStart(); }
}
// three r149: Quest 브라우저에서 XRFrame.detectedPlanes 를 읽으면 (평면 인식을 안 켰을 때) 오류가 남 -> 오류 대신 '없음'
function xrPlanesPatch() {
  try { const P = window.XRFrame && XRFrame.prototype, d = P && Object.getOwnPropertyDescriptor(P, 'detectedPlanes');
    if (d && d.get && !d.get.__safe) { const g = function () { try { return d.get.call(this); } catch (e) { return undefined; } }; g.__safe = true; Object.defineProperty(P, 'detectedPlanes', { configurable: true, enumerable: d.enumerable, get: g }); } } catch (e) { }
}
xrPlanesPatch();
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
  let st = SET.vrMode === 1 ? { thr: ry, yaw: lx, pitch: ly, roll: rx } : { thr: ly, yaw: lx, pitch: ry, roll: rx };
  if (SET.vrMode === 3) st = vrHeadSteer(dt, lx, ly, rx, ry);
  else IN.head = false;
  let any = false;
  for (const k in st) { const v = SET.vrMode === 3 ? st[k] : stickCurve(st[k], 0.1, true); if (Math.abs(v) > Math.abs(IN[k])) { IN[k] = v; any = true; } }
  if (any) IN.src = 'VR';
  if (Lg && Lg.buttons[0] && Lg.buttons[0].value > 0.4 && SET.diff !== 'atti') IN.boost = true;
  if (rt) pressed.push('Space');
  if (A) { if (S.state === 'result') startRun(S.kind); else pressed.push('Enter'); }   // 산불·수색 중에는 A = 사진
  if (B) vrMenuOpen();
  if (Y) { const L = [0, 90, 60, 45]; SET.vrPip = L[(L.indexOf(SET.vrPip | 0) + 1) % L.length]; saveSet(); showMsg(SET.vrPip ? L2('하부 카메라 ', 'Lower camera ') + SET.vrPip + '°' : L2('하부 카메라 끔', 'Lower camera off'), '#ffc828', 1); }
  if (LS) { SET.vrCam = SET.vrCam === 'chase' ? 'fpv' : 'chase'; saveSet(); vrApplyCam(); showMsg(SET.vrCam === 'chase' ? L2('뒤에서 추적', 'Chase view') : 'FPV', '#4fe3ff', 1); }
  if (RS) irSet(!ENV.ir);
  if (X) pressed.push('KeyL');   // 조명 켜기/끄기
}
// 머리 방향 모드: 고개를 돌린 쪽으로 기체가 돌고, 왼쪽 스틱 앞뒤 = 속도, 고개를 들거나 숙이면 그쪽으로 오르내림
// 오른쪽 스틱: 좌우 = 옆으로, 위아래 = 고도 (직접), 왼쪽 스틱 좌우 = 몸을 돌리지 않고 회전
function vrHeadSteer(dt, lx, ly, rx, ry) {
  const fw = new V3(0, 0, -1).applyQuaternion(XR.headQ), hh = Math.atan2(fw.x, -fw.z), hp = Math.asin(clamp(fw.y, -1, 1));
  const live = S.state === 'run' && !DR.landed;
  if (!live || XR.hTgt == null) { XR.hTgt = DR.h; XR.hhPrev = hh; }
  else { XR.hTgt += wrapA(hh - XR.hhPrev); XR.hhPrev = hh; XR.hTgt += shape(lx, 0.15) * 1.6 * dt; }
  let dh = wrapA(XR.hTgt - DR.h); if (Math.abs(dh) > 100 * DEG) { XR.hTgt = DR.h + Math.sign(dh) * 100 * DEG; dh = wrapA(XR.hTgt - DR.h); }   // 너무 앞서가지 않게
  IN.head = live;
  if (AFc().cls === 'wing') { const tl = Math.abs(hp) < 6 * DEG ? 0 : hp - Math.sign(hp) * 6 * DEG; return { thr: shape(ly, 0.1), yaw: 0, pitch: clamp(-tl * 2.6 + shape(-ry, 0.12), -1, 1), roll: clamp(dh * 1.8 + shape(rx, 0.1), -1, 1) }; }
  const spd = shape(ly, 0.1), tilt = Math.abs(hp) < 8 * DEG ? 0 : hp - Math.sign(hp) * 8 * DEG;
  let thr = shape(ry, 0.12);
  if (DR.landed) thr = Math.max(thr, spd);                                   // 땅에서는 왼쪽 스틱 위 = 이륙
  else if (spd > 0) thr = clamp(thr + spd * Math.tan(tilt) * 2.2, -1, 1);   // 보는 쪽(위·아래)으로 날아감
  return { thr, yaw: Math.abs(dh) < 1.5 * DEG ? 0 : clamp(dh * 2.4, -1, 1), pitch: DR.landed ? 0 : spd, roll: shape(rx, 0.1) };
}
// ---- VR 안 메뉴 ----
const VR_MS = () => [['course', L2('장애물 코스', 'Obstacle course')], ['forest', L2('숲길 통과', 'Forest trail')], ['race', L2('타임 레이스', 'Time race')], ['ridge', L2('능선 종주', 'Ridge run')], ['free', L2('자유 비행', 'Free flight')], ['demo', L2('기준 비행 보기', 'Reference flight')]];
const VR_AF = ['x2d', 'anafi', 'fpv', 'kfpv'], VR_AFW = ['fw', 'puma', 'kfw'];
const VR_MS2 = () => [['recon', L2('정찰', 'Recon')], ['track', L2('차량 추적', 'Vehicle track')], ['fire', L2('산불 감시', 'Wildfire watch')], ['sar', L2('수색·구조', 'Search & rescue')], ['strike', L2('타격', 'Strike')]];
function vrMenuOpen() {   // 비행 중이면 멈춰 두고(계속하기 가능) · 결과·리플레이 상태는 그대로 (임무는 웹 화면에서 고름)
  if (S.state === 'run' || S.state === 'demo') togglePause(); else if (S.state === 'replay') replayEnd();
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
  const hasRec = !!(REC && REC.s.length > 1) || !!(LAST_REC && LAST_REC.s && LAST_REC.s.length > 1), lk = S.lastKind || S.kind, done = S.state === 'result' || S.state === 'menu';
  { const kn = MS_NAME[lk] || ({ course: L2('장애물 코스', 'Obstacle course'), free: L2('자유 비행', 'Free flight'), demo: L2('기준 비행', 'Reference flight') })[lk] || lk; g.fillStyle = '#e8eef2'; g.font = '700 26px system-ui, sans-serif'; g.fillText(L2('현재 임무: ', 'Mission: ') + kn + ' · ' + AFc().name + ' · ' + pilotName(), 36, 106); y = 150;
    if (ORDER.m) { const t = (window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en; g.font = '500 21px system-ui, sans-serif'; const ws = String(t).split(' '), L = []; let ln = ''; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 880 && ln) { L.push(ln); ln = w; } else ln = tl; } if (ln) L.push(ln);
      g.fillStyle = '#ffc828'; g.fillText('📻', 36, 144); g.fillStyle = '#cfd6da'; L.slice(0, 2).forEach((l, i) => g.fillText(l, 76, 144 + i * 28)); y = 150 + Math.min(2, L.length) * 28 + 14; } }
  if (done) { btn('restart', 36, y, 300, 80, '↺ ' + L2('같은 임무 다시', 'Fly it again'), false, false, true); btn('replay', 348, y, 310, 80, L2('이번 비행 리플레이', 'Replay this flight'), false, !hasRec); btn('video', 670, y, 318, 80, '⬇ ' + L2('영상 저장', 'Save video'), false, !hasRec); y += 96; }
  if (paused) {
    const kn = (MS_NAME[S.kind] || ({ course: L2('장애물 코스', 'Obstacle course'), free: L2('자유 비행', 'Free flight'), demo: L2('기준 비행', 'Reference flight') })[S.kind] || S.kind);
    btn('resume', 36, y, 300, 80, '▶ ' + L2('계속하기', 'Resume'), false, false, true); btn('restart', 348, y, 310, 80, '↺ ' + L2('처음부터', 'Restart'), false); btn('replay', 670, y, 318, 80, L2('지금까지 리플레이', 'Replay so far'), false, !hasRec); y += 96;
  }
  g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '500 18px system-ui, sans-serif'; g.fillText(L2('다른 임무·기체는 ⏹ 임무 끝내기 → 웹 화면에서 고르기', 'Other missions or drones: ⏹ End mission → choose on the web page'), 36, y); y += 36;
  const RH = 60, RW = 50, row = (yy, lbl) => { g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '600 22px system-ui, sans-serif'; g.fillText(lbl, 36, yy + 14); };
  const afN = id => ({ x2d: 'Skydio X2D', anafi: 'ANAFI', fpv: L2('FPV 레이싱', 'FPV racer'), kfpv: L2('자폭 FPV', 'Kamikaze FPV'), fw: 'RQ-11 Raven', puma: 'RQ-20 Puma', kfw: L2('자폭 고정익', 'Loitering wing') })[id];
  row(y, L2('비행 모드', 'Flight mode')); [['train', L2('입문', 'Training')], ['easy', L2('쉬움 (P)', 'Easy (P)')], ['atti', 'ATTI'], ['sport', L2('스포츠', 'Sport')]].forEach(([v, n], i) => btn('diff:' + v, 190 + i * 200, y, 188, RW, n, SET.diff === v)); y += RH;
  row(y, L2('스틱', 'Sticks')); [[2, L2('모드 2', 'Mode 2')], [1, L2('모드 1', 'Mode 1')], [3, L2('머리 방향', 'Head steer')]].forEach(([v, n], i) => btn('mode:' + v, 190 + i * 200, y, 188, RW, n, (SET.vrMode || 2) === v)); y += RH;
  row(y, L2('카메라', 'Camera')); [['fpv', 'FPV', SET.vrCam !== 'chase'], ['c0', L2('추적 멀리', 'Chase far'), SET.vrCam === 'chase' && (SET.zoom | 0) === 0], ['c1', L2('추적 보통', 'Chase mid'), SET.vrCam === 'chase' && (SET.zoom | 0) === 1], ['c2', L2('추적 가까이', 'Chase near'), SET.vrCam === 'chase' && (SET.zoom | 0) === 2]].forEach(([v, n, on], i) => btn('cam:' + v, 190 + i * 200, y, 188, RW, n, on)); y += RH;
  row(y, L2('하부 카메라', 'Lower cam')); [[0, L2('끔', 'Off')], [90, '90°'], [60, '60°'], [45, '45°']].forEach(([v, n], i) => btn('pip:' + v, 190 + i * 200, y, 188, RW, n, (SET.vrPip | 0) === v)); y += RH;
  row(y, L2('시간대', 'Time')); [['day', L2('낮', 'Day'), SET.tod === 'day' && !ENV.ir], ['dusk', L2('해질녘', 'Dusk'), SET.tod === 'dusk' && !ENV.ir], ['night', L2('밤', 'Night'), SET.tod === 'night' && !ENV.ir], ['ir', L2('열화상', 'Thermal'), !!ENV.ir]].forEach(([v, n, on], i) => btn('env:' + v, 190 + i * 200, y, 188, RW, n, on)); y += RH;
  row(y, L2('날씨', 'Weather')); [['clear', L2('맑음', 'Clear')], ['rain', L2('비', 'Rain')], ['snow', L2('눈', 'Snow')]].forEach(([v, n], i) => btn('wx:' + v, 190 + i * 200, y, 188, RW, n, (SET.wx || 'clear') === v)); btn('wxfx', 790, y, 188, RW, L2('기상 영향 ', 'Effects ') + (SET.wxFx ? L2('켬', 'on') : L2('끔', 'off')), !!SET.wxFx); y += RH;
  row(y, L2('표시', 'Display')); btn('scr:head', 190, y, 188, RW, L2('고글 화면', 'Goggles'), SET.vrScreen !== 'space'); btn('scr:space', 390, y, 188, RW, L2('공간 화면', 'Fixed screen'), SET.vrScreen === 'space');
  btn('map', 590, y, 188, RW, L2('지도', 'Map'), SET.vrMap !== false); btn('guide', 790, y, 188, RW, L2('경로 안내', 'Guide'), !!SET.guide); y += RH;
  row(y, L2('스틱 반응', 'Stick feel')); [['real', L2('실기체 (선형)', 'Real (linear)')], ['soft', L2('부드럽게 (엑스포)', 'Soft (expo)')]].forEach(([v, n], i) => btn('expo:' + v, 190 + i * 200, y, 188, RW, n, stickExpo(true) === v)); y += RH;
  row(y, L2('계기', 'Instruments')); [['auto', L2('자동', 'Auto')], ['fpv', L2('간단 (FPV)', 'Simple (FPV)')], ['uas', L2('항공 (UAS)', 'Aviation (UAS)')]].forEach(([v, n], i) => btn('hud:' + v, 190 + i * 200, y, 188, RW, n + (v === 'auto' ? ' · ' + (hudMode() === 'uas' ? 'UAS' : 'FPV') : ''), (SET.hud || 'auto') === v)); y += RH + 4;
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '500 19px system-ui, sans-serif';
  g.fillText((SET.vrMode === 3 ? L2('머리 방향: 보는 쪽으로 비행 · 왼쪽 스틱 앞뒤 속도 · 오른쪽 스틱 옆·고도', 'Head steer: fly where you look · L-stick fwd/back speed · R-stick side·height') : (SET.vrMode || 2) === 2 ? L2('모드 2: 왼쪽 스틱 상승·회전 / 오른쪽 스틱 전후·좌우', 'Mode 2: left stick climb·yaw / right stick fwd·side') : L2('모드 1: 왼쪽 스틱 전후·회전 / 오른쪽 스틱 상승·좌우', 'Mode 1: left stick fwd·yaw / right stick climb·side')), 36, y);
  g.fillText(L2('R트리거 투하 · L트리거 부스트 · A 확인·사진 보고 · B 메뉴/계속', 'R-trigger drop · L-trigger boost · A ok/photo report · B menu/resume'), 36, y + 26);
  g.fillText(L2('X 조명 · Y 하부 카메라 · 왼쪽 스틱 누르기 카메라 · 오른쪽 스틱 누르기 열화상', 'X light · Y lower cam · L-stick click camera · R-stick click thermal'), 36, y + 52);
  const vi = voiceInfo(), eng = commEngine(), au = AU.ctx ? AU.ctx.state : L2('없음', 'none');
  g.fillStyle = eng === 'none' ? 'rgba(255,154,122,.95)' : 'rgba(93,255,154,.85)';
  g.fillText(L2('무전 음성: ', 'Radio voice: ') + (eng === 'natural' ? L2('자연 음성', 'natural voice') + (COMM.rvOk ? '' : '') : eng === 'synth' ? L2('내장 합성기', 'built-in synthesizer') + (TTSW.w ? '' : L2(' (불러오는 중)', ' (loading)')) : eng === 'web' ? vi.name : L2('없음 · 자막만', 'none · subtitles only')) + (COMM.fbOk || COMM.rvOk ? ' ✓' : '') + L2(' · 오디오 ', ' · audio ') + au + (COMM.fbErr ? ' · ' + String(COMM.fbErr).slice(0, 40) : ''), 36, y + 78);
  btn('vtest', 36, H2 - 76, 300, 56, L2('🔊 음성 테스트', '🔊 Voice test'), false);
  btn('exit', W2 - 380, H2 - 76, 344, 56, '⏹ ' + L2('임무 끝내기 · 웹 메뉴로', 'End mission · web menu'), false);
  g.fillStyle = 'rgba(255,255,255,.3)'; g.font = '500 16px monospace'; g.fillText('VR20', 360, H2 - 56);
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
  if (id === 'end') { if (REC) LAST_REC = recFinish(); toMenu(); XR.menu = true; XR.hover = null; return; }
  if (id === 'restart') { XR.menu = false; startRun(S.lastKind || S.kind); vrApplyCam(); if (SET.vrScreen === 'space') vrRecenter(); return; }
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
  if (id.startsWith('expo:')) { SET.expo = id.slice(5); saveSet(); syncExpo(); return; }
  if (id.startsWith('hud:')) { SET.hud = id.slice(4); saveSet(); syncHud(); return; }
  if (id.startsWith('pip:')) { SET.vrPip = +id.slice(4); saveSet(); return; }
  if (id === 'wxfx') { setWxFx(!SET.wxFx); return; }
  if (id.startsWith('wx:')) { setWx(id.slice(3)); return; }
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
  if (S.state === 'result') {
    const R = DBF.last, ph = (S.photos || []).filter(p => p.ok).slice(-4);
    g.fillStyle = 'rgba(6,10,14,.86)'; vrRR(g, 140, 60, 1000, 600, 22); g.fill(); g.strokeStyle = '#5dff9a'; g.lineWidth = 3; g.stroke();
    sh(($('resTitle') || {}).textContent || '', 170, 84, 40, '#5dff9a'); sh(($('resSub') || {}).textContent || '', 170, 134, 24, '#cfd6da');
    if (R) { sh(String(R.sc), 1100, 76, 64, '#ffc828', 'right'); sh(R.g, 1100, 146, 34, R.col, 'right');
      const L = [[L2('합계', 'Total'), `${fmt(R.total)}  (${L2('비행', 'flight')} ${fmt(S.t)} + ${L2('벌점', 'pen')} ${S.pen.toFixed(0)} s · ${L2('기준', 'par')} ${fmt(R.par || 0)})`], [L2('점수', 'Score'), `${L2('과제', 'tasks')} ${R.a}/55 · ${L2('시간', 'time')} ${R.b}/30 · ${L2('안전', 'safety')} ${R.c}/15`],
        [L2('과제', 'Tasks'), `${R.ok} / ${R.n}`], [L2('거리 · 최고 속도', 'Distance · top speed'), `${DBF.dist.toFixed(0)} m · ${(DBF.vmax * 3.6).toFixed(0)} km/h`], [L2('충돌 · 재출발', 'Impacts · restarts'), `${S.impacts || 0} · ${DBF.resp}`]];
      if (DBF.pens.length) L.push([L2('벌점 내역', 'Penalties'), DBF.pens.slice(0, 3).map(p => `+${p.d.toFixed(0)} ${String(p.why || '').split(' ')[0]}`).join(' · ') + (DBF.pens.length > 3 ? ' …' : '')]);
      L.forEach(([a, b], i) => { sh(a, 170, 196 + i * 40, 24, '#9fb0b8'); sh(b, 470, 196 + i * 40, 24, '#fff'); }); }
    ph.forEach((p, i) => { if (!p.im) { p.im = new Image(); p.im.src = p.url; } if (p.im.complete) g.drawImage(p.im, 170 + i * 236, 470, 220, 124); });
    sh(L2('A 다시 · B 메뉴', 'A again · B menu'), W2 / 2, 612, 28, '#ffc828', 'center'); tex.needsUpdate = true; return; }
  if (S.state === 'pause') { box([[L2('일시 정지', 'PAUSED'), 44, '#ffc828'], [L2('B: 메뉴', 'B: menu'), 30, '#e8eef2']], '#ffc828'); tex.needsUpdate = true; return; }
  if (S.state === 'menu') { tex.needsUpdate = true; return; }
  if (S.state === 'replay' && RP.rec) { const s0 = RP.rec.s[0][0], e0 = RP.rec.s[RP.rec.s.length - 1][0]; sh(`REPLAY  ${fmt(RP.t - s0)} / ${fmt(e0 - s0)}  ×${RP.speed}${RP.playing ? '' : '  ❚❚'}`, W2 / 2, 22, 40, '#4fe3ff', 'center');
    sh(L2('A 재생·멈춤 · 오른쪽 스틱 ←→ 5초 · Y 속도 · 왼쪽 스틱 누르기 카메라 · B 메뉴', 'A play/pause · R-stick ←→ 5 s · Y speed · L-stick click camera · B menu'), W2 / 2, H2 - 60, 26, '#e8eef2', 'center'); }
  const sb = S.state === 'demo' ? ghostS : S.state === 'replay' ? RP.pose : DR, gh = groundAt(sb.p.x, sb.p.z), sp = sb.v ? sb.v.length() : 0;
  // 화면 좌표: 게임 카메라(드론 카메라·추적 카메라)로 3D 점을 투영
  const prj = p => { const q = p.clone().project(camera); return { x: (q.x + 1) / 2 * W2, y: (1 - q.y) / 2 * H2, front: q.z < 1 && q.z > -1 }; };
  // 수평선 (기울기·높낮이)
  const UAS = hudMode() === 'uas' && SET.vrCam !== 'chase'; if (UAS) uasDraw(g, W2, H2, sb, isMission() ? msObj() : curObj(), searchIn(isMission() ? msObj() : curObj(), sb.p), H2 - 118);
  if (!UAS) { const f = new V3(0, 0, -1).applyQuaternion(camera.quaternion); f.y = 0; if (f.lengthSq() > 1e-4) { f.normalize(); const r = new V3(-f.z, 0, f.x), c = camera.position.clone().addScaledVector(f, 1000);
    const a = prj(c.clone().addScaledVector(r, -600)), b = prj(c.clone().addScaledVector(r, 600)); if (a.front && b.front) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.setLineDash([26, 14]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); } } }
  // 진행 방향 표시 (1초 뒤 위치): 지금 실제로 날아가는 쪽
  if (sp > 0.6) { const m = prj(sb.p.clone().addScaledVector(sb.v, 1.0)); if (m.front && m.x > 0 && m.x < W2 && m.y > 0 && m.y < H2) {
    g.strokeStyle = '#5dff9a'; g.lineWidth = 5; g.beginPath(); g.arc(m.x, m.y, 16, 0, Math.PI * 2); g.moveTo(m.x - 40, m.y); g.lineTo(m.x - 16, m.y); g.moveTo(m.x + 16, m.y); g.lineTo(m.x + 40, m.y); g.moveTo(m.x, m.y - 16); g.lineTo(m.x, m.y - 30); g.stroke(); } }
  // 다음 목표 표시: 화면 안이면 마름모, 밖이면 가장자리 화살표
  const o = isMission() ? msObj() : curObj();
  const sIn = searchIn(o, sb.p); if (sIn) sh(L2('수색 구역 안 · 눈과 열화상으로 찾기', 'In search area · find it by eye and thermal'), W2 / 2, 164, 24, '#ffc828', 'center');
  if (o && o.mk && S.state !== 'demo' && !sIn) { const t = o.mk.clone().project(camera), beh = t.z > 1; let x = t.x, y = t.y; if (beh) { x = -x; y = -y; }
    const inside = !beh && Math.abs(x) < 0.92 && Math.abs(y) < 0.88, dist = o.search ? Math.max(0, Math.hypot(o.mk.x - sb.p.x, o.mk.z - sb.p.z) - o.search.r) : camera.position.distanceTo(o.mk);
    if (inside) { const px = (x + 1) / 2 * W2, py = (1 - y) / 2 * H2; g.strokeStyle = '#ffc828'; g.lineWidth = 4; g.beginPath(); g.moveTo(px, py - 22); g.lineTo(px + 22, py); g.lineTo(px, py + 22); g.lineTo(px - 22, py); g.closePath(); g.stroke(); sh(Math.round(dist) + ' m', px, py + 28, 28, '#ffc828', 'center'); }
    else if (!UAS) { const an0 = Math.atan2(y, x), ex = Math.cos(an0) * 0.55, ey = Math.sin(an0) * 0.58, px = (ex + 1) / 2 * W2, py = (1 - ey) / 2 * H2, an = Math.atan2(-ey, ex);   // 안쪽 타원 위 (하부 카메라·지도와 안 겹치게)
      g.save(); g.translate(px, py); g.rotate(an); g.fillStyle = '#ffc828'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(34, 0); g.lineTo(-14, -24); g.lineTo(-4, 0); g.lineTo(-14, 24); g.closePath(); g.stroke(); g.fill(); g.restore();
      sh(Math.round(dist) + ' m', px - Math.cos(an) * 60, py - Math.sin(an) * 60 - 14, 28, '#ffc828', 'center'); } }
  // 큰 숫자 계기
  // 계기는 화면 가운데 가까이 (시선을 조금만 옮겨 보이게): 왼쪽 = 속도, 오른쪽 = 고도·상승률, 위 = 시간·목표·방위
  // 계기는 지도 둘레에 모음: 지도 위 = 고도·상승률·투하물, 지도 왼쪽 아래 = 속도 / 위쪽 가운데 = 시간·목표·방위
  const CX = W2 / 2, MX = W2 - 250, MYT = H2 - 330 - 34, MXR = MX + 198;
  if (S.state !== 'replay') sh(fmt(S.t || 0), CX, 26, 34, '#fff', 'center');
  if (!UAS) { sh(`${Math.round(sp * 3.6)}`, MX - 16, H2 - 150, 50, '#fff', 'right'); sh('km/h', MX - 16, H2 - 96, 22, '#cfd6da', 'right');
  sh(`${(sb.p.y - gh).toFixed(1)}`, MX, MYT - 150, 48, '#fff', 'left'); sh(L2('m 고도', 'm AGL'), MXR, MYT - 132, 22, '#cfd6da', 'right'); }
  const vs = sb.v ? sb.v.y : 0; if (!UAS) sh((vs > 0.15 ? '▲ ' : vs < -0.15 ? '▼ ' : '■ ') + Math.abs(vs).toFixed(1) + ' m/s', MX, MYT - 92, 24, Math.abs(vs) > 3 ? '#ff9a40' : '#e8eef2', 'left');
  if (!UAS) { const hdg = ((((SITE.brg || 0) + (sb.h || 0) * 180 / Math.PI) % 360) + 360) % 360; sh(String(Math.round(hdg)).padStart(3, '0') + '°', CX, 124, 30, '#e8eef2', 'center'); }
  if (o && S.state !== 'replay') sh('▸ ' + (o.label || MS_NAME[S.kind] || ''), CX, 70, 40, '#ffc828', 'center');
  if (S.state === 'demo') sh(L2('기준 비행', 'REFERENCE FLIGHT'), CX, 70, 38, '#4fe3ff', 'center');
  if (ENV.ir) sh('IR', MX - 16, H2 - 196, 28, '#ff9a40', 'right');
  { const n = S.kind === 'course' ? S.payloads || 0 : S.kind === 'sar' ? S.kits | 0 : S.kind === 'free' && AFc().drop ? droneM.cans.filter(c => c.visible).length : -1; if (S.state === 'run' && actionKind() === 'report') sh('📷 ' + L2('R트리거 · A = 사진 보고', 'R-trigger · A = report'), W2 - 250, H2 - 330 - 34 - 56, 22, '#5dff9a', 'left'); else if (n >= 0 && S.state === 'run') sh((S.kind === 'sar' ? 'KIT ' : 'M84 ') + ('●'.repeat(n) || '—'), W2 - 250, H2 - 330 - 34 - 56, 24, '#ffc828', 'left'); }
  if (SET.vrPip) sh(L2('하부 ', 'LOWER ') + SET.vrPip + '°', 40, H2 - 252, 24, '#ffc828');
  if (PH.last && PH.lastT > 0 && PH.last.complete) { g.globalAlpha = Math.min(1, PH.lastT); g.drawImage(PH.last, 40, 150, 288, 162); g.strokeStyle = PH.lastOk ? '#5dff9a' : '#ff9a40'; g.lineWidth = 4; g.strokeRect(40, 150, 288, 162); g.globalAlpha = 1; }
  if (false && ORDER.m) { const t = (window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en; g.font = '600 22px system-ui, sans-serif'; const ws = String(t).split(' '), L = []; let ln = ''; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 400 && ln) { L.push(ln); ln = w; } else ln = tl; } if (ln) L.push(ln); const LL = L.slice(0, 4), oy = 330;
    g.fillStyle = 'rgba(6,10,14,.55)'; g.fillRect(30, oy - 8, 430, 38 + LL.length * 28); g.fillStyle = '#ffc828'; g.fillRect(30, oy - 8, 4, 38 + LL.length * 28); sh(L2('📻 명령', '📻 ORDERS'), 44, oy, 20, '#ffc828'); LL.forEach((l, i) => sh(l, 44, oy + 28 + i * 28, 22, '#e8eef2')); }
  const r = $('radio'); if (r && r.classList.contains('show')) { const t = r.querySelector('.re') ? r.querySelector('.re').textContent : r.textContent; g.font = '600 28px system-ui, sans-serif'; const ws = t.split(' '); let ln = ''; const L = []; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 680 && ln) { L.push(ln); ln = w; } else ln = tl; } if (ln) L.push(ln); L.slice(-2).forEach((l, i) => sh(l, W2 / 2 - (UAS ? 0 : 70), (UAS ? 116 : H2 - 112) + i * 36, 28, '#9fe9ff', 'center')); }
  const m = $('objMsg'); if (m && m.classList.contains('show') && m.textContent.trim()) sh(m.textContent.trim(), W2 / 2, H2 / 2 + 90, 44, m.style.color || '#5dff9a', 'center');
  // 등고선 지도 (PC 화면처럼 오른쪽 아래, 가운데 쪽으로 당겨 둠)
  if (SET.vrMap !== false && ui.map) { const mw = 198, mh = 330, mx = W2 - 250, my = H2 - mh - 34; g.globalAlpha = 0.92; g.fillStyle = 'rgba(6,10,14,.75)'; g.fillRect(mx - 4, my - 4, mw + 8, mh + 8); g.filter = 'brightness(1.6) contrast(1.15)'; g.drawImage(ui.map, mx, my, mw, mh); g.filter = 'none'; g.globalAlpha = 1; g.strokeStyle = 'rgba(255,200,40,.8)'; g.lineWidth = 2; g.strokeRect(mx - 4, my - 4, mw + 8, mh + 8); }
  // 경로 안내 문구 (예: 고도 내리기 3.2 m (왼쪽 스틱 ↓))
  if (SET.guide) { const ge = $('guide'); if (ge && !ge.classList.contains('hidden')) { const L = [...ge.children].map(e => [e.textContent, e.className]).filter(x => x[0]).slice(0, 3); L.forEach(([t, c], i) => sh(t, W2 / 2 - (UAS ? 0 : 70), (UAS ? 196 : H2 - 200) + i * 38, 30, c === 'ok' ? '#5dff9a' : c === 'warn' ? '#ff9a40' : '#4fe3ff', 'center')); } }
  if (SET.vrCam !== 'chase' && !UAS) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(W2 / 2 - 22, H2 / 2); g.lineTo(W2 / 2 - 7, H2 / 2); g.moveTo(W2 / 2 + 7, H2 / 2); g.lineTo(W2 / 2 + 22, H2 / 2); g.moveTo(W2 / 2, H2 / 2 + 7); g.lineTo(W2 / 2, H2 / 2 + 16); g.stroke(); }
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
  // 한 파일판: 훈련장 고르기 버튼 (고르면 다시 불러옴) · PC 판 링크 숨김
  const L = sitesAll(), vb = document.querySelector('#vrBack .vb');
  if (vb && L.length > 1 && !$('vrSites')) { const d = document.createElement('div'); d.id = 'vrSites'; d.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center';
    for (const st of L) { const b = document.createElement('button'); b.textContent = stName(st); b.className = st.id === SITE.id ? 'primary' : ''; b.style.cssText = 'padding:10px 14px;font-size:15px'; b.onclick = () => { if (st.id === SITE.id) return; siteSelect(st.id); location.reload(); }; d.appendChild(b); }
    vb.insertBefore(d, $('vrBackGo')); }
  if (!window.SIM_BASE && $('vrPC')) $('vrPC').style.display = 'none';
  if ($('vrBack')) $('vrBack').classList.add('hidden');
}
function vrBtnUpdate() {   // PC 판: VR 기기에서 열면 VR 판으로 가는 버튼
  const b = $('msGoVR'); if (!b) return;
  b.classList.add('hidden'); const w = $('wzVR'); if (w) w.classList.add('hidden');   // 처음 화면에서 컴퓨터/VR 을 고르므로 중복 버튼은 숨김
  b.textContent = L2('Quest VR 버전 열기', 'Open the Quest VR version');
}
if ($('msGoVR')) $('msGoVR').onclick = () => { if (window.SIM_VR_URL) location.href = window.SIM_VR_URL + (window.SIM_LANG === 'en' ? 'en.html' : ''); };
if ($('vrBackGo')) $('vrBackGo').onclick = () => vrStart();

setAirframe(SET.af); afUI(); menuSel(MENU.ms);
Object.assign(window.__sim, { msObj, setWxFx, wxSense, SNOW_U, setTod, setWx, WX, SAR_POOL, MAPV, mxy, trackPose, debriefShow, DBF, RV, rvPlan, rvNorm, VID, exportReplayVideo, RP, getLastRec: () => LAST_REC, VR_MAP, vrMenuOpen, commEngine, TTSW, commSpeak, VR_PIP_RT: VR_PIP.rt, ENV, XR, VRS, VR_MENU, VR_OSD, VR_SCR, VR_RT, vrMenuClick, vrMenuHit, vrStart, vrStop, xrInput, VR_OK, getXR: () => XR_ON, DAMS, MENU, menuSel, menuGo, menuTab, LY, lyEdit, lyApply, comm, grid, COMM, WIND, windAt, SAR, TRACK, RIDGE, FIRE, irSet, ENV, envApply, AF, setAirframe, MS, msObj, FLANE, RACE, RECON, STRIKE, effMode });
// ---- 옵션 사용성: 탭 · 고른 값 설명 · 코스 화면의 빠른 설정 ----
(function optUX() {
  const P = $('optPanel'); if (!P || !$('optTabs')) return;
  const H = {
    segDiff: { train: ['느리고, 스틱을 놓으면 멈추고, 다음 과제 쪽으로 방향을 잡아 줍니다 · 처음 비행에', 'Slow, stops when you let go, turns toward the next task · for first flights'], easy: ['고도를 유지하고 약하게 보조합니다', 'Holds altitude with light assistance'], atti: ['위치를 잡아 주지 않고 자세만 유지 · 바람에 밀리고 관성으로 미끄러짐 · 실기체 감각', 'Holds attitude only, not position · drifts with wind and momentum · like the real aircraft'], sport: ['보조 없음 · 가장 빠르고 민감합니다', 'No assistance · fastest and most sensitive'] },
    segExpo: { real: ['스틱을 민 만큼 그대로 반응 · RC 조종기와 같은 느낌', 'Responds exactly to stick travel · feels like an RC transmitter'], soft: ['가운데 부근이 둔해서 미세 조종이 쉽습니다', 'Softer around centre for easy fine control'] },
    segAssist: { 1: ['자세·고도를 잡아 줍니다 (H 키로 켜기/끄기)', 'Steadies attitude and altitude (H toggles)'], 0: ['보조 없이 직접 조종합니다', 'You fly without assistance'] },
    segGuide: { 1: ['다음 과제 쪽 화살표를 보여 줍니다', 'Shows an arrow toward the next task'], 0: ['화살표 없이 지도와 무전만으로 찾아갑니다', 'No arrow · navigate by map and radio'] },
    segAcro: { 0: ['스틱을 놓으면 기체가 수평으로 돌아옵니다', 'The aircraft levels out when you let go'], 1: ['기울어진 채로 유지되는 완전 수동 · 숙련자용', 'Fully manual, stays banked · for experienced pilots'] },
    segTime: { 0: ['밝은 낮 · 가장 잘 보입니다', 'Daylight · best visibility'], 2: ['해가 낮아 그림자가 길고 역광이 생깁니다', 'Low sun, long shadows and glare'], 1: ['어두움 · IR 카메라와 조명이 중요합니다', 'Dark · IR camera and lights matter'] },
    segWx: { clear: ['비·눈을 고르면 시야가 줄고 산불 감시는 쉽니다', 'Rain or snow cuts visibility and stops fire watch'], rain: ['빗줄기·안개로 시야가 줄어듭니다 · 산불 감시 불가', 'Rain and fog cut visibility · no fire watch'], snow: ['땅과 나무가 눈에 덮입니다 · 산불 감시 불가', 'Ground and trees under snow · no fire watch'] },
    segWxFx: { 0: ['날씨는 보이기만 하고 비행에는 영향 없음', 'Weather is visual only'], 1: ['돌풍이 불고 카메라·센서 시야가 떨어집니다', 'Gusts, and reduced camera and sensor range'] },
    segWind: { 0: ['바람 없음', 'Calm'], 1: ['정지 비행이 조금씩 밀립니다', 'Hover drifts a little'], 2: ['제자리에서도 계속 수정 조작이 필요합니다', 'Constant correction needed even in a hover'] },
    segHud: { auto: ['기체 종류에 맞춰 자동으로 고릅니다', 'Picked automatically for the airframe'], fpv: ['고도·속도 숫자 위주의 간단한 표시', 'Simple altitude and speed readouts'], uas: ['피치 사다리 · 속도·고도 테이프 · HSI 방위계', 'Pitch ladder, speed and altitude tapes, HSI'] },
    segBelly: { 1: ['투하·선회 때 아래 화면이 자동으로 뜹니다', 'Lower view appears automatically for drops and orbits'], 0: ['X 키를 눌렀을 때만 봅니다', 'Only when you press X'] },
    segFull: { 1: ['출격할 때 전체 화면으로 바꿉니다', 'Switches to full screen at launch'], 0: ['창 크기 그대로 비행합니다', 'Stays in the window'] },
    segVoice: { 1: ['CONTROL(남)·EAGLE ONE(여) 영어 무전을 소리로 들려줍니다', 'Plays CONTROL (male) and EAGLE ONE (female) radio'], 0: ['무전은 글자로만 보입니다', 'Radio shown as text only'] },
    segMusic: { 1: ['배경음악 켬 · 오른쪽 막대로 크기 조절', 'Music on · slider sets the level'], 0: ['배경음악 끔', 'Music off'] },
    segKeys: { A: ['W/S 상승·하강 · A/D 회전 · 방향키 이동', 'W/S climb·descend · A/D yaw · arrows move'], B: ['방향키로 고도·회전, WASD로 이동', 'Arrows for altitude and yaw, WASD to move'], C: ['키를 하나씩 직접 지정합니다', 'Assign every key yourself'] },
  };
  const segV = id => { const b = $(id) && $(id).querySelector('button.on'); return b ? b.dataset.v : null; };
  const segT = id => { const b = $(id) && $(id).querySelector('button.on'); return b ? b.textContent.replace(/\s*\(.*\)\s*$/, '').trim() : '—'; };
  Object.keys(H).forEach(id => { const s = $(id); if (!s) return; const h = document.createElement('small'); h.className = 'oh'; h.dataset.for = id; s.parentNode.insertBefore(h, s.nextSibling); });
  // 빠른 설정 (코스 고르는 화면)
  const QS = [['segDiff', '🎚', '난이도', 'Mode'], ['segWind', '💨', '바람', 'Wind'], ['segWxFx', '⛈', '기상 영향', 'Weather fx'], ['segHud', '📟', '계기', 'HUD'], ['segGuide', '🧭', '가이드', 'Guide'], ['segVoice', '🔊', '음성', 'Voice']];
  const bar = $('qsBar');
  const draw = () => {
    P.querySelectorAll('small.oh').forEach(h => { const m = H[h.dataset.for], v = segV(h.dataset.for), t = m && m[v]; h.textContent = t ? L2(t[0], t[1]) : ''; });
    if (bar) bar.querySelectorAll('button[data-s]').forEach(b => { b.querySelector('b').textContent = segT(b.dataset.s); const m = H[b.dataset.s], t = m && m[segV(b.dataset.s)]; b.title = t ? L2(t[0], t[1]) : ''; });
  };
  if (bar) {
    bar.innerHTML = QS.map(([id, ic, ko, en]) => `<button data-s="${id}">${ic} ${L2(ko, en)}<b></b></button>`).join('') + `<button class="all">⚙ ${L2('모든 옵션', 'All options')}</button>`;
    bar.querySelectorAll('button[data-s]').forEach(b => b.onclick = () => {
      const bs = [...$(b.dataset.s).querySelectorAll('button')].filter(x => !x.disabled), i = bs.findIndex(x => x.classList.contains('on'));
      const nx = bs[(i + 1) % bs.length]; if (nx) nx.click();
      b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); setTimeout(draw, 0);
    });
    bar.querySelector('.all').onclick = () => optOpen();
  }
  // 탭
  let last = 'fly';
  const tab = t => { last = t; $('optTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); P.querySelectorAll('.otab').forEach(d => d.classList.toggle('on', d.dataset.t === t)); };
  $('optTabs').querySelectorAll('button').forEach(b => b.onclick = () => tab(b.dataset.t));
  window.optOpen = t => { tab(t || last); openPanel('optPanel'); draw(); };
  tab('fly');
  if ($('bOpt')) $('bOpt').onclick = () => optOpen();
  if ($('bPauseOpt')) $('bPauseOpt').onclick = () => optOpen();
  if ($('bSet')) $('bSet').onclick = () => optOpen('gis');
  new MutationObserver(() => draw()).observe(P, { subtree: true, attributes: true, attributeFilter: ['class'] });
  draw();
})();
})();
