"""영인산 전용 코스 v2: 길을 따라 장애물을 촘촘하게 (약 13 m 간격) 한 방향으로 배치
  python3 mkcourse2.py sites.json yeongin
- 출발 패드 -> 링·게이트·슬라럼·투하·터널·이동표적·탱크·벙커 -> 결승 게이트 -> 끝 착륙 패드
- 코스 좌표(down, side)는 현장 패키지의 경로(course.path)를 따라 계산 (부대 코스 좌표를 쓰지 않음)
- course.order: 과제 순서 (game2.js buildObjectives 가 읽음)"""
import sys, json, math
import numpy as np
sites = json.load(open(sys.argv[1], encoding='utf-8')); S = [s for s in sites if s['id'] == sys.argv[2]][0]
C = S['course']; P = np.array(C['path'], float)
seg = np.hypot(*np.diff(P, axis=0).T); cum = np.concatenate([[0], np.cumsum(seg)]); L = cum[-1]
def at(t):
    t = float(np.clip(t, 0, L)); i = int(np.clip(np.searchsorted(cum, t) - 1, 0, len(P) - 2)); f = (t - cum[i]) / max(seg[i], 1e-6)
    p = P[i] * (1 - f) + P[i + 1] * f
    j0, j1 = max(0, i - 1), min(len(P) - 1, i + 2); u = P[j1] - P[j0]; u /= np.hypot(*u); return p, u
def M(t, lat):   # 경로 거리 t, 오른쪽(+side) lat m -> (down, side, 경로 방향 각도)
    p, u = at(t); n = np.array([-u[1], u[0]]); q = p + n * lat
    return round(float(q[0]), 2), round(float(q[1]), 2), math.degrees(math.atan2(u[1], u[0]))
objs, order, wp = [], [], []
def ob(id, typ, name, t, lat, yaw0=0.0, **kw):
    d, s, th = M(t, lat); o = dict(id=id, type=typ, name=name, down=d, side=s, yaw=round(yaw0 - th, 2)); o.update(kw); objs.append(o); return o
def W(t, lat, agl, v, label=''):
    d, s, _ = M(t, lat); wp.append([d, s, round(agl, 2), v, label])

# ---------- 출발 ----------
ob('barrier1', 'barrier', '방호벽 (출발선)', 4, 0, w=2.0, h=0.8, d=0.45)
ob('pad_start', 'pad', 'H 패드 (출발)', 10, -4, dia=1.2)
ob('pad_land', 'pad', 'H 패드 (예비)', 10, 4, dia=1.2)
order.append({'t': 'takeoff'})
W(10, -4, 0.17, 0); W(10, -4, 2.0, 3.5, 'TAKEOFF')
# ---------- 1구간: 게이트 ----------
def gate_sq(id, name, t, lat, elev, label, yaw0=0.0):
    ob(id, 'gate_sq', name, t, lat, yaw0, w=1.22, h=1.22, elev=elev); order.append({'t': 'pass', 'id': id, 'label': label})
    a = elev + 0.61; W(t - 5, lat, a, 8); W(t, lat, a, 8, label); W(t + 4, lat, a, 8)
def ring(id, name, t, lat, alt, label):
    ob(id, 'ring', name, t, lat, dia=1.22, alt=alt); order.append({'t': 'pass', 'id': id, 'label': label})
    W(t - 5, lat, alt, 8); W(t, lat, alt, 8, label); W(t + 4, lat, alt, 8)
def gate_tri(id, name, t, lat, elev, label):
    ob(id, 'gate_tri', name, t, lat, w=2.11, h=1.83, elev=elev); order.append({'t': 'pass', 'id': id, 'label': label})
    a = elev + 0.6; W(t - 5, lat, a, 7); W(t, lat, a, 7, label); W(t + 4, lat, a, 7)
W(18, -1, 2.75, 7)
ring('ring_a', '링 1', 26, 0, 2.75, 'RING 1')
gate_sq('gate_sq1', '사각 게이트 1', 40, -2.5, 2.05, 'WINDOW GATE 1')
gate_tri('gate_tri1', '삼각 게이트 1', 54, 2.5, 3.2, 'TRIANGLE GATE 1')
gate_sq('gate_sq2', '사각 게이트 2', 68, -2.0, 1.4, 'WINDOW GATE 2')
ring('ring_b', '링 2 (높음)', 82, 1.5, 5.2, 'RING 2 · HIGH')
# ---------- 2구간: 슬라럼 6개 (6 m 간격, 두 줄 엇갈림) ----------
W(92, 0, 2.1, 7)
for k in range(6):
    t, lat = 100 + k * 6.5, (-1.3 if k % 2 == 0 else 1.3)
    ob(f'pole{k + 1}', 'pole', f'흑황 기둥 {k + 1}', t, lat, w=0.4, h=4.5, height=7.0)
    sg = 1 if k % 2 == 0 else -1     # 기둥 오른쪽(+)/왼쪽(-) 으로 지나감
    order.append({'t': 'slalom', 'id': f'pole{k + 1}', 'sg': sg, 'label': f"SLALOM {k + 1}/6 · {'RIGHT' if sg > 0 else 'LEFT'} SIDE"})
    W(t, lat + sg * 0.95, 2.1, 6, 'SLALOM' if k == 0 else '')
