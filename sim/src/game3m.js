// =====================================================================
//  지도 (북쪽이 위 · 무전 방위·방위 띠와 같은 기준)
//   바탕 (한 번 · 조금씩 나눠 계산): 지형 음영 · 등고선 (10 m · 50 m 굵게) · 숲 · 밭 · 연못 — 비행 구역 + 둘레 450 m (마을·기지국까지)
//   보는 범위가 바뀔 때: 길 · 소로 · 하천 · 건물 · 사방댐 · 송전선 · 활주로 · 코스 · 숲길 · 출발 패드 · 비행 구역 + 이름 (마을 · 봉우리 · 숲길 · 사방댐 · 기지국)
//   매 프레임: 목표 · 수색 구역 · 목표까지 점선 · 기체 · 북쪽(N) · 축척 · 범위 이름
//   범위 (− 넓게 / + 좁게): 광역 · 비행 구역 · 임무(기본, 코스·임무 범위) · 기체 둘레 300 m · 120 m — 저장됨
//   크게 보기: 지도 누르기·J · 접기 ▾ → 작은 🗺 단추 (다시 누르면 펼침) — 저장됨
//   예전 지도는 코스 진행 방향(현장 방위 19°)이 위라, 진북 기준인 무전 방위와 어긋나 보였음
// =====================================================================
const MAPL = { W: 180, H: 300 };   // 논리 크기 (상자 비율 3:5) — 캔버스는 2~3배 (선명하게)
const MB_ = (SITE.brg || 0) * Math.PI / 180, MCB = Math.cos(MB_), MSB = Math.sin(MB_);
function wEN(x, z) { return [x * MCB - z * MSB, -x * MSB - z * MCB]; }   // 월드 (x, z) → 동·북 (m)
function enW(e, n) { return [e * MCB - n * MSB, -e * MSB - n * MCB]; }   // 동·북 → 월드 (x, z)
let MAPV = { e: 0, n: 0, m: 2 };   // 지금 그리는 범위: 가운데 (동·북) · 논리 1 px 당 m
function mxy(down, side) { const e = side * MCB + down * MSB, n = down * MCB - side * MSB; return [MAPL.W / 2 + (e - MAPV.e) / MAPV.m, MAPL.H / 2 - (n - MAPV.n) / MAPV.m]; }
function mxyW(x, z) { return mxy(-z, x); }
const MAP_LV = [['wide', '광역', 'Wide'], ['all', '비행 구역', 'Fly area'], ['fit', '임무 범위', 'Mission'], [300, '300 m', '300 m'], [120, '120 m', '120 m']];
if (SET.mapZ == null || !MAP_LV[SET.mapZ]) SET.mapZ = 2;
if (!SET.fold || typeof SET.fold !== 'object') SET.fold = {};
const MAPS = { fit: null, fits: {}, ptsCourse: null };
const MAPZ = { on: false };   // 크게 보기
function mapFit(pts, pad) {   // pts: [[down, side, r]] 를 다 담는 범위 (세로 300 : 가로 180)
  let e0 = 1e9, e1 = -1e9, n0 = 1e9, n1 = -1e9;
  for (const [d, s, r] of pts) { const e = s * MCB + d * MSB, n = d * MCB - s * MSB, rr = r || 0; e0 = Math.min(e0, e - rr); e1 = Math.max(e1, e + rr); n0 = Math.min(n0, n - rr); n1 = Math.max(n1, n + rr); }
  const p = pad == null ? 40 : pad; e0 -= p; e1 += p; n0 -= p; n1 += p;
  return { e: (e0 + e1) / 2, n: (n0 + n1) / 2, m: Math.max((e1 - e0) / MAPL.W, (n1 - n0) / MAPL.H, 1.0) };
}
MAPS.ptsCourse = CRS_C ? CRS_C.path.concat(D.objs.map(o => [o.down, o.side])) : [[-24, -112], [340, 90]];
MAPS.fit = MAPS.fits.course = mapFit(MAPS.ptsCourse, 30);
function mapView(key, pts, once) {   // 비행·임무를 시작할 때: '임무 범위' 를 그 코스·임무에 맞춤
  if (MAPZ.on && key !== 'area') mapZoom(false);   // 새 비행이 시작되면 작은 지도로
  if (!pts || !pts.length) { key = 'course'; pts = MAPS.ptsCourse; }
  if (MAPS.fits[key] && !once) { MAPS.fit = MAPS.fits[key]; MAPC.key = ''; return; }
  const V = mapFit(pts, key === 'course' ? 30 : 40); if (!once) MAPS.fits[key] = V; MAPS.fit = V; MAPC.key = '';
}
function mapZoom(on) { if (on === MAPZ.on) return; MAPZ.on = on; if (ui.mapBox) ui.mapBox.classList.toggle('big', on); document.body.classList.toggle('mapBig', on); MAPC.key = '';
  const f = ui.mapBox && ui.mapBox.querySelector('[data-m="f"]'); if (f) { f.textContent = on ? '✕' : '▾'; f.title = on ? L2x('작게', 'Shrink') : L2x('지도 접기', 'Hide map'); } }   // 크게 볼 때 ✕ = 작은 지도로 · 작을 때 ▾ = 접기   // 크게 볼 때는 방위 띠·목표 표시가 지도를 덮지 않게 (mapBig)
