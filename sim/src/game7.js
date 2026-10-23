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
// ---- 기체 형상: X2D 형상과 별도로 굵은 팔·스키드·큰 프롭 ----
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
  const t = S.simT;
  for (const rb of C1.ribbons) {
    const f = c1Flow(rb.top), sp = Math.hypot(f.x, f.z), yaw = Math.atan2(-f.x, -f.z);
    rb.sp = (rb.sp == null ? sp : rb.sp + (sp - rb.sp) * 0.25); rb.yaw = rb.yaw == null ? yaw : rb.yaw + Math.atan2(Math.sin(yaw - rb.yaw), Math.cos(yaw - rb.yaw)) * 0.3;
    const lift = (Math.PI / 2) * (1 - Math.exp(-rb.sp / 3.2)) * (1 - Math.min(0.6, f.y / 10)), tur = 0.05 + 0.3 * Math.min(1, rb.sp / 6) + Math.min(0.6, f.y / 8);
    for (const st of rb.strips) {
      st.pv.rotation.set(0, rb.yaw + st.off * (0.25 + 0.6 * Math.exp(-rb.sp / 2)) + Math.sin(t * st.f * 0.6 + st.ph) * tur * 0.6, 0);
      st.m.rotation.x = lift + Math.sin(t * st.f + st.ph) * tur * 0.5;
    }
  }
}
// 항법등 크기: 화면에서 최소 몇 픽셀로 보이게 (멀리 있어도 점으로 보임)
function c1NavTick() {
  const m = typeof droneM !== 'undefined' && droneM && droneM.nav; if (!m || !m.length) return;
  const cam = (typeof c1VRon === 'function' && c1VRon()) ? C1XR.cam : camera, d = Math.max(0.5, cam.position.distanceTo(DR.p));
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
  const line = (pts, col, op) => { const g = new THREE.BufferGeometry().setFromPoints(pts); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: op < 1, opacity: op || 1 })); G0.add(l); return l; };
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
  // 수술(리본 다발): 고깔 위 짧은 막대 끝에 매달림 → 바람 · 기체 하강풍(다운워시)에 날림
  const pole = new THREE.Mesh(UCYL, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 })); pole.scale.set(0.012, 0.75, 0.012); pole.position.copy(c1W(uv[0], uv[1], 0.5 + 0.375)); G0.add(pole);
  const top = c1W(uv[0], uv[1], 1.24), strips = [];
  const cols = [0xff3b3b, 0xffe14a, 0x3bb0ff, 0xffffff, 0xff3b3b, 0xffe14a, 0x3bb0ff, 0xffffff];
  cols.forEach((col, k) => { const pv = new THREE.Group(); pv.position.copy(top); G0.add(pv);
    const g = new THREE.PlaneGeometry(0.07, 0.7); g.translate(0, -0.35, 0);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 0.7 })); m.castShadow = true; pv.add(m);
    strips.push({ pv, m, off: (k / cols.length - 0.5) * 0.9, ph: Math.random() * 6, f: 6 + Math.random() * 5 }); });
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
  if (!on) { if (C1.on || C1.sun) { SUN_DIR.copy(SUN0); C1.sun = null; } C1.on = false; }
  C1ON = on && !C1S.real;
  const p = $('c1p'); if (p && (!on || S.state === 'menu' || S.state === 'result')) p.classList.add('hidden');
  if (ui.map) ui.map.style.display = on ? 'none' : '';
  const kh = $('keys'); if (kh) kh.style.display = on ? 'none' : '';
  document.body.classList.toggle('c1on', on && S.state !== 'menu');
}

// ---- 비행 모델 (최소 모델 · 120 Hz 고정 스텝에서 호출) ----
function c1Wind(p) {
  const base = WIND.lv === 1 ? 3 : WIND.lv === 2 ? 7 : 0;
  if (!base) return _c1w.set(0, 0, 0);
  if (C1S.real) return windAt(p);   // 실제 지형 위: 지형 따라 바뀌는 바람 (다른 임무와 같은 모델)
  const t = C1.t, agl = Math.max(0.5, p.y - C1S.y);
  const prof = clamp(Math.log((agl + 1) / 0.03) / Math.log(11 / 0.03), 0.4, 1.15);   // 지면 거칠기 0.03 m 가정 · 10 m 에서 1
  const gust = 1 + 0.22 * Math.sin(t * 0.9) * Math.sin(t * 0.37) + 0.1 * Math.sin(t * 2.3 + 1.1);   // 반복 가능한 돌풍 (시각 = 이번 비행 경과시간)
  const sw = 0.15 * Math.sin(t * 0.21);
  const c = Math.cos(sw), s = Math.sin(sw), k = base * prof * gust;
  return _c1w.set((WIND.dir.x * c - WIND.dir.z * s) * k, 0, (WIND.dir.x * s + WIND.dir.z * c) * k);
}
const _c1w = new V3(), _c1a = new V3(), _c1f = new V3(), _c1r = new V3();
function c1Phys(dt) {
  const m = c1p('flightKg'), Tmax = c1p('thrustMaxN'), g = G, aUpMax = Tmax / m - g, md = C1.mode;
  const gy = c1Gnd() + c1p('skidDrop');
  const onG = DR.p.y <= gy + 0.005;
  if (C1.demo && S.state === 'run') c1DemoCtl();
  const ip = IN.pitch, ir = IN.roll, iy = IN.yaw, it = IN.thr;
  const FW = _c1f.set(Math.sin(DR.h), 0, -Math.cos(DR.h)), RT = _c1r.set(Math.cos(DR.h), 0, Math.sin(DR.h));
  const wv = c1Wind(DR.p);
  // 1) 수평: 모드별 기울기 명령
  let pc = 0, rc = 0;
  if (C1.armed && !(onG && it <= 0.05)) {
    if (md === 'gps') {
      const tilt = c1p('tiltGps') * DEG, aLim = g * Math.tan(tilt);
      const stick = Math.abs(ip) > 0.04 || Math.abs(ir) > 0.04;
      const ac = _c1a.set(0, 0, 0);
      if (stick) {
        C1.hold = null; C1.ei.set(0, 0, 0);
        const vc = FW.clone().multiplyScalar(ip * c1p('gpsV')).addScaledVector(RT, ir * c1p('gpsV'));
        ac.set((vc.x - DR.v.x) * 1.8, 0, (vc.z - DR.v.z) * 1.8);
      } else {
        if (!C1.hold && Math.hypot(DR.v.x, DR.v.z) < 0.25) C1.hold = DR.p.clone();
        if (C1.hold) { const ex = C1.hold.x - DR.p.x, ez = C1.hold.z - DR.p.z; C1.ei.x = clamp(C1.ei.x + ex * dt, -2, 2); C1.ei.z = clamp(C1.ei.z + ez * dt, -2, 2); ac.set(ex * 0.9 + C1.ei.x * 0.25, 0, ez * 0.9 + C1.ei.z * 0.25); }
        ac.x -= DR.v.x * 1.7; ac.z -= DR.v.z * 1.7;
      }
      const al = Math.hypot(ac.x, ac.z); if (al > aLim) ac.multiplyScalar(aLim / al);
      pc = Math.atan((ac.x * FW.x + ac.z * FW.z) / g); rc = Math.atan((ac.x * RT.x + ac.z * RT.z) / g);
    } else { const tm = c1p('tiltMax') * DEG; pc = ip * tm; rc = ir * tm; }
  }
  const ka = 1 - Math.exp(-dt / c1p('tauAtt')), rl = c1p('attRate') * DEG * dt;
  DR.pitch += clamp((pc - DR.pitch) * ka, -rl, rl); DR.roll += clamp((rc - DR.roll) * ka, -rl, rl);
  // 2) 기수: 회전 속도 명령 → 1차 응답
  const yc = C1.armed && !onG ? iy * c1p('yawMax') * DEG : 0;
  C1.yr += (yc - C1.yr) * (1 - Math.exp(-dt / c1p('tauYaw'))); DR.h = wrapA(DR.h + C1.yr * dt);
  // 3) 수직: 고도유지(GPS·ATTI) = 상승률 명령 / 수동 = 스로틀이 곧 추력 (가운데 = 정지 추력 가정)
  let azc;
  if (!C1.armed) azc = -g;
  else if (md === 'manual') azc = it >= 0 ? it * aUpMax * 0.6 : it * g * 0.55;
  else {
    let vzc;
    if (Math.abs(it) > 0.05) { vzc = it > 0 ? it * c1p('climb') : it * c1p('sink'); C1.altT = null; }
    else { if (C1.altT == null && Math.abs(DR.v.y) < 0.15) C1.altT = DR.p.y; vzc = C1.altT == null ? 0 : clamp((C1.altT - DR.p.y) * 1.2, -0.8, 0.8); }
    if (onG && it <= 0.05) { vzc = 0; C1.altT = null; }
    azc = clamp((vzc - DR.v.y) * 3.0, -g * 0.6, aUpMax * 0.8);
  }
  C1.az += (azc - C1.az) * (1 - Math.exp(-dt / c1p('tauMotor')));
  const cosT = Math.cos(DR.pitch) * Math.cos(DR.roll), acc = Math.max(0, g + C1.az);   // 추력 가속도 (기체 위쪽)
  // 4) 힘 → 가속도: 기울어진 추력 + 중력 + 공기에 대한 속도로 항력
  const vrx = DR.v.x - wv.x, vrz = DR.v.z - wv.z, vry = DR.v.y, vh = Math.hypot(vrx, vrz), rho = c1p('rho');
  const kH = 0.5 * rho * c1p('cdA') * vh / m + c1p('rotorDrag'), kV = 0.5 * rho * c1p('cdAv') * Math.abs(vry) / m;
  const ah = acc * cosT > 0 ? acc : 0;
  const axF = ah * Math.sin(DR.pitch) * Math.cos(DR.roll), axR = ah * Math.sin(DR.roll);
  DR.v.x += (FW.x * axF + RT.x * axR - kH * vrx) * dt;
  DR.v.z += (FW.z * axF + RT.z * axR - kH * vrz) * dt;
  DR.v.y += (acc * cosT - g - kV * vry) * dt;
  DR.p.addScaledVector(DR.v, dt);
  DR.thrust = C1.armed ? clamp(acc / (Tmax / m), 0.08, 1) : 0;
  // 5) 지면 (스키드)
  if (DR.p.y <= gy) {
    const vy = DR.v.y, hs = Math.hypot(DR.v.x, DR.v.z), tilt = Math.max(Math.abs(DR.pitch), Math.abs(DR.roll)) / DEG;
    if (!DR.landed) {
      const uv = c1UV(DR.p);
      C1.touch = { t: C1.t, u: uv[0], v: uv[1], h: DR.h / DEG, vy, hs, tilt };
      if (-vy > c1p('crashSink') || hs > c1p('crashHs') || tilt > 30) C1.crash = { why: -vy > c1p('crashSink') ? 'sink' : hs > c1p('crashHs') ? 'speed' : 'tilt', vy, hs, tilt };
      else if (-vy > c1p('hardSink')) c1Ev('hard', { vy: +vy.toFixed(2) });
    }
    DR.p.y = gy; DR.v.y = Math.max(0, DR.v.y); DR.v.x *= Math.exp(-10 * dt); DR.v.z *= Math.exp(-10 * dt);
    DR.pitch *= Math.exp(-8 * dt); DR.roll *= Math.exp(-8 * dt); C1.yr *= Math.exp(-10 * dt);
    if (C1.az < 0) C1.az = 0;
    DR.landed = true;
  } else if (DR.p.y > gy + 0.02) DR.landed = false;
  if (!C1.armed && !onG) C1.crash = C1.crash || { why: 'disarm' };
  if (DR.p.y > c1Gnd() + 60) { DR.p.y = c1Gnd() + 60; DR.v.y = Math.min(0, DR.v.y); }
}

// ---- 측정값 ----
function c1M() {
  const uv = c1UV(DR.p);
  return { u: uv[0], v: uv[1], alt: DR.p.y - C1S.y - c1p('skidDrop'), hdg: c1Wrap((DR.h - C1S.h) / DEG), hs: Math.hypot(DR.v.x, DR.v.z), vy: DR.v.y, yr: Math.abs(C1.yr) / DEG };
}
const c1Wrap = d => { d = ((d + 180) % 360 + 360) % 360 - 180; return d; };   // +179 와 -179 의 차이 = 2°
function c1Still(M) { return M.hs < c1R('stillV') && Math.abs(M.vy) < 0.25 && M.yr < c1R('stillYaw'); }
function c1Ev(type, d) { const m = C1.M[C1.mi], st = m && m.steps[C1.si]; C1.ev.push(Object.assign({ t: +C1.t.toFixed(2), m: m ? m.id : '', s: C1.si, step: st ? st.lab : '', type }, d || {})); }
function c1Fail(st, why, d) {
  const m = C1.M[C1.mi]; if (!m) return;
  if (st && st.fails && st.fails.includes(why)) return;
  if (st) (st.fails = st.fails || []).push(why);
  m.fail = true; (m.why = m.why || []).push({ step: st ? st.lab : '', why, t: +C1.t.toFixed(1) });
  c1Ev('U', Object.assign({ why }, d || {}));
  if (!C1.exam) showMsg('U · ' + c1WhyTxt(why), '#ff9a40', 1.4);
}
function c1WhyTxt(w) {
  return ({ pos: L2('위치 이탈', 'position'), alt: L2('고도 이탈', 'height'), hdg: L2('기수 방향', 'heading'), path: L2('경로 이탈', 'path'), short: L2('정지 시간 부족', 'hold too short'),
    stops: L2('기동 중 멈춤', 'stops during manoeuvre'), mode: L2('GPS 모드로 수행', 'flown in GPS mode'), pad: L2('착륙장 밖', 'outside the pad'), slow: L2('비상 강하 속도 부족', 'emergency descent too slow'),
    pause: L2('비상 강하 중 일시정지 3초 이상', 'emergency pause ≥ 3 s'), pauseAlt: L2('1 m 위에서 일시정지', 'paused above 1 m'), crash: L2('충돌·추락', 'crash'), late: L2('시동·이륙 5분 초과', 'start-to-takeoff over 5 min'),
    ref: L2('기준고도 3~5 m 밖', 'reference height outside 3–5 m'), skip: L2('지점 미통과', 'checkpoint missed'), climbStop: L2('상승 중 멈춤', 'stopped while climbing'), rotStop: L2('회전 중 멈춤', 'stopped while turning'),
    safe: L2('안전거리(14 m)·안전라인 침범', 'inside the 14 m safety radius / line'), hard: L2('거친 접지', 'hard touchdown'), inspect: L2('점검 판정 오류', 'inspection misjudged'), ctl: L2('이륙 후 점검 미실시', 'after-takeoff check not done'), oral: L2('구술 오답', 'oral answer wrong') })[w] || w;
}
// 허용범위 이탈 추적: 짧은 이탈은 기록만, 연속 grace 초 넘으면 U
function c1Dev(st, key, bad, d, dt) {
  const D = st.dv || (st.dv = {}); const x = D[key] || (D[key] = { t: 0, n: 0, max: 0 });
  if (bad) { if (x.t === 0) { x.n++; c1Ev('dev', Object.assign({ key }, d)); } x.t += dt; x.max = Math.max(x.max, x.t); if (x.t >= c1R('grace')) c1Fail(st, key, d); }
  else x.t = 0;
  return bad;
}
function c1AltTgt(st) { return (C1.ref || 4) + (st.r || 0); }
function c1AltBad(st, M) {
  if (st.altWin) { const lo = (C1.ref || 4) + st.altWin[0], hi = (C1.ref || 4) + st.altWin[1]; return M.alt < lo - c1R('altTol') * 0 || M.alt > hi; }
  return Math.abs(M.alt - c1AltTgt(st)) > c1R('altTol');
}

