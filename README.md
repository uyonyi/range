# 한국 미 육군 사격장 직위 공고 아카이브

USAJOBS Historic JOA API에서 한국 근무 육군 사격장 직위 공고를 모아 검색·비교 페이지(index.html)로 보여줍니다.

- `scripts/fetch_update.py`: 공고 수집. `data/range_korea.json`이 있으면 작년~올해만 다시 받아 합칩니다.
- `scripts/build.py`: JSON으로 `index.html` 생성
- `scripts/template.html`: 페이지 디자인
- `.github/workflows/update.yml`: 매주 월요일 06:00(KST) 자동 실행

수동 실행: Actions 탭 → 공고 데이터 자동 업데이트 → Run workflow
