
// =====================================================================
//  가이드: 다음 과제까지 따라갈 사각 틀(3D) + 조작 안내 문구 + 아래 카메라
// =====================================================================
const GUIDE = { n: 12, sp: 2.6, meshes: [], next: null, detour: false };
(function makeFrames() {
  // 비행 경로에 수직으로 서는 사각 틀 ('하늘의 길' 방식) - FPV·추적 시점 모두에서 잘 보임
  const o = 0.55, n = 0.49, arr = [];
  const quad = (x0, y0, x1, y1) => arr.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
  quad(-o, n, o, o); quad(-o, -o, o, -n); quad(-o, -n, -n, n); quad(n, -n, o, n);
  arr.push(-0.09, o, 0, 0.09, o, 0, 0, o + 0.13, 0);
  const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  for (let i = 0; i < GUIDE.n; i++) {
    const m = new THREE.MeshBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, fog: false });
    const grp = new THREE.Group(); grp.add(new THREE.Mesh(g1, m));
    grp.renderOrder = 8; grp.visible = false; scene.add(grp); GUIDE.meshes.push({ g: grp, m });
  }
})();
function dropTargetPos(o) {
  if (o.target === 'ivan') return OBJ.ivan_grp1.world(0, 0, 0);
  if (o.target === 'mit') return OBJ.mit.world(OBJ.mit.car.position.x, 0, 0);
  return OBJ.tank.world(0, 0, 0);
}
function orbitDir(c, p) {
  if (Math.abs(S.orbSum) > 0.3) return S.orbSum < 0 ? -1 : 1;
  if (!c) return 1;
  const a = Math.atan2(p.z - c.z, p.x - c.x), tx = -Math.sin(a), tz = Math.cos(a);   // 각도가 커지는 쪽 접선
  return (Math.sin(DR.h) * tx - Math.cos(DR.h) * tz) >= 0 ? 1 : -1;                // 기체가 향한 쪽으로 돌기
}
function guidePoints(o, p) {
  GUIDE.detour = false;
  if (!o) return null;
  if (o.kind === 'ms') return o.pts(p);
  const up = (y) => new V3(0, y, 0);
  if (o.kind === 'takeoff') return [p.clone(), p.clone().add(up(2.5))];
  if (o.kind === 'custom') return o.mk ? [p.clone(), o.mk.clone()] : null;
  if (o.kind === 'land') { const c = o.b.world(0, 0, 0); return [p.clone(), c.clone().add(up(1.6)), c.clone().add(up(0.35))]; }
  if (o.kind === 'drop') { const t = dropTargetPos(o); return [p.clone(), t.clone().setY(Math.max(p.y, t.y + 5))]; }
  if (o.kind === 'orbit') {
    const c = o.b.world(0, 0, 0), R = o.R, alt = Math.max(p.y, c.y + 6), dir = orbitDir(c, p);
    const a = Math.atan2(p.z - c.z, p.x - c.x), rd = Math.hypot(p.x - c.x, p.z - c.z);
    const at = (ang) => new V3(c.x + Math.cos(ang) * R, alt, c.z + Math.sin(ang) * R);
    const pts = [p.clone()];
    if (rd > 18) pts.push(at(a));
    for (let k = 1; k <= 4; k++) pts.push(at(a + dir * 0.5 * k));
    o.mk = at(a + dir * 0.7).add(up(1.5));
    return pts;
  }
  const op = openingOf(o); if (!op) return null;
  const b = op.b, C = b.world(op.lx, op.ly, op.lz);
  if (o.kind === 'bunker' && !op.side) {
    // 정면(남쪽) 창으로 들어가기: 벙커 옆을 돌아 창 앞에서 U턴
    const l = b.local(p), dm = b.dims;
    const inside = b.world(op.lx, 0, op.lz);
    if (!insideBunker(p) && l.ly > -dm.d / 2 - 2.5) {
      GUIDE.detour = true;
      const side = l.lx >= 0 ? 1 : -1, sx = side * (dm.w / 2 + 4.5), pts = [p.clone()];
      if (l.ly > 0.5) pts.push(b.world(sx, Math.min(l.ly, 5), op.lz + 0.8));
      pts.push(b.world(sx, -dm.d / 2 - 5.5, op.lz + 0.4));
      pts.push(b.world(op.lx + side * 1.2, -dm.d / 2 - 5.0, op.lz));
      pts.push(b.world(op.lx, -dm.d / 2 - 2.5, op.lz), C, inside);
      return pts;
    }
    const lead = b.world(op.lx, -dm.d / 2 - 5, op.lz);
    return l.ly < -dm.d / 2 - 3 ? [p.clone(), lead, C, inside] : [p.clone(), C, inside];
  }
  const A = (op.side ? b.world(-1, 0, 0) : b.world(0, 1, 0)).sub(b.world(0, 0, 0)).normalize();
  const along = (o.kind === 'pass' && b.pass && b.pass.kind === 'tunnel') ? b.pass.L + 3 : 3;
  const lead = C.clone().addScaledVector(A, -5), exit = C.clone().addScaledVector(A, along);
  const before = p.clone().sub(C).dot(A);
  return before < -3 ? [p.clone(), lead, C, exit] : [p.clone(), C, exit];
}
const _gt = new V3(), _gq = new V3();
function hideGuide() { GUIDE.meshes.forEach(x => x.g.visible = false); $('guide').classList.add('hidden'); }
function updateGuide(subj) {
  const active = S.state === 'run' && DR.alive && !(S.tut && S.tut.st !== 'fly');
  const o = active ? curObj() : null;
  GUIDE.next = null;
  if (!o) { hideGuide(); return; }
  if (o.kind === 'bunker' && !S.scanned && insideBunker(subj.p)) {
    hideGuide(); if (!SET.guide) return;
    const el = $('guide'); el.classList.remove('hidden'); el.innerHTML = '<div class="ok">정찰 중 · 안에서 잠시 머무르기</div>'; return;
  }
  const pts = guidePoints(o, subj.p);
  if (!pts) { hideGuide(); return; }
  GUIDE.next = pts[1];
  if (!SET.guide) { hideGuide(); return; }
  const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
  const L = curve.getLength(), phase = (S.simT * 3.2) % GUIDE.sp;
  GUIDE.meshes.forEach((x, i) => {
    const d = 2.4 + phase + i * GUIDE.sp;
    if (d > L - 0.2 || L < 1.2) { x.g.visible = false; return; }
    const u = d / L; curve.getPointAt(u, _gt); curve.getPointAt(Math.min(1, u + 0.02), _gq);
    x.g.visible = true; x.g.position.copy(_gt); x.g.lookAt(_gq);
    const s = 0.9 + Math.min(d, 20) * 0.02; x.g.scale.set(s, s, s);
    x.m.color.set(GUIDE.detour ? 0xffc828 : o.kind === 'orbit' ? 0x5dff9a : 0x4fe3ff);
    x.m.opacity = 0.75 * Math.min(1, (d - 1.2) / 1.5) * Math.min(1, (L - d) / 2);
  });
  // ---- 조작 안내 문구 ----
  const T = IS_TOUCH ? { up: '왼쪽 스틱 ↑', down: '왼쪽 스틱 ↓', yawL: '왼쪽 스틱 ←', yawR: '왼쪽 스틱 →', fwd: '오른쪽 스틱 ↑', back: '오른쪽 스틱 ↓', left: '오른쪽 스틱 ←', right: '오른쪽 스틱 →', drop: 'DROP', boost: 'BST' } : null;
  const K = a => T ? T[a] : keyName(KB[a]);
  const tgt = (o.kind === 'orbit' || GUIDE.detour) ? pts[1] : (pts.length > 2 ? pts[pts.length - 2] : pts[1]);
  const d = tgt.clone().sub(subj.p), fwd = new V3(Math.sin(DR.h), 0, -Math.cos(DR.h)), rgt = new V3(Math.cos(DR.h), 0, Math.sin(DR.h));
  const df = d.dot(fwd), dr = d.dot(rgt), dy = d.y, hd = Math.hypot(df, dr), ang = Math.atan2(dr, df) / DEG;
  const lines = [];
  const steer = () => {
    if (Math.abs(dy) > 0.3) lines.push([`${dy > 0 ? '고도 올리기' : '고도 내리기'} ${Math.abs(dy).toFixed(1)} m (${K(dy > 0 ? 'up' : 'down')})`, '']);
    if (hd > 2.5 && Math.abs(ang) > 12) lines.push([`${ang > 0 ? '오른쪽으로 돌기' : '왼쪽으로 돌기'} (${K(ang > 0 ? 'yawR' : 'yawL')})`, '']);
    else if (hd <= 12 && Math.abs(dr) > 0.3) lines.push([`${dr > 0 ? '오른쪽으로 이동' : '왼쪽으로 이동'} ${Math.abs(dr).toFixed(1)} m (${K(dr > 0 ? 'right' : 'left')})`, '']);
  };
  if (o.kind === 'drop') {
    if (hd > 4) lines.push([`${Math.abs(ang) > 15 ? (ang > 0 ? '오른쪽으로 돌기 (' + K('yawR') + ') · ' : '왼쪽으로 돌기 (' + K('yawL') + ') · ') : ''}표적 쪽으로 전진 (${K('fwd')}) ${hd.toFixed(0)} m`, '']);
    else lines.push([`표적 위 · DROP SCOPE가 초록이 되면 투하 (${K('drop')}) · 기회는 한 번`, 'ok']);
  } else if (o.kind === 'land') {
    if (hd > 0.5) lines.push([`패드 쪽으로 이동 ${hd.toFixed(1)} m`, '']);
    else lines.push([`패드 위 · 천천히 내려가기 (${K('down')})`, 'ok']);
  } else if (o.kind === 'takeoff') lines.push([`올라가기 (${K('up')})`, '']);
  else if (o.kind === 'orbit') {
    lines.push([`탱크 주위 한 바퀴 선회 · ${Math.min(100, Math.abs(S.orbSum) / (Math.PI * 2) * 100).toFixed(0)}% · 초록 틀을 따라 계속 전진 (${K('fwd')})`, 'ok']);
    steer();
  } else {
    if (GUIDE.detour) lines.push(['벙커 옆으로 돌아 정면 창 앞에서 U턴 → 창으로 진입', 'warn']);
    if (o.kind === 'bunker' && S.scanned) lines.push(['SCAN 완료 · 창으로 나가기 (왼쪽 창 또는 들어온 창)', 'ok']);
    steer();
    if (!lines.length) lines.push([`정렬 OK · 전진 (${K('fwd')})`, 'ok']);
  }
  if (S.boosting) lines.unshift(['BOOST ▲▲', 'warn']);
  const el = $('guide'); el.classList.remove('hidden');
  el.innerHTML = lines.map(l => `<div class="${l[1]}">${l[0]}</div>`).join('');
}

