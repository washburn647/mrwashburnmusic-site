/* The site is static files. This Worker only answers /api/:
   - /api/class/: the Class app's files kept on the website (decks, pictures, plans,
     timings) in a private R2 bucket. Cloudflare Access guards /api/class (Kyle's login),
     and every request is checked here too, so a missing Access rule never opens it up.
   - /api/s/ and /studio/api/s/: a locked box for each private lesson student (see Box).
   - /api/live/ and /studio/api/live/: what Kyle publishes from the studio straight to the
     site (grooves, game options, voice takes, units), read by the games and lessons (see Live).

   wrangler.jsonc sets ACCESS_TEAM (the Zero Trust team domain) and ACCESS_AUD
   (the Access application's Audience tag). */

import { DurableObject } from 'cloudflare:workers';

const KINDS = new Set(['decks', 'plans']);
const ID = /^[\w.-]{1,80}$/;
const HASH = /^[0-9a-f]{16,128}$/;
const TIMINGS = /^[\w-]{1,80}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const box = /^\/(studio\/)?api\/s\/([^/]+)(\/r)?$/.exec(url.pathname);
    if (box) return boxApi(request, env, box);
    const live = /^\/(studio\/)?api\/live\/(.+)$/.exec(url.pathname);
    if (live) return liveApi(request, env, !!live[1], live[2]);
    if (!url.pathname.startsWith('/api/class/')) return env.ASSETS.fetch(request);
    if (!env.ACCESS_TEAM || !env.ACCESS_AUD || !env.CLASS_FILES) return reply({ error: 'not set up' }, 503);
    if (!(await signedIn(request, env))) return reply({ error: 'sign in' }, 401);
    try {
      return await classApi(request, env, url.pathname.slice('/api/class/'.length).split('/'));
    } catch (err) {
      return reply({ error: String(err && err.message || err) }, 500);
    }
  }
};

async function classApi(request, env, [what, id, extra]) {
  const bucket = env.CLASS_FILES;
  const method = request.method;
  if (extra !== undefined) return reply({ error: 'not found' }, 404);

  // Access sends you here after its login page; go back to the app.
  if (what === 'login' && !id) return Response.redirect(new URL('/class/', request.url).href, 302);

  if (what === 'state' && !id && method === 'GET') {
    const out = { decks: {}, plans: {}, media: [], timings: [] };
    for (const kind of KINDS) {
      for (const o of await listAll(bucket, kind + '/')) {
        const m = o.customMetadata || {};
        out[kind][o.key.slice(kind.length + 1)] = { u: Number(m.u) || 0, gone: m.gone === '1', name: m.n || '' };
      }
    }
    out.media = (await listAll(bucket, 'media/', false)).map((o) => o.key.slice(6));
    out.timings = (await listAll(bucket, 'timings/', false)).map((o) => o.key.slice(8));
    return reply(out);
  }

  if (KINDS.has(what) && id && ID.test(id)) {
    const key = what + '/' + id;
    if (method === 'GET') {
      const o = await bucket.get(key);
      if (!o || (o.customMetadata || {}).gone === '1') return reply({ error: 'not found' }, 404);
      return new Response(o.body, { headers: headers({ 'Content-Type': 'application/json' }) });
    }
    if (method === 'PUT' || method === 'DELETE') {
      // base: the version the device last had. Someone else saved since: 409, and the device sorts it out.
      const params = new URL(request.url).searchParams;
      const u = Number(params.get('u'));
      if (!u) return reply({ error: 'u needed' }, 400);
      const now = await bucket.head(key);
      const have = now ? Number((now.customMetadata || {}).u) || 0 : 0;
      if (have && String(have) !== params.get('base')) return reply({ u: have }, 409);
      if (method === 'DELETE') {
        await bucket.put(key, '', { customMetadata: { u: String(u), gone: '1' } });
      } else {
        const body = await request.text();
        const name = String(JSON.parse(body).name || '').slice(0, 200);
        await bucket.put(key, body, { httpMetadata: { contentType: 'application/json' }, customMetadata: { u: String(u), n: name } });
      }
      return reply({ u });
    }
  }

  if (what === 'media' && id && HASH.test(id)) {
    const key = 'media/' + id;
    if (method === 'GET') {
      const o = await bucket.get(key);
      if (!o) return reply({ error: 'not found' }, 404);
      const m = o.customMetadata || {};
      return new Response(o.body, { headers: headers({
        'Content-Type': (o.httpMetadata && o.httpMetadata.contentType) || 'application/octet-stream',
        'X-Rights': m.rights || 'classroom', 'X-Name': m.name || '' }) });
    }
    if (method === 'PUT') {
      // Pictures are named by a hash of their bytes, so one already there is the same picture.
      if (await bucket.head(key)) return reply({ ok: true });
      await bucket.put(key, await request.arrayBuffer(), {
        httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' },
        customMetadata: { rights: (request.headers.get('X-Rights') || 'classroom').slice(0, 40),
                          name: (request.headers.get('X-Name') || '').slice(0, 200) } });
      return reply({ ok: true });
    }
  }

  // Timings come in batches, one file per upload, never changed after.
  if (what === 'timings' && id && TIMINGS.test(id)) {
    const key = 'timings/' + id;
    if (method === 'GET') {
      const o = await bucket.get(key);
      return o ? new Response(o.body, { headers: headers({ 'Content-Type': 'application/json' }) }) : reply({ error: 'not found' }, 404);
    }
    if (method === 'PUT') {
      const body = await request.text();
      if (!Array.isArray(JSON.parse(body))) return reply({ error: 'list needed' }, 400);
      await bucket.put(key, body, { httpMetadata: { contentType: 'application/json' } });
      return reply({ ok: true });
    }
  }

  return reply({ error: 'not found' }, 404);
}

