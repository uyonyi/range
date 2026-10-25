// =====================================================================
//  무인멀티콥터 1종 실기시험 기준 참고 연습 (민간 · 연습용, 공식 시험 아님)
//  - 기준 문서: 한국교통안전공단 실기시험 표준서(무인멀티콥터) 2025.7.18 개정
//               무인멀티콥터(1종) 실기시험 세부평가기준(화성드론자격센터 표기) 2025.9.9 개정
//  - 공식값과 앱 잠정 설정을 C1RULES 에 분리해 둠 (src: 'official' | 'app')
// =====================================================================
const C1RULES = {
  ver: 'c1-rules-0.1',
  docs: [
    { id: 'pts', ko: '무인비행장치 조종자 증명 실기시험 표준서(무인멀티콥터)', rev: '2025.7.18', from: '한국교통안전공단 자료실 묶음(2025.10.13 표기)' },
    { id: 'c1', ko: '무인멀티콥터(1종) 실기시험 세부 평가기준', rev: '2025.9.9', from: '같은 묶음 · 문서 표지에 화성드론자격센터 표기' }
  ],
  // 공식값 (세부평가기준 공동사항·기동별 기준)
  posTol: { v: 1.0, u: 'm', src: 'official' },          // 기체 중심 ±1 m · 이동 경로 좌우/전후 각 1 m(폭 2 m)
  refMin: { v: 3, u: 'm', src: 'official' }, refMax: { v: 5, u: 'm', src: 'official' },   // 기준고도 3~5 m (스키드)
  altTol: { v: 0.5, u: 'm', src: 'official' },          // 기준고도 ±0.5 m (기동별 제시 고도에도 적용)
  hdgTol: { v: 15, u: 'deg', src: 'official' }, hdgTolEmg: { v: 45, u: 'deg', src: 'official' },
  hoverT: { v: 5, u: 's', src: 'official' }, hoverTE: { v: 3, u: 's', src: 'official' },   // 정지 5 s 이상 · E 지점 3 s 이상
  stopShort: { v: 3, u: 's', src: 'official' },         // 3 s 미만 멈춤 2회 이상 또는 3 s 이상 1회 → U
  pauseEmg: { v: 3, u: 's', src: 'official' }, pauseEmgAlt: { v: 1, u: 'm', src: 'official' },
  eAlong: { v: 5, u: 'm', src: 'official' },            // E 지점 전후 5 m 까지 인정
  triRise: { v: 7.5, u: 'm', src: 'official' }, emgRise: { v: 2, u: 'm', src: 'official' },
  emgRatio: { v: 1.5, u: '×', src: 'official' },        // 비상 강하 속도 ≥ 일반 기동 속도 × 1.5
  takeoffLimit: { v: 300, u: 's', src: 'official' },    // 시동·이륙 5분 이내
  safeR: { v: 14, u: 'm', src: 'official' },            // 권고 안전거리 (조종자 중심 반경)
  // 앱 잠정 판정값 (공식 수치 없음 · 교관 검수 필요)
  stillV: { v: 0.35, u: 'm/s', src: 'app' },           // 이 속도 미만이면 '정지'로 봄
  stillYaw: { v: 6, u: 'deg/s', src: 'app' },
  stopV: { v: 0.3, u: 'm/s', src: 'app' },             // 이동 중 이 속도 미만 = 멈춤
  grace: { v: 2.0, u: 's', src: 'app' },               // 허용범위를 이 시간 넘게 연속 이탈하면 '지속 이탈'(U)
  arriveT: { v: 0.3, u: 's', src: 'app' },
  emgRefDefault: { v: 0.6, u: 'm/s', src: 'app' },     // 일반 강하 속도 측정값이 없을 때 쓰는 기준
  emgPadSkid: { v: '스키드 사각형 0.9×1.1 m', src: 'app' },
  triHdg: { v: '전방 유지', src: 'official' }
};
const c1R = k => C1RULES[k].v;

