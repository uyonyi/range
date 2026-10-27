# 조종사 로그인 · 랭킹 서버 (Cloudflare Worker + D1)

웹(GitHub Pages)과 나중의 앱이 같이 쓰는 작은 API 입니다. 코드는 `worker.js` 한 파일.

- 주소: `https://fpv-rank.unsokyi1.workers.dev` (공개판 빌드에 `build.py` 의 `RANK_API` 로 들어감 · 비우면 로그인·랭킹 없이 이름만)
- 저장: D1 데이터베이스 `fpv-rank` (표는 처음 요청 때 스스로 만듦 · 비밀값도 D1 안에 자동 생성)
- 아이디 = 조종사 이름 (2~12자 · 같은 이름은 한 명 · 띄어쓰기·대소문자 무시 · 욕설·운영자 사칭 막음 — 웹 `game6r.js` 와 같은 규칙)
- 비밀번호 = 숫자 4자리, 소금 + 서버 비밀값으로 HMAC 해시해 저장 · 5번 틀리면 10분 잠금 · 개인 번호를 쓰지 않도록 화면에서 안내
- 랭킹: 코스·임무별(현장·코스 배치 포함) 사람마다 최고 점수 하나 (같으면 짧은 시간)

## 고치고 다시 올리기 (대시보드)

1. Cloudflare → Workers & Pages → `fpv-rank` → **Edit code**
2. `worker.js` 내용을 통째로 붙여 넣고 **Deploy**
3. (처음 만들 때만) Settings → Bindings → D1 database, 변수 이름 `DB` → `fpv-rank`

## 로컬 시험

```bash
node server/dev.mjs 8790          # 같은 코드를 node:sqlite 로 실행 (DB=파일.sqlite 로 저장 가능)
# 공개 빌드를 띄우고: index.html?test&api=http://localhost:8790&login
```

## API

`worker.js` 맨 위 주석 참고 (`/check` `/register` `/login` `/score` `/me` `/delete` `/rank` `/kinds`).
