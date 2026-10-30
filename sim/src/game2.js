
// =====================================================================
//  drone model — Skydio X2D 형상 (펼친 크기 66 x 57 x 21 cm, 1.3 kg)
//  앞 = -z. 접이식 팔 4개(앞 팔은 프로펠러 위, 뒤 팔은 거꾸로 달린 모터),
//  기수 아래 짐벌(컬러 + 열상 2안), 위·아래 내비게이션 어안 카메라 6개, 뒤쪽 멀티밴드 안테나
// =====================================================================
// 기체 색 (어두운 숲·밤 배경에서 잘 보이게): setAirframe·격납고가 PAINT 를 정해 두고 모델을 새로 만듦 · null = 원래 색
//  pm(원래 색, 재질, 1 = 큰 면 · 2 = 어두운 면) — 칠한 색은 살짝 스스로 빛나게 (그늘·해질녘에도 보이게)
var PAINT = null;
// 단색은 숫자, 위장색은 ['camo'|'pix', 바탕, 무늬1, 무늬2, 무늬3] (camo = 얼룩 · pix = 픽셀)
const PAINTS = { white: 0xeef1f4, orange: 0xff7a1a, yellow: 0xffd23a, red: 0xe8322b, cyan: 0x3fc8ff, lime: 0x9ae63a, black: 0x1d1f22,
  wood: ['camo', 0x4f5c3c, 0x2e3a26, 0x6b5a3a, 0x1c2118], desert: ['camo', 0xc4aa7c, 0xa58b5e, 0x8a6d44, 0xdcc79e], digital: ['pix', 0x8a9484, 0x66745f, 0xa8b0a1, 0x4b564a], snow: ['camo', 0xe9edf0, 0xbcc5cb, 0x89939a, 0xf5f7f9],
  ocp: ['camo', 0x8b8566, 0x5e6a46, 0x6d5a3e, 0xb3a98a], rok: ['pix', 0x6f7a5a, 0x3d4a35, 0x8a7d5c, 0x242a22], urban: ['pix', 0x8c9196, 0x5a6066, 0xb9bec3, 0x33373b], navy: ['camo', 0x5d6b7a, 0x3e4a57, 0x7d8b99, 0x2b333c] };   // 멀티캠 · 화강암(국군 디지털) · 도시 · 해상
