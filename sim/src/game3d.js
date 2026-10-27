
// =====================================================================
//  가이드: 다음 과제까지 따라갈 사각 틀(3D) + 조작 안내 문구 + 아래 카메라
// =====================================================================
const GUIDE = { n: 10, sp: 2.6, meshes: [], next: null, detour: false };
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
function hideGuide() { GUIDE.meshes.forEach(x => x.g.visible = false); GPATH.m.visible = false; GAXIS.m.visible = false; GCHEV.m.visible = false; $('guide').classList.add('hidden'); const na = $('navArrow'); if (na) na.classList.add('hidden'); }
// 다음 목표 방향 표시: 화면 안이면 목표 아래에 거리, 화면 밖이면 가장자리에 그쪽을 가리키는 화살표 + 거리 (VR·1종 제외)
const _nv = new V3();
function navArrow(tgt, subj) {
  let el = $('navArrow'); if (!el) { el = document.createElement('div'); el.id = 'navArrow'; el.innerHTML = '<i>➤</i><b></b>'; document.body.appendChild(el); }
  if (!tgt || XR_ON || S.state !== 'run') { el.classList.add('hidden'); return; }
  const dist = tgt.distanceTo(subj.p); if (dist < 4) { el.classList.add('hidden'); return; }
  _nv.copy(tgt).project(camera); const behind = _nv.z > 1;
  let x = _nv.x, y = _nv.y; if (behind) { x = -x; y = -y; }
  const W = innerWidth, H = innerHeight, mx = 0.80, my = 0.74;   // 가장자리 여백 (계기·목록 피함)
  const inside = !behind && Math.abs(x) < mx && Math.abs(y) < my;
  let sx, sy, rot;
  if (inside) { sx = (x + 1) / 2 * W; sy = (1 - y) / 2 * H + 34; rot = 90; }   // 목표 아래쪽에 ▼ + 거리
  else { const k = Math.max(Math.hypot(x / mx, y / my), 1e-6); x /= k; y /= k; /* 타원 가장자리: 모서리의 계기·목록을 피함 */ sx = (x + 1) / 2 * W; sy = (1 - y) / 2 * H; rot = Math.atan2(-(y), x) / Math.PI * 180; }
  el.classList.remove('hidden'); el.classList.toggle('edge', !inside);
  el.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%,-50%)`;
  el.firstChild.style.transform = `rotate(${rot.toFixed(0)}deg)`;
  const txt = dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : dist.toFixed(0) + ' m'; if (el.lastChild.textContent !== txt) el.lastChild.textContent = txt;
}
function updateGuide(subj) {
  const active = S.state === 'run' && DR.alive && !(S.tut && S.tut.st !== 'fly');
  const o = active ? curObj() : null;
  GUIDE.next = null;
  if (!o || (typeof isC1 === 'function' && isC1())) { hideGuide(); return; }
  if (o.kind === 'bunker' && !S.scanned && insideBunker(subj.p)) {
    hideGuide(); if (!SET.guide) return;
    const el = $('guide'); el.classList.remove('hidden'); el.innerHTML = '<div class="ok">정찰 중 · 안에서 잠시 머무르기</div>'; return;
  }
  // 수색 구역(산불·실종자) 안: 경로 띠는 끄되 안내는 끊지 않음 — 구역 중심 화살표 + 할 일·고도 안내
  if (o.kind === 'ms' && searchIn(o, subj.p)) {
    GUIDE.meshes.forEach(x => x.g.visible = false); GPATH.m.visible = false; GAXIS.m.visible = false;
    navArrow(o.mk, subj);
    if (!SET.guide) { $('guide').classList.add('hidden'); return; }
    const agl = subj.p.y - terrainAt(subj.p.x, subj.p.z), lines = [], fire = o.t === 'fire', band = fire ? [35, 70] : [15, 35];
    const en = window.SIM_LANG === 'en';
    if (o.inView) lines.push([fire ? (en ? 'HOTSPOT in view · centre it and press Enter/📷' : '불씨 포착 · 화면 가운데에 두고 Enter/📷') : (en ? 'Hiker in view · centre and Enter/📷' : '실종자 포착 · 가운데에 두고 Enter/📷'), 'ok']);
    else {
      lines.push([fire ? (en ? 'Inside search area · sweep slowly with thermal (T), look for smoke/glow' : '수색 구역 안 · 열화상(T)으로 천천히 훑기 · 연기·불빛 찾기') : (en ? 'Inside search area · fly low and slow, look along paths and clearings' : '수색 구역 안 · 낮고 천천히 · 길가·공터 위주로 살피기'), '']);
      if (agl > band[1]) lines.push([(en ? 'Descend to ' : '고도 내리기 → ') + band[0] + '–' + band[1] + ' m' + (en ? ' AGL' : ''), 'warn']);
      else if (agl < band[0]) lines.push([(en ? 'Climb to ' : '고도 올리기 → ') + band[0] + '–' + band[1] + ' m', 'warn']);
      const dc = Math.hypot(o.mk.x - subj.p.x, o.mk.z - subj.p.z); if (dc > o.search.r * 0.8) lines.push([en ? 'Near the edge · turn back toward the centre' : '구역 가장자리 · 중심 쪽으로 되돌아가기', 'warn']);
    }
    const el = $('guide'); el.classList.remove('hidden'); el.innerHTML = lines.map(l => `<div class="${l[1]}">${l[0]}</div>`).join(''); return;
  }
  let pts = guidePoints(o, subj.p);
  if (!pts) { hideGuide(); return; }
  GUIDE.next = pts[1];
  navArrow(o.mk || pts[pts.length - 1], subj);
  if (!SET.guide) { hideGuide(); return; }
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
  // ---- 조작 안내 문구 ----
  const T = XR_ON && vrStickMode() === 3 ? { up: '오른쪽 스틱 ↑', down: '오른쪽 스틱 ↓', yawL: (window.SIM_LANG === 'en' ? 'look ←' : '고개 ←'), yawR: (window.SIM_LANG === 'en' ? 'look →' : '고개 →'), fwd: '왼쪽 스틱 ↑', back: '왼쪽 스틱 ↓', left: '오른쪽 스틱 ←', right: '오른쪽 스틱 →', drop: 'R트리거', boost: 'L트리거' }
    : XR_ON && vrStickMode() === 1 ? { up: '오른쪽 스틱 ↑', down: '오른쪽 스틱 ↓', yawL: '왼쪽 스틱 ←', yawR: '왼쪽 스틱 →', fwd: '왼쪽 스틱 ↑', back: '왼쪽 스틱 ↓', left: '오른쪽 스틱 ←', right: '오른쪽 스틱 →', drop: 'R트리거', boost: 'L트리거' }
    : (IS_TOUCH || XR_ON) ? { up: '왼쪽 스틱 ↑', down: '왼쪽 스틱 ↓', yawL: '왼쪽 스틱 ←', yawR: '왼쪽 스틱 →', fwd: '오른쪽 스틱 ↑', back: '오른쪽 스틱 ↓', left: '오른쪽 스틱 ←', right: '오른쪽 스틱 →', drop: XR_ON ? 'R트리거' : 'DROP', boost: XR_ON ? 'L트리거' : 'BST' } : null;
  const wingF = AFc().cls === 'wing', vm0 = XR_ON ? vrStickMode() : 2;
  /* 고정익: 선회 = 기울이기(롤) · 상승 = 스틱 당기기(뒤) · 속도 = 스로틀. 모드에 따라 스틱 위치가 다름 */
  const WL = T ? (XR_ON && vm0 === 1 ? { pu: '왼쪽 스틱 ↓', pd: '왼쪽 스틱 ↑', bl: '오른쪽 스틱 ←', br: '오른쪽 스틱 →', th: '오른쪽 스틱 ↑', tl: '오른쪽 스틱 ↓' } : { pu: '오른쪽 스틱 ↓', pd: '오른쪽 스틱 ↑', bl: '오른쪽 스틱 ←', br: '오른쪽 스틱 →', th: '왼쪽 스틱 ↑', tl: '왼쪽 스틱 ↓' })
    : { pu: keyName(KB.back), pd: keyName(KB.fwd), bl: keyName(KB.left), br: keyName(KB.right), th: keyName(KB.up), tl: keyName(KB.down) };
  const K = a => (wingF && WL[a]) ? WL[a] : T ? T[a] : keyName(KB[a]);
  const tgt0 = (o.kind === 'orbit' || GUIDE.detour) ? pts[1] : (pts.length > 2 ? pts[pts.length - 2] : pts[1]);
  /* 조작 안내도 화면에 그려진 곡선 위의 앞쪽 점을 기준으로 (목표 지점이 아니라 가이드를 따라가도록) */
  const vs = Math.hypot(DR.v.x, DR.v.z), lookD = wingF ? clamp(vs * 2.5, 30, 70) : clamp(3 + vs * 0.9, 4, 14), cL = curve.getLength();
  const tgtC = curve.getPointAt(Math.min(1, lookD / Math.max(cL, 0.1)));
  const tgt = (o.kind === 'drop' || o.kind === 'land') ? tgt0 : wingF ? tgtC : (GUIDE.wp && GUIDE.wp.distanceTo(subj.p) > 2.5 ? GUIDE.wp : tgtC);
  const d = tgt.clone().sub(subj.p), fwd = new V3(Math.sin(DR.h), 0, -Math.cos(DR.h)), rgt = new V3(Math.cos(DR.h), 0, Math.sin(DR.h));
  const df = d.dot(fwd), dr = d.dot(rgt), dy = d.y, hd = Math.hypot(df, dr), ang = Math.atan2(dr, df) / DEG;
  const lines = [];
  const steer = () => {
    if (DR.landed && !wingF && o.kind !== 'land') { lines.push([`먼저 이륙 · 올라가기 (${K('up')})`, '']); return; }
    if (wingF) {
      if (Math.abs(dy) > 2) lines.push([`${dy > 0 ? '고도 올리기' : '고도 내리기'} ${Math.abs(dy).toFixed(0)} m (${K(dy > 0 ? 'pu' : 'pd')})`, '']);
      if (Math.abs(ang) > 6) lines.push([`${ang > 0 ? '오른쪽으로 기울여 선회' : '왼쪽으로 기울여 선회'} (${K(ang > 0 ? 'br' : 'bl')})`, '']);
      return;
    }
    if (Math.abs(dy) > 0.3) lines.push([`${dy > 0 ? '고도 올리기' : '고도 내리기'} ${Math.abs(dy).toFixed(1)} m (${K(dy > 0 ? 'up' : 'down')})`, '']);
    if (hd > 2.5 && Math.abs(ang) > 12) lines.push([`${ang > 0 ? '오른쪽으로 돌기' : '왼쪽으로 돌기'} (${K(ang > 0 ? 'yawR' : 'yawL')})`, '']);
    else if (hd <= 12 && Math.abs(dr) > 0.3) lines.push([`${dr > 0 ? '오른쪽으로 이동' : '왼쪽으로 이동'} ${Math.abs(dr).toFixed(1)} m (${K(dr > 0 ? 'right' : 'left')})`, '']);
  };
  if (o.kind === 'drop') {
    if (hd > 4) lines.push([`${Math.abs(ang) > 15 ? (ang > 0 ? '오른쪽으로 돌기 (' + K('yawR') + ') · ' : '왼쪽으로 돌기 (' + K('yawL') + ') · ') : ''}표적 쪽으로 전진 (${K('fwd')}) ${hd.toFixed(0)} m`, '']);
    else lines.push([`표적 위 · DROP SCOPE가 초록이 되면 투하 (${K('drop')}) · 기회는 한 번`, 'ok']);
  } else if (o.kind === 'land') {
    if (hd > 0.5) lines.push([`패드 쪽으로 이동 ${hd.toFixed(1)} m`, '']);
    else lines.push([`패드 위 · 천천히 내려가기 (${K('down')})`, 'ok']);
  } else if (o.kind === 'takeoff') lines.push([`올라가기 (${K('up')})`, '']);
  else if (o.kind === 'orbit') {
    lines.push([`탱크 주위 한 바퀴 선회 · ${Math.min(100, Math.abs(S.orbSum) / (Math.PI * 2) * 100).toFixed(0)}% · 초록 틀을 따라 계속 전진 (${K('fwd')})`, 'ok']);
    steer();
  } else {
    if (GUIDE.detour) lines.push(['벙커 옆으로 돌아 정면 창 앞에서 U턴 → 창으로 진입', 'warn']);
    if (o.kind === 'bunker' && S.scanned) lines.push(['SCAN 완료 · 창으로 나가기 (왼쪽 창 또는 들어온 창)', 'ok']);
    steer();
    if (!lines.length) lines.push([`정렬 OK · 전진 (${K('fwd')})`, 'ok']);
  }
  if (S.boosting) lines.unshift(['BOOST ▲▲', 'warn']);
  const el = $('guide'); el.classList.remove('hidden');
  el.innerHTML = lines.map(l => `<div class="${l[1]}">${l[0]}</div>`).join('');
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
