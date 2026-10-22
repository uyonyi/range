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
  ver: 'c1p-0.1', label: { ko: '1종 연습용 대형 멀티콥터 (가정값 · 실기체 보정 전)', en: 'Class-1 practice multicopter (assumed values · not calibrated)' },
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

AF.c1 = { tag: 'C1', name: L2('1종 연습기 (가정값)', 'Class-1 trainer (assumed)'), sub: L2('대형 멀티콥터 · 최대이륙중량 30 kg 가정 · 실기체 보정 전', 'Large multicopter · 30 kg MTOW assumed · not calibrated'), cls: 'quad', c1: true,
  top: 10, vmax: { train: 5, easy: 5, sport: 10 }, tilt: { train: 18, easy: 18, sport: 25 }, climb: 2, sink: 1.5, yaw: 70, tw: 2.0, R: 0.75, endur: 20,
  note: L2('1종 실기 연습 전용 · 계수는 가정값', 'Class-1 practice only · coefficients are assumptions') };
AF.c1.id = 'c1'; AF_IDS.push('c1');
MS_OK.class1 = ['c1']; MS_OK.class1x = ['c1'];
MS_NAME.class1 = L2('1종 실기 학습', 'Class-1 practice (learn)'); MS_NAME.class1x = L2('1종 모의평가', 'Class-1 mock check');
MS_CAT.class1 = MS_CAT.class1x = 'exam'; CAT_C.exam = '#c9a2ff';
BRIEF.class1 = [L2('무인멀티콥터 1종 실기 · 학습', 'Unmanned multicopter class 1 · learn'),
  L2('평탄 시험장에서 이륙·호버링·전후진·삼각·원주·비상·정상접근·측풍접근 순서로 연습합니다. 경로·허용구역·타이머를 보여 줍니다.', 'Practise takeoff, hover, forward/back, triangle, circle, emergency, normal and crosswind approach on a flat test field, with path, tolerance box and timers shown.'),
  L2('조종자 위치(P)에서 보는 시점 · Enter 확인 · Y 비행모드 · E "비상" · C 시점 · 기준 문서 참고 연습용이며 공식 시험·교육시간 인정 여부는 확인되지 않았습니다.', 'Pilot-position view · Enter confirm · Y flight mode · E "emergency" · C view · Reference practice only; not an official test and not counted as training time.')];
BRIEF.class1x = [L2('무인멀티콥터 1종 · 모의평가', 'Unmanned multicopter class 1 · mock check'),
  L2('보조 표시 없이 전체 기동을 순서대로 수행하고 항목별 S/U 모의판정을 받습니다. 구술·공중경계·판단력은 미평가로 남습니다.', 'Fly the whole sequence without aids and get a per-item S/U mock verdict. Oral, lookout and judgement stay unrated.'),
  L2('모의판정은 앱 기준이며 합격·자격 판정이 아닙니다.', 'Mock verdicts follow app rules; they are not a pass or a certificate.')];
function isC1(k) { k = k || S.kind; return k === 'class1' || k === 'class1x'; }

// ---- 시험장 좌표 (u = 조종자 오른쪽, v = 전방, 단위 m) ----
// 세부평가기준 배치도: P→H 15 m, H→A 7.5 m, A→E 40 m, A→B·D 7.5 m, F 는 H 와 같은 줄의 좌·우 7.5 m, H·F 2×2 m
const C1S = { x: 14000, z: 14000, y: 0 };
const C1PT = { P: [0, 0], H: [0, 15], A: [0, 22.5], B: [-7.5, 22.5], C: [0, 30], D: [7.5, 22.5], E: [0, 62.5], FB: [-7.5, 15], FD: [7.5, 15] };
const C1FIELD = { u0: -17.5, u1: 17.5, v0: -2.4, v1: 77.6, src: 'app' };   // 80×35 m 부지 경계 (P 와 경계 사이 여백은 앱 설정)
function c1W(u, v, h) { return new V3(C1S.x + u, C1S.y + (h || 0), C1S.z - v); }
function c1UV(p) { return [p.x - C1S.x, C1S.z - p.z]; }

var C1 = { on: false, exam: false, side: -1, mode: 'gps', view: 'pilot', armed: false, ref: null, refDesc: null, mi: 0, si: 0, M: [], ev: [], t: 0, az: 0, yr: 0, hold: null, ei: new V3(), touch: null, over: false };

