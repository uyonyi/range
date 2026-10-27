#!/usr/bin/env python3
"""배경음악용 실제 악기 녹음 묶음 만들기 → src/music.mp3 + src/music.json

원본: Versilian Studios 의 무료 악기 녹음 (둘 다 CC0 · 출처 표기 의무 없음)
  - VSCO 2 Community Edition  https://github.com/sgossner/VSCO-2-CE
  - VCSL (Versilian Community Sample Library)  https://github.com/sgossner/VCSL

하는 일
  1. 악기마다 필요한 음 몇 개만 골라 raw.githubusercontent.com 에서 받음 (캐시: MUSIC_CACHE, 기본 /tmp/music_cache)
  2. 파일 이름의 음 이름은 옥타브 표기가 악기마다 달라서, 실제 음높이를 재서(YIN) 옥타브를 맞춤
  3. 앞 무음 자르기 · 길이 자르기 · 끝 페이드 · 크기 맞춤 → 한 줄로 이어 붙여 MP3 한 개 (모노 80 kbps)
  4. 각 조각의 시작·길이·음높이를 music.json 에 적음 (맨 앞 짧은 '동기 신호'로 브라우저 디코더 지연을 잼)

사용: cd sim/src && python3 tools/music/mk_music.py      (ffmpeg · numpy 필요)
"""
import os, re, json, hashlib, subprocess, urllib.parse, urllib.request
import numpy as np

SR = 44100
CACHE = os.environ.get('MUSIC_CACHE', '/tmp/music_cache')
REPO = {'vsco': 'https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/', 'vcsl': 'https://raw.githubusercontent.com/sgossner/VCSL/master/'}
NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}

# 악기: 키 → (저장소, 폴더, 파일 고르기 정규식, 실제 음역 [낮은 MIDI, 높은 MIDI], 개수, 자를 길이(초))
#   음역이 None 이면 음높이 없는 타악기 (files 에 쓴 파일을 그대로)
PITCHED = {
    # 현악 (길게: 패드·선율)
    'vlnL': ('vsco', 'Strings/Violin Section/susVib', r'_v1\.wav$', (55, 86), 6, 3.0),
    'vlaL': ('vsco', 'Strings/Viola Section/susvib', r'_v1_1\.wav$', (48, 76), 5, 3.0),
    'celL': ('vsco', 'Strings/Cello Section/susvib', r'_v1_1\.wav$', (36, 65), 6, 3.0),
    'vlnT': ('vsco', 'Strings/Violin Section/Trem', r'_v1\.wav$', (55, 83), 4, 2.6),
    # 현악 (짧게: 스피카토 오스티나토 · 피치카토)
    'vlnS': ('vsco', 'Strings/Violin Section/Spic', r'_v2_rr1\.wav$', (55, 86), 6, 0.55),
    'celS': ('vsco', 'Strings/Cello Section/spic', r'_v2_RR1\.wav$', (36, 62), 5, 0.6),
    'cbP':  ('vsco', 'Strings/Solo Contrabass/Pizz', r'_v1_rr1\.wav$', (28, 52), 4, 1.2),
    'vlnP': ('vsco', 'Strings/Violin Section/Pizz', r'_v2_rr1\.wav$', (55, 86), 5, 0.9),
    # 금관
    'hrnL': ('vsco', 'Brass/F Horn/sus', r'_v[12]_1\.wav$', (41, 77), 5, 2.6),
    'hrnS': ('vsco', 'Brass/F Horn/stac', r'_v2_rr1\.wav$', (41, 77), 5, 0.7),
    'tbnS': ('vsco', 'Brass/Tenor Trombone/stac', r'_v3_rr1\.wav$', (40, 64), 3, 0.7),
    # 목관
    'flL':  ('vsco', 'Woodwinds/Flute/susvib', r'_v1_1\.wav$', (60, 96), 4, 2.4),
    'clL':  ('vsco', 'Woodwinds/Clarinet/susLong', r'_v2_rr1_sum\.wav$', (50, 82), 4, 2.4),
    # 건반·하프·말렛
    'harp': ('vsco', 'Strings/Harp', r'_mf\.wav$', (40, 96), 6, 2.4),
    'pno':  ('vcsl', 'Chordophones/Zithers/Grand Piano, Steinway B/NoSus', r'_vl3_rr1\.wav$', (36, 96), 8, 3.0),
    'mar':  ('vsco', 'Percussion/Marimba', r'\.wav$', (48, 96), 5, 1.2),
    'glk':  ('vsco', 'Percussion/Glock', r'\.wav$', (79, 103), 3, 1.5),
    'vib':  ('vcsl', 'Idiophones/Struck Idiophones/Vibraphone/Soft Mallets', r'_v2_rr1_Main\.wav$', (53, 89), 4, 2.6),
}
# 타악기: 키 → [(저장소, 경로, 자를 길이), ...]  (여러 개면 번갈아 침)
PERC = {
    'timp':  [('vsco', 'Percussion/Timpani/Timpani2_Hit_v4_rr1_Sum.wav', 1.8), ('vsco', 'Percussion/Timpani/Timpani4_Hit_v4_rr1_Sum.wav', 1.8)],
    'timpR': [('vsco', 'Percussion/Timpani/Rolls/Timpani3_Roll_v3_rr1_Sum.wav', 2.6)],
    'bd':    [('vcsl', 'Membranophones/Struck Membranophones/Bass Drum 1/BDrumNew_hit_v5_rr1_Sum.wav', 1.1), ('vcsl', 'Membranophones/Struck Membranophones/Bass Drum 1/BDrumNew_hit_v7_rr1_Sum.wav', 1.1)],
    'sn':    [('vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1/Snare2_HitSN_v5_rr1_Mid.wav', 0.5), ('vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1/Snare2_HitSN_v5_rr2_Mid.wav', 0.5), ('vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1/Snare2_HitSN_v9_rr1_Mid.wav', 0.5)],
    'snR':   [('vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1/Snare2_rollNS_v4_rr1_Mid.wav', 2.0)],
    'hhC':   [('vcsl', 'Idiophones/Struck Idiophones/Hi-Hat Cymbal/HiHat_HitC_v2_rr1_Mid.wav', 0.25), ('vcsl', 'Idiophones/Struck Idiophones/Hi-Hat Cymbal/HiHat_HitC_v2_rr2_Mid.wav', 0.25)],
    'hhO':   [('vcsl', 'Idiophones/Struck Idiophones/Hi-Hat Cymbal/HiHat_HitO_rr1_Mid.wav', 0.9)],
    'tamb':  [('vcsl', 'Idiophones/Struck Idiophones/Tambourine 1/Tamb1_Hit_v1_rr1_Mid.wav', 0.5)],
    'shk':   [('vcsl', 'Idiophones/Struck Idiophones/Shaker, Small/Mid_ShakerDouble_Down_rr1.wav', 0.3), ('vcsl', 'Idiophones/Struck Idiophones/Shaker, Small/Mid_ShakerDouble_Up_rr1.wav', 0.3)],
    'clap':  [('vcsl', 'Idiophones/Struck Idiophones/Claps/Clap_rr1.wav', 0.45), ('vcsl', 'Idiophones/Struck Idiophones/Claps/Clap_rr2.wav', 0.45)],
    'crash': [('vcsl', 'Idiophones/Struck Idiophones/Clash Cymbals 1/cymbal_crash1_mf1.wav', 2.6)],
    'swell': [('vcsl', 'Idiophones/Struck Idiophones/Suspended Cymbal 1/susCymb1_cresc_2s.wav', 3.0)],
    'conga': [('vcsl', 'Membranophones/Struck Membranophones/Conga/Conga_HitN_v2_rr1_Sum.wav', 0.5), ('vcsl', 'Membranophones/Struck Membranophones/Conga/Quinto_HitN_v2_rr1_Sum.wav', 0.5)],
    'tomL':  [('vcsl', 'Membranophones/Struck Membranophones/Tom 2/Mallet/TomL_HitM_v4_rr1_Mid.wav', 0.8)],
    'tomH':  [('vcsl', 'Membranophones/Struck Membranophones/Tom 1/Mallet/TomH_HitM_v4_rr1_Mid.wav', 0.8)],
}


