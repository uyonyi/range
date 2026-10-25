# 1종 실기 연습 모듈 (c1/)

빌드(build.py)가 아래 순서대로 이어 붙여 본체 IIFE 안, 마지막 `})();` 앞에 넣습니다. 파일을 나눈 것일 뿐 실행 순서·동작은 한 파일이던 때와 같습니다.

| 파일 | 내용 | 줄 |
|---|---|---|
| c1_rules.js | 기준값(C1RULES)·연습기 제원(C1P)·메뉴 등록·브리핑·시험장 좌표계·자리 찾기(c1Place)·상태(C1)·기동/단계 정의(c1Build) | 230 |
| c1_site.js | 기체 형상(makeC1)·정적 메시 묶기(c1Bake)·항법등·수술(리본)·시험장 지형물(c1Site/c1Cone/c1Props)·모드 진입/이탈(c1Menu) | 241 |
| c1_physics.js | 바람·비행 모델(c1Phys)·측정값(c1M)·판정(C1EV·c1Fail·c1Dev)·착륙장 판정·시험 시각 해 위치(c1Sun) | 283 |
| c1_ui.js | 진행(c1Start/c1Next/c1Step)·키 입력·확인·GPS 토글·3D 보조 표시·위치 게이지·코치·시범비행·패널·지도·카메라·결과/기록·민간판 정리 | 604 |
| c1_voice.js | 시험장 음성(녹음 묶음 재생·자막·음성인식 구호)·비행 전 점검 창·구술 문항 | 203 |
| c1_vr.js | VR(Quest): 조종자 자리 리그·안내판·컨트롤러 입력 + __sim 노출 | 60 |

- 파일 간 의존: 모두 같은 함수 스코프라 함수는 어디서든 호출 가능. 최상위 `const` 초기화만 순서를 탐 (rules → site → physics → ui → voice → vr).
- 테스트: `python3 build.py check <공개빌드폴더>` (tests/check.js)