const CAMO_TX = {}, CAMO_M = 0.3;   // 위장 무늬 한 장 = 0.3 m (상자 면은 실제 크기대로 펴서 무늬 크기가 어디서나 같게)
function camoTex(key) {
  if (CAMO_TX[key]) return CAMO_TX[key];
  const P = PAINTS[key], pix = P[0] === 'pix', cols = P.slice(1).map(c => '#' + c.toString(16).padStart(6, '0'));
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = cols[0]; g.fillRect(0, 0, N, N);
  if (pix) {   // 거친 값 잡음 → 4색 양자화 → 8px 블록
    const G = 6, V = []; for (let i = 0; i < (G + 1) * (G + 1); i++) V.push(rnd());
    const at = (u, v) => { const x = u * G, y = v * G, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, q = (a, b) => V[((b % G) + G) % G * (G + 1) + ((a % G) + G) % G]; return (q(i, j) * (1 - fx) + q(i + 1, j) * fx) * (1 - fy) + (q(i, j + 1) * (1 - fx) + q(i + 1, j + 1) * fx) * fy; };
    const B = 8; for (let y = 0; y < N; y += B) for (let x = 0; x < N; x += B) { const v = at(x / N, y / N) + (rnd() - 0.5) * 0.22; g.fillStyle = cols[v < 0.36 ? 1 : v < 0.52 ? 0 : v < 0.68 ? 2 : 3]; g.fillRect(x, y, B, B); }
  } else {   // 얼룩: 타원 몇 개를 겹쳐 한 덩이 · 가장자리로 넘어가면 반대쪽에도 그려 이어지게
    for (let i = 0; i < 64; i++) { g.fillStyle = cols[1 + Math.floor(rnd() * 3)]; const x = rnd() * N, y = rnd() * N, r = 16 + rnd() * 26, a = rnd() * Math.PI;
      for (let k = 0; k < 3; k++) { const dx = (rnd() - 0.5) * r, dy = (rnd() - 0.5) * r, rr = r * (0.6 + rnd() * 0.5);
        for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) { g.beginPath(); g.ellipse(x + dx + ox, y + dy + oy, rr, rr * (0.45 + rnd() * 0.4), a + k * 0.7, 0, 7); g.fill(); } } }
  }
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; CAMO_TX[key] = t; return t;
}
function pm(def, o, role) {
  if (!PAINT) return mat(def, o);
  if (Array.isArray(PAINT)) {   // 위장: 무늬 지도 · 어두운 면은 조금 어둡게 · 아주 살짝 자체 발광 (해질녘에 검은 덩어리로만 보이지 않게)
    const t = camoTex(PAINT.key), m = mat(role === 2 ? 0x9a9a9a : 0xffffff, Object.assign({}, o, { map: t, metalness: 0, roughness: Math.max(0.6, (o && o.roughness) || 0.6) }));
    m.emissive = new THREE.Color(0xffffff); m.emissiveMap = t; m.emissiveIntensity = 0.05; m.userData.paint = true; return m;
  }
  const c = new THREE.Color(PAINT); if (role === 2) c.multiplyScalar(0.6);
  const m = mat(c.getHex(), Object.assign({}, o, { metalness: Math.min(0.2, (o && o.metalness) || 0) })); m.emissive = c.clone(); m.emissiveIntensity = role === 2 ? 0.08 : 0.16; m.userData.paint = true; return m;
}
// 상자 면을 실제 크기(m)대로 편 UV: 위장 무늬가 긴 날개에서도 늘어나지 않게 (칠한 상자에만)
function boxUV(sx, sy, sz) {
  const g = UBOX.clone(), uv = g.attributes.uv, F = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];   // BoxGeometry 면 순서: +x −x +y −y +z −z
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * F[f][0] / CAMO_M, uv.getY(i) * F[f][1] / CAMO_M); }
  return g;
}
function paintGeo(geo, mt, sx, sy, sz) { return (geo === UBOX && sx && mt && mt.userData && mt.userData.paint && mt.map) ? boxUV(sx, sy, sz) : geo; }
function makeDrone(ghost) {
  const g = new THREE.Group();
  const gm = ghost ? new THREE.MeshBasicMaterial({ color: 0x55e6ff, transparent: true, opacity: 0.38, depthWrite: false }) : null;
  const m = c => gm || c;
  const shell = m(pm(0x34383d, { roughness: 0.55, metalness: 0.15 }, 1)), shellD = m(pm(0x22252a, { roughness: 0.6 }, 2));
  const carbon = m(pm(0x1b1d20, { roughness: 0.42, metalness: 0.25 }, 2)), batt = m(pm(0x55595f, { roughness: 0.5 }, 1));   // 팔(탄소)도 칠하면 어두운 숲에서 모양이 보임
  const mot = m(mat(0x8d9297, { roughness: 0.3, metalness: 0.8 })), glass = m(mat(0x0a1420, { roughness: 0.05, metalness: 0.6 }));
  const lensRing = m(mat(0x101215, { roughness: 0.3, metalness: 0.4 })), accent = m(mat(0xc8ccd0, { roughness: 0.4, metalness: 0.3 }));
  const add = (geo, mt, x, y, z, sx, sy, sz, par) => { const me = new THREE.Mesh(paintGeo(geo, mt, sx, sy, sz), mt); me.position.set(x, y, z); if (sx) me.scale.set(sx, sy, sz); me.castShadow = !ghost; (par || g).add(me); return me; };
  // 몸통: 각진 납작한 판 세 장 (실물처럼 모서리가 깎인 육각 평면형 · 앞이 좁고 뒤가 넓음) — 아래 판(어두움) · 가운데 몸통 · 위 등마루
  //   plate(): (x, 앞+) 평면 다각형을 위로 두께만큼 뽑고 모서리를 둥글림. y0 = 바닥 높이
  const plate = (pts, th, bev, mt, y0, mirror) => { const sh = new THREE.Shape(); const P = mirror ? pts.concat(pts.slice().reverse().map(([x, y]) => [-x, y])) : pts; sh.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) sh.lineTo(P[i][0], P[i][1]); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: th - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3 }); geo.rotateX(-Math.PI / 2); geo.translate(0, y0 + bev, 0); if (typeof uvScale === 'function') uvScale(geo, mt);
    const me = new THREE.Mesh(geo, mt); me.castShadow = !ghost; g.add(me); return me; };
  plate([[0.02, 0.165], [0.046, 0.095], [0.06, -0.02], [0.056, -0.12], [0.036, -0.165], [0.018, -0.172]], 0.022, 0.004, shellD, -0.03, true);             // 아래 판
  plate([[0.022, 0.175], [0.05, 0.1], [0.064, -0.02], [0.06, -0.12], [0.04, -0.17], [0.02, -0.18]], 0.045, 0.008, shell, -0.012, true);                     // 몸통 (앞 좁고 뒤 넓음)
  plate([[0.01, 0.13], [0.026, 0.07], [0.034, -0.03], [0.03, -0.12], [0.012, -0.15]], 0.018, 0.006, shell, 0.03, true);                                   // 등마루
  // 배터리 (뒤에서 밀어 넣는 팩 · 밝은 회색 끝면) + 걸쇠 · 옆 배기구
  add(UBOX, batt, 0, 0.01, 0.14, 0.08, 0.034, 0.07);
  add(UBOX, accent, 0, 0.03, 0.165, 0.044, 0.005, 0.012);
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) add(UBOX, shellD, sx * 0.058, 0.004 + k * 0.009, 0.06, 0.004, 0.003, 0.05);
  // 발 (앞 둘 · 뒤 둘, 고무)
  for (const [x, z] of [[-0.03, -0.11], [0.03, -0.11], [-0.04, 0.12], [0.04, 0.12]]) add(UCYL, carbon, x, -0.04, z, 0.006, 0.018, 0.006);
  // 기수 짐벌: 둥근 하우징 + 두 렌즈 (컬러 · 열상)
  const gim = new THREE.Group(); gim.position.set(0, -0.03, -0.165); g.add(gim);
  add(USPH, shellD, 0, 0, 0, 0.034, 0.03, 0.03, gim);
  add(UCYL, lensRing, -0.012, 0, -0.026, 0.011, 0.012, 0.011, gim).rotation.x = Math.PI / 2;
  add(UCYL, glass, -0.012, 0, -0.033, 0.008, 0.004, 0.008, gim).rotation.x = Math.PI / 2;
  add(UCYL, lensRing, 0.013, 0, -0.025, 0.008, 0.012, 0.008, gim).rotation.x = Math.PI / 2;
  add(UCYL, m(mat(0x1a1408, { roughness: 0.1, metalness: 0.7 })), 0.013, 0, -0.031, 0.006, 0.004, 0.006, gim).rotation.x = Math.PI / 2;
  // 내비게이션 어안 카메라 6개 (위 3 · 아래 3)
  for (const [x, y, z] of [[0, 0.036, -0.1], [-0.045, 0.036, 0.1], [0.045, 0.036, 0.1], [0, -0.033, -0.09], [-0.045, -0.033, 0.1], [0.045, -0.033, 0.1]]) {
    add(UCYL, lensRing, x, y, z, 0.011, 0.008, 0.011);
    add(USPH, glass, x, y + Math.sign(y) * 0.004, z, 0.008, 0.005, 0.008);
  }
  // 팔 + 모터 + 프로펠러 (앞: 위로, 뒤: 아래로)
  const props = [], blur = gm || new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const bladeM = m(mat(0x26292d, { roughness: 0.45 })), PR = 0.092;
  const ARMS = [[0.24, -0.17, -0.04, 1], [-0.24, -0.17, -0.04, 1], [0.235, 0.19, -0.02, -1], [-0.235, 0.19, -0.02, -1]];
  for (const [x, z, root, up] of ARMS) {
    const rx = Math.sign(x) * 0.045, rz = Math.sign(z) * 0.07, dx = x - rx, dz = z - rz, L = Math.hypot(dx, dz);
    { const sh = new THREE.Shape(); sh.moveTo(-0.022, 0); sh.lineTo(0.022, 0); sh.lineTo(0.014, L); sh.lineTo(-0.014, L); sh.closePath();   // 팔: 뿌리가 넓고 끝이 좁은 납작한 날개꼴 (실물의 접이식 탄소 팔)
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }); geo.rotateX(-Math.PI / 2); geo.translate(0, -0.008, 0); if (typeof uvScale === 'function') uvScale(geo, carbon);
      const arm = new THREE.Mesh(geo, carbon); arm.position.set(rx, root, rz); arm.rotation.y = Math.atan2(dx, dz) + Math.PI; arm.castShadow = !ghost; g.add(arm); }
    add(UCYL, carbon, rx, root, rz, 0.02, 0.022, 0.02);                        // 접힘 힌지
    const my = root + up * 0.017;
    add(UCYL, mot, x, my, z, 0.021, 0.026, 0.021);
    add(USPH, carbon, x, root - up * 0.004, z, 0.027, 0.014, 0.027);           // 모터 받침 (둥근 포드)
    add(UCYL, carbon, x, root, z, 0.026, 0.012, 0.026);
    const py = my + up * 0.016;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(PR, 28), blur); disc.rotation.x = -Math.PI / 2; disc.position.set(x, py, z); g.add(disc);
    const hub = new THREE.Group(); hub.position.set(x, py, z); g.add(hub);
    for (const s of [1, -1]) { const b = add(UBOX, bladeM, s * PR * 0.5, 0, 0, PR, 0.003, 0.023, hub); b.rotation.x = s * 0.2; }
    add(UCYL, accent, 0, up * 0.004, 0, 0.007, 0.008, 0.007, hub);
    props.push(hub);
  }
  // 멀티밴드 안테나 2개 (뒤)
  for (const sx of [-1, 1]) { const a = add(UCYL6, shellD, sx * 0.03, 0.07, 0.15, 0.0035, 0.07, 0.0035); a.rotation.x = -0.35; }
  // 투하 모듈 (훈련용 부가장치) — 배 아래 3발
  add(UBOX, carbon, 0, -0.04, 0.02, 0.11, 0.008, 0.07);
  const cans = [], canM = m(mat(0x7c8288, { roughness: 0.45, metalness: 0.5 }));
  for (const x of [-0.036, 0, 0.036]) { const c = add(UCYL, canM, x, -0.06, 0.02, 0.015, 0.09, 0.015); c.rotation.x = Math.PI / 2; cans.push(c); }
  // 항법등: 앞 팔 끝 녹/적, 뒤 흰색 섬광
  const LM = c => gm || new THREE.MeshBasicMaterial({ color: c });
  const ledG = add(USPH, LM(0x30ff60), 0.24, -0.052, -0.17, 0.008, 0.008, 0.008);
  const ledR = add(USPH, LM(0xff3030), -0.24, -0.052, -0.17, 0.008, 0.008, 0.008);
  add(USPH, LM(0xffffff), 0, 0.018, 0.168, 0.007, 0.007, 0.007);
  return { g, props, cans, leds: [ledG, ledR] };
}
let droneM = makeDrone(false); scene.add(droneM.g);
let ghostM = makeDrone(true); scene.add(ghostM.g); ghostM.g.visible = false;
const spot = new THREE.SpotLight(0xfff2dc, 0, 14, 0.7, 0.45, 1.2);
scene.add(spot); const spotT = new THREE.Object3D(); scene.add(spotT); spot.target = spotT;   // 드론이 안 보이는(FPV) 상태에서도 켜지도록 장면에 직접 둠

