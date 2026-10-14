# 원경 격자 (주변 12 km) 를 40 m 간격으로: 합성 DEM 안쪽은 합성본, 바깥은 GLO-30
import json, math, base64, sys, numpy as np, rasterio
from scipy.ndimage import map_coordinates, gaussian_filter
from pyproj import Transformer
sites = json.load(open(sys.argv[1], encoding='utf-8')); S = [s for s in sites if s['id'] == 'yeongin'][0]
G = dict(farN=301, farStep=40, fs0=-6000, fd1=6200)
B = math.radians(S['brg']); sb, cb = math.sin(B), math.cos(B)
n = G['farN']; iy, ix = np.mgrid[0:n, 0:n]; down = G['fd1'] - iy * G['farStep']; side = G['fs0'] + ix * G['farStep']
dd = down - S['dc']; ss = side - S['sc']; E = S['e0'] + sb * dd + cb * ss; N = S['n0'] + cb * dd - sb * ss
c = rasterio.open(sys.argv[2]); Cc = c.read(1).astype(float); T = c.transform
x, y = Transformer.from_crs(S['crs'], 'EPSG:5186', always_xy=True).transform(E.ravel(), N.ravel())
col = (np.array(x) - T.c) / T.a - 0.5; row = (np.array(y) - T.f) / T.e - 0.5
inside = (col >= 0) & (row >= 0) & (col <= c.width - 1) & (row <= c.height - 1)
v1 = map_coordinates(gaussian_filter(Cc, 2.0), [row, col], order=1, mode='nearest')   # 5 m -> 40 m 격자: 살짝 흐려 계단 방지
g = rasterio.open(sys.argv[3]); Cg = g.read(1).astype(float); Cg = Cg - 6.5 * np.clip((Cg - 30) / 40, 0, 1); TG = g.transform
lo, la = Transformer.from_crs(S['crs'], 'EPSG:4326', always_xy=True).transform(E.ravel(), N.ravel())
v2 = map_coordinates(Cg, [(np.array(la) - TG.f) / TG.e - 0.5, (np.array(lo) - TG.c) / TG.a - 0.5], order=1, mode='nearest')
far = np.where(inside, v1, v2).astype(np.float32)
o = np.clip(np.round((far - S['base']) * 10), -32000, 32000).astype('<i2')
S['farH'] = base64.b64encode(o.tobytes()).decode(); S['farGrid'] = G; S['farMin'] = round(float(far.min()), 1); S['farMax'] = round(float(far.max()), 1); S['farCover'] = 100
json.dump(sites, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print('far', n, 'x', n, far.min(), far.max(), 'kb', len(S['farH']) // 1024)
