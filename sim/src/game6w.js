
// =====================================================================
//  날씨 효과 더하기
//   비: 땅에 튀는 물방울 · 젖은 땅(어둡고 번들) · 평평한 곳 물웅덩이(하늘 비침) · FPV 렌즈 물방울 · 빗소리 · 가끔 천둥·번개
//   눈: 둥글고 부드러운 눈송이 · FPV 렌즈에 붙었다 녹는 눈 · 바람 소리
//   비·눈: 골짜기에 낮게 깔린 안개 · 능선에 걸린 구름
// =====================================================================
const WX2 = (function weatherFx() {
  const st = { wet: { value: 0 }, sky: { value: new THREE.Color(0x9aa3ab) }, patched: false, thT: 25 + Math.random() * 30 };
  const isVR = () => typeof XR_ON !== 'undefined' && XR_ON;
  const kind = () => ENV.ir ? 'clear' : (ENV.wx || 'clear');
  // ---- 1) 젖은 땅 · 물웅덩이: 장면 재질(Standard)에 덧칠 (처음 비가 올 때 한 번) ----
  function wetify(m) {
    if (!m || m.userData.wety || !m.isMeshStandardMaterial || m.alphaTest > 0 || m.transparent) return; m.userData.wety = true;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uWet = st.wet; sh.uniforms.uWetSky = st.sky;
      sh.vertexShader = 'varying vec3 vWetP; varying float vWetN;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  { vec4 wwp = vec4(transformed, 1.0); vec3 wwn = objectNormal;\n  #ifdef USE_INSTANCING\n  wwp = instanceMatrix * wwp; wwn = mat3(instanceMatrix) * wwn;\n  #endif\n  vWetP = (modelMatrix * wwp).xyz; vWetN = normalize(mat3(modelMatrix) * wwn).y; }');
      sh.fragmentShader = 'uniform float uWet; uniform vec3 uWetSky; varying vec3 vWetP; varying float vWetN;\n' +
        'float wetH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
        'float wetV(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wetH(i), wetH(i + vec2(1.0, 0.0)), f.x), mix(wetH(i + vec2(0.0, 1.0)), wetH(i + vec2(1.0, 1.0)), f.x), f.y); }\n' +
        sh.fragmentShader
          .replace('#include <color_fragment>', '#include <color_fragment>\n  float wUp = uWet * smoothstep(0.25, 0.85, vWetN);\n  float wPud = uWet * smoothstep(0.975, 0.995, vWetN) * smoothstep(0.7, 0.78, wetV(vWetP.xz * 0.14) * 0.65 + wetV(vWetP.xz * 0.55) * 0.35);\n  diffuseColor.rgb *= 1.0 - 0.24 * wUp - 0.3 * wPud;')
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.72, wUp); roughnessFactor = mix(roughnessFactor, 0.16, wPud);')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  { vec3 wvd = normalize(vViewPosition); vec3 wuv = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); float wfr = pow(1.0 - clamp(dot(wvd, wuv), 0.0, 1.0), 3.0); totalEmissiveRadiance += uWetSky * wPud * (0.025 + 0.3 * wfr); }'); };
    const ck = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => ''; m.customProgramCacheKey = () => ck() + '|wet'; m.needsUpdate = true;
  }
  function wetPatch() {
    if (st.patched) return; st.patched = true;
    const skip = new Set(); [droneM && droneM.g, ghostM && ghostM.g, sky, WX.g].forEach(o => o && o.traverse(c => skip.add(c)));
    scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && !skip.has(o) && o !== GRASS) (Array.isArray(o.material) ? o.material : [o.material]).forEach(wetify); });
  }
  // ---- 2) 땅에 튀는 빗방울: 납작한 고리가 퍼지며 사라짐 (카메라 둘레 18 m) ----
  const SPL = (() => {
    const N = LOWQ ? 90 : 220, g = new THREE.RingGeometry(0.72, 1, 10, 1); g.rotateX(-Math.PI / 2);
    const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), N);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.visible = false; im.renderOrder = 3; im.userData.irOnly = false; scene.add(im);
    const c = new THREE.Color(0); for (let i = 0; i < N; i++) im.setColorAt(i, c);
    const P = []; for (let i = 0; i < N; i++) P.push({ x: 0, y: 0, z: 0, t: Math.random() * 0.3, L: 0.22 + Math.random() * 0.12 });
    return { im, P, N };
  })();
  const _m4 = new THREE.Matrix4(), _q0 = new THREE.Quaternion(), _p3 = new V3(), _s3 = new V3(), _c3 = new THREE.Color(), _fw = new V3();
  function splashTick(dt, on) {
    const cp = camera.position, agl = cp.y - groundAt(cp.x, cp.z), show = on && agl < 35; SPL.im.visible = show; if (!show) return;
    const amb = ENV.night ? 0.25 : ENV.dusk ? 0.55 : 0.75, R = 18;
    for (let i = 0; i < SPL.N; i++) { const p = SPL.P[i]; p.t += dt;
      if (p.t > p.L) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * R; p.x = cp.x + Math.cos(a) * d; p.z = cp.z + Math.sin(a) * d; p.y = groundAt(p.x, p.z) + 0.04; p.t = 0; p.L = 0.22 + Math.random() * 0.12; }
      const k = p.t / p.L, s = 0.025 + 0.11 * k, dd = Math.hypot(p.x - cp.x, p.y - cp.y, p.z - cp.z), f = (1 - k) * (1 - k) * amb * 0.32 * clamp(1.4 - dd / 14, 0, 1);
      _m4.compose(_p3.set(p.x, p.y, p.z), _q0, _s3.set(s, 1, s)); SPL.im.setMatrixAt(i, _m4); SPL.im.setColorAt(i, _c3.setRGB(f * 0.85, f * 0.9, f)); }
    SPL.im.instanceMatrix.needsUpdate = true; SPL.im.instanceColor.needsUpdate = true;
  }
  // ---- 3) FPV 렌즈 물방울·눈: 화면 위 2D 그림 (VR 제외) ----
  const LENS = (() => { const c = document.createElement('canvas'); c.id = 'lensFx'; c.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;display:none';
    const gl = document.getElementById('c'); if (gl && gl.parentNode) gl.parentNode.insertBefore(c, gl.nextSibling); else document.body.appendChild(c);
    return { c, g: c.getContext('2d'), d: [], acc: 0, tt: 0, w: 0, h: 0 }; })();
  function lensTick(dt, mode) {
    const L = LENS, on = mode !== 'clear' && CAMS[S.cam] === 'FPV' && !isVR() && (S.state === 'run' || S.state === 'pause') && DR.alive;
    if (!on) { if (L.d.length || L.c.style.display !== 'none') { L.d.length = 0; L.c.style.display = 'none'; } return; }
    L.c.style.display = ''; L.tt += dt; if (L.tt < 1 / 30) return; const T = L.tt; L.tt = 0;
    const w = Math.round(innerWidth * 0.6), h = Math.round(innerHeight * 0.6); if (L.w !== w || L.h !== h) { L.c.width = L.w = w; L.c.height = L.h = h; }
    camera.getWorldDirection(_fw); const fwd = Math.max(0, DR.v.dot(_fw)), snow = mode === 'snow', run = S.state === 'run';
    // 새 방울: 비는 앞으로 갈수록 많이 맞음
    if (run) { L.acc += T * (snow ? 1.2 + fwd * 0.35 : 2.5 + fwd * 0.9); while (L.acc > 1 && L.d.length < 48) { L.acc -= 1;
      L.d.push({ x: Math.random() * w, y: Math.random() * h, r: (snow ? 3 + Math.random() * 6 : 5 + Math.random() * 13) * w / 1150, a: 0, life: snow ? 1.5 + Math.random() * 2.5 : 3 + Math.random() * 6, age: 0, px: null, py: null }); } L.acc = Math.min(L.acc, 3); }
    const g = L.g, cx = w / 2, cy = h / 2; g.clearRect(0, 0, w, h);
    for (let i = L.d.length - 1; i >= 0; i--) { const d = L.d[i]; d.age += T; d.a = Math.min(1, d.age * 8) * clamp((d.life - d.age) / 0.8, 0, 1);
      // 맞바람에 가장자리로 밀리고, 큰 방울은 아래로 흘러내림
      const ox = d.x - cx, oy = d.y - cy, push = run ? fwd * 0.045 : 0, grav = snow ? 0 : Math.max(0, d.r - 9 * w / 1150) * 2.2;
      d.px = d.x; d.py = d.y; d.x += ox * push * T; d.y += (oy * push + grav) * T;
      if (d.age > d.life || d.x < -20 || d.y < -20 || d.x > w + 20 || d.y > h + 20) { L.d.splice(i, 1); continue; }
      const r = snow ? d.r * (0.6 + 0.4 * clamp((d.life - d.age) / d.life * 1.5, 0, 1)) : d.r, a = d.a;
      if (!snow && Math.hypot(d.x - d.px, d.y - d.py) > 0.6) { g.strokeStyle = `rgba(215,225,235,${0.14 * a})`; g.lineWidth = r * 0.55; g.lineCap = 'round'; g.beginPath(); g.moveTo(d.px - (d.x - d.px) * 3, d.py - (d.y - d.py) * 3); g.lineTo(d.x, d.y); g.stroke(); }
      const gr = g.createRadialGradient(d.x - r * 0.3, d.y - r * 0.35, r * 0.08, d.x, d.y, r);
      if (snow) { gr.addColorStop(0, `rgba(255,255,255,${0.85 * a})`); gr.addColorStop(0.55, `rgba(240,245,250,${0.45 * a})`); gr.addColorStop(1, 'rgba(240,245,250,0)'); }
      else { gr.addColorStop(0, `rgba(255,255,255,${0.75 * a})`); gr.addColorStop(0.22, `rgba(225,235,245,${0.3 * a})`); gr.addColorStop(0.6, `rgba(150,165,180,${0.2 * a})`); gr.addColorStop(0.86, `rgba(45,52,60,${0.38 * a})`); gr.addColorStop(1, `rgba(15,18,22,${0.5 * a})`); }
      g.fillStyle = gr; g.beginPath(); g.ellipse(d.x, d.y, r, r * (snow ? 1 : 1.08), 0, 0, 6.283); g.fill(); }
  }
  // ---- 4) 소리: 빗소리(쏴아 + 톡톡) · 눈 올 때 낮은 바람 · 천둥 ----
  function audioTick(dt, mode) {
    if (!AU.ctx || !AU.noise) return; const ctx = AU.ctx, t = ctx.currentTime;
    if (!st.au) { const s = ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true; s.loopStart = 0.37; s.loopEnd = 1.93;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
      const g = ctx.createGain(); g.gain.value = 0; s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(AU.master); s.start(); st.au = { g, hp, lp }; }
    const live = S.state === 'run' && AU.on !== false, rain = mode === 'rain' && live, snow = mode === 'snow' && live;
    st.au.g.gain.setTargetAtTime(rain ? 0.075 : snow ? 0.05 : 0, t, 0.6);
    st.au.hp.frequency.setTargetAtTime(snow ? 120 : 700, t, 0.3); st.au.lp.frequency.setTargetAtTime(snow ? 420 + 260 * Math.sin(t * 0.4) ** 2 : 6500, t, 0.3);
    if (rain) { st.pat = (st.pat || 0) + dt * 9; while (st.pat > 1) { st.pat -= Math.random() * 2; const s = ctx.createBufferSource(); s.buffer = AU.noise; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 3500; bp.Q.value = 6;
        const g = ctx.createGain(), at = t + Math.random() * 0.1; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.05, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
        s.connect(bp); bp.connect(g); g.connect(AU.master); s.start(at, Math.random() * 1.8, 0.07); } }
  }
  function thunder(far) {
    // 번개: 하늘이 번쩍 (밝기는 프레임마다 원래대로 돌아감) · 소리는 거리만큼 늦게
    hemi.intensity = envHemi() + (ENV.night ? 2.2 : 1.4) * (far ? 0.5 : 1); setTimeout(() => { hemi.intensity = envHemi() + 1.1 * (far ? 0.5 : 1); }, 140);
    if (!AU.ctx || !AU.noise || AU.on === false) return; const ctx = AU.ctx, t = ctx.currentTime + (far ? 3 + Math.random() * 4 : 1 + Math.random() * 1.5);
    for (const [f, peak, dec, q] of [[160, far ? 0.35 : 0.6, far ? 5 : 4, 0.7], [700, far ? 0.06 : 0.18, 1.6, 0.5]]) {
      const s = ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; lp.Q.value = q; const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.25); g.gain.setTargetAtTime(peak * 0.5, t + 0.5, 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      s.connect(lp); lp.connect(g); g.connect(AU.master); s.start(t); s.stop(t + dec + 0.1); }
  }
  // ---- 5) 눈송이: 네모 점 → 둥글고 부드러운 눈송이 ----
  const flakeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  function snowUp() { if (!WX.snow || WX.snow.userData.up) return; WX.snow.userData.up = true; const m = WX.snow.material; m.map = flakeTex; m.size = 0.16; m.sizeAttenuation = true; m.opacity = 0.95; m.needsUpdate = true; }
  // ---- 6) 골짜기 안개 · 능선에 걸린 구름: 카메라를 보는 큰 판 (한 번에 그림) ----
  const MIST = (() => {
    if (!MID || !TER.h) return null; const r = rng(9091), pts = [], N = LOWQ ? 16 : 30;
    for (let k = 0; k < 900 && pts.length < N; k++) { const a = r() * 6.283, d = Math.sqrt(r()) * (FLY_R + 250), x = FLY_C.x + Math.cos(a) * d, z = FLY_C.z + Math.sin(a) * d, h = terrainAt(x, z);
      let avg = 0; for (let j = 0; j < 8; j++) { const b = j / 8 * 6.283; avg += terrainAt(x + Math.cos(b) * 170, z + Math.sin(b) * 170); } avg /= 8;
      const valley = avg - h > 7, ridge = h - avg > 14; if (!valley && !ridge) continue; if (pts.some(p => Math.hypot(p[0] - x, p[2] - z) < 150)) continue;
      pts.push([x, h + (valley ? 9 + r() * 14 : 6 + r() * 10), z, (valley ? 120 : 90) + r() * 90, r()]); }
    if (!pts.length) return null;
    const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    g.setAttribute('mi', new THREE.InstancedBufferAttribute(new Float32Array(pts.flatMap(p => [p[0], p[1], p[2], p[3]])), 4)); g.setAttribute('ms', new THREE.InstancedBufferAttribute(new Float32Array(pts.map(p => p[4])), 1)); g.instanceCount = pts.length;
    const u = { uC: { value: new THREE.Color() }, uO: { value: 0 }, uT: { value: 0 } };
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'attribute vec4 mi; attribute float ms; uniform float uT; varying vec2 vUv; varying float vA; varying float vS;\nvoid main() { vUv = uv; vS = ms; vec3 c = mi.xyz + vec3(sin(uT * 0.02 + ms * 6.0) * 25.0, sin(uT * 0.05 + ms * 9.0) * 2.0, cos(uT * 0.017 + ms * 5.0) * 25.0); vec4 mv = modelViewMatrix * vec4(c, 1.0); float d = length(mv.xyz);\n vA = smoothstep(25.0, 110.0, d) * (1.0 - smoothstep(650.0, 1250.0, d)); mv.xy += position.xy * mi.w * vec2(1.0, 0.42); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uC; uniform float uO; uniform float uT; varying vec2 vUv; varying float vA; varying float vS;\nvoid main() { vec2 p = vUv * 2.0 - 1.0; float r = dot(p, p); float a = max(0.0, 1.0 - r); a *= a; a *= 0.7 + 0.3 * sin(p.x * 4.0 + vS * 20.0 + uT * 0.05) * sin(p.y * 3.0 - vS * 13.0); a *= uO * vA; if (a < 0.004) discard; gl_FragColor = vec4(uC, a);\n #include <tonemapping_fragment>\n #include <encodings_fragment>\n}' });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2; scene.add(mesh); return { mesh, u, n: pts.length };
  })();
  // ---- 매 프레임 ----
  function tick(dt) {
    const mode = kind(), rain = mode === 'rain', snow = mode === 'snow';
    // 젖음: 비가 오면 20 초쯤 걸쳐 젖고, 그치면 1 분쯤 걸쳐 마름
    if (rain && !st.patched) wetPatch();
    st.wet.value = clamp(st.wet.value + (rain ? dt / 20 : -dt / 60), 0, 1);
    if (st.patched) { const fc = scene.fog.color; st.sky.value.setRGB(Math.min(1, fc.r * 1.15), Math.min(1, fc.g * 1.15), Math.min(1, fc.b * 1.2)).multiplyScalar(ENV.night ? 0.3 : 1); }
    splashTick(dt, rain);
    if (snow) snowUp();
    lensTick(dt, mode);
    audioTick(dt, mode);
    if (rain && S.state === 'run' && (st.thT -= dt) < 0) { st.thT = 35 + Math.random() * 55; thunder(Math.random() < 0.7); }
    if (MIST) { const on = rain || snow; MIST.mesh.visible = on || MIST.u.uO.value > 0.01; MIST.u.uO.value = clamp(MIST.u.uO.value + (on ? dt : -dt) / 4, 0, rain ? 0.42 : 0.32);
      const fc = scene.fog.color; MIST.u.uC.value.setRGB(Math.min(1, fc.r * 1.12), Math.min(1, fc.g * 1.12), Math.min(1, fc.b * 1.12)); MIST.u.uT.value += dt; }
  }
  return { tick, thunder, wet: st.wet, SPL, LENS, MIST };
})();
window.__WX2 = WX2;
if (window.__sim) Object.assign(window.__sim, { WX2 });
