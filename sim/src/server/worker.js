// FPV Terrain Trainer — 조종사 로그인 · 점수 · 랭킹 API (Cloudflare Worker + D1)
//
//  필요한 연결은 하나: D1 데이터베이스를 변수 이름 DB 로 바인딩 (표·비밀값은 처음 요청 때 스스로 만듦)
//  웹(GitHub Pages)과 나중의 앱이 같은 주소를 씀 · 비밀번호(4자리)는 서버 비밀값으로 해시해 저장 · 5번 틀리면 10분 잠금
//
//  GET  /                       → 상태
//  GET  /check?name=이름         → { ok, err?, taken }           (쓸 수 있는 이름인지)
//  POST /register {name, pin}    → { ok, name, token }            (새 조종사)
//  POST /login    {name, pin}    → { ok, name, token }
//  POST /score    {token, kind, score, grade, time, diff, af} → { ok, best, rank }
//  GET  /rank?kind=course&limit=50 → { ok, list: [{ name, score, grade, time, diff, af, at, runs }] }
//  GET  /kinds                   → { ok, kinds: [{ kind, n }] }   (기록이 있는 코스·임무)

const VER = 1;

// ---- 이름 검사 (웹 페이지와 같은 규칙: game6r.js) ----
const BAD_KO = ['시발', '씨발', '씨바', '시바', '씨빨', '시빨', '쉬발', '쓰발', '씌발', '싸발', '좆', '좃', '씹', '존나', '졸라', '병신', '븅신', '빙신', '등신', '지랄', '염병', '옘병', '개새', '개색', '개섹', '개세', '새끼', '섀끼', '쌔끼', '새기', '미친놈', '미친년', '미친새', '닥쳐', '꺼져', '엠창', '애미', '니미', '느금', '니엄마', '니애미', '창녀', '걸레년', '보지', '자지', '섹스', '쎅스', '성교', '강간', '자위', '딸딸이', '야동', '쌍놈', '쌍년', '호로', '후장', '틀딱', '한남충', '김치녀', '된장녀', '맘충', '급식충', '메갈', '일베', '홍어', '짱깨', '쪽바리', '깜둥', '나치', '히틀러', '자살', '살인', '테러', '마약', '필로폰', '대마초', '도박'];
const BAD_EN = ['fuck', 'fuk', 'fck', 'phuck', 'shit', 'bitch', 'bastard', 'asshole', 'dickhead', 'cunt', 'pussy', 'porn', 'rape', 'nigg', 'faggot', 'fagot', 'retard', 'slut', 'whore', 'nazi', 'hitler', 'cocksuck', 'motherf', 'jerkoff', 'wank', 'penis', 'vagina', 'boob', 'suicide', 'terror'];
const RESERVED = ['admin', 'administrator', 'root', 'system', 'moderator', 'operator', 'staff', 'official', 'control', 'guest', 'null', 'undefined', 'test', '관리자', '운영자', '운영진', '시스템', '공식', '손님', '게스트', '컨트롤', '관제'];
function nameNorm(s) { return String(s || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim(); }
function nameKey(s) { return nameNorm(s).toLowerCase().replace(/[\s_\-.]/g, ''); }   // 중복 확인용 (띄어쓰기·밑줄·대소문자 무시)
function nameCheck(raw) {
  const name = nameNorm(raw), n = [...name].length;
  if (n < 2 || n > 12) return { ok: false, err: 'len' };
  if (!/^[가-힣a-zA-Z0-9 _\-]+$/.test(name)) return { ok: false, err: 'chars' };
  if (/^[0-9 _\-]+$/.test(name)) return { ok: false, err: 'chars' };
  const ko = name.replace(/[^가-힣]/g, '');
  const en = name.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
  const en2 = name.toLowerCase().replace(/[^a-z]/g, '');
  if (BAD_KO.some(w => ko.includes(w)) || BAD_EN.some(w => en.includes(w.replace(/(.)\1+/g, '$1')) || en2.includes(w))) return { ok: false, err: 'word' };
  const k = nameKey(name); if (RESERVED.some(w => k === w || k.startsWith(w) && w.length >= 4)) return { ok: false, err: 'reserved' };
  return { ok: true, name, key: k };
}

// ---- 도움 함수 ----
const J = (o, st, cors) => new Response(JSON.stringify(o), { status: st || 200, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors) });
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = s => new TextEncoder().encode(s);
async function hmac(secret, msg) { const k = await crypto.subtle.importKey('raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64u(await crypto.subtle.sign('HMAC', k, enc(msg))); }
function rnd(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64u(a); }
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

let READY = null;   // 표·비밀값 준비 (워커가 살아 있는 동안 한 번)
async function setup(db) {
  if (READY) return READY;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS players (nkey TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL, fails INTEGER NOT NULL DEFAULT 0, lock_until INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE TABLE IF NOT EXISTS best (nkey TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, score INTEGER NOT NULL, grade TEXT, time REAL, diff TEXT, af TEXT, at INTEGER NOT NULL, runs INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (nkey, kind))'),
    db.prepare('CREATE INDEX IF NOT EXISTS best_rank ON best (kind, score DESC, time ASC)'),
  ]);
  let row = await db.prepare("SELECT v FROM meta WHERE k = 'secret'").first();
  if (!row) { await db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('secret', ?1)").bind(rnd(32)).run(); row = await db.prepare("SELECT v FROM meta WHERE k = 'secret'").first(); }
  READY = { secret: row.v }; return READY;
}
async function tokenFor(secret, key) { const p = b64u(enc(JSON.stringify({ k: key, t: Date.now() }))); return p + '.' + await hmac(secret, p); }
async function tokenKey(secret, tok) {
  const [p, s] = String(tok || '').split('.'); if (!p || !s || !same(s, await hmac(secret, p))) return null;
  try { const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); return Date.now() - o.t < 400 * 864e5 ? o.k : null; } catch (e) { return null; }
}

export default {
  async fetch(req, env) {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.DB) return J({ ok: false, err: 'no_db', hint: 'Settings → Bindings → D1 database, variable name DB' }, 500, cors);
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/', db = env.DB;
    try {
      const { secret } = await setup(db);
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      if (path === '/') return J({ ok: true, app: 'fpv-rank', v: VER }, 200, cors);
      if (path === '/check') {
        const c = nameCheck(url.searchParams.get('name')); if (!c.ok) return J(c, 200, cors);
        const t = await db.prepare('SELECT 1 FROM players WHERE nkey = ?1').bind(c.key).first(); return J({ ok: !t, err: t ? 'taken' : undefined, taken: !!t }, 200, cors);
      }
      if (path === '/register') {
        const c = nameCheck(body.name); if (!c.ok) return J(c, 200, cors);
        if (!/^\d{4}$/.test(String(body.pin || ''))) return J({ ok: false, err: 'pin' }, 200, cors);
        const salt = rnd(12), hash = await hmac(secret, salt + ':' + body.pin);
        const r = await db.prepare('INSERT OR IGNORE INTO players (nkey, name, salt, hash, created) VALUES (?1, ?2, ?3, ?4, ?5)').bind(c.key, c.name, salt, hash, Date.now()).run();
        if (!r.meta || !r.meta.changes) return J({ ok: false, err: 'taken' }, 200, cors);
        return J({ ok: true, name: c.name, token: await tokenFor(secret, c.key) }, 200, cors);
      }
      if (path === '/login') {
        const key = nameKey(body.name), p = await db.prepare('SELECT * FROM players WHERE nkey = ?1').bind(key).first();
        if (!p) return J({ ok: false, err: 'no_user' }, 200, cors);
        const now = Date.now(); if (p.lock_until > now) return J({ ok: false, err: 'locked', wait: Math.ceil((p.lock_until - now) / 1000) }, 200, cors);
        if (!same(await hmac(secret, p.salt + ':' + String(body.pin || '')), p.hash)) {
          const f = p.fails + 1; await db.prepare('UPDATE players SET fails = ?2, lock_until = ?3 WHERE nkey = ?1').bind(key, f >= 5 ? 0 : f, f >= 5 ? now + 10 * 60e3 : 0).run();
          return J({ ok: false, err: f >= 5 ? 'locked' : 'wrong', left: Math.max(0, 5 - f), wait: f >= 5 ? 600 : 0 }, 200, cors);
        }
        if (p.fails) await db.prepare('UPDATE players SET fails = 0, lock_until = 0 WHERE nkey = ?1').bind(key).run();
        return J({ ok: true, name: p.name, token: await tokenFor(secret, key) }, 200, cors);
      }
      if (path === '/score') {
        const key = await tokenKey(secret, body.token); if (!key) return J({ ok: false, err: 'token' }, 200, cors);
        const p = await db.prepare('SELECT name FROM players WHERE nkey = ?1').bind(key).first(); if (!p) return J({ ok: false, err: 'no_user' }, 200, cors);
        const kind = String(body.kind || ''), score = Math.round(+body.score), time = +body.time;
        if (!/^[a-z0-9_]{2,20}$/.test(kind) || !(score >= 0 && score <= 100) || !(time > 0 && time < 7200)) return J({ ok: false, err: 'bad' }, 200, cors);
        const grade = String(body.grade || '').slice(0, 2), diff = String(body.diff || '').replace(/[^a-z]/g, '').slice(0, 8), af = String(body.af || '').replace(/[^a-z0-9]/g, '').slice(0, 8), now = Date.now();
        const old = await db.prepare('SELECT score, time FROM best WHERE nkey = ?1 AND kind = ?2').bind(key, kind).first();
        const better = !old || score > old.score || (score === old.score && time < old.time);
        if (!old) await db.prepare('INSERT INTO best (nkey, kind, name, score, grade, time, diff, af, at, runs) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1)').bind(key, kind, p.name, score, grade, time, diff, af, now).run();
        else if (better) await db.prepare('UPDATE best SET score = ?3, grade = ?4, time = ?5, diff = ?6, af = ?7, at = ?8, runs = runs + 1, name = ?9 WHERE nkey = ?1 AND kind = ?2').bind(key, kind, score, grade, time, diff, af, now, p.name).run();
        else await db.prepare('UPDATE best SET runs = runs + 1 WHERE nkey = ?1 AND kind = ?2').bind(key, kind).run();
        const b = await db.prepare('SELECT score, time FROM best WHERE nkey = ?1 AND kind = ?2').bind(key, kind).first();
        const r = await db.prepare('SELECT COUNT(*) AS n FROM best WHERE kind = ?1 AND (score > ?2 OR (score = ?2 AND time < ?3))').bind(kind, b.score, b.time).first();
        return J({ ok: true, best: better, rank: (r ? r.n : 0) + 1 }, 200, cors);
      }
      if (path === '/rank') {
        const kind = String(url.searchParams.get('kind') || 'course'), lim = Math.max(1, Math.min(100, +url.searchParams.get('limit') || 50));
        const L = await db.prepare('SELECT name, score, grade, time, diff, af, at, runs FROM best WHERE kind = ?1 ORDER BY score DESC, time ASC LIMIT ?2').bind(kind, lim).all();
        return J({ ok: true, kind, list: L.results || [] }, 200, cors);
      }
      if (path === '/kinds') {
        const L = await db.prepare('SELECT kind, COUNT(*) AS n FROM best GROUP BY kind ORDER BY n DESC').all();
        return J({ ok: true, kinds: L.results || [] }, 200, cors);
      }
      return J({ ok: false, err: 'not_found' }, 404, cors);
    } catch (e) { return J({ ok: false, err: 'server', msg: String(e && e.message || e).slice(0, 200) }, 500, cors); }
  }
};
