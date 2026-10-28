
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
  // 기초(옹벽) 그림: 콘크리트 · 거푸집 이음 · 폼타이 구멍 (한 칸 = 가로 2.4 m × 세로 1.2 m)
  const concTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), rn = rng(4021);
    g.fillStyle = '#c4bfb5'; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 1800; i++) { const v = rn() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${(0.06 * rn()).toFixed(3)})`; g.fillRect(rn() * 256, rn() * 128, 1 + rn() * 2, 1 + rn() * 2); }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 63, 256, 2); g.fillRect(0, 126, 256, 2); g.fillRect(0, 0, 2, 128); g.fillRect(127, 0, 2, 128);   // 거푸집 이음 (1.2 × 0.6 m 판)
    g.fillStyle = 'rgba(40,36,30,.35)'; for (const x of [32, 96, 160, 224]) for (const y of [32, 96]) { g.beginPath(); g.arc(x, y, 1.7, 0, 6.283); g.fill(); }   // 폼타이 구멍
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(70,60,48,0)'); gr.addColorStop(1, 'rgba(70,60,48,.07)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; })();
  // ---- 합칠 그릇: 재질마다 위치·법선·uv·색 ----
  const buf = () => ({ p: [], n: [], u: [], c: [], i: [] }), WB = {}, RB = buf(), PB = buf(); KIND.forEach(k => WB[k] = buf());   // PB: 기초(옹벽)
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
  // ---- 건물 하나: 벽 4면(창 그림) + 기초 + 지붕 ----
  //  kind: house·barn → 박공 / shop·block → 평지붕+난간 · w: 몸 x 폭, l: 몸 z 길이, yaw: 몸 회전, body: 1층 바닥부터 벽 위까지 높이
  //  비탈: 1층 바닥 = 벽 둘레에서 가장 높은 땅 (위쪽 벽에서 창·문이 땅에 묻히지 않게)
  //   · 낮은 쪽 벽은 그 벽 둘레 땅보다 위에 오는 온전한 층만큼 아래층을 더 보임 (층 줄은 네 벽이 같은 높이)
  //   · 그 아래는 콘크리트 기초(옹벽)를 땅속까지, 벽보다 7 cm 바깥 + 윗면 턱
  //  돌려줌: { gable, rise, top: 벽 위, yb: 기초 바닥(땅속) }
  const _wc = new THREE.Color(), _rc = new THREE.Color(), _pc = new THREE.Color(0xf0ece4), LIST = [];
  function building(kind, x, z, body, w, l, yaw, wallHex, roofHex, seed) {
    const f = FAC[kind], c = Math.cos(yaw), s = Math.sin(yaw), P = (u, y, v) => new V3(x + u * c + v * s, y, z - u * s + v * c), B = WB[kind];
    const k = [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]], whi = [];
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < 4; i++) { const [a0, b0] = k[i], [a1, b1] = k[(i + 1) % 4], n = Math.max(2, Math.ceil(Math.hypot(a1 - a0, b1 - b0) / 1.5)); let m = -1e9;   // 벽을 따라 1.5 m 마다 땅 높이
      for (let j = 0; j <= n; j++) { const q = P(a0 + (a1 - a0) * j / n, 0, b0 + (b1 - b0) * j / n), y = groundAt(q.x, q.z); m = Math.max(m, y); lo = Math.min(lo, y); }
      whi.push(m); hi = Math.max(hi, m); }
    const y0 = hi + 0.03, top = y0 + body, yb = lo - 0.35, fl = Math.max(1, Math.round(body / f.th)), vk = fl / body, u0 = seed * 7.31 % 1, e = 0.07;
    LIST.push([x, z, kind, w, l, top - yb]); _wc.setHex(wallHex);
    const ke = k.map(([a, b]) => [a + Math.sign(a) * e, b + Math.sign(b) * e]);
    let acc = u0, accP = seed * 3.1 % 1;
    for (let i = 0; i < 4; i++) { const [a0, b0] = k[i], [a1, b1] = k[(i + 1) % 4], L = Math.hypot(a1 - a0, b1 - b0), du = L / f.tw;
      // 바깥에서 볼 때 오른쪽으로 u 가 커지게: 끝 모서리(a1) = acc, 시작 모서리(a0) = acc + du
      const out = P((a0 + a1) / 2, 0, (b0 + b1) / 2).sub(P(0, 0, 0));
      const m = clamp(Math.floor((y0 - whi[i] - 0.05) * vk), 0, 8), yf = y0 - m / vk;   // 이 벽에서 더 보일 아래층 수 · 이 벽 그림이 시작하는 높이 (층 경계)
      quad(B, P(a1, yf, b1), P(a0, yf, b0), P(a0, top, b0), P(a1, top, b1), [acc, -m], [acc + du, -m], [acc + du, fl], [acc, fl], _wc, out);
      const [c0, d0] = ke[i], [c1, d1] = ke[(i + 1) % 4], ua = accP, ub = accP + (L + 2 * e) / 2.4, vb = (yf - yb) / 1.2;   // 기초: 콘크리트 그림 (2.4 × 1.2 m 칸)
      quad(PB, P(c1, yb, d1), P(c0, yb, d0), P(c0, yf, d0), P(c1, yf, d1), [ua, 0], [ub, 0], [ub, vb], [ua, vb], _pc, out);
      quad(PB, P(a1, yf, b1), P(a0, yf, b0), P(c0, yf, d0), P(c1, yf, d1), [ua, vb], [ub, vb], [ub, vb + 0.06], [ua, vb + 0.06], _pc, UPV);   // 기초 윗면 턱
      acc += du + 0.37; accP = ub; }
    const y1 = top; _rc.setHex(roofHex);
    if (kind === 'house' || kind === 'barn') {
      const alongX = w > l, A = (alongX ? w : l) / 2, Bh = (alongX ? l : w) / 2, o = 0.45, pitch = kind === 'barn' ? 0.22 : 0.42, rise = Bh * pitch, yr = y1 + rise;
      const Q = (al, ac, y) => alongX ? P(al, y, ac) : P(ac, y, al), ye = y1 - o * pitch, F = [0.02, 0.97];
      // 두 지붕면 (골함석: u 를 지붕 길이 방향으로)
      for (const sd of [-1, 1]) { const a = Q(-A - o, sd * (Bh + o), ye), b = Q(A + o, sd * (Bh + o), ye), cc = Q(A + o, 0, yr), d = Q(-A - o, 0, yr), sl = Math.hypot(Bh + o, rise + o * pitch) / 2, ul = (2 * A + 2 * o) / 2;
        quad(RB, a, b, cc, d, [0.125, 0], [0.125 + ul, 0], [0.125 + ul, sl], [0.125, sl], _rc, Q(0, sd, 0).sub(Q(0, 0, 0)).setY(1)); }
      // 박공 세모 (벽 색 · 민무늬 자리)
      for (const sd of [-1, 1]) tri(B, Q(sd * A, -Bh, y1), Q(sd * A, Bh, y1), Q(sd * A, 0, yr), F, F, F, _wc, Q(sd, 0, 0).sub(Q(0, 0, 0)));
      return { gable: true, rise, top, yb };
    }
    // 평지붕: 옥상 판 + 난간 + (콘크리트 건물) 물탱크·실외기
    const FU = FLATUV, topC = _rc.clone().multiplyScalar(0.85);
    quad(RB, P(-w / 2, y1, -l / 2), P(-w / 2, y1, l / 2), P(w / 2, y1, l / 2), P(w / 2, y1, -l / 2), FU, FU, FU, FU, topC, UPV);
    const pc = _wc.clone().multiplyScalar(0.92), ph = kind === 'block' ? 0.7 : 0.45, t = 0.22;
    boxR(RB, x + (-w / 2 + t / 2) * c, y1, z - (-w / 2 + t / 2) * s, t, l, ph, yaw, pc); boxR(RB, x + (w / 2 - t / 2) * c, y1, z - (w / 2 - t / 2) * s, t, l, ph, yaw, pc);
    boxR(RB, x + (-l / 2 + t / 2) * s, y1, z + (-l / 2 + t / 2) * c, w, t, ph, yaw, pc); boxR(RB, x + (l / 2 - t / 2) * s, y1, z + (l / 2 - t / 2) * c, w, t, ph, yaw, pc);
    if (kind === 'block' && w > 6 && l > 6) { const r2 = rng(seed * 1000 | 0), gx = (r2() - 0.5) * (w - 4), gz = (r2() - 0.5) * (l - 4);
      boxR(RB, x + gx * c + gz * s, y1, z - gx * s + gz * c, 2.2, 2.2, 1.6, yaw, new THREE.Color(0x8fa6b8));
      for (let k2 = 0; k2 < 2; k2++) { const ax = (r2() - 0.5) * (w - 3), az = (r2() - 0.5) * (l - 3); boxR(RB, x + ax * c + az * s, y1, z - ax * s + az * c, 0.9, 0.6, 0.7, yaw, new THREE.Color(0xd8d8d4)); } }
    return { gable: false, top, yb };
  }
  // ---- 1) 안쪽: 수치지형도 건물 ----
  const hide = []; scene.traverse(o => { if (o.userData && o.userData.siteBld) hide.push(o); });
  const extraCol = []; let nIn = 0, nOut = 0;
  if (VEC && VEC.bld && hide.length) {
    const WALLS = [0xf3efe6, 0xe8e2d4, 0xeeeae2, 0xdcd6c8], ROOFS = [0x3f6fa8, 0xa8483f, 0x4f7a4a, 0x6c6f72, 0x2f5a8a], boxes = [];
    hide.forEach(o => { if (o.userData.col) boxes[o.userData.bi] = o; });
    VEC.bld.forEach(([d, s, w, l, ang, h], i) => {
      const c0 = W(d, s, 0), a = ang * DEG, area = w * l, kind = h >= 6.5 ? 'block' : area > 260 ? 'barn' : 'house', body = kind === 'block' ? h : Math.min(h, kind === 'barn' ? 5 : 3.2), seed = (i * 0.618) % 1;
      const wall = kind === 'barn' ? [0xc5ccd2, 0xd8d4c8, 0xa9b6c2][i % 3] : WALLS[i % 4], roof = kind === 'block' ? 0xb0aca4 : kind === 'barn' ? [0x5b7fa6, 0x8a8f96, 0x9a5a48][i % 3] : ROOFS[i % 5];
      // 몸 회전: 원래 상자와 같게 (rotation.y = π/2 − a, 크기 w×l)
      const r = building(kind, c0.x, c0.z, body, w, l, Math.PI / 2 - a, wall, roof, seed);
      if (r.gable) extraCol.push({ x: c0.x, z: c0.z, y: r.top + r.rise * 0.3, w, l, h: r.rise * 0.6, yaw: Math.PI / 2 - a });
      const bm = boxes[i]; if (bm) { bm.position.y = (r.yb + r.top) / 2; bm.scale.y = r.top - r.yb; bm.updateMatrixWorld(true); updBoxCol(bm.userData.col, bm); bm.userData.col.h.y = bm.scale.y / 2; bm.userData.col.bnd = bm.userData.col.h.length(); }   // 충돌 상자 = 그린 모양 (기초 바닥 ~ 벽 위)
      nIn++; });
    hide.forEach(o => o.visible = false);
  }
  // ---- 2) 바깥 마을: 민가·가게·창고 (비닐하우스는 그대로 · 간판은 높이만 맞춤) ----
  const _M4 = new THREE.Matrix4(), _P3 = new V3(), _Q4 = new THREE.Quaternion(), _S3 = new V3();
  if (typeof OUTER !== 'undefined' && OUTER && OUTER.B && OUTER.BM) {
    const WALL = [0xf1ede4, 0xe6dfcf, 0xf4f2ec, 0xdcd3bf], ROOF = [0x3f6fa8, 0xa8483f, 0x4f7a4a, 0x5b5f66, 0x2f5a8a];
    OUTER.B.forEach((b, k) => { if (b.kind === 'gh') return; const cc = Math.sin(k * 12.9898) * 43758.5453, rr = cc - Math.floor(cc);
      const kind = b.kind === 'shop' ? 'shop' : b.kind === 'barn' ? 'barn' : 'house';
      const r = building(kind, b.x, b.z, b.h + 0.3, b.w, b.l, b.yaw, kind === 'barn' ? 0xb8c0c8 : WALL[(rr * 4) | 0], kind === 'barn' ? 0x8a8f96 : kind === 'shop' ? 0xa8a49c : ROOF[(rr * 5) | 0], rr);
      b.y = r.yb; b.h = r.top - 0.3 - r.yb; nOut++;   // 충돌 상자 (game6.js col: b.y ~ b.y + b.h + 지붕) 를 그린 모양에 맞춤
      const sg = OUTER.BM.signs; if (sg && b.si !== undefined) { sg.getMatrixAt(b.si, _M4); _M4.decompose(_P3, _Q4, _S3); _P3.y = r.top - 0.5; sg.setMatrixAt(b.si, _M4.compose(_P3, _Q4, _S3)); sg.instanceMatrix.needsUpdate = true; } });   // 간판도 벽 위쪽에
    [OUTER.BM.bodies, OUTER.BM.roofs].forEach(m => { if (m) m.visible = false; });
  }
  // ---- 합쳐서 메시로 ----
  const geo = B => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3)); g.setIndex(B.i); g.computeBoundingSphere(); return g; };
  const G = new THREE.Group(); G.name = 'bld3'; scene.add(G); const MATS = [], MESH = [];
  KIND.forEach(k => { if (!WB[k].i.length) return; const m = new THREE.MeshStandardMaterial({ map: FAC[k].t, emissiveMap: FAC[k].te, emissive: 0xffd29a, emissiveIntensity: 0, vertexColors: true, roughness: k === 'barn' ? 0.55 : 0.85, metalness: k === 'barn' ? 0.3 : 0 });
    const me = new THREE.Mesh(geo(WB[k]), m); me.castShadow = me.receiveShadow = true; me.userData.heat = 0.3; G.add(me); MATS.push(m); MESH.push(me); });
  if (RB.i.length) { const m = new THREE.MeshStandardMaterial({ map: roofTex, vertexColors: true, roughness: 0.6, metalness: 0.25, side: THREE.DoubleSide }); const me = new THREE.Mesh(geo(RB), m); me.castShadow = me.receiveShadow = true; me.userData.heat = 0.25; G.add(me); MESH.push(me); }
  if (PB.i.length) { const me = new THREE.Mesh(geo(PB), new THREE.MeshStandardMaterial({ map: concTex, vertexColors: true, roughness: 0.93, metalness: 0 })); me.castShadow = me.receiveShadow = true; me.userData.heat = 0.2; G.add(me); MESH.push(me); }   // 기초(옹벽)
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
  // ---- 4) 바깥 큰길: 가운데 흰 점선(3 m 칠하고 5 m 띄움) · 가로등은 game6l.js (전봇대 등 · 길가 가로등) ----
  let DASH = null;
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
  // ---- 밤: 창에 불 · 기지국 빨간 등 깜빡 / 열화상: 그림 없는 회색 재질로 ----
  let lastN = null, lastIr = null; const ORIG = new Map(), plain = new THREE.MeshStandardMaterial({ color: 0x9a9a9a });
  function tick(dt) {
    const n = ENV.night ? 1 : ENV.dusk ? 0.35 : 0;
    if (n !== lastN) { lastN = n; MATS.forEach(m => m.emissiveIntensity = n); }
    if (ENV.ir !== lastIr) { lastIr = ENV.ir; MESH.forEach(me => { if (ENV.ir) { ORIG.set(me, me.material); me.material = irMat(plain, (me.userData.heat || 0) * (ENV.night ? 0.6 : 0.2), 0.3); } else if (ORIG.has(me)) me.material = ORIG.get(me); }); }
    if (MAST) MAST.lamp.visible = (performance.now() % 1500) < 750;
  }
  return { G, nIn, nOut, MAST, tick, FAC, LIST, DASH };
})();
window.__BLD3 = BLD3;
if (window.__sim) Object.assign(window.__sim, { BLD3 });
