
// =====================================================================
//  위성사진 (ortho.tif, EPSG:32652) 불러오기 -> 코스 좌표에 맞춰 바닥에 입힘
// =====================================================================
// 코스 좌표 -> 현재 현장의 투영 좌표 (SITE.crs)
const SITE_X = siteXform(SITE);
function course2utm(down, side) { return SITE_X.toEN(down, side); }
const ORTHO_N = 4096;
const IDB = {
  open() { return new Promise((res, rej) => { try { const r = indexedDB.open('hroc_fpv', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); },
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
  if (!(opt && opt.nosave)) cv.toBlob(bl => { if (bl) IDB.put('ortho' + SITE_KEY, bl); }, 'image/jpeg', 0.9);
  return { res: rx * step * mk, cover: pct, srcRes: res0 };
}
// 현장 기본 정사영상 (sites/*.tif, 현장 데이터의 ortho 항목) — 사용자가 올린 사진이 없을 때 자동으로 입힘
async function autoOrtho() {
  if (!SITE.ortho) return false;
  try {
    setOrthoStatus('현장 정사영상 불러오는 중…', '#ffc828');
    const r = await fetch(SITE.ortho); if (!r.ok) throw new Error('HTTP ' + r.status);
    const bl = await r.blob(); await loadOrthoFile(bl, { nosave: true });
    setOrthoStatus(setOrthoStatusTxt() + ' · ' + ((window.SIM_LANG === 'en' && SITE.orthoSrc_en) || SITE.orthoSrc || ''), '#5dff9a'); return true;
  } catch (e) { setOrthoStatus('정사영상 없음 (기본 바닥)', ''); return false; }
}
function setOrthoStatusTxt() { const el = $('orthoStatus'); return el ? el.textContent : ''; }
async function restoreOrtho() {
  const bl = await IDB.get('ortho' + SITE_KEY); if (!bl) { autoOrtho(); return; }
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
    localStorage.setItem('hroc_site_custom', JSON.stringify(pkg)); siteSelect('custom');
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
    let b = null; try { b = parseFloat(localStorage.getItem('hroc_fpv_best_' + d + SITE_KEY)); } catch (e) { }
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
  let b = null; try { b = parseFloat(localStorage.getItem('hroc_fpv_best_' + SET.diff)); } catch (e) { }
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