// =====================================================================
//  reference (ghost) path from the Blender flight
// =====================================================================
const GH = (function () {
  const wp = D.wp; const pts = wp.map(w => W(w[0], w[1], Math.max(w[2], 0.17)));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const N = 5000, P = [], T = [], LB = []; let t = 0, prev = curve.getPoint(0);
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = curve.getPoint(u);
    if (i > 0) {
      const f = u * (wp.length - 1), k = Math.min(Math.floor(f), wp.length - 2), fr = f - k;
      const sp = Math.max(lerp(wp[k][3], wp[k + 1][3], fr), 1.2);
      t += p.distanceTo(prev) / sp;
    }
    P.push(p); T.push(t); prev = p;
  }
  // 라벨 시각 (투하 등)
  const events = [];
  wp.forEach((w, i) => { if (w[4]) { const u = i / (wp.length - 1); events.push({ t: T[Math.round(u * N)], label: w[4] }); } });
  const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(1500));
  const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0xffc828, dashSize: 0.8, gapSize: 0.6, transparent: true, opacity: 0.85 }));
  line.computeLineDistances(); line.visible = false; scene.add(line);
  function at(time, out) {
    if (time <= 0) return out.copy(P[0]);
    if (time >= t) return out.copy(P[N]);
    let lo = 0, hi = N; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid] < time) lo = mid; else hi = mid; }
    return out.copy(P[lo]).lerp(P[hi], (time - T[lo]) / Math.max(T[hi] - T[lo], 1e-6));
  }
  return { at, total: t, events, line };
})();

