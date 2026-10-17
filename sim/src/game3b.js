
// =====================================================================
//  튜토리얼
// =====================================================================
function startFacing(idx, back, altOverride, sideOff) {
  const o = OBJS[idx], op = openingOf(o);
  const b = o.b; const lz = altOverride !== undefined ? altOverride : op.lz;
  const p = b.world(op.lx + (sideOff || 0), op.ly - back, lz), c = b.world(op.lx, op.ly, lz);
  const d = c.clone().sub(p); return { p, h: Math.atan2(d.x, -d.z), focus: b.world(op.lx, op.ly, lz) };
}
function startBeforeTarget(tw, back, alt) {
  // 경로가 있으면 경로 진행 방향 뒤쪽, 없으면 다운레인지 뒤쪽에서 시작
  const pi = pathInfo(-tw.z, tw.x), dd = pi ? pi.dir : [1, 0];
  const p = W(-tw.z - dd[0] * back, tw.x - dd[1] * back, alt);
  return { p, h: Math.atan2(dd[1], dd[0]), focus: tw.clone().setY(groundAt(tw.x, tw.z) + 1.5) };
}
const LESSONS = [
  { title: '기본 조작', sub: '이륙 · 제자리 비행 · 이동 · 착륙', custom: true,
    text: [IS_TOUCH ? '왼쪽 스틱을 위로 밀면 올라가고 아래로 내리면 내려옵니다(좌우 = 기체 회전). 오른쪽 스틱으로 앞뒤·좌우로 움직입니다.' : '올라가기 {UP} · 내려오기 {DOWN} · 앞뒤 {FWD}/{BACK} · 좌우 이동 {LEFT}/{RIGHT} · 방향 돌리기 {YAWL}/{YAWR}. 키는 메뉴의 [키 설정]에서 바꿀 수 있습니다.',
      '입문 모드에서는 스틱(키)을 놓으면 기체가 그 자리에 멈춥니다. 급하게 누르지 말고 짧게 여러 번 눌러 보세요.',
      '화면 왼쪽 아래 두 칸은 지금 스틱 위치입니다 (왼쪽 = 스로틀·회전, 오른쪽 = 전후·좌우).'],
    spec: 'H 패드 지름 1.2 m · 착륙은 패드 위에서 속도가 거의 0일 때 0.8초 유지',
    start: () => ({ p: startPos(), h: startHead(), focus: OBJ.pad_start.world(0, 0, 0.5), landed: true }),
    steps: [
      { label: '이륙: 2 m 위로', mk: () => OBJ.pad_start.world(0, 0, 2.5), test: p => agl(p) > 2.0 },
      { label: '제자리 비행 3초 (속도 0)', mk: () => null, hold: 3, test: () => DR.v.length() < 0.6 && agl(DR.p) > 1.0 },
      { label: '앞으로 15 m 이동', mk: () => OBJ.pad_start.world(0, 16, 2), test: p => OBJ.pad_start.local(p).ly > 14.5 },
      { label: '돌아와서 출발 패드에 착륙', mk: () => OBJ.pad_start.world(0, 0, 1.8), test: p => { const l = OBJ.pad_start.local(p); return Math.hypot(l.lx, l.ly) < 0.85 && DR.landed && DR.v.length() < 0.8; }, hold: 0.8 }
    ] },
  { title: '링 (Circle Obstacle)', sub: '정밀 통과', range: [1, 1],
    text: ['고정된 링 가운데를 정확히 지나가는 연습입니다. 링 테두리에 닿으면 튕기고 벌점이 붙습니다.',
      '링 높이에 먼저 고도를 맞춘 뒤, 노란 조준 테두리 안에 초록 비행 방향 표시(○—)가 들어오게 하고 천천히 전진하세요.'],
    spec: () => `안지름 1.22 m (4 ft) · 중심 높이 ${num(BY.ring_a.alt, 2.75)} m · 두 H 패드 사이`,
    start: () => startFacing(1, 12) },
  { title: '사각 게이트 (Window)', sub: '게이트 통과 · 자세 제어', range: [2, 2],
    text: ['열린 창 가운데를 통과합니다. 창이 높이 떠 있으므로 아래 받침대에 걸리지 않게 고도를 먼저 맞추세요.',
      '거리가 가까워질수록 조준 테두리가 커집니다. 초록으로 바뀐 상태를 유지하면서 지나가면 됩니다.'],
    spec: () => `열린 곳 1.22 × 1.22 m · 아랫변 높이 ${num(BY.gate_sq1.elev, 2.05)} m`,
    start: () => startFacing(2, 12) },
  { title: '삼각 게이트', sub: '높은 고도 통과', range: [3, 3],
    text: ['다른 모양, 더 높은 고도의 게이트입니다. 삼각형은 아래쪽이 넓으니 가운데보다 약간 아래를 노리면 여유가 많습니다.',
      '높이 4 m 이상으로 올라가야 합니다. 올라가는 동안에는 전진을 멈추고 고도부터 맞추세요.'],
    spec: () => `내접원 1.22 m (4 ft) · 한 변 ${num(BY.gate_tri1.w, 2.11)} m · 밑변 높이 ${num(BY.gate_tri1.elev, 4.05)} m`,
    start: () => startFacing(3, 12) },
  { title: '기둥 슬라럼', sub: '속도를 유지하며 장애물 회피', range: [5, 10],
    text: ['흑황 기둥 6개를 지그재그로 통과합니다. 화면 위 안내(LEFT SIDE / RIGHT SIDE)와 하늘색 표시 쪽으로 지나가세요.',
      '기둥은 두 줄로 어긋나 있습니다. 회전({YAWL}/{YAWR})보다 좌우 이동({LEFT}/{RIGHT})을 조금씩 쓰는 것이 안정적입니다.'],
    spec: '기둥 6개 · 높이 7.0 m · 두 줄 (2.5 m 간격) 엇갈림',
    start: () => { const s = startFacing(5, 9, 2.1); return s; } },
  { title: '투하 1 · Ivan 표적', sub: '고정 표적 공격', range: [11, 11],
    text: ['탑재물(M84 모형)을 지상 표적에 떨어뜨립니다. 왼쪽 아래 DROP SCOPE의 가운데 + 가 "예상 낙하점"입니다.',
      '드론이 움직이면 탑재물도 그 속도로 앞으로 날아갑니다. 표적이 +에 겹쳐 DROP NOW(초록)가 뜨면 {DROP}(게임패드 A/RT).',
      '튜토리얼에서는 탑재물이 다시 채워지니 여러 번 연습해 보세요.'],
    spec: 'Ivan 실루엣 3개 · 2.2 m 간격 · 판 0.9 × 1.7 m · 명중 반경 약 1.4 m',
    start: () => startBeforeTarget(OBJ.ivan_grp1.world(0, 0, 0), 28, 6) },
  { title: '투하 2 · MIT 이동 표적', sub: '움직이는 표적 추적', range: [12, 12],
    text: ['레일 위를 좌우로 움직이는 표적입니다. 조준경은 탑재물이 떨어지는 동안 표적이 이동할 위치를 미리 계산해 보여줍니다.',
      '표적을 따라가며 속도를 맞춘 뒤 투하하면 맞히기 쉽습니다. 흐린 점은 지금 표적 위치, 진한 점은 떨어질 때의 위치입니다.'],
    spec: () => `레일 ${num(BY.mit.length, 30)} m · 최대 3.5 m/s · ${BY.mit.down} m 지점`,
    start: () => startBeforeTarget(OBJ.mit.world(0, 0, 0), 26, 6) },
  { title: '투하 3 · 탱크', sub: '선회 정찰 후 탑 어택', range: [13, 14],
    text: ['먼저 탱크 주위를 반지름 약 12 m로 한 바퀴(360°) 돕니다. 바닥의 초록 원과 초록 틀을 따라 전진하면 되고, 화면 왼쪽 위에 ORBIT %가 표시됩니다.',
      '한 바퀴를 채우면 TOP ATTACK 단계로 바뀝니다. 탱크 위로 들어가 DROP SCOPE가 초록이 될 때 투하하세요. 선회 전에 떨어뜨린 탑재물은 회수됩니다.',
      '탱크는 크기가 커서 높은 곳에서 떨어뜨려도 맞습니다. 높을수록 낙하 시간이 길어져 앞으로 더 날아간다는 점만 기억하세요.'],
    spec: () => `차체 ${num(BY.tank.length, 8.1)} × ${num(BY.tank.w, 3.3)} m · 높이 ${num(BY.tank.height, 2.85)} m · ${BY.tank.down} m 지점`,
    start: () => startBeforeTarget(OBJ.tank.world(0, 0, 0), 32, 9) },
  { title: '터널', sub: '좁은 공간 통과 (복귀 중)', range: [15, 15],
    text: ['복귀하면서 대각선 방향으로 놓인 원통을 통과합니다. 입구가 비스듬하니 기체를 원통 방향에 정확히 맞춘 뒤 들어가세요.',
      '안에서는 속도를 줄이지 말고 곧게 지나가는 것이 오히려 안전합니다.'],
    spec: () => `안지름 ${num(BY.tunnel1.dia, 1.7)} m · 길이 ${num(BY.tunnel1.length, 4.5)} m · 방향 135°`,
    start: () => startFacing(15, 10) },
  { title: '벙커 정찰', sub: '건물 진입 · 내부 정찰', range: [16, 16],
    text: ['정면 위칸 창으로 들어가 안에서 1.5초 이상 정찰(SCAN)한 뒤, 왼쪽 벽의 두 번째 창으로 빠져나옵니다.',
      '복귀 중에는 벙커 뒤(북쪽)에서 다가오게 되므로, 벙커 옆으로 돌아 정면(남쪽) 창 앞에서 U턴해야 합니다. 노란 틀이 우회 경로입니다. 창 앞에서 멈춰 높이를 맞추고 천천히 들어가세요.',
      'SCAN COMPLETE가 뜨면 밖으로 나가면 됩니다. 영상처럼 왼쪽 창(하늘색)으로 나가도 되고, 들어온 창으로 다시 나와도 성공입니다.'],
    spec: () => `벙커 ${num(BY.bunker1.w, 3.8)} × ${num(BY.bunker1.d, 3.0)} × ${num(BY.bunker1.h, 3.1)} m · 창 약 1.0 × 0.8 m`,
    start: () => { const s = startFacing(16, 9); return s; } },
  { title: '결승 게이트 · 착륙', sub: '마지막 게이트와 정밀 착륙', range: [17, 18],
    text: ['출발 지점 쪽으로 돌아오며 FINISH 게이트를 통과한 뒤, 오른쪽 H 패드에 착륙합니다.',
      '착륙은 패드 위에서 속도를 거의 0으로 줄이고 내려오기({DOWN})로 천천히 내려가세요. 패드 위에 0.8초 머물면 완료됩니다.'],
    spec: () => `게이트 1.22 × 1.22 m · 아랫변 ${num(BY.gate_finish.elev, 1.6)} m · 착륙 패드 지름 1.2 m`,
    start: () => startFacing(17, 14) }
];
let TUT_DONE = {};
try { TUT_DONE = JSON.parse(localStorage.getItem('hroc_fpv_tut') || '{}'); } catch (e) { }
function tutStart(i) {
  enterFull();
  startRun('tutorial');
  S.tut = { i, st: 'intro', t: 0, step: 0, hold: 0 };
  const L = LESSONS[i]; const st = L.start();
  if (L.range) { S.objIdx = L.range[0]; S.running = true; }
  S.tut.startPose = st;
  const p = st.p.clone(); if (!st.landed) p.y = Math.max(p.y, groundAt(p.x, p.z) + 1.0);
  resetDrone(p, st.h);
  if (st.landed) DR.landed = true;
  S.respawn = { p: p.clone(), h: st.h };
  topH = st.h;
  ui.list.classList.add('hidden');
  tutRender();
  showMsg('', '#fff', 0.01);
}
function tutObj() {
  if (!S.tut) return null;
  const L = LESSONS[S.tut.i];
  if (L.custom) { const s = L.steps[S.tut.step]; if (!s) return null; return { kind: 'custom', label: s.label, mk: s.mk(), step: s }; }
  if (S.objIdx > L.range[1]) return null;
  return OBJS[S.objIdx];
}
function tutAfterObj() {
  const L = LESSONS[S.tut.i];
  if (L.range && S.objIdx > L.range[1]) tutComplete();
  tutRender();
}
function tutCustomCheck(p, dt) {
  const L = LESSONS[S.tut.i], s = L.steps[S.tut.step]; if (!s) return;
  if (s.test(p)) { S.tut.hold += dt; if (S.tut.hold >= (s.hold || 0)) { S.tut.hold = 0; S.tut.step++; sfx('good'); showMsg(s.label + ' ✓', '#5dff9a', 1.2); if (S.tut.step >= L.steps.length) tutComplete(); tutRender(); } }
  else S.tut.hold = 0;
}
function tutComplete() {
  S.tut.st = 'done';
  TUT_DONE[S.tut.i] = 1; try { localStorage.setItem('hroc_fpv_tut', JSON.stringify(TUT_DONE)); } catch (e) { }
  sfx('chime'); showMsg('LESSON COMPLETE', '#5dff9a', 2.5);
  tutRender(); renderTutMenu();
}
function tutFly() { if (S.tut && S.tut.st === 'intro') { S.tut.st = 'fly'; acc = 0; tutRender(); } }
function tutRetry() { tutStart(S.tut.i); tutFly(); }
function tutNext() { if (S.tut.i + 1 < LESSONS.length) tutStart(S.tut.i + 1); else { toMenu(); } }
function kbFill(t) {
  const T = IS_TOUCH ? { UP: '왼쪽 스틱 ↑', DOWN: '왼쪽 스틱 ↓', YAWL: '왼쪽 스틱 ←', YAWR: '→', FWD: '오른쪽 스틱 ↑', BACK: '↓', LEFT: '오른쪽 스틱 ←', RIGHT: '→', DROP: 'DROP' } : null;
  return t.replace(/\{(UP|DOWN|YAWL|YAWR|FWD|BACK|LEFT|RIGHT|DROP)\}/g, (m, k) => '<b>' + (T ? T[k] : keyName(KB[{ UP: 'up', DOWN: 'down', YAWL: 'yawL', YAWR: 'yawR', FWD: 'fwd', BACK: 'back', LEFT: 'left', RIGHT: 'right', DROP: 'drop' }[k]])) + '</b>');
}
function tutRender() {
  const el = $('tut'); if (!S.tut || S.kind !== 'tutorial') { el.classList.add('hidden'); return; }
  const L = LESSONS[S.tut.i], spec = typeof L.spec === 'function' ? L.spec() : L.spec;
  let steps = '';
  if (L.custom) steps = '<ol>' + L.steps.map((s, i) => `<li class="${i < S.tut.step ? 'done' : i === S.tut.step ? 'cur' : ''}">${s.label}</li>`).join('') + '</ol>';
  const foot = IS_TOUCH ? (S.tut.st === 'intro' ? '<div class="go">이 패널을 탭하면 비행 시작</div>' : S.tut.st === 'done' ? `<div class="go ok">완료! 이 패널을 탭 → ${S.tut.i + 1 < LESSONS.length ? '다음 단계' : '메뉴로'} · ⟲ 버튼 = 다시</div>` : '<div class="go dim">⟲ 버튼 = 처음 위치에서 다시 · ❚❚ = 일시정지</div>')
    : S.tut.st === 'intro' ? '<div class="go">준비되면 <b>Enter</b> 또는 <b>Space</b> (게임패드 <b>A</b>) — 비행 시작</div>'
    : S.tut.st === 'done' ? `<div class="go ok">완료! <b>Enter</b>(A) ${S.tut.i + 1 < LESSONS.length ? '다음 단계' : '메뉴로'} · <b>R</b>(Y) 다시</div>`
      : '<div class="go dim"><b>R</b>(Y) 처음 위치에서 다시 · <b>Esc</b> 일시정지</div>';
  el.classList.remove('hidden'); el.classList.toggle('mini', S.tut.st === 'fly');
  el.innerHTML = `<div class="k">LESSON ${S.tut.i + 1} / ${LESSONS.length}</div><h4>${L.title}</h4><div class="s">${L.sub}</div>` +
    `<div class="body">${L.text.map(t => `<p>${kbFill(t)}</p>`).join('')}<div class="spec">${spec}</div></div>${steps}${foot}`;
}
function tutCamera(dt) {
  const f = S.tut.startPose.focus; S.tut.t += dt;
  const a = S.tut.startPose.h + Math.PI + 0.9 + S.tut.t * 0.22, r = 9 + Math.min(S.tut.t, 3) * 0.6;
  camera.position.set(f.x + Math.sin(a) * r, f.y + 3.2, f.z - Math.cos(a) * r);
  camera.up.set(0, 1, 0); camera.lookAt(f); camera.fov = 55; camera.near = 0.1; camera.updateProjectionMatrix();
}
function renderTutMenu() {
  const el = $('tutList'); if (!el) return;
  el.innerHTML = LESSONS.map((L, i) => `<button data-les="${i}" class="${TUT_DONE[i] ? 'done' : ''}"><span>${i + 1}</span>${L.title}${TUT_DONE[i] ? ' ✓' : ''}</button>`).join('');
  el.querySelectorAll('[data-les]').forEach(b => b.onclick = () => { $('tutMenu').classList.add('hidden'); tutStart(+b.dataset.les); });
}

