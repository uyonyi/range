"""정사영상에서 나무(수관) 위치·크기·색을 뽑아 현장 패키지에 넣음
  python3 mktrees.py sites.json yeongin ortho.tif
수관 = 정사영상에서 숲 마스크 안의 밝은 국소 최대점(햇빛 받는 나무 꼭대기).
정사영상 밖은 지형지물(도로·경지·건물)을 피해 절차적으로 심음."""
import sys, json, math, base64, numpy as np, rasterio
from rasterio.enums import Resampling
from scipy import ndimage as nd
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon
from shapely.prepared import prep
from shapely.ops import unary_union
sites = json.load(open(sys.argv[1], encoding='utf-8')); S = [s for s in sites if s['id'] == sys.argv[2]][0]
B = math.radians(S['brg']); sb, cb = math.sin(B), math.cos(B)
t1 = Transformer.from_crs('EPSG:5186', S['crs'], always_xy=True); t2 = Transformer.from_crs(S['crs'], 'EPSG:5186', always_xy=True)
def ds(x, y):
    E, N = t1.transform(x, y); de, dn = E - S['e0'], N - S['n0']
    return S['dc'] + sb * de + cb * dn, S['sc'] + cb * de - sb * dn
def xy(d, s):
    d -= S['dc']; s -= S['sc']; de = sb * d + cb * s; dn = cb * d - sb * s
    return t2.transform(S['e0'] + de, S['n0'] + dn)
C = S['course']
# 비워 둘 곳: 비행 경로(wp)·장애물 둘레
wp = LineString([(w[0], w[1]) for w in C['wp']]); keep = [wp.buffer(9)]
for o in C['objs']:
    r = {'pad': 9, 'tank': 16, 'bunker': 14, 'tunnel': 12}.get(o['type'], 10)
    keep.append(Point(o['down'], o['side']).buffer(r))
if C.get('path'): keep.append(LineString(C['path']).buffer(7))
for dm in S.get('dams', []):   # 사방댐 둑과 물웅덩이
    keep.append(LineString([dm['a'], dm['b']]).buffer(3)); keep.append(Polygon(dm['pool']).buffer(1.5))
CLEAR = prep(unary_union(keep))
V = S.get('vec', {}); avoid = []
for k, w in (('road', 4), ('trail', 2), ('stream', 3)):
    for a in V.get(k, []): avoid.append(LineString(list(zip(a[0::2], a[1::2]))).buffer(w))
for a in V.get('field', []):
    pts = list(zip(a[0::2], a[1::2]))
    if len(pts) > 3:
        P = Polygon(pts)
        if P.is_valid: avoid.append(P)
