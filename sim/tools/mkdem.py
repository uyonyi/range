import ezdxf, numpy as np, rasterio, math, sys
from rasterio.transform import from_origin
from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter, distance_transform_edt
from pyproj import Transformer
doc = ezdxf.readfile('a068.dxf'); msp = doc.modelspace()
pts = []
for e in msp:
    L = e.dxf.layer
    if L in ('F0017111', 'F0017114') and e.dxftype() == 'POLYLINE':
        v = [p.dxf.location for p in e.vertices]
        for a, b in zip(v, v[1:]):
            n = max(1, int(math.hypot(b[0]-a[0], b[1]-a[1]) / 4))
            for k in range(n): t = k / n; pts.append((a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]))
        if v: pts.append(tuple(v[-1]))
    elif L == 'F0027217' and e.dxftype() == 'INSERT':
        p = e.dxf.insert; pts.append((p[0], p[1], p[2]))
P = np.array(pts); print('points', len(P), 'z', P[:,2].min(), P[:,2].max())
top = P[np.argmax(P[:,2])]; print('summit', top)
# 5 m 격자 (도엽 범위)
x0, x1 = math.floor(P[:,0].min()/5)*5, math.ceil(P[:,0].max()/5)*5
y0, y1 = math.floor(P[:,1].min()/5)*5, math.ceil(P[:,1].max()/5)*5
xs = np.arange(x0, x1+5, 5); ys = np.arange(y1, y0-5, -5)
GX, GY = np.meshgrid(xs, ys)
Z = griddata(P[:,:2], P[:,2], (GX, GY), method='linear')
m = np.isnan(Z)
Zs = gaussian_filter(np.where(m, np.nanmean(Z), Z), 1.2); Z = np.where(m, np.nan, Zs)
np.save('sheet_z.npy', Z); np.save('sheet_ax.npy', np.array([x0, y1, len(xs), len(ys)]))
print('sheet grid', Z.shape, np.nanmin(Z), np.nanmax(Z), 'nan%', m.mean())