// ---- 단계별 판정 ----
const C1EV = {
  prep(st) { return false; }, mode(st) { return st.gps ? C1.mode === 'gps' : C1.mode !== 'gps'; }, arm() { return C1.armed; }, callout() { return false; }, disarm() { return false; },
  xfer(st, M) { const d = Math.hypot(M.u - st.to[0], M.v - st.to[1]); return d < 1.5 && Math.abs(M.alt - (C1.ref || 4)) < 1.0 && c1Still(M); },
  climb(st, M, dt) {
    const lat = Math.hypot(M.u - st.at[0], M.v - st.at[1]);
    if (M.alt > 0.3) { st.up = true; c1Dev(st, 'pos', lat > c1R('posTol'), { lat: +lat.toFixed(2) }, dt); c1Dev(st, 'hdg', Math.abs(c1Wrap(M.hdg)) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0) }, dt); }
    if (!st.up) return false;
    // 상승 중 멈춤 (3~5 m 도달 전)
    if (M.alt < c1R('refMin') - c1R('altTol') && M.vy < 0.1 && M.alt > 0.6) st.stopT = (st.stopT || 0) + dt; else if (st.stopT) { c1Ev('stop', { d: +st.stopT.toFixed(2) }); if (st.stopT >= c1R('stopShort')) st.longStop = (st.longStop || 0) + 1; else st.shortStop = (st.shortStop || 0) + 1; st.stopT = 0; if ((st.shortStop || 0) >= 2 || (st.longStop || 0) >= 1) c1Fail(st, 'climbStop'); }
    const inRef = M.alt >= c1R('refMin') - c1R('altTol') && M.alt <= c1R('refMax') + c1R('altTol');
    if (M.alt > c1R('refMax') + c1R('altTol') && c1Still(M)) { st.hiT = (st.hiT || 0) + dt; if (st.hiT >= 2 && !st.hiF) { st.hiF = true; c1Fail(st, 'ref', { alt: +M.alt.toFixed(2) }); } if (st.hiT >= 2) { C1.ref = c1R('refMax'); c1Ev('ref', { ref: C1.ref, measured: +M.alt.toFixed(2), note: 'above range → clamped' }); return true; } } else st.hiT = 0;
    st.okT = inRef && c1Still(M) ? (st.okT || 0) + dt : 0;
    if (st.okT >= 1.0) {
      C1.ref = Math.round(clamp(M.alt, c1R('refMin'), c1R('refMax')) * 10) / 10;
      if (M.alt < c1R('refMin') || M.alt > c1R('refMax')) c1Ev('refClamp', { measured: +M.alt.toFixed(2), ref: C1.ref });
      c1Ev('ref', { ref: C1.ref, measured: +M.alt.toFixed(2) });
      if (C1.tArm != null && C1.t - C1.tArm > c1R('takeoffLimit')) c1Fail(st, 'late', { s: +(C1.t - C1.tArm).toFixed(0) });
      return true;
    }
    return false;
  },
  hold(st, M, dt) {
    const tgt = st.at, du = M.u - tgt[0], dv = M.v - tgt[1];
    const posBad = st.alongTol ? (Math.abs(du) > c1R('posTol') || Math.abs(dv) > st.alongTol) : Math.hypot(du, dv) > c1R('posTol');
    const altBad = c1AltBad(st, M), he = c1Wrap(M.hdg - st.hdg), hdgBad = Math.abs(he) > c1R('hdgTol');
    st.err = { lat: Math.hypot(du, dv), alt: M.alt - c1AltTgt(st), hdg: he };
    if (!st.armedEval) {
      if (st.posWatch) { c1Dev(st, 'pos', posBad, { du: +du.toFixed(2), dv: +dv.toFixed(2) }, dt); if (st.posWatch !== 'xy') c1Dev(st, 'alt', altBad, { alt: +M.alt.toFixed(2) }, dt); }
      if (st.rot) {   // 회전 중 멈춤
        const turned = Math.abs(c1Wrap(M.hdg - (st.h0 == null ? (st.h0 = M.hdg) : st.h0))) > 10;
        if (turned && hdgBad && M.yr < 3) st.stopT = (st.stopT || 0) + dt; else if (st.stopT) { c1Ev('rotStop', { d: +st.stopT.toFixed(2) }); st.rotStops = (st.rotStops || 0) + 1; if (st.stopT >= c1R('stopShort') || st.rotStops >= 2) c1Fail(st, 'rotStop'); st.stopT = 0; }
      }
      const ok = !posBad && !altBad && !hdgBad && c1Still(M);
      st.okT = ok ? (st.okT || 0) + dt : 0;
      if (st.okT >= c1R('arriveT')) { st.armedEval = true; st.t = 0; }
      return false;
    }
    const bad = posBad || altBad || hdgBad;
    if (C1.exam) {   // 모의평가: 정지 중 허용범위를 벗어나면 그 정지는 끝 (5초 미만이면 U)
      if (bad) { st.outT = (st.outT || 0) + dt; if (st.outT > 0.4) { if (st.t < st.T) c1Fail(st, 'short', { held: +st.t.toFixed(2), left: posBad ? 'pos' : altBad ? 'alt' : 'hdg' }); return true; } }
      else { st.outT = 0; st.t += dt; }
      return st.t >= st.T;
    }
    if (bad) { c1Dev(st, posBad ? 'pos' : altBad ? 'alt' : 'hdg', true, { held: +st.t.toFixed(2) }, dt); st.t = 0; }   // 학습: 다시 정지하면 처음부터
    else { c1Dev(st, 'pos', false, null, dt); c1Dev(st, 'alt', false, null, dt); c1Dev(st, 'hdg', false, null, dt); st.t += dt; }
    return st.t >= st.T;
  },
  move(st, M, dt) {
    const a = st.from, b = st.to, r0 = st.r0 || 0, r1 = st.r1 || 0, ref = C1.ref || 4;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), tx = dx / L, ty = dy / L;
    const pu = M.u - a[0], pv = M.v - a[1], along = pu * tx + pv * ty, lat = -pu * ty + pv * tx, s = clamp(along / L, 0, 1);
    const altE = ref + r0 + (r1 - r0) * s, altErr = M.alt - altE, he = c1Wrap(M.hdg - st.hdg);
    st.err = { lat, alt: altErr, hdg: he, s };
    if (!st.dep && along > 0.5) { st.dep = true; st.t0 = C1.t; st.vys = 0; st.vyn = 0; }
    const dEnd = Math.hypot(M.u - b[0], M.v - b[1]);
    if (st.dep) {
      c1Dev(st, 'path', Math.abs(lat) > c1R('posTol'), { lat: +lat.toFixed(2) }, dt);
      c1Dev(st, 'alt', Math.abs(altErr) > c1R('altTol'), { alt: +M.alt.toFixed(2), exp: +altE.toFixed(2) }, dt);
      c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0) }, dt);
      if (st.desc && M.vy < -0.1) { st.vys += -M.vy * dt; st.vyn += dt; }
      // 기동 중 멈춤
      const near = dEnd < 1.5 && Math.abs(altErr) < 0.8;
      if (!near && M.hs < c1R('stopV') && Math.abs(M.vy) < c1R('stopV')) st.stopT = (st.stopT || 0) + dt;
      else if (st.stopT) { c1StopEnd(st); }
    }
    if (st.dep && dEnd < (st.alongTol ? 1.2 : 1.0) * c1R('posTol') + 0.5 && Math.abs(altErr) < 1.0) {
      if (st.stopT) c1StopEnd(st);
      if (st.desc && st.vyn > 0.5) { C1.refDesc = st.vys / st.vyn; c1Ev('refDesc', { v: +C1.refDesc.toFixed(2), basis: 'triangle 45° descent mean |vy|' }); }
      return true;
    }
    return false;
  },
  arc(st, M, dt) {
    const cu = st.c[0], cv = st.c[1], du = M.u - cu, dv = M.v - cv, r = Math.hypot(du, dv), th = Math.atan2(du, dv) / DEG;   // 방위: 전방 기준 시계 방향
    const dir = st.dir < 0 ? 1 : -1;   // 좌측 먼저(B) = 시계 방향 (방위 증가)
    if (st.th == null) { st.th = th; st.sweep = 0; st.hit = {}; }
    const dth = c1Wrap(th - st.th); st.th = th; st.sweep += dth * dir;
    const tanH = c1Wrap(th + 90 * dir), he = c1Wrap(M.hdg - tanH), altErr = M.alt - (C1.ref || 4);
    st.err = { lat: r - st.R, alt: altErr, hdg: he, s: st.sweep / 360 };
    if (!st.dep && st.sweep > 4) st.dep = true;
    if (st.dep) {
      c1Dev(st, 'path', Math.abs(r - st.R) > c1R('posTol'), { r: +r.toFixed(2) }, dt);
      c1Dev(st, 'alt', Math.abs(altErr) > c1R('altTol'), { alt: +M.alt.toFixed(2) }, dt);
      c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0), want: +tanH.toFixed(0) }, dt);
      for (const [q, ang] of [['B/D', 90], ['C', 180], ['D/B', 270]]) if (!st.hit[q] && st.sweep >= ang) { st.hit[q] = { r: +r.toFixed(2), hdgErr: +he.toFixed(1) }; c1Ev('cp', { q, r: +r.toFixed(2), hdgErr: +he.toFixed(1) }); if (Math.abs(r - st.R) > c1R('posTol')) c1Fail(st, 'skip', { q }); }
      const near = st.sweep > 340;
      if (!near && M.hs < c1R('stopV')) st.stopT = (st.stopT || 0) + dt; else if (st.stopT) c1StopEnd(st);
      if (st.sweep < -20) c1Fail(st, 'path', { wrongDir: true });
    }
    if (st.sweep >= 350 && Math.hypot(M.u - st.start[0], M.v - st.start[1]) < 1.5) { if (st.stopT) c1StopEnd(st); return true; }
    return false;
  },
  emg(st, M, dt) {
    const pu = st.pad[0], pv = st.pad[1], he = c1Wrap(M.hdg);
    c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTolEmg'), { hdg: +M.hdg.toFixed(0) }, dt);
    if (M.alt > c1R('pauseEmgAlt') && M.vy < -0.1) { st.vs = (st.vs || 0) + (-M.vy) * dt; st.vn = (st.vn || 0) + dt; }
    if (M.vy > 0.25 && M.alt > 0.5) { st.up = (st.up || 0) + dt; if (st.up > 0.5) c1Fail(st, 'path', { climbed: true }); }
    if (M.alt > c1R('pauseEmgAlt') && M.hs < 0.25 && Math.abs(M.vy) < 0.15 && st.vn > 0.5) { st.hiP = (st.hiP || 0) + dt; if (st.hiP > 0.6) c1Fail(st, 'pauseAlt', { alt: +M.alt.toFixed(2) }); } else st.hiP = 0;
    if (M.alt <= c1R('pauseEmgAlt') && M.alt > 0.05 && M.hs < 0.25 && Math.abs(M.vy) < 0.15) { st.pT = (st.pT || 0) + dt; if (st.pT >= c1R('pauseEmg')) c1Fail(st, 'pause', { s: +st.pT.toFixed(2) }); } else st.pT = 0;
    st.err = { lat: Math.hypot(M.u - pu, M.v - pv), alt: M.alt, hdg: he };
    if (DR.landed && C1.touch && C1.touch.t >= (st.t0 || 0)) {
      const mean = st.vn > 0 ? st.vs / st.vn : 0, ref = C1.refDesc || c1R('emgRefDefault');
      st.res = { meanDesc: +mean.toFixed(2), refDesc: +ref.toFixed(2), basis: C1.refDesc ? 'triangle 45° descent' : 'app default', touch: C1.touch };
      c1Ev('emgDesc', st.res);
      if (mean < ref * c1R('emgRatio')) c1Fail(st, 'slow', st.res);
      if (!c1SkidOnPad(C1.touch, st.pad)) c1Fail(st, 'pad', { touch: C1.touch });
      return true;
    }
    return false;
  },
  land(st, M, dt) {
    const du = M.u - st.pad[0], dv = M.v - st.pad[1], he = c1Wrap(M.hdg - st.hdg);
    st.err = { lat: Math.hypot(du, dv), alt: M.alt, hdg: he };
    if (!DR.landed) {
      c1Dev(st, 'pos', Math.hypot(du, dv) > c1R('posTol'), { du: +du.toFixed(2), dv: +dv.toFixed(2) }, dt);
      c1Dev(st, 'hdg', Math.abs(he) > c1R('hdgTol'), { hdg: +M.hdg.toFixed(0) }, dt);
      st.fin = 0; return false;
    }
    if (!st.td && C1.touch) { st.td = C1.touch; c1Ev('touch', { u: +C1.touch.u.toFixed(2), v: +C1.touch.v.toFixed(2), hdg: +C1.touch.h.toFixed(0) }); if (!c1CenterOnPad(C1.touch.u, C1.touch.v, st.pad)) c1Fail(st, 'pad', { touch: true }); }
    st.fin = (st.fin || 0) + dt;
    if (st.fin > 0.8) { if (!c1CenterOnPad(M.u, M.v, st.pad)) c1Fail(st, 'pad', { final: true, u: +M.u.toFixed(2), v: +M.v.toFixed(2) }); c1Ev('final', { u: +M.u.toFixed(2), v: +M.v.toFixed(2) }); return true; }
    return false;
  }
};
function c1StopEnd(st) {
  const d = st.stopT; st.stopT = 0; c1Ev('stop', { d: +d.toFixed(2) });
  if (d >= c1R('stopShort')) st.longStop = (st.longStop || 0) + 1; else st.shortStop = (st.shortStop || 0) + 1;
  if ((st.shortStop || 0) >= 2 || (st.longStop || 0) >= 1) c1Fail(st, 'stops', { short: st.shortStop || 0, long: st.longStop || 0 });
}
// 정상·측풍: 중심축이 착륙장 안 또는 경계에 접함 · 비상: 스키드 일부라도 F 안 또는 접함
function c1CenterOnPad(u, v, pad) { return Math.abs(u - pad[0]) <= 1.0 + 1e-6 && Math.abs(v - pad[1]) <= 1.0 + 1e-6; }
function c1SkidOnPad(t, pad) {
  if (!t) return false; const h = t.h * DEG, L = c1p('skidLen') / 2, Wd = c1p('skidSpan') / 2;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const fx = i / 2 * L, rx = j / 2 * Wd;   // 기수 방향(fx) · 오른쪽(rx)
    const u = t.u + Math.sin(h) * fx + Math.cos(h) * rx, v = t.v + Math.cos(h) * fx - Math.sin(h) * rx;
    if (c1CenterOnPad(u, v, pad)) return true;
  }
  return false;
}

