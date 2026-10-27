
// =====================================================================
//  모터·프로펠러 소리 (기체별 · 프로펠러 원리로 합성)
//   모터마다: 날개 통과 주파수(rpm/60 × 날개 수)의 배음 + 모터 전기 소음(rpm/60 × 극쌍)
//   공통: 날개 통과 주기로 떨리는 바람 소리(프롭워시)
//   모터 4개가 조종에 따라 조금씩 다른 속도로 돌아 맥놀이(웅웅거림)가 생김
//   소리는 드론 위치에서 남: 거리 감쇠 · 멀수록 고음이 줄어듦 · 도플러 · 좌우 (1종 시험장 조종자 시점·VR 에서 실감)
// =====================================================================
const MOTOR = (function motorSound() {
  // 기체별: n 모터 수 · bl 날개 수 · rpm 최대 회전수 · idle 공회전 비율 · har 배음 세기 · wh 전기 소음 · pp 극쌍 · nz 바람 소리 · nf 바람 소리 중심(BPF 배수) · g 크기
  const P = {
    x2d:   { n: 4, bl: 2, rpm: 11000, idle: 0.2, har: [1, 0.5, 0.3, 0.18, 0.11, 0.07, 0.04], wh: 0.05, pp: 7, nz: 0.6, nf: 2.3, g: 0.42 },
    anafi: { n: 4, bl: 2, rpm: 14500, idle: 0.2, har: [1, 0.45, 0.28, 0.16, 0.1, 0.06], wh: 0.06, pp: 6, nz: 0.55, nf: 2.5, g: 0.36 },
    fpv:   { n: 4, bl: 3, rpm: 31000, idle: 0.12, har: [1, 0.72, 0.5, 0.36, 0.26, 0.18, 0.13, 0.09], wh: 0.09, pp: 7, nz: 0.85, nf: 2.8, g: 0.4 },
    kfpv:  { n: 4, bl: 3, rpm: 22000, idle: 0.14, har: [1, 0.68, 0.46, 0.32, 0.22, 0.15, 0.1], wh: 0.08, pp: 7, nz: 0.85, nf: 2.6, g: 0.46 },
    fw:    { n: 1, bl: 2, rpm: 9500, idle: 0.3, har: [1, 0.55, 0.32, 0.2, 0.12, 0.07], wh: 0.05, pp: 7, nz: 0.45, nf: 2.2, g: 0.5 },
    puma:  { n: 1, bl: 2, rpm: 7200, idle: 0.3, har: [1, 0.6, 0.36, 0.22, 0.14, 0.08], wh: 0.04, pp: 7, nz: 0.45, nf: 2, g: 0.55 },
    kfw:   { n: 1, bl: 2, rpm: 15000, idle: 0.3, har: [1, 0.65, 0.42, 0.28, 0.18, 0.11], wh: 0.07, pp: 7, nz: 0.5, nf: 2.4, g: 0.5 },
    c1:    { n: 4, bl: 2, rpm: 6200, idle: 0.22, har: [1, 0.62, 0.4, 0.26, 0.17, 0.11, 0.07, 0.05], wh: 0.035, pp: 14, nz: 0.75, nf: 2, g: 0.7, ref: 6 },   // 1종 대형 멀티콥터: 큰 프로펠러 · 낮고 묵직함
  };
  // X 배치: 왼쪽 앞·오른쪽 앞·오른쪽 뒤·왼쪽 뒤 (좌우 sx · 앞뒤 sy · 회전 방향 sz)
  const MX = [[-1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, -1, -1]];
  const st = { on: false, af: null, m: [], bus: null, pan: null, lp: null, nzG: null, nzF: null, am: null, amO: null, lastD: null, dop: 1, wob: [0, 0, 0, 0], k: 0 };
  function build(af) {
    const ctx = AU.ctx, p = P[af] || P.x2d; teardown();
    st.af = af; st.p = p;
    st.bus = ctx.createGain(); st.bus.gain.value = 0;
    st.lp = ctx.createBiquadFilter(); st.lp.type = 'lowpass'; st.lp.frequency.value = 16000; st.lp.Q.value = 0.5;
    st.pan = ctx.createPanner(); st.pan.panningModel = LOWQ ? 'equalpower' : 'HRTF'; st.pan.distanceModel = 'inverse'; st.pan.refDistance = p.ref || 2.5; st.pan.rolloffFactor = 1; st.pan.maxDistance = 2000;
    st.bus.connect(st.lp); st.lp.connect(st.pan); st.pan.connect(AU.master);
    // 배음 모양 (사인 계열 · 위상은 고르게 흩어 뾰족한 파형을 피함)
    const N = p.har.length + 1, re = new Float32Array(N), im = new Float32Array(N); for (let i = 1; i < N; i++) { const a = p.har[i - 1], ph = i * 1.7; re[i] = a * Math.cos(ph); im[i] = a * Math.sin(ph); }
    const wave = ctx.createPeriodicWave(re, im);
    st.m = [];
    for (let i = 0; i < p.n; i++) {
      const o = ctx.createOscillator(); o.setPeriodicWave(wave); const g = ctx.createGain(); g.gain.value = 0;
      const w = ctx.createOscillator(); w.type = 'triangle'; const wg = ctx.createGain(); wg.gain.value = 0;
      o.connect(g); g.connect(st.bus); w.connect(wg); wg.connect(st.bus); o.start(); w.start();
      st.m.push({ o, g, w, wg, det: 1 + (i - 1.5) * 0.006 + (Math.random() - 0.5) * 0.004 });
    }
    // 프롭워시: 잡음 → 대역 통과 → 날개 통과 주기로 떨림(진폭 변조)
    const s = ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true;
    st.nzF = ctx.createBiquadFilter(); st.nzF.type = 'bandpass'; st.nzF.Q.value = 0.8; st.nzG = ctx.createGain(); st.nzG.gain.value = 0;
    st.am = ctx.createGain(); st.am.gain.value = 0.6; st.amO = ctx.createOscillator(); st.amO.type = 'sine'; const ad = ctx.createGain(); ad.gain.value = 0.4; st.amO.connect(ad); ad.connect(st.am.gain);
    s.connect(st.nzF); st.nzF.connect(st.am); st.am.connect(st.nzG); st.nzG.connect(st.bus); s.start(); st.amO.start(); st.nzS = s;
    st.on = true;
  }
  function teardown() {
    if (!st.on) return; const t = AU.ctx.currentTime;
    for (const m of st.m) { try { m.o.stop(t + 0.05); m.w.stop(t + 0.05); } catch (e) { } }
    try { st.nzS.stop(t + 0.05); st.amO.stop(t + 0.05); } catch (e) { }
    const b = st.bus; setTimeout(() => { try { b.disconnect(); } catch (e) { } }, 200); st.on = false; st.m = [];
  }
  const _lp = new V3(), _lf = new V3(), _lu = new V3(), _q = new THREE.Quaternion();
  function setListener(cam) {
    const L = AU.ctx.listener; cam.getWorldPosition(_lp); cam.getWorldQuaternion(_q); _lf.set(0, 0, -1).applyQuaternion(_q); _lu.set(0, 1, 0).applyQuaternion(_q);
    if (L.positionX) { const t = AU.ctx.currentTime; L.positionX.setTargetAtTime(_lp.x, t, 0.02); L.positionY.setTargetAtTime(_lp.y, t, 0.02); L.positionZ.setTargetAtTime(_lp.z, t, 0.02); L.forwardX.setTargetAtTime(_lf.x, t, 0.02); L.forwardY.setTargetAtTime(_lf.y, t, 0.02); L.forwardZ.setTargetAtTime(_lf.z, t, 0.02); L.upX.setTargetAtTime(_lu.x, t, 0.02); L.upY.setTargetAtTime(_lu.y, t, 0.02); L.upZ.setTargetAtTime(_lu.z, t, 0.02); }
    else { L.setPosition(_lp.x, _lp.y, _lp.z); L.setOrientation(_lf.x, _lf.y, _lf.z, _lu.x, _lu.y, _lu.z); }
    return _lp;
  }
  // 매 프레임: thrust 0~1 (모터 출력) · active 소리 남 · subj 드론 자세(p) · stick 조종 입력(쿼드: 모터마다 다른 속도)
  function tick(dt, thrust, active, subj, af) {
    if (!AU.ctx || !AU.noise || !subj || !subj.p) return false;
    if (window.SIM_OLDMOTOR) { if (st.on) teardown(); return false; }
    if (!st.on || st.af !== af) build(af);
    const ctx = AU.ctx, t = ctx.currentTime, p = st.p;
    // 듣는 곳: 화면 카메라 (1종 VR 조종자 시점은 머리 위치)
    let cam = camera; try { if (typeof c1VRon === 'function' && c1VRon() && renderer.xr.isPresenting) cam = renderer.xr.getCamera(); } catch (e) { }
    const lp = setListener(cam), sp = subj.p, d = Math.hypot(sp.x - lp.x, sp.y - lp.y, sp.z - lp.z);
    if (st.pan.positionX) { st.pan.positionX.setTargetAtTime(sp.x, t, 0.02); st.pan.positionY.setTargetAtTime(sp.y, t, 0.02); st.pan.positionZ.setTargetAtTime(sp.z, t, 0.02); } else st.pan.setPosition(sp.x, sp.y, sp.z);
    // 도플러: 멀어지면 낮게, 다가오면 높게 · 거리에 따라 높은 소리가 먼저 줄어듦(공기 흡수)
    if (st.lastD != null && dt > 0 && Math.abs(d - st.lastD) < 12) { const vr = clamp((d - st.lastD) / dt, -80, 80); st.dop += (343 / (343 + vr) - st.dop) * Math.min(1, dt * 6); }   // 순간 이동(재시작·카메라 전환)은 무시
    else if (st.lastD != null) st.dop = 1;
    st.lastD = d;
    st.lp.frequency.setTargetAtTime(clamp(18000 / (1 + d / 25), 1800, 18000), t, 0.05);
    const on = AU.on && active ? 1 : 0, thr = clamp(thrust, 0, 1), idle = p.idle;
    // 쿼드: 조종 입력만큼 모터마다 회전수가 다름 (+ 느린 흔들림: 공기 흐름)
    const ir = (typeof IN !== 'undefined' && S.state === 'run') ? IN : { roll: 0, pitch: 0, yaw: 0 };
    st.k += dt; let fsum = 0;
    st.m.forEach((m, i) => {
      st.wob[i] += ((Math.random() - 0.5) * 0.02 - st.wob[i]) * Math.min(1, dt * 2);
      let u = thr; if (p.n === 4) { const c = MX[i]; u = thr * (1 + 0.22 * (c[0] * -(ir.roll || 0) + c[1] * -(ir.pitch || 0)) + 0.14 * c[2] * (ir.yaw || 0)); }
      const rf = Math.sqrt(clamp(idle * idle + (1 - idle * idle) * clamp(u, 0, 1.2), 0, 1.3)), rpm = p.rpm * rf * m.det * (1 + st.wob[i]), bpf = rpm / 60 * p.bl * st.dop;
      m.o.frequency.setTargetAtTime(bpf, t, 0.03); m.w.frequency.setTargetAtTime(Math.min(9000, rpm / 60 * p.pp * st.dop), t, 0.03);
      const lv = on * Math.pow(rf, 2.2) * p.g / Math.sqrt(p.n);
      m.g.gain.setTargetAtTime(lv * 0.5, t, 0.04); m.wg.gain.setTargetAtTime(lv * p.wh * (0.4 + rf), t, 0.04); fsum += bpf;
    });
    const fav = fsum / Math.max(1, st.m.length), rfa = Math.sqrt(idle * idle + (1 - idle * idle) * thr);
    st.nzF.frequency.setTargetAtTime(clamp(fav * p.nf, 200, 9000), t, 0.05); st.amO.frequency.setTargetAtTime(fav, t, 0.05);
    st.nzG.gain.setTargetAtTime(on * p.nz * Math.pow(rfa, 2.6) * p.g * 0.9, t, 0.05);
    st.bus.gain.setTargetAtTime(1, t, 0.05);
    return true;
  }
  function stop() { if (st.on && AU.ctx) st.bus.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.05); }
  return { tick, stop, P, st };
})();
