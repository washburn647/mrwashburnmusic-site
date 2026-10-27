/* Progress, kept on this device only (IndexedDB, or localStorage where
   IndexedDB is unavailable). No names, no accounts, nothing sent anywhere.
   A backup file moves progress to another device. */
window.LP = window.LP || {};
LP.store = (function () {
  'use strict';

  const DB = 'mrw-musician-maker';
  const KEY = 'progress';
  const BACKUP_KIND = 'musician-maker-backup';
  let db = null;
  let state = null;

  function defaults() {
    return {
      v: 1,
      mookie: null,     // null until chosen at the start
      tempo: 76,
      xp: 0,
      steps: {},        // 'u1s3' -> { best, pass: [days], mastered, rounds, last }
      units: {},        // '1' -> { done }
      badges: {},       // 'u1-ear' -> day earned
      notebook: [],     // { unit, p, at }
      test: false
    };
  }

  function open() {
    return new Promise(function (resolve) {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
        r.onsuccess = function () { db = r.result; resolve(); };
        r.onerror = function () { resolve(); };
      } catch (e) { resolve(); }
    });
  }

  function load() {
    return open().then(function () {
      return new Promise(function (resolve) {
        if (!db) {
          try { resolve(JSON.parse(localStorage.getItem(DB) || 'null')); } catch (e) { resolve(null); }
          return;
        }
        const g = db.transaction('kv').objectStore('kv').get(KEY);
        g.onsuccess = function () { resolve(g.result || null); };
        g.onerror = function () { resolve(null); };
      });
    }).then(function (s) {
      state = Object.assign(defaults(), s || {});
      return state;
    });
  }

  function save() {
    const copy = JSON.parse(JSON.stringify(state));
    if (!db) {
      try { localStorage.setItem(DB, JSON.stringify(copy)); } catch (e) { /* storage blocked */ }
      return;
    }
    try { db.transaction('kv', 'readwrite').objectStore('kv').put(copy, KEY); } catch (e) { /* storage blocked */ }
  }

  function get() { return state; }

  function reset() {
    const keep = { mookie: state.mookie, tempo: state.tempo, test: state.test };
    state = Object.assign(defaults(), keep);
    save();
  }

  function backupBlob() {
    const body = { kind: BACKUP_KIND, saved: new Date().toISOString(), data: state };
    return new Blob([JSON.stringify(body, null, 1)], { type: 'application/json' });
  }

  function restore(text) {
    const body = JSON.parse(text);
    if (!body || body.kind !== BACKUP_KIND || !body.data) throw new Error('not a backup');
    state = Object.assign(defaults(), body.data);
    save();
  }

  return { load, save, get, reset, backupBlob, restore };
})();