// ---- 시험 시각 → 해 위치 (그림자로 거리감) · 위도 36.8° · 오늘 날짜 · 한국 표준시 기준 태양 정오 약 12:32 ----
function c1Sun() {
  try {
    if (!isC1() || ENV.night || ENV.dusk) return;
    const h = SET.c1hour || 11, d = new Date(), N = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5), phi = 36.8 * DEG;
    const dec = -23.44 * DEG * Math.cos(2 * Math.PI / 365 * (N + 10)), H = 15 * DEG * (h - 12.53);
    const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;   // 북쪽 기준 시계 방향
    let nx = 0, nz = -1, ex = 1, ez = 0;   // 월드에서 북·동 방향 (현장 좌표계에서 구함)
    if (typeof SITE_X !== 'undefined' && SITE_X.toEN) { const a = SITE_X.toEN(0, 0), bd = SITE_X.toEN(1, 0), bs = SITE_X.toEN(0, 1);
      const dEd = bd[0] - a[0], dNd = bd[1] - a[1], dEs = bs[0] - a[0], dNs = bs[1] - a[1], det = dEd * dNs - dEs * dNd;
      const nd = -dEs / det, ns = dEd / det, ed = dNs / det, es = -dNd / det; nx = ns; nz = -nd; ex = es; ez = -ed; const ln = Math.hypot(nx, nz), le = Math.hypot(ex, ez); nx /= ln; nz /= ln; ex /= le; ez /= le; }
    const ce = Math.cos(Math.max(el, 3 * DEG)), se = Math.sin(Math.max(el, 3 * DEG)), sE = Math.sin(az) * ce, sN = Math.cos(az) * ce;
    SUN_DIR.set(ex * sE + nx * sN, se, ez * sE + nz * sN).normalize(); C1.sun = { h, el: +(el / DEG).toFixed(1), az: +(az / DEG).toFixed(0) };
  } catch (e) { }
}
// ---- 진행 ----
function c1Start(a) {
  c1Site(); C1G.visible = true; C1ON = !C1S.real;
  Object.assign(C1, { on: true, exam: S.kind === 'class1x', demo: S.kind === 'class1d', dm: null, sayUntil: 0, mode: 'gps', view: 'pilot', armed: false, ref: null, refDesc: null, mi: 0, si: 0, ev: [], t: 0, az: 0, yr: 0, hold: null, touch: null, crash: null, over: false, tArm: null, altT: null, modeLog: [] });
  C1.ei.set(0, 0, 0);
  C1.side = SET.c1side === 1 ? 1 : -1;
  C1.M = c1Build(C1.side);
  C1.M.forEach(m => { m.done = false; m.miss = false; m.fail = false; m.why = []; m.label = m.name; m.steps.forEach(s => { s.T = s.T || c1R('hoverT'); }); });
  S.cam = 1; ui.map.style.display = 'none'; document.body.classList.add('c1on');
  c1Panel(true); c1ALoad(); c1Sun();
  c1Ev('start', { exam: C1.exam, side: C1.side < 0 ? 'left-first' : 'right-first', profile: C1P.ver, rules: C1RULES.ver, wind: WIND.lv });
  return C1.M;
}
function c1StartPose() { return { p: c1W(C1PT.H[0], C1PT.H[1], c1p('skidDrop')), h: C1S.h }; }
// 단계 충족 표시: 안내창에 ✓ 와 짧은 알림음 (모의평가에서도)
function c1OkFlash(st) {
  if (!st || ['ann', 'oral', 'inspect'].includes(st.k)) return;
  const bad = st.fails && st.fails.length; C1.ok = { text: (bad ? '✗ ' : '✓ ') + st.lab.split(' · ')[0].split(' (')[0], bad: !!bad, t: 2.2 };
  try { if (AU.ctx && !TEST) { const o = AU.ctx.createOscillator(), g = AU.ctx.createGain(); o.frequency.value = bad ? 330 : 880; g.gain.setValueAtTime(0.0001, AU.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, AU.ctx.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, AU.ctx.currentTime + 0.18); o.connect(g); g.connect(AU.master || AU.ctx.destination); o.start(); o.stop(AU.ctx.currentTime + 0.2); } } catch (e) { }
}
function c1Count(x) {
  if (!x || !x.call || !x.call.count || x.callSaid !== 'btn' || x.arrT == null) return;
  if (!x.stopSaid) { x.stopSaid = true; c1Say(L2('정지.', 'Hold.'), 'me'); return; }
  const n = Math.min(5, Math.floor(C1.t - x.arrT + 1e-6)); if (n > (x.cnt || 0)) { x.cnt = n; c1Say(L2(['하나', '둘', '셋', '넷', '다섯'], ['one', 'two', 'three', 'four', 'five'])[n - 1], 'me'); }
}
function c1Next() {
  const m = C1.M[C1.mi]; if (!m) return;
  C1.si++; c1Ev('stepDone');
  if (C1.si >= m.steps.length) {
    m.done = true; m.miss = !!m.fail; C1.si = 0; C1.mi++; MS.idx = C1.mi;
    sfx(m.fail ? 'bad' : 'good'); if (!C1.exam || m.unrated) showMsg(m.name + (m.unrated ? ' · ' + L2('교관 확인', 'instructor check') : m.fail ? ' · U' : ' · S'), m.fail ? '#ff9a40' : '#5dff9a', 1.4);
    renderList();
    if (C1.mi >= C1.M.length) { c1Finish('done'); return; }
    const nm = C1.M[C1.mi]; if (nm.needMode) nm.tStart = C1.t;
  }
  const st = c1Cur(); if (st) { st.t0 = C1.t; if (st.k === 'prep' || st.k === 'disarm' || st.k === 'arm' || st.k === 'callout') st.wait = true; }
}
function c1Cur() { const m = C1.M[C1.mi]; return m ? m.steps[C1.si] : null; }
function c1Step(prev, cur, dt) {
  if (!C1.on || C1.over) return;
  C1.t += dt;
  const m = C1.M[C1.mi], st = c1Cur(); if (!m || !st) return;
  if (C1.crash) {
    const c = C1.crash; C1.crash = null; c1Fail(st, 'crash', c); sfx('crash'); shake = 0.08;
    if (C1.exam) { c1Finish('crash'); return; }
    showMsg(L2('충돌 · 이 기동을 처음부터', 'Crash · restart this manoeuvre'), '#ff5050', 1.8); c1Jump(C1.mi, true); return;
  }
  const M = c1M();
  // 종합: 안전거리 14 m · 안전라인 (조종자 앞쪽 기준선 뒤로 오면 침범)
  if (!DR.landed && (Math.hypot(M.u, M.v) < c1R('safeR') || M.v < 0.6)) { C1.safeT = (C1.safeT || 0) + dt; if (C1.safeT > 0.5 && !C1.safeLogged) { C1.safeLogged = true; c1Ev('safe', { u: +M.u.toFixed(1), v: +M.v.toFixed(1) }); C1.safeBad = true; if (!C1.exam) showMsg(c1WhyTxt('safe'), '#ff5050', 1.4); } } else { C1.safeT = 0; C1.safeLogged = false; }
  // 정상접근: 모든 세부 기동을 자세·수동 모드로 (모드 전환 단계 이후)
  if (m.needMode && C1.si > m.steps.findIndex(x => x.k === 'mode') && C1.mode === 'gps' && !st.fails?.includes('mode')) c1Fail(st, 'mode');
  const fn = C1EV[st.k], done = fn && fn(st, M, dt);
  // 버튼으로 정지 구호를 했으면 정지 지점 도착 때 "정지", 그 뒤 1초마다 "하나…다섯" (단계가 먼저 끝나도 다섯까지, 움직이면 멈춤)
  if (st.call && st.call.count && st.armedEval) { if (st.arrT == null || C1.t - st.arrT > st.t + 0.6) { st.arrT = C1.t - st.t; st.cnt = Math.floor(st.t); } }
  c1Count(st); if (C1V.cst && C1V.cst !== st) { if (M.hs > 0.6 || (C1V.cst.cnt || 0) >= 5 || C1.t - C1V.cst.arrT > 6.5) C1V.cst = null; else c1Count(C1V.cst); }
  if (done) { if (st.call && st.call.count && st.arrT != null && (st.cnt || 0) < 5) C1V.cst = st; if (st.call && st.call.after && st.callSaid === 'btn') c1Say(L2(st.call.after[0], st.call.after[1]), 'me'); c1OkFlash(st); c1Next(); }
}
let _c1dk = false;
function fromDemo(k) { return _c1dk || ['KeyC', 'PadRB', 'KeyZ', 'KeyR'].includes(k) || /^Digit[1-9]$/.test(k); }
function c1DK(k) { _c1dk = true; try { c1Key(k); } finally { _c1dk = false; } }
function c1Key(k, fromVoice) {
  if (!isC1() || S.state !== 'run') return false;
  const st = c1Cur();
  if (C1.demo && !fromDemo(k)) return !['Escape', 'KeyP', 'KeyM', 'Tab', 'KeyF'].includes(k);   // 시범비행: 시점·시야·건너뛰기만 사용자 입력
  if (k === 'KeyY') { c1Mode(); return true; }
  if (k === 'KeyH' || k === 'KeyG') { c1GpsToggle(); return true; }   // GPS 스위치 (보조 버튼·H 키)
  if (st && st.k === 'inspect' && st.open && !st.done && (XR_ON || window.C1_VRTEST) && (k === 'Enter' || k === 'KeyE' || k === 'Space')) {   // VR: 항목마다 A 정상 / X 불량
    const it = C1INS.find(x => !st.ans[x.id]); if (it) { st.ans[it.id] = k === 'KeyE' ? 'bad' : 'ok'; sfx('good'); } if (C1INS.every(x => st.ans[x.id])) c1InspectDone(st); return true; }
  if (st && st.k === 'oral' && st.qs && !st.done && (XR_ON || window.C1_VRTEST) && k === 'Enter') { c1OralAns(st, st.qs[st.qi].ord[C1XR.sel]); C1XR.sel = 0; return true; }
  if (k === 'KeyQ') { if (!c1CallDo('btn') && st && st.call && !C1.exam) showMsg(L2('이 단계 구호는 이미 했습니다', 'Call already made for this step'), '#9aa6ad', 1); return true; }
  if (k === 'KeyE') { if (st && st.k === 'callout' && !st.wait2) { st.wait2 = true; c1CallDo(fromVoice ? 'voice' : 'btn'); c1Ev('callout'); showMsg(L2('"비상!"', '"EMERGENCY!"'), '#ff5050', 1.2); sfx('bad'); c1Next(); const n = c1Cur(); if (n) n.t0 = C1.t; } return true; }
  if (k === 'KeyZ') { const L = [1, 1.3, 0.8], i = (L.indexOf(SET.c1zoom || 1) + 1) % 3; SET.c1zoom = L[i]; saveSet(); showMsg(L2('조종자 시야 ', 'Pilot view ') + [L2('기본', 'normal'), L2('넓게', 'wide'), L2('좁게 (확대)', 'narrow (zoom in)')][i], '#fff', 0.9); return true; }
  if (k === 'KeyC' || k === 'PadRB') { if (!C1.exam) { C1.view = C1.view === 'pilot' ? 'chase' : 'pilot'; showMsg(C1.view === 'pilot' ? L2('조종자 시점', 'Pilot view') : L2('추적 시점 (학습용)', 'Chase view (learning)'), '#4fe3ff', 1); } else showMsg(L2('모의평가는 조종자 시점만', 'Mock check uses the pilot view only'), '#ffc828', 1); return true; }
  if (k === 'Enter' || k === 'Space' || k === 'PadA') { c1Confirm(); return true; }
  if (k === 'KeyR' || k === 'PadY') { if (!C1.exam) { c1Jump(C1.mi, true); showMsg(L2('이 기동 다시', 'Restart this manoeuvre'), '#c9a2ff', 1); } return true; }
  if (k === 'KeyN') { if (!C1.exam) { c1Ev('skipStep'); const m = C1.M[C1.mi]; if (m) m.skipped = true; c1Next(); } return true; }
  if (/^Digit[1-9]$/.test(k) && !C1.exam) { c1Jump(+k.slice(5)); return true; }
  return false;
}
let _c1conf = false;
function c1Confirm() { if (_c1conf) return; _c1conf = true; try { c1Confirm0(); } finally { _c1conf = false; } }
function c1Confirm0() {
  const st = c1Cur(); if (!st) return;
  if (st.k === 'prep') { if (st.call) c1CallDo('btn'); c1Ev('confirm'); c1Next(); }
  else if (st.k === 'arm') { if (DR.landed) { c1Arm('btn'); c1Next(); } }
  else if (st.k === 'disarm') { if (DR.landed && Math.hypot(DR.v.x, DR.v.z) < 0.3) { C1.armed = false; if (st.call) c1CallDo('btn'); c1Ev('disarm'); c1Next(); } else showMsg(L2('착지 후 시동 종료', 'Land first, then shut down'), '#ffc828', 1); }
}
function c1GpsToggle() {
  C1.mode = C1.mode === 'gps' ? 'atti' : 'gps'; C1.hold = null; C1.altT = null; C1.ei.set(0, 0, 0);
  c1Ev('mode', { mode: C1.mode, by: 'gpsSwitch' }); showMsg(c1ModeName(), C1.mode === 'gps' ? '#5dff9a' : '#ffb030', 1.4); sfx('good');
}
function c1Mode() {
  const L = ['gps', 'atti', 'manual']; C1.mode = L[(L.indexOf(C1.mode) + 1) % 3]; C1.hold = null; C1.altT = null; C1.ei.set(0, 0, 0);
  c1Ev('mode', { mode: C1.mode }); showMsg(c1ModeName(), '#c9a2ff', 1.2);
}
function c1ModeName() { return { gps: L2('GPS 모드 (위치·고도 유지)', 'GPS mode (position + height hold)'), atti: L2('자세제어 ATTI (고도 유지 · 위치 유지 없음)', 'ATTI (height hold · no position hold)'), manual: L2('수동 (고도 유지 없음)', 'Manual (no height hold)') }[C1.mode]; }
// ---- 연습 코치: 지금 무엇을 얼마나 고치면 되는지 (모드2 스틱 기준 · 기체 기준 방향) ----
function c1Coach(st, M) {
  const out = [], th = M.hdg * DEG, F = [Math.sin(th), Math.cos(th)], Rt = [Math.cos(th), -Math.sin(th)], wrap = c1Wrap;
  const ref = C1.ref || 4, pT = c1R('posTol'), aT = c1R('altTol'), hT = st.k === 'emg' ? c1R('hdgTolEmg') : c1R('hdgTol');
  const f1 = x => Math.abs(x).toFixed(Math.abs(x) < 10 ? 1 : 0);
  const lv = r => r < 0.5 ? 'g' : r < 1 ? 'y' : 'r';
  const add = (ratio, html) => out.push({ ratio, html: `<div class="${lv(ratio)}">${html}</div>` });
  const side = Math.abs(wrap(M.hdg)) > 45 ? ` <i>(${L2('기체 기준', 'from the aircraft')})</i>` : '';
  // 위치: 목표점까지 차이를 기체 앞/옆으로 나눠 스틱으로
  const pos = (du, dv, tol, what) => {
    const fw = du * F[0] + dv * F[1], rt = du * Rt[0] + dv * Rt[1], d = Math.hypot(du, dv); if (d < 0.12) return;
    const parts = [];
    if (Math.abs(fw) >= 0.12) parts.push(fw > 0 ? L2(`엘리베이터 ↑ 앞으로 ${f1(fw)} m`, `elevator ↑ forward ${f1(fw)} m`) : L2(`엘리베이터 ↓ 뒤로 ${f1(fw)} m`, `elevator ↓ back ${f1(fw)} m`));
    if (Math.abs(rt) >= 0.12) parts.push(rt > 0 ? L2(`에일러론 → 오른쪽 ${f1(rt)} m`, `aileron → right ${f1(rt)} m`) : L2(`에일러론 ← 왼쪽 ${f1(rt)} m`, `aileron ← left ${f1(rt)} m`));
    add(d / tol, `${what || L2('위치', 'Position')} <b>${d.toFixed(1)} m</b> ${L2('벗어남', 'off')} → ${parts.join(' · ')}${side}`);
  };
  const alt = (tgt, tol) => { const e = tgt - M.alt; if (Math.abs(e) < 0.08) return; add(Math.abs(e) / tol, `${L2('고도', 'Height')} <b>${f1(e)} m ${e > 0 ? L2('낮음', 'low') : L2('높음', 'high')}</b> → ${e > 0 ? L2('스로틀 ↑ 살짝', 'throttle ↑ a little') : L2('스로틀 ↓ 살짝', 'throttle ↓ a little')} <i>(${L2('목표', 'target')} ${tgt.toFixed(1)} m ±${tol})</i>`); };
  const hdg = (tgt, tol) => { const e = wrap(tgt - M.hdg); if (Math.abs(e) < 3) return; add(Math.abs(e) / tol, `${L2('기수가', 'Nose')} <b>${f1(e)}° ${e > 0 ? L2('왼쪽으로', 'left') : L2('오른쪽으로', 'right')}</b> ${L2('틀어짐', 'of target')} → ${e > 0 ? L2('러더 → (오른쪽으로)', 'rudder → (right)') : L2('러더 ← (왼쪽으로)', 'rudder ← (left)')} <i>(±${tol}°)</i>`); };
  const good = t => `<div class="g">✓ ${t}</div>`;
  let lead = '';
  if (st.k === 'climb') {
    const lo = c1R('refMin'), hi = c1R('refMax');
    if (M.alt < lo - aT) { lead = M.vy < 0.2 && M.alt > 0.6 ? `<div class="r">⚠ ${L2('상승이 멈췄어요 — 기준고도(3~5 m)까지 한 번에 올리기', 'Climb stalled — go up to 3–5 m in one go')}</div>` : `<div class="y">⬆ ${L2('스로틀 ↑ 로 3~5 m 까지 멈추지 말고 상승', 'Throttle ↑ — climb to 3–5 m without stopping')} <i>(${L2('지금', 'now')} ${M.alt.toFixed(1)} m)</i></div>`; }
    else if (M.alt > hi + aT) lead = `<div class="r">⬇ ${L2('5 m 넘음 → 스로틀 ↓ 로 범위 안으로', 'Above 5 m → throttle ↓ back into range')}</div>`;
    else lead = good(L2('기준고도 범위 안 — 스로틀 중립으로 멈추면 이 높이가 기준고도가 됩니다', 'In range — centre the throttle; this height becomes your reference'));
    pos(st.at[0] - M.u, st.at[1] - M.v, pT); hdg(0, hT);
  } else if (st.k === 'hold') {
    const du = st.at[0] - M.u, dv = st.at[1] - M.v, d = Math.hypot(du, dv);
    if (!st.armedEval && d > 1.5) lead = `<div class="y">➜ ${L2('목표 지점까지', 'To the point')} <b>${d.toFixed(1)} m</b> — ${L2('2 m 전부터 천천히 감속', 'ease off from 2 m out')}</div>`;
    else if (st.armedEval) { const left = Math.max(0, st.T - st.t); lead = left > 0 ? `<div class="g">⏱ ${L2('정지 중', 'Holding')} ${st.t.toFixed(1)} / ${st.T} s — ${L2('스틱은 중립, 아주 작은 수정만', 'sticks centred, tiny corrections only')}</div>` : good(L2('정지 완료', 'Hold complete')); }
    if (st.altWin) { const lo = ref + st.altWin[0], hi = ref + st.altWin[1]; if (M.alt < lo) add((lo - M.alt) / aT, `${L2('고도', 'Height')} <b>${(lo - M.alt).toFixed(1)} m ${L2('더 올리기', 'more')}</b> → ${L2('스로틀 ↑', 'throttle ↑')} <i>(${L2('기준+2 m 이상', 'ref +2 m or more')})</i>`); else if (M.alt > hi) alt(hi, aT); }
    else alt(c1AltTgt(st), aT);
    pos(du, dv, st.posWatch === 'xy' ? pT : pT); hdg(st.hdg, hT);
  } else if (st.k === 'move') {
    const a = st.from, b = st.to, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const al = (M.u - a[0]) * ux + (M.v - a[1]) * uy, cr = -(M.u - a[0]) * uy + (M.v - a[1]) * ux, sp = clamp(al / L, 0, 1);
    const vAl = DR.v.x * (Math.cos(C1S.h) * ux + Math.sin(C1S.h) * uy) + DR.v.z * (Math.sin(C1S.h) * ux - Math.cos(C1S.h) * uy);
    const pc = Math.round(sp * 100), rem = Math.max(0, L - al);
    if (sp > 0.06 && sp < 0.94 && Math.abs(vAl) < c1R('stopV') + 0.1) lead = `<div class="r">⚠ ${L2('멈추면 감점 — 같은 속도로 계속 이동', 'Stopping costs points — keep moving at the same speed')}</div>`;
    else if (vAl > 2.6) lead = `<div class="y">🐢 ${L2('조금 천천히 — 지나치기 쉬워요', 'A bit slower — easy to overshoot')} <i>(${vAl.toFixed(1)} m/s)</i></div>`;
    else lead = `<div class="g">➜ ${pc}% · ${L2('남은 거리', 'to go')} ${rem.toFixed(1)} m · ${Math.max(0, vAl).toFixed(1)} m/s${rem < 3 && rem > 0.3 ? ' — ' + L2('감속 준비', 'start easing off') : ''}</div>`;
    // 경로 옆으로 벗어남 (기체 기준 좌우/앞뒤로 바꿔 안내)
    const pu = -uy * cr, pv = ux * cr; pos(-pu, -pv, pT, L2('경로에서', 'Off the line by'));
    alt(ref + (st.r0 || 0) + ((st.r1 || 0) - (st.r0 || 0)) * clamp(al / L, 0, 1), aT); hdg(st.hdg, hT);
  } else if (st.k === 'arc') {
    const du = M.u - st.c[0], dv = M.v - st.c[1], r = Math.hypot(du, dv), e = r - st.R, sw = Math.round(st.sweep || 0);
    lead = `<div class="g">◯ ${Math.min(360, sw)}° / 360° · ${L2('반경', 'radius')} ${r.toFixed(1)} m (${st.R} m)</div>`;
    if (Math.abs(e) > 0.12) pos(-du / r * e, -dv / r * e, pT, e > 0 ? L2('원 바깥으로', 'Outside the circle') : L2('원 안쪽으로', 'Inside the circle'));
    const tang = c1Wrap(Math.atan2(du, dv) / DEG + 90 * (st.dir < 0 ? 1 : -1)); hdg(tang, hT); alt(ref, aT);
    if (M.hs < 0.35 && sw > 10 && sw < 340) lead = `<div class="r">⚠ ${L2('원주 중간에 멈추지 않기 — 에일러론+러더를 함께 계속', 'Don\'t stop mid-circle — keep aileron and rudder going together')}</div>`;
  } else if (st.k === 'emg') {
    const need = Math.max(c1R('emgRefDefault'), C1.refDesc || 0) * c1R('emgRatio'), vs = -M.vy;
    lead = M.alt > 0.3 ? `<div class="${vs >= need ? 'g' : 'r'}">⬇ ${L2('하강', 'Descent')} <b>${Math.max(0, vs).toFixed(1)} m/s</b> ${vs >= need ? '✓' : '— ' + L2('더 빠르게 (스로틀 ↓ 크게)', 'faster (throttle ↓ more)')} <i>(${L2('필요', 'need')} ≥ ${need.toFixed(1)} m/s)</i></div>` : '';
    pos(st.pad[0] - M.u, st.pad[1] - M.v, 2.5, L2('비상 착륙장(F)까지', 'To the emergency pad (F)'));
  } else if (st.k === 'land') {
    const du = st.pad[0] - M.u, dv = st.pad[1] - M.v, d = Math.hypot(du, dv);
    lead = d > 0.4 ? `<div class="y">⬇ ${L2('먼저 패드 중앙 위로 맞추고 내려오기', 'Line up over the pad centre first, then descend')}</div>` : M.alt > 1 ? `<div class="g">⬇ ${L2('천천히 강하', 'Descend slowly')} <i>(${M.alt.toFixed(1)} m)</i></div>` : `<div class="g">⬇ ${L2('1 m 아래 — 아주 천천히, 접지하면 스로틀 끝까지 ↓', 'Below 1 m — very gently; on touchdown throttle fully ↓')}</div>`;
    pos(du, dv, pT, L2('패드 중심에서', 'From the pad centre')); hdg(st.hdg, hT);
  } else if (st.k === 'xfer') {
    const du = st.to[0] - M.u, dv = st.to[1] - M.v; lead = `<div class="g">➜ ${L2('다음 위치로 이동 (평가 제외)', 'Move to the next position (not scored)')} · ${Math.hypot(du, dv).toFixed(1)} m</div>`;
  } else if (st.k === 'arm' && st.csc && !C1.armed) lead = `<div class="y">🔑 ${L2('두 스틱을 아래·안쪽으로 0.5초 (또는 다음 ▶)', 'Both sticks down-and-in for 0.5 s (or NEXT ▶)')}</div>`;
  else if (st.k === 'mode') lead = `<div class="y">🔀 ${st.gps ? L2('GPS 스위치 ON (H 또는 GPS 버튼)', 'GPS switch ON (H or the GPS button)') : L2('GPS 스위치 OFF → ATTI (H 또는 GPS 버튼) · 이제 바람에 흐르는 것을 직접 잡아야 함', 'GPS switch OFF → ATTI (H or the GPS button) · you now correct drift yourself')}</div>`;
  else if (st.k === 'callout') lead = `<div class="r">📣 ${L2('"비상!" 외치기 (🚨 비상 버튼 또는 E)', 'Call "Emergency!" (🚨 button or E)')}</div>`;
  if (!lead && !out.length) return '';
  out.sort((x, y) => y.ratio - x.ratio);
  const fixes = out.filter(o => o.ratio >= 0.3).slice(0, 3).map(o => o.html).join('');
  const ok = (['hold', 'move', 'arc', 'land', 'climb'].includes(st.k) && !fixes) ? good(L2('위치·고도·기수 모두 허용범위 안 — 그대로 유지', 'Position, height and heading all in limits — hold it')) : '';
  return lead + fixes + ok;
}
// ---- 시범비행: 자동 조종이 시험 순서대로 비행 (구호·정지 세기·관전 포인트 안내) ----
const C1TIP = {
  pre: ['호명 → 기체 점검 구호 → 조종기 점검(스틱 끝까지) 구호 → 공역·풍향·풍속 확인 구호. 구호를 외치면 다음 단계로 넘어갑니다.', 'Call-up → airframe check call → transmitter check (full stick travel) call → airspace and wind call. Each call moves you on.'],
  to: ['시동 → 3~5 m 기준고도까지 한 번에 상승(중간에 멈추면 감점) → 정지 5초 → 조종면 점검 구호 → 호버링 위치(A)로.', 'Start → climb in one go to a 3–5 m reference height (no stopping) → hold 5 s → control check call → move to the hover point (A).'],
  hov: ['제자리에서 기수만 90°씩 돌리고 각 방향에서 정지 5초. 위치 ±1 m · 고도 ±0.5 m · 기수 ±15° 안.', 'Turn only the nose 90° at a time and hold 5 s each way. Position ±1 m · height ±0.5 m · heading ±15°.'],
  fb: ['A → E 40 m 전진, 다시 A 로 후진. 일정한 속도로 중간에 멈추지 않기, 끝에서 정지 5초.', 'Forward 40 m from A to E, then back to A. Steady speed with no stops; hold 5 s at each end.'],
  tri: ['옆으로 수평 이동 → 45° 사선 상승(A 위 +7.5 m) → 반대쪽으로 45° 사선 하강 → A 로 복귀. 오르내리는 기울기가 일정해야 합니다.', 'Level sideways → 45° climb to A +7.5 m → 45° descent to the other side → back to A. Keep the slope steady.'],
  cir: ['기수를 진행 방향으로 돌리며(러더턴) 반경 7.5 m 원을 일정한 속도로. 출발점에서 정지 후 기수 전방.', 'Fly a 7.5 m circle nose-first (rudder turn) at a steady speed. Hold at the start, then nose forward.'],
  emg: ['2 m 상승 → "비상!" → 즉시 빠르게(평소 1.5배) 하강하며 비상 착륙장(F)에 착지. 내려오다 멈추지 않기.', 'Climb 2 m → "Emergency!" → descend at once, fast (1.5× normal), to the emergency pad (F). No pauses on the way down.'],
  nrm: ['GPS 끄기(ATTI) → 위치 유지가 없어 바람에 흐르는 것을 직접 잡으며 H 로 접근 → 중심축 맞춰 착륙.', 'GPS off (ATTI) → no position hold, so correct the drift yourself on the way to H → land on the centre axis.'],
  xw: ['GPS 다시 켜기 → 바람 쪽으로 기수를 돌린 측면 자세로 H 까지 직선 접근 → 착륙.', 'GPS back on → nose turned into the wind, fly sideways straight to H → land.'],
  post: ['시동 끄고 아워미터·전원 OFF → 외관 점검 → 배터리 분리 구호.', 'Shut down, hour meter, power off → airframe check → battery removal call.'],
  oral: ['구술 5문항. 시범에서는 정답을 골라 보여 줍니다.', 'Five oral questions. The demo picks the right answers.']
};
function c1DemoBanner(m) {
  let b = $('c1demo'); if (!b) { b = document.createElement('div'); b.id = 'c1demo'; document.body.appendChild(b); b.title = L2('누르면 접기/펴기', 'Tap to fold/unfold'); b.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); b._open = b.classList.contains('small'); b.classList.toggle('small', !b._open); }; }
  const learn = !C1.demo && !C1.exam, key = m ? m.id + '|' + C1.mi + '|' + (window.SIM_LANG || 'ko') : '';
  if (b._k !== key) { b._k = key; b._t = C1.t; }
  const on = (C1.demo || learn) && !C1.over && S.state !== 'menu' && m && C1TIP[m.id]; b.classList.toggle('hidden', !on); if (!on) return;
  const tip = C1TIP[m.id];
  if (b._h !== key) { b._h = key; b.innerHTML = `<b>${C1.demo ? '▶ ' + L2('시범비행', 'DEMO') : '📘 ' + L2('요령', 'HOW TO')} ${C1.mi + 1}/${C1.M.length} · ${m.name}</b><span>${L2(tip[0], tip[1])}</span>`; b._open = null; }
  b.classList.toggle('small', b._open != null ? !b._open : (C1.t - b._t > (C1.demo ? 10 : 15)));
}
function c1DemoCtl() {
  const st = c1Cur(); if (!st || C1.over) { IN.pitch = IN.roll = IN.yaw = 0; IN.thr = -1; return; }
  const M = c1M(), ref = C1.ref || 4, g = G, wrap = d => ((d + 180) % 360 + 360) % 360 - 180, cl1 = x => clamp(x, -1, 1), cl01 = x => clamp(x, 0, 1);
  const FW = [Math.sin(DR.h), -Math.cos(DR.h)], RT = [Math.cos(DR.h), Math.sin(DR.h)];
  const D = C1.dm || (C1.dm = { cd: 0, si: -1 }); if (D.si !== C1.mi * 100 + C1.si) { D.si = C1.mi * 100 + C1.si; D.t0 = C1.t; D.n = 0; }
  const idle = C1.t >= (C1.sayUntil || 0) - 0.05, age = C1.t - D.t0;
  const press = (k, wait) => { if (C1.t >= D.cd && age >= (wait == null ? 1.0 : wait) && idle) { c1DK(k); D.cd = C1.t + 0.6; return true; } return false; };
  let tu = M.u, tv = M.v, ta = M.alt, th = M.hdg, vmax = 1.2, vzO = null, ff = 0, still = false, fix = null;
  const flight = ['climb', 'hold', 'move', 'arc', 'xfer', 'emg', 'land'].includes(st.k);
  // 구호: 이동 전에 먼저 외치고(음성이 끝난 뒤) 움직임 · 정지 구호는 도착 후 세기는 앱이 함
  const callFirst = st.call && !st.callSaid && ['move', 'arc', 'xfer', 'climb', 'mode'].includes(st.k);
  if (st.call && !st.callSaid && st.k === 'hold') press('KeyQ', 0.2);
  if (callFirst) press('KeyQ', 0.6);
  if (st.k === 'inspect') { if (st.open && !st.done && age > 3 && idle) c1InspectAuto(true); still = true; }
  else if (st.k === 'oral') { if (st.qs && !st.done && age > 3 && idle) c1OralAuto(5); still = true; }
  else if (st.k === 'ann') still = true;
  else if (st.k === 'rc') { if (!st.callSaid && age > 1) { const seq = [{ thr: 1 }, { thr: -1 }, { yaw: 1 }, { yaw: -1 }, { pitch: 1 }, { pitch: -1 }, { roll: 1 }, { roll: -1 }]; const i = Math.floor((age - 1) / 0.45); fix = i < seq.length ? Object.assign({ thr: 0, yaw: 0, pitch: 0, roll: 0 }, seq[i]) : null; if (i >= seq.length) press('KeyQ', 0); } if (!fix) fix = { thr: 0, yaw: 0, pitch: 0, roll: 0 }; if (C1.mode !== 'gps') press('KeyH', 0.5); still = true; }
  else if (st.k === 'ctl') { const seq = [{ pitch: 0.25 }, { pitch: -0.25 }, { roll: 0.25 }, { roll: -0.25 }, { yaw: 0.3 }, { yaw: -0.3 }]; const i = Math.floor(age / 0.6); if (i < seq.length) fix = Object.assign({ pitch: 0, roll: 0, yaw: 0 }, seq[i]); else if (!st.callSaid) press('KeyQ', 0); }
  else if (st.k === 'prep') { press(st.call ? 'KeyQ' : 'Enter', 1.2); still = true; }
  else if (st.k === 'arm') { if (st.call && !st.callSaid) press('KeyQ', 1.0); else press('Enter', 1.0); still = true; }
  else if (st.k === 'disarm') { if (DR.landed && M.hs < 0.2) { if (st.call && !st.callSaid) press('KeyQ', 0.8); else press('Enter', 0.8); } still = DR.landed; }
  else if (st.k === 'mode') { if (st.callSaid && C1.t >= D.cd) { if (st.gps ? C1.mode !== 'gps' : C1.mode === 'gps') press('KeyH', 0.3); } still = DR.landed; }
  else if (st.k === 'callout') { press('KeyE', 0.6); }
  if (st.k === 'climb') { tu = st.at[0]; tv = st.at[1]; ta = 4.0; th = 0; }
  else if (st.k === 'hold') { tu = st.at[0]; tv = st.at[1]; ta = st.altWin ? ref + st.altWin[0] + 0.8 : ref + (st.r || 0); th = st.hdg; }
  else if (st.k === 'xfer') { tu = st.to[0]; tv = st.to[1]; ta = ref; th = 0; }
  else if (st.k === 'move') {
    const a = st.from, b = st.to, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const sp = cl01(((M.u - a[0]) * ux + (M.v - a[1]) * uy + 2.0) / L); tu = a[0] + dx * sp; tv = a[1] + dy * sp;
    const sp0 = cl01(((M.u - a[0]) * ux + (M.v - a[1]) * uy) / L); ta = ref + (st.r0 || 0) + ((st.r1 || 0) - (st.r0 || 0)) * sp0; th = st.hdg; vmax = (st.r0 || st.r1) ? 0.7 : 1.3;
    if (st.r0 || st.r1) { const vAl = DR.v.x * ux + (-DR.v.z) * uy; ff = ((st.r1 || 0) - (st.r0 || 0)) / L * vAl; }
  } else if (st.k === 'arc') {
    const dir = st.dir < 0 ? 1 : -1, thp = Math.atan2(M.u - st.c[0], M.v - st.c[1]) / DEG, ah = (thp + dir * 25) * DEG;
    tu = st.c[0] + Math.sin(ah) * st.R; tv = st.c[1] + Math.cos(ah) * st.R; ta = ref; th = wrap(thp + 90 * dir); vmax = 1.4;
    if (st.sweep > 320) { tu = st.start[0]; tv = st.start[1]; vmax = 0.8; }
  } else if (st.k === 'emg') { tu = st.pad[0]; tv = st.pad[1]; ta = 0; th = 0; vmax = 3.5; vzO = -2.0; }
  else if (st.k === 'land') { tu = st.pad[0]; tv = st.pad[1]; ta = 0; th = st.hdg; vmax = 0.8; vzO = Math.hypot(M.u - tu, M.v - tv) < 0.4 ? -0.6 : 0; }
  if (callFirst && flight) { tu = M.u; tv = M.v; ta = DR.landed ? 0 : M.alt; th = M.hdg; vzO = DR.landed ? -1 : null; }
  let vu = (tu - M.u) * 0.9, vv = (tv - M.v) * 0.9; const vl = Math.hypot(vu, vv); if (vl > vmax) { vu *= vmax / vl; vv *= vmax / vl; }
  const hh = C1S.h, vx = Math.cos(hh) * vu + Math.sin(hh) * vv, vz = Math.sin(hh) * vu - Math.cos(hh) * vv;
  let pit, rol;
  if (C1.mode === 'gps') { pit = (vx * FW[0] + vz * FW[1]) / C1P.gpsV.v; rol = (vx * RT[0] + vz * RT[1]) / C1P.gpsV.v; }
  else { const ax = (vx - DR.v.x) * 1.6, az = (vz - DR.v.z) * 1.6, tm = C1P.tiltMax.v * DEG; pit = Math.atan((ax * FW[0] + az * FW[1]) / g) / tm; rol = Math.atan((ax * RT[0] + az * RT[1]) / g) / tm; }
  const he = wrap(th - M.hdg);
  const vzd = vzO != null ? vzO : Math.max(-1.2, Math.min(1.5, ff + (ta - M.alt) * 1.5));
  let thr;
  if (C1.mode === 'manual') { const aUp = C1P.thrustMaxN.v / C1P.flightKg.v - g; thr = ((vzd - M.vy) * 2.5) / (vzd - M.vy >= 0 ? aUp * 0.6 : g * 0.55); }
  else thr = vzd > 0 ? vzd / C1P.climb.v : vzd / C1P.sink.v;
  if (still || (!flight && DR.landed)) { thr = DR.landed ? -1 : thr; pit = rol = 0; }
  if (DR.landed && (st.k === 'land' || st.k === 'emg' || st.k === 'disarm')) { thr = -1; pit = rol = 0; }
  IN.pitch = cl1(pit); IN.roll = cl1(rol); IN.yaw = cl1(he * 0.05); IN.thr = cl1(thr);
  if (fix) for (const k in fix) IN[k] = fix[k];
}
// 학습: 기동 번호로 바로 이동 (1~9)
function c1Jump(i, again) {
  i = clamp(i | 0, 0, C1.M.length - 1); if (!C1.M[i]) return;
  const fresh = c1Build(C1.side)[i]; fresh.label = fresh.name; fresh.done = false; fresh.miss = false; fresh.why = []; fresh.steps.forEach(s => s.T = s.T || c1R('hoverT')); C1.M[i] = fresh;
  for (let j = i; j < C1.M.length; j++) { C1.M[j].done = false; C1.M[j].miss = false; }
  C1.mi = i; C1.si = 0; MS.idx = i; C1.ref = C1.ref || 4; C1.hold = null; C1.altT = null; C1.ei.set(0, 0, 0); C1.touch = null; C1.crash = null;
  const ref = C1.ref, sb = C1.side < 0 ? C1PT.B : C1PT.D, f = C1.side < 0 ? C1PT.FB : C1PT.FD;
  const air = (uv, r) => ({ p: c1W(uv[0], uv[1], ref + (r || 0) + c1p('skidDrop')), gnd: false });
  const pose = [{ p: c1W(0, 15, c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }, air(C1PT.A), air(C1PT.A), air(C1PT.A), air(C1PT.H), air(C1PT.H), { p: c1W(f[0], f[1], c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }][i] || air(C1PT.H);
  resetDrone(pose.p, C1S.h); DR.landed = pose.gnd; C1.az = 0; C1.yr = 0;
  C1.armed = (i > 0 && !pose.gnd) || i === 1; if (i === 0) { C1.ref = null; C1.tArm = null; } C1.introCam = false; c1ModalClose();
  C1.mode = 'gps';
  c1Ev('jump', { to: C1.M[i].id, again: !!again }); renderList();
  const st = c1Cur(); if (st) { st.t0 = C1.t; st.wait = true; }
  if (!again) showMsg(C1.M[i].name, '#c9a2ff', 1.2);
}

// ---- 화면 ----
function c1Panel(show) {
  let el = $('c1p');
  if (!el) {
    const css = document.createElement('style');
    css.textContent = `#c1p{position:fixed;left:10px;top:112px;width:290px;max-height:calc(100vh - 230px);overflow:auto;z-index:6;background:rgba(10,14,20,.64);border:1px solid rgba(201,162,255,.5);border-radius:10px;color:#e8eef3;font:13px/1.35 system-ui,sans-serif;padding:8px 10px;pointer-events:auto}
#c1p.hidden{display:none}#c1p .t{cursor:move;user-select:none;-webkit-user-select:none;touch-action:none}#c1p .t::before{content:'⠿ ';opacity:.6}#c1p .t::after{content:'▾';float:right;opacity:.75;padding-left:6px}#c1p.mini .t::after{content:'▸'}#c1p.mini .s,#c1p.mini .cl,#c1p.mini .r,#c1p.mini canvas,#c1p.mini .note{display:none}#c1p.mini .co div:nth-child(n+2){display:none}#c1p .t{font-weight:700;color:#c9a2ff;font-size:12px;letter-spacing:.04em}#c1p .m{font-size:15px;font-weight:700;margin-top:2px}#c1p .s{color:#ffc828;margin:2px 0 4px}
#c1p .r{display:grid;grid-template-columns:auto 1fr;gap:1px 8px;font-variant-numeric:tabular-nums}#c1p .r b{font-weight:600;color:#9fb0bd}#c1p .bad{color:#ff7a5a}#c1p .ok{color:#5dff9a}
#c1p .bt{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}#c1p .bt button{flex:1 1 auto;min-width:56px;padding:6px 4px;border-radius:6px;border:1px solid #4a5560;background:#1d252d;color:#e8eef3;font-size:12px}
#c1p canvas{width:100%;height:auto;max-height:150px;object-fit:contain;margin-top:6px;border-radius:6px;background:#1b2a1a}#c1p .note{color:#8f9aa3;font-size:11px;margin-top:4px}
body.c1on #tbBoost,body.c1on #tbDrop,body.c1on #tbPhoto,body.c1on #tbGuide,body.c1on #tbBelly,body.c1on #tbIR{display:none!important}
#c1p .cl{color:#7fd0ff;margin:2px 0}#c1p .bt button#c1Gp.on{background:#1f5a32;border-color:#5dff9a;color:#bfffd2;font-weight:700}#c1p .bt button#c1Gp.off{background:#5a3a14;border-color:#ffb030;color:#ffe2b0;font-weight:700}
#c1p i.pb{display:inline-block;width:70px;height:7px;background:#2a333c;border-radius:4px;vertical-align:middle;overflow:hidden}#c1p i.pb i{display:block;height:100%;background:#5dff9a}#c1p .okf{font-weight:700;font-size:14px}#c1p .co{margin:3px 0;font-size:12.5px;line-height:1.45}#c1p .co:empty{display:none}#c1p .co div{padding:1px 0}#c1p .co .g{color:#7dffa8}#c1p .co .y{color:#ffd166}#c1p .co .r{color:#ff7a6a}#c1p .co i{font-style:normal;color:#9fb3c8;font-size:11px}#c1p .co b{color:#fff}body.touch #c1p .co{font-size:11px;margin:1px 0}body.touch #c1p .co div:nth-child(n+3){display:none}#c1p .bt.main button{flex:1 1 0;font-size:13px;padding:8px 4px;font-weight:700}#c1p .bt.sub{margin-top:4px}#c1p .bt.sub button{flex:1 1 auto;min-width:0;font-size:11px;padding:4px 3px;background:#151c22}#c1p .bt button#c1Em{background:#4a1a1a;border-color:#ff6060;color:#ffd0d0}body.touch #c1p .bts{display:flex;gap:3px;margin-top:3px}body.touch #c1p .bts .bt{margin:0;flex:1 1 0}body.touch #c1p .bts .bt.main{flex:1.3 1 0}body.touch #c1p .bt button{white-space:nowrap;overflow:hidden;letter-spacing:-.3px}#c1p .bt button small{margin-left:4px;font-size:9px;opacity:.6;border:1px solid #6a7580;border-radius:3px;padding:0 2px}body.touch #c1p .bt button small{display:none}#c1p .bt button.need{background:#14506e;border-color:#7fd0ff;color:#fff;font-weight:700;animation:c1need 1s ease-in-out infinite}@keyframes c1need{0%,100%{box-shadow:0 0 0 0 rgba(127,208,255,0);filter:brightness(1)}50%{box-shadow:0 0 0 4px rgba(127,208,255,.75);filter:brightness(1.45)}}#c1p.demo .bts,body.touch #c1p.demo .bts{display:none}#c1demo{position:fixed;left:50%;transform:translateX(-50%);top:58px;z-index:30;max-width:min(680px,92vw);background:rgba(20,16,40,.72);border:1px solid #c9a2ff;border-radius:8px;padding:6px 12px;color:#efe6ff;font-size:13px;line-height:1.45;pointer-events:auto;cursor:pointer}#c1demo.small{padding:3px 10px;font-size:12px}#c1demo.small span{display:none}#c1demo.small b::after{content:' ▸';opacity:.7}#c1demo b{color:#c9a2ff;margin-right:6px}#c1demo.hidden{display:none}body.touch #c1demo{top:auto;bottom:8px;font-size:11px;max-width:60vw}#c1p .cl i{color:#9aa6ad;font-style:normal}#c1p .bt button.on{background:#2c5a36;border-color:#5dff9a}
#c1cap{position:fixed;left:50%;top:136px;transform:translateX(-50%);max-width:min(760px,92vw);background:rgba(8,12,18,.86);border:1px solid #ffc828;border-radius:10px;padding:8px 14px;color:#fff;font:15px/1.4 system-ui,sans-serif;z-index:8;opacity:0;transition:opacity .25s;pointer-events:none}
#c1cap.on{opacity:1}#c1cap b{color:#ffc828;margin-right:6px}#c1cap.me{border-color:#7fd0ff}#c1cap.me b{color:#7fd0ff}
#c1m{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}#c1m.hidden{display:none}
#c1m .box{background:#11161c;border:1px solid #c9a2ff;border-radius:12px;padding:14px 16px;max-width:min(640px,94vw);max-height:90vh;overflow:auto;color:#e8eef3;font:14px/1.45 system-ui,sans-serif}
#c1m h3{margin:0 0 6px;color:#c9a2ff}#c1m table{width:100%;border-collapse:collapse;margin:8px 0}#c1m td{padding:5px 4px;border-bottom:1px solid #26303a;vertical-align:middle}
#c1m td button{margin:0 2px;padding:6px 10px;border-radius:6px;border:1px solid #4a5560;background:#1d252d;color:#e8eef3}#c1m td button.on{background:#2c5a36;border-color:#5dff9a}
#c1m .primary{margin-top:6px;padding:9px 16px;border-radius:8px;border:0;background:#ffc828;color:#111;font-weight:700}#c1m .primary:disabled{opacity:.4}
#c1m .opt{display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px;border-radius:8px;border:1px solid #4a5560;background:#1d252d;color:#e8eef3;font-size:14px}#c1m .q{font-size:16px;font-weight:600}#c1m .dim{color:#8f9aa3;font-size:12px}
body.touch #c1p .s,body.touch #c1p .cl,body.touch #c1p .m,body.touch #c1p .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.touch #c1p{left:150px;right:280px;top:36px;width:auto;max-height:calc(38vh - 40px);overflow:hidden;padding:4px 8px;font-size:11px;line-height:1.25}
body.touch #c1p .r,body.touch #c1p canvas,body.touch #c1p .note{display:none}body.touch #c1p .m{font-size:12px;margin:0}body.touch #c1p .s{margin:1px 0}
body.touch #c1An,body.touch #c1Mic,body.touch #c1Md,body.touch #c1Vw{display:none}
body.touch #c1p .bt{flex-wrap:nowrap;margin-top:3px;gap:3px}body.touch #c1p .bt button{min-width:0;padding:5px 3px;font-size:11px}
body.touch #c1p.chk .t,body.touch #c1p.chk .cl{display:none}body.touch #c1p.chk .r{display:flex;flex-wrap:wrap;gap:0 6px;font-size:10px}body.touch #c1p.chk .r span{margin-right:6px}body.touch #c1p.mini{max-height:none}
body.touch #c1cap{top:calc(38% + 4px);font-size:13px;max-width:60vw}
@media (max-width:700px),(max-height:500px){#c1p{width:230px;font-size:11px;top:86px;left:6px;padding:6px 8px;max-height:calc(100vh - 96px)}#c1p canvas,#c1p .note{display:none}#c1p .m{font-size:13px}#c1p .bt button{padding:8px 4px}}`;
    document.head.appendChild(css);
    el = document.createElement('div'); el.id = 'c1p'; el.className = 'hidden';
    el.innerHTML = `<div class="t" id="c1T"></div><div class="m" id="c1Mn"></div><div class="s" id="c1St"></div>
<div class="cl" id="c1Cl"></div><div class="co" id="c1Co"></div>
<div class="bts"><div class="bt main"><button id="c1Ok" title="${L2('완료하고 다음 단계로 (키보드 Enter)', 'Done, go to next step (Enter key)')}">${L2('다음 ▶', 'NEXT ▶')}<small>Enter</small></button><button id="c1Cb" title="${L2('내(응시자) 구호 외치기 — 기기가 응시자 목소리로 대신 말함 · 마이크로 직접 말해도 됨 (키보드 Q)', 'Say my (candidate) call — the device speaks it in the candidate voice · or say it into the mic (Q key)')}">${L2('🗣 내 구호', '🗣 MY CALL')}<small>Q</small></button><button id="c1Em" title="${L2('비상 선언 (키보드 E)', 'Declare emergency (E key)')}">${L2('🚨 비상', '🚨 EMER')}<small>E</small></button></div><div class="bt sub"><button id="c1Gp">GPS</button><button id="c1Md">${L2('모드 Y', 'MODE Y')}</button><button id="c1Hr">🕐</button><button id="c1Vw">${L2('시점 C', 'VIEW C')}</button><button id="c1An">📢</button><button id="c1Vo">🔊</button><button id="c1Mic">🎤</button></div></div><div class="r" id="c1R"></div>
<canvas id="c1Map" width="260" height="200"></canvas><div class="note" id="c1Note"></div><div class="note">${C1DISC()}</div>`;
    document.body.appendChild(el);
    const tap = (id, k) => { const b = $(id); b.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); c1Key(k); }; };
    tap('c1Ok', 'Enter'); tap('c1Md', 'KeyY'); tap('c1Gp', 'KeyH');
    $('c1Hr').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); const L = [9, 11, 13, 15, 17]; SET.c1hour = L[(L.indexOf(SET.c1hour | 0) + 1) % L.length] || 11; saveSet(); c1Sun(); showMsg(L2('시험 시각 ', 'Test time ') + SET.c1hour + L2('시 · 해 위치·그림자 반영', ':00 · sun and shadows updated'), '#ffc828', 1.6); }; tap('c1Em', 'KeyE'); tap('c1Vw', 'KeyC'); tap('c1Cb', 'KeyQ');
    $('c1An').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); SET.c1ann = SET.c1ann === false; saveSet(); c1AnnBtn(); showMsg(SET.c1ann === false ? L2('시험위원 지시 방송 끔 (응시자 구호로 진행)', 'Examiner announcements off (candidate-led)') : L2('시험위원 지시 방송 켬', 'Examiner announcements on'), '#ffc828', 1.6); };
    $('c1Vo').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); if (SET.c1voice === false) { SET.c1voice = true; saveSet(); } c1VoiceUnlock(); c1VoiceTest(); };
    $('c1Vo').oncontextmenu = e => { e.preventDefault(); SET.c1voice = SET.c1voice === false; saveSet(); showMsg(SET.c1voice === false ? L2('시험장 음성 끔', 'Test-field voice off') : L2('시험장 음성 켬', 'Test-field voice on'), '#ffc828', 1.4); };
    // 제목줄: 끌어서 옮기기 · 짧게 누르면 접기/펴기 · 두 번 누르면 원래 자리 (자리·접힘은 기기별로 기억)
    const tb = $('c1T'); let dg = null;
    tb.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); const r = el.getBoundingClientRect(); dg = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, w: r.width, mv: false }; try { tb.setPointerCapture(e.pointerId); } catch (_) { } };
    tb.onpointermove = e => { if (!dg) return; const dx = e.clientX - dg.x, dy = e.clientY - dg.y; if (!dg.mv && Math.hypot(dx, dy) < 6) return; dg.mv = true; c1PanelPos(dg.l + dx, dg.t + dy, dg.w); };
    tb.onpointerup = e => { if (!dg) return; const d = dg; dg = null; const k = IS_TOUCH ? 'c1posT' : 'c1posP';
      if (d.mv) { const r = el.getBoundingClientRect(); SET[k] = [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; saveSet(); return; }
      const now = performance.now(); if (now - (tb._last || 0) < 350) { SET[k] = null; saveSet(); c1PanelPos(); tb._last = 0; return; } tb._last = now;
      el.classList.toggle('mini'); SET.c1mini = el.classList.contains('mini'); saveSet(); };
    tb.title = L2('끌어서 옮기기 · 누르면 접기/펴기 · 두 번 누르면 원래 자리', 'Drag to move · tap to fold/unfold · double-tap to reset');
    el.classList.toggle('mini', !!SET.c1mini); c1PanelPos();
    $('c1Mic').onpointerdown = e => { e.stopPropagation(); e.preventDefault(); c1Mic(!C1V.micOn); $('c1Mic').classList.toggle('on', C1V.micOn); };
  }
  el.classList.toggle('hidden', !show); c1AnnBtn(); if (!show) { const b = $('c1demo'); if (b) b.classList.add('hidden'); }
}
function c1PanelPos(x, y, w) {
  const el = $('c1p'); if (!el) return; const k = IS_TOUCH ? 'c1posT' : 'c1posP';
  if (x == null && SET[k]) [x, y, w] = SET[k];
  if (x == null) { el.style.left = el.style.top = el.style.right = el.style.width = ''; return; }
  const W = innerWidth, H = innerHeight, ww = Math.min(w || el.offsetWidth, W - 8);
  x = clamp(x, 4 - ww * 0.7, W - ww * 0.3); y = clamp(y, 0, H - 28);
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.right = 'auto'; el.style.width = ww + 'px';
}
function c1AnnBtn() { const b = $('c1An'); if (b) { b.classList.toggle('on', SET.c1ann !== false); b.title = L2('시험위원 지시 방송 켜기/끄기', 'Examiner announcements on/off'); } }
let _c1ui = 0;
function c1Tick(dt) {
  if (!isC1() || !C1G) return;
  if (C1.pilotFig) C1.pilotFig.visible = C1.view !== 'pilot' || !!C1.introCam || S.state === 'menu';
  c1NavTick();
  if (C1V.heardT > 0) C1V.heardT -= dt; if (C1.ok && C1.ok.t > 0) C1.ok.t -= dt;
  if (ui.modeTag && (S.state === 'run' || S.state === 'pause')) ui.modeTag.textContent = 'C1 · ' + (C1.mode === 'gps' ? 'GPS ON' : C1.mode === 'atti' ? 'GPS OFF (ATTI)' : 'MANUAL') + (C1.armed ? ' · ARMED' : '');
  if (C1.ribbons) c1RibbonTick();
  if (C1.sock) { const w = c1Wind(c1W(-16, 10, 4)); const sp = Math.hypot(w.x, w.z); C1.sock.rotation.set(0, 0, 0); C1.sock.lookAt(C1.sock.position.clone().add(new V3(w.x || 0.001, -Math.max(0, 3 - sp) * 0.6, w.z))); C1.sock.rotateX(Math.PI / 2); }
  const run = S.state === 'run' || S.state === 'pause';
  const st = run ? c1Cur() : null, aids = !C1.exam && run && st;
  C1.aidBox.visible = C1.aidLine.visible = C1.aidArrow.visible = false;
  if (aids) {
    const ref = C1.ref || 4;
    if (st.k === 'hold' || st.k === 'xfer') {
      const at = st.at || st.to, h0 = st.altWin ? ref + st.altWin[0] : ref + (st.r || 0) - c1R('altTol'), h1 = st.altWin ? ref + st.altWin[1] : ref + (st.r || 0) + c1R('altTol');
      C1.aidBox.visible = true; C1.aidBox.rotation.y = -C1S.h; C1.aidBox.scale.set(c1R('posTol'), Math.max(0.05, h1 - h0), st.alongTol ? st.alongTol : c1R('posTol'));
      C1.aidBox.position.copy(c1W(at[0], at[1], (h0 + h1) / 2 + c1p('skidDrop')));
      C1.aidArrow.visible = st.hdg != null; if (st.hdg != null) { const hd = st.hdg * DEG; C1.aidArrow.position.copy(c1W(at[0] + Math.sin(hd) * 1.6, at[1] + Math.cos(hd) * 1.6, h1 + c1p('skidDrop') + 0.2)); C1.aidArrow.rotation.set(-Math.PI / 2, 0, -(hd + C1S.h)); }
    } else if (st.k === 'move' || st.k === 'arc' || st.k === 'climb' || st.k === 'land' || st.k === 'emg') {
      const pts = [], sd = c1p('skidDrop');
      if (st.k === 'move') { for (let i = 0; i <= 20; i++) { const s = i / 20; pts.push(c1W(st.from[0] + (st.to[0] - st.from[0]) * s, st.from[1] + (st.to[1] - st.from[1]) * s, ref + (st.r0 || 0) + ((st.r1 || 0) - (st.r0 || 0)) * s + sd)); } }
      else if (st.k === 'arc') { for (let i = 0; i <= 72; i++) { const a = (180 + (st.dir < 0 ? 1 : -1) * i * 5) * DEG; pts.push(c1W(st.c[0] + Math.sin(a) * st.R, st.c[1] + Math.cos(a) * st.R, ref + sd)); } }
      else { const at = st.at || st.pad; pts.push(c1W(at[0], at[1], sd), c1W(at[0], at[1], (st.k === 'climb' ? 5 : ref + 2) + sd)); }
      C1.aidLine.geometry.setFromPoints(pts); C1.aidLine.visible = true;
    }
  }
  _c1ui -= dt; if (_c1ui > 0) return; _c1ui = 0.1;
  const el = $('c1p'); if (!el || el.classList.contains('hidden')) return;
  const m = C1.M[C1.mi], M = c1M();
  $('c1T').textContent = (C1.exam ? L2('1종 모의평가', 'CLASS 1 · MOCK') : C1.demo ? L2('1종 시범비행', 'CLASS 1 · DEMO') : L2('1종 학습', 'CLASS 1 · LEARN')) + ' · ' + { gps: 'GPS', atti: 'ATTI', manual: 'MANUAL' }[C1.mode] + (C1.armed ? ' · ARMED' : ' · SAFE') + (C1.ref ? ` · ${L2('기준', 'REF')} ${C1.ref.toFixed(1)} m` : '');
  $('c1Mn').textContent = m ? `${C1.mi + 1}. ${m.name}` : '';
  $('c1St').textContent = st ? st.lab : '';
  { const cl = $('c1Cl'); let h = '';
    const ctx = st && st.call ? (st.call.count ? (L2(st.call.ko, st.call.en) ? L2(st.call.ko, st.call.en) + ' → ' : '') + L2('(도착 후) 정지. 하나, 둘, 셋, 넷, 다섯', '(on arrival) hold, one … five') : L2(st.call.ko, st.call.en)) : '';
    if (st && st.k === 'inspect' && st.call && !st.callSaid) h = L2('점검 항목을 모두 판정하면 보고 구호가 자동으로 나갑니다', 'When every item is judged, the report call is made for you');
    else if (st && st.call) h = st.callSaid ? `✓ ${L2('구호', 'Call')}: ${ctx} <i>(${st.callSaid === 'voice' ? L2('음성', 'voice') : st.callSaid === 'auto' ? L2('자동', 'auto') : L2('버튼', 'button')})</i>` : (C1.exam ? `${L2('지금 내 구호 차례 ▶ 🗣 내 구호 버튼 또는 직접 말하기', 'Your call now ▶ 🗣 MY CALL button or say it')}` : `${L2('내 구호', 'My call')}: “${ctx}” <i>(${L2('🗣 내 구호 버튼 · 🎤 말하기', '🗣 MY CALL · 🎤 say it')})</i>`);
    if (C1V.heardT > 0) h += `<br><i>🎤 ${C1V.heard}</i>`;
    const vs = c1VoiceStatus(); if (vs) h += `<br><i style="color:#ffb070">${vs}</i>`;
    cl.innerHTML = h; }
  { const co = $('c1Co'); if (co) co.innerHTML = (!C1.exam && !C1.demo && st) ? c1Coach(st, M) : ''; }
  const e = st && st.err, f = (x, d) => (x >= 0 ? '+' : '') + x.toFixed(d || 1), cls = (x, t) => Math.abs(x) <= t ? 'ok' : 'bad';
  let r = `<b>${L2('스키드 높이', 'Skid h')}</b><span>${M.alt.toFixed(2)} m</span><b>${L2('기수', 'Heading')}</b><span>${c1Wrap(M.hdg).toFixed(0)}°</span>`;
  if (!C1.exam && e) {
    if (e.lat != null) r += `<b>${L2('위치 오차', 'Pos err')}</b><span class="${cls(e.lat, c1R('posTol'))}">${f(e.lat, 2)} m</span>`;
    if (e.alt != null && st.k !== 'land' && st.k !== 'emg') r += `<b>${L2('고도 오차', 'Height err')}</b><span class="${cls(e.alt, c1R('altTol'))}">${f(e.alt, 2)} m</span>`;
    if (e.hdg != null) r += `<b>${L2('기수 오차', 'Hdg err')}</b><span class="${cls(e.hdg, st.k === 'emg' ? 45 : 15)}">${f(e.hdg, 0)}°</span>`;
    if (st.k === 'hold') r += `<b>${L2('정지', 'Hold')}</b><span class="${st.armedEval && st.t >= st.T ? 'ok' : ''}">${st.armedEval ? st.t.toFixed(1) : '–'} / ${st.T} s</span>`;
  }
  if (!C1.exam && m && m.fail) r += `<b>${L2('판정', 'Verdict')}</b><span class="bad">U · ${m.why.map(w => c1WhyTxt(w.why)).filter((x, i, a) => a.indexOf(x) === i).join(', ')}</span>`;
  if (st && st.k === 'rc') { const sn = st.seen || {}, ck = k => sn[k] ? '✓' : '·'; r = `<b>${L2('스로틀', 'Throttle')}</b><span>↑${ck('thr+')} ↓${ck('thr-')}</span><b>${L2('러더', 'Rudder')}</b><span>←${ck('yaw-')} →${ck('yaw+')}</span><b>${L2('엘리베이터', 'Elevator')}</b><span>↑${ck('pitch+')} ↓${ck('pitch-')}</span><b>${L2('에일러론', 'Aileron')}</b><span>←${ck('roll-')} →${ck('roll+')}</span><b>${L2('모드 스위치', 'Mode switch')}</b><span class="${C1.mode === 'gps' ? 'ok' : 'bad'}">${C1.mode.toUpperCase()}</span>`; }
  if (st && st.k === 'ctl') { const sn = st.seen || {}, ck = k => sn[k] ? '✓' : '·'; r += `<b>${L2('점검 조작', 'Checks')}</b><span>${L2('전', 'F')}${ck('p+')} ${L2('후', 'B')}${ck('p-')} ${L2('좌', 'L')}${ck('r-')} ${L2('우', 'R')}${ck('r+')} ${L2('러더', 'Rud')}${ck('y-')}${ck('y+')}</span>`; }
  if (st && st.k === 'arm' && st.csc) r += `<b>${L2('시동', 'Start')}</b><span>${L2('두 스틱 아래·안쪽 0.5초 (키보드 S+A+↓+→)', 'Both sticks down-in 0.5 s (keys S+A+↓+→)')}</span>`;
  { const needCall = !!(st && st.call && !st.callSaid && st.k !== 'inspect'), needOk = !C1.demo && !!(st && (st.k === 'prep' || (st.k === 'arm' && DR.landed) || (st.k === 'disarm' && DR.landed && Math.hypot(DR.v.x, DR.v.z) < 0.3)));
    const ob = $('c1Ok'), cb = $('c1Cb'); if (ob) ob.classList.toggle('need', needOk && !needCall); if (cb) cb.classList.toggle('need', needCall && !C1.demo); el.classList.toggle('demo', !!C1.demo); c1DemoBanner(m); }
  { const gp = $('c1Gp'); if (gp) { gp.textContent = C1.mode === 'gps' ? 'GPS ON' : C1.mode === 'atti' ? 'GPS OFF' : 'MANUAL'; gp.className = C1.mode === 'gps' ? 'on' : 'off'; } const hb = $('c1Hr'); if (hb) hb.textContent = '🕐 ' + (SET.c1hour || 11) + L2('시', ':00'); }
  if (st && st.k === 'hold' && st.armedEval) { const pc = Math.min(1, st.t / st.T); r += `<b>${L2('정지', 'Hold')}</b><span><i class="pb"><i style="width:${(pc * 100).toFixed(0)}%"></i></i> ${st.t.toFixed(1)} / ${st.T} s${pc >= 1 ? ' ✓' : ''}</span>`; }
  if (C1.ok && C1.ok.t > 0) r = `<span class="okf ${C1.ok.bad ? 'bad' : 'ok'}" style="grid-column:1/3">${C1.ok.text}</span>` + r;
  $('c1R').innerHTML = r; el.classList.toggle('chk', !!st && (st.k === 'rc' || st.k === 'ctl' || (st.k === 'arm' && st.csc)));
  $('c1Note').textContent = L2('1종 실기시험 기준 참고 연습용 · 공식 시험·교육시간 인정 여부 미확인', 'Reference practice for the class-1 practical test · not an official test or training hours') + (C1.exam ? '' : L2(' · 숫자 1~9 = 기동 바로가기 · N = 다음 단계', ' · keys 1–9 jump to a manoeuvre · N = next step'));
  const cv = $('c1Map'); if (cv && !C1.exam) c1DrawMap(cv, st, M); else if (cv) cv.style.display = 'none';
}
function c1DrawMap(cv, st, M) {
  cv.style.display = ''; const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height, ox = W2 / 2, oy = H2 - 14;
  const k = Math.min((H2 - 24) / 70, W2 / 40); const XX = u => ox + u * k, YY = v => oy - v * k;
  g.clearRect(0, 0, W2, H2); g.fillStyle = '#20301f'; g.fillRect(0, 0, W2, H2);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.strokeRect(XX(C1FIELD.u0), YY(C1FIELD.v1), (C1FIELD.u1 - C1FIELD.u0) * k, (C1FIELD.v1 - C1FIELD.v0) * k);
  g.beginPath(); g.arc(XX(0), YY(22.5), 7.5 * k, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,208,64,.5)'; g.beginPath(); g.arc(XX(0), YY(0), 14 * k, Math.PI, 2 * Math.PI); g.stroke();
  g.fillStyle = '#fff'; g.font = '10px system-ui'; g.textAlign = 'center';
  for (const [n, uv] of Object.entries(C1PT)) { const isPad = n === 'H' || n[0] === 'F'; g.fillStyle = isPad ? (n === 'H' ? '#9aa6b2' : '#c05050') : '#fff'; if (isPad) g.fillRect(XX(uv[0] - 1), YY(uv[1] + 1), 2 * k, 2 * k); else { g.beginPath(); g.arc(XX(uv[0]), YY(uv[1]), 2.5, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.fillText(n[0], XX(uv[0]) + 8, YY(uv[1]) - 3); }
  if (st && (st.at || st.to)) { const t = st.at || st.to; g.strokeStyle = '#5dff9a'; g.strokeRect(XX(t[0] - 1), YY(t[1] + (st.alongTol || 1)), 2 * k, 2 * (st.alongTol || 1) * k); }
  if (st && st.k === 'move') { g.strokeStyle = '#4fe3ff'; g.beginPath(); g.moveTo(XX(st.from[0]), YY(st.from[1])); g.lineTo(XX(st.to[0]), YY(st.to[1])); g.stroke(); }
  const x = XX(M.u), y = YY(M.v), h = M.hdg * DEG; g.fillStyle = '#ffc828'; g.beginPath(); g.moveTo(x + Math.sin(h) * 7, y - Math.cos(h) * 7); g.lineTo(x + Math.sin(h + 2.5) * 5, y - Math.cos(h + 2.5) * 5); g.lineTo(x + Math.sin(h - 2.5) * 5, y - Math.cos(h - 2.5) * 5); g.fill();
}
// 조종자 시점: P 에서 눈높이 · 기체를 따라 시선만 돌림 (육안 시점의 근사)
const _c1cg = new V3(), _c1ct = new V3(), _c1cv = new V3(), _c1cw = new V3();
function c1Camera(dt, subj) {
  if (!C1 || !isC1() || S.state === 'menu') return false;
  if (C1.view === 'chase' && !C1.exam) {
    const fw = new V3(Math.sin(subj.h), 0, -Math.cos(subj.h)), want = subj.p.clone().addScaledVector(fw, -7).add(new V3(0, 3, 0)); want.y = Math.max(want.y, C1S.y + 0.8);
    camPos.lerp(want, 1 - Math.exp(-dt * 5)); camera.position.copy(camPos); camLook.lerp(subj.p, 1 - Math.exp(-dt * 9)); camera.lookAt(camLook); camera.fov = 60; camera.near = 0.05; return true;
  }
  if (C1.introCam) {   // 대기 천막에서 시험장을 바라봄 (호명 방송 중)
    camera.position.copy(c1W(-9, -7.5, 1.7)); camLook.copy(c1W(0, 24, 2)); camera.up.set(0, 1, 0); camera.lookAt(camLook); camera.fov = 55; camera.near = 0.1; return true;
  }
  camera.position.copy(c1W(0, 0, c1p('eye')));
  // 기체와 그 아래 바닥(지점·고깔·그림자)이 함께 보이도록: 둘 사이를 바라보고 화각을 넓힘
  const gy = C1S.y, gp = _c1cg.set(subj.p.x, Math.min(subj.p.y, gy), subj.p.z), tgt = _c1ct.copy(subj.p).lerp(gp, 0.4);
  camLook.lerp(tgt, 1 - Math.exp(-dt * 7)); if (camLook.distanceTo(tgt) > 30) camLook.copy(tgt);
  camera.up.set(0, 1, 0); camera.lookAt(camLook);
  const d = camera.position.distanceTo(subj.p), a = _c1cv.copy(subj.p).sub(camera.position).angleTo(_c1cw.copy(gp).sub(camera.position)) / DEG;
  const want = clamp(Math.max(2 * Math.atan(7.5 / Math.max(d, 1)) / DEG, a * 1.7 + 6) * (SET.c1zoom || 1), 30, 75);
  camera.fov += (want - camera.fov) * (1 - Math.exp(-dt * 3)); camera.near = 0.1;
  return true;
}

// ---- 결과 · 기록 ----
function c1Finish(why) {
  if (C1.over) return; C1.over = true; S.finished = true; S.running = false; if (REC) LAST_REC = recFinish();
  c1Ev('end', { why });
  setTimeout(() => {
    if (S.state !== 'run') return;
    S.state = 'result'; ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden'); c1Panel(false);
    $('resTitle').textContent = C1.exam ? L2('1종 모의평가 결과', 'CLASS 1 · MOCK CHECK') : L2('1종 학습 결과', 'CLASS 1 · PRACTICE');
    ui.resSub.textContent = `${pilotName()} · ${C1P.label[window.SIM_LANG === 'en' ? 'en' : 'ko']} · ${L2('기준고도', 'Ref height')} ${C1.ref ? C1.ref.toFixed(1) + ' m' : '–'}`;
    const V = m => m.unrated ? L2('교관 확인 필요', 'Instructor check') : m.skipped ? L2('미평가 (건너뜀)', 'Not rated (skipped)') : !m.done ? L2('미수행', 'Not flown') : m.fail ? 'U' : 'S';
    const rows = C1.M.map((m, i) => [`${i + 1}. ${m.name}`, `<b style="color:${m.unrated || m.skipped || !m.done ? '#c9a2ff' : m.fail ? '#ff7a5a' : '#5dff9a'}">${V(m)}</b>` + (m.fail ? ` <span class="dim">${m.why.map(w => c1WhyTxt(w.why)).filter((x, j, a) => a.indexOf(x) === j).join(', ')}</span>` : '')]);
    rows.push([L2('구술 (기체·조종자·공역·일반지식·이륙중 엔진고장 · 각 1문)', 'Oral (aircraft · pilot · airspace · general · engine failure on takeoff)'), L2('미평가 · 교관 확인 필요', 'Unrated · instructor')]);
    rows.push([L2('공중경계 · 계획성 · 판단력 · 규칙 준수 · 조작 원활성', 'Lookout · planning · judgement · rules · smoothness'), L2('미평가 · 교관 확인 필요', 'Unrated · instructor')]);
    { const calls = []; C1.M.forEach(m => m.steps.forEach(s => { if (s.call) calls.push(s); })); const v = calls.filter(s => s.callSaid === 'voice').length, b = calls.filter(s => s.callSaid === 'btn').length;
      rows.push([L2('구호 (교육 관행 예시 · 채점 외, "비상"만 기준서 필수)', 'Calls (training practice · not scored, only "emergency" is required)'), `${v + b} / ${calls.length} · ${L2('음성', 'voice')} ${v} · ${L2('버튼', 'button')} ${b}`]); }
    { const ins = C1.ev.find(e => e.type === 'inspect'); if (ins) rows.push([L2('비행 전 점검 판정', 'Pre-flight inspection'), (ins.fault ? L2('이상 항목: ', 'Fault: ') + ins.fault : L2('이상 없음', 'No fault')) + ' · ' + (ins.wrong.length ? `<b style="color:#ff7a5a">${L2('오판정 ', 'misjudged ')}${ins.wrong.join(', ')}</b>` : L2('판정 정확', 'judged correctly'))]); }
    { const o = C1.ev.filter(e => e.type === 'oral'); if (o.length) rows.push([L2('구술 (앱 예시 문항 · 앱 채점)', 'Oral (app examples · app-scored)'), `${o.filter(x => x.ok).length} / ${o.length}`]); }
    rows.push([L2('안전거리 14 m · 안전라인', 'Safety radius 14 m · line'), C1.safeBad ? `<b style="color:#ff7a5a">${L2('침범 기록 있음', 'Infringed')}</b>` : L2('침범 기록 없음', 'No infringement logged')]);
    rows.push([L2('비행 시간', 'Flight time'), fmt(S.t)], [L2('비상 강하 기준 속도', 'Emergency descent reference'), C1.refDesc ? C1.refDesc.toFixed(2) + ' m/s (' + L2('삼각 하강 평균', 'triangle descent mean') + ')' : c1R('emgRefDefault') + ' m/s (' + L2('앱 기본값', 'app default') + ')']);
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    const sc = $('resScore'); if (sc) sc.innerHTML = `<div style="color:#c9a2ff;font-size:13px;margin:6px 0">${L2('앱 모의판정 (규칙 ', 'App mock verdict (rules ')}${C1RULES.ver}) · ${L2('공식 시험 합격·자격 판정이 아닙니다', 'not an official pass or certificate')}<br>${C1DISC()}</div>`;
    const db = $('resDebrief'); if (db) db.innerHTML = `<h4>${L2('판정 근거 (이벤트)', 'Evidence (events)')}</h4>` + C1.ev.filter(e => e.type === 'U').slice(0, 30).map(e => `<div class="ln"><span>${fmt(e.t)} ${e.step}</span><span class="bad">${c1WhyTxt(e.why)}</span></div>`).join('') || '';
    ui.resBest.textContent = '';
    let b = $('c1Exp'); if (!b) { b = document.createElement('button'); b.id = 'c1Exp'; b.textContent = L2('기록 JSON 내보내기', 'Export log (JSON)'); $('bMenu2').parentNode.insertBefore(b, $('bMenu2')); b.onclick = c1Export; }
    b.style.display = '';
    c1Save();
  }, 1200);
}
function c1Log() {
  return { schema: 'c1-log-1', app: 'FPV Terrain Trainer · class-1 practice', when: new Date().toISOString(), mode: S.kind, exam: C1.exam, side: C1.side < 0 ? 'left-first' : 'right-first',
    profile: C1P, rules: C1RULES, ref: C1.ref, refDesc: C1.refDesc, wind: { level: WIND.lv, dir: [+WIND.dir.x.toFixed(3), +WIND.dir.z.toFixed(3)] }, t: +C1.t.toFixed(2),
    manoeuvres: C1.M.map(m => ({ id: m.id, name: m.name, done: !!m.done, verdict: m.unrated ? 'instructor' : m.skipped ? 'skipped' : !m.done ? 'not-flown' : m.fail ? 'U' : 'S', why: m.why })),
    events: C1.ev };
}
function c1Export() {
  try { const blob = new Blob([JSON.stringify(c1Log(), null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'class1_log_' + Date.now() + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  catch (e) { showMsg(L2('내보내기 실패', 'Export failed'), '#ff5050', 1.5); }
}
const C1_KEY = 'fpvsim_class1_runs_v1';   // 기존 기록과 섞이지 않는 새 저장 이름
function c1Save() {
  const L = c1Log(), sum = { when: L.when, mode: L.mode, side: L.side, ref: L.ref, profile: C1P.ver, rules: C1RULES.ver, t: L.t, v: L.manoeuvres.map(m => m.verdict) };
  try { const a = JSON.parse(localStorage.getItem(C1_KEY) || '[]'); a.unshift(sum); localStorage.setItem(C1_KEY, JSON.stringify(a.slice(0, 30))); }
  catch (e) { C1.memRuns = (C1.memRuns || []).concat([sum]); showMsg(L2('브라우저 저장 불가 · 이번 기록은 메모리에만', 'Storage blocked · kept in memory only'), '#ffc828', 2); }
}

// 임무별 허용 기체 목록에서 없는 기체는 뺌 (민간판에서 기체를 지운 경우 대비)
Object.keys(MS_OK).forEach(k => { MS_OK[k] = MS_OK[k].filter(id => AF[id]); });

// ---- 민간 일반 비행판 (window.SIM_CIVIL): 타격·자폭·투하·차량 추적 진입점과 기체·판정 연결을 끊음 ----
if (window.SIM_CIVIL) {
  for (const k of ['kfpv', 'kfw']) { delete AF[k]; const i = AF_IDS.indexOf(k); if (i >= 0) AF_IDS.splice(i, 1); }
  Object.keys(MS_OK).forEach(k => { MS_OK[k] = MS_OK[k].filter(id => AF[id]); });
  for (const k of ['strike', 'track']) { delete MS_OK[k]; delete MS_NAME[k]; }
  AF.x2d.drop = false; AF.x2d.note = L2('자세 안정 · 정지 비행', 'Stabilised · hover');
  if (!AF[SET.af]) SET.af = 'x2d';
  // 장애물 코스: 투하 과제를 빼고, 튜토리얼 단계의 과제 번호를 다시 맞춤 (투하만 있는 단계는 뺌)
  { const rm = new Set(); OBJS.forEach((o, i) => { if (o.kind === 'drop') rm.add(i); });
    const map = i => i - [...rm].filter(r => r < i).length;
    for (let li = LESSONS.length - 1; li >= 0; li--) { const L = LESSONS[li]; if (/투하|^Drop/i.test(L.title)) { LESSONS.splice(li, 1); continue; } if (!L.range) continue; const keep = []; for (let i = L.range[0]; i <= L.range[1]; i++) if (!rm.has(i)) keep.push(map(i)); if (keep.length) L.range = [keep[0], keep[keep.length - 1]]; }
    for (let i = OBJS.length - 1; i >= 0; i--) if (rm.has(i)) { if (OBJS[i].hint) OBJS[i].hint.visible = false; OBJS.splice(i, 1); }
    // 사람 실루엣·이동 표적 모형은 감추고 충돌도 끔
    for (const id of ['ivan_grp1', 'ivan_grp2', 'mit']) { const b = OBJ[id]; if (!b) continue; b.g.visible = false; const c0 = b.world(0, 0, 0); COLL.forEach(c => { if (c.c && c.c.distanceTo(c0) < (id === 'mit' ? 18 : 6)) c.off = true; }); }
  }
  dropPayload = function () { };                                                    // 투하 동작 없음
  const _sr = startRun; startRun = function (k) { if (k === 'strike' || k === 'track') k = 'free'; return _sr(k); };
  const _ss = scenStart; scenStart = function (k, a) { const L = _ss(k, a); return L && k === 'sar' ? L.filter(o => o.t !== 'sarkit') : L; };   // 수색: 키트 투하 단계 없음
  strikePick = function () { return []; };
}
// =====================================================================
//  시험장 진행: 시험위원 방송 · 응시자 구호 · 비행 전 점검 · 조종기 점검 · 시동 · 구술
//  음성은 기기 음성 합성(speechSynthesis)만 씀 · 시험위원 지시문과 구호는 앱이 쓴 예시 문구
// =====================================================================
const C1V = { micOn: false, rec: null, heard: '', heardT: 0 };
function c1VoicePick() {
  try { const vs = speechSynthesis.getVoices(), lang = window.SIM_LANG === 'en' ? 'en' : 'ko'; return vs.filter(v => v.lang && v.lang.toLowerCase().startsWith(lang)); } catch (e) { return []; }
}
// who: 'ex' 시험위원 (낮고 차분) · 'me' 응시자 구호 (높고 빠르게, 다른 목소리가 있으면 그것)
// ---- 미리 만든 음성 묶음 (한국어: Mimic3 KSS 음성 · 영어: Kokoro) · 없거나 못 찾으면 기기 음성 합성 ----
const C1A = { st: 'none', idx: null, buf: null, ab: {}, until: 0 };
function c1ALoad() {
  if (C1A.st !== 'none') return; C1A.st = 'loading';
  const ib = document.getElementById('c1vb'), ii = document.getElementById('c1vi');
  if (ib && ii) { try { const s = atob(ib.textContent.trim()), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); C1A.buf = u.buffer; C1A.idx = JSON.parse(ii.textContent); C1A.st = 'ready'; } catch (e) { C1A.st = 'fail'; } return; }
  if (location.protocol === 'file:') { C1A.st = 'fail'; return; }
  const base = (window.SIM_BASE || '') + 'lib/c1_voice';
  Promise.all([fetch(base + '.json').then(r => r.json()), fetch(base + '.bin').then(r => r.arrayBuffer())]).then(([i, b]) => { C1A.idx = i; C1A.buf = b; C1A.st = 'ready'; }).catch(() => { C1A.st = 'fail'; });
}
function c1AKey(text, who) {
  const L = window.SIM_LANG === 'en' ? 'en' : 'ko', k = `${L}|${who}|${text}`; if (!C1A.idx) return null;
  if (C1A.idx[k]) return k;
  const g = `${L}|${who}|` + (L === 'ko' ? text.replace(/^응시자 [^,]+,/, '응시자,') : text.replace(/^Candidate [^,]+,/, 'Candidate,')); return C1A.idx[g] ? g : null;
}
function c1APlay(k) {
  const ctx = AU.ctx; if (!ctx) return false;
  try { if (ctx.state !== 'running') ctx.resume(); } catch (e) { }
  const [o, l] = C1A.idx[k];
  const go = b => { const s = ctx.createBufferSource(); s.buffer = b; const gn = ctx.createGain(); gn.gain.value = 1.6; s.connect(gn); gn.connect(AU.master || ctx.destination);
    const t0 = Math.max(ctx.currentTime + 0.02, C1A.until); s.start(t0); C1A.until = t0 + b.duration + 0.15; };
  if (C1A.ab[k]) go(C1A.ab[k]); else ctx.decodeAudioData(C1A.buf.slice(o, o + l)).then(b => { C1A.ab[k] = b; go(b); }).catch(() => { });
  return true;
}
function c1Say(text, who) {
  if (C1A.st === 'none') c1ALoad();
  const ak = C1A.st === 'ready' ? c1AKey(text, who) : null;
  const dur = ak ? C1A.idx[ak][2] + 0.35 : Math.max(1.4, text.length * (window.SIM_LANG === 'en' ? 0.065 : 0.13) + 0.5);
  c1Caption(text, who, dur); C1.sayUntil = Math.max(C1.sayUntil || 0, C1.t || 0) + dur;
  (C1V.log = C1V.log || []).push((ak ? '' : '[NOKEY] ') + (who === 'me' ? 'ME: ' : 'EX: ') + text); if (C1V.log.length > 300) C1V.log.shift();
  try {
    if (ak && SET.c1voice !== false) { if (!TEST) c1APlay(ak); C1V.nRec = (C1V.nRec || 0) + 1; }
    else if (window.speechSynthesis && !TEST && SET.c1voice !== false) {   // 무전 음성 설정과 따로 (무전을 꺼도 시험장 안내는 나옴)
      const u = new SpeechSynthesisUtterance(text), vs = c1VoicePick();
      u.lang = window.SIM_LANG === 'en' ? 'en-US' : 'ko-KR';
      if (vs.length) u.voice = who === 'me' && vs.length > 1 ? vs[1] : vs[0];
      u.pitch = who === 'me' ? 1.25 : 0.85; u.rate = who === 'me' ? 1.15 : 0.98; u.volume = 1;
      u.onstart = () => { C1V.ok = true; C1V.err = null; };
      u.onerror = e => { if (e.error === 'interrupted' || e.error === 'canceled') return; C1V.err = e.error || 'error'; c1Ev('ttsErr', { err: C1V.err }); };
      (C1V.utts = C1V.utts || []).push(u); if (C1V.utts.length > 8) C1V.utts.shift();   // 크롬: 참조가 없으면 말하다 끊기는 문제 방지
      try { speechSynthesis.resume(); } catch (e) { }
      speechSynthesis.speak(u);
      if (who === 'ex') sfx('good');   // 안내 시작음 (음성이 안 나오는 기기에서도 알림)
    } else if (who === 'ex') sfx('good');
  } catch (e) { }
  return dur;
}
// 휴대폰(특히 아이폰)·일부 브라우저는 화면을 한 번 누른 뒤에야 음성이 나옴 → 첫 터치·키 입력 때 빈 음성으로 열어 둠
function c1VoiceUnlock() {
  try { if (typeof initAudio === 'function') initAudio(); if (AU.ctx && AU.ctx.state !== 'running') AU.ctx.resume(); } catch (e) { }
  if (C1V.unlocked || !window.speechSynthesis) return; C1V.unlocked = true;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; u.lang = window.SIM_LANG === 'en' ? 'en-US' : 'ko-KR'; speechSynthesis.speak(u); speechSynthesis.resume(); } catch (e) { }
}
['pointerdown', 'keydown', 'touchend'].forEach(ev => document.addEventListener(ev, () => { if (isC1() || S.state === 'menu') c1VoiceUnlock(); }, { capture: true, passive: true }));
function c1VoiceStatus() {
  if (C1A.st === 'ready') return SET.c1voice === false ? L2('🔇 시험장 음성 꺼짐 (🔊 버튼)', '🔇 Test-field voice off (🔊)') : (!AU.ctx || AU.ctx.state !== 'running' ? L2('🔈 화면을 한 번 누르면 소리가 납니다', '🔈 Tap the screen once to enable sound') : '');
  if (!window.speechSynthesis) return L2('🔇 이 브라우저는 음성 합성을 지원하지 않습니다', '🔇 No speech synthesis in this browser');
  if (SET.c1voice === false) return L2('🔇 시험장 음성 꺼짐 (🔊 버튼)', '🔇 Test-field voice off (🔊)');
  if (C1V.err) return L2(`🔇 음성 오류 (${C1V.err}) · 화면을 한 번 누른 뒤 🔊 로 시험`, `🔇 Voice error (${C1V.err}) · tap the screen, then test with 🔊`);
  let all = []; try { all = speechSynthesis.getVoices(); } catch (e) { }
  if (all.length && !c1VoicePick().length) return L2('🔇 기기에 한국어 음성이 없습니다 · 기기 설정에서 한국어 음성(TTS) 데이터를 설치하세요', '🔇 No English voice on this device');
  return '';
}
function c1VoiceTest() { C1V.err = null; c1VoiceUnlock(); const vs = c1VoicePick(); c1Say(L2('음성 안내 시험입니다. 잘 들리십니까?', 'Voice check. Can you hear me?') + (vs.length ? '' : ''), 'ex'); }
function c1Caption(text, who, dur) {
  let el = $('c1cap'); if (!el) { el = document.createElement('div'); el.id = 'c1cap'; document.body.appendChild(el); }
  el.innerHTML = `<b>${who === 'me' ? L2('🗣 응시자', '🗣 Candidate') : L2('📢 시험위원', '📢 Examiner')}</b> ${text}`; el.className = who === 'me' ? 'me on' : 'on';
  clearTimeout(c1Caption.t); c1Caption.t = setTimeout(() => el.classList.remove('on'), (dur + 1.2) * 1000);
}
// 구호: 지금 단계의 구호를 버튼·키(Q)로 → 기기 음성이 대신 외침 · 마이크(음성인식)로 직접 말하면 그대로 기록
function c1CallDo(how) {
  const st = c1Cur(); if (!st || !st.call || st.callSaid) return false;
  const tx = L2(st.call.ko, st.call.en); if (how !== 'voice' && tx) c1Say(tx, 'me');
  st.callSaid = how; c1Ev('call', { how, text: st.call.ko });
  // 실제 시험처럼: 구호(이상무)를 외치면 그 단계 완료 → 다음으로 (다음 버튼 따로 안 눌러도 됨)
  if (!_c1conf && (st.k === 'prep' || (st.k === 'arm' && !st.csc) || st.k === 'disarm')) c1Confirm();
  return true;
}
function c1Heard(text) {
  const t = text.replace(/\s+/g, '').toLowerCase(); C1V.heard = text; C1V.heardT = 3;
  const st = c1Cur(); if (!st) return;
  if (st.call && !st.callSaid && st.call.kw.some(k => t.includes(k.toLowerCase()))) c1CallDo('voice');
  if (st.k === 'callout' && /비상|emergency/.test(t)) c1Key('KeyE', true);
}
function c1Mic(on) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (on && !SR) { showMsg(L2('이 브라우저는 음성인식을 지원하지 않습니다 · 버튼(Q)으로 구호', 'No speech recognition in this browser · use the call button (Q)'), '#ffc828', 2.5); C1V.micOn = false; return; }
  C1V.micOn = !!on;
  if (!on) { try { C1V.rec && C1V.rec.stop(); } catch (e) { } C1V.rec = null; return; }
  const r = new SR(); r.lang = window.SIM_LANG === 'en' ? 'en-US' : 'ko-KR'; r.continuous = true; r.interimResults = true;
  r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) c1Heard(e.results[i][0].transcript); };
  r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { C1V.micOn = false; showMsg(L2('마이크 권한이 없습니다', 'Microphone permission denied'), '#ff9a40', 2); } };
  r.onend = () => { if (C1V.micOn && C1V.rec === r) try { r.start(); } catch (e) { } };
  try { r.start(); C1V.rec = r; showMsg(L2('🎤 음성 구호 인식 켬 (인터넷 필요할 수 있음)', '🎤 Voice calls on (may need internet)'), '#5dff9a', 2); } catch (e) { C1V.micOn = false; }
}
function c1Arm(how) {
  if (C1.armed) return; C1.armed = true; C1.tArm = C1.t; c1Ev('arm', { how }); sfx('good');
  if (how === 'btn') c1CallDo('btn');
}

