/* On-device storage for the studio tools (IndexedDB 'mwm-studio').
   Nothing leaves the device except as a backup file Kyle saves. */

const DB_NAME = 'mwm-studio';
const VERSION = 3;
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        // cues: { id, title, created, updated, rows: [{ id, dur, say, screen, notes }] }
        if (!d.objectStoreNames.contains('cues')) d.createObjectStore('cues', { keyPath: 'id' });
        // students: { id, name, instrument, day, time, created, updated, goals: [{ id, text, status }],
        //   lessons: [{ id, date, note, private, stars, sticker, minutes,
        //     items: [{ id, title, detail, link, tempo, piece, setup, deck }] }] }
        if (!d.objectStoreNames.contains('students')) d.createObjectStore('students', { keyPath: 'id' });
        // pieces: { id, name, title, xml (slimmed MusicXML), parts, measures, created }
        if (!d.objectStoreNames.contains('pieces')) d.createObjectStore('pieces', { keyPath: 'id' });
        // library: { id, created, item: { title, detail, link, tempo, piece, setup, deck } }
        if (!d.objectStoreNames.contains('library')) d.createObjectStore('library', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(name, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(name, mode);
    const req = fn(t.objectStore(name));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
  }));
}

export function store(name) {
  return {
    all: () => tx(name, 'readonly', (s) => s.getAll()),
    get: (id) => tx(name, 'readonly', (s) => s.get(id)),
    put: (rec) => tx(name, 'readwrite', (s) => s.put(rec)),
    delete: (id) => tx(name, 'readwrite', (s) => s.delete(id)),
  };
}

export const newId = () => crypto.randomUUID();

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