// ---- 기동 정의 ----
// 단계 종류: prep(확인) · arm · climb(이륙 상승·기준고도) · hold · move · arc · callout · emg · land · disarm · xfer(평가 제외 이동)
function c1Build(side) {
  const L = side < 0, s = side, P = C1PT, SB = L ? P.B : P.D, SD = L ? P.D : P.B, F = L ? P.FB : P.FD;
  const nm = (ko, en) => L2(ko, en), sideKo = L ? '좌' : '우', sideEn = L ? 'left' : 'right', oKo = L ? '우' : '좌', oEn = L ? 'right' : 'left';
  const H0 = (at, hdg, T, lab, o) => Object.assign({ k: 'hold', at, r: 0, hdg, T: T || c1R('hoverT'), lab }, o || {});
  return [
    { id: 'pre', name: nm('비행 전 절차', 'Pre-flight'), unrated: true, steps: [
      { k: 'prep', lab: nm('비행 전 점검 (볼트·너트 조임, 파손 등) · Enter', 'Pre-flight inspection (bolts, damage…) · Enter') },
      { k: 'prep', lab: nm('기체 시동 · Enter', 'Start the aircraft · Enter'), arm: true },
      { k: 'prep', lab: nm('이륙 전 점검 (계기·장비 작동) · Enter', 'Before-takeoff check (instruments) · Enter') }] },
    { id: 'to', name: nm('이륙비행', 'Takeoff'), steps: [
      { k: 'climb', at: P.H, lab: nm('H 에서 수직 상승 → 3~5 m 에서 정지 (기준고도 설정)', 'Climb vertically from H → stop at 3–5 m (sets reference height)') },
      H0(P.H, 0, 0, nm('정지 호버링 5초', 'Hover 5 s'), { posWatch: true }),
      H0(P.H, 0, 0, nm('호버링 중 조작계통 점검 (에일러론·엘리베이터·러더) 후 정지', 'Control check while hovering, then hold'), { posWatch: true, ctl: true }),
      { k: 'xfer', to: P.A, lab: nm('A 지점으로 전진 이동 (평가 제외)', 'Move forward to A (not scored)') }] },
    { id: 'hov', name: nm('공중 정지비행 (호버링)', 'Hovering'), steps: [
      H0(P.A, 0, 0, nm('A 에서 기준고도·기수 전방 정지', 'Hold at A, reference height, nose forward')),
      H0(P.A, 90 * s, 0, nm(`${sideKo}로 90° 회전 → 정지`, `Turn 90° ${sideEn} → hold`), { posWatch: true, rot: true }),
      H0(P.A, -90 * s, 0, nm(`${oKo}로 180° 회전 → 정지`, `Turn 180° ${oEn} → hold`), { posWatch: true, rot: true }),
      H0(P.A, 0, 0, nm(`${sideKo}로 90° 회전해 기수 전방 → 정지`, `Turn 90° ${sideEn} to face forward → hold`), { posWatch: true, rot: true })] },
    { id: 'fb', name: nm('직진 및 후진 수평비행', 'Forward & backward'), steps: [
      { k: 'move', from: P.A, to: P.E, hdg: 0, lab: nm('A → E 40 m 수평 전진', 'A → E, 40 m forward'), alongTol: c1R('eAlong') },
      H0(P.E, 0, c1R('hoverTE'), nm('E 정지 3초 이상 (전후 5 m 인정)', 'Hold at E ≥ 3 s (±5 m along)'), { alongTol: c1R('eAlong') }),
      { k: 'move', from: P.E, to: P.A, hdg: 0, lab: nm('E → A 40 m 수평 후진 (기수 전방)', 'E → A, 40 m backward (nose forward)') },
      H0(P.A, 0, 0, nm('A 정지', 'Hold at A'))] },
    { id: 'tri', name: nm('삼각비행', 'Triangle'), steps: [
      { k: 'move', from: P.A, to: SB, hdg: 0, lab: nm(`A → ${L ? 'B' : 'D'} 수평 이동`, `A → ${L ? 'B' : 'D'} level`) },
      H0(SB, 0, 0, nm('정지', 'Hold')),
      { k: 'move', from: SB, to: P.A, r1: c1R('triRise'), hdg: 0, lab: nm('A 상공 기준고도+7.5 m 로 45° 상승', '45° climb to reference +7.5 m above A') },
      H0(P.A, 0, 0, nm('정지 (최고점)', 'Hold (apex)'), { r: c1R('triRise') }),
      { k: 'move', from: P.A, r0: c1R('triRise'), to: SD, hdg: 0, lab: nm(`${L ? 'D' : 'B'} 로 45° 하강`, `45° descent to ${L ? 'D' : 'B'}`), desc: true },
      H0(SD, 0, 0, nm('정지', 'Hold')),
      { k: 'move', from: SD, to: P.A, hdg: 0, lab: nm('A 로 수평 이동', 'Level to A') },
      H0(P.A, 0, 0, nm('정지', 'Hold')),
      { k: 'xfer', to: P.H, lab: nm('H 로 후진 이동 (평가 제외)', 'Back up to H (not scored)') }] },
    { id: 'cir', name: nm('원주비행 (러더턴)', 'Circle (rudder turn)'), steps: [
      H0(P.H, 0, 0, nm('H 상공 기준고도·기수 전방 정지', 'Hold over H, nose forward')),
      H0(P.H, 90 * s, 0, nm(`기수 ${sideKo}로 90° → 정지`, `Nose 90° ${sideEn} → hold`), { posWatch: true, rot: true }),
      { k: 'arc', c: P.A, R: 7.5, dir: s, start: P.H, lab: nm(`반경 7.5 m 원주: H → ${L ? 'B' : 'D'} → C → ${L ? 'D' : 'B'} → H`, `7.5 m circle: H → ${L ? 'B' : 'D'} → C → ${L ? 'D' : 'B'} → H`) },
      H0(P.H, 90 * s, 0, nm('H 상공 복귀 정지', 'Back over H, hold')),
      H0(P.H, 0, 0, nm(`${oKo}로 90° 회전해 기수 전방 → 정지`, `Turn 90° ${oEn} to face forward → hold`), { posWatch: true, rot: true })] },
    { id: 'emg', name: nm('비상조작', 'Emergency'), steps: [
      H0(P.H, 0, 0, nm('H 상공 기준고도 +2 m 이상 상승 → 정지', 'Climb ≥ 2 m above reference over H → hold'), { altWin: [c1R('emgRise'), c1R('emgRise') + 2.5], posWatch: 'xy' }),
      { k: 'callout', lab: nm('"비상" 구호 (E 키 · 버튼)', 'Call "emergency" (E key · button)') },
      { k: 'emg', pad: F, lab: nm(`즉시 하강하며 F(${L ? 'B' : 'D'}쪽)로 빠르게 비상 강하 → 착지`, `Descend at once and move fast to F (${L ? 'B' : 'D'} side) → touch down`) },
      { k: 'disarm', lab: nm('시동 종료 · Enter', 'Shut down · Enter') }] },
    { id: 'nrm', name: nm('정상접근 및 착륙 (자세모드)', 'Normal approach & landing (attitude mode)'), needMode: true, steps: [
      { k: 'mode', lab: nm('비행모드를 자세제어(ATTI) 또는 수동으로 전환 (Y)', 'Switch to attitude (ATTI) or manual mode (Y)') },
      { k: 'arm', lab: nm('시동 · Enter', 'Start · Enter') },
      H0(F, 0, 0, nm('F 에서 기수 전방으로 이륙 → 기준고도 정지', 'Take off from F nose forward → hold at reference height'), { posWatch: 'xy' }),
      { k: 'move', from: F, to: P.H, hdg: 0, lab: nm('H 상공까지 수평 횡이동', 'Sideways level move to over H') },
      H0(P.H, 0, 0, nm('정지', 'Hold')),
      { k: 'land', pad: P.H, hdg: 0, lab: nm('착륙장 안 착륙지점으로 강하 → 착륙 (중심축 기준)', 'Descend to the touchdown point → land (centre axis)') },
      { k: 'disarm', lab: nm('시동 종료 · Enter', 'Shut down · Enter') }] },
    { id: 'xw', name: nm('측풍접근 및 착륙', 'Crosswind approach & landing'), steps: [
      { k: 'mode', gps: true, lab: nm('GPS 모드로 전환 (Y) · 평가 제외', 'Back to GPS mode (Y) · not scored') },
      { k: 'arm', lab: nm('시동 · Enter (평가 제외)', 'Start · Enter (not scored)') },
      { k: 'xfer', to: SB, lab: nm(`이륙 후 기수 전방으로 ${L ? 'B' : 'D'} 지점 이동 (평가 제외)`, `Take off and move nose-forward to ${L ? 'B' : 'D'} (not scored)`) },
      H0(SB, 0, 0, nm(`${L ? 'B' : 'D'} 에서 기준고도·기수 전방 정지`, `Hold at ${L ? 'B' : 'D'}, nose forward`)),
      H0(SB, 90 * s, 0, nm(`바람 쪽(${sideKo})으로 90° 회전 → 정지`, `Turn 90° into the wind (${sideEn}) → hold`), { posWatch: true, rot: true }),
      { k: 'move', from: SB, to: P.H, hdg: 90 * s, lab: nm('측면 상태로 H 상공까지 직선 이동', 'Straight sideways to over H') },
      H0(P.H, 90 * s, 0, nm('정지', 'Hold')),
      { k: 'land', pad: P.H, hdg: 90 * s, lab: nm('강하 → 착륙 (중심축 기준)', 'Descend → land (centre axis)') },
      { k: 'disarm', lab: nm('시동 종료 · Enter', 'Shut down · Enter') }] },
    { id: 'post', name: nm('비행 후 점검 · 비행기록', 'Post-flight · logbook'), unrated: true, steps: [
      { k: 'prep', lab: nm('비행 후 점검 · Enter', 'Post-flight inspection · Enter') },
      { k: 'prep', lab: nm('비행기록 작성 · Enter (기록 내보내기는 결과 화면)', 'Write the flight log · Enter (export on the result screen)') }] }
  ];
}

