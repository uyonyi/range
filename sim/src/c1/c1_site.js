// ---- 기체 형상: X2D 형상과 별도로 굵은 팔·스키드·큰 프롭 ----
// 정적 메시 묶기: 같은 그룹의 단색 메시들을 꼭짓점 색이 든 한 메시로 (드로우콜 ↓ · Quest 성능)
function c1Bake(G0, list, opt) {
  opt = opt || {}; const P = [], N = [], C = [], col = new THREE.Color(), m4 = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new V3(), n = new V3();
  G0.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(G0.matrixWorld).invert(); let cast = false, recv = false;
  for (const o of list) {
    let g = o.geometry; if (g.index) g = g.toNonIndexed();
    o.updateMatrixWorld(true); m4.multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(m4);
    const pa = g.attributes.position, na = g.attributes.normal; if (opt.white || !o.material.color) col.set(0xffffff); else col.copy(o.material.color);
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m4); P.push(v.x, v.y, v.z); if (na) { n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N.push(n.x, n.y, n.z); } else N.push(0, 1, 0); C.push(col.r, col.g, col.b); }
    cast = cast || !!o.castShadow; recv = recv || !!o.receiveShadow; if (o.parent) o.parent.remove(o);
  }
  if (!P.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  const mt = opt.basic ? new THREE.MeshBasicMaterial(Object.assign({ vertexColors: true }, opt.mat || {})) : new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.75, metalness: 0 }, opt.mat || {}));
  const m = new THREE.Mesh(g, mt); m.castShadow = cast && opt.shadow !== false; m.receiveShadow = recv; m.name = opt.name || 'baked'; G0.add(m); return m;
}
const _c1glow = {};
function c1GlowMat(col) {
  if (_c1glow[col]) return _c1glow[col];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = (col >> 16) & 255, gg = (col >> 8) & 255, b = col & 255;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${(r + 255) >> 1},${(gg + 255) >> 1},${(b + 255) >> 1},0.95)`); gr.addColorStop(0.3, `rgba(${r},${gg},${b},0.85)`); gr.addColorStop(0.6, `rgba(${r},${gg},${b},0.25)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
  return (_c1glow[col] = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
}
// 수술 흐름: 바람 + 기체 하강풍. 하강풍은 기체 아래로 내려와 땅에서 옆으로 퍼짐 (움직이면 뒤로 밀려 꼬리처럼 남음)
const _c1fl = new V3();
function c1Flow(p) {
  const w = c1Wind(p), f = _c1fl.set(w.x || 0, 0, w.z || 0); let down = 0;
  if ((S.state === 'run' || S.state === 'pause') && C1.armed && DR.thrust > 0) {
    const hh = DR.p.y - p.y;
    if (hh > -0.5 && hh < 14) {
      const tdown = Math.max(0, hh) / 7, cx = DR.p.x - DR.v.x * tdown + (w.x || 0) * tdown, cz = DR.p.z - DR.v.z * tdown + (w.z || 0) * tdown;   // 하강풍이 내려오는 동안 기체는 지나가고 바람에 밀림
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), r = 1.0 + 0.22 * Math.max(0, hh);
      const S0 = 11 * clamp(DR.thrust * 2, 0, 1.6) / (1 + Math.pow(Math.max(0, hh) / 4.5, 2));   // 하강풍 세기 (m/s)
      const out = d < r ? S0 * (d / r) * 0.6 : S0 * (r / d) * Math.exp(-(d - r) / 4);   // 기둥 안: 아래로 · 밖: 옆으로 퍼짐
      if (d > 0.01) { f.x += dx / d * out; f.z += dz / d * out; }
      down = d < r ? S0 * (1 - d / r) : 0;
    }
  }
  f.y = down; return f;
}
function c1RibbonTick() {
  const t = S.simT, all = C1.ribbons; if (!all || !all.length || !C1G) return;
  if (!C1.ribMesh) {   // 모든 수술을 한 메시로 (스트립 1장 = 꼭짓점 4개)
    let n = 0; all.forEach(r => n += r.strips.length);
    const g = new THREE.BufferGeometry(), C = new Float32Array(n * 12); let ci = 0;
    all.forEach(r => r.strips.forEach(st => { for (let k = 0; k < 4; k++) { C[ci++] = st.col.r; C[ci++] = st.col.g; C[ci++] = st.col.b; } }));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 12), 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    const idx = []; for (let q = 0; q < n; q++) { const b = q * 4; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 })); m.castShadow = true; m.frustumCulled = false; m.name = 'c1ribbons'; C1G.add(m); C1.ribMesh = m;
  }
  const pa = C1.ribMesh.geometry.attributes.position, na = C1.ribMesh.geometry.attributes.normal, PA = pa.array, NA = na.array; let q = 0;
  const w = 0.035, L = 0.7;
  for (const rb of all) {
    const f = c1Flow(rb.top), sp = Math.hypot(f.x, f.z), yaw = Math.atan2(-f.x, -f.z);
    rb.sp = (rb.sp == null ? sp : rb.sp + (sp - rb.sp) * 0.25); rb.yaw = rb.yaw == null ? yaw : rb.yaw + Math.atan2(Math.sin(yaw - rb.yaw), Math.cos(yaw - rb.yaw)) * 0.3;
    const lift = (Math.PI / 2) * (1 - Math.exp(-rb.sp / 3.2)) * (1 - Math.min(0.6, f.y / 10)), tur = 0.05 + 0.3 * Math.min(1, rb.sp / 6) + Math.min(0.6, f.y / 8);
    for (const st of rb.strips) {
      const y = rb.yaw + st.off * (0.25 + 0.6 * Math.exp(-rb.sp / 2)) + Math.sin(t * st.f * 0.6 + st.ph) * tur * 0.6, a = lift + Math.sin(t * st.f + st.ph) * tur * 0.5;
      const cy = Math.cos(y), sy = Math.sin(y), ca = Math.cos(a), sa = Math.sin(a);
      // 아래 끝: X 회전(a) → Y 회전(y) → 꼭대기 위치
      const by = -L * ca, bz = -L * sa, bx0 = bz * sy, bz0 = bz * cy;   // (0, -L cos a, -L sin a) 를 yaw 회전
      const wx = w * cy, wz = -w * sy;   // 폭 방향 (w, 0, 0) 을 yaw 회전
      const o = q * 12, T = rb.top;
      PA[o] = T.x - wx; PA[o + 1] = T.y; PA[o + 2] = T.z - wz;  PA[o + 3] = T.x + wx; PA[o + 4] = T.y; PA[o + 5] = T.z + wz;
      PA[o + 6] = T.x - wx + bx0; PA[o + 7] = T.y + by; PA[o + 8] = T.z - wz + bz0;  PA[o + 9] = T.x + wx + bx0; PA[o + 10] = T.y + by; PA[o + 11] = T.z + wz + bz0;
      const nx = ca * sy, ny = -sa, nz = ca * cy;   // (0, -sin a, cos a) 를 yaw 회전
      for (let k = 0; k < 4; k++) { NA[o + k * 3] = nx; NA[o + k * 3 + 1] = ny; NA[o + k * 3 + 2] = nz; }
      q++;
    }
  }
  pa.needsUpdate = true; na.needsUpdate = true;
}
// 항법등 크기: 화면에서 최소 몇 픽셀로 보이게 (멀리 있어도 점으로 보임)
const _c1cp = new V3();
function c1NavTick() {
  const m = typeof droneM !== 'undefined' && droneM && droneM.nav; if (!m || !m.length) return;
  const cam = (typeof c1VRon === 'function' && c1VRon() && C1XR.cam) ? C1XR.cam : camera, cp = cam === camera ? camera.position : _c1cp.setFromMatrixPosition(cam.matrixWorld), d = Math.max(0.5, cp.distanceTo(DR.p));
  const H = (renderer.domElement.clientHeight || 720), px = 2 * d * Math.tan((cam.fov || 50) * DEG / 2) / H;   // 1 px 의 실제 크기 (m)
  const on = typeof lightOn === 'function' && lightOn(), t = S.simT || 0, live = S.state !== 'menu';
  for (const n of m) {
    let sz = Math.max(n.strobe ? 0.22 : 0.12, px * (on ? 8 : 5.5)), vis = live;
    if (n.strobe) { const ph = t % 1.2; vis = live && on && (ph < 0.06 || (ph > 0.16 && ph < 0.22)); sz = Math.max(0.3, px * 11); }
    n.sp.visible = vis; n.sp.scale.set(sz, sz, 1);
  }
}
function makeC1(ghost) {
  const K = partsKit(ghost);
  const body = K.m(mat(0x8a9098, { roughness: 0.55 })), arm = K.m(mat(0xd9dde1, { roughness: 0.5 })), mot = K.m(mat(0x808890, { roughness: 0.35, metalness: 0.6 })), skid = K.m(mat(0x2a2c30, { roughness: 0.6 }));
  K.add(UBOX, body, 0, 0.02, 0, 0.42, 0.16, 0.42); K.add(UBOX, K.m(mat(0xd8dde2, { roughness: 0.5 })), 0, 0.12, 0, 0.3, 0.05, 0.3);
  K.add(UBOX, K.m(mat(0xd04040)), 0, 0.06, -0.22, 0.12, 0.05, 0.04);   // 기수 표시 (빨강)
  const props = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.sin(a) * 0.78, z = -Math.cos(a) * 0.78;
    const am = K.add(UBOX, arm, x / 2, 0.04, z / 2, 0.06, 0.05, 0.78); am.rotation.y = -a;
    K.add(UCYL, mot, x, 0.1, z, 0.06, 0.1, 0.06);
    props.push(propHub(K, x, 0.16, z, 0.36, 2, true, 0x18191b));
  }
  for (const x of [-0.45, 0.45]) {
    K.add(UBOX, skid, x, -0.29, 0, 0.035, 0.03, 1.1);
    for (const z of [-0.25, 0.25]) { const l = K.add(UBOX, skid, x * 0.7, -0.14, z, 0.03, 0.3, 0.03); l.rotation.z = x > 0 ? 0.45 : -0.45; }
  }
  { const stat = K.g.children.filter(o => o.isMesh); c1Bake(K.g, stat, ghost ? { basic: true, white: true, mat: { color: 0x55e6ff, transparent: true, opacity: 0.38, depthWrite: false }, shadow: false, name: 'c1body' } : { mat: { roughness: 0.5, metalness: 0.15 }, name: 'c1body' }); }
  const leds = [K.add(UBOX, K.LM(0xff2a2a), -0.1, -0.06, -0.21, 0.03, 0.02, 0.02), K.add(UBOX, K.LM(0x2aff4a), 0.1, -0.06, -0.21, 0.03, 0.02, 0.02)];
  // 항법등: 앞 두 팔 끝 초록 · 뒤 두 팔 끝 빨강 (계속 켜짐) · 조명 켜면 위 흰색 섬광 — 멀리서도 기수 방향 파악
  const nav = [];
  if (!ghost) {
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2, x = Math.sin(a) * 0.8, z = -Math.cos(a) * 0.8, front = z < 0;
      const sp = new THREE.Sprite(c1GlowMat(front ? 0x30ff60 : 0xff3030)); sp.position.set(x, 0.0, z); K.g.add(sp); nav.push({ sp, front }); }
    const sb = new THREE.Sprite(c1GlowMat(0xffffff)); sb.position.set(0, 0.2, 0.05); K.g.add(sb); nav.push({ sp: sb, strobe: true });
  }
  return { g: K.g, props, leds, cans: [], nav };
}

