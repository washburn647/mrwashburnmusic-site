/* The Song Burner side of worker/index.js, run in Node: who gets the app's pages, the session
   cookie, and the Vault that keeps each tester's library. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./cf-loader.mjs', import.meta.url);
const W = await import('../worker/index.js');
const worker = W.default;

/* Durable Object storage, in memory. */
function memStorage() {
  const m = new Map();
  const clone = (v) => (v === undefined ? undefined : structuredClone(v));
  return {
    async get(k) {
      if (Array.isArray(k)) return new Map(k.filter((x) => m.has(x)).map((x) => [x, clone(m.get(x))]));
      return clone(m.get(k));
    },
    async put(k, v) {
      if (typeof k === 'object') { for (const [a, b] of Object.entries(k)) m.set(a, clone(b)); return; }
      m.set(k, clone(v));
    },
    async delete(k) { for (const x of [].concat(k)) m.delete(x); },
    async deleteAll() { m.clear(); },
    async list({ prefix = '', end, limit } = {}) {
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix) && (end === undefined || k < end)).sort();
      return new Map(keys.slice(0, limit || keys.length).map((k) => [k, clone(m.get(k))]));
    }
  };
}

function makeEnv() {
  const objects = new Map();
  const VAULTS = {
    idFromName: (name) => name,
    get(id) {
      if (!objects.has(id)) objects.set(id, new W.Vault({ storage: memStorage() }, {}));
      return objects.get(id);
    }
  };
  const ASSETS = {
    async fetch(req) {
      const p = new URL(req.url).pathname;
      const pages = { '/songburner/': 'APP', '/songburner/backup/': 'BACKUP', '/songburner/gate/': 'GATE', '/songburner/account/': 'ACCOUNT' };
      if (pages[p]) return new Response(pages[p], { headers: { 'Content-Type': 'text/html' } });
      return new Response('static ' + p, { status: 200 });
    }
  };
  return { VAULTS, ASSETS, SONGBURNER_AUD: 'test-aud', ACCESS_TEAM: 'example.cloudflareaccess.com', ACCESS_AUD: 'studio-aud' };
}

const ctx = { waitUntil() {} };
const get = (env, path, cookie, init = {}) => worker.fetch(new Request('https://mrwashburnmusic.com' + path,
  { ...init, headers: { ...(cookie ? { Cookie: 'sb_session=' + cookie } : {}), ...(init.headers || {}) } }), env, ctx);
async function sha256(t) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

test('signed out: the app pages are the sign-in page, with 401', async () => {
  const env = makeEnv();
  for (const p of ['/songburner/', '/songburner/index.html', '/songburner/backup/']) {
    const r = await get(env, p);
    assert.equal(r.status, 401, p);
    assert.equal(await r.text(), 'GATE', p);
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
  }
});

test('signed in: the app pages are served, never kept stale', async () => {
  const env = makeEnv();
  const tok = await W.sbMint(env, 'kid@example.org');
  let r = await get(env, '/songburner/', tok);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'APP');
  assert.equal(r.headers.get('Cache-Control'), 'private, no-cache');
  r = await get(env, '/songburner/backup/', tok);
  assert.equal(await r.text(), 'BACKUP');
});

