// FPV Terrain Trainer · service worker (자동 생성: src/build.py)
const VER = 'd4e4f4c5fa', CACHE = 'fpvsim-' + VER, CORE = ["icons/favicon-32.png", "icons/icon-192.png", "lib/preload-worker.js?v=a968eac5", "lib/proj4.js", "lib/three.min.js", "lib/trees.json?v=789408ab", "lib/trees_a.webp?v=789408ab", "lib/trees_rgb.webp?v=789408ab", "manifest.en.webmanifest", "manifest.webmanifest", "sites/yeongin.js?v=7804484e", "sites/yeongin_ground.webp?v=853664ca", "sites/yeongin_ground_lo.webp?v=af40bcdf"];
// 설치: 핵심 파일을 받아 둠 · 주소에 버전(?v=)이 붙은 파일은 옛 캐시에 같은 것이 있으면 옮기기만 (나무·바닥 사진 같은 큰 파일을 판이 바뀔 때마다 다시 받지 않게)
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => (/[?&]v=/.test(u) ? caches.match(u) : Promise.resolve(null)).then(m => m ? c.put(u, m) : c.add(u))))).then(() => self.skipWaiting())); });
// 페이지가 알려 준 자기 파일(페이지·앱 코드)을 캐시에 담음 (이미 받은 직후라 대개 브라우저 캐시에서 바로)
self.addEventListener('message', e => { const L = e.data && e.data.add; if (!Array.isArray(L)) return; e.waitUntil(caches.open(CACHE).then(c => Promise.all(L.slice(0, 8).map(u => { let x; try { x = new URL(u, self.location.href); } catch (er) { return null; } if (x.origin !== location.origin) return null; return c.match(x.href).then(m => m || c.add(x.href).catch(() => {})); })))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('fpvsim-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || r.headers.has('range')) return; const u = new URL(r.url); if (u.origin !== location.origin) return;   // 영상(부분 요청)은 브라우저에 맡김
  if (/\/lib\/intro(_lo)?\.(mp4|webm)$/.test(u.pathname)) return;   // 첫 화면 영상은 페이지가 직접 담아 둠 (Cache API 'fpv-boot') — 같은 3 MB 를 두 번 담지 않게
  if (r.mode === 'navigate') {   // 페이지: 네트워크 먼저 (새 버전 바로 반영), 안 되면 캐시
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match(u.pathname.endsWith('/') ? u.pathname + 'index.html' : r))));
    return;
  }
  // 나머지: 캐시 먼저 (?v= 로 버전이 붙어 있어 안전), 없으면 받아서 캐시 (음성 조각·GeoTIFF 해석기 등)
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok && (res.type === 'basic' || res.type === 'default')) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })));
});
