// 배포 전 점검: 공개 빌드 폴더를 임시 서버로 띄우고 헤드리스 크로미움으로
//   (1) PC 1종 모의평가 자동비행 전 과목 S  (2) VR 경로(1종 안내판·시작·첫 기동)  (3) 코스 모드 시작
//   (4) 모바일 패널이 조종 스틱과 겹치지 않음  (5) 모드별 드로우콜·삼각형 예산 (budget.json)
// 사용: node tests/check.js <공개빌드폴더>   (실패 시 종료코드 1)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const dir = process.argv[2]; if (!dir) { console.error('usage: node tests/check.js <public-build-dir>'); process.exit(2); }
const BUDGET = JSON.parse(fs.readFileSync(path.join(__dirname, 'budget.json'), 'utf8'));
const AUTO = fs.readFileSync(path.join(__dirname, 'c1auto.js'), 'utf8');
const PORT = 8790 + Math.floor(Math.random() * 100);
const fails = [], rows = [];
const ok = (name, cond, detail) => { rows.push([cond ? 'PASS' : 'FAIL', name, detail || '']); if (!cond) fails.push(name); };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: dir, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (url, opt) => { const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 720 } }, opt || {})); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message + ' @' + ((e.stack || '').split('\n')[1] || '').trim())); await p.goto(`http://localhost:${PORT}/${url}`, { timeout: 120000 }); await p.waitForTimeout(9000); await p.addScriptTag({ content: AUTO }); return { p, ctx, errs }; };
  const start = (kind, flags) => `(() => { const s = __sim; ${flags || ''} s.setAirframe(${kind.startsWith('class1') ? "'c1'" : "'x2d'"}); s.startRun('${kind}'); s.advance(0.2, 1/60, true); const go = document.querySelector('#briefGo'); if (go) go.click(); s.S.brief = false; s.advance(1, 1/60, true); })()`;
  const budget = (p, key) => p.evaluate(() => { const s = __sim; s.advance(1/72, 1/72, false); const r = s.renderer.info.render; return { calls: r.calls, tris: r.triangles }; }).then(m => { const B = BUDGET[key]; ok(`budget ${key}`, m.calls <= B[0] && m.tris <= B[1], `calls ${m.calls}/${B[0]} tris ${(m.tris / 1e6).toFixed(2)}M/${(B[1] / 1e6).toFixed(2)}M`); return m; });
  try {
    // (1) PC 1종 모의평가 자동비행
    { const { p, ctx, errs } = await open('index.html?test');
      const r = await p.evaluate(`(() => { ${start('class1x')}; const t = c1Auto({ calls: true }); const L = __sim.c1Log(); return { t, v: L.manoeuvres.map(m => m.verdict), over: __sim.C1.over }; })()`);
      ok('pc class1x all S', r.over && r.v.every(v => v === 'S' || v === 'instructor'), r.v.join(',') + ` t=${Math.round(r.t)}s`);
      ok('pc class1x no errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close(); }
    // (3)+(5) PC 코스 · 1종 학습 예산
    { const { p, ctx, errs } = await open('index.html?test');
      await p.evaluate(start('course')); await p.evaluate(() => __sim.advance(5, 1/60, true)); await budget(p, 'pc-course');
      ok('pc course no errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.evaluate(() => { __sim.toMenu && __sim.toMenu(); }); await p.evaluate(start('class1')); await p.evaluate(() => { __sim.c1Jump(3); __sim.advance(2, 1/60, true); }); await budget(p, 'pc-class1');
      ok('pc class1 no errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close(); }
    // (2)+(5) VR 경로: 안내판에 브리핑 → 트리거로 시작 → 첫 기동 자동비행 → 예산
    { const { p, ctx, errs } = await open('vr/index.html?test');
      const r = await p.evaluate(() => { const s = __sim; window.C1_VRTEST = true; s.setAirframe('c1'); s.startRun('class1'); s.advance(1, 1/60, true); s.c1XRUpdate(0.3); const briefShown = s.S.brief && s.C1XR.board && s.C1XR.board.m.visible; s.pressed.push('KeyQ'); s.advance(0.5, 1/60, true); const started = !s.S.brief && s.S.state === 'run'; const t = c1Auto({ calls: true, maxIt: 2600 }); s.advance(1/72, 1/72, false); return { briefShown, started, t, mi: s.C1.mi, v: s.C1.M.slice(0, 2).map(m => m.done ? (m.fail ? 'U' : 'S') : 'nf') }; });
      ok('vr brief on board', r.briefShown); ok('vr trigger starts', r.started); ok('vr first manoeuvres', r.mi >= 2 && r.v.every(v => v === 'S'), `mi=${r.mi} ${r.v.join(',')} t=${Math.round(r.t)}s`);
      await budget(p, 'vr-class1');
      ok('vr no errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close(); }
    // (4) 모바일 가로: 패널·게이지가 스틱 영역과 안 겹침
    for (const [w, h, tag] of [[844, 390, 'phone'], [740, 360, 'small']]) {
      const { p, ctx, errs } = await open('index.html?test', { viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      const r = await p.evaluate(`(() => { ${start('class1')}; const s = __sim; s.c1Jump(3); s.advance(1, 1/60, true); s.C1.si = 1; s.c1Cur().t0 = s.C1.t; s.advance(0.5, 1/60); if (!document.getElementById('c1g') || document.getElementById('c1g').classList.contains('hidden')) return { gaugeMissing: true }; const R = id => { const e = document.getElementById(id); return e && !e.classList.contains('hidden') ? e.getBoundingClientRect() : null; }; const ov = (a, b) => a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom); const L = R('tzL'), Rt = R('tzR'); return { pL: ov(R('c1p'), L), pR: ov(R('c1p'), Rt), gL: ov(R('c1g'), L), gR: ov(R('c1g'), Rt) }; })()`);
      ok(`mobile ${tag} no overlap`, !r.gaugeMissing && !r.pL && !r.pR && !r.gL && !r.gR, JSON.stringify(r)); ok(`mobile ${tag} no errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
      await ctx.close(); }
  } catch (e) { ok('harness', false, String(e.message || e).slice(0, 300)); }
  await b.close(); srv.kill();
  for (const [s, n, d] of rows) console.log(s.padEnd(5), n.padEnd(28), d);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS'); process.exit(fails.length ? 1 : 0);
})();