// ---- 기체: 1종 연습용 대형 멀티콥터 (가정값 · 실기체 보정 전) ----
// 특정 제조사·모델 아님. 질량·추력·관성(회전 응답)·항력·모터 응답을 따로 둔 최소 모델.
const C1P = {
  ver: 'c1p-0.1', label: { ko: '1종 연습용 대형 멀티콥터', en: 'Class-1 practice multicopter' },
  selfKg: { v: 22, u: 'kg', a: true, note: '자체중량(연료·배터리 제외 정의는 기체별 확인 필요)' },
  mtowKg: { v: 30, u: 'kg', a: true, note: '최대이륙중량 · 법령 1종 구분(25 kg 초과)은 이 값 기준' },
  flightKg: { v: 27, u: 'kg', a: true, note: '현재 시뮬레이션 비행질량 (배터리 포함 가정)' },
  thrustMaxN: { v: 530, u: 'N', a: true, note: '총 최대 추력 (≈ 비행질량의 2.0배 무게)' },
  tauMotor: { v: 0.12, u: 's', a: true, note: '모터·추력 1차 응답 시간' },
  tauAtt: { v: 0.32, u: 's', a: true, note: '자세(기울기) 응답 시간 — 관성·자세제어 이득을 합친 근사' },
  attRate: { v: 80, u: 'deg/s', a: true, note: '기울기 변화 속도 한계' },
  tiltMax: { v: 25, u: 'deg', a: true, note: 'ATTI·수동 최대 기울기' },
  tiltGps: { v: 18, u: 'deg', a: true, note: 'GPS 모드 최대 기울기' },
  yawMax: { v: 70, u: 'deg/s', a: true }, tauYaw: { v: 0.25, u: 's', a: true, note: '기수 회전 응답 (요 관성 근사)' },
  cdA: { v: 0.55, u: 'm²', a: true, note: '항력계수×투영면적 (수평)' }, cdAv: { v: 1.1, u: 'm²', a: true, note: '수직 방향' },
  rho: { v: 1.2, u: 'kg/m³', a: false },
  rotorDrag: { v: 0.15, u: '1/s', a: true, note: '프로펠러 선형 항력 (공기에 대한 수평 속도에 비례)' },
  gpsV: { v: 5, u: 'm/s', a: true, note: 'GPS 모드 최대 수평 속도 명령' },
  climb: { v: 3.0, u: 'm/s', a: true }, sink: { v: 2.5, u: 'm/s', a: true, note: '고도유지 모드 상승·하강 속도 명령 한계' },
  skidDrop: { v: 0.30, u: 'm', a: true, note: '기체 중심 → 스키드 바닥 높이' },
  skidLen: { v: 1.1, u: 'm', a: true }, skidSpan: { v: 0.9, u: 'm', a: true },
  hardSink: { v: 1.2, u: 'm/s', a: true, note: '이 속도 넘게 접지하면 거친 착륙 기록' }, crashSink: { v: 2.6, u: 'm/s', a: true }, crashHs: { v: 2.5, u: 'm/s', a: true },
  eye: { v: 1.6, u: 'm', a: true, note: '조종자 눈높이 (화면 설정)' },
  notModeled: ['배터리 전압 강하', '지면효과', '프로펠러 후류·와류고리', '모터 고장', '자이로·GPS 오차', '실제 비행제어기 이득']
};
const c1p = k => C1P[k].v;

AF.c1 = { tag: 'C1', name: L2('1종 연습기', 'Class-1 trainer'), sub: L2('대형 멀티콥터 · 1종 실기시험 연습용', 'Large multicopter · class-1 practical practice'), cls: 'quad', c1: true,
  top: 10, vmax: { train: 5, easy: 5, sport: 10 }, tilt: { train: 18, easy: 18, sport: 25 }, climb: 2, sink: 1.5, yaw: 70, tw: 2.0, R: 0.75, endur: 20,
  note: L2('1종 실기 연습 전용 · ※ 제원·비행 특성은 실제 기체 정보가 아닙니다', 'Class-1 practice only · ※ specs and handling are not real aircraft data') };
AF.c1.id = 'c1'; AF_IDS.push('c1');
MS_OK.class1 = ['c1']; MS_OK.class1x = ['c1']; MS_OK.class1d = ['c1'];
MS_NAME.class1 = L2('1종 실기 학습', 'Class-1 practice (learn)'); MS_NAME.class1d = L2('1종 시범비행', 'Class-1 demo flight'); MS_NAME.class1x = L2('1종 모의평가', 'Class-1 mock check');
MS_CAT.class1 = MS_CAT.class1x = MS_CAT.class1d = 'exam'; CAT_C.exam = '#c9a2ff';
const C1DISC = () => L2('※ 기체 제원과 비행 특성은 실제 기체 정보가 아닌 연습용 설정입니다.', '※ Aircraft specs and handling are practice settings, not real aircraft data.');
BRIEF.class1 = [L2('무인멀티콥터 1종 실기 · 학습', 'Unmanned multicopter class 1 · learn'),
  L2('평탄 시험장에서 이륙·호버링·전후진·삼각·원주·비상·정상접근·측풍접근 순서로 연습합니다. 경로·허용구역·타이머를 보여 줍니다.', 'Practise takeoff, hover, forward/back, triangle, circle, emergency, normal and crosswind approach on a flat test field, with path, tolerance box and timers shown.'),
  L2('영인산 야전 착륙장 옆 시험장 · 시험위원 방송(기기 음성) · 🗣 내 구호(Q · 기기 음성이 대신 외침) · 🎤 직접 말하면 음성인식 · 다음 ▶(Enter) · GPS 스위치(H) · 🚨 비상(E) · 시점(C) · 시야 넓게/좁게(Z) · 기체 등: 앞 초록 · 뒤 빨강, 조명(L) 켜면 흰 섬광 · 공식 시험·교육시간 인정 여부는 확인되지 않았습니다.', 'Test field beside the Yeonginsan airstrip · examiner announcements (device voice) · 🗣 MY CALL (Q · device voice) · 🎤 say it yourself (speech recognition) · NEXT ▶ (Enter) · GPS switch (H) · 🚨 EMER (E) · VIEW (C) · view width (Z) · nav lights: green front · red rear, light (L) adds a white strobe · Not an official test or training hours.') + ' ' + C1DISC()];
