
// =====================================================================
//  바깥 지역 구조물: 송전선(철탑·전선·항공장애 표시구) · 마을 길가 전봇대·배전선
//  드론 사고의 큰 원인인 전선을 훈련에 넣음 — 전선·철탑·전봇대에 닿으면 충돌
//  (실제 자료가 오기 전까지 임의 배치 · 고정 난수 → 매번 같은 자리)
// =====================================================================
// 바깥 숲 나무 지우기 (선로·기지국 둘레 등): test(t) 가 참인 나무를 아주 작게 · 부딪힘도 없어짐
//  고급 나무(TREES3)는 나중에 T 를 읽어 만들므로 크기만 줄여 두면 되고, 이미 만든 나무 묶음은 그 자리 행렬을 0 으로
function outerCutTrees(test) {
  if (typeof OUTER === 'undefined' || !OUTER || !OUTER.T) return 0; const cut = new Set(), M4 = new THREE.Matrix4();
  OUTER.T.forEach(t => { if (t[3] > 0.02 && test(t)) { cut.add(Math.fround(t[0]) + ',' + Math.fround(t[2])); t[3] = 0.01; t[4] = 0.01; } });
  if (cut.size) for (const ck of OUTER.CK || []) for (const m of ck.grp.children) if (m.isInstancedMesh) { let ch = false;
    for (let k = 0; k < m.count; k++) { m.getMatrixAt(k, M4); const e = M4.elements; if (cut.has(e[12] + ',' + e[14])) { m.setMatrixAt(k, M4.makeScale(0, 0, 0)); ch = true; } }
    if (ch) m.instanceMatrix.needsUpdate = true; }
  return cut.size;
}
const POWER = (function powerLines() {
  if (typeof OUTER === 'undefined' || !OUTER || !MID) return null;
  const r = rng(51207), SEG = [], GC = 24, GRID = new Map(), PGRID = new Map(), api0 = {};
  const inInner = (x, z) => x > GS0 - 40 && x < GS1 + 40 && -z > GD0 - 40 && -z < GD1 + 40;
  const nearRwy = (x, z, pad) => { if (!RWY) return false; const l = rwyLocal({ x, z }); return Math.abs(l.t) < RWY.L / 2 + 300 + pad && Math.abs(l.w) < 80 + pad; };
  const gkey = (x, z) => Math.floor(x / GC) + ',' + Math.floor(z / GC);
  const gadd = (G, x0, z0, x1, z1, i) => { for (let x = Math.floor(x0 / GC) - 1; x <= Math.floor(x1 / GC) + 1; x++) for (let z = Math.floor(z0 / GC) - 1; z <= Math.floor(z1 / GC) + 1; z++) { const k = x + ',' + z; let L = G.get(k); if (!L) G.set(k, L = []); L.push(i); } };
  function addSeg(a, b, hv) { const i = SEG.length; SEG.push([a, b, hv]); gadd(GRID, Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), i); }
  // 전선 한 경간: 가운데가 sag 만큼 처짐(포물선) · n 토막으로 나눠 그리기·충돌에 씀
  const sagY = (t, sag) => 4 * sag * t * (1 - t);
  function span(A, B, sag, n, out, hv) {
    let a = A.clone();
    for (let k = 1; k <= n; k++) { const t = k / n, b = new V3(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t - sagY(t, sag), A.z + (B.z - A.z) * t);
      out.push(a.x, a.y, a.z, b.x, b.y, b.z); addSeg(a, b, hv); a = b; }
  }
  const B = OUTER.B || [];
  // ---- 1) 송전선 (154 kV 2회선 철탑, 높이 48 m) ----
  // 비행 구역 바깥쪽을 곧게 가로지름 · 안쪽 훈련장·활주로 접근로를 피하고, 집과 가파른 곳이 적은 길을 고름
  const ARM = [[31, 6.5], [36, 7.6], [41, 6.5]], TOPW = 46.5, LOWC = ARM[0][0] - 2.2, SAGK = 0.028;
  let best = null;
  for (let a = 0; a < 24; a++) for (const off of [470, 540, 610, 680, 750]) for (const sgn of [-1, 1]) {
    const th = a * Math.PI / 24, dx = Math.cos(th), dz = Math.sin(th), nx = -dz * sgn, nz = dx * sgn, cx = FLY_C.x + nx * off, cz = FLY_C.z + nz * off, L = Math.sqrt(Math.max(0, (FLY_R + 120) ** 2 - off * off));
    if (L < 300) continue;
    let bad = 0, ok = true, hmin = 1e9, hmax = -1e9;
    for (let t = -L; t <= L; t += 20) { const x = cx + dx * t, z = cz + dz * t; if (inInner(x, z) || nearRwy(x, z, 0)) { ok = false; break; }
      for (const b of B) if (Math.abs(b.x - x) < 40 && Math.abs(b.z - z) < 40 && Math.hypot(b.x - x, b.z - z) < 30) bad++;
      const h = groundAt(x, z); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); }
    if (!ok) continue;
    const sc = bad * 2 + (hmax - hmin) / 25 + Math.abs(off - 620) / 120 + r() * 0.6;
    if (!best || sc < best.sc) best = { sc, cx, cz, dx, dz, L };
  }
  const TW = [], HV = [];
  if (best) {
    const { cx, cz, dx, dz, L } = best, sx = -dz, sz = dx, yaw = Math.atan2(dx, dz);
    const mk = t => { const x = cx + dx * t, z = cz + dz * t; let y = 1e9; for (const [ox, oz] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 0]]) y = Math.min(y, groundAt(x + ox * 5, z + oz * 5)); return { t, x, z, y: y - 0.3, yaw }; };
    const n = Math.max(2, Math.round(2 * L / 330)); for (let i = 0; i <= n; i++) TW.push(mk(-L + 2 * L * i / n));
    // 가운데서 땅과 너무 가까운(12 m 미만) 경간은 그 자리에 철탑을 하나 더 세움 (능선 넘기)
    for (let guard = 0; guard < 40; guard++) { let worst = null;
      for (let i = 0; i < TW.length - 1; i++) { const A = TW[i], Bt = TW[i + 1], dist = Bt.t - A.t; if (dist < 120) continue; const sag = dist * SAGK;
        for (let k = 1; k < 20; k++) { const u = k / 20, x = A.x + (Bt.x - A.x) * u, z = A.z + (Bt.z - A.z) * u, wy = A.y + (Bt.y - A.y) * u + LOWC - sagY(u, sag), c = wy - groundAt(x, z);
          if (c < 12 && (!worst || c < worst.c)) worst = { c, i, t: A.t + dist * clamp(u, 0.3, 0.7) }; } }
      if (!worst) break; TW.splice(worst.i + 1, 0, mk(worst.t)); }
    const att = (T, side, k) => new V3(T.x + sx * side * ARM[k][1], T.y + ARM[k][0] - 2.2, T.z + sz * side * ARM[k][1]);
    for (let i = 0; i < TW.length - 1; i++) { const A = TW[i], Bt = TW[i + 1], sag = (Bt.t - A.t) * SAGK, nn = Math.max(8, Math.round((Bt.t - A.t) / 22));
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) span(att(A, side, k), att(Bt, side, k), sag, nn, HV, 1);
      span(new V3(A.x, A.y + TOPW, A.z), new V3(Bt.x, Bt.y + TOPW, Bt.z), sag * 0.85, nn, HV, 1); }
  }
  // 철탑 모양: 네 다리 · 층마다 수평재 · X 가새 · 팔 3단(애자 매달림) · 꼭대기 (가는 상자를 하나로 합침)
  const towerGeo = (() => {
    const parts = [], bx = (a, b, t) => { const d = b.clone().sub(a), L = d.length(), g = new THREE.BoxGeometry(t, L, t); g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); parts.push(g.toNonIndexed()); };
    const w = y => 4.2 * (1 - y / 52) + 0.9, H = [0, 6, 12, 18, 24, 30, 36, 41, 46], c = (y, sx, sz) => new V3(sx * w(y), y, sz * w(y)), Cn = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    for (const [sx, sz] of Cn) for (let i = 0; i < H.length - 1; i++) bx(c(H[i], sx, sz), c(H[i + 1], sx, sz), 0.3);
    for (let i = 1; i < H.length; i++) for (let k = 0; k < 4; k++) bx(c(H[i], ...Cn[k]), c(H[i], ...Cn[(k + 1) % 4]), 0.16);
    for (let i = 0; i < H.length - 1; i++) for (let k = 0; k < 4; k++) { const a = Cn[k], b = Cn[(k + 1) % 4]; bx(c(H[i], ...a), c(H[i + 1], ...b), 0.12); bx(c(H[i], ...b), c(H[i + 1], ...a), 0.12); }
    for (const [y, L] of ARM) for (const s of [-1, 1]) { bx(new V3(s * w(y), y, 0.6), new V3(s * L, y, 0), 0.2); bx(new V3(s * w(y), y, -0.6), new V3(s * L, y, 0), 0.2); bx(new V3(s * w(y + 2.5), y + 2.5, 0), new V3(s * L, y, 0), 0.14);
      const ins = new THREE.CylinderGeometry(0.17, 0.17, 2.2, 6); ins.translate(s * L, y - 1.1, 0); parts.push(ins.toNonIndexed()); }
    bx(new V3(0, 46, 0), new V3(0, 48, 0), 0.25);
    let nv = 0; parts.forEach(g => nv += g.attributes.position.count); const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3); let o = 0;
    for (const g of parts) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.computeBoundingSphere(); return g;
  })();
  const G = new THREE.Group(); G.name = 'power'; scene.add(G);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new V3(0, 1, 0), ONE = new V3(1, 1, 1);
  if (TW.length) {
    const im = new THREE.InstancedMesh(towerGeo, new THREE.MeshStandardMaterial({ color: 0xa4aab0, roughness: 0.5, metalness: 0.5 }), TW.length);
    TW.forEach((t, i) => { Q.setFromAxisAngle(UP, t.yaw); M4.compose(new V3(t.x, t.y, t.z), Q, ONE); im.setMatrixAt(i, M4); }); im.castShadow = !LOWQ; im.userData.irBase = 0.2; G.add(im);
    // 항공장애 표시구 (주황·흰 공 번갈아): 가공지선 위 약 60 m 마다
    const balls = [];
    for (let i = 0; i < TW.length - 1; i++) { const A = TW[i], Bt = TW[i + 1], dist = Bt.t - A.t, sag = dist * SAGK * 0.85, n = Math.max(2, Math.round(dist / 60));
      for (let k = 1; k < n; k++) { const u = k / n; balls.push([A.x + (Bt.x - A.x) * u, A.y + (Bt.y - A.y) * u + TOPW - sagY(u, sag), A.z + (Bt.z - A.z) * u, (i + k) % 2]); } }
    if (balls.length) { const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }), balls.length), c = new THREE.Color();
      balls.forEach((b, i) => { M4.makeTranslation(b[0], b[1] - 0.6, b[2]); bi.setMatrixAt(i, M4); bi.setColorAt(i, c.setHex(b[3] ? 0xff6a1a : 0xf4f4f4)); }); G.add(bi); }
  }
  // ---- 2) 마을 길가 전봇대·배전선 (6 m 이상 길 · 약 45 m 간격 · 길 한쪽) ----
  const POLES = [], LV = [], PH = 10.6;
  for (const rd of OUTER.roads || []) { if (rd.w < 6) continue; const p = rd.p; let acc = 0, side = r() < 0.5 ? -1 : 1, last = null;
    for (let i = 1; i < p.length; i++) { const [x0, z0] = p[i - 1], [x1, z1] = p[i], L0 = Math.hypot(x1 - x0, z1 - z0); acc += L0; if (acc < 45) continue; acc = 0;
      const tx = (x1 - x0) / (L0 || 1), tz = (z1 - z0) / (L0 || 1), off = rd.w / 2 + 2.2, x = x1 - tz * off * side, z = z1 + tx * off * side;
      if (inInner(x, z) || nearRwy(x, z, -60) || B.some(b => Math.abs(b.x - x) < 20 && Math.abs(b.z - z) < 20 && Math.hypot(b.x - x, b.z - z) < Math.max(b.w, b.l) * 0.7 + 1.5)) { last = null; continue; }
      const P0 = { x, z, y: groundAt(x, z) - 0.1, yaw: Math.atan2(tx, tz), rx: tz * side, rz: -tx * side }, pi = POLES.length; POLES.push(P0); gadd(PGRID, x, z, x, z, pi);
      if (last && Math.hypot(last.x - x, last.z - z) < 70) { const ax = Math.cos(P0.yaw), az = -Math.sin(P0.yaw), lx = Math.cos(last.yaw), lz = -Math.sin(last.yaw);
        for (const k of [-0.95, 0, 0.95]) span(new V3(last.x + lx * k, last.y + PH, last.z + lz * k), new V3(x + ax * k, P0.y + PH, z + az * k), 0.6, 6, LV, 0); }
      last = P0; } }
  if (POLES.length) {
    const pg = new THREE.CylinderGeometry(0.12, 0.19, 11, 7); pg.translate(0, 5.5, 0);
    const ag = new THREE.BoxGeometry(2.4, 0.12, 0.12); ag.translate(0, PH - 0.12, 0);
    const pm = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.85 }), POLES.length), am = new THREE.InstancedMesh(ag, new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.6, metalness: 0.4 }), POLES.length);
    POLES.forEach((p, i) => { Q.setFromAxisAngle(UP, p.yaw); M4.compose(new V3(p.x, p.y, p.z), Q, ONE); pm.setMatrixAt(i, M4); am.setMatrixAt(i, M4); });
    pm.castShadow = am.castShadow = !LOWQ; pm.userData.irBase = am.userData.irBase = 0.15; G.add(pm); G.add(am);
  }
  // 전선: 1 px 선 — 실제처럼 가늘어 멀리서는 잘 안 보임 (그래서 조심해야 함)
  const wire = (arr, col) => { if (!arr.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeBoundingSphere(); G.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col, fog: true }))); };
  wire(HV, 0x33373b); wire(LV, 0x222222);
  // 선로 아래 나무 정리 (실제 선로 관리처럼): 전선에 닿을 만한 나무 · 철탑 둘레 나무를 없앰
  // 고급 나무(TREES3)는 나중에 T 를 읽어 만들므로 크기만 줄여 두면 되고, 기본 나무 묶음은 여기서 바로 지움
  api0.cut = outerCutTrees(t => { const top = t[1] + t[3]; if (TW.some(q => Math.abs(q.x - t[0]) < 12 && Math.abs(q.z - t[2]) < 12)) return true; const L = GRID.get(gkey(t[0], t[2]));
    if (L) for (const si of L) { const [a, b, hv] = SEG[si], ex = b.x - a.x, ez = b.z - a.z, u = clamp(((t[0] - a.x) * ex + (t[2] - a.z) * ez) / (ex * ex + ez * ez || 1), 0, 1), hd = Math.hypot(a.x + ex * u - t[0], a.z + ez * u - t[2]), wy = a.y + (b.y - a.y) * u;
      if (hv ? hd < 10 && top > wy - 8 : hd < t[4] + 1.5 && top > wy - 2) return true; }
    return false; });
  // ---- 충돌: 전선(반지름 3 cm) · 철탑(위로 갈수록 좁아지는 사각 기둥 + 팔) · 전봇대 ----
  const _a = new V3(), _b = new V3(), _q = new V3();
  function wireDist(p, i) { const [a, b] = SEG[i]; _a.subVectors(b, a); const t = clamp(_b.subVectors(p, a).dot(_a) / Math.max(1e-6, _a.lengthSq()), 0, 1); _q.copy(a).addScaledVector(_a, t); return p.distanceTo(_q); }
  function col(p, Rr) {
    let best = null; const L = GRID.get(gkey(p.x, p.z));
    if (L) for (const i of L) { const d = wireDist(p, i), pen = Rr + 0.03 - d;
      if (pen > 0 && (!best || pen > best.pen)) best = { pen, n: d > 1e-4 ? new V3(p.x - _q.x, p.y - _q.y, p.z - _q.z).divideScalar(d) : new V3(0, 1, 0), tag: 'wire' }; }
    for (const t of TW) { const dy = p.y - t.y; if (dy < -Rr || dy > 48 + Rr || Math.abs(p.x - t.x) > 10 + Rr || Math.abs(p.z - t.z) > 10 + Rr) continue;
      const c = Math.cos(t.yaw), s = Math.sin(t.yaw), dx = p.x - t.x, dz = p.z - t.z, ux = dx * c - dz * s, uz = dx * s + dz * c, toW = (nx, nz) => new V3(nx * c + nz * s, 0, -nx * s + nz * c);
      const hw = 4.2 * (1 - clamp(dy, 0, 48) / 52) + 0.9, px = hw + Rr - Math.abs(ux), pz = hw + Rr - Math.abs(uz);
      if (px > 0 && pz > 0) { const pen = Math.min(px, pz), n = px < pz ? toW(Math.sign(ux) || 1, 0) : toW(0, Math.sign(uz) || 1); if (!best || pen > best.pen) best = { pen, n, tag: 'tower' }; }
      for (const [y, Lm] of ARM) { const qy = 0.6 + Rr - Math.abs(dy - y), qz = 0.7 + Rr - Math.abs(uz); if (qy > 0 && qz > 0 && Math.abs(ux) < Lm + Rr) { const pen = Math.min(qy, qz), n = qy < qz ? new V3(0, Math.sign(dy - y) || 1, 0) : toW(0, Math.sign(uz) || 1); if (!best || pen > best.pen) best = { pen, n, tag: 'tower' }; } } }
    const PL = PGRID.get(gkey(p.x, p.z));
    if (PL) for (const i of PL) { const q = POLES[i], dy = p.y - q.y; if (dy < -Rr || dy > 11 + Rr) continue; const d = Math.hypot(p.x - q.x, p.z - q.z), pen = 0.2 + Rr - d;
      if (pen > 0 && (!best || pen > best.pen)) best = { pen, n: new V3((p.x - q.x) / (d || 1), 0, (p.z - q.z) / (d || 1)), tag: 'pole' }; }
    return best;
  }
  if (STREES && STREES.col) { const oc = STREES.col; STREES.col = (p, Rr) => oc(p, Rr) || col(p, Rr); }
  // 링·표적 높이 고르기용: 그 둘레에서 가장 높은 전선·철탑 꼭대기
  function topAt(x, z, R) { let top = -1e9; const L = GRID.get(gkey(x, z)); if (L) for (const i of L) { const [a, b] = SEG[i]; for (const q of [a, b]) if (Math.hypot(q.x - x, q.z - z) < R + 4) top = Math.max(top, q.y + 1); }
    for (const t of TW) if (Math.hypot(t.x - x, t.z - z) < R + 10) top = Math.max(top, t.y + 48); return top; }
  if (STREES && STREES.topAt) { const ot = STREES.topAt; STREES.topAt = (x, z, R) => Math.max(ot(x, z, R), topAt(x, z, R)); }
  // 가까이 가면 경고: 송전선 30 m · 배전선 12 m 안
  let warnT = 0;
  function tick(dt) {
    if ((warnT -= dt) > 0 || S.state !== 'run' || !DR.alive) return;
    const p = DR.p; let dmin = 1e9, hv = 0;
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) { const L = GRID.get((Math.floor(p.x / GC) + ox) + ',' + (Math.floor(p.z / GC) + oz)); if (L) for (const i of L) { const d = wireDist(p, i); if (d < dmin) { dmin = d; hv = SEG[i][2]; } } }
    if (dmin < (hv ? 30 : 12)) { showMsg(L2x(`⚠ 전선 주의 · ${dmin.toFixed(0)} m`, `⚠ WIRES · ${dmin.toFixed(0)} m`), '#ffb030', 1.4); sfx('bad'); rumble(0.15, 0.3, 90); warnT = 4;
      if (S.t - (api0.cT || -99) > 30) { api0.cT = S.t; comm('Eagle One, Control. Power lines close aboard, climb and give them room.', '전선 근접. 상승해서 거리를 두세요.', 'CONTROL', 'wire'); } }   // 무전도 (30초에 한 번)
    else warnT = 0.4;
  }
  // 지도: 송전선(주황 점선 + 철탑 점)
  function mapDraw(g, mxyF) { if (!TW.length) return; g.save(); g.strokeStyle = 'rgba(255,170,60,.9)'; g.lineWidth = 1.3; g.setLineDash([5, 3]); g.beginPath();
    TW.forEach((t, i) => { const [u, v] = mxyF(-t.z, t.x); i ? g.lineTo(u, v) : g.moveTo(u, v); }); g.stroke(); g.setLineDash([]); g.fillStyle = '#ffb040'; TW.forEach(t => { const [u, v] = mxyF(-t.z, t.x); g.fillRect(u - 1.5, v - 1.5, 3, 3); }); g.restore(); }
  const api = Object.assign(api0, { G, TW, POLES, SEG, col, topAt, tick, mapDraw });
  window.__POWER = api;
  if (typeof MAP_CACHE !== 'undefined' && MAP_CACHE.course) { try { const kb = mapBg, kv = MAPV; mapBg = MAP_CACHE.course; MAPV = MAP_CACHE.course.V || MAPV; drawMapBg(); mapBg = kb; MAPV = kv; } catch (e) { } }
  return api;
})();
if (window.__sim) Object.assign(window.__sim, { POWER });
