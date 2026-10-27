# 첫 화면 인트로 영상 (intro.mp4 · intro.webm · intro.jpg)

앱을 열면 불러오는 동안 보이는 5~6초 영상입니다. 시뮬레이터 장면을 그대로 렌더해 만듭니다.

1. 계곡 전경 (영인산 지형·숲·활주로) → 2. 코스 통과 (기준 비행을 뒤에서, 주황 기체) → 3. 능선 위 1인칭 → 4. 능선 전경 (이 위에 제목이 뜸)

- 영상 위의 제목·불러오기 막대·건너뛰기는 페이지(`template.html` 의 `#boot`)가 그립니다. 영상에는 글자가 없습니다.
- 페이지는 영상이 끝나고 첫 화면이 그려지면(`window.__bootReady`) 인트로를 걷습니다. 누르면 건너뛰고, 같은 창에서 다시 열면 준비되는 대로 바로 넘어갑니다.

## 다시 만들기

```bash
cd sim/src && python3 build.py public /tmp/pub && (cd /tmp/pub && python3 -m http.server 8768 &)
node tools/intro/render.js                        # → tools/intro/fr/s1~s4/*.jpg (960×540, 24fps · 소프트웨어 렌더라 수십 분)
sh tools/intro/compose.sh tools/intro tools/intro # → intro.mp4 (H.264) · intro.webm (VP9, H.264 를 못 트는 브라우저용) · intro.jpg
cp tools/intro/intro.mp4 tools/intro/intro.webm tools/intro/intro.jpg .  # sim/src 에 두면 build.py 가 lib/ 로 복사
```

- 장면만 다시: `SHOT=s2,s3 node tools/intro/render.js` · 코스 장면 시작 시각: `T0=6.1` (기준 비행 초)
- 프레임 폴더(fr/)는 저장소에 올리지 않습니다.