BRIEF.class1x = [L2('무인멀티콥터 1종 · 모의평가', 'Unmanned multicopter class 1 · mock check'),
  L2('호명·비행 전 점검·조종기 점검·시동부터 전체 기동, 구술 5문항까지 실제 시험 순서로 진행하고 항목별 S/U 모의판정을 받습니다. 공중경계·판단력은 미평가로 남습니다.', 'Run the real order — call-up, pre-flight and transmitter checks, start, all manoeuvres and a 5-question oral — and get a per-item S/U mock verdict. Lookout and judgement stay unrated.'),
  L2('모의판정은 앱 기준이며 합격·자격 판정이 아닙니다.', 'Mock verdicts follow app rules; they are not a pass or a certificate.') + ' ' + C1DISC()];
BRIEF.class1d = [L2('무인멀티콥터 1종 · 시범비행', 'Unmanned multicopter class 1 · demo flight'),
  L2('자동 조종으로 시험 전체 순서를 보여 줍니다. 시험위원 지시, 응시자 구호, 정지 5초 세기, 각 기동의 관전 포인트를 화면 위에 안내합니다. 직접 조종할 필요는 없습니다.', 'An autopilot flies the whole test order: examiner instructions, candidate calls, the 5-second hold count, and what to watch in each manoeuvre are shown on screen. No flying needed.'),
  L2('시점(C) · 시야(Z) · 일시정지(Esc) · 숫자키로 기동 건너뛰기. 시범은 앱의 연습 기준으로 비행하며 실제 시험의 모범답안이 아닙니다.', 'View (C) · width (Z) · pause (Esc) · number keys jump to a manoeuvre. The demo flies to the app\'s practice rules; it is not an official model answer.') + ' ' + C1DISC()];
function isC1(k) { k = k || S.kind; return k === 'class1' || k === 'class1x' || k === 'class1d'; }

