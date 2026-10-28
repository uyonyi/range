// 미리 받기 작업 스레드 (공개판 lib/preload-worker.js · template.html 의 __preload 가 첫 화면에서 띄움)
//   입장 번호·인트로가 도는 동안 큰 그림을 받아 풀고 계산까지 끝내 둠 → 앱이 뜨면 바로 세밀한 나무·고해상 바닥
//   · 고급 나무: 모형(trees.json → 형상 배열)과 잎 그림(색 + 투명 → RGBA · 작아져도 잎이 덜 사라지는 밉맵)
//   · 바닥 사진: 저해상·고해상 webp 를 풀어 위아래를 뒤집은(three DataTexture 방향) RGBA 배열
//   메인 스레드는 받은 것으로 텍스처만 만들면 되므로 화면이 멈추지 않음
//   ※ rgbaFrom·coverageMips 는 game6t.js 와 같은 계산 (작업 스레드를 못 쓰는 브라우저·한 파일 판은 그쪽에서)
'use strict';
const get = (u, how) => fetch(u, { priority: 'low' }).then(r => r.ok ? r[how]() : Promise.reject(new Error('HTTP ' + r.status + ' ' + u)));
function pixels(bmp, W, H) { const cv = new OffscreenCanvas(W, H), g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data; cv.width = cv.height = 1; return d; }   // 캔버스 메모리는 바로 놓음 (작업 스레드는 끝나도 살아 있음)
// 색(불투명 RGB)·투명도(A) 그림 두 장을 합쳐 RGBA 배열로 (아래위 뒤집어 three 의 uv 와 맞춤)
function rgbaFrom(rgb, al) {
  const W = rgb.width, H = rgb.height, c = pixels(rgb, W, H), a = pixels(al, W, H), out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) { const sr = y * W * 4, dr = (H - 1 - y) * W * 4; for (let x = 0; x < W * 4; x += 4) { out[dr + x] = c[sr + x]; out[dr + x + 1] = c[sr + x + 1]; out[dr + x + 2] = c[sr + x + 2]; out[dr + x + 3] = a[sr + x]; } }
  return { data: out, width: W, height: H };
}
// 투명 잎 밉맵: 작아질수록 잎이 사라지지 않게 칸(512)별로 알파를 키워 덮는 면적을 원래와 맞춤 (2×2 평균 · 알파는 색과 따로)
function coverageMips(L0, thr) {
  const lv = [L0], T0 = 512, W0 = L0.width, nx = W0 / T0, ny = L0.height / T0, cov = new Float32Array(nx * ny);
  for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) { let n = 0; for (let y = ty * T0; y < (ty + 1) * T0; y += 2) for (let x = tx * T0; x < (tx + 1) * T0; x += 2) if (L0.data[(y * W0 + x) * 4 + 3] > thr) n++; cov[ty * nx + tx] = n / (T0 * T0 / 4); }
  let P = L0, A = new Float32Array(W0 * L0.height); for (let i = 0; i < A.length; i++) A[i] = L0.data[i * 4 + 3];
  while (P.width > 1 || P.height > 1) {
    const w = Math.max(1, P.width >> 1), h = Math.max(1, P.height >> 1), d = new Uint8Array(w * h * 4), A2 = new Float32Array(w * h), pw = P.width, pd = P.data;
    for (let y = 0; y < h; y++) { const ya = Math.min(P.height - 1, y * 2) * pw, yb = Math.min(P.height - 1, y * 2 + 1) * pw;   // 2×2 평균 (더하는 순서는 예전과 같아 결과도 같음)
      for (let x = 0; x < w; x++) { const xa = Math.min(pw - 1, x * 2), xb = Math.min(pw - 1, x * 2 + 1), i0 = ya + xa, i1 = ya + xb, i2 = yb + xa, i3 = yb + xb, o = (y * w + x) * 4;
        d[o] = (pd[i0 * 4] + pd[i1 * 4] + pd[i2 * 4] + pd[i3 * 4]) / 4; d[o + 1] = (pd[i0 * 4 + 1] + pd[i1 * 4 + 1] + pd[i2 * 4 + 1] + pd[i3 * 4 + 1]) / 4; d[o + 2] = (pd[i0 * 4 + 2] + pd[i1 * 4 + 2] + pd[i2 * 4 + 2] + pd[i3 * 4 + 2]) / 4; A2[y * w + x] = (A[i0] + A[i1] + A[i2] + A[i3]) / 4; } }
    const ts = T0 * w / W0;
    for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) {
      const x0 = Math.floor(tx * ts), y0 = Math.floor(ty * ts), x1 = Math.max(x0 + 1, Math.floor((tx + 1) * ts)), y1 = Math.max(y0 + 1, Math.floor((ty + 1) * ts)), want = cov[ty * nx + tx];
      let k = 1;
      if (ts >= 2 && want < 0.98) { let lo = 1, hi = 8; for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2; let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (A2[y * w + x] * m > thr) n++; if (n / ((x1 - x0) * (y1 - y0)) < want) lo = m; else hi = m; } k = (lo + hi) / 2; }
      else if (want < 0.98) k = 1.6;
      for (let y = y0; y < Math.min(h, y1); y++) for (let x = x0; x < Math.min(w, x1); x++) d[(y * w + x) * 4 + 3] = Math.min(255, A2[y * w + x] * k);
    }
    P = { data: d, width: w, height: h }; A = A2; lv.push(P);
  }
  return lv;
}
// 모형: JSON 배열 → 형상별 형식 배열 (그대로 넘겨 three 속성으로)
function geoArrays(o) {
  let mx = 0; for (const i of o.I) if (i > mx) mx = i;
  return { P: new Float32Array(o.P), N: new Int8Array(o.N), UV: new Uint16Array(o.UV), C: new Uint8Array(o.C), I: mx > 65535 ? new Uint32Array(o.I) : new Uint16Array(o.I) };
}
async function trees([uj, ur, ua]) {
  const [js, rb, ab] = await Promise.all([get(uj, 'json'), get(ur, 'blob'), get(ua, 'blob')]);
  const [rgb, al] = await Promise.all([createImageBitmap(rb), createImageBitmap(ab)]);
  const lv = coverageMips(rgbaFrom(rgb, al), 0.42 * 255); rgb.close(); al.close();
  const lods = js.lods.map(L => L.map(geoArrays)), tr = lv.map(l => l.data.buffer);
  lods.forEach(L => L.forEach(o => { for (const k in o) tr.push(o[k].buffer); }));
  postMessage({ k: 't', lv, lods }, tr);
}
// 바닥 사진: 풀어서 픽셀 배열로 · 위아래 뒤집기 (DataTexture 는 첫 줄이 아래) — ImageBitmap 을 그대로 넘기면 일부 환경에서 GPU 에 검게 올라가서 배열로 넘김
async function ground(u, k) {   // 4096² = 64 MB 라 복사본을 줄임: 그린 뒤 바로 놓고, 뒤집기는 제자리에서
  const b = await createImageBitmap(await get(u, 'blob')), W = b.width, H = b.height, cv = new OffscreenCanvas(W, H), g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(b, 0, 0); b.close(); const d = new Uint8Array(g.getImageData(0, 0, W, H).data.buffer); cv.width = cv.height = 1;
  const row = W * 4, tmp = new Uint8Array(row);
  for (let y = 0, z = H - 1; y < z; y++, z--) { const a = y * row, c = z * row; tmp.set(d.subarray(a, a + row)); d.copyWithin(a, c, c + row); d.set(tmp, c); }
  postMessage({ k, w: W, h: H, data: d }, [d.buffer]);
}
function start({ t, g }) {
  const fail = k => err => postMessage({ k, err: String(err && err.message || err) });
  if (g) g.forEach((u, i) => u && ground(u, 'g' + i).catch(fail('g' + i)));
  if (t) trees(t).catch(fail('t'));
}
// 일감은 작업 스레드 이름(name)으로 받아 바로 시작: 메시지는 앱 스크립트가 화면 스레드를 잡고 있는 동안 전달이 미뤄짐
//   (주소 # 는 서비스 워커가 캐시에서 줄 때 사라짐) · 메시지는 만일을 위한 예비 (먼저 온 것 하나만)
// 그림 도구(2D 캔버스)는 작업 스레드에서 처음 만들 때 화면 스레드를 한 번 거침 → 받기를 걸어 둔 뒤 바로 만들어 두고 알림 ('warm')
//   화면 스레드는 이 알림을 받은 뒤(최대 0.4초) 앱 본체를 불러옴 — 앱이 화면 스레드를 오래 잡아도 이후 계산은 여기서 나란히 진행
function warm() { try { const g = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true }); g.fillRect(0, 0, 1, 1); g.getImageData(0, 0, 1, 1); } catch (e) { } postMessage({ k: 'warm' }); }   // 그리고 읽기까지 해야 준비됨
let started = false;
function go(job) { if (started || !job || typeof job !== 'object') return; started = true; start(job); warm(); }
try { go(JSON.parse(self.name)); } catch (e) { }
self.onmessage = e => go(e.data);