for b in V.get('bld', []): avoid.append(Point(b[0], b[1]).buffer(max(b[2], b[3]) * 0.7 + 3))
AVOID = prep(unary_union(avoid)) if avoid else None
rng = np.random.default_rng(7)
T = []   # down, side, h, r, R, G, B, kind(0 활엽 1 소나무 2 덤불)
# ---------- 정사영상 안 ----------
r = rasterio.open(sys.argv[3]); RES = 0.5
w, h = int(r.width * r.res[0] / RES), int(r.height * r.res[1] / RES)
a = r.read(out_shape=(3, h, w), resampling=Resampling.average).astype(np.float32)
L0, T0 = r.bounds.left, r.bounds.top
R_, G_, B_ = a; Y = 0.3 * R_ + 0.59 * G_ + 0.11 * B_
exg = 2 * G_ - R_ - B_
forest = (nd.gaussian_filter(Y, 1.5) < 66) & (exg > 6) & ~((B_ > G_ * 0.95) & (Y < 45))   # 수관은 풀밭보다 어두움, 물(푸른 어둠) 제외
forest = nd.binary_opening(forest, iterations=2); forest = nd.binary_closing(forest, iterations=3)
Ys = nd.gaussian_filter(Y, 2.2)                                     # 수관 크기 (약 1 m) 로 흐림
mx = nd.maximum_filter(Ys, size=7)                                 # 3.5 m 안의 최대점
peaks = np.argwhere((Ys >= mx - 1e-3) & forest & (Ys > nd.uniform_filter(Ys, 15) - 1))
dist = nd.distance_transform_edt(forest) * RES
# 색은 색 보정한 정사영상(있으면)에서, 수관(숲 마스크) 픽셀만 평균 -> 길·풀밭 색이 섞여 허옇게 되는 것 방지
rc = rasterio.open(sys.argv[5]) if len(sys.argv) > 5 else r
ac = rc.read(out_shape=(3, h, w), resampling=Resampling.average).astype(np.float32)
fm = forest.astype(np.float32); den = np.maximum(nd.uniform_filter(fm, 5), 1e-3)
Rs, Gs, Bs = (nd.uniform_filter(c * fm, 5) / den for c in ac)
Ro, Go = (nd.uniform_filter(c * fm, 5) / den for c in (R_, G_))
ff = nd.uniform_filter(fm, 31)                                      # 주변 15 m 숲 비율 (풀밭에 드문드문 선 나무 구분)
from scipy.spatial import cKDTree
pk = np.array(peaks, float); nnd = cKDTree(pk).query(pk, k=2)[0][:, 1] * RES if len(pk) > 1 else np.full(len(pk), 4.0)
GAIN = 1.12
inside = []
for n_, (j, i) in enumerate(peaks):
    x, y = L0 + (i + 0.5) * RES, T0 - (j + 0.5) * RES
    d, s = ds(x, y)
    if CLEAR.contains(Point(d, s)): continue
    rr, gg, bb = Rs[j, i], Gs[j, i], Bs[j, i]
    rgr = Ro[j, i] / max(Go[j, i], 1)
    nn = float(nnd[n_])
    if ff[j, i] < 0.45:                                             # 풀밭 속 외딴 나무 · 덤불: 작고 낮게
        kind = 1 if rgr < 0.6 else 0
        cr = float(np.clip(min(nn * 0.55, 0.9 + dist[j, i] * 0.5) + rng.normal(0, 0.2), 1.0, 2.6))
        hh = float(np.clip(3.5 + cr * 2.0 + rng.normal(0, 1.0), 3.5, 10))
    else:                                                           # 숲: 이웃 수관과 맞닿게 (닫힌 숲 지붕)
        kind = (3 if rng.random() < 0.7 else 1) if rgr < 0.56 else 0   # 짙은 청록 = 침엽수 (조림지는 원뿔형, 일부 소나무)
        cr = float(np.clip(nn * 0.62 + rng.normal(0, 0.15), 1.5, 3.8))
        hh = float(np.clip((13 if kind else 12) + cr * 1.2 + rng.normal(0, 1.5), 9, 19))
    T.append([d, s, hh, cr, min(255, rr * GAIN * 0.82), min(255, gg * GAIN * 1.02), min(255, bb * GAIN * 0.86), kind])   # 잎 색은 조금 더 푸르게
# 풀밭 속 작은 덤불·어린 소나무 (숲 마스크에서 빠진 작은 어두운 덩이)
small = (nd.gaussian_filter(Y, 1.0) < 62) & (exg > 4) & (ff < 0.5)
lab, nl = nd.label(small); nclump = 0
for k, sl in enumerate(nd.find_objects(lab), 1):
    if sl is None: continue
    area = (lab[sl] == k).sum() * RES * RES
    if area < 1.5 or area > 60: continue
    cy, cx = nd.center_of_mass(lab[sl] == k); j, i = int(sl[0].start + cy), int(sl[1].start + cx)
    x, y = L0 + (i + 0.5) * RES, T0 - (j + 0.5) * RES; d, s = ds(x, y)
    if CLEAR.contains(Point(d, s)): continue
    cr = float(np.clip(math.sqrt(area / math.pi) * 1.05, 0.8, 3.0)); big = area > 12
    rr, gg, bb = (float(c[j, i]) for c in ac)
    T.append([d, s, float(np.clip((4.5 if big else 1.6) + cr * (1.6 if big else 0.6) + rng.normal(0, 0.6), 1.2, 9)), cr, rr * 1.05, gg * 1.05, bb * 1.05, 1 if big else 2]); nclump += 1
