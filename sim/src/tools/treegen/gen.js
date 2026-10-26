// 나무 모형 생성기 (ez-tree, MIT · Daniel Greenheck) → 시뮬레이터용 정규화 형상 + 잎 아틀라스
import * as THREE from 'three';
import { Tree } from 'ez-tree';

const D = (o) => JSON.parse(JSON.stringify(o));
const BASE = { seed: 1, type: 'deciduous', bark: { type: 'oak', tint: 0xffffff, flatShading: false, textured: false, textureScale: { x: 1, y: 1 } },
  branch: { levels: 3, angle: { 1: 50, 2: 50, 3: 40 }, children: { 0: 5, 1: 3, 2: 2 }, force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.0 },
    gnarliness: { 0: 0.05, 1: 0.1, 2: 0.15, 3: 0.1 }, length: { 0: 30, 1: 14, 2: 8, 3: 4 }, radius: { 0: 1.2, 1: 0.7, 2: 0.6, 3: 0.6 },
    sections: { 0: 6, 1: 5, 2: 3, 3: 1 }, segments: { 0: 6, 1: 5, 2: 3, 3: 3 }, start: { 1: 0.45, 2: 0.2, 3: 0.2 }, taper: { 0: 0.7, 1: 0.6, 2: 0.7, 3: 0.7 }, twist: { 0: 0, 1: 0, 2: 0, 3: 0 } },
  leaves: { type: 'oak', billboard: 'double', angle: 40, count: 4, start: 0.2, size: 4, sizeVariance: 0.5, tint: 0xffffff, alphaTest: 0.5 }, trellis: { enabled: false } };
const merge = (a, b) => { const o = D(a); (function m(t, s) { for (const k in s) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) { t[k] = t[k] || {}; m(t[k], s[k]); } else t[k] = s[k]; } })(o, b); return o; };

