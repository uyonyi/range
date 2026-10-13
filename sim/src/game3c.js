
// =====================================================================
//  터치 조작 (휴대폰·태블릿): 가상 스틱 2개 + 버튼
// =====================================================================
if (IS_TOUCH) { document.body.classList.add('touch'); TOUCH.on = true; }
if (window.SIM_MOBILE) document.body.classList.add('mobile');
(function touchUI() {
  if (!IS_TOUCH) return;
  const R = 62;
  function stick(zoneId, kx, ky) {
    const zone = $(zoneId), base = zone.querySelector('.base'), knob = zone.querySelector('.knob');
    let id = null, ox = 0, oy = 0;
    const set = (x, y) => { TOUCH[kx] = x; TOUCH[ky] = y; };
    zone.addEventListener('pointerdown', e => {
      if (id !== null) return; id = e.pointerId; zone.setPointerCapture(id); initAudio(); musicStart();
      const r = zone.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top;
      base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
      e.preventDefault();
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      const r = zone.getBoundingClientRect(); let dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy;
      const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const sx = dx / R, sy = -dy / R, dz = 0.1;
      const f = v => Math.abs(v) < dz ? 0 : Math.sign(v) * Math.pow((Math.abs(v) - dz) / (1 - dz), 1.4);
      set(f(sx), f(sy)); e.preventDefault();
    });
    const end = e => { if (e.pointerId !== id) return; id = null; set(0, 0); base.classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  }
  stick('tzL', 'yaw', 'thr'); stick('tzR', 'roll', 'pitch');
  const tap = (id, key) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); musicStart(); pressed.push(key); b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 140); }); };
  tap('tbDrop', 'Space'); tap('tbCam', 'KeyC'); tap('tbReset', 'KeyR'); tap('tbPause', 'Escape'); tap('tbAssist', 'KeyH'); tap('tbZoom', 'KeyZ'); tap('tbGuide', 'KeyV'); tap('tbBelly', 'KeyX'); tap('tbIR', 'KeyT');
  const bst = $('tbBoost'); bst.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); boostToggle(); });   // 한 번 누르면 켜짐, 다시 누르면 꺼짐
  $('tbFull').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleFull(); });
  $('tut').addEventListener('pointerdown', () => { if (S.tut && S.tut.st !== 'fly') pressed.push('Enter'); });
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  // 세로 화면 안내: 전체화면 전환 중 잠깐 세로로 잡히는 크기 변화는 무시 (0.6초 넘게 세로일 때만)
  let rotT = 0; const rot = () => { clearTimeout(rotT); const portrait = innerHeight > innerWidth * 1.05; if (!portrait) { $('rot').classList.add('hidden'); return; } rotT = setTimeout(() => $('rot').classList.toggle('hidden', !(innerHeight > innerWidth * 1.05)), 600); };
  addEventListener('resize', rot); addEventListener('orientationchange', () => setTimeout(rot, 200)); rot();
})();

// 시작할 때 자동 전체화면 (브라우저 규칙상 클릭·터치·키 입력이 있어야 전환됨)
function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
let fullAsk = 0;
function enterFull() { if (!SET.autoFull || isFull() || /[?&]test/.test(location.search) || performance.now() - fullAsk < 1500) return; fullAsk = performance.now(); toggleFull(); }
// 메뉴를 고르는 중에는 전체화면으로 바꾸지 않음 (화면 크기가 바뀌며 메뉴가 흔들림) — 비행을 시작할 때만 전환
function toggleFull() {
  const d = document.documentElement, fe = document.fullscreenElement || document.webkitFullscreenElement;
  try {
    if (fe) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const f = d.requestFullscreen || d.webkitRequestFullscreen; const p = f && f.call(d);
    if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => { });
  } catch (e) { }
}
$('bFull').onclick = toggleFull;
