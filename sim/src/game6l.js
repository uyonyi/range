
// =====================================================================
//  길가 가로등: 안쪽 수치지형도 도로(도로 경계선) · 바깥 길(가운데 선) — 약 36 m 간격, 길 한쪽 (가로등끼리 30 m 이상)
//   8 m 철제 기둥 + 길 쪽으로 뻗은 팔 + LED 등기구 · 바깥 큰길은 전봇대마다 팔·등을 닮
//   밤·해질녘: 등기구가 빛나고 바닥에 빛이 둥글게 퍼지며, 멀리서도 빛망울이 보임 (열화상에서는 빛 없음)
//   기둥·팔에 부딪힘 · 코스 경로·장애물·활주로·착륙장·숲길·1종 시험장·건물·전봇대 둘레는 비움 · 기둥 자리 나무는 치움
//   1종 시험장이 자리를 잡고 땅을 다진 뒤(c1Place) 세우도록 앱 시작 직후 한 번 (setTimeout)
// =====================================================================
const LAMPS = (function streetLamps() {
  const api = { n: 0, L: [], ready: false, tick() { } };
  if (window.SIM_NOLAMPS) return api;
  window.__LAMPS = api;
  const H = 8, ARM = 1.75, HEAD = ARM + 0.24, SP = 36, MIN = 30, POOL_R = 7.5;   // 기둥 높이 · 팔 길이 · 등기구 가운데 · 간격 · 가로등끼리 최소 거리 · 바닥 빛 반지름
  const GC = 24, GRID = new Map(), gk = (x, z) => Math.floor(x / GC) + ',' + Math.floor(z / GC);
  function near(x, z, r) { const g = Math.ceil(r / GC); for (let ix = Math.floor(x / GC) - g; ix <= Math.floor(x / GC) + g; ix++) for (let iz = Math.floor(z / GC) - g; iz <= Math.floor(z / GC) + g; iz++) { const C = GRID.get(ix + ',' + iz); if (C) for (const L of C) if (Math.hypot(L.x - x, L.z - z) < r) return true; } return false; }
  function put(L) { const k = gk(L.x, L.z); let C = GRID.get(k); if (!C) GRID.set(k, C = []); C.push(L); api.L.push(L); }
  // ---- 부딪힘: 기둥(세로 원기둥) · 팔+등기구(기둥 위에서 길 쪽으로 뻗은 막대) ----
  function col(p, Rr) {
    let best = null; const gx = Math.floor(p.x / GC), gz = Math.floor(p.z / GC);
    for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++) { const C = GRID.get(ix + ',' + iz); if (!C) continue;
      for (const L of C) { const dy = p.y - L.y; if (dy < -Rr || dy > L.h + 0.8 + Rr) continue; const dx = p.x - L.x, dz = p.z - L.z;
        if (Math.abs(dx) > HEAD + 1 + Rr || Math.abs(dz) > HEAD + 1 + Rr) continue;
        if (L.pole && dy < L.h + 0.1) { const d = Math.hypot(dx, dz), pen = 0.12 + Rr - d; if (pen > 0 && (!best || pen > best.pen)) best = { pen, n: d > 1e-4 ? new V3(dx / d, 0, dz / d) : new V3(1, 0, 0), tag: 'lamp' }; }
        const t = clamp((dx * L.ax + dz * L.az) / (HEAD + 0.32), 0, 1), qx = L.x + L.ax * (HEAD + 0.32) * t, qz = L.z + L.az * (HEAD + 0.32) * t, qy = L.y + L.h + 0.2 * t;
        const ex = p.x - qx, ey = p.y - qy, ez = p.z - qz, d2 = Math.hypot(ex, ey, ez), pen2 = (t > 0.85 ? 0.22 : 0.12) + Rr - d2;
        if (pen2 > 0 && (!best || pen2 > best.pen)) best = { pen: pen2, n: d2 > 1e-4 ? new V3(ex / d2, ey / d2, ez / d2) : new V3(0, 1, 0), tag: 'lamp' }; } }
    return best;
  }
  function topAt(x, z, R) { let top = -1e9; const g = Math.ceil((R + 3) / GC); for (let ix = Math.floor(x / GC) - g; ix <= Math.floor(x / GC) + g; ix++) for (let iz = Math.floor(z / GC) - g; iz <= Math.floor(z / GC) + g; iz++) { const C = GRID.get(ix + ',' + iz); if (C) for (const L of C) if (Math.hypot(L.x - x, L.z - z) < R + 3) top = Math.max(top, L.y + L.h + 0.6); } return top; }
  setTimeout(() => { try { build(); } catch (e) { console.warn('street lamps', e); } }, 0);
  function build() {
    const t0 = performance.now();
    const W2 = (x, z) => { let y = 1e9; for (const [ox, oz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) y = Math.min(y, groundAt(x + ox, z + oz)); return y - 0.05; };
    // ---- 비울 곳 ----
    const objPts = Object.values(OBJ).map(o => o && o.g && o.g.position).filter(Boolean), padPts = PADS.map(q => q.b.g.position);
    const lane = typeof FLANE !== 'undefined' && FLANE && FLANE.clear ? FLANE.clear.map(([d, s]) => [s, -d]) : [], laneR = (FLANE && FLANE.R || 4) + 6;
    const c1 = typeof C1S !== 'undefined' && C1S.real && typeof c1UV === 'function';
    const poles = window.__POWER && window.__POWER.POLES || [];
    const inInner = (x, z, m) => x > GS0 + (m || 0) && x < GS1 - (m || 0) && -z > GD0 + (m || 0) && -z < GD1 - (m || 0);
    function blocked(x, z) {
      if (CRS_C) { const pi = pathInfo(-z, x); if (pi && pi.dist < 14) return true; }   // 코스 경로 둘레 (장애물 사이를 날아가는 길)
      for (const q of objPts) if (Math.abs(q.x - x) < 12 && Math.abs(q.z - z) < 12) return true;
      for (const q of padPts) if (Math.hypot(q.x - x, q.z - z) < 16) return true;
      if (RWY) { const l = rwyLocal({ x, z }), ws = l.w * RWY.sg; if (Math.abs(l.t) < RWY.L / 2 + 60 && Math.abs(l.w) < 40) return true; if (Math.abs(l.t) < 70 && ws > -RWY.Wd / 2 - 15 && ws < RWY.Wd / 2 + 90) return true; }
      if (c1) { const [u, v] = c1UV({ x, z }); if (Math.abs(u) < 50 && v > -40 && v < 125) return true; }
      for (const [lx, lz] of lane) if (Math.abs(lx - x) < laneR && Math.abs(lz - z) < laneR) return true;
      for (const q of poles) if (Math.abs(q.x - x) < 6 && Math.abs(q.z - z) < 6) return true;
      return false;
    }
    const _q = new V3();
    // 기둥·팔 자리가 건물·전선·철탑 등에 걸리는지 (나무는 따로: 치움)
    function hits(x, y, z, ax, az) {
      for (const [k, hh] of [[0, 1.2], [0, 4], [0, H - 0.5], [0.6, H], [1, H + 0.2]]) { _q.set(x + ax * HEAD * k, y + hh, z + az * HEAD * k);
        if (collide(_q, 0.45)) return true; const c = STREES.col(_q, 0.35); if (c && c.tag !== 'tree') return true; }
      return false;
    }
    // ---- 1) 전봇대마다 팔·등 (바깥 큰길 · game6p 의 POLES: rx·rz = 길 쪽) ----
    for (const q of poles) if (q.rx !== undefined) put({ x: q.x, y: q.y, z: q.z, ax: q.rx, az: q.rz, h: 8.6, pole: false });
    const cutOuter = [], hideIn = [];
    // 후보 하나: 길 위 점(x,z) · 길 방향(tx,tz) · 기둥을 길 바깥 off m · 팔은 길 쪽(side) — 앞뒤로 조금씩 옮겨 가며 빈 곳을 찾음
    function tryAt(pt, tx, tz, nx, nz, off, along, inner) {
      for (const sh of [0, 5, -5, 10, -10]) { const x = pt(along + sh); if (!x) continue; const [px, pz, ttx, ttz] = x, bx = px + nx(ttx, ttz) * off, bz = pz + nz(ttx, ttz) * off;
        if (near(bx, bz, MIN) || blocked(bx, bz) || inInner(bx, bz, -1) !== inner) continue; const ax = -nx(ttx, ttz) * Math.sign(off), az = -nz(ttx, ttz) * Math.sign(off), y = W2(bx, bz);
        if (!isFinite(y) || hits(bx, y, bz, ax, az)) continue;
        const L = { x: bx, y, z: bz, ax, az, h: H, pole: true }; put(L); (inner ? hideIn : cutOuter).push(L); return L; }
      return null;
    }
    // 선(꼭짓점 목록)을 따라 거리 s 의 점과 방향
    const walker = P => { const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const at = s => { if (s < 0 || s > cum[cum.length - 1]) return null; let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const L = cum[i] - cum[i - 1] || 1, u = (s - cum[i - 1]) / L, [x0, z0] = P[i - 1], [x1, z1] = P[i];
        return [x0 + (x1 - x0) * u, z0 + (z1 - z0) * u, (x1 - x0) / L, (z1 - z0) / L, i - 1]; };
      return { at, len: cum[cum.length - 1], cum }; };
    // ---- 2) 안쪽 수치지형도 도로: 선 하나는 도로 경계 한쪽 → 길 안쪽이 어느 쪽인지 찾아 기둥은 바깥 0.9 m, 팔은 안쪽으로 ----
    //   (수치지형도 도로는 고해상도 구역 바닥에만 그려져 있어 그 안쪽만 · 바깥은 바깥 길(3)이 이어 받음)
    const lines = ((typeof VEC !== 'undefined' && VEC && VEC.road) || []).map(a => { const P = []; for (let i = 0; i + 1 < a.length; i += 2) P.push([a[i + 1], -a[i]]); return P; }).filter(P => P.length > 1);
    const segs = []; lines.forEach((P, li) => { let s0 = 0; for (let i = 1; i < P.length; i++) { const L = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); segs.push([P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], li, s0, L]); s0 += L; } });
    const ray = (x, z, dx, dz, li, arc) => { let best = 99;   // 경계선에서 옆으로 쏘아 다른 경계선(같은 선의 먼 부분 포함)을 처음 만나는 거리
      for (const [ax, az, bx, bz, l2, s0, L] of segs) { if (l2 === li && Math.abs(s0 + L / 2 - arc) < 12 + L / 2) continue; if (Math.min(ax, bx) > x + 16 || Math.max(ax, bx) < x - 16 || Math.min(az, bz) > z + 16 || Math.max(az, bz) < z - 16) continue;
        const ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const wx = ax - x, wz = az - z, t = (wx * ez - wz * ex) / den, u = (wx * dz - wz * dx) / den;
        if (t > 0.3 && t < best && u >= 0 && u <= 1) best = t; }
      return best; };
    lines.forEach((P, li) => { const wk = walker(P); if (wk.len < 20) return; const ph = 8 + ((li * 0.618) % 1) * 20;
      for (let s = ph; s < wk.len - 6; s += SP) { const c = wk.at(s); if (!c || !inInner(c[0], c[1], 6)) continue; const [x, z, tx, tz] = c, dl = ray(x, z, -tz, tx, li, s), dr = ray(x, z, tz, -tx, li, s);
        // 왼쪽(-tz, tx)에 다른 경계가 더 가까우면 길은 왼쪽 → 기둥은 오른쪽 바깥 · 둘 다 15 m 안에 없으면 가운데 선으로 보고 왼쪽 3 m
        const off = dl < 15 || dr < 15 ? (dl < dr ? -0.9 : 0.9) : 3.2;
        tryAt(ss => wk.at(ss), tx, tz, (a, b) => -b, (a, b) => a, off, s, true); } });
    // ---- 3) 바깥 길 (가운데 선 · 폭 w): 한쪽 (길마다 정함) · 큰길은 전봇대 등 사이만 채움 ----
    if (typeof OUTER !== 'undefined' && OUTER && OUTER.roads) OUTER.roads.forEach((rd, ri) => { const wk = walker(rd.p); if (wk.len < 30) return; const sd = (Math.sin(ri * 91.7) * 43758.5 % 1 + 1) % 1 < 0.5 ? 1 : -1, ph = 10 + ((ri * 0.381) % 1) * 20;
      for (let s = ph; s < wk.len - 8; s += SP) { const c = wk.at(s); if (!c || inInner(c[0], c[1])) continue; tryAt(ss => wk.at(ss), c[2], c[3], (a, b) => -b, (a, b) => a, sd * (rd.w / 2 + 1.1), s, false); } });
    // ---- 기둥 자리 나무 치우기 (안쪽 현장 나무 · 바깥 숲) ----
    for (const L of hideIn) if (STREES.hideRect) STREES.hideRect(L.x + L.ax * 0.8, L.z + L.az * 0.8, L.ax, L.az, 4.4, 3.6);
    if (cutOuter.length && typeof outerCutTrees === 'function') { const G2 = new Map(); for (const L of cutOuter) { const k = Math.floor(L.x / 20) + ',' + Math.floor(L.z / 20); if (!G2.has(k)) G2.set(k, []); G2.get(k).push(L); }
      outerCutTrees(t => { for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) { const C = G2.get((Math.floor(t[0] / 20) + ix) + ',' + (Math.floor(t[2] / 20) + iz)); if (C) for (const L of C) if (Math.hypot(t[0] - L.x - L.ax, t[2] - L.z - L.az) < 2.2 + t[4] * 0.35) return true; } return false; }); }
    mesh();
    if (STREES.col) { const oc = STREES.col; STREES.col = (p, Rr) => oc(p, Rr) || col(p, Rr); }
    if (STREES.topAt) { const ot = STREES.topAt; STREES.topAt = (x, z, R) => Math.max(ot(x, z, R), topAt(x, z, R)); }
    api.n = api.L.length; api.ms = Math.round(performance.now() - t0); api.ready = true;
  }
  // ---- 그리기: 기둥(+콘크리트 받침) · 팔 · 등기구 (인스턴스) · 바닥 빛(땅 모양을 따른 원판 묶음) · 빛망울(점) ----
  let headMat = null, pools = null, glow = null;
  function mesh() {
    const all = api.L; if (!all.length) return;
    const G = new THREE.Group(); G.name = 'lamps'; scene.add(G);
    const merge = (parts) => { let n = 0; parts.forEach(([g]) => n += g.attributes.position.count); const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
      for (const [g, hex] of parts) { const c = new THREE.Color(hex); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); for (let i = 0; i < g.attributes.position.count; i++) C.set([c.r, c.g, c.b], (o + i) * 3); o += g.attributes.position.count; g.dispose(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); return g; };
    const pg = new THREE.CylinderGeometry(0.065, 0.11, H, 8); pg.translate(0, H / 2, 0); const fg = new THREE.BoxGeometry(0.46, 0.42, 0.46); fg.translate(0, 0.1, 0);
    const poleGeo = merge([[pg.toNonIndexed(), 0xa9adb1], [fg.toNonIndexed(), 0xb9b4aa]]);
    const ag = new THREE.BoxGeometry(ARM + 0.08, 0.07, 0.06); ag.rotateZ(Math.atan2(0.2, ARM)); ag.translate(ARM / 2, 0.1, 0); const cg = new THREE.CylinderGeometry(0.085, 0.085, 0.22, 8); cg.translate(0, 0, 0);   // 팔 · 기둥 위 이음쇠
    const armGeo = merge([[ag.toNonIndexed(), 0x9ea3a7], [cg.toNonIndexed(), 0x8d9296]]);
    const headGeo = new THREE.BoxGeometry(0.64, 0.1, 0.27); headGeo.translate(HEAD, 0.22, 0);
    const poleM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.45 }), armM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5 });
    headMat = new THREE.MeshStandardMaterial({ color: 0x8b9095, emissive: 0xfff0d8, emissiveIntensity: 0, roughness: 0.4, metalness: 0.3 });
    const standing = all.filter(L => L.pole), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new V3(0, 1, 0), ONE = new V3(1, 1, 1), P3 = new V3();
    const inst = (geo, mat, list, f) => { const m = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((L, i) => { Q.setFromAxisAngle(UP, Math.atan2(-L.az, L.ax)); m.setMatrixAt(i, M4.compose(f(L), Q, ONE)); }); m.frustumCulled = false; G.add(m); return m; };   // three r149 는 인스턴스 묶음을 원점 기준으로 잘라내서 끔
    if (standing.length) { const pm = inst(poleGeo, poleM, standing, L => P3.set(L.x, L.y, L.z)); pm.castShadow = !LOWQ; pm.receiveShadow = true; pm.userData.heat = 0.15; }
    const am = inst(armGeo, armM, all, L => P3.set(L.x, L.y + L.h, L.z)); am.castShadow = !LOWQ; am.userData.heat = 0.15;
    const hm = inst(headGeo, headMat, all, L => P3.set(L.x, L.y + L.h, L.z)); hm.userData.heat = 0.55;
    // 바닥 빛: 등기구 아래를 가운데로 반지름 7.5 m · 가운데 밝고 가장자리로 0 (땅 높이를 따라 굽힘)
    const NS = 14, pos = [], colr = [], idx = [];
    for (const L of all) { const cx = L.x + L.ax * HEAD, cz = L.z + L.az * HEAD, o = pos.length / 3;
      pos.push(cx, groundAt(cx, cz) + 0.12, cz); colr.push(1, 1, 1);
      for (const [rf, cv] of [[0.42, 0.62], [1, 0]]) for (let k = 0; k < NS; k++) { const a = k / NS * 6.2832, x = cx + Math.cos(a) * POOL_R * rf, z = cz + Math.sin(a) * POOL_R * rf; pos.push(x, groundAt(x, z) + 0.12, z); colr.push(cv, cv, cv); }
      for (let k = 0; k < NS; k++) { const a = o + 1 + k, b = o + 1 + (k + 1) % NS, a2 = a + NS, b2 = b + NS; idx.push(o, b, a, a, b, b2, a, b2, a2); } }
    const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pgeo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); pgeo.setIndex(idx); pgeo.computeBoundingSphere();
    pools = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: 0x8a7658, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    pools.visible = false; pools.renderOrder = 2; G.add(pools);
    // 빛망울: 멀리서도 등이 보이게 (가운데 흰빛 → 바깥 투명)
    const gc = document.createElement('canvas'); gc.width = gc.height = 64; { const g = gc.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,240,215,.75)'); gr.addColorStop(0.5, 'rgba(255,220,170,.18)'); gr.addColorStop(1, 'rgba(255,210,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
    const gp = new Float32Array(all.length * 3); all.forEach((L, i) => gp.set([L.x + L.ax * HEAD, L.y + L.h + 0.12, L.z + L.az * HEAD], i * 3));
    const ggeo = new THREE.BufferGeometry(); ggeo.setAttribute('position', new THREE.BufferAttribute(gp, 3)); ggeo.computeBoundingSphere();
    glow = new THREE.Points(ggeo, new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: true, map: new THREE.CanvasTexture(gc), color: 0xffe8c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.visible = false; glow.renderOrder = 3; G.add(glow);
  }
  // ---- 밤·해질녘에 켬 · 열화상에서는 빛을 끔 ----
  let lastN = null, lastIr = null;
  api.tick = () => {
    if (!api.ready || !headMat) return; const n = ENV.night ? 1 : ENV.dusk ? 0.4 : 0, ir = !!ENV.ir; if (n === lastN && ir === lastIr) return; lastN = n; lastIr = ir;
    headMat.emissiveIntensity = n >= 1 ? 2.4 : n > 0 ? 1.1 : 0; pools.visible = n >= 1 && !ir; glow.visible = n > 0 && !ir; glow.material.opacity = n >= 1 ? 1 : 0.5;
  };
  return api;
})();
if (window.__sim) Object.assign(window.__sim, { LAMPS });
