/* Keeps this device's decks, pictures, plans and timings in step with the
   copy on the website (/api/class/, see worker/index.js), so home and school
   see the same library. Runs when the app opens, comes back online or into
   view, and a moment after each change.

   - A record changed only here goes up; changed only there comes down.
   - Changed in both places: a plan or built deck keeps the newer one; any
     other deck keeps both, the one from here as a copy.
   - The first time a device syncs, a deck it has under the same name as one
     on the website is the same deck: the website's copy is kept (this
     device's too, as a copy, if it differs), and links to it move along.
   - Removing a deck removes it everywhere.
   - Spinner names (localStorage) are never sent. */

import * as store from './store.js';

const API = '/api/class/';
const BOOK = 'class.sync';

let status = 'off';                        // off | signin | syncing | ok | offline | error
let running = null, again = false, timer = 0;
const listeners = [];

export const getStatus = () => status;
export function onStatus(fn) { listeners.push(fn); }
let pulledFns = [];
/** fn(list of { kind, id }) after records came down from the website. */
export function onPulled(fn) { pulledFns.push(fn); }
/** Deck ids not to replace right now (open in the editor). */
let busy = () => [];
export function holdWhile(fn) { busy = fn; }

function set(s, detail) {
  status = s;
  for (const fn of listeners) fn(s, detail);
}

function book() {
  let b = null;
  try { b = JSON.parse(localStorage.getItem(BOOK)); } catch (e) { /* private window */ }
  b = b || {};
  b.device = b.device || Math.random().toString(36).slice(2, 10);
  b.gone = b.gone || { decks: {}, plans: {} };
  b.seen = b.seen || [];
  return b;
}
function keep(b) { try { localStorage.setItem(BOOK, JSON.stringify(b)); } catch (e) { /* private window */ } }

class SignIn extends Error {}
class Gone extends Error {}

async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(API + path, { cache: 'no-store', redirect: 'manual', ...opts });
  } catch (e) {
    throw Object.assign(new Error('offline'), { offline: true });
  }
  if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) throw new SignIn();
  if (res.status === 503) throw new Gone();
  return res;
}
async function json(path, opts) {
  const res = await api(path, opts);
  if (!res.ok) throw Object.assign(new Error(path + ': ' + res.status), { status: res.status });
  return res.json();
}

/** Sync a moment from now; several changes in a row make one sync. */
export function soon(ms = 2500) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

export function syncNow() {
  if (running) { again = true; return running; }
  running = run().finally(() => {
    running = null;
    if (again) { again = false; soon(500); }
  });
  return running;
}

async function run() {
  if (!navigator.onLine) { set('offline'); return; }
  set('syncing');
  const pulled = [];
  try {
    const server = await json('state');
    const b = book();
    const media = new Set(server.media);
    await syncKind('decks', 'id', server.decks, b, media, pulled);
    await syncKind('plans', 'year', server.plans, b, media, pulled);
    await syncTimings(server.timings, b);
    keep(b);
    set('ok');
  } catch (err) {
    if (err instanceof SignIn) set('signin');
    else if (err instanceof Gone) set('off');
    else if (err.offline) set('offline');
    else { console.error(err); set('error', err.message); }
  }
  if (pulled.length) for (const fn of pulledFns) fn(pulled);
}

async function syncKind(kind, key, server, b, media, pulled) {
  const local = new Map((kind === 'decks' ? await store.listDecks() : await store.listPlans()).map((r) => [r[key], r]));
  const gone = b.gone[kind];
  const hold = new Set(kind === 'decks' ? busy() : []);

  // A device's first sync: its decks may already be on the website under another id.
  if (kind === 'decks') {
    const fresh = [...local.values()].filter((r) => !r.synced && !server[r.id] && !hold.has(r.id));
    const open = Object.keys(server).filter((id) => !server[id].gone && !local.has(id));
    if (fresh.length && open.length) {
      for (const rec of fresh) {
        const match = open.find((id) => server[id].name === rec.name);
        if (!match) continue;
        open.splice(open.indexOf(match), 1);
        await adopt(rec, match, local, media, pulled);
      }
    }
  }

  const ids = new Set([...local.keys(), ...Object.keys(server), ...Object.keys(gone)]);
  for (const id of ids) {
    if (hold.has(id)) continue;
    const L = local.get(id), S = server[id], T = gone[id];
    if (L) {
      if (!S) { await push(kind, L, key, null, media); continue; }
      if (S.gone) {
        if (L.updated > S.u) await push(kind, L, key, S.u, media);
        else await drop(kind, id);
        continue;
      }
      if (S.u === L.updated) { if (L.synced !== S.u) await mark(kind, L, S.u); continue; }
      const mine = L.updated !== L.synced, theirs = S.u !== L.synced;
      if (mine && !theirs) await push(kind, L, key, S.u, media);
      else if (!mine && theirs) { await pull(kind, id, media); pulled.push({ kind, id }); }
      else if (kind === 'plans' || L.deck.built) {
        if (L.updated > S.u) await push(kind, L, key, S.u, media);
        else { await pull(kind, id, media); pulled.push({ kind, id }); }
      } else {
        // Both changed: the website's version takes the id, this device's becomes a copy.
        const copy = { ...L, id: newId(), name: copyName(L.name, local) };
        delete copy.synced;
        await store.putDeck(copy, true);
        await pull(kind, id, media);
        await push(kind, copy, key, null, media);
        pulled.push({ kind, id }, { kind, id: copy.id });
      }
    } else if (T) {
      if (S && !S.gone && S.u > T) { await pull(kind, id, media); pulled.push({ kind, id }); }
      else if (S && !S.gone) await sendDelete(kind, id, T, S.u);
      delete gone[id];
    } else if (S && !S.gone) {
      await pull(kind, id, media);
      pulled.push({ kind, id });
    }
  }
}

