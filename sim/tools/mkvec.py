import ezdxf, json, math, sys
from pyproj import Transformer
from shapely.geometry import Polygon, LineString
pkg = json.load(open(sys.argv[1]))
t = Transformer.from_crs('EPSG:5186', pkg['crs'], always_xy=True)
B = math.radians(pkg['brg']); s, c = math.sin(B), math.cos(B)
def ds(x, y):
    E, N = t.transform(x, y); de, dn = E - pkg['e0'], N - pkg['n0']
    return pkg['dc'] + s * de + c * dn, pkg['sc'] + c * de - s * dn
IN = lambda d, sd: -420 < d < 820 and -620 < sd < 620
CRS_ = json.load(open('course_yeongin.json')) if len(sys.argv) > 2 else None
from shapely.geometry import Point
PATHL = LineString(CRS_['path']) if CRS_ else None
def corridor(d, sd):
    if PATHL is not None: return PATHL.distance(Point(d, sd)) < 24
    return -80 < d < 380 and -80 < sd < 30
doc = ezdxf.readfile('dxf/a068.dxf'); msp = doc.modelspace()
V = {'road': [], 'trail': [], 'stream': [], 'field': [], 'bld': []}
def line(e, simp=0.6):
    pts = [ds(p.dxf.location[0], p.dxf.location[1]) for p in e.vertices]
    if len(pts) < 2: return None
    ls = LineString(pts).simplify(simp)
    return [round(v, 1) for xy in ls.coords for v in xy]
skipped = 0
for e in msp:
    if e.dxftype() != 'POLYLINE': continue
    L = e.dxf.layer
    if L.startswith('A001'): k = 'road'
    elif L.startswith('A002'): k = 'trail'
    elif L.startswith('E002'): k = 'stream'
    elif L == 'D0015112': k = 'field'
    elif L.startswith('B001') or L.startswith('B002'): k = 'bld'
    else: continue
    if k == 'bld':
        pts = [ds(p.dxf.location[0], p.dxf.location[1]) for p in e.vertices]
        if len(pts) < 3: continue
        P = Polygon(pts)
        if not P.is_valid or P.area < 6: continue
        cd, cs = P.centroid.y, P.centroid.x  # pts are (down, side) -> x=down, y=side
        cd, cs = P.centroid.x, P.centroid.y
        if not IN(cd, cs): continue
        if corridor(cd, cs) or min(P.exterior.distance(Point(*x)) for x in [(0,0)]) < 0: skipped += 1; continue
        r = P.minimum_rotated_rectangle; q = list(r.exterior.coords)[:4]
        e1 = (q[1][0] - q[0][0], q[1][1] - q[0][1]); e2 = (q[2][0] - q[1][0], q[2][1] - q[1][1])
        w, l = math.hypot(*e1), math.hypot(*e2); ang = math.degrees(math.atan2(e1[1], e1[0]))
        h = 3.2 if P.area < 60 else (5.5 if P.area < 300 else 7.5)
        V['bld'].append([round(cd, 1), round(cs, 1), round(w, 1), round(l, 1), round(ang, 1), h])
    else:
        a = line(e, 1.0 if k == 'field' else 0.6)
        if a and any(IN(a[i], a[i + 1]) for i in range(0, len(a), 2)): V[k].append(a)
print({k: len(v) for k, v in V.items()}, 'skipped in corridor', skipped)
pkg['vec'] = V; pkg['vecSrc'] = '수치지형도 1:5,000 아산068 (도로·소로·하천·경지·건물)'
json.dump(pkg, open(sys.argv[1], 'w'), ensure_ascii=False)
print(len(json.dumps(V)) // 1024, 'KB')