// ---- 아래 카메라 (투하·선회 때 화면 한쪽에 드론 바로 아래를 보여줌) ----
const bellyCam = new THREE.PerspectiveCamera(72, 4 / 3, 0.1, 400);
// 'big' = 투하·선회 때 자동으로 크게 / 'small' = 직접 켠 경우 / null = 안 보임
function bellyMode() {
  if (S.state !== 'run' || !DR.alive || (S.tut && S.tut.st !== 'fly')) return null;
  const ov = S.bellyOv;
  if (ov && ov.val === false && ov.idx !== S.objIdx) S.bellyOv = null;          // 끈 것은 다음 과제에서 다시 자동
  const o = curObj();
  const auto = SET.belly && o && ((o.kind === 'drop' && dropTargetPos(o).distanceTo(DR.p) < 45) || (o.kind === 'orbit' && o.b.world(0, 0, 0).distanceTo(DR.p) < 30) || ((o.t === 'recon' || o.t === 'fire') && Math.hypot(o.tp.x - DR.p.x, o.tp.z - DR.p.z) < 140));
  if (S.bellyOv && S.bellyOv.val === false) return null;
  if (auto) return 'big';
  if (S.bellyOv && S.bellyOv.val === true) return 'small';
  return null;
}
function bellyActive() { return bellyMode() !== null; }
function renderBelly() {
  const el = $('belly'), mode = bellyMode(), on = mode !== null;
  el.classList.toggle('hidden', !on); el.classList.toggle('big', mode === 'big'); ui.hud.classList.toggle('bellyon', on); ui.hud.classList.toggle('bellybig', mode === 'big');
  if (!on) return;
  // PC: 평소엔 왼쪽(드론·과제 목록과 안 겹침). 튜토리얼 중엔 왼쪽에 설명창이 있으니 과제 목록 아래로
  const alt = !IS_TOUCH && !!S.tut; el.classList.toggle('alt', alt);
  if (alt) {
    const lr = $('list').getBoundingClientRect(), mr = $('map').getBoundingClientRect();
    const top = (lr.height > 10 ? lr.bottom : 14) + 10, h = Math.max(120, (mr.height > 10 ? mr.top : innerHeight) - 10 - top);
    el.style.top = top + 'px'; el.style.width = Math.min(430, Math.round(h * 4 / 3)) + 'px';
  } else {
    el.style.width = '';
    if (!IS_TOUCH) { const ob = ui.osd.getBoundingClientRect(); el.style.top = Math.max(140, Math.round(ob.bottom + 10)) + 'px'; } else el.style.top = '';
  }
  const r = el.getBoundingClientRect(); if (r.width < 10) return;
  const fwd = new V3(Math.sin(DR.h), 0, -Math.cos(DR.h));
  bellyCam.position.copy(DR.p).add(new V3(0, -0.15, 0)); bellyCam.up.copy(fwd);
  bellyCam.lookAt(DR.p.x, DR.p.y - 10, DR.p.z); bellyCam.aspect = r.width / r.height; bellyCam.updateProjectionMatrix(); bellyCam.updateMatrixWorld();
  const vis = droneM.g.visible; droneM.g.visible = false;
  const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
  const y = innerHeight - r.bottom;
  renderer.setScissorTest(true); renderer.setScissor(r.left, y, r.width, r.height); renderer.setViewport(r.left, y, r.width, r.height);
  renderer.render(scene, bellyCam);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.shadowMap.autoUpdate = au; droneM.g.visible = vis;
}
