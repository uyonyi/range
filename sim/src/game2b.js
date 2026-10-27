
// =====================================================================
//  background music (절차 생성: 장면별 스타일 5가지, 구간마다 화음·멜로디 새로 만듦)
// =====================================================================
const MUS = { on: true, vol: 0.5, timer: null, next: 0, step: 0, bus: null };
try { const m = JSON.parse(localStorage.getItem('fpvsim_fpv_music') || '{}'); if (m.on !== undefined) MUS.on = m.on; if (m.vol !== undefined) MUS.vol = m.vol; } catch (e) { }
function saveMusic() { try { localStorage.setItem('fpvsim_fpv_music', JSON.stringify({ on: MUS.on, vol: MUS.vol })); } catch (e) { } }
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
const BPM = 126;
const CHORDS = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]];   // Am F C G
const HOOK = [[76, 0, 74, 76, 0, 72, 74, 0], [72, 0, 72, 74, 0, 77, 76, 0], [79, 0, 76, 74, 0, 72, 74, 0], [74, 0, 71, 72, 74, 0, 79, 0]];
function musicLevel() { return MUS.on ? MUS.vol * 0.42 : 0; }
function musicStart() {
  try { if (AU.ctx && MUS.on && MUS.vol > 0 && !SET.musSynth) smpLoad(); } catch (e) { }   // 음악을 켠 사람만 악기 녹음을 받음 (약 2 MB)
  if (!AU.ctx || MUS.timer) return;
  const ctx = AU.ctx;
  MUS.bus = ctx.createGain(); MUS.bus.gain.value = musicLevel();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5;
  MUS.bus.connect(comp); comp.connect(AU.master);
  MUS.duck = ctx.createGain(); MUS.duck.connect(MUS.bus);                 // 킥에 맞춰 눌리는 (사이드체인) 버스
  MUS.dly = ctx.createDelay(1); MUS.dly.delayTime.value = 3 * 60 / BPM / 4;  // 리드용 딜레이
  const fb = ctx.createGain(); fb.gain.value = 0.32; const wet = ctx.createGain(); wet.gain.value = 0.28;
  MUS.dly.connect(fb); fb.connect(MUS.dly); MUS.dly.connect(wet); wet.connect(MUS.bus);
  smpRoute(ctx);
  MUS.next = ctx.currentTime + 0.12; MUS.step = 0;
  MUS.timer = setInterval(musicSchedule, 25);
}
// ---- 실제 악기 녹음 (VSCO 2 CE · VCSL — Versilian Studios, CC0): lib/music.mp3 한 개에 악기 조각을 이어 붙임 (tools/music/mk_music.py)
//  다 받기 전·못 받으면 합성음 그대로. 받으면 다음 마디부터 녹음 악기로 연주
const SMP = { st: 'idle', buf: null, I: null, rr: {}, p: null };
// 악기: [크기, 좌우(−1 왼쪽 ~ 1 오른쪽), 잔향 보내기, 킥에 눌림(1)]
const SMPI = { vlnL: [0.5, -0.35, 0.55, 1], vlaL: [0.5, 0.05, 0.55, 1], celL: [0.6, 0.35, 0.5, 1], vlnT: [0.42, -0.3, 0.5, 1], vlnS: [0.5, -0.3, 0.35, 0], celS: [0.62, 0.3, 0.3, 1], cbP: [0.95, 0.15, 0.25, 1], vlnP: [0.55, -0.2, 0.4, 0],
  hrnL: [0.5, 0.15, 0.6, 0], hrnS: [0.5, 0.15, 0.5, 0], tbnS: [0.5, 0.3, 0.45, 0], flL: [0.42, -0.1, 0.55, 0], clL: [0.45, -0.05, 0.5, 0], harp: [0.5, -0.25, 0.55, 0], pno: [0.55, 0, 0.45, 0], mar: [0.5, 0.2, 0.4, 0], glk: [0.28, -0.2, 0.55, 0], vib: [0.45, 0.05, 0.55, 0],
  timp: [0.95, 0.1, 0.5, 0], timpR: [0.6, 0.1, 0.5, 0], bd: [1, 0, 0.3, 0], sn: [0.55, 0.05, 0.3, 0], snR: [0.4, 0.05, 0.35, 0], hhC: [0.22, 0.3, 0.12, 0], hhO: [0.22, 0.3, 0.2, 0], tamb: [0.3, -0.35, 0.25, 0], shk: [0.3, -0.35, 0.2, 0], clap: [0.4, 0, 0.3, 0],
  crash: [0.42, -0.2, 0.45, 0], swell: [0.38, 0.2, 0.45, 0], conga: [0.5, 0.25, 0.25, 0], tomL: [0.6, 0.15, 0.35, 0], tomH: [0.55, -0.15, 0.35, 0] };