// ---- 비행 전 점검 (상태를 보고 정상/불량 판정 · 모의평가는 40% 확률로 이상 한 가지) ----
const C1INS = [
  { id: 'prop', ko: '프로펠러 체결·파손', en: 'Propellers: fixed, undamaged', ok: ['단단히 고정 · 손상 없음', 'Tight · no damage'], bad: ['한 장 끝에 금 · 손으로 흔들면 유격', 'Crack at one tip · play when shaken'] },
  { id: 'arm', ko: '암·폴딩 잠금', en: 'Arms / folding locks', ok: ['4개 모두 잠김', 'All four locked'], bad: ['오른쪽 뒤 암 잠금 풀림', 'Rear-right arm lock open'] },
  { id: 'skid', ko: '스키드·볼트·너트', en: 'Skids, bolts, nuts', ok: ['조임 정상', 'Tight'], bad: ['왼쪽 스키드 볼트 풀림', 'Left skid bolt loose'] },
  { id: 'bat', ko: '기체 배터리', en: 'Flight battery', ok: ['장착·잠금 · 셀당 4.18 V', 'Seated, locked · 4.18 V/cell'], bad: ['셀당 3.62 V (충전 부족)', '3.62 V/cell (not charged)'] },
  { id: 'tx', ko: '조종기 배터리', en: 'Transmitter battery', ok: ['85 %', '85 %'], bad: ['9 % · 저전압 경고', '9 % · low-voltage warning'] },
  { id: 'gps', ko: 'GPS·컴퍼스', en: 'GPS / compass', ok: ['위성 16개 · 컴퍼스 정상', '16 satellites · compass OK'], bad: ['위성 5개 · 컴퍼스 교정 필요', '5 satellites · compass calibration needed'] }
];
function c1Modal(html) {
  let el = $('c1m'); if (!el) { el = document.createElement('div'); el.id = 'c1m'; document.body.appendChild(el); }
  el.innerHTML = `<div class="box">${html}</div>`; el.classList.remove('hidden'); return el;
}
function c1ModalClose() { const el = $('c1m'); if (el) el.classList.add('hidden'); }
function c1InspectUI(st) {
  const ans = st.ans = {};
  const row = it => { const bad = st.fault === it.id; return `<tr><td>${L2(it.ko, it.en)}</td><td class="${bad ? 'warn' : ''}">${L2((bad ? it.bad : it.ok)[0], (bad ? it.bad : it.ok)[1])}</td><td><button data-i="${it.id}" data-v="ok">${L2('정상', 'OK')}</button><button data-i="${it.id}" data-v="bad">${L2('불량', 'Fault')}</button></td></tr>`; };
  const el = c1Modal(`<h3>${L2('비행 전 점검', 'Pre-flight inspection')}</h3><p class="dim">${L2('기체와 조종기를 확인하고 항목마다 상태를 판정하십시오. 이상이 있으면 불량을 고르면 조치(기체 교체) 후 진행합니다.', 'Check the aircraft and transmitter and judge each item. Mark a fault and it is fixed (aircraft swap) before you continue.')}</p>
<table>${C1INS.map(row).join('')}</table><button class="primary" id="c1InsGo" disabled>${L2('점검 완료', 'Inspection done')}</button>`);
  el.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => { ans[b.dataset.i] = b.dataset.v; el.querySelectorAll(`button[data-i="${b.dataset.i}"]`).forEach(x => x.classList.toggle('on', x === b)); $('c1InsGo').disabled = Object.keys(ans).length < C1INS.length; });
  $('c1InsGo').onclick = () => c1InspectDone(st);
}
function c1InspectDone(st) {
  if (st.done) return; st.done = true; c1ModalClose();
  const wrong = C1INS.filter(it => (st.ans[it.id] === 'bad') !== (st.fault === it.id)).map(it => it.id);
  c1Ev('inspect', { fault: st.fault, answers: st.ans, wrong });
  if (wrong.length) c1Fail(st, 'inspect', { wrong, fault: st.fault });
  if (st.fault && st.ans[st.fault] === 'bad') c1Say(L2('이상 확인. 조치 후 진행하십시오.', 'Fault confirmed. Fix it, then continue.'), 'ex');
  if (st.call && !st.callSaid) c1CallDo('auto');   // 점검을 마치면 보고 구호가 자동으로 나감 (버튼 없이)
}
function c1InspectAuto(correct) { const st = c1Cur(); if (!st || st.k !== 'inspect' || st.done) return; st.ans = {}; C1INS.forEach(it => st.ans[it.id] = correct ? (st.fault === it.id ? 'bad' : 'ok') : 'ok'); if (!correct && !st.fault) st.ans[C1INS[0].id] = 'bad'; c1InspectDone(st); }