/** This device's deck is the website's deck `id`. The website's copy wins; this
    device's stays as a copy when it differs (built decks are simply rebuilt). */
async function adopt(rec, id, local, media, pulled) {
  const old = rec.id;
  await pull('decks', id, media);
  const theirs = await store.getDeck(id);
  await store.deleteDeck(old, true);
  local.delete(old);
  local.set(id, theirs);
  pulled.push({ kind: 'decks', id });
  if (!rec.deck.built && JSON.stringify(rec.deck) !== JSON.stringify(theirs.deck)) {
    const copy = { ...rec, id: newId(), name: copyName(rec.name, local) };
    await store.putDeck(copy, true);
    local.set(copy.id, copy);
    pulled.push({ kind: 'decks', id: copy.id });
  }
  // Other decks here that link to the old id now link to the website's.
  for (const r of local.values()) {
    if (r.id !== id && moveLinks(r.deck, old, id)) await store.putDeck(r);
  }
}

function moveLinks(deck, from, to) {
  let moved = false;
  const fix = (link) => { if (link && link.deck === from) { link.deck = to; moved = true; } };
  for (const s of deck.slides) for (const e of s.els) {
    fix(e.link);
    if (e.text) for (const p of e.text.paras) for (const r of p.runs) fix(r.link);
  }
  return moved;
}

async function push(kind, rec, key, base, media) {
  if (kind === 'decks') await sendMedia(store.mediaOf(rec.deck), media);
  const body = { ...rec };
  delete body.synced;
  const u = rec.updated || Date.now();
  const res = await api(kind + '/' + encodeURIComponent(rec[key]) + '?u=' + u + (base ? '&base=' + base : ''),
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.status === 409) { again = true; return; }
  if (!res.ok) throw new Error('Saving ' + rec[key] + ': ' + res.status);
  await mark(kind, rec, u);
}

/** Note the version the website now has, unless the record changed again meanwhile. */
async function mark(kind, rec, u) {
  const now = kind === 'decks' ? await store.getDeck(rec.id) : await store.getPlan(rec.year);
  if (!now || now.updated !== rec.updated) return;
  now.synced = u;
  now.updated = u;
  await (kind === 'decks' ? store.putDeck(now, true) : store.putPlan(now, true));
}

async function pull(kind, id, media) {
  const rec = await json(kind + '/' + encodeURIComponent(id));
  if (kind === 'decks') await fetchMedia(store.mediaOf(rec.deck));
  rec.synced = rec.updated;
  await (kind === 'decks' ? store.putDeck(rec, true) : store.putPlan(rec, true));
}

async function drop(kind, id) {
  await (kind === 'decks' ? store.deleteDeck(id, true) : store.deletePlan(id, true));
}

async function sendDelete(kind, id, u, base) {
  const res = await api(kind + '/' + encodeURIComponent(id) + '?u=' + u + '&base=' + base, { method: 'DELETE' });
  if (res.status === 409) { again = true; return; }
  if (!res.ok) throw new Error('Removing ' + id + ': ' + res.status);
}

/** Pictures and sounds the website lacks, a few at a time. */
async function sendMedia(hashes, media) {
  const need = hashes.filter((h) => !media.has(h));
  if (!need.length) return;
  const recs = await store.getMedia(need);
  await pool(recs.filter(Boolean), async (m) => {
    const res = await api('media/' + m.hash, { method: 'PUT', body: m.blob,
      headers: { 'Content-Type': m.type || 'application/octet-stream', 'X-Rights': m.rights || 'classroom',
                 'X-Name': encodeURIComponent(m.name || '') } });
    if (!res.ok) throw new Error('Saving a picture: ' + res.status);
    media.add(m.hash);
  });
}

async function fetchMedia(hashes) {
  const have = new Set(await store.mediaKeys());
  await pool(hashes.filter((h) => !have.has(h)), async (hash) => {
    const res = await api('media/' + hash);
    if (res.status === 404) return;
    if (!res.ok) throw new Error('Fetching a picture: ' + res.status);
    const blob = await res.blob();
    let name = res.headers.get('X-Name') || '';
    try { name = decodeURIComponent(name); } catch (e) { /* as is */ }
    await store.putMediaRecord({ hash, type: blob.type, name, rights: res.headers.get('X-Rights') || 'classroom', blob });
  });
}

async function syncTimings(server, b) {
  const seen = new Set(b.seen);
  for (const name of server) {
    if (seen.has(name) || name.startsWith(b.device + '-')) continue;
    await store.addTimings(await json('timings/' + name));
    b.seen.push(name);
  }
  const mine = await store.unsyncedTimings();
  if (!mine.length) return;
  const res = await api('timings/' + b.device + '-' + Date.now(), { method: 'PUT',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mine.map((t) => t.row)) });
  if (!res.ok) throw new Error('Saving timings: ' + res.status);
  await store.markTimings(mine);
}

async function pool(items, fn, n = 4) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

function copyName(name, local) {
  const taken = new Set([...local.values()].map((r) => r.name));
  let n = 1, out = name + ' (copy)';
  while (taken.has(out)) out = name + ' (copy ' + ++n + ')';
  return out;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Removals are remembered until the website hears of them.
store.onChange((kind, id, removed) => {
  if (kind !== 'timings') {
    const b = book();
    if (removed) b.gone[kind][id] = Date.now();
    else delete b.gone[kind][id];
    keep(b);
  }
  if (status !== 'off') soon();
});

window.addEventListener('online', () => syncNow());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
