"""
data/range_korea.json -> index.html 생성
"""
import json, re, html, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def gk(d, key):
    if not isinstance(d, dict): return None
    if key in d: return d[key]
    for k, v in d.items():
        if k.lower() == key.lower(): return v
    return None

def grade_num(v):
    m = re.search(r'\d+', str(v or ''))
    return int(m.group()) if m else 0

def clean(s):
    if not s or s == 'None': return ''
    s = re.sub(r'(?i)<br\s*/?>', '\n', s)
    s = re.sub(r'(?i)</?(p|div|ul|ol)[^>]*>', '\n', s)
    s = re.sub(r'(?i)<li[^>]*>', '\n• ', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace('\xa0', ' ').replace('\t', ' ')
    s = re.sub(r'[ ]{2,}', ' ', s)
    s = re.sub(r' *\n *', '\n', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()

def split_bar(s):
    s = clean(s)
    return [re.sub(r'\s*\n\s*', ' ', x).strip() for x in s.split(' | ') if x.strip()] if s else []

def site_of(city):
    c = city.lower()
    if 'pyeongtaek' in c or 'humphreys' in c: return 'Humphreys'
    if 'tongduchon' in c or 'casey' in c or 'dongducheon' in c: return 'Casey'
    if 'yongpyong' in c or 'yeongpyeong' in c or 'pocheon' in c: return 'Rodriguez'
    return 'Other'

def spec(q):
    pats = [r'(?i)specialized experience is defined as\s*(?:duties and responsibilities that included)?\s*:?',
            r'(?i)specialized experience\s*:',
            r'(?i)(?=specialized experience equivalent to)']
    for p in pats:
        for m in re.finditer(p, q):
            rest = q[m.end():]
            if rest.lstrip().lower().startswith('experience refers to'):
                continue
            end = re.search(r'\n\s*\n|\n\s*OR\s*\n|Time[- ]in[- ]Grade|NOTE:', rest)
            out = rest[:end.start()] if end else rest[:1200]
            out = re.sub(r'\s*\n\s*', ' ', out).strip()
            if len(out) > 40:
                return out
    return ''

def transform(src):
    rows = []
    for j in src:
        t = j.get('announcementText') or {}
        cities = [gk(l, 'positionLocationCity') or '' for l in gk(j, 'positionLocations') or []]
        sites = sorted({site_of(c) for c in cities}, key=['Humphreys','Casey','Rodriguez','Other'].index)
        q = clean(t.get('requirementsQualifications'))
        full = json.dumps(t, ensure_ascii=False).lower()
        duties = split_bar(t.get('majorDutiesList'))
        if not duties:
            d2 = clean(t.get('duties'))
            duties = [x.strip('• ').strip() for x in d2.split('\n') if x.strip()]
        rows.append({
            'id': j['usajobsControlNumber'],
            'title': j['positionTitle'].strip(),
            'open': j['positionOpenDate'], 'close': j['positionCloseDate'],
            'grade': f"{j['payScale']}-{j['minimumGrade']}" + ('' if j['minimumGrade']==j['maximumGrade'] else f"/{j['maximumGrade']}"),
            'gradeNum': grade_num(j.get('maximumGrade')),
            'series': ', '.join(str(gk(c, 'series')) for c in gk(j, 'jobCategories') or []),
            'cities': cities, 'sites': sites,
            'story': 'story live fire' in full,
            'org': (j.get('hiringSubelementName') or '').strip() if j.get('hiringSubelementName') not in (None,'None') else '',
            'salary': [j.get('minimumSalary'), j.get('maximumSalary')],
            'supervisory': j.get('supervisoryStatus') == 'Y',
            'clearance': j.get('securityClearance') if j.get('securityClearance') not in (None,'None','Not Required') else '',
            'openings': j.get('totalOpenings'),
            'status': j.get('positionOpeningStatus') or '',
            'annNo': j.get('announcementNumber') or '',
            'summary': clean(t.get('summary')),
            'duties': duties,
            'spec': spec(q),
            'quals': q,
            'conditions': split_bar(t.get('requirementsConditionsOfEmployment')),
        })
    rows.sort(key=lambda r: r['open'], reverse=True)
    return rows


def main():
    src = json.loads((ROOT / "data" / "range_korea.json").read_text(encoding="utf-8"))
    rows = transform(src)
    data = json.dumps(rows, ensure_ascii=False).replace("</", "<\\/")
    kst = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9)
    tpl = (ROOT / "scripts" / "template.html").read_text(encoding="utf-8")
    page = tpl.replace("__DATA__", data).replace("__UPDATED__", kst.strftime("%Y-%m-%d"))
    (ROOT / "index.html").write_text(page, encoding="utf-8")
    print(f"index.html 생성: 공고 {len(rows)}건")


if __name__ == "__main__":
    main()
