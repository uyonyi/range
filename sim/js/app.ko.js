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
function siteCurrentId() { try { return localStorage.getItem('fpvsim_site') || (window.SIM_SITES && window.SIM_SITES[0] ? window.SIM_SITES[0].id : 'flat'); } catch (e) { return 'flat'; } }
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
const SITE_L = SITE_PRE, SITE = SITE_L.site, SITE_KEY = SITE.flat ? '' : '@' + SITE.id;          // 현재 지형(현장)
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
if (TER.h) { scene.fog.near = 400; scene.fog.far = 9000; camera.far = 9000; camera.updateProjectionMatrix(); }
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GSZ, GSZ, 240, 240), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.set((GS0 + GS1) / 2, 0, -(GD0 + GD1) / 2);
ground.receiveShadow = true; scene.add(ground);
function terrainAt(x, z) {
  if (!TER.h) return 0;
  const fx = (x - GS0) / TER.step, fy = (GD1 + z) / TER.step;
  if (fx < 0 || fy < 0 || fx >= TER.n - 1 || fy >= TER.n - 1) return 0;
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
      f *= 0.75 + 0.25 * Math.sin(side * 0.05 + Math.cos(down * 0.043) * 2);
      col[i * 3] = 1 - f * 0.62; col[i * 3 + 1] = 1 - f * 0.42; col[i * 3 + 2] = 1 - f * 0.6;
    }
    ground.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); groundMat.vertexColors = true; groundMat.needsUpdate = true;
  }
}
if (TER.h) applyTerrain(TER.h);
// 원경 지형 (주변 12 km, 60 m 격자) — 고해상도 구역은 구멍으로 비움
const FAR = (function farTerrain() {
  if (!SITE_L.dec) return null;
  const G = TGRID, n = G.farN, H = SITE_L.dec.far, pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
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
    const f = Math.min(1, slope * 4.0); r = r * (1 - f) + 0.13 * f; g = g * (1 - f) + 0.20 * f; b = b * (1 - f) + 0.10 * f;
    col[i * 3] = Math.pow(r, 2.2); col[i * 3 + 1] = Math.pow(g, 2.2); col[i * 3 + 2] = Math.pow(b, 2.2);   // sRGB -> 선형
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = false; scene.add(m); return m;
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
    if (CRS_C) { const P = CRS_C.path, q = P[Math.floor(rr() * P.length)]; d = q[0] + (rr() - 0.5) * 120; s = q[1] + (rr() - 0.5) * 120; const pd = W(10, -5, 0); if (Math.hypot(s - pd.x, -d - pd.z) < 9) continue; }
    else if (d > -16 && d < 14 && s > -9 && s < 9) continue;          // 출발 구역(패드·로고) 제외
    const sc = 0.6 + rr() * 0.9;
    q.setFromAxisAngle(new V3(0, 1, 0), rr() * 6.28);
    m4.compose(W(d, s, 0), q, new V3(sc, sc * (0.6 + rr() * 0.9), sc)); im.setMatrixAt(i, m4);
    c.setHSL(0.13 + rr() * 0.08, 0.28 + rr() * 0.2, 0.17 + rr() * 0.12); im.setColorAt(i, c); i++;
  }
  im.receiveShadow = true; scene.add(im); return im;
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
if (CRS_C) { for (const [d, s] of CRS_C.cones) buildCone(W(d, s, 0)); }
else { buildLogoPanel(); buildFlag(); for (let d = 10; d <= 300; d += 15) for (const s of [-15, 15]) buildCone(W(d, s, 0)); }

// =====================================================================
//  drone model
// =====================================================================
function makeDrone(ghost) {
  const g = new THREE.Group();
  const gm = ghost ? new THREE.MeshBasicMaterial({ color: 0x55e6ff, transparent: true, opacity: 0.38, depthWrite: false }) : null;
  const m = c => gm || c;
  const carbon = m(mat(0x1d1f22, { roughness: 0.5 })), camo = m(mat(0xffffff, { map: TX.droneCamo })), mot = m(mat(0x9ea3a8, { roughness: 0.35, metalness: 0.7 }));
  const add = (geo, mt, x, y, z, sx, sy, sz) => { const me = new THREE.Mesh(geo, mt); me.position.set(x, y, z); if (sx) me.scale.set(sx, sy, sz); me.castShadow = !ghost; g.add(me); return me; };
  add(UBOX, camo, 0, 0.01, 0, 0.12, 0.055, 0.22);
  add(UBOX, carbon, 0, -0.025, 0, 0.16, 0.012, 0.26);
  for (const a of [45, 135, 225, 315]) {
    const r = a * DEG, me = add(UBOX, carbon, Math.sin(r) * 0.115, -0.02, -Math.cos(r) * 0.115, 0.03, 0.012, 0.23);
    me.rotation.y = -r;
  }
  const props = [];
  const pm = gm || new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const bladeM = m(mat(0x30343a, { roughness: 0.4 }));
  for (const [x, z] of [[0.163, -0.163], [-0.163, -0.163], [0.163, 0.163], [-0.163, 0.163]]) {
    add(UCYL, mot, x, -0.005, z, 0.022, 0.03, 0.022);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.115, 24), pm); disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.016, z); g.add(disc);
    const bl = add(UBOX, bladeM, x, 0.017, z, 0.23, 0.004, 0.018); props.push(bl);
  }
  add(UBOX, carbon, 0, 0.012, -0.125, 0.035, 0.035, 0.03);
  add(UCYL, m(mat(0x0c1a2a, { roughness: 0.1, metalness: 0.5 })), 0, 0.012, -0.142, 0.011, 0.01, 0.011).rotation.x = Math.PI / 2;
  add(UBOX, m(mat(0x2b8a4a)), -0.04, 0.045, 0.05, 0.04, 0.03, 0.06);
  for (const sx of [-1, 1]) add(UCYL6, carbon, sx * 0.04, 0.07, 0.1, 0.004, 0.07, 0.004).rotation.x = -0.4;
  add(UBOX, carbon, 0, -0.045, 0, 0.13, 0.008, 0.08);
  const cans = [];
  const canM = m(mat(0x7c8288, { roughness: 0.45, metalness: 0.5 }));
  for (const x of [-0.045, 0, 0.045]) { const c = add(UCYL, canM, x, -0.075, 0.0, 0.019, 0.12, 0.019); c.rotation.x = Math.PI / 2; cans.push(c); }
  const ledG = add(UBOX, gm || new THREE.MeshBasicMaterial({ color: 0x30ff60 }), 0.06, -0.02, 0.13, 0.012, 0.012, 0.012);
  const ledR = add(UBOX, gm || new THREE.MeshBasicMaterial({ color: 0xff3030 }), -0.06, -0.02, 0.13, 0.012, 0.012, 0.012);
  return { g, props, cans, leds: [ledG, ledR] };
}
const droneM = makeDrone(false); scene.add(droneM.g);
const ghostM = makeDrone(true); scene.add(ghostM.g); ghostM.g.visible = false;
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
function buildObjectives() {
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
  const ringHint = (pos) => { const me = new THREE.Mesh(ringGeo, hintMat()); me.material.opacity = 0.55; me.rotation.x = -Math.PI / 2; me.position.copy(pos).setY(groundAt(pos.x, pos.z) + 0.05); me.visible = false; scene.add(me); return me; };
  const iv = OBJ.ivan_grp1;
  OBJS.push({ kind: 'drop', target: 'ivan', label: 'DROP 1 · IVAN', hint: ringHint(iv.world(0, 0, 0)), mk: iv.world(0, 0, 4.2) });
  const mit = OBJ.mit;
  OBJS.push({ kind: 'drop', target: 'mit', label: 'DROP 2 · MIT (MOVING)', hint: ringHint(mit.world(0, 0, 0)), mk: mit.world(0, 0, 4.2), follow: true });
  const tk = OBJ.tank;
  const oh = new THREE.Mesh(new THREE.RingGeometry(11.3, 12.7, 96), hintMat()); oh.material.opacity = 0.35; oh.rotation.x = -Math.PI / 2;
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
  const pl = OBJ.pad_land; const lh = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 40), hintMat()); lh.material.opacity = 0.7;
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
//  background music (절차 생성: 신스 루프, 104 BPM)
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
function musicSchedule() {
  const ctx = AU.ctx; if (!ctx) return;
  const s16 = 60 / BPM / 4;
  while (MUS.next < ctx.currentTime + 0.15) {
    const t = MUS.next, st = MUS.step % 16, bar = Math.floor(MUS.step / 16) % 16, ch = CHORDS[bar % 4], full = bar >= 4;
    if (MUS.on && MUS.vol > 0) {
      if (st % 4 === 0) {   // 킥 + 사이드체인
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(g); g.connect(MUS.bus); o.start(t); o.stop(t + 0.3);
        MUS.duck.gain.setValueAtTime(0.3, t); MUS.duck.gain.linearRampToValueAtTime(1, t + s16 * 3);
      }
      if (st === 4 || st === 12) { noiseHit(t, 'bandpass', 1800, 0.8, 0.38, 0.17); noiseHit(t, 'highpass', 3000, 0, 0.12, 0.09); }   // 클랩
      noiseHit(t, 'highpass', 8000, 0, st % 4 === 2 ? 0.1 : (st % 2 ? 0.035 : 0.055), st % 4 === 2 ? 0.14 : 0.035);                 // 하이햇 16분
      if (st % 4 !== 0) note('sawtooth', mf(ch[0] - 12 + (st % 4 === 2 ? 12 : 0)), t, s16 * 0.9, 0.16, 650, MUS.duck);            // 굴러가는 베이스
      if (st === 0) for (const n of ch[1]) note('sawtooth', mf(n), t, s16 * 15, 0.022, 1500, MUS.duck, 0.12);                     // 패드
      if (full) { const ar = ch[1].concat(ch[1].map(n => n + 12)); note('square', mf(ar[(st + bar) % ar.length] + 12), t, s16 * 0.8, 0.026, 3200, MUS.duck); }   // 16분 아르페지오
      if (bar >= 8 && st % 2 === 0) { const n = HOOK[bar % 4][st / 2]; if (n) { const o1 = note('sawtooth', mf(n), t, s16 * 1.9, 0.045, 3600); note('square', mf(n) * 1.004, t, s16 * 1.9, 0.03, 3000, MUS.dly); } }   // 리드 훅
      if ((bar === 7 || bar === 15) && st === 0) { const f = noiseHit(t, 'highpass', 400, 0, 0.06, s16 * 16); f.frequency.exponentialRampToValueAtTime(9000, t + s16 * 16); }   // 상승음
      if ((bar === 7 || bar === 15) && st >= 12) noiseHit(t, 'bandpass', 1900, 0.8, 0.22 + (st - 12) * 0.05, 0.1);                 // 필인
      if ((bar === 0 || bar === 8) && st === 0) noiseHit(t, 'highpass', 5000, 0, 0.18, 1.6);                                       // 크래시
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
const KB_RESERVED = ['Escape', 'Enter', 'Tab', 'KeyF', 'KeyB', 'KeyM', 'KeyG', 'KeyP', 'KeyL', 'KeyN', 'KeyV', 'KeyX', 'MetaLeft', 'MetaRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4'];
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
  IN.boost = !!keys[KB.boost] || !!TOUCH.boost;
  if (TOUCH.on) { for (const k of ['thr', 'yaw', 'pitch', 'roll']) if (Math.abs(TOUCH[k]) > Math.abs(IN[k])) { IN[k] = TOUCH[k]; IN.src = 'TOUCH'; } }
  const gp = getPad();
  if (gp && !RCUI.open) {
    const st = {};
    for (const k of ['thr', 'yaw', 'pitch', 'roll']) {
      const a = RC.axes[k]; let v = calAxis(gp, a.i); if (a.inv) v = -v;
      st[k] = shape(v, k === 'thr' && RC.thrType === 'bottom' ? 0.12 : 0.07);
    }
    const any = Math.abs(st.thr) + Math.abs(st.yaw) + Math.abs(st.roll) + Math.abs(st.pitch) > 0.02;
    if (any) { for (const k in st) if (Math.abs(st[k]) > Math.abs(IN[k])) IN[k] = st[k]; IN.src = 'PAD'; }
    const map = { drop: 'Space', cam: 'KeyC', reset: 'KeyR' };
    for (const k in map) { const s = btnState(gp, RC.btn[k]); if (s && !padPrevBtn[k]) pressed.push(map[k]); padPrevBtn[k] = s; }
    const sb = gp.buttons[9] && gp.buttons[9].pressed; if (sb && !padPrevBtn.start) pressed.push('Escape'); padPrevBtn.start = sb;
    if (gp.buttons[6] && gp.buttons[6].value > 0.4) IN.boost = true;
    if (gp.mapping === 'standard') {   // Xbox / 표준 배치 추가 버튼
      const ex = { rt: [7, 'Space'], lb: [4, 'PadLB'], rb: [5, 'PadRB'], x: [2, 'KeyH'], back: [8, 'KeyG'], up: [12, 'PadUp'], down: [13, 'PadDown'], left: [14, 'PadLeft'], right: [15, 'PadRight'], a: [0, 'PadA'] };
      for (const k in ex) { const bt = gp.buttons[ex[k][0]]; const s = !!(bt && (bt.pressed || bt.value > 0.5)); if (s && !padPrevBtn['x' + k]) pressed.push(ex[k][1]); padPrevBtn['x' + k] = s; }
    }
  }
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
  train: { name: 'TRAINING', maxTilt: 20 * DEG, vmax: 7.5, yawRate: 95 * DEG, althold: true, brake: 2.6, assist: 1.0, autoYaw: true, margin: 0.22, hitPen: 2 },
  easy: { name: 'EASY', maxTilt: 28 * DEG, vmax: 11, yawRate: 120 * DEG, althold: true, brake: 1.3, assist: 0.45, autoYaw: false, margin: 0.1, hitPen: 3 },
  sport: { name: 'SPORT', maxTilt: 55 * DEG, vmax: 27, yawRate: 220 * DEG, althold: false, brake: 0, assist: 0, autoYaw: false, margin: 0, hitPen: 5 }
};
const ZOOMS = [{ d: 3.0, h: 1.0, fov: 62 }, { d: 1.85, h: 0.6, fov: 55 }, { d: 1.25, h: 0.42, fov: 50 }];
const SET = { belly: true, guide: true, keymap: 'A', zoom: 1, diff: 'train', ghost: true, ghostSrc: 'ref', tilt: 15, showPath: false, light: false, assist: true, autoFull: true };
try { const s = JSON.parse(localStorage.getItem('fpvsim_fpv_settings') || '{}'); Object.assign(SET, s); } catch (e) { }
if (!MODES[SET.diff]) SET.diff = 'train';
function saveSet() { try { localStorage.setItem('fpvsim_fpv_settings', JSON.stringify({ belly: SET.belly, guide: SET.guide, keymap: SET.keymap, zoom: SET.zoom, diff: SET.diff, ghost: SET.ghost, ghostSrc: SET.ghostSrc, tilt: SET.tilt, assist: SET.assist, autoFull: SET.autoFull })); } catch (e) { } }

const DR = { p: new V3(), v: new V3(), h: 0, pitch: 0, roll: 0, landed: true, thrust: 0, R: 0.16, alive: true };
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
  S.objState = OBJS.map(() => 0); S.pen = 0; S.impacts = 0; S.payloads = 3; S.respawn = null; S.scan = 0; S.wasInside = false; S.landT = 0;
  S.ghostT = 0; S.demoEvents = 0; S.hits = 0; S.misses = 0; S.scanned = false; S.flyT = 0; S.hitCD = 0; S.orbSum = 0; S.orbA = null; S.boosting = false; S.bellyOv = null;
  PAY.forEach(p => scene.remove(p.m)); PAY.length = 0;
  droneM.cans.forEach(c => c.visible = true); ghostM.cans.forEach(c => c.visible = true);
  resetDrone(startPos(), startHead());
  if (kind === 'demo') S.cam = 1;
  S._fromDemo = kind === 'demo';
  OBJS.forEach(o => { if (o.hint) o.hint.visible = false; });
  ui.menu.classList.add('hidden'); ui.pause.classList.add('hidden'); ui.result.classList.add('hidden'); ui.hud.classList.remove('hidden');
  ui.list.classList.toggle('hidden', kind !== 'course');
  renderList(); updateTags();
  S.tut = null; $('tut').classList.add('hidden'); $('rp').classList.add('hidden'); ui.hud.classList.remove('replaying');
  if (kind === 'course' || kind === 'free') recStart(); else REC = null;
  showMsg(kind === 'course' ? (IS_TOUCH ? 'READY · 왼쪽 스틱 위로 이륙' : 'READY · ' + keyName(KB.up) + ' = TAKEOFF') : kind === 'free' ? 'FREE FLIGHT' : kind === 'tutorial' ? '' : 'REFERENCE FLIGHT', '#ffc828', 2.2);
  initAudio(); musicStart();
}
function curObj() {
  if (S.state === 'menu' || S.state === 'replay' || S.state === 'result') return null;
  if (S.kind === 'course') return OBJS[S.objIdx];
  if (S.kind === 'tutorial') return tutObj();
  return null;
}
function completeObj(status, msg, col) {
  const o = curObj(); if (!o) return;
  S.objState[S.objIdx] = status;
  if (o.hint) o.hint.visible = false;
  S.respawn = { p: DR.p.clone(), h: DR.h };
  if (status === 1) sfx('good'); else sfx('bad');
  showMsg(msg || (o.label + (status === 1 ? ' ✓' : ' ✗')), col || (status === 1 ? '#5dff9a' : '#ff6060'), 1.4);
  S.objIdx++; S.scan = 0; S.wasInside = false; S.landT = 0; S.scanned = false; S.orbSum = 0; S.orbA = null;
  if (S.kind === 'tutorial') tutAfterObj(); else if (S.objIdx >= OBJS.length) finishRun();
  renderList();
}
function finishRun() {
  S.finished = true; S.running = false;
  const rec = recFinish();
  setTimeout(() => {
    if (S.state !== 'run') return;
    S.state = 'result'; ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden');
    const total = S.t + S.pen, done = S.objState.filter(v => v === 1).length;
    ui.resSub.textContent = `${MODES[SET.diff].name} · 과제 ${done}/${OBJS.length} 성공`;
    const rows = [['비행 시간', fmt(S.t)], ['벌점', '+' + S.pen.toFixed(0) + ' s'], ['합계', fmt(total)], ['충돌', S.impacts + ' 회'],
      ['투하 명중', S.hits + ' / 3'], ['기준 비행 (영상)', fmt(GH.total)]];
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td></tr>`).join('');
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
  if (S.hitCD > 0) return;
  S.hitCD = 0.8; S.impacts++; S.stun = 0.45; shake = 0.07;
  const pen = MODES[SET.diff].hitPen;
  if (S.kind === 'course' && S.running) S.pen += pen;
  spawnImpact(DR.p.clone(), false, true); sfx('crash'); rumble(0.9, 0.6, 230);
  ui.flash.style.opacity = 0.3; setTimeout(() => { ui.flash.style.opacity = 0; }, 110);
  showMsg('IMPACT' + (S.kind === 'course' && S.running ? ` +${pen}s` : ''), '#ff5050', 1.1);
}
function respawn() {
  if (S.kind === 'tutorial' && S.tut) { const st = S.tut.startPose; const p = st.p.clone(); if (!st.landed) p.y = Math.max(p.y, groundAt(p.x, p.z) + 1.0); resetDrone(p, st.h); if (st.landed) DR.landed = true; S.scanned = false; S.scan = 0; S.wasInside = false; S.tut.hold = 0; if (LESSONS[S.tut.i].custom) S.tut.step = 0; else S.objIdx = LESSONS[S.tut.i].range[0]; PAY.forEach(p => scene.remove(p.m)); PAY.length = 0; droneM.cans.forEach(c => c.visible = true); tutRender(); return; }
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
function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function stepDrone(dt) {
  const md = MODES[SET.diff];
  const grounded = DR.landed && IN.thr <= 0.05;
  const boost = !!IN.boost && !grounded && boostZone(); S.boosting = boost;
  const vmaxB = boost ? Math.max(md.vmax * 2.2, 22) : md.vmax, tiltB = md.maxTilt + (boost ? 15 * DEG : 0);
  const k = G * Math.tan(tiltB) / vmaxB;
  const a = 1 - Math.exp(-dt / 0.11);
  const stun = S.stun > 0 ? 0.25 : 1;
  let ip = IN.pitch * stun, ir = IN.roll * stun, iy = IN.yaw * stun;
  if (S.stun > 0) { ir += Math.sin(S.simT * 40) * 0.35; S.stun -= dt; }
  DR.pitch += ((grounded ? 0 : ip * tiltB) - DR.pitch) * a;
  DR.roll += ((grounded ? 0 : ir * md.maxTilt) - DR.roll) * a;
  const o = curObj(), assistOn = SET.assist && md.assist > 0;
  if (!grounded) {
    DR.h += iy * md.yawRate * dt;
    // 자동 방향 보조 (입문): 회전 입력이 없으면 다음 과제 쪽으로 천천히 돌아감
    if (md.autoYaw && assistOn && o && o.mk && Math.abs(iy) < 0.05 && (Math.abs(ip) > 0.1 || Math.hypot(DR.v.x, DR.v.z) > 1.2)) {
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
    DR.v.x += (FWD.x * af + RGT.x * ar - k * DR.v.x) * dt;
    DR.v.z += (FWD.z * af + RGT.z * ar - k * DR.v.z) * dt;
    // 브레이크 (스틱을 놓으면 멈춤)
    if (boost && ip > 0) { DR.v.x += FWD.x * 7 * ip * dt; DR.v.z += FWD.z * 7 * ip * dt; }
    if (md.brake > 0 && !boost && Math.abs(ip) < 0.05 && Math.abs(ir) < 0.05) { const f = Math.exp(-md.brake * dt); DR.v.x *= f; DR.v.z *= f; }
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
    let tv = IN.thr > 0 ? IN.thr * 4.5 : IN.thr * 3.2;
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
    const T = G * (1 + IN.thr * 1.15);
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
    const hit = collide(DR.p, DR.R); if (!hit) break;
    const vn = DR.v.dot(hit.n);
    DR.p.addScaledVector(hit.n, hit.pen + 0.003);
    if (vn < -2.5) impact(hit.n, vn);
    else { if (vn < 0) DR.v.addScaledVector(hit.n, -vn * 1.2); DR.v.multiplyScalar(0.85); if (S.bumpT <= 0) { sfx('bad'); S.bumpT = 0.4; } }
  }
  // 비행 구역 경계: 밀어냄
  const rx = DR.p.x, rz = DR.p.z + 150, l = Math.hypot(rx, rz);
  if (l > 520) {
    const nx = rx / l, nz = rz / l; DR.p.x -= nx * (l - 520); DR.p.z -= nz * (l - 520);
    const vo = DR.v.x * nx + DR.v.z * nz; if (vo > 0) { DR.v.x -= nx * vo * 1.5; DR.v.z -= nz * vo * 1.5; }
    if (S.msgCD <= 0) { showMsg('AREA LIMIT', '#ff9a40', 1); S.msgCD = 2; }
  }
}
S.msgCD = 0;

// ---------------- payloads ----------------
function dropPayload(fromPos, fromVel, ghost) {
  const meshes = ghost && ghost !== 'demo' && ghost !== 'replay' ? ghostM.cans : droneM.cans;
  if (!ghost && S.kind === 'course' && S.payloads <= 0) { showMsg('NO PAYLOAD', '#ff6060', 1); sfx('bad'); return; }
  const can = meshes.find(c => c.visible); if (can) can.visible = false;
  if (!ghost && S.kind === 'course') S.payloads--;
  if (!ghost && (S.kind === 'free' || S.kind === 'tutorial') && !meshes.some(c => c.visible)) setTimeout(() => droneM.cans.forEach(c => c.visible = true), 1500);
  if (!ghost) recEvent({ k: 'drop', p: [fromPos.x, fromPos.y, fromPos.z], v: [fromVel.x, fromVel.y, fromVel.z] });
  const m = new THREE.Mesh(UCYL, mat(0x7c8288, { roughness: 0.45, metalness: 0.5 })); m.scale.set(0.022, 0.12, 0.022); m.castShadow = true;
  m.position.copy(fromPos).add(new V3(0, -0.08, 0)); scene.add(m);
  PAY.push({ m, v: fromVel.clone(), spin: new V3(Math.random() * 6, 0, Math.random() * 6), ghost, course: !ghost && (S.kind === 'course' || S.kind === 'tutorial') });
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
      scene.remove(P.m); PAY.splice(i, 1);
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
  if (!o || o.kind !== 'drop') { refundPayload(o && o.kind === 'orbit' ? 'ORBIT FIRST · 먼저 탱크를 한 바퀴 도세요' : 'NOT A DROP TASK · 탑재물 회수'); return; }
  const r = targetEval(o.target, pos, hitObj);
  if (r.hit) { S.hits++; rumble(0.5, 1.0, 160); completeObj(1, `${r.name} HIT ✓`); return; }
  if (r.d > 25) { refundPayload(`TOO FAR (${r.d.toFixed(0)} m) · 탑재물 회수`); return; }
  if (S.kind === 'tutorial') { showMsg(`MISS ${r.d.toFixed(1)} m · 다시 시도`, '#ff9a40', 1.6); sfx('bad'); return; }
  // 한 번 투하하면 맞든 안 맞든 다음 과제로 (빗나가면 +10초)
  S.pen += S.kind === 'course' ? 10 : 0; S.misses++;
  completeObj(2, `MISS ${r.d.toFixed(1)} m${S.kind === 'course' ? ' · +10s' : ''} → NEXT`, '#ff9a40');
}
function refundPayload(msg) {
  if (S.kind === 'course') { S.payloads = Math.min(3, S.payloads + 1); const c = droneM.cans.find(c => !c.visible); if (c) c.visible = true; }
  showMsg(msg, '#ffc828', 1.8); sfx('bad');
}
function boostZone() {
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
function checkObjectives(prev, cur, dt) {
  const o = curObj(); if (!o || !DR.alive) return;
  const mg = MODES[SET.diff].margin;
  if (o.kind === 'custom') { tutCustomCheck(cur, dt); return; }
  if (o.kind === 'takeoff') { if (cur.y > groundAt(cur.x, cur.z) + 0.8) { S.running = true; completeObj(1, 'GO!', '#ffc828'); } return; }
  if (o.kind === 'pass' || o.kind === 'slalom') {
    const a = o.b.local(prev), b = o.b.local(cur);
    if ((a.ly < 0) === (b.ly < 0)) return;
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
  eul.set(-subj.pitch, -subj.h, -subj.roll); qBody.setFromEuler(eul);
  const fwd = new V3(Math.sin(subj.h), 0, -Math.cos(subj.h));
  camera.up.set(0, 1, 0);
  if (mode === 'FPV') {
    qTilt.setFromAxisAngle(new V3(1, 0, 0), SET.tilt * DEG);
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
      const Z = ZOOMS[SET.zoom] || ZOOMS[1]; want = subj.p.clone().addScaledVector(fwd, -Z.d).add(new V3(0, Z.h, 0));
      want.y = Math.max(want.y, groundAt(want.x, want.z) + 0.35);
      camPos.lerp(want, 1 - Math.exp(-dt * 5.5));
    }
    camera.position.copy(camPos);
    camLook.lerp(subj.p.clone().addScaledVector(fwd, 1.5).add(new V3(0, 0.2, 0)), 1 - Math.exp(-dt * 9));
    camera.lookAt(camLook); camera.fov = (ZOOMS[SET.zoom] || ZOOMS[1]).fov - (LOWQ ? 6 : 0) + (S.boosting ? 9 : 0); camera.near = 0.05;
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
function showMsg(t, col, dur) { if (t && REC) recEvent({ k: 'msg', text: t, col }); ui.objMsg.textContent = t; ui.objMsg.style.color = col || '#fff'; ui.objMsg.classList.add('show'); msgTimer = dur || 1.2; }
function renderList() {
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
  ui.modeTag.textContent = S.state === 'replay' ? 'REPLAY' : S.kind === 'tutorial' ? 'TUTORIAL · ' + MODES[SET.diff].name : S.kind === 'demo' ? 'REFERENCE' : MODES[SET.diff].name + (SET.assist && MODES[SET.diff].assist ? ' · ASSIST' : '') + (SET.ghost && S.kind === 'course' ? ' · GHOST' : '');
  ui.cross.classList.toggle('hidden', CAMS[S.cam] !== 'FPV');
}
// 미니맵
const MAPV = (function () {
  if (!CRS_C) return { d0: -24, d1: 340, s0: -112, s1: 90 };
  // 전용 코스: 경로·장애물을 다 담는 범위 (세로 300 : 가로 180 비율 유지)
  let d0 = 1e9, d1 = -1e9, s0 = 1e9, s1 = -1e9;
  for (const q of CRS_C.path.concat(D.objs.map(o => [o.down, o.side]))) { d0 = Math.min(d0, q[0]); d1 = Math.max(d1, q[0]); s0 = Math.min(s0, q[1]); s1 = Math.max(s1, q[1]); }
  d0 -= 30; d1 += 30; s0 -= 30; s1 += 30;
  const kd = (d1 - d0) / 300, ks = (s1 - s0) / 180, k = Math.max(kd, ks), dc = (d0 + d1) / 2, sc = (s0 + s1) / 2;
  return { d0: dc - 150 * k, d1: dc + 150 * k, s0: sc - 90 * k, s1: sc + 90 * k };
})();
const mapBg = document.createElement('canvas'); mapBg.width = 180; mapBg.height = 300;
function mxy(down, side) { return [(side - MAPV.s0) / (MAPV.s1 - MAPV.s0) * 180, (MAPV.d1 - down) / (MAPV.d1 - MAPV.d0) * 300]; }
(function drawMapBg() {
  const g = mapBg.getContext('2d');
  if (TER.h) {   // 음영기복 + 등고선 (5 m 간격, 25 m 마다 굵게)
    const id = g.createImageData(180, 300), kd = (MAPV.d1 - MAPV.d0) / 300, ks = (MAPV.s1 - MAPV.s0) / 180;
    const hAt = (x, y) => terrainAt(MAPV.s0 + x * ks, -(MAPV.d1 - y * kd));
    for (let y = 0; y < 300; y++) for (let x = 0; x < 180; x++) {
      const z = hAt(x, y), zx = (hAt(x + 1, y) - hAt(x - 1, y)) / (2 * ks), zy = (hAt(x, y + 1) - hAt(x, y - 1)) / (2 * kd);
      const sh = Math.max(0, Math.min(1, 0.55 + (-zx + zy) * 0.6)), o = (y * 180 + x) * 4;
      const c0 = Math.floor(z / 5), lineA = [hAt(x + 1, y), hAt(x, y + 1)].some(v => Math.floor(v / 5) !== c0);
      const major = lineA && [hAt(x + 1, y), hAt(x, y + 1)].some(v => Math.floor(v / 25) !== Math.floor(z / 25));
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
})();
function drawMap(gpos) {
  const g = ui.map.getContext('2d'); g.clearRect(0, 0, 180, 300); g.drawImage(mapBg, 0, 0);
  const toDS = p => [-p.z, p.x];
  const o = curObj();
  if (o && o.mk) { const [d, s] = toDS(o.mk); const p = mxy(d, s); g.strokeStyle = '#ffc828'; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], 6 + Math.sin(performance.now() / 200) * 1.5, 0, 7); g.stroke(); }
  if (gpos) { const [d, s] = toDS(gpos); const p = mxy(d, s); g.fillStyle = '#4fe3ff'; g.beginPath(); g.arc(p[0], p[1], 3, 0, 7); g.fill(); }
  if (S.state !== 'demo') {
    const src = S.state === 'replay' ? RP.pose : DR;
    const [d, s] = toDS(src.p); const p = mxy(d, s); g.save(); g.translate(clamp(p[0], 4, 176), clamp(p[1], 4, 296)); g.rotate(src.h);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5); g.fill(); g.restore();
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
const impactRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0xffc828, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
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
  const dist = o && o.mk ? o.mk.distanceTo(subj.p) : null;
  const tm = S.state === 'replay' ? RP.t - RP.rec.s[0][0] : S.kind === 'course' ? S.t : S.kind === 'demo' ? S.ghostT : S.flyT;
  ui.osd.innerHTML = `<div class="big">${fmt(tm)}${S.kind === 'course' && S.pen ? ` <span style="color:#ff7070;font-size:16px">+${S.pen}s</span>` : ''}</div>` +
    `<div><b>ALT</b>${Math.max(0, agl(subj.p) - 0.06).toFixed(1)} m${TER.h ? ` <span style="color:#9aa6ad;font-size:.75em">MSL ${(subj.p.y + SITE.base).toFixed(0)}</span>` : ''}</div>` + `<div><b>SPD</b>${spd.toFixed(0)} km/h</div>` +
    (dist !== null ? `<div><b>DIST</b>${dist.toFixed(0)} m</div>` : '') +
    (S.kind === 'course' ? `<div><b>HIT</b>${S.impacts}</div>` : '') +
    (o && o.kind === 'orbit' ? `<div style="color:#4fe3ff">ORBIT ${Math.min(100, Math.abs(S.orbSum) / (Math.PI * 2) * 100).toFixed(0)}%</div>` : '') +
    (S.boosting ? '<div style="color:#ff9a40">BOOST ▲▲</div>' : '') +
    (S.state !== 'demo' && insideBunker(subj.p) ? `<div style="color:#5dff9a">SCAN ${Math.min(100, S.scan / 1.5 * 100).toFixed(0)}%</div>` : '');
  if (S.kind === 'course') {
    ui.objNext.style.display = '';
    ui.objNext.innerHTML = o ? `NEXT ▸ ${o.label}<small>${S.objIdx + 1}/${OBJS.length}</small>` : 'COURSE COMPLETE';
  } else if (S.kind === 'tutorial' && S.tut) { ui.objNext.style.display = ''; ui.objNext.innerHTML = `LESSON ${S.tut.i + 1} ▸ ${o ? o.label : 'COMPLETE'}`; }
  else if (S.state === 'replay') { ui.objNext.style.display = ''; ui.objNext.innerHTML = `REPLAY <small>${RP.rec.kind === 'course' ? MODES[RP.rec.diff] ? MODES[RP.rec.diff].name : '' : 'FREE'} ×${RP.speed}</small>`; }
  else if (S.kind === 'demo') { ui.objNext.style.display = ''; ui.objNext.innerHTML = `REFERENCE FLIGHT <small>${fmt(S.ghostT)} / ${fmt(GH.total)}</small>`; }
  else ui.objNext.style.display = 'none';
  const n = S.kind === 'course' && S.state === 'run' ? S.payloads : droneM.cans.filter(c => c.visible).length;
  ui.payload.innerHTML = 'M84 ' + [0, 1, 2].map(i => `<i class="${i < n ? '' : 'used'}"></i>`).join('');
  if (o && o.mk && S.state === 'run' && DR.alive) {
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
function placeModel(mdl, st) { mdl.g.position.copy(st.p); eul.set(-st.pitch, -st.h, -st.roll); mdl.g.quaternion.setFromEuler(eul); }
let last = performance.now(), acc = 0;
const STEP = 1 / 120;
function handleKeys() {
  while (pressed.length) {
    const k = pressed.shift();
    if (RCUI.open) continue;
    if (k === 'KeyF') { toggleFull(); continue; }
    if (k === 'KeyB') { MUS.on = !MUS.on; musicSetLevel(); saveMusic(); syncSeg(); if (S.state !== 'menu') showMsg(MUS.on ? 'MUSIC ON' : 'MUSIC OFF', '#fff', 0.8); continue; }
    if (S.state === 'replay') { replayKey(k.replace(/^(MV_|X_)/, '')); continue; }
    if (S.state === 'menu') {
      if (k === 'Escape') { closePanels(); continue; }
      if (['setPanel', 'recPanel', 'helpPanel', 'tutMenu', 'kbPanel'].some(p => !$(p).classList.contains('hidden'))) continue;
      if (k === 'Enter' || k === 'PadA') startRun('course'); else if (k === 'KeyT') openTutMenu(); continue;
    }
    if (S.state === 'result') { if (k === 'Enter' || k === 'PadA') startRun('course'); else if (k === 'KeyV' || k === 'KeyH') replayStart(LAST_REC, 'result'); else if (k === 'Escape') toMenu(); continue; }
    if (k === 'Escape') { togglePause(); continue; }
    if (S.state === 'pause') continue;
    if (S.kind === 'tutorial' && S.tut) {
      if (S.tut.st === 'intro' && (k === 'Enter' || k === 'Space' || k === 'X_Space' || k === 'PadA')) { tutFly(); continue; }
      if (S.tut.st === 'done') { if (k === 'Enter' || k === 'Space' || k === 'X_Space' || k === 'PadA') { tutNext(); continue; } if (k === 'KeyR') { tutRetry(); continue; } }
    }
    if (k === 'KeyC' || k === 'PadRB') { S.cam = [2, 0, 1][S.cam]; updateTags(); }
    else if (k === 'PadLB') { S.cam = (S.cam + 2) % 3; updateTags(); }
    else if (k === 'KeyX' || k === 'PadLeft') { const vis = bellyMode() !== null; S.bellyOv = { val: !vis, idx: S.objIdx }; showMsg(!vis ? 'BELLY CAM ON' : 'BELLY CAM OFF', '#fff', 0.8); }
    else if (k === 'KeyV') { SET.guide = !SET.guide; saveSet(); syncSeg(); showMsg(SET.guide ? 'GUIDE ON' : 'GUIDE OFF', '#fff', 0.8); }
    else if (k === 'KeyZ') { SET.zoom = (SET.zoom + 1) % 3; saveSet(); showMsg('ZOOM ' + ['FAR', 'MID', 'NEAR'][SET.zoom], '#fff', 0.7); }
    else if (k === 'KeyG') { SET.ghost = !SET.ghost; saveSet(); updateTags(); syncSeg(); }
    else if (k === 'KeyP') { SET.showPath = !SET.showPath; GH.line.visible = SET.showPath; }
    else if (k === 'KeyL') { SET.light = !SET.light; }
    else if (k === 'KeyM') { AU.on = !AU.on; showMsg(AU.on ? 'SOUND ON' : 'SOUND OFF', '#fff', 0.8); if (AU.master) AU.master.gain.value = AU.on ? 0.55 : 0; }
    else if (k === 'KeyH') { SET.assist = !SET.assist; saveSet(); updateTags(); syncSeg(); showMsg(SET.assist ? 'ASSIST ON' : 'ASSIST OFF', '#fff', 0.8); }
    else if (k === 'PadUp') { SET.tilt = Math.min(40, SET.tilt + 5); saveSet(); syncSeg(); showMsg('CAM TILT ' + SET.tilt + '°', '#fff', 0.7); }
    else if (k === 'PadDown') { SET.tilt = Math.max(0, SET.tilt - 5); saveSet(); syncSeg(); showMsg('CAM TILT ' + SET.tilt + '°', '#fff', 0.7); }
    if (S.state !== 'run') continue;
    if (S.tut && S.tut.st !== 'fly') continue;
    if (k === 'Space' && DR.alive) dropPayload(DR.p, DR.v, false);
    else if (k === 'KeyR') respawn();
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
function frame(now, noRender) {
  if (!TEST) requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.1); last = now;
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
    if (!tutHold) {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP; _prevP.copy(DR.p); stepDrone(STEP); S.bumpT -= STEP; S.hitCD -= STEP;
        if (S.kind === 'course' || S.kind === 'tutorial') checkObjectives(_prevP, DR.p, STEP);
      }
    }
    if (S.running && !S.finished && S.kind === 'course') S.t += dt;
    S.flyT += dt;
    if (S.running && !REC_T0_SET && REC) { REC.t0 = S.flyT; REC_T0_SET = true; }
    if (!S.running) REC_T0_SET = false;
    recTick(dt);
    if (S.kind === 'course' && S.running && SET.ghost) S.ghostT += dt;
    updatePayloads(dt);
  } else if (S.state === 'demo') {
    S.ghostT += dt; updatePayloads(dt);
    while (S.demoEvents < GH.events.length && GH.events[S.demoEvents].t <= S.ghostT) {
      const ev = GH.events[S.demoEvents++]; if (ev.label.startsWith('DROP')) dropPayload(ghostS.p, ghostS.v, 'demo'); showMsg(ev.label.replace(/^_.*/, ''), '#ffc828', 1.2);
    }
    if (S.ghostT > GH.total + 2.5) toMenu();
  } else if (S.state === 'replay') { replayTick(dt); subj = RP.pose; }
  const ghostOn = S.state === 'demo' || (S.kind === 'course' && SET.ghost && (S.state === 'run' || S.state === 'pause'));
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
    marker.visible = !!o.mk; if (o.mk) { marker.position.copy(o.mk).add(new V3(0, Math.sin(S.simT * 3) * 0.15, 0)); marker.rotation.y += dt * 2; const d = camera.position.distanceTo(marker.position); const sc = Math.max(1, d / 22); marker.scale.set(sc, sc * 1.5, sc); }
  } else marker.visible = false;
  const subjPos = subj.p;
  const inB = S.state !== 'menu' && insideBunker(subjPos);
  const nearB = OBJ.bunker1 && OBJ.bunker1.world(0, 0, 1.5).distanceTo(subjPos) < 5;
  hemi.intensity = lerp(hemi.intensity, inB ? 0.04 : 0.5, 1 - Math.exp(-dt * 5));
  spot.intensity = lerp(spot.intensity, (SET.light || inB || nearB) && S.state !== 'menu' ? 4.5 : 0, 1 - Math.exp(-dt * 8));
  { eul.set(-subj.pitch, -subj.h, -subj.roll); const q = new THREE.Quaternion().setFromEuler(eul);
    spot.position.copy(subjPos).add(new V3(0, 0, -0.14).applyQuaternion(q)); spotT.position.copy(subjPos).add(new V3(0, -0.6, -3).applyQuaternion(q)); spotT.updateMatrixWorld(); }
  if (S.state === 'run' && tutHold && S.tut.st === 'intro') tutCamera(dt);
  else if (S.state === 'menu') {
    const a = S.simT * 0.05, c0 = CRS_C ? W(BY.pad_start.down, BY.pad_start.side, 0).add(new V3(0, 0, 0)) : W(60, 0, 0), R0 = TER.h ? 70 : 38; camera.position.set(c0.x + Math.sin(a) * R0 + 2, Math.max(c0.y + (TER.h ? 28 : 16), terrainAt(c0.x + Math.sin(a) * R0 + 2, c0.z + Math.cos(a) * R0) + 8), c0.z + Math.cos(a) * R0); camera.up.set(0, 1, 0); camera.lookAt(c0.x, c0.y + 2, c0.z); camera.fov = 60; camera.updateProjectionMatrix();
  } else updateCamera(dt, subj);
  camera.updateMatrixWorld();
  updateGuide(subj);
  droneM.g.visible = !(CAMS[S.cam] === 'FPV' && S.state !== 'menu' && S.state !== 'result' && !(tutHold && S.tut.st === 'intro'));
  $('vig').classList.toggle('hidden', !(CAMS[S.cam] === 'FPV' && (S.state === 'run' || S.state === 'replay') && !(tutHold && S.tut.st === 'intro')));
  const focus = S.state === 'menu' ? (CRS_C ? W(BY.pad_start.down, BY.pad_start.side, 0) : W(60, 0, 0)) : subjPos;
  sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(SUN_DIR, 120);
  sky.position.copy(camera.position);
  updateFX(dt);
  if (playing || S.state === 'pause' || S.state === 'replay') { updateHUD(dt, subj); drawMap(ghostOn && ghostM.g.visible ? ghostS.p : null); }
  audioUpdate(demoing ? 0.55 : S.state === 'replay' ? RP.pose.thrust : DR.thrust, subj.v ? subj.v.length() : 0, (S.state === 'run' && !tutHold && !(DR.landed && IN.thr <= 0.05)) || S.state === 'demo' || (S.state === 'replay' && RP.playing));
  if (!noRender) { renderer.render(scene, camera); renderBelly(); }
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
  replayUI();
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
  resetDrone(startPos(), startHead()); refreshBest();
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
  tap('tbDrop', 'Space'); tap('tbCam', 'KeyC'); tap('tbReset', 'KeyR'); tap('tbPause', 'Escape'); tap('tbAssist', 'KeyH'); tap('tbZoom', 'KeyZ'); tap('tbGuide', 'KeyV'); tap('tbBelly', 'KeyX');
  const bst = $('tbBoost'); bst.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); TOUCH.boost = true; bst.classList.add('down'); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => bst.addEventListener(ev, () => { TOUCH.boost = false; bst.classList.remove('down'); }));
  $('tbFull').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleFull(); });
  $('tut').addEventListener('pointerdown', () => { if (S.tut && S.tut.st !== 'fly') pressed.push('Enter'); });
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  const rot = () => $('rot').classList.toggle('hidden', !(innerHeight > innerWidth * 1.05));
  addEventListener('resize', rot); addEventListener('orientationchange', () => setTimeout(rot, 200)); rot();
})();

// 시작할 때 자동 전체화면 (브라우저 규칙상 클릭·터치·키 입력이 있어야 전환됨)
function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
let fullAsk = 0;
function enterFull() { if (!SET.autoFull || isFull() || /[?&]test/.test(location.search) || performance.now() - fullAsk < 1500) return; fullAsk = performance.now(); toggleFull(); }
(function firstGesture() {
  const go = e => { removeEventListener('pointerdown', go, true); removeEventListener('keydown', go, true);
    if (e.target && e.target.closest && e.target.closest('#bFull,#tbFull')) return; enterFull(); };
  addEventListener('pointerdown', go, true); addEventListener('keydown', go, true);
})();
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
function guidePoints(o, p) {
  GUIDE.detour = false;
  if (!o) return null;
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
  const lead = C.clone().addScaledVector(A, -5), exit = C.clone().addScaledVector(A, along);
  const before = p.clone().sub(C).dot(A);
  return before < -3 ? [p.clone(), lead, C, exit] : [p.clone(), C, exit];
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
    const el = $('guide'); el.classList.remove('hidden'); el.innerHTML = '<div class="ok">정찰 중 · 안에서 잠시 머무르기</div>'; return;
  }
  const pts = guidePoints(o, subj.p);
  if (!pts) { hideGuide(); return; }
  GUIDE.next = pts[1];
  if (!SET.guide) { hideGuide(); return; }
  const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
  const L = curve.getLength(), phase = (S.simT * 3.2) % GUIDE.sp;
  GUIDE.meshes.forEach((x, i) => {
    const d = 2.4 + phase + i * GUIDE.sp;
    if (d > L - 0.2 || L < 1.2) { x.g.visible = false; return; }
    const u = d / L; curve.getPointAt(u, _gt); curve.getPointAt(Math.min(1, u + 0.02), _gq);
    x.g.visible = true; x.g.position.copy(_gt); x.g.lookAt(_gq);
    const s = 0.9 + Math.min(d, 20) * 0.02; x.g.scale.set(s, s, s);
    x.m.color.set(GUIDE.detour ? 0xffc828 : o.kind === 'orbit' ? 0x5dff9a : 0x4fe3ff);
    x.m.opacity = 0.75 * Math.min(1, (d - 1.2) / 1.5) * Math.min(1, (L - d) / 2);
  });
  // ---- 조작 안내 문구 ----
  const T = IS_TOUCH ? { up: '왼쪽 스틱 ↑', down: '왼쪽 스틱 ↓', yawL: '왼쪽 스틱 ←', yawR: '왼쪽 스틱 →', fwd: '오른쪽 스틱 ↑', back: '오른쪽 스틱 ↓', left: '오른쪽 스틱 ←', right: '오른쪽 스틱 →', drop: 'DROP', boost: 'BST' } : null;
  const K = a => T ? T[a] : keyName(KB[a]);
  const tgt = (o.kind === 'orbit' || GUIDE.detour) ? pts[1] : (pts.length > 2 ? pts[pts.length - 2] : pts[1]);
  const d = tgt.clone().sub(subj.p), fwd = new V3(Math.sin(DR.h), 0, -Math.cos(DR.h)), rgt = new V3(Math.cos(DR.h), 0, Math.sin(DR.h));
  const df = d.dot(fwd), dr = d.dot(rgt), dy = d.y, hd = Math.hypot(df, dr), ang = Math.atan2(dr, df) / DEG;
  const lines = [];
  const steer = () => {
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
  if (boostZone() && S.kind === 'course') lines.unshift([S.boosting ? 'BOOST ▲▲ 고속 복귀 중' : `BOOST ZONE · ${K('boost')} 누른 채 고속 복귀`, 'warn']);
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
  const auto = SET.belly && o && ((o.kind === 'drop' && dropTargetPos(o).distanceTo(DR.p) < 45) || (o.kind === 'orbit' && o.b.world(0, 0, 0).distanceTo(DR.p) < 30));
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
    if (!IS_TOUCH) { const ob = ui.osd.getBoundingClientRect(); el.style.top = Math.max(140, Math.round(ob.bottom + 10)) + 'px'; } else el.style.top = '';
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
async function loadOrthoFile(file) {
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
  let cover = 0;
  for (let j = 0; j < ORTHO_N; j++) {
    let E = e00 + dEj * j, N = n00 + dNj * j;
    for (let i = 0; i < ORTHO_N; i++, E += dEi, N += dNi) {
      const sx = (E - ox) * kx, sy = (oy - N) * ky;
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) continue;
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, a = (y0 * sw + x0) * 3, b = a + sw * 3, o = (j * ORTHO_N + i) * 4;
      for (let c = 0; c < 3; c++) dd[o + c] = (src[a + c] * (1 - fx) + src[a + 3 + c] * fx) * (1 - fy) + (src[b + c] * (1 - fx) + src[b + 3 + c] * fx) * fy;
      cover++;
    }
  }
  g.putImageData(id, 0, 0);
  applyGroundCanvas(cv);
  const pct = Math.round(cover / (ORTHO_N * ORTHO_N) * 100);
  setOrthoStatus(`위성사진 적용됨 (${(rx * step * mk).toFixed(2)} m/px, 바닥의 ${pct}%)`, '#5dff9a');
  cv.toBlob(bl => { if (bl) IDB.put('ortho' + SITE_KEY, bl); }, 'image/jpeg', 0.9);
  return { res: rx * step * mk, cover: pct, srcRes: res0 };
}
async function restoreOrtho() {
  const bl = await IDB.get('ortho' + SITE_KEY); if (!bl) return;
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
const PANELS = ['setPanel', 'recPanel', 'helpPanel'];
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
$('bRestart').onclick = () => { musicSetLevelPaused(false); if (S.kind === 'tutorial' && S.tut) tutStart(S.tut.i); else startRun(S.kind); };
$('bMenu').onclick = $('bMenu2').onclick = () => { if (REC) LAST_REC = recFinish(); toMenu(); };
$('bPauseRp').onclick = () => { if (REC) { LAST_REC = recFinish(); } ui.pause.classList.add('hidden'); musicSetLevelPaused(false); replayStart(LAST_REC, 'menu'); };
$('bReplay').onclick = () => replayStart(LAST_REC, 'result');
$('bBestRp').onclick = () => replayStart(BEST[SET.diff], 'menu');
$('bLastRp').onclick = () => { closePanels(); replayStart(LAST_REC, 'menu'); };
$('bTut').onclick = openTutMenu; $('tutClose').onclick = () => $('tutMenu').classList.add('hidden');
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
    one('drop', '탑재물 투하') + one('boost', '부스트 (고속 복귀 구간, 누르고 있기)') + pair('cam', 'zoom', '카메라 전환 · 카메라 거리') + one('reset', '마지막 통과 지점에서 다시') + one('assist', '비행 보조 켜기/끄기');
  $('keys').innerHTML = `${n(KB.up)}/${n(KB.down)} ${'상승·하강'} &nbsp;${n(KB.yawL)}/${n(KB.yawR)} ${'회전'} &nbsp;${n(KB.fwd)}${n(KB.left)}${n(KB.back)}${n(KB.right)} ${'이동'}<br>${n(KB.drop)} ${'투하'} &nbsp;${n(KB.boost)} ${'부스트'} &nbsp;${n(KB.cam)} ${'카메라'} &nbsp;${n(KB.assist)} ${'보조'} &nbsp;B ${'음악'} &nbsp;Esc ${'일시정지'}`;
}
$('kbA').onclick = () => { KB = Object.assign({}, KB_PRESET.A); saveKB(); kbRender(); syncSeg(); $('kbHint').textContent = 'A · 기본 배치'; };
$('kbB').onclick = () => { KB = Object.assign({}, KB_PRESET.B); saveKB(); kbRender(); syncSeg(); $('kbHint').textContent = 'B · 방향키로 고도'; };
$('kbClose').onclick = () => { KBCAP = null; $('kbPanel').classList.add('hidden'); syncSeg(); };
// ---- 키보드 그림 ----
const KB_SHORT = { up: '상승', down: '하강', yawL: '좌회전', yawR: '우회전', fwd: '전진', back: '후진', left: '좌이동', right: '우이동', drop: '투하', boost: '부스트', cam: '카메라', zoom: '거리', reset: '다시', assist: '보조' };
const KB_GROUP = { up: 'alt', down: 'alt', yawL: 'alt', yawR: 'alt', fwd: 'mov', back: 'mov', left: 'mov', right: 'mov', boost: 'bst' };
const KB_FIXED = { KeyF: '전체화면', KeyV: '가이드', KeyX: '아래캠', KeyB: '음악', KeyG: '고스트', KeyN: '건너뛰기', KeyM: '소리', KeyL: '조명', KeyP: '경로선', Escape: '정지' };
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
$('bAgain').onclick = () => startRun(S.kind);
$('bOrtho').onclick = () => $('orthoFile').click();
$('orthoFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { await loadOrthoFile(f); } catch (err) { setOrthoStatus('실패: ' + (err && err.message ? err.message : err), '#ff6060'); }
  e.target.value = '';
});
$('bDem').onclick = () => $('demFile').click();
$('demFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) { window.__lastDemFile = f; demOpen(f); } e.target.value = ''; });
$('bOrthoReset').onclick = () => { resetGround(); IDB.del('ortho' + SITE_KEY); setOrthoStatus('기본 바닥 사용 중', ''); };
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
window.__sim = { advance, S, DR, IN, OBJS, OBJ, GH, startRun, keys, pressed, collide, setPose(p, v, h) { DR.p.copy(p); DR.v.copy(v); DR.h = h; DR.landed = false; }, W, camera, renderer, scene, SET, loadOrthoFile, course2utm, MODES, predictImpact, tutStart, LESSONS, replayStart, RP, get LAST_REC() { return LAST_REC; }, BEST, readDem, buildTerrainPkg, TER, SITE, EARTH, terrainAt, groundAt, agl,  music: () => ({ timer: !!MUS.timer, step: MUS.step, on: MUS.on }) };
})();
