// 인트로 음악: 게임 배경음악의 악기 녹음(VSCO 2 CE · VCSL, CC0)으로 영상 장면에 맞춘 짧은 곡을 오프라인으로 그림 → WAV
//   사용: (공개 빌드를 8768 에 띄운 뒤) node tools/intro/music.js [출력.wav]   → compose.sh 가 intro.mp3 로 만듦
//   126 BPM (한 박 0.476 s) · 영상 장면 바뀜에 박을 맞춤:
//     0~3박   계곡 전경 — 낮은 현 + 하프 분산화음 + 심벌 스웰
//     3박(1.43 s) 코스 통과 — 킥·팀파니 + 현 오스티나토 (Dm)
//     6박(2.86 s) 능선 1인칭 — Bb → 7박 C · 북 채움
//     8박(3.81 s) 능선 전경 + 제목 — 큰 화음 (Dm: 호른·현·팀파니·심벌) → 여운
const { chromium } = require('playwright'); const fs = require('fs');
const PORT = process.env.PORT || 8768, OUT = process.argv[2] || __dirname + '/music.wav', DUR = 9.5;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext()).newPage(); p.setDefaultTimeout(300000);
  await p.goto(`http://localhost:${PORT}/index.html?test`, { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__sim && window.__sim.renderMusic, null, { timeout: 300000 });
  const r = await p.evaluate(async DUR => window.__sim.renderMusic('epic', DUR, 'menu', 'course', X => {
    const { sp, timpani, brass, strings, harp, swellCym, osnare, mf } = X, B = 60 / 126, bt = n => n * B;
    // ---- 1. 계곡 전경: D 낮은 현 드론이 천천히 커지고, 하프가 올라가고, 심벌 스웰이 3박에서 터짐
    sp('celL', 38, 0.00, 3.6, 0.5, { atk: 0.9, rel: 0.6 });
    sp('celL', 50, 0.05, 3.4, 0.32, { atk: 1.0, rel: 0.6 });
    sp('vlaL', 57, 0.15, 3.2, 0.26, { atk: 1.1, rel: 0.6 });
    sp('vlnL', 62, 0.30, 3.0, 0.2, { atk: 1.2, rel: 0.6 });
    [50, 57, 62, 65, 69, 74, 77].forEach((n, i) => harp(mf(n), 0.18 + i * bt(0.25), 0.04 + i * 0.004));
    swellCym(0.25, bt(3) - 0.25, 0.1);
    // ---- 2. 코스 통과 ~ 능선 1인칭: 박마다 킥 · 첫 박 팀파니+금관 · 현 8분음표(낮은 현) + 16분음표(바이올린 분산화음)
    const CH = { 3: [50, [62, 65, 69]], 4: [50, [62, 65, 69]], 5: [50, [62, 65, 69]], 6: [46, [58, 62, 65]], 7: [48, [60, 64, 67]] };   // 박: [베이스, 화음]
    for (const k of [3, 4, 5, 6, 7]) {
      const t = bt(k), [bass, tri] = CH[k], big = k === 3 || k === 6;
      sp('bd', null, t, 0, big ? 0.95 : 0.62);
      if (big) { timpani(mf(bass - 12), t, 0.8); brass(mf(bass - 12), t, 0.32, 0.07); brass(mf(tri[0]), t, 0.32, 0.05); }
      if (k === 5 || k === 7) osnare(t, 0.13);
      const last = k === 7;   // 7박 뒷반은 비움 (북 채움만) → 제목 화음이 더 크게 들림
      for (let e = 0; e < (last ? 1 : 2); e++) strings(mf(e ? bass + 7 : bass), t + e * bt(0.5), 0.2, 0.043, null, 0.01);   // 낮은 현: 근음 · 5도
      const arp = [tri[0], tri[1], tri[2], tri[1]];
      for (let s = 0; s < (last ? 2 : 4); s++) strings(mf(arp[s] + (s === 2 && k >= 6 ? 12 : 0)), t + s * bt(0.25), 0.1, 0.024 + (k - 3) * 0.003, null, 0.005);
    }
    sp('tomH', null, bt(7.5), 0, 0.6); sp('tomL', null, bt(7.75), 0, 0.7); sp('tomL', null, bt(7.875), 0, 0.55);
    swellCym(bt(6.4), bt(8) - bt(6.4), 0.12);
    // ---- 3. 제목: 큰 Dm 화음 (호른 4성 · 트롬본 · 현 전체 · 팀파니 · 심벌) → 하프·글로켄슈필 반짝임 → 천천히 사라짐
    const T = bt(8);
    sp('bd', null, T, 0, 1); sp('bd', null, T + 0.012, 0, 0.8); timpani(mf(38), T, 1); sp('crash', null, T, 0, 1);
    sp('tbnS', 38, T, 0.7, 0.85); sp('cbP', 26, T, 1.2, 0.9);
    [[50, 0.5], [62, 0.46], [65, 0.4], [69, 0.4]].forEach(([n, g]) => sp('hrnL', n, T, 2.9, g, { atk: 0.04, rel: 1.2 }));
    sp('celL', 38, T, 4.6, 0.55, { atk: 0.05, rel: 2.2 }); sp('celL', 50, T, 4.4, 0.4, { atk: 0.05, rel: 2.0 });
    sp('vlaL', 57, T, 4.4, 0.34, { atk: 0.06, rel: 2.0 }); sp('vlaL', 65, T, 4.2, 0.3, { atk: 0.06, rel: 2.0 });
    sp('vlnL', 74, T, 4.4, 0.3, { atk: 0.08, rel: 2.0 }); sp('vlnL', 81, T, 4.0, 0.2, { atk: 0.1, rel: 2.0 });
    [62, 65, 69, 74, 77, 81, 86].forEach((n, i) => harp(mf(n), T + 0.3 + i * bt(0.25), 0.035));
    sp('glk', 86, T + 1.15, 1.5, 0.4); sp('glk', 93, T + 1.4, 1.5, 0.3);
    timpani(mf(38), T + bt(4), 0.28);   // 여운 속 낮은 북 한 번
  }, 0.4), DUR);   // 음량을 낮춰 그린 뒤(압축기가 덜 눌러 큰 화음이 살아남) compose.sh 에서 크기를 맞춤
  fs.writeFileSync(OUT, Buffer.from(r.wav, 'base64')); console.log('wrote', OUT, 'peak', r.peak.toFixed(3));
  await b.close();
})();
