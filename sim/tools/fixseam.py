# 고해상도 격자 가장자리 60 m 는 원경과 섞여 있음 -> 원경을 40 m 격자로 바꿨으니 섞는 값도 새 원경으로 교체 (틈 방지)
import json, base64, sys, numpy as np
sites = json.load(open(sys.argv[1], encoding='utf-8')); S = [s for s in sites if s['id'] == 'yeongin'][0]; P = json.load(open(sys.argv[2]))
dec = lambda s: np.frombuffer(base64.b64decode(s), '<i2').astype(float) / 10
def farAt(H, n, step, fs0, fd1, down, side):
    fx = (side - fs0) / step; fy = (fd1 - down) / step
    ix = np.clip(np.floor(fx).astype(int), 0, n - 2); iy = np.clip(np.floor(fy).astype(int), 0, n - 2); ax = fx - ix; ay = fy - iy
    H = H.reshape(n, n); return (H[iy, ix] * (1 - ax) + H[iy, ix + 1] * ax) * (1 - ay) + (H[iy + 1, ix] * (1 - ax) + H[iy + 1, ix + 1] * ax) * ay
n = 241; st = 5; iy, ix = np.mgrid[0:n, 0:n]; down = 800 - iy * st; side = -600 + ix * st
old = farAt(dec(P['farH']), 201, 60, -6000, 6200, down, side); G = S['farGrid']; new = farAt(dec(S['farH']), G['farN'], G['farStep'], G['fs0'], G['fd1'], down, side)
edge = np.minimum.reduce([ix, iy, n - 1 - ix, n - 1 - iy]) * st; t = np.clip(edge / 60, 0, 1); w = t * t * (3 - 2 * t)
inn = dec(S['inH']).reshape(n, n) + (new - old) * (1 - w)
S['inH'] = base64.b64encode(np.clip(np.round(inn * 10), -32000, 32000).astype('<i2').tobytes()).decode()
json.dump(sites, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False); print('edge max change', np.abs((new - old) * (1 - w)).max().round(2))