def tree(repo):
    """저장소 파일 목록 (git 으로 이름만: 큰 파일은 안 받음)"""
    d = os.path.join(CACHE, 'git_' + repo)
    if not os.path.isdir(d):
        url = {'vsco': 'https://github.com/sgossner/VSCO-2-CE', 'vcsl': 'https://github.com/sgossner/VCSL'}[repo]
        subprocess.run(['git', 'clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', url, d], check=True, env=dict(os.environ, GIT_LFS_SKIP_SMUDGE='1'))
    return subprocess.run(['git', '-C', d, 'ls-tree', '-r', '--name-only', 'HEAD'], check=True, capture_output=True, text=True).stdout.splitlines()


def fetch(repo, path):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, hashlib.sha1((repo + path).encode()).hexdigest()[:16] + '.wav')
    if not os.path.exists(f):
        url = REPO[repo] + urllib.parse.quote(path)
        with urllib.request.urlopen(url, timeout=120) as r, open(f + '.part', 'wb') as o: o.write(r.read())
        os.rename(f + '.part', f)
    return f


def load(f, sr=SR):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def yin(x, sr):
    """음높이 (Hz) — YIN 차분 함수"""
    n = min(len(x), 4096); x = x[:n] - np.mean(x[:n]); tmax = min(n // 2, sr // 30)
    d = np.array([np.sum((x[:n - tmax] - x[t:n - tmax + t]) ** 2) for t in range(tmax)])
    cm = d.copy(); cm[1:] = d[1:] * np.arange(1, tmax) / np.maximum(np.cumsum(d[1:]), 1e-12); cm[0] = 1
    lo = sr // 2200
    for t in range(lo, tmax - 1):
        if cm[t] < 0.15 and cm[t] <= cm[t + 1]:
            a, b, c = cm[t - 1], cm[t], cm[t + 1]; p = t + (a - c) / (2 * (a - 2 * b + c) + 1e-12)
            return sr / p
    t = lo + int(np.argmin(cm[lo:])); return sr / t


def onset(x):
    pk = np.max(np.abs(x)) or 1; i = int(np.argmax(np.abs(x) > pk * 0.03)); return max(0, i - int(0.003 * SR))


def trim(x, dur, fade=None):
    x = x[onset(x):][:int(dur * SR)].copy(); n = len(x)
    fl = int((fade if fade is not None else min(0.35, dur * 0.3)) * SR); fl = min(fl, n)
    if fl > 0: x[n - fl:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fl))
    pk = np.max(np.abs(x)) or 1; return (x / pk * 0.89).astype(np.float32)


