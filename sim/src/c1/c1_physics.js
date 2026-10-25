// ---- 비행 모델 (최소 모델 · 120 Hz 고정 스텝에서 호출) ----
function c1Wind(p) {
  const base = WIND.lv === 1 ? 3 : WIND.lv === 2 ? 7 : 0;
  if (!base) return _c1w.set(0, 0, 0);
  if (C1S.real) return windAt(p);   // 실제 지형 위: 지형 따라 바뀌는 바람 (다른 임무와 같은 모델)
  const t = C1.t, agl = Math.max(0.5, p.y - C1S.y);
  const prof = clamp(Math.log((agl + 1) / 0.03) / Math.log(11 / 0.03), 0.4, 1.15);   // 지면 거칠기 0.03 m 가정 · 10 m 에서 1
  const gust = 1 + 0.22 * Math.sin(t * 0.9) * Math.sin(t * 0.37) + 0.1 * Math.sin(t * 2.3 + 1.1);   // 반복 가능한 돌풍 (시각 = 이번 비행 경과시간)
  const sw = 0.15 * Math.sin(t * 0.21);
  const c = Math.cos(sw), s = Math.sin(sw), k = base * prof * gust;
  return _c1w.set((WIND.dir.x * c - WIND.dir.z * s) * k, 0, (WIND.dir.x * s + WIND.dir.z * c) * k);
}
const _c1w = new V3(), _c1a = new V3(), _c1f = new V3(), _c1r = new V3();
function c1Phys(dt) {
  const m = c1p('flightKg'), Tmax = c1p('thrustMaxN'), g = G, aUpMax = Tmax / m - g, md = C1.mode;
  const gy = c1Gnd() + c1p('skidDrop');
  const onG = DR.p.y <= gy + 0.005;
  if (C1.demo && S.state === 'run') c1DemoCtl();
  const ip = IN.pitch, ir = IN.roll, iy = IN.yaw, it = IN.thr;
  const FW = _c1f.set(Math.sin(DR.h), 0, -Math.cos(DR.h)), RT = _c1r.set(Math.cos(DR.h), 0, Math.sin(DR.h));
  const wv = c1Wind(DR.p);
  // 1) 수평: 모드별 기울기 명령
  let pc = 0, rc = 0;
  if (C1.armed && !(onG && it <= 0.05)) {
    if (md === 'gps') {
      const tilt = c1p('tiltGps') * DEG, aLim = g * Math.tan(tilt);
      const stick = Math.abs(ip) > 0.04 || Math.abs(ir) > 0.04;
      const ac = _c1a.set(0, 0, 0);
      if (stick) {
        C1.hold = null; C1.ei.set(0, 0, 0);
        const vc = FW.clone().multiplyScalar(ip * c1p('gpsV')).addScaledVector(RT, ir * c1p('gpsV'));
        ac.set((vc.x - DR.v.x) * 1.8, 0, (vc.z - DR.v.z) * 1.8);
      } else {
        if (!C1.hold && Math.hypot(DR.v.x, DR.v.z) < 0.25) C1.hold = DR.p.clone();
        if (C1.hold) { const ex = C1.hold.x - DR.p.x, ez = C1.hold.z - DR.p.z; C1.ei.x = clamp(C1.ei.x + ex * dt, -2, 2); C1.ei.z = clamp(C1.ei.z + ez * dt, -2, 2); ac.set(ex * 0.9 + C1.ei.x * 0.25, 0, ez * 0.9 + C1.ei.z * 0.25); }
        ac.x -= DR.v.x * 1.7; ac.z -= DR.v.z * 1.7;
      }
      const al = Math.hypot(ac.x, ac.z); if (al > aLim) ac.multiplyScalar(aLim / al);
      pc = Math.atan((ac.x * FW.x + ac.z * FW.z) / g); rc = Math.atan((ac.x * RT.x + ac.z * RT.z) / g);
    } else { const tm = c1p('tiltMax') * DEG; pc = ip * tm; rc = ir * tm; }
  }
  const ka = 1 - Math.exp(-dt / c1p('tauAtt')), rl = c1p('attRate') * DEG * dt;
  DR.pitch += clamp((pc - DR.pitch) * ka, -rl, rl); DR.roll += clamp((rc - DR.roll) * ka, -rl, rl);
  // 2) 기수: 회전 속도 명령 → 1차 응답
  const yc = C1.armed && !onG ? iy * c1p('yawMax') * DEG : 0;
  C1.yr += (yc - C1.yr) * (1 - Math.exp(-dt / c1p('tauYaw'))); DR.h = wrapA(DR.h + C1.yr * dt);
  // 3) 수직: 고도유지(GPS·ATTI) = 상승률 명령 / 수동 = 스로틀이 곧 추력 (가운데 = 정지 추력 가정)
  let azc;
  if (!C1.armed) azc = -g;
  else if (md === 'manual') azc = it >= 0 ? it * aUpMax * 0.6 : it * g * 0.55;
  else {
    let vzc;
    if (Math.abs(it) > 0.05) { vzc = it > 0 ? it * c1p('climb') : it * c1p('sink'); C1.altT = null; }
    else { if (C1.altT == null && Math.abs(DR.v.y) < 0.15) C1.altT = DR.p.y; vzc = C1.altT == null ? 0 : clamp((C1.altT - DR.p.y) * 1.2, -0.8, 0.8); }
    if (onG && it <= 0.05) { vzc = 0; C1.altT = null; }
    azc = clamp((vzc - DR.v.y) * 3.0, -g * 0.6, aUpMax * 0.8);
  }
  C1.az += (azc - C1.az) * (1 - Math.exp(-dt / c1p('tauMotor')));
  const cosT = Math.cos(DR.pitch) * Math.cos(DR.roll), acc = Math.max(0, g + C1.az);   // 추력 가속도 (기체 위쪽)
  // 4) 힘 → 가속도: 기울어진 추력 + 중력 + 공기에 대한 속도로 항력
  const vrx = DR.v.x - wv.x, vrz = DR.v.z - wv.z, vry = DR.v.y, vh = Math.hypot(vrx, vrz), rho = c1p('rho');
  const kH = 0.5 * rho * c1p('cdA') * vh / m + c1p('rotorDrag'), kV = 0.5 * rho * c1p('cdAv') * Math.abs(vry) / m;
  const ah = acc * cosT > 0 ? acc : 0;
  const axF = ah * Math.sin(DR.pitch) * Math.cos(DR.roll), axR = ah * Math.sin(DR.roll);
  DR.v.x += (FW.x * axF + RT.x * axR - kH * vrx) * dt;
  DR.v.z += (FW.z * axF + RT.z * axR - kH * vrz) * dt;
  DR.v.y += (acc * cosT - g - kV * vry) * dt;
  DR.p.addScaledVector(DR.v, dt);
  DR.thrust = C1.armed ? clamp(acc / (Tmax / m), 0.08, 1) : 0;
  // 5) 지면 (스키드)
  if (DR.p.y <= gy) {
    const vy = DR.v.y, hs = Math.hypot(DR.v.x, DR.v.z), tilt = Math.max(Math.abs(DR.pitch), Math.abs(DR.roll)) / DEG;
    if (!DR.landed) {
      const uv = c1UV(DR.p);
      C1.touch = { t: C1.t, u: uv[0], v: uv[1], h: DR.h / DEG, vy, hs, tilt };
      if (-vy > c1p('crashSink') || hs > c1p('crashHs') || tilt > 30) C1.crash = { why: -vy > c1p('crashSink') ? 'sink' : hs > c1p('crashHs') ? 'speed' : 'tilt', vy, hs, tilt };
      else if (-vy > c1p('hardSink')) c1Ev('hard', { vy: +vy.toFixed(2) });
    }
    DR.p.y = gy; DR.v.y = Math.max(0, DR.v.y); DR.v.x *= Math.exp(-10 * dt); DR.v.z *= Math.exp(-10 * dt);
    DR.pitch *= Math.exp(-8 * dt); DR.roll *= Math.exp(-8 * dt); C1.yr *= Math.exp(-10 * dt);
    if (C1.az < 0) C1.az = 0;
    DR.landed = true;
  } else if (DR.p.y > gy + 0.02) DR.landed = false;
  if (!C1.armed && !onG) C1.crash = C1.crash || { why: 'disarm' };
  if (DR.p.y > c1Gnd() + 60) { DR.p.y = c1Gnd() + 60; DR.v.y = Math.min(0, DR.v.y); }
}