// =====================================================================
//  objectives
// =====================================================================
const OBJS = [];
function hintMat() { return new THREE.MeshBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }); }
function addHint(b, geo, lx, ly, lz, rotX) { const me = new THREE.Mesh(geo, hintMat()); me.position.set(lx, lz, -ly); if (rotX) me.rotation.x = rotX; me.visible = false; me.renderOrder = 5; b.g.add(me); return me; }
function passObj(id, label) {
  const b = OBJ[id], p = b.pass; let hint, mk;
  if (p.kind === 'sq') { hint = addHint(b, new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0), 0, 0, (p.z0 + p.z1) / 2); mk = b.world(0, 0, p.z1 + 0.9); }
  else if (p.kind === 'ring') { hint = addHint(b, new THREE.CircleGeometry(p.r, 40), 0, 0, p.zc); mk = b.world(0, 0, p.zc + p.r + 0.9); }
  else if (p.kind === 'tri') {
    const s = new THREE.Shape(); s.moveTo(p.A[0], p.A[1]); s.lineTo(p.B[0], p.B[1]); s.lineTo(p.C[0], p.C[1]); s.lineTo(p.A[0], p.A[1]);
    hint = addHint(b, new THREE.ShapeGeometry(s), 0, 0, 0); mk = b.world(0, 0, p.C[1] + 1.0);
  } else if (p.kind === 'tunnel') { hint = addHint(b, new THREE.CircleGeometry(p.r, 40), 0, -p.L / 2 - 0.02, p.zc); mk = b.world(0, -p.L / 2, p.zc + p.r + 1.2); }
  OBJS.push({ kind: 'pass', b, label, hint, mk });
}
// 현장 전용 코스: course.order 순서대로 과제 생성 (영인산 등)
function buildObjectivesOrder(order) {
  const ringGeo = new THREE.RingGeometry(1.2, 1.45, 40);
  const ringHint = (pos) => { const me = new THREE.Mesh(ringGeo, hintMat()); me.material.opacity = 0.55; me.material.depthTest = false; me.renderOrder = 7; me.rotation.x = -Math.PI / 2; me.position.copy(pos).setY(groundAt(pos.x, pos.z) + 0.05); me.visible = false; scene.add(me); return me; };
  const ps = BY.pad_start;
  for (const st of order) {
    if (st.t === 'takeoff') OBJS.push({ kind: 'takeoff', label: 'TAKEOFF', mk: W(ps.down, ps.side, 2.4) });
    else if (st.t === 'pass' && OBJ[st.id]) passObj(st.id, st.label);
    else if (st.t === 'slalom' && OBJ[st.id]) {
      const b = OBJ[st.id], sg = st.sg, hint = addHint(b, new THREE.PlaneGeometry(1.1, 3.2), sg * 0.85, 0, 1.9);
      OBJS.push({ kind: 'slalom', b, sg, label: st.label, hint, mk: b.world(sg * 0.85, 0, 4.0) });
    } else if (st.t === 'drop') {
      if (st.target === 'ivan') { const iv = OBJ.ivan_grp1; OBJS.push({ kind: 'drop', target: 'ivan', label: st.label, hint: ringHint(iv.world(0, 0, 0)), mk: iv.world(0, 0, 4.2) }); }
      else if (st.target === 'mit') { const mit = OBJ.mit; OBJS.push({ kind: 'drop', target: 'mit', label: st.label, hint: ringHint(mit.world(0, 0, 0)), mk: mit.world(0, 0, 4.2), follow: true }); }
      else if (st.target === 'tank') { const tk = OBJ.tank, th = ringHint(tk.world(0, 0, 0)); th.scale.set(4, 4, 4); OBJS.push({ kind: 'drop', target: 'tank', label: st.label, hint: th, mk: tk.world(0, 0, 5.5) }); }
    } else if (st.t === 'orbit') {
      const tk = OBJ[st.id], R = st.R || 12, oh = new THREE.Mesh(new THREE.RingGeometry(R - 0.7, R + 0.7, 96), hintMat()); oh.material.opacity = 0.35; oh.material.depthTest = false; oh.renderOrder = 7; oh.rotation.x = -Math.PI / 2;
      oh.position.copy(tk.world(0, 0, 0)).add(new V3(0, 0.06, 0)); oh.visible = false; scene.add(oh);
      OBJS.push({ kind: 'orbit', b: tk, R, label: st.label, hint: oh, mk: tk.world(0, 0, 8) });
    } else if (st.t === 'bunker') {
      const bk = OBJ[st.id], wn = bk.win, w2 = bk.win2;
      const bh = addHint(bk, new THREE.PlaneGeometry(wn.x1 - wn.x0, wn.z1 - wn.z0), wn.xc, wn.y - 0.02, wn.zc);
      const bh2 = addHint(bk, new THREE.PlaneGeometry(w2.y1 - w2.y0, w2.z1 - w2.z0), w2.x - 0.02, 0, w2.zc); bh2.rotation.y = Math.PI / 2;
      OBJS.push({ kind: 'bunker', b: bk, label: st.label, hint: bh, hint1: bh, hint2: bh2, mk: bk.world(wn.xc, wn.y, bk.dims.h + 1.4),
        mk1: bk.world(wn.xc, wn.y, bk.dims.h + 1.4), mk2: bk.world(w2.x - 0.6, 0, bk.dims.h + 1.4) });
    } else if (st.t === 'land') {
      const pl = OBJ[st.id]; const lh = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 40), hintMat()); lh.material.opacity = 0.7; lh.material.depthTest = false; lh.renderOrder = 7;
      lh.rotation.x = -Math.PI / 2; lh.position.copy(pl.world(0, 0, 0.18)); lh.visible = false; scene.add(lh);
      OBJS.push({ kind: 'land', b: pl, label: st.label, hint: lh, mk: pl.world(0, 0, 1.8) });
    }
  }
}
function buildObjectives() {
  if (CRS_C && CRS_C.order) return buildObjectivesOrder(CRS_C.order);
  const ps = BY.pad_start;
  OBJS.push({ kind: 'takeoff', label: 'TAKEOFF', mk: W(ps.down, ps.side, 2.4) });
  passObj('ring_a', 'RING');
  passObj('gate_sq1', 'WINDOW GATE 1');
  passObj('gate_tri1', 'TRIANGLE GATE');
  passObj('gate_sq2', 'WINDOW GATE 2');
  const poles = ['pole1', 'pole2', 'pole3', 'pole4', 'pole5', 'pole6'].map(i => BY[i]).sort((a, b) => a.down - b.down);
  const sd = p => p.side0 !== undefined ? p.side0 : p.side;   // 경로 코스는 원래 레인 기준 좌우
  const cen = poles.reduce((s, p) => s + sd(p), 0) / poles.length;
  poles.forEach((p, k) => {
    const sg = Math.abs(sd(p) - cen) < 0.05 ? (k % 2 ? -1 : 1) : (sd(p) < cen ? 1 : -1);
    const b = OBJ[p.id];
    const hint = addHint(b, new THREE.PlaneGeometry(1.1, 3.2), sg * 0.85, 0, 1.9);
    OBJS.push({ kind: 'slalom', b, sg, label: `SLALOM ${k + 1}/6 · ${sg > 0 ? 'RIGHT' : 'LEFT'} SIDE`, hint, mk: b.world(sg * 0.85, 0, 4.0) });
  });
  const ringGeo = new THREE.RingGeometry(1.2, 1.45, 40);
  const ringHint = (pos) => { const me = new THREE.Mesh(ringGeo, hintMat()); me.material.opacity = 0.55; me.material.depthTest = false; me.renderOrder = 7; me.rotation.x = -Math.PI / 2; me.position.copy(pos).setY(groundAt(pos.x, pos.z) + 0.05); me.visible = false; scene.add(me); return me; };
  const iv = OBJ.ivan_grp1;
  OBJS.push({ kind: 'drop', target: 'ivan', label: 'DROP 1 · IVAN', hint: ringHint(iv.world(0, 0, 0)), mk: iv.world(0, 0, 4.2) });
  const mit = OBJ.mit;
  OBJS.push({ kind: 'drop', target: 'mit', label: 'DROP 2 · MIT (MOVING)', hint: ringHint(mit.world(0, 0, 0)), mk: mit.world(0, 0, 4.2), follow: true });
  const tk = OBJ.tank;
  const oh = new THREE.Mesh(new THREE.RingGeometry(11.3, 12.7, 96), hintMat()); oh.material.opacity = 0.35; oh.material.depthTest = false; oh.renderOrder = 7; oh.rotation.x = -Math.PI / 2;
  oh.position.copy(tk.world(0, 0, 0)).add(new V3(0, 0.06, 0)); oh.visible = false; scene.add(oh);
  OBJS.push({ kind: 'orbit', b: tk, R: 12, label: 'TANK ORBIT · 360°', hint: oh, mk: tk.world(0, 0, 8) });
  const th = ringHint(tk.world(0, 0, 0)); th.scale.set(4, 4, 4);
  OBJS.push({ kind: 'drop', target: 'tank', label: 'DROP 3 · TANK', hint: th, mk: tk.world(0, 0, 5.5) });
  passObj('tunnel1', 'TUNNEL');
  const bk = OBJ.bunker1, wn = bk.win;
  const bh = addHint(bk, new THREE.PlaneGeometry(wn.x1 - wn.x0, wn.z1 - wn.z0), wn.xc, wn.y - 0.02, wn.zc);
  const w2 = bk.win2;
  const bh2 = addHint(bk, new THREE.PlaneGeometry(w2.y1 - w2.y0, w2.z1 - w2.z0), w2.x - 0.02, 0, w2.zc); bh2.rotation.y = Math.PI / 2;
  OBJS.push({ kind: 'bunker', b: bk, label: 'BUNKER RECON', hint: bh, hint1: bh, hint2: bh2, mk: bk.world(wn.xc, wn.y, bk.dims.h + 1.4),
    mk1: bk.world(wn.xc, wn.y, bk.dims.h + 1.4), mk2: bk.world(w2.x - 0.6, 0, bk.dims.h + 1.4) });
  passObj('gate_finish', 'FINISH GATE');
  const pl = OBJ.pad_land; const lh = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 40), hintMat()); lh.material.opacity = 0.7; lh.material.depthTest = false; lh.renderOrder = 7;
  lh.rotation.x = -Math.PI / 2; lh.position.copy(pl.world(0, 0, 0.18)); lh.visible = false; scene.add(lh);
  OBJS.push({ kind: 'land', b: pl, label: 'LAND · RIGHT H-PAD', hint: lh, mk: pl.world(0, 0, 1.8) });
}
buildObjectives();
const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: 0xffc828, transparent: true, opacity: 0.9, depthTest: false, fog: false }));
marker.scale.set(1, 1.5, 1); marker.renderOrder = 999; scene.add(marker); marker.visible = false;

