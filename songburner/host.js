/**
 * Song Burner on the web: the Google Sheet, played by the browser.
 *
 * Code.gs was written as an Apps Script web app. Its server half is plain
 * JavaScript that talks to SpreadsheetApp, and its page talks to the server
 * through google.script.run. This file supplies both of those, so the code in
 * src/Code.gs runs here unchanged:
 *
 *   - a small SpreadsheetApp that keeps each tab as rows of cells in memory and
 *     saves them to IndexedDB on this device after every change;
 *   - google.script.run.apiCall, which runs the server half against it.
 *
 * Apps Script gives every request a fresh global scope, and the server half
 * caches freely on that promise. So the engine (engine.js) is a factory, and
 * every call gets a brand new copy of it - exactly the lifetime it was built
 * for.
 *
 * Nothing leaves the device except the lyrics search, which asks lrclib.net
 * and lyrics.ovh directly, as the Apps Script version did.
 */
(function () {
  'use strict';

  var DB_NAME = 'songburner';
  var STORE = 'tabs';
  var ORDER_KEY = '__order';
  var BOOK_NAME = 'Song Burner (this device)';
  var BACKUP_URL = 'backup/';
  var BACKUP_KIND = 'songburner-backup';

  /* ---------------- cells, the way Sheets stores them ----------------
     The server half was tested against what Sheets hands back, not against
     what it wrote: a numeric string comes back a number, TRUE comes back a
     boolean, and an empty cell is ''. Storing the same way keeps every read
     here identical to a read there. */
  var NUMERIC = /^\s*-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/;

  function cell(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'number') return isFinite(v) ? v : '';
    if (typeof v === 'boolean') return v;
    if (v instanceof Date) return v.getTime();
    var s = String(v);
    if (NUMERIC.test(s)) return Number(s);
    var u = s.toUpperCase();
    if (u === 'TRUE') return true;
    if (u === 'FALSE') return false;
    return s;
  }

  function isEmptyRow(r) {
    if (!r) return true;
    for (var i = 0; i < r.length; i++) if (r[i] !== '' && r[i] !== undefined) return false;
    return true;
  }

  /* ---------------- the workbook ---------------- */
  var tabs = {};       // name -> array of rows (row 1 is index 0)
  var order = [];      // tab names in sheet order
  var dirty = {};      // name -> true, for the next save
  var orderDirty = false;

  function touch(name) { dirty[name] = true; }

  function Sheet(name) { this._name = name; }
  Sheet.prototype = {
    rows: function () { return tabs[this._name]; },
    getName: function () { return this._name; },
    getLastRow: function () {
      var rows = this.rows();
      for (var i = rows.length - 1; i >= 0; i--) if (!isEmptyRow(rows[i])) return i + 1;
      return 0;
    },
    getMaxColumns: function () {
      var rows = this.rows(), w = 26;
      for (var i = 0; i < rows.length; i++) if (rows[i].length > w) w = rows[i].length;
      return w;
    },
    getMaxRows: function () { return Math.max(1000, this.rows().length); },
    insertColumnsAfter: function () { return this; },
    setFrozenRows: function () { return this; },
    getRange: function (row, col, numRows, numCols) {
      if (typeof row === 'string') throw new Error('A1 ranges are not supported here.');
      return new Range(this, row, col, numRows || 1, numCols || 1);
    },
    appendRow: function (values) {
      var rows = this.rows();
      var at = this.getLastRow();
      rows.length = Math.max(rows.length, at);
      rows.splice(at, rows.length - at, values.map(cell));
      touch(this._name);
      return this;
    },
    deleteRow: function (r) { return this.deleteRows(r, 1); },
    deleteRows: function (r, n) {
      if (r < 1) throw new Error('Row out of range.');
      this.rows().splice(r - 1, n);
      touch(this._name);
      return this;
    }
  };

  function Range(sheet, row, col, numRows, numCols) {
    if (row < 1 || col < 1 || numRows < 1 || numCols < 1) {
      throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
    }
    this._sheet = sheet; this._row = row; this._col = col;
    this._h = numRows; this._w = numCols;
  }
  Range.prototype = {
    getValues: function () {
      var rows = this._sheet.rows(), out = [];
      for (var i = 0; i < this._h; i++) {
        var src = rows[this._row - 1 + i] || [], line = [];
        for (var j = 0; j < this._w; j++) {
          var v = src[this._col - 1 + j];
          line.push(v === undefined ? '' : v);
        }
        out.push(line);
      }
      return out;
    },
    getValue: function () { return this.getValues()[0][0]; },
    setValues: function (values) {
      if (values.length !== this._h || (values[0] && values[0].length !== this._w)) {
        throw new Error('The number of rows or columns in the data does not match the range.');
      }
      var rows = this._sheet.rows();
      for (var i = 0; i < this._h; i++) {
        var r = this._row - 1 + i;
        while (rows.length <= r) rows.push([]);
        var line = rows[r];
        for (var j = 0; j < this._w; j++) {
          var c = this._col - 1 + j;
          while (line.length < c) line.push('');
          line[c] = cell(values[i][j]);
        }
      }
      touch(this._sheet._name);
      return this;
    },
    setValue: function (v) { return this.setValues([[v]]); }
  };

  var book = {
    getName: function () { return BOOK_NAME; },
    /* The page links "the data sheet" from Settings. Here that is the backup
       page, which is where your data actually is. */
    getUrl: function () { return BACKUP_URL; },
    getId: function () { return 'local'; },
    getSheetByName: function (name) { return tabs[name] ? new Sheet(name) : null; },
    getSheets: function () { return order.map(function (n) { return new Sheet(n); }); },
    insertSheet: function (name) {
      if (tabs[name]) throw new Error('A sheet with the name "' + name + '" already exists.');
      tabs[name] = []; order.push(name); orderDirty = true; touch(name);
      return new Sheet(name);
    },
    deleteSheet: function (sheet) {
      var n = sheet.getName();
      delete tabs[n]; order = order.filter(function (x) { return x !== n; });
      orderDirty = true; dirty[n] = true;
    }
  };

  var SpreadsheetApp = {
    getActiveSpreadsheet: function () { return book; },
    openById: function () { return book; }
  };

  var LockService = {
    /* One tab runs one call at a time, start to finish, so there is nothing to
       wait for. Several tabs are kept honest by reloading on a broadcast. */
    getScriptLock: function () {
      return { waitLock: function () {}, tryLock: function () { return true; },
               releaseLock: function () {} };
    }
  };

  /* Lyrics search. UrlFetchApp is synchronous and so is the code that calls
     it, so this is too. It only runs when you press Search for lyrics. */
  var UrlFetchApp = {
    fetch: function (url) {
      var xhr = new XMLHttpRequest();
      var code = 0, text = '';
      try {
        xhr.open('GET', url, false);
        xhr.send(null);
        code = xhr.status; text = xhr.responseText;
      } catch (e) {
        code = 0;
      }
      return {
        getResponseCode: function () { return code; },
        getContentText: function () { return text; }
      };
    }
  };

  function noDocs() {
    throw new Error('Google Doc songbooks only work in the Google Sheets version of ' +
                    'Song Burner. On the web, add songs with Add, or move a whole ' +
                    'library in from Settings > Back up or move your data.');
  }
  var DocumentApp = { openById: noDocs, ElementType: {}, ParagraphHeading: {},
                      HorizontalAlignment: {} };
  var Docs = { Documents: { get: noDocs } };
  var Logger = { log: function (m) { if (window.console) console.log(m); } };
  var HtmlService = {};

  var services = {
    SpreadsheetApp: SpreadsheetApp, LockService: LockService, UrlFetchApp: UrlFetchApp,
    DocumentApp: DocumentApp, Docs: Docs, Logger: Logger, HtmlService: HtmlService
  };

  /* ---------------- IndexedDB ---------------- */
  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  var dbp = null;
  function db() { return dbp || (dbp = openDb()); }

  function loadAll() {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(STORE, 'readonly');
        var st = tx.objectStore(STORE);
        var next = {}, nextOrder = [];
        var req = st.openCursor();
        req.onsuccess = function () {
          var c = req.result;
          if (!c) return;
          if (c.key === ORDER_KEY) nextOrder = c.value || [];
          else next[c.key] = c.value || [];
          c.continue();
        };
        tx.oncomplete = function () {
          nextOrder = nextOrder.filter(function (n) { return next.hasOwnProperty(n); });
          for (var k in next) if (next.hasOwnProperty(k) && nextOrder.indexOf(k) < 0) nextOrder.push(k);
          tabs = next; order = nextOrder; dirty = {}; orderDirty = false;
          resolve();
        };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function saveDirty() {
    var names = Object.keys(dirty);
    if (!names.length && !orderDirty) return Promise.resolve(false);
    var snap = {};
    names.forEach(function (n) { snap[n] = tabs[n] ? tabs[n].map(function (r) { return r.slice(); }) : null; });
    var ord = order.slice(), writeOrder = orderDirty;
    dirty = {}; orderDirty = false;
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        var st = tx.objectStore(STORE);
        names.forEach(function (n) { if (snap[n]) st.put(snap[n], n); else st.delete(n); });
        if (writeOrder) st.put(ord, ORDER_KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function replaceAll(nextTabs, nextOrder) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        var st = tx.objectStore(STORE);
        st.clear();
        nextOrder.forEach(function (n) { st.put(nextTabs[n], n); });
        st.put(nextOrder, ORDER_KEY);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  /* ---------------- other tabs ----------------
     Each tab holds the whole library in memory. When one saves, the others
     reload before their next call, so a second tab never writes over the
     first with a stale copy. */
  var channel = null;
  try { channel = new BroadcastChannel('songburner'); } catch (e) {}
  var stale = false;
  if (channel) channel.onmessage = function (ev) {
    if (ev.data && ev.data.type === 'saved') stale = true;
    if (ev.data && ev.data.type === 'replaced') location.reload();
  };

  /* Every call runs in order, one after another, the way the script lock made
     them run on the server. */
  var queue = null;

  function run(payloadJson) {
    var step = (stale ? loadAll().then(function () { stale = false; }) : Promise.resolve())
      .then(function () {
        if (typeof window.SongBurnerEngine !== 'function') {
          throw new Error('engine.js did not load');
        }
        var engine = window.SongBurnerEngine(services);
        var out = engine.apiCall(payloadJson);
        return saveDirty().then(function (wrote) {
          if (wrote && channel) channel.postMessage({ type: 'saved' });
          return out;
        });
      });
    queue = step.catch(function () {});
    return step;
  }

  function makeRunner(ok, fail) {
    return {
      withSuccessHandler: function (fn) { return makeRunner(fn, fail); },
      withFailureHandler: function (fn) { return makeRunner(ok, fn); },
      apiCall: function (payloadJson) {
        run(payloadJson).then(function (out) { if (ok) ok(out); },
          function (err) { if (fail) fail(err); else if (window.console) console.error(err); });
      }
    };
  }

  /* ---------------- startup ----------------
     The page polls for google.script.run before its first call, so holding
     it back until the library is loaded is all the waiting it needs. A first
     visit gets the same setup() the Sheets install runs once by hand. */
  function boot() {
    return loadAll().then(function () {
      if (!order.length) {
        var engine = window.SongBurnerEngine(services);
        engine.setup();
        return saveDirty();
      }
    });
  }

  var ready = boot();
  queue = ready;

  /* ---------------- backups ---------------- */
  function exportBackup() {
    return queue.then(loadAll).then(function () {
      var out = { kind: BACKUP_KIND, version: 1, exportedAt: new Date().toISOString(),
                  tabs: {} };
      order.forEach(function (n) { out.tabs[n] = tabs[n]; });
      out.order = order.slice();
      return out;
    });
  }

  function normaliseTabs(src) {
    var outTabs = {}, outOrder = [];
    Object.keys(src).forEach(function (n) {
      var rows = src[n];
      if (!Array.isArray(rows)) return;
      outTabs[n] = rows.map(function (r) { return Array.isArray(r) ? r.map(cell) : []; });
      outOrder.push(n);
    });
    return { tabs: outTabs, order: outOrder };
  }

  /* Replaces EVERYTHING on this device with what is passed in. The tabs keep
     their own headers; the engine lines old columns up on the next call, the
     same migration a Sheet gets when new code is pasted over old. */
  function restoreTabs(srcTabs) {
    var need = ['Songs', 'Attempts', 'Lists', 'Meta'];
    for (var i = 0; i < need.length; i++) {
      if (!srcTabs[need[i]]) throw new Error('This file has no "' + need[i] + '" tab, so it is not a Song Burner library.');
    }
    var n = normaliseTabs(srcTabs);
    return queue.then(function () { return replaceAll(n.tabs, n.order); })
      .then(loadAll)
      .then(function () {
        if (channel) channel.postMessage({ type: 'replaced' });
        var counts = {};
        n.order.forEach(function (t) {
          var rows = n.tabs[t], c = 0;
          for (var r = 1; r < rows.length; r++) if (!isEmptyRow(rows[r]) && rows[r][0] !== '') c++;
          counts[t] = c;
        });
        return counts;
      });
  }

  function importBackup(obj) {
    if (!obj || obj.kind !== BACKUP_KIND || !obj.tabs) {
      return Promise.reject(new Error('That file is not a Song Burner backup.'));
    }
    return restoreTabs(obj.tabs);
  }

  function summary() {
    return queue.then(loadAll).then(function () {
      var out = {};
      order.forEach(function (t) { out[t] = Math.max(0, new Sheet(t).getLastRow() - 1); });
      return out;
    });
  }

  window.SongBurnerHost = {
    ready: ready,
    exportBackup: exportBackup,
    importBackup: importBackup,
    restoreTabs: restoreTabs,
    summary: summary
  };

  ready.then(function () {
    window.google = window.google || {};
    window.google.script = window.google.script || {};
    window.google.script.run = makeRunner(null, null);
  }, function (err) {
    var msg = 'Song Burner could not open its storage on this device. ' +
              'Private browsing, or blocked site data, will do this. (' +
              (err && err.message ? err.message : err) + ')';
    if (window.console) console.error(err);
    document.addEventListener('DOMContentLoaded', function () {
      var p = document.createElement('p');
      p.style.cssText = 'margin:16px;padding:12px 16px;border-radius:12px;background:#F5E4DF;color:#B34A3C;font-family:system-ui,sans-serif';
      p.textContent = msg;
      document.body.insertBefore(p, document.body.firstChild);
    });
  });

  /* Ask the browser not to clear this site's storage when space runs low.
     Installed apps usually get it without asking. */
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then(function (yes) {
      if (!yes) navigator.storage.persist();
    }).catch(function () {});
  }
})();

/* Offline copy of the app itself (not the data - that is IndexedDB above). */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/songburner/sw.js', { scope: '/songburner/' })
      .catch(function () {});
  });
}
