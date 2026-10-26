// 현장 바닥 사진 미리 만들기: 정사영상 GeoTIFF → 코스 좌표에 맞춘 4096² 바닥 텍스처(WebP) + 1024² 저해상 (먼저 보여 줄 용도)
// 사용: 공개 빌드를 띄운 http 서버 주소를 주면 그 페이지 안의 정사영상 변환 코드를 그대로 써서 저장한다
//   node tools/mk_ground.js http://localhost:8767/index.html sites/yeongin_ground   → sites/yeongin_ground.webp · _lo.webp
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [url, out] = process.argv.slice(2); if (!url || !out) { console.log('usage: node mk_ground.js URL OUTBASE'); process.exit(1); }
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'test&noground', { timeout: 180000 });
  // 정사영상이 적용될 때까지 기다림 (상태 문구)
  await p.waitForFunction(() => { const e = document.getElementById('orthoStatus'); return e && /적용됨|applied|없음/.test(e.textContent); }, null, { timeout: 300000 });
  const st = await p.evaluate(() => document.getElementById('orthoStatus').textContent); console.log('status:', st);
  const save = async (n, q, suffix) => { const d = await p.evaluate(([n, q]) => { const src = __sim.groundCanvas(); if (!src) return null; const cv = document.createElement('canvas'); cv.width = cv.height = n; cv.getContext('2d').drawImage(src, 0, 0, n, n); return cv.toDataURL('image/webp', q); }, [n, q]);
    if (!d) throw new Error('no ground canvas'); const buf = Buffer.from(d.split(',')[1], 'base64'); fs.writeFileSync(out + suffix + '.webp', buf); console.log(out + suffix + '.webp', (buf.length / 1024).toFixed(0), 'KB'); };
  await save(4096, 0.80, ''); await save(1024, 0.78, '_lo');
  await b.close(); })();