async function listAll(bucket, prefix, meta = true) {
  const out = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000, include: meta ? ['customMetadata'] : [] });
    out.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

function headers(extra) {
  return { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', ...extra };
}

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers({ 'Content-Type': 'application/json' }) });
}

// ---- Cloudflare Access ------------------------------------------------------

let keyCache = null;                       // { team, at, keys }

async function accessKeys(team, fresh) {
  if (!fresh && keyCache && keyCache.team === team && Date.now() - keyCache.at < 3600e3) return keyCache.keys;
  const res = await fetch('https://' + team + '/cdn-cgi/access/certs');
  if (!res.ok) throw new Error('Access keys: ' + res.status);
  keyCache = { team, at: Date.now(), keys: (await res.json()).keys || [] };
  return keyCache.keys;
}

const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const part = (s) => JSON.parse(new TextDecoder().decode(b64(s)));

/** The Access login token on the request is genuine, current and for this application. */
export async function signedIn(request, env, keys = accessKeys) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return false;
  const team = String(env.ACCESS_TEAM).replace(/^https?:\/\//, '').replace(/\/+$/, '');
  try {
    const [h, p, s] = token.split('.');
    const head = part(h), body = part(p);
    if (head.alg !== 'RS256') return false;
    let jwk = (await keys(team)).find((k) => k.kid === head.kid);
    if (!jwk) jwk = (await keys(team, true)).find((k) => k.kid === head.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(s), new TextEncoder().encode(h + '.' + p));
    const now = Date.now() / 1000;
    const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
    return ok && aud.includes(env.ACCESS_AUD) && body.iss === 'https://' + team &&
      typeof body.exp === 'number' && body.exp > now && !(body.nbf > now + 60);
  } catch (e) {
    return false;
  }
}

// ---- Lesson students ----------------------------------------------------------

