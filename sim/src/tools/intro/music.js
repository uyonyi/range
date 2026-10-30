// 인트로 음악: 게임 배경음악의 악기 녹음(VSCO 2 CE · VCSL, CC0)으로 영상 장면에 맞춘 곡을 오프라인으로 그림 → WAV
//   사용: (공개 빌드를 8768 에 띄운 뒤) node tools/intro/music.js [출력.wav]   → compose.sh 가 intro.mp3 로 만듦
//   126 BPM (한 박 0.476 s) · 영상 장면(render.js)에 박을 맞춤:
//     0~4박   계곡 전경 — 낮은 현 드론 + 하프 분산화음 + 심벌 스웰
//     4박     마을 — 하프·피치카토·글로켄 가볍게 (Dm → F)
//     7박     코스 통과 — 킥·팀파니 + 현 오스티나토 (Dm)
//     11박    숲길 — Bb · 북 채움
//     14박    능선 — C · 커지며 17박으로
//     17박(8.1 s) 정상 전경 + 제목 — 큰 Dm 화음 (호른·현·팀파니·심벌) → 여운 (13 s 까지)
const { chromium } = require('playwright'); const fs = require('fs');
const PORT = process.env.PORT || 8768, OUT = process.argv[2] || __dirname + '/music.wav', DUR = 13.5;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext()).newPage(); p.setDefaultTimeout(300000);
  await p.goto(`http://localhost:${PORT}/index.html?test`, { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__sim && window.__sim.renderMusic, null, { timeout: 300000 });
  const r = await p.evaluate(async DUR => window.__sim.renderMusic('epic', DUR, 'menu', 'course', X => {
    const { sp, timpani, brass, strings, harp, swellCym, osnare, mf } = X, B = 60 / 126, bt = n => n * B;
    // ---- 1. 계곡 전경 (0~4박): D 낮은 현 드론이 천천히 커지고, 하프가 올라가고, 심벌 스웰이 4박에서 터짐
    sp('celL', 38, 0.00, 4.4, 0.5, { atk: 1.0, rel: 0.7 });
    sp('celL', 50, 0.05, 4.2, 0.32, { atk: 1.1, rel: 0.7 });
    sp('vlaL', 57, 0.20, 4.0, 0.26, { atk: 1.2, rel: 0.7 });
    sp('vlnL', 62, 0.40, 3.8, 0.2, { atk: 1.3, rel: 0.7 });
    [50, 57, 62, 65, 69, 74, 77, 81].forEach((n, i) => harp(mf(n), 0.25 + i * bt(0.3), 0.04 + i * 0.004));
    swellCym(0.4, bt(4) - 0.4, 0.1);
    // ---- 2. 마을 (4~7박): 가볍게 — 하프 분산화음 + 피치카토 + 글로켄 (Dm → F)
    const VC = { 4: [50, [62, 65, 69]], 5: [50, [62, 65, 69]], 6: [53, [65, 69, 72]] };
    for (const k of [4, 5, 6]) { const t = bt(k), [bass, tri] = VC[k]; sp('vlnP', bass + 12, t, 0, 0.3); sp('cbP', bass, t, 0, 0.45); [tri[0], tri[1], tri[2], tri[1]].forEach((n, i) => harp(mf(n + 12), t + i * bt(0.25), 0.035)); if (k === 5) sp('glk', 86, t + bt(0.5), 1.2, 0.25); }
    sp('hrnS', 50, bt(4), 1.4, 0.22, { atk: 0.3, rel: 0.5 }); sp('hrnS', 57, bt(4), 1.4, 0.18, { atk: 0.3, rel: 0.5 });
    swellCym(bt(5.5), bt(7) - bt(5.5), 0.09);
    // ---- 3. 코스 통과 ~ 숲길 ~ 능선 (7~17박): 박마다 킥 · 마디 첫 박 팀파니+금관 · 현 8분음표(낮은 현) + 16분음표(바이올린 분산화음)
    const CH = {};
    for (const k of [7, 8, 9, 10]) CH[k] = [50, [62, 65, 69]];      // Dm
    for (const k of [11, 12, 13]) CH[k] = [46, [58, 62, 65]];       // Bb
    for (const k of [14, 15]) CH[k] = [48, [60, 64, 67]];           // C
    CH[16] = [45, [57, 60, 64]];                                    // Am → 17박 Dm
    for (let k = 7; k <= 16; k++) {
      const t = bt(k), [bass, tri] = CH[k], big = k === 7 || k === 11 || k === 14, last = k === 16, lvl = Math.min(1, 0.6 + (k - 7) * 0.045);
      sp('bd', null, t, 0, (big ? 0.95 : 0.62) * lvl);
      if (big) { timpani(mf(bass - 12), t, 0.8); brass(mf(bass - 12), t, 0.32, 0.07); brass(mf(tri[0]), t, 0.32, 0.05); }
      if (k % 2 === 1 && k >= 9) osnare(t, 0.11 + (k - 9) * 0.006);
      if (k >= 11 && !last) sp('hhC', null, t + bt(0.5), 0, 0.14);
      for (let e = 0; e < (last ? 1 : 2); e++) strings(mf(e ? bass + 7 : bass), t + e * bt(0.5), 0.2, 0.043 * lvl, null, 0.01);   // 낮은 현: 근음 · 5도
      const arp = [tri[0], tri[1], tri[2], tri[1]];
      for (let s = 0; s < (last ? 2 : 4); s++) strings(mf(arp[s] + (s === 2 && k >= 11 ? 12 : 0)), t + s * bt(0.25), 0.1, (0.024 + (k - 7) * 0.0025) * lvl, null, 0.005);
      if (k >= 14) sp('hrnS', bass, t, bt(1), 0.2 + (k - 14) * 0.04, { atk: 0.05, rel: 0.2 });   // 능선: 호른이 받쳐 주며 커짐
    }
    sp('tomH', null, bt(16.5), 0, 0.6); sp('tomL', null, bt(16.75), 0, 0.7); sp('tomL', null, bt(16.875), 0, 0.55);
    swellCym(bt(15.2), bt(17) - bt(15.2), 0.13);
    // ---- 4. 제목 (17박): 큰 Dm 화음 (호른 4성 · 트롬본 · 현 전체 · 팀파니 · 심벌) → 하프·글로켄슈필 반짝임 → 천천히 사라짐
    const T = bt(17);
    sp('bd', null, T, 0, 1); sp('bd', null, T + 0.012, 0, 0.8); timpani(mf(38), T, 1); sp('crash', null, T, 0, 1);
    sp('tbnS', 38, T, 0.7, 0.85); sp('cbP', 26, T, 1.2, 0.9);
    [[50, 0.5], [62, 0.46], [65, 0.4], [69, 0.4]].forEach(([n, g]) => sp('hrnL', n, T, 3.2, g, { atk: 0.04, rel: 1.4 }));
    sp('celL', 38, T, 5.0, 0.55, { atk: 0.05, rel: 2.4 }); sp('celL', 50, T, 4.8, 0.4, { atk: 0.05, rel: 2.2 });
    sp('vlaL', 57, T, 4.8, 0.34, { atk: 0.06, rel: 2.2 }); sp('vlaL', 65, T, 4.6, 0.3, { atk: 0.06, rel: 2.2 });
    sp('vlnL', 74, T, 4.8, 0.3, { atk: 0.08, rel: 2.2 }); sp('vlnL', 81, T, 4.4, 0.2, { atk: 0.1, rel: 2.2 });
    [62, 65, 69, 74, 77, 81, 86].forEach((n, i) => harp(mf(n), T + 0.3 + i * bt(0.25), 0.035));
    sp('glk', 86, T + 1.15, 1.5, 0.4); sp('glk', 93, T + 1.4, 1.5, 0.3);
    timpani(mf(38), T + bt(4), 0.28);   // 여운 속 낮은 북 한 번
    [62, 69, 74].forEach((n, i) => sp('vlnL', n, T + bt(6) + i * 0.1, 2.2, 0.12, { atk: 0.6, rel: 1.2 }));   // 마지막 여운 (고르기 화면으로)
  }, 0.4), DUR);   // 음량을 낮춰 그린 뒤(압축기가 덜 눌러 큰 화음이 살아남) compose.sh 에서 크기를 맞춤
  fs.writeFileSync(OUT, Buffer.from(r.wav, 'base64')); console.log('wrote', OUT, 'peak', r.peak.toFixed(3));
  await b.close();
})();
