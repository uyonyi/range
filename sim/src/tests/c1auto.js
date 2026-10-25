// 페이지 안에서 도는 자동 조종 (테스트용): 현재 단계 목표를 따라 TOUCH 입력을 만든다
window.c1Auto = function (opts) {
  const s = __sim, T = s.TOUCH, C1 = s.C1, P = s.C1P, g = 9.81, DEG = Math.PI / 180;
  opts = opts || {}; const out = []; let keyCD = 0, simT = 0;
  const wrap = d => ((d + 180) % 360 + 360) % 360 - 180;
  T.on = true;
  for (let it = 0; it < (opts.maxIt || 20000); it++) {
    const st = s.c1Cur(); if (!st || C1.over) break;
    const M = s.c1M(), ref = C1.ref || 4, FW = [Math.sin(s.DR.h), -Math.cos(s.DR.h)], RT = [Math.cos(s.DR.h), Math.sin(s.DR.h)];
    let tu = M.u, tv = M.v, ta = M.alt, th = 0, vmax = 1.2, vzOverride = null, ff = 0;
    keyCD -= 0.05;
    const press = k => { if (keyCD <= 0) { s.c1Key(k); keyCD = 0.3; } };
    if (opts.gpsInNrm && C1.M[C1.mi] && C1.M[C1.mi].id === 'nrm' && C1.si >= 3 && C1.mode !== 'gps') press('KeyY');
    if (opts.calls && st.call && !st.callSaid) s.c1Key('KeyQ');
    if (st.k === 'inspect') { if (!st.done && st.open) s.c1InspectAuto(!opts.badInspect); }
    if (st.k === 'oral') { if (st.qs && !st.done) s.c1OralAuto(opts.oralOk != null ? opts.oralOk : 5); }
    let rcIn = null;
    if (st.k === 'rc') { const seq = [{ thr: 1 }, { thr: -1 }, { yaw: 1 }, { yaw: -1 }, { pitch: 1 }, { pitch: -1 }, { roll: 1 }, { roll: -1 }, {}]; st._rc = (st._rc || 0) + 1; rcIn = seq[Math.min(seq.length - 1, Math.floor(st._rc / 4))]; if (C1.mode !== 'gps') press('KeyY'); }
    let ctlIn = null;
    if (st.k === 'ctl') { st._c = (st._c || 0) + 1; const seq = [{ pitch: 0.2 }, { pitch: -0.2 }, { roll: 0.2 }, { roll: -0.2 }, { yaw: 0.25 }, { yaw: -0.25 }, {}]; ctlIn = seq[Math.min(seq.length - 1, Math.floor(st._c / 5))]; }
    let cscIn = null;
    if (st.k === 'arm' && opts.csc) cscIn = { thr: -1, pitch: -1, yaw: 1, roll: -1 };
    else if (st.k === 'prep' || st.k === 'arm') press('Enter');
    else if (st.k === 'disarm') { if (s.DR.landed && M.hs < 0.2) press('Enter'); }
    else if (st.k === 'mode') press('KeyY');
    if (opts.manualNrm && C1.M[C1.mi] && C1.M[C1.mi].id === 'nrm' && C1.mode === 'atti') press('KeyY');
    else if (st.k === 'callout') { if (opts.noCallout) {} else press('KeyE'); }
    if (st.k === 'climb') { tu = st.at[0]; tv = st.at[1]; ta = opts.refAlt || 4.0; }
    else if (st.k === 'hold') { tu = st.at[0]; tv = st.at[1]; ta = st.altWin ? ref + st.altWin[0] + 0.8 : ref + (st.r || 0); th = st.hdg; if (opts.shortHold && C1.exam && st.armedEval && st.t > opts.shortHold && st.T === 5 && !st._left) { st._left = true; } if (st._left) { tu += 3; } }
    if (opts.shortHold && C1.exam && st.k === 'hold' && st.armedEval && st.t > opts.shortHold && !st._left) st._left = true;
    else if (st.k === 'xfer') { tu = st.to[0]; tv = st.to[1]; ta = ref; th = 0; }
    else if (st.k === 'move') {
      const a = st.from, b = st.to, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const sp = clamp01(((M.u - a[0]) * ux + (M.v - a[1]) * uy + 2.0) / L); tu = a[0] + dx * sp; tv = a[1] + dy * sp;
      const sp0 = clamp01(((M.u - a[0]) * ux + (M.v - a[1]) * uy) / L); ta = ref + (st.r0 || 0) + ((st.r1 || 0) - (st.r0 || 0)) * sp0; th = st.hdg; vmax = (st.r0 || st.r1) ? 0.7 : 1.3;
      if (st.r0 || st.r1) { const va = -(s.DR.v.x * ux - s.DR.v.z * uy); const vAl = s.DR.v.x * ux + (-s.DR.v.z) * uy; ff = ((st.r1 || 0) - (st.r0 || 0)) / L * vAl; }
      if (opts.stopMid && st === opts._stopSt) {} 
      if (opts.stopAt && st.lab.includes(opts.stopAt) && sp > 0.5 && !st._stopped) { st._stopT = (st._stopT || 0) + 0.05; vmax = 0; if (st._stopT > opts.stopFor) st._stopped = true; }
    }
    else if (st.k === 'arc') {
      const dir = st.dir < 0 ? 1 : -1, thp = Math.atan2(M.u - st.c[0], M.v - st.c[1]) / DEG, ah = (thp + dir * 25) * DEG;
      tu = st.c[0] + Math.sin(ah) * st.R; tv = st.c[1] + Math.cos(ah) * st.R; ta = ref; th = wrap(thp + 90 * dir); vmax = 1.4;
      if (st.sweep > 320) { tu = st.start[0]; tv = st.start[1]; vmax = 0.8; }
    }
    else if (st.k === 'emg') { tu = st.pad[0]; tv = st.pad[1] + (opts.emgMiss || 0); ta = 0; th = 0; vmax = 3.5; vzOverride = opts.emgSink != null ? -opts.emgSink : -2.0; }
    else if (st.k === 'land') { tu = st.pad[0] + (opts.landOff || 0); tv = st.pad[1]; ta = 0; th = st.hdg; vmax = 0.8; vzOverride = Math.hypot(M.u - tu, M.v - tv) < 0.4 ? -0.6 : 0; }
    else if (st.k === 'ann' || st.k === 'callout' || st.k === 'disarm' || st.k === 'prep' || st.k === 'arm' || st.k === 'mode') { tu = M.u; tv = M.v; ta = M.alt; th = M.hdg; }
    // 수평 속도 명령
    let vu = (tu - M.u) * 0.9, vv = (tv - M.v) * 0.9; const vl = Math.hypot(vu, vv); if (vl > vmax) { vu *= vmax / vl; vv *= vmax / vl; }
    const hh = s.C1S.h, vx = Math.cos(hh) * vu + Math.sin(hh) * vv, vz = Math.sin(hh) * vu - Math.cos(hh) * vv;   // 시험장 (u,v) → 월드
    let pit, rol;
    if (C1.mode === 'gps') { pit = (vx * FW[0] + vz * FW[1]) / P.gpsV.v; rol = (vx * RT[0] + vz * RT[1]) / P.gpsV.v; }
    else { const ax = (vx - s.DR.v.x) * 1.6, az = (vz - s.DR.v.z) * 1.6, tm = P.tiltMax.v * DEG; pit = Math.atan((ax * FW[0] + az * FW[1]) / g) / tm; rol = Math.atan((ax * RT[0] + az * RT[1]) / g) / tm; }
    const he = wrap(th - M.hdg);
    let vzd = vzOverride != null ? vzOverride : Math.max(-1.2, Math.min(1.5, ff + (ta - M.alt) * 1.5));
    let thr;
    if (C1.mode === 'manual') { const aUp = P.thrustMaxN.v / P.flightKg.v - g; thr = ((vzd - M.vy) * 2.5) / (vzd - M.vy >= 0 ? aUp * 0.6 : g * 0.55); }
    else thr = vzd > 0 ? vzd / P.climb.v : vzd / P.sink.v;
    if (st.k === 'prep' || st.k === 'arm' || st.k === 'disarm' || st.k === 'inspect' || st.k === 'oral' || ((st.k === 'mode' || st.k === 'ann') && s.DR.landed)) { thr = s.DR.landed ? -1 : thr; pit = rol = 0; }
    if (s.DR.landed && (st.k === 'land' || st.k === 'emg' || st.k === 'disarm')) { thr = -1; pit = rol = 0; }
    T.pitch = clamp1(pit); T.roll = clamp1(rol); T.yaw = clamp1(he * 0.05); T.thr = clamp1(thr);
    if (st.k === 'ctl' && ctlIn) { T.pitch = ctlIn.pitch || T.pitch * 0.3; T.roll = ctlIn.roll || T.roll * 0.3; T.yaw = ctlIn.yaw || 0; }
    if (rcIn) { T.thr = rcIn.thr || 0; T.yaw = rcIn.yaw || 0; T.pitch = rcIn.pitch || 0; T.roll = rcIn.roll || 0; }
    if (cscIn) Object.assign(T, cscIn);
    s.advance(0.05, 1 / 60, true); simT += 0.05;
  }
  T.on = false; T.pitch = T.roll = T.yaw = T.thr = 0;
  return simT;
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function clamp1(x) { return Math.max(-1, Math.min(1, x)); }
};
