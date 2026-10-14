# 5 m 도엽 DEM(안쪽) + Copernicus GLO-30(바깥) 합성. 기존 합성본에서 도엽 값을 되살려 90 m 대신 30 m 와 다시 섞음
import numpy as np, rasterio
from scipy.ndimage import distance_transform_edt, map_coordinates, gaussian_filter
from pyproj import Transformer
c = rasterio.open('yeongin_dem5m_5186.tif'); comp = c.read(1).astype(np.float64); T = c.transform; N = c.width
xs = T.c + (np.arange(N) + 0.5) * T.a; ys = T.f + (np.arange(N) + 0.5) * T.e
d90 = rasterio.open('dem.img'); A = d90.read(1).astype(np.float64); A[A == -9999] = np.nan; T9 = d90.transform
g = rasterio.open('../cop/glo30.tif'); C = g.read(1).astype(np.float64); TG = g.transform
C = gaussian_filter(C, 0.5)   # 30 m 격자 잡음만 살짝
# GLO-30 은 수관 위 표면(DSM): 산지(숲)는 도엽(맨땅)보다 평균 6.5 m 높음 -> 높은 곳만 그만큼 내림 (낮은 논밭·물은 그대로)
C = C - 6.5 * np.clip((C - 30) / 40, 0, 1)
t9 = Transformer.from_crs('EPSG:5186', 'EPSG:5179', always_xy=True); tg = Transformer.from_crs('EPSG:5186', 'EPSG:4326', always_xy=True)
o90 = np.empty((N, N)); ocp = np.empty((N, N))
for r0 in range(0, N, 256):
    r1 = min(N, r0 + 256); GX, GY = np.meshgrid(xs, ys[r0:r1])
    ex, ey = t9.transform(GX.ravel(), GY.ravel())
    o90[r0:r1] = map_coordinates(np.nan_to_num(A, nan=0), [(np.array(ey) - T9.f) / T9.e - 0.5, (np.array(ex) - T9.c) / T9.a - 0.5], order=1, mode='nearest').reshape(GX.shape)
    lo, la = tg.transform(GX.ravel(), GY.ravel())
    ocp[r0:r1] = map_coordinates(C, [(np.array(la) - TG.f) / TG.e - 0.5, (np.array(lo) - TG.c) / TG.a - 0.5], order=1, mode='nearest').reshape(GX.shape)
from scipy.ndimage import binary_closing, binary_fill_holes, binary_opening
m = np.abs(comp - o90) > 0.02                      # 도엽 영향 구역 (등고선이 우연히 90 m 와 같은 곳은 구멍 -> 메움)
m = binary_fill_holes(binary_closing(m, iterations=8)); m = binary_opening(m, iterations=3)
dist = distance_transform_edt(m) * 5.0; w = np.clip(dist / 150.0, 0, 1); w = w * w * (3 - 2 * w)
sheet = np.where(w > 0.05, (comp - o90 * (1 - w)) / np.maximum(w, 0.05), np.nan)
core = w > 0.99
dd = sheet[core] - ocp[core]; print('sheet - GLO30 (core): mean %.1f  median %.1f  std %.1f' % (dd.mean(), np.median(dd), dd.std()))
d2 = o90 - ocp; print('90m - GLO30 (all): mean %.1f std %.1f' % (d2.mean(), d2.std()))
new = np.where(w > 0.05, sheet * w + ocp * (1 - w), ocp).astype(np.float32)
p = c.profile; p.update(nodata=-9999)
with rasterio.open('yeongin_dem_5m_glo30_5186.tif', 'w', **p) as o: o.write(new, 1)
print('ok', new.min(), new.max(), 'sheet frac', core.mean())
