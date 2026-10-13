const { chromium } = require('playwright'); const fs = require('fs');
const [dem, lat, lon, brg, id, name, src, dc, sc] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext()).newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + process.cwd() + '/hroc_fpv_simulator_KO.html?test'); await p.waitForTimeout(800);
  await p.setInputFiles('#demFile', dem); await p.waitForTimeout(500);
  const pkg = await p.evaluate(async ([lat, lon, brg, id, name, src, dc, sc]) => {
    const f = document.getElementById('demFile').files[0] || null;
    const R = await __sim.readDem(window.__lastDemFile || f, null);
    return __sim.buildTerrainPkg(R, { lat: +lat, lon: +lon, brg: +brg, id, name, src, dc: dc === undefined ? undefined : +dc, sc: sc === undefined ? undefined : +sc });
  }, [lat, lon, brg, id, name, src, dc, sc]);
  const { inH, farH, ...meta } = pkg; console.log(JSON.stringify(meta));
  fs.writeFileSync('pkg_' + id + '.json', JSON.stringify(pkg)); await b.close();
})();
