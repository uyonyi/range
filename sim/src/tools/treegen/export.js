// 나무 모형 내보내기: 이 폴더를 작은 http 서버로 띄우고 헤드리스 Chromium 에서 gen.js 를 돌려
//   <OUT>/trees.json (종 4 × 세밀도 3 형상) · trees_rgb.webp (잎 아틀라스 색) · trees_a.webp (투명도) 를 만든다
// 사용: cd sim/src/tools/treegen && npm i && node export.js ../..   (playwright 는 sim/src 의 것을 씀)
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const { chromium } = require(require.resolve('playwright', { paths: [__dirname, path.join(__dirname, '../..')] }));
(async () => {
  const out = path.resolve(process.argv[2] || '../..'), port = 8700 + Math.floor(Math.random() * 80);
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: __dirname, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
    await p.goto(`http://localhost:${port}/index.html`); await p.waitForFunction(() => window.TG_READY, null, { timeout: 60000 });
    const r = await p.evaluate(() => TG.exportAll()), w = (f, d) => fs.writeFileSync(path.join(out, f), Buffer.from(d.split(',')[1], 'base64'));
    w('trees_rgb.webp', r.rgb); w('trees_a.webp', r.alpha); if (process.env.PREVIEW) w('trees_atlas_preview.png', r.png);
    fs.writeFileSync(path.join(out, 'trees.json'), JSON.stringify({ v: 1, src: 'ez-tree 1.1 (MIT, Daniel Greenheck) + custom conifer · tools/treegen', names: r.names, lods: r.geo }));
    console.log(r.geo.map((L, i) => r.names[i] + ' ' + L.map(g => g.tris).join('/')).join('  '), '→', out);
  } finally { await b.close(); srv.kill(); }
})();
