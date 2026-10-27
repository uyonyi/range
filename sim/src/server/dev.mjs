// 랭킹 서버 로컬 시험: worker.js 를 그대로 node 로 실행 (D1 대신 node:sqlite)
//   node server/dev.mjs [포트=8790]   · DB=파일.sqlite 로 저장 (기본: 메모리, 끄면 사라짐)
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import worker from './worker.js';
const PORT = +(process.argv[2] || process.env.PORT || 8790), sq = new DatabaseSync(process.env.DB || ':memory:');
const plain = r => r ? Object.assign({}, r) : null;
class Stmt {   // D1 의 prepare/bind/first/all/run 흉내 (?1 ?2 … 번호 자리 그대로)
  constructor(sql, args) { this.sql = sql; this.args = args || []; }
  bind(...a) { return new Stmt(this.sql, a); }
  async first() { return plain(sq.prepare(this.sql).get(...this.args)); }
  async all() { return { success: true, results: sq.prepare(this.sql).all(...this.args).map(plain), meta: {} }; }
  async run() { const r = sq.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
}
const DB = {
  prepare: s => new Stmt(s),
  batch: async L => { sq.exec('BEGIN'); try { const o = []; for (const s of L) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } },
};
http.createServer(async (req, res) => {
  const ch = []; for await (const c of req) ch.push(c);
  const r = new Request('http://localhost:' + PORT + req.url, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(ch) });
  const out = await worker.fetch(r, { DB });
  res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(Buffer.from(await out.arrayBuffer()));
}).listen(PORT, () => console.log('fpv-rank dev server http://localhost:' + PORT));
