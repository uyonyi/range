(function () {
'use strict';

// =====================================================================
//  지형(GIS) 모듈 — DEM 을 코스 좌표계로 재투영·리샘플해 "지형 패키지"로 만듦
//   · 입력: GeoTIFF / ESRI ASCII Grid, 좌표계 자동 인식 (EPSG:4326·5186·5179·UTM 등)
//   · 출력: 코스 주변 1.2 km 고해상도(5 m) + 주변 12 km 원경(60 m) 높이 격자
//   · 패키지는 HTML 안에 내장(기본 지형)하거나 브라우저에 저장(내 DEM)
// =====================================================================
const KR_CRS = {
  'EPSG:5185': '+proj=tmerc +lat_0=38 +lon_0=125 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
  'EPSG:5186': '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
  'EPSG:5187': '+proj=tmerc +lat_0=38 +lon_0=129 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
  'EPSG:5188': '+proj=tmerc +lat_0=38 +lon_0=131 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
  'EPSG:5179': '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs',
  'EPSG:5174': '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43',
  'EPSG:2097': '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43'
};
const CRS_LABEL = {
  'EPSG:4326': 'WGS84 위경도', 'EPSG:5186': 'GRS80 중부원점 (EPSG:5186)', 'EPSG:5185': 'GRS80 서부원점 (EPSG:5185)', 'EPSG:5187': 'GRS80 동부원점 (EPSG:5187)',
  'EPSG:5188': 'GRS80 동해원점 (EPSG:5188)', 'EPSG:5179': 'UTM-K (EPSG:5179)', 'EPSG:5174': 'Bessel 중부원점 (EPSG:5174)', 'EPSG:2097': 'Bessel 중부원점 (EPSG:2097)',
  'EPSG:32651': 'UTM 51N (EPSG:32651)', 'EPSG:32652': 'UTM 52N (EPSG:32652)', 'EPSG:3857': '웹 메르카토르 (EPSG:3857)'
};
function crsDef(code) {
  if (!window.proj4) throw new Error('proj4 없음');
  if (proj4.defs(code)) return code;
  if (KR_CRS[code]) { proj4.defs(code, KR_CRS[code]); return code; }
  const m = /^EPSG:(326|327)(\d\d)$/.exec(code);
  if (m) { proj4.defs(code, `+proj=utm +zone=${+m[2]}${m[1] === '327' ? ' +south' : ''} +datum=WGS84 +units=m +no_defs`); return code; }
  throw new Error('지원하지 않는 좌표계: ' + code);
}
function projector(from, to) { if (from === to) return p => p; crsDef(from); crsDef(to); const t = proj4(from, to); return p => t.forward(p); }
// 좌표 범위로 좌표계 추정 (ASC 처럼 좌표계 정보가 없을 때)
function guessCrs(x, y) {
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return 'EPSG:4326';
  if (x > 700000 && x < 1300000 && y > 1300000 && y < 2300000) return 'EPSG:5179';
  if (x > 0 && x < 700000 && y > 3500000 && y < 4800000) return x < 400000 && y < 4300000 && x > 150000 ? 'EPSG:32652' : 'EPSG:32652';
  if (x > 0 && x < 500000 && y > 100000 && y < 800000) return 'EPSG:5186';
  if (Math.abs(x) > 1e7 || Math.abs(y) > 1e6) return 'EPSG:3857';
  return 'EPSG:5186';
}

// ---- DEM 파일 읽기 -> { w, h, data(Float32, NaN=없음), x0, y0, dx, dy(음수), crs, crsSrc, name }
async function readDem(file, crsOverride) {
  const name = file.name || 'dem';
  let R;
  if (/\.(asc|txt)$/i.test(name)) {
    const txt = await file.text(); const re = /\S+/g; const tok = () => { const m = re.exec(txt); return m ? m[0] : null; };
    const hd = {};
    for (let i = 0; i < 7; i++) { const save = re.lastIndex; const t = tok(); if (!t) break; if (/^[a-zA-Z_]+$/.test(t)) hd[t.toLowerCase()] = parseFloat(tok()); else { re.lastIndex = save; break; } }
    const w = hd.ncols, h = hd.nrows, cs = hd.cellsize, nod = hd.nodata_value !== undefined ? hd.nodata_value : -9999;
    if (!w || !h || !cs) throw new Error('ASCII Grid 머리글을 읽지 못했습니다');
    const xl = hd.xllcorner !== undefined ? hd.xllcorner : hd.xllcenter - cs / 2, yl = hd.yllcorner !== undefined ? hd.yllcorner : hd.yllcenter - cs / 2;
    const data = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { const v = parseFloat(tok()); data[i] = (isNaN(v) || v === nod) ? NaN : v; if (i % 400000 === 0) await new Promise(r => setTimeout(r, 0)); }
    R = { w, h, data, x0: xl, y0: yl + h * cs, dx: cs, dy: -cs, crs: null, crsSrc: '' };
  } else {
    if (!window.GeoTIFF) throw new Error('GeoTIFF 해석기가 없습니다');
    const tiff = await GeoTIFF.fromBlob(file); const img = await tiff.getImage(0);
    let w = img.getWidth(), h = img.getHeight(); const bb = img.getBoundingBox();
    const scale = Math.max(1, Math.sqrt(w * h / 16e6));          // 너무 크면 1600만 화소로 줄여 읽음
    const rw = Math.round(w / scale), rh = Math.round(h / scale);
    const ras = await img.readRasters({ samples: [0], width: rw, height: rh, resampleMethod: 'bilinear' });
    const src = ras[0], nod = img.getGDALNoData(), data = new Float32Array(rw * rh);
    for (let i = 0; i < data.length; i++) { const v = src[i]; data[i] = (v === nod || v < -1000 || v > 9000 || isNaN(v)) ? NaN : v; }
    let crs = null; const gk = img.getGeoKeys() || {};
    const code = gk.ProjectedCSTypeGeoKey || gk.GeographicTypeGeoKey;
    if (code && code !== 32767) crs = 'EPSG:' + code;
    R = { w: rw, h: rh, data, x0: bb[0], y0: bb[3], dx: (bb[2] - bb[0]) / rw, dy: -(bb[3] - bb[1]) / rh, crs, crsSrc: crs ? 'GeoTIFF' : '' };
  }
  if (crsOverride) { R.crs = crsOverride; R.crsSrc = '직접 지정'; }
  if (!R.crs) { R.crs = guessCrs(R.x0, R.y0); R.crsSrc = '좌표 범위로 추정'; }
  crsDef(R.crs);
  R.name = name;
  let mn = 1e9, mx = -1e9, nv = 0; for (const v of R.data) if (!isNaN(v)) { nv++; if (v < mn) mn = v; if (v > mx) mx = v; }
  if (!nv) throw new Error('높이 값이 없습니다');
  R.min = mn; R.max = mx;
  // 래스터 중심의 위경도 (배치 기본값)
  const toLL = projector(R.crs, 'EPSG:4326');
  R.ll = toLL([R.x0 + R.dx * R.w / 2, R.y0 + R.dy * R.h / 2]);
  R.res = Math.abs(R.dx) * (R.crs === 'EPSG:4326' ? 111320 * Math.cos(R.ll[1] * Math.PI / 180) : 1);
  return R;
}
function demSampler(R) {
  return (x, y) => {
    const fx = (x - R.x0) / R.dx - 0.5, fy = (y - R.y0) / R.dy - 0.5;
    if (fx < -0.5 || fy < -0.5 || fx > R.w - 0.5 || fy > R.h - 0.5) return NaN;
    const ix = Math.max(0, Math.min(R.w - 2, Math.floor(fx))), iy = Math.max(0, Math.min(R.h - 2, Math.floor(fy)));
    const ax = Math.max(0, Math.min(1, fx - ix)), ay = Math.max(0, Math.min(1, fy - iy)), d = R.data, w = R.w;
    const a = d[iy * w + ix], b = d[iy * w + ix + 1], c = d[(iy + 1) * w + ix], e = d[(iy + 1) * w + ix + 1];
    if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(e)) { const ok = [a, b, c, e].filter(v => !isNaN(v)); return ok.length ? ok.reduce((s, v) => s + v, 0) / ok.length : NaN; }
    return (a * (1 - ax) + b * ax) * (1 - ay) + (c * (1 - ax) + e * ax) * ay;
  };
}
// 빈 값(NaN) 메우기: 이웃 평균으로 바깥쪽부터 채움
function fillNaN(h, n) {
  for (let pass = 0; pass < 400; pass++) {
    let left = 0; const out = h.slice();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x; if (!isNaN(h[i])) continue;
      let s = 0, c = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue; const v = h[Y * n + X]; if (!isNaN(v)) { s += v; c++; } }
      if (c) out[i] = s / c; else left++;
    }
    h.set(out); if (!left) return true;
  }
  return false;
}
// 코스 좌표 (down, side) <-> 현장 좌표 (site.crs 의 E, N)
//  site: { crs, e0, n0, brg(도, 다운레인지 방위각), dc, sc } — (dc, sc) 코스 지점이 (e0, n0) 에 놓임
function siteXform(site) {
  const B = site.brg * Math.PI / 180, s = Math.sin(B), c = Math.cos(B);
  return {
    toEN(down, side) { const dd = down - site.dc, ss = side - site.sc; return [site.e0 + s * dd + c * ss, site.n0 + c * dd - s * ss]; },
    toDS(E, N) { const de = E - site.e0, dn = N - site.n0; return [site.dc + s * de + c * dn, site.sc + c * de - s * dn]; }
  };
}
const TGRID = { inN: 241, inStep: 5, s0: -600, d1: 800, farN: 201, farStep: 60, fs0: -6000, fd1: 6200 };
function b64i16(a) { const u = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function i16b64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Int16Array(u.buffer); }
// DEM -> 지형 패키지
//  opt: { lat, lon, brg, name, dc, sc }  (lat, lon) = 코스 중심이 놓일 위치
function buildTerrainPkg(R, opt) {
  const zone = Math.floor((opt.lon + 180) / 6) + 1, siteCrs = 'EPSG:' + (opt.lat >= 0 ? 326 : 327) + String(zone).padStart(2, '0');
  crsDef(siteCrs);
  const [e0, n0] = projector('EPSG:4326', siteCrs)([opt.lon, opt.lat]);
  const site = { crs: siteCrs, e0, n0, brg: opt.brg, dc: opt.dc !== undefined ? opt.dc : 170, sc: opt.sc !== undefined ? opt.sc : -15 };
  const X = siteXform(site), toR = projector(siteCrs, R.crs), smp = demSampler(R);
  const at = (down, side) => { const p = toR(X.toEN(down, side)); return smp(p[0], p[1]); };
  const G = TGRID;
  // 원경 격자
  const fn = G.farN, far = new Float32Array(fn * fn);
  for (let iy = 0; iy < fn; iy++) for (let ix = 0; ix < fn; ix++) far[iy * fn + ix] = at(G.fd1 - iy * G.farStep, G.fs0 + ix * G.farStep);
  let farCover = 0; for (const v of far) if (!isNaN(v)) farCover++;
  // 고해상도 격자
  const n = G.inN, inn = new Float32Array(n * n); let cover = 0;
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) { const v = at(G.d1 - iy * G.inStep, G.s0 + ix * G.inStep); inn[iy * n + ix] = v; if (!isNaN(v)) cover++; }
  if (cover < n * n * 0.5) throw new Error(`DEM 이 코스 범위를 ${Math.round(cover / (n * n) * 100)}% 만 덮습니다. 배치 위치를 DEM 안쪽으로 옮기세요.`);
  if (!fillNaN(far, fn)) far.fill(0);
  const farAt = (down, side) => {
    const fx = (side - G.fs0) / G.farStep, fy = (G.fd1 - down) / G.farStep;
    const ix = Math.max(0, Math.min(fn - 2, Math.floor(fx))), iy = Math.max(0, Math.min(fn - 2, Math.floor(fy))), ax = fx - ix, ay = fy - iy;
    return (far[iy * fn + ix] * (1 - ax) + far[iy * fn + ix + 1] * ax) * (1 - ay) + (far[(iy + 1) * fn + ix] * (1 - ax) + far[(iy + 1) * fn + ix + 1] * ax) * ay;
  };
  // 빈 곳은 원경 값, 가장자리 60 m 는 원경과 매끈하게 이어지도록 섞음 (틈 방지)
  const sm = (e0_, e1_, x) => { const t = Math.max(0, Math.min(1, (x - e0_) / (e1_ - e0_))); return t * t * (3 - 2 * t); };
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    const down = G.d1 - iy * G.inStep, side = G.s0 + ix * G.inStep, i = iy * n + ix, fv = farAt(down, side);
    const edge = Math.min(ix, iy, n - 1 - ix, n - 1 - iy) * G.inStep, w = sm(0, 60, edge);
    inn[i] = isNaN(inn[i]) ? fv : fv * (1 - w) + inn[i] * w;
  }
  // 기준 높이 = 출발 패드 지점
  const base = inn[Math.round((G.d1 - 10) / G.inStep) * n + Math.round((-5 - G.s0) / G.inStep)];
  const enc = a => { const o = new Int16Array(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.max(-32000, Math.min(32000, Math.round((a[i] - base) * 10))); return b64i16(o); };
  let mn = 1e9, mx = -1e9; for (const v of inn) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  let fmn = 1e9, fmx = -1e9; for (const v of far) { fmn = Math.min(fmn, v); fmx = Math.max(fmx, v); }
  return {
    v: 1, id: opt.id || 'custom', name: opt.name || R.name, src: opt.src || R.name, demCrs: R.crs, demRes: +R.res.toFixed(2),
    crs: siteCrs, e0: +e0.toFixed(2), n0: +n0.toFixed(2), brg: opt.brg, dc: site.dc, sc: site.sc, lat: opt.lat, lon: opt.lon,
    base: +base.toFixed(2), inMin: +mn.toFixed(1), inMax: +mx.toFixed(1), farMin: +fmn.toFixed(1), farMax: +fmx.toFixed(1),
    cover: Math.round(cover / (n * n) * 100), farCover: Math.round(farCover / (fn * fn) * 100),
    inH: enc(inn), farH: enc(far)
  };
}
function decodePkg(p) {
  const inH = i16b64(p.inH), farH = i16b64(p.farH);
  const a = new Float32Array(inH.length), f = new Float32Array(farH.length);
  for (let i = 0; i < a.length; i++) a[i] = inH[i] / 10; for (let i = 0; i < f.length; i++) f[i] = farH[i] / 10;
  return { inner: a, far: f };
}
// 미리보기용 음영기복도 (DEM 전체) — 캔버스 반환 + 화소<->좌표 변환
function demPreview(R, maxPx) {
  const k = Math.max(1, Math.max(R.w, R.h) / (maxPx || 520)), W = Math.round(R.w / k), H = Math.round(R.h / k);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), id = g.createImageData(W, H);
  const at = (x, y) => { const X = Math.min(R.w - 1, Math.max(0, Math.round(x * k))), Y = Math.min(R.h - 1, Math.max(0, Math.round(y * k))); return R.data[Y * R.w + X]; };
  const cell = R.res * k, rng = Math.max(1, R.max - R.min);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = at(x, y), o = (y * W + x) * 4;
    if (isNaN(z)) { id.data[o + 3] = 0; continue; }
    const zx = ((at(x + 1, y) || z) - (at(x - 1, y) || z)) / (2 * cell), zy = ((at(x, y + 1) || z) - (at(x, y - 1) || z)) / (2 * cell);
    const sh = Math.max(0, Math.min(1, (0.6 - 0.55 * zx + 0.55 * zy) / Math.sqrt(1 + zx * zx + zy * zy) + 0.25));
    const t = (z - R.min) / rng;
    const col = t < 0.5 ? [70 + t * 2 * 90, 120 + t * 2 * 60, 70 + t * 2 * 20] : [160 + (t - 0.5) * 2 * 70, 180 - (t - 0.5) * 2 * 40, 90 + (t - 0.5) * 2 * 80];
    id.data[o] = col[0] * sh; id.data[o + 1] = col[1] * sh; id.data[o + 2] = col[2] * sh; id.data[o + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  const toLL = projector(R.crs, 'EPSG:4326'), fromLL = projector('EPSG:4326', R.crs);
  return {
    cv, W, H,
    px2ll(px, py) { return toLL([R.x0 + (px * k) * R.dx, R.y0 + (py * k) * R.dy]); },
    ll2px(lon, lat) { const p = fromLL([lon, lat]); return [(p[0] - R.x0) / R.dx / k, (p[1] - R.y0) / R.dy / k]; }
  };
}

// ---- 현장(지형) 목록: 평지(기본 코스) + 내장 지형 + 내 DEM
const SITE_FLAT = Object.assign({ id: 'flat', name: '평지 · 기본 코스', crs: 'EPSG:32652', e0: 300000, n0: 4000000, brg: 0, dc: 170, sc: -15, base: 0, flat: true }, window.SIM_FLAT_SITE || {});
function sitesAll() {
  const L = (window.SIM_NOFLAT ? [] : [SITE_FLAT]).concat(window.SIM_SITES || []);
  try { const s = localStorage.getItem('fpvsim_site_custom'); if (s) L.push(JSON.parse(s)); } catch (e) { }
  return L;
}
function siteCurrentId() { try { return localStorage.getItem('fpvsim_site') || window.SIM_DEFAULT_SITE || (window.SIM_SITES && window.SIM_SITES[0] ? window.SIM_SITES[0].id : 'flat'); } catch (e) { return 'flat'; } }
function siteSelect(id) { try { localStorage.setItem('fpvsim_site', id); } catch (e) { } }
function siteLoad() {
  const id = siteCurrentId(), L = sitesAll();
  const s = L.find(x => x.id === id) || L[0] || SITE_FLAT;
  if (s.flat) return { site: s, dec: null };
  try { return { site: s, dec: decodePkg(s) }; } catch (e) { console.warn('지형 패키지 오류', e); return { site: SITE_FLAT, dec: null }; }
}
function smooth01(e0, e1, x) { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
// 현장에 전용 코스(경로를 따라 배치한 장애물)가 있으면 기본 코스 데이터를 바꿔 끼움
const SITE_PRE = siteLoad();
if (SITE_PRE.site.course) window.SIM_DATA = Object.assign({}, window.SIM_DATA, { objs: SITE_PRE.site.course.objs, wp: SITE_PRE.site.course.wp });
// 경로(코스 좌표 polyline)까지의 거리와 진행 방향
function pathInfo(down, side) {
  const P = SITE_PRE.site.course && SITE_PRE.site.course.path; if (!P) return null;
  let best = 1e9, dir = [1, 0];
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((down - a[0]) * vx + (side - a[1]) * vy) / l2)), dx = a[0] + vx * t - down, dy = a[1] + vy * t - side, d = dx * dx + dy * dy;
    if (d < best) { best = d; const l = Math.sqrt(l2); dir = [vx / l, vy / l]; }
  }
  return { dist: Math.sqrt(best), dir };
}
// =====================================================================
//  FPV drone training course - web simulator (prototype)
//  좌표: 코스 (down=다운레인지, side=오른쪽+, alt=고도)  ->  three (x=side, y=alt, z=-down)
// =====================================================================
const D = window.SIM_DATA;
const BY = {}; D.objs.forEach(o => { BY[o.id] = o; });
const DEG = Math.PI / 180, G = 9.81;
const V3 = THREE.Vector3;
const num = (v, d) => (v === undefined || v === null || v === '' || isNaN(+v)) ? d : +v;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
// W(): 고도 alt 는 지면 기준(AGL). 지형이 있으면 그 지점 지면 높이를 더함
function W(down, side, alt) { const v = new V3(side, alt || 0, -down); v.y += terrainAt(v.x, v.z); return v; }
function agl(p) { return p.y - groundAt(p.x, p.z); }
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(320);
const LOWQ = !!window.SIM_MOBILE || !!window.SIM_VR || !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);   // VR(Quest) 도 가벼운 화질   // 모바일: 가벼운 화질

THREE.ColorManagement.legacyMode = false;

// ---------------- renderer / scene ----------------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOWQ ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LOWQ ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
const MAXANI = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc8d2da, 220, 1700);
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.04, 3000);
scene.add(camera);

const SUN_DIR = new V3(-0.49, 0.62, 0.62).normalize();
const skyU = { sunDir: { value: SUN_DIR }, time: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: [
    'uniform vec3 sunDir; uniform float time; varying vec3 vW;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }',
    'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }',
    'void main(){ vec3 d = normalize(vW); float h = max(d.y, 0.0);',
    '  vec3 top = vec3(0.33,0.53,0.80); vec3 hor = vec3(0.80,0.85,0.88);',
    '  vec3 c = mix(hor, top, pow(h, 0.45)); float s = max(dot(d, sunDir), 0.0);',
    '  c += vec3(1.0,0.86,0.62) * (pow(s, 900.0) * 1.2 + pow(s, 10.0) * 0.18 + pow(s, 3.0) * 0.06);',
    '  if (d.y > 0.0) { vec2 p = d.xz / (d.y + 0.08) * 1.6 + vec2(time * 0.004, time * 0.002);',
    '    float n = fbm(p) * 0.75 + fbm(p * 3.1 + 5.0) * 0.25; float cov = smoothstep(0.50, 0.78, n);',
    '    float shade = 0.80 + 0.25 * smoothstep(0.55, 0.95, n) + 0.25 * pow(s, 6.0);',
    '    vec3 cc = mix(vec3(0.70,0.73,0.78), vec3(1.0,0.99,0.97), shade - 0.8);',
    '    float fade = smoothstep(0.02, 0.22, d.y); c = mix(c, cc * shade, cov * 0.85 * fade); }',
    '  else c = hor * 0.93;',
    '  gl_FragColor = vec4(c, 1.0); }'].join('\n')
}));
sky.renderOrder = -10;
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xdfe9f5, 0x5e5240, 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 1.35);
sun.castShadow = true;
sun.shadow.mapSize.set(LOWQ ? 1024 : 2048, LOWQ ? 1024 : 2048);
const SC = sun.shadow.camera; SC.left = -42; SC.right = 42; SC.top = 42; SC.bottom = -42; SC.near = 1; SC.far = 260;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

// ---------------- textures ----------------
function canvasTex(w, h, draw, opt) {
  opt = opt || {};
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opt.repeat) t.repeat.set(opt.repeat[0], opt.repeat[1]);
  if (opt.srgb !== false) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = Math.min(8, MAXANI);
  return t;
}
function stripeTex(c1, c2, n, slant, rep) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = c1; g.fillRect(0, 0, w, h); g.fillStyle = c2;
    const p = w / n;
    for (let i = -n * 2; i < n * 3; i++) {
      g.beginPath(); const x = i * p;
      g.moveTo(x, 0); g.lineTo(x + p / 2, 0); g.lineTo(x + p / 2 + slant * h, h); g.lineTo(x + slant * h, h); g.fill();
    }
  }, { repeat: rep || [1, 1] });
}
function noiseFill(g, w, h, base, cols, n, rmin, rmax, alpha, rr) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const x = rr() * w, y = rr() * h, r = rmin + rr() * (rmax - rmin);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = cols[Math.floor(rr() * cols.length)];
    gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha; g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.globalAlpha = 1;
}
const TX = {};
TX.pallet = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#a98656'; g.fillRect(0, 0, w, h);
  const r2 = rng(7);
  for (let i = 0; i < 7; i++) {
    const y = i * h / 7;
    g.fillStyle = `hsl(${30 + r2() * 8},${30 + r2() * 12}%,${44 + r2() * 12}%)`; g.fillRect(0, y + 2, w, h / 7 - 5);
    g.fillStyle = 'rgba(40,25,10,.85)'; g.fillRect(0, y + h / 7 - 3, w, 3);
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(60,40,20,${r2() * 0.15})`; g.fillRect(r2() * w, r2() * h, 10 + r2() * 30, 1); }
});
TX.camo = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#6c6a42', ['#3e4a2a', '#8a7a52', '#2f3524', '#a08c62'], 90, 14, 46, 0.9, rng(11)), { repeat: [1, 1] });
TX.droneCamo = canvasTex(128, 128, (g, w, h) => noiseFill(g, w, h, '#b9a982', ['#8c7a58', '#d8cba6', '#6f6448'], 50, 6, 18, 0.9, rng(5)));
TX.pole = stripeTex('#e0aa12', '#111111', 3, 0.9, [1, 6]);
TX.panel = stripeTex('#e8e6e2', '#7a0a1e', 3, -0.9, [1, 3]);
function silTex() {
  return canvasTex(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#34402f';
    g.beginPath(); g.arc(w / 2, 40, 28, 0, Math.PI * 2); g.fill();
    g.fillRect(w / 2 - 14, 60, 28, 20);
    g.beginPath(); g.moveTo(8, 256); g.lineTo(10, 118); g.quadraticCurveTo(14, 82, 46, 76); g.lineTo(82, 76);
    g.quadraticCurveTo(114, 82, 118, 118); g.lineTo(120, 256); g.fill();
  });
}
TX.sil = silTex();
TX.logo = D.logo ? new THREE.TextureLoader().load(D.logo) : new THREE.Texture(); TX.logo.encoding = THREE.sRGBEncoding; TX.logo.anisotropy = Math.min(8, MAXANI);
function textTex(txt, opt) {
  opt = opt || {};
  return canvasTex(opt.w || 256, opt.h || 192, (g, w, h) => {
    g.fillStyle = opt.bg || '#f2f2ee'; g.fillRect(0, 0, w, h);
    g.fillStyle = opt.fg || '#111'; g.font = `bold ${opt.size || 120}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, w / 2, h / 2 + 6);
  });
}
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,200,.85)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const smokeTex = canvasTex(128, 128, (g, w, h) => {
  const r2 = rng(3);
  for (let i = 0; i < 14; i++) {
    const x = 40 + r2() * 48, y = 40 + r2() * 48, r = 20 + r2() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(225,225,220,.55)'); gr.addColorStop(1, 'rgba(225,225,220,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
});

// ---------------- materials ----------------
function mat(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, o || {})); }
const M = {
  yel: mat(0xe2ac14, { roughness: 0.55 }), blk: mat(0x141414, { roughness: 0.6 }), leg: mat(0x6e2c1f, { roughness: 0.7 }),
  steel: mat(0x8d9399, { roughness: 0.45, metalness: 0.6 }), wood: mat(0x9b7a4c), dkwood: mat(0x5a4128),
  pallet: mat(0xffffff, { map: TX.pallet }), ply: mat(0xc9a676), white: mat(0xf0f0ec, { roughness: 0.6 }),
  red: mat(0xb0201c, { roughness: 0.6 }), redPl: mat(0xc0281e, { roughness: 0.5 }), concrete: mat(0xaaa69c, { roughness: 0.95 }),
  roof: mat(0x5d6166, { roughness: 0.7, metalness: 0.2 }), beige: mat(0xd6cbb2), glass: mat(0x1d2a33, { roughness: 0.15, metalness: 0.4 }),
  dark: mat(0x1c1610, { roughness: 1 }), inner: mat(0x6a6a6a, { map: TX.pallet, roughness: 1 }), pipe: mat(0x3b3f44, { roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide }),
  cone: mat(0xff6a10, { roughness: 0.6 }), sand: mat(0xb39b6c, { roughness: 1 }), olive: mat(0x4f5530),
  camo: mat(0xffffff, { map: TX.camo }), wheel: mat(0x1e2414), barrel: mat(0x272d1c, { roughness: 0.6 }),
  pole: mat(0xffffff, { map: TX.pole, roughness: 0.6 }), panel: mat(0xffffff, { map: TX.panel, roughness: 0.6 }),
  sil: mat(0xffffff, { map: TX.sil, alphaTest: 0.5, side: THREE.DoubleSide }), berm: mat(0x6f7b45, { roughness: 1 }),
  brick: mat(0x8f5a44, { roughness: 0.95 }), grey: mat(0x8c8f90), green: mat(0x2f5a33), tape: mat(0xf2d21a, { roughness: 0.7 })
};
const silDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: TX.sil, alphaTest: 0.5 });

// ---------------- ground ----------------
const GD0 = -400, GD1 = 800, GS0 = -600, GS1 = 600, GSZ = 1200, GPX = 2048, GK = GPX / GSZ;
const SITE_L = SITE_PRE, SITE = SITE_L.site, SITE_KEY0 = SITE.flat ? '' : '@' + SITE.id, SITE_KEY = SITE_KEY0 + (!SITE.flat && SITE.course && SITE.course.v > 1 ? 'v' + SITE.course.v : '');   // 코스 배치가 바뀌면 기록 따로          // 현재 지형(현장)
const VEC = SITE.vec || null;
const CRS_C = SITE.course || null;   // 경로 따라 배치한 전용 코스   // 수치지형도 벡터 (도로·하천·경지·건물)
function gpx(down, side) { return [(side - GS0) * GK, (GD1 - down) * GK]; }
const groundMacro = canvasTex(GPX, GPX, (g, w, h) => {
  const rr = rng(42);
  noiseFill(g, w, h, '#857f52', ['#7a8546', '#9a8c5c', '#6c773e', '#a6966c', '#8a8450', '#76703f'], 2600, 4, 70, 0.32, rr);
  const rect = (d0, d1, s0, s1, col, a, jit, passes) => {
    for (let p = 0; p < passes; p++) {
      const j = () => (rr() - 0.5) * jit;
      const [x0, y0] = gpx(d1 + j(), s0 + j()); const [x1, y1] = gpx(d0 + j(), s1 + j());
      g.globalAlpha = a; g.fillStyle = col; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    g.globalAlpha = 1;
  };
  // 넓은 농경지·잔디 구획 (멀리)
  for (let i = 0; i < (VEC ? 0 : 60); i++) {
    const d = GD0 + rr() * GSZ, s = GS0 + rr() * GSZ;
    if (d > -80 && d < 420 && s > -120 && s < 90) continue;
    rect(d, d + 40 + rr() * 120, s, s + 40 + rr() * 140, ['#6f7d40', '#8d8a58', '#5f6e38', '#9c9468'][Math.floor(rr() * 4)], 0.35, 4, 2);
  }
  if (CRS_C) {   // 경로를 따라 흙길 + 출발 구역 자갈
    const P = CRS_C.path; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, c, a] of [[34, '#a48c66', 0.2], [14, '#a48c66', 0.25], [3.5, '#9c8a68', 0.35]]) {
      g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w * GK; g.beginPath(); P.forEach((q, i) => { const p = gpx(q[0], q[1]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke();
    }
    g.globalAlpha = 1;
  }
  if (!CRS_C) rect(-6, 335, -18, 18, '#a48c66', 0.22, 5, 6);          // 드론 레인 흙
  if (!CRS_C) {
  rect(0, 365, -66, -31, '#76854a', 0.25, 4, 4);          // 옆 레인 잔디
  rect(-16, 7, -24, 24, '#a29a86', 0.35, 2, 3);           // 출발 구역 자갈
  rect(-66, -48, -48, 22, '#b2ada2', 0.45, 1, 2);          // 건물 콘크리트
  }
  if (!VEC) rect(-46, -39, -260, 260, '#9e978a', 0.75, 0.5, 2);      // 도로 (기본 코스)
  if (!CRS_C) rect(-14, -3, -60, -40, '#a49c8a', 0.4, 1, 2);           // 사대(FP) 앞
  // 바퀴 자국
  g.strokeStyle = 'rgba(120,98,70,.35)'; g.lineWidth = 2;
  if (!CRS_C) for (const s of [-1.2, 1.2, 7.8, 10.2]) { g.beginPath(); const a = gpx(-4, s), b = gpx(330, s + (rr() - 0.5) * 3); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  if (VEC) paintVectors(g);
});
// 수치지형도 벡터를 바닥 텍스처에 그림 (코스 통로 안쪽은 정지된 터라 생략)
function paintVectors(g) {
  const path = (a, close) => { g.beginPath(); for (let i = 0; i < a.length; i += 2) { const p = gpx(a[i], a[i + 1]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } if (close) g.closePath(); };
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  // 경지 (밭·논): 옅은 녹갈색 채움 + 경계
  for (const a of VEC.field || []) { path(a, true); g.globalAlpha = 0.28; g.fillStyle = '#7f8a45'; g.fill(); g.globalAlpha = 0.5; g.strokeStyle = '#5f5a35'; g.lineWidth = 1.2; g.stroke(); }
  // 하천 (중심선)
  g.globalAlpha = 0.7; g.strokeStyle = '#4c5a52'; g.lineWidth = 2.2 * GK; for (const a of VEC.stream || []) { path(a); g.stroke(); }
  g.globalAlpha = 0.5; g.strokeStyle = '#6f8288'; g.lineWidth = 0.9 * GK; for (const a of VEC.stream || []) { path(a); g.stroke(); }
  // 소로·임도 (중심선)
  g.globalAlpha = 0.75; g.strokeStyle = '#a89878'; g.lineWidth = 3.0 * GK; for (const a of VEC.trail || []) { path(a); g.stroke(); }
  // 도로 경계선
  g.globalAlpha = 0.85; g.strokeStyle = '#8c877c'; g.lineWidth = 0.8 * GK; for (const a of VEC.road || []) { path(a); g.stroke(); }
  g.restore();
}
groundMacro.wrapS = groundMacro.wrapT = THREE.ClampToEdgeWrapping;
const groundDetail = canvasTex(256, 256, (g, w, h) => {
  const id = g.createImageData(w, h); const rr = rng(9);
  for (let i = 0; i < w * h; i++) { const v = 150 + rr() * 105; id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rr() < .5 ? 70 : 255},${rr() < .5 ? 70 : 255},60,${0.08 + rr() * 0.1})`; g.beginPath(); g.arc(rr() * w, rr() * h, 2 + rr() * 9, 0, 7); g.fill(); }
}, { srgb: false });
const groundMat = new THREE.MeshStandardMaterial({ map: groundMacro, roughness: 0.97 });
const detailK = { value: 1.0 };
groundMat.onBeforeCompile = sh => {
  sh.uniforms.detail = { value: groundDetail }; sh.uniforms.detailK = detailK;
  sh.fragmentShader = 'uniform sampler2D detail; uniform float detailK;\n' + sh.fragmentShader.replace('#include <map_fragment>',
    '#include <map_fragment>\n vec3 dA = texture2D(detail, vUv * 240.0).rgb; vec3 dB = texture2D(detail, vUv * 37.0).rgb;\n' +
    ' diffuseColor.rgb *= mix(vec3(1.0), (dA * 0.55 + 0.45) * (dB * 0.45 + 0.55) * 1.12, detailK);');
};
const TER = { n: 241, step: GSZ / 240, h: SITE_L.dec ? SITE_L.dec.inner : null };   // 코스 주변 고해상도 지형 (5 m)
if (TER.h) { scene.fog.near = 180; scene.fog.far = 6500; camera.far = 9000; camera.updateProjectionMatrix(); }
// 지형 조각 나누기: 큰 지형 메시 하나를 격자 조각(인덱스만 따로, 꼭짓점 버퍼는 공유)으로 나눠 시야 밖 조각은 그리지 않음
//   돌려주는 Group 은 .geometry(전체 지오메트리)·.userData.chunks·.userData.refresh()(높이 바뀐 뒤 경계구 다시 계산) 를 가짐
function chunkify(mesh, nx, nz) {
  const geo = mesh.geometry, pos = geo.attributes.position, idx = geo.index ? geo.index.array : null; if (!idx) return mesh;
  const bb = new THREE.Box3().setFromBufferAttribute(pos), ext = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
  const ax = [0, 1, 2].sort((a, b) => ext[b] - ext[a]).slice(0, 2).sort(), A = ax[0], B = ax[1], mn = [bb.min.x, bb.min.y, bb.min.z];
  const buckets = []; for (let i = 0; i < nx * nz; i++) buckets.push([]);
  const P = pos.array, g = i => [P[i * 3 + A], P[i * 3 + B]];
  for (let k = 0; k < idx.length; k += 3) { const a = g(idx[k]), b = g(idx[k + 1]), c = g(idx[k + 2]); const u = (a[0] + b[0] + c[0]) / 3 - mn[A], v = (a[1] + b[1] + c[1]) / 3 - mn[B];
    const bx = Math.min(nx - 1, Math.max(0, Math.floor(u / ext[A] * nx))), bz = Math.min(nz - 1, Math.max(0, Math.floor(v / ext[B] * nz))); buckets[bz * nx + bx].push(idx[k], idx[k + 1], idx[k + 2]); }
  const grp = new THREE.Group(); grp.position.copy(mesh.position); grp.rotation.copy(mesh.rotation); grp.scale.copy(mesh.scale); grp.geometry = geo; grp.material = mesh.material; grp.userData.chunks = [];
  for (const b of buckets) { if (!b.length) continue; const cg = new THREE.BufferGeometry(); for (const nm in geo.attributes) cg.setAttribute(nm, geo.attributes[nm]); cg.setIndex(b);
    const m = new THREE.Mesh(cg, mesh.material); m.castShadow = mesh.castShadow; m.receiveShadow = mesh.receiveShadow; m.userData.irBase = mesh.userData.irBase; grp.add(m); grp.userData.chunks.push(m); }
  grp.userData.refresh = () => { const v = new V3(); for (const m of grp.userData.chunks) { const ii = m.geometry.index.array, box = new THREE.Box3(); for (let k = 0; k < ii.length; k++) box.expandByPoint(v.fromBufferAttribute(pos, ii[k])); m.geometry.boundingBox = box; m.geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere()); } };
  grp.userData.refresh(); if (mesh.parent) { mesh.parent.add(grp); mesh.parent.remove(mesh); }
  return grp;
}
const ground = (() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(GSZ, GSZ, 240, 240), groundMat);
  m.rotation.x = -Math.PI / 2; m.position.set((GS0 + GS1) / 2, 0, -(GD0 + GD1) / 2); m.receiveShadow = true; scene.add(m); return chunkify(m, 6, 6); })();
let MIDH = null;   // 고해상도 구역 밖 높이 (중간 지형이 만들어지면 채워짐)
function terrainAt(x, z) {
  if (!TER.h) return MIDH && (x < GS0 || x > GS1 || -z < GD0 || -z > GD1) ? MIDH(x, z) : 0;
  const fx = (x - GS0) / TER.step, fy = (GD1 + z) / TER.step;
  if (fx < 0 || fy < 0 || fx >= TER.n - 1 || fy >= TER.n - 1) return MIDH ? MIDH(x, z) : 0;
  const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, n = TER.n, H = TER.h;
  return (H[iy * n + ix] * (1 - ax) + H[iy * n + ix + 1] * ax) * (1 - ay) + (H[(iy + 1) * n + ix] * (1 - ax) + H[(iy + 1) * n + ix + 1] * ax) * ay;
}
function applyTerrain(h) {
  TER.h = h; const pos = ground.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, h ? h[i] : 0);
  pos.needsUpdate = true; ground.geometry.computeVertexNormals(); ground.geometry.computeBoundingSphere(); if (ground.userData.refresh) ground.userData.refresh();
  // 산지 숲 색: 경사가 있는 곳은 짙은 녹색으로 (코스 통로·경지는 그대로)
  if (h) {
    const nr = ground.geometry.attributes.normal, n = TER.n, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const ix = i % n, iy = (i / n) | 0, side = GS0 + ix * TER.step, down = GD1 - iy * TER.step;
      const slope = 1 - nr.getY(i), pi = CRS_C && pathInfo(down, side), corr = pi ? pi.dist < 25 : (down > -80 && down < 385 && side > -80 && side < 30);
      let f = smooth01(0.015, 0.06, slope) * (corr ? 0.15 : 1);
      if (SITE.trees && !corr) f = Math.max(f, 0.45);
      f *= 0.75 + 0.25 * Math.sin(side * 0.05 + Math.cos(down * 0.043) * 2);
      col[i * 3] = 1 - f * 0.62; col[i * 3 + 1] = 1 - f * 0.42; col[i * 3 + 2] = 1 - f * 0.6;
    }
    const ca = new THREE.BufferAttribute(col, 3); ground.geometry.setAttribute('color', ca); if (ground.userData.chunks) ground.userData.chunks.forEach(c => c.geometry.setAttribute('color', ca)); groundMat.vertexColors = true; groundMat.needsUpdate = true;
  }
}
if (TER.h) applyTerrain(TER.h);
// 원경 지형 (주변 12 km, 현장별 격자 · 기본 60 m) — 고해상도 구역은 구멍으로 비움
const FAR = (function farTerrain() {
  if (!SITE_L.dec) return null;
  const G = Object.assign({}, TGRID, SITE.farGrid || {}), n = G.farN, H = SITE_L.dec.far, pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) { const i = iy * n + ix; pos[i * 3] = G.fs0 + ix * G.farStep; pos[i * 3 + 1] = H[i]; pos[i * 3 + 2] = -(G.fd1 - iy * G.farStep); }
  const i0x = (GS0 - G.fs0) / G.farStep, i1x = (GS1 - G.fs0) / G.farStep, i0y = (G.fd1 - GD1) / G.farStep, i1y = (G.fd1 - GD0) / G.farStep;
  const idx = [];
  for (let iy = 0; iy < n - 1; iy++) for (let ix = 0; ix < n - 1; ix++) {
    if (ix >= i0x && ix < i1x && iy >= i0y && iy < i1y) continue;
    const a = iy * n + ix, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const nr = geo.attributes.normal; let mn = 1e9, mx = -1e9; for (const v of H) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (let i = 0; i < n * n; i++) {
    const slope = 1 - nr.getY(i), t = (H[i] - mn) / Math.max(1, mx - mn);
    // 낮은 곳 = 논밭 녹색, 높은 곳·급경사 = 짙은 숲/바위
    const nz = Math.sin(pos[i * 3] * 0.013) * Math.cos(pos[i * 3 + 2] * 0.011) * 0.5 + 0.5;   // 숲·밭 얼룩
    let r = 0.36 - t * 0.14 - nz * 0.05, g = 0.40 - t * 0.12 - nz * 0.03, b = 0.22 - t * 0.08;
    const f = Math.min(1, slope * (SITE.trees ? 9 : 4.0) + (SITE.trees ? t * 0.8 : 0)); r = r * (1 - f) + 0.13 * f; g = g * (1 - f) + 0.20 * f; b = b * (1 - f) + 0.10 * f;
    col[i * 3] = Math.pow(r, 2.2); col[i * 3 + 1] = Math.pow(g, 2.2); col[i * 3 + 2] = Math.pow(b, 2.2);   // sRGB -> 선형
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = false; scene.add(m); return chunkify(m, 4, 4);
})();
// ---- 중간 지형: 비행 구역(반경 약 1 km)을 덮는 10 m 격자 · 원경 격자를 부드럽게 보간 + 잔기복 · 고해상도 구역 경계는 이어 붙임 ----
const MID = (function midTerrain() {
  const SYN = !(SITE_L.dec && SITE_L.dec.far && TER.h);   // 높이 자료 없는 평지 사이트: 완만한 기복 + 낮은 숲 언덕을 임의로
  if (SYN && TER.h) return null;
  const G = Object.assign({}, TGRID, SITE.farGrid || {}), FN = G.farN, fs = G.farStep;
  let FH = SYN ? null : SITE_L.dec.far;
  if (SYN) { const rr = rng(4412), hills = []; for (let k = 0; k < 9; k++) { const a = rr() * 6.283, d = 780 + rr() * 330; hills.push([Math.sin(a) * d, -150 - Math.cos(a) * d, 18 + rr() * 30, 160 + rr() * 160]); }
    FH = new Float32Array(FN * FN); for (let iy = 0; iy < FN; iy++) for (let ix = 0; ix < FN; ix++) { const x = G.fs0 + ix * fs, z = -(G.fd1 - iy * fs); let h = Math.sin(x * 0.004) * Math.cos(z * 0.0035) * 1.6;
      for (const [hx, hz, A, R] of hills) h += A * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (R * R)); const din = Math.max(GS0 - x, x - GS1, GD0 + z, -z - GD1, 0); const fo = clamp((1180 - Math.max(Math.abs(x), Math.abs(z + 150))) / 160, 0, 1); FH[iy * FN + ix] = h * Math.min(1, din / 250) * fo; } }   /* 중간 지형 상자 끝에서는 0 (바깥 평지와 이어짐) */
  const sn = (v, o) => Math.round((v - o) / fs) * fs + o;
  const s0 = sn(-1260, G.fs0), s1 = sn(1260, G.fs0), d1 = G.fd1 - Math.round((G.fd1 - 1420) / fs) * fs, d0 = G.fd1 - Math.round((G.fd1 + 1120) / fs) * fs;
  const fA = (ix, iy) => FH[clamp(iy, 0, FN - 1) * FN + clamp(ix, 0, FN - 1)];
  const cub = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const farBic = (x, z) => { const fx = (x - G.fs0) / fs, fy = (G.fd1 + z) / fs, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, r = [];
    for (let k = -1; k <= 2; k++) r.push(cub(fA(ix - 1, iy + k), fA(ix, iy + k), fA(ix + 1, iy + k), fA(ix + 2, iy + k), tx)); return cub(r[0], r[1], r[2], r[3], ty); };
  const farLin = (x, z) => { const fx = (x - G.fs0) / fs, fy = (G.fd1 + z) / fs, ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
    return (fA(ix, iy) * (1 - ax) + fA(ix + 1, iy) * ax) * (1 - ay) + (fA(ix, iy + 1) * (1 - ax) + fA(ix + 1, iy + 1) * ax) * ay; };
  const nz = (x, z) => Math.sin(x * 0.021 + Math.cos(z * 0.017) * 2) * Math.cos(z * 0.019 - Math.sin(x * 0.013)) * 1.1 + Math.sin(x * 0.067 + z * 0.051) * 0.35;   /* 잔기복 */
  const st = 10, nx = Math.round((s1 - s0) / st) + 1, ny = Math.round((d1 - d0) / st) + 1, H = new Float32Array(nx * ny);
  const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const s = s0 + ix * st, d = d1 - iy * st, x = s, z = -d;
    const ein = Math.max(GS0 - s, s - GS1, GD0 - d, d - GD1, 0), eout = Math.min(s - s0, s1 - s, d - d0, d1 - d);
    let h = farBic(x, z) + nz(x, z) * sm(ein / 120) * sm(eout / 120);
    if (ein < 90) { const cx = clamp(s, GS0 + 1, GS1 - 1), cd = clamp(d, GD0 + 1, GD1 - 1), hi = TER.h ? terrainAt(cx, -cd) : 0; h = hi + (h - hi) * sm(ein / 90); }   /* 고해상도 구역 가장자리에 맞춤 */
    if (eout < 60) h = farLin(x, z) + (h - farLin(x, z)) * sm(eout / 60);   /* 원경 지형에 맞춤 */
    H[iy * nx + ix] = h;
  }
  const at = (x, z) => { const fx = (x - s0) / st, fy = (d1 + z) / st; if (fx < 0 || fy < 0 || fx >= nx - 1 || fy >= ny - 1) return farLin(x, z);
    const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy; return (H[iy * nx + ix] * (1 - ax) + H[iy * nx + ix + 1] * ax) * (1 - ay) + (H[(iy + 1) * nx + ix] * (1 - ax) + H[(iy + 1) * nx + ix + 1] * ax) * ay; };
  // 그물: 고해상도 구역은 구멍 · 지면 무늬는 캔버스(2048²)에 토지 이용을 그려 씌움 (game6)
  const pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), idx = [];
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) { const i = iy * nx + ix; pos[i * 3] = s0 + ix * st; pos[i * 3 + 1] = H[i]; pos[i * 3 + 2] = -(d1 - iy * st); uv[i * 2] = ix / (nx - 1); uv[i * 2 + 1] = 1 - iy / (ny - 1); }
  for (let iy = 0; iy < ny - 1; iy++) for (let ix = 0; ix < nx - 1; ix++) { const s = s0 + (ix + 0.5) * st, d = d1 - (iy + 0.5) * st; if (s > GS0 && s < GS1 && d > GD0 && d < GD1) continue;
    const a = iy * nx + ix, b = a + 1, c = a + nx, e = c + 1; idx.push(a, c, b, b, c, e); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const cv = document.createElement('canvas'); cv.width = cv.height = 2048; const cg = cv.getContext('2d'); cg.fillStyle = '#5f6b3e'; cg.fillRect(0, 0, 2048, 2048);
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  const mesh0 = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); mesh0.receiveShadow = true; scene.add(mesh0); const mesh = chunkify(mesh0, 4, 4);
  // 원경 그물: 중간 지형 상자 안은 비움 (조각별 인덱스에서 걸러냄)
  if (FAR) { const n = FN; for (const ch of (FAR.userData.chunks || [FAR])) { const fi = ch.geometry.index.array, keep = [];
    const FP = FAR.geometry.attributes.position.array;
    for (let k = 0; k < fi.length; k += 3) { const s = (FP[fi[k] * 3] + FP[fi[k + 1] * 3] + FP[fi[k + 2] * 3]) / 3, d = -(FP[fi[k] * 3 + 2] + FP[fi[k + 1] * 3 + 2] + FP[fi[k + 2] * 3 + 2]) / 3; if (s > s0 && s < s1 && d > d0 && d < d1) continue; for (let j = 0; j < 3; j++) keep.push(fi[k + j]); }
    ch.geometry.setIndex(keep); } if (FAR.userData.refresh) FAR.userData.refresh(); }
  MIDH = at;
  return { s0, s1, d0, d1, st, nx, ny, H, at, cv, cg, tex, mesh, uvOf: (x, z) => [(x - s0) / (s1 - s0) * 2048, (d1 + z) / (d1 - d0) * 2048] };
})();
const farGround = new THREE.Mesh(new THREE.RingGeometry(800, 4000, 48), mat(0x7d7a55, { roughness: 1 }));
farGround.rotation.x = -Math.PI / 2; farGround.position.set(0, -0.05, -200); scene.add(farGround);
if (FAR) farGround.visible = false;

// 풀 덤불 (속도감)
const GRASS = (function grass() {
  // 가는 풀잎 3장 묶음
  const p = [];
  for (let k = 0; k < 3; k++) { const a = k * 2.1, c = Math.cos(a), sn = Math.sin(a), w = 0.035, lean = 0.06;
    p.push(-w * c, 0, -w * sn, w * c, 0, w * sn, lean * sn, 0.28, -lean * c); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.computeVertexNormals();
  const N = LOWQ ? 9000 : 30000; const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); const rr = rng(77);
  let i = 0;
  while (i < N) {
    let d = -14 + rr() * 350, s = -78 + rr() * 125;
    if (CRS_C) { const P = CRS_C.path, q = P[Math.floor(rr() * P.length)]; const sp = SITE.trees ? 26 : 120; d = q[0] + (rr() - 0.5) * sp; s = q[1] + (rr() - 0.5) * sp; const pd = W(10, -5, 0); if (Math.hypot(s - pd.x, -d - pd.z) < 9) continue; }
    else if (d > -16 && d < 14 && s > -9 && s < 9) continue;          // 출발 구역(패드·로고) 제외
    const sc = 0.6 + rr() * 0.9;
    q.setFromAxisAngle(new V3(0, 1, 0), rr() * 6.28);
    m4.compose(W(d, s, 0), q, new V3(sc, sc * (0.6 + rr() * 0.9), sc)); im.setMatrixAt(i, m4);
    if (SITE.trees) c.setHSL(0.17 + rr() * 0.1, 0.3 + rr() * 0.2, 0.13 + rr() * 0.1); else c.setHSL(0.13 + rr() * 0.08, 0.28 + rr() * 0.2, 0.17 + rr() * 0.12); im.setColorAt(i, c); i++;
  }
  im.receiveShadow = true; im.userData.irBase = 0.25; scene.add(im); return im;
})();
// 지형을 고친 뒤 풀 높이 다시 맞춤
function grassRefit() { const a = GRASS.instanceMatrix.array; for (let i = 0; i < GRASS.count; i++) a[i * 16 + 13] = terrainAt(a[i * 16 + 12], a[i * 16 + 14]); GRASS.instanceMatrix.needsUpdate = true; }

// 먼 나무 띠·언덕
// 나무 (줄기 + 뭉친 수관) · 먼 언덕
const SHOW_TREES = false;   // 실제 현장에 나무가 없어 끔 (true 로 바꾸면 다시 표시)
const TREES = [];
(function makeTrees() {
  const rr = rng(21);
  const inCorr = (d, s) => d > -75 && d < 385 && s > -105 && s < 60;
  const add = (d, s, k) => { if (!SHOW_TREES) return; if (inCorr(d, s) || (d > -50 && d < -36)) return; TREES.push({ d, s, h: (k || 1) * (7 + rr() * 8), r: 2.2 + rr() * 2.2, c: rr(), seed: rr() }); };
  // 밭 경계를 따라 늘어선 나무 줄
  for (let i = 0; i < 26; i++) {
    const vertical = rr() < 0.5, base = (rr() - 0.5) * 1000, a0 = -350 + rr() * 900, len = 80 + rr() * 260;
    for (let t = 0; t < len; t += 5 + rr() * 6) { const j = (rr() - 0.5) * 3; vertical ? add(a0 + t, base + j) : add(base + 200 + j, a0 - 300 + t); }
  }
  // 군데군데 숲
  for (let i = 0; i < 22; i++) { const cd = -350 + rr() * 1100, cs = -560 + rr() * 1120, R = 15 + rr() * 45; for (let k = 0; k < 18; k++) { const a = rr() * 6.28, r = Math.sqrt(rr()) * R; add(cd + Math.cos(a) * r, cs + Math.sin(a) * r, 1.15); } }
  // 먼 숲 띠
  for (let i = 0; i < 420; i++) { const a = rr() * Math.PI * 2, r = 600 + rr() * 220; add(200 - Math.sin(a) * r, Math.cos(a) * r, 1.2); }
})();
const crownGeo = (function () { const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position, rr = rng(5);
  for (let i = 0; i < p.count; i++) { const v = new V3().fromBufferAttribute(p, i); const k = 0.82 + rr() * 0.3; p.setXYZ(i, v.x * k, v.y * k * 0.9, v.z * k); }
  g.computeVertexNormals(); return g; })();
const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1, 6); trunkGeo.translate(0, 0.5, 0);
const crownIM = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), Math.max(1, TREES.length * 3));
crownIM.count = TREES.length * 3;
const trunkIM = new THREE.InstancedMesh(trunkGeo, mat(0x4a3826, { roughness: 1 }), Math.max(1, TREES.length));
trunkIM.count = TREES.length;
crownIM.castShadow = true; crownIM.receiveShadow = true; trunkIM.castShadow = true;
scene.add(crownIM); scene.add(trunkIM);
function placeTrees() {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  TREES.forEach((t, i) => {
    const p = W(t.d, t.s, 0); p.y = terrainAt(p.x, p.z) - 0.2;
    const th = t.h * 0.42; m4.compose(p, q, new V3(1 + t.r * 0.08, th, 1 + t.r * 0.08)); trunkIM.setMatrixAt(i, m4);
    const rr = rng(Math.floor(t.seed * 1e6));
    for (let k = 0; k < 3; k++) {
      const off = new V3((rr() - 0.5) * t.r * 0.9, th + t.r * (0.55 + k * 0.38), (rr() - 0.5) * t.r * 0.9);
      const sc = t.r * (1 - k * 0.2) * (0.85 + rr() * 0.3);
      q.setFromAxisAngle(new V3(0, 1, 0), rr() * 6.28);
      m4.compose(p.clone().add(off), q, new V3(sc, sc * (1.0 + rr() * 0.3), sc)); crownIM.setMatrixAt(i * 3 + k, m4);
      c.setHSL(0.2 + t.c * 0.09, 0.26 + rr() * 0.14, 0.11 + t.c * 0.06 + k * 0.012); crownIM.setColorAt(i * 3 + k, c);
    }
    q.identity();
  });
  crownIM.instanceMatrix.needsUpdate = true; trunkIM.instanceMatrix.needsUpdate = true; if (crownIM.instanceColor) crownIM.instanceColor.needsUpdate = true;
}
placeTrees();
// (먼 언덕은 실제 현장과 달라 제거함)

// ---------------- colliders ----------------
const COLL = [];
const _p = new V3(), _q = new THREE.Quaternion(), _s = new V3();
function boxCol(mesh, tag) {
  mesh.updateMatrixWorld(true);
  mesh.matrixWorld.decompose(_p, _q, _s);
  const c = { t: 'box', c: _p.clone(), q: _q.clone(), inv: new THREE.Matrix4().compose(_p, _q, new V3(1, 1, 1)).invert(), h: _s.clone().multiplyScalar(0.5), tag };
  c.bnd = c.h.length(); COLL.push(c); return c;
}
function updBoxCol(c, mesh) {
  mesh.updateMatrixWorld(true); mesh.matrixWorld.decompose(_p, _q, _s);
  c.c.copy(_p); c.q.copy(_q); c.inv.compose(_p, _q, new V3(1, 1, 1)).invert();
}
function capCol(a, b, r, tag) { const c = { t: 'cap', a, b, r, c: a.clone().add(b).multiplyScalar(0.5), bnd: a.distanceTo(b) / 2 + r, tag }; COLL.push(c); return c; }
function torusCol(center, n, Rr, r, tag) { COLL.push({ t: 'tor', c: center, n, R: Rr, r, bnd: Rr + r, tag }); }
function tubeCol(a, b, rin, rout, tag) { const c = { t: 'tube', a, b, u: b.clone().sub(a).normalize(), L: a.distanceTo(b), rin, rout, c: a.clone().add(b).multiplyScalar(0.5), tag }; c.bnd = c.L / 2 + rout; COLL.push(c); }
const _v = new V3(), _w = new V3(), _cp = new V3();
function closestOnSeg(p, a, b, out) {
  _w.subVectors(b, a); const L2 = _w.lengthSq(); let t = L2 > 0 ? _v.subVectors(p, a).dot(_w) / L2 : 0; t = clamp(t, 0, 1);
  return out.copy(a).addScaledVector(_w, t);
}
function collide(p, Rr, filter) {
  let best = null;
  for (const c of COLL) {
    if (c.off) continue;
    if (filter && !filter(c)) continue;
    const dx = p.x - c.c.x, dy = p.y - c.c.y, dz = p.z - c.c.z;
    const lim = c.bnd + Rr; if (dx * dx + dy * dy + dz * dz > lim * lim) continue;
    let pen = 0; const n = new V3();
    if (c.t === 'box') {
      const lp = _v.copy(p).applyMatrix4(c.inv);
      const cx = clamp(lp.x, -c.h.x, c.h.x), cy = clamp(lp.y, -c.h.y, c.h.y), cz = clamp(lp.z, -c.h.z, c.h.z);
      n.set(lp.x - cx, lp.y - cy, lp.z - cz); const d = n.length();
      if (d >= Rr) continue;
      if (d > 1e-6) { n.divideScalar(d); pen = Rr - d; }
      else {
        const ex = c.h.x - Math.abs(lp.x), ey = c.h.y - Math.abs(lp.y), ez = c.h.z - Math.abs(lp.z);
        if (ex <= ey && ex <= ez) { n.set(Math.sign(lp.x) || 1, 0, 0); pen = Rr + ex; }
        else if (ey <= ez) { n.set(0, Math.sign(lp.y) || 1, 0); pen = Rr + ey; }
        else { n.set(0, 0, Math.sign(lp.z) || 1); pen = Rr + ez; }
      }
      n.applyQuaternion(c.q);
    } else if (c.t === 'cap') {
      closestOnSeg(p, c.a, c.b, _cp); n.subVectors(p, _cp); const d = n.length(); const lim2 = c.r + Rr;
      if (d >= lim2) continue; pen = lim2 - d; if (d > 1e-6) n.divideScalar(d); else n.set(0, 1, 0);
    } else if (c.t === 'tor') {
      _v.subVectors(p, c.c); const h = _v.dot(c.n); _w.copy(_v).addScaledVector(c.n, -h); let rl = _w.length();
      if (rl < 1e-6) { _w.set(1, 0, 0); rl = 1; }
      _cp.copy(c.c).addScaledVector(_w, c.R / rl); n.subVectors(p, _cp); const d = n.length(); const lim2 = c.r + Rr;
      if (d >= lim2) continue; pen = lim2 - d; n.divideScalar(Math.max(d, 1e-6));
    } else if (c.t === 'tube') {
      _v.subVectors(p, c.a); const t = _v.dot(c.u); _w.copy(_v).addScaledVector(c.u, -t); let rl = _w.length();
      const rdir = rl > 1e-6 ? _w.clone().divideScalar(rl) : new V3(0, 1, 0);
      const tc = clamp(t, 0, c.L), rc = clamp(rl, c.rin, c.rout);
      _cp.copy(c.a).addScaledVector(c.u, tc).addScaledVector(rdir, rc);
      n.subVectors(p, _cp); const d = n.length(); if (d >= Rr) continue;
      pen = Rr - d; if (d > 1e-6) n.divideScalar(d); else n.copy(rdir).multiplyScalar(rl < (c.rin + c.rout) / 2 ? -1 : 1);
    }
    if (!best || pen > best.pen) best = { pen, n, c };
  }
  return best;
}

// ---------------- object builder ----------------
const UBOX = new THREE.BoxGeometry(1, 1, 1);
const UCYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const UCYL6 = new THREE.CylinderGeometry(1, 1, 1, 7);
const UCYL40 = new THREE.CylinderGeometry(1, 1, 1, 40);
const USPH = new THREE.SphereGeometry(1, 20, 12), UCAP = new THREE.CapsuleGeometry(1, 1, 6, 16);
const OBJ = {};
class Obj {
  constructor(o, tag) {
    this.o = o; this.tag = tag || o.type; this.g = new THREE.Group(); scene.add(this.g);
    this.g.position.copy(W(o.down, o.side, 0)); this.g.rotation.y = num(o.yaw, 0) * DEG;
    this.g.updateMatrixWorld(true); this.inv = this.g.matrixWorld.clone().invert();
    if (o.id) OBJ[o.id] = this;
  }
  L(lx, ly, lz) { return new V3(lx, lz, -ly); }
  world(lx, ly, lz) { return this.L(lx, ly, lz).applyMatrix4(this.g.matrixWorld); }
  local(p) { const v = _v.copy(p).applyMatrix4(this.inv); return { lx: v.x, ly: -v.z, lz: v.y }; }
  add(m, shadow) { m.castShadow = shadow !== false; m.receiveShadow = true; this.g.add(m); return m; }
  box(lx, ly, lz, sx, sy, sz, m, opt) {
    opt = opt || {};
    const me = new THREE.Mesh(opt.geo || UBOX, m); me.position.set(lx, lz, -ly); me.scale.set(sx, sz, sy);
    if (opt.rz) me.rotation.z = opt.rz; if (opt.ry) me.rotation.y = opt.ry;
    this.add(me, opt.shadow);
    if (opt.col !== false) boxCol(me, opt.tag || this.tag);
    return me;
  }
  bar(a, b, r, m, opt) {
    opt = opt || {};
    const A = this.L(a[0], a[1], a[2]), B = this.L(b[0], b[1], b[2]);
    const me = new THREE.Mesh(opt.square ? UBOX : UCYL6, m);
    me.position.copy(A).add(B).multiplyScalar(0.5);
    me.scale.set(opt.square ? 2 * r : r, A.distanceTo(B), opt.square ? 2 * r : r);
    me.quaternion.setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize());
    this.add(me, opt.shadow);
    if (opt.col !== false) capCol(this.g.localToWorld(A.clone()), this.g.localToWorld(B.clone()), r * (opt.square ? 1.2 : 1), opt.tag || this.tag);
    return me;
  }
  cyl(lx, ly, lz, r, h, m, opt) {
    opt = opt || {};
    const me = new THREE.Mesh(opt.geo || UCYL, m); me.position.set(lx, lz, -ly); me.scale.set(r, h, r);
    this.add(me, opt.shadow);
    if (opt.col !== false) capCol(this.world(lx, ly, lz - h / 2 + Math.min(r, h / 2)), this.world(lx, ly, lz + h / 2 - Math.min(r, h / 2)), r, opt.tag || this.tag);
    return me;
  }
  // 노랑/검정 띠 막대 (프레임) - 물체 로컬 xz 평면 (ly 고정)
  stripeBar(x0, z0, x1, z1, ly, t, seg) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / seg));
    for (let i = 0; i < n; i++) {
      const a0 = i / n, a1 = (i + 1) / n;
      const me = new THREE.Mesh(UBOX, i % 2 ? M.blk : M.yel);
      me.position.set(lerp(x0, x1, (a0 + a1) / 2), lerp(z0, z1, (a0 + a1) / 2), -ly);
      me.scale.set(L / n + 0.002, t, t); me.rotation.z = Math.atan2(z1 - z0, x1 - x0); this.add(me);
    }
    capCol(this.world(x0, ly, z0), this.world(x1, ly, z1), t * 0.6, this.tag);
  }
}

// ---------------- builders ----------------
const PADS = [];
function buildPad(o) {
  const b = new Obj(o), dia = num(o.dia, 1.2), PH = 0.14;
  b.box(-dia * 0.42, 0.03, PH / 2, 1.1, 1.1, PH, M.pallet, { col: false });
  b.box(dia * 0.46, -0.04, PH / 2, 1.1, 1.1, PH, M.pallet, { col: false });
  b.cyl(0, 0, PH + 0.01, dia / 2, 0.02, M.ply, { col: false, geo: UCYL40 });
  const Hh = dia * 0.7, Hw = dia * 0.6, st = dia * 0.135, zt = PH + 0.0225;
  for (const sx of [-1, 1]) b.box(sx * (Hw / 2 - st / 2), 0, zt, st, Hh, 0.005, M.white, { col: false, shadow: false });
  b.box(0, 0, zt, Hw - 2 * st + 0.02, st * 0.95, 0.005, M.white, { col: false, shadow: false });
  PADS.push({ b, r: dia / 2, top: PH + 0.02, half: [dia * 0.42 + 0.55, 0.6] });
}
let C1ON = false;   // 1종 시험장 (평탄) 사용 중
function groundAt(x, z) {
  if (C1ON) return 0;
  let h = terrainAt(x, z);
  for (const p of PADS) {
    const l = p.b.local(_p.set(x, 0, z));
    const y0 = p.b.g.position.y;
    if (l.lx * l.lx + l.ly * l.ly < p.r * p.r) h = Math.max(h, y0 + p.top);
    else if (Math.abs(l.lx) < p.half[0] && Math.abs(l.ly) < p.half[1]) h = Math.max(h, y0 + 0.14);
  }
  return h;
}
function buildBarrier(o) {
  const b = new Obj(o); const w = num(o.w, 2), h = num(o.h, 0.8), d = num(o.d, 0.45);
  b.box(0, 0, h / 2, w, d, h, M.redPl);
  b.box(0, 0, h + 0.03, w * 0.9, d * 0.6, 0.06, M.redPl, { col: false });
}
function buildRing(o) {
  const b = new Obj(o), dia = num(o.dia, 1.22), alt = num(o.alt, 2.75), tube = 0.035, Rr = dia / 2 + tube;
  const tor = new THREE.Mesh(new THREE.TorusGeometry(Rr, tube, 10, 56), M.yel); tor.position.set(0, alt, 0); b.add(tor);
  const tor2 = new THREE.Mesh(new THREE.TorusGeometry(Rr + tube * 0.9, tube * 0.35, 6, 48), M.blk); tor2.position.set(0, alt, 0); b.add(tor2);
  torusCol(b.world(0, 0, alt), b.world(0, 1, 0).sub(b.world(0, 0, 0)).normalize(), Rr, tube * 1.4, 'ring');
  b.bar([0, 0, -0.25], [0, 0, alt - Rr - tube], 0.02, M.steel);
  b.bar([-0.5, 0, 0], [0.08, 0, alt * 0.48], 0.035, M.wood, { square: true });
  b.bar([0.5, 0, 0], [-0.08, 0, alt * 0.48], 0.035, M.wood, { square: true });
  b.bar([0, 0.5, 0], [0, 0.05, alt * 0.45], 0.03, M.wood, { square: true });
  b.pass = { kind: 'ring', zc: alt, r: dia / 2 };
}
function buildGateSq(o) {
  const b = new Obj(o, 'gate'), w = num(o.w, 1.22), h = num(o.h, 1.22), el = num(o.elev, 2.05), t = num(o.bar, 0.1);
  const x0 = -w / 2 - t / 2, x1 = w / 2 + t / 2, zb = el - t / 2, zt = el + h + t / 2;
  b.stripeBar(x0 - t / 2, zb, x1 + t / 2, zb, 0, t, 0.3); b.stripeBar(x1, zb, x1, zt, 0, t, 0.3);
  b.stripeBar(x1 + t / 2, zt, x0 - t / 2, zt, 0, t, 0.3); b.stripeBar(x0, zt, x0, zb, 0, t, 0.3);
  const lx = w / 2 + t / 2;
  for (const sx of [-1, 1]) b.bar([sx * lx, 0, -0.25], [sx * lx, 0, zb - t / 2], 0.045, M.leg, { square: true });
  b.bar([-lx, 0, 0.5], [lx, 0, el - 0.3], 0.02, M.olv, { square: true });
  b.bar([lx, 0, 0.5], [-lx, 0, el - 0.3], 0.02, M.olv, { square: true });
  b.bar([-lx, 0, el * 0.5], [lx, 0, el * 0.5], 0.025, M.olv, { square: true });
  b.pass = { kind: 'sq', x0: -w / 2, x1: w / 2, z0: el, z1: el + h };
}
function buildGateTri(o) {
  const b = new Obj(o, 'gate'), w = num(o.w, 2.11), h = num(o.h, 1.83), el = num(o.elev, 4.05), t = num(o.bar, 0.1);
  const A = [-w / 2, el], B = [w / 2, el], Cc = [0, el + h];
  const edge = (P, Q, n) => {
    const d = [Q[0] - P[0], Q[1] - P[1]], L = Math.hypot(d[0], d[1]), u = [d[0] / L, d[1] / L], ext = t * 0.7;
    b.stripeBar(P[0] + n[0] * t / 2 - u[0] * ext, P[1] + n[1] * t / 2 - u[1] * ext, Q[0] + n[0] * t / 2 + u[0] * ext, Q[1] + n[1] * t / 2 + u[1] * ext, 0, t, 0.3);
  };
  let nl = [-h, w / 2], nr = [h, w / 2]; const ln = Math.hypot(nl[0], nl[1]); nl = [nl[0] / ln, nl[1] / ln]; nr = [nr[0] / ln, nr[1] / ln];
  edge(A, B, [0, -1]); edge(A, Cc, nl); edge(B, Cc, nr);
  for (const x of [-w / 2, 0, w / 2]) b.bar([x, 0, -0.25], [x, 0, el - t], 0.045, M.leg, { square: true });
  b.bar([-w / 2 - 0.45, 0, 0], [w / 2 + 0.05, 0, el - 0.15], 0.035, M.leg, { square: true });
  b.pass = { kind: 'tri', A, B, C: Cc };
}
function buildPole(o) {
  const b = new Obj(o), w = num(o.w, 0.4), h = num(o.h, 4.5), H = num(o.height, 7);
  b.box(0, 0, h / 2, w, 0.05, h, M.pole);
  b.box(w * 0.32, 0.06, H / 2, w * 0.34, 0.05, H, M.pole);
  b.box(-w * 0.4, 0.11, h * 0.39, w * 0.3, 0.05, h * 0.78, M.pole);
  b.bar([0.12, 0.95, 0.06], [0.02, 0.08, h * 0.5], 0.03, M.wood, { square: true });
}
function buildPanel(o) {
  const b = new Obj(o), w = num(o.w, 0.9), h = num(o.h, 3.4), el = num(o.elev, 1.1);
  b.box(0, 0, el + h / 2, w, 0.04, h, M.panel);
  for (const sx of [-1, 1]) b.cyl(sx * (w / 2 - 0.2), 0, (el + 0.05) / 2, 0.055, el + 0.05, M.grey);
}
function buildIvanGroup(o, extras) {
  const b = new Obj(o, 'ivan'), n = num(o.count, 3), sp = num(o.spacing, 2.2), w = num(o.w, 0.9), h = num(o.h, 1.7), el = num(o.elev, 0.75);
  b.boards = [];
  for (let k = 0; k < n; k++) {
    const lx = (k - (n - 1) / 2) * sp;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.sil); pl.position.set(lx, el + h / 2, 0); pl.customDepthMaterial = silDepth; b.add(pl);
    b.box(lx, 0, el + h / 2, w * 0.75, 0.04, h, M.sil, { col: true, shadow: false }).visible = false;
    b.bar([lx, 0.03, 0], [lx, 0.03, el + 0.25], 0.028, M.steel);
    b.boards.push([lx, 0, el + h / 2]);
  }
  if (extras) {
    const hx = (n - 1) / 2 * sp + 1.2;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) buildCone(b.world(sx * hx, sy * 1.6, 0));
    const tz = 0.015;
    b.box(0, -1.6, tz, 2 * hx, 0.05, 0.02, M.tape, { col: false, shadow: false }); b.box(0, 1.6, tz, 2 * hx, 0.05, 0.02, M.tape, { col: false, shadow: false });
    for (const sx of [-1, 1]) b.box(sx * hx, 0, tz, 0.05, 3.2, 0.02, M.tape, { col: false, shadow: false });
  }
  return b;
}
const CONE_GEO = new THREE.ConeGeometry(0.17, 0.45, 14); CONE_GEO.translate(0, 0.225, 0);
const CONE_BAND = new THREE.CylinderGeometry(0.095, 0.12, 0.08, 14);
function buildCone(p) {
  const c = new THREE.Mesh(CONE_GEO, M.cone); c.position.copy(p); c.castShadow = true; scene.add(c);
  const bd = new THREE.Mesh(CONE_BAND, M.white); bd.position.copy(p).add(new V3(0, 0.22, 0)); scene.add(bd);
  const base = new THREE.Mesh(UBOX, M.cone); base.scale.set(0.36, 0.03, 0.36); base.position.copy(p).add(new V3(0, 0.015, 0)); scene.add(base);
  capCol(p.clone().add(new V3(0, 0.1, 0)), p.clone().add(new V3(0, 0.38, 0)), 0.12, 'cone');
}
function buildTunnel(o) {
  const b = new Obj(o, 'tunnel'), dia = num(o.dia, 1.7), L = num(o.length, 4.5), el = num(o.elev, 0.95), rin = dia / 2, th = 0.06, zc = el + dia / 2;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(rin + th / 2, rin + th / 2, L, 48, 1, true), M.pipe);
  pipe.rotation.x = Math.PI / 2; pipe.position.set(0, zc, 0); b.add(pipe);
  for (const s of [-1, 1]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(rin + th / 2, 0.045, 8, 48), M.yel); rim.position.set(0, zc, s * L / 2); b.add(rim); }
  tubeCol(b.world(0, -L / 2, zc), b.world(0, L / 2, zc), rin, rin + th + 0.03, 'tunnel');
  for (const ly of [-(L / 2 - 0.7), L / 2 - 0.7]) {
    b.bar([-rin - 0.45, ly, 0], [-rin * 0.45, ly, zc - rin * 0.93], 0.045, M.leg, { square: true });
    b.bar([rin + 0.45, ly, 0], [rin * 0.45, ly, zc - rin * 0.93], 0.045, M.leg, { square: true });
    b.bar([-rin * 0.75, ly, zc - rin * 0.72], [rin * 0.75, ly, zc - rin * 0.72], 0.035, M.leg, { square: true, col: false });
  }
  b.pass = { kind: 'tunnel', zc, r: rin, L };
}
function buildBunker(o) {
  const b = new Obj(o, 'bunker'), w = num(o.w, 3.8), h = num(o.h, 3.1), d = num(o.d, 3.0), T = 0.14;
  const nx = Math.max(1, Math.round(w / 1.2)), nz = Math.max(1, Math.round(h / 1.0));
  const cw = w / nx, ch = h / nz, win = [Math.floor(nx / 2), nz - 1];
  const fx0 = -w / 2 + win[0] * cw + 0.05, fx1 = -w / 2 + (win[0] + 1) * cw - 0.05, fz0 = win[1] * ch + 0.04, fz1 = (win[1] + 1) * ch - 0.04, ft = 0.06;
  const mm = (inner) => { const a = [M.pallet, M.pallet, M.pallet, M.pallet, M.pallet, M.pallet]; a[inner] = M.inner; return a; };
  const front = mm(5), back = mm(4), left = mm(0), right = mm(1), roofM = [M.roof, M.roof, M.roof, M.dark, M.roof, M.roof];
  // 앞벽 (창 칸 제외)
  for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
    if (ix === win[0] && iz === win[1]) continue;
    b.box(-w / 2 + (ix + 0.5) * cw, -d / 2 + T / 2, (iz + 0.5) * ch, cw, T, ch, front);
  }
  // 창 둘레 (칸과 창틀 사이 여백 + 창틀)
  const wxc = (fx0 + fx1) / 2, wzc = (fz0 + fz1) / 2, cx0 = -w / 2 + win[0] * cw, cz0 = win[1] * ch;
  b.box(cx0 + 0.025, -d / 2 + T / 2, cz0 + ch / 2, 0.05 + ft, T, ch, front);
  b.box(cx0 + cw - 0.025, -d / 2 + T / 2, cz0 + ch / 2, 0.05 + ft, T, ch, front);
  b.box(wxc, -d / 2 + T / 2, cz0 + 0.02 + ft / 2, cw, T, 0.04 + ft, front);
  b.box(wxc, -d / 2 + T / 2, cz0 + ch - 0.02 - ft / 2, cw, T, 0.04 + ft, front);
  b.box(0, d / 2 - T / 2, h / 2, w, T, h, back);
  // 왼쪽 벽: 가운데 위칸에 두 번째 창 (정찰 후 이쪽으로 나감)
  const wy = (fx1 - fx0) / 2 - ft, lz0 = fz0 + ft, lz1 = fz1 - ft, lwx = -w / 2 + T / 2, yA = -d / 2 + T, yB = d / 2 - T;
  b.box(lwx, (yA + (-wy - ft)) / 2, h / 2, T, (-wy - ft) - yA, h, left);
  b.box(lwx, ((wy + ft) + yB) / 2, h / 2, T, yB - (wy + ft), h, left);
  b.box(lwx, 0, (lz0 - ft) / 2, T, 2 * (wy + ft), lz0 - ft, left);
  b.box(lwx, 0, (lz1 + ft + h) / 2, T, 2 * (wy + ft), h - lz1 - ft, left);
  for (const sy of [-1, 1]) b.box(lwx, sy * (wy + ft / 2), (lz0 + lz1) / 2, T, ft, lz1 - lz0 + 2 * ft, M.dkwood);
  b.box(lwx, 0, lz0 - ft / 2, T, 2 * wy + 2 * ft, ft, M.dkwood); b.box(lwx, 0, lz1 + ft / 2, T, 2 * wy + 2 * ft, ft, M.dkwood);
  b.box(w / 2 - T / 2, 0, h / 2, T, d - 2 * T, h, right);
  b.box(0, 0, h + 0.05, w + 0.3, d + 0.3, 0.1, roofM);
  b.box(0, 0, 0.01, w - 2 * T, d - 2 * T, 0.02, M.dark, { col: false });
  // 내부: 상자 + 노란 깃발 (정찰 대상)
  b.box(w / 2 - 0.55, d / 2 - 0.55, 0.3, 0.6, 0.6, 0.6, M.wood);
  b.box(-w / 2 + 0.5, d / 2 - 0.45, 0.22, 0.5, 0.4, 0.44, M.olive);
  b.bar([-0.6, 0.8, 0], [-0.6, 0.8, 1.5], 0.015, M.steel, { col: false });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), mat(0xf2c218, { side: THREE.DoubleSide })); fl.position.set(-0.35, 1.34, -0.8); b.add(fl);
  b.inner = { x: w / 2 - T, y0: -d / 2 + T, y1: d / 2 - T, z: h };
  b.win = { x0: fx0 + ft, x1: fx1 - ft, z0: fz0 + ft, z1: fz1 - ft, xc: wxc, zc: wzc, y: -d / 2 };
  b.win2 = { y0: -wy, y1: wy, z0: lz0, z1: lz1, zc: (lz0 + lz1) / 2, x: -w / 2 };
  b.dims = { w, h, d };
}
function buildMIT(o) {
  const b = new Obj(o, 'mit'), L = num(o.length, 30), w = num(o.w, 0.9), h = num(o.h, 1.7), el = num(o.elev, 0.45);
  b.box(0, 0, 0.12, L, 0.35, 0.24, M.steel);
  b.box(0, -1.4, 0.35, L + 1, 0.3, 0.7, M.concrete);
  const car = new THREE.Group(); b.g.add(car);
  const cb = new THREE.Mesh(UBOX, M.olive); cb.scale.set(0.7, 0.2, 0.45); cb.position.set(0, 0.34, 0); cb.castShadow = true; car.add(cb);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.sil); pl.position.set(0, 0.24 + el + h / 2, 0); pl.castShadow = true; pl.customDepthMaterial = silDepth; car.add(pl);
  const hit = new THREE.Mesh(UBOX); hit.visible = false; hit.scale.set(w * 0.75, h, 0.05); hit.position.copy(pl.position); car.add(hit);
  b.car = car; b.amp = L / 2 - 2; b.board = [0, 0, 0.24 + el + h / 2];
  b.col = boxCol(hit, 'mit'); b.hitMesh = hit;
  b.update = (t) => { car.position.x = b.amp * Math.sin(t * 3.5 / b.amp); updBoxCol(b.col, hit); };
}
function buildTank(o) {
  const b = new Obj(o, 'tank'), L = num(o.length, 8.1), Wd = num(o.w, 3.3), Hh = num(o.h, 1.7), TOP = num(o.height, 2.85), BAR = num(o.d, 3.7);
  const k = L / 8.08, wh = Hh * 0.5, dk = 0.18, TW = Wd * 0.78;
  b.box(0, 0, wh / 2, Wd * 0.95, L * 0.9, wh, M.wheel);
  b.box(0, 0, wh + (Hh - wh) / 2, Wd, L * 0.86, Hh - wh, M.camo);
  b.box(0, 0.1 * k, Hh + dk / 2, Wd * 0.86, L * 0.68, dk, M.camo);
  const ys = [-2.98, -1.76, -0.6, 0.56, 1.72, 2.88];
  const wg = new THREE.CylinderGeometry(1, 1, 1, 20); wg.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const y of ys) b.cyl(sx * (Wd * 0.475 + 0.03), y * k, wh * 0.52, wh * 0.56, 0.06, M.wheel, { geo: wg, col: false });
  const zt0 = Hh + dk;
  b.box(0, 0.11 * k, (zt0 + TOP) / 2, TW, 3.32 * k, TOP - zt0, M.camo);
  b.box(0, -1.62 * k, TOP - 0.38, 0.7, 0.3, 0.5, M.camo);
  b.bar([0, -1.7 * k, TOP - 0.36], [0, -1.7 * k - BAR, TOP - 0.3], 0.085, M.barrel);
  b.bar([0.6, 1.2, TOP], [0.6, 1.2, TOP + 1.6], 0.012, M.blk, { col: false });
  b.foot = { x: Wd / 2, y: L / 2 };
}
function buildHipBld(o) {
  const b = new Obj(o), w = num(o.w, 10), h = num(o.h, 3), d = num(o.d, 7);
  b.box(0, 0, h / 2, w, d, h, M.beige);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), M.roof); roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / 1.414 * 1.12, 1.4, d / 1.414 * 1.12); roof.position.set(0, h + 0.7, 0); b.add(roof);
  b.box(-w * 0.2, d / 2 + 0.01, 1.05, 1.0, 0.04, 2.1, M.dkwood, { col: false });
  for (const x of [w * 0.12, w * 0.32]) b.box(x, d / 2 + 0.01, 1.7, 1.3, 0.04, 1.0, M.glass, { col: false });
  b.box(w * 0.3, 0, h + 1.2, 0.25, 0.25, 0.9, M.grey, { col: false });
}
function buildPavilion(o) {
  const b = new Obj(o), w = num(o.w, 14), h = num(o.h, 3.1), d = num(o.d, 7.5);
  b.box(0, 0, 0.08, w, d, 0.16, M.concrete);
  for (const sx of [-1, 0, 1]) for (const sy of [-1, 1]) b.box(sx * (w / 2 - 0.2), sy * (d / 2 - 0.2), h / 2, 0.2, 0.2, h, M.grey);
  b.box(0, 0, h + 0.1, w + 0.6, d + 0.6, 0.2, M.roof);
}
function buildTower(o) {
  const b = new Obj(o), w = num(o.w, 6), h = num(o.h, 3.2), d = num(o.d, 4.5);
  b.box(0, 0, h / 2, w, d, h, M.beige);
  b.box(0, 0, h + 0.1, w + 0.4, d + 0.4, 0.2, M.roof);
  b.box(0, d / 2 + 0.01, h * 0.62, w * 0.86, 0.04, h * 0.32, M.glass, { col: false });
  b.box(-w * 0.3, -d / 2 - 0.01, 1.05, 0.95, 0.04, 2.1, M.dkwood, { col: false });
  b.bar([w * 0.35, -d * 0.3, h], [w * 0.35, -d * 0.3, h + 3.5], 0.03, M.steel);
}
function buildShelter(o) {
  const b = new Obj(o), w = num(o.w, 5), h = num(o.h, 3), d = num(o.d, 4.5);
  b.box(0, -d / 4, h * 0.45, w, d / 2, h * 0.9, M.beige);
  for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.1), d / 2 - 0.1, h / 2, 0.12, 0.12, h, M.grey);
  b.box(0, 0, h + 0.05, w + 0.4, d + 0.3, 0.1, M.roof);
  b.box(0, d / 4, 0.4, 1.6, 0.8, 0.06, M.red); for (const sx of [-1, 1]) b.box(sx * 0.7, d / 4, 0.2, 0.06, 0.6, 0.4, M.red, { col: false });
}
function buildBleacher(o) {
  const b = new Obj(o), w = num(o.w, 12), h = num(o.h, 5.5), d = num(o.d, 7);
  for (let i = 0; i < 5; i++) b.box(0, d / 2 - 1.0 - i * 1.0, 0.25 + i * 0.45, w - 0.6, 1.0, 0.5 + i * 0.9 - i * 0.45, M.grey);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.box(sx * (w / 2 - 0.15), sy * (d / 2 - 0.2), h / 2, 0.15, 0.15, h, M.steel);
  b.box(0, 0, h + 0.05, w + 0.4, d + 0.4, 0.1, M.roof);
}
function buildFP(o) {
  const b = new Obj(o), w = num(o.w, 1.2), h = num(o.h, 0.8);
  b.box(0, 0.4, h / 2, w + 0.6, 0.45, h, M.sand);
  for (const sx of [-1, 1]) b.box(sx * (w / 2 + 0.3), -0.2, h / 2, 0.45, 1.2, h, M.sand);
}
function buildSil(o, frame) {
  const b = new Obj(o), w = num(o.w, 1.4), h = num(o.h, 2), el = num(o.elev, 0.15);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.9), M.sil); pl.position.set(0, el + h / 2, 0); pl.customDepthMaterial = silDepth; b.add(pl);
  if (frame) {
    b.stripe = null;
    b.bar([-w / 2, -0.03, 0], [-w / 2, -0.03, el + h], 0.04, M.wood, { square: true });
    b.bar([w / 2, -0.03, 0], [w / 2, -0.03, el + h], 0.04, M.wood, { square: true });
    b.bar([-w / 2, -0.03, el + h], [w / 2, -0.03, el + h], 0.04, M.wood, { square: true });
  }
}
function buildHouseTgt(o) {
  const b = new Obj(o), w = num(o.w, 1.8), h = num(o.h, 2.2), el = num(o.elev, 0.4), wall = h * 0.62;
  b.box(0, 0, el + wall / 2, w, 0.05, wall, M.ply);
  const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.1, 0); sh.lineTo(w / 2 + 0.1, 0); sh.lineTo(0, h - wall); sh.lineTo(-w / 2 - 0.1, 0);
  const rf = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }), M.dkwood); rf.position.set(0, el + wall, -0.025); b.add(rf);
  b.box(0, -0.03, el + wall * 0.45, 0.5, 0.02, 0.6, M.dark, { col: false });
  for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.15), 0.05, (el) / 2 + 0.1, 0.08, 0.08, el + 0.2, M.wood, { col: false });
}
function buildBTarget(o) {
  const b = new Obj(o), w = num(o.w, 2.6), h = num(o.h, 1.3), d = num(o.d, 1.8);
  const berm = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.berm);
  berm.scale.set(w * 1.1, h * 1.05, d * 1.4); berm.position.set(0, 0, -0.6); b.add(berm);
  b.box(0, -0.2, h / 2, w, d * 0.7, h, M.brick);
  b.box(0, -0.2 - d * 0.35 - 0.01, h * 0.55, w * 0.35, 0.02, h * 0.3, M.dark, { col: false });
}
function buildZ(o) {
  const b = new Obj(o), w = num(o.w, 1.6), h = num(o.h, 1.6), el = num(o.elev, 0.7);
  b.box(0, 0, el + h / 2, w, 0.04, h, [M.white, M.white, M.white, M.white, M.white, mat(0xffffff, { map: textTex('Z', { w: 256, h: 256, size: 230 }) })]);
  for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.15), 0.05, el / 2, 0.08, 0.08, el, M.wood, { col: false });
}
function buildSign(o) {
  const b = new Obj(o), w = num(o.w, 1.9), h = num(o.h, 1.5), el = num(o.elev, 0.67), fr = 0.075;
  const face = mat(0xffffff, { map: textTex(String(o.text || ''), { w: 256, h: 200, size: 120 }) });
  b.box(0, 0, el + h / 2, w - 2 * fr, 0.02, h - 2 * fr, [M.white, M.white, M.white, M.white, M.white, face]);
  b.box(0, 0, el + h - fr / 2, w, 0.07, fr, M.dkwood, { col: false }); b.box(0, 0, el + fr / 2, w, 0.07, fr, M.dkwood, { col: false });
  for (const sx of [-1, 1]) { b.box(sx * (w / 2 - fr / 2), 0, el + h / 2, fr, 0.07, h, M.dkwood, { col: false }); b.box(sx * (w / 2 - 0.13), 0, el / 2, 0.08, 0.08, el, M.dkwood); }
}
function buildLimitEnd(o) {
  const b = new Obj(o), arrow = String(o.text || '>');
  const face = mat(0xffffff, { map: textTex(arrow === '>' ? '▶' : '◀', { w: 256, h: 256, size: 200, bg: '#e8e6e2', fg: '#7a0a1e' }) });
  b.box(0, 0, 1.6, 1.0, 0.04, 1.0, [M.white, M.white, M.white, M.white, M.white, face]);
  b.cyl(0, 0, 0.55, 0.05, 1.1, M.grey);
}
function buildLogoPanel() {
  const o = { id: 'logo_panel', type: 'logo', down: 11, side: 0, yaw: 0 }; const b = new Obj(o);
  b.box(0, 0, 0.035, 5.0, 3.4, 0.07, M.blk, { col: false });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.2), mat(0xffffff, { map: TX.logo, roughness: 0.7 }));
  pl.rotation.x = -Math.PI / 2; pl.position.set(0, 0.072, 0); b.add(pl, false);
}
let flagMesh = null;
function buildFlag() {
  const o = { id: 'flag', type: 'flag', down: -30.6, side: 10.2, yaw: 0 }; const b = new Obj(o);
  b.cyl(0, 0, 0.15, 0.35, 0.3, M.concrete, { geo: UCYL40 });
  b.cyl(0, 0, 3.6, 0.045, 7.0, M.white);
  const geo = new THREE.PlaneGeometry(1.8, 1.2, 18, 12); geo.translate(0.9, 0, 0);
  flagMesh = new THREE.Mesh(geo, mat(0x8a0018, { side: THREE.DoubleSide, roughness: 0.8 }));
  flagMesh.position.set(0.05, 6.4, 0); flagMesh.rotation.y = 0.6; b.add(flagMesh);
  flagMesh.userData.base = geo.attributes.position.array.slice();
}

const BUILDERS = {
  pad: buildPad, barrier: buildBarrier, ring: buildRing, gate_sq: buildGateSq, gate_tri: buildGateTri, pole: buildPole,
  panel: buildPanel, ivan_group: o => buildIvanGroup(o, o.id === 'ivan_grp1'), tunnel: buildTunnel, bunker: buildBunker, mit: buildMIT,
  tank: buildTank, building: buildTower, shelter: buildShelter, bleacher: buildBleacher, fp: buildFP, pavilion: buildPavilion,
  hipbld: buildHipBld, house_tgt: buildHouseTgt, etype: o => buildSil(o, true), btarget: buildBTarget, ztarget: buildZ,
  sign: buildSign, limit_end: buildLimitEnd
};
// ---- 지형 정지(整地): 시설물이 놓일 자리를 평평하게 깎고 메움 (cut & fill) ----
function flattenRect(cx, cz, yaw, hx, hz, blend, y) {
  const n = TER.n, H = TER.h, c = Math.cos(yaw), s = Math.sin(yaw), R = Math.hypot(hx, hz) + blend + TER.step;
  const ix0 = Math.max(0, Math.floor((cx - R - GS0) / TER.step)), ix1 = Math.min(n - 1, Math.ceil((cx + R - GS0) / TER.step));
  const iy0 = Math.max(0, Math.floor((GD1 + cz - R) / TER.step)), iy1 = Math.min(n - 1, Math.ceil((GD1 + cz + R) / TER.step));
  for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) {
    const x = GS0 + ix * TER.step - cx, z = iy * TER.step - GD1 - cz;
    const lx = x * c - z * s, lz = x * s + z * c;                    // 시설물 축 기준
    const d = Math.hypot(Math.max(0, Math.abs(lx) - hx), Math.max(0, Math.abs(lz) - hz));
    const w = 1 - smooth01(0, blend, d);
    if (w > 0) H[iy * n + ix] = H[iy * n + ix] * (1 - w) + y * w;
  }
}
const EARTH = { cut: 0, fill: 0 };
(function siteWorks() {
  if (!TER.h) return;
  const before = TER.h.slice();
  const pt = (d, s) => { const x = s, z = -d; return [x, z, terrainAt(x, z)]; };
  // 1) 출발·통제 구역 터 (패드·통제탑·관람석·사로 등) — 출발 패드 높이로 정지
  if (CRS_C) {   // 전용 코스: 출발 패드 주변만 작은 터
    const a = BY.pad_start, b = BY.pad_land, [x, z, y] = pt(a.down, a.side), [x2, z2] = pt(b.down, b.side);
    flattenRect((x + x2) / 2, (z + z2) / 2, num(a.yaw, 0) * DEG, Math.hypot(x2 - x, z2 - z) / 2 + 6, 9, 14, y);
  } else { const [x, z, y] = pt(10, -5); flattenRect(-28, 25, 0, 40, 42, 25, y); }
  // 2) 시설물마다 작은 터
  const rad = { pad: [1.5, 1.5], ring: [1.5, 1.5], gate_sq: [1.6, 1.2], gate_tri: [1.8, 1.2], pole: [1, 1], bunker: [3.5, 3], tunnel: [3.5, 1.8],
    ivan_group: [4, 1.5], panel: [1.2, 1], mit: [16, 2.5], tank: [5, 3], barrier: [1.5, 1], fp: [1.2, 1.2], house_tgt: [1.8, 1.8],
    etype: [1.2, 1], btarget: [2, 1.6], ztarget: [1.5, 1], sign: [1.6, 1], limit_end: [1.2, 1] };
  for (const o of D.objs) {
    const r = rad[o.type]; if (!r) continue;
    let hx = r[0], hz = r[1];
    if (o.type === 'ivan_group') hx = Math.max(hx, num(o.count, 3) * num(o.spacing, 2) / 2 + 1);
    const [x, z, y] = pt(o.down, o.side);
    flattenRect(x, z, num(o.yaw, 0) * DEG, hx, hz, Math.max(4, hx * 0.8), y);
  }
  let cut = 0, fill = 0; const a = TER.step * TER.step;
  for (let i = 0; i < before.length; i++) { const dh = TER.h[i] - before[i]; if (dh < 0) cut -= dh * a; else fill += dh * a; }
  EARTH.cut = cut; EARTH.fill = fill;
  applyTerrain(TER.h); grassRefit();
})();
for (const o of D.objs) { const f = BUILDERS[o.type]; if (f) f(o); else console.warn('no builder', o.type); }
// 수치지형도 건물: 최소 외접 사각형으로 세우고 충돌 상자도 만듦
const SITE_BLD = (function siteBuildings() {
  if (!VEC || !VEC.bld) return 0;
  const wallM = [mat(0xc9c2b4, { roughness: 0.9 }), mat(0xb7b0a0, { roughness: 0.9 }), mat(0xd6d0c4, { roughness: 0.9 })];
  const roofM = [mat(0x5a6f86, { roughness: 0.7 }), mat(0x8a4a3a, { roughness: 0.8 }), mat(0x6c6f72, { roughness: 0.8 })];
  let n = 0;
  for (const [d, s, w, l, ang, h] of VEC.bld) {
    const c = W(d, s, 0), a = ang * DEG, ca = Math.cos(a), sa = Math.sin(a);
    // 바닥 네 귀퉁이 지면 높이 -> 가장 낮은 곳에서 시작해 경사지에 묻히게
    let lo = 1e9, hi = -1e9;
    for (const [u, v] of [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]]) {
      const dd = d + u * ca - v * sa, ss = s + u * sa + v * ca, y = terrainAt(ss, -dd); lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    const H = h + (hi - lo), k = n % 3;
    const m = new THREE.Mesh(UBOX, wallM[k]); m.position.set(c.x, lo - 0.3 + (H + 0.3) / 2, c.z);
    // 코스 좌표 (down=x축 방향 회전) -> three: down 축 = -z, side 축 = +x
    m.rotation.y = Math.PI / 2 - a; m.scale.set(w, H + 0.3, l);   // 변 w = (down, side) 평면에서 ang 방향
    m.castShadow = true; m.receiveShadow = true; scene.add(m); boxCol(m, 'bld');
    const r = new THREE.Mesh(UBOX, roofM[k]); r.position.set(c.x, lo + H + 0.12, c.z); r.rotation.y = Math.PI / 2 - a; r.scale.set(w + 0.5, 0.25, l + 0.5); r.castShadow = true; scene.add(r);
    n++;
  }
  return n;
})();
// 숲길 (나무 사이 좁은 길): 주 경로에서 옆으로 떨어진 숲 속 길. 길 위 나무는 비우고, 게이트·쓰러진 나무·좁은 틈을 둠
const FLANE = (function forestLane() {
  if (!CRS_C || !SITE.trees) return null;
  const P = CRS_C.path, OFF = 34;
  // 경로를 2 m 간격으로 다시 찍고, 왼쪽(+side) 으로 OFF 만큼 평행 이동 후 이동평균으로 다듬음
  const rs = []; let acc = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = acc; t < L; t += 2) { const u = t / L; rs.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
    acc = Math.max(0, (Math.ceil((L - acc) / 2) * 2 + acc) - L);
  }
  let lane = rs.map((p, i) => { const q = rs[Math.min(rs.length - 1, i + 1)], o = rs[Math.max(0, i - 1)], dd = q[0] - o[0], ds = q[1] - o[1], l = Math.hypot(dd, ds) || 1; return [p[0] - ds / l * OFF, p[1] + dd / l * OFF]; });
  lane = lane.slice(Math.floor(lane.length * 0.06), Math.floor(lane.length * 0.94));
  for (let it = 0; it < 3; it++) lane = lane.map((p, i) => { let sd = 0, ss = 0, n = 0; for (let k = -8; k <= 8; k++) { const q = lane[Math.max(0, Math.min(lane.length - 1, i + k))]; sd += q[0]; ss += q[1]; n++; } return [sd / n, ss / n]; });
  // 누적 거리
  const cum = [0]; for (let i = 1; i < lane.length; i++) cum.push(cum[i - 1] + Math.hypot(lane[i][0] - lane[i - 1][0], lane[i][1] - lane[i - 1][1]));
  const total = cum[cum.length - 1];
  const at = s => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const u = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), a = lane[i - 1], b = lane[i];
    const d = a[0] + (b[0] - a[0]) * u, sd = a[1] + (b[1] - a[1]) * u, l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return { d, s: sd, td: (b[0] - a[0]) / l, ts: (b[1] - a[1]) / l }; };
  // 시설물
  const G = new THREE.Group(); scene.add(G);
  const gateM = mat(0xff7a1a, { roughness: 0.6 }), barkM = mat(0x4a3a2c, { roughness: 1 }), leafM = mat(0x3c5634, { roughness: 1 }), tapeM = mat(0xf2e14c, { roughness: 0.7 });
  const cps = [];
  // 코스 좌표 (down, side, agl) + 길 방향 기준 오프셋 -> world
  const wpt = (q, lat, up) => W(q.d - q.ts * lat, q.s + q.td * lat, up);
  const box = (a, b, w, col, tag) => { const m = new THREE.Mesh(UBOX, col); m.position.copy(a).add(b).multiplyScalar(0.5); const L = a.distanceTo(b); m.scale.set(w, w, L); m.lookAt(b); m.castShadow = true; G.add(m); if (tag) boxCol(m, tag); return m; };
  const cyl = (a, b, r, col, tag) => { const m = new THREE.Mesh(UCYL, col); m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(r, a.distanceTo(b), r); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize()); m.castShadow = true; m.receiveShadow = true; G.add(m); if (tag) capCol(a.clone(), b.clone(), r, tag); return m; };
  const yaw = q => Math.atan2(q.ts, q.td);   // 길 방향 (코스 좌표 각)
  function gate(s, label, w, h) {
    const q = at(s), hw = w / 2;
    const l0 = wpt(q, -hw - 0.1, 0), l1 = wpt(q, -hw - 0.1, h + 0.1), r0 = wpt(q, hw + 0.1, 0), r1 = wpt(q, hw + 0.1, h + 0.1);
    box(l0, l1, 0.16, gateM, 'fgate'); box(r0, r1, 0.16, gateM, 'fgate'); box(l1, r1, 0.16, gateM, 'fgate');
    cps.push({ s, q, label, hw, y0: 0.2, y1: h });
  }
  function lowLog(s) {   // 쓰러진 나무: 위로 넘기
    const q = at(s), a = wpt(q, -6, 0.75), b = wpt(q, 6.5, 0.55);
    cyl(a, b, 0.32, barkM, 'log');
    for (const k of [-0.3, 0.1, 0.4]) { const p = a.clone().lerp(b, 0.5 + k); box(p, p.clone().add(new V3(0, 0.9, 0.3)), 0.07, barkM); }   // 부러진 가지
    cps.push({ s, q, label: '쓰러진 나무 넘기', hw: 2.6, y0: 1.25, y1: 4.2 });
  }
  function arch(s) {   // 기울어진 나무: 아래로 지나기
    const q = at(s), a = wpt(q, -7, 0.1), b = wpt(q, 6, 4.9);
    cyl(a, b, 0.28, barkM, 'log');
    const crown = new THREE.Mesh(USPH, leafM); crown.position.copy(b).add(new V3(0, 0.6, 0)); crown.scale.set(2.6, 1.6, 2.6); crown.castShadow = true; G.add(crown);
    const yc = 0.1 + (7 / 13) * 4.8;   // 길 가운데 높이
    cps.push({ s, q, label: '기운 나무 아래로', hw: 2.4, y0: 0.25, y1: yc - 0.45 });
  }
  function gap(s) {   // 좁은 나무 틈
    const q = at(s);
    for (const lat of [-1.35, 1.35]) {
      const a = wpt(q, lat, -0.3), b = wpt(q, lat, 11);
      cyl(a, b, 0.3, barkM, 'trunk');
      const c = new THREE.Mesh(USPH, leafM); c.position.copy(wpt(q, lat * 1.8, 9.5)); c.scale.set(2.4, 2.8, 2.4); c.castShadow = true; G.add(c);
    }
    const t0 = wpt(q, -1.05, 2.2), t1 = wpt(q, 1.05, 2.2); box(t0, t1, 0.04, tapeM);   // 표시 띠
    cps.push({ s, q, label: '좁은 틈 (2.1 m)', hw: 1.05, y0: 0.2, y1: 6 });
  }
  // 약 17 m 마다 하나씩 (게이트·틈·넘기·아래로 섞어서)
  const PAT = ['g', 'n', 'g', 'l', 'g', 'a', 'n', 'g', 'l', 'g', 'a', 'n'], plan = [];
  for (let s = 16, i = 0; s < total - 30; s += 17, i++) plan.push([s, PAT[i % PAT.length]]);
  plan.push([total - 14, 'f']);
  let gi = 0;
  for (const [s, k] of plan) {
    if (s > total - 10 && k !== 'f') continue;
    if (k === 'g') gate(s, '숲 게이트 ' + (++gi), 3.0, 2.6); else if (k === 'l') lowLog(s); else if (k === 'a') arch(s); else if (k === 'n') gap(s); else gate(s, '숲길 결승', 3.6, 3.2);
  }
  // 나무 비울 곳 (코스 좌표 점 목록, 반경)
  const clear = lane.filter((_, i) => i % 1 === 0);
  return { lane, total, at, cps, G, clear, R: 3.0, gateM };
})();
// 나무: 현장 패키지의 trees (정사영상 수관 검출) 를 구역별 InstancedMesh 로 세움 + 충돌 격자
const STREES = (function siteTrees() {
  const T = SITE.trees; if (!T || !T.n) return { n: 0, col() { return null; } };
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const i16 = new Int16Array(b64(T.i16).buffer), u8 = b64(T.u8), n = T.n;
  // 형상: 단위 높이 1, 수관 반지름 1 (인스턴스에서 [반지름, 높이, 반지름] 으로 늘림). 꼭짓점 색 = 아래 어둡고 위 밝게 (그늘 흉내)
  const hsh = (x, y, z) => { const s = Math.sin(x * 12.99 + y * 78.23 + z * 37.72) * 43758.5; return s - Math.floor(s); };
  function shade(geo, trunkTop) {
    const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), tr = y < trunkTop && Math.hypot(p.getX(i), p.getZ(i)) < 0.09;
      const k = tr ? 0.42 : (0.6 + 0.55 * Math.max(0, Math.min(1, (y - trunkTop) / (1 - trunkTop)))) * (0.84 + 0.3 * hsh(p.getX(i) * 5, y * 9, p.getZ(i) * 5));
      c[i * 3] = tr ? k * 1.1 : k; c[i * 3 + 1] = tr ? k * 0.85 : k; c[i * 3 + 2] = tr ? k * 0.7 : k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
  }
  function merge(parts) {
    parts = parts.map(g => g.index ? g.toNonIndexed() : g);
    let nv = 0; parts.forEach(g => nv += g.attributes.position.count);
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3); let o = 0;
    for (const g of parts) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P.subarray(0, o * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(N.subarray(0, o * 3), 3)); return g;
  }
  const trunk = h => { const g = new THREE.CylinderGeometry(0.04, 0.065, h, 6, 1, true); g.translate(0, h / 2, 0); return g; };
  // 활엽수: 울퉁불퉁한 공 두 개
  const _n = new V3();
  let BD = 2;
  const blob = (r, ry, x, y, z, seed) => { const g = new THREE.IcosahedronGeometry(1, BD), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), k = 1 + 0.16 * (hsh(vx * 3 + seed, vy * 3, vz * 3) - 0.5) + 0.1 * Math.sin(vx * 7 + seed) * Math.cos(vz * 6);
      p.setXYZ(i, vx * r * k + x, vy * ry * k + y, vz * r * k + z); }
    // 부드러운 노멀: 타원체 법선 (단위 높이로 늘어날 것을 감안해 세로를 조금 키움)
    const nm = g.attributes.normal; for (let i = 0; i < p.count; i++) { _n.set((p.getX(i) - x) / r, (p.getY(i) - y) / ry * 1.6, (p.getZ(i) - z) / r).normalize(); nm.setXYZ(i, _n.x, _n.y, _n.z); }
    return g; };
  // 거리별 3단계 (가까이: 덩이 3개 세밀 / 중간: 덜 세밀 / 멀리: 덩이 1개)
  const decG = () => shade(merge([trunk(0.42), blob(1.0, 0.36, 0, 0.62, 0, 1), blob(0.7, 0.26, 0.3, 0.82, -0.2, 2), blob(0.66, 0.24, -0.35, 0.56, 0.25, 7)]), 0.32);
  const conG = () => shade(merge([trunk(0.66), blob(0.82, 0.15, 0.05, 0.84, 0, 3), blob(0.55, 0.12, 0.38, 0.93, 0.25, 4), blob(0.5, 0.12, -0.34, 0.76, -0.28, 5), blob(0.42, 0.1, -0.1, 0.66, 0.4, 6)]), 0.62);
  // 조림지 침엽수 (낙엽송·리기다소나무 등): 층층이 쌓인 뾰족한 원뿔
  const cone = (r, y0, y1, seg, seed) => { const g = new THREE.ConeGeometry(r, y1 - y0, seg, 2, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vz = p.getZ(i), k = 1 + 0.22 * (hsh(vx * 4 + seed, p.getY(i) * 5, vz * 4) - 0.5); p.setX(i, vx * k); p.setZ(i, vz * k); }
    g.translate(0, (y0 + y1) / 2, 0); g.computeVertexNormals(); return g; };
  const conifG = seg => shade(merge([trunk(0.32), cone(0.95, 0.22, 0.62, seg, 1), cone(0.72, 0.42, 0.82, seg, 2), cone(0.46, 0.62, 1.0, seg, 3)]), 0.24);
  const GEO = [[], [], [], []];
  for (const bd of LOWQ ? [1, 1, 0] : [2, 1, 0]) { BD = bd; GEO[0].push(decG()); GEO[1].push(conG()); GEO[2].push(shade(merge([blob(1, 0.5, 0, 0.45, 0, 8), blob(0.7, 0.4, 0.4, 0.4, 0.3, 9)]), 0)); GEO[3].push(conifG(bd === 2 ? 10 : bd === 1 ? 7 : 5)); }
  BD = 0; GEO[0][2] = shade(merge([trunk(0.42), blob(1.05, 0.38, 0, 0.64, 0, 1)]), 0.32); GEO[1][2] = shade(merge([trunk(0.66), blob(0.9, 0.17, 0, 0.83, 0, 3)]), 0.62);
  // 소나무: 곧은 줄기 위에 납작하고 불규칙한 수관 덩이 (한국 산지 소나무 형태)
  const mt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  // 구역(120 m) 별로 나눠 화면 밖 구역은 그리지 않음
  const CH = 120, groups = new Map(), GRID = new Map(), GC = 10, CHUNKS = [];
  // 숲길 위 나무 빼기 (격자로 빠르게)
  const skip = new Uint8Array(n);
  if (FLANE) { const LG = new Map(); for (const p of FLANE.clear) { const k = Math.floor(p[0] / 8) + ',' + Math.floor(p[1] / 8); if (!LG.has(k)) LG.set(k, []); LG.get(k).push(p); }
    for (let i = 0; i < n; i++) { const d = i16[i * 4] / 10, s = i16[i * 4 + 1] / 10, gd = Math.floor(d / 8), gs = Math.floor(s / 8);
      for (let a = gd - 1; a <= gd + 1 && !skip[i]; a++) for (let b = gs - 1; b <= gs + 1; b++) { const L = LG.get(a + ',' + b); if (L && L.some(p => Math.hypot(p[0] - d, p[1] - s) < FLANE.R)) { skip[i] = 1; break; } } } }
  if (LOWQ) for (let i = 0; i < n; i++) if (hsh(i16[i * 4], i16[i * 4 + 1], 9) < 0.35) skip[i] = 1;   // 모바일: 나무 35% 줄임
  for (let i = 0; i < n; i++) {
    if (skip[i]) continue;
    const d = i16[i * 4] / 10, s = i16[i * 4 + 1] / 10, key = Math.floor(d / CH) + ',' + Math.floor(s / CH) + ',' + u8[i * 4 + 3];
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(i);
  }
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new V3(0, 1, 0), SCV = new V3(), col = new THREE.Color();
  const pos = new Float32Array(n * 3), dim = new Float32Array(n * 2), _a = new V3(), REF = new Int32Array(n * 2);   // REF: 나무 i -> (조각, 인스턴스 번호)
  for (const [key, ids] of groups) {
    const kind = +key.split(',')[2];
    const view = G0 => { const g = new THREE.BufferGeometry(); for (const a in G0.attributes) g.setAttribute(a, G0.attributes[a]); return g; };   // 꼭짓점 버퍼는 공유, 경계 구만 구역별
    const geos = GEO[kind].map(view), geo = geos[2];
    const im = new THREE.InstancedMesh(geo, mt, ids.length), bb = new THREE.Box3();
    ids.forEach((i, k) => {
      const d = i16[i * 4] / 10, s = i16[i * 4 + 1] / 10, h = i16[i * 4 + 2] / 10, r = i16[i * 4 + 3] / 10;
      const w = W(d, s, 0); w.y = Math.min(w.y, terrainAt(w.x + r * 0.4, w.z), terrainAt(w.x - r * 0.4, w.z), terrainAt(w.x, w.z + r * 0.4), terrainAt(w.x, w.z - r * 0.4)) - 0.2;
      Q.setFromAxisAngle(Y, hsh(d, s, 1) * 6.283); SCV.set(r * 1.4 * (0.9 + 0.2 * hsh(s, d, 2)), h, r * 1.4 * (0.9 + 0.2 * hsh(d, d, 3)));
      M4.compose(w, Q, SCV); im.setMatrixAt(k, M4); REF[i * 2] = CHUNKS.length; REF[i * 2 + 1] = k;
      col.setRGB(u8[i * 4] / 255 * 0.92, u8[i * 4 + 1] / 255 * 0.86, u8[i * 4 + 2] / 255 * 0.8).convertSRGBToLinear(); im.setColorAt(k, col);
      bb.expandByPoint(w); bb.expandByPoint(_a.set(w.x, w.y + h, w.z));
      pos[i * 3] = w.x; pos[i * 3 + 1] = w.y; pos[i * 3 + 2] = w.z; dim[i * 2] = h; dim[i * 2 + 1] = r * 1.24;
      const gk = Math.floor(w.x / GC) + ',' + Math.floor(w.z / GC); if (!GRID.has(gk)) GRID.set(gk, []); GRID.get(gk).push(i | (kind << 24));
    });
    bb.expandByScalar(4); const sph = bb.getBoundingSphere(new THREE.Sphere()); geos.forEach(g => { g.boundingSphere = sph; g.boundingBox = bb; });
    CHUNKS.push({ im, geos, c: sph.center, r: sph.radius, lod: 2 });
    im.castShadow = !LOWQ; im.receiveShadow = !LOWQ; im.frustumCulled = true; im.userData.irBase = 0.13; scene.add(im);
  }
  // 충돌: 줄기(캡슐) + 수관(세로 캡슐, 침엽수는 원뿔이라 위로 갈수록 가늘게)
  function col1(p, Rr) {
    const gx = Math.floor(p.x / GC), gz = Math.floor(p.z / GC); let best = null;
    for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const L = GRID.get(ix + ',' + iz); if (!L) continue;
      for (const v of L) {
        const i = v & 0xffffff, kind = v >> 24, x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], h = dim[i * 2], r = dim[i * 2 + 1];
        if (p.y > y + h + Rr || p.y < y - Rr) continue;
        const dx = p.x - x, dz = p.z - z, hd = Math.hypot(dx, dz); if (hd > r + Rr) continue;
        // 높이별 반지름
        const t = (p.y - y) / h;
        const c0 = kind === 1 ? 0.82 : kind === 2 ? 0.45 : 0.62, hh = kind === 1 ? 0.2 : kind === 2 ? 0.5 : 0.38;   // 수관 중심 높이 · 반높이 (비율)
        const rr = kind === 3 ? Math.max(t < 0.22 ? 0.12 : 0, t >= 0.22 && t <= 1 ? r * 0.95 * (1 - (t - 0.22) / 0.78) : 0)   // 원뿔
          : Math.max(t < c0 ? 0.12 : 0, r * Math.sqrt(Math.max(0, 1 - Math.pow((t - c0) / hh, 2))));
        const pen = rr + Rr - hd; if (pen <= 0) continue;
        if (!best || pen > best.pen) best = { pen, n: hd > 1e-4 ? new V3(dx / hd, 0, dz / hd) : new V3(1, 0, 0), tag: 'tree' };
      }
    }
    return best;
  }
  // 카메라 거리로 세밀도 바꿈 (0.3 초마다)
  function lod(cam) {
    const far = (typeof c1VRon === 'function' && c1VRon()) ? 420 : 1e9;   // 1종 VR: 조종자가 제자리 → 먼 숲은 생략
    for (const k of CHUNKS) { const d = Math.max(0, cam.distanceTo(k.c) - k.r * 0.7), l = d < (LOWQ ? 50 : 90) ? 0 : d < (LOWQ ? 170 : 300) ? 1 : 2;
      k.im.visible = d < far; if (l !== k.lod) { k.lod = l; k.im.geometry = k.geos[l]; } }
  }
  setInterval(() => lod(camera.position), 300);
  // 산불: 불난 자리 나무를 그을린 앙상한 줄기로 (숲에 구멍이 나서 위에서 불길이 보이게) · 임무가 바뀌면 되돌림
  const BURNT = [], _m = new THREE.Matrix4(), _p = new V3(), _q = new THREE.Quaternion(), _s = new V3(), _c = new THREE.Color();
  function scorch(p, R) {
    const gx = Math.floor(p.x / GC), gz = Math.floor(p.z / GC), g = Math.ceil(R / GC);
    for (let ix = gx - g; ix <= gx + g; ix++) for (let iz = gz - g; iz <= gz + g; iz++) { const L = GRID.get(ix + ',' + iz); if (!L) continue;
      for (const v of L) { const i = v & 0xffffff; if (Math.hypot(pos[i * 3] - p.x, pos[i * 3 + 2] - p.z) > R || BURNT.some(b => b.i === i)) continue;
        const ch = CHUNKS[REF[i * 2]], k = REF[i * 2 + 1], im = ch.im; im.getMatrixAt(k, _m); const m0 = _m.clone(); im.getColorAt(k, _c); const c0 = _c.clone();
        _m.decompose(_p, _q, _s); _s.x *= 0.22; _s.z *= 0.22; _s.y *= 0.8; _m.compose(_p, _q, _s); im.setMatrixAt(k, _m); im.setColorAt(k, _c.setRGB(0.035, 0.03, 0.025));
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; BURNT.push({ i, im, k, m0, c0, r0: dim[i * 2 + 1] }); dim[i * 2 + 1] *= 0.25; } }
  }
  function unscorch() { for (const b of BURNT) { b.im.setMatrixAt(b.k, b.m0); b.im.setColorAt(b.k, b.c0); b.im.instanceMatrix.needsUpdate = true; if (b.im.instanceColor) b.im.instanceColor.needsUpdate = true; dim[b.i * 2 + 1] = b.r0; } BURNT.length = 0; }
  function hideRect(cx, cz, ux, uz, L, Wd) {   // 활주로 띠 안의 나무를 없앰 (영구)
    let n0 = 0; const R = Math.hypot(L, Wd) / 2, gx = Math.floor(cx / GC), gz = Math.floor(cz / GC), g = Math.ceil(R / GC);
    for (let ix = gx - g; ix <= gx + g; ix++) for (let iz = gz - g; iz <= gz + g; iz++) { const Lc = GRID.get(ix + ',' + iz); if (!Lc) continue;
      for (const v of Lc) { const i = v & 0xffffff, dx = pos[i * 3] - cx, dz = pos[i * 3 + 2] - cz, t = dx * ux + dz * uz, w = -dx * uz + dz * ux;
        if (Math.abs(t) > L / 2 || Math.abs(w) > Wd / 2 || dim[i * 2] === 0) continue;
        const ch = CHUNKS[REF[i * 2]], k = REF[i * 2 + 1]; ch.im.getMatrixAt(k, _m); _m.decompose(_p, _q, _s); _s.set(0.0001, 0.0001, 0.0001); _m.compose(_p, _q, _s); ch.im.setMatrixAt(k, _m); ch.im.instanceMatrix.needsUpdate = true; dim[i * 2] = 0; dim[i * 2 + 1] = 0; n0++; } }
    return n0;
  }
  return { n, col: col1, lod, scorch, unscorch, hideRect };
})();
if (CRS_C) { for (const [d, s] of CRS_C.cones) buildCone(W(d, s, 0)); }
else { buildLogoPanel(); buildFlag(); for (let d = 10; d <= 300; d += 15) for (const s of [-15, 15]) buildCone(W(d, s, 0)); }

// =====================================================================
//  drone model — Skydio X2D 형상 (펼친 크기 66 x 57 x 21 cm, 1.3 kg)
//  앞 = -z. 접이식 팔 4개(앞 팔은 프로펠러 위, 뒤 팔은 거꾸로 달린 모터),
//  기수 아래 짐벌(컬러 + 열상 2안), 위·아래 내비게이션 어안 카메라 6개, 뒤쪽 멀티밴드 안테나
// =====================================================================
function makeDrone(ghost) {
  const g = new THREE.Group();
  const gm = ghost ? new THREE.MeshBasicMaterial({ color: 0x55e6ff, transparent: true, opacity: 0.38, depthWrite: false }) : null;
  const m = c => gm || c;
  const shell = m(mat(0x34383d, { roughness: 0.55, metalness: 0.15 })), shellD = m(mat(0x22252a, { roughness: 0.6 }));
  const carbon = m(mat(0x1b1d20, { roughness: 0.42, metalness: 0.25 })), batt = m(mat(0x55595f, { roughness: 0.5 }));
  const mot = m(mat(0x8d9297, { roughness: 0.3, metalness: 0.8 })), glass = m(mat(0x0a1420, { roughness: 0.05, metalness: 0.6 }));
  const lensRing = m(mat(0x101215, { roughness: 0.3, metalness: 0.4 })), accent = m(mat(0xc8ccd0, { roughness: 0.4, metalness: 0.3 }));
  const add = (geo, mt, x, y, z, sx, sy, sz, par) => { const me = new THREE.Mesh(geo, mt); me.position.set(x, y, z); if (sx) me.scale.set(sx, sy, sz); me.castShadow = !ghost; (par || g).add(me); return me; };
  // 몸통: 길쭉한 유선형 (캡슐을 납작하게) + 아래 판
  const body = add(UCAP, shell, 0, 0, 0, 0.056, 0.105, 0.034); body.rotation.x = Math.PI / 2;
  add(UBOX, shellD, 0, -0.022, 0.01, 0.1, 0.022, 0.25);
  // 배터리 (뒤 위쪽, 밝은 회색) + 걸쇠
  add(UBOX, batt, 0, 0.03, 0.065, 0.085, 0.03, 0.13);
  add(UBOX, accent, 0, 0.046, 0.12, 0.05, 0.006, 0.014);
  // 기수 짐벌: 둥근 하우징 + 두 렌즈 (컬러 · 열상)
  const gim = new THREE.Group(); gim.position.set(0, -0.03, -0.165); g.add(gim);
  add(USPH, shellD, 0, 0, 0, 0.034, 0.03, 0.03, gim);
  add(UCYL, lensRing, -0.012, 0, -0.026, 0.011, 0.012, 0.011, gim).rotation.x = Math.PI / 2;
  add(UCYL, glass, -0.012, 0, -0.033, 0.008, 0.004, 0.008, gim).rotation.x = Math.PI / 2;
  add(UCYL, lensRing, 0.013, 0, -0.025, 0.008, 0.012, 0.008, gim).rotation.x = Math.PI / 2;
  add(UCYL, m(mat(0x1a1408, { roughness: 0.1, metalness: 0.7 })), 0.013, 0, -0.031, 0.006, 0.004, 0.006, gim).rotation.x = Math.PI / 2;
  // 내비게이션 어안 카메라 6개 (위 3 · 아래 3)
  for (const [x, y, z] of [[0, 0.034, -0.12], [-0.035, 0.05, 0.12], [0.035, 0.05, 0.12], [0, -0.036, -0.1], [-0.04, -0.036, 0.1], [0.04, -0.036, 0.1]]) {
    add(UCYL, lensRing, x, y, z, 0.011, 0.008, 0.011);
    add(USPH, glass, x, y + Math.sign(y) * 0.004, z, 0.008, 0.005, 0.008);
  }
  // 팔 + 모터 + 프로펠러 (앞: 위로, 뒤: 아래로)
  const props = [], blur = gm || new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const bladeM = m(mat(0x26292d, { roughness: 0.45 })), PR = 0.092;
  const ARMS = [[0.24, -0.17, -0.04, 1], [-0.24, -0.17, -0.04, 1], [0.235, 0.19, -0.02, -1], [-0.235, 0.19, -0.02, -1]];
  for (const [x, z, root, up] of ARMS) {
    const rx = Math.sign(x) * 0.045, rz = Math.sign(z) * 0.07, dx = x - rx, dz = z - rz, L = Math.hypot(dx, dz);
    const arm = add(UBOX, carbon, (x + rx) / 2, root, (z + rz) / 2, 0.026, 0.016, L); arm.rotation.y = Math.atan2(dx, dz);
    add(UCYL, carbon, rx, root, rz, 0.018, 0.02, 0.018);                       // 접힘 힌지
    const my = root + up * 0.017;
    add(UCYL, mot, x, my, z, 0.021, 0.026, 0.021);
    add(UCYL, carbon, x, root, z, 0.026, 0.012, 0.026);
    const py = my + up * 0.016;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(PR, 28), blur); disc.rotation.x = -Math.PI / 2; disc.position.set(x, py, z); g.add(disc);
    const hub = new THREE.Group(); hub.position.set(x, py, z); g.add(hub);
    for (const s of [1, -1]) { const b = add(UBOX, bladeM, s * PR * 0.5, 0, 0, PR, 0.003, 0.019, hub); b.rotation.x = s * 0.18; }
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
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); AU.ctx = ctx;
    AU.master = ctx.createGain(); AU.master.gain.value = 0.55; AU.master.connect(ctx.destination);
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
function audioUpdate(thrust, speed, active) {
  if (!AU.ctx) return; const t = AU.ctx.currentTime;
  const on = AU.on && active ? 1 : 0;
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


// =====================================================================
//  background music (절차 생성: 장면별 스타일 5가지, 구간마다 화음·멜로디 새로 만듦)
// =====================================================================
const MUS = { on: true, vol: 0.5, timer: null, next: 0, step: 0, bus: null };
try { const m = JSON.parse(localStorage.getItem('fpvsim_fpv_music') || '{}'); if (m.on !== undefined) MUS.on = m.on; if (m.vol !== undefined) MUS.vol = m.vol; } catch (e) { }
function saveMusic() { try { localStorage.setItem('fpvsim_fpv_music', JSON.stringify({ on: MUS.on, vol: MUS.vol })); } catch (e) { } }
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
const BPM = 126;
const CHORDS = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]];   // Am F C G
const HOOK = [[76, 0, 74, 76, 0, 72, 74, 0], [72, 0, 72, 74, 0, 77, 76, 0], [79, 0, 76, 74, 0, 72, 74, 0], [74, 0, 71, 72, 74, 0, 79, 0]];
function musicLevel() { return MUS.on ? MUS.vol * 0.42 : 0; }
function musicStart() {
  if (!AU.ctx || MUS.timer) return;
  const ctx = AU.ctx;
  MUS.bus = ctx.createGain(); MUS.bus.gain.value = musicLevel();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5;
  MUS.bus.connect(comp); comp.connect(AU.master);
  MUS.duck = ctx.createGain(); MUS.duck.connect(MUS.bus);                 // 킥에 맞춰 눌리는 (사이드체인) 버스
  MUS.dly = ctx.createDelay(1); MUS.dly.delayTime.value = 3 * 60 / BPM / 4;  // 리드용 딜레이
  const fb = ctx.createGain(); fb.gain.value = 0.32; const wet = ctx.createGain(); wet.gain.value = 0.28;
  MUS.dly.connect(fb); fb.connect(MUS.dly); MUS.dly.connect(wet); wet.connect(MUS.bus);
  MUS.next = ctx.currentTime + 0.12; MUS.step = 0;
  MUS.timer = setInterval(musicSchedule, 25);
}
function musicSetLevel() { if (MUS.bus && AU.ctx) MUS.bus.gain.setTargetAtTime(musicLevel(), AU.ctx.currentTime, 0.2); }
function note(type, f, t, dur, gain, cut, dest, atk) {
  const ctx = AU.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
  let node = o;
  if (cut) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cut, t); lp.frequency.exponentialRampToValueAtTime(Math.max(cut * 0.25, 80), t + dur); o.connect(lp); node = lp; }
  node.connect(g); g.connect(dest || MUS.bus);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (atk || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05); return o;
}
function noiseHit(t, type, freq, q, gain, dur, dest) {
  const ctx = AU.ctx, s = ctx.createBufferSource(); s.buffer = AU.noise; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || MUS.bus); s.start(t, Math.random()); s.stop(t + dur + 0.02); return f;
}
// ---- 곡 구성: 장면에 따라 다른 스타일, 구간(인트로·A·B·브레이크)마다 화음·멜로디를 새로 만듦 ----
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
function chordOf(name) {   // 'Am' -> [베이스(E2~D#3), [3화음(G3~F#4 근음)]]
  const m = /^([A-G][b#]?)(m?)(7?)$/.exec(name), r = NOTE[m[1]], minor = !!m[2];
  const root = 40 + ((r - 4 + 12) % 12), t0 = 55 + ((r - 7 + 12) % 12), tri = [t0, t0 + (minor ? 3 : 4), t0 + 7];
  if (m[3]) tri.push(t0 + 10); return [root, tri];
}
const STYLES = {
  drive:   { bpm: 126, scale: [0, 2, 3, 5, 7, 8, 10], key: 9, progs: [['Am', 'F', 'C', 'G'], ['Am', 'G', 'F', 'G'], ['F', 'G', 'Am', 'Am'], ['Dm', 'F', 'Am', 'G']], kick: 'four', bass: 'roll', lead: 'sawtooth', arp: 16, hat: 16 },
  action:  { bpm: 140, scale: [0, 2, 3, 5, 7, 8, 10], key: 4, progs: [['Em', 'C', 'G', 'D'], ['Em', 'D', 'C', 'B'], ['C', 'D', 'Em', 'Em'], ['Em', 'G', 'D', 'C']], kick: 'four', bass: 'oct', lead: 'square', arp: 16, hat: 16 },
  tension: { bpm: 98, scale: [0, 1, 3, 5, 7, 8, 10], key: 2, progs: [['Dm', 'Bb', 'Gm', 'A'], ['Dm', 'Dm', 'Bb', 'A'], ['Gm', 'Dm', 'Bb', 'A'], ['Dm', 'C', 'Bb', 'A']], kick: 'half', bass: 'pulse', lead: 'triangle', arp: 8, hat: 8, drone: true },
  forest:  { bpm: 112, scale: [0, 2, 4, 7, 9], key: 7, progs: [['G', 'Em', 'C', 'D'], ['Em', 'C', 'G', 'D'], ['C', 'G', 'D', 'Em'], ['G', 'D', 'Em', 'C']], kick: 'two', bass: 'walk', lead: 'triangle', arp: 8, hat: 8, pluck: true },
  night:   { bpm: 84, scale: [0, 2, 3, 5, 7, 8, 10], key: 0, progs: [['Cm', 'Ab', 'Eb', 'Bb'], ['Cm', 'Fm', 'Ab', 'G'], ['Ab', 'Eb', 'Bb', 'Cm']], kick: 'sparse', bass: 'long', lead: 'sine', arp: 8, hat: 0, drone: true }
};
const SECTIONS = [{ n: 'intro', bars: 4, e: 1 }, { n: 'A', bars: 8, e: 2 }, { n: 'B', bars: 8, e: 3 }, { n: 'brk', bars: 4, e: 1 }, { n: 'A2', bars: 8, e: 3 }, { n: 'B2', bars: 8, e: 4 }];
const SONG = { style: 'drive', want: 'drive', sec: 0, bar: 0, prog: null, motif: null, seed: 1, rnd: Math.random };
function songStyleFor() {
  if (typeof ENV !== 'undefined' && ENV.night) return 'night';
  if (S.state === 'menu' || S.state === 'result') return 'drive';
  const k = S.kind; if (k === 'race' || k === 'strike') return 'action';
  if (k === 'forest') return 'forest';
  if (k === 'recon' || k === 'fire' || k === 'sar' || k === 'track') return 'tension';
  if (k === 'ridge') return 'forest';
  return 'drive';
}
function songSection() {   // 구간이 바뀔 때마다 새 화음 진행·멜로디
  const st = STYLES[SONG.style], r = SONG.rnd;
  SONG.prog = st.progs[Math.floor(r() * st.progs.length)].map(chordOf);
  const sc = st.scale, base = 62 + ((st.key - 2 + 12) % 12), L = [];   // 멜로디 음역 D4~F#5
  let deg = Math.floor(r() * sc.length);
  for (let i = 0; i < 16; i++) {   // 8분음표 16개 = 2마디 동기
    if (r() < (SECTIONS[SONG.sec].e >= 3 ? 0.3 : 0.45)) { L.push(0); continue; }
    deg = Math.max(0, Math.min(sc.length + 2, deg + Math.round((r() - 0.5) * 4)));
    L.push(base + sc[deg % sc.length] + 12 * Math.floor(deg / sc.length));
  }
  SONG.motif = L; SONG.var = L.map(n => n && r() < 0.35 ? n + (r() < 0.5 ? 2 : -1) : n);
}
function musicSchedule() {
  const ctx = AU.ctx; if (!ctx) return;
  while (MUS.next < ctx.currentTime + 0.15) {
    let st = STYLES[SONG.style]; const s16 = 60 / st.bpm / 4, t = MUS.next, step = MUS.step % 16;
    if (step === 0) {   // 마디 시작
      if (!SONG.prog) songSection();
      SONG.bar++; let sec = SECTIONS[SONG.sec];
      const want = songStyleFor(); SONG.want = want;
      if (SONG.bar >= sec.bars || (want !== SONG.style && SONG.bar % 4 === 0)) {
        SONG.bar = 0; SONG.sec = (SONG.sec + 1) % SECTIONS.length;
        if (want !== SONG.style) { SONG.style = want; SONG.sec = 0; st = STYLES[want]; MUS.dly && MUS.dly.delayTime.setValueAtTime(3 * 60 / st.bpm / 4, t); }
        songSection();
      }
    }
    const sec = SECTIONS[SONG.sec], bar = SONG.bar, ch = SONG.prog[bar % 4];
    // 속도·부스트에 따라 한 단계 더
    let e = sec.e; if (S.state === 'run' && (S.boosting || (DR.v && DR.v.length() > 14))) e = Math.min(4, e + 1); if (S.state === 'menu') e = Math.min(e, 2);
    const last = bar === sec.bars - 1;
    if (MUS.on && MUS.vol > 0) {
      const k = st.kick, kickOn = e >= 2 && (k === 'four' ? step % 4 === 0 : k === 'half' ? step === 0 || step === 8 : k === 'two' ? step === 0 || step === 10 : step === 0 && bar % 2 === 0);
      if (kickOn || (e === 1 && step === 0 && k !== 'sparse')) {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(e === 1 ? 0.5 : 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(g); g.connect(MUS.bus); o.start(t); o.stop(t + 0.3);
        MUS.duck.gain.setValueAtTime(0.3, t); MUS.duck.gain.linearRampToValueAtTime(1, t + s16 * 3);
      }
      if (e >= 2 && (step === 4 || step === 12) && k !== 'sparse') { noiseHit(t, 'bandpass', 1800, 0.8, 0.32, 0.17); noiseHit(t, 'highpass', 3000, 0, 0.1, 0.09); }
      if (st.hat && e >= 2 && step % (16 / st.hat) === 0) noiseHit(t, 'highpass', 8000, 0, step % 4 === 2 ? 0.09 : 0.035, step % 4 === 2 ? 0.12 : 0.035);
      if (st.drone && step === 0 && bar % 2 === 0) note('sine', mf(ch[0] - 12), t, s16 * 32, 0.05, 0, MUS.duck, 0.4);
      // 베이스
      const b = st.bass, bn = ch[0] - 12;
      if (b === 'roll' && step % 4 !== 0) note('sawtooth', mf(bn + (step % 4 === 2 ? 12 : 0)), t, s16 * 0.9, 0.15, 650, MUS.duck);
      if (b === 'oct' && step % 2 === 0) note('sawtooth', mf(bn + (step % 4 === 2 ? 12 : 0)), t, s16 * 1.6, 0.15, 800, MUS.duck);
      if (b === 'pulse' && step % 2 === 0 && e >= 1) note('square', mf(bn), t, s16 * 1.2, 0.08, 420, MUS.duck);
      if (b === 'walk' && step % 4 === 0) note('triangle', mf(bn + [0, 7, 12, 7][step / 4]), t, s16 * 3.5, 0.2, 0, MUS.duck);
      if (b === 'long' && step === 0) note('sine', mf(bn), t, s16 * 15, 0.16, 0, MUS.duck, 0.05);
      // 패드
      if (step === 0) for (const n of ch[1]) note('sawtooth', mf(n), t, s16 * 15, e >= 3 ? 0.02 : 0.026, e >= 3 ? 1800 : 1100, MUS.duck, 0.18);
      // 아르페지오 (에너지 3 이상, 또는 숲 스타일의 퉁기는 소리)
      if ((e >= 3 || st.pluck) && step % (16 / st.arp) === 0) { const ar = ch[1].concat(ch[1].map(n => n + 12)), i = (step / (16 / st.arp) + bar) % ar.length; note(st.pluck ? 'triangle' : 'square', mf(ar[i] + (st.pluck ? 0 : 12)), t, s16 * (st.pluck ? 2.5 : 0.8), st.pluck ? 0.05 : 0.022, st.pluck ? 2400 : 3200, MUS.duck); }
      // 멜로디 (A·B 구간, 2마디 동기 + 변형)
      if (sec.n !== 'intro' && sec.n !== 'brk' && step % 2 === 0) { const M = bar % 4 >= 2 ? SONG.var : SONG.motif, n = M[(bar % 2) * 8 + step / 2]; if (n && (e >= 3 || sec.n === 'A')) { note(st.lead, mf(n), t, s16 * 1.8, st.lead === 'sine' || st.lead === 'triangle' ? 0.07 : 0.04, 3400); if (e >= 3) note('square', mf(n) * 1.004, t, s16 * 1.8, 0.022, 3000, MUS.dly); } }
      // 구간 끝 필인·상승음, 시작 크래시
      if (last && step === 0 && e >= 2) { const f = noiseHit(t, 'highpass', 400, 0, 0.05, s16 * 16); f.frequency.exponentialRampToValueAtTime(9000, t + s16 * 16); }
      if (last && step >= 12 && e >= 2) noiseHit(t, 'bandpass', 1900, 0.8, 0.2 + (step - 12) * 0.05, 0.1);
      if (bar === 0 && step === 0 && sec.e >= 2) noiseHit(t, 'highpass', 5000, 0, 0.16, 1.6);
    }
    MUS.next += s16; MUS.step++;
  }
}

// =====================================================================
//  input (keyboard + gamepad / RC 송신기)
// =====================================================================
const keys = {};
const TOUCH = { on: false, thr: 0, yaw: 0, pitch: 0, roll: 0 };
const IS_TOUCH = !!window.SIM_MOBILE || ((('ontouchstart' in window) || navigator.maxTouchPoints > 0) && window.matchMedia && matchMedia('(pointer: coarse)').matches);

const IN = { thr: 0, yaw: 0, pitch: 0, roll: 0, src: 'KEY' };
const ks = { thr: 0, yaw: 0, pitch: 0, roll: 0 };
const pressed = [];
const RC_DEFAULT = {
  axes: { thr: { i: 1, inv: true }, yaw: { i: 0, inv: false }, pitch: { i: 3, inv: true }, roll: { i: 2, inv: false } },
  btn: { drop: { type: 'btn', i: 0 }, cam: { type: 'btn', i: 1 }, reset: { type: 'btn', i: 3 } },
  thrType: 'center', cal: {}, pad: -1
};
let RC = JSON.parse(JSON.stringify(RC_DEFAULT));
try { const r = JSON.parse(localStorage.getItem('fpvsim_fpv_rc') || 'null'); if (r && r.axes) RC = Object.assign(RC, r); } catch (e) { }
function saveRC() { try { localStorage.setItem('fpvsim_fpv_rc', JSON.stringify(RC)); } catch (e) { } }
// ---- 키보드 지정 (사용자가 바꿀 수 있음) ----
const KB_PRESET = {
  A: { up: 'KeyW', down: 'KeyS', yawL: 'KeyA', yawR: 'KeyD', fwd: 'ArrowUp', back: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', drop: 'Space', cam: 'KeyC', zoom: 'KeyZ', reset: 'KeyR', assist: 'KeyH', boost: 'ShiftLeft' },
  B: { up: 'ArrowUp', down: 'ArrowDown', yawL: 'ArrowLeft', yawR: 'ArrowRight', fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', drop: 'Space', cam: 'KeyC', zoom: 'KeyZ', reset: 'KeyR', assist: 'KeyH', boost: 'ShiftLeft' }
};
const KB_CANON = { drop: 'Space', cam: 'KeyC', zoom: 'KeyZ', reset: 'KeyR', assist: 'KeyH' };
const KB_RESERVED = ['KeyT', 'Escape', 'Enter', 'Tab', 'KeyF', 'KeyB', 'KeyM', 'KeyG', 'KeyP', 'KeyL', 'KeyN', 'KeyV', 'KeyX', 'MetaLeft', 'MetaRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4'];
let KB = Object.assign({}, KB_PRESET.A);
try { const k = JSON.parse(localStorage.getItem('fpvsim_fpv_keys2') || 'null'); if (k && k.up) KB = Object.assign({}, KB_PRESET.A, k); } catch (e) { }
function saveKB() { try { localStorage.setItem('fpvsim_fpv_keys2', JSON.stringify(KB)); } catch (e) { } }
function kbWhich() { for (const p of ['A', 'B']) if (Object.keys(KB_PRESET[p]).every(k => KB_PRESET[p][k] === KB[k])) return p; return 'C'; }
function keyName(c) {
  if (!c) return '—';
  const M = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'Caps' };
  if (M[c]) return M[c]; if (c.startsWith('Key')) return c.slice(3); if (c.startsWith('Digit')) return c.slice(5); if (c.startsWith('Numpad')) return 'Num' + c.slice(6); return c;
}
let KBCAP = null;   // 키 지정 화면에서 다음 입력을 기다리는 기능 이름
addEventListener('keydown', e => {
  if (KBCAP) { e.preventDefault(); e.stopPropagation(); kbCapture(e.code); return; }
  const inInput = e.target && e.target.tagName === 'INPUT';
  if (inInput && e.target.type !== 'range') return;   // 이름 입력 중에는 게임 키로 쓰지 않음
  const act = Object.keys(KB).find(k => KB[k] === e.code);
  if (!inInput && (act || ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))) e.preventDefault();
  initAudio(); musicStart();
  let code = e.code;
  if (act && KB_CANON[act]) code = KB_CANON[act];                       // 기능 키 -> 내부 이름
  else if (act) code = 'MV_' + e.code;                                   // 이동 키는 다른 기능을 하지 않음
  else if (Object.values(KB_CANON).includes(e.code) && e.code !== 'Space') code = 'X_' + e.code;   // 다른 키로 옮긴 기능은 무시
  else if (e.code === 'Space') code = 'X_Space';
  if (!keys[e.code]) pressed.push(code);
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('pointerdown', () => { initAudio(); musicStart(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function getPad() {
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  if (!pads.length) return null;
  return pads.find(p => p.index === RC.pad) || pads[0];
}
function calAxis(gp, i) {
  const raw = gp.axes[i] || 0, c = RC.cal[i];
  if (!c) return raw;
  const v = raw >= c.c ? (raw - c.c) / Math.max(c.max - c.c, 1e-3) : (raw - c.c) / Math.max(c.c - c.min, 1e-3);
  return clamp(v, -1, 1);
}
// 스틱 곡선: real = 거의 선형(민 만큼 기울기·속도, 실제 조종기 기본값에 가까움) · soft = 가운데가 무딘 엑스포
function stickExpo(vr) { return SET.expo || (vr ? 'real' : 'soft'); }
function stickCurve(v, dz, vr) { if (stickExpo(vr) !== 'real') return shape(v, dz); if (Math.abs(v) < dz) return 0; const s = (Math.abs(v) - dz) / (1 - dz); return Math.sign(v) * Math.min(1, 0.8 * s + 0.2 * s * s * s); }
function shape(v, deadz) { if (Math.abs(v) < deadz) return 0; const s = (Math.abs(v) - deadz) / (1 - deadz); return Math.sign(v) * (0.4 * s + 0.6 * s * s * s); }
const padPrevBtn = {};
function btnState(gp, b) {
  if (!b) return false;
  if (b.type === 'btn') return !!(gp.buttons[b.i] && gp.buttons[b.i].pressed);
  return ((gp.axes[b.i] || 0) * (b.sign || 1)) > 0.5;
}
function readInput(dt) {
  const tgt = {
    thr: (keys[KB.up] ? 1 : 0) - (keys[KB.down] ? 1 : 0), yaw: (keys[KB.yawR] ? 1 : 0) - (keys[KB.yawL] ? 1 : 0),
    pitch: (keys[KB.fwd] ? 1 : 0) - (keys[KB.back] ? 1 : 0), roll: (keys[KB.right] ? 1 : 0) - (keys[KB.left] ? 1 : 0)
  };
  for (const k in tgt) { const r = tgt[k] === 0 ? 7 : 3.2; ks[k] += clamp(tgt[k] - ks[k], -r * dt, r * dt); }
  IN.thr = ks.thr; IN.yaw = ks.yaw; IN.pitch = ks.pitch; IN.roll = ks.roll; IN.src = 'KEY';
  IN.boost = !!BOOST.on;
  if (TOUCH.on) { for (const k of ['thr', 'yaw', 'pitch', 'roll']) if (Math.abs(TOUCH[k]) > Math.abs(IN[k])) { IN[k] = TOUCH[k]; IN.src = 'TOUCH'; } }
  const gp = getPad();
  if (gp && !RCUI.open) {
    const st = {};
    for (const k of ['thr', 'yaw', 'pitch', 'roll']) {
      const a = RC.axes[k]; let v = calAxis(gp, a.i); if (a.inv) v = -v;
      st[k] = stickCurve(v, k === 'thr' && RC.thrType === 'bottom' ? 0.12 : 0.07, false);
    }
    const any = Math.abs(st.thr) + Math.abs(st.yaw) + Math.abs(st.roll) + Math.abs(st.pitch) > 0.02;
    if (any) { for (const k in st) if (Math.abs(st[k]) > Math.abs(IN[k])) IN[k] = st[k]; IN.src = 'PAD'; }
    const map = { drop: 'Space', cam: 'KeyC', reset: 'KeyR' };
    for (const k in map) { const s = btnState(gp, RC.btn[k]); if (s && !padPrevBtn[k]) pressed.push(map[k]); padPrevBtn[k] = s; }
    const sb = gp.buttons[9] && gp.buttons[9].pressed; if (sb && !padPrevBtn.start) pressed.push('Escape'); padPrevBtn.start = sb;
    if (gp.buttons[6] && gp.buttons[6].value > 0.4 && SET.diff !== 'atti') IN.boost = true;
    if (gp.mapping === 'standard') {   // Xbox / 표준 배치 추가 버튼
      const ex = { rt: [7, 'Space'], lb: [4, 'PadLB'], rb: [5, 'PadRB'], x: [2, 'KeyH'], back: [8, 'KeyG'], rs: [11, 'KeyL'], up: [12, 'PadUp'], down: [13, 'PadDown'], left: [14, 'PadLeft'], right: [15, 'PadRight'], a: [0, 'PadA'] };
      for (const k in ex) { const bt = gp.buttons[ex[k][0]]; const s = !!(bt && (bt.pressed || bt.value > 0.5)); if (s && !padPrevBtn['x' + k]) pressed.push(ex[k][1]); padPrevBtn['x' + k] = s; }
    }
  }
  if (XR_ON) xrInput(dt);   // VR 컨트롤러 스틱
}
const RCUI = { open: false };
function rumble(strong, weak, ms) {
  try { if (TOUCH.on && navigator.vibrate) navigator.vibrate(Math.round((ms || 180) * Math.max(strong, weak) * 0.6)); } catch (e) { }
  try { const gp = getPad(); const va = gp && gp.vibrationActuator; if (va && va.playEffect) va.playEffect('dual-rumble', { duration: ms || 180, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { }
}

// =====================================================================
//  game state
// =====================================================================
const MODES = {
  train: { name: 'TRAINING', gps: true, maxTilt: 25 * DEG, vmax: 9, yawRate: 95 * DEG, althold: true, brake: 2.6, assist: 1.0, autoYaw: true, margin: 0.22, hitPen: 2 },
  easy: { name: 'EASY', gps: true, maxTilt: 32 * DEG, vmax: 12, yawRate: 120 * DEG, althold: true, brake: 1.3, assist: 0.45, autoYaw: false, margin: 0.1, hitPen: 3 },
  // ATTI: 위치 유지(GPS) 없음 · 놓아도 안 멈추고 관성·바람으로 흐름 · 고도 유지만 · 부스트 없음 → 스틱을 민 만큼(기울기) 속도가 남
  atti: { name: 'ATTI', maxTilt: 30 * DEG, vmax: 12, yawRate: 110 * DEG, althold: true, brake: 0, assist: 0, autoYaw: false, margin: 0, hitPen: 3, atti: true },
  sport: { name: 'SPORT', maxTilt: 38 * DEG, vmax: 14, yawRate: 220 * DEG, althold: false, brake: 0, assist: 0, autoYaw: false, margin: 0, hitPen: 5 }
};
const ZOOMS = [{ d: 7.0, h: 2.4, fov: 64 }, { d: 4.2, h: 1.4, fov: 60 }, { d: 2.4, h: 0.8, fov: 56 }];   // 추적 카메라 거리 (멀리·보통·가까이)
const SET = { belly: true, guide: true, keymap: 'A', zoom: 1, diff: 'train', ghost: true, ghostSrc: 'ref', tilt: 15, showPath: false, light: false, assist: true, autoFull: true, af: 'x2d', acro: false, night: false, wind: 0, voice: true, vrMode: 2, vrModeW: 1, vrScreen: 'space', vrScr2: 1, vrCam: 'fpv', vrPip: 0, vrMap: true };
// 저장 구조: 일반 설정은 평탄, 종목별 설정은 하위 묶음 (c1: 1종 실기). 구버전(평탄 c1xxx 키)도 읽음
const SET_GROUPS = ['c1'];
try { const s = JSON.parse(localStorage.getItem('fpvsim_fpv_settings') || '{}'); for (const g of SET_GROUPS) { const sub = s[g]; delete s[g]; if (sub && typeof sub === 'object') for (const k in sub) SET[g + k] = sub[k]; } Object.assign(SET, s); } catch (e) { }
if (!SET.vrScr2) { SET.vrScreen = 'space'; SET.vrScr2 = 1; }   // VR 기본 화면: 공간 고정 (한 번 바꿔 줌, 그 뒤엔 고른 값 유지)
if (!MODES[SET.diff]) SET.diff = 'train';
const SET_KEYS = ['belly', 'guide', 'keymap', 'zoom', 'diff', 'ghost', 'ghostSrc', 'tilt', 'assist', 'autoFull', 'af', 'acro', 'night', 'wind', 'voice', 'vrMode', 'vrScreen', 'vrCam', 'vrPip', 'vrMap', 'vrScr2', 'vrModeW', 'hud', 'expo', 'tod', 'wx', 'wxFx'];
function saveSet() {
  try { const o = {}; for (const k of SET_KEYS) if (SET[k] !== undefined) o[k] = SET[k];
    for (const g of SET_GROUPS) { const sub = {}; let n = 0; for (const k in SET) if (k.startsWith(g) && k.length > g.length && SET[k] !== undefined) { sub[k.slice(g.length)] = SET[k]; n++; } if (n) o[g] = sub; }   // 종목 설정은 접두사로 모아 묶음 (새 키를 따로 등록할 필요 없음)
    localStorage.setItem('fpvsim_fpv_settings', JSON.stringify(o)); } catch (e) { } }

const DR = { p: new V3(), v: new V3(), h: 0, pitch: 0, roll: 0, landed: true, thrust: 0, R: 0.24, alive: true };
const S = {
  state: 'menu', kind: 'course', t: 0, running: false, finished: false, objIdx: 0, objState: [], pen: 0, impacts: 0, payloads: 3,
  cam: 1, respawn: null, scan: 0, wasInside: false, landT: 0, simT: 0, ghostT: 0, demoEvents: 0, hits: 0, misses: 0,
  hitCD: 0, stun: 0, bumpT: 0, flyT: 0, scanned: false
};
const PAY = [];
const CAMS = ['FPV', 'CHASE', 'TOP'];

function resetDrone(pos, heading) {
  DR.p.copy(pos); DR.v.set(0, 0, 0); DR.h = heading; DR.pitch = 0; DR.roll = 0; DR.alive = true;
  DR.landed = pos.y <= groundAt(pos.x, pos.z) + 0.07; DR.thrust = 0; S.stun = 0;
  for (const k in ks) ks[k] = 0;
}
function startHead() { return -num(BY.pad_start.yaw, 0) * DEG; }
function startPos() { const ps = BY.pad_start; const p = W(ps.down, ps.side, 0); p.y = groundAt(p.x, p.z) + 0.06; return p; }
function startRun(kind) {
  enterFull();
  if (typeof c1Menu === 'function') c1Menu(kind);
  S.kind = kind; S.state = kind === 'demo' ? 'demo' : 'run'; S.t = 0; S.running = false; S.finished = false; S.objIdx = 0;
  S.objState = OBJS.map(() => 0); S.objNear = -1; S.pen = 0; S.impacts = 0; S.payloads = 3; S.respawn = null; S.scan = 0; S.wasInside = false; S.landT = 0;
  S.ghostT = 0; S.demoEvents = 0; S.hits = 0; S.misses = 0; S.scanned = false; S.flyT = 0; S.hitCD = 0; S.orbSum = 0; S.orbA = null; S.boosting = false; S.bellyOv = null; BOOST.on = false; { const b = $('tbBoost'); if (b) b.classList.remove('on'); }
  PAY.forEach(p => scene.remove(p.m)); PAY.length = 0;
  droneM.cans.forEach(c => c.visible = true); ghostM.cans.forEach(c => c.visible = true);
  resetDrone(startPos(), startHead()); DR.R = AFc().R; droneM.g.visible = true;
  if (!isMission(kind)) { if (kind === 'free' && AFc().cls === 'wing' && typeof rwyMapView === 'function') rwyMapView(); else mapView('course'); }
  dbfStart(); if (kind !== 'demo') { S.lastKind = kind; LAST_REC = null; } ORDER.m = null; commReset();   // 이전 비행 기록·명령·무전이 섞이지 않게
  if (isMission(kind)) msStart(kind);
  else { Object.values(MSG).forEach(g => g.visible = false); STRIKE.forEach(t => t.col.off = true); MS.list = []; MS.launch = null; if (AFc().cls === 'wing' && typeof wingRwyOK === 'function' && wingRwyOK(AFc())) { wingGround(); MS.launch = { p: DR.p.clone(), h: DR.h }; } else if (AFc().cls === 'wing') { const p = startPos(); p.y += 30; wingAir(p, startHead()); } }
  if (kind === 'demo') S.cam = 1;
  S._fromDemo = kind === 'demo';
  OBJS.forEach(o => { if (o.hint) o.hint.visible = false; });
  ui.menu.classList.add('hidden'); ui.pause.classList.add('hidden'); ui.result.classList.add('hidden'); ui.hud.classList.remove('hidden'); lyApply();
  ui.list.classList.toggle('hidden', kind !== 'course' && !isMission(kind));
  renderList(); updateTags();
  S.tut = null; $('tut').classList.add('hidden'); $('rp').classList.add('hidden'); ui.hud.classList.remove('replaying');
  if (kind !== 'demo' && kind !== 'tutorial') recStart(); else REC = null;   // 모든 임무 기록 (리플레이·영상)
  showMsg(isMission(kind) ? MS_NAME[kind] + ' · ' + AFc().name : kind === 'course' ? ((IS_TOUCH || XR_ON) ? (XR_ON && vrStickMode() === 1 ? 'READY · 오른쪽 스틱 위로 이륙' : 'READY · 왼쪽 스틱 위로 이륙') : 'READY · ' + keyName(KB.up) + ' = TAKEOFF') : kind === 'free' ? 'FREE FLIGHT · ' + AFc().name : kind === 'tutorial' ? '' : 'REFERENCE FLIGHT', '#ffc828', 2.2);
  initAudio(); musicStart();
  COMM.q.length = 0; if (kind === 'course') setTimeout(() => comm(`${CS}, CONTROL. Course is clear, cleared for takeoff. ${WIND.lv ? 'Winds ' + (WIND.lv === 1 ? 'three' : 'seven') + ' meters per second. ' : ''}Over.`, '코스 이상 없음 · 이륙 허가'), 1500);
}
function curObj() {
  if (S.state === 'menu' || S.state === 'replay' || S.state === 'result') return null;
  if (S.kind === 'course') return OBJS[S.objIdx];
  if (S.kind === 'tutorial') return tutObj();
  if (isMission()) return msObj();
  return null;
}
function completeObj(status, msg, col) {
  const o = curObj(); if (!o) return;
  S.objState[S.objIdx] = status; dbfObj(o.label, status === 1);
  if (o.hint) o.hint.visible = false;
  S.respawn = { p: DR.p.clone(), h: DR.h };
  if (status === 1) sfx('good'); else sfx('bad');
  showMsg(msg || (o.label + (status === 1 ? ' ✓' : ' ✗')), col || (status === 1 ? '#5dff9a' : '#ff6060'), 1.4);
  S.objIdx++; S.scan = 0; S.wasInside = false; S.landT = 0; S.scanned = false; S.orbSum = 0; S.orbA = null;
  if (S.kind === 'tutorial') tutAfterObj(); else if (S.objIdx >= OBJS.length) finishRun(); else if (S.kind === 'course' && status === 1) courseCall(o, OBJS[S.objIdx]);
  renderList();
}
function finishRun() {
  S.finished = true; S.running = false;
  comm(`${CS}, CONTROL. Course complete, good flying. CONTROL out.`, '코스 완주 · 수고했음');
  const rec = recFinish();
  setTimeout(() => {
    if (S.state !== 'run') return;
    S.state = 'result'; ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden'); if ($('resTitle')) $('resTitle').textContent = 'COURSE COMPLETE'; { const rp = $('resPhotos'); if (rp) rp.style.display = 'none'; }
    const total = S.t + S.pen, done = S.objState.filter(v => v === 1).length;
    ui.resSub.textContent = `${pilotName()} · ${MODES[SET.diff].name} · 과제 ${done}/${OBJS.length} 성공`;
    const rows = [['비행 시간', fmt(S.t)], ['벌점', '+' + S.pen.toFixed(0) + ' s'], ['합계', fmt(total)], ['충돌', S.impacts + ' 회'],
      ['투하 명중', S.hits + ' / 3'], ['기준 비행 (영상)', fmt(GH.total)]];
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td></tr>`).join('');
    debriefShow(done, OBJS.length, GH.total * 1.25);
    const key = 'fpvsim_fpv_best_' + SET.diff + SITE_KEY; let best = null;
    try { best = parseFloat(localStorage.getItem(key)); } catch (e) { }
    if (!best || total < best) { try { localStorage.setItem(key, String(total)); } catch (e) { } saveBest(rec); ui.resBest.textContent = '★ 최고 기록 갱신 (리플레이·고스트로 저장됨)'; }
    else ui.resBest.textContent = '최고 기록 ' + fmt(best);
    refreshBest();
  }, 1600);
}
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; }

// ---------------- 충돌 = 벌점 + 튕김 (게임은 계속) ----------------
function impact(n, vn) {
  DR.v.addScaledVector(n, -vn * 1.4); DR.v.multiplyScalar(0.45);
  if (AFc().kam && S.state === 'run') { lostDrone('impact'); return; }   // 자폭기: 부딪히면 기폭
  if (S.hitCD > 0) return;
  S.hitCD = 0.8; S.impacts++; S.stun = 0.45; shake = 0.07;
  const pen = MODES[SET.diff].hitPen;
  if ((S.kind === 'course' || isMission()) && S.running) S.pen += pen;
  spawnImpact(DR.p.clone(), false, true); sfx('crash'); rumble(0.9, 0.6, 230);
  ui.flash.style.opacity = 0.3; setTimeout(() => { ui.flash.style.opacity = 0; }, 110);
  showMsg('IMPACT' + ((S.kind === 'course' || isMission()) && S.running ? ` +${pen}s` : ''), '#ff5050', 1.1);
}
function respawn() {
  if (S.state === 'run' && S.running) DBF.resp++;
  if (S.kind === 'tutorial' && S.tut) { const st = S.tut.startPose; const p = st.p.clone(); if (!st.landed) p.y = Math.max(p.y, groundAt(p.x, p.z) + 1.0); resetDrone(p, st.h); if (st.landed) DR.landed = true; S.scanned = false; S.scan = 0; S.wasInside = false; S.tut.hold = 0; if (LESSONS[S.tut.i].custom) S.tut.step = 0; else S.objIdx = LESSONS[S.tut.i].range[0]; PAY.forEach(p => scene.remove(p.m)); PAY.length = 0; droneM.cans.forEach(c => c.visible = true); tutRender(); return; }
  if (isMission() || AFc().cls === 'wing') {
    let p, h; const o = curObj();
    if (S.kind === 'strike' || !S.respawn) { p = (MS.launch ? MS.launch.p : startPos()).clone(); h = MS.launch ? MS.launch.h : startHead(); }
    else { p = S.respawn.p.clone(); h = S.respawn.h; }
    if (o && o.mk) { const d = o.mk.clone().sub(p); h = Math.atan2(d.x, -d.z); }
    if (AFc().cls === 'wing') { if (!MS.launch || S.respawn) p.y += 12; wingAir(p, h); } else { p.y = Math.max(p.y, groundAt(p.x, p.z) + 1.2); resetDrone(p, h); }
    DR.alive = true; droneM.g.visible = true; return;
  }
  let p, h;
  if (S.respawn) { p = S.respawn.p.clone(); h = S.respawn.h; p.y = Math.max(p.y, groundAt(p.x, p.z) + 1.2); }
  else { p = startPos(); h = startHead(); }
  const o = curObj();
  if (o && o.mk && S.respawn) { const d = o.mk.clone().sub(p); h = Math.atan2(d.x, -d.z); }
  resetDrone(p, h);
  if (S.kind !== 'course') droneM.cans.forEach(c => c.visible = true);
}

// =====================================================================
//  통과 대상 정보 (조준 표시 · 통과 보조 공용)
// =====================================================================
function openingOf(o) {
  if (!o) return null;
  const b = o.b;
  if (o.kind === 'pass') {
    const p = b.pass;
    if (p.kind === 'sq') return { b, lx: 0, lz: (p.z0 + p.z1) / 2, hx: (p.x1 - p.x0) / 2, hz: (p.z1 - p.z0) / 2, ly: 0 };
    if (p.kind === 'ring') return { b, lx: 0, lz: p.zc, hx: p.r, hz: p.r, ly: 0 };
    if (p.kind === 'tri') return { b, lx: 0, lz: p.A[1] + (p.C[1] - p.A[1]) / 3, hx: (p.B[0] - p.A[0]) / 2, hz: (p.C[1] - p.A[1]) / 2, ly: 0, czc: p.A[1] + (p.C[1] - p.A[1]) / 2 };
    if (p.kind === 'tunnel') return { b, lx: 0, lz: p.zc, hx: p.r, hz: p.r, ly: -p.L / 2 };
  }
  if (o.kind === 'slalom') return { b, lx: o.sg * 0.9, lz: 2.0, hx: 0.65, hz: 1.5, ly: 0, noVert: true };
  if (o.kind === 'bunker') {
    if (S.scanned) { const w2 = b.win2; return { b, side: true, lx: w2.x, ly: 0, lz: w2.zc, hx: (w2.y1 - w2.y0) / 2, hz: (w2.z1 - w2.z0) / 2 }; }
    const w = b.win; return { b, lx: w.xc, lz: w.zc, hx: (w.x1 - w.x0) / 2, hz: (w.z1 - w.z0) / 2, ly: w.y };
  }
  return null;
}

// =====================================================================
//  physics
// =====================================================================
const FWD = new V3(), RGT = new V3(), _ax = new V3(), _ay = new V3();
// 수색 과제: 구역(o.search) 안에 들어오면 정확한 위치 안내를 끔 (눈·열화상으로 찾기)
function searchIn(o, p) { return !!(o && o.search && o.mk && p && Math.hypot(o.mk.x - p.x, o.mk.z - p.z) < o.search.r); }
function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function stepDrone(dt) {
  if (!DR.alive) { deadTick(dt); return; }
  if (AFc().cls === 'wing') { stepWing(dt); return; }
  if (typeof isC1 === 'function' && isC1() && AFc().c1) { c1Phys(dt); return; }
  const md = effMode(), afc = AFc();
  const grounded = DR.landed && IN.thr <= 0.05;
  const boost = !!IN.boost && !grounded && boostZone() && !md.atti; S.boosting = boost;
  const vmaxB = boost ? Math.max(md.vmax, afc.top) : md.vmax, tiltB = md.maxTilt + (boost ? 15 * DEG : 0);
  const k = G * Math.tan(tiltB) / vmaxB;
  // 반응: 실제 기체처럼 1초 안팎에 속도가 붙고 멈추도록 (최고 속도는 그대로, 가속·감속만 빠르게)
  const kk = md.atti ? k : Math.max(k, 1 / (SET.diff === 'train' ? 1.25 : SET.diff === 'easy' ? 1.0 : 0.85)), ksc = kk / k;   // ATTI: 공기 저항만으로 천천히 멈춤
  const a = 1 - Math.exp(-dt / 0.11);
  const stun = S.stun > 0 ? 0.25 : 1;
  let ip = IN.pitch * stun, ir = IN.roll * stun, iy = IN.yaw * stun;
  if (S.stun > 0) { ir += Math.sin(S.simT * 40) * 0.35; S.stun -= dt; }
  if (md.acro && !grounded) {   // 수동(Acro): 스틱 = 기울기 속도, 놓아도 수평으로 돌아오지 않음
    DR.pitch = clamp(DR.pitch + ip * 210 * DEG * dt, -80 * DEG, 80 * DEG); DR.roll = clamp(DR.roll + ir * 210 * DEG * dt, -80 * DEG, 80 * DEG);
  } else {
    DR.pitch += ((grounded ? 0 : ip * tiltB) - DR.pitch) * a;
    DR.roll += ((grounded ? 0 : ir * md.maxTilt) - DR.roll) * a;
  }
  const o = curObj(), assistOn = SET.assist && md.assist > 0;
  if (!grounded) {
    DR.h += iy * md.yawRate * dt;
    // 자동 방향 보조 (입문): 회전 입력이 없으면 다음 과제 쪽으로 천천히 돌아감
    if (md.autoYaw && assistOn && !IN.head && o && o.mk && !o.search && Math.abs(iy) < 0.05 && (Math.abs(ip) > 0.1 || Math.hypot(DR.v.x, DR.v.z) > 1.2)) {
      const op = openingOf(o); let tp = o.mk;
      if (op) tp = op.b.world(op.lx, op.ly - 0.0, op.lz);
      if (GUIDE.next) tp = GUIDE.next;
      const d = tp.clone().sub(DR.p); if (Math.hypot(d.x, d.z) > 1.5) {
        const want = Math.atan2(d.x, -d.z); const dh = wrapA(want - DR.h);
        DR.h += clamp(dh, -1, 1) * 55 * DEG * dt;
      }
    }
  }
  FWD.set(Math.sin(DR.h), 0, -Math.cos(DR.h)); RGT.set(Math.cos(DR.h), 0, Math.sin(DR.h));
  let vyAssist = 0;
  if (!grounded) {
    const af = G * Math.tan(DR.pitch), ar = G * Math.tan(DR.roll);
    const wv = windAt(DR.p); if (md.gps && SET.assist) wv.multiplyScalar(0.06);   // 바람: 공기에 대한 속도로 저항 · GPS 모드(입문·쉬움)는 기체가 바람을 거슬러 기울여 위치를 지킴
    DR.v.x += ((FWD.x * af + RGT.x * ar) * ksc - kk * (DR.v.x - wv.x)) * dt;
    DR.v.z += ((FWD.z * af + RGT.z * ar) * ksc - kk * (DR.v.z - wv.z)) * dt;
    // 브레이크 (스틱을 놓으면 멈춤)
    if (md.brake > 0 && Math.abs(ip) < 0.05 && Math.abs(ir) < 0.05) { const f = Math.exp(-md.brake * dt), w2 = windAt(DR.p), ww = !SET.assist ? 1 : md.gps ? 0 : 0.3; DR.v.x = w2.x * ww + (DR.v.x - w2.x * ww) * f; DR.v.z = w2.z * ww + (DR.v.z - w2.z * ww) * f; }
    // 통과 보조: 열린 곳 가운데로 살짝 끌어당김
    if (assistOn && o) {
      const op = openingOf(o);
      if (op && !op.side) {
        const l = op.b.local(DR.p), dly = l.ly - op.ly;
        _ax.copy(op.b.world(1, 0, 0)).sub(op.b.world(0, 0, 0));          // 물체 로컬 x (옆) 방향
        _ay.copy(op.b.world(0, 1, 0)).sub(op.b.world(0, 0, 0));          // 물체 로컬 y (통과) 방향
        const vf = DR.v.dot(_ay);
        if (dly > -10 && dly < 0.3 && vf > 0.6) {
          const f = md.assist * (1 - Math.max(0, -dly) / 10);
          const ex = l.lx - op.lx, vx = DR.v.dot(_ax);
          const acx = clamp(-ex * 3.2 - vx * 1.6, -6, 6) * f;
          DR.v.addScaledVector(_ax, acx * dt);
          if (!op.noVert) vyAssist = clamp(-(l.lz - op.lz) * 1.8, -2.5, 2.5) * f;
        }
      }
    }
  }
  if (md.althold) {
    let tv = IN.thr > 0 ? IN.thr * afc.climb : IN.thr * afc.sink;
    if (Math.abs(IN.thr) < 0.05) tv += vyAssist;
    // 지형 추종 (입문: 지면 위 높이 유지 / 쉬움: 오르막에서 부딪히지 않게만)
    if (TER.h && assistOn && Math.abs(IN.thr) < 0.05 && !grounded && vyAssist === 0) {   // 게이트 통과 보조 중엔 끔
      const la = 0.6, g0 = terrainAt(DR.p.x, DR.p.z), g1 = terrainAt(DR.p.x + DR.v.x * la, DR.p.z + DR.v.z * la), rate = (g1 - g0) / la;
      tv += md.autoYaw ? rate : Math.max(0, rate);
    }
    DR.v.y += (tv - DR.v.y) * (1 - Math.exp(-dt / 0.28));
    DR.thrust = clamp(0.5 + IN.thr * 0.35 + Math.hypot(DR.pitch, DR.roll) * 0.4, 0, 1);
    if (grounded) { DR.v.y = Math.min(DR.v.y, 0); DR.thrust = 0.08; }
  } else {
    const T = G * (1 + IN.thr * afc.tw);
    const ay = (grounded ? 0 : T * Math.cos(DR.pitch) * Math.cos(DR.roll) - G) - 0.35 * DR.v.y;
    DR.v.y += ay * dt; DR.thrust = grounded ? 0.08 : clamp(0.5 + IN.thr * 0.45, 0.05, 1);
    if (grounded) DR.v.y = Math.min(DR.v.y, 0);
  }
  DR.p.addScaledVector(DR.v, dt);
  // 지면
  const gh = groundAt(DR.p.x, DR.p.z) + 0.06;
  if (DR.p.y < gh) {
    const hs = Math.hypot(DR.v.x, DR.v.z), vy = DR.v.y;
    DR.p.y = gh;
    if (vy < -4.5 || hs > 7) { impact(new V3(0, 1, 0), Math.min(vy, -2)); DR.v.y = Math.abs(vy) * 0.3; }
    else { DR.v.y = Math.max(DR.v.y, 0); DR.v.x *= Math.exp(-9 * dt); DR.v.z *= Math.exp(-9 * dt); DR.landed = true; }
  } else if (DR.p.y > gh + 0.03) DR.landed = false;
  if (DR.p.y > gh + 120) { DR.p.y = gh + 120; DR.v.y = Math.min(DR.v.y, 0); }   // 지면 위 120 m 제한
  // 장애물
  for (let it = 0; it < 2; it++) {
    const hit = collide(DR.p, DR.R) || STREES.col(DR.p, DR.R); if (!hit) break;
    const vn = DR.v.dot(hit.n);
    DR.p.addScaledVector(hit.n, hit.pen + 0.003);
    if (vn < -2.5) impact(hit.n, vn);
    else { if (vn < 0) DR.v.addScaledVector(hit.n, -vn * 1.2); DR.v.multiplyScalar(0.85); if (S.bumpT <= 0) { sfx('bad'); S.bumpT = 0.4; } }
  }
  // 비행 구역 경계: 밀어냄
  const rx = DR.p.x, rz = DR.p.z + 150, l = Math.hypot(rx, rz);
  if (l > FLY_R) {
    const nx = rx / l, nz = rz / l; DR.p.x -= nx * (l - FLY_R); DR.p.z -= nz * (l - FLY_R);
    const vo = DR.v.x * nx + DR.v.z * nz; if (vo > 0) { DR.v.x -= nx * vo * 1.5; DR.v.z -= nz * vo * 1.5; }
    if (S.msgCD <= 0) { showMsg('AREA LIMIT', '#ff9a40', 1); S.msgCD = 2; }
  }
}
S.msgCD = 0;

// ---------------- payloads ----------------
function dropPayload(fromPos, fromVel, ghost) {
  if (!ghost && !AFc().drop) return;
  if (!ghost && isMission() && S.kind !== 'sar') { showMsg(L2x('투하 포드가 비어 있습니다', 'Payload pod is empty'), '#ff9a40', 1.2); sfx('bad'); return; }   // 투하가 필요 없는 임무
  const meshes = ghost && ghost !== 'demo' && ghost !== 'replay' ? ghostM.cans : droneM.cans;
  if (!ghost && S.kind === 'course' && S.payloads <= 0) { showMsg('NO PAYLOAD', '#ff6060', 1); sfx('bad'); return; }
  const can = meshes.find(c => c.visible); if (can) can.visible = false;
  if (!ghost && S.kind === 'course') S.payloads--;
  if (!ghost && S.kind === 'tutorial' && !meshes.some(c => c.visible)) setTimeout(() => droneM.cans.forEach(c => c.visible = true), 1500);   // 연습(튜토리얼)만 자동 보충
  if (!ghost && S.kind === 'free' && !can) { showMsg(L2x('투하물 없음 · 착륙하면 재장전', 'No payload · land to reload'), '#ff6060', 1.2); sfx('bad'); return; }
  if (!ghost && S.kind === 'sar') { if ((S.kits | 0) <= 0) { showMsg(L2x('구조 키트 없음', 'No rescue kits left'), '#ff6060', 1.2); sfx('bad'); return; } S.kits--; }
  if (!ghost) recEvent({ k: 'drop', p: [fromPos.x, fromPos.y, fromPos.z], v: [fromVel.x, fromVel.y, fromVel.z] });
  const kit = S.kind === 'sar';
  const m = kit ? new THREE.Mesh(UBOX, mat(0xff6a00, { roughness: 0.7 })) : new THREE.Mesh(UCYL, mat(0x7c8288, { roughness: 0.45, metalness: 0.5 })); if (kit) m.scale.set(0.12, 0.08, 0.16); else m.scale.set(0.022, 0.12, 0.022); m.castShadow = true;
  m.position.copy(fromPos).add(new V3(0, -0.08, 0)); scene.add(m);
  PAY.push({ m, v: fromVel.clone(), spin: new V3(Math.random() * 6, 0, Math.random() * 6), ghost, course: !ghost && (S.kind === 'course' || S.kind === 'tutorial'), kit });
  sfx('drop');
}
const _pp = new V3();
function updatePayloads(dt) {
  for (let i = PAY.length - 1; i >= 0; i--) {
    const P = PAY[i]; P.v.y -= G * dt; P.v.multiplyScalar(1 - 0.08 * dt);
    _pp.copy(P.m.position); P.m.position.addScaledVector(P.v, dt);
    P.m.rotation.x += P.spin.x * dt; P.m.rotation.z += P.spin.z * dt;
    const hitObj = collide(P.m.position, 0.03, c => c.tag === 'tank' || c.tag === 'ivan' || c.tag === 'mit' || c.tag === 'bunker' || c.tag === 'gate');
    const pg = groundAt(P.m.position.x, P.m.position.z) + 0.03;
    if (P.m.position.y <= pg || hitObj) {
      const pos = P.m.position.clone(); if (pos.y < pg) pos.y = pg;
      PAY.splice(i, 1);
      if (P.kit) { P.m.position.copy(pos); setTimeout(() => scene.remove(P.m), 20000); sarKit(pos); sfx('good'); continue; }
      scene.remove(P.m);
      spawnImpact(pos, true); sfx('bang');
      if (P.course) evalDrop(pos, hitObj);
      else if (S.kind === 'free' && !P.ghost) { const r = nearestTarget(pos); showMsg(r ? `${r.name} ${r.hit ? 'HIT' : 'MISS ' + r.d.toFixed(1) + ' m'}` : 'IMPACT', r && r.hit ? '#5dff9a' : '#ffc828', 1.4); }
    }
  }
}
function mitX(t) { const b = OBJ.mit; return b.amp * Math.sin(t * 3.5 / b.amp); }
function targetEval(name, pos, hitObj, mitT) {
  if (name === 'ivan') {
    const b = OBJ.ivan_grp1; let dm = 1e9;
    for (const bd of b.boards) { const w = b.world(bd[0], 0, 0); dm = Math.min(dm, Math.hypot(w.x - pos.x, w.z - pos.z)); }
    return { name: 'IVAN', d: dm, hit: dm <= 1.4 || !!(hitObj && hitObj.c.tag === 'ivan') };
  }
  if (name === 'mit') {
    const b = OBJ.mit; const w = b.world(mitT === undefined ? b.car.position.x : mitX(mitT), 0, 0); const d = Math.hypot(w.x - pos.x, w.z - pos.z);
    return { name: 'MIT', d, hit: d <= 1.6 || !!(hitObj && hitObj.c.tag === 'mit') };
  }
  const b = OBJ.tank, l = b.local(pos); const dx = Math.max(0, Math.abs(l.lx) - b.foot.x), dy = Math.max(0, Math.abs(l.ly) - b.foot.y);
  const d = Math.hypot(dx, dy); return { name: 'TANK', d, hit: d <= 0.6 || !!(hitObj && hitObj.c.tag === 'tank') };
}
function nearestTarget(pos, mitT) {
  let best = null; for (const n of ['ivan', 'mit', 'tank']) { const r = targetEval(n, pos, null, mitT); r.key = n; if (!best || r.d < best.d) best = r; }
  return best && best.d < 25 ? best : null;
}
function evalDrop(pos, hitObj) {
  const o = curObj();
  if (!o || o.kind !== 'drop') { refundPayload(o && o.kind === 'orbit' ? 'ORBIT FIRST · 투하물 낭비' : 'NOT A DROP TASK · 투하물 낭비'); return; }
  const r = targetEval(o.target, pos, hitObj);
  if (r.hit) { S.hits++; rumble(0.5, 1.0, 160); completeObj(1, `${r.name} HIT ✓`); return; }
  if (r.d > 25) { refundPayload(`TOO FAR (${r.d.toFixed(0)} m) · 투하물 낭비`); return; }
  if (S.kind === 'tutorial') { showMsg(`MISS ${r.d.toFixed(1)} m · 다시 시도`, '#ff9a40', 1.6); sfx('bad'); return; }
  // 한 번 투하하면 맞든 안 맞든 다음 과제로 (빗나가면 +10초)
  S.pen += S.kind === 'course' ? 10 : 0; S.misses++;
  completeObj(2, `MISS ${r.d.toFixed(1)} m${S.kind === 'course' ? ' · +10s' : ''} → NEXT`, '#ff9a40');
}
function refundPayload(msg) {   // 실제처럼: 한 번 떨어뜨린 투하물은 돌아오지 않음 (튜토리얼만 보충)
  if (S.kind === 'tutorial') { S.payloads = Math.min(3, S.payloads + 1); const c = droneM.cans.find(c => !c.visible); if (c) c.visible = true; }
  showMsg(msg + (S.kind === 'course' ? L2x(` · 남은 ${S.payloads}개`, ` · ${S.payloads} left`) : ''), '#ffc828', 1.8); sfx('bad');
}
// 드론 조명: 기본은 밤에 자동으로 켬 · L 키 / 패드 오른쪽 스틱 누르기 / VR X / 터치 💡 로 직접 켜고 끔
function lightOn() { return S.lightOv != null ? S.lightOv : (!!SET.light || (ENV.night && !ENV.ir)); }
function L2x(ko, en) { return window.SIM_LANG === 'en' ? en : ko; }
// 자유 비행: 착륙해서 2초 있으면 재장전
function reloadTick(dt) {
  if (S.state !== 'run' || S.kind !== 'free' || !AFc().drop || !DR.landed || droneM.cans.every(c => c.visible)) { S.reloadT = 0; return; }
  S.reloadT = (S.reloadT || 0) + dt; if (S.reloadT >= 2) { droneM.cans.forEach(c => c.visible = true); S.reloadT = 0; showMsg(L2x('재장전 완료', 'Reloaded'), '#5dff9a', 1.2); sfx('good'); }
}
// 부스트: 켜기/끄기 (어디서나 사용). 켜면 기체 최고 속도까지
const BOOST = { on: false };
function boostToggle(v) { BOOST.on = v === undefined ? !BOOST.on : !!v; const b = $('tbBoost'); if (b) b.classList.toggle('on', BOOST.on); if (S.state === 'run') showMsg(BOOST.on ? 'BOOST ON' : 'BOOST OFF', BOOST.on ? '#ff9a40' : '#9aa6ad', 0.8); }
function boostZone() { return true; }
function boostZoneOld() {
  if (S.kind === 'free') return true;
  const o = curObj(); if (!o || o.kind !== 'pass' || !o.b.pass || o.b.pass.kind !== 'tunnel') return false;
  return o.b.world(0, -o.b.pass.L / 2, o.b.pass.zc).distanceTo(DR.p) > 25;
}
// 낙하 예측 (공기저항 근사)
function predictImpact(p, v) {
  // 경사지: 낙하 지점의 지면 높이로 몇 번 반복해 맞춤
  let gy = groundAt(p.x, p.z), t = 0, kf = 1, x = p.x, z = p.z;
  for (let k = 0; k < 4; k++) {
    const h = Math.max(p.y - 0.11 - gy, 0), vy = v.y;
    t = (vy + Math.sqrt(vy * vy + 2 * G * h)) / G; kf = 1 - 0.04 * t;
    x = p.x + v.x * t * kf; z = p.z + v.z * t * kf; gy = groundAt(x, z);
  }
  return { p: new V3(x, gy + 0.03, z), t };
}

// ---------------- objectives check ----------------
const _prevP = new V3();
// 통과형 과제(게이트·슬라롬): 이번 프레임에 면을 지났는지 -> { inside, fwd, x } 또는 null
function passTest(o, prev, cur, mg) {
    const a = o.b.local(prev), b = o.b.local(cur);
    if ((a.ly < 0) === (b.ly < 0)) return null;
    const f = a.ly / (a.ly - b.ly), x = lerp(a.lx, b.lx, f), z = lerp(a.lz, b.lz, f), fwd = a.ly < 0;
    let inside = false;
    if (o.kind === 'slalom') inside = o.sg > 0 ? (x > 0.15 - mg && x < 6) : (x < -0.15 + mg && x > -6);
    else {
      const p = o.b.pass;
      if (p.kind === 'sq') inside = x > p.x0 - mg && x < p.x1 + mg && z > p.z0 - mg && z < p.z1 + mg;
      else if (p.kind === 'ring' || p.kind === 'tunnel') inside = Math.hypot(x, z - p.zc) < p.r + mg;
      else if (p.kind === 'tri') {
        const s = (P, Q) => (Q[0] - P[0]) * (z - P[1]) - (Q[1] - P[1]) * (x - P[0]); const s1 = s(p.A, p.B), s2 = s(p.B, p.C), s3 = s(p.C, p.A);
        inside = (s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0);
        if (!inside && mg > 0) { const cx = 0, cz = p.A[1] + (p.C[1] - p.A[1]) / 3; inside = Math.hypot(x - cx, z - cz) < (p.B[0] - p.A[0]) / (2 * Math.sqrt(3)) + mg; }
      }
    }
    return { inside, fwd, x };
}
function checkObjectives(prev, cur, dt) {
  const o = curObj(); if (!o || !DR.alive) return;
  const mg = MODES[SET.diff].margin;
  if (o.kind === 'custom') { tutCustomCheck(cur, dt); return; }
  if (o.kind === 'takeoff') { if (cur.y > groundAt(cur.x, cur.z) + 0.8) { S.running = true; completeObj(1, 'GO!', '#ffc828'); } return; }
  // 놓치고 지나감 -> 그 과제만 실패(✗)로 두고 다음 목표로 (벌점 없음)
  //  ① 다음·그다음 게이트를 제대로 통과했거나 ② 지금 과제 근처(20 m)에 왔다가 다음 과제까지 구간의 절반을 넘어감
  if (S.kind === 'course' && o.kind !== 'takeoff' && o.kind !== 'land') {
    for (let j = S.objIdx + 1; j <= Math.min(S.objIdx + 2, OBJS.length - 1); j++) {
      const q = OBJS[j]; if (q.kind !== 'pass' && q.kind !== 'slalom') continue;
      const r = passTest(q, prev, cur, mg); if (!(r && r.inside && r.fwd)) continue;
      const missed = [];
      for (let k = S.objIdx; k < j; k++) { S.objState[k] = 2; if (OBJS[k].hint) OBJS[k].hint.visible = false; missed.push(OBJS[k].label); }
      S.objIdx = j; S.scan = 0; S.wasInside = false; S.scanned = false; S.orbSum = 0; S.orbA = null;
      comm(`${CS}, CONTROL. You missed ${missed.length > 1 ? 'two obstacles' : 'one'}. Press on.`, `${missed.join(', ')} 실패 · 계속 진행`);
      completeObj(1, `${missed.join(' · ')} ✗ → ${q.label} ✓`, '#ff9a40');
      return;
    }
    const anc = q => q.kind === 'orbit' && q.b ? q.b.world(0, 0, 0) : q.mk;   // 오빗 안내점(mk)은 드론을 따라 원 위를 돌므로 탱크 중심으로 잼
    const oA = anc(o); let nx = null; for (let k = S.objIdx + 1; k < OBJS.length; k++) { const q = OBJS[k], qa = anc(q); if (q.kind !== 'drop' && qa && oA && Math.hypot(qa.x - oA.x, qa.z - oA.z) > 10) { nx = q; break; } }   // 방향은 고정된 다음 과제로 잼 (투하 표적은 움직이거나 같은 자리라 제외)
    if (nx && oA && !(o.kind === 'drop' && PAY.some(p => p.course))) {
      const A = oA, nA = anc(nx), dx = nA.x - A.x, dz = nA.z - A.z, L2 = dx * dx + dz * dz, dA = Math.hypot(cur.x - A.x, cur.z - A.z);
      if (dA < 20) S.objNear = S.objIdx;
      const u = L2 > 1 ? ((cur.x - A.x) * dx + (cur.z - A.z) * dz) / L2 : 0;
      if (((S.objNear === S.objIdx && u > 0.5) || u > 0.85) && !(o.kind === 'orbit' && dA < 26 && Math.abs(S.orbSum) > 0.3)) {   // 가까이 안 와도 다음 과제 쪽으로 85% 넘게 가면 건너뜀
        comm(`${CS}, CONTROL. You missed that one. Press on to the next.`, `${o.label} 실패 · 다음 목표로`);
        completeObj(2, `${o.label} ✗ → NEXT`, '#ff9a40'); return;
      }
    }
  }
  if (o.kind === 'pass' || o.kind === 'slalom') {
    const r = passTest(o, prev, cur, mg); if (!r) return;
    const { inside, fwd, x } = r;
    if (inside && fwd) completeObj(1);
    else if (inside && !fwd) { showMsg('WRONG WAY', '#ff6060', 1); sfx('bad'); }
    else if (o.kind === 'slalom' && fwd && Math.abs(x) < 6) { showMsg(`WRONG SIDE · ${o.sg > 0 ? 'RIGHT' : 'LEFT'}`, '#ff6060', 1.2); sfx('bad'); }
    return;
  }
  if (o.kind === 'orbit') {
    const c = o.b.world(0, 0, 0), dx = cur.x - c.x, dz = cur.z - c.z, r = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
    if (r > 5 && r < 24) { if (S.orbA !== null) S.orbSum += wrapA(ang - S.orbA); S.orbA = ang; } else S.orbA = null;
    if (Math.abs(S.orbSum) >= Math.PI * 2) completeObj(1, 'ORBIT ✓ · TOP ATTACK');
    return;
  }
  if (o.kind === 'drop') {
    if (S.payloads <= 0 && !PAY.some(p => p.course)) { S.pen += 15; completeObj(2, `${o.label} MISSED +15s`); }
    return;
  }
  if (o.kind === 'bunker') {
    const ins = insideBunker(cur);
    if (ins) { S.scan += dt; S.wasInside = true; if (S.scan >= 1.5 && !S.scanned) { S.scanned = true; showMsg('SCAN COMPLETE · EXIT', '#5dff9a', 1.8); sfx('chime'); } }
    else if (S.wasInside) {
      const l = o.b.local(cur);
      if (S.scanned) completeObj(1, l.lx < -o.b.inner.x ? 'RECON ✓ · LEFT WINDOW' : 'RECON ✓');
      else { S.wasInside = false; S.scan = 0; showMsg('SCAN INCOMPLETE', '#ff6060', 1); }
    }
    return;
  }
  if (o.kind === 'land') {
    const l = o.b.local(cur); const on = Math.hypot(l.lx, l.ly) < 0.62 + mg && DR.landed && DR.v.length() < 0.8;
    S.landT = on ? S.landT + dt : 0;
    if (S.landT > 0.8) completeObj(1, 'LANDED ✓');
  }
}
function insideBunker(p) {
  const b = OBJ.bunker1, l = b.local(p), n = b.inner;
  return Math.abs(l.lx) < n.x && l.ly > n.y0 && l.ly < n.y1 && l.lz < n.z && l.lz > 0;
}

// =====================================================================
//  cameras
// =====================================================================
const camPos = new V3(), camLook = new V3(), qBody = new THREE.Quaternion(), qTilt = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
let shake = 0, topH = 0;
function updateCamera(dt, subj) {
  if (typeof c1Camera === 'function' && c1Camera(dt, subj)) { if (shake > 0) { camera.position.add(new V3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0)); shake *= Math.exp(-dt * 8); } camera.updateProjectionMatrix(); return; }
  const mode = CAMS[S.cam];
  eul.set(-visPitch(subj), -subj.h, -subj.roll); qBody.setFromEuler(eul);
  const fwd = new V3(Math.sin(subj.h), 0, -Math.cos(subj.h));
  camera.up.set(0, 1, 0);
  if (mode === 'FPV') {
    qTilt.setFromAxisAngle(new V3(1, 0, 0), (AFc().cls === 'wing' ? 0 : SET.tilt) * DEG);
    camera.quaternion.copy(qBody).multiply(qTilt);
    camera.position.copy(subj.p).add(new V3(0, 0.02, -0.12).applyQuaternion(qBody));
    camera.fov = 82 + (S.boosting ? 8 : 0); camera.near = 0.03;
  } else if (mode === 'CHASE') {
    let want;
    if (insideBunker(subj.p)) {
      const b = OBJ.bunker1, n = b.inner;
      const lw = b.local(subj.p.clone().addScaledVector(fwd, -1.4).add(new V3(0, 0.35, 0)));
      want = b.world(clamp(lw.lx, -n.x + 0.18, n.x - 0.18), clamp(lw.ly, n.y0 + 0.18, n.y1 - 0.18), clamp(lw.lz, 0.4, n.z - 0.2));
      camPos.lerp(want, 1 - Math.exp(-dt * 12));
    } else {
      const Z = ZOOMS[SET.zoom] || ZOOMS[1]; want = subj.p.clone().addScaledVector(fwd, -Z.d * camK()).add(new V3(0, Z.h * camK(), 0));
      want.y = Math.max(want.y, groundAt(want.x, want.z) + 0.35);
      camPos.lerp(want, 1 - Math.exp(-dt * 5.5));
    }
    camera.position.copy(camPos);
    camLook.lerp(subj.p.clone().addScaledVector(fwd, 1.5).add(new V3(0, 0.2, 0)), 1 - Math.exp(-dt * 9));
    camera.lookAt(camLook); camera.fov = (ZOOMS[SET.zoom] || ZOOMS[1]).fov + (innerHeight > innerWidth ? 10 : 0) + (S.boosting ? 9 : 0); camera.near = 0.05;
  } else {
    // TOP: 드론 뒤쪽 위에서 비스듬히 내려다봄 (방향은 천천히 따라감)
    topH += wrapA(subj.h - topH) * (1 - Math.exp(-dt * 1.8));
    const tf = new V3(Math.sin(topH), 0, -Math.cos(topH));
    const tz = [1.3, 1, 0.68][SET.zoom] || 1; const want = subj.p.clone().addScaledVector(tf, -7 * tz).add(new V3(0, 17 * tz, 0));
    camPos.lerp(want, 1 - Math.exp(-dt * 4));
    camera.position.copy(camPos);
    camLook.lerp(subj.p.clone().addScaledVector(tf, 4), 1 - Math.exp(-dt * 6));
    camera.lookAt(camLook); camera.fov = 55; camera.near = 0.1;
  }
  if (shake > 0) { camera.position.add(new V3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)); shake *= Math.exp(-dt * 8); }
  camera.updateProjectionMatrix();
}

// =====================================================================
//  HUD
// =====================================================================
const $ = id => document.getElementById(id);
const ui = {
  hud: $('hud'), osd: $('osd'), objNext: $('objNext'), objMsg: $('objMsg'), list: $('list'), map: $('map'), stk: $('stk'),
  payload: $('payload'), camTag: $('camTag'), modeTag: $('modeTag'), cross: $('cross'), arrow: $('arrow'), flash: $('flash'),
  menu: $('menu'), pause: $('pause'), result: $('result'), resSub: $('resSub'), resTable: $('resTable'), resBest: $('resBest'), best: $('best'),
  brk: $('brk'), brkLbl: $('brkLbl'), fpm: $('fpm'), scope: $('scope'), scopeC: $('scopeC'), scopeTxt: $('scopeTxt'), scopeBar: $('scopeBar')
};
let msgTimer = 0;
function showMsg(t, col, dur) { if (t) { S.lastMsg = t; S.lastMsgT = S.t; } if (t && REC) recEvent({ k: 'msg', text: t, col }); ui.objMsg.textContent = t; ui.objMsg.style.color = col || '#fff'; ui.objMsg.classList.add('show'); msgTimer = dur || 1.2; }
function renderList() {
  if (isMission()) { ui.list.innerHTML = msListHTML(); return; }
  if (S.kind !== 'course') { ui.list.innerHTML = ''; return; }
  let html = ''; const sl = OBJS.map((o, i) => o.kind === 'slalom' ? i : -1).filter(i => i >= 0);
  OBJS.forEach((o, i) => {
    if (o.kind === 'slalom') {
      if (i !== sl[0]) return;
      const st = sl.map(j => S.objState[j]); const cur = sl.includes(S.objIdx);
      const done = st.filter(v => v === 1).length, all = st.every(v => v > 0);
      html += `<div class="${cur ? 'cur' : all ? 'done' : ''}">${all ? '✓' : cur ? '▶' : '·'} SLALOM ${done}/6</div>`; return;
    }
    const s = S.objState[i]; const cls = i === S.objIdx ? 'cur' : s === 1 ? 'done' : s === 2 ? 'miss' : '';
    html += `<div class="${cls}">${s === 1 ? '✓' : s === 2 ? '✗' : i === S.objIdx ? '▶' : '·'} ${o.label}</div>`;
  });
  ui.list.innerHTML = html;
}
function updateTags() {
  ui.camTag.textContent = 'CAM ' + CAMS[S.cam];
  ui.modeTag.textContent = AFc().tag + ' · ' + (S.state === 'replay' ? 'REPLAY' : S.kind === 'tutorial' ? 'TUTORIAL · ' + MODES[SET.diff].name : S.kind === 'demo' ? 'REFERENCE' : MODES[SET.diff].name + (SET.assist && MODES[SET.diff].assist ? ' · ASSIST' : ''));
  ui.cross.classList.toggle('hidden', CAMS[S.cam] !== 'FPV');
}
// 미니맵
// 비행 구역: 중심 (down 150, side 0), 반지름 650 m (쿼드 경계) · 임무 사건은 이 안 (FLY_R_SAFE) 에만 둠
const FLY_C = { x: 0, z: -150 }, FLY_R = MID ? 1000 : 650, FLY_R_SAFE = MID ? 900 : 560;   // 중간 지형이 있으면 반경 1 km
function flyL(p) { return Math.hypot(p.x - FLY_C.x, p.z - FLY_C.z); }
const MAPV_COURSE = (function () {
  if (!CRS_C) return { d0: -24, d1: 340, s0: -112, s1: 90 };
  // 전용 코스: 경로·장애물을 다 담는 범위 (세로 300 : 가로 180 비율 유지)
  let d0 = 1e9, d1 = -1e9, s0 = 1e9, s1 = -1e9;
  for (const q of CRS_C.path.concat(D.objs.map(o => [o.down, o.side]))) { d0 = Math.min(d0, q[0]); d1 = Math.max(d1, q[0]); s0 = Math.min(s0, q[1]); s1 = Math.max(s1, q[1]); }
  d0 -= 30; d1 += 30; s0 -= 30; s1 += 30;
  const kd = (d1 - d0) / 300, ks = (s1 - s0) / 180, k = Math.max(kd, ks), dc = (d0 + d1) / 2, sc = (s0 + s1) / 2;
  return { d0: dc - 150 * k, d1: dc + 150 * k, s0: sc - 90 * k, s1: sc + 90 * k };
})();
let MAPV = MAPV_COURSE, mapBg = document.createElement('canvas'); mapBg.width = 180; mapBg.height = 300;
const MAP_CACHE = {};
function mxy(down, side) { return [(side - MAPV.s0) / (MAPV.s1 - MAPV.s0) * 180, (MAPV.d1 - down) / (MAPV.d1 - MAPV.d0) * 300]; }
function drawMapBg() {
  const g = mapBg.getContext('2d'); g.clearRect(0, 0, 180, 300);
  if (TER.h) {   // 음영기복 + 등고선 (5 m 간격, 25 m 마다 굵게)
    const id = g.createImageData(180, 300), kd = (MAPV.d1 - MAPV.d0) / 300, ks = (MAPV.s1 - MAPV.s0) / 180, CI = kd <= 1.6 ? 5 : kd <= 3.2 ? 10 : 20;   // 넓은 지도는 등고선 간격을 넓힘
    const hAt = (x, y) => terrainAt(MAPV.s0 + x * ks, -(MAPV.d1 - y * kd));
    for (let y = 0; y < 300; y++) for (let x = 0; x < 180; x++) {
      const z = hAt(x, y), zx = (hAt(x + 1, y) - hAt(x - 1, y)) / (2 * ks), zy = (hAt(x, y + 1) - hAt(x, y - 1)) / (2 * kd);
      const sh = Math.max(0, Math.min(1, 0.55 + (-zx + zy) * 0.6)), o = (y * 180 + x) * 4;
      const c0 = Math.floor(z / CI), lineA = [hAt(x + 1, y), hAt(x, y + 1)].some(v => Math.floor(v / CI) !== c0);
      const major = lineA && [hAt(x + 1, y), hAt(x, y + 1)].some(v => Math.floor(v / (CI * 5)) !== Math.floor(z / (CI * 5)));
      const v = 40 + sh * 70; id.data[o] = v * 0.9; id.data[o + 1] = v; id.data[o + 2] = v * 0.85; id.data[o + 3] = 150;
      if (lineA) { id.data[o] = 200; id.data[o + 1] = 170; id.data[o + 2] = 110; id.data[o + 3] = major ? 230 : 120; }
    }
    g.putImageData(id, 0, 0);
  }
  const rect = (d0, d1, s0, s1, c) => { const a = mxy(d1, s0), b = mxy(d0, s1); g.fillStyle = c; g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); };
  if (CRS_C) {   // 경로 + 100 m 눈금
    g.strokeStyle = 'rgba(255,200,40,.55)'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); CRS_C.path.forEach((q, i) => { const p = mxy(q[0], q[1]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '9px Menlo,monospace'; let acc = 0, nx = 100;
    for (let i = 1; i < CRS_C.path.length; i++) { const a = CRS_C.path[i - 1], b = CRS_C.path[i]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc >= nx) { const p = mxy(b[0], b[1]); g.fillRect(p[0] - 2, p[1] - 2, 4, 4); g.fillText(nx + 'm', p[0] + 5, p[1] + 3); nx += 100; } }
  } else {
  rect(-6, 335, -15, 15, 'rgba(255,200,40,.10)'); rect(0, 365, -64, -33, 'rgba(120,180,90,.12)');
  g.strokeStyle = 'rgba(255,200,40,.45)'; g.setLineDash([3, 3]); const a = mxy(335, -15), b = mxy(-6, 15); g.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); g.setLineDash([]);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.font = '9px Menlo,monospace';
  for (const d of [100, 200, 300]) { const p = mxy(d, -15); g.fillRect(p[0], p[1], 30 / (MAPV.s1 - MAPV.s0) * 180, 1); g.fillText(d + 'm', mxy(d, 17)[0], p[1] + 3); }
  }
  for (const o of D.objs) {
    const p = mxy(o.down, o.side);
    const col = { pad: '#fff', gate_sq: '#ffc828', gate_tri: '#ffc828', ring: '#ffc828', pole: '#e0b020', bunker: '#c09060', tunnel: '#9aa', tank: '#a3b26a', mit: '#a3b26a', ivan_group: '#a3b26a' }[o.type] || 'rgba(200,200,200,.45)';
    g.fillStyle = col; const s = ['building', 'hipbld', 'pavilion', 'bleacher', 'shelter', 'tank'].includes(o.type) ? 5 : 3; g.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
  }
  if (window.__RWY) {   // 활주로: 테두리 있는 흰 띠 + 이륙 방향 시단 표시 + RWY 글자
    if (window.__RWY.apron) {   // 계류장(회색) + 유도로 + H 패드(노란 점)
      const ap = window.__RWY.apron.map(v => mxy(-v.z, v.x)); g.fillStyle = 'rgba(170,170,160,.85)'; g.beginPath(); ap.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill();
      const A0 = window.__RWY.a, B0 = window.__RWY.b, m0 = mxy(-(A0.z + B0.z) / 2, (A0.x + B0.x) / 2), m1 = [(ap[0][0] + ap[1][0]) / 2, (ap[0][1] + ap[1][1]) / 2]; g.strokeStyle = 'rgba(80,80,80,.95)'; g.lineWidth = 2; g.beginPath(); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]); g.stroke();
      g.fillStyle = '#ffc828'; window.__RWY.pads.forEach(p => { const q = mxy(-p.z, p.x); g.beginPath(); g.arc(q[0], q[1], 1.8, 0, 6.283); g.fill(); });
    }
    const A = window.__RWY.a, B = window.__RWY.b, p = mxy(-A.z, A.x), q = mxy(-B.z, B.x), w = Math.max(3, 12 / (MAPV.s1 - MAPV.s0) * 180 * 1.6);
    g.setLineDash([]); g.lineCap = 'butt'; g.strokeStyle = 'rgba(10,12,14,.9)'; g.lineWidth = w + 2.5; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    g.strokeStyle = '#e8e8e2'; g.lineWidth = w; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    g.fillStyle = '#40ff70'; g.beginPath(); g.arc(p[0], p[1], 2.4, 0, 6.283); g.fill();
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = -(q[1] - p[1]), ny = q[0] - p[0], nl = Math.hypot(nx, ny) || 1;
    g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.7)'; g.fillText('RWY', mx + nx / nl * 11 + 0.8, my + ny / nl * 11 + 3.8); g.fillStyle = '#ffffff'; g.fillText('RWY', mx + nx / nl * 11, my + ny / nl * 11 + 3);
  }
  if (window.__OUTER) {   // 바깥 지역(임의): 길 · 건물
    const O = window.__OUTER; g.setLineDash([]); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const rd of O.roads) { g.strokeStyle = rd.w >= 6 ? 'rgba(235,225,200,.8)' : 'rgba(210,200,175,.6)'; g.lineWidth = rd.w >= 6 ? 1.6 : 1; g.beginPath(); rd.p.forEach(([x, z], i) => { const q = mxy(-z, x); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); }
    for (const [x, z, k] of O.blds) { const q = mxy(-z, x); g.fillStyle = k === 'gh' ? 'rgba(230,240,245,.85)' : k === 'shop' ? '#e0a040' : '#d8d0c0'; g.fillRect(q[0] - 1, q[1] - 1, 2, 2); }
  }
  // 비행 구역 경계 (점선 원)
  { const c = mxy(-FLY_C.z, FLY_C.x), e = mxy(-FLY_C.z + FLY_R, FLY_C.x), r = Math.abs(e[1] - c[1]); g.strokeStyle = 'rgba(255,90,90,.55)'; g.lineWidth = 1.2; g.setLineDash([5, 4]); g.beginPath(); g.arc(c[0], c[1], r, 0, 7); g.stroke(); g.setLineDash([]); }
}
drawMapBg(); MAP_CACHE.course = mapBg;
// 지도 범위: 코스 = 코스 둘레 / 임무 = 그 임무의 사건·구역이 다 들어오게 (배경은 한 번 만들어 둠)
// 지도 크게 보기: 지도 누르기(클릭·탭)·J 키·VR 메뉴 → 비행 구역 전체를 크게 · 다시 누르면 원래대로
const MAPZ = { on: false, keep: null };
function mapZoom(on) {
  if (on === MAPZ.on) return;
  if (on) { MAPZ.keep = { bg: mapBg, V: MAPV }; mapView('area', [[-FLY_C.z, FLY_C.x, FLY_R + 30]]); }
  else if (MAPZ.keep) { mapBg = MAPZ.keep.bg; MAPV = MAPZ.keep.V; MAPZ.keep = null; }
  MAPZ.on = on; ui.map.classList.toggle('big', on);
}
ui.map.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); mapZoom(!MAPZ.on); });
function mapView(key, pts, once) {
  if (MAPZ.on && key !== 'area') { MAPZ.on = false; MAPZ.keep = null; ui.map.classList.remove('big'); }   // 새 비행이 시작되면 기본 지도로
  if (!pts || !pts.length) key = 'course';
  if (MAP_CACHE[key] && !once) { mapBg = MAP_CACHE[key]; MAPV = MAP_CACHE[key].V; return; }
  let d0 = 1e9, d1 = -1e9, s0 = 1e9, s1 = -1e9;
  for (const [d, s, r] of pts) { d0 = Math.min(d0, d - (r || 0)); d1 = Math.max(d1, d + (r || 0)); s0 = Math.min(s0, s - (r || 0)); s1 = Math.max(s1, s + (r || 0)); }
  d0 -= 40; d1 += 40; s0 -= 40; s1 += 40;
  const kd = (d1 - d0) / 300, ks = (s1 - s0) / 180, k = Math.max(kd, ks, 1.0), dc = (d0 + d1) / 2, sc = (s0 + s1) / 2;
  MAPV = { d0: dc - 150 * k, d1: dc + 150 * k, s0: sc - 90 * k, s1: sc + 90 * k };
  mapBg = document.createElement('canvas'); mapBg.width = 180; mapBg.height = 300; drawMapBg(); mapBg.V = MAPV; if (!once) MAP_CACHE[key] = mapBg;
}
MAP_CACHE.course.V = MAPV_COURSE;
function drawMap(gpos) {
  const g = ui.map.getContext('2d'); g.clearRect(0, 0, 180, 300); g.drawImage(mapBg, 0, 0);
  const toDS = p => [-p.z, p.x];
  const o = curObj();
  if (o && o.mk && o.search) { const [d, s] = toDS(o.mk); const p = mxy(d, s), q = mxy(d + o.search.r, s), rr = Math.max(5, Math.hypot(q[0] - p[0], q[1] - p[1])); g.strokeStyle = 'rgba(255,200,40,.9)'; g.fillStyle = 'rgba(255,200,40,.14)'; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.beginPath(); g.arc(p[0], p[1], rr, 0, 7); g.fill(); g.stroke(); g.setLineDash([]); }
  // 산불: 다른 신고 구역(번호)과 보고 끝난 불씨(✓) 도 지도에
  if (S.kind === 'fire' && isMission() && MS.list) { g.font = '700 10px monospace'; MS.list.forEach((x, i) => { if (!x.mk) return;
    if (x.done) { const q = mxy(...toDS(x.tp)); g.fillStyle = '#9aa6ad'; g.fillText('✓' + (i + 1), q[0] + 3, q[1] - 2); g.beginPath(); g.arc(q[0], q[1], 2, 0, 7); g.fill(); return; }
    if (!x.active) return; const p = mxy(...toDS(x.mk)); if (x !== o) { const q = mxy(...toDS(x.mk.clone().add(new V3(0, 0, -x.search.r)))), rr = Math.max(5, Math.hypot(q[0] - p[0], q[1] - p[1])); g.strokeStyle = 'rgba(255,200,40,.5)'; g.setLineDash([3, 3]); g.beginPath(); g.arc(p[0], p[1], rr, 0, 7); g.stroke(); g.setLineDash([]); }
    g.fillStyle = '#ffc828'; g.fillText(String(i + 1), p[0] - 3, p[1] + 4); }); }
  if (o && o.mk && o.search && S.kind === 'sar') { const p = mxy(...toDS(o.mk)); g.font = '700 10px monospace'; g.fillStyle = '#ffc828'; g.fillText('SAR', p[0] - 9, p[1] + 4); }
  else if (o && o.mk && !o.search) { const [d, s] = toDS(o.mk); const p = mxy(d, s); g.strokeStyle = '#ffc828'; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], 6 + Math.sin(performance.now() / 200) * 1.5, 0, 7); g.stroke(); }
  if (gpos) { const [d, s] = toDS(gpos); const p = mxy(d, s); g.fillStyle = '#4fe3ff'; g.beginPath(); g.arc(p[0], p[1], 3, 0, 7); g.fill(); }
  if (S.state !== 'demo') {
    const src = S.state === 'replay' ? RP.pose : DR;
    const [d, s] = toDS(src.p); const p = mxy(d, s); g.save(); g.translate(clamp(p[0], 4, 176), clamp(p[1], 4, 296));
    const pu = 7 + (performance.now() / 120 % 8); g.strokeStyle = `rgba(255,60,90,${0.9 - (pu - 7) / 9})`; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, pu, 0, 7); g.stroke();   // 퍼지는 고리
    g.rotate(src.h); g.fillStyle = '#ff2d55'; g.strokeStyle = '#000'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 7); g.lineTo(0, 3); g.lineTo(-7, 7); g.closePath(); g.stroke(); g.fill(); g.restore();
  }
}
function drawSticks() {
  const g = ui.stk.getContext('2d'); g.clearRect(0, 0, 150, 70);
  const box = (x, sx, sy) => {
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.strokeRect(x, 4, 62, 62); g.beginPath(); g.moveTo(x + 31, 4); g.lineTo(x + 31, 66); g.moveTo(x, 35); g.lineTo(x + 62, 35); g.strokeStyle = 'rgba(255,255,255,.12)'; g.stroke();
    g.fillStyle = '#ffc828'; g.beginPath(); g.arc(x + 31 + sx * 27, 35 - sy * 27, 5, 0, 7); g.fill();
  };
  box(4, IN.yaw, IN.thr); box(82, IN.roll, IN.pitch);
}
// 화면 좌표
const _np = new V3();
function toScreen(p) { _np.copy(p).project(camera); return { x: (_np.x + 1) / 2 * innerWidth, y: (1 - _np.y) / 2 * innerHeight, behind: _np.z > 1 }; }
// 낙하 예측점 표시 (3D)
const impactRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0xffc828, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
impactRing.rotation.x = -Math.PI / 2; impactRing.renderOrder = 6; impactRing.visible = false; scene.add(impactRing);
function updateTargeting(subj) {
  const o = curObj(), fpv = CAMS[S.cam] === 'FPV', running = S.state === 'run' && DR.alive && !(S.tut && S.tut.st === 'intro');
  // 1) 게이트 조준 브래킷 + 비행 방향 표시
  const op = running ? openingOf(o) : null;
  let fpmPos = null;
  if (running && fpv && DR.v.length() > 1.0) {
    const s = toScreen(DR.p.clone().addScaledVector(DR.v, 1.2));
    if (!s.behind) { fpmPos = s; ui.fpm.style.left = (s.x - 14) + 'px'; ui.fpm.style.top = (s.y - 8) + 'px'; }
  }
  ui.fpm.classList.toggle('hidden', !fpmPos);
  if (op && CAMS[S.cam] !== 'TOP') {
    const b = op.b, cz = op.czc !== undefined ? op.czc : op.lz;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => toScreen(op.side ? b.world(op.lx, op.ly + sx * op.hx, cz + sz * op.hz) : b.world(op.lx + sx * op.hx, op.ly, cz + sz * op.hz)));
    const c = b.world(op.lx, op.ly, op.lz), dist = c.distanceTo(subj.p);
    if (pts.every(p => !p.behind) && dist < 60) {
      let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
      const mw = 28; if (x1 - x0 < mw) { const m = (x0 + x1) / 2; x0 = m - mw / 2; x1 = m + mw / 2; } if (y1 - y0 < mw) { const m = (y0 + y1) / 2; y0 = m - mw / 2; y1 = m + mw / 2; }
      ui.brk.classList.remove('hidden');
      Object.assign(ui.brk.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
      // 정렬 여부: 비행 방향 표시(또는 화면 중앙)가 브래킷 안에 있는지
      const ref = fpmPos || { x: innerWidth / 2, y: innerHeight / 2 };
      const ok = ref.x > x0 && ref.x < x1 && ref.y > y0 && ref.y < y1;
      ui.brk.classList.toggle('ok', ok);
      ui.brkLbl.textContent = `${dist.toFixed(0)} m`;
    } else ui.brk.classList.add('hidden');
  } else ui.brk.classList.add('hidden');
  // 2) 투하 조준경
  let tgtKey = null;
  if (running && o && o.kind === 'drop') tgtKey = o.target;
  const pr = running ? predictImpact(DR.p, DR.v) : null;
  if (running && (S.kind === 'free' || (S.kind === 'tutorial' && !tgtKey))) { const n = nearestTarget(pr.p, S.simT + pr.t); if (n && n.d < 18) tgtKey = n.key; }
  $('keys').classList.toggle('hidden', !!(tgtKey && pr));
  if (!tgtKey || !pr) { ui.scope.classList.add('hidden'); impactRing.visible = false; return; }
  const ev = targetEval(tgtKey, pr.p, null, S.simT + pr.t);
  ui.scope.classList.remove('hidden');
  impactRing.visible = true; impactRing.position.copy(pr.p).setY(pr.p.y + 0.03);
  impactRing.material.color.set(ev.hit ? 0x5dff9a : 0xffc828);
  const g = ui.scopeC.getContext('2d'), Wd = 170, sc = 170 / 30;   // 30 m 폭
  g.clearRect(0, 0, Wd, Wd); g.save(); g.translate(Wd / 2, Wd / 2);
  g.strokeStyle = 'rgba(255,255,255,.18)'; for (const r of [5, 10]) { g.beginPath(); g.arc(0, 0, r * sc, 0, 7); g.stroke(); }
  g.beginPath(); g.moveTo(-Wd / 2, 0); g.lineTo(Wd / 2, 0); g.moveTo(0, -Wd / 2); g.lineTo(0, Wd / 2); g.stroke();
  const f = new V3(Math.sin(DR.h), 0, -Math.cos(DR.h)), rgt = new V3(Math.cos(DR.h), 0, Math.sin(DR.h));
  const S2 = w => { const d = new V3(w.x - pr.p.x, 0, w.z - pr.p.z); return [d.dot(rgt) * sc, -d.dot(f) * sc]; };
  g.fillStyle = ev.hit ? '#5dff9a' : '#ff6a5a'; g.strokeStyle = g.fillStyle;
  if (tgtKey === 'ivan') { const b = OBJ.ivan_grp1; for (const bd of b.boards) { const [x, y] = S2(b.world(bd[0], 0, 0)); g.fillRect(x - 3, y - 3, 6, 6); g.beginPath(); g.arc(x, y, 1.4 * sc, 0, 7); g.stroke(); } }
  else if (tgtKey === 'mit') { const b = OBJ.mit; const [x, y] = S2(b.world(mitX(S.simT + pr.t), 0, 0)); g.fillRect(x - 3, y - 3, 6, 6); g.beginPath(); g.arc(x, y, 1.6 * sc, 0, 7); g.stroke(); const [x2, y2] = S2(b.world(b.car.position.x, 0, 0)); g.globalAlpha = 0.4; g.fillRect(x2 - 2, y2 - 2, 4, 4); g.globalAlpha = 1; }
  else { const b = OBJ.tank, fx = b.foot.x + 0.6, fy = b.foot.y + 0.6; const cs = [[-fx, -fy], [fx, -fy], [fx, fy], [-fx, fy]].map(([x, y]) => S2(b.world(x, y, 0))); g.beginPath(); cs.forEach((c, i) => i ? g.lineTo(c[0], c[1]) : g.moveTo(c[0], c[1])); g.closePath(); g.stroke(); g.globalAlpha = 0.18; g.fill(); g.globalAlpha = 1; }
  g.strokeStyle = '#ffc828'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.moveTo(0, -8); g.lineTo(0, 8); g.stroke(); g.lineWidth = 1;
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(0, -Wd / 2 + 4); g.lineTo(5, -Wd / 2 + 12); g.lineTo(-5, -Wd / 2 + 12); g.fill();
  g.restore();
  ui.scopeTxt.innerHTML = ev.hit ? '<b style="color:#5dff9a">DROP NOW</b>' : `${ev.name} · OFFSET ${ev.d.toFixed(1)} m · ${pr.t.toFixed(1)} s`;
  ui.scopeBar.style.width = (clamp(1 - ev.d / 15, 0, 1) * 100) + '%';
  ui.scopeBar.style.background = ev.hit ? '#5dff9a' : '#ffc828';
  ui.scope.classList.toggle('ok', ev.hit);
}
function updateHUD(dt, subj) {
  msgTimer -= dt; if (msgTimer <= 0) ui.objMsg.classList.remove('show');
  const spd = subj.v ? subj.v.length() * 3.6 : 0;
  const o = curObj();
  const sIn = searchIn(o, subj.p), dist = o && o.mk && !sIn ? (o.search ? Math.max(0, Math.hypot(o.mk.x - subj.p.x, o.mk.z - subj.p.z) - o.search.r) : o.mk.distanceTo(subj.p)) : null;
  const tm = S.state === 'replay' ? RP.t - RP.rec.s[0][0] : (S.kind === 'course' || isMission()) ? S.t : S.kind === 'demo' ? S.ghostT : S.flyT;
  ui.osd.innerHTML = `<div class="big">${fmt(tm)}${(S.kind === 'course' || isMission()) && S.pen ? ` <span style="color:#ff7070;font-size:16px">+${S.pen}s</span>` : ''}</div>` +
    `<div><b>ALT</b>${Math.max(0, agl(subj.p) - 0.06).toFixed(1)} m${TER.h ? ` <span style="color:#9aa6ad;font-size:.75em">MSL ${(subj.p.y + SITE.base).toFixed(0)}</span>` : ''}</div>` + `<div><b>SPD</b>${spd.toFixed(0)} km/h</div>` +
    (dist !== null ? `<div><b>${o.search ? 'AREA' : 'DIST'}</b>${dist.toFixed(0)} m</div>` : sIn ? `<div style="color:#ffc828">${L2x('수색 구역 안', 'IN SEARCH AREA')}</div>` : '') +
    (S.kind === 'course' ? `<div><b>HIT</b>${S.impacts}</div>` : '') +
    (o && o.kind === 'orbit' ? `<div style="color:#4fe3ff">ORBIT ${Math.min(100, Math.abs(S.orbSum) / (Math.PI * 2) * 100).toFixed(0)}%</div>` : '') +
    (S.state === 'run' && (isMission() || AFc().cls === 'wing') ? msOsd() : '') + (S.state === 'run' ? windOsd(subj.p) : '') +
    (S.boosting ? '<div style="color:#ff9a40">BOOST ▲▲</div>' : '') +
    (S.state !== 'demo' && insideBunker(subj.p) ? `<div style="color:#5dff9a">SCAN ${Math.min(100, S.scan / 1.5 * 100).toFixed(0)}%</div>` : '');
  if (S.kind === 'course') {
    ui.objNext.style.display = '';
    ui.objNext.innerHTML = o ? `NEXT ▸ ${o.label}<small>${S.objIdx + 1}/${OBJS.length}</small>` : 'COURSE COMPLETE';
  } else if (isMission() && S.state !== 'replay') { ui.objNext.style.display = ''; ui.objNext.innerHTML = o ? `NEXT ▸ ${o.label}<small>${MS.idx + 1}/${MS.list.length}</small>` : 'MISSION COMPLETE'; }
  else if (S.kind === 'tutorial' && S.tut) { ui.objNext.style.display = ''; ui.objNext.innerHTML = `LESSON ${S.tut.i + 1} ▸ ${o ? o.label : 'COMPLETE'}`; }
  else if (S.state === 'replay') { ui.objNext.style.display = ''; ui.objNext.innerHTML = `REPLAY <small>${RP.rec.kind === 'course' ? MODES[RP.rec.diff] ? MODES[RP.rec.diff].name : '' : 'FREE'} ×${RP.speed}</small>`; }
  else if (S.kind === 'demo') { ui.objNext.style.display = ''; ui.objNext.innerHTML = `REFERENCE FLIGHT <small>${fmt(S.ghostT)} / ${fmt(GH.total)}</small>`; }
  else ui.objNext.style.display = 'none';
  const podE = isMission() && S.kind !== 'sar' && S.state === 'run', kitM = S.kind === 'sar' && S.state === 'run', n = podE ? 0 : kitM ? S.kits | 0 : S.kind === 'course' && S.state === 'run' ? S.payloads : droneM.cans.filter(c => c.visible).length;
  const ak = actionKind(); ui.payload.innerHTML = ak === 'report' ? '📷 REPORT' : podE ? 'POD —' : (kitM ? 'KIT ' : 'M84 ') + [0, 1, 2].slice(0, kitM ? 2 : 3).map(i => `<i class="${i < n ? '' : 'used'}"></i>`).join('');
  if (o && o.mk && S.state === 'run' && DR.alive && !sIn) {
    const s = toScreen(o.mk);
    let x = s.x / innerWidth * 2 - 1, y = 1 - s.y / innerHeight * 2; if (s.behind) { x = -x; y = -y; }
    const off = s.behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88;
    if (off) {
      const ang = Math.atan2(y, x), m = Math.max(Math.abs(x) / 0.88, Math.abs(y) / 0.8, 1e-3); x /= m; y /= m;
      ui.arrow.classList.remove('hidden');
      ui.arrow.style.left = ((x + 1) / 2 * innerWidth - 13) + 'px'; ui.arrow.style.top = ((1 - y) / 2 * innerHeight - 13) + 'px';
      ui.arrow.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
    } else ui.arrow.classList.add('hidden');
  } else ui.arrow.classList.add('hidden');
  drawSticks();
  updateTargeting(subj);
}

// =====================================================================
//  ghost / main loop
// =====================================================================
const ghostS = { p: new V3(), v: new V3(), h: 0, pitch: 0, roll: 0 };
const _gp = new V3(), _gn = new V3();
function updateGhost(t, dt) {
  GH.at(t, _gp); GH.at(t + 0.15, _gn);
  const vel = _gn.clone().sub(_gp).divideScalar(0.15);
  const hs = Math.hypot(vel.x, vel.z);
  if (hs > 0.3) {
    const nh = Math.atan2(vel.x, -vel.z); const dh = wrapA(nh - ghostS.h);
    const step = dh * (1 - Math.exp(-dt * 6)); ghostS.h += step;
    const rate = step / Math.max(dt, 1e-3);
    ghostS.roll = lerp(ghostS.roll, clamp(Math.atan(hs * rate / G), -0.55, 0.55), 1 - Math.exp(-dt * 5));
  } else ghostS.roll = lerp(ghostS.roll, 0, 1 - Math.exp(-dt * 5));
  ghostS.pitch = lerp(ghostS.pitch, clamp(hs * 0.028, 0, 0.5), 1 - Math.exp(-dt * 4));
  ghostS.v.copy(vel); ghostS.p.copy(_gp);
}
// 고정익의 pitch 는 '상승각'(+ 위), 쿼드는 '앞으로 숙임'(+ 아래) -> 그릴 때 부호를 맞춤
function visPitch(st) { return st !== ghostS && AFc().cls === 'wing' ? -st.pitch : st.pitch; }
function placeModel(mdl, st) { mdl.g.position.copy(st.p); eul.set(-visPitch(st), -st.h, -st.roll); mdl.g.quaternion.setFromEuler(eul); }
let last = performance.now(), acc = 0;
const STEP = 1 / 120;
function handleKeys() {
  while (pressed.length) {
    const k = pressed.shift();
    if (RCUI.open) continue;
    if (!S.brief && typeof c1Key === 'function' && c1Key(k)) continue;
    if (S.brief && (k === 'Enter' || k === 'Space' || k === 'PadA' || (k === 'KeyQ' && typeof isC1 === 'function' && isC1()))) { if (BRIEF_GO) BRIEF_GO(); continue; }
    if (k === 'KeyF') { toggleFull(); continue; }
    if (k === KB.boost) { boostToggle(); continue; }
    if (k === 'KeyT') { irSet(!ENV.ir); continue; }
    if (k === 'KeyB') { MUS.on = !MUS.on; musicSetLevel(); saveMusic(); syncSeg(); if (S.state !== 'menu') showMsg(MUS.on ? 'MUSIC ON' : 'MUSIC OFF', '#fff', 0.8); continue; }
    if (S.state === 'replay') { replayKey(k.replace(/^(MV_|X_)/, '')); continue; }
    if (S.state === 'menu') {
      if (k === 'Escape') { if (!closePanels() && MENU.step > 1) wizGo(MENU.step - 1); continue; }
      if (['setPanel', 'recPanel', 'helpPanel', 'tutMenu', 'kbPanel'].some(p => !$(p).classList.contains('hidden'))) continue;
      if (k === 'Enter' || k === 'PadA') { if (MENU.step < 3) wizGo(MENU.step + 1); else menuGo(); } else if (k === 'KeyT' && MENU.step === 3) openTutMenu(); continue;
    }
    if (S.state === 'result') { if (k === 'Enter' || k === 'PadA') startRun(S.lastKind || S.kind); else if (k === 'KeyV' || k === 'KeyH') replayStart(LAST_REC, 'result'); else if (k === 'Escape') toMenu(); continue; }
    if (k === 'Escape') { togglePause(); continue; }
    if (S.state === 'pause') continue;
    if ((k === 'Enter' || k === 'PadA') && S.state === 'run' && photoMission()) { missionPhoto(); continue; }   // 산불·수색: 사진 찍어 보고
    if (S.kind === 'tutorial' && S.tut) {
      if (S.tut.st === 'intro' && (k === 'Enter' || k === 'Space' || k === 'X_Space' || k === 'PadA')) { tutFly(); continue; }
      if (S.tut.st === 'done') { if (k === 'Enter' || k === 'Space' || k === 'X_Space' || k === 'PadA') { tutNext(); continue; } if (k === 'KeyR') { tutRetry(); continue; } }
    }
    if (k === 'KeyC' || k === 'PadRB') { S.cam = [2, 0, 1][S.cam]; updateTags(); }
    else if (k === 'PadLB') { S.cam = (S.cam + 2) % 3; updateTags(); }
    else if (k === 'KeyX' || k === 'PadLeft') { const vis = bellyMode() !== null; S.bellyOv = { val: !vis, idx: S.objIdx }; showMsg(!vis ? 'BELLY CAM ON' : 'BELLY CAM OFF', '#fff', 0.8); }
    else if (k === 'KeyV') { SET.guide = !SET.guide; saveSet(); syncSeg(); showMsg(SET.guide ? 'GUIDE ON' : 'GUIDE OFF', '#fff', 0.8); }
    else if (k === 'KeyZ') { SET.zoom = (SET.zoom + 1) % 3; saveSet(); showMsg('ZOOM ' + ['FAR', 'MID', 'NEAR'][SET.zoom], '#fff', 0.7); }
    else if (k === 'KeyP') { SET.showPath = !SET.showPath; GH.line.visible = SET.showPath; }
    else if (k === 'KeyJ') { mapZoom(!MAPZ.on); }
    else if (k === 'KeyL') { S.lightOv = !lightOn(); showMsg(S.lightOv ? L2x('조명 켬', 'LIGHT ON') : L2x('조명 끔', 'LIGHT OFF'), '#ffe9a0', 0.9); }
    else if (k === 'KeyM') { AU.on = !AU.on; showMsg(AU.on ? 'SOUND ON' : 'SOUND OFF', '#fff', 0.8); if (AU.master) AU.master.gain.value = AU.on ? 0.55 : 0; }
    else if (k === 'KeyH') { SET.assist = !SET.assist; saveSet(); updateTags(); syncSeg(); showMsg(SET.assist ? 'ASSIST ON' : 'ASSIST OFF', '#fff', 0.8); }
    else if (k === 'PadUp') { SET.tilt = Math.min(40, SET.tilt + 5); saveSet(); syncSeg(); showMsg('CAM TILT ' + SET.tilt + '°', '#fff', 0.7); }
    else if (k === 'PadDown') { SET.tilt = Math.max(0, SET.tilt - 5); saveSet(); syncSeg(); showMsg('CAM TILT ' + SET.tilt + '°', '#fff', 0.7); }
    if (S.state !== 'run') continue;
    if (S.tut && S.tut.st !== 'fly') continue;
    if (k === 'Space' && DR.alive) { if (actionKind() === 'report') missionPhoto(); else dropPayload(DR.p, DR.v, false); }   // 투하 버튼 = 임무에 따라 투하 / 사진 보고
    else if (k === 'KeyR') respawn();
    else if (k === 'KeyN' && isMission() && S.running && msObj()) { S.pen += 20; msNext('SKIPPED +20s', '#ff9a40'); }
    else if (k === 'KeyN' && S.kind === 'course' && S.running && curObj() && curObj().kind !== 'land') { S.pen += 20; completeObj(2, 'SKIPPED +20s', '#ff9a40'); }
  }
}
function togglePause() {
  if (S.state === 'run' || S.state === 'demo') { S.prevState = S.state; S.state = 'pause'; ui.pause.classList.remove('hidden'); musicSetLevelPaused(true); }
  else if (S.state === 'pause') { S.state = S.prevState; ui.pause.classList.add('hidden'); last = performance.now(); musicSetLevelPaused(false); }
}
function musicSetLevelPaused(p) { if (MUS.bus && AU.ctx) MUS.bus.gain.setTargetAtTime(musicLevel() * (p ? 0.4 : 1), AU.ctx.currentTime, 0.2); }
let flagT = 0, REC_T0_SET = false;
const TEST = /[?&]test/.test(location.search);
let XR_ON = false;   // VR(WebXR) 중: 화면 갱신은 XR 세션이 돌림
function frame(now, noRender) {
  if (!TEST && !XR_ON) requestAnimationFrame(frame);
  let dt = Math.max(0, Math.min((now - last) / 1000, 0.1)); last = now;
  readInput(dt); handleKeys();
  if (RCUI.open) rcPanelUpdate();
  const playing = S.state === 'run' || S.state === 'demo';
  if (S.state === 'pause') dt = 0;
  S.simT += dt; S.msgCD -= dt;
  if (OBJ.mit) OBJ.mit.update(S.simT);
  flagT += dt;
  if (flagMesh) {
    const pos = flagMesh.geometry.attributes.position, base = flagMesh.userData.base;
    for (let i = 0; i < pos.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; pos.setZ(i, Math.sin(x * 3.2 - flagT * 6 + y * 0.8) * 0.12 * x / 1.8); pos.setY(i, y - x * 0.08); }
    pos.needsUpdate = true; if ((flagT * 60 | 0) % 3 === 0) flagMesh.geometry.computeVertexNormals();
  }
  let subj = DR;
  skyU.time.value = S.simT;
  const tutHold = S.kind === 'tutorial' && S.tut && S.tut.st !== 'fly';
  if (S.state === 'run') {
    if (!tutHold && !S.brief) {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP; _prevP.copy(DR.p); stepDrone(STEP); S.bumpT -= STEP; S.hitCD -= STEP;
        if (S.kind === 'course' || S.kind === 'tutorial') checkObjectives(_prevP, DR.p, STEP); else if (isMission()) msStep(_prevP, DR.p, STEP);
      }
    }
    if (S.running && !S.finished && !S.brief && (S.kind === 'course' || isMission())) S.t += dt;
    S.flyT += dt;
    if (S.running && !REC_T0_SET && REC) { REC.t0 = S.flyT; REC_T0_SET = true; }
    if (!S.running) REC_T0_SET = false;
    recTick(dt);
    updatePayloads(dt);
  } else if (S.state === 'demo') {
    S.ghostT += dt; updatePayloads(dt);
    while (S.demoEvents < GH.events.length && GH.events[S.demoEvents].t <= S.ghostT) {
      const ev = GH.events[S.demoEvents++]; if (ev.label.startsWith('DROP')) dropPayload(ghostS.p, ghostS.v, 'demo'); showMsg(ev.label.replace(/^_.*/, ''), '#ffc828', 1.2);
    }
    if (S.ghostT > GH.total + 2.5) toMenu();
  } else if (S.state === 'replay') { replayTick(dt); subj = RP.pose; }
  const ghostOn = S.state === 'demo' || (S.state === 'pause' && S.prevState === 'demo');   // 고스트 드론은 기준 비행 보기에서만
  if (ghostOn) { if (S.state === 'demo' || !bestGhostPose(S.ghostT)) updateGhost(S.ghostT, Math.max(dt, 1e-3)); placeModel(ghostM, ghostS); ghostM.g.visible = S.ghostT > 0 && ghostS.p.distanceTo(DR.p) > 2.5; }
  else ghostM.g.visible = false;
  const demoing = S.state === 'demo' || (S.state === 'pause' && S.prevState === 'demo');
  if (demoing) { subj = ghostS; placeModel(droneM, ghostS); ghostM.g.visible = false; } else if (S.state === 'replay') placeModel(droneM, RP.pose); else placeModel(droneM, DR);
  const spinRate = 40 + (S.state === 'replay' ? RP.pose.thrust : DR.thrust) * 60;
  droneM.props.forEach((p, i) => p.rotation.y += (i % 2 ? 1 : -1) * (demoing ? 70 : spinRate) * dt);
  ghostM.props.forEach((p, i) => p.rotation.y += (i % 2 ? 1 : -1) * 70 * dt);
  droneM.leds[0].visible = droneM.leds[1].visible = (S.simT * 2 % 1) < 0.5;
  const o = curObj();
  OBJS.forEach(ob => { if (ob.hint) ob.hint.visible = false; if (ob.hint2) { ob.hint1.visible = false; ob.hint2.visible = false; } });
  if (o && o.kind === 'bunker') { o.hint = S.scanned ? o.hint2 : o.hint1; o.mk = S.scanned ? o.mk2 : o.mk1; }
  if (o) {
    if (o.hint) { o.hint.visible = true; o.hint.material.opacity = (o.kind === 'drop' || o.kind === 'land' ? 0.45 : 0.16) + 0.1 * Math.sin(S.simT * 5); if (o.follow) { const w = OBJ.mit.world(OBJ.mit.car.position.x, 0, 0); o.hint.position.set(w.x, 0.05, w.z); o.mk.set(w.x, 4.2, w.z); } }
    marker.visible = !!o.mk && !searchIn(o, subj.p); if (marker.visible) { marker.position.copy(o.mk).add(new V3(0, Math.sin(S.simT * 3) * 0.15, 0)); marker.rotation.y += dt * 2; const d = camera.position.distanceTo(marker.position); const sc = Math.max(1, d / 22); marker.scale.set(sc, sc * 1.5, sc); }
  } else marker.visible = false;
  const subjPos = subj.p;
  const inB = S.state !== 'menu' && insideBunker(subjPos);
  const nearB = OBJ.bunker1 && OBJ.bunker1.world(0, 0, 1.5).distanceTo(subjPos) < 5;
  hemi.intensity = lerp(hemi.intensity, inB ? 0.04 : envHemi(), 1 - Math.exp(-dt * 5));
  spot.intensity = lerp(spot.intensity, (lightOn() || inB || nearB) && S.state !== 'menu' && !(typeof isC1 === 'function' && isC1() && !ENV.night) ? 4.5 : 0, 1 - Math.exp(-dt * 8));
  { eul.set(-visPitch(subj), -subj.h, -subj.roll); const q = new THREE.Quaternion().setFromEuler(eul);
    spot.position.copy(subjPos).add(new V3(0, 0, -0.14).applyQuaternion(q)); spotT.position.copy(subjPos).add(new V3(0, -0.6, -3).applyQuaternion(q)); spotT.updateMatrixWorld(); }
  if (S.state === 'run' && tutHold && S.tut.st === 'intro') tutCamera(dt);
  else if (S.state === 'menu') menuCam(dt);
  else updateCamera(dt, subj);
  camera.updateMatrixWorld();
  updateGuide(subj);
  droneM.g.visible = (DR.alive || S.state !== 'run') && !(CAMS[S.cam] === 'FPV' && S.state !== 'menu' && S.state !== 'result' && !(tutHold && S.tut.st === 'intro'));
  $('vig').classList.toggle('hidden', !(CAMS[S.cam] === 'FPV' && (S.state === 'run' || S.state === 'replay') && !(tutHold && S.tut.st === 'intro')));
  const focus = S.state === 'menu' ? menuFocus() : subjPos;
  sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(SUN_DIR, 120);
  sky.position.copy(camera.position);
  updateFX(dt); envTick(dt); scenTick(dt); reloadTick(dt);
  if (playing || S.state === 'pause' || S.state === 'replay') { updateHUD(dt, subj); drawMap(ghostOn && ghostM.g.visible ? ghostS.p : null); }
  audioUpdate(demoing ? 0.55 : S.state === 'replay' ? RP.pose.thrust : DR.thrust, subj.v ? subj.v.length() : 0, (S.state === 'run' && !tutHold && !(DR.landed && IN.thr <= 0.05)) || S.state === 'demo' || (S.state === 'replay' && RP.playing));
  if (XR_ON) xrTick(dt);   // VR: 드론 카메라 영상을 화면 텍스처로 먼저 그림
  if (!noRender) { const mn = S.state === 'menu' && !XR_ON; if (mn) menuRenderPre(dt); (typeof c1VRon === 'function' && c1VRon() && C1XR.cam) ? renderer.render(scene, C1XR.cam) : renderer.render(XR_ON ? VRS : scene, camera); if (!XR_ON) renderBelly(); if (mn) menuRenderPost(); }
}

// =====================================================================
//  튜토리얼
// =====================================================================
function startFacing(idx, back, altOverride, sideOff) {
  const o = OBJS[idx], op = openingOf(o);
  const b = o.b; const lz = altOverride !== undefined ? altOverride : op.lz;
  const p = b.world(op.lx + (sideOff || 0), op.ly - back, lz), c = b.world(op.lx, op.ly, lz);
  const d = c.clone().sub(p); return { p, h: Math.atan2(d.x, -d.z), focus: b.world(op.lx, op.ly, lz) };
}
function startBeforeTarget(tw, back, alt) {
  // 경로가 있으면 경로 진행 방향 뒤쪽, 없으면 다운레인지 뒤쪽에서 시작
  const pi = pathInfo(-tw.z, tw.x), dd = pi ? pi.dir : [1, 0];
  const p = W(-tw.z - dd[0] * back, tw.x - dd[1] * back, alt);
  return { p, h: Math.atan2(dd[1], dd[0]), focus: tw.clone().setY(groundAt(tw.x, tw.z) + 1.5) };
}
const LESSONS = [
  { title: '기본 조작', sub: '이륙 · 제자리 비행 · 이동 · 착륙', custom: true,
    text: [IS_TOUCH ? '왼쪽 스틱을 위로 밀면 올라가고 아래로 내리면 내려옵니다(좌우 = 기체 회전). 오른쪽 스틱으로 앞뒤·좌우로 움직입니다.' : '올라가기 {UP} · 내려오기 {DOWN} · 앞뒤 {FWD}/{BACK} · 좌우 이동 {LEFT}/{RIGHT} · 방향 돌리기 {YAWL}/{YAWR}. 키는 메뉴의 [키 설정]에서 바꿀 수 있습니다.',
      '입문 모드에서는 스틱(키)을 놓으면 기체가 그 자리에 멈춥니다. 급하게 누르지 말고 짧게 여러 번 눌러 보세요.',
      '화면 왼쪽 아래 두 칸은 지금 스틱 위치입니다 (왼쪽 = 스로틀·회전, 오른쪽 = 전후·좌우).'],
    spec: 'H 패드 지름 1.2 m · 착륙은 패드 위에서 속도가 거의 0일 때 0.8초 유지',
    start: () => ({ p: startPos(), h: startHead(), focus: OBJ.pad_start.world(0, 0, 0.5), landed: true }),
    steps: [
      { label: '이륙: 2 m 위로', mk: () => OBJ.pad_start.world(0, 0, 2.5), test: p => agl(p) > 2.0 },
      { label: '제자리 비행 3초 (속도 0)', mk: () => null, hold: 3, test: () => DR.v.length() < 0.6 && agl(DR.p) > 1.0 },
      { label: '앞으로 15 m 이동', mk: () => OBJ.pad_start.world(0, 16, 2), test: p => OBJ.pad_start.local(p).ly > 14.5 },
      { label: '돌아와서 출발 패드에 착륙', mk: () => OBJ.pad_start.world(0, 0, 1.8), test: p => { const l = OBJ.pad_start.local(p); return Math.hypot(l.lx, l.ly) < 0.85 && DR.landed && DR.v.length() < 0.8; }, hold: 0.8 }
    ] },
  { title: '링 (Circle Obstacle)', sub: '정밀 통과', range: [1, 1],
    text: ['고정된 링 가운데를 정확히 지나가는 연습입니다. 링 테두리에 닿으면 튕기고 벌점이 붙습니다.',
      '링 높이에 먼저 고도를 맞춘 뒤, 노란 조준 테두리 안에 초록 비행 방향 표시(○—)가 들어오게 하고 천천히 전진하세요.'],
    spec: () => `안지름 1.22 m (4 ft) · 중심 높이 ${num(BY.ring_a.alt, 2.75)} m · 두 H 패드 사이`,
    start: () => startFacing(1, 12) },
  { title: '사각 게이트 (Window)', sub: '게이트 통과 · 자세 제어', range: [2, 2],
    text: ['열린 창 가운데를 통과합니다. 창이 높이 떠 있으므로 아래 받침대에 걸리지 않게 고도를 먼저 맞추세요.',
      '거리가 가까워질수록 조준 테두리가 커집니다. 초록으로 바뀐 상태를 유지하면서 지나가면 됩니다.'],
    spec: () => `열린 곳 1.22 × 1.22 m · 아랫변 높이 ${num(BY.gate_sq1.elev, 2.05)} m`,
    start: () => startFacing(2, 12) },
  { title: '삼각 게이트', sub: '높은 고도 통과', range: [3, 3],
    text: ['다른 모양, 더 높은 고도의 게이트입니다. 삼각형은 아래쪽이 넓으니 가운데보다 약간 아래를 노리면 여유가 많습니다.',
      '높이 4 m 이상으로 올라가야 합니다. 올라가는 동안에는 전진을 멈추고 고도부터 맞추세요.'],
    spec: () => `내접원 1.22 m (4 ft) · 한 변 ${num(BY.gate_tri1.w, 2.11)} m · 밑변 높이 ${num(BY.gate_tri1.elev, 4.05)} m`,
    start: () => startFacing(3, 12) },
  { title: '기둥 슬라럼', sub: '속도를 유지하며 장애물 회피', range: [5, 10],
    text: ['흑황 기둥 6개를 지그재그로 통과합니다. 화면 위 안내(LEFT SIDE / RIGHT SIDE)와 하늘색 표시 쪽으로 지나가세요.',
      '기둥은 두 줄로 어긋나 있습니다. 회전({YAWL}/{YAWR})보다 좌우 이동({LEFT}/{RIGHT})을 조금씩 쓰는 것이 안정적입니다.'],
    spec: '기둥 6개 · 높이 7.0 m · 두 줄 (2.5 m 간격) 엇갈림',
    start: () => { const s = startFacing(5, 9, 2.1); return s; } },
  { title: '투하 1 · Ivan 표적', sub: '고정 표적 공격', range: [11, 11],
    text: ['탑재물(M84 모형)을 지상 표적에 떨어뜨립니다. 왼쪽 아래 DROP SCOPE의 가운데 + 가 "예상 낙하점"입니다.',
      '드론이 움직이면 탑재물도 그 속도로 앞으로 날아갑니다. 표적이 +에 겹쳐 DROP NOW(초록)가 뜨면 {DROP}(게임패드 A/RT).',
      '튜토리얼에서는 탑재물이 다시 채워지니 여러 번 연습해 보세요.'],
    spec: 'Ivan 실루엣 3개 · 2.2 m 간격 · 판 0.9 × 1.7 m · 명중 반경 약 1.4 m',
    start: () => startBeforeTarget(OBJ.ivan_grp1.world(0, 0, 0), 28, 6) },
  { title: '투하 2 · MIT 이동 표적', sub: '움직이는 표적 추적', range: [12, 12],
    text: ['레일 위를 좌우로 움직이는 표적입니다. 조준경은 탑재물이 떨어지는 동안 표적이 이동할 위치를 미리 계산해 보여줍니다.',
      '표적을 따라가며 속도를 맞춘 뒤 투하하면 맞히기 쉽습니다. 흐린 점은 지금 표적 위치, 진한 점은 떨어질 때의 위치입니다.'],
    spec: () => `레일 ${num(BY.mit.length, 30)} m · 최대 3.5 m/s · ${BY.mit.down} m 지점`,
    start: () => startBeforeTarget(OBJ.mit.world(0, 0, 0), 26, 6) },
  { title: '투하 3 · 탱크', sub: '선회 정찰 후 탑 어택', range: [13, 14],
    text: ['먼저 탱크 주위를 반지름 약 12 m로 한 바퀴(360°) 돕니다. 바닥의 초록 원과 초록 틀을 따라 전진하면 되고, 화면 왼쪽 위에 ORBIT %가 표시됩니다.',
      '한 바퀴를 채우면 TOP ATTACK 단계로 바뀝니다. 탱크 위로 들어가 DROP SCOPE가 초록이 될 때 투하하세요. 선회 전에 떨어뜨린 탑재물은 회수됩니다.',
      '탱크는 크기가 커서 높은 곳에서 떨어뜨려도 맞습니다. 높을수록 낙하 시간이 길어져 앞으로 더 날아간다는 점만 기억하세요.'],
    spec: () => `차체 ${num(BY.tank.length, 8.1)} × ${num(BY.tank.w, 3.3)} m · 높이 ${num(BY.tank.height, 2.85)} m · ${BY.tank.down} m 지점`,
    start: () => startBeforeTarget(OBJ.tank.world(0, 0, 0), 32, 9) },
  { title: '터널', sub: '좁은 공간 통과 (복귀 중)', range: [15, 15],
    text: ['복귀하면서 대각선 방향으로 놓인 원통을 통과합니다. 입구가 비스듬하니 기체를 원통 방향에 정확히 맞춘 뒤 들어가세요.',
      '안에서는 속도를 줄이지 말고 곧게 지나가는 것이 오히려 안전합니다.'],
    spec: () => `안지름 ${num(BY.tunnel1.dia, 1.7)} m · 길이 ${num(BY.tunnel1.length, 4.5)} m · 방향 135°`,
    start: () => startFacing(15, 10) },
  { title: '벙커 정찰', sub: '건물 진입 · 내부 정찰', range: [16, 16],
    text: ['정면 위칸 창으로 들어가 안에서 1.5초 이상 정찰(SCAN)한 뒤, 왼쪽 벽의 두 번째 창으로 빠져나옵니다.',
      '복귀 중에는 벙커 뒤(북쪽)에서 다가오게 되므로, 벙커 옆으로 돌아 정면(남쪽) 창 앞에서 U턴해야 합니다. 노란 틀이 우회 경로입니다. 창 앞에서 멈춰 높이를 맞추고 천천히 들어가세요.',
      'SCAN COMPLETE가 뜨면 밖으로 나가면 됩니다. 영상처럼 왼쪽 창(하늘색)으로 나가도 되고, 들어온 창으로 다시 나와도 성공입니다.'],
    spec: () => `벙커 ${num(BY.bunker1.w, 3.8)} × ${num(BY.bunker1.d, 3.0)} × ${num(BY.bunker1.h, 3.1)} m · 창 약 1.0 × 0.8 m`,
    start: () => { const s = startFacing(16, 9); return s; } },
  { title: '결승 게이트 · 착륙', sub: '마지막 게이트와 정밀 착륙', range: [17, 18],
    text: ['출발 지점 쪽으로 돌아오며 FINISH 게이트를 통과한 뒤, 오른쪽 H 패드에 착륙합니다.',
      '착륙은 패드 위에서 속도를 거의 0으로 줄이고 내려오기({DOWN})로 천천히 내려가세요. 패드 위에 0.8초 머물면 완료됩니다.'],
    spec: () => `게이트 1.22 × 1.22 m · 아랫변 ${num(BY.gate_finish.elev, 1.6)} m · 착륙 패드 지름 1.2 m`,
    start: () => startFacing(17, 14) }
];
let TUT_DONE = {};
try { TUT_DONE = JSON.parse(localStorage.getItem('fpvsim_fpv_tut') || '{}'); } catch (e) { }
function tutStart(i) {
  enterFull();
  startRun('tutorial');
  S.tut = { i, st: 'intro', t: 0, step: 0, hold: 0 };
  const L = LESSONS[i]; const st = L.start();
  if (L.range) { S.objIdx = L.range[0]; S.running = true; }
  S.tut.startPose = st;
  const p = st.p.clone(); if (!st.landed) p.y = Math.max(p.y, groundAt(p.x, p.z) + 1.0);
  resetDrone(p, st.h);
  if (st.landed) DR.landed = true;
  S.respawn = { p: p.clone(), h: st.h };
  topH = st.h;
  ui.list.classList.add('hidden');
  tutRender();
  showMsg('', '#fff', 0.01);
}
function tutObj() {
  if (!S.tut) return null;
  const L = LESSONS[S.tut.i];
  if (L.custom) { const s = L.steps[S.tut.step]; if (!s) return null; return { kind: 'custom', label: s.label, mk: s.mk(), step: s }; }
  if (S.objIdx > L.range[1]) return null;
  return OBJS[S.objIdx];
}
function tutAfterObj() {
  const L = LESSONS[S.tut.i];
  if (L.range && S.objIdx > L.range[1]) tutComplete();
  tutRender();
}
function tutCustomCheck(p, dt) {
  const L = LESSONS[S.tut.i], s = L.steps[S.tut.step]; if (!s) return;
  if (s.test(p)) { S.tut.hold += dt; if (S.tut.hold >= (s.hold || 0)) { S.tut.hold = 0; S.tut.step++; sfx('good'); showMsg(s.label + ' ✓', '#5dff9a', 1.2); if (S.tut.step >= L.steps.length) tutComplete(); tutRender(); } }
  else S.tut.hold = 0;
}
function tutComplete() {
  S.tut.st = 'done';
  TUT_DONE[S.tut.i] = 1; try { localStorage.setItem('fpvsim_fpv_tut', JSON.stringify(TUT_DONE)); } catch (e) { }
  sfx('chime'); showMsg('LESSON COMPLETE', '#5dff9a', 2.5);
  tutRender(); renderTutMenu();
}
function tutFly() { if (S.tut && S.tut.st === 'intro') { S.tut.st = 'fly'; acc = 0; tutRender(); } }
function tutRetry() { tutStart(S.tut.i); tutFly(); }
function tutNext() { if (S.tut.i + 1 < LESSONS.length) tutStart(S.tut.i + 1); else { toMenu(); } }
function kbFill(t) {
  const T = IS_TOUCH ? { UP: '왼쪽 스틱 ↑', DOWN: '왼쪽 스틱 ↓', YAWL: '왼쪽 스틱 ←', YAWR: '→', FWD: '오른쪽 스틱 ↑', BACK: '↓', LEFT: '오른쪽 스틱 ←', RIGHT: '→', DROP: 'DROP' } : null;
  return t.replace(/\{(UP|DOWN|YAWL|YAWR|FWD|BACK|LEFT|RIGHT|DROP)\}/g, (m, k) => '<b>' + (T ? T[k] : keyName(KB[{ UP: 'up', DOWN: 'down', YAWL: 'yawL', YAWR: 'yawR', FWD: 'fwd', BACK: 'back', LEFT: 'left', RIGHT: 'right', DROP: 'drop' }[k]])) + '</b>');
}
function tutRender() {
  const el = $('tut'); if (!S.tut || S.kind !== 'tutorial') { el.classList.add('hidden'); return; }
  const L = LESSONS[S.tut.i], spec = typeof L.spec === 'function' ? L.spec() : L.spec;
  let steps = '';
  if (L.custom) steps = '<ol>' + L.steps.map((s, i) => `<li class="${i < S.tut.step ? 'done' : i === S.tut.step ? 'cur' : ''}">${s.label}</li>`).join('') + '</ol>';
  const foot = IS_TOUCH ? (S.tut.st === 'intro' ? '<div class="go">이 패널을 탭하면 비행 시작</div>' : S.tut.st === 'done' ? `<div class="go ok">완료! 이 패널을 탭 → ${S.tut.i + 1 < LESSONS.length ? '다음 단계' : '메뉴로'} · ⟲ 버튼 = 다시</div>` : '<div class="go dim">⟲ 버튼 = 처음 위치에서 다시 · ❚❚ = 일시정지</div>')
    : S.tut.st === 'intro' ? '<div class="go">준비되면 <b>Enter</b> 또는 <b>Space</b> (게임패드 <b>A</b>) — 비행 시작</div>'
    : S.tut.st === 'done' ? `<div class="go ok">완료! <b>Enter</b>(A) ${S.tut.i + 1 < LESSONS.length ? '다음 단계' : '메뉴로'} · <b>R</b>(Y) 다시</div>`
      : '<div class="go dim"><b>R</b>(Y) 처음 위치에서 다시 · <b>Esc</b> 일시정지</div>';
  el.classList.remove('hidden'); el.classList.toggle('mini', S.tut.st === 'fly');
  el.innerHTML = `<div class="k">LESSON ${S.tut.i + 1} / ${LESSONS.length}</div><h4>${L.title}</h4><div class="s">${L.sub}</div>` +
    `<div class="body">${L.text.map(t => `<p>${kbFill(t)}</p>`).join('')}<div class="spec">${spec}</div></div>${steps}${foot}`;
}
function tutCamera(dt) {
  const f = S.tut.startPose.focus; S.tut.t += dt;
  const a = S.tut.startPose.h + Math.PI + 0.9 + S.tut.t * 0.22, r = 9 + Math.min(S.tut.t, 3) * 0.6;
  camera.position.set(f.x + Math.sin(a) * r, f.y + 3.2, f.z - Math.cos(a) * r);
  camera.up.set(0, 1, 0); camera.lookAt(f); camera.fov = 55; camera.near = 0.1; camera.updateProjectionMatrix();
}
function renderTutMenu() {
  const el = $('tutList'); if (!el) return;
  el.innerHTML = LESSONS.map((L, i) => `<button data-les="${i}" class="${TUT_DONE[i] ? 'done' : ''}"><span>${i + 1}</span>${L.title}${TUT_DONE[i] ? ' ✓' : ''}</button>`).join('');
  el.querySelectorAll('[data-les]').forEach(b => b.onclick = () => { $('tutMenu').classList.add('hidden'); tutStart(+b.dataset.les); });
}

// =====================================================================
//  비행 기록 · 리플레이 · 내 최고 기록 고스트
// =====================================================================
let REC = null, LAST_REC = null;
const BEST = {};
function recStart() { REC = { s: [], ev: [], t0: 0, diff: SET.diff, kind: S.kind, acc: 0 }; }
function recTick(dt) {
  if (!REC) return; REC.acc += dt;
  if (REC.acc < 1 / 30 && REC.s.length) return; REC.acc = 0;
  const r = v => Math.round(v * 1000) / 1000;
  REC.s.push([r(S.flyT), r(DR.p.x), r(DR.p.y), r(DR.p.z), r(DR.h), r(DR.pitch), r(DR.roll), r(DR.thrust)]);
}
function recEvent(e) { if (REC && S.state === 'run') { e.t = S.flyT; REC.ev.push(e); } }
function recFinish() {
  if (!REC) return null; recTick(1);
  REC.total = S.t + S.pen; REC.course = S.t; LAST_REC = REC; const r = REC; REC = null; return r;
}
function loadBest() {
  for (const d of Object.keys(MODES)) { try { const s = localStorage.getItem('fpvsim_fpv_bestrec_' + d + SITE_KEY); if (s) BEST[d] = JSON.parse(s); } catch (e) { } }
}
function saveBest(r) {
  if (!r || r.kind !== 'course') return;
  const o = { s: r.s, ev: r.ev, t0: r.t0, total: r.total, diff: r.diff, kind: r.kind };
  BEST[r.diff] = o; try { localStorage.setItem('fpvsim_fpv_bestrec_' + r.diff + SITE_KEY, JSON.stringify(o)); } catch (e) { }
}
function recPose(rec, t, out) {
  const s = rec.s; if (!s.length) return out;
  let lo = 0, hi = s.length - 1;
  if (t <= s[0][0]) hi = 0; else if (t >= s[hi][0]) lo = hi;
  else { while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m][0] < t) lo = m; else hi = m; } }
  const a = s[lo], b = s[hi], f = hi === lo ? 0 : (t - a[0]) / Math.max(b[0] - a[0], 1e-6);
  out.p.set(lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f));
  out.h = a[4] + wrapA(b[4] - a[4]) * f; out.pitch = lerp(a[5], b[5], f); out.roll = lerp(a[6], b[6], f); out.thrust = lerp(a[7], b[7], f);
  const j = Math.min(hi + 1, s.length - 1), k = Math.max(lo - 1, 0), dtt = s[j][0] - s[k][0];
  if (dtt > 0) out.v.set((s[j][1] - s[k][1]) / dtt, (s[j][2] - s[k][2]) / dtt, (s[j][3] - s[k][3]) / dtt);
  return out;
}
function bestGhostPose(t) {
  if (SET.ghostSrc !== 'best' || !BEST[SET.diff]) return false;
  const r = BEST[SET.diff]; recPose(r, r.t0 + t, ghostS); return true;
}
// ---- 리플레이 플레이어
const RP = { rec: null, t: 0, speed: 1, playing: true, ev: 0, pose: { p: new V3(), v: new V3(), h: 0, pitch: 0, roll: 0, thrust: 0 }, back: 'menu' };
function replayStart(rec, back) {
  if (!rec || !rec.s || rec.s.length < 2) { showMsg('기록 없음', '#ff6060', 1); return; }
  RP.rec = rec; RP.t = rec.s[0][0]; RP.speed = 1; RP.playing = true; RP.ev = 0; RP.back = back || 'menu';
  PAY.forEach(p => scene.remove(p.m)); PAY.length = 0; droneM.cans.forEach(c => c.visible = true);
  S.state = 'replay'; S.kind = 'replay'; if (S.cam === 0) S.cam = 1;
  ui.menu.classList.add('hidden'); ui.result.classList.add('hidden'); ui.pause.classList.add('hidden'); ui.hud.classList.remove('hidden');
  ui.list.classList.add('hidden'); $('rp').classList.remove('hidden'); $('tut').classList.add('hidden'); ui.hud.classList.add('replaying');
  const end = rec.s[rec.s.length - 1][0]; $('rpSeek').max = end; $('rpSeek').min = rec.s[0][0];
  updateTags(); replayUI();
}
function replayEnd() { $('rp').classList.add('hidden'); ui.hud.classList.remove('replaying'); PAY.forEach(p => scene.remove(p.m)); PAY.length = 0; if (RP.back === 'result' && LAST_REC === RP.rec) { S.state = 'result'; S.kind = 'course'; ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden'); } else toMenu(); }
function replaySeek(t) {
  const s = RP.rec.s; RP.t = clamp(t, s[0][0], s[s.length - 1][0]);
  PAY.forEach(p => scene.remove(p.m)); PAY.length = 0;
  RP.ev = RP.rec.ev.findIndex(e => e.t >= RP.t); if (RP.ev < 0) RP.ev = RP.rec.ev.length;
  const dropsBefore = RP.rec.ev.filter(e => e.k === 'drop' && e.t < RP.t).length;
  droneM.cans.forEach((c, i) => c.visible = RP.rec.kind !== 'course' || i >= dropsBefore);
}
function replayTick(dt) {
  const s = RP.rec.s, end = s[s.length - 1][0];
  if (RP.playing) { RP.t += dt * RP.speed; if (RP.t >= end) { RP.t = end; RP.playing = false; } }
  recPose(RP.rec, RP.t, RP.pose);
  while (RP.ev < RP.rec.ev.length && RP.rec.ev[RP.ev].t <= RP.t) {
    const e = RP.rec.ev[RP.ev++];
    if (e.k === 'drop') dropPayload(new V3(e.p[0], e.p[1], e.p[2]), new V3(e.v[0], e.v[1], e.v[2]), 'replay');
    else if (e.k === 'msg' && e.text) showMsg(e.text, e.col, 1.2);
  }
  updatePayloads(dt * (RP.playing ? RP.speed : 0));
  replayUI(); vidTick();
}
function replayUI() {
  const s = RP.rec.s, end = s[s.length - 1][0];
  $('rpSeek').value = RP.t; $('rpTime').textContent = `${fmt(RP.t - s[0][0])} / ${fmt(end - s[0][0])}`;
  $('rpPlay').textContent = RP.playing ? '❚❚' : '▶'; $('rpSpd').textContent = '×' + RP.speed;
}
function replayKey(k) {
  if (k === 'Space' || k === 'X_Space' || k === 'Enter' || k === 'PadA') { if (RP.t >= RP.rec.s[RP.rec.s.length - 1][0]) replaySeek(RP.rec.s[0][0]); RP.playing = !RP.playing; }
  else if (k === 'ArrowLeft' || k === 'PadLB' || k === 'PadLeft') replaySeek(RP.t - 5);
  else if (k === 'ArrowRight' || k === 'PadRB' || k === 'PadRight') replaySeek(RP.t + 5);
  else if (k === 'Digit1') RP.speed = 0.5; else if (k === 'Digit2') RP.speed = 1; else if (k === 'Digit3') RP.speed = 2; else if (k === 'Digit4') RP.speed = 4;
  else if (k === 'PadUp') RP.speed = Math.min(4, RP.speed * 2); else if (k === 'PadDown') RP.speed = Math.max(0.25, RP.speed / 2);
  else if (k === 'KeyC' || k === 'KeyB2') { S.cam = (S.cam + 1) % 3; updateTags(); }
  else if (k === 'Escape') replayEnd();
  replayUI();
}
function toMenu() {
  S.state = 'menu'; S.kind = 'course'; S.tut = null; musicSetLevelPaused(false);
  ['pause', 'result'].forEach(k => ui[k].classList.add('hidden')); ui.hud.classList.add('hidden'); ui.menu.classList.remove('hidden');
  $('rp').classList.add('hidden'); $('tut').classList.add('hidden'); ui.hud.classList.remove('replaying');
  PAY.forEach(p => scene.remove(p.m)); PAY.length = 0;
  resetDrone(startPos(), startHead()); refreshBest(); if (typeof mapView === 'function') mapView('course');
  if (typeof wizGo === 'function') wizGo(3);   // 비행 끝나고 돌아오면 코스 고르기 화면
}

// =====================================================================
//  터치 조작 (휴대폰·태블릿): 가상 스틱 2개 + 버튼
// =====================================================================
if (IS_TOUCH) { document.body.classList.add('touch'); TOUCH.on = true; }
if (window.SIM_MOBILE) document.body.classList.add('mobile');
(function touchUI() {
  if (!IS_TOUCH) return;
  const R = 62;
  function stick(zoneId, kx, ky) {
    const zone = $(zoneId), base = zone.querySelector('.base'), knob = zone.querySelector('.knob');
    let id = null, ox = 0, oy = 0;
    const set = (x, y) => { TOUCH[kx] = x; TOUCH[ky] = y; };
    zone.addEventListener('pointerdown', e => {
      if (id !== null) return; id = e.pointerId; zone.setPointerCapture(id); initAudio(); musicStart();
      const r = zone.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top;
      base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
      e.preventDefault();
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      const r = zone.getBoundingClientRect(); let dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy;
      const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const sx = dx / R, sy = -dy / R, dz = 0.1;
      const f = v => Math.abs(v) < dz ? 0 : Math.sign(v) * Math.pow((Math.abs(v) - dz) / (1 - dz), 1.4);
      set(f(sx), f(sy)); e.preventDefault();
    });
    const end = e => { if (e.pointerId !== id) return; id = null; set(0, 0); base.classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  }
  stick('tzL', 'yaw', 'thr'); stick('tzR', 'roll', 'pitch');
  const tap = (id, key) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); musicStart(); pressed.push(key); b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 140); }); };
  tap('tbDrop', 'Space'); tap('tbPhoto', 'Enter'); tap('tbCam', 'KeyC'); tap('tbReset', 'KeyR'); tap('tbPause', 'Escape'); tap('tbAssist', 'KeyH'); tap('tbZoom', 'KeyZ'); tap('tbGuide', 'KeyV'); tap('tbBelly', 'KeyX'); tap('tbLight', 'KeyL'); tap('tbIR', 'KeyT');
  const bst = $('tbBoost'); bst.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); boostToggle(); });   // 한 번 누르면 켜짐, 다시 누르면 꺼짐
  $('tbFull').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleFull(); });
  $('tut').addEventListener('pointerdown', () => { if (S.tut && S.tut.st !== 'fly') pressed.push('Enter'); });
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  // 세로 화면 안내: 전체화면 전환 중 잠깐 세로로 잡히는 크기 변화는 무시 (0.6초 넘게 세로일 때만)
  let rotT = 0; const rot = () => { clearTimeout(rotT); const portrait = innerHeight > innerWidth * 1.05; if (!portrait) { $('rot').classList.add('hidden'); return; } rotT = setTimeout(() => $('rot').classList.toggle('hidden', !(innerHeight > innerWidth * 1.05)), 600); };
  addEventListener('resize', rot); addEventListener('orientationchange', () => setTimeout(rot, 200)); rot();
})();

// 시작할 때 자동 전체화면 (브라우저 규칙상 클릭·터치·키 입력이 있어야 전환됨)
function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
let fullAsk = 0;
function enterFull() { if (!SET.autoFull || isFull() || /[?&]test/.test(location.search) || performance.now() - fullAsk < 1500) return; fullAsk = performance.now(); toggleFull(); }
// 메뉴를 고르는 중에는 전체화면으로 바꾸지 않음 (화면 크기가 바뀌며 메뉴가 흔들림) — 비행을 시작할 때만 전환
function toggleFull() {
  const d = document.documentElement, fe = document.fullscreenElement || document.webkitFullscreenElement;
  try {
    if (fe) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const f = d.requestFullscreen || d.webkitRequestFullscreen; const p = f && f.call(d);
    if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => { });
  } catch (e) { }
}
$('bFull').onclick = toggleFull;

// =====================================================================
//  가이드: 다음 과제까지 따라갈 사각 틀(3D) + 조작 안내 문구 + 아래 카메라
// =====================================================================
const GUIDE = { n: 12, sp: 2.6, meshes: [], next: null, detour: false };
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
const _gt = new V3(), _gq = new V3();
function hideGuide() { GUIDE.meshes.forEach(x => x.g.visible = false); $('guide').classList.add('hidden'); }
function updateGuide(subj) {
  const active = S.state === 'run' && DR.alive && !(S.tut && S.tut.st !== 'fly');
  const o = active ? curObj() : null;
  GUIDE.next = null;
  if (!o || (typeof isC1 === 'function' && isC1())) { hideGuide(); return; }
  if (o.kind === 'bunker' && !S.scanned && insideBunker(subj.p)) {
    hideGuide(); if (!SET.guide) return;
    const el = $('guide'); el.classList.remove('hidden'); el.innerHTML = '<div class="ok">정찰 중 · 안에서 잠시 머무르기</div>'; return;
  }
  let pts = guidePoints(o, subj.p);
  if (!pts) { hideGuide(); return; }
  GUIDE.next = pts[1];
  if (!SET.guide) { hideGuide(); return; }
  // 비행 경로: 지금 날아가는 방향으로 먼저 이어졌다가 선회 반경만큼 휘어 목표로 (직선으로 꺾지 않음)
  { const v = subj.v || DR.v, sp = Math.hypot(v.x, v.z), wing = AFc().cls === 'wing', hd = sp > 1 ? new V3(v.x / sp, 0, v.z / sp) : new V3(Math.sin(DR.h), 0, -Math.cos(DR.h));
    const to = pts[1].clone().sub(pts[0]); to.y = 0; const dist = to.length(); if (dist > 0.5) to.divideScalar(dist);
    const turnR = wing ? Math.max(15, sp * sp / (9.8 * Math.tan((AFc().bank || 45) * DEG * 0.8))) : sp * 0.6;
    const ang = Math.acos(clamp(hd.dot(to), -1, 1));
    if ((wing || sp > 2) && ang > 15 * DEG && dist > turnR * 1.2) { const k = Math.min(turnR * (0.4 + ang / Math.PI), dist * 0.45); const a = pts[0].clone().addScaledVector(hd, k); a.y = pts[0].y + (pts[1].y - pts[0].y) * 0.15; pts = [pts[0], a].concat(pts.slice(1)); } }
  const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
  const vsp = Math.hypot(DR.v.x, DR.v.z), GSP = AFc().cls === 'wing' ? 6 : clamp(2.6 + vsp * 0.18, 2.6, 5);   // 빠를수록 표시 간격을 넓혀 더 멀리까지
  const L = curve.getLength(), phase = (S.simT * 3.2) % GSP;
  GUIDE.meshes.forEach((x, i) => {
    const d = 2.4 + phase + i * GSP;
    if (d > L - 0.2 || L < 1.2) { x.g.visible = false; return; }
    const u = d / L; curve.getPointAt(u, _gt); curve.getPointAt(Math.min(1, u + 0.02), _gq);
    x.g.visible = true; x.g.position.copy(_gt); x.g.lookAt(_gq);
    const s = 0.9 + Math.min(d, 20) * 0.02; x.g.scale.set(s, s, s);
    x.m.color.set(GUIDE.detour ? 0xffc828 : o.kind === 'orbit' ? 0x5dff9a : 0x4fe3ff);
    x.m.opacity = 0.75 * Math.min(1, (d - 1.2) / 1.5) * Math.min(1, (L - d) / 2);
  });
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
  const tgt = (o.kind === 'drop' || o.kind === 'land') ? tgt0 : tgtC;
  const d = tgt.clone().sub(subj.p), fwd = new V3(Math.sin(DR.h), 0, -Math.cos(DR.h)), rgt = new V3(Math.cos(DR.h), 0, Math.sin(DR.h));
  const df = d.dot(fwd), dr = d.dot(rgt), dy = d.y, hd = Math.hypot(df, dr), ang = Math.atan2(dr, df) / DEG;
  const lines = [];
  const steer = () => {
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

// =====================================================================
//  위성사진 (ortho.tif, EPSG:32652) 불러오기 -> 코스 좌표에 맞춰 바닥에 입힘
// =====================================================================
// 코스 좌표 -> 현재 현장의 투영 좌표 (SITE.crs)
const SITE_X = siteXform(SITE);
function course2utm(down, side) { return SITE_X.toEN(down, side); }
const ORTHO_N = 4096;
const IDB = {
  open() { return new Promise((res, rej) => { try { const r = indexedDB.open('fpvsim_fpv', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); },
  async put(k, v) { try { const db = await this.open(); await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch (e) { } },
  async get(k) { try { const db = await this.open(); return await new Promise((res) => { const tx = db.transaction('kv', 'readonly'); const r = tx.objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); } catch (e) { return null; } },
  async del(k) { try { const db = await this.open(); await new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = res; tx.onerror = res; }); } catch (e) { } }
};
function setOrthoStatus(t, col) { const el = $('orthoStatus'); if (el) { el.textContent = t; el.style.color = col || ''; } }
function applyGroundCanvas(cv) {
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = Math.min(16, MAXANI);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  if (groundMat.map && groundMat.map !== groundMacro) groundMat.map.dispose();
  groundMat.map = t; groundMat.needsUpdate = true; detailK.value = 0.45;
}
function resetGround() { if (groundMat.map !== groundMacro) groundMat.map.dispose(); groundMat.map = groundMacro; groundMat.needsUpdate = true; detailK.value = 1; }
async function loadOrthoFile(file, opt) {
  if (!window.GeoTIFF) throw new Error('GeoTIFF 해석기가 없습니다');
  setOrthoStatus('읽는 중… (' + (file.size / 1048576).toFixed(0) + ' MB)', '#ffc828');
  const tiff = await GeoTIFF.fromBlob(file);
  const img0 = await tiff.getImage(0);
  const bb = img0.getBoundingBox();                       // [xmin, ymin, xmax, ymax]
  // 위성사진 좌표계 (GeoTIFF 정보 -> 없으면 범위로 추정) 로 코스 좌표를 변환
  const gk = img0.getGeoKeys() || {}, code = gk.ProjectedCSTypeGeoKey || gk.GeographicTypeGeoKey;
  const ocrs = code && code !== 32767 ? 'EPSG:' + code : guessCrs(bb[0], bb[3]);
  const P = projector(SITE.crs, ocrs), c2i = (d, s) => P(course2utm(d, s));
  const mk = ocrs === 'EPSG:4326' ? 111320 * Math.cos(projector(SITE.crs, 'EPSG:4326')(course2utm(170, -15))[1] * DEG) : 1;   // 도 -> m
  // 개요(overview) 중 0.3 m 에 가장 가까운 것 선택
  const nImg = await tiff.getImageCount(); let img = img0;
  const res0 = (bb[2] - bb[0]) / img0.getWidth() * mk;
  for (let i = 1; i < nImg; i++) { const im = await tiff.getImage(i); const r = (bb[2] - bb[0]) / im.getWidth() * mk; if (r <= 0.32) img = im; }
  const iw = img.getWidth(), ih = img.getHeight(), rx = (bb[2] - bb[0]) / iw, ry = (bb[3] - bb[1]) / ih;
  // 바닥 판 네 모서리의 UTM 범위
  const cs = [[GD0, GS0], [GD0, GS1], [GD1, GS0], [GD1, GS1]].map(([d, s]) => c2i(d, s));
  const ex0 = Math.max(bb[0], Math.min(...cs.map(c => c[0]))), ex1 = Math.min(bb[2], Math.max(...cs.map(c => c[0])));
  const ey0 = Math.max(bb[1], Math.min(...cs.map(c => c[1]))), ey1 = Math.min(bb[3], Math.max(...cs.map(c => c[1])));
  if (ex0 >= ex1 || ey0 >= ey1) throw new Error('위성사진 범위가 코스와 겹치지 않습니다.');
  const wx0 = Math.floor((ex0 - bb[0]) / rx), wx1 = Math.ceil((ex1 - bb[0]) / rx), wy0 = Math.floor((bb[3] - ey1) / ry), wy1 = Math.ceil((bb[3] - ey0) / ry);
  const step = Math.max(1, Math.floor((GSZ / ORTHO_N) / (rx * mk)));
  const sw = Math.ceil((wx1 - wx0) / step), sh = Math.ceil((wy1 - wy0) / step);
  const src = new Uint8Array(sw * sh * 3);
  const spp = img.getSamplesPerPixel(); const bands = spp >= 3 ? [0, 1, 2] : [0];
  const bps = (img.getBitsPerSample && img.getBitsPerSample()) || 8, div = bps > 8 ? 257 : 1;
  const rowsPer = Math.max(step, Math.floor(6e6 / ((wx1 - wx0) * bands.length) / step) * step);
  for (let y = wy0; y < wy1; y += rowsPer) {
    const y2 = Math.min(y + rowsPer, wy1);
    const r = await img.readRasters({ window: [wx0, y, wx1, y2], samples: bands, interleave: true });
    const rw = wx1 - wx0, nb = bands.length;
    for (let yy = y; yy < y2; yy++) {
      if ((yy - wy0) % step) continue;
      const sy = (yy - wy0) / step, ro = (yy - y) * rw;
      for (let sx = 0; sx < sw; sx++) {
        const si = (ro + sx * step) * nb, di = (sy * sw + sx) * 3;
        if (nb === 3) { src[di] = r[si] / div; src[di + 1] = r[si + 1] / div; src[di + 2] = r[si + 2] / div; }
        else { src[di] = src[di + 1] = src[di + 2] = r[si] / div; }
      }
    }
    setOrthoStatus(`읽는 중… ${Math.round((y2 - wy0) / (wy1 - wy0) * 100)}%`, '#ffc828');
    await new Promise(r => setTimeout(r, 0));
  }
  // 코스 좌표 바닥 텍스처 생성 (밖은 기본 바닥)
  const cv = document.createElement('canvas'); cv.width = cv.height = ORTHO_N; const g = cv.getContext('2d');
  g.drawImage(groundMacro.image, 0, 0, ORTHO_N, ORTHO_N);
  const id = g.getImageData(0, 0, ORTHO_N, ORTHO_N), dd = id.data;
  const ox = bb[0] + wx0 * rx, oy = bb[3] - wy0 * ry, kx = 1 / (rx * step), ky = 1 / (ry * step);
  const m = GSZ / ORTHO_N;
  const [e00, n00] = c2i(GD1 - 0.5 * m, GS0 + 0.5 * m), [e10, n10] = c2i(GD1 - 0.5 * m, GS0 + 1.5 * m), [e01, n01] = c2i(GD1 - 1.5 * m, GS0 + 0.5 * m);
  const dEi = e10 - e00, dNi = n10 - n00, dEj = e01 - e00, dNj = n01 - n00;
  let cover = 0; const FEATH = Math.max(2, 15 / (rx * step * mk)), ORTHO_GAIN = 1.3;   // 겨울 숲 사진이 어두워 조금 밝힘
  for (let j = 0; j < ORTHO_N; j++) {
    let E = e00 + dEj * j, N = n00 + dNj * j;
    for (let i = 0; i < ORTHO_N; i++, E += dEi, N += dNi) {
      const sx = (E - ox) * kx, sy = (oy - N) * ky;
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) continue;
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, a = (y0 * sw + x0) * 3, b = a + sw * 3, o = (j * ORTHO_N + i) * 4;
      const wgt = Math.min(1, Math.min(sx, sy, sw - 1 - sx, sh - 1 - sy) / FEATH);   // 가장자리 15 m 는 기본 바닥과 부드럽게 섞음
      for (let c = 0; c < 3; c++) { const v = Math.min(255, ((src[a + c] * (1 - fx) + src[a + 3 + c] * fx) * (1 - fy) + (src[b + c] * (1 - fx) + src[b + 3 + c] * fx) * fy) * ORTHO_GAIN); dd[o + c] = dd[o + c] * (1 - wgt) + v * wgt; }
      cover++;
    }
  }
  g.putImageData(id, 0, 0);
  applyGroundCanvas(cv);
  const pct = Math.round(cover / (ORTHO_N * ORTHO_N) * 100);
  setOrthoStatus(`위성사진 적용됨 (${(rx * step * mk).toFixed(2)} m/px, 바닥의 ${pct}%)`, '#5dff9a');
  if (!(opt && opt.nosave)) cv.toBlob(bl => { if (bl) IDB.put('ortho' + SITE_KEY0, bl); }, 'image/jpeg', 0.9);
  return { res: rx * step * mk, cover: pct, srcRes: res0 };
}
// 현장 기본 정사영상 (sites/*.tif, 현장 데이터의 ortho 항목) — 사용자가 올린 사진이 없을 때 자동으로 입힘
async function autoOrtho() {
  if (!SITE.ortho) return false;
  try {
    setOrthoStatus('현장 정사영상 불러오는 중…', '#ffc828');
    let bl;
    if (SITE.ortho.startsWith('data:')) {   // 파일 안에 넣은 사진: fetch 없이 직접 풀기 (fetch 가 막힌 곳 대비)
      const b64 = SITE.ortho.slice(SITE.ortho.indexOf(',') + 1), bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      bl = new Blob([u], { type: 'image/tiff' });
    } else { const r = await fetch((/^(https?:|\/)/.test(SITE.ortho) ? '' : (window.SIM_BASE || '')) + SITE.ortho); if (!r.ok) throw new Error('HTTP ' + r.status); bl = await r.blob(); } await loadOrthoFile(bl, { nosave: true });
    setOrthoStatus(setOrthoStatusTxt() + ' · ' + ((window.SIM_LANG === 'en' && SITE.orthoSrc_en) || SITE.orthoSrc || ''), '#5dff9a'); return true;
  } catch (e) { setOrthoStatus('정사영상 없음 (기본 바닥)', ''); return false; }
}
function setOrthoStatusTxt() { const el = $('orthoStatus'); return el ? el.textContent : ''; }
async function restoreOrtho() {
  const bl = await IDB.get('ortho' + SITE_KEY0); if (!bl) { autoOrtho(); return; }
  try {
    const im = await createImageBitmap(bl); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; cv.getContext('2d').drawImage(im, 0, 0);
    applyGroundCanvas(cv); setOrthoStatus('저장된 위성사진 사용 중', '#5dff9a');
  } catch (e) { }
}

// =====================================================================
//  지형 현장 선택 · DEM 불러오기 화면
// =====================================================================
function fmtM3(v) { return Math.round(v).toLocaleString('en-US') + ' m³'; }
const stName = st => (window.SIM_LANG === 'en' && st.name_en) || st.name, stSrc = st => (window.SIM_LANG === 'en' && st.src_en) || st.src;
function siteUI() {
  const seg = $('segSite'); seg.innerHTML = '';
  for (const st of sitesAll()) {
    const b = document.createElement('button'); b.textContent = stName(st); b.title = stName(st); b.dataset.v = st.id; b.classList.toggle('on', st.id === SITE.id);
    b.onclick = () => { if (st.id === SITE.id) return; siteSelect(st.id); location.reload(); };
    seg.appendChild(b);
  }
  const info = $('siteInfo');
  if (SITE.flat) info.innerHTML = '평지 — 지형 높낮이 없음. DEM 을 불러오면 실제 지형 위에 같은 코스를 깝니다.';
  else info.innerHTML = `<b>${stName(SITE)}</b> · DEM ${stSrc(SITE)} (${CRS_LABEL[SITE.demCrs] || SITE.demCrs}, ${SITE.demRes} m)<br>` +
    `코스 중심 ${SITE.lat.toFixed(5)}°N ${SITE.lon.toFixed(5)}°E · 방위 ${SITE.brg}° · 기준(출발 패드) 해발 ${SITE.base.toFixed(1)} m<br>` +
    `코스 구역 해발 ${SITE.inMin}~${SITE.inMax} m · 원경 ${SITE.farMin}~${SITE.farMax} m · 덮인 비율 ${SITE.cover}%<br>` +
    `시설물 터 정지 토공량 — 절토 ${fmtM3(EARTH.cut)} · 성토 ${fmtM3(EARTH.fill)}` + (SITE.vec ? `<br>지형지물 — 건물 ${SITE.vec.bld.length}동 · 도로 ${SITE.vec.road.length} · 소로 ${SITE.vec.trail.length} · 하천 ${SITE.vec.stream.length} · 경지 ${SITE.vec.field.length}` : '');
}
const DEMUI = { R: null, pv: null };
function demSite(lat, lon, brg) {
  const zone = Math.floor((lon + 180) / 6) + 1, crs = 'EPSG:' + (lat >= 0 ? 326 : 327) + String(zone).padStart(2, '0');
  const [e0, n0] = projector('EPSG:4326', crs)([lon, lat]); return { crs, e0, n0, brg, dc: 170, sc: -15 };
}
function demDraw() {
  const R = DEMUI.R, pv = DEMUI.pv; if (!R || !pv) return;
  const cv = $('demCv'), g = cv.getContext('2d'); cv.width = pv.W; cv.height = pv.H; g.drawImage(pv.cv, 0, 0);
  const lat = +$('demLat').value, lon = +$('demLon').value, brg = +$('demBrg').value;
  if (isNaN(lat) || isNaN(lon)) return;
  const st = demSite(lat, lon, brg), X = siteXform(st), toLL = projector(st.crs, 'EPSG:4326');
  const px = (d, sd) => { const ll = toLL(X.toEN(d, sd)); return pv.ll2px(ll[0], ll[1]); };
  const poly = (pts, col, w, fill) => { g.beginPath(); pts.forEach((p, i) => { const q = px(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
  poly([[GD0, GS0], [GD1, GS0], [GD1, GS1], [GD0, GS1]], '#ffc828', 1.5, 'rgba(255,200,40,.08)');
  poly([[-70, -70], [365, -70], [365, 20], [-70, 20]], '#ff9a40', 2, 'rgba(255,154,64,.25)');
  const a = px(0, -15), b = px(330, -15); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - 9 * Math.cos(ang - 0.5), b[1] - 9 * Math.sin(ang - 0.5)); g.lineTo(b[0] - 9 * Math.cos(ang + 0.5), b[1] - 9 * Math.sin(ang + 0.5)); g.closePath(); g.fillStyle = '#fff'; g.fill();
  // 원경 범위가 DEM 밖이면 알림
  const smp = demSampler(R), toR = projector(st.crs, R.crs); let inC = 0, tot = 0;
  for (let d = GD0; d <= GD1; d += 60) for (let sd = GS0; sd <= GS1; sd += 60) { tot++; const q = toR(X.toEN(d, sd)); if (!isNaN(smp(q[0], q[1]))) inC++; }
  $('demMsg').textContent = `고해상도 구역 중 DEM 이 덮는 비율 ${Math.round(inC / tot * 100)}%` + (inC / tot < 0.98 ? ' — 빈 곳은 주변 값으로 메웁니다' : '');
}
async function demOpen(file) {
  $('demPanel').classList.remove('hidden'); $('demMeta').textContent = '읽는 중… ' + file.name; $('demMsg').textContent = '';
  try {
    const R = await readDem(file, null); DEMUI.R = R; DEMUI.file = file; demMeta();
    DEMUI.pv = demPreview(R, 560);
    $('demLat').value = R.ll[1].toFixed(5); $('demLon').value = R.ll[0].toFixed(5); $('demName').value = file.name.replace(/\.[^.]+$/, '');
    demDraw();
  } catch (err) { $('demMeta').textContent = '실패: ' + (err && err.message ? err.message : err); }
}
function demMeta() {
  const R = DEMUI.R, sel = $('demCrs'); sel.innerHTML = '';
  for (const c of Object.keys(CRS_LABEL)) { const o = document.createElement('option'); o.value = c; o.textContent = CRS_LABEL[c]; sel.appendChild(o); }
  if (!CRS_LABEL[R.crs]) { const o = document.createElement('option'); o.value = R.crs; o.textContent = R.crs; sel.appendChild(o); }
  sel.value = R.crs;
  $('demMeta').innerHTML = `<b>${R.name}</b><br>${R.w} × ${R.h} 격자 · 해상도 ${R.res.toFixed(1)} m<br>좌표계 ${CRS_LABEL[R.crs] || R.crs} <span style="color:var(--mute)">(${R.crsSrc})</span><br>해발 ${R.min.toFixed(0)} ~ ${R.max.toFixed(0)} m`;
}
$('demCrs').onchange = async () => { if (!DEMUI.file) return; try { DEMUI.R = await readDem(DEMUI.file, $('demCrs').value); demMeta(); DEMUI.pv = demPreview(DEMUI.R, 560); $('demLat').value = DEMUI.R.ll[1].toFixed(5); $('demLon').value = DEMUI.R.ll[0].toFixed(5); demDraw(); } catch (err) { $('demMsg').textContent = '실패: ' + err.message; } };
$('demCv').addEventListener('click', e => {
  if (!DEMUI.pv) return; const r = $('demCv').getBoundingClientRect(), k = DEMUI.pv.W / r.width;
  const ll = DEMUI.pv.px2ll((e.clientX - r.left) * k, (e.clientY - r.top) * k); $('demLat').value = ll[1].toFixed(5); $('demLon').value = ll[0].toFixed(5); demDraw();
});
$('demBrg').oninput = () => { $('demBrgV').textContent = $('demBrg').value + '°'; demDraw(); };
$('demLat').oninput = $('demLon').oninput = demDraw;
$('demClose').onclick = () => $('demPanel').classList.add('hidden');
$('demApply').onclick = async () => {
  if (!DEMUI.R) return; $('demMsg').textContent = '지형 만드는 중…'; await new Promise(r => setTimeout(r, 30));
  try {
    const pkg = buildTerrainPkg(DEMUI.R, { lat: +$('demLat').value, lon: +$('demLon').value, brg: +$('demBrg').value, name: ($('demName').value || 'DEM') + ' (내 DEM)', id: 'custom' });
    localStorage.setItem('fpvsim_site_custom', JSON.stringify(pkg)); siteSelect('custom');
    $('demMsg').textContent = '완료 — 다시 불러옵니다'; setTimeout(() => location.reload(), 300);
  } catch (err) { $('demMsg').textContent = '실패: ' + (err && err.message ? err.message : err); }
};

// =====================================================================
//  조종기 설정 (RC 송신기 / 게임패드)
// =====================================================================
const FN = { thr: '스로틀 (상승·하강)', yaw: '요 (좌우 회전)', pitch: '피치 (전진·후진)', roll: '롤 (좌우 이동)' };
const BFN = { drop: '투하', cam: '카메라 전환', reset: '다시' };
let detect = null, calRun = null;
function rcOpen() { RCUI.open = true; $('rcPanel').classList.remove('hidden'); rcBuild(); }
function rcClose() { RCUI.open = false; detect = null; calRun = null; $('rcPanel').classList.add('hidden'); saveRC(); }
function axName(a) { return `축 ${a.i}${a.inv ? ' (반전)' : ''}`; }
function bName(b) { return !b ? '없음' : b.type === 'btn' ? `버튼 ${b.i}` : `축 ${b.i} ${b.sign > 0 ? '+' : '−'}`; }
function rcBuild() {
  let h = '';
  for (const k in FN) h += `<tr><td>${FN[k]}</td><td class="mono" id="rcA_${k}">${axName(RC.axes[k])}</td><td><div class="bar"><i id="rcV_${k}"></i></div></td><td><button data-det="${k}">감지</button> <button data-inv="${k}">반전</button></td></tr>`;
  for (const k in BFN) h += `<tr><td>${BFN[k]}</td><td class="mono" id="rcB_${k}">${bName(RC.btn[k])}</td><td></td><td><button data-detb="${k}">감지</button></td></tr>`;
  $('rcTable').innerHTML = h;
  $('rcTable').querySelectorAll('[data-det]').forEach(b => b.onclick = () => { detect = { kind: 'axis', fn: b.dataset.det, base: null }; $('rcHint').textContent = `${FN[b.dataset.det]}: 해당 스틱을 위(또는 오른쪽) 끝까지 밀었다가 놓으세요.`; });
  $('rcTable').querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { RC.axes[b.dataset.inv].inv = !RC.axes[b.dataset.inv].inv; rcBuild(); });
  $('rcTable').querySelectorAll('[data-detb]').forEach(b => b.onclick = () => { detect = { kind: 'btn', fn: b.dataset.detb, base: null }; $('rcHint').textContent = `${BFN[b.dataset.detb]}: 쓸 버튼이나 스위치를 누르세요(켜세요).`; });
  document.querySelectorAll('#rcThr button').forEach(b => b.classList.toggle('on', b.dataset.v === RC.thrType));
}
function rcPanelUpdate() {
  const gp = getPad();
  $('rcDev').textContent = gp ? `연결됨: ${gp.id} (축 ${gp.axes.length}개, 버튼 ${gp.buttons.length}개)` : '조종기가 감지되지 않았습니다. USB로 연결한 뒤 스틱이나 버튼을 한 번 움직이세요.';
  if (!gp) return;
  let raw = '';
  gp.axes.forEach((v, i) => { raw += `<span class="mono">${i}:${v >= 0 ? '+' : ''}${v.toFixed(2)}</span> `; });
  $('rcRaw').innerHTML = raw;
  for (const k in FN) {
    const a = RC.axes[k]; let v = calAxis(gp, a.i); if (a.inv) v = -v;
    const el = $('rcV_' + k); if (el) { el.style.left = (v < 0 ? 50 + v * 50 : 50) + '%'; el.style.width = Math.abs(v * 50) + '%'; }
  }
  if (calRun) {
    gp.axes.forEach((v, i) => { const c = calRun[i] || (calRun[i] = { min: v, max: v }); c.min = Math.min(c.min, v); c.max = Math.max(c.max, v); });
  }
  if (detect) {
    if (!detect.base) { detect.base = { axes: gp.axes.slice(), btn: gp.buttons.map(b => b.pressed) }; return; }
    if (detect.kind === 'axis') {
      let best = -1, bd = 0.6;
      gp.axes.forEach((v, i) => { const d = Math.abs(v - detect.base.axes[i]); if (d > bd) { bd = d; best = i; } });
      if (best >= 0) {
        const pos = gp.axes[best] - detect.base.axes[best] > 0;
        RC.axes[detect.fn] = { i: best, inv: !pos };
        $('rcHint').textContent = `${FN[detect.fn]} → 축 ${best}${!pos ? ' (반전)' : ''} 지정됨`; detect = null; rcBuild();
      }
    } else {
      const bi = gp.buttons.findIndex((b, i) => b.pressed && !detect.base.btn[i]);
      if (bi >= 0) { RC.btn[detect.fn] = { type: 'btn', i: bi }; $('rcHint').textContent = `${BFN[detect.fn]} → 버튼 ${bi}`; detect = null; rcBuild(); return; }
      const used = Object.values(RC.axes).map(a => a.i);
      gp.axes.forEach((v, i) => {
        if (!detect || used.includes(i)) return;
        const d = v - detect.base.axes[i];
        if (Math.abs(d) > 0.9) { RC.btn[detect.fn] = { type: 'axis', i, sign: d > 0 ? 1 : -1 }; $('rcHint').textContent = `${BFN[detect.fn]} → 축 ${i} 스위치`; detect = null; rcBuild(); }
      });
    }
  }
}
function rcWire() {
  $('bRC').onclick = rcOpen; $('rcClose').onclick = rcClose;
  $('rcCenter').onclick = () => { const gp = getPad(); if (!gp) return; gp.axes.forEach((v, i) => { const c = RC.cal[i] || { min: -1, max: 1 }; c.c = v; RC.cal[i] = c; }); $('rcHint').textContent = '현재 스틱 위치를 가운데로 저장했습니다 (스로틀이 아래 고정형이면 스로틀을 가운데에 두고 누르세요).'; };
  $('rcRange').onclick = () => {
    const gp = getPad(); if (!gp) return;
    if (!calRun) { calRun = {}; $('rcRange').textContent = '범위 보정 끝'; $('rcHint').textContent = '모든 스틱을 끝까지 크게 원을 그리며 돌린 뒤 [범위 보정 끝]을 누르세요.'; }
    else { for (const i in calRun) { const c = RC.cal[i] || {}; c.min = calRun[i].min; c.max = calRun[i].max; if (c.c === undefined) c.c = (c.min + c.max) / 2; RC.cal[i] = c; } calRun = null; $('rcRange').textContent = '범위 보정 시작'; $('rcHint').textContent = '범위를 저장했습니다.'; }
  };
  $('rcReset').onclick = () => { RC = JSON.parse(JSON.stringify(RC_DEFAULT)); rcBuild(); $('rcHint').textContent = '기본값(게임패드 모드 2)으로 되돌렸습니다.'; };
  document.querySelectorAll('#rcThr button').forEach(b => b.onclick = () => { RC.thrType = b.dataset.v; rcBuild(); });
}

// =====================================================================
//  menu / UI wiring
// =====================================================================
document.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => startRun(b.dataset.start)));
function syncSeg() {
  document.querySelectorAll('#segDiff button').forEach(b => b.classList.toggle('on', b.dataset.v === SET.diff));
  document.querySelectorAll('#segGhost button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === SET.ghost));
  document.querySelectorAll('#segAssist button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === SET.assist));
  document.querySelectorAll('#segKeys button').forEach(b => b.classList.toggle('on', b.dataset.v === kbWhich())); kbHelp();
  document.querySelectorAll('#segGhostSrc button').forEach(b => b.classList.toggle('on', b.dataset.v === SET.ghostSrc));
  document.querySelectorAll('#segBelly button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === SET.belly));
  document.querySelectorAll('#segFull button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === SET.autoFull));
  document.querySelectorAll('#segGuide button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === SET.guide));
  document.querySelectorAll('#segMusic button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === MUS.on));
  $('tilt').value = SET.tilt; $('tiltV').textContent = SET.tilt + '°'; $('mvol').value = Math.round(MUS.vol * 100);
}
document.querySelectorAll('#segDiff button').forEach(b => b.addEventListener('click', () => { SET.diff = b.dataset.v; saveSet(); syncSeg(); refreshBest(); }));
document.querySelectorAll('#segGhost button').forEach(b => b.addEventListener('click', () => { SET.ghost = b.dataset.v === '1'; saveSet(); syncSeg(); }));
document.querySelectorAll('#segAssist button').forEach(b => b.addEventListener('click', () => { SET.assist = b.dataset.v === '1'; saveSet(); syncSeg(); }));
document.querySelectorAll('#segBelly button').forEach(b => b.addEventListener('click', () => { SET.belly = b.dataset.v === '1'; saveSet(); syncSeg(); }));
document.querySelectorAll('#segFull button').forEach(b => b.addEventListener('click', () => { SET.autoFull = b.dataset.v === '1'; saveSet(); syncSeg(); }));
const PANELS = ['setPanel', 'recPanel', 'helpPanel', 'optPanel', 'ctlPanel'];
function openPanel(id) { PANELS.forEach(p => $(p).classList.toggle('hidden', p !== id)); if (id === 'recPanel') renderRecords(); if (id === 'helpPanel') kbHelp(); }
function closePanels() { let any = false; PANELS.concat(['tutMenu', 'kbPanel']).forEach(p => { if (!$(p).classList.contains('hidden')) any = true; $(p).classList.add('hidden'); }); KBCAP = null; return any; }
$('bSet').onclick = () => openPanel('setPanel'); $('bRec').onclick = () => openPanel('recPanel'); $('bHelp').onclick = () => openPanel('helpPanel');
$('setClose').onclick = $('recClose').onclick = $('helpClose').onclick = () => closePanels();
$('bKB3').onclick = () => { closePanels(); kbOpen(); };
function renderRecords() {
  const rows = Object.keys(MODES).map(d => {
    let b = null; try { b = parseFloat(localStorage.getItem('fpvsim_fpv_best_' + d + SITE_KEY)); } catch (e) { }
    return `<tr><td>${MODES[d].name}</td><td class="mono">${b ? fmt(b) : '—'}</td><td>${BEST[d] ? `<button data-rp="${d}">리플레이</button>` : ''}</td></tr>`;
  }).join('');
  $('recTable').innerHTML = `<tr><td style="color:var(--mute)">난이도</td><td style="color:var(--mute)">최고 기록 (벌점 포함)</td><td></td></tr>` + rows + `<tr><td>기준 비행</td><td class="mono">${fmt(GH.total)}</td><td style="color:var(--mute);font-size:12px">영상 경로</td></tr>`;
  $('recTable').querySelectorAll('[data-rp]').forEach(b => b.onclick = () => { closePanels(); replayStart(BEST[b.dataset.rp], 'menu'); });
  $('bLastRp').disabled = !LAST_REC;
}
document.querySelectorAll('#segMusic button').forEach(b => b.addEventListener('click', () => { MUS.on = b.dataset.v === '1'; initAudio(); musicStart(); musicSetLevel(); saveMusic(); syncSeg(); }));
$('mvol').addEventListener('input', e => { MUS.vol = +e.target.value / 100; initAudio(); musicStart(); musicSetLevel(); saveMusic(); });
$('tilt').addEventListener('input', e => { SET.tilt = +e.target.value; $('tiltV').textContent = SET.tilt + '°'; saveSet(); });
$('bResume').onclick = togglePause;
$('bRestart').onclick = () => { musicSetLevelPaused(false); if (S.kind === 'tutorial' && S.tut) tutStart(S.tut.i); else startRun(S.lastKind || S.kind); };
$('bMenu').onclick = $('bMenu2').onclick = () => { if (REC) LAST_REC = recFinish(); toMenu(); };
$('bPauseRp').onclick = () => { if (REC) { LAST_REC = recFinish(); } ui.pause.classList.add('hidden'); musicSetLevelPaused(false); replayStart(LAST_REC, 'menu'); };
$('bReplay').onclick = () => replayStart(LAST_REC, 'result');
$('bBestRp').onclick = () => replayStart(BEST[SET.diff], 'menu');
$('bLastRp').onclick = () => { closePanels(); replayStart(LAST_REC, 'menu'); };
$('tutClose').onclick = () => $('tutMenu').classList.add('hidden');
$('rpPlay').onclick = () => replayKey('Space'); $('rpBack').onclick = () => replayKey('ArrowLeft'); $('rpFwd').onclick = () => replayKey('ArrowRight');
$('rpSpd').onclick = () => { RP.speed = RP.speed >= 4 ? 0.5 : RP.speed * 2; replayUI(); };
$('rpCam').onclick = () => replayKey('KeyC'); $('rpClose').onclick = () => replayEnd();
$('rpSeek').addEventListener('input', e => { replaySeek(+e.target.value); replayUI(); });
function openTutMenu() { renderTutMenu(); $('tutMenu').classList.remove('hidden'); }
document.querySelectorAll('#segKeys button').forEach(b => b.addEventListener('click', () => { if (b.dataset.v === 'C') kbOpen(); else { KB = Object.assign({}, KB_PRESET[b.dataset.v]); saveKB(); syncSeg(); } }));
// ---- 키 설정 화면 ----
const KB_LABEL = { up: '상승', down: '하강', yawL: '왼쪽 회전', yawR: '오른쪽 회전', fwd: '전진', back: '후진', left: '왼쪽 이동', right: '오른쪽 이동', drop: '탑재물 투하', boost: '부스트 (누르고 있기)', cam: '카메라 전환', zoom: '카메라 거리', reset: '마지막 통과 지점에서 다시', assist: '비행 보조 켜기/끄기' };
function kbOpen() { $('kbPanel').classList.remove('hidden'); KBCAP = null; $('kbHint').textContent = ''; kbRender(); }
function kbRender() {
  $('kbTable').innerHTML = Object.keys(KB_LABEL).map(k => `<tr><td>${KB_LABEL[k]}</td><td><button data-kb="${k}" class="${KBCAP === k ? 'cap' : ''}">${KBCAP === k ? '…' : keyName(KB[k])}</button></td></tr>`).join('');
  $('kbTable').querySelectorAll('[data-kb]').forEach(b => b.onclick = () => { KBCAP = b.dataset.kb; $('kbHint').textContent = KB_LABEL[KBCAP] + ': 쓸 키를 누르세요'; kbRender(); });
}
function kbCapture(code) {
  const act = KBCAP; KBCAP = null;
  if (code === 'Escape') { $('kbHint').textContent = ''; kbRender(); return; }
  if (KB_RESERVED.includes(code)) { $('kbHint').textContent = keyName(code) + ' 키는 다른 기능에 쓰여 지정할 수 없습니다'; kbRender(); return; }
  const other = Object.keys(KB).find(k => k !== act && KB[k] === code);
  if (other) KB[other] = KB[act];
  KB[act] = code; saveKB();
  $('kbHint').textContent = KB_LABEL[act] + ' → ' + keyName(code) + (other ? ' (' + KB_LABEL[other] + ' → ' + keyName(KB[other]) + ')' : '');
  kbRender(); syncSeg();
}
function kbHelp() {
  renderKbd($('kbdMenu')); renderKbd($('kbdHelp'));
  const n = keyName;
  const pair = (a, b, l) => `<tr><td>${n(KB[a])} / ${n(KB[b])}</td><td>${l}</td></tr>`, one = (a, l) => `<tr><td>${n(KB[a])}</td><td>${l}</td></tr>`;
  $('kbRows').innerHTML = pair('up', 'down', '상승 / 하강') + pair('yawL', 'yawR', '왼쪽 / 오른쪽 회전') + pair('fwd', 'back', '전진 / 후진') + pair('left', 'right', '왼쪽 / 오른쪽 이동') +
    one('drop', '탑재물 투하') + one('boost', '부스트 켜기/끄기 (어디서나, 기체 최고 속도)') + pair('cam', 'zoom', '카메라 전환 · 카메라 거리') + one('reset', '마지막 통과 지점에서 다시') + one('assist', '비행 보조 켜기/끄기');
  $('keys').innerHTML = `${n(KB.up)}/${n(KB.down)} ${'상승·하강'} &nbsp;${n(KB.yawL)}/${n(KB.yawR)} ${'회전'} &nbsp;${n(KB.fwd)}${n(KB.left)}${n(KB.back)}${n(KB.right)} ${'이동'}<br>${n(KB.drop)} ${'투하'} &nbsp;${n(KB.boost)} ${'부스트'} &nbsp;${n(KB.cam)} ${'카메라'} &nbsp;${n(KB.assist)} ${'보조'} &nbsp;B ${'음악'} &nbsp;Esc ${'일시정지'}`;
}
$('kbA').onclick = () => { KB = Object.assign({}, KB_PRESET.A); saveKB(); kbRender(); syncSeg(); $('kbHint').textContent = 'A · 기본 배치'; };
$('kbB').onclick = () => { KB = Object.assign({}, KB_PRESET.B); saveKB(); kbRender(); syncSeg(); $('kbHint').textContent = 'B · 방향키로 고도'; };
$('kbClose').onclick = () => { KBCAP = null; $('kbPanel').classList.add('hidden'); syncSeg(); };
// ---- 키보드 그림 ----
const KB_SHORT = { up: '상승', down: '하강', yawL: '좌회전', yawR: '우회전', fwd: '전진', back: '후진', left: '좌이동', right: '우이동', drop: '투하', boost: '부스트', cam: '카메라', zoom: '거리', reset: '다시', assist: '보조' };
const KB_GROUP = { up: 'alt', down: 'alt', yawL: 'alt', yawR: 'alt', fwd: 'mov', back: 'mov', left: 'mov', right: 'mov', boost: 'bst' };
const KB_FIXED = { KeyF: '전체화면', KeyV: '가이드', KeyX: '아래캠', KeyB: '음악', KeyN: '건너뛰기', KeyT: '열화상', KeyM: '소리', KeyL: '조명', KeyP: '경로선', Escape: '정지' };
KB_FIXED.KeyJ = L2x('지도 크게', 'Big map'); if (!KB_RESERVED.includes('KeyJ')) KB_RESERVED.push('KeyJ');
function renderKbd(el) {
  if (!el) return;
  const act = {}; Object.keys(KB).forEach(k => { if (KB[k]) act[KB[k]] = k; });
  const key = (c, cls) => { if (!c) return '<div class="key blank"></div>'; const a = act[c]; const lab = a ? KB_SHORT[a] : (KB_FIXED[c] || '');
    const g = a ? (KB_GROUP[a] || 'act') : ''; return `<div class="key ${g} ${cls || ''}">${keyName(c)}${lab ? `<small>${lab}</small>` : ''}</div>`; };
  const row = (cs, pre) => `<div class="row">${pre || ''}${cs.map(c => key(c)).join('')}</div>`;
  const left = row(['Escape'], '') + row(['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT']) + row(['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH']) +
    `<div class="row">${key('ShiftLeft', 'wide')}${['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB'].map(c => key(c)).join('')}</div>` + `<div class="row">${key('Space', 'space')}</div>`;
  const drawn = new Set(['Escape', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const extra = Object.keys(act).filter(c => !drawn.has(c));
  const arrows = row([null, 'ArrowUp', null]) + row(['ArrowLeft', 'ArrowDown', 'ArrowRight']);
  el.innerHTML = `<div class="grp">${left}</div><div class="grp">${extra.length ? row(extra) : ''}${arrows}</div>` +
    `<div class="legend"><div><i style="background:#ffc828"></i>고도·회전 (조종기 왼쪽 스틱)</div><div><i style="background:#4fe3ff"></i>이동 (조종기 오른쪽 스틱)</div><div><i style="background:#5dff9a"></i>기능</div><div><i style="background:#ff9a40"></i>부스트</div></div>`;
}
$('bKB2').onclick = kbOpen;
document.querySelectorAll('#segGhostSrc button').forEach(b => b.addEventListener('click', () => { SET.ghostSrc = b.dataset.v; saveSet(); syncSeg(); }));
document.querySelectorAll('#segGuide button').forEach(b => b.addEventListener('click', () => { SET.guide = b.dataset.v === '1'; saveSet(); syncSeg(); }));
$('bAgain').onclick = () => startRun(S.lastKind || S.kind);
$('bOrtho').onclick = () => $('orthoFile').click();
$('orthoFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { await loadOrthoFile(f); } catch (err) { setOrthoStatus('실패: ' + (err && err.message ? err.message : err), '#ff6060'); }
  e.target.value = '';
});
$('bDem').onclick = () => $('demFile').click();
$('demFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) { window.__lastDemFile = f; demOpen(f); } e.target.value = ''; });
$('bOrthoReset').onclick = () => { resetGround(); IDB.del('ortho' + SITE_KEY0); setOrthoStatus('기본 바닥 사용 중', ''); };
function refreshBest() {
  $('bLastRp').disabled = !LAST_REC;
  let b = null; try { b = parseFloat(localStorage.getItem('fpvsim_fpv_best_' + SET.diff)); } catch (e) { }
  ui.best.textContent = b ? `최고 기록 (${MODES[SET.diff].name}): ${fmt(b)} · 기준 비행 ${fmt(GH.total)}` : `기준 비행 (영상 경로): ${fmt(GH.total)}`;
}
loadBest(); rcWire(); syncSeg(); refreshBest(); restoreOrtho(); siteUI();
setInterval(() => { const gp = getPad(); const el = $('padStatus'); if (el) el.textContent = gp ? '🎮 ' + gp.id.replace(/\(.*?\)/g, '').slice(0, 48) + (gp.mapping === 'standard' ? ' · 표준 배치' : '') : ''; }, 1000);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
resetDrone(startPos(), startHead());
if (!TEST) requestAnimationFrame(frame);
let fakeNow = 0;
function advance(sec, step, skipRender) { step = step || 1 / 60; const n = Math.max(1, Math.round(sec / step)); if (!fakeNow) fakeNow = last; for (let i = 0; i < n; i++) { fakeNow += step * 1000; frame(fakeNow, skipRender || i < n - 1); } }

// 시험용 핸들
window.__sim = { STREES, groundAt, SET, advance, S, DR, IN, OBJS, OBJ, GH, startRun, keys, pressed, collide, setPose(p, v, h) { DR.p.copy(p); DR.v.copy(v); DR.h = h; DR.landed = false; }, W, camera, renderer, scene, SET, loadOrthoFile, course2utm, MODES, predictImpact, tutStart, LESSONS, replayStart, RP, get LAST_REC() { return LAST_REC; }, BEST, readDem, buildTerrainPkg, TER, SITE, EARTH, terrainAt, groundAt, agl,  music: () => ({ timer: !!MUS.timer, step: MUS.step, on: MUS.on, style: SONG.style, sec: SECTIONS[SONG.sec].n, bar: SONG.bar, prog: SONG.prog && SONG.prog.map(c => c[0]).join(","), motif: SONG.motif && SONG.motif.join(" ") }) };
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
function isMission(k) { k = k || S.kind; return k === 'forest' || k === 'race' || k === 'recon' || k === 'strike' || k === 'fire' || k === 'sar' || k === 'track' || k === 'ridge' || k === 'field' || k === 'class1' || k === 'class1x' || k === 'class1d'; }
MS_OK.field = ['x2d', 'anafi', 'fpv', 'fw', 'puma']; MS_NAME.field = window.SIM_LANG === 'en' ? 'Field airstrip' : '야전 착륙장';
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
  if (id === 'c1' && typeof makeC1 === 'function') return makeC1(ghost);
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
  const a = AFc(); DR.p.copy(p); DR.p.y = Math.max(DR.p.y, groundAt(p.x, p.z) + 25); DR.h = h; DR.as = a.cruise; DR.pitch = 0; DR.roll = 0; DR.landed = false; DR.alive = true; DR.gnd = false; DR.liftT = -99;
  DR.v.set(Math.sin(h) * a.cruise, 0, -Math.cos(h) * a.cruise); DR.altT = DR.p.y;
}
const WARN = { t: 0 };
function stepWing(dt) {
  // 조종 단계: 입문·쉬움 = 자동조종(고도·속도 유지, 지형 회피, 실속 보호) · ATTI = 자세 안정 수동(스로틀 직접, 실속 가능) · 스포츠 = 완전 수동(기울기 유지, 실속·스핀)
  const a = AFc(), assist = SET.assist && (SET.diff === 'train' || SET.diff === 'easy'), rate = SET.diff === 'sport';
  if (DR.gnd) return wingRoll(dt, a);
  const appr = rwyApproach();
  const stun = S.stun > 0 ? 0.3 : 1; if (S.stun > 0) S.stun -= dt;
  let ip = IN.pitch * stun, ir = IN.roll * stun; const iy = IN.yaw * stun;
  let V = DR.as || a.cruise;
  // 실속 속도는 하중 배수의 제곱근에 비례: 기울여 선회하면 더 빠른 속도에서 실속 (60° 기울기 = 1.41배)
  const n0 = 1 / Math.max(0.2, Math.cos(DR.roll)), vsE = a.stall * Math.sqrt(Math.min(n0, a.nmax * 1.4));
  const stall = DR.stalled ? V < vsE * 1.06 : V < vsE, warn = !stall && V < vsE * 1.15;
  if (stall && !DR.stalled && !assist) { DR.wdrop = (Math.random() < 0.5 ? -1 : 1); DR.roll += DR.wdrop * (14 + Math.random() * 16) * DEG; }   // 실속 순간 한쪽 날개가 떨어짐
  DR.stalled = stall;
  if (stall) ir *= 0.35;   // 실속: 보조익이 잘 안 먹음
  WARN.t -= dt; if ((warn || stall) && WARN.t <= 0) { WARN.t = stall ? 0.45 : 0.8; sfx('bad'); if (typeof rumble === 'function') rumble(stall ? 0.6 : 0.25, 0.4, 120); }
  S.stallWarn = warn;
  if (stall || warn) shake = Math.max(shake, stall ? 0.05 : 0.018);   // 버핏(떨림)
  if (assist) {
    // 고도 유지: 스틱 놓으면 그 고도, 땅이 가까우면 자동 상승
    if (Math.abs(ip) > 0.05) DR.altT = DR.p.y;
    const ahead = Math.max(terrainAt(DR.p.x, DR.p.z), terrainAt(DR.p.x + DR.v.x * 2.5, DR.p.z + DR.v.z * 2.5), terrainAt(DR.p.x + DR.v.x * 5, DR.p.z + DR.v.z * 5));
    let gt = Math.abs(ip) > 0.05 ? -ip * 28 * DEG : clamp((DR.altT - DR.p.y) * 0.06, -0.3, 0.3);
    if (appr && DR.p.y - groundAt(DR.p.x, DR.p.z) < 4) gt = Math.max(gt, -Math.asin(Math.min(1, 0.7 / Math.max(V, 6))));   // 플레어: 바닥 가까이선 초당 0.7 m 로만 내려앉게   // 접근: 바닥 가까이서 살짝 기수 들기 (플레어)
    if (DR.p.y - ahead < a.minAgl && !a.kam && !appr) { gt = Math.max(gt, 0.25 + (a.minAgl - (DR.p.y - ahead)) * 0.03); DR.altT = Math.max(DR.altT, ahead + a.minAgl); }
    // 실속 보호: 속도가 실속 속도 가까이 떨어지면 상승각을 줄임
    const mg = (V - vsE * 1.12) / (a.stall * 0.35); if (mg < 1) gt = Math.min(gt, Math.max(-0.15, mg) * 28 * DEG);
    DR.pitch += (gt - DR.pitch) * (1 - Math.exp(-dt * 2.2));
    // 기울기 한계: 입문 35° · 느릴 때는 실속하지 않을 만큼만 (V ≥ 1.15·Vs·√n)
    const bMax = Math.min(SET.diff === 'train' ? 35 * DEG : a.bank * DEG, V > a.stall * 1.15 ? Math.acos(Math.min(1, Math.pow(a.stall * 1.15 / V, 2))) : 0);
    DR.roll += (ir * bMax - DR.roll) * (1 - Math.exp(-dt * 2.8));
    S.boosting = !!IN.boost;
    const vt = IN.boost ? a.top : IN.thr >= 0 ? a.cruise + IN.thr * (a.top - a.cruise) : a.cruise + IN.thr * (a.cruise - a.stall - 2);
    V += clamp(vt - V, -4, 4) * dt * 0.9;
  } else if (rate) {
    // 완전 수동: 스틱 = 회전 속도. 놓으면 그 자세 그대로 (수평 복귀 없음) · 실속에서 기수를 계속 당기면 스핀
    DR.roll = clamp(DR.roll + ir * a.rrate * DEG * dt, -85 * DEG, 85 * DEG); DR.pitch = clamp(DR.pitch - ip * a.prate * 0.8 * DEG * dt, -70 * DEG, 60 * DEG);
    if (stall && ip < -0.3) { DR.roll = clamp(DR.roll + (DR.wdrop || 1) * 110 * DEG * dt, -85 * DEG, 85 * DEG); DR.h += (DR.wdrop || 1) * 1.6 * dt; }
    S.boosting = !!IN.boost;
    const thr = IN.boost ? 1 : clamp(0.55 + IN.thr * 0.45, 0, 1), thrust = thr * a.top * 0.42, drag = 0.42 * a.top * (V / a.top) * (V / a.top);
    V += (thrust - drag) * dt;
  } else {
    // 자세 안정 수동(ATTI): 스틱 = 기울기·상승각, 놓으면 수평으로 돌아옴 (고도 유지·지면 회피·실속 보호 없음)
    let gt = -ip * 40 * DEG; const rt = ir * Math.min(70, a.bank * 1.3) * DEG;
    if (stall) gt = Math.min(gt, DR.pitch);   // 실속 중엔 자세 안정이 기수를 들어 올리지 못함
    DR.pitch += clamp(gt - DR.pitch, -a.prate * DEG * dt, a.prate * DEG * dt);
    DR.roll += clamp(rt - DR.roll, -a.rrate * DEG * dt, a.rrate * DEG * dt);
    S.boosting = !!IN.boost;
    const thr = IN.boost ? 1 : clamp(0.55 + IN.thr * 0.45, 0, 1), thrust = thr * a.top * 0.42, drag = 0.42 * a.top * (V / a.top) * (V / a.top);
    V += (thrust - drag) * dt;
  }
  // 오르면 느려지고 내려가면 빨라짐 (에너지)
  V -= G * Math.sin(DR.pitch) * dt * 0.85;
  if (stall) { DR.pitch -= (1.3 + (vsE - V) * 0.25) * dt; DR.pitch = Math.max(DR.pitch, -55 * DEG); }   // 실속: 기수가 떨어지며 속도를 되찾아야 회복
  V = clamp(V, 3, a.kam ? a.top * 1.12 : a.top * 1.18); DR.as = V;
  // 선회: 하중 배수 한계 (nmax) 안에서만 돌고, 넘게 기울이면 양력이 모자라 기수가 내려감
  const nreq = 1 / Math.max(0.05, Math.cos(DR.roll)), nl = Math.min(nreq, a.nmax);
  DR.h += Math.sign(DR.roll) * G * Math.sqrt(Math.max(0, nl * nl - 1)) / Math.max(V, 6) * dt + iy * 0.35 * dt;
  if (nreq > a.nmax) DR.pitch -= (1 - nl * Math.cos(DR.roll)) * G / Math.max(V, 6) * dt;
  V -= (nl - 1) * 1.1 * dt;
  // 비행 구역 밖이면 자동 선회
  const rx = DR.p.x, rz = DR.p.z + 150, l = Math.hypot(rx, rz);
  if (l > FLY_R + 30) { const dh = wrapA(Math.atan2(-rx, rz) - DR.h); DR.h += clamp(dh, -1, 1) * 0.6 * dt; if (S.msgCD <= 0) { showMsg('AREA LIMIT · 선회', '#ff9a40', 1); S.msgCD = 2; } }
  const cg = Math.cos(DR.pitch);
  DR.v.set(Math.sin(DR.h) * V * cg, Math.sin(DR.pitch) * V - (stall ? Math.min(7, 3.5 + (vsE - V) * 1.2) : 0), -Math.cos(DR.h) * V * cg);   // 실속: 양력이 모자라 가라앉음
  DR.v.add(windAt(DR.p)); DR.p.addScaledVector(DR.v, dt); DR.thrust = assist ? clamp(0.5 + IN.thr * 0.5, 0.2, 1) : IN.boost ? 1 : clamp(0.55 + IN.thr * 0.45, 0, 1);
  if (DR.p.y > groundAt(DR.p.x, DR.p.z) + 150) { DR.p.y = groundAt(DR.p.x, DR.p.z) + 150; DR.altT = Math.min(DR.altT, DR.p.y); }
  S.stallW = stall;
  // 지면·장애물·나무 = 추락 (자폭기는 기폭)
  if (DR.p.y < groundAt(DR.p.x, DR.p.z) + 0.7 && RWY && !a.kam) {   // 활주로 위 접지: 너무 빨리 내려오거나 기울면 추락
    const l = rwyLocal(DR.p);
    if (S.simT - (DR.liftT ?? -99) > 2 && DR.v.y < 0.3 && Math.abs(l.w) < RWY.Wd / 2 + 2 && Math.abs(l.t) < RWY.L / 2 + 5 && DR.v.y > -3.5 && Math.abs(DR.roll) < 20 * DEG && V < a.stall * 1.75) {
      DR.gnd = true; DR.p.y = groundAt(DR.p.x, DR.p.z) + 0.25; DR.pitch = 0; DR.roll = 0; showMsg(L2('접지 · 스로틀 내려 감속', 'TOUCHDOWN · throttle down to brake'), '#5dff9a', 1.6); sfx('drop'); return;
    }
  }
  if (DR.p.y < groundAt(DR.p.x, DR.p.z) + 0.15) return lostDrone('GROUND');
  const hit = collide(DR.p, DR.R) || STREES.col(DR.p, DR.R);
  if (hit) return lostDrone(hit.tag);
}
// ---- 활주로 (고정익 이착륙): 출발점 근처에서 평탄·나무 적음·코스와 겹치지 않는 띠를 자동으로 고름 ----
const _rv = new V3();
const RWY = (function () {
  try {
    const sp = startPos(), L = 130, Wd = 12, avoid = [];
    if (typeof OBJS !== 'undefined') OBJS.forEach(o => o.mk && avoid.push(o.mk));
    let best = null;
    for (let R = 120; R <= 420; R += 30) for (let a = 0; a < 360; a += 20) for (let hd = 0; hd < 180; hd += 15) {
      const cx = sp.x + Math.sin(a * DEG) * R, cz = sp.z - Math.cos(a * DEG) * R, h = hd * DEG, ux = Math.sin(h), uz = -Math.cos(h);
      if (Math.hypot(cx - FLY_C.x, cz - FLY_C.z) > FLY_R_SAFE - 160) continue;
      let bad = false; for (const m of avoid) { const dx = m.x - cx, dz = m.z - cz, t = dx * ux + dz * uz, w = -dx * uz + dz * ux; if (Math.abs(t) < L / 2 + 40 && Math.abs(w) < Wd / 2 + 40) { bad = true; break; } } if (bad) continue;
      const ys = []; let trees = 0, hit = false;
      for (let t = -L / 2; t <= L / 2; t += 10) for (const w of [-6, 0, 6]) { const x = cx + ux * t - uz * w, z = cz + uz * t + ux * w, y = groundAt(x, z); ys.push([t, y]);
        _rv.set(x, y + 2.5, z); if (collide(_rv, 1.2)) hit = true; if (STREES.col && STREES.col(_rv, 1)) trees++; }
      if (hit) continue;
      for (const t of [-1, 1]) for (let e = 20; e <= 160; e += 20) { const tt = t * (L / 2 + e), x = cx + ux * tt, z = cz + uz * tt; _rv.set(x, groundAt(x, z) + 6, z); if (STREES.col && STREES.col(_rv, 1)) trees += 0.25; }   // 접근로 나무
      const n = ys.length, mt = ys.reduce((q, v) => q + v[0], 0) / n, my = ys.reduce((q, v) => q + v[1], 0) / n; let sxy = 0, sxx = 0; ys.forEach(([t, y]) => { sxy += (t - mt) * (y - my); sxx += (t - mt) ** 2; });
      const k = sxy / sxx, res = Math.max(...ys.map(([t, y]) => Math.abs(y - (my + k * (t - mt))))), sc = res + trees * 0.4 + Math.abs(k) * 25 + R * 0.002;
      if (Math.abs(k) < 0.06 && (!best || sc < best.sc)) best = { sc, cx, cz, h, ux, uz };
    }
    if (!best) return null;
    let { cx, cz, h, ux, uz } = best;
    // 이륙 방향: 비행 구역 가운데 쪽으로
    if ((FLY_C.x - cx) * ux + (FLY_C.z - cz) * uz < 0) { h += Math.PI; ux = -ux; uz = -uz; }
    STREES.hideRect && STREES.hideRect(cx, cz, ux, uz, L + 30, Wd + 14); STREES.hideRect && STREES.hideRect(cx, cz, ux, uz, L + 320, 26);   // 활주로 + 양쪽 접근로 160 m
    const at = (t, w) => new V3(cx + ux * t - uz * w, 0, cz + uz * t + ux * w);
    const g = new THREE.Group(); scene.add(g);
    // 노면: 지형을 따라 깔고 표시(중앙선·시단·번호)는 캔버스 무늬로
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 1024; const x = cv.getContext('2d');
    x.fillStyle = '#3a3c3f'; x.fillRect(0, 0, 128, 1024); for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`; x.fillRect(Math.random() * 128, Math.random() * 1024, 2, 2); }
    x.fillStyle = '#e9e9e2'; x.fillRect(4, 0, 3, 1024); x.fillRect(121, 0, 3, 1024);
    for (let y = 120; y < 904; y += 48) x.fillRect(62, y, 4, 26);
    for (const y0 of [8, 1016 - 40]) for (let i = 0; i < 6; i++) x.fillRect(14 + i * 18 + (i > 2 ? 10 : 0), y0, 8, 40);
    const num = n => String(Math.round(n / 10) % 36 || 36).padStart(2, '0'); const hdg = ((h / DEG) % 360 + 360) % 360;
    x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.save(); x.translate(64, 96); x.fillText(num(hdg), 0, 0); x.restore();
    x.save(); x.translate(64, 928); x.rotate(Math.PI); x.fillText(num(hdg + 180), 0, 0); x.restore();
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const NS = 40, geo = new THREE.PlaneGeometry(Wd, L, 2, NS), pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) { const w = pa.getX(i), t = pa.getY(i), q = at(t, w); pa.setXYZ(i, q.x, groundAt(q.x, q.z) + 0.07, q.z); }
    geo.computeVertexNormals();
    const strip = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 })); strip.receiveShadow = true; g.add(strip);
    // 가장자리 등 (끝: 초록/빨강) · 풍향계
    const lw = new THREE.MeshBasicMaterial({ color: 0xfff1c0, toneMapped: false }), lg = new THREE.MeshBasicMaterial({ color: 0x40ff70, toneMapped: false }), lr = new THREE.MeshBasicMaterial({ color: 0xff4040, toneMapped: false });
    for (let t = -L / 2; t <= L / 2 + 0.1; t += 13) for (const w of [-Wd / 2 - 0.6, Wd / 2 + 0.6]) { const q = at(t, w); const m = new THREE.Mesh(USPH, Math.abs(t + L / 2) < 1 ? lg : Math.abs(t - L / 2) < 1 ? lr : lw); m.scale.setScalar(0.16); m.position.set(q.x, groundAt(q.x, q.z) + 0.3, q.z); g.add(m); }
    const ws = at(-L / 2 + 15, Wd / 2 + 8), wy = groundAt(ws.x, ws.z), pole = new THREE.Mesh(UCYL, mat(0xd8d8d8)); pole.scale.set(0.05, 4, 0.05); pole.position.set(ws.x, wy + 2, ws.z); g.add(pole);
    const sock = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.8, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xff7a1a, side: THREE.DoubleSide, roughness: 0.8 })); sock.position.set(ws.x, wy + 3.8, ws.z); g.add(sock);
    // 야전 착륙장: 활주로 옆 계류장(쿼드 H 패드 3개) + 유도로 · 평탄한 쪽으로
    const flat = sg => { let mx = -1e9, mn = 1e9; for (let t = -22; t <= 22; t += 6) for (let w = 0; w <= 46; w += 6) { const q = at(t, sg * (Wd / 2 + 8 + w)), y = groundAt(q.x, q.z); mx = Math.max(mx, y); mn = Math.min(mn, y); _rv.set(q.x, y + 2, q.z); if (collide(_rv, 1.5)) return 1e9; } return mx - mn; };
    const sg = flat(1) <= flat(-1) ? 1 : -1, AW = 20, AL = 40, aw0 = Wd / 2 + 30, ac = at(0, sg * (aw0 + AW / 2));
    STREES.hideRect && STREES.hideRect(ac.x, ac.z, ux, uz, AL + 16, AW + 16); { const tw = at(0, sg * (Wd / 2 + 15)); STREES.hideRect && STREES.hideRect(tw.x, tw.z, -uz * sg, ux * sg, 34, 14); }
    const deck = (t0, t1, w0, w1, nt, nw, mtl, lift) => { const gg = new THREE.PlaneGeometry(1, 1, nw, nt), pa = gg.attributes.position;
      for (let i = 0; i < pa.count; i++) { const u = pa.getX(i) + 0.5, v = pa.getY(i) + 0.5, q = at(t0 + (t1 - t0) * v, w0 + (w1 - w0) * u); pa.setXYZ(i, q.x, groundAt(q.x, q.z) + lift, q.z); }
      gg.computeVertexNormals(); const m = new THREE.Mesh(gg, mtl); m.receiveShadow = true; g.add(m); return m; };
    const concM = new THREE.MeshStandardMaterial({ color: 0x8d8d86, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
    const taxM = new THREE.MeshStandardMaterial({ color: 0x45474a, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
    deck(-AL / 2, AL / 2, sg * aw0, sg * (aw0 + AW), 8, 4, concM, 0.08);                         // 계류장
    deck(-3, 3, sg * (Wd / 2 - 0.5), sg * (aw0 + 0.5), 1, 6, taxM, 0.075);                     // 유도로
    const yl = new THREE.MeshBasicMaterial({ color: 0xf2c230 }); for (let w = Wd / 2 + 1; w < aw0; w += 3) { const q = at(0, sg * w); const m = new THREE.Mesh(UBOX, yl); m.scale.set(0.25, 0.03, 1.6); m.position.set(q.x, groundAt(q.x, q.z) + 0.1, q.z); m.rotation.y = -h + Math.PI / 2; g.add(m); }   // 유도로 노란 중앙선
    const padTex = n => { const c = document.createElement('canvas'); c.width = c.height = 256; const x2 = c.getContext('2d'); x2.fillStyle = '#2f3134'; x2.beginPath(); x2.arc(128, 128, 126, 0, 6.283); x2.fill(); x2.strokeStyle = '#f0f0ea'; x2.lineWidth = 10; x2.beginPath(); x2.arc(128, 128, 112, 0, 6.283); x2.stroke();
      x2.fillStyle = '#f0f0ea'; x2.font = 'bold 150px sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText('H', 128, 136); x2.fillStyle = '#f2c230'; x2.font = 'bold 40px sans-serif'; x2.fillText(String(n), 200, 60); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
    const pads = [-13, 0, 13].map((t, i) => { const q = at(t, sg * (aw0 + AW / 2)); q.y = groundAt(q.x, q.z); let top = q.y; for (const [dx, dz] of [[2.6, 0], [-2.6, 0], [0, 2.6], [0, -2.6], [1.8, 1.8], [-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8]]) top = Math.max(top, groundAt(q.x + dx, q.z + dz)); const m = new THREE.Mesh(new THREE.CircleGeometry(3, 40), new THREE.MeshStandardMaterial({ map: padTex(i + 1), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = -h; m.position.set(q.x, top + 0.16, q.z); /* 패드는 바닥면보다 위로 */ m.receiveShadow = true; g.add(m); return q; });
    window.__RWY = { a: at(-L / 2, 0), b: at(L / 2, 0), apron: [at(-AL / 2, sg * aw0), at(AL / 2, sg * aw0), at(AL / 2, sg * (aw0 + AW)), at(-AL / 2, sg * (aw0 + AW))], pads };
    return { cx, cz, h, ux, uz, L, Wd, at, g, sock, pads, sg };
  } catch (e) { console.warn('runway', e); return null; }
})();
// 활주로가 생기기 전에 그려 둔 코스 지도에 다시 그려 넣음
if (RWY && typeof MAP_CACHE !== 'undefined' && MAP_CACHE.course) { try { const kb = mapBg, kv = MAPV; mapBg = MAP_CACHE.course; MAPV = MAP_CACHE.course.V || MAPV_COURSE || MAPV; drawMapBg(); mapBg = kb; MAPV = kv; } catch (e) { } }
// 고정익 자유 비행: 코스 지도에 활주로까지 들어오게
function rwyMapView() { if (!RWY) return; const V = MAP_CACHE.course && MAP_CACHE.course.V || MAPV, A = RWY.at(-RWY.L / 2 - 60, 0), B = RWY.at(RWY.L / 2, 0); mapView('free_wing', [[V.d0 + 40, V.s0 + 40], [V.d1 - 40, V.s1 - 40], [-A.z, A.x, 10], [-B.z, B.x, 10]]); }
function rwyLocal(p) { const dx = p.x - RWY.cx, dz = p.z - RWY.cz; return { t: dx * RWY.ux + dz * RWY.uz, w: -dx * RWY.uz + dz * RWY.ux }; }
function wingRwyOK(a) { return !!RWY && a && a.cls === 'wing' && !a.kam; }
function wingGround() {   // 활주로 시단에서 정지 상태로 시작
  const a = AFc(), p = RWY.at(-RWY.L / 2 + 8, 0); p.y = groundAt(p.x, p.z) + 0.25;
  DR.p.copy(p); DR.h = RWY.h; DR.as = 0; DR.v.set(0, 0, 0); DR.pitch = 0; DR.roll = 0; DR.alive = true; DR.gnd = true; DR.landed = true; DR.altT = p.y + 35; DR.liftT = -99;
  showMsg(L2('활주로 · 스로틀 올려 이륙 (속도 붙으면 기수 들기)', 'RUNWAY · throttle up, rotate at speed'), '#ffc828', 3);
}
// 지상 활주: 스로틀 = 가속, 스로틀 내림 = 브레이크, 회전·좌우 = 앞바퀴 조향 · 이륙 속도에서 기수를 들면(보조 켬: 스로틀만으로) 이륙
function wingRoll(dt, a) {
  const thrUp = IN.boost || IN.thr > 0.15, brake = IN.thr < -0.15; let V = DR.as || 0;
  const autoBrk = SET.assist && SET.diff !== 'sport';   // 보조 켬: 스로틀을 안 올리면 자동 제동
  V = Math.max(0, V + (thrUp ? (IN.boost ? 4.5 : 3.2) : brake ? -5 : autoBrk ? -3 : -0.6) * dt);
  if (V > 0.5) DR.h += (IN.yaw * 0.6 + IN.roll * 0.35) * dt;
  const fx = Math.sin(DR.h), fz = -Math.cos(DR.h), w = windAt(DR.p);
  DR.p.x += fx * V * dt; DR.p.z += fz * V * dt; DR.p.y = groundAt(DR.p.x, DR.p.z) + 0.25;
  DR.pitch = 0; DR.roll = 0; DR.as = V; DR.v.set(fx * V, 0, fz * V); DR.thrust = thrUp ? 1 : 0.25; S.stallW = false; S.boosting = !!IN.boost; DR.landed = V < 0.3;
  const vr = a.stall * 1.15;
  if (V >= vr && (IN.pitch < -0.25 || (SET.assist && SET.diff !== 'sport' && thrUp))) {
    DR.gnd = false; DR.landed = false; DR.pitch = 9 * DEG; DR.altT = DR.p.y + 35; DR.liftT = S.simT; showMsg(L2('이륙', 'LIFT OFF'), '#5dff9a', 1.2); sfx('chime'); return;
  }
  const l = rwyLocal(DR.p); if ((Math.abs(l.w) > RWY.Wd / 2 + 5 || Math.abs(l.t) > RWY.L / 2 + 60) && V > 6) return lostDrone('GROUND');   // 활주로를 벗어나 빠르게 굴러가면 사고
  const hit = collide(DR.p, DR.R); if (hit && V > 3) return lostDrone(hit.tag);
}
// 접근 중인가: 활주로 연장선 위(옆 30 m + 거리비례), 끝을 아직 안 지남, 방향이 맞음, 이륙 직후 아님
function rwyApproach() {
  if (!RWY || S.simT - (DR.liftT ?? -99) < 12) return false;
  const l = rwyLocal(DR.p), dir = Math.cos(DR.h - RWY.h) >= 0 ? 1 : -1, tt = l.t * dir;
  return Math.abs(wrapA(DR.h - RWY.h - (dir < 0 ? Math.PI : 0))) < 30 * DEG && tt < RWY.L / 2 && tt > -RWY.L / 2 - 450 && Math.abs(l.w) < 30 + Math.max(0, -tt - RWY.L / 2) * 0.15;
}
// 활주로 착륙 목표 (고정익 임무 마지막)
function rtbObj(a) {
  if (wingRwyOK(a)) { const td = RWY.at(-RWY.L / 2 + 20, 0), ap = RWY.at(-RWY.L / 2 - 300, 0); td.y = groundAt(td.x, td.z) + 1; ap.y = groundAt(ap.x, ap.z) + 35;
    return { kind: 'ms', t: 'rwyland', label: L2('복귀 · 활주로 착륙', 'Return · land on the runway'), mk: td.clone().setY(td.y + 4), pts(p) { return [p.clone(), ap.clone(), td.clone()]; } }; }
  if (a.cls === 'wing') return passCP('복귀 · 출발점 상공 통과', { d: BY.pad_start.down, s: BY.pad_start.side, td: 1, ts: 0 }, 0, 35, 35, 14);
  return { kind: 'ms', t: 'land', label: '출발 패드로 복귀 · 착륙', mk: startPos().add(new V3(0, 1.5, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } };
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
    pts(p) { const ld = guideLead(), cc = this.ring ? this.c : mid, bf = p.clone().sub(cc).dot(n); return bf < -ld - 2 ? [p.clone(), cc.clone().addScaledVector(n, -ld), cc.clone(), cc.clone().addScaledVector(n, 3)] : [p.clone(), cc.clone(), cc.clone().addScaledVector(n, 3)]; } };
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
    tor.position.copy(cp.c); tor.lookAt(cp.c.clone().add(cp.n)); MSG.race.add(tor); cp.mesh = tor; ringDecor(cp); L.push(cp);
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
  if (RWY && AFc().cls === 'wing' && !AFc().kam) { add(RWY.at(-RWY.L / 2 - 120, 0), 20); add(RWY.at(RWY.L / 2, 0), 20); }   // 고정익: 활주로·접근로
  if (kind === 'field' && RWY) { if (AFc().cls === 'wing') { add(RWY.at(-RWY.L / 2 - 250, 0), 30); add(RWY.at(RWY.L / 2 + 190, -RWY.sg * 220), 30); } RWY.pads.forEach(p => add(p, 15)); add(RWY.at(-RWY.L / 2, 0), 15); add(RWY.at(RWY.L / 2, 0), 15); return P; }
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
  if (typeof isC1 === 'function' && isC1(kind)) L = c1Start(a);
  if (wingRwyOK(a) && ['recon', 'fire', 'ridge'].includes(kind)) L = L.concat([rtbObj(a)]);   // 고정익: 임무 끝에 활주로 착륙
  L.forEach(o => { o.done = false; o.miss = false; }); S.msNear = null; MS.list = L; MS.kind = kind; MS.t0 = 0; MS.events = []; S.decoyHit = 0;
  // 시작 위치: 고정익·자폭 고정익은 공중에서
  const c1s = typeof isC1 === 'function' && isC1(kind) ? c1StartPose() : null;
  const p0 = c1s ? c1s.p : kind === 'field' && RWY && a.cls !== 'wing' ? RWY.pads[0].clone().setY(RWY.pads[0].y + 0.06) : startPos(), o = msObj(); let h = startHead();
  if (c1s) h = c1s.h; else if (o && o.mk) { const d = o.mk.clone().sub(p0); h = Math.atan2(d.x, -d.z); }
  if (wingRwyOK(a) && kind !== 'strike') wingGround(); else if (a.cls === 'wing') { p0.y = groundAt(p0.x, p0.z) + (a.kam ? 45 : 30); wingAir(p0, h); } else resetDrone(p0, h);
  MS.launch = { p: DR.p.clone(), h: DR.gnd ? DR.h : h };
  S.respawn = null;
  if (ENV.ir) { irSet(false); irSet(true); }   // 바뀐 열 세기 반영
  MS.par = msPar(kind, L); briefShow(kind, L);
  if (c1s) { ui.map.style.display = 'none'; return; }
  try { const run = ['fire', 'sar', 'recon', 'track', 'field'].includes(kind); mapView('ms_' + kind, missionMapPts(kind, run), run); } catch (e) { mapView('course'); }
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
const RACE_PEN = 8;   // 레이스: 놓친 링 하나당 +8 s
function msSkip() {
  const o = msObj(); if (!o) return;
  o.done = true; o.miss = true; if (S.kind === 'race') S.pen += RACE_PEN; dbfObj(o.label, false); sfx('bad'); showMsg(o.label + ' ✗ → NEXT', '#ff9a40', 1.3);
  comm(`${CS}, CONTROL. You missed that checkpoint. Press on to the next.`, `${o.label} 실패 · 다음 목표로`);
  MS.idx++; while (MS.list[MS.idx] && MS.list[MS.idx].done) MS.idx++; S.recT = 0;
  S.respawn = { p: DR.p.clone(), h: DR.h }; renderList();
  if (MS.idx >= MS.list.length) msFinish();
}
function msStep(prev, cur, dt) {
  if (typeof isC1 === 'function' && isC1()) { c1Step(prev, cur, dt); return; }
  const o = msObj(); if (!o || !DR.alive) return;
  if (o.t === 'pass') {
    /* 숲길·능선·레이스: 놓치고 지나가면 그 통과점만 실패(✗)로 두고 다음으로 (레이스는 링마다 +벌점) */
    {
      for (let j = MS.idx + 1; j <= Math.min(MS.idx + 2, MS.list.length - 1); j++) {
        const q = MS.list[j]; if (q.t !== 'pass' || passCross(q, prev, cur) !== true) continue;
        const missed = []; for (let k = MS.idx; k < j; k++) if (!MS.list[k].done) { MS.list[k].miss = true; missed.push(MS.list[k].label); }
        for (let k = MS.idx; k < j; k++) MS.list[k].done = true;
        if (S.kind === 'race') S.pen += RACE_PEN * missed.length;
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
  } else if (o.t === 'padland') {
    const e = Math.hypot(DR.p.x - o.pad.x, DR.p.z - o.pad.z);
    if (DR.landed && DR.v.length() < 0.6) { if (e <= 1.5) { (S.padErr = S.padErr || []).push(e); msNext(L2(`착륙 ✓ 오차 ${e.toFixed(2)} m`, `Landed ✓ ${e.toFixed(2)} m off`), '#5dff9a'); } else if (e < 6 && S.bumpT <= 0) { showMsg(L2(`패드 밖 ${e.toFixed(1)} m · 다시 떠서 가운데로`, `Off the pad ${e.toFixed(1)} m · lift and recentre`), '#ff9a40', 1.4); S.bumpT = 1.5; } }
  } else if (o.t === 'rwyland') { if (DR.gnd && (DR.as || 0) < 2) msNext(L2('활주로 착륙 ✓', 'Landed on the runway ✓'), '#5dff9a'); }
  else if (o.t === 'fire') fireStep(cur, dt);
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
    const hid = []; const hide = o => { if (o && o.visible) { o.visible = false; hid.push(o); } }; GUIDE.meshes.forEach(m => hide(m.g)); hide(marker); hide(impactRing);   // 사진엔 안내 표시 없이
    renderer.setRenderTarget(PH.rt); renderer.clear(); renderer.render(scene, cam); hid.forEach(o => o.visible = true); const px = new Uint8Array(W0 * H0 * 4); renderer.readRenderTargetPixels(PH.rt, 0, 0, W0, H0, px);
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
    if (S.kind === 'field' && S.padErr && S.padErr.length) rows.push([L2('착륙 오차', 'Landing error'), S.padErr.map(e => e.toFixed(2)).join(' / ') + ' m']);
    if (S.kind === 'track') rows.push(['추적 유지', S.trT.toFixed(0) + ' / ' + S.trWin.toFixed(0) + ' s'], [L2('최대 노출', 'Peak exposure'), Math.round(TRACK.susMax || 0) + '%'], [L2('발각', 'Spotted'), TRACK.burn ? L2('예 (-30)', 'yes (-30)') : L2('아니오', 'no')], ['판정', S.trackOK ? '성공' : '실패']);
    if (S.kind === 'race') rows.push([L2('놓친 링', 'Missed rings'), MS.list.filter(x => x.miss).length + ' / ' + MS.list.length + L2(' (링당 +8 s)', ' (+8 s each)')]);
    if (S.kind === 'ridge' && RIDGE) rows.push(['정상 해발', RIDGE.top.toFixed(0) + ' m']);
    if (S.kind === 'fire') (S.fireRep || []).forEach((xy, i) => xy && rows.push(['불씨 ' + (i + 1) + ' (EPSG:5186)', xy[0].toFixed(0) + ', ' + xy[1].toFixed(0)]));
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td></tr>`).join('');
    debriefShow(MS.list.filter(x => x.done && !x.miss).length, MS.list.length, MS.par || 0);
    const ph = (S.photos || []).filter(p => p.ok), rp = $('resPhotos');
    if (rp) { rp.style.display = ph.length ? 'flex' : 'none'; rp.innerHTML = ph.map((p, i) => `<figure><a href="${p.url}" download="report_${S.kind}_${i + 1}.jpg"><img src="${p.url}" alt=""></a>${L2('보고 ', 'Report ')}${i + 1}${p.xy ? ' · ' + p.xy[0].toFixed(0) + ', ' + p.xy[1].toFixed(0) : ''}</figure>`).join(''); }
    const key = 'fpvsim_ms_best_' + S.kind + '_' + a.id + '_' + SET.diff + SITE_KEY; let best = null;
    try { best = parseFloat(localStorage.getItem(key)); } catch (e) { }
    if (!best || total < best) { try { localStorage.setItem(key, String(total)); } catch (e) { } ui.resBest.textContent = '★ 최고 기록 갱신'; }
    else ui.resBest.textContent = '최고 기록 ' + fmt(best);
  }, 1400);
}
function msOsd() {
  const o = msObj(), a = AFc(); let h = '';
  if (a.cls === 'wing') h += `<div><b>AS</b>${((DR.as || 0) * 3.6).toFixed(0)} km/h</div>` + (S.stallW ? '<div style="color:#ff5050">STALL ▼ · ' + L2('기수 내리고 스로틀', 'nose down, power') + '</div>' : S.stallWarn ? '<div style="color:#ffb030">' + L2('실속 주의 · 속도', 'STALL WARNING · speed') + '</div>' : '');
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
  const HAS = { forest: !!FLANE, race: RACE.length > 0, recon: RECON.length > 0, strike: STRIKE.length > 0, fire: FIRE.length > 0, sar: !!SAR, track: !!TRACK, ridge: !!RIDGE, field: !!RWY };
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
  if (typeof c1Sun === 'function' && typeof isC1 === 'function' && isC1() && S.state !== 'menu') c1Sun();   // 1종: 시험 시각의 해 위치
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
    const tor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 40), mat(c.top ? 0xff4d4d : 0x4fe3ff, { emissive: c.top ? 0x330000 : 0x002233, roughness: 0.4 })); g.add(tor); cp.mesh = tor; ringDecor(cp); return cp; });
  const flag = new THREE.Mesh(UBOX, mat(0xff4d4d)); const tw = W(ds(top % n, (top / n) | 0)[0], ds(top % n, (top / n) | 0)[1], 0); flag.position.copy(tw).add(new V3(0, 3, 0)); flag.scale.set(0.08, 6, 0.08); g.add(flag);
  return { list, top: mx + SITE.base, len: all.length * st };
})();
function scenStart(kind, a) {
  ['sar', 'track', 'ridge', 'field'].forEach(k => MSG[k] && (MSG[k].visible = false)); if (STREES.unscorch) STREES.unscorch();
  if (kind === 'sar' && SAR) {
    MSG.sar.visible = true; SAR.kit = null; sarRandom();
    S.kits = 2; SAR.pkFound = false;
    const L = [{ kind: 'ms', t: 'sarfind', label: L2('실종자 수색 · 구역 반경 120 m', 'Find the hiker · area radius 120 m'), tp: SAR.tp, mk: SAR.area, search: { r: 120 }, need: 1.5, pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y))]; } }];
    if (a.drop) L.push({ kind: 'ms', t: 'sarkit', label: '구조 키트 투하 (5 m 이내)', mk: SAR.c.clone().add(new V3(0, 8, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } });
    L.push(rtbObj(a));
    return L;
  }
  if (kind === 'track' && TRACK) {
    MSG.track.visible = true; TRACK.go = false; S.trT = 0; S.trWin = 0; trackRandom();
    const p0 = trackPose(TRACK.s); TRACK.g.position.copy(p0.p); TRACK.g.rotation.y = -p0.h;
    TRACK.sus = 0; TRACK.susMax = 0; TRACK.warn = false; TRACK.burn = false; TRACK.lt.vPrev = 0; trackLights(0, false);
    const L = [{ kind: 'ms', t: 'track', label: L2('차량 추적 · 들키지 말고 60초 관측', 'Vehicle track · 60 s unseen'), mk: p0.p.clone().add(new V3(0, 12, 0)), need: 60, pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y))]; } }];
    L.push(rtbObj(a));
    return L;
  }
  if (kind === 'field' && RWY) {
    MSG.field = MSG.field || new THREE.Group(); if (!MSG.field.parent) scene.add(MSG.field); MSG.field.clear(); MSG.field.visible = true; S.padErr = [];
    if (a.cls === 'wing') {   // 장주: 이륙 → 상승 → 옆바람 → 바람 따라 → 활주로 착륙 (왼쪽 장주, 40 m)
      const side = -RWY.sg, P = [[RWY.L / 2 + 170, 0, 1, 0], [RWY.L / 2 + 170, side * 200, 0, 1], [-RWY.L / 2 - 170, side * 200, -1, 0], [-RWY.L / 2 - 200, 0, 1, 0]];
      const names = [L2('장주 1 · 상승', 'Pattern 1 · upwind'), L2('장주 2 · 옆바람', 'Pattern 2 · crosswind'), L2('장주 3 · 바람 따라', 'Pattern 3 · downwind'), L2('장주 4 · 최종 접근', 'Pattern 4 · final')];
      const L = P.map(([t, w, dt0, dw], i) => { const q = RWY.at(t, w), dx = RWY.ux * dt0 - RWY.uz * dw * 0, dz = RWY.uz * dt0 + RWY.ux * dw * 0;
        let tx = dt0 ? RWY.ux * dt0 : -RWY.uz * dw, tz = dt0 ? RWY.uz * dt0 : RWY.ux * dw; if (i === 1) { tx = -RWY.uz * side; tz = RWY.ux * side; }
        const cp = passCP(names[i], { d: -q.z, s: q.x, td: -tz, ts: tx }, 0, i === 3 ? 25 : 40, i === 3 ? 25 : 40, 14); cp.c = cp.mk.clone();   // 링 판정은 링 중심 기준
        const tor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 48), mat(0xffc828, { emissive: 0x332200 })); tor.scale.setScalar(14); tor.position.copy(cp.mk); tor.lookAt(cp.mk.clone().add(cp.n)); MSG.field.add(tor); cp.mesh = tor; ringDecor(cp); return cp; });
      L.push(rtbObj(a)); return L;
    }
    const pl = (i, lab) => { const p = RWY.pads[i]; return { kind: 'ms', t: 'padland', label: lab, pad: p, mk: p.clone().setY(p.y + 3), pts(q) { return [q.clone(), this.pad.clone().setY(Math.max(q.y, this.pad.y + 6)), this.pad.clone().setY(this.pad.y + 1)]; } }; };
    const fly = passCP(L2('활주로 상공 통과 · 10 m', 'Fly over the runway · 10 m'), (() => { const q = RWY.at(RWY.L / 2 - 20, 0); return { d: -q.z, s: q.x, td: -RWY.uz, ts: RWY.ux }; })(), 8, 10, 10, 6);
    fly.c = fly.mk.clone();
    { const tor = new THREE.Mesh(new THREE.TorusGeometry(6, 0.18, 8, 40), mat(0x4fe3ff, { emissive: 0x002233 })); tor.position.copy(fly.mk); tor.lookAt(fly.mk.clone().add(fly.n)); MSG.field.add(tor); }
    return [pl(1, L2('H2 패드에 착륙', 'Land on pad H2')), pl(2, L2('H3 패드에 착륙', 'Land on pad H3')), fly, pl(0, L2('H1 패드로 복귀 · 착륙', 'Return to pad H1 · land'))];
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
  if (typeof c1Tick === 'function') c1Tick(dt);
  photoTick(dt); WIND.t += dt; msEvents(dt); commTick(dt); if (S.kind === 'sar') sarClues(dt, DR.p);
  if (TRACK && MSG.track && MSG.track.visible && TRACK.go && S.state === 'run') {
    TRACK.s = Math.min(TRACK.endS || TRACK.total, TRACK.s + TRACK.v * dt); const vp = trackPose(TRACK.s), ah = trackPose(Math.min(TRACK.total, TRACK.s + 3));
    TRACK.g.position.copy(vp.p); TRACK.g.rotation.y = -vp.h; TRACK.g.rotation.x = Math.atan2(ah.p.y - vp.p.y, 3) * 1;
  }
  if (TRACK && MSG.track && MSG.track.visible) trackLights(S.state === 'pause' ? 0 : dt, !!TRACK.go);
  if (S.kind === 'sar' && SAR) sarWave(dt);
  ringsTick();
}
// 조난자: 드론이 70 m 안에 오면 팔을 들어 흔듦 (발견 뒤에도 계속)
function sarWave(dt) {
  if (!SAR || !SAR.arm || !MSG.sar || !MSG.sar.visible) return;
  const near = S.state === 'run' && DR.p.distanceTo(SAR.c) < 70; SAR.wave += ((near ? 1 : 0) - SAR.wave) * Math.min(1, dt * 2.5);
  const t = performance.now() / 1000, w = SAR.wave;
  SAR.arm.rotation.z = (Math.PI / 2 + 0.2) * (1 - w) + 0.15 * w; SAR.arm.rotation.x = w * Math.sin(t * 7) * 0.55;
}
// 링 통과 방향 표시: 들어갈 면 = 초록 막 · 반대 면 = 빨강 · 링을 꿰뚫는 화살표(»)가 진행 방향으로 흐름 (링 로컬: +Z = 통과 방향)
function chevGeo() { if (chevGeo.g) return chevGeo.g; const g = new THREE.BufferGeometry(), v = [-0.32, 0, -0.12, 0, 0, 0.16, 0, 0, 0.04, -0.32, 0, -0.12, 0, 0, 0.04, -0.32, 0, -0.24, 0.32, 0, -0.12, 0, 0, 0.04, 0, 0, 0.16, 0.32, 0, -0.12, 0.32, 0, -0.24, 0, 0, 0.04];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); return (chevGeo.g = g); }   // 링 만들 때(로드 중) 쓰이므로 함수로
function ringDecor(cp) {
  const m = cp.mesh; if (!m || cp.decor) return; const D = new THREE.Group(); m.add(D); cp.decor = D;
  const ent = new THREE.Mesh(new THREE.CircleGeometry(0.93, 32), new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.16, side: THREE.FrontSide, depthWrite: false })); ent.rotation.y = Math.PI; D.add(ent);
  const bad = new THREE.Mesh(new THREE.CircleGeometry(0.93, 32), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.22, side: THREE.FrontSide, depthWrite: false })); D.add(bad);
  cp.chev = []; for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(chevGeo(), new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); c.scale.setScalar(1.3); D.add(c); cp.chev.push(c); }
}
function ringsTick() {   // 지난 링은 감추고, 지금·다음 링에만 방향 표시
  if (!isMission() || !MS.list) return; const t = S.simT;
  MS.list.forEach((o, i) => { if (!o.mesh) return; o.mesh.visible = !o.done; if (!o.decor) return; const show = !o.done && i <= MS.idx + 1; o.decor.visible = show; if (!show) return;
    const cur = i === MS.idx; o.chev.forEach((c, k) => { const u = ((t * 0.6 + k / o.chev.length) % 1); c.position.set(0, 0, -2.2 + u * 3.2); c.material.opacity = (cur ? 0.95 : 0.45) * Math.sin(u * Math.PI); }); });
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
  if (kind === 'class1' || kind === 'class1x' || kind === 'class1d') return 900;
  const a = AFc(), v = a.cls === 'wing' ? a.cruise : Math.min(a.top, 12);
  if (kind === 'forest') return (FLANE ? FLANE.total : 400) / Math.min(v, 6) + 15;
  if (kind === 'race') return (PATHL ? PATHL.total : 500) / (v * 0.85) + 10;
  if (kind === 'ridge') return (RIDGE ? RIDGE.len : 900) / (v * 0.8) + 20;
  if (kind === 'field') return AFc().cls === 'wing' ? 150 : 90;
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
  race: ['Valley time race', 'Fly through the rings along the valley, in order, as fast as you can.', 'Boost (BST) takes you to the airframe top speed. Miss a ring and it is skipped with an 8 s penalty.'],
  recon: ['Building recon', 'Find and photograph 4 random real buildings from the topo map.', 'Hold each building centered on screen or in the belly cam for 1.5 s. Targets change every run.'],
  strike: ['Vehicle strike', '5 vehicles: 3 real, 2 decoys. Hit only the real ones.', 'They look identical in daylight. In thermal (T) the real ones show engine heat. Hitting a decoy costs +20 s.'],
  fire: ['Wildfire watch', 'Smoke reports come in by radio with a bearing and a rough distance. Only a wide search area is marked, not the fire itself.', 'One report at a time: find the smoke column (it leans with the wind; at night look for the glow), switch to thermal (T), center the hotspot and press Enter / 📷 / A to photograph it. Report it and the next one comes in. After 150 s a fire spreads (+15 s).'],
  sar: ['Search & rescue', 'A hiker is missing near the trails. Only a wide search area is marked; the location changes every run.', 'Clues: his yellow pack near where he went missing, signal-mirror flashes (a flashlight at night), and body heat in thermal under the canopy. Center him and press Enter / 📷 / A to photograph and report. 2 rescue kits: drop one within 5 m.'],
  track: ['Vehicle tracking', 'Keep a car on a real road in view for 60 s without being spotted.', 'Being in the driver\'s view (ahead, low angle), close or low fills the exposure gauge; when it is full you are spotted (fail, -30, RTB). Stay behind it and high. At night turn your light off (L) to stay hidden.'],
  ridge: ['Ridge run', 'Climb to the summit along a DEM-derived ridge and come down another ridge.', 'Ridges are windy. Pass the rings in order.'],
  field: ['Field airstrip', 'Runway, taxiway and three H pads. Quads hop between the pads with precise landings; fixed wings fly a traffic pattern and land.', 'Land within 1.5 m of the pad centre, gently. Wings: take off, fly the pattern rings, land on the runway.']
} : {
  forest: ['숲 속 좁은 길', '주 경로 옆 숲 속에 낸 좁은 길을 따라 게이트·좁은 틈·쓰러진 나무를 지나 결승까지.', '나무 사이는 2~3 m. 수관 아래(지면 3 m 이하)로 낮게 날 것.'],
  race: ['계곡 타임 레이스', '계곡을 따라 놓인 링을 순서대로 최단 시간에 통과.', '부스트(BST)로 기체 최고 속도까지. 링을 놓치면 다음 링으로 넘어가며 1개당 +8초 벌점.'],
  recon: ['건물 정찰', '수치지형도에 있는 실제 건물 중 무작위 4곳을 찾아 촬영.', '건물을 화면 가운데나 아래 카메라에 1.5초 담기. 매번 대상이 바뀜.'],
  strike: ['차량 표적 타격', '차량 5대 중 실물은 3대, 나머지 2대는 기만체. 실물만 골라 돌입.', '가시광으로는 똑같음. 열화상(T)에서 엔진 열이 있는 차량이 실물. 기만체를 치면 +20초.'],
  fire: ['산불 감시', '무전으로 연기 신고가 방위·대략 거리로 들어옴. 지도에는 넓은 수색 구역만 표시되고 불 위치는 안 나옴.', '한 번에 한 곳씩: 바람에 기우는 연기 기둥(밤에는 불빛)을 찾아가 열화상(T)으로 불씨를 화면 가운데에 두고 Enter·📷·A 버튼으로 사진 보고. 보고하면 다음 신고가 들어옴. 150초가 지나면 번져서 +15초.'],
  sar: ['실종자 수색·구조', '등산로 근처 실종자 신고. 지도에는 넓은 수색 구역만 표시, 위치는 매번 다름.', '단서: 근처에 떨어진 노란 배낭, 신호 거울 반짝임(밤에는 손전등), 숲 아래 체온(열화상). 찾으면 화면 가운데에 두고 Enter·📷·A 버튼으로 사진 보고. 구조 키트 2개 · 5 m 안에 투하.'],
  track: ['차량 추적', '실제 도로를 달리는 차량을 들키지 않고 60초 동안 시야에 유지.', '운전자 시야(차 앞쪽·낮은 각도)·근접·저고도면 노출 게이지가 차고, 가득 차면 발각(실패·-30·복귀). 차 뒤쪽 높이 유지 권장. 밤에는 드론 조명을 끄면(L) 덜 들킴.'],
  ridge: ['능선 종주', 'DEM 분석으로 뽑은 능선을 따라 정상까지 올라갔다가 다른 능선으로 내려옴.', '능선은 바람이 셈. 링을 순서대로 통과.'],
  field: ['야전 착륙장', '활주로·유도로·H 패드 3개. 쿼드는 패드 사이를 옮겨 다니며 정밀 착륙, 고정익은 장주(트래픽 패턴)를 돌고 활주로 착륙.', '패드 가운데 1.5 m 안에 살살 내려앉기. 고정익: 이륙 → 장주 링 → 활주로 착륙.']
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
  if (typeof isC1 === 'function' && isC1(kind)) return;
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
    ridge: [`${CS}, CONTROL. Ridge run approved. Expect gusts on the crest. ${w}`, '능선 비행 승인. 능선 위 돌풍 주의.'],
    field: [`${CS}, CONTROL. Field strip is yours. ${AFc().cls === 'wing' ? 'Take off, fly the pattern and land on the runway.' : 'Hop the pads, land gently on the centre of each.'} ${w}`, AFc().cls === 'wing' ? '야전 착륙장 사용 승인. 이륙 후 장주 비행, 활주로 착륙.' : '야전 착륙장 사용 승인. 패드를 옮겨 다니며 가운데에 살살 착륙.']
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
const LY = { key: 'fpvsim_layout_' + (IS_TOUCH ? 'touch' : 'desk'), d: {}, edit: false, sel: null };
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
try { const v = localStorage.getItem('fpvsim_menu_ms'); if (v) MENU.ms = v; } catch (e) { }
const MS_CAT = { course: 'train', forest: 'train', race: 'train', ridge: 'train', field: 'train', tutorial: 'train', free: 'train', demo: 'train', recon: 'recon', track: 'recon', fire: 'rescue', sar: 'rescue', strike: 'strike' };
const CAT_C = { train: '#4fe3ff', recon: '#5dff9a', rescue: '#ffaa4d', strike: '#ff5d5d' };
const AF_C = { quad: '#5aa9ff', fpv: '#b48cff', wing: '#4fe3c0', kam: '#ff6a5d' };
const CAT_N = () => ({ train: L2('비행 훈련', 'FLIGHT TRAINING'), recon: L2('정찰·감시', 'RECON · SURVEILLANCE'), rescue: L2('재난·구조', 'DISASTER · RESCUE'), strike: L2('타격', 'STRIKE'), exam: L2('자격 시험 연습', 'LICENCE PRACTICE') });
const MDESC = () => ({
  course: [L2('장애물 코스', 'Obstacle course'), L2('게이트 · 슬라롬 · 벙커 · 정찰 · 투하 · 정밀 착륙까지 이어지는 기본 훈련 코스.', 'The core course: gates, slalom, bunker, recon, payload drops and a precision landing.'), L2('입문 난이도와 가이드로 익힌 뒤 스포츠에서 기록 단축.', 'Learn it on Training with the guide on, then chase your time on Sport.')],
  tutorial: [L2('튜토리얼', 'Tutorial'), L2('장애물 하나씩 설명을 보고 연습. 처음이라면 여기부터.', 'Practice one obstacle at a time with explanations. Start here if you are new.'), L2('정찰 쿼드(X2D)로만 진행.', 'Flown with the recon quad (X2D) only.')],
  free: [L2('자유 비행', 'Free flight'), L2('시간·목표 없이 지형과 기체를 익히는 비행.', 'No timer, no objectives: get to know the terrain and the airframe.'), L2('모든 기체 사용 가능. 열화상(T)·밤·바람도 시험해 보기.', 'Every airframe allowed. Try thermal (T), night and wind.')],
  demo: [L2('기준 비행 보기', 'Reference flight'), L2('장애물 코스를 모범 비행으로 자동 재생.', 'Watch an automatic reference run through the obstacle course.'), L2('경로와 고도를 눈에 익혀 두기.', 'Memorize the line and the altitudes.')]
});
function msInfo(k) { const b = BRIEF[k] || MDESC()[k] || [k, '', '']; return { t: b[0], d: b[1], tip: b[2] }; }
function msAvail(k) {
  const HAS = { forest: !!FLANE, race: RACE.length > 0, recon: RECON.length > 0, strike: STRIKE.length > 0, fire: FIRE.length > 0, sar: !!SAR, track: !!TRACK, ridge: !!RIDGE, field: !!RWY };
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
  let key = k === 'course' ? 'fpvsim_fpv_best_' + SET.diff + SITE_KEY : isMission(k) ? 'fpvsim_ms_best_' + k + '_' + SET.af + '_' + SET.diff + SITE_KEY : null, b = null;
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
const MS_GRP = ['basic', 'skill', 'mission'].concat(document.querySelector('#msTabs [data-g="exam"]') ? ['exam'] : []);
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
  try { localStorage.setItem('fpvsim_menu_ms', k); } catch (e) { }
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
try { SET.pilot = localStorage.getItem('fpvsim_pilot') || ''; } catch (e) { SET.pilot = ''; }
function pilotName() { return SET.pilot || L2('조종사', 'Pilot'); }
function wizGo(n) {
  n = Math.max(HAS_INTRO ? 0 : 1, Math.min(3, n | 0)); const c = $('menuCard'); if (!c) return;
  if (MENU.step === 1 && n > 1) { const v = ($('pilotName').value || '').trim().slice(0, 16); SET.pilot = v; try { localStorage.setItem('fpvsim_pilot', v); } catch (e) { } }
  MENU.step = n; c.dataset.step = n; closePanels();
  if (n === 1) { const i = $('pilotName'); i.value = SET.pilot || ''; setTimeout(() => { try { i.focus(); i.select(); } catch (e) { } }, 30); }
  if (n === 2) { afUI(); }
  if (n === 3 && typeof isC1 === 'function') { if (SET.af === 'c1' && !isC1(MENU.ms)) MENU.ms = 'class1'; else if (SET.af !== 'c1' && isC1(MENU.ms)) MENU.ms = 'course'; }   // 1종 연습기 → 1종 코스로
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
  const SALT = 'k7Qx2#range', MID = 5000, N = 12000, FIN = '667c6eac4841dacac28af88ce9febae877dcf0556f15edc5211601d0f51bb8eb', KEY = 'fpvsim_pin_ok', el = $('pinGate'); if (!el) return;
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
  if (typeof c1Menu === 'function') c1Menu(k);
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
  if (typeof isC1 === 'function' && isC1(k)) return { f: c1W(0, 22, 1.5), R: 36, h: 14, spd: 0.04 };
  const pd = CRS_C ? BY.pad_start.down : 60, ps = CRS_C ? BY.pad_start.side : 0, T = !!TER.h;
  const P = (d, s, y, R, h, spd) => ({ f: W(d, s, y), d, s, R, h, spd: spd || 0.06 });
  if (k === 'forest' && FLANE) { const q = FLANE.at(FLANE.total * 0.2); return P(q.d, q.s, 3, 16, 9, 0.05); }
  if (k === 'race' && RACE.length) { const r = RACE[4]; return P(r.q.d, r.q.s, r.alt, 34, 8); }
  if (k === 'field' && RWY) { const c = RWY.at(0, RWY.sg * 18); return P(-c.z, c.x, 8, 75, 32, 0.05); }
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
  catch (e) { try { renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(sess); XR.local = true; } catch (e2) { try { sess.end(); } catch (e3) { } XR.sess = null; renderer.xr.enabled = false; return; } }
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
// VR 스틱 모드: 쿼드·고정익 따로 기억 (고정익 기본 = 모드 1: 오른쪽 스틱 위아래가 스로틀)
function vrStickMode() { return AFc().cls === 'wing' ? (SET.vrModeW || 1) : (SET.vrMode || 2); }
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
  const vm = vrStickMode(); let st = vm === 1 ? { thr: ry, yaw: lx, pitch: ly, roll: rx } : { thr: ly, yaw: lx, pitch: ry, roll: rx };
  if (vm === 3) st = vrHeadSteer(dt, lx, ly, rx, ry);
  else IN.head = false;
  let any = false;
  for (const k in st) { const v = vm === 3 ? st[k] : stickCurve(st[k], 0.1, true); if (Math.abs(v) > Math.abs(IN[k])) { IN[k] = v; any = true; } }
  if (any) IN.src = 'VR';
  if (typeof isC1 === 'function' && isC1() && S.state !== 'result') { if (A) pressed.push('Enter'); if (B) vrMenuOpen(); if (Y) pressed.push('KeyY'); if (X) pressed.push('KeyE'); if (rt) pressed.push('KeyQ'); return; }   // 1종 연습 버튼
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
  row(y, L2('스틱', 'Sticks')); [[2, L2('모드 2', 'Mode 2')], [1, L2('모드 1', 'Mode 1')], [3, L2('머리 방향', 'Head steer')]].forEach(([v, n], i) => btn('mode:' + v, 190 + i * 200, y, 188, RW, n, vrStickMode() === v)); y += RH;
  row(y, L2('카메라', 'Camera')); [['fpv', 'FPV', SET.vrCam !== 'chase'], ['c0', L2('추적 멀리', 'Chase far'), SET.vrCam === 'chase' && (SET.zoom | 0) === 0], ['c1', L2('추적 보통', 'Chase mid'), SET.vrCam === 'chase' && (SET.zoom | 0) === 1], ['c2', L2('추적 가까이', 'Chase near'), SET.vrCam === 'chase' && (SET.zoom | 0) === 2]].forEach(([v, n, on], i) => btn('cam:' + v, 190 + i * 200, y, 188, RW, n, on)); y += RH;
  row(y, L2('하부 카메라', 'Lower cam')); [[0, L2('끔', 'Off')], [90, '90°'], [60, '60°'], [45, '45°']].forEach(([v, n], i) => btn('pip:' + v, 190 + i * 200, y, 188, RW, n, (SET.vrPip | 0) === v)); y += RH;
  row(y, L2('시간대', 'Time')); [['day', L2('낮', 'Day'), SET.tod === 'day' && !ENV.ir], ['dusk', L2('해질녘', 'Dusk'), SET.tod === 'dusk' && !ENV.ir], ['night', L2('밤', 'Night'), SET.tod === 'night' && !ENV.ir], ['ir', L2('열화상', 'Thermal'), !!ENV.ir]].forEach(([v, n, on], i) => btn('env:' + v, 190 + i * 200, y, 188, RW, n, on)); y += RH;
  row(y, L2('날씨', 'Weather')); [['clear', L2('맑음', 'Clear')], ['rain', L2('비', 'Rain')], ['snow', L2('눈', 'Snow')]].forEach(([v, n], i) => btn('wx:' + v, 190 + i * 200, y, 188, RW, n, (SET.wx || 'clear') === v)); btn('wxfx', 790, y, 188, RW, L2('기상 영향 ', 'Effects ') + (SET.wxFx ? L2('켬', 'on') : L2('끔', 'off')), !!SET.wxFx); y += RH;
  row(y, L2('표시', 'Display')); btn('scr:head', 190, y, 188, RW, L2('고글 화면', 'Goggles'), SET.vrScreen !== 'space'); btn('scr:space', 390, y, 188, RW, L2('공간 화면', 'Fixed screen'), SET.vrScreen === 'space');
  btn('map', 590, y, 188, RW, SET.vrMap === false ? L2('지도 끔', 'Map off') : MAPZ.on ? L2('지도 전체', 'Map: all') : L2('지도', 'Map'), SET.vrMap !== false); btn('guide', 790, y, 188, RW, L2('경로 안내', 'Guide'), !!SET.guide); y += RH;
  row(y, L2('스틱 반응', 'Stick feel')); [['real', L2('실기체 (선형)', 'Real (linear)')], ['soft', L2('부드럽게 (엑스포)', 'Soft (expo)')]].forEach(([v, n], i) => btn('expo:' + v, 190 + i * 200, y, 188, RW, n, stickExpo(true) === v)); y += RH;
  row(y, L2('계기', 'Instruments')); [['auto', L2('자동', 'Auto')], ['fpv', L2('간단 (FPV)', 'Simple (FPV)')], ['uas', L2('항공 (UAS)', 'Aviation (UAS)')]].forEach(([v, n], i) => btn('hud:' + v, 190 + i * 200, y, 188, RW, n + (v === 'auto' ? ' · ' + (hudMode() === 'uas' ? 'UAS' : 'FPV') : ''), (SET.hud || 'auto') === v)); y += RH + 4;
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '500 19px system-ui, sans-serif';
  g.fillText((AFc().cls === 'wing' ? L2('[고정익] ', '[Fixed-wing] ') : '') + (vrStickMode() === 3 ? L2('머리 방향: 보는 쪽으로 비행 · 왼쪽 스틱 앞뒤 속도 · 오른쪽 스틱 옆·고도', 'Head steer: fly where you look · L-stick fwd/back speed · R-stick side·height') : vrStickMode() === 2 ? L2('모드 2: 왼쪽 스틱 상승·회전 / 오른쪽 스틱 전후·좌우', 'Mode 2: left stick climb·yaw / right stick fwd·side') : L2('모드 1: 왼쪽 스틱 전후·회전 / 오른쪽 스틱 상승·좌우', 'Mode 1: left stick fwd·yaw / right stick climb·side')), 36, y);
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
  if (id === 'map') { if (SET.vrMap === false) { SET.vrMap = true; mapZoom(false); } else if (!MAPZ.on) mapZoom(true); else { mapZoom(false); SET.vrMap = false; } saveSet(); return; }   // 지도 → 전체 → 끔
  if (id === 'guide') { SET.guide = !SET.guide; saveSet(); return; }
  if (id.startsWith('diff:')) { SET.diff = id.slice(5); saveSet(); return; }
  if (id.startsWith('mode:')) { if (AFc().cls === 'wing') SET.vrModeW = +id.slice(5); else SET.vrMode = +id.slice(5); saveSet(); return; }
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
  if (SET.vrPip) sh(L2('하부 ', 'LOWER ') + SET.vrPip + '°', 26, H2 - 282, 22, '#ffc828');   // 글자 위쪽 기준 · 하부 카메라 창(위쪽 끝 y≈471) 위로 띄워서 가리지 않게
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
  if (typeof c1VRon === 'function' && c1VRon()) { VR_SCR.visible = false; renderer.shadowMap.autoUpdate = false; if (XR.frames % 2 === 0) renderer.shadowMap.needsUpdate = true; c1XRUpdate(dt); return; }   // 1종: 조종자 자리에서 맨눈 · 그림자 2프레임에 한 번   // 1종: 조종자 자리에서 맨눈 (고글 화면 없음)
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
Object.assign(window.__sim, { RWY, rwyLocal, rwyApproach, msObj, setWxFx, wxSense, SNOW_U, setTod, setWx, WX, SAR_POOL, MAPV, mxy, trackPose, debriefShow, DBF, RV, rvPlan, rvNorm, VID, exportReplayVideo, RP, getLastRec: () => LAST_REC, VR_MAP, vrMenuOpen, commEngine, TTSW, commSpeak, VR_PIP_RT: VR_PIP.rt, ENV, XR, VRS, VR_MENU, VR_OSD, VR_SCR, VR_RT, vrMenuClick, vrMenuHit, vrStart, vrStop, xrInput, VR_OK, getXR: () => XR_ON, DAMS, MENU, menuSel, menuGo, menuTab, LY, lyEdit, lyApply, comm, grid, COMM, WIND, windAt, SAR, TRACK, RIDGE, FIRE, irSet, ENV, envApply, AF, setAirframe, MS, msObj, FLANE, RACE, RECON, STRIKE, effMode });
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
  const HW = { segDiff: {   // 고정익일 때 설명
    train: ['자동조종: 고도·속도 유지, 지형 회피, 실속 보호 · 기울기 35°까지', 'Autopilot: holds height and speed, avoids terrain, stall protection · bank ≤35°'],
    easy: ['자동조종 + 최대 기울기 · 느릴 땐 실속 안 나게 기울기 제한', 'Autopilot with full bank · bank limited at low speed to prevent stall'],
    atti: ['자세 안정 수동: 놓으면 수평 · 스로틀 직접 · 고도 유지·실속 보호 없음', 'Stabilised manual: levels when released · direct throttle · no height hold or stall protection'],
    sport: ['완전 수동: 놓아도 기운 채 유지 · 실속·스핀 가능', 'Full manual: stays banked when released · stalls and spins possible'] } };
  const segV = id => { const b = $(id) && $(id).querySelector('button.on'); return b ? b.dataset.v : null; };
  const segT = id => { const b = $(id) && $(id).querySelector('button.on'); return b ? b.textContent.replace(/\s*\(.*\)\s*$/, '').trim() : '—'; };
  Object.keys(H).forEach(id => { const s = $(id); if (!s) return; const h = document.createElement('small'); h.className = 'oh'; h.dataset.for = id; s.parentNode.insertBefore(h, s.nextSibling); });
  // 빠른 설정 (코스 고르는 화면)
  const QS = [['segDiff', '🎚', '난이도', 'Mode'], ['segWind', '💨', '바람', 'Wind'], ['segWxFx', '⛈', '기상 영향', 'Weather fx'], ['segHud', '📟', '계기', 'HUD'], ['segGuide', '🧭', '가이드', 'Guide'], ['segVoice', '🔊', '음성', 'Voice']];
  const bar = $('qsBar');
  const draw = () => {
    P.querySelectorAll('small.oh').forEach(h => { const m = (AFc().cls === 'wing' && HW[h.dataset.for]) || H[h.dataset.for], v = segV(h.dataset.for), t = m && m[v]; h.textContent = t ? L2(t[0], t[1]) : ''; });
    if (bar) bar.querySelectorAll('button[data-s]').forEach(b => { b.querySelector('b').textContent = segT(b.dataset.s); const m = (AFc().cls === 'wing' && HW[b.dataset.s]) || H[b.dataset.s], t = m && m[segV(b.dataset.s)]; b.title = t ? L2(t[0], t[1]) : ''; });
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
// =====================================================================
//  무인멀티콥터 1종 실기시험 기준 참고 연습 (민간 · 연습용, 공식 시험 아님)
//  - 기준 문서: 한국교통안전공단 실기시험 표준서(무인멀티콥터) 2025.7.18 개정
//               무인멀티콥터(1종) 실기시험 세부평가기준(화성드론자격센터 표기) 2025.9.9 개정
//  - 공식값과 앱 잠정 설정을 C1RULES 에 분리해 둠 (src: 'official' | 'app')
// =====================================================================
const C1RULES = {
  ver: 'c1-rules-0.1',
  docs: [
    { id: 'pts', ko: '무인비행장치 조종자 증명 실기시험 표준서(무인멀티콥터)', rev: '2025.7.18', from: '한국교통안전공단 자료실 묶음(2025.10.13 표기)' },
    { id: 'c1', ko: '무인멀티콥터(1종) 실기시험 세부 평가기준', rev: '2025.9.9', from: '같은 묶음 · 문서 표지에 화성드론자격센터 표기' }
  ],
  // 공식값 (세부평가기준 공동사항·기동별 기준)
  posTol: { v: 1.0, u: 'm', src: 'official' },          // 기체 중심 ±1 m · 이동 경로 좌우/전후 각 1 m(폭 2 m)
  refMin: { v: 3, u: 'm', src: 'official' }, refMax: { v: 5, u: 'm', src: 'official' },   // 기준고도 3~5 m (스키드)
  altTol: { v: 0.5, u: 'm', src: 'official' },          // 기준고도 ±0.5 m (기동별 제시 고도에도 적용)
  hdgTol: { v: 15, u: 'deg', src: 'official' }, hdgTolEmg: { v: 45, u: 'deg', src: 'official' },
  hoverT: { v: 5, u: 's', src: 'official' }, hoverTE: { v: 3, u: 's', src: 'official' },   // 정지 5 s 이상 · E 지점 3 s 이상
  stopShort: { v: 3, u: 's', src: 'official' },         // 3 s 미만 멈춤 2회 이상 또는 3 s 이상 1회 → U
  pauseEmg: { v: 3, u: 's', src: 'official' }, pauseEmgAlt: { v: 1, u: 'm', src: 'official' },
  eAlong: { v: 5, u: 'm', src: 'official' },            // E 지점 전후 5 m 까지 인정
  triRise: { v: 7.5, u: 'm', src: 'official' }, emgRise: { v: 2, u: 'm', src: 'official' },
  emgRatio: { v: 1.5, u: '×', src: 'official' },        // 비상 강하 속도 ≥ 일반 기동 속도 × 1.5
  takeoffLimit: { v: 300, u: 's', src: 'official' },    // 시동·이륙 5분 이내
  safeR: { v: 14, u: 'm', src: 'official' },            // 권고 안전거리 (조종자 중심 반경)
  // 앱 잠정 판정값 (공식 수치 없음 · 교관 검수 필요)
  stillV: { v: 0.35, u: 'm/s', src: 'app' },           // 이 속도 미만이면 '정지'로 봄
  stillYaw: { v: 6, u: 'deg/s', src: 'app' },
  stopV: { v: 0.3, u: 'm/s', src: 'app' },             // 이동 중 이 속도 미만 = 멈춤
  grace: { v: 2.0, u: 's', src: 'app' },               // 허용범위를 이 시간 넘게 연속 이탈하면 '지속 이탈'(U)
  arriveT: { v: 0.3, u: 's', src: 'app' },
  emgRefDefault: { v: 0.6, u: 'm/s', src: 'app' },     // 일반 강하 속도 측정값이 없을 때 쓰는 기준
  emgPadSkid: { v: '스키드 사각형 0.9×1.1 m', src: 'app' },
  triHdg: { v: '전방 유지', src: 'official' }
};
const c1R = k => C1RULES[k].v;

// ---- 기체: 1종 연습용 대형 멀티콥터 (가정값 · 실기체 보정 전) ----
// 특정 제조사·모델 아님. 질량·추력·관성(회전 응답)·항력·모터 응답을 따로 둔 최소 모델.
const C1P = {
  ver: 'c1p-0.1', label: { ko: '1종 연습용 대형 멀티콥터', en: 'Class-1 practice multicopter' },
  selfKg: { v: 22, u: 'kg', a: true, note: '자체중량(연료·배터리 제외 정의는 기체별 확인 필요)' },
  mtowKg: { v: 30, u: 'kg', a: true, note: '최대이륙중량 · 법령 1종 구분(25 kg 초과)은 이 값 기준' },
  flightKg: { v: 27, u: 'kg', a: true, note: '현재 시뮬레이션 비행질량 (배터리 포함 가정)' },
  thrustMaxN: { v: 530, u: 'N', a: true, note: '총 최대 추력 (≈ 비행질량의 2.0배 무게)' },
  tauMotor: { v: 0.12, u: 's', a: true, note: '모터·추력 1차 응답 시간' },
  tauAtt: { v: 0.32, u: 's', a: true, note: '자세(기울기) 응답 시간 — 관성·자세제어 이득을 합친 근사' },
  attRate: { v: 80, u: 'deg/s', a: true, note: '기울기 변화 속도 한계' },
  tiltMax: { v: 25, u: 'deg', a: true, note: 'ATTI·수동 최대 기울기' },
  tiltGps: { v: 18, u: 'deg', a: true, note: 'GPS 모드 최대 기울기' },
  yawMax: { v: 70, u: 'deg/s', a: true }, tauYaw: { v: 0.25, u: 's', a: true, note: '기수 회전 응답 (요 관성 근사)' },
  cdA: { v: 0.55, u: 'm²', a: true, note: '항력계수×투영면적 (수평)' }, cdAv: { v: 1.1, u: 'm²', a: true, note: '수직 방향' },
  rho: { v: 1.2, u: 'kg/m³', a: false },
  rotorDrag: { v: 0.15, u: '1/s', a: true, note: '프로펠러 선형 항력 (공기에 대한 수평 속도에 비례)' },
  gpsV: { v: 5, u: 'm/s', a: true, note: 'GPS 모드 최대 수평 속도 명령' },
  climb: { v: 3.0, u: 'm/s', a: true }, sink: { v: 2.5, u: 'm/s', a: true, note: '고도유지 모드 상승·하강 속도 명령 한계' },
  skidDrop: { v: 0.30, u: 'm', a: true, note: '기체 중심 → 스키드 바닥 높이' },
  skidLen: { v: 1.1, u: 'm', a: true }, skidSpan: { v: 0.9, u: 'm', a: true },
  hardSink: { v: 1.2, u: 'm/s', a: true, note: '이 속도 넘게 접지하면 거친 착륙 기록' }, crashSink: { v: 2.6, u: 'm/s', a: true }, crashHs: { v: 2.5, u: 'm/s', a: true },
  eye: { v: 1.6, u: 'm', a: true, note: '조종자 눈높이 (화면 설정)' },
  notModeled: ['배터리 전압 강하', '지면효과', '프로펠러 후류·와류고리', '모터 고장', '자이로·GPS 오차', '실제 비행제어기 이득']
};
const c1p = k => C1P[k].v;

AF.c1 = { tag: 'C1', name: L2('1종 연습기', 'Class-1 trainer'), sub: L2('대형 멀티콥터 · 1종 실기시험 연습용', 'Large multicopter · class-1 practical practice'), cls: 'quad', c1: true,
  top: 10, vmax: { train: 5, easy: 5, sport: 10 }, tilt: { train: 18, easy: 18, sport: 25 }, climb: 2, sink: 1.5, yaw: 70, tw: 2.0, R: 0.75, endur: 20,
  note: L2('1종 실기 연습 전용 · ※ 제원·비행 특성은 실제 기체 정보가 아닙니다', 'Class-1 practice only · ※ specs and handling are not real aircraft data') };
AF.c1.id = 'c1'; AF_IDS.push('c1');
MS_OK.class1 = ['c1']; MS_OK.class1x = ['c1']; MS_OK.class1d = ['c1'];
MS_NAME.class1 = L2('1종 실기 학습', 'Class-1 practice (learn)'); MS_NAME.class1d = L2('1종 시범비행', 'Class-1 demo flight'); MS_NAME.class1x = L2('1종 모의평가', 'Class-1 mock check');
MS_CAT.class1 = MS_CAT.class1x = MS_CAT.class1d = 'exam'; CAT_C.exam = '#c9a2ff';
const C1DISC = () => L2('※ 기체 제원과 비행 특성은 실제 기체 정보가 아닌 연습용 설정입니다.', '※ Aircraft specs and handling are practice settings, not real aircraft data.');
BRIEF.class1 = [L2('무인멀티콥터 1종 실기 · 학습', 'Unmanned multicopter class 1 · learn'),
  L2('평탄 시험장에서 이륙·호버링·전후진·삼각·원주·비상·정상접근·측풍접근 순서로 연습합니다. 경로·허용구역·타이머를 보여 줍니다.', 'Practise takeoff, hover, forward/back, triangle, circle, emergency, normal and crosswind approach on a flat test field, with path, tolerance box and timers shown.'),
  L2('영인산 야전 착륙장 옆 시험장 · 시험위원 방송(기기 음성) · 🗣 내 구호(Q · 기기 음성이 대신 외침) · 🎤 직접 말하면 음성인식 · 다음 ▶(Enter) · GPS 스위치(H) · 🚨 비상(E) · 시점(C) · 시야 넓게/좁게(Z) · 기체 등: 앞 초록 · 뒤 빨강, 조명(L) 켜면 흰 섬광 · 공식 시험·교육시간 인정 여부는 확인되지 않았습니다.', 'Test field beside the Yeonginsan airstrip · examiner announcements (device voice) · 🗣 MY CALL (Q · device voice) · 🎤 say it yourself (speech recognition) · NEXT ▶ (Enter) · GPS switch (H) · 🚨 EMER (E) · VIEW (C) · view width (Z) · nav lights: green front · red rear, light (L) adds a white strobe · Not an official test or training hours.') + ' ' + C1DISC()];
BRIEF.class1x = [L2('무인멀티콥터 1종 · 모의평가', 'Unmanned multicopter class 1 · mock check'),
  L2('호명·비행 전 점검·조종기 점검·시동부터 전체 기동, 구술 5문항까지 실제 시험 순서로 진행하고 항목별 S/U 모의판정을 받습니다. 공중경계·판단력은 미평가로 남습니다.', 'Run the real order — call-up, pre-flight and transmitter checks, start, all manoeuvres and a 5-question oral — and get a per-item S/U mock verdict. Lookout and judgement stay unrated.'),
  L2('모의판정은 앱 기준이며 합격·자격 판정이 아닙니다.', 'Mock verdicts follow app rules; they are not a pass or a certificate.') + ' ' + C1DISC()];
BRIEF.class1d = [L2('무인멀티콥터 1종 · 시범비행', 'Unmanned multicopter class 1 · demo flight'),
  L2('자동 조종으로 시험 전체 순서를 보여 줍니다. 시험위원 지시, 응시자 구호, 정지 5초 세기, 각 기동의 관전 포인트를 화면 위에 안내합니다. 직접 조종할 필요는 없습니다.', 'An autopilot flies the whole test order: examiner instructions, candidate calls, the 5-second hold count, and what to watch in each manoeuvre are shown on screen. No flying needed.'),
  L2('시점(C) · 시야(Z) · 일시정지(Esc) · 숫자키로 기동 건너뛰기. 시범은 앱의 연습 기준으로 비행하며 실제 시험의 모범답안이 아닙니다.', 'View (C) · width (Z) · pause (Esc) · number keys jump to a manoeuvre. The demo flies to the app\'s practice rules; it is not an official model answer.') + ' ' + C1DISC()];
function isC1(k) { k = k || S.kind; return k === 'class1' || k === 'class1x' || k === 'class1d'; }

// ---- 시험장 좌표 (u = 조종자 오른쪽, v = 전방, 단위 m) ----
// 세부평가기준 배치도: P→H 15 m, H→A 7.5 m, A→E 40 m, A→B·D 7.5 m, F 는 H 와 같은 줄의 좌·우 7.5 m, H·F 2×2 m
var C1S = { x: 14000, z: 14000, y: 0, h: 0, real: false };   // h: 전방(v) 방위 · real: 실제 지형 위에 다져 넣은 시험장
const C1PT = { P: [0, 0], H: [0, 15], A: [0, 22.5], B: [-7.5, 22.5], C: [0, 30], D: [7.5, 22.5], E: [0, 62.5], FB: [-7.5, 15], FD: [7.5, 15] };
const C1FIELD = { u0: -17.5, u1: 17.5, v0: -2.4, v1: 77.6, src: 'app' };   // 80×35 m 부지 경계 (P 와 경계 사이 여백은 앱 설정)
function c1W(u, v, h) { const fx = Math.sin(C1S.h), fz = -Math.cos(C1S.h), rx = Math.cos(C1S.h), rz = Math.sin(C1S.h); return new V3(C1S.x + rx * u + fx * v, C1S.y + (h || 0), C1S.z + rz * u + fz * v); }
function c1UV(p) { const dx = p.x - C1S.x, dz = p.z - C1S.z; return [dx * Math.cos(C1S.h) + dz * Math.sin(C1S.h), dx * Math.sin(C1S.h) - dz * Math.cos(C1S.h)]; }
function c1Gnd() { return C1S.real ? groundAt(DR.p.x, DR.p.z) : C1S.y; }
// ---- 영인산 야전 착륙장 옆에 시험장 자리 찾기: 80×35 m(+여백) 가 가장 평평하고, 활주로·계류장·코스 물체와 겹치지 않는 곳 → 지형을 그 높이로 다짐 ----
function c1Place() {
  try {
    if (!RWY || !TER.h || window.SIM_C1_FAR) return false;
    const ap = RWY.at(0, RWY.sg * (RWY.Wd / 2 + 40)), n = TER.n, st = TER.step, hu = 22.5, v0 = -10, v1 = 85;   // 다질 범위 (u ±22.5, v -10~85)
    const inTer = (x, z) => { const fx = (x - GS0) / st, fy = (GD1 + z) / st; return fx > 3 && fy > 3 && fx < n - 4 && fy < n - 4; };
    const rl = p => rwyLocal(p);
    let best = null;
    for (let R = 50; R <= 260; R += 15) for (let a = 0; a < 360; a += 15) for (let hd = 0; hd < 360; hd += 15) {
      const h = hd * DEG, fx = Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = Math.sin(h);
      const px = ap.x + Math.sin(a * DEG) * R, pz = ap.z - Math.cos(a * DEG) * R;   // P(조종자) 위치
      const W2 = (u, v) => [px + rx * u + fx * v, pz + rz * u + fz * v];
      if (Math.hypot(px - FLY_C.x, pz - FLY_C.z) > FLY_R_SAFE - 120) continue;
      let ok = true, mn = 1e9, mx = -1e9, sum = 0, cnt = 0, tr = 0;
      for (let v = v0; v <= v1 && ok; v += 5) for (let u = -hu; u <= hu; u += 5) {
        const [x, z] = W2(u, v); if (!inTer(x, z)) { ok = false; break; }
        const q = rl({ x, z }); if (Math.abs(q.t) < RWY.L / 2 + 175 && Math.abs(q.w) < 20) { ok = false; break; }   // 활주로·접근로
        if (q.w * RWY.sg > RWY.Wd / 2 - 2 && q.w * RWY.sg < RWY.Wd / 2 + 66 && Math.abs(q.t) < 36) { ok = false; break; }   // 유도로·계류장
        const y = terrainAt(x, z); mn = Math.min(mn, y); mx = Math.max(mx, y); sum += y; cnt++;
        _c1r.set(x, y + 1.5, z); if (collide(_c1r, 2)) { ok = false; break; }
        if (STREES.col && STREES.col(_c1r.set(x, y + 3, z), 1.5)) tr++;
      }
      if (!ok) continue;
      // 조종자(P)가 계류장 쪽을 등지고 서도록: P 가 시험장 끝(계류장에 가까운 쪽)에 오게
      const [cx, cz] = W2(0, 37.6), dP = Math.hypot(px - ap.x, pz - ap.z), dC = Math.hypot(cx - ap.x, cz - ap.z);
      if (dP > dC) continue;
      const sc = (mx - mn) * 1.0 + tr * 0.04 + R * 0.01;
      if (!best || sc < best.sc) best = { sc, px, pz, h, y: sum / cnt, range: mx - mn };
    }
    if (!best || best.range > 14) return false;
    // 지형 다짐: 안쪽은 평평하게, 바깥 18 m 는 원래 지형으로 부드럽게 이어짐 (흙 비탈)
    const { px, pz, h } = best, fx = Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = Math.sin(h), mg = 18;
    let ys = []; for (let v = v0; v <= v1; v += 5) for (let u = -hu; u <= hu; u += 5) ys.push(terrainAt(px + rx * u + fx * v, pz + rz * u + fz * v));
    ys.sort((a, b) => a - b); const y0 = ys[ys.length >> 1];
    const H = TER.h; let changed = 0;
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const x = GS0 + ix * st, z = -GD1 + iy * st, dx = x - px, dz = z - pz, u = dx * rx + dz * rz, v = dx * fx + dz * fz;
      const ou = Math.max(0, Math.abs(u) - hu), ov = Math.max(0, v0 - v, v - v1), o = Math.hypot(ou, ov); if (o >= mg) continue;
      const k = o <= 0 ? 1 : 1 - smooth01(0, 1, o / mg); const i = iy * n + ix; H[i] = H[i] * (1 - k) + y0 * k; changed++;
    }
    applyTerrain(H);
    if (STREES.hideRect) { const c = [px + fx * 37.6, pz + fz * 37.6]; STREES.hideRect(c[0], c[1], fx, fz, (v1 - v0) + 2 * mg, 2 * hu + 2 * mg);
      const c2 = [px + fx * 135, pz + fz * 135]; STREES.hideRect(c2[0], c2[1], fx, fz, 90, 110); }   // 기체 뒤 배경 나무를 더 멀리 (조종자 시야에서 기체가 나무에 묻히지 않게)
    Object.assign(C1S, { x: px, z: pz, y: y0, h, real: true, range: +best.range.toFixed(1), cells: changed });
    return true;
  } catch (e) { console.warn('class1 site', e); return false; }
}

var C1 = { on: false, exam: false, side: -1, mode: 'gps', view: 'pilot', armed: false, ref: null, refDesc: null, mi: 0, si: 0, M: [], ev: [], t: 0, az: 0, yr: 0, hold: null, ei: new V3(), touch: null, over: false };

// ---- 기동 정의 ----
// 단계 종류: prep(확인) · arm · climb(이륙 상승·기준고도) · hold · move · arc · callout · emg · land · disarm · xfer(평가 제외 이동)
function c1Build(side) {
  const L = side < 0, s = side, P = C1PT, SB = L ? P.B : P.D, SD = L ? P.D : P.B, F = L ? P.FB : P.FD;
  const nm = (ko, en) => L2(ko, en), sideKo = L ? '좌' : '우', sideEn = L ? 'left' : 'right', oKo = L ? '우' : '좌', oEn = L ? 'right' : 'left';
  const H0 = (at, hdg, T, lab, o) => Object.assign({ k: 'hold', at, r: 0, hdg, T: T || c1R('hoverT'), lab }, o || {});
  // 구호(call): 교육원 게시판 "드론 비행 구호" 순서를 따름 (교육 현장 관행 · 공식 기준서 아님) · '비상'만 기준서 필수 · 나머지는 기록만
  // count: 버튼으로 구호하면 정지 지점 도착 때 "정지" → 1초마다 하나~다섯 · after: 그 기동을 마칠 때 덧붙이는 "…완료"
  const C = (ko, en, kw, count, after) => ({ ko, en, kw, count: !!count, after: after || null });
  const STOP = (pre, preEn, after) => C(pre || '', preEn || '', pre ? ['정지', '하나', '다섯', pre.split(' ')[0]] : ['정지', '하나', '다섯'], true, after);
  const A = (ko, en) => ({ k: 'ann', ko, en, lab: nm('시험위원 지시', 'Examiner instruction') });   // 시험위원 방송 (앱 작성 문구 · 끌 수 있음)
  const nB = L ? 'B' : 'D', nD = L ? 'D' : 'B', clkA = L ? '9시' : '3시', clkB = L ? '3시' : '9시', clkAen = L ? '9 o\'clock' : '3 o\'clock', clkBen = L ? '3 o\'clock' : '9 o\'clock';
  const air = () => { const w = c1WindInfo(); return C(`좌측 숲, 전방 산, 우측 숲 이상무, ${w.sp ? `풍향 ${w.dirKo}, 풍속 ${w.sp}미터` : '풍향 및 풍속 무풍'}, 전방시계 300미터 확보, 공역확인 완료`, `Left: trees, front: hills, right: trees, clear. ${w.sp ? `Wind ${w.dirEn}, ${w.sp} metres per second` : 'Wind calm'}. Visibility 300 metres. Airspace check complete`, ['공역', '이상무', '시계'], false); };
  return [
    { id: 'pre', name: nm('비행 전 절차', 'Pre-flight'), steps: [
      A(`응시자 ${pilotName()}, 조종자 위치로 이동하여 비행 전 점검을 실시하십시오.`, `Candidate ${pilotName()}, go to the pilot position and carry out the pre-flight inspection.`),
      { k: 'inspect', lab: nm('비행 전 기체점검: 항목마다 정상/불량 판정', 'Pre-flight aircraft check: judge each item OK / faulty'), call: C('배터리 설치, 프로펠러, 모터, 모터베이스, 변속기 이상무, 암대, 메인프레임, 랜딩스키드 이상무', 'Battery installed. Propellers, motors, motor mounts, ESCs OK. Arms, main frame, landing skids OK', ['프로펠러', '이상무']) },
      { k: 'rc', lab: nm('조종기 점검: 구호하면 다음으로 (스틱 끝까지 움직여 보기는 선택) · 모드 스위치 GPS', 'Transmitter check: make the call to move on (full stick travel optional) · mode switch GPS'), call: C('안테나, GPS 모드, 조이스틱 이상무, 조종기 ON, 기체배터리 연결, 조종기 화면 작업 실행, GPS 수신 완료, 아워메타 확인, 비행 전 기체점검 완료, 조종자 위치로', 'Antenna, GPS mode, sticks OK. Transmitter on, flight battery connected, ground-station task running, GPS fix complete, hour meter checked. Pre-flight check complete. To the pilot position', ['조이스틱', '기체점검', '완료', '조종자']) },
      { k: 'prep', lab: nm('공역 확인 (좌·전방·우·바람·시계) · 구호 또는 Enter', 'Airspace check (left, front, right, wind, visibility) · call or Enter'), call: air() },
      { k: 'arm', csc: true, lab: nm('시동: 두 스틱을 아래 안쪽(또는 바깥쪽)으로 · 또는 Enter', 'Start: both sticks down-in (or down-out) · or Enter'), call: C('시동', 'Start', ['시동']) }] },
    { id: 'to', name: nm('이륙비행 · 이륙 후 기체점검', 'Takeoff · after-takeoff check'), ann: ['이륙하십시오.', 'Take off.'], steps: [
      { k: 'climb', at: P.H, lab: nm('H 에서 수직 상승 → 3~5 m 에서 정지 (기준고도 설정)', 'Climb vertically from H → stop at 3–5 m (sets reference height)'), call: C('이륙', 'Takeoff', ['이륙']) },
      H0(P.H, 0, 0, nm('정지 (기준고도)', 'Hold (reference height)'), { posWatch: true, call: STOP('', '') }),
      { k: 'ctl', at: P.H, lab: nm('이륙 후 기체점검: 구호하면 다음으로 (엘리베이터·에일러론·러더를 살짝 움직여 보기 권장)', 'After-takeoff check: make the call to move on (small elevator, aileron, rudder inputs recommended)'), call: C('엘리베이터 이상무, 에일러론 이상무, 러더 이상무, 이륙 후 기체점검 완료', 'Elevator OK, aileron OK, rudder OK. After-takeoff check complete', ['엘리베이터', '러더', '점검', '완료']) },
      { k: 'xfer', to: P.A, lab: nm('호버링 위치(A)로 이동 (평가 제외)', 'Move to the hover point A (not scored)'), call: C('호버링 위치로', 'To the hover point', ['호버링', '위치']) }] },
    { id: 'hov', name: nm('좌우측 호버링', 'Side hovering'), ann: ['좌우측 호버링을 실시하십시오.', 'Carry out the side hovering.'], steps: [
      H0(P.A, 0, 0, nm('A 에서 기준고도·기수 전방 정지', 'Hold at A, reference height, nose forward'), { call: STOP('', '') }),
      H0(P.A, 90 * s, 0, nm(`${sideKo}로 90° 회전 → 정지`, `Turn 90° ${sideEn} → hold`), { posWatch: true, rot: true, call: STOP(`${sideKo}측 호버링`, `${L ? 'Left' : 'Right'} side hover`) }),
      H0(P.A, -90 * s, 0, nm(`${oKo}로 180° 회전 → 정지`, `Turn 180° ${oEn} → hold`), { posWatch: true, rot: true, call: STOP(`${oKo}측 호버링`, `${L ? 'Right' : 'Left'} side hover`) }),
      H0(P.A, 0, 0, nm(`${sideKo}로 90° 회전해 기수 전방 → 정지`, `Turn 90° ${sideEn} to face forward → hold`), { posWatch: true, rot: true, call: STOP('기수 전방', 'Nose forward', ['좌우측 호버링 완료', 'Side hovering complete']) })] },
    { id: 'fb', name: nm('전진 및 후진 수평비행', 'Forward & backward'), ann: ['전진 및 후진 수평비행을 실시하십시오.', 'Carry out level forward and backward flight.'], steps: [
      { k: 'move', from: P.A, to: P.E, hdg: 0, lab: nm('A → E 40 m 수평 전진', 'A → E, 40 m forward'), alongTol: c1R('eAlong'), call: C('전진', 'Forward', ['전진']) },
      H0(P.E, 0, c1R('hoverTE'), nm('E 정지 3초 이상 (전후 5 m 인정)', 'Hold at E ≥ 3 s (±5 m along)'), { alongTol: c1R('eAlong'), call: STOP('', '') }),
      { k: 'move', from: P.E, to: P.A, hdg: 0, lab: nm('E → A 40 m 수평 후진 (기수 전방)', 'E → A, 40 m backward (nose forward)'), call: C('후진', 'Backward', ['후진']) },
      H0(P.A, 0, 0, nm('A 정지', 'Hold at A'), { call: STOP('', '', ['전진 및 후진 수평비행 완료', 'Forward and backward flight complete']) })] },
    { id: 'tri', name: nm('삼각비행', 'Triangle'), ann: ['삼각비행을 실시하십시오.', 'Carry out the triangle.'], steps: [
      { k: 'move', from: P.A, to: SB, hdg: 0, lab: nm(`A → ${nB} 수평 이동`, `A → ${nB} level`), call: C(`${clkA}방향으로 이동`, `Moving to ${clkAen}`, ['방향', '이동']) },
      H0(SB, 0, 0, nm('정지', 'Hold'), { call: STOP('', '') }),
      { k: 'move', from: SB, to: P.A, r1: c1R('triRise'), hdg: 0, lab: nm('A 상공 기준고도+7.5 m 로 45° 상승', '45° climb to reference +7.5 m above A'), call: C('호버링 위치로 상승', 'Climbing to the hover point', ['상승']) },
      H0(P.A, 0, 0, nm('정지 (최고점)', 'Hold (apex)'), { r: c1R('triRise'), call: STOP('', '') }),
      { k: 'move', from: P.A, r0: c1R('triRise'), to: SD, hdg: 0, lab: nm(`${nD} 로 45° 하강`, `45° descent to ${nD}`), desc: true, call: C(`${clkB} 방향으로 하강`, `Descending to ${clkBen}`, ['하강']) },
      H0(SD, 0, 0, nm('정지', 'Hold'), { call: STOP('', '') }),
      { k: 'move', from: SD, to: P.A, hdg: 0, lab: nm('A 로 수평 이동', 'Level to A'), call: C('호버링 위치로 이동', 'Back to the hover point', ['호버링', '이동']) },
      H0(P.A, 0, 0, nm('정지', 'Hold'), { call: STOP('', '', ['삼각비행 완료', 'Triangle complete']) }),
      { k: 'xfer', to: P.H, lab: nm('H 로 후진 이동 (평가 제외)', 'Back up to H (not scored)') }] },
    { id: 'cir', name: nm('원주비행 (러더턴)', 'Circle (rudder turn)'), ann: ['원주비행을 실시하십시오.', 'Carry out the circle.'], steps: [
      H0(P.H, 0, 0, nm('H 상공 기준고도·기수 전방 정지', 'Hold over H, nose forward'), { call: STOP('원주비행 위치로', 'To the circle position') }),
      H0(P.H, 90 * s, 0, nm(`기수 ${sideKo}로 90° → 정지`, `Nose 90° ${sideEn} → hold`), { posWatch: true, rot: true, call: STOP('원주비행 준비', 'Circle, ready') }),
      { k: 'arc', c: P.A, R: 7.5, dir: s, start: P.H, lab: nm(`반경 7.5 m 원주: H → ${nB} → C → ${nD} → H`, `7.5 m circle: H → ${nB} → C → ${nD} → H`), call: C('원주비행 출발', 'Circle, go', ['출발', '원주']) },
      H0(P.H, 90 * s, 0, nm('H 상공 복귀 정지', 'Back over H, hold'), { call: STOP('', '') }),
      H0(P.H, 0, 0, nm(`${oKo}로 90° 회전해 기수 전방 → 정지`, `Turn 90° ${oEn} to face forward → hold`), { posWatch: true, rot: true, call: STOP('기수전방', 'Nose forward', ['원주비행 완료', 'Circle complete']) })] },
    { id: 'emg', name: nm('비상착륙 (비상조작)', 'Emergency landing'), ann: ['비상조작을 실시하십시오.', 'Carry out the emergency procedure.'], steps: [
      H0(P.H, 0, 0, nm('H 상공 기준고도 +2 m 이상 상승 → 정지', 'Climb ≥ 2 m above reference over H → hold'), { altWin: [c1R('emgRise'), c1R('emgRise') + 2.5], posWatch: 'xy', call: C('2미터 상승', 'Climb 2 metres', ['상승', '미터']) }),
      { k: 'callout', lab: nm('"비상" 구호 (E 키·버튼은 기기 음성으로 대신 외침)', 'Call "emergency" (E key / button speaks it for you)'), call: C('비상!', 'Emergency!', ['비상']) },
      { k: 'emg', pad: F, lab: nm(`즉시 하강하며 F(${nB}쪽)로 빠르게 비상 강하 → 착지`, `Descend at once and move fast to F (${nB} side) → touch down`) },
      { k: 'disarm', lab: nm('시동 종료 · Enter', 'Shut down · Enter'), call: C('비상착륙 완료', 'Emergency landing complete', ['비상착륙', '완료']) }] },
    { id: 'nrm', name: nm('정상접근 및 착륙 (자세모드)', 'Normal approach & landing (attitude mode)'), needMode: true, ann: ['자세모드로 전환하여 정상접근 및 착륙을 실시하십시오.', 'Switch to attitude mode and carry out the normal approach and landing.'], steps: [
      { k: 'mode', lab: nm('비행모드를 자세제어(ATTI)로 전환 · GPS 스위치 끄기', 'Switch to attitude (ATTI) · GPS switch off'), call: C('ATTI 모드로 전환', 'Switching to ATTI mode', ['모드', '전환', '에티']) },
      { k: 'arm', csc: true, lab: nm('시동 · 스틱 또는 Enter', 'Start · sticks or Enter'), call: C('시동', 'Start', ['시동']) },
      H0(F, 0, 0, nm('F 에서 기수 전방으로 이륙 → 기준고도 정지', 'Take off from F nose forward → hold at reference height'), { posWatch: 'xy', call: STOP('이륙', 'Takeoff') }),
      { k: 'move', from: F, to: P.H, hdg: 0, lab: nm('H 상공까지 수평 횡이동', 'Sideways level move to over H'), call: C('정상접근', 'Normal approach', ['정상', '접근']) },
      H0(P.H, 0, 0, nm('정지', 'Hold'), { call: STOP('', '') }),
      { k: 'land', pad: P.H, hdg: 0, lab: nm('착륙장 안 착륙지점으로 강하 → 착륙 (중심축 기준)', 'Descend to the touchdown point → land (centre axis)'), call: C('착륙', 'Landing', ['착륙']) },
      { k: 'disarm', lab: nm('시동 종료 · Enter', 'Shut down · Enter'), call: C('정상접근 및 착륙 완료', 'Normal approach and landing complete', ['정상', '완료']) }] },
    { id: 'xw', name: nm('측풍접근 및 착륙', 'Crosswind approach & landing'), ann: ['GPS 모드로 전환 후 측풍접근 및 착륙을 실시하십시오.', 'Switch back to GPS mode and carry out the crosswind approach and landing.'], steps: [
      { k: 'mode', gps: true, lab: nm('GPS 모드로 전환 · GPS 스위치 켜기 (평가 제외)', 'Back to GPS mode · GPS switch on (not scored)'), call: C('GPS 모드로 전환', 'Switching to GPS mode', ['모드', '전환', 'gps', '지피에스']) },
      { k: 'arm', csc: true, lab: nm('시동 · 스틱 또는 Enter (평가 제외)', 'Start · sticks or Enter (not scored)'), call: C('시동', 'Start', ['시동']) },
      { k: 'xfer', to: SB, lab: nm(`이륙 후 기수 전방으로 ${nB} 지점 이동 (평가 제외)`, `Take off and move nose-forward to ${nB} (not scored)`), call: C('이륙, 측풍 접근 위치로', 'Takeoff. To the crosswind start point', ['이륙', '측풍', '위치']) },
      H0(SB, 0, 0, nm(`${nB} 에서 기준고도·기수 전방 정지`, `Hold at ${nB}, nose forward`), { call: STOP('', '') }),
      H0(SB, 90 * s, 0, nm(`바람 쪽(${sideKo})으로 90° 회전 → 정지`, `Turn 90° into the wind (${sideEn}) → hold`), { posWatch: true, rot: true, call: STOP('측풍 대응', 'Crosswind correction') }),
      { k: 'move', from: SB, to: P.H, hdg: 90 * s, lab: nm('측면 상태로 H 상공까지 직선 이동', 'Straight sideways to over H'), call: C('측풍 접근', 'Crosswind approach', ['측풍', '접근']) },
      H0(P.H, 90 * s, 0, nm('정지', 'Hold'), { call: STOP('', '') }),
      { k: 'land', pad: P.H, hdg: 90 * s, lab: nm('강하 → 착륙 (중심축 기준)', 'Descend → land (centre axis)'), call: C('착륙', 'Landing', ['착륙']) },
      { k: 'disarm', lab: nm('시동 종료 · Enter', 'Shut down · Enter'), call: C('측풍접근 및 착륙 완료, 비행 완료', 'Crosswind approach and landing complete. Flight complete', ['측풍', '완료']) }] },
    { id: 'post', name: nm('비행 후 기체점검', 'Post-flight check'), unrated: true, ann: ['비행 후 기체점검을 실시하십시오.', 'Carry out the post-flight check.'], steps: [
      { k: 'prep', lab: nm('아워미터 확인 · 기체배터리·조종기 끄기 · Enter', 'Hour meter · flight battery and transmitter off · Enter'), call: C('아워메타 확인, 기체배터리 OFF, 조종기 OFF', 'Hour meter checked. Flight battery off. Transmitter off', ['아워', '오프', 'off']) },
      { k: 'prep', lab: nm('기체 외관 점검 · Enter', 'Airframe check · Enter'), call: C('프로펠러, 모터, 모터베이스, 변속기 이상무, 암대, 메인프레임, 랜딩스키드 이상무', 'Propellers, motors, motor mounts, ESCs OK. Arms, main frame, landing skids OK', ['프로펠러', '이상무']) },
      { k: 'prep', lab: nm('배터리 분리·점검 · 기체 원위치 · 비행기록 · Enter (기록 내보내기는 결과 화면)', 'Battery out and checked · aircraft back · log · Enter (export on the result screen)'), call: C('배터리 분리, 배터리 케이블, 배부름 이상무, 기체 원위치, 비행 후 기체점검 완료', 'Battery out. Cables and swelling OK. Aircraft back in place. Post-flight check complete', ['배터리', '완료']) }] },
    { id: 'oral', name: nm('구술시험 (5문항)', 'Oral exam (5 questions)'), ann: ['구술시험을 시작하겠습니다.', 'The oral exam begins.'], steps: [
      { k: 'oral', lab: nm('구술: 항목별 1문항씩 5문항 (앱 작성 예시 문항)', 'Oral: one question per area, 5 in total (app-written examples)') }] }
  ].map(m => { if (m.ann) m.steps.unshift(A(m.ann[0], m.ann[1])); return m; });
}
// 바람 구호용: 바람이 불어오는 방위(8방위)와 평균 풍속
function c1WindInfo() {
  const sp = WIND.lv === 1 ? 3 : WIND.lv === 2 ? 7 : 0;
  if (!sp) return { sp: 0, dirKo: '무풍', dirEn: 'calm' };
  const fx = -WIND.dir.x, fz = -WIND.dir.z, b = ((Math.atan2(fx, -fz) / DEG) % 360 + 360) % 360, i = Math.round(b / 45) % 8;
  return { sp, dirKo: ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][i] + '풍', dirEn: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][i] };
}
// ---- 기체 형상: X2D 형상과 별도로 굵은 팔·스키드·큰 프롭 ----
// 정적 메시 묶기: 같은 그룹의 단색 메시들을 꼭짓점 색이 든 한 메시로 (드로우콜 ↓ · Quest 성능)
function c1Bake(G0, list, opt) {
  opt = opt || {}; const P = [], N = [], C = [], col = new THREE.Color(), m4 = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new V3(), n = new V3();
  G0.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(G0.matrixWorld).invert(); let cast = false, recv = false;
  for (const o of list) {
    let g = o.geometry; if (g.index) g = g.toNonIndexed();
    o.updateMatrixWorld(true); m4.multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(m4);
    const pa = g.attributes.position, na = g.attributes.normal; if (opt.white || !o.material.color) col.set(0xffffff); else col.copy(o.material.color);
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m4); P.push(v.x, v.y, v.z); if (na) { n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N.push(n.x, n.y, n.z); } else N.push(0, 1, 0); C.push(col.r, col.g, col.b); }
    cast = cast || !!o.castShadow; recv = recv || !!o.receiveShadow; if (o.parent) o.parent.remove(o);
  }
  if (!P.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  const mt = opt.basic ? new THREE.MeshBasicMaterial(Object.assign({ vertexColors: true }, opt.mat || {})) : new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.75, metalness: 0 }, opt.mat || {}));
  const m = new THREE.Mesh(g, mt); m.castShadow = cast && opt.shadow !== false; m.receiveShadow = recv; m.name = opt.name || 'baked'; G0.add(m); return m;
}
const _c1glow = {};
function c1GlowMat(col) {
  if (_c1glow[col]) return _c1glow[col];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = (col >> 16) & 255, gg = (col >> 8) & 255, b = col & 255;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${(r + 255) >> 1},${(gg + 255) >> 1},${(b + 255) >> 1},0.95)`); gr.addColorStop(0.3, `rgba(${r},${gg},${b},0.85)`); gr.addColorStop(0.6, `rgba(${r},${gg},${b},0.25)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
  return (_c1glow[col] = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
}
// 수술 흐름: 바람 + 기체 하강풍. 하강풍은 기체 아래로 내려와 땅에서 옆으로 퍼짐 (움직이면 뒤로 밀려 꼬리처럼 남음)
const _c1fl = new V3();
function c1Flow(p) {
  const w = c1Wind(p), f = _c1fl.set(w.x || 0, 0, w.z || 0); let down = 0;
  if ((S.state === 'run' || S.state === 'pause') && C1.armed && DR.thrust > 0) {
    const hh = DR.p.y - p.y;
    if (hh > -0.5 && hh < 14) {
      const tdown = Math.max(0, hh) / 7, cx = DR.p.x - DR.v.x * tdown + (w.x || 0) * tdown, cz = DR.p.z - DR.v.z * tdown + (w.z || 0) * tdown;   // 하강풍이 내려오는 동안 기체는 지나가고 바람에 밀림
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), r = 1.0 + 0.22 * Math.max(0, hh);
      const S0 = 11 * clamp(DR.thrust * 2, 0, 1.6) / (1 + Math.pow(Math.max(0, hh) / 4.5, 2));   // 하강풍 세기 (m/s)
      const out = d < r ? S0 * (d / r) * 0.6 : S0 * (r / d) * Math.exp(-(d - r) / 4);   // 기둥 안: 아래로 · 밖: 옆으로 퍼짐
      if (d > 0.01) { f.x += dx / d * out; f.z += dz / d * out; }
      down = d < r ? S0 * (1 - d / r) : 0;
    }
  }
  f.y = down; return f;
}
function c1RibbonTick() {
  const t = S.simT, all = C1.ribbons; if (!all || !all.length || !C1G) return;
  if (!C1.ribMesh) {   // 모든 수술을 한 메시로 (스트립 1장 = 꼭짓점 4개)
    let n = 0; all.forEach(r => n += r.strips.length);
    const g = new THREE.BufferGeometry(), C = new Float32Array(n * 12); let ci = 0;
    all.forEach(r => r.strips.forEach(st => { for (let k = 0; k < 4; k++) { C[ci++] = st.col.r; C[ci++] = st.col.g; C[ci++] = st.col.b; } }));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 12), 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    const idx = []; for (let q = 0; q < n; q++) { const b = q * 4; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 })); m.castShadow = true; m.frustumCulled = false; m.name = 'c1ribbons'; C1G.add(m); C1.ribMesh = m;
  }
  const pa = C1.ribMesh.geometry.attributes.position, na = C1.ribMesh.geometry.attributes.normal, PA = pa.array, NA = na.array; let q = 0;
  const w = 0.035, L = 0.7;
  for (const rb of all) {
    const f = c1Flow(rb.top), sp = Math.hypot(f.x, f.z), yaw = Math.atan2(-f.x, -f.z);
    rb.sp = (rb.sp == null ? sp : rb.sp + (sp - rb.sp) * 0.25); rb.yaw = rb.yaw == null ? yaw : rb.yaw + Math.atan2(Math.sin(yaw - rb.yaw), Math.cos(yaw - rb.yaw)) * 0.3;
    const lift = (Math.PI / 2) * (1 - Math.exp(-rb.sp / 3.2)) * (1 - Math.min(0.6, f.y / 10)), tur = 0.05 + 0.3 * Math.min(1, rb.sp / 6) + Math.min(0.6, f.y / 8);
    for (const st of rb.strips) {
      const y = rb.yaw + st.off * (0.25 + 0.6 * Math.exp(-rb.sp / 2)) + Math.sin(t * st.f * 0.6 + st.ph) * tur * 0.6, a = lift + Math.sin(t * st.f + st.ph) * tur * 0.5;
      const cy = Math.cos(y), sy = Math.sin(y), ca = Math.cos(a), sa = Math.sin(a);
      // 아래 끝: X 회전(a) → Y 회전(y) → 꼭대기 위치
      const by = -L * ca, bz = -L * sa, bx0 = bz * sy, bz0 = bz * cy;   // (0, -L cos a, -L sin a) 를 yaw 회전
      const wx = w * cy, wz = -w * sy;   // 폭 방향 (w, 0, 0) 을 yaw 회전
      const o = q * 12, T = rb.top;
      PA[o] = T.x - wx; PA[o + 1] = T.y; PA[o + 2] = T.z - wz;  PA[o + 3] = T.x + wx; PA[o + 4] = T.y; PA[o + 5] = T.z + wz;
      PA[o + 6] = T.x - wx + bx0; PA[o + 7] = T.y + by; PA[o + 8] = T.z - wz + bz0;  PA[o + 9] = T.x + wx + bx0; PA[o + 10] = T.y + by; PA[o + 11] = T.z + wz + bz0;
      const nx = ca * sy, ny = -sa, nz = ca * cy;   // (0, -sin a, cos a) 를 yaw 회전
      for (let k = 0; k < 4; k++) { NA[o + k * 3] = nx; NA[o + k * 3 + 1] = ny; NA[o + k * 3 + 2] = nz; }
      q++;
    }
  }
  pa.needsUpdate = true; na.needsUpdate = true;
}
// 항법등 크기: 화면에서 최소 몇 픽셀로 보이게 (멀리 있어도 점으로 보임)
const _c1cp = new V3();
function c1NavTick() {
  const m = typeof droneM !== 'undefined' && droneM && droneM.nav; if (!m || !m.length) return;
  const cam = (typeof c1VRon === 'function' && c1VRon() && C1XR.cam) ? C1XR.cam : camera, cp = cam === camera ? camera.position : _c1cp.setFromMatrixPosition(cam.matrixWorld), d = Math.max(0.5, cp.distanceTo(DR.p));
  const H = (renderer.domElement.clientHeight || 720), px = 2 * d * Math.tan((cam.fov || 50) * DEG / 2) / H;   // 1 px 의 실제 크기 (m)
  const on = typeof lightOn === 'function' && lightOn(), t = S.simT || 0, live = S.state !== 'menu';
  for (const n of m) {
    let sz = Math.max(n.strobe ? 0.22 : 0.12, px * (on ? 8 : 5.5)), vis = live;
    if (n.strobe) { const ph = t % 1.2; vis = live && on && (ph < 0.06 || (ph > 0.16 && ph < 0.22)); sz = Math.max(0.3, px * 11); }
    n.sp.visible = vis; n.sp.scale.set(sz, sz, 1);
  }
}
function makeC1(ghost) {
  const K = partsKit(ghost);
  const body = K.m(mat(0x8a9098, { roughness: 0.55 })), arm = K.m(mat(0xd9dde1, { roughness: 0.5 })), mot = K.m(mat(0x808890, { roughness: 0.35, metalness: 0.6 })), skid = K.m(mat(0x2a2c30, { roughness: 0.6 }));
  K.add(UBOX, body, 0, 0.02, 0, 0.42, 0.16, 0.42); K.add(UBOX, K.m(mat(0xd8dde2, { roughness: 0.5 })), 0, 0.12, 0, 0.3, 0.05, 0.3);
  K.add(UBOX, K.m(mat(0xd04040)), 0, 0.06, -0.22, 0.12, 0.05, 0.04);   // 기수 표시 (빨강)
  const props = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.sin(a) * 0.78, z = -Math.cos(a) * 0.78;
    const am = K.add(UBOX, arm, x / 2, 0.04, z / 2, 0.06, 0.05, 0.78); am.rotation.y = -a;
    K.add(UCYL, mot, x, 0.1, z, 0.06, 0.1, 0.06);
    props.push(propHub(K, x, 0.16, z, 0.36, 2, true, 0x18191b));
  }
  for (const x of [-0.45, 0.45]) {
    K.add(UBOX, skid, x, -0.29, 0, 0.035, 0.03, 1.1);
    for (const z of [-0.25, 0.25]) { const l = K.add(UBOX, skid, x * 0.7, -0.14, z, 0.03, 0.3, 0.03); l.rotation.z = x > 0 ? 0.45 : -0.45; }
  }
  { const stat = K.g.children.filter(o => o.isMesh); c1Bake(K.g, stat, ghost ? { basic: true, white: true, mat: { color: 0x55e6ff, transparent: true, opacity: 0.38, depthWrite: false }, shadow: false, name: 'c1body' } : { mat: { roughness: 0.5, metalness: 0.15 }, name: 'c1body' }); }
  const leds = [K.add(UBOX, K.LM(0xff2a2a), -0.1, -0.06, -0.21, 0.03, 0.02, 0.02), K.add(UBOX, K.LM(0x2aff4a), 0.1, -0.06, -0.21, 0.03, 0.02, 0.02)];
  // 항법등: 앞 두 팔 끝 초록 · 뒤 두 팔 끝 빨강 (계속 켜짐) · 조명 켜면 위 흰색 섬광 — 멀리서도 기수 방향 파악
  const nav = [];
  if (!ghost) {
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2, x = Math.sin(a) * 0.8, z = -Math.cos(a) * 0.8, front = z < 0;
      const sp = new THREE.Sprite(c1GlowMat(front ? 0x30ff60 : 0xff3030)); sp.position.set(x, 0.0, z); K.g.add(sp); nav.push({ sp, front }); }
    const sb = new THREE.Sprite(c1GlowMat(0xffffff)); sb.position.set(0, 0.2, 0.05); K.g.add(sb); nav.push({ sp: sb, strobe: true });
  }
  return { g: K.g, props, leds, cans: [], nav };
}

// ---- 시험장 (평탄 · 지형과 떨어진 곳) ----
var C1G = null;   // var: 초기화 전 호출돼도 오류 없게
function c1Label(t, col, sz) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = col || '#fff'; g.font = 'bold 96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 64, 70);
  const tx = new THREE.CanvasTexture(c); const m = new THREE.Mesh(new THREE.PlaneGeometry(sz || 1.4, sz || 1.4), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
  m.rotation.set(-Math.PI / 2, 0, -C1S.h); return m;
}
function c1Site() {
  if (C1G) return C1G;
  const G0 = new THREE.Group(); C1G = G0; scene.add(G0); G0.visible = false;
  if (!C1S.real) {   // 지형과 떨어진 독립 시험장일 때만 넓은 바닥
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gg = gc.getContext('2d');
  gg.fillStyle = '#6d8a4a'; gg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { gg.fillStyle = `rgba(${40 + Math.random() * 60 | 0},${70 + Math.random() * 70 | 0},${30 + Math.random() * 30 | 0},0.35)`; gg.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(900, 900); gt.encoding = THREE.sRGBEncoding; gt.anisotropy = 4;
  // 아주 큰 삼각형은 깊이 정밀도가 떨어져 위의 표지를 덮으므로 잘게 나누고 살짝 아래·뒤로 밀어 둠
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(18000, 18000, 90, 90), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 }));
  ground.rotation.x = -Math.PI / 2; ground.position.copy(c1W(0, 30, -0.03)); ground.receiveShadow = true; G0.add(ground);
  }
  // 시험 구역 (짧게 깎은 잔디)
  const fld = new THREE.Mesh(new THREE.PlaneGeometry(C1FIELD.u1 - C1FIELD.u0, C1FIELD.v1 - C1FIELD.v0), new THREE.MeshStandardMaterial({ color: 0x7f9b56, roughness: 1 }));
  fld.rotation.set(-Math.PI / 2, 0, -C1S.h); fld.material.polygonOffset = true; fld.material.polygonOffsetFactor = -1; fld.position.copy(c1W((C1FIELD.u0 + C1FIELD.u1) / 2, (C1FIELD.v0 + C1FIELD.v1) / 2, 0.003)); fld.receiveShadow = true; G0.add(fld);
  // 바닥 선은 전부 한 LineSegments 로 (투명도는 잔디색과 섞어 표현)
  const LP = [], LC = [], GRASS = new THREE.Color(0x7f9b56), _lc = new THREE.Color();
  const line = (pts, col, op) => { _lc.set(col).lerp(GRASS, 1 - (op || 1)); for (let i = 0; i < pts.length - 1; i++) { LP.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z); LC.push(_lc.r, _lc.g, _lc.b, _lc.r, _lc.g, _lc.b); } };
  const F = C1FIELD; line([c1W(F.u0, F.v0, 0.02), c1W(F.u1, F.v0, 0.02), c1W(F.u1, F.v1, 0.02), c1W(F.u0, F.v1, 0.02), c1W(F.u0, F.v0, 0.02)], 0xffffff, 0.8);
  // 안전라인 (조종자 어깨와 평행) · 권고 안전거리 원 14 m
  line([c1W(F.u0, 0.6, 0.02), c1W(F.u1, 0.6, 0.02)], 0xffd040, 0.9);
  { const pts = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts.push(c1W(Math.sin(a) * 14, Math.cos(a) * 14, 0.02)); } line(pts, 0xffd040, 0.35); }
  // 중심선 P–E, B–D 점선
  const dash = (a, b, col) => { const n = Math.max(2, Math.round(a.distanceTo(b) / 1.2)); for (let i = 0; i < n; i += 2) line([a.clone().lerp(b, i / n), a.clone().lerp(b, Math.min(1, (i + 1) / n))], col, 0.6); };
  dash(c1W(0, 0, 0.02), c1W(0, 62.5, 0.02), 0xffffff); dash(c1W(-7.5, 22.5, 0.02), c1W(7.5, 22.5, 0.02), 0xffffff);
  { const pts = []; for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2; pts.push(c1W(Math.sin(a) * 7.5, 22.5 + Math.cos(a) * 7.5, 0.02)); } line(pts, 0xffffff, 0.45); }
  // 착륙장 H·F (2×2 m)
  const pad = (uv, t, col) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 })); m.rotation.set(-Math.PI / 2, 0, -C1S.h); m.material.polygonOffset = true; m.material.polygonOffsetFactor = -2; m.position.copy(c1W(uv[0], uv[1], 0.01)); m.receiveShadow = true; G0.add(m);
    line([c1W(uv[0] - 1, uv[1] - 1, 0.015), c1W(uv[0] + 1, uv[1] - 1, 0.015), c1W(uv[0] + 1, uv[1] + 1, 0.015), c1W(uv[0] - 1, uv[1] + 1, 0.015), c1W(uv[0] - 1, uv[1] - 1, 0.015)], 0xffffff, 1);
    const l = c1Label(t, '#ffffff', 1.5); l.position.copy(c1W(uv[0], uv[1], 0.02)); G0.add(l);
  };
  pad(C1PT.H, 'H', 0x3a4048); pad(C1PT.FB, 'F', 0x8a3030); pad(C1PT.FD, 'F', 0x8a3030);
  // 지점 표지 (A·B·C·D·E 원판 + 글자) · 조종자 P
  const cone = mat(0xff8a1e, { roughness: 0.7 });
  for (const k of ['A', 'B', 'C', 'D', 'E', 'P']) {
    const uv0 = C1PT[k], uv = k === 'P' ? uv0 : [uv0[0] + 1.3, uv0[1]], d = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshStandardMaterial({ color: k === 'P' ? 0x2e6bd6 : 0xf0f0f0, roughness: 0.9 }));
    d.rotation.x = -Math.PI / 2; d.position.copy(c1W(uv[0], uv[1], 0.012)); G0.add(d);
    const l = c1Label(k, k === 'P' ? '#ffffff' : '#222', 1.0); l.position.copy(c1W(uv[0], uv[1], 0.02)); G0.add(l);
    if (k !== 'P') c1Cone(G0, uv0, cone);   // 지점 위 고깔 + 리본 (기체가 바로 위에 오면 바람에 눌림)
  }
  // 바람 자루 (풍향 참고)
  const pole = new THREE.Mesh(UCYL, mat(0xdddddd)); pole.scale.set(0.04, 4, 0.04); pole.position.copy(c1W(-16, 10, 2)); G0.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.4, 10, 1, true), mat(0xff6020, { side: THREE.DoubleSide })); sock.position.copy(c1W(-16, 10, 3.9)); G0.add(sock); C1.sock = sock;
  if (!C1S.real) {
  // 주변 나무 (깊이 감각용 · 배치 임의)
  const tm = mat(0x3c5e2c), trk = mat(0x5a4632); let sd = 7;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 260, u = Math.sin(a) * r, v = 30 + Math.cos(a) * r, h = 6 + rnd() * 8;
    const t = new THREE.Mesh(UCYL, trk); t.scale.set(0.25, h * 0.4, 0.25); t.position.copy(c1W(u, v, h * 0.2)); G0.add(t);
    const c = new THREE.Mesh(new THREE.ConeGeometry(h * 0.28, h * 0.8, 8), tm); c.position.copy(c1W(u, v, h * 0.55)); c.castShadow = true; G0.add(c);
  }
  }
  c1Props(G0);
  { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(LC, 3)); const ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true })); ls.name = 'c1lines'; G0.add(ls); }
  // 정적 소품 묶기: 입체물(고깔·펜스·천막·나무) 한 메시 · 바닥 표지(패드·원판) 한 메시
  { const keep = new Set([fld, C1.sock]); const flat = [], solid = [];
    for (const o of G0.children.slice()) { if (!o.isMesh || keep.has(o) || !o.material || o.material.map || o.material.transparent || !o.material.isMeshStandardMaterial) continue; (o.material.polygonOffset ? flat : solid).push(o); }
    c1Bake(G0, solid, { name: 'c1solid' }); c1Bake(G0, flat, { mat: { roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }, shadow: false, name: 'c1flat' }); }
  // 학습용 보조 표시: 목표 허용 상자 · 경로 선
  C1.aidBox = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  G0.add(C1.aidBox);
  C1.aidLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]), new THREE.LineBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.85 }));
  C1.aidLine.frustumCulled = false; G0.add(C1.aidLine);
  C1.aidArrow = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 10), new THREE.MeshBasicMaterial({ color: 0xffc828, transparent: true, opacity: 0.85, depthWrite: false })); C1.aidArrow.rotation.x = -Math.PI / 2; G0.add(C1.aidArrow);
  return G0;
}
function c1Cone(G0, uv, cm) {
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 14), cm); c.position.copy(c1W(uv[0], uv[1], 0.25)); c.castShadow = true; G0.add(c);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.1, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })); band.position.copy(c1W(uv[0], uv[1], 0.3)); G0.add(band);
  // 수술(리본 다발): 고깔 위 짧은 막대 끝에 매달림 → 바람 · 기체 하강풍(다운워시)에 날림 (전체 수술은 c1RibbonTick 에서 한 메시로 그림)
  const pole = new THREE.Mesh(UCYL, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 })); pole.scale.set(0.012, 0.75, 0.012); pole.position.copy(c1W(uv[0], uv[1], 0.5 + 0.375)); G0.add(pole);
  const top = c1W(uv[0], uv[1], 1.24), cols = [0xff3b3b, 0xffe14a, 0x3bb0ff, 0xffffff, 0xff3b3b, 0xffe14a, 0x3bb0ff, 0xffffff];
  const strips = cols.map((col, k) => ({ col: new THREE.Color(col), off: (k / cols.length - 0.5) * 0.9, ph: Math.random() * 6, f: 6 + Math.random() * 5 }));
  (C1.ribbons = C1.ribbons || []).push({ strips, uv, top, ph: Math.random() * 6 });
}
// 시험장 소품: 천막·책상·시험위원·응시자·안전펜스 (위치는 앱 설정)
function c1Props(G0) {
  const W2 = (u, v, h) => c1W(u, v, h), mk = (geo, m, u, v, h, sx, sy, sz, ry) => { const o = new THREE.Mesh(geo, m); o.position.copy(W2(u, v, h)); if (sx) o.scale.set(sx, sy, sz); o.rotation.y = -C1S.h + (ry || 0); o.castShadow = true; G0.add(o); return o; };
  // 안전펜스 (조종자 앞 기준선 · 높이 1 m)
  const post = mat(0xff7a1a, { roughness: 0.6 }), rope = mat(0xf2f2f2, { roughness: 0.8 });
  for (let u = -17.5; u <= 17.5; u += 3.5) if (Math.abs(u) > 1) mk(UCYL, post, u, 1.2, 0.5, 0.035, 1, 0.035);   // 조종자 바로 앞은 비움
  for (const h of [0.55, 0.95]) mk(UBOX, rope, 0, 1.2, h, 35, 0.015, 0.015);
  // 천막 (대기·시험위원석)
  const tw = mat(0xf4f4f0, { roughness: 0.7 }), tb = mat(0x2b5fb3, { roughness: 0.7 }), leg = mat(0x9aa0a6, { roughness: 0.4, metalness: 0.5 });
  for (const [u, v] of [[-12, -6], [-6, -6], [-12, -11], [-6, -11]]) mk(UCYL, leg, u, v, 1.25, 0.04, 2.5, 0.04);
  mk(UBOX, tw, -9, -8.5, 2.55, 6.4, 0.12, 5.4); const roof = mk(new THREE.ConeGeometry(4.3, 1.1, 4), tb, -9, -8.5, 3.15, 1, 1, 1, Math.PI / 4); roof.scale.set(1.05, 1, 0.88);
  mk(UBOX, tw, -9, -7.2, 0.75, 2.4, 0.05, 0.8); for (const u of [-10, -8]) mk(UCYL, leg, u, -7.2, 0.37, 0.03, 0.74, 0.03);
  // 조종자 인형 (3인칭 시점에서만 보임)
  const person = (u, v, vest, sit) => { const g = new THREE.Group(); g.position.copy(W2(u, v, 0)); g.rotation.y = -C1S.h; G0.add(g);
    const body = new THREE.Mesh(UCYL, mat(0x2d3640)); body.scale.set(0.2, 0.75, 0.15); body.position.y = 0.38 + 0.45; g.add(body);
    const top = new THREE.Mesh(UBOX, mat(vest)); top.scale.set(0.42, 0.6, 0.26); top.position.y = 1.2; g.add(top);
    const head = new THREE.Mesh(USPH || UCYL, mat(0xe2b897)); head.scale.setScalar(0.12); head.position.y = 1.62; g.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf5f5f5)); cap.position.y = 1.64; g.add(cap);
    g.traverse(o => { o.castShadow = true; }); return g; };
  C1.pilotFig = person(0, -0.15, 0xff8a1e);
}
// 메뉴·출격 시 시험장 보이기/감추기
function c1Menu(k) {
  if (!C1) return;
  const on = isC1(k);
  if (on) c1Site();
  if (C1G) C1G.visible = on;
  // 시험장에서 안 쓰는 코스 시설물(게이트·벙커·숲길 등)은 감춤 → 드로우콜 ↓ (메뉴로 나가면 복구)
  if (on && !C1.hidObj) { C1.hidObj = []; const c = c1W(0, 30, 0); for (const id in OBJ) { const g = OBJ[id] && OBJ[id].g; if (g && g.visible && g.position.distanceTo(c) > 60) { g.visible = false; C1.hidObj.push(g); } }
    if (typeof FLANE !== 'undefined' && FLANE && FLANE.G && FLANE.G.visible) { FLANE.G.visible = false; C1.hidObj.push(FLANE.G); } }
  if (!on && C1.hidObj) { C1.hidObj.forEach(g => { g.visible = true; }); C1.hidObj = null; }
  if (!on) { if (C1.on || C1.sun) { SUN_DIR.copy(SUN0); C1.sun = null; } C1.on = false; }
  C1ON = on && !C1S.real;
  const p = $('c1p'); if (p && (!on || S.state === 'menu' || S.state === 'result')) p.classList.add('hidden');
  if (ui.map) ui.map.style.display = on ? 'none' : '';
  const kh = $('keys'); if (kh) kh.style.display = on ? 'none' : '';
  document.body.classList.toggle('c1on', on && S.state !== 'menu');
}

// ---- 비행 모델 (최소 모델 · 120 Hz 고정 스텝에서 호출) ----
function c1Wind(p) {
  const base = WIND.lv === 1 ? 3 : WIND.lv === 2 ? 7 : 0;
  if (!base) return _c1w.set(0, 0, 0);
  if (C1S.real) return windAt(p);   // 실제 지형 위: 지형 따라 바뀌는 바람 (다른 임무와 같은 모델)
  const t = C1.t, agl = Math.max(0.5, p.y - C1S.y);
  const prof = clamp(Math.log((agl + 1) / 0.03) / Math.log(11 / 0.03), 0.4, 1.15);   // 지면 거칠기 0.03 m 가정 · 10 m 에서 1
  const gust = 1 + 0.22 * Math.sin(t * 0.9) * Math.sin(t * 0.37) + 0.1 * Math.sin(t * 2.3 + 1.1);   // 반복 가능한 돌풍 (시각 = 이번 비행 경과시간)
  const sw = 0.15 * Math.sin(t * 0.21);
  const c = Math.cos(sw), s = Math.sin(sw), k = base * prof * gust;
  return _c1w.set((WIND.dir.x * c - WIND.dir.z * s) * k, 0, (WIND.dir.x * s + WIND.dir.z * c) * k);
}
const _c1w = new V3(), _c1a = new V3(), _c1f = new V3(), _c1r = new V3();
function c1Phys(dt) {
  const m = c1p('flightKg'), Tmax = c1p('thrustMaxN'), g = G, aUpMax = Tmax / m - g, md = C1.mode;
  const gy = c1Gnd() + c1p('skidDrop');
  const onG = DR.p.y <= gy + 0.005;
  if (C1.demo && S.state === 'run') c1DemoCtl();
  const ip = IN.pitch, ir = IN.roll, iy = IN.yaw, it = IN.thr;
  const FW = _c1f.set(Math.sin(DR.h), 0, -Math.cos(DR.h)), RT = _c1r.set(Math.cos(DR.h), 0, Math.sin(DR.h));
  const wv = c1Wind(DR.p);
  // 1) 수평: 모드별 기울기 명령
  let pc = 0, rc = 0;
  if (C1.armed && !(onG && it <= 0.05)) {
    if (md === 'gps') {
      const tilt = c1p('tiltGps') * DEG, aLim = g * Math.tan(tilt);
      const stick = Math.abs(ip) > 0.04 || Math.abs(ir) > 0.04;
      const ac = _c1a.set(0, 0, 0);
      if (stick) {
        C1.hold = null; C1.ei.set(0, 0, 0);
        const vc = FW.clone().multiplyScalar(ip * c1p('gpsV')).addScaledVector(RT, ir * c1p('gpsV'));
        ac.set((vc.x - DR.v.x) * 1.8, 0, (vc.z - DR.v.z) * 1.8);
      } else {
        if (!C1.hold && Math.hypot(DR.v.x, DR.v.z) < 0.25) C1.hold = DR.p.clone();
        if (C1.hold) { const ex = C1.hold.x - DR.p.x, ez = C1.hold.z - DR.p.z; C1.ei.x = clamp(C1.ei.x + ex * dt, -2, 2); C1.ei.z = clamp(C1.ei.z + ez * dt, -2, 2); ac.set(ex * 0.9 + C1.ei.x * 0.25, 0, ez * 0.9 + C1.ei.z * 0.25); }
        ac.x -= DR.v.x * 1.7; ac.z -= DR.v.z * 1.7;
      }
      const al = Math.hypot(ac.x, ac.z); if (al > aLim) ac.multiplyScalar(aLim / al);
      pc = Math.atan((ac.x * FW.x + ac.z * FW.z) / g); rc = Math.atan((ac.x * RT.x + ac.z * RT.z) / g);
    } else { const tm = c1p('tiltMax') * DEG; pc = ip * tm; rc = ir * tm; }
  }
  const ka = 1 - Math.exp(-dt / c1p('tauAtt')), rl = c1p('attRate') * DEG * dt;
  DR.pitch += clamp((pc - DR.pitch) * ka, -rl, rl); DR.roll += clamp((rc - DR.roll) * ka, -rl, rl);
  // 2) 기수: 회전 속도 명령 → 1차 응답
  const yc = C1.armed && !onG ? iy * c1p('yawMax') * DEG : 0;
  C1.yr += (yc - C1.yr) * (1 - Math.exp(-dt / c1p('tauYaw'))); DR.h = wrapA(DR.h + C1.yr * dt);
  // 3) 수직: 고도유지(GPS·ATTI) = 상승률 명령 / 수동 = 스로틀이 곧 추력 (가운데 = 정지 추력 가정)
  let azc;
  if (!C1.armed) azc = -g;
  else if (md === 'manual') azc = it >= 0 ? it * aUpMax * 0.6 : it * g * 0.55;
  else {
    let vzc;
    if (Math.abs(it) > 0.05) { vzc = it > 0 ? it * c1p('climb') : it * c1p('sink'); C1.altT = null; }
    else { if (C1.altT == null && Math.abs(DR.v.y) < 0.15) C1.altT = DR.p.y; vzc = C1.altT == null ? 0 : clamp((C1.altT - DR.p.y) * 1.2, -0.8, 0.8); }
    if (onG && it <= 0.05) { vzc = 0; C1.altT = null; }
    azc = clamp((vzc - DR.v.y) * 3.0, -g * 0.6, aUpMax * 0.8);
  }
  C1.az += (azc - C1.az) * (1 - Math.exp(-dt / c1p('tauMotor')));
  const cosT = Math.cos(DR.pitch) * Math.cos(DR.roll), acc = Math.max(0, g + C1.az);   // 추력 가속도 (기체 위쪽)
  // 4) 힘 → 가속도: 기울어진 추력 + 중력 + 공기에 대한 속도로 항력
  const vrx = DR.v.x - wv.x, vrz = DR.v.z - wv.z, vry = DR.v.y, vh = Math.hypot(vrx, vrz), rho = c1p('rho');
  const kH = 0.5 * rho * c1p('cdA') * vh / m + c1p('rotorDrag'), kV = 0.5 * rho * c1p('cdAv') * Math.abs(vry) / m;
  const ah = acc * cosT > 0 ? acc : 0;
  const axF = ah * Math.sin(DR.pitch) * Math.cos(DR.roll), axR = ah * Math.sin(DR.roll);
  DR.v.x += (FW.x * axF + RT.x * axR - kH * vrx) * dt;
  DR.v.z += (FW.z * axF + RT.z * axR - kH * vrz) * dt;
  DR.v.y += (acc * cosT - g - kV * vry) * dt;
  DR.p.addScaledVector(DR.v, dt);
  DR.thrust = C1.armed ? clamp(acc / (Tmax / m), 0.08, 1) : 0;
  // 5) 지면 (스키드)
  if (DR.p.y <= gy) {
    const vy = DR.v.y, hs = Math.hypot(DR.v.x, DR.v.z), tilt = Math.max(Math.abs(DR.pitch), Math.abs(DR.roll)) / DEG;
    if (!DR.landed) {
      const uv = c1UV(DR.p);
      C1.touch = { t: C1.t, u: uv[0], v: uv[1], h: DR.h / DEG, vy, hs, tilt };
      if (-vy > c1p('crashSink') || hs > c1p('crashHs') || tilt > 30) C1.crash = { why: -vy > c1p('crashSink') ? 'sink' : hs > c1p('crashHs') ? 'speed' : 'tilt', vy, hs, tilt };
      else if (-vy > c1p('hardSink')) c1Ev('hard', { vy: +vy.toFixed(2) });
    }
    DR.p.y = gy; DR.v.y = Math.max(0, DR.v.y); DR.v.x *= Math.exp(-10 * dt); DR.v.z *= Math.exp(-10 * dt);
    DR.pitch *= Math.exp(-8 * dt); DR.roll *= Math.exp(-8 * dt); C1.yr *= Math.exp(-10 * dt);
    if (C1.az < 0) C1.az = 0;
    DR.landed = true;
  } else if (DR.p.y > gy + 0.02) DR.landed = false;
  if (!C1.armed && !onG) C1.crash = C1.crash || { why: 'disarm' };
  if (DR.p.y > c1Gnd() + 60) { DR.p.y = c1Gnd() + 60; DR.v.y = Math.min(0, DR.v.y); }
}

// ---- 측정값 ----
function c1M() {
  const uv = c1UV(DR.p);
  return { u: uv[0], v: uv[1], alt: DR.p.y - C1S.y - c1p('skidDrop'), hdg: c1Wrap((DR.h - C1S.h) / DEG), hs: Math.hypot(DR.v.x, DR.v.z), vy: DR.v.y, yr: Math.abs(C1.yr) / DEG };
}
const c1Wrap = d => { d = ((d + 180) % 360 + 360) % 360 - 180; return d; };   // +179 와 -179 의 차이 = 2°
function c1Still(M) { return M.hs < c1R('stillV') && Math.abs(M.vy) < 0.25 && M.yr < c1R('stillYaw'); }
function c1Ev(type, d) { const m = C1.M[C1.mi], st = m && m.steps[C1.si]; C1.ev.push(Object.assign({ t: +C1.t.toFixed(2), m: m ? m.id : '', s: C1.si, step: st ? st.lab : '', type }, d || {})); }
function c1Fail(st, why, d) {
  const m = C1.M[C1.mi]; if (!m) return;
  if (st && st.fails && st.fails.includes(why)) return;
  if (st) (st.fails = st.fails || []).push(why);
  m.fail = true; (m.why = m.why || []).push({ step: st ? st.lab : '', why, t: +C1.t.toFixed(1) });
  c1Ev('U', Object.assign({ why }, d || {}));
  if (!C1.exam) showMsg('U · ' + c1WhyTxt(why), '#ff9a40', 1.4);
}
function c1WhyTxt(w) {
  return ({ pos: L2('위치 이탈', 'position'), alt: L2('고도 이탈', 'height'), hdg: L2('기수 방향', 'heading'), path: L2('경로 이탈', 'path'), short: L2('정지 시간 부족', 'hold too short'),
    stops: L2('기동 중 멈춤', 'stops during manoeuvre'), mode: L2('GPS 모드로 수행', 'flown in GPS mode'), pad: L2('착륙장 밖', 'outside the pad'), slow: L2('비상 강하 속도 부족', 'emergency descent too slow'),
    pause: L2('비상 강하 중 일시정지 3초 이상', 'emergency pause ≥ 3 s'), pauseAlt: L2('1 m 위에서 일시정지', 'paused above 1 m'), crash: L2('충돌·추락', 'crash'), late: L2('시동·이륙 5분 초과', 'start-to-takeoff over 5 min'),
    ref: L2('기준고도 3~5 m 밖', 'reference height outside 3–5 m'), skip: L2('지점 미통과', 'checkpoint missed'), climbStop: L2('상승 중 멈춤', 'stopped while climbing'), rotStop: L2('회전 중 멈춤', 'stopped while turning'),
    safe: L2('안전거리(14 m)·안전라인 침범', 'inside the 14 m safety radius / line'), hard: L2('거친 접지', 'hard touchdown'), inspect: L2('점검 판정 오류', 'inspection misjudged'), ctl: L2('이륙 후 점검 미실시', 'after-takeoff check not done'), oral: L2('구술 오답', 'oral answer wrong') })[w] || w;
}
// 허용범위 이탈 추적: 짧은 이탈은 기록만, 연속 grace 초 넘으면 U
function c1Dev(st, key, bad, d, dt) {
  const D = st.dv || (st.dv = {}); const x = D[key] || (D[key] = { t: 0, n: 0, max: 0 });
  if (bad) { if (x.t === 0) { x.n++; c1Ev('dev', Object.assign({ key }, d)); } x.t += dt; x.max = Math.max(x.max, x.t); if (x.t >= c1R('grace')) c1Fail(st, key, d); }
  else x.t = 0;
  return bad;
}
function c1AltTgt(st) { return (C1.ref || 4) + (st.r || 0); }
function c1AltBad(st, M) {
  if (st.altWin) { const lo = (C1.ref || 4) + st.altWin[0], hi = (C1.ref || 4) + st.altWin[1]; return M.alt < lo - c1R('altTol') * 0 || M.alt > hi; }
  return Math.abs(M.alt - c1AltTgt(st)) > c1R('altTol');
}

// ---- 단계별 판정 ----
const C1EV = {
  prep(st) { return false; }, mode(st) { return st.gps ? C1.mode === 'gps' : C1.mode !== 'gps'; }, arm() { return C1.armed; }, callout() { return false; }, disarm() { return false; },
  xfer(st, M) { const d = Math.hypot(M.u - st.to[0], M.v - st.to[1]); return d < 1.5 && Math.abs(M.alt - (C1.ref || 4)) < 1.0 && c1Still(M); },
  climb(st, M, dt) {
    const lat = Math.hypot(M.u - st.at[0], M.v - st.at[1]);
    if (M.alt > 0.3) { st.up = true; c1Dev(st, 'pos', lat > c1R('posTol'), { lat: +lat.toFixed(2) }, dt); c1Dev(st, 'hdg', Math.abs(c1Wrap(M.hdg)) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0) }, dt); }
    if (!st.up) return false;
    // 상승 중 멈춤 (3~5 m 도달 전)
    if (M.alt < c1R('refMin') - c1R('altTol') && M.vy < 0.1 && M.alt > 0.6) st.stopT = (st.stopT || 0) + dt; else if (st.stopT) { c1Ev('stop', { d: +st.stopT.toFixed(2) }); if (st.stopT >= c1R('stopShort')) st.longStop = (st.longStop || 0) + 1; else st.shortStop = (st.shortStop || 0) + 1; st.stopT = 0; if ((st.shortStop || 0) >= 2 || (st.longStop || 0) >= 1) c1Fail(st, 'climbStop'); }
    const inRef = M.alt >= c1R('refMin') - c1R('altTol') && M.alt <= c1R('refMax') + c1R('altTol');
    if (M.alt > c1R('refMax') + c1R('altTol') && c1Still(M)) { st.hiT = (st.hiT || 0) + dt; if (st.hiT >= 2 && !st.hiF) { st.hiF = true; c1Fail(st, 'ref', { alt: +M.alt.toFixed(2) }); } if (st.hiT >= 2) { C1.ref = c1R('refMax'); c1Ev('ref', { ref: C1.ref, measured: +M.alt.toFixed(2), note: 'above range → clamped' }); return true; } } else st.hiT = 0;
    st.okT = inRef && c1Still(M) ? (st.okT || 0) + dt : 0;
    if (st.okT >= 1.0) {
      C1.ref = Math.round(clamp(M.alt, c1R('refMin'), c1R('refMax')) * 10) / 10;
      if (M.alt < c1R('refMin') || M.alt > c1R('refMax')) c1Ev('refClamp', { measured: +M.alt.toFixed(2), ref: C1.ref });
      c1Ev('ref', { ref: C1.ref, measured: +M.alt.toFixed(2) });
      if (C1.tArm != null && C1.t - C1.tArm > c1R('takeoffLimit')) c1Fail(st, 'late', { s: +(C1.t - C1.tArm).toFixed(0) });
      return true;
    }
    return false;
  },
  hold(st, M, dt) {
    const tgt = st.at, du = M.u - tgt[0], dv = M.v - tgt[1];
    const posBad = st.alongTol ? (Math.abs(du) > c1R('posTol') || Math.abs(dv) > st.alongTol) : Math.hypot(du, dv) > c1R('posTol');
    const altBad = c1AltBad(st, M), he = c1Wrap(M.hdg - st.hdg), hdgBad = Math.abs(he) > c1R('hdgTol');
    st.err = { lat: Math.hypot(du, dv), alt: M.alt - c1AltTgt(st), hdg: he };
    if (!st.armedEval) {
      if (st.posWatch) { c1Dev(st, 'pos', posBad, { du: +du.toFixed(2), dv: +dv.toFixed(2) }, dt); if (st.posWatch !== 'xy') c1Dev(st, 'alt', altBad, { alt: +M.alt.toFixed(2) }, dt); }
      if (st.rot) {   // 회전 중 멈춤
        const turned = Math.abs(c1Wrap(M.hdg - (st.h0 == null ? (st.h0 = M.hdg) : st.h0))) > 10;
        if (turned && hdgBad && M.yr < 3) st.stopT = (st.stopT || 0) + dt; else if (st.stopT) { c1Ev('rotStop', { d: +st.stopT.toFixed(2) }); st.rotStops = (st.rotStops || 0) + 1; if (st.stopT >= c1R('stopShort') || st.rotStops >= 2) c1Fail(st, 'rotStop'); st.stopT = 0; }
      }
      const ok = !posBad && !altBad && !hdgBad && c1Still(M);
      st.okT = ok ? (st.okT || 0) + dt : 0;
      if (st.okT >= c1R('arriveT')) { st.armedEval = true; st.t = 0; }
      return false;
    }
    const bad = posBad || altBad || hdgBad;
    if (C1.exam) {   // 모의평가: 정지 중 허용범위를 벗어나면 그 정지는 끝 (5초 미만이면 U)
      if (bad) { st.outT = (st.outT || 0) + dt; if (st.outT > 0.4) { if (st.t < st.T) c1Fail(st, 'short', { held: +st.t.toFixed(2), left: posBad ? 'pos' : altBad ? 'alt' : 'hdg' }); return true; } }
      else { st.outT = 0; st.t += dt; }
      return st.t >= st.T;
    }
    if (bad) { c1Dev(st, posBad ? 'pos' : altBad ? 'alt' : 'hdg', true, { held: +st.t.toFixed(2) }, dt); st.t = 0; }   // 학습: 다시 정지하면 처음부터
    else { c1Dev(st, 'pos', false, null, dt); c1Dev(st, 'alt', false, null, dt); c1Dev(st, 'hdg', false, null, dt); st.t += dt; }
    return st.t >= st.T;
  },
  move(st, M, dt) {
    const a = st.from, b = st.to, r0 = st.r0 || 0, r1 = st.r1 || 0, ref = C1.ref || 4;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), tx = dx / L, ty = dy / L;
    const pu = M.u - a[0], pv = M.v - a[1], along = pu * tx + pv * ty, lat = -pu * ty + pv * tx, s = clamp(along / L, 0, 1);
    const altE = ref + r0 + (r1 - r0) * s, altErr = M.alt - altE, he = c1Wrap(M.hdg - st.hdg);
    st.err = { lat, alt: altErr, hdg: he, s };
    if (!st.dep && along > 0.5) { st.dep = true; st.t0 = C1.t; st.vys = 0; st.vyn = 0; }
    const dEnd = Math.hypot(M.u - b[0], M.v - b[1]);
    if (st.dep) {
      c1Dev(st, 'path', Math.abs(lat) > c1R('posTol'), { lat: +lat.toFixed(2) }, dt);
      c1Dev(st, 'alt', Math.abs(altErr) > c1R('altTol'), { alt: +M.alt.toFixed(2), exp: +altE.toFixed(2) }, dt);
      c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0) }, dt);
      if (st.desc && M.vy < -0.1) { st.vys += -M.vy * dt; st.vyn += dt; }
      // 기동 중 멈춤
      const near = (st.alongTol ? Math.abs(along - L) <= st.alongTol && Math.abs(lat) < c1R('posTol') + 0.5 : dEnd < 1.5) && Math.abs(altErr) < 0.8;
      if (!near && M.hs < c1R('stopV') && Math.abs(M.vy) < c1R('stopV')) st.stopT = (st.stopT || 0) + dt;
      else if (st.stopT) { c1StopEnd(st); }
    }
    // 도착: 끝점 1.5 m 안 · E 처럼 전후 인정 범위(±5 m)가 있으면 그 범위 안에서 멈추면 도착 (짧게 멈춰도·조금 지나쳐도 진행)
    const arrived = st.alongTol ? (Math.abs(along - L) <= st.alongTol && Math.abs(lat) < c1R('posTol') + 0.5 && (dEnd < 1.5 || M.hs < c1R('stillV'))) : dEnd < c1R('posTol') + 0.5;
    if (st.dep && arrived && Math.abs(altErr) < 1.0) {
      if (st.stopT) c1StopEnd(st);
      if (st.desc && st.vyn > 0.5) { C1.refDesc = st.vys / st.vyn; c1Ev('refDesc', { v: +C1.refDesc.toFixed(2), basis: 'triangle 45° descent mean |vy|' }); }
      return true;
    }
    return false;
  },
  arc(st, M, dt) {
    const cu = st.c[0], cv = st.c[1], du = M.u - cu, dv = M.v - cv, r = Math.hypot(du, dv), th = Math.atan2(du, dv) / DEG;   // 방위: 전방 기준 시계 방향
    const dir = st.dir < 0 ? 1 : -1;   // 좌측 먼저(B) = 시계 방향 (방위 증가)
    if (st.th == null) { st.th = th; st.sweep = 0; st.hit = {}; }
    const dth = c1Wrap(th - st.th); st.th = th; st.sweep += dth * dir;
    const tanH = c1Wrap(th + 90 * dir), he = c1Wrap(M.hdg - tanH), altErr = M.alt - (C1.ref || 4);
    st.err = { lat: r - st.R, alt: altErr, hdg: he, s: st.sweep / 360 };
    if (!st.dep && st.sweep > 4) st.dep = true;
    if (st.dep) {
      c1Dev(st, 'path', Math.abs(r - st.R) > c1R('posTol'), { r: +r.toFixed(2) }, dt);
      c1Dev(st, 'alt', Math.abs(altErr) > c1R('altTol'), { alt: +M.alt.toFixed(2) }, dt);
      c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0), want: +tanH.toFixed(0) }, dt);
      for (const [q, ang] of [['B/D', 90], ['C', 180], ['D/B', 270]]) if (!st.hit[q] && st.sweep >= ang) { st.hit[q] = { r: +r.toFixed(2), hdgErr: +he.toFixed(1) }; c1Ev('cp', { q, r: +r.toFixed(2), hdgErr: +he.toFixed(1) }); if (Math.abs(r - st.R) > c1R('posTol')) c1Fail(st, 'skip', { q }); }
      const near = st.sweep > 340;
      if (!near && M.hs < c1R('stopV')) st.stopT = (st.stopT || 0) + dt; else if (st.stopT) c1StopEnd(st);
      if (st.sweep < -20) c1Fail(st, 'path', { wrongDir: true });
    }
    if (st.sweep >= 350 && Math.hypot(M.u - st.start[0], M.v - st.start[1]) < 1.5) { if (st.stopT) c1StopEnd(st); return true; }
    return false;
  },
  emg(st, M, dt) {
    const pu = st.pad[0], pv = st.pad[1], he = c1Wrap(M.hdg);
    c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTolEmg'), { hdg: +M.hdg.toFixed(0) }, dt);
    if (M.alt > c1R('pauseEmgAlt') && M.vy < -0.1) { st.vs = (st.vs || 0) + (-M.vy) * dt; st.vn = (st.vn || 0) + dt; }
    if (M.vy > 0.25 && M.alt > 0.5) { st.up = (st.up || 0) + dt; if (st.up > 0.5) c1Fail(st, 'path', { climbed: true }); }
    if (M.alt > c1R('pauseEmgAlt') && M.hs < 0.25 && Math.abs(M.vy) < 0.15 && st.vn > 0.5) { st.hiP = (st.hiP || 0) + dt; if (st.hiP > 0.6) c1Fail(st, 'pauseAlt', { alt: +M.alt.toFixed(2) }); } else st.hiP = 0;
    if (M.alt <= c1R('pauseEmgAlt') && M.alt > 0.05 && M.hs < 0.25 && Math.abs(M.vy) < 0.15) { st.pT = (st.pT || 0) + dt; if (st.pT >= c1R('pauseEmg')) c1Fail(st, 'pause', { s: +st.pT.toFixed(2) }); } else st.pT = 0;
    st.err = { lat: Math.hypot(M.u - pu, M.v - pv), alt: M.alt, hdg: he };
    if (DR.landed && C1.touch && C1.touch.t >= (st.t0 || 0)) {
      const mean = st.vn > 0 ? st.vs / st.vn : 0, ref = C1.refDesc || c1R('emgRefDefault');
      st.res = { meanDesc: +mean.toFixed(2), refDesc: +ref.toFixed(2), basis: C1.refDesc ? 'triangle 45° descent' : 'app default', touch: C1.touch };
      c1Ev('emgDesc', st.res);
      if (mean < ref * c1R('emgRatio')) c1Fail(st, 'slow', st.res);
      if (!c1SkidOnPad(C1.touch, st.pad)) c1Fail(st, 'pad', { touch: C1.touch });
      return true;
    }
    return false;
  },
  land(st, M, dt) {
    const du = M.u - st.pad[0], dv = M.v - st.pad[1], he = c1Wrap(M.hdg - st.hdg);
    st.err = { lat: Math.hypot(du, dv), alt: M.alt, hdg: he };
    if (!DR.landed) {
      c1Dev(st, 'pos', Math.hypot(du, dv) > c1R('posTol'), { du: +du.toFixed(2), dv: +dv.toFixed(2) }, dt);
      c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0) }, dt);
      st.fin = 0; return false;
    }
    if (!st.td && C1.touch) { st.td = C1.touch; c1Ev('touch', { u: +C1.touch.u.toFixed(2), v: +C1.touch.v.toFixed(2), hdg: +C1.touch.h.toFixed(0) }); if (!c1CenterOnPad(C1.touch.u, C1.touch.v, st.pad)) c1Fail(st, 'pad', { touch: true }); }
    st.fin = (st.fin || 0) + dt;
    if (st.fin > 0.8) { if (!c1CenterOnPad(M.u, M.v, st.pad)) c1Fail(st, 'pad', { final: true, u: +M.u.toFixed(2), v: +M.v.toFixed(2) }); c1Ev('final', { u: +M.u.toFixed(2), v: +M.v.toFixed(2) }); return true; }
    return false;
  }
};
function c1StopEnd(st) {
  const d = st.stopT; st.stopT = 0; c1Ev('stop', { d: +d.toFixed(2) });
  if (d >= c1R('stopShort')) st.longStop = (st.longStop || 0) + 1; else st.shortStop = (st.shortStop || 0) + 1;
  if ((st.shortStop || 0) >= 2 || (st.longStop || 0) >= 1) c1Fail(st, 'stops', { short: st.shortStop || 0, long: st.longStop || 0 });
}
// 정상·측풍: 중심축이 착륙장 안 또는 경계에 접함 · 비상: 스키드 일부라도 F 안 또는 접함
function c1CenterOnPad(u, v, pad) { return Math.abs(u - pad[0]) <= 1.0 + 1e-6 && Math.abs(v - pad[1]) <= 1.0 + 1e-6; }
function c1SkidOnPad(t, pad) {
  if (!t) return false; const h = t.h * DEG, L = c1p('skidLen') / 2, Wd = c1p('skidSpan') / 2;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const fx = i / 2 * L, rx = j / 2 * Wd;   // 기수 방향(fx) · 오른쪽(rx)
    const u = t.u + Math.sin(h) * fx + Math.cos(h) * rx, v = t.v + Math.cos(h) * fx - Math.sin(h) * rx;
    if (c1CenterOnPad(u, v, pad)) return true;
  }
  return false;
}

// ---- 시험 시각 → 해 위치 (그림자로 거리감) · 위도 36.8° · 오늘 날짜 · 한국 표준시 기준 태양 정오 약 12:32 ----
function c1Sun() {
  try {
    if (!isC1() || ENV.night || ENV.dusk) return;
    const h = SET.c1hour || 11, d = new Date(), N = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5), phi = 36.8 * DEG;
    const dec = -23.44 * DEG * Math.cos(2 * Math.PI / 365 * (N + 10)), H = 15 * DEG * (h - 12.53);
    const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;   // 북쪽 기준 시계 방향
    let nx = 0, nz = -1, ex = 1, ez = 0;   // 월드에서 북·동 방향 (현장 좌표계에서 구함)
    if (typeof SITE_X !== 'undefined' && SITE_X.toEN) { const a = SITE_X.toEN(0, 0), bd = SITE_X.toEN(1, 0), bs = SITE_X.toEN(0, 1);
      const dEd = bd[0] - a[0], dNd = bd[1] - a[1], dEs = bs[0] - a[0], dNs = bs[1] - a[1], det = dEd * dNs - dEs * dNd;
      const nd = -dEs / det, ns = dEd / det, ed = dNs / det, es = -dNd / det; nx = ns; nz = -nd; ex = es; ez = -ed; const ln = Math.hypot(nx, nz), le = Math.hypot(ex, ez); nx /= ln; nz /= ln; ex /= le; ez /= le; }
    const ce = Math.cos(Math.max(el, 3 * DEG)), se = Math.sin(Math.max(el, 3 * DEG)), sE = Math.sin(az) * ce, sN = Math.cos(az) * ce;
    SUN_DIR.set(ex * sE + nx * sN, se, ez * sE + nz * sN).normalize(); C1.sun = { h, el: +(el / DEG).toFixed(1), az: +(az / DEG).toFixed(0) };
  } catch (e) { }
}
// ---- 진행 ----
function c1Start(a) {
  c1Site(); C1G.visible = true; C1ON = !C1S.real; if (C1.hidObj) C1.hidObj.forEach(g => { g.visible = false; });   // msStart 가 다시 켠 코스 시설물 재숨김
  Object.assign(C1, { on: true, exam: S.kind === 'class1x', demo: S.kind === 'class1d', dm: null, sayUntil: 0, mode: 'gps', view: 'pilot', armed: false, ref: null, refDesc: null, mi: 0, si: 0, ev: [], t: 0, az: 0, yr: 0, hold: null, touch: null, crash: null, over: false, tArm: null, altT: null, modeLog: [] });
  C1.ei.set(0, 0, 0);
  C1.side = SET.c1side === 1 ? 1 : -1;
  C1.M = c1Build(C1.side);
  C1.M.forEach(m => { m.done = false; m.miss = false; m.fail = false; m.why = []; m.label = m.name; m.steps.forEach(s => { s.T = s.T || c1R('hoverT'); }); });
  S.cam = 1; ui.map.style.display = 'none'; document.body.classList.add('c1on');
  c1Panel(true); c1ALoad(); c1Sun(); if ((typeof XR_ON !== 'undefined' && XR_ON) || window.C1_VRTEST) c1XRInit();
  c1Ev('start', { exam: C1.exam, side: C1.side < 0 ? 'left-first' : 'right-first', profile: C1P.ver, rules: C1RULES.ver, wind: WIND.lv });
  return C1.M;
}
function c1StartPose() { return { p: c1W(C1PT.H[0], C1PT.H[1], c1p('skidDrop')), h: C1S.h }; }
// 단계 충족 표시: 안내창에 ✓ 와 짧은 알림음 (모의평가에서도)
function c1OkFlash(st) {
  if (!st || ['ann', 'oral', 'inspect'].includes(st.k)) return;
  const bad = st.fails && st.fails.length; C1.ok = { text: (bad ? '✗ ' : '✓ ') + st.lab.split(' · ')[0].split(' (')[0], bad: !!bad, t: 2.2 };
  try { if (AU.ctx && !TEST) { const o = AU.ctx.createOscillator(), g = AU.ctx.createGain(); o.frequency.value = bad ? 330 : 880; g.gain.setValueAtTime(0.0001, AU.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, AU.ctx.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, AU.ctx.currentTime + 0.18); o.connect(g); g.connect(AU.master || AU.ctx.destination); o.start(); o.stop(AU.ctx.currentTime + 0.2); } } catch (e) { }
}
function c1Count(x) {
  if (!x || !x.call || !x.call.count || x.callSaid !== 'btn' || x.arrT == null) return;
  if (!x.stopSaid) { x.stopSaid = true; c1Say(L2('정지.', 'Hold.'), 'me'); return; }
  const n = Math.min(5, Math.floor(C1.t - x.arrT + 1e-6)); if (n > (x.cnt || 0)) { x.cnt = n; c1Say(L2(['하나', '둘', '셋', '넷', '다섯'], ['one', 'two', 'three', 'four', 'five'])[n - 1], 'me'); }
}
function c1Next() {
  const m = C1.M[C1.mi]; if (!m) return;
  C1.si++; c1Ev('stepDone');
  if (C1.si >= m.steps.length) {
    m.done = true; m.miss = !!m.fail; C1.si = 0; C1.mi++; MS.idx = C1.mi;
    sfx(m.fail ? 'bad' : 'good'); if (!C1.exam || m.unrated) showMsg(m.name + (m.unrated ? ' · ' + L2('교관 확인', 'instructor check') : m.fail ? ' · U' : ' · S'), m.fail ? '#ff9a40' : '#5dff9a', 1.4);
    renderList();
    if (C1.mi >= C1.M.length) { c1Finish('done'); return; }
    const nm = C1.M[C1.mi]; if (nm.needMode) nm.tStart = C1.t;
  }
  const st = c1Cur(); if (st) { st.t0 = C1.t; if (st.k === 'prep' || st.k === 'disarm' || st.k === 'arm' || st.k === 'callout') st.wait = true; }
}
function c1Cur() { const m = C1.M[C1.mi]; return m ? m.steps[C1.si] : null; }
function c1Step(prev, cur, dt) {
  if (!C1.on || C1.over) return;
  C1.t += dt;
  const m = C1.M[C1.mi], st = c1Cur(); if (!m || !st) return;
  if (C1.crash) {
    const c = C1.crash; C1.crash = null; c1Fail(st, 'crash', c); sfx('crash'); shake = 0.08;
    if (C1.exam) { c1Finish('crash'); return; }
    showMsg(L2('충돌 · 이 기동을 처음부터', 'Crash · restart this manoeuvre'), '#ff5050', 1.8); c1Jump(C1.mi, true); return;
  }
  const M = c1M();
  // 종합: 안전거리 14 m · 안전라인 (조종자 앞쪽 기준선 뒤로 오면 침범)
  if (!DR.landed && (Math.hypot(M.u, M.v) < c1R('safeR') || M.v < 0.6)) { C1.safeT = (C1.safeT || 0) + dt; if (C1.safeT > 0.5 && !C1.safeLogged) { C1.safeLogged = true; c1Ev('safe', { u: +M.u.toFixed(1), v: +M.v.toFixed(1) }); C1.safeBad = true; if (!C1.exam) showMsg(c1WhyTxt('safe'), '#ff5050', 1.4); } } else { C1.safeT = 0; C1.safeLogged = false; }
  // 정상접근: 모든 세부 기동을 자세·수동 모드로 (모드 전환 단계 이후)
  if (m.needMode && C1.si > m.steps.findIndex(x => x.k === 'mode') && C1.mode === 'gps' && !st.fails?.includes('mode')) c1Fail(st, 'mode');
  const fn = C1EV[st.k], done = fn && fn(st, M, dt);
  // 버튼으로 정지 구호를 했으면 정지 지점 도착 때 "정지", 그 뒤 1초마다 "하나…다섯" (단계가 먼저 끝나도 다섯까지, 움직이면 멈춤)
  if (st.call && st.call.count && st.armedEval) { if (st.arrT == null || C1.t - st.arrT > st.t + 0.6) { st.arrT = C1.t - st.t; st.cnt = Math.floor(st.t); } }
  c1Count(st); if (C1V.cst && C1V.cst !== st) { if (M.hs > 0.6 || (C1V.cst.cnt || 0) >= 5 || C1.t - C1V.cst.arrT > 6.5) C1V.cst = null; else c1Count(C1V.cst); }
  if (done) { if (st.call && st.call.count && st.arrT != null && (st.cnt || 0) < 5) C1V.cst = st; if (st.call && st.call.after && st.callSaid === 'btn') c1Say(L2(st.call.after[0], st.call.after[1]), 'me'); c1OkFlash(st); c1Next(); }
}
let _c1dk = false;
function fromDemo(k) { return _c1dk || ['KeyC', 'PadRB', 'KeyZ', 'KeyR'].includes(k) || /^Digit[1-9]$/.test(k); }
function c1DK(k) { _c1dk = true; try { c1Key(k); } finally { _c1dk = false; } }
function c1Key(k, fromVoice) {
  if (!isC1() || S.state !== 'run') return false;
  const st = c1Cur();
  if (C1.demo && !fromDemo(k)) return !['Escape', 'KeyP', 'KeyM', 'Tab', 'KeyF'].includes(k);   // 시범비행: 시점·시야·건너뛰기만 사용자 입력
  if (k === 'KeyY') { c1Mode(); return true; }
  if (k === 'KeyH' || k === 'KeyG') { c1GpsToggle(); return true; }   // GPS 스위치 (보조 버튼·H 키)
  if (st && st.k === 'inspect' && st.open && !st.done && (XR_ON || window.C1_VRTEST) && (k === 'Enter' || k === 'KeyE' || k === 'Space')) {   // VR: 항목마다 A 정상 / X 불량
    const it = C1INS.find(x => !st.ans[x.id]); if (it) { st.ans[it.id] = k === 'KeyE' ? 'bad' : 'ok'; sfx('good'); } if (C1INS.every(x => st.ans[x.id])) c1InspectDone(st); return true; }
  if (st && st.k === 'oral' && st.qs && !st.done && (XR_ON || window.C1_VRTEST) && k === 'Enter') { c1OralAns(st, st.qs[st.qi].ord[C1XR.sel]); C1XR.sel = 0; return true; }
  if (k === 'KeyQ') { if (!c1CallDo('btn') && st && st.call && !C1.exam) showMsg(L2('이 단계 구호는 이미 했습니다', 'Call already made for this step'), '#9aa6ad', 1); return true; }
  if (k === 'KeyE') { if (st && st.k === 'callout' && !st.wait2) { st.wait2 = true; c1CallDo(fromVoice ? 'voice' : 'btn'); c1Ev('callout'); showMsg(L2('"비상!"', '"EMERGENCY!"'), '#ff5050', 1.2); sfx('bad'); c1Next(); const n = c1Cur(); if (n) n.t0 = C1.t; } return true; }
  if (k === 'KeyZ') { const L = [1, 1.3, 0.8], i = (L.indexOf(SET.c1zoom || 1) + 1) % 3; SET.c1zoom = L[i]; saveSet(); showMsg(L2('조종자 시야 ', 'Pilot view ') + [L2('기본', 'normal'), L2('넓게', 'wide'), L2('좁게 (확대)', 'narrow (zoom in)')][i], '#fff', 0.9); return true; }
  if (k === 'KeyC' || k === 'PadRB') { if (!C1.exam) { C1.view = C1.view === 'pilot' ? 'chase' : 'pilot'; showMsg(C1.view === 'pilot' ? L2('조종자 시점', 'Pilot view') : L2('추적 시점 (학습용)', 'Chase view (learning)'), '#4fe3ff', 1); } else showMsg(L2('모의평가는 조종자 시점만', 'Mock check uses the pilot view only'), '#ffc828', 1); return true; }
  if (k === 'Enter' || k === 'Space' || k === 'PadA') { c1Confirm(); return true; }
  if (k === 'KeyR' || k === 'PadY') { if (!C1.exam) { c1Jump(C1.mi, true); showMsg(L2('이 기동 다시', 'Restart this manoeuvre'), '#c9a2ff', 1); } return true; }
  if (k === 'KeyN') { if (!C1.exam) { c1Ev('skipStep'); const m = C1.M[C1.mi]; if (m) m.skipped = true; c1Next(); } return true; }
  if (/^Digit[1-9]$/.test(k) && !C1.exam) { c1Jump(+k.slice(5)); return true; }
  return false;
}
let _c1conf = false;
function c1Confirm() { if (_c1conf) return; _c1conf = true; try { c1Confirm0(); } finally { _c1conf = false; } }
function c1Confirm0() {
  const st = c1Cur(); if (!st) return;
  if (st.k === 'prep') { if (st.call) c1CallDo('btn'); c1Ev('confirm'); c1Next(); }
  else if (st.k === 'arm') { if (DR.landed) { c1Arm('btn'); c1Next(); } }
  else if (st.k === 'disarm') { if (DR.landed && Math.hypot(DR.v.x, DR.v.z) < 0.3) { C1.armed = false; if (st.call) c1CallDo('btn'); c1Ev('disarm'); c1Next(); } else showMsg(L2('착지 후 시동 종료', 'Land first, then shut down'), '#ffc828', 1); }
}
function c1GpsToggle() {
  C1.mode = C1.mode === 'gps' ? 'atti' : 'gps'; C1.hold = null; C1.altT = null; C1.ei.set(0, 0, 0);
  c1Ev('mode', { mode: C1.mode, by: 'gpsSwitch' }); showMsg(c1ModeName(), C1.mode === 'gps' ? '#5dff9a' : '#ffb030', 1.4); sfx('good');
}
function c1Mode() {
  const L = ['gps', 'atti', 'manual']; C1.mode = L[(L.indexOf(C1.mode) + 1) % 3]; C1.hold = null; C1.altT = null; C1.ei.set(0, 0, 0);
  c1Ev('mode', { mode: C1.mode }); showMsg(c1ModeName(), '#c9a2ff', 1.2);
}
function c1ModeName() { return { gps: L2('GPS 모드 (위치·고도 유지)', 'GPS mode (position + height hold)'), atti: L2('자세제어 ATTI (고도 유지 · 위치 유지 없음)', 'ATTI (height hold · no position hold)'), manual: L2('수동 (고도 유지 없음)', 'Manual (no height hold)') }[C1.mode]; }
// ---- 공간 가이드 (학습·시범): 3D 목표 기체(반투명) · 기체 아래 수직선 · 위에서 본 위치 게이지 ----
function c1Aid3D(st) {
  const G0 = C1G; if (!G0) return;
  if (!C1.ghost) {
    const gm = makeC1(true); C1.ghost = gm.g; C1.ghost.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.opacity = 0.32; o.material.color && o.material.color.set(0x7fe0ff); } o.castShadow = false; }); G0.add(C1.ghost);
    C1.dropV = new Float32Array(6); C1.poleV = new Float32Array(6);
    C1.drop = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(C1.dropV, 3)), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.75 })); C1.drop.frustumCulled = false; G0.add(C1.drop);
    C1.dropRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })); C1.dropRing.rotation.x = -Math.PI / 2; G0.add(C1.dropRing);
    C1.tgtRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })); C1.tgtRing.rotation.x = -Math.PI / 2; G0.add(C1.tgtRing);
    C1.tgtPole = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(C1.poleV, 3)), new THREE.LineBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.8 })); C1.tgtPole.frustumCulled = false; G0.add(C1.tgtPole);
  }
  const air = st && !DR.landed && C1.armed, sd = c1p('skidDrop');
  C1.drop.visible = C1.dropRing.visible = !!air;
  if (air) { const gy = c1Gnd() + 0.03, D = C1.dropV; D[0] = DR.p.x; D[1] = DR.p.y; D[2] = DR.p.z; D[3] = DR.p.x; D[4] = gy; D[5] = DR.p.z; C1.drop.geometry.attributes.position.needsUpdate = true;
    const ld = C1.drop.geometry.attributes.lineDistance || (C1.drop.geometry.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(2), 1)), C1.drop.geometry.attributes.lineDistance); ld.array[1] = DR.p.y - gy; ld.needsUpdate = true; C1.dropRing.position.set(DR.p.x, gy, DR.p.z); }
  const T = st && c1Tgt(st);
  C1.ghost.visible = C1.tgtRing.visible = C1.tgtPole.visible = !!T;
  if (!T) return;
  const p = c1W(T.u, T.v, T.alt + sd); C1.ghost.position.copy(p); C1.ghost.rotation.set(0, -(C1S.h + (T.hdg || 0) * DEG), 0);
  const gp = c1W(T.u, T.v, 0.04); C1.tgtRing.position.copy(gp); const r = st.alongTol ? 1 : c1R('posTol'); C1.tgtRing.scale.set(r, r, 1);
  { const V = C1.poleV; V[0] = gp.x; V[1] = gp.y; V[2] = gp.z; V[3] = p.x; V[4] = p.y; V[5] = p.z; C1.tgtPole.geometry.attributes.position.needsUpdate = true; }
}
// 지금 단계의 목표 (u, v, 고도, 기수) — 없으면 null
function c1Tgt(st) {
  const ref = C1.ref || 4;
  if (st.k === 'hold') return { u: st.at[0], v: st.at[1], alt: st.altWin ? ref + st.altWin[0] + 0.5 : c1AltTgt(st), hdg: st.hdg };
  if (st.k === 'climb') return { u: st.at[0], v: st.at[1], alt: 4, hdg: 0 };
  if (st.k === 'xfer') return { u: st.to[0], v: st.to[1], alt: ref, hdg: 0 };
  if (st.k === 'move') return { u: st.to[0], v: st.to[1], alt: ref + (st.r1 || 0), hdg: st.hdg };
  if (st.k === 'land' || st.k === 'emg') return { u: st.pad[0], v: st.pad[1], alt: 0, hdg: st.hdg || 0 };
  if (st.k === 'arc') return { u: st.start[0], v: st.start[1], alt: ref, hdg: null };
  return null;
}
function c1Gauge(st, M) {
  let cv = $('c1g'); if (!cv) { cv = document.createElement('canvas'); cv.id = 'c1g'; document.body.appendChild(cv); }
  const show = !!st && !C1.exam && !(typeof XR_ON !== 'undefined' && XR_ON) && S.state !== 'menu' && ['climb', 'hold', 'move', 'arc', 'emg', 'land', 'xfer'].includes(st.k) && !C1.over;
  cv.classList.toggle('hidden', !show); if (!show) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const small = W < 200, fs = small ? 9 : 11, foot = small ? 13 : 18, SZ = H - foot - 6, cx = 4 + SZ / 2, cy = 4 + SZ / 2, Rr = SZ / 2 - 2;
  const ref = C1.ref || 4, T = c1Tgt(st), pT = c1R('posTol'), aT = c1R('altTol');
  // 기준점: 이동·원주는 경로 위 가장 가까운 점, 나머지는 목표점
  let c = [T.u, T.v], span, dist = Math.hypot(M.u - T.u, M.v - T.v), info = '';
  if (st.k === 'move') { const a = st.from, b = st.to, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), al = clamp(((M.u - a[0]) * dx + (M.v - a[1]) * dy) / L, 0, L); c = [a[0] + dx / L * al, a[1] + dy / L * al]; span = 4; info = `${L2('남은', 'to go')} ${Math.max(0, L - al).toFixed(1)} m`; }
  else if (st.k === 'arc') { const du = M.u - st.c[0], dv = M.v - st.c[1], r = Math.hypot(du, dv) || 1; c = [st.c[0] + du / r * st.R, st.c[1] + dv / r * st.R]; span = 4; info = `◯ ${Math.min(360, Math.round(st.sweep || 0))}°`; }
  else { span = clamp(dist * 1.35, 2.4, 30); info = `${L2('목표까지', 'to target')} ${dist.toFixed(1)} m`; }
  const X = u => cx + (u - c[0]) / span * Rr, Y = v => cy - (v - c[1]) / span * Rr;
  g.save(); g.beginPath(); g.arc(cx, cy, Rr, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(40,70,40,.55)'; g.fillRect(cx - Rr, cy - Rr, Rr * 2, Rr * 2);
  // 1 m · 5 m 눈금 원
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.setLineDash([3, 3]);
  for (const k of [1, 2, 5, 10, 20]) { const rr = k / span * Rr; if (rr > 8 && rr < Rr * 0.98) { g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke(); } }
  g.setLineDash([]);
  // 경로·허용범위
  g.fillStyle = 'rgba(93,255,154,.18)'; g.strokeStyle = 'rgba(93,255,154,.85)'; g.lineWidth = 1.5;
  if (st.k === 'move') { const a = st.from, b = st.to, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * pT, ny = dx / L * pT;
    g.beginPath(); g.moveTo(X(a[0] + nx), Y(a[1] + ny)); g.lineTo(X(b[0] + nx), Y(b[1] + ny)); g.lineTo(X(b[0] - nx), Y(b[1] - ny)); g.lineTo(X(a[0] - nx), Y(a[1] - ny)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(79,227,255,.9)'; g.beginPath(); g.moveTo(X(a[0]), Y(a[1])); g.lineTo(X(b[0]), Y(b[1])); g.stroke(); }
  else if (st.k === 'arc') { g.lineWidth = 2 * pT / span * Rr; g.strokeStyle = 'rgba(93,255,154,.22)'; g.beginPath(); g.arc(X(st.c[0]), Y(st.c[1]), st.R / span * Rr, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(79,227,255,.9)'; g.beginPath(); g.arc(X(st.c[0]), Y(st.c[1]), st.R / span * Rr, 0, Math.PI * 2); g.stroke(); }
  if (st.k !== 'arc') { const tx = X(T.u), ty = Y(T.v);
    if (st.alongTol) { const w = pT / span * Rr, h = st.alongTol / span * Rr; g.fillRect(tx - w, ty - h, w * 2, h * 2); g.strokeRect(tx - w, ty - h, w * 2, h * 2); }
    else { const rr = (st.k === 'emg' ? 1.5 : pT) / span * Rr; g.beginPath(); g.arc(tx, ty, rr, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.strokeStyle = '#5dff9a'; g.beginPath(); g.moveTo(tx - 5, ty); g.lineTo(tx + 5, ty); g.moveTo(tx, ty - 5); g.lineTo(tx, ty + 5); g.stroke(); }
  // 지나온 길
  const tr = C1.gtr || (C1.gtr = []); tr.push([M.u, M.v]); if (tr.length > 60) tr.shift();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); tr.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.stroke();
  // 기체 (삼각형 = 기수 방향)
  const off = st.k === 'move' || st.k === 'arc' ? Math.hypot(M.u - c[0], M.v - c[1]) : dist, ratio = off / (st.k === 'emg' ? 1.5 : pT);
  const col = ratio < 0.5 ? '#7dffa8' : ratio < 1 ? '#ffd166' : '#ff7a6a', th = M.hdg * DEG, fx = Math.sin(th), fy = -Math.cos(th);
  let dx = X(M.u), dy = Y(M.v); const outR = Math.hypot(dx - cx, dy - cy) > Rr - 6; if (outR) { const k = (Rr - 8) / Math.hypot(dx - cx, dy - cy); dx = cx + (dx - cx) * k; dy = cy + (dy - cy) * k; }
  g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.moveTo(dx + fx * 9, dy + fy * 9); g.lineTo(dx - fx * 6 + fy * 6, dy - fy * 6 - fx * 6); g.lineTo(dx - fx * 6 - fy * 6, dy - fy * 6 + fx * 6); g.closePath(); g.fill(); g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(cx, cy, Rr, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `${fs}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText(L2('먼 쪽', 'far'), cx, 4 + fs); g.fillText(L2('조종자', 'pilot'), cx, cy + Rr - 3);
  // 고도 막대
  const bx = 4 + SZ + (small ? 8 : 14), bw = small ? 12 : 16, top = 8 + fs, bot = 4 + SZ, tgtA = st.k === 'climb' ? 4 : T.alt, hmax = Math.max(8, tgtA + 3, M.alt + 1), yA = a => bot - clamp(a, 0, hmax) / hmax * (bot - top);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(bx, top, bw, bot - top);
  const band = st.k === 'climb' ? [c1R('refMin'), c1R('refMax')] : st.altWin ? [ref + st.altWin[0], ref + st.altWin[1]] : (st.k === 'land' || st.k === 'emg') ? null : [tgtA - aT, tgtA + aT];
  if (band) { g.fillStyle = 'rgba(93,255,154,.45)'; g.fillRect(bx, yA(band[1]), bw, yA(band[0]) - yA(band[1])); }
  const aOk = !band || (M.alt >= band[0] && M.alt <= band[1]); g.fillStyle = aOk ? '#7dffa8' : '#ffd166';
  const ay = yA(M.alt); g.beginPath(); g.moveTo(bx + bw + 7, ay - 5); g.lineTo(bx + bw + 1, ay); g.lineTo(bx + bw + 7, ay + 5); g.fill(); g.fillRect(bx - 2, ay - 1, bw + 4, 2);
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(M.alt.toFixed(1) + 'm', bx + bw + 9, ay + 4);
  g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(L2('고도', 'alt'), bx - 2, 4 + fs);
  // 아래 글: 목표까지 · 기수
  const he = T.hdg == null ? null : c1Wrap(T.hdg - M.hdg);
  g.font = `${small ? 10 : 12}px system-ui,sans-serif`; g.textAlign = 'left'; g.fillStyle = col; g.fillText(info, 6, H - 5);
  if (he != null) { g.textAlign = 'right'; g.fillStyle = Math.abs(he) <= c1R('hdgTol') * 0.5 ? '#7dffa8' : Math.abs(he) <= c1R('hdgTol') ? '#ffd166' : '#ff7a6a'; g.fillText(Math.abs(he) < 1 ? `${L2('기수', 'nose')} 0°` : `${L2('기수', 'nose')} ${Math.round(Math.abs(he))}° ${he > 0 ? L2('좌', 'L') : L2('우', 'R')}`, W - 6, H - 5); }
}
// ---- 연습 코치: 지금 무엇을 얼마나 고치면 되는지 (모드2 스틱 기준 · 기체 기준 방향) ----
function c1Coach(st, M) {
  const out = [], th = M.hdg * DEG, F = [Math.sin(th), Math.cos(th)], Rt = [Math.cos(th), -Math.sin(th)], wrap = c1Wrap;
  const ref = C1.ref || 4, pT = c1R('posTol'), aT = c1R('altTol'), hT = st.k === 'emg' ? c1R('hdgTolEmg') : c1R('hdgTol');
  const f1 = x => Math.abs(x).toFixed(Math.abs(x) < 10 ? 1 : 0);
  const lv = r => r < 0.5 ? 'cg' : r < 1 ? 'cy' : 'cr';
  const add = (ratio, html) => out.push({ ratio, html: `<div class="${lv(ratio)}">${html}</div>` });
  const side = Math.abs(wrap(M.hdg)) > 45 ? ` <i>(${L2('기체 기준', 'from the aircraft')})</i>` : '';
  // 위치: 목표점까지 차이를 기체 앞/옆으로 나눠 스틱으로
  const pos = (du, dv, tol, what) => {
    const fw = du * F[0] + dv * F[1], rt = du * Rt[0] + dv * Rt[1], d = Math.hypot(du, dv); if (d < 0.12) return;
    const parts = [];
    if (Math.abs(fw) >= 0.12) parts.push(fw > 0 ? L2(`엘리베이터 ↑ 앞으로 ${f1(fw)} m`, `elevator ↑ forward ${f1(fw)} m`) : L2(`엘리베이터 ↓ 뒤로 ${f1(fw)} m`, `elevator ↓ back ${f1(fw)} m`));
    if (Math.abs(rt) >= 0.12) parts.push(rt > 0 ? L2(`에일러론 → 오른쪽 ${f1(rt)} m`, `aileron → right ${f1(rt)} m`) : L2(`에일러론 ← 왼쪽 ${f1(rt)} m`, `aileron ← left ${f1(rt)} m`));
    add(d / tol, `${what || L2('위치', 'Position')} <b>${d.toFixed(1)} m</b> ${L2('벗어남', 'off')} → ${parts.join(' · ')}${side}`);
  };
  const alt = (tgt, tol) => { const e = tgt - M.alt; if (Math.abs(e) < 0.08) return; add(Math.abs(e) / tol, `${L2('고도', 'Height')} <b>${f1(e)} m ${e > 0 ? L2('낮음', 'low') : L2('높음', 'high')}</b> → ${e > 0 ? L2('스로틀 ↑ 살짝', 'throttle ↑ a little') : L2('스로틀 ↓ 살짝', 'throttle ↓ a little')} <i>(${L2('목표', 'target')} ${tgt.toFixed(1)} m ±${tol})</i>`); };
  const hdg = (tgt, tol) => { const e = wrap(tgt - M.hdg); if (Math.abs(e) < 3) return; add(Math.abs(e) / tol, `${L2('기수가', 'Nose')} <b>${f1(e)}° ${e > 0 ? L2('왼쪽으로', 'left') : L2('오른쪽으로', 'right')}</b> ${L2('틀어짐', 'of target')} → ${e > 0 ? L2('러더 → (오른쪽으로)', 'rudder → (right)') : L2('러더 ← (왼쪽으로)', 'rudder ← (left)')} <i>(±${tol}°)</i>`); };
  const good = t => `<div class="cg">✓ ${t}</div>`;
  let lead = '';
  if (st.k === 'climb') {
    const lo = c1R('refMin'), hi = c1R('refMax');
    if (M.alt < lo - aT) { lead = M.vy < 0.2 && M.alt > 0.6 ? `<div class="cr">⚠ ${L2('상승이 멈췄어요 — 기준고도(3~5 m)까지 한 번에 올리기', 'Climb stalled — go up to 3–5 m in one go')}</div>` : `<div class="cy">⬆ ${L2('스로틀 ↑ 로 3~5 m 까지 멈추지 말고 상승', 'Throttle ↑ — climb to 3–5 m without stopping')} <i>(${L2('지금', 'now')} ${M.alt.toFixed(1)} m)</i></div>`; }
    else if (M.alt > hi + aT) lead = `<div class="cr">⬇ ${L2('5 m 넘음 → 스로틀 ↓ 로 범위 안으로', 'Above 5 m → throttle ↓ back into range')}</div>`;
    else lead = good(L2('기준고도 범위 안 — 스로틀 중립으로 멈추면 이 높이가 기준고도가 됩니다', 'In range — centre the throttle; this height becomes your reference'));
    pos(st.at[0] - M.u, st.at[1] - M.v, pT); hdg(0, hT);
  } else if (st.k === 'hold') {
    const du = st.at[0] - M.u, dv = st.at[1] - M.v, d = Math.hypot(du, dv);
    if (!st.armedEval && d > 1.5) lead = `<div class="cy">➜ ${L2('목표 지점까지', 'To the point')} <b>${d.toFixed(1)} m</b> — ${L2('2 m 전부터 천천히 감속', 'ease off from 2 m out')}</div>`;
    else if (st.armedEval) { const left = Math.max(0, st.T - st.t); lead = left > 0 ? `<div class="cg">⏱ ${L2('정지 중', 'Holding')} ${st.t.toFixed(1)} / ${st.T} s — ${L2('스틱은 중립, 아주 작은 수정만', 'sticks centred, tiny corrections only')}</div>` : good(L2('정지 완료', 'Hold complete')); }
    if (st.altWin) { const lo = ref + st.altWin[0], hi = ref + st.altWin[1]; if (M.alt < lo) add((lo - M.alt) / aT, `${L2('고도', 'Height')} <b>${(lo - M.alt).toFixed(1)} m ${L2('더 올리기', 'more')}</b> → ${L2('스로틀 ↑', 'throttle ↑')} <i>(${L2('기준+2 m 이상', 'ref +2 m or more')})</i>`); else if (M.alt > hi) alt(hi, aT); }
    else alt(c1AltTgt(st), aT);
    pos(du, dv, st.posWatch === 'xy' ? pT : pT); hdg(st.hdg, hT);
  } else if (st.k === 'move') {
    const a = st.from, b = st.to, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const al = (M.u - a[0]) * ux + (M.v - a[1]) * uy, cr = -(M.u - a[0]) * uy + (M.v - a[1]) * ux, sp = clamp(al / L, 0, 1);
    const vAl = DR.v.x * (Math.cos(C1S.h) * ux + Math.sin(C1S.h) * uy) + DR.v.z * (Math.sin(C1S.h) * ux - Math.cos(C1S.h) * uy);
    const pc = Math.round(sp * 100), rem = Math.max(0, L - al);
    if (st.alongTol && Math.abs(al - L) <= st.alongTol) lead = `<div class="cg">✓ ${L2('E 인정 범위(전후 ±5 m) 안 — 여기서 멈추면 정지로 넘어갑니다', 'Inside the E zone (±5 m) — stop here to start the hold')} <i>(E ${al - L >= 0 ? '+' : ''}${(al - L).toFixed(1)} m)</i></div>`;
    else if (sp > 0.06 && sp < 0.94 && Math.abs(vAl) < c1R('stopV') + 0.1) lead = `<div class="cr">⚠ ${L2('멈추면 감점 — 같은 속도로 계속 이동', 'Stopping costs points — keep moving at the same speed')}</div>`;
    else if (vAl > 2.6) lead = `<div class="cy">🐢 ${L2('조금 천천히 — 지나치기 쉬워요', 'A bit slower — easy to overshoot')} <i>(${vAl.toFixed(1)} m/s)</i></div>`;
    else lead = `<div class="cg">➜ ${pc}% · ${L2('남은 거리', 'to go')} ${rem.toFixed(1)} m · ${Math.max(0, vAl).toFixed(1)} m/s${rem < 3 && rem > 0.3 ? ' — ' + L2('감속 준비', 'start easing off') : ''}</div>`;
    // 경로 옆으로 벗어남 (기체 기준 좌우/앞뒤로 바꿔 안내)
    const pu = -uy * cr, pv = ux * cr; pos(-pu, -pv, pT, L2('경로에서', 'Off the line by'));
    alt(ref + (st.r0 || 0) + ((st.r1 || 0) - (st.r0 || 0)) * clamp(al / L, 0, 1), aT); hdg(st.hdg, hT);
  } else if (st.k === 'arc') {
    const du = M.u - st.c[0], dv = M.v - st.c[1], r = Math.hypot(du, dv), e = r - st.R, sw = Math.round(st.sweep || 0);
    lead = `<div class="cg">◯ ${Math.min(360, sw)}° / 360° · ${L2('반경', 'radius')} ${r.toFixed(1)} m (${st.R} m)</div>`;
    if (Math.abs(e) > 0.12) pos(-du / r * e, -dv / r * e, pT, e > 0 ? L2('원 바깥으로', 'Outside the circle') : L2('원 안쪽으로', 'Inside the circle'));
    const tang = c1Wrap(Math.atan2(du, dv) / DEG + 90 * (st.dir < 0 ? 1 : -1)); hdg(tang, hT); alt(ref, aT);
    if (M.hs < 0.35 && sw > 10 && sw < 340) lead = `<div class="cr">⚠ ${L2('원주 중간에 멈추지 않기 — 에일러론+러더를 함께 계속', 'Don\'t stop mid-circle — keep aileron and rudder going together')}</div>`;
  } else if (st.k === 'emg') {
    const need = Math.max(c1R('emgRefDefault'), C1.refDesc || 0) * c1R('emgRatio'), vs = -M.vy;
    lead = M.alt > 0.3 ? `<div class="${vs >= need ? 'cg' : 'cr'}">⬇ ${L2('하강', 'Descent')} <b>${Math.max(0, vs).toFixed(1)} m/s</b> ${vs >= need ? '✓' : '— ' + L2('더 빠르게 (스로틀 ↓ 크게)', 'faster (throttle ↓ more)')} <i>(${L2('필요', 'need')} ≥ ${need.toFixed(1)} m/s)</i></div>` : '';
    pos(st.pad[0] - M.u, st.pad[1] - M.v, 2.5, L2('비상 착륙장(F)까지', 'To the emergency pad (F)'));
  } else if (st.k === 'land') {
    const du = st.pad[0] - M.u, dv = st.pad[1] - M.v, d = Math.hypot(du, dv);
    lead = d > 0.4 ? `<div class="cy">⬇ ${L2('먼저 패드 중앙 위로 맞추고 내려오기', 'Line up over the pad centre first, then descend')}</div>` : M.alt > 1 ? `<div class="cg">⬇ ${L2('천천히 강하', 'Descend slowly')} <i>(${M.alt.toFixed(1)} m)</i></div>` : `<div class="cg">⬇ ${L2('1 m 아래 — 아주 천천히, 접지하면 스로틀 끝까지 ↓', 'Below 1 m — very gently; on touchdown throttle fully ↓')}</div>`;
    pos(du, dv, pT, L2('패드 중심에서', 'From the pad centre')); hdg(st.hdg, hT);
  } else if (st.k === 'xfer') {
    const du = st.to[0] - M.u, dv = st.to[1] - M.v; lead = `<div class="cg">➜ ${L2('다음 위치로 이동 (평가 제외)', 'Move to the next position (not scored)')} · ${Math.hypot(du, dv).toFixed(1)} m</div>`;
  } else if (st.k === 'arm' && st.csc && !C1.armed) lead = `<div class="cy">🔑 ${L2('두 스틱을 아래·안쪽으로 0.5초 (또는 다음 ▶)', 'Both sticks down-and-in for 0.5 s (or NEXT ▶)')}</div>`;
  else if (st.k === 'mode') lead = `<div class="cy">🔀 ${st.gps ? L2('GPS 스위치 ON (H 또는 GPS 버튼)', 'GPS switch ON (H or the GPS button)') : L2('GPS 스위치 OFF → ATTI (H 또는 GPS 버튼) · 이제 바람에 흐르는 것을 직접 잡아야 함', 'GPS switch OFF → ATTI (H or the GPS button) · you now correct drift yourself')}</div>`;
  else if (st.k === 'callout') lead = `<div class="cr">📣 ${L2('"비상!" 외치기 (🚨 비상 버튼 또는 E)', 'Call "Emergency!" (🚨 button or E)')}</div>`;
  if (!lead && !out.length) return '';
  out.sort((x, y) => y.ratio - x.ratio);
  const fixes = out.filter(o => o.ratio >= 0.3).slice(0, 3).map(o => o.html).join('');
  const ok = (['hold', 'move', 'arc', 'land', 'climb'].includes(st.k) && !fixes) ? good(L2('위치·고도·기수 모두 허용범위 안 — 그대로 유지', 'Position, height and heading all in limits — hold it')) : '';
  return lead + fixes + ok;
}
// ---- 시범비행: 자동 조종이 시험 순서대로 비행 (구호·정지 세기·관전 포인트 안내) ----
const C1TIP = {
  pre: ['호명 → 기체 점검 구호 → 조종기 점검(스틱 끝까지) 구호 → 공역·풍향·풍속 확인 구호. 구호를 외치면 다음 단계로 넘어갑니다.', 'Call-up → airframe check call → transmitter check (full stick travel) call → airspace and wind call. Each call moves you on.'],
  to: ['시동 → 3~5 m 기준고도까지 한 번에 상승(중간에 멈추면 감점) → 정지 5초 → 조종면 점검 구호 → 호버링 위치(A)로.', 'Start → climb in one go to a 3–5 m reference height (no stopping) → hold 5 s → control check call → move to the hover point (A).'],
  hov: ['제자리에서 기수만 90°씩 돌리고 각 방향에서 정지 5초. 위치 ±1 m · 고도 ±0.5 m · 기수 ±15° 안.', 'Turn only the nose 90° at a time and hold 5 s each way. Position ±1 m · height ±0.5 m · heading ±15°.'],
  fb: ['A → E 40 m 전진, 다시 A 로 후진. 일정한 속도로 중간에 멈추지 않기, 끝에서 정지 5초.', 'Forward 40 m from A to E, then back to A. Steady speed with no stops; hold 5 s at each end.'],
  tri: ['옆으로 수평 이동 → 45° 사선 상승(A 위 +7.5 m) → 반대쪽으로 45° 사선 하강 → A 로 복귀. 오르내리는 기울기가 일정해야 합니다.', 'Level sideways → 45° climb to A +7.5 m → 45° descent to the other side → back to A. Keep the slope steady.'],
  cir: ['기수를 진행 방향으로 돌리며(러더턴) 반경 7.5 m 원을 일정한 속도로. 출발점에서 정지 후 기수 전방.', 'Fly a 7.5 m circle nose-first (rudder turn) at a steady speed. Hold at the start, then nose forward.'],
  emg: ['2 m 상승 → "비상!" → 즉시 빠르게(평소 1.5배) 하강하며 비상 착륙장(F)에 착지. 내려오다 멈추지 않기.', 'Climb 2 m → "Emergency!" → descend at once, fast (1.5× normal), to the emergency pad (F). No pauses on the way down.'],
  nrm: ['GPS 끄기(ATTI) → 위치 유지가 없어 바람에 흐르는 것을 직접 잡으며 H 로 접근 → 중심축 맞춰 착륙.', 'GPS off (ATTI) → no position hold, so correct the drift yourself on the way to H → land on the centre axis.'],
  xw: ['GPS 다시 켜기 → 바람 쪽으로 기수를 돌린 측면 자세로 H 까지 직선 접근 → 착륙.', 'GPS back on → nose turned into the wind, fly sideways straight to H → land.'],
  post: ['시동 끄고 아워미터·전원 OFF → 외관 점검 → 배터리 분리 구호.', 'Shut down, hour meter, power off → airframe check → battery removal call.'],
  oral: ['구술 5문항. 시범에서는 정답을 골라 보여 줍니다.', 'Five oral questions. The demo picks the right answers.']
};
function c1DemoBanner(m) {
  let b = $('c1demo'); if (!b) { b = document.createElement('div'); b.id = 'c1demo'; document.body.appendChild(b); b.title = L2('누르면 접기/펴기', 'Tap to fold/unfold'); b.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); b._open = b.classList.contains('small'); b.classList.toggle('small', !b._open); }; }
  const learn = !C1.demo && !C1.exam, key = m ? m.id + '|' + C1.mi + '|' + (window.SIM_LANG || 'ko') : '';
  if (b._k !== key) { b._k = key; b._t = C1.t; }
  const on = (C1.demo || learn) && !C1.over && S.state !== 'menu' && m && C1TIP[m.id]; b.classList.toggle('hidden', !on); if (!on) return;
  const tip = C1TIP[m.id];
  if (b._h !== key) { b._h = key; b.innerHTML = `<b>${C1.demo ? '▶ ' + L2('시범비행', 'DEMO') : '📘 ' + L2('요령', 'HOW TO')} ${C1.mi + 1}/${C1.M.length} · ${m.name}</b><span>${L2(tip[0], tip[1])}</span>`; b._open = null; }
  b.classList.toggle('small', b._open != null ? !b._open : (C1.t - b._t > (C1.demo ? 10 : 15)));
}
function c1DemoCtl() {
  const st = c1Cur(); if (!st || C1.over) { IN.pitch = IN.roll = IN.yaw = 0; IN.thr = -1; return; }
  const M = c1M(), ref = C1.ref || 4, g = G, wrap = d => ((d + 180) % 360 + 360) % 360 - 180, cl1 = x => clamp(x, -1, 1), cl01 = x => clamp(x, 0, 1);
  const FW = [Math.sin(DR.h), -Math.cos(DR.h)], RT = [Math.cos(DR.h), Math.sin(DR.h)];
  const D = C1.dm || (C1.dm = { cd: 0, si: -1 }); if (D.si !== C1.mi * 100 + C1.si) { D.si = C1.mi * 100 + C1.si; D.t0 = C1.t; D.n = 0; }
  const idle = C1.t >= (C1.sayUntil || 0) - 0.05, age = C1.t - D.t0;
  const press = (k, wait) => { if (C1.t >= D.cd && age >= (wait == null ? 1.0 : wait) && idle) { c1DK(k); D.cd = C1.t + 0.6; return true; } return false; };
  let tu = M.u, tv = M.v, ta = M.alt, th = M.hdg, vmax = 1.2, vzO = null, ff = 0, still = false, fix = null;
  const flight = ['climb', 'hold', 'move', 'arc', 'xfer', 'emg', 'land'].includes(st.k);
  // 구호: 이동 전에 먼저 외치고(음성이 끝난 뒤) 움직임 · 정지 구호는 도착 후 세기는 앱이 함
  const callFirst = st.call && !st.callSaid && ['move', 'arc', 'xfer', 'climb', 'mode'].includes(st.k);
  if (st.call && !st.callSaid && st.k === 'hold') press('KeyQ', 0.2);
  if (callFirst) press('KeyQ', 0.6);
  if (st.k === 'inspect') { if (st.open && !st.done && age > 3 && idle) c1InspectAuto(true); still = true; }
  else if (st.k === 'oral') { if (st.qs && !st.done && age > 3 && idle) c1OralAuto(5); still = true; }
  else if (st.k === 'ann') still = true;
  else if (st.k === 'rc') { if (!st.callSaid && age > 1) { const seq = [{ thr: 1 }, { thr: -1 }, { yaw: 1 }, { yaw: -1 }, { pitch: 1 }, { pitch: -1 }, { roll: 1 }, { roll: -1 }]; const i = Math.floor((age - 1) / 0.45); fix = i < seq.length ? Object.assign({ thr: 0, yaw: 0, pitch: 0, roll: 0 }, seq[i]) : null; if (i >= seq.length) press('KeyQ', 0); } if (!fix) fix = { thr: 0, yaw: 0, pitch: 0, roll: 0 }; if (C1.mode !== 'gps') press('KeyH', 0.5); still = true; }
  else if (st.k === 'ctl') { const seq = [{ pitch: 0.25 }, { pitch: -0.25 }, { roll: 0.25 }, { roll: -0.25 }, { yaw: 0.3 }, { yaw: -0.3 }]; const i = Math.floor(age / 0.6); if (i < seq.length) fix = Object.assign({ pitch: 0, roll: 0, yaw: 0 }, seq[i]); else if (!st.callSaid) press('KeyQ', 0); }
  else if (st.k === 'prep') { press(st.call ? 'KeyQ' : 'Enter', 1.2); still = true; }
  else if (st.k === 'arm') { if (st.call && !st.callSaid) press('KeyQ', 1.0); else press('Enter', 1.0); still = true; }
  else if (st.k === 'disarm') { if (DR.landed && M.hs < 0.2) { if (st.call && !st.callSaid) press('KeyQ', 0.8); else press('Enter', 0.8); } still = DR.landed; }
  else if (st.k === 'mode') { if (st.callSaid && C1.t >= D.cd) { if (st.gps ? C1.mode !== 'gps' : C1.mode === 'gps') press('KeyH', 0.3); } still = DR.landed; }
  else if (st.k === 'callout') { press('KeyE', 0.6); }
  if (st.k === 'climb') { tu = st.at[0]; tv = st.at[1]; ta = 4.0; th = 0; }
  else if (st.k === 'hold') { tu = st.at[0]; tv = st.at[1]; ta = st.altWin ? ref + st.altWin[0] + 0.8 : ref + (st.r || 0); th = st.hdg; }
  else if (st.k === 'xfer') { tu = st.to[0]; tv = st.to[1]; ta = ref; th = 0; }
  else if (st.k === 'move') {
    const a = st.from, b = st.to, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const sp = cl01(((M.u - a[0]) * ux + (M.v - a[1]) * uy + 2.0) / L); tu = a[0] + dx * sp; tv = a[1] + dy * sp;
    const sp0 = cl01(((M.u - a[0]) * ux + (M.v - a[1]) * uy) / L); ta = ref + (st.r0 || 0) + ((st.r1 || 0) - (st.r0 || 0)) * sp0; th = st.hdg; vmax = (st.r0 || st.r1) ? 0.7 : 1.3;
    if (st.r0 || st.r1) { const vAl = DR.v.x * ux + (-DR.v.z) * uy; ff = ((st.r1 || 0) - (st.r0 || 0)) / L * vAl; }
  } else if (st.k === 'arc') {
    const dir = st.dir < 0 ? 1 : -1, thp = Math.atan2(M.u - st.c[0], M.v - st.c[1]) / DEG, ah = (thp + dir * 25) * DEG;
    tu = st.c[0] + Math.sin(ah) * st.R; tv = st.c[1] + Math.cos(ah) * st.R; ta = ref; th = wrap(thp + 90 * dir); vmax = 1.4;
    if (st.sweep > 320) { tu = st.start[0]; tv = st.start[1]; vmax = 0.8; }
  } else if (st.k === 'emg') { tu = st.pad[0]; tv = st.pad[1]; ta = 0; th = 0; vmax = 3.5; vzO = -2.0; }
  else if (st.k === 'land') { tu = st.pad[0]; tv = st.pad[1]; ta = 0; th = st.hdg; vmax = 0.8; vzO = Math.hypot(M.u - tu, M.v - tv) < 0.4 ? -0.6 : 0; }
  if (callFirst && flight) { tu = M.u; tv = M.v; ta = DR.landed ? 0 : M.alt; th = M.hdg; vzO = DR.landed ? -1 : null; }
  let vu = (tu - M.u) * 0.9, vv = (tv - M.v) * 0.9; const vl = Math.hypot(vu, vv); if (vl > vmax) { vu *= vmax / vl; vv *= vmax / vl; }
  const hh = C1S.h, vx = Math.cos(hh) * vu + Math.sin(hh) * vv, vz = Math.sin(hh) * vu - Math.cos(hh) * vv;
  let pit, rol;
  if (C1.mode === 'gps') { pit = (vx * FW[0] + vz * FW[1]) / C1P.gpsV.v; rol = (vx * RT[0] + vz * RT[1]) / C1P.gpsV.v; }
  else { const ax = (vx - DR.v.x) * 1.6, az = (vz - DR.v.z) * 1.6, tm = C1P.tiltMax.v * DEG; pit = Math.atan((ax * FW[0] + az * FW[1]) / g) / tm; rol = Math.atan((ax * RT[0] + az * RT[1]) / g) / tm; }
  const he = wrap(th - M.hdg);
  const vzd = vzO != null ? vzO : Math.max(-1.2, Math.min(1.5, ff + (ta - M.alt) * 1.5));
  let thr;
  if (C1.mode === 'manual') { const aUp = C1P.thrustMaxN.v / C1P.flightKg.v - g; thr = ((vzd - M.vy) * 2.5) / (vzd - M.vy >= 0 ? aUp * 0.6 : g * 0.55); }
  else thr = vzd > 0 ? vzd / C1P.climb.v : vzd / C1P.sink.v;
  if (still || (!flight && DR.landed)) { thr = DR.landed ? -1 : thr; pit = rol = 0; }
  if (DR.landed && (st.k === 'land' || st.k === 'emg' || st.k === 'disarm')) { thr = -1; pit = rol = 0; }
  IN.pitch = cl1(pit); IN.roll = cl1(rol); IN.yaw = cl1(he * 0.05); IN.thr = cl1(thr);
  if (fix) for (const k in fix) IN[k] = fix[k];
}
// 학습: 기동 번호로 바로 이동 (1~9)
function c1Jump(i, again) {
  i = clamp(i | 0, 0, C1.M.length - 1); if (!C1.M[i]) return;
  const fresh = c1Build(C1.side)[i]; fresh.label = fresh.name; fresh.done = false; fresh.miss = false; fresh.why = []; fresh.steps.forEach(s => s.T = s.T || c1R('hoverT')); C1.M[i] = fresh;
  for (let j = i; j < C1.M.length; j++) { C1.M[j].done = false; C1.M[j].miss = false; }
  C1.mi = i; C1.si = 0; MS.idx = i; C1.ref = C1.ref || 4; C1.hold = null; C1.altT = null; C1.ei.set(0, 0, 0); C1.touch = null; C1.crash = null;
  const ref = C1.ref, sb = C1.side < 0 ? C1PT.B : C1PT.D, f = C1.side < 0 ? C1PT.FB : C1PT.FD;
  const air = (uv, r) => ({ p: c1W(uv[0], uv[1], ref + (r || 0) + c1p('skidDrop')), gnd: false });
  const pose = [{ p: c1W(0, 15, c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }, air(C1PT.A), air(C1PT.A), air(C1PT.A), air(C1PT.H), air(C1PT.H), { p: c1W(f[0], f[1], c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }][i] || air(C1PT.H);
  resetDrone(pose.p, C1S.h); DR.landed = pose.gnd; C1.az = 0; C1.yr = 0;
  C1.armed = (i > 0 && !pose.gnd) || i === 1; if (i === 0) { C1.ref = null; C1.tArm = null; } C1.introCam = false; c1ModalClose();
  C1.mode = 'gps';
  c1Ev('jump', { to: C1.M[i].id, again: !!again }); renderList();
  const st = c1Cur(); if (st) { st.t0 = C1.t; st.wait = true; }
  if (!again) showMsg(C1.M[i].name, '#c9a2ff', 1.2);
}

// ---- 화면 ----
function c1Panel(show) {
  let el = $('c1p');
  if (!el) {
    const css = document.createElement('style');
    css.textContent = `#c1p{position:fixed;left:10px;top:112px;width:290px;max-height:calc(100vh - 230px);overflow:auto;z-index:6;background:rgba(10,14,20,.64);border:1px solid rgba(201,162,255,.5);border-radius:10px;color:#e8eef3;font:13px/1.35 system-ui,sans-serif;padding:8px 10px;pointer-events:auto}
#c1p.hidden{display:none}#c1p .t{cursor:move;user-select:none;-webkit-user-select:none;touch-action:none}#c1p .t::before{content:'⠿ ';opacity:.6}#c1p .t::after{content:'▾';float:right;opacity:.75;padding-left:6px}#c1p.mini .t::after{content:'▸'}#c1p.mini .s,#c1p.mini .cl,#c1p.mini .r,#c1p.mini canvas,#c1p.mini .note{display:none}#c1p.mini .co div:nth-child(n+2){display:none}#c1p .t{font-weight:700;color:#c9a2ff;font-size:12px;letter-spacing:.04em}#c1p .m{font-size:15px;font-weight:700;margin-top:2px}#c1p .s{color:#ffc828;margin:2px 0 4px}
#c1p .r{display:grid;grid-template-columns:auto 1fr;gap:1px 8px;font-variant-numeric:tabular-nums}#c1p .r b{font-weight:600;color:#9fb0bd}#c1p .bad{color:#ff7a5a}#c1p .ok{color:#5dff9a}
#c1p .bt{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}#c1p .bt button{flex:1 1 auto;min-width:56px;padding:6px 4px;border-radius:6px;border:1px solid #4a5560;background:#1d252d;color:#e8eef3;font-size:12px}
#c1p canvas{width:100%;height:auto;max-height:150px;object-fit:contain;margin-top:6px;border-radius:6px;background:#1b2a1a}#c1p .note{color:#8f9aa3;font-size:11px;margin-top:4px}
body.c1on #tbBoost,body.c1on #tbDrop,body.c1on #tbPhoto,body.c1on #tbGuide,body.c1on #tbBelly,body.c1on #tbIR{display:none!important}
#c1p .cl{color:#7fd0ff;margin:2px 0}#c1p .bt button#c1Gp.on{background:#1f5a32;border-color:#5dff9a;color:#bfffd2;font-weight:700}#c1p .bt button#c1Gp.off{background:#5a3a14;border-color:#ffb030;color:#ffe2b0;font-weight:700}
#c1p i.pb{display:inline-block;width:70px;height:7px;background:#2a333c;border-radius:4px;vertical-align:middle;overflow:hidden}#c1p i.pb i{display:block;height:100%;background:#5dff9a}#c1p .okf{font-weight:700;font-size:14px}#c1p .co{margin:3px 0;font-size:12.5px;line-height:1.45}#c1p .co:empty{display:none}#c1p .co div{padding:1px 0}#c1p .co .cg{color:#7dffa8}#c1p .co .cy{color:#ffd166}#c1p .co .cr{color:#ff7a6a}#c1p .co i{font-style:normal;color:#9fb3c8;font-size:11px}#c1p .co b{color:#fff}body.touch #c1p .co{font-size:11px;margin:1px 0}body.touch #c1p .co div:nth-child(n+2){display:none}body.touch #c1p .co div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#c1p .bt.main button{flex:1 1 0;font-size:13px;padding:8px 4px;font-weight:700}#c1p .bt.sub{margin-top:4px}#c1p .bt.sub button{flex:1 1 auto;min-width:0;font-size:11px;padding:4px 3px;background:#151c22}#c1p .bt button#c1Em{background:#4a1a1a;border-color:#ff6060;color:#ffd0d0}body.touch #c1p .bts{display:flex;gap:3px;margin-top:3px}body.touch #c1p .bts .bt{margin:0;flex:1 1 0}body.touch #c1p .bts .bt.main{flex:1.3 1 0}body.touch #c1p .bt button{white-space:nowrap;overflow:hidden;letter-spacing:-.3px}#c1p .bt button small{margin-left:4px;font-size:9px;opacity:.6;border:1px solid #6a7580;border-radius:3px;padding:0 2px}body.touch #c1p .bt button small{display:none}#c1p .bt button.need{background:#14506e;border-color:#7fd0ff;color:#fff;font-weight:700;animation:c1need 1s ease-in-out infinite}@keyframes c1need{0%,100%{box-shadow:0 0 0 0 rgba(127,208,255,0);filter:brightness(1)}50%{box-shadow:0 0 0 4px rgba(127,208,255,.75);filter:brightness(1.45)}}#c1p.demo .bts,body.touch #c1p.demo .bts{display:none}#c1demo{position:fixed;left:50%;transform:translateX(-50%);top:58px;z-index:30;max-width:min(680px,92vw);background:rgba(20,16,40,.72);border:1px solid #c9a2ff;border-radius:8px;padding:6px 12px;color:#efe6ff;font-size:13px;line-height:1.45;pointer-events:auto;cursor:pointer}#c1demo.small{padding:3px 10px;font-size:12px}#c1demo.small span{display:none}#c1demo.small b::after{content:' ▸';opacity:.7}#c1demo b{color:#c9a2ff;margin-right:6px}#c1demo.hidden{display:none}body.touch #c1demo{top:auto;bottom:8px;font-size:11px;max-width:60vw}#c1p .cl i{color:#9aa6ad;font-style:normal}#c1p .bt button.on{background:#2c5a36;border-color:#5dff9a}
#c1cap{position:fixed;left:50%;top:136px;transform:translateX(-50%);max-width:min(760px,92vw);background:rgba(8,12,18,.86);border:1px solid #ffc828;border-radius:10px;padding:8px 14px;color:#fff;font:15px/1.4 system-ui,sans-serif;z-index:8;opacity:0;transition:opacity .25s;pointer-events:none}
#c1cap.on{opacity:1}#c1cap b{color:#ffc828;margin-right:6px}#c1cap.me{border-color:#7fd0ff}#c1cap.me b{color:#7fd0ff}
#c1m{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}#c1m.hidden{display:none}
#c1m .box{background:#11161c;border:1px solid #c9a2ff;border-radius:12px;padding:14px 16px;max-width:min(640px,94vw);max-height:90vh;overflow:auto;color:#e8eef3;font:14px/1.45 system-ui,sans-serif}
#c1m h3{margin:0 0 6px;color:#c9a2ff}#c1m table{width:100%;border-collapse:collapse;margin:8px 0}#c1m td{padding:5px 4px;border-bottom:1px solid #26303a;vertical-align:middle}
#c1m td button{margin:0 2px;padding:6px 10px;border-radius:6px;border:1px solid #4a5560;background:#1d252d;color:#e8eef3}#c1m td button.on{background:#2c5a36;border-color:#5dff9a}
#c1m .primary{margin-top:6px;padding:9px 16px;border-radius:8px;border:0;background:#ffc828;color:#111;font-weight:700}#c1m .primary:disabled{opacity:.4}
#c1m .opt{display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px;border-radius:8px;border:1px solid #4a5560;background:#1d252d;color:#e8eef3;font-size:14px}#c1m .q{font-size:16px;font-weight:600}#c1m .dim{color:#8f9aa3;font-size:12px}
body.touch #c1p .s,body.touch #c1p .cl,body.touch #c1p .m,body.touch #c1p .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.touch #c1p{left:150px;right:280px;top:36px;width:auto;max-height:calc(38vh - 40px);overflow:hidden;padding:4px 8px;font-size:11px;line-height:1.25}
body.touch #c1p .r,body.touch #c1p canvas,body.touch #c1p .note{display:none}body.touch #c1p .m{font-size:12px;margin:0}body.touch #c1p .s{margin:1px 0}
body.touch #c1An,body.touch #c1Mic,body.touch #c1Md,body.touch #c1Vw{display:none}
body.touch #c1p .bt{flex-wrap:nowrap;margin-top:3px;gap:3px}body.touch #c1p .bt button{min-width:0;padding:5px 3px;font-size:11px}
body.touch #c1p.chk .t,body.touch #c1p.chk .cl{display:none}body.touch #c1p.chk .r{display:flex;flex-wrap:wrap;gap:0 6px;font-size:10px}body.touch #c1p.chk .r span{margin-right:6px}body.touch #c1p.mini{max-height:none}
body.touch #c1cap{top:calc(38% + 4px);font-size:13px;max-width:60vw}
body.c1on #objNext,body.c1on #list,body.c1on #bottom,body.c1on #c1demo{display:none!important}
#c1p{top:108px;width:300px;max-height:calc(100vh - 120px)}
#c1p .m{display:flex;justify-content:space-between;align-items:baseline;gap:6px}#c1p .m .dots{font-size:10px;letter-spacing:1px;color:#c9a2ff;white-space:nowrap}
#c1p .tip{margin:3px 0;padding:4px 7px;border-left:3px solid #c9a2ff;background:rgba(201,162,255,.10);border-radius:4px;font-size:12px;line-height:1.45;color:#e6dcff;cursor:pointer}#c1p .tip:empty{display:none}#c1p .tip:not(.open) span{display:none}#c1p .tip b{color:#c9a2ff}
#c1p .s{font-size:14px;font-weight:600}
#c1p:not(.more) .bt.sub{display:none}#c1p #c1More{flex:0 0 34px}#c1p.more #c1More{background:#2f3a46}
#c1p .bt.main{flex-wrap:nowrap}#c1p .bt.main button{font-size:12.5px;white-space:nowrap;min-width:0;padding:7px 3px}#c1p .bt.main button small{display:none}#c1p canvas{display:none}#c1p.map canvas{display:block}#c1p .note{display:none}#c1p.map .note{display:block}
#c1cap{top:10px;font-size:14px;padding:6px 12px}
#c1g{position:fixed;right:12px;bottom:14px;z-index:6;width:236px;height:168px;pointer-events:none;border-radius:10px;background:rgba(10,14,20,.6);border:1px solid rgba(127,208,255,.35)}#c1g.hidden{display:none}
body.touch #c1g{right:auto;left:50%;transform:translateX(-50%);top:auto;bottom:44px;width:min(132px,15.5vw);height:calc(min(132px,15.5vw)*0.72)}
body.touch #c1p .tip,body.touch #c1p .cl{display:none}
body.touch #c1p .bts{flex-wrap:wrap}body.touch #c1p .bts .bt.main{flex:1 1 100%}body.touch #c1p .bts .bt.sub{flex:1 1 100%;margin-top:2px}body.touch #c1p:not(.more) .bts .bt.sub{display:none}
body.touch #c1p #c1More{flex:0 0 26px}
body.touch #c1cap{top:auto;bottom:6px}
@media (max-width:700px),(max-height:500px){#c1p{width:230px;font-size:11px;top:86px;left:6px;padding:6px 8px;max-height:calc(100vh - 96px)}#c1p canvas,#c1p .note{display:none}#c1p .m{font-size:13px}#c1p .bt button{padding:8px 4px}}`;
    document.head.appendChild(css);
    el = document.createElement('div'); el.id = 'c1p'; el.className = 'hidden';
    el.innerHTML = `<div class="t" id="c1T"></div><div class="m" id="c1Mn"></div><div class="tip" id="c1Tip"></div><div class="s" id="c1St"></div>
<div class="cl" id="c1Cl"></div><div class="co" id="c1Co"></div><div class="r" id="c1R"></div>
<div class="bts"><div class="bt main"><button id="c1Ok" title="${L2('완료하고 다음 단계로 (키보드 Enter)', 'Done, go to next step (Enter key)')}">${L2('다음 ▶', 'NEXT ▶')}<small>Enter</small></button><button id="c1Cb" title="${L2('내(응시자) 구호 외치기 — 기기가 응시자 목소리로 대신 말함 · 마이크로 직접 말해도 됨 (키보드 Q)', 'Say my (candidate) call — the device speaks it in the candidate voice · or say it into the mic (Q key)')}">${L2('🗣 내 구호', '🗣 MY CALL')}<small>Q</small></button><button id="c1Em" title="${L2('비상 선언 (키보드 E)', 'Declare emergency (E key)')}">${L2('🚨 비상', '🚨 EMER')}<small>E</small></button><button id="c1Gp" title="${L2('GPS 스위치 (H)', 'GPS switch (H)')}">GPS</button><button id="c1More" title="${L2('설정 더보기', 'More settings')}">⋯</button></div><div class="bt sub"><button id="c1Md">${L2('모드 Y', 'MODE Y')}</button><button id="c1Hr">🕐</button><button id="c1Vw">${L2('시점 C', 'VIEW C')}</button><button id="c1An">📢</button><button id="c1Vo">🔊</button><button id="c1Mic">🎤</button><button id="c1MapB" title="${L2('시험장 지도 보기', 'Show the field map')}">🗺</button></div></div>
<canvas id="c1Map" width="260" height="200"></canvas><div class="note" id="c1Note"></div><div class="note">${C1DISC()}</div>`;
    document.body.appendChild(el);
    const tap = (id, k) => { const b = $(id); b.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); c1Key(k); }; };
    $('c1More').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); el.classList.toggle('more'); };
    $('c1MapB').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); SET.c1map = !SET.c1map; saveSet(); };
    $('c1Tip').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); C1.tipOpen = !$('c1Tip').classList.contains('open'); };
    tap('c1Ok', 'Enter'); tap('c1Md', 'KeyY'); tap('c1Gp', 'KeyH');
    $('c1Hr').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); const L = [9, 11, 13, 15, 17]; SET.c1hour = L[(L.indexOf(SET.c1hour | 0) + 1) % L.length] || 11; saveSet(); c1Sun(); showMsg(L2('시험 시각 ', 'Test time ') + SET.c1hour + L2('시 · 해 위치·그림자 반영', ':00 · sun and shadows updated'), '#ffc828', 1.6); }; tap('c1Em', 'KeyE'); tap('c1Vw', 'KeyC'); tap('c1Cb', 'KeyQ');
    $('c1An').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); SET.c1ann = SET.c1ann === false; saveSet(); c1AnnBtn(); showMsg(SET.c1ann === false ? L2('시험위원 지시 방송 끔 (응시자 구호로 진행)', 'Examiner announcements off (candidate-led)') : L2('시험위원 지시 방송 켬', 'Examiner announcements on'), '#ffc828', 1.6); };
    $('c1Vo').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); if (SET.c1voice === false) { SET.c1voice = true; saveSet(); } c1VoiceUnlock(); c1VoiceTest(); };
    $('c1Vo').oncontextmenu = e => { e.preventDefault(); SET.c1voice = SET.c1voice === false; saveSet(); showMsg(SET.c1voice === false ? L2('시험장 음성 끔', 'Test-field voice off') : L2('시험장 음성 켬', 'Test-field voice on'), '#ffc828', 1.4); };
    // 제목줄: 끌어서 옮기기 · 짧게 누르면 접기/펴기 · 두 번 누르면 원래 자리 (자리·접힘은 기기별로 기억)
    const tb = $('c1T'); let dg = null;
    tb.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); const r = el.getBoundingClientRect(); dg = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, w: r.width, mv: false }; try { tb.setPointerCapture(e.pointerId); } catch (_) { } };
    tb.onpointermove = e => { if (!dg) return; const dx = e.clientX - dg.x, dy = e.clientY - dg.y; if (!dg.mv && Math.hypot(dx, dy) < 6) return; dg.mv = true; c1PanelPos(dg.l + dx, dg.t + dy, dg.w); };
    tb.onpointerup = e => { if (!dg) return; const d = dg; dg = null; const k = IS_TOUCH ? 'c1posT' : 'c1posP';
      if (d.mv) { const r = el.getBoundingClientRect(); SET[k] = [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; saveSet(); return; }
      const now = performance.now(); if (now - (tb._last || 0) < 350) { SET[k] = null; saveSet(); c1PanelPos(); tb._last = 0; return; } tb._last = now;
      el.classList.toggle('mini'); SET.c1mini = el.classList.contains('mini'); saveSet(); };
    tb.title = L2('끌어서 옮기기 · 누르면 접기/펴기 · 두 번 누르면 원래 자리', 'Drag to move · tap to fold/unfold · double-tap to reset');
    el.classList.toggle('mini', !!SET.c1mini); c1PanelPos();
    $('c1Mic').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); c1Mic(!C1V.micOn); $('c1Mic').classList.toggle('on', C1V.micOn); };
  }
  el.classList.toggle('hidden', !show); c1AnnBtn(); if (!show) { const b = $('c1demo'); if (b) b.classList.add('hidden'); }
}
function c1PanelPos(x, y, w) {
  const el = $('c1p'); if (!el) return; const k = IS_TOUCH ? 'c1posT' : 'c1posP';
  if (x == null && SET[k]) [x, y, w] = SET[k];
  if (x == null) { el.style.left = el.style.top = el.style.right = el.style.width = ''; return; }
  const W = innerWidth, H = innerHeight, ww = Math.min(w || el.offsetWidth, W - 8);
  x = clamp(x, 4 - ww * 0.7, W - ww * 0.3); y = clamp(y, 0, H - 28);
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.right = 'auto'; el.style.width = ww + 'px';
}
function c1AnnBtn() { const b = $('c1An'); if (b) { b.classList.toggle('on', SET.c1ann !== false); b.title = L2('시험위원 지시 방송 켜기/끄기', 'Examiner announcements on/off'); } }
let _c1ui = 0;
function c1Tick(dt) {
  if (!isC1() || !C1G) return;
  if (C1.pilotFig) C1.pilotFig.visible = C1.view !== 'pilot' || !!C1.introCam || S.state === 'menu';
  c1NavTick();
  if (C1V.heardT > 0) C1V.heardT -= dt; if (C1.ok && C1.ok.t > 0) C1.ok.t -= dt;
  if (ui.modeTag && (S.state === 'run' || S.state === 'pause')) ui.modeTag.textContent = 'C1 · ' + (C1.mode === 'gps' ? 'GPS ON' : C1.mode === 'atti' ? 'GPS OFF (ATTI)' : 'MANUAL') + (C1.armed ? ' · ARMED' : '');
  if (C1.ribbons) c1RibbonTick();
  if (C1.sock) { const w = c1Wind(c1W(-16, 10, 4)); const sp = Math.hypot(w.x, w.z); C1.sock.rotation.set(0, 0, 0); C1.sock.lookAt(C1.sock.position.clone().add(new V3(w.x || 0.001, -Math.max(0, 3 - sp) * 0.6, w.z))); C1.sock.rotateX(Math.PI / 2); }
  const run = S.state === 'run' || S.state === 'pause';
  const st = run ? c1Cur() : null, aids = !C1.exam && run && st;
  C1.aidBox.visible = C1.aidLine.visible = C1.aidArrow.visible = false;
  c1Aid3D(aids ? st : null);
  c1Gauge(run ? st : null, c1M());
  if (aids) {
    const ref = C1.ref || 4;
    if (st.k === 'hold' || st.k === 'xfer') {
      const at = st.at || st.to, h0 = st.altWin ? ref + st.altWin[0] : ref + (st.r || 0) - c1R('altTol'), h1 = st.altWin ? ref + st.altWin[1] : ref + (st.r || 0) + c1R('altTol');
      C1.aidBox.visible = true; C1.aidBox.rotation.y = -C1S.h; C1.aidBox.scale.set(c1R('posTol'), Math.max(0.05, h1 - h0), st.alongTol ? st.alongTol : c1R('posTol'));
      C1.aidBox.position.copy(c1W(at[0], at[1], (h0 + h1) / 2 + c1p('skidDrop')));
      C1.aidArrow.visible = st.hdg != null; if (st.hdg != null) { const hd = st.hdg * DEG; C1.aidArrow.position.copy(c1W(at[0] + Math.sin(hd) * 1.6, at[1] + Math.cos(hd) * 1.6, h1 + c1p('skidDrop') + 0.2)); C1.aidArrow.rotation.set(-Math.PI / 2, 0, -(hd + C1S.h)); }
    } else if (st.k === 'move' || st.k === 'arc' || st.k === 'climb' || st.k === 'land' || st.k === 'emg') {
      const pts = [], sd = c1p('skidDrop');
      if (st.k === 'move') { for (let i = 0; i <= 20; i++) { const s = i / 20; pts.push(c1W(st.from[0] + (st.to[0] - st.from[0]) * s, st.from[1] + (st.to[1] - st.from[1]) * s, ref + (st.r0 || 0) + ((st.r1 || 0) - (st.r0 || 0)) * s + sd)); } }
      else if (st.k === 'arc') { for (let i = 0; i <= 72; i++) { const a = (180 + (st.dir < 0 ? 1 : -1) * i * 5) * DEG; pts.push(c1W(st.c[0] + Math.sin(a) * st.R, st.c[1] + Math.cos(a) * st.R, ref + sd)); } }
      else { const at = st.at || st.pad; pts.push(c1W(at[0], at[1], sd), c1W(at[0], at[1], (st.k === 'climb' ? 5 : ref + 2) + sd)); }
      C1.aidLine.geometry.setFromPoints(pts); C1.aidLine.visible = true;
    }
  }
  _c1ui -= dt; if (_c1ui > 0) return; _c1ui = 0.1;
  const el = $('c1p'); if (!el || el.classList.contains('hidden')) return;
  const m = C1.M[C1.mi], M = c1M();
  $('c1T').textContent = (C1.exam ? L2('1종 모의평가', 'CLASS 1 · MOCK') : C1.demo ? L2('1종 시범비행', 'CLASS 1 · DEMO') : L2('1종 학습', 'CLASS 1 · LEARN')) + ' · ' + { gps: 'GPS', atti: 'ATTI', manual: 'MANUAL' }[C1.mode] + (C1.armed ? ' · ARMED' : ' · SAFE') + (C1.ref ? ` · ${L2('기준', 'REF')} ${C1.ref.toFixed(1)} m` : '');
  { const dots = m ? m.steps.map((x, i) => i < C1.si ? '●' : i === C1.si ? '◉' : '○').join('') : '';
    $('c1Mn').innerHTML = m ? `<span>${C1.mi + 1}/${C1.M.length} · ${m.name}</span><span class="dots">${dots}</span>` : '';
    const tp = $('c1Tip'), tip = m && C1TIP[m.id], key = m ? m.id + C1.mi : '';
    if (C1.tipKey !== key) { C1.tipKey = key; C1.tipT = C1.t; C1.tipOpen = null; }
    const open = C1.demo || (C1.tipOpen != null ? C1.tipOpen : C1.t - C1.tipT < 15);
    if (tip && !C1.exam) { tp.innerHTML = `<b>📘 ${L2('요령', 'How to')}${open ? '' : ' ▸'}</b> <span>${L2(tip[0], tip[1])}</span>`; tp.classList.toggle('open', open); } else tp.innerHTML = ''; }
  el.classList.toggle('map', !!SET.c1map && !C1.exam);
  $('c1St').textContent = st ? st.lab : '';
  { const cl = $('c1Cl'); let h = '';
    const ctx = st && st.call ? (st.call.count ? (L2(st.call.ko, st.call.en) ? L2(st.call.ko, st.call.en) + ' → ' : '') + L2('(도착 후) 정지. 하나, 둘, 셋, 넷, 다섯', '(on arrival) hold, one … five') : L2(st.call.ko, st.call.en)) : '';
    if (st && st.k === 'inspect' && st.call && !st.callSaid) h = L2('점검 항목을 모두 판정하면 보고 구호가 자동으로 나갑니다', 'When every item is judged, the report call is made for you');
    else if (st && st.call) h = st.callSaid ? `✓ ${L2('구호', 'Call')}: ${ctx} <i>(${st.callSaid === 'voice' ? L2('음성', 'voice') : st.callSaid === 'auto' ? L2('자동', 'auto') : L2('버튼', 'button')})</i>` : (C1.exam ? `${L2('지금 내 구호 차례 ▶ 🗣 내 구호 버튼 또는 직접 말하기', 'Your call now ▶ 🗣 MY CALL button or say it')}` : `${L2('내 구호', 'My call')}: “${ctx}” <i>(${L2('🗣 내 구호 버튼 · 🎤 말하기', '🗣 MY CALL · 🎤 say it')})</i>`);
    if (C1V.heardT > 0) h += `<br><i>🎤 ${C1V.heard}</i>`;
    const vs = c1VoiceStatus(); if (vs) h += `<br><i style="color:#ffb070">${vs}</i>`;
    cl.innerHTML = h; }
  { const co = $('c1Co'); if (co) co.innerHTML = (!C1.exam && !C1.demo && st) ? c1Coach(st, M) : ''; }
  const e = st && st.err, f = (x, d) => (x >= 0 ? '+' : '') + x.toFixed(d || 1), cls = (x, t) => Math.abs(x) <= t ? 'ok' : 'bad';
  let r = C1.exam ? `<b>${L2('스키드 높이', 'Skid h')}</b><span>${M.alt.toFixed(2)} m</span><b>${L2('기수', 'Heading')}</b><span>${c1Wrap(M.hdg).toFixed(0)}°</span>` : '';
  if (false) {
    if (e.lat != null) r += `<b>${L2('위치 오차', 'Pos err')}</b><span class="${cls(e.lat, c1R('posTol'))}">${f(e.lat, 2)} m</span>`;
    if (e.alt != null && st.k !== 'land' && st.k !== 'emg') r += `<b>${L2('고도 오차', 'Height err')}</b><span class="${cls(e.alt, c1R('altTol'))}">${f(e.alt, 2)} m</span>`;
    if (e.hdg != null) r += `<b>${L2('기수 오차', 'Hdg err')}</b><span class="${cls(e.hdg, st.k === 'emg' ? 45 : 15)}">${f(e.hdg, 0)}°</span>`;
    if (st.k === 'hold') r += `<b>${L2('정지', 'Hold')}</b><span class="${st.armedEval && st.t >= st.T ? 'ok' : ''}">${st.armedEval ? st.t.toFixed(1) : '–'} / ${st.T} s</span>`;
  }
  if (!C1.exam && m && m.fail) r += `<b>${L2('판정', 'Verdict')}</b><span class="bad">U · ${m.why.map(w => c1WhyTxt(w.why)).filter((x, i, a) => a.indexOf(x) === i).join(', ')}</span>`;
  if (st && st.k === 'rc') { const sn = st.seen || {}, ck = k => sn[k] ? '✓' : '·'; r = `<b>${L2('스로틀', 'Throttle')}</b><span>↑${ck('thr+')} ↓${ck('thr-')}</span><b>${L2('러더', 'Rudder')}</b><span>←${ck('yaw-')} →${ck('yaw+')}</span><b>${L2('엘리베이터', 'Elevator')}</b><span>↑${ck('pitch+')} ↓${ck('pitch-')}</span><b>${L2('에일러론', 'Aileron')}</b><span>←${ck('roll-')} →${ck('roll+')}</span><b>${L2('모드 스위치', 'Mode switch')}</b><span class="${C1.mode === 'gps' ? 'ok' : 'bad'}">${C1.mode.toUpperCase()}</span>`; }
  if (st && st.k === 'ctl') { const sn = st.seen || {}, ck = k => sn[k] ? '✓' : '·'; r += `<b>${L2('점검 조작', 'Checks')}</b><span>${L2('전', 'F')}${ck('p+')} ${L2('후', 'B')}${ck('p-')} ${L2('좌', 'L')}${ck('r-')} ${L2('우', 'R')}${ck('r+')} ${L2('러더', 'Rud')}${ck('y-')}${ck('y+')}</span>`; }
  if (st && st.k === 'arm' && st.csc) r += `<b>${L2('시동', 'Start')}</b><span>${L2('두 스틱 아래·안쪽 0.5초 (키보드 S+A+↓+→)', 'Both sticks down-in 0.5 s (keys S+A+↓+→)')}</span>`;
  { const needCall = !!(st && st.call && !st.callSaid && st.k !== 'inspect'), needOk = !C1.demo && !!(st && (st.k === 'prep' || (st.k === 'arm' && DR.landed) || (st.k === 'disarm' && DR.landed && Math.hypot(DR.v.x, DR.v.z) < 0.3)));
    const ob = $('c1Ok'), cb = $('c1Cb'); if (ob) ob.classList.toggle('need', needOk && !needCall); if (cb) cb.classList.toggle('need', needCall && !C1.demo); el.classList.toggle('demo', !!C1.demo); c1DemoBanner(m); }
  { const gp = $('c1Gp'); if (gp) { gp.textContent = C1.mode === 'gps' ? 'GPS ON' : C1.mode === 'atti' ? 'GPS OFF' : 'MANUAL'; gp.className = C1.mode === 'gps' ? 'on' : 'off'; } const hb = $('c1Hr'); if (hb) hb.textContent = '🕐 ' + (SET.c1hour || 11) + L2('시', ':00'); }
  if (st && st.k === 'hold' && st.armedEval) { const pc = Math.min(1, st.t / st.T); r += `<b>${L2('정지', 'Hold')}</b><span><i class="pb"><i style="width:${(pc * 100).toFixed(0)}%"></i></i> ${st.t.toFixed(1)} / ${st.T} s${pc >= 1 ? ' ✓' : ''}</span>`; }
  if (C1.ok && C1.ok.t > 0) r = `<span class="okf ${C1.ok.bad ? 'bad' : 'ok'}" style="grid-column:1/3">${C1.ok.text}</span>` + r;
  $('c1R').innerHTML = r; el.classList.toggle('chk', !!st && (st.k === 'rc' || st.k === 'ctl' || (st.k === 'arm' && st.csc)));
  $('c1Note').textContent = L2('1종 실기시험 기준 참고 연습용 · 공식 시험·교육시간 인정 여부 미확인', 'Reference practice for the class-1 practical test · not an official test or training hours') + (C1.exam ? '' : L2(' · 숫자 1~9 = 기동 바로가기 · N = 다음 단계', ' · keys 1–9 jump to a manoeuvre · N = next step'));
  const cv = $('c1Map'); if (cv && !C1.exam) c1DrawMap(cv, st, M); else if (cv) cv.style.display = 'none';
}
function c1DrawMap(cv, st, M) {
  cv.style.display = ''; const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height, ox = W2 / 2, oy = H2 - 14;
  const k = Math.min((H2 - 24) / 70, W2 / 40); const XX = u => ox + u * k, YY = v => oy - v * k;
  g.clearRect(0, 0, W2, H2); g.fillStyle = '#20301f'; g.fillRect(0, 0, W2, H2);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.strokeRect(XX(C1FIELD.u0), YY(C1FIELD.v1), (C1FIELD.u1 - C1FIELD.u0) * k, (C1FIELD.v1 - C1FIELD.v0) * k);
  g.beginPath(); g.arc(XX(0), YY(22.5), 7.5 * k, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,208,64,.5)'; g.beginPath(); g.arc(XX(0), YY(0), 14 * k, Math.PI, 2 * Math.PI); g.stroke();
  g.fillStyle = '#fff'; g.font = '10px system-ui'; g.textAlign = 'center';
  for (const [n, uv] of Object.entries(C1PT)) { const isPad = n === 'H' || n[0] === 'F'; g.fillStyle = isPad ? (n === 'H' ? '#9aa6b2' : '#c05050') : '#fff'; if (isPad) g.fillRect(XX(uv[0] - 1), YY(uv[1] + 1), 2 * k, 2 * k); else { g.beginPath(); g.arc(XX(uv[0]), YY(uv[1]), 2.5, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.fillText(n[0], XX(uv[0]) + 8, YY(uv[1]) - 3); }
  if (st && (st.at || st.to)) { const t = st.at || st.to; g.strokeStyle = '#5dff9a'; g.strokeRect(XX(t[0] - 1), YY(t[1] + (st.alongTol || 1)), 2 * k, 2 * (st.alongTol || 1) * k); }
  if (st && st.k === 'move') { g.strokeStyle = '#4fe3ff'; g.beginPath(); g.moveTo(XX(st.from[0]), YY(st.from[1])); g.lineTo(XX(st.to[0]), YY(st.to[1])); g.stroke(); }
  const x = XX(M.u), y = YY(M.v), h = M.hdg * DEG; g.fillStyle = '#ffc828'; g.beginPath(); g.moveTo(x + Math.sin(h) * 7, y - Math.cos(h) * 7); g.lineTo(x + Math.sin(h + 2.5) * 5, y - Math.cos(h + 2.5) * 5); g.lineTo(x + Math.sin(h - 2.5) * 5, y - Math.cos(h - 2.5) * 5); g.fill();
}
// 조종자 시점: P 에서 눈높이 · 기체를 따라 시선만 돌림 (육안 시점의 근사)
const _c1cg = new V3(), _c1ct = new V3(), _c1cv = new V3(), _c1cw = new V3();
function c1Camera(dt, subj) {
  if (!C1 || !isC1() || S.state === 'menu') return false;
  if (C1.view === 'chase' && !C1.exam) {
    const fw = new V3(Math.sin(subj.h), 0, -Math.cos(subj.h)), want = subj.p.clone().addScaledVector(fw, -7).add(new V3(0, 3, 0)); want.y = Math.max(want.y, C1S.y + 0.8);
    camPos.lerp(want, 1 - Math.exp(-dt * 5)); camera.position.copy(camPos); camLook.lerp(subj.p, 1 - Math.exp(-dt * 9)); camera.lookAt(camLook); camera.fov = 60; camera.near = 0.05; return true;
  }
  if (C1.introCam) {   // 대기 천막에서 시험장을 바라봄 (호명 방송 중)
    camera.position.copy(c1W(-9, -7.5, 1.7)); camLook.copy(c1W(0, 24, 2)); camera.up.set(0, 1, 0); camera.lookAt(camLook); camera.fov = 55; camera.near = 0.1; return true;
  }
  camera.position.copy(c1W(0, 0, c1p('eye')));
  // 기체와 그 아래 바닥(지점·고깔·그림자)이 함께 보이도록: 둘 사이를 바라보고 화각을 넓힘
  const gy = C1S.y, gp = _c1cg.set(subj.p.x, Math.min(subj.p.y, gy), subj.p.z), tgt = _c1ct.copy(subj.p).lerp(gp, 0.4);
  camLook.lerp(tgt, 1 - Math.exp(-dt * 7)); if (camLook.distanceTo(tgt) > 30) camLook.copy(tgt);
  camera.up.set(0, 1, 0); camera.lookAt(camLook);
  const d = camera.position.distanceTo(subj.p), a = _c1cv.copy(subj.p).sub(camera.position).angleTo(_c1cw.copy(gp).sub(camera.position)) / DEG;
  const want = clamp(Math.max(2 * Math.atan(7.5 / Math.max(d, 1)) / DEG, a * 1.7 + 6) * (SET.c1zoom || 1), 30, 75);
  camera.fov += (want - camera.fov) * (1 - Math.exp(-dt * 3)); camera.near = 0.1;
  return true;
}

// ---- 결과 · 기록 ----
function c1Finish(why) {
  if (C1.over) return; C1.over = true; S.finished = true; S.running = false; if (REC) LAST_REC = recFinish();
  c1Ev('end', { why });
  setTimeout(() => {
    if (S.state !== 'run') return;
    S.state = 'result'; ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden'); c1Panel(false);
    $('resTitle').textContent = C1.exam ? L2('1종 모의평가 결과', 'CLASS 1 · MOCK CHECK') : L2('1종 학습 결과', 'CLASS 1 · PRACTICE');
    ui.resSub.textContent = `${pilotName()} · ${C1P.label[window.SIM_LANG === 'en' ? 'en' : 'ko']} · ${L2('기준고도', 'Ref height')} ${C1.ref ? C1.ref.toFixed(1) + ' m' : '–'}`;
    const V = m => m.unrated ? L2('교관 확인 필요', 'Instructor check') : m.skipped ? L2('미평가 (건너뜀)', 'Not rated (skipped)') : !m.done ? L2('미수행', 'Not flown') : m.fail ? 'U' : 'S';
    const rows = C1.M.map((m, i) => [`${i + 1}. ${m.name}`, `<b style="color:${m.unrated || m.skipped || !m.done ? '#c9a2ff' : m.fail ? '#ff7a5a' : '#5dff9a'}">${V(m)}</b>` + (m.fail ? ` <span class="dim">${m.why.map(w => c1WhyTxt(w.why)).filter((x, j, a) => a.indexOf(x) === j).join(', ')}</span>` : '')]);
    rows.push([L2('구술 (기체·조종자·공역·일반지식·이륙중 엔진고장 · 각 1문)', 'Oral (aircraft · pilot · airspace · general · engine failure on takeoff)'), L2('미평가 · 교관 확인 필요', 'Unrated · instructor')]);
    rows.push([L2('공중경계 · 계획성 · 판단력 · 규칙 준수 · 조작 원활성', 'Lookout · planning · judgement · rules · smoothness'), L2('미평가 · 교관 확인 필요', 'Unrated · instructor')]);
    { const calls = []; C1.M.forEach(m => m.steps.forEach(s => { if (s.call) calls.push(s); })); const v = calls.filter(s => s.callSaid === 'voice').length, b = calls.filter(s => s.callSaid === 'btn').length;
      rows.push([L2('구호 (교육 관행 예시 · 채점 외, "비상"만 기준서 필수)', 'Calls (training practice · not scored, only "emergency" is required)'), `${v + b} / ${calls.length} · ${L2('음성', 'voice')} ${v} · ${L2('버튼', 'button')} ${b}`]); }
    { const ins = C1.ev.find(e => e.type === 'inspect'); if (ins) rows.push([L2('비행 전 점검 판정', 'Pre-flight inspection'), (ins.fault ? L2('이상 항목: ', 'Fault: ') + ins.fault : L2('이상 없음', 'No fault')) + ' · ' + (ins.wrong.length ? `<b style="color:#ff7a5a">${L2('오판정 ', 'misjudged ')}${ins.wrong.join(', ')}</b>` : L2('판정 정확', 'judged correctly'))]); }
    { const o = C1.ev.filter(e => e.type === 'oral'); if (o.length) rows.push([L2('구술 (앱 예시 문항 · 앱 채점)', 'Oral (app examples · app-scored)'), `${o.filter(x => x.ok).length} / ${o.length}`]); }
    rows.push([L2('안전거리 14 m · 안전라인', 'Safety radius 14 m · line'), C1.safeBad ? `<b style="color:#ff7a5a">${L2('침범 기록 있음', 'Infringed')}</b>` : L2('침범 기록 없음', 'No infringement logged')]);
    rows.push([L2('비행 시간', 'Flight time'), fmt(S.t)], [L2('비상 강하 기준 속도', 'Emergency descent reference'), C1.refDesc ? C1.refDesc.toFixed(2) + ' m/s (' + L2('삼각 하강 평균', 'triangle descent mean') + ')' : c1R('emgRefDefault') + ' m/s (' + L2('앱 기본값', 'app default') + ')']);
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    const sc = $('resScore'); if (sc) sc.innerHTML = `<div style="color:#c9a2ff;font-size:13px;margin:6px 0">${L2('앱 모의판정 (규칙 ', 'App mock verdict (rules ')}${C1RULES.ver}) · ${L2('공식 시험 합격·자격 판정이 아닙니다', 'not an official pass or certificate')}<br>${C1DISC()}</div>`;
    const db = $('resDebrief'); if (db) db.innerHTML = `<h4>${L2('판정 근거 (이벤트)', 'Evidence (events)')}</h4>` + C1.ev.filter(e => e.type === 'U').slice(0, 30).map(e => `<div class="ln"><span>${fmt(e.t)} ${e.step}</span><span class="bad">${c1WhyTxt(e.why)}</span></div>`).join('') || '';
    ui.resBest.textContent = '';
    let b = $('c1Exp'); if (!b) { b = document.createElement('button'); b.id = 'c1Exp'; b.textContent = L2('기록 JSON 내보내기', 'Export log (JSON)'); $('bMenu2').parentNode.insertBefore(b, $('bMenu2')); b.onclick = c1Export; }
    b.style.display = '';
    c1Save();
  }, 1200);
}
function c1Log() {
  return { schema: 'c1-log-1', app: 'FPV Terrain Trainer · class-1 practice', when: new Date().toISOString(), mode: S.kind, exam: C1.exam, side: C1.side < 0 ? 'left-first' : 'right-first',
    profile: C1P, rules: C1RULES, ref: C1.ref, refDesc: C1.refDesc, wind: { level: WIND.lv, dir: [+WIND.dir.x.toFixed(3), +WIND.dir.z.toFixed(3)] }, t: +C1.t.toFixed(2),
    manoeuvres: C1.M.map(m => ({ id: m.id, name: m.name, done: !!m.done, verdict: m.unrated ? 'instructor' : m.skipped ? 'skipped' : !m.done ? 'not-flown' : m.fail ? 'U' : 'S', why: m.why })),
    events: C1.ev };
}
function c1Export() {
  try { const blob = new Blob([JSON.stringify(c1Log(), null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'class1_log_' + Date.now() + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  catch (e) { showMsg(L2('내보내기 실패', 'Export failed'), '#ff5050', 1.5); }
}
const C1_KEY = 'fpvsim_class1_runs_v1';   // 기존 기록과 섞이지 않는 새 저장 이름
function c1Save() {
  const L = c1Log(), sum = { when: L.when, mode: L.mode, side: L.side, ref: L.ref, profile: C1P.ver, rules: C1RULES.ver, t: L.t, v: L.manoeuvres.map(m => m.verdict) };
  try { const a = JSON.parse(localStorage.getItem(C1_KEY) || '[]'); a.unshift(sum); localStorage.setItem(C1_KEY, JSON.stringify(a.slice(0, 30))); }
  catch (e) { C1.memRuns = (C1.memRuns || []).concat([sum]); showMsg(L2('브라우저 저장 불가 · 이번 기록은 메모리에만', 'Storage blocked · kept in memory only'), '#ffc828', 2); }
}

// 임무별 허용 기체 목록에서 없는 기체는 뺌 (민간판에서 기체를 지운 경우 대비)
Object.keys(MS_OK).forEach(k => { MS_OK[k] = MS_OK[k].filter(id => AF[id]); });

// ---- 민간 일반 비행판 (window.SIM_CIVIL): 타격·자폭·투하·차량 추적 진입점과 기체·판정 연결을 끊음 ----
if (window.SIM_CIVIL) {
  for (const k of ['kfpv', 'kfw']) { delete AF[k]; const i = AF_IDS.indexOf(k); if (i >= 0) AF_IDS.splice(i, 1); }
  Object.keys(MS_OK).forEach(k => { MS_OK[k] = MS_OK[k].filter(id => AF[id]); });
  for (const k of ['strike', 'track']) { delete MS_OK[k]; delete MS_NAME[k]; }
  AF.x2d.drop = false; AF.x2d.note = L2('자세 안정 · 정지 비행', 'Stabilised · hover');
  if (!AF[SET.af]) SET.af = 'x2d';
  // 장애물 코스: 투하 과제를 빼고, 튜토리얼 단계의 과제 번호를 다시 맞춤 (투하만 있는 단계는 뺌)
  { const rm = new Set(); OBJS.forEach((o, i) => { if (o.kind === 'drop') rm.add(i); });
    const map = i => i - [...rm].filter(r => r < i).length;
    for (let li = LESSONS.length - 1; li >= 0; li--) { const L = LESSONS[li]; if (/투하|^Drop/i.test(L.title)) { LESSONS.splice(li, 1); continue; } if (!L.range) continue; const keep = []; for (let i = L.range[0]; i <= L.range[1]; i++) if (!rm.has(i)) keep.push(map(i)); if (keep.length) L.range = [keep[0], keep[keep.length - 1]]; }
    for (let i = OBJS.length - 1; i >= 0; i--) if (rm.has(i)) { if (OBJS[i].hint) OBJS[i].hint.visible = false; OBJS.splice(i, 1); }
    // 사람 실루엣·이동 표적 모형은 감추고 충돌도 끔
    for (const id of ['ivan_grp1', 'ivan_grp2', 'mit']) { const b = OBJ[id]; if (!b) continue; b.g.visible = false; const c0 = b.world(0, 0, 0); COLL.forEach(c => { if (c.c && c.c.distanceTo(c0) < (id === 'mit' ? 18 : 6)) c.off = true; }); }
  }
  dropPayload = function () { };                                                    // 투하 동작 없음
  const _sr = startRun; startRun = function (k) { if (k === 'strike' || k === 'track') k = 'free'; return _sr(k); };
  const _ss = scenStart; scenStart = function (k, a) { const L = _ss(k, a); return L && k === 'sar' ? L.filter(o => o.t !== 'sarkit') : L; };   // 수색: 키트 투하 단계 없음
  strikePick = function () { return []; };
}
// =====================================================================
//  시험장 진행: 시험위원 방송 · 응시자 구호 · 비행 전 점검 · 조종기 점검 · 시동 · 구술
//  음성은 기기 음성 합성(speechSynthesis)만 씀 · 시험위원 지시문과 구호는 앱이 쓴 예시 문구
// =====================================================================
const C1V = { micOn: false, rec: null, heard: '', heardT: 0 };
function c1VoicePick() {
  try { const vs = speechSynthesis.getVoices(), lang = window.SIM_LANG === 'en' ? 'en' : 'ko'; return vs.filter(v => v.lang && v.lang.toLowerCase().startsWith(lang)); } catch (e) { return []; }
}
// who: 'ex' 시험위원 (낮고 차분) · 'me' 응시자 구호 (높고 빠르게, 다른 목소리가 있으면 그것)
// ---- 미리 만든 음성 묶음 (한국어: Mimic3 KSS 음성 · 영어: Kokoro) · 없거나 못 찾으면 기기 음성 합성 ----
const C1A = { st: 'none', idx: null, buf: null, ab: {}, until: 0 };
function c1ALoad() {
  if (C1A.st !== 'none') return; C1A.st = 'loading';
  const ib = document.getElementById('c1vb'), ii = document.getElementById('c1vi');
  if (ib && ii) { try { const s = atob(ib.textContent.trim()), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); C1A.buf = u.buffer; C1A.idx = JSON.parse(ii.textContent); C1A.st = 'ready'; } catch (e) { C1A.st = 'fail'; } return; }
  if (location.protocol === 'file:') { C1A.st = 'fail'; return; }
  const base = (window.SIM_BASE || '') + 'lib/c1_voice';
  Promise.all([fetch(base + '.json').then(r => r.json()), fetch(base + '.bin').then(r => r.arrayBuffer())]).then(([i, b]) => { C1A.idx = i; C1A.buf = b; C1A.st = 'ready'; }).catch(() => { C1A.st = 'fail'; });
}
function c1AKey(text, who) {
  const L = window.SIM_LANG === 'en' ? 'en' : 'ko', k = `${L}|${who}|${text}`; if (!C1A.idx) return null;
  if (C1A.idx[k]) return k;
  const g = `${L}|${who}|` + (L === 'ko' ? text.replace(/^응시자 [^,]+,/, '응시자,') : text.replace(/^Candidate [^,]+,/, 'Candidate,')); return C1A.idx[g] ? g : null;
}
function c1APlay(k) {
  const ctx = AU.ctx; if (!ctx) return false;
  try { if (ctx.state !== 'running') ctx.resume(); } catch (e) { }
  const [o, l] = C1A.idx[k];
  const go = b => { const s = ctx.createBufferSource(); s.buffer = b; const gn = ctx.createGain(); gn.gain.value = 1.6; s.connect(gn); gn.connect(AU.master || ctx.destination);
    const t0 = Math.max(ctx.currentTime + 0.02, C1A.until); s.start(t0); C1A.until = t0 + b.duration + 0.15; };
  if (C1A.ab[k]) go(C1A.ab[k]); else ctx.decodeAudioData(C1A.buf.slice(o, o + l)).then(b => { C1A.ab[k] = b; go(b); }).catch(() => { });
  return true;
}
function c1Say(text, who) {
  if (C1A.st === 'none') c1ALoad();
  const ak = C1A.st === 'ready' ? c1AKey(text, who) : null;
  const dur = ak ? C1A.idx[ak][2] + 0.35 : Math.max(1.4, text.length * (window.SIM_LANG === 'en' ? 0.065 : 0.13) + 0.5);
  c1Caption(text, who, dur); C1.sayUntil = Math.max(C1.sayUntil || 0, C1.t || 0) + dur;
  (C1V.log = C1V.log || []).push((ak ? '' : '[NOKEY] ') + (who === 'me' ? 'ME: ' : 'EX: ') + text); if (C1V.log.length > 300) C1V.log.shift();
  try {
    if (ak && SET.c1voice !== false) { if (!TEST) c1APlay(ak); C1V.nRec = (C1V.nRec || 0) + 1; }
    else if (window.speechSynthesis && !TEST && SET.c1voice !== false) {   // 무전 음성 설정과 따로 (무전을 꺼도 시험장 안내는 나옴)
      const u = new SpeechSynthesisUtterance(text), vs = c1VoicePick();
      u.lang = window.SIM_LANG === 'en' ? 'en-US' : 'ko-KR';
      if (vs.length) u.voice = who === 'me' && vs.length > 1 ? vs[1] : vs[0];
      u.pitch = who === 'me' ? 1.25 : 0.85; u.rate = who === 'me' ? 1.15 : 0.98; u.volume = 1;
      u.onstart = () => { C1V.ok = true; C1V.err = null; };
      u.onerror = e => { if (e.error === 'interrupted' || e.error === 'canceled') return; C1V.err = e.error || 'error'; c1Ev('ttsErr', { err: C1V.err }); };
      (C1V.utts = C1V.utts || []).push(u); if (C1V.utts.length > 8) C1V.utts.shift();   // 크롬: 참조가 없으면 말하다 끊기는 문제 방지
      try { speechSynthesis.resume(); } catch (e) { }
      speechSynthesis.speak(u);
      if (who === 'ex') sfx('good');   // 안내 시작음 (음성이 안 나오는 기기에서도 알림)
    } else if (who === 'ex') sfx('good');
  } catch (e) { }
  return dur;
}
// 휴대폰(특히 아이폰)·일부 브라우저는 화면을 한 번 누른 뒤에야 음성이 나옴 → 첫 터치·키 입력 때 빈 음성으로 열어 둠
function c1VoiceUnlock() {
  try { if (typeof initAudio === 'function') initAudio(); if (AU.ctx && AU.ctx.state !== 'running') AU.ctx.resume(); } catch (e) { }
  if (C1V.unlocked || !window.speechSynthesis) return; C1V.unlocked = true;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; u.lang = window.SIM_LANG === 'en' ? 'en-US' : 'ko-KR'; speechSynthesis.speak(u); speechSynthesis.resume(); } catch (e) { }
}
['pointerdown', 'keydown', 'touchend'].forEach(ev => document.addEventListener(ev, () => { if (isC1() || S.state === 'menu') c1VoiceUnlock(); }, { capture: true, passive: true }));
function c1VoiceStatus() {
  if (C1A.st === 'ready') return SET.c1voice === false ? L2('🔇 시험장 음성 꺼짐 (🔊 버튼)', '🔇 Test-field voice off (🔊)') : (!AU.ctx || AU.ctx.state !== 'running' ? L2('🔈 화면을 한 번 누르면 소리가 납니다', '🔈 Tap the screen once to enable sound') : '');
  if (!window.speechSynthesis) return L2('🔇 이 브라우저는 음성 합성을 지원하지 않습니다', '🔇 No speech synthesis in this browser');
  if (SET.c1voice === false) return L2('🔇 시험장 음성 꺼짐 (🔊 버튼)', '🔇 Test-field voice off (🔊)');
  if (C1V.err) return L2(`🔇 음성 오류 (${C1V.err}) · 화면을 한 번 누른 뒤 🔊 로 시험`, `🔇 Voice error (${C1V.err}) · tap the screen, then test with 🔊`);
  let all = []; try { all = speechSynthesis.getVoices(); } catch (e) { }
  if (all.length && !c1VoicePick().length) return L2('🔇 기기에 한국어 음성이 없습니다 · 기기 설정에서 한국어 음성(TTS) 데이터를 설치하세요', '🔇 No English voice on this device');
  return '';
}
function c1VoiceTest() { C1V.err = null; c1VoiceUnlock(); const vs = c1VoicePick(); c1Say(L2('음성 안내 시험입니다. 잘 들리십니까?', 'Voice check. Can you hear me?') + (vs.length ? '' : ''), 'ex'); }
function c1Caption(text, who, dur) {
  let el = $('c1cap'); if (!el) { el = document.createElement('div'); el.id = 'c1cap'; document.body.appendChild(el); }
  el.innerHTML = `<b>${who === 'me' ? L2('🗣 응시자', '🗣 Candidate') : L2('📢 시험위원', '📢 Examiner')}</b> ${text}`; el.className = who === 'me' ? 'me on' : 'on';
  clearTimeout(c1Caption.t); c1Caption.t = setTimeout(() => el.classList.remove('on'), (dur + 1.2) * 1000);
}
// 구호: 지금 단계의 구호를 버튼·키(Q)로 → 기기 음성이 대신 외침 · 마이크(음성인식)로 직접 말하면 그대로 기록
function c1CallDo(how) {
  const st = c1Cur(); if (!st || !st.call || st.callSaid) return false;
  const tx = L2(st.call.ko, st.call.en); if (how !== 'voice' && tx) c1Say(tx, 'me');
  st.callSaid = how; c1Ev('call', { how, text: st.call.ko });
  // 실제 시험처럼: 구호(이상무)를 외치면 그 단계 완료 → 다음으로 (다음 버튼 따로 안 눌러도 됨)
  if (!_c1conf && (st.k === 'prep' || (st.k === 'arm' && !st.csc) || st.k === 'disarm')) c1Confirm();
  return true;
}
function c1Heard(text) {
  const t = text.replace(/\s+/g, '').toLowerCase(); C1V.heard = text; C1V.heardT = 3;
  const st = c1Cur(); if (!st) return;
  if (st.call && !st.callSaid && st.call.kw.some(k => t.includes(k.toLowerCase()))) c1CallDo('voice');
  if (st.k === 'callout' && /비상|emergency/.test(t)) c1Key('KeyE', true);
}
function c1Mic(on) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (on && !SR) { showMsg(L2('이 브라우저는 음성인식을 지원하지 않습니다 · 버튼(Q)으로 구호', 'No speech recognition in this browser · use the call button (Q)'), '#ffc828', 2.5); C1V.micOn = false; return; }
  C1V.micOn = !!on;
  if (!on) { try { C1V.rec && C1V.rec.stop(); } catch (e) { } C1V.rec = null; return; }
  const r = new SR(); r.lang = window.SIM_LANG === 'en' ? 'en-US' : 'ko-KR'; r.continuous = true; r.interimResults = true;
  r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) c1Heard(e.results[i][0].transcript); };
  r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { C1V.micOn = false; showMsg(L2('마이크 권한이 없습니다', 'Microphone permission denied'), '#ff9a40', 2); } };
  r.onend = () => { if (C1V.micOn && C1V.rec === r) try { r.start(); } catch (e) { } };
  try { r.start(); C1V.rec = r; showMsg(L2('🎤 음성 구호 인식 켬 (인터넷 필요할 수 있음)', '🎤 Voice calls on (may need internet)'), '#5dff9a', 2); } catch (e) { C1V.micOn = false; }
}
function c1Arm(how) {
  if (C1.armed) return; C1.armed = true; C1.tArm = C1.t; c1Ev('arm', { how }); sfx('good');
  if (how === 'btn') c1CallDo('btn');
}

// ---- 비행 전 점검 (상태를 보고 정상/불량 판정 · 모의평가는 40% 확률로 이상 한 가지) ----
const C1INS = [
  { id: 'prop', ko: '프로펠러 체결·파손', en: 'Propellers: fixed, undamaged', ok: ['단단히 고정 · 손상 없음', 'Tight · no damage'], bad: ['한 장 끝에 금 · 손으로 흔들면 유격', 'Crack at one tip · play when shaken'] },
  { id: 'arm', ko: '암·폴딩 잠금', en: 'Arms / folding locks', ok: ['4개 모두 잠김', 'All four locked'], bad: ['오른쪽 뒤 암 잠금 풀림', 'Rear-right arm lock open'] },
  { id: 'skid', ko: '스키드·볼트·너트', en: 'Skids, bolts, nuts', ok: ['조임 정상', 'Tight'], bad: ['왼쪽 스키드 볼트 풀림', 'Left skid bolt loose'] },
  { id: 'bat', ko: '기체 배터리', en: 'Flight battery', ok: ['장착·잠금 · 셀당 4.18 V', 'Seated, locked · 4.18 V/cell'], bad: ['셀당 3.62 V (충전 부족)', '3.62 V/cell (not charged)'] },
  { id: 'tx', ko: '조종기 배터리', en: 'Transmitter battery', ok: ['85 %', '85 %'], bad: ['9 % · 저전압 경고', '9 % · low-voltage warning'] },
  { id: 'gps', ko: 'GPS·컴퍼스', en: 'GPS / compass', ok: ['위성 16개 · 컴퍼스 정상', '16 satellites · compass OK'], bad: ['위성 5개 · 컴퍼스 교정 필요', '5 satellites · compass calibration needed'] }
];
function c1Modal(html) {
  let el = $('c1m'); if (!el) { el = document.createElement('div'); el.id = 'c1m'; document.body.appendChild(el); }
  el.innerHTML = `<div class="box">${html}</div>`; el.classList.remove('hidden'); return el;
}
function c1ModalClose() { const el = $('c1m'); if (el) el.classList.add('hidden'); }
function c1InspectUI(st) {
  const ans = st.ans = {};
  const row = it => { const bad = st.fault === it.id; return `<tr><td>${L2(it.ko, it.en)}</td><td class="${bad ? 'warn' : ''}">${L2((bad ? it.bad : it.ok)[0], (bad ? it.bad : it.ok)[1])}</td><td><button data-i="${it.id}" data-v="ok">${L2('정상', 'OK')}</button><button data-i="${it.id}" data-v="bad">${L2('불량', 'Fault')}</button></td></tr>`; };
  const el = c1Modal(`<h3>${L2('비행 전 점검', 'Pre-flight inspection')}</h3><p class="dim">${L2('기체와 조종기를 확인하고 항목마다 상태를 판정하십시오. 이상이 있으면 불량을 고르면 조치(기체 교체) 후 진행합니다.', 'Check the aircraft and transmitter and judge each item. Mark a fault and it is fixed (aircraft swap) before you continue.')}</p>
<table>${C1INS.map(row).join('')}</table><button class="primary" id="c1InsGo" disabled>${L2('점검 완료', 'Inspection done')}</button>`);
  el.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => { ans[b.dataset.i] = b.dataset.v; el.querySelectorAll(`button[data-i="${b.dataset.i}"]`).forEach(x => x.classList.toggle('on', x === b)); $('c1InsGo').disabled = Object.keys(ans).length < C1INS.length; });
  $('c1InsGo').onclick = () => c1InspectDone(st);
}
function c1InspectDone(st) {
  if (st.done) return; st.done = true; c1ModalClose();
  const wrong = C1INS.filter(it => (st.ans[it.id] === 'bad') !== (st.fault === it.id)).map(it => it.id);
  c1Ev('inspect', { fault: st.fault, answers: st.ans, wrong });
  if (wrong.length) c1Fail(st, 'inspect', { wrong, fault: st.fault });
  if (st.fault && st.ans[st.fault] === 'bad') c1Say(L2('이상 확인. 조치 후 진행하십시오.', 'Fault confirmed. Fix it, then continue.'), 'ex');
  if (st.call && !st.callSaid) c1CallDo('auto');   // 점검을 마치면 보고 구호가 자동으로 나감 (버튼 없이)
}
function c1InspectAuto(correct) { const st = c1Cur(); if (!st || st.k !== 'inspect' || st.done) return; st.ans = {}; C1INS.forEach(it => st.ans[it.id] = correct ? (st.fault === it.id ? 'bad' : 'ok') : 'ok'); if (!correct && !st.fault) st.ans[C1INS[0].id] = 'bad'; c1InspectDone(st); }

// ---- 구술 문항 (앱 작성 예시 · 공식 출제 문항 아님 · 세부평가기준의 5개 항목 분류를 따름) ----
const C1Q = [
  { cat: 'ac', q: ['무인멀티콥터 1종의 구분 기준으로 맞는 것은?', 'Which defines a class-1 unmanned multicopter?'], a: [['최대이륙중량 25 kg 초과, 연료 제외 자체중량 150 kg 이하', 'MTOW over 25 kg, empty weight (excl. fuel) up to 150 kg'], ['최대이륙중량 7 kg 초과 25 kg 이하', 'MTOW over 7 kg up to 25 kg'], ['자체중량 25 kg 초과 기체만', 'Empty weight over 25 kg only'], ['최대이륙중량 2 kg 초과 7 kg 이하', 'MTOW over 2 kg up to 7 kg']] },
  { cat: 'ac', q: ['리튬폴리머 배터리 셀 1개의 완충 전압은 대략?', 'Roughly what is a full-charge LiPo cell voltage?'], a: [['4.2 V', '4.2 V'], ['3.7 V', '3.7 V'], ['3.0 V', '3.0 V'], ['5.0 V', '5.0 V']] },
  { cat: 'ac', q: ['비행제어기에서 기수 방향(방위)을 알려 주는 센서는?', 'Which flight-controller sensor gives heading?'], a: [['지자기 센서(컴퍼스)', 'Magnetometer (compass)'], ['기압 센서', 'Barometer'], ['자이로 센서', 'Gyroscope'], ['GPS 수신기만', 'GPS receiver alone']] },
  { cat: 'pi', q: ['실기시험표준서의 응시 요건으로 맞는 것은?', 'Which is a practical-test requirement in the standard?'], a: [['최근 2년 이내 학과시험 합격', 'Passed the written test within the last 2 years'], ['학과시험은 기간 제한 없이 인정', 'Written test valid with no time limit'], ['비행경력 없이 응시 가능', 'No flight experience needed'], ['구술시험 면제', 'Oral exam waived']] },
  { cat: 'pi', q: ['조종자 준수사항으로 맞는 것은?', 'Which is a pilot rule?'], a: [['주류 등을 섭취한 상태로 비행하지 않는다', 'Never fly under the influence of alcohol'], ['인구 밀집 지역 상공에서 물건을 떨어뜨려도 된다', 'Dropping objects over crowds is allowed'], ['비행 중 휴대폰으로 영상 통화를 해도 된다', 'Video calls while flying are fine'], ['안전성 인증은 선택 사항이다', 'Safety certification is optional']] },
  { cat: 'pi', q: ['시험 당일 표준서가 요구하는 소지 서류는?', 'Which document does the standard require on test day?'], a: [['유효한 항공신체검사증명서', 'A valid aviation medical certificate'], ['비행기록 원본 전체', 'All original flight logs'], ['기체 구매 영수증', 'Aircraft purchase receipt'], ['보험 증서 원본', 'Original insurance policy']] },
  { cat: 'as', q: ['NOTAM(항공고시보)이란?', 'What is a NOTAM?'], a: [['항공 시설·절차·위험 등 운항에 필요한 정보를 알리는 고시', 'Notice of facilities, procedures or hazards relevant to flight'], ['조종자 자격 시험 일정표', 'A licence exam timetable'], ['기체 정비 기록부', 'An aircraft maintenance log'], ['드론 판매 허가증', 'A drone sales permit']] },
  { cat: 'as', q: ['승인 없이 비행할 수 없는 고도 기준은?', 'Above what height is approval required?'], a: [['지표·수면 또는 물건 상단에서 150 m 이상', '150 m or more above ground, water or structure'], ['50 m 이상', '50 m or more'], ['300 m 이상', '300 m or more'], ['고도 제한 없음', 'No limit']] },
  { cat: 'as', q: ['관제권 안에서 비행하려면?', 'To fly inside a control zone you need…'], a: [['비행 승인을 받아야 한다', 'Flight approval'], ['신고 없이 낮게 날면 된다', 'Nothing if you stay low'], ['GPS 모드면 자유롭게 가능하다', 'Nothing in GPS mode'], ['야간에만 가능하다', 'Night-only flying']] },
  { cat: 'gk', q: ['유인 항공기와 마주쳤을 때 무인비행장치는?', 'Meeting a crewed aircraft, the unmanned aircraft must…'], a: [['진로를 양보하고 피한다', 'Give way and keep clear'], ['고도를 높여 위로 지나간다', 'Climb over it'], ['그대로 진행한다', 'Carry on'], ['속도를 높여 먼저 지나간다', 'Speed up to pass first']] },
  { cat: 'gk', q: ['비행 중 GPS 신호를 잃었을 때 알맞은 조치는?', 'GPS lost in flight — what do you do?'], a: [['자세모드로 직접 조종해 안전한 곳에 착륙', 'Fly manually in attitude mode and land somewhere safe'], ['스틱을 놓고 기다린다', 'Let go of the sticks and wait'], ['최대 속도로 이륙 지점까지 직진', 'Fly flat out to the takeoff point'], ['시동을 바로 끈다', 'Shut the motors off at once']] },
  { cat: 'gk', q: ['비행 중 기체 배터리 저전압 경고가 뜨면?', 'Low-battery warning in flight — what next?'], a: [['가까운 안전한 곳에 즉시 착륙', 'Land at the nearest safe spot now'], ['남은 기동을 끝내고 착륙', 'Finish the remaining tasks first'], ['고도를 높여 기다린다', 'Climb and wait'], ['경고를 끈다', 'Silence the warning']] },
  { cat: 'eo', q: ['이륙 중 모터 이상(소음·진동·한쪽 쏠림)을 느끼면?', 'Abnormal motor (noise, vibration, yaw) during takeoff?'], a: [['즉시 이륙을 포기하고 착륙 후 시동을 끈다', 'Abort, land and shut down at once'], ['출력을 높여 빨리 올라간다', 'Add power and climb away'], ['기준고도까지 올라간 뒤 판단한다', 'Climb to reference height, then decide'], ['조종기를 끈다', 'Switch the transmitter off']] },
  { cat: 'eo', q: ['이륙 직후 기체가 한쪽으로 쏠려 제어가 어려우면?', 'Just after liftoff the aircraft drifts and is hard to control?'], a: [['주변에 크게 알리고 가장 가까운 안전한 곳에 바로 착륙', 'Warn people loudly and land at the nearest safe spot'], ['계속 상승해 바람을 피한다', 'Keep climbing out of the wind'], ['시험위원에게 조종기를 넘긴다', 'Hand the transmitter to the examiner'], ['기수를 계속 돌려 본다', 'Keep spinning the nose']] },
  { cat: 'eo', q: ['이륙을 포기한 뒤 해야 할 일은?', 'After aborting a takeoff you should…'], a: [['시동을 끄고 배터리를 분리한 뒤 원인을 점검', 'Shut down, disconnect the battery and find the cause'], ['바로 다시 이륙해 본다', 'Try another takeoff at once'], ['기록 없이 넘어간다', 'Move on without noting it'], ['프로펠러를 손으로 돌려 본다', 'Spin the props by hand while armed']] }
];
const C1QCAT = { ac: ['기체', 'Aircraft'], pi: ['조종자', 'Pilot'], as: ['공역·비행장', 'Airspace & aerodrome'], gk: ['일반지식·비상절차', 'General & emergency'], eo: ['이륙 중 엔진 고장·이륙 포기', 'Engine failure on takeoff'] };
function c1OralUI(st) {
  const pick = Object.keys(C1QCAT).map(c => { const L = C1Q.filter(q => q.cat === c); return L[Math.floor(Math.random() * L.length)]; });
  st.qs = pick.map(q => { const ord = [0, 1, 2, 3].sort(() => Math.random() - 0.5); return { q, ord, ans: null }; }); st.qi = 0;
  const show = () => {
    const x = st.qs[st.qi], lang = window.SIM_LANG === 'en' ? 1 : 0;
    if (st.qi === 0 || !st.spoke) { }
    c1Say(x.q.q[lang], 'ex');
    const el = c1Modal(`<h3>${L2('구술시험', 'Oral exam')} ${st.qi + 1} / 5 · ${C1QCAT[x.q.cat][lang]}</h3><p class="q">${x.q.q[lang]}</p>${x.ord.map(i => `<button class="opt" data-a="${i}">${x.q.a[i][lang]}</button>`).join('')}<p class="dim">${L2('앱이 쓴 예시 문항입니다 · 실제 구술은 시험위원이 묻고 답을 듣고 판단합니다.', 'App-written example questions · the real oral exam is asked and judged by the examiner.')}</p>`);
    el.querySelectorAll('.opt').forEach(b => b.onclick = () => c1OralAns(st, +b.dataset.a));
  };
  st.show = show; show();
}
function c1OralAns(st, a) {
  const x = st.qs[st.qi]; if (!x || x.ans != null) return; x.ans = a; c1Ev('oral', { cat: x.q.cat, q: x.q.q[0], ok: a === 0 });
  if (a !== 0) c1Fail(st, 'oral', { cat: x.q.cat });
  st.qi++; if (st.qi < st.qs.length) st.show(); else { st.done = true; c1ModalClose(); }
}
function c1OralAuto(nOk) { const st = c1Cur(); if (!st || st.k !== 'oral' || !st.qs) return; for (let i = 0; i < 5 && !st.done; i++) c1OralAns(st, i < nOk ? 0 : 1); }

Object.assign(C1EV, {
  ann(st) { if (SET.c1ann === false) { C1.introCam = false; if (!st.skipLogged) { st.skipLogged = true; c1Ev('annOff'); } return true; } if (st.t1 == null) { st.t1 = C1.t + c1Say(L2(st.ko, st.en), 'ex'); if (C1.M[C1.mi] && C1.M[C1.mi].id === 'pre' && C1.si === 0) C1.introCam = true; } if (C1.t >= st.t1) { C1.introCam = false; return true; } return false; },
  inspect(st) { if (!st.open) { st.open = true; st.fault = Math.random() < (C1.exam ? 0.4 : 0.5) ? C1INS[Math.floor(Math.random() * C1INS.length)].id : null; if (window.C1_FAULT !== undefined) st.fault = window.C1_FAULT; c1InspectUI(st); } return !!st.done; },
  rc(st) {
    const sn = st.seen || (st.seen = {}), a = { thr: IN.thr, yaw: IN.yaw, pitch: IN.pitch, roll: IN.roll };
    for (const k in a) { if (a[k] > 0.85) sn[k + '+'] = 1; if (a[k] < -0.85) sn[k + '-'] = 1; }
    st.err = null; return (Object.keys(sn).length >= 8 || st.callSaid) && C1.mode === 'gps' && Math.abs(IN.thr) < 0.3 && Math.abs(IN.pitch) < 0.3;   // 이상무 구호를 하면 다음으로
  },
  arm(st, M, dt) {
    if (C1.armed) return true;
    if (st.csc) { const g = IN.thr < -0.8 && IN.pitch < -0.8 && Math.abs(IN.yaw) > 0.8 && Math.abs(IN.roll) > 0.8 && Math.sign(IN.yaw) !== Math.sign(IN.roll); st.g = g ? (st.g || 0) + dt : 0; if (st.g > 0.5) { c1Arm('csc'); return true; } }
    return false;
  },
  ctl(st, M, dt) {
    const lat = Math.hypot(M.u - st.at[0], M.v - st.at[1]); st.err = { lat, alt: M.alt - (C1.ref || 4), hdg: c1Wrap(M.hdg) };
    c1Dev(st, 'pos', lat > c1R('posTol'), { lat: +lat.toFixed(2) }, dt); c1Dev(st, 'alt', Math.abs(st.err.alt) > c1R('altTol'), { alt: +M.alt.toFixed(2) }, dt);
    const sn = st.seen || (st.seen = {}); for (const [k, v] of [['p', IN.pitch], ['r', IN.roll], ['y', IN.yaw]]) { if (v > 0.12) sn[k + '+'] = 1; if (v < -0.12) sn[k + '-'] = 1; }
    st.okT = (Object.keys(sn).length >= 6 || st.callSaid) && c1Still(M) ? (st.okT || 0) + dt : 0;   // 이상무 구호를 하면 다음으로 (조작 확인은 기록만)
    if (st.okT > 0.8) { c1Ev('ctlChk', { seen: Object.keys(sn), byCall: !!st.callSaid }); return true; }
    return false;
  },
  oral(st) { if (!st.open) { st.open = true; c1OralUI(st); } return !!st.done; }
});

// =====================================================================
//  VR (Quest 등): 1종 연습은 고글 화면이 아니라 조종자 자리(P)에 서서 맨눈으로 기체를 보는 방식
//  · 머리를 돌려 기체를 따라 봄 · 왼손 앞 아래에 안내판 · A 확인 · X 비상(점검 때는 불량) · Y 모드 · R트리거 구호 · B 메뉴
// =====================================================================
var C1XR = { rig: null, cam: null, board: null, t: 0, sel: 0, selT: 0 };
function c1VRon() { return ((typeof XR_ON !== 'undefined' && XR_ON && !XR.menu) || window.C1_VRTEST) && isC1() && S.state !== 'menu'; }
function c1XRInit() {
  if (C1XR.rig) return;
  const rig = new THREE.Group(); scene.add(rig); const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 9000); rig.add(cam);
  const b = vrPlane(0.62, 0.42, 1024, 694, { depthTest: false }); b.m.position.set(-0.32, 1.02, -0.5); b.m.rotation.set(-0.62, 0.42, 0, 'YXZ'); b.m.renderOrder = 30; rig.add(b.m);
  Object.assign(C1XR, { rig, cam, board: b });
}
function c1XRUpdate(dt) {
  c1XRInit(); const R = C1XR.rig;
  const at = C1.introCam ? c1W(-9, -7.5, 0) : c1W(0, 0, 0);
  const raise = XR.local ? c1p('eye') : 0;   // 바닥 기준 공간이 없으면 눈높이만큼 올림 (안내판은 그만큼 내림)
  R.position.copy(at); R.position.y += raise; C1XR.board.m.position.y = 1.02 - raise;
  R.rotation.set(0, -C1S.h, 0); R.updateMatrixWorld(true);
  if (window.C1_VRTEST) { C1XR.cam.position.set(0, c1p('eye'), 0); C1XR.cam.updateMatrixWorld(); C1XR.cam.lookAt(DR.p); C1XR.cam.aspect = innerWidth / innerHeight; C1XR.cam.updateProjectionMatrix(); }
  C1XR.board.m.visible = S.state === 'run' || S.state === 'pause' || S.state === 'result';
  if (S.brief && !window.C1_VRTEST) { C1XR.briefT = C1XR.briefT == null ? 8 : C1XR.briefT - dt; if (C1XR.briefT <= 0 && typeof BRIEF_GO === 'function' && BRIEF_GO) { BRIEF_GO(); C1XR.briefT = null; } } else C1XR.briefT = null;
  // 점검·구술 고르기: 오른쪽 스틱 위아래
  const st = c1Cur(); C1XR.selT -= dt;
  if (st && st.k === 'oral' && st.qs && C1XR.selT <= 0) { if (IN.pitch > 0.6) { C1XR.sel = (C1XR.sel + 3) % 4; C1XR.selT = 0.3; } else if (IN.pitch < -0.6) { C1XR.sel = (C1XR.sel + 1) % 4; C1XR.selT = 0.3; } }
  C1XR.t -= dt; if (C1XR.t > 0) return; C1XR.t = 0.2; c1BoardDraw();
}
function c1BoardDraw() {
  const B = C1XR.board, g = B.cv.getContext('2d'), W2 = B.cv.width, H2 = B.cv.height, st = c1Cur(), m = C1.M[C1.mi];
  g.clearRect(0, 0, W2, H2); g.fillStyle = 'rgba(10,14,20,.9)'; vrRR(g, 0, 0, W2, H2, 26); g.fill(); g.strokeStyle = '#c9a2ff'; g.lineWidth = 4; vrRR(g, 2, 2, W2 - 4, H2 - 4, 24); g.stroke();
  let y = 22; const line = (t, col, sz, wt) => { g.fillStyle = col || '#e8eef3'; g.font = `${wt || 600} ${sz || 30}px system-ui, sans-serif`; const ws = String(t).split(' '); let ln = ''; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > W2 - 56 && ln) { g.fillText(ln, 28, y); y += (sz || 30) * 1.25; ln = w; } else ln = tl; } if (ln) { g.fillText(ln, 28, y); y += (sz || 30) * 1.25; } };
  g.textBaseline = 'top';
  if (S.brief) {   // 브리핑: 고글 화면이 없으니 안내판에 (A·트리거로 시작 · 8초 뒤 자동 시작)
    const b = BRIEF[S.kind] || []; line('BRIEFING', '#4fe3ff', 26, 700); line(b[0] || '', '#fff', 32, 800); line(b[1] || '', '#e8eef3', 24); line(L2('A 버튼 또는 트리거 = 시작', 'A button or trigger = start') + (C1XR.briefT != null ? ` (${Math.max(0, Math.ceil(C1XR.briefT))})` : ''), '#5dff9a', 26, 700); return; }
  line((C1.exam ? L2('1종 모의평가', 'CLASS 1 · MOCK') : C1.demo ? L2('1종 시범비행', 'CLASS 1 · DEMO') : L2('1종 학습', 'CLASS 1 · LEARN')) + ' · ' + C1.mode.toUpperCase() + (C1.armed ? ' · ARMED' : ' · SAFE') + (C1.ref ? ' · ' + L2('기준', 'REF') + ' ' + C1.ref.toFixed(1) + ' m' : ''), '#c9a2ff', 24, 700);
  if (m) line(`${C1.mi + 1}. ${m.name}`, '#fff', 34, 800);
  if (st) line(st.lab, '#ffc828', 27);
  if (st && st.k === 'inspect' && st.open && !st.done) {
    const i = C1INS.findIndex(it => !st.ans[it.id]), it = C1INS[i];
    if (it) { const bad = st.fault === it.id; line(`${i + 1}/${C1INS.length} ${L2(it.ko, it.en)}: ${L2((bad ? it.bad : it.ok)[0], (bad ? it.bad : it.ok)[1])}`, '#fff', 28); line(L2('A = 정상 · X = 불량', 'A = OK · X = faulty'), '#7fd0ff', 26); }
  } else if (st && st.k === 'oral' && st.qs && !st.done) {
    const x = st.qs[st.qi], lang = window.SIM_LANG === 'en' ? 1 : 0; line(x.q.q[lang], '#fff', 27, 700);
    x.ord.forEach((ai, k) => line(`${k === C1XR.sel ? '▶ ' : '   '}${x.q.a[ai][lang]}`, k === C1XR.sel ? '#5dff9a' : '#cfd6da', 24));
    line(L2('오른쪽 스틱 위아래로 고르고 A', 'Right stick up/down, then A'), '#7fd0ff', 22);
  } else {
    if (st && st.call) { const c = L2(st.call.ko, st.call.en); line((st.callSaid ? '✓ ' : '📣 ') + (st.call.count ? (c ? c + ' → ' : '') + L2('정지. 하나…다섯', 'hold, one…five') : c), st.callSaid ? '#5dff9a' : '#7fd0ff', 24); }
    const M = c1M(), e = st && st.err; let r = `${L2('스키드', 'Skid')} ${M.alt.toFixed(1)} m · ${L2('기수', 'Hdg')} ${c1Wrap(M.hdg).toFixed(0)}°`;
    if (!C1.exam && e) { if (e.lat != null) r += ` · ${L2('위치', 'Pos')} ${e.lat.toFixed(1)}`; if (e.alt != null && st.k !== 'land' && st.k !== 'emg') r += ` · ${L2('고도', 'Ht')} ${(e.alt >= 0 ? '+' : '') + e.alt.toFixed(1)}`; if (st.k === 'hold') r += ` · ${L2('정지', 'Hold')} ${st.armedEval ? st.t.toFixed(1) : '–'}/${st.T}s`; }
    line(r, '#cfd6da', 24);
    if (st && st.k === 'rc') { const sn = st.seen || {}; line(['thr+', 'thr-', 'yaw-', 'yaw+', 'pitch+', 'pitch-', 'roll-', 'roll+'].map(k => (sn[k] ? '✓' : '·') + k.replace('thr', 'T').replace('yaw', 'R').replace('pitch', 'E').replace('roll', 'A')).join(' '), '#cfd6da', 22); }
  }
  const cap = $('c1cap'); if (cap && cap.classList.contains('on')) line(cap.textContent, '#ffd27a', 24);
  if (S.state === 'result') line(L2('결과는 웹 화면 · B 메뉴', 'Results on the web page · B menu'), '#fff', 26);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '500 20px system-ui, sans-serif'; g.fillText(L2('A 확인 · X 비상 · Y 모드 · R트리거 구호 · B 메뉴', 'A ok · X emergency · Y mode · R-trigger call · B menu'), 28, H2 - 58);
  g.fillText(C1DISC(), 28, H2 - 32);
  B.tex.needsUpdate = true;
}

c1Place();
if (window.__sim) Object.assign(window.__sim, { WIND, C1, C1P, C1RULES, C1PT, C1EV, C1S, c1Key, c1M, c1W, C1V, C1XR, c1XRUpdate, c1InspectAuto, c1OralAuto, c1CallDo, c1Heard, C1INS, C1Q, c1UV, c1Jump, c1Cur, c1SkidOnPad, c1CenterOnPad, c1Wrap, c1Log, c1Build, c1Flow, getDroneM: () => droneM, getFLANE: () => (typeof FLANE !== 'undefined' ? FLANE : null), AF, AF_IDS, MS_OK, TOUCH, isC1 });

})();