/* Lesson students: a locked box for each private student.
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

const BOX_ID = /^[0-9a-f]{32}$/;
const MAX_PAGE = 8 * 1024 * 1024;   // encrypted pages, pieces included
const MAX_RESULT = 16 * 1024;
const MAX_RESULTS = 5000;
const CHUNK = 1024 * 1024;


async function boxApi(request, env, [, studio, id, results]) {
  if (!BOX_ID.test(id)) return reply({ error: 'not found' }, 404);
  if (studio && !(env.ACCESS_TEAM && env.ACCESS_AUD && await signedIn(request, env))) return reply({ error: 'sign in' }, 401);
  const box = env.BOXES.get(env.BOXES.idFromName(id));
  const method = request.method;
  if (!studio && !results && method === 'GET') return box.read();
  if (!studio && results && method === 'POST') {
    const body = await request.text();
    if (body.length > MAX_RESULT) return reply({ error: 'too big' }, 413);
    return box.add(request.headers.get('X-Token') || '', body);
  }
  if (studio && !results && method === 'PUT') {
    const body = await request.text();
    if (body.length > MAX_PAGE) return reply({ error: 'too big' }, 413);
    return box.publish(body);
  }
  if (studio && results && method === 'GET') return box.results();
  if (studio && !results && method === 'DELETE') return box.clear();
  return reply({ error: 'method not allowed' }, 405);
}

// ---- Published from the studio ------------------------------------------------

/* Live: what Kyle publishes from the studio, so it reaches the site without a new deploy.
   One Durable Object holds it all. Anyone can read it (it's what the public games play);
   only Kyle can change it.

   GET  /api/live/grooves.json              Groove Lab's grooves (musician-maker/grooves.json's shape)
   GET  /api/live/games.json                the game workshop's options (musician-maker/games.json's shape)
   GET  /api/live/units.json                the voice recorder's units (assets/patterns/units.json's shape)
   GET  /api/live/voice/:voice.json         a voice's takes (index.json "voices" entry's shape)
   GET  /api/live/voice/:voice/:take.mp3    one take
   PUT  /studio/api/live/grooves            publish the grooves                       (Kyle)
   PUT  /studio/api/live/games              publish the game options                  (Kyle)
   GET  /studio/api/live/voice/:voice       ids of the takes already uploaded         (Kyle)
   PUT  /studio/api/live/voice/:voice/:take.mp3   upload a take                       (Kyle)
   PUT  /studio/api/live/voice/:voice       publish the take list and units; takes it
                                            no longer lists are deleted               (Kyle)

   The site falls back to the files in the repo when nothing is published here, and
   tools/pull_live.py copies what is published back into the repo. */

const VOICE = /^[a-z0-9]{1,20}$/;
const TAKE = /^[0-9a-f-]{8,40}$/;
const MAX_TEXT = 4 * 1024 * 1024;
const MAX_TAKE = 1.5 * 1024 * 1024;   // one stored value; takes are a few seconds of 24 kHz mono

function liveHeaders(type, cache = 'no-cache') {
  return { 'Content-Type': type, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
}

async function liveApi(request, env, studio, path) {
  const method = request.method;
  if (studio && !(env.ACCESS_TEAM && env.ACCESS_AUD && await signedIn(request, env))) return reply({ error: 'sign in' }, 401);
  const live = env.LIVE.get(env.LIVE.idFromName('site'));
  let m;
  if (!studio) {
    if (method !== 'GET' && method !== 'HEAD') return reply({ error: 'method not allowed' }, 405);
    if (path === 'grooves.json') return live.text('grooves');
    if (path === 'units.json') return live.text('units');
    if (path === 'games.json') return live.text('games');
    if ((m = /^voice\/([^/]+)\.json$/.exec(path)) && VOICE.test(m[1])) return live.text('voice:' + m[1]);
    if ((m = /^voice\/([^/]+)\/([^/]+)\.mp3$/.exec(path)) && VOICE.test(m[1]) && TAKE.test(m[2])) return live.take(m[1], m[2]);
    return reply({ error: 'not found' }, 404);
  }
  if (path === 'grooves' && method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_TEXT) return reply({ error: 'too big' }, 413);
    let data;
    try { data = JSON.parse(text); } catch { return reply({ error: 'not JSON' }, 400); }
    const list = data && data.grooves;
    if (!Array.isArray(list) || !list.length || !list.every((g) => g && typeof g === 'object' && typeof g.id === 'string')) {
      return reply({ error: 'no grooves' }, 400);
    }
    return live.putText('grooves', text);
  }
  if (path === 'games' && method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_TEXT) return reply({ error: 'too big' }, 413);
    let data;
    try { data = JSON.parse(text); } catch { return reply({ error: 'not JSON' }, 400); }
    const games = data && data.games;
    if (!games || typeof games !== 'object' || Array.isArray(games) || !Object.keys(games).length) return reply({ error: 'no games' }, 400);
    return live.putText('games', text);
  }
  if ((m = /^voice\/([^/]+)$/.exec(path)) && VOICE.test(m[1])) {
    if (method === 'GET') return live.takeIds(m[1]);
    if (method === 'PUT') {
      const text = await request.text();
      if (text.length > MAX_TEXT) return reply({ error: 'too big' }, 413);
      return live.putVoice(m[1], text);
    }
  }
  if ((m = /^voice\/([^/]+)\/([^/]+)\.mp3$/.exec(path)) && VOICE.test(m[1]) && TAKE.test(m[2]) && method === 'PUT') {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_TAKE) return reply({ error: 'too big' }, 413);
    const b = new Uint8Array(bytes, 0, Math.min(3, bytes.byteLength));
    const mp3 = b.length === 3 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0));
    if (!mp3) return reply({ error: 'not an mp3' }, 400);
    return live.putTake(m[1], m[2], bytes);
  }
  return reply({ error: 'not found' }, 404);
}

