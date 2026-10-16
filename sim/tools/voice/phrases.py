"""무전 음성 문장 목록 만들기: 게임 소스의 comm(...) 문자열 + 코스 과제 이름 + 숫자·음성 문자 단어
python3 phrases.py <sim dir> <labels.json> > phrases.json"""
import re, sys, json
SIM = sys.argv[1]
HANG = re.compile('[가-힣]')
def lit_pieces(expr):
    """JS 식에서 문자열 조각들 (템플릿의 ${} 사이 고정 부분 + ${} 안의 문자열도 재귀)"""
    out, i, n = [], 0, len(expr)
    while i < n:
        c = expr[i]
        if c in '\'"':
            j = i + 1; buf = ''
            while j < n and expr[j] != c:
                if expr[j] == '\\': buf += expr[j + 1]; j += 2; continue
                buf += expr[j]; j += 1
            out.append(buf); i = j + 1
        elif c == '`':
            j = i + 1; buf = ''
            while j < n and expr[j] != '`':
                if expr[j] == '\\': buf += expr[j + 1]; j += 2; continue
                if expr[j] == '$' and expr[j + 1] == '{':
                    d, k = 1, j + 2
                    while k < n and d:
                        if expr[k] == '{': d += 1
                        elif expr[k] == '}': d -= 1
                        elif expr[k] in '\'"`':   # skip nested string
                            q = expr[k]; k += 1
                            while k < n and expr[k] != q:
                                if expr[k] == '\\': k += 1
                                k += 1
                        k += 1
                    inner = expr[j + 2:k - 1]
                    if inner.strip() == 'CS': buf += 'EAGLE ONE'   # 호출 부호는 문장에 그대로
                    else: out.append(buf); buf = '\x00'; out.extend(lit_pieces(inner))
                    j = k; continue
                buf += expr[j]; j += 1
            out.append(buf); i = j + 1
        else: i += 1
    return out
def first_arg(src, k):
    d, i, start = 0, k, k
    while i < len(src):
        c = src[i]
        if c in '\'"`':
            q = c; i += 1
            while i < len(src) and src[i] != q:
                if src[i] == '\\': i += 1
                elif q == '`' and src[i] == '$' and src[i + 1] == '{':
                    dd = 1; i += 2
                    while dd:
                        if src[i] == '{': dd += 1
                        elif src[i] == '}': dd -= 1
                        i += 1
                    continue
                i += 1
        elif c in '([{': d += 1
        elif c in ')]}':
            if d == 0: return src[start:i]
            d -= 1
        elif c == ',' and d == 0: return src[start:i]
        i += 1
srcs = ''.join(open(f'{SIM}/{f}', encoding='utf-8').read() for f in ['game3.js', 'game5.js'])
exprs = []
for m in re.finditer(r'\bcomm\(', srcs):
    a = first_arg(srcs, m.end())
    if a: exprs.append(a)
# 임무 시작 무전 (commStart 의 T 표)
cs = srcs[srcs.index('function commStart'):]; cs = cs[:cs.index('\n}\n')]
for m in re.finditer(r'^\s*\w+: \[', cs, re.M): exprs.append(first_arg(cs, m.end()))
exprs.append("'Eagle One, Control. Radio check. How copy? Over.'")
for x in ['Winds three meters per second from west-northwest.', 'Winds seven meters per second from west-northwest.', 'Winds three meters per second.', 'Winds seven meters per second.', 'Night ops, keep your strobes on.', 'Eagle One, Control.', 'Over.']: exprs.append("'" + x + "'")
def speakify(t): return re.sub(r'\bRTB\b', 'R T B', t.replace('EAGLE ONE', 'Eagle One').replace('CONTROL', 'Control'))
P = set()
for e in exprs:
    for piece in lit_pieces(e):
        for part in piece.split('\x00'):
            part = speakify(part).strip()
            if not part or HANG.search(part) or not re.search('[A-Za-z]', part): continue
            for s in re.split(r'(?<=[.?!])\s+', part):
                s = s.strip(' ,')
                if re.search('[A-Za-z]', s): P.add(s)
# 코스 과제 안내 + 거리 문구
labels = json.load(open(sys.argv[2], encoding='utf-8'))
for l in labels: P.add(l)
for d in range(50, 1050, 50):
    U = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']; h, r = d // 100, d % 100
    w = ' '.join(x for x in [('one thousand' if h >= 10 else U[h] + ' hundred') if h else '', 'fifty' if r == 50 else ''] if x)
    P.add(f'about {w} meters from launch point.')
W = set(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner', 'nine', 'ten', 'hundred', 'thousand', 'fifty', 'grid', 'remaining', 'bearing',
         'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'])
W |= {'eleven', 'twelve', 'remaining', 'Over', 'Copy', 'Eagle One', 'Control'}
Wl = {}
for w in W: Wl.setdefault(w.lower(), w)
print(json.dumps({'phrases': sorted(P), 'words': sorted(Wl.values(), key=str.lower)}, ensure_ascii=False, indent=0))