// ---- 측정값 ----
function c1M() {
  const uv = c1UV(DR.p);
  return { u: uv[0], v: uv[1], alt: DR.p.y - C1S.y - c1p('skidDrop'), hdg: c1Wrap((DR.h - C1S.h) / DEG), hs: Math.hypot(DR.v.x, DR.v.z), vy: DR.v.y, yr: Math.abs(C1.yr) / DEG };
}
const c1Wrap = d => { d = ((d + 180) % 360 + 360) % 360 - 180; return d; };   // +179 와 -179 의 차이 = 2°
function c1Still(M) { return M.hs < c1R('stillV') && Math.abs(M.vy) < 0.25 && M.yr < c1R('stillYaw'); }
function c1Ev(type, d) { const m = C1.M[C1.mi], st = m && m.steps[C1.si]; C1.ev.push(Object.assign({ t: +C1.t.toFixed(2), m: m ? m.id : '', s: C1.si, step: st ? st.lab : '', type }, d || {})); }
function c1Fail(st, why, d) {
  const m = C1.M[C1.mi]; if (!m) return;
  if (st && st.fails && st.fails.includes(why)) return;
  if (st) (st.fails = st.fails || []).push(why);
  m.fail = true; (m.why = m.why || []).push({ step: st ? st.lab : '', why, t: +C1.t.toFixed(1) });
  c1Ev('U', Object.assign({ why }, d || {}));
  if (!C1.exam) showMsg('U · ' + c1WhyTxt(why), '#ff9a40', 1.4);
}
function c1WhyTxt(w) {
  return ({ pos: L2('위치 이탈', 'position'), alt: L2('고도 이탈', 'height'), hdg: L2('기수 방향', 'heading'), path: L2('경로 이탈', 'path'), short: L2('정지 시간 부족', 'hold too short'),
    stops: L2('기동 중 멈춤', 'stops during manoeuvre'), mode: L2('GPS 모드로 수행', 'flown in GPS mode'), pad: L2('착륙장 밖', 'outside the pad'), slow: L2('비상 강하 속도 부족', 'emergency descent too slow'),
    pause: L2('비상 강하 중 일시정지 3초 이상', 'emergency pause ≥ 3 s'), pauseAlt: L2('1 m 위에서 일시정지', 'paused above 1 m'), crash: L2('충돌·추락', 'crash'), late: L2('시동·이륙 5분 초과', 'start-to-takeoff over 5 min'),
    ref: L2('기준고도 3~5 m 밖', 'reference height outside 3–5 m'), skip: L2('지점 미통과', 'checkpoint missed'), climbStop: L2('상승 중 멈춤', 'stopped while climbing'), rotStop: L2('회전 중 멈춤', 'stopped while turning'),
    safe: L2('안전거리(14 m)·안전라인 침범', 'inside the 14 m safety radius / line'), hard: L2('거친 접지', 'hard touchdown'), inspect: L2('점검 판정 오류', 'inspection misjudged'), ctl: L2('이륙 후 점검 미실시', 'after-takeoff check not done'), oral: L2('구술 오답', 'oral answer wrong') })[w] || w;
}
// 허용범위 이탈 추적: 짧은 이탈은 기록만, 연속 grace 초 넘으면 U
function c1Dev(st, key, bad, d, dt) {
  const D = st.dv || (st.dv = {}); const x = D[key] || (D[key] = { t: 0, n: 0, max: 0 });
  if (bad) { if (x.t === 0) { x.n++; c1Ev('dev', Object.assign({ key }, d)); } x.t += dt; x.max = Math.max(x.max, x.t); if (x.t >= c1R('grace')) c1Fail(st, key, d); }
  else x.t = 0;
  return bad;
}
function c1AltTgt(st) { return (C1.ref || 4) + (st.r || 0); }
function c1AltBad(st, M) {
  if (st.altWin) { const lo = (C1.ref || 4) + st.altWin[0], hi = (C1.ref || 4) + st.altWin[1]; return M.alt < lo - c1R('altTol') * 0 || M.alt > hi; }
  return Math.abs(M.alt - c1AltTgt(st)) > c1R('altTol');
}