export class Live extends DurableObject {
  // text:<name> → { chunks, at }, text:<name>:<i> → a piece of it (names: grooves, games, units, voice:<voice>)
  // takes:<voice> → [take ids], take:<voice>:<id> → the mp3's bytes
  async text(name) {
    const meta = await this.ctx.storage.get(`text:${name}`);
    if (!meta) return reply({ error: 'not published' }, 404);
    const parts = await this.ctx.storage.get([...Array(meta.chunks).keys()].map((i) => `text:${name}:${i}`));
    let text = '';
    for (let i = 0; i < meta.chunks; i++) text += parts.get(`text:${name}:${i}`) || '';
    return new Response(text, { headers: { ...liveHeaders('application/json'), 'Last-Modified': new Date(meta.at).toUTCString() } });
  }

  async putText(name, text) {
    const old = await this.ctx.storage.get(`text:${name}`);
    const chunks = Math.ceil(text.length / CHUNK) || 1;
    const put = {};
    for (let i = 0; i < chunks; i++) put[`text:${name}:${i}`] = text.slice(i * CHUNK, (i + 1) * CHUNK);
    put[`text:${name}`] = { chunks, at: Date.now() };
    await this.ctx.storage.put(put);
    if (old && old.chunks > chunks) await this.ctx.storage.delete([...Array(old.chunks - chunks).keys()].map((i) => `text:${name}:${chunks + i}`));
    return reply({ ok: true, at: put[`text:${name}`].at });
  }

  async takeIds(voice) {
    return reply({ takes: (await this.ctx.storage.get(`takes:${voice}`)) || [] });
  }

  async take(voice, id) {
    const bytes = await this.ctx.storage.get(`take:${voice}:${id}`);
    if (!bytes) return reply({ error: 'not found' }, 404);
    // A take's id names one recording, never changed after.
    return new Response(bytes, { headers: liveHeaders('audio/mpeg', 'public, max-age=31536000, immutable') });
  }

  async putTake(voice, id, bytes) {
    const ids = (await this.ctx.storage.get(`takes:${voice}`)) || [];
    if (!ids.includes(id)) ids.push(id);
    await this.ctx.storage.put({ [`take:${voice}:${id}`]: bytes, [`takes:${voice}`]: ids });
    return reply({ ok: true });
  }