// =====================================================================
//  비행 기록 · 리플레이 · 내 최고 기록 고스트
// =====================================================================
let REC = null, LAST_REC = null;
const BEST = {};
function recStart() { REC = { s: [], ev: [], t0: 0, diff: SET.diff, kind: S.kind, acc: 0 }; }
function recTick(dt) {
  if (!REC) return; REC.acc += dt;
  if (REC.acc < 1 / 30 && REC.s.length) return; REC.acc = 0;
  const r = v => Math.round(v * 1000) / 1000;
  REC.s.push([r(S.flyT), r(DR.p.x), r(DR.p.y), r(DR.p.z), r(DR.h), r(DR.pitch), r(DR.roll), r(DR.thrust)]);
}
function recEvent(e) { if (REC && S.state === 'run') { e.t = S.flyT; REC.ev.push(e); } }
function recFinish() {
  if (!REC) return null; recTick(1);
  REC.total = S.t + S.pen; REC.course = S.t; LAST_REC = REC; const r = REC; REC = null; return r;
}
function loadBest() {
  for (const d of Object.keys(MODES)) { try { const s = localStorage.getItem('hroc_fpv_bestrec_' + d + SITE_KEY); if (s) BEST[d] = JSON.parse(s); } catch (e) { } }
}
function saveBest(r) {
  if (!r || r.kind !== 'course') return;
  const o = { s: r.s, ev: r.ev, t0: r.t0, total: r.total, diff: r.diff, kind: r.kind };
  BEST[r.diff] = o; try { localStorage.setItem('hroc_fpv_bestrec_' + r.diff + SITE_KEY, JSON.stringify(o)); } catch (e) { }
}
function recPose(rec, t, out) {
  const s = rec.s; if (!s.length) return out;
  let lo = 0, hi = s.length - 1;
  if (t <= s[0][0]) hi = 0; else if (t >= s[hi][0]) lo = hi;
  else { while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m][0] < t) lo = m; else hi = m; } }
  const a = s[lo], b = s[hi], f = hi === lo ? 0 : (t - a[0]) / Math.max(b[0] - a[0], 1e-6);
  out.p.set(lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f));
  out.h = a[4] + wrapA(b[4] - a[4]) * f; out.pitch = lerp(a[5], b[5], f); out.roll = lerp(a[6], b[6], f); out.thrust = lerp(a[7], b[7], f);
  const j = Math.min(hi + 1, s.length - 1), k = Math.max(lo - 1, 0), dtt = s[j][0] - s[k][0];
  if (dtt > 0) out.v.set((s[j][1] - s[k][1]) / dtt, (s[j][2] - s[k][2]) / dtt, (s[j][3] - s[k][3]) / dtt);
  return out;
}
function bestGhostPose(t) {
  if (SET.ghostSrc !== 'best' || !BEST[SET.diff]) return false;
  const r = BEST[SET.diff]; recPose(r, r.t0 + t, ghostS); return true;
}
// ---- 리플레이 플레이어
const RP = { rec: null, t: 0, speed: 1, playing: true, ev: 0, pose: { p: new V3(), v: new V3(), h: 0, pitch: 0, roll: 0, thrust: 0 }, back: 'menu' };
function replayStart(rec, back) {
  if (!rec || !rec.s || rec.s.length < 2) { showMsg('기록 없음', '#ff6060', 1); return; }
  RP.rec = rec; RP.t = rec.s[0][0]; RP.speed = 1; RP.playing = true; RP.ev = 0; RP.back = back || 'menu';
  PAY.forEach(p => scene.remove(p.m)); PAY.length = 0; droneM.cans.forEach(c => c.visible = true);
  S.state = 'replay'; S.kind = 'replay'; if (S.cam === 0) S.cam = 1;
  ui.menu.classList.add('hidden'); ui.result.classList.add('hidden'); ui.pause.classList.add('hidden'); ui.hud.classList.remove('hidden');
  ui.list.classList.add('hidden'); $('rp').classList.remove('hidden'); $('tut').classList.add('hidden'); ui.hud.classList.add('replaying');
  const end = rec.s[rec.s.length - 1][0]; $('rpSeek').max = end; $('rpSeek').min = rec.s[0][0];
  updateTags(); replayUI();
}
function replayEnd() { $('rp').classList.add('hidden'); ui.hud.classList.remove('replaying'); PAY.forEach(p => scene.remove(p.m)); PAY.length = 0; if (RP.back === 'result' && LAST_REC === RP.rec) { S.state = 'result'; S.kind = 'course'; ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden'); } else toMenu(); }
function replaySeek(t) {
  const s = RP.rec.s; RP.t = clamp(t, s[0][0], s[s.length - 1][0]);
  PAY.forEach(p => scene.remove(p.m)); PAY.length = 0;
  RP.ev = RP.rec.ev.findIndex(e => e.t >= RP.t); if (RP.ev < 0) RP.ev = RP.rec.ev.length;
  const dropsBefore = RP.rec.ev.filter(e => e.k === 'drop' && e.t < RP.t).length;
  droneM.cans.forEach((c, i) => c.visible = RP.rec.kind !== 'course' || i >= dropsBefore);
}
function replayTick(dt) {
  const s = RP.rec.s, end = s[s.length - 1][0];
  if (RP.playing) { RP.t += dt * RP.speed; if (RP.t >= end) { RP.t = end; RP.playing = false; } }
  recPose(RP.rec, RP.t, RP.pose);
  while (RP.ev < RP.rec.ev.length && RP.rec.ev[RP.ev].t <= RP.t) {
    const e = RP.rec.ev[RP.ev++];
    if (e.k === 'drop') dropPayload(new V3(e.p[0], e.p[1], e.p[2]), new V3(e.v[0], e.v[1], e.v[2]), 'replay');
    else if (e.k === 'msg' && e.text) showMsg(e.text, e.col, 1.2);
  }
  updatePayloads(dt * (RP.playing ? RP.speed : 0));
  replayUI(); vidTick();
}
function replayUI() {
  const s = RP.rec.s, end = s[s.length - 1][0];
  $('rpSeek').value = RP.t; $('rpTime').textContent = `${fmt(RP.t - s[0][0])} / ${fmt(end - s[0][0])}`;
  $('rpPlay').textContent = RP.playing ? '❚❚' : '▶'; $('rpSpd').textContent = '×' + RP.speed;
}
function replayKey(k) {
  if (k === 'Space' || k === 'X_Space' || k === 'Enter' || k === 'PadA') { if (RP.t >= RP.rec.s[RP.rec.s.length - 1][0]) replaySeek(RP.rec.s[0][0]); RP.playing = !RP.playing; }
  else if (k === 'ArrowLeft' || k === 'PadLB' || k === 'PadLeft') replaySeek(RP.t - 5);
  else if (k === 'ArrowRight' || k === 'PadRB' || k === 'PadRight') replaySeek(RP.t + 5);
  else if (k === 'Digit1') RP.speed = 0.5; else if (k === 'Digit2') RP.speed = 1; else if (k === 'Digit3') RP.speed = 2; else if (k === 'Digit4') RP.speed = 4;
  else if (k === 'PadUp') RP.speed = Math.min(4, RP.speed * 2); else if (k === 'PadDown') RP.speed = Math.max(0.25, RP.speed / 2);
  else if (k === 'KeyC' || k === 'KeyB2') { S.cam = (S.cam + 1) % 3; updateTags(); }
  else if (k === 'Escape') replayEnd();
  replayUI();
}
function toMenu() {
  S.state = 'menu'; S.kind = 'course'; S.tut = null; musicSetLevelPaused(false);
  ['pause', 'result'].forEach(k => ui[k].classList.add('hidden')); ui.hud.classList.add('hidden'); ui.menu.classList.remove('hidden');
  $('rp').classList.add('hidden'); $('tut').classList.add('hidden'); ui.hud.classList.remove('replaying');
  PAY.forEach(p => scene.remove(p.m)); PAY.length = 0;
  resetDrone(startPos(), startHead()); refreshBest(); if (typeof mapView === 'function') mapView('course');
  if (typeof wizGo === 'function') wizGo(3);   // 비행 끝나고 돌아오면 코스 고르기 화면
}