// 종: 0 활엽(참나무류) · 1 소나무 · 2 관목 · 3 조림 침엽(낙엽송·리기다) — 시뮬레이터 나무 종류 번호와 같음
// LOD: 0 가까이(세밀) · 1 중간(가지 줄이고 잎 크게) · 2 멀리(줄기 + 큰 잎 덩이 몇 장)
export const SPECIES = [
  { name: 'oak', leaf: 'oak', bark: [0.30, 0.25, 0.20], lods: [
    merge(BASE, { seed: 14, branch: { levels: 3, children: { 0: 4, 1: 2, 2: 1 }, angle: { 1: 48, 2: 55, 3: 40 }, length: { 0: 30, 1: 16, 2: 9, 3: 5 }, radius: { 0: 1.3 }, start: { 1: 0.42 }, gnarliness: { 0: 0.08, 1: 0.12, 2: 0.2 }, sections: { 0: 4, 1: 3, 2: 2, 3: 1 }, segments: { 0: 5, 1: 3, 2: 3, 3: 3 } }, leaves: { type: 'oak', count: 2, size: 11, angle: 45 } }),
    merge(BASE, { seed: 11, branch: { levels: 2, children: { 0: 4, 1: 3 }, angle: { 1: 48, 2: 55 }, length: { 0: 30, 1: 16, 2: 10 }, radius: { 0: 1.3 }, start: { 1: 0.42 }, sections: { 0: 3, 1: 2, 2: 1 }, segments: { 0: 4, 1: 3, 2: 3 } }, leaves: { type: 'oak', count: 2, size: 12, angle: 45 } }),
    merge(BASE, { seed: 11, branch: { levels: 1, children: { 0: 5 }, angle: { 1: 50 }, length: { 0: 30, 1: 18 }, radius: { 0: 1.3 }, start: { 1: 0.45 }, sections: { 0: 2, 1: 1 }, segments: { 0: 3, 1: 3 } }, leaves: { type: 'oak', count: 2, size: 17, angle: 45 } }) ] },
  { name: 'pine', leaf: 'pine', bark: [0.48, 0.30, 0.22], lods: [
    merge(BASE, { seed: 23, branch: { levels: 3, children: { 0: 5, 1: 2, 2: 1 }, angle: { 1: 62, 2: 45, 3: 35 }, length: { 0: 42, 1: 12, 2: 6, 3: 3 }, radius: { 0: 1.1, 1: 0.55 }, start: { 1: 0.62, 2: 0.3 }, gnarliness: { 0: 0.12, 1: 0.18, 2: 0.25 }, force: { strength: 0.012 }, sections: { 0: 5, 1: 3, 2: 2, 3: 1 }, segments: { 0: 5, 1: 3, 2: 3, 3: 3 } }, leaves: { type: 'pine', count: 2, size: 9, angle: 25, start: 0.4 } }),
    merge(BASE, { seed: 23, branch: { levels: 2, children: { 0: 5, 1: 3 }, angle: { 1: 62, 2: 45 }, length: { 0: 42, 1: 12, 2: 7 }, radius: { 0: 1.1, 1: 0.55 }, start: { 1: 0.62 }, gnarliness: { 0: 0.12, 1: 0.18 }, sections: { 0: 3, 1: 2, 2: 1 }, segments: { 0: 4, 1: 3, 2: 3 }, force: { strength: 0.012 } }, leaves: { type: 'pine', count: 2, size: 10, angle: 25, start: 0.3 } }),
    merge(BASE, { seed: 23, branch: { levels: 1, children: { 0: 5 }, angle: { 1: 62 }, length: { 0: 42, 1: 14 }, radius: { 0: 1.1 }, start: { 1: 0.65 }, sections: { 0: 2, 1: 1 }, segments: { 0: 3, 1: 3 } }, leaves: { type: 'pine', count: 2, size: 14, angle: 25, start: 0.2 } }) ] },
  { name: 'shrub', leaf: 'ash', bark: [0.32, 0.27, 0.21], lods: [
    merge(BASE, { seed: 37, branch: { levels: 2, children: { 0: 6, 1: 2 }, angle: { 1: 24, 2: 40 }, length: { 0: 0.5, 1: 16, 2: 7 }, radius: { 0: 0.6, 1: 0.8 }, start: { 1: 0.0, 2: 0.4 }, sections: { 0: 1, 1: 3, 2: 1 }, segments: { 0: 3, 1: 3, 2: 3 }, force: { strength: 0.02 } }, leaves: { type: 'ash', count: 3, size: 8, angle: 35, start: 0.2 } }),
    merge(BASE, { seed: 37, branch: { levels: 1, children: { 0: 6 }, angle: { 1: 24 }, length: { 0: 0.5, 1: 17 }, radius: { 0: 0.6, 1: 0.8 }, start: { 1: 0.0 }, sections: { 0: 1, 1: 2 }, segments: { 0: 3, 1: 3 }, force: { strength: 0.02 } }, leaves: { type: 'ash', count: 3, size: 11, angle: 35, start: 0.3 } }),
    merge(BASE, { seed: 37, branch: { levels: 1, children: { 0: 4 }, angle: { 1: 26 }, length: { 0: 0.5, 1: 17 }, radius: { 0: 0.6, 1: 0.8 }, start: { 1: 0.0 }, sections: { 0: 1, 1: 1 }, segments: { 0: 3, 1: 3 } }, leaves: { type: 'ash', count: 2, size: 15, angle: 35, start: 0.4 } }) ] },
  // 조림 침엽수: 직접 만듦 (줄기 + 층층이 아래로 처진 잎 판 = 원뿔형 수관)
  { name: 'conifer', leaf: 'pine', bark: [0.34, 0.27, 0.21], custom: 'conifer', lods: [{ whorls: 13, per: 6, seg: 5 }, { whorls: 8, per: 5, seg: 4 }, { whorls: 4, per: 4, seg: 3 }] },
];
function buildConifer(sp, o) {
  const P = [], N = [], UV = [], C = [], I = [], bc = sp.bark, [qx, qy] = CLUMP.pine;
  // 줄기 (밑동 반지름 0.045 → 끝 0.005, 단위 높이)
  const seg = o.seg, rings = 4;
  for (let j = 0; j <= rings; j++) { const y = j / rings, rr = 0.045 * (1 - y) + 0.004; for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; P.push(Math.cos(a) * rr, y, Math.sin(a) * rr); N.push(Math.cos(a), 0, Math.sin(a)); UV.push(BARK_UV[0], BARK_UV[1]); const ao = 0.55 + 0.45 * y; C.push(bc[0] * ao, bc[1] * ao, bc[2] * ao); } }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
  const r = rnd(4111 + o.whorls);
  const quad = (p0, dir, side, len, wid, shade) => {   // 잎 판: p0 에서 dir 방향으로 len, 폭 wid (side 방향)
    const o0 = P.length / 3, pts = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
    for (const [s, t] of pts) { const x = p0[0] + side[0] * s * wid + dir[0] * t * len, y = p0[1] + side[1] * s * wid + dir[1] * t * len, z = p0[2] + side[2] * s * wid + dir[2] * t * len; P.push(x, y, z);
      const nx = x, ny = (y - 0.55) * 0.8 + 0.4, nz = z, l = Math.hypot(nx, ny, nz) || 1; N.push(nx / l, ny / l, nz / l);
      UV.push((qx + (s + 0.5) * 512) / AW, 1 - (qy + (1 - t) * 512) / AH); const ao = shade * (0.7 + 0.3 * Math.min(1, Math.hypot(x, z) / 0.5)); C.push(ao, ao, ao); }
    I.push(o0, o0 + 1, o0 + 2, o0, o0 + 2, o0 + 3);
  };
  for (let k = 0; k < o.whorls; k++) {
    const t = k / (o.whorls - 1), y = 0.16 + t * 0.8, R = 1.0 * Math.pow(1 - t, 0.85) + 0.07, droop = 0.35 + 0.25 * (1 - t), shade = 0.62 + 0.38 * t;
    for (let m = 0; m < o.per; m++) {
      const a = (m / o.per + k * 0.37 + r() * 0.08) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      const dir = [dx * Math.cos(droop), -Math.sin(droop) * 0.6, dz * Math.cos(droop)], dl = Math.hypot(...dir); dir[0] /= dl; dir[1] /= dl; dir[2] /= dl;
      quad([dx * 0.02, y + 0.06, dz * 0.02], dir, [-dz, 0, dx], R * 1.05, R * 0.95 + 0.06, shade);
    }
  }
  // 꼭대기 순
  quad([0, 0.88, 0], [0, 1, 0], [1, 0, 0], 0.14, 0.12, 1);
  return { P, N, UV, C, I, tris: I.length / 3, verts: P.length / 3 };
}
// 아틀라스 2048² (칸 512): 1줄 = 잔가지 그림(소나무·참나무·물푸레·사시나무 가을) · 2줄 = 잔가지를 겹쳐 만든 빽빽한 잎 덩이 + 줄기 칸(흰색)
// 3~4줄 = 멀리서 쓰는 임포스터 (종마다 옆모습 256×512 · 위모습 256×256)
const IMP_SIDE = i => [i * 256, 1024], IMP_TOP = i => [i * 256, 1536], IMP_E = 1.07, IMP_H = 1.02;
const SPRIG = { pine: [0, 0], oak: [512, 0], ash: [1024, 0], aspen: [1536, 0] }, CLUMP = { pine: [0, 512], oak: [512, 512], ash: [1024, 512] }, AW = 2048, AH = 2048, BARK_UV = [(1536 + 256) / AW, 1 - (512 + 256) / AH];
function rnd(seed) { let x = seed >>> 0 || 1; return () => ((x = (x * 16807) % 2147483647) / 2147483647); }
export async function atlas() {
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH; const g = cv.getContext('2d'); const IM = {};
  for (const n of Object.keys(SPRIG)) { const im = new Image(); im.src = 'node_modules/@dgreenheck/ez-tree/src/lib/assets/leaves/' + n + '_color.png'; await im.decode(); IM[n] = im; const [x, y] = SPRIG[n]; g.drawImage(im, x, y, 512, 512); }
  // 잎 덩이: 가운데서 바깥으로 잔가지를 돌려 겹침 (안쪽은 조금 어둡게)
  for (const [n, [x0, y0]] of Object.entries(CLUMP)) {
    const r = rnd(n.length * 977 + 13), t = document.createElement('canvas'); t.width = t.height = 512; const c = t.getContext('2d');
    const K = n === 'pine' ? 26 : 22;
    for (let k = 0; k < K; k++) {
      const inner = k < K * 0.45, a = r() * Math.PI * 2, d = (inner ? r() * 0.06 : 0.04 + r() * 0.06) * 512, s = (inner ? 0.36 : 0.44) * 512 * (0.85 + r() * 0.2);
      c.save(); c.translate(256 + Math.cos(a) * d, 256 + Math.sin(a) * d); c.rotate(a + Math.PI / 2 + (r() - 0.5) * 0.5);
      c.filter = inner ? 'brightness(0.72)' : 'brightness(' + (0.9 + r() * 0.2) + ')';
      c.drawImage(IM[n], -s / 2, -s * 0.95, s, s); c.restore();
    }
    // 둥근 가장자리로 정리 (바깥 잎 끝은 남김)
    c.globalCompositeOperation = 'destination-in'; const gr = c.createRadialGradient(256, 256, 150, 256, 256, 256); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.93, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 512, 512);
    g.drawImage(t, x0, y0);
  }
  g.fillStyle = '#fff'; g.fillRect(1536, 512, 512, 512);
  return cv;
}
export function build(sp, json) {
  if (sp.custom === 'conifer') return buildConifer(sp, json);
  const t = new Tree(); t.loadFromJson(json);
  const B = t.branches, L = t.leaves;
  // 정규화: 높이 1 · 잎 수평 반지름(95%) 1 · 줄기 밑동이 원점
  let maxY = 0; for (let i = 1; i < B.verts.length; i += 3) maxY = Math.max(maxY, B.verts[i]); for (let i = 1; i < L.verts.length; i += 3) maxY = Math.max(maxY, L.verts[i]);
  const rs = []; for (let i = 0; i < L.verts.length; i += 3) rs.push(Math.hypot(L.verts[i], L.verts[i + 2])); rs.sort((a, b) => a - b); const R = rs[Math.floor(rs.length * 0.95)] || 1;
  const sx = 1 / R, sy = 1 / maxY;
  // 잎 덩이 중심 (그늘·법선용)
  let cx = 0, cy = 0, cz = 0, n = 0; for (let i = 0; i < L.verts.length; i += 3) { cx += L.verts[i]; cy += L.verts[i + 1]; cz += L.verts[i + 2]; n++; } cx /= n; cy /= n; cz /= n;
  const P = [], N = [], UV = [], C = [], I = [];
  // 줄기·가지
  const bc = sp.bark;
  for (let i = 0; i < B.verts.length; i += 3) {
    const x = B.verts[i], y = B.verts[i + 1], z = B.verts[i + 2]; P.push(x * sx, y * sy, z * sx);
    const nx = B.normals[i] / sx, ny = B.normals[i + 1] / sy, nz = B.normals[i + 2] / sx, l = Math.hypot(nx, ny, nz) || 1; N.push(nx / l, ny / l, nz / l);
    UV.push(BARK_UV[0], BARK_UV[1]); const ao = 0.55 + 0.45 * Math.min(1, y * sy * 1.4); C.push(bc[0] * ao, bc[1] * ao, bc[2] * ao);
  }
  for (const k of B.indices) I.push(k);
  const o = P.length / 3, [qx, qy] = (json.tex === 'sprig' ? SPRIG : CLUMP)[sp.leaf];
  for (let i = 0; i < L.verts.length; i += 3) {
    const x = L.verts[i], y = L.verts[i + 1], z = L.verts[i + 2]; P.push(x * sx, y * sy, z * sx);
    // 잎 법선: 수관 중심에서 바깥으로 (덩어리처럼 부드럽게 빛을 받음) + 위쪽 조금
    const dx = (x - cx) * sx, dy = (y - cy) * sy * 1.6 + 0.35, dz = (z - cz) * sx, l = Math.hypot(dx, dy, dz) || 1; N.push(dx / l, dy / l, dz / l);
    const j = i / 3 * 2, u = L.uvs[j], v = L.uvs[j + 1]; UV.push((qx + u * 512) / AW, 1 - (qy + (1 - v) * 512) / AH);
    const rr = Math.min(1, Math.hypot(dx, (y - cy) * sy * 1.6, dz) / 0.9), ao = (0.5 + 0.5 * rr) * (0.75 + 0.25 * Math.min(1, y * sy * 1.5)), jt = 0.92 + 0.16 * ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    C.push(ao * jt, ao * jt, ao * jt);
  }
  for (const k of L.indices) I.push(k + o);
  return { P, N, UV, C, I, tris: I.length / 3, verts: P.length / 3 };
}
// 미리보기: 종(행) × LOD(열) 칸마다 따로 그림
export async function preview(list, cols = 3, T = 320) {
  const rows = Math.ceil(list.length / cols), w = cols * T, h = rows * T;
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(w, h); r.setScissorTest(true); document.body.appendChild(r.domElement);
  const at = await atlas(), tex = new THREE.CanvasTexture(at); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  list.forEach((g0, i) => {
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x9cc3d6); sc.add(new THREE.HemisphereLight(0xdfefff, 0x445533, 1.4)); const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(3, 5, 2); sc.add(sun);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(g0.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(g0.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(g0.UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(g0.C, 3)); g.setIndex(g0.I);
    const k = g0.sc || [0.4, 1], m = new THREE.Mesh(g, mat); m.scale.set(k[0], k[1], k[0]); sc.add(m);
    const S = Math.max(k[1], k[0] * 2.2), cam = new THREE.PerspectiveCamera(35, 1, 0.01, 50); cam.position.set(0, k[1] * 0.5 + S * 0.25, S * 1.9); cam.lookAt(0, k[1] * 0.5, 0);
    const col = i % cols, row = Math.floor(i / cols); r.setViewport(col * T, h - (row + 1) * T, T, T); r.setScissor(col * T, h - (row + 1) * T, T, T); r.render(sc, cam);
  });
  return r.domElement.toDataURL('image/png');
}
export async function atlasURL() { return (await atlas()).toDataURL('image/png'); }
// 임포스터 (LOD2): 세로 판 두 장 십자 + 수관 높이 가로 판 한 장 · 그림은 LOD0 모형을 정사영으로 찍어 아틀라스에 넣음
const TOPY = { oak: 0.72, pine: 0.84, shrub: 0.62, conifer: 0.5 }, XS = { oak: 0.27, pine: 0.26, shrub: 0.82, conifer: 0.26 };
function impGeo(i, sp) {
  const P = [], N = [], UV = [], C = [], I = [], E = IMP_E, [sx0, sy0] = IMP_SIDE(i), [tx0, ty0] = IMP_TOP(i);
  const side = (ax) => { const o = P.length / 3; for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const a = (u * 2 - 1) * E, y = v * IMP_H; P.push(ax ? 0 : a, y, ax ? a : 0); N.push(0, 1, 0); UV.push((sx0 + u * 256) / AW, 1 - (sy0 + (1 - v) * 512) / AH); C.push(1, 1, 1); } I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  side(0); side(1);
  const o = P.length / 3, ty = TOPY[sp.name]; for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const x = (u * 2 - 1) * E, z = (1 - v * 2) * E; P.push(x, ty, z); N.push(0, 1, 0); UV.push((tx0 + u * 256) / AW, 1 - (ty0 + (1 - v) * 256) / AH); C.push(1, 1, 1); } I.push(o, o + 1, o + 2, o, o + 2, o + 3);
  return { P, N, UV, C, I, tris: I.length / 3, verts: P.length / 3 };
}
function toMesh(g0, mat) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(g0.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(g0.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(g0.UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(g0.C, 3)); g.setIndex(g0.I); return new THREE.Mesh(g, mat); }
// 색(RGB, 불투명)과 투명도(A)를 따로 내보냄: 브라우저가 투명 칸 색을 버리지 않게 · 잎 가장자리 색은 진한 잎 색으로 채움
function splitRGBA(cv) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, im = g.getImageData(0, 0, W, H), d = im.data, ok = new Uint8Array(W * H), A = new Uint8ClampedArray(W * H);
  for (let i = 0; i < W * H; i++) { A[i] = d[i * 4 + 3]; ok[i] = d[i * 4 + 3] >= 128 ? 1 : 0; }
  for (let k = 0; k < 16; k++) { const nk = ok.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (ok[i]) continue; let r = 0, gg = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (!ok[j]) continue; r += d[j * 4]; gg += d[j * 4 + 1]; b += d[j * 4 + 2]; n++; }
      if (n) { d[i * 4] = r / n; d[i * 4 + 1] = gg / n; d[i * 4 + 2] = b / n; nk[i] = 1; } }
    ok.set(nk); }
  // 남은 빈 칸: 칸(256) 평균 잎 색
  const T = 256;
  for (let ty = 0; ty < H / T; ty++) for (let tx = 0; tx < W / T; tx++) { let r = 0, gg = 0, b = 0, n = 0;
    for (let y = ty * T; y < (ty + 1) * T; y++) for (let x = tx * T; x < (tx + 1) * T; x++) { const i = y * W + x; if (A[i] >= 128) { r += d[i * 4]; gg += d[i * 4 + 1]; b += d[i * 4 + 2]; n++; } }
    if (!n) { r = 70; gg = 90; b = 50; n = 1; }
    for (let y = ty * T; y < (ty + 1) * T; y++) for (let x = tx * T; x < (tx + 1) * T; x++) { const i = y * W + x; if (!ok[i]) { d[i * 4] = r / n; d[i * 4 + 1] = gg / n; d[i * 4 + 2] = b / n; } } }
  const rgb = document.createElement('canvas'), al = document.createElement('canvas'); rgb.width = al.width = W; rgb.height = al.height = H;
  for (let i = 0; i < W * H; i++) d[i * 4 + 3] = 255; rgb.getContext('2d').putImageData(im, 0, 0);
  const ai = new ImageData(W, H); for (let i = 0; i < W * H; i++) { ai.data[i * 4] = ai.data[i * 4 + 1] = ai.data[i * 4 + 2] = A[i]; ai.data[i * 4 + 3] = 255; } al.getContext('2d').putImageData(ai, 0, 0);
  return { rgb, al };
}
export async function exportAll() {
  const cv = await atlas(), g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const geo = SPECIES.map(sp => sp.lods.slice(0, 2).map(j => build(sp, j)));
  const R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setClearColor(0x000000, 0); R.outputColorSpace = THREE.SRGBColorSpace;
  SPECIES.forEach((sp, i) => {
    const sc = new THREE.Scene(), m = toMesh(geo[i][0], mat), xs = XS[sp.name]; m.scale.set(xs, 1, xs); sc.add(m);
    const W = IMP_E * xs;
    R.setSize(256, 512); let cam = new THREE.OrthographicCamera(-W, W, IMP_H, 0, 0.01, 20); cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0); cam.position.y = 0; R.render(sc, cam);
    g.drawImage(R.domElement, ...IMP_SIDE(i), 256, 512);
    R.setSize(256, 256); cam = new THREE.OrthographicCamera(-W, W, W, -W, 0.01, 20); cam.up.set(0, 0, -1); cam.position.set(0, 5, 0); cam.lookAt(0, 0, 0); R.render(sc, cam);
    g.drawImage(R.domElement, ...IMP_TOP(i), 256, 256);
  });
  g.fillStyle = '#fff'; g.fillRect(1536, 512, 512, 512);   // 줄기 칸 (불투명 흰색 · 꼭짓점 색으로 줄기 색)
  const pre = cv.toDataURL('image/png'), { rgb, al } = splitRGBA(cv);
  SPECIES.forEach((sp, i) => geo[i].push(impGeo(i, sp)));
  const out = geo.map(L => L.map(g0 => ({ P: g0.P.map(v => +v.toFixed(4)), N: g0.N.map(v => Math.round(v * 127)), UV: g0.UV.map(v => Math.round(v * 65535)), C: g0.C.map(v => Math.round(Math.min(1, v) * 255)), I: g0.I, tris: g0.tris })));
  return { geo: out, names: SPECIES.map(s => s.name), rgb: rgb.toDataURL('image/webp', 0.88), alpha: al.toDataURL('image/webp', 1.0), png: pre };
}
window.TG = { SPECIES, build, preview, atlas, atlasURL, exportAll };
window.TG_READY = true;