// ---- 시험장 좌표 (u = 조종자 오른쪽, v = 전방, 단위 m) ----
// 세부평가기준 배치도: P→H 15 m, H→A 7.5 m, A→E 40 m, A→B·D 7.5 m, F 는 H 와 같은 줄의 좌·우 7.5 m, H·F 2×2 m
var C1S = { x: 14000, z: 14000, y: 0, h: 0, real: false };   // h: 전방(v) 방위 · real: 실제 지형 위에 다져 넣은 시험장
const C1PT = { P: [0, 0], H: [0, 15], A: [0, 22.5], B: [-7.5, 22.5], C: [0, 30], D: [7.5, 22.5], E: [0, 62.5], FB: [-7.5, 15], FD: [7.5, 15] };
const C1FIELD = { u0: -17.5, u1: 17.5, v0: -2.4, v1: 77.6, src: 'app' };   // 80×35 m 부지 경계 (P 와 경계 사이 여백은 앱 설정)
function c1W(u, v, h) { const fx = Math.sin(C1S.h), fz = -Math.cos(C1S.h), rx = Math.cos(C1S.h), rz = Math.sin(C1S.h); return new V3(C1S.x + rx * u + fx * v, C1S.y + (h || 0), C1S.z + rz * u + fz * v); }
function c1UV(p) { const dx = p.x - C1S.x, dz = p.z - C1S.z; return [dx * Math.cos(C1S.h) + dz * Math.sin(C1S.h), dx * Math.sin(C1S.h) - dz * Math.cos(C1S.h)]; }
function c1Gnd() { return C1S.real ? groundAt(DR.p.x, DR.p.z) : C1S.y; }
// ---- 영인산 야전 착륙장 옆에 시험장 자리 찾기: 80×35 m(+여백) 가 가장 평평하고, 활주로·계류장·코스 물체와 겹치지 않는 곳 → 지형을 그 높이로 다짐 ----
function c1Place() {
  try {
    if (!RWY || !TER.h || window.SIM_C1_FAR) return false;
    const ap = RWY.at(0, RWY.sg * (RWY.Wd / 2 + 40)), n = TER.n, st = TER.step, hu = 22.5, v0 = -10, v1 = 85;   // 다질 범위 (u ±22.5, v -10~85)
    const inTer = (x, z) => { const fx = (x - GS0) / st, fy = (GD1 + z) / st; return fx > 3 && fy > 3 && fx < n - 4 && fy < n - 4; };
    const rl = p => rwyLocal(p);
    let best = null;
    for (let R = 50; R <= 260; R += 15) for (let a = 0; a < 360; a += 15) for (let hd = 0; hd < 360; hd += 15) {
      const h = hd * DEG, fx = Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = Math.sin(h);
      const px = ap.x + Math.sin(a * DEG) * R, pz = ap.z - Math.cos(a * DEG) * R;   // P(조종자) 위치
      const W2 = (u, v) => [px + rx * u + fx * v, pz + rz * u + fz * v];
      if (Math.hypot(px - FLY_C.x, pz - FLY_C.z) > FLY_R_SAFE - 120) continue;
      let ok = true, mn = 1e9, mx = -1e9, sum = 0, cnt = 0, tr = 0;
      for (let v = v0; v <= v1 && ok; v += 5) for (let u = -hu; u <= hu; u += 5) {
        const [x, z] = W2(u, v); if (!inTer(x, z)) { ok = false; break; }
        const q = rl({ x, z }); if (Math.abs(q.t) < RWY.L / 2 + 175 && Math.abs(q.w) < 20) { ok = false; break; }   // 활주로·접근로
        if (q.w * RWY.sg > RWY.Wd / 2 - 2 && q.w * RWY.sg < RWY.Wd / 2 + 66 && Math.abs(q.t) < 36) { ok = false; break; }   // 유도로·계류장
        const y = terrainAt(x, z); mn = Math.min(mn, y); mx = Math.max(mx, y); sum += y; cnt++;
        _c1r.set(x, y + 1.5, z); if (collide(_c1r, 2)) { ok = false; break; }
        if (STREES.col && STREES.col(_c1r.set(x, y + 3, z), 1.5)) tr++;
      }
      if (!ok) continue;
      // 조종자(P)가 계류장 쪽을 등지고 서도록: P 가 시험장 끝(계류장에 가까운 쪽)에 오게
      const [cx, cz] = W2(0, 37.6), dP = Math.hypot(px - ap.x, pz - ap.z), dC = Math.hypot(cx - ap.x, cz - ap.z);
      if (dP > dC) continue;
      const sc = (mx - mn) * 1.0 + tr * 0.04 + R * 0.01;
      if (!best || sc < best.sc) best = { sc, px, pz, h, y: sum / cnt, range: mx - mn };
    }
    if (!best || best.range > 14) return false;
    // 지형 다짐: 안쪽은 평평하게, 바깥 18 m 는 원래 지형으로 부드럽게 이어짐 (흙 비탈)
    const { px, pz, h } = best, fx = Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = Math.sin(h), mg = 18;
    let ys = []; for (let v = v0; v <= v1; v += 5) for (let u = -hu; u <= hu; u += 5) ys.push(terrainAt(px + rx * u + fx * v, pz + rz * u + fz * v));
    ys.sort((a, b) => a - b); const y0 = ys[ys.length >> 1];
    const H = TER.h; let changed = 0;
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const x = GS0 + ix * st, z = -GD1 + iy * st, dx = x - px, dz = z - pz, u = dx * rx + dz * rz, v = dx * fx + dz * fz;
      const ou = Math.max(0, Math.abs(u) - hu), ov = Math.max(0, v0 - v, v - v1), o = Math.hypot(ou, ov); if (o >= mg) continue;
      const k = o <= 0 ? 1 : 1 - smooth01(0, 1, o / mg); const i = iy * n + ix; H[i] = H[i] * (1 - k) + y0 * k; changed++;
    }
    applyTerrain(H);
    if (STREES.hideRect) { const c = [px + fx * 37.6, pz + fz * 37.6]; STREES.hideRect(c[0], c[1], fx, fz, (v1 - v0) + 2 * mg, 2 * hu + 2 * mg);
      const c2 = [px + fx * 135, pz + fz * 135]; STREES.hideRect(c2[0], c2[1], fx, fz, 90, 110); }   // 기체 뒤 배경 나무를 더 멀리 (조종자 시야에서 기체가 나무에 묻히지 않게)
    Object.assign(C1S, { x: px, z: pz, y: y0, h, real: true, range: +best.range.toFixed(1), cells: changed });
    return true;
  } catch (e) { console.warn('class1 site', e); return false; }
}

var C1 = { on: false, exam: false, side: -1, mode: 'gps', view: 'pilot', armed: false, ref: null, refDesc: null, mi: 0, si: 0, M: [], ev: [], t: 0, az: 0, yr: 0, hold: null, ei: new V3(), touch: null, over: false };

