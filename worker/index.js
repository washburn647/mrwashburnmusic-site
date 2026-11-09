/* The site is static files. This Worker only answers /api/:
   - /api/class/: the Class app's files kept on the website (decks, pictures, plans,
     timings) in a private R2 bucket. Cloudflare Access guards /api/class (Kyle's login),
     and every request is checked here too, so a missing Access rule never opens it up.
   - /api/s/ and /studio/api/s/: a locked box for each private lesson student (see Box).
   - /studio/api/lessons/: the studio's lesson pages (students, pieces, practice library), kept
     in the same private R2 bucket so every device Kyle signs in on sees them (see lessonsApi).
   - /api/live/ and /studio/api/live/: what Kyle publishes from the studio straight to the
     site (grooves, game options, voice takes, units), read by the games and lessons (see Live).
   - /api/sub/: a substitute's view of the deck Kyle picks for them, opened with a code he
     sets (see subApi). /api/class/sub is where he sets it.
   - /api/songburner/: Song Burner's cloud copy, one private library per signed-in tester,
     behind its own Cloudflare Access application (see songBurnerApi and Vault).
   - /studio/api/songburner/: the studio's view of the Song Burner testers (see songBurnerStudio).

   wrangler.jsonc sets ACCESS_TEAM (the Zero Trust team domain) and ACCESS_AUD
   (the Access application's Audience tag). */

import { DurableObject } from 'cloudflare:workers';