// ---- 구술 문항 (앱 작성 예시 · 공식 출제 문항 아님 · 세부평가기준의 5개 항목 분류를 따름) ----
const C1Q = [
  { cat: 'ac', q: ['무인멀티콥터 1종의 구분 기준으로 맞는 것은?', 'Which defines a class-1 unmanned multicopter?'], a: [['최대이륙중량 25 kg 초과, 연료 제외 자체중량 150 kg 이하', 'MTOW over 25 kg, empty weight (excl. fuel) up to 150 kg'], ['최대이륙중량 7 kg 초과 25 kg 이하', 'MTOW over 7 kg up to 25 kg'], ['자체중량 25 kg 초과 기체만', 'Empty weight over 25 kg only'], ['최대이륙중량 2 kg 초과 7 kg 이하', 'MTOW over 2 kg up to 7 kg']] },
  { cat: 'ac', q: ['리튬폴리머 배터리 셀 1개의 완충 전압은 대략?', 'Roughly what is a full-charge LiPo cell voltage?'], a: [['4.2 V', '4.2 V'], ['3.7 V', '3.7 V'], ['3.0 V', '3.0 V'], ['5.0 V', '5.0 V']] },
  { cat: 'ac', q: ['비행제어기에서 기수 방향(방위)을 알려 주는 센서는?', 'Which flight-controller sensor gives heading?'], a: [['지자기 센서(컴퍼스)', 'Magnetometer (compass)'], ['기압 센서', 'Barometer'], ['자이로 센서', 'Gyroscope'], ['GPS 수신기만', 'GPS receiver alone']] },
  { cat: 'pi', q: ['실기시험표준서의 응시 요건으로 맞는 것은?', 'Which is a practical-test requirement in the standard?'], a: [['최근 2년 이내 학과시험 합격', 'Passed the written test within the last 2 years'], ['학과시험은 기간 제한 없이 인정', 'Written test valid with no time limit'], ['비행경력 없이 응시 가능', 'No flight experience needed'], ['구술시험 면제', 'Oral exam waived']] },
  { cat: 'pi', q: ['조종자 준수사항으로 맞는 것은?', 'Which is a pilot rule?'], a: [['주류 등을 섭취한 상태로 비행하지 않는다', 'Never fly under the influence of alcohol'], ['인구 밀집 지역 상공에서 물건을 떨어뜨려도 된다', 'Dropping objects over crowds is allowed'], ['비행 중 휴대폰으로 영상 통화를 해도 된다', 'Video calls while flying are fine'], ['안전성 인증은 선택 사항이다', 'Safety certification is optional']] },
  { cat: 'pi', q: ['시험 당일 표준서가 요구하는 소지 서류는?', 'Which document does the standard require on test day?'], a: [['유효한 항공신체검사증명서', 'A valid aviation medical certificate'], ['비행기록 원본 전체', 'All original flight logs'], ['기체 구매 영수증', 'Aircraft purchase receipt'], ['보험 증서 원본', 'Original insurance policy']] },
  { cat: 'as', q: ['NOTAM(항공고시보)이란?', 'What is a NOTAM?'], a: [['항공 시설·절차·위험 등 운항에 필요한 정보를 알리는 고시', 'Notice of facilities, procedures or hazards relevant to flight'], ['조종자 자격 시험 일정표', 'A licence exam timetable'], ['기체 정비 기록부', 'An aircraft maintenance log'], ['드론 판매 허가증', 'A drone sales permit']] },
  { cat: 'as', q: ['승인 없이 비행할 수 없는 고도 기준은?', 'Above what height is approval required?'], a: [['지표·수면 또는 물건 상단에서 150 m 이상', '150 m or more above ground, water or structure'], ['50 m 이상', '50 m or more'], ['300 m 이상', '300 m or more'], ['고도 제한 없음', 'No limit']] },
  { cat: 'as', q: ['관제권 안에서 비행하려면?', 'To fly inside a control zone you need…'], a: [['비행 승인을 받아야 한다', 'Flight approval'], ['신고 없이 낮게 날면 된다', 'Nothing if you stay low'], ['GPS 모드면 자유롭게 가능하다', 'Nothing in GPS mode'], ['야간에만 가능하다', 'Night-only flying']] },
  { cat: 'gk', q: ['유인 항공기와 마주쳤을 때 무인비행장치는?', 'Meeting a crewed aircraft, the unmanned aircraft must…'], a: [['진로를 양보하고 피한다', 'Give way and keep clear'], ['고도를 높여 위로 지나간다', 'Climb over it'], ['그대로 진행한다', 'Carry on'], ['속도를 높여 먼저 지나간다', 'Speed up to pass first']] },
  { cat: 'gk', q: ['비행 중 GPS 신호를 잃었을 때 알맞은 조치는?', 'GPS lost in flight — what do you do?'], a: [['자세모드로 직접 조종해 안전한 곳에 착륙', 'Fly manually in attitude mode and land somewhere safe'], ['스틱을 놓고 기다린다', 'Let go of the sticks and wait'], ['최대 속도로 이륙 지점까지 직진', 'Fly flat out to the takeoff point'], ['시동을 바로 끈다', 'Shut the motors off at once']] },
  { cat: 'gk', q: ['비행 중 기체 배터리 저전압 경고가 뜨면?', 'Low-battery warning in flight — what next?'], a: [['가까운 안전한 곳에 즉시 착륙', 'Land at the nearest safe spot now'], ['남은 기동을 끝내고 착륙', 'Finish the remaining tasks first'], ['고도를 높여 기다린다', 'Climb and wait'], ['경고를 끈다', 'Silence the warning']] },
  { cat: 'eo', q: ['이륙 중 모터 이상(소음·진동·한쪽 쏠림)을 느끼면?', 'Abnormal motor (noise, vibration, yaw) during takeoff?'], a: [['즉시 이륙을 포기하고 착륙 후 시동을 끈다', 'Abort, land and shut down at once'], ['출력을 높여 빨리 올라간다', 'Add power and climb away'], ['기준고도까지 올라간 뒤 판단한다', 'Climb to reference height, then decide'], ['조종기를 끈다', 'Switch the transmitter off']] },
  { cat: 'eo', q: ['이륙 직후 기체가 한쪽으로 쏠려 제어가 어려우면?', 'Just after liftoff the aircraft drifts and is hard to control?'], a: [['주변에 크게 알리고 가장 가까운 안전한 곳에 바로 착륙', 'Warn people loudly and land at the nearest safe spot'], ['계속 상승해 바람을 피한다', 'Keep climbing out of the wind'], ['시험위원에게 조종기를 넘긴다', 'Hand the transmitter to the examiner'], ['기수를 계속 돌려 본다', 'Keep spinning the nose']] },
  { cat: 'eo', q: ['이륙을 포기한 뒤 해야 할 일은?', 'After aborting a takeoff you should…'], a: [['시동을 끄고 배터리를 분리한 뒤 원인을 점검', 'Shut down, disconnect the battery and find the cause'], ['바로 다시 이륙해 본다', 'Try another takeoff at once'], ['기록 없이 넘어간다', 'Move on without noting it'], ['프로펠러를 손으로 돌려 본다', 'Spin the props by hand while armed']] }
];
const C1QCAT = { ac: ['기체', 'Aircraft'], pi: ['조종자', 'Pilot'], as: ['공역·비행장', 'Airspace & aerodrome'], gk: ['일반지식·비상절차', 'General & emergency'], eo: ['이륙 중 엔진 고장·이륙 포기', 'Engine failure on takeoff'] };
function c1OralUI(st) {
  const pick = Object.keys(C1QCAT).map(c => { const L = C1Q.filter(q => q.cat === c); return L[Math.floor(Math.random() * L.length)]; });
  st.qs = pick.map(q => { const ord = [0, 1, 2, 3].sort(() => Math.random() - 0.5); return { q, ord, ans: null }; }); st.qi = 0;
  const show = () => {
    const x = st.qs[st.qi], lang = window.SIM_LANG === 'en' ? 1 : 0;
    if (st.qi === 0 || !st.spoke) { }
    c1Say(x.q.q[lang], 'ex');
    const el = c1Modal(`<h3>${L2('구술시험', 'Oral exam')} ${st.qi + 1} / 5 · ${C1QCAT[x.q.cat][lang]}</h3><p class="q">${x.q.q[lang]}</p>${x.ord.map(i => `<button class="opt" data-a="${i}">${x.q.a[i][lang]}</button>`).join('')}<p class="dim">${L2('앱이 쓴 예시 문항입니다 · 실제 구술은 시험위원이 묻고 답을 듣고 판단합니다.', 'App-written example questions · the real oral exam is asked and judged by the examiner.')}</p>`);
    el.querySelectorAll('.opt').forEach(b => b.onclick = () => c1OralAns(st, +b.dataset.a));
  };
  st.show = show; show();
}
function c1OralAns(st, a) {
  const x = st.qs[st.qi]; if (!x || x.ans != null) return; x.ans = a; c1Ev('oral', { cat: x.q.cat, q: x.q.q[0], ok: a === 0 });
  if (a !== 0) c1Fail(st, 'oral', { cat: x.q.cat });
  st.qi++; if (st.qi < st.qs.length) st.show(); else { st.done = true; c1ModalClose(); }
}
function c1OralAuto(nOk) { const st = c1Cur(); if (!st || st.k !== 'oral' || !st.qs) return; for (let i = 0; i < 5 && !st.done; i++) c1OralAns(st, i < nOk ? 0 : 1); }

