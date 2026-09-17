"""
USAJOBS Historic JOA API -> data/range_korea.json 증분 업데이트
- data/range_korea.json이 있으면 작년~올해만 다시 조회해서 합침
- 없거나 FULL=1이면 2017년부터 전체 조회
"""
import json, os, time, datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "range_korea.json"
BASE = "https://data.usajobs.gov"
DEPT = "AR"
SERIES = ["0301", "1712", "0303", "1601", "0018"]
TITLE_WORDS = ["range", "target", "training area", "training land", "live fire", "rfmss", "itam"]
THIS_YEAR = datetime.date.today().year


def gk(d, key):
    if not isinstance(d, dict):
        return None
    if key in d:
        return d[key]
    low = key.lower()
    for k, v in d.items():
        if k.lower() == low:
            return v
    return None


def fetch_page(url, params=None, tries=4):
    last = ""
    for attempt in range(tries):
        try:
            r = requests.get(url, params=params, timeout=90,
                             headers={"User-Agent": "range-jobs-archive (GitHub Actions)"})
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}: {r.text[:300]}"
        except Exception as e:
            last = repr(e)
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"요청 실패: {url} {params or ''} / {last}")


def get_all(path, params):
    url, out = BASE + path, []
    while url:
        j = fetch_page(url, params)
        out.extend(j.get("data") or [])
        nxt = (j.get("paging") or {}).get("next")
        url = (nxt if nxt and nxt.startswith("http") else BASE + nxt) if nxt else None
        params = None
    return out


def is_target(job):
    korea = "korea" in json.dumps(gk(job, "positionLocations") or []).lower()
    title = (gk(job, "positionTitle") or "").lower()
    return korea and any(w in title for w in TITLE_WORDS)


def run_slice(series, year):
    rows = get_all("/api/historicjoa", {
        "HiringDepartmentCodes": DEPT,
        "PositionSeries": series,
        "StartPositionOpenDate": f"{year}-01-01",
        "EndPositionOpenDate": f"{year}-12-31",
    })
    return series, year, [j for j in rows if is_target(j)]


def main():
    existing = {}
    if OUT.exists():
        for j in json.loads(OUT.read_text(encoding="utf-8")):
            existing[str(gk(j, "usajobsControlNumber"))] = j
    full = os.environ.get("FULL") == "1" or not existing
    years = list(range(2017, THIS_YEAR + 1)) if full else [THIS_YEAR - 1, THIS_YEAR]
    print(f"기존 {len(existing)}건, 조회 연도 {years[0]}~{years[-1]}")

    found, failed = {}, []
    tasks = [(s, y) for s in SERIES for y in years]
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(run_slice, s, y) for s, y in tasks]
        for fu in as_completed(futures):
            try:
                s, y, rows = fu.result()
                for j in rows:
                    found[str(gk(j, "usajobsControlNumber"))] = j
                print(f"  {s}/{y}: 대상 {len(rows)}건")
            except Exception as e:
                failed.append(str(e))
                print("  실패:", str(e)[:200])

    if failed and not found and not existing:
        raise SystemExit("조회가 모두 실패했습니다. 파일을 바꾸지 않고 종료합니다.")

    merged = dict(existing)
    new_ids = [cn for cn in found if cn not in existing]
    for cn, job in found.items():
        old_text = merged.get(cn, {}).get("announcementText")
        merged[cn] = job
        if old_text:
            job["announcementText"] = old_text

    # 본문이 없는 공고와 올해 공고(상태 변경 가능)는 본문을 새로 받음
    need_text = [cn for cn, j in merged.items()
                 if not j.get("announcementText")
                 or str(gk(j, "positionOpenDate") or "")[:4] == str(THIS_YEAR)]
    for cn in need_text:
        try:
            j = fetch_page(BASE + "/api/historicjoa/announcementtext",
                           {"USAJOBSControlNumbers": cn}, tries=2)
            texts = j.get("data") or []
            if texts:
                merged[cn]["announcementText"] = texts[0]
        except Exception as e:
            print(f"  본문 실패 {cn}:", str(e)[:200])

    result = sorted(merged.values(), key=lambda j: str(gk(j, "positionOpenDate") or ""), reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"저장: {len(result)}건 (새 공고 {len(new_ids)}건: {', '.join(new_ids) or '없음'})")
    if failed:
        print(f"경고: {len(failed)}개 구간 조회 실패. 다음 실행 때 다시 시도합니다.")


if __name__ == "__main__":
    main()
