
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
function dropGroundMap() { const m = groundMat.map; if (m && m !== groundMacro) m.dispose(); }
function applyGroundTex(t) {
  t.encoding = THREE.sRGBEncoding; t.anisotropy = Math.min(16, MAXANI);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  dropGroundMap(); groundMat.map = t; groundMat.needsUpdate = true; detailK.value = 0.45;
}
function applyGroundCanvas(cv) { applyGroundTex(new THREE.CanvasTexture(cv)); }
function applyGroundData(d) { const t = new THREE.DataTexture(d.data, d.w, d.h, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.needsUpdate = true; applyGroundTex(t); }   // 작업 스레드가 풀어 위아래까지 뒤집어 둔 픽셀 (preload-worker.js)
function resetGround() { dropGroundMap(); groundMat.map = groundMacro; groundMat.needsUpdate = true; detailK.value = 1; }
// GeoTIFF 해석기는 사진·DEM 파일을 직접 올릴 때만 필요 → 그때 불러옴 (공개판: lib/geotiff.js)
const _scriptP = {};
function loadScriptOnce(url) { return _scriptP[url] || (_scriptP[url] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = () => res(); s.onerror = () => { delete _scriptP[url]; rej(new Error('load ' + url)); }; document.head.appendChild(s); })); }
async function ensureGeoTIFF() { if (window.GeoTIFF) return true; if (!window.SIM_GEOTIFF_URL) return false; try { await loadScriptOnce(window.SIM_GEOTIFF_URL); } catch (e) { } return !!window.GeoTIFF; }
window.ensureGeoTIFF = ensureGeoTIFF;
// 미리 만들어 둔 바닥 사진 (sites/*_ground.webp · tools/mk_ground.js): 저해상을 먼저 입히고 고해상으로 바꿈 — GeoTIFF 해석·재투영 없이 바로
function loadImg(url) { return new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => im.decode ? im.decode().then(() => res(im), () => res(im)) : res(im); im.onerror = () => rej(new Error('img ' + url)); im.src = url; }); }   // decode: 그림 풀기를 화면 스레드 밖에서
async function autoGroundImg() {
  if (!SITE.ground || /[?&]noground/.test(location.search)) return false;   // ?noground: 정사영상에서 다시 만들 때 (tools/mk_ground.js)
  const base = (/^(https?:|\/)/.test(SITE.ground) ? '' : (window.SIM_BASE || ''));
  const put = im => { const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext('2d').drawImage(im, 0, 0); applyGroundCanvas(cv); };
  const P = window.__preload && window.__preload(), G = P && P.ground;   // 첫 화면 동안 작업 스레드가 받아 풀어 둔 저해상·고해상 (화면 스레드는 텍스처만)
  if (P) P.ground = null;   // 한 번만 씀 (안 쓰면 큰 배열을 놓아 줌)
  if (G && G.src === SITE.ground) {
    try {
      let hiOn = false; const fits = d => d.w <= renderer.capabilities.maxTextureSize;   // 너무 큰 텍스처를 못 받는 기기는 예전 방식(캔버스가 줄여 줌)
      if (G.lo && SITE.groundLo) G.lo.then(d => { if (!hiOn && fits(d)) { applyGroundData(d); setOrthoStatus('정사영상 (저해상) · 고해상 받는 중…', '#ffc828'); } }, () => { });
      const d = await Promise.race([G.hi, new Promise(res => setTimeout(() => res(null), 60000))]);   // 1분 안에 못 받으면(멈춤 등) 예전 방식
      if (!d || !fits(d)) throw new Error('no preload'); hiOn = true; applyGroundData(d);
      setOrthoStatus('위성사진 적용됨 · ' + ((window.SIM_LANG === 'en' && SITE.orthoSrc_en) || SITE.orthoSrc || ''), '#5dff9a'); return true;
    } catch (e) { }   // 안 되면 아래 예전 방식으로
  }
  try {
    if (SITE.groundLo) { try { put(await loadImg(base + SITE.groundLo)); setOrthoStatus('정사영상 (저해상) · 고해상 받는 중…', '#ffc828'); } catch (e) { } }
    put(await loadImg(base + SITE.ground));
    setOrthoStatus('위성사진 적용됨 · ' + ((window.SIM_LANG === 'en' && SITE.orthoSrc_en) || SITE.orthoSrc || ''), '#5dff9a'); return true;
  } catch (e) { return false; }
}
async function loadOrthoFile(file, opt) {
  if (!window.GeoTIFF && !(await ensureGeoTIFF())) throw new Error('GeoTIFF 해석기가 없습니다');
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
  if (await autoGroundImg()) return true;
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
  const P = window.__preload && window.__preload(); if (P) P.ground = null;   // 직접 올린 사진을 쓰면 미리 받은 바닥 사진은 놓아 줌
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
const BFN = (function () { const e = window.SIM_LANG === 'en', P = { drop: ['투하 · 사진 보고', 'Drop / photo report'], cam: ['카메라 전환', 'Camera'], reset: ['다시 시작', 'Restart'], boost: ['부스트 (누르는 동안)', 'Boost (hold)'], pause: ['일시정지', 'Pause'], assist: ['보조 켜기/끄기', 'Assist on/off'], guide: ['안내 단계', 'Nav level'], zoom: ['추적 카메라 거리', 'Chase camera distance'], belly: ['아래 카메라', 'Belly camera'], light: ['조명', 'Light'], ir: ['열화상', 'Thermal'], hud: ['UI 숨기기', 'Hide UI'], photo: ['사진 보고 (Enter)', 'Photo report (Enter)'] }; const o = {}; for (const k in P) o[k] = P[k][e ? 1 : 0]; return o; })();
// VR 컨트롤러: 기능 → 입력 (L/R + 단추 번호: 0 트리거 · 1 그립 · 3 스틱 누르기 · 4 X/A · 5 Y/B) · SET.vrBtn 에 저장
const VR_IN = { L0: ['L 트리거', 'L trigger'], L1: ['L 그립', 'L grip'], L3: ['L 스틱 누르기', 'L stick click'], L4: ['X', 'X'], L5: ['Y', 'Y'], R0: ['R 트리거', 'R trigger'], R1: ['R 그립', 'R grip'], R3: ['R 스틱 누르기', 'R stick click'], R4: ['A', 'A'], R5: ['B', 'B'] };
const VR_FN = { drop: ['투하 · 사진 보고', 'Drop / photo report'], photo: ['사진 보고 (Enter)', 'Photo report (Enter)'], menu: ['메뉴', 'Menu'], boost: ['부스트 (누르는 동안)', 'Boost (hold)'], cam: ['시점 (FPV · 추적)', 'View (FPV / chase)'], pip: ['하부 카메라 각도', 'Lower camera angle'], ir: ['열화상', 'Thermal'], light: ['조명', 'Light'], guide: ['안내 단계', 'Nav level'], assist: ['보조 켜기/끄기', 'Assist on/off'], reset: ['다시 시작', 'Restart'], hud: ['UI 숨기기', 'Hide UI'] };
const VR_FN_DEF = { drop: 'R0', photo: 'R4', menu: 'R5', boost: 'L0', cam: 'L3', pip: 'L5', ir: 'R3', light: 'L4' };
function vrBtnMap() { return Object.assign({}, VR_FN_DEF, SET.vrBtn || {}); }
let detect = null, calRun = null;
function rcOpen() { if (typeof closePanels === 'function') closePanels(); RCUI.open = true; $('rcPanel').classList.remove('hidden'); rcBuild(); }   // 옵션 창 위가 아니라 그 자리에
function rcClose() { RCUI.open = false; detect = null; calRun = null; $('rcPanel').classList.add('hidden'); saveRC(); }
function axName(a) { return `축 ${a.i}${a.inv ? ' (반전)' : ''}`; }
function bName(b) { return !b ? '없음' : b.type === 'btn' ? `버튼 ${b.i}` : `축 ${b.i} ${b.sign > 0 ? '+' : '−'}`; }
function rcBuild() {
  let h = '';
  for (const k in FN) h += `<tr><td>${FN[k]}</td><td class="mono" id="rcA_${k}">${axName(RC.axes[k])}</td><td><div class="bar"><i id="rcV_${k}"></i></div></td><td><button data-det="${k}">감지</button> <button data-inv="${k}">반전</button></td></tr>`;
  for (const k in BFN) h += `<tr><td>${BFN[k]}</td><td class="mono" id="rcB_${k}">${bName(RC.btn[k])}</td><td></td><td><button data-detb="${k}">감지</button>${RC.btn[k] ? ` <button data-clr="${k}" class="mini">${L2x('지움', 'Clear')}</button>` : ''}</td></tr>`;
  $('rcTable').innerHTML = h;
  $('rcTable').querySelectorAll('[data-clr]').forEach(b => b.onclick = () => { delete RC.btn[b.dataset.clr]; rcBuild(); });
  // VR 판: 컨트롤러 단추 기능 표 (고르기) — 헤드셋을 쓰기 전 2D 메뉴에서
  const vt = $('rcVr'); if (vt) { const m = vrBtnMap(), en = window.SIM_LANG === 'en', opt = (cur) => `<option value=""${cur ? '' : ' selected'}>${en ? 'none' : '없음'}</option>` + Object.keys(VR_IN).map(i => `<option value="${i}"${m && cur === i ? ' selected' : ''}>${VR_IN[i][en ? 1 : 0]}</option>`).join('');
    vt.innerHTML = Object.keys(VR_FN).map(f => `<tr><td>${VR_FN[f][en ? 1 : 0]}</td><td><select data-vrfn="${f}">${opt(m[f])}</select></td></tr>`).join('');
    vt.querySelectorAll('select').forEach(sl => sl.onchange = () => { SET.vrBtn = SET.vrBtn || {}; SET.vrBtn[sl.dataset.vrfn] = sl.value || null; saveSet(); rcBuild(); });
    const dup = {}; Object.keys(VR_FN).forEach(f => { if (m[f]) (dup[m[f]] = dup[m[f]] || []).push(f); }); const dd = Object.values(dup).filter(a => a.length > 1);
    $('rcVrHint').textContent = dd.length ? (en ? 'Same button used twice: ' : '같은 단추에 둘 이상: ') + dd.map(a => a.map(f => VR_FN[f][en ? 1 : 0]).join(' = ')).join(' · ') : ''; }
  $('rcTable').querySelectorAll('[data-det]').forEach(b => b.onclick = () => { detect = { kind: 'axis', fn: b.dataset.det, base: null }; $('rcHint').textContent = `${FN[b.dataset.det]}: 해당 스틱을 위(또는 오른쪽) 끝까지 밀었다가 놓으세요.`; });
  $('rcTable').querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { RC.axes[b.dataset.inv].inv = !RC.axes[b.dataset.inv].inv; rcBuild(); });
  $('rcTable').querySelectorAll('[data-detb]').forEach(b => b.onclick = () => { detect = { kind: 'btn', fn: b.dataset.detb, base: null }; $('rcHint').textContent = `${BFN[b.dataset.detb]}: 쓸 버튼이나 스위치를 누르세요(켜세요).`; });
  document.querySelectorAll('#rcThr button').forEach(b => b.classList.toggle('on', b.dataset.v === RC.thrType));
  if (stickMode() === 1 && JSON.stringify(RC.axes) === RC_DEF_AX) $('rcHint').textContent = L2x('조종기 모드 1: 게임패드 기본 축의 스로틀과 피치를 바꿔 씁니다 (왼쪽 스틱 전진·회전 / 오른쪽 스틱 상승·좌우).', 'Mode 1: throttle and pitch are swapped on the default gamepad axes (left stick fwd·yaw / right stick climb·strafe).');
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
  if ($('rcVrReset')) $('rcVrReset').onclick = () => { SET.vrBtn = {}; saveSet(); rcBuild(); };
  document.querySelectorAll('#rcThr button').forEach(b => b.onclick = () => { RC.thrType = b.dataset.v; rcBuild(); });
}

