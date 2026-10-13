
// =====================================================================
//  drone model
// =====================================================================
function makeDrone(ghost) {
  const g = new THREE.Group();
  const gm = ghost ? new THREE.MeshBasicMaterial({ color: 0x55e6ff, transparent: true, opacity: 0.38, depthWrite: false }) : null;
  const m = c => gm || c;
  const carbon = m(mat(0x1d1f22, { roughness: 0.5 })), camo = m(mat(0xffffff, { map: TX.droneCamo })), mot = m(mat(0x9ea3a8, { roughness: 0.35, metalness: 0.7 }));
  const add = (geo, mt, x, y, z, sx, sy, sz) => { const me = new THREE.Mesh(geo, mt); me.position.set(x, y, z); if (sx) me.scale.set(sx, sy, sz); me.castShadow = !ghost; g.add(me); return me; };
  add(UBOX, camo, 0, 0.01, 0, 0.12, 0.055, 0.22);
  add(UBOX, carbon, 0, -0.025, 0, 0.16, 0.012, 0.26);
  for (const a of [45, 135, 225, 315]) {
    const r = a * DEG, me = add(UBOX, carbon, Math.sin(r) * 0.115, -0.02, -Math.cos(r) * 0.115, 0.03, 0.012, 0.23);
    me.rotation.y = -r;
  }
  const props = [];
  const pm = gm || new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const bladeM = m(mat(0x30343a, { roughness: 0.4 }));
  for (const [x, z] of [[0.163, -0.163], [-0.163, -0.163], [0.163, 0.163], [-0.163, 0.163]]) {
    add(UCYL, mot, x, -0.005, z, 0.022, 0.03, 0.022);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.115, 24), pm); disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.016, z); g.add(disc);
    const bl = add(UBOX, bladeM, x, 0.017, z, 0.23, 0.004, 0.018); props.push(bl);
  }
  add(UBOX, carbon, 0, 0.012, -0.125, 0.035, 0.035, 0.03);
  add(UCYL, m(mat(0x0c1a2a, { roughness: 0.1, metalness: 0.5 })), 0, 0.012, -0.142, 0.011, 0.01, 0.011).rotation.x = Math.PI / 2;
  add(UBOX, m(mat(0x2b8a4a)), -0.04, 0.045, 0.05, 0.04, 0.03, 0.06);
  for (const sx of [-1, 1]) add(UCYL6, carbon, sx * 0.04, 0.07, 0.1, 0.004, 0.07, 0.004).rotation.x = -0.4;
  add(UBOX, carbon, 0, -0.045, 0, 0.13, 0.008, 0.08);
  const cans = [];
  const canM = m(mat(0x7c8288, { roughness: 0.45, metalness: 0.5 }));
  for (const x of [-0.045, 0, 0.045]) { const c = add(UCYL, canM, x, -0.075, 0.0, 0.019, 0.12, 0.019); c.rotation.x = Math.PI / 2; cans.push(c); }
  const ledG = add(UBOX, gm || new THREE.MeshBasicMaterial({ color: 0x30ff60 }), 0.06, -0.02, 0.13, 0.012, 0.012, 0.012);
  const ledR = add(UBOX, gm || new THREE.MeshBasicMaterial({ color: 0xff3030 }), -0.06, -0.02, 0.13, 0.012, 0.012, 0.012);
  return { g, props, cans, leds: [ledG, ledR] };
}
const droneM = makeDrone(false); scene.add(droneM.g);
const ghostM = makeDrone(true); scene.add(ghostM.g); ghostM.g.visible = false;
const spot = new THREE.SpotLight(0xfff2dc, 0, 14, 0.7, 0.45, 1.2);
scene.add(spot); const spotT = new THREE.Object3D(); scene.add(spotT); spot.target = spotT;   // 드론이 안 보이는(FPV) 상태에서도 켜지도록 장면에 직접 둠