gate_tri('gate_tri2', '삼각 게이트 2', 148, -1.5, 2.2, 'TRIANGLE GATE 2')
# ---------- 3구간: 투하 · 터널 ----------
ob('ivan_grp1', 'ivan_group', '표적 3개 (투하)', 166, 3.5, w=0.9, h=1.7, elev=0.75, count=3, spacing=2.2)
ob('panel1', 'panel', '경계 표지', 168, -9, w=0.9, h=3.4, elev=1.1)
order.append({'t': 'drop', 'target': 'ivan', 'label': 'DROP 1 · IVAN'})
W(158, 2, 5.0, 6); W(165, 3.5, 4.5, 3, 'DROP IVAN'); W(171, 2, 4.0, 6)
ob('tunnel1', 'tunnel', '원통 터널', 186, -0.5, dia=1.7, elev=0.95, length=4.5); order.append({'t': 'pass', 'id': 'tunnel1', 'label': 'TUNNEL'})
W(179, -0.5, 1.8, 6); W(186, -0.5, 1.8, 6, 'TUNNEL'); W(192, -0.5, 1.8, 7)
gate_sq('gate_sq3', '사각 게이트 3 (높음)', 204, 2.0, 3.6, 'WINDOW GATE 3 · HIGH')
# ---------- 4구간: 이동 표적 · 링 ----------
ob('mit', 'mit', '이동 표적 레일', 228, 0, w=0.9, h=1.7, elev=0.45, length=16.0)
order.append({'t': 'drop', 'target': 'mit', 'label': 'DROP 2 · MIT (MOVING)', 'follow': True})
W(216, 0, 6.0, 6); W(226, 0, 5.5, 3, 'MIT TRACK'); W(230, 0, 5.5, 2, 'DROP MIT'); W(240, 0, 4.0, 7)
ring('ring_c', '링 3', 252, -1.5, 3.2, 'RING 3')
gate_sq('gate_sq4', '사각 게이트 4 (낮음)', 262, 1.5, 0.9, 'WINDOW GATE 4 · LOW')
# ---------- 5구간: 탱크 선회 · 공격 ----------
TK = 298
ob('tank', 'tank', '탱크 표적', TK, 0, -90.0, w=3.3, h=1.7, d=3.7, height=2.85, length=8.1)
order.append({'t': 'orbit', 'id': 'tank', 'R': 12, 'label': 'TANK ORBIT · 360°'})
order.append({'t': 'drop', 'target': 'tank', 'label': 'DROP 3 · TANK'})
W(TK - 18, 0, 9.0, 8)
p0, u0 = at(TK); n0 = np.array([-u0[1], u0[0]])
for k in range(9):   # 반지름 12 m 선회
    a = math.pi + k * 2 * math.pi / 8; q = p0 + (u0 * math.cos(a) + n0 * math.sin(a)) * 12
    wp.append([round(float(q[0]), 2), round(float(q[1]), 2), 9.5, 8.5, 'TANK ORBIT' if k == 0 else ''])
W(TK - 4, 0, 12, 4, 'TOP ATTACK'); W(TK, 0, 7.0, 2, 'DROP TANK'); W(TK + 10, 0, 4.0, 7)
# ---------- 6구간: 벙커 정찰 · 결승 · 착륙 ----------
ob('bunker1', 'bunker', '팔레트 벙커 (정찰)', 324, 3.5, w=3.8, h=3.1, d=3.0)
order.append({'t': 'bunker', 'id': 'bunker1', 'label': 'BUNKER RECON'})
W(316, 0, 2.6, 4); W(324, 0.2, 2.2, 1.5, 'BUNKER'); W(330, 0, 2.6, 5)
gate_sq('gate_finish', '결승 게이트', 342, 0, 1.6, 'FINISH GATE')
ob('pad_end', 'pad', 'H 패드 (착륙)', 356, 0, dia=1.2)
order.append({'t': 'land', 'id': 'pad_end', 'label': 'LAND · H-PAD'})
W(351, 0, 1.6, 4); W(356, 0, 1.0, 2, 'LANDING'); W(356, 0, 0.17, 0)
# 길 가장자리 콘 (코스 구간만)
cones = []
for t in np.arange(16, 360, 16):
    p, u = at(t); n = np.array([-u[1], u[0]])
    for sd in (-11, 11): q = p + n * sd; cones.append([round(float(q[0]), 1), round(float(q[1]), 1)])
C.update({'objs': objs, 'wp': wp, 'order': order, 'cones': cones, 'v': 2})
json.dump(sites, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print('objs', len(objs), 'steps', len(order), 'wp', len(wp), 'path L', round(L, 1))
