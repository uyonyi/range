
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
    if (!window.GeoTIFF && !(window.ensureGeoTIFF && await window.ensureGeoTIFF())) throw new Error('GeoTIFF 해석기가 없습니다');
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