// =====================================================================
//  effects (impact flash + smoke)
// =====================================================================
const FX = [];
function spawnImpact(p, big) {
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0c8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  fl.position.copy(p).add(new V3(0, 0.3, 0)); scene.add(fl); FX.push({ s: fl, t: 0, life: 0.16, kind: 'flash', size: big ? 7 : 4 });
  for (let i = 0; i < (big ? 9 : 6); i++) {
    const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xd9d6cf, depthWrite: false, transparent: true, opacity: 0.8 }));
    sm.position.copy(p).add(new V3((Math.random() - 0.5) * 0.8, 0.2 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8)); scene.add(sm);
    FX.push({ s: sm, t: 0, life: 2.6 + Math.random() * 1.4, kind: 'smoke', v: new V3((Math.random() - 0.5) * 0.6, 0.35 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6), size: 0.8 + Math.random() * 0.8 });
  }
}
function spawnSpark(p) {
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd080, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  fl.position.copy(p); scene.add(fl); FX.push({ s: fl, t: 0, life: 0.12, kind: 'flash', size: 1.2 });
  for (let i = 0; i < 3; i++) {
    const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xbdb7aa, depthWrite: false, transparent: true, opacity: 0.6 }));
    sm.position.copy(p); scene.add(sm);
    FX.push({ s: sm, t: 0, life: 0.9, kind: 'smoke', v: new V3((Math.random() - 0.5) * 0.8, 0.3, (Math.random() - 0.5) * 0.8), size: 0.25 });
  }
}
function updateFX(dt) {
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i]; f.t += dt; const a = f.t / f.life;
    if (a >= 1) { scene.remove(f.s); f.s.material.dispose(); FX.splice(i, 1); continue; }
    if (f.kind === 'flash') { const s = f.size * Math.sin(a * Math.PI); f.s.scale.set(s, s, s); f.s.material.opacity = 1 - a; }
    else { f.s.position.addScaledVector(f.v, dt); f.v.multiplyScalar(0.985); const s = f.size + a * 3.2; f.s.scale.set(s, s, s); f.s.material.opacity = 0.75 * (1 - a) * Math.min(1, f.t * 6); }
  }
}

