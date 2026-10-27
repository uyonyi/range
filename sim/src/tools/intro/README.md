# 첫 화면 인트로 영상·음악 (intro.mp4 · intro.webm · intro.jpg · intro_end.jpg · intro.mp3)

앱을 열면 불러오는 동안 보이는 5~6초 영상입니다. 시뮬레이터 장면을 그대로 렌더해 만듭니다.

1. 계곡 전경 (영인산 지형·숲·활주로) → 2. 코스 통과 (기준 비행을 뒤에서, 주황 기체) → 3. 능선 위 1인칭 → 4. 능선 전경 (이 위에 제목이 뜸)

- 첫 화면 순서 (`template.html` 의 `#boot`): **입장 번호 → 인트로 영상(+음악) → 로고 화면에서 고르기** (🔑 기존 계정 — 이 기기에 저장된 아이디면 바로 · 👤 게스트 · ✚ 새로 가입, `game6r.js` 의 `__bootPick`)
- 영상 위의 제목·불러오기 막대·건너뛰기·소리 켜기는 페이지가 그립니다. 영상에는 글자가 없습니다. 로고 화면 바탕은 마지막 장면 사진(intro_end.jpg) — 건너뛰어도 같은 그림.
- 음악(intro.mp3)은 영상과 박을 맞춘 8.6초 곡입니다. 브라우저는 사람이 누르기 전에는 소리를 못 내므로: 입장 번호를 누른 뒤면 영상과 같이 바로, 다시 온 사람은 🔇 소리 켜기 단추. 같은 소리 장치를 게임이 이어 받아 메뉴 음악이 이어집니다.
- 같은 창에서 다시 열면(언어 바꿈 등) 인트로·고르기 없이 준비되는 대로 바로 넘어갑니다.

## 다시 만들기

```bash
cd sim/src && python3 build.py public /tmp/pub && (cd /tmp/pub && python3 -m http.server 8768 &)
node tools/intro/render.js                        # → tools/intro/fr/s1~s4/*.jpg (960×540, 24fps · 소프트웨어 렌더라 수십 분)
node tools/intro/music.js                         # → tools/intro/music.wav (게임 배경음악 악기 녹음으로 그린 인트로 곡)
sh tools/intro/compose.sh tools/intro tools/intro # → intro.mp4 (H.264) · intro.webm (VP9, H.264 를 못 트는 브라우저용) · intro.jpg
cp tools/intro/intro.{mp4,webm,jpg,mp3} tools/intro/intro_end.jpg .   # sim/src 에 두면 build.py 가 lib/ 로 복사
```

- 장면만 다시: `SHOT=s2,s3 node tools/intro/render.js` · 코스 장면 시작 시각: `T0=6.1` (기준 비행 초)
- 프레임 폴더(fr/)·music.wav 는 저장소에 올리지 않습니다.
- 곡: 126 BPM · 3박(1.43초) 코스 장면 · 6박 능선 1인칭 · 8박(3.81초) 제목과 함께 큰 화음 → 여운. 악기 녹음은 VSCO 2 CE · VCSL (CC0).
