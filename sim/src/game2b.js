
// =====================================================================
//  background music (절차 생성: 장면별 스타일 5가지, 구간마다 화음·멜로디 새로 만듦)
// =====================================================================
const MUS = { on: true, vol: 0.5, timer: null, next: 0, step: 0, bus: null };
try { const m = JSON.parse(localStorage.getItem('hroc_fpv_music') || '{}'); if (m.on !== undefined) MUS.on = m.on; if (m.vol !== undefined) MUS.vol = m.vol; } catch (e) { }
function saveMusic() { try { localStorage.setItem('hroc_fpv_music', JSON.stringify({ on: MUS.on, vol: MUS.vol })); } catch (e) { } }
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
const BPM = 126;
const CHORDS = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]];   // Am F C G
const HOOK = [[76, 0, 74, 76, 0, 72, 74, 0], [72, 0, 72, 74, 0, 77, 76, 0], [79, 0, 76, 74, 0, 72, 74, 0], [74, 0, 71, 72, 74, 0, 79, 0]];
function musicLevel() { return MUS.on ? MUS.vol * 0.42 : 0; }
function musicStart() {
  if (!AU.ctx || MUS.timer) return;
  const ctx = AU.ctx;
  MUS.bus = ctx.createGain(); MUS.bus.gain.value = musicLevel();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5;
  MUS.bus.connect(comp); comp.connect(AU.master);
  MUS.duck = ctx.createGain(); MUS.duck.connect(MUS.bus);                 // 킥에 맞춰 눌리는 (사이드체인) 버스
  MUS.dly = ctx.createDelay(1); MUS.dly.delayTime.value = 3 * 60 / BPM / 4;  // 리드용 딜레이
  const fb = ctx.createGain(); fb.gain.value = 0.32; const wet = ctx.createGain(); wet.gain.value = 0.28;
  MUS.dly.connect(fb); fb.connect(MUS.dly); MUS.dly.connect(wet); wet.connect(MUS.bus);
  MUS.next = ctx.currentTime + 0.12; MUS.step = 0;
  MUS.timer = setInterval(musicSchedule, 25);
}
function musicSetLevel() { if (MUS.bus && AU.ctx) MUS.bus.gain.setTargetAtTime(musicLevel(), AU.ctx.currentTime, 0.2); }
function note(type, f, t, dur, gain, cut, dest, atk) {
  const ctx = AU.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
  let node = o;
  if (cut) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cut, t); lp.frequency.exponentialRampToValueAtTime(Math.max(cut * 0.25, 80), t + dur); o.connect(lp); node = lp; }
  node.connect(g); g.connect(dest || MUS.bus);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (atk || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05); return o;
}
function noiseHit(t, type, freq, q, gain, dur, dest) {
  const ctx = AU.ctx, s = ctx.createBufferSource(); s.buffer = AU.noise; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || MUS.bus); s.start(t, Math.random()); s.stop(t + dur + 0.02); return f;
}
// ---- 곡 구성: 장면에 따라 다른 스타일, 구간(인트로·A·B·브레이크)마다 화음·멜로디를 새로 만듦 ----
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
function chordOf(name) {   // 'Am' -> [베이스(E2~D#3), [3화음(G3~F#4 근음)]]
  const m = /^([A-G][b#]?)(m?)(7?)$/.exec(name), r = NOTE[m[1]], minor = !!m[2];
  const root = 40 + ((r - 4 + 12) % 12), t0 = 55 + ((r - 7 + 12) % 12), tri = [t0, t0 + (minor ? 3 : 4), t0 + 7];
  if (m[3]) tri.push(t0 + 10); return [root, tri];
}
const STYLES = {
  drive:   { bpm: 126, scale: [0, 2, 3, 5, 7, 8, 10], key: 9, progs: [['Am', 'F', 'C', 'G'], ['Am', 'G', 'F', 'G'], ['F', 'G', 'Am', 'Am'], ['Dm', 'F', 'Am', 'G']], kick: 'four', bass: 'roll', lead: 'sawtooth', arp: 16, hat: 16 },
  action:  { bpm: 140, scale: [0, 2, 3, 5, 7, 8, 10], key: 4, progs: [['Em', 'C', 'G', 'D'], ['Em', 'D', 'C', 'B'], ['C', 'D', 'Em', 'Em'], ['Em', 'G', 'D', 'C']], kick: 'four', bass: 'oct', lead: 'square', arp: 16, hat: 16 },
  tension: { bpm: 98, scale: [0, 1, 3, 5, 7, 8, 10], key: 2, progs: [['Dm', 'Bb', 'Gm', 'A'], ['Dm', 'Dm', 'Bb', 'A'], ['Gm', 'Dm', 'Bb', 'A'], ['Dm', 'C', 'Bb', 'A']], kick: 'half', bass: 'pulse', lead: 'triangle', arp: 8, hat: 8, drone: true },
  forest:  { bpm: 112, scale: [0, 2, 4, 7, 9], key: 7, progs: [['G', 'Em', 'C', 'D'], ['Em', 'C', 'G', 'D'], ['C', 'G', 'D', 'Em'], ['G', 'D', 'Em', 'C']], kick: 'two', bass: 'walk', lead: 'triangle', arp: 8, hat: 8, pluck: true },
  night:   { bpm: 84, scale: [0, 2, 3, 5, 7, 8, 10], key: 0, progs: [['Cm', 'Ab', 'Eb', 'Bb'], ['Cm', 'Fm', 'Ab', 'G'], ['Ab', 'Eb', 'Bb', 'Cm']], kick: 'sparse', bass: 'long', lead: 'sine', arp: 8, hat: 0, drone: true },
  // 오케스트라 풍 (합성): 현 패드 + 8분음표 현 오스티나토 + 팀파니 + 금관 멜로디·스탭 + 심벌 스웰 · 산악·착륙장·메뉴·결과
  epic:    { bpm: 82, scale: [0, 2, 3, 5, 7, 8, 10], key: 2, progs: [['Dm', 'Bb', 'F', 'C'], ['Dm', 'C', 'Bb', 'C'], ['Bb', 'F', 'C', 'Dm'], ['Dm', 'Bb', 'Gm', 'C']], orch: true },
  // 잔잔한 현악 (합성): 느린 패드 + 하프 분산화음 · 타악기 없음 · 1종 연습·튜토리얼
  calm:    { bpm: 66, scale: [0, 2, 4, 5, 7, 9, 11], key: 5, progs: [['F', 'C', 'Dm', 'Bb'], ['Dm', 'Bb', 'F', 'C'], ['F', 'Am', 'Bb', 'C']], orch: true, soft: true }
};
// 비트 스타일의 킥 패턴 (구간마다 하나 골라 단조롭지 않게) · 16스텝 중 킥이 울리는 자리
const KICKS = { four: [[0, 4, 8, 12], [0, 4, 8, 10, 12], [0, 6, 8, 12], [0, 3, 6, 8, 11, 12]], half: [[0, 8], [0, 7, 8], [0, 8, 14]], two: [[0, 10], [0, 6, 10], [0, 10, 13]], sparse: [[0]] };
const SECTIONS = [{ n: 'intro', bars: 4, e: 1 }, { n: 'A', bars: 8, e: 2 }, { n: 'B', bars: 8, e: 3 }, { n: 'brk', bars: 4, e: 1 }, { n: 'A2', bars: 8, e: 3 }, { n: 'B2', bars: 8, e: 4 }];
const SONG = { style: 'drive', want: 'drive', sec: 0, bar: 0, prog: null, motif: null, seed: 1, rnd: Math.random, kick: null, half: false, ost: null };
function songStyleFor() {
  const k = S.kind, c1 = typeof isC1 === 'function' && isC1(k);
  if (S.state === 'menu') return 'epic';                       // 첫 화면: 웅장하게 (낮은 에너지로)
  if (c1) return 'calm';                                        // 1종 연습: 시험장 분위기 · 잔잔한 현악
  if (typeof ENV !== 'undefined' && ENV.night) return 'night';
  if (S.state === 'result') return 'epic';
  if (k === 'race' || k === 'strike') return 'action';
  if (k === 'forest') return 'forest';
  if (k === 'recon' || k === 'fire' || k === 'sar' || k === 'track') return 'tension';
  if (k === 'ridge' || k === 'field') return 'epic';            // 능선 종주·야전 착륙장: 오케스트라
  if (k === 'tutorial') return 'calm';
  return 'drive';
}
function songSection() {   // 구간이 바뀔 때마다 새 화음 진행·멜로디
  const st = STYLES[SONG.style], r = SONG.rnd;
  SONG.prog = st.progs[Math.floor(r() * st.progs.length)].map(chordOf);
  const sc = st.scale, base = 62 + ((st.key - 2 + 12) % 12), L = [];   // 멜로디 음역 D4~F#5
  let deg = Math.floor(r() * sc.length);
  for (let i = 0; i < 16; i++) {   // 8분음표 16개 = 2마디 동기
    if (r() < (SECTIONS[SONG.sec].e >= 3 ? 0.3 : 0.45)) { L.push(0); continue; }
    deg = Math.max(0, Math.min(sc.length + 2, deg + Math.round((r() - 0.5) * 4)));
    L.push(base + sc[deg % sc.length] + 12 * Math.floor(deg / sc.length));
  }
  SONG.motif = L; SONG.var = L.map(n => n && r() < 0.35 ? n + (r() < 0.5 ? 2 : -1) : n);
  const KP = KICKS[st.kick] || KICKS.four; SONG.kick = KP[Math.floor(r() * KP.length)];           // 구간마다 다른 킥 패턴
  SONG.half = SECTIONS[SONG.sec].n === 'brk' || (SECTIONS[SONG.sec].n === 'A2' && r() < 0.4);        // 브레이크·가끔 A2 는 하프타임
  SONG.ost = [[0, 1, 2, 1], [0, 2, 1, 2], [0, 1, 2, 3], [2, 1, 0, 1]][Math.floor(r() * 4)];          // 현 오스티나토 모양 (화음 음 번호)
  SONG.lead2 = r() < 0.5;                                                                            // 리드 음색 바꿔 가며
}
// ---- 오케스트라 음색 (합성) ----
function strings(f, t, dur, gain, dest, atk, cut) {   // 현: 살짝 어긋난 톱니파 3겹 + 저역 필터 + 느린 어택
  const ctx = AU.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cut || 1400, t); lp.Q.value = 0.4;
  for (const d of [-7, 0, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.3); }
  lp.connect(g); g.connect(dest || MUS.bus);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + (atk || 0.25)); g.gain.setValueAtTime(gain, t + Math.max(atk || 0.25, dur - 0.25)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
}
function brass(f, t, dur, gain, dest) {   // 금관: 톱니파 2겹 + 밴드패스 + 짧은 어택·약한 비브라토
  const ctx = AU.ctx, g = ctx.createGain(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(1600, f * 2.5); bp.Q.value = 0.7;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = f * 0.004; lfo.connect(lg);
  for (const d of [-4, 5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; lg.connect(o.frequency); o.connect(bp); o.start(t); o.stop(t + dur + 0.15); }
  lfo.start(t); lfo.stop(t + dur + 0.15); bp.connect(g); g.connect(dest || MUS.bus);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.045); g.gain.setValueAtTime(gain * 0.85, t + Math.max(0.05, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
}
function timpani(f, t, gain) {   // 팀파니: 사인 음정 하강 + 짧은 잡음 타격
  const ctx = AU.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9); o.connect(g); g.connect(MUS.bus); o.start(t); o.stop(t + 1);
  noiseHit(t, 'lowpass', 400, 0, gain * 0.5, 0.08);
}
function osnare(t, gain) { noiseHit(t, 'bandpass', 1500, 1.2, gain, 0.12); noiseHit(t, 'highpass', 4000, 0, gain * 0.4, 0.06); }   // 오케스트라 스네어
function swellCym(t, dur, gain) {   // 심벌 스웰: 잡음이 서서히 커졌다가 구간 첫 박에서 터짐
  const ctx = AU.ctx, s = ctx.createBufferSource(); s.buffer = AU.noise; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.4);
  s.connect(f); f.connect(g); g.connect(MUS.bus); s.start(t, Math.random()); s.stop(t + dur + 1.5);
}
function harp(f, t, gain) { note('triangle', f, t, 1.6, gain, 2600, MUS.bus, 0.004); }   // 하프: 삼각파 짧은 어택·긴 여운
// 오케스트라 스타일 한 스텝 (16분음표 단위) · e = 에너지 1~4 · soft = 잔잔한 현악
function orchStep(st, sec, bar, step, ch, e, last, t, s16) {
  const soft = !!st.soft, r = SONG.rnd, beat = step % 4 === 0, half = step % 8 === 0;
  const root = ch[0], tri = ch[1], padG = soft ? 0.05 : (e >= 3 ? 0.045 : 0.06);
  // 현 패드: 마디마다 화음 (낮은 현 + 중간 현) · 2마디 단위로 길게
  if (step === 0 && bar % 2 === 0) { strings(mf(root), t, s16 * 32, padG * 1.2, MUS.duck, 0.5, 900); for (const n of tri) strings(mf(n), t, s16 * 32, padG, MUS.duck, 0.6, soft ? 1200 : 1600); }
  if (soft) {   // 잔잔: 하프 분산화음(8분음표) · 가끔 높은 현 한 음 · 타악기 없음
    if (step % 2 === 0 && (e >= 2 || step % 4 === 0)) { const ar = [tri[0], tri[1], tri[2], tri[1] + 12, tri[2] + 12, tri[0] + 12]; harp(mf(ar[(step / 2 + bar * 3) % ar.length]), t, 0.05); }
    if (sec.n !== 'intro' && step === 0 && bar % 2 === 1 && r() < 0.7) { const M = SONG.motif.filter(Boolean); if (M.length) strings(mf(M[bar % M.length] + 12), t, s16 * 14, 0.03, MUS.bus, 0.4, 2200); }
    return;
  }
  // 오스티나토: 8분음표 현 (에너지 2 이상) · 패턴은 구간마다
  if (e >= 2 && step % 2 === 0) { const i = SONG.ost[(step / 2) % 4], n = (i < 3 ? tri[i] : tri[0] + 12) + (e >= 3 && bar % 2 ? 12 : 0); strings(mf(n), t, s16 * 1.8, 0.05, MUS.duck, 0.02, 2200); }
  // 팀파니: 1·3박 (e≥2) · 마지막 마디는 16분음표 크레셴도 롤
  if (e >= 2) { if (last && step >= 8) timpani(mf(root - 12), t, 0.25 + (step - 8) * 0.06); else if (half || (e >= 3 && step === 14)) timpani(mf(root - 12), t, step === 0 ? 0.9 : 0.6); }
  // 스네어: 2·4박 + 행진 16분 (e≥3)
  if (e >= 3) { if (step === 4 || step === 12) osnare(t, 0.28); else if (step % 4 === 2) osnare(t, 0.08); else if (e >= 4 && step % 2 === 1) osnare(t, 0.05); }
  // 금관: 멜로디 (A·B 구간, 8분음표 동기) · 스탭 (e≥4 짝수 마디 1박)
  if (sec.n !== 'intro' && sec.n !== 'brk' && step % 2 === 0 && e >= 3) { const M = bar % 4 >= 2 ? SONG.var : SONG.motif, n = M[(bar % 2) * 8 + step / 2]; if (n) brass(mf(n - 12), t, s16 * 1.9, 0.07); }
  if (e >= 4 && step === 0 && bar % 2 === 0) for (const n of tri) brass(mf(n - 12), t, s16 * 3, 0.05);
  if (e <= 2 && sec.n !== 'intro' && step === 0 && bar % 2 === 1) { const M = SONG.motif.filter(Boolean); if (M.length) strings(mf(M[bar % M.length]), t, s16 * 12, 0.035, MUS.bus, 0.3, 2000); }   // 낮은 에너지: 높은 현이 주제 한 음씩
  // 심벌 스웰: 구간 마지막 마디 → 다음 구간 첫 박 · 첫 박 크래시
  if (last && step === 8 && e >= 2) swellCym(t, s16 * 8, 0.12);
  if (bar === 0 && step === 0 && sec.e >= 2) noiseHit(t, 'highpass', 4000, 0, 0.14, 1.8);
}
function musicSchedule() {
  const ctx = AU.ctx; if (!ctx) return;
  while (MUS.next < ctx.currentTime + 0.15) {
    let st = STYLES[SONG.style]; const s16 = 60 / st.bpm / 4, t = MUS.next, step = MUS.step % 16;
    if (step === 0) {   // 마디 시작
      if (!SONG.prog) songSection();
      SONG.bar++; let sec = SECTIONS[SONG.sec];
      const want = songStyleFor(); SONG.want = want;
      if (SONG.bar >= sec.bars || (want !== SONG.style && SONG.bar % 4 === 0)) {
        SONG.bar = 0; SONG.sec = (SONG.sec + 1) % SECTIONS.length;
        if (want !== SONG.style) { SONG.style = want; SONG.sec = 0; st = STYLES[want]; MUS.dly && MUS.dly.delayTime.setValueAtTime(3 * 60 / st.bpm / 4, t); }
        songSection();
      }
    }
    const sec = SECTIONS[SONG.sec], bar = SONG.bar, ch = SONG.prog[bar % 4];
    // 속도·부스트에 따라 한 단계 더
    let e = sec.e; if (S.state === 'run' && (S.boosting || (DR.v && DR.v.length() > 14))) e = Math.min(4, e + 1); if (S.state === 'menu') e = Math.min(e, 2);
    const last = bar === sec.bars - 1;
    if (MUS.on && MUS.vol > 0 && st.orch) orchStep(st, sec, bar, step, ch, e, last, t, s16);
    else if (MUS.on && MUS.vol > 0) {
      const k = st.kick, KP = SONG.kick || KICKS.four[0], kickOn = e >= 2 && (k === 'sparse' ? step === 0 && bar % 2 === 0 : SONG.half ? step === 0 || step === 8 : KP.includes(step));
      if (kickOn || (e === 1 && step === 0 && k !== 'sparse')) {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(e === 1 ? 0.5 : 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(g); g.connect(MUS.bus); o.start(t); o.stop(t + 0.3);
        MUS.duck.gain.setValueAtTime(0.3, t); MUS.duck.gain.linearRampToValueAtTime(1, t + s16 * 3);
      }
      if (e >= 2 && (SONG.half ? step === 8 : (step === 4 || step === 12)) && k !== 'sparse') { noiseHit(t, 'bandpass', 1800, 0.8, 0.32, 0.17); noiseHit(t, 'highpass', 3000, 0, 0.1, 0.09); }
      if (e >= 3 && last && step >= 12 && k !== 'sparse') noiseHit(t, 'bandpass', 1600, 0.9, 0.18, 0.08);   // 구간 끝 스네어 필인
      if (st.hat && e >= 2 && step % (16 / st.hat) === 0) noiseHit(t, 'highpass', 8000, 0, step % 4 === 2 ? 0.09 : 0.035, step % 4 === 2 ? 0.12 : 0.035);
      if (st.drone && step === 0 && bar % 2 === 0) note('sine', mf(ch[0] - 12), t, s16 * 32, 0.05, 0, MUS.duck, 0.4);
      // 베이스
      const b = st.bass, bn = ch[0] - 12;
      if (b === 'roll' && step % 4 !== 0) note('sawtooth', mf(bn + (step % 4 === 2 ? 12 : 0)), t, s16 * 0.9, 0.15, 650, MUS.duck);
      if (b === 'oct' && step % 2 === 0) note('sawtooth', mf(bn + (step % 4 === 2 ? 12 : 0)), t, s16 * 1.6, 0.15, 800, MUS.duck);
      if (b === 'pulse' && step % 2 === 0 && e >= 1) note('square', mf(bn), t, s16 * 1.2, 0.08, 420, MUS.duck);
      if (b === 'walk' && step % 4 === 0) note('triangle', mf(bn + [0, 7, 12, 7][step / 4]), t, s16 * 3.5, 0.2, 0, MUS.duck);
      if (b === 'long' && step === 0) note('sine', mf(bn), t, s16 * 15, 0.16, 0, MUS.duck, 0.05);
      // 패드
      if (step === 0) for (const n of ch[1]) note('sawtooth', mf(n), t, s16 * 15, e >= 3 ? 0.02 : 0.026, e >= 3 ? 1800 : 1100, MUS.duck, 0.18);
      // 아르페지오 (에너지 3 이상, 또는 숲 스타일의 퉁기는 소리)
      if ((e >= 3 || st.pluck) && step % (16 / st.arp) === 0) { const ar = ch[1].concat(ch[1].map(n => n + 12)), i = (step / (16 / st.arp) + bar) % ar.length; note(st.pluck ? 'triangle' : 'square', mf(ar[i] + (st.pluck ? 0 : 12)), t, s16 * (st.pluck ? 2.5 : 0.8), st.pluck ? 0.05 : 0.022, st.pluck ? 2400 : 3200, MUS.duck); }
      // 멜로디 (A·B 구간, 2마디 동기 + 변형)
      if (sec.n !== 'intro' && sec.n !== 'brk' && step % 2 === 0) { const M = bar % 4 >= 2 ? SONG.var : SONG.motif, n = M[(bar % 2) * 8 + step / 2]; if (n && (e >= 3 || sec.n === 'A')) { note(SONG.lead2 && st.lead === 'sawtooth' ? 'square' : st.lead, mf(n), t, s16 * 1.8, st.lead === 'sine' || st.lead === 'triangle' ? 0.07 : 0.04, 3400); if (e >= 3) note('square', mf(n) * 1.004, t, s16 * 1.8, 0.022, 3000, MUS.dly); } }
      // 구간 끝 필인·상승음, 시작 크래시
      if (last && step === 0 && e >= 2) { const f = noiseHit(t, 'highpass', 400, 0, 0.05, s16 * 16); f.frequency.exponentialRampToValueAtTime(9000, t + s16 * 16); }
      if (last && step >= 12 && e >= 2) noiseHit(t, 'bandpass', 1900, 0.8, 0.2 + (step - 12) * 0.05, 0.1);
      if (bar === 0 && step === 0 && sec.e >= 2) noiseHit(t, 'highpass', 5000, 0, 0.16, 1.6);
    }
    MUS.next += s16; MUS.step++;
  }
}

// =====================================================================
//  input (keyboard + gamepad / RC 송신기)
// =====================================================================
const keys = {};
const TOUCH = { on: false, thr: 0, yaw: 0, pitch: 0, roll: 0 };
const IS_TOUCH = !!window.SIM_MOBILE || ((('ontouchstart' in window) || navigator.maxTouchPoints > 0) && window.matchMedia && matchMedia('(pointer: coarse)').matches);

const IN = { thr: 0, yaw: 0, pitch: 0, roll: 0, src: 'KEY' };
const ks = { thr: 0, yaw: 0, pitch: 0, roll: 0 };
const pressed = [];
const RC_DEFAULT = {
  axes: { thr: { i: 1, inv: true }, yaw: { i: 0, inv: false }, pitch: { i: 3, inv: true }, roll: { i: 2, inv: false } },
  btn: { drop: { type: 'btn', i: 0 }, cam: { type: 'btn', i: 1 }, reset: { type: 'btn', i: 3 } },
  thrType: 'center', cal: {}, pad: -1
};
let RC = JSON.parse(JSON.stringify(RC_DEFAULT));
try { const r = JSON.parse(localStorage.getItem('hroc_fpv_rc') || 'null'); if (r && r.axes) RC = Object.assign(RC, r); } catch (e) { }
function saveRC() { try { localStorage.setItem('hroc_fpv_rc', JSON.stringify(RC)); } catch (e) { } }
// ---- 키보드 지정 (사용자가 바꿀 수 있음) ----
const KB_PRESET = {
  A: { up: 'KeyW', down: 'KeyS', yawL: 'KeyA', yawR: 'KeyD', fwd: 'ArrowUp', back: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', drop: 'Space', cam: 'KeyC', zoom: 'KeyZ', reset: 'KeyR', assist: 'KeyH', boost: 'ShiftLeft' },
  B: { up: 'ArrowUp', down: 'ArrowDown', yawL: 'ArrowLeft', yawR: 'ArrowRight', fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', drop: 'Space', cam: 'KeyC', zoom: 'KeyZ', reset: 'KeyR', assist: 'KeyH', boost: 'ShiftLeft' }
};
const KB_CANON = { drop: 'Space', cam: 'KeyC', zoom: 'KeyZ', reset: 'KeyR', assist: 'KeyH' };
const KB_RESERVED = ['KeyT', 'Escape', 'Enter', 'Tab', 'KeyF', 'KeyB', 'KeyM', 'KeyG', 'KeyP', 'KeyL', 'KeyN', 'KeyV', 'KeyX', 'MetaLeft', 'MetaRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4'];
let KB = Object.assign({}, KB_PRESET.A);
try { const k = JSON.parse(localStorage.getItem('hroc_fpv_keys2') || 'null'); if (k && k.up) KB = Object.assign({}, KB_PRESET.A, k); } catch (e) { }
function saveKB() { try { localStorage.setItem('hroc_fpv_keys2', JSON.stringify(KB)); } catch (e) { } }
function kbWhich() { for (const p of ['A', 'B']) if (Object.keys(KB_PRESET[p]).every(k => KB_PRESET[p][k] === KB[k])) return p; return 'C'; }
function keyName(c) {
  if (!c) return '—';
  const M = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'Caps' };
  if (M[c]) return M[c]; if (c.startsWith('Key')) return c.slice(3); if (c.startsWith('Digit')) return c.slice(5); if (c.startsWith('Numpad')) return 'Num' + c.slice(6); return c;
}
let KBCAP = null;   // 키 지정 화면에서 다음 입력을 기다리는 기능 이름
addEventListener('keydown', e => {
  if (KBCAP) { e.preventDefault(); e.stopPropagation(); kbCapture(e.code); return; }
  const inInput = e.target && e.target.tagName === 'INPUT';
  if (inInput && e.target.type !== 'range') return;   // 이름 입력 중에는 게임 키로 쓰지 않음
  const act = Object.keys(KB).find(k => KB[k] === e.code);
  if (!inInput && (act || ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))) e.preventDefault();
  initAudio(); musicStart();
  let code = e.code;
  if (act && KB_CANON[act]) code = KB_CANON[act];                       // 기능 키 -> 내부 이름
  else if (act) code = 'MV_' + e.code;                                   // 이동 키는 다른 기능을 하지 않음
  else if (Object.values(KB_CANON).includes(e.code) && e.code !== 'Space') code = 'X_' + e.code;   // 다른 키로 옮긴 기능은 무시
  else if (e.code === 'Space') code = 'X_Space';
  if (!keys[e.code]) pressed.push(code);
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('pointerdown', () => { initAudio(); musicStart(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function getPad() {
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  if (!pads.length) return null;
  return pads.find(p => p.index === RC.pad) || pads[0];
}
function calAxis(gp, i) {
  const raw = gp.axes[i] || 0, c = RC.cal[i];
  if (!c) return raw;
  const v = raw >= c.c ? (raw - c.c) / Math.max(c.max - c.c, 1e-3) : (raw - c.c) / Math.max(c.c - c.min, 1e-3);
  return clamp(v, -1, 1);
}
// 스틱 곡선: real = 거의 선형(민 만큼 기울기·속도, 실제 조종기 기본값에 가까움) · soft = 가운데가 무딘 엑스포
function stickExpo(vr) { return SET.expo || (vr ? 'real' : 'soft'); }
function stickCurve(v, dz, vr) { if (stickExpo(vr) !== 'real') return shape(v, dz); if (Math.abs(v) < dz) return 0; const s = (Math.abs(v) - dz) / (1 - dz); return Math.sign(v) * Math.min(1, 0.8 * s + 0.2 * s * s * s); }
function shape(v, deadz) { if (Math.abs(v) < deadz) return 0; const s = (Math.abs(v) - deadz) / (1 - deadz); return Math.sign(v) * (0.4 * s + 0.6 * s * s * s); }
const padPrevBtn = {};
function btnState(gp, b) {
  if (!b) return false;
  if (b.type === 'btn') return !!(gp.buttons[b.i] && gp.buttons[b.i].pressed);
  return ((gp.axes[b.i] || 0) * (b.sign || 1)) > 0.5;
}
function readInput(dt) {
  const tgt = {
    thr: (keys[KB.up] ? 1 : 0) - (keys[KB.down] ? 1 : 0), yaw: (keys[KB.yawR] ? 1 : 0) - (keys[KB.yawL] ? 1 : 0),
    pitch: (keys[KB.fwd] ? 1 : 0) - (keys[KB.back] ? 1 : 0), roll: (keys[KB.right] ? 1 : 0) - (keys[KB.left] ? 1 : 0)
  };
  for (const k in tgt) { const r = tgt[k] === 0 ? 7 : 3.2; ks[k] += clamp(tgt[k] - ks[k], -r * dt, r * dt); }
  IN.thr = ks.thr; IN.yaw = ks.yaw; IN.pitch = ks.pitch; IN.roll = ks.roll; IN.src = 'KEY';
  IN.boost = !!BOOST.on;
  if (TOUCH.on) { for (const k of ['thr', 'yaw', 'pitch', 'roll']) if (Math.abs(TOUCH[k]) > Math.abs(IN[k])) { IN[k] = TOUCH[k]; IN.src = 'TOUCH'; } }
  const gp = getPad();
  if (gp && !RCUI.open) {
    const st = {};
    for (const k of ['thr', 'yaw', 'pitch', 'roll']) {
      const a = RC.axes[k]; let v = calAxis(gp, a.i); if (a.inv) v = -v;
      st[k] = stickCurve(v, k === 'thr' && RC.thrType === 'bottom' ? 0.12 : 0.07, false);
    }
    const any = Math.abs(st.thr) + Math.abs(st.yaw) + Math.abs(st.roll) + Math.abs(st.pitch) > 0.02;
    if (any) { for (const k in st) if (Math.abs(st[k]) > Math.abs(IN[k])) IN[k] = st[k]; IN.src = 'PAD'; }
    const map = { drop: 'Space', cam: 'KeyC', reset: 'KeyR' };
    for (const k in map) { const s = btnState(gp, RC.btn[k]); if (s && !padPrevBtn[k]) pressed.push(map[k]); padPrevBtn[k] = s; }
    const sb = gp.buttons[9] && gp.buttons[9].pressed; if (sb && !padPrevBtn.start) pressed.push('Escape'); padPrevBtn.start = sb;
    if (gp.buttons[6] && gp.buttons[6].value > 0.4 && SET.diff !== 'atti') IN.boost = true;
    if (gp.mapping === 'standard') {   // Xbox / 표준 배치 추가 버튼
      const ex = { rt: [7, 'Space'], lb: [4, 'PadLB'], rb: [5, 'PadRB'], x: [2, 'KeyH'], back: [8, 'KeyG'], rs: [11, 'KeyL'], up: [12, 'PadUp'], down: [13, 'PadDown'], left: [14, 'PadLeft'], right: [15, 'PadRight'], a: [0, 'PadA'] };
      for (const k in ex) { const bt = gp.buttons[ex[k][0]]; const s = !!(bt && (bt.pressed || bt.value > 0.5)); if (s && !padPrevBtn['x' + k]) pressed.push(ex[k][1]); padPrevBtn['x' + k] = s; }
    }
  }
  if (XR_ON) xrInput(dt);   // VR 컨트롤러 스틱
}
const RCUI = { open: false };
function rumble(strong, weak, ms) {
  try { if (TOUCH.on && navigator.vibrate) navigator.vibrate(Math.round((ms || 180) * Math.max(strong, weak) * 0.6)); } catch (e) { }
  try { const gp = getPad(); const va = gp && gp.vibrationActuator; if (va && va.playEffect) va.playEffect('dual-rumble', { duration: ms || 180, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { }
}