const KINDS = new Set(['decks', 'plans', 'library']);
const ID = /^[\w.-]{1,80}$/;
const HASH = /^[0-9a-f]{16,128}$/;
const TIMINGS = /^[\w-]{1,80}$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/studio/api/lessons/')) {
      if (!env.ACCESS_TEAM || !env.ACCESS_AUD || !env.CLASS_FILES) return reply({ error: 'not set up' }, 503);
      if (!(await signedIn(request, env))) return reply({ error: 'sign in' }, 401);
      try {
        return await lessonsApi(request, env, url.pathname.slice('/studio/api/lessons/'.length).split('/'));
      } catch (err) {
        return reply({ error: String(err && err.message || err) }, 500);
      }
    }
    const box = /^\/(studio\/)?api\/s\/([^/]+)(\/r)?$/.exec(url.pathname);
    if (box) return boxApi(request, env, box);
    const live = /^\/(studio\/)?api\/live\/(.+)$/.exec(url.pathname);
    if (live) return liveApi(request, env, !!live[1], live[2]);
    if (url.pathname === '/songburner/account/' || url.pathname === '/songburner/account/index.html') {
      return songBurnerSignIn(request, env);
    }
    if (url.pathname.startsWith('/studio/api/songburner/')) {
      if (!env.ACCESS_TEAM || !env.ACCESS_AUD || !env.VAULTS) return reply({ error: 'not set up' }, 503);
      if (!(await signedIn(request, env))) return reply({ error: 'sign in' }, 401);
      try {
        return await songBurnerStudio(request, env, url.pathname.slice('/studio/api/songburner/'.length));
      } catch (err) {
        return reply({ error: 'server error' }, 500);
      }
    }
    if (url.pathname.startsWith('/api/songburner/')) {
      try {
        return await songBurnerApi(request, env, url.pathname.slice('/api/songburner/'.length), ctx);
      } catch (err) {
        return reply({ error: 'server error' }, 500);
      }
    }
    if (url.pathname.startsWith('/api/sub/')) {
      if (!env.CLASS_FILES) return reply({ error: 'not set up' }, 503);
      try {
        return await subApi(request, env, url.pathname.slice('/api/sub/'.length).split('/'));
      } catch (err) {
        return reply({ error: 'server error' }, 500);
      }
    }
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

  if (what === 'sub' && !id) return subSetup(request, bucket);

  if (what === 'state' && !id && method === 'GET') {
    const out = { decks: {}, plans: {}, library: {}, media: [], timings: [] };
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

/* Sub view. Kyle picks a deck for a substitute and a code to open it (sub/config.json:
   { code, deck, decks: [ids of the decks it links into], key }). The sub page sends the code
   to open, and gets those decks plus `key`, a random string that fetches their pictures.
   A new code makes a new key. Wrong codes are rate limited (SUB_LIMIT, per address).
   PUT  /api/class/sub   { code, deck, decks } sets it (no code: keeps it); { code: '' } turns it off (Kyle only)
   GET  /api/class/sub   what is set (Kyle only)
   POST /api/sub/open    { code } -> { start, decks: [{ id, name, deck }], key }
   GET  /api/sub/media/<hash>   with X-Sub-Key: a picture of those decks */
const SUB = 'sub/config.json', SUB_ALLOW = 'sub/media.json';
const normCode = (c) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function readJson(bucket, key) {
  const o = await bucket.get(key);
  if (!o) return null;
  try { return JSON.parse(await o.text()); } catch (e) { return null; }
}

async function subSetup(request, bucket) {
  if (request.method === 'GET') {
    const c = await readJson(bucket, SUB);
    return reply(c && c.code ? { code: c.code, deck: c.deck, decks: c.decks } : { code: '' });
  }
  if (request.method !== 'PUT') return reply({ error: 'method not allowed' }, 405);
  const body = await request.json();
  const old = await readJson(bucket, SUB);
  // No code in the body: keep the one set (the app sends the decks again when links change).
  const code = String(body.code === undefined ? (old && old.code) || '' : body.code || '').trim().slice(0, 40);
  if (!code) {
    await bucket.delete([SUB, SUB_ALLOW]);
    return reply({ code: '' });
  }
  if (normCode(code).length < 6) return reply({ error: 'The code needs at least 6 letters or numbers.' }, 400);
  const deck = String(body.deck || '');
  const decks = [deck, ...(Array.isArray(body.decks) ? body.decks : [])].map(String).filter((d) => ID.test(d));
  if (!ID.test(deck)) return reply({ error: 'deck needed' }, 400);
  const key = old && old.key && normCode(old.code) === normCode(code) ? old.key : randomKey();
  const config = { code, deck, decks: [...new Set(decks)].slice(0, 60), key };
  await bucket.put(SUB, JSON.stringify(config), { httpMetadata: { contentType: 'application/json' } });
  if (!old || old.key !== key) await bucket.delete(SUB_ALLOW);   // the old key stops working
  return reply({ code, deck, decks: config.decks });
}

function randomKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Pictures a deck uses (the same as mediaOf in class/store.js). */
function deckMedia(deck, out) {
  const take = (f) => { if (f && f.type === 'image' && f.media) out.add(f.media); };
  for (const s of (deck && deck.slides) || []) {
    take(s.bg);
    for (const el of s.els || []) {
      if (el.media) out.add(el.media);
      if (el.pics) for (const p of el.pics) if (p && p.media) out.add(p.media);
      take(el.fill);
    }
  }
}

function sameText(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

async function subApi(request, env, [what, id, extra]) {
  const bucket = env.CLASS_FILES;
  if (what === 'open' && !id && request.method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'here';
    if (env.SUB_LIMIT && !(await env.SUB_LIMIT.limit({ key: ip })).success) {
      return reply({ error: 'Too many tries. Wait a minute and try again.' }, 429);
    }
    let code = '';
    try { code = (await request.json()).code; } catch (e) { /* no body */ }
    const c = await readJson(bucket, SUB);
    if (!c || !c.code || !normCode(code) || !sameText(normCode(code), normCode(c.code))) {
      return reply({ error: 'That code doesn\'t open anything.' }, 403);
    }
    const decks = [], media = new Set();
    for (const deckId of c.decks || [c.deck]) {
      const o = await bucket.get('decks/' + deckId);
      if (!o || (o.customMetadata || {}).gone === '1') continue;
      const rec = JSON.parse(await o.text());
      deckMedia(rec.deck, media);
      decks.push({ id: rec.id, name: rec.name, deck: rec.deck });
    }
    if (!decks.some((d) => d.id === c.deck)) return reply({ error: 'That code doesn\'t open anything.' }, 403);
    const allow = [...media].sort();
    const had = await readJson(bucket, SUB_ALLOW);
    if (!had || had.key !== c.key || JSON.stringify(had.media) !== JSON.stringify(allow)) {
      await bucket.put(SUB_ALLOW, JSON.stringify({ key: c.key, media: allow }), { httpMetadata: { contentType: 'application/json' } });
    }
    return reply({ start: c.deck, decks, key: c.key });
  }
  if (what === 'media' && id && HASH.test(id) && extra === undefined && request.method === 'GET') {
    const key = request.headers.get('X-Sub-Key') || '';
    const allow = await readJson(bucket, SUB_ALLOW);
    if (!key || !allow || !sameText(key, allow.key) || !allow.media.includes(id)) return reply({ error: 'not found' }, 404);
    const o = await bucket.get('media/' + id);
    if (!o) return reply({ error: 'not found' }, 404);
    return new Response(o.body, { headers: headers({
      'Content-Type': (o.httpMetadata && o.httpMetadata.contentType) || 'application/octet-stream' }) });
  }
  return reply({ error: 'not found' }, 404);
}

/* The studio's lesson pages, one JSON file per record under lessons/<kind>/<id>.
   GET    state                      { students: { id: { u, gone } }, pieces: {...}, library: {...} }
   GET    <kind>/<id>                one record
   PUT    <kind>/<id>?u=&base=       save it; base is the version the device last saw (409 if it changed)
   DELETE <kind>/<id>?u=&base=       remove it everywhere (kept as a marker so other devices remove it too) */
const LESSON_KINDS = new Set(['students', 'pieces', 'library']);
const MAX_RECORD = 8 * 1024 * 1024;

async function lessonsApi(request, env, [what, id, extra]) {
  const bucket = env.CLASS_FILES;
  const method = request.method;
  if (extra !== undefined) return reply({ error: 'not found' }, 404);
  if (what === 'state' && !id && method === 'GET') {
    const out = {};
    for (const kind of LESSON_KINDS) {
      out[kind] = {};
      for (const o of await listAll(bucket, `lessons/${kind}/`)) {
        const m = o.customMetadata || {};
        out[kind][o.key.slice(kind.length + 9)] = { u: Number(m.u) || 0, gone: m.gone === '1' };
      }
    }
    return reply(out);
  }
  if (!LESSON_KINDS.has(what) || !id || !ID.test(id)) return reply({ error: 'not found' }, 404);
  const key = `lessons/${what}/${id}`;
  if (method === 'GET') {
    const o = await bucket.get(key);
    if (!o || (o.customMetadata || {}).gone === '1') return reply({ error: 'not found' }, 404);
    return new Response(o.body, { headers: headers({ 'Content-Type': 'application/json' }) });
  }
  if (method !== 'PUT' && method !== 'DELETE') return reply({ error: 'method not allowed' }, 405);
  const params = new URL(request.url).searchParams;
  const u = Number(params.get('u'));
  if (!u) return reply({ error: 'u needed' }, 400);
  const now = await bucket.head(key);
  const have = now ? Number((now.customMetadata || {}).u) || 0 : 0;
  if (have && String(have) !== params.get('base')) return reply({ u: have }, 409);
  if (method === 'DELETE') {
    await bucket.put(key, '', { customMetadata: { u: String(u), gone: '1' } });
    return reply({ u });
  }
  const body = await request.text();
  if (body.length > MAX_RECORD) return reply({ error: 'too big' }, 413);
  const rec = JSON.parse(body);
  if (!rec || rec.id !== id) return reply({ error: 'wrong id' }, 400);
  await bucket.put(key, body, { httpMetadata: { contentType: 'application/json' }, customMetadata: { u: String(u) } });
  return reply({ u });
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
  return !!(await accessToken(request, env, env.ACCESS_AUD, keys));
}

/** The verified body of the Access login token for the application `aud`, or null. */
export async function accessToken(request, env, aud, keys = accessKeys) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !aud || !env.ACCESS_TEAM) return null;
  const team = String(env.ACCESS_TEAM).replace(/^https?:\/\//, '').replace(/\/+$/, '');
  try {
    const [h, p, s] = token.split('.');
    const head = part(h), body = part(p);
    if (head.alg !== 'RS256') return null;
    let jwk = (await keys(team)).find((k) => k.kid === head.kid);
    if (!jwk) jwk = (await keys(team, true)).find((k) => k.kid === head.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(s), new TextEncoder().encode(h + '.' + p));
    const now = Date.now() / 1000;
    const auds = Array.isArray(body.aud) ? body.aud : [body.aud];
    const good = ok && auds.includes(aud) && body.iss === 'https://' + team &&
      typeof body.exp === 'number' && body.exp > now && !(body.nbf > now + 60);
    return good ? body : null;
  } catch (e) {
    return null;
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
   GET  /api/live/songburner.json           Song Burner's default settings (only what differs from
                                            the built-in values; see siteDefaults in Code.gs)
   GET  /api/live/radio.json                the radio's station library and Kyle's picks
                                            (radio/stations.json's shape)
   GET  /api/live/voice/:voice.json         a voice's takes (index.json "voices" entry's shape)
   GET  /api/live/voice/:voice/:take.mp3    one take
   PUT  /studio/api/live/grooves            publish the grooves                       (Kyle)
   PUT  /studio/api/live/games              publish the game options                  (Kyle)
   PUT  /studio/api/live/songburner         publish Song Burner's default settings    (Kyle)
   PUT  /studio/api/live/radio              publish the radio's stations              (Kyle)
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
    if (path === 'songburner.json') return live.text('songburner');
    if (path === 'radio.json') return live.text('radio');
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
  if (path === 'songburner' && method === 'PUT') {
    const text = await request.text();
    if (text.length > 256 * 1024) return reply({ error: 'too big' }, 413);
    let data;
    try { data = JSON.parse(text); } catch { return reply({ error: 'not JSON' }, 400); }
    if (!data || typeof data !== 'object' || Array.isArray(data) || !data.diff) return reply({ error: 'not settings' }, 400);
    return live.putText('songburner', text);
  }
  if (path === 'radio' && method === 'PUT') {
    const text = await request.text();
    if (text.length > 256 * 1024) return reply({ error: 'too big' }, 413);
    let data;
    try { data = JSON.parse(text); } catch { return reply({ error: 'not JSON' }, 400); }
    const clean = radioLibrary(data);
    if (typeof clean === 'string') return reply({ error: clean }, 400);
    return live.putText('radio', JSON.stringify(clean));
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

// The radio plays these links on every visitor's dial, so only the fields it reads are kept,
// and every link must be https. Returns the cleaned library, or what is wrong with it.
const STATION = /^[a-z0-9-]{1,40}$/;
function radioLibrary(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.stations) || !data.stations.length) return 'no stations';
  if (data.stations.length > 500) return 'too many stations';
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const genres = (Array.isArray(data.genres) ? data.genres : []).map((g) => str(g, 40)).filter(Boolean).slice(0, 30);
  const ids = new Set();
  const stations = [];
  for (const o of data.stations) {
    if (!o || typeof o !== 'object' || !STATION.test(o.id) || ids.has(o.id)) return 'bad station id';
    let url;
    try { url = new URL(o.url); } catch { return `bad link: ${o.id}`; }
    if (url.protocol !== 'https:' || url.username || url.password) return `link must be https: ${o.id}`;
    const name = str(o.name, 40);
    if (!name) return `no name: ${o.id}`;
    const s = { id: o.id, name };
    if (o.freq != null && o.freq !== '') {
      const f = Math.round(Number(o.freq) * 10) / 10;
      if (!(f >= 87.5 && f <= 108)) return `frequency out of range: ${o.id}`;
      s.freq = f;
    }
    s.where = str(o.where, 60);
    s.genre = str(o.genre, 40);
    s.url = url.href;
    ids.add(o.id);
    stations.push(s);
  }
  const picks = [...new Set(Array.isArray(data.picks) ? data.picks : [])].filter((id) => ids.has(id));
  return { genres, picks, stations };
}

export class Live extends DurableObject {
  // text:<name> → { chunks, at }, text:<name>:<i> → a piece of it (names: grooves, games, units, songburner, radio, voice:<voice>)
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

// ---- Song Burner's cloud copy -------------------------------------------------

/* One private library per tester, for the closed beta. A separate Cloudflare Access
   application (SONGBURNER_AUD) guards /songburner/account/ and /api/songburner/, and only
   invited email addresses can sign in. Every request is checked here too.

   The library is the same thing as a backup file: { tabs, order }. The browser merges its
   copy with this one (see songburner/host.js) and sends the result back; this side only
   stores it, with a version number so two devices never write over each other unseen.
   The Durable Object is named by a hash of the email address, and the address itself is
   not stored.

   GET    /api/songburner/me        who is signed in              { email }
   GET    /api/songburner/library   the stored library            { version, at, library }
   PUT    /api/songburner/library   replace it; If-Match: version { version, at } or 409
   DELETE /api/songburner/library   delete the cloud copy
   GET    /api/songburner/dashboard turn the dashboard feed on    { feed } (the same link each time)
   POST   /api/songburner/dashboard a new feed link; the old stops { feed }
   DELETE /api/songburner/dashboard turn the feed off
   PUT    /api/songburner/dashboard where the songs stand now     { on } (stored only while on)
   GET    /api/songburner/feed/:hash/:key   the feed itself, no sign-in: the key is the lock

   THE DASHBOARD FEED. Kyle's second-screen dashboard (a page on his PC, outside this site)
   shows the Fridge and the Counter. The scores are worked out in the app, on the device, so
   the app sends a small snapshot after every sync (each song's score, heat and rate, nothing
   else; never a lyric) and the feed walks it forward a night at a time to today, with the
   same rules as scoreFromAttempts in songburner/src/Code.gs. A tester who never turns the
   feed on stores nothing. */

const MAX_LIBRARY = 24 * 1024 * 1024;

/* SONG BURNER'S OWN SESSION COOKIE.
   Access guards /songburner/account/, the page Sign in lands on. When a request reaches it,
   Access has just checked who it is, so the Worker hands the browser a session cookie of its
   own, signed here and sent only to /api/songburner/. The API reads that cookie.
   Why: every Access application on this domain shares one CF_Authorization cookie, so a
   browser also signed in to the studio could arrive at /api/songburner/ carrying the
   studio's token. Access answered with a redirect the app cannot follow, and the app looked
   signed out. */
const SB_COOKIE = 'sb_session';
const SB_DAYS = 30;

async function sbKey(env) {
  const raw = await env.VAULTS.get(env.VAULTS.idFromName('songburner-signing-key')).signingKey();
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sbMint(env, email) {
  const body = JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) + SB_DAYS * 86400 });
  const payload = b64url(new TextEncoder().encode(body));
  const sig = await crypto.subtle.sign('HMAC', await sbKey(env), new TextEncoder().encode(payload));
  return payload + '.' + b64url(sig);
}

