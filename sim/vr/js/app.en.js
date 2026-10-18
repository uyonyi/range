(function () {
'use strict';

// =====================================================================
//  지형(GIS) 모듈 — DEM 을 코스 CRS로 재투영·리샘플해 "지형 패키지"로 만듦
//   · 입력: GeoTIFF / ESRI ASCII Grid, CRS 자동 인식 (EPSG:4326·5186·5179·UTM 등)
//   · 출력: 코스 주변 1.2 km 고해상도(5 m) + 주변 12 km 원경(60 m) 높이 격자
//   · 패키지는 HTML 안에 내장(기본 지형)하거나 브라우저에 저장(my DEM)
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
  'EPSG:4326': 'WGS84 lat/lon', 'EPSG:5186': 'GRS80 Central Belt (EPSG:5186)', 'EPSG:5185': 'GRS80 West Belt (EPSG:5185)', 'EPSG:5187': 'GRS80 East Belt (EPSG:5187)',
  'EPSG:5188': 'GRS80 East Sea Belt (EPSG:5188)', 'EPSG:5179': 'UTM-K (EPSG:5179)', 'EPSG:5174': 'Bessel Central Belt (EPSG:5174)', 'EPSG:2097': 'Bessel Central Belt (EPSG:2097)',
  'EPSG:32651': 'UTM 51N (EPSG:32651)', 'EPSG:32652': 'UTM 52N (EPSG:32652)', 'EPSG:3857': 'Web Mercator (EPSG:3857)'
};
function crsDef(code) {
  if (!window.proj4) throw new Error('proj4 missing');
  if (proj4.defs(code)) return code;
  if (KR_CRS[code]) { proj4.defs(code, KR_CRS[code]); return code; }
  const m = /^EPSG:(326|327)(\d\d)$/.exec(code);
  if (m) { proj4.defs(code, `+proj=utm +zone=${+m[2]}${m[1] === '327' ? ' +south' : ''} +datum=WGS84 +units=m +no_defs`); return code; }
  throw new Error('Unsupported CRS: ' + code);
}
function projector(from, to) { if (from === to) return p => p; crsDef(from); crsDef(to); const t = proj4(from, to); return p => t.forward(p); }
// 좌표 범위로 CRS 추정 (ASC 처럼 CRS 정보가 없을 때)
function guessCrs(x, y) {
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return 'EPSG:4326';
  if (x > 700000 && x < 1300000 && y > 1300000 && y < 2300000) return 'EPSG:5179';
  if (x > 0 && x < 700000 && y > 3500000 && y < 4800000) return x < 400000 && y < 4300000 && x > 150000 ? 'EPSG:32652' : 'EPSG:32652';
  if (x > 0 && x < 500000 && y > 100000 && y < 800000) return 'EPSG:5186';
  if (Math.abs(x) > 1e7 || Math.abs(y) > 1e6) return 'EPSG:3857';
  return 'EPSG:5186';
}

// ---- DEM 파일 읽기 -> { w, h, data(Float32, NaN=None), x0, y0, dx, dy(음수), crs, crsSrc, name }
async function readDem(file, crsOverride) {
  const name = file.name || 'dem';
  let R;
  if (/\.(asc|txt)$/i.test(name)) {
    const txt = await file.text(); const re = /\S+/g; const tok = () => { const m = re.exec(txt); return m ? m[0] : null; };
    const hd = {};
    for (let i = 0; i < 7; i++) { const save = re.lastIndex; const t = tok(); if (!t) break; if (/^[a-zA-Z_]+$/.test(t)) hd[t.toLowerCase()] = parseFloat(tok()); else { re.lastIndex = save; break; } }
    const w = hd.ncols, h = hd.nrows, cs = hd.cellsize, nod = hd.nodata_value !== undefined ? hd.nodata_value : -9999;
    if (!w || !h || !cs) throw new Error('Could not read the ASCII Grid header');
    const xl = hd.xllcorner !== undefined ? hd.xllcorner : hd.xllcenter - cs / 2, yl = hd.yllcorner !== undefined ? hd.yllcorner : hd.yllcenter - cs / 2;
    const data = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { const v = parseFloat(tok()); data[i] = (isNaN(v) || v === nod) ? NaN : v; if (i % 400000 === 0) await new Promise(r => setTimeout(r, 0)); }
    R = { w, h, data, x0: xl, y0: yl + h * cs, dx: cs, dy: -cs, crs: null, crsSrc: '' };
  } else {
    if (!window.GeoTIFF) throw new Error('GeoTIFF reader missing');
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
  if (crsOverride) { R.crs = crsOverride; R.crsSrc = 'set manually'; }
  if (!R.crs) { R.crs = guessCrs(R.x0, R.y0); R.crsSrc = 'guessed from coordinate range'; }
  crsDef(R.crs);
  R.name = name;
  let mn = 1e9, mx = -1e9, nv = 0; for (const v of R.data) if (!isNaN(v)) { nv++; if (v < mn) mn = v; if (v > mx) mx = v; }
  if (!nv) throw new Error('No elevation values');
  R.min = mn; R.max = mx;
  // 래스터 중심의 위Lon (배치 Defaults)
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
// 코스 좌표 (down, side) <-> Site 좌표 (site.crs 의 E, N)
//  site: { crs, e0, n0, brg(도, 다운레인지 Bearing), dc, sc } — (dc, sc) 코스 지점이 (e0, n0) 에 놓임
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
  if (cover < n * n * 0.5) throw new Error(`The DEM covers only ${Math.round(cover / (n * n) * 100)}% of the course area. Move the placement inside the DEM.`);
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

// ---- Site(지형) 목록: Flat(기본 코스) + 내장 지형 + 내 DEM
const SITE_FLAT = Object.assign({ id: 'flat', name: 'Flat · default course', crs: 'EPSG:32652', e0: 300000, n0: 4000000, brg: 0, dc: 170, sc: -15, base: 0, flat: true }, window.SIM_FLAT_SITE || {});
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
  try { return { site: s, dec: decodePkg(s) }; } catch (e) { console.warn('terrain package error', e); return { site: SITE_FLAT, dec: null }; }
}
function smooth01(e0, e1, x) { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
// Site에 전용 코스(경로를 따라 배치한 장애물)가 있으면 기본 코스 데이터를 바꿔 끼움
const SITE_PRE = siteLoad();
if (SITE_PRE.site.course) window.SIM_DATA = Object.assign({}, window.SIM_DATA, { objs: SITE_PRE.site.course.objs, wp: SITE_PRE.site.course.wp });
// 경로(코스 좌표 polyline)까지의 Zoom와 진행 방향
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
const LOWQ = !!window.SIM_MOBILE || !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);   // 모바일: 가벼운 화질

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
const SITE_L = SITE_PRE, SITE = SITE_L.site, SITE_KEY0 = SITE.flat ? '' : '@' + SITE.id, SITE_KEY = SITE_KEY0 + (!SITE.flat && SITE.course && SITE.course.v > 1 ? 'v' + SITE.course.v : '');   // Course placement가 바뀌면 기록 따로          // 현재 지형(Site)
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
// 수치지형도 벡터를 바닥 텍스처에 그림 (코스 통로 안쪽은 Pause된 터라 생략)
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
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GSZ, GSZ, 240, 240), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.set((GS0 + GS1) / 2, 0, -(GD0 + GD1) / 2);
ground.receiveShadow = true; scene.add(ground);
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
  pos.needsUpdate = true; ground.geometry.computeVertexNormals(); ground.geometry.computeBoundingSphere();
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
    ground.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); groundMat.vertexColors = true; groundMat.needsUpdate = true;
  }
}
if (TER.h) applyTerrain(TER.h);
// 원경 지형 (주변 12 km, Site별 격자 · 기본 60 m) — 고해상도 구역은 구멍으로 비움
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
  m.receiveShadow = false; scene.add(m); return m;
})();
// ---- 중간 지형: FLIGHT 구역(반경 약 1 km)을 덮는 10 m 격자 · distant 격자를 부드럽게 보간 + 잔기복 · 고해상도 구역 경계는 이어 붙임 ----
const MID = (function midTerrain() {
  const SYN = !(SITE_L.dec && SITE_L.dec.far && TER.h);   // 높이 자료 없는 Flat 사이트: 완만한 기복 + 낮은 숲 언덕을 임의로
  if (SYN && TER.h) return null;
  const G = Object.assign({}, TGRID, SITE.farGrid || {}), FN = G.farN, fs = G.farStep;
  let FH = SYN ? null : SITE_L.dec.far;
  if (SYN) { const rr = rng(4412), hills = []; for (let k = 0; k < 9; k++) { const a = rr() * 6.283, d = 780 + rr() * 330; hills.push([Math.sin(a) * d, -150 - Math.cos(a) * d, 18 + rr() * 30, 160 + rr() * 160]); }
    FH = new Float32Array(FN * FN); for (let iy = 0; iy < FN; iy++) for (let ix = 0; ix < FN; ix++) { const x = G.fs0 + ix * fs, z = -(G.fd1 - iy * fs); let h = Math.sin(x * 0.004) * Math.cos(z * 0.0035) * 1.6;
      for (const [hx, hz, A, R] of hills) h += A * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (R * R)); const din = Math.max(GS0 - x, x - GS1, GD0 + z, -z - GD1, 0); const fo = clamp((1180 - Math.max(Math.abs(x), Math.abs(z + 150))) / 160, 0, 1); FH[iy * FN + ix] = h * Math.min(1, din / 250) * fo; } }   /* 중간 지형 상자 끝에서는 0 (바깥 Flat와 이어짐) */
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
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); mesh.receiveShadow = true; scene.add(mesh);
  // 원경 그물: 중간 지형 상자 안은 비움
  if (FAR) { const fi = FAR.geometry.index.array, keep = []; const n = FN;
    for (let k = 0; k < fi.length; k += 6) { const a = fi[k], ix = a % n, iy = (a / n) | 0, s = G.fs0 + (ix + 0.5) * fs, d = G.fd1 - (iy + 0.5) * fs; if (s > s0 && s < s1 && d > d0 && d < d1) continue; for (let j = 0; j < 6; j++) keep.push(fi[k + j]); }
    FAR.geometry.setIndex(keep); }
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
// 지형을 고친 뒤 풀 높이 Restart 맞춤
function grassRefit() { const a = GRASS.instanceMatrix.array; for (let i = 0; i < GRASS.count; i++) a[i * 16 + 13] = terrainAt(a[i * 16 + 12], a[i * 16 + 14]); GRASS.instanceMatrix.needsUpdate = true; }