// =====================================================================
//  reference (ghost) path from the Blender flight
// =====================================================================
const GH = (function () {
  const wp = D.wp; const pts = wp.map(w => W(w[0], w[1], Math.max(w[2], 0.17)));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const N = 5000, P = [], T = [], LB = []; let t = 0, prev = curve.getPoint(0);
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = curve.getPoint(u);
    if (i > 0) {
      const f = u * (wp.length - 1), k = Math.min(Math.floor(f), wp.length - 2), fr = f - k;
      const sp = Math.max(lerp(wp[k][3], wp[k + 1][3], fr), 1.2);
      t += p.distanceTo(prev) / sp;
    }
    P.push(p); T.push(t); prev = p;
  }
  // 라벨 시각 (투하 등)
  const events = [];
  wp.forEach((w, i) => { if (w[4]) { const u = i / (wp.length - 1); events.push({ t: T[Math.round(u * N)], label: w[4] }); } });
  const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(1500));
  const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0xffc828, dashSize: 0.8, gapSize: 0.6, transparent: true, opacity: 0.85 }));
  line.computeLineDistances(); line.visible = false; scene.add(line);
  function at(time, out) {
    if (time <= 0) return out.copy(P[0]);
    if (time >= t) return out.copy(P[N]);
    let lo = 0, hi = N; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid] < time) lo = mid; else hi = mid; }
    return out.copy(P[lo]).lerp(P[hi], (time - T[lo]) / Math.max(T[hi] - T[lo], 1e-6));
  }
  return { at, total: t, events, line };
})();

