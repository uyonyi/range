// =====================================================================
//  바깥 지역 (임의 생성 · 실제 자료가 오기 전까지): 논·밭·비닐하우스·숲·마을(민가·가게)·길
//  중간 지형(MID) 위에서 경사·높이로 토지 이용을 나누고, 고정 난수로 매번 같은 모습
// =====================================================================
const OUTER = (function outerWorld() {
  if (!MID) return null;
  const r = rng(77031), M = MID, nx = M.nx, ny = M.ny, st = M.st;
  const inInner = (x, z) => x > GS0 - 8 && x < GS1 + 8 && -z > GD0 - 8 && -z < GD1 + 8;
  const rw = window.__RWY;
  const inRwy = (x, z, pad) => { if (!RWY) return false; const l = rwyLocal({ x, z });   /* 활주로·접근로·계류장 둘레는 비움 */
    if (Math.abs(l.t) < RWY.L / 2 + 200 + pad && Math.abs(l.w) < 25 + pad) return true;
    const ws = l.w * RWY.sg; return Math.abs(l.t) < 45 + pad && ws > -RWY.Wd / 2 - 10 - pad && ws < RWY.Wd / 2 + 75 + pad; };
  const inFly = (x, z) => Math.hypot(x - FLY_C.x, z - FLY_C.z) < FLY_R + 120;
  // 격자 칸 정보: 높이·경사
  const cx = ix => M.s0 + ix * st, cz = iy => -(M.d1 - iy * st);
  const hAt = (ix, iy) => M.H[clamp(iy, 0, ny - 1) * nx + clamp(ix, 0, nx - 1)];
  const slope = new Float32Array(nx * ny), lu = new Uint8Array(nx * ny);   // lu: 0 풀밭 1 논 2 밭 3 숲 4 마을 5 길 9 제외
  const hs = [];
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const gx = (hAt(ix + 1, iy) - hAt(ix - 1, iy)) / (2 * st), gz = (hAt(ix, iy + 1) - hAt(ix, iy - 1)) / (2 * st), i = iy * nx + ix;
    slope[i] = Math.atan(Math.hypot(gx, gz)) / DEG; const x = cx(ix), z = cz(iy);
    if (inInner(x, z) || !inFly(x, z)) lu[i] = 9; else hs.push(M.H[i]);
  }
  hs.sort((a, b) => a - b); const P = q => hs[Math.floor(q * (hs.length - 1))] || 0;
  const pLow = P(0.42), pMid = P(0.66), pHigh = P(0.8);
  const pn = (x, z, k) => Math.sin(x * 0.009 * k + Math.cos(z * 0.007 * k) * 2.3) * Math.cos(z * 0.008 * k - Math.sin(x * 0.006 * k) * 1.7);   // 얼룩 무늬
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const i = iy * nx + ix; if (lu[i] === 9) continue; const x = cx(ix), z = cz(iy), h = M.H[i], sl = slope[i], n1 = pn(x, z, 1), n2 = pn(x + 300, z - 200, 2.3);
    if (inRwy(x, z, 0)) { lu[i] = 0; continue; }
    if (sl > 15 || h > pHigh + n1 * 6 || (sl > 9 && n2 > 0.2)) lu[i] = 3;
    else if (sl < 4 && h < pLow + n1 * 3) lu[i] = 1;
    else if (sl < 9 && h < pMid + n2 * 5 && n1 > -0.45) lu[i] = 2;
    else lu[i] = n2 > 0.55 ? 3 : 0;
  }
  // ---- 마을 자리: 평평·논밭 가까이·서로 350 m 이상 떨어짐 ----
  const vil = [], cand = [];
  for (let iy = 3; iy < ny - 3; iy += 3) for (let ix = 3; ix < nx - 3; ix += 3) {
    const i = iy * nx + ix; if (lu[i] === 9 || lu[i] === 1 || slope[i] > 9) continue; const x = cx(ix), z = cz(iy);
    if (inRwy(x, z, 60) || Math.hypot(x - FLY_C.x, z - FLY_C.z) > FLY_R - 80) continue;
    let flat = 0, farm = 0, n = 0; for (let oy = -6; oy <= 6; oy += 2) for (let ox = -6; ox <= 6; ox += 2) { const j = (iy + oy) * nx + ix + ox; if (j < 0 || j >= lu.length) continue; n++; if (slope[j] < 5) flat++; if (slope[j] < 9) flat += 0.5; if (lu[j] === 1 || lu[j] === 2) farm++; if (lu[j] === 9) flat -= 2; }
    cand.push({ x, z, ix, iy, sc: flat / n + farm / n * 0.6 + r() * 0.15 });
  }
  cand.sort((a, b) => b.sc - a.sc);
  // 방향(6갈래)마다 가장 나은 자리 하나씩 (골짜기처럼 좋은 곳이 몰린 쪽은 둘까지) → 마을이 고루 퍼지게
  const sec = c => Math.floor(((Math.atan2(c.x - FLY_C.x, c.z - FLY_C.z) / 6.2832 + 1) % 1) * 6), used = [0, 0, 0, 0, 0, 0];
  for (const c of cand) { if (vil.length >= 7) break; const k = sec(c); if (c.sc < 0.35 || used[k] >= (c.sc > 1 ? 2 : 1)) continue; if (vil.some(v => Math.hypot(v.x - c.x, v.z - c.z) < 260)) continue; vil.push(c); used[k]++; }
  // 마을 둘레: 숲을 걷어 마당·텃밭으로 (산골 마을도 집 둘레는 트여 있음)
  for (const v of vil) for (let oy = -16; oy <= 16; oy++) for (let ox = -16; ox <= 16; ox++) { const ix = v.ix + ox, iy = v.iy + oy; if (ix < 0 || iy < 0 || ix >= nx || iy >= ny) continue; const i = iy * nx + ix, d = Math.hypot(ox, oy) * st;
    if (lu[i] === 9 || d > 160 || slope[i] > 12) continue; if (d < 60) lu[i] = 4; else if (lu[i] === 3 && d < 130) lu[i] = 2; }
  // ---- 길: 20 m 격자 최소 비용 경로 (경사·숲·논은 비쌈) · 고해상도 구역 도로 끝 → 마을, 마을끼리 ----
  const R2 = 2, gw = Math.ceil(nx / R2), gh = Math.ceil(ny / R2);
  const costAt = (gx, gy) => { const ix = gx * R2, iy = gy * R2; if (ix >= nx || iy >= ny) return 1e9; const i = iy * nx + ix; if (lu[i] === 9) return 40; return 1 + slope[i] * 0.45 + (lu[i] === 3 ? 2.5 : lu[i] === 1 ? 1.2 : 0) + (lu[i] === 5 ? -0.6 : 0); };
  function path(ax, ay, bx, by) {
    const N = gw * gh, dist = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), heap = [];
    const push = (k, v) => { heap.push([v, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const L = 2 * i + 1, Rr = L + 1; let m = i; if (L < heap.length && heap[L][0] < heap[m][0]) m = L; if (Rr < heap.length && heap[Rr][0] < heap[m][0]) m = Rr; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
    const a = ay * gw + ax, b = by * gw + bx; dist[a] = 0; push(a, 0);
    while (heap.length) { const [dv, k] = pop(); if (k === b) break; if (dv > dist[k]) continue; const kx = k % gw, ky = (k / gw) | 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { if (!ox && !oy) continue; const jx = kx + ox, jy = ky + oy; if (jx < 0 || jy < 0 || jx >= gw || jy >= gh) continue;
        const j = jy * gw + jx, c = Math.max(0.3, costAt(jx, jy)) * Math.hypot(ox, oy); if (dv + c < dist[j]) { dist[j] = dv + c; prev[j] = k; push(j, dist[j]); } } }
    const out = []; for (let k = b; k >= 0; k = prev[k]) { out.push([M.s0 + (k % gw) * R2 * st, -(M.d1 - ((k / gw) | 0) * R2 * st)]); if (k === a) break; }
    return out.reverse();
  }
  const g2 = (x, z) => [clamp(Math.round((x - M.s0) / (st * R2)), 0, gw - 1), clamp(Math.round((M.d1 + z) / (st * R2)), 0, gh - 1)];
  const chaikin = p => { let q = p; for (let it = 0; it < 2; it++) { const o = [q[0]]; for (let i = 0; i < q.length - 1; i++) { const a = q[i], b = q[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(q[q.length - 1]); q = o; } return q; };
  // 고해상도 구역 도로 끝 (경계 근처)
  const ends = []; if (typeof VEC !== 'undefined' && VEC && VEC.road) for (const a of VEC.road) for (const k of [0, a.length - 2]) { const d = a[k], s = a[k + 1]; const e = Math.min(s - GS0, GS1 - s, d - GD0, GD1 - d); if (e < 60) ends.push([s, -d]); }
  const edgePt = (x, z) => { const s = clamp(x, GS0, GS1), d = clamp(-z, GD0, GD1); const e = [[GS0 - 15, -d], [GS1 + 15, -d], [s, -(GD0 - 15)], [s, -(GD1 + 15)]]; let b = e[0], bd = 1e9; for (const p of e) { const dd = Math.hypot(p[0] - x, p[1] - z); if (dd < bd) { bd = dd; b = p; } } return b; };
  const roads = [];
  const addRoad = (A, B, w) => { const a = g2(A[0], A[1]), b = g2(B[0], B[1]); const p = path(a[0], a[1], b[0], b[1]); if (p.length < 2) return; const q = chaikin(p); roads.push({ p: q, w });
    for (const [x, z] of q) { const ix = Math.round((x - M.s0) / st), iy = Math.round((M.d1 + z) / st); for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const j = (iy + oy) * nx + ix + ox; if (j >= 0 && j < lu.length && lu[j] !== 9) lu[j] = 5; } } };
  vil.forEach(v => { let best = null, bd = 1e9; for (const e of ends) { const d = Math.hypot(e[0] - v.x, e[1] - v.z); if (d < bd) { bd = d; best = e; } }
    const ep = edgePt(v.x, v.z); if (!best || bd > Math.hypot(ep[0] - v.x, ep[1] - v.z) + 250) best = ep; addRoad(best, [v.x, v.z], 6); });
  for (let i = 1; i < vil.length; i++) { let bj = 0, bd = 1e9; for (let j = 0; j < i; j++) { const d = Math.hypot(vil[i].x - vil[j].x, vil[i].z - vil[j].z); if (d < bd) { bd = d; bj = j; } } if (bd < 900) addRoad([vil[i].x, vil[i].z], [vil[bj].x, vil[bj].z], 5); }
  // 마을 안 골목: 중심에서 3~4 갈래 짧은 길
  vil.forEach(v => { const k = 3 + (r() < 0.5 ? 1 : 0); for (let i = 0; i < k; i++) { const a = r() * 6.283, L = 70 + r() * 70; const B = [v.x + Math.cos(a) * L, v.z + Math.sin(a) * L]; if (!inInner(B[0], B[1]) && inFly(B[0], B[1])) addRoad([v.x, v.z], B, 4); } });
  // ---- 지면 무늬 (캔버스) ----
  const g = M.cg, px = 2048 / (M.s1 - M.s0), pz = 2048 / (M.d1 - M.d0), cs = st * px + 0.6;
  const COL = { 0: [96, 116, 64], 1: [112, 128, 70], 2: [128, 106, 74], 3: [46, 66, 38], 4: [150, 142, 120], 5: [96, 116, 64] };
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) { const i = iy * nx + ix, t = lu[i] === 9 ? 0 : lu[i], c = COL[t], j = (r() - 0.5) * 14, sh = (slope[i] > 8 ? -10 : 0);
    g.fillStyle = `rgb(${c[0] + j + sh | 0},${c[1] + j + sh | 0},${c[2] + j * 0.6 + sh | 0})`; const [u, v] = M.uvOf(cx(ix), cz(iy)); g.fillRect(u - cs / 2, v - cs / 2, cs, cs); }
  { g.filter = 'blur(4px)'; g.drawImage(M.cv, 0, 0); g.filter = 'none'; }   /* 10 m 칸 경계를 부드럽게 */
  // 논: 30×50 m 필지 · 논두렁 / 밭: 고랑 줄무늬
  g.lineWidth = 1.2;
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) { const i = iy * nx + ix, x = cx(ix), z = cz(iy), [u, v] = M.uvOf(x, z);
    if (lu[i] === 1) { if (((x + 4000) % 30) < st) { g.strokeStyle = 'rgba(176,160,110,.75)'; g.beginPath(); g.moveTo(u, v - cs / 2); g.lineTo(u, v + cs / 2); g.stroke(); } if (((z + 4000) % 50) < st) { g.strokeStyle = 'rgba(176,160,110,.75)'; g.beginPath(); g.moveTo(u - cs / 2, v); g.lineTo(u + cs / 2, v); g.stroke(); }
      if (r() < 0.15) { g.fillStyle = 'rgba(150,170,180,.18)'; g.fillRect(u - cs / 2, v - cs / 2, cs, cs); } }
    if (lu[i] === 2) { g.strokeStyle = 'rgba(90,70,48,.45)'; for (let k = -cs / 2; k < cs / 2; k += 2.2) { g.beginPath(); g.moveTo(u - cs / 2, v + k); g.lineTo(u + cs / 2, v + k); g.stroke(); } } }
  // 마을 마당
  vil.forEach(v => { const [u, w] = M.uvOf(v.x, v.z); const gr = g.createRadialGradient(u, w, 2, u, w, 120 * px); gr.addColorStop(0, 'rgba(160,150,128,.85)'); gr.addColorStop(1, 'rgba(160,150,128,0)'); g.fillStyle = gr; g.beginPath(); g.arc(u, w, 120 * px, 0, 6.283); g.fill(); });
  // 길
  for (const rd of roads) { g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(70,72,74,.95)'; g.lineWidth = rd.w * px + 1.5; g.beginPath(); rd.p.forEach(([x, z], i) => { const [u, v] = M.uvOf(x, z); i ? g.lineTo(u, v) : g.moveTo(u, v); }); g.stroke();
    g.strokeStyle = rd.w >= 6 ? 'rgba(84,86,90,1)' : 'rgba(150,140,118,1)'; g.lineWidth = rd.w * px; g.stroke(); }
  M.tex.needsUpdate = true;
  // ---- 건물: 민가(박공 지붕) · 가게(평지붕 + 간판) · 창고 · 비닐하우스 ----
  const roofGeo = (() => { const gg = new THREE.BufferGeometry(); const v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 0.5, -0.5, -0.5, 0, 0.5, 0, 0.5, 0.5, 0.5, 0, 0.5];
    const ix = [0, 2, 1, 3, 5, 4, 0, 3, 4, 0, 4, 2, 1, 2, 4, 1, 4, 5, 0, 1, 5, 0, 5, 3]; gg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); gg.setIndex(ix); gg.computeVertexNormals(); return gg; })();
  const ghGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, Math.PI); ghGeo.rotateZ(Math.PI / 2); ghGeo.rotateY(Math.PI / 2);
  const B = [];   // { x, z, y, w, l, h, yaw, kind }
  const free = (x, z, rr) => !inInner(x, z) && inFly(x, z) && !inRwy(x, z, 10) && !B.some(b => Math.hypot(b.x - x, b.z - z) < rr + Math.max(b.w, b.l) * 0.6);
  const roadDist = (x, z) => { let d = 1e9; for (const rd of roads) for (const [a, b] of rd.p) d = Math.min(d, Math.hypot(a - x, b - z)); return d; };
  for (const v of vil) for (const rd of roads) {
    for (let i = 1; i < rd.p.length - 1; i++) { const [x0, z0] = rd.p[i - 1], [x1, z1] = rd.p[i + 1], [x, z] = rd.p[i]; const dv = Math.hypot(x - v.x, z - v.z); if (dv > 150 || r() > 0.42) continue;
      const tx = x1 - x0, tz = z1 - z0, tl = Math.hypot(tx, tz) || 1, nxv = -tz / tl, nzv = tx / tl, side = r() < 0.5 ? -1 : 1, off = rd.w / 2 + 6 + r() * 4;
      const bx = x + nxv * off * side, bz = z + nzv * off * side, near = dv < 55, kind = near && r() < 0.45 ? 'shop' : r() < 0.12 ? 'barn' : 'house';
      const w = kind === 'shop' ? 9 + r() * 4 : kind === 'barn' ? 9 : 7 + r() * 2, l = kind === 'shop' ? 7 + r() * 2 : kind === 'barn' ? 14 : 9 + r() * 3, h = kind === 'shop' ? 3.6 + (r() < 0.3 ? 3 : 0) : kind === 'barn' ? 4.5 : 2.8;
      if (!free(bx, bz, 5)) continue; const y = Math.min(groundAt(bx - 3, bz - 3), groundAt(bx + 3, bz + 3), groundAt(bx + 3, bz - 3), groundAt(bx - 3, bz + 3)) - 0.3;
      if (Math.max(groundAt(bx - 3, bz - 3), groundAt(bx + 3, bz + 3), groundAt(bx + 3, bz - 3), groundAt(bx - 3, bz + 3)) - y > 3) continue;
      B.push({ x: bx, z: bz, y, w, l, h, yaw: Math.atan2(tx, tz), kind });
    } }
  // 비닐하우스: 마을 옆 밭에 줄지어
  for (const v of vil) for (let cl = 0; cl < 3; cl++) { const a = r() * 6.283, dd = 90 + r() * 60, base = [v.x + Math.cos(a) * dd, v.z + Math.sin(a) * dd], yaw = Math.round(r() * 2) * Math.PI / 2 + (r() - 0.5) * 0.3;
    if (slope[clamp(Math.round((M.d1 + base[1]) / st), 0, ny - 1) * nx + clamp(Math.round((base[0] - M.s0) / st), 0, nx - 1)] > 7) continue;
    for (let k = 0; k < 6; k++) { const ox = Math.cos(yaw) * k * 9, oz = -Math.sin(yaw) * k * 9, x = base[0] + ox, z = base[1] + oz; if (!free(x, z, 4) || roadDist(x, z) < 6) continue; const gy = groundAt(x, z); B.push({ x, z, y: gy - 0.1, w: 7, l: 34, h: 3.2, yaw, kind: 'gh' }); } }
  const WALL = [0xe9e4d8, 0xd9d2c0, 0xf1efe8, 0xcfc6b0], ROOF = [0x3f6fa8, 0xa8483f, 0x4f7a4a, 0x5b5f66, 0x2f5a8a], SIGN = [0xd8402c, 0x2c7ad8, 0xe0b020, 0x3aa65a];
  const inst = (geo, list, color, opts) => { if (!list.length) return null; const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85 }, opts || {})), list.length); const Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), Sv = new V3(), c = new THREE.Color();
    list.forEach((it, k) => { Q.setFromAxisAngle(new V3(0, 1, 0), it.yaw); Sv.set(it.sx, it.sy, it.sz); Mx.compose(new V3(it.x, it.y, it.z), Q, Sv); m.setMatrixAt(k, Mx); m.setColorAt(k, c.setHex(color(it))); });
    m.castShadow = true; m.receiveShadow = true; scene.add(m); m.userData.heat = 0.3; return m; };
  const bodies = [], roofs = [], signs = [], ghs = [];
  B.forEach((b, k) => { const c = Math.sin(k * 12.9898) * 43758.5453, rr = c - Math.floor(c);
    if (b.kind === 'gh') { ghs.push({ x: b.x, y: b.y, z: b.z, sx: b.w / 2, sy: b.h, sz: b.l, yaw: b.yaw }); return; }
    bodies.push({ x: b.x, y: b.y + (b.h + 0.3) / 2, z: b.z, sx: b.w, sy: b.h + 0.3, sz: b.l, yaw: b.yaw, col: b.kind === 'barn' ? 0xa0a4a8 : WALL[(rr * 4) | 0] });
    if (b.kind === 'shop') signs.push({ x: b.x + Math.sin(b.yaw) * 0, y: b.y + b.h - 0.2, z: b.z, sx: b.w + 0.2, sy: 0.8, sz: b.l + 0.2, yaw: b.yaw, col: SIGN[(rr * 4) | 0] });
    else roofs.push({ x: b.x, y: b.y + b.h + 0.3, z: b.z, sx: b.w + 0.8, sy: b.kind === 'barn' ? 2.2 : 2.6, sz: b.l + 0.8, yaw: b.yaw, col: b.kind === 'barn' ? 0x8a8f96 : ROOF[(rr * 5) | 0] }); });
  inst(UBOX, bodies, it => it.col); inst(roofGeo, roofs, it => it.col, { roughness: 0.6, side: THREE.DoubleSide }); inst(UBOX, signs, it => it.col, { roughness: 0.5 }); inst(ghGeo, ghs, () => 0xe8eef0, { roughness: 0.35, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  // ---- 나무: 숲 칸마다 1~2 그루 + 풀밭·마을 가장자리 드문드문 · 활엽(둥근) / 침엽(원뿔) ----
  const T = [];   // [x, y, z, h, r, kind]
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) { const i = iy * nx + ix, t = lu[i]; if (t === 9 || t === 5 || t === 1 || t === 4) continue;
    const pr = t === 3 ? 1.25 : t === 0 ? 0.06 : 0.015; let n = Math.floor(pr) + (r() < pr % 1 ? 1 : 0);
    while (n-- > 0) { const x = cx(ix) + (r() - 0.5) * st, z = cz(iy) + (r() - 0.5) * st; if (inRwy(x, z, 8) || B.some(b => Math.abs(b.x - x) < b.l * 0.7 + 3 && Math.abs(b.z - z) < b.l * 0.7 + 3)) continue;
      const con = pn(x * 3, z * 3, 1) > 0.25 || M.at(x, z) > pHigh + 15; const h = con ? 9 + r() * 9 : 7 + r() * 7; T.push([x, M.at(x, z) - 0.3, z, h, con ? h * 0.24 : h * 0.33, con ? 1 : 0]); } }
  const leafGeo = (() => { const a = new THREE.IcosahedronGeometry(1, 0); a.scale(1, 1.15, 1); a.translate(0, 1.05, 0); return a; })(), conGeo = (() => { const a = new THREE.ConeGeometry(1, 1, 7); a.translate(0, 0.5, 0); return a; })(), trunkGeo = (() => { const a = new THREE.CylinderGeometry(0.12, 0.16, 1, 5); a.translate(0, 0.5, 0); return a; })();
  const CH = 400, chunks = new Map();
  T.forEach((t, i) => { const k = Math.floor(t[0] / CH) + ',' + Math.floor(t[2] / CH); if (!chunks.has(k)) chunks.set(k, []); chunks.get(k).push(i); });
  const leafM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), trunkM = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 }), CK = [];
  const Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), Sv = new V3(), cc = new THREE.Color();
  for (const [key, ids] of chunks) { const ls = ids.filter(i => !T[i][5]), cs2 = ids.filter(i => T[i][5]); const grp = new THREE.Group(); scene.add(grp);
    const mk = (geo, list, mtl, f) => { if (!list.length) return; const m = new THREE.InstancedMesh(geo, mtl, list.length); list.forEach((i, k) => { const t = T[i]; f(t); Mx.compose(new V3(t[0], t[1], t[2]), Q.setFromAxisAngle(new V3(0, 1, 0), (i * 2.39) % 6.283), Sv); m.setMatrixAt(k, Mx); if (mtl === leafM) { const v = 0.75 + ((i * 7919) % 100) / 400; m.setColorAt(k, t[5] ? cc.setRGB(0.12 * v, 0.24 * v, 0.13 * v) : cc.setRGB(0.22 * v, 0.33 * v, 0.14 * v)); } });
      m.castShadow = !LOWQ; m.receiveShadow = false; m.userData.irBase = 0.13; grp.add(m); };
    mk(leafGeo, ls, leafM, t => { Sv.set(t[4], t[3] * 0.42, t[4]); t.__l = 1; }); mk(trunkGeo, ls, trunkM, t => Sv.set(1, t[3] * 0.55, 1));
    mk(conGeo, cs2, leafM, t => Sv.set(t[4], t[3] * 0.92, t[4])); mk(trunkGeo, cs2, trunkM, t => Sv.set(1, t[3] * 0.25, 1));
    const [kx, kz] = key.split(',').map(Number); CK.push({ grp, c: new V3((kx + 0.5) * CH, 0, (kz + 0.5) * CH) }); }
  // 멀리 있는 숲 조각은 그리지 않음 (VR 은 더 가까이서 끔)
  setInterval(() => { const cp = camera.position, c1v = typeof c1VRon === 'function' && c1VRon(), lim = (c1v ? 380 : XR_ON ? 650 : 1100) + CH * 0.7; for (const k of CK) k.grp.visible = Math.hypot(cp.x - k.c.x, cp.z - k.c.z) < lim; }, 400);   // 1종 VR: 조종자 제자리 → 바깥 숲은 가까운 조각만
  // ---- 충돌: 나무(줄기+수관) · 건물(회전 상자) ----
  const GC = 40, GR = new Map(); const put = (x, z, v) => { const k = Math.floor(x / GC) + ',' + Math.floor(z / GC); if (!GR.has(k)) GR.set(k, []); GR.get(k).push(v); };
  T.forEach((t, i) => put(t[0], t[2], i)); B.forEach((b, i) => { const R = Math.hypot(b.w, b.l) / 2; for (let ox = -R; ox <= R; ox += GC) for (let oz = -R; oz <= R; oz += GC) put(b.x + ox, b.z + oz, -1 - i); put(b.x + R, b.z + R, -1 - i); });
  function col(p, Rr) {
    if (inInner(p.x, p.z)) return null; const gx = Math.floor(p.x / GC), gz = Math.floor(p.z / GC); let best = null, seen = new Set();
    for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++) { const L = GR.get(ix + ',' + iz); if (!L) continue;
      for (const v of L) { if (seen.has(v)) continue; seen.add(v);
        if (v >= 0) { const t = T[v], dy = p.y - t[1]; if (dy < -Rr || dy > t[3] + Rr) continue; const dx = p.x - t[0], dz = p.z - t[2], hd = Math.hypot(dx, dz);
          const rr = t[5] ? Math.max(0.15, t[4] * (1 - Math.max(0, dy - t[3] * 0.25) / (t[3] * 0.75))) : (dy < t[3] * 0.45 ? 0.15 : t[4]); const pen = rr + Rr - hd; if (pen > 0 && (!best || pen > best.pen)) best = { pen, n: hd > 1e-4 ? new V3(dx / hd, 0, dz / hd) : new V3(1, 0, 0), tag: 'tree' }; }
        else { const b = B[-1 - v], top = b.y + b.h + (b.kind === 'gh' ? 0 : 2.6), dy = p.y - b.y; if (dy < -Rr || p.y > top + Rr) continue; const c = Math.cos(b.yaw), s = Math.sin(b.yaw), dx = p.x - b.x, dz = p.z - b.z;
          const lx = dx * c - dz * s, lz = dx * s + dz * c, hx = b.w / 2 + Rr, hz = b.l / 2 + Rr; if (Math.abs(lx) > hx || Math.abs(lz) > hz) continue;
          if (p.y > b.y + b.h + 0.3 && b.kind !== 'shop' && b.kind !== 'gh') { const k = (p.y - b.y - b.h - 0.3) / 2.6; if (Math.abs(lx) > (b.w / 2 + 0.4) * (1 - k) + Rr) continue; }
          const px2 = hx - Math.abs(lx), pz2 = hz - Math.abs(lz), pu = (top + Rr) - p.y; let n, pen;
          if (pu < Math.min(px2, pz2)) { n = new V3(0, 1, 0); pen = pu; } else if (px2 < pz2) { const sx = Math.sign(lx) || 1; n = new V3(c * sx, 0, -s * sx); pen = px2; } else { const sz = Math.sign(lz) || 1; n = new V3(s * sz, 0, c * sz); pen = pz2; }
          if (!best || pen > best.pen) best = { pen, n, tag: 'building' }; } } }
    return best;
  }
  if (STREES && STREES.col) { const oc = STREES.col; STREES.col = (p, Rr) => oc(p, Rr) || col(p, Rr); }
  window.__OUTER = { cand: cand.slice(0, 40).map(c => [Math.round(c.x), Math.round(c.z), +c.sc.toFixed(2)]), trees: T.length, roads: roads.map(rd => ({ w: rd.w, p: rd.p })), blds: B.map(b => [b.x, b.z, b.kind]), vil: vil.map(v => [v.x, v.z]) };
  // 코스 지도(미리 그려 둔 것)에 바깥 지역을 다시 그려 넣음
  if (typeof MAP_CACHE !== 'undefined' && MAP_CACHE.course) { try { const kb = mapBg, kv = MAPV; mapBg = MAP_CACHE.course; MAPV = MAP_CACHE.course.V || MAPV; drawMapBg(); mapBg = kb; MAPV = kv; } catch (e) { } }
  return { lu, B, T, roads, vil, col };
})();
})();