function mapLv(dz) { const v = clamp((SET.mapZ | 0) + dz, 0, MAP_LV.length - 1); if (v === SET.mapZ) return; SET.mapZ = v; saveSet(); MAPC.key = ''; }
function mapFold(on) { SET.fold.map = !!on; saveSet(); if (ui.mapBox) ui.mapBox.classList.toggle('fold', !!on); if (on && MAPZ.on) mapZoom(false); MAPC.key = ''; }
function mapCurView() {
  const lv = MAP_LV[SET.mapZ] || MAP_LV[2];
  if (typeof lv[0] === 'number') { const src = S.state === 'replay' && typeof RP !== 'undefined' && RP.pose ? RP.pose : DR, [e, n] = wEN(src.p.x, src.p.z); return { e, n, m: lv[0] * 2 / MAPL.H, mv: true }; }
  if (lv[0] === 'fit') return MAPS.fit;
  const [e, n] = wEN(FLY_C.x, FLY_C.z), R = lv[0] === 'all' ? FLY_R + 30 : BASE.half;
  return { e, n, m: Math.max(R * 2 / MAPL.W, R * 2 / MAPL.H) };
}
// ---- 바탕 그림 (지형·숲·물) ----
const BASE = { cv: null, m: LOWQ ? 3 : 1.5, half: FLY_R + 450, e0: 0, n1: 0, N: 0, peak: null };
function baseBuild() {
  const B = BASE, [ce, cn] = wEN(FLY_C.x, FLY_C.z), N = Math.round(B.half * 2 / B.m); B.N = N; B.e0 = ce - B.half; B.n1 = cn + B.half;
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  if (!TER.h) { g.fillStyle = '#263033'; g.fillRect(0, 0, N, N); baseLayers(g); B.cv = cv; MAPC.key = ''; return; }
  const H = new Float32Array(N * N), id = g.createImageData(N, N), d = id.data, m2 = 2 * B.m, CI = 10;
  let row = 0, sr = 0;
  const step = () => {   // 높이 → 음영·등고선: 프레임마다 10 ms 씩 (첫 화면·메뉴가 끊기지 않게)
    const t0 = performance.now();
    for (; row < N && performance.now() - t0 < 10; row++) { const n = B.n1 - (row + 0.5) * B.m; for (let i = 0; i < N; i++) { const e = B.e0 + (i + 0.5) * B.m; H[row * N + i] = terrainAt(e * MCB - n * MSB, -e * MSB - n * MCB); } }
    for (; sr < row - 1 && performance.now() - t0 < 12; sr++) {
      const j = sr, j0 = Math.max(0, j - 1), j1 = Math.min(N - 1, j + 1);
      for (let i = 0; i < N; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(N - 1, i + 1), h = H[j * N + i], hr = H[j * N + i1], hd = H[j1 * N + i];
        const zx = (hr - H[j * N + i0]) / m2, zy = (hd - H[j0 * N + i]) / m2;   // 동쪽·남쪽으로 높아지는 기울기 → 북서쪽 빛
        const sh = clamp(0.5 + (zx + zy) * 0.55, 0, 1), v = 30 + sh * 60, o = (j * N + i) * 4;
        let r = v * 0.92, gg = v * 1.03, b = v * 0.96;
        const c = Math.floor(h / CI);
        if (Math.floor(hr / CI) !== c || Math.floor(hd / CI) !== c) {
          const c5 = Math.floor(h / (CI * 5)), major = Math.floor(hr / (CI * 5)) !== c5 || Math.floor(hd / (CI * 5)) !== c5, a = major ? 0.6 : 0.3;
          r = r * (1 - a) + 212 * a; gg = gg * (1 - a) + 176 * a; b = b * (1 - a) + 118 * a;
        }
        d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    if (row < N || sr < N - 1) return setTimeout(step, 0);
    for (let i = 0; i < N; i++) { const o = ((N - 1) * N + i) * 4, p = ((N - 2) * N + i) * 4; d[o] = d[p]; d[o + 1] = d[p + 1]; d[o + 2] = d[p + 2]; d[o + 3] = 255; }   // 맨 아랫줄
    g.putImageData(id, 0, 0);
    // 봉우리: 비행 구역 안에서 가장 높은 곳
    let best = -1e9, bi = 0, bj = 0; const [fe, fn] = wEN(FLY_C.x, FLY_C.z), RR = (FLY_R + 60) / B.m;
    for (let j = 0; j < N; j += 2) for (let i = 0; i < N; i += 2) { const e = B.e0 + (i + 0.5) * B.m, n = B.n1 - (j + 0.5) * B.m; if (Math.hypot(e - fe, n - fn) / B.m > RR) continue; const h = H[j * N + i]; if (h > best) { best = h; bi = i; bj = j; } }
    B.peak = best > -1e8 ? { e: B.e0 + (bi + 0.5) * B.m, n: B.n1 - (bj + 0.5) * B.m, h: best } : null;
    baseLayers(g); B.cv = cv; MAPD.sig = ''; MAPC.key = '';
  };
  step();
}
function baseLayers(g) {   // 동·북 (m) 으로 그림: 밭 · 숲 · 연못
  const B = BASE; g.save(); g.setTransform(1 / B.m, 0, 0, -1 / B.m, -B.e0 / B.m, B.n1 / B.m);
  const pathDS = (a, close, P) => { for (let i = 0; i < a.length; i += 2) { const d = a[i], s = a[i + 1], e = s * MCB + d * MSB, n = d * MCB - s * MSB; i ? P.lineTo(e, n) : P.moveTo(e, n); } if (close) P.closePath(); };
  if (VEC && VEC.field) { const P = new Path2D(); for (const a of VEC.field) pathDS(a, true, P); g.fillStyle = 'rgba(176,164,96,.34)'; g.fill(P); }
  // 숲: 나무마다 수관 원 (겹친 곳은 한 번만 칠함)
  try {
    const P = new Path2D(); let n = 0;
    if (typeof STREES !== 'undefined' && STREES && STREES.CHUNKS) for (const k of STREES.CHUNKS) { if (k.deco) continue; const a = k.im.instanceMatrix.array;
      for (let j = 0; j < k.im.count; j++) { const o = j * 16, sx = Math.hypot(a[o], a[o + 1], a[o + 2]); if (sx < 0.05) continue; const [e, nn] = wEN(a[o + 12], a[o + 14]), r = Math.max(1.2, sx * 0.8); P.moveTo(e + r, nn); P.arc(e, nn, r, 0, 6.2832); n++; } }
    if (typeof OUTER !== 'undefined' && OUTER && OUTER.T) for (const t of OUTER.T) { const [e, nn] = wEN(t[0], t[2]); if (Math.abs(e - B.e0 - B.half) > B.half + 10 || Math.abs(nn - B.n1 + B.half) > B.half + 10) continue; const r = Math.max(1.5, t[4] * 1.1); P.moveTo(e + r, nn); P.arc(e, nn, r, 0, 6.2832); n++; }
    if (n) { g.fillStyle = 'rgba(46,98,54,.6)'; g.fill(P); }
  } catch (e) { }
  if (typeof WATER !== 'undefined' && WATER && WATER.length) { const P = new Path2D(); for (const w of WATER) { w.poly.forEach(([x, z], i) => { const [e, n] = wEN(x, z); i ? P.lineTo(e, n) : P.moveTo(e, n); }); P.closePath(); } g.fillStyle = 'rgba(58,128,196,.95)'; g.fill(P); }
  g.restore();
}
// ---- 길·건물·시설 (보는 범위가 바뀔 때 다시 그림) ----
const MAPD = { sig: '' };
function mapData() {   // 자료가 늘었으면 (바깥 마을·건물·송전선·활주로가 늦게 생김) 경로를 다시 만듦
  const bl = typeof BLD3 !== 'undefined' && BLD3 && BLD3.LIST ? BLD3.LIST : [], O = window.__OUTER;
  const sig = [bl.length, O ? O.roads.length : 0, window.__POWER && window.__POWER.TW ? window.__POWER.TW.length : 0, window.__RWY ? 1 : 0, BASE.peak ? 1 : 0].join(',');
  if (sig === MAPD.sig) return; MAPD.sig = sig;
  const pathDS = (a, P) => { for (let i = 0; i < a.length; i += 2) { const d = a[i], s = a[i + 1], e = s * MCB + d * MSB, n = d * MCB - s * MSB; i ? P.lineTo(e, n) : P.moveTo(e, n); } };
  const pathW = (pts, P) => pts.forEach(([x, z], i) => { const [e, n] = wEN(x, z); i ? P.lineTo(e, n) : P.moveTo(e, n); });
  MAPD.road = new Path2D(); MAPD.trail = new Path2D(); MAPD.stream = new Path2D();
  if (VEC) { for (const a of VEC.road || []) pathDS(a, MAPD.road); for (const a of VEC.trail || []) pathDS(a, MAPD.trail); for (const a of VEC.stream || []) pathDS(a, MAPD.stream); }
  MAPD.roadO = []; if (O) for (const rd of O.roads) { const P = new Path2D(); pathW(rd.p, P); MAPD.roadO.push({ P, w: rd.w }); }
  MAPD.bld = new Path2D(); for (const b of bl) { const [x, z, , w, l] = b, hw = Math.max(2, w || 6) / 2, hl = Math.max(2, l || 6) / 2; pathW([[x - hw, z - hl], [x + hw, z - hl], [x + hw, z + hl], [x - hw, z + hl]], MAPD.bld); MAPD.bld.closePath(); }
  MAPD.dam = new Path2D(); for (const dm of SITE.dams || []) pathDS([dm.a[0], dm.a[1], dm.b[0], dm.b[1]], MAPD.dam);
  MAPD.lane = null; if (typeof FLANE !== 'undefined' && FLANE && FLANE.lane) { MAPD.lane = new Path2D(); pathDS(FLANE.lane.flat(), MAPD.lane); }
  MAPD.course = null; if (CRS_C) { MAPD.course = new Path2D(); pathDS(CRS_C.path.flat(), MAPD.course); }
  // 이름: 마을(건물 무리) · 봉우리 · 숲길 · 사방댐 · 기지국 · 출발
  const L = [], G = new Map(); for (const b of bl) { const k = Math.round(b[0] / 150) + ',' + Math.round(b[1] / 150); if (!G.has(k)) G.set(k, []); G.get(k).push(b); }
  for (const [, a] of G) if (a.length >= 5) { const x = a.reduce((s, b) => s + b[0], 0) / a.length, z = a.reduce((s, b) => s + b[1], 0) / a.length; if (!L.some(q => q.t === 'vil' && Math.hypot(q.x - x, q.z - z) < 220)) L.push({ t: 'vil', x, z, ko: '마을', en: 'Village', pri: 2 }); }
  if (O && O.vil) for (const [x, z] of O.vil) if (!L.some(q => q.t === 'vil' && Math.hypot(q.x - x, q.z - z) < 220)) L.push({ t: 'vil', x, z, ko: '마을', en: 'Village', pri: 2 });
  if (BASE.peak) { const [x, z] = enW(BASE.peak.e, BASE.peak.n); L.push({ t: 'peak', x, z, ko: '▲ ' + Math.round(BASE.peak.h) + ' m', en: '▲ ' + Math.round(BASE.peak.h) + ' m', pri: 1 }); }
  if (MAPD.lane) { const q = FLANE.at(FLANE.total * 0.5); L.push({ t: 'lane', x: q.s, z: -q.d, ko: '숲길', en: 'Forest trail', pri: 3, max: 4 }); }
  for (const dm of SITE.dams || []) L.push({ t: 'dam', x: (dm.a[1] + dm.b[1]) / 2, z: -(dm.a[0] + dm.b[0]) / 2, ko: '사방댐', en: 'Check dam', pri: 4, max: 2.5 });
  if (typeof BLD3 !== 'undefined' && BLD3 && BLD3.MAST) L.push({ t: 'mast', x: BLD3.MAST.x, z: BLD3.MAST.z, ko: '기지국', en: 'Mast', pri: 3 });
  MAPD.lab = L.sort((a, b) => a.pri - b.pri);
}
const MAPC = { cv: document.createElement('canvas'), key: '', V: null, t: 0 };
function mapCache(V, kd) {   // 바탕 + 길·시설 + 이름 → 한 장 (범위가 바뀔 때만)
  const C = MAPC, W = MAPL.W, H = MAPL.H;
  if (C.key && V.mv && C.V && C.kd === kd && (performance.now() - C.t < 90 || Math.hypot(V.e - C.V.e, V.n - C.V.n) / V.m < 0.6) && Math.abs(V.m - C.V.m) < 1e-6) return;   // 따라가는 범위: 1 px 넘게 움직였을 때만 · 초당 최대 11번
  mapData();
  const key = V.e.toFixed(2) + ',' + V.n.toFixed(2) + ',' + V.m.toFixed(4) + ',' + kd + ',' + MAPD.sig + ',' + (BASE.cv ? 1 : 0);
  if (key === C.key) return; C.key = key; C.V = { e: V.e, n: V.n, m: V.m }; C.kd = kd; C.t = performance.now();
  const cv = C.cv; if (cv.width !== W * kd || cv.height !== H * kd) { cv.width = W * kd; cv.height = H * kd; }
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#161c1f'; g.fillRect(0, 0, cv.width, cv.height);
  const B = BASE;
  if (B.cv) {   // 바탕에서 보는 범위만 잘라 옮김 (바탕 밖은 직접 잘라 냄 — 사파리는 그림 밖을 가리키면 아무것도 안 그리는 판이 있음)
    let sx = (V.e - W / 2 * V.m - B.e0) / B.m, sy = (B.n1 - (V.n + H / 2 * V.m)) / B.m, sw = W * V.m / B.m, sh = H * V.m / B.m, dx = 0, dy = 0, dw = cv.width, dh = cv.height; const kx = dw / sw, ky = dh / sh;
    if (sx < 0) { dx -= sx * kx; dw += sx * kx; sw += sx; sx = 0; } if (sy < 0) { dy -= sy * ky; dh += sy * ky; sh += sy; sy = 0; }
    if (sx + sw > B.N) { const o = sx + sw - B.N; sw -= o; dw -= o * kx; } if (sy + sh > B.N) { const o = sy + sh - B.N; sh -= o; dh -= o * ky; }
    g.imageSmoothingEnabled = true; if (sw > 0.5 && sh > 0.5) g.drawImage(B.cv, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  MAPV = C.V;
  // 동·북 (m) 좌표로: 선 굵기·점선 간격은 논리 px × m
  const u = V.m; g.save(); g.setTransform(kd / u, 0, 0, -kd / u, kd * (W / 2 - V.e / u), kd * (H / 2 + V.n / u)); g.lineCap = 'round'; g.lineJoin = 'round';
  if (MAPD.stream) { g.strokeStyle = 'rgba(96,170,230,.85)'; g.lineWidth = 1.3 * u; g.stroke(MAPD.stream); }
  for (const r of MAPD.roadO || []) { g.strokeStyle = 'rgba(12,14,16,.75)'; g.lineWidth = Math.max(2.6 * u, r.w + 1.5); g.stroke(r.P); g.strokeStyle = r.w >= 6 ? 'rgba(238,228,200,.92)' : 'rgba(214,204,178,.85)'; g.lineWidth = Math.max(1.4 * u, r.w); g.stroke(r.P); }
  if (MAPD.road) { g.strokeStyle = 'rgba(232,226,208,.88)'; g.lineWidth = 1.0 * u; g.stroke(MAPD.road); }
  if (MAPD.trail) { g.setLineDash([3 * u, 2 * u]); g.strokeStyle = 'rgba(216,186,134,.85)'; g.lineWidth = 1.1 * u; g.stroke(MAPD.trail); g.setLineDash([]); }
  if (MAPD.dam) { g.strokeStyle = 'rgba(205,205,198,.95)'; g.lineWidth = Math.max(2 * u, 2.2); g.stroke(MAPD.dam); }
  if (MAPD.bld) { g.fillStyle = 'rgba(230,218,196,.95)'; g.fill(MAPD.bld); g.strokeStyle = 'rgba(20,20,20,.7)'; g.lineWidth = 0.6 * u; g.stroke(MAPD.bld); }
  if (MAPD.lane) { g.setLineDash([4 * u, 3 * u]); g.strokeStyle = 'rgba(120,236,160,.9)'; g.lineWidth = 1.6 * u; g.stroke(MAPD.lane); g.setLineDash([]); }
  if (MAPD.course) { g.setLineDash([4 * u, 3 * u]); g.strokeStyle = 'rgba(255,200,40,.6)'; g.lineWidth = 2 * u; g.stroke(MAPD.course); g.setLineDash([]); }
  g.restore(); g.setTransform(kd, 0, 0, kd, 0, 0);
  // 코스 눈금 · 장애물
  if (CRS_C) { g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '9px Menlo,monospace'; let acc = 0, nx = 100;
    for (let i = 1; i < CRS_C.path.length; i++) { const a = CRS_C.path[i - 1], b = CRS_C.path[i]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc >= nx) { const p = mxy(b[0], b[1]); g.fillRect(p[0] - 2, p[1] - 2, 4, 4); if (V.m < 4) g.fillText(nx + 'm', p[0] + 5, p[1] + 3); nx += 100; } } }
  else {   // 기본(평지) 코스: 레인 구역
    const quad = (d0, d1, s0, s1, fill, stroke) => { const P = [mxy(d0, s0), mxy(d0, s1), mxy(d1, s1), mxy(d1, s0)]; g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.setLineDash([3, 3]); g.strokeStyle = stroke; g.stroke(); g.setLineDash([]); } };
    quad(-6, 335, -15, 15, 'rgba(255,200,40,.10)', 'rgba(255,200,40,.45)'); quad(0, 365, -64, -33, 'rgba(120,180,90,.12)');
  }
  for (const o of D.objs) {
    const p = mxy(o.down, o.side), col = { pad: '#fff', gate_sq: '#ffc828', gate_tri: '#ffc828', ring: '#ffc828', pole: '#e0b020', bunker: '#c09060', tunnel: '#9aa', tank: '#a3b26a', mit: '#a3b26a', ivan_group: '#a3b26a' }[o.type] || 'rgba(200,200,200,.45)';
    g.fillStyle = col; const s = ['building', 'hipbld', 'pavilion', 'bleacher', 'shelter', 'tank'].includes(o.type) ? 5 : 3; g.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
  }
  if (window.__RWY) {   // 활주로: 테두리 있는 흰 띠 + 이륙 방향 시단 표시 + RWY 글자 · 계류장(회색) + 유도로 + H 패드(노란 점)
    const R = window.__RWY;
    if (R.apron) { const ap = R.apron.map(v => mxyW(v.x, v.z)); g.fillStyle = 'rgba(170,170,160,.85)'; g.beginPath(); ap.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill();
      const m0 = mxyW((R.a.x + R.b.x) / 2, (R.a.z + R.b.z) / 2), m1 = [(ap[0][0] + ap[1][0]) / 2, (ap[0][1] + ap[1][1]) / 2]; g.strokeStyle = 'rgba(80,80,80,.95)'; g.lineWidth = 2; g.beginPath(); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]); g.stroke();
      g.fillStyle = '#ffc828'; R.pads.forEach(p => { const q = mxyW(p.x, p.z); g.beginPath(); g.arc(q[0], q[1], 1.8, 0, 6.283); g.fill(); }); }
    const p = mxyW(R.a.x, R.a.z), q = mxyW(R.b.x, R.b.z), w = Math.max(3, 12 / V.m * 1.6);
    g.lineCap = 'butt'; g.strokeStyle = 'rgba(10,12,14,.9)'; g.lineWidth = w + 2.5; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    g.strokeStyle = '#e8e8e2'; g.lineWidth = w; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    g.fillStyle = '#40ff70'; g.beginPath(); g.arc(p[0], p[1], 2.4, 0, 6.283); g.fill();
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = -(q[1] - p[1]), ny = q[0] - p[0], nl = Math.hypot(nx, ny) || 1;
    g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.7)'; g.fillText('RWY', mx + nx / nl * 11 + 0.8, my + ny / nl * 11 + 3.8); g.fillStyle = '#ffffff'; g.fillText('RWY', mx + nx / nl * 11, my + ny / nl * 11 + 3); g.textAlign = 'left';
  }
  if (window.__POWER) window.__POWER.mapDraw(g, mxy);   // 송전선 (주황 점선 + 철탑)
  { const st = homePos(), q = mxyW(st.x, st.z); g.fillStyle = 'rgba(10,12,14,.85)'; g.beginPath(); g.arc(q[0], q[1], 5.5, 0, 6.283); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText('H', q[0], q[1] + 3); g.textAlign = 'left'; }   // 출발 패드
  // 비행 구역 경계 (점선 원)
  { const c = mxyW(FLY_C.x, FLY_C.z), r = FLY_R / V.m; g.strokeStyle = 'rgba(255,90,90,.55)'; g.lineWidth = 1.2; g.setLineDash([5, 4]); g.beginPath(); g.arc(c[0], c[1], r, 0, 7); g.stroke(); g.setLineDash([]); }
  // 이름 (겹치면 뒤의 것은 뺌)
  const en = window.SIM_LANG === 'en', boxes = []; g.font = '600 10px sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round';
  for (const L of MAPD.lab || []) {
    if (L.max && V.m > L.max) continue; const [x, y] = mxyW(L.x, L.z); if (x < -20 || x > W + 20 || y < -10 || y > H + 10) continue;
    const t = en ? L.en : L.ko, tw = g.measureText(t).width, by = L.t === 'mast' || L.t === 'dam' ? y - 7 : y + 4, bx = [x - tw / 2 - 2, by - 10, x + tw / 2 + 2, by + 3];
    if (boxes.some(b => !(bx[2] < b[0] || bx[0] > b[2] || bx[3] < b[1] || bx[1] > b[3]))) continue; boxes.push(bx);
    if (L.t === 'mast') { g.strokeStyle = '#ff6a5a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 3, y + 3); g.lineTo(x, y - 4); g.lineTo(x + 3, y + 3); g.stroke(); }
    g.strokeStyle = 'rgba(8,10,12,.85)'; g.lineWidth = 3; g.strokeText(t, x, by); g.fillStyle = L.t === 'peak' ? '#ffe2a8' : L.t === 'lane' ? '#9ff0bf' : L.t === 'vil' ? '#fff3d6' : '#e8eef2'; g.fillText(t, x, by);
  }
  g.textAlign = 'left';
}
function mapRefresh() { MAPD.sig = ''; MAPC.key = ''; }   // 늦게 생긴 자료(활주로·바깥 마을·송전선)를 지도에 넣음
function drawMapBg() { mapRefresh(); }   // 예전 이름
// ---- 매 프레임 ----
function drawMap(gpos) {
  const cv = ui.map, box = ui.mapBox; if (!cv) return;
  const XR = typeof XR_ON !== 'undefined' && XR_ON, fold = !!SET.fold.map && !XR;
  if (box && box.classList.contains('fold') !== fold) box.classList.toggle('fold', fold);
  if (fold) return;
  const kd = MAPZ.on ? 3 : 2; if (cv.width !== MAPL.W * kd) { cv.width = MAPL.W * kd; cv.height = MAPL.H * kd; }
  const V = mapCurView(); mapCache(V, kd); MAPV = MAPC.V || V;
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(MAPC.cv, 0, 0); g.setTransform(kd, 0, 0, kd, 0, 0);
  const W = MAPL.W, H = MAPL.H, toDS = p => [-p.z, p.x];
  const o0 = curObj(), o = gOn('map') ? o0 : null;   // 지도의 목표·수색 원·점선 (안내 설정)
  if (o && o.mk && o.search) { const [d, s] = toDS(o.mk); const p = mxy(d, s), rr = Math.max(5, o.search.r / MAPV.m); g.strokeStyle = 'rgba(255,200,40,.9)'; g.fillStyle = 'rgba(255,200,40,.14)'; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.beginPath(); g.arc(p[0], p[1], rr, 0, 7); g.fill(); g.stroke(); g.setLineDash([]); }
  // 산불: 다른 신고 구역(번호)과 보고 끝난 불씨(✓) 도 지도에
  if (S.kind === 'fire' && isMission() && MS.list) { g.font = '700 10px monospace'; MS.list.forEach((x, i) => { if (!x.mk) return;
    if (x.done) { if (!x.tp) return; /* 마지막 활주로 복귀 항목(고정익)은 불씨가 아니라 tp 없음 */ const q = mxy(...toDS(x.tp)); g.fillStyle = '#9aa6ad'; g.fillText('✓' + (i + 1), q[0] + 3, q[1] - 2); g.beginPath(); g.arc(q[0], q[1], 2, 0, 7); g.fill(); return; }
    if (!x.active || !o) return; const p = mxy(...toDS(x.mk)); if (x !== o) { const rr = Math.max(5, x.search.r / MAPV.m); g.strokeStyle = 'rgba(255,200,40,.5)'; g.setLineDash([3, 3]); g.beginPath(); g.arc(p[0], p[1], rr, 0, 7); g.stroke(); g.setLineDash([]); }
    g.fillStyle = '#ffc828'; g.fillText(String(i + 1), p[0] - 3, p[1] + 4); }); }
  if (o && o.mk && o.search && S.kind === 'sar') { const p = mxy(...toDS(o.mk)); g.font = '700 10px monospace'; g.fillStyle = '#ffc828'; g.fillText('SAR', p[0] - 9, p[1] + 4); }
  else if (o && o.mk && !o.search) { const p = mxy(...toDS(o.mk)); g.strokeStyle = '#ffc828'; g.lineWidth = 2; g.beginPath(); g.arc(clamp(p[0], 3, W - 3), clamp(p[1], 3, H - 3), 6 + Math.sin(performance.now() / 200) * 1.5, 0, 7); g.stroke(); }
  // 지금 목표까지 점선 (지상 목표 찾기)
  if (o && o.mk && S.state === 'run') { const a = mxy(...toDS(DR.p)), b = mxy(...toDS(o.mk)); g.save(); g.setLineDash([4, 3]); g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(clamp(a[0], 2, W - 2), clamp(a[1], 2, H - 2)); g.lineTo(clamp(b[0], 2, W - 2), clamp(b[1], 2, H - 2)); g.stroke(); g.restore(); }
  if (gpos) { const p = mxy(...toDS(gpos)); g.fillStyle = '#4fe3ff'; g.beginPath(); g.arc(p[0], p[1], 3, 0, 7); g.fill(); }
  if (S.state !== 'demo') {
    const src = S.state === 'replay' ? RP.pose : DR, p = mxy(...toDS(src.p)); g.save(); g.translate(clamp(p[0], 4, W - 4), clamp(p[1], 4, H - 4));
    const pu = 7 + (performance.now() / 120 % 8); g.strokeStyle = `rgba(255,60,90,${0.9 - (pu - 7) / 9})`; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, pu, 0, 7); g.stroke();   // 퍼지는 고리
    g.rotate(src.h + MB_); g.fillStyle = '#ff2d55'; g.strokeStyle = '#000'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 7); g.lineTo(0, 3); g.lineTo(-7, 7); g.closePath(); g.stroke(); g.fill(); g.restore();   // 지도 위쪽 = 북 → 기수 방위만큼 돌림
  }
  // 북쪽 표시 · 축척 · 범위 이름
  g.save(); g.fillStyle = 'rgba(8,10,12,.7)'; g.beginPath(); g.arc(13, 15, 10, 0, 7); g.fill(); g.fillStyle = '#ffc828'; g.beginPath(); g.moveTo(13, 6); g.lineTo(17.5, 17); g.lineTo(13, 14.5); g.lineTo(8.5, 17); g.closePath(); g.fill();
  g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('N', 13, 24.5);
  const nice = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000], sm = nice.find(v => v / MAPV.m >= 34) || 2000, sw = sm / MAPV.m, y0 = H - 8;
  g.fillStyle = 'rgba(8,10,12,.65)'; g.fillRect(4, y0 - 11, sw + 8, 15); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(8, y0 - 3); g.lineTo(8, y0); g.lineTo(8 + sw, y0); g.lineTo(8 + sw, y0 - 3); g.stroke();
  g.font = '600 8px sans-serif'; g.fillStyle = '#fff'; g.fillText(sm >= 1000 ? sm / 1000 + ' km' : sm + ' m', 8 + sw / 2, y0 - 3);
  const lv = MAP_LV[SET.mapZ] || MAP_LV[2], ln = window.SIM_LANG === 'en' ? lv[2] : lv[1]; g.textAlign = 'right'; g.font = '600 8.5px sans-serif'; const lw = g.measureText(ln).width; g.fillStyle = 'rgba(8,10,12,.65)'; g.fillRect(W - lw - 9, H - 18, lw + 6, 13); g.fillStyle = '#cfe8ff'; g.fillText(ln, W - 6, H - 8.5);
  g.restore();
}
// ---- 지도 상자: 캔버스 + 단추 (− 넓게 · + 좁게 · ▾ 접기) · 접히면 🗺 단추 ----
(function mapBoxInit() {
  const box = ui.mapBox; if (!box) return;
  const bar = document.createElement('div'); bar.className = 'mapBar';
  bar.innerHTML = `<button data-m="-" title="${L2x('넓게 보기', 'Zoom out')}">−</button><button data-m="+" title="${L2x('좁게 보기', 'Zoom in')}">+</button><button data-m="f" title="${L2x('지도 접기', 'Hide map')}">▾</button>`;
  const open = document.createElement('button'); open.className = 'mapOpen'; open.title = L2x('지도 펼치기', 'Show map'); open.textContent = '🗺';
  box.appendChild(bar); box.appendChild(open);
  const stop = e => { e.stopPropagation(); e.preventDefault(); };
  bar.querySelectorAll('button').forEach(b => { b.addEventListener('pointerdown', e => { stop(e); const m = b.dataset.m; if (m === '-') mapLv(-1); else if (m === '+') mapLv(1); else if (MAPZ.on) mapZoom(false); else mapFold(true); }); b.addEventListener('pointerup', stop); b.addEventListener('click', stop); });
  open.addEventListener('pointerdown', e => { stop(e); mapFold(false); }); open.addEventListener('pointerup', stop); open.addEventListener('click', stop);
  ui.map.addEventListener('pointerdown', e => { stop(e); mapZoom(!MAPZ.on); }); ui.map.addEventListener('pointerup', stop);
  if (SET.fold.map) box.classList.add('fold');
})();
setTimeout(baseBuild, 0);   // 앱을 다 읽은 뒤 (나무·바깥 지역·연못이 생긴 다음)