// =====================================================================
//  audio
// =====================================================================
const AU = { ctx: null, on: true };
function initAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const ctx = (window.__bootAudio && window.__bootAudio.ctx) || (() => { const A = window.AudioContext || window.webkitAudioContext; try { return new A({ latencyHint: 'playback' }); } catch (e) { return new A(); } })(); AU.ctx = ctx;   // 재생용 지연: 버퍼를 넉넉히 잡아 끊김·딱 소리 적게   // 첫 화면(인트로)이 만든 소리 장치를 이어 씀 — 이미 허락받았으면 메뉴 음악도 바로
    AU.master = ctx.createGain(); AU.master.gain.value = 0.55;
    { const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12; AU.master.connect(lim); lim.connect(ctx.destination); AU.lim = lim; }   // 마지막 리미터: 음악·모터·무전이 겹쳐도 깨지지(클리핑) 않게
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(AU.master);
    AU.mg = ctx.createGain(); AU.mg.gain.value = 0; AU.mg.connect(lp);
    AU.o1 = ctx.createOscillator(); AU.o1.type = 'sawtooth'; AU.o2 = ctx.createOscillator(); AU.o2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.35; AU.o1.connect(AU.mg); AU.o2.connect(g2); g2.connect(AU.mg); AU.o1.start(); AU.o2.start();
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    AU.noise = nb; const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    AU.wg = ctx.createGain(); AU.wg.gain.value = 0; ns.connect(bp); bp.connect(AU.wg); AU.wg.connect(AU.master); ns.start();
  } catch (e) { AU.ctx = null; }
}
function audioUpdate(thrust, speed, active, motorOn) {   // motorOn: 새 모터 소리(game2m)가 돌고 있으면 예전 합성음은 끔 (바람 소리는 그대로)
  if (!AU.ctx) return; const t = AU.ctx.currentTime;
  const on = AU.on && active ? 1 : 0;
  if (motorOn) { AU.mg.gain.setTargetAtTime(0, t, 0.05); AU.wg.gain.setTargetAtTime(on * Math.min(speed / 25, 1) * 0.14, t, 0.1); return; }
  AU.o1.frequency.setTargetAtTime(95 + thrust * 170 + speed * 2, t, 0.05); AU.o2.frequency.setTargetAtTime(190 + thrust * 330 + speed * 4, t, 0.05);
  AU.mg.gain.setTargetAtTime(on * (0.05 + thrust * 0.07), t, 0.08); AU.wg.gain.setTargetAtTime(on * Math.min(speed / 25, 1) * 0.14, t, 0.1);
}
function sfx(kind) {
  if (!AU.ctx || !AU.on) return; const ctx = AU.ctx, t = ctx.currentTime;
  if (kind === 'chime' || kind === 'good') {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(kind === 'good' ? 660 : 880, t); o.frequency.setValueAtTime(kind === 'good' ? 990 : 1320, t + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + 0.4);
  } else if (kind === 'bang' || kind === 'crash') {
    const s = ctx.createBufferSource(); s.buffer = AU.noise; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(kind === 'bang' ? 2600 : 1200, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(kind === 'bang' ? 0.9 : 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'bang' ? 1.2 : 0.5));
    s.connect(f); f.connect(g); g.connect(AU.master); s.start(t); s.stop(t + 1.3);
  } else if (kind === 'bad') {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(220, t); o.frequency.setValueAtTime(160, t + 0.12);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + 0.32);
  } else if (kind === 'drop') {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.15);
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + 0.2);
  }
}

