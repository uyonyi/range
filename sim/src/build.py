"""시뮬레이터 빌드
  python3 build.py            -> 내부용 단일 HTML (KO/EN, 기본 코스 포함)
  python3 build.py public DIR -> 공개용 여러 파일 (GitHub Pages, 영인산 현장만)
"""
import json, base64, re, sys, os, shutil
from en import EN
PRIV = json.load(open('private.json', encoding='utf-8')) if os.path.exists('private.json') else None   # 내부용 (저장소에 올리지 않음)
FILES = ['game1.js', 'game2.js', 'game2b.js', 'game3.js', 'game3b.js', 'game3c.js', 'game3d.js', 'game4.js', 'game5.js']
TITLES = {
    'public': {'TITLE': 'FPV Terrain Trainer', 'H1': 'FPV TERRAIN TRAINER',
               'H2': {'ko': '실제 지형 드론 장애물 코스 · 웹 시뮬레이터 (시제품 v0.5)', 'en': 'Real-terrain drone obstacle course · web simulator (prototype v0.5)'}},
}
LIBS = {'THREE': 'node_modules/three/build/three.min.js', 'GEOTIFF': 'node_modules/geotiff/dist-browser/geotiff.js', 'PROJ4': 'node_modules/proj4/dist/proj4.js'}


def sources(lang, mode):
    t = open('template.html', encoding='utf-8').read()
    game = ''.join(open(f, encoding='utf-8').read() for f in FILES)
    game = game.replace("'use strict';\n", "'use strict';\n" + open('game0t.js', encoding='utf-8').read(), 1)
    if lang == 'en':
        segs = json.load(open('ko_segs.json', encoding='utf-8'))
        miss = [s for s in segs if s not in EN]
        if miss: print('MISSING', miss); sys.exit(1)
        for k in sorted(EN, key=len, reverse=True):
            t = t.replace(k, EN[k]); game = game.replace(k, EN[k])
        t = t.replace('<html lang="ko">', '<html lang="en">')
        g2 = re.sub(r'(?<![:\\])//[^\n]*', '', game); t2 = re.sub(r'<!--.*?-->', '', t, flags=re.S)
        left = set(re.findall(r'[가-힣]+', g2 + t2))
        if left: print('LEFTOVER', list(left)[:30])
    T = PRIV['titles'] if mode == 'hroc' else TITLES[mode]
    t = t.replace('{{TITLE}}', T['TITLE']).replace('{{H1}}', T['H1']).replace('{{H2}}', T['H2'][lang])
    return t, game


def build(lang='ko', mobile=False, out='hroc_fpv_simulator.html'):
    t, game = sources(lang, 'hroc')
    lib = {k: open(v, encoding='utf-8').read().replace('</script>', '<\\/script>') for k, v in LIBS.items()}
    data = json.load(open('data.json', encoding='utf-8'))
    data['logo'] = 'data:image/jpeg;base64,' + base64.b64encode(open('logo.jpg', 'rb').read()).decode()
    import math
    F = PRIV['flat']; H = math.radians(F['H'])
    flat = {'name': '평지 · 기본 코스' if lang == 'ko' else 'Flat · default course', 'crs': F['crs'],
            'e0': F['SE'] + math.sin(H) * 170 + math.cos(H) * 25, 'n0': F['SN'] + math.cos(H) * 170 - math.sin(H) * 25, 'brg': F['H']}
    pre = 'window.SIM_DATA=' + json.dumps(data, ensure_ascii=False) + ';' + ('window.SIM_MOBILE=true;' if mobile else '') + "window.SIM_LANG='" + lang + "';"
    pre += 'window.SIM_FLAT_SITE=' + json.dumps(flat, ensure_ascii=False) + ';'
    sites = json.load(open('sites.json', encoding='utf-8')) if os.path.exists('sites.json') else []
    pre += 'window.SIM_SITES=' + json.dumps(sites, ensure_ascii=False) + ';'
    o = t.replace('/*PROJ4*/', lib['PROJ4']).replace('/*THREE*/', lib['THREE']).replace('/*GEOTIFF*/', lib['GEOTIFF']).replace('/*DATA*/', pre).replace('/*GAME*/', game)
    open(out, 'w', encoding='utf-8').write(o); print(out, len(o) // 1024, 'KB')


def build_public(outdir, site_ids=('yeongin',)):
    """공개판: 라이브러리·현장 데이터·앱을 따로 둔 여러 파일 구조"""
    os.makedirs(outdir + '/lib', exist_ok=True); os.makedirs(outdir + '/js', exist_ok=True); os.makedirs(outdir + '/sites', exist_ok=True)
    for k, v in LIBS.items(): shutil.copy(v, outdir + '/lib/' + os.path.basename(v))
    all_sites = {s['id']: s for s in json.load(open('sites.json', encoding='utf-8'))}
    for sid in site_ids:
        s = all_sites[sid]
        data = {'objs': s['course']['objs'], 'wp': s['course']['wp']}
        js = '// 현장 데이터 (자동 생성: tools/)\nwindow.SIM_NOFLAT=true;\nwindow.SIM_SITES=(window.SIM_SITES||[]).concat([' + json.dumps(s, ensure_ascii=False) + ']);\n'
        js += 'window.SIM_DATA=window.SIM_DATA||' + json.dumps(data, ensure_ascii=False) + ';\n'
        open(f'{outdir}/sites/{sid}.js', 'w', encoding='utf-8').write(js)
    for lang, page in (('ko', 'index.html'), ('en', 'en.html')):
        t, game = sources(lang, 'public')
        game = game.replace("'hroc_", "'fpvsim_").replace("open('hroc_fpv'", "open('fpvsim'")   # 저장 키 분리
        open(f'{outdir}/js/app.{lang}.js', 'w', encoding='utf-8').write(game)
        tags = {'THREE': 'lib/three.min.js', 'GEOTIFF': 'lib/geotiff.js', 'PROJ4': 'lib/proj4.js'}
        for k, v in tags.items(): t = t.replace(f'<script>/*{k}*/</script>', f'<script src="{v}"></script>')
        sites = ''.join(f'<script src="sites/{sid}.js"></script>' for sid in site_ids)
        t = t.replace('<script>/*DATA*/</script>', sites + f"<script>window.SIM_LANG='{lang}';</script>")
        t = t.replace('<script>/*GAME*/</script>', f'<script src="js/app.{lang}.js"></script>')
        open(f'{outdir}/{page}', 'w', encoding='utf-8').write(t)
    tot = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(outdir) for f in fs)
    print('public build ->', outdir, tot // 1024, 'KB')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'public':
        build_public(sys.argv[2])
    else:
        build('ko', False, 'hroc_fpv_simulator_KO.html')
        build('en', False, 'hroc_fpv_simulator_EN.html')
