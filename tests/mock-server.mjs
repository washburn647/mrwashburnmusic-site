/* A stand-in for the website while testing Song Burner in a browser: serves the repo's files
   as they are, and answers /api/songburner/ and /api/live/ the way worker/index.js does, with
   one library per signed-in email kept in memory. The sign-in check itself (songBurnerGate)
   is tested against the real Worker in worker.test.mjs. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

export function startMock() {
  const state = { libs: {}, who: 't@example.com', log: [], delay: 0, dashOn: false };
  const server = http.createServer((q, s) => {
    const u = new URL(q.url, 'http://x');
    if (u.pathname.startsWith('/api/')) {
      let body = '';
      q.on('data', (d) => { body += d; });
      q.on('end', () => setTimeout(() => {
        state.log.push({ t: Date.now(), m: q.method, p: u.pathname, n: body.length, probe: q.headers['x-sb-probe'] || '' });
        const L = state.libs[state.who] || (state.libs[state.who] = { version: 0, lib: null });
        const j = (o, c = 200) => { s.writeHead(c, { 'Content-Type': 'application/json' }); s.end(typeof o === 'string' ? o : JSON.stringify(o)); };
        if (u.pathname === '/api/live/songburner.json') return j({ error: 'not found' }, 404);
        if (!state.who) return j({ error: 'sign in' }, 401);
        if (u.pathname === '/api/songburner/me') return j({ email: state.who });
        if (u.pathname === '/api/songburner/dashboard') return j({ on: state.dashOn });
        if (u.pathname === '/api/songburner/library') {
          if (q.method === 'GET') return j('{"version":' + L.version + ',"at":1,"library":' + (L.lib || 'null') + '}');
          if (q.method === 'PUT') {
            if (Number(q.headers['if-match']) !== L.version) return j({ error: 'changed', version: L.version }, 409);
            L.lib = body; L.version++;
            return j({ version: L.version, at: Date.now() });
          }
          if (q.method === 'DELETE') { L.lib = null; L.version = 0; return j({ ok: true }); }
        }
        if (u.pathname === '/api/songburner/signout') return j({ ok: true });
        return j({ error: 'not found' }, 404);
      }, state.delay));
      return;
    }
    if (u.pathname.startsWith('/cdn-cgi/')) { s.writeHead(302, { Location: '/songburner/' }); s.end(); return; }
    let p = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!p.startsWith(ROOT)) { s.writeHead(403); s.end(); return; }
    if (p.endsWith(path.sep)) p += 'index.html';
    fs.readFile(p, (e, d) => {
      if (e) { s.writeHead(404); s.end('not found'); return; }
      s.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      s.end(d);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const base = 'http://127.0.0.1:' + server.address().port;
    resolve({
      base, state,
      cloudSongs(email) {
        const L = state.libs[email || state.who];
        if (!L || !L.lib) return null;
        return JSON.parse(L.lib).tabs.Songs.slice(1).map((r) => String(r[1])).sort();
      },
      reset() { state.libs = {}; state.who = 't@example.com'; state.log = []; state.delay = 0; state.dashOn = false; },
      close: () => new Promise((r) => server.close(r))
    });
  }));
}
