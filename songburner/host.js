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

  /* Tells the page it is running on the website, not inside Apps Script. */
  window.SONGBURNER_WEB = true;

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
          if (wrote) syncSoon();
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

  /* ---------------- cloud copy (closed beta) ----------------
     Signed in through Cloudflare Access, a tester's library is also kept on
     the website (worker/index.js, /api/songburner/), so it follows them to
     every device. The server only stores; merging happens here.

     A sync is a three-way merge, row by row, keyed on each tab's first column
     (a song's id, an attempt's id, a list's id, a Meta key):
       - BASE is what this device and the cloud last agreed on,
       - LOCAL is this device now, REMOTE is the cloud now.
     A row one side changed and the other did not takes the change. A row one
     side deleted and the other did not change stays deleted. A row both sides
     changed keeps the newer song (updatedAt) and otherwise this device's copy
     (the cloud's, on a device's first sync, so a fresh install's defaults
     never overwrite settings you have tuned).
     The result is written here and sent back with the version it was built
     on; if another device got in first, the whole thing runs again. */
  var API = '/api/songburner/';
  var SIGNIN_URL = '/songburner/account/';
  var ACCOUNT_KEY = 'sb-account';
  var syncDbp = null;

  function syncDb() {
    return syncDbp || (syncDbp = new Promise(function (resolve, reject) {
      var req = indexedDB.open('songburner-sync', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    }));
  }
  function kv(mode, fn) {
    return syncDb().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction('kv', mode), out;
        var r = fn(tx.objectStore('kv'));
        if (r) r.onsuccess = function () { out = r.result; };
        tx.oncomplete = function () { resolve(out); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function getBase() { return kv('readonly', function (st) { return st.get('base'); }); }
  function putBase(b) { return kv('readwrite', function (st) { st.put(b, 'base'); }); }
  function dropBase() { return kv('readwrite', function (st) { st.delete('base'); }); }

  function account() {
    try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null'); } catch (e) { return null; }
  }
  function setAccount(a) {
    try {
      if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
      else localStorage.removeItem(ACCOUNT_KEY);
    } catch (e) {}
  }

  /* Access answers a signed-out call with a redirect to its login page. */
  function api(path, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.redirect = 'manual';
    opts.cache = 'no-store';
    return fetch(API + path, opts).then(function (res) {
      if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) {
        var e = new Error('signed out'); e.code = 'signed-out'; throw e;
      }
      if (res.status === 503) { var n = new Error('Cloud sync is not switched on yet.'); n.code = 'off'; throw n; }
      return res;
    });
  }

  function keyOf(row) { return row && row[0] !== '' && row[0] !== undefined ? String(row[0]) : ''; }
  function asMap(rows) {
    var head = (rows && rows[0]) || [], map = {}, keys = [];
    for (var i = 1; rows && i < rows.length; i++) {
      var k = keyOf(rows[i]);
      if (!k || map.hasOwnProperty(k)) continue;
      var o = {};
      for (var c = 0; c < head.length; c++) o[head[c]] = rows[i][c] === undefined ? '' : rows[i][c];
      map[k] = o; keys.push(k);
    }
    return { head: head.slice(), map: map, keys: keys };
  }
  function same(a, b, head) {
    for (var i = 0; i < head.length; i++) {
      var x = a[head[i]], y = b[head[i]];
      if (String(x === undefined ? '' : x) !== String(y === undefined ? '' : y)) return false;
    }
    return true;
  }
  function stamp(v) {
    if (typeof v === 'number') return v;
    var t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  }
  /* Columns are only ever added at the end, so the longer header is the newer one. */
  function mergedHead(heads) {
    var out = [];
    heads.forEach(function (h) {
      if (!h.length) return;
      if (h.length > out.length && out.every(function (c, i) { return h[i] === c; })) out = h.slice();
    });
    heads.forEach(function (h) { h.forEach(function (c) { if (out.indexOf(c) < 0) out.push(c); }); });
    return out;
  }

  function mergeTab(name, baseRows, localRows, remoteRows) {
    var B = asMap(baseRows), L = asMap(localRows), R = asMap(remoteRows);
    var head = mergedHead([L.head, R.head, B.head]);
    var keys = L.keys.slice();
    R.keys.forEach(function (k) { if (!L.map.hasOwnProperty(k)) keys.push(k); });
    var rows = [head];
    keys.forEach(function (k) {
      var b = B.map[k], l = L.map[k], r = R.map[k], pick = null;
      if (l && r) {
        if (same(l, r, head)) pick = l;
        else if (b && same(l, b, head)) pick = r;
        else if (b && same(r, b, head)) pick = l;
        else if (name === 'Songs') pick = stamp(r.updatedAt) > stamp(l.updatedAt) ? r : l;
        /* Both changed. On a device's first sync there is no base, and the
           cloud's settings beat a fresh install's defaults. */
        else pick = b ? l : r;
      } else if (l) {
        pick = (b && same(l, b, head)) ? null : l;      // gone from the cloud, untouched here
      } else if (r) {
        pick = (b && same(r, b, head)) ? null : r;      // deleted here, untouched in the cloud
      }
      if (pick) rows.push(head.map(function (c) { return pick[c] === undefined ? '' : pick[c]; }));
    });
    return rows;
  }

  function mergeLibraries(base, local, remote) {
    var bt = (base && base.tabs) || {}, lt = local.tabs, rt = (remote && remote.tabs) || {};
    var order = local.order.slice();
    ((remote && remote.order) || []).forEach(function (n) { if (order.indexOf(n) < 0) order.push(n); });
    var tabsOut = {};
    order.forEach(function (n) {
      tabsOut[n] = mergeTab(n, bt[n] || [], lt[n] || [], rt[n] || []);
    });
    oneBurnerEach(tabsOut, rt.Lists || []);
    return { tabs: tabsOut, order: order };
  }

  function parseList(v) {
    if (Array.isArray(v)) return v;
    try { var a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }

  /* Every new device starts with its own empty Front and Back Burner, so the
     first sync brings two of each. Keep the cloud's, and move anything filed
     under the other one across. */
  function oneBurnerEach(t, remoteLists) {
    var lists = t.Lists, songs = t.Songs;
    if (!lists || lists.length < 2) return;
    var lh = lists[0], iId = lh.indexOf('id'), iRole = lh.indexOf('role'), iOrder = lh.indexOf('order');
    if (iId < 0 || iRole < 0) return;
    var cloudIds = {};
    for (var c = 1; c < remoteLists.length; c++) cloudIds[keyOf(remoteLists[c])] = true;
    var swap = {};
    ['front', 'back'].forEach(function (role) {
      var rows = lists.filter(function (r, i) { return i > 0 && r[iRole] === role; });
      if (rows.length < 2) return;
      var keep = rows.filter(function (r) { return cloudIds[String(r[iId])]; })[0] || rows[0];
      rows.forEach(function (r) {
        if (r === keep) return;
        swap[String(r[iId])] = String(keep[iId]);
        if (iOrder >= 0) {
          var a = parseList(keep[iOrder]), b = parseList(r[iOrder]);
          b.forEach(function (x) { if (a.indexOf(x) < 0) a.push(x); });
          if (a.length) keep[iOrder] = JSON.stringify(a);
        }
      });
    });
    if (!Object.keys(swap).length) return;
    t.Lists = lists.filter(function (r, i) { return i === 0 || !swap.hasOwnProperty(String(r[iId])); });
    if (!songs || songs.length < 2) return;
    var iL = songs[0].indexOf('listIds');
    if (iL < 0) return;
    for (var s = 1; s < songs.length; s++) {
      var ids = parseList(songs[s][iL]), out = [];
      ids.forEach(function (x) { var y = swap[x] || x; if (out.indexOf(y) < 0) out.push(y); });
      if (out.join() !== ids.join()) songs[s][iL] = JSON.stringify(out);
    }
  }

  function sameLibrary(a, b) {
    if (a.order.join('\n') !== b.order.join('\n')) return false;
    for (var i = 0; i < a.order.length; i++) {
      if (JSON.stringify(a.tabs[a.order[i]]) !== JSON.stringify(b.tabs[b.order[i]])) return false;
    }
    return true;
  }

  function snapshot() {
    var t = {};
    order.forEach(function (n) { t[n] = tabs[n].map(function (r) { return r.slice(); }); });
    return { tabs: t, order: order.slice() };
  }

  var syncing = null, syncAgain = false, syncTimer = null;

  function syncOnce(tries) {
    var acc = account();
    var remote, baseNow;
    return api('library').then(function (res) {
      if (!res.ok) throw new Error('Could not reach the cloud copy (' + res.status + ').');
      return res.json();
    }).then(function (r) {
      remote = r;
      return getBase();
    }).then(function (b) {
      /* A base only counts against the cloud copy it came from. An emptied or
         reset cloud copy merges as if for the first time, so nothing on this
         device reads as deleted. */
      baseNow = (b && acc && b.email === acc.email && remote.library &&
                 remote.version >= b.version) ? b : null;
      var merged = null, changedHere = false;
      /* Inside the queue, so no edit lands between reading this device and
         writing the merge back to it. */
      var step = queue.then(loadAll).then(function () {
        var local = snapshot();
        merged = mergeLibraries(baseNow, local, remote.library);
        changedHere = !sameLibrary(local, merged);
        if (changedHere) return replaceAll(merged.tabs, merged.order).then(loadAll);
      });
      queue = step.catch(function () {});
      return step.then(function () {
        var unchangedRemote = remote.library && sameLibrary(remote.library, merged);
        var send = unchangedRemote ? Promise.resolve({ version: remote.version, at: remote.at })
          : api('library', { method: 'PUT', body: JSON.stringify(merged),
                             headers: { 'Content-Type': 'application/json', 'If-Match': String(remote.version) } })
            .then(function (res) {
              if (res.status === 409) { var e = new Error('changed'); e.code = 'conflict'; throw e; }
              if (!res.ok) throw new Error('Could not save to the cloud (' + res.status + ').');
              return res.json();
            });
        return send.then(function (v) {
          return putBase({ email: acc.email, version: v.version, tabs: merged.tabs, order: merged.order })
            .then(function () {
              acc.lastSync = Date.now();
              setAccount(acc);
              if (changedHere && channel) channel.postMessage({ type: 'replaced' });
              return { changed: changedHere, at: acc.lastSync };
            });
        });
      });
    }).catch(function (e) {
      if (e.code === 'conflict' && tries < 3) return syncOnce(tries + 1);
      throw e;
    });
  }

  function emit(detail) {
    try { window.dispatchEvent(new CustomEvent('songburner:sync', { detail: detail })); } catch (e) {}
  }

  function syncNow() {
    if (!account()) return Promise.resolve({ changed: false });
    if (syncing) { syncAgain = true; return syncing; }
    emit({ state: 'syncing' });
    syncing = ready.then(function () { return syncOnce(0); }).then(function (r) {
      syncing = null;
      emit({ state: 'done', changed: r.changed, at: r.at });
      if (syncAgain) { syncAgain = false; syncNow(); }
      return r;
    }, function (e) {
      syncing = null; syncAgain = false;
      if (e.code === 'signed-out') {
        var acc = account();
        if (acc) { acc.expired = true; setAccount(acc); }
      }
      emit({ state: 'error', code: e.code || '', message: e.message });
      throw e;
    });
    return syncing;
  }

  /* After edits, sync once things have been quiet for a little while. */
  function syncSoon() {
    if (!account()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { syncNow().catch(function () {}); }, 15000);
  }

  function checkSignIn() {
    return api('me').then(function (res) {
      if (!res.ok) throw new Error('Could not check the sign-in (' + res.status + ').');
      return res.json();
    }).then(function (me) {
      var acc = account();
      if (!acc || acc.email !== me.email) acc = { email: me.email, lastSync: 0 };
      delete acc.expired;
      setAccount(acc);
      return acc;
    });
  }

  /* Leaving the account. With wipe, this device's songs go too (a shared
     school computer); without it they stay here, just no longer synced. */
  function signOut(wipe) {
    var finish = function () {
      setAccount(null);
      return dropBase().then(function () {
        location.href = '/cdn-cgi/access/logout';
      });
    };
    if (!wipe) return finish();
    return queue.then(function () { return replaceAll({}, []); }).then(function () {
      try {
        var kill = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf('sb1.') === 0) kill.push(k);
        }
        kill.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {}
      if (channel) channel.postMessage({ type: 'replaced' });
      return finish();
    });
  }

  function deleteCloud() {
    return api('library', { method: 'DELETE' }).then(function (res) {
      if (!res.ok) throw new Error('Could not delete the cloud copy (' + res.status + ').');
      return dropBase();
    }).then(function () {
      var acc = account();
      if (acc) { acc.lastSync = 0; setAccount(acc); }
    });
  }

  var cloud = {
    account: account,
    signIn: function () { location.href = SIGNIN_URL; },
    signOut: signOut,
    syncNow: syncNow,
    deleteCloud: deleteCloud,
    checkSignIn: checkSignIn
  };

  /* Coming back from the sign-in page, or opening the app signed in. */
  ready.then(function () {
    var justSignedIn = false;
    try {
      justSignedIn = !!localStorage.getItem('sb-account-signin');
      localStorage.removeItem('sb-account-signin');
    } catch (e) {}
    if (justSignedIn) {
      checkSignIn().then(function () { return syncNow(); }).catch(function () {});
    } else if (account()) {
      syncNow().catch(function () {});
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && syncTimer) {
      clearTimeout(syncTimer); syncTimer = null;
      syncNow().catch(function () {});
    }
  });

  window.SongBurnerHost = {
    ready: ready,
    exportBackup: exportBackup,
    importBackup: importBackup,
    restoreTabs: restoreTabs,
    summary: summary,
    cloud: cloud
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
