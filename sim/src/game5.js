// =====================================================================
//  기체 종류 · 새 임무 (숲길 통과 · 타임 레이스 · 정찰 · 타격)
//  속도·크기는 공개 제원 수준의 근사값 (기체 이름은 형상 참고용)
// =====================================================================
const AF = {
  x2d: { tag: 'X2D', name: 'Skydio X2D', sub: '정찰 쿼드 · 66 cm · 1.3 kg', cls: 'quad', top: 13.9, vmax: { train: 9, easy: 12, sport: 13.9 }, tilt: { train: 25, easy: 32, sport: 38 }, climb: 6, sink: 4, yaw: 120, tw: 1.15, R: 0.24, endur: 35, drop: true,
    note: '자세 안정 · 정지 비행 · 투하 장치' },
  anafi: { tag: 'ANAFI', name: 'Parrot ANAFI USA', sub: '소형 정찰 쿼드 · 37 cm · 0.5 kg', cls: 'quad', top: 14.7, vmax: { train: 9, easy: 12, sport: 14.7 }, tilt: { train: 25, easy: 32, sport: 40 }, climb: 4, sink: 4, yaw: 140, tw: 1.15, R: 0.17, endur: 32, reconD: 520,
    note: '32배 줌 · 먼 거리 정찰 · IP53' },
  fpv: { tag: 'FPV', name: 'FPV 레이싱', sub: '5인치 · 0.65 kg', cls: 'quad', top: 39, vmax: { train: 12, easy: 24, sport: 39 }, tilt: { train: 30, easy: 50, sport: 72 }, climb: 15, sink: 9, yaw: 320, tw: 3.5, R: 0.13, endur: 5, acro: true, mass: 0.65, twr: 4.5, tauM: 0.1,
    note: '매우 빠름 · ACRO 모드에서 완전 수동 (플립·배면)' },
  fw: { tag: 'RAVEN', name: 'RQ-11B Raven', sub: '고정익 정찰 · 손 투척 · 날개 1.37 m · 2.1 kg', cls: 'wing', cruise: 13, top: 22.6, stall: 8.7, span: 1.37, R: 0.45, endur: '60~90', bank: 50, nmax: 1.8, minAgl: 26, prate: 70, rrate: 160,
    note: '정지 불가 · 선회로 방향 전환 · 실속 주의' },
  puma: { tag: 'PUMA', name: 'RQ-20B Puma', sub: '고정익 정찰 · 날개 2.8 m · 6.1 kg', cls: 'wing', cruise: 14, top: 23, stall: 10.3, span: 2.8, R: 0.9, endur: 210, bank: 45, nmax: 1.6, minAgl: 30, prate: 50, rrate: 90, reconD: 600,
    note: '3.5시간 체공 · 큰 날개로 안정적 · 선회 반경 큼' },
  kfpv: { tag: 'K-FPV', name: '자폭 FPV', sub: '7인치 · 탄두 모형 · 1.6 kg', cls: 'quad', top: 30, vmax: { train: 12, easy: 20, sport: 30 }, tilt: { train: 30, easy: 45, sport: 65 }, climb: 10, sink: 8, yaw: 240, tw: 2.2, R: 0.17, endur: 8, acro: true, kam: true, mass: 1.6, twr: 2.8, tauM: 0.13,
    note: '부딪히면 기폭 · 표적에 직접 돌입' },
  kfw: { tag: 'K-FW', name: '자폭 고정익', sub: '배회형 · 날개 0.7 m', cls: 'wing', cruise: 26, top: 44, stall: 15, span: 0.7, R: 0.3, endur: 15, bank: 60, nmax: 2.6, minAgl: 10, prate: 90, rrate: 220, kam: true,
    note: '공중 발사 · 급강하로 표적 돌입' }
};
const AF_IDS = Object.keys(AF);
AF_IDS.forEach(k => AF[k].id = k);
const MS_OK = { course: ['x2d'], forest: ['x2d', 'anafi', 'fpv', 'kfpv'], race: ['x2d', 'anafi', 'fpv', 'fw', 'puma', 'kfw'], recon: ['x2d', 'anafi', 'fw', 'puma'], fire: ['x2d', 'anafi', 'fw', 'puma'], sar: ['x2d', 'anafi', 'fw', 'puma'], track: ['x2d', 'anafi', 'fw', 'puma'], ridge: ['x2d', 'anafi', 'fpv', 'fw', 'puma'], strike: ['kfpv', 'kfw'], free: AF_IDS, tutorial: ['x2d'], demo: ['x2d'] };
if (!AF[SET.af]) SET.af = 'x2d';
const MS_NAME = { forest: '숲길 통과', race: '타임 레이스', recon: '정찰', strike: '타격', fire: '산불 감시', sar: '수색·구조', track: '차량 추적', ridge: '능선 종주' };
function AFc() { return AF[SET.af] || AF.x2d; }
function isMission(k) { k = k || S.kind; return k === 'forest' || k === 'race' || k === 'recon' || k === 'strike' || k === 'fire' || k === 'sar' || k === 'track' || k === 'ridge' || k === 'field' || k === 'class1' || k === 'class1x' || k === 'class1d'; }
MS_OK.field = ['x2d', 'anafi', 'fpv', 'fw', 'puma']; MS_NAME.field = window.SIM_LANG === 'en' ? 'Field airstrip' : '야전 착륙장';
// 난이도 + 기체 -> 비행 특성
function effMode() {
  const m = MODES[SET.diff], a = AFc(), fk = SET.feel === 'train' ? 'train' : SET.feel === 'real' ? 'sport' : 'easy';   // 비행감: 속도·기울기·회전 한계
  const o = Object.assign({}, m);
  if (a.vmax) { o.vmax = a.vmax[fk] || a.vmax.easy; o.maxTilt = a.tilt[fk] * DEG; }
  if (a.yaw && a.id !== 'x2d') o.yawRate = a.yaw * DEG * (fk === 'train' ? 0.45 : fk === 'easy' ? 0.7 : 1);
  if (a.acro && SET.acro && SET.diff === 'sport') { o.althold = false; o.acro = true; o.brake = 0; }
  return o;
}

// ---------------- 기체 형상 ----------------
function partsKit(ghost) {
  const g = new THREE.Group(), gm = ghost ? new THREE.MeshBasicMaterial({ color: 0x55e6ff, transparent: true, opacity: 0.38, depthWrite: false }) : null;
  const m = c => gm || c;
  const add = (geo, mt, x, y, z, sx, sy, sz, par) => { const me = new THREE.Mesh(paintGeo(geo, mt, sx, sy, sz), mt); me.position.set(x, y, z); if (sx) me.scale.set(sx, sy, sz); me.castShadow = !ghost; (par || g).add(me); return me; };
  const LM = c => gm || new THREE.MeshBasicMaterial({ color: c });
  return { g, m, add, LM, gm };
}
function propHub(K, x, y, z, r, blades, up, col) {
  const hub = new THREE.Group(); hub.position.set(x, y, z); K.g.add(hub);
  const bm = K.m(mat(col || 0x222428, { roughness: 0.45 }));
  const sh = new THREE.Shape(); sh.moveTo(0.08 * r, -0.07 * r); sh.lineTo(0.45 * r, -0.12 * r); sh.lineTo(0.85 * r, -0.07 * r); sh.lineTo(r, 0); sh.lineTo(0.85 * r, 0.07 * r); sh.lineTo(0.45 * r, 0.12 * r); sh.lineTo(0.08 * r, 0.07 * r); sh.closePath();   // 날: 가운데 넓고 끝이 둥근 평면형
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.0015, bevelEnabled: false }); bg.rotateX(-Math.PI / 2);   // 모양의 y → -z (지름 방향 x)
  for (let i = 0; i < blades; i++) { const a = i / blades * Math.PI * 2, b = new THREE.Mesh(bg, bm); b.rotation.y = -a; b.rotation.x = 0.22; b.castShadow = !K.gm; hub.add(b); }
  K.add(UCYL, K.m(mat(0x3a3e44, { roughness: 0.4, metalness: 0.5 })), 0, 0.001, 0, r * 0.11, 0.006, r * 0.11, hub);   // 허브
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), K.gm || new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2; hub.add(disc);
  return hub;
}
const UCONE = new THREE.ConeGeometry(1, 1, 16);
// 칠한 재질(위장)이면 돌출 형상의 UV 를 0.3 m 한 장 기준으로
function uvScale(geo, mt) { if (mt && mt.userData && mt.userData.paint && mt.map) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / CAMO_M, uv.getY(i) / CAMO_M); } return geo; }
// 날개 평면형(뿌리 시위 cr → 끝 시위 ct, 앞전 후퇴 sweep, 두께 th, 상반각 dih) — 좌우 두 쪽, 앞 = -z
function wingPlan(K, mt, span, cr, ct, sweep, th, dih, y, z) {
  const grp = new THREE.Group(); grp.position.set(0, y, z); K.g.add(grp); const h = span / 2, le = cr * 0.3;
  for (const sg of [1, -1]) {
    const sh = new THREE.Shape(); sh.moveTo(0, le); sh.lineTo(sg * h, le - sweep); sh.lineTo(sg * h, le - sweep - ct); sh.lineTo(0, le - cr); sh.closePath();
    const g = uvScale(new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }), mt); g.translate(0, 0, -th / 2);
    const m = new THREE.Mesh(g, mt); m.rotation.x = -Math.PI / 2; m.castShadow = !K.gm; const piv = new THREE.Group(); piv.rotation.z = sg * dih; piv.add(m); grp.add(piv);
  }
  return grp;
}
// 수직면(꼬리 지느러미): 시위 cr → ct, 높이 hgt (위 +), 앞전 후퇴 sweep, 두께 th
function finPlan(K, mt, cr, ct, hgt, sweep, th, x, y, z) {
  const P = hgt > 0 ? [[0, 0], [cr, 0], [sweep + ct, hgt], [sweep, hgt]] : [[0, 0], [sweep, hgt], [sweep + ct, hgt], [cr, 0]];   // 아래로 난 지느러미도 같은 방향으로 돌게
  const sh = new THREE.Shape(); sh.moveTo(P[0][0], P[0][1]); for (let k = 1; k < 4; k++) sh.lineTo(P[k][0], P[k][1]); sh.closePath();
  const g = uvScale(new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }), mt); g.translate(-cr * 0.3, 0, -th / 2);
  const m = new THREE.Mesh(g, mt); m.rotation.y = -Math.PI / 2; m.position.set(x, y, z); m.castShadow = !K.gm; K.g.add(m); return m;   // 모양의 +x(시위) → 세계 +z(뒤)
}
function makeQuadFPV(ghost, kam) {
  const K = partsKit(ghost), S7 = kam ? 1.45 : 1;
  const carbon = K.m(pm(0x161718, { roughness: 0.4, metalness: 0.3 }, 1)), dark = K.m(mat(0x1e2023, { roughness: 0.5, metalness: 0.2 }));
  const mot = K.m(mat(kam ? 0x55606a : 0x8e3a30, { roughness: 0.32, metalness: 0.8 })), alu = K.m(mat(0x9aa0a6, { roughness: 0.35, metalness: 0.8 }));
  const PL = 0.05 * S7, PW = 0.16 * S7;
  // 판 하나: (x, 앞+) 평면 다각형을 두께 th 로 뽑고 모서리 둥글림 · y0 = 바닥
  const slab = (pts, th, bev, mt, y0, x0, z0, ry) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.0005, th - bev * 2), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2 }); geo.rotateX(-Math.PI / 2); geo.translate(0, y0 + bev, 0); uvScale(geo, mt);
    const me = new THREE.Mesh(geo, mt); me.position.set(x0 || 0, 0, z0 || 0); me.rotation.y = ry || 0; me.castShadow = !K.gm; K.g.add(me); return me; };
  const rr = (w, l, c) => [[-w + c, -l], [w - c, -l], [w, -l + c], [w, l - c], [w - c, l], [-w + c, l], [-w, l - c], [-w, -l + c]];   // 모서리 깎은 직사각형 (반폭 w · 반길이 l)
  const tpu = K.m(mat(kam ? 0x3b4232 : 0xb8461f, { roughness: 0.75 }));   // 3D 프린트 TPU 부품 (주황 · 자폭형은 국방색)
  slab(rr(PL * 0.62, PW * 0.42, 0.008), 0.005, 0.0012, carbon, -0.0025);                     // 아래 판 (가운데)
  slab(rr(PL * 0.5, PW * 0.36, 0.007), 0.003, 0.001, carbon, 0.028);                          // 위 판
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.add(UCYL, alu, sx * PL * 0.4, 0.0145, sz * PW * 0.3, 0.0028, 0.026, 0.0028);   // 기둥 4개
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.add(UCYL, alu, sx * PL * 0.4, 0.031, sz * PW * 0.3, 0.004, 0.0018, 0.004);     // 기둥 나사
  // 비행 제어기·ESC 스택 (판 사이): 녹색 기판 두 장 + 커패시터
  const pcb = K.m(mat(0x1d3b2a, { roughness: 0.55, metalness: 0.1 }));
  K.add(UBOX, pcb, 0, 0.008, 0.004, 0.03, 0.0016, 0.03); K.add(UBOX, pcb, 0, 0.017, 0.004, 0.03, 0.0016, 0.03);
  K.add(UCYL, K.m(mat(0x1a1c1e, { roughness: 0.4, metalness: 0.4 })), 0, 0.01, 0.04 * S7, 0.005, 0.016, 0.005).rotation.x = Math.PI / 2;
  const props = [];
  for (const [x, z] of [[0.085, -0.075], [-0.085, -0.075], [0.085, 0.075], [-0.085, 0.075]]) {
    const X = x * S7, Z = z * S7, L = Math.hypot(X, Z), r0 = 0.012 * S7, r1 = 0.0085 * S7, pr = 0.0155 * S7;
    // 팔: 뿌리가 넓고 모터 쪽이 좁은 한 장짜리 탄소 판 + 둥근 모터 자리 + 가운데 가벼움 구멍 자리(어두운 띠)
    slab([[-r0, 0.02], [r0, 0.02], [r1, L - pr * 0.6], [-r1, L - pr * 0.6]], 0.005, 0.0012, carbon, -0.0025, 0, 0, Math.atan2(X, Z) + Math.PI);
    K.add(UCYL, carbon, X, 0, Z, pr, 0.005, pr);                                        // 모터 자리
    { const hb = K.add(UBOX, dark, X * 0.55, 0.0028, Z * 0.55, 0.005, 0.0006, L * 0.32); hb.rotation.y = Math.atan2(X, Z); }
    // 모터: 아래 고정부 · 코일이 보이는 틈 · 벨(종) · 위 덮개 · 축
    K.add(UCYL, dark, X, 0.005, Z, 0.0125 * S7, 0.005, 0.0125 * S7);
    K.add(UCYL, K.m(mat(0xb87333, { roughness: 0.35, metalness: 0.9 })), X, 0.009, Z, 0.0112 * S7, 0.004, 0.0112 * S7);   // 구리 코일 틈
    K.add(UCYL, mot, X, 0.017, Z, 0.0135 * S7, 0.012, 0.0135 * S7);                      // 모터 벨
    K.add(UCYL, dark, X, 0.0235, Z, 0.0115 * S7, 0.0015, 0.0115 * S7);                   // 벨 윗면
    K.add(UCYL, alu, X, 0.027, Z, 0.0055, 0.006, 0.0055);                                // 축 너트
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, b = K.add(UBOX, dark, X + Math.cos(a) * 0.0128 * S7, 0.017, Z + Math.sin(a) * 0.0128 * S7, 0.002, 0.009, 0.004); b.rotation.y = -a; }   // 벨 구멍
    K.add(UBOX, tpu, X * 0.82, -0.004, Z * 0.82, 0.008, 0.004, 0.012).rotation.y = Math.atan2(X, Z);   // 팔 아래 TPU 범퍼
    props.push(propHub(K, X, 0.031, Z, 0.064 * S7, 3, 1, kam ? 0x30343a : 0x1e2a3c));
  }
  K.add(UBOX, K.m(pm(0x23262b, { roughness: 0.6 }, 2)), 0, 0.045, 0.012, 0.034 * S7, 0.024, 0.068 * S7);              // 배터리
  K.add(UBOX, K.m(mat(0x34404e, { roughness: 0.6 })), 0, 0.045, 0.012, 0.0345 * S7, 0.0245, 0.03 * S7);                // 배터리 라벨 띠
  K.add(UBOX, K.m(mat(0x101214, { roughness: 0.8 })), 0, 0.045, -0.012 * S7, 0.037 * S7, 0.027, 0.01);                // 배터리 고정 띠
  K.add(UBOX, K.m(mat(0xf1c21b, { roughness: 0.5 })), 0.01, 0.038, 0.05 * S7, 0.01, 0.008, 0.012);                     // XT60
  { const cam = new THREE.Group(); cam.position.set(0, 0.016, -0.062 * S7); cam.rotation.x = 0.45; K.g.add(cam);        // FPV 카메라 (위로 25° 기울임)
    K.add(UBOX, K.m(mat(0x1b1d20, { roughness: 0.35 })), 0, 0, 0.002, 0.019, 0.019, 0.018, cam);
    K.add(UCYL, alu, 0, 0, -0.009, 0.0085, 0.006, 0.0085, cam).rotation.x = Math.PI / 2;
    K.add(UCYL, K.m(mat(0x0a1420, { roughness: 0.05, metalness: 0.6 })), 0, 0, -0.0125, 0.0068, 0.002, 0.0068, cam).rotation.x = Math.PI / 2; }
  for (const sx of [-1, 1]) { K.add(UBOX, tpu, sx * 0.0122, 0.017, -0.058 * S7, 0.003, 0.03, 0.03); K.add(UCYL, alu, sx * 0.0142, 0.016, -0.062 * S7, 0.003, 0.002, 0.003).rotation.z = Math.PI / 2; }   // TPU 카메라 옆판 + 각도 나사
  K.add(UBOX, tpu, 0, 0.034, 0.068 * S7, 0.016, 0.01, 0.014);                                                          // 뒤 TPU 안테나 받침
  K.add(UBOX, K.m(mat(0x101214, { roughness: 0.9 })), 0, 0.0315, 0.012, 0.036 * S7, 0.003, 0.07 * S7);                  // 배터리 미끄럼 방지 패드
  const ant = K.add(UCYL6, dark, 0, 0.06, 0.065 * S7, 0.0018, 0.055, 0.0018); ant.rotation.x = -0.6;                    // 영상 송신 안테나 (뒤로 비스듬히)
  K.add(USPH, K.m(mat(0x202326, { roughness: 0.6 })), 0, 0.082, 0.083 * S7, 0.0055, 0.0055, 0.0055);
  for (const sx of [-1, 1]) { const w = K.add(UCYL6, dark, sx * 0.02, 0.045, 0.075 * S7, 0.0012, 0.05, 0.0012); w.rotation.x = -1.0; w.rotation.z = sx * 0.5; }   // 수신 안테나 2
  if (!kam) { K.add(UBOX, K.m(mat(0x26292d, { roughness: 0.35 })), 0, 0.066, -0.014, 0.03, 0.02, 0.024); K.add(UCYL, alu, -0.007, 0.066, -0.027, 0.006, 0.004, 0.006).rotation.x = Math.PI / 2; K.add(UBOX, K.m(mat(0x0a1420, { roughness: 0.1 })), 0.006, 0.07, -0.0265, 0.008, 0.006, 0.001); }   // 액션캠 (렌즈·작은 화면)
  else {   // 탄두 모형 (아래 원통) + 지느러미
    const olive = K.m(mat(0x5a6646, { roughness: 0.7 }));
    { const P = [[0, -0.13], [0.012, -0.125], [0.024, -0.11], [0.031, -0.09], [0.032, -0.07], [0.032, 0.08], [0.026, 0.1], [0, 0.105]].map(([r, z]) => new THREE.Vector2(r, z));   // 탄두: 둥근 앞머리 원통
      const geo = new THREE.LatheGeometry(P, 18); geo.rotateX(Math.PI / 2); const w = new THREE.Mesh(geo, olive); w.position.set(0, -0.04, 0); w.castShadow = !K.gm; K.g.add(w); }
    K.add(UCYL, K.m(mat(0xc9a227, { roughness: 0.6 })), 0, -0.04, -0.06, 0.0338, 0.006, 0.0338).rotation.x = Math.PI / 2;   // 노란 띠
    K.add(USPH, K.m(mat(0x8a8f93, { roughness: 0.3, metalness: 0.8 })), 0, -0.04, -0.128, 0.006, 0.006, 0.006);            // 신관 끝
    for (const sx of [-1, 1]) K.add(UBOX, K.m(mat(0x1a1c1e, { roughness: 0.8 })), sx * 0.02, -0.012, 0, 0.004, 0.02, 0.012);   // 탄두 묶는 띠
    for (let k = 0; k < 4; k++) { const f = K.add(UBOX, olive, 0, -0.04, 0.07, 0.003, 0.03, 0.03); f.rotation.z = k * Math.PI / 2; f.translateY(0.04); }
    K.add(UCYL6, carbon, 0.02, 0.06, 0.09, 0.003, 0.08, 0.003).rotation.x = -0.4;
  }
  K.add(UBOX, K.LM(0xff2a2a), 0, 0.0, 0.068 * S7, 0.026, 0.003, 0.002);                                                // 뒤 LED 띠
  const ledG = K.add(USPH, K.LM(0x30ff60), 0.085 * S7, -0.004, 0.075 * S7, 0.003, 0.003, 0.003), ledR = K.add(USPH, K.LM(0xff3030), -0.085 * S7, -0.004, 0.075 * S7, 0.003, 0.003, 0.003);   // 뒤 팔 끝 아래
  return { g: K.g, props, cans: [], leds: [ledG, ledR] };
}
function makeWing(ghost, kam) {
  const K = partsKit(ghost), span = kam ? 0.7 : 1.4, BL = kam ? 0.6 : 1.0, BZ = kam ? 0 : -0.1;   // 동체 길이(실물 비율: Raven 0.9~1 m · 배회형 0.6 m) · 동체 중심
  const body = K.m(pm(kam ? 0x59624a : 0xb4bac2, { roughness: 0.6 }, 1)), dark = K.m(mat(0x2a2d31, { roughness: 0.5 })), wingM = K.m(pm(kam ? 0x4d5640 : 0xc8cdd3, { roughness: 0.58 }, 1));
  const ctl = K.m(pm(kam ? 0x3f4734 : 0xb9bec4, { roughness: 0.55 }, 2)), alu = K.m(mat(0x9aa0a6, { roughness: 0.35, metalness: 0.8 })), glass = K.m(mat(0x1b1d1f, { roughness: 0.2 }));
  let f;
  if (kam) {   // 튜브 발사형 동체: 탄두 앞머리(오지브) → 곧은 원통 → 뒤 모터 쪽으로 살짝 가늘어짐
    const P = [[0, -0.3], [0.014, -0.295], [0.027, -0.275], [0.037, -0.245], [0.043, -0.21], [0.045, -0.17], [0.045, 0.2], [0.04, 0.26], [0.03, 0.29], [0, 0.3]].map(([r, z]) => new THREE.Vector2(r, z));
    const geo = new THREE.LatheGeometry(P, 20); geo.rotateX(Math.PI / 2); uvScale(geo, body);
    f = new THREE.Mesh(geo, body); f.position.set(0, 0, BZ); f.castShadow = !K.gm; K.g.add(f);
    const band = K.m(mat(0x2a2e26, { roughness: 0.6 }));
    for (const z of [-0.17, -0.05, 0.16]) K.add(UCYL, band, 0, 0, z, 0.0475, 0.006, 0.0475).rotation.x = Math.PI / 2;   // 이음 띠 (탄두 · 전자부 · 모터부)
    K.add(USPH, K.m(mat(0x101418, { roughness: 0.05, metalness: 0.5 })), 0, 0, -0.293, 0.012, 0.012, 0.01);             // 탐색기 창 (앞 끝)
    K.add(UCYL, K.m(mat(0xc9a227, { roughness: 0.6 })), 0, 0, -0.13, 0.0478, 0.008, 0.0478).rotation.x = Math.PI / 2;    // 노란 탄두 표지 띠
    for (const sx of [-1, 1]) K.add(UBOX, band, sx * 0.04, 0.02, -0.12, 0.012, 0.01, 0.03);                              // 앞 날개 접힘 경첩
    for (const sx of [-1, 1]) K.add(UBOX, band, sx * 0.04, -0.015, 0.2, 0.012, 0.01, 0.03);                              // 뒤 날개 접힘 경첩
  }
  else {   // 동체: 둥근 기수 → 굵은 몸통 → 꼬리 쪽으로 가늘어짐 (회전체 · 위아래로 조금 높게)
    const P = [[0, -0.6], [0.022, -0.592], [0.04, -0.565], [0.052, -0.52], [0.058, -0.44], [0.06, -0.2], [0.056, -0.05], [0.045, 0.12], [0.03, 0.28], [0.016, 0.38], [0, 0.4]].map(([r, z]) => new THREE.Vector2(r, z - BZ));
    const geo = new THREE.LatheGeometry(P, 20); geo.rotateX(Math.PI / 2); geo.scale(1, 1.12, 1); uvScale(geo, body);
    f = new THREE.Mesh(geo, body); f.position.set(0, 0, BZ); f.castShadow = !K.gm; K.g.add(f);
  }
  if (kam) {   // 앞·뒤 두 쌍 날개 (튜브 발사형) + 십자 꼬리
    wingPlan(K, wingM, span, 0.075, 0.055, 0.01, 0.007, 0.03, 0.03, -0.12); wingPlan(K, wingM, span * 0.85, 0.065, 0.045, 0.008, 0.007, 0.03, -0.02, 0.2);
    finPlan(K, wingM, 0.06, 0.04, 0.09, 0.015, 0.005, 0, 0.03, 0.26); finPlan(K, wingM, 0.05, 0.035, -0.07, 0.012, 0.005, 0, -0.03, 0.26);
    K.add(UBOX, K.m(mat(0x0c1218, { roughness: 0.08, metalness: 0.5 })), 0, -0.043, -0.2, 0.02, 0.006, 0.03);   // 아래 카메라 창
    for (const sx of [-1, 1]) K.add(UBOX, dark, sx * 0.03, -0.01, 0.1, 0.006, 0.004, 0.08);   // 발사관 걸림쇠
  } else {
    const WY = 0.09;   // 주익은 동체 위 받침(파일론) 위에 얹힘 (고익)
    { const pyl = K.add(UBOX, body, 0, 0.068, -0.08, 0.05, 0.04, 0.2); }                      // 날개 받침
    wingPlan(K, wingM, span, 0.2, 0.13, 0.03, 0.012, 0.05, WY, -0.08);                         // 주익 (끝으로 가늘어지고 3° 상반각)
    for (const sx of [-1, 1]) {
      const a = K.add(UBOX, ctl, sx * span * 0.36, WY - 0.004 + span * 0.36 * 0.05, 0.025, span * 0.26, 0.006, 0.03);   // 에일러론 (뒷전 바깥쪽)
      a.rotation.z = sx * 0.05;
      const jn = K.add(UBOX, dark, sx * span * 0.19, WY + 0.0005 + span * 0.19 * 0.05, -0.08, 0.004, 0.014, 0.19); jn.rotation.z = sx * 0.05;   // 날개 이음매 (3조각 날개)
      const wt = K.add(UBOX, wingM, sx * span * 0.5, WY + 0.035 + span * 0.5 * 0.05, -0.06, 0.01, 0.06, 0.12); wt.rotation.x = -0.2;   // 윙릿
      K.add(USPH, K.LM(sx > 0 ? 0x30ff60 : 0xff3030), sx * span * 0.5, WY + span * 0.5 * 0.05, -0.1, 0.008, 0.008, 0.008);           // 항법등 (날개 끝)
    }
    K.add(UCYL6, alu, span * 0.22, WY + 0.01, -0.2, 0.003, 0.07, 0.003).rotation.x = Math.PI / 2;   // 피토관
    K.add(UCYL, dark, 0, WY + 0.012, 0.0, 0.026, 0.006, 0.026);                                   // GPS 안테나 (날개 위 원반)
    for (const sx of [-1, 1]) K.add(UBOX, dark, sx * 0.061, 0.0, -0.3, 0.003, 0.012, 0.05);       // 옆 냉각 구멍
    K.add(UBOX, ctl, 0, 0.05, 0.1, 0.05, 0.008, 0.12);                                          // 배터리 덮개 (등)
    K.add(UBOX, dark, 0, -0.045, -0.12, 0.05, 0.02, 0.14);                                     // 배 탑재 칸
    K.add(UBOX, dark, 0, 0.02, 0.45, 0.012, 0.012, 0.42);                                      // 꼬리 붐
    wingPlan(K, wingM, 0.46, 0.11, 0.07, 0.02, 0.008, 0, 0.03, 0.66);                          // 수평 꼬리
    K.add(UBOX, ctl, 0, 0.03, 0.72, 0.4, 0.004, 0.025);                                        // 승강타
    finPlan(K, wingM, 0.12, 0.06, 0.16, 0.05, 0.008, 0, 0.03, 0.62);                           // 수직 꼬리
    finPlan(K, wingM, 0.07, 0.04, -0.05, 0.02, 0.006, 0, 0.012, 0.6);                          // 배 지느러미
    K.add(UCYL6, dark, 0.015, 0.1, 0.5, 0.0015, 0.08, 0.0015).rotation.x = 0.3;                // 안테나
    K.add(UCYL, dark, 0, -0.06, -0.3, 0.022, 0.02, 0.022);                                     // 짐벌 목
    const gb = K.add(USPH, K.m(mat(0x2c3035, { roughness: 0.45, metalness: 0.3 })), 0, -0.085, -0.3, 0.036, 0.034, 0.036);   // 짐벌 공 (기수 아래)
    K.add(UCYL, glass, -0.012, -0.088, -0.333, 0.011, 0.006, 0.011).rotation.x = Math.PI / 2;  // 주간 렌즈
    K.add(UCYL, K.m(mat(0x1a1408, { roughness: 0.1, metalness: 0.7 })), 0.013, -0.088, -0.332, 0.009, 0.006, 0.009).rotation.x = Math.PI / 2;   // 열상 렌즈
  }
  const PZ = kam ? BZ + BL / 2 + 0.02 : BZ - BL / 2 - 0.02, props = [propHub(K, 0, 0, PZ, kam ? 0.07 : 0.1, 2, 1)];   // 정찰 고정익은 기수 프로펠러(트랙터) · 배회형은 뒤(푸셔)
  props[0].rotation.x = Math.PI / 2;
  const sp = K.add(UCONE, alu, 0, 0, PZ + (kam ? 0.025 : -0.025), 0.018, 0.045, 0.018); sp.rotation.x = kam ? Math.PI / 2 : -Math.PI / 2;   // 스피너
  const LY = kam ? 0.05 : 0.09 + span * 0.025, ledG = K.add(USPH, K.LM(0x30ff60), span / 2, LY, -0.08, 0.006, 0.006, 0.006), ledR = K.add(USPH, K.LM(0xff3030), -span / 2, LY, -0.08, 0.006, 0.006, 0.006);
  return { g: K.g, props, cans: [], leds: [ledG, ledR], wing: true };
}
// 기체 재질용 스튜디오 환경 (PMREM): 금속·광택이 하늘·바닥을 비춰 보이게 — 격납고와 비행 중 둘 다 (장면 전체가 아니라 기체 재질에만)
let MODEL_ENV = null;
function modelEnv() {
  if (MODEL_ENV) return MODEL_ENV;
  try {
    const sc = new THREE.Scene(), em = (c, i) => new THREE.MeshBasicMaterial({ color: c }), box = (c, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(UBOX, em(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); sc.add(m); return m; };
    sc.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 16), new THREE.MeshBasicMaterial({ color: 0x8fb4d8, side: THREE.BackSide })));   // 하늘빛 방
    box(0xffffff, 0, 8, 0, 6, 0.2, 6); box(0xfff2d8, 6, 5, -4, 0.2, 4, 3); box(0xdfe9f2, -6, 4, 3, 0.2, 3, 4); box(0xaab8c4, 0, 3, -9, 5, 2, 0.2);   // 천장 큰 등 · 옆 창 두 개 · 뒤 밝은 벽
    box(0x3a4a3a, 0, -6, 0, 30, 0.2, 30);   // 바닥은 어두운 풀빛 (아래쪽 반사)
    const pg = new THREE.PMREMGenerator(renderer); MODEL_ENV = pg.fromScene(sc, 0.04).texture; pg.dispose();
  } catch (e) { MODEL_ENV = null; }
  return MODEL_ENV;
}
function envApply(g, k) { const env = modelEnv(); if (!env) return; g.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial && !o.material.userData.noEnv) { o.material.envMap = env; o.material.envMapIntensity = k; o.material.needsUpdate = true; } }); }
function makeModel(id, ghost) { const m = makeModel0(id, ghost); if (!ghost) envApply(m.g, 0.45); return m; }
function makeModel0(id, ghost) {
  if (id === 'fpv') return makeQuadFPV(ghost, false);
  if (id === 'kfpv') return makeQuadFPV(ghost, true);
  if (id === 'fw') return makeWing(ghost, false);
  if (id === 'puma') { const w = makeWing(ghost, false); w.g.scale.setScalar(2.0); return w; }
  if (id === 'anafi') {   // X2D 형상을 줄이고 투하 장치·안테나는 뗌
    const d = makeDrone(ghost); d.g.scale.setScalar(0.56); d.cans.forEach(c => d.g.remove(c)); d.g.children.filter(c => c.geometry === UCYL6).forEach(c => d.g.remove(c)); d.cans = []; return d;
  }
  if (id === 'kfw') return makeWing(ghost, true);
  if (id === 'c1' && typeof makeC1 === 'function') return makeC1(ghost);
  return makeDrone(ghost);
}
let MODEL_ID = 'x2d', MODEL_PAINT = '';
function paintKey(id) { const k = (SET.paint || {})[id || SET.af]; return PAINTS[k] && !/^(yellow|red|cyan)$/.test(k) ? k : ''; }   // 기체별로 고른 색 (없으면 원래 색 · 목록에서 뺀 노랑·빨강·하늘은 기본으로)
function paintVal(k) { if (!k) return null; const v = PAINTS[k]; if (Array.isArray(v)) { const a = v.slice(); a.key = k; return a; } return v; }   // 모델에 넘길 값: 단색 숫자 / 위장 배열(+key)
function setAirframe(id) {
  if (!AF[id]) id = 'x2d'; SET.af = id; saveSet();
  const pk = paintKey(id);
  if (MODEL_ID !== id || MODEL_PAINT !== pk) {
    PAINT = paintVal(pk); scene.remove(droneM.g); droneM = makeModel(id, false); scene.add(droneM.g); PAINT = null;
    scene.remove(ghostM.g); ghostM = makeModel(id, true); ghostM.g.visible = false; scene.add(ghostM.g);
    MODEL_ID = id; MODEL_PAINT = pk;
  }
  DR.R = AFc().R;
  ui.payload.style.display = AFc().drop ? '' : 'none';
  if (typeof syncSeg === 'function') syncSeg();
}

// ---------------- 고정익 비행 ----------------
function camK() { const a = AFc(); return a.cls === 'wing' ? 2.4 : a.id === 'anafi' || a.id === 'fpv' ? 0.85 : 1; }
function wingAir(p, h) {   // 공중에서 시작 (손 투척·발사 직후)
  const a = AFc(); DR.p.copy(p); DR.p.y = Math.max(DR.p.y, groundAt(p.x, p.z) + 25); DR.h = h; DR.as = a.cruise; DR.pitch = 0; DR.roll = 0; DR.landed = false; DR.alive = true; DR.gnd = false; DR.liftT = -99;
  DR.v.set(Math.sin(h) * a.cruise, 0, -Math.cos(h) * a.cruise); DR.altT = DR.p.y;
}
const WARN = { t: 0 };
function stepWing(dt) {
  // 조종 단계: 입문·쉬움 = 자동조종(고도·속도 유지, 지형 회피, 실속 보호) · ATTI = 자세 안정 수동(스로틀 직접, 실속 가능) · 스포츠 = 완전 수동(기울기 유지, 실속·스핀)
  const a = AFc(), assist = SET.assist && (SET.diff === 'train' || SET.diff === 'easy'), rate = SET.diff === 'sport';
  if (DR.gnd) return wingRoll(dt, a);
  const appr = rwyApproach();
  const stun = S.stun > 0 ? 0.3 : 1; if (S.stun > 0) S.stun -= dt;
  let ip = IN.pitch * stun, ir = IN.roll * stun; const iy = IN.yaw * stun;
  let V = DR.as || a.cruise;
  // 실속 속도는 하중 배수의 제곱근에 비례: 기울여 선회하면 더 빠른 속도에서 실속 (60° 기울기 = 1.41배)
  const n0 = 1 / Math.max(0.2, Math.cos(DR.roll)), vsE = a.stall * Math.sqrt(Math.min(n0, a.nmax * 1.4));
  const stall = DR.stalled ? V < vsE * 1.06 : V < vsE, warn = !stall && V < vsE * 1.15;
  if (stall && !DR.stalled && !assist) { DR.wdrop = (Math.random() < 0.5 ? -1 : 1); DR.roll += DR.wdrop * (14 + Math.random() * 16) * DEG; }   // 실속 순간 한쪽 날개가 떨어짐
  DR.stalled = stall;
  if (stall) ir *= 0.35;   // 실속: 보조익이 잘 안 먹음
  WARN.t -= dt; if ((warn || stall) && WARN.t <= 0) { WARN.t = stall ? 0.45 : 0.8; sfx('bad'); if (typeof rumble === 'function') rumble(stall ? 0.6 : 0.25, 0.4, 120); }
  S.stallWarn = warn;
  if (stall || warn) shake = Math.max(shake, stall ? 0.05 : 0.018);   // 버핏(떨림)
  if (assist) {
    // 고도 유지: 스틱 놓으면 그 고도, 땅이 가까우면 자동 상승
    if (Math.abs(ip) > 0.05) DR.altT = DR.p.y;
    const ahead = Math.max(surfAt(DR.p.x, DR.p.z), surfAt(DR.p.x + DR.v.x * 2.5, DR.p.z + DR.v.z * 2.5), surfAt(DR.p.x + DR.v.x * 5, DR.p.z + DR.v.z * 5));
    let gt = Math.abs(ip) > 0.05 ? -ip * 28 * DEG : clamp((DR.altT - DR.p.y) * 0.06, -0.3, 0.3);
    if (appr && DR.p.y - groundAt(DR.p.x, DR.p.z) < 4) gt = Math.max(gt, -Math.asin(Math.min(1, 0.7 / Math.max(V, 6))));   // 플레어: 바닥 가까이선 초당 0.7 m 로만 내려앉게   // 접근: 바닥 가까이서 살짝 기수 들기 (플레어)
    if (DR.p.y - ahead < a.minAgl && !a.kam && !appr) { gt = Math.max(gt, 0.25 + (a.minAgl - (DR.p.y - ahead)) * 0.03); DR.altT = Math.max(DR.altT, ahead + a.minAgl); }
    // 실속 보호: 속도가 실속 속도 가까이 떨어지면 상승각을 줄임
    const mg = (V - vsE * 1.12) / (a.stall * 0.35); if (mg < 1) gt = Math.min(gt, Math.max(-0.15, mg) * 28 * DEG);
    DR.pitch += (gt - DR.pitch) * (1 - Math.exp(-dt * 2.2));
    // 기울기 한계: 입문 35° · 느릴 때는 실속하지 않을 만큼만 (V ≥ 1.15·Vs·√n)
    const bMax = Math.min(SET.diff === 'train' ? 35 * DEG : a.bank * DEG, V > a.stall * 1.15 ? Math.acos(Math.min(1, Math.pow(a.stall * 1.15 / V, 2))) : 0);
    DR.roll += (ir * bMax - DR.roll) * (1 - Math.exp(-dt * 2.8));
    S.boosting = !!IN.boost;
    const vt = IN.boost ? a.top : IN.thr >= 0 ? a.cruise + IN.thr * (a.top - a.cruise) : a.cruise + IN.thr * (a.cruise - a.stall - 2);
    V += clamp(vt - V, -4, 4) * dt * 0.9;
  } else if (rate) {
    // 완전 수동: 스틱 = 회전 속도. 놓으면 그 자세 그대로 (수평 복귀 없음) · 실속에서 기수를 계속 당기면 스핀
    DR.roll = clamp(DR.roll + ir * a.rrate * DEG * dt, -85 * DEG, 85 * DEG); DR.pitch = clamp(DR.pitch - ip * a.prate * 0.8 * DEG * dt, -70 * DEG, 60 * DEG);
    if (stall && ip < -0.3) { DR.roll = clamp(DR.roll + (DR.wdrop || 1) * 110 * DEG * dt, -85 * DEG, 85 * DEG); DR.h += (DR.wdrop || 1) * 1.6 * dt; }
    S.boosting = !!IN.boost;
    const thr = IN.boost ? 1 : clamp(0.55 + IN.thr * 0.45, 0, 1), thrust = thr * a.top * 0.42, drag = 0.42 * a.top * (V / a.top) * (V / a.top);
    V += (thrust - drag) * dt;
  } else {
    // 자세 안정 수동(ATTI): 스틱 = 기울기·상승각, 놓으면 수평으로 돌아옴 (고도 유지·지면 회피·실속 보호 없음)
    let gt = -ip * 40 * DEG; const rt = ir * Math.min(70, a.bank * 1.3) * DEG;
    if (stall) gt = Math.min(gt, DR.pitch);   // 실속 중엔 자세 안정이 기수를 들어 올리지 못함
    DR.pitch += clamp(gt - DR.pitch, -a.prate * DEG * dt, a.prate * DEG * dt);
    DR.roll += clamp(rt - DR.roll, -a.rrate * DEG * dt, a.rrate * DEG * dt);
    S.boosting = !!IN.boost;
    const thr = IN.boost ? 1 : clamp(0.55 + IN.thr * 0.45, 0, 1), thrust = thr * a.top * 0.42, drag = 0.42 * a.top * (V / a.top) * (V / a.top);
    V += (thrust - drag) * dt;
  }
  // 오르면 느려지고 내려가면 빨라짐 (에너지)
  V -= G * Math.sin(DR.pitch) * dt * 0.85;
  if (stall) { DR.pitch -= (1.3 + (vsE - V) * 0.25) * dt; DR.pitch = Math.max(DR.pitch, -55 * DEG); }   // 실속: 기수가 떨어지며 속도를 되찾아야 회복
  V = clamp(V, 3, a.kam ? a.top * 1.12 : a.top * 1.18); DR.as = V;
  // 선회: 하중 배수 한계 (nmax) 안에서만 돌고, 넘게 기울이면 양력이 모자라 기수가 내려감
  const nreq = 1 / Math.max(0.05, Math.cos(DR.roll)), nl = Math.min(nreq, a.nmax);
  DR.h += Math.sign(DR.roll) * G * Math.sqrt(Math.max(0, nl * nl - 1)) / Math.max(V, 6) * dt + iy * 0.35 * dt;
  if (nreq > a.nmax) DR.pitch -= (1 - nl * Math.cos(DR.roll)) * G / Math.max(V, 6) * dt;
  V -= (nl - 1) * 1.1 * dt;
  // 비행 구역 밖이면 자동 선회
  const rx = DR.p.x, rz = DR.p.z + 150, l = Math.hypot(rx, rz);
  if (l > FLY_R + 30) { const dh = wrapA(Math.atan2(-rx, rz) - DR.h); DR.h += clamp(dh, -1, 1) * 0.6 * dt; if (S.msgCD <= 0) { showMsg('AREA LIMIT · 선회', '#ff9a40', 1); S.msgCD = 2; } }
  const cg = Math.cos(DR.pitch);
  DR.v.set(Math.sin(DR.h) * V * cg, Math.sin(DR.pitch) * V - (stall ? Math.min(7, 3.5 + (vsE - V) * 1.2) : 0), -Math.cos(DR.h) * V * cg);   // 실속: 양력이 모자라 가라앉음
  DR.v.add(windAt(DR.p)); DR.p.addScaledVector(DR.v, dt); DR.thrust = assist ? clamp(0.5 + IN.thr * 0.5, 0.2, 1) : IN.boost ? 1 : clamp(0.55 + IN.thr * 0.45, 0, 1);
  if (DR.p.y > groundAt(DR.p.x, DR.p.z) + 150) { DR.p.y = groundAt(DR.p.x, DR.p.z) + 150; DR.altT = Math.min(DR.altT, DR.p.y); }
  S.stallW = stall;
  // 지면·장애물·나무 = 추락 (자폭기는 기폭)
  if (DR.p.y < groundAt(DR.p.x, DR.p.z) + 0.7 && RWY && !a.kam) {   // 활주로 위 접지: 너무 빨리 내려오거나 기울면 추락
    const l = rwyLocal(DR.p);
    if (S.simT - (DR.liftT ?? -99) > 2 && DR.v.y < 0.3 && Math.abs(l.w) < RWY.Wd / 2 + 2 && Math.abs(l.t) < RWY.L / 2 + 5 && DR.v.y > -3.5 && Math.abs(DR.roll) < 20 * DEG && V < a.stall * 1.75) {
      DR.gnd = true; DR.p.y = groundAt(DR.p.x, DR.p.z) + 0.25; DR.pitch = 0; DR.roll = 0; showMsg(L2('접지 · 스로틀 내려 감속', 'TOUCHDOWN · throttle down to brake'), '#5dff9a', 1.6); sfx('drop'); return;
    }
  }
  if (DR.p.y < groundAt(DR.p.x, DR.p.z) + 0.15) return lostDrone(waterAt(DR.p.x, DR.p.z) >= groundAt(DR.p.x, DR.p.z) - 0.01 ? 'WATER' : 'GROUND');
  const hit = collide(DR.p, DR.R) || STREES.col(DR.p, DR.R);
  if (hit) return lostDrone(hit.tag);
}
// ---- 활주로 (고정익 이착륙): 출발점 근처에서 평탄·나무 적음·코스와 겹치지 않는 띠를 자동으로 고름 ----
const _rv = new V3();
const RWY = (function () {
  try {
    const sp = startPos(), L = 130, Wd = 12, avoid = [];
    if (typeof OBJS !== 'undefined') OBJS.forEach(o => o.mk && avoid.push(o.mk));
    let best = null;
    for (let R = 120; R <= 420; R += 30) for (let a = 0; a < 360; a += 20) for (let hd = 0; hd < 180; hd += 15) {
      const cx = sp.x + Math.sin(a * DEG) * R, cz = sp.z - Math.cos(a * DEG) * R, h = hd * DEG, ux = Math.sin(h), uz = -Math.cos(h);
      if (Math.hypot(cx - FLY_C.x, cz - FLY_C.z) > FLY_R_SAFE - 160) continue;
      let bad = false; for (const m of avoid) { const dx = m.x - cx, dz = m.z - cz, t = dx * ux + dz * uz, w = -dx * uz + dz * ux; if (Math.abs(t) < L / 2 + 40 && Math.abs(w) < Wd / 2 + 40) { bad = true; break; } } if (bad) continue;
      const ys = []; let trees = 0, hit = false;
      for (let t = -L / 2; t <= L / 2; t += 10) for (const w of [-6, 0, 6]) { const x = cx + ux * t - uz * w, z = cz + uz * t + ux * w, y = groundAt(x, z); ys.push([t, y]);
        _rv.set(x, y + 2.5, z); if (collide(_rv, 1.2)) hit = true; if (STREES.col && STREES.col(_rv, 1)) trees++; }
      if (hit) continue;
      for (const t of [-1, 1]) for (let e = 20; e <= 160; e += 20) { const tt = t * (L / 2 + e), x = cx + ux * tt, z = cz + uz * tt; _rv.set(x, groundAt(x, z) + 6, z); if (STREES.col && STREES.col(_rv, 1)) trees += 0.25; }   // 접근로 나무
      const n = ys.length, mt = ys.reduce((q, v) => q + v[0], 0) / n, my = ys.reduce((q, v) => q + v[1], 0) / n; let sxy = 0, sxx = 0; ys.forEach(([t, y]) => { sxy += (t - mt) * (y - my); sxx += (t - mt) ** 2; });
      const k = sxy / sxx, res = Math.max(...ys.map(([t, y]) => Math.abs(y - (my + k * (t - mt))))), sc = res + trees * 0.4 + Math.abs(k) * 25 + R * 0.002;
      if (Math.abs(k) < 0.06 && (!best || sc < best.sc)) best = { sc, cx, cz, h, ux, uz };
    }
    if (!best) return null;
    let { cx, cz, h, ux, uz } = best;
    // 이륙 방향: 비행 구역 가운데 쪽으로
    if ((FLY_C.x - cx) * ux + (FLY_C.z - cz) * uz < 0) { h += Math.PI; ux = -ux; uz = -uz; }
    STREES.hideRect && STREES.hideRect(cx, cz, ux, uz, L + 30, Wd + 14); STREES.hideRect && STREES.hideRect(cx, cz, ux, uz, L + 320, 26);   // 활주로 + 양쪽 접근로 160 m
    const at = (t, w) => new V3(cx + ux * t - uz * w, 0, cz + uz * t + ux * w);
    const g = new THREE.Group(); scene.add(g);
    // 노면: 지형을 따라 깔고 표시(중앙선·시단·번호)는 캔버스 무늬로
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 1024; const x = cv.getContext('2d');
    x.fillStyle = '#3a3c3f'; x.fillRect(0, 0, 128, 1024); for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`; x.fillRect(Math.random() * 128, Math.random() * 1024, 2, 2); }
    x.fillStyle = '#e9e9e2'; x.fillRect(4, 0, 3, 1024); x.fillRect(121, 0, 3, 1024);
    for (let y = 120; y < 904; y += 48) x.fillRect(62, y, 4, 26);
    for (const y0 of [8, 1016 - 40]) for (let i = 0; i < 6; i++) x.fillRect(14 + i * 18 + (i > 2 ? 10 : 0), y0, 8, 40);
    const num = n => String(Math.round(n / 10) % 36 || 36).padStart(2, '0'); const hdg = ((h / DEG) % 360 + 360) % 360;
    x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.save(); x.translate(64, 96); x.fillText(num(hdg), 0, 0); x.restore();
    x.save(); x.translate(64, 928); x.rotate(Math.PI); x.fillText(num(hdg + 180), 0, 0); x.restore();
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const NS = 40, geo = new THREE.PlaneGeometry(Wd, L, 2, NS), pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) { const w = pa.getX(i), t = pa.getY(i), q = at(t, w); pa.setXYZ(i, q.x, groundAt(q.x, q.z) + 0.07, q.z); }
    geo.computeVertexNormals();
    const strip = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 })); strip.receiveShadow = true; g.add(strip);
    // 가장자리 등 (끝: 초록/빨강) · 풍향계
    const lw = new THREE.MeshBasicMaterial({ color: 0xfff1c0, toneMapped: false }), lg = new THREE.MeshBasicMaterial({ color: 0x40ff70, toneMapped: false }), lr = new THREE.MeshBasicMaterial({ color: 0xff4040, toneMapped: false });
    for (let t = -L / 2; t <= L / 2 + 0.1; t += 13) for (const w of [-Wd / 2 - 0.6, Wd / 2 + 0.6]) { const q = at(t, w); const m = new THREE.Mesh(USPH, Math.abs(t + L / 2) < 1 ? lg : Math.abs(t - L / 2) < 1 ? lr : lw); m.scale.setScalar(0.16); m.position.set(q.x, groundAt(q.x, q.z) + 0.3, q.z); g.add(m); }
    const ws = at(-L / 2 + 15, Wd / 2 + 8), wy = groundAt(ws.x, ws.z), pole = new THREE.Mesh(UCYL, mat(0xd8d8d8)); pole.scale.set(0.05, 4, 0.05); pole.position.set(ws.x, wy + 2, ws.z); g.add(pole);
    const sock = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.8, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xff7a1a, side: THREE.DoubleSide, roughness: 0.8 })); sock.position.set(ws.x, wy + 3.8, ws.z); g.add(sock);
    // 야전 착륙장: 활주로 옆 계류장(쿼드 H 패드 3개) + 유도로 · 평탄한 쪽으로
    const flat = sg => { let mx = -1e9, mn = 1e9; for (let t = -22; t <= 22; t += 6) for (let w = 0; w <= 46; w += 6) { const q = at(t, sg * (Wd / 2 + 8 + w)), y = groundAt(q.x, q.z); mx = Math.max(mx, y); mn = Math.min(mn, y); _rv.set(q.x, y + 2, q.z); if (collide(_rv, 1.5)) return 1e9; } return mx - mn; };
    const sg = flat(1) <= flat(-1) ? 1 : -1, AW = 20, AL = 40, aw0 = Wd / 2 + 30, ac = at(0, sg * (aw0 + AW / 2));
    STREES.hideRect && STREES.hideRect(ac.x, ac.z, ux, uz, AL + 16, AW + 16); { const tw = at(0, sg * (Wd / 2 + 15)); STREES.hideRect && STREES.hideRect(tw.x, tw.z, -uz * sg, ux * sg, 34, 14); }
    const deck = (t0, t1, w0, w1, nt, nw, mtl, lift) => { const gg = new THREE.PlaneGeometry(1, 1, nw, nt), pa = gg.attributes.position;
      for (let i = 0; i < pa.count; i++) { const u = pa.getX(i) + 0.5, v = pa.getY(i) + 0.5, q = at(t0 + (t1 - t0) * v, w0 + (w1 - w0) * u); pa.setXYZ(i, q.x, groundAt(q.x, q.z) + lift, q.z); }
      gg.computeVertexNormals(); const m = new THREE.Mesh(gg, mtl); m.receiveShadow = true; g.add(m); return m; };
    const concM = new THREE.MeshStandardMaterial({ color: 0x8d8d86, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
    const taxM = new THREE.MeshStandardMaterial({ color: 0x45474a, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
    deck(-AL / 2, AL / 2, sg * aw0, sg * (aw0 + AW), 8, 4, concM, 0.08);                         // 계류장
    deck(-3, 3, sg * (Wd / 2 - 0.5), sg * (aw0 + 0.5), 1, 6, taxM, 0.075);                     // 유도로
    const yl = new THREE.MeshBasicMaterial({ color: 0xf2c230 }); for (let w = Wd / 2 + 1; w < aw0; w += 3) { const q = at(0, sg * w); const m = new THREE.Mesh(UBOX, yl); m.scale.set(0.25, 0.03, 1.6); m.position.set(q.x, groundAt(q.x, q.z) + 0.1, q.z); m.rotation.y = -h + Math.PI / 2; g.add(m); }   // 유도로 노란 중앙선
    const padTex = n => { const c = document.createElement('canvas'); c.width = c.height = 256; const x2 = c.getContext('2d'); x2.fillStyle = '#2f3134'; x2.beginPath(); x2.arc(128, 128, 126, 0, 6.283); x2.fill(); x2.strokeStyle = '#f0f0ea'; x2.lineWidth = 10; x2.beginPath(); x2.arc(128, 128, 112, 0, 6.283); x2.stroke();
      x2.fillStyle = '#f0f0ea'; x2.font = 'bold 150px sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText('H', 128, 136); x2.fillStyle = '#f2c230'; x2.font = 'bold 40px sans-serif'; x2.fillText(String(n), 200, 60); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
    const pads = [-13, 0, 13].map((t, i) => { const q = at(t, sg * (aw0 + AW / 2)); q.y = groundAt(q.x, q.z); let top = q.y; for (const [dx, dz] of [[2.6, 0], [-2.6, 0], [0, 2.6], [0, -2.6], [1.8, 1.8], [-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8]]) top = Math.max(top, groundAt(q.x + dx, q.z + dz)); const m = new THREE.Mesh(new THREE.CircleGeometry(3, 40), new THREE.MeshStandardMaterial({ map: padTex(i + 1), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = -h; m.position.set(q.x, top + 0.16, q.z); /* 패드는 바닥면보다 위로 */ m.receiveShadow = true; g.add(m); return q; });
    window.__RWY = { a: at(-L / 2, 0), b: at(L / 2, 0), apron: [at(-AL / 2, sg * aw0), at(AL / 2, sg * aw0), at(AL / 2, sg * (aw0 + AW)), at(-AL / 2, sg * (aw0 + AW))], pads };
    // PAPI (진입각 지시등): 시단에서 20 m 안쪽, 접근 방향 기준 왼쪽 14 m 에 4등 · 3° 경로면 하양 2 · 빨강 2 (높으면 하양이 늘고 낮으면 빨강이 늚)
    const papi = [-1, 1].map(end => { const t0 = end * (L / 2 - 20), side = -end * sg * 14, lights = [], box = new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.9 });
      for (let i = 0; i < 4; i++) { const q = at(t0, side + end * sg * (i - 1.5) * 2.4); const gy = groundAt(q.x, q.z); const bm = new THREE.Mesh(UBOX, box); bm.scale.set(0.5, 0.35, 0.5); bm.position.set(q.x, gy + 0.3, q.z); bm.rotation.y = -h; g.add(bm);
        const lm = new THREE.Mesh(UBOX, new THREE.MeshBasicMaterial({ color: 0xff2a2a })); lm.scale.set(0.42, 0.16, 0.12); lm.position.set(q.x - ux * end * 0.26, gy + 0.36, q.z - uz * end * 0.26); lm.rotation.y = -h; g.add(lm); lights.push(lm); }
      const th = at(end * L / 2, 0); th.y = groundAt(th.x, th.z); return { end, th, lights, dir: end }; });
    return { cx, cz, h, ux, uz, L, Wd, at, g, sock, pads, sg, papi };
  } catch (e) { console.warn('runway', e); return null; }
})();
// 활주로가 생기기 전에 그려 둔 코스 지도에 다시 그려 넣음
if (RWY) mapRefresh();
// 고정익 자유 비행: 코스 지도에 활주로까지 들어오게
function rwyMapView() { if (!RWY) return; const A = RWY.at(-RWY.L / 2 - 60, 0), B = RWY.at(RWY.L / 2, 0); mapView('free_wing', MAPS.ptsCourse.concat([[-A.z, A.x, 10], [-B.z, B.x, 10]])); }
function rwyLocal(p) { const dx = p.x - RWY.cx, dz = p.z - RWY.cz; return { t: dx * RWY.ux + dz * RWY.uz, w: -dx * RWY.uz + dz * RWY.ux }; }
// 접근각: 다가가는 쪽 시단(접지점 = 시단 안쪽 20 m) 기준 올려다본 각 · 기준 3° · 활주로 연장선 ±25° 안, 800 m 안에서만
function rwyGlide(p) {
  if (!RWY || !RWY.papi) return null; const l = rwyLocal(p), end = l.t < 0 ? -1 : 1, out = Math.abs(l.t) - RWY.L / 2; if (out < -RWY.L / 2 + 25) return null;
  const P = RWY.papi[end < 0 ? 0 : 1], td = RWY.at(end * (RWY.L / 2 - 20), 0); td.y = groundAt(td.x, td.z);
  const hd = Math.hypot(p.x - td.x, p.z - td.z), ang = Math.atan2(p.y - td.y, Math.max(1, hd)) / DEG, off = Math.atan2(Math.abs(l.w), Math.max(1, Math.abs(l.t) - RWY.L / 2 + 20)) / DEG;
  if (hd > 800 || out < -30 || off > 25) return null;
  return { ang, hd, td, end, P, white: ang > 3.5 ? 4 : ang > 3.17 ? 3 : ang > 2.83 ? 2 : ang > 2.5 ? 1 : 0 };
}
function papiTick(p) {
  if (!RWY || !RWY.papi) return; const g = rwyGlide(p);
  for (const P of RWY.papi) { const n = g && g.P === P ? g.white : 0; P.lights.forEach((m, i) => { const w = i < n; const c = w ? 0xf4f6ff : 0xff2a2a; if (m.material.color.getHex() !== c) m.material.color.setHex(c); }); }
}
function glideText(g) { if (!g) return ''; const en = window.SIM_LANG === 'en', d = g.ang - 3, tag = Math.abs(d) < 0.3 ? (en ? 'on slope' : '정상') : d > 0 ? (en ? 'high ▼' : '높음 ▼') : (en ? 'low ▲' : '낮음 ▲');
  return `${en ? 'APP' : '접근각'} ${g.ang.toFixed(1)}° · <span style="letter-spacing:2px">${'●'.repeat(g.white)}<span style="color:#ff4d4d">${'●'.repeat(4 - g.white)}</span></span> ${tag}`; }
function wingRwyOK(a) { return !!RWY && a && a.cls === 'wing' && !a.kam; }
function wingGround() {   // 활주로 시단에서 정지 상태로 시작
  const a = AFc(), p = RWY.at(-RWY.L / 2 + 8, 0); p.y = groundAt(p.x, p.z) + 0.25;
  DR.p.copy(p); DR.h = RWY.h; DR.as = 0; DR.v.set(0, 0, 0); DR.pitch = 0; DR.roll = 0; DR.alive = true; DR.gnd = true; DR.landed = true; DR.altT = p.y + 35; DR.liftT = -99;
  showMsg(L2('활주로 · 스로틀 올려 이륙 (속도 붙으면 기수 들기)', 'RUNWAY · throttle up, rotate at speed'), '#ffc828', 3);
}
// 지상 활주: 스로틀 = 가속, 스로틀 내림 = 브레이크, 회전·좌우 = 앞바퀴 조향 · 이륙 속도에서 기수를 들면(보조 켬: 스로틀만으로) 이륙
function wingRoll(dt, a) {
  const thrUp = IN.boost || IN.thr > 0.15, brake = IN.thr < -0.15; let V = DR.as || 0;
  const autoBrk = SET.assist && SET.diff !== 'sport';   // 보조 켬: 스로틀을 안 올리면 자동 제동
  V = Math.max(0, V + (thrUp ? (IN.boost ? 4.5 : 3.2) : brake ? -5 : autoBrk ? -3 : -0.6) * dt);
  if (V > 0.5) DR.h += (IN.yaw * 0.6 + IN.roll * 0.35) * dt;
  const fx = Math.sin(DR.h), fz = -Math.cos(DR.h), w = windAt(DR.p);
  DR.p.x += fx * V * dt; DR.p.z += fz * V * dt; DR.p.y = groundAt(DR.p.x, DR.p.z) + 0.25;
  DR.pitch = 0; DR.roll = 0; DR.as = V; DR.v.set(fx * V, 0, fz * V); DR.thrust = thrUp ? 1 : 0.25; S.stallW = false; S.boosting = !!IN.boost; DR.landed = V < 0.3;
  const vr = a.stall * 1.15;
  if (V >= vr && (IN.pitch < -0.25 || (SET.assist && SET.diff !== 'sport' && thrUp))) {
    DR.gnd = false; DR.landed = false; DR.pitch = 9 * DEG; DR.altT = DR.p.y + 35; DR.liftT = S.simT; showMsg(L2('이륙', 'LIFT OFF'), '#5dff9a', 1.2); sfx('chime'); return;
  }
  const l = rwyLocal(DR.p); if ((Math.abs(l.w) > RWY.Wd / 2 + 5 || Math.abs(l.t) > RWY.L / 2 + 60) && V > 6) return lostDrone('GROUND');   // 활주로를 벗어나 빠르게 굴러가면 사고
  const hit = collide(DR.p, DR.R); if (hit && V > 3) return lostDrone(hit.tag);
}
// 접근 중인가: 활주로 연장선 위(옆 30 m + 거리비례), 끝을 아직 안 지남, 방향이 맞음, 이륙 직후 아님
function rwyApproach() {
  if (!RWY || S.simT - (DR.liftT ?? -99) < 12) return false;
  const l = rwyLocal(DR.p), dir = Math.cos(DR.h - RWY.h) >= 0 ? 1 : -1, tt = l.t * dir;
  return Math.abs(wrapA(DR.h - RWY.h - (dir < 0 ? Math.PI : 0))) < 30 * DEG && tt < RWY.L / 2 && tt > -RWY.L / 2 - 450 && Math.abs(l.w) < 30 + Math.max(0, -tt - RWY.L / 2) * 0.15;
}
// 활주로 착륙 목표 (고정익 임무 마지막)
function rtbObj(a) {
  if (wingRwyOK(a)) { const td = RWY.at(-RWY.L / 2 + 20, 0), ap = RWY.at(-RWY.L / 2 - 300, 0); td.y = groundAt(td.x, td.z) + 1; ap.y = groundAt(ap.x, ap.z) + 35;
    return { kind: 'ms', t: 'rwyland', rtb: true, label: L2('복귀 · 활주로 착륙', 'Return · land on the runway'), mk: td.clone().setY(td.y + 4), pts(p) { return [p.clone(), ap.clone(), td.clone()]; } }; }
  if (a.cls === 'wing') return Object.assign(passCP('복귀 · 출발점 상공 통과', { d: BY.pad_start.down, s: BY.pad_start.side, td: 1, ts: 0 }, 0, 35, 35, 14), { rtb: true });
  return { kind: 'ms', t: 'land', rtb: true, label: '출발 패드로 복귀 · 착륙', mk: startPos().add(new V3(0, 1.5, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } };
}
// 기체 잃음: 추락 / 자폭 기폭
function lostDrone(why) {
  if (!DR.alive) return;
  const a = AFc();
  if (a.kam && S.kind === 'strike') { if (strikeDetonate()) return; }
  DR.alive = false; S.deadT = 1.6; S.impacts++; S.lost = (S.lost || 0) + 1;
  spawnImpact(DR.p.clone(), true); sfx('crash'); rumble(1, 0.8, 300); shake = 0.15;
  if (S.kind === 'strike') showMsg(why === 'stk' ? 'HIT' : 'MISS · 기체 손실', '#ff6060', 1.6);
  else { showMsg(why === 'WATER' && !a.kam ? 'SPLASH · 물에 빠짐 · 기체 손실' : a.kam ? 'DETONATED · 기체 손실' : 'CRASH · 기체 손실', '#ff5050', 1.6); if (S.kind === 'race' || S.kind === 'forest' || S.kind === 'recon') S.pen += 10; }
  droneM.g.visible = false;
  if (isMission() && !(a.kam && S.kind === 'strike')) comm(`${CS}, CONTROL, we lost your feed. Relaunching from the start point.`, '영상 끊김 · 출발점에서 재발진', 'CONTROL', 'lost', true);
  else if (a.kam && S.kind === 'strike') comm('Miss, no effect on target. Next drone is up.', '빗나감 · 다음 기체 발진', 'CONTROL', 'lost', true);
  else commInterrupt();   // 무전이 남아 있으면 끊음
}
function deadTick(dt) { S.deadT -= dt; if (S.deadT <= 0) { respawn(); } }

// ---------------- 임무 ----------------
// ---- 사방댐 2곳 (정사영상에서 읽은 위치): 콘크리트 둑 + 위쪽 물웅덩이 ----
const DAMS = (function () {
  const L = SITE.dams || []; if (!L.length || !TER.h) return [];
  const conc = mat(0xb9b5ab, { roughness: 0.9 }), top = mat(0xd3cfc4, { roughness: 0.85 });
  const wm = new THREE.MeshStandardMaterial({ color: 0x2f4c47, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.9, depthWrite: false });
  return L.map((dm, k) => {
    const n = dm.pool.length, pc = dm.pool.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0]);
    const a = W(dm.a[0], dm.a[1], 0), b = W(dm.b[0], dm.b[1], 0), mid = a.clone().lerp(b, 0.5);
    const crest = WATER[k] ? WATER[k].crest : Math.max(W(pc[0], pc[1], 0).y + 1.2, terrainAt(mid.x, mid.z) + 2.5);   // 수면 = 땅 높이(groundAt)·충돌과 같은 값 (game1.js WATER)
    const len = Math.hypot(b.x - a.x, b.z - a.z), yaw = -Math.atan2(b.z - a.z, b.x - a.x), bottom = Math.min(a.y, b.y, terrainAt(mid.x, mid.z)) - 3;
    const wall = new THREE.Mesh(UBOX, conc); wall.scale.set(len + 3, crest - bottom, 1.5); wall.position.set(mid.x, (crest + bottom) / 2, mid.z); wall.rotation.y = yaw;
    wall.castShadow = wall.receiveShadow = true; scene.add(wall); boxCol(wall, 'dam');
    const cap = new THREE.Mesh(UBOX, top); cap.scale.set(len + 3.2, 0.25, 1.7); cap.position.set(mid.x, crest + 0.12, mid.z); cap.rotation.y = yaw; scene.add(cap);
    const sh = new THREE.Shape(dm.pool.map(p => { const w = W(p[0], p[1], 0); return new THREE.Vector2(w.x, -w.z); }));
    const water = new THREE.Mesh(new THREE.ShapeGeometry(sh), wm); water.rotation.x = -Math.PI / 2; water.position.y = crest - 0.45; water.receiveShadow = true; water.userData.heat = 0; scene.add(water);
    return { wall, water, crest };
  });
})();
const MSG = { race: new THREE.Group(), strike: new THREE.Group(), recon: new THREE.Group(), fire: new THREE.Group() };
Object.values(MSG).forEach(g => { g.visible = false; scene.add(g); });
const MS = { list: [], idx: 0 };
const _mv = new V3();
// 코스 경로 위 거리 s 의 점 (down, side, 방향)
const PATHL = (function () {
  if (!CRS_C) return null; const P = CRS_C.path, cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { total: cum[cum.length - 1], at(s) { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const u = clamp((s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), 0, 1), a = P[i - 1], b = P[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { d: a[0] + (b[0] - a[0]) * u, s: a[1] + (b[1] - a[1]) * u, td: (b[0] - a[0]) / l, ts: (b[1] - a[1]) / l }; } };
})();
const wdir = q => { const a = W(q.d, q.s, 0), b = W(q.d + q.td, q.s + q.ts, 0); return b.sub(a).setY(0).normalize(); };
// 통과점 (평면 + 열린 범위): 길 위 점 q, 열린 폭 hw, 지면 위 y0~y1
function passCP(label, q, hw, y0, y1, ring) {
  const c = W(q.d, q.s, 0), n = wdir(q), r = new V3(-n.z, 0, n.x);
  const mid = c.clone().add(new V3(0, (y0 + y1) / 2, 0));
  return { kind: 'ms', t: 'pass', label, c, n, r, hw, y0, y1, ring, mk: mid.clone(),
    pts(p) { const ld = guideLead(), cc = this.ring ? this.c : mid, bf = p.clone().sub(cc).dot(n); return bf < -ld - 2 ? [p.clone(), cc.clone().addScaledVector(n, -ld), cc.clone(), cc.clone().addScaledVector(n, 3)] : [p.clone(), cc.clone(), cc.clone().addScaledVector(n, 3)]; } };
}
// 링 높이 보정: 링 아래쪽이 주변 지형·나무 꼭대기(반지름 R+1 m 안)보다 여유를 두고 뜨도록 (낮게 생성돼 구조물과 겹치지 않게)
function clearAlt(d, s, alt, R) {
  const c = W(d, s, 0), g0 = c.y; let top = g0;
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; top = Math.max(top, terrainAt(c.x + Math.cos(a) * (R + 1), c.z + Math.sin(a) * (R + 1))); }
  if (STREES && STREES.topAt) top = Math.max(top, STREES.topAt(c.x, c.z, R + 1));
  return Math.max(alt, top - g0 + R + 2.5);
}
// 레이스 링
const RACE = (function () {
  if (!PATHL) return [];
  // 링 20개: 높이·좌우를 바꿔 가며 약 27 m 간격
  const L = [], alts = [4, 6, 9, 5, 12, 16, 8, 4, 7, 14, 20, 11, 6, 4, 9, 15, 22, 10, 6, 5], lats = [0, 3, -3, 2, -2, 0, 3, -3, 1.5, -1.5, 0, 3, -3, 2, -2, 0, 1.5, -1.5, 2.5, 0];
  for (let i = 0; i < alts.length; i++) {
    const s = 30 + i * (PATHL.total - 50) / (alts.length - 1), q0 = PATHL.at(s), la = lats[i];
    const q = Object.assign({}, q0, { d: q0.d - q0.ts * la, s: q0.s + q0.td * la }), cp = passCP('RING ' + (i + 1), q, 0, alts[i], alts[i], 3.2);
    cp.q = q; cp.alt = clearAlt(q.d, q.s, alts[i], 3.2); cp.mk = W(q.d, q.s, cp.alt); cp.c = cp.mk.clone(); const tor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), mat(i === alts.length - 1 ? 0x5dff9a : 0xffc828, { emissive: 0x332200, roughness: 0.4 }));
    tor.position.copy(cp.c); tor.lookAt(cp.c.clone().add(cp.n)); MSG.race.add(tor); cp.mesh = tor; ringDecor(cp); L.push(cp);
  }
  return L;
})();
// 정찰 대상: 수치지형도의 실제 건물 (출발점에서 고르게 떨어진 것)
const RECON = (function () {
  const out = []; if (!VEC || !VEC.bld || !CRS_C) return out;
  const st = BY.pad_start, B = VEC.bld.map(b => ({ b, d: Math.hypot(b[0] - st.down, b[1] - st.side) })).filter(x => x.d > 100 && x.d < 640).sort((p, q) => p.d - q.d);
  for (const x of B) { if (out.length >= 9) break; if (out.some(o => Math.hypot(o.b[0] - x.b[0], o.b[1] - x.b[1]) < 110)) continue; out.push(x); }
  return out.map((x, i) => { const [d, s, w, l, ang, h] = x.b, tp = W(d, s, h * 0.6);
    return { kind: 'ms', t: 'recon', wl: `${Math.round(w)}×${Math.round(l)} m`, d, s, label: '', tp, mk: W(d, s, h + 6), need: 1.5, pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y + 15))]; } }; });
})();
// 타격 표적 (가상의 표적 차량 3대)
const STRIKE = (function () {
  if (!PATHL) return [];
  const L = [], body = mat(0x59604a, { roughness: 0.85 }), dark = mat(0x2c3026, { roughness: 0.9 }), mark = mat(0xff3b30, { roughness: 0.6, emissive: 0x220000 });
  [[150, 5], [235, -6], [320, 5], [400, -4], [475, 4]].forEach(([s, off], i) => {
    const q = PATHL.at(Math.min(s, PATHL.total - 8)), d = q.d - q.ts * off, sd = q.s + q.td * off, c = W(d, sd, 0), yaw = Math.atan2(q.ts, q.td);
    const g = new THREE.Group(); g.position.copy(c); g.rotation.y = Math.PI / 2 - yaw; MSG.strike.add(g);
    const hull = new THREE.Mesh(UBOX, body); hull.scale.set(2.4, 1.3, 5.2); hull.position.y = 1.05; g.add(hull);
    const cab = new THREE.Mesh(UBOX, body); cab.scale.set(2.2, 0.9, 1.6); cab.position.set(0, 2.05, -1.4); g.add(cab);
    for (const sx of [-1.25, 1.25]) for (const z of [-1.7, 0, 1.7]) { const w = new THREE.Mesh(UCYL, dark); w.scale.set(0.5, 0.35, 0.5); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.5, z); g.add(w); }
    const x = new THREE.Mesh(UBOX, mark); x.scale.set(1.6, 0.04, 1.6); x.position.set(0, 1.72, 0.6); g.add(x);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.heat = 0.28; } });
    const col = boxCol(hull, 'stk'); col.off = true;
    L.push({ kind: 'ms', t: 'strike', label: `표적 ${i + 1} · 차량`, g, col, parts: g.children.filter(x => x.isMesh), c: c.clone().add(new V3(0, 1.4, 0)), mk: c.clone().add(new V3(0, 5, 0)), hull,
      pts(p) { return [p.clone(), this.c.clone()]; } });
  });
  return L;
})();
function msObj() { return MS.list[MS.idx] || null; }
// 임무 지도 범위: 그 임무에서 나올 수 있는 사건·구역 전부 + 출발점 ([down, side, 반지름])
function missionMapPts(kind, run) {   // run: 이번 비행에 정해진 위치만 (산불·수색·정찰·추적은 매번 다름)
  const P = [], add = (p, r) => { if (p) P.push([-p.z, p.x, r || 0]); }, st = startPos(); add(st, 30);
  if (RWY && AFc().cls === 'wing' && !AFc().kam) { add(RWY.at(-RWY.L / 2 - 120, 0), 20); add(RWY.at(RWY.L / 2, 0), 20); }   // 고정익: 활주로·접근로
  if (kind === 'field' && RWY) { if (AFc().cls === 'wing') { add(RWY.at(-RWY.L / 2 - 250, 0), 30); add(RWY.at(RWY.L / 2 + 190, -RWY.sg * 220), 30); } RWY.pads.forEach(p => add(p, 15)); add(RWY.at(-RWY.L / 2, 0), 15); add(RWY.at(RWY.L / 2, 0), 15); return P; }
  if (run && kind === 'fire') { MS.list.forEach(f => { add(f.mk, 115); add(f.tp, 20); }); return P; }
  if (run && kind === 'sar' && SAR) { add(SAR.area, 125); add(SAR.tp, 70); add(SAR.pkP, 20); return P; }
  if (run && kind === 'recon') { MS.list.forEach(o => add(o.tp, 40)); return P; }
  if (run && kind === 'track' && TRACK) { for (let t = TRACK.s; t <= (TRACK.endS || TRACK.total); t += 40) add(trackPose(t).p, 30); return P; }
  if (kind === 'fire') FIRE.filter(f => flyL(f.tp) <= FLY_R_SAFE - 60).forEach(f => add(f.tp, 190));
  else if (kind === 'sar') SAR_POOL.forEach(([d, s]) => add(W(d, s, 0), 215));
  else if (kind === 'recon') RECON.forEach(r => add(r.tp, 30));
  else if (kind === 'strike') STRIKE.forEach(t => add(t.c, 30));
  else if (kind === 'race') RACE.forEach(r => add(r.c || r.mk, 20));
  else if (kind === 'ridge' && RIDGE) RIDGE.list.forEach(r => add(r.c || r.mk, 20));
  else if (kind === 'forest' && FLANE) FLANE.cps.forEach(c => add(W(c.q.d, c.q.s, 0), 20));
  else if (kind === 'track') { add(new V3(FLY_C.x, 0, FLY_C.z), FLY_R_SAFE); }
  return P;
}
function msStart(kind) {
  Object.values(MSG).forEach(g => g.visible = false);
  STRIKE.forEach(t => { t.col.off = true; t.dead = false; t.hull.material = t.hull.userData.m0 || t.hull.material; });
  if (FLANE) FLANE.G.visible = true;
  MS.idx = 0; S.photos = []; PH.lastSim = undefined; S.lost = 0; droneM.cans.forEach(c => c.visible = kind === 'sar'); S.kitErr = undefined; S.sarXY = null; S.hitsS = 0; S.errS = []; S.recT = 0; S.deadT = 0; S.running = true;
  const a = AFc(); let L = [];
  if (kind === 'forest' && FLANE) L = FLANE.cps.map(c => passCP(c.label, c.q, c.hw, c.y0, c.y1));
  if (kind === 'race') { L = RACE; MSG.race.visible = true; const k = a.cls === 'wing' ? 2.2 : 1; RACE.forEach(r => { r.ring = 3.2 * k; r.mesh.scale.setScalar(3.2 * k); const al = clearAlt(r.q.d, r.q.s, a.cls === 'wing' ? r.alt * 0.8 + 30 : r.alt, r.ring); r.c = W(r.q.d, r.q.s, al); r.mk = r.c.clone(); r.mesh.position.copy(r.c); }); }
  if (kind === 'recon') L = reconPick();
  if (kind === 'fire') L = firePick();
  if (kind === 'strike') L = strikePick();
  const SC = scenStart(kind, a); if (SC) L = SC;
  if (typeof isC1 === 'function' && isC1(kind)) L = c1Start(a);
  if (wingRwyOK(a) && ['recon', 'fire', 'ridge'].includes(kind)) L = L.concat([rtbObj(a)]);   // 고정익: 임무 끝에 활주로 착륙
  L.forEach(o => { o.done = false; o.miss = false; }); S.msNear = null; MS.list = L; MS.kind = kind; MS.splits = []; { const el = $('split'); if (el) el.classList.remove('on'); } MS.t0 = 0; MS.events = []; S.decoyHit = 0;
  // 시작 위치: 고정익·자폭 고정익은 공중에서
  const c1s = typeof isC1 === 'function' && isC1(kind) ? c1StartPose() : null;
  const p0 = c1s ? c1s.p : kind === 'field' && RWY && a.cls !== 'wing' ? RWY.pads[0].clone().setY(RWY.pads[0].y + 0.06) : startPos(), o = msObj(); let h = startHead();
  if (c1s) h = c1s.h; else if (o && o.mk) { const d = o.mk.clone().sub(p0); h = Math.atan2(d.x, -d.z); }
  if (wingRwyOK(a) && kind !== 'strike') wingGround(); else if (a.cls === 'wing') { p0.y = groundAt(p0.x, p0.z) + (a.kam ? 45 : 30); wingAir(p0, h); } else resetDrone(p0, h);
  MS.launch = { p: DR.p.clone(), h: DR.gnd ? DR.h : h };
  S.respawn = null;
  if (ENV.ir) { irSet(false); irSet(true); }   // 바뀐 열 세기 반영
  MS.par = msPar(kind, L); briefShow(kind, L);
  if (c1s) { ui.mapBox.style.display = 'none'; return; }
  try { const run = ['fire', 'sar', 'recon', 'track', 'field'].includes(kind); mapView('ms_' + kind, missionMapPts(kind, run), run); } catch (e) { mapView('course'); }
}
function msNext(msg, col) {
  const o = msObj(); if (!o) return;
  o.done = true; dbfObj(o.label, true); sfx('good'); showMsg(msg || (o.label + ' ✓'), col || '#5dff9a', 1.3); rumble(0.15, 0.5, 90);
  splitMark();
  MS.idx++; while (MS.list[MS.idx] && MS.list[MS.idx].done) MS.idx++; S.recT = 0; commAck(o, S.kind);
  if (gOn('radio')) { const nx = msObj(); setTimeout(() => { if (S.state === 'run' && nx && msObj() === nx) vecCall(true); }, 4500); }   // 지도·무전 단계: 다음 목표 위치를 무전으로
  S.respawn = S.kind === 'strike' ? null : { p: DR.p.clone(), h: DR.h };
  renderList();
  if (MS.idx >= MS.list.length) msFinish();
}
// 통과점 면을 앞으로 지났으면 true(안쪽)/false(바깥), 안 지났으면 null
function passCross(o, prev, cur) {
  const a = _mv.subVectors(prev, o.c).dot(o.n), b = _mv.subVectors(cur, o.c).dot(o.n);
  if (!(a < 0 && b >= 0)) return null;
  const t = a / (a - b), x = prev.clone().lerp(cur, t), lat = _mv.subVectors(x, o.c).dot(o.r);
  if (o.ring) return x.distanceTo(o.c) <= o.ring - DR.R * 0.5;
  const h = x.y - terrainAt(x.x, x.z); return Math.abs(lat) <= o.hw && h >= o.y0 && h <= o.y1;
}
// 통과점 하나만 실패로 두고 다음 목표로
const RACE_PEN = 8;   // 레이스: 놓친 링 하나당 +8 s
// 구간 기록: 통과점마다 지금 시간을 적고, 같은 임무·기체·모드의 최고 기록 구간과 비교해 녹/적 델타 표시 (Liftoff 랩 타이머식)
const SPLIT = { t: 0 };
function splitKey() { return 'fpvsim_ms_split_' + S.kind + '_' + AFc().id + '_' + SET.diff + SITE_KEY; }
function splitMark() {
  if (!(S.kind === 'race' || S.kind === 'ridge' || S.kind === 'forest')) return;
  const now = S.t + S.pen; MS.splits = MS.splits || []; while (MS.splits.length <= MS.idx) MS.splits.push(now);   // 건너뛴 링도 같은 시각으로 채워 인덱스를 맞춤
  let best = null; try { best = JSON.parse(localStorage.getItem(splitKey()) || 'null'); } catch (e) { }
  const i = MS.idx, el = $('split'); if (!el || !best || best[i] == null) return;
  const d = now - best[i]; el.textContent = (d <= 0 ? '−' : '+') + Math.abs(d).toFixed(1) + ' s'; el.innerHTML += `<small>${L2('최고 대비', 'vs best')}</small>`;
  el.classList.toggle('good', d <= 0); el.classList.toggle('bad', d > 0); el.classList.add('on'); SPLIT.t = 2.6;
}
function splitTick(dt) { if (SPLIT.t > 0) { SPLIT.t -= dt; if (SPLIT.t <= 0) { const el = $('split'); if (el) el.classList.remove('on'); } } }
function msSkip() {
  const o = msObj(); if (!o) return;
  o.done = true; o.miss = true; if (S.kind === 'race') S.pen += RACE_PEN; dbfObj(o.label, false); sfx('bad'); rumble(0.6, 0.2, 160); showMsg(o.label + ' ✗ → NEXT', '#ff9a40', 1.3); splitMark();
  comm(`${CS}, CONTROL. You missed that checkpoint. Press on to the next.`, `${o.label} 실패 · 다음 목표로`);
  MS.idx++; while (MS.list[MS.idx] && MS.list[MS.idx].done) MS.idx++; S.recT = 0;
  S.respawn = { p: DR.p.clone(), h: DR.h }; renderList();
  if (MS.idx >= MS.list.length) msFinish();
}
function msStep(prev, cur, dt) {
  if (typeof isC1 === 'function' && isC1()) { c1Step(prev, cur, dt); return; }
  const o = msObj(); if (!o || !DR.alive) return;
  if (o.t === 'pass') {
    /* 숲길·능선·레이스: 놓치고 지나가면 그 통과점만 실패(✗)로 두고 다음으로 (레이스는 링마다 +벌점) */
    {
      for (let j = MS.idx + 1; j <= Math.min(MS.idx + 2, MS.list.length - 1); j++) {
        const q = MS.list[j]; if (q.t !== 'pass' || passCross(q, prev, cur) !== true) continue;
        const missed = []; for (let k = MS.idx; k < j; k++) if (!MS.list[k].done) { MS.list[k].miss = true; missed.push(MS.list[k].label); }
        for (let k = MS.idx; k < j; k++) MS.list[k].done = true;
        if (S.kind === 'race') S.pen += RACE_PEN * missed.length;
        MS.idx = j; comm(`${CS}, CONTROL. You missed a checkpoint. Press on.`, `${missed.join(', ')} 실패 · 계속 진행`);
        msNext(`${missed.join(' · ')} ✗ → ${q.label} ✓`, '#ff9a40'); return;
      }
      /* 링·통과점을 옆으로 지나쳐 뒤에 두고 멀어지면 바로 실패 처리 → 가이드가 뒤를 가리키며 남지 않음 */
      if (o.c && o.n) {
        const bf = _mv.subVectors(cur, o.c).dot(o.n), away = DR.v.dot(o.n) > -0.5, lat = o.ring ? cur.distanceTo(o.c) : Math.hypot(cur.x - o.c.x, cur.z - o.c.z);
        const rr = o.ring || Math.max(o.hw || 0, 3), far = Math.max(10, rr * 2);
        if (away && (bf > far || (bf > 4 && lat > rr * 2.5 + 4))) { msSkip(); return; }
      }
      const nx = MS.list[MS.idx + 1];
      if (nx && nx.c) {
        const A = o.c, dx = nx.c.x - A.x, dz = nx.c.z - A.z, L2 = dx * dx + dz * dz, dA = Math.hypot(cur.x - A.x, cur.z - A.z);
        if (dA < 20) S.msNear = o;
        const u = L2 > 1 ? ((cur.x - A.x) * dx + (cur.z - A.z) * dz) / L2 : 0;
        if ((S.msNear === o && u > 0.5) || u > 0.85) { msSkip(); return; }
      }
    }
    const r = passCross(o, prev, cur);
    if (r === true) msNext(); else if (r === false && S.bumpT <= 0) { showMsg(L2('MISS · 다시 통과', 'MISS · fly through again'), '#ff9a40', 1); sfx('bad'); S.bumpT = 0.6; }
  } else if (o.t === 'padland') {
    const e = Math.hypot(DR.p.x - o.pad.x, DR.p.z - o.pad.z);
    if (DR.landed && DR.v.length() < 0.6) { if (e <= 1.5) { (S.padErr = S.padErr || []).push(e); msNext(L2(`착륙 ✓ 오차 ${e.toFixed(2)} m`, `Landed ✓ ${e.toFixed(2)} m off`), '#5dff9a'); } else if (e < 6 && S.bumpT <= 0) { showMsg(L2(`패드 밖 ${e.toFixed(1)} m · 다시 떠서 가운데로`, `Off the pad ${e.toFixed(1)} m · lift and recentre`), '#ff9a40', 1.4); S.bumpT = 1.5; } }
  } else if (o.t === 'rwyland') { if (DR.gnd && (DR.as || 0) < 2) msNext(L2('활주로 착륙 ✓', 'Landed on the runway ✓'), '#5dff9a'); }
  else if (o.t === 'fire') fireStep(cur, dt);
  else if (o.t === 'strikeAll') strikeAim(o, cur);
  else if (o.t === 'sarfind' || o.t === 'land' || o.t === 'track') scenStep(o, cur, dt);
  else if (o.t === 'recon') {
    const inView = sensorSees(o.tp, cur, AFc().reconD || 260);
    o.inView = inView; if (inView) o.seenT = S.simT;   // 사진은 직접 찍어 보고 (SPACE·Enter·📷·A·R트리거)
  }
}
// 센서 시야: 앞 화면 가운데 또는 아래 카메라(수직) 시야 안
const _sv = new V3();
function sensorSees(tp, cur, maxD) {
  maxD *= wxSense();
  const d = tp.distanceTo(cur), sp = toScreen(tp), x = sp.x / innerWidth * 2 - 1, y = 1 - sp.y / innerHeight * 2;
  const front = !sp.behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.92 && d > 3 && d < maxD;   // 화면에 보이면 (가장자리 조금 빼고)
  if (front) return true;
  const dy = cur.y - tp.y, h = Math.hypot(tp.x - cur.x, tp.z - cur.z);
  if (dy > 3 && dy < maxD && h < dy * 0.85) return true;   // 바로 아래 (아래 카메라)
  // 지금 켜져 있는 아래 카메라 화면(PC 작은 창 · VR 하부 카메라)에 보이면
  const lc = XR_ON && (SET.vrPip | 0) > 0 ? VR_PIP.cam : (typeof bellyMode === 'function' && bellyMode() !== null ? bellyCam : null);
  if (lc && d < maxD) { _sv.copy(tp).project(lc); if (_sv.z < 1 && Math.abs(_sv.x) < 0.95 && Math.abs(_sv.y) < 0.95) return true; }
  return false;
}
// ---- 사진 보고: 지금 카메라 화면을 작은 사진으로 (좌표·시각 표시) ----
const PH = { rt: null, lut: null, last: null, lastT: 0 };
// ---- 임무 후 브리핑: 점수(과제·시간·안전) · 비행 기록 · 벌점 내역 · 과제별 시간 ----
const DBF = { dist: 0, vmax: 0, altMax: 0, resp: 0, pens: [], objs: [], pen0: 0 };
function dbfStart() { Object.assign(DBF, { dist: 0, vmax: 0, altMax: 0, resp: 0, pens: [], objs: [], pen0: 0, flyT: 0 }); }
function dbfObj(label, ok) { if (S.state === 'run') DBF.objs.push({ label: String(label || ''), ok, t: S.t }); }
// 누적 비행 시간 (모든 모드 · 로컬 저장)
const TOT = (() => { let t = 0; try { t = +localStorage.getItem('fpvsim_fpv_flyT') || 0; } catch (e) { } return { t, save: 0 }; })();
function totFlyText() { const h = Math.floor(TOT.t / 3600), m = Math.floor(TOT.t % 3600 / 60); return L2('누적 비행 ', 'Flight time ') + (h ? h + 'h ' : '') + m + 'm'; }
function totFlyUI() { const e = $('totFly'); if (e) e.textContent = totFlyText(); }
function dbfTick(dt) {
  splitTick(dt);
  if (S.state === 'run' && DR.alive && !DR.landed) { TOT.t += dt; TOT.save += dt; if (TOT.save > 15) { TOT.save = 0; try { localStorage.setItem('fpvsim_fpv_flyT', String(Math.round(TOT.t))); } catch (e) { } } }
  if (S.state !== 'run' || !S.running) return;
  if (DR.alive && !DR.landed) { const v = DR.v.length(); DBF.dist += v * dt; DBF.vmax = Math.max(DBF.vmax, v); DBF.flyT += dt; DBF.altMax = Math.max(DBF.altMax, DR.p.y - groundAt(DR.p.x, DR.p.z)); }
  if (S.pen > DBF.pen0 + 0.01) { DBF.pens.push({ t: S.t, d: S.pen - DBF.pen0, why: S.lastMsg && S.t - (S.lastMsgT || 0) < 2 && /\+\s?\d+\s?(s|초)|MISS|IMPACT|SKIP|번짐|spread/i.test(S.lastMsg) ? S.lastMsg : (S.kind === 'fire' ? L2('불씨 번짐', 'fire spread') : '') }); DBF.pen0 = S.pen; }
}
function dbfScore(ok, n, par) {
  const total = S.t + S.pen, r = n ? ok / n : 1, tf = par > 0 ? clamp(par / Math.max(1, total), 0, 1) : 1, cf = Math.max(0, 1 - 0.1 * (S.impacts || 0) - 0.15 * DBF.resp - 0.2 * (S.lost || 0));
  const a = Math.round(55 * r), b = Math.round(30 * tf), c = Math.round(15 * cf), sc = a + b + c;
  return { sc, a, b, c, g: sc >= 90 ? 'S' : sc >= 80 ? 'A' : sc >= 65 ? 'B' : sc >= 50 ? 'C' : 'D', col: sc >= 90 ? '#ffc828' : sc >= 80 ? '#5dff9a' : sc >= 65 ? '#4fe3ff' : '#ff9a40', total, par };
}
function debriefShow(ok, n, par) {
  const R = dbfScore(ok, n, par); DBF.last = Object.assign({ ok, n }, R);
  const el = $('resScore'); if (el) el.innerHTML = `<span class="sc">${R.sc}</span><span class="gr" style="color:${R.col}">${R.g}</span><span class="pt">${L2('과제', 'Tasks')} ${R.a}/55 · ${L2('시간', 'Time')} ${R.b}/30 · ${L2('안전', 'Safety')} ${R.c}/15<br>${L2('합계', 'Total')} ${fmt(R.total)} · ${L2('기준', 'Par')} ${fmt(par || 0)}</span>`;
  const ln = (a, b, cls) => `<div class="ln"><span>${a}</span><span class="${cls || ''}">${b}</span></div>`;
  let h = `<h4>${L2('비행 기록', 'FLIGHT')}</h4>` + ln(L2('비행 거리', 'Distance'), (DBF.dist >= 1000 ? (DBF.dist / 1000).toFixed(2) + ' km' : DBF.dist.toFixed(0) + ' m')) + ln(L2('최고 속도', 'Top speed'), (DBF.vmax * 3.6).toFixed(0) + ' km/h') +
    ln(L2('평균 속도', 'Average speed'), (DBF.flyT > 1 ? DBF.dist / DBF.flyT * 3.6 : 0).toFixed(0) + ' km/h') + ln(L2('최고 고도 (지면 위)', 'Max height (AGL)'), DBF.altMax.toFixed(1) + ' m') +
    ln(L2('충돌 · 재출발', 'Impacts · restarts'), `${S.impacts || 0} · ${DBF.resp}`, (S.impacts || DBF.resp) ? 'bad' : 'ok');
  if (S.photos && S.photos.length) h += ln(L2('사진 (인정 / 전체)', 'Photos (valid / taken)'), `${S.photos.filter(p => p.ok).length} / ${S.photos.length}`);
  h += `<h4>${L2('벌점 내역', 'PENALTIES')} · +${S.pen.toFixed(0)} s</h4>` + (DBF.pens.length ? DBF.pens.map(p => ln(`${fmt(p.t)} ${p.why || L2('벌점', 'penalty')}`, '+' + p.d.toFixed(0) + ' s', 'bad')).join('') : `<div class="dim">${L2('없음', 'None')}</div>`);
  if (DBF.objs.length) { let pt = 0; h += `<h4>${L2('과제별 기록', 'TASKS')} · ${ok}/${n}</h4>` + DBF.objs.map((o, i) => { const s = ln(`${i + 1}. ${o.ok ? '✓' : '✗'} ${o.label}`, `${fmt(o.t)} <span class="dim">(+${(o.t - pt).toFixed(1)})</span>`, o.ok ? 'ok' : 'bad'); pt = o.t; return s; }).join(''); }
  // 다음에는: 기록에서 고칠 점 최대 3가지
  { const tips = []; const miss = DBF.objs.filter(o => !o.ok).length;
    if (miss) tips.push(L2(`놓친 과제 ${miss}개 — 다음 목표가 뜨면 속도를 줄이고 가이드 선을 따라가기`, `${miss} missed task(s) — slow down when the next target appears and follow the guide`));
    if ((S.impacts || 0) >= 2) tips.push(L2(`충돌 ${S.impacts}회 — 장애물 앞에서 먼저 고도를 맞추고 통과`, `${S.impacts} impacts — set height before the obstacle, then pass`));
    if (par && S.t > par * 1.3) tips.push(L2('기준 시간보다 30% 이상 느림 — 목표 사이 직선 구간에서 속도 올리기', 'Over 30% slower than par — speed up on the straight legs between targets'));
    if (DBF.pens.length >= 3) tips.push(L2(`벌점 ${DBF.pens.length}건 — 벌점 내역에서 반복되는 원인 하나부터 없애기`, `${DBF.pens.length} penalties — fix the most repeated cause first`));
    if (S.photos && S.photos.length && S.photos.filter(p => !p.ok).length > S.photos.filter(p => p.ok).length) tips.push(L2('무효 사진이 많음 — 대상을 화면 가운데에 두고 1.5초 멈춘 뒤 촬영', 'Many invalid photos — centre the target and hold 1.5 s before shooting'));
    if (!tips.length) tips.push(R.g === 'S' ? L2('깔끔한 비행 — 다음 난이도나 바람 설정으로 올려보기', 'Clean flight — try the next difficulty or add wind') : L2('큰 실수 없음 — 같은 임무를 한 번 더 하며 기준 시간을 당겨보기', 'No major errors — fly it again and chase the par time'));
    h = `<h4>${L2('다음에는', 'NEXT TIME')}</h4>` + tips.slice(0, 3).map(x => `<div class="ln"><span>• ${x}</span></div>`).join('') + h; }
  const d = $('resDebrief'); if (d) d.innerHTML = h;
  try { if (typeof rkSubmit === 'function') rkSubmit(R); } catch (e) { }
}
// ---- 항공(UAS)식 계기: 피치 사다리 · 속도/고도 테이프 · HSI(방위 원판 + 목표 방위 바늘 + 바람) ----
function hudMode() { const m = SET.hud || 'auto'; return m === 'auto' ? (AFc().cls === 'wing' ? 'uas' : 'fpv') : m; }
function uasDraw(g, W, H, sb, o, sIn, hsiY) {
  if (!sb || !sb.p) return;
  const GRN = '#7dffb0', CY = '#4fe3ff', DEGR = Math.PI / 180;
  const T = (t, x, y, sz, col, al) => { g.font = `700 ${sz}px system-ui, sans-serif`; g.textAlign = al || 'left'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(t, x, y); g.fillStyle = col || '#fff'; g.fillText(t, x, y); };
  const prj = p => { const q = p.clone().project(camera); return { x: (q.x + 1) / 2 * W, y: (1 - q.y) / 2 * H, ok: q.z < 1 && q.z > -1 }; };
  // 피치 사다리 (실제 수평선 기준 ±10·20·30°)
  const f = new V3(0, 0, -1).applyQuaternion(camera.quaternion); f.y = 0;
  if (f.lengthSq() > 1e-4) { f.normalize(); const r = new V3(-f.z, 0, f.x), c0 = camera.position, a = prj(c0.clone().addScaledVector(f, 1000).addScaledVector(r, -100)), b = prj(c0.clone().addScaledVector(f, 1000).addScaledVector(r, 100));
    if (a.ok && b.ok) { let ux = b.x - a.x, uy = b.y - a.y; const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L; g.strokeStyle = GRN; g.lineWidth = 2.5;
      for (let e = -30; e <= 30; e += 10) { const d = f.clone().multiplyScalar(Math.cos(e * DEGR)); d.y = Math.sin(e * DEGR); const c = prj(c0.clone().addScaledVector(d, 1000)); if (!c.ok || Math.abs(c.x - W / 2) > W * 0.42 || Math.abs(c.y - H / 2) > H * 0.4) continue;
        const w = e === 0 ? W * 0.22 : 70, gp = e === 0 ? 70 : 26; g.setLineDash(e < 0 ? [10, 8] : []); g.beginPath(); g.moveTo(c.x - ux * w, c.y - uy * w); g.lineTo(c.x - ux * gp, c.y - uy * gp); g.moveTo(c.x + ux * gp, c.y + uy * gp); g.lineTo(c.x + ux * w, c.y + uy * w); g.stroke(); g.setLineDash([]);
        if (e) { T(String(Math.abs(e)), c.x + ux * (w + 20), c.y + uy * (w + 20), 17, GRN, 'center'); T(String(Math.abs(e)), c.x - ux * (w + 20), c.y - uy * (w + 20), 17, GRN, 'center'); } }
      // 경사(뱅크) 표시: 수평선 기울기
      const bank = Math.atan2(uy, ux) / DEGR; if (Math.abs(bank) > 3) T((bank > 0 ? 'R ' : 'L ') + Math.abs(bank).toFixed(0) + '°', W / 2, H / 2 + 64, 18, GRN, 'center'); } }
  // 기체 기준 표시 (가운데 고정 W 모양)
  g.strokeStyle = '#ffc828'; g.lineWidth = 4; g.beginPath(); g.moveTo(W / 2 - 70, H / 2); g.lineTo(W / 2 - 26, H / 2); g.lineTo(W / 2 - 13, H / 2 + 13); g.lineTo(W / 2, H / 2); g.lineTo(W / 2 + 13, H / 2 + 13); g.lineTo(W / 2 + 26, H / 2); g.lineTo(W / 2 + 70, H / 2); g.stroke();
  // 테이프 (속도 왼쪽 · 고도 오른쪽)
  const tape = (x, val, ppu, step, lab, unit, side, dec) => {
    const h = 300, y0 = H / 2, w = 74, x0 = side < 0 ? x - w : x; g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(x0, y0 - h / 2, w, h); g.strokeStyle = GRN; g.lineWidth = 2; g.strokeRect(x0, y0 - h / 2, w, h);
    g.save(); g.beginPath(); g.rect(x0, y0 - h / 2, w, h); g.clip(); const r0 = Math.floor((val - h / 2 / ppu) / step) * step;
    for (let v = r0; v <= val + h / 2 / ppu; v += step) { const y = y0 - (v - val) * ppu, big = Math.round(v / step) % (lab / step) === 0, tx = side < 0 ? x : x0;
      g.strokeStyle = GRN; g.beginPath(); g.moveTo(tx, y); g.lineTo(tx - side * (big ? 16 : 9), y); g.stroke(); if (big && v >= 0) T(String(Math.round(v)), side < 0 ? x - 22 : x0 + 22, y, 17, GRN, side < 0 ? 'right' : 'left'); }
    g.restore();
    const bw = 92, bx = side < 0 ? x - bw - 4 : x0 + 4; g.fillStyle = '#071016'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.rect(bx, y0 - 20, bw, 40); g.fill(); g.stroke();
    T(val.toFixed(dec || 0), bx + bw / 2, y0, 26, '#fff', 'center'); T(unit, side < 0 ? x - w / 2 : x0 + w / 2, y0 - h / 2 - 16, 17, GRN, 'center'); };
  const sp = sb.v ? sb.v.length() : 0, agl = sb.p.y - groundAt(sb.p.x, sb.p.z), vs = sb.v ? sb.v.y : 0;
  tape(W / 2 - W * 0.2, sp * 3.6, 4, 5, 10, 'km/h', -1, 0);
  tape(W / 2 + W * 0.2, Math.max(0, agl), 12, 1, 5, 'AGL m', 1, 1);
  T((vs > 0.15 ? '▲ ' : vs < -0.15 ? '▼ ' : '■ ') + Math.abs(vs).toFixed(1) + ' m/s', W / 2 + W * 0.2 + 37, H / 2 + 170, 18, Math.abs(vs) > 3 ? '#ff9a40' : GRN, 'center');
  // HSI
  const hx = W / 2, hy = hsiY || H - 128, R = 92, hdg = ((((SITE.brg || 0) + (sb.h || 0) / DEGR) % 360) + 360) % 360, wdeg = v => (SITE.brg || 0) + Math.atan2(v.x, -v.z) / DEGR;
  g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(hx, hy, R + 8, 0, 7); g.fill(); g.strokeStyle = GRN; g.lineWidth = 2; g.stroke();
  for (let d = 0; d < 360; d += 5) { const a = (d - hdg - 90) * DEGR, big = d % 30 === 0, mid = d % 10 === 0, r1 = R - (big ? 14 : mid ? 9 : 5);
    g.strokeStyle = GRN; g.lineWidth = big ? 2.5 : 1.5; g.beginPath(); g.moveTo(hx + Math.cos(a) * R, hy + Math.sin(a) * R); g.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); g.stroke();
    if (big) T(({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' })[d] || String(d / 10), hx + Math.cos(a) * (R - 28), hy + Math.sin(a) * (R - 28), d % 90 === 0 ? 19 : 15, d === 0 ? '#ffc828' : GRN, 'center'); }
  g.fillStyle = '#ffc828'; g.beginPath(); g.moveTo(hx, hy - R - 2); g.lineTo(hx - 9, hy - R - 16); g.lineTo(hx + 9, hy - R - 16); g.closePath(); g.fill();   // 기수 표시
  g.fillStyle = '#071016'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.rect(hx - 34, hy - R - 50, 68, 30); g.fill(); g.stroke(); T(String(Math.round(hdg)).padStart(3, '0') + '°', hx, hy - R - 35, 20, '#fff', 'center');
  // 기체 모양 (원판 가운데)
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(hx, hy - 16); g.lineTo(hx, hy + 14); g.moveTo(hx - 14, hy - 2); g.lineTo(hx + 14, hy - 2); g.moveTo(hx - 6, hy + 12); g.lineTo(hx + 6, hy + 12); g.stroke();
  // 목표 방위 바늘 (수색 구역 안에서는 감춤)
  if (o && o.mk && !sIn && glMap()) { const d = o.mk.clone().sub(sb.p), brg = ((wdeg(d) % 360) + 360) % 360, a = (brg - hdg - 90) * DEGR, dist = o.search ? Math.max(0, Math.hypot(d.x, d.z) - o.search.r) : Math.hypot(d.x, d.z);
    g.strokeStyle = CY; g.fillStyle = CY; g.lineWidth = 4; g.beginPath(); g.moveTo(hx - Math.cos(a) * (R - 18), hy - Math.sin(a) * (R - 18)); g.lineTo(hx + Math.cos(a) * (R - 22), hy + Math.sin(a) * (R - 22)); g.stroke();
    g.save(); g.translate(hx + Math.cos(a) * (R - 18), hy + Math.sin(a) * (R - 18)); g.rotate(a); g.beginPath(); g.moveTo(10, 0); g.lineTo(-10, -9); g.lineTo(-10, 9); g.closePath(); g.fill(); g.restore();
    T(L2('목표 ', 'TGT ') + String(Math.round(brg)).padStart(3, '0') + '°', hx - R - 22, hy - 14, 18, CY, 'right'); T((dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m'), hx - R - 22, hy + 12, 18, CY, 'right'); }
  // 바람 (불어오는 쪽에서 화살표)
  if (WIND.lv) { const wv = windAt(sb.p), ws = Math.hypot(wv.x, wv.z); if (ws > 0.3) { const from = ((wdeg(wv) + 180) % 360 + 360) % 360, a = (from - hdg - 90) * DEGR; g.strokeStyle = '#ff9a40'; g.lineWidth = 3; g.beginPath(); g.moveTo(hx + Math.cos(a) * (R + 20), hy + Math.sin(a) * (R + 20)); g.lineTo(hx + Math.cos(a) * (R - 40), hy + Math.sin(a) * (R - 40)); g.stroke();
    T(L2('바람 ', 'WIND ') + String(Math.round(from)).padStart(3, '0') + '° ' + ws.toFixed(0) + ' m/s', hx + R + 22, hy + 12, 17, '#ff9a40', 'left'); } }
  T('GS ' + (sp * 3.6).toFixed(0), hx + R + 22, hy - 14, 18, GRN, 'left');
}
// PC 화면: 겹쳐 그리는 캔버스 (가상 높이 720 기준으로 크기 맞춤)
function uasPC(sb, o) {
  let cv = $('uasHud'); const on = !XR_ON && hudMode() === 'uas' && (S.state === 'run' || S.state === 'replay' || S.state === 'demo') && S.cam === 0;
  document.body.classList.toggle('uas', on);
  if (!on) { if (cv) cv.style.display = 'none'; return; }
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'uasHud'; document.body.appendChild(cv); }
  cv.style.display = ''; const dpr = Math.min(2, devicePixelRatio || 1), Wp = innerWidth, Hp = innerHeight; if (cv.width !== Math.round(Wp * dpr) || cv.height !== Math.round(Hp * dpr)) { cv.width = Math.round(Wp * dpr); cv.height = Math.round(Hp * dpr); cv.style.width = Wp + 'px'; cv.style.height = Hp + 'px'; }
  const g = cv.getContext('2d'), s = Hp / 720 * dpr, VW = Wp / Hp * 720; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.setTransform(s, 0, 0, s, 0, 0);
  document.body.style.setProperty('--hsiH', Math.round(260 * Hp / 720) + 'px');
  uasDraw(g, VW, 720, sb, o, searchIn(o, sb.p), 720 - 150);
}
function photoMission() { return S.kind === 'fire' || S.kind === 'sar' || S.kind === 'recon' || S.kind === 'track'; }
// 투하 버튼이 하는 일: 코스·자유 = 투하 / 산불·정찰·추적·수색(찾기 전) = 사진 보고 / 그 밖 = 없음
function actionKind() {
  if (!isMission()) return AFc().drop ? 'drop' : 'none';
  if (S.kind === 'sar') { const o = msObj(); return o && o.t === 'sarkit' ? 'drop' : 'report'; }
  if (S.kind === 'fire' || S.kind === 'recon' || S.kind === 'track') return 'report';
  return 'none';
}
function snapPhoto(cap, tp) {
  try {
    const W0 = 384, H0 = 216; if (!PH.rt) { PH.rt = new THREE.WebGLRenderTarget(W0, H0); PH.lut = new Uint8Array(256); for (let i = 0; i < 256; i++) PH.lut[i] = Math.round(255 * Math.pow(i / 255, 1 / 2.2)); }
    const xe = renderer.xr.enabled, cur = renderer.getRenderTarget(), asp = camera.aspect; renderer.xr.enabled = false; camera.aspect = 16 / 9; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    PH.via = 'main'; let cam = camera;   // 목표가 화면 밖(바로 아래 등)이면 짐벌을 목표 쪽으로 돌려 찍음
    const seen = (c) => { const q = tp.clone().project(c); return q.z < 1 && q.z > -1 && Math.abs(q.x) < 0.8 && Math.abs(q.y) < 0.8; };
    if (tp && !seen(camera)) { const lc = XR_ON && (SET.vrPip | 0) > 0 ? VR_PIP.cam : (typeof bellyMode === 'function' && bellyMode() !== null ? bellyCam : null); if (lc && seen(lc)) { cam = lc; PH.via = 'lower'; } }
    if (tp && cam === camera && !seen(camera)) { PH.via = 'gimbal'; { cam = PH.cam || (PH.cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 4000)); cam.position.copy(DR.p).add(new V3(0, -0.15, 0)); cam.lookAt(tp); cam.updateMatrixWorld(); } }
    const hid = []; const hide = o => { if (o && o.visible) { o.visible = false; hid.push(o); } }; GUIDE.meshes.forEach(m => hide(m.g)); [marker, impactRing, GCHEV.m, GPATH.m, GAXIS.m, BEACON.g].forEach(hide); OBJS.forEach(q => hide(q.hint));   // 사진엔 안내 표시 없이 (쉐브론·빛기둥·과제 강조까지)
    renderer.setRenderTarget(PH.rt); renderer.clear(); renderer.render(scene, cam); hid.forEach(o => o.visible = true); const px = new Uint8Array(W0 * H0 * 4); renderer.readRenderTargetPixels(PH.rt, 0, 0, W0, H0, px);
    renderer.setRenderTarget(cur); renderer.xr.enabled = xe; camera.aspect = asp; camera.updateProjectionMatrix();
    const c = document.createElement('canvas'); c.width = W0; c.height = H0; const g = c.getContext('2d'), id = g.createImageData(W0, H0), lin = PH.rt.texture.encoding !== THREE.sRGBEncoding;
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) { const s = ((H0 - 1 - y) * W0 + x) * 4, d = (y * W0 + x) * 4; for (let k = 0; k < 3; k++) id.data[d + k] = lin ? PH.lut[px[s + k]] : px[s + k]; id.data[d + 3] = 255; }
    g.putImageData(id, 0, 0);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, H0 - 34, W0, 34); g.fillStyle = '#ffc828'; g.font = '700 13px monospace'; g.fillText(cap[0] || '', 8, H0 - 19); g.fillStyle = '#fff'; g.font = '12px monospace'; g.fillText(cap[1] || '', 8, H0 - 5);
    g.textAlign = 'right'; g.fillStyle = '#9fe9ff'; g.fillText(({ main: L2('주 카메라', 'MAIN CAM'), lower: L2('하부 카메라', 'LOWER CAM'), gimbal: L2('짐벌 회전', 'GIMBAL') })[PH.via] || '', W0 - 8, H0 - 19); g.textAlign = 'left';
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.strokeRect(W0 / 2 - 30, H0 / 2 - 30, 60, 60);
    return c;
  } catch (e) { return null; }
}
function photoAdd(c, label, xy, ok) {
  if (!c) return; const url = c.toDataURL('image/jpeg', 0.82); (S.photos = S.photos || []).push({ url, label, xy, ok, t: S.t });
  const im = new Image(); im.src = url; PH.last = im; PH.lastOk = ok; PH.lastT = 3;
  let el = $('photoPop'); if (!el) { el = document.createElement('img'); el.id = 'photoPop'; el.style.cssText = 'position:fixed;right:14px;top:120px;width:220px;border-radius:8px;border:2px solid #5dff9a;z-index:40;box-shadow:0 4px 18px rgba(0,0,0,.5);transition:opacity .4s'; document.body.appendChild(el); }
  el.src = url; el.style.borderColor = ok ? '#5dff9a' : '#ff9a40'; el.style.opacity = 1; clearTimeout(PH.tm); PH.tm = setTimeout(() => { el.style.opacity = 0; }, 2600);
}
function missionPhoto() {
  if (!DR.alive) return;
  if (PH.lastSim !== undefined && Math.abs(S.simT - PH.lastSim) < 0.3) return; PH.lastSim = S.simT;   // 같은 버튼이 두 번 들어와도 한 장만
  flashPhoto(); sfx('drop');
  const now = new Date(), hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ' · ' + pilotName(), o = msObj();
  const xyS = (d, s) => { const xy = to5186(d, s); return xy ? `X ${xy[0].toFixed(0)}  Y ${xy[1].toFixed(0)}` : ''; };
  if (S.kind === 'fire') {
    const f = MS.list.find(x => x.active && !x.done && (x.inView || S.simT - (x.seenT ?? -9) < 1.5));   // 열화상이든 눈이든 방금(1.5초 안) 화면에 있었으면
    if (f) { comm('Control, Eagle One. Hotspot confirmed. Photo and grid sent.', '이글 원: 불씨 확인 · 사진과 좌표 전송', OP); const xy = to5186(f.d, f.s); photoAdd(snapPhoto([(f.via === 'ir' ? L2('불씨 확인 · 열화상', 'HOTSPOT · THERMAL') : L2('불씨 확인 · 카메라', 'FIRE · CAMERA')) + '  ' + hm, xyS(f.d, f.s)], f.tp), f.label, xy, true); fireReport(f, xy); return; }
    const seen = MS.list.find(x => x.active && !x.done && x.seenVis);
    photoAdd(snapPhoto([L2('사진 · 확인 불가', 'PHOTO · UNCONFIRMED') + '  ' + hm, '']), '', null, false);
    showMsg(seen ? L2('연기만 찍힘 · 더 가까이 가거나 열화상(T)으로 다시', 'Smoke only · get closer or use thermal (T) and retake') : L2('사진에 불씨 없음 · 화면에 담고 찍기', 'No fire in frame · get it on screen and retake'), '#ff9a40', 1.8); return;
  }
  if (S.kind === 'recon' && o && o.t === 'recon') {
    if (o.inView || S.simT - (o.seenT ?? -9) < 1.5) { comm('Control, Eagle One. Imagery sent.', '이글 원: 사진 전송', OP); photoAdd(snapPhoto([L2('정찰 사진', 'RECON IMAGE') + '  ' + hm, o.label.split(' · ')[0]], o.tp), o.label, to5186(o.d || 0, o.s || 0), true); msNext('PHOTO ✓ ' + o.label.split(' · ')[0], '#5dff9a'); return; }
    photoAdd(snapPhoto([L2('사진 · 대상 없음', 'PHOTO · NO TARGET') + '  ' + hm, '']), '', null, false); showMsg(L2('사진에 대상 건물 없음 · 화면 가운데(또는 아래 카메라)에 담고 다시', 'Target not in frame · center it and retake'), '#ff9a40', 1.8); return;
  }
  if (S.kind === 'track' && o && o.t === 'track') {
    const ok = !!o.inView || S.simT - (o.seenT ?? -9) < 1.5; photoAdd(snapPhoto([(ok ? L2('추적 차량', 'TRACKED VEHICLE') : L2('사진', 'PHOTO')) + '  ' + hm, ''], ok && TRACK ? trackPose(TRACK.s).p : null), o.label, null, ok);
    if (ok) { comm('Control, Eagle One. Imagery sent.', '이글 원: 사진 전송', OP); showMsg(L2('차량 사진 보고 ✓', 'Vehicle photo reported ✓'), '#5dff9a', 1.4); } else showMsg(L2('사진에 차량 없음', 'Vehicle not in frame'), '#ff9a40', 1.4); return;
  }
  if (S.kind === 'sar' && o && o.t === 'sarfind') {
    if (!(o.inView || S.simT - (o.seenT ?? -9) < 1.5) && SMK && SMK.on && !SMK.ok && SMK.seen && smkCall()) return;   // 연막이 가운데 있으면 색 부르기
    if (o.inView || S.simT - (o.seenT ?? -9) < 1.5) { comm('Control, Eagle One. Subject located. Photo and grid sent.', '이글 원: 실종자 발견 · 사진과 좌표 전송', OP); const xy = to5186(SAR.d, SAR.s); S.sarXY = xy; photoAdd(snapPhoto([L2('실종자 발견', 'SUBJECT FOUND') + '  ' + hm, xyS(SAR.d, SAR.s)], SAR.tp), o.label, xy, true); msNext(xy ? `실종자 발견 · 사진 보고 ✓ X ${xy[0].toFixed(0)} · Y ${xy[1].toFixed(0)}` : '실종자 발견 · 사진 보고 ✓', '#5dff9a'); return; }
    photoAdd(snapPhoto([L2('사진 · 확인 불가', 'PHOTO · UNCONFIRMED') + '  ' + hm, '']), '', null, false);
    showMsg(L2('사진에 실종자 없음 · 가까이(열화상은 멀리서도) 화면 가운데에', 'No subject in frame · get closer (or use thermal) and center it'), '#ff9a40', 1.8); return;
  }
  photoAdd(snapPhoto([L2('사진', 'PHOTO') + '  ' + hm, '']), '', null, false);
}
function orderTick() {   // 휴대폰: 📻 버튼(눌러 펼치기) · PC·VR: 일시정지 메뉴에 표시
  { const po = $('pauseOrder'); if (po) { const t = ORDER.m ? ((window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en) : ''; po.style.display = t ? '' : 'none'; if (po.dataset.t !== t) { po.dataset.t = t; po.innerHTML = `<b>${L2('📻 마지막 명령', '📻 LAST ORDER')}</b>${t}`; } } }
  let el = $('orderBox'); const on = !!ORDER.m && S.state === 'run' && (isMission() || S.kind === 'course') && !XR_ON && IS_TOUCH;
  if (!el) { if (!on) return; el = document.createElement('div'); el.id = 'orderBox'; (ui.hud || document.body).appendChild(el); el.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); el.classList.toggle('open'); el.classList.remove('new'); }); }
  el.style.display = on ? '' : 'none'; if (!on) return; const t = (window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en; if (el.dataset.t !== t) { el.dataset.t = t; el.innerHTML = `<b>${L2('📻 명령', '📻 ORDER')}<i>▾</i></b><span>${t}</span>`; if (!el.classList.contains('open')) el.classList.add('new'); }
}
function actionUI() { const b = $('tbDrop'); if (!b) return; const k = S.state === 'run' ? actionKind() : 'drop', t = k === 'report' ? '📷 REPORT' : k === 'none' ? '—' : 'DROP'; if (b.dataset.k !== k) { b.dataset.k = k; b.textContent = t; b.style.borderColor = k === 'report' ? '#5dff9a' : ''; b.style.color = k === 'report' ? '#5dff9a' : ''; b.style.fontSize = k === 'report' ? '13px' : ''; } }
function photoTick(dt) { try { hdgTick(); } catch (e) { } { const lb = $('tbLight'); if (lb) lb.classList.toggle('off', !lightOn()); } wxTick(dt); orderTick(); actionUI(); try { tbAuto(); } catch (e) { } dbfTick(dt); try { uasPC(S.state === 'demo' ? ghostS : S.state === 'replay' ? RP.pose : DR, isMission() ? msObj() : curObj()); } catch (e) { } if (PH.lastT > 0) PH.lastT -= dt; const b = $('tbPhoto'); if (b) b.classList.add('hidden'); }   // 투하 버튼이 사진 보고를 겸함
function flashPhoto() { ui.flash.style.background = '#fff'; ui.flash.style.opacity = 0.55; setTimeout(() => { ui.flash.style.opacity = 0; ui.flash.style.background = ''; }, 140); }
// 자폭: 가까운 표적에 맞았는지
function strikeDetonate() {
  const so = msObj(); if (!so || so.t !== 'strikeAll') return false;
  const M = 1.5;   // 차체에서 1.5 m 안에서 터지면 명중 (차 옆 땅에 박혀도) · 오차는 차 중심에서 잼
  const o = STRIKE.find(t => !t.dead && (() => { const l = t.hull.worldToLocal(DR.p.clone()); return Math.abs(l.x) < 0.5 + M / 2.4 && Math.abs(l.y) < 0.5 + M / 1.3 && Math.abs(l.z) < 0.5 + M / 5.2; })());
  if (!o) return false;
  if (o.decoy) {   // 기만체: 가시광으로는 같지만 열화상으로는 차가움
    o.dead = true; o.col.off = true; o.hull.material = mat(0x1d1d1b, { roughness: 1 }); S.decoyHit++; S.pen += 20;
    spawnImpact(o.c.clone(), true); sfx('crash'); shake = 0.15; DR.alive = false; S.deadT = 1.8; droneM.g.visible = false;
    showMsg('DECOY +20s', '#ff9a40', 1.8); comm(`Negative, ${CS}, that was a decoy. Confirm heat signature before you commit.`, '기만체였음. 돌입 전 열 신호(T) 확인할 것.'); return true;
  }
  const err = Math.hypot(DR.p.x - o.c.x, DR.p.z - o.c.z);
  S.hitsS++; S.errS.push(err); o.dead = true; o.col.off = true;
  o.hull.material = mat(0x1d1d1b, { roughness: 1 });
  spawnImpact(o.c.clone(), true); spawnImpact(DR.p.clone(), true); sfx('crash'); rumble(1, 1, 400); shake = 0.2;
  DR.alive = false; S.deadT = 1.8; droneM.g.visible = false;
  sfx('good'); showMsg(`HIT · 중심에서 ${err.toFixed(1)} m`, '#5dff9a', 1.4); so.label = strikeLabel(); renderList();
  { const left = STRIKE.filter(t => !t.decoy && !t.dead).length; comm(left ? `Good hit, target destroyed. ${left} remaining. Next drone is up.` : 'Good effect on all targets. Cease fire, cease fire.', left ? `명중 확인. 남은 표적 ${left}대. 다음 기체 발진.` : '모든 표적 무력화. 사격 중지.'); }
  if (S.hitsS >= STRIKE.filter(t => !t.decoy).length) { so.done = true; MS.idx++; msFinish(); }
  return true;
}
function msFinish() {
  S.finished = true; S.running = false; if (REC) LAST_REC = recFinish();
  comm(`Mission complete. Good work, ${CS}. CONTROL out.`, '임무 완료 · 수고했음.');
  setTimeout(() => {
    if (S.state !== 'run') return;
    S.state = 'result'; ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden');
    const a = AFc(), total = S.t + S.pen, nm = MS_NAME[S.kind]; if ($('resTitle')) $('resTitle').textContent = 'MISSION COMPLETE';
    ui.resSub.textContent = `${pilotName()} · ${nm} · ${a.name} · ${MODES[SET.diff].name}`;
    const G = msGrade(total), rows = [['비행 시간', fmt(S.t)], ['벌점', '+' + S.pen.toFixed(0) + ' s'], ['합계', fmt(total)], ['충돌', S.impacts + ' 회']];
    if (S.kind === 'strike') rows.push(['명중', S.hitsS + ' / ' + STRIKE.filter(t => !t.decoy).length], [L2('기만체 타격', 'Decoys hit'), (S.decoyHit || 0) + L2(' 대', '')], ['기체 손실(빗나감)', (S.lost || 0) + ' 대'], ['평균 오차', (S.errS.reduce((x, y) => x + y, 0) / Math.max(1, S.errS.length)).toFixed(1) + ' m']);
    else if (S.lost) rows.push(['기체 손실', S.lost + ' 대']);
    if (S.kind === 'sar' && S.sarXY) rows.push(['실종자 위치 (EPSG:5186)', S.sarXY[0].toFixed(0) + ', ' + S.sarXY[1].toFixed(0)]);
    if (S.kind === 'sar' && S.kitErr !== undefined) rows.push(['키트 오차', S.kitErr.toFixed(1) + ' m']);
    if (S.kind === 'field' && S.padErr && S.padErr.length) rows.push([L2('착륙 오차', 'Landing error'), S.padErr.map(e => e.toFixed(2)).join(' / ') + ' m']);
    if (S.kind === 'track') rows.push(['추적 유지', S.trT.toFixed(0) + ' / ' + S.trWin.toFixed(0) + ' s'], [L2('최대 노출', 'Peak exposure'), Math.round(TRACK.susMax || 0) + '%'], [L2('발각', 'Spotted'), TRACK.burn ? L2('예 (-30)', 'yes (-30)') : L2('아니오', 'no')], ['판정', S.trackOK ? '성공' : '실패']);
    if (S.kind === 'race') rows.push([L2('놓친 링', 'Missed rings'), MS.list.filter(x => x.miss).length + ' / ' + MS.list.length + L2(' (링당 +8 s)', ' (+8 s each)')]);
    if (S.kind === 'ridge' && RIDGE) rows.push(['정상 해발', RIDGE.top.toFixed(0) + ' m']);
    if (S.kind === 'fire') (S.fireRep || []).forEach((xy, i) => xy && rows.push(['불씨 ' + (i + 1) + ' (EPSG:5186)', xy[0].toFixed(0) + ', ' + xy[1].toFixed(0)]));
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td></tr>`).join('');
    debriefShow(MS.list.filter(x => x.done && !x.miss).length, MS.list.length, MS.par || 0);
    const ph = (S.photos || []).filter(p => p.ok), rp = $('resPhotos');
    if (rp) { rp.style.display = ph.length ? 'flex' : 'none'; rp.innerHTML = ph.map((p, i) => `<figure><a href="${p.url}" download="report_${S.kind}_${i + 1}.jpg"><img src="${p.url}" alt=""></a>${L2('보고 ', 'Report ')}${i + 1}${p.xy ? ' · ' + p.xy[0].toFixed(0) + ', ' + p.xy[1].toFixed(0) : ''}</figure>`).join(''); }
    const key = 'fpvsim_ms_best_' + S.kind + '_' + a.id + '_' + SET.diff + SITE_KEY; let best = null;
    try { best = parseFloat(localStorage.getItem(key)); } catch (e) { }
    if (!best || total < best) { try { localStorage.setItem(key, String(total)); if (MS.splits) localStorage.setItem(splitKey(), JSON.stringify(MS.splits)); } catch (e) { } ui.resBest.textContent = '★ 최고 기록 갱신'; }
    else ui.resBest.textContent = '최고 기록 ' + fmt(best);
  }, 1400);
}
function msOsd() {
  const o = msObj(), a = AFc(); let h = '';
  if (a.cls === 'wing') h += `<div class="x"><b>AS</b>${((DR.as || 0) * 3.6).toFixed(0)} km/h</div>` + (S.stallW ? '<div style="color:#ff5050">STALL ▼ · ' + L2('기수 내리고 스로틀', 'nose down, power') + '</div>' : S.stallWarn ? '<div style="color:#ffb030">' + L2('실속 주의 · 속도', 'STALL WARNING · speed') + '</div>' : '');
  if (a.cls === 'wing' && RWY) { const g = rwyGlide(DR.p); if (g) h += `<div style="color:${Math.abs(g.ang - 3) < 0.3 ? '#5dff9a' : '#ffc828'}">${glideText(g)}</div>`; }   // 활주로 접근각 (PAPI)
  if (S.kind === 'strike') h += `<div><b>HIT</b>${S.hitsS || 0}/${STRIKE.filter(t => !t.decoy).length}</div><div><b>LOST</b>${S.lost || 0}</div>`;
  else if (isMission()) h += `<div class="x"><b>HIT</b>${S.impacts}</div>`;
  if (S.kind === 'fire') { const n = FIRE.filter(f => f.on && f.active && !f.done).length, w = FIRE.filter(f => f.on && !f.active).length; h += `<div style="color:#ffb070">FIRE ${n}${w ? ' +' + w : ''}</div>`; }
  if (o && o.t === 'fire') h += o.inView ? `<div style="color:#5dff9a">● ${IS_TOUCH ? L2('불씨 포착', 'HOTSPOT') : L2('불씨 포착 · ', 'HOTSPOT · ') + repKey()}</div>` : o.seenVis ? `<div style="color:#ffb070">${L2('연기만 보임 · 더 가까이 또는 열화상(T)', 'Smoke only · closer or thermal (T)')}</div>` : `<div style="color:#9aa6ad">${ENV.ir ? 'IR 수색 중' : L2('연기·불꽃 찾기 · 열화상 T', 'Look for smoke/flames · thermal T')}</div>`;
  h += scenOsd(o);
  if (o && o.t === 'recon') h += `<div${o.inView ? '' : ' class="x"'} style="color:${o.inView ? '#5dff9a' : '#9aa6ad'}">${o.inView ? '● ' + (IS_TOUCH ? L2('건물 포착', 'TARGET') : L2('건물 포착 · ', 'TARGET · ') + repKey()) : L2('화면 가운데나 아래 카메라에 담기', 'Center it or use the lower camera')}</div>`;
  return h;
}
function msListHTML() {
  return MS.list.map((o, i) => { const cls = i === MS.idx ? 'cur' : o.miss ? 'miss' : o.done ? 'done' : ''; return `<div class="${cls}">${o.miss ? '✗' : o.done ? '✓' : i === MS.idx ? '▶' : '·'} ${o.label}</div>`; }).join('');
}

// ---------------- 시작 화면: 기체 카드 · 임무 ----------------
const AF_ICON = {
  x2d: '<path d="M22 18l-12-8M42 18l12-8M22 30l-12 8M42 30l12 8" stroke="currentColor" stroke-width="3"/><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor"/><circle cx="54" cy="10" r="7" fill="none" stroke="currentColor"/><circle cx="10" cy="38" r="7" fill="none" stroke="currentColor"/><circle cx="54" cy="38" r="7" fill="none" stroke="currentColor"/><rect x="24" y="12" width="16" height="24" rx="7" fill="currentColor"/>',
  fpv: '<path d="M18 12l28 24M46 12L18 36" stroke="currentColor" stroke-width="3"/><circle cx="16" cy="10" r="8" fill="none" stroke="currentColor"/><circle cx="48" cy="10" r="8" fill="none" stroke="currentColor"/><circle cx="16" cy="38" r="8" fill="none" stroke="currentColor"/><circle cx="48" cy="38" r="8" fill="none" stroke="currentColor"/><rect x="27" y="18" width="10" height="12" fill="currentColor"/>',
  fw: '<rect x="29" y="4" width="6" height="40" rx="3" fill="currentColor"/><rect x="4" y="14" width="56" height="6" rx="2" fill="currentColor"/><rect x="20" y="38" width="24" height="4" fill="currentColor"/>',
  kfpv: '<path d="M18 12l28 24M46 12L18 36" stroke="currentColor" stroke-width="3"/><circle cx="16" cy="10" r="8" fill="none" stroke="currentColor"/><circle cx="48" cy="10" r="8" fill="none" stroke="currentColor"/><circle cx="16" cy="38" r="8" fill="none" stroke="currentColor"/><circle cx="48" cy="38" r="8" fill="none" stroke="currentColor"/><rect x="28" y="8" width="8" height="32" rx="4" fill="#ff6a3d"/>',
  anafi: '<path d="M24 18l-10-7M40 18l10-7M24 30l-10 7M40 30l10 7" stroke="currentColor" stroke-width="3"/><circle cx="14" cy="11" r="6" fill="none" stroke="currentColor"/><circle cx="50" cy="11" r="6" fill="none" stroke="currentColor"/><circle cx="14" cy="37" r="6" fill="none" stroke="currentColor"/><circle cx="50" cy="37" r="6" fill="none" stroke="currentColor"/><rect x="26" y="12" width="12" height="24" rx="5" fill="currentColor"/>',
  puma: '<rect x="29" y="6" width="6" height="36" rx="3" fill="currentColor"/><rect x="1" y="15" width="62" height="5" rx="2" fill="currentColor"/><rect x="22" y="37" width="20" height="4" fill="currentColor"/>',
  kfw: '<rect x="29" y="4" width="6" height="40" rx="3" fill="#ff6a3d"/><rect x="10" y="12" width="44" height="4" rx="2" fill="currentColor"/><rect x="14" y="32" width="36" height="4" rx="2" fill="currentColor"/>'
};
function afUI() {
  const box = $('afCards'); if (!box) return; box.innerHTML = '';
  for (const id of AF_IDS) {
    const a = AF[id], b = document.createElement('button'); b.className = 'afc' + (id === SET.af ? ' on' : ''); b.dataset.af = id;
    const cat = a.kam ? 'kam' : a.cls === 'wing' ? 'wing' : id === 'fpv' ? 'fpv' : 'quad'; b.dataset.cat = cat;
    const catN = { quad: L2('정찰 쿼드', 'Recon quad'), fpv: L2('FPV', 'FPV'), wing: L2('고정익', 'Fixed-wing'), kam: L2('자폭', 'Loitering') }[cat];
    b.innerHTML = `<svg viewBox="0 0 64 48" aria-hidden="true">${AF_ICON[id]}</svg><i class="cat">${catN}</i><b>${a.name}</b><small>${a.sub}</small>` +
      `<span class="spec">최고 ${Math.round(a.top * 3.6)} km/h · ${a.endur}분</span><span class="nt">${a.note}</span>`;
    b.onclick = () => { MENU.afNote = ''; setAirframe(id); afUI(); };
    box.appendChild(b);
  }
  { const pb = $('afPaint');   // 기체 색 (기체마다 따로 기억)
    if (pb) { const cur = paintKey(), hx = c => '#' + c.toString(16).padStart(6, '0'), hex = k => Array.isArray(PAINTS[k]) ? hx(PAINTS[k][1]) : hx(PAINTS[k]);
      const sw = k => !k ? 'linear-gradient(135deg,#4a4f56,#16181b)' : Array.isArray(PAINTS[k]) ? `conic-gradient(${hx(PAINTS[k][1])} 0 25%,${hx(PAINTS[k][2])} 0 50%,${hx(PAINTS[k][3])} 0 75%,${hx(PAINTS[k][4])} 0)` : hex(k);   // 위장은 네 색 조각
      pb.innerHTML = `<span class="lb">${L2('기체 색', 'Colour')}</span>` + [['wood', L2('수풀 위장', 'Woodland')], ['rok', L2('화강암 위장', 'Granite digital')], ['ocp', L2('멀티캠', 'Multicam')], ['digital', L2('디지털 위장', 'Digital')], ['desert', L2('사막 위장', 'Desert')], ['urban', L2('도시 위장', 'Urban')], ['snow', L2('설상 위장', 'Snow')], ['navy', L2('해상 위장', 'Naval')], ['', L2('진회색 (기본)', 'Dark grey (stock)')], ['orange', L2('주황', 'Orange')], ['lime', L2('연두', 'Lime')], ['white', L2('흰색', 'White')], ['black', L2('검정', 'Black')]]
        .map(([k, n]) => `<button data-p="${k}" class="${k === cur ? 'on' : ''}" title="${n}" style="--pc:${sw(k)};--pc0:${k ? hex(k) : 'transparent'}"><i></i><small>${n}</small></button>`).join('') +
        `<span class="tip">${L2('어두운 숲·해질녘엔 밝은 색이 잘 보입니다', 'Bright colours stand out against dark forest and at dusk')}</span>`;
      pb.querySelectorAll('button').forEach(b => b.onclick = () => { const P = Object.assign({}, SET.paint); if (b.dataset.p) P[SET.af] = b.dataset.p; else delete P[SET.af]; SET.paint = P; saveSet(); setAirframe(SET.af); afUI(); }); } }
  const HAS = { forest: !!FLANE, race: RACE.length > 0, recon: RECON.length > 0, strike: STRIKE.length > 0, fire: FIRE.length > 0, sar: !!SAR, track: !!TRACK, ridge: !!RIDGE, field: !!RWY };
  document.querySelectorAll('#msGrid [data-ms]').forEach(b => { b.dataset.site = HAS[b.dataset.ms] !== false ? '1' : '0'; b.classList.remove('off'); b.title = ''; });
  if (typeof msVis === 'function') msVis();
  // 훈련장 고르기 (두 곳 이상일 때만)
  const sp = $('sitePick'), L = sitesAll();
  if (sp) { $('sitePickWrap').style.display = L.length < 2 ? 'none' : ''; sp.innerHTML = '';
    for (const st of L) { const b = document.createElement('button'); b.className = 'stc' + (st.id === SITE.id ? ' on' : ''); b.innerHTML = `<b>${stName(st)}</b><small>${st.flat ? '평지 · 기본 장애물 코스' : '실제 지형 · ' + (st.course ? '경로 따라 배치한 코스' : 'DEM')}</small>`;
      b.onclick = () => { if (st.id === SITE.id) return; siteSelect(st.id); location.reload(); }; sp.appendChild(b); } }
  const segA = $('segAcro'); if (segA) segA.querySelectorAll('button').forEach(x => x.classList.toggle('on', (x.dataset.v === '1') === !!SET.acro));
  if (typeof syncSeg === 'function') syncSeg();   // ACRO 가능 여부 · 정지 비행 스로틀 표시
  if (typeof MENU !== 'undefined' && $('msDetail')) { menuAfPanel(); menuDetail(); }
}
document.querySelectorAll('#segAcro button').forEach(b => b.addEventListener('click', () => { SET.acro = b.dataset.v === '1'; saveSet(); afUI(); }));

// =====================================================================
//  밤 · 열화상 · 산불 감시
// =====================================================================
if (!SET.tod) SET.tod = SET.night ? 'night' : 'day'; if (!SET.wx) SET.wx = 'clear';
const ENV = { night: SET.tod === 'night', dusk: SET.tod === 'dusk', wx: SET.wx, ir: false };
// 비·눈 오는 해질녘: 구름 낀 어두운 하늘 + 지평선에 흐린 주황 띠
const DUSK_WET_BG = (function () { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#24272f'); gr.addColorStop(0.45, '#45434b'); gr.addColorStop(0.64, '#7a6660'); gr.addColorStop(0.72, '#8c705e'); gr.addColorStop(1, '#3a3536'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
const SUN0 = SUN_DIR.clone(), DUSK_BG = (function () { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1d2a4a'); gr.addColorStop(0.42, '#6a4f72'); gr.addColorStop(0.62, '#e0875a'); gr.addColorStop(0.72, '#f3b06a'); gr.addColorStop(1, '#5a4636'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
const DAY0 = { sun: sun.intensity, sunC: sun.color.clone(), hs: hemi.color.clone(), hg: hemi.groundColor.clone(), fog: scene.fog.color.clone(), fn: scene.fog.near, ff: scene.fog.far };
const STARS = (function () {
  const n = 1400, p = new Float32Array(n * 3), r = rng(91);
  for (let i = 0; i < n; i++) { const u = r() * 2 * Math.PI, v = Math.acos(r() * 0.95), R = 2200; p[i * 3] = Math.sin(v) * Math.cos(u) * R; p[i * 3 + 1] = Math.cos(v) * R; p[i * 3 + 2] = Math.sin(v) * Math.sin(u) * R; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 2, sizeAttenuation: false, fog: false })); m.visible = false; scene.add(m); return m;
})();
// 열화상 하늘: 맑은 하늘은 아주 차가워 위쪽이 검고, 지평선 쪽은 대기 온도라 회색
const IR_BG = {};
function irBg(n) { const k = n ? 'n' : 'd'; if (IR_BG[k]) return IR_BG[k]; const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256), h = n ? '#666666' : '#7a7a7a';
  gr.addColorStop(0, n ? '#050505' : '#151515'); gr.addColorStop(0.5, n ? '#161616' : '#2c2c2c'); gr.addColorStop(0.72, h); gr.addColorStop(1, h); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (IR_BG[k] = t); }
// 열상 잡티(감지기 잡음): 화면 위 아주 옅은 알갱이 · 매 프레임 위치를 바꿔 지글거림
function irGrain(on) {
  let el = $('irGrain'); if (!on) { if (el) el.style.display = 'none'; return; }
  if (!el) { el = document.createElement('div'); el.id = 'irGrain'; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), d = g.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0);
    el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.13;mix-blend-mode:overlay;background:url(${c.toDataURL()});background-size:128px 128px;image-rendering:pixelated`;
    const cv = document.getElementById('c'); cv && cv.parentNode ? cv.parentNode.insertBefore(el, cv.nextSibling) : document.body.appendChild(el);
    (function jig() { if (el.style.display !== 'none') el.style.backgroundPosition = `${(Math.random() * 128) | 0}px ${(Math.random() * 128) | 0}px`; requestAnimationFrame(jig); })(); }
  el.style.display = XR_ON ? 'none' : '';
}
function envHemi() { return ENV.ir ? 0.55 : ENV.night ? 0.3 : 0.5; }
function envApply() {
  const n = ENV.night, ir = ENV.ir, dk = ENV.dusk && !n, wx = ENV.wx || 'clear', wet = wx !== 'clear';
  // 해질녘: 낮은 서쪽 해·주황 하늘·긴 그림자 / 비·눈: 흐림(해 약하게)·안개 짙게
  SUN_DIR.copy(dk ? new V3(-0.86, 0.2, -0.34).normalize() : SUN0);
  if (typeof c1Sun === 'function' && typeof isC1 === 'function' && isC1() && S.state !== 'menu') c1Sun();   // 1종: 시험 시각의 해 위치
  sun.intensity = ir ? (n ? 0.15 : 0.6) : n ? 0.32 : dk ? 0.85 : DAY0.sun * (wet ? 0.45 : 1); sun.color.copy(n ? new THREE.Color(0x9fb4ff) : dk ? new THREE.Color(0xffa565) : wet ? new THREE.Color(0xdfe4ea) : DAY0.sunC);
  hemi.color.copy(n ? new THREE.Color(0x4a5f8a) : dk ? new THREE.Color(0x9a7a8e) : wet ? new THREE.Color(0xb9c2cc) : DAY0.hs); hemi.groundColor.copy(n ? new THREE.Color(0x0c0c10) : dk ? new THREE.Color(0x3a2a20) : DAY0.hg);
  const wxBg = wx === 'snow' ? 0xc9ced4 : 0x8e969e, bg = ir ? 'ir' : n ? 0x05070d : dk ? 'dusk' : wet ? wxBg : null;
  sky.visible = bg === null; scene.background = bg === null ? null : bg === 'ir' ? irBg(n) : bg === 'dusk' ? (wet ? DUSK_WET_BG : DUSK_BG) : new THREE.Color(bg);
  // 안개 색은 하늘보다 어둡게: 먼 산이 밝은 띠(눈 덮인 산처럼)로 뜨지 않고 어두운 능선 실루엣으로 겹쳐 보이게
  const fogC = ir ? null : bg === null ? DAY0.fog : bg === 'dusk' ? (wet ? 0x4f4a4e : 0x6a5662) : wx === 'rain' && !n && !ir ? 0x737b82 : bg;   // 열화상: 먼 곳은 대기 온도(중간 회색)로 수렴
  if (ir) scene.fog.color.setRGB(n ? 0.4 : 0.48, n ? 0.4 : 0.48, n ? 0.4 : 0.48);   // 열화상: 먼 곳은 대기 온도(중간 회색)로 수렴 (안개는 화면 값 그대로 섞임)
  else scene.fog.color.copy(fogC instanceof THREE.Color ? fogC : new THREE.Color(fogC));
  scene.fog.near = ir ? 80 : n ? 60 : wet ? 15 : dk ? 60 : DAY0.fn; scene.fog.far = ir ? (wet ? 700 : 1700) : n ? (wet ? 600 : 1100) : wx === 'snow' ? 330 : wx === 'rain' ? (dk ? 420 : 480) : dk ? 1300 : DAY0.ff;
  wxSetup();
  STARS.visible = n && !ir;
  spot.distance = n ? 45 : 14; spot.angle = n ? 0.6 : 0.7;
  // 밤: 게이트·링은 LED 테두리처럼 빛나게
  const glow = n && !ir; if (FLANE) FLANE.gateM.emissive.set(glow ? 0x803000 : 0x000000); RACE.forEach(r => r.mesh.material.emissive.set(glow ? 0x664400 : 0x332200));
  groundMat.emissive.set(ir ? (n ? 0x262626 : 0x484848) : 0x000000);
  renderer.domElement.style.filter = ir ? 'grayscale(1) contrast(1.12) brightness(1.04) blur(0.35px)' + (ENV.irBH ? ' invert(1)' : '') : '';   // 열상 카메라: 해상도가 낮아 조금 흐림 · 흑색 고온은 반전
  if ($('irTag')) { $('irTag').classList.toggle('hidden', !ir); $('irTag').textContent = 'IR · ' + (ENV.irBH ? 'BLACK-HOT' : 'WHITE-HOT'); }
  irGrain(ir);
}
// 열화상: 재질을 열 세기(회색)로 바꿈. 사진 바닥은 그대로 (흑백이 되면 맨땅=밝고 숲=어두움)
const IR_MAT = new Map(), IR_ORIG = new Map();
function irMat(m, heat, ib) {
  const k = m.uuid + ':' + heat + ':' + ENV.night + ':' + ib; if (IR_MAT.has(k)) return IR_MAT.get(k);
  // 열화상은 빛이 아니라 '스스로 내는 열'로 보임: 밝기 = 물체 온도(자체 발광) + 해가 데운 면 약간(낮) · 조명(드론 등·밤)에는 거의 안 바뀜
  const c = m.color ? m.color : new THREE.Color(0.5, 0.5, 0.5), l = (0.3 * c.r + 0.59 * c.g + 0.11 * c.b);
  //  (값은 선형 · 톤매핑 전: 0.1 ≈ 화면 35%, 0.2 ≈ 53%, 0.8 ≈ 86%)
  const env = ib !== undefined ? ib : clamp(0.28 + l * 0.3, 0.2, 0.55), e = (ENV.night ? 0.05 + env * 0.38 : 0.045 + env * 0.42) + heat * 1.2, sh = ENV.night ? 0.03 : 0.1;
  const nm = new THREE.MeshLambertMaterial({ color: new THREE.Color(sh, sh, sh), emissive: new THREE.Color(e, e, e), vertexColors: !!m.vertexColors, side: m.side, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite });
  IR_MAT.set(k, nm); return nm;
}
// 땅(사진 바닥): 사진 밝기를 지표 온도처럼 — 낮엔 맨땅·길이 뜨겁고 숲이 시원(대비 큼), 밤엔 대비가 줄고 전체가 중간 회색
const IR_GND = new Map();
function irGround(m) {
  const k = m.uuid + ':' + !!ENV.night; if (IR_GND.has(k)) return IR_GND.get(k);
  const base = ENV.night ? 0.07 : 0.05, gain = ENV.night ? 0.25 : 0.6, nm = new THREE.MeshBasicMaterial({ map: m.map, vertexColors: false, fog: true });
  nm.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    { float lu = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = vec3(${base.toFixed(3)} + lu * ${gain.toFixed(3)}); }`); };
  nm.toneMapped = true;
  nm.customProgramCacheKey = () => 'irg' + base; IR_GND.set(k, nm); return nm;
}
// 백색 고온(WHITE-HOT) → 흑색 고온(BLACK-HOT) → 끔 (T · IR 버튼)
function irCycle() { if (!ENV.ir) { ENV.irBH = false; irSet(true); } else if (!ENV.irBH) { ENV.irBH = true; envApply(); showMsg('THERMAL · ' + L2('흑색=고온', 'BLACK-HOT'), '#ffffff', 1); } else { ENV.irBH = false; irSet(false); } }
function irSet(on) {
  const was = ENV.ir; ENV.ir = on; envApply(); if (was === on) return;
  scene.traverse(o => {
    if (!o.isMesh || o === sky) return;
    if (o.userData.irOnly) { o.visible = on; return; }
    if (on) {
      const m = o.material; if (m && (m === groundMat || (m.userData && m.userData.terrain))) { IR_ORIG.set(o, m); o.material = irGround(m); return; }
      if (Array.isArray(m) || !m || m.isMeshBasicMaterial || m.isShaderMaterial || m.map) return;
      IR_ORIG.set(o, m); o.material = irMat(m, o.userData.heat || 0, o.userData.irBase);
    } else if (IR_ORIG.has(o)) o.material = IR_ORIG.get(o);
  });
  if (!on) IR_ORIG.clear();
  try { TREES3.setIR(on, ENV.night); } catch (e) { }   // 고급 나무 (잎 그림 재질은 위에서 건너뜀)
  showMsg(on ? 'THERMAL · 백색=고온' : 'VISIBLE', on ? '#ffffff' : '#9ad7ff', 1);
}
// 산불 불씨: 숲 속 5곳. 가시광으로는 연기만(또는 안 보임), 열화상으로는 밝게
const FIRE = (function () {
  if (!PATHL || !SITE.trees) return [];
  const r = rng(2026), L = [];
  const smokeM = new THREE.MeshLambertMaterial({ color: 0xc4c0b8, transparent: true, opacity: 0.3, depthWrite: false, fog: false });
  const hotM = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), plumeM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
  const emberM = new THREE.MeshBasicMaterial({ color: 0xff7a22, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  const scorchM = new THREE.MeshBasicMaterial({ color: 0x14100c, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const flameM = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const flameM2 = new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const sparkM = new THREE.PointsMaterial({ color: 0xffa040, size: 0.35, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const FL_GEO = new THREE.ConeGeometry(1, 1, 7, 1, true).translate(0, 0.5, 0);
  for (let i = 0; i < 8; i++) {
    let q, d, s, tries = 0;
    do { q = PATHL.at(60 + r() * (PATHL.total - 100)); const off = (r() < 0.5 ? -1 : 1) * (45 + r() * 90); d = q.d - q.ts * off; s = q.s + q.td * off; tries++; }
    while (tries < 30 && (L.some(f => Math.hypot(f.d - d, f.s - s) < 70) || (FLANE && FLANE.clear.some(p => Math.hypot(p[0] - d, p[1] - s) < 10))));
    const c = W(d, s, 0), g = new THREE.Group(); g.position.copy(c); MSG.fire.add(g);
    const hot = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), hotM); hot.rotation.x = -Math.PI / 2; hot.position.y = 0.25; hot.userData.irOnly = true; hot.visible = false; g.add(hot);
    const pl = new THREE.Mesh(UCYL, plumeM); pl.scale.set(1.4, 16, 1.4); pl.position.y = 8; pl.userData.irOnly = true; pl.visible = false; g.add(pl);
    const em = new THREE.Mesh(USPH, emberM); em.scale.set(0.9, 0.35, 0.9); em.position.y = 0.3; g.add(em);
    // 발화점: 그을린 땅 + 일렁이는 불꽃 (숲 바닥에서 나무 높이까지) + 튀어 오르는 불티
    const sc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24), scorchM); sc.rotation.x = -Math.PI / 2; sc.position.y = 0.12; sc.renderOrder = 1; g.add(sc);
    const flames = []; for (let k = 0; k < 9; k++) { const fl = new THREE.Mesh(FL_GEO, k % 3 ? flameM : flameM2); const a = r() * 6.283, rr = k < 3 ? r() * 1.2 : 1 + r() * 2.8; fl.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); fl.userData.h = k < 3 ? 9 + r() * 6 : 3 + r() * 4; fl.userData.w = k < 3 ? 1.1 + r() * 0.7 : 0.6 + r() * 0.6; /* 가운데 3개는 나무 위로 솟는 불길 */ fl.userData.ph = r() * 6; g.add(fl); flames.push(fl); }
    const sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3)), sparkM); sparks.userData.s = Array.from({ length: 40 }, () => [r() * 6.283, r(), r()]); sparks.frustumCulled = false; g.add(sparks);
    const puffs = []; for (let k = 0; k < 14; k++) { const p = new THREE.Mesh(USPH, smokeM.clone()); p.userData.ph = k / 14; p.userData.j = r(); g.add(p); puffs.push(p); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff8a30, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.scale.set(9, 6, 1); glow.position.y = 2; glow.visible = false; g.add(glow);
    // 신고 지점: 실제 위치에서 조금 떨어진 곳 (수색 구역 반경 50 m)
    const ang = r() * 6.283, dist = 15 + r() * 25, area = W(d + Math.cos(ang) * dist, s + Math.sin(ang) * dist, 30);
    L.push({ kind: 'ms', t: 'fire', label: `불씨 ${i + 1} · 수색 구역 반경 50 m`, d, s, tp: c.clone().add(new V3(0, 0.6, 0)), mk: area, need: 1.2, g, em, puffs, glow, flames, sparks, sc, search: { r: 110 },
      pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y))]; } });
  }
  return L;
})();
function to5186(d, s) { try { const en = SITE_X.toEN(d, s); return projector(SITE.crs, 'EPSG:5186')(en); } catch (e) { return null; } }
function fireCheck(o, cur, dt) {
  const inView = sensorSees(o.tp, cur, (AFc().reconD || 260) * 0.8);
  o.inView = inView && ENV.ir; o.seenVis = inView && !ENV.ir;
  if (o.inView) { S.recT += dt; if (S.recT >= o.need) { const xy = to5186(o.d, o.s); flashPhoto(); msNext(xy ? `불씨 보고 ✓ X ${xy[0].toFixed(0)} · Y ${xy[1].toFixed(0)}` : '불씨 보고 ✓', '#ffb070'); S.fireRep = (S.fireRep || []).concat([xy]); } }
  else S.recT = Math.max(0, S.recT - dt * 0.4);
}
let envT = 0;
function envTick(dt) {
  envT += dt;
  if (!MSG.fire.visible) return;
  for (const f of FIRE) {
    if (!f.on || !f.active) continue;
    f.em.material.opacity = 0.55 + 0.35 * Math.sin(envT * 9 + f.d) * Math.sin(envT * 5.3);
    f.em.visible = !ENV.ir && (ENV.night || true);
    if (f.flames) { const wv0 = windAt(f.g.position), lx = clamp(wv0.x * 0.06, -0.35, 0.35), lz = clamp(wv0.z * 0.06, -0.35, 0.35);
      for (const fl of f.flames) { const u = fl.userData, fk = 0.75 + 0.25 * Math.sin(envT * 11 + u.ph) * Math.sin(envT * 6.3 + u.ph * 2); fl.visible = !ENV.ir; fl.scale.set(u.w * (0.85 + 0.2 * fk), u.h * fk, u.w * (0.85 + 0.2 * fk)); fl.rotation.set(lz, u.ph, -lx); }
      const a = f.sparks.geometry.attributes.position.array, ss = f.sparks.userData.s; f.sparks.visible = !ENV.ir;
      for (let k = 0; k < ss.length; k++) { const q = ss[k], t = (envT * (0.35 + q[1] * 0.3) + q[2]) % 1; a[k * 3] = Math.cos(q[0] + t * 3) * (0.5 + t * 2) + wv0.x * t * 1.2; a[k * 3 + 1] = 1 + t * 14; a[k * 3 + 2] = Math.sin(q[0] + t * 3) * (0.5 + t * 2) + wv0.z * t * 1.2; }
      f.sparks.geometry.attributes.position.needsUpdate = true; f.sparks.material.opacity = 0.9; }
    // 연기 기둥: 바람 쪽으로 기울며 60 m 가까이 올라감 (멀리서도 보이는 단서)
    const wv = windAt(f.g.position.clone().setY(f.g.position.y + 30)), wl = Math.hypot(wv.x, wv.z), wx = wl > 0.1 ? wv.x / wl : 0.6, wz = wl > 0.1 ? wv.z / wl : 0.3, lean = 10 + wl * 5, big = f.spread ? 1.5 : 1;
    for (const p of f.puffs) { const u = (envT * 0.07 + p.userData.ph) % 1, j = p.userData.j; p.position.set(wx * lean * Math.pow(u, 1.4) * 2.2 + Math.sin(u * 7 + f.s + j * 6) * 2 * u, 1 + u * 58 * big, wz * lean * Math.pow(u, 1.4) * 2.2 + Math.cos(u * 5 + j * 6) * 2 * u); const k = (2 + u * 11) * big; p.scale.set(k, k * 0.85, k); p.material.opacity = (f.done ? 0.6 : 0.8) * Math.min(1, u * 5) * Math.pow(1 - u, 0.8) + 0.05; p.material.color.setHex(f.done ? 0x5f5b55 : 0xf6f4ef); p.visible = !ENV.ir && !ENV.night; }   // 새 신고 = 흰 연기 · 보고 끝 = 회색 연기
    if (f.glow) { f.glow.visible = ENV.night && !ENV.ir; f.glow.material.opacity = 0.55 + 0.35 * Math.sin(envT * 7 + f.d); f.glow.scale.set(9 * big, 6 * big, 1); }
  }
}
// ---- 날씨: 비(빗줄기)·눈(눈송이) 입자 · 드론 주변 상자 안에서만 내리고 따라다님 ----
const WX = { g: null, rain: null, snow: null, N: 2600, B: 46, H: 34 };
function wxSetup() {
  const wx = ENV.wx || 'clear';
  if (!WX.g) { WX.g = new THREE.Group(); WX.g.frustumCulled = false; scene.add(WX.g); }
  if (wx === 'rain' && !WX.rain) { const N = WX.N, pos = new Float32Array(N * 6); for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * WX.B, y = Math.random() * WX.H - WX.H / 2, z = (Math.random() - 0.5) * WX.B; pos.set([x, y, z, x, y - 0.7, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); WX.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c4d0, transparent: true, opacity: 0.45, depthWrite: false })); WX.rain.frustumCulled = false; WX.g.add(WX.rain); }
  if (wx === 'snow' && !WX.snow) { const N = WX.N, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) pos.set([(Math.random() - 0.5) * WX.B, Math.random() * WX.H - WX.H / 2, (Math.random() - 0.5) * WX.B], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); WX.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false })); WX.snow.frustumCulled = false; WX.g.add(WX.snow); }
  if (WX.rain) WX.rain.visible = wx === 'rain' && !ENV.ir; if (WX.snow) WX.snow.visible = wx === 'snow' && !ENV.ir;
}
// ---- 눈 쌓임: 위를 향한 면(땅·나무 윗면·지붕)을 하얗게 (쉐이더에 덧칠) ----
const SNOW_U = { value: 0 }, SNOW = { patched: false, k: 0 };
function snowify(m) {
  if (!m || m.userData.snowy || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial)) return; m.userData.snowy = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uSnow = SNOW_U;
    sh.vertexShader = 'varying float vSnowN;\n' + sh.vertexShader.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n  { vec3 snN = objectNormal;\n  #ifdef USE_INSTANCING\n  snN = mat3(instanceMatrix) * snN;\n  #endif\n  vSnowN = normalize(mat3(modelMatrix) * snN).y; }');
    sh.fragmentShader = 'uniform float uSnow; varying float vSnowN;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.83, 0.87), uSnow * smoothstep(0.45, 0.92, vSnowN));'); };
  const ck = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => ''; m.customProgramCacheKey = () => ck() + '|snow'; m.needsUpdate = true;
}
function snowPatch() {   // 처음 눈이 올 때 한 번: 장면의 지형·나무·건물 재질에 덧칠 (드론·하늘 제외)
  if (SNOW.patched) return; SNOW.patched = true;
  const skip = new Set(); [droneM && droneM.g, ghostM && ghostM.g, sky].forEach(o => o && o.traverse(c => skip.add(c)));
  scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && !skip.has(o) && o !== GRASS) (Array.isArray(o.material) ? o.material : [o.material]).forEach(snowify); });
}
function wxTick(dt) {
  // 눈: 몇 초에 걸쳐 쌓이고, 그치면 서서히 녹음 · 풀은 눈 속에 묻힘
  { const want = (ENV.wx === 'snow' && !ENV.ir) ? 1 : 0; if (want && !SNOW.patched) snowPatch(); SNOW.k += clamp(want - SNOW.k, -dt / 6, dt / 6); SNOW_U.value = SNOW.k * 0.85; if (typeof GRASS !== 'undefined' && GRASS) GRASS.visible = SNOW.k < 0.5; }
  if (!WX.g || (ENV.wx || 'clear') === 'clear') return;
  // 입자는 땅에 고정: 묶음은 드론을 따라가되, 드론이 움직인 만큼 입자를 반대로 옮김 -> 날아가면 비·눈이 스쳐 지나감
  const c = (S.state === 'replay' && RP.pose) ? RP.pose.p : DR.p;
  if (!WX.last) WX.last = c.clone();
  const dx = c.x - WX.last.x, dy = c.y - WX.last.y, dz = c.z - WX.last.z, jump = dx * dx + dy * dy + dz * dz > 400;   // 20 m 넘게 순간 이동(재시작 등)이면 그대로 둠
  if (!WX.vel) WX.vel = new V3();
  if (!jump && dt > 0) WX.vel.lerp(new V3(dx / dt, dy / dt, dz / dt), 1 - Math.exp(-dt * 12)); else WX.vel.set(0, 0, 0);
  WX.last.copy(c); WX.g.position.set(c.x, c.y, c.z);
  const mx = jump ? 0 : dx, my = jump ? 0 : dy, mz = jump ? 0 : dz;
  const wv = windAt(c), B = WX.B, H = WX.H, half = B / 2, hh = H / 2, t = performance.now() / 1000, dv = WX.vel;
  const wrap = (a, i) => { if (a[i] < -half) a[i] += B; else if (a[i] > half) a[i] -= B; };
  const wrapY = (a, i) => { if (a[i] < -hh) a[i] += H; else if (a[i] > hh) a[i] -= H; };
  if (WX.rain && WX.rain.visible) { const a = WX.rain.geometry.attributes.position.array, EXP = 0.045;
    for (let i = 0, j = 0; i < a.length; i += 6, j++) {
      const fall = 7.5 + (j % 9) * 0.25;   // 빗방울 낙하 속도 7.5~9.5 m/s
      a[i] += wv.x * dt - mx; a[i + 1] += -fall * dt - my; a[i + 2] += wv.z * dt - mz; wrap(a, i); wrapY(a, i + 1); wrap(a, i + 2);
      // 줄기 = 카메라가 본 상대 속도 × 노출 시간 (호버링: 수직 짧게, 전진: 앞에서 날아오듯 기울고 길게)
      let rx = wv.x - dv.x, ry = -fall - dv.y, rz = wv.z - dv.z; const L = Math.hypot(rx, ry, rz) * EXP, k = L > 2.2 ? 2.2 / L : 1;
      a[i + 3] = a[i] - rx * EXP * k; a[i + 4] = a[i + 1] - ry * EXP * k; a[i + 5] = a[i + 2] - rz * EXP * k;
    }
    WX.rain.geometry.attributes.position.needsUpdate = true; }
  if (WX.snow && WX.snow.visible) { const a = WX.snow.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { const k = i * 0.37; a[i] += (wv.x * 0.6 + Math.sin(t * 0.9 + k) * 0.5) * dt - mx; a[i + 2] += (wv.z * 0.6 + Math.cos(t * 0.7 + k) * 0.5) * dt - mz; a[i + 1] -= 1.1 * dt + my; wrapY(a, i + 1); wrap(a, i); wrap(a, i + 2); }
    WX.snow.geometry.attributes.position.needsUpdate = true; }
}
function setTod(v) { SET.tod = v; SET.night = v === 'night'; ENV.night = SET.night; ENV.dusk = v === 'dusk'; saveSet(); if (ENV.ir) irSet(false); envApply(); syncTime(); }
function setWxFx(on) { SET.wxFx = !!on; saveSet(); syncTime(); if (S.state === 'run') showMsg(on ? L2('기상 영향 켬 · 돌풍·시야 감소', 'Weather effects on · gusts, reduced visibility') : L2('기상 영향 끔', 'Weather effects off'), '#4fe3ff', 1.2); }
document.querySelectorAll('#segWxFx button').forEach(b => b.addEventListener('click', () => setWxFx(b.dataset.v === '1')));
function setWx(v) {
  if (v !== 'clear' && S.kind === 'fire' && (S.state === 'run' || S.state === 'pause')) { showMsg(L2('산불 감시 중에는 비·눈을 고를 수 없습니다', 'No rain or snow during a wildfire watch'), '#ff9a40', 1.6); syncTime(); return; }
  SET.wx = v; ENV.wx = v; saveSet(); envApply(); syncTime(); if (S.state === 'menu' && typeof menuSel === 'function' && MENU.ms) menuSel(MENU.ms);
}
document.querySelectorAll('#segWx button, #segWx2 button').forEach(b => b.addEventListener('click', () => setWx(b.dataset.v)));
document.querySelectorAll('#segTime button, #segTime2 button').forEach(b => b.addEventListener('click', () => setTod(b.dataset.v === '1' ? 'night' : b.dataset.v === '2' ? 'dusk' : 'day')));
document.querySelectorAll('#segNone').forEach(b => b.addEventListener('click', () => { SET.night = b.dataset.v === '1'; ENV.night = SET.night; saveSet(); envApply(); if (ENV.ir) { irSet(false); } syncTime(); }));
function syncExpo() { document.querySelectorAll('#segExpo button').forEach(x => x.classList.toggle('on', x.dataset.v === stickExpo(false))); }
document.querySelectorAll('#segExpo button').forEach(b => b.addEventListener('click', () => { SET.expo = b.dataset.v; saveSet(); syncExpo(); }));
syncExpo();
function syncHud() { document.querySelectorAll('#segHud button').forEach(x => x.classList.toggle('on', x.dataset.v === (SET.hud || 'auto'))); }
document.querySelectorAll('#segHud button').forEach(b => b.addEventListener('click', () => { SET.hud = b.dataset.v; saveSet(); syncHud(); }));
syncHud();
function syncTime() { const tv = SET.tod === 'night' ? '1' : SET.tod === 'dusk' ? '2' : '0'; document.querySelectorAll('#segTime button, #segTime2 button').forEach(x => x.classList.toggle('on', x.dataset.v === tv)); document.querySelectorAll('#segWx button, #segWx2 button').forEach(x => x.classList.toggle('on', x.dataset.v === (SET.wx || 'clear'))); document.querySelectorAll('#segWxFx button').forEach(x => x.classList.toggle('on', (x.dataset.v === '1') === !!SET.wxFx)); }
envApply(); syncTime();


// =====================================================================
//  바람 · 수색구조 · 차량 추적 · 능선 종주
// =====================================================================
// 바람: 서북서에서 불어옴. 높이(로그 분포)·능선 노출·돌풍 반영
const WIND = { lv: SET.wind || 0, dir: new V3(Math.sin(112 * DEG), 0, -Math.cos(112 * DEG)), t: 0 };
const _wv = new V3();
function wxFxOn() { return !!SET.wxFx && (ENV.wx === 'rain' || ENV.wx === 'snow'); }
// 기상 영향(옵션): 비·눈이면 바람이 없어도 돌풍이 불고, 가끔 강한 돌풍이 지나감 · 눈·카메라 탐지 거리 줄어듦
function wxSense() { return !wxFxOn() ? 1 : ENV.wx === 'snow' ? (ENV.ir ? 0.8 : 0.6) : (ENV.ir ? 0.85 : 0.72); }
function windAt(p) {
  const fx = wxFxOn(); if ((!WIND.lv && !fx) || !TER.h) return _wv.set(0, 0, 0);
  const base = Math.max(WIND.lv === 1 ? 3 : WIND.lv === 2 ? 7 : 0, fx ? (ENV.wx === 'snow' ? 3.5 : 2.5) : 0), g0 = terrainAt(p.x, p.z), agl = Math.max(0.5, p.y - g0);
  const prof = clamp(Math.log((agl + 1) / 0.4) / Math.log(40 / 0.4), 0.15, 1.25);
  const m = (terrainAt(p.x + 90, p.z) + terrainAt(p.x - 90, p.z) + terrainAt(p.x, p.z + 90) + terrainAt(p.x, p.z - 90)) / 4;
  const expo = clamp(1 + (g0 - m) / 45, 0.55, 1.6);
  const t = WIND.t, gf = fx ? 1.9 : 1, burst = fx ? Math.max(0, Math.sin(t * 0.13 + 1.7)) ** 12 * 1.4 : 0, gust = 1 + gf * (0.28 * Math.sin(t * 0.9 + p.x * 0.01) * Math.sin(t * 0.37) + 0.12 * Math.sin(t * 2.3 + p.z * 0.02)) + burst;
  const sw = 0.18 * Math.sin(t * 0.21);   // 방향 흔들림
  const c = Math.cos(sw), s = Math.sin(sw), dx = WIND.dir.x * c - WIND.dir.z * s, dz = WIND.dir.x * s + WIND.dir.z * c;
  const k = base * prof * expo * gust; return _wv.set(dx * k, 0, dz * k);
}
function windOsd(p) {
  if ((!WIND.lv && !wxFxOn()) || !TER.h) return '';
  const w = windAt(p), sp = Math.hypot(w.x, w.z), rel = wrapA(Math.atan2(w.x, -w.z) - DR.h);
  return `<div class="x"><b>WIND</b>${sp.toFixed(1)} m/s <span style="display:inline-block;transform:rotate(${(rel / DEG).toFixed(0)}deg)">↑</span></div>`;
}
document.querySelectorAll('#segWind button').forEach(b => b.addEventListener('click', () => { SET.wind = +b.dataset.v; WIND.lv = SET.wind; saveSet(); syncWind(); }));
function syncWind() { document.querySelectorAll('#segWind button').forEach(x => x.classList.toggle('on', +x.dataset.v === (SET.wind || 0))); }
syncWind();

// 코스 좌표 점 목록 -> 2 m 간격 world 경로
function polyWorld(pts, step) {
  const out = []; step = step || 2;
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let t = 0; t < L; t += step) { const u = t / L; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); } }
  out.push(pts[pts.length - 1]); return out;
}
const INB = (d, s) => d > GD0 + 30 && d < GD1 - 30 && s > GS0 + 30 && s < GS1 - 30;

// ---- 수색·구조: 숲 속 소로 근처의 실종자 ----
const SAR = (function () {
  if (!VEC || !VEC.trail || !CRS_C) return null;
  const st = BY.pad_start, r = rng(515); let best = null;
  for (const a of VEC.trail) for (let i = 0; i < a.length; i += 2) {
    const d = a[i], s = a[i + 1], dist = Math.hypot(d - st.down, s - st.side);
    if (dist > 260 && dist < 480 && INB(d, s) && (!best || Math.abs(dist - 380) < Math.abs(best.dist - 380))) best = { d, s, dist };
  }
  if (!best) return null;
  const d = best.d + 7, s = best.s - 5, c = W(d, s, 0);
  const g = new THREE.Group(); g.position.copy(c); MSG.sar = MSG.sar || new THREE.Group(); scene.add(MSG.sar); MSG.sar.visible = false; MSG.sar.add(g);
  // 등산객: 배낭에 기대 반쯤 누운 자세 · 한쪽 팔은 드론이 가까이 오면 흔듦
  const jacket = mat(0xd9541e, { roughness: 0.75 }), pants = mat(0x2d3640, { roughness: 0.9 }), skin = mat(0xc99a7a, { roughness: 0.8 }), boot = mat(0x3a2a1c, { roughness: 0.9 }), cap = mat(0x2a5d8a, { roughness: 0.8 }), packM = mat(0x3d5a3a, { roughness: 0.9 });
  const P = new THREE.Group(); P.rotation.z = 0.22; P.position.y = 0.05; g.add(P);   // 상체를 살짝 세움
  const put = (geo, m, x, y, z, sx, sy, sz, rz, rx) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); if (rz) me.rotation.z = rz; if (rx) me.rotation.x = rx; P.add(me); return me; };
  const torso = put(UCAP, jacket, 0.05, 0.2, 0, 0.17, 0.24, 0.13, Math.PI / 2);
  put(UCAP, jacket, 0.3, 0.24, 0, 0.12, 0.1, 0.18, Math.PI / 2);                 // 어깨
  put(UCYL, skin, 0.47, 0.24, 0, 0.05, 0.08, 0.05, Math.PI / 2);                 // 목
  const head = put(USPH, skin, 0.6, 0.25, 0, 0.11, 0.12, 0.1);
  put(USPH, cap, 0.63, 0.31, 0, 0.115, 0.07, 0.105, -0.5);                       // 모자
  for (const z of [-0.1, 0.1]) { put(UCAP, pants, -0.5, 0.11, z, 0.075, 0.36, 0.075, Math.PI / 2); put(UBOX, boot, -0.95, 0.13, z, 0.12, 0.16, 0.1); }
  put(UCAP, jacket, 0.08, 0.17, 0.2, 0.055, 0.22, 0.055, Math.PI / 2 + 0.3);     // 왼팔 (몸 옆)
  const arm = new THREE.Group(); arm.position.set(0.32, 0.27, -0.2); arm.rotation.z = Math.PI / 2 + 0.2; P.add(arm);
  { const u = new THREE.Mesh(UCAP, jacket); u.scale.set(0.055, 0.2, 0.055); u.position.y = 0.2; arm.add(u); const hnd = new THREE.Mesh(USPH, skin); hnd.scale.setScalar(0.05); hnd.position.y = 0.46; arm.add(hnd); }
  const pack = put(UBOX, packM, 0.38, 0.12, 0, 0.42, 0.32, 0.5);                 // 등 뒤 배낭 (베개처럼)
  put(UBOX, mat(0x6b6f52, { roughness: 0.9 }), 0.38, 0.3, 0, 0.36, 0.06, 0.46);  // 배낭 덮개
  { const pole = put(UCYL, mat(0x8c939a, { roughness: 0.4, metalness: 0.7 }), -0.2, 0.03, 0.55, 0.012, 1.1, 0.012, Math.PI / 2 - 0.15); pole.rotation.y = 0.5; }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.userData.heat = m.material === jacket || m.material === skin ? 0.85 : 0.5; } });
  const ang = r() * 6.283, area = W(d + Math.cos(ang) * 45, s + Math.sin(ang) * 45, 30);
  const pk = new THREE.Group(); { const b = new THREE.Mesh(UBOX, mat(0xe0b020, { roughness: 0.8 })); b.scale.set(0.45, 0.28, 0.32); b.position.y = 0.14; pk.add(b); const s2 = new THREE.Mesh(UBOX, mat(0x2d3640)); s2.scale.set(0.5, 0.05, 0.08); s2.position.y = 0.3; pk.add(s2); } MSG.sar.add(pk);
  const sig = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: false })); sig.scale.set(0.035, 0.035, 1); sig.visible = false; MSG.sar.add(sig);
  return { d, s, c, tp: c.clone().add(new V3(0, 0.3, 0)), area, g, pk, sig, pkP: new V3(), arm, wave: 0 };
})();
// ---- 차량 추적: 실제 도로(수치지형도)를 따라 달리는 차량 ----
const TRACK = (function () {
  if (!VEC || !VEC.road || !CRS_C) return null;
  const segs = VEC.road.map(a => { const p = []; for (let i = 0; i < a.length; i += 2) p.push([a[i], a[i + 1]]); return p; });
  // 가장 긴 도로에서 시작해 끝이 이어지는 도로를 붙임
  const len = p => p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);
  const cand = segs.filter(p => len(p) > 300 && len(p) < 3000).sort((a, b) => len(b) - len(a));
  if (!cand.length) return null;
  let route = cand[0].slice();
  for (let k = 0; k < 3; k++) { const e = route[route.length - 1]; const nx = segs.find(p => p !== cand[0] && Math.hypot(p[0][0] - e[0], p[0][1] - e[1]) < 8); if (!nx) break; route = route.concat(nx.slice(1)); }
  route = route.filter(q => INB(q[0], q[1]));
  if (route.length < 10) return null;
  const P = polyWorld(route, 2).map(q => W(q[0], q[1], 0));
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z));
  const g = new THREE.Group(); MSG.track = MSG.track || new THREE.Group(); scene.add(MSG.track); MSG.track.visible = false; MSG.track.add(g);
  // SUV: 차체·보닛·실내(유리)·범퍼·그릴·바퀴(휠)·사이드미러·루프랙·번호판 · 앞쪽 = -z
  const body = mat(0x6a7783, { roughness: 0.42, metalness: 0.12 }), glass = mat(0x16222c, { roughness: 0.12, metalness: 0.3 }), tire = mat(0x121212, { roughness: 0.92 }),
    trim = mat(0x1b1d20, { roughness: 0.7 }), rim = mat(0x9aa2aa, { roughness: 0.35, metalness: 0.8 }), plate = mat(0xe8e8e0, { roughness: 0.6 });
  const add = (geo, m, x, y, z, sx, sy, sz, rx) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); if (rx) me.rotation.x = rx; me.castShadow = true; g.add(me); return me; };
  add(UBOX, body, 0, 0.78, 0.05, 1.86, 0.62, 4.5);                       // 아래 차체
  add(UBOX, body, 0, 1.0, -1.65, 1.8, 0.2, 1.1, 0.08);                  // 보닛 (살짝 기울게)
  add(UBOX, body, 0, 1.43, 0.45, 1.72, 0.62, 2.55);                     // 실내 상자
  add(UBOX, glass, 0, 1.43, 0.45, 1.74, 0.4, 2.3);                      // 옆 유리 띠
  add(UBOX, glass, 0, 1.38, -0.93, 1.62, 0.04, 0.72, -0.95);            // 앞 유리 (기울임)
  add(UBOX, glass, 0, 1.44, 1.73, 1.6, 0.46, 0.04);                     // 뒤 유리
  add(UBOX, body, 0, 1.76, 0.45, 1.7, 0.05, 2.45);                      // 지붕
  for (const x of [-0.68, 0.68]) add(UBOX, trim, x, 1.83, 0.45, 0.05, 0.06, 2.0);   // 루프랙
  add(UBOX, trim, 0, 0.55, -2.33, 1.92, 0.26, 0.22); add(UBOX, trim, 0, 0.55, 2.33, 1.92, 0.26, 0.22);   // 범퍼
  add(UBOX, trim, 0, 0.84, -2.31, 1.1, 0.26, 0.05);                     // 그릴
  add(UBOX, plate, 0, 0.56, -2.45, 0.52, 0.12, 0.02); add(UBOX, plate, 0, 0.72, 2.31, 0.52, 0.12, 0.02);
  for (const x of [-1.0, 1.0]) add(UBOX, trim, x, 1.25, -0.72, 0.16, 0.12, 0.08);   // 사이드미러
  for (const x of [-0.9, 0.9]) for (const z of [-1.45, 1.45]) {
    add(UBOX, trim, x * 1.02, 0.66, z, 0.06, 0.34, 1.0);                // 휠 아치
    const w = add(UCYL, tire, x, 0.37, z, 0.37, 0.27, 0.37); w.rotation.z = Math.PI / 2;
    const h = add(UCYL, rim, x * 1.06, 0.37, z, 0.22, 0.02, 0.22); h.rotation.z = Math.PI / 2;
  }
  // 등화: 전조등·후미등(브레이크등)은 빛나는 재질 + 밤에는 땅을 비추는 전조등 빛과 빛 줄기
  const headM = new THREE.MeshBasicMaterial({ color: 0x3a3a36, toneMapped: false }), tailM = new THREE.MeshBasicMaterial({ color: 0x3a0c0c, toneMapped: false });
  for (const x of [-0.64, 0.64]) { add(UBOX, headM, x, 0.9, -2.31, 0.42, 0.14, 0.05).castShadow = false; add(UBOX, tailM, x * 1.06, 0.95, 2.31, 0.34, 0.17, 0.05).castShadow = false; }
  add(UBOX, tailM, 0, 1.76, 1.72, 0.5, 0.04, 0.03).castShadow = false;   // 보조 제동등
  const headL = new THREE.SpotLight(0xfff0d0, 0, 75, 0.5, 0.55, 1.3); headL.position.set(0, 0.95, -2.4); headL.target.position.set(0, -0.6, -24); g.add(headL); g.add(headL.target);
  g.traverse(m => { if (m.isMesh && !m.material.isMeshBasicMaterial) m.userData.heat = m.material === tire ? 0.45 : m.material === trim ? 0.42 : 0.35; });
  const lights = { headM, tailM, headL, brk: 0, vPrev: 0 };
  return { P, cum, total: cum[cum.length - 1], g, s: 0, v: 8.5, lt: lights, sus: 0 };
})();
function trackPose(s) {
  const T = TRACK; let i = 1; while (i < T.cum.length - 1 && T.cum[i] < s) i++;
  const u = clamp((s - T.cum[i - 1]) / Math.max(1e-6, T.cum[i] - T.cum[i - 1]), 0, 1), a = T.P[i - 1], b = T.P[i];
  const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u; return { p: new V3(x, groundAt(x, z), z), h: Math.atan2(b.x - a.x, -(b.z - a.z)) };
}
// 차량 등화: 밤·해질녘·비에는 전조등 · 감속·정차 때 브레이크등 (출발 전에는 시동 꺼짐)
function trackLights(dt, running) {
  const T = TRACK, L = T && T.lt; if (!L) return;
  const dark = (ENV.night || ENV.dusk) && !ENV.ir, on = running && (dark || (ENV.wx && ENV.wx !== 'clear'));
  const dec = dt > 0 ? (L.vPrev - T.v) / dt : 0; L.vPrev = T.v;
  const brake = running && (T.v < 0.3 || dec > 0.6); L.brk += ((brake ? 1 : 0) - L.brk) * Math.min(1, dt * 10);
  L.headM.color.setHex(on ? 0xfff6dc : running ? 0x8a8a80 : 0x3a3a36);
  L.tailM.color.setRGB(0.23 + (on ? 0.35 : 0.05) + L.brk * 0.75, 0.04 + L.brk * 0.08, 0.04 + L.brk * 0.06);
  L.headL.intensity = on && dark ? (ENV.night ? 7 : 3.5) : 0;
}
// ---- 능선 종주: DEM 에서 '높은 곳을 따라가는' 최소 비용 경로 (GIS 분석) ----
const RIDGE = (function () {
  if (!TER.h || !CRS_C || !SITE.trees) return null;
  const n = TER.n, st = TER.step, H = TER.h, idx = (ix, iy) => iy * n + ix;
  const cell = (d, s) => [clamp(Math.round((s - GS0) / st), 0, n - 1), clamp(Math.round((GD1 - d) / st), 0, n - 1)];
  const ds = (ix, iy) => [GD1 - iy * st, GS0 + ix * st];
  let mn = 1e9, mx = -1e9, top = 0; const m = 12;
  for (let iy = m; iy < n - m; iy++) for (let ix = m; ix < n - m; ix++) { const h = H[idx(ix, iy)]; mn = Math.min(mn, h); if (h > mx) { mx = h; top = idx(ix, iy); } }
  function path(a, b, avoid) {
    const N = n * n, dist = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), heap = [];
    const push = (k, v) => { heap.push([v, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const L = 2 * i + 1, R = L + 1; let s = i; if (L < heap.length && heap[L][0] < heap[s][0]) s = L; if (R < heap.length && heap[R][0] < heap[s][0]) s = R; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return t; };
    dist[a] = 0; push(a, 0);
    while (heap.length) {
      const [dv, k] = pop(); if (k === b) break; if (dv > dist[k]) continue;
      const ix = k % n, iy = (k / n) | 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue; const jx = ix + ox, jy = iy + oy; if (jx < 2 || jy < 2 || jx >= n - 2 || jy >= n - 2) continue;
        const j = idx(jx, jy), low = (mx - H[j]) / Math.max(1, mx - mn), step = Math.hypot(ox, oy) * st * (1 + 9 * low * low) * (avoid && avoid[j] ? 4 : 1);
        if (dv + step < dist[j]) { dist[j] = dv + step; prev[j] = k; push(j, dist[j]); }
      }
    }
    const out = []; for (let k = b; k >= 0; k = prev[k]) { out.push(k); if (k === a) break; } return out.reverse();
  }
  const sp = BY.pad_start, lp = BY.pad_land, [ax, ay] = cell(sp.down, sp.side), [bx, by] = cell(lp.down, lp.side);
  const up = path(idx(ax, ay), top);
  const avoid = new Uint8Array(n * n); for (const k of up) { const ix = k % n, iy = (k / n) | 0; for (let oy = -10; oy <= 10; oy++) for (let ox = -10; ox <= 10; ox++) { const x = ix + ox, y = iy + oy; if (x >= 0 && y >= 0 && x < n && y < n) avoid[idx(x, y)] = 1; } }
  const down = path(top, idx(bx, by), avoid);
  const all = up.concat(down.slice(1)).map(k => ds(k % n, (k / n) | 0));
  // 70 m 마다 체크포인트
  const cps = []; let acc = 0;
  for (let i = 1; i < all.length; i++) { acc += Math.hypot(all[i][0] - all[i - 1][0], all[i][1] - all[i - 1][1]); const isTop = i === up.length - 1; if ((acc >= 100 && i < all.length - 6) || isTop) { cps.push({ q: { d: all[i][0], s: all[i][1], td: all[Math.min(all.length - 1, i + 1)][0] - all[i - 1][0], ts: all[Math.min(all.length - 1, i + 1)][1] - all[i - 1][1] }, top: isTop }); acc = 0; } }
  cps.forEach(c => { const l = Math.hypot(c.q.td, c.q.ts) || 1; c.q.td /= l; c.q.ts /= l; });
  const g = new THREE.Group(); MSG.ridge = MSG.ridge || new THREE.Group(); scene.add(MSG.ridge); MSG.ridge.visible = false; MSG.ridge.add(g);
  const list = cps.map((c, i) => { const cp = passCP(c.top ? `정상 (해발 ${(mx + SITE.base).toFixed(0)} m)` : '능선 ' + (i + 1), c.q, 0, 15, 15, 4); cp.q = c.q; cp.alt = 15;
    const tor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 40), mat(c.top ? 0xff4d4d : 0x4fe3ff, { emissive: c.top ? 0x330000 : 0x002233, roughness: 0.4 })); g.add(tor); cp.mesh = tor; ringDecor(cp); return cp; });
  const flag = new THREE.Mesh(UBOX, mat(0xff4d4d)); const tw = W(ds(top % n, (top / n) | 0)[0], ds(top % n, (top / n) | 0)[1], 0); flag.position.copy(tw).add(new V3(0, 3, 0)); flag.scale.set(0.08, 6, 0.08); g.add(flag);
  return { list, top: mx + SITE.base, len: all.length * st };
})();
function scenStart(kind, a) {
  ['sar', 'track', 'ridge', 'field'].forEach(k => MSG[k] && (MSG[k].visible = false)); if (STREES.unscorch) STREES.unscorch();
  if (kind === 'sar' && SAR) {
    MSG.sar.visible = true; SAR.kit = null; sarRandom(); smkReset();
    S.kits = 2; SAR.pkFound = false;
    const sr = sarR();
    const L = [{ kind: 'ms', t: 'sarfind', label: L2(`실종자 수색 · 구역 반경 ${sr} m`, `Find the hiker · area radius ${sr} m`), tp: SAR.tp, mk: SAR.area, search: { r: sr }, need: 1.5, pts(p) { return [p.clone(), this.mk.clone().setY(Math.max(p.y, this.mk.y))]; } }];
    if (a.drop) L.push({ kind: 'ms', t: 'sarkit', label: '구조 키트 투하 (5 m 이내)', mk: SAR.c.clone().add(new V3(0, 8, 0)), pts(p) { return [p.clone(), this.mk.clone()]; } });
    L.push(rtbObj(a));
    return L;
  }
  if (kind === 'track' && TRACK) {
    MSG.track.visible = true; TRACK.go = false; S.trT = 0; S.trWin = 0; trackRandom();
    const p0 = trackPose(TRACK.s); TRACK.g.position.copy(p0.p); TRACK.g.rotation.y = -p0.h;
    TRACK.sus = 0; TRACK.susMax = 0; TRACK.warn = false; TRACK.burn = false; TRACK.lt.vPrev = 0; trackLights(0, false);
    const L = [{ kind: 'ms', t: 'track', label: L2('차량 추적 · 들키지 말고 60초 관측', 'Vehicle track · 60 s unseen'), mk: p0.p.clone().add(new V3(0, 12, 0)), need: 60,
      pts(p) { const T = TRACK, vp = trackPose(T.s), st = vp.p.clone().add(new V3(-Math.sin(vp.h) * 70, 45, Math.cos(vp.h) * 70)); st.y = Math.max(st.y, terrainAt(st.x, st.z) + 30); return [p.clone(), st]; } }];   // 안내 경로: 차 뒤 70 m · 위 45 m 관측 자리 (운전자 시야 밖)
    L.push(rtbObj(a));
    return L;
  }
  if (kind === 'field' && RWY) {
    MSG.field = MSG.field || new THREE.Group(); if (!MSG.field.parent) scene.add(MSG.field); MSG.field.clear(); MSG.field.visible = true; S.padErr = [];
    if (a.cls === 'wing') {   // 장주: 이륙 → 상승 → 옆바람 → 바람 따라 → 활주로 착륙 (왼쪽 장주, 40 m)
      const side = -RWY.sg, P = [[RWY.L / 2 + 170, 0, 1, 0], [RWY.L / 2 + 170, side * 200, 0, 1], [-RWY.L / 2 - 170, side * 200, -1, 0], [-RWY.L / 2 - 200, 0, 1, 0]];
      const names = [L2('장주 1 · 상승', 'Pattern 1 · upwind'), L2('장주 2 · 옆바람', 'Pattern 2 · crosswind'), L2('장주 3 · 바람 따라', 'Pattern 3 · downwind'), L2('장주 4 · 최종 접근', 'Pattern 4 · final')];
      const L = P.map(([t, w, dt0, dw], i) => { const q = RWY.at(t, w), dx = RWY.ux * dt0 - RWY.uz * dw * 0, dz = RWY.uz * dt0 + RWY.ux * dw * 0;
        let tx = dt0 ? RWY.ux * dt0 : -RWY.uz * dw, tz = dt0 ? RWY.uz * dt0 : RWY.ux * dw; if (i === 1) { tx = -RWY.uz * side; tz = RWY.ux * side; }
        const cp = passCP(names[i], { d: -q.z, s: q.x, td: -tz, ts: tx }, 0, i === 3 ? 25 : 40, i === 3 ? 25 : 40, 14); cp.c = cp.mk.clone();   // 링 판정은 링 중심 기준
        const tor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 48), mat(0xffc828, { emissive: 0x332200 })); tor.scale.setScalar(14); tor.position.copy(cp.mk); tor.lookAt(cp.mk.clone().add(cp.n)); MSG.field.add(tor); cp.mesh = tor; ringDecor(cp); return cp; });
      L.push(rtbObj(a)); return L;
    }
    const pl = (i, lab) => { const p = RWY.pads[i]; return { kind: 'ms', t: 'padland', label: lab, pad: p, mk: p.clone().setY(p.y + 3), pts(q) { return [q.clone(), this.pad.clone().setY(Math.max(q.y, this.pad.y + 6)), this.pad.clone().setY(this.pad.y + 1)]; } }; };
    const fly = passCP(L2('활주로 상공 통과 · 10 m', 'Fly over the runway · 10 m'), (() => { const q = RWY.at(RWY.L / 2 - 20, 0); return { d: -q.z, s: q.x, td: -RWY.uz, ts: RWY.ux }; })(), 8, 10, 10, 6);
    fly.c = fly.mk.clone();
    { const tor = new THREE.Mesh(new THREE.TorusGeometry(6, 0.18, 8, 40), mat(0x4fe3ff, { emissive: 0x002233 })); tor.position.copy(fly.mk); tor.lookAt(fly.mk.clone().add(fly.n)); MSG.field.add(tor); }
    return [pl(1, L2('H2 패드에 착륙', 'Land on pad H2')), pl(2, L2('H3 패드에 착륙', 'Land on pad H3')), fly, pl(0, L2('H1 패드로 복귀 · 착륙', 'Return to pad H1 · land'))];
  }
  if (kind === 'ridge' && RIDGE) {
    MSG.ridge.visible = true; const k = a.cls === 'wing' ? 2.2 : 1;
    RIDGE.list.forEach(r => { r.ring = 6 * k; const al = clearAlt(r.q.d, r.q.s, a.cls === 'wing' ? 38 : 18, r.ring); r.c = W(r.q.d, r.q.s, al); r.mk = r.c.clone(); r.mesh.position.copy(r.c); r.mesh.scale.setScalar(6 * k); r.mesh.lookAt(r.c.clone().add(r.n)); });
    return RIDGE.list;
  }
  return null;
}
function scenStep(o, cur, dt) {
  if (o.t === 'sarfind') {
    const d = o.tp.distanceTo(cur), vis = sensorSees(o.tp, cur, ENV.ir ? (AFc().reconD || 260) * 0.8 : (ENV.night ? (lightOn() ? 50 : 25) : ENV.dusk ? 70 : 90));
    o.inView = vis; if (vis) o.seenT = S.simT;
  } else if (o.t === 'land') {
    const pad = startPos(); if (DR.landed && Math.hypot(DR.p.x - pad.x, DR.p.z - pad.z) < 2.5) msNext('착륙 ✓', '#5dff9a');
  } else if (o.t === 'track') {
    const T = TRACK, vp = trackPose(T.s);
    if (!T.go && cur.distanceTo(vp.p) < 220) { T.go = true; showMsg('차량 출발 · 추적 시작', '#ffc828', 1.6); comm(`${CS}, target is moving. You have the eye, keep it.`, '표적 차량 이동 시작 · 관측 유지'); }
    const tp = vp.p.clone().add(new V3(0, 1, 0)), dd = cur.distanceTo(tp), see = sensorSees(tp, cur, 320);
    o.close = dd < 25; o.inView = see && !o.close; if (o.inView) o.seenT = S.simT;
    if (T.go) { S.trWin += dt; if (o.inView) S.trT += dt; }
    // 들킴: 운전자 시야(차 앞쪽 ±40°), 가까움, 낮은 고도(프로펠러 소리)일수록 빨리 참 · 안전하면 서서히 내려감
    if (T.go) {
      const fx = Math.sin(vp.h), fz = -Math.cos(vp.h), rx = cur.x - vp.p.x, rz = cur.z - vp.p.z, dh = Math.hypot(rx, rz), hy = cur.y - vp.p.y, front = dh > 1 ? (rx * fx + rz * fz) / dh : 0;
      // 운전자 시야: 앞유리(정면 ±50°, 올려다보는 각 35° 아래, 200 m 안) > 옆 유리(±50~110°, 25° 아래, 100 m 안)
      const el = Math.atan2(Math.max(0, hy), Math.max(1, dh)) / DEG; let r = 0; o.seen = false;
      if (front > 0.64 && el < 35 && dh < 200) { r += 45 * (1 - dh / 200) + 10; o.seen = true; }
      else if (front > -0.34 && el < 25 && dh < 100) { r += 15 * (1 - dh / 100); o.seen = true; }
      if (dd < 60) r += (60 - dd) * 1.5;                       // 가까우면 소리·모습
      if (hy < 35 && dh < 100) r += (35 - Math.max(0, hy)) * 0.8;   // 낮으면 프로펠러 소리
      if (ENV.night) r *= lightOn() ? 1.5 : 0.6;               // 밤: 조명을 켜면 훨씬 잘 보임
      if (ENV.wx === 'rain') r *= 0.75;
      T.sus = clamp(T.sus + (r * 0.55 - 6) * dt, 0, 100); T.susMax = Math.max(T.susMax || 0, T.sus);
      if (!T.warn && T.sus >= 45) { T.warn = true; sfx('bad'); showMsg(L2('노출 주의 · 거리를 벌릴 것', 'Exposure · back off'), '#ff9a40', 1.6); comm(`${CS}, CONTROL. Driver is looking around. Back off and increase your standoff.`, '운전자가 주변을 살핌 · 뒤로 빠져 거리 넓힐 것'); }
      if (T.warn && T.sus < 20) T.warn = false;
      if (T.sus >= 100 && !T.burn) {
        T.burn = true; S.trackOK = false; S.pen += 30; T.base *= 1.7; T.stops = []; T.stopT = 0;
        comm(`${CS}, you have been spotted. Target is evading. Break off and RTB.`, '발각됨 · 표적 도주 · 추적 중단하고 복귀');
        o.done = true; o.miss = true; dbfObj(o.label, false); sfx('bad'); showMsg(L2('발각 · 추적 실패 (-30) · 복귀', 'SPOTTED · track failed (-30) · RTB'), '#ff6060', 2.4);
        MS.idx++; while (MS.list[MS.idx] && MS.list[MS.idx].done) MS.idx++; S.recT = 0; renderList(); if (MS.idx >= MS.list.length) msFinish();
        return;
      }
    }
    o.mk.copy(vp.p).add(new V3(0, 12, 0));
    if (S.trT >= o.need) { S.trackOK = true; comm('Good track, we have what we need. Break off and RTB.', '추적 완료 · 이탈 후 복귀'); msNext(`추적 성공 · ${S.trT.toFixed(0)}초 / ${S.trWin.toFixed(0)}초`, '#5dff9a'); }
    else if (T.s >= (T.endS || T.total) - 1) { S.trackOK = false; msNext(`차량 도착 · 추적 ${S.trT.toFixed(0)}초 (부족)`, '#ff9a40'); }
  }
}
function scenTick(dt) {
  if (typeof c1Tick === 'function') c1Tick(dt);
  if (RWY && RWY.papi && (S.state === 'run' || S.state === 'demo')) papiTick(S.state === 'demo' ? ghostS.p : DR.p);
  photoTick(dt); WIND.t += dt; msEvents(dt); commTick(dt); if (S.kind === 'sar') { sarClues(dt, DR.p); smkTick(dt, DR.p); }
  if (TRACK && MSG.track && MSG.track.visible && TRACK.go && S.state === 'run') {
    TRACK.s = Math.min(TRACK.endS || TRACK.total, TRACK.s + TRACK.v * dt); const vp = trackPose(TRACK.s), ah = trackPose(Math.min(TRACK.total, TRACK.s + 3));
    TRACK.g.position.copy(vp.p); TRACK.g.rotation.y = -vp.h; TRACK.g.rotation.x = Math.atan2(ah.p.y - vp.p.y, 3) * 1;
  }
  if (TRACK && MSG.track && MSG.track.visible) trackLights(S.state === 'pause' ? 0 : dt, !!TRACK.go);
  if (S.kind === 'sar' && SAR) sarWave(dt);
  ringsTick();
}
// 조난자: 드론이 70 m 안에 오면 팔을 들어 흔듦 (발견 뒤에도 계속)
function sarWave(dt) {
  if (!SAR || !SAR.arm || !MSG.sar || !MSG.sar.visible) return;
  const near = S.state === 'run' && DR.p.distanceTo(SAR.c) < 70; SAR.wave += ((near ? 1 : 0) - SAR.wave) * Math.min(1, dt * 2.5);
  const t = performance.now() / 1000, w = SAR.wave;
  SAR.arm.rotation.z = (Math.PI / 2 + 0.2) * (1 - w) + 0.15 * w; SAR.arm.rotation.x = w * Math.sin(t * 7) * 0.55;
}
// 링 통과 방향 표시: 들어갈 면 = 초록 막 · 반대 면 = 빨강 · 링을 꿰뚫는 화살표(»)가 진행 방향으로 흐름 (링 로컬: +Z = 통과 방향)
function chevGeo() { if (chevGeo.g) return chevGeo.g; const g = new THREE.BufferGeometry(), v = [-0.32, 0, -0.12, 0, 0, 0.16, 0, 0, 0.04, -0.32, 0, -0.12, 0, 0, 0.04, -0.32, 0, -0.24, 0.32, 0, -0.12, 0, 0, 0.04, 0, 0, 0.16, 0.32, 0, -0.12, 0.32, 0, -0.24, 0, 0, 0.04];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); return (chevGeo.g = g); }   // 링 만들 때(로드 중) 쓰이므로 함수로
function ringDecor(cp) {
  const m = cp.mesh; if (!m || cp.decor) return; const D = new THREE.Group(); m.add(D); cp.decor = D;
  const ent = new THREE.Mesh(new THREE.CircleGeometry(0.93, 32), new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.16, side: THREE.FrontSide, depthWrite: false })); ent.rotation.y = Math.PI; D.add(ent);
  const bad = new THREE.Mesh(new THREE.CircleGeometry(0.93, 32), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.22, side: THREE.FrontSide, depthWrite: false })); D.add(bad);
  cp.chev = []; for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(chevGeo(), new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); c.scale.setScalar(1.3); D.add(c); cp.chev.push(c); }
}
function ringsTick() {   // 지난 링은 감추고, 지금·다음 링에만 방향 표시
  if (!isMission() || !MS.list) return; const t = S.simT;
  MS.list.forEach((o, i) => { if (!o.mesh) return; o.mesh.visible = !o.done; if (!o.decor) return; const show = !o.done && i <= MS.idx + 1; o.decor.visible = show; if (!show) return;
    const cur = i === MS.idx; o.chev.forEach((c, k) => { const u = ((t * 0.6 + k / o.chev.length) % 1); c.position.set(0, 0, -2.2 + u * 3.2); c.material.opacity = (cur ? 0.95 : 0.45) * Math.sin(u * Math.PI); }); });
}
// 구조 키트가 땅에 닿았을 때
function sarKit(pos) {
  const o = msObj(); if (!o || o.t !== 'sarkit') return false;
  const e = Math.hypot(pos.x - SAR.c.x, pos.z - SAR.c.z); S.kitErr = e;
  if (e <= 5) { comm('Control, Eagle One. Kit away.', '이글 원: 키트 투하 완료', OP); msNext(`키트 전달 ✓ ${e.toFixed(1)} m`, '#5dff9a'); } else if ((S.kits | 0) > 0) { showMsg(`키트 ${e.toFixed(1)} m · 5 m 안으로 다시 (남은 ${S.kits}개)`, '#ff9a40', 1.6); sfx('bad'); } else { S.pen += 30; msSkip(); }
  return true;
}
function scenOsd(o) {
  if (!o) return '';
  if (o.t === 'sarfind' && !o.inView && SMK && SMK.on && !SMK.ok && SMK.seen) return `<div style="color:#ffc828">● ${IS_TOUCH ? L2('연기 · 색 부르기', 'SMOKE · CALL') : L2('연기 · 색 부르기 ', 'SMOKE · CALL COLOUR ') + repKey()}</div>`;
  if (o.t === 'sarfind') return `<div style="color:${o.inView ? '#5dff9a' : '#9aa6ad'}">${o.inView ? '● ' + (IS_TOUCH ? L2('실종자 포착', 'SUBJECT') : L2('실종자 포착 · ', 'SUBJECT · ') + repKey()) : ENV.ir ? 'IR 수색 중' : '숲 아래는 열화상(T)'}</div>`;
  if (o.t === 'track') { const su = Math.round(TRACK.sus || 0), sc = su >= 70 ? '#ff6060' : su >= 40 ? '#ff9a40' : '#5dff9a';
    return `<div style="color:${o.inView ? '#5dff9a' : o.close ? '#ff9a40' : '#9aa6ad'}">TRACK ${S.trT.toFixed(0)}/${o.need}s${o.close ? ' · 너무 가까움' : o.inView ? ' ●' : TRACK.go ? ' · 시야 밖' : ' · 접근하면 출발'}</div>`
      + `<div style="color:${sc}">${L2('노출', 'EXPOSURE')}${o.seen ? L2(' · 운전자 시야', ' · in view') : ''} <span style="display:inline-block;width:70px;height:7px;background:rgba(255,255,255,.15);vertical-align:middle"><i style="display:block;height:100%;width:${su}%;background:${sc}"></i></span> ${su}%</div>`; }
  return '';
}

// 한국어 / English
(function langTog() {
  const cur = window.SIM_LANG === 'en' ? 'en' : 'ko';
  document.querySelectorAll('#langTog button').forEach(b => { b.classList.toggle('on', b.dataset.l === cur);
    b.onclick = () => { if (b.dataset.l === cur) return; try { localStorage.setItem('fpvsim_lang', b.dataset.l); } catch (e) { }
      if (window.SIM_DUAL) location.reload(); else location.href = b.dataset.l === 'en' ? 'en.html' : 'index.html'; }; });
})();

// =====================================================================
//  임무 진행 (매번 달라지는 배치 · 브리핑 · 무전 · 시간에 따른 사건 · 등급)
// =====================================================================
const L2 = (ko, en) => window.SIM_LANG === 'en' ? en : ko;
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function nearOrder(L, p) { const out = [], rest = L.slice(); let c = p; while (rest.length) { let k = 0, bd = 1e9; rest.forEach((o, i) => { const d = Math.hypot(o.tp.x - c.x, o.tp.z - c.z); if (d < bd) { bd = d; k = i; } }); c = rest[k].tp; out.push(rest.splice(k, 1)[0]); } return out; }
function reconPick() {
  const ok = RECON.filter(r => flyL(r.tp) <= FLY_R_SAFE), pool = ok.length >= 4 ? ok : RECON.slice().sort((a, b) => flyL(a.tp) - flyL(b.tp));
  const nR = SET.diff === 'train' ? 3 : SET.diff === 'sport' ? 5 : 4;   // 난이도별 대상 수
  const L = nearOrder(shuffle(pool).slice(0, Math.min(nR, pool.length)), startPos());
  L.forEach((o, i) => { o.label = `정찰 ${i + 1} · 건물 (${o.wl})`; o.done = false; }); return L;
}
// 산불: 후보 8곳 중 5곳, 3곳은 처음부터 · 2곳은 나중에 신고
function firePick() {
  MSG.fire.visible = true; S.fireRep = [];
  FIRE.forEach(f => { f.on = false; f.g.visible = false; f.done = false; f.spread = false; });
  const P = shuffle(FIRE.filter(f => flyL(f.tp) <= FLY_R_SAFE - 60)).slice(0, 4), when = [0, 1e9, 1e9, 1e9];   // 한 곳씩: 보고하면 다음 신고
  P.forEach((f, i) => { f.on = true; f.ignT = when[i] + i * 0.05; f.active = false; f.g.visible = false; f.recT = 0; f.g.scale.setScalar(1);
    for (let t = 0; t < 24; t++) { const ang = Math.random() * 6.283, dist = 35 + Math.random() * 45; f.mk = W(f.d + Math.cos(ang) * dist, f.s + Math.sin(ang) * dist, 30); if (flyL(f.mk) <= FLY_R - 120) break; } f.search = { r: 110 };
    f.label = L2(`연기 신고 ${i + 1} · 수색 구역 반경 110 m`, `Smoke report ${i + 1} · search radius 110 m`); });
  return P;
}
function fireReport(f, xy) {   // 사진으로 보고한 불씨 처리 · 다음 신고는 몇 초 뒤 새로 피어오름
  f.done = true; dbfObj(f.label, true); S.fireRep.push(xy); sfx('good'); commAck(f, 'fire');
  showMsg(xy ? `불씨 사진 보고 ✓ X ${xy[0].toFixed(0)} · Y ${xy[1].toFixed(0)}` : '불씨 사진 보고 ✓', '#ffb070', 1.8);
  const nx = MS.list.find(x => x.t === 'fire' && !x.active && !x.done); if (nx) nx.ignT = MS.t0 + 5 + Math.random() * 6;   // 불씨만 (마지막 활주로 복귀 항목 제외)
  MS.idx = MS.list.findIndex(x => !x.done); if (MS.idx < 0) { MS.idx = MS.list.length; msFinish(); } renderList();
}
// 불꽃이 눈(주간 카메라)으로 보이는 거리: 밤엔 불빛이라 더 멀리 · 줌 카메라 기체는 더 멀리 (열화상은 센서 거리의 0.8 — 늘 더 멂)
function fireEyeR() { return (ENV.night ? 230 : ENV.dusk ? 190 : 160) * clamp((AFc().reconD || 260) / 260, 1, 1.5); }
function fireStep(cur, dt) {
  const irR = (AFc().reconD || 260) * 0.8, eyeR = fireEyeR();
  for (const f of MS.list) {
    if (f.done || !f.active) continue;
    const ir = ENV.ir && sensorSees(f.tp, cur, irR), eye = !ENV.ir && sensorSees(f.tp, cur, eyeR);
    f.inView = ir || eye; f.via = ir ? 'ir' : eye ? 'eye' : f.via; if (f.inView) f.seenT = S.simT;
    f.seenVis = !f.inView && !ENV.ir && sensorSees(f.tp, cur, irR);   // 연기만 보이는 거리: 더 가까이 가거나 열화상
  }
  const o = msObj(); if (o) S.recT = o.recT || 0;
}
// 타격: 차량 5대 중 실물 3대(엔진 열) · 기만체 2대(차가움)
function strikeLabel() { const n = STRIKE.filter(t => !t.decoy).length; return L2(`실물 표적 타격 ${S.hitsS || 0}/${n} · 기만체 ${STRIKE.length - n}대 섞임`, `Hit real targets ${S.hitsS || 0}/${n} · ${STRIKE.length - n} decoys mixed in`); }
function strikePick() {
  MSG.strike.visible = true; S.hitsS = 0;
  const roles = shuffle([0, 0, 0, 1, 1]);
  STRIKE.forEach((t, i) => { t.decoy = !!roles[i]; t.dead = false; t.col.off = false; if (!t.hull.userData.m0) t.hull.userData.m0 = t.hull.material; t.hull.material = t.hull.userData.m0; t.parts.forEach(p => p.userData.heat = t.decoy ? 0.0 : 0.5); });
  return [{ kind: 'ms', t: 'strikeAll', label: strikeLabel(), mk: STRIKE[0].mk.clone(), pts(p) { return [p.clone(), this.mk.clone()]; } }];
}
function strikeAim(o, cur) { let b = null, bd = 1e9; for (const t of STRIKE) { if (t.dead) continue; const d = t.c.distanceTo(cur); if (d < bd) { bd = d; b = t; } } if (b) o.mk.copy(b.c); }
// 기준 시간 · 등급
function msPar(kind, L) {
  if (kind === 'class1' || kind === 'class1x' || kind === 'class1d') return 900;
  const a = AFc(), v = a.cls === 'wing' ? a.cruise : Math.min(a.top, 12);
  if (kind === 'forest') return (FLANE ? FLANE.total : 400) / Math.min(v, 6) + 15;
  if (kind === 'race') return (PATHL ? PATHL.total : 500) / (v * 0.85) + 10;
  if (kind === 'ridge') return (RIDGE ? RIDGE.len : 900) / (v * 0.8) + 20;
  if (kind === 'field') return AFc().cls === 'wing' ? 150 : 90;
  if (kind === 'recon') return 60 + L.length * 45;
  if (kind === 'fire') return 260;
  if (kind === 'strike') return 150;
  if (kind === 'sar') return 220;
  if (kind === 'track') return 150;
  return 180;
}
function msGrade(total) {
  if (S.kind === 'track') return S.trackOK ? { g: S.trT / Math.max(1, S.trWin) > 0.8 && (TRACK.susMax || 0) < 45 ? 'S' : 'A', c: '#5dff9a' } : { g: TRACK.burn ? 'D' : 'C', c: '#ff6060' };
  const r = total / Math.max(1, MS.par || 1);
  return r <= 1 ? { g: 'S', c: '#ffc828' } : r <= 1.3 ? { g: 'A', c: '#5dff9a' } : r <= 1.7 ? { g: 'B', c: '#4fe3ff' } : { g: 'C', c: '#ff9a40' };
}
// 무전 (화면 아래 가운데, 몇 초 뒤 사라짐)
let radioT = 0;
function radio(text) { const el = $('radio'); if (!el) return; el.innerHTML = '<b>📻</b> ' + text; el.classList.add('show'); radioT = 5; sfx('good'); }
// 브리핑
const BRIEF = window.SIM_LANG === 'en' ? {
  forest: ['Forest trail', 'Follow a narrow trail cut through the forest beside the main route: gates, tight gaps and fallen trunks to the finish.', 'Trees are 2–3 m apart. Stay low, under the canopy (below 3 m AGL).'],
  race: ['Valley time race', 'Fly through the rings along the valley, in order, as fast as you can.', 'Boost (BST) takes you to the airframe top speed. Miss a ring and it is skipped with an 8 s penalty.'],
  recon: ['Building recon', 'Find and photograph 4 random real buildings from the topo map.', 'Hold each building centered on screen or in the belly cam for 1.5 s. Targets change every run.'],
  strike: ['Vehicle strike', '5 vehicles: 3 real, 2 decoys. Hit only the real ones.', 'They look identical in daylight. In thermal (T) the real ones show engine heat. Hitting a decoy costs +20 s.'],
  fire: ['Wildfire watch', 'Smoke reports come in by radio with a bearing and a rough distance. Only a wide search area is marked, not the fire itself.', 'One report at a time: find the smoke column (it leans with the wind; at night look for the glow). Get close enough to see the flames, or use thermal (T) from farther away, keep the fire on screen and press Enter / 📷 / A to photograph it. Report it and the next one comes in. After 150 s a fire spreads (+15 s).'],
  sar: ['Search & rescue', 'A hiker is missing near the trails. Only a wide search area is marked; the location changes every run.', 'Clues: his yellow pack near where he went missing, signal-mirror flashes (a flashlight at night), and body heat in thermal under the canopy. Center him and press Enter / 📷 / A to photograph and report. He may pop a signal smoke (a red flare at night): CONTROL never says the colour, so center the smoke and report to call its colour first; a wrong call (e.g. a white field burn) costs +10 s. 2 rescue kits: drop one within 5 m.'],
  track: ['Vehicle tracking', 'Keep a car on a real road in view for 60 s without being spotted.', 'Being in the driver\'s view (ahead, low angle), close or low fills the exposure gauge; when it is full you are spotted (fail, -30, RTB). Stay behind it and high. At night turn your light off (L) to stay hidden.'],
  ridge: ['Ridge run', 'Climb to the summit along a DEM-derived ridge and come down another ridge.', 'Ridges are windy. Pass the rings in order.'],
  field: ['Field airstrip', 'Runway, taxiway and three H pads. Quads hop between the pads with precise landings; fixed wings fly a traffic pattern and land.', 'Land within 1.5 m of the pad centre, gently. Wings: take off, fly the pattern rings, land on the runway.']
} : {
  forest: ['숲 속 좁은 길', '주 경로 옆 숲 속에 낸 좁은 길을 따라 게이트·좁은 틈·쓰러진 나무를 지나 결승까지.', '나무 사이는 2~3 m. 수관 아래(지면 3 m 이하)로 낮게 날 것.'],
  race: ['계곡 타임 레이스', '계곡을 따라 놓인 링을 순서대로 최단 시간에 통과.', '부스트(BST)로 기체 최고 속도까지. 링을 놓치면 다음 링으로 넘어가며 1개당 +8초 벌점.'],
  recon: ['건물 정찰', '수치지형도에 있는 실제 건물 중 무작위 4곳을 찾아 촬영.', '건물을 화면 가운데나 아래 카메라에 1.5초 담기. 매번 대상이 바뀜.'],
  strike: ['차량 표적 타격', '차량 5대 중 실물은 3대, 나머지 2대는 기만체. 실물만 골라 돌입.', '가시광으로는 똑같음. 열화상(T)에서 엔진 열이 있는 차량이 실물. 기만체를 치면 +20초.'],
  fire: ['산불 감시', '무전으로 연기 신고가 방위·대략 거리로 들어옴. 지도에는 넓은 수색 구역만 표시되고 불 위치는 안 나옴.', '한 번에 한 곳씩: 바람에 기우는 연기 기둥(밤에는 불빛)을 찾아가 불꽃이 보일 만큼 가까이 가거나 열화상(T)으로 멀리서 불씨를 화면에 담고 Enter·📷·A 버튼으로 사진 보고. 보고하면 다음 신고가 들어옴. 150초가 지나면 번져서 +15초.'],
  sar: ['실종자 수색·구조', '등산로 근처 실종자 신고. 지도에는 넓은 수색 구역만 표시, 위치는 매번 다름.', '단서: 근처에 떨어진 노란 배낭, 신호 거울 반짝임(밤에는 손전등), 숲 아래 체온(열화상). 찾으면 화면 가운데에 두고 Enter·📷·A 버튼으로 사진 보고. 실종자가 연막(밤엔 붉은 신호탄)을 터뜨리기도 함: 관제는 색을 먼저 말하지 않으니, 연기를 가운데 두고 보고 키로 본 색을 먼저 부를 것 · 다른 연기(흰 소각 연기 등)를 부르면 +10초. 구조 키트 2개 · 5 m 안에 투하.'],
  track: ['차량 추적', '실제 도로를 달리는 차량을 들키지 않고 60초 동안 시야에 유지.', '운전자 시야(차 앞쪽·낮은 각도)·근접·저고도면 노출 게이지가 차고, 가득 차면 발각(실패·-30·복귀). 차 뒤쪽 높이 유지 권장. 밤에는 드론 조명을 끄면(L) 덜 들킴.'],
  ridge: ['능선 종주', 'DEM 분석으로 뽑은 능선을 따라 정상까지 올라갔다가 다른 능선으로 내려옴.', '능선은 바람이 셈. 링을 순서대로 통과.'],
  field: ['야전 착륙장', '활주로·유도로·H 패드 3개. 쿼드는 패드 사이를 옮겨 다니며 정밀 착륙, 고정익은 장주(트래픽 패턴)를 돌고 활주로 착륙.', '패드 가운데 1.5 m 안에 살살 내려앉기. 고정익: 이륙 → 장주 링 → 활주로 착륙.']
};
function briefShow(kind, L) {
  const b = BRIEF[kind], el = $('brief'); if (!b || !el) return;
  const cond = [WIND.lv ? (WIND.lv === 1 ? L2('바람 약 3 m/s', 'Wind 3 m/s') : L2('바람 강 7 m/s', 'Wind 7 m/s')) : L2('바람 없음', 'No wind'), ENV.night ? L2('밤', 'Night') : L2('낮', 'Day'), AFc().name].join(' · ');
  el.innerHTML = `<div class="bc"><div class="bt">BRIEFING</div><h3>${b[0]}</h3><p>${b[1]}</p><p class="bn">${b[2]}</p><div class="bm">${cond} · ${L2('기준 시간', 'Par time')} ${fmt(MS.par)}</div><button class="primary" id="briefGo">${L2('시작', 'Start')}</button></div>`;
  el.classList.remove('hidden'); S.brief = true;
  const go = () => { el.classList.add('hidden'); S.brief = false; commStart(kind); };
  $('briefGo').onclick = go; el.onpointerdown = e => { if (e.target === el) go(); };
  BRIEF_GO = go;
  clearInterval(briefShow.tm); if (MENU.fromPreview && !TEST && !XR_ON) { let n = 4; const b = $('briefGo'), base = b.textContent; b.textContent = `${base} (${n})`; briefShow.tm = setInterval(() => { if (!S.brief || !el || el.classList.contains('hidden')) { clearInterval(briefShow.tm); return; } n--; if (n <= 0) { clearInterval(briefShow.tm); go(); } else b.textContent = `${base} (${n})`; }, 1000); } MENU.fromPreview = false;
}
let BRIEF_GO = null;
// 시간에 따른 사건 (불씨 추가·번짐, 실종자 구역 좁힘, 차량 정차·속도 변화)
function msEvents(dt) {
  if (S.state !== 'run' || S.brief || !isMission()) return;
  MS.t0 += dt; const t = MS.t0; navRadio(dt);
  if (S.kind === 'fire') {
    for (const [i, f] of MS.list.entries()) {
      if (f.t !== 'fire') continue;
      if (!f.active && t >= f.ignT) { f.active = true; f.g.visible = true; if (STREES.scorch) STREES.scorch(f.g.position, 9); const v = vecText(f.mk, 'Smoke sighted, search area', '연기 목격 · 수색 구역 중심'); comm(`${f.ignT > 1 ? 'New report. ' : ''}${v[0]}`, `${f.ignT > 1 ? '새 신고 · ' : ''}${v[1]}`); if (f.ignT > 1) comm('Eagle One, wilco.', '이글 원, 수행하겠음.', OP); renderList(); if (MS.idx >= MS.list.length || MS.list[MS.idx].done) MS.idx = i; }
      if (f.active && !f.done && !f.spread && t - f.ignT > 150) { f.spread = true; S.pen += 15; comm(`${CS}, hotspot ${i + 1} is spreading. Expedite your report.`, `불씨 ${i + 1} 번짐 · +15초`); f.g.scale.setScalar(1.8); }
    }
  }
  if (S.kind === 'sar') {
    const o = msObj();
    if (o && o.t === 'sarfind') {
      if (!MS.h1 && t > 70) { MS.h1 = true; if (o.search.r > 60) { sarNarrow(o, 60, 25 + Math.random() * 10); comm(`${CS}, CONTROL. Witness report, subject within six zero meters of the new marked area. Over.`, '목격 제보 · 수색 구역 반경 60 m로 좁힘'); } }
      if (!MS.h2 && t > 150) { MS.h2 = true; if (o.search.r > 25) { sarNarrow(o, 25, 8 + Math.random() * 6); comm('Phone ping narrows it to two five meters. Look under the canopy, use thermal.', '휴대전화 위치 · 반경 25 m, 열화상으로 수관 아래 확인'); } }
    }
  }
  if (S.kind === 'track' && TRACK && TRACK.go) {
    const T = TRACK; T.tt = (T.tt || 0) + dt;
    if (T.stopT > 0) { T.stopT -= dt; T.v = 0; if (T.stopT <= 0) comm('Target is moving again. Stay on it.', '차량 다시 출발 · 계속 추적'); }
    else { T.v = T.base * (0.8 + 0.35 * Math.sin(T.tt * 0.11 + T.ph)); if (T.stops.length && T.s > T.stops[0]) { T.stops.shift(); T.stopT = 6 + Math.random() * 6; comm('Target has stopped. Hold your standoff, keep eyes on.', '차량 정차 · 거리 유지하며 관측'); } }
  }
}
// 안내 0 (무전): 화면·지도에 목표가 없으므로 CONTROL 이 현 위치 기준 방위·거리를 불러 줌
//  새 목표가 뜰 때(조금 뒤) · 45초마다 · 수색 구역이 좁혀지거나 옮겨질 때 · 구역 안이나 80 m 안(눈으로 보일 거리)에서는 쉼
const NAVR = { key: null, t: 0 };
function navRadio(dt) {
  if (!gOn('radioP') || (typeof isC1 === 'function' && isC1())) { NAVR.key = null; return; }
  const o = msObj(); if (!o || !o.mk || o.done) return;
  const key = MS.idx + ':' + (o.search ? o.search.r + ':' + o.mk.x.toFixed(0) + ':' + o.mk.z.toFixed(0) : '');
  if (MS.t0 < 0.2) NAVR.key = null;   // 새 비행
  if (key !== NAVR.key) { NAVR.key = key; NAVR.t = 2; }
  if (searchIn(o, DR.p)) { NAVR.t = Math.max(NAVR.t, 20); return; }   // 구역 안: 눈·열화상으로 찾기 (나가면 20초 뒤 다시)
  if ((NAVR.t -= dt) > 0 || COMM.sp || COMM.busy > 0 || COMM.q.length) return;   // 명령·확인 무전이 다 나간 뒤 (밀려서 버려지지 않게)
  NAVR.t = 45;
  if (Math.hypot(o.mk.x - DR.p.x, o.mk.z - DR.p.z) < 80) return;
  const v = vecText(o.mk, o.search ? 'Search area' : 'Target', o.search ? '수색 구역 중심' : '목표');
  comm(`${CS}, CONTROL. ${v[0]} Over.`, v[1], null, 'vec');
}
// 실종자·차량 무작위 배치 (scenStart 에서 부름)
const SAR_POOL = (function () {
  if (!SAR) return [];
  const st = BY.pad_start, P = [];
  for (const a of VEC.trail) for (let i = 0; i < a.length; i += 6) { const d = a[i], s = a[i + 1], dist = Math.hypot(d - st.down, s - st.side); if (dist > 220 && dist < 520 && INB(d, s) && flyL(W(d, s, 0)) <= 470 && !P.some(p => Math.hypot(p[0] - d, p[1] - s) < 90)) P.push([d, s]); }
  return P.length ? P : [[SAR.d, SAR.s]];
})();
function sarR() { return SET.diff === 'train' ? 90 : SET.diff === 'sport' ? 150 : 120; }   // 난이도별 수색 구역 반경
function sarRandom() {
  const q = SAR_POOL[Math.floor(Math.random() * SAR_POOL.length)], d = q[0] + (Math.random() - 0.5) * 12, s = q[1] + (Math.random() - 0.5) * 12, c = W(d, s, 0);
  SAR.d = d; SAR.s = s; SAR.c.copy(c); SAR.tp.copy(c).add(new V3(0, 0.3, 0)); SAR.g.position.copy(c); SAR.g.rotation.y = Math.random() * 6.28;
  const sk = sarR() / 120;   // 수색 반경에 비례해 구역 중심을 실종자에게서 띄움 (반경 안에 들어오게)
  for (let t = 0; t < 24; t++) { const ang = Math.random() * 6.283, ad = (55 + Math.random() * 40) * sk; SAR.area.copy(W(d + Math.cos(ang) * ad, s + Math.sin(ang) * ad, 30)); if (flyL(SAR.area) <= FLY_R - 130) break; } MS.h1 = MS.h2 = false;   // 수색 구역이 비행 구역 안에 들어오게
  for (let t = 0; t < 24; t++) { const pa = Math.random() * 6.283, pd = 45 + Math.random() * 25; SAR.pkP.copy(W(d + Math.cos(pa) * pd, s + Math.sin(pa) * pd, 0)); if (flyL(SAR.pkP) <= FLY_R_SAFE) break; } SAR.pk.position.copy(SAR.pkP); SAR.pk.rotation.y = Math.random() * 6.28; SAR.pk.visible = true; SAR.pkFound = false;
  SAR.sig.position.copy(c).add(new V3(0, 0.9, 0)); SAR.sigT = Math.random() * 3;
}
// 실종자 수색 구역을 좁힘 (가운데는 여전히 실제 위치와 조금 어긋나게)
function sarNarrow(o, r, off) { const a = Math.random() * 6.283; o.mk.copy(W(SAR.d + Math.cos(a) * off, SAR.s + Math.sin(a) * off, 30)); o.search.r = r; o.label = L2(`실종자 수색 · 구역 반경 ${r} m`, `Find the hiker · area radius ${r} m`); renderList(); }
// 출발점 기준 방위·거리 (무전용)
function brgFrom(o, p) {   // o 에서 p 까지 방위(진북)·거리 (무전용 낱말 포함)
  if (!o || !p) return { brg: '000', dist: 0, brgW: 'zero zero zero', distW: 'fifty' };
  const dx = p.x - o.x, dz = p.z - o.z, h = Math.atan2(dx, -dz), brg = ((Math.round(((SITE.brg || 0) + h * 180 / Math.PI) / 5) * 5) % 360 + 360) % 360, dist = Math.max(50, Math.round(Math.hypot(dx, dz) / 50) * 50);
  return { brg: String(brg).padStart(3, '0'), dist, brgW: String(brg).padStart(3, '0').split('').map(c => DIG[+c]).join(' '), distW: numWords(dist) };
}
// ---- 무전 위치 요청 (어려운 안내: 불기둥·마름모 없이 방위·무전으로) ----
//  관제가 지금 기체 위치·기수 기준 시계 방향 + 수평 거리 + 참조물(송전선·마을·활주로·출발 패드) + 방위를 불러 줌 · G / 패드 Back / 📍
//  지도·무전 단계에서는 목표가 바뀔 때 자동으로 한 번
const CLK_W = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
let LMK = null;
function lmkList() {
  if (LMK) return LMK; LMK = { pts: [], line: null };
  try { const B = window.__BLD3 && window.__BLD3.LIST; if (B && B.length) { const G = new Map(); for (const b of B) { const k = Math.round(b[0] / 120) + ',' + Math.round(b[1] / 120); G.set(k, (G.get(k) || 0) + 1); } let best = null, bn = 0; for (const [k, n] of G) if (n > bn) { bn = n; best = k; }
    if (bn >= 6) { const [kx, kz] = best.split(',').map(Number); let sx = 0, sz = 0, c = 0; for (const b of B) if (Math.abs(b[0] / 120 - kx) <= 1 && Math.abs(b[1] / 120 - kz) <= 1) { sx += b[0]; sz += b[1]; c++; } LMK.pts.push({ x: sx / c, z: sz / c, r: 160, en: 'the village', ko: '마을' }); } } } catch (e) { }
  try { if (RWY) { const c = RWY.at(0, 0); LMK.pts.push({ x: c.x, z: c.z, r: RWY.L / 2 + 40, en: 'the runway', ko: '활주로' }); } } catch (e) { }
  const sp = startPos(); LMK.pts.push({ x: sp.x, z: sp.z, r: 70, en: 'the launch pad', ko: '출발 패드' });
  const P = window.__POWER; if (P && P.TW && P.TW.length > 1) LMK.line = P.TW.map(t => [t.x, t.z]);
  return LMK;
}
function segX(ax, az, bx, bz, cx, cz, dx, dz) { const d = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx); if (Math.abs(d) < 1e-9) return false; const u = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / d, v = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / d; return u > 0.05 && u < 0.95 && v >= 0 && v <= 1; }
function vecRef(from, to) {   // 참조물 하나: 목표 가까이 → '… 근처' · 가는 길에 송전선 → '송전선 너머' · 가는 길 옆 → '… 지나서'
  const L = lmkList(); let near = null;
  for (const p of L.pts) { const d = Math.hypot(p.x - to.x, p.z - to.z); if (d < p.r && Math.hypot(p.x - from.x, p.z - from.z) > p.r && (!near || d < near.d)) near = { p, d }; }
  if (near) return [` near ${near.p.en}`, ` · ${near.p.ko} 근처`];
  if (L.line) for (let i = 0; i < L.line.length - 1; i++) if (segX(from.x, from.z, to.x, to.z, L.line[i][0], L.line[i][1], L.line[i + 1][0], L.line[i + 1][1])) return [' beyond the power line', ' · 송전선 너머'];
  const vx = to.x - from.x, vz = to.z - from.z, vv = vx * vx + vz * vz || 1;
  for (const p of L.pts) { const u = ((p.x - from.x) * vx + (p.z - from.z) * vz) / vv; if (u < 0.2 || u > 0.85) continue; const qx = from.x + vx * u, qz = from.z + vz * u; if (Math.hypot(p.x - qx, p.z - qz) < 90) return [` past ${p.en}`, ` · ${p.ko} 지나서`]; }
  return ['', ''];
}
// 지금 기체 위치·기수 기준 시계 방향 + 수평 거리 + 방위 (임무 중 모든 위치 무전이 같은 꼴: "two o'clock, 350 meters, bearing 245")
function clkOf(t) { const dx = t.x - DR.p.x, dz = t.z - DR.p.z, rel = Math.atan2(dx, -dz) - DR.h; return ((Math.round(rel / (Math.PI / 6)) % 12) + 12) % 12; }
function vecText(t, nmEn, nmKo, ref) { const b = brgFrom(DR.p, t), clk = clkOf(t), r = ref || ['', '']; return [`${nmEn} at your ${CLK_W[clk]} o'clock, about ${b.distW} meters from your position${r[0]}, bearing ${b.brgW}.`, `${nmKo}: ${clk || 12}시 방향 · 약 ${b.dist} m${r[1]} (방위 ${b.brg}°)`]; }   // 영어는 녹음 조각(tools/voice)으로만 이어 붙일 수 있는 꼴
let VEC_T = -99;
function vecCall(auto) {
  if (S.state !== 'run' || !isMission() || S.brief) return false; if (!auto && S.simT - VEC_T < 3) return false; VEC_T = S.simT;
  const o = msObj(); if (!o || !o.mk) return false;
  const nm = o.search ? ['search area', '수색 구역 중심'] : ['target', '목표'];
  if (!auto) comm('Control, Eagle One. Request vector.', '이글 원: 위치 요청', OP);
  const say = () => {   // 부르는 순간의 위치·기수로 (예전: 요청한 순간의 위치와 1.3초 뒤 기수를 섞어 씀)
    const p = DR.p.clone(), t = o.mk, dx = t.x - p.x, dz = t.z - p.z, dh = Math.hypot(dx, dz);
    if (o.search ? dh < o.search.r * 0.6 : dh < 40) return comm(`${CS}, CONTROL. You are over the ${o.search ? 'search area' : 'target'}.`, `${o.search ? '수색 구역' : '목표'} 위에 있음.`);
    const v = vecText(t, nm[0][0].toUpperCase() + nm[0].slice(1), nm[1], vecRef(p, t)); comm(`${CS}, CONTROL. ${v[0]}`, v[1]);
  };
  if (auto) say(); else setTimeout(say, 1300);
  return true;
}
// ---- 방위 띠 (화면 위 가운데): 지금 기수 방위 · 5° 눈금 · 30° 마다 숫자 · 초보 단계(목표·가이드)에서만 목표 방향 ▼ ----
function hdgTick() {
  let cv = $('hdgTape'); let on = (S.state === 'run' || S.state === 'replay') && !XR_ON && !document.body.classList.contains('nohud') && !(typeof isC1 === 'function' && isC1());
  if (on && ui.hud && ui.hud.classList.contains('hidden')) on = false;
  if (!on) { if (cv) cv.style.display = 'none'; return; }
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'hdgTape'; cv.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(' + (IS_TOUCH ? 60 : 46) + 'px + env(safe-area-inset-top));width:' + (IS_TOUCH ? 220 : 300) + 'px;height:26px;pointer-events:none;z-index:20'; document.body.appendChild(cv); }   // 휴대폰: 다음 과제·상태 줄 아래
  cv.style.display = ''; const dpr = Math.min(2, devicePixelRatio || 1), W = IS_TOUCH ? 220 : 300, H = 26; if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const sb = S.state === 'replay' ? RP.pose : DR, hdg = (((SITE.brg || 0) + sb.h * 180 / Math.PI) % 360 + 360) % 360, ppd = 2.6;   // 1° 당 2.6 px (±57°)
  g.fillStyle = 'rgba(6,10,14,.45)'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(255,255,255,.75)'; g.fillStyle = '#fff'; g.lineWidth = 1; g.font = '600 10px ui-monospace,Menlo,monospace'; g.textAlign = 'center';
  for (let a = Math.ceil((hdg - 60) / 5) * 5; a <= hdg + 60; a += 5) { const x = W / 2 + (a - hdg) * ppd; if (x < 2 || x > W - 2) continue; const n = ((a % 360) + 360) % 360, big = n % 30 === 0;
    g.beginPath(); g.moveTo(x, H - 1); g.lineTo(x, H - (big ? 8 : 4)); g.stroke(); if (big && Math.abs(x - W / 2) > 22) { const lb = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[n] || String(n / 10).padStart(2, '0'); g.fillStyle = /[NESW]/.test(lb) ? '#ffc828' : '#fff'; g.fillText(lb, x, 11); } }
  if (gOn('tape')) { const o = isMission() ? msObj() : curObj(); if (o && o.mk) { const tb = ((((SITE.brg || 0) + Math.atan2(o.mk.x - sb.p.x, -(o.mk.z - sb.p.z)) * 180 / Math.PI) % 360) + 360) % 360; let d = tb - hdg; d = ((d + 540) % 360) - 180;
    const x = W / 2 + Math.max(-57, Math.min(57, d)) * ppd; g.fillStyle = '#5dff9a'; g.beginPath(); g.moveTo(x - 5, H - 9); g.lineTo(x + 5, H - 9); g.lineTo(x, H - 2); g.closePath(); g.fill(); } }
  g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(W / 2 - 18, 0, 36, 14); g.strokeStyle = '#ffc828'; g.strokeRect(W / 2 - 18 + 0.5, 0.5, 35, 13); g.fillStyle = '#ffc828'; g.fillText(String(Math.round(hdg) % 360).padStart(3, '0'), W / 2, 11);
}
function fromLaunch(p) {
  if (!p) return brgFrom(null, null);
  const st = startPos(), dx = p.x - st.x, dz = p.z - st.z, h = Math.atan2(dx, -dz), brg = ((Math.round(((SITE.brg || 0) + h * 180 / Math.PI) / 5) * 5) % 360 + 360) % 360, dist = Math.max(50, Math.round(Math.hypot(dx, dz) / 50) * 50);
  return { brg: String(brg).padStart(3, '0'), dist, brgW: String(brg).padStart(3, '0').split('').map(c => DIG[+c]).join(' '), distW: numWords(dist) };
}
function numWords(n) { if (n >= 1000) return 'one thousand' + (n % 1000 ? ' ' + numWords(n % 1000) : ''); const U = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'], h = Math.floor(n / 100), r = n % 100; return [h ? (h >= 10 ? 'one thousand' : U[h] + ' hundred') : '', r === 50 ? 'fifty' : r ? String(r) : ''].filter(Boolean).join(' '); }
// 실종자 단서: 배낭(가까이 가야 보임) · 신호 거울 반짝임(낮)/손전등(밤)
function sarClues(dt, cur) {
  if (!SAR || !MSG.sar || !MSG.sar.visible) return;
  const o = msObj(), searching = o && o.t === 'sarfind' && S.state === 'run';
  SAR.sigT = (SAR.sigT || 0) + dt; const per = ENV.night ? 1.2 : 3.6, ph = SAR.sigT % per;
  SAR.sig.visible = searching && !ENV.ir && ph < (ENV.night ? 0.25 : 0.14) && cur.distanceTo(SAR.tp) < (ENV.night ? 420 : 260);
  if (SAR.sig.visible) SAR.sig.material.color.setHex(ENV.night ? 0xfff2c0 : 0xffffff);
  if (searching && !SAR.pkFound && SAR.pk.visible && sensorSees(SAR.pkP.clone().setY(SAR.pkP.y + 0.2), cur, 40)) {
    S.pkT = (S.pkT || 0) + dt;
    if (S.pkT > 0.8) { SAR.pkFound = true; flashPhoto(); showMsg(L2('단서 발견 · 실종자 배낭', 'Clue found · the hiker’s pack'), '#ffc828', 1.6); sfx('good');
      if (o.search.r > 35) sarNarrow(o, 35, 10 + Math.random() * 8); comm(`Copy, that's his pack. He can't be far, search within three zero meters.`, '배낭 확인 · 반경 30 m 안을 수색'); }
  } else S.pkT = 0;
}
// ---- 수색·구조 이벤트: 연막 신호 (색 부르기) ----
//  실종자가 드론 소리를 듣고 연막(밤엔 붉은 신호탄)을 터뜨림. 관제는 색을 말하지 않음 — 조종자가 본 색을 먼저 부르고(보고 키), 관제가 맞는지 확인
//  · 지상·관제가 색을 먼저 말하면 근처의 다른 연기(적의 기만·농가 소각 등)와 헷갈리거나 속을 수 있어서 (군 착륙 지점 표시·의무 후송 절차: 'smoke out' → 항공기가 색 판독 → 지상 확인)
//  · 조난 연막은 빨강·주황 (해상 조난 신호 COLREG 부속서 IV: 주황 연기 · 조난 신호탄: 낮엔 주황 연기, 밤엔 붉은 불꽃)
//  · 근처에 흰 연기(농가 소각) 하나: 잘못 부르면 +10초
const SMK = (function () {
  if (!SAR) return null;
  const mk = (col, n) => { const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: 0.6, depthWrite: false, fog: false }), puffs = [];
    for (let k = 0; k < n; k++) { const p = new THREE.Mesh(USPH, m.clone()); p.userData.ph = k / n; p.userData.j = Math.random(); g.add(p); puffs.push(p); } g.visible = false; MSG.sar.add(g); return { g, puffs }; };
  const sig = mk(0xd8352a, 16), dec = mk(0xe9e6df, 14);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3020, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false })); fl.scale.set(6, 6, 1); fl.renderOrder = 5; fl.visible = false; MSG.sar.add(fl);   // 밤: 붉은 신호탄 불빛
  return { sig, dec, fl, arm: false, on: false, ok: false, t: 0, col: 'red', night: false };
})();
const SMK_C = { red: [0xd8352a, '빨강', 'red'], orange: [0xff7a1c, '주황', 'orange'], white: [0xe9e6df, '흰색', 'white'] };
function smkReset() {   // 임무 시작 때: 이번 판에 이벤트가 있을지 · 색 · 흰 연기 자리
  if (!SMK) return; SMK.on = false; SMK.ok = false; SMK.t = 0; SMK.calls = 0; SMK.seen = null; SMK.sig.g.visible = SMK.dec.g.visible = SMK.fl.visible = false;
  SMK.arm = SET.diff === 'train' || Math.random() < 0.7; SMK.night = !!ENV.night; SMK.col = SMK.night ? 'red' : Math.random() < 0.6 ? 'red' : 'orange';
  SMK.sig.puffs.forEach(p => p.material.color.setHex(SMK_C[SMK.col][0]));
  SMK.sig.g.position.copy(SAR.c).add(new V3(1.2, 0, 0.6)); SMK.fl.position.copy(SAR.c).add(new V3(1.2, 1.4, 0.6)); if (STREES && STREES.topAt) SMK.fl.position.y = Math.max(SMK.fl.position.y, STREES.topAt(SAR.c.x, SAR.c.z, 3) + 1);   // 신호탄 불빛은 수관 위로 번져 보이게
  SMK.dec.g.position.copy(SAR.c);
  if (SMK.arm && !SMK.night) for (let t = 0; t < 30; t++) { const a = Math.random() * 6.283, dd = 220 + Math.random() * 120, q = W(SAR.d + Math.cos(a) * dd, SAR.s + Math.sin(a) * dd, 0);
    if (flyL(q) <= FLY_R_SAFE - 40) { SMK.dec.g.position.copy(q); SMK.dec.g.visible = true; break; } }   // 흰 연기(농가 소각)는 처음부터 피어오름
}
function smkPop() {   // 실종자가 연막을 터뜨림 (관제는 색을 말하지 않음)
  SMK.on = true; SMK.t = 0; if (SMK.night) SMK.fl.visible = true; else SMK.sig.g.visible = true;
  comm(`${CS}, CONTROL. We have the subject on the phone. He hears your drone and is ${SMK.night ? 'lighting a flare' : 'popping smoke'} now. Smoke out. Call the colour when you see it.`,
    SMK.night ? '실종자와 통화됨 · 드론 소리 들림 · 신호탄 점화. 보이면 색을 먼저 부를 것.' : '실종자와 통화됨 · 드론 소리 들림 · 연막 터뜨림. 보이면 색을 먼저 부를 것 (관제는 색을 말하지 않음).');
}
function smkTick(dt, cur) {
  if (!SMK || !MSG.sar || !MSG.sar.visible) return;
  const o = msObj(), searching = o && o.t === 'sarfind' && S.state === 'run';
  if (SMK.arm && !SMK.on && searching && MS.t0 > 20 && cur.distanceTo(SAR.c) < 320) smkPop();   // 드론 소리가 들릴 만큼 오면
  if (SMK.on) { SMK.t += dt; if (SMK.t > 90 && !SMK.ok) { SMK.sig.g.visible = SMK.fl.visible = false; } }   // 손 연막은 1분 남짓
  if (SMK.on && SMK.ok && SMK.t > 30) { SMK.sig.g.visible = SMK.fl.visible = false; }
  const anim = (P, h, size) => { const g = P.g; if (!g.visible) return; const wv = windAt(g.position.clone().setY(g.position.y + 15)), wl = Math.hypot(wv.x, wv.z), wx = wl > 0.1 ? wv.x / wl : 0.6, wz = wl > 0.1 ? wv.z / wl : 0.3, lean = 6 + wl * 4;
    for (const p of P.puffs) { const u = (envT * 0.11 + p.userData.ph) % 1, j = p.userData.j; p.position.set(wx * lean * Math.pow(u, 1.3) * 2 + Math.sin(u * 7 + j * 6) * 1.2 * u, 0.6 + u * h, wz * lean * Math.pow(u, 1.3) * 2 + Math.cos(u * 5 + j * 6) * 1.2 * u);
      const k = (0.8 + u * size); p.scale.set(k, k * 0.85, k); p.material.opacity = 0.85 * Math.min(1, u * 6) * Math.pow(1 - u, 0.9) + 0.04; p.visible = !ENV.ir; } };
  anim(SMK.sig, 38, 9); anim(SMK.dec, 40, 9);
  if (SMK.fl.visible) { const f = 0.75 + 0.25 * Math.sin(envT * 23) * Math.sin(envT * 9.1); SMK.fl.material.opacity = f; SMK.fl.scale.setScalar(10 + 6 * f); }
  // 지금 화면 가운데 쪽에 있는 연기 (보고 키로 색을 부를 대상)
  SMK.seen = null; if (!searching || SMK.ok) return; let best = 0.45;
  for (const [P, key] of [[SMK.sig, SMK.col], [SMK.dec, 'white']]) { const vis = SMK.night && P === SMK.sig ? SMK.fl.visible : P.g.visible; if (!vis) continue;
    const c = (SMK.night && P === SMK.sig ? SMK.fl.position : P.g.position).clone().add(new V3(0, SMK.night ? 0 : 10, 0)); if (!sensorSees(c, cur, 900)) continue;
    const sp = toScreen(c), x = Math.abs(sp.x / innerWidth * 2 - 1), y = Math.abs(1 - sp.y / innerHeight * 2), r = Math.hypot(x, y * 0.8); if (r < best) { best = r; SMK.seen = { key, real: P === SMK.sig }; } }
}
function smkCall() {   // 보고 키: 가운데 연기 색을 부름 → 관제 확인
  const c = SMK.seen; if (!c) return false; const C = SMK_C[c.key], o = msObj(); SMK.calls++;
  comm(`Control, Eagle One. I see ${C[2]} ${SMK.night && c.real ? 'flare' : 'smoke'}.`, `이글 원: ${C[1]} ${SMK.night && c.real ? '신호탄' : '연기'} 보임`, OP);
  if (c.real) { SMK.ok = true; SMK.t = Math.min(SMK.t, 5); dbfObj(L2('연막 색 부르기', 'Smoke colour call'), SMK.calls === 1); sfx('good'); showMsg(L2(`${C[1]} 연막 확인 ✓ · 연기 아래를 수색`, `${C[2].toUpperCase()} smoke confirmed ✓ · search under it`), '#5dff9a', 1.8);
    setTimeout(() => comm(`Roger ${C[2]}, that's your subject. Search directly under the smoke.`, `${C[1]} 확인 · 실종자 위치. 연기 바로 아래를 수색할 것.`), 1400);
    if (o && o.t === 'sarfind' && o.search.r > 15) sarNarrow(o, 15, 3 + Math.random() * 3);
  } else { S.pen += 10; sfx('bad'); showMsg(L2(`${C[1]} 연기는 아님 (+10초)`, `Not the ${C[2]} smoke (+10 s)`), '#ff9a40', 1.8);
    setTimeout(() => comm(`Negative, that is not your subject. Keep looking for his signal.`, `아님 · 실종자 신호가 아님. 계속 찾을 것.`), 1400); }
  return true;
}
function trackRandom() { const T = TRACK; T.s = Math.random() * T.total * 0.25;
  { const endAt = s0 => { for (let s = s0; s <= T.total; s += 10) if (flyL(trackPose(s).p) > FLY_R_SAFE) return s; return T.total; }; let e = endAt(T.s), tries = 0; while (e - T.s < 800 && tries++ < 20) { T.s = Math.random() * T.total * 0.5; if (flyL(trackPose(T.s).p) > FLY_R_SAFE) continue; e = endAt(T.s); } T.endS = e; /* 비행 구역 밖으로 나가는 곳에서 끝 */ }
  T.base = 7 + Math.random() * 3; T.ph = Math.random() * 6; T.tt = 0; T.stopT = 0; T.stops = [T.s + 400 + Math.random() * 300, T.s + 1100 + Math.random() * 400]; }

// =====================================================================
//  무전 교신 (영어 · 원격 통제소가 지시). 화면 표시 + 무전 잡음 + 영어 음성(설정)
// =====================================================================
const CS = 'EAGLE ONE';
const PHON = { A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const DIG = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
// 코스 좌표 -> MGRS 8자리 (예: 52S CF 1693 7959)
function grid(d, s) {
  try {
    const en = projector(SITE.crs, 'EPSG:32652')(SITE_X.toEN(d, s)), e = en[0], n = en[1], zone = 52;
    const set = zone % 6 || 6, cols = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'][(set - 1) % 3], rows = zone % 2 ? 'ABCDEFGHJKLMNPQRSTUV' : 'FGHJKLMNPQRSTUVABCDE';
    const c = cols[Math.floor(e / 1e5) - 1], r = rows[Math.floor(n / 1e5) % 20], ee = String(Math.floor(e % 1e5 / 10)).padStart(4, '0'), nn = String(Math.floor(n % 1e5 / 10)).padStart(4, '0');
    return `${zone}S ${c}${r} ${ee} ${nn}`;
  } catch (e) { return '—'; }
}
// 음성용: 격자 글자는 음성 문자, 숫자는 한 자리씩
function speakify(t) {
  return t.replace(/(?:grid )?(\d+)S ([A-Z])([A-Z]) (\d{4}) (\d{4})/gi, (m, z, a, b, x, y) => `grid ${PHON[a]} ${PHON[b]}, ${x.split('').map(d => DIG[+d]).join(' ')}, ${y.split('').map(d => DIG[+d]).join(' ')}`)
    .replace(/\bEAGLE ONE\b/g, 'Eagle One').replace(/\bCONTROL\b/g, 'Control').replace(/\bRTB\b/g, 'R T B');
}
const COMM = { q: [], busy: 0, voice: null };
const ORDER = { m: null };
function commReset() {   // 새 비행: 남은 무전·자막·사진 미리보기 정리
  COMM.q.length = 0; COMM.cur = (COMM.cur || 0) + 1; COMM.sp = false; COMM.busy = 0; try { if (COMM.src) COMM.src.stop(); } catch (e) { } COMM.src = null;
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { } try { commStatic(false); } catch (e) { }
  const r = $('radio'); if (r) r.classList.remove('show'); const pp = $('photoPop'); if (pp) pp.style.opacity = 0; if (typeof PH !== 'undefined') PH.lastT = 0;
}
const OP = 'EAGLE ONE';   // 드론 운용자(우리 쪽) 무전 · 다른 목소리
function pickVoice() { try { const V = speechSynthesis.getVoices(); COMM.voice = V.find(v => /en-US/.test(v.lang) && /Male|David|Guy|Daniel|Alex/i.test(v.name)) || V.find(v => /^en/.test(v.lang)) || null; } catch (e) { } }
try { speechSynthesis.onvoiceschanged = pickVoice; pickVoice(); } catch (e) { }
// 말하는 동안 무전 잡음 (대역 제한 잡음 + 흔들림 + 지직거림)
function commStatic(on, dur) {
  const ctx = AU.ctx; if (!ctx || !AU.master) return;
  if (COMM.st) { try { COMM.st.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); COMM.st.s.stop(ctx.currentTime + 0.3); } catch (e) { } COMM.st = null; }
  if (!on) return;
  const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true;
  // 잡음은 말소리 대역(300~3000 Hz)을 피해 높은 쪽 '쉬' 소리로, 작게
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200; const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 7000; bp.Q.value = 0.5;
  const g = ctx.createGain(); g.gain.value = 0.0001; s.connect(hp); hp.connect(bp); bp.connect(g); g.connect(AU.master); s.start(t);
  const T = Math.min(dur || 6, 20);
  // 아주 옅은 쉬 소리만 (말소리를 가리지 않게)
  const lv = 0.0035 + 0.02 * commRange();   // 멀수록 잡음이 큼
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lv, t + 0.15);
  g.gain.setValueAtTime(lv, t + T); g.gain.exponentialRampToValueAtTime(0.0001, t + T + 0.2); s.stop(t + T + 0.3);
  COMM.st = { s, g };
}
// 무전기 소리: 좁은 대역(300~3100 Hz) · 가운데 강조 · 약한 찌그러짐 · 압축 — 실제 무전기처럼 · 멀어지면 말이 잠깐씩 끊김
function commRange() { const L = MS.launch ? MS.launch.p : null; return L && DR.p ? clamp((DR.p.distanceTo(L) - 300) / 900, 0, 1) : 0; }   // 이륙 지점에서 300 m 넘으면 조금씩
const RADIO_CURVE = (() => { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 2.4) / Math.tanh(2.4); } return c; })();
function radioChain(c, gain) {
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320; hp.Q.value = 0.8;
  const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1900; pk.Q.value = 0.9; pk.gain.value = 5;
  const ws = c.createWaveShaper(); ws.curve = RADIO_CURVE; ws.oversample = '2x';
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3100; lp.Q.value = 0.9;
  const cp = c.createDynamicsCompressor(); cp.threshold.value = -24; cp.ratio.value = 6; cp.attack.value = 0.003; cp.release.value = 0.12;
  const g = c.createGain(); g.gain.value = gain;
  hp.connect(pk); pk.connect(ws); ws.connect(lp); lp.connect(cp); cp.connect(g); g.connect(AU.master);
  const rk = commRange();
  if (rk > 0.3) { const t0 = c.currentTime, at = []; for (let k = 0; k < 7; k++) if (Math.random() < rk) at.push(t0 + 0.4 + Math.random() * 4.5); at.sort((x, y) => x - y);
    let last = 0; for (const x of at) { if (x < last + 0.3) continue; const dip = gain * (0.12 + 0.3 * (1 - rk)), len = 0.06 + Math.random() * 0.14; g.gain.setValueAtTime(gain, x); g.gain.linearRampToValueAtTime(dip, x + 0.025); g.gain.setValueAtTime(dip, x + len); g.gain.linearRampToValueAtTime(gain, x + len + 0.05); last = x + len + 0.05; } }
  return hp;
}
function squelch(open) {
  const ctx = AU.ctx; if (!ctx || !AU.master) return; const t = ctx.currentTime;
  noiseHit(t, 'bandpass', 2600, 0.8, open ? 0.035 : 0.03, open ? 0.08 : 0.12, AU.master);
  const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = open ? 1300 : 900; g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08); o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + 0.1);
}
// en: 영어 교신, ko: 한국어 자막 (한국어 화면에서만)
// pri: 급한 무전(추락·기체 손실 등) — 말하던 것을 끊고 밀린 무전을 버린 뒤 바로 · 밀린 무전은 10초 넘으면 버림 (늦게 나와 상황과 어긋나지 않게)
function comm(en, ko, from, tag, pri) {
  if (S.state !== 'run' && S.state !== 'result') return;
  if (tag) COMM.q = COMM.q.filter(m => m.tag !== tag);   // 같은 종류(코스 안내)는 최신 것만
  const m = { en, ko, from: from || 'CONTROL', tag, t: S.simT || 0, pri: !!pri };
  if (pri) { commInterrupt(); COMM.q = COMM.q.filter(x => x.pri); COMM.q.push(m); return; }
  COMM.q.push(m); if (COMM.q.length > 4) COMM.q.splice(COMM.q.findIndex(x => !x.pri), 1);
}
function commInterrupt() {   // 지금 나가는 무전을 끊음
  COMM.cur = (COMM.cur || 0) + 1; COMM.sp = false; COMM.busy = 0; radioT = Math.min(radioT, 0.3);
  try { if (COMM.src) COMM.src.stop(); } catch (e) { } COMM.src = null;
  try { if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); } catch (e) { }
  try { commStatic(false); } catch (e) { } if (MUS.bus && AU.ctx) musicSetLevel();
}
// 코스 음성 안내: 과제를 마칠 때마다 다음 과제를 불러 줌 (슬라럼 같은 연속 과제는 처음·끝만)
function courseCallSay(l) { return String(l).replace(/360°/g, 'three sixty').replace(/H-PAD/g, 'H pad').replace(/\s*·\s*/g, ', ').replace(/\s*\(([^)]*)\)/g, ', $1').replace(/\bLOW\b/g, 'Low').replace(/\b([A-Z])([A-Z]{3,})\b/g, (m, a, b) => a + b.toLowerCase()).replace(/(\d+)\/(\d+)/g, '$1 of $2'); }
function courseCall(done, next) {
  if (!next || !next.label) return;
  const k = l => String(l).split(/[ ·]/)[0];
  if (done && k(done.label) === k(next.label) && /SLALOM/.test(next.label)) return;
  comm(`Next, ${courseCallSay(next.label)}.`, L2('다음: ', 'Next: ') + next.label, 'CONTROL', 'nav');
}
// 음성: 실제 발화가 끝날 때까지 다음 교신을 기다림 (글자 수 추정으로 끊기지 않게)
COMM.sp = false; COMM.spT = 0; COMM.ok = false;
function voiceUnlock() { // 첫 터치/클릭에서 음성 엔진 깨우기 (브라우저 자동재생 정책)
  if (COMM.ok || !window.speechSynthesis) return; COMM.ok = true;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); pickVoice(); } catch (e) { }
}
['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, voiceUnlock, { once: true, passive: true }));
function commSpeechDone() { COMM.sp = false; COMM.busy = Math.min(COMM.busy, 0.5); radioT = Math.min(radioT, 1.2); commStatic(false); squelch(false); if (MUS.bus && AU.ctx) musicSetLevel(); }
// 기기에 영어 음성이 없으면(예: Quest 브라우저) 내장 합성기를 별도 작업 스레드에서 돌려 소리를 만듦 (GPL 구성 요소, 이때만 불러옴)
const TTSW = { w: null, ok: null, id: 0, cb: {} };
function ttsWorker() {
  if (TTSW.w || TTSW.ok === false) return TTSW.w;
  try { const inl = document.getElementById('ttsw'), src = inl ? URL.createObjectURL(new Blob([inl.textContent.split('<\\/script>').join('<' + '/script>')], { type: 'text/javascript' })) : (window.SIM_BASE || '') + 'lib/tts-worker.js'; const w = new Worker(src); w.onmessage = e => { if (e.data && e.data.ready) { TTSW.ready = true; return; } const c = TTSW.cb[e.data.id]; delete TTSW.cb[e.data.id]; if (c) c(e.data); }; w.onerror = ev => { TTSW.ok = false; TTSW.w = null; COMM.fbErr = 'worker load: ' + (ev && ev.message || 'error'); }; TTSW.w = w; } catch (e) { TTSW.ok = false; COMM.fbErr = 'worker: ' + e.message; }
  return TTSW.w;
}
// 자연스러운 무전 음성: 미리 만들어 둔 음성 조각(Kokoro-82M, Apache-2.0)을 이어 붙여 재생. 없는 말이 섞이면 기존 엔진으로
const RV = { idx: null, buf: null, ab: {}, st: 'none' };
function rvLoad() {
  if (RV.st !== 'none') return; RV.st = 'loading';
  const ib = document.getElementById('rvb'), ii = document.getElementById('rvi');
  if (ib && ii) { try { const s = atob(ib.textContent.trim()), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); RV.buf = u.buffer; RV.idx = JSON.parse(ii.textContent); RV.st = 'ready'; } catch (e) { RV.st = 'fail'; COMM.rvErr = 'inline: ' + e.message; } return; }
  if (location.protocol === 'file:') { RV.st = 'fail'; return; }   // 한 파일판인데 음성 묶음이 없으면 기존 엔진
  const base = (window.SIM_BASE || '') + 'lib/radio_voice';
  const v = '?v=' + (window.SIM_RV_V || '');   // 묶음이 바뀌면 새로 받음 (캐시)
  Promise.all([fetch(base + '.json' + v).then(r => r.ok ? r.json() : Promise.reject('json ' + r.status)), fetch(base + '.bin' + v).then(r => r.ok ? r.arrayBuffer() : Promise.reject('bin ' + r.status))])
    .then(([i, b]) => { RV.idx = i; RV.buf = b; RV.st = 'ready'; }).catch(e => { RV.st = 'fail'; COMM.rvErr = String(e); });
}
setTimeout(rvLoad, window.SIM_VR ? 2500 : 12000);   // 메뉴에서는 첫 화면이 다 뜬 뒤에(나무·바닥 사진을 먼저 받게) · 출격하면 바로 (startRun)
const RV_U = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' '), RV_T = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
function rvNumW(n) { return n < 20 ? RV_U[n] : n < 100 ? RV_T[Math.floor(n / 10) - 2] + (n % 10 ? ' ' + RV_U[n % 10] : '') : String(n); }
function rvNorm(t) { return String(t).toLowerCase().replace(/\d+/g, m => ' ' + rvNumW(+m) + ' ').match(/[a-z']+/g) || []; }
function rvPlan(text, spk) {   // 가장 긴 조각부터 맞춰 나감 (문장 단위 조각이면 억양이 자연스러움) · spk 'op' = 드론 운용자 목소리
  if (RV.st !== 'ready' || SET.voiceEng === 'synth') return null;
  const w = rvNorm(text), out = [], pre = spk === 'op' ? 'op|' : ''; let i = 0;
  while (i < w.length) { let hit = 0; for (let L = Math.min(40, w.length - i); L >= 1; L--) { const k = pre + w.slice(i, i + L).join(' '); if (RV.idx[k]) { out.push(k); hit = L; break; } } if (!hit) return null; i += hit; }
  return out.length ? out : null;
}
function rvBuf(k) { if (RV.ab[k]) return Promise.resolve(RV.ab[k]); const [o, l] = RV.idx[k]; return AU.ctx.decodeAudioData(RV.buf.slice(o, o + l)).then(b => (RV.ab[k] = b)); }
function rvSpeak(plan, est) {
  const myId = (COMM.cur = (COMM.cur || 0) + 1); COMM.sp = true;
  const done = () => { if (COMM.cur === myId) commSpeechDone(); };
  if (COMM.src) { try { COMM.src.stop(); } catch (e) { } COMM.src = null; }
  if (!AU.ctx) { setTimeout(done, est * 900); return; }
  Promise.all(plan.map(rvBuf)).then(bs => {
    if (COMM.cur !== myId) return; const c = AU.ctx;
    const hp = radioChain(c, 1.15);
    let t = c.currentTime + 0.06; const S2 = [];
    bs.forEach((b, i) => { const s = c.createBufferSource(); s.buffer = b; s.connect(hp); s.start(t); S2.push(s); t += b.duration + (plan[i].replace('op|', '').indexOf(' ') > 0 && i < bs.length - 1 && plan[i + 1].replace('op|', '').indexOf(' ') > 0 ? 0.14 : 0.03); });
    S2[S2.length - 1].onended = done; COMM.src = { stop() { S2.forEach(s => { try { s.stop(); } catch (e) { } }); } }; COMM.rvOk = true;
  }).catch(e => { COMM.rvErr = 'decode: ' + (e && e.message || e); done(); });
  setTimeout(() => { if (COMM.cur === myId) done(); }, Math.max(12, est * 2.5) * 1000);
}
function needFallbackVoice() { if (window.SIM_VR || COMM.webFail) return true; try { return !speechSynthesis.getVoices().some(v => /^en/i.test(v.lang)); } catch (e) { return true; } }
function commEngine() { return RV.st === 'ready' && SET.voiceEng !== 'synth' ? 'natural' : needFallbackVoice() ? (TTSW.ok === false ? 'none' : 'synth') : 'web'; }
function vrVoiceTest() {
  if (AU.ctx && AU.ctx.state !== 'running') try { AU.ctx.resume(); } catch (e) { }
  const t = 'Eagle One, Control. Radio check. How copy? Over.';
  const pl = rvPlan(t); if (pl) return rvSpeak(pl, 4);
  if (needFallbackVoice()) { ttsWorker(); commSpeakFallback(t, 4); } else commSpeak(t, 4);
}
setTimeout(() => { if (SET.voice !== false && needFallbackVoice() && RV.st !== 'ready') ttsWorker(); }, window.SIM_VR ? 2500 : 4000);   // 미리 불러 둠
function commSpeakFallback(text, est) {
  const myId = (COMM.cur = (COMM.cur || 0) + 1); COMM.sp = true;
  const done = () => { if (COMM.cur === myId) commSpeechDone(); };
  if (COMM.src) { try { COMM.src.stop(); } catch (e) { } COMM.src = null; }
  const w = ttsWorker(), id = ++TTSW.id;
  if (!w || !AU.ctx) { COMM.fbErr = !w ? 'worker' : 'no audio context'; setTimeout(done, est * 900); return; }
  COMM.fbState = 'synth'; TTSW.cb[id] = d => {
    if (d.err) COMM.fbErr = d.err; COMM.fbState = d.buf ? 'decode' : 'noaudio';
    if (COMM.cur !== myId || !d.buf) return done();
    AU.ctx.decodeAudioData(d.buf).then(b => {
      if (COMM.cur !== myId) return; const c = AU.ctx, s = c.createBufferSource(); s.buffer = b;
      s.connect(radioChain(c, 1.3)); s.onended = done; s.start(); COMM.src = s; COMM.fbOk = true;
    }).catch(e => { COMM.fbErr = 'decode: ' + (e && e.message || e); done(); });
  };
  w.postMessage({ id, text });
  setTimeout(() => { if (COMM.cur === myId) done(); }, Math.max(10, est * 2.2) * 1000);
}
// 한국어 무전: 기기에 있는 한국어 음성으로 자막(ko)을 읽음 · 한국어 음성이 없으면(예: Quest 브라우저) 영어 무전으로
function koVoice() { try { const V = speechSynthesis.getVoices(); return V.find(v => /^ko/i.test(v.lang) && /Natural|Online|Neural|Google/i.test(v.name)) || V.find(v => /^ko/i.test(v.lang)) || null; } catch (e) { return null; } }
function commSpeakKo(text, est, op) {
  const v = koVoice(); if (!v) return false;
  const myId = (COMM.cur = (COMM.cur || 0) + 1); COMM.sp = true; let started = false;
  const done = () => { if (COMM.cur === myId) commSpeechDone(); };
  if (COMM.src) { try { COMM.src.stop(); } catch (e) { } COMM.src = null; }
  const u = new SpeechSynthesisUtterance(String(text).replace(/\s*·\s*/g, ', ').replace(/(\d+)\s*m\b/g, '$1미터')); u.lang = v.lang; u.voice = v; u.rate = 1.08; u.pitch = op ? 1.2 : 0.85; u.volume = 1;
  u.onstart = () => { started = true; }; u.onend = done; u.onerror = e => { if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; done(); };
  (COMM.keep = COMM.keep || []).push(u); if (COMM.keep.length > 8) COMM.keep.shift();
  try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { done(); }
  setTimeout(() => { if (COMM.cur === myId && !started) done(); }, 3000);
  setTimeout(() => { if (COMM.cur === myId) done(); }, Math.max(8, est * 2) * 1000);
  return true;
}
function commSpeak(text, est, ko) {
  if (ko && SET.radioLang === 'ko' && window.SIM_LANG !== 'en' && commSpeakKo(ko, est, COMM.spk === 'op')) return;
  if (ko && SET.radioLang === 'ko' && window.SIM_LANG !== 'en' && !COMM.koWarn) { COMM.koWarn = true; showMsg(L2('이 기기에는 한국어 음성이 없어 영어 무전으로 들려줍니다', 'No Korean voice on this device — English radio'), '#ffd27a', 2.5); }
  const pl = rvPlan(text, COMM.spk); if (pl) return rvSpeak(pl, est);
  if (needFallbackVoice() && TTSW.ok !== false && ttsWorker()) return commSpeakFallback(text, est);
  const done = () => { if (COMM.cur === myId) commSpeechDone(); };
  const myId = (COMM.cur = (COMM.cur || 0) + 1);
  COMM.sp = true; COMM.spT = est;
  const parts = text.match(/[^.!?]+[.!?]*/g) || [text]; let i = 0, started = false;
  const next = () => {
    if (COMM.cur !== myId) return;
    if (i >= parts.length) return done();
    const t = parts[i++].trim(); if (!t) return next();
    const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'; if (COMM.voice) u.voice = COMM.voice;
    u.rate = 1.0; u.pitch = COMM.spk === 'op' ? 1.15 : 0.9; u.volume = 1;
    u.onstart = () => { started = true; }; u.onend = next; u.onerror = (e) => { if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; if (!started && i === 1) COMM.err = (COMM.err || 0) + 1; next(); };
    (COMM.keep = COMM.keep || []).push(u); if (COMM.keep.length > 8) COMM.keep.shift(); // GC 방지
    try { speechSynthesis.speak(u); } catch (e) { next(); }
  };
  try { if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); setTimeout(next, 120); } else next(); } catch (e) { done(); }
  // 안전장치: 음성이 전혀 시작되지 않으면(차단/미지원) 자막 시간 후 해제
  setTimeout(() => { if (COMM.cur === myId && !started) { COMM.webFail = true; done(); } }, 2500);
  setTimeout(() => { if (COMM.cur === myId) done(); }, Math.max(8, est * 1.8) * 1000);
}
function commTick(dt) {
  if (!COMM.sp) COMM.busy -= dt; radioT -= dt;
  if (radioT <= 0 && !COMM.sp) { const el = $('radio'); if (el) el.classList.remove('show'); }
  if (COMM.busy > 0 || !COMM.q.length) return;
  while (COMM.q.length && !COMM.q[0].pri && (S.simT || 0) - COMM.q[0].t > 10) COMM.q.shift();   // 너무 늦은 무전은 버림
  if (!COMM.q.length) return;
  const m = COMM.q.shift(), el = $('radio'); if (!el) return;
  el.innerHTML = `<div class="rf">📻 ${m.from}</div><div class="re">${m.en}</div>` + (window.SIM_LANG !== 'en' && m.ko ? `<div class="rk">${m.ko}</div>` : '');
  if (m.from === 'CONTROL' && !/missed/i.test(m.en)) ORDER.m = { en: m.en, ko: m.ko, t: S.t };   // 마지막 명령은 화면에 남김
  const sp = speakify(m.en), dur = Math.max(3.5, sp.length / 13);
  COMM.spk = m.from === 'CONTROL' ? '' : 'op';
  el.classList.add('show'); radioT = dur + 1; COMM.busy = dur + 0.6;
  squelch(true); commStatic(true, dur + 0.4);
  if (SET.voice !== false && (RV.st === 'ready' || window.speechSynthesis || (needFallbackVoice() && TTSW.ok !== false))) {
    if (AU.ctx && AU.ctx.state !== 'running') try { AU.ctx.resume(); } catch (e) { }
    if (MUS.bus && AU.ctx) MUS.bus.gain.setTargetAtTime(musicLevel() * 0.25, AU.ctx.currentTime, 0.1);
    COMM.busy = 999; radioT = 999; commSpeak(sp, dur, m.ko);
  } else setTimeout(() => squelch(false), dur * 900);
}
// 임무 시작 교신
function commStart(kind) {
  if (typeof isC1 === 'function' && isC1(kind)) return;
  const w = WIND.lv ? `Winds ${WIND.lv === 1 ? 'three' : 'seven'} meters per second from west-northwest. ` : '';
  const n = ENV.night ? 'Night ops, keep your strobes on. ' : '';
  const T = {
    forest: [`${CS}, CONTROL. Cleared for launch. Proceed into the forest trail, stay low under the canopy. ${w}Over.`, '이륙 허가. 숲길로 진입, 수관 아래로 낮게.'],
    race: [`${CS}, CONTROL. Range is hot. Rings are set along the valley. Go when ready. ${w}`, '코스 준비 완료. 계곡 링 따라 출발.'],
    recon: (() => { const b = kind === 'recon' && MS.list[0] && MS.list[0].tp ? fromLaunch(MS.list[0].tp) : null; return [`${CS}, CONTROL. Four structures tasked for imagery. ${b ? `First structure bearing ${b.brgW}, about ${b.distW} meters from launch point.` : ''} ${n}Over.`, `건물 4곳 촬영 임무.${b ? ` 첫 대상: 출발점에서 방위 ${b.brg}° · 약 ${b.dist} m` : ''}`]; })(),
    strike: [`${CS}, CONTROL. Five vehicles in the valley, two are decoys. Positive ID by thermal before you commit. Cleared hot.`, '차량 5대 중 2대 기만체. 열화상으로 식별 후 돌입. 공격 허가.'],
    fire: [`${CS}, CONTROL. Fire watch requested. Smoke reports coming in, locate each fire, confirm it by eye or thermal and report. ${w}Over.`, '산불 감시 요청. 연기 신고가 들어옴. 직접 찾아 눈이나 열화상으로 확인 후 보고.'],
    sar: (() => { const b = kind === 'sar' && SAR ? fromLaunch(SAR.area) : null; return [`${CS}, CONTROL. Missing hiker, last seen near the trail. ${b ? `Search area bearing ${b.brgW}, about ${b.distW} meters from launch point.` : ''} Sweep the area, look for his pack and signal flashes, use thermal under the trees. ${n}Over.`, `실종자 수색.${b ? ` 수색 구역: 출발점에서 방위 ${b.brg}° · 약 ${b.dist} m.` : ''} 구역을 훑으며 배낭·신호 반짝임, 나무 아래는 열화상.`]; })(),
    track: [`${CS}, CONTROL. Target vehicle on the forest road. Do not get spotted. Stay out of its front, keep high and well back, and keep eyes on for sixty seconds.`, '도로의 표적 차량 추적. 들키지 말 것 · 차 앞쪽 피하고 높게, 멀찍이 뒤에서 60초 관측.'],
    ridge: [`${CS}, CONTROL. Ridge run approved. Expect gusts on the crest. ${w}`, '능선 비행 승인. 능선 위 돌풍 주의.'],
    field: [`${CS}, CONTROL. Field strip is yours. ${AFc().cls === 'wing' ? 'Take off, fly the pattern and land on the runway.' : 'Hop the pads, land gently on the centre of each.'} ${w}`, AFc().cls === 'wing' ? '야전 착륙장 사용 승인. 이륙 후 장주 비행, 활주로 착륙.' : '야전 착륙장 사용 승인. 패드를 옮겨 다니며 가운데에 살살 착륙.']
  }[kind];
  if (T) { comm(T[0], T[1]); if (ENV.wx === 'rain') comm('Rain over the range, expect reduced visibility.', '비가 내림. 시야 감소 주의.'); else if (ENV.wx === 'snow') comm('Snow over the range, expect reduced visibility.', '눈이 내림. 시야 감소 주의.'); if (isMission(kind)) comm('Eagle One, wilco.', '이글 원, 수행하겠음.', OP); }
}
let COMM_LAST = 0;
function commAck(o, kind) {   // 목표 하나 끝났을 때
  if (o && o.rtb) return;   // 복귀·착륙은 표적이 아님 (임무 완료 무전이 따로 나옴) — 예전엔 착륙하면 '촬영 확인'·'불씨 확인'이라고 답했음
  const rest = MS.list.filter(x => !x.done && !x.rtb), left = rest.length, rtb = MS.list.find(x => !x.done && x.rtb);
  const home = rtb ? (rtb.t === 'rwyland' ? [' RTB and land on the runway.', ' 복귀 · 활주로 착륙.'] : rtb.t === 'land' ? [' RTB to the launch pad.', ' 출발 패드로 복귀.'] : [' RTB.', ' 복귀.']) : ['', ''];
  if (kind === 'recon') { const x = rest.find(y => y.tp), v = x ? vecText(x.tp, 'Next structure', '다음 대상') : null; return comm(`Copy imagery. ${v ? v[0] : 'All imagery received.' + home[0]}`, v ? `촬영 확인. ${v[1]}` : '촬영 모두 수신.' + home[1]); }
  if (kind === 'recon-old') return comm(`Copy imagery. ${left ? `Next structure, grid ${(() => { const x = MS.list.find(y => !y.done); return x ? grid(x.d, x.s) : '—'; })()}.` : 'All imagery received.'}`, left ? '촬영 확인. 다음 대상 좌표 전달.' : '촬영 모두 수신.');
  if (kind === 'fire') return comm(`Copy imagery, hotspot confirmed at grid ${grid(o.d, o.s)}. Fire crews dispatched.${left ? ' Stand by for the next report.' : ' All reported.' + home[0]}`, `사진 접수 · 불씨 확인, 진화대 출동.${left ? ' 다음 신고 대기.' : ' 모두 보고됨.' + home[1]}`);
  if (kind === 'sar' && o.t === 'sarfind') return comm(`Copy imagery, subject located at grid ${grid(SAR.d, SAR.s)}. ${AFc().drop ? 'Drop the rescue kit within five meters.' : 'Return to base.'}`, `실종자 위치 확인. ${AFc().drop ? '구조 키트 5 m 이내 투하.' : '복귀.'}`);
  if (kind === 'sar' && o.t === 'sarkit') return comm('Good drop, kit on the ground. Ground team is en route. RTB.', '키트 전달 확인. 구조대 이동 중. 복귀.');
  if (kind === 'forest' || kind === 'race' || kind === 'ridge') {
    const done = MS.list.length - left, half = Math.floor(MS.list.length / 2);
    if (o.label && /정상|Summit/.test(o.label)) return comm(`Summit reached. Nice work, ${CS}. Head down the far ridge.`, '정상 도착. 반대편 능선으로 하강.');
    if (done === half) return comm(`Halfway. ${S.pen ? 'Watch your clearances.' : 'Looking clean, keep it up.'}`, `절반 통과. ${S.pen ? '간격 주의.' : '깔끔함, 계속.'}`);
    if (left === 1) return comm('Final gate ahead. Bring it home.', '마지막 통과점. 마무리.');
  }
}

// =====================================================================
//  화면 배치 편집 (창 위치·크기·숨기기). 기기 종류별(터치/PC)로 따로 저장
// =====================================================================
const LY_ITEMS = [
  ['osd', '비행 정보', 'Flight data'], ['obj', '다음 과제', 'Next task'], ['list', '과제 목록', 'Task list'], ['map', '지도', 'Map'], ['belly', '아래 카메라', 'Belly cam'],
  ['radio', '무전', 'Radio'], ['guide', '안내 문구', 'Guide'], ['bottom', '상태 표시', 'Status'], ['scope', '투하 조준', 'Drop scope'],
  ['tbBoost', 'BST', 'BST'], ['tbDrop', 'DROP', 'DROP'], ['tbCam', 'CAM', 'CAM'], ['tbReset', '⟲', '⟲'], ['tbBelly', '↓CAM', '↓CAM'], ['tbIR', 'IR', 'IR'], ['tbLight', '💡', '💡'], ['tbAssist', 'AST', 'AST'], ['tbZoom', 'ZM', 'ZM'], ['tbGuide', 'GD', 'GD'], ['tbHud', 'UI', 'UI'], ['tbFull', '⛶', '⛶'], ['tbPause', '❚❚', '❚❚'], ['tbVec', '📍', '📍']
].filter(([k]) => !(IS_TOUCH && k === 'radio'));   // 휴대폰: 무전 창은 없음 (📻 명령 상자로)
const LY = { key: 'fpvsim_layout_' + (IS_TOUCH ? 'touch' : 'desk'), d: {}, edit: false, sel: null };
try { LY.d = JSON.parse(localStorage.getItem(LY.key) || '{}'); } catch (e) { }
// 버튼 기본 배치가 바뀌었으니 예전에 저장한 버튼 위치는 한 번 지움 (다른 창 위치는 유지)
if (!LY.d.__v3) { for (const k of Object.keys(LY.d)) if (/^tb/.test(k)) delete LY.d[k]; LY.d.__v3 = 1; try { localStorage.setItem(LY.key, JSON.stringify(LY.d)); } catch (e) { } }
// 휴대폰 기본 배치 (사용자가 정해 준 배치 기준). x,y = 왼쪽 위 / cx,cy = 가운데 (화면 비율)
LY.def = IS_TOUCH ? {
  osd: { x: 0.045, y: 0.016 }, obj: { x: 0.257, y: 0.016 }, bottom: { x: 0.262, y: 0.112, s: 0.55 }, map: { x: 0.046, y: 0.327 }, belly: { x: 0.046, y: 0.679 }, scope: { x: 0.194, y: 0.699 }, radio: { x: 0.335, y: 0.789 },
  // 버튼: 오른쪽 위 한 줄 (간격 54 px, 오른쪽 끝 기준) + 그 아래 BST·DROP 가운데 높이 맞춤
  // 4개씩 두 줄, 오른쪽 끝 정렬: [GD AST ⛶ ❚❚] / [IR CAM ↓CAM ZM], 그 아래 BST·DROP 가운데 높이 맞춤
  tbVec: { r: 282, t: 10 }, tbHud: { r: 228, t: 10 }, tbGuide: { r: 174, t: 10 }, tbAssist: { r: 120, t: 10 }, tbFull: { r: 66, t: 10 }, tbPause: { r: 12, t: 10 },
  tbLight: { r: 228, t: 64 }, tbIR: { r: 174, t: 64 }, tbCam: { r: 120, t: 64 }, tbBelly: { r: 66, t: 64 }, tbZoom: { r: 12, t: 64 },
  tbDrop: { r: 12, t: 122 }, tbBoost: { r: 102, t: 132 }, tbReset: { r: 172, t: 138, h: true }
} : {};
function lySave() { try { localStorage.setItem(LY.key, JSON.stringify(LY.d)); } catch (e) { } }
// ---- 쓸모없는 버튼은 숨김 (휴대폰): 지금 모드·설정에서 기능이 없는 단추는 빼고, 기본 자리는 남은 단추로 오른쪽부터 다시 채움 (직접 옮긴 단추는 그 자리 그대로) ----
const TB_ROWS = [['tbVec', 'tbHud', 'tbGuide', 'tbAssist', 'tbFull', 'tbPause'], ['tbLight', 'tbIR', 'tbCam', 'tbBelly', 'tbZoom']];
const TB = { off: new Set(), key: '' };
function tbUseful(id) {
  const k = S.kind, run = S.state === 'run' || S.state === 'pause', c1 = typeof isC1 === 'function' && isC1(), md = MODES[SET.diff] || {};
  const thermalMs = k === 'fire' || k === 'sar' || k === 'strike' || k === 'track' || k === 'recon' || k === 'free', dark = ENV.night || ENV.dusk;
  switch (id) {
    case 'tbDrop': return !run || actionKind() !== 'none';                              // 투하·사진 보고가 없는 임무(레이스·숲길·능선·착륙장·타격)
    case 'tbBoost': return !md.atti && !c1;                                             // ATTI·1종은 부스트 없음
    case 'tbIR': return (thermalMs || dark) && !c1;                                     // 열화상이 쓰이는 임무 · 어두울 때
    case 'tbLight': return dark || (ENV.wx && ENV.wx !== 'clear');                      // 낮·맑음엔 조명이 보이지 않음
    case 'tbBelly': return !(k === 'race' || k === 'forest' || k === 'ridge' || c1);    // 링·숲길·능선은 아래 카메라 쓸 일 없음
    case 'tbZoom': return CAMS[S.cam] !== 'FPV';                                        // 추적 카메라 거리 (FPV 시점엔 없음)
    case 'tbAssist': return (md.assist || 0) > 0 && !c1;                                // 보조가 있는 난이도만
    case 'tbGuide': return !(k === 'free' || k === 'demo' || c1);
    case 'tbVec': return isMission() && !c1 && S.state === 'run';                     // 무전 위치 요청 (임무 중)
    default: return true;
  }
}
function tbAuto() {   // 매 프레임 (photoTick) · 바뀐 때만 다시 배치
  if (!IS_TOUCH || XR_ON) return; let key = '';
  for (const row of TB_ROWS) for (const id of row) if (!tbUseful(id)) key += id + ',';
  if (!tbUseful('tbDrop')) key += 'tbDrop,'; if (!tbUseful('tbBoost')) key += 'tbBoost,';
  if (key === TB.key) return; TB.key = key; TB.off = new Set(key.split(',').filter(Boolean));
  for (const [id] of LY_ITEMS) if (/^tb/.test(id)) { const el = $(id); if (el) el.classList.toggle('tbOff', TB.off.has(id)); }
  lyApply();
}
function tbDef(id) {   // 기본 자리: 두 줄을 보이는 단추만으로 오른쪽 끝부터 54 px 간격
  const d = LY.def[id]; if (!d || !IS_TOUCH || !/^tb/.test(id)) return d;
  for (const row of TB_ROWS) { const i = row.indexOf(id); if (i < 0) continue; const vis = row.filter(x => !TB.off.has(x) && LY.d[x] === undefined), j = vis.indexOf(id); if (j < 0) return d; return { r: 12 + 54 * (vis.length - 1 - j), t: d.t }; }
  if (id === 'tbBoost' && TB.off.has('tbDrop')) return { r: 12, t: 132 };   // 투하 단추가 없으면 부스트가 그 자리로
  return d;
}
function lyApply() {
  for (const [id] of LY_ITEMS) {
    const el = $(id); if (!el) continue; const c = LY.d[id] || tbDef(id);
    if (!c) { el.style.left = el.style.top = el.style.right = el.style.bottom = el.style.transform = el.style.transformOrigin = ''; el.classList.remove('lyHide'); continue; }
    const cs = getComputedStyle(el), s = c.s || 1, W = innerWidth, H = innerHeight, w = (el.offsetWidth || parseFloat(cs.width) || 46) * s, h = (el.offsetHeight || parseFloat(cs.height) || 46) * s;   // 숨겨진 동안엔 CSS 크기로
    if (id === 'obj') el.style.textAlign = 'left';   // 옮긴 경우 왼쪽 정렬 (가운데 정렬이면 상자가 밀림)
    let L = null, T = null;   // 화면 기준 위치
    if (c.r !== undefined || c.l !== undefined) { L = c.l !== undefined ? c.l : W - c.r - w; T = c.t !== undefined ? c.t : c.b !== undefined ? H - c.b - h : 0; }   // 픽셀 기준 (왼쪽·오른쪽 + 위·아래)
    else if (c.cx !== undefined) { L = c.cx * W - w / 2; T = c.cy * H - h / 2; }
    else if (c.x !== undefined) { L = c.x * W; T = c.y * H; }
    if (L !== null) {
      L = clamp(L, 0, Math.max(0, W - w)); T = clamp(T, 0, Math.max(0, H - h));
      const op = el.offsetParent, pr = op ? op.getBoundingClientRect() : { left: 0, top: 0 };   // 부모 상자 기준으로 바꿈
      el.style.left = Math.round(L - pr.left) + 'px'; el.style.top = Math.round(T - pr.top) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
    }
    el.style.transformOrigin = 'top left'; el.style.transform = L !== null || c.s ? `scale(${s})` : '';
    el.classList.toggle('lyHide', !!c.h);
  }
}
addEventListener('resize', () => setTimeout(lyApply, 50));
function lyName(id) { const it = LY_ITEMS.find(x => x[0] === id); return it ? (window.SIM_LANG === 'en' ? it[2] : it[1]) : id; }
function lyBar() {
  const b = $('lyBar'), sel = LY.sel, c = sel ? (LY.d[sel] || LY.def[sel] || {}) : null;
  b.innerHTML = `<span class="ln">${sel ? lyName(sel) : L2('창을 끌어서 옮기기 · 눌러서 고르기', 'Drag to move · tap to select')}</span>` +
    (sel ? `<button data-a="m">−</button><span class="sz">${Math.round((c.s || 1) * 100)}%</span><button data-a="p">+</button><button data-a="h">${c.h ? L2('보이기', 'Show') : L2('숨기기', 'Hide')}</button><button data-a="r1">${L2('이 창 원래대로', 'Reset item')}</button>` : '') +
    `<button data-a="ra">${L2('전체 초기화', 'Reset all')}</button><button class="primary" data-a="ok">${L2('완료', 'Done')}</button>`;
  b.querySelectorAll('button').forEach(x => x.onclick = e => { e.stopPropagation(); const a = x.dataset.a, d = sel && (LY.d[sel] = LY.d[sel] || Object.assign({}, LY.def[sel] || {}));
    if (a === 'm') d.s = Math.max(0.5, Math.round(((d.s || 1) - 0.1) * 10) / 10); if (a === 'p') d.s = Math.min(1.8, Math.round(((d.s || 1) + 0.1) * 10) / 10);
    if (a === 'h') d.h = !d.h; if (a === 'r1') delete LY.d[sel]; if (a === 'ra') { LY.d = { __v3: 1 }; LY.sel = null; }
    if (a !== 'ok' && a !== 'ra') delete LY.d.__p;   // 손으로 바꾸면 견본(화면 구성) 표시는 '직접 배치'로
    if (a === 'ok') return lyEdit(false);
    lySave(); lyApply(); lyBar(); });
}
function lyEdit(on) {
  LY.edit = on; document.body.classList.toggle('lyEditing', on); $('lyBar').classList.toggle('hidden', !on);
  const r = $('radio'); if (on && r && !r.classList.contains('show')) { r.innerHTML = '<div class="rf">📻 CONTROL</div><div class="re">EAGLE ONE, CONTROL. Radio check. Over.</div>'; r.classList.add('show'); radioT = 1e9; } else if (!on && r) { radioT = 0; }
  if (on) { ui.pause.classList.add('hidden'); ui.hud.classList.remove('hidden'); LY.sel = null; lyBar(); }
  else { lySave(); if (S.state === 'pause') ui.pause.classList.remove('hidden');
    if (LY.menu) { LY.menu = false; ui.hud.classList.add('hidden'); $('guide').classList.add('hidden'); ui.menu.classList.remove('hidden'); pilotSetUI(); } }   // 메뉴(1단계)에서 연 편집이면 메뉴로
}
// 메뉴에서 바로 화면 배치 편집: 견본 내용(비행 정보·다음 과제·목록·안내 문구·무전)을 채워 비행 화면 위에서 옮김
function lyEditMenu() {
  if (S.state !== 'menu') return; LY.menu = true; ui.menu.classList.add('hidden'); closePanels();
  try { updateHUD(0, DR); drawMap(null); } catch (e) { }
  ui.objNext.style.display = ''; ui.objNext.innerHTML = 'NEXT ▸ WINDOW GATE 1<small>3/24</small>';
  ui.list.classList.remove('hidden'); ui.list.innerHTML = ['WINDOW GATE 1', 'TRIANGLE GATE 1', 'WINDOW GATE 2', 'RING 2 · HIGH', 'SLALOM 1/6'].map((t, i) => `<div class="${i ? '' : 'cur'}">${i ? '·' : '▶'} ${t}</div>`).join('');
  const g = $('guide'); g.classList.remove('hidden'); g.innerHTML = `<div class="ok">${L2('정렬 OK · 전진', 'Aligned · fly forward')}</div>`;
  lyEdit(true);
}
// 끌기
(function () {
  let drag = null;
  addEventListener('pointerdown', e => {
    if (!LY.edit || (e.target.closest && e.target.closest('#lyBar'))) return;
    // 손가락 아래에 있는 창 (맨 위 것부터) — 터치 조작 영역이 위에 덮여 있어도 찾음
    let el = null; for (let i = LY_ITEMS.length - 1; i >= 0 && !el; i--) { const c = $(LY_ITEMS[i][0]); if (!c) continue; const r = c.getBoundingClientRect(); if (r.width > 2 && r.height > 2 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom && getComputedStyle(c).display !== 'none') el = c; }
    if (!el) return;
    e.preventDefault(); e.stopPropagation(); const r = el.getBoundingClientRect(); drag = { el, id: el.id, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false }; LY.sel = el.id; lyBar();
  }, true);
  addEventListener('pointermove', e => {
    if (!drag) return; e.preventDefault(); drag.moved = true; const d = LY.d[drag.id] = LY.d[drag.id] || Object.assign({}, LY.def[drag.id] || {});
    delete d.cx; delete d.cy; delete d.r; delete d.t; delete d.l; delete d.b; delete LY.d.__p; d.x = (e.clientX - drag.dx) / innerWidth; d.y = (e.clientY - drag.dy) / innerHeight; lyApply();
  }, true);
  addEventListener('pointerup', () => { if (drag) { lySave(); drag = null; } }, true);
})();
$('bLayout').onclick = () => lyEdit(true);
lyApply();

// ---------------- 데이터 출처 ----------------
const EN_ = window.SIM_LANG === 'en';
const CRED_AF = [
  ['Skydio X2D', 'Skydio X2D Color/Thermal 데이터시트 (크기 66×56×20 cm, 1.3 kg, 50 km/h, 35분)', 'Skydio X2D Color/Thermal datasheet (66×56×20 cm, 1.3 kg, 50 km/h, 35 min)'],
  ['Parrot ANAFI USA', 'Parrot ANAFI USA 백서 (0.5 kg, 14.7 m/s, 상승·하강 4 m/s, 32분)', 'Parrot ANAFI USA white paper (0.5 kg, 14.7 m/s, 4 m/s climb/descent, 32 min)'],
  ['RQ-11B Raven · RQ-20B Puma', '미 해군 Group 1 소형 무인기 제원표 · 미 공군 RQ-11B 제원표', 'U.S. Navy Group 1 sUAS fact file · U.S. Air Force RQ-11B fact sheet'],
  ['FPV · 자폭 FPV · 자폭 고정익', '특정 제품이 아닌 일반적인 성능 범위로 잡은 가상 기체', 'Generic airframes with typical performance ranges (not a specific product)']
];
function credHTML() {
  const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  let h = '<h3>' + (EN_ ? 'Training site · ' : '훈련장 · ') + stName(SITE) + '</h3><table>';
  if (SITE.credits) h += SITE.credits.map(c => row(EN_ ? c[2] : c[0], EN_ ? c[3] : c[1])).join('');
  else h += row(EN_ ? 'Terrain' : '지형', SITE.flat ? (EN_ ? 'Flat ground (no terrain data)' : '평지 (지형 데이터 없음)') : (stSrc(SITE) || '-'));
  h += row(EN_ ? 'Course' : '코스', SITE.flat ? (EN_ ? 'Standard obstacle course layout' : '기본 장애물 코스 배치') : (EN_ ? 'Obstacles laid along a user-specified route' : '사용자가 지정한 경로를 따라 장애물 배치'));
  h += '</table><h3>' + (EN_ ? 'Airframe specs' : '기체 제원') + '</h3><table>' + CRED_AF.map(c => row(c[0], EN_ ? c[2] : c[1])).join('') + '</table>';
  h += '<h3>' + (EN_ ? 'Software' : '소프트웨어') + '</h3><table>' + row('three.js r149', 'MIT') + row('geotiff.js 2.1', 'MIT') + row('proj4js 2.11', 'MIT') + row(EN_ ? 'ez-tree 1.1 (tree models, leaf textures)' : 'ez-tree 1.1 (나무 모형·잎 그림)', 'MIT · Daniel Greenheck') + row(EN_ ? 'Radio voice: Kokoro-82M' : '무전 음성: Kokoro-82M', 'Apache-2.0') + row(EN_ ? 'Music instruments: VSCO 2 CE · VCSL' : '배경음악 악기 녹음: VSCO 2 CE · VCSL', 'CC0 · Versilian Studios') + '</table>';
  h += `<div class="note">${EN_ ? 'Speeds, sizes and handling approximate public specifications. Map data: National Geographic Information Institute (NGII), Korea.' : '속도·크기·조종 특성은 공개 제원 수준의 근사값입니다. 지도 자료 출처: 국토교통부 국토지리정보원.'}</div>`;
  return h;
}
$('bCred').onclick = () => { $('credBody').innerHTML = credHTML(); $('credPanel').classList.remove('hidden'); };
$('credClose').onclick = () => $('credPanel').classList.add('hidden');
// 화면 아래 작은 출처 (현장 자료가 있을 때)
(function () { const el = $('attrib'); if (!el) return; el.textContent = SITE.credits ? (EN_ ? 'Map data © NGII Korea · 1:5,000 topo map · orthoimage 2025 · Copernicus DEM GLO-30' : '지도 자료 © 국토지리정보원 · 수치지형도 1:5,000 · 정사영상 2025 · Copernicus DEM GLO-30') : ''; })();

document.querySelectorAll('#segRadioLang button').forEach(b => { b.classList.toggle('on', b.dataset.v === (SET.radioLang || 'en')); b.addEventListener('click', () => { SET.radioLang = b.dataset.v; saveSet(); COMM.koWarn = false; document.querySelectorAll('#segRadioLang button').forEach(x => x.classList.toggle('on', x === b)); }); });
if (window.SIM_LANG === 'en' && $('segRadioLang')) $('segRadioLang').style.display = 'none';
document.querySelectorAll('#segVoice button').forEach(b => { b.classList.toggle('on', (b.dataset.v === '1') === (SET.voice !== false)); b.addEventListener('click', () => { SET.voice = b.dataset.v === '1'; saveSet(); document.querySelectorAll('#segVoice button').forEach(x => x.classList.toggle('on', x === b)); if (!SET.voice) try { speechSynthesis.cancel(); } catch (e) { } }); });

// =====================================================================
//  시작 화면: 격납고(기체 회전 미리 보기) · 임무 트리맵 · 임무 현장 미리 보기
// =====================================================================
const MENU = { ms: 'course', cf: null, cR: 60, cH: 20, a: 0, ri: 0, tt: 0, models: {}, dbl: 0 };
try { const v = localStorage.getItem('fpvsim_menu_ms'); if (v) MENU.ms = v; } catch (e) { }
const MS_CAT = { course: 'train', forest: 'train', race: 'train', ridge: 'train', field: 'train', tutorial: 'train', free: 'train', demo: 'train', recon: 'recon', track: 'recon', fire: 'rescue', sar: 'rescue', strike: 'strike' };
const CAT_C = { train: '#4fe3ff', recon: '#5dff9a', rescue: '#ffaa4d', strike: '#ff5d5d' };
const AF_C = { quad: '#5aa9ff', fpv: '#b48cff', wing: '#4fe3c0', kam: '#ff6a5d' };
const CAT_N = () => ({ train: L2('비행 훈련', 'FLIGHT TRAINING'), recon: L2('정찰·감시', 'RECON · SURVEILLANCE'), rescue: L2('재난·구조', 'DISASTER · RESCUE'), strike: L2('타격', 'STRIKE'), exam: L2('자격 시험 연습', 'LICENCE PRACTICE') });
const MDESC = () => ({
  course: [L2('장애물 코스', 'Obstacle course'), L2('게이트 · 슬라롬 · 벙커 · 정찰 · 투하 · 정밀 착륙까지 이어지는 기본 훈련 코스.', 'The core course: gates, slalom, bunker, recon, payload drops and a precision landing.'), L2('입문 난이도와 가이드로 익힌 뒤 스포츠에서 기록 단축.', 'Learn it on Training with the guide on, then chase your time on Sport.')],
  tutorial: [L2('튜토리얼', 'Tutorial'), L2('장애물 하나씩 설명을 보고 연습. 처음이라면 여기부터.', 'Practice one obstacle at a time with explanations. Start here if you are new.'), L2('정찰 쿼드(X2D)로만 진행.', 'Flown with the recon quad (X2D) only.')],
  free: [L2('자유 비행', 'Free flight'), L2('시간·목표 없이 지형과 기체를 익히는 비행.', 'No timer, no objectives: get to know the terrain and the airframe.'), L2('모든 기체 사용 가능. 열화상(T)·밤·바람도 시험해 보기.', 'Every airframe allowed. Try thermal (T), night and wind.')],
  demo: [L2('기준 비행 보기', 'Reference flight'), L2('장애물 코스를 모범 비행으로 자동 재생.', 'Watch an automatic reference run through the obstacle course.'), L2('경로와 고도를 눈에 익혀 두기.', 'Memorize the line and the altitudes.')]
});
function msInfo(k) { const b = BRIEF[k] || MDESC()[k] || [k, '', '']; return { t: b[0], d: b[1], tip: b[2] }; }
function msAvail(k) {
  const HAS = { forest: !!FLANE, race: RACE.length > 0, recon: RECON.length > 0, strike: STRIKE.length > 0, fire: FIRE.length > 0, sar: !!SAR, track: !!TRACK, ridge: !!RIDGE, field: !!RWY };
  const site = HAS[k] !== false, af = (MS_OK[k] || []).includes(SET.af), wx = !(k === 'fire' && (SET.wx === 'rain' || SET.wx === 'snow'));   // 비·눈 오는 날은 산불 감시 없음
  return { ok: site && af && wx, site, af, wx, why: !site ? L2('이 훈련장에는 없는 임무', 'Not available at this site') : !wx ? L2('비·눈 오는 날에는 산불 감시를 하지 않습니다 · 날씨를 맑음으로', 'No wildfire watch in rain or snow · set the weather to clear') : !af ? L2('선택한 기체로는 할 수 없는 임무 · 아래 추천 기체를 고르세요', 'Not possible with this airframe · pick a recommended one below') : '' };
}
function afCat(a) { return a.kam ? 'kam' : a.cls === 'wing' ? 'wing' : a.id === 'fpv' ? 'fpv' : 'quad'; }
// RPG 식 능력치 (공개 제원 근사값을 0~1 로)
function afStats(a) {
  const e = typeof a.endur === 'string' ? parseFloat(a.endur.split('~').pop()) : a.endur, top = a.top * 3.6;
  const agi = a.cls === 'wing' ? a.rrate / 230 : clamp(a.yaw / 330 * 0.5 + a.tw / 3.6 * 0.5, 0, 1);
  const stb = a.cls === 'wing' ? clamp(0.4 + a.span * 0.17, 0, 1) : clamp(1 - (a.tilt.sport - 38) / 55, 0.2, 1);
  return [
    [L2('속도', 'SPD'), top / 160, Math.round(top) + ' km/h'],
    [L2('체공', 'END'), Math.log(e) / Math.log(210), (typeof a.endur === 'string' ? a.endur : e) + L2('분', ' min')],
    [L2('기동', 'AGI'), agi, a.cls === 'wing' ? L2('선회', 'bank ') + a.bank + '°' : a.yaw + '°/s'],
    [L2('안정', 'STB'), stb, a.cls === 'wing' ? L2('실속 ', 'stall ') + Math.round(a.stall * 3.6) : L2('기울기 ', 'tilt ') + a.tilt.sport + '°'],
    [L2('센서', 'SNS'), (a.reconD || 260) / 600, (a.reconD || 260) + ' m']
  ];
}
function afTags(a) {
  const t = [];
  if (a.cls === 'wing') t.push(L2('정지 불가', 'No hover')); else t.push(L2('정지 비행', 'Hover'));
  if (a.drop) t.push(L2('투하 장치', 'Payload drop'));
  if (a.acro) t.push('Acro');
  if (a.id === 'anafi') t.push(L2('32배 줌', '32× zoom'));
  if (a.id === 'puma' || a.id === 'fw') t.push(L2('손 투척', 'Hand launch'));
  if (a.kam) t.push(L2('탄두 · 1회용', 'Warhead · expendable'));
  return t;
}
function menuAfPanel() {
  const a = AFc(), cat = afCat(a), col = AF_C[cat];
  const catN = { quad: L2('정찰 쿼드', 'RECON QUAD'), fpv: 'FPV', wing: L2('고정익', 'FIXED-WING'), kam: L2('자폭', 'LOITERING') }[cat];
  const w = document.querySelector('.afStageW'); if (w) w.style.setProperty('--cc', col);
  const inf = $('afInfo'); if (inf) inf.innerHTML = `<i class="cat">${catN}</i><b>${a.name}</b><small>${a.sub}</small><div class="tags">${afTags(a).map(x => `<span>${x}</span>`).join('')}</div>`;
  const st = $('afStats'); if (st) { st.style.setProperty('--cc', col); st.innerHTML = afStats(a).map(r => `<span class="k">${r[0]}</span><span class="sbar"><i style="width:${Math.round(clamp(r[1], 0.04, 1) * 100)}%"></i></span><span class="v">${r[2]}</span>`).join('') + `<span class="note2">${a.note}</span>`; }
}
function menuBest(k) {
  let key = k === 'course' ? 'fpvsim_fpv_best_' + SET.diff + SITE_KEY : isMission(k) ? 'fpvsim_ms_best_' + k + '_' + SET.af + '_' + SET.diff + SITE_KEY : null, b = null;
  if (key) try { b = parseFloat(localStorage.getItem(key)); } catch (e) { }
  return b > 0 ? b : null;
}
function menuDetail() {
  const k = MENU.ms, cat = MS_CAT[k] || 'train', inf = msInfo(k), av = msAvail(k), col = CAT_C[cat];
  document.querySelectorAll('#msGrid [data-ms]').forEach(b => b.classList.toggle('sel', b.dataset.ms === k));
  const box = $('msDetail'); if (!box) return; box.style.setProperty('--cc', col);
  document.querySelector('.msStageW').style.setProperty('--cc', col);
  $('mdCat').textContent = CAT_N()[cat]; $('mdTitle').textContent = inf.t; $('mdDesc').textContent = inf.d; $('mdTip').textContent = inf.tip;
  const ok = MS_OK[k] || [];
  $('mdAf').innerHTML = `<button class="on" data-af="${SET.af}">${AFc().name}</button><button class="mini" id="mdAfChg">${L2('기체 바꾸기 ◀', 'Change airframe ◀')}</button>`;
  { const c = $('mdAfChg'); if (c) c.onclick = () => wizGo(2); }
  const best = menuBest(k), meta = [];
  if (isMission(k)) meta.push(L2('기준 ', 'Par ') + fmt(msPar(k, [1, 2, 3, 4])));
  if (best) meta.push(L2('내 최고 ', 'Best ') + `<b>${fmt(best)}</b>`);
  meta.push(AFc().name + ' · ' + { train: L2('입문', 'Training'), easy: L2('쉬움', 'Easy'), sport: L2('스포츠', 'Sport') }[SET.diff]);
  $('mdMeta').innerHTML = meta.join(' · ');
  $('msGo').disabled = !av.ok; $('msGo').textContent = MENU.mode === 'vr' ? (k === 'demo' ? L2('VR로 재생 ▶ (헤드셋 착용)', 'Play in VR ▶') : L2('VR로 출격 ▶ (헤드셋 착용)', 'Launch in VR ▶ (put on the headset)')) : k === 'tutorial' ? L2('단계 고르기 ▶', 'Choose a step ▶') : k === 'demo' ? L2('재생 ▶', 'Play ▶') : L2('출격 ▶', 'Launch ▶');
  $('mdWhy').textContent = av.why || MENU.afNote || '';
  { const f = $('msGoF'); if (f) { f.disabled = !av.ok; f.textContent = $('msGo').textContent; } } msGoFSync();
  if (typeof vrBtnUpdate === 'function' && VR_OK) vrBtnUpdate();
  const no = $('msStageNo'); if (no) { no.classList.toggle('on', !av.site); no.textContent = av.site ? '' : L2('이 훈련장에는 없는 임무입니다', 'This mission is not available at this site'); }
  menuShow(k);
}
// 임무 종류 탭: 고른 종류의 임무만 보여 줌 (이 훈련장에 없는 임무는 숨김)
const MS_GRP = ['basic'].concat(document.querySelector('#msTabs [data-g="exam"]') ? ['exam'] : []).concat(['skill', 'mission']);
function msTile(k) { return document.querySelector(`#msGrid [data-ms="${k}"]`); }
// 바닥 고정 출격 버튼: 미리보기의 출격 버튼이 화면 밖(아래)에 있을 때만
function msGoFSync() { const f = $('msGoF'), g = $('msGo'); if (!f || !g) return; const r = g.getBoundingClientRect(); f.classList.toggle('hidden', !(MENU.step === 3) || (r.bottom > 0 && r.bottom <= innerHeight - 56)); }
addEventListener('resize', msGoFSync); { const pn = $('menu'); if (pn) pn.addEventListener('scroll', msGoFSync, { passive: true }); }
function msVis() {
  const g = MENU.g || 'basic';
  // 타일에 내 최고 기록 · 추천 순서 번호
  document.querySelectorAll(`#msGrid [data-g]`).forEach(b => { const k = b.dataset.ms, best = (k === 'course' || isMission(k)) ? menuBest(k) : null; let e = b.querySelector('.best'); if (best) { if (!e) { e = document.createElement('span'); e.className = 'best'; b.appendChild(e); } e.textContent = '★ ' + fmt(best); } else if (e) e.remove(); });
  ['basic', 'exam', 'skill', 'mission'].forEach(gg => { let i = 0; document.querySelectorAll(`#msGrid [data-g="${gg}"]`).forEach(b => { if (b.dataset.site === '0' || b.dataset.ms === 'free' || b.dataset.ms === 'demo' || b.querySelector('.rec')) return; i++; let e = b.querySelector('.ord'); if (!e) { e = document.createElement('span'); e.className = 'ord'; b.appendChild(e); } e.textContent = L2('추천 ', 'step ') + i; }); });
  document.querySelectorAll('#msGrid [data-ms]').forEach(b => b.classList.toggle('hid', b.dataset.g !== g || b.dataset.site === '0' || !msAfOk(b.dataset.ms)));
  document.querySelectorAll('#msTabs [data-g]').forEach(b => { b.classList.toggle('on', b.dataset.g === g); b.classList.toggle('hid', !msInGrp(b.dataset.g).length); });   // 고른 기체로 할 수 있는 임무가 없는 종류는 탭도 숨김
}
// 기체는 2단계에서 고르고, 3단계는 그 기체로 할 수 있는 임무만 보여 줌 (임무에 맞춰 기체를 바꾸지 않음)
function msAfOk(k) { const ok = MS_OK[k]; return !ok || !ok.length || ok.includes(SET.af); }
function msInGrp(g) { return [...document.querySelectorAll(`#msGrid [data-g="${g}"]`)].filter(b => b.dataset.site !== '0' && msAfOk(b.dataset.ms)).map(b => b.dataset.ms); }
function menuTab(g) {
  const L = msInGrp(g); if (!L.length) return;
  const last = (MENU.lastIn || {})[g]; menuSel(L.includes(last) ? last : L[0]);
}
function menuSel(k, go) {
  let t = msTile(k); if (!t || t.dataset.site === '0' || !msAfOk(k)) {   // 이 기체로 못 하는 임무면 같은 종류 → 전체에서 할 수 있는 첫 임무로
    const g0 = t ? t.dataset.g : 'basic', L = msInGrp(g0).length ? msInGrp(g0) : MS_GRP.flatMap(msInGrp); k = L[0] || 'free'; t = msTile(k);
  }
  MENU.ms = k; MENU.g = msTile(k).dataset.g; (MENU.lastIn = MENU.lastIn || {})[MENU.g] = k;
  try { localStorage.setItem('fpvsim_menu_ms', k); } catch (e) { }
  MENU.afNote = '';
  MENU.prevMs = k; msVis(); menuDetail(); if (go) menuGo();
}
document.querySelectorAll('#msTabs [data-g]').forEach(b => b.addEventListener('click', () => menuTab(b.dataset.g)));
function menuGo() {
  const k = MENU.ms; if (!msAvail(k).ok) return; MENU.fromPreview = true;   // 미리보기에서 읽고 왔으니 브리핑은 짧게
  if (MENU.mode === 'vr') { if (k === 'tutorial') { const w = $('mdWhy'); if (w) w.textContent = L2('튜토리얼은 컴퓨터 판에서만 · VR에서는 장애물 코스부터', 'Tutorial is on the computer version only'); return; } if (!VR_OK.ok) { const w = $('mdWhy'); if (w) w.textContent = L2('이 기기는 VR을 지원하지 않습니다', 'This device does not support VR'); return; } XR.pending = k; vrStart(); return; }
  if (k === 'tutorial') openTutMenu(); else startRun(k);
}
document.querySelectorAll('#msGrid [data-ms]').forEach(b => {
  b.addEventListener('click', () => { const now = performance.now(), again = MENU.ms === b.dataset.ms && now - MENU.dbl < 450; MENU.dbl = now; if (again) menuGo(); else menuSel(b.dataset.ms); });
});
$('msGo').onclick = menuGo; if ($('msGoF')) $('msGoF').onclick = menuGo;   // 바닥에 떠 있는 출격 버튼도 같은 동작
if ($('bPauseOpt')) $('bPauseOpt').onclick = () => openPanel('optPanel');
if ($('bPauseCtl')) $('bPauseCtl').onclick = () => { openPanel('ctlPanel'); try { kbHelp(); } catch (e) { } };
setInterval(() => { const w = $('pauseWho'); if (w && S.state === 'pause') { const lk = S.lastKind || S.kind; w.textContent = L2('현재 임무: ', 'Mission: ') + (MS_NAME[lk] || ({ course: L2('장애물 코스', 'Obstacle course'), free: L2('자유 비행', 'Free flight'), tutorial: L2('튜토리얼', 'Tutorial'), demo: L2('기준 비행', 'Reference flight') })[lk] || lk) + ' · ' + AFc().name + ' · ' + pilotName(); } }, 400);
// ---- 첫 화면 3단계: 1 조종사 이름 → 2 기체 → 3 코스 (각 단계 뒤로 가기) ----
MENU.step = 0; MENU.mode = window.SIM_VR ? 'vr' : 'pc';
try { SET.pilot = localStorage.getItem('fpvsim_pilot') || ''; } catch (e) { SET.pilot = ''; }
function pilotName() { return SET.pilot || L2('조종사', 'Pilot'); }
function wizGo(n) {
  n = Math.max(1, Math.min(3, n | 0)); const c = $('menuCard'); if (!c) return;   // 컴퓨터·VR 갈림길(0단계)은 쓰지 않음 — 주소가 알아서 나눔
  if (MENU.step === 1 && n > 1) { const v = ($('pilotName').value || '').trim().slice(0, 16), bad = typeof pilotNameBad === 'function' ? pilotNameBad(v) : '';
    if (bad) { const h = document.querySelector('#menuCard .s1 .wzhint'); if (h) { if (!h.dataset.t) h.dataset.t = h.textContent; h.textContent = bad; h.classList.add('bad'); } try { $('pilotName').focus(); } catch (e) { } return; }
    SET.pilot = v; try { localStorage.setItem('fpvsim_pilot', v); } catch (e) { } }
  MENU.step = n; c.dataset.step = n; closePanels(); setTimeout(msGoFSync, 0);
  if (n === 1) { const i = $('pilotName'); i.value = SET.pilot || ''; pilotSetUI(); if (!IS_TOUCH) setTimeout(() => { try { i.focus(); i.select(); } catch (e) { } }, 30); }
  if (n === 2) { afUI(); }
  if (n === 3 && typeof isC1 === 'function') { if (SET.af === 'c1' && !isC1(MENU.ms)) MENU.ms = 'class1'; else if (SET.af !== 'c1' && isC1(MENU.ms)) MENU.ms = 'course'; }   // 1종 연습기 → 1종 코스로
  if (n === 3) { menuSel(MENU.ms); const w = $('wzWho'); if (w) w.textContent = `${pilotName()} · ${AFc().name}`; totFlyUI(); const g = $('msGo'); if (g) g.textContent = MENU.mode === 'vr' ? L2('VR로 출격 ▶ (헤드셋 착용)', 'Launch in VR ▶ (put on the headset)') : L2('출격 ▶', 'Launch ▶'); }
  try { window.dispatchEvent(new Event('resize')); } catch (e) { }
  if (ui.menu) ui.menu.scrollTop = 0;
}
if ($('pilotName')) { $('pilotName').value = SET.pilot || ''; $('pilotName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); wizGo(2); } });
  $('pilotName').addEventListener('input', () => { const h = document.querySelector('#menuCard .s1 .wzhint'); if (h && h.dataset.t) { h.textContent = h.dataset.t; h.classList.remove('bad'); } }); }
[['wz1Next', 2], ['wz2Back', 1], ['wz2Next', 3], ['wz3Back', 2]].forEach(([id, n]) => { if ($(id)) $(id).onclick = () => wizGo(n); });
if ($('bOpt')) $('bOpt').onclick = () => openPanel('optPanel');
if ($('bCtl')) $('bCtl').onclick = () => { openPanel('ctlPanel'); try { kbHelp(); } catch (e) { } };
if ($('optClose')) $('optClose').onclick = () => closePanels();
if ($('ctlClose')) $('ctlClose').onclick = () => closePanels();
if ($('bHelp2')) $('bHelp2').onclick = () => openPanel('helpPanel');
if ($('bRC2')) $('bRC2').onclick = () => { closePanels(); rcOpen(); };
if ($('wzVR')) $('wzVR').onclick = () => { if (window.SIM_VR_URL) location.href = window.SIM_VR_URL + (window.SIM_LANG === 'en' ? 'en.html' : ''); };
setInterval(() => { const a = $('padStatus'), b = $('padStatus2'); if (a && b) b.textContent = a.textContent; }, 1000);
setTimeout(() => wizGo(1), 0);   // 컴퓨터·VR 은 주소가 알아서 나눔 (VR 헤드셋 브라우저 → VR 판 · 다른 기기 → PC 판, build.py) · 고르는 첫 화면은 ◀ 처음 으로
// ---- 1단계 비행 설정: 비행 난이도 묶음 · 조종기 모드 · 화면 구성(이 기기: PC·휴대폰·VR) — 고른 값이 그대로 기본 설정으로 저장됨 ----
const FLY_PRE = [
  { id: 'train', ic: '🐣', n: ['입문', 'Beginner'], d: ['놓으면 멈춤 · 느리게 · 자동 방향', 'Stops when released · slow · auto heading'], set: { mode: 'gps', assistLv: 2, feel: 'train', expo: 'soft' } },
  { id: 'easy', ic: '🎯', n: ['표준', 'Standard'], d: ['고도 유지 · 약한 보조', 'Holds altitude · light assistance'], set: { mode: 'gps', assistLv: 1, feel: 'std', expo: 'soft' } },
  { id: 'atti', ic: '🧭', n: ['ATTI', 'ATTI'], d: ['자세만 잡음 · 바람에 밀림 · 1종 실기 감각', 'Attitude only · drifts with wind · class-1 exam feel'], set: { mode: 'atti', assistLv: 0, feel: 'real', expo: 'real' } },
  { id: 'sport', ic: '🏁', n: ['스포츠', 'Sport'], d: ['보조 없음 · 제원 그대로 (FPV는 옵션에서 ACRO)', 'No assistance · full performance (ACRO for FPV in options)'], set: { mode: 'man', assistLv: 0, feel: 'real', expo: 'real' } }];
// 화면 구성 견본: 창 자리(LY) + 계기 종류(SET.hud) · VR 은 화면 방식·하부 카메라·계기 · pv = 미리보기 상자 [종류, x%, y%, 너비%, 높이%]
const LY_PRE = {
  pc: [
    { id: 'std', n: ['기본', 'Standard'], d: ['모든 창 · 기본 자리', 'All panels in their usual places'], ly: {}, hud: 'auto', pv: [['osd', 2, 4, 17, 24], ['nx', 38, 3, 24, 7], ['ls', 79, 4, 19, 44], ['mp', 84, 58, 14, 38], ['rd', 35, 72, 30, 9], ['st', 2, 78, 12, 18]] },
    { id: 'clean', n: ['넓은 시야', 'Clear view'], d: ['과제 목록 숨김 · 창 작게', 'Task list hidden · smaller panels'], ly: { list: { h: true }, osd: { s: 0.86, l: 16, t: 14 }, map: { s: 0.8, r: 14, b: 14 } }, hud: 'auto', pv: [['osd', 2, 4, 14, 19], ['nx', 38, 3, 24, 7], ['mp', 87, 68, 11, 28], ['rd', 35, 72, 30, 9]] },
    { id: 'big', n: ['큰 글씨', 'Large text'], d: ['비행 정보·과제 목록 크게', 'Larger flight data and task list'], ly: { osd: { s: 1.3, l: 16, t: 14 }, list: { s: 1.1, r: 14, t: 14 } }, hud: 'auto', pv: [['osd', 2, 4, 24, 34], ['nx', 38, 3, 24, 7], ['ls', 76, 4, 22, 48], ['mp', 84, 58, 14, 38], ['rd', 35, 72, 30, 9]] },
    { id: 'uas', n: ['계기 비행', 'Instruments'], d: ['항공 계기 · 속도·고도 테이프 · 방위계', 'Aviation HUD · speed/altitude tapes · HSI'], ly: {}, hud: 'uas', pv: [['nx', 38, 3, 24, 7], ['tp', 21, 24, 5, 42], ['tp', 74, 24, 5, 42], ['ld', 40, 30, 20, 24], ['hs', 42, 60, 16, 30], ['mp', 84, 58, 14, 38]] }],
  mobile: [
    { id: 'std', n: ['기본', 'Standard'], d: ['버튼 10개 · 두 줄', 'Ten buttons in two rows'], ly: {}, hud: 'auto', pv: [['osd', 3, 3, 14, 22], ['nx', 25, 3, 24, 8], ['mp', 3, 32, 8, 26], ...[90, 84, 78, 72, 66].map(x => ['b', x, 4]), ...[90, 84, 78, 72, 66].map(x => ['b', x, 17]), ['bd', 88, 33], ['bb', 79, 37], ['sz', 6, 60, 26, 36], ['sz', 68, 60, 26, 36]] },
    { id: 'simple', n: ['간단', 'Simple'], d: ['자주 쓰는 버튼만 · 화면 넓게', 'Only the buttons you use most'], ly: { tbLight: { h: true }, tbIR: { h: true }, tbBelly: { h: true }, tbZoom: { h: true }, tbAssist: { h: true }, tbHud: { r: 174, t: 10 }, tbGuide: { r: 120, t: 10 }, tbFull: { r: 66, t: 10 }, tbPause: { r: 12, t: 10 }, tbCam: { r: 12, t: 64 } }, hud: 'auto',
      pv: [['osd', 3, 3, 14, 22], ['nx', 25, 3, 24, 8], ['mp', 3, 32, 8, 26], ...[90, 84, 78, 72].map(x => ['b', x, 4]), ['b', 90, 17], ['bd', 88, 33], ['bb', 79, 37], ['sz', 6, 60, 26, 36], ['sz', 68, 60, 26, 36]] },
    { id: 'big', n: ['큰 버튼', 'Big buttons'], d: ['버튼 크게 · 누르기 쉽게', 'Larger buttons, easier to hit'], ly: { tbHud: { r: 260, t: 10, s: 1.2 }, tbGuide: { r: 198, t: 10, s: 1.2 }, tbAssist: { r: 136, t: 10, s: 1.2 }, tbFull: { r: 74, t: 10, s: 1.2 }, tbPause: { r: 12, t: 10, s: 1.2 }, tbLight: { r: 260, t: 74, s: 1.2 }, tbIR: { r: 198, t: 74, s: 1.2 }, tbCam: { r: 136, t: 74, s: 1.2 }, tbBelly: { r: 74, t: 74, s: 1.2 }, tbZoom: { r: 12, t: 74, s: 1.2 }, tbDrop: { r: 12, t: 146, s: 1.15 }, tbBoost: { r: 112, t: 156, s: 1.15 }, tbReset: { r: 186, t: 164, h: true } }, hud: 'auto',
      pv: [['osd', 3, 3, 14, 22], ['nx', 25, 3, 22, 8], ['mp', 3, 32, 8, 26], ...[89, 82, 75, 68, 61].map(x => ['B', x, 3]), ...[89, 82, 75, 68, 61].map(x => ['B', x, 19]), ['bd', 87, 37], ['bb', 77, 41], ['sz', 6, 60, 26, 36], ['sz', 68, 64, 26, 32]] }],
  vr: [
    { id: 'space', n: ['공간 화면', 'Fixed screen'], d: ['큰 화면이 앞에 고정 · 멀미 적음', 'A big screen fixed in front · less motion sickness'], set: { vrScreen: 'space', vrPip: 0, vrMap: true, hud: 'auto' }, pv: [['scr', 20, 18, 60, 52], ['mp', 64, 46, 10, 20]] },
    { id: 'head', n: ['고글 화면', 'Goggles'], d: ['FPV 고글처럼 시야 가득', 'Fills your view like FPV goggles'], set: { vrScreen: 'head', vrPip: 0, vrMap: true, hud: 'auto' }, pv: [['scr', 3, 5, 94, 90], ['mp', 80, 58, 14, 32]] },
    { id: 'inst', n: ['계기 비행', 'Instruments'], d: ['항공 계기 + 하부 카메라 60°', 'Aviation HUD + 60° lower camera'], set: { vrScreen: 'space', vrPip: 60, vrMap: true, hud: 'uas' }, pv: [['scr', 20, 18, 60, 52], ['hs', 44, 46, 12, 20], ['pip', 23, 50, 12, 14], ['mp', 64, 46, 10, 20]] }] };
function pilotDev() { return window.SIM_VR ? 'vr' : IS_TOUCH ? 'mobile' : 'pc'; }
function flyPreCur() { return FLY_PRE.find(p => (SET.mode === p.set.mode || (p.id === 'sport' && SET.mode === 'acro')) && SET.assistLv === p.set.assistLv && SET.feel === p.set.feel) || null; }
function lyPreCur(dev) {
  const L = LY_PRE[dev];
  if (dev === 'vr') return L.find(p => (SET.vrScreen || 'space') === p.set.vrScreen && (SET.vrPip | 0) === p.set.vrPip && (SET.hud || 'auto') === p.set.hud) || null;
  const own = Object.keys(LY.d).filter(k => !k.startsWith('__'));
  const p = LY.d.__p ? L.find(x => x.id === LY.d.__p) : !own.length ? L[0] : null;
  return p && (p.hud || 'auto') === (SET.hud || 'auto') ? p : null;
}
function pvHTML(spec, vr) { return `<span class="pv${vr ? ' vr' : ''}">` + spec.map(([k, x, y, w, h]) => `<i class="k-${k}" style="left:${x}%;top:${y}%${w ? `;width:${w}%;height:${h}%` : ''}"></i>`).join('') + '</span>'; }
function pilotSetUI() {
  const box = $('pilotSet'); if (!box) return;
  const dev = pilotDev(), fp = flyPreCur(), lp = lyPreCur(dev), nm = a => L2(a[0], a[1]);
  const navN = id => { const v = glUserLv() != null ? glUserLv() : glDefFor(id); return L2('안내 ', 'Nav ') + L2(GL_NM[v][0], GL_NM[v][1]); };
  const modeN = { gps: 'GPS', atti: 'ATTI', man: L2('수동', 'Manual'), acro: 'ACRO' }, asN = { 2: L2('보조 전체', 'Full assist'), 1: L2('보조 약하게', 'Light assist'), 0: L2('보조 끔', 'No assist') };
  const vrm = window.SIM_VR, sm = vrm ? (SET.vrMode || 1) : stickMode();
  const devN = { pc: L2('이 기기: 컴퓨터', 'This device: computer'), mobile: L2('이 기기: 휴대폰·태블릿', 'This device: phone/tablet'), vr: L2('이 기기: VR (Quest)', 'This device: VR (Quest)') }[dev];
  box.innerHTML = `<div class="psg g-fly"><div class="pslbl">${L2('비행 난이도', 'Flight style')} <small>${L2('고른 값이 기본 설정이 됩니다 · 세부 조정은 ⚙ 옵션', 'Becomes your default · fine-tune in ⚙ Options')}</small></div>` +
    `<div class="pscards fly">${FLY_PRE.map(p => `<button class="pcd${fp === p ? ' on' : ''}" data-f="${p.id}"><i class="ic">${p.ic}</i><b>${nm(p.n)}</b><small>${nm(p.d)}</small><span class="chips"><em>${modeN[p.set.mode]}</em><em>${asN[p.set.assistLv]}</em><em>${navN(p.id)}</em></span></button>`).join('')}</div>` +
    (fp ? '' : `<p class="psnote">${L2('지금은 옵션에서 직접 맞춘 설정입니다', 'Currently using your own settings from Options')}</p>`) + `</div>` +
    `<div class="psg g-stick"><div class="pslbl">${L2('조종기 모드', 'Stick mode')} <small>${vrm ? L2('Quest 컨트롤러 (쿼드)', 'Quest controllers (quad)') : L2('휴대폰 터치 · 게임패드 (RC 조종기는 조종기 설정을 따름)', 'Touch and gamepad (RC transmitters follow their own setup)')}</small></div>` +
    `<div class="psseg">${[[2, L2('모드 2', 'Mode 2'), L2('왼쪽 스틱: 상승·회전 / 오른쪽: 전진·좌우', 'Left: climb·yaw / right: fwd·strafe')], [1, L2('모드 1', 'Mode 1'), L2('왼쪽 스틱: 전진·회전 / 오른쪽: 상승·좌우', 'Left: fwd·yaw / right: climb·strafe')]].concat(vrm ? [[3, L2('머리 방향', 'Head steer'), L2('보는 쪽으로 비행', 'Fly where you look')]] : []).map(([v, a, b]) => `<button data-s="${v}" class="${sm === v ? 'on' : ''}"><b>${a}</b><small>${b}</small></button>`).join('')}</div></div>` +
    `<div class="psg g-nav"><div class="pslbl">${L2('안내 방식', 'Nav aids')} <small>${L2('목표 표시와 비행 가이드 · 저장됨 · 비행 중 GD 로 잠깐 바꿈', 'Target markers and guidance · saved · GD in flight changes it for one sortie')}</small></div>` +
    `<div class="psseg nav">${[['a', L2('자동', 'Auto'), L2('난이도별', 'by flight style')], ['3', L2('가이드', 'Guide'), L2('목표 + 경로·조작 안내', 'markers + path and hints')], ['2', L2('목표', 'Target'), L2('◇·빛기둥만', 'markers only')], ['1', L2('지도', 'Map'), L2('지도·방위 띠·무전', 'map, heading tape, radio')], ['0', L2('무전', 'Radio'), L2('무전 방위만', 'radio bearings only')], ['4', L2('내 설정 ✎', 'Custom ✎'), L2('하나씩 고르기', 'pick each')]].map(([v, n, d]) => `<button data-n="${v}" class="${(glUserLv() == null ? 'a' : String(glUserLv())) === v ? 'on' : ''}"><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>` +
    `<div class="psg g-ly"><div class="pslbl">${L2('화면 구성', 'Screen layout')} <small>${devN}</small></div>` +
    `<div class="pscards ly">${LY_PRE[dev].map(p => `<button class="pcd${lp === p ? ' on' : ''}" data-l="${p.id}">${pvHTML(p.pv, dev === 'vr')}<b>${nm(p.n)}</b><small>${nm(p.d)}</small></button>`).join('')}` +
    (dev === 'vr' ? '' : `<button class="pcd ed${lp ? '' : ' on'}" data-l="edit"><span class="pv ed"><i>✎</i></span><b>${L2('직접 배치', 'Arrange')}</b><small>${L2('창·버튼을 끌어서 옮기고 크기 조절', 'Drag panels and buttons, resize or hide')}</small></button>`) + `</div></div>` +
    `<div class="psg g-foot psfoot"><button id="psOpt">⚙ ${L2('모든 옵션', 'All options')}</button></div>`;
  box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { const p = FLY_PRE.find(x => x.id === b.dataset.f); Object.assign(SET, p.set); if (RATE_PRESET[p.set.feel]) { SET.rates = ratePreset(p.set.feel, 'p'); SET.ratesY = ratePreset(p.set.feel, 'y'); } modeChanged(); try { syncExpo(); } catch (e) { } pilotSetUI(); });
  box.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const v = +b.dataset.s; if (vrm) SET.vrMode = v; else { SET.stick = v; stickApply(); } saveSet(); pilotSetUI(); });
  box.querySelectorAll('[data-l]').forEach(b => b.onclick = () => {
    const id = b.dataset.l; if (id === 'edit') { lyEditMenu(); return; }
    const p = LY_PRE[dev].find(x => x.id === id);
    if (dev === 'vr') Object.assign(SET, p.set);
    else { LY.d = Object.assign({ __v3: 1, __p: p.id }, JSON.parse(JSON.stringify(p.ly))); lySave(); lyApply(); SET.hud = p.hud; }
    saveSet(); try { syncHud(); } catch (e) { } pilotSetUI(); });
  const o = $('psOpt'); if (o) o.onclick = () => optOpen('fly');
  box.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { if (b.dataset.n === '4') { if (glUserLv() !== 4) glPref(4); navPanelOpen(); } else glPref(b.dataset.n); pilotSetUI(); });
}

// 첫 화면 비밀번호 (간단한 출입 확인용 · 이 기기에서 한 번 맞히면 기억)
// 입장 번호: 번호 자체는 코드에 두지 않고, 소금+SHA-256 1만2천 번 반복한 값만 둔다.
// 기억 값은 중간 단계(5천 번) 값이라 코드에 없는 값이고, 나머지를 돌려 확인한다.
function sha256hex(str) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const b = unescape(encodeURIComponent(str)), l = b.length, n = ((l + 9 + 63) >> 6) << 4, w = new Array(n).fill(0);
  for (let i = 0; i < l; i++) w[i >> 2] |= b.charCodeAt(i) << (24 - (i & 3) * 8);
  w[l >> 2] |= 0x80 << (24 - (l & 3) * 8); w[n - 1] = l * 8;
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]; const W = new Array(64);
  const r = (x, y) => (x >>> y) | (x << (32 - y));
  for (let o = 0; o < n; o += 16) {
    for (let i = 0; i < 64; i++) W[i] = i < 16 ? w[o + i] | 0 : (r(W[i-2],17) ^ r(W[i-2],19) ^ (W[i-2] >>> 10)) + W[i-7] + (r(W[i-15],7) ^ r(W[i-15],18) ^ (W[i-15] >>> 3)) + W[i-16] | 0;
    let [A, B, C, D, E, F, G, H] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = H + (r(E,6) ^ r(E,11) ^ r(E,25)) + ((E & F) ^ (~E & G)) + K[i] + W[i] | 0, t2 = (r(A,2) ^ r(A,13) ^ r(A,22)) + ((A & B) ^ (A & C) ^ (B & C)) | 0;
      H = G; G = F; F = E; E = D + t1 | 0; D = C; C = B; B = A; A = t1 + t2 | 0;
    }
    h = h.map((v, i) => v + [A, B, C, D, E, F, G, H][i] | 0);
  }
  return h.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
}
function pinStretch(x, from, to) { for (let i = from; i < to; i++) x = sha256hex('fpv~' + i + '~' + x); return x; }
(function pinGate() {
  const SALT = 'k7Qx2#range', MID = 5000, N = 12000, FIN = '667c6eac4841dacac28af88ce9febae877dcf0556f15edc5211601d0f51bb8eb', KEY = 'fpvsim_pin_ok', el = $('pinGate'); if (!el) return;
  if (window.__bootGate || window.SIM_GATE_OK) return;   // 공개판: 첫 화면(인트로 앞)에서 이미 물음 (template.html)
  const okMid = m => typeof m === 'string' && /^[0-9a-f]{64}$/.test(m) && pinStretch(m, MID, N) === FIN;
  let ok = false; try { ok = okMid(localStorage.getItem(KEY)); } catch (e) { }
  if (ok || window.SIM_UNLOCKED || /[?&]test/.test(location.search)) return;   // 암호로 잠근 파일은 이미 문구 암호를 거쳤으므로 다시 묻지 않음
  el.classList.remove('hidden'); let v = '';
  const dots = $('pinDots'), msg = $('pinMsg'), draw = () => [...dots.children].forEach((d, i) => d.classList.toggle('on', i < v.length));
  let wrong = 0, lockUntil = 0;
  const press = k => {
    if (performance.now() < lockUntil) return;
    if (k === 'del') v = v.slice(0, -1); else if (/^\d$/.test(k) && v.length < 4) v += k; draw();
    if (v.length !== 4) return;
    const mid = pinStretch(SALT + v, 0, MID);
    if (pinStretch(mid, MID, N) === FIN) { try { localStorage.setItem(KEY, mid); } catch (e) { } el.classList.add('hidden'); window.removeEventListener('keydown', kd, true); return; }
    wrong++; const wait = wrong >= 5 ? Math.min(30, 5 * (wrong - 4)) : 0; lockUntil = performance.now() + wait * 1000;
    msg.textContent = wait ? L2(`번호가 맞지 않습니다 · ${wait}초 뒤 다시`, `Wrong code · retry in ${wait}s`) : L2('번호가 맞지 않습니다', 'Wrong code');
    dots.classList.remove('bad'); void dots.offsetWidth; dots.classList.add('bad'); setTimeout(() => { v = ''; draw(); }, 350);
  };
  $('pinPad').querySelectorAll('button').forEach(b => b.addEventListener('click', () => press(b.dataset.k || b.textContent)));
  const kd = e => { if (el.classList.contains('hidden')) return; e.stopImmediatePropagation(); e.preventDefault(); if (/^Digit\d$|^Numpad\d$/.test(e.code)) press(e.code.slice(-1)); else if (e.key === 'Backspace') press('del'); };
  window.addEventListener('keydown', kd, true);
})();
if ($('vrPC') && window.SIM_BASE) $('vrPC').href = window.SIM_BASE + (window.SIM_LANG === 'en' ? 'en.html' : '') + '?pc';   // ?pc: 헤드셋에서 일부러 PC 판으로 (자동으로 VR 판에 되돌아가지 않게)
// 이어서 비행: 지난번 임무·기체가 있으면 1단계(조종사)에서 바로 출격 (컴퓨터 판 · 컴퓨터/VR 갈림길 화면은 없앰 — 주소가 알아서 나눔)
{ let lastMs = null; try { lastMs = localStorage.getItem('fpvsim_menu_ms'); } catch (e) { }
  const nx = $('wz1Next');
  if (nx && !$('wz1Cont') && !window.SIM_VR && lastMs && lastMs !== 'tutorial' && msTile(lastMs) && MS_NAME[lastMs] !== undefined && msAfOk(lastMs)) {
    const b = document.createElement('button'); b.id = 'wz1Cont'; b.className = 'wzcont'; b.title = `${MS_NAME[lastMs] || lastMs} · ${AFc().name}${SET.pilot ? ' · ' + SET.pilot : ''}`;
    b.textContent = '↻ ' + L2('이어서: ', 'Continue: ') + (MS_NAME[lastMs] || lastMs); b.onclick = () => { wizGo(3); menuSel(lastMs); if (msAvail(lastMs).ok) menuGo(); }; nx.parentNode.insertBefore(b, nx); } }

// ---- 임무 현장 미리 보기 (메뉴 뒤 카메라) ----
function menuShow(k) {
  if (typeof c1Menu === 'function') c1Menu(k);
  Object.values(MSG).forEach(g => g.visible = false);
  const a = AFc(), kw = a.cls === 'wing' ? 2.2 : 1;
  if (k === 'race' && RACE.length) { MSG.race.visible = true; RACE.forEach(r => { r.mesh.scale.setScalar(3.2 * kw); r.mesh.position.copy(W(r.q.d, r.q.s, clearAlt(r.q.d, r.q.s, a.cls === 'wing' ? r.alt * 0.8 + 30 : r.alt, 3.2 * kw))); }); }
  if (k === 'ridge' && RIDGE) { MSG.ridge.visible = true; RIDGE.list.forEach(r => { const c = W(r.q.d, r.q.s, clearAlt(r.q.d, r.q.s, a.cls === 'wing' ? 38 : 18, 6 * kw)); r.mesh.position.copy(c); r.mesh.scale.setScalar(6 * kw); r.mesh.lookAt(c.clone().add(r.n)); }); }
  if (k === 'fire' && FIRE.length) { MSG.fire.visible = true; FIRE.forEach((f, i) => { f.on = f.active = i < 3; f.g.visible = i < 3; f.g.scale.setScalar(1); }); }
  if (k === 'sar' && SAR) MSG.sar.visible = true;
  if (k === 'track' && TRACK) { MSG.track.visible = true; if (!(TRACK.s > 0)) TRACK.s = TRACK.total * 0.2; }
  if (k === 'strike' && STRIKE.length) { MSG.strike.visible = true; STRIKE.forEach(t => { t.dead = false; if (t.hull.userData.m0) t.hull.material = t.hull.userData.m0; t.g.visible = true; }); }
}
function menuPrev(k) {
  if (typeof isC1 === 'function' && isC1(k)) return { f: c1W(0, 22, 1.5), R: 36, h: 14, spd: 0.04 };
  const pd = CRS_C ? BY.pad_start.down : 60, ps = CRS_C ? BY.pad_start.side : 0, T = !!TER.h;
  const P = (d, s, y, R, h, spd) => ({ f: W(d, s, y), d, s, R, h, spd: spd || 0.06 });
  if (k === 'forest' && FLANE) { const c = FLANE.cps.find(c => c.k === 'a'), q = c ? c.q : FLANE.at(FLANE.total * 0.2); return P(q.d, q.s, 3, 16, 9, 0.05); }   // 첫 '기운 나무' 둘레 (예전 자리 20% 는 이제 장애물 없는 연못 위)
  if (k === 'race' && RACE.length) { const r = RACE[4]; return P(r.q.d, r.q.s, r.alt, 34, 8); }
  if (k === 'field' && RWY) { const c = RWY.at(0, RWY.sg * 18); return P(-c.z, c.x, 8, 75, 32, 0.05); }
  if (k === 'ridge' && RIDGE) { const t = RIDGE.list.find(c => c.top) || RIDGE.list[0]; return P(t.q.d, t.q.s, 15, 80, 30, 0.035); }
  if (k === 'recon' && RECON.length) { const r = RECON[MENU.ri % RECON.length]; return P(r.d, r.s, 6, 60, 34, 0.05); }
  if (k === 'fire' && FIRE.length) { const f = FIRE[0]; return P(f.d, f.s, 5, 50, 26, 0.05); }
  if (k === 'sar' && SAR) return P(SAR.d, SAR.s, 1, 20, 26, 0.07);
  if (k === 'strike' && STRIKE.length && PATHL) { const q = PATHL.at(235); return P(q.d, q.s, 2, 30, 22, 0.05); }
  if (k === 'track' && TRACK) return { f: TRACK.g.position.clone().add(new V3(0, 1, 0)), R: 34, h: 26, spd: 0.08, dyn: true };
  if (k === 'tutorial') return P(pd, ps, 1, 13, 5, 0.08);
  if (k === 'free') return P(pd, ps, 0, T ? 170 : 70, T ? 75 : 30, 0.025);
  return P(pd, ps, 0, T ? 48 : 38, T ? 24 : 16, k === 'demo' ? 0.09 : 0.05);
}
function menuCam(dt) {
  const pv = menuPrev(MENU.ms);
  if (MENU.ms === 'track' && TRACK && MSG.track.visible) {
    TRACK.s = (TRACK.s + 9 * dt) % Math.max(1, TRACK.total - 5); TRACK.v = 9; const vp = trackPose(TRACK.s); TRACK.g.position.copy(vp.p); TRACK.g.rotation.y = -vp.h; trackLights(dt, true);
    pv.f.copy(vp.p).add(new V3(0, 1, 0));
  }
  const k = 1 - Math.exp(-dt * 3.5);
  if (!MENU.cf) { MENU.cf = pv.f.clone(); MENU.cR = pv.R; MENU.cH = pv.h; }
  MENU.cf.lerp(pv.f, pv.dyn ? 1 - Math.exp(-dt * 8) : k); MENU.cR += (pv.R - MENU.cR) * k; MENU.cH += (pv.h - MENU.cH) * k;
  MENU.a += dt * pv.spd; MENU.tt += dt;
  if (MENU.ms === 'recon' && MENU.tt > 9) { MENU.tt = 0; MENU.ri++; }
  const c = MENU.cf, x = c.x + Math.sin(MENU.a) * MENU.cR, z = c.z + Math.cos(MENU.a) * MENU.cR;
  camera.position.set(x, Math.max(c.y + MENU.cH, terrainAt(x, z) + (SITE.trees && MENU.ms !== 'forest' ? 20 : 6)), z); camera.up.set(0, 1, 0); camera.lookAt(c.x, c.y + 1, c.z);
  camera.fov = 55; camera.updateProjectionMatrix();
  const tag = $('msStageTag');
  if (tag && (MENU._tagT = (MENU._tagT || 0) - dt) <= 0) { MENU._tagT = 0.5; let g = ''; if (pv.d !== undefined && !SITE.flat) try { g = grid(pv.d, pv.s); } catch (e) { } tag.innerHTML = `<b>●</b> LIVE · ${stName(SITE)}${g ? ' · ' + g : ''}`; }
}
function menuFocus() { return MENU.cf || (CRS_C ? W(BY.pad_start.down, BY.pad_start.side, 0) : W(60, 0, 0)); }
// ---- 첫 화면(로그인 고르기)·메뉴 1~2단계 배경: 코스·산 정상·마을·계곡을 천천히 비추는 카메라 · 장면이 바뀔 때 살짝 어둡게 (3단계는 고른 임무 미리 보기) ----
const FLY = { i: 0, t: 0, shots: null, el: null, y: null, lk: null, mode: '' };
function flyOn() { return S.state === 'menu' && !XR_ON && (MENU.step < 3 || !window.__bootDone); }
function flyVillage() {   // 건물이 가장 많이 모인 곳 (100 m 칸 기준)
  const B = window.__BLD3 && window.__BLD3.LIST; if (!B || B.length < 6) return null;
  const G = new Map(); for (const b of B) { const k = Math.round(b[0] / 100) + ',' + Math.round(b[1] / 100); G.set(k, (G.get(k) || 0) + 1); }
  let best = null, bn = 0; for (const [k, n] of G) if (n > bn) { bn = n; best = k; }
  if (bn < 4) return null; const [kx, kz] = best.split(',').map(Number); let sx = 0, sz = 0, c = 0;
  for (const b of B) if (Math.abs(b[0] / 100 - kx) <= 1 && Math.abs(b[1] / 100 - kz) <= 1) { sx += b[0]; sz += b[1]; c++; }
  const x = sx / c, z = sz / c; return new V3(x, terrainAt(x, z), z);
}
function flyShots() {
  if (FLY.shots) return FLY.shots;
  const L = [], pd = CRS_C ? BY.pad_start.down : 60, ps = CRS_C ? BY.pad_start.side : 0;
  if (SITE.flat) { const c = W(pd, ps, 0); L.push({ k: 'orbit', c, R: 46, h: 16, a0: 0.4, spd: 0.05, dur: 15 }, { k: 'orbit', c, R: 90, h: 38, a0: 2.6, spd: -0.035, dur: 15 }); return (FLY.shots = L); }
  // 1 출발 패드에서 코스를 따라 낮게
  if (PATHL && PATHL.total > 150) L.push({ k: 'path', f: u => { const q = PATHL.at(u); return W(q.d, q.s, 0); }, s0: 0, s1: Math.min(PATHL.total - 10, 230), h: 22, side: 10, ahead: 45, dur: 17 });
  else L.push({ k: 'orbit', c: W(pd, ps, 0), R: 70, h: 26, a0: 0.4, spd: 0.05, dur: 15 });
  // 2 산 정상: 넓게 돌며 내려다보기
  if (RIDGE && RIDGE.list.length) { const t = RIDGE.list.reduce((a, b) => (b.c.y > a.c.y ? b : a)); L.push({ k: 'orbit', c: t.c.clone(), R: 230, h: 75, a0: 2.2, spd: 0.03, dur: 17 }); }
  // 3 마을: 옆으로 지나가며
  const v = flyVillage(); if (v) L.push({ k: 'pass', c: v, R: 150, h: 45, dir: 0.7, dur: 16 });
  // 4 계곡 링 코스를 따라
  if (RACE && RACE.length > 6) { const P = RACE.map(r => r.c); L.push({ k: 'path', f: u => { const i = clamp(Math.floor(u), 0, P.length - 2), w = clamp(u - i, 0, 1), a = P[i], b = P[i + 1], x = a.x + (b.x - a.x) * w, z = a.z + (b.z - a.z) * w; return new V3(x, terrainAt(x, z), z); }, s0: 1, s1: Math.min(P.length - 1, 8), h: 26, side: 0, ahead: 1.2, dur: 16 }); }
  // 5 넓게 한 바퀴 (출발점 위 높이)
  L.push({ k: 'orbit', c: W(pd, ps, 0), R: 260, h: 110, a0: 4.0, spd: 0.025, dur: 16 });
  return (FLY.shots = L);
}
function flyFade(v) { if (!FLY.el) { FLY.el = document.createElement('div'); FLY.el.id = 'flyFade'; FLY.el.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;opacity:1'; renderer.domElement.insertAdjacentElement('afterend', FLY.el); } if (Math.abs((FLY.shown ?? -1) - v) > 0.01) { FLY.shown = v; FLY.el.style.opacity = v.toFixed(3); } }
const _fp = new V3(), _fl = new V3();
function flyCam(dt) {
  const L = flyShots(), sh = L[FLY.i % L.length];
  FLY.t += dt; if (FLY.t >= sh.dur) { FLY.t = 0; FLY.i++; FLY.y = null; return flyCam(0); }
  const u = FLY.t / sh.dur, e = u * u * (3 - 2 * u);   // 부드럽게 시작·끝
  if (sh.k === 'orbit') { const a = sh.a0 + sh.spd * FLY.t; _fp.set(sh.c.x + Math.sin(a) * sh.R, sh.c.y + sh.h, sh.c.z + Math.cos(a) * sh.R); _fl.set(sh.c.x, sh.c.y + 4, sh.c.z); }
  else if (sh.k === 'pass') { const dx = Math.cos(sh.dir), dz = Math.sin(sh.dir), w = (e - 0.5) * 2 * sh.R; _fp.set(sh.c.x - dz * sh.R * 0.55 + dx * w, sh.c.y + sh.h, sh.c.z + dx * sh.R * 0.55 + dz * w); _fl.set(sh.c.x + dx * w * 0.35, sh.c.y + 2, sh.c.z + dz * w * 0.35); }
  else { const s = sh.s0 + (sh.s1 - sh.s0) * e, p = sh.f(s), q = sh.f(Math.min(sh.s1 + sh.ahead, s + sh.ahead)), dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1; _fp.set(p.x - dz / l * sh.side, p.y + sh.h, p.z + dx / l * sh.side); _fl.set(q.x, q.y + sh.h * 0.35, q.z); }
  // 땅·나무·전선 위로 (갑자기 튀지 않게 천천히 따라감)
  let gy = terrainAt(_fp.x, _fp.z) + 8; if (STREES && STREES.topAt) gy = Math.max(gy, STREES.topAt(_fp.x, _fp.z, 6) + 6);
  const ty = Math.max(_fp.y, gy); if (FLY.y === null) FLY.y = ty; else FLY.y += (ty - FLY.y) * (1 - Math.exp(-dt * (ty > FLY.y ? 5 : 1.2)));
  if (!FLY.lk || FLY.t === 0) FLY.lk = _fl.clone(); else FLY.lk.lerp(_fl, 1 - Math.exp(-dt * 3));
  camera.position.set(_fp.x, FLY.y, _fp.z); camera.up.set(0, 1, 0); camera.lookAt(FLY.lk); camera.fov = 55; camera.updateProjectionMatrix();
  if (!MENU.cf) { MENU.cf = new V3(); MENU.cR = 48; MENU.cH = 24; } MENU.cf.copy(FLY.lk);   // 그림자·나무 자세히 그리는 범위도 보는 곳 따라
  const fin = clamp(1 - FLY.t / 0.9, 0, 1), fout = clamp((FLY.t - (sh.dur - 0.9)) / 0.9, 0, 1); flyFade(Math.max(fin, fout) * 0.92);
}
function menuView(dt) {
  if (flyOn()) { if (FLY.mode !== 'fly') { FLY.t = 0; FLY.y = null; } FLY.mode = 'fly'; flyCam(dt); return; }   // 3단계에서 돌아오면 장면 처음부터 (어둠에서 밝아짐)
  if (FLY.mode === 'fly') { FLY.mode = 'ms'; MENU.cf = null; if (FLY.el) flyFade(0.92); }   // 3단계로: 고른 임무 자리로 바로 옮기고 어둠에서 밝아짐
  if (FLY.el && FLY.shown > 0) flyFade(Math.max(0, FLY.shown - dt * 2.2)); menuCam(dt);
}
// ---- 격납고 회전 무대 (같은 렌더러로 그려 2D 캔버스에 복사) ----
const HG = (function () {
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 4 / 3, 0.05, 100);
  sc.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a1e22, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.01; sc.add(key); sc.add(key.target);   // 그림자 범위는 hgModel 에서 기체 크기에 맞춤
  const rim = new THREE.DirectionalLight(0x7fc8ff, 1.2); rim.position.set(-4, 2, -5); sc.add(rim);
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.45); fill.position.set(-2, 1.5, 4); sc.add(fill);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x141b21, roughness: 0.55, metalness: 0.15, transparent: true, opacity: 0.92 })); pad.rotation.x = -Math.PI / 2; pad.receiveShadow = true; sc.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.7 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; sc.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.61, 64), new THREE.MeshBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.35 })); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.002; sc.add(ring2);
  return { sc, cam, pad, ring, ring2, key, cur: null, id: null, sz: 1, a: 0.6 };
})();
function hgModel() {
  const pk = paintKey(SET.af), id = SET.af + (pk ? ':' + pk : ''); if (HG.id === id) return;   // 격납고 모형도 고른 색으로
  if (HG.cur) HG.sc.remove(HG.cur);
  if (!MENU.models[id]) { PAINT = paintVal(pk); const m = makeModel(SET.af, false), g = m.g; PAINT = null; g.traverse(o => { if (o.isMesh) { o.castShadow = !(o.material && o.material.transparent); o.receiveShadow = false; } }); MENU.models[id] = g; }
  const g = MENU.models[id]; g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g), s = bb.getSize(new V3()), c = bb.getCenter(new V3());
  const r = Math.max(s.x, s.z, s.y * 1.6) * 0.5;
  HG.sz = r; HG.lift = -bb.min.y + r * 0.12; HG.cx = c.x; HG.cz = c.z;
  HG.pad.scale.setScalar(r * 1.05); HG.ring.scale.setScalar(r * 1.05); HG.ring2.scale.setScalar(r * 1.05);
  { const sc = HG.key.shadow.camera; sc.left = sc.bottom = -r * 1.3; sc.right = sc.top = r * 1.3; sc.near = 0.1; sc.far = 30; sc.updateProjectionMatrix(); HG.key.position.set(r * 2.2, r * 3.6, r * 2.8); HG.key.target.position.set(0, 0, 0); HG.key.target.updateMatrixWorld(); if (!HG.sc.environment) HG.sc.environment = modelEnv(); }
  const col = new THREE.Color(AF_C[afCat(AFc())]); HG.ring.material.color.copy(col); HG.ring2.material.color.copy(col);
  HG.sc.add(g); HG.cur = g; HG.id = id;
}
const _hv = new THREE.Vector2();
function menuStage(cv) { const r = cv.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return null; const dpr = renderer.getPixelRatio(), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return { w, h, cw: r.width, ch: r.height }; }
function menuRenderPre(dt) {
  const cv = $('afStage'); if (!cv || ui.menu.classList.contains('hidden')) return;
  const st = menuStage(cv); if (!st) return;
  hgModel(); renderer.getSize(_hv);
  const cw = Math.min(st.cw, _hv.x), ch = Math.min(st.ch, _hv.y);
  HG.a += (dt || 0.016) * 0.45; const g = HG.cur; g.rotation.y = HG.a; g.position.set(-HG.cx, HG.lift + Math.sin(HG.a * 2.2) * HG.sz * 0.03, -HG.cz);
  if (g.userData.props) g.userData.props.forEach(p => p.rotation.y += 0.6);
  HG.cam.aspect = cw / ch; HG.cam.position.set(0, HG.sz * 1.05, HG.sz * 2.9); HG.cam.lookAt(0, HG.sz * 0.3, 0); HG.cam.updateProjectionMatrix();
  renderer.setViewport(0, 0, cw, ch); renderer.setScissor(0, 0, cw, ch); renderer.setScissorTest(true);
  renderer.setClearColor(0x0b1116, 1); renderer.clear(); renderer.render(HG.sc, HG.cam);
  const x2 = cv.getContext('2d'), dpr = renderer.getPixelRatio(), H = renderer.domElement.height;
  x2.clearRect(0, 0, st.w, st.h); x2.drawImage(renderer.domElement, 0, H - ch * dpr, cw * dpr, ch * dpr, 0, 0, st.w, st.h);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, _hv.x, _hv.y); renderer.setClearColor(0x000000, 1);
}
function menuRenderPost() {
  const cv = $('msStage'); if (!cv || ui.menu.classList.contains('hidden')) return;
  const st = menuStage(cv); if (!st) return;
  const src = renderer.domElement, W0 = src.width, H0 = src.height, ar = st.w / st.h;
  let sw = W0, sh = W0 / ar; if (sh > H0) { sh = H0; sw = H0 * ar; }
  const x2 = cv.getContext('2d'); x2.drawImage(src, (W0 - sw) / 2, (H0 - sh) / 2, sw, sh, 0, 0, st.w, st.h);
}
document.addEventListener('keydown', e => {
  if (S.state !== 'menu' || ui.menu.classList.contains('hidden') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) return;
  if (MENU.step !== 3 || ['setPanel', 'recPanel', 'helpPanel', 'tutMenu', 'kbPanel', 'credPanel', 'optPanel', 'ctlPanel', 'acctPanel', 'rankPanel'].some(p => $(p) && !$(p).classList.contains('hidden'))) return;
  // 좌우: 같은 종류 안에서 · 위아래: 종류 바꾸기
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { const gi = MS_GRP.indexOf(MENU.g || 'basic'), d = e.code === 'ArrowUp' ? -1 : 1; menuTab(MS_GRP[(gi + d + MS_GRP.length) % MS_GRP.length]); e.preventDefault(); return; }
  const L = msInGrp(MENU.g || 'basic'), i = L.indexOf(MENU.ms), d = e.code === 'ArrowLeft' ? -1 : 1;
  menuSel(L[(i + d + L.length) % L.length]); e.preventDefault();
});

// =====================================================================
//  VR 판 (sim/vr · Quest 브라우저) — FPV 고글 화면
//  지형·드론은 드론 카메라로 한 번만 그려 화면 텍스처에 담고, 헤드셋에는 어두운 방 + 큰 화면 + 메뉴만 그림.
//  (머리 움직임으로 세상이 흔들리지 않아 멀미가 적고, 장면을 두 번 그리지 않아 빠름)
//  모드 2: 왼쪽 스틱 상승·회전 / 오른쪽 스틱 전후·좌우   모드 1: 왼쪽 스틱 전후·회전 / 오른쪽 스틱 상승·좌우
//  오른쪽 트리거 투하 · 왼쪽 트리거 부스트 · A 확인 · B 메뉴 · X 조명 · Y 하부 카메라 · 왼쪽 스틱 누르기 카메라 · 오른쪽 스틱 누르기 열화상
// =====================================================================
const IS_VR = !!window.SIM_VR;
const XR = { sess: null, prev: {}, menu: false, userExit: false, ctl: [], hover: null, src: null, osdT: 0, mT: 0, frames: 0 };
const VRS = new THREE.Scene(); VRS.background = new THREE.Color(0x06090c);
VRS.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1));
const VR_HEAD = new THREE.Group(), VR_SPACE = new THREE.Group(); VRS.add(VR_HEAD); VRS.add(VR_SPACE);
const VR_RT = new THREE.WebGLRenderTarget(1280, 720, { samples: 4 }); VR_RT.texture.encoding = renderer.outputEncoding;
function vrPlane(w, h, cw, ch, opt) {
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial(Object.assign({ map: tex, transparent: true, depthWrite: false, toneMapped: false }, opt || {})));
  m.renderOrder = 10; return { cv, tex, m };
}
const VR_SCR = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), new THREE.MeshBasicMaterial({ map: VR_RT.texture }));
const VR_OSD = vrPlane(2.4, 1.35, 960, 540); VR_OSD.m.position.z = 0.003; VR_SCR.add(VR_OSD.m);
const VR_FRAME = new THREE.Mesh(new THREE.PlaneGeometry(2.48, 1.43), new THREE.MeshBasicMaterial({ color: 0x0b1116 })); VR_FRAME.position.z = -0.003; VR_SCR.add(VR_FRAME);
const VR_PIP = { rt: new THREE.WebGLRenderTarget(560, 315), cam: new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 3000) }; VR_PIP.rt.texture.encoding = renderer.outputEncoding;
VR_PIP.m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.394), new THREE.MeshBasicMaterial({ map: VR_PIP.rt.texture })); VR_PIP.m.position.set(-1.2 + 0.40, -0.675 + 0.26, 0.006); VR_SCR.add(VR_PIP.m);
{ const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.414), new THREE.MeshBasicMaterial({ color: 0xffc828 })); fr.position.z = -0.001; VR_PIP.m.add(fr); }
const VR_MAP = (function () { const t = new THREE.CanvasTexture(ui.map); t.encoding = THREE.sRGBEncoding; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.833), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.95, toneMapped: false }));
  m.position.set(-1.2 - 0.29, 0.675 - 0.4165, 0); m.visible = false; VR_SCR.add(m); return { t, m }; })();
const VR_MENU = vrPlane(1.3, 1.3 * 1170 / 1024, 1024, 1170); VR_MENU.btns = []; VR_MENU.m.visible = false; VRS.add(VR_MENU.m);
// 컨트롤러 광선
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i); VRS.add(c);
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(0, 0, 0), new V3(0, 0, -4)]), new THREE.LineBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.8 }));
  ln.visible = false; c.add(ln); c.userData.ln = ln;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0x4fe3ff })); c.add(tip);
  c.addEventListener('connected', e => { c.userData.hand = e.data && e.data.handedness; });
  c.addEventListener('disconnected', () => { c.userData.hand = null; });
  XR.ctl.push(c);
}
// 머리 고정 화면: XR 이 머리 위치를 갱신한 직후(그리기 바로 전)에 따라 붙임 -> 흔들림 없음
XR.headP = new V3(0, 1.6, 0); XR.headQ = new THREE.Quaternion();
VRS.onBeforeRender = () => { XR.headP.copy(camera.position); XR.headQ.copy(camera.quaternion); VR_HEAD.position.copy(camera.position); VR_HEAD.quaternion.copy(camera.quaternion); VR_HEAD.updateMatrixWorld(true); };
// XR 이 게임 카메라에 머리 위치를 덮어쓰므로, 그린 뒤 드론 카메라 위치로 되돌림
VRS.onAfterRender = () => { if (XR.camP) { camera.position.copy(XR.camP); camera.quaternion.copy(XR.camQ); camera.updateMatrixWorld(); } };
function vrApplyCam() { S.cam = CAMS.indexOf(SET.vrCam === 'chase' ? 'CHASE' : 'FPV'); }
function vrEnv(v) {
  if (v === 'ir') { irCycle(); return; }
  setTod(v === 'night' ? 'night' : v === 'dusk' ? 'dusk' : 'day');
}
function voiceInfo() {
  try { const V = speechSynthesis.getVoices(), en = V.filter(v => /^en/i.test(v.lang)); return { n: V.length, en: en.length, name: COMM.voice ? COMM.voice.name : (en[0] ? en[0].name : '') }; } catch (e) { return { n: 0, en: 0, name: '' }; }
}
function vrScreenMode(m) {
  SET.vrScreen = m === 'space' ? 'space' : 'head'; saveSet();
  (SET.vrScreen === 'head' ? VR_HEAD : VR_SPACE).add(VR_SCR); VR_SCR.position.set(0, SET.vrScreen === 'head' ? 0 : 0, -2.0); VR_SCR.rotation.set(0, 0, 0);
  if (SET.vrScreen === 'space') vrRecenter();
}
function vrRecenter() {   // 공간 고정: 지금 바라보는 쪽 앞에 화면을 놓음
  const fw = new V3(0, 0, -1).applyQuaternion(XR.headQ); const yaw = Math.atan2(-fw.x, -fw.z);
  VR_SPACE.position.set(XR.headP.x, XR.headP.y || 1.6, XR.headP.z); VR_SPACE.rotation.set(0, yaw, 0);
}
// ---- 세션 ----
async function vrStart() {
  if (!navigator.xr || XR.sess) return;
  xrPlanesPatch();
  let sess; try { sess = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] }); } catch (e) { XR.pending = null; vrOverlay(L2('VR을 시작할 수 없습니다. 다시 눌러 주세요.', 'Could not start VR. Please try again.')); return; }
  XR.sess = sess; XR.userExit = false; renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(window.XR_FB || 1.0); renderer.xr.setReferenceSpaceType('local-floor');
  try { await renderer.xr.setSession(sess); }
  catch (e) { try { renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(sess); XR.local = true; } catch (e2) { try { sess.end(); } catch (e3) { } XR.sess = null; renderer.xr.enabled = false; return; } }
  try { renderer.xr.setFoveation(1); } catch (e) { }
  XR_ON = true; XR.prev = {}; vrApplyCam();
  sess.addEventListener('end', vrEnded);
  const wake = () => { try { if (!AU.ctx) initAudio(); if (AU.ctx && AU.ctx.state !== 'running') AU.ctx.resume(); } catch (e) { } }; sess.addEventListener('selectstart', wake); sess.addEventListener('select', wake); sess.addEventListener('squeezestart', wake); wake();
  sess.addEventListener('visibilitychange', () => { if (sess.visibilityState !== 'visible' && (S.state === 'run' || S.state === 'demo')) { togglePause(); XR.autoPaused = true; } else if (sess.visibilityState === 'visible' && XR.autoPaused && S.state === 'pause') { togglePause(); XR.autoPaused = false; } });
  $('vrBack').classList.add('hidden');
  vrScreenMode(SET.vrScreen);
  $('vrNote') && $('vrNote').classList.add('hidden');
  if (XR.pending) { const k = XR.pending; XR.pending = null; XR.menu = false; startRun(k); vrApplyCam(); }
  else if (S.state === 'pause') { XR.menu = false; togglePause(); } else vrMenuOpen();
  XR.recenter = 2;   // 첫 프레임들에서 머리 위치가 잡히면 화면·메뉴 위치를 다시 맞춤
  last = performance.now();
  renderer.setAnimationLoop((t, f) => { if (f) frame(performance.now()); });
}
function vrStop() { XR.userExit = true; if (XR.sess) try { XR.sess.end(); } catch (e) { } }
function vrEnded() {
  renderer.setAnimationLoop(null); XR_ON = false; XR.sess = null; renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = true;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  last = performance.now(); if (!TEST) requestAnimationFrame(frame);
  if (XR.afterExit === 'video') {   // VR 메뉴에서 '영상 저장': 2D 화면에서 리플레이를 재생하며 녹화
    XR.afterExit = null; $('vrBack').classList.add('hidden'); S.cam = CAMS.indexOf(SET.vrCam === 'chase' ? 'CHASE' : 'FPV');
    exportReplayVideo(LAST_REC, ok => { toMenu(); vrOverlay(ok ? L2('영상을 저장했습니다. 다운로드 폴더(파일 앱)에서 볼 수 있습니다.', 'Video saved to your Downloads folder.') : L2('영상을 만들지 못했습니다.', 'Could not create the video.'), L2('VR 시작', 'Start VR')); });
    return;
  }
  if (XR.userExit && (S.state === 'run' || S.state === 'demo' || S.state === 'pause')) toMenu(); else if (S.state === 'run' || S.state === 'demo') togglePause();
  vrOverlay(XR.userExit ? '' : L2('VR이 멈췄습니다. 버튼을 누르면 하던 비행을 이어 갑니다.', 'VR was interrupted. Press the button to continue your flight.'), XR.userExit ? L2('VR 시작', 'Start VR') : L2('VR로 돌아가기', 'Back to VR'));
}
function vrOverlay(msg, btn) {   // VR 판 2D 화면: 메뉴(3단계 코스 화면) 위에 안내 줄
  const o = $('vrBack'); if (o) o.classList.add('hidden');
  ui.pause.classList.add('hidden'); ui.menu.classList.remove('hidden'); if (MENU.step < 3) wizGo(3);
  const n = $('vrNote'), r = $('vrResume'), paused = S.state === 'pause';
  if (n) { n.classList.toggle('hidden', !msg); $('vrNoteT').textContent = msg || ''; }
  if (r) { r.classList.toggle('hidden', !paused); r.onclick = () => vrStart(); }
}
// three r149: Quest 브라우저에서 XRFrame.detectedPlanes 를 읽으면 (평면 인식을 안 켰을 때) 오류가 남 -> 오류 대신 '없음'
function xrPlanesPatch() {
  try { const P = window.XRFrame && XRFrame.prototype, d = P && Object.getOwnPropertyDescriptor(P, 'detectedPlanes');
    if (d && d.get && !d.get.__safe) { const g = function () { try { return d.get.call(this); } catch (e) { return undefined; } }; g.__safe = true; Object.defineProperty(P, 'detectedPlanes', { configurable: true, enumerable: d.enumerable, get: g }); } } catch (e) { }
}
xrPlanesPatch();
// ---- 컨트롤러 입력 (readInput 끝에서 부름) ----
function xrPads() {
  const srcs = XR.src || (XR.sess ? XR.sess.inputSources : []); let L = null, R = null;
  for (const s of srcs) if (s && s.gamepad) { if (s.handedness === 'left') L = s.gamepad; else if (s.handedness === 'right') R = s.gamepad; }
  return { L, R };
}
// VR 스틱 모드: 쿼드·고정익 따로 기억 (고정익 기본 = 모드 1: 오른쪽 스틱 위아래가 스로틀)
function vrStickMode() { return AFc().cls === 'wing' ? (SET.vrModeW || 1) : (SET.vrMode || 1); }   // 쿼드 기본도 모드 1 (사용자 피드백: 좌우가 반대로 느껴짐)
function xrInput(dt) {
  const { L: Lg, R: Rg } = xrPads();
  const ax = (g, i) => (g && g.axes && g.axes.length > i ? g.axes[i] || 0 : 0), bt = (g, i) => !!(g && g.buttons && g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
  const edge = (k, on) => { const e = on && !XR.prev[k]; XR.prev[k] = on; return e; };
  const rt = edge('rt', bt(Rg, 0)), lt = edge('lt', bt(Lg, 0)), A = edge('a', bt(Rg, 4)), B = edge('b', bt(Rg, 5)), X = edge('x', bt(Lg, 4)), Y = edge('y', bt(Lg, 5)), LS = edge('ls', bt(Lg, 3)), RS = edge('rs', bt(Rg, 3));
  // 지정한 단추 기능 (조종기 설정 · 기본: R트리거 투하 · A 사진 · B 메뉴 · L트리거 부스트 · L스틱 시점 · Y 하부 카메라 · R스틱 열화상 · X 조명)
  const VM = vrBtnMap(), held = id => id ? bt(id[0] === 'L' ? Lg : Rg, +id.slice(1)) : false, hit = f => edge('f_' + f, held(VM[f]));
  const F = {}; for (const f in VR_FN) F[f] = hit(f); F.boostHeld = held(VM.boost);
  if ((rt || lt || A || B) && AU.ctx && AU.ctx.state !== 'running') try { AU.ctx.resume(); } catch (e) { }
  if (XR.menu) { if (rt || A) vrMenuClick('right'); if (lt) vrMenuClick('left'); if (B && S.state === 'pause') vrResume(); return; }
  if (S.state === 'replay') {   // 리플레이: A 재생·멈춤 · 오른쪽 스틱 좌우 5초 · Y 속도 · 왼쪽 스틱 누르기 카메라 · B 메뉴
    const sx = ax(Rg, 2); if (edge('sr', sx > 0.7)) replayKey('ArrowRight'); if (edge('sl', sx < -0.7)) replayKey('ArrowLeft');
    if (A) replayKey('Space'); if (LS) replayKey('KeyC'); if (Y) { const L = [0.5, 1, 2, 4]; RP.speed = L[(L.indexOf(RP.speed) + 1) % L.length]; replayUI(); }
    if (B) { if (VID.on) return; replayEnd(); vrMenuOpen(); }
    return;
  }
  const lx = ax(Lg, 2), ly = -ax(Lg, 3), rx = ax(Rg, 2), ry = -ax(Rg, 3);
  const vm = vrStickMode(); let st = vm === 1 ? { thr: ry, yaw: lx, pitch: ly, roll: rx } : { thr: ly, yaw: lx, pitch: ry, roll: rx };
  if (vm === 3) st = vrHeadSteer(dt, lx, ly, rx, ry);
  else IN.head = false;
  let any = false;
  for (const k in st) { const v = vm === 3 ? st[k] : stickCurve(st[k], 0.1, true); if (Math.abs(v) > Math.abs(IN[k])) { IN[k] = v; any = true; } }
  if (any) IN.src = 'VR';
  if (typeof isC1 === 'function' && isC1() && S.state !== 'result') { if (A) pressed.push('Enter'); if (B) vrMenuOpen(); if (Y) pressed.push('KeyY'); if (X) pressed.push('KeyE'); if (rt) pressed.push('KeyQ'); return; }   // 1종 연습 버튼
  if (F.boostHeld && SET.diff !== 'atti') IN.boost = true;
  if (F.drop) pressed.push('Space');
  if (F.photo) { if (S.state === 'result') startRun(S.kind); else pressed.push('Enter'); }   // 산불·수색 중에는 사진
  if (F.menu || (!VM.menu && B)) vrMenuOpen();   // 메뉴는 늘 열 수 있게 (지정을 지웠으면 B)
  if (F.pip) { const L = [0, 90, 60, 45]; SET.vrPip = L[(L.indexOf(SET.vrPip | 0) + 1) % L.length]; saveSet(); showMsg(SET.vrPip ? L2('하부 카메라 ', 'Lower camera ') + SET.vrPip + '°' : L2('하부 카메라 끔', 'Lower camera off'), '#ffc828', 1); }
  if (F.cam) { SET.vrCam = SET.vrCam === 'chase' ? 'fpv' : 'chase'; saveSet(); vrApplyCam(); showMsg(SET.vrCam === 'chase' ? L2('뒤에서 추적', 'Chase view') : 'FPV', '#4fe3ff', 1); }
  if (F.ir) irCycle();
  if (F.light) pressed.push('KeyL');   // 조명 켜기/끄기
  if (F.guide) pressed.push('KeyV'); if (F.assist) pressed.push('KeyH'); if (F.reset) pressed.push('KeyR'); if (F.hud) pressed.push('Digit0');
}
// 머리 방향 모드: 고개를 돌린 쪽으로 기체가 돌고, 왼쪽 스틱 앞뒤 = 속도, 고개를 들거나 숙이면 그쪽으로 오르내림
// 오른쪽 스틱: 좌우 = 옆으로, 위아래 = 고도 (직접), 왼쪽 스틱 좌우 = 몸을 돌리지 않고 회전
function vrHeadSteer(dt, lx, ly, rx, ry) {
  const fw = new V3(0, 0, -1).applyQuaternion(XR.headQ), hh = Math.atan2(fw.x, -fw.z), hp = Math.asin(clamp(fw.y, -1, 1));
  const live = S.state === 'run' && !DR.landed;
  if (!live || XR.hTgt == null) { XR.hTgt = DR.h; XR.hhPrev = hh; }
  else { XR.hTgt += wrapA(hh - XR.hhPrev); XR.hhPrev = hh; XR.hTgt += shape(lx, 0.15) * 1.6 * dt; }
  let dh = wrapA(XR.hTgt - DR.h); if (Math.abs(dh) > 100 * DEG) { XR.hTgt = DR.h + Math.sign(dh) * 100 * DEG; dh = wrapA(XR.hTgt - DR.h); }   // 너무 앞서가지 않게
  IN.head = live;
  if (AFc().cls === 'wing') { const tl = Math.abs(hp) < 6 * DEG ? 0 : hp - Math.sign(hp) * 6 * DEG; return { thr: shape(ly, 0.1), yaw: 0, pitch: clamp(-tl * 2.6 + shape(-ry, 0.12), -1, 1), roll: clamp(dh * 1.8 + shape(rx, 0.1), -1, 1) }; }
  const spd = shape(ly, 0.1), tilt = Math.abs(hp) < 8 * DEG ? 0 : hp - Math.sign(hp) * 8 * DEG;
  let thr = shape(ry, 0.12);
  if (DR.landed) thr = Math.max(thr, spd);                                   // 땅에서는 왼쪽 스틱 위 = 이륙
  else if (spd > 0) thr = clamp(thr + spd * Math.tan(tilt) * 2.2, -1, 1);   // 보는 쪽(위·아래)으로 날아감
  return { thr, yaw: Math.abs(dh) < 1.5 * DEG ? 0 : clamp(dh * 2.4, -1, 1), pitch: DR.landed ? 0 : spd, roll: shape(rx, 0.1) };
}
// ---- VR 안 메뉴 ----
const VR_MS = () => [['course', L2('장애물 코스', 'Obstacle course')], ['forest', L2('숲길 통과', 'Forest trail')], ['race', L2('타임 레이스', 'Time race')], ['ridge', L2('능선 종주', 'Ridge run')], ['free', L2('자유 비행', 'Free flight')], ['demo', L2('기준 비행 보기', 'Reference flight')]];
const VR_AF = ['x2d', 'anafi', 'fpv', 'kfpv'], VR_AFW = ['fw', 'puma', 'kfw'];
const VR_MS2 = () => [['recon', L2('정찰', 'Recon')], ['track', L2('차량 추적', 'Vehicle track')], ['fire', L2('산불 감시', 'Wildfire watch')], ['sar', L2('수색·구조', 'Search & rescue')], ['strike', L2('타격', 'Strike')]];
function vrMenuOpen() {   // 비행 중이면 멈춰 두고(계속하기 가능) · 결과·리플레이 상태는 그대로 (임무는 웹 화면에서 고름)
  if (S.state === 'run' || S.state === 'demo') togglePause(); else if (S.state === 'replay') replayEnd();
  XR.menu = true; XR.menuPlace = true; XR.hover = null; XR.mT = 0;
}
function vrResume() { XR.menu = false; if (S.state === 'pause') togglePause(); vrApplyCam(); if (SET.vrScreen === 'space') vrRecenter(); }
function vrRR(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
function vrMenuDraw() {
  const P = VR_MENU, g = P.cv.getContext('2d'), W2 = P.cv.width, H2 = P.cv.height; P.btns = [];
  const paused = S.state === 'pause';
  g.clearRect(0, 0, W2, H2); g.fillStyle = 'rgba(10,15,19,.94)'; vrRR(g, 0, 0, W2, H2, 30); g.fill();
  g.textBaseline = 'top'; g.fillStyle = '#ffc828'; g.font = '800 42px system-ui, sans-serif'; g.fillText('FPV VR · ' + stName(SITE), 36, 24);
  g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '500 21px system-ui, sans-serif'; g.fillText(L2('컨트롤러로 가리키고 트리거로 선택', 'Point with a controller, pull the trigger'), 36, 76);
  const btn = (id, x, y, w, h, label, on, dis, hot) => {
    const hv = XR.hover === id && !dis; g.fillStyle = dis ? 'rgba(255,255,255,.04)' : on ? '#4fe3ff' : hot ? (hv ? '#ffd95a' : '#ffc828') : hv ? 'rgba(79,227,255,.35)' : 'rgba(255,255,255,.09)';
    vrRR(g, x, y, w, h, 12); g.fill(); if (hv) { g.strokeStyle = hot ? '#fff' : '#4fe3ff'; g.lineWidth = 4; g.stroke(); }
    g.fillStyle = dis ? 'rgba(255,255,255,.3)' : on || hot ? '#071016' : '#e8eef2'; g.font = `700 ${h >= 76 ? 30 : 22}px system-ui, sans-serif`; g.textBaseline = 'middle';
    const tw = g.measureText(label).width; g.fillText(label, x + (w - tw) / 2, y + h / 2); g.textBaseline = 'top';
    if (!dis) P.btns.push({ id, x, y, w, h });
  };
  let y = 112;
  const hasRec = !!(REC && REC.s.length > 1) || !!(LAST_REC && LAST_REC.s && LAST_REC.s.length > 1), lk = S.lastKind || S.kind, done = S.state === 'result' || S.state === 'menu';
  { const kn = MS_NAME[lk] || ({ course: L2('장애물 코스', 'Obstacle course'), free: L2('자유 비행', 'Free flight'), demo: L2('기준 비행', 'Reference flight') })[lk] || lk; g.fillStyle = '#e8eef2'; g.font = '700 26px system-ui, sans-serif'; g.fillText(L2('현재 임무: ', 'Mission: ') + kn + ' · ' + AFc().name + ' · ' + pilotName(), 36, 106); y = 150;
    if (ORDER.m) { const t = (window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en; g.font = '500 21px system-ui, sans-serif'; const ws = String(t).split(' '), L = []; let ln = ''; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 880 && ln) { L.push(ln); ln = w; } else ln = tl; } if (ln) L.push(ln);
      g.fillStyle = '#ffc828'; g.fillText('📻', 36, 144); g.fillStyle = '#cfd6da'; L.slice(0, 2).forEach((l, i) => g.fillText(l, 76, 144 + i * 28)); y = 150 + Math.min(2, L.length) * 28 + 14; } }
  if (done) { btn('restart', 36, y, 300, 80, '↺ ' + L2('같은 임무 다시', 'Fly it again'), false, false, true); btn('replay', 348, y, 310, 80, L2('이번 비행 리플레이', 'Replay this flight'), false, !hasRec); btn('video', 670, y, 318, 80, '⬇ ' + L2('영상 저장', 'Save video'), false, !hasRec); y += 96; }
  if (paused) {
    const kn = (MS_NAME[S.kind] || ({ course: L2('장애물 코스', 'Obstacle course'), free: L2('자유 비행', 'Free flight'), demo: L2('기준 비행', 'Reference flight') })[S.kind] || S.kind);
    btn('resume', 36, y, 300, 80, '▶ ' + L2('계속하기', 'Resume'), false, false, true); btn('restart', 348, y, 310, 80, '↺ ' + L2('처음부터', 'Restart'), false); btn('replay', 670, y, 318, 80, L2('지금까지 리플레이', 'Replay so far'), false, !hasRec); y += 96;
  }
  g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '500 18px system-ui, sans-serif'; g.fillText(L2('다른 임무·기체는 ⏹ 임무 끝내기 → 웹 화면에서 고르기', 'Other missions or drones: ⏹ End mission → choose on the web page'), 36, y); y += 36;
  const RH = 60, RW = 50, row = (yy, lbl) => { g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '600 22px system-ui, sans-serif'; g.fillText(lbl, 36, yy + 14); };
  const afN = id => ({ x2d: 'Skydio X2D', anafi: 'ANAFI', fpv: L2('FPV 레이싱', 'FPV racer'), kfpv: L2('자폭 FPV', 'Kamikaze FPV'), fw: 'RQ-11 Raven', puma: 'RQ-20 Puma', kfw: L2('자폭 고정익', 'Loitering wing') })[id];
  row(y, L2('비행 모드', 'Flight mode')); [['train', L2('입문', 'Training')], ['easy', L2('쉬움 (P)', 'Easy (P)')], ['atti', 'ATTI'], ['sport', L2('스포츠', 'Sport')]].forEach(([v, n], i) => btn('diff:' + v, 190 + i * 200, y, 188, RW, n, SET.diff === v)); y += RH;
  row(y, L2('스틱', 'Sticks')); [[2, L2('모드 2', 'Mode 2')], [1, L2('모드 1', 'Mode 1')], [3, L2('머리 방향', 'Head steer')]].forEach(([v, n], i) => btn('mode:' + v, 190 + i * 200, y, 188, RW, n, vrStickMode() === v)); y += RH;
  row(y, L2('카메라', 'Camera')); [['fpv', 'FPV', SET.vrCam !== 'chase'], ['c0', L2('추적 멀리', 'Chase far'), SET.vrCam === 'chase' && (SET.zoom | 0) === 0], ['c1', L2('추적 보통', 'Chase mid'), SET.vrCam === 'chase' && (SET.zoom | 0) === 1], ['c2', L2('추적 가까이', 'Chase near'), SET.vrCam === 'chase' && (SET.zoom | 0) === 2]].forEach(([v, n, on], i) => btn('cam:' + v, 190 + i * 200, y, 188, RW, n, on)); y += RH;
  row(y, L2('하부 카메라', 'Lower cam')); [[0, L2('끔', 'Off')], [90, '90°'], [60, '60°'], [45, '45°']].forEach(([v, n], i) => btn('pip:' + v, 190 + i * 200, y, 188, RW, n, (SET.vrPip | 0) === v)); y += RH;
  row(y, L2('시간대', 'Time')); [['day', L2('낮', 'Day'), SET.tod === 'day' && !ENV.ir], ['dusk', L2('해질녘', 'Dusk'), SET.tod === 'dusk' && !ENV.ir], ['night', L2('밤', 'Night'), SET.tod === 'night' && !ENV.ir], ['ir', L2('열화상', 'Thermal'), !!ENV.ir]].forEach(([v, n, on], i) => btn('env:' + v, 190 + i * 200, y, 188, RW, n, on)); y += RH;
  row(y, L2('날씨', 'Weather')); [['clear', L2('맑음', 'Clear')], ['rain', L2('비', 'Rain')], ['snow', L2('눈', 'Snow')]].forEach(([v, n], i) => btn('wx:' + v, 190 + i * 200, y, 188, RW, n, (SET.wx || 'clear') === v)); btn('wxfx', 790, y, 188, RW, L2('기상 영향 ', 'Effects ') + (SET.wxFx ? L2('켬', 'on') : L2('끔', 'off')), !!SET.wxFx); y += RH;
  row(y, L2('표시', 'Display')); btn('scr:head', 190, y, 188, RW, L2('고글 화면', 'Goggles'), SET.vrScreen !== 'space'); btn('scr:space', 390, y, 188, RW, L2('공간 화면', 'Fixed screen'), SET.vrScreen === 'space');
  btn('map', 590, y, 188, RW, SET.vrMap === false ? L2('지도 끔', 'Map off') : MAPZ.on ? L2('지도 전체', 'Map: all') : L2('지도', 'Map'), SET.vrMap !== false); btn('guide', 790, y, 188, RW, L2('안내 ', 'Nav ') + L2(GL_NM[gdLevel()][0], GL_NM[gdLevel()][1]), gdLevel() >= 2); y += RH;   // 안내 단계: 가이드 → 목표 → 지도 → 무전
  row(y, L2('스틱 반응', 'Stick feel')); [['real', L2('실기체 (선형)', 'Real (linear)')], ['soft', L2('부드럽게 (엑스포)', 'Soft (expo)')]].forEach(([v, n], i) => btn('expo:' + v, 190 + i * 200, y, 188, RW, n, stickExpo(true) === v)); y += RH;
  row(y, L2('계기', 'Instruments')); [['auto', L2('자동', 'Auto')], ['fpv', L2('간단 (FPV)', 'Simple (FPV)')], ['uas', L2('항공 (UAS)', 'Aviation (UAS)')]].forEach(([v, n], i) => btn('hud:' + v, 190 + i * 200, y, 188, RW, n + (v === 'auto' ? ' · ' + (hudMode() === 'uas' ? 'UAS' : 'FPV') : ''), (SET.hud || 'auto') === v)); y += RH + 4;
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '500 19px system-ui, sans-serif';
  g.fillText((AFc().cls === 'wing' ? L2('[고정익] ', '[Fixed-wing] ') : '') + (vrStickMode() === 3 ? L2('머리 방향: 보는 쪽으로 비행 · 왼쪽 스틱 앞뒤 속도 · 오른쪽 스틱 옆·고도', 'Head steer: fly where you look · L-stick fwd/back speed · R-stick side·height') : vrStickMode() === 2 ? L2('모드 2: 왼쪽 스틱 상승·회전 / 오른쪽 스틱 전후·좌우', 'Mode 2: left stick climb·yaw / right stick fwd·side') : L2('모드 1: 왼쪽 스틱 전후·회전 / 오른쪽 스틱 상승·좌우', 'Mode 1: left stick fwd·yaw / right stick climb·side')), 36, y);
  g.fillText(L2('R트리거 투하 · L트리거 부스트 · A 확인·사진 보고 · B 메뉴/계속', 'R-trigger drop · L-trigger boost · A ok/photo report · B menu/resume'), 36, y + 26);
  g.fillText(L2('X 조명 · Y 하부 카메라 · 왼쪽 스틱 누르기 카메라 · 오른쪽 스틱 누르기 열화상', 'X light · Y lower cam · L-stick click camera · R-stick click thermal'), 36, y + 52);
  const vi = voiceInfo(), eng = commEngine(), au = AU.ctx ? AU.ctx.state : L2('없음', 'none');
  g.fillStyle = eng === 'none' ? 'rgba(255,154,122,.95)' : 'rgba(93,255,154,.85)';
  g.fillText(L2('무전 음성: ', 'Radio voice: ') + (eng === 'natural' ? L2('자연 음성', 'natural voice') + (COMM.rvOk ? '' : '') : eng === 'synth' ? L2('내장 합성기', 'built-in synthesizer') + (TTSW.w ? '' : L2(' (불러오는 중)', ' (loading)')) : eng === 'web' ? vi.name : L2('없음 · 자막만', 'none · subtitles only')) + (COMM.fbOk || COMM.rvOk ? ' ✓' : '') + L2(' · 오디오 ', ' · audio ') + au + (COMM.fbErr ? ' · ' + String(COMM.fbErr).slice(0, 40) : ''), 36, y + 78);
  btn('vtest', 36, H2 - 76, 300, 56, L2('🔊 음성 테스트', '🔊 Voice test'), false);
  btn('exit', W2 - 380, H2 - 76, 344, 56, '⏹ ' + L2('임무 끝내기 · 웹 메뉴로', 'End mission · web menu'), false);
  g.fillStyle = 'rgba(255,255,255,.3)'; g.font = '500 16px monospace'; g.fillText('VR20', 360, H2 - 56);
  P.tex.needsUpdate = true;
}
const _vr = new THREE.Raycaster(), _vp = new V3(), _vq = new THREE.Quaternion();
function vrMenuHit(c) {
  if (!c || !VR_MENU.m.visible) return null;
  _vp.setFromMatrixPosition(c.matrixWorld); _vq.setFromRotationMatrix(c.matrixWorld);
  _vr.set(_vp.clone(), new V3(0, 0, -1).applyQuaternion(_vq));
  const h = _vr.intersectObject(VR_MENU.m, false)[0]; if (!h || !h.uv) return null;
  const x = h.uv.x * VR_MENU.cv.width, y = (1 - h.uv.y) * VR_MENU.cv.height;
  return { b: VR_MENU.btns.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h), dist: h.distance };
}
function vrCtl(hand) { return XR.ctl.find(c => c.userData.hand === hand) || null; }
function vrMenuClick(hand) {
  const r = vrMenuHit(vrCtl(hand)) || vrMenuHit(vrCtl(hand === 'right' ? 'left' : 'right')); if (!r || !r.b) return;
  const id = r.b.id; sfx('good'); XR.mT = 0;
  if (id === 'exit') { vrStop(); return; }
  if (id === 'resume') { vrResume(); return; }
  if (id === 'end') { if (REC) LAST_REC = recFinish(); toMenu(); XR.menu = true; XR.hover = null; return; }
  if (id === 'restart') { XR.menu = false; startRun(S.lastKind || S.kind); vrApplyCam(); if (SET.vrScreen === 'space') vrRecenter(); return; }
  if (id === 'vtest') { vrVoiceTest(); return; }
  if (id === 'replay') { if (REC) LAST_REC = recFinish(); XR.menu = false; replayStart(LAST_REC, 'menu'); vrApplyCam(); if (SET.vrCam !== 'chase' && S.cam !== 0) S.cam = 0; return; }
  if (id === 'video') { if (REC) LAST_REC = recFinish(); XR.afterExit = 'video'; vrStop(); return; }
  if (id === 'map') { if (SET.vrMap === false) { SET.vrMap = true; mapZoom(false); } else if (!MAPZ.on) mapZoom(true); else { mapZoom(false); SET.vrMap = false; } saveSet(); return; }   // 지도 → 전체 → 끔
  if (id === 'guide') { glCycle(); return; }
  if (id.startsWith('diff:')) { setDiff(id.slice(5)); saveSet(); return; }
  if (id.startsWith('mode:')) { if (AFc().cls === 'wing') SET.vrModeW = +id.slice(5); else SET.vrMode = +id.slice(5); saveSet(); return; }
  if (id.startsWith('scr:')) { vrScreenMode(id.slice(4)); return; }
  if (id.startsWith('cam:')) { const v = id.slice(4); if (v === 'fpv') SET.vrCam = 'fpv'; else { SET.vrCam = 'chase'; SET.zoom = +v.slice(1); SET.camDist = ZOOMS[SET.zoom].d; } saveSet(); vrApplyCam(); return; }
  if (id.startsWith('zoom:')) { SET.zoom = +id.slice(5); SET.camDist = ZOOMS[SET.zoom].d; saveSet(); return; }
  if (id.startsWith('expo:')) { SET.expo = id.slice(5); saveSet(); syncExpo(); return; }
  if (id.startsWith('hud:')) { SET.hud = id.slice(4); saveSet(); syncHud(); return; }
  if (id.startsWith('pip:')) { SET.vrPip = +id.slice(4); saveSet(); return; }
  if (id === 'wxfx') { setWxFx(!SET.wxFx); return; }
  if (id.startsWith('wx:')) { setWx(id.slice(3)); return; }
  if (id.startsWith('env:')) { vrEnv(id.slice(4)); return; }
  if (id.startsWith('af:')) { if (S.state === 'pause') return; setAirframe(id.slice(3)); afUI(); return; }
  if (id.startsWith('ms:')) { const k = id.slice(3); menuSel(k); if (!msAvail(k).ok) return; XR.menu = false; startRun(k); vrApplyCam(); if (SET.vrScreen === 'space') vrRecenter(); }
}
// ---- 화면 위 OSD (실제 FPV 고글처럼 영상 위에 글자) ----
function vrOsdDraw() {
  const { cv, tex } = VR_OSD, g = cv.getContext('2d'), W2 = 1280, H2 = 720; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.setTransform(cv.width / W2, 0, 0, cv.height / H2, 0, 0);
  const sh = (t, x, y, sz, col, al) => { g.font = `700 ${sz}px system-ui, sans-serif`; g.textAlign = al || 'left'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(t, x, y); g.fillStyle = col || '#fff'; g.fillText(t, x, y); };
  g.textBaseline = 'top';
  const box = (lines, col) => { g.fillStyle = 'rgba(6,10,14,.82)'; vrRR(g, 190, 190, 900, 340, 22); g.fill(); g.strokeStyle = col; g.lineWidth = 3; g.stroke(); let y = 220; lines.forEach(([t, sz, c]) => { const ws = String(t).split(' '); let ln = ''; g.font = `700 ${sz}px system-ui, sans-serif`; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 840 && ln) { sh(ln, 220, y, sz, c); y += sz * 1.25; ln = w; } else ln = tl; } if (ln) { sh(ln, 220, y, sz, c); y += sz * 1.35; } }); };
  if (S.brief) { const b = $('brief'); box([['BRIEFING', 30, '#4fe3ff'], [b && b.querySelector('h3') ? b.querySelector('h3').textContent : '', 40, '#fff'], [b && b.querySelector('p') ? b.querySelector('p').textContent : '', 26, '#cfd6da'], [L2('A 버튼: 시작', 'A button: start'), 30, '#ffc828']], '#4fe3ff'); tex.needsUpdate = true; return; }
  if (S.state === 'result') {
    const R = DBF.last, ph = (S.photos || []).filter(p => p.ok).slice(-4);
    g.fillStyle = 'rgba(6,10,14,.86)'; vrRR(g, 140, 60, 1000, 600, 22); g.fill(); g.strokeStyle = '#5dff9a'; g.lineWidth = 3; g.stroke();
    sh(($('resTitle') || {}).textContent || '', 170, 84, 40, '#5dff9a'); sh(($('resSub') || {}).textContent || '', 170, 134, 24, '#cfd6da');
    if (R) { sh(String(R.sc), 1100, 76, 64, '#ffc828', 'right'); sh(R.g, 1100, 146, 34, R.col, 'right');
      const L = [[L2('합계', 'Total'), `${fmt(R.total)}  (${L2('비행', 'flight')} ${fmt(S.t)} + ${L2('벌점', 'pen')} ${S.pen.toFixed(0)} s · ${L2('기준', 'par')} ${fmt(R.par || 0)})`], [L2('점수', 'Score'), `${L2('과제', 'tasks')} ${R.a}/55 · ${L2('시간', 'time')} ${R.b}/30 · ${L2('안전', 'safety')} ${R.c}/15`],
        [L2('과제', 'Tasks'), `${R.ok} / ${R.n}`], [L2('거리 · 최고 속도', 'Distance · top speed'), `${DBF.dist.toFixed(0)} m · ${(DBF.vmax * 3.6).toFixed(0)} km/h`], [L2('충돌 · 재출발', 'Impacts · restarts'), `${S.impacts || 0} · ${DBF.resp}`]];
      if (DBF.pens.length) L.push([L2('벌점 내역', 'Penalties'), DBF.pens.slice(0, 3).map(p => `+${p.d.toFixed(0)} ${String(p.why || '').split(' ')[0]}`).join(' · ') + (DBF.pens.length > 3 ? ' …' : '')]);
      L.forEach(([a, b], i) => { sh(a, 170, 196 + i * 40, 24, '#9fb0b8'); sh(b, 470, 196 + i * 40, 24, '#fff'); }); }
    ph.forEach((p, i) => { if (!p.im) { p.im = new Image(); p.im.src = p.url; } if (p.im.complete) g.drawImage(p.im, 170 + i * 236, 470, 220, 124); });
    sh(L2('A 다시 · B 메뉴', 'A again · B menu'), W2 / 2, 612, 28, '#ffc828', 'center'); tex.needsUpdate = true; return; }
  if (S.state === 'pause') { box([[L2('일시 정지', 'PAUSED'), 44, '#ffc828'], [L2('B: 메뉴', 'B: menu'), 30, '#e8eef2']], '#ffc828'); tex.needsUpdate = true; return; }
  if (S.state === 'menu') { tex.needsUpdate = true; return; }
  if (S.state === 'replay' && RP.rec) { const s0 = RP.rec.s[0][0], e0 = RP.rec.s[RP.rec.s.length - 1][0]; sh(`REPLAY  ${fmt(RP.t - s0)} / ${fmt(e0 - s0)}  ×${RP.speed}${RP.playing ? '' : '  ❚❚'}`, W2 / 2, 22, 40, '#4fe3ff', 'center');
    sh(L2('A 재생·멈춤 · 오른쪽 스틱 ←→ 5초 · Y 속도 · 왼쪽 스틱 누르기 카메라 · B 메뉴', 'A play/pause · R-stick ←→ 5 s · Y speed · L-stick click camera · B menu'), W2 / 2, H2 - 60, 26, '#e8eef2', 'center'); }
  const sb = S.state === 'demo' ? ghostS : S.state === 'replay' ? RP.pose : DR, gh = groundAt(sb.p.x, sb.p.z), sp = sb.v ? sb.v.length() : 0;
  // 화면 좌표: 게임 카메라(드론 카메라·추적 카메라)로 3D 점을 투영
  const prj = p => { const q = p.clone().project(camera); return { x: (q.x + 1) / 2 * W2, y: (1 - q.y) / 2 * H2, front: q.z < 1 && q.z > -1 }; };
  // 수평선 (기울기·높낮이)
  const UAS = hudMode() === 'uas' && SET.vrCam !== 'chase'; if (UAS) uasDraw(g, W2, H2, sb, isMission() ? msObj() : curObj(), searchIn(isMission() ? msObj() : curObj(), sb.p), H2 - 118);
  if (!UAS) { const f = new V3(0, 0, -1).applyQuaternion(camera.quaternion); f.y = 0; if (f.lengthSq() > 1e-4) { f.normalize(); const r = new V3(-f.z, 0, f.x), c = camera.position.clone().addScaledVector(f, 1000);
    const a = prj(c.clone().addScaledVector(r, -600)), b = prj(c.clone().addScaledVector(r, 600)); if (a.front && b.front) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.setLineDash([26, 14]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); } } }
  // 진행 방향 표시 (1초 뒤 위치): 지금 실제로 날아가는 쪽
  if (sp > 0.6) { const m = prj(sb.p.clone().addScaledVector(sb.v, 1.0)); if (m.front && m.x > 0 && m.x < W2 && m.y > 0 && m.y < H2) {
    g.strokeStyle = '#5dff9a'; g.lineWidth = 5; g.beginPath(); g.arc(m.x, m.y, 16, 0, Math.PI * 2); g.moveTo(m.x - 40, m.y); g.lineTo(m.x - 16, m.y); g.moveTo(m.x + 16, m.y); g.lineTo(m.x + 40, m.y); g.moveTo(m.x, m.y - 16); g.lineTo(m.x, m.y - 30); g.stroke(); } }
  // 다음 목표 표시: 화면 안이면 마름모, 밖이면 가장자리 화살표
  const o = isMission() ? msObj() : curObj();
  const sIn = searchIn(o, sb.p); if (sIn && glMap()) sh(L2('수색 구역 안 · 눈과 열화상으로 찾기', 'In search area · find it by eye and thermal'), W2 / 2, 164, 24, '#ffc828', 'center');
  // 목표 표시 (안내 2 이상): 고글 화면 위 ◇ · 가장자리 화살표
  if (o && o.mk && S.state !== 'demo' && !sIn && gOn('marker')) { const t = o.mk.clone().project(camera), beh = t.z > 1; let x = t.x, y = t.y; if (beh) { x = -x; y = -y; }
    const inside = !beh && Math.abs(x) < 0.92 && Math.abs(y) < 0.88, dist = o.search ? Math.max(0, Math.hypot(o.mk.x - sb.p.x, o.mk.z - sb.p.z) - o.search.r) : camera.position.distanceTo(o.mk);
    const nearDoor = inside && dist < 35 && (o.kind === 'ms' ? o.t === 'pass' : !!openingOf(o));   // 게이트·링이 눈앞이면 ◇ 빼기 (PC navArrow 와 같은 규칙)
    if (inside && !nearDoor) { const px = (x + 1) / 2 * W2, py = (1 - y) / 2 * H2; g.strokeStyle = '#ffc828'; g.lineWidth = 4; g.beginPath(); g.moveTo(px, py - 22); g.lineTo(px + 22, py); g.lineTo(px, py + 22); g.lineTo(px - 22, py); g.closePath(); g.stroke(); sh(Math.round(dist) + ' m', px, py + 28, 28, '#ffc828', 'center'); }
    else if (!inside && !UAS) { const an0 = Math.atan2(y, x), ex = Math.cos(an0) * 0.55, ey = Math.sin(an0) * 0.58, px = (ex + 1) / 2 * W2, py = (1 - ey) / 2 * H2, an = Math.atan2(-ey, ex);   // 안쪽 타원 위 (하부 카메라·지도와 안 겹치게)
      g.save(); g.translate(px, py); g.rotate(an); g.fillStyle = '#ffc828'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(34, 0); g.lineTo(-14, -24); g.lineTo(-4, 0); g.lineTo(-14, 24); g.closePath(); g.stroke(); g.fill(); g.restore();
      sh(Math.round(dist) + ' m', px - Math.cos(an) * 60, py - Math.sin(an) * 60 - 14, 28, '#ffc828', 'center'); } }
  // 큰 숫자 계기
  // 계기는 화면 가운데 가까이 (시선을 조금만 옮겨 보이게): 왼쪽 = 속도, 오른쪽 = 고도·상승률, 위 = 시간·목표·방위
  // 계기는 지도 둘레에 모음: 지도 위 = 고도·상승률·투하물, 지도 왼쪽 아래 = 속도 / 위쪽 가운데 = 시간·목표·방위
  const CX = W2 / 2, MX = W2 - 250, MYT = H2 - 330 - 34, MXR = MX + 198;
  if (S.state !== 'replay') sh(fmt(S.t || 0), CX, 26, 34, '#fff', 'center');
  if (!UAS) { sh(`${Math.round(sp * 3.6)}`, MX - 16, H2 - 150, 50, '#fff', 'right'); sh('km/h', MX - 16, H2 - 96, 22, '#cfd6da', 'right');
  sh(`${(sb.p.y - gh).toFixed(1)}`, MX, MYT - 150, 48, '#fff', 'left'); sh(L2('m 고도', 'm AGL'), MXR, MYT - 132, 22, '#cfd6da', 'right'); }
  const vs = sb.v ? sb.v.y : 0; if (!UAS) sh((vs > 0.15 ? '▲ ' : vs < -0.15 ? '▼ ' : '■ ') + Math.abs(vs).toFixed(1) + ' m/s', MX, MYT - 92, 24, Math.abs(vs) > 3 ? '#ff9a40' : '#e8eef2', 'left');
  if (!UAS) { const hdg = ((((SITE.brg || 0) + (sb.h || 0) * 180 / Math.PI) % 360) + 360) % 360; sh(String(Math.round(hdg)).padStart(3, '0') + '°', CX, 124, 30, '#e8eef2', 'center'); }
  if (o && S.state !== 'replay') sh('▸ ' + (o.label || MS_NAME[S.kind] || ''), CX, 70, 40, '#ffc828', 'center');
  if (S.state === 'demo') sh(L2('기준 비행', 'REFERENCE FLIGHT'), CX, 70, 38, '#4fe3ff', 'center');
  if (ENV.ir) sh('IR', MX - 16, H2 - 196, 28, '#ff9a40', 'right');
  { const n = S.kind === 'course' ? S.payloads || 0 : S.kind === 'sar' ? S.kits | 0 : S.kind === 'free' && AFc().drop ? droneM.cans.filter(c => c.visible).length : -1; if (S.state === 'run' && actionKind() === 'report') sh('📷 ' + L2('R트리거 · A = 사진 보고', 'R-trigger · A = report'), W2 - 250, H2 - 330 - 34 - 56, 22, '#5dff9a', 'left'); else if (n >= 0 && S.state === 'run') sh((S.kind === 'sar' ? 'KIT ' : 'M84 ') + ('●'.repeat(n) || '—'), W2 - 250, H2 - 330 - 34 - 56, 24, '#ffc828', 'left'); }
  if (SET.vrPip) sh(L2('하부 ', 'LOWER ') + SET.vrPip + '°', 26, H2 - 282, 22, '#ffc828');   // 글자 위쪽 기준 · 하부 카메라 창(위쪽 끝 y≈471) 위로 띄워서 가리지 않게
  if (PH.last && PH.lastT > 0 && PH.last.complete) { g.globalAlpha = Math.min(1, PH.lastT); g.drawImage(PH.last, 40, 150, 288, 162); g.strokeStyle = PH.lastOk ? '#5dff9a' : '#ff9a40'; g.lineWidth = 4; g.strokeRect(40, 150, 288, 162); g.globalAlpha = 1; }
  if (false && ORDER.m) { const t = (window.SIM_LANG !== 'en' && ORDER.m.ko) ? ORDER.m.ko : ORDER.m.en; g.font = '600 22px system-ui, sans-serif'; const ws = String(t).split(' '), L = []; let ln = ''; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 400 && ln) { L.push(ln); ln = w; } else ln = tl; } if (ln) L.push(ln); const LL = L.slice(0, 4), oy = 330;
    g.fillStyle = 'rgba(6,10,14,.55)'; g.fillRect(30, oy - 8, 430, 38 + LL.length * 28); g.fillStyle = '#ffc828'; g.fillRect(30, oy - 8, 4, 38 + LL.length * 28); sh(L2('📻 명령', '📻 ORDERS'), 44, oy, 20, '#ffc828'); LL.forEach((l, i) => sh(l, 44, oy + 28 + i * 28, 22, '#e8eef2')); }
  const r = $('radio'); if (r && r.classList.contains('show')) { const t = r.querySelector('.re') ? r.querySelector('.re').textContent : r.textContent; g.font = '600 28px system-ui, sans-serif'; const ws = t.split(' '); let ln = ''; const L = []; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > 680 && ln) { L.push(ln); ln = w; } else ln = tl; } if (ln) L.push(ln); L.slice(-2).forEach((l, i) => sh(l, W2 / 2 - (UAS ? 0 : 70), (UAS ? 116 : H2 - 112) + i * 36, 28, '#9fe9ff', 'center')); }
  const m = $('objMsg'); if (m && m.classList.contains('show') && m.textContent.trim()) sh(m.textContent.trim(), W2 / 2, H2 / 2 + 90, 44, m.style.color || '#5dff9a', 'center');
  // 등고선 지도 (PC 화면처럼 오른쪽 아래, 가운데 쪽으로 당겨 둠)
  if (SET.vrMap !== false && ui.map) { const mw = 198, mh = 330, mx = W2 - 250, my = H2 - mh - 34; g.globalAlpha = 0.92; g.fillStyle = 'rgba(6,10,14,.75)'; g.fillRect(mx - 4, my - 4, mw + 8, mh + 8); g.filter = 'brightness(1.6) contrast(1.15)'; g.drawImage(ui.map, mx, my, mw, mh); g.filter = 'none'; g.globalAlpha = 1; g.strokeStyle = 'rgba(255,200,40,.8)'; g.lineWidth = 2; g.strokeRect(mx - 4, my - 4, mw + 8, mh + 8); }
  // 경로 안내 문구 (예: 고도 내리기 3.2 m (왼쪽 스틱 ↓))
  if (gOn('hint')) { const ge = $('guide'); if (ge && !ge.classList.contains('hidden')) { const L = [...ge.children].map(e => [e.textContent, e.className]).filter(x => x[0]).slice(0, 3); L.forEach(([t, c], i) => sh(t, W2 / 2 - (UAS ? 0 : 70), (UAS ? 196 : H2 - 200) + i * 38, 30, c === 'ok' ? '#5dff9a' : c === 'warn' ? '#ff9a40' : '#4fe3ff', 'center')); } }
  if (SET.vrCam !== 'chase' && !UAS) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(W2 / 2 - 22, H2 / 2); g.lineTo(W2 / 2 - 7, H2 / 2); g.moveTo(W2 / 2 + 7, H2 / 2); g.lineTo(W2 / 2 + 22, H2 / 2); g.moveTo(W2 / 2, H2 / 2 + 7); g.lineTo(W2 / 2, H2 / 2 + 16); g.stroke(); }
  g.textAlign = 'left'; tex.needsUpdate = true;
}
// ---- 매 프레임 (그리기 직전): 드론 카메라 영상을 화면 텍스처로 ----
function xrTick(dt) {
  XR.frames++;
  if (S.state === 'menu' && !XR.menu) vrMenuOpen();
  if (XR.recenter > 0 && XR.headP.y > 0.3 && XR.frames > 2) { XR.recenter--; if (SET.vrScreen === 'space') vrRecenter(); XR.menuPlace = true; }
  // 메뉴 판: 열 때 눈앞 1.5 m (화면보다 앞)
  VR_MENU.m.visible = XR.menu;
  if (XR.menu) {
    if (XR.menuPlace) { XR.menuPlace = false; const H = XR.headP, fw = new V3(0, 0, -1).applyQuaternion(XR.headQ), yaw = Math.atan2(-fw.x, -fw.z); VR_MENU.m.position.set(H.x - Math.sin(yaw) * 1.5, H.y - 0.15, H.z - Math.cos(yaw) * 1.5); VR_MENU.m.rotation.set(0, yaw, 0); VR_MENU.m.updateMatrixWorld(true); }
    let hv = null; for (const c of XR.ctl) { const r = vrMenuHit(c); if (r && r.b) hv = r.b.id; }
    if (hv !== XR.hover || (XR.mT -= dt) <= 0) { XR.hover = hv; XR.mT = 0.3; vrMenuDraw(); }
  }
  XR.ctl.forEach(c => c.userData.ln.visible = !!c.userData.hand && (XR.menu || S.state === 'result'));
  if (typeof c1VRon === 'function' && c1VRon()) { VR_SCR.visible = false; renderer.shadowMap.autoUpdate = false; if (XR.frames % 2 === 0) renderer.shadowMap.needsUpdate = true; c1XRUpdate(dt); return; }   // 1종: 조종자 자리에서 맨눈 · 그림자 2프레임에 한 번   // 1종: 조종자 자리에서 맨눈 (고글 화면 없음)
  VR_SCR.visible = true;
  // 지형 장면을 드론 카메라(게임 카메라)로 화면 텍스처에 그림
  renderer.shadowMap.autoUpdate = false; if (XR.frames % 2 === 0) renderer.shadowMap.needsUpdate = true;   // 그림자는 2프레임에 한 번
  camera.aspect = 16 / 9; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  XR.osdT -= dt; if (XR.osdT <= 0) { XR.osdT = 0.1; vrOsdDraw(); }
  const cur = renderer.getRenderTarget(); renderer.xr.enabled = false;
  renderer.setRenderTarget(VR_RT); renderer.clear(); renderer.render(scene, camera);
  // 하부 카메라 (각도 고정, 기체 진행 방향 기준)
  const pipOn = (SET.vrPip | 0) > 0 && !XR.menu && S.state !== 'result'; VR_PIP.m.visible = pipOn;
  if (pipOn && XR.frames % 2 === 0) { const sb = S.state === 'demo' ? ghostS : DR, c = VR_PIP.cam, dv = droneM.g.visible; droneM.g.visible = false;
    c.position.copy(sb.p).add(new V3(0, -0.12, 0)); c.rotation.set(-(SET.vrPip | 0) * DEG, -sb.h, 0, 'YXZ'); c.updateMatrixWorld();
    const sa = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(VR_PIP.rt); renderer.clear(); renderer.render(scene, c); renderer.shadowMap.autoUpdate = sa; droneM.g.visible = dv; }
  renderer.setRenderTarget(cur); renderer.xr.enabled = true;
  (XR.camP = XR.camP || new V3()).copy(camera.position); (XR.camQ = XR.camQ || new THREE.Quaternion()).copy(camera.quaternion);
}
// ---- 리플레이를 영상(WebM/MP4)으로 저장 (PC 리플레이 막대·VR 메뉴) ----
const VID = { mr: null, chunks: [], on: false, stopping: false, rec: null, done: null };
function vidMime() { for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { } return ''; }
function vidTag(t) { let e = $('vidTag'); if (!e) { e = document.createElement('div'); e.id = 'vidTag'; e.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:70;padding:8px 16px;border-radius:20px;background:rgba(10,13,16,.85);color:#fff;font:600 15px system-ui,sans-serif;border:1px solid #ff5050'; document.body.appendChild(e); } e.style.display = t ? '' : 'none'; if (t) e.textContent = t; }
function exportReplayVideo(rec, onDone) {
  if (VID.on) return;
  if (!rec || !rec.s || rec.s.length < 2) { showMsg(L2('저장할 비행 기록이 없습니다', 'No flight to save'), '#ff6060', 1.5); if (onDone) onDone(false); return; }
  const cv = renderer.domElement; if (typeof MediaRecorder === 'undefined' || !cv.captureStream) { showMsg(L2('이 브라우저는 영상 저장을 지원하지 않습니다', 'This browser cannot record video'), '#ff6060', 2); if (onDone) onDone(false); return; }
  const cam = S.cam; replayStart(rec, 'menu'); S.cam = cam; replaySeek(rec.s[0][0]); RP.speed = 1; RP.playing = true;
  const mime = vidMime(); let mr;
  try { mr = new MediaRecorder(cv.captureStream(30), Object.assign({ videoBitsPerSecond: 6000000 }, mime ? { mimeType: mime } : {})); } catch (e) { showMsg(L2('영상을 만들 수 없습니다', 'Could not record video'), '#ff6060', 2); if (onDone) onDone(false); return; }
  Object.assign(VID, { mr, chunks: [], on: true, stopping: false, rec, done: onDone || null });
  mr.ondataavailable = e => { if (e.data && e.data.size) VID.chunks.push(e.data); };
  mr.onstop = () => {
    VID.on = false; vidTag('');
    const type = mr.mimeType || mime || 'video/webm', ext = /mp4/.test(type) ? 'mp4' : 'webm', blob = new Blob(VID.chunks, { type });
    const d = new Date(), z = n => String(n).padStart(2, '0'), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `fpv_${rec.kind || 'flight'}_${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}.${ext}`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 8000);
    VID.blobSize = blob.size; replayEnd(); showMsg(L2('영상 저장 완료', 'Video saved'), '#5dff9a', 2);
    const cb = VID.done; VID.done = null; if (cb) cb(true);
  };
  mr.start(500); vidTag('● REC 0%');
}
function vidTick() {
  if (!VID.on || VID.stopping) return;
  const s = VID.rec.s, s0 = s[0][0], end = s[s.length - 1][0], pc = Math.round(clamp((RP.t - s0) / Math.max(1e-6, end - s0), 0, 1) * 100);
  vidTag(L2('● 영상 만드는 중 ', '● Recording video ') + pc + '%');
  if (S.state !== 'replay' || RP.t >= end) { VID.stopping = true; setTimeout(() => { if (VID.mr && VID.mr.state !== 'inactive') VID.mr.stop(); }, 700); }
}
if ($('rpVid')) $('rpVid').onclick = () => { if (RP.rec) exportReplayVideo(RP.rec); };
// ---- 2D 쪽 ----
var VR_OK = { ok: false };
if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { VR_OK.ok = !!ok; vrBtnUpdate(); vrPageInit(); }).catch(() => vrPageInit());
else setTimeout(vrPageInit, 0);
function vrPageInit() {
  if (!IS_VR) return;
  // 한 파일판: 훈련장 고르기 버튼 (고르면 다시 불러옴) · PC 판 링크 숨김
  const L = sitesAll(), vb = document.querySelector('#vrBack .vb');
  if (vb && L.length > 1 && !$('vrSites')) { const d = document.createElement('div'); d.id = 'vrSites'; d.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center';
    for (const st of L) { const b = document.createElement('button'); b.textContent = stName(st); b.className = st.id === SITE.id ? 'primary' : ''; b.style.cssText = 'padding:10px 14px;font-size:15px'; b.onclick = () => { if (st.id === SITE.id) return; siteSelect(st.id); location.reload(); }; d.appendChild(b); }
    vb.insertBefore(d, $('vrBackGo')); }
  if (!window.SIM_BASE && $('vrPC')) $('vrPC').style.display = 'none';
  if ($('vrBack')) $('vrBack').classList.add('hidden');
}
function vrBtnUpdate() {   // PC 판: VR 기기에서 열면 VR 판으로 가는 버튼
  const b = $('msGoVR'); if (!b) return;
  b.classList.add('hidden'); const w = $('wzVR'); if (w) w.classList.add('hidden');   // 처음 화면에서 컴퓨터/VR 을 고르므로 중복 버튼은 숨김
  b.textContent = L2('Quest VR 버전 열기', 'Open the Quest VR version');
}
if ($('msGoVR')) $('msGoVR').onclick = () => { if (window.SIM_VR_URL) location.href = window.SIM_VR_URL + (window.SIM_LANG === 'en' ? 'en.html' : ''); };
if ($('vrBackGo')) $('vrBackGo').onclick = () => vrStart();

setAirframe(SET.af); afUI(); menuSel(MENU.ms);
Object.assign(window.__sim, { HG, SMK, SAR, smkReset, commAck, vecCall, FLANE, DAMS, sky, startPos, startHead, FLY_C, wizGo, pilotSetUI: () => pilotSetUI(), LY, stickMode, GL, gdLevel, glSet, glCycle, BEACON, GCHEV, marker, NAVR, navRadio, vrMenuDraw, vrOsdDraw, splitKey, RWY, rwyLocal, rwyApproach, msObj, setWxFx, wxSense, SNOW_U, setTod, setWx, WX, SAR_POOL, MAPV, mxy, trackPose, debriefShow, DBF, RV, rvPlan, rvNorm, VID, exportReplayVideo, RP, getLastRec: () => LAST_REC, VR_MAP, vrMenuOpen, commEngine, TTSW, commSpeak, VR_PIP_RT: VR_PIP.rt, ENV, XR, VRS, VR_MENU, VR_OSD, VR_SCR, VR_RT, vrMenuClick, vrMenuHit, vrStart, vrStop, xrInput, VR_OK, getXR: () => XR_ON, DAMS, MENU, menuSel, menuGo, menuTab, LY, lyEdit, lyApply, comm, grid, COMM, WIND, windAt, SAR, TRACK, RIDGE, FIRE, irSet, ENV, envApply, AF, setAirframe, MS, msObj, FLANE, RACE, RECON, STRIKE, effMode });
// ---- 옵션 사용성: 탭 · 고른 값 설명 · 코스 화면의 빠른 설정 ----
(function optUX() {
  const P = $('optPanel'); if (!P || !$('optTabs')) return;
  const H = {
    segDiff: { train: ['느리고, 스틱을 놓으면 멈추고, 다음 과제 쪽으로 방향을 잡아 줍니다 · 처음 비행에', 'Slow, stops when you let go, turns toward the next task · for first flights'], easy: ['고도를 유지하고 약하게 보조합니다', 'Holds altitude with light assistance'], atti: ['위치를 잡아 주지 않고 자세만 유지 · 바람에 밀리고 관성으로 미끄러짐 · 실기체 감각', 'Holds attitude only, not position · drifts with wind and momentum · like the real aircraft'], sport: ['보조 없음 · 가장 빠르고 민감합니다', 'No assistance · fastest and most sensitive'] },
    segMode: { gps: ['위치를 잡아 줍니다 · 스틱을 놓으면 멈춤', 'Holds position · stops when you let go'], atti: ['자세만 유지 · 바람에 밀리고 관성으로 미끄러짐', 'Holds attitude only · drifts with wind and momentum'], man: ['놓으면 수평 · 기울기 제한 안에서 직접 조종', 'Levels when released · you fly within the tilt limit'], acro: ['기울기 제한 없음 · 플립·배면 가능 · 추력∝회전수² (FPV 기체)', 'No tilt limit · flips and inverted flight · thrust ∝ rpm² (FPV airframes)'] },
    segAssistLv: { 2: ['자동 방향 · 게이트 유도 · 지형 추종 · 브레이크 (H 키로 끄기)', 'Auto heading, gate guidance, terrain follow, brake (H toggles)'], 1: ['게이트 유도만 약하게', 'Light gate guidance only'], 0: ['보조 없이 직접 조종합니다', 'You fly without assistance'] },
    segFeel: { train: ['속도·기울기·회전을 낮춰 둠 · 첫 비행에', 'Speed, tilt and yaw rate reduced · for first flights'], std: ['제원의 중간 · Betaflight 기본 Rates', 'Mid-range performance · Betaflight default rates'], real: ['제원 그대로 · 가장 빠르고 민감', 'Full performance · fastest and most sensitive'] },
    segExpo: { real: ['스틱을 민 만큼 그대로 반응 · RC 조종기와 같은 느낌', 'Responds exactly to stick travel · feels like an RC transmitter'], soft: ['가운데 부근이 둔해서 미세 조종이 쉽습니다', 'Softer around centre for easy fine control'] },
    segAssist: { 1: ['자세·고도를 잡아 줍니다 (H 키로 켜기/끄기)', 'Steadies attitude and altitude (H toggles)'], 0: ['보조 없이 직접 조종합니다', 'You fly without assistance'] },
    segGuide: { 3: ['목표 ◇·빛기둥 + 쉐브론 경로·조작 안내 · 입문 기본', 'Target markers + chevron path and stick hints · Training default'], 2: ['목표 ◇·빛기둥만 · 비행 경로는 스스로 · 쉬움·ATTI 기본', 'Target markers only · fly your own line · Easy/ATTI default'], 1: ['화면 표시 없이 지도로 찾아감 · 스포츠 기본', 'No screen markers · navigate by the map · Sport default'], 0: ['지도에도 없음 · 무전 방위·거리만', 'Not on the map · radio bearings only'] },
    segAcro: { 0: ['스틱을 놓으면 기체가 수평으로 돌아옵니다', 'The aircraft levels out when you let go'], 1: ['기울어진 채로 유지되는 완전 수동 · 숙련자용', 'Fully manual, stays banked · for experienced pilots'] },
    segTime: { 0: ['밝은 낮 · 가장 잘 보입니다', 'Daylight · best visibility'], 2: ['해가 낮아 그림자가 길고 역광이 생깁니다', 'Low sun, long shadows and glare'], 1: ['어두움 · IR 카메라와 조명이 중요합니다', 'Dark · IR camera and lights matter'] },
    segWx: { clear: ['비·눈을 고르면 시야가 줄고 산불 감시는 쉽니다', 'Rain or snow cuts visibility and stops fire watch'], rain: ['빗줄기·안개로 시야가 줄어듭니다 · 산불 감시 불가', 'Rain and fog cut visibility · no fire watch'], snow: ['땅과 나무가 눈에 덮입니다 · 산불 감시 불가', 'Ground and trees under snow · no fire watch'] },
    segWxFx: { 0: ['날씨는 보이기만 하고 비행에는 영향 없음', 'Weather is visual only'], 1: ['돌풍이 불고 카메라·센서 시야가 떨어집니다', 'Gusts, and reduced camera and sensor range'] },
    segWind: { 0: ['바람 없음', 'Calm'], 1: ['정지 비행이 조금씩 밀립니다', 'Hover drifts a little'], 2: ['제자리에서도 계속 수정 조작이 필요합니다', 'Constant correction needed even in a hover'] },
    segHud: { auto: ['기체 종류에 맞춰 자동으로 고릅니다', 'Picked automatically for the airframe'], fpv: ['고도·속도 숫자 위주의 간단한 표시', 'Simple altitude and speed readouts'], uas: ['피치 사다리 · 속도·고도 테이프 · HSI 방위계', 'Pitch ladder, speed and altitude tapes, HSI'] },
    segBelly: { 1: ['투하·선회 때 아래 화면이 자동으로 뜹니다', 'Lower view appears automatically for drops and orbits'], 0: ['X 키를 눌렀을 때만 봅니다', 'Only when you press X'] },
    segFull: { 1: ['출격할 때 전체 화면으로 바꿉니다', 'Switches to full screen at launch'], 0: ['창 크기 그대로 비행합니다', 'Stays in the window'] },
    segVoice: { 1: ['CONTROL(남)·EAGLE ONE(여) 영어 무전을 소리로 들려줍니다', 'Plays CONTROL (male) and EAGLE ONE (female) radio'], 0: ['무전은 글자로만 보입니다', 'Radio shown as text only'] },
    segMusic: { 1: ['배경음악 켬 · 오른쪽 막대로 크기 조절', 'Music on · slider sets the level'], 0: ['배경음악 끔', 'Music off'] },
    segRadioLang: { en: ['실제 군·항공 무전처럼 영어로 (한국어 자막)', 'English radio'], ko: ['기기의 한국어 음성으로 자막을 읽어 줍니다 (한국어 음성이 없는 기기는 영어)', 'Korean (device voice)'] },
    segMusSyn: { 0: ['실제 악기 녹음(CC0)으로 연주', 'Recorded instruments (CC0)'], 1: ['예전 합성음', 'Classic synth'] },
    segRumble: { 0: ['진동 없음', 'No rumble'], 1: ['충돌·링 통과·착지·실속 때 짧게 (Xbox 등 게임패드 · VR 컨트롤러 · 휴대폰)', 'Short pulses on hits, gates, landing, stall (gamepads, VR controllers, phones)'], 2: ['여기에 높은 스로틀·부스트·고속 바람의 약한 상시 진동 추가', 'Plus a light constant buzz at high throttle, boost and speed'] },
    segKeys: { A: ['W/S 상승·하강 · A/D 회전 · 방향키 이동', 'W/S climb·descend · A/D yaw · arrows move'], B: ['방향키로 고도·회전, WASD로 이동', 'Arrows for altitude and yaw, WASD to move'], C: ['키를 하나씩 직접 지정합니다', 'Assign every key yourself'] },
  };
  const HW = { segMode: {   // 고정익일 때 설명
    gps: ['자동조종: 고도·속도 유지, 지형 회피, 실속 보호', 'Autopilot: holds height and speed, avoids terrain, stall protection'],
    atti: ['자세 안정 수동: 놓으면 수평 · 스로틀 직접 · 고도 유지·실속 보호 없음', 'Stabilised manual: levels when released · direct throttle · no height hold or stall protection'],
    man: ['완전 수동: 놓아도 기운 채 유지 · 실속·스핀 가능', 'Full manual: stays banked when released · stalls and spins possible'],
    acro: ['완전 수동 (고정익은 수동과 같음)', 'Full manual (same as Manual for fixed wing)'] }, segDiff: {   // 고정익일 때 설명
    train: ['자동조종: 고도·속도 유지, 지형 회피, 실속 보호 · 기울기 35°까지', 'Autopilot: holds height and speed, avoids terrain, stall protection · bank ≤35°'],
    easy: ['자동조종 + 최대 기울기 · 느릴 땐 실속 안 나게 기울기 제한', 'Autopilot with full bank · bank limited at low speed to prevent stall'],
    atti: ['자세 안정 수동: 놓으면 수평 · 스로틀 직접 · 고도 유지·실속 보호 없음', 'Stabilised manual: levels when released · direct throttle · no height hold or stall protection'],
    sport: ['완전 수동: 놓아도 기운 채 유지 · 실속·스핀 가능', 'Full manual: stays banked when released · stalls and spins possible'] } };
  const segV = id => { const b = $(id) && $(id).querySelector('button.on'); return b ? b.dataset.v : null; };
  const segT = id => { const b = $(id) && $(id).querySelector('button.on'); return b ? b.textContent.replace(/\s*\(.*\)\s*$/, '').trim() : '—'; };
  Object.keys(H).forEach(id => { const s = $(id); if (!s) return; const h = document.createElement('small'); h.className = 'oh'; h.dataset.for = id; s.parentNode.insertBefore(h, s.nextSibling); });
  // 빠른 설정 (코스 고르는 화면)
  const QS = [['segMode', '🎚', '비행 모드', 'Mode'], ['segFeel', '🏎', '비행감', 'Feel'], ['segTime', '🕐', '시간대', 'Time'], ['segWx', '🌦', '날씨', 'Weather'], ['segWind', '💨', '바람', 'Wind'], ['segWxFx', '⛈', '기상 영향', 'Weather fx'], ['segHud', '📟', '계기', 'HUD'], ['segGuide', '🧭', '안내', 'Nav'], ['segVoice', '🔊', '음성', 'Voice']];
  const bar = $('qsBar');
  const draw = () => {
    P.querySelectorAll('small.oh').forEach(h => { const m = (AFc().cls === 'wing' && HW[h.dataset.for]) || H[h.dataset.for], v = segV(h.dataset.for), t = m && m[v]; h.textContent = t ? L2(t[0], t[1]) : ''; });
    if (bar) bar.querySelectorAll('button[data-s]').forEach(b => { b.querySelector('b').textContent = segT(b.dataset.s); const m = (AFc().cls === 'wing' && HW[b.dataset.s]) || H[b.dataset.s], t = m && m[segV(b.dataset.s)]; b.title = t ? L2(t[0], t[1]) : ''; });
  };
  if (bar) {
    bar.innerHTML = QS.map(([id, ic, ko, en]) => `<button data-s="${id}">${ic} ${L2(ko, en)}<b></b></button>`).join('') + `<button class="all">⚙ ${L2('모든 옵션', 'All options')}</button>`;
    bar.querySelectorAll('button[data-s]').forEach(b => b.onclick = () => {
      const bs = [...$(b.dataset.s).querySelectorAll('button')].filter(x => !x.disabled), i = bs.findIndex(x => x.classList.contains('on'));
      const nx = bs[(i + 1) % bs.length]; if (nx) nx.click();
      b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); setTimeout(draw, 0);
    });
    bar.querySelector('.all').onclick = () => optOpen();
  }
  // 탭
  let last = 'fly';
  const tab = t => { last = t; $('optTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); P.querySelectorAll('.otab').forEach(d => d.classList.toggle('on', d.dataset.t === t)); };
  $('optTabs').querySelectorAll('button').forEach(b => b.onclick = () => tab(b.dataset.t));
  window.optOpen = t => { tab(t || last); openPanel('optPanel'); draw(); };
  tab('fly');
  if ($('bOpt')) $('bOpt').onclick = () => optOpen();
  if ($('bPauseOpt')) $('bPauseOpt').onclick = () => optOpen();
  if ($('bSet')) $('bSet').onclick = () => optOpen('gis');
  new MutationObserver(() => draw()).observe(P, { subtree: true, attributes: true, attributeFilter: ['class'] });
  draw();
})();
