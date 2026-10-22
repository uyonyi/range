(function () {
'use strict';
// =====================================================================
//  FPV drone training course - web simulator (prototype)
//  좌표: 코스 (down=다운레인지, side=오른쪽+, alt=고도)  ->  three (x=side, y=alt, z=-down)
// =====================================================================
const D = window.SIM_DATA;
const BY = {}; D.objs.forEach(o => { BY[o.id] = o; });
const DEG = Math.PI / 180, G = 9.81;
const V3 = THREE.Vector3;
const num = (v, d) => (v === undefined || v === null || v === '' || isNaN(+v)) ? d : +v;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
// W(): 고도 alt 는 지면 기준(AGL). 지형이 있으면 그 지점 지면 높이를 더함
function W(down, side, alt) { const v = new V3(side, alt || 0, -down); v.y += terrainAt(v.x, v.z); return v; }
function agl(p) { return p.y - groundAt(p.x, p.z); }
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(320);
const LOWQ = !!window.SIM_MOBILE || !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);   // 모바일: 가벼운 화질

THREE.ColorManagement.legacyMode = false;

// ---------------- renderer / scene ----------------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOWQ ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LOWQ ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
const MAXANI = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc8d2da, 220, 1700);
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.04, 3000);
scene.add(camera);

const SUN_DIR = new V3(-0.49, 0.62, 0.62).normalize();
const skyU = { sunDir: { value: SUN_DIR }, time: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: [
    'uniform vec3 sunDir; uniform float time; varying vec3 vW;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }',
    'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }',
    'void main(){ vec3 d = normalize(vW); float h = max(d.y, 0.0);',
    '  vec3 top = vec3(0.33,0.53,0.80); vec3 hor = vec3(0.80,0.85,0.88);',
    '  vec3 c = mix(hor, top, pow(h, 0.45)); float s = max(dot(d, sunDir), 0.0);',
    '  c += vec3(1.0,0.86,0.62) * (pow(s, 900.0) * 1.2 + pow(s, 10.0) * 0.18 + pow(s, 3.0) * 0.06);',
    '  if (d.y > 0.0) { vec2 p = d.xz / (d.y + 0.08) * 1.6 + vec2(time * 0.004, time * 0.002);',
    '    float n = fbm(p) * 0.75 + fbm(p * 3.1 + 5.0) * 0.25; float cov = smoothstep(0.50, 0.78, n);',
    '    float shade = 0.80 + 0.25 * smoothstep(0.55, 0.95, n) + 0.25 * pow(s, 6.0);',
    '    vec3 cc = mix(vec3(0.70,0.73,0.78), vec3(1.0,0.99,0.97), shade - 0.8);',
    '    float fade = smoothstep(0.02, 0.22, d.y); c = mix(c, cc * shade, cov * 0.85 * fade); }',
    '  else c = hor * 0.93;',
    '  gl_FragColor = vec4(c, 1.0); }'].join('\n')
}));
sky.renderOrder = -10;
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xdfe9f5, 0x5e5240, 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 1.35);
sun.castShadow = true;
sun.shadow.mapSize.set(LOWQ ? 1024 : 2048, LOWQ ? 1024 : 2048);
const SC = sun.shadow.camera; SC.left = -42; SC.right = 42; SC.top = 42; SC.bottom = -42; SC.near = 1; SC.far = 260;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

// ---------------- textures ----------------
function canvasTex(w, h, draw, opt) {
  opt = opt || {};
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opt.repeat) t.repeat.set(opt.repeat[0], opt.repeat[1]);
  if (opt.srgb !== false) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = Math.min(8, MAXANI);
  return t;
}
function stripeTex(c1, c2, n, slant, rep) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = c1; g.fillRect(0, 0, w, h); g.fillStyle = c2;
    const p = w / n;
    for (let i = -n * 2; i < n * 3; i++) {
      g.beginPath(); const x = i * p;
      g.moveTo(x, 0); g.lineTo(x + p / 2, 0); g.lineTo(x + p / 2 + slant * h, h); g.lineTo(x + slant * h, h); g.fill();
    }
  }, { repeat: rep || [1, 1] });
}
function noiseFill(g, w, h, base, cols, n, rmin, rmax, alpha, rr) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const x = rr() * w, y = rr() * h, r = rmin + rr() * (rmax - rmin);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = cols[Math.floor(rr() * cols.length)];
    gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha; g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.globalAlpha = 1;
}
const TX = {};
TX.pallet = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#a98656'; g.fillRect(0, 0, w, h);
  const r2 = rng(7);
  for (let i = 0; i < 7; i++) {
    const y = i * h / 7;
    g.fillStyle = `hsl(${30 + r2() * 8},${30 + r2() * 12}%,${44 + r2() * 12}%)`; g.fillRect(0, y + 2, w, h / 7 - 5);
    g.fillStyle = 'rgba(40,25,10,.85)'; g.fillRect(0, y + h / 7 - 3, w, 3);
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(60,40,20,${r2() * 0.15})`; g.fillRect(r2() * w, r2() * h, 10 + r2() * 30, 1); }
});
TX.camo = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#6c6a42', ['#3e4a2a', '#8a7a52', '#2f3524', '#a08c62'], 90, 14, 46, 0.9, rng(11)), { repeat: [1, 1] });
TX.droneCamo = canvasTex(128, 128, (g, w, h) => noiseFill(g, w, h, '#b9a982', ['#8c7a58', '#d8cba6', '#6f6448'], 50, 6, 18, 0.9, rng(5)));
TX.pole = stripeTex('#e0aa12', '#111111', 3, 0.9, [1, 6]);
TX.panel = stripeTex('#e8e6e2', '#7a0a1e', 3, -0.9, [1, 3]);
function silTex() {
  return canvasTex(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#34402f';
    g.beginPath(); g.arc(w / 2, 40, 28, 0, Math.PI * 2); g.fill();
    g.fillRect(w / 2 - 14, 60, 28, 20);
    g.beginPath(); g.moveTo(8, 256); g.lineTo(10, 118); g.quadraticCurveTo(14, 82, 46, 76); g.lineTo(82, 76);
    g.quadraticCurveTo(114, 82, 118, 118); g.lineTo(120, 256); g.fill();
  });
}
TX.sil = silTex();
TX.logo = D.logo ? new THREE.TextureLoader().load(D.logo) : new THREE.Texture(); TX.logo.encoding = THREE.sRGBEncoding; TX.logo.anisotropy = Math.min(8, MAXANI);
function textTex(txt, opt) {
  opt = opt || {};
  return canvasTex(opt.w || 256, opt.h || 192, (g, w, h) => {
    g.fillStyle = opt.bg || '#f2f2ee'; g.fillRect(0, 0, w, h);
    g.fillStyle = opt.fg || '#111'; g.font = `bold ${opt.size || 120}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, w / 2, h / 2 + 6);
  });
}
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,200,.85)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const smokeTex = canvasTex(128, 128, (g, w, h) => {
  const r2 = rng(3);
  for (let i = 0; i < 14; i++) {
    const x = 40 + r2() * 48, y = 40 + r2() * 48, r = 20 + r2() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(225,225,220,.55)'); gr.addColorStop(1, 'rgba(225,225,220,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
});

// ---------------- materials ----------------
function mat(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, o || {})); }
const M = {
  yel: mat(0xe2ac14, { roughness: 0.55 }), blk: mat(0x141414, { roughness: 0.6 }), leg: mat(0x6e2c1f, { roughness: 0.7 }),
  steel: mat(0x8d9399, { roughness: 0.45, metalness: 0.6 }), wood: mat(0x9b7a4c), dkwood: mat(0x5a4128),
  pallet: mat(0xffffff, { map: TX.pallet }), ply: mat(0xc9a676), white: mat(0xf0f0ec, { roughness: 0.6 }),
  red: mat(0xb0201c, { roughness: 0.6 }), redPl: mat(0xc0281e, { roughness: 0.5 }), concrete: mat(0xaaa69c, { roughness: 0.95 }),
  roof: mat(0x5d6166, { roughness: 0.7, metalness: 0.2 }), beige: mat(0xd6cbb2), glass: mat(0x1d2a33, { roughness: 0.15, metalness: 0.4 }),
  dark: mat(0x1c1610, { roughness: 1 }), inner: mat(0x6a6a6a, { map: TX.pallet, roughness: 1 }), pipe: mat(0x3b3f44, { roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide }),
  cone: mat(0xff6a10, { roughness: 0.6 }), sand: mat(0xb39b6c, { roughness: 1 }), olive: mat(0x4f5530),
  camo: mat(0xffffff, { map: TX.camo }), wheel: mat(0x1e2414), barrel: mat(0x272d1c, { roughness: 0.6 }),
  pole: mat(0xffffff, { map: TX.pole, roughness: 0.6 }), panel: mat(0xffffff, { map: TX.panel, roughness: 0.6 }),
  sil: mat(0xffffff, { map: TX.sil, alphaTest: 0.5, side: THREE.DoubleSide }), berm: mat(0x6f7b45, { roughness: 1 }),
  brick: mat(0x8f5a44, { roughness: 0.95 }), grey: mat(0x8c8f90), green: mat(0x2f5a33), tape: mat(0xf2d21a, { roughness: 0.7 })
};
const silDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: TX.sil, alphaTest: 0.5 });

