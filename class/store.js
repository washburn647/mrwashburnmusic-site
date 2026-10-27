/* On-device storage for decks and their pictures (IndexedDB).
   Phase 1 keeps everything on the device it was imported on. Syncing
   between home and school comes later, on top of the same records. */

const DB_NAME = 'mwm-class';
const VERSION = 1;
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
    .then((all) => all.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
}

export function getDeck(id) {
  return tx('decks', 'readonly', (s) => wrap(s.get(id)));
}

export function putDeck(record) {
  return tx('decks', 'readwrite', (s) => wrap(s.put(record)));
}

export function deleteDeck(id) {
  return tx('decks', 'readwrite', (s) => wrap(s.delete(id)));
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