Object.assign(C1EV, {
  ann(st) { if (SET.c1ann === false) { C1.introCam = false; if (!st.skipLogged) { st.skipLogged = true; c1Ev('annOff'); } return true; } if (st.t1 == null) { st.t1 = C1.t + c1Say(L2(st.ko, st.en), 'ex'); if (C1.M[C1.mi] && C1.M[C1.mi].id === 'pre' && C1.si === 0) C1.introCam = true; } if (C1.t >= st.t1) { C1.introCam = false; return true; } return false; },
  inspect(st) { if (!st.open) { st.open = true; st.fault = Math.random() < (C1.exam ? 0.4 : 0.5) ? C1INS[Math.floor(Math.random() * C1INS.length)].id : null; if (window.C1_FAULT !== undefined) st.fault = window.C1_FAULT; c1InspectUI(st); } return !!st.done; },
  rc(st) {
    const sn = st.seen || (st.seen = {}), a = { thr: IN.thr, yaw: IN.yaw, pitch: IN.pitch, roll: IN.roll };
    for (const k in a) { if (a[k] > 0.85) sn[k + '+'] = 1; if (a[k] < -0.85) sn[k + '-'] = 1; }
    st.err = null; return (Object.keys(sn).length >= 8 || st.callSaid) && C1.mode === 'gps' && Math.abs(IN.thr) < 0.3 && Math.abs(IN.pitch) < 0.3;   // 이상무 구호를 하면 다음으로
  },
  arm(st, M, dt) {
    if (C1.armed) return true;
    if (st.csc) { const g = IN.thr < -0.8 && IN.pitch < -0.8 && Math.abs(IN.yaw) > 0.8 && Math.abs(IN.roll) > 0.8 && Math.sign(IN.yaw) !== Math.sign(IN.roll); st.g = g ? (st.g || 0) + dt : 0; if (st.g > 0.5) { c1Arm('csc'); return true; } }
    return false;
  },
  ctl(st, M, dt) {
    const lat = Math.hypot(M.u - st.at[0], M.v - st.at[1]); st.err = { lat, alt: M.alt - (C1.ref || 4), hdg: c1Wrap(M.hdg) };
    c1Dev(st, 'pos', lat > c1R('posTol'), { lat: +lat.toFixed(2) }, dt); c1Dev(st, 'alt', Math.abs(st.err.alt) > c1R('altTol'), { alt: +M.alt.toFixed(2) }, dt);
    const sn = st.seen || (st.seen = {}); for (const [k, v] of [['p', IN.pitch], ['r', IN.roll], ['y', IN.yaw]]) { if (v > 0.12) sn[k + '+'] = 1; if (v < -0.12) sn[k + '-'] = 1; }
    st.okT = (Object.keys(sn).length >= 6 || st.callSaid) && c1Still(M) ? (st.okT || 0) + dt : 0;   // 이상무 구호를 하면 다음으로 (조작 확인은 기록만)
    if (st.okT > 0.8) { c1Ev('ctlChk', { seen: Object.keys(sn), byCall: !!st.callSaid }); return true; }
    return false;
  },
  oral(st) { if (!st.open) { st.open = true; c1OralUI(st); } return !!st.done; }
});