function smpLoad() {
  if (SMP.st !== 'idle' || !AU.ctx || window.SIM_NOSMP || location.protocol === 'file:') return SMP.p; SMP.st = 'loading';
  const base = (window.SIM_BASE || '') + 'lib/music', v = '?v=' + (window.SIM_MUSIC_V || ''), ctx = AU.ctx;
  SMP.p = Promise.all([fetch(base + '.json' + v).then(r => r.ok ? r.json() : Promise.reject('json ' + r.status)), fetch(base + '.mp3' + v).then(r => r.ok ? r.arrayBuffer() : Promise.reject('mp3 ' + r.status))])
    .then(([J, ab]) => new Promise((ok, no) => ctx.decodeAudioData(ab, ok, no)).then(buf => {
      // 디코더 지연 재기: 맨 앞 동기 신호(J.sync 초)가 실제로 어디서 시작하는지
      const d = buf.getChannelData(0), n = Math.min(d.length, Math.round(buf.sampleRate * 0.5)); let i = 0; while (i < n && Math.abs(d[i]) < 0.3) i++;
      const lag = i < n ? i / buf.sampleRate - J.sync : 0, I = {};
      for (const k in J.inst) I[k] = J.inst[k].map(e => [e[0], e[1] + lag, e[2], e[3]]);
      SMP.buf = buf; SMP.I = I; SMP.lag = lag; SMP.st = 'ready';
    })).catch(e => { SMP.st = 'fail'; SMP.err = String(e); });
  return SMP.p;
}
function smpOn() { return SMP.st === 'ready' && !SET.musSynth; }
// 잔향(작은 홀): 잡음이 줄어들며 고음부터 먼저 사라지는 충격 응답 · 악기마다 좌우 자리와 잔향 양
function smpRoute(ctx) {
  const sr = ctx.sampleRate, len = Math.round(sr * (LOWQ ? 1.5 : 2.3)), ir = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const t = i / sr, a = Math.exp(-t * 3.1), k = Math.min(0.95, 0.25 + t * 0.55); lp = lp * k + (Math.random() * 2 - 1) * (1 - k); d[i] = (t < 0.012 ? 0 : lp * a * 2.2); } }
  const cv = ctx.createConvolver(); cv.buffer = ir; MUS.revIn = ctx.createGain(); MUS.revIn.gain.value = 0.55; MUS.revIn.connect(cv); cv.connect(MUS.bus);
  MUS.ch = {};
  for (const k in SMPI) { const c = SMPI[k], p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (p.pan) p.pan.value = c[1];
    p.connect(c[3] ? MUS.duck : MUS.bus); const sg = ctx.createGain(); sg.gain.value = c[2]; p.connect(sg); sg.connect(MUS.revIn); MUS.ch[k] = p; }
}
// 한 음: 가장 가까운 녹음 음을 골라 빠르기로 음높이를 맞춤 · 녹음보다 길게 잡으면 겹쳐 이어 붙임(긴 현·금관)
//  o: { atk 어택(초), rel 끝 페이드(초), rate 음높이 없는 타악기 빠르기, nx 다음 조각 }
function sp(key, midi, t, dur, g, o) {
  const L = SMP.I && SMP.I[key]; if (!L || !L.length || !MUS.ch) return; const ctx = AU.ctx; o = o || {};
  let e;
  if (midi == null || L[0][0] == null) { SMP.rr[key] = ((SMP.rr[key] || 0) + 1) % L.length; e = L[SMP.rr[key]]; }
  else { e = L[0]; for (const x of L) if (Math.abs(x[0] - midi) < Math.abs(e[0] - midi)) e = x; }
  const sk = o.skip || 0, rate = midi != null && e[0] != null ? Math.pow(2, (midi - e[0]) / 12) : (o.rate || 1), len = (e[2] - sk) / rate, v = g * SMPI[key][0]; t = Math.max(0, t);
  const want = dur || len, atk = o.atk || 0.003, s = ctx.createBufferSource(), gg = ctx.createGain(); s.buffer = SMP.buf; s.playbackRate.value = rate;
  const seg = Math.min(want, len), rel = Math.min(o.rel || 0.2, seg * 0.4), cont = want > len + 0.05 && len > 1;
  gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(v, t + atk);
  if (cont) { gg.gain.setValueAtTime(v, t + len - 0.6); gg.gain.linearRampToValueAtTime(0, t + len); }
  else if (seg < len - 0.02) { gg.gain.setValueAtTime(v, t + Math.max(atk, seg - rel)); gg.gain.linearRampToValueAtTime(0, t + seg); }
  s.connect(gg); gg.connect(MUS.ch[key]); s.start(t, e[1] + sk, e[2] - sk); s.stop(t + len + 0.05);
  if (cont) sp(key, midi, t + len - 0.6, want - len + 0.6, g, { atk: 0.6, rel: o.rel });   // 다음 조각 (어택이 묻히게 서서히 들어옴)
}
const f2m = f => 69 + 12 * Math.log2(f / 440);
function smpPad(n, t, dur, g, atk) { sp(n < 50 ? 'celL' : n < 62 ? 'vlaL' : 'vlnL', n, t, dur, g, { atk: atk || 0.35, rel: 0.6 }); }
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
// 녹음 악기 편성 (비트 스타일): kg 큰북 세기 · sn 뒷박 · hh 박 쪼개기 · perc 탬버린 · bass·pad·arp·lead 악기 · fill 구간 끝 채움
const SI = {
  drive:   { kg: 0.8, sn: 'sn', clap: 1, hh: 'hhC', perc: 'tamb', pad: 'str', arp: 'vlnS', arpO: 12, lead: 'hrn', fill: 'tom' },
  action:  { kg: 0.95, sn: 'sn', clap: 1, hh: 'hhC', perc: 'tamb', pad: 'str', arp: 'vlnS', arpO: 12, lead: 'hrnS', timp: 1, fill: 'tom' },
  tension: { kg: 0.7, sn: 'snSoft', hh: 'shk', pad: 'vlnT', arp: 'vlnP', arpO: 12, lead: 'clL', drone: 'celL', fill: 'timpR' },
  forest:  { kg: 0.5, sn: 'conga', hh: 'shk', pad: 'str', arp: 'mar', arpO: 0, lead: 'flL', fill: 'conga' },
  night:   { kg: 0.45, pad: 'vib', arp: 'pno', arpO: 0, lead: 'pno', drone: 'celL', glk: 1 }
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
  if (smpOn()) { const m = Math.round(f2m(f)); if (dur < 0.5) sp(m < 55 ? 'celS' : 'vlnS', m, t, dur + 0.25, gain * 12); else smpPad(m, t, dur + 0.25, gain * 11, atk); return; }
  const ctx = AU.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cut || 1400, t); lp.Q.value = 0.4;
  for (const d of [-7, 0, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.3); }
  lp.connect(g); g.connect(dest || MUS.bus);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + (atk || 0.25)); g.gain.setValueAtTime(gain, t + Math.max(atk || 0.25, dur - 0.25)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
}
function brass(f, t, dur, gain, dest) {   // 금관: 톱니파 2겹 + 밴드패스 + 짧은 어택·약한 비브라토
  if (smpOn()) { const m = Math.round(f2m(f)); if (dur < 0.45) sp(m < 46 ? 'tbnS' : 'hrnS', m, t, dur + 0.3, gain * 11); else sp('hrnL', m, t, dur + 0.15, gain * 10, { atk: 0.04, rel: 0.25 }); return; }
  const ctx = AU.ctx, g = ctx.createGain(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(1600, f * 2.5); bp.Q.value = 0.7;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = f * 0.004; lfo.connect(lg);
  for (const d of [-4, 5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; lg.connect(o.frequency); o.connect(bp); o.start(t); o.stop(t + dur + 0.15); }
  lfo.start(t); lfo.stop(t + dur + 0.15); bp.connect(g); g.connect(dest || MUS.bus);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.045); g.gain.setValueAtTime(gain * 0.85, t + Math.max(0.05, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
}
function timpani(f, t, gain) {   // 팀파니: 사인 음정 하강 + 짧은 잡음 타격
  if (smpOn()) { let m = f2m(f); while (m > 46) m -= 12; while (m < 31) m += 12; sp('timp', m, t, 1.8, Math.min(1, gain * 0.9)); return; }
  const ctx = AU.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9); o.connect(g); g.connect(MUS.bus); o.start(t); o.stop(t + 1);
  noiseHit(t, 'lowpass', 400, 0, gain * 0.5, 0.08);
}
function osnare(t, gain) { if (smpOn()) { sp('sn', null, t, 0.5, Math.min(1, gain * 2.4)); return; } noiseHit(t, 'bandpass', 1500, 1.2, gain, 0.12); noiseHit(t, 'highpass', 4000, 0, gain * 0.4, 0.06); }   // 오케스트라 스네어
function swellCym(t, dur, gain) {   // 심벌 스웰: 잡음이 서서히 커졌다가 구간 첫 박에서 터짐
  if (smpOn()) { const e = SMP.I.swell && SMP.I.swell[0]; if (e) { const st = t + dur - (e[3] || e[2] * 0.7), sk = Math.max(0, t - st); sp('swell', null, st + sk, 0, Math.min(1, gain * 6), { skip: sk, atk: sk ? 0.3 : 0.003 }); } return; }
  const ctx = AU.ctx, s = ctx.createBufferSource(); s.buffer = AU.noise; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.4);
  s.connect(f); f.connect(g); g.connect(MUS.bus); s.start(t, Math.random()); s.stop(t + dur + 1.5);
}
function harp(f, t, gain) { if (smpOn()) { sp('harp', Math.round(f2m(f)), t, 2.4, Math.min(1, gain * 14)); return; } note('triangle', f, t, 1.6, gain, 2600, MUS.bus, 0.004); }   // 하프: 삼각파 짧은 어택·긴 여운
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
  if (bar === 0 && step === 0 && sec.e >= 2) { if (smpOn()) { sp('crash', null, t, 0, 0.7); timpani(mf(root - 12), t, 0.9); } else noiseHit(t, 'highpass', 4000, 0, 0.14, 1.8); }
}
// 녹음 악기로 비트 스타일 한 스텝 (합성판과 같은 자리·같은 음, 악기만 다름)
function beatStepS(st, sec, bar, step, ch, e, last, t, s16) {
  const I = SI[SONG.style], k = st.kick, KP = SONG.kick || KICKS.four[0];
  const kickOn = e >= 2 && (k === 'sparse' ? step === 0 && bar % 2 === 0 : SONG.half ? step === 0 || step === 8 : KP.includes(step));
  if (kickOn || (e === 1 && step === 0 && k !== 'sparse')) { sp('bd', null, t, 0, (e === 1 ? 0.6 : 1) * I.kg); MUS.duck.gain.setValueAtTime(0.5, t); MUS.duck.gain.linearRampToValueAtTime(1, t + s16 * 3); }
  if (I.sn && e >= 2 && k !== 'sparse' && (SONG.half ? step === 8 : (step === 4 || step === 12))) { if (I.sn === 'conga') sp('conga', null, t, 0, 0.8); else { sp('sn', null, t, 0, I.sn === 'snSoft' ? 0.45 : 0.85); if (I.clap && e >= 3) sp('clap', null, t, 0, 0.5); } }
  if (e >= 3 && last && step >= 12 && k !== 'sparse') { if (I.fill === 'tom') sp(step < 14 ? 'tomH' : 'tomL', null, t, 0, 0.55 + (step - 12) * 0.12); else if (I.fill === 'conga') sp('conga', null, t, 0, 0.5 + (step - 12) * 0.1); else sp('sn', null, t, 0, 0.25 + (step - 12) * 0.08); }
  if (I.fill === 'timpR' && last && step === 8 && e >= 2) sp('timpR', null, t, s16 * 8 + 0.3, 0.6, { rel: 0.3 });
  if (st.hat && I.hh && e >= 2 && step % (16 / st.hat) === 0) { const open = I.hh === 'hhC' && e >= 3 && step % 8 === 6; sp(open ? 'hhO' : I.hh, null, t, open ? 0.45 : 0, step % 4 === 2 ? 0.75 : 0.42); }
  if (I.perc && e >= 3 && step % 8 === 4) sp(I.perc, null, t, 0, 0.5);
  if (I.timp && e >= 3 && step === 0) timpani(mf(ch[0] - 12), t, 0.8);
  if (st.drone && I.drone && step === 0 && bar % 2 === 0) sp(I.drone, ch[0] >= 48 ? ch[0] - 12 : ch[0], t, s16 * 32, 0.3, { atk: 0.8, rel: 0.8 });
  // 베이스 (첼로 스피카토·콘트라베이스 피치카토·긴 첼로)
  const b = st.bass, bn = ch[0] - 12;
  if (b === 'roll' && step % 4 !== 0) sp('celS', bn + 12 + (step % 4 === 2 ? 12 : 0), t, s16 * 1.3, 0.75);
  if (b === 'oct' && step % 2 === 0) { sp('celS', bn + 12 + (step % 4 === 2 ? 12 : 0), t, s16 * 1.6, 0.8); if (step % 8 === 0) sp('cbP', bn, t, 0, 0.75); }
  if (b === 'pulse' && step % 2 === 0) sp('cbP', bn, t, s16 * 1.8, 0.6);
  if (b === 'walk' && step % 4 === 0) sp('cbP', bn + [0, 7, 12, 7][step / 4], t, 0, 0.85);
  if (b === 'long' && step === 0) sp('celL', ch[0] >= 48 ? ch[0] - 12 : ch[0], t, s16 * 16 + 0.3, 0.5, { atk: 0.15, rel: 0.5 });
  // 화음 (현 패드 · 트레몰로 · 비브라폰)
  if (step === 0) {
    if (I.pad === 'vib') ch[1].forEach((n, i) => sp('vib', n, t + i * 0.025, 0, 0.3));
    else for (const n of ch[1]) sp(I.pad === 'vlnT' ? 'vlnT' : n < 62 ? 'vlaL' : 'vlnL', n + (I.pad === 'vlnT' ? 12 : 0), t, s16 * 16 + 0.4, e >= 3 ? 0.26 : 0.32, { atk: 0.3, rel: 0.6 });
  }
  // 분산화음 (현 스피카토·마림바·피치카토·피아노)
  if ((e >= 3 || st.pluck) && step % (16 / st.arp) === 0) { const ar = ch[1].concat(ch[1].map(n => n + 12)), i = (step / (16 / st.arp) + bar) % ar.length; sp(I.arp, ar[i] + I.arpO, t, I.arp === 'vlnS' ? s16 * 1.5 : 0, I.arp === 'pno' ? 0.38 : 0.5); }
  // 선율 (호른·금관 스탭·플루트·클라리넷·피아노)
  if (sec.n !== 'intro' && sec.n !== 'brk' && step % 2 === 0) { const M = bar % 4 >= 2 ? SONG.var : SONG.motif, n = M[(bar % 2) * 8 + step / 2];
    if (n && (e >= 3 || sec.n === 'A')) { const L = I.lead, d = s16 * 1.8;
      if (L === 'hrn') sp(d < 0.45 ? 'hrnS' : 'hrnL', n - 12, t, d + 0.15, 0.6, { atk: 0.03 });
      else if (L === 'hrnS') { sp('hrnS', n - 12, t, d + 0.2, 0.7); if (e >= 4) sp('tbnS', n - 24, t, d + 0.2, 0.45); }
      else if (L === 'pno') sp('pno', n, t, 0, 0.55);
      else sp(L, n + (L === 'flL' ? 12 : 0), t, d + 0.2, 0.5, { atk: 0.05, rel: 0.15 }); } }
  if (I.glk && step === 8 && bar % 4 === 3) sp('glk', ch[1][2] + 24, t, 0, 0.35);
  // 구간 끝 심벌 스웰 → 다음 구간 첫 박 크래시
  if (last && step === 0 && e >= 2) swellCym(t, s16 * 16, 0.12);
  if (bar === 0 && step === 0 && sec.e >= 2) sp('crash', null, t, 0, 0.6);
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
    else if (MUS.on && MUS.vol > 0 && smpOn() && SI[SONG.style]) beatStepS(st, sec, bar, step, ch, e, last, t, s16);
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
// 조종기 모드 (휴대폰 터치·게임패드): 2 = 왼쪽 스틱 상승·회전 / 오른쪽 전진·좌우 (기본) · 1 = 왼쪽 전진·회전 / 오른쪽 상승·좌우
//  RC 조종기를 축 지정으로 쓰면 조종기 자체 모드를 따르므로 여기서 바꾸지 않음 (게임패드 기본 축일 때만 스로틀↔피치 맞바꿈) · VR 은 vrStickMode
function stickMode() { try { return SET.stick === 1 ? 1 : 2; } catch (e) { return 2; } }
const ks = { thr: 0, yaw: 0, pitch: 0, roll: 0 };
const pressed = [];
const RC_DEFAULT = {
  axes: { thr: { i: 1, inv: true }, yaw: { i: 0, inv: false }, pitch: { i: 3, inv: true }, roll: { i: 2, inv: false } },
  btn: { drop: { type: 'btn', i: 0 }, cam: { type: 'btn', i: 1 }, reset: { type: 'btn', i: 3 } },
  thrType: 'center', cal: {}, pad: -1
};
let RC = JSON.parse(JSON.stringify(RC_DEFAULT)); const RC_DEF_AX = JSON.stringify(RC_DEFAULT.axes);
try { const r = JSON.parse(localStorage.getItem('fpvsim_fpv_rc') || 'null'); if (r && r.axes) RC = Object.assign(RC, r); } catch (e) { }
function saveRC() { try { localStorage.setItem('fpvsim_fpv_rc', JSON.stringify(RC)); } catch (e) { } }
// ---- 키보드 지정 (사용자가 바꿀 수 있음) ----
const KB_PRESET = {
  A: { up: 'KeyW', down: 'KeyS', yawL: 'KeyA', yawR: 'KeyD', fwd: 'ArrowUp', back: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', drop: 'Space', cam: 'KeyC', zoom: 'KeyZ', reset: 'KeyR', assist: 'KeyH', boost: 'ShiftLeft' },
  B: { up: 'ArrowUp', down: 'ArrowDown', yawL: 'ArrowLeft', yawR: 'ArrowRight', fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', drop: 'Space', cam: 'KeyC', zoom: 'KeyZ', reset: 'KeyR', assist: 'KeyH', boost: 'ShiftLeft' }
};
const KB_CANON = { drop: 'Space', cam: 'KeyC', zoom: 'KeyZ', reset: 'KeyR', assist: 'KeyH' };
const KB_RESERVED = ['Digit0', 'KeyT', 'Escape', 'Enter', 'Tab', 'KeyF', 'KeyB', 'KeyM', 'KeyG', 'KeyP', 'KeyL', 'KeyN', 'KeyV', 'KeyX', 'MetaLeft', 'MetaRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4'];
let KB = Object.assign({}, KB_PRESET.A);
try { const k = JSON.parse(localStorage.getItem('fpvsim_fpv_keys2') || 'null'); if (k && k.up) KB = Object.assign({}, KB_PRESET.A, k); } catch (e) { }
function saveKB() { try { localStorage.setItem('fpvsim_fpv_keys2', JSON.stringify(KB)); } catch (e) { } }
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
    const st = {}, sw = stickMode() === 1 && JSON.stringify(RC.axes) === RC_DEF_AX;   // 모드 1: 기본 축(게임패드)일 때 스로틀↔피치
    for (const k of ['thr', 'yaw', 'pitch', 'roll']) {
      const a = RC.axes[sw ? ({ thr: 'pitch', pitch: 'thr' }[k] || k) : k]; let v = calAxis(gp, a.i); if (a.inv) v = -v;
      st[k] = stickCurve(v, k === 'thr' && RC.thrType === 'bottom' ? 0.12 : 0.07, false);
    }
    const any = Math.abs(st.thr) + Math.abs(st.yaw) + Math.abs(st.roll) + Math.abs(st.pitch) > 0.02;
    if (any) { for (const k in st) if (Math.abs(st[k]) > Math.abs(IN[k])) IN[k] = st[k]; IN.src = 'PAD'; }
    const map = { drop: 'Space', cam: 'KeyC', reset: 'KeyR' };
    for (const k in map) { const s = btnState(gp, RC.btn[k]); if (s && !padPrevBtn[k]) pressed.push(map[k]); padPrevBtn[k] = s; }
    const sb = gp.buttons[9] && gp.buttons[9].pressed; if (sb && !padPrevBtn.start) pressed.push('Escape'); padPrevBtn.start = sb;
    if (gp.buttons[6] && gp.buttons[6].value > 0.4 && SET.diff !== 'atti') IN.boost = true;
    if (gp.mapping === 'standard') {   // Xbox / 표준 배치 추가 버튼
      const ex = { rt: [7, 'Space'], lb: [4, 'PadLB'], rb: [5, 'PadRB'], x: [2, 'KeyH'], back: [8, 'KeyG'], rs: [11, 'KeyL'], ls: [10, 'Digit0'], up: [12, 'PadUp'], down: [13, 'PadDown'], left: [14, 'PadLeft'], right: [15, 'PadRight'], a: [0, 'PadA'] };
      for (const k in ex) { const bt = gp.buttons[ex[k][0]]; const s = !!(bt && (bt.pressed || bt.value > 0.5)); if (s && !padPrevBtn['x' + k]) pressed.push(ex[k][1]); padPrevBtn['x' + k] = s; }
    }
  }
  if (XR_ON) xrInput(dt);   // VR 컨트롤러 스틱
}
const RCUI = { open: false };
// 진동 피드백: 게임패드(Xbox 등 dual-rumble) · VR 컨트롤러 · 휴대폰. 세기 설정 SET.rumble 0 끔 · 1 보통(이벤트만) · 2 강(모터·바람 상시 진동 포함)
const RUM = { t: 0, lvl: 0 };
function rumbleK() { const v = SET.rumble; return v == null ? 1 : +v; }
function rumble(strong, weak, ms) {
  const k = rumbleK(); if (!k) return; const sc = k >= 2 ? 1 : 0.8; strong = Math.min(1, strong * sc); weak = Math.min(1, weak * sc);
  try { if (TOUCH.on && navigator.vibrate) navigator.vibrate(Math.round((ms || 180) * Math.max(strong, weak) * 0.6)); } catch (e) { }
  try { const gp = getPad(); const va = gp && gp.vibrationActuator; if (va && va.playEffect) va.playEffect('dual-rumble', { duration: ms || 180, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { }
  try { if (typeof XR !== 'undefined' && XR.sess) for (const src of XR.sess.inputSources) { const h = src.gamepad && src.gamepad.hapticActuators && src.gamepad.hapticActuators[0]; if (h && h.pulse) h.pulse(Math.max(strong, weak), ms || 180); } } catch (e) { }
}
// 상시 진동 (강 설정): 높은 스로틀·부스트·고속 바람 → 약한 모터 진동 (100 ms 마다 갱신)
function rumbleTick(dt) {
  if (rumbleK() < 2 || S.state !== 'run' || !DR.alive) return;
  RUM.t -= dt; if (RUM.t > 0) return; RUM.t = 0.1;
  const sp = Math.hypot(DR.v.x, DR.v.z), thr = DR.thrust || 0, boost = S.boosting ? 0.35 : 0;
  const weak = Math.min(0.6, Math.max(0, thr - 0.6) * 0.8 + sp / 60 * 0.3 + boost), strong = Math.min(0.4, boost * 0.6 + Math.max(0, sp - 25) / 40);
  if (weak < 0.04 && strong < 0.04) return;
  try { const gp = getPad(); const va = gp && gp.vibrationActuator; if (va && va.playEffect) va.playEffect('dual-rumble', { duration: 130, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { }
}
