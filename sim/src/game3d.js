
// =====================================================================
//  안내 단계 · 목표 표시 · 비행 가이드(쉐브론 + 조작 안내 문구) · 아래 카메라
// =====================================================================
const GUIDE = { n: 10, sp: 2.6, meshes: [], next: null, detour: false };
// ---- 안내 단계 (GD 버튼 · V 키 · VR 메뉴 · 옵션): 3 가이드 → 2 목표 → 1 지도 → 0 무전 → 3 ----
//  목표 표시 "어디로" (화면 ◇·가장자리 화살표·거리, 빛기둥, 수색 구역 고리, 지금 과제 강조) ……… 2 이상
//  비행 가이드 "어떻게" (쉐브론 경로, 조작 안내 문구, 게이트 조준 틀, 선회 원) ……………………… 3
//  지도·항법 (지도의 목표·수색 원·점선, DIST·AREA, UAS 방위계 목표 바늘) …………………………… 1 이상 · 0 은 무전 방위·거리만
//  단계와 상관없이 늘: 코스·임무 물체(링·게이트·패드·연기·차량)와 링 통과 방향, 다음 과제 이름, 계기, 투하 조준경, 무전
//  기본값은 난이도: 입문 3 · 쉬움·ATTI 2 · 스포츠 1 (튜토리얼 3) · 바꾸면 그 판에만 (같은 임무 다시 포함) · 메뉴로 나가면 기본값
var GL = { lv: 3, kind: null, user: false, live: false, pre: null, preDiff: null };
const GL_NM = [['무전', 'Radio'], ['지도', 'Map'], ['목표', 'Target'], ['가이드', 'Guide']];
const GL_DESC = [['지도에도 없음 · 방위 띠와 무전 위치 요청(G)', 'radio only · heading tape + vector request (G)'], ['화면 표시 없음 · 지도·방위·무전(G)', 'no screen markers · map, heading, vectors (G)'], ['초보 · 목표 표시', 'beginner · target markers'], ['초보 · 목표 + 경로·조작', 'beginner · markers + path']];   // 바꿀 때 잠깐 뜨는 한 줄
function glDefFor(d) { const v = { train: 3, easy: 2, atti: 2, sport: 1 }[d]; return v == null ? 2 : v; }   // 난이도별 기본 안내 단계
function glDef(kind) { if ((kind || S.kind) === 'tutorial') return 3; return glDefFor(SET.diff); }
function gdLevel() { if (!GL) return 3; return GL.live ? GL.lv : (GL.pre != null && GL.preDiff === SET.diff) ? GL.pre : glDef('menu'); }
const glTgt = () => gdLevel() >= 2, glFly = () => gdLevel() >= 3, glMap = () => gdLevel() >= 1;
function glStart(kind) {   // startRun 에서
  if (GL.live && GL.user && GL.kind === kind) { }                                        // 같은 임무 다시: 고른 단계 그대로
  else if (GL.pre != null && GL.preDiff === SET.diff) { GL.lv = GL.pre; GL.user = true; }   // 출격 전에 옵션에서 고른 단계
  else { GL.lv = glDef(kind); GL.user = false; }
  GL.pre = null; GL.kind = kind; GL.live = true; glSync();
}
function glEnd() { GL.live = false; GL.user = false; glSync(); }   // toMenu 에서 (그 판 끝)
function glSet(v, quiet) {
  v = ((v % 4) + 4) % 4;
  if (GL.live) { GL.lv = v; GL.user = true; } else { GL.pre = v; GL.preDiff = SET.diff; }
  glSync();
  if (!quiet && GL.live && S.state !== 'menu') showMsg(L2x('안내: ', 'NAV: ') + L2x(GL_NM[v][0], GL_NM[v][1]).toUpperCase() + ' (' + L2x(GL_DESC[v][0], GL_DESC[v][1]) + ')', '#fff', 1.6);
}
function glCycle() { const v = gdLevel(); glSet(v > 0 ? v - 1 : 3); }
function glSync() {
  const v = gdLevel(), b = $('tbGuide'), nm = L2x(GL_NM[v][0], GL_NM[v][1]);
  if (b && b.dataset.lv !== String(v)) { b.dataset.lv = v; b.innerHTML = `GD<small>${nm}</small>`; }
  document.querySelectorAll('#segGuide button').forEach(x => x.classList.toggle('on', +x.dataset.v === v));
  if (S.state !== 'menu') try { updateTags(); } catch (e) { }   // 비행 화면 아래 상태 표시 (안내 …)
}
(function makeFrames() {
  // 비행 경로에 수직으로 서는 사각 틀 ('하늘의 길' 방식) - FPV·추적 시점 모두에서 잘 보임
  const o = 0.55, n = 0.49, arr = [];
  const quad = (x0, y0, x1, y1) => arr.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
  quad(-o, n, o, o); quad(-o, -o, o, -n); quad(-o, -n, -n, n); quad(n, -n, o, n);
  arr.push(-0.09, o, 0, 0.09, o, 0, 0, o + 0.13, 0);
  const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  for (let i = 0; i < GUIDE.n; i++) {
    const m = new THREE.MeshBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, fog: false });
    const grp = new THREE.Group(); grp.add(new THREE.Mesh(g1, m));
    grp.renderOrder = 8; grp.visible = false; scene.add(grp); GUIDE.meshes.push({ g: grp, m });
  }
})();
function dropTargetPos(o) {
  if (o.target === 'ivan') return OBJ.ivan_grp1.world(0, 0, 0);
  if (o.target === 'mit') return OBJ.mit.world(OBJ.mit.car.position.x, 0, 0);
  return OBJ.tank.world(0, 0, 0);
}
function orbitDir(c, p) {
  if (Math.abs(S.orbSum) > 0.3) return S.orbSum < 0 ? -1 : 1;
  if (!c) return 1;
  const a = Math.atan2(p.z - c.z, p.x - c.x), tx = -Math.sin(a), tz = Math.cos(a);   // 각도가 커지는 쪽 접선
  return (Math.sin(DR.h) * tx - Math.cos(DR.h) * tz) >= 0 ? 1 : -1;                // 기체가 향한 쪽으로 돌기
}
// 게이트·링 앞 정렬 거리: 빠를수록 멀리서 줄을 맞춤 (쿼드 5~20 m · 고정익 25~60 m)
function guideLead() { const v = Math.hypot(DR.v.x, DR.v.z); return AFc().cls === 'wing' ? clamp(v * 2.5, 25, 60) : clamp(4 + v * 0.9, 5, 20); }
function guidePoints(o, p) {
  GUIDE.detour = false;
  if (!o) return null;
  if (o.kind === 'ms') return searchIn(o, p) ? null : o.pts(p);
  const up = (y) => new V3(0, y, 0);
  if (o.kind === 'takeoff') return [p.clone(), p.clone().add(up(2.5))];
  if (o.kind === 'custom') return o.mk ? [p.clone(), o.mk.clone()] : null;
  if (o.kind === 'land') { const c = o.b.world(0, 0, 0); return [p.clone(), c.clone().add(up(1.6)), c.clone().add(up(0.35))]; }
  if (o.kind === 'drop') { const t = dropTargetPos(o); return [p.clone(), t.clone().setY(Math.max(p.y, t.y + 5))]; }
  if (o.kind === 'orbit') {
    const c = o.b.world(0, 0, 0), R = o.R, alt = Math.max(p.y, c.y + 6), dir = orbitDir(c, p);
    const a = Math.atan2(p.z - c.z, p.x - c.x), rd = Math.hypot(p.x - c.x, p.z - c.z);
    const at = (ang) => new V3(c.x + Math.cos(ang) * R, alt, c.z + Math.sin(ang) * R);
    const pts = [p.clone()];
    if (rd > 18) pts.push(at(a));
    for (let k = 1; k <= 4; k++) pts.push(at(a + dir * 0.5 * k));
    o.mk = at(a + dir * 0.7).add(up(1.5));
    return pts;
  }
  const op = openingOf(o); if (!op) return null;
  const b = op.b, C = b.world(op.lx, op.ly, op.lz);
  if (o.kind === 'bunker' && !op.side) {
    // 정면(남쪽) 창으로 들어가기: 벙커 옆을 돌아 창 앞에서 U턴
    const l = b.local(p), dm = b.dims;
    const inside = b.world(op.lx, 0, op.lz);
    if (!insideBunker(p) && l.ly > -dm.d / 2 - 2.5) {
      GUIDE.detour = true;
      const side = l.lx >= 0 ? 1 : -1, sx = side * (dm.w / 2 + 4.5), pts = [p.clone()];
      if (l.ly > 0.5) pts.push(b.world(sx, Math.min(l.ly, 5), op.lz + 0.8));
      pts.push(b.world(sx, -dm.d / 2 - 5.5, op.lz + 0.4));
      pts.push(b.world(op.lx + side * 1.2, -dm.d / 2 - 5.0, op.lz));
      pts.push(b.world(op.lx, -dm.d / 2 - 2.5, op.lz), C, inside);
      return pts;
    }
    const lead = b.world(op.lx, -dm.d / 2 - 5, op.lz);
    return l.ly < -dm.d / 2 - 3 ? [p.clone(), lead, C, inside] : [p.clone(), C, inside];
  }
  const A = (op.side ? b.world(-1, 0, 0) : b.world(0, 1, 0)).sub(b.world(0, 0, 0)).normalize();
  const along = (o.kind === 'pass' && b.pass && b.pass.kind === 'tunnel') ? b.pass.L + 3 : 3;
  const ld = guideLead(), lead = C.clone().addScaledVector(A, -ld), exit = C.clone().addScaledVector(A, along);
  const before = p.clone().sub(C).dot(A);
  return before < -3 ? (before < -ld - 2 ? [p.clone(), lead, C, exit] : [p.clone(), C.clone().addScaledVector(A, Math.min(-2, before * 0.5)), C, exit]) : [p.clone(), C, exit];
}
const _gt = new V3(), _gq = new V3(), _gs = new V3(), _gv = new V3();
// 기체에서 목표까지 이어지는 띠: 틀만 있으면 추적 시점에서 기체와 떨어져 떠 보이므로, 기체 바로 앞에서 시작해 목표까지 한 줄로 이어 줌
function makeStrip(N) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 8), 4));
  const idx = []; for (let i = 0; i < N - 1; i++) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.renderOrder = 7; m.frustumCulled = false; m.visible = false; scene.add(m); return { m, N, col: new THREE.Color() };
}
const GPATH = makeStrip(48), GAXIS = makeStrip(40);   // GPATH: 기체→목표 경로 띠 · GAXIS: 게이트 진입축 점선 (가운데를 어느 각도로 지나야 하는지)
// 카메라를 향하는 띠를 곡선 위에 깔기. alphaFn(d, L, dist) 로 구간별 투명도
function stripAlong(S0, curve, L, col, alphaFn, wk) {
  const { m, N } = S0, P = m.geometry.attributes.position.array, C = m.geometry.attributes.color.array, cp = camera.position, c = S0.col.set(col);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1); curve.getPointAt(u, _gt); curve.getPointAt(Math.min(1, u + 0.01), _gq); _gq.sub(_gt);
    _gv.subVectors(_gt, cp); const dist = _gv.length(); _gs.crossVectors(_gq, _gv);
    if (_gs.lengthSq() < 1e-8) _gs.set(1, 0, 0); _gs.normalize().multiplyScalar(Math.max(0.05, dist * (wk || 0.0055)));   // 화면에서 거의 일정한 굵기
    P[i * 6] = _gt.x - _gs.x; P[i * 6 + 1] = _gt.y - _gs.y; P[i * 6 + 2] = _gt.z - _gs.z; P[i * 6 + 3] = _gt.x + _gs.x; P[i * 6 + 4] = _gt.y + _gs.y; P[i * 6 + 5] = _gt.z + _gs.z;
    const a = alphaFn(u * L, L, dist);
    for (let k = 0; k < 2; k++) { const o = i * 8 + k * 4; C[o] = c.r; C[o + 1] = c.g; C[o + 2] = c.b; C[o + 3] = a; }
  }
  m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.color.needsUpdate = true; m.visible = true;
}
function guidePath(curve, L, col) { stripAlong(GPATH, curve, L, col, (d, L, dist) => clamp((d - 2) / 4, 0, 1) * clamp((dist - 1.5) / 2, 0, 1) * Math.min(1, (L - d) / 1.5) * 0.65); }   // 기체·카메라 바로 옆은 투명
const _axA = new V3(), _axB = new V3();
// 진입축: 게이트 중심 C 를 지나 방향 A 로 before~after 만큼 점선 (멀리서 접근 각을 맞추기 위한 기준선)
function guideAxis(C, A, before, after, col) {
  _axA.copy(C).addScaledVector(A, -before); _axB.copy(C).addScaledVector(A, after);
  const L = before + after, cur = new THREE.LineCurve3(_axA.clone(), _axB.clone());
  stripAlong(GAXIS, cur, L, col, (d, L, dist) => (Math.floor(d / 1.5) % 2 ? 0.08 : 0.55) * Math.min(1, d / 2) * clamp((dist - 1.5) / 2, 0, 1), 0.0035);
}
// 쉐브론 안내 (자동차 증강현실 내비 방식): 기체 앞에서 목표까지 경로 위에 ▶ 모양이 일정 간격으로 놓이고 천천히 앞으로 흘러감
//  · 화살촉 면은 늘 카메라 쪽을 향하게 (어느 각도에서 봐도 진행 방향이 보임) · 가까운 것은 진하고 멀수록 옅게
const GCHEV = (function () {
  const N = 16, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6 * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6 * 4), 4));
  const idx = []; for (let i = 0; i < N; i++) { const b = i * 6; idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 3, b + 4, b, b + 4, b + 5); } g.setIndex(idx);   // 0 끝(바깥) · 1,2 오른팔 · 3 끝(안쪽) · 4,5 왼팔
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.renderOrder = 8; m.frustumCulled = false; m.visible = false; scene.add(m); return { m, N, col: new THREE.Color() };
})();
const _ct = new V3(), _cs = new V3(), _cv = new V3(), _cpt = new V3(), _cn = new V3();
function guideChevrons(curve, L, col, sp, wing) {
  const { m, N } = GCHEV, P = m.geometry.attributes.position.array, C = m.geometry.attributes.color.array, cam = camera.position, c = GCHEV.col.set(col);
  const gap = wing ? clamp(6 + sp * 0.25, 6, 14) : clamp(2.6 + sp * 0.12, 2.6, 5), d0 = wing ? 10 : CAMS[S.cam] === 'FPV' ? 5 : 3.2, phase = (S.simT * (wing ? 6 : 2.2)) % gap;   // 천천히 앞으로 흐름
  for (let i = 0; i < N; i++) {
    const d = d0 + phase + i * gap, o = i * 18, oc = i * 24;
    if (d > L - 0.4) { for (let k = 0; k < 24; k++) C[oc + k] = 0; continue; }
    const u = d / L; curve.getPointAt(u, _cpt); curve.getTangentAt(u, _ct); { const g = terrainAt(_cpt.x, _cpt.z) + 0.6; if (_cpt.y < g) _cpt.y = g; }
    // 면 방향: 도로에 깔린 화살표처럼 수평에 가깝게 + 카메라 쪽으로 조금 세움 (진행 방향을 따라 볼 때도 납작해지지 않게 경로보다 조금 아래에 둠)
    _cn.set(0, 1, 0).addScaledVector(_ct, -_ct.y); if (_cn.lengthSq() < 1e-6) _cn.set(1, 0, 0); _cn.normalize();
    const drop = wing ? 2.2 : 0.9; _cpt.addScaledVector(_cn, -drop);
    _cv.subVectors(_cpt, cam); const dist = _cv.length(); _cv.addScaledVector(_ct, -_cv.dot(_ct));   // 경로에 수직인 시선 성분
    _cn.addScaledVector(_cv, -3.0 / Math.max(dist, 1e-3)).normalize(); _cs.crossVectors(_ct, _cn); if (_cs.lengthSq() < 1e-8) _cs.set(1, 0, 0); _cs.normalize();
    const w = (wing ? 2.2 : 0.75) + dist * 0.012, h = w * 0.62, th = w * 0.46;   // 팔 길이(옆) · 앞뒤 길이 · 두께
    const put = (k, ft, sd) => { P[o + k * 3] = _cpt.x + _ct.x * ft + _cs.x * sd; P[o + k * 3 + 1] = _cpt.y + _ct.y * ft + _cs.y * sd; P[o + k * 3 + 2] = _cpt.z + _ct.z * ft + _cs.z * sd; };
    put(0, h, 0); put(1, -h, w); put(2, -h - th, w); put(3, h - th * 1.25, 0); put(4, -h - th, -w); put(5, -h, -w);
    const a = 0.9 * clamp((d - d0 + 0.3) / 1.6, 0, 1) * clamp((L - d) / 2.5, 0, 1) * (1 - 0.55 * Math.min(1, (d - d0) / (gap * N))) * clamp((dist - 3) / 4, 0, 1);   // 카메라 바로 앞은 옅게
    for (let k = 0; k < 6; k++) { C[oc + k * 4] = c.r; C[oc + k * 4 + 1] = c.g; C[oc + k * 4 + 2] = c.b; C[oc + k * 4 + 3] = a; }
  }
  m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.color.needsUpdate = true; m.visible = true;
}
function repKey() { return XR_ON ? (window.SIM_LANG === 'en' ? 'R trigger' : 'R트리거') : IS_TOUCH ? '📷 REPORT' : 'Enter/📷'; }   // 사진 보고 단추 이름 (기기별)
function hideNav() { const na = $('navArrow'); if (na) na.classList.add('hidden'); }
function hideFly() { GUIDE.meshes.forEach(x => x.g.visible = false); GPATH.m.visible = false; GAXIS.m.visible = false; GCHEV.m.visible = false; $('guide').classList.add('hidden'); GUIDE.html = ''; if (GUIDE.hy) GUIDE.hy = {}; }
function hideGuide() { BEACON.g.visible = false; hideFly(); hideNav(); }
// ---- 지상 목표 찾기 (정찰·산불·수색·활주로·패드): 목표에 하늘로 솟은 빛기둥 + 바닥 고리 · 멀리서도 보임 ----
const TGT_STYLE = { recon: [0x4fe3ff, 'RECON', '정찰'], fire: [0xff8a2a, 'FIRE', '산불'], sarfind: [0x5dff9a, 'SAR', '수색'], sarkit: [0x5dff9a, 'DROP', '투하'], rwyland: [0xffd23a, 'RWY', '활주로'], land: [0xffd23a, 'PAD', '패드'], padland: [0xffd23a, 'PAD', '패드'] };   // 타격·차량 추적은 빛기둥 없음 (기만체·은밀 추적이 쉬워지지 않게)
function tgtStyle(o) { const st = (o && TGT_STYLE[o.t]) || (o && o.kind === 'drop' ? [0xffc828, 'DROP', '투하'] : o && o.kind === 'land' ? [0xffd23a, 'PAD', '패드'] : null); return st; }
const BEACON = (function () {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const col = { value: new THREE.Color(0x4fe3ff) }, fade = { value: 1 }, tm = { value: 0 };
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0), new THREE.ShaderMaterial({ uniforms: { uC: col, uF: fade, uT: tm }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vU; varying vec3 vN, vV; void main() { vU = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uC; uniform float uF, uT; varying vec2 vU; varying vec3 vN, vV; void main() { float rim = 1.0 - abs(dot(normalize(vN), normalize(vV))); float a = (0.25 + 0.75 * pow(1.0 - rim, 1.5)) * pow(1.0 - vU.y, 1.4); a *= 0.85 + 0.15 * sin(vU.y * 40.0 - uT * 6.0); gl_FragColor = vec4(uC * a * uF * 0.9, 1.0); }' }));
  beam.renderOrder = 9; beam.frustumCulled = false; g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  ring.renderOrder = 9; g.add(ring);
  return { g, beam, ring, col, fade, tm };
})();
function beaconUpdate(o, subj) {
  const st = tgtStyle(o), B = BEACON;
  if (!st || !o.mk || S.state !== 'run' || (typeof isC1 === 'function' && isC1())) { B.g.visible = false; return; }
  const x = o.mk.x, z = o.mk.z, gy = groundAt(x, z), d = Math.hypot(subj.p.x - x, subj.p.z - z), r = o.search ? o.search.r : o.t === 'rwyland' ? 12 : 8;
  B.g.visible = true; B.g.position.set(x, gy, z); B.col.value.setHex(st[0]); B.ring.material.color.setHex(st[0]);
  const w = clamp(d * 0.012, 1.2, 9);   // 멀수록 굵게 (화면에서 비슷한 두께)
  B.beam.scale.set(w, clamp(60 + d * 0.08, 60, 160), w); B.ring.scale.set(r, 1, r); B.ring.position.y = 0.4;
  B.fade.value = clamp((d - 25) / 60, 0, 1) * (ENV.ir ? 0.6 : 1);   // 가까우면 빛기둥은 사라지고 바닥 고리만
  B.ring.material.opacity = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(S.simT * 4)); B.tm.value = S.simT;
}
// 다음 목표 방향 표시: 화면 안이면 목표 위에 ◇ + 이름·거리, 화면 밖이면 가장자리에 그쪽을 가리키는 화살표 + 거리 + 돌 방향 (VR·1종 제외)
const _nv = new V3();
function navArrow(tgt, subj, o) {
  let el = $('navArrow'); if (!el) { el = document.createElement('div'); el.id = 'navArrow'; el.innerHTML = '<i>➤</i><b></b><em></em>'; document.body.appendChild(el); }
  if (!tgt || XR_ON || S.state !== 'run') { el.classList.add('hidden'); return; }
  const dist = tgt.distanceTo(subj.p); if (dist < 4) { el.classList.add('hidden'); return; }
  const st = tgtStyle(o), en = window.SIM_LANG === 'en', hd = subj.h != null ? subj.h : DR.h, dx = tgt.x - subj.p.x, dz = tgt.z - subj.p.z;
  let turn = Math.atan2(dx * Math.cos(hd) + dz * Math.sin(hd), dx * Math.sin(hd) - dz * Math.cos(hd)) / DEG;   // 오른쪽 + · 왼쪽 −
  const tt = Math.abs(turn) < 10 ? (en ? 'ahead ▲' : '정면 ▲') : turn > 0 ? `${Math.round(turn)}° ▶` : `◀ ${Math.round(-turn)}°`;
  el.style.setProperty('--nc', st ? '#' + st[0].toString(16).padStart(6, '0') : '#ffc828');
  const em = el.lastChild, lab = (st ? (en ? st[1] : st[2]) + ' · ' : '') + tt; if (em.textContent !== lab) em.textContent = lab;
  _nv.copy(tgt).project(camera); const behind = _nv.z > 1;
  let x = _nv.x, y = _nv.y; if (behind) { x = -x; y = -y; }
  const W = innerWidth, H = innerHeight, mx = IS_TOUCH ? 0.5 : 0.80, my = IS_TOUCH ? 0.55 : 0.74;   // 가장자리 여백 (계기·목록 피함 · 휴대폰은 단추·아래 안내 글도)
  const inside = !behind && Math.abs(x) < mx && Math.abs(y) < my;
  if (inside && dist < 35 && o && (o.kind === 'ms' ? o.t === 'pass' : !!openingOf(o))) { el.classList.add('hidden'); return; }   // 게이트·링이 눈앞에 보이면 ◇ 는 빼고 문 자체(강조·조준 틀)로
  let sx, sy, rot;
  if (inside) { sx = (x + 1) / 2 * W; sy = (1 - y) / 2 * H; rot = 0; }   // 목표 자리에 ◇ + 거리
  else { const k = Math.max(Math.hypot(x / mx, y / my), 1e-6); x /= k; y /= k; /* 타원 가장자리: 모서리의 계기·목록을 피함 */ sx = (x + 1) / 2 * W; sy = (1 - y) / 2 * H; rot = Math.atan2(-(y), x) / Math.PI * 180; }
  el.classList.remove('hidden'); el.classList.toggle('edge', !inside);
  el.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%,-50%)`;
  el.firstChild.style.transform = inside ? '' : `rotate(${rot.toFixed(0)}deg)`; const ic = inside ? '◇' : '➤'; if (el.firstChild.textContent !== ic) el.firstChild.textContent = ic;
  const hz = Math.hypot(tgt.x - subj.p.x, tgt.z - subj.p.z), dyy = tgt.y - subj.p.y;   // 거리는 수평 거리 · 높이 차는 따로 (↑ 위로 · ↓ 아래로) — 예전엔 둘을 합친 직선 거리라 헷갈림
  const txt = (hz >= 1000 ? (hz / 1000).toFixed(1) + ' km' : hz.toFixed(0) + ' m') + (Math.abs(dyy) >= 8 ? (dyy > 0 ? ' ↑' : ' ↓') + Math.abs(dyy).toFixed(0) : ''), bd = el.children[1]; if (bd.textContent !== txt) bd.textContent = txt;
}
function updateGuide(subj) {
  const active = S.state === 'run' && DR.alive && !(S.tut && S.tut.st !== 'fly');
  const o = active ? curObj() : null;
  GUIDE.next = null;
  if (!o || (typeof isC1 === 'function' && isC1())) { hideGuide(); return; }
  const tgtOn = glTgt(), flyOn = glFly();   // 목표 표시(2 이상) · 비행 가이드(3)
  if (tgtOn) beaconUpdate(o, subj); else BEACON.g.visible = false;
  if (o.kind === 'bunker' && !S.scanned && insideBunker(subj.p)) {
    hideFly(); hideNav(); if (!flyOn) return;
    const el = $('guide'), html = `<div class="ok">${L2x('정찰 중 · 안에서 잠시 머무르기', 'Scanning · hold inside for a moment')}</div>`; el.classList.remove('hidden'); if (GUIDE.html !== html) { GUIDE.html = html; el.innerHTML = html; } return;
  }
  // 수색 구역(산불·실종자) 안: 쉐브론은 끄고 (눈·열화상으로 찾기) 구역 중심 ◇ + 할 일·고도 안내
  if (o.kind === 'ms' && searchIn(o, subj.p)) {
    hideFly();
    const dcc = Math.hypot(o.mk.x - subj.p.x, o.mk.z - subj.p.z);
    if (tgtOn && dcc > o.search.r * 0.8) navArrow(o.mk, subj, o); else hideNav();   // 구역 안에서는 중심 표시를 치움 (가장자리에 가까우면 중심 쪽 화살표)
    if (!flyOn) return;
    const agl = subj.p.y - terrainAt(subj.p.x, subj.p.z), lines = [], fire = o.t === 'fire', band = fire ? [35, 70] : [15, 35];
    const en = window.SIM_LANG === 'en';
    const rk = repKey();
    if (!o.inView && o.t === 'sarfind' && typeof SMK !== 'undefined' && SMK && SMK.on && !SMK.ok) lines.push(SMK.seen ? [en ? 'Smoke in view · centre it and press ' + rk + ' to call its colour' : '연기 포착 · 가운데 두고 ' + rk + ' = 색 부르기', 'ok'] : [en ? 'Smoke out · find his signal smoke' : '연막 신호 · 실종자의 연기를 찾기', 'warn']);   // 연막 이벤트: 색은 조종자가 먼저
    if (o.inView) lines.push([fire ? (en ? 'HOTSPOT in view · centre it and press ' + rk : '불씨 포착 · 화면 가운데에 두고 ' + rk) : (en ? 'Hiker in view · centre and ' + rk : '실종자 포착 · 가운데에 두고 ' + rk), 'ok']);
    else {
      lines.push([fire ? (o.seenVis ? (en ? 'Smoke only · get closer to see the flames, or thermal (T)' : '연기만 보임 · 불꽃이 보일 만큼 가까이, 또는 열화상(T)') : (en ? 'Inside search area · look for smoke/glow, or sweep with thermal (T)' : '수색 구역 안 · 연기·불빛 찾기 · 또는 열화상(T)으로 훑기')) : (en ? 'Inside search area · fly low and slow, look along paths and clearings' : '수색 구역 안 · 낮고 천천히 · 길가·공터 위주로 살피기'), '']);
      if (agl > band[1]) lines.push([(en ? 'Descend to ' : '고도 내리기 → ') + band[0] + '–' + band[1] + ' m' + (en ? ' AGL' : ''), 'warn']);
      else if (agl < band[0]) lines.push([(en ? 'Climb to ' : '고도 올리기 → ') + band[0] + '–' + band[1] + ' m', 'warn']);
      const dc = Math.hypot(o.mk.x - subj.p.x, o.mk.z - subj.p.z); if (dc > o.search.r * 0.8) lines.push([en ? 'Near the edge · turn back toward the centre' : '구역 가장자리 · 중심 쪽으로 되돌아가기', 'warn']);
    }
    const el = $('guide'), html = lines.map(l => `<div class="${l[1]}">${l[0]}</div>`).join(''); el.classList.remove('hidden'); if (GUIDE.html !== html) { GUIDE.html = html; el.innerHTML = html; } return;
  }
  let pts = guidePoints(o, subj.p);
  if (!pts) { hideGuide(); return; }
  GUIDE.next = pts[1];   // 입문 자동 방향 보조도 씀 (안내 단계와 상관없이)
  if (tgtOn) navArrow(o.mk || pts[pts.length - 1], subj, o); else hideNav();
  if (!flyOn) { hideFly(); return; }
  // 비행 경로: 지금 날아가는 방향으로 먼저 이어졌다가 선회 반경만큼 휘어 목표로 (직선으로 꺾지 않음)
  { const v = subj.v || DR.v, sp = Math.hypot(v.x, v.z), wing = AFc().cls === 'wing', hd = sp > 1 ? new V3(v.x / sp, 0, v.z / sp) : new V3(Math.sin(DR.h), 0, -Math.cos(DR.h));
    const to = pts[1].clone().sub(pts[0]); to.y = 0; const dist = to.length(); if (dist > 0.5) to.divideScalar(dist);
    const turnR = wing ? Math.max(15, sp * sp / (9.8 * Math.tan((AFc().bank || 45) * DEG * 0.8))) : sp * 0.6;
    const ang = Math.acos(clamp(hd.dot(to), -1, 1));
    GUIDE.wp = pts[1];   // 조작 안내는 실제 첫 경유점 기준 (선회 보정점이 아니라)
    if ((wing || sp > 6) && ang > 15 * DEG && dist > turnR * 1.2) { const k = Math.min(turnR * (0.4 + ang / Math.PI), dist * 0.45); const a = pts[0].clone().addScaledVector(hd, k); a.y = pts[0].y + (pts[1].y - pts[0].y) * 0.15; pts = [pts[0], a].concat(pts.slice(1)); } }
  // 지형 위로: 긴 구간은 15 m 마다 점을 넣고 지면 + 1.5 m 아래로 내려가지 않게 (언덕 너머 목표에서 안내가 땅에 묻혀 끊기지 않게)
  { const q = [pts[0]], keep = Math.max(1, pts.length - 2);
    for (let k = 1; k < pts.length; k++) { const A = pts[k - 1], B = pts[k], L0 = A.distanceTo(B), n = Math.floor(L0 / 15);
      for (let j = 1; j < n; j++) { const m = A.clone().lerp(B, j / n), g = terrainAt(m.x, m.z) + 1.5; if (m.y < g) m.y = g; q.push(m); }
      const P = k < keep ? B.clone() : B; if (k < keep) { const g = terrainAt(P.x, P.z) + 1.2; if (P.y < g) P.y = g; } q.push(P); }
    pts = q; }
  const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
  const vsp = Math.hypot(DR.v.x, DR.v.z), GSP = AFc().cls === 'wing' ? 6 : clamp(2.6 + vsp * 0.18, 2.6, 5);   // 빠를수록 표시 간격을 넓혀 더 멀리까지
  const L = curve.getLength();
  const gcol = GUIDE.detour ? 0xffc828 : o.kind === 'orbit' ? 0x5dff9a : 0x4fe3ff;
  GUIDE.meshes.forEach(x => x.g.visible = false); GPATH.m.visible = false; GAXIS.m.visible = false;   // 예전 틀·띠·점선은 쓰지 않음 (쉐브론으로 바꿈)
  if (L > 1.5) guideChevrons(curve, L, gcol, Math.hypot(DR.v.x, DR.v.z), AFc().cls === 'wing'); else GCHEV.m.visible = false;
  if (o.t === 'rwyland' && typeof rwyGlide === 'function' && RWY) {   // 활주로 착륙: 접지점에서 뒤로 올라가는 3° 진입선 (점선)
    const td = RWY.at(-RWY.L / 2 + 20, 0); td.y = groundAt(td.x, td.z); const u = new V3(RWY.ux, 0, RWY.uz), A = u.clone().multiplyScalar(Math.cos(3 * DEG)).add(new V3(0, -Math.sin(3 * DEG), 0)).normalize();
    guideAxis(td, A, 600, 0, 0xffd23a); }
  // ---- 조작 안내 문구 ----
  const T = XR_ON && vrStickMode() === 3 ? { up: '오른쪽 스틱 ↑', down: '오른쪽 스틱 ↓', yawL: (window.SIM_LANG === 'en' ? 'look ←' : '고개 ←'), yawR: (window.SIM_LANG === 'en' ? 'look →' : '고개 →'), fwd: '왼쪽 스틱 ↑', back: '왼쪽 스틱 ↓', left: '오른쪽 스틱 ←', right: '오른쪽 스틱 →', drop: 'R트리거', boost: 'L트리거' }
    : (XR_ON ? vrStickMode() === 1 : IS_TOUCH && stickMode() === 1) ? { up: '오른쪽 스틱 ↑', down: '오른쪽 스틱 ↓', yawL: '왼쪽 스틱 ←', yawR: '왼쪽 스틱 →', fwd: '왼쪽 스틱 ↑', back: '왼쪽 스틱 ↓', left: '오른쪽 스틱 ←', right: '오른쪽 스틱 →', drop: XR_ON ? 'R트리거' : 'DROP', boost: XR_ON ? 'L트리거' : 'BST' }
    : (IS_TOUCH || XR_ON) ? { up: '왼쪽 스틱 ↑', down: '왼쪽 스틱 ↓', yawL: '왼쪽 스틱 ←', yawR: '왼쪽 스틱 →', fwd: '오른쪽 스틱 ↑', back: '오른쪽 스틱 ↓', left: '오른쪽 스틱 ←', right: '오른쪽 스틱 →', drop: XR_ON ? 'R트리거' : 'DROP', boost: XR_ON ? 'L트리거' : 'BST' } : null;
  const wingF = AFc().cls === 'wing', vm0 = XR_ON ? vrStickMode() : stickMode();
  /* 고정익: 선회 = 기울이기(롤) · 상승 = 스틱 당기기(뒤) · 속도 = 스로틀. 모드에 따라 스틱 위치가 다름 */
  const WL = T ? (vm0 === 1 ? { pu: '왼쪽 스틱 ↓', pd: '왼쪽 스틱 ↑', bl: '오른쪽 스틱 ←', br: '오른쪽 스틱 →', th: '오른쪽 스틱 ↑', tl: '오른쪽 스틱 ↓' } : { pu: '오른쪽 스틱 ↓', pd: '오른쪽 스틱 ↑', bl: '오른쪽 스틱 ←', br: '오른쪽 스틱 →', th: '왼쪽 스틱 ↑', tl: '왼쪽 스틱 ↓' })
    : { pu: keyName(KB.back), pd: keyName(KB.fwd), bl: keyName(KB.left), br: keyName(KB.right), th: keyName(KB.up), tl: keyName(KB.down) };
  const K = a => (wingF && WL[a]) ? WL[a] : T ? T[a] : keyName(KB[a]);
  const tgt0 = (o.kind === 'orbit' || GUIDE.detour) ? pts[1] : (pts.length > 2 ? pts[pts.length - 2] : pts[1]);
  /* 조작 안내도 화면에 그려진 곡선 위의 앞쪽 점을 기준으로 (목표 지점이 아니라 가이드를 따라가도록) */
  const vs = Math.hypot(DR.v.x, DR.v.z), lookD = wingF ? clamp(vs * 2.5, 30, 70) : clamp(3 + vs * 0.9, 4, 14), cL = curve.getLength();
  const tgtC = curve.getPointAt(Math.min(1, lookD / Math.max(cL, 0.1)));
  const tgt = (o.kind === 'drop' || o.kind === 'land') ? tgt0 : wingF ? tgtC : (GUIDE.wp && GUIDE.wp.distanceTo(subj.p) > 2.5 ? GUIDE.wp : tgtC);
  const d = tgt.clone().sub(subj.p), fwd = new V3(Math.sin(DR.h), 0, -Math.cos(DR.h)), rgt = new V3(Math.cos(DR.h), 0, Math.sin(DR.h));
  const df = d.dot(fwd), dr = d.dot(rgt), dy = d.y, hd = Math.hypot(df, dr), ang = Math.atan2(dr, df) / DEG, en = window.SIM_LANG === 'en';
  // 안내 문구: 할 일(큰 글씨) + 스틱·키(작은 글씨) 두 줄 · 떨림 방지 — 켜질 때와 꺼질 때 문턱을 다르게(히스테리시스), 수치는 0.5 m 단위, 글자는 바뀔 때만 다시 그림
  const HY = GUIDE.hy || (GUIDE.hy = {}), on = (k, v, lo, hi) => (HY[k] = v > (HY[k] ? lo : hi)), mR = v => v >= 10 ? Math.round(v) + ' m' : v >= 1 ? (Math.round(v * 2) / 2).toFixed(v % 1 ? 1 : 0) + ' m' : (en ? 'a little' : '조금');
  const acts = [], keys = [], A = (t, k) => { acts.push(t); if (k) keys.push(((t.match(/^[↑↓↶↷←→▲]/) || [''])[0] + ' ' + k).trim()); };   // 아래 줄: 화살표 + 스틱·키 (예 "↓ 왼쪽 스틱 ↓ · ↶ A")
  const steer = () => {
    if (DR.landed && !wingF && o.kind !== 'land') { A(en ? 'Take off first · climb' : '먼저 이륙 · 올라가기', K('up')); return; }
    if (wingF) {
      if (on('alt', Math.abs(dy), 1.5, 3)) A((dy > 0 ? (en ? '↑ climb ' : '↑ 올리기 ') : (en ? '↓ descend ' : '↓ 내리기 ')) + mR(Math.abs(dy)), K(dy > 0 ? 'pu' : 'pd'));
      if (on('turn', Math.abs(ang), 4, 8)) A(ang > 0 ? (en ? '↷ bank right' : '↷ 오른쪽으로 기울여 선회') : (en ? '↶ bank left' : '↶ 왼쪽으로 기울여 선회'), K(ang > 0 ? 'br' : 'bl'));
      return;
    }
    if (on('alt', Math.abs(dy), 0.25, 0.6)) A((dy > 0 ? (en ? '↑ climb ' : '↑ 올리기 ') : (en ? '↓ descend ' : '↓ 내리기 ')) + mR(Math.abs(dy)), K(dy > 0 ? 'up' : 'down'));
    if (hd > 2.5 && on('turn', Math.abs(ang), 7, 14)) A(ang > 0 ? (en ? '↷ turn right' : '↷ 오른쪽으로 돌기') : (en ? '↶ turn left' : '↶ 왼쪽으로 돌기'), K(ang > 0 ? 'yawR' : 'yawL'));
    else if (hd <= 12 && on('str', Math.abs(dr), 0.25, 0.6)) A((dr > 0 ? (en ? '→ slide right ' : '→ 오른쪽으로 ') : (en ? '← slide left ' : '← 왼쪽으로 ')) + mR(Math.abs(dr)), K(dr > 0 ? 'right' : 'left'));
    else HY.turn = HY.str = false;
  };
  let cls = '';
  if (o.kind === 'drop') {
    if (hd > 4) { if (on('turn', Math.abs(ang), 8, 16)) A(ang > 0 ? (en ? '↷ turn right' : '↷ 오른쪽으로 돌기') : (en ? '↶ turn left' : '↶ 왼쪽으로 돌기'), K(ang > 0 ? 'yawR' : 'yawL')); A((en ? '▲ forward to the target · ' : '▲ 표적 쪽으로 전진 · ') + Math.round(hd) + ' m', K('fwd')); }
    else { A(en ? 'Over the target · drop when the scope turns green (one chance)' : '표적 위 · 조준경이 초록이면 투하 (기회는 한 번)', K('drop')); cls = 'ok'; }
  } else if (o.kind === 'land') {
    if (hd > 0.5) A((en ? '→ over the pad · ' : '→ 패드 위로 · ') + mR(hd)); else { A(en ? 'Over the pad · descend slowly' : '패드 위 · 천천히 내려가기', K('down')); cls = 'ok'; }
  } else if (o.kind === 'takeoff') A(en ? '↑ climb' : '↑ 올라가기', K('up'));
  else if (o.kind === 'orbit') {
    A((en ? 'Orbit the tank · ' : '탱크 주위 한 바퀴 · ') + Math.min(100, Math.abs(S.orbSum) / (Math.PI * 2) * 100).toFixed(0) + '% · ' + (en ? 'follow the green path' : '초록 길 따라 전진'), K('fwd')); cls = 'ok';
    steer();
  } else if (o.t === 'rwyland' && typeof rwyGlide === 'function' && rwyGlide(subj.p)) {   // 활주로 접근: 접근각 맞추기 (3°) · 좌우는 조종 안내
    const g = rwyGlide(subj.p), dd = g.ang - 3;
    A((en ? 'Approach ' : '접근각 ') + g.ang.toFixed(1) + '° · ' + (Math.abs(dd) < 0.3 ? (en ? 'on the 3° slope · hold it' : '3° 경로 · 그대로') : dd > 0 ? (en ? 'high · ease down' : '높음 · 살짝 내리기') : (en ? 'low · ease up' : '낮음 · 살짝 올리기')), Math.abs(dd) < 0.3 ? null : K(dd > 0 ? 'pd' : 'pu')); cls = Math.abs(dd) < 0.3 ? 'ok' : '';
    if (on('turn', Math.abs(ang), 4, 8)) A(ang > 0 ? (en ? '↷ bank right' : '↷ 오른쪽으로 기울여 선회') : (en ? '↶ bank left' : '↶ 왼쪽으로 기울여 선회'), K(ang > 0 ? 'br' : 'bl'));
  } else if (o.t === 'track' && hd < 18 && Math.abs(dy) < 12) {   // 차량 추적: 관측 자리에 왔으면 더 다가가지 말고 유지
    A(en ? 'Observation spot · hold back here, keep the vehicle in view' : '관측 자리 · 여기서 거리 유지 · 차량을 시야에'); cls = 'ok';
  } else {
    if (GUIDE.detour) { A(en ? 'Around the bunker · U-turn in front of the window' : '벙커 옆으로 돌아 정면 창 앞에서 U턴'); cls = 'warn'; }
    if (o.kind === 'bunker' && S.scanned) { A(en ? 'SCAN done · exit through a window' : 'SCAN 완료 · 창으로 나가기'); cls = 'ok'; }
    steer();
    if (!acts.length) { A(en ? 'Lined up · forward' : '정렬 OK · 전진', K('fwd')); cls = 'ok'; }
  }
  if (S.boosting) { acts.unshift('BOOST ▲▲'); cls = cls || 'warn'; }
  const el = $('guide'), html = `<div class="${cls}">${acts.join(' · ')}</div>` + (keys.length ? `<div class="k">${[...new Set(keys)].join(' · ')}</div>` : '');
  el.classList.remove('hidden'); if (GUIDE.html !== html) { GUIDE.html = html; el.innerHTML = html; }
}

// ---- 자세 카메라 (옵션): FPV 시점일 때 기체 뒤 비스듬히 위에서 기체를 보는 작은 창 — 기울기·자세를 밖에서 확인 ----
const attCam = new THREE.PerspectiveCamera(40, 16 / 10, 0.1, 300), _acP = new V3(), _acT = new V3();
function renderAttCam() {
  const el = $('attcam'); if (!el) return;
  const on = !!SET.attCam && CAMS[S.cam] === 'FPV' && (S.state === 'run' || S.state === 'replay') && DR.alive && !(S.tut && S.tut.st !== 'fly') && !document.body.classList.contains('nohud');
  el.classList.toggle('hidden', !on); if (!on) return;
  const r = el.getBoundingClientRect(); if (r.width < 10) return;
  const subj = S.state === 'replay' ? RP.pose : DR, h = subj.h, R = Math.max(2.2, (AFc().R || 0.3) * 7);
  _acP.set(subj.p.x - Math.sin(h) * R * 0.75 - Math.cos(h) * R * 0.65, subj.p.y + R * 0.45, subj.p.z + Math.cos(h) * R * 0.75 - Math.sin(h) * R * 0.65);   // 뒤 왼쪽 비스듬히 위
  const gy = terrainAt(_acP.x, _acP.z) + 0.4; if (_acP.y < gy) _acP.y = gy;
  attCam.position.copy(_acP); attCam.up.set(0, 1, 0); _acT.copy(subj.p); attCam.lookAt(_acT); attCam.aspect = r.width / r.height; attCam.updateProjectionMatrix(); attCam.updateMatrixWorld();
  const vis = droneM.g.visible; droneM.g.visible = true; const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
  const y = innerHeight - r.bottom;
  renderer.setScissorTest(true); renderer.setScissor(r.left, y, r.width, r.height); renderer.setViewport(r.left, y, r.width, r.height);
  renderer.render(scene, attCam);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.shadowMap.autoUpdate = au; droneM.g.visible = vis;
}
// ---- 아래 카메라 (투하·선회 때 화면 한쪽에 드론 바로 아래를 보여줌) ----
const bellyCam = new THREE.PerspectiveCamera(72, 4 / 3, 0.1, 400);
// 'big' = 투하·선회 때 자동으로 크게 / 'small' = 직접 켠 경우 / null = 안 보임
function bellyMode() {
  if (S.state !== 'run' || !DR.alive || (S.tut && S.tut.st !== 'fly')) return null;
  const ov = S.bellyOv;
  if (ov && ov.val === false && ov.idx !== S.objIdx) S.bellyOv = null;          // 끈 것은 다음 과제에서 다시 자동
  const o = curObj();
  const auto = SET.belly && o && ((o.kind === 'drop' && dropTargetPos(o).distanceTo(DR.p) < 45) || (o.kind === 'orbit' && o.b.world(0, 0, 0).distanceTo(DR.p) < 30) || ((o.t === 'recon' || o.t === 'fire') && Math.hypot(o.tp.x - DR.p.x, o.tp.z - DR.p.z) < 140) || (o.t === 'sarfind' && o.mk && Math.hypot(o.mk.x - DR.p.x, o.mk.z - DR.p.z) < (o.search ? o.search.r : 120) + 30));
  if (S.bellyOv && S.bellyOv.val === false) return null;
  if (auto) return 'big';
  if (S.bellyOv && S.bellyOv.val === true) return 'small';
  return null;
}
function bellyActive() { return bellyMode() !== null; }
function renderBelly() {
  const el = $('belly'), mode = bellyMode(), on = mode !== null;
  el.classList.toggle('hidden', !on); el.classList.toggle('big', mode === 'big'); ui.hud.classList.toggle('bellyon', on); ui.hud.classList.toggle('bellybig', mode === 'big');
  if (!on) return;
  // PC: 평소엔 왼쪽(드론·과제 목록과 안 겹침). 튜토리얼 중엔 왼쪽에 설명창이 있으니 과제 목록 아래로
  const alt = !IS_TOUCH && !!S.tut; el.classList.toggle('alt', alt);
  if (alt) {
    const lr = $('list').getBoundingClientRect(), mr = $('map').getBoundingClientRect();
    const top = (lr.height > 10 ? lr.bottom : 14) + 10, h = Math.max(120, (mr.height > 10 ? mr.top : innerHeight) - 10 - top);
    el.style.top = top + 'px'; el.style.width = Math.min(430, Math.round(h * 4 / 3)) + 'px';
  } else {
    el.style.width = '';
    if ((LY.d.belly || LY.def.belly) && (LY.d.belly || LY.def.belly).x !== undefined) { }   // 사용자가 옮긴 위치 유지
    else if (!IS_TOUCH) { const ob = ui.osd.getBoundingClientRect(); el.style.top = Math.max(140, Math.round(ob.bottom + 10)) + 'px'; } else el.style.top = '';
  }
  const r = el.getBoundingClientRect(); if (r.width < 10) return;
  const fwd = new V3(Math.sin(DR.h), 0, -Math.cos(DR.h));
  bellyCam.position.copy(DR.p).add(new V3(0, -0.15, 0)); bellyCam.up.copy(fwd);
  bellyCam.lookAt(DR.p.x, DR.p.y - 10, DR.p.z); bellyCam.aspect = r.width / r.height; bellyCam.updateProjectionMatrix(); bellyCam.updateMatrixWorld();
  const vis = droneM.g.visible; droneM.g.visible = false;
  const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
  const y = innerHeight - r.bottom;
  renderer.setScissorTest(true); renderer.setScissor(r.left, y, r.width, r.height); renderer.setViewport(r.left, y, r.width, r.height);
  renderer.render(scene, bellyCam);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.shadowMap.autoUpdate = au; droneM.g.visible = vis;
}