// ---- 기체 형상: X2D 형상과 별도로 굵은 팔·스키드·큰 프롭 ----
function makeC1(ghost) {
  const K = partsKit(ghost);
  const body = K.m(mat(0x30343a, { roughness: 0.55 })), arm = K.m(mat(0x1d1f22, { roughness: 0.5 })), mot = K.m(mat(0x808890, { roughness: 0.35, metalness: 0.6 })), skid = K.m(mat(0x2a2c30, { roughness: 0.6 }));
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
  return { g: K.g, props, leds, cans: [] };
}

// ---- 시험장 (평탄 · 지형과 떨어진 곳) ----
var C1G = null;   // var: 초기화 전 호출돼도 오류 없게
function c1Label(t, col, sz) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = col || '#fff'; g.font = 'bold 96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 64, 70);
  const tx = new THREE.CanvasTexture(c); const m = new THREE.Mesh(new THREE.PlaneGeometry(sz || 1.4, sz || 1.4), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}
function c1Site() {
  if (C1G) return C1G;
  const G0 = new THREE.Group(); C1G = G0; scene.add(G0); G0.visible = false;
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gg = gc.getContext('2d');
  gg.fillStyle = '#6d8a4a'; gg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { gg.fillStyle = `rgba(${40 + Math.random() * 60 | 0},${70 + Math.random() * 70 | 0},${30 + Math.random() * 30 | 0},0.35)`; gg.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(900, 900); gt.encoding = THREE.sRGBEncoding; gt.anisotropy = 4;
  // 아주 큰 삼각형은 깊이 정밀도가 떨어져 위의 표지를 덮으므로 잘게 나누고 살짝 아래·뒤로 밀어 둠
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(18000, 18000, 90, 90), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 }));
  ground.rotation.x = -Math.PI / 2; ground.position.copy(c1W(0, 30, -0.03)); ground.receiveShadow = true; G0.add(ground);
  // 시험 구역 (짧게 깎은 잔디)
  const fld = new THREE.Mesh(new THREE.PlaneGeometry(C1FIELD.u1 - C1FIELD.u0, C1FIELD.v1 - C1FIELD.v0), new THREE.MeshStandardMaterial({ color: 0x7f9b56, roughness: 1 }));
  fld.rotation.x = -Math.PI / 2; fld.position.copy(c1W((C1FIELD.u0 + C1FIELD.u1) / 2, (C1FIELD.v0 + C1FIELD.v1) / 2, 0.003)); fld.receiveShadow = true; G0.add(fld);
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
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 })); m.rotation.x = -Math.PI / 2; m.position.copy(c1W(uv[0], uv[1], 0.01)); m.receiveShadow = true; G0.add(m);
    line([c1W(uv[0] - 1, uv[1] - 1, 0.015), c1W(uv[0] + 1, uv[1] - 1, 0.015), c1W(uv[0] + 1, uv[1] + 1, 0.015), c1W(uv[0] - 1, uv[1] + 1, 0.015), c1W(uv[0] - 1, uv[1] - 1, 0.015)], 0xffffff, 1);
    const l = c1Label(t, '#ffffff', 1.5); l.position.copy(c1W(uv[0], uv[1], 0.02)); l.rotation.z = 0; G0.add(l);
  };
  pad(C1PT.H, 'H', 0x3a4048); pad(C1PT.FB, 'F', 0x8a3030); pad(C1PT.FD, 'F', 0x8a3030);
  // 지점 표지 (A·B·C·D·E 원판 + 글자) · 조종자 P
  const cone = mat(0xff8a1e, { roughness: 0.7 });
  for (const k of ['A', 'B', 'C', 'D', 'E', 'P']) {
    const uv = C1PT[k], d = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), new THREE.MeshStandardMaterial({ color: k === 'P' ? 0x2e6bd6 : 0xf0f0f0, roughness: 0.9 }));
    d.rotation.x = -Math.PI / 2; d.position.copy(c1W(uv[0], uv[1], 0.012)); G0.add(d);
    const l = c1Label(k, k === 'P' ? '#ffffff' : '#222', 1.0); l.position.copy(c1W(uv[0], uv[1], 0.02)); G0.add(l);
    if (k !== 'P' && k !== 'A') { const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 12), cone); c.position.copy(c1W(uv[0] + 0.9, uv[1], 0.22)); c.castShadow = true; G0.add(c); }
  }
  // 바람 자루 (풍향 참고)
  const pole = new THREE.Mesh(UCYL, mat(0xdddddd)); pole.scale.set(0.04, 4, 0.04); pole.position.copy(c1W(-16, 10, 2)); G0.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.4, 10, 1, true), mat(0xff6020, { side: THREE.DoubleSide })); sock.position.copy(c1W(-16, 10, 3.9)); G0.add(sock); C1.sock = sock;
  // 주변 나무 (깊이 감각용 · 배치 임의)
  const tm = mat(0x3c5e2c), trk = mat(0x5a4632); let sd = 7;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 260, u = Math.sin(a) * r, v = 30 + Math.cos(a) * r, h = 6 + rnd() * 8;
    const t = new THREE.Mesh(UCYL, trk); t.scale.set(0.25, h * 0.4, 0.25); t.position.copy(c1W(u, v, h * 0.2)); G0.add(t);
    const c = new THREE.Mesh(new THREE.ConeGeometry(h * 0.28, h * 0.8, 8), tm); c.position.copy(c1W(u, v, h * 0.55)); c.castShadow = true; G0.add(c);
  }
  // 학습용 보조 표시: 목표 허용 상자 · 경로 선
  C1.aidBox = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  G0.add(C1.aidBox);
  C1.aidLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]), new THREE.LineBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.85 }));
  C1.aidLine.frustumCulled = false; G0.add(C1.aidLine);
  C1.aidArrow = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 10), new THREE.MeshBasicMaterial({ color: 0xffc828, transparent: true, opacity: 0.85, depthWrite: false })); C1.aidArrow.rotation.x = -Math.PI / 2; G0.add(C1.aidArrow);
  return G0;
}
// 메뉴·출격 시 시험장 보이기/감추기
function c1Menu(k) {
  if (!C1) return;
  const on = isC1(k);
  if (on) c1Site();
  if (C1G) C1G.visible = on;
  if (!on) C1.on = false;
  C1ON = on;
  const p = $('c1p'); if (p && (!on || S.state === 'menu' || S.state === 'result')) p.classList.add('hidden');
  if (ui.map) ui.map.style.display = on ? 'none' : '';
  const kh = $('keys'); if (kh) kh.style.display = on ? 'none' : '';
  document.body.classList.toggle('c1on', on && S.state !== 'menu');
}

