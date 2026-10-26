// DEM → 현장 데이터 묶음 (pkg_<id>.json): 공개 빌드 페이지의 지형 처리 코드를 그대로 씀
// 사용: node mkpkg.js DEM lat lon brg id name src [dc sc]   (SIM_URL 로 페이지 주소 바꿈, 기본 ../index.html)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [dem, lat, lon, brg, id, name, src, dc, sc] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext()).newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto((process.env.SIM_URL || 'file://' + path.resolve(__dirname, '../index.html')) + '?test'); await p.waitForTimeout(800);
  await p.setInputFiles('#demFile', dem); await p.waitForTimeout(500);
  const pkg = await p.evaluate(async ([lat, lon, brg, id, name, src, dc, sc]) => {
    const f = document.getElementById('demFile').files[0] || null;
    const R = await __sim.readDem(window.__lastDemFile || f, null);
    return __sim.buildTerrainPkg(R, { lat: +lat, lon: +lon, brg: +brg, id, name, src, dc: dc === undefined ? undefined : +dc, sc: sc === undefined ? undefined : +sc });
  }, [lat, lon, brg, id, name, src, dc, sc]);
  const { inH, farH, ...meta } = pkg; console.log(JSON.stringify(meta));
  fs.writeFileSync('pkg_' + id + '.json', JSON.stringify(pkg)); await b.close();
})();