// =====================================================================
//  objectives
// =====================================================================
const OBJS = [];
function hintMat() { return new THREE.MeshBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }); }
function addHint(b, geo, lx, ly, lz, rotX) { const me = new THREE.Mesh(geo, hintMat()); me.position.set(lx, lz, -ly); if (rotX) me.rotation.x = rotX; me.visible = false; me.renderOrder = 5; b.g.add(me); return me; }
function passObj(id, label) {
  const b = OBJ[id], p = b.pass; let hint, mk;
  if (p.kind === 'sq') { hint = addHint(b, new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0), 0, 0, (p.z0 + p.z1) / 2); mk = b.world(0, 0, p.z1 + 0.9); }
  else if (p.kind === 'ring') { hint = addHint(b, new THREE.CircleGeometry(p.r, 40), 0, 0, p.zc); mk = b.world(0, 0, p.zc + p.r + 0.9); }
  else if (p.kind === 'tri') {
    const s = new THREE.Shape(); s.moveTo(p.A[0], p.A[1]); s.lineTo(p.B[0], p.B[1]); s.lineTo(p.C[0], p.C[1]); s.lineTo(p.A[0], p.A[1]);
    hint = addHint(b, new THREE.ShapeGeometry(s), 0, 0, 0); mk = b.world(0, 0, p.C[1] + 1.0);
  } else if (p.kind === 'tunnel') { hint = addHint(b, new THREE.CircleGeometry(p.r, 40), 0, -p.L / 2 - 0.02, p.zc); mk = b.world(0, -p.L / 2, p.zc + p.r + 1.2); }
  OBJS.push({ kind: 'pass', b, label, hint, mk });
}
function buildObjectives() {
  const ps = BY.pad_start;
  OBJS.push({ kind: 'takeoff', label: 'TAKEOFF', mk: W(ps.down, ps.side, 2.4) });
  passObj('ring_a', 'RING');
  passObj('gate_sq1', 'WINDOW GATE 1');
  passObj('gate_tri1', 'TRIANGLE GATE');
  passObj('gate_sq2', 'WINDOW GATE 2');
  const poles = ['pole1', 'pole2', 'pole3', 'pole4', 'pole5', 'pole6'].map(i => BY[i]).sort((a, b) => a.down - b.down);
  const sd = p => p.side0 !== undefined ? p.side0 : p.side;   // 경로 코스는 원래 레인 기준 좌우
  const cen = poles.reduce((s, p) => s + sd(p), 0) / poles.length;
  poles.forEach((p, k) => {
    const sg = Math.abs(sd(p) - cen) < 0.05 ? (k % 2 ? -1 : 1) : (sd(p) < cen ? 1 : -1);
    const b = OBJ[p.id];
    const hint = addHint(b, new THREE.PlaneGeometry(1.1, 3.2), sg * 0.85, 0, 1.9);
    OBJS.push({ kind: 'slalom', b, sg, label: `SLALOM ${k + 1}/6 · ${sg > 0 ? 'RIGHT' : 'LEFT'} SIDE`, hint, mk: b.world(sg * 0.85, 0, 4.0) });
  });
  const ringGeo = new THREE.RingGeometry(1.2, 1.45, 40);
  const ringHint = (pos) => { const me = new THREE.Mesh(ringGeo, hintMat()); me.material.opacity = 0.55; me.rotation.x = -Math.PI / 2; me.position.copy(pos).setY(groundAt(pos.x, pos.z) + 0.05); me.visible = false; scene.add(me); return me; };
  const iv = OBJ.ivan_grp1;
  OBJS.push({ kind: 'drop', target: 'ivan', label: 'DROP 1 · IVAN', hint: ringHint(iv.world(0, 0, 0)), mk: iv.world(0, 0, 4.2) });
  const mit = OBJ.mit;
  OBJS.push({ kind: 'drop', target: 'mit', label: 'DROP 2 · MIT (MOVING)', hint: ringHint(mit.world(0, 0, 0)), mk: mit.world(0, 0, 4.2), follow: true });
  const tk = OBJ.tank;
  const oh = new THREE.Mesh(new THREE.RingGeometry(11.3, 12.7, 96), hintMat()); oh.material.opacity = 0.35; oh.rotation.x = -Math.PI / 2;
  oh.position.copy(tk.world(0, 0, 0)).add(new V3(0, 0.06, 0)); oh.visible = false; scene.add(oh);
  OBJS.push({ kind: 'orbit', b: tk, R: 12, label: 'TANK ORBIT · 360°', hint: oh, mk: tk.world(0, 0, 8) });
  const th = ringHint(tk.world(0, 0, 0)); th.scale.set(4, 4, 4);
  OBJS.push({ kind: 'drop', target: 'tank', label: 'DROP 3 · TANK', hint: th, mk: tk.world(0, 0, 5.5) });
  passObj('tunnel1', 'TUNNEL');
  const bk = OBJ.bunker1, wn = bk.win;
  const bh = addHint(bk, new THREE.PlaneGeometry(wn.x1 - wn.x0, wn.z1 - wn.z0), wn.xc, wn.y - 0.02, wn.zc);
  const w2 = bk.win2;
  const bh2 = addHint(bk, new THREE.PlaneGeometry(w2.y1 - w2.y0, w2.z1 - w2.z0), w2.x - 0.02, 0, w2.zc); bh2.rotation.y = Math.PI / 2;
  OBJS.push({ kind: 'bunker', b: bk, label: 'BUNKER RECON', hint: bh, hint1: bh, hint2: bh2, mk: bk.world(wn.xc, wn.y, bk.dims.h + 1.4),
    mk1: bk.world(wn.xc, wn.y, bk.dims.h + 1.4), mk2: bk.world(w2.x - 0.6, 0, bk.dims.h + 1.4) });
  passObj('gate_finish', 'FINISH GATE');
  const pl = OBJ.pad_land; const lh = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 40), hintMat()); lh.material.opacity = 0.7;
  lh.rotation.x = -Math.PI / 2; lh.position.copy(pl.world(0, 0, 0.18)); lh.visible = false; scene.add(lh);
  OBJS.push({ kind: 'land', b: pl, label: 'LAND · RIGHT H-PAD', hint: lh, mk: pl.world(0, 0, 1.8) });
}
buildObjectives();
const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: 0xffc828, transparent: true, opacity: 0.9, depthTest: false, fog: false }));
marker.scale.set(1, 1.5, 1); marker.renderOrder = 999; scene.add(marker); marker.visible = false;