  /* list: { label, patterns: { id: [{ take, speed, bpm, key?, as? }] }, cues: { id: [{ take, speed, bpm }] }, units? }
     Every take it names must be uploaded already. */
  async putVoice(voice, text) {
    let list;
    try { list = JSON.parse(text); } catch { return reply({ error: 'not JSON' }, 400); }
    const have = new Set((await this.ctx.storage.get(`takes:${voice}`)) || []);
    const used = new Set();
    const missing = [];
    const files = (groups) => {
      const out = {};
      for (const [id, options] of Object.entries(groups && typeof groups === 'object' ? groups : {})) {
        if (!Array.isArray(options)) continue;
        out[id] = options.filter((o) => o && TAKE.test(o.take || '')).map((o) => {
          if (!have.has(o.take)) missing.push(o.take);
          used.add(o.take);
          const entry = { file: `/api/live/voice/${voice}/${o.take}.mp3`, speed: String(o.speed || ''), bpm: Number(o.bpm) || 0 };
          if (o.as === 'bum') entry.as = 'bum';
          if (typeof o.key === 'number') entry.key = o.key;
          return entry;
        });
      }
      return out;
    };
    const spec = { label: String(list.label || voice).slice(0, 80), patterns: files(list.patterns), cues: files(list.cues) };
    if (missing.length) return reply({ error: 'takes not uploaded', missing }, 409);
    await this.putText(`voice:${voice}`, JSON.stringify(spec));
    if (Array.isArray(list.units) && list.units.every((u) => u && typeof u.id === 'string')) {
      await this.putText('units', JSON.stringify({ units: list.units }));
    }
    const gone = [...have].filter((id) => !used.has(id));
    if (gone.length) {
      await this.ctx.storage.put(`takes:${voice}`, [...used]);
      for (let i = 0; i < gone.length; i += 100) await this.ctx.storage.delete(gone.slice(i, i + 100).map((id) => `take:${voice}:${id}`));
    }
    return reply({ ok: true, takes: used.size, deleted: gone.length });
  }
}

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class Box extends DurableObject {
  // page: { iv, ct, token } as published; ct is split into chunks of stored text.
  async read() {
    const meta = await this.ctx.storage.get('meta');
    if (!meta) return reply({ error: 'not found' }, 404);
    const parts = await this.ctx.storage.get([...Array(meta.chunks).keys()].map((i) => `page:${i}`));
    let ct = '';
    for (let i = 0; i < meta.chunks; i++) ct += parts.get(`page:${i}`) || '';
    return reply({ iv: meta.iv, ct, at: meta.at });
  }

  async publish(text) {
    let page;
    try { page = JSON.parse(text); } catch { return reply({ error: 'bad page' }, 400); }
    if (typeof page.iv !== 'string' || typeof page.ct !== 'string' || !/^[0-9a-f]{64}$/.test(page.token || '')) return reply({ error: 'bad page' }, 400);
    const old = await this.ctx.storage.get('meta');
    const chunks = Math.ceil(page.ct.length / CHUNK) || 1;
    const put = {};
    for (let i = 0; i < chunks; i++) put[`page:${i}`] = page.ct.slice(i * CHUNK, (i + 1) * CHUNK);
    put.meta = { iv: page.iv, chunks, token: page.token, at: Date.now() };
    await this.ctx.storage.put(put);
    if (old && old.chunks > chunks) await this.ctx.storage.delete([...Array(old.chunks - chunks).keys()].map((i) => `page:${chunks + i}`));
    return reply({ ok: true });
  }

  async add(token, text) {
    const meta = await this.ctx.storage.get('meta');
    if (!meta || meta.token !== await sha256(token)) return reply({ error: 'forbidden' }, 403);
    let r;
    try { r = JSON.parse(text); } catch { return reply({ error: 'bad result' }, 400); }
    if (typeof r.iv !== 'string' || typeof r.ct !== 'string') return reply({ error: 'bad result' }, 400);
    const count = (await this.ctx.storage.get('count')) || 0;
    if (count >= MAX_RESULTS) return reply({ error: 'full' }, 507);
    const key = `r:${String(Date.now()).padStart(15, '0')}:${crypto.randomUUID().slice(0, 8)}`;
    await this.ctx.storage.put({ [key]: { iv: r.iv, ct: r.ct }, count: count + 1 });
    return reply({ ok: true });
  }

  async results() {
    const list = await this.ctx.storage.list({ prefix: 'r:' });
    return reply({ results: [...list.values()] });
  }

  async clear() {
    await this.ctx.storage.deleteAll();
    return reply({ ok: true });
  }
}
