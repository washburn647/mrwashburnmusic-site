/* On-device storage for decks and their pictures (IndexedDB). sync.js copies
   these records to the website and back. Each deck and plan carries
   `updated` (its version) and `synced` (the version the website last had);
   saves here keep `synced` from the stored copy, so only sync.js moves it. */

import { markDeck } from './marks.js';

const DB_NAME = 'mwm-class';
const VERSION = 3;
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        // decks: { id, name, created, updated, deck }
        if (!d.objectStoreNames.contains('decks')) d.createObjectStore('decks', { keyPath: 'id' });
        // media: { hash, type, blob, name, rights }
        if (!d.objectStoreNames.contains('media')) d.createObjectStore('media', { keyPath: 'hash' });
        // timings: one row each time a slide is on screen, for how long songs take.
        // { deck, deckName, slide, gid, song, ms, at }
        if (!d.objectStoreNames.contains('timings')) d.createObjectStore('timings', { autoIncrement: true });
        // plans: one record per school year (see plans.js).
        if (!d.objectStoreNames.contains('plans')) d.createObjectStore('plans', { keyPath: 'year' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(store, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Storage was interrupted.'));
  }));
}

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export function listDecks() {
  return tx('decks', 'readonly', (s) => wrap(s.getAll()))
    .then((all) => all.map(marked).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
}

export function getDeck(id) {
  return tx('decks', 'readonly', (s) => wrap(s.get(id))).then(marked);
}

// Decks imported before a marking rule existed get it on the way out.
let hint = null;                          // song -> grades, from the year plan
function marked(rec) {
  if (rec) markDeck(rec.deck, hint);
  return rec;
}

export function setGradeHint(map) { hint = map; }

// Sync listens for changes made here; its own writes pass quiet and stay unheard.
const listeners = [];
export function onChange(fn) { listeners.push(fn); }
const changed = (kind, id, gone) => { for (const fn of listeners) fn(kind, id, gone); };

/** Saves a deck or plan record. Unless quiet, it is a new version: `synced` stays as stored. */
function putRecord(store, key, rec, quiet) {
  return tx(store, 'readwrite', async (s) => {
    if (!quiet) {
      const old = await wrap(s.get(rec[key]));
      if (old && old.synced) rec.synced = old.synced; else delete rec.synced;
      rec.updated = Math.max(Date.now(), (old && old.updated || 0) + 1);
    }
    return wrap(s.put(rec));
  }).then((r) => { if (!quiet) changed(store, rec[key]); return r; });
}

export function listPlans() {
  return tx('plans', 'readonly', (s) => wrap(s.getAll()))
    .then((all) => all.sort((a, b) => a.year.localeCompare(b.year)));
}

export function getPlan(year) {
  return tx('plans', 'readonly', (s) => wrap(s.get(year)));
}

export function putPlan(rec, quiet) {
  return putRecord('plans', 'year', rec, quiet);
}

export function deletePlan(year, quiet) {
  return tx('plans', 'readwrite', (s) => wrap(s.delete(year))).then(() => { if (!quiet) changed('plans', year, true); });
}

/** Record how long a slide was on screen. */
export function logTiming(row) {
  return tx('timings', 'readwrite', (s) => wrap(s.add(row))).then((r) => { changed('timings'); return r; });
}

/** Timing rows not yet on the website, with their keys. */
export function unsyncedTimings() {
  return tx('timings', 'readonly', (s) => new Promise((resolve, reject) => {
    const out = [];
    const req = s.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) { resolve(out); return; }
      if (!c.value.synced) out.push({ key: c.key, row: c.value });
      c.continue();
    };
    req.onerror = () => reject(req.error);
  }));
}

export function markTimings(list) {
  return tx('timings', 'readwrite', (s) => { for (const { key, row } of list) s.put({ ...row, synced: true }, key); });
}

export function addTimings(rows) {
  return tx('timings', 'readwrite', (s) => { for (const row of rows) s.add({ ...row, synced: true }); });
}

export function listTimings() {
  return tx('timings', 'readonly', (s) => wrap(s.getAll()));
}

export function putDeck(record, quiet) {
  return putRecord('decks', 'id', record, quiet);
}

export function deleteDeck(id, quiet) {
  return tx('decks', 'readwrite', (s) => wrap(s.delete(id))).then(() => { if (!quiet) changed('decks', id, true); });
}

/** Store pictures we don't already have. New imports are tagged "classroom only". */
export async function putMedia(media) {
  const have = new Set(await tx('media', 'readonly', (s) => wrap(s.getAllKeys())));
  const fresh = [...media].filter(([hash]) => !have.has(hash));
  if (!fresh.length) return 0;
  await tx('media', 'readwrite', (s) => {
    for (const [hash, m] of fresh) {
      s.put({ hash, type: m.type, name: m.name, rights: 'classroom',
              blob: new Blob([m.bytes], { type: m.type }) });
    }
  });
  return fresh.length;
}

/** Hashes of every picture and sound kept here. */
export function mediaKeys() {
  return tx('media', 'readonly', (s) => wrap(s.getAllKeys()));
}

/** A picture fetched from the website, as stored there. */
export function putMediaRecord(rec) {
  return tx('media', 'readwrite', (s) => wrap(s.put(rec)));
}

export function getMedia(hashes) {
  return tx('media', 'readonly', (s) => Promise.all(hashes.map((h) => wrap(s.get(h)))));
}

/** Remove pictures no deck uses any more. */
export async function pruneMedia() {
  const decks = await listDecks();
  const used = new Set();
  for (const d of decks) for (const h of mediaOf(d.deck)) used.add(h);
  const keys = await tx('media', 'readonly', (s) => wrap(s.getAllKeys()));
  const gone = keys.filter((k) => !used.has(k));
  if (gone.length) await tx('media', 'readwrite', (s) => { for (const k of gone) s.delete(k); });
  return gone.length;
}

/** Every picture hash a deck refers to. */
export function mediaOf(deck) {
  const out = new Set();
  const take = (f) => { if (f && f.type === 'image') out.add(f.media); };
  for (const s of deck.slides) {
    take(s.bg);
    for (const el of s.els) {
      if (el.media) out.add(el.media);
      take(el.fill);
    }
  }
  return [...out];
}

export async function askToKeep() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (e) { /* not supported */ }
  return false;
}
