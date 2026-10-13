# 사용자 경로(위경도 5점)를 따라 드론 장애물만 배치한 코스 데이터 생성
import json, math, sys
import numpy as np
from pyproj import Transformer
DMS = [(36,50,40.34,126,56,48.75),(36,50,40.33,126,56,50.75),(36,50,43.07,126,56,53.76),(36,50,49.59,126,56,54.92),(36,50,56.25,126,56,55.09)]
LL = [(lo + lm/60 + ls/3600, la + m/60 + s/3600) for la, m, s, lo, lm, ls in DMS]
CRS = 'EPSG:32652'
tU = Transformer.from_crs('EPSG:4326', CRS, always_xy=True)
U = [tU.transform(*p) for p in LL]
e0, n0 = U[0]; brg = math.degrees(math.atan2(U[-1][0] - e0, U[-1][1] - n0)) % 360
B = math.radians(brg); sB, cB = math.sin(B), math.cos(B)
toDS = lambda E, N: (sB * (E - e0) + cB * (N - n0), cB * (E - e0) - sB * (N - n0))
P = np.array([toDS(*u) for u in U])          # (down, side)
# 모서리 다듬기 (Chaikin, 끝점 고정) -> 1 m 간격
Q = P.copy()
for _ in range(5):
    R = [Q[0]]
    for a, b in zip(Q[:-1], Q[1:]): R += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
    R.append(Q[-1]); Q = np.array(R)
seg = np.hypot(*np.diff(Q, axis=0).T); cum = np.concatenate([[0], np.cumsum(seg)]); L = cum[-1]
ts = np.arange(0, L, 1.0); PD = np.interp(ts, cum, Q[:, 0]); PS = np.interp(ts, cum, Q[:, 1])
def at(t):
    if t < 0:  # 앞쪽 연장
        u = np.array([PD[1] - PD[0], PS[1] - PS[0]]); u /= np.hypot(*u); return np.array([PD[0], PS[0]]) + u * t, u
    if t > ts[-1]:
        u = np.array([PD[-1] - PD[-2], PS[-1] - PS[-2]]); u /= np.hypot(*u); return np.array([PD[-1], PS[-1]]) + u * (t - ts[-1]), u
    i = min(len(ts) - 2, int(t)); f = t - i
    p = np.array([PD[i] * (1 - f) + PD[i + 1] * f, PS[i] * (1 - f) + PS[i + 1] * f])
    j0, j1 = max(0, i - 3), min(len(ts) - 1, i + 4)
    u = np.array([PD[j1] - PD[j0], PS[j1] - PS[j0]]); u /= np.hypot(*u); return p, u
# 원래 다운레인지 거리 -> 경로 거리 (묶음 안은 그대로, 사이 간격만 늘림)
END0 = 262.0; rigid = [(0, 15), (65.8, 102.6), (152.4, 158.5)]
rig_len = sum(b - a for a, b in rigid); k = ((L - 22) - rig_len) / (END0 - rig_len)
knots = [(0.0, 0.0)]; o = 0.0; m = 0.0
for a, b in rigid:
    m += (a - o) * k; knots.append((a, m)); m += b - a; knots.append((b, m)); o = b
m += (END0 - o) * k; knots.append((END0, m))
K0 = np.array([q[0] for q in knots]); K1 = np.array([q[1] for q in knots])
def T(d):
    if d <= 0: return d
    if d >= END0: return K1[-1] + (d - END0)
    return float(np.interp(d, K0, K1))
def M(d, s):
    p, u = at(T(d)); n = np.array([-u[1], u[0]])   # 오른쪽(+side) 법선: u=(1,0) -> (0,1)
    q = p + n * s
    return float(q[0]), float(q[1]), math.degrees(math.atan2(u[1], u[0]))
data = json.load(open('../sim/data.json'))
KEEP = {'pad_start', 'pad_land', 'barrier1', 'ring_a', 'gate_sq1', 'gate_tri1', 'gate_sq2', 'gate_finish', 'pole1', 'pole2', 'pole3', 'pole4', 'pole5', 'pole6',
        'bunker1', 'ivan_grp1', 'panel1', 'tunnel1', 'mit', 'tank'}
objs = []
for ob in data['objs']:
    if ob['id'] not in KEEP: continue
    o2 = dict(ob); o2['side0'] = ob['side']; o2['down0'] = ob['down']; d, s, th = M(ob['down'], ob['side'])
    o2['down'] = round(d, 2); o2['side'] = round(s, 2); o2['yaw'] = round(float(ob.get('yaw', 0)) - th, 2); objs.append(o2)
wp = []
for w in data['wp']:
    d, s, th = M(w[0], w[1]); wp.append([round(d, 2), round(s, 2)] + w[2:])
cones = []
for t in np.arange(12, L - 10, 18):
    p, u = at(t); n = np.array([-u[1], u[0]])
    for sd in (-15, 15): q = p + n * sd; cones.append([round(float(q[0]), 1), round(float(q[1]), 1)])
path = [[round(float(PD[i]), 1), round(float(PS[i]), 1)] for i in range(0, len(ts), 5)] + [[round(float(PD[-1]), 1), round(float(PS[-1]), 1)]]
lat0, lon0 = LL[0][1], LL[0][0]
print(json.dumps({'L': round(L, 1), 'k': round(k, 3), 'brg': round(brg, 2), 'lat0': lat0, 'lon0': lon0,
                  'tank': [o for o in objs if o['id'] == 'tank'][0]['down'], 'n': len(objs)}))
json.dump({'objs': objs, 'wp': wp, 'cones': cones, 'path': path, 'len': round(L, 1), 'lat0': lat0, 'lon0': lon0, 'brg': brg, 'route': [list(p) for p in LL]}, open('course_yeongin.json', 'w'), ensure_ascii=False)
