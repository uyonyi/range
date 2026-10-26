# 나무 모형 생성기

시뮬레이터의 숲(`game6t.js`)이 쓰는 나무 형상과 잎 그림을 만든다.

- 형상: [ez-tree](https://github.com/dgreenheck/ez-tree) 1.1 (MIT, Daniel Greenheck)로 참나무류·소나무·관목을, 조림 침엽수(낙엽송·리기다)는 `gen.js` 의 `buildConifer` 로 직접 만든다.
- 종마다 세밀도 3단계: 0 가까이(가지 + 잎 판, 약 200~1,300 삼각형) · 1 중간(약 100~600) · 2 멀리(임포스터: 세로 판 두 장 + 가로 판 한 장, 6 삼각형).
- 형상은 높이 1 · 수관 반지름 1 로 정규화한다. 시뮬레이터가 정사영상에서 잰 나무 높이·수관 크기로 늘려 그리므로 충돌 판정은 그대로다.
- 잎 아틀라스 2048²: 잔가지 그림(ez-tree 잎 그림) · 잔가지를 겹친 잎 덩이 · 줄기 칸 · 임포스터 그림. 색(`trees_rgb.webp`)과 투명도(`trees_a.webp`)를 따로 저장해, 브라우저가 투명한 곳의 색을 버리지 않게 한다. 밉맵은 시뮬레이터가 덮는 면적을 맞춰 직접 만든다.

```
cd sim/src/tools/treegen
npm i
node export.js ../..        # sim/src/trees.json · trees_rgb.webp · trees_a.webp 갱신
PREVIEW=1 node export.js ../..   # 아틀라스 미리보기 png 도 함께
```

그 뒤 `sim/src` 에서 `python3 build.py public ..` 로 공개판을 다시 만든다 (`lib/` 로 복사됨).
