// 인트로 영상 장면 렌더 (낮 · 1280x720 · 30fps): 1 계곡 전경 → 2 코스 통과(기준 비행 추적) → 3 능선 1인칭 → 4 능선 전경(제목)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/fr/';
const ONLY = process.env.SHOT ? process.env.SHOT.split(',') : null;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); p.setDefaultTimeout(300000); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8768/index.html?test', { timeout: 120000 }); await p.waitForTimeout(8000);
  await p.evaluate(() => {
    const s = __sim; document.querySelector('#segMusic button[data-v="0"]').click(); s.SET.voice = false;
    s.setAirframe('x2d'); s.setTod('day'); s.setWx('clear'); s.SET.wind = 0;
    const hide = () => ['hud', 'menu', 'navArrow', 'radio', 'tbar', 'lyBar', 'errBox', 'attrib', 'pinGate', 'uasHud', 'photoPop'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; });
    window.__hide = hide; hide();
    const V = s.camera.position.constructor; window.__V = V;
    const ease = t => t * t * (3 - 2 * t);
    window.__lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    // 직접 카메라: 게임 한 프레임(그리기 없이) → 카메라 덮어쓰기 → 그리기
    window.__cam = (cam, look, fov, roll, noAdv) => {
      if (!noAdv) s.advance(1 / 24, 1 / 48, true); hide();
      s.camera.position.set(cam[0], cam[1], cam[2]); s.camera.up.set(0, 1, 0); s.camera.lookAt(new V(look[0], look[1], look[2]));
      if (roll) s.camera.rotateZ(roll);
      s.camera.fov = fov; s.camera.updateProjectionMatrix(); s.camera.updateMatrixWorld();
      s.sky.position.copy(s.camera.position); s.renderer.render(s.scene, s.camera);
    };
  });
  const shot = async (name, n, fn) => {
    if (ONLY && !ONLY.includes(name)) return;
    const dir = OUT + name + '/'; fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < n; i++) { await p.evaluate(fn, [i, n]); await p.screenshot({ path: dir + String(i).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 93, timeout: 300000 }); }
    console.log(name, 'done', errs.slice(0, 2));
  };
  // ---- 1 계곡 전경: 앞으로 천천히 다가가며 내려옴 ----
  await p.evaluate(() => { const s = __sim; s.startRun('free'); s.advance(0.3, 1 / 60, true); window.__hide(); const gy = s.groundAt(40, -200); window.__G1 = gy;
    s.DR.p.set(30, gy + 25, -230); s.DR.v.set(0, 0, 0); s.DR.landed = false; for (let i = 0; i < 6; i++) s.advance(1 / 30, 1 / 30, true); });
  await shot('s1', 40, ([i, n]) => { const s = __sim, t = i / (n - 1), gy = window.__G1, e = t * (2 - t);
    const cam = window.__lerp3([205, gy + 128, 85], [168, gy + 104, 28], e), look = window.__lerp3([10, gy + 2, -300], [0, gy - 2, -322], e);
    s.DR.p.set(30, gy + 25, -230); window.__cam(cam, look, 52, 0); });
  // ---- 2 코스 통과: 기준 비행을 바짝 뒤에서 따라감 (주황 기체 = 기체 색 기능) ----
  await p.evaluate(() => { const s = __sim; s.SET.paint = { x2d: 'orange' }; s.setAirframe('x2d'); s.toMenu(); s.startRun('demo'); window.__hide(); s.S.cam = 1; s.advance(0.2, 1 / 60, true);
    window.__trk = () => { const g = s.getDroneM().g.position, p0 = [g.x, g.y, g.z], q = window.__pp;
      if (q) { const vx = p0[0] - q[0], vz = p0[2] - q[2], L = Math.hypot(vx, vz); if (L > 1e-3) { const f = [vx / L, vz / L]; window.__fw = window.__fw ? [window.__fw[0] * 0.82 + f[0] * 0.18, window.__fw[1] * 0.82 + f[1] * 0.18] : f; } }
      window.__pp = p0; };
    window.__chase = () => { const g = s.getDroneM().g.position, f = window.__fw || [0, -1], L = Math.hypot(f[0], f[1]) || 1, fx = f[0] / L, fz = f[1] / L;
      window.__cy = window.__cy == null ? g.y + 0.62 : window.__cy + (g.y + 0.62 - window.__cy) * 0.35;
      window.__cam([g.x - fx * 1.75, window.__cy, g.z - fz * 1.75], [g.x + fx * 6, g.y - 0.1, g.z + fz * 6], 64, 0, true); }; });
  const t0 = parseFloat(process.env.T0 || '6.1');
  await p.evaluate((t0) => { const s = __sim; s.S.ghostT = t0 - 0.6; window.__pp = null; window.__fw = null; window.__cy = null; for (let i = 0; i < 14; i++) { s.advance(1 / 24, 1 / 48, true); window.__trk(); } }, t0);
  await shot('s2', 38, ([i, n]) => { const s = __sim; s.advance(1 / 24, 1 / 48, true); window.__trk(); window.__chase(); });
  // ---- 3 능선 1인칭: 수관 위를 빠르게 ----
  await p.evaluate(() => { const s = __sim; s.toMenu(); s.startRun('free'); s.advance(0.2, 1 / 60, true); window.__hide(); });
  await shot('s3', 32, ([i, n]) => { const s = __sim, t = i / (n - 1);
    const A = [-58, 0, 62], B = [-118, 0, 124], x = A[0] + (B[0] - A[0]) * t, z = A[2] + (B[2] - A[2]) * t;
    let gy = -1e9; for (let k = 0; k <= 4; k++) { const u = Math.min(1, t + k * 0.05); gy = Math.max(gy, s.groundAt(A[0] + (B[0] - A[0]) * u, A[2] + (B[2] - A[2]) * u)); }
    window.__F3 = window.__F3 == null ? gy : window.__F3 + (gy - window.__F3) * 0.25; const y = window.__F3 + 30;
    const dx = B[0] - A[0], dz = B[2] - A[2], L = Math.hypot(dx, dz), fx = dx / L, fz = dz / L;
    s.DR.p.set(x + fx * 30, y - 8, z + fz * 30);
    window.__cam([x, y, z], [x + fx * 60, y - 16 - 4 * Math.sin(t * 3), z + fz * 60], 78, Math.sin(t * 2.4) * 0.09 - 0.05); });
  // ---- 4 능선 전경: 천천히 물러나며 올라감 (제목이 이 위에 뜸) ----
  await p.evaluate(() => { const s = __sim; const gy = s.groundAt(-250, 200); window.__G4 = gy; s.DR.p.set(-300, gy + 40, 260); });
  await shot('s4', 46, ([i, n]) => { const s = __sim, t = i / (n - 1), gy = window.__G4, e = 1 - Math.pow(1 - t, 2);
    const cam = window.__lerp3([-20, gy + 78, 70], [10, gy + 96, 40], e), look = window.__lerp3([-380, gy + 18, 330], [-372, gy + 22, 322], e);
    window.__cam(cam, look, 54, 0); });
  console.log('errs', errs.slice(0, 3)); await b.close();
})();
