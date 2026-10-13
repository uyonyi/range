import numpy as np, rasterio, math
from rasterio.transform import from_origin
from scipy.ndimage import distance_transform_edt, map_coordinates
from pyproj import Transformer
Z = np.load('sheet_z.npy'); x0, y1, nx, ny = np.load('sheet_ax.npy')
cx, cy = 195340.0, 472000.0; R = 7000; st = 5.0
X0, Y1 = cx - R, cy + R; N = int(2 * R / st) + 1
xs = X0 + np.arange(N) * st; ys = Y1 - np.arange(N) * st
d90 = rasterio.open('../dem.img'); A = d90.read(1).astype(np.float64); A[A == -9999] = np.nan
t = Transformer.from_crs('EPSG:5186', 'EPSG:5179', always_xy=True)
out = np.empty((N, N), np.float32); sheet = np.full((N, N), np.nan, np.float32)
T = d90.transform
for r0 in range(0, N, 256):
    r1 = min(N, r0 + 256)
    GX, GY = np.meshgrid(xs, ys[r0:r1])
    ex, ey = t.transform(GX.ravel(), GY.ravel())
    col = (np.array(ex) - T.c) / T.a - 0.5; row = (np.array(ey) - T.f) / T.e - 0.5
    out[r0:r1] = map_coordinates(np.nan_to_num(A, nan=0), [row, col], order=1, mode='nearest').reshape(GX.shape)
    # 도엽 5 m DEM
    sc = (GX - x0) / 5; sr = (y1 - GY) / 5
    ok = (sc >= 0) & (sr >= 0) & (sc <= nx - 1) & (sr <= ny - 1)
    v = map_coordinates(np.nan_to_num(Z, nan=-9999), [sr.ravel(), sc.ravel()], order=1, mode='constant', cval=-9999).reshape(GX.shape)
    v[~ok] = np.nan; v[v < -100] = np.nan
    sheet[r0:r1] = v
m = ~np.isnan(sheet)
bias = np.nanmean(sheet[m] - out[m]); print('mean diff sheet-90m', bias, 'std', np.nanstd(sheet[m] - out[m]))
out = out + 0  # 90 m 는 그대로, 경계에서 섞음
dist = distance_transform_edt(m) * st
w = np.clip(dist / 150.0, 0, 1); w = w * w * (3 - 2 * w)
comp = np.where(m, sheet * w + out * (1 - w), out).astype(np.float32)
prof = dict(driver='GTiff', width=N, height=N, count=1, dtype='float32', crs='EPSG:5186', transform=from_origin(X0 - st / 2, Y1 + st / 2, st, st), nodata=-9999, compress='deflate', predictor=3, tiled=True)
with rasterio.open('../yeongin_dem5m_5186.tif', 'w', **prof) as o: o.write(comp, 1)
print('written', N, comp.min(), comp.max())