print('clumps', nclump)
nin = len(T)
# ---------- 정사영상 밖 (절차적) ----------
obox = Polygon([ds(x, y) for x, y in [(r.bounds.left, r.bounds.bottom), (r.bounds.right, r.bounds.bottom), (r.bounds.right, r.bounds.top), (r.bounds.left, r.bounds.top)]])
OB = prep(obox.buffer(-1)); PATH = LineString(C['path'])
PAL = [(46, 68, 40, 1), (54, 78, 46, 1), (66, 86, 54, 0), (76, 94, 60, 0), (60, 82, 50, 0), (86, 96, 66, 0)]
SP = 6.0
for d in np.arange(-400, 800, SP):
    for s in np.arange(-600, 600, SP):
        dd, ss = d + rng.uniform(-2.4, 2.4), s + rng.uniform(-2.4, 2.4)
        P = Point(dd, ss); pd = PATH.distance(P)
        if pd > 380 or OB.contains(P) or CLEAR.contains(P) or (AVOID and AVOID.contains(P)): continue
        if rng.random() < 0.18 + pd / 900: continue                  # 멀수록 성기게 (먼 나무는 원경 색으로 대신)
        c = PAL[rng.integers(len(PAL))]; j = rng.normal(0, 8)
        cr = float(rng.uniform(2.0, 3.4)); hh = float(np.clip(11 + cr * 1.4 + rng.normal(0, 2), 7, 19))
        T.append([dd, ss, hh, cr, c[0] + j, c[1] + j, c[2] + j, (3 if rng.random() < 0.6 else 1) if c[3] else 0])
# ---------- 숲 가장자리 덤불 (비운 통로와 숲 사이) ----------
CLR = unary_union(keep); band = prep(CLR.buffer(10).difference(CLR))
bx0, by0, bx1, by1 = CLR.buffer(10).bounds; nsh = 0
for d in np.arange(bx0, bx1, 2.6):
    for s in np.arange(by0, by1, 2.6):
        dd, ss = d + rng.uniform(-1, 1), s + rng.uniform(-1, 1)
        if not band.contains(Point(dd, ss)) or (AVOID and AVOID.contains(Point(dd, ss))) or rng.random() < 0.6: continue
        x_, y_ = xy(dd, ss); pi, pj = int((x_ - L0) / RES), int((T0 - y_) / RES)
        if 0 <= pj < ff.shape[0] and 0 <= pi < ff.shape[1] and ff[pj, pi] < 0.5: continue   # 풀밭(열린 곳)에는 줄지은 덤불을 두지 않음
        c = PAL[rng.integers(2, len(PAL))]; j = rng.normal(0, 10)
        T.append([dd, ss, float(rng.uniform(1.2, 2.8)), float(rng.uniform(0.8, 1.6)), c[0] * 0.7 + j, c[1] * 0.85 + j, c[2] * 0.65 + j, 2]); nsh += 1
print('shrubs', nsh)
T = np.array(T, np.float32)
print('trees: ortho', nin, 'procedural', len(T) - nin, 'total', len(T))
i16 = np.stack([T[:, 0] * 10, T[:, 1] * 10, T[:, 2] * 10, T[:, 3] * 10], 1).round().astype('<i2')
u8 = np.clip(T[:, 4:8], 0, 255).round().astype(np.uint8)
S['trees'] = {'n': len(T), 'i16': base64.b64encode(i16.tobytes()).decode(), 'u8': base64.b64encode(u8.tobytes()).decode(),
              'src': '정사영상 수관 검출 + 바깥 절차 생성', 'src_en': 'crowns detected from orthoimage + procedural outside'}
json.dump(sites, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print('kb', (len(S['trees']['i16']) + len(S['trees']['u8'])) // 1024)
# 검증 그림: 검출 수관을 정사영상 위에 표시
from PIL import Image, ImageDraw
im = Image.fromarray(np.clip(ac.transpose(1, 2, 0) * 1.3, 0, 255).astype(np.uint8)); dr = ImageDraw.Draw(im)
for t in T[:nin]:
    x, y = xy(float(t[0]), float(t[1])); px, py = (x - L0) / RES, (T0 - y) / RES; rp = t[3] / RES
    dr.ellipse([px - rp, py - rp, px + rp, py + rp], outline=[(255, 230, 0), (255, 60, 60), (200, 200, 200), (60, 160, 255)][int(t[7])])
for line in [wp]:
    dr.line([((xy(d, s)[0] - L0) / RES, (T0 - xy(d, s)[1]) / RES) for d, s in line.coords], fill=(0, 220, 255), width=2)
im.save(sys.argv[4] if len(sys.argv) > 4 else 'trees_check.png')