// =====================================================================
//  VR (Quest 등): 1종 연습은 고글 화면이 아니라 조종자 자리(P)에 서서 맨눈으로 기체를 보는 방식
//  · 머리를 돌려 기체를 따라 봄 · 왼손 앞 아래에 안내판 · A 확인 · X 비상(점검 때는 불량) · Y 모드 · R트리거 구호 · B 메뉴
// =====================================================================
var C1XR = { rig: null, cam: null, board: null, t: 0, sel: 0, selT: 0 };
function c1VRon() { return ((typeof XR_ON !== 'undefined' && XR_ON && !XR.menu) || window.C1_VRTEST) && isC1() && S.state !== 'menu'; }
function c1XRInit() {
  if (C1XR.rig) return;
  const rig = new THREE.Group(); scene.add(rig); const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 9000); rig.add(cam);
  const b = vrPlane(0.62, 0.42, 1024, 694, { depthTest: false }); b.m.position.set(-0.32, 1.02, -0.5); b.m.rotation.set(-0.62, 0.42, 0, 'YXZ'); b.m.renderOrder = 30; rig.add(b.m);
  Object.assign(C1XR, { rig, cam, board: b });
}
function c1XRUpdate(dt) {
  c1XRInit(); const R = C1XR.rig;
  const at = C1.introCam ? c1W(-9, -7.5, 0) : c1W(0, 0, 0);
  const raise = XR.local ? c1p('eye') : 0;   // 바닥 기준 공간이 없으면 눈높이만큼 올림 (안내판은 그만큼 내림)
  R.position.copy(at); R.position.y += raise; C1XR.board.m.position.y = 1.02 - raise;
  R.rotation.set(0, -C1S.h, 0); R.updateMatrixWorld(true);
  if (window.C1_VRTEST) { C1XR.cam.position.set(0, c1p('eye'), 0); C1XR.cam.updateMatrixWorld(); C1XR.cam.lookAt(DR.p); C1XR.cam.aspect = innerWidth / innerHeight; C1XR.cam.updateProjectionMatrix(); }
  C1XR.board.m.visible = S.state === 'run' || S.state === 'pause' || S.state === 'result';
  // 점검·구술 고르기: 오른쪽 스틱 위아래
  const st = c1Cur(); C1XR.selT -= dt;
  if (st && st.k === 'oral' && st.qs && C1XR.selT <= 0) { if (IN.pitch > 0.6) { C1XR.sel = (C1XR.sel + 3) % 4; C1XR.selT = 0.3; } else if (IN.pitch < -0.6) { C1XR.sel = (C1XR.sel + 1) % 4; C1XR.selT = 0.3; } }
  C1XR.t -= dt; if (C1XR.t > 0) return; C1XR.t = 0.2; c1BoardDraw();
}
function c1BoardDraw() {
  const B = C1XR.board, g = B.cv.getContext('2d'), W2 = B.cv.width, H2 = B.cv.height, st = c1Cur(), m = C1.M[C1.mi];
  g.clearRect(0, 0, W2, H2); g.fillStyle = 'rgba(10,14,20,.9)'; vrRR(g, 0, 0, W2, H2, 26); g.fill(); g.strokeStyle = '#c9a2ff'; g.lineWidth = 4; vrRR(g, 2, 2, W2 - 4, H2 - 4, 24); g.stroke();
  let y = 22; const line = (t, col, sz, wt) => { g.fillStyle = col || '#e8eef3'; g.font = `${wt || 600} ${sz || 30}px system-ui, sans-serif`; const ws = String(t).split(' '); let ln = ''; for (const w of ws) { const tl = ln ? ln + ' ' + w : w; if (g.measureText(tl).width > W2 - 56 && ln) { g.fillText(ln, 28, y); y += (sz || 30) * 1.25; ln = w; } else ln = tl; } if (ln) { g.fillText(ln, 28, y); y += (sz || 30) * 1.25; } };
  g.textBaseline = 'top';
  line((C1.exam ? L2('1종 모의평가', 'CLASS 1 · MOCK') : C1.demo ? L2('1종 시범비행', 'CLASS 1 · DEMO') : L2('1종 학습', 'CLASS 1 · LEARN')) + ' · ' + C1.mode.toUpperCase() + (C1.armed ? ' · ARMED' : ' · SAFE') + (C1.ref ? ' · ' + L2('기준', 'REF') + ' ' + C1.ref.toFixed(1) + ' m' : ''), '#c9a2ff', 24, 700);
  if (m) line(`${C1.mi + 1}. ${m.name}`, '#fff', 34, 800);
  if (st) line(st.lab, '#ffc828', 27);
  if (st && st.k === 'inspect' && st.open && !st.done) {
    const i = C1INS.findIndex(it => !st.ans[it.id]), it = C1INS[i];
    if (it) { const bad = st.fault === it.id; line(`${i + 1}/${C1INS.length} ${L2(it.ko, it.en)}: ${L2((bad ? it.bad : it.ok)[0], (bad ? it.bad : it.ok)[1])}`, '#fff', 28); line(L2('A = 정상 · X = 불량', 'A = OK · X = faulty'), '#7fd0ff', 26); }
  } else if (st && st.k === 'oral' && st.qs && !st.done) {
    const x = st.qs[st.qi], lang = window.SIM_LANG === 'en' ? 1 : 0; line(x.q.q[lang], '#fff', 27, 700);
    x.ord.forEach((ai, k) => line(`${k === C1XR.sel ? '▶ ' : '   '}${x.q.a[ai][lang]}`, k === C1XR.sel ? '#5dff9a' : '#cfd6da', 24));
    line(L2('오른쪽 스틱 위아래로 고르고 A', 'Right stick up/down, then A'), '#7fd0ff', 22);
  } else {
    if (st && st.call) { const c = L2(st.call.ko, st.call.en); line((st.callSaid ? '✓ ' : '📣 ') + (st.call.count ? (c ? c + ' → ' : '') + L2('정지. 하나…다섯', 'hold, one…five') : c), st.callSaid ? '#5dff9a' : '#7fd0ff', 24); }
    const M = c1M(), e = st && st.err; let r = `${L2('스키드', 'Skid')} ${M.alt.toFixed(1)} m · ${L2('기수', 'Hdg')} ${c1Wrap(M.hdg).toFixed(0)}°`;
    if (!C1.exam && e) { if (e.lat != null) r += ` · ${L2('위치', 'Pos')} ${e.lat.toFixed(1)}`; if (e.alt != null && st.k !== 'land' && st.k !== 'emg') r += ` · ${L2('고도', 'Ht')} ${(e.alt >= 0 ? '+' : '') + e.alt.toFixed(1)}`; if (st.k === 'hold') r += ` · ${L2('정지', 'Hold')} ${st.armedEval ? st.t.toFixed(1) : '–'}/${st.T}s`; }
    line(r, '#cfd6da', 24);
    if (st && st.k === 'rc') { const sn = st.seen || {}; line(['thr+', 'thr-', 'yaw-', 'yaw+', 'pitch+', 'pitch-', 'roll-', 'roll+'].map(k => (sn[k] ? '✓' : '·') + k.replace('thr', 'T').replace('yaw', 'R').replace('pitch', 'E').replace('roll', 'A')).join(' '), '#cfd6da', 22); }
  }
  const cap = $('c1cap'); if (cap && cap.classList.contains('on')) line(cap.textContent, '#ffd27a', 24);
  if (S.state === 'result') line(L2('결과는 웹 화면 · B 메뉴', 'Results on the web page · B menu'), '#fff', 26);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '500 20px system-ui, sans-serif'; g.fillText(L2('A 확인 · X 비상 · Y 모드 · R트리거 구호 · B 메뉴', 'A ok · X emergency · Y mode · R-trigger call · B menu'), 28, H2 - 58);
  g.fillText(C1DISC(), 28, H2 - 32);
  B.tex.needsUpdate = true;
}

c1Place();
if (window.__sim) Object.assign(window.__sim, { WIND, C1, C1P, C1RULES, C1PT, C1EV, C1S, c1Key, c1M, c1W, C1V, C1XR, c1XRUpdate, c1InspectAuto, c1OralAuto, c1CallDo, c1Heard, C1INS, C1Q, c1UV, c1Jump, c1Cur, c1SkidOnPad, c1CenterOnPad, c1Wrap, c1Log, c1Build, c1Flow, getDroneM: () => droneM, AF, AF_IDS, MS_OK, TOUCH, isC1 });
