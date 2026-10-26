# 앱 아이콘 (자체 디자인): 어두운 바탕 · 등고선 · 위에서 본 쿼드콥터 · 호박색 링
from PIL import Image, ImageDraw
import math, sys
def icon(n, safe=1.0, bg_round=True):
    S = 4; N = n * S; im = Image.new('RGBA', (N, N), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    r = int(N * 0.22) if bg_round else 0
    d.rounded_rectangle([0, 0, N - 1, N - 1], radius=r, fill=(14, 18, 22, 255))
    c = N / 2; k = safe
    for i, rr in enumerate([0.46, 0.38, 0.30, 0.22]):   # 등고선 (지형)
        R = N * rr * k; w = max(1, int(N * 0.008))
        pts = [(c + R * (1 + 0.07 * math.sin(a * 3 + i)) * math.cos(a), c + 0.04 * N * k + R * 0.78 * (1 + 0.07 * math.cos(a * 2 + i)) * math.sin(a)) for a in [j / 120 * 2 * math.pi for j in range(121)]]
        d.line(pts, fill=(52, 92, 70, 255), width=w)
    R = N * 0.30 * k; w = int(N * 0.045 * k)   # 호박색 링 (통과 게이트)
    d.ellipse([c - R, c - R, c + R, c + R], outline=(255, 200, 40, 255), width=w)
    a = N * 0.17 * k; arm = int(N * 0.035 * k)   # 쿼드 (X 프레임 + 로터 4개)
    for sx, sy in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
        d.line([(c, c), (c + sx * a, c + sy * a)], fill=(230, 236, 240, 255), width=arm)
    pr = N * 0.075 * k
    for sx, sy in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
        x, y = c + sx * a, c + sy * a
        d.ellipse([x - pr, y - pr, x + pr, y + pr], fill=(22, 52, 62, 255), outline=(79, 227, 255, 255), width=max(1, int(N * 0.016 * k)))
    b = N * 0.05 * k; d.rounded_rectangle([c - b, c - b * 1.4, c + b, c + b * 1.4], radius=int(b * 0.5), fill=(230, 236, 240, 255))
    d.polygon([(c, c - b * 2.6), (c - b * 0.7, c - b * 1.6), (c + b * 0.7, c - b * 1.6)], fill=(255, 90, 70, 255))   # 기수 방향
    return im.resize((n, n), Image.LANCZOS)
out = sys.argv[1]
icon(192).save(out + '/icon-192.png'); icon(512).save(out + '/icon-512.png'); icon(180, bg_round=False).save(out + '/apple-touch-icon.png'); icon(32).save(out + '/favicon-32.png')
m = icon(512, safe=0.78, bg_round=False); m.save(out + '/icon-maskable-512.png')
print('ok')
