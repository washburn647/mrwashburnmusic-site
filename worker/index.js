/* The site's only server code: a locked box for each private student.
   Everything in a box is encrypted in the browser with a key made from the student's code
   (see /lesson/locked.js), so nothing stored here can be read on this side. A box is found
   by an id made from the same code; the code itself never reaches this server.

   GET    /api/s/:id            the student's pages             (anyone with the code)
   POST   /api/s/:id/r          add a practice result           (X-Token from the code)
   PUT    /studio/api/s/:id     publish the student's pages     (Kyle, through Cloudflare Access)
   GET    /studio/api/s/:id/r   the student's practice results (Kyle)
   DELETE /studio/api/s/:id     empty the box                   (Kyle)

   Studio calls are checked against the Cloudflare Access token as well as being behind
   Access: set ACCESS_TEAM (the team name in <team>.cloudflareaccess.com) and ACCESS_AUD
   (the Access application's audience tag) in the Worker's settings. */

import { DurableObject } from 'cloudflare:workers';

const ID = /^[0-9a-f]{32}$/;
const MAX_PAGE = 8 * 1024 * 1024;   // encrypted pages, pieces included
const MAX_RESULT = 16 * 1024;
const MAX_RESULTS = 5000;
const CHUNK = 1024 * 1024;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const fail = (status, error) => json({ error }, status);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = /^\/(studio\/)?api\/s\/([^/]+)(\/r)?$/.exec(url.pathname);
    if (!m) return env.ASSETS.fetch(request);
    const [, studio, id, results] = m;
    if (!ID.test(id)) return fail(404, 'not found');
    if (studio && !(await fromKyle(request, env))) return fail(403, 'forbidden');
    const box = env.BOXES.get(env.BOXES.idFromName(id));
    const method = request.method;

    if (!studio && !results && method === 'GET') return box.read();
    if (!studio && results && method === 'POST') {
      const body = await request.text();
      if (body.length > MAX_RESULT) return fail(413, 'too big');
      return box.add(request.headers.get('X-Token') || '', body);
    }
    if (studio && !results && method === 'PUT') {
      const body = await request.text();
      if (body.length > MAX_PAGE) return fail(413, 'too big');
      return box.publish(body);
    }
    if (studio && results && method === 'GET') return box.results();
    if (studio && !results && method === 'DELETE') return box.clear();
    return fail(405, 'method not allowed');
  },
};

/* ---------- Is it Kyle? (a valid Cloudflare Access token for this site) ---------- */

let certs = null;
async function fromKyle(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_TEAM || !env.ACCESS_AUD) return false;
  const [head, body, sig] = token.split('.');
  if (!sig) return false;
  try {
    const header = JSON.parse(b64text(head));
    const claims = JSON.parse(b64text(body));
    const auds = [].concat(claims.aud);
    if (!auds.includes(env.ACCESS_AUD) || !(claims.exp * 1000 > Date.now())) return false;
    if (claims.iss !== `https://${env.ACCESS_TEAM}.cloudflareaccess.com`) return false;
    certs ||= fetch(`https://${env.ACCESS_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`).then((r) => r.json());
    const jwk = (await certs).keys.find((k) => k.kid === header.kid);
    if (!jwk) { certs = null; return false; }
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64bytes(sig), new TextEncoder().encode(`${head}.${body}`));
  } catch {
    return false;
  }
}

function b64bytes(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const b64text = (s) => new TextDecoder().decode(b64bytes(s));

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- One box per student ---------- */

export class Box extends DurableObject {
  // page: { iv, ct, token } as published; ct is split into chunks of stored text.
  async read() {
    const meta = await this.ctx.storage.get('meta');
    if (!meta) return fail(404, 'not found');
    const parts = await this.ctx.storage.get([...Array(meta.chunks).keys()].map((i) => `page:${i}`));
    let ct = '';
    for (let i = 0; i < meta.chunks; i++) ct += parts.get(`page:${i}`) || '';
    return json({ iv: meta.iv, ct, at: meta.at });
  }

  async publish(text) {
    let page;
    try { page = JSON.parse(text); } catch { return fail(400, 'bad page'); }
    if (typeof page.iv !== 'string' || typeof page.ct !== 'string' || !/^[0-9a-f]{64}$/.test(page.token || '')) return fail(400, 'bad page');
    const old = await this.ctx.storage.get('meta');
    const chunks = Math.ceil(page.ct.length / CHUNK) || 1;
    const put = {};
    for (let i = 0; i < chunks; i++) put[`page:${i}`] = page.ct.slice(i * CHUNK, (i + 1) * CHUNK);
    put.meta = { iv: page.iv, chunks, token: page.token, at: Date.now() };
    await this.ctx.storage.put(put);
    if (old && old.chunks > chunks) await this.ctx.storage.delete([...Array(old.chunks - chunks).keys()].map((i) => `page:${chunks + i}`));
    return json({ ok: true });
  }

  async add(token, text) {
    const meta = await this.ctx.storage.get('meta');
    if (!meta || meta.token !== await sha256(token)) return fail(403, 'forbidden');
    let r;
    try { r = JSON.parse(text); } catch { return fail(400, 'bad result'); }
    if (typeof r.iv !== 'string' || typeof r.ct !== 'string') return fail(400, 'bad result');
    const count = (await this.ctx.storage.get('count')) || 0;
    if (count >= MAX_RESULTS) return fail(507, 'full');
    const key = `r:${String(Date.now()).padStart(15, '0')}:${crypto.randomUUID().slice(0, 8)}`;
    await this.ctx.storage.put({ [key]: { iv: r.iv, ct: r.ct }, count: count + 1 });
    return json({ ok: true });
  }

  async results() {
    const list = await this.ctx.storage.list({ prefix: 'r:' });
    return json({ results: [...list.values()] });
  }

  async clear() {
    await this.ctx.storage.deleteAll();
    return json({ ok: true });
  }
}
