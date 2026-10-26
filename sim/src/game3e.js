
// =====================================================================
//  게임패드 메뉴 탐색: 메뉴·브리핑·일시정지·결과·옵션 패널에서
//  D패드/스틱 = 초점 이동 · A = 선택 · B = 뒤로 · LB/RB = 탭 전환 · 슬라이더는 좌우로 값 조절
// =====================================================================
const GPN = { el: null, t: 0, rep: 0, pA: false, pB: false, pL: false, pR: false, seen: false };
function gpnActive() { return !XR_ON && !RCUI.open && (S.state === 'menu' || S.state === 'pause' || S.state === 'result' || (S.state === 'run' && S.brief)); }
function gpnContainer() {
  for (const id of ['kbPanel', 'rcPanel', 'optPanel', 'setPanel', 'recPanel', 'helpPanel', 'ctlPanel', 'tutMenu']) { const e = $(id); if (e && !e.classList.contains('hidden')) return e; }
  if (S.state === 'pause') return ui.pause; if (S.state === 'result') return ui.result; if (S.brief) return $('brief'); return ui.menu;
}
function gpnVisible(e) { if (e.disabled || e.offsetParent === null) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }
function gpnItems() { const c = gpnContainer(); if (!c) return []; return [...c.querySelectorAll('button, input[type=range], input[type=number], select')].filter(gpnVisible); }
function gpnSet(e) { if (GPN.el && GPN.el !== e) GPN.el.classList.remove('gpf'); GPN.el = e || null; if (e) { e.classList.add('gpf'); try { e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (x) { } } }
function gpnRefresh() { const items = gpnItems(); if (!GPN.el || !items.includes(GPN.el) || !gpnVisible(GPN.el)) gpnSet(items.find(e => e.classList.contains('on') || e.classList.contains('primary')) || items[0] || null); }
function gpnMove(dx, dy) {
  const items = gpnItems(); if (!items.length) return;
  const cur = GPN.el; if (!cur || !items.includes(cur)) { gpnRefresh(); return; }
  const r0 = cur.getBoundingClientRect(), cx = (r0.left + r0.right) / 2, cy = (r0.top + r0.bottom) / 2; let best = null, bs = 1e9;
  for (const e of items) {
    if (e === cur) continue; const r = e.getBoundingClientRect();
    // 가장자리 기준 거리 (큰 타일·긴 버튼도 자연스럽게)
    const vx = dx > 0 ? r.left - r0.right : dx < 0 ? r0.left - r.right : 0, vy = dy > 0 ? r.top - r0.bottom : dy < 0 ? r0.top - r.bottom : 0;
    const along = dx ? vx : vy; if (along < -Math.max(r0.height, r0.width) * 0.3) continue;
    const ex = (r.left + r.right) / 2, ey = (r.top + r.bottom) / 2, perp = dx ? Math.abs(ey - cy) : Math.abs(ex - cx);
    const score = Math.max(0, along) + perp * (dx ? 1.6 : 2.2); if (score < bs) { bs = score; best = e; }
  }
  if (best) gpnSet(best);
}
function gpnAdjust(d) {
  const e = GPN.el; if (!e || e.tagName !== 'INPUT') return false;
  if (e.type === 'range') { const st = +e.step || 1; e.value = clamp(+e.value + d * st * (st < 1 ? 2 : 1), +e.min, +e.max); e.dispatchEvent(new Event('input', { bubbles: true })); return true; }
  if (e.type === 'number') { const st = +e.step || 1; e.value = clamp(+e.value + d * st, +e.min, +e.max); e.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  return false;
}
function gpnPress() { const e = GPN.el; if (!e) return; if (e.tagName === 'INPUT') return; sfx('good'); e.click(); setTimeout(gpnRefresh, 60); }
function gpnTab(d) {
  const c = gpnContainer(), tabs = c === ui.menu ? [...document.querySelectorAll('#msTabs button')].filter(gpnVisible) : [...c.querySelectorAll('#optTabs button')];
  if (!tabs.length) return; const on = tabs.findIndex(t => t.classList.contains('on')); tabs[((on < 0 ? 0 : on) + d + tabs.length) % tabs.length].click(); setTimeout(gpnRefresh, 60);
}
// readInput 뒤에서 매 프레임: 메뉴 상태면 패드의 메뉴용 키 입력(PadA·D패드·LB/RB)은 여기서 소비
function gpnTick(dt) {
  const gp = getPad();
  if (!gp || !gpnActive()) { if (GPN.el) gpnSet(null); GPN.pA = GPN.pB = GPN.pL = GPN.pR = false; return; }
  const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
  { const c = gpnContainer(); if (c !== GPN.c) { GPN.c = c; if (GPN.seen) gpnRefresh(); else gpnSet(null); } }   // 패널이 바뀌면 초점도 그 안으로
  for (let i = pressed.length - 1; i >= 0; i--) if (/^Pad(A|Up|Down|Left|Right|LB|RB)$/.test(pressed[i])) pressed.splice(i, 1);
  const ax = Math.abs(gp.axes[0] || 0) > Math.abs(gp.axes[2] || 0) ? gp.axes[0] || 0 : gp.axes[2] || 0, ay = Math.abs(gp.axes[1] || 0) > Math.abs(gp.axes[3] || 0) ? gp.axes[1] || 0 : gp.axes[3] || 0;
  let dx = (b(15) ? 1 : 0) - (b(14) ? 1 : 0), dy = (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
  if (!dx && !dy) { if (Math.abs(ax) > 0.6 && Math.abs(ax) >= Math.abs(ay)) dx = Math.sign(ax); else if (Math.abs(ay) > 0.6) dy = Math.sign(ay); }
  if (dx || dy) { GPN.t -= dt; if (GPN.t <= 0) { GPN.t = GPN.rep ? 0.16 : 0.4; GPN.rep++; if (!GPN.el) gpnRefresh(); else if (dx && gpnAdjust(dx)) { } else gpnMove(dx, dy); GPN.seen = true; } }
  else { GPN.t = 0; GPN.rep = 0; }
  const A = b(0), B = b(1), LB = b(4), RB = b(5);
  if (A && !GPN.pA) { if (!GPN.el) gpnRefresh(); gpnPress(); }
  if (B && !GPN.pB) pressed.push('Escape');
  if (LB && !GPN.pL) gpnTab(-1); if (RB && !GPN.pR) gpnTab(1);
  GPN.pA = A; GPN.pB = B; GPN.pL = LB; GPN.pR = RB;
  if (GPN.seen && !GPN.el) gpnRefresh();
}