/** The email in a valid Song Burner session cookie and when it was made (seconds), or null. */
async function sbSession(request, env) {
  const m = /(?:^|;\s*)sb_session=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/.exec(request.headers.get('Cookie') || '');
  if (!m) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await sbKey(env), b64(m[2]), new TextEncoder().encode(m[1]));
    if (!ok) return null;
    const body = part(m[1]);
    if (typeof body.e !== 'string' || !(body.x > Date.now() / 1000)) return null;
    return { email: body.e, iat: body.x - SB_DAYS * 86400 };
  } catch (e) {
    return null;
  }
}
function sbCookie(value, maxAge) {
  return `${SB_COOKIE}=${value}; Path=/api/songburner/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

/** The sign-in landing page. Behind Access, so a valid token here starts a session.
    X-SB-Signin says how it went, as a short code the page shows if sign-in fails:
    ok, off, page (the page itself did not load), no-token (Access sent nothing),
    bad-token (a token, but not for this application), no-email. */
async function songBurnerSignIn(request, env) {
  // a plain GET, so the asset never comes back as a 304 with no page to put the cookie on
  const page = await env.ASSETS.fetch(new Request(new URL('/songburner/account/', request.url)));
  const done = async (code, cookie) => {
    const res = new Response(page.body, page);
    if (cookie) res.headers.append('Set-Cookie', cookie);
    res.headers.set('X-SB-Signin', code);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  };
  if (!env.SONGBURNER_AUD || !env.VAULTS) return done('off');
  if (!page.ok) return done('page');
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) return done('no-token');
  const who = await accessToken(request, env, env.SONGBURNER_AUD);
  if (!who) return done('bad-token');
  const email = typeof who.email === 'string' ? who.email.trim().toLowerCase() : '';
  if (!email) return done('no-email');
  return done('ok', sbCookie(await sbMint(env, email), SB_DAYS * 86400));
}

async function songBurnerApi(request, env, path, ctx) {
  if (!env.SONGBURNER_AUD || !env.VAULTS) return reply({ error: 'not set up' }, 503);
  const method = request.method;
  if (path === 'signout' && method === 'POST') {
    const out = reply({ ok: true });
    out.headers.append('Set-Cookie', sbCookie('', 0));
    return out;
  }
  // The session cookie, or an Access token while /api/songburner/ is still behind Access too.
  const feed = /^feed\/([0-9a-f]{64})\/([A-Za-z0-9_-]{16,100})$/.exec(path);
  if (feed) return dashFeed(request, env, feed[1], feed[2]);
  let who = await sbSession(request, env);
  if (!who) {
    const t = await accessToken(request, env, env.SONGBURNER_AUD);
    const e = t && typeof t.email === 'string' ? t.email.trim().toLowerCase() : '';
    who = e ? { email: e, iat: Number(t.iat) || 0 } : null;
  }
  if (!who) return reply({ error: 'sign in' }, 401);
  const email = who.email;
  const hash = await sha256(email);
  const vault = env.VAULTS.get(env.VAULTS.idFromName('songburner:' + hash));
  // Removed from the studio: sessions made before that are over.
  if (!(await vault.allowed(who.iat))) return reply({ error: 'sign in' }, 401);
  const later = (p) => { if (ctx) ctx.waitUntil(p.catch(() => {})); };
  const roster = sbRoster(env);
  if (path === 'me' && method === 'GET') {
    later(roster.seen(hash, email));
    return reply({ email });
  }
  if (path === 'dashboard') return dashSetup(request, vault, hash, method);
  if (path !== 'library') return reply({ error: 'not found' }, 404);
  if (method === 'GET') {
    // A tester the roster has no numbers for yet (signed up before it existed) gets them now.
    later(roster.seen(hash, email).then((fresh) => fresh && vault.stats().then((st) => st && roster.note(hash, email, st))));
    return vault.read();
  }
  if (method === 'DELETE') {
    later(roster.forget(hash));
    return vault.clear();
  }
  if (method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_LIBRARY) return reply({ error: 'too big' }, 413);
    let lib;
    try { lib = JSON.parse(text); } catch { return reply({ error: 'bad library' }, 400); }
    if (!lib || typeof lib.tabs !== 'object' || !Array.isArray(lib.order)) return reply({ error: 'bad library' }, 400);
    const base = Number(request.headers.get('If-Match') || '0');
    const res = await vault.write(text, Number.isFinite(base) ? base : -1);
    if (res.ok) later(roster.note(hash, email, libraryStats(lib, text.length)));
    return res;
  }
  return reply({ error: 'method not allowed' }, 405);
}

const MAX_DASH = 512 * 1024;

/** The tester's own side of the feed: make, replace or drop its link, and store a snapshot. */
async function dashSetup(request, vault, hash, method) {
  const link = (key) => new URL(`/api/songburner/feed/${hash}/${key}`, request.url).href;
  if (method === 'GET' || method === 'POST') {
    const key = await vault.dashKey(method === 'POST');
    return reply({ feed: link(key),
      note: 'Paste this into songburnerFeedUrl in the dashboard\'s config.js. Anyone with it sees your song titles and scores. POST here for a new one (the old one stops working); DELETE turns the feed off.' });
  }
  if (method === 'DELETE') { await vault.dashOff(); return reply({ ok: true }); }
  if (method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_DASH) return reply({ error: 'too big' }, 413);
    let snap;
    try { snap = JSON.parse(text); } catch { return reply({ error: 'bad snapshot' }, 400); }
    if (!snap || !Array.isArray(snap.songs) || !(Number(snap.at) > 0)) return reply({ error: 'bad snapshot' }, 400);
    return reply({ on: await vault.dashPut(text) });
  }
  return reply({ error: 'method not allowed' }, 405);
}

/** The dashboard runs from a file on Kyle's PC (origin "null"), so the feed answers any origin. */
function corsed(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}

async function dashFeed(request, env, hash, key) {
  if (request.method === 'OPTIONS') {
    return corsed(new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } }));
  }
  if (request.method !== 'GET') return corsed(reply({ ok: false, error: 'method not allowed' }, 405));
  const vault = env.VAULTS.get(env.VAULTS.idFromName('songburner:' + hash));
  const text = await vault.dashRead(key);
  if (text === null) return corsed(reply({ ok: false, error: 'Wrong or missing key' }, 403));
  if (text === '') return corsed(reply({ ok: false, error: 'Open Song Burner once (signed in) to fill the feed' }, 404));
  return corsed(reply({ ok: true, at: new Date().toISOString(), data: dashProject(JSON.parse(text), Date.now()) }));
}

const round1 = (n) => Math.round(n * 10) / 10;

/** nightsToZero in Code.gs. */
function nightsToZero(score, hot, hotDays, coldRate, y) {
  if (score <= 0) return 0;
  let rate = hot ? y : coldRate;
  if (rate <= 0 && y <= 0) return null;
  let nights = hot ? hotDays + 1 : 0, left = score, guard = 0;
  while (left > 0 && guard++ < 4000) {
    left = round1(left - rate);
    rate = Math.round(rate + y);
    nights++;
  }
  return nights;
}

/** One song, `nights` nights on: nightsUntil in scoreFromAttempts (Code.gs), with no quizzes. */
function songAfter(s, nights, y) {
  let score = Number(s.score) || 0, hot = !!s.hot, hotDays = Number(s.hotDays) || 0, coldRate = Number(s.coldRate) || 0;
  for (let n = 0; n < nights; n++) {
    if (hot) {
      if (hotDays > 0) { const jump = Math.min(nights - n, hotDays); hotDays -= jump; n += jump - 1; continue; }
      hot = false; coldRate = y; continue;           // the turn itself is free
    }
    if (score <= 0 || (coldRate <= 0 && y <= 0)) break;
    score = Math.max(0, round1(score - coldRate));
    if (score <= 0) { coldRate = 0; break; }         // frozen: the arrears die with the score
    coldRate = Math.round(coldRate + y);
  }
  return {
    id: s.id, title: s.title, artist: s.artist, score, hot,
    hotDays: hot ? hotDays : 0, coldRate: hot ? 0 : coldRate,
    daysSince: s.daysSince === null || s.daysSince === undefined ? null : Number(s.daysSince) + nights,
    daysLeft: nightsToZero(score, hot, hotDays, coldRate, y)
  };
}

/** The snapshot walked forward to today, in the shape the dashboard's tile reads. */
function dashProject(snap, now) {
  const tz = Number(snap.tz) || 0;                   // the device's getTimezoneOffset(), minutes
  const day = (ms) => Math.floor((ms - tz * 60000) / DAY);
  const nights = Math.max(0, day(now) - day(Number(snap.at)));
  const y = Number(snap.y) || 0;
  const songs = snap.songs.map((s) => songAfter(s, nights, y));
  const losing = songs.filter((s) => !s.hot && s.score > 0)
    .sort((a, b) => b.coldRate - a.coldRate || (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9))
    .map((s) => ({ id: s.id, title: s.title, artist: s.artist, score: s.score, rate: s.coldRate, daysLeft: s.daysLeft, daysSince: s.daysSince }));
  const counter = songs.filter((s) => s.hot && s.hotDays <= 7)
    .sort((a, b) => a.hotDays - b.hotDays || a.score - b.score)
    .map((s) => ({ id: s.id, title: s.title, artist: s.artist, score: s.score, hotDays: s.hotDays, daysSince: s.daysSince }));
  return {
    build: snap.build || '', songs: songs.length, hot: songs.filter((s) => s.hot).length,
    total: round1(songs.reduce((n, s) => n + s.score, 0)),
    losingPerNight: round1(losing.reduce((n, s) => n + s.rate, 0)),
    losing, counter, snapshotAt: Number(snap.at), nightsSince: nights
  };
}

/* THE STUDIO'S VIEW OF THE TESTERS. One more Vault, named 'songburner-roster', keeps a line per
   tester: their email (so the teacher can tell who is who), when they were first and last seen,
   and counts worked out from their library at each sync. Never a song title, a lyric or a score:
   only what it takes to see who is using it and how much.

   GET    /studio/api/songburner/users          { users: [...] }                       (Kyle)
   DELETE /studio/api/songburner/users/:hash    delete their cloud copy and end their
                                                sessions; signing in again starts fresh (Kyle) */
const sbRoster = (env) => env.VAULTS.get(env.VAULTS.idFromName('songburner-roster'));
const DAY = 86400e3;

async function songBurnerStudio(request, env, path) {
  const method = request.method;
  const roster = sbRoster(env);
  if (path === 'users' && method === 'GET') return reply({ users: await roster.list(), now: Date.now() });
  const m = /^users\/([0-9a-f]{64})$/.exec(path);
  if (m && method === 'DELETE') {
    await env.VAULTS.get(env.VAULTS.idFromName('songburner:' + m[1])).remove();
    await roster.forget(m[1]);
    return reply({ ok: true });
  }
  return reply({ error: 'not found' }, 404);
}

/** Counts only, from a library ({ tabs, order }): songs, runs, and runs per day for the last 60 days. */
export function libraryStats(lib, bytes) {
  const rows = (name) => {
    const t = lib && lib.tabs && lib.tabs[name];
    return Array.isArray(t) ? t : [];
  };
  const real = (r) => Array.isArray(r) && r[0] !== '' && r[0] != null;
  const songs = rows('Songs').slice(1).filter(real).length;
  const att = rows('Attempts');
  const iDate = Array.isArray(att[0]) ? att[0].indexOf('date') : -1;
  const recent = {};
  let runs = 0, last = 0;
  const since = Math.floor(Date.now() / DAY) - 60;
  for (const r of att.slice(1)) {
    if (!real(r)) continue;
    runs++;
    if (iDate < 0) continue;
    const v = r[iDate];
    const t = typeof v === 'number' ? v : Date.parse(v);
    if (!(t > 0)) continue;
    if (t > last) last = t;
    const d = Math.floor(t / DAY);
    if (d >= since) recent[d] = (recent[d] || 0) + 1;
  }
  return { songs, runs, lastRun: last, days: recent, bytes: bytes || 0, synced: Date.now() };
}

const VAULT_CHUNK = 512 * 1024;   // characters per stored value, well under the 2 MB limit

export class Vault extends DurableObject {
  /** A session made at iat (seconds) may use this library: false once the studio removed it after. */
  async allowed(iat) {
    const cut = await this.ctx.storage.get('cut');
    return !cut || Number(iat) * 1000 > cut;
  }

  async read() {
    const meta = await this.ctx.storage.get('meta');
    if (!meta) return reply({ version: 0, at: 0, library: null });
    const parts = await this.ctx.storage.get([...Array(meta.chunks).keys()].map((i) => `lib:${i}`));
    let text = '';
    for (let i = 0; i < meta.chunks; i++) text += parts.get(`lib:${i}`) || '';
    return new Response('{"version":' + meta.version + ',"at":' + meta.at + ',"library":' + text + '}',
      { headers: headers({ 'Content-Type': 'application/json' }) });
  }

  async write(text, base) {
    const old = (await this.ctx.storage.get('meta')) || { version: 0, chunks: 0 };
    if (base !== old.version) return reply({ error: 'changed', version: old.version }, 409);
    const chunks = Math.ceil(text.length / VAULT_CHUNK) || 1;
    const put = {};
    for (let i = 0; i < chunks; i++) put[`lib:${i}`] = text.slice(i * VAULT_CHUNK, (i + 1) * VAULT_CHUNK);
    const meta = { version: old.version + 1, chunks, at: Date.now() };
    put.meta = meta;
    await this.ctx.storage.put(put);
    if (old.chunks > chunks) await this.ctx.storage.delete([...Array(old.chunks - chunks).keys()].map((i) => `lib:${chunks + i}`));
    return reply({ version: meta.version, at: meta.at });
  }

  async clear() {
    await this.ctx.storage.deleteAll();
    return reply({ ok: true });
  }

  /** Removed from the studio: the library goes, and so does every session made before now. */
  async remove() {
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.put('cut', Date.now());
  }

  /** The counts for the roster, from the stored library, or null if there is none. */
  async stats() {
    const meta = await this.ctx.storage.get('meta');
    if (!meta) return null;
    const parts = await this.ctx.storage.get([...Array(meta.chunks).keys()].map((i) => `lib:${i}`));
    let text = '';
    for (let i = 0; i < meta.chunks; i++) text += parts.get(`lib:${i}`) || '';
    try { return { ...libraryStats(JSON.parse(text), text.length), synced: meta.at }; } catch (e) { return null; }
  }

  /* The dashboard feed (see dashSetup). The key is kept as is, so the same link can be
     shown again; it is never sent anywhere but to the tester who asks for it. */
  async dashKey(fresh) {
    let key = fresh ? null : await this.ctx.storage.get('dashkey');
    if (!key) {
      key = b64url(crypto.getRandomValues(new Uint8Array(24)));
      await this.ctx.storage.put('dashkey', key);
    }
    return key;
  }

  async dashOff() {
    await this.ctx.storage.delete(['dashkey', 'dash']);
  }

  /** Stores a snapshot while the feed is on; says whether it is. */
  async dashPut(text) {
    if (!(await this.ctx.storage.get('dashkey'))) return false;
    await this.ctx.storage.put('dash', text);
    return true;
  }

  /** The snapshot for the right key: null for a wrong key, '' before the first one arrives. */
  async dashRead(key) {
    const [k, text] = [await this.ctx.storage.get('dashkey'), await this.ctx.storage.get('dash')];
    if (!k || !key || k.length !== key.length) return null;
    let diff = 0;
    for (let i = 0; i < k.length; i++) diff |= k.charCodeAt(i) ^ key.charCodeAt(i);
    return diff ? null : (text || '');
  }

  /* Only on the one Vault named 'songburner-roster': a line per tester, keyed by the hash. */
  async seen(hash, email) {
    const key = 'u:' + hash;
    const now = Date.now();
    const u = (await this.ctx.storage.get(key)) || { first: now };
    const fresh = !u.synced;
    u.email = email;
    u.seen = now;
    await this.ctx.storage.put(key, u);
    return fresh;
  }

  async note(hash, email, st) {
    const key = 'u:' + hash;
    const now = Date.now();
    const u = (await this.ctx.storage.get(key)) || { first: now };
    Object.assign(u, st, { email, seen: now });
    await this.ctx.storage.put(key, u);
  }

  async forget(hash) {
    await this.ctx.storage.delete('u:' + hash);
  }

  async list() {
    const all = await this.ctx.storage.list({ prefix: 'u:' });
    return [...all].map(([k, u]) => ({ id: k.slice(2), ...u }));
  }

  /* Only on the one Vault named 'songburner-signing-key': the key that signs session
     cookies, made the first time it is asked for and never leaving the Worker. */
  async signingKey() {
    let key = await this.ctx.storage.get('hmac');
    if (!key) {
      key = crypto.getRandomValues(new Uint8Array(32)).buffer;
      await this.ctx.storage.put('hmac', key);
    }
    return key;
  }
}