// 먼 나무 띠·언덕
// 나무 (줄기 + 뭉친 수관) · 먼 언덕
const SHOW_TREES = false;   // 실제 Site에 나무가 없어 Off (true 로 바꾸면 Restart 표시)
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
// (먼 언덕은 실제 Site과 달라 제거함)

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
function groundAt(x, z) {
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
// ---- 지형 Pause(整地): 시설물이 놓일 자리를 평평하게 깎고 메움 (cut & fill) ----
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
  // 1) 출발·통제 구역 터 (패드·통제탑·관람석·사로 등) — 출발 패드 높이로 Pause
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
// 수치지형도 건물: 최소 외접 사각형으로 세우고 Impacts 상자도 만듦
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
    // 코스 좌표 (down=x축 방향 yaw) -> three: down 축 = -z, side 축 = +x
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
  // 경로를 2 m 간격으로 Restart 찍고, 왼쪽(+side) 으로 OFF 만큼 평행 move 후 move평균으로 다듬음
  const rs = []; let acc = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = acc; t < L; t += 2) { const u = t / L; rs.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
    acc = Math.max(0, (Math.ceil((L - acc) / 2) * 2 + acc) - L);
  }
  let lane = rs.map((p, i) => { const q = rs[Math.min(rs.length - 1, i + 1)], o = rs[Math.max(0, i - 1)], dd = q[0] - o[0], ds = q[1] - o[1], l = Math.hypot(dd, ds) || 1; return [p[0] - ds / l * OFF, p[1] + dd / l * OFF]; });
  lane = lane.slice(Math.floor(lane.length * 0.06), Math.floor(lane.length * 0.94));
  for (let it = 0; it < 3; it++) lane = lane.map((p, i) => { let sd = 0, ss = 0, n = 0; for (let k = -8; k <= 8; k++) { const q = lane[Math.max(0, Math.min(lane.length - 1, i + k))]; sd += q[0]; ss += q[1]; n++; } return [sd / n, ss / n]; });
  // 누적 Zoom
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
    cps.push({ s, q, label: 'Over the fallen log', hw: 2.6, y0: 1.25, y1: 4.2 });
  }
  function arch(s) {   // 기울어진 나무: 아래로 지나기
    const q = at(s), a = wpt(q, -7, 0.1), b = wpt(q, 6, 4.9);
    cyl(a, b, 0.28, barkM, 'log');
    const crown = new THREE.Mesh(USPH, leafM); crown.position.copy(b).add(new V3(0, 0.6, 0)); crown.scale.set(2.6, 1.6, 2.6); crown.castShadow = true; G.add(crown);
    const yc = 0.1 + (7 / 13) * 4.8;   // 길 가운데 높이
    cps.push({ s, q, label: 'Under the leaning tree', hw: 2.4, y0: 0.25, y1: yc - 0.45 });
  }
  function gap(s) {   // 좁은 나무 틈
    const q = at(s);
    for (const lat of [-1.35, 1.35]) {
      const a = wpt(q, lat, -0.3), b = wpt(q, lat, 11);
      cyl(a, b, 0.3, barkM, 'trunk');
      const c = new THREE.Mesh(USPH, leafM); c.position.copy(wpt(q, lat * 1.8, 9.5)); c.scale.set(2.4, 2.8, 2.4); c.castShadow = true; G.add(c);
    }
    const t0 = wpt(q, -1.05, 2.2), t1 = wpt(q, 1.05, 2.2); box(t0, t1, 0.04, tapeM);   // 표시 띠
    cps.push({ s, q, label: 'Narrow gap (2.1 m)', hw: 1.05, y0: 0.2, y1: 6 });
  }
  // 약 17 m 마다 하나씩 (게이트·틈·넘기·아래로 섞어서)
  const PAT = ['g', 'n', 'g', 'l', 'g', 'a', 'n', 'g', 'l', 'g', 'a', 'n'], plan = [];
  for (let s = 16, i = 0; s < total - 30; s += 17, i++) plan.push([s, PAT[i % PAT.length]]);
  plan.push([total - 14, 'f']);
  let gi = 0;
  for (const [s, k] of plan) {
    if (s > total - 10 && k !== 'f') continue;
    if (k === 'g') gate(s, 'Forest gate ' + (++gi), 3.0, 2.6); else if (k === 'l') lowLog(s); else if (k === 'a') arch(s); else if (k === 'n') gap(s); else gate(s, 'Forest finish', 3.6, 3.2);
  }
  // 나무 비울 곳 (코스 좌표 점 목록, 반경)
  const clear = lane.filter((_, i) => i % 1 === 0);
  return { lane, total, at, cps, G, clear, R: 3.0, gateM };
})();
// 나무: Site 패키지의 trees (정사영상 수관 검출) 를 구역별 InstancedMesh 로 세움 + Impacts 격자
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
  // Zoom별 3단계 (가까이: 덩이 3개 세밀 / 중간: 덜 세밀 / 멀리: 덩이 1개)
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
  // Impacts: 줄기(캡슐) + 수관(세로 캡슐, 침엽수는 원뿔이라 위로 갈수록 가늘게)
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
  // Camera distance로 세밀도 바꿈 (0.3 초마다)
  function lod(cam) {
    for (const k of CHUNKS) { const d = Math.max(0, cam.distanceTo(k.c) - k.r * 0.7), l = d < (LOWQ ? 50 : 90) ? 0 : d < (LOWQ ? 170 : 300) ? 1 : 2;
      if (l !== k.lod) { k.lod = l; k.im.geometry = k.geos[l]; } }
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
//  기수 아래 짐벌(컬러 + 열상 2안), 위·아래 내비게이션 어안 Camera 6개, 뒤쪽 멀티밴드 안테나
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
  // 배터리 (뒤 위쪽, 밝은 색) + 걸쇠
  add(UBOX, batt, 0, 0.03, 0.065, 0.085, 0.03, 0.13);
  add(UBOX, accent, 0, 0.046, 0.12, 0.05, 0.006, 0.014);
  // 기수 짐벌: 둥근 하우징 + 두 렌즈 (컬러 · 열상)
  const gim = new THREE.Group(); gim.position.set(0, -0.03, -0.165); g.add(gim);
  add(USPH, shellD, 0, 0, 0, 0.034, 0.03, 0.03, gim);
  add(UCYL, lensRing, -0.012, 0, -0.026, 0.011, 0.012, 0.011, gim).rotation.x = Math.PI / 2;
  add(UCYL, glass, -0.012, 0, -0.033, 0.008, 0.004, 0.008, gim).rotation.x = Math.PI / 2;
  add(UCYL, lensRing, 0.013, 0, -0.025, 0.008, 0.012, 0.008, gim).rotation.x = Math.PI / 2;
  add(UCYL, m(mat(0x1a1408, { roughness: 0.1, metalness: 0.7 })), 0.013, 0, -0.031, 0.006, 0.004, 0.006, gim).rotation.x = Math.PI / 2;
  // 내비게이션 어안 Camera 6개 (위 3 · 아래 3)
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
  // Drop 모듈 (훈련용 부가장치) — 배 아래 3발
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
  // 라벨 시각 (Drop 등)
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
// Site 전용 코스: course.order 순서대로 과제 생성 (영인산 등)
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
    // 속도·Boost에 따라 한 단계 더
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
      // 아르페지오 (에너지 3 이상, or 숲 스타일의 퉁기는 SOUND)
      if ((e >= 3 || st.pluck) && step % (16 / st.arp) === 0) { const ar = ch[1].concat(ch[1].map(n => n + 12)), i = (step / (16 / st.arp) + bar) % ar.length; note(st.pluck ? 'triangle' : 'square', mf(ar[i] + (st.pluck ? 0 : 12)), t, s16 * (st.pluck ? 2.5 : 0.8), st.pluck ? 0.05 : 0.022, st.pluck ? 2400 : 3200, MUS.duck); }
      // 멜로디 (A·B 구간, 2마디 동기 + 변형)
      if (sec.n !== 'intro' && sec.n !== 'brk' && step % 2 === 0) { const M = bar % 4 >= 2 ? SONG.var : SONG.motif, n = M[(bar % 2) * 8 + step / 2]; if (n && (e >= 3 || sec.n === 'A')) { note(st.lead, mf(n), t, s16 * 1.8, st.lead === 'sine' || st.lead === 'triangle' ? 0.07 : 0.04, 3400); if (e >= 3) note('square', mf(n) * 1.004, t, s16 * 1.8, 0.022, 3000, MUS.dly); } }
      // 구간 끝 필인·Climb음, 시작 크래시
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
// ---- KEYBOARD 지정 (사용자가 바꿀 수 있음) ----
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
let KBCAP = null;   // 키 지정 화면에서 다음 입력을 기다리는 Functions Name
addEventListener('keydown', e => {
  if (KBCAP) { e.preventDefault(); e.stopPropagation(); kbCapture(e.code); return; }
  const inInput = e.target && e.target.tagName === 'INPUT';
  if (inInput && e.target.type !== 'range') return;   // Name 입력 중에는 게임 키로 쓰지 않음
  const act = Object.keys(KB).find(k => KB[k] === e.code);
  if (!inInput && (act || ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))) e.preventDefault();
  initAudio(); musicStart();
  let code = e.code;
  if (act && KB_CANON[act]) code = KB_CANON[act];                       // Functions 키 -> 내부 Name
  else if (act) code = 'MV_' + e.code;                                   // move 키는 다른 Functions을 하지 않음
  else if (Object.values(KB_CANON).includes(e.code) && e.code !== 'Space') code = 'X_' + e.code;   // 다른 키로 옮긴 Functions은 무시
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
// 스틱 곡선: real = 거의 선형(민 만큼 기울기·속도, 실제 조종기 Defaults에 가까움) · soft = 가운데가 무딘 엑스포
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
  // ATTI: 위치 유지(GPS) None · 놓아도 안 멈추고 관성·바람으로 흐름 · altitude hold만 · Boost None → 스틱을 민 만큼(기울기) 속도가 남
  atti: { name: 'ATTI', maxTilt: 30 * DEG, vmax: 12, yawRate: 110 * DEG, althold: true, brake: 0, assist: 0, autoYaw: false, margin: 0, hitPen: 3, atti: true },
  sport: { name: 'SPORT', maxTilt: 38 * DEG, vmax: 14, yawRate: 220 * DEG, althold: false, brake: 0, assist: 0, autoYaw: false, margin: 0, hitPen: 5 }
};
const ZOOMS = [{ d: 7.0, h: 2.4, fov: 64 }, { d: 4.2, h: 1.4, fov: 60 }, { d: 2.4, h: 0.8, fov: 56 }];   // 추적 Camera distance (멀리·보통·가까이)
const SET = { belly: true, guide: true, keymap: 'A', zoom: 1, diff: 'train', ghost: true, ghostSrc: 'ref', tilt: 15, showPath: false, light: false, assist: true, autoFull: true, af: 'x2d', acro: false, night: false, wind: 0, voice: true, vrMode: 2, vrModeW: 1, vrScreen: 'space', vrScr2: 1, vrCam: 'fpv', vrPip: 0, vrMap: true };
try { const s = JSON.parse(localStorage.getItem('fpvsim_fpv_settings') || '{}'); Object.assign(SET, s); } catch (e) { }
if (!SET.vrScr2) { SET.vrScreen = 'space'; SET.vrScr2 = 1; }   // VR 기본 화면: 공간 고정 (한 번 바꿔 줌, 그 뒤엔 고른 값 유지)
if (!MODES[SET.diff]) SET.diff = 'train';
function saveSet() { try { localStorage.setItem('fpvsim_fpv_settings', JSON.stringify({ belly: SET.belly, guide: SET.guide, keymap: SET.keymap, zoom: SET.zoom, diff: SET.diff, ghost: SET.ghost, ghostSrc: SET.ghostSrc, tilt: SET.tilt, assist: SET.assist, autoFull: SET.autoFull, af: SET.af, acro: SET.acro, night: SET.night, wind: SET.wind, voice: SET.voice, vrMode: SET.vrMode, vrScreen: SET.vrScreen, vrCam: SET.vrCam, vrPip: SET.vrPip, vrMap: SET.vrMap, vrScr2: SET.vrScr2, vrModeW: SET.vrModeW, hud: SET.hud, expo: SET.expo, tod: SET.tod, wx: SET.wx, wxFx: SET.wxFx })); } catch (e) { } }

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
  S.kind = kind; S.state = kind === 'demo' ? 'demo' : 'run'; S.t = 0; S.running = false; S.finished = false; S.objIdx = 0;
  S.objState = OBJS.map(() => 0); S.objNear = -1; S.pen = 0; S.impacts = 0; S.payloads = 3; S.respawn = null; S.scan = 0; S.wasInside = false; S.landT = 0;
  S.ghostT = 0; S.demoEvents = 0; S.hits = 0; S.misses = 0; S.scanned = false; S.flyT = 0; S.hitCD = 0; S.orbSum = 0; S.orbA = null; S.boosting = false; S.bellyOv = null; BOOST.on = false; { const b = $('tbBoost'); if (b) b.classList.remove('on'); }
  PAY.forEach(p => scene.remove(p.m)); PAY.length = 0;
  droneM.cans.forEach(c => c.visible = true); ghostM.cans.forEach(c => c.visible = true);
  resetDrone(startPos(), startHead()); DR.R = AFc().R; droneM.g.visible = true;
  if (!isMission(kind)) { if (kind === 'free' && AFc().cls === 'wing' && typeof rwyMapView === 'function') rwyMapView(); else mapView('course'); }
  dbfStart(); if (kind !== 'demo') { S.lastKind = kind; LAST_REC = null; } ORDER.m = null; commReset();   // 이전 FLIGHT 기록·명령·무전이 섞이지 않게
  if (isMission(kind)) msStart(kind);
  else { Object.values(MSG).forEach(g => g.visible = false); STRIKE.forEach(t => t.col.off = true); MS.list = []; MS.launch = null; if (AFc().cls === 'wing' && typeof wingRwyOK === 'function' && wingRwyOK(AFc())) { wingGround(); MS.launch = { p: DR.p.clone(), h: DR.h }; } else if (AFc().cls === 'wing') { const p = startPos(); p.y += 30; wingAir(p, startHead()); } }
  if (kind === 'demo') S.cam = 1;
  S._fromDemo = kind === 'demo';
  OBJS.forEach(o => { if (o.hint) o.hint.visible = false; });
  ui.menu.classList.add('hidden'); ui.pause.classList.add('hidden'); ui.result.classList.add('hidden'); ui.hud.classList.remove('hidden'); lyApply();
  ui.list.classList.toggle('hidden', kind !== 'course' && !isMission(kind));
  renderList(); updateTags();
  S.tut = null; $('tut').classList.add('hidden'); $('rp').classList.add('hidden'); ui.hud.classList.remove('replaying');
  if (kind !== 'demo' && kind !== 'tutorial') recStart(); else REC = null;   // 모든 임무 기록 (Replay·영상)
  showMsg(isMission(kind) ? MS_NAME[kind] + ' · ' + AFc().name : kind === 'course' ? ((IS_TOUCH || XR_ON) ? (XR_ON && vrStickMode() === 1 ? 'READY · Right stick 위로 Takeoff' : 'READY · left stick up to take off') : 'READY · ' + keyName(KB.up) + ' = TAKEOFF') : kind === 'free' ? 'FREE FLIGHT · ' + AFc().name : kind === 'tutorial' ? '' : 'REFERENCE FLIGHT', '#ffc828', 2.2);
  initAudio(); musicStart();
  COMM.q.length = 0; if (kind === 'course') setTimeout(() => comm(`${CS}, CONTROL. Course is clear, cleared for takeoff. ${WIND.lv ? 'Winds ' + (WIND.lv === 1 ? 'three' : 'seven') + ' meters per second. ' : ''}Over.`, '코스 이상 None · Takeoff 허가'), 1500);
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
    ui.resSub.textContent = `${pilotName()} · ${MODES[SET.diff].name} · ${done}/${OBJS.length} tasks completed`;
    const rows = [['Flight time', fmt(S.t)], ['Penalty', '+' + S.pen.toFixed(0) + ' s'], ['Total', fmt(total)], ['Impacts', S.impacts + ' '],
      ['Drop hits', S.hits + ' / 3'], ['Reference flight (video)', fmt(GH.total)]];
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td></tr>`).join('');
    debriefShow(done, OBJS.length, GH.total * 1.25);
    const key = 'fpvsim_fpv_best_' + SET.diff + SITE_KEY; let best = null;
    try { best = parseFloat(localStorage.getItem(key)); } catch (e) { }
    if (!best || total < best) { try { localStorage.setItem(key, String(total)); } catch (e) { } saveBest(rec); ui.resBest.textContent = '★ New best (saved for replay and ghost)'; }
    else ui.resBest.textContent = 'Best ' + fmt(best);
    refreshBest();
  }, 1600);
}
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; }

// ---------------- Impacts = Penalty + 튕김 (게임은 Resume) ----------------
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
//  통과 대상 정보 (조준 표시 · 통과 assist 공용)
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
// 수색 과제: 구역(o.search) 안에 들어오면 정확한 위치 안내를 Off (눈·열화상으로 찾기)
function searchIn(o, p) { return !!(o && o.search && o.mk && p && Math.hypot(o.mk.x - p.x, o.mk.z - p.z) < o.search.r); }
function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function stepDrone(dt) {
  if (!DR.alive) { deadTick(dt); return; }
  if (AFc().cls === 'wing') { stepWing(dt); return; }
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
    // 자동 방향 assist (Training): yaw 입력이 없으면 다음 과제 쪽으로 천천히 돌아감
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
    const wv = windAt(DR.p); if (md.gps && SET.assist) wv.multiplyScalar(0.06);   // 바람: 공기에 대한 속도로 저항 · GPS 모드(Training·Easy)는 기체가 바람을 거슬러 기울여 위치를 지킴
    DR.v.x += ((FWD.x * af + RGT.x * ar) * ksc - kk * (DR.v.x - wv.x)) * dt;
    DR.v.z += ((FWD.z * af + RGT.z * ar) * ksc - kk * (DR.v.z - wv.z)) * dt;
    // 브레이크 (스틱을 놓으면 멈춤)
    if (md.brake > 0 && Math.abs(ip) < 0.05 && Math.abs(ir) < 0.05) { const f = Math.exp(-md.brake * dt), w2 = windAt(DR.p), ww = !SET.assist ? 1 : md.gps ? 0 : 0.3; DR.v.x = w2.x * ww + (DR.v.x - w2.x * ww) * f; DR.v.z = w2.z * ww + (DR.v.z - w2.z * ww) * f; }
    // 통과 assist: 열린 곳 가운데로 살짝 끌어당김
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
    // 지형 추종 (Training: 지면 위 높이 유지 / Easy: 오르막에서 부딪히지 않게만)
    if (TER.h && assistOn && Math.abs(IN.thr) < 0.05 && !grounded && vyAssist === 0) {   // 게이트 통과 assist 중엔 Off
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
  // FLIGHT 구역 경계: 밀어냄
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
  if (!ghost && isMission() && S.kind !== 'sar') { showMsg(L2x('Drop 포드가 비어 있습니다', 'Payload pod is empty'), '#ff9a40', 1.2); sfx('bad'); return; }   // Drop가 필요 없는 임무
  const meshes = ghost && ghost !== 'demo' && ghost !== 'replay' ? ghostM.cans : droneM.cans;
  if (!ghost && S.kind === 'course' && S.payloads <= 0) { showMsg('NO PAYLOAD', '#ff6060', 1); sfx('bad'); return; }
  const can = meshes.find(c => c.visible); if (can) can.visible = false;
  if (!ghost && S.kind === 'course') S.payloads--;
  if (!ghost && S.kind === 'tutorial' && !meshes.some(c => c.visible)) setTimeout(() => droneM.cans.forEach(c => c.visible = true), 1500);   // 연습(Tutorial)만 자동 보충
  if (!ghost && S.kind === 'free' && !can) { showMsg(L2x('Drop물 None · 착륙하면 재장전', 'No payload · land to reload'), '#ff6060', 1.2); sfx('bad'); return; }
  if (!ghost && S.kind === 'sar') { if ((S.kits | 0) <= 0) { showMsg(L2x('구조 키트 None', 'No rescue kits left'), '#ff6060', 1.2); sfx('bad'); return; } S.kits--; }
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
  if (!o || o.kind !== 'drop') { refundPayload(o && o.kind === 'orbit' ? 'ORBIT FIRST · Drop물 낭비' : 'NOT A DROP TASK · Drop물 낭비'); return; }
  const r = targetEval(o.target, pos, hitObj);
  if (r.hit) { S.hits++; rumble(0.5, 1.0, 160); completeObj(1, `${r.name} HIT ✓`); return; }
  if (r.d > 25) { refundPayload(`TOO FAR (${r.d.toFixed(0)} m) · Drop물 낭비`); return; }
  if (S.kind === 'tutorial') { showMsg(`MISS ${r.d.toFixed(1)} m · try again`, '#ff9a40', 1.6); sfx('bad'); return; }
  // 한 번 Drop하면 맞든 안 맞든 다음 과제로 (빗나가면 +10초)
  S.pen += S.kind === 'course' ? 10 : 0; S.misses++;
  completeObj(2, `MISS ${r.d.toFixed(1)} m${S.kind === 'course' ? ' · +10s' : ''} → NEXT`, '#ff9a40');
}
function refundPayload(msg) {   // 실제처럼: 한 번 떨어뜨린 Drop물은 돌아오지 않음 (Tutorial만 보충)
  if (S.kind === 'tutorial') { S.payloads = Math.min(3, S.payloads + 1); const c = droneM.cans.find(c => !c.visible); if (c) c.visible = true; }
  showMsg(msg + (S.kind === 'course' ? L2x(` · 남은 ${S.payloads}개`, ` · ${S.payloads} left`) : ''), '#ffc828', 1.8); sfx('bad');
}
// 드론 Light: 기본은 밤에 자동으로 On · L 키 / 패드 Right stick 누르기 / VR X / 터치 💡 로 직접 켜고 Off
function lightOn() { return S.lightOv != null ? S.lightOv : (!!SET.light || (ENV.night && !ENV.ir)); }
function L2x(ko, en) { return window.SIM_LANG === 'en' ? en : ko; }
// Free Flight: 착륙해서 2초 있으면 재장전
function reloadTick(dt) {
  if (S.state !== 'run' || S.kind !== 'free' || !AFc().drop || !DR.landed || droneM.cans.every(c => c.visible)) { S.reloadT = 0; return; }
  S.reloadT = (S.reloadT || 0) + dt; if (S.reloadT >= 2) { droneM.cans.forEach(c => c.visible = true); S.reloadT = 0; showMsg(L2x('재장전 완료', 'Reloaded'), '#5dff9a', 1.2); sfx('good'); }
}
// Boost: 켜기/끄기 (어디서나 사용). 켜면 기체 최고 속도까지
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
// 통과형 과제(게이트·슬라롬): 이번 프레임에 면을 지났는지 -> { inside, fwd, x } or null
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
  // 놓치고 지나감 -> 그 과제만 실패(✗)로 두고 다음 목표로 (Penalty None)
  //  ① 다음·그다음 게이트를 제대로 통과했거나 ② 지금 과제 근처(20 m)에 왔다가 다음 과제까지 구간의 절반을 넘어감
  if (S.kind === 'course' && o.kind !== 'takeoff' && o.kind !== 'land') {
    for (let j = S.objIdx + 1; j <= Math.min(S.objIdx + 2, OBJS.length - 1); j++) {
      const q = OBJS[j]; if (q.kind !== 'pass' && q.kind !== 'slalom') continue;
      const r = passTest(q, prev, cur, mg); if (!(r && r.inside && r.fwd)) continue;
      const missed = [];
      for (let k = S.objIdx; k < j; k++) { S.objState[k] = 2; if (OBJS[k].hint) OBJS[k].hint.visible = false; missed.push(OBJS[k].label); }
      S.objIdx = j; S.scan = 0; S.wasInside = false; S.scanned = false; S.orbSum = 0; S.orbA = null;
      comm(`${CS}, CONTROL. You missed ${missed.length > 1 ? 'two obstacles' : 'one'}. Press on.`, `${missed.join(', ')} 실패 · Resume 진행`);
      completeObj(1, `${missed.join(' · ')} ✗ → ${q.label} ✓`, '#ff9a40');
      return;
    }
    const anc = q => q.kind === 'orbit' && q.b ? q.b.world(0, 0, 0) : q.mk;   // 오빗 안내점(mk)은 드론을 따라 원 위를 돌므로 탱크 중심으로 잼
    const oA = anc(o); let nx = null; for (let k = S.objIdx + 1; k < OBJS.length; k++) { const q = OBJS[k], qa = anc(q); if (q.kind !== 'drop' && qa && oA && Math.hypot(qa.x - oA.x, qa.z - oA.z) > 10) { nx = q; break; } }   // 방향은 고정된 다음 과제로 잼 (Drop 표적은 움직이거나 같은 자리라 제외)
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
// FLIGHT 구역: 중심 (down 150, side 0), 반지름 650 m (쿼드 경계) · 임무 사건은 이 안 (FLY_R_SAFE) 에만 둠
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
  if (window.__RWY) {   // 활주로: 테두리 있는 흰 띠 + Takeoff 방향 시단 표시 + RWY 글자
    if (window.__RWY.apron) {   // 계류장(색) + 유도로 + H 패드(노란 점)
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
  // FLIGHT 구역 경계 (점선 원)
  { const c = mxy(-FLY_C.z, FLY_C.x), e = mxy(-FLY_C.z + FLY_R, FLY_C.x), r = Math.abs(e[1] - c[1]); g.strokeStyle = 'rgba(255,90,90,.55)'; g.lineWidth = 1.2; g.setLineDash([5, 4]); g.beginPath(); g.arc(c[0], c[1], r, 0, 7); g.stroke(); g.setLineDash([]); }
}
drawMapBg(); MAP_CACHE.course = mapBg;
// 지도 범위: 코스 = 코스 둘레 / 임무 = 그 임무의 사건·구역이 다 들어오게 (배경은 한 번 만들어 둠)
// 지도 크게 보기: 지도 누르기(클릭·탭)·J 키·VR Menu → FLIGHT 구역 전체를 크게 · Restart 누르면 원래대로
const MAPZ = { on: false, keep: null };
function mapZoom(on) {
  if (on === MAPZ.on) return;
  if (on) { MAPZ.keep = { bg: mapBg, V: MAPV }; mapView('area', [[-FLY_C.z, FLY_C.x, FLY_R + 30]]); }
  else if (MAPZ.keep) { mapBg = MAPZ.keep.bg; MAPV = MAPZ.keep.V; MAPZ.keep = null; }
  MAPZ.on = on; ui.map.classList.toggle('big', on);
}
ui.map.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); mapZoom(!MAPZ.on); });
function mapView(key, pts, once) {
  if (MAPZ.on && key !== 'area') { MAPZ.on = false; MAPZ.keep = null; ui.map.classList.remove('big'); }   // 새 FLIGHT이 시작되면 기본 지도로
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
  // 1) 게이트 조준 브래킷 + FLIGHT 방향 표시
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
      // 정렬 여부: FLIGHT 방향 표시(or 화면 중앙)가 브래킷 안에 있는지
      const ref = fpmPos || { x: innerWidth / 2, y: innerHeight / 2 };
      const ok = ref.x > x0 && ref.x < x1 && ref.y > y0 && ref.y < y1;
      ui.brk.classList.toggle('ok', ok);
      ui.brkLbl.textContent = `${dist.toFixed(0)} m`;
    } else ui.brk.classList.add('hidden');
  } else ui.brk.classList.add('hidden');
  // 2) Drop 조준경
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
// 고정익의 pitch 는 'Climb각'(+ 위), 쿼드는 '앞으로 숙임'(+ 아래) -> 그릴 때 부호를 맞춤
function visPitch(st) { return st !== ghostS && AFc().cls === 'wing' ? -st.pitch : st.pitch; }
function placeModel(mdl, st) { mdl.g.position.copy(st.p); eul.set(-visPitch(st), -st.h, -st.roll); mdl.g.quaternion.setFromEuler(eul); }
let last = performance.now(), acc = 0;
const STEP = 1 / 120;
function handleKeys() {
  while (pressed.length) {
    const k = pressed.shift();
    if (RCUI.open) continue;
    if (S.brief && (k === 'Enter' || k === 'Space' || k === 'PadA')) { if (BRIEF_GO) BRIEF_GO(); continue; }
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
    else if (k === 'KeyL') { S.lightOv = !lightOn(); showMsg(S.lightOv ? L2x('Light On', 'LIGHT ON') : L2x('Light Off', 'LIGHT OFF'), '#ffe9a0', 0.9); }
    else if (k === 'KeyM') { AU.on = !AU.on; showMsg(AU.on ? 'SOUND ON' : 'SOUND OFF', '#fff', 0.8); if (AU.master) AU.master.gain.value = AU.on ? 0.55 : 0; }
    else if (k === 'KeyH') { SET.assist = !SET.assist; saveSet(); updateTags(); syncSeg(); showMsg(SET.assist ? 'ASSIST ON' : 'ASSIST OFF', '#fff', 0.8); }
    else if (k === 'PadUp') { SET.tilt = Math.min(40, SET.tilt + 5); saveSet(); syncSeg(); showMsg('CAM TILT ' + SET.tilt + '°', '#fff', 0.7); }
    else if (k === 'PadDown') { SET.tilt = Math.max(0, SET.tilt - 5); saveSet(); syncSeg(); showMsg('CAM TILT ' + SET.tilt + '°', '#fff', 0.7); }
    if (S.state !== 'run') continue;
    if (S.tut && S.tut.st !== 'fly') continue;
    if (k === 'Space' && DR.alive) { if (actionKind() === 'report') missionPhoto(); else dropPayload(DR.p, DR.v, false); }   // Drop 버튼 = 임무에 따라 Drop / 사진 보고
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
  const ghostOn = S.state === 'demo' || (S.state === 'pause' && S.prevState === 'demo');   // Ghost drone은 Watch Reference Flight에서만
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
  spot.intensity = lerp(spot.intensity, (lightOn() || inB || nearB) && S.state !== 'menu' ? 4.5 : 0, 1 - Math.exp(-dt * 8));
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
  if (XR_ON) xrTick(dt);   // VR: 드론 Camera 영상을 화면 텍스처로 먼저 그림
  if (!noRender) { const mn = S.state === 'menu' && !XR_ON; if (mn) menuRenderPre(dt); renderer.render(XR_ON ? VRS : scene, camera); if (!XR_ON) renderBelly(); if (mn) menuRenderPost(); }
}

// =====================================================================
//  Tutorial
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
  { title: 'Basic Controls', sub: 'Takeoff · hover · move · land', custom: true,
    text: [IS_TOUCH ? 'Push the left stick up to climb and down to descend (left/right = yaw). Use the right stick to move forward, back and sideways.' : 'Climb {UP} · descend {DOWN} · forward/back {FWD}/{BACK} · strafe {LEFT}/{RIGHT} · turn {YAWL}/{YAWR}. You can change keys under [Key setup] in the menu.',
      'In Training mode the drone stops where it is when you release the sticks (keys). Use short, repeated taps instead of holding.',
      'The two boxes at the bottom left show your current stick positions (left = throttle·yaw, right = pitch·roll).'],
    spec: 'H-pad 1.2 m diameter · landing = 0.8 s on the pad at near-zero speed',
    start: () => ({ p: startPos(), h: startHead(), focus: OBJ.pad_start.world(0, 0, 0.5), landed: true }),
    steps: [
      { label: 'Take off: climb 2 m', mk: () => OBJ.pad_start.world(0, 0, 2.5), test: p => agl(p) > 2.0 },
      { label: 'Hover 3 s (zero speed)', mk: () => null, hold: 3, test: () => DR.v.length() < 0.6 && agl(DR.p) > 1.0 },
      { label: 'Move 15 m forward', mk: () => OBJ.pad_start.world(0, 16, 2), test: p => OBJ.pad_start.local(p).ly > 14.5 },
      { label: 'Come back and land on the start pad', mk: () => OBJ.pad_start.world(0, 0, 1.8), test: p => { const l = OBJ.pad_start.local(p); return Math.hypot(l.lx, l.ly) < 0.85 && DR.landed && DR.v.length() < 0.8; }, hold: 0.8 }
    ] },
  { title: 'Circle Obstacle (Ring)', sub: 'Precision pass', range: [1, 1],
    text: ['Practice flying exactly through the center of a fixed ring. Touching the rim bounces you off with a penalty.',
      'Match the ring height first, then keep the green flight-path marker (○—) inside the yellow aiming bracket and move forward slowly.'],
    spec: () => `Inner diameter 1.22 m (4 ft) · center height ${num(BY.ring_a.alt, 2.75)} m · between the two H-pads`,
    start: () => startFacing(1, 12) },
  { title: 'Window Gate', sub: 'Gate pass · attitude control', range: [2, 2],
    text: ['Fly through the center of the opening. The window sits high, so set your altitude first to clear the stand below.',
      'The aiming bracket grows as you get closer. Keep it green as you pass through.'],
    spec: () => `Opening 1.22 × 1.22 m · bottom edge ${num(BY.gate_sq1.elev, 2.05)} m`,
    start: () => startFacing(2, 12) },
  { title: 'Triangle Gate', sub: 'High-altitude pass', range: [3, 3],
    text: ['A different shape at a higher altitude. The triangle is widest at the bottom, so aim slightly below the middle for the most room.',
      'You need to climb above 4 m. Stop moving forward while you climb and set the altitude first.'],
    spec: () => `Inscribed circle 1.22 m (4 ft) · side ${num(BY.gate_tri1.w, 2.11)} m · base height ${num(BY.gate_tri1.elev, 4.05)} m`,
    start: () => startFacing(3, 12) },
  { title: 'Pole Slalom', sub: 'Avoid obstacles while keeping speed', range: [5, 10],
    text: ['Weave through six black-and-yellow poles. Pass on the side shown at the top of the screen (LEFT SIDE / RIGHT SIDE) and by the light-blue marker.',
      'The poles are staggered in two rows. Small strafes ({LEFT}/{RIGHT}) are more stable than turning ({YAWL}/{YAWR}).'],
    spec: '6 poles · 7.0 m tall · two staggered rows 2.5 m apart',
    start: () => { const s = startFacing(5, 9, 2.1); return s; } },
  { title: 'Drop 1 · Ivan Targets', sub: 'Static target attack', range: [11, 11],
    text: ['Drop the payload (M84 model) on the ground targets. The + at the center of the DROP SCOPE (bottom left) is the "predicted impact point".',
      'If the drone is moving, the payload carries that speed forward. When the target overlaps the + and DROP NOW (green) appears, press {DROP} (gamepad A/RT).',
      'Payloads refill in the tutorial, so practice as often as you like.'],
    spec: '3 Ivan silhouettes · 2.2 m apart · board 0.9 × 1.7 m · hit radius about 1.4 m',
    start: () => startBeforeTarget(OBJ.ivan_grp1.world(0, 0, 0), 28, 6) },
  { title: 'Drop 2 · MIT Moving Target', sub: 'Tracking a moving target', range: [12, 12],
    text: ['This target moves left and right on a rail. The scope shows where the target will be by the time the payload lands.',
      'Follow the target and match its speed before dropping. The faint dot is where the target is now; the solid dot is where it will be at impact.'],
    spec: () => `Rail ${num(BY.mit.length, 30)} m · up to 3.5 m/s · at ${BY.mit.down} m`,
    start: () => startBeforeTarget(OBJ.mit.world(0, 0, 0), 26, 6) },
  { title: 'Drop 3 · Tank', sub: 'Orbit recon, then top attack', range: [13, 14],
    text: ['First fly one full circle (360°) around the tank at about 12 m radius. Follow the green ring on the ground and the green frames; ORBIT % shows at the top left.',
      'After a full circle the task switches to TOP ATTACK. Fly over the tank and drop when the DROP SCOPE turns green. Payloads dropped before the orbit is done are returned.',
      'The tank is large, so drops from height still hit. Just remember: the higher you are, the longer the fall and the farther the payload travels forward.'],
    spec: () => `Hull ${num(BY.tank.length, 8.1)} × ${num(BY.tank.w, 3.3)} m · height ${num(BY.tank.height, 2.85)} m · at ${BY.tank.down} m`,
    start: () => startBeforeTarget(OBJ.tank.world(0, 0, 0), 32, 9) },
  { title: 'Tunnel', sub: 'Confined-space pass (on the return leg)', range: [15, 15],
    text: ['On the way back, fly through a pipe set at a diagonal. The entrance is angled, so line the drone up with the pipe axis before entering.',
      'Inside, keep your speed and fly straight — it is actually safer.'],
    spec: () => `Inner diameter ${num(BY.tunnel1.dia, 1.7)} m · length ${num(BY.tunnel1.length, 4.5)} m · heading 135°`,
    start: () => startFacing(15, 10) },
  { title: 'Bunker Recon', sub: 'Building entry · interior recon', range: [16, 16],
    text: ['Enter through the upper front window, scan inside for at least 1.5 s, then exit through the second window in the left wall.',
      'On the return leg you approach from behind (north), so go around the side and make a U-turn in front of the front (south) window. The yellow frames show the way around. Stop in front of the window, match its height, and enter slowly.',
      'When SCAN COMPLETE appears, fly out. You can exit through the left window (light blue) as in the video, or back out through the window you came in.'],
    spec: () => `Bunker ${num(BY.bunker1.w, 3.8)} × ${num(BY.bunker1.d, 3.0)} × ${num(BY.bunker1.h, 3.1)} m · windows about 1.0 × 0.8 m`,
    start: () => { const s = startFacing(16, 9); return s; } },
  { title: 'Finish Gate · Landing', sub: 'Final gate and precision landing', range: [17, 18],
    text: ['Fly back toward the start, pass the FINISH gate, then land on the right H-pad.',
      'To land, bring your speed to almost zero over the pad and descend slowly with {DOWN}. Stay on the pad for 0.8 s to finish.'],
    spec: () => `Gate 1.22 × 1.22 m · bottom edge ${num(BY.gate_finish.elev, 1.6)} m · landing pad 1.2 m diameter`,
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
  const T = IS_TOUCH ? { UP: 'left stick ↑', DOWN: 'left stick ↓', YAWL: 'left stick ←', YAWR: '→', FWD: 'right stick ↑', BACK: '↓', LEFT: 'right stick ←', RIGHT: '→', DROP: 'DROP' } : null;
  return t.replace(/\{(UP|DOWN|YAWL|YAWR|FWD|BACK|LEFT|RIGHT|DROP)\}/g, (m, k) => '<b>' + (T ? T[k] : keyName(KB[{ UP: 'up', DOWN: 'down', YAWL: 'yawL', YAWR: 'yawR', FWD: 'fwd', BACK: 'back', LEFT: 'left', RIGHT: 'right', DROP: 'drop' }[k]])) + '</b>');
}
function tutRender() {
  const el = $('tut'); if (!S.tut || S.kind !== 'tutorial') { el.classList.add('hidden'); return; }
  const L = LESSONS[S.tut.i], spec = typeof L.spec === 'function' ? L.spec() : L.spec;
  let steps = '';
  if (L.custom) steps = '<ol>' + L.steps.map((s, i) => `<li class="${i < S.tut.step ? 'done' : i === S.tut.step ? 'cur' : ''}">${s.label}</li>`).join('') + '</ol>';
  const foot = IS_TOUCH ? (S.tut.st === 'intro' ? '<div class="go">Tap this panel to start flying</div>' : S.tut.st === 'done' ? `<div class="go ok">Done! Tap this panel → ${S.tut.i + 1 < LESSONS.length ? 'next lesson' : 'menu'} · ⟲ button = retry</div>` : '<div class="go dim">⟲ button = restart lesson · ❚❚ = pause</div>')
    : S.tut.st === 'intro' ? '<div class="go">When ready, press <b>Enter</b> or <b>Space</b> (gamepad <b>A</b>) to start flying</div>'
    : S.tut.st === 'done' ? `<div class="go ok">Done! <b>Enter</b>(A) ${S.tut.i + 1 < LESSONS.length ? 'next lesson' : 'menu'} · <b>R</b>(Y) retry</div>`
      : '<div class="go dim"><b>R</b>(Y) restart lesson · <b>Esc</b> Pause</div>';
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
//  FLIGHT Records · Replay · My best Ghost
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
// ---- Replay 플레이어
const RP = { rec: null, t: 0, speed: 1, playing: true, ev: 0, pose: { p: new V3(), v: new V3(), h: 0, pitch: 0, roll: 0, thrust: 0 }, back: 'menu' };
function replayStart(rec, back) {
  if (!rec || !rec.s || rec.s.length < 2) { showMsg('NO RECORDING', '#ff6060', 1); return; }
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
  if (typeof wizGo === 'function') wizGo(3);   // FLIGHT 끝나고 돌아오면 코스 고르기 화면
}

// =====================================================================
//  TOUCH CONTROLS (휴대폰·태블릿): 가상 스틱 2개 + 버튼
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
  const bst = $('tbBoost'); bst.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); boostToggle(); });   // 한 번 누르면 켜짐, Restart 누르면 꺼짐
  $('tbFull').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleFull(); });
  $('tut').addEventListener('pointerdown', () => { if (S.tut && S.tut.st !== 'fly') pressed.push('Enter'); });
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  // 세로 화면 안내: Full 전환 중 잠깐 세로로 잡히는 크기 변화는 무시 (0.6초 넘게 세로일 때만)
  let rotT = 0; const rot = () => { clearTimeout(rotT); const portrait = innerHeight > innerWidth * 1.05; if (!portrait) { $('rot').classList.add('hidden'); return; } rotT = setTimeout(() => $('rot').classList.toggle('hidden', !(innerHeight > innerWidth * 1.05)), 600); };
  addEventListener('resize', rot); addEventListener('orientationchange', () => setTimeout(rot, 200)); rot();
})();

// 시작할 때 자동 Full (브라우저 규칙상 클릭·터치·키 입력이 있어야 전환됨)
function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
let fullAsk = 0;
function enterFull() { if (!SET.autoFull || isFull() || /[?&]test/.test(location.search) || performance.now() - fullAsk < 1500) return; fullAsk = performance.now(); toggleFull(); }
// Menu를 고르는 중에는 Full으로 바꾸지 않음 (화면 크기가 바뀌며 Menu가 흔들림) — FLIGHT을 시작할 때만 전환
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
//  Guide: 다음 과제까지 따라갈 사각 틀(3D) + 조작 안내 문구 + 아래 Camera
// =====================================================================
const GUIDE = { n: 12, sp: 2.6, meshes: [], next: null, detour: false };
(function makeFrames() {
  // FLIGHT 경로에 수직으로 서는 사각 틀 ('하늘의 길' 방식) - FPV·추적 시점 모두에서 잘 보임
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
// 게이트·링 앞 정렬 Zoom: 빠를수록 멀리서 줄을 맞춤 (쿼드 5~20 m · 고정익 25~60 m)
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
  if (!o) { hideGuide(); return; }
  if (o.kind === 'bunker' && !S.scanned && insideBunker(subj.p)) {
    hideGuide(); if (!SET.guide) return;
    const el = $('guide'); el.classList.remove('hidden'); el.innerHTML = '<div class="ok">Scanning · stay inside for a moment</div>'; return;
  }
  let pts = guidePoints(o, subj.p);
  if (!pts) { hideGuide(); return; }
  GUIDE.next = pts[1];
  if (!SET.guide) { hideGuide(); return; }
  // FLIGHT 경로: 지금 날아가는 방향으로 먼저 이어졌다가 선 반경만큼 휘어 목표로 (직선으로 꺾지 않음)
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
  const T = XR_ON && vrStickMode() === 3 ? { up: 'right stick ↑', down: 'right stick ↓', yawL: (window.SIM_LANG === 'en' ? 'look ←' : '고개 ←'), yawR: (window.SIM_LANG === 'en' ? 'look →' : '고개 →'), fwd: 'left stick ↑', back: 'left stick ↓', left: 'right stick ←', right: 'right stick →', drop: 'R트리거', boost: 'L트리거' }
    : XR_ON && vrStickMode() === 1 ? { up: 'right stick ↑', down: 'right stick ↓', yawL: 'left stick ←', yawR: 'left stick →', fwd: 'left stick ↑', back: 'left stick ↓', left: 'right stick ←', right: 'right stick →', drop: 'R트리거', boost: 'L트리거' }
    : (IS_TOUCH || XR_ON) ? { up: 'left stick ↑', down: 'left stick ↓', yawL: 'left stick ←', yawR: 'left stick →', fwd: 'right stick ↑', back: 'right stick ↓', left: 'right stick ←', right: 'right stick →', drop: XR_ON ? 'R트리거' : 'DROP', boost: XR_ON ? 'L트리거' : 'BST' } : null;
  const wingF = AFc().cls === 'wing', vm0 = XR_ON ? vrStickMode() : 2;
  /* 고정익: 선 = 기울이기(롤) · Climb = 스틱 당기기(뒤) · 속도 = 스로틀. 모드에 따라 스틱 위치가 다름 */
  const WL = T ? (XR_ON && vm0 === 1 ? { pu: 'left stick ↓', pd: 'left stick ↑', bl: 'right stick ←', br: 'right stick →', th: 'right stick ↑', tl: 'right stick ↓' } : { pu: 'right stick ↓', pd: 'right stick ↑', bl: 'right stick ←', br: 'right stick →', th: 'left stick ↑', tl: 'left stick ↓' })
    : { pu: keyName(KB.back), pd: keyName(KB.fwd), bl: keyName(KB.left), br: keyName(KB.right), th: keyName(KB.up), tl: keyName(KB.down) };
  const K = a => (wingF && WL[a]) ? WL[a] : T ? T[a] : keyName(KB[a]);
  const tgt0 = (o.kind === 'orbit' || GUIDE.detour) ? pts[1] : (pts.length > 2 ? pts[pts.length - 2] : pts[1]);
  /* 조작 안내도 화면에 그려진 곡선 위의 앞쪽 점을 기준으로 (목표 지점이 아니라 Guide를 따라가도록) */
  const vs = Math.hypot(DR.v.x, DR.v.z), lookD = wingF ? clamp(vs * 2.5, 30, 70) : clamp(3 + vs * 0.9, 4, 14), cL = curve.getLength();
  const tgtC = curve.getPointAt(Math.min(1, lookD / Math.max(cL, 0.1)));
  const tgt = (o.kind === 'drop' || o.kind === 'land') ? tgt0 : tgtC;
  const d = tgt.clone().sub(subj.p), fwd = new V3(Math.sin(DR.h), 0, -Math.cos(DR.h)), rgt = new V3(Math.cos(DR.h), 0, Math.sin(DR.h));
  const df = d.dot(fwd), dr = d.dot(rgt), dy = d.y, hd = Math.hypot(df, dr), ang = Math.atan2(dr, df) / DEG;
  const lines = [];
  const steer = () => {
    if (wingF) {
      if (Math.abs(dy) > 2) lines.push([`${dy > 0 ? 'Climb' : 'Descend'} ${Math.abs(dy).toFixed(0)} m (${K(dy > 0 ? 'pu' : 'pd')})`, '']);
      if (Math.abs(ang) > 6) lines.push([`${ang > 0 ? 'Bank right to turn' : 'Bank left to turn'} (${K(ang > 0 ? 'br' : 'bl')})`, '']);
      return;
    }
    if (Math.abs(dy) > 0.3) lines.push([`${dy > 0 ? 'Climb' : 'Descend'} ${Math.abs(dy).toFixed(1)} m (${K(dy > 0 ? 'up' : 'down')})`, '']);
    if (hd > 2.5 && Math.abs(ang) > 12) lines.push([`${ang > 0 ? 'Turn right' : 'Turn left'} (${K(ang > 0 ? 'yawR' : 'yawL')})`, '']);
    else if (hd <= 12 && Math.abs(dr) > 0.3) lines.push([`${dr > 0 ? 'Strafe right' : 'Strafe left'} ${Math.abs(dr).toFixed(1)} m (${K(dr > 0 ? 'right' : 'left')})`, '']);
  };
  if (o.kind === 'drop') {
    if (hd > 4) lines.push([`${Math.abs(ang) > 15 ? (ang > 0 ? 'Turn right (' + K('yawR') + ') · ' : 'Turn left (' + K('yawL') + ') · ') : ''}Fly toward the target (${K('fwd')}) ${hd.toFixed(0)} m`, '']);
    else lines.push([`Over the target · drop when the DROP SCOPE turns green (${K('drop')}) · one chance`, 'ok']);
  } else if (o.kind === 'land') {
    if (hd > 0.5) lines.push([`Move toward the pad ${hd.toFixed(1)} m`, '']);
    else lines.push([`Over the pad · descend slowly (${K('down')})`, 'ok']);
  } else if (o.kind === 'takeoff') lines.push([`Climb (${K('up')})`, '']);
  else if (o.kind === 'orbit') {
    lines.push([`Orbit the tank · ${Math.min(100, Math.abs(S.orbSum) / (Math.PI * 2) * 100).toFixed(0)}% · keep flying along the green frames (${K('fwd')})`, 'ok']);
    steer();
  } else {
    if (GUIDE.detour) lines.push(['Go around the bunker, U-turn in front of the front window → enter', 'warn']);
    if (o.kind === 'bunker' && S.scanned) lines.push(['Scan done · exit through a window (left or the one you came in)', 'ok']);
    steer();
    if (!lines.length) lines.push([`Aligned · fly forward (${K('fwd')})`, 'ok']);
  }
  if (S.boosting) lines.unshift(['BOOST ▲▲', 'warn']);
  const el = $('guide'); el.classList.remove('hidden');
  el.innerHTML = lines.map(l => `<div class="${l[1]}">${l[0]}</div>`).join('');
}

// ---- 아래 Camera (Drop·선 때 화면 한쪽에 드론 바로 아래를 보여줌) ----
const bellyCam = new THREE.PerspectiveCamera(72, 4 / 3, 0.1, 400);
// 'big' = Drop·선 때 자동으로 크게 / 'small' = 직접 켠 경우 / null = 안 보임
function bellyMode() {
  if (S.state !== 'run' || !DR.alive || (S.tut && S.tut.st !== 'fly')) return null;
  const ov = S.bellyOv;
  if (ov && ov.val === false && ov.idx !== S.objIdx) S.bellyOv = null;          // 끈 것은 다음 과제에서 Restart 자동
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
  // PC: 평소엔 왼쪽(드론·과제 목록과 안 겹침). Tutorial 중엔 왼쪽에 설명창이 있으니 과제 목록 아래로
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
// 코스 좌표 -> 현재 Site의 투영 좌표 (SITE.crs)
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
  if (!window.GeoTIFF) throw new Error('GeoTIFF reader missing');
  setOrthoStatus('Reading… (' + (file.size / 1048576).toFixed(0) + ' MB)', '#ffc828');
  const tiff = await GeoTIFF.fromBlob(file);
  const img0 = await tiff.getImage(0);
  const bb = img0.getBoundingBox();                       // [xmin, ymin, xmax, ymax]
  // 위성사진 CRS (GeoTIFF 정보 -> 없으면 범위로 추정) 로 코스 좌표를 변환
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
  if (ex0 >= ex1 || ey0 >= ey1) throw new Error('The image does not overlap the course.');
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
    setOrthoStatus(`Reading… ${Math.round((y2 - wy0) / (wy1 - wy0) * 100)}%`, '#ffc828');
    await new Promise(r => setTimeout(r, 0));
  }
  // 코스 좌표 바닥 텍스처 생성 (밖은 Default ground)
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
      const wgt = Math.min(1, Math.min(sx, sy, sw - 1 - sx, sh - 1 - sy) / FEATH);   // 가장자리 15 m 는 Default ground과 부드럽게 섞음
      for (let c = 0; c < 3; c++) { const v = Math.min(255, ((src[a + c] * (1 - fx) + src[a + 3 + c] * fx) * (1 - fy) + (src[b + c] * (1 - fx) + src[b + 3 + c] * fx) * fy) * ORTHO_GAIN); dd[o + c] = dd[o + c] * (1 - wgt) + v * wgt; }
      cover++;
    }
  }
  g.putImageData(id, 0, 0);
  applyGroundCanvas(cv);
  const pct = Math.round(cover / (ORTHO_N * ORTHO_N) * 100);
  setOrthoStatus(`Orthophoto applied (${(rx * step * mk).toFixed(2)} m/px, ${pct}%)`, '#5dff9a');
  if (!(opt && opt.nosave)) cv.toBlob(bl => { if (bl) IDB.put('ortho' + SITE_KEY0, bl); }, 'image/jpeg', 0.9);
  return { res: rx * step * mk, cover: pct, srcRes: res0 };
}
// Site 기본 정사영상 (sites/*.tif, Site 데이터의 ortho 항목) — 사용자가 올린 사진이 없을 때 자동으로 입힘
async function autoOrtho() {
  if (!SITE.ortho) return false;
  try {
    setOrthoStatus('Loading site orthoimage…', '#ffc828');
    let bl;
    if (SITE.ortho.startsWith('data:')) {   // 파일 안에 넣은 사진: fetch 없이 직접 풀기 (fetch 가 막힌 곳 대비)
      const b64 = SITE.ortho.slice(SITE.ortho.indexOf(',') + 1), bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      bl = new Blob([u], { type: 'image/tiff' });
    } else { const r = await fetch((/^(https?:|\/)/.test(SITE.ortho) ? '' : (window.SIM_BASE || '')) + SITE.ortho); if (!r.ok) throw new Error('HTTP ' + r.status); bl = await r.blob(); } await loadOrthoFile(bl, { nosave: true });
    setOrthoStatus(setOrthoStatusTxt() + ' · ' + ((window.SIM_LANG === 'en' && SITE.orthoSrc_en) || SITE.orthoSrc || ''), '#5dff9a'); return true;
  } catch (e) { setOrthoStatus('No orthoimage (default ground)', ''); return false; }
}
function setOrthoStatusTxt() { const el = $('orthoStatus'); return el ? el.textContent : ''; }
async function restoreOrtho() {
  const bl = await IDB.get('ortho' + SITE_KEY0); if (!bl) { autoOrtho(); return; }
  try {
    const im = await createImageBitmap(bl); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; cv.getContext('2d').drawImage(im, 0, 0);
    applyGroundCanvas(cv); setOrthoStatus('Using saved satellite image', '#5dff9a');
  } catch (e) { }
}

// =====================================================================
//  지형 Site 선택 · DEM 불러오기 화면
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
  if (SITE.flat) info.innerHTML = 'Flat — no terrain relief. Load a DEM to lay the same course on real terrain.';
  else info.innerHTML = `<b>${stName(SITE)}</b> · DEM ${stSrc(SITE)} (${CRS_LABEL[SITE.demCrs] || SITE.demCrs}, ${SITE.demRes} m)<br>` +
    `Course centre ${SITE.lat.toFixed(5)}°N ${SITE.lon.toFixed(5)}°E · bearing ${SITE.brg}° · reference (start pad) elevation ${SITE.base.toFixed(1)} m<br>` +
    `Course area elevation ${SITE.inMin}~${SITE.inMax} m · distant ${SITE.farMin}~${SITE.farMax} m · coverage ${SITE.cover}%<br>` +
    `Site grading for facilities — cut ${fmtM3(EARTH.cut)} · fill ${fmtM3(EARTH.fill)}` + (SITE.vec ? `<br>Features — buildings ${SITE.vec.bld.length} · roads ${SITE.vec.road.length} · trails ${SITE.vec.trail.length} · streams ${SITE.vec.stream.length} · fields ${SITE.vec.field.length}` : '');
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
  $('demMsg').textContent = `DEM coverage of the high-res area ${Math.round(inC / tot * 100)}%` + (inC / tot < 0.98 ? ' — gaps are filled from neighbours' : '');
}
async function demOpen(file) {
  $('demPanel').classList.remove('hidden'); $('demMeta').textContent = 'Reading… ' + file.name; $('demMsg').textContent = '';
  try {
    const R = await readDem(file, null); DEMUI.R = R; DEMUI.file = file; demMeta();
    DEMUI.pv = demPreview(R, 560);
    $('demLat').value = R.ll[1].toFixed(5); $('demLon').value = R.ll[0].toFixed(5); $('demName').value = file.name.replace(/\.[^.]+$/, '');
    demDraw();
  } catch (err) { $('demMeta').textContent = 'Failed: ' + (err && err.message ? err.message : err); }
}
function demMeta() {
  const R = DEMUI.R, sel = $('demCrs'); sel.innerHTML = '';
  for (const c of Object.keys(CRS_LABEL)) { const o = document.createElement('option'); o.value = c; o.textContent = CRS_LABEL[c]; sel.appendChild(o); }
  if (!CRS_LABEL[R.crs]) { const o = document.createElement('option'); o.value = R.crs; o.textContent = R.crs; sel.appendChild(o); }
  sel.value = R.crs;
  $('demMeta').innerHTML = `<b>${R.name}</b><br>${R.w} × ${R.h} grid · resolution ${R.res.toFixed(1)} m<br>CRS ${CRS_LABEL[R.crs] || R.crs} <span style="color:var(--mute)">(${R.crsSrc})</span><br>Elevation ${R.min.toFixed(0)} ~ ${R.max.toFixed(0)} m`;
}
$('demCrs').onchange = async () => { if (!DEMUI.file) return; try { DEMUI.R = await readDem(DEMUI.file, $('demCrs').value); demMeta(); DEMUI.pv = demPreview(DEMUI.R, 560); $('demLat').value = DEMUI.R.ll[1].toFixed(5); $('demLon').value = DEMUI.R.ll[0].toFixed(5); demDraw(); } catch (err) { $('demMsg').textContent = 'Failed: ' + err.message; } };
$('demCv').addEventListener('click', e => {
  if (!DEMUI.pv) return; const r = $('demCv').getBoundingClientRect(), k = DEMUI.pv.W / r.width;
  const ll = DEMUI.pv.px2ll((e.clientX - r.left) * k, (e.clientY - r.top) * k); $('demLat').value = ll[1].toFixed(5); $('demLon').value = ll[0].toFixed(5); demDraw();
});
$('demBrg').oninput = () => { $('demBrgV').textContent = $('demBrg').value + '°'; demDraw(); };
$('demLat').oninput = $('demLon').oninput = demDraw;
$('demClose').onclick = () => $('demPanel').classList.add('hidden');
$('demApply').onclick = async () => {
  if (!DEMUI.R) return; $('demMsg').textContent = 'Building terrain…'; await new Promise(r => setTimeout(r, 30));
  try {
    const pkg = buildTerrainPkg(DEMUI.R, { lat: +$('demLat').value, lon: +$('demLon').value, brg: +$('demBrg').value, name: ($('demName').value || 'DEM') + ' (my DEM)', id: 'custom' });
    localStorage.setItem('fpvsim_site_custom', JSON.stringify(pkg)); siteSelect('custom');
    $('demMsg').textContent = 'Done — reloading'; setTimeout(() => location.reload(), 300);
  } catch (err) { $('demMsg').textContent = 'Failed: ' + (err && err.message ? err.message : err); }
};

// =====================================================================
//  Controller setup (RC 송신기 / 게임패드)
// =====================================================================
const FN = { thr: 'Throttle (climb·descend)', yaw: 'Yaw (turn)', pitch: 'Pitch (forward·back)', roll: 'Roll (strafe)' };
const BFN = { drop: 'Drop', cam: 'Switch camera', reset: 'Restart' };
let detect = null, calRun = null;
function rcOpen() { RCUI.open = true; $('rcPanel').classList.remove('hidden'); rcBuild(); }
function rcClose() { RCUI.open = false; detect = null; calRun = null; $('rcPanel').classList.add('hidden'); saveRC(); }
function axName(a) { return `Axis ${a.i}${a.inv ? ' (inverted)' : ''}`; }
function bName(b) { return !b ? 'None' : b.type === 'btn' ? `Button ${b.i}` : `Axis ${b.i} ${b.sign > 0 ? '+' : '−'}`; }
function rcBuild() {
  let h = '';
  for (const k in FN) h += `<tr><td>${FN[k]}</td><td class="mono" id="rcA_${k}">${axName(RC.axes[k])}</td><td><div class="bar"><i id="rcV_${k}"></i></div></td><td><button data-det="${k}">Detect</button> <button data-inv="${k}">Invert</button></td></tr>`;
  for (const k in BFN) h += `<tr><td>${BFN[k]}</td><td class="mono" id="rcB_${k}">${bName(RC.btn[k])}</td><td></td><td><button data-detb="${k}">Detect</button></td></tr>`;
  $('rcTable').innerHTML = h;
  $('rcTable').querySelectorAll('[data-det]').forEach(b => b.onclick = () => { detect = { kind: 'axis', fn: b.dataset.det, base: null }; $('rcHint').textContent = `${FN[b.dataset.det]}: push that stick fully up (or right), then release.`; });
  $('rcTable').querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { RC.axes[b.dataset.inv].inv = !RC.axes[b.dataset.inv].inv; rcBuild(); });
  $('rcTable').querySelectorAll('[data-detb]').forEach(b => b.onclick = () => { detect = { kind: 'btn', fn: b.dataset.detb, base: null }; $('rcHint').textContent = `${BFN[b.dataset.detb]}: press (or flip) the button or switch you want to use.`; });
  document.querySelectorAll('#rcThr button').forEach(b => b.classList.toggle('on', b.dataset.v === RC.thrType));
}
function rcPanelUpdate() {
  const gp = getPad();
  $('rcDev').textContent = gp ? `Connected: ${gp.id} (${gp.axes.length} axes, ${gp.buttons.length} buttons)` : 'No controller detected. Connect it via USB, then move a stick or press a button once.';
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
        $('rcHint').textContent = `${FN[detect.fn]} → axis ${best}${!pos ? ' (inverted)' : ''} assigned`; detect = null; rcBuild();
      }
    } else {
      const bi = gp.buttons.findIndex((b, i) => b.pressed && !detect.base.btn[i]);
      if (bi >= 0) { RC.btn[detect.fn] = { type: 'btn', i: bi }; $('rcHint').textContent = `${BFN[detect.fn]} → button ${bi}`; detect = null; rcBuild(); return; }
      const used = Object.values(RC.axes).map(a => a.i);
      gp.axes.forEach((v, i) => {
        if (!detect || used.includes(i)) return;
        const d = v - detect.base.axes[i];
        if (Math.abs(d) > 0.9) { RC.btn[detect.fn] = { type: 'axis', i, sign: d > 0 ? 1 : -1 }; $('rcHint').textContent = `${BFN[detect.fn]} → axis ${i} switch`; detect = null; rcBuild(); }
      });
    }
  }
}
function rcWire() {
  $('bRC').onclick = rcOpen; $('rcClose').onclick = rcClose;
  $('rcCenter').onclick = () => { const gp = getPad(); if (!gp) return; gp.axes.forEach((v, i) => { const c = RC.cal[i] || { min: -1, max: 1 }; c.c = v; RC.cal[i] = c; }); $('rcHint').textContent = 'Current stick positions saved as center (for a non-centering throttle, put the throttle in the middle before pressing).'; };
  $('rcRange').onclick = () => {
    const gp = getPad(); if (!gp) return;
    if (!calRun) { calRun = {}; $('rcRange').textContent = 'Finish range calibration'; $('rcHint').textContent = 'Move every stick around its full range in big circles, then press [Finish range calibration].'; }
    else { for (const i in calRun) { const c = RC.cal[i] || {}; c.min = calRun[i].min; c.max = calRun[i].max; if (c.c === undefined) c.c = (c.min + c.max) / 2; RC.cal[i] = c; } calRun = null; $('rcRange').textContent = 'Start range calibration'; $('rcHint').textContent = 'Range saved.'; }
  };
  $('rcReset').onclick = () => { RC = JSON.parse(JSON.stringify(RC_DEFAULT)); rcBuild(); $('rcHint').textContent = 'Reset to defaults (gamepad, Mode 2).'; };
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
    return `<tr><td>${MODES[d].name}</td><td class="mono">${b ? fmt(b) : '—'}</td><td>${BEST[d] ? `<button data-rp="${d}">Replay</button>` : ''}</td></tr>`;
  }).join('');
  $('recTable').innerHTML = `<tr><td style="color:var(--mute)">Difficulty</td><td style="color:var(--mute)">Best (with penalties)</td><td></td></tr>` + rows + `<tr><td>Reference</td><td class="mono">${fmt(GH.total)}</td><td style="color:var(--mute);font-size:12px">video path</td></tr>`;
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
// ---- Key setup 화면 ----
const KB_LABEL = { up: 'Climb', down: 'Descend', yawL: 'Turn left', yawR: 'Turn right', fwd: 'Forward', back: 'Back', left: 'Strafe left', right: 'Strafe right', drop: 'Drop payload', boost: 'Boost (hold)', cam: 'Switch camera', zoom: 'Camera distance', reset: 'Restart from last checkpoint', assist: 'Flight assist on/off' };
function kbOpen() { $('kbPanel').classList.remove('hidden'); KBCAP = null; $('kbHint').textContent = ''; kbRender(); }
function kbRender() {
  $('kbTable').innerHTML = Object.keys(KB_LABEL).map(k => `<tr><td>${KB_LABEL[k]}</td><td><button data-kb="${k}" class="${KBCAP === k ? 'cap' : ''}">${KBCAP === k ? '…' : keyName(KB[k])}</button></td></tr>`).join('');
  $('kbTable').querySelectorAll('[data-kb]').forEach(b => b.onclick = () => { KBCAP = b.dataset.kb; $('kbHint').textContent = KB_LABEL[KBCAP] + ': press the key to use'; kbRender(); });
}
function kbCapture(code) {
  const act = KBCAP; KBCAP = null;
  if (code === 'Escape') { $('kbHint').textContent = ''; kbRender(); return; }
  if (KB_RESERVED.includes(code)) { $('kbHint').textContent = keyName(code) + ' is reserved for another function and cannot be assigned'; kbRender(); return; }
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
  $('kbRows').innerHTML = pair('up', 'down', 'Climb / descend') + pair('yawL', 'yawR', 'Yaw left / right') + pair('fwd', 'back', 'Forward / back') + pair('left', 'right', 'Strafe left / right') +
    one('drop', 'Drop payload') + one('boost', 'Boost on/off (anywhere, airframe top speed)') + pair('cam', 'zoom', 'Switch camera · camera distance') + one('reset', 'Restart from last checkpoint') + one('assist', 'Flight assist on/off');
  $('keys').innerHTML = `${n(KB.up)}/${n(KB.down)} ${'climb·descend'} &nbsp;${n(KB.yawL)}/${n(KB.yawR)} ${'yaw'} &nbsp;${n(KB.fwd)}${n(KB.left)}${n(KB.back)}${n(KB.right)} ${'move'}<br>${n(KB.drop)} ${'Drop'} &nbsp;${n(KB.boost)} ${'Boost'} &nbsp;${n(KB.cam)} ${'Camera'} &nbsp;${n(KB.assist)} ${'assist'} &nbsp;B ${'music'} &nbsp;Esc ${'Pause'}`;
}
$('kbA').onclick = () => { KB = Object.assign({}, KB_PRESET.A); saveKB(); kbRender(); syncSeg(); $('kbHint').textContent = 'A · Default'; };
$('kbB').onclick = () => { KB = Object.assign({}, KB_PRESET.B); saveKB(); kbRender(); syncSeg(); $('kbHint').textContent = 'B · Arrows for altitude'; };
$('kbClose').onclick = () => { KBCAP = null; $('kbPanel').classList.add('hidden'); syncSeg(); };
// ---- KEYBOARD 그림 ----
const KB_SHORT = { up: 'Climb', down: 'Descend', yawL: 'Yaw L', yawR: 'Yaw R', fwd: 'Forward', back: 'Back', left: 'Left', right: 'Right', drop: 'Drop', boost: 'Boost', cam: 'Camera', zoom: 'Zoom', reset: 'Restart', assist: 'assist' };
const KB_GROUP = { up: 'alt', down: 'alt', yawL: 'alt', yawR: 'alt', fwd: 'mov', back: 'mov', left: 'mov', right: 'mov', boost: 'bst' };
const KB_FIXED = { KeyF: 'Full', KeyV: 'Guide', KeyX: 'Belly', KeyB: 'music', KeyN: 'Skip', KeyT: 'Thermal', KeyM: 'SOUND', KeyL: 'Light', KeyP: 'Path', Escape: 'Pause' };
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
    `<div class="legend"><div><i style="background:#ffc828"></i>Altitude·yaw (left stick on a transmitter)</div><div><i style="background:#4fe3ff"></i>Movement (right stick)</div><div><i style="background:#5dff9a"></i>Functions</div><div><i style="background:#ff9a40"></i>Boost</div></div>`;
}
$('bKB2').onclick = kbOpen;
document.querySelectorAll('#segGhostSrc button').forEach(b => b.addEventListener('click', () => { SET.ghostSrc = b.dataset.v; saveSet(); syncSeg(); }));
document.querySelectorAll('#segGuide button').forEach(b => b.addEventListener('click', () => { SET.guide = b.dataset.v === '1'; saveSet(); syncSeg(); }));
$('bAgain').onclick = () => startRun(S.lastKind || S.kind);
$('bOrtho').onclick = () => $('orthoFile').click();
$('orthoFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { await loadOrthoFile(f); } catch (err) { setOrthoStatus('Failed: ' + (err && err.message ? err.message : err), '#ff6060'); }
  e.target.value = '';
});
$('bDem').onclick = () => $('demFile').click();
$('demFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) { window.__lastDemFile = f; demOpen(f); } e.target.value = ''; });
$('bOrthoReset').onclick = () => { resetGround(); IDB.del('ortho' + SITE_KEY0); setOrthoStatus('Using default ground', ''); };
function refreshBest() {
  $('bLastRp').disabled = !LAST_REC;
  let b = null; try { b = parseFloat(localStorage.getItem('fpvsim_fpv_best_' + SET.diff)); } catch (e) { }
  ui.best.textContent = b ? `Best (${MODES[SET.diff].name}): ${fmt(b)} · reference flight ${fmt(GH.total)}` : `Reference flight (video path): ${fmt(GH.total)}`;
}
loadBest(); rcWire(); syncSeg(); refreshBest(); restoreOrtho(); siteUI();
setInterval(() => { const gp = getPad(); const el = $('padStatus'); if (el) el.textContent = gp ? '🎮 ' + gp.id.replace(/\(.*?\)/g, '').slice(0, 48) + (gp.mapping === 'standard' ? ' · standard mapping' : '') : ''; }, 1000);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
resetDrone(startPos(), startHead());
if (!TEST) requestAnimationFrame(frame);
let fakeNow = 0;
function advance(sec, step, skipRender) { step = step || 1 / 60; const n = Math.max(1, Math.round(sec / step)); if (!fakeNow) fakeNow = last; for (let i = 0; i < n; i++) { fakeNow += step * 1000; frame(fakeNow, skipRender || i < n - 1); } }

// 시험용 핸들
window.__sim = { STREES, groundAt, SET, advance, S, DR, IN, OBJS, OBJ, GH, startRun, keys, pressed, collide, setPose(p, v, h) { DR.p.copy(p); DR.v.copy(v); DR.h = h; DR.landed = false; }, W, camera, renderer, scene, SET, loadOrthoFile, course2utm, MODES, predictImpact, tutStart, LESSONS, replayStart, RP, get LAST_REC() { return LAST_REC; }, BEST, readDem, buildTerrainPkg, TER, SITE, EARTH, terrainAt, groundAt, agl,  music: () => ({ timer: !!MUS.timer, step: MUS.step, on: MUS.on, style: SONG.style, sec: SECTIONS[SONG.sec].n, bar: SONG.bar, prog: SONG.prog && SONG.prog.map(c => c[0]).join(","), motif: SONG.motif && SONG.motif.join(" ") }) };
// =====================================================================
//  기체 종류 · 새 임무 (숲길 통과 · 타임 레이스 · 정찰 · 타격)
//  속도·크기는 공개 제원 수준의 근사값 (기체 Name은 형상 참고용)
// =====================================================================
const AF = {
  x2d: { tag: 'X2D', name: 'Skydio X2D', sub: 'Recon quad · 66 cm · 1.3 kg', cls: 'quad', top: 13.9, vmax: { train: 9, easy: 12, sport: 13.9 }, tilt: { train: 25, easy: 32, sport: 38 }, climb: 6, sink: 4, yaw: 120, tw: 1.15, R: 0.24, endur: 35, drop: true,
    note: 'Stabilized · hover · drop rig' },
  anafi: { tag: 'ANAFI', name: 'Parrot ANAFI USA', sub: 'Compact recon quad · 37 cm · 0.5 kg', cls: 'quad', top: 14.7, vmax: { train: 9, easy: 12, sport: 14.7 }, tilt: { train: 25, easy: 32, sport: 40 }, climb: 4, sink: 4, yaw: 140, tw: 1.15, R: 0.17, endur: 32, reconD: 520,
    note: '32× zoom · long-range recon · IP53' },
  fpv: { tag: 'FPV', name: 'FPV racer', sub: '5-inch · 0.65 kg', cls: 'quad', top: 39, vmax: { train: 12, easy: 24, sport: 39 }, tilt: { train: 30, easy: 50, sport: 72 }, climb: 15, sink: 9, yaw: 320, tw: 3.5, R: 0.13, endur: 5, acro: true,
    note: 'Very fast · Acro option in Sport' },
  fw: { tag: 'RAVEN', name: 'RQ-11B Raven', sub: 'Fixed-wing recon · hand-launched · 1.37 m span · 2.1 kg', cls: 'wing', cruise: 13, top: 22.6, stall: 8.7, span: 1.37, R: 0.45, endur: '60~90', bank: 50, nmax: 1.8, minAgl: 26, prate: 70, rrate: 160,
    note: 'Cannot hover · turns by banking · watch the stall' },
  puma: { tag: 'PUMA', name: 'RQ-20B Puma', sub: 'Fixed-wing recon · 2.8 m span · 6.1 kg', cls: 'wing', cruise: 14, top: 23, stall: 10.3, span: 2.8, R: 0.9, endur: 210, bank: 45, nmax: 1.6, minAgl: 30, prate: 50, rrate: 90, reconD: 600,
    note: '3.5 h endurance · stable big wing · wide turns' },
  kfpv: { tag: 'K-FPV', name: 'Kamikaze FPV', sub: '7-inch · dummy warhead · 1.6 kg', cls: 'quad', top: 30, vmax: { train: 12, easy: 20, sport: 30 }, tilt: { train: 30, easy: 45, sport: 65 }, climb: 10, sink: 8, yaw: 240, tw: 2.2, R: 0.17, endur: 8, acro: true, kam: true,
    note: 'Detonates on contact · flies straight into the target' },
  kfw: { tag: 'K-FW', name: 'Loitering fixed-wing', sub: 'Loitering type · 0.7 m span', cls: 'wing', cruise: 26, top: 44, stall: 15, span: 0.7, R: 0.3, endur: 15, bank: 60, nmax: 2.6, minAgl: 10, prate: 90, rrate: 220, kam: true,
    note: 'Air-launched · dives onto the target' }
};
const AF_IDS = Object.keys(AF);
AF_IDS.forEach(k => AF[k].id = k);
const MS_OK = { course: ['x2d'], forest: ['x2d', 'anafi', 'fpv', 'kfpv'], race: ['x2d', 'anafi', 'fpv', 'fw', 'puma', 'kfw'], recon: ['x2d', 'anafi', 'fw', 'puma'], fire: ['x2d', 'anafi', 'fw', 'puma'], sar: ['x2d', 'anafi', 'fw', 'puma'], track: ['x2d', 'anafi', 'fw', 'puma'], ridge: ['x2d', 'anafi', 'fpv', 'fw', 'puma'], strike: ['kfpv', 'kfw'], free: AF_IDS, tutorial: ['x2d'], demo: ['x2d'] };
if (!AF[SET.af]) SET.af = 'x2d';
const MS_NAME = { forest: 'Forest trail', race: 'Time race', recon: 'Recon', strike: 'Strike', fire: 'Wildfire watch', sar: 'Search & rescue', track: 'Vehicle tracking', ridge: 'Ridge run' };
function AFc() { return AF[SET.af] || AF.x2d; }
function isMission(k) { k = k || S.kind; return k === 'forest' || k === 'race' || k === 'recon' || k === 'strike' || k === 'fire' || k === 'sar' || k === 'track' || k === 'ridge' || k === 'field'; }
MS_OK.field = ['x2d', 'anafi', 'fpv', 'fw', 'puma']; MS_NAME.field = window.SIM_LANG === 'en' ? 'Field airstrip' : '야전 착륙장';
// Difficulty + 기체 -> FLIGHT 특성
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
  K.add(UBOX, K.m(mat(0x111111, { roughness: 0.3 })), 0, 0.02, -0.06 * S7, 0.03, 0.03, 0.025);             // Camera
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
    K.add(USPH, K.m(mat(0x1b1d1f, { roughness: 0.2 })), 0, -0.035, -0.3, 0.03, 0.025, 0.03);   // 아래 Camera
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
  if (id === 'anafi') {   // X2D 형상을 줄이고 Drop 장치·안테나는 뗌
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

// ---------------- 고정익 FLIGHT ----------------
function camK() { const a = AFc(); return a.cls === 'wing' ? 2.4 : a.id === 'anafi' || a.id === 'fpv' ? 0.85 : 1; }
function wingAir(p, h) {   // 공중에서 시작 (손 투척·발사 직후)
  const a = AFc(); DR.p.copy(p); DR.p.y = Math.max(DR.p.y, groundAt(p.x, p.z) + 25); DR.h = h; DR.as = a.cruise; DR.pitch = 0; DR.roll = 0; DR.landed = false; DR.alive = true; DR.gnd = false; DR.liftT = -99;
  DR.v.set(Math.sin(h) * a.cruise, 0, -Math.cos(h) * a.cruise); DR.altT = DR.p.y;
}
const WARN = { t: 0 };
function stepWing(dt) {
  // 조종 단계: Training·Easy = 자동조종(고도·속도 유지, 지형 피, 실속 보호) · ATTI = 자세 안정 수동(스로틀 직접, 실속 가능) · Sport = 완전 수동(기울기 유지, 실속·스핀)
  const a = AFc(), assist = SET.assist && (SET.diff === 'train' || SET.diff === 'easy'), rate = SET.diff === 'sport';
  if (DR.gnd) return wingRoll(dt, a);
  const appr = rwyApproach();
  const stun = S.stun > 0 ? 0.3 : 1; if (S.stun > 0) S.stun -= dt;
  let ip = IN.pitch * stun, ir = IN.roll * stun; const iy = IN.yaw * stun;
  let V = DR.as || a.cruise;
  // 실속 속도는 하중 배수의 제곱근에 비례: 기울여 선하면 더 빠른 속도에서 실속 (60° 기울기 = 1.41배)
  const n0 = 1 / Math.max(0.2, Math.cos(DR.roll)), vsE = a.stall * Math.sqrt(Math.min(n0, a.nmax * 1.4));
  const stall = DR.stalled ? V < vsE * 1.06 : V < vsE, warn = !stall && V < vsE * 1.15;
  if (stall && !DR.stalled && !assist) { DR.wdrop = (Math.random() < 0.5 ? -1 : 1); DR.roll += DR.wdrop * (14 + Math.random() * 16) * DEG; }   // 실속 순간 한쪽 날개가 떨어짐
  DR.stalled = stall;
  if (stall) ir *= 0.35;   // 실속: assist익이 잘 안 먹음
  WARN.t -= dt; if ((warn || stall) && WARN.t <= 0) { WARN.t = stall ? 0.45 : 0.8; sfx('bad'); if (typeof rumble === 'function') rumble(stall ? 0.6 : 0.25, 0.4, 120); }
  S.stallWarn = warn;
  if (stall || warn) shake = Math.max(shake, stall ? 0.05 : 0.018);   // 버핏(떨림)
  if (assist) {
    // altitude hold: 스틱 놓으면 그 고도, 땅이 가까우면 자동 Climb
    if (Math.abs(ip) > 0.05) DR.altT = DR.p.y;
    const ahead = Math.max(terrainAt(DR.p.x, DR.p.z), terrainAt(DR.p.x + DR.v.x * 2.5, DR.p.z + DR.v.z * 2.5), terrainAt(DR.p.x + DR.v.x * 5, DR.p.z + DR.v.z * 5));
    let gt = Math.abs(ip) > 0.05 ? -ip * 28 * DEG : clamp((DR.altT - DR.p.y) * 0.06, -0.3, 0.3);
    if (appr && DR.p.y - groundAt(DR.p.x, DR.p.z) < 4) gt = Math.max(gt, -Math.asin(Math.min(1, 0.7 / Math.max(V, 6))));   // 플레어: 바닥 가까이선 초당 0.7 m 로만 내려앉게   // 접근: 바닥 가까이서 살짝 기수 들기 (플레어)
    if (DR.p.y - ahead < a.minAgl && !a.kam && !appr) { gt = Math.max(gt, 0.25 + (a.minAgl - (DR.p.y - ahead)) * 0.03); DR.altT = Math.max(DR.altT, ahead + a.minAgl); }
    // 실속 보호: 속도가 실속 속도 가까이 떨어지면 Climb각을 줄임
    const mg = (V - vsE * 1.12) / (a.stall * 0.35); if (mg < 1) gt = Math.min(gt, Math.max(-0.15, mg) * 28 * DEG);
    DR.pitch += (gt - DR.pitch) * (1 - Math.exp(-dt * 2.2));
    // 기울기 한계: Training 35° · 느릴 때는 실속하지 않을 만큼만 (V ≥ 1.15·Vs·√n)
    const bMax = Math.min(SET.diff === 'train' ? 35 * DEG : a.bank * DEG, V > a.stall * 1.15 ? Math.acos(Math.min(1, Math.pow(a.stall * 1.15 / V, 2))) : 0);
    DR.roll += (ir * bMax - DR.roll) * (1 - Math.exp(-dt * 2.8));
    S.boosting = !!IN.boost;
    const vt = IN.boost ? a.top : IN.thr >= 0 ? a.cruise + IN.thr * (a.top - a.cruise) : a.cruise + IN.thr * (a.cruise - a.stall - 2);
    V += clamp(vt - V, -4, 4) * dt * 0.9;
  } else if (rate) {
    // 완전 수동: 스틱 = yaw 속도. 놓으면 그 자세 그대로 (수평 복귀 None) · 실속에서 기수를 Resume 당기면 스핀
    DR.roll = clamp(DR.roll + ir * a.rrate * DEG * dt, -85 * DEG, 85 * DEG); DR.pitch = clamp(DR.pitch - ip * a.prate * 0.8 * DEG * dt, -70 * DEG, 60 * DEG);
    if (stall && ip < -0.3) { DR.roll = clamp(DR.roll + (DR.wdrop || 1) * 110 * DEG * dt, -85 * DEG, 85 * DEG); DR.h += (DR.wdrop || 1) * 1.6 * dt; }
    S.boosting = !!IN.boost;
    const thr = IN.boost ? 1 : clamp(0.55 + IN.thr * 0.45, 0, 1), thrust = thr * a.top * 0.42, drag = 0.42 * a.top * (V / a.top) * (V / a.top);
    V += (thrust - drag) * dt;
  } else {
    // 자세 안정 수동(ATTI): 스틱 = 기울기·Climb각, 놓으면 수평으로 돌아옴 (altitude hold·지면 피·실속 보호 None)
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
  if (stall) { DR.pitch -= (1.3 + (vsE - V) * 0.25) * dt; DR.pitch = Math.max(DR.pitch, -55 * DEG); }   // 실속: 기수가 떨어지며 속도를 되찾아야 복
  V = clamp(V, 3, a.kam ? a.top * 1.12 : a.top * 1.18); DR.as = V;
  // 선: 하중 배수 한계 (nmax) 안에서만 돌고, 넘게 기울이면 양력이 모자라 기수가 내려감
  const nreq = 1 / Math.max(0.05, Math.cos(DR.roll)), nl = Math.min(nreq, a.nmax);
  DR.h += Math.sign(DR.roll) * G * Math.sqrt(Math.max(0, nl * nl - 1)) / Math.max(V, 6) * dt + iy * 0.35 * dt;
  if (nreq > a.nmax) DR.pitch -= (1 - nl * Math.cos(DR.roll)) * G / Math.max(V, 6) * dt;
  V -= (nl - 1) * 1.1 * dt;
  // FLIGHT 구역 밖이면 자동 선
  const rx = DR.p.x, rz = DR.p.z + 150, l = Math.hypot(rx, rz);
  if (l > FLY_R + 30) { const dh = wrapA(Math.atan2(-rx, rz) - DR.h); DR.h += clamp(dh, -1, 1) * 0.6 * dt; if (S.msgCD <= 0) { showMsg('AREA LIMIT · turning', '#ff9a40', 1); S.msgCD = 2; } }
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
    // Takeoff 방향: FLIGHT 구역 가운데 쪽으로
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
// 활주로가 생기기 전에 그려 둔 코스 지도에 Restart 그려 넣음
if (RWY && typeof MAP_CACHE !== 'undefined' && MAP_CACHE.course) { try { const kb = mapBg, kv = MAPV; mapBg = MAP_CACHE.course; MAPV = MAP_CACHE.course.V || MAPV_COURSE || MAPV; drawMapBg(); mapBg = kb; MAPV = kv; } catch (e) { } }
// 고정익 Free Flight: 코스 지도에 활주로까지 들어오게
function rwyMapView() { if (!RWY) return; const V = MAP_CACHE.course && MAP_CACHE.course.V || MAPV, A = RWY.at(-RWY.L / 2 - 60, 0), B = RWY.at(RWY.L / 2, 0); mapView('free_wing', [[V.d0 + 40, V.s0 + 40], [V.d1 - 40, V.s1 - 40], [-A.z, A.x, 10], [-B.z, B.x, 10]]); }
function rwyLocal(p) { const dx = p.x - RWY.cx, dz = p.z - RWY.cz; return { t: dx * RWY.ux + dz * RWY.uz, w: -dx * RWY.uz + dz * RWY.ux }; }
function wingRwyOK(a) { return !!RWY && a && a.cls === 'wing' && !a.kam; }
function wingGround() {   // 활주로 시단에서 Pause 상태로 시작
  const a = AFc(), p = RWY.at(-RWY.L / 2 + 8, 0); p.y = groundAt(p.x, p.z) + 0.25;
  DR.p.copy(p); DR.h = RWY.h; DR.as = 0; DR.v.set(0, 0, 0); DR.pitch = 0; DR.roll = 0; DR.alive = true; DR.gnd = true; DR.landed = true; DR.altT = p.y + 35; DR.liftT = -99;
  showMsg(L2('활주로 · 스로틀 올려 Takeoff (속도 붙으면 기수 들기)', 'RUNWAY · throttle up, rotate at speed'), '#ffc828', 3);
}
// 지상 활주: 스로틀 = 가속, 스로틀 내림 = 브레이크, yaw·좌우 = 앞바퀴 조향 · Takeoff 속도에서 기수를 들면(assist On: 스로틀만으로) Takeoff
function wingRoll(dt, a) {
  const thrUp = IN.boost || IN.thr > 0.15, brake = IN.thr < -0.15; let V = DR.as || 0;
  const autoBrk = SET.assist && SET.diff !== 'sport';   // assist On: 스로틀을 안 올리면 자동 제동
  V = Math.max(0, V + (thrUp ? (IN.boost ? 4.5 : 3.2) : brake ? -5 : autoBrk ? -3 : -0.6) * dt);
  if (V > 0.5) DR.h += (IN.yaw * 0.6 + IN.roll * 0.35) * dt;
  const fx = Math.sin(DR.h), fz = -Math.cos(DR.h), w = windAt(DR.p);
  DR.p.x += fx * V * dt; DR.p.z += fz * V * dt; DR.p.y = groundAt(DR.p.x, DR.p.z) + 0.25;
  DR.pitch = 0; DR.roll = 0; DR.as = V; DR.v.set(fx * V, 0, fz * V); DR.thrust = thrUp ? 1 : 0.25; S.stallW = false; S.boosting = !!IN.boost; DR.landed = V < 0.3;
  const vr = a.stall * 1.15;
  if (V >= vr && (IN.pitch < -0.25 || (SET.assist && SET.diff !== 'sport' && thrUp))) {
    DR.gnd = false; DR.landed = false; DR.pitch = 9 * DEG; DR.altT = DR.p.y + 35; DR.liftT = S.simT; showMsg(L2('Takeoff', 'LIFT OFF'), '#5dff9a', 1.2); sfx('chime'); return;
  }
  const l = rwyLocal(DR.p); if ((Math.abs(l.w) > RWY.Wd / 2 + 5 || Math.abs(l.t) > RWY.L / 2 + 60) && V > 6) return lostDrone('GROUND');   // 활주로를 벗어나 빠르게 굴러가면 사고
  const hit = collide(DR.p, DR.R); if (hit && V > 3) return lostDrone(hit.tag);
}
// 접근 중인가: 활주로 연장선 위(옆 30 m + Zoom비례), 끝을 아직 안 지남, 방향이 맞음, Takeoff 직후 아님
function rwyApproach() {
  if (!RWY || S.simT - (DR.liftT ?? -99) < 12) return false;
  const l = rwyLocal(DR.p), dir = Math.cos(DR.h - RWY.h) >= 0 ? 1 : -1, tt = l.t * dir;
  return Math.abs(wrapA(DR.h - RWY.h - (dir < 0 ? Math.PI : 0))) < 30 * DEG && tt < RWY.L / 2 && tt > -RWY.L / 2 - 450 && Math.abs(l.w) < 30 + Math.max(0, -tt - RWY.L / 2) * 0.15;
}
// 활주로 착륙 목표 (고정익 임무 마지막)
function rtbObj(a) {
  if (wingRwyOK(a)) { const td = RWY.at(-RWY.L / 2 + 20, 0), ap = RWY.at(-RWY.L / 2 - 300, 0); td.y = groundAt(td.x, td.z) + 1; ap.y = groundAt(ap.x, ap.z) + 35;
    return { kind: 'ms', t: 'rwyland', label: L2('복귀 · 활주로 착륙', 'Return · land on the runway'), mk: td.clone().setY(td.y + 4), pts(p) { return [p.clone(), ap.clone(), td.clone()]; } }; }
  if (a.cls === 'wing') return passCP('Return · pass over the start point', { d: BY.pad_start.down, s: BY.pad_start.side, td: 1, ts: 0 }, 0, 35, 35, 14);
  return { kind: 'ms', t: 'land', label: 'Return to the start pad · land', mk: startPos().add(new V3(0, 1.5, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } };
}
// 기체 잃음: 추락 / 자폭 기폭
function lostDrone(why) {
  if (!DR.alive) return;
  const a = AFc();
  if (a.kam && S.kind === 'strike') { if (strikeDetonate()) return; }
  DR.alive = false; S.deadT = 1.6; S.impacts++; S.lost = (S.lost || 0) + 1;
  spawnImpact(DR.p.clone(), true); sfx('crash'); rumble(1, 0.8, 300); shake = 0.15;
  if (S.kind === 'strike') showMsg(why === 'stk' ? 'HIT' : 'MISS · drone lost', '#ff6060', 1.6);
  else { showMsg(a.kam ? 'DETONATED · drone lost' : 'CRASH · drone lost', '#ff5050', 1.6); if (S.kind === 'race' || S.kind === 'forest' || S.kind === 'recon') S.pen += 10; }
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
// 코스 경로 위 Zoom s 의 점 (down, side, 방향)
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
    L.push({ kind: 'ms', t: 'strike', label: `Target ${i + 1} · vehicle`, g, col, parts: g.children.filter(x => x.isMesh), c: c.clone().add(new V3(0, 1.4, 0)), mk: c.clone().add(new V3(0, 5, 0)), hull,
      pts(p) { return [p.clone(), this.c.clone()]; } });
  });
  return L;
})();
function msObj() { return MS.list[MS.idx] || null; }
// 임무 지도 범위: 그 임무에서 나올 수 있는 사건·구역 전부 + 출발점 ([down, side, 반지름])
function missionMapPts(kind, run) {   // run: 이번 FLIGHT에 정해진 위치만 (산불·수색·정찰·추적은 매번 다름)
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
  if (wingRwyOK(a) && ['recon', 'fire', 'ridge'].includes(kind)) L = L.concat([rtbObj(a)]);   // 고정익: 임무 끝에 활주로 착륙
  L.forEach(o => { o.done = false; o.miss = false; }); S.msNear = null; MS.list = L; MS.kind = kind; MS.t0 = 0; MS.events = []; S.decoyHit = 0;
  // 시작 위치: 고정익·Loitering fixed-wing은 공중에서
  const p0 = kind === 'field' && RWY && a.cls !== 'wing' ? RWY.pads[0].clone().setY(RWY.pads[0].y + 0.06) : startPos(), o = msObj(); let h = startHead();
  if (o) { const d = o.mk.clone().sub(p0); h = Math.atan2(d.x, -d.z); }
  if (wingRwyOK(a) && kind !== 'strike') wingGround(); else if (a.cls === 'wing') { p0.y = groundAt(p0.x, p0.z) + (a.kam ? 45 : 30); wingAir(p0, h); } else resetDrone(p0, h);
  MS.launch = { p: DR.p.clone(), h: DR.gnd ? DR.h : h };
  S.respawn = null;
  if (ENV.ir) { irSet(false); irSet(true); }   // 바뀐 열 세기 반영
  MS.par = msPar(kind, L); briefShow(kind, L);
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
        MS.idx = j; comm(`${CS}, CONTROL. You missed a checkpoint. Press on.`, `${missed.join(', ')} 실패 · Resume 진행`);
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
    if (r === true) msNext(); else if (r === false && S.bumpT <= 0) { showMsg(L2('MISS · pass again', 'MISS · fly through again'), '#ff9a40', 1); sfx('bad'); S.bumpT = 0.6; }
  } else if (o.t === 'padland') {
    const e = Math.hypot(DR.p.x - o.pad.x, DR.p.z - o.pad.z);
    if (DR.landed && DR.v.length() < 0.6) { if (e <= 1.5) { (S.padErr = S.padErr || []).push(e); msNext(L2(`착륙 ✓ 오차 ${e.toFixed(2)} m`, `Landed ✓ ${e.toFixed(2)} m off`), '#5dff9a'); } else if (e < 6 && S.bumpT <= 0) { showMsg(L2(`패드 밖 ${e.toFixed(1)} m · Restart 떠서 가운데로`, `Off the pad ${e.toFixed(1)} m · lift and recentre`), '#ff9a40', 1.4); S.bumpT = 1.5; } }
  } else if (o.t === 'rwyland') { if (DR.gnd && (DR.as || 0) < 2) msNext(L2('활주로 착륙 ✓', 'Landed on the runway ✓'), '#5dff9a'); }
  else if (o.t === 'fire') fireStep(cur, dt);
  else if (o.t === 'strikeAll') strikeAim(o, cur);
  else if (o.t === 'sarfind' || o.t === 'land' || o.t === 'track') scenStep(o, cur, dt);
  else if (o.t === 'recon') {
    const inView = sensorSees(o.tp, cur, AFc().reconD || 260);
    o.inView = inView; if (inView) o.seenT = S.simT;   // 사진은 직접 찍어 보고 (SPACE·Enter·📷·A·R트리거)
  }
}
// 센서 시야: 앞 화면 가운데 or 아래 Camera(수직) 시야 안
const _sv = new V3();
function sensorSees(tp, cur, maxD) {
  maxD *= wxSense();
  const d = tp.distanceTo(cur), sp = toScreen(tp), x = sp.x / innerWidth * 2 - 1, y = 1 - sp.y / innerHeight * 2;
  const front = !sp.behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.92 && d > 3 && d < maxD;   // 화면에 보이면 (가장자리 조금 빼고)
  if (front) return true;
  const dy = cur.y - tp.y, h = Math.hypot(tp.x - cur.x, tp.z - cur.z);
  if (dy > 3 && dy < maxD && h < dy * 0.85) return true;   // 바로 아래 (아래 Camera)
  // 지금 켜져 있는 아래 Camera 화면(PC 작은 창 · VR 하부 Camera)에 보이면
  const lc = XR_ON && (SET.vrPip | 0) > 0 ? VR_PIP.cam : (typeof bellyMode === 'function' && bellyMode() !== null ? bellyCam : null);
  if (lc && d < maxD) { _sv.copy(tp).project(lc); if (_sv.z < 1 && Math.abs(_sv.x) < 0.95 && Math.abs(_sv.y) < 0.95) return true; }
  return false;
}
// ---- 사진 보고: 지금 Camera 화면을 작은 사진으로 (좌표·시각 표시) ----
const PH = { rt: null, lut: null, last: null, lastT: 0 };
// ---- 임무 후 브리핑: 점수(과제·시간·안전) · FLIGHT 기록 · Penalty 내역 · 과제별 시간 ----
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
  const el = $('resScore'); if (el) el.innerHTML = `<span class="sc">${R.sc}</span><span class="gr" style="color:${R.col}">${R.g}</span><span class="pt">${L2('과제', 'Tasks')} ${R.a}/55 · ${L2('시간', 'Time')} ${R.b}/30 · ${L2('안전', 'Safety')} ${R.c}/15<br>${L2('Total', 'Total')} ${fmt(R.total)} · ${L2('기준', 'Par')} ${fmt(par || 0)}</span>`;
  const ln = (a, b, cls) => `<div class="ln"><span>${a}</span><span class="${cls || ''}">${b}</span></div>`;
  let h = `<h4>${L2('FLIGHT 기록', 'FLIGHT')}</h4>` + ln(L2('FLIGHT Zoom', 'Distance'), (DBF.dist >= 1000 ? (DBF.dist / 1000).toFixed(2) + ' km' : DBF.dist.toFixed(0) + ' m')) + ln(L2('최고 속도', 'Top speed'), (DBF.vmax * 3.6).toFixed(0) + ' km/h') +
    ln(L2('평균 속도', 'Average speed'), (DBF.flyT > 1 ? DBF.dist / DBF.flyT * 3.6 : 0).toFixed(0) + ' km/h') + ln(L2('최고 고도 (지면 위)', 'Max height (AGL)'), DBF.altMax.toFixed(1) + ' m') +
    ln(L2('Impacts · 재출발', 'Impacts · restarts'), `${S.impacts || 0} · ${DBF.resp}`, (S.impacts || DBF.resp) ? 'bad' : 'ok');
  if (S.photos && S.photos.length) h += ln(L2('사진 (인정 / 전체)', 'Photos (valid / taken)'), `${S.photos.filter(p => p.ok).length} / ${S.photos.length}`);
  h += `<h4>${L2('Penalty 내역', 'PENALTIES')} · +${S.pen.toFixed(0)} s</h4>` + (DBF.pens.length ? DBF.pens.map(p => ln(`${fmt(p.t)} ${p.why || L2('Penalty', 'penalty')}`, '+' + p.d.toFixed(0) + ' s', 'bad')).join('') : `<div class="dim">${L2('None', 'None')}</div>`);
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
// Drop 버튼이 하는 일: 코스·자유 = Drop / 산불·정찰·추적·수색(찾기 전) = 사진 보고 / 그 밖 = None
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
    g.textAlign = 'right'; g.fillStyle = '#9fe9ff'; g.fillText(({ main: L2('주 Camera', 'MAIN CAM'), lower: L2('하부 Camera', 'LOWER CAM'), gimbal: L2('짐벌 yaw', 'GIMBAL') })[PH.via] || '', W0 - 8, H0 - 19); g.textAlign = 'left';
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
    showMsg(seen ? L2('연기는 찍혔지만 불씨 확인 불가 · 열화상(T)으로 Restart', 'Smoke only · switch to thermal (T) and retake') : L2('사진에 불씨 None · 화면 가운데에 두고 찍기', 'No hotspot in frame · center it and retake'), '#ff9a40', 1.8); return;
  }
  if (S.kind === 'recon' && o && o.t === 'recon') {
    if (o.inView || S.simT - (o.seenT ?? -9) < 1.5) { comm('Control, Eagle One. Imagery sent.', '이글 원: 사진 전송', OP); photoAdd(snapPhoto([L2('정찰 사진', 'RECON IMAGE') + '  ' + hm, o.label.split(' · ')[0]], o.tp), o.label, to5186(o.d || 0, o.s || 0), true); msNext('PHOTO ✓ ' + o.label.split(' · ')[0], '#5dff9a'); return; }
    photoAdd(snapPhoto([L2('사진 · 대상 None', 'PHOTO · NO TARGET') + '  ' + hm, '']), '', null, false); showMsg(L2('사진에 대상 건물 None · 화면 가운데(or 아래 Camera)에 담고 Restart', 'Target not in frame · center it and retake'), '#ff9a40', 1.8); return;
  }
  if (S.kind === 'track' && o && o.t === 'track') {
    const ok = !!o.inView; photoAdd(snapPhoto([(ok ? L2('추적 차량', 'TRACKED VEHICLE') : L2('사진', 'PHOTO')) + '  ' + hm, ''], ok && TRACK ? trackPose(TRACK.s).p : null), o.label, null, ok);
    if (ok) { comm('Control, Eagle One. Imagery sent.', '이글 원: 사진 전송', OP); showMsg(L2('차량 사진 보고 ✓', 'Vehicle photo reported ✓'), '#5dff9a', 1.4); } else showMsg(L2('사진에 차량 None', 'Vehicle not in frame'), '#ff9a40', 1.4); return;
  }
  if (S.kind === 'sar' && o && o.t === 'sarfind') {
    if (o.inView || S.simT - (o.seenT ?? -9) < 1.5) { comm('Control, Eagle One. Subject located. Photo and grid sent.', '이글 원: 실종자 발견 · 사진과 좌표 전송', OP); const xy = to5186(SAR.d, SAR.s); S.sarXY = xy; photoAdd(snapPhoto([L2('실종자 발견', 'SUBJECT FOUND') + '  ' + hm, xyS(SAR.d, SAR.s)], SAR.tp), o.label, xy, true); msNext(xy ? `실종자 발견 · 사진 보고 ✓ X ${xy[0].toFixed(0)} · Y ${xy[1].toFixed(0)}` : '실종자 발견 · 사진 보고 ✓', '#5dff9a'); return; }
    photoAdd(snapPhoto([L2('사진 · 확인 불가', 'PHOTO · UNCONFIRMED') + '  ' + hm, '']), '', null, false);
    showMsg(L2('사진에 실종자 None · 가까이(열화상은 멀리서도) 화면 가운데에', 'No subject in frame · get closer (or use thermal) and center it'), '#ff9a40', 1.8); return;
  }
  photoAdd(snapPhoto([L2('사진', 'PHOTO') + '  ' + hm, '']), '', null, false);
}
function orderTick() {   // 휴대폰: 📻 버튼(눌러 펼치기) · PC·VR: Pause Menu에 표시
  { const po = $('pauseOrder'); if (po) { const t = ORDER.m ? ((window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en) : ''; po.style.display = t ? '' : 'none'; if (po.dataset.t !== t) { po.dataset.t = t; po.innerHTML = `<b>${L2('📻 마지막 명령', '📻 LAST ORDER')}</b>${t}`; } } }
  let el = $('orderBox'); const on = !!ORDER.m && S.state === 'run' && (isMission() || S.kind === 'course') && !XR_ON && IS_TOUCH;
  if (!el) { if (!on) return; el = document.createElement('div'); el.id = 'orderBox'; (ui.hud || document.body).appendChild(el); el.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); el.classList.toggle('open'); el.classList.remove('new'); }); }
  el.style.display = on ? '' : 'none'; if (!on) return; const t = (window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en; if (el.dataset.t !== t) { el.dataset.t = t; el.innerHTML = `<b>${L2('📻 명령', '📻 ORDER')}<i>▾</i></b><span>${t}</span>`; if (!el.classList.contains('open')) el.classList.add('new'); }
}
function actionUI() { const b = $('tbDrop'); if (!b) return; const k = S.state === 'run' ? actionKind() : 'drop', t = k === 'report' ? '📷 REPORT' : k === 'none' ? '—' : 'DROP'; if (b.dataset.k !== k) { b.dataset.k = k; b.textContent = t; b.style.borderColor = k === 'report' ? '#5dff9a' : ''; b.style.color = k === 'report' ? '#5dff9a' : ''; b.style.fontSize = k === 'report' ? '13px' : ''; } }
function photoTick(dt) { { const lb = $('tbLight'); if (lb) lb.classList.toggle('off', !lightOn()); } wxTick(dt); orderTick(); actionUI(); dbfTick(dt); try { uasPC(S.state === 'demo' ? ghostS : S.state === 'replay' ? RP.pose : DR, isMission() ? msObj() : curObj()); } catch (e) { } if (PH.lastT > 0) PH.lastT -= dt; const b = $('tbPhoto'); if (b) b.classList.add('hidden'); }   // Drop 버튼이 사진 보고를 겸함
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
  sfx('good'); showMsg(`HIT · off center ${err.toFixed(1)} m`, '#5dff9a', 1.4); so.label = strikeLabel(); renderList();
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
    const G = msGrade(total), rows = [['Flight time', fmt(S.t)], ['Penalty', '+' + S.pen.toFixed(0) + ' s'], ['Total', fmt(total)], ['Impacts', S.impacts + ' ']];
    if (S.kind === 'strike') rows.push(['Hits', S.hitsS + ' / ' + STRIKE.filter(t => !t.decoy).length], [L2('기만체 타격', 'Decoys hit'), (S.decoyHit || 0) + L2(' 대', '')], ['Drones lost (misses)', (S.lost || 0) + ''], ['Mean error', (S.errS.reduce((x, y) => x + y, 0) / Math.max(1, S.errS.length)).toFixed(1) + ' m']);
    else if (S.lost) rows.push(['Drones lost', S.lost + '']);
    if (S.kind === 'sar' && S.sarXY) rows.push(['Hiker position (EPSG:5186)', S.sarXY[0].toFixed(0) + ', ' + S.sarXY[1].toFixed(0)]);
    if (S.kind === 'sar' && S.kitErr !== undefined) rows.push(['Kit error', S.kitErr.toFixed(1) + ' m']);
    if (S.kind === 'field' && S.padErr && S.padErr.length) rows.push([L2('착륙 오차', 'Landing error'), S.padErr.map(e => e.toFixed(2)).join(' / ') + ' m']);
    if (S.kind === 'track') rows.push(['Time tracked', S.trT.toFixed(0) + ' / ' + S.trWin.toFixed(0) + ' s'], [L2('최대 노출', 'Peak exposure'), Math.round(TRACK.susMax || 0) + '%'], [L2('발각', 'Spotted'), TRACK.burn ? L2('예 (-30)', 'yes (-30)') : L2('아니오', 'no')], ['Result', S.trackOK ? 'Success' : 'Fail']);
    if (S.kind === 'ridge' && RIDGE) rows.push(['Summit elevation', RIDGE.top.toFixed(0) + ' m']);
    if (S.kind === 'fire') (S.fireRep || []).forEach((xy, i) => xy && rows.push(['Hotspot ' + (i + 1) + ' (EPSG:5186)', xy[0].toFixed(0) + ', ' + xy[1].toFixed(0)]));
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td></tr>`).join('');
    debriefShow(MS.list.filter(x => x.done && !x.miss).length, MS.list.length, MS.par || 0);
    const ph = (S.photos || []).filter(p => p.ok), rp = $('resPhotos');
    if (rp) { rp.style.display = ph.length ? 'flex' : 'none'; rp.innerHTML = ph.map((p, i) => `<figure><a href="${p.url}" download="report_${S.kind}_${i + 1}.jpg"><img src="${p.url}" alt=""></a>${L2('보고 ', 'Report ')}${i + 1}${p.xy ? ' · ' + p.xy[0].toFixed(0) + ', ' + p.xy[1].toFixed(0) : ''}</figure>`).join(''); }
    const key = 'fpvsim_ms_best_' + S.kind + '_' + a.id + '_' + SET.diff + SITE_KEY; let best = null;
    try { best = parseFloat(localStorage.getItem(key)); } catch (e) { }
    if (!best || total < best) { try { localStorage.setItem(key, String(total)); } catch (e) { } ui.resBest.textContent = '★ New best'; }
    else ui.resBest.textContent = 'Best ' + fmt(best);
  }, 1400);
}
function msOsd() {
  const o = msObj(), a = AFc(); let h = '';
  if (a.cls === 'wing') h += `<div><b>AS</b>${((DR.as || 0) * 3.6).toFixed(0)} km/h</div>` + (S.stallW ? '<div style="color:#ff5050">STALL ▼ · ' + L2('기수 내리고 스로틀', 'nose down, power') + '</div>' : S.stallWarn ? '<div style="color:#ffb030">' + L2('실속 주의 · 속도', 'STALL WARNING · speed') + '</div>' : '');
  if (S.kind === 'strike') h += `<div><b>HIT</b>${S.hitsS || 0}/${STRIKE.filter(t => !t.decoy).length}</div><div><b>LOST</b>${S.lost || 0}</div>`;
  else if (isMission()) h += `<div><b>HIT</b>${S.impacts}</div>`;
  if (S.kind === 'fire') { const n = FIRE.filter(f => f.on && f.active && !f.done).length, w = FIRE.filter(f => f.on && !f.active).length; h += `<div style="color:#ffb070">FIRE ${n}${w ? ' +' + w : ''}</div>`; }
  if (o && o.t === 'fire') h += o.inView ? `<div style="color:#5dff9a">● ${L2('불씨 포착 · Enter/📷 촬영', 'HOTSPOT · Enter/📷 to photo')}</div>` : o.seenVis ? '<div style="color:#9aa6ad">Check with thermal (T)</div>' : `<div style="color:#9aa6ad">${ENV.ir ? 'IR searching' : 'Thermal off · T'}</div>`;
  h += scenOsd(o);
  if (o && o.t === 'recon') h += `<div style="color:${o.inView ? '#5dff9a' : '#9aa6ad'}">${o.inView ? '● ' + L2('건물 포착 · SPACE/📷 보고', 'TARGET · SPACE/📷 to report') : L2('화면 가운데나 아래 Camera에 담기', 'Center it or use the lower camera')}</div>`;
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
    const catN = { quad: L2('Recon quad', 'Recon quad'), fpv: L2('FPV', 'FPV'), wing: L2('고정익', 'Fixed-wing'), kam: L2('자폭', 'Loitering') }[cat];
    b.innerHTML = `<svg viewBox="0 0 64 48" aria-hidden="true">${AF_ICON[id]}</svg><i class="cat">${catN}</i><b>${a.name}</b><small>${a.sub}</small>` +
      `<span class="spec">Top ${Math.round(a.top * 3.6)} km/h · ${a.endur} min</span><span class="nt">${a.note}</span>`;
    b.onclick = () => { MENU.afNote = ''; setAirframe(id); afUI(); };
    box.appendChild(b);
  }
  const HAS = { forest: !!FLANE, race: RACE.length > 0, recon: RECON.length > 0, strike: STRIKE.length > 0, fire: FIRE.length > 0, sar: !!SAR, track: !!TRACK, ridge: !!RIDGE, field: !!RWY };
  document.querySelectorAll('#msGrid [data-ms]').forEach(b => { b.dataset.site = HAS[b.dataset.ms] !== false ? '1' : '0'; b.classList.remove('off'); b.title = ''; });
  if (typeof msVis === 'function') msVis();
  // 훈련장 고르기 (두 곳 이상일 때만)
  const sp = $('sitePick'), L = sitesAll();
  if (sp) { $('sitePickWrap').style.display = L.length < 2 ? 'none' : ''; sp.innerHTML = '';
    for (const st of L) { const b = document.createElement('button'); b.className = 'stc' + (st.id === SITE.id ? ' on' : ''); b.innerHTML = `<b>${stName(st)}</b><small>${st.flat ? 'Flat · standard obstacle course' : 'Real terrain · ' + (st.course ? 'course laid along a route' : 'DEM')}</small>`;
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
// 비·눈 오는 Dusk: 구름 낀 어두운 하늘 + 지평선에 흐린 주황 띠
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
  // Dusk: 낮은 서쪽 해·주황 하늘·긴 그림자 / 비·눈: 흐림(해 약하게)·안개 짙게
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
// 열화상: 재질을 열 세기(색)로 바꿈. 사진 바닥은 그대로 (흑백이 되면 맨땅=밝고 숲=어두움)
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
  showMsg(on ? 'THERMAL · white = hot' : 'VISIBLE', on ? '#ffffff' : '#9ad7ff', 1);
}
// 산불 불씨: 숲 속 5곳. 가시광으로는 연기만(or 안 보임), 열화상으로는 밝게
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
    L.push({ kind: 'ms', t: 'fire', label: `Hotspot ${i + 1} · search radius 50 m`, d, s, tp: c.clone().add(new V3(0, 0.6, 0)), mk: area, need: 1.2, g, em, puffs, glow, flames, sparks, sc, search: { r: 110 },
      pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y))]; } });
  }
  return L;
})();
function to5186(d, s) { try { const en = SITE_X.toEN(d, s); return projector(SITE.crs, 'EPSG:5186')(en); } catch (e) { return null; } }
function fireCheck(o, cur, dt) {
  const inView = sensorSees(o.tp, cur, (AFc().reconD || 260) * 0.8);
  o.inView = inView && ENV.ir; o.seenVis = inView && !ENV.ir;
  if (o.inView) { S.recT += dt; if (S.recT >= o.need) { const xy = to5186(o.d, o.s); flashPhoto(); msNext(xy ? `Hotspot reported ✓ X ${xy[0].toFixed(0)} · Y ${xy[1].toFixed(0)}` : 'Hotspot reported ✓', '#ffb070'); S.fireRep = (S.fireRep || []).concat([xy]); } }
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
    for (const p of f.puffs) { const u = (envT * 0.07 + p.userData.ph) % 1, j = p.userData.j; p.position.set(wx * lean * Math.pow(u, 1.4) * 2.2 + Math.sin(u * 7 + f.s + j * 6) * 2 * u, 1 + u * 58 * big, wz * lean * Math.pow(u, 1.4) * 2.2 + Math.cos(u * 5 + j * 6) * 2 * u); const k = (2 + u * 11) * big; p.scale.set(k, k * 0.85, k); p.material.opacity = (f.done ? 0.6 : 0.8) * Math.min(1, u * 5) * Math.pow(1 - u, 0.8) + 0.05; p.material.color.setHex(f.done ? 0x5f5b55 : 0xf6f4ef); p.visible = !ENV.ir && !ENV.night; }   // 새 신고 = 흰 연기 · 보고 끝 = 색 연기
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
  const dx = c.x - WX.last.x, dy = c.y - WX.last.y, dz = c.z - WX.last.z, jump = dx * dx + dy * dy + dz * dz > 400;   // 20 m 넘게 순간 move(재시작 등)이면 그대로 둠
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
      // 줄기 = Camera가 본 상대 속도 × 노출 시간 (호버링: 수직 짧게, Forward: 앞에서 날아오듯 기울고 길게)
      let rx = wv.x - dv.x, ry = -fall - dv.y, rz = wv.z - dv.z; const L = Math.hypot(rx, ry, rz) * EXP, k = L > 2.2 ? 2.2 / L : 1;
      a[i + 3] = a[i] - rx * EXP * k; a[i + 4] = a[i + 1] - ry * EXP * k; a[i + 5] = a[i + 2] - rz * EXP * k;
    }
    WX.rain.geometry.attributes.position.needsUpdate = true; }
  if (WX.snow && WX.snow.visible) { const a = WX.snow.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { const k = i * 0.37; a[i] += (wv.x * 0.6 + Math.sin(t * 0.9 + k) * 0.5) * dt - mx; a[i + 2] += (wv.z * 0.6 + Math.cos(t * 0.7 + k) * 0.5) * dt - mz; a[i + 1] -= 1.1 * dt + my; wrapY(a, i + 1); wrap(a, i); wrap(a, i + 2); }
    WX.snow.geometry.attributes.position.needsUpdate = true; }
}
function setTod(v) { SET.tod = v; SET.night = v === 'night'; ENV.night = SET.night; ENV.dusk = v === 'dusk'; saveSet(); if (ENV.ir) irSet(false); envApply(); syncTime(); }
function setWxFx(on) { SET.wxFx = !!on; saveSet(); syncTime(); if (S.state === 'run') showMsg(on ? L2('기상 영향 On · 돌풍·시야 감소', 'Weather effects on · gusts, reduced visibility') : L2('기상 영향 Off', 'Weather effects off'), '#4fe3ff', 1.2); }
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
// 기상 영향(옵션): 비·눈이면 바람이 없어도 돌풍이 불고, 가Off 강한 돌풍이 지나감 · 눈·Camera 탐지 Zoom 줄어듦
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
  add(UBOX, tailM, 0, 1.76, 1.72, 0.5, 0.04, 0.03).castShadow = false;   // assist 제동등
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
// 차량 등화: 밤·Dusk·비에는 전조등 · 감속·정차 때 브레이크등 (출발 전에는 시동 꺼짐)
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
  const list = cps.map((c, i) => { const cp = passCP(c.top ? `Summit (${(mx + SITE.base).toFixed(0)} m ASL)` : 'Ridge ' + (i + 1), c.q, 0, 15, 15, 4); cp.q = c.q; cp.alt = 15;
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
    if (a.drop) L.push({ kind: 'ms', t: 'sarkit', label: 'Drop rescue kit (within 5 m)', mk: SAR.c.clone().add(new V3(0, 8, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } });
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
    if (a.cls === 'wing') {   // 장주: Takeoff → Climb → 옆바람 → 바람 따라 → 활주로 착륙 (왼쪽 장주, 40 m)
      const side = -RWY.sg, P = [[RWY.L / 2 + 170, 0, 1, 0], [RWY.L / 2 + 170, side * 200, 0, 1], [-RWY.L / 2 - 170, side * 200, -1, 0], [-RWY.L / 2 - 200, 0, 1, 0]];
      const names = [L2('장주 1 · Climb', 'Pattern 1 · upwind'), L2('장주 2 · 옆바람', 'Pattern 2 · crosswind'), L2('장주 3 · 바람 따라', 'Pattern 3 · downwind'), L2('장주 4 · 최종 접근', 'Pattern 4 · final')];
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
    const pad = startPos(); if (DR.landed && Math.hypot(DR.p.x - pad.x, DR.p.z - pad.z) < 2.5) msNext('Landed ✓', '#5dff9a');
  } else if (o.t === 'track') {
    const T = TRACK, vp = trackPose(T.s);
    if (!T.go && cur.distanceTo(vp.p) < 220) { T.go = true; showMsg('Vehicle moving · start tracking', '#ffc828', 1.6); comm(`${CS}, target is moving. You have the eye, keep it.`, '표적 차량 move 시작 · 관측 유지'); }
    const tp = vp.p.clone().add(new V3(0, 1, 0)), dd = cur.distanceTo(tp), see = sensorSees(tp, cur, 320);
    o.close = dd < 25; o.inView = see && !o.close;
    if (T.go) { S.trWin += dt; if (o.inView) S.trT += dt; }
    // 들킴: 운전자 시야(차 앞쪽 ±40°), 가까움, 낮은 고도(프로펠러 SOUND)일수록 빨리 참 · 안전하면 서서히 내려감
    if (T.go) {
      const fx = Math.sin(vp.h), fz = -Math.cos(vp.h), rx = cur.x - vp.p.x, rz = cur.z - vp.p.z, dh = Math.hypot(rx, rz), hy = cur.y - vp.p.y, front = dh > 1 ? (rx * fx + rz * fz) / dh : 0;
      // 운전자 시야: 앞유리(정면 ±50°, 올려다보는 각 35° 아래, 200 m 안) > 옆 유리(±50~110°, 25° 아래, 100 m 안)
      const el = Math.atan2(Math.max(0, hy), Math.max(1, dh)) / DEG; let r = 0; o.seen = false;
      if (front > 0.64 && el < 35 && dh < 200) { r += 45 * (1 - dh / 200) + 10; o.seen = true; }
      else if (front > -0.34 && el < 25 && dh < 100) { r += 15 * (1 - dh / 100); o.seen = true; }
      if (dd < 60) r += (60 - dd) * 1.5;                       // 가까우면 SOUND·모습
      if (hy < 35 && dh < 100) r += (35 - Math.max(0, hy)) * 0.8;   // 낮으면 프로펠러 SOUND
      if (ENV.night) r *= lightOn() ? 1.5 : 0.6;               // 밤: Light을 켜면 훨씬 잘 보임
      if (ENV.wx === 'rain') r *= 0.75;
      T.sus = clamp(T.sus + (r * 0.55 - 6) * dt, 0, 100); T.susMax = Math.max(T.susMax || 0, T.sus);
      if (!T.warn && T.sus >= 45) { T.warn = true; sfx('bad'); showMsg(L2('노출 주의 · Zoom를 벌릴 것', 'Exposure · back off'), '#ff9a40', 1.6); comm(`${CS}, CONTROL. Driver is looking around. Back off and increase your standoff.`, '운전자가 주변을 살핌 · 뒤로 빠져 Zoom 넓힐 것'); }
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
    if (S.trT >= o.need) { S.trackOK = true; comm('Good track, we have what we need. Break off and RTB.', '추적 완료 · 이탈 후 복귀'); msNext(`Tracking success · ${S.trT.toFixed(0)} s / ${S.trWin.toFixed(0)} s`, '#5dff9a'); }
    else if (T.s >= (T.endS || T.total) - 1) { S.trackOK = false; msNext(`Vehicle arrived · tracked ${S.trT.toFixed(0)} s (not enough)`, '#ff9a40'); }
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
  ringsTick();
}
// 조난자: 드론이 70 m 안에 오면 팔을 들어 흔듦 (발견 뒤에도 Resume)
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
  if (e <= 5) { comm('Control, Eagle One. Kit away.', '이글 원: 키트 Drop 완료', OP); msNext(`Kit delivered ✓ ${e.toFixed(1)} m`, '#5dff9a'); } else if ((S.kits | 0) > 0) { showMsg(`키트 ${e.toFixed(1)} m · 5 m 안으로 Restart (남은 ${S.kits}개)`, '#ff9a40', 1.6); sfx('bad'); } else { S.pen += 30; msSkip(); }
  return true;
}
function scenOsd(o) {
  if (!o) return '';
  if (o.t === 'sarfind') return `<div style="color:${o.inView ? '#5dff9a' : '#9aa6ad'}">${o.inView ? '● ' + L2('실종자 포착 · Enter/📷 촬영', 'SUBJECT · Enter/📷 to photo') : ENV.ir ? 'IR searching' : 'Under canopy: thermal (T)'}</div>`;
  if (o.t === 'track') { const su = Math.round(TRACK.sus || 0), sc = su >= 70 ? '#ff6060' : su >= 40 ? '#ff9a40' : '#5dff9a';
    return `<div style="color:${o.inView ? '#5dff9a' : o.close ? '#ff9a40' : '#9aa6ad'}">TRACK ${S.trT.toFixed(0)}/${o.need}s${o.close ? ' · too close' : o.inView ? ' ●' : TRACK.go ? ' · out of view' : ' · approach to start'}</div>`
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
  L.forEach((o, i) => { o.label = `Recon ${i + 1} · building (${o.wl})`; o.done = false; }); return L;
}
// 산불: 후보 8곳 중 5곳, 3곳은 Restart · 2곳은 나중에 신고
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
  race: ['Valley time race', 'Fly through the rings along the valley, in order, as fast as you can.', 'Boost (BST) takes you to the airframe top speed. Miss a ring and you must come back through it.'],
  recon: ['Building recon', 'Find and photograph 4 random real buildings from the topo map.', 'Hold each building centered on screen or in the belly cam for 1.5 s. Targets change every run.'],
  strike: ['Vehicle strike', '5 vehicles: 3 real, 2 decoys. Hit only the real ones.', 'They look identical in daylight. In thermal (T) the real ones show engine heat. Hitting a decoy costs +20 s.'],
  fire: ['Wildfire watch', 'Smoke reports come in by radio with a bearing and a rough distance. Only a wide search area is marked, not the fire itself.', 'One report at a time: find the smoke column (it leans with the wind; at night look for the glow), switch to thermal (T), center the hotspot and press Enter / 📷 / A to photograph it. Report it and the next one comes in. After 150 s a fire spreads (+15 s).'],
  sar: ['Search & rescue', 'A hiker is missing near the trails. Only a wide search area is marked; the location changes every run.', 'Clues: his yellow pack near where he went missing, signal-mirror flashes (a flashlight at night), and body heat in thermal under the canopy. Center him and press Enter / 📷 / A to photograph and report. 2 rescue kits: drop one within 5 m.'],
  track: ['Vehicle tracking', 'Keep a car on a real road in view for 60 s without being spotted.', 'Being in the driver\'s view (ahead, low angle), close or low fills the exposure gauge; when it is full you are spotted (fail, -30, RTB). Stay behind it and high. At night turn your light off (L) to stay hidden.'],
  ridge: ['Ridge run', 'Climb to the summit along a DEM-derived ridge and come down another ridge.', 'Ridges are windy. Pass the rings in order.'],
  field: ['Field airstrip', 'Runway, taxiway and three H pads. Quads hop between the pads with precise landings; fixed wings fly a traffic pattern and land.', 'Land within 1.5 m of the pad centre, gently. Wings: take off, fly the pattern rings, land on the runway.']
} : {
  forest: ['숲 속 좁은 길', '주 경로 옆 숲 속에 낸 좁은 길을 따라 게이트·좁은 틈·쓰러진 나무를 지나 결승까지.', '나무 사이는 2~3 m. 수관 아래(지면 3 m 이하)로 낮게 날 것.'],
  race: ['계곡 타임 레이스', '계곡을 따라 놓인 링을 순서대로 최단 시간에 통과.', 'Boost(BST)로 기체 최고 속도까지. 링을 빗나가면 되돌아와 Restart 통과.'],
  recon: ['건물 정찰', '수치지형도에 있는 실제 건물 중 무작위 4곳을 찾아 촬영.', '건물을 화면 가운데나 아래 Camera에 1.5초 담기. 매번 대상이 바뀜.'],
  strike: ['차량 표적 타격', '차량 5대 중 실물은 3대, 나머지 2대는 기만체. 실물만 골라 돌입.', '가시광으로는 똑같음. 열화상(T)에서 엔진 열이 있는 차량이 실물. 기만체를 치면 +20초.'],
  fire: ['산불 감시', '무전으로 연기 신고가 방위·대략 Zoom로 들어옴. 지도에는 넓은 수색 구역만 표시되고 불 위치는 안 나옴.', '한 번에 한 곳씩: 바람에 기우는 연기 기둥(밤에는 불빛)을 찾아가 열화상(T)으로 불씨를 화면 가운데에 두고 Enter·📷·A 버튼으로 사진 보고. 보고하면 다음 신고가 들어옴. 150초가 지나면 번져서 +15초.'],
  sar: ['실종자 수색·구조', '등산로 근처 실종자 신고. 지도에는 넓은 수색 구역만 표시, 위치는 매번 다름.', '단서: 근처에 떨어진 노란 배낭, 신호 거울 반짝임(밤에는 손전등), 숲 아래 체온(열화상). 찾으면 화면 가운데에 두고 Enter·📷·A 버튼으로 사진 보고. 구조 키트 2개 · 5 m 안에 Drop.'],
  track: ['차량 추적', '실제 도로를 달리는 차량을 들키지 않고 60초 동안 시야에 유지.', '운전자 시야(차 앞쪽·낮은 각도)·근접·저고도면 노출 게이지가 차고, 가득 차면 발각(실패·-30·복귀). 차 뒤쪽 높이 유지 권장. 밤에는 드론 Light을 끄면(L) 덜 들킴.'],
  ridge: ['능선 종주', 'DEM 분석으로 뽑은 능선을 따라 정상까지 올라갔다가 다른 능선으로 내려옴.', '능선은 바람이 셈. 링을 순서대로 통과.'],
  field: ['야전 착륙장', '활주로·유도로·H 패드 3개. 쿼드는 패드 사이를 옮겨 다니며 정밀 착륙, 고정익은 장주(트래픽 패턴)를 돌고 활주로 착륙.', '패드 가운데 1.5 m 안에 살살 내려앉기. 고정익: Takeoff → 장주 링 → 활주로 착륙.']
};
function briefShow(kind, L) {
  const b = BRIEF[kind], el = $('brief'); if (!b || !el) return;
  const cond = [WIND.lv ? (WIND.lv === 1 ? L2('바람 약 3 m/s', 'Wind 3 m/s') : L2('바람 강 7 m/s', 'Wind 7 m/s')) : L2('바람 None', 'No wind'), ENV.night ? L2('밤', 'Night') : L2('낮', 'Day'), AFc().name].join(' · ');
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
    if (T.stopT > 0) { T.stopT -= dt; T.v = 0; if (T.stopT <= 0) comm('Target is moving again. Stay on it.', '차량 Restart 출발 · Resume 추적'); }
    else { T.v = T.base * (0.8 + 0.35 * Math.sin(T.tt * 0.11 + T.ph)); if (T.stops.length && T.s > T.stops[0]) { T.stops.shift(); T.stopT = 6 + Math.random() * 6; comm('Target has stopped. Hold your standoff, keep eyes on.', '차량 정차 · Zoom 유지하며 관측'); } }
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
  for (let t = 0; t < 24; t++) { const ang = Math.random() * 6.283, ad = 55 + Math.random() * 40; SAR.area.copy(W(d + Math.cos(ang) * ad, s + Math.sin(ang) * ad, 30)); if (flyL(SAR.area) <= FLY_R - 130) break; } MS.h1 = MS.h2 = false;   // 수색 구역이 FLIGHT 구역 안에 들어오게
  for (let t = 0; t < 24; t++) { const pa = Math.random() * 6.283, pd = 45 + Math.random() * 25; SAR.pkP.copy(W(d + Math.cos(pa) * pd, s + Math.sin(pa) * pd, 0)); if (flyL(SAR.pkP) <= FLY_R_SAFE) break; } SAR.pk.position.copy(SAR.pkP); SAR.pk.rotation.y = Math.random() * 6.28; SAR.pk.visible = true; SAR.pkFound = false;
  SAR.sig.position.copy(c).add(new V3(0, 0.9, 0)); SAR.sigT = Math.random() * 3;
}
// 실종자 수색 구역을 좁힘 (가운데는 여전히 실제 위치와 조금 어긋나게)
function sarNarrow(o, r, off) { const a = Math.random() * 6.283; o.mk.copy(W(SAR.d + Math.cos(a) * off, SAR.s + Math.sin(a) * off, 30)); o.search.r = r; o.label = L2(`실종자 수색 · 구역 반경 ${r} m`, `Find the hiker · area radius ${r} m`); renderList(); }
// 출발점 기준 방위·Zoom (무전용)
function brgFrom(o, p) {   // o 에서 p 까지 방위(진북)·Zoom (무전용 낱말 포함)
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
  { const endAt = s0 => { for (let s = s0; s <= T.total; s += 10) if (flyL(trackPose(s).p) > FLY_R_SAFE) return s; return T.total; }; let e = endAt(T.s), tries = 0; while (e - T.s < 800 && tries++ < 20) { T.s = Math.random() * T.total * 0.5; if (flyL(trackPose(T.s).p) > FLY_R_SAFE) continue; e = endAt(T.s); } T.endS = e; /* FLIGHT 구역 밖으로 나가는 곳에서 끝 */ }
  T.base = 7 + Math.random() * 3; T.ph = Math.random() * 6; T.tt = 0; T.stopT = 0; T.stops = [T.s + 400 + Math.random() * 300, T.s + 1100 + Math.random() * 400]; }

// =====================================================================
//  무전 교신 (영어 · 원격 통제소가 지시). 화면 표시 + 무전 잡음 + 영어 음성(SETTINGS)
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
function commReset() {   // 새 FLIGHT: 남은 무전·자막·사진 미리보기 정리
  COMM.q.length = 0; COMM.cur = (COMM.cur || 0) + 1; COMM.sp = false; COMM.busy = 0; try { if (COMM.src) COMM.src.stop(); } catch (e) { } COMM.src = null;
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { } try { commStatic(false); } catch (e) { }
  const r = $('radio'); if (r) r.classList.remove('show'); const pp = $('photoPop'); if (pp) pp.style.opacity = 0; if (typeof PH !== 'undefined') PH.lastT = 0;
}
const OP = 'EAGLE ONE';   // 드론 운용자(우리 쪽) 무전 · 다른 목SOUND
function pickVoice() { try { const V = speechSynthesis.getVoices(); COMM.voice = V.find(v => /en-US/.test(v.lang) && /Male|David|Guy|Daniel|Alex/i.test(v.name)) || V.find(v => /^en/.test(v.lang)) || null; } catch (e) { } }
try { speechSynthesis.onvoiceschanged = pickVoice; pickVoice(); } catch (e) { }
// 말하는 동안 무전 잡음 (대역 제한 잡음 + 흔들림 + 지직거림)
function commStatic(on, dur) {
  const ctx = AU.ctx; if (!ctx || !AU.master) return;
  if (COMM.st) { try { COMM.st.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); COMM.st.s.stop(ctx.currentTime + 0.3); } catch (e) { } COMM.st = null; }
  if (!on) return;
  const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true;
  // 잡음은 말SOUND 대역(300~3000 Hz)을 피해 높은 쪽 '쉬' SOUND로, 작게
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200; const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 7000; bp.Q.value = 0.5;
  const g = ctx.createGain(); g.gain.value = 0.0001; s.connect(hp); hp.connect(bp); bp.connect(g); g.connect(AU.master); s.start(t);
  const T = Math.min(dur || 6, 20);
  // 아주 옅은 쉬 SOUND만 (말SOUND를 가리지 않게)
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
// 기기에 영어 음성이 없으면(예: Quest 브라우저) 내장 합성기를 별도 작업 스레드에서 돌려 SOUND를 만듦 (GPL 구성 요소, 이때만 불러옴)
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
function rvPlan(text, spk) {   // 가장 긴 조각부터 맞춰 나감 (문장 단위 조각이면 억양이 자연스러움) · spk 'op' = 드론 운용자 목SOUND
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
    forest: [`${CS}, CONTROL. Cleared for launch. Proceed into the forest trail, stay low under the canopy. ${w}Over.`, 'Takeoff 허가. 숲길로 진입, 수관 아래로 낮게.'],
    race: [`${CS}, CONTROL. Range is hot. Rings are set along the valley. Go when ready. ${w}`, '코스 준비 완료. 계곡 링 따라 출발.'],
    recon: (() => { const b = kind === 'recon' && MS.list[0] && MS.list[0].tp ? fromLaunch(MS.list[0].tp) : null; return [`${CS}, CONTROL. Four structures tasked for imagery. ${b ? `First structure bearing ${b.brgW}, about ${b.distW} meters from launch point.` : ''} ${n}Over.`, `건물 4곳 촬영 임무.${b ? ` 첫 대상: 출발점에서 방위 ${b.brg}° · 약 ${b.dist} m` : ''}`]; })(),
    strike: [`${CS}, CONTROL. Five vehicles in the valley, two are decoys. Positive ID by thermal before you commit. Cleared hot.`, '차량 5대 중 2대 기만체. 열화상으로 식별 후 돌입. 공격 허가.'],
    fire: [`${CS}, CONTROL. Fire watch requested. Smoke reports coming in, locate each fire, confirm with thermal and report. ${w}Over.`, '산불 감시 요청. 연기 신고가 들어옴. 직접 찾아 열화상으로 확인 후 보고.'],
    sar: (() => { const b = kind === 'sar' && SAR ? fromLaunch(SAR.area) : null; return [`${CS}, CONTROL. Missing hiker, last seen near the trail. ${b ? `Search area bearing ${b.brgW}, about ${b.distW} meters from launch point.` : ''} Sweep the area, look for his pack and signal flashes, use thermal under the trees. ${n}Over.`, `실종자 수색.${b ? ` 수색 구역: 출발점에서 방위 ${b.brg}° · 약 ${b.dist} m.` : ''} 구역을 훑으며 배낭·신호 반짝임, 나무 아래는 열화상.`]; })(),
    track: [`${CS}, CONTROL. Target vehicle on the forest road. Do not get spotted. Stay out of its front, keep high and well back, and keep eyes on for sixty seconds.`, '도로의 표적 차량 추적. 들키지 말 것 · 차 앞쪽 피하고 높게, 멀찍이 뒤에서 60초 관측.'],
    ridge: [`${CS}, CONTROL. Ridge run approved. Expect gusts on the crest. ${w}`, '능선 FLIGHT 승인. 능선 위 돌풍 주의.'],
    field: [`${CS}, CONTROL. Field strip is yours. ${AFc().cls === 'wing' ? 'Take off, fly the pattern and land on the runway.' : 'Hop the pads, land gently on the centre of each.'} ${w}`, AFc().cls === 'wing' ? '야전 착륙장 사용 승인. Takeoff 후 장주 FLIGHT, 활주로 착륙.' : '야전 착륙장 사용 승인. 패드를 옮겨 다니며 가운데에 살살 착륙.']
  }[kind];
  if (T) { comm(T[0], T[1]); if (isMission(kind)) comm('Eagle One, wilco.', '이글 원, 수행하겠음.', OP); }
}
let COMM_LAST = 0;
function commAck(o, kind) {   // 목표 하나 끝났을 때
  const left = MS.list.filter(x => !x.done).length;
  if (kind === 'recon') { const x = MS.list.find(y => !y.done), b = x ? brgFrom(DR.p, x.tp) : null; return comm(`Copy imagery. ${b ? `Next structure bearing ${b.brgW}, about ${b.distW} meters from your position.` : 'All imagery received.'}`, b ? `촬영 확인. 다음 대상: 현 위치에서 방위 ${b.brg}° · 약 ${b.dist} m` : '촬영 모두 수신.'); }
  if (kind === 'recon-old') return comm(`Copy imagery. ${left ? `Next structure, grid ${(() => { const x = MS.list.find(y => !y.done); return x ? grid(x.d, x.s) : '—'; })()}.` : 'All imagery received.'}`, left ? '촬영 확인. 다음 대상 좌표 전달.' : '촬영 모두 수신.');
  if (kind === 'fire') return comm(`Copy imagery, hotspot confirmed at grid ${grid(o.d, o.s)}. Fire crews dispatched.${left ? ' Stand by for the next report.' : ' All reported.'}`, `사진 접수 · 불씨 확인, 진화대 출동.${left ? ' 다음 신고 대기.' : ' 모두 보고됨.'}`);
  if (kind === 'sar' && o.t === 'sarfind') return comm(`Copy imagery, subject located at grid ${grid(SAR.d, SAR.s)}. ${AFc().drop ? 'Drop the rescue kit within five meters.' : 'Return to base.'}`, `실종자 위치 확인. ${AFc().drop ? '구조 키트 5 m 이내 Drop.' : '복귀.'}`);
  if (kind === 'sar' && o.t === 'sarkit') return comm('Good drop, kit on the ground. Ground team is en route. RTB.', '키트 전달 확인. 구조대 move 중. 복귀.');
  if (kind === 'forest' || kind === 'race' || kind === 'ridge') {
    const done = MS.list.length - left, half = Math.floor(MS.list.length / 2);
    if (o.label && /정상|Summit/.test(o.label)) return comm(`Summit reached. Nice work, ${CS}. Head down the far ridge.`, '정상 도착. 반대편 능선으로 Descend.');
    if (done === half) return comm(`Halfway. ${S.pen ? 'Watch your clearances.' : 'Looking clean, keep it up.'}`, `절반 통과. ${S.pen ? '간격 주의.' : '깔Off함, Resume.'}`);
    if (left === 1) return comm('Final gate ahead. Bring it home.', '마지막 통과점. 마무리.');
  }
}

// =====================================================================
//  화면 배치 편집 (창 위치·크기·숨기기). 기기 종류별(터치/PC)로 따로 저장
// =====================================================================
const LY_ITEMS = [
  ['osd', 'FLIGHT 정보', 'Flight data'], ['obj', '다음 과제', 'Next task'], ['list', '과제 목록', 'Task list'], ['map', '지도', 'Map'], ['belly', '아래 Camera', 'Belly cam'],
  ['radio', '무전', 'Radio'], ['guide', '안내 문구', 'Guide'], ['bottom', '상태 표시', 'Status'], ['scope', 'Drop 조준', 'Drop scope'],
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
    // 손가락 아래에 있는 창 (맨 위 것부터) — TOUCH CONTROLS 영역이 위에 덮여 있어도 찾음
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
  ['Parrot ANAFI USA', 'Parrot ANAFI USA 백서 (0.5 kg, 14.7 m/s, climb·descend 4 m/s, 32분)', 'Parrot ANAFI USA white paper (0.5 kg, 14.7 m/s, 4 m/s climb/descent, 32 min)'],
  ['RQ-11B Raven · RQ-20B Puma', '미 해군 Group 1 소형 무인기 제원표 · 미 공군 RQ-11B 제원표', 'U.S. Navy Group 1 sUAS fact file · U.S. Air Force RQ-11B fact sheet'],
  ['FPV · Kamikaze FPV · Loitering fixed-wing', '특정 제품이 아닌 일반적인 성능 범위로 잡은 가상 기체', 'Generic airframes with typical performance ranges (not a specific product)']
];
function credHTML() {
  const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  let h = '<h3>' + (EN_ ? 'Training site · ' : '훈련장 · ') + stName(SITE) + '</h3><table>';
  if (SITE.credits) h += SITE.credits.map(c => row(EN_ ? c[2] : c[0], EN_ ? c[3] : c[1])).join('');
  else h += row(EN_ ? 'Terrain' : '지형', SITE.flat ? (EN_ ? 'Flat ground (no terrain data)' : 'Flat (지형 데이터 None)') : (stSrc(SITE) || '-'));
  h += row(EN_ ? 'Course' : '코스', SITE.flat ? (EN_ ? 'Standard obstacle course layout' : '기본 장애물 Course placement') : (EN_ ? 'Obstacles laid along a user-specified route' : '사용자가 지정한 경로를 따라 장애물 배치'));
  h += '</table><h3>' + (EN_ ? 'Airframe specs' : '기체 제원') + '</h3><table>' + CRED_AF.map(c => row(c[0], EN_ ? c[2] : c[1])).join('') + '</table>';
  h += '<h3>' + (EN_ ? 'Software' : '소프트웨어') + '</h3><table>' + row('three.js r149', 'MIT') + row('geotiff.js 2.1', 'MIT') + row('proj4js 2.11', 'MIT') + '</table>';
  h += `<div class="note">${EN_ ? 'Speeds, sizes and handling approximate public specifications. Map data: National Geographic Information Institute (NGII), Korea.' : '속도·크기·조종 특성은 공개 제원 수준의 근사값. 지도 자료 출처: 국토교통부 국토지리정보원.'}</div>`;
  return h;
}
$('bCred').onclick = () => { $('credBody').innerHTML = credHTML(); $('credPanel').classList.remove('hidden'); };
$('credClose').onclick = () => $('credPanel').classList.add('hidden');
// 화면 아래 작은 출처 (Site 자료가 있을 때)
(function () { const el = $('attrib'); if (!el) return; el.textContent = SITE.credits ? (EN_ ? 'Map data © NGII Korea · 1:5,000 topo map · orthoimage 2025 · Copernicus DEM GLO-30' : '지도 자료 © 국토지리정보원 · 수치지형도 1:5,000 · 정사영상 2025 · Copernicus DEM GLO-30') : ''; })();

document.querySelectorAll('#segVoice button').forEach(b => { b.classList.toggle('on', (b.dataset.v === '1') === (SET.voice !== false)); b.addEventListener('click', () => { SET.voice = b.dataset.v === '1'; saveSet(); document.querySelectorAll('#segVoice button').forEach(x => x.classList.toggle('on', x === b)); if (!SET.voice) try { speechSynthesis.cancel(); } catch (e) { } }); });

// =====================================================================
//  시작 화면: 격납고(기체 yaw 미리 보기) · 임무 트리맵 · 임무 Site 미리 보기
// =====================================================================
const MENU = { ms: 'course', cf: null, cR: 60, cH: 20, a: 0, ri: 0, tt: 0, models: {}, dbl: 0 };
try { const v = localStorage.getItem('fpvsim_menu_ms'); if (v) MENU.ms = v; } catch (e) { }
const MS_CAT = { course: 'train', forest: 'train', race: 'train', ridge: 'train', field: 'train', tutorial: 'train', free: 'train', demo: 'train', recon: 'recon', track: 'recon', fire: 'rescue', sar: 'rescue', strike: 'strike' };
const CAT_C = { train: '#4fe3ff', recon: '#5dff9a', rescue: '#ffaa4d', strike: '#ff5d5d' };
const AF_C = { quad: '#5aa9ff', fpv: '#b48cff', wing: '#4fe3c0', kam: '#ff6a5d' };
const CAT_N = () => ({ train: L2('FLIGHT 훈련', 'FLIGHT TRAINING'), recon: L2('정찰·감시', 'RECON · SURVEILLANCE'), rescue: L2('재난·구조', 'DISASTER · RESCUE'), strike: L2('타격', 'STRIKE') });
const MDESC = () => ({
  course: [L2('장애물 코스', 'Obstacle course'), L2('게이트 · 슬라롬 · 벙커 · 정찰 · Drop · 정밀 착륙까지 이어지는 기본 훈련 코스.', 'The core course: gates, slalom, bunker, recon, payload drops and a precision landing.'), L2('Training Difficulty와 Guide로 익힌 뒤 Sport에서 기록 단축.', 'Learn it on Training with the guide on, then chase your time on Sport.')],
  tutorial: [L2('Tutorial', 'Tutorial'), L2('장애물 하나씩 설명을 보고 연습. 처음이라면 여기부터.', 'Practice one obstacle at a time with explanations. Start here if you are new.'), L2('Recon quad(X2D)로만 진행.', 'Flown with the recon quad (X2D) only.')],
  free: [L2('Free Flight', 'Free flight'), L2('시간·목표 없이 지형과 기체를 익히는 FLIGHT.', 'No timer, no objectives: get to know the terrain and the airframe.'), L2('모든 기체 사용 가능. 열화상(T)·밤·바람도 시험해 보기.', 'Every airframe allowed. Try thermal (T), night and wind.')],
  demo: [L2('Watch Reference Flight', 'Reference flight'), L2('장애물 코스를 모범 FLIGHT으로 자동 재생.', 'Watch an automatic reference run through the obstacle course.'), L2('경로와 고도를 눈에 익혀 두기.', 'Memorize the line and the altitudes.')]
});
function msInfo(k) { const b = BRIEF[k] || MDESC()[k] || [k, '', '']; return { t: b[0], d: b[1], tip: b[2] }; }
function msAvail(k) {
  const HAS = { forest: !!FLANE, race: RACE.length > 0, recon: RECON.length > 0, strike: STRIKE.length > 0, fire: FIRE.length > 0, sar: !!SAR, track: !!TRACK, ridge: !!RIDGE, field: !!RWY };
  const site = HAS[k] !== false, af = (MS_OK[k] || []).includes(SET.af), wx = !(k === 'fire' && (SET.wx === 'rain' || SET.wx === 'snow'));   // 비·눈 오는 날은 산불 감시 None
  return { ok: site && af && wx, site, af, wx, why: !site ? L2('Not available at this site', 'Not available at this site') : !wx ? L2('비·눈 오는 날에는 산불 감시를 하지 않습니다 · 날씨를 Clear으로', 'No wildfire watch in rain or snow · set the weather to clear') : !af ? L2('선택한 기체로는 할 수 없는 임무 · 아래 추천 기체를 고르세요', 'Not possible with this airframe · pick a recommended one below') : '' };
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
    [L2('기동', 'AGI'), agi, a.cls === 'wing' ? L2('선', 'bank ') + a.bank + '°' : a.yaw + '°/s'],
    [L2('안정', 'STB'), stb, a.cls === 'wing' ? L2('실속 ', 'stall ') + Math.round(a.stall * 3.6) : L2('기울기 ', 'tilt ') + a.tilt.sport + '°'],
    [L2('센서', 'SNS'), (a.reconD || 260) / 600, (a.reconD || 260) + ' m']
  ];
}
function afTags(a) {
  const t = [];
  if (a.cls === 'wing') t.push(L2('Pause 불가', 'No hover')); else t.push(L2('Pause FLIGHT', 'Hover'));
  if (a.drop) t.push(L2('Drop 장치', 'Payload drop'));
  if (a.acro) t.push('Acro');
  if (a.id === 'anafi') t.push(L2('32배 줌', '32× zoom'));
  if (a.id === 'puma' || a.id === 'fw') t.push(L2('손 투척', 'Hand launch'));
  if (a.kam) t.push(L2('탄두 · 1용', 'Warhead · expendable'));
  return t;
}
function menuAfPanel() {
  const a = AFc(), cat = afCat(a), col = AF_C[cat];
  const catN = { quad: L2('Recon quad', 'RECON QUAD'), fpv: 'FPV', wing: L2('고정익', 'FIXED-WING'), kam: L2('자폭', 'LOITERING') }[cat];
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
  meta.push(AFc().name + ' · ' + { train: L2('Training', 'Training'), easy: L2('Easy', 'Easy'), sport: L2('Sport', 'Sport') }[SET.diff]);
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
  if (MENU.mode === 'vr') { if (k === 'tutorial') { const w = $('mdWhy'); if (w) w.textContent = L2('Tutorial은 컴퓨터 판에서만 · VR에서는 장애물 코스부터', 'Tutorial is on the computer version only'); return; } if (!VR_OK.ok) { const w = $('mdWhy'); if (w) w.textContent = L2('이 기기는 VR을 지원하지 않습니다', 'This device does not support VR'); return; } XR.pending = k; vrStart(); return; }
  if (k === 'tutorial') openTutMenu(); else startRun(k);
}
document.querySelectorAll('#msGrid [data-ms]').forEach(b => {
  b.addEventListener('click', () => { const now = performance.now(), again = MENU.ms === b.dataset.ms && now - MENU.dbl < 450; MENU.dbl = now; if (again) menuGo(); else menuSel(b.dataset.ms); });
});
$('msGo').onclick = menuGo;
if ($('bPauseOpt')) $('bPauseOpt').onclick = () => openPanel('optPanel');
if ($('bPauseCtl')) $('bPauseCtl').onclick = () => { openPanel('ctlPanel'); try { kbHelp(); } catch (e) { } };
setInterval(() => { const w = $('pauseWho'); if (w && S.state === 'pause') { const lk = S.lastKind || S.kind; w.textContent = L2('현재 임무: ', 'Mission: ') + (MS_NAME[lk] || ({ course: L2('장애물 코스', 'Obstacle course'), free: L2('Free Flight', 'Free flight'), tutorial: L2('Tutorial', 'Tutorial'), demo: L2('Reference', 'Reference flight') })[lk] || lk) + ' · ' + AFc().name + ' · ' + pilotName(); } }, 400);
// ---- 첫 화면 3단계: 1 Pilot name → 2 기체 → 3 코스 (각 단계 뒤로 가기) ----
MENU.step = 0; const HAS_INTRO = !!(window.SIM_VR || window.SIM_VR_URL); MENU.mode = window.SIM_VR ? 'vr' : 'pc';
try { SET.pilot = localStorage.getItem('fpvsim_pilot') || ''; } catch (e) { SET.pilot = ''; }
function pilotName() { return SET.pilot || L2('조종사', 'Pilot'); }
function wizGo(n) {
  n = Math.max(HAS_INTRO ? 0 : 1, Math.min(3, n | 0)); const c = $('menuCard'); if (!c) return;
  if (MENU.step === 1 && n > 1) { const v = ($('pilotName').value || '').trim().slice(0, 16); SET.pilot = v; try { localStorage.setItem('fpvsim_pilot', v); } catch (e) { } }
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
  const SALT = 'k7Qx2#range', MID = 5000, N = 12000, FIN = '667c6eac4841dacac28af88ce9febae877dcf0556f15edc5211601d0f51bb8eb', KEY = 'fpvsim_pin_ok', el = $('pinGate'); if (!el) return;
  const okMid = m => typeof m === 'string' && /^[0-9a-f]{64}$/.test(m) && pinStretch(m, MID, N) === FIN;
  let ok = false; try { ok = okMid(localStorage.getItem(KEY)); } catch (e) { }
  if (ok || window.SIM_UNLOCKED || /[?&]test/.test(location.search)) return;   // 암호로 잠근 파일은 이미 문구 암호를 거쳤으므로 Restart 묻지 않음
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
    msg.textContent = wait ? L2(`번호가 맞지 않습니다 · ${wait}초 뒤 Restart`, `Wrong code · retry in ${wait}s`) : L2('번호가 맞지 않습니다', 'Wrong code');
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
// ---- 임무 Site 미리 보기 (Menu 뒤 Camera) ----
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
// ---- 격납고 yaw 무대 (같은 렌더러로 그려 2D 캔버스에 복사) ----
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
//  지형·드론은 드론 Camera로 한 번만 그려 화면 텍스처에 담고, 헤드셋에는 어두운 방 + 큰 화면 + Menu만 그림.
//  (머리 움직임으로 세상이 흔들리지 않아 멀미가 적고, 장면을 두 번 그리지 않아 빠름)
//  모드 2: Left stick Climb·yaw / Right stick 전후·좌우   모드 1: Left stick 전후·yaw / Right stick Climb·좌우
//  오른쪽 트리거 Drop · 왼쪽 트리거 Boost · A 확인 · B Menu · X Light · Y 하부 Camera · Left stick 누르기 Camera · Right stick 누르기 열화상
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
// 머리 고정 화면: XR 이 머리 위치를 갱신한 직후(그리기 바로 전)에 따라 붙임 -> 흔들림 None
XR.headP = new V3(0, 1.6, 0); XR.headQ = new THREE.Quaternion();
VRS.onBeforeRender = () => { XR.headP.copy(camera.position); XR.headQ.copy(camera.quaternion); VR_HEAD.position.copy(camera.position); VR_HEAD.quaternion.copy(camera.quaternion); VR_HEAD.updateMatrixWorld(true); };
// XR 이 게임 Camera에 머리 위치를 덮어쓰므로, 그린 뒤 드론 Camera 위치로 되돌림
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
  let sess; try { sess = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] }); } catch (e) { XR.pending = null; vrOverlay(L2('VR을 시작할 수 없습니다. Restart 눌러 주세요.', 'Could not start VR. Please try again.')); return; }
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
  XR.recenter = 2;   // 첫 프레임들에서 머리 위치가 잡히면 화면·Menu 위치를 Restart 맞춤
  last = performance.now();
  renderer.setAnimationLoop((t, f) => { if (f) frame(performance.now()); });
}
function vrStop() { XR.userExit = true; if (XR.sess) try { XR.sess.end(); } catch (e) { } }
function vrEnded() {
  renderer.setAnimationLoop(null); XR_ON = false; XR.sess = null; renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = true;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  last = performance.now(); if (!TEST) requestAnimationFrame(frame);
  if (XR.afterExit === 'video') {   // VR Menu에서 '영상 저장': 2D 화면에서 Replay를 재생하며 녹화
    XR.afterExit = null; $('vrBack').classList.add('hidden'); S.cam = CAMS.indexOf(SET.vrCam === 'chase' ? 'CHASE' : 'FPV');
    exportReplayVideo(LAST_REC, ok => { toMenu(); vrOverlay(ok ? L2('영상을 저장했습니다. 다운로드 폴더(파일 앱)에서 볼 수 있습니다.', 'Video saved to your Downloads folder.') : L2('영상을 만들지 못했습니다.', 'Could not create the video.'), L2('VR 시작', 'Start VR')); });
    return;
  }
  if (XR.userExit && (S.state === 'run' || S.state === 'demo' || S.state === 'pause')) toMenu(); else if (S.state === 'run' || S.state === 'demo') togglePause();
  vrOverlay(XR.userExit ? '' : L2('VR이 멈췄습니다. 버튼을 누르면 하던 FLIGHT을 이어 갑니다.', 'VR was interrupted. Press the button to continue your flight.'), XR.userExit ? L2('VR 시작', 'Start VR') : L2('Back to VR', 'Back to VR'));
}
function vrOverlay(msg, btn) {   // VR 판 2D 화면: Menu(3단계 코스 화면) 위에 안내 줄
  const o = $('vrBack'); if (o) o.classList.add('hidden');
  ui.pause.classList.add('hidden'); ui.menu.classList.remove('hidden'); if (MENU.step < 3) wizGo(3);
  const n = $('vrNote'), r = $('vrResume'), paused = S.state === 'pause';
  if (n) { n.classList.toggle('hidden', !msg); $('vrNoteT').textContent = msg || ''; }
  if (r) { r.classList.toggle('hidden', !paused); r.onclick = () => vrStart(); }
}
// three r149: Quest 브라우저에서 XRFrame.detectedPlanes 를 읽으면 (평면 인식을 안 켰을 때) 오류가 남 -> 오류 대신 'None'
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
// VR 스틱 모드: 쿼드·고정익 따로 기억 (고정익 기본 = 모드 1: Right stick 위아래가 스로틀)
function vrStickMode() { return AFc().cls === 'wing' ? (SET.vrModeW || 1) : (SET.vrMode || 2); }
function xrInput(dt) {
  const { L: Lg, R: Rg } = xrPads();
  const ax = (g, i) => (g && g.axes && g.axes.length > i ? g.axes[i] || 0 : 0), bt = (g, i) => !!(g && g.buttons && g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
  const edge = (k, on) => { const e = on && !XR.prev[k]; XR.prev[k] = on; return e; };
  const rt = edge('rt', bt(Rg, 0)), lt = edge('lt', bt(Lg, 0)), A = edge('a', bt(Rg, 4)), B = edge('b', bt(Rg, 5)), X = edge('x', bt(Lg, 4)), Y = edge('y', bt(Lg, 5)), LS = edge('ls', bt(Lg, 3)), RS = edge('rs', bt(Rg, 3));
  if ((rt || lt || A || B) && AU.ctx && AU.ctx.state !== 'running') try { AU.ctx.resume(); } catch (e) { }
  if (XR.menu) { if (rt || A) vrMenuClick('right'); if (lt) vrMenuClick('left'); if (B && S.state === 'pause') vrResume(); return; }
  if (S.state === 'replay') {   // Replay: A 재생·멈춤 · Right stick 좌우 5초 · Y 속도 · Left stick 누르기 Camera · B Menu
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
  if (Lg && Lg.buttons[0] && Lg.buttons[0].value > 0.4 && SET.diff !== 'atti') IN.boost = true;
  if (rt) pressed.push('Space');
  if (A) { if (S.state === 'result') startRun(S.kind); else pressed.push('Enter'); }   // 산불·수색 중에는 A = 사진
  if (B) vrMenuOpen();
  if (Y) { const L = [0, 90, 60, 45]; SET.vrPip = L[(L.indexOf(SET.vrPip | 0) + 1) % L.length]; saveSet(); showMsg(SET.vrPip ? L2('하부 Camera ', 'Lower camera ') + SET.vrPip + '°' : L2('하부 Camera Off', 'Lower camera off'), '#ffc828', 1); }
  if (LS) { SET.vrCam = SET.vrCam === 'chase' ? 'fpv' : 'chase'; saveSet(); vrApplyCam(); showMsg(SET.vrCam === 'chase' ? L2('뒤에서 추적', 'Chase view') : 'FPV', '#4fe3ff', 1); }
  if (RS) irSet(!ENV.ir);
  if (X) pressed.push('KeyL');   // Light 켜기/끄기
}
// 머리 방향 모드: 고개를 돌린 쪽으로 기체가 돌고, Left stick 앞뒤 = 속도, 고개를 들거나 숙이면 그쪽으로 오르내림
// Right stick: 좌우 = 옆으로, 위아래 = 고도 (직접), Left stick 좌우 = 몸을 돌리지 않고 yaw
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
  if (DR.landed) thr = Math.max(thr, spd);                                   // 땅에서는 Left stick 위 = Takeoff
  else if (spd > 0) thr = clamp(thr + spd * Math.tan(tilt) * 2.2, -1, 1);   // 보는 쪽(위·아래)으로 날아감
  return { thr, yaw: Math.abs(dh) < 1.5 * DEG ? 0 : clamp(dh * 2.4, -1, 1), pitch: DR.landed ? 0 : spd, roll: shape(rx, 0.1) };
}
// ---- VR 안 Menu ----
const VR_MS = () => [['course', L2('장애물 코스', 'Obstacle course')], ['forest', L2('숲길 통과', 'Forest trail')], ['race', L2('타임 레이스', 'Time race')], ['ridge', L2('능선 종주', 'Ridge run')], ['free', L2('Free Flight', 'Free flight')], ['demo', L2('Watch Reference Flight', 'Reference flight')]];
const VR_AF = ['x2d', 'anafi', 'fpv', 'kfpv'], VR_AFW = ['fw', 'puma', 'kfw'];
const VR_MS2 = () => [['recon', L2('정찰', 'Recon')], ['track', L2('차량 추적', 'Vehicle track')], ['fire', L2('산불 감시', 'Wildfire watch')], ['sar', L2('수색·구조', 'Search & rescue')], ['strike', L2('타격', 'Strike')]];
function vrMenuOpen() {   // FLIGHT 중이면 멈춰 두고(Resume하기 가능) · 결과·Replay 상태는 그대로 (임무는 웹 화면에서 고름)
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
  { const kn = MS_NAME[lk] || ({ course: L2('장애물 코스', 'Obstacle course'), free: L2('Free Flight', 'Free flight'), demo: L2('Reference', 'Reference flight') })[lk] || lk; g.fillStyle = '#e8eef2'; g.font = '700 26px system-ui, sans-serif'; g.fillText(L2('현재 임무: ', 'Mission: ') + kn + ' · ' + AFc().name + ' · ' + pilotName(), 36, 106); y = 150;
    if (ORDER.m) { const t = (window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en; g.font = '500 21px system-ui, sans-serif'; const ws = String(t).split(' '), L = []; let ln = ''; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 880 && ln) { L.push(ln); ln = w; } else ln = tl; } if (ln) L.push(ln);
      g.fillStyle = '#ffc828'; g.fillText('📻', 36, 144); g.fillStyle = '#cfd6da'; L.slice(0, 2).forEach((l, i) => g.fillText(l, 76, 144 + i * 28)); y = 150 + Math.min(2, L.length) * 28 + 14; } }
  if (done) { btn('restart', 36, y, 300, 80, '↺ ' + L2('같은 임무 Restart', 'Fly it again'), false, false, true); btn('replay', 348, y, 310, 80, L2('이번 FLIGHT Replay', 'Replay this flight'), false, !hasRec); btn('video', 670, y, 318, 80, '⬇ ' + L2('영상 저장', 'Save video'), false, !hasRec); y += 96; }
  if (paused) {
    const kn = (MS_NAME[S.kind] || ({ course: L2('장애물 코스', 'Obstacle course'), free: L2('Free Flight', 'Free flight'), demo: L2('Reference', 'Reference flight') })[S.kind] || S.kind);
    btn('resume', 36, y, 300, 80, '▶ ' + L2('Resume하기', 'Resume'), false, false, true); btn('restart', 348, y, 310, 80, '↺ ' + L2('Restart', 'Restart'), false); btn('replay', 670, y, 318, 80, L2('지금까지 Replay', 'Replay so far'), false, !hasRec); y += 96;
  }
  g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '500 18px system-ui, sans-serif'; g.fillText(L2('다른 임무·기체는 ⏹ 임무 끝내기 → 웹 화면에서 고르기', 'Other missions or drones: ⏹ End mission → choose on the web page'), 36, y); y += 36;
  const RH = 60, RW = 50, row = (yy, lbl) => { g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '600 22px system-ui, sans-serif'; g.fillText(lbl, 36, yy + 14); };
  const afN = id => ({ x2d: 'Skydio X2D', anafi: 'ANAFI', fpv: L2('FPV racer', 'FPV racer'), kfpv: L2('Kamikaze FPV', 'Kamikaze FPV'), fw: 'RQ-11 Raven', puma: 'RQ-20 Puma', kfw: L2('Loitering fixed-wing', 'Loitering wing') })[id];
  row(y, L2('FLIGHT 모드', 'Flight mode')); [['train', L2('Training', 'Training')], ['easy', L2('Easy (P)', 'Easy (P)')], ['atti', 'ATTI'], ['sport', L2('Sport', 'Sport')]].forEach(([v, n], i) => btn('diff:' + v, 190 + i * 200, y, 188, RW, n, SET.diff === v)); y += RH;
  row(y, L2('스틱', 'Sticks')); [[2, L2('모드 2', 'Mode 2')], [1, L2('모드 1', 'Mode 1')], [3, L2('머리 방향', 'Head steer')]].forEach(([v, n], i) => btn('mode:' + v, 190 + i * 200, y, 188, RW, n, vrStickMode() === v)); y += RH;
  row(y, L2('Camera', 'Camera')); [['fpv', 'FPV', SET.vrCam !== 'chase'], ['c0', L2('추적 멀리', 'Chase far'), SET.vrCam === 'chase' && (SET.zoom | 0) === 0], ['c1', L2('추적 보통', 'Chase mid'), SET.vrCam === 'chase' && (SET.zoom | 0) === 1], ['c2', L2('추적 가까이', 'Chase near'), SET.vrCam === 'chase' && (SET.zoom | 0) === 2]].forEach(([v, n, on], i) => btn('cam:' + v, 190 + i * 200, y, 188, RW, n, on)); y += RH;
  row(y, L2('하부 Camera', 'Lower cam')); [[0, L2('Off', 'Off')], [90, '90°'], [60, '60°'], [45, '45°']].forEach(([v, n], i) => btn('pip:' + v, 190 + i * 200, y, 188, RW, n, (SET.vrPip | 0) === v)); y += RH;
  row(y, L2('시간대', 'Time')); [['day', L2('낮', 'Day'), SET.tod === 'day' && !ENV.ir], ['dusk', L2('Dusk', 'Dusk'), SET.tod === 'dusk' && !ENV.ir], ['night', L2('밤', 'Night'), SET.tod === 'night' && !ENV.ir], ['ir', L2('열화상', 'Thermal'), !!ENV.ir]].forEach(([v, n, on], i) => btn('env:' + v, 190 + i * 200, y, 188, RW, n, on)); y += RH;
  row(y, L2('날씨', 'Weather')); [['clear', L2('Clear', 'Clear')], ['rain', L2('비', 'Rain')], ['snow', L2('눈', 'Snow')]].forEach(([v, n], i) => btn('wx:' + v, 190 + i * 200, y, 188, RW, n, (SET.wx || 'clear') === v)); btn('wxfx', 790, y, 188, RW, L2('기상 영향 ', 'Effects ') + (SET.wxFx ? L2('On', 'on') : L2('Off', 'off')), !!SET.wxFx); y += RH;
  row(y, L2('표시', 'Display')); btn('scr:head', 190, y, 188, RW, L2('고글 화면', 'Goggles'), SET.vrScreen !== 'space'); btn('scr:space', 390, y, 188, RW, L2('공간 화면', 'Fixed screen'), SET.vrScreen === 'space');
  btn('map', 590, y, 188, RW, SET.vrMap === false ? L2('지도 Off', 'Map off') : MAPZ.on ? L2('지도 전체', 'Map: all') : L2('지도', 'Map'), SET.vrMap !== false); btn('guide', 790, y, 188, RW, L2('경로 안내', 'Guide'), !!SET.guide); y += RH;
  row(y, L2('스틱 반응', 'Stick feel')); [['real', L2('실기체 (선형)', 'Real (linear)')], ['soft', L2('부드럽게 (엑스포)', 'Soft (expo)')]].forEach(([v, n], i) => btn('expo:' + v, 190 + i * 200, y, 188, RW, n, stickExpo(true) === v)); y += RH;
  row(y, L2('계기', 'Instruments')); [['auto', L2('자동', 'Auto')], ['fpv', L2('간단 (FPV)', 'Simple (FPV)')], ['uas', L2('항공 (UAS)', 'Aviation (UAS)')]].forEach(([v, n], i) => btn('hud:' + v, 190 + i * 200, y, 188, RW, n + (v === 'auto' ? ' · ' + (hudMode() === 'uas' ? 'UAS' : 'FPV') : ''), (SET.hud || 'auto') === v)); y += RH + 4;
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '500 19px system-ui, sans-serif';
  g.fillText((AFc().cls === 'wing' ? L2('[고정익] ', '[Fixed-wing] ') : '') + (vrStickMode() === 3 ? L2('머리 방향: 보는 쪽으로 FLIGHT · Left stick 앞뒤 속도 · Right stick 옆·고도', 'Head steer: fly where you look · L-stick fwd/back speed · R-stick side·height') : vrStickMode() === 2 ? L2('모드 2: Left stick Climb·yaw / Right stick 전후·좌우', 'Mode 2: left stick climb·yaw / right stick fwd·side') : L2('모드 1: Left stick 전후·yaw / Right stick Climb·좌우', 'Mode 1: left stick fwd·yaw / right stick climb·side')), 36, y);
  g.fillText(L2('R트리거 Drop · L트리거 Boost · A 확인·사진 보고 · B Menu/Resume', 'R-trigger drop · L-trigger boost · A ok/photo report · B menu/resume'), 36, y + 26);
  g.fillText(L2('X Light · Y 하부 Camera · Left stick 누르기 Camera · Right stick 누르기 열화상', 'X light · Y lower cam · L-stick click camera · R-stick click thermal'), 36, y + 52);
  const vi = voiceInfo(), eng = commEngine(), au = AU.ctx ? AU.ctx.state : L2('None', 'none');
  g.fillStyle = eng === 'none' ? 'rgba(255,154,122,.95)' : 'rgba(93,255,154,.85)';
  g.fillText(L2('무전 음성: ', 'Radio voice: ') + (eng === 'natural' ? L2('자연 음성', 'natural voice') + (COMM.rvOk ? '' : '') : eng === 'synth' ? L2('내장 합성기', 'built-in synthesizer') + (TTSW.w ? '' : L2(' (불러오는 중)', ' (loading)')) : eng === 'web' ? vi.name : L2('None · 자막만', 'none · subtitles only')) + (COMM.fbOk || COMM.rvOk ? ' ✓' : '') + L2(' · 오디오 ', ' · audio ') + au + (COMM.fbErr ? ' · ' + String(COMM.fbErr).slice(0, 40) : ''), 36, y + 78);
  btn('vtest', 36, H2 - 76, 300, 56, L2('🔊 음성 테스트', '🔊 Voice test'), false);
  btn('exit', W2 - 380, H2 - 76, 344, 56, '⏹ ' + L2('임무 끝내기 · 웹 menu', 'End mission · web menu'), false);
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
  if (id === 'map') { if (SET.vrMap === false) { SET.vrMap = true; mapZoom(false); } else if (!MAPZ.on) mapZoom(true); else { mapZoom(false); SET.vrMap = false; } saveSet(); return; }   // 지도 → 전체 → Off
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
      const L = [[L2('Total', 'Total'), `${fmt(R.total)}  (${L2('FLIGHT', 'flight')} ${fmt(S.t)} + ${L2('Penalty', 'pen')} ${S.pen.toFixed(0)} s · ${L2('기준', 'par')} ${fmt(R.par || 0)})`], [L2('점수', 'Score'), `${L2('과제', 'tasks')} ${R.a}/55 · ${L2('시간', 'time')} ${R.b}/30 · ${L2('안전', 'safety')} ${R.c}/15`],
        [L2('과제', 'Tasks'), `${R.ok} / ${R.n}`], [L2('Zoom · 최고 속도', 'Distance · top speed'), `${DBF.dist.toFixed(0)} m · ${(DBF.vmax * 3.6).toFixed(0)} km/h`], [L2('Impacts · 재출발', 'Impacts · restarts'), `${S.impacts || 0} · ${DBF.resp}`]];
      if (DBF.pens.length) L.push([L2('Penalty 내역', 'Penalties'), DBF.pens.slice(0, 3).map(p => `+${p.d.toFixed(0)} ${String(p.why || '').split(' ')[0]}`).join(' · ') + (DBF.pens.length > 3 ? ' …' : '')]);
      L.forEach(([a, b], i) => { sh(a, 170, 196 + i * 40, 24, '#9fb0b8'); sh(b, 470, 196 + i * 40, 24, '#fff'); }); }
    ph.forEach((p, i) => { if (!p.im) { p.im = new Image(); p.im.src = p.url; } if (p.im.complete) g.drawImage(p.im, 170 + i * 236, 470, 220, 124); });
    sh(L2('A Restart · B Menu', 'A again · B menu'), W2 / 2, 612, 28, '#ffc828', 'center'); tex.needsUpdate = true; return; }
  if (S.state === 'pause') { box([[L2('일시 Pause', 'PAUSED'), 44, '#ffc828'], [L2('B: Menu', 'B: menu'), 30, '#e8eef2']], '#ffc828'); tex.needsUpdate = true; return; }
  if (S.state === 'menu') { tex.needsUpdate = true; return; }
  if (S.state === 'replay' && RP.rec) { const s0 = RP.rec.s[0][0], e0 = RP.rec.s[RP.rec.s.length - 1][0]; sh(`REPLAY  ${fmt(RP.t - s0)} / ${fmt(e0 - s0)}  ×${RP.speed}${RP.playing ? '' : '  ❚❚'}`, W2 / 2, 22, 40, '#4fe3ff', 'center');
    sh(L2('A 재생·멈춤 · right stick ←→ 5초 · Y 속도 · Left stick 누르기 Camera · B Menu', 'A play/pause · R-stick ←→ 5 s · Y speed · L-stick click camera · B menu'), W2 / 2, H2 - 60, 26, '#e8eef2', 'center'); }
  const sb = S.state === 'demo' ? ghostS : S.state === 'replay' ? RP.pose : DR, gh = groundAt(sb.p.x, sb.p.z), sp = sb.v ? sb.v.length() : 0;
  // 화면 좌표: 게임 Camera(드론 Camera·추적 Camera)로 3D 점을 투영
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
    else if (!UAS) { const an0 = Math.atan2(y, x), ex = Math.cos(an0) * 0.55, ey = Math.sin(an0) * 0.58, px = (ex + 1) / 2 * W2, py = (1 - ey) / 2 * H2, an = Math.atan2(-ey, ex);   // 안쪽 타원 위 (하부 Camera·지도와 안 겹치게)
      g.save(); g.translate(px, py); g.rotate(an); g.fillStyle = '#ffc828'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(34, 0); g.lineTo(-14, -24); g.lineTo(-4, 0); g.lineTo(-14, 24); g.closePath(); g.stroke(); g.fill(); g.restore();
      sh(Math.round(dist) + ' m', px - Math.cos(an) * 60, py - Math.sin(an) * 60 - 14, 28, '#ffc828', 'center'); } }
  // 큰 숫자 계기
  // 계기는 화면 가운데 가까이 (시선을 조금만 옮겨 보이게): 왼쪽 = 속도, 오른쪽 = 고도·Climb률, 위 = 시간·목표·방위
  // 계기는 지도 둘레에 모음: 지도 위 = 고도·Climb률·Drop물, 지도 왼쪽 아래 = 속도 / 위쪽 가운데 = 시간·목표·방위
  const CX = W2 / 2, MX = W2 - 250, MYT = H2 - 330 - 34, MXR = MX + 198;
  if (S.state !== 'replay') sh(fmt(S.t || 0), CX, 26, 34, '#fff', 'center');
  if (!UAS) { sh(`${Math.round(sp * 3.6)}`, MX - 16, H2 - 150, 50, '#fff', 'right'); sh('km/h', MX - 16, H2 - 96, 22, '#cfd6da', 'right');
  sh(`${(sb.p.y - gh).toFixed(1)}`, MX, MYT - 150, 48, '#fff', 'left'); sh(L2('m 고도', 'm AGL'), MXR, MYT - 132, 22, '#cfd6da', 'right'); }
  const vs = sb.v ? sb.v.y : 0; if (!UAS) sh((vs > 0.15 ? '▲ ' : vs < -0.15 ? '▼ ' : '■ ') + Math.abs(vs).toFixed(1) + ' m/s', MX, MYT - 92, 24, Math.abs(vs) > 3 ? '#ff9a40' : '#e8eef2', 'left');
  if (!UAS) { const hdg = ((((SITE.brg || 0) + (sb.h || 0) * 180 / Math.PI) % 360) + 360) % 360; sh(String(Math.round(hdg)).padStart(3, '0') + '°', CX, 124, 30, '#e8eef2', 'center'); }
  if (o && S.state !== 'replay') sh('▸ ' + (o.label || MS_NAME[S.kind] || ''), CX, 70, 40, '#ffc828', 'center');
  if (S.state === 'demo') sh(L2('Reference', 'REFERENCE FLIGHT'), CX, 70, 38, '#4fe3ff', 'center');
  if (ENV.ir) sh('IR', MX - 16, H2 - 196, 28, '#ff9a40', 'right');
  { const n = S.kind === 'course' ? S.payloads || 0 : S.kind === 'sar' ? S.kits | 0 : S.kind === 'free' && AFc().drop ? droneM.cans.filter(c => c.visible).length : -1; if (S.state === 'run' && actionKind() === 'report') sh('📷 ' + L2('R트리거 · A = 사진 보고', 'R-trigger · A = report'), W2 - 250, H2 - 330 - 34 - 56, 22, '#5dff9a', 'left'); else if (n >= 0 && S.state === 'run') sh((S.kind === 'sar' ? 'KIT ' : 'M84 ') + ('●'.repeat(n) || '—'), W2 - 250, H2 - 330 - 34 - 56, 24, '#ffc828', 'left'); }
  if (SET.vrPip) sh(L2('하부 ', 'LOWER ') + SET.vrPip + '°', 26, H2 - 282, 22, '#ffc828');   // 글자 위쪽 기준 · 하부 Camera 창(위쪽 끝 y≈471) 위로 띄워서 가리지 않게
  if (PH.last && PH.lastT > 0 && PH.last.complete) { g.globalAlpha = Math.min(1, PH.lastT); g.drawImage(PH.last, 40, 150, 288, 162); g.strokeStyle = PH.lastOk ? '#5dff9a' : '#ff9a40'; g.lineWidth = 4; g.strokeRect(40, 150, 288, 162); g.globalAlpha = 1; }
  if (false && ORDER.m) { const t = (window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en; g.font = '600 22px system-ui, sans-serif'; const ws = String(t).split(' '), L = []; let ln = ''; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 400 && ln) { L.push(ln); ln = w; } else ln = tl; } if (ln) L.push(ln); const LL = L.slice(0, 4), oy = 330;
    g.fillStyle = 'rgba(6,10,14,.55)'; g.fillRect(30, oy - 8, 430, 38 + LL.length * 28); g.fillStyle = '#ffc828'; g.fillRect(30, oy - 8, 4, 38 + LL.length * 28); sh(L2('📻 명령', '📻 ORDERS'), 44, oy, 20, '#ffc828'); LL.forEach((l, i) => sh(l, 44, oy + 28 + i * 28, 22, '#e8eef2')); }
  const r = $('radio'); if (r && r.classList.contains('show')) { const t = r.querySelector('.re') ? r.querySelector('.re').textContent : r.textContent; g.font = '600 28px system-ui, sans-serif'; const ws = t.split(' '); let ln = ''; const L = []; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 680 && ln) { L.push(ln); ln = w; } else ln = tl; } if (ln) L.push(ln); L.slice(-2).forEach((l, i) => sh(l, W2 / 2 - (UAS ? 0 : 70), (UAS ? 116 : H2 - 112) + i * 36, 28, '#9fe9ff', 'center')); }
  const m = $('objMsg'); if (m && m.classList.contains('show') && m.textContent.trim()) sh(m.textContent.trim(), W2 / 2, H2 / 2 + 90, 44, m.style.color || '#5dff9a', 'center');
  // 등고선 지도 (PC 화면처럼 오른쪽 아래, 가운데 쪽으로 당겨 둠)
  if (SET.vrMap !== false && ui.map) { const mw = 198, mh = 330, mx = W2 - 250, my = H2 - mh - 34; g.globalAlpha = 0.92; g.fillStyle = 'rgba(6,10,14,.75)'; g.fillRect(mx - 4, my - 4, mw + 8, mh + 8); g.filter = 'brightness(1.6) contrast(1.15)'; g.drawImage(ui.map, mx, my, mw, mh); g.filter = 'none'; g.globalAlpha = 1; g.strokeStyle = 'rgba(255,200,40,.8)'; g.lineWidth = 2; g.strokeRect(mx - 4, my - 4, mw + 8, mh + 8); }
  // 경로 안내 문구 (예: Descend 3.2 m (left stick ↓))
  if (SET.guide) { const ge = $('guide'); if (ge && !ge.classList.contains('hidden')) { const L = [...ge.children].map(e => [e.textContent, e.className]).filter(x => x[0]).slice(0, 3); L.forEach(([t, c], i) => sh(t, W2 / 2 - (UAS ? 0 : 70), (UAS ? 196 : H2 - 200) + i * 38, 30, c === 'ok' ? '#5dff9a' : c === 'warn' ? '#ff9a40' : '#4fe3ff', 'center')); } }
  if (SET.vrCam !== 'chase' && !UAS) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(W2 / 2 - 22, H2 / 2); g.lineTo(W2 / 2 - 7, H2 / 2); g.moveTo(W2 / 2 + 7, H2 / 2); g.lineTo(W2 / 2 + 22, H2 / 2); g.moveTo(W2 / 2, H2 / 2 + 7); g.lineTo(W2 / 2, H2 / 2 + 16); g.stroke(); }
  g.textAlign = 'left'; tex.needsUpdate = true;
}
// ---- 매 프레임 (그리기 직전): 드론 Camera 영상을 화면 텍스처로 ----
function xrTick(dt) {
  XR.frames++;
  if (S.state === 'menu' && !XR.menu) vrMenuOpen();
  if (XR.recenter > 0 && XR.headP.y > 0.3 && XR.frames > 2) { XR.recenter--; if (SET.vrScreen === 'space') vrRecenter(); XR.menuPlace = true; }
  // Menu 판: 열 때 눈앞 1.5 m (화면보다 앞)
  VR_MENU.m.visible = XR.menu;
  if (XR.menu) {
    if (XR.menuPlace) { XR.menuPlace = false; const H = XR.headP, fw = new V3(0, 0, -1).applyQuaternion(XR.headQ), yaw = Math.atan2(-fw.x, -fw.z); VR_MENU.m.position.set(H.x - Math.sin(yaw) * 1.5, H.y - 0.15, H.z - Math.cos(yaw) * 1.5); VR_MENU.m.rotation.set(0, yaw, 0); VR_MENU.m.updateMatrixWorld(true); }
    let hv = null; for (const c of XR.ctl) { const r = vrMenuHit(c); if (r && r.b) hv = r.b.id; }
    if (hv !== XR.hover || (XR.mT -= dt) <= 0) { XR.hover = hv; XR.mT = 0.3; vrMenuDraw(); }
  }
  XR.ctl.forEach(c => c.userData.ln.visible = !!c.userData.hand && (XR.menu || S.state === 'result'));
  VR_SCR.visible = true;
  // 지형 장면을 드론 Camera(게임 Camera)로 화면 텍스처에 그림
  renderer.shadowMap.autoUpdate = false; if (XR.frames % 2 === 0) renderer.shadowMap.needsUpdate = true;   // 그림자는 2프레임에 한 번
  camera.aspect = 16 / 9; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  XR.osdT -= dt; if (XR.osdT <= 0) { XR.osdT = 0.1; vrOsdDraw(); }
  const cur = renderer.getRenderTarget(); renderer.xr.enabled = false;
  renderer.setRenderTarget(VR_RT); renderer.clear(); renderer.render(scene, camera);
  // 하부 Camera (각도 고정, 기체 진행 방향 기준)
  const pipOn = (SET.vrPip | 0) > 0 && !XR.menu && S.state !== 'result'; VR_PIP.m.visible = pipOn;
  if (pipOn && XR.frames % 2 === 0) { const sb = S.state === 'demo' ? ghostS : DR, c = VR_PIP.cam, dv = droneM.g.visible; droneM.g.visible = false;
    c.position.copy(sb.p).add(new V3(0, -0.12, 0)); c.rotation.set(-(SET.vrPip | 0) * DEG, -sb.h, 0, 'YXZ'); c.updateMatrixWorld();
    const sa = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(VR_PIP.rt); renderer.clear(); renderer.render(scene, c); renderer.shadowMap.autoUpdate = sa; droneM.g.visible = dv; }
  renderer.setRenderTarget(cur); renderer.xr.enabled = true;
  (XR.camP = XR.camP || new V3()).copy(camera.position); (XR.camQ = XR.camQ || new THREE.Quaternion()).copy(camera.quaternion);
}
// ---- Replay를 영상(WebM/MP4)으로 저장 (PC Replay 막대·VR Menu) ----
const VID = { mr: null, chunks: [], on: false, stopping: false, rec: null, done: null };
function vidMime() { for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { } return ''; }
function vidTag(t) { let e = $('vidTag'); if (!e) { e = document.createElement('div'); e.id = 'vidTag'; e.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:70;padding:8px 16px;border-radius:20px;background:rgba(10,13,16,.85);color:#fff;font:600 15px system-ui,sans-serif;border:1px solid #ff5050'; document.body.appendChild(e); } e.style.display = t ? '' : 'none'; if (t) e.textContent = t; }
function exportReplayVideo(rec, onDone) {
  if (VID.on) return;
  if (!rec || !rec.s || rec.s.length < 2) { showMsg(L2('저장할 FLIGHT 기록이 없습니다', 'No flight to save'), '#ff6060', 1.5); if (onDone) onDone(false); return; }
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
  // 한 파일판: 훈련장 고르기 버튼 (고르면 Restart 불러옴) · PC 판 링크 숨김
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
// ---- 옵션 사용성: 탭 · 고른 값 설명 · 코스 화면의 빠른 SETTINGS ----
(function optUX() {
  const P = $('optPanel'); if (!P || !$('optTabs')) return;
  const H = {
    segDiff: { train: ['느리고, 스틱을 놓으면 멈추고, 다음 과제 쪽으로 방향을 잡아 줍니다 · 처음 FLIGHT에', 'Slow, stops when you let go, turns toward the next task · for first flights'], easy: ['고도를 유지하고 약하게 assist합니다', 'Holds altitude with light assistance'], atti: ['위치를 잡아 주지 않고 자세만 유지 · 바람에 밀리고 관성으로 미끄러짐 · 실기체 감각', 'Holds attitude only, not position · drifts with wind and momentum · like the real aircraft'], sport: ['assist None · 가장 빠르고 민감합니다', 'No assistance · fastest and most sensitive'] },
    segExpo: { real: ['스틱을 민 만큼 그대로 반응 · RC 조종기와 같은 느낌', 'Responds exactly to stick travel · feels like an RC transmitter'], soft: ['가운데 부근이 둔해서 미세 조종이 쉽습니다', 'Softer around centre for easy fine control'] },
    segAssist: { 1: ['자세·고도를 잡아 줍니다 (H 키로 켜기/끄기)', 'Steadies attitude and altitude (H toggles)'], 0: ['assist 없이 직접 조종합니다', 'You fly without assistance'] },
    segGuide: { 1: ['다음 과제 쪽 화살표를 보여 줍니다', 'Shows an arrow toward the next task'], 0: ['화살표 없이 지도와 무전만으로 찾아갑니다', 'No arrow · navigate by map and radio'] },
    segAcro: { 0: ['스틱을 놓으면 기체가 수평으로 돌아옵니다', 'The aircraft levels out when you let go'], 1: ['기울어진 채로 유지되는 완전 수동 · 숙련자용', 'Fully manual, stays banked · for experienced pilots'] },
    segTime: { 0: ['밝은 낮 · 가장 잘 보입니다', 'Daylight · best visibility'], 2: ['해가 낮아 그림자가 길고 역광이 생깁니다', 'Low sun, long shadows and glare'], 1: ['어두움 · IR Camera와 Light이 중요합니다', 'Dark · IR camera and lights matter'] },
    segWx: { clear: ['비·눈을 고르면 시야가 줄고 산불 감시는 쉽니다', 'Rain or snow cuts visibility and stops fire watch'], rain: ['빗줄기·안개로 시야가 줄어듭니다 · 산불 감시 불가', 'Rain and fog cut visibility · no fire watch'], snow: ['땅과 나무가 눈에 덮입니다 · 산불 감시 불가', 'Ground and trees under snow · no fire watch'] },
    segWxFx: { 0: ['날씨는 보이기만 하고 FLIGHT에는 영향 None', 'Weather is visual only'], 1: ['돌풍이 불고 Camera·센서 시야가 떨어집니다', 'Gusts, and reduced camera and sensor range'] },
    segWind: { 0: ['바람 None', 'Calm'], 1: ['Pause FLIGHT이 조금씩 밀립니다', 'Hover drifts a little'], 2: ['제자리에서도 Resume 수정 조작이 필요합니다', 'Constant correction needed even in a hover'] },
    segHud: { auto: ['기체 종류에 맞춰 자동으로 고릅니다', 'Picked automatically for the airframe'], fpv: ['고도·속도 숫자 위주의 간단한 표시', 'Simple altitude and speed readouts'], uas: ['피치 사다리 · 속도·고도 테이프 · HSI 방위계', 'Pitch ladder, speed and altitude tapes, HSI'] },
    segBelly: { 1: ['Drop·선 때 아래 화면이 자동으로 뜹니다', 'Lower view appears automatically for drops and orbits'], 0: ['X 키를 눌렀을 때만 봅니다', 'Only when you press X'] },
    segFull: { 1: ['출격할 때 Full screen으로 바꿉니다', 'Switches to full screen at launch'], 0: ['창 크기 그대로 FLIGHT합니다', 'Stays in the window'] },
    segVoice: { 1: ['CONTROL(남)·EAGLE ONE(여) 영어 무전을 SOUND로 들려줍니다', 'Plays CONTROL (male) and EAGLE ONE (female) radio'], 0: ['무전은 글자로만 보입니다', 'Radio shown as text only'] },
    segMusic: { 1: ['Music On · 오른쪽 막대로 크기 조절', 'Music on · slider sets the level'], 0: ['Music Off', 'Music off'] },
    segKeys: { A: ['W/S climb·descend · A/D yaw · 방향키 move', 'W/S climb·descend · A/D yaw · arrows move'], B: ['방향키로 고도·yaw, WASD로 move', 'Arrows for altitude and yaw, WASD to move'], C: ['키를 하나씩 set manually합니다', 'Assign every key yourself'] },
  };
  const HW = { segDiff: {   // 고정익일 때 설명
    train: ['자동조종: 고도·속도 유지, 지형 피, 실속 보호 · 기울기 35°까지', 'Autopilot: holds height and speed, avoids terrain, stall protection · bank ≤35°'],
    easy: ['자동조종 + 최대 기울기 · 느릴 땐 실속 안 나게 기울기 제한', 'Autopilot with full bank · bank limited at low speed to prevent stall'],
    atti: ['자세 안정 수동: 놓으면 수평 · 스로틀 직접 · altitude hold·실속 보호 None', 'Stabilised manual: levels when released · direct throttle · no height hold or stall protection'],
    sport: ['완전 수동: 놓아도 기운 채 유지 · 실속·스핀 가능', 'Full manual: stays banked when released · stalls and spins possible'] } };
  const segV = id => { const b = $(id) && $(id).querySelector('button.on'); return b ? b.dataset.v : null; };
  const segT = id => { const b = $(id) && $(id).querySelector('button.on'); return b ? b.textContent.replace(/\s*\(.*\)\s*$/, '').trim() : '—'; };
  Object.keys(H).forEach(id => { const s = $(id); if (!s) return; const h = document.createElement('small'); h.className = 'oh'; h.dataset.for = id; s.parentNode.insertBefore(h, s.nextSibling); });
  // 빠른 SETTINGS (코스 고르는 화면)
  const QS = [['segDiff', '🎚', 'Difficulty', 'Mode'], ['segWind', '💨', '바람', 'Wind'], ['segWxFx', '⛈', '기상 영향', 'Weather fx'], ['segHud', '📟', '계기', 'HUD'], ['segGuide', '🧭', 'Guide', 'Guide'], ['segVoice', '🔊', '음성', 'Voice']];
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
  // ---- 건물: 민가(박공 지붕) · 가게(Flat붕 + 간판) · 창고 · 비닐하우스 ----
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
  // 멀리 있는 숲 조각은 그리지 않음 (VR 은 더 가까이서 Off)
  setInterval(() => { const cp = camera.position, lim = (XR_ON ? 650 : 1100) + CH * 0.7; for (const k of CK) k.grp.visible = Math.hypot(cp.x - k.c.x, cp.z - k.c.z) < lim; }, 400);
  // ---- Impacts: 나무(줄기+수관) · 건물(yaw 상자) ----
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
  // 코스 지도(미리 그려 둔 것)에 바깥 지역을 Restart 그려 넣음
  if (typeof MAP_CACHE !== 'undefined' && MAP_CACHE.course) { try { const kb = mapBg, kv = MAPV; mapBg = MAP_CACHE.course; MAPV = MAP_CACHE.course.V || MAPV; drawMapBg(); mapBg = kb; MAPV = kv; } catch (e) { } }
  return { lu, B, T, roads, vil, col };
})();
})();
