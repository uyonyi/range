// 인트로 영상 장면 렌더 (낮 · 1280x720 · 24fps · 126 BPM 박자에 맞춘 길이):
//   s1 계곡 전경(4박) → s2 마을 옆 지나기(3박) → s3 코스 통과(기준 비행 추적 · 검은 기체, 4박) → s4 숲길 1인칭(3박) → s5 능선 1인칭(3박) → s6 산 정상 전경(9박 · 제목)
//   장면 사이 0.25초 교차 → 각 장면은 박자 길이 + 0.25초 만큼 그림 (마지막 장면 제외) · 제목은 17박(8.1초)에 뜸 (template.html 의 HIT)
//   사용: (공개 빌드를 8768 에 띄운 뒤) node tools/intro/render.js   · 장면만 다시: SHOT=s2,s4 node tools/intro/render.js
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/fr/', FPS = 24, B = 60 / 126, X = 0.25;
const ONLY = process.env.SHOT ? process.env.SHOT.split(',') : null;
const frames = (beats, last) => Math.round((beats * B + (last ? 0 : X)) * FPS);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.setDefaultTimeout(600000); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8768/index.html?test', { timeout: 120000 });
  await p.waitForFunction(() => window.__sim && window.__sim.advance && window.__sim.TREES3 && window.__sim.TREES3.ready && window.__sim.BLD3 && window.__sim.LAMPS && window.__sim.LAMPS.ready && /적용됨/.test((document.getElementById('orthoStatus') || {}).textContent || ''), null, { timeout: 600000, polling: 300 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => {
    const s = __sim; document.querySelector('#segMusic button[data-v="0"]').click(); s.SET.voice = false; s.SET.attCam = false;
    s.setAirframe('x2d'); s.setTod('day'); s.setWx('clear'); s.SET.wind = 0;
    const hide = () => { ['hud', 'menu', 'navArrow', 'radio', 'tbar', 'lyBar', 'errBox', 'attrib', 'pinGate', 'uasHud', 'photoPop', 'orderBox', 'attcam', 'flyFade', 'rkToast'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }); document.querySelectorAll('#msg,#bigMsg,.panel').forEach(e => e.style.visibility = 'hidden'); };
    window.__hide = hide; hide();
    const V = s.camera.position.constructor; window.__V = V;
    window.__lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    window.__ease = t => t * t * (3 - 2 * t);
    // 직접 카메라: 게임 한 프레임(그리기 없이) → 카메라 덮어쓰기 → 그리기
    window.__cam = (cam, look, fov, roll, noAdv) => {
      if (!noAdv) s.advance(1 / 24, 1 / 48, true); hide();
      s.camera.position.set(cam[0], cam[1], cam[2]); s.camera.up.set(0, 1, 0); s.camera.lookAt(new V(look[0], look[1], look[2]));
      if (roll) s.camera.rotateZ(roll);
      s.camera.fov = fov; s.camera.updateProjectionMatrix(); s.camera.updateMatrixWorld();
      s.sky.position.copy(s.camera.position); if (s.STREES && s.STREES.lod) s.STREES.lod(s.camera.position); s.renderer.render(s.scene, s.camera);
    };
    // 땅·나무 위로 (카메라가 수관을 뚫지 않게)
    window.__clear = (x, z, R) => { let g = s.groundAt(x, z); if (s.STREES && s.STREES.topAt) g = Math.max(g, s.STREES.topAt(x, z, R || 6)); return g; };
    // 마을: 건물이 가장 많이 모인 100 m 칸
    window.__village = () => { const Bl = s.BLD3.LIST, G = new Map(); for (const b of Bl) { const k = Math.round(b[0] / 100) + ',' + Math.round(b[1] / 100); G.set(k, (G.get(k) || 0) + 1); }
      let best = null, bn = 0; for (const [k, n] of G) if (n > bn) { bn = n; best = k; } const [kx, kz] = best.split(',').map(Number); let sx = 0, sz = 0, c = 0;
      for (const b of Bl) if (Math.abs(b[0] / 100 - kx) <= 1 && Math.abs(b[1] / 100 - kz) <= 1) { sx += b[0]; sz += b[1]; c++; } return [sx / c, s.groundAt(sx / c, sz / c), sz / c]; };
  });
  const shot = async (name, n, fn) => {
    if (ONLY && !ONLY.includes(name)) return;
    const dir = OUT + name + '/'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    const idx = process.env.SPARSE ? [0, Math.floor(n / 3), Math.floor(n * 2 / 3), n - 1] : [...Array(n).keys()];
    for (const i of idx) { await p.evaluate(fn, [i, n]); await p.screenshot({ path: dir + String(i).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 94, timeout: 600000 }); }
    console.log(name, n, 'frames', Math.round((Date.now() - t0) / 1000) + 's', errs.slice(0, 2));
  };
  // ---- s1 계곡 전경 (4박): 앞으로 천천히 다가가며 내려옴 ----
  await p.evaluate(() => { const s = __sim; s.startRun('free'); s.advance(0.3, 1 / 60, true); window.__hide(); const gy = s.groundAt(40, -200); window.__G1 = gy;
    s.DR.p.set(30, gy + 25, -230); s.DR.v.set(0, 0, 0); s.DR.landed = false; for (let i = 0; i < 6; i++) s.advance(1 / 30, 1 / 30, true); });
  await shot('s1', frames(4), ([i, n]) => { const s = __sim, t = i / (n - 1), gy = window.__G1, e = t * (2 - t);
    const cam = window.__lerp3([205, gy + 128, 85], [168, gy + 104, 28], e), look = window.__lerp3([10, gy + 2, -300], [0, gy - 2, -322], e);
    s.DR.p.set(30, gy + 25, -230); window.__cam(cam, look, 52, 0); });
  // ---- s2 마을 옆 지나기 (3박): 마을 앞을 낮게 옆으로 흐르며 ----
  await p.evaluate(() => { const s = __sim; const v = window.__village(); window.__VL = v; s.DR.p.set(v[0] + 60, v[1] + 30, v[2] + 60); });
  await shot('s2', frames(3), ([i, n]) => { const s = __sim, t = i / (n - 1), v = window.__VL, e = window.__ease(t), w = (e - 0.5) * 2 * 110, dir = 0.7, dx = Math.cos(dir), dz = Math.sin(dir);
    const cx = v[0] - dz * 150 * 0.55 + dx * w, cz = v[2] + dx * 150 * 0.55 + dz * w, cy = Math.max(v[1] + 38, window.__clear(cx, cz, 8) + 10);
    s.DR.p.set(v[0] + 20, v[1] + 25, v[2] + 20); window.__cam([cx, cy, cz], [v[0] + dx * w * 0.35, v[1] + 3, v[2] + dz * w * 0.35], 50, 0); });
  // ---- s3 코스 통과 (4박): 기준 비행을 바짝 뒤에서 따라감 (검은 기체 · 인트로 전용 색) ----
  await p.evaluate(() => { const s = __sim; s.PAINTS.ink = 0x16181b; s.SET.paint = { x2d: 'ink' }; s.setAirframe('x2d'); s.toMenu(); s.startRun('demo'); s.glSet(0, true); window.__hide(); s.S.cam = 1; s.advance(0.2, 1 / 60, true);   // 안내 0: 관문 고리·화살표 없이
    window.__trk = () => { const g = s.getDroneM().g.position, p0 = [g.x, g.y, g.z], q = window.__pp;
      if (q) { const vx = p0[0] - q[0], vz = p0[2] - q[2], L = Math.hypot(vx, vz); if (L > 1e-3) { const f = [vx / L, vz / L]; window.__fw = window.__fw ? [window.__fw[0] * 0.82 + f[0] * 0.18, window.__fw[1] * 0.82 + f[1] * 0.18] : f; } }
      window.__pp = p0; };
    window.__chase = () => { const g = s.getDroneM().g.position, f = window.__fw || [0, -1], L = Math.hypot(f[0], f[1]) || 1, fx = f[0] / L, fz = f[1] / L;
      window.__cy = window.__cy == null ? g.y + 0.62 : window.__cy + (g.y + 0.62 - window.__cy) * 0.35;
      window.__cam([g.x - fx * 1.75, window.__cy, g.z - fz * 1.75], [g.x + fx * 6, g.y - 0.1, g.z + fz * 6], 64, 0, true); }; });
  const t0 = parseFloat(process.env.T0 || '6.1');
  await p.evaluate((o) => { window.__S4 = o; }, parseFloat(process.env.S4 || '0.5'));
  await p.evaluate((t0) => { const s = __sim; s.S.ghostT = t0 - 0.6; window.__pp = null; window.__fw = null; window.__cy = null; for (let i = 0; i < 14; i++) { s.advance(1 / 24, 1 / 48, true); window.__trk(); } }, t0);
  await shot('s3', frames(4), ([i, n]) => { const s = __sim; s.advance(1 / 24, 1 / 48, true); window.__trk(); window.__chase(); });
  // ---- s4 숲길 1인칭 (3박): 수관 아래 좁은 길을 낮게 · 앞에 기체 ----
  await p.evaluate(() => { const s = __sim; s.toMenu(); s.setAirframe('x2d'); s.startRun('free'); s.advance(0.2, 1 / 60, true); window.__hide(); });
  const s4fn = ([i, n]) => { const s = __sim, t = i / (n - 1), F = s.FLANE, s0 = F.total * (window.__S4 || 0.5), s1 = s0 + 48, u = s0 + (s1 - s0) * t;
    const q = F.at(u), q2 = F.at(Math.min(F.total, u + 10)), a = s.W(q.d, q.s, 0), bb = s.W(q2.d, q2.s, 0), qd = F.at(Math.min(F.total, u + 5)), d = s.W(qd.d, qd.s, 0);
    const y = window.__F4 == null ? a.y + 2.2 : window.__F4 + ((a.y + 2.2) - window.__F4) * 0.3; window.__F4 = y;
    s.DR.p.set(d.x, Math.max(d.y + 1.6, y - 0.3), d.z); s.DR.h = Math.atan2(bb.x - a.x, -(bb.z - a.z));
    window.__cam([a.x, y, a.z], [bb.x, Math.max(bb.y + 1.8, y - 0.6), bb.z], 80, Math.sin(t * 5) * 0.05); };
  for (const off of (process.env.S4LIST || '').split(',').filter(Boolean)) { await p.evaluate((o) => { window.__S4 = o; window.__F4 = null; }, parseFloat(off)); await shot('s4_' + off, frames(3), s4fn); }
  await p.evaluate(() => { window.__F4 = null; }); await shot('s4', frames(3), s4fn);
  // ---- s5 능선 1인칭 (3박): 수관 위를 빠르게 ----
  await shot('s5', frames(3), ([i, n]) => { const s = __sim, t = i / (n - 1);
    const A = [-58, 0, 62], Bq = [-118, 0, 124], x = A[0] + (Bq[0] - A[0]) * t, z = A[2] + (Bq[2] - A[2]) * t;
    let gy = -1e9; for (let k = 0; k <= 4; k++) { const u = Math.min(1, t + k * 0.05); gy = Math.max(gy, s.groundAt(A[0] + (Bq[0] - A[0]) * u, A[2] + (Bq[2] - A[2]) * u)); }
    window.__F5 = window.__F5 == null ? gy : window.__F5 + (gy - window.__F5) * 0.25; const y = window.__F5 + 30;
    const dx = Bq[0] - A[0], dz = Bq[2] - A[2], L = Math.hypot(dx, dz), fx = dx / L, fz = dz / L;
    s.DR.p.set(x + fx * 30, y - 8, z + fz * 30); s.DR.h = Math.atan2(fx, -fz);
    window.__cam([x, y, z], [x + fx * 60, y - 16 - 4 * Math.sin(t * 3), z + fz * 60], 78, Math.sin(t * 2.4) * 0.09 - 0.05); });
  // ---- s6 산 정상 전경 (9박 · 제목): 정상을 멀리서 천천히 돌며 물러남 ----
  await p.evaluate(() => { const s = __sim; const R = s.RIDGE, top = R && R.list.length ? R.list.reduce((a, b) => (b.c.y > a.c.y ? b : a)).c : null; window.__TOP = top ? [top.x, s.groundAt(top.x, top.z), top.z] : [-250, s.groundAt(-250, 200), 200]; s.DR.p.set(-300, window.__TOP[1] + 40, 260); });
  await shot('s6', frames(9, true), ([i, n]) => { const s = __sim, t = i / (n - 1), T = window.__TOP, e = 1 - Math.pow(1 - t, 2), a = 2.3 + 0.35 * e, R = 210 + 90 * e, h = 60 + 40 * e;
    const cx = T[0] + Math.sin(a) * R, cz = T[2] + Math.cos(a) * R, cy = Math.max(T[1] + h, window.__clear(cx, cz, 8) + 12);
    window.__cam([cx, cy, cz], [T[0], T[1] + 6, T[2]], 52, 0); });
  console.log('errs', errs.slice(0, 3)); await b.close();
})();