// =====================================================================
//  menu / UI wiring
// =====================================================================
document.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => startRun(b.dataset.start)));
function syncSeg() {
  document.querySelectorAll('#segDiff button').forEach(b => b.classList.toggle('on', b.dataset.v === SET.diff));
  let afOk = false; try { afOk = !!AF; } catch (e) { }   // game5 보다 먼저 불릴 수 있음
  document.querySelectorAll('#segMode button').forEach(b => { b.classList.toggle('on', b.dataset.v === SET.mode); if (b.dataset.v === 'acro' && afOk) b.disabled = !AFc().acro; });
  document.querySelectorAll('#segAssistLv button').forEach(b => b.classList.toggle('on', +b.dataset.v === SET.assistLv));
  document.querySelectorAll('#segFeel button').forEach(b => b.classList.toggle('on', b.dataset.v === SET.feel));
  document.querySelectorAll('#segThrHover button').forEach(b => b.classList.toggle('on', b.dataset.v === (SET.thrHover || 'auto')));
  document.querySelectorAll('#segRumble button').forEach(b => b.classList.toggle('on', +b.dataset.v === (SET.rumble == null ? 1 : +SET.rumble)));
  document.querySelectorAll('#segRumble button').forEach(b => b.addEventListener('click', () => { SET.rumble = +b.dataset.v; saveSet(); syncSeg(); rumble(0.6, 0.6, 200); }));
document.querySelectorAll('#segBoostFov button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === (SET.boostFov !== 0)));
  { const r = feelRates('p'), y = feelRates('y'); ['rc0', 'rc1', 'rc2'].forEach((id, i) => { const e = $(id); if (e && document.activeElement !== e) e.value = r[i]; }); ['ry0', 'ry1', 'ry2'].forEach((id, i) => { const e = $(id); if (e && document.activeElement !== e) e.value = y[i]; });
    const pre = Object.keys(RATE_PRESET).find(k => k !== 'real' && RATE_PRESET[k].join() === r.join()); document.querySelectorAll('#segRatePre button').forEach(b => b.classList.toggle('on', b.dataset.v === pre));
    if ($('rcV')) $('rcV').textContent = `반스틱 ${actualRate(0.5, r[0], r[1], r[2]).toFixed(0)}°/s · 풀스틱 ${r[1]}°/s`;
    const a = afOk ? AFc() : {}; if ($('hovV')) $('hovV').textContent = a.twr ? `정지 비행 ≈ ${Math.round(hoverThr(a.twr, 0.05) * 100)}% (추력비 ${a.twr})` : ''; document.body.classList.toggle('acroOk', !!a.acro); }
  if ($('camDist')) { const d = zoomCfg().d; $('camDist').value = d; $('camDistV').textContent = d.toFixed(1) + ' m'; document.querySelectorAll('#zoomPre button').forEach(b => b.classList.toggle('on', Math.abs(ZOOMS[+b.dataset.v].d - d) < 0.05)); }
  if ($('fov')) { $('fov').value = SET.fov || 82; $('fovV').textContent = (SET.fov || 82) + '°'; }
  document.querySelectorAll('#segGhost button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === SET.ghost));
  document.querySelectorAll('#segAssist button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === SET.assist));
  document.querySelectorAll('#segKeys button').forEach(b => b.classList.toggle('on', b.dataset.v === kbWhich())); kbHelp();
  document.querySelectorAll('#segGhostSrc button').forEach(b => b.classList.toggle('on', b.dataset.v === SET.ghostSrc));
  document.querySelectorAll('#segBelly button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === SET.belly));
  document.querySelectorAll('#segFull button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === SET.autoFull));
  glSync();   // 안내 단계 (옵션 · GD 버튼 글자)
  document.querySelectorAll('#segMusic button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === MUS.on));
  document.querySelectorAll('#segMusSyn button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === !!SET.musSynth));
  $('tilt').value = SET.tilt; $('tiltV').textContent = SET.tilt + '°'; $('mvol').value = Math.round(MUS.vol * 100);
}
document.querySelectorAll('#segDiff button').forEach(b => b.addEventListener('click', () => { setDiff(b.dataset.v); saveSet(); syncSeg(); refreshBest(); }));
const modeChanged = () => { modeSync(); saveSet(); syncSeg(); refreshBest(); if (typeof afUI === 'function') afUI(); if (typeof updateTags === 'function') updateTags(); };
document.querySelectorAll('#segMode button').forEach(b => b.addEventListener('click', () => { SET.mode = b.dataset.v; modeChanged(); }));
document.querySelectorAll('#segAssistLv button').forEach(b => b.addEventListener('click', () => { SET.assistLv = +b.dataset.v; modeChanged(); }));
document.querySelectorAll('#segFeel button').forEach(b => b.addEventListener('click', () => { SET.feel = b.dataset.v; if (SET.feel !== 'std') SET.rates = SET.ratesY = RATE_PRESET[SET.feel].slice(); else SET.rates = SET.ratesY = RATE_PRESET.std.slice(); modeChanged(); }));
document.querySelectorAll('#segRatePre button').forEach(b => b.addEventListener('click', () => { SET.rates = RATE_PRESET[b.dataset.v].slice(); SET.ratesY = RATE_PRESET[b.dataset.v].slice(); saveSet(); syncSeg(); }));
const rateIn = (ids, key) => ids.forEach((id, i) => { const e = $(id); if (!e) return; e.addEventListener('change', () => { const r = feelRates(key === 'rates' ? 'p' : 'y').slice(); r[i] = Math.max(+e.min, Math.min(+e.max, +e.value || 0)); SET[key] = r; saveSet(); syncSeg(); }); });
rateIn(['rc0', 'rc1', 'rc2'], 'rates'); rateIn(['ry0', 'ry1', 'ry2'], 'ratesY');
document.querySelectorAll('#segThrHover button').forEach(b => b.addEventListener('click', () => { SET.thrHover = b.dataset.v; saveSet(); syncSeg(); }));
document.querySelectorAll('#segBoostFov button').forEach(b => b.addEventListener('click', () => { SET.boostFov = +b.dataset.v; saveSet(); syncSeg(); }));
if ($('camDist')) $('camDist').addEventListener('input', () => { SET.camDist = +$('camDist').value; saveSet(); syncSeg(); });
document.querySelectorAll('#zoomPre button').forEach(b => b.addEventListener('click', () => { SET.zoom = +b.dataset.v; SET.camDist = ZOOMS[SET.zoom].d; saveSet(); syncSeg(); }));
if ($('fov')) $('fov').addEventListener('input', () => { SET.fov = +$('fov').value; saveSet(); syncSeg(); });
document.querySelectorAll('#camPre button').forEach(b => b.addEventListener('click', () => { const P = { novice: [12, 90], std: [15, 82], racer: [25, 110] }[b.dataset.v]; SET.tilt = P[0]; SET.fov = P[1]; saveSet(); syncSeg(); }));
document.querySelectorAll('#segGhost button').forEach(b => b.addEventListener('click', () => { SET.ghost = b.dataset.v === '1'; saveSet(); syncSeg(); }));
document.querySelectorAll('#segAssist button').forEach(b => b.addEventListener('click', () => { SET.assist = b.dataset.v === '1'; saveSet(); syncSeg(); }));
document.querySelectorAll('#segBelly button').forEach(b => b.addEventListener('click', () => { SET.belly = b.dataset.v === '1'; saveSet(); syncSeg(); }));
document.querySelectorAll('#segFull button').forEach(b => b.addEventListener('click', () => { SET.autoFull = b.dataset.v === '1'; saveSet(); syncSeg(); }));
const PANELS = ['setPanel', 'recPanel', 'helpPanel', 'optPanel', 'ctlPanel'];
function openPanel(id) { PANELS.forEach(p => $(p).classList.toggle('hidden', p !== id)); if (id === 'recPanel') renderRecords(); if (id === 'helpPanel') kbHelp(); }
function closePanels() { let any = false; PANELS.concat(['tutMenu', 'kbPanel']).forEach(p => { if (!$(p).classList.contains('hidden')) any = true; $(p).classList.add('hidden'); }); KBCAP = null; if (any) try { if (MENU.step === 1) pilotSetUI(); } catch (e) { } return any; }
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
document.querySelectorAll('#segMusSyn button').forEach(b => b.addEventListener('click', () => { SET.musSynth = b.dataset.v === '1'; saveSet(); syncSeg(); initAudio(); musicStart(); }));   // 배경음악 음색: 실제 악기 녹음 / 합성
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
  $('keys').innerHTML = `${n(KB.up)}/${n(KB.down)} ${'상승·하강'} &nbsp;${n(KB.yawL)}/${n(KB.yawR)} ${'회전'} &nbsp;${n(KB.fwd)}${n(KB.left)}${n(KB.back)}${n(KB.right)} ${'이동'}<br>${n(KB.drop)} ${'투하'} &nbsp;${n(KB.boost)} ${'부스트'} &nbsp;${n(KB.cam)} ${'카메라'} &nbsp;${n(KB.assist)} ${'보조'} &nbsp;B ${'음악'} &nbsp;0 ${'UI 숨김'} &nbsp;Esc ${'일시정지'}`;
}
$('kbA').onclick = () => { KB = Object.assign({}, KB_PRESET.A); saveKB(); kbRender(); syncSeg(); $('kbHint').textContent = 'A · 기본 배치'; };
$('kbB').onclick = () => { KB = Object.assign({}, KB_PRESET.B); saveKB(); kbRender(); syncSeg(); $('kbHint').textContent = 'B · 방향키로 고도'; };
$('kbClose').onclick = () => { KBCAP = null; $('kbPanel').classList.add('hidden'); syncSeg(); };
// ---- 키보드 그림 ----
const KB_SHORT = { up: '상승', down: '하강', yawL: '좌회전', yawR: '우회전', fwd: '전진', back: '후진', left: '좌이동', right: '우이동', drop: '투하', boost: '부스트', cam: '카메라', zoom: '거리', reset: '다시', assist: '보조' };
const KB_GROUP = { up: 'alt', down: 'alt', yawL: 'alt', yawR: 'alt', fwd: 'mov', back: 'mov', left: 'mov', right: 'mov', boost: 'bst' };
const KB_FIXED = { KeyF: '전체화면', KeyV: '가이드', KeyX: '아래캠', KeyB: '음악', KeyN: '건너뛰기', KeyT: '열화상', KeyM: '소리', KeyL: '조명', KeyP: '경로선', Escape: '정지' };
KB_FIXED.KeyJ = L2x('지도 크게', 'Big map'); if (!KB_RESERVED.includes('KeyJ')) KB_RESERVED.push('KeyJ');
KB_FIXED.KeyV = L2x('안내 단계', 'Nav aids');
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
document.querySelectorAll('#segGuide button').forEach(b => b.addEventListener('click', () => glSet(+b.dataset.v, true)));   // 메뉴에서 = 다음 출격에 · 비행 중(일시정지 옵션) = 이 판에
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
// 앱으로 설치 (PWA): 브라우저가 설치를 허락하면(beforeinstallprompt) 첫 화면에 버튼 표시 · 이미 설치된 창에서는 숨김
{ let dp = null; const bi = $('bInstall');
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); dp = e; if (bi && !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) bi.classList.remove('hidden'); });
  addEventListener('appinstalled', () => { dp = null; if (bi) bi.classList.add('hidden'); });
  if (bi) bi.onclick = async () => { if (!dp) return; dp.prompt(); try { await dp.userChoice; } catch (e) { } dp = null; bi.classList.add('hidden'); }; }
loadBest(); rcWire(); syncSeg(); refreshBest(); restoreOrtho(); siteUI();
setInterval(() => { const gp = getPad(); const el = $('padStatus'); if (el) el.textContent = gp ? '🎮 ' + gp.id.replace(/\(.*?\)/g, '').slice(0, 48) + (gp.mapping === 'standard' ? ' · 표준 배치' : '') : ''; }, 1000);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
resetDrone(startPos(), startHead());
if (!TEST) requestAnimationFrame(frame);
let fakeNow = 0;
function advance(sec, step, skipRender) { step = step || 1 / 60; const n = Math.max(1, Math.round(sec / step)); if (!fakeNow) fakeNow = last; for (let i = 0; i < n; i++) { fakeNow += step * 1000; frame(fakeNow, skipRender || i < n - 1); } }

// 시험용 핸들
// 테스트용: 배경음악을 오프라인으로 그려 WAV(16비트) 로 돌려줌 (스타일 확인용 · ?test 에서만 씀)
async function renderMusic(style, dur, state, kind, cue, vol) {   // cue: 정해진 곡(인트로 음악 등) — 악기 함수를 받아 직접 음을 놓음 (tools/intro/music.js)
  if (!window.SIM_NOSMP && SMP.st !== 'fail') { initAudio(); await smpLoad(); }   // 녹음 악기 (있으면)
  const sr = 44100, off = new OfflineAudioContext(2, Math.ceil(sr * dur), sr); let fakeT = 0; Object.defineProperty(off, 'currentTime', { get: () => fakeT });
  const keep = { ctx: AU.ctx, master: AU.master, noise: AU.noise, bus: MUS.bus, duck: MUS.duck, dly: MUS.dly, timer: MUS.timer, next: MUS.next, step: MUS.step, ch: MUS.ch, revIn: MUS.revIn, state: S.state, kind: S.kind, on: MUS.on, vol: MUS.vol };
  const nb = off.createBuffer(1, sr * 2, sr); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  AU.ctx = off; AU.master = off.createGain(); AU.master.gain.value = 0.9; AU.master.connect(off.destination); AU.noise = nb; MUS.bus = null; MUS.timer = null; MUS.on = true; MUS.vol = vol || 0.8;
  S.state = state || 'run'; S.kind = kind || 'ridge'; SONG.style = style; SONG.want = style; SONG.prog = null; SONG.sec = 0; SONG.bar = 0; SONG.rnd = (() => { let x = 12345; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
  musicStart(); clearInterval(MUS.timer);
  if (cue) cue({ sp, timpani, brass, strings, harp, swellCym, smpPad, osnare, mf, smpOn: smpOn() }); else for (fakeT = 0; fakeT < dur; fakeT += 0.1) musicSchedule();
  const buf = await off.startRendering();
  Object.assign(AU, { ctx: keep.ctx, master: keep.master, noise: keep.noise }); Object.assign(MUS, { bus: keep.bus, duck: keep.duck, dly: keep.dly, timer: keep.timer, next: keep.next, step: keep.step, ch: keep.ch, revIn: keep.revIn, on: keep.on, vol: keep.vol }); S.state = keep.state; S.kind = keep.kind;
  const n = buf.length, out = new DataView(new ArrayBuffer(44 + n * 4)); const w = (o, s2) => { for (let i = 0; i < s2.length; i++) out.setUint8(o + i, s2.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), Rr = buf.getChannelData(1); let peak = 0; for (let i = 0; i < n; i++) { const a = Math.max(-1, Math.min(1, L[i])), b = Math.max(-1, Math.min(1, Rr[i])); peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i])); out.setInt16(44 + i * 4, a * 32767, true); out.setInt16(46 + i * 4, b * 32767, true); }
  let bin = ''; const u8 = new Uint8Array(out.buffer); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return { wav: btoa(bin), peak };
}
window.__sim = { toMenu: () => toMenu(), COMMref: () => COMM, irCycle: () => irCycle(), ENVref: () => ENV, RVst: () => RV.st, MSref: () => MS, comm: (a, b, c) => comm(a, b, c), MOTORerr: () => MOTOR.err || null, AUref: () => AU, SMPst: () => SMP.st + (SMP.err ? " " + SMP.err : "") + " lag=" + (SMP.lag || 0).toFixed(4), groundCanvas: () => (groundMat.map && groundMat.map.image && groundMat.map.image.getContext ? groundMat.map.image : null), modeSync, setDiff, actualRate, hoverThr, renderMusic, STREES, groundAt, SET, advance, S, DR, IN, OBJS, OBJ, GH, startRun, keys, pressed, collide, setPose(p, v, h) { DR.p.copy(p); DR.v.copy(v); DR.h = h; DR.landed = false; }, W, camera, renderer, scene, SET, loadOrthoFile, course2utm, MODES, predictImpact, tutStart, LESSONS, replayStart, RP, get LAST_REC() { return LAST_REC; }, BEST, readDem, buildTerrainPkg, TER, SITE, EARTH, terrainAt, groundAt, agl,  music: () => ({ timer: !!MUS.timer, step: MUS.step, on: MUS.on, style: SONG.style, sec: SECTIONS[SONG.sec].n, bar: SONG.bar, prog: SONG.prog && SONG.prog.map(c => c[0]).join(","), motif: SONG.motif && SONG.motif.join(" ") }) };
