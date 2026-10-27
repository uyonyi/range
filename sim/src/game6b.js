
// =====================================================================
//  건물 다듬기: 벽 그림(창문·출입문·골함석·콘크리트 창틀) · 박공 지붕(골함석) · 옥상 난간·물탱크 · 밤에는 창에 불
//   안쪽 = 수치지형도 건물(바닥 사각형·높이) · 바깥 = 임의 마을(민가·가게·창고)
//   모두 재질별로 한 덩어리로 합쳐 그림 (그리기 횟수 ↓) · 충돌은 원래 상자 그대로 (박공 지붕 아래쪽은 상자 추가)
//   + 산 위 이동통신 기지국 철탑 하나
// =====================================================================
const BLD3 = (function buildings3() {
  if (window.SIM_NOBLD3) return null;
  // ---- 벽 그림: 한 칸 = 가로 TW m × 세로 TH m (여러 층이면 세로로 되풀이) ----
  const KIND = ['house', 'shop', 'barn', 'block'], TILE = { house: [12, 3], shop: [6, 6], barn: [6, 3], block: [6, 3] };
  function facade(kind) {
    const [tw, th] = TILE[kind], W = 512, H = Math.round(512 * th / tw / 2) * 2 || 128, c = document.createElement('canvas'), e = document.createElement('canvas'); c.width = e.width = W; c.height = e.height = H;
    const g = c.getContext('2d'), ge = e.getContext('2d'), px = W / tw, py = H / th, R = (x, y, w, h) => [x * px, H - (y + h) * py, w * px, h * py];
    const rnd = rng(kind.length * 977 + 13), noise = (a) => { for (let i = 0; i < W * H / 40; i++) { const v = rnd() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${a * rnd()})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); } };
    ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
    const win = (x, y, w, h, lit, frame) => { g.fillStyle = frame || '#d4d8da'; g.fillRect(...R(x - 0.07, y - 0.07, w + 0.14, h + 0.14)); const gr = g.createLinearGradient(0, H - (y + h) * py, 0, H - y * py); gr.addColorStop(0, '#6f8090'); gr.addColorStop(0.55, '#3a4752'); gr.addColorStop(1, '#2a333b'); g.fillStyle = gr; g.fillRect(...R(x, y, w, h));
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); const [a, b, cw, ch] = R(x, y, w, h); g.moveTo(a + cw * 0.15, b); g.lineTo(a + cw * 0.45, b); g.lineTo(a + cw * 0.15, b + ch * 0.7); g.lineTo(a, b + ch * 0.7); g.lineTo(a, b + ch * 0.2); g.fill();
      g.fillStyle = frame || '#d4d8da'; g.fillRect(...R(x + w / 2 - 0.035, y, 0.07, h));
      if (lit) { ge.fillStyle = lit; ge.fillRect(...R(x, y, w, h)); ge.fillStyle = 'rgba(0,0,0,.35)'; ge.fillRect(...R(x + w / 2 - 0.035, y, 0.07, h)); } };
    if (kind === 'house') {   // 시골 단층 주택: 밝은 미장 벽 · 알루미늄 창 2 · 현관문 · 아래 띠
      g.fillStyle = '#f1ede4'; g.fillRect(0, 0, W, H); noise(0.05);
      g.fillStyle = '#8d8a84'; g.fillRect(...R(0, 0, tw, 0.4));
      win(1.4, 0.95, 1.8, 1.15, '#ffd08a'); win(8.6, 0.95, 1.4, 1.15, null);
      g.fillStyle = '#6b5a48'; g.fillRect(...R(5.2, 0.12, 1.0, 2.05)); g.fillStyle = '#c9c1b4'; g.fillRect(...R(5.12, 2.17, 1.16, 0.08)); g.fillStyle = '#d9b85a'; g.fillRect(...R(6.0, 1.05, 0.07, 0.12));
      const gr = g.createLinearGradient(0, H - 1.2 * py, 0, H); gr.addColorStop(0, 'rgba(90,80,60,0)'); gr.addColorStop(1, 'rgba(90,80,60,.25)'); g.fillStyle = gr; g.fillRect(0, H - 1.2 * py, W, 1.2 * py);
    } else if (kind === 'shop') {   // 가게: 1층 유리 진열창·문 / 2층 창
      g.fillStyle = '#e6e2da'; g.fillRect(0, 0, W, H); noise(0.05);
      g.fillStyle = '#4a4e52'; g.fillRect(...R(0.3, 0.15, 5.4, 2.6));
      const gr = g.createLinearGradient(0, H - 2.6 * py, 0, H - 0.3 * py); gr.addColorStop(0, '#8fa3b2'); gr.addColorStop(1, '#3c4a55'); g.fillStyle = gr; g.fillRect(...R(0.42, 0.3, 5.16, 2.35));
      ge.fillStyle = '#ffe2b0'; ge.fillRect(...R(0.42, 0.3, 5.16, 2.35));
      g.fillStyle = '#4a4e52'; for (const x of [2.1, 3.9]) g.fillRect(...R(x, 0.3, 0.08, 2.35)); g.fillRect(...R(0.42, 2.1, 5.16, 0.06));
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(...R(0.6, 0.4, 0.5, 1.6)); g.fillStyle = '#8b8e90'; g.fillRect(...R(0, 0, tw, 0.15));
      win(1.0, 3.9, 1.6, 1.2, '#ffd08a'); win(3.4, 3.9, 1.6, 1.2, null);
    } else if (kind === 'barn') {   // 창고·축사: 골함석 벽 · 위쪽 채광창 띠
      g.fillStyle = '#c9ccce'; g.fillRect(0, 0, W, H);
      for (let x = 0; x < tw; x += 0.2) { const gr = g.createLinearGradient(x * px, 0, (x + 0.2) * px, 0); gr.addColorStop(0, 'rgba(0,0,0,.14)'); gr.addColorStop(0.5, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(0,0,0,.14)'); g.fillStyle = gr; g.fillRect(x * px, 0, 0.2 * px, H); }
      g.fillStyle = 'rgba(60,60,60,.35)'; g.fillRect(...R(0, 2.55, tw, 0.05)); g.fillStyle = 'rgba(230,240,245,.55)'; g.fillRect(...R(0, 2.62, tw, 0.32));
      const gr = g.createLinearGradient(0, H - 0.9 * py, 0, H); gr.addColorStop(0, 'rgba(110,80,50,0)'); gr.addColorStop(1, 'rgba(110,80,50,.4)'); g.fillStyle = gr; g.fillRect(0, H - 0.9 * py, W, 0.9 * py); noise(0.04);
    } else {   // 콘크리트 건물: 층 띠 · 창 2개 · 판 이음매
      g.fillStyle = '#d2d0ca'; g.fillRect(0, 0, W, H); noise(0.06);
      g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(...R(0, 0, tw, 0.5)); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(...R(0, 2.96, tw, 0.04)); g.fillRect(...R(2.98, 0, 0.04, th));
      win(0.7, 0.95, 1.7, 1.4, '#ffd9a0', '#9aa0a4'); win(3.6, 0.95, 1.7, 1.4, null, '#9aa0a4');
      g.fillStyle = 'rgba(70,60,50,.15)'; g.fillRect(...R(0.7, 0.75, 1.7, 0.2)); g.fillRect(...R(3.6, 0.75, 1.7, 0.2));
    }
    // 가장자리 왼쪽 위 4 px = 민무늬 벽 (박공 세모·옥상에 쓸 자리)
    const t = new THREE.CanvasTexture(c), te = new THREE.CanvasTexture(e); [t, te].forEach(x => { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 4; }); t.encoding = te.encoding = THREE.sRGBEncoding; return { t, te, tw, th };
  }
  const FAC = {}; KIND.forEach(k => FAC[k] = facade(k));
  const roofTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 64);
    for (let x = 16; x < 128; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, 'rgba(0,0,0,.22)'); gr.addColorStop(0.45, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(0,0,0,.22)'); g.fillStyle = gr; g.fillRect(x, 0, 8, 64); }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(16, 31, 112, 2); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; })();
  const FLATUV = [0.05, 0.5];   // 지붕 그림 왼쪽 민무늬 칸
  // ---- 합칠 그릇: 재질마다 위치·법선·uv·색 ----
  const buf = () => ({ p: [], n: [], u: [], c: [], i: [] }), WB = {}, RB = buf(); KIND.forEach(k => WB[k] = buf());
  const _n = new V3(), _e1 = new V3(), _e2 = new V3();
  function tri(B, a, b, c, ua, ub, uc, col, out) { _e1.subVectors(b, a); _e2.subVectors(c, a); _n.crossVectors(_e1, _e2).normalize(); const o = B.p.length / 3;
    if (out && _n.dot(out) < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; _n.negate(); }   // 바깥을 보게 감기 방향 맞춤
    for (const [v, uv] of [[a, ua], [b, ub], [c, uc]]) { B.p.push(v.x, v.y, v.z); B.n.push(_n.x, _n.y, _n.z); B.u.push(uv[0], uv[1]); B.c.push(col.r, col.g, col.b); } B.i.push(o, o + 1, o + 2); }
  function quad(B, a, b, c, d, ua, ub, uc, ud, col, out) { tri(B, a, b, c, ua, ub, uc, col, out); tri(B, a, c, d, ua, uc, ud, col, out); }
  const UPV = new V3(0, 1, 0);
  // 상자 (바닥 중심 x,z · 바닥 y0 · 높이 h · 회전 yaw · 옆면만 또는 윗면까지) → 지붕 그릇(민무늬)
  function boxR(B, x, y0, z, sx, sz, h, yaw, col, top = true) { const c = Math.cos(yaw), s = Math.sin(yaw), P = (u, y, v) => new V3(x + u * c + v * s, y, z - u * s + v * c), F = FLATUV;
    const k = [[-sx / 2, -sz / 2], [sx / 2, -sz / 2], [sx / 2, sz / 2], [-sx / 2, sz / 2]];
    for (let i = 0; i < 4; i++) { const [u0, v0] = k[i], [u1, v1] = k[(i + 1) % 4], out = P((u0 + u1) / 2, 0, (v0 + v1) / 2).sub(P(0, 0, 0)); quad(B, P(u0, y0, v0), P(u0, y0 + h, v0), P(u1, y0 + h, v1), P(u1, y0, v1), F, F, F, F, col, out); }
    if (top) quad(B, P(k[0][0], y0 + h, k[0][1]), P(k[3][0], y0 + h, k[3][1]), P(k[2][0], y0 + h, k[2][1]), P(k[1][0], y0 + h, k[1][1]), F, F, F, F, col, UPV); }
  // ---- 건물 하나: 벽 4면(창 그림) + 지붕 ----
  //  kind: house·barn → 박공 / shop·block → 평지붕+난간 · w: 몸 x 폭, l: 몸 z 길이, yaw: 몸 회전, y0: 벽 아래(땅속), y1: 벽 위
  const _wc = new THREE.Color(), _rc = new THREE.Color(), LIST = [];
  function building(kind, x, z, y0, y1, w, l, yaw, wallHex, roofHex, seed) {
    LIST.push([x, z, kind, w, l, y1 - y0]); const f = FAC[kind], c = Math.cos(yaw), s = Math.sin(yaw), P = (u, y, v) => new V3(x + u * c + v * s, y, z - u * s + v * c), B = WB[kind];
    const fl = Math.max(1, Math.round((y1 - y0 - 0.3) / f.th)), vk = fl / (y1 - y0), u0 = seed * 7.31 % 1;
    _wc.setHex(wallHex); const k = [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]];
    let acc = u0;
    for (let i = 0; i < 4; i++) { const [a0, b0] = k[i], [a1, b1] = k[(i + 1) % 4], L = Math.hypot(a1 - a0, b1 - b0), du = L / f.tw;
      // 바깥에서 볼 때 오른쪽으로 u 가 커지게: 끝 모서리(a1) = acc, 시작 모서리(a0) = acc + du
      const out = P((a0 + a1) / 2, 0, (b0 + b1) / 2).sub(P(0, 0, 0));
      quad(B, P(a1, y0, b1), P(a0, y0, b0), P(a0, y1, b0), P(a1, y1, b1), [acc, 0], [acc + du, 0], [acc + du, (y1 - y0) * vk], [acc, (y1 - y0) * vk], _wc, out); acc += du + 0.37; }
    _rc.setHex(roofHex);
    if (kind === 'house' || kind === 'barn') {
      const alongX = w > l, A = (alongX ? w : l) / 2, Bh = (alongX ? l : w) / 2, o = 0.45, pitch = kind === 'barn' ? 0.22 : 0.42, rise = Bh * pitch, yr = y1 + rise;
      const Q = (al, ac, y) => alongX ? P(al, y, ac) : P(ac, y, al), ye = y1 - o * pitch, F = [0.02, 0.97];
      // 두 지붕면 (골함석: u 를 지붕 길이 방향으로)
      for (const sd of [-1, 1]) { const a = Q(-A - o, sd * (Bh + o), ye), b = Q(A + o, sd * (Bh + o), ye), cc = Q(A + o, 0, yr), d = Q(-A - o, 0, yr), sl = Math.hypot(Bh + o, rise + o * pitch) / 2, ul = (2 * A + 2 * o) / 2;
        quad(RB, a, b, cc, d, [0.125, 0], [0.125 + ul, 0], [0.125 + ul, sl], [0.125, sl], _rc, Q(0, sd, 0).sub(Q(0, 0, 0)).setY(1)); }
      // 박공 세모 (벽 색 · 민무늬 자리)
      for (const sd of [-1, 1]) tri(B, Q(sd * A, -Bh, y1), Q(sd * A, Bh, y1), Q(sd * A, 0, yr), F, F, F, _wc, Q(sd, 0, 0).sub(Q(0, 0, 0)));
      return { gable: true, rise };
    }
    // 평지붕: 옥상 판 + 난간 + (콘크리트 건물) 물탱크·실외기
    const F = FLATUV, top = _rc.clone().multiplyScalar(0.85);
    quad(RB, P(-w / 2, y1, -l / 2), P(-w / 2, y1, l / 2), P(w / 2, y1, l / 2), P(w / 2, y1, -l / 2), F, F, F, F, top, UPV);
    const pc = _wc.clone().multiplyScalar(0.92), ph = kind === 'block' ? 0.7 : 0.45, t = 0.22;
    boxR(RB, x + (-w / 2 + t / 2) * c, y1, z - (-w / 2 + t / 2) * s, t, l, ph, yaw, pc); boxR(RB, x + (w / 2 - t / 2) * c, y1, z - (w / 2 - t / 2) * s, t, l, ph, yaw, pc);
    boxR(RB, x + (-l / 2 + t / 2) * s, y1, z + (-l / 2 + t / 2) * c, w, t, ph, yaw, pc); boxR(RB, x + (l / 2 - t / 2) * s, y1, z + (l / 2 - t / 2) * c, w, t, ph, yaw, pc);
    if (kind === 'block' && w > 6 && l > 6) { const r2 = rng(seed * 1000 | 0), gx = (r2() - 0.5) * (w - 4), gz = (r2() - 0.5) * (l - 4);
      boxR(RB, x + gx * c + gz * s, y1, z - gx * s + gz * c, 2.2, 2.2, 1.6, yaw, new THREE.Color(0x8fa6b8));
      for (let k2 = 0; k2 < 2; k2++) { const ax = (r2() - 0.5) * (w - 3), az = (r2() - 0.5) * (l - 3); boxR(RB, x + ax * c + az * s, y1, z - ax * s + az * c, 0.9, 0.6, 0.7, yaw, new THREE.Color(0xd8d8d4)); } }
    return { gable: false };
  }
  // ---- 1) 안쪽: 수치지형도 건물 ----
  const hide = []; scene.traverse(o => { if (o.userData && o.userData.siteBld) hide.push(o); });
  const extraCol = []; let nIn = 0, nOut = 0;
  if (VEC && VEC.bld && hide.length) {
    const WALLS = [0xf3efe6, 0xe8e2d4, 0xeeeae2, 0xdcd6c8], ROOFS = [0x3f6fa8, 0xa8483f, 0x4f7a4a, 0x6c6f72, 0x2f5a8a];
    VEC.bld.forEach(([d, s, w, l, ang, h], i) => {
      const c0 = W(d, s, 0), a = ang * DEG, ca = Math.cos(a), sa = Math.sin(a); let lo = 1e9, hi = -1e9;
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const u = (i / 4 - 0.5) * w, v = (j / 4 - 0.5) * l, dd = d + u * ca - v * sa, ss = s + u * sa + v * ca, y = terrainAt(ss, -dd); lo = Math.min(lo, y); hi = Math.max(hi, y); }   // 바닥 전체(5×5 점)에서 가장 낮은·높은 땅
      const area = w * l, kind = h >= 6.5 ? 'block' : area > 260 ? 'barn' : 'house', H = (kind === 'block' ? h : Math.min(h, kind === 'barn' ? 5 : 3.2)) + (hi - lo), seed = (i * 0.618) % 1;
      const wall = kind === 'barn' ? [0xc5ccd2, 0xd8d4c8, 0xa9b6c2][i % 3] : WALLS[i % 4], roof = kind === 'block' ? 0xb0aca4 : kind === 'barn' ? [0x5b7fa6, 0x8a8f96, 0x9a5a48][i % 3] : ROOFS[i % 5];
      // 몸 회전: 원래 상자와 같게 (rotation.y = π/2 − a, 크기 w×l)
      const r = building(kind, c0.x, c0.z, lo - 0.3, lo + H, w, l, Math.PI / 2 - a, wall, roof, seed);
      if (r.gable) extraCol.push({ x: c0.x, z: c0.z, y: lo + H + r.rise * 0.3, w, l, h: r.rise * 0.6, yaw: Math.PI / 2 - a });
      nIn++; });
    hide.forEach(o => o.visible = false);
  }
  // ---- 2) 바깥 마을: 민가·가게·창고 (비닐하우스·간판은 그대로) ----
  if (typeof OUTER !== 'undefined' && OUTER && OUTER.B && OUTER.BM) {
    const WALL = [0xf1ede4, 0xe6dfcf, 0xf4f2ec, 0xdcd3bf], ROOF = [0x3f6fa8, 0xa8483f, 0x4f7a4a, 0x5b5f66, 0x2f5a8a];
    OUTER.B.forEach((b, k) => { if (b.kind === 'gh') return; const cc = Math.sin(k * 12.9898) * 43758.5453, rr = cc - Math.floor(cc);
      // 바닥 전체에서 땅 높이를 재서: 낮은 쪽은 기초가 드러나게, 높은 쪽 바닥 위로 벽 높이를 줌 (비탈에서 위쪽이 묻히지 않게) · 충돌 상자도 같이
      { const c = Math.cos(b.yaw), sn = Math.sin(b.yaw); let lo = 1e9, hi = -1e9; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const u = (i / 4 - 0.5) * b.w, v = (j / 4 - 0.5) * b.l, g = groundAt(b.x + u * c + v * sn, b.z - u * sn + v * c); lo = Math.min(lo, g); hi = Math.max(hi, g); }
        const top = Math.max(b.y + b.h, hi + b.h); b.y = Math.min(b.y, lo - 0.3); b.h = top - b.y; }
      const kind = b.kind === 'shop' ? 'shop' : b.kind === 'barn' ? 'barn' : 'house';
      building(kind, b.x, b.z, b.y, b.y + b.h + 0.3, b.w, b.l, b.yaw, kind === 'barn' ? 0xb8c0c8 : WALL[(rr * 4) | 0], kind === 'barn' ? 0x8a8f96 : kind === 'shop' ? 0xa8a49c : ROOF[(rr * 5) | 0], rr); nOut++; });
    [OUTER.BM.bodies, OUTER.BM.roofs].forEach(m => { if (m) m.visible = false; });
  }
  // ---- 합쳐서 메시로 ----
  const geo = B => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3)); g.setIndex(B.i); g.computeBoundingSphere(); return g; };
  const G = new THREE.Group(); G.name = 'bld3'; scene.add(G); const MATS = [], MESH = [];
  KIND.forEach(k => { if (!WB[k].i.length) return; const m = new THREE.MeshStandardMaterial({ map: FAC[k].t, emissiveMap: FAC[k].te, emissive: 0xffd29a, emissiveIntensity: 0, vertexColors: true, roughness: k === 'barn' ? 0.55 : 0.85, metalness: k === 'barn' ? 0.3 : 0 });
    const me = new THREE.Mesh(geo(WB[k]), m); me.castShadow = me.receiveShadow = true; me.userData.heat = 0.3; G.add(me); MATS.push(m); MESH.push(me); });
  if (RB.i.length) { const m = new THREE.MeshStandardMaterial({ map: roofTex, vertexColors: true, roughness: 0.6, metalness: 0.25, side: THREE.DoubleSide }); const me = new THREE.Mesh(geo(RB), m); me.castShadow = me.receiveShadow = true; me.userData.heat = 0.25; G.add(me); MESH.push(me); }
  // 박공 지붕 아래 절반은 부딪히게 (위 뾰족한 곳은 안 잡음)
  extraCol.forEach(e => { const m = new THREE.Mesh(UBOX); m.position.set(e.x, e.y + e.h / 2, e.z); m.rotation.y = e.yaw; m.scale.set(e.w, e.h, e.l); boxCol(m, 'bld'); });
  // ---- 3) 이동통신 기지국: 바깥 산꼭대기 하나 (30 m 기둥 · 안테나 3면 · 빨강/흰 띠 · 장비 함) ----
  let MAST = null;
  if (MID) { let best = null; for (let a = 0; a < 48; a++) for (const d of [420, 560, 700, 840]) { const x = FLY_C.x + Math.sin(a / 48 * 6.283) * d, z = FLY_C.z + Math.cos(a / 48 * 6.283) * d;
      if (x > GS0 - 60 && x < GS1 + 60 && -z > GD0 - 60 && -z < GD1 + 60) continue; if (RWY) { const lw = rwyLocal({ x, z }); if (Math.abs(lw.t) < RWY.L / 2 + 350 && Math.abs(lw.w) < 120) continue; }
      if (window.__POWER && window.__POWER.TW.some(t => Math.hypot(t.x - x, t.z - z) < 120)) continue; const h = groundAt(x, z); if (!best || h > best.h) best = { x, z, h }; }
    if (best) { const H = 30, y = best.h - 0.3, mg = new THREE.Group(); mg.position.set(best.x, y, best.z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, H, 10), new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.5, metalness: 0.5 })); pole.position.y = H / 2; mg.add(pole);
      const bandM = new THREE.MeshStandardMaterial({ color: 0xd8342c, roughness: 0.6 }); for (const yb of [H - 1.5, H - 4.5]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 1.5, 10), bandM); b.position.y = yb; mg.add(b); }
      const antM = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.7 }), armM = new THREE.MeshStandardMaterial({ color: 0x8a8e92, roughness: 0.6, metalness: 0.5 });
      for (let k = 0; k < 3; k++) { const a = k * 2.094, arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), armM); arm.position.set(Math.cos(a) * 0.8, H - 2.6, Math.sin(a) * 0.8); arm.rotation.y = -a; mg.add(arm);
        for (const off of [-0.45, 0.45]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.0, 0.32), antM); p.position.set(Math.cos(a) * 1.55 - Math.sin(a) * off, H - 2.6, Math.sin(a) * 1.55 + Math.cos(a) * off); p.rotation.y = -a; mg.add(p); } }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); lamp.position.y = H + 0.25; mg.add(lamp);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 1.4), new THREE.MeshStandardMaterial({ color: 0xd6d8d2, roughness: 0.6 })); cab.position.set(2.6, 1.1, 0); mg.add(cab);
      mg.traverse(o => { if (o.isMesh) { o.castShadow = !LOWQ; o.userData.heat = 0.25; } }); scene.add(mg);
      MAST = { x: best.x, z: best.z, y, H, lamp, cut: outerCutTrees(t => Math.hypot(t[0] - best.x, t[2] - best.z) < 9 + t[4]) };   // 기지국 둘레 나무 정리
      const oc = STREES.col; STREES.col = (p, Rr) => { const r0 = oc(p, Rr); if (r0) return r0; const dy = p.y - y; if (dy < -Rr || dy > H + 1 + Rr) return null; const dx = p.x - best.x, dz = p.z - best.z, d = Math.hypot(dx, dz);
        const rad = dy > H - 4 ? 1.75 : dy < 2.3 && Math.abs(dx - 2.6) < 1.2 + Rr && Math.abs(dz) < 0.7 + Rr ? 0 : 0.6; if (rad === 0) return { pen: 2.2 + Rr - dy, n: new V3(0, 1, 0), tag: 'mast' };
        const pen = rad + Rr - d; return pen > 0 ? { pen, n: d > 1e-4 ? new V3(dx / d, 0, dz / d) : new V3(1, 0, 0), tag: 'mast' } : null; };
      const ot = STREES.topAt; if (ot) STREES.topAt = (x, z, R) => Math.max(ot(x, z, R), Math.hypot(x - best.x, z - best.z) < R + 3 ? y + H + 1 : -1e9); } }
  // ---- 4) 바깥 큰길: 가운데 흰 점선(3 m 칠하고 5 m 띄움) · 전봇대 둘에 하나 가로등 (밤에 켜지고 바닥이 밝아짐) ----
  let DASH = null, LAMP = null;
  if (typeof OUTER !== 'undefined' && OUTER && OUTER.roads) {
    const D = buf(), wc = new THREE.Color(0xe6e4dc), hw = 0.08;
    for (const rd of OUTER.roads) { if (rd.w < 6) continue; const p = rd.p; let acc = 0, on = true;
      for (let i = 1; i < p.length; i++) { const [x0, z0] = p[i - 1], [x1, z1] = p[i], L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-3) continue; const tx = (x1 - x0) / L, tz = (z1 - z0) / L;
        for (let d = 0; d < L - 1e-6;) { const lim = on ? 3 : 5, step = Math.min(lim - acc, L - d);
          if (on && step > 0.3) { const ax = x0 + tx * d, az = z0 + tz * d, bx = ax + tx * step, bz = az + tz * step, ya = groundAt(ax, az) + 0.07, yb = groundAt(bx, bz) + 0.07;
            quad(D, new V3(ax - tz * hw, ya, az + tx * hw), new V3(ax + tz * hw, ya, az - tx * hw), new V3(bx + tz * hw, yb, bz - tx * hw), new V3(bx - tz * hw, yb, bz + tx * hw), FLATUV, FLATUV, FLATUV, FLATUV, wc, UPV); }
          d += step; acc += step; if (acc >= lim - 1e-6) { acc = 0; on = !on; } } } }
    if (D.i.length) { DASH = new THREE.Mesh(geo(D), new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); DASH.receiveShadow = true; G.add(DASH); }
  }
  const PL = window.__POWER && window.__POWER.POLES ? window.__POWER.POLES.filter((q, i) => i % 2 === 0 && q.rx !== undefined) : [];
  if (PL.length) {
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.9); arm.translate(0, 0, 0.95); const head = new THREE.BoxGeometry(0.28, 0.12, 0.55); head.translate(0, -0.06, 1.85);
    const pool = new THREE.CircleGeometry(1, 20); pool.rotateX(-Math.PI / 2);
    const am = new THREE.InstancedMesh(arm, new THREE.MeshStandardMaterial({ color: 0x8a8e92, roughness: 0.5, metalness: 0.5 }), PL.length), hm = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ color: 0xd8d8d4, emissive: 0xffdca0, emissiveIntensity: 0, roughness: 0.4 }), PL.length);
    const pm = new THREE.InstancedMesh(pool, new THREE.MeshBasicMaterial({ color: 0x5a4a30, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), PL.length);
    const M = new THREE.Matrix4(), Qq = new THREE.Quaternion(), S1 = new V3(1, 1, 1);
    PL.forEach((q, i) => { Qq.setFromAxisAngle(UPV, Math.atan2(q.rx, q.rz)); M.compose(new V3(q.x, q.y + 8.6, q.z), Qq, S1); am.setMatrixAt(i, M); hm.setMatrixAt(i, M);
      const lx = q.x + q.rx * 1.85, lz = q.z + q.rz * 1.85; M.compose(new V3(lx, groundAt(lx, lz) + 0.1, lz), new THREE.Quaternion(), new V3(7, 1, 7)); pm.setMatrixAt(i, M); });
    pm.visible = false; pm.renderOrder = 2; am.castShadow = !LOWQ; G.add(am); G.add(hm); G.add(pm); LAMP = { hm, pm, n: PL.length };
  }
  // ---- 밤: 창에 불 · 기지국 빨간 등 깜빡 / 열화상: 그림 없는 회색 재질로 ----
  let lastN = null, lastIr = null; const ORIG = new Map(), plain = new THREE.MeshStandardMaterial({ color: 0x9a9a9a });
  function tick(dt) {
    const n = ENV.night ? 1 : ENV.dusk ? 0.35 : 0;
    if (n !== lastN) { lastN = n; MATS.forEach(m => m.emissiveIntensity = n); if (LAMP) { LAMP.hm.material.emissiveIntensity = n ? 1.6 : 0; LAMP.pm.visible = n > 0.5 && !ENV.ir; } }
    if (ENV.ir !== lastIr) { lastIr = ENV.ir; if (LAMP) LAMP.pm.visible = lastN > 0.5 && !ENV.ir; MESH.forEach(me => { if (ENV.ir) { ORIG.set(me, me.material); me.material = irMat(plain, (me.userData.heat || 0) * (ENV.night ? 0.6 : 0.2), 0.3); } else if (ORIG.has(me)) me.material = ORIG.get(me); }); }
    if (MAST) MAST.lamp.visible = (performance.now() % 1500) < 750;
  }
  return { G, nIn, nOut, MAST, tick, FAC, LIST, DASH, LAMP };
})();
window.__BLD3 = BLD3;
if (window.__sim) Object.assign(window.__sim, { BLD3 });