// ---- 비행 모델 (최소 모델 · 120 Hz 고정 스텝에서 호출) ----
function c1Wind(p) {
  const base = WIND.lv === 1 ? 3 : WIND.lv === 2 ? 7 : 0;
  if (!base) return _c1w.set(0, 0, 0);
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
  const gy = C1S.y + c1p('skidDrop');
  const onG = DR.p.y <= gy + 0.005;
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
  if (DR.p.y > C1S.y + 60) { DR.p.y = C1S.y + 60; DR.v.y = Math.min(0, DR.v.y); }
}

// ---- 측정값 ----
function c1M() {
  const uv = c1UV(DR.p);
  return { u: uv[0], v: uv[1], alt: DR.p.y - C1S.y - c1p('skidDrop'), hdg: DR.h / DEG, hs: Math.hypot(DR.v.x, DR.v.z), vy: DR.v.y, yr: Math.abs(C1.yr) / DEG };
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
    safe: L2('안전거리(14 m)·안전라인 침범', 'inside the 14 m safety radius / line'), hard: L2('거친 접지', 'hard touchdown') })[w] || w;
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

// ---- 진행 ----
function c1Start(a) {
  c1Site(); C1G.visible = true; C1ON = true;
  Object.assign(C1, { on: true, exam: S.kind === 'class1x', mode: 'gps', view: 'pilot', armed: false, ref: null, refDesc: null, mi: 0, si: 0, ev: [], t: 0, az: 0, yr: 0, hold: null, touch: null, crash: null, over: false, tArm: null, altT: null, modeLog: [] });
  C1.ei.set(0, 0, 0);
  C1.side = SET.c1side === 1 ? 1 : -1;
  C1.M = c1Build(C1.side);
  C1.M.forEach(m => { m.done = false; m.miss = false; m.fail = false; m.why = []; m.label = m.name; m.steps.forEach(s => { s.T = s.T || c1R('hoverT'); }); });
  S.cam = 1; ui.map.style.display = 'none'; document.body.classList.add('c1on');
  c1Panel(true);
  c1Ev('start', { exam: C1.exam, side: C1.side < 0 ? 'left-first' : 'right-first', profile: C1P.ver, rules: C1RULES.ver, wind: WIND.lv });
  return C1.M;
}
function c1StartPose() { return { p: c1W(C1PT.H[0], C1PT.H[1], c1p('skidDrop')), h: 0 }; }
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
  if (m.needMode && C1.si > 0 && C1.mode === 'gps' && !st.fails?.includes('mode')) c1Fail(st, 'mode');
  const fn = C1EV[st.k]; if (fn && fn(st, M, dt)) c1Next();
}
function c1Key(k) {
  if (!isC1() || S.state !== 'run') return false;
  const st = c1Cur();
  if (k === 'KeyY') { c1Mode(); return true; }
  if (k === 'KeyE') { if (st && st.k === 'callout' && !st.wait2) { st.wait2 = true; c1Ev('callout'); showMsg(L2('"비상!"', '"EMERGENCY!"'), '#ff5050', 1.2); sfx('bad'); c1Next(); const n = c1Cur(); if (n) n.t0 = C1.t; } return true; }
  if (k === 'KeyC' || k === 'PadRB') { if (!C1.exam) { C1.view = C1.view === 'pilot' ? 'chase' : 'pilot'; showMsg(C1.view === 'pilot' ? L2('조종자 시점', 'Pilot view') : L2('추적 시점 (학습용)', 'Chase view (learning)'), '#4fe3ff', 1); } else showMsg(L2('모의평가는 조종자 시점만', 'Mock check uses the pilot view only'), '#ffc828', 1); return true; }
  if (k === 'Enter' || k === 'Space' || k === 'PadA') { c1Confirm(); return true; }
  if (k === 'KeyR' || k === 'PadY') { if (!C1.exam) { c1Jump(C1.mi, true); showMsg(L2('이 기동 다시', 'Restart this manoeuvre'), '#c9a2ff', 1); } return true; }
  if (k === 'KeyN') { if (!C1.exam) { c1Ev('skipStep'); const m = C1.M[C1.mi]; if (m) m.skipped = true; c1Next(); } return true; }
  if (/^Digit[1-9]$/.test(k) && !C1.exam) { c1Jump(+k.slice(5)); return true; }
  return false;
}
function c1Confirm() {
  const st = c1Cur(); if (!st) return;
  if (st.k === 'prep') { if (st.arm) { C1.armed = true; C1.tArm = C1.t; c1Ev('arm'); sfx('good'); } c1Ev('confirm'); c1Next(); }
  else if (st.k === 'arm') { if (DR.landed) { C1.armed = true; C1.tArm = C1.t; c1Ev('arm'); sfx('good'); c1Next(); } }
  else if (st.k === 'disarm') { if (DR.landed && Math.hypot(DR.v.x, DR.v.z) < 0.3) { C1.armed = false; c1Ev('disarm'); c1Next(); } else showMsg(L2('착지 후 시동 종료', 'Land first, then shut down'), '#ffc828', 1); }
}
function c1Mode() {
  const L = ['gps', 'atti', 'manual']; C1.mode = L[(L.indexOf(C1.mode) + 1) % 3]; C1.hold = null; C1.altT = null; C1.ei.set(0, 0, 0);
  c1Ev('mode', { mode: C1.mode }); showMsg(c1ModeName(), '#c9a2ff', 1.2);
}
function c1ModeName() { return { gps: L2('GPS 모드 (위치·고도 유지)', 'GPS mode (position + height hold)'), atti: L2('자세제어 ATTI (고도 유지 · 위치 유지 없음)', 'ATTI (height hold · no position hold)'), manual: L2('수동 (고도 유지 없음)', 'Manual (no height hold)') }[C1.mode]; }
// 학습: 기동 번호로 바로 이동 (1~9)
function c1Jump(i, again) {
  i = clamp(i | 0, 0, C1.M.length - 1); if (!C1.M[i]) return;
  const fresh = c1Build(C1.side)[i]; fresh.label = fresh.name; fresh.done = false; fresh.miss = false; fresh.why = []; fresh.steps.forEach(s => s.T = s.T || c1R('hoverT')); C1.M[i] = fresh;
  for (let j = i; j < C1.M.length; j++) { C1.M[j].done = false; C1.M[j].miss = false; }
  C1.mi = i; C1.si = 0; MS.idx = i; C1.ref = C1.ref || 4; C1.hold = null; C1.altT = null; C1.ei.set(0, 0, 0); C1.touch = null; C1.crash = null;
  const ref = C1.ref, sb = C1.side < 0 ? C1PT.B : C1PT.D, f = C1.side < 0 ? C1PT.FB : C1PT.FD;
  const air = (uv, r) => ({ p: c1W(uv[0], uv[1], ref + (r || 0) + c1p('skidDrop')), gnd: false });
  const pose = [{ p: c1W(0, 15, c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }, air(C1PT.A), air(C1PT.A), air(C1PT.A), air(C1PT.H), air(C1PT.H), { p: c1W(f[0], f[1], c1p('skidDrop')), gnd: true }, { p: c1W(0, 15, c1p('skidDrop')), gnd: true }, air(C1PT.H)][i] || air(C1PT.H);
  resetDrone(pose.p, 0); DR.landed = pose.gnd; C1.az = 0; C1.yr = 0;
  C1.armed = i > 0 && !pose.gnd; if (i === 0) { C1.ref = null; C1.tArm = null; }
  if (i === 6) C1.mode = 'atti'; else if (i !== 7) C1.mode = 'gps';
  c1Ev('jump', { to: C1.M[i].id, again: !!again }); renderList();
  const st = c1Cur(); if (st) { st.t0 = C1.t; st.wait = true; }
  if (!again) showMsg(C1.M[i].name, '#c9a2ff', 1.2);
}

// ---- 화면 ----
function c1Panel(show) {
  let el = $('c1p');
  if (!el) {
    const css = document.createElement('style');
    css.textContent = `#c1p{position:fixed;left:10px;top:112px;width:290px;max-height:calc(100vh - 230px);overflow:auto;z-index:6;background:rgba(10,14,20,.78);border:1px solid rgba(201,162,255,.5);border-radius:10px;color:#e8eef3;font:13px/1.35 system-ui,sans-serif;padding:8px 10px;pointer-events:auto}
#c1p.hidden{display:none}#c1p .t{font-weight:700;color:#c9a2ff;font-size:12px;letter-spacing:.04em}#c1p .m{font-size:15px;font-weight:700;margin-top:2px}#c1p .s{color:#ffc828;margin:2px 0 4px}
#c1p .r{display:grid;grid-template-columns:auto 1fr;gap:1px 8px;font-variant-numeric:tabular-nums}#c1p .r b{font-weight:600;color:#9fb0bd}#c1p .bad{color:#ff7a5a}#c1p .ok{color:#5dff9a}
#c1p .bt{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}#c1p .bt button{flex:1 1 auto;min-width:56px;padding:6px 4px;border-radius:6px;border:1px solid #4a5560;background:#1d252d;color:#e8eef3;font-size:12px}
#c1p canvas{width:100%;height:auto;max-height:150px;object-fit:contain;margin-top:6px;border-radius:6px;background:#1b2a1a}#c1p .note{color:#8f9aa3;font-size:11px;margin-top:4px}
body.c1on #tbBoost,body.c1on #tbDrop,body.c1on #tbPhoto,body.c1on #tbGuide,body.c1on #tbBelly,body.c1on #tbIR{display:none!important}
@media (max-width:700px),(max-height:500px){#c1p{width:230px;font-size:11px;top:86px;left:6px;padding:6px 8px;max-height:calc(100vh - 96px)}#c1p canvas,#c1p .note{display:none}#c1p .m{font-size:13px}#c1p .bt button{padding:8px 4px}}`;
    document.head.appendChild(css);
    el = document.createElement('div'); el.id = 'c1p'; el.className = 'hidden';
    el.innerHTML = `<div class="t" id="c1T"></div><div class="m" id="c1Mn"></div><div class="s" id="c1St"></div>
<div class="bt"><button id="c1Ok">✓ Enter</button><button id="c1Md">${L2('모드 Y', 'MODE Y')}</button><button id="c1Em">${L2('비상 E', 'EMER E')}</button><button id="c1Vw">${L2('시점 C', 'VIEW C')}</button></div><div class="r" id="c1R"></div>
<canvas id="c1Map" width="260" height="200"></canvas><div class="note" id="c1Note"></div>`;
    document.body.appendChild(el);
    const tap = (id, k) => { const b = $(id); b.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); c1Key(k); }; };
    tap('c1Ok', 'Enter'); tap('c1Md', 'KeyY'); tap('c1Em', 'KeyE'); tap('c1Vw', 'KeyC');
  }
  el.classList.toggle('hidden', !show);
}
let _c1ui = 0;
function c1Tick(dt) {
  if (!isC1() || !C1G) return;
  if (C1.sock) { const w = c1Wind(c1W(-16, 10, 4)); const sp = Math.hypot(w.x, w.z); C1.sock.rotation.set(0, 0, 0); C1.sock.lookAt(C1.sock.position.clone().add(new V3(w.x || 0.001, -Math.max(0, 3 - sp) * 0.6, w.z))); C1.sock.rotateX(Math.PI / 2); }
  const run = S.state === 'run' || S.state === 'pause';
  const st = run ? c1Cur() : null, aids = !C1.exam && run && st;
  C1.aidBox.visible = C1.aidLine.visible = C1.aidArrow.visible = false;
  if (aids) {
    const ref = C1.ref || 4;
    if (st.k === 'hold' || st.k === 'xfer') {
      const at = st.at || st.to, h0 = st.altWin ? ref + st.altWin[0] : ref + (st.r || 0) - c1R('altTol'), h1 = st.altWin ? ref + st.altWin[1] : ref + (st.r || 0) + c1R('altTol');
      C1.aidBox.visible = true; C1.aidBox.scale.set(c1R('posTol'), Math.max(0.05, h1 - h0), st.alongTol ? st.alongTol : c1R('posTol'));
      C1.aidBox.position.copy(c1W(at[0], at[1], (h0 + h1) / 2 + c1p('skidDrop')));
      C1.aidArrow.visible = st.hdg != null; if (st.hdg != null) { const hd = st.hdg * DEG; C1.aidArrow.position.copy(c1W(at[0] + Math.sin(hd) * 1.6, at[1] + Math.cos(hd) * 1.6, h1 + c1p('skidDrop') + 0.2)); C1.aidArrow.rotation.set(-Math.PI / 2, 0, -hd); }
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
  $('c1T').textContent = (C1.exam ? L2('1종 모의평가', 'CLASS 1 · MOCK') : L2('1종 학습', 'CLASS 1 · LEARN')) + ' · ' + { gps: 'GPS', atti: 'ATTI', manual: 'MANUAL' }[C1.mode] + (C1.armed ? ' · ARMED' : ' · SAFE') + (C1.ref ? ` · ${L2('기준', 'REF')} ${C1.ref.toFixed(1)} m` : '');
  $('c1Mn').textContent = m ? `${C1.mi + 1}. ${m.name}` : '';
  $('c1St').textContent = st ? st.lab : '';
  const e = st && st.err, f = (x, d) => (x >= 0 ? '+' : '') + x.toFixed(d || 1), cls = (x, t) => Math.abs(x) <= t ? 'ok' : 'bad';
  let r = `<b>${L2('스키드 높이', 'Skid h')}</b><span>${M.alt.toFixed(2)} m</span><b>${L2('기수', 'Heading')}</b><span>${c1Wrap(M.hdg).toFixed(0)}°</span>`;
  if (!C1.exam && e) {
    if (e.lat != null) r += `<b>${L2('위치 오차', 'Pos err')}</b><span class="${cls(e.lat, c1R('posTol'))}">${f(e.lat, 2)} m</span>`;
    if (e.alt != null && st.k !== 'land' && st.k !== 'emg') r += `<b>${L2('고도 오차', 'Height err')}</b><span class="${cls(e.alt, c1R('altTol'))}">${f(e.alt, 2)} m</span>`;
    if (e.hdg != null) r += `<b>${L2('기수 오차', 'Hdg err')}</b><span class="${cls(e.hdg, st.k === 'emg' ? 45 : 15)}">${f(e.hdg, 0)}°</span>`;
    if (st.k === 'hold') r += `<b>${L2('정지', 'Hold')}</b><span class="${st.armedEval && st.t >= st.T ? 'ok' : ''}">${st.armedEval ? st.t.toFixed(1) : '–'} / ${st.T} s</span>`;
  }
  if (!C1.exam && m && m.fail) r += `<b>${L2('판정', 'Verdict')}</b><span class="bad">U · ${m.why.map(w => c1WhyTxt(w.why)).filter((x, i, a) => a.indexOf(x) === i).join(', ')}</span>`;
  $('c1R').innerHTML = r;
  $('c1Note').textContent = L2('1종 실기시험 기준 참고 연습용 · 공식 시험·교육시간 인정 여부 미확인 · 기체 계수는 가정값', 'Reference practice for the class-1 practical test · not an official test or training hours · aircraft values assumed') + (C1.exam ? '' : L2(' · 숫자 1~9 = 기동 바로가기 · N = 다음 단계', ' · keys 1–9 jump to a manoeuvre · N = next step'));
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
function c1Camera(dt, subj) {
  if (!C1 || !isC1() || S.state === 'menu') return false;
  if (C1.view === 'chase' && !C1.exam) {
    const fw = new V3(Math.sin(subj.h), 0, -Math.cos(subj.h)), want = subj.p.clone().addScaledVector(fw, -7).add(new V3(0, 3, 0)); want.y = Math.max(want.y, C1S.y + 0.8);
    camPos.lerp(want, 1 - Math.exp(-dt * 5)); camera.position.copy(camPos); camLook.lerp(subj.p, 1 - Math.exp(-dt * 9)); camera.lookAt(camLook); camera.fov = 60; camera.near = 0.05; return true;
  }
  camera.position.copy(c1W(0, 0, c1p('eye')));
  camLook.lerp(subj.p, 1 - Math.exp(-dt * 7)); if (camLook.distanceTo(subj.p) > 30) camLook.copy(subj.p);
  camera.up.set(0, 1, 0); camera.lookAt(camLook);
  const d = camera.position.distanceTo(subj.p), want = clamp(2 * Math.atan(6 / Math.max(d, 1)) / DEG, 24, 62);
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
    rows.push([L2('안전거리 14 m · 안전라인', 'Safety radius 14 m · line'), C1.safeBad ? `<b style="color:#ff7a5a">${L2('침범 기록 있음', 'Infringed')}</b>` : L2('침범 기록 없음', 'No infringement logged')]);
    rows.push([L2('비행 시간', 'Flight time'), fmt(S.t)], [L2('비상 강하 기준 속도', 'Emergency descent reference'), C1.refDesc ? C1.refDesc.toFixed(2) + ' m/s (' + L2('삼각 하강 평균', 'triangle descent mean') + ')' : c1R('emgRefDefault') + ' m/s (' + L2('앱 기본값', 'app default') + ')']);
    ui.resTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    const sc = $('resScore'); if (sc) sc.innerHTML = `<div style="color:#c9a2ff;font-size:13px;margin:6px 0">${L2('앱 모의판정 (규칙 ', 'App mock verdict (rules ')}${C1RULES.ver}) · ${L2('공식 시험 합격·자격 판정이 아닙니다', 'not an official pass or certificate')}</div>`;
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
if (window.__sim) Object.assign(window.__sim, { C1, C1P, C1RULES, C1PT, C1EV, C1S, c1Key, c1M, c1W, c1UV, c1Jump, c1Cur, c1SkidOnPad, c1CenterOnPad, c1Wrap, c1Log, c1Build, AF, AF_IDS, MS_OK, TOUCH, isC1 });
