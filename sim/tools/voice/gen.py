"""무전 음성 묶음 만들기 (Kokoro-82M, Apache-2.0) -> radio_voice.bin + radio_voice.json
python3 gen.py phrases.json <kokoro dir> <outdir>"""
import sys, json, re, os, subprocess, numpy as np, soundfile as sf, io
from kokoro_onnx import Kokoro
D = json.load(open(sys.argv[1])); KD = sys.argv[2]; OUT = sys.argv[3]
k = Kokoro(f"{KD}/kokoro-v1.0.int8.onnx", f"{KD}/voices-v1.0.bin")
U = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(); T = 'twenty thirty forty fifty sixty seventy eighty ninety'.split()
def numw(n): return U[n] if n < 20 else T[n // 10 - 2] + ('' if n % 10 == 0 else ' ' + U[n % 10]) if n < 100 else str(n)
def norm(t): return ' '.join(re.findall(r"[a-z']+", re.sub(r'\d+', lambda m: ' ' + numw(int(m.group())) + ' ', t.lower())))
def say(t): return re.sub(r'\bMIT\b', 'M.I.T.', re.sub(r'\bID\b', 'I.D.', t))
cache = f'{OUT}/cache'; os.makedirs(cache, exist_ok=True)
items = [(p, 1.05, 'am_michael', '') for p in D['phrases']] + [(w, 1.0, 'am_michael', '') for w in D['words']] + [(p, 1.08, 'am_fenrir', 'op|') for p in D.get('op', [])]
idx, blob = {}, bytearray()
for n, (t, sp, voice, pre) in enumerate(items):
    key = pre + norm(t)
    if not norm(t) or key in idx: continue
    fn = f"{cache}/{abs(hash((t, sp) if voice == 'am_michael' else (t, sp, voice))) % 10**12}.mp3"
    if not os.path.exists(fn):
        a, sr = k.create(say(t), voice=voice, speed=sp, lang='en-us')
        e = np.abs(a); th = max(0.01, e.max() * 0.04); nz = np.where(e > th)[0]
        if len(nz): a = a[max(0, nz[0] - int(0.03 * sr)): nz[-1] + int(0.06 * sr)]
        buf = io.BytesIO(); sf.write(buf, a, sr, format='WAV'); 
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'wav', '-i', '-', '-ar', '16000', '-ac', '1', '-b:a', '24k', fn], input=buf.getvalue(), check=True)
    b = open(fn, 'rb').read(); idx[key] = [len(blob), len(b)]; blob += b
    if n % 25 == 0: print(n, len(items), key[:50], flush=True)
open(f'{OUT}/radio_voice.bin', 'wb').write(blob); json.dump(idx, open(f'{OUT}/radio_voice.json', 'w'), separators=(',', ':'))
print('done', len(idx), len(blob))