// ---- 기동 정의 ----
// 단계 종류: prep(확인) · arm · climb(이륙 상승·기준고도) · hold · move · arc · callout · emg · land · disarm · xfer(평가 제외 이동)
function c1Build(side) {
  const L = side < 0, s = side, P = C1PT, SB = L ? P.B : P.D, SD = L ? P.D : P.B, F = L ? P.FB : P.FD;
  const nm = (ko, en) => L2(ko, en), sideKo = L ? '좌' : '우', sideEn = L ? 'left' : 'right', oKo = L ? '우' : '좌', oEn = L ? 'right' : 'left';
  const H0 = (at, hdg, T, lab, o) => Object.assign({ k: 'hold', at, r: 0, hdg, T: T || c1R('hoverT'), lab }, o || {});
  // 구호(call): 교육원 게시판 "드론 비행 구호" 순서를 따름 (교육 현장 관행 · 공식 기준서 아님) · '비상'만 기준서 필수 · 나머지는 기록만
  // count: 버튼으로 구호하면 정지 지점 도착 때 "정지" → 1초마다 하나~다섯 · after: 그 기동을 마칠 때 덧붙이는 "…완료"
  const C = (ko, en, kw, count, after) => ({ ko, en, kw, count: !!count, after: after || null });
  const STOP = (pre, preEn, after) => C(pre || '', preEn || '', pre ? ['정지', '하나', '다섯', pre.split(' ')[0]] : ['정지', '하나', '다섯'], true, after);
  const A = (ko, en) => ({ k: 'ann', ko, en, lab: nm('시험위원 지시', 'Examiner instruction') });   // 시험위원 방송 (앱 작성 문구 · 끌 수 있음)
  const nB = L ? 'B' : 'D', nD = L ? 'D' : 'B', clkA = L ? '9시' : '3시', clkB = L ? '3시' : '9시', clkAen = L ? '9 o\'clock' : '3 o\'clock', clkBen = L ? '3 o\'clock' : '9 o\'clock';
  const air = () => { const w = c1WindInfo(); return C(`좌측 숲, 전방 산, 우측 숲 이상무, ${w.sp ? `풍향 ${w.dirKo}, 풍속 ${w.sp}미터` : '풍향 및 풍속 무풍'}, 전방시계 300미터 확보, 공역확인 완료`, `Left: trees, front: hills, right: trees, clear. ${w.sp ? `Wind ${w.dirEn}, ${w.sp} metres per second` : 'Wind calm'}. Visibility 300 metres. Airspace check complete`, ['공역', '이상무', '시계'], false); };
  return [
    { id: 'pre', name: nm('비행 전 절차', 'Pre-flight'), steps: [
      A(`응시자 ${pilotName()}, 조종자 위치로 이동하여 비행 전 점검을 실시하십시오.`, `Candidate ${pilotName()}, go to the pilot position and carry out the pre-flight inspection.`),
      { k: 'inspect', lab: nm('비행 전 기체점검: 항목마다 정상/불량 판정', 'Pre-flight aircraft check: judge each item OK / faulty'), call: C('배터리 설치, 프로펠러, 모터, 모터베이스, 변속기 이상무, 암대, 메인프레임, 랜딩스키드 이상무', 'Battery installed. Propellers, motors, motor mounts, ESCs OK. Arms, main frame, landing skids OK', ['프로펠러', '이상무']) },
      { k: 'rc', lab: nm('조종기 점검: 구호하면 다음으로 (스틱 끝까지 움직여 보기는 선택) · 모드 스위치 GPS', 'Transmitter check: make the call to move on (full stick travel optional) · mode switch GPS'), call: C('안테나, GPS 모드, 조이스틱 이상무, 조종기 ON, 기체배터리 연결, 조종기 화면 작업 실행, GPS 수신 완료, 아워메타 확인, 비행 전 기체점검 완료, 조종자 위치로', 'Antenna, GPS mode, sticks OK. Transmitter on, flight battery connected, ground-station task running, GPS fix complete, hour meter checked. Pre-flight check complete. To the pilot position', ['조이스틱', '기체점검', '완료', '조종자']) },
      { k: 'prep', lab: nm('공역 확인 (좌·전방·우·바람·시계) · 구호 또는 Enter', 'Airspace check (left, front, right, wind, visibility) · call or Enter'), call: air() },
      { k: 'arm', csc: true, lab: nm('시동: 두 스틱을 아래 안쪽(또는 바깥쪽)으로 · 또는 Enter', 'Start: both sticks down-in (or down-out) · or Enter'), call: C('시동', 'Start', ['시동']) }] },
    { id: 'to', name: nm('이륙비행 · 이륙 후 기체점검', 'Takeoff · after-takeoff check'), ann: ['이륙하십시오.', 'Take off.'], steps: [
      { k: 'climb', at: P.H, lab: nm('H 에서 수직 상승 → 3~5 m 에서 정지 (기준고도 설정)', 'Climb vertically from H → stop at 3–5 m (sets reference height)'), call: C('이륙', 'Takeoff', ['이륙']) },
      H0(P.H, 0, 0, nm('정지 (기준고도)', 'Hold (reference height)'), { posWatch: true, call: STOP('', '') }),
      { k: 'ctl', at: P.H, lab: nm('이륙 후 기체점검: 구호하면 다음으로 (엘리베이터·에일러론·러더를 살짝 움직여 보기 권장)', 'After-takeoff check: make the call to move on (small elevator, aileron, rudder inputs recommended)'), call: C('엘리베이터 이상무, 에일러론 이상무, 러더 이상무, 이륙 후 기체점검 완료', 'Elevator OK, aileron OK, rudder OK. After-takeoff check complete', ['엘리베이터', '러더', '점검', '완료']) },
      { k: 'xfer', to: P.A, lab: nm('호버링 위치(A)로 이동 (평가 제외)', 'Move to the hover point A (not scored)'), call: C('호버링 위치로', 'To the hover point', ['호버링', '위치']) }] },
    { id: 'hov', name: nm('좌우측 호버링', 'Side hovering'), ann: ['좌우측 호버링을 실시하십시오.', 'Carry out the side hovering.'], steps: [
      H0(P.A, 0, 0, nm('A 에서 기준고도·기수 전방 정지', 'Hold at A, reference height, nose forward'), { call: STOP('', '') }),
      H0(P.A, 90 * s, 0, nm(`${sideKo}로 90° 회전 → 정지`, `Turn 90° ${sideEn} → hold`), { posWatch: true, rot: true, call: STOP(`${sideKo}측 호버링`, `${L ? 'Left' : 'Right'} side hover`) }),
      H0(P.A, -90 * s, 0, nm(`${oKo}로 180° 회전 → 정지`, `Turn 180° ${oEn} → hold`), { posWatch: true, rot: true, call: STOP(`${oKo}측 호버링`, `${L ? 'Right' : 'Left'} side hover`) }),
      H0(P.A, 0, 0, nm(`${sideKo}로 90° 회전해 기수 전방 → 정지`, `Turn 90° ${sideEn} to face forward → hold`), { posWatch: true, rot: true, call: STOP('기수 전방', 'Nose forward', ['좌우측 호버링 완료', 'Side hovering complete']) })] },
    { id: 'fb', name: nm('전진 및 후진 수평비행', 'Forward & backward'), ann: ['전진 및 후진 수평비행을 실시하십시오.', 'Carry out level forward and backward flight.'], steps: [
      { k: 'move', from: P.A, to: P.E, hdg: 0, lab: nm('A → E 40 m 수평 전진', 'A → E, 40 m forward'), alongTol: c1R('eAlong'), call: C('전진', 'Forward', ['전진']) },
      H0(P.E, 0, c1R('hoverTE'), nm('E 정지 3초 이상 (전후 5 m 인정)', 'Hold at E ≥ 3 s (±5 m along)'), { alongTol: c1R('eAlong'), call: STOP('', '') }),
      { k: 'move', from: P.E, to: P.A, hdg: 0, lab: nm('E → A 40 m 수평 후진 (기수 전방)', 'E → A, 40 m backward (nose forward)'), call: C('후진', 'Backward', ['후진']) },
      H0(P.A, 0, 0, nm('A 정지', 'Hold at A'), { call: STOP('', '', ['전진 및 후진 수평비행 완료', 'Forward and backward flight complete']) })] },
    { id: 'tri', name: nm('삼각비행', 'Triangle'), ann: ['삼각비행을 실시하십시오.', 'Carry out the triangle.'], steps: [
      { k: 'move', from: P.A, to: SB, hdg: 0, lab: nm(`A → ${nB} 수평 이동`, `A → ${nB} level`), call: C(`${clkA}방향으로 이동`, `Moving to ${clkAen}`, ['방향', '이동']) },
      H0(SB, 0, 0, nm('정지', 'Hold'), { call: STOP('', '') }),
      { k: 'move', from: SB, to: P.A, r1: c1R('triRise'), hdg: 0, lab: nm('A 상공 기준고도+7.5 m 로 45° 상승', '45° climb to reference +7.5 m above A'), call: C('호버링 위치로 상승', 'Climbing to the hover point', ['상승']) },
      H0(P.A, 0, 0, nm('정지 (최고점)', 'Hold (apex)'), { r: c1R('triRise'), call: STOP('', '') }),
      { k: 'move', from: P.A, r0: c1R('triRise'), to: SD, hdg: 0, lab: nm(`${nD} 로 45° 하강`, `45° descent to ${nD}`), desc: true, call: C(`${clkB} 방향으로 하강`, `Descending to ${clkBen}`, ['하강']) },
      H0(SD, 0, 0, nm('정지', 'Hold'), { call: STOP('', '') }),
      { k: 'move', from: SD, to: P.A, hdg: 0, lab: nm('A 로 수평 이동', 'Level to A'), call: C('호버링 위치로 이동', 'Back to the hover point', ['호버링', '이동']) },
      H0(P.A, 0, 0, nm('정지', 'Hold'), { call: STOP('', '', ['삼각비행 완료', 'Triangle complete']) }),
      { k: 'xfer', to: P.H, lab: nm('H 로 후진 이동 (평가 제외)', 'Back up to H (not scored)') }] },
    { id: 'cir', name: nm('원주비행 (러더턴)', 'Circle (rudder turn)'), ann: ['원주비행을 실시하십시오.', 'Carry out the circle.'], steps: [
      H0(P.H, 0, 0, nm('H 상공 기준고도·기수 전방 정지', 'Hold over H, nose forward'), { call: STOP('원주비행 위치로', 'To the circle position') }),
      H0(P.H, 90 * s, 0, nm(`기수 ${sideKo}로 90° → 정지`, `Nose 90° ${sideEn} → hold`), { posWatch: true, rot: true, call: STOP('원주비행 준비', 'Circle, ready') }),
      { k: 'arc', c: P.A, R: 7.5, dir: s, start: P.H, lab: nm(`반경 7.5 m 원주: H → ${nB} → C → ${nD} → H`, `7.5 m circle: H → ${nB} → C → ${nD} → H`), call: C('원주비행 출발', 'Circle, go', ['출발', '원주']) },
      H0(P.H, 90 * s, 0, nm('H 상공 복귀 정지', 'Back over H, hold'), { call: STOP('', '') }),
      H0(P.H, 0, 0, nm(`${oKo}로 90° 회전해 기수 전방 → 정지`, `Turn 90° ${oEn} to face forward → hold`), { posWatch: true, rot: true, call: STOP('기수전방', 'Nose forward', ['원주비행 완료', 'Circle complete']) })] },
    { id: 'emg', name: nm('비상착륙 (비상조작)', 'Emergency landing'), ann: ['비상조작을 실시하십시오.', 'Carry out the emergency procedure.'], steps: [
      H0(P.H, 0, 0, nm('H 상공 기준고도 +2 m 이상 상승 → 정지', 'Climb ≥ 2 m above reference over H → hold'), { altWin: [c1R('emgRise'), c1R('emgRise') + 2.5], posWatch: 'xy', call: C('2미터 상승', 'Climb 2 metres', ['상승', '미터']) }),
      { k: 'callout', lab: nm('"비상" 구호 (E 키·버튼은 기기 음성으로 대신 외침)', 'Call "emergency" (E key / button speaks it for you)'), call: C('비상!', 'Emergency!', ['비상']) },
      { k: 'emg', pad: F, lab: nm(`즉시 하강하며 F(${nB}쪽)로 빠르게 비상 강하 → 착지`, `Descend at once and move fast to F (${nB} side) → touch down`) },
      { k: 'disarm', lab: nm('시동 종료 · Enter', 'Shut down · Enter'), call: C('비상착륙 완료', 'Emergency landing complete', ['비상착륙', '완료']) }] },
    { id: 'nrm', name: nm('정상접근 및 착륙 (자세모드)', 'Normal approach & landing (attitude mode)'), needMode: true, ann: ['자세모드로 전환하여 정상접근 및 착륙을 실시하십시오.', 'Switch to attitude mode and carry out the normal approach and landing.'], steps: [
      { k: 'mode', lab: nm('비행모드를 자세제어(ATTI)로 전환 · GPS 스위치 끄기', 'Switch to attitude (ATTI) · GPS switch off'), call: C('ATTI 모드로 전환', 'Switching to ATTI mode', ['모드', '전환', '에티']) },
      { k: 'arm', csc: true, lab: nm('시동 · 스틱 또는 Enter', 'Start · sticks or Enter'), call: C('시동', 'Start', ['시동']) },
      H0(F, 0, 0, nm('F 에서 기수 전방으로 이륙 → 기준고도 정지', 'Take off from F nose forward → hold at reference height'), { posWatch: 'xy', call: STOP('이륙', 'Takeoff') }),
      { k: 'move', from: F, to: P.H, hdg: 0, lab: nm('H 상공까지 수평 횡이동', 'Sideways level move to over H'), call: C('정상접근', 'Normal approach', ['정상', '접근']) },
      H0(P.H, 0, 0, nm('정지', 'Hold'), { call: STOP('', '') }),
      { k: 'land', pad: P.H, hdg: 0, lab: nm('착륙장 안 착륙지점으로 강하 → 착륙 (중심축 기준)', 'Descend to the touchdown point → land (centre axis)'), call: C('착륙', 'Landing', ['착륙']) },
      { k: 'disarm', lab: nm('시동 종료 · Enter', 'Shut down · Enter'), call: C('정상접근 및 착륙 완료', 'Normal approach and landing complete', ['정상', '완료']) }] },
    { id: 'xw', name: nm('측풍접근 및 착륙', 'Crosswind approach & landing'), ann: ['GPS 모드로 전환 후 측풍접근 및 착륙을 실시하십시오.', 'Switch back to GPS mode and carry out the crosswind approach and landing.'], steps: [
      { k: 'mode', gps: true, lab: nm('GPS 모드로 전환 · GPS 스위치 켜기 (평가 제외)', 'Back to GPS mode · GPS switch on (not scored)'), call: C('GPS 모드로 전환', 'Switching to GPS mode', ['모드', '전환', 'gps', '지피에스']) },
      { k: 'arm', csc: true, lab: nm('시동 · 스틱 또는 Enter (평가 제외)', 'Start · sticks or Enter (not scored)'), call: C('시동', 'Start', ['시동']) },
      { k: 'xfer', to: SB, lab: nm(`이륙 후 기수 전방으로 ${nB} 지점 이동 (평가 제외)`, `Take off and move nose-forward to ${nB} (not scored)`), call: C('이륙, 측풍 접근 위치로', 'Takeoff. To the crosswind start point', ['이륙', '측풍', '위치']) },
      H0(SB, 0, 0, nm(`${nB} 에서 기준고도·기수 전방 정지`, `Hold at ${nB}, nose forward`), { call: STOP('', '') }),
      H0(SB, 90 * s, 0, nm(`바람 쪽(${sideKo})으로 90° 회전 → 정지`, `Turn 90° into the wind (${sideEn}) → hold`), { posWatch: true, rot: true, call: STOP('측풍 대응', 'Crosswind correction') }),
      { k: 'move', from: SB, to: P.H, hdg: 90 * s, lab: nm('측면 상태로 H 상공까지 직선 이동', 'Straight sideways to over H'), call: C('측풍 접근', 'Crosswind approach', ['측풍', '접근']) },
      H0(P.H, 90 * s, 0, nm('정지', 'Hold'), { call: STOP('', '') }),
      { k: 'land', pad: P.H, hdg: 90 * s, lab: nm('강하 → 착륙 (중심축 기준)', 'Descend → land (centre axis)'), call: C('착륙', 'Landing', ['착륙']) },
      { k: 'disarm', lab: nm('시동 종료 · Enter', 'Shut down · Enter'), call: C('측풍접근 및 착륙 완료, 비행 완료', 'Crosswind approach and landing complete. Flight complete', ['측풍', '완료']) }] },
    { id: 'post', name: nm('비행 후 기체점검', 'Post-flight check'), unrated: true, ann: ['비행 후 기체점검을 실시하십시오.', 'Carry out the post-flight check.'], steps: [
      { k: 'prep', lab: nm('아워미터 확인 · 기체배터리·조종기 끄기 · Enter', 'Hour meter · flight battery and transmitter off · Enter'), call: C('아워메타 확인, 기체배터리 OFF, 조종기 OFF', 'Hour meter checked. Flight battery off. Transmitter off', ['아워', '오프', 'off']) },
      { k: 'prep', lab: nm('기체 외관 점검 · Enter', 'Airframe check · Enter'), call: C('프로펠러, 모터, 모터베이스, 변속기 이상무, 암대, 메인프레임, 랜딩스키드 이상무', 'Propellers, motors, motor mounts, ESCs OK. Arms, main frame, landing skids OK', ['프로펠러', '이상무']) },
      { k: 'prep', lab: nm('배터리 분리·점검 · 기체 원위치 · 비행기록 · Enter (기록 내보내기는 결과 화면)', 'Battery out and checked · aircraft back · log · Enter (export on the result screen)'), call: C('배터리 분리, 배터리 케이블, 배부름 이상무, 기체 원위치, 비행 후 기체점검 완료', 'Battery out. Cables and swelling OK. Aircraft back in place. Post-flight check complete', ['배터리', '완료']) }] },
    { id: 'oral', name: nm('구술시험 (5문항)', 'Oral exam (5 questions)'), ann: ['구술시험을 시작하겠습니다.', 'The oral exam begins.'], steps: [
      { k: 'oral', lab: nm('구술: 항목별 1문항씩 5문항 (앱 작성 예시 문항)', 'Oral: one question per area, 5 in total (app-written examples)') }] }
  ].map(m => { if (m.ann) m.steps.unshift(A(m.ann[0], m.ann[1])); return m; });
}
// 바람 구호용: 바람이 불어오는 방위(8방위)와 평균 풍속
function c1WindInfo() {
  const sp = WIND.lv === 1 ? 3 : WIND.lv === 2 ? 7 : 0;
  if (!sp) return { sp: 0, dirKo: '무풍', dirEn: 'calm' };
  const fx = -WIND.dir.x, fz = -WIND.dir.z, b = ((Math.atan2(fx, -fz) / DEG) % 360 + 360) % 360, i = Math.round(b / 45) % 8;
  return { sp, dirKo: ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][i] + '풍', dirEn: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][i] };
}
