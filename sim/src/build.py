"""시뮬레이터 빌드
  python3 build.py            -> 내부용 단일 HTML (KO/EN, 기본 코스 포함)
  python3 build.py public DIR -> 공개용 여러 파일 (GitHub Pages, 영인산 현장만)
  python3 build.py check DIR  -> 공개 빌드 후 배포 전 점검 (node tests/check.js)
  공개판은 node_modules/.bin/terser 가 있으면 축소본으로 나감 (npm i) · 바닥 사진은 tools/mk_ground.js 로 미리 생성
"""
import json, base64, re, sys, os, shutil
from en import EN
SIM_ROOT = os.environ.get('SIM_ROOT') or ('/home/claude/range/sim' if os.path.isdir('/home/claude/range/sim') else os.path.abspath('..'))   # 공개 사이트 폴더 (바닥 사진·정사영상 원본이 있는 곳) · CI 에서는 저장소의 sim/
PRIV = json.load(open('private.json', encoding='utf-8')) if os.path.exists('private.json') else None   # 내부용 (저장소에 올리지 않음)
FILES = ['game1.js', 'game2.js', 'game2b.js', 'game3.js', 'game3b.js', 'game3c.js', 'game3d.js', 'game3e.js', 'game4.js', 'game5.js', 'game6.js']
LATE_FILES = ['game6t.js']   # 고급 나무 모형 (lib/trees.json · trees_atlas.webp, 없으면 기존 나무 그대로)
C1_FILES = ['c1/c1_rules.js', 'c1/c1_site.js', 'c1/c1_physics.js', 'c1/c1_ui.js', 'c1/c1_voice.js', 'c1/c1_vr.js']   # 1종 실기 연습 (순서 고정 · c1/README.md)
TITLES = {
    'civil': {'TITLE': 'FPV Terrain Trainer · Civil', 'H1': 'FPV TERRAIN TRAINER',
              'H2': {'ko': '민간 비행 연습 · 무인멀티콥터 1종 실기 기준 참고 연습 (시제품 v0.6, 공식 시험 아님)', 'en': 'Civil flight practice · class-1 multicopter practical reference (prototype v0.6, not an official test)'}},
    'public': {'TITLE': 'FPV Terrain Trainer', 'H1': 'FPV TERRAIN TRAINER',
               'H2': {'ko': '실제 지형 드론 훈련 · 임무 · 1종 실기 연습 · 웹 시뮬레이터 (시제품 v0.6)', 'en': 'Real-terrain drone training · missions · class-1 practice · web simulator (prototype v0.6)'}},
}
LIBS = {'THREE': 'node_modules/three/build/three.min.js', 'GEOTIFF': 'node_modules/geotiff/dist-browser/geotiff.js', 'PROJ4': 'node_modules/proj4/dist/proj4.js'}


def sources(lang, mode, c1=None):
    if c1 is None: c1 = mode in ('private', 'civil', 'public')   # 1종 연습: 내부판·민간판·공개 PC판 (VR판 제외)
    t = open('template.html', encoding='utf-8').read()
    game = ''.join(open(f, encoding='utf-8').read() for f in FILES)
    i = game.rstrip().rfind('})();'); game = game[:i] + ''.join(open(f, encoding='utf-8').read() for f in LATE_FILES) + '\n' + game[i:]   # 전체 함수 안 끝부분 (game6 다음)
    if c1:   # 1종 연습 (전체를 감싼 함수 안쪽, 마지막 '})();' 앞에 넣음)
        i = game.rstrip().rfind('})();'); game = game[:i] + ''.join(open(f, encoding='utf-8').read() for f in C1_FILES) + '\n' + game[i:]
    if not c1:
        t = re.sub(r'<!--C1TAB-->.*?<!--/C1TAB-->', '', t, flags=re.S); t = re.sub(r'\n[^\n]*data-g="exam"[^\n]*', '', t)
    if mode == 'civil':   # 민간판: 타격·차량 추적 메뉴 없음, 투하 문구 정리
        t = re.sub(r'\n[^\n]*data-ms="(strike|track)"[^\n]*', '', t)
        game = game.replace("${n(KB.drop)} ${'투하'}", "${n(KB.drop)} ${'확인·사진'}").replace("drop: '투하', boost", "drop: 'OK', boost").replace("one('drop', '탑재물 투하')", "one('drop', '확인 · 사진 보고')")
        t = t.replace('전술 임무<small>정찰 · 구조 · 타격</small>', '응용 임무<small>정찰 · 산불 · 수색</small>').replace('<small>정찰 · 구조 · 타격</small>', '<small>정찰 · 산불 · 수색</small>').replace('숲 속 실종자 찾고 구조 키트 투하 · 복귀', '숲 속 실종자 찾아 위치 보고 · 복귀').replace('게이트 · 슬라롬 · 투하 · 착륙', '게이트 · 슬라롬 · 선회 · 착륙')
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
    T = PRIV['titles'] if mode == 'private' else TITLES[mode]
    t = t.replace('{{TITLE}}', T['TITLE']).replace('{{H1}}', T['H1']).replace('{{H2}}', T['H2'][lang])
    return t, game