def name_midi(fn):
    m = re.search(r'(?:^|_)([A-G]#?)(-?\d)(?=[_.])', os.path.basename(fn))
    return None if not m else 12 * (int(m.group(2)) + 1) + NOTE[m.group(1)]


def main():
    out_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # sim/src
    trees = {r: tree(r) for r in REPO}
    parts, inst = [], {}
    for key, (repo, folder, rx, (lo, hi), cnt, dur) in PITCHED.items():
        cands = [p for p in trees[repo] if p.startswith(folder + '/') and '/' not in p[len(folder) + 1:] and re.search(rx, p) and name_midi(p) is not None]
        # 옥타브 표기 맞추기: 몇 개를 재서 (실제 − 이름) 을 12 단위로
        offs = []
        for p in sorted(cands, key=name_midi)[::max(1, len(cands) // 5)][:6]:
            x = load(fetch(repo, p)); o = onset(x); seg = x[o + int(0.08 * SR): o + int(0.5 * SR)]
            if len(seg) < 2048: seg = x[o: o + 4096]
            f0 = yin(seg, SR); offs.append(round((69 + 12 * np.log2(f0 / 440) - name_midi(p)) / 12) * 12)
        k = max(set(offs), key=offs.count) if offs else 0
        notes = sorted(((name_midi(p) + k, p) for p in cands), key=lambda a: a[0])
        notes = [n for n in notes if lo - 2 <= n[0] <= hi + 2] or notes
        pick = []
        for i in range(cnt):
            tgt = lo + (hi - lo) * i / max(1, cnt - 1); best = min(notes, key=lambda n: abs(n[0] - tgt))
            if best not in pick: pick.append(best)
        inst[key] = []
        for m, p in pick:
            parts.append((key, m, trim(load(fetch(repo, p)), dur), p, repo))
        print(f'{key:6s} oct{k:+d}  ' + ' '.join(str(m) for m, _ in pick))
    for key, lst in PERC.items():
        for repo, p, dur in lst:
            x = trim(load(fetch(repo, p)), dur, fade=0.12 if key == 'swell' else None); m = None
            if key in ('timp', 'timpR'):   # 팀파니는 음높이가 있음 → 화음 근음에 맞춰 조금 올리고 내림
                f0 = yin(x[int(0.04 * SR): int(0.4 * SR)], SR); m = round(69 + 12 * np.log2(f0 / 440), 2) if 35 < f0 < 260 else None
            parts.append((key, m, x, p, repo))
        print(f'{key:6s} {len(lst)} hit(s) ' + ' '.join(str(q[1]) for q in parts if q[0] == key))
    # 이어 붙이기: 0.05 s 에 동기 신호(3 ms) · 조각 사이 0.08 s
    gap = np.zeros(int(0.08 * SR), np.float32)
    sync = np.zeros(int(0.2 * SR), np.float32); t = np.arange(int(0.003 * SR)) / SR; sync[int(0.05 * SR): int(0.05 * SR) + len(t)] = 0.9 * np.sin(2 * np.pi * 2000 * t)
    chunks, pos = [sync], len(sync)
    for key, m, x, p, repo in parts:
        e = [m, round(pos / SR, 4), round(len(x) / SR, 4)]
        if key == 'swell': e.append(round(int(np.argmax(np.abs(x))) / SR, 3))   # 가장 커지는 때 (구간 첫 박에 맞춤)
        inst.setdefault(key, []).append(e); chunks += [x, gap]; pos += len(x) + len(gap)
    pcm = np.concatenate(chunks)
    tmp = os.path.join(CACHE, 'sprite.f32')
    pcm.astype(np.float32).tofile(tmp)
    mp3 = os.path.join(out_dir, 'music.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '80k', mp3], check=True)
    json.dump({'v': 1, 'sync': 0.05, 'inst': inst, 'src': 'VSCO 2 CE + VCSL (Versilian Studios, CC0)'}, open(os.path.join(out_dir, 'music.json'), 'w'), separators=(',', ':'))
    print(f'{len(parts)} samples · {len(pcm) / SR:.1f} s · {os.path.getsize(mp3) / 1e6:.2f} MB → {mp3}')


if __name__ == '__main__':
    main()