// =====================================================================
//  effects (impact flash + smoke)
// =====================================================================
const FX = [];
function spawnImpact(p, big) {
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0c8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  fl.position.copy(p).add(new V3(0, 0.3, 0)); scene.add(fl); FX.push({ s: fl, t: 0, life: 0.16, kind: 'flash', size: big ? 7 : 4 });
  for (let i = 0; i < (big ? 9 : 6); i++) {
    const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xd9d6cf, depthWrite: false, transparent: true, opacity: 0.8 }));
    sm.position.copy(p).add(new V3((Math.random() - 0.5) * 0.8, 0.2 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8)); scene.add(sm);
    FX.push({ s: sm, t: 0, life: 2.6 + Math.random() * 1.4, kind: 'smoke', v: new V3((Math.random() - 0.5) * 0.6, 0.35 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6), size: 0.8 + Math.random() * 0.8 });
  }
}
function spawnSpark(p) {
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd080, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  fl.position.copy(p); scene.add(fl); FX.push({ s: fl, t: 0, life: 0.12, kind: 'flash', size: 1.2 });
  for (let i = 0; i < 3; i++) {
    const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xbdb7aa, depthWrite: false, transparent: true, opacity: 0.6 }));
    sm.position.copy(p); scene.add(sm);
    FX.push({ s: sm, t: 0, life: 0.9, kind: 'smoke', v: new V3((Math.random() - 0.5) * 0.8, 0.3, (Math.random() - 0.5) * 0.8), size: 0.25 });
  }
}
function updateFX(dt) {
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i]; f.t += dt; const a = f.t / f.life;
    if (a >= 1) { scene.remove(f.s); f.s.material.dispose(); FX.splice(i, 1); continue; }
    if (f.kind === 'flash') { const s = f.size * Math.sin(a * Math.PI); f.s.scale.set(s, s, s); f.s.material.opacity = 1 - a; }
    else { f.s.position.addScaledVector(f.v, dt); f.v.multiplyScalar(0.985); const s = f.size + a * 3.2; f.s.scale.set(s, s, s); f.s.material.opacity = 0.75 * (1 - a) * Math.min(1, f.t * 6); }
  }
}

// =====================================================================
//  audio
// =====================================================================
const AU = { ctx: null, on: true };
function initAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); AU.ctx = ctx;
    AU.master = ctx.createGain(); AU.master.gain.value = 0.55; AU.master.connect(ctx.destination);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(AU.master);
    AU.mg = ctx.createGain(); AU.mg.gain.value = 0; AU.mg.connect(lp);
    AU.o1 = ctx.createOscillator(); AU.o1.type = 'sawtooth'; AU.o2 = ctx.createOscillator(); AU.o2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.35; AU.o1.connect(AU.mg); AU.o2.connect(g2); g2.connect(AU.mg); AU.o1.start(); AU.o2.start();
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    AU.noise = nb; const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    AU.wg = ctx.createGain(); AU.wg.gain.value = 0; ns.connect(bp); bp.connect(AU.wg); AU.wg.connect(AU.master); ns.start();
  } catch (e) { AU.ctx = null; }
}
function audioUpdate(thrust, speed, active) {
  if (!AU.ctx) return; const t = AU.ctx.currentTime;
  const on = AU.on && active ? 1 : 0;
  AU.o1.frequency.setTargetAtTime(95 + thrust * 170 + speed * 2, t, 0.05); AU.o2.frequency.setTargetAtTime(190 + thrust * 330 + speed * 4, t, 0.05);
  AU.mg.gain.setTargetAtTime(on * (0.05 + thrust * 0.07), t, 0.08); AU.wg.gain.setTargetAtTime(on * Math.min(speed / 25, 1) * 0.14, t, 0.1);
}
function sfx(kind) {
  if (!AU.ctx || !AU.on) return; const ctx = AU.ctx, t = ctx.currentTime;
  if (kind === 'chime' || kind === 'good') {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(kind === 'good' ? 660 : 880, t); o.frequency.setValueAtTime(kind === 'good' ? 990 : 1320, t + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + 0.4);
  } else if (kind === 'bang' || kind === 'crash') {
    const s = ctx.createBufferSource(); s.buffer = AU.noise; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(kind === 'bang' ? 2600 : 1200, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(kind === 'bang' ? 0.9 : 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'bang' ? 1.2 : 0.5));
    s.connect(f); f.connect(g); g.connect(AU.master); s.start(t); s.stop(t + 1.3);
  } else if (kind === 'bad') {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(220, t); o.frequency.setValueAtTime(160, t + 0.12);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + 0.32);
  } else if (kind === 'drop') {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.15);
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + 0.2);
  }
}