test('a forged, tampered or expired cookie gets the sign-in page', async () => {
  const env = makeEnv();
  const tok = await W.sbMint(env, 'kid@example.org');
  const [payload, sig] = tok.split('.');
  const other = btoa(JSON.stringify({ e: 'someone@else.org', x: Math.floor(Date.now() / 1000) + 9999 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  for (const bad of [other + '.' + sig, payload + '.' + sig.slice(0, -2) + 'AA', 'garbage']) {
    assert.equal((await get(env, '/songburner/', bad)).status, 401, bad);
  }
  // 30 days on, the same cookie has run out
  const now = Date.now;
  Date.now = () => now() + 31 * 86400e3;
  try { assert.equal((await get(env, '/songburner/', tok)).status, 401); } finally { Date.now = now; }
  assert.equal((await get(env, '/songburner/', tok)).status, 200);
  // a cookie signed with a different key (another deployment) is refused too
  const elsewhere = await W.sbMint(makeEnv(), 'kid@example.org');
  assert.equal((await get(env, '/songburner/', elsewhere)).status, 401);
});

test('a tester removed in the studio is signed out of the app', async () => {
  const env = makeEnv();
  const tok = await W.sbMint(env, 'kid@example.org');
  assert.equal((await get(env, '/songburner/', tok)).status, 200);
  await new Promise((r) => setTimeout(r, 5));
  await env.VAULTS.get('songburner:' + await sha256('kid@example.org')).remove();
  assert.equal((await get(env, '/songburner/', tok)).status, 401);
  assert.equal((await get(env, '/api/songburner/me', tok)).status, 401);
});

test('deleting your own cloud copy does not undo a removal', async () => {
  const env = makeEnv();
  const vault = env.VAULTS.get('songburner:x');
  await vault.write('{"tabs":{},"order":[]}', 0);
  await vault.remove();
  await vault.clear();
  assert.equal(await vault.allowed(Math.floor(Date.now() / 1000) - 60), false);
});

test('the static files and the privacy page stay open', async () => {
  const env = makeEnv();
  for (const p of ['/songburner/app.js', '/songburner/privacy/', '/songburner/gate/gate.js', '/songburner/icons/icon-192.png']) {
    assert.equal((await get(env, p)).status, 200, p);
  }
});

test('with sync not set up, nobody gets the app', async () => {
  const env = makeEnv();
  const tok = await W.sbMint(env, 'kid@example.org');
  env.SONGBURNER_AUD = '';
  assert.equal((await get(env, '/songburner/', tok)).status, 401);
});

test('the cookie: /me hands it to the app pages, sign-out clears both paths', async () => {
  const env = makeEnv();
  const tok = await W.sbMint(env, 'kid@example.org');
  let r = await get(env, '/api/songburner/me', tok);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { email: 'kid@example.org' });
  const set = r.headers.get('Set-Cookie') || '';
  assert.match(set, /sb_session=[^;]+; Path=\/songburner\/; Max-Age=\d+; HttpOnly; Secure; SameSite=Lax/);
  r = await get(env, '/api/songburner/signout', tok, { method: 'POST' });
  const cleared = r.headers.getSetCookie();
  assert.equal(cleared.length, 2);
  assert.ok(cleared.some((c) => c.includes('Path=/api/songburner/') && c.includes('Max-Age=0')));
  assert.ok(cleared.some((c) => c.includes('Path=/songburner/;') && c.includes('Max-Age=0')));
});

test('the library: versions stop two devices writing over each other', async () => {
  const env = makeEnv();
  const tok = await W.sbMint(env, 'kid@example.org');
  const lib = JSON.stringify({ tabs: { Songs: [['id', 'title'], ['a', 'One']] }, order: ['Songs'] });
  let r = await get(env, '/api/songburner/library', tok, { method: 'PUT', body: lib, headers: { 'If-Match': '0' } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).version, 1);
  r = await get(env, '/api/songburner/library', tok, { method: 'PUT', body: lib, headers: { 'If-Match': '0' } });
  assert.equal(r.status, 409);
  r = await get(env, '/api/songburner/library', tok);
  const back = await r.json();
  assert.equal(back.version, 1);
  assert.deepEqual(back.library, JSON.parse(lib));
  r = await get(env, '/api/songburner/library', tok, { method: 'PUT', body: '{"nope":1}', headers: { 'If-Match': '1' } });
  assert.equal(r.status, 400);
});

test('a big library is stored in pieces and comes back whole', async () => {
  const env = makeEnv();
  const vault = env.VAULTS.get('songburner:big');
  const rows = [['id', 'title']];
  for (let i = 0; i < 40000; i++) rows.push(['s' + i, 'Song number ' + i + ' ' + 'x'.repeat(20)]);
  const text = JSON.stringify({ tabs: { Songs: rows }, order: ['Songs'] });
  assert.ok(text.length > 1024 * 1024);
  await vault.write(text, 0);
  const back = await (await vault.read()).json();
  assert.equal(back.library.tabs.Songs.length, rows.length);
  // shrinking drops the pieces that are no longer needed
  await vault.write('{"tabs":{},"order":[]}', 1);
  assert.deepEqual((await (await vault.read()).json()).library, { tabs: {}, order: [] });
});

test('dashboard: the probe only asks, and nothing is kept while the feed is off', async () => {
  const env = makeEnv();
  const tok = await W.sbMint(env, 'kid@example.org');
  const put = (body, probe) => get(env, '/api/songburner/dashboard', tok, { method: 'PUT', body,
    headers: { 'Content-Type': 'application/json', ...(probe ? { 'X-SB-Probe': '1' } : {}) } });
  assert.deepEqual(await (await put('{}', true)).json(), { on: false });
  const snap = JSON.stringify({ at: Date.now(), songs: [{ id: 'a', title: 'T', score: 5, hot: true, hotDays: 2 }] });
  assert.deepEqual(await (await put(snap)).json(), { on: false });
  const feed = (await (await get(env, '/api/songburner/dashboard', tok)).json()).feed;
  assert.deepEqual(await (await put('{}', true)).json(), { on: true });
  assert.deepEqual(await (await put(snap)).json(), { on: true });
  const r = await get(env, new URL(feed).pathname);
  assert.equal(r.status, 200);
  const d = (await r.json()).data;
  assert.equal(d.songs, 1);
  assert.equal(d.counter[0].title, 'T');
  assert.equal((await get(env, new URL(feed).pathname.replace(/[^/]+$/, 'wrongkeywrongkeywrong'))).status, 403);
});

test('beta requests: an age yes, a real-looking email, and a few a day per address', async () => {
  const env = makeEnv();
  const apply = (body, ip = '1.2.3.4') => worker.fetch(new Request('https://mrwashburnmusic.com/api/songburner/apply',
    { method: 'POST', body: JSON.stringify(body), headers: { 'CF-Connecting-IP': ip } }), env, ctx);
  assert.equal((await apply({ email: 'a@b.org' })).status, 400);
  assert.equal((await apply({ email: 'not an email', age13: true })).status, 400);
  assert.equal((await apply({ email: 'x@y.org\r\nBcc: z@q.org', age13: true })).status, 400);
  for (let i = 0; i < 5; i++) assert.equal((await apply({ email: `k${i}@b.org`, age13: true })).status, 200);
  assert.equal((await apply({ email: 'k9@b.org', age13: true })).status, 429);
  assert.equal((await apply({ email: 'k9@b.org', age13: true }, '5.6.7.8')).status, 200);
});

test('roster counts never include a title or a score', async () => {
  const lib = { tabs: {
    Songs: [['id', 'title'], ['a', 'Secret title'], ['b', 'Other']],
    // A score with a decimal point, so it can't turn up by chance in a timestamp's digits
    // (the old 99 did, whenever Date.now() had "99" in it).
    Attempts: [['id', 'songId', 'date', 'accuracy'], ['r1', 'a', Date.now(), 87.5], ['r2', 'b', Date.now(), 50]]
  }, order: ['Songs', 'Attempts'] };
  const st = W.libraryStats(lib, 123);
  assert.equal(st.songs, 2);
  assert.equal(st.runs, 2);
  assert.doesNotMatch(JSON.stringify(st), /Secret|87\.5|accuracy/);
});

test('the avatar shop: only its own fields go live, in range, and anyone can read it', async () => {
  assert.equal(W.shopFile({}), 'no items');
  assert.equal(W.shopFile({ items: { hat: [{ id: 'crown' }, { id: 'crown' }] } }), 'bad item in hat');
  assert.equal(W.shopFile({ items: { hat: [{ id: '<b>' }] } }), 'bad item in hat');
  const clean = W.shopFile({
    items: {
      hat: [
        { id: 'crown', name: '  Big crown ', price: 99, hidden: true, extra: 'x' },
        { id: 'cheese', price: 0, unlock: { boss: 'mouse-catcher' } },
        { id: 'beret', unlock: { step: 'unit-1:5' } },
        { id: 'party', price: 5000, unlock: { level: 99 } },
        { id: 'bow', unlock: null },
      ],
      secrets: [{ id: 'x' }],
    },
    earn: { every: 0, boss: 9, daily: '4' },
    groovePrice: 70,
    owner: 'someone',
  });
  assert.deepEqual(clean, {
    items: {
      hat: [
        { id: 'crown', name: 'Big crown', price: 99, hidden: true },
        { id: 'cheese', price: 0, unlock: { boss: 'mouse-catcher' } },
        { id: 'beret', unlock: { step: 'unit-1:5' } },
        { id: 'party' },
        { id: 'bow', unlock: null },
      ],
    },
    earn: { boss: 9, daily: 4 },
    groovePrice: 70,
  });

  const live = new W.Live({ storage: memStorage() }, {});
  const env = { ...makeEnv(), LIVE: { idFromName: (n) => n, get: () => live } };
  assert.equal((await get(env, '/api/live/shop.json')).status, 404);
  await live.putText('shop', JSON.stringify(clean));
  const r = await get(env, '/api/live/shop.json');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), clean);
  // Publishing needs Kyle's sign-in.
  const put = await get(env, '/studio/api/live/shop', null, { method: 'PUT', body: JSON.stringify(clean) });
  assert.equal(put.status, 401);
});