// ---- 단계별 판정 ----
const C1EV = {
  prep(st) { return false; }, mode(st) { return st.gps ? C1.mode === 'gps' : C1.mode !== 'gps'; }, arm() { return C1.armed; }, callout() { return false; }, disarm() { return false; },
  xfer(st, M) { const d = Math.hypot(M.u - st.to[0], M.v - st.to[1]); return d < 1.5 && Math.abs(M.alt - (C1.ref || 4)) < 1.0 && c1Still(M); },
  climb(st, M, dt) {
    const lat = Math.hypot(M.u - st.at[0], M.v - st.at[1]);
    if (M.alt > 0.3) { st.up = true; c1Dev(st, 'pos', lat > c1R('posTol'), { lat: +lat.toFixed(2) }, dt); c1Dev(st, 'hdg', Math.abs(c1Wrap(M.hdg)) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0) }, dt); }
    if (!st.up) return false;
    // 상승 중 멈춤 (3~5 m 도달 전)
    if (M.alt < c1R('refMin') - c1R('altTol') && M.vy < 0.1 && M.alt > 0.6) st.stopT = (st.stopT || 0) + dt; else if (st.stopT) { c1Ev('stop', { d: +st.stopT.toFixed(2) }); if (st.stopT >= c1R('stopShort')) st.longStop = (st.longStop || 0) + 1; else st.shortStop = (st.shortStop || 0) + 1; st.stopT = 0; if ((st.shortStop || 0) >= 2 || (st.longStop || 0) >= 1) c1Fail(st, 'climbStop'); }
    const inRef = M.alt >= c1R('refMin') - c1R('altTol') && M.alt <= c1R('refMax') + c1R('altTol');
    if (M.alt > c1R('refMax') + c1R('altTol') && c1Still(M)) { st.hiT = (st.hiT || 0) + dt; if (st.hiT >= 2 && !st.hiF) { st.hiF = true; c1Fail(st, 'ref', { alt: +M.alt.toFixed(2) }); } if (st.hiT >= 2) { C1.ref = c1R('refMax'); c1Ev('ref', { ref: C1.ref, measured: +M.alt.toFixed(2), note: 'above range → clamped' }); return true; } } else st.hiT = 0;
    st.okT = inRef && c1Still(M) ? (st.okT || 0) + dt : 0;
    if (st.okT >= 1.0) {
      C1.ref = Math.round(clamp(M.alt, c1R('refMin'), c1R('refMax')) * 10) / 10;
      if (M.alt < c1R('refMin') || M.alt > c1R('refMax')) c1Ev('refClamp', { measured: +M.alt.toFixed(2), ref: C1.ref });
      c1Ev('ref', { ref: C1.ref, measured: +M.alt.toFixed(2) });
      if (C1.tArm != null && C1.t - C1.tArm > c1R('takeoffLimit')) c1Fail(st, 'late', { s: +(C1.t - C1.tArm).toFixed(0) });
      return true;
    }
    return false;
  },
  hold(st, M, dt) {
    const tgt = st.at, du = M.u - tgt[0], dv = M.v - tgt[1];
    const posBad = st.alongTol ? (Math.abs(du) > c1R('posTol') || Math.abs(dv) > st.alongTol) : Math.hypot(du, dv) > c1R('posTol');
    const altBad = c1AltBad(st, M), he = c1Wrap(M.hdg - st.hdg), hdgBad = Math.abs(he) > c1R('hdgTol');
    st.err = { lat: Math.hypot(du, dv), alt: M.alt - c1AltTgt(st), hdg: he };
    if (!st.armedEval) {
      if (st.posWatch) { c1Dev(st, 'pos', posBad, { du: +du.toFixed(2), dv: +dv.toFixed(2) }, dt); if (st.posWatch !== 'xy') c1Dev(st, 'alt', altBad, { alt: +M.alt.toFixed(2) }, dt); }
      if (st.rot) {   // 회전 중 멈춤
        const turned = Math.abs(c1Wrap(M.hdg - (st.h0 == null ? (st.h0 = M.hdg) : st.h0))) > 10;
        if (turned && hdgBad && M.yr < 3) st.stopT = (st.stopT || 0) + dt; else if (st.stopT) { c1Ev('rotStop', { d: +st.stopT.toFixed(2) }); st.rotStops = (st.rotStops || 0) + 1; if (st.stopT >= c1R('stopShort') || st.rotStops >= 2) c1Fail(st, 'rotStop'); st.stopT = 0; }
      }
      const ok = !posBad && !altBad && !hdgBad && c1Still(M);
      st.okT = ok ? (st.okT || 0) + dt : 0;
      if (st.okT >= c1R('arriveT')) { st.armedEval = true; st.t = 0; }
      return false;
    }
    const bad = posBad || altBad || hdgBad;
    if (C1.exam) {   // 모의평가: 정지 중 허용범위를 벗어나면 그 정지는 끝 (5초 미만이면 U)
      if (bad) { st.outT = (st.outT || 0) + dt; if (st.outT > 0.4) { if (st.t < st.T) c1Fail(st, 'short', { held: +st.t.toFixed(2), left: posBad ? 'pos' : altBad ? 'alt' : 'hdg' }); return true; } }
      else { st.outT = 0; st.t += dt; }
      return st.t >= st.T;
    }
    if (bad) { c1Dev(st, posBad ? 'pos' : altBad ? 'alt' : 'hdg', true, { held: +st.t.toFixed(2) }, dt); st.t = 0; }   // 학습: 다시 정지하면 처음부터
    else { c1Dev(st, 'pos', false, null, dt); c1Dev(st, 'alt', false, null, dt); c1Dev(st, 'hdg', false, null, dt); st.t += dt; }
    return st.t >= st.T;
  },
  move(st, M, dt) {
    const a = st.from, b = st.to, r0 = st.r0 || 0, r1 = st.r1 || 0, ref = C1.ref || 4;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), tx = dx / L, ty = dy / L;
    const pu = M.u - a[0], pv = M.v - a[1], along = pu * tx + pv * ty, lat = -pu * ty + pv * tx, s = clamp(along / L, 0, 1);
    const altE = ref + r0 + (r1 - r0) * s, altErr = M.alt - altE, he = c1Wrap(M.hdg - st.hdg);
    st.err = { lat, alt: altErr, hdg: he, s };
    if (!st.dep && along > 0.5) { st.dep = true; st.t0 = C1.t; st.vys = 0; st.vyn = 0; }
    const dEnd = Math.hypot(M.u - b[0], M.v - b[1]);
    if (st.dep) {
      c1Dev(st, 'path', Math.abs(lat) > c1R('posTol'), { lat: +lat.toFixed(2) }, dt);
      c1Dev(st, 'alt', Math.abs(altErr) > c1R('altTol'), { alt: +M.alt.toFixed(2), exp: +altE.toFixed(2) }, dt);
      c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0) }, dt);
      if (st.desc && M.vy < -0.1) { st.vys += -M.vy * dt; st.vyn += dt; }
      // 기동 중 멈춤
      const near = (st.alongTol ? Math.abs(along - L) <= st.alongTol && Math.abs(lat) < c1R('posTol') + 0.5 : dEnd < 1.5) && Math.abs(altErr) < 0.8;
      if (!near && M.hs < c1R('stopV') && Math.abs(M.vy) < c1R('stopV')) st.stopT = (st.stopT || 0) + dt;
      else if (st.stopT) { c1StopEnd(st); }
    }
    // 도착: 끝점 1.5 m 안 · E 처럼 전후 인정 범위(±5 m)가 있으면 그 범위 안에서 멈추면 도착 (짧게 멈춰도·조금 지나쳐도 진행)
    const arrived = st.alongTol ? (Math.abs(along - L) <= st.alongTol && Math.abs(lat) < c1R('posTol') + 0.5 && (dEnd < 1.5 || M.hs < c1R('stillV'))) : dEnd < c1R('posTol') + 0.5;
    if (st.dep && arrived && Math.abs(altErr) < 1.0) {
      if (st.stopT) c1StopEnd(st);
      if (st.desc && st.vyn > 0.5) { C1.refDesc = st.vys / st.vyn; c1Ev('refDesc', { v: +C1.refDesc.toFixed(2), basis: 'triangle 45° descent mean |vy|' }); }
      return true;
    }
    return false;
  },
  arc(st, M, dt) {
    const cu = st.c[0], cv = st.c[1], du = M.u - cu, dv = M.v - cv, r = Math.hypot(du, dv), th = Math.atan2(du, dv) / DEG;   // 방위: 전방 기준 시계 방향
    const dir = st.dir < 0 ? 1 : -1;   // 좌측 먼저(B) = 시계 방향 (방위 증가)
    if (st.th == null) { st.th = th; st.sweep = 0; st.hit = {}; }
    const dth = c1Wrap(th - st.th); st.th = th; st.sweep += dth * dir;
    const tanH = c1Wrap(th + 90 * dir), he = c1Wrap(M.hdg - tanH), altErr = M.alt - (C1.ref || 4);
    st.err = { lat: r - st.R, alt: altErr, hdg: he, s: st.sweep / 360 };
    if (!st.dep && st.sweep > 4) st.dep = true;
    if (st.dep) {
      c1Dev(st, 'path', Math.abs(r - st.R) > c1R('posTol'), { r: +r.toFixed(2) }, dt);
      c1Dev(st, 'alt', Math.abs(altErr) > c1R('altTol'), { alt: +M.alt.toFixed(2) }, dt);
      c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0), want: +tanH.toFixed(0) }, dt);
      for (const [q, ang] of [['B/D', 90], ['C', 180], ['D/B', 270]]) if (!st.hit[q] && st.sweep >= ang) { st.hit[q] = { r: +r.toFixed(2), hdgErr: +he.toFixed(1) }; c1Ev('cp', { q, r: +r.toFixed(2), hdgErr: +he.toFixed(1) }); if (Math.abs(r - st.R) > c1R('posTol')) c1Fail(st, 'skip', { q }); }
      const near = st.sweep > 340;
      if (!near && M.hs < c1R('stopV')) st.stopT = (st.stopT || 0) + dt; else if (st.stopT) c1StopEnd(st);
      if (st.sweep < -20) c1Fail(st, 'path', { wrongDir: true });
    }
    if (st.sweep >= 350 && Math.hypot(M.u - st.start[0], M.v - st.start[1]) < 1.5) { if (st.stopT) c1StopEnd(st); return true; }
    return false;
  },
  emg(st, M, dt) {
    const pu = st.pad[0], pv = st.pad[1], he = c1Wrap(M.hdg);
    c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTolEmg'), { hdg: +M.hdg.toFixed(0) }, dt);
    if (M.alt > c1R('pauseEmgAlt') && M.vy < -0.1) { st.vs = (st.vs || 0) + (-M.vy) * dt; st.vn = (st.vn || 0) + dt; }
    if (M.vy > 0.25 && M.alt > 0.5) { st.up = (st.up || 0) + dt; if (st.up > 0.5) c1Fail(st, 'path', { climbed: true }); }
    if (M.alt > c1R('pauseEmgAlt') && M.hs < 0.25 && Math.abs(M.vy) < 0.15 && st.vn > 0.5) { st.hiP = (st.hiP || 0) + dt; if (st.hiP > 0.6) c1Fail(st, 'pauseAlt', { alt: +M.alt.toFixed(2) }); } else st.hiP = 0;
    if (M.alt <= c1R('pauseEmgAlt') && M.alt > 0.05 && M.hs < 0.25 && Math.abs(M.vy) < 0.15) { st.pT = (st.pT || 0) + dt; if (st.pT >= c1R('pauseEmg')) c1Fail(st, 'pause', { s: +st.pT.toFixed(2) }); } else st.pT = 0;
    st.err = { lat: Math.hypot(M.u - pu, M.v - pv), alt: M.alt, hdg: he };
    if (DR.landed && C1.touch && C1.touch.t >= (st.t0 || 0)) {
      const mean = st.vn > 0 ? st.vs / st.vn : 0, ref = C1.refDesc || c1R('emgRefDefault');
      st.res = { meanDesc: +mean.toFixed(2), refDesc: +ref.toFixed(2), basis: C1.refDesc ? 'triangle 45° descent' : 'app default', touch: C1.touch };
      c1Ev('emgDesc', st.res);
      if (mean < ref * c1R('emgRatio')) c1Fail(st, 'slow', st.res);
      if (!c1SkidOnPad(C1.touch, st.pad)) c1Fail(st, 'pad', { touch: C1.touch });
      return true;
    }
    return false;
  },
  land(st, M, dt) {
    const du = M.u - st.pad[0], dv = M.v - st.pad[1], he = c1Wrap(M.hdg - st.hdg);
    st.err = { lat: Math.hypot(du, dv), alt: M.alt, hdg: he };
    if (!DR.landed) {
      c1Dev(st, 'pos', Math.hypot(du, dv) > c1R('posTol'), { du: +du.toFixed(2), dv: +dv.toFixed(2) }, dt);
      c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0) }, dt);
      st.fin = 0; return false;
    }
    if (!st.td && C1.touch) { st.td = C1.touch; c1Ev('touch', { u: +C1.touch.u.toFixed(2), v: +C1.touch.v.toFixed(2), hdg: +C1.touch.h.toFixed(0) }); if (!c1CenterOnPad(C1.touch.u, C1.touch.v, st.pad)) c1Fail(st, 'pad', { touch: true }); }
    st.fin = (st.fin || 0) + dt;
    if (st.fin > 0.8) { if (!c1CenterOnPad(M.u, M.v, st.pad)) c1Fail(st, 'pad', { final: true, u: +M.u.toFixed(2), v: +M.v.toFixed(2) }); c1Ev('final', { u: +M.u.toFixed(2), v: +M.v.toFixed(2) }); return true; }
    return false;
  }
};
function c1StopEnd(st) {
  const d = st.stopT; st.stopT = 0; c1Ev('stop', { d: +d.toFixed(2) });
  if (d >= c1R('stopShort')) st.longStop = (st.longStop || 0) + 1; else st.shortStop = (st.shortStop || 0) + 1;
  if ((st.shortStop || 0) >= 2 || (st.longStop || 0) >= 1) c1Fail(st, 'stops', { short: st.shortStop || 0, long: st.longStop || 0 });
}
// 정상·측풍: 중심축이 착륙장 안 또는 경계에 접함 · 비상: 스키드 일부라도 F 안 또는 접함
function c1CenterOnPad(u, v, pad) { return Math.abs(u - pad[0]) <= 1.0 + 1e-6 && Math.abs(v - pad[1]) <= 1.0 + 1e-6; }
function c1SkidOnPad(t, pad) {
  if (!t) return false; const h = t.h * DEG, L = c1p('skidLen') / 2, Wd = c1p('skidSpan') / 2;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const fx = i / 2 * L, rx = j / 2 * Wd;   // 기수 방향(fx) · 오른쪽(rx)
    const u = t.u + Math.sin(h) * fx + Math.cos(h) * rx, v = t.v + Math.cos(h) * fx - Math.sin(h) * rx;
    if (c1CenterOnPad(u, v, pad)) return true;
  }
  return false;
}

