
// =====================================================================
//  고급 나무 모형 (lib/trees.json · lib/trees_atlas.webp — tools/treegen, ez-tree MIT 기반)
//  처음에는 기존 단순 나무로 그리고, 파일이 오면 같은 자리·크기 그대로 모형만 바꿈 (충돌·산불·활주로 처리 그대로)
//  공개판: 첫 화면(입장 번호·인트로) 동안 작업 스레드가 미리 받아 계산까지 끝내 둠 (template.html __preload · preload-worker.js) → 앱이 뜨면 바로 바꿈
//  종: 0 활엽(참나무류) · 1 소나무 · 2 관목 · 3 조림 침엽 / 세밀도: 0 가까이 · 1 중간 · 2 멀리(임포스터: 세로 판 십자 + 가로 판)
// =====================================================================
const TREES3 = (function () {
  const st = { ready: false, mat: null, geo: null, time: { value: 0 }, ir: { value: 0 }, irv: { value: 0.13 }, ire: { value: 0.3 } };
  if (window.SIM_NOTREES3 || location.protocol === 'file:' && !window.SIM_TREES_JSON) return st;
  const base = window.SIM_BASE || '';
  // 색(불투명 RGB)·투명도(A) 그림 두 장을 합쳐 RGBA 배열로 (아래위 뒤집어 three 의 uv 와 맞춤) — 작업 스레드를 못 쓸 때만 (preload-worker.js 와 같은 계산)
  function rgbaFrom(rgbImg, aImg) {
    const W = rgbImg.naturalWidth, H = rgbImg.naturalHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(rgbImg, 0, 0); const c = g.getImageData(0, 0, W, H).data; g.drawImage(aImg, 0, 0, W, H); const a = g.getImageData(0, 0, W, H).data;
    const out = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) { const sr = y * W * 4, dr = (H - 1 - y) * W * 4; for (let x = 0; x < W * 4; x += 4) { out[dr + x] = c[sr + x]; out[dr + x + 1] = c[sr + x + 1]; out[dr + x + 2] = c[sr + x + 2]; out[dr + x + 3] = a[sr + x]; } }
    return { data: out, width: W, height: H };
  }
  // 투명 잎 밉맵: 작아질수록 잎이 사라지지 않게 칸(512)별로 알파를 키워 덮는 면적을 원래와 맞춤 (2×2 평균 · 알파는 색과 따로)
  function coverageMips(L0, thr) {
    const lv = [L0], T0 = 512, W0 = L0.width, nx = W0 / T0, ny = L0.height / T0, cov = new Float32Array(nx * ny);
    for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) { let n = 0; for (let y = ty * T0; y < (ty + 1) * T0; y += 2) for (let x = tx * T0; x < (tx + 1) * T0; x += 2) if (L0.data[(y * W0 + x) * 4 + 3] > thr) n++; cov[ty * nx + tx] = n / (T0 * T0 / 4); }
    let P = L0, A = new Float32Array(W0 * L0.height); for (let i = 0; i < A.length; i++) A[i] = L0.data[i * 4 + 3];   // 보정 전 알파 (단계마다 이것을 평균)
    while (P.width > 1 || P.height > 1) {
      const w = Math.max(1, P.width >> 1), h = Math.max(1, P.height >> 1), d = new Uint8Array(w * h * 4), A2 = new Float32Array(w * h), pw = P.width, pd = P.data;
      for (let y = 0; y < h; y++) { const ya = Math.min(P.height - 1, y * 2) * pw, yb = Math.min(P.height - 1, y * 2 + 1) * pw;   // 2×2 평균 (더하는 순서는 예전과 같아 결과도 같음)
        for (let x = 0; x < w; x++) { const xa = Math.min(pw - 1, x * 2), xb = Math.min(pw - 1, x * 2 + 1), i0 = ya + xa, i1 = ya + xb, i2 = yb + xa, i3 = yb + xb, o = (y * w + x) * 4;
          d[o] = (pd[i0 * 4] + pd[i1 * 4] + pd[i2 * 4] + pd[i3 * 4]) / 4; d[o + 1] = (pd[i0 * 4 + 1] + pd[i1 * 4 + 1] + pd[i2 * 4 + 1] + pd[i3 * 4 + 1]) / 4; d[o + 2] = (pd[i0 * 4 + 2] + pd[i1 * 4 + 2] + pd[i2 * 4 + 2] + pd[i3 * 4 + 2]) / 4; A2[y * w + x] = (A[i0] + A[i1] + A[i2] + A[i3]) / 4; } }
      const ts = T0 * w / W0;
      for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) {
        const x0 = Math.floor(tx * ts), y0 = Math.floor(ty * ts), x1 = Math.max(x0 + 1, Math.floor((tx + 1) * ts)), y1 = Math.max(y0 + 1, Math.floor((ty + 1) * ts)), want = cov[ty * nx + tx];
        let k = 1;
        if (ts >= 2 && want < 0.98) { let lo = 1, hi = 8; for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2; let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (A2[y * w + x] * m > thr) n++; if (n / ((x1 - x0) * (y1 - y0)) < want) lo = m; else hi = m; } k = (lo + hi) / 2; }
        else if (want < 0.98) k = 1.6;
        for (let y = y0; y < Math.min(h, y1); y++) for (let x = x0; x < Math.min(w, x1); x++) d[(y * w + x) * 4 + 3] = Math.min(255, A2[y * w + x] * k);
      }
      P = { data: d, width: w, height: h }; A = A2; lv.push(P);
    }
    return lv;
  }
  function geoFrom(o) {   // JSON 배열 또는 작업 스레드가 만든 형식 배열
    const g = new THREE.BufferGeometry(), T = (A, a) => a instanceof A ? a : new A(a);
    g.setAttribute('position', new THREE.BufferAttribute(T(Float32Array, o.P), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(T(Int8Array, o.N), 3, true));
    g.setAttribute('uv', new THREE.BufferAttribute(T(Uint16Array, o.UV), 2, true));
    g.setAttribute('color', new THREE.BufferAttribute(T(Uint8Array, o.C), 3, true));
    g.setIndex(Array.isArray(o.I) ? o.I : new THREE.BufferAttribute(o.I, 1)); return g;
  }
  function makeMat(tex) {
    const m = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.92, metalness: 0 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = st.time; sh.uniforms.uIR = st.ir; sh.uniforms.uIRv = st.irv; sh.uniforms.uIRe = st.ire;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          { float hh = max(0.0, position.y); vec3 ip = instanceMatrix[3].xyz; float ph = ip.x * 0.13 + ip.z * 0.17;
            transformed.x += sin(uTime * 1.3 + ph) * 0.022 * hh * hh; transformed.z += cos(uTime * 1.07 + ph * 1.3) * 0.018 * hh * hh; }
        #endif`);
      sh.fragmentShader = 'uniform float uIR; uniform float uIRv; uniform float uIRe;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        if (uIR > 0.5) diffuseColor.rgb = vec3(uIRv);`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uIR > 0.5) totalEmissiveRadiance += vec3(uIRe);   // 열화상: 나무 온도 (밤엔 열린 땅보다 따뜻, 낮엔 시원)`).replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        #ifdef DOUBLE_SIDED
          normal *= faceDirection;   // 잎 판 뒷면도 바깥쪽 법선 그대로 (수관 덩어리처럼 빛을 받게)
        #endif`);
    };
    m.customProgramCacheKey = () => 'trees3';
    return m;
  }
  function apply() {
    const G = st.geo, mat = st.mat, dmat = st.dmat;
    // 1) 현장 나무 (STREES): 조각마다 같은 인스턴스에 형상·재질만 교체
    if (STREES && STREES.CHUNKS) {
      const view = (G0, k) => { const g = new THREE.BufferGeometry(); for (const a in G0.attributes) g.setAttribute(a, G0.attributes[a]); g.setIndex(G0.index); g.boundingSphere = k.sph; g.boundingBox = k.bb; return g; };
      const mean = [[69, 90, 55], [50, 76, 41], [55, 76, 41], [50, 78, 41]], tone = [[0.62, 0.68, 0.56], [0.54, 0.62, 0.52], [0.66, 0.70, 0.58], [0.50, 0.60, 0.52]], c = new THREE.Color(), u8 = STREES.u8;
      for (const k of STREES.CHUNKS) {
        const sp = k.kind === 2 ? 2 : k.kind === 1 ? 1 : k.kind === 3 ? 3 : 0;
        k.geos = G[sp].map(g0 => view(g0, k)); k.im.geometry = k.geos[k.lod]; k.im.material = mat; k.im.customDepthMaterial = dmat;
        // 색: 정사영상 색을 종 평균 대비 비율로만 써서 잎 그림 색을 살림 (나무마다 조금씩 다른 녹색)
        k.ids.forEach((i, j) => { const mu = mean[k.kind] || mean[0], tn = tone[k.kind] || tone[0], f = q => clamp(0.5 + 0.5 * (u8[i * 4 + q] / mu[q]), 0.7, 1.3);
          c.setRGB(f(0) * tn[0], f(1) * tn[1], f(2) * tn[2]); k.im.setColorAt(j, c); });
        if (k.im.instanceColor) k.im.instanceColor.needsUpdate = true;
      }
      for (const b of STREES.BURNT || []) { b.im.getColorAt(b.k, c); b.c0 = c.clone(); b.im.setColorAt(b.k, c.setRGB(0.035, 0.03, 0.025)); }
      // 숲길 장애물 나무 (FLANE.deco: 좁은 틈 소나무 · 기운 나무 끝 수관): 옛 둥근 공 수관 → 같은 고급 모형 · 세밀도도 현장 나무와 함께 바뀜 (STREES.CHUNKS 끝에 붙임)
      if (typeof FLANE !== 'undefined' && FLANE && FLANE.deco && FLANE.deco.length) {
        const M4 = new THREE.Matrix4(), by = new Map(), _v = new V3();
        for (const x of FLANE.deco) { const key = Math.floor(x.p.x / 120) + ',' + Math.floor(x.p.z / 120) + ',' + x.kind; if (!by.has(key)) by.set(key, []); by.get(key).push(x); }
        for (const [key, L] of by) {
          const kind = +key.split(',')[2], tn = tone[kind], im = new THREE.InstancedMesh(G[kind][2], mat, L.length), bb = new THREE.Box3();
          L.forEach((x, j) => { M4.compose(x.p, x.q, x.s); im.setMatrixAt(j, M4); const v = 0.92 + 0.16 * ((j * 0.618) % 1); im.setColorAt(j, c.setRGB(tn[0] * v, tn[1] * v, tn[2] * v));
            bb.expandByPoint(x.p); bb.expandByPoint(_v.set(0, x.s.y, 0).applyQuaternion(x.q).add(x.p)); x.old.forEach(o => { o.visible = false; }); });
          bb.expandByScalar(6); const sph = bb.getBoundingSphere(new THREE.Sphere()), k = { im, c: sph.center, r: sph.radius, lod: 2, kind, ids: [], bb, sph, deco: true };
          k.geos = G[kind].map(g0 => view(g0, k)); im.geometry = k.geos[2]; im.customDepthMaterial = dmat; im.castShadow = !LOWQ; im.receiveShadow = !LOWQ; im.frustumCulled = true; im.userData.irBase = 0.13;
          FLANE.G.add(im); STREES.CHUNKS.push(k);
        }
      }
      STREES.LODD.near = LOWQ ? 40 : 70; STREES.LODD.mid = LOWQ ? 130 : 210;   // 멀리는 임포스터(6 삼각형)라 중간 거리를 당김
      STREES.lod(camera.position);
    }
    // 2) 바깥 지역 나무 (OUTER): 조각마다 활엽·침엽 두 묶음 · 멀리 임포스터, 가까우면 중간 세밀도
    if (typeof OUTER !== 'undefined' && OUTER && OUTER.CK) {
      const T = OUTER.T, M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new V3(), P3 = new V3(), Y = new V3(0, 1, 0), c = new THREE.Color();
      for (const ck of OUTER.CK) {
        const meshes = [];
        for (const [list, sp] of [[ck.ls, 0], [ck.cs, 3]]) {
          if (!list || !list.length) continue;
          const im = new THREE.InstancedMesh(G[sp][2], mat, list.length), bb = new THREE.Box3();
          list.forEach((i, j) => { const t = T[i]; P3.set(t[0], t[1], t[2]); Q.setFromAxisAngle(Y, (i * 2.39) % 6.283); const r = sp ? t[4] * 1.15 : t[4] * 1.25; S3.set(r, t[3], r); M4.compose(P3, Q, S3); im.setMatrixAt(j, M4);
            const v = 0.82 + ((i * 7919) % 100) / 500; im.setColorAt(j, sp ? c.setRGB(0.5 * v, 0.6 * v, 0.5 * v) : c.setRGB(0.62 * v, 0.7 * v, 0.56 * v)); bb.expandByPoint(P3); bb.expandByPoint(S3.set(t[0], t[1] + t[3], t[2])); });
          bb.expandByScalar(6); const sph = bb.getBoundingSphere(new THREE.Sphere()); const geos = [1, 2].map(l => { const g = new THREE.BufferGeometry(), G0 = G[sp][l]; for (const a in G0.attributes) g.setAttribute(a, G0.attributes[a]); g.setIndex(G0.index); g.boundingSphere = sph; g.boundingBox = bb; return g; });
          im.geometry = geos[1]; im.castShadow = !LOWQ; im.receiveShadow = false; im.customDepthMaterial = dmat; im.userData.irBase = 0.13; meshes.push({ im, geos });
        }
        ck.grp.children.forEach(o => o.visible = false); meshes.forEach(m => ck.grp.add(m.im)); ck.t3 = meshes;
      }
      setInterval(() => { const cp = camera.position; for (const ck of OUTER.CK) if (ck.t3) { const near = Math.hypot(cp.x - ck.c.x, cp.z - ck.c.z) < OUTER.CH * 0.75 + 120; for (const m of ck.t3) m.im.geometry = m.geos[near ? 0 : 1]; } }, 250);
    }
    st.ready = true;
  }
  async function load() {
    try {
      st.t0 = performance.now();
      let lv = null, lods = null;
      const P = !window.SIM_TREES_JSON && window.__preload && window.__preload();   // 작업 스레드가 미리 만든 것 (아직이면 기다림 · 시험 판은 여기서 처음 띄움)
      if (P && P.trees) {   // 작업 스레드가 1분 안에 못 주면(멈춤 등) 예전 방식으로
        const r = await Promise.race([P.trees, new Promise(res => setTimeout(() => res(null), 60000))]).catch(e => { st.preErr = String(e && e.message || e); return null; });
        P.trees = null; if (r) { lv = r.lv; lods = r.lods; st.via = 'worker'; } else if (!st.preErr) st.preErr = 'timeout';
      }
      if (!lv) {   // 작업 스레드를 못 쓰면 예전처럼 화면 스레드에서 (그림 풀기는 decode 로 미리)
        const im = u => new Promise((res, rej) => { const i = new Image(); i.onload = () => i.decode ? i.decode().then(() => res(i), () => res(i)) : res(i); i.onerror = () => rej('img ' + u); i.src = u; });
        const v = '?v=' + (window.SIM_TREES_V || '');
        const [js, rgb, al] = await Promise.all([
          window.SIM_TREES_JSON ? Promise.resolve(window.SIM_TREES_JSON) : fetch(base + 'lib/trees.json' + v).then(r => r.ok ? r.json() : Promise.reject('json ' + r.status)),
          im(window.SIM_TREES_RGB || base + 'lib/trees_rgb.webp' + v), im(window.SIM_TREES_A || base + 'lib/trees_a.webp' + v)]);
        lv = coverageMips(rgbaFrom(rgb, al), 0.42 * 255); lods = js.lods; st.via = 'main';
      }
      const L0 = lv[0];
      const tex = new THREE.DataTexture(L0.data, L0.width, L0.height, THREE.RGBAFormat); tex.mipmaps = lv; tex.generateMipmaps = false; tex.flipY = false;
      tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); tex.needsUpdate = true;
      st.geo = lods.map(L => L.map(geoFrom));
      st.mat = makeMat(tex);
      st.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.42 });
      apply(); st.ms = Math.round(performance.now() - st.t0);
    } catch (e) { st.err = String(e); }
  }
  st.setIR = (on, night) => { st.ir.value = on ? 1 : 0; st.irv.value = night ? 0.02 : 0.07; st.ire.value = night ? 0.11 : 0.065; };
  st.tick = t => { st.time.value = t; };
  setTimeout(load, 0);   // 미리 만들어 둔 게 있으면 첫 장면부터 고급 나무 (무거운 계산은 작업 스레드)
  return st;
})();
if (window.__sim) Object.assign(window.__sim, { TREES3, STREES, OUTER });
