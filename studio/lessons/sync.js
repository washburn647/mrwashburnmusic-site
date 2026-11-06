/* Keeps this device's lesson pages (students, pieces, practice library) in step with
   Kyle's private copy on the website (/studio/api/lessons/, see worker/index.js), so
   every device he signs in on has them. Runs when the page opens, comes back online or
   into view, and a moment after each change.

   - Changed only here: goes up. Changed only there: comes down.
   - Changed in both places: the newer one wins.
   - Removed here: removed everywhere (unless another device changed it since).
   This device remembers which version of each record it last synced (localStorage). */

import { store, onWrite } from '../db.js';

const API = '/studio/api/lessons/';
const BOOK = 'lessons.sync';
const KINDS = ['students', 'pieces', 'library'];
const stores = Object.fromEntries(KINDS.map((k) => [k, store(k)]));

let status = 'off';   // off | syncing | ok | offline | signin | error
let running = null, again = false, timer = 0;
const statusFns = [], pulledFns = [];
export const getStatus = () => status;
export function onStatus(fn) { statusFns.push(fn); }
/** fn() after records came down from the website. */
export function onPulled(fn) { pulledFns.push(fn); }
function set(s) { status = s; for (const fn of statusFns) fn(s); }

function book() {
  let b = null;
  try { b = JSON.parse(localStorage.getItem(BOOK)); } catch { /* private window */ }
  b = b && typeof b === 'object' ? b : {};
  for (const k of KINDS) b[k] = b[k] || {};
  return b;
}
function keep(b) { try { localStorage.setItem(BOOK, JSON.stringify(b)); } catch { /* private window */ } }

class SignIn extends Error {}
class Off extends Error {}

async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(API + path, { cache: 'no-store', redirect: 'manual', ...opts });
  } catch {
    throw Object.assign(new Error('offline'), { offline: true });
  }
  if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) throw new SignIn();
  if (res.status === 503 || (res.status === 404 && path === 'state')) throw new Off();
  return res;
}

export function soon(ms = 2000) {
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
  let pulled = false;
  try {
    const res = await api('state');
    if (!res.ok) throw new Error(`state ${res.status}`);
    const server = await res.json();
    const b = book();
    for (const kind of KINDS) {
      if (await syncKind(kind, server[kind] || {}, b)) pulled = true;
      keep(b);
    }
    set('ok');
  } catch (err) {
    if (err instanceof SignIn) set('signin');
    else if (err instanceof Off) set('off');
    else if (err.offline) set('offline');
    else { console.error(err); set('error'); }
  }
  if (pulled) for (const fn of pulledFns) fn();
}

async function syncKind(kind, server, b) {
  const st = stores[kind];
  const seen = b[kind];
  const local = new Map((await st.all()).map((r) => [r.id, r]));
  let pulled = false;
  for (const id of new Set([...local.keys(), ...Object.keys(server), ...Object.keys(seen)])) {
    let L = local.get(id);
    const S = server[id];
    const was = seen[id];
    if (L && !L.u) {
      // Saved before sync existed: give it a version once.
      L.u = L.updated || L.created || Date.now();
      await st.putAsIs(L);
    }
    if (L) {
      if (!S) { await push(kind, L, null, seen); continue; }
      if (S.gone) {
        if (L.u !== was && L.u > S.u) await push(kind, L, S.u, seen);
        else { await st.deleteAsIs(id); delete seen[id]; pulled = true; }
        continue;
      }
      if (S.u === L.u) { seen[id] = S.u; continue; }
      const mine = L.u !== was, theirs = S.u !== was;
      if (mine && (!theirs || L.u > S.u)) await push(kind, L, S.u, seen);
      else if (await pull(kind, id, seen)) pulled = true;
    } else if (S && !S.gone) {
      if (was != null && S.u === was) await remove(kind, id, S.u, seen);   // removed here
      else if (await pull(kind, id, seen)) pulled = true;
    } else {
      delete seen[id];
    }
  }
  return pulled;
}

async function push(kind, rec, base, seen) {
  const q = `?u=${rec.u}${base ? `&base=${base}` : ''}`;
  const res = await api(`${kind}/${encodeURIComponent(rec.id)}${q}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) });
  if (res.ok) seen[rec.id] = rec.u;
  else if (res.status !== 409) throw new Error(`${kind} ${res.status}`);
  // 409: someone saved since; the next sync sorts it out.
  else again = true;
}

async function pull(kind, id, seen) {
  const res = await api(`${kind}/${encodeURIComponent(id)}`);
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`${kind} ${res.status}`);
  const rec = await res.json();
  if (!rec || rec.id !== id) return false;
  await stores[kind].putAsIs(rec);
  seen[id] = rec.u;
  return true;
}

async function remove(kind, id, base, seen) {
  const res = await api(`${kind}/${encodeURIComponent(id)}?u=${Date.now()}&base=${base}`, { method: 'DELETE' });
  if (res.ok) delete seen[id];
  else if (res.status !== 409) throw new Error(`${kind} ${res.status}`);
  else again = true;
}

export function start() {
  onWrite((name) => { if (KINDS.includes(name)) soon(); });
  window.addEventListener('online', () => soon(100));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(100); });
  return syncNow();
}