def build(lang='ko', mobile=False, out='fpv_simulator_private.html', vr=False):
    t, game = sources(lang, 'private')
    lib = {k: open(v, encoding='utf-8').read().replace('</script>', '<\\/script>') for k, v in LIBS.items()}
    data = json.load(open('data.json', encoding='utf-8'))
    data['logo'] = 'data:image/jpeg;base64,' + base64.b64encode(open('logo.jpg', 'rb').read()).decode()
    import math
    F = PRIV['flat']; H = math.radians(F['H'])
    flat = {'name': '정규 훈련 코스' if lang == 'ko' else 'Standard training course', 'crs': F['crs'],
            'e0': F['SE'] + math.sin(H) * 170 + math.cos(H) * 25, 'n0': F['SN'] + math.cos(H) * 170 - math.sin(H) * 25, 'brg': F['H']}
    pre = 'window.SIM_DATA=' + json.dumps(data, ensure_ascii=False) + ';' + ('window.SIM_MOBILE=true;' if mobile else '') + "window.SIM_LANG='" + lang + "';" + ('window.SIM_VR=true;' if vr else '')
    pre += 'window.SIM_FLAT_SITE=' + json.dumps(flat, ensure_ascii=False) + ';'
    sites = json.load(open('sites.json', encoding='utf-8')) if os.path.exists('sites.json') else []
    sites = [s for s in sites if s['id'] == 'yeongin']
    for s in sites:   # 내부판: 정사영상을 파일 안에 넣어 오프라인에서도 입힘
        s = s; s['name'] = '산악 훈련장 · 영인산'; s['name_en'] = 'Mountain site · Yeonginsan'
        op = SIM_ROOT + '/sites/yeongin_ortho.tif'
        if os.path.exists(op): s['ortho'] = 'data:image/tiff;base64,' + base64.b64encode(open(op, 'rb').read()).decode()
    pre += "window.SIM_DEFAULT_SITE='flat';"
    pre += 'window.SIM_SITES=' + json.dumps(sites, ensure_ascii=False) + ';'
    o = t.replace('/*PROJ4*/', lib['PROJ4']).replace('/*THREE*/', lib['THREE']).replace('/*GEOTIFF*/', lib['GEOTIFF']).replace('/*DATA*/', pre).replace('/*GAME*/', game)
    open(out, 'w', encoding='utf-8').write(o); print(out, len(o) // 1024, 'KB')


def build_civil(lang='ko', out='civil.html'):
    """민간 일반 비행판 한 파일: 공개 현장(영인산)만 · 비공개 코스·좌표 없음 · 1종 연습 포함"""
    t, game = sources(lang, 'civil')
    lib = {k: open(v, encoding='utf-8').read().replace('</script>', '<\\/script>') for k, v in LIBS.items()}
    s = [x for x in json.load(open('sites.json', encoding='utf-8')) if x['id'] == 'yeongin'][0]
    op = SIM_ROOT + '/sites/yeongin_ortho.tif'
    if os.path.exists(op): s['ortho'] = 'data:image/tiff;base64,' + base64.b64encode(open(op, 'rb').read()).decode()
    data = {'objs': s['course']['objs'], 'wp': s['course']['wp']}
    pre = 'window.SIM_CIVIL=true;window.SIM_UNLOCKED=true;window.SIM_NOFLAT=true;window.SIM_LANG=' + json.dumps(lang) + ';window.SIM_SITES=' + json.dumps([s], ensure_ascii=False) + ';window.SIM_DATA=' + json.dumps(data, ensure_ascii=False) + ';'
    o = t.replace('/*PROJ4*/', lib['PROJ4']).replace('/*THREE*/', lib['THREE']).replace('/*GEOTIFF*/', lib['GEOTIFF']).replace('/*DATA*/', pre).replace('/*GAME*/', game)
    open(out, 'w', encoding='utf-8').write(o); print(out, len(o) // 1024, 'KB')


def build_public(outdir, site_ids=('yeongin',)):
    """공개판: 라이브러리·현장 데이터·앱을 따로 둔 여러 파일 구조"""
    os.makedirs(outdir + '/lib', exist_ok=True); os.makedirs(outdir + '/js', exist_ok=True); os.makedirs(outdir + '/sites', exist_ok=True)
    for k, v in LIBS.items(): shutil.copy(v, outdir + '/lib/' + os.path.basename(v))
    if os.path.exists('tts-worker.js'): shutil.copy('tts-worker.js', outdir + '/lib/tts-worker.js')
    for f in ('radio_voice.bin', 'radio_voice.json', 'c1_voice.bin', 'c1_voice.json', 'trees.json', 'trees_rgb.webp', 'trees_a.webp'):   # 무전 음성 조각 (Kokoro-82M, Apache-2.0 · tools/voice/)
        if os.path.exists(f): shutil.copy(f, outdir + '/lib/' + f)   # 무전 음성 대체 (GPL, 영어 음성 없는 기기에서만 불러옴)
    all_sites = {s['id']: s for s in json.load(open('sites.json', encoding='utf-8'))}
    for sid in site_ids:
        s = dict(all_sites[sid])
        for key in ('ortho', 'ground', 'groundLo'):   # 정사영상(tif, 올린 파일 대비용)·바닥 사진(webp): 같은 폴더로 복사 + 바뀌면 새로 받게 ?v=
            if not s.get(key) or s[key].startswith('data:'): continue
            import hashlib
            src = SIM_ROOT + '/' + s[key].split('?')[0]
            if os.path.exists(src):
                dst = f"{outdir}/{s[key].split('?')[0]}"
                if os.path.abspath(src) != os.path.abspath(dst): shutil.copy(src, dst)
                s[key] = s[key].split('?')[0] + '?v=' + hashlib.md5(open(src, 'rb').read()).hexdigest()[:8]
        data = {'objs': s['course']['objs'], 'wp': s['course']['wp']}
        js = '// 현장 데이터 (자동 생성: tools/)\nwindow.SIM_NOFLAT=true;\nwindow.SIM_SITES=(window.SIM_SITES||[]).concat([' + json.dumps(s, ensure_ascii=False) + ']);\n'
        js += 'window.SIM_DATA=window.SIM_DATA||' + json.dumps(data, ensure_ascii=False) + ';\n'
        open(f'{outdir}/sites/{sid}.js', 'w', encoding='utf-8').write(js)
    os.makedirs(outdir + '/icons', exist_ok=True)   # 앱 아이콘 (tools/mk_icons.py) · 설치용 manifest
    for f in os.listdir('icons'): shutil.copy('icons/' + f, outdir + '/icons/' + f)
    for lang, page, name, short, desc in (('ko', 'index.html', 'FPV 지형 훈련 시뮬레이터', 'FPV 훈련', '실제 지형 드론 훈련 · 임무 · 1종 실기 연습'), ('en', 'en.html', 'FPV Terrain Trainer', 'FPV Trainer', 'Real-terrain drone training, missions and class-1 practice')):
        man = {'name': name, 'short_name': short, 'description': desc, 'lang': lang, 'start_url': page, 'scope': './', 'id': page,
               'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'], 'orientation': 'landscape', 'background_color': '#0e1216', 'theme_color': '#0e1216',
               'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                         {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}],
               'categories': ['education', 'games']}
        json.dump(man, open(f"{outdir}/manifest{'' if lang == 'ko' else '.en'}.webmanifest", 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    pre = build_pages(outdir, site_ids, vr=False)
    os.makedirs(outdir + '/vr/js', exist_ok=True)
    pre += build_pages(outdir + '/vr', site_ids, vr=True)
    write_sw(outdir, pre)
    tot = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(outdir) for f in fs)
    print('public build ->', outdir, tot // 1024, 'KB')


def write_sw(outdir, pre):
    """서비스 워커: 핵심 파일은 설치 때 받아 두고(오프라인 실행), 음성·해석기 같은 큰 파일은 처음 쓸 때 받아 캐시. 버전(VER)이 바뀌면 옛 캐시는 지움"""
    import hashlib, glob
    core = ['lib/three.min.js', 'lib/proj4.js', 'manifest.webmanifest', 'manifest.en.webmanifest', 'icons/icon-192.png', 'icons/favicon-32.png'] + pre
    for s in glob.glob(outdir + '/sites/*.js'):   # 현장 데이터 안의 ?v= 포함 바닥 사진 주소
        txt = open(s, encoding='utf-8').read()
        core += re.findall(r'"(sites/[^"]+\.webp\?v=[0-9a-f]+)"', txt)
    core = sorted(set(core))
    ver = hashlib.md5(''.join(core).encode()).hexdigest()[:10]
    sw = """// FPV Terrain Trainer · service worker (자동 생성: src/build.py)
const VER = '%s', CACHE = 'fpvsim-' + VER, CORE = %s;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('fpvsim-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (r.mode === 'navigate') {   // 페이지: 네트워크 먼저 (새 버전 바로 반영), 안 되면 캐시
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match(u.pathname.endsWith('/') ? u.pathname + 'index.html' : r))));
    return;
  }
  // 나머지: 캐시 먼저 (?v= 로 버전이 붙어 있어 안전), 없으면 받아서 캐시 (음성 조각·GeoTIFF 해석기 등)
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok && (res.type === 'basic' || res.type === 'default')) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })));
});
""" % (ver, json.dumps(core))
    open(outdir + '/sw.js', 'w', encoding='utf-8').write(sw)
def minify_js(src, path):
    """공개판 앱 코드 축소 (terser 가 있으면: 용량 ~45% · 파싱 시간 단축). 없으면 그대로"""
    import subprocess, tempfile
    tb = os.path.join('node_modules', '.bin', 'terser')
    if not os.path.exists(tb) or os.environ.get('SIM_NOMIN'): return src
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f: f.write(src); tmp = f.name
    try:
        r = subprocess.run([tb, tmp, '-c', 'passes=1', '-m', '--comments', 'false', '--ecma', '2020'], capture_output=True, text=True, encoding='utf-8')
        if r.returncode != 0: print('terser failed, using plain source:', r.stderr[:300]); return src
        return '// built from sim/src (see src/build.py) · ' + hashlib_short(src) + '\n' + r.stdout
    finally: os.unlink(tmp)
def hashlib_short(s):
    import hashlib; return hashlib.md5(s.encode()).hexdigest()[:8]
def build_pages(outdir, site_ids, vr):
    """PC 판(outdir) 또는 VR 판(outdir/vr: 라이브러리·현장 데이터는 한 단계 위 폴더 공유)"""
    up = '../' if vr else ''
    import hashlib
    pre = []   # 서비스 워커가 미리 받아 둘 파일
    for lang, page in (('ko', 'index.html'), ('en', 'en.html')):
        t, game = sources(lang, 'public', c1=True)
        open(f'{outdir}/js/app.{lang}.js', 'w', encoding='utf-8').write(minify_js(game, f'{outdir}/js/app.{lang}.js'))
        tags = {'THREE': up + 'lib/three.min.js', 'PROJ4': up + 'lib/proj4.js'}
        for k, v in tags.items(): t = t.replace(f'<script>/*{k}*/</script>', f'<script src="{v}"></script>')
        t = t.replace('<script>/*GEOTIFF*/</script>', f"<script>window.SIM_GEOTIFF_URL='{up}lib/geotiff.js';</script>")   # 사진·DEM 파일을 올릴 때만 불러옴
        import hashlib
        ver = hashlib.md5(game.encode()).hexdigest()[:8]
        sv = {sid: hashlib.md5(open(f"{outdir if not vr else outdir[:-3]}/sites/{sid}.js", 'rb').read()).hexdigest()[:8] for sid in site_ids}   # 현장 데이터는 그 파일 내용으로 버전
        sites = ''.join(f'<script src="{up}sites/{sid}.js?v={sv[sid]}"></script>' for sid in site_ids)
        other = 'index.html' if lang == 'en' else 'en.html'
        t = t.replace('</title>', f'</title>\n<link rel="manifest" href="{up}manifest{"" if lang == "ko" else ".en"}.webmanifest"><link rel="icon" type="image/png" sizes="32x32" href="{up}icons/favicon-32.png"><link rel="apple-touch-icon" href="{up}icons/apple-touch-icon.png"><meta name="theme-color" content="#0e1216"><meta name="apple-mobile-web-app-title" content="FPV Trainer">', 1)
        t = t.replace('</title>', '</title>\n<script>try{var L=localStorage.getItem("fpvsim_lang");if(L&&L!=="%s")location.replace("%s")}catch(e){}</script>' % (lang, other), 1)
        tv = hashlib.md5(b''.join(open(f, 'rb').read() for f in ('trees.json', 'trees_rgb.webp', 'trees_a.webp') if os.path.exists(f))).hexdigest()[:8]   # 나무 모형 버전 (캐시 갱신용)
        flags = ("window.SIM_VR=true;window.SIM_BASE='../';" if vr else "window.SIM_VR_URL='vr/';") + f"window.SIM_TREES_V='{tv}';"
        if vr: t = t.replace('<title>FPV Terrain Trainer</title>', '<title>FPV Terrain Trainer VR</title>')
        t = t.replace('<script>/*DATA*/</script>', sites + f"<script>window.SIM_LANG='{lang}';{flags}</script>")
        t = t.replace('<script>/*GAME*/</script>', f'<script src="js/app.{lang}.js?v={ver}"></script>')
        t = t.replace('</body>', f"<script>if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))addEventListener('load',()=>navigator.serviceWorker.register('{up}sw.js').catch(()=>{{}}));</script>\n</body>")   # 오프라인·재방문 캐시 (sw.js)
        open(f'{outdir}/{page}', 'w', encoding='utf-8').write(t)
        pre += [f'{"vr/" if vr else ""}{page}', f'{"vr/" if vr else ""}js/app.{lang}.js?v={ver}'] + ([f'sites/{sid}.js?v={sv[sid]}' for sid in site_ids] if not vr else [])
    return pre


def build_dual(mobile=False, out='fpv_simulator_private.html', vr=False, civil=False):
    """내부용 한 파일에 한국어·영어 둘 다 (첫 화면 오른쪽 위에서 바꿈, 브라우저에 기억)"""
    pages = {}
    for lang in ('ko', 'en'):
        if civil: build_civil(lang, '_tmp_' + lang + '.html')
        else: build(lang, mobile, '_tmp_' + lang + '.html', vr)
        h = open('_tmp_' + lang + '.html', encoding='utf-8').read(); os.remove('_tmp_' + lang + '.html')
        pages[lang] = h
    def split(h):
        head = h[:h.index('<body>')]
        body = h[h.index('<body>') + 6:h.index('<script>', h.index('<body>'))]
        title = re.search(r'<title>(.*?)</title>', h).group(1)
        scripts = re.findall(r'<script>(.*?)</script>', h[h.index('<body>'):], flags=re.S)
        return head, body, title, scripts
    hk, bk, tk, sk = split(pages['ko']); he, be, te, se = split(pages['en'])
    # 스크립트: THREE, GEOTIFF, PROJ4, DATA(언어별), GAME(언어별)
    esc = lambda s: s.replace('</script>', '<\\/script>')
    o = hk + '<body>\n' + ''.join('<script>' + s + '</script>' for s in sk[:3])
    o += '<script>' + sk[3] + '</script>'   # 현장·코스 데이터는 한 번만 (언어별 차이는 이름·언어 값뿐)
    if vr and os.path.exists('tts-worker.js'):   # VR 한 파일판: 무전 음성 합성기를 파일 안에 (GPL 구성 요소, 영어 음성 없는 기기에서만 씀)
        o += '<script type="text/plain" id="ttsw">' + esc(open('tts-worker.js', encoding='utf-8').read()) + '</script>'
    if os.path.exists('radio_voice.bin'):   # 무전 음성 조각을 파일 안에
        import base64
        o += '<script type="text/plain" id="rvb">' + base64.b64encode(open('radio_voice.bin', 'rb').read()).decode() + '</script><script type="application/json" id="rvi">' + open('radio_voice.json').read() + '</script>'
    if os.path.exists('c1_voice.bin'):   # 1종 시험장 음성 묶음 (Mimic3 KSS 한국어 · Kokoro 영어)
        import base64
        o += '<script type="text/plain" id="c1vb">' + base64.b64encode(open('c1_voice.bin', 'rb').read()).decode() + '</script><script type="application/json" id="c1vi">' + open('c1_voice.json', encoding='utf-8').read() + '</script>'
    o += '<script type="text/plain" id="g_ko">' + esc(sk[4]) + '</script><script type="text/plain" id="g_en">' + esc(se[4]) + '</script>'
    o += '<script>window.SIM_DUAL=true;window.SIM_PAGES=' + json.dumps({'ko': {'body': bk, 'title': tk}, 'en': {'body': be, 'title': te}}, ensure_ascii=False).replace('</', '<\\/') + ';' + """
(function(){var L='ko';try{L=localStorage.getItem('fpvsim_lang')||'ko'}catch(e){}if(L!=='en')L='ko';
document.documentElement.lang=L;document.title=SIM_PAGES[L].title;document.body.insertAdjacentHTML('afterbegin',SIM_PAGES[L].body);
var run=function(id){var s=document.createElement('script');s.text=document.getElementById(id).textContent.split(String.fromCharCode(60,92,47)+'script>').join(String.fromCharCode(60,47)+'script>');document.body.appendChild(s)};
if(L==='en'){window.SIM_LANG='en';if(window.SIM_FLAT_SITE)window.SIM_FLAT_SITE.name='Standard training course';}run('g_'+L);})();</script>\n</body>\n</html>\n"""
    open(out, 'w', encoding='utf-8').write(o); print(out, len(o) // 1024, 'KB (KO+EN)')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'civil':
        build_dual(False, 'fpv_civil_class1_test.html', civil=True)
    elif len(sys.argv) > 1 and sys.argv[1] == 'public':
        build_public(sys.argv[2])
    elif len(sys.argv) > 1 and sys.argv[1] == 'check':   # 공개 빌드 + 배포 전 점검 (tests/check.js: 자동비행·VR 경로·모바일·씬 예산)
        build_public(sys.argv[2])
        import subprocess; r = subprocess.run(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tests', 'check.js'), sys.argv[2]])
        sys.exit(r.returncode)
    else:
        build('ko', False, 'fpv_simulator_private_KO.html')
        build('en', False, 'fpv_simulator_private_EN.html')
        build_dual(False, 'fpv_simulator_private.html')