// ---- 시험 시각 → 해 위치 (그림자로 거리감) · 위도 36.8° · 오늘 날짜 · 한국 표준시 기준 태양 정오 약 12:32 ----
function c1Sun() {
  try {
    if (!isC1() || ENV.night || ENV.dusk) return;
    const h = SET.c1hour || 11, d = new Date(), N = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5), phi = 36.8 * DEG;
    const dec = -23.44 * DEG * Math.cos(2 * Math.PI / 365 * (N + 10)), H = 15 * DEG * (h - 12.53);
    const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;   // 북쪽 기준 시계 방향
    let nx = 0, nz = -1, ex = 1, ez = 0;   // 월드에서 북·동 방향 (현장 좌표계에서 구함)
    if (typeof SITE_X !== 'undefined' && SITE_X.toEN) { const a = SITE_X.toEN(0, 0), bd = SITE_X.toEN(1, 0), bs = SITE_X.toEN(0, 1);
      const dEd = bd[0] - a[0], dNd = bd[1] - a[1], dEs = bs[0] - a[0], dNs = bs[1] - a[1], det = dEd * dNs - dEs * dNd;
      const nd = -dEs / det, ns = dEd / det, ed = dNs / det, es = -dNd / det; nx = ns; nz = -nd; ex = es; ez = -ed; const ln = Math.hypot(nx, nz), le = Math.hypot(ex, ez); nx /= ln; nz /= ln; ex /= le; ez /= le; }
    const ce = Math.cos(Math.max(el, 3 * DEG)), se = Math.sin(Math.max(el, 3 * DEG)), sE = Math.sin(az) * ce, sN = Math.cos(az) * ce;
    SUN_DIR.set(ex * sE + nx * sN, se, ez * sE + nz * sN).normalize(); C1.sun = { h, el: +(el / DEG).toFixed(1), az: +(az / DEG).toFixed(0) };
  } catch (e) { }
}