// ---- 시험장 (평탄 · 지형과 떨어진 곳) ----
var C1G = null;   // var: 초기화 전 호출돼도 오류 없게
function c1Label(t, col, sz) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = col || '#fff'; g.font = 'bold 96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 64, 70);
  const tx = new THREE.CanvasTexture(c); const m = new THREE.Mesh(new THREE.PlaneGeometry(sz || 1.4, sz || 1.4), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
  m.rotation.set(-Math.PI / 2, 0, -C1S.h); return m;
}
function c1Site() {
  if (C1G) return C1G;
  const G0 = new THREE.Group(); C1G = G0; scene.add(G0); G0.visible = false;
  if (!C1S.real) {   // 지형과 떨어진 독립 시험장일 때만 넓은 바닥
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gg = gc.getContext('2d');
  gg.fillStyle = '#6d8a4a'; gg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { gg.fillStyle = `rgba(${40 + Math.random() * 60 | 0},${70 + Math.random() * 70 | 0},${30 + Math.random() * 30 | 0},0.35)`; gg.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(900, 900); gt.encoding = THREE.sRGBEncoding; gt.anisotropy = 4;
  // 아주 큰 삼각형은 깊이 정밀도가 떨어져 위의 표지를 덮으므로 잘게 나누고 살짝 아래·뒤로 밀어 둠
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(18000, 18000, 90, 90), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 }));
  ground.rotation.x = -Math.PI / 2; ground.position.copy(c1W(0, 30, -0.03)); ground.receiveShadow = true; G0.add(ground);
  }
  // 시험 구역 (짧게 깎은 잔디)
  const fld = new THREE.Mesh(new THREE.PlaneGeometry(C1FIELD.u1 - C1FIELD.u0, C1FIELD.v1 - C1FIELD.v0), new THREE.MeshStandardMaterial({ color: 0x7f9b56, roughness: 1 }));
  fld.rotation.set(-Math.PI / 2, 0, -C1S.h); fld.material.polygonOffset = true; fld.material.polygonOffsetFactor = -1; fld.position.copy(c1W((C1FIELD.u0 + C1FIELD.u1) / 2, (C1FIELD.v0 + C1FIELD.v1) / 2, 0.003)); fld.receiveShadow = true; G0.add(fld);
  // 바닥 선은 전부 한 LineSegments 로 (투명도는 잔디색과 섞어 표현)
  const LP = [], LC = [], GRASS = new THREE.Color(0x7f9b56), _lc = new THREE.Color();
  const line = (pts, col, op) => { _lc.set(col).lerp(GRASS, 1 - (op || 1)); for (let i = 0; i < pts.length - 1; i++) { LP.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z); LC.push(_lc.r, _lc.g, _lc.b, _lc.r, _lc.g, _lc.b); } };
  const F = C1FIELD; line([c1W(F.u0, F.v0, 0.02), c1W(F.u1, F.v0, 0.02), c1W(F.u1, F.v1, 0.02), c1W(F.u0, F.v1, 0.02), c1W(F.u0, F.v0, 0.02)], 0xffffff, 0.8);
  // 안전라인 (조종자 어깨와 평행) · 권고 안전거리 원 14 m
  line([c1W(F.u0, 0.6, 0.02), c1W(F.u1, 0.6, 0.02)], 0xffd040, 0.9);
  { const pts = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts.push(c1W(Math.sin(a) * 14, Math.cos(a) * 14, 0.02)); } line(pts, 0xffd040, 0.35); }
  // 중심선 P–E, B–D 점선
  const dash = (a, b, col) => { const n = Math.max(2, Math.round(a.distanceTo(b) / 1.2)); for (let i = 0; i < n; i += 2) line([a.clone().lerp(b, i / n), a.clone().lerp(b, Math.min(1, (i + 1) / n))], col, 0.6); };
  dash(c1W(0, 0, 0.02), c1W(0, 62.5, 0.02), 0xffffff); dash(c1W(-7.5, 22.5, 0.02), c1W(7.5, 22.5, 0.02), 0xffffff);
  { const pts = []; for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2; pts.push(c1W(Math.sin(a) * 7.5, 22.5 + Math.cos(a) * 7.5, 0.02)); } line(pts, 0xffffff, 0.45); }
  // 착륙장 H·F (2×2 m)
  const pad = (uv, t, col) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 })); m.rotation.set(-Math.PI / 2, 0, -C1S.h); m.material.polygonOffset = true; m.material.polygonOffsetFactor = -2; m.position.copy(c1W(uv[0], uv[1], 0.01)); m.receiveShadow = true; G0.add(m);
    line([c1W(uv[0] - 1, uv[1] - 1, 0.015), c1W(uv[0] + 1, uv[1] - 1, 0.015), c1W(uv[0] + 1, uv[1] + 1, 0.015), c1W(uv[0] - 1, uv[1] + 1, 0.015), c1W(uv[0] - 1, uv[1] - 1, 0.015)], 0xffffff, 1);
    const l = c1Label(t, '#ffffff', 1.5); l.position.copy(c1W(uv[0], uv[1], 0.02)); G0.add(l);
  };
  pad(C1PT.H, 'H', 0x3a4048); pad(C1PT.FB, 'F', 0x8a3030); pad(C1PT.FD, 'F', 0x8a3030);
  // 지점 표지 (A·B·C·D·E 원판 + 글자) · 조종자 P
  const cone = mat(0xff8a1e, { roughness: 0.7 });
  for (const k of ['A', 'B', 'C', 'D', 'E', 'P']) {
    const uv0 = C1PT[k], uv = k === 'P' ? uv0 : [uv0[0] + 1.3, uv0[1]], d = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshStandardMaterial({ color: k === 'P' ? 0x2e6bd6 : 0xf0f0f0, roughness: 0.9 }));
    d.rotation.x = -Math.PI / 2; d.position.copy(c1W(uv[0], uv[1], 0.012)); G0.add(d);
    const l = c1Label(k, k === 'P' ? '#ffffff' : '#222', 1.0); l.position.copy(c1W(uv[0], uv[1], 0.02)); G0.add(l);
    if (k !== 'P') c1Cone(G0, uv0, cone);   // 지점 위 고깔 + 리본 (기체가 바로 위에 오면 바람에 눌림)
  }
  // 바람 자루 (풍향 참고)
  const pole = new THREE.Mesh(UCYL, mat(0xdddddd)); pole.scale.set(0.04, 4, 0.04); pole.position.copy(c1W(-16, 10, 2)); G0.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.4, 10, 1, true), mat(0xff6020, { side: THREE.DoubleSide })); sock.position.copy(c1W(-16, 10, 3.9)); G0.add(sock); C1.sock = sock;
  if (!C1S.real) {
  // 주변 나무 (깊이 감각용 · 배치 임의)
  const tm = mat(0x3c5e2c), trk = mat(0x5a4632); let sd = 7;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 260, u = Math.sin(a) * r, v = 30 + Math.cos(a) * r, h = 6 + rnd() * 8;
    const t = new THREE.Mesh(UCYL, trk); t.scale.set(0.25, h * 0.4, 0.25); t.position.copy(c1W(u, v, h * 0.2)); G0.add(t);
    const c = new THREE.Mesh(new THREE.ConeGeometry(h * 0.28, h * 0.8, 8), tm); c.position.copy(c1W(u, v, h * 0.55)); c.castShadow = true; G0.add(c);
  }
  }
  c1Props(G0);
  { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(LC, 3)); const ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true })); ls.name = 'c1lines'; G0.add(ls); }
  // 정적 소품 묶기: 입체물(고깔·펜스·천막·나무) 한 메시 · 바닥 표지(패드·원판) 한 메시
  { const keep = new Set([fld, C1.sock]); const flat = [], solid = [];
    for (const o of G0.children.slice()) { if (!o.isMesh || keep.has(o) || !o.material || o.material.map || o.material.transparent || !o.material.isMeshStandardMaterial) continue; (o.material.polygonOffset ? flat : solid).push(o); }
    c1Bake(G0, solid, { name: 'c1solid' }); c1Bake(G0, flat, { mat: { roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }, shadow: false, name: 'c1flat' }); }
  // 학습용 보조 표시: 목표 허용 상자 · 경로 선
  C1.aidBox = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  G0.add(C1.aidBox);
  C1.aidLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]), new THREE.LineBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.85 }));
  C1.aidLine.frustumCulled = false; G0.add(C1.aidLine);
  C1.aidArrow = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 10), new THREE.MeshBasicMaterial({ color: 0xffc828, transparent: true, opacity: 0.85, depthWrite: false })); C1.aidArrow.rotation.x = -Math.PI / 2; G0.add(C1.aidArrow);
  return G0;
}
function c1Cone(G0, uv, cm) {
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 14), cm); c.position.copy(c1W(uv[0], uv[1], 0.25)); c.castShadow = true; G0.add(c);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.1, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })); band.position.copy(c1W(uv[0], uv[1], 0.3)); G0.add(band);
  // 수술(리본 다발): 고깔 위 짧은 막대 끝에 매달림 → 바람 · 기체 하강풍(다운워시)에 날림 (전체 수술은 c1RibbonTick 에서 한 메시로 그림)
  const pole = new THREE.Mesh(UCYL, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 })); pole.scale.set(0.012, 0.75, 0.012); pole.position.copy(c1W(uv[0], uv[1], 0.5 + 0.375)); G0.add(pole);
  const top = c1W(uv[0], uv[1], 1.24), cols = [0xff3b3b, 0xffe14a, 0x3bb0ff, 0xffffff, 0xff3b3b, 0xffe14a, 0x3bb0ff, 0xffffff];
  const strips = cols.map((col, k) => ({ col: new THREE.Color(col), off: (k / cols.length - 0.5) * 0.9, ph: Math.random() * 6, f: 6 + Math.random() * 5 }));
  (C1.ribbons = C1.ribbons || []).push({ strips, uv, top, ph: Math.random() * 6 });
}
// 시험장 소품: 천막·책상·시험위원·응시자·안전펜스 (위치는 앱 설정)
function c1Props(G0) {
  const W2 = (u, v, h) => c1W(u, v, h), mk = (geo, m, u, v, h, sx, sy, sz, ry) => { const o = new THREE.Mesh(geo, m); o.position.copy(W2(u, v, h)); if (sx) o.scale.set(sx, sy, sz); o.rotation.y = -C1S.h + (ry || 0); o.castShadow = true; G0.add(o); return o; };
  // 안전펜스 (조종자 앞 기준선 · 높이 1 m)
  const post = mat(0xff7a1a, { roughness: 0.6 }), rope = mat(0xf2f2f2, { roughness: 0.8 });
  for (let u = -17.5; u <= 17.5; u += 3.5) if (Math.abs(u) > 1) mk(UCYL, post, u, 1.2, 0.5, 0.035, 1, 0.035);   // 조종자 바로 앞은 비움
  for (const h of [0.55, 0.95]) mk(UBOX, rope, 0, 1.2, h, 35, 0.015, 0.015);
  // 천막 (대기·시험위원석)
  const tw = mat(0xf4f4f0, { roughness: 0.7 }), tb = mat(0x2b5fb3, { roughness: 0.7 }), leg = mat(0x9aa0a6, { roughness: 0.4, metalness: 0.5 });
  for (const [u, v] of [[-12, -6], [-6, -6], [-12, -11], [-6, -11]]) mk(UCYL, leg, u, v, 1.25, 0.04, 2.5, 0.04);
  mk(UBOX, tw, -9, -8.5, 2.55, 6.4, 0.12, 5.4); const roof = mk(new THREE.ConeGeometry(4.3, 1.1, 4), tb, -9, -8.5, 3.15, 1, 1, 1, Math.PI / 4); roof.scale.set(1.05, 1, 0.88);
  mk(UBOX, tw, -9, -7.2, 0.75, 2.4, 0.05, 0.8); for (const u of [-10, -8]) mk(UCYL, leg, u, -7.2, 0.37, 0.03, 0.74, 0.03);
  // 조종자 인형 (3인칭 시점에서만 보임)
  const person = (u, v, vest, sit) => { const g = new THREE.Group(); g.position.copy(W2(u, v, 0)); g.rotation.y = -C1S.h; G0.add(g);
    const body = new THREE.Mesh(UCYL, mat(0x2d3640)); body.scale.set(0.2, 0.75, 0.15); body.position.y = 0.38 + 0.45; g.add(body);
    const top = new THREE.Mesh(UBOX, mat(vest)); top.scale.set(0.42, 0.6, 0.26); top.position.y = 1.2; g.add(top);
    const head = new THREE.Mesh(USPH || UCYL, mat(0xe2b897)); head.scale.setScalar(0.12); head.position.y = 1.62; g.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf5f5f5)); cap.position.y = 1.64; g.add(cap);
    g.traverse(o => { o.castShadow = true; }); return g; };
  C1.pilotFig = person(0, -0.15, 0xff8a1e);
}
// 메뉴·출격 시 시험장 보이기/감추기
function c1Menu(k) {
  if (!C1) return;
  const on = isC1(k);
  if (on) c1Site();
  if (C1G) C1G.visible = on;
  // 시험장에서 안 쓰는 코스 시설물(게이트·벙커·숲길 등)은 감춤 → 드로우콜 ↓ (메뉴로 나가면 복구)
  if (on && !C1.hidObj) { C1.hidObj = []; const c = c1W(0, 30, 0); for (const id in OBJ) { const g = OBJ[id] && OBJ[id].g; if (g && g.visible && g.position.distanceTo(c) > 60) { g.visible = false; C1.hidObj.push(g); } }
    if (typeof FLANE !== 'undefined' && FLANE && FLANE.G && FLANE.G.visible) { FLANE.G.visible = false; C1.hidObj.push(FLANE.G); } }
  if (!on && C1.hidObj) { C1.hidObj.forEach(g => { g.visible = true; }); C1.hidObj = null; }
  if (!on) { if (C1.on || C1.sun) { SUN_DIR.copy(SUN0); C1.sun = null; } C1.on = false; C1.demo = false; const b = $('c1demo'); if (b) b.classList.add('hidden'); const g = $('c1g'); if (g) g.classList.add('hidden'); const na = $('c1p'); if (na) na.classList.add('hidden'); }
  C1ON = on && !C1S.real;
  const p = $('c1p'); if (p && (!on || S.state === 'menu' || S.state === 'result')) p.classList.add('hidden');
  if (ui.map) ui.map.style.display = on ? 'none' : '';
  const kh = $('keys'); if (kh) kh.style.display = on ? 'none' : '';
  document.body.classList.toggle('c1on', on && S.state !== 'menu');
}