// ---------------- ground ----------------
const GD0 = -400, GD1 = 800, GS0 = -600, GS1 = 600, GSZ = 1200, GPX = 2048, GK = GPX / GSZ;
const SITE_L = SITE_PRE, SITE = SITE_L.site, SITE_KEY0 = SITE.flat ? '' : '@' + SITE.id, SITE_KEY = SITE_KEY0 + (!SITE.flat && SITE.course && SITE.course.v > 1 ? 'v' + SITE.course.v : '');   // 코스 배치가 바뀌면 기록 따로          // 현재 지형(현장)
const VEC = SITE.vec || null;
const CRS_C = SITE.course || null;   // 경로 따라 배치한 전용 코스   // 수치지형도 벡터 (도로·하천·경지·건물)
function gpx(down, side) { return [(side - GS0) * GK, (GD1 - down) * GK]; }
const groundMacro = canvasTex(GPX, GPX, (g, w, h) => {
  const rr = rng(42);
  noiseFill(g, w, h, '#857f52', ['#7a8546', '#9a8c5c', '#6c773e', '#a6966c', '#8a8450', '#76703f'], 2600, 4, 70, 0.32, rr);
  const rect = (d0, d1, s0, s1, col, a, jit, passes) => {
    for (let p = 0; p < passes; p++) {
      const j = () => (rr() - 0.5) * jit;
      const [x0, y0] = gpx(d1 + j(), s0 + j()); const [x1, y1] = gpx(d0 + j(), s1 + j());
      g.globalAlpha = a; g.fillStyle = col; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    g.globalAlpha = 1;
  };
  // 넓은 농경지·잔디 구획 (멀리)
  for (let i = 0; i < (VEC ? 0 : 60); i++) {
    const d = GD0 + rr() * GSZ, s = GS0 + rr() * GSZ;
    if (d > -80 && d < 420 && s > -120 && s < 90) continue;
    rect(d, d + 40 + rr() * 120, s, s + 40 + rr() * 140, ['#6f7d40', '#8d8a58', '#5f6e38', '#9c9468'][Math.floor(rr() * 4)], 0.35, 4, 2);
  }
  if (CRS_C) {   // 경로를 따라 흙길 + 출발 구역 자갈
    const P = CRS_C.path; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, c, a] of [[34, '#a48c66', 0.2], [14, '#a48c66', 0.25], [3.5, '#9c8a68', 0.35]]) {
      g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w * GK; g.beginPath(); P.forEach((q, i) => { const p = gpx(q[0], q[1]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke();
    }
    g.globalAlpha = 1;
  }
  if (!CRS_C) rect(-6, 335, -18, 18, '#a48c66', 0.22, 5, 6);          // 드론 레인 흙
  if (!CRS_C) {
  rect(0, 365, -66, -31, '#76854a', 0.25, 4, 4);          // 옆 레인 잔디
  rect(-16, 7, -24, 24, '#a29a86', 0.35, 2, 3);           // 출발 구역 자갈
  rect(-66, -48, -48, 22, '#b2ada2', 0.45, 1, 2);          // 건물 콘크리트
  }
  if (!VEC) rect(-46, -39, -260, 260, '#9e978a', 0.75, 0.5, 2);      // 도로 (기본 코스)
  if (!CRS_C) rect(-14, -3, -60, -40, '#a49c8a', 0.4, 1, 2);           // 사대(FP) 앞
  // 바퀴 자국
  g.strokeStyle = 'rgba(120,98,70,.35)'; g.lineWidth = 2;
  if (!CRS_C) for (const s of [-1.2, 1.2, 7.8, 10.2]) { g.beginPath(); const a = gpx(-4, s), b = gpx(330, s + (rr() - 0.5) * 3); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  if (VEC) paintVectors(g);
});
// 수치지형도 벡터를 바닥 텍스처에 그림 (코스 통로 안쪽은 정지된 터라 생략)
function paintVectors(g) {
  const path = (a, close) => { g.beginPath(); for (let i = 0; i < a.length; i += 2) { const p = gpx(a[i], a[i + 1]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } if (close) g.closePath(); };
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  // 경지 (밭·논): 옅은 녹갈색 채움 + 경계
  for (const a of VEC.field || []) { path(a, true); g.globalAlpha = 0.28; g.fillStyle = '#7f8a45'; g.fill(); g.globalAlpha = 0.5; g.strokeStyle = '#5f5a35'; g.lineWidth = 1.2; g.stroke(); }
  // 하천 (중심선)
  g.globalAlpha = 0.7; g.strokeStyle = '#4c5a52'; g.lineWidth = 2.2 * GK; for (const a of VEC.stream || []) { path(a); g.stroke(); }
  g.globalAlpha = 0.5; g.strokeStyle = '#6f8288'; g.lineWidth = 0.9 * GK; for (const a of VEC.stream || []) { path(a); g.stroke(); }
  // 소로·임도 (중심선)
  g.globalAlpha = 0.75; g.strokeStyle = '#a89878'; g.lineWidth = 3.0 * GK; for (const a of VEC.trail || []) { path(a); g.stroke(); }
  // 도로 경계선
  g.globalAlpha = 0.85; g.strokeStyle = '#8c877c'; g.lineWidth = 0.8 * GK; for (const a of VEC.road || []) { path(a); g.stroke(); }
  g.restore();
}
groundMacro.wrapS = groundMacro.wrapT = THREE.ClampToEdgeWrapping;
const groundDetail = canvasTex(256, 256, (g, w, h) => {
  const id = g.createImageData(w, h); const rr = rng(9);
  for (let i = 0; i < w * h; i++) { const v = 150 + rr() * 105; id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rr() < .5 ? 70 : 255},${rr() < .5 ? 70 : 255},60,${0.08 + rr() * 0.1})`; g.beginPath(); g.arc(rr() * w, rr() * h, 2 + rr() * 9, 0, 7); g.fill(); }
}, { srgb: false });
const groundMat = new THREE.MeshStandardMaterial({ map: groundMacro, roughness: 0.97 });
const detailK = { value: 1.0 };
groundMat.onBeforeCompile = sh => {
  sh.uniforms.detail = { value: groundDetail }; sh.uniforms.detailK = detailK;
  sh.fragmentShader = 'uniform sampler2D detail; uniform float detailK;\n' + sh.fragmentShader.replace('#include <map_fragment>',
    '#include <map_fragment>\n vec3 dA = texture2D(detail, vUv * 240.0).rgb; vec3 dB = texture2D(detail, vUv * 37.0).rgb;\n' +
    ' diffuseColor.rgb *= mix(vec3(1.0), (dA * 0.55 + 0.45) * (dB * 0.45 + 0.55) * 1.12, detailK);');
};
const TER = { n: 241, step: GSZ / 240, h: SITE_L.dec ? SITE_L.dec.inner : null };   // 코스 주변 고해상도 지형 (5 m)
if (TER.h) { scene.fog.near = 180; scene.fog.far = 6500; camera.far = 9000; camera.updateProjectionMatrix(); }
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GSZ, GSZ, 240, 240), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.set((GS0 + GS1) / 2, 0, -(GD0 + GD1) / 2);
ground.receiveShadow = true; scene.add(ground);
let MIDH = null;   // 고해상도 구역 밖 높이 (중간 지형이 만들어지면 채워짐)
function terrainAt(x, z) {
  if (!TER.h) return MIDH && (x < GS0 || x > GS1 || -z < GD0 || -z > GD1) ? MIDH(x, z) : 0;
  const fx = (x - GS0) / TER.step, fy = (GD1 + z) / TER.step;
  if (fx < 0 || fy < 0 || fx >= TER.n - 1 || fy >= TER.n - 1) return MIDH ? MIDH(x, z) : 0;
  const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, n = TER.n, H = TER.h;
  return (H[iy * n + ix] * (1 - ax) + H[iy * n + ix + 1] * ax) * (1 - ay) + (H[(iy + 1) * n + ix] * (1 - ax) + H[(iy + 1) * n + ix + 1] * ax) * ay;
}
function applyTerrain(h) {
  TER.h = h; const pos = ground.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, h ? h[i] : 0);
  pos.needsUpdate = true; ground.geometry.computeVertexNormals(); ground.geometry.computeBoundingSphere();
  // 산지 숲 색: 경사가 있는 곳은 짙은 녹색으로 (코스 통로·경지는 그대로)
  if (h) {
    const nr = ground.geometry.attributes.normal, n = TER.n, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const ix = i % n, iy = (i / n) | 0, side = GS0 + ix * TER.step, down = GD1 - iy * TER.step;
      const slope = 1 - nr.getY(i), pi = CRS_C && pathInfo(down, side), corr = pi ? pi.dist < 25 : (down > -80 && down < 385 && side > -80 && side < 30);
      let f = smooth01(0.015, 0.06, slope) * (corr ? 0.15 : 1);
      if (SITE.trees && !corr) f = Math.max(f, 0.45);
      f *= 0.75 + 0.25 * Math.sin(side * 0.05 + Math.cos(down * 0.043) * 2);
      col[i * 3] = 1 - f * 0.62; col[i * 3 + 1] = 1 - f * 0.42; col[i * 3 + 2] = 1 - f * 0.6;
    }
    ground.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); groundMat.vertexColors = true; groundMat.needsUpdate = true;
  }
}
if (TER.h) applyTerrain(TER.h);
// 원경 지형 (주변 12 km, 현장별 격자 · 기본 60 m) — 고해상도 구역은 구멍으로 비움
const FAR = (function farTerrain() {
  if (!SITE_L.dec) return null;
  const G = Object.assign({}, TGRID, SITE.farGrid || {}), n = G.farN, H = SITE_L.dec.far, pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) { const i = iy * n + ix; pos[i * 3] = G.fs0 + ix * G.farStep; pos[i * 3 + 1] = H[i]; pos[i * 3 + 2] = -(G.fd1 - iy * G.farStep); }
  const i0x = (GS0 - G.fs0) / G.farStep, i1x = (GS1 - G.fs0) / G.farStep, i0y = (G.fd1 - GD1) / G.farStep, i1y = (G.fd1 - GD0) / G.farStep;
  const idx = [];
  for (let iy = 0; iy < n - 1; iy++) for (let ix = 0; ix < n - 1; ix++) {
    if (ix >= i0x && ix < i1x && iy >= i0y && iy < i1y) continue;
    const a = iy * n + ix, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const nr = geo.attributes.normal; let mn = 1e9, mx = -1e9; for (const v of H) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (let i = 0; i < n * n; i++) {
    const slope = 1 - nr.getY(i), t = (H[i] - mn) / Math.max(1, mx - mn);
    // 낮은 곳 = 논밭 녹색, 높은 곳·급경사 = 짙은 숲/바위
    const nz = Math.sin(pos[i * 3] * 0.013) * Math.cos(pos[i * 3 + 2] * 0.011) * 0.5 + 0.5;   // 숲·밭 얼룩
    let r = 0.36 - t * 0.14 - nz * 0.05, g = 0.40 - t * 0.12 - nz * 0.03, b = 0.22 - t * 0.08;
    const f = Math.min(1, slope * (SITE.trees ? 9 : 4.0) + (SITE.trees ? t * 0.8 : 0)); r = r * (1 - f) + 0.13 * f; g = g * (1 - f) + 0.20 * f; b = b * (1 - f) + 0.10 * f;
    col[i * 3] = Math.pow(r, 2.2); col[i * 3 + 1] = Math.pow(g, 2.2); col[i * 3 + 2] = Math.pow(b, 2.2);   // sRGB -> 선형
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = false; scene.add(m); return m;
})();
// ---- 중간 지형: 비행 구역(반경 약 1 km)을 덮는 10 m 격자 · 원경 격자를 부드럽게 보간 + 잔기복 · 고해상도 구역 경계는 이어 붙임 ----
const MID = (function midTerrain() {
  const SYN = !(SITE_L.dec && SITE_L.dec.far && TER.h);   // 높이 자료 없는 평지 사이트: 완만한 기복 + 낮은 숲 언덕을 임의로
  if (SYN && TER.h) return null;
  const G = Object.assign({}, TGRID, SITE.farGrid || {}), FN = G.farN, fs = G.farStep;
  let FH = SYN ? null : SITE_L.dec.far;
  if (SYN) { const rr = rng(4412), hills = []; for (let k = 0; k < 9; k++) { const a = rr() * 6.283, d = 780 + rr() * 330; hills.push([Math.sin(a) * d, -150 - Math.cos(a) * d, 18 + rr() * 30, 160 + rr() * 160]); }
    FH = new Float32Array(FN * FN); for (let iy = 0; iy < FN; iy++) for (let ix = 0; ix < FN; ix++) { const x = G.fs0 + ix * fs, z = -(G.fd1 - iy * fs); let h = Math.sin(x * 0.004) * Math.cos(z * 0.0035) * 1.6;
      for (const [hx, hz, A, R] of hills) h += A * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (R * R)); const din = Math.max(GS0 - x, x - GS1, GD0 + z, -z - GD1, 0); const fo = clamp((1180 - Math.max(Math.abs(x), Math.abs(z + 150))) / 160, 0, 1); FH[iy * FN + ix] = h * Math.min(1, din / 250) * fo; } }   /* 중간 지형 상자 끝에서는 0 (바깥 평지와 이어짐) */
  const sn = (v, o) => Math.round((v - o) / fs) * fs + o;
  const s0 = sn(-1260, G.fs0), s1 = sn(1260, G.fs0), d1 = G.fd1 - Math.round((G.fd1 - 1420) / fs) * fs, d0 = G.fd1 - Math.round((G.fd1 + 1120) / fs) * fs;
  const fA = (ix, iy) => FH[clamp(iy, 0, FN - 1) * FN + clamp(ix, 0, FN - 1)];
  const cub = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const farBic = (x, z) => { const fx = (x - G.fs0) / fs, fy = (G.fd1 + z) / fs, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, r = [];
    for (let k = -1; k <= 2; k++) r.push(cub(fA(ix - 1, iy + k), fA(ix, iy + k), fA(ix + 1, iy + k), fA(ix + 2, iy + k), tx)); return cub(r[0], r[1], r[2], r[3], ty); };
  const farLin = (x, z) => { const fx = (x - G.fs0) / fs, fy = (G.fd1 + z) / fs, ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
    return (fA(ix, iy) * (1 - ax) + fA(ix + 1, iy) * ax) * (1 - ay) + (fA(ix, iy + 1) * (1 - ax) + fA(ix + 1, iy + 1) * ax) * ay; };
  const nz = (x, z) => Math.sin(x * 0.021 + Math.cos(z * 0.017) * 2) * Math.cos(z * 0.019 - Math.sin(x * 0.013)) * 1.1 + Math.sin(x * 0.067 + z * 0.051) * 0.35;   /* 잔기복 */
  const st = 10, nx = Math.round((s1 - s0) / st) + 1, ny = Math.round((d1 - d0) / st) + 1, H = new Float32Array(nx * ny);
  const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const s = s0 + ix * st, d = d1 - iy * st, x = s, z = -d;
    const ein = Math.max(GS0 - s, s - GS1, GD0 - d, d - GD1, 0), eout = Math.min(s - s0, s1 - s, d - d0, d1 - d);
    let h = farBic(x, z) + nz(x, z) * sm(ein / 120) * sm(eout / 120);
    if (ein < 90) { const cx = clamp(s, GS0 + 1, GS1 - 1), cd = clamp(d, GD0 + 1, GD1 - 1), hi = TER.h ? terrainAt(cx, -cd) : 0; h = hi + (h - hi) * sm(ein / 90); }   /* 고해상도 구역 가장자리에 맞춤 */
    if (eout < 60) h = farLin(x, z) + (h - farLin(x, z)) * sm(eout / 60);   /* 원경 지형에 맞춤 */
    H[iy * nx + ix] = h;
  }
  const at = (x, z) => { const fx = (x - s0) / st, fy = (d1 + z) / st; if (fx < 0 || fy < 0 || fx >= nx - 1 || fy >= ny - 1) return farLin(x, z);
    const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy; return (H[iy * nx + ix] * (1 - ax) + H[iy * nx + ix + 1] * ax) * (1 - ay) + (H[(iy + 1) * nx + ix] * (1 - ax) + H[(iy + 1) * nx + ix + 1] * ax) * ay; };
  // 그물: 고해상도 구역은 구멍 · 지면 무늬는 캔버스(2048²)에 토지 이용을 그려 씌움 (game6)
  const pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), idx = [];
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) { const i = iy * nx + ix; pos[i * 3] = s0 + ix * st; pos[i * 3 + 1] = H[i]; pos[i * 3 + 2] = -(d1 - iy * st); uv[i * 2] = ix / (nx - 1); uv[i * 2 + 1] = 1 - iy / (ny - 1); }
  for (let iy = 0; iy < ny - 1; iy++) for (let ix = 0; ix < nx - 1; ix++) { const s = s0 + (ix + 0.5) * st, d = d1 - (iy + 0.5) * st; if (s > GS0 && s < GS1 && d > GD0 && d < GD1) continue;
    const a = iy * nx + ix, b = a + 1, c = a + nx, e = c + 1; idx.push(a, c, b, b, c, e); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const cv = document.createElement('canvas'); cv.width = cv.height = 2048; const cg = cv.getContext('2d'); cg.fillStyle = '#5f6b3e'; cg.fillRect(0, 0, 2048, 2048);
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); mesh.receiveShadow = true; scene.add(mesh);
  // 원경 그물: 중간 지형 상자 안은 비움
  if (FAR) { const fi = FAR.geometry.index.array, keep = []; const n = FN;
    for (let k = 0; k < fi.length; k += 6) { const a = fi[k], ix = a % n, iy = (a / n) | 0, s = G.fs0 + (ix + 0.5) * fs, d = G.fd1 - (iy + 0.5) * fs; if (s > s0 && s < s1 && d > d0 && d < d1) continue; for (let j = 0; j < 6; j++) keep.push(fi[k + j]); }
    FAR.geometry.setIndex(keep); }
  MIDH = at;
  return { s0, s1, d0, d1, st, nx, ny, H, at, cv, cg, tex, mesh, uvOf: (x, z) => [(x - s0) / (s1 - s0) * 2048, (d1 + z) / (d1 - d0) * 2048] };
})();
const farGround = new THREE.Mesh(new THREE.RingGeometry(800, 4000, 48), mat(0x7d7a55, { roughness: 1 }));
farGround.rotation.x = -Math.PI / 2; farGround.position.set(0, -0.05, -200); scene.add(farGround);
if (FAR) farGround.visible = false;

// 풀 덤불 (속도감)
const GRASS = (function grass() {
  // 가는 풀잎 3장 묶음
  const p = [];
  for (let k = 0; k < 3; k++) { const a = k * 2.1, c = Math.cos(a), sn = Math.sin(a), w = 0.035, lean = 0.06;
    p.push(-w * c, 0, -w * sn, w * c, 0, w * sn, lean * sn, 0.28, -lean * c); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.computeVertexNormals();
  const N = LOWQ ? 9000 : 30000; const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); const rr = rng(77);
  let i = 0;
  while (i < N) {
    let d = -14 + rr() * 350, s = -78 + rr() * 125;
    if (CRS_C) { const P = CRS_C.path, q = P[Math.floor(rr() * P.length)]; const sp = SITE.trees ? 26 : 120; d = q[0] + (rr() - 0.5) * sp; s = q[1] + (rr() - 0.5) * sp; const pd = W(10, -5, 0); if (Math.hypot(s - pd.x, -d - pd.z) < 9) continue; }
    else if (d > -16 && d < 14 && s > -9 && s < 9) continue;          // 출발 구역(패드·로고) 제외
    const sc = 0.6 + rr() * 0.9;
    q.setFromAxisAngle(new V3(0, 1, 0), rr() * 6.28);
    m4.compose(W(d, s, 0), q, new V3(sc, sc * (0.6 + rr() * 0.9), sc)); im.setMatrixAt(i, m4);
    if (SITE.trees) c.setHSL(0.17 + rr() * 0.1, 0.3 + rr() * 0.2, 0.13 + rr() * 0.1); else c.setHSL(0.13 + rr() * 0.08, 0.28 + rr() * 0.2, 0.17 + rr() * 0.12); im.setColorAt(i, c); i++;
  }
  im.receiveShadow = true; im.userData.irBase = 0.25; scene.add(im); return im;
})();
// 지형을 고친 뒤 풀 높이 다시 맞춤
function grassRefit() { const a = GRASS.instanceMatrix.array; for (let i = 0; i < GRASS.count; i++) a[i * 16 + 13] = terrainAt(a[i * 16 + 12], a[i * 16 + 14]); GRASS.instanceMatrix.needsUpdate = true; }

// 먼 나무 띠·언덕
// 나무 (줄기 + 뭉친 수관) · 먼 언덕
const SHOW_TREES = false;   // 실제 현장에 나무가 없어 끔 (true 로 바꾸면 다시 표시)
const TREES = [];
(function makeTrees() {
  const rr = rng(21);
  const inCorr = (d, s) => d > -75 && d < 385 && s > -105 && s < 60;
  const add = (d, s, k) => { if (!SHOW_TREES) return; if (inCorr(d, s) || (d > -50 && d < -36)) return; TREES.push({ d, s, h: (k || 1) * (7 + rr() * 8), r: 2.2 + rr() * 2.2, c: rr(), seed: rr() }); };
  // 밭 경계를 따라 늘어선 나무 줄
  for (let i = 0; i < 26; i++) {
    const vertical = rr() < 0.5, base = (rr() - 0.5) * 1000, a0 = -350 + rr() * 900, len = 80 + rr() * 260;
    for (let t = 0; t < len; t += 5 + rr() * 6) { const j = (rr() - 0.5) * 3; vertical ? add(a0 + t, base + j) : add(base + 200 + j, a0 - 300 + t); }
  }
  // 군데군데 숲
  for (let i = 0; i < 22; i++) { const cd = -350 + rr() * 1100, cs = -560 + rr() * 1120, R = 15 + rr() * 45; for (let k = 0; k < 18; k++) { const a = rr() * 6.28, r = Math.sqrt(rr()) * R; add(cd + Math.cos(a) * r, cs + Math.sin(a) * r, 1.15); } }
  // 먼 숲 띠
  for (let i = 0; i < 420; i++) { const a = rr() * Math.PI * 2, r = 600 + rr() * 220; add(200 - Math.sin(a) * r, Math.cos(a) * r, 1.2); }
})();
const crownGeo = (function () { const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position, rr = rng(5);
  for (let i = 0; i < p.count; i++) { const v = new V3().fromBufferAttribute(p, i); const k = 0.82 + rr() * 0.3; p.setXYZ(i, v.x * k, v.y * k * 0.9, v.z * k); }
  g.computeVertexNormals(); return g; })();
const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1, 6); trunkGeo.translate(0, 0.5, 0);
const crownIM = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), Math.max(1, TREES.length * 3));
crownIM.count = TREES.length * 3;
const trunkIM = new THREE.InstancedMesh(trunkGeo, mat(0x4a3826, { roughness: 1 }), Math.max(1, TREES.length));
trunkIM.count = TREES.length;
crownIM.castShadow = true; crownIM.receiveShadow = true; trunkIM.castShadow = true;
scene.add(crownIM); scene.add(trunkIM);
function placeTrees() {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  TREES.forEach((t, i) => {
    const p = W(t.d, t.s, 0); p.y = terrainAt(p.x, p.z) - 0.2;
    const th = t.h * 0.42; m4.compose(p, q, new V3(1 + t.r * 0.08, th, 1 + t.r * 0.08)); trunkIM.setMatrixAt(i, m4);
    const rr = rng(Math.floor(t.seed * 1e6));
    for (let k = 0; k < 3; k++) {
      const off = new V3((rr() - 0.5) * t.r * 0.9, th + t.r * (0.55 + k * 0.38), (rr() - 0.5) * t.r * 0.9);
      const sc = t.r * (1 - k * 0.2) * (0.85 + rr() * 0.3);
      q.setFromAxisAngle(new V3(0, 1, 0), rr() * 6.28);
      m4.compose(p.clone().add(off), q, new V3(sc, sc * (1.0 + rr() * 0.3), sc)); crownIM.setMatrixAt(i * 3 + k, m4);
      c.setHSL(0.2 + t.c * 0.09, 0.26 + rr() * 0.14, 0.11 + t.c * 0.06 + k * 0.012); crownIM.setColorAt(i * 3 + k, c);
    }
    q.identity();
  });
  crownIM.instanceMatrix.needsUpdate = true; trunkIM.instanceMatrix.needsUpdate = true; if (crownIM.instanceColor) crownIM.instanceColor.needsUpdate = true;
}
placeTrees();
// (먼 언덕은 실제 현장과 달라 제거함)

// ---------------- colliders ----------------
const COLL = [];
const _p = new V3(), _q = new THREE.Quaternion(), _s = new V3();
function boxCol(mesh, tag) {
  mesh.updateMatrixWorld(true);
  mesh.matrixWorld.decompose(_p, _q, _s);
  const c = { t: 'box', c: _p.clone(), q: _q.clone(), inv: new THREE.Matrix4().compose(_p, _q, new V3(1, 1, 1)).invert(), h: _s.clone().multiplyScalar(0.5), tag };
  c.bnd = c.h.length(); COLL.push(c); return c;
}
function updBoxCol(c, mesh) {
  mesh.updateMatrixWorld(true); mesh.matrixWorld.decompose(_p, _q, _s);
  c.c.copy(_p); c.q.copy(_q); c.inv.compose(_p, _q, new V3(1, 1, 1)).invert();
}
function capCol(a, b, r, tag) { const c = { t: 'cap', a, b, r, c: a.clone().add(b).multiplyScalar(0.5), bnd: a.distanceTo(b) / 2 + r, tag }; COLL.push(c); return c; }
function torusCol(center, n, Rr, r, tag) { COLL.push({ t: 'tor', c: center, n, R: Rr, r, bnd: Rr + r, tag }); }
function tubeCol(a, b, rin, rout, tag) { const c = { t: 'tube', a, b, u: b.clone().sub(a).normalize(), L: a.distanceTo(b), rin, rout, c: a.clone().add(b).multiplyScalar(0.5), tag }; c.bnd = c.L / 2 + rout; COLL.push(c); }
const _v = new V3(), _w = new V3(), _cp = new V3();
function closestOnSeg(p, a, b, out) {
  _w.subVectors(b, a); const L2 = _w.lengthSq(); let t = L2 > 0 ? _v.subVectors(p, a).dot(_w) / L2 : 0; t = clamp(t, 0, 1);
  return out.copy(a).addScaledVector(_w, t);
}
function collide(p, Rr, filter) {
  let best = null;
  for (const c of COLL) {
    if (c.off) continue;
    if (filter && !filter(c)) continue;
    const dx = p.x - c.c.x, dy = p.y - c.c.y, dz = p.z - c.c.z;
    const lim = c.bnd + Rr; if (dx * dx + dy * dy + dz * dz > lim * lim) continue;
    let pen = 0; const n = new V3();
    if (c.t === 'box') {
      const lp = _v.copy(p).applyMatrix4(c.inv);
      const cx = clamp(lp.x, -c.h.x, c.h.x), cy = clamp(lp.y, -c.h.y, c.h.y), cz = clamp(lp.z, -c.h.z, c.h.z);
      n.set(lp.x - cx, lp.y - cy, lp.z - cz); const d = n.length();
      if (d >= Rr) continue;
      if (d > 1e-6) { n.divideScalar(d); pen = Rr - d; }
      else {
        const ex = c.h.x - Math.abs(lp.x), ey = c.h.y - Math.abs(lp.y), ez = c.h.z - Math.abs(lp.z);
        if (ex <= ey && ex <= ez) { n.set(Math.sign(lp.x) || 1, 0, 0); pen = Rr + ex; }
        else if (ey <= ez) { n.set(0, Math.sign(lp.y) || 1, 0); pen = Rr + ey; }
        else { n.set(0, 0, Math.sign(lp.z) || 1); pen = Rr + ez; }
      }
      n.applyQuaternion(c.q);
    } else if (c.t === 'cap') {
      closestOnSeg(p, c.a, c.b, _cp); n.subVectors(p, _cp); const d = n.length(); const lim2 = c.r + Rr;
      if (d >= lim2) continue; pen = lim2 - d; if (d > 1e-6) n.divideScalar(d); else n.set(0, 1, 0);
    } else if (c.t === 'tor') {
      _v.subVectors(p, c.c); const h = _v.dot(c.n); _w.copy(_v).addScaledVector(c.n, -h); let rl = _w.length();
      if (rl < 1e-6) { _w.set(1, 0, 0); rl = 1; }
      _cp.copy(c.c).addScaledVector(_w, c.R / rl); n.subVectors(p, _cp); const d = n.length(); const lim2 = c.r + Rr;
      if (d >= lim2) continue; pen = lim2 - d; n.divideScalar(Math.max(d, 1e-6));
    } else if (c.t === 'tube') {
      _v.subVectors(p, c.a); const t = _v.dot(c.u); _w.copy(_v).addScaledVector(c.u, -t); let rl = _w.length();
      const rdir = rl > 1e-6 ? _w.clone().divideScalar(rl) : new V3(0, 1, 0);
      const tc = clamp(t, 0, c.L), rc = clamp(rl, c.rin, c.rout);
      _cp.copy(c.a).addScaledVector(c.u, tc).addScaledVector(rdir, rc);
      n.subVectors(p, _cp); const d = n.length(); if (d >= Rr) continue;
      pen = Rr - d; if (d > 1e-6) n.divideScalar(d); else n.copy(rdir).multiplyScalar(rl < (c.rin + c.rout) / 2 ? -1 : 1);
    }
    if (!best || pen > best.pen) best = { pen, n, c };
  }
  return best;
}

// ---------------- object builder ----------------
const UBOX = new THREE.BoxGeometry(1, 1, 1);
const UCYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const UCYL6 = new THREE.CylinderGeometry(1, 1, 1, 7);
const UCYL40 = new THREE.CylinderGeometry(1, 1, 1, 40);
const USPH = new THREE.SphereGeometry(1, 20, 12), UCAP = new THREE.CapsuleGeometry(1, 1, 6, 16);
const OBJ = {};
class Obj {
  constructor(o, tag) {
    this.o = o; this.tag = tag || o.type; this.g = new THREE.Group(); scene.add(this.g);
    this.g.position.copy(W(o.down, o.side, 0)); this.g.rotation.y = num(o.yaw, 0) * DEG;
    this.g.updateMatrixWorld(true); this.inv = this.g.matrixWorld.clone().invert();
    if (o.id) OBJ[o.id] = this;
  }
  L(lx, ly, lz) { return new V3(lx, lz, -ly); }
  world(lx, ly, lz) { return this.L(lx, ly, lz).applyMatrix4(this.g.matrixWorld); }
  local(p) { const v = _v.copy(p).applyMatrix4(this.inv); return { lx: v.x, ly: -v.z, lz: v.y }; }
  add(m, shadow) { m.castShadow = shadow !== false; m.receiveShadow = true; this.g.add(m); return m; }
  box(lx, ly, lz, sx, sy, sz, m, opt) {
    opt = opt || {};
    const me = new THREE.Mesh(opt.geo || UBOX, m); me.position.set(lx, lz, -ly); me.scale.set(sx, sz, sy);
    if (opt.rz) me.rotation.z = opt.rz; if (opt.ry) me.rotation.y = opt.ry;
    this.add(me, opt.shadow);
    if (opt.col !== false) boxCol(me, opt.tag || this.tag);
    return me;
  }
  bar(a, b, r, m, opt) {
    opt = opt || {};
    const A = this.L(a[0], a[1], a[2]), B = this.L(b[0], b[1], b[2]);
    const me = new THREE.Mesh(opt.square ? UBOX : UCYL6, m);
    me.position.copy(A).add(B).multiplyScalar(0.5);
    me.scale.set(opt.square ? 2 * r : r, A.distanceTo(B), opt.square ? 2 * r : r);
    me.quaternion.setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize());
    this.add(me, opt.shadow);
    if (opt.col !== false) capCol(this.g.localToWorld(A.clone()), this.g.localToWorld(B.clone()), r * (opt.square ? 1.2 : 1), opt.tag || this.tag);
    return me;
  }
  cyl(lx, ly, lz, r, h, m, opt) {
    opt = opt || {};
    const me = new THREE.Mesh(opt.geo || UCYL, m); me.position.set(lx, lz, -ly); me.scale.set(r, h, r);
    this.add(me, opt.shadow);
    if (opt.col !== false) capCol(this.world(lx, ly, lz - h / 2 + Math.min(r, h / 2)), this.world(lx, ly, lz + h / 2 - Math.min(r, h / 2)), r, opt.tag || this.tag);
    return me;
  }
  // 노랑/검정 띠 막대 (프레임) - 물체 로컬 xz 평면 (ly 고정)
  stripeBar(x0, z0, x1, z1, ly, t, seg) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / seg));
    for (let i = 0; i < n; i++) {
      const a0 = i / n, a1 = (i + 1) / n;
      const me = new THREE.Mesh(UBOX, i % 2 ? M.blk : M.yel);
      me.position.set(lerp(x0, x1, (a0 + a1) / 2), lerp(z0, z1, (a0 + a1) / 2), -ly);
      me.scale.set(L / n + 0.002, t, t); me.rotation.z = Math.atan2(z1 - z0, x1 - x0); this.add(me);
    }
    capCol(this.world(x0, ly, z0), this.world(x1, ly, z1), t * 0.6, this.tag);
  }
}

// ---------------- builders ----------------
const PADS = [];
function buildPad(o) {
  const b = new Obj(o), dia = num(o.dia, 1.2), PH = 0.14;
  b.box(-dia * 0.42, 0.03, PH / 2, 1.1, 1.1, PH, M.pallet, { col: false });
  b.box(dia * 0.46, -0.04, PH / 2, 1.1, 1.1, PH, M.pallet, { col: false });
  b.cyl(0, 0, PH + 0.01, dia / 2, 0.02, M.ply, { col: false, geo: UCYL40 });
  const Hh = dia * 0.7, Hw = dia * 0.6, st = dia * 0.135, zt = PH + 0.0225;
  for (const sx of [-1, 1]) b.box(sx * (Hw / 2 - st / 2), 0, zt, st, Hh, 0.005, M.white, { col: false, shadow: false });
  b.box(0, 0, zt, Hw - 2 * st + 0.02, st * 0.95, 0.005, M.white, { col: false, shadow: false });
  PADS.push({ b, r: dia / 2, top: PH + 0.02, half: [dia * 0.42 + 0.55, 0.6] });
}
let C1ON = false;   // 1종 시험장 (평탄) 사용 중
function groundAt(x, z) {
  if (C1ON) return 0;
  let h = terrainAt(x, z);
  for (const p of PADS) {
    const l = p.b.local(_p.set(x, 0, z));
    const y0 = p.b.g.position.y;
    if (l.lx * l.lx + l.ly * l.ly < p.r * p.r) h = Math.max(h, y0 + p.top);
    else if (Math.abs(l.lx) < p.half[0] && Math.abs(l.ly) < p.half[1]) h = Math.max(h, y0 + 0.14);
  }
  return h;
}
function buildBarrier(o) {
  const b = new Obj(o); const w = num(o.w, 2), h = num(o.h, 0.8), d = num(o.d, 0.45);
  b.box(0, 0, h / 2, w, d, h, M.redPl);
  b.box(0, 0, h + 0.03, w * 0.9, d * 0.6, 0.06, M.redPl, { col: false });
}
function buildRing(o) {
  const b = new Obj(o), dia = num(o.dia, 1.22), alt = num(o.alt, 2.75), tube = 0.035, Rr = dia / 2 + tube;
  const tor = new THREE.Mesh(new THREE.TorusGeometry(Rr, tube, 10, 56), M.yel); tor.position.set(0, alt, 0); b.add(tor);
  const tor2 = new THREE.Mesh(new THREE.TorusGeometry(Rr + tube * 0.9, tube * 0.35, 6, 48), M.blk); tor2.position.set(0, alt, 0); b.add(tor2);
  torusCol(b.world(0, 0, alt), b.world(0, 1, 0).sub(b.world(0, 0, 0)).normalize(), Rr, tube * 1.4, 'ring');
  b.bar([0, 0, -0.25], [0, 0, alt - Rr - tube], 0.02, M.steel);
  b.bar([-0.5, 0, 0], [0.08, 0, alt * 0.48], 0.035, M.wood, { square: true });
  b.bar([0.5, 0, 0], [-0.08, 0, alt * 0.48], 0.035, M.wood, { square: true });
  b.bar([0, 0.5, 0], [0, 0.05, alt * 0.45], 0.03, M.wood, { square: true });
  b.pass = { kind: 'ring', zc: alt, r: dia / 2 };
}
function buildGateSq(o) {
  const b = new Obj(o, 'gate'), w = num(o.w, 1.22), h = num(o.h, 1.22), el = num(o.elev, 2.05), t = num(o.bar, 0.1);
  const x0 = -w / 2 - t / 2, x1 = w / 2 + t / 2, zb = el - t / 2, zt = el + h + t / 2;
  b.stripeBar(x0 - t / 2, zb, x1 + t / 2, zb, 0, t, 0.3); b.stripeBar(x1, zb, x1, zt, 0, t, 0.3);
  b.stripeBar(x1 + t / 2, zt, x0 - t / 2, zt, 0, t, 0.3); b.stripeBar(x0, zt, x0, zb, 0, t, 0.3);
  const lx = w / 2 + t / 2;
  for (const sx of [-1, 1]) b.bar([sx * lx, 0, -0.25], [sx * lx, 0, zb - t / 2], 0.045, M.leg, { square: true });
  b.bar([-lx, 0, 0.5], [lx, 0, el - 0.3], 0.02, M.olv, { square: true });
  b.bar([lx, 0, 0.5], [-lx, 0, el - 0.3], 0.02, M.olv, { square: true });
  b.bar([-lx, 0, el * 0.5], [lx, 0, el * 0.5], 0.025, M.olv, { square: true });
  b.pass = { kind: 'sq', x0: -w / 2, x1: w / 2, z0: el, z1: el + h };
}
function buildGateTri(o) {
  const b = new Obj(o, 'gate'), w = num(o.w, 2.11), h = num(o.h, 1.83), el = num(o.elev, 4.05), t = num(o.bar, 0.1);
  const A = [-w / 2, el], B = [w / 2, el], Cc = [0, el + h];
  const edge = (P, Q, n) => {
    const d = [Q[0] - P[0], Q[1] - P[1]], L = Math.hypot(d[0], d[1]), u = [d[0] / L, d[1] / L], ext = t * 0.7;
    b.stripeBar(P[0] + n[0] * t / 2 - u[0] * ext, P[1] + n[1] * t / 2 - u[1] * ext, Q[0] + n[0] * t / 2 + u[0] * ext, Q[1] + n[1] * t / 2 + u[1] * ext, 0, t, 0.3);
  };
  let nl = [-h, w / 2], nr = [h, w / 2]; const ln = Math.hypot(nl[0], nl[1]); nl = [nl[0] / ln, nl[1] / ln]; nr = [nr[0] / ln, nr[1] / ln];
  edge(A, B, [0, -1]); edge(A, Cc, nl); edge(B, Cc, nr);
  for (const x of [-w / 2, 0, w / 2]) b.bar([x, 0, -0.25], [x, 0, el - t], 0.045, M.leg, { square: true });
  b.bar([-w / 2 - 0.45, 0, 0], [w / 2 + 0.05, 0, el - 0.15], 0.035, M.leg, { square: true });
  b.pass = { kind: 'tri', A, B, C: Cc };
}
function buildPole(o) {
  const b = new Obj(o), w = num(o.w, 0.4), h = num(o.h, 4.5), H = num(o.height, 7);
  b.box(0, 0, h / 2, w, 0.05, h, M.pole);
  b.box(w * 0.32, 0.06, H / 2, w * 0.34, 0.05, H, M.pole);
  b.box(-w * 0.4, 0.11, h * 0.39, w * 0.3, 0.05, h * 0.78, M.pole);
  b.bar([0.12, 0.95, 0.06], [0.02, 0.08, h * 0.5], 0.03, M.wood, { square: true });
}
function buildPanel(o) {
  const b = new Obj(o), w = num(o.w, 0.9), h = num(o.h, 3.4), el = num(o.elev, 1.1);
  b.box(0, 0, el + h / 2, w, 0.04, h, M.panel);
  for (const sx of [-1, 1]) b.cyl(sx * (w / 2 - 0.2), 0, (el + 0.05) / 2, 0.055, el + 0.05, M.grey);
}
function buildIvanGroup(o, extras) {
  const b = new Obj(o, 'ivan'), n = num(o.count, 3), sp = num(o.spacing, 2.2), w = num(o.w, 0.9), h = num(o.h, 1.7), el = num(o.elev, 0.75);
  b.boards = [];
  for (let k = 0; k < n; k++) {
    const lx = (k - (n - 1) / 2) * sp;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.sil); pl.position.set(lx, el + h / 2, 0); pl.customDepthMaterial = silDepth; b.add(pl);
    b.box(lx, 0, el + h / 2, w * 0.75, 0.04, h, M.sil, { col: true, shadow: false }).visible = false;
    b.bar([lx, 0.03, 0], [lx, 0.03, el + 0.25], 0.028, M.steel);
    b.boards.push([lx, 0, el + h / 2]);
  }
  if (extras) {
    const hx = (n - 1) / 2 * sp + 1.2;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) buildCone(b.world(sx * hx, sy * 1.6, 0));
    const tz = 0.015;
    b.box(0, -1.6, tz, 2 * hx, 0.05, 0.02, M.tape, { col: false, shadow: false }); b.box(0, 1.6, tz, 2 * hx, 0.05, 0.02, M.tape, { col: false, shadow: false });
    for (const sx of [-1, 1]) b.box(sx * hx, 0, tz, 0.05, 3.2, 0.02, M.tape, { col: false, shadow: false });
  }
  return b;
}
const CONE_GEO = new THREE.ConeGeometry(0.17, 0.45, 14); CONE_GEO.translate(0, 0.225, 0);
const CONE_BAND = new THREE.CylinderGeometry(0.095, 0.12, 0.08, 14);
function buildCone(p) {
  const c = new THREE.Mesh(CONE_GEO, M.cone); c.position.copy(p); c.castShadow = true; scene.add(c);
  const bd = new THREE.Mesh(CONE_BAND, M.white); bd.position.copy(p).add(new V3(0, 0.22, 0)); scene.add(bd);
  const base = new THREE.Mesh(UBOX, M.cone); base.scale.set(0.36, 0.03, 0.36); base.position.copy(p).add(new V3(0, 0.015, 0)); scene.add(base);
  capCol(p.clone().add(new V3(0, 0.1, 0)), p.clone().add(new V3(0, 0.38, 0)), 0.12, 'cone');
}
function buildTunnel(o) {
  const b = new Obj(o, 'tunnel'), dia = num(o.dia, 1.7), L = num(o.length, 4.5), el = num(o.elev, 0.95), rin = dia / 2, th = 0.06, zc = el + dia / 2;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(rin + th / 2, rin + th / 2, L, 48, 1, true), M.pipe);
  pipe.rotation.x = Math.PI / 2; pipe.position.set(0, zc, 0); b.add(pipe);
  for (const s of [-1, 1]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(rin + th / 2, 0.045, 8, 48), M.yel); rim.position.set(0, zc, s * L / 2); b.add(rim); }
  tubeCol(b.world(0, -L / 2, zc), b.world(0, L / 2, zc), rin, rin + th + 0.03, 'tunnel');
  for (const ly of [-(L / 2 - 0.7), L / 2 - 0.7]) {
    b.bar([-rin - 0.45, ly, 0], [-rin * 0.45, ly, zc - rin * 0.93], 0.045, M.leg, { square: true });
    b.bar([rin + 0.45, ly, 0], [rin * 0.45, ly, zc - rin * 0.93], 0.045, M.leg, { square: true });
    b.bar([-rin * 0.75, ly, zc - rin * 0.72], [rin * 0.75, ly, zc - rin * 0.72], 0.035, M.leg, { square: true, col: false });
  }
  b.pass = { kind: 'tunnel', zc, r: rin, L };
}
function buildBunker(o) {
  const b = new Obj(o, 'bunker'), w = num(o.w, 3.8), h = num(o.h, 3.1), d = num(o.d, 3.0), T = 0.14;
  const nx = Math.max(1, Math.round(w / 1.2)), nz = Math.max(1, Math.round(h / 1.0));
  const cw = w / nx, ch = h / nz, win = [Math.floor(nx / 2), nz - 1];
  const fx0 = -w / 2 + win[0] * cw + 0.05, fx1 = -w / 2 + (win[0] + 1) * cw - 0.05, fz0 = win[1] * ch + 0.04, fz1 = (win[1] + 1) * ch - 0.04, ft = 0.06;
  const mm = (inner) => { const a = [M.pallet, M.pallet, M.pallet, M.pallet, M.pallet, M.pallet]; a[inner] = M.inner; return a; };
  const front = mm(5), back = mm(4), left = mm(0), right = mm(1), roofM = [M.roof, M.roof, M.roof, M.dark, M.roof, M.roof];
  // 앞벽 (창 칸 제외)
  for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
    if (ix === win[0] && iz === win[1]) continue;
    b.box(-w / 2 + (ix + 0.5) * cw, -d / 2 + T / 2, (iz + 0.5) * ch, cw, T, ch, front);
  }
  // 창 둘레 (칸과 창틀 사이 여백 + 창틀)
  const wxc = (fx0 + fx1) / 2, wzc = (fz0 + fz1) / 2, cx0 = -w / 2 + win[0] * cw, cz0 = win[1] * ch;
  b.box(cx0 + 0.025, -d / 2 + T / 2, cz0 + ch / 2, 0.05 + ft, T, ch, front);
  b.box(cx0 + cw - 0.025, -d / 2 + T / 2, cz0 + ch / 2, 0.05 + ft, T, ch, front);
  b.box(wxc, -d / 2 + T / 2, cz0 + 0.02 + ft / 2, cw, T, 0.04 + ft, front);
  b.box(wxc, -d / 2 + T / 2, cz0 + ch - 0.02 - ft / 2, cw, T, 0.04 + ft, front);
  b.box(0, d / 2 - T / 2, h / 2, w, T, h, back);
  // 왼쪽 벽: 가운데 위칸에 두 번째 창 (정찰 후 이쪽으로 나감)
  const wy = (fx1 - fx0) / 2 - ft, lz0 = fz0 + ft, lz1 = fz1 - ft, lwx = -w / 2 + T / 2, yA = -d / 2 + T, yB = d / 2 - T;
  b.box(lwx, (yA + (-wy - ft)) / 2, h / 2, T, (-wy - ft) - yA, h, left);
  b.box(lwx, ((wy + ft) + yB) / 2, h / 2, T, yB - (wy + ft), h, left);
  b.box(lwx, 0, (lz0 - ft) / 2, T, 2 * (wy + ft), lz0 - ft, left);
  b.box(lwx, 0, (lz1 + ft + h) / 2, T, 2 * (wy + ft), h - lz1 - ft, left);
  for (const sy of [-1, 1]) b.box(lwx, sy * (wy + ft / 2), (lz0 + lz1) / 2, T, ft, lz1 - lz0 + 2 * ft, M.dkwood);
  b.box(lwx, 0, lz0 - ft / 2, T, 2 * wy + 2 * ft, ft, M.dkwood); b.box(lwx, 0, lz1 + ft / 2, T, 2 * wy + 2 * ft, ft, M.dkwood);
  b.box(w / 2 - T / 2, 0, h / 2, T, d - 2 * T, h, right);
  b.box(0, 0, h + 0.05, w + 0.3, d + 0.3, 0.1, roofM);
  b.box(0, 0, 0.01, w - 2 * T, d - 2 * T, 0.02, M.dark, { col: false });
  // 내부: 상자 + 노란 깃발 (정찰 대상)
  b.box(w / 2 - 0.55, d / 2 - 0.55, 0.3, 0.6, 0.6, 0.6, M.wood);
  b.box(-w / 2 + 0.5, d / 2 - 0.45, 0.22, 0.5, 0.4, 0.44, M.olive);
  b.bar([-0.6, 0.8, 0], [-0.6, 0.8, 1.5], 0.015, M.steel, { col: false });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), mat(0xf2c218, { side: THREE.DoubleSide })); fl.position.set(-0.35, 1.34, -0.8); b.add(fl);
  b.inner = { x: w / 2 - T, y0: -d / 2 + T, y1: d / 2 - T, z: h };
  b.win = { x0: fx0 + ft, x1: fx1 - ft, z0: fz0 + ft, z1: fz1 - ft, xc: wxc, zc: wzc, y: -d / 2 };
  b.win2 = { y0: -wy, y1: wy, z0: lz0, z1: lz1, zc: (lz0 + lz1) / 2, x: -w / 2 };
  b.dims = { w, h, d };
}
function buildMIT(o) {
  const b = new Obj(o, 'mit'), L = num(o.length, 30), w = num(o.w, 0.9), h = num(o.h, 1.7), el = num(o.elev, 0.45);
  b.box(0, 0, 0.12, L, 0.35, 0.24, M.steel);
  b.box(0, -1.4, 0.35, L + 1, 0.3, 0.7, M.concrete);
  const car = new THREE.Group(); b.g.add(car);
  const cb = new THREE.Mesh(UBOX, M.olive); cb.scale.set(0.7, 0.2, 0.45); cb.position.set(0, 0.34, 0); cb.castShadow = true; car.add(cb);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.sil); pl.position.set(0, 0.24 + el + h / 2, 0); pl.castShadow = true; pl.customDepthMaterial = silDepth; car.add(pl);
  const hit = new THREE.Mesh(UBOX); hit.visible = false; hit.scale.set(w * 0.75, h, 0.05); hit.position.copy(pl.position); car.add(hit);
  b.car = car; b.amp = L / 2 - 2; b.board = [0, 0, 0.24 + el + h / 2];
  b.col = boxCol(hit, 'mit'); b.hitMesh = hit;
  b.update = (t) => { car.position.x = b.amp * Math.sin(t * 3.5 / b.amp); updBoxCol(b.col, hit); };
}
function buildTank(o) {
  const b = new Obj(o, 'tank'), L = num(o.length, 8.1), Wd = num(o.w, 3.3), Hh = num(o.h, 1.7), TOP = num(o.height, 2.85), BAR = num(o.d, 3.7);
  const k = L / 8.08, wh = Hh * 0.5, dk = 0.18, TW = Wd * 0.78;
  b.box(0, 0, wh / 2, Wd * 0.95, L * 0.9, wh, M.wheel);
  b.box(0, 0, wh + (Hh - wh) / 2, Wd, L * 0.86, Hh - wh, M.camo);
  b.box(0, 0.1 * k, Hh + dk / 2, Wd * 0.86, L * 0.68, dk, M.camo);
  const ys = [-2.98, -1.76, -0.6, 0.56, 1.72, 2.88];
  const wg = new THREE.CylinderGeometry(1, 1, 1, 20); wg.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const y of ys) b.cyl(sx * (Wd * 0.475 + 0.03), y * k, wh * 0.52, wh * 0.56, 0.06, M.wheel, { geo: wg, col: false });
  const zt0 = Hh + dk;
  b.box(0, 0.11 * k, (zt0 + TOP) / 2, TW, 3.32 * k, TOP - zt0, M.camo);
  b.box(0, -1.62 * k, TOP - 0.38, 0.7, 0.3, 0.5, M.camo);
  b.bar([0, -1.7 * k, TOP - 0.36], [0, -1.7 * k - BAR, TOP - 0.3], 0.085, M.barrel);
  b.bar([0.6, 1.2, TOP], [0.6, 1.2, TOP + 1.6], 0.012, M.blk, { col: false });
  b.foot = { x: Wd / 2, y: L / 2 };
}
function buildHipBld(o) {
  const b = new Obj(o), w = num(o.w, 10), h = num(o.h, 3), d = num(o.d, 7);
  b.box(0, 0, h / 2, w, d, h, M.beige);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), M.roof); roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / 1.414 * 1.12, 1.4, d / 1.414 * 1.12); roof.position.set(0, h + 0.7, 0); b.add(roof);
  b.box(-w * 0.2, d / 2 + 0.01, 1.05, 1.0, 0.04, 2.1, M.dkwood, { col: false });
  for (const x of [w * 0.12, w * 0.32]) b.box(x, d / 2 + 0.01, 1.7, 1.3, 0.04, 1.0, M.glass, { col: false });
  b.box(w * 0.3, 0, h + 1.2, 0.25, 0.25, 0.9, M.grey, { col: false });
}
function buildPavilion(o) {
  const b = new Obj(o), w = num(o.w, 14), h = num(o.h, 3.1), d = num(o.d, 7.5);
  b.box(0, 0, 0.08, w, d, 0.16, M.concrete);
  for (const sx of [-1, 0, 1]) for (const sy of [-1, 1]) b.box(sx * (w / 2 - 0.2), sy * (d / 2 - 0.2), h / 2, 0.2, 0.2, h, M.grey);
  b.box(0, 0, h + 0.1, w + 0.6, d + 0.6, 0.2, M.roof);
}
function buildTower(o) {
  const b = new Obj(o), w = num(o.w, 6), h = num(o.h, 3.2), d = num(o.d, 4.5);
  b.box(0, 0, h / 2, w, d, h, M.beige);
  b.box(0, 0, h + 0.1, w + 0.4, d + 0.4, 0.2, M.roof);
  b.box(0, d / 2 + 0.01, h * 0.62, w * 0.86, 0.04, h * 0.32, M.glass, { col: false });
  b.box(-w * 0.3, -d / 2 - 0.01, 1.05, 0.95, 0.04, 2.1, M.dkwood, { col: false });
  b.bar([w * 0.35, -d * 0.3, h], [w * 0.35, -d * 0.3, h + 3.5], 0.03, M.steel);
}
function buildShelter(o) {
  const b = new Obj(o), w = num(o.w, 5), h = num(o.h, 3), d = num(o.d, 4.5);
  b.box(0, -d / 4, h * 0.45, w, d / 2, h * 0.9, M.beige);
  for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.1), d / 2 - 0.1, h / 2, 0.12, 0.12, h, M.grey);
  b.box(0, 0, h + 0.05, w + 0.4, d + 0.3, 0.1, M.roof);
  b.box(0, d / 4, 0.4, 1.6, 0.8, 0.06, M.red); for (const sx of [-1, 1]) b.box(sx * 0.7, d / 4, 0.2, 0.06, 0.6, 0.4, M.red, { col: false });
}
function buildBleacher(o) {
  const b = new Obj(o), w = num(o.w, 12), h = num(o.h, 5.5), d = num(o.d, 7);
  for (let i = 0; i < 5; i++) b.box(0, d / 2 - 1.0 - i * 1.0, 0.25 + i * 0.45, w - 0.6, 1.0, 0.5 + i * 0.9 - i * 0.45, M.grey);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.box(sx * (w / 2 - 0.15), sy * (d / 2 - 0.2), h / 2, 0.15, 0.15, h, M.steel);
  b.box(0, 0, h + 0.05, w + 0.4, d + 0.4, 0.1, M.roof);
}
function buildFP(o) {
  const b = new Obj(o), w = num(o.w, 1.2), h = num(o.h, 0.8);
  b.box(0, 0.4, h / 2, w + 0.6, 0.45, h, M.sand);
  for (const sx of [-1, 1]) b.box(sx * (w / 2 + 0.3), -0.2, h / 2, 0.45, 1.2, h, M.sand);
}
function buildSil(o, frame) {
  const b = new Obj(o), w = num(o.w, 1.4), h = num(o.h, 2), el = num(o.elev, 0.15);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.9), M.sil); pl.position.set(0, el + h / 2, 0); pl.customDepthMaterial = silDepth; b.add(pl);
  if (frame) {
    b.stripe = null;
    b.bar([-w / 2, -0.03, 0], [-w / 2, -0.03, el + h], 0.04, M.wood, { square: true });
    b.bar([w / 2, -0.03, 0], [w / 2, -0.03, el + h], 0.04, M.wood, { square: true });
    b.bar([-w / 2, -0.03, el + h], [w / 2, -0.03, el + h], 0.04, M.wood, { square: true });
  }
}
function buildHouseTgt(o) {
  const b = new Obj(o), w = num(o.w, 1.8), h = num(o.h, 2.2), el = num(o.elev, 0.4), wall = h * 0.62;
  b.box(0, 0, el + wall / 2, w, 0.05, wall, M.ply);
  const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.1, 0); sh.lineTo(w / 2 + 0.1, 0); sh.lineTo(0, h - wall); sh.lineTo(-w / 2 - 0.1, 0);
  const rf = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }), M.dkwood); rf.position.set(0, el + wall, -0.025); b.add(rf);
  b.box(0, -0.03, el + wall * 0.45, 0.5, 0.02, 0.6, M.dark, { col: false });
  for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.15), 0.05, (el) / 2 + 0.1, 0.08, 0.08, el + 0.2, M.wood, { col: false });
}
function buildBTarget(o) {
  const b = new Obj(o), w = num(o.w, 2.6), h = num(o.h, 1.3), d = num(o.d, 1.8);
  const berm = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.berm);
  berm.scale.set(w * 1.1, h * 1.05, d * 1.4); berm.position.set(0, 0, -0.6); b.add(berm);
  b.box(0, -0.2, h / 2, w, d * 0.7, h, M.brick);
  b.box(0, -0.2 - d * 0.35 - 0.01, h * 0.55, w * 0.35, 0.02, h * 0.3, M.dark, { col: false });
}
function buildZ(o) {
  const b = new Obj(o), w = num(o.w, 1.6), h = num(o.h, 1.6), el = num(o.elev, 0.7);
  b.box(0, 0, el + h / 2, w, 0.04, h, [M.white, M.white, M.white, M.white, M.white, mat(0xffffff, { map: textTex('Z', { w: 256, h: 256, size: 230 }) })]);
  for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.15), 0.05, el / 2, 0.08, 0.08, el, M.wood, { col: false });
}
function buildSign(o) {
  const b = new Obj(o), w = num(o.w, 1.9), h = num(o.h, 1.5), el = num(o.elev, 0.67), fr = 0.075;
  const face = mat(0xffffff, { map: textTex(String(o.text || ''), { w: 256, h: 200, size: 120 }) });
  b.box(0, 0, el + h / 2, w - 2 * fr, 0.02, h - 2 * fr, [M.white, M.white, M.white, M.white, M.white, face]);
  b.box(0, 0, el + h - fr / 2, w, 0.07, fr, M.dkwood, { col: false }); b.box(0, 0, el + fr / 2, w, 0.07, fr, M.dkwood, { col: false });
  for (const sx of [-1, 1]) { b.box(sx * (w / 2 - fr / 2), 0, el + h / 2, fr, 0.07, h, M.dkwood, { col: false }); b.box(sx * (w / 2 - 0.13), 0, el / 2, 0.08, 0.08, el, M.dkwood); }
}
function buildLimitEnd(o) {
  const b = new Obj(o), arrow = String(o.text || '>');
  const face = mat(0xffffff, { map: textTex(arrow === '>' ? '▶' : '◀', { w: 256, h: 256, size: 200, bg: '#e8e6e2', fg: '#7a0a1e' }) });
  b.box(0, 0, 1.6, 1.0, 0.04, 1.0, [M.white, M.white, M.white, M.white, M.white, face]);
  b.cyl(0, 0, 0.55, 0.05, 1.1, M.grey);
}
function buildLogoPanel() {
  const o = { id: 'logo_panel', type: 'logo', down: 11, side: 0, yaw: 0 }; const b = new Obj(o);
  b.box(0, 0, 0.035, 5.0, 3.4, 0.07, M.blk, { col: false });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.2), mat(0xffffff, { map: TX.logo, roughness: 0.7 }));
  pl.rotation.x = -Math.PI / 2; pl.position.set(0, 0.072, 0); b.add(pl, false);
}
let flagMesh = null;
function buildFlag() {
  const o = { id: 'flag', type: 'flag', down: -30.6, side: 10.2, yaw: 0 }; const b = new Obj(o);
  b.cyl(0, 0, 0.15, 0.35, 0.3, M.concrete, { geo: UCYL40 });
  b.cyl(0, 0, 3.6, 0.045, 7.0, M.white);
  const geo = new THREE.PlaneGeometry(1.8, 1.2, 18, 12); geo.translate(0.9, 0, 0);
  flagMesh = new THREE.Mesh(geo, mat(0x8a0018, { side: THREE.DoubleSide, roughness: 0.8 }));
  flagMesh.position.set(0.05, 6.4, 0); flagMesh.rotation.y = 0.6; b.add(flagMesh);
  flagMesh.userData.base = geo.attributes.position.array.slice();
}

const BUILDERS = {
  pad: buildPad, barrier: buildBarrier, ring: buildRing, gate_sq: buildGateSq, gate_tri: buildGateTri, pole: buildPole,
  panel: buildPanel, ivan_group: o => buildIvanGroup(o, o.id === 'ivan_grp1'), tunnel: buildTunnel, bunker: buildBunker, mit: buildMIT,
  tank: buildTank, building: buildTower, shelter: buildShelter, bleacher: buildBleacher, fp: buildFP, pavilion: buildPavilion,
  hipbld: buildHipBld, house_tgt: buildHouseTgt, etype: o => buildSil(o, true), btarget: buildBTarget, ztarget: buildZ,
  sign: buildSign, limit_end: buildLimitEnd
};
// ---- 지형 정지(整地): 시설물이 놓일 자리를 평평하게 깎고 메움 (cut & fill) ----
function flattenRect(cx, cz, yaw, hx, hz, blend, y) {
  const n = TER.n, H = TER.h, c = Math.cos(yaw), s = Math.sin(yaw), R = Math.hypot(hx, hz) + blend + TER.step;
  const ix0 = Math.max(0, Math.floor((cx - R - GS0) / TER.step)), ix1 = Math.min(n - 1, Math.ceil((cx + R - GS0) / TER.step));
  const iy0 = Math.max(0, Math.floor((GD1 + cz - R) / TER.step)), iy1 = Math.min(n - 1, Math.ceil((GD1 + cz + R) / TER.step));
  for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) {
    const x = GS0 + ix * TER.step - cx, z = iy * TER.step - GD1 - cz;
    const lx = x * c - z * s, lz = x * s + z * c;                    // 시설물 축 기준
    const d = Math.hypot(Math.max(0, Math.abs(lx) - hx), Math.max(0, Math.abs(lz) - hz));
    const w = 1 - smooth01(0, blend, d);
    if (w > 0) H[iy * n + ix] = H[iy * n + ix] * (1 - w) + y * w;
  }
}
const EARTH = { cut: 0, fill: 0 };
(function siteWorks() {
  if (!TER.h) return;
  const before = TER.h.slice();
  const pt = (d, s) => { const x = s, z = -d; return [x, z, terrainAt(x, z)]; };
  // 1) 출발·통제 구역 터 (패드·통제탑·관람석·사로 등) — 출발 패드 높이로 정지
  if (CRS_C) {   // 전용 코스: 출발 패드 주변만 작은 터
    const a = BY.pad_start, b = BY.pad_land, [x, z, y] = pt(a.down, a.side), [x2, z2] = pt(b.down, b.side);
    flattenRect((x + x2) / 2, (z + z2) / 2, num(a.yaw, 0) * DEG, Math.hypot(x2 - x, z2 - z) / 2 + 6, 9, 14, y);
  } else { const [x, z, y] = pt(10, -5); flattenRect(-28, 25, 0, 40, 42, 25, y); }
  // 2) 시설물마다 작은 터
  const rad = { pad: [1.5, 1.5], ring: [1.5, 1.5], gate_sq: [1.6, 1.2], gate_tri: [1.8, 1.2], pole: [1, 1], bunker: [3.5, 3], tunnel: [3.5, 1.8],
    ivan_group: [4, 1.5], panel: [1.2, 1], mit: [16, 2.5], tank: [5, 3], barrier: [1.5, 1], fp: [1.2, 1.2], house_tgt: [1.8, 1.8],
    etype: [1.2, 1], btarget: [2, 1.6], ztarget: [1.5, 1], sign: [1.6, 1], limit_end: [1.2, 1] };
  for (const o of D.objs) {
    const r = rad[o.type]; if (!r) continue;
    let hx = r[0], hz = r[1];
    if (o.type === 'ivan_group') hx = Math.max(hx, num(o.count, 3) * num(o.spacing, 2) / 2 + 1);
    const [x, z, y] = pt(o.down, o.side);
    flattenRect(x, z, num(o.yaw, 0) * DEG, hx, hz, Math.max(4, hx * 0.8), y);
  }
  let cut = 0, fill = 0; const a = TER.step * TER.step;
  for (let i = 0; i < before.length; i++) { const dh = TER.h[i] - before[i]; if (dh < 0) cut -= dh * a; else fill += dh * a; }
  EARTH.cut = cut; EARTH.fill = fill;
  applyTerrain(TER.h); grassRefit();
})();
for (const o of D.objs) { const f = BUILDERS[o.type]; if (f) f(o); else console.warn('no builder', o.type); }
// 수치지형도 건물: 최소 외접 사각형으로 세우고 충돌 상자도 만듦
const SITE_BLD = (function siteBuildings() {
  if (!VEC || !VEC.bld) return 0;
  const wallM = [mat(0xc9c2b4, { roughness: 0.9 }), mat(0xb7b0a0, { roughness: 0.9 }), mat(0xd6d0c4, { roughness: 0.9 })];
  const roofM = [mat(0x5a6f86, { roughness: 0.7 }), mat(0x8a4a3a, { roughness: 0.8 }), mat(0x6c6f72, { roughness: 0.8 })];
  let n = 0;
  for (const [d, s, w, l, ang, h] of VEC.bld) {
    const c = W(d, s, 0), a = ang * DEG, ca = Math.cos(a), sa = Math.sin(a);
    // 바닥 네 귀퉁이 지면 높이 -> 가장 낮은 곳에서 시작해 경사지에 묻히게
    let lo = 1e9, hi = -1e9;
    for (const [u, v] of [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]]) {
      const dd = d + u * ca - v * sa, ss = s + u * sa + v * ca, y = terrainAt(ss, -dd); lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    const H = h + (hi - lo), k = n % 3;
    const m = new THREE.Mesh(UBOX, wallM[k]); m.position.set(c.x, lo - 0.3 + (H + 0.3) / 2, c.z);
    // 코스 좌표 (down=x축 방향 회전) -> three: down 축 = -z, side 축 = +x
    m.rotation.y = Math.PI / 2 - a; m.scale.set(w, H + 0.3, l);   // 변 w = (down, side) 평면에서 ang 방향
    m.castShadow = true; m.receiveShadow = true; scene.add(m); boxCol(m, 'bld');
    const r = new THREE.Mesh(UBOX, roofM[k]); r.position.set(c.x, lo + H + 0.12, c.z); r.rotation.y = Math.PI / 2 - a; r.scale.set(w + 0.5, 0.25, l + 0.5); r.castShadow = true; scene.add(r);
    n++;
  }
  return n;
})();
// 숲길 (나무 사이 좁은 길): 주 경로에서 옆으로 떨어진 숲 속 길. 길 위 나무는 비우고, 게이트·쓰러진 나무·좁은 틈을 둠
const FLANE = (function forestLane() {
  if (!CRS_C || !SITE.trees) return null;
  const P = CRS_C.path, OFF = 34;
  // 경로를 2 m 간격으로 다시 찍고, 왼쪽(+side) 으로 OFF 만큼 평행 이동 후 이동평균으로 다듬음
  const rs = []; let acc = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = acc; t < L; t += 2) { const u = t / L; rs.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
    acc = Math.max(0, (Math.ceil((L - acc) / 2) * 2 + acc) - L);
  }
  let lane = rs.map((p, i) => { const q = rs[Math.min(rs.length - 1, i + 1)], o = rs[Math.max(0, i - 1)], dd = q[0] - o[0], ds = q[1] - o[1], l = Math.hypot(dd, ds) || 1; return [p[0] - ds / l * OFF, p[1] + dd / l * OFF]; });
  lane = lane.slice(Math.floor(lane.length * 0.06), Math.floor(lane.length * 0.94));
  for (let it = 0; it < 3; it++) lane = lane.map((p, i) => { let sd = 0, ss = 0, n = 0; for (let k = -8; k <= 8; k++) { const q = lane[Math.max(0, Math.min(lane.length - 1, i + k))]; sd += q[0]; ss += q[1]; n++; } return [sd / n, ss / n]; });
  // 누적 거리
  const cum = [0]; for (let i = 1; i < lane.length; i++) cum.push(cum[i - 1] + Math.hypot(lane[i][0] - lane[i - 1][0], lane[i][1] - lane[i - 1][1]));
  const total = cum[cum.length - 1];
  const at = s => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const u = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), a = lane[i - 1], b = lane[i];
    const d = a[0] + (b[0] - a[0]) * u, sd = a[1] + (b[1] - a[1]) * u, l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return { d, s: sd, td: (b[0] - a[0]) / l, ts: (b[1] - a[1]) / l }; };
  // 시설물
  const G = new THREE.Group(); scene.add(G);
  const gateM = mat(0xff7a1a, { roughness: 0.6 }), barkM = mat(0x4a3a2c, { roughness: 1 }), leafM = mat(0x3c5634, { roughness: 1 }), tapeM = mat(0xf2e14c, { roughness: 0.7 });
  const cps = [];
  // 코스 좌표 (down, side, agl) + 길 방향 기준 오프셋 -> world
  const wpt = (q, lat, up) => W(q.d - q.ts * lat, q.s + q.td * lat, up);
  const box = (a, b, w, col, tag) => { const m = new THREE.Mesh(UBOX, col); m.position.copy(a).add(b).multiplyScalar(0.5); const L = a.distanceTo(b); m.scale.set(w, w, L); m.lookAt(b); m.castShadow = true; G.add(m); if (tag) boxCol(m, tag); return m; };
  const cyl = (a, b, r, col, tag) => { const m = new THREE.Mesh(UCYL, col); m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(r, a.distanceTo(b), r); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize()); m.castShadow = true; m.receiveShadow = true; G.add(m); if (tag) capCol(a.clone(), b.clone(), r, tag); return m; };
  const yaw = q => Math.atan2(q.ts, q.td);   // 길 방향 (코스 좌표 각)
  function gate(s, label, w, h) {
    const q = at(s), hw = w / 2;
    const l0 = wpt(q, -hw - 0.1, 0), l1 = wpt(q, -hw - 0.1, h + 0.1), r0 = wpt(q, hw + 0.1, 0), r1 = wpt(q, hw + 0.1, h + 0.1);
    box(l0, l1, 0.16, gateM, 'fgate'); box(r0, r1, 0.16, gateM, 'fgate'); box(l1, r1, 0.16, gateM, 'fgate');
    cps.push({ s, q, label, hw, y0: 0.2, y1: h });
  }
  function lowLog(s) {   // 쓰러진 나무: 위로 넘기
    const q = at(s), a = wpt(q, -6, 0.75), b = wpt(q, 6.5, 0.55);
    cyl(a, b, 0.32, barkM, 'log');
    for (const k of [-0.3, 0.1, 0.4]) { const p = a.clone().lerp(b, 0.5 + k); box(p, p.clone().add(new V3(0, 0.9, 0.3)), 0.07, barkM); }   // 부러진 가지
    cps.push({ s, q, label: '쓰러진 나무 넘기', hw: 2.6, y0: 1.25, y1: 4.2 });
  }
  function arch(s) {   // 기울어진 나무: 아래로 지나기
    const q = at(s), a = wpt(q, -7, 0.1), b = wpt(q, 6, 4.9);
    cyl(a, b, 0.28, barkM, 'log');
    const crown = new THREE.Mesh(USPH, leafM); crown.position.copy(b).add(new V3(0, 0.6, 0)); crown.scale.set(2.6, 1.6, 2.6); crown.castShadow = true; G.add(crown);
    const yc = 0.1 + (7 / 13) * 4.8;   // 길 가운데 높이
    cps.push({ s, q, label: '기운 나무 아래로', hw: 2.4, y0: 0.25, y1: yc - 0.45 });
  }
  function gap(s) {   // 좁은 나무 틈
    const q = at(s);
    for (const lat of [-1.35, 1.35]) {
      const a = wpt(q, lat, -0.3), b = wpt(q, lat, 11);
      cyl(a, b, 0.3, barkM, 'trunk');
      const c = new THREE.Mesh(USPH, leafM); c.position.copy(wpt(q, lat * 1.8, 9.5)); c.scale.set(2.4, 2.8, 2.4); c.castShadow = true; G.add(c);
    }
    const t0 = wpt(q, -1.05, 2.2), t1 = wpt(q, 1.05, 2.2); box(t0, t1, 0.04, tapeM);   // 표시 띠
    cps.push({ s, q, label: '좁은 틈 (2.1 m)', hw: 1.05, y0: 0.2, y1: 6 });
  }
  // 약 17 m 마다 하나씩 (게이트·틈·넘기·아래로 섞어서)
  const PAT = ['g', 'n', 'g', 'l', 'g', 'a', 'n', 'g', 'l', 'g', 'a', 'n'], plan = [];
  for (let s = 16, i = 0; s < total - 30; s += 17, i++) plan.push([s, PAT[i % PAT.length]]);
  plan.push([total - 14, 'f']);
  let gi = 0;
  for (const [s, k] of plan) {
    if (s > total - 10 && k !== 'f') continue;
    if (k === 'g') gate(s, '숲 게이트 ' + (++gi), 3.0, 2.6); else if (k === 'l') lowLog(s); else if (k === 'a') arch(s); else if (k === 'n') gap(s); else gate(s, '숲길 결승', 3.6, 3.2);
  }
  // 나무 비울 곳 (코스 좌표 점 목록, 반경)
  const clear = lane.filter((_, i) => i % 1 === 0);
  return { lane, total, at, cps, G, clear, R: 3.0, gateM };
})();
// 나무: 현장 패키지의 trees (정사영상 수관 검출) 를 구역별 InstancedMesh 로 세움 + 충돌 격자
const STREES = (function siteTrees() {
  const T = SITE.trees; if (!T || !T.n) return { n: 0, col() { return null; } };
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const i16 = new Int16Array(b64(T.i16).buffer), u8 = b64(T.u8), n = T.n;
  // 형상: 단위 높이 1, 수관 반지름 1 (인스턴스에서 [반지름, 높이, 반지름] 으로 늘림). 꼭짓점 색 = 아래 어둡고 위 밝게 (그늘 흉내)
  const hsh = (x, y, z) => { const s = Math.sin(x * 12.99 + y * 78.23 + z * 37.72) * 43758.5; return s - Math.floor(s); };
  function shade(geo, trunkTop) {
    const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), tr = y < trunkTop && Math.hypot(p.getX(i), p.getZ(i)) < 0.09;
      const k = tr ? 0.42 : (0.6 + 0.55 * Math.max(0, Math.min(1, (y - trunkTop) / (1 - trunkTop)))) * (0.84 + 0.3 * hsh(p.getX(i) * 5, y * 9, p.getZ(i) * 5));
      c[i * 3] = tr ? k * 1.1 : k; c[i * 3 + 1] = tr ? k * 0.85 : k; c[i * 3 + 2] = tr ? k * 0.7 : k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
  }
  function merge(parts) {
    parts = parts.map(g => g.index ? g.toNonIndexed() : g);
    let nv = 0; parts.forEach(g => nv += g.attributes.position.count);
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3); let o = 0;
    for (const g of parts) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P.subarray(0, o * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(N.subarray(0, o * 3), 3)); return g;
  }
  const trunk = h => { const g = new THREE.CylinderGeometry(0.04, 0.065, h, 6, 1, true); g.translate(0, h / 2, 0); return g; };
  // 활엽수: 울퉁불퉁한 공 두 개
  const _n = new V3();
  let BD = 2;
  const blob = (r, ry, x, y, z, seed) => { const g = new THREE.IcosahedronGeometry(1, BD), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), k = 1 + 0.16 * (hsh(vx * 3 + seed, vy * 3, vz * 3) - 0.5) + 0.1 * Math.sin(vx * 7 + seed) * Math.cos(vz * 6);
      p.setXYZ(i, vx * r * k + x, vy * ry * k + y, vz * r * k + z); }
    // 부드러운 노멀: 타원체 법선 (단위 높이로 늘어날 것을 감안해 세로를 조금 키움)
    const nm = g.attributes.normal; for (let i = 0; i < p.count; i++) { _n.set((p.getX(i) - x) / r, (p.getY(i) - y) / ry * 1.6, (p.getZ(i) - z) / r).normalize(); nm.setXYZ(i, _n.x, _n.y, _n.z); }
    return g; };
  // 거리별 3단계 (가까이: 덩이 3개 세밀 / 중간: 덜 세밀 / 멀리: 덩이 1개)
  const decG = () => shade(merge([trunk(0.42), blob(1.0, 0.36, 0, 0.62, 0, 1), blob(0.7, 0.26, 0.3, 0.82, -0.2, 2), blob(0.66, 0.24, -0.35, 0.56, 0.25, 7)]), 0.32);
  const conG = () => shade(merge([trunk(0.66), blob(0.82, 0.15, 0.05, 0.84, 0, 3), blob(0.55, 0.12, 0.38, 0.93, 0.25, 4), blob(0.5, 0.12, -0.34, 0.76, -0.28, 5), blob(0.42, 0.1, -0.1, 0.66, 0.4, 6)]), 0.62);
  // 조림지 침엽수 (낙엽송·리기다소나무 등): 층층이 쌓인 뾰족한 원뿔
  const cone = (r, y0, y1, seg, seed) => { const g = new THREE.ConeGeometry(r, y1 - y0, seg, 2, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vz = p.getZ(i), k = 1 + 0.22 * (hsh(vx * 4 + seed, p.getY(i) * 5, vz * 4) - 0.5); p.setX(i, vx * k); p.setZ(i, vz * k); }
    g.translate(0, (y0 + y1) / 2, 0); g.computeVertexNormals(); return g; };
  const conifG = seg => shade(merge([trunk(0.32), cone(0.95, 0.22, 0.62, seg, 1), cone(0.72, 0.42, 0.82, seg, 2), cone(0.46, 0.62, 1.0, seg, 3)]), 0.24);
  const GEO = [[], [], [], []];
  for (const bd of LOWQ ? [1, 1, 0] : [2, 1, 0]) { BD = bd; GEO[0].push(decG()); GEO[1].push(conG()); GEO[2].push(shade(merge([blob(1, 0.5, 0, 0.45, 0, 8), blob(0.7, 0.4, 0.4, 0.4, 0.3, 9)]), 0)); GEO[3].push(conifG(bd === 2 ? 10 : bd === 1 ? 7 : 5)); }
  BD = 0; GEO[0][2] = shade(merge([trunk(0.42), blob(1.05, 0.38, 0, 0.64, 0, 1)]), 0.32); GEO[1][2] = shade(merge([trunk(0.66), blob(0.9, 0.17, 0, 0.83, 0, 3)]), 0.62);
  // 소나무: 곧은 줄기 위에 납작하고 불규칙한 수관 덩이 (한국 산지 소나무 형태)
  const mt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  // 구역(120 m) 별로 나눠 화면 밖 구역은 그리지 않음
  const CH = 120, groups = new Map(), GRID = new Map(), GC = 10, CHUNKS = [];
  // 숲길 위 나무 빼기 (격자로 빠르게)
  const skip = new Uint8Array(n);
  if (FLANE) { const LG = new Map(); for (const p of FLANE.clear) { const k = Math.floor(p[0] / 8) + ',' + Math.floor(p[1] / 8); if (!LG.has(k)) LG.set(k, []); LG.get(k).push(p); }
    for (let i = 0; i < n; i++) { const d = i16[i * 4] / 10, s = i16[i * 4 + 1] / 10, gd = Math.floor(d / 8), gs = Math.floor(s / 8);
      for (let a = gd - 1; a <= gd + 1 && !skip[i]; a++) for (let b = gs - 1; b <= gs + 1; b++) { const L = LG.get(a + ',' + b); if (L && L.some(p => Math.hypot(p[0] - d, p[1] - s) < FLANE.R)) { skip[i] = 1; break; } } } }
  if (LOWQ) for (let i = 0; i < n; i++) if (hsh(i16[i * 4], i16[i * 4 + 1], 9) < 0.35) skip[i] = 1;   // 모바일: 나무 35% 줄임
  for (let i = 0; i < n; i++) {
    if (skip[i]) continue;
    const d = i16[i * 4] / 10, s = i16[i * 4 + 1] / 10, key = Math.floor(d / CH) + ',' + Math.floor(s / CH) + ',' + u8[i * 4 + 3];
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(i);
  }
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new V3(0, 1, 0), SCV = new V3(), col = new THREE.Color();
  const pos = new Float32Array(n * 3), dim = new Float32Array(n * 2), _a = new V3(), REF = new Int32Array(n * 2);   // REF: 나무 i -> (조각, 인스턴스 번호)
  for (const [key, ids] of groups) {
    const kind = +key.split(',')[2];
    const view = G0 => { const g = new THREE.BufferGeometry(); for (const a in G0.attributes) g.setAttribute(a, G0.attributes[a]); return g; };   // 꼭짓점 버퍼는 공유, 경계 구만 구역별
    const geos = GEO[kind].map(view), geo = geos[2];
    const im = new THREE.InstancedMesh(geo, mt, ids.length), bb = new THREE.Box3();
    ids.forEach((i, k) => {
      const d = i16[i * 4] / 10, s = i16[i * 4 + 1] / 10, h = i16[i * 4 + 2] / 10, r = i16[i * 4 + 3] / 10;
      const w = W(d, s, 0); w.y = Math.min(w.y, terrainAt(w.x + r * 0.4, w.z), terrainAt(w.x - r * 0.4, w.z), terrainAt(w.x, w.z + r * 0.4), terrainAt(w.x, w.z - r * 0.4)) - 0.2;
      Q.setFromAxisAngle(Y, hsh(d, s, 1) * 6.283); SCV.set(r * 1.4 * (0.9 + 0.2 * hsh(s, d, 2)), h, r * 1.4 * (0.9 + 0.2 * hsh(d, d, 3)));
      M4.compose(w, Q, SCV); im.setMatrixAt(k, M4); REF[i * 2] = CHUNKS.length; REF[i * 2 + 1] = k;
      col.setRGB(u8[i * 4] / 255 * 0.92, u8[i * 4 + 1] / 255 * 0.86, u8[i * 4 + 2] / 255 * 0.8).convertSRGBToLinear(); im.setColorAt(k, col);
      bb.expandByPoint(w); bb.expandByPoint(_a.set(w.x, w.y + h, w.z));
      pos[i * 3] = w.x; pos[i * 3 + 1] = w.y; pos[i * 3 + 2] = w.z; dim[i * 2] = h; dim[i * 2 + 1] = r * 1.24;
      const gk = Math.floor(w.x / GC) + ',' + Math.floor(w.z / GC); if (!GRID.has(gk)) GRID.set(gk, []); GRID.get(gk).push(i | (kind << 24));
    });
    bb.expandByScalar(4); const sph = bb.getBoundingSphere(new THREE.Sphere()); geos.forEach(g => { g.boundingSphere = sph; g.boundingBox = bb; });
    CHUNKS.push({ im, geos, c: sph.center, r: sph.radius, lod: 2 });
    im.castShadow = !LOWQ; im.receiveShadow = !LOWQ; im.frustumCulled = true; im.userData.irBase = 0.13; scene.add(im);
  }
  // 충돌: 줄기(캡슐) + 수관(세로 캡슐, 침엽수는 원뿔이라 위로 갈수록 가늘게)
  function col1(p, Rr) {
    const gx = Math.floor(p.x / GC), gz = Math.floor(p.z / GC); let best = null;
    for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const L = GRID.get(ix + ',' + iz); if (!L) continue;
      for (const v of L) {
        const i = v & 0xffffff, kind = v >> 24, x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], h = dim[i * 2], r = dim[i * 2 + 1];
        if (p.y > y + h + Rr || p.y < y - Rr) continue;
        const dx = p.x - x, dz = p.z - z, hd = Math.hypot(dx, dz); if (hd > r + Rr) continue;
        // 높이별 반지름
        const t = (p.y - y) / h;
        const c0 = kind === 1 ? 0.82 : kind === 2 ? 0.45 : 0.62, hh = kind === 1 ? 0.2 : kind === 2 ? 0.5 : 0.38;   // 수관 중심 높이 · 반높이 (비율)
        const rr = kind === 3 ? Math.max(t < 0.22 ? 0.12 : 0, t >= 0.22 && t <= 1 ? r * 0.95 * (1 - (t - 0.22) / 0.78) : 0)   // 원뿔
          : Math.max(t < c0 ? 0.12 : 0, r * Math.sqrt(Math.max(0, 1 - Math.pow((t - c0) / hh, 2))));
        const pen = rr + Rr - hd; if (pen <= 0) continue;
        if (!best || pen > best.pen) best = { pen, n: hd > 1e-4 ? new V3(dx / hd, 0, dz / hd) : new V3(1, 0, 0), tag: 'tree' };
      }
    }
    return best;
  }
  // 카메라 거리로 세밀도 바꿈 (0.3 초마다)
  function lod(cam) {
    for (const k of CHUNKS) { const d = Math.max(0, cam.distanceTo(k.c) - k.r * 0.7), l = d < (LOWQ ? 50 : 90) ? 0 : d < (LOWQ ? 170 : 300) ? 1 : 2;
      if (l !== k.lod) { k.lod = l; k.im.geometry = k.geos[l]; } }
  }
  setInterval(() => lod(camera.position), 300);
  // 산불: 불난 자리 나무를 그을린 앙상한 줄기로 (숲에 구멍이 나서 위에서 불길이 보이게) · 임무가 바뀌면 되돌림
  const BURNT = [], _m = new THREE.Matrix4(), _p = new V3(), _q = new THREE.Quaternion(), _s = new V3(), _c = new THREE.Color();
  function scorch(p, R) {
    const gx = Math.floor(p.x / GC), gz = Math.floor(p.z / GC), g = Math.ceil(R / GC);
    for (let ix = gx - g; ix <= gx + g; ix++) for (let iz = gz - g; iz <= gz + g; iz++) { const L = GRID.get(ix + ',' + iz); if (!L) continue;
      for (const v of L) { const i = v & 0xffffff; if (Math.hypot(pos[i * 3] - p.x, pos[i * 3 + 2] - p.z) > R || BURNT.some(b => b.i === i)) continue;
        const ch = CHUNKS[REF[i * 2]], k = REF[i * 2 + 1], im = ch.im; im.getMatrixAt(k, _m); const m0 = _m.clone(); im.getColorAt(k, _c); const c0 = _c.clone();
        _m.decompose(_p, _q, _s); _s.x *= 0.22; _s.z *= 0.22; _s.y *= 0.8; _m.compose(_p, _q, _s); im.setMatrixAt(k, _m); im.setColorAt(k, _c.setRGB(0.035, 0.03, 0.025));
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; BURNT.push({ i, im, k, m0, c0, r0: dim[i * 2 + 1] }); dim[i * 2 + 1] *= 0.25; } }
  }
  function unscorch() { for (const b of BURNT) { b.im.setMatrixAt(b.k, b.m0); b.im.setColorAt(b.k, b.c0); b.im.instanceMatrix.needsUpdate = true; if (b.im.instanceColor) b.im.instanceColor.needsUpdate = true; dim[b.i * 2 + 1] = b.r0; } BURNT.length = 0; }
  function hideRect(cx, cz, ux, uz, L, Wd) {   // 활주로 띠 안의 나무를 없앰 (영구)
    let n0 = 0; const R = Math.hypot(L, Wd) / 2, gx = Math.floor(cx / GC), gz = Math.floor(cz / GC), g = Math.ceil(R / GC);
    for (let ix = gx - g; ix <= gx + g; ix++) for (let iz = gz - g; iz <= gz + g; iz++) { const Lc = GRID.get(ix + ',' + iz); if (!Lc) continue;
      for (const v of Lc) { const i = v & 0xffffff, dx = pos[i * 3] - cx, dz = pos[i * 3 + 2] - cz, t = dx * ux + dz * uz, w = -dx * uz + dz * ux;
        if (Math.abs(t) > L / 2 || Math.abs(w) > Wd / 2 || dim[i * 2] === 0) continue;
        const ch = CHUNKS[REF[i * 2]], k = REF[i * 2 + 1]; ch.im.getMatrixAt(k, _m); _m.decompose(_p, _q, _s); _s.set(0.0001, 0.0001, 0.0001); _m.compose(_p, _q, _s); ch.im.setMatrixAt(k, _m); ch.im.instanceMatrix.needsUpdate = true; dim[i * 2] = 0; dim[i * 2 + 1] = 0; n0++; } }
    return n0;
  }
  return { n, col: col1, lod, scorch, unscorch, hideRect };
})();
if (CRS_C) { for (const [d, s] of CRS_C.cones) buildCone(W(d, s, 0)); }
else { buildLogoPanel(); buildFlag(); for (let d = 10; d <= 300; d += 15) for (const s of [-15, 15]) buildCone(W(d, s, 0)); }
