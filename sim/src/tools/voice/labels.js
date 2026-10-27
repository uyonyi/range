const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } }); const url = 'file://' + process.argv[2] + '?test'; const L = new Set();
  for (const id of process.argv.slice(3)) {
    await p.goto(url); await p.waitForTimeout(500); await p.evaluate(([k, id]) => localStorage.setItem(k, id), [process.env.SITE_KEY || 'fpvsim_site', id]); await p.goto(url); await p.waitForTimeout(5000);
    const ls = await p.evaluate(() => __sim.OBJS.map(o => o.label)); ls.forEach(l => L.add(l));
  }
  const say = l => 'Next, ' + String(l).replace(/360°/g, 'three sixty').replace(/H-PAD/g, 'H pad').replace(/\s*·\s*/g, ', ').replace(/\s*\(([^)]*)\)/g, ', $1').replace(/\bLOW\b/g, 'Low').replace(/\b([A-Z])([A-Z]{3,})\b/g, (m, a, b) => a + b.toLowerCase()).replace(/(\d+)\/(\d+)/g, '$1 of $2') + '.';
  fs.writeFileSync(process.argv[2].replace(/[^/]*$/, '') + '../rv/labels.json', JSON.stringify([...L].map(say), null, 0)); console.log([...L].length); await b.close();
})();
