/* GENERATED from src/Code.gs by tools/build_songburner.py. Do not edit.
   The server half of Song Burner alpha 1.70. host.js calls this once per request with
   its stand-ins for the Apps Script services. */
window.SongBurnerEngine = function (services) {
var SpreadsheetApp = services.SpreadsheetApp;
var LockService = services.LockService;
var UrlFetchApp = services.UrlFetchApp;
var DocumentApp = services.DocumentApp;
var Docs = services.Docs;
var Logger = services.Logger;
var HtmlService = services.HtmlService;
/**
 * Song Burner — song lyric memorization, backed by a Google Sheet.
 *
 * ONE FILE. Paste this whole thing into the Apps Script editor of the sheet,
 * enable the Docs advanced service, then Deploy > Web app.
 *
 * Setup checklist:
 *   1. Open the sheet > Extensions > Apps Script, paste this over Code.gs.
 *   2. Services (+) > Google Docs API > Add.   <-- required by the importer
 *   3. Run  setup  once from the editor and grant permissions.
 *   4. Deploy > New deployment > Web app.
 *        Execute as:      Me
 *        Who has access:  Only myself
 *   5. Open the /exec URL, hit "Import from Doc" on first run.
 */

var BUILD    = 'alpha 1.70';
var APP_NAME = 'Song Burner';

/* NOTHING IN HERE IDENTIFIES A PARTICULAR PERSON ANY MORE - 1.60.
   Both of these used to be somebody's file id, pasted in and shipped, which
   made the file unsendable in the most dangerous way available: the script
   reached PAST the sheet it was pasted into and into the one named here. If
   that sheet happened to be shared with whoever installed it, setup succeeded
   and their runs went into someone else's library, and nothing on screen said
   so. A default that silently works on the wrong data is worse than one that
   fails.

   SHEET_ID blank means "the spreadsheet this script is attached to", which is
   the only sheet it should ever have been reading. Fill it in only to point a
   copy at a sheet it does not live in.

   The songbook is set IN THE APP now - Settings > Songbook - and kept in Meta
   with everything else, so it survives a code paste and needs no redeploy. The
   constant below is only a fallback for an install that wants one baked in. */
var SHEET_ID = '';
var DOC_ID   = '';

// Paste the Drive file id of icon-512.png here after uploading it and setting
// the file to "Anyone with the link". Leave blank to skip the favicon.
// See SETUP.md - this is the only hook Apps Script gives us for the icon.
var ICON_FILE_ID = '';
function iconUrl() {
  return ICON_FILE_ID ? 'https://lh3.googleusercontent.com/d/' + ICON_FILE_ID : '';
}

var TAB_SONGS    = 'Songs';
var TAB_ATTEMPTS = 'Attempts';
var TAB_LISTS    = 'Lists';
var TAB_META     = 'Meta';

// New columns go on the END only - the migration in sheetFor lines existing
// rows up by position, so inserting in the middle would shift every value.
var SONG_COLS = ['id', 'title', 'titleKey', 'artist', 'meta', 'sections', 'listIds',
                 'youtube', 'spotify', 'needsChorusTag', 'source', 'createdAt', 'updatedAt',
                 'sortIndex', 'headingId', 'sectionCount', 'lineCount', 'wordCount', 'heat',
                 'playKey', 'capo'];
// seconds: how long the run took, background time excluded. device: 'phone'
// or 'desktop' - times are NEVER averaged across the two, they are not the
// same measurement.
// level: 'easy' | 'medium' | 'hard' for a game, '' for a quiz. timed: '1' when
// you opted the stopwatch in on a quiz, '' when you did not - the pace modifier
// only ever touches a run you asked it to touch.
// secsLeft / secsLimit: a GAME's countdown, what was left on it and what it
// started at. Both are needed and neither is enough on its own - the limit is
// a rate times the song's length, so "40s left" means nothing until you know
// whether the clock started at 45 or at 400. The share of the two is the only
// figure that compares across songs, and it is what the Insights panel tunes
// the timers from. Quizzes leave both blank: a stopwatch has nothing left on it.
var ATTEMPT_COLS = ['id', 'songId', 'date', 'accuracy', 'totalWords', 'correctWords', 'detail',
                    'difficulty', 'mode', 'seconds', 'device', 'level', 'timed', 'variant',
                    'practice', 'secsLeft', 'secsLimit'];
// role: 'front' | 'back' | '' (an ordinary custom list). isDashboard is the
// build-b column, kept so old rows still line up; role supersedes it.
// order: a JSON array of song ids - the list's OWN running order, 1.70. A song
// in two set lists can sit third in one and last in the other; the songs'
// sortIndex is one order for the whole library and could not say that.
var LIST_COLS = ['id', 'name', 'isDashboard', 'createdAt', 'role', 'order'];
var META_COLS = ['key', 'value'];


/* ============================================================
   Web app entry
   ============================================================ */

function doGet() {
  var out = HtmlService.createHtmlOutput(PAGE)
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  var icon = iconUrl();
  if (icon) out.setFaviconUrl(icon);
  return out;
}

/**
 * The page's only server entry point. Takes and returns JSON strings so that
 * nothing depends on how google.script.run serializes objects.
 */
function apiCall(payloadJson) {
  var out;
  try {
    var req = JSON.parse(payloadJson || '{}');
    out = { ok: true, data: route(req.action, req.params || {}) };
  } catch (err) {
    out = { ok: false, error: (err && err.message) ? err.message : String(err) };
  }
  return JSON.stringify(out);
}

/**
 * Serialize anything that writes. Every mutating handler is a read-modify-write
 * against row numbers, so two overlapping calls - two tabs, or a fast run of
 * chorus taps - can have the second one compute its row index against a grid
 * the first has already shifted.
 */
function withLock(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (e) {
    throw new Error('The sheet was busy with another change. Try that again.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function route(action, p) {
  switch (action) {
    // reads
    case 'init':          return apiInit();
    case 'getSong':       return apiGetSong(p.id);
    case 'getSongs':      return apiGetSongs(p.ids);
    case 'fetchLyrics':   return apiFetchLyrics(p.title, p.artist);
    case 'getDecoys':     return apiGetDecoys(p.excludeId, p.want);

    // writes
    case 'saveSong':      return withLock(function () { return apiSaveSong(p.song); });
    case 'deleteSong':    return withLock(function () { return apiDeleteSong(p.id); });
    case 'setSongLists':  return withLock(function () { return apiSetSongLists(p.id, p.listIds); });
    case 'tagChorus':     return withLock(function () { return apiTagChorus(p.id, p.index); });
    case 'saveAttempt':   return withLock(function () { return apiSaveAttempt(p.attempt); });
    /* Practice reaches the heatmap through here and ONLY here. It writes no
       attempt row - no points, no unlock, no averages, no spending the day -
       so "practice records nothing" stays true of the run while still letting
       the song learn from it. A credit run sends its observations along with
       saveAttempt instead, inside that write's lock and its round trip. */
    case 'updateHeat':    return withLock(function () {
      return apiUpdateHeat(p.songId, p.mode, p.obs);
    });
    case 'clearAttempts': return withLock(function () { return apiClearAttempts(); });
    case 'clearSongData': return withLock(function () {
      return apiClearSongData(p.id, p.kind);
    });
    case 'clearAllSongs': return withLock(function () { return apiClearAllSongs(); });
    case 'reorder':       return withLock(function () { return apiReorder(p.order); });
    case 'setSettings':   return withLock(function () { return apiSetSettings(p.settings); });
    case 'setDoc':        return withLock(function () { return apiSetDoc(p.url); });
    case 'appendToDoc':   return withLock(function () { return apiAppendToDoc(p.id); });
    case 'createList':    return withLock(function () { return apiCreateList(p.name); });
    case 'renameList':    return withLock(function () { return apiRenameList(p.id, p.name); });
    case 'deleteList':    return withLock(function () { return apiDeleteList(p.id); });
    case 'setListRole':   return withLock(function () { return apiSetListRole(p.id, p.role); });
    case 'setListOrder':  return withLock(function () { return apiSetListOrder(p.id, p.order); });
    case 'toggleList':    return withLock(function () {
      return apiToggleListMembership(p.songId, p.listId, !!p.on);
    });
    case 'importDoc':     return withLock(function () { return apiImportDoc(!!p.replaceAll); });

    default: throw new Error('Unknown action: ' + action);
  }
}


/* ============================================================
   Sheet plumbing
   ============================================================ */

/* Apps Script starts every execution with a fresh global scope, so these two
   caches live exactly as long as one request. Before this, each readRows and
   writeRow re-opened the workbook and re-ran the header migration check -
   a getMaxColumns() plus a header read - on every single call. */
var _book = null;
var _sheets = {};

/* Bumped whenever SONG_COLS, ATTEMPT_COLS or LIST_COLS change. When the sheet
   already records this version, sheetFor skips the header read and comparison
   it would otherwise repeat for every tab on every request - four round trips
   a tab, paid to learn nothing had changed.
   ** IF YOU ADD A COLUMN, BUMP THIS. ** */
var SCHEMA_VERSION = 's8';
var _schemaOk = null;

function schemaIsCurrent() {
  if (_schemaOk === null) _schemaOk = (metaGet('schemaVersion') === SCHEMA_VERSION);
  return _schemaOk;
}

function ss() {
  if (!_book) {
    _book = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID)
                     : SpreadsheetApp.getActiveSpreadsheet();
  }
  if (!_book) {
    /* A BOUND SCRIPT ALWAYS HAS ONE. Reaching here means the file was pasted
       into a standalone script project rather than into a sheet's own editor,
       and the message has to say that rather than fail as a null further in. */
    throw new Error('No spreadsheet. Paste this into a Sheet - Extensions, ' +
                    'Apps Script - or set SHEET_ID at the top of the file.');
  }
  return _book;
}

/**
 * The songbook, wherever it has been pointed. Empty is a legitimate state and
 * means the app has no doc: importing is off, the write-back button is hidden,
 * and everything else works, because songs can be added by hand.
 */
function docId() {
  var stored = metaGet('docId');
  if (stored) return String(stored);
  return DOC_ID || '';
}

/**
 * Take an id out of whatever was pasted. What people have is the thing in the
 * address bar, not the id buried in it, so a bare id, a /document/d/<id>/edit
 * URL and a URL carrying a #heading or a ?usp=sharing all have to land in the
 * same place.
 */
function docIdFrom(text) {
  var raw = String(text || '').trim();
  if (!raw) return '';
  var m = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (raw.indexOf('/') !== -1 || raw.indexOf(' ') !== -1) return '';
  return /^[a-zA-Z0-9_-]{10,}$/.test(raw) ? raw : '';
}

function sheetFor(name, cols) {
  if (_sheets[name]) return _sheets[name];
  var sh = sheetForUncached(name, cols);
  _sheets[name] = sh;
  return sh;
}

function sheetForUncached(name, cols) {
  var book = ss();
  var sh = book.getSheetByName(name);
  // Meta is exempt: it is where the schema flag lives, and checking it here
  // would recurse. It has two columns and has never changed shape.
  if (sh && name !== TAB_META && schemaIsCurrent()) return sh;
  if (!sh) {
    sh = book.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    sh.setFrozenRows(1);
    return sh;
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    sh.setFrozenRows(1);
    return sh;
  }
  // Migrate a sheet written by an older build. Columns are only ever appended,
  // so an existing row's values still line up; the header just needs to catch
  // up and the sheet may need more physical columns to hold it.
  if (sh.getMaxColumns() < cols.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
  }
  var header = sh.getRange(1, 1, 1, cols.length).getValues()[0];
  var drift = false;
  for (var i = 0; i < cols.length; i++) if (header[i] !== cols[i]) drift = true;
  if (drift) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Run once from the editor. Safe to re-run. */
function setup() {
  sheetFor(TAB_SONGS, SONG_COLS);
  sheetFor(TAB_ATTEMPTS, ATTEMPT_COLS);
  sheetFor(TAB_LISTS, LIST_COLS);
  sheetFor(TAB_META, META_COLS);
  var book = ss();
  var first = book.getSheets()[0];
  if (first.getName() === 'Sheet1' && first.getLastRow() === 0) book.deleteSheet(first);
  ensureBurners();
  metaSet('schemaVersion', SCHEMA_VERSION);
  /* IT SAYS WHICH SHEET IT JUST BUILT. This is the one moment where being
     pointed at the wrong spreadsheet is both possible and invisible, and the
     log is the only place it can be caught before any data exists. */
  return 'Setup complete in "' + book.getName() + '".' + NL_CHAR +
         'Next: Deploy > New deployment > Web app, then open the URL and add ' +
         'your songbook under Settings.';
}

/**
 * Guarantee exactly one front-burner list and one back-burner list.
 * Adopts the old build-b "Working Set" as the front burner rather than
 * leaving it orphaned beside a new one.
 */
function ensureBurners() {
  var rows = readRows(TAB_LISTS, LIST_COLS);
  var front = null, back = null;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.role === 'front' && !front) front = r;
    if (r.role === 'back' && !back) back = r;
  }
  if (!front) {
    for (var j = 0; j < rows.length; j++) {
      var isOld = rows[j].isDashboard === true || rows[j].isDashboard === 'TRUE' ||
                  rows[j].isDashboard === 'true' || rows[j].name === 'Working Set';
      if (isOld && rows[j].role !== 'back') {
        front = rows[j];
        writeRow(TAB_LISTS, LIST_COLS, front._row, {
          id: front.id, name: 'Front Burner', isDashboard: true,
          createdAt: front.createdAt, role: 'front', order: front.order || ''
        });
        break;
      }
    }
  }
  if (!front) {
    var fid = uid();
    appendRow(TAB_LISTS, LIST_COLS,
      { id: fid, name: 'Front Burner', isDashboard: true, createdAt: Date.now(), role: 'front' });
  }
  if (!back) {
    appendRow(TAB_LISTS, LIST_COLS,
      { id: uid(), name: 'Back Burner', isDashboard: false, createdAt: Date.now(), role: 'back' });
  }
}

function readRows(name, cols) {
  var sh = sheetFor(name, cols);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === '' || values[i][0] === null) continue;
    var o = { _row: i + 2 };
    for (var c = 0; c < cols.length; c++) o[cols[c]] = values[i][c];
    out.push(o);
  }
  return out;
}

/**
 * The Songs tab WITHOUT the lyrics column.
 *
 * sections is 93% of that sheet's bulk (393KB of 424KB across 242 songs) and
 * apiInit returns an index containing no lyrics at all - so every page load
 * was reading, and discarding, nearly the whole songbook. Reading the two
 * ranges either side of it costs one extra round trip and skips all of that.
 */
/**
 * Locate a song's physical row from the id column alone - one narrow read
 * instead of dragging the whole songbook across for a single record.
 */
function findSongRow(id) {
  var sh = sheetFor(TAB_SONGS, SONG_COLS);
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return -1;
}

/** One song row in full, lyrics included. */
function readSongRow(row) {
  var sh = sheetFor(TAB_SONGS, SONG_COLS);
  var values = sh.getRange(row, 1, 1, SONG_COLS.length).getValues()[0];
  var r = { _row: row };
  for (var c = 0; c < SONG_COLS.length; c++) r[SONG_COLS[c]] = values[c];
  return r;
}

/**
 * How many sections one song has, without dragging its lyrics across.
 *
 * Only the medal rules and the chain need it away from a full song read, and
 * both only care whether it is three or more. The stored count is authoritative
 * where it exists; a row written before backfillCounts ran has a blank there,
 * and a blank has to read as "unknown" rather than as zero, or every legacy
 * song would silently lose its two verse games.
 */
function sectionCountOf(songId) {
  var row = findSongRow(songId);
  if (row < 0) return 3;
  var sh = sheetFor(TAB_SONGS, SONG_COLS);
  var col = SONG_COLS.indexOf('sectionCount') + 1;
  var v = sh.getRange(row, col, 1, 1).getValues()[0][0];
  if (v === '' || v === null || v === undefined) return 3;
  return Number(v) || 0;
}

/**
 * DELETE THE RETIRED FIRST LINES RUNS - 1.50.
 *
 * The game itself went in 1.31a; Scramble Lines does what it did and more. Its
 * rows have been carried since then under a retired name so the history did not
 * show blanks, and Kyle's call is that they should never have been there at
 * all. So they go, once, and the meta flag makes sure a redeploy does not go
 * looking for them again on every load.
 *
 * Bottom-up. Deleting a row shifts every row under it up by one, so a top-down
 * pass deletes the wrong rows from the second one onwards.
 */
function purgeRetiredModes() {
  if (metaGet('purgedFirstLine') === '1') return 0;
  var sh = sheetFor(TAB_ATTEMPTS, ATTEMPT_COLS);
  var last = sh.getLastRow();
  if (last < 2) { metaSet('purgedFirstLine', '1'); return 0; }
  var dCol = ATTEMPT_COLS.indexOf('difficulty') + 1;
  var mCol = ATTEMPT_COLS.indexOf('mode') + 1;
  var lo = Math.min(dCol, mCol), width = Math.abs(dCol - mCol) + 1;
  var vals = sh.getRange(2, lo, last - 1, width).getValues();
  var kill = [];
  for (var i = 0; i < vals.length; i++) {
    var a = String(vals[i][0] || ''), b = String(vals[i][width - 1] || '');
    if (a === 'firstLine' || b === 'firstLine') kill.push(i + 2);
  }
  for (var k = kill.length - 1; k >= 0; k--) sh.deleteRow(kill[k]);
  metaSet('purgedFirstLine', '1');
  return kill.length;
}

function readSongIndexRows() {
  var sh = sheetFor(TAB_SONGS, SONG_COLS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var n = last - 1;
  var cut = SONG_COLS.indexOf('sections');            // 0-based
  var left = sh.getRange(2, 1, n, cut).getValues();
  var rightWidth = SONG_COLS.length - cut - 1;
  var right = rightWidth > 0 ? sh.getRange(2, cut + 2, n, rightWidth).getValues() : [];
  var out = [];
  for (var i = 0; i < n; i++) {
    if (left[i][0] === '' || left[i][0] === null) continue;
    var o = { _row: i + 2, sections: '' };
    for (var c = 0; c < cut; c++) o[SONG_COLS[c]] = left[i][c];
    for (var d = 0; d < rightWidth; d++) o[SONG_COLS[cut + 1 + d]] = right[i][d];
    out.push(o);
  }
  return out;
}

/**
 * Fill in sectionCount for rows written before the column existed. Reads the
 * lyrics column once, writes the counts, sets a flag, and never runs again.
 * Row-aligned against the physical sheet so blank rows cannot shift it.
 */
function backfillCounts() {
  if (metaGet('countsBackfilled') === 'v2') return;
  var sh = sheetFor(TAB_SONGS, SONG_COLS);
  var last = sh.getLastRow();
  if (last >= 2) {
    var n = last - 1;
    var sIdx = SONG_COLS.indexOf('sections') + 1;
    var cIdx = SONG_COLS.indexOf('sectionCount') + 1;
    var lIdx = SONG_COLS.indexOf('lineCount') + 1;
    var secs = sh.getRange(2, sIdx, n, 1).getValues();
    var counts = [], lines = [];
    for (var i = 0; i < n; i++) {
      var parsed = parseJson(secs[i][0], []);
      var u = unitCounts(parsed);
      counts.push([u.sections ? u.sections : '']);
      // lineCount and wordCount are adjacent, so one write covers both
      lines.push([u.lines || '', u.words || '']);
    }
    sh.getRange(2, cIdx, n, 1).setValues(counts);
    sh.getRange(2, lIdx, n, 2).setValues(lines);
  }
  metaSet('countsBackfilled', 'v2');
}

function rowValues(cols, obj) {
  var r = [];
  for (var i = 0; i < cols.length; i++) {
    var v = obj[cols[i]];
    r.push(v === undefined || v === null ? '' : v);
  }
  return r;
}

function appendRow(name, cols, obj) {
  var sh = sheetFor(name, cols);
  sh.appendRow(rowValues(cols, obj));
}

function appendRows(name, cols, objs) {
  if (!objs.length) return;
  var sh = sheetFor(name, cols);
  var block = [];
  for (var i = 0; i < objs.length; i++) block.push(rowValues(cols, objs[i]));
  sh.getRange(sh.getLastRow() + 1, 1, block.length, cols.length).setValues(block);
}

function writeRow(name, cols, row, obj) {
  var sh = sheetFor(name, cols);
  sh.getRange(row, 1, 1, cols.length).setValues([rowValues(cols, obj)]);
}

function deleteRow(name, cols, row) {
  sheetFor(name, cols).deleteRow(row);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* The Meta tab was being re-read on every single lookup, and getSettings does
   two lookups, and getSettings is called three times in one request. That alone
   was eight round trips to fetch four small values. */
var _metaRows = null;

function metaRows() {
  if (!_metaRows) _metaRows = readRows(TAB_META, META_COLS);
  return _metaRows;
}

function metaGet(key) {
  var rows = metaRows();
  for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i].value;
  return null;
}

function metaSet(key, value) {
  _metaRows = null;                       // it is about to be stale
  var rows = readRows(TAB_META, META_COLS);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key === key) { writeRow(TAB_META, META_COLS, rows[i]._row, { key: key, value: value }); return; }
  }
  appendRow(TAB_META, META_COLS, { key: key, value: value });
}


/* ============================================================
   Song records
   ============================================================ */

function normalizeTitle(t) {
  var s = String(t || '').toLowerCase();
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    var code = s.charCodeAt(i);
    var isNum = code >= 48 && code <= 57;
    var isAlpha = code >= 97 && code <= 122;
    if (isNum || isAlpha) out += ch;
  }
  return out;
}

/**
 * What a song holds, counted once: sections that can be played, lines in them,
 * and words in those. The time limits are rates per unit, so the picker needs
 * these for every song in the library and cannot afford to fetch the lyrics of
 * all 242 to get them.
 */
function unitCounts(sections) {
  var secs = 0, lines = 0, words = 0;
  for (var i = 0; i < (sections || []).length; i++) {
    var sec = sections[i];
    if (!sec || sec.type === 'marker') continue;
    var got = 0;
    for (var j = 0; j < (sec.lines || []).length; j++) {
      var t = sec.lines[j] && sec.lines[j].t;
      if (!t) continue;
      got++;
      lines++;
      var parts = String(t).split(' ');
      for (var k = 0; k < parts.length; k++) if (parts[k] !== '') words++;
    }
    if (got) secs++;
  }
  return { sections: secs, lines: lines, words: words };
}

function songFromRow(r) {
  return {
    id: r.id,
    title: r.title,
    titleKey: r.titleKey,
    artist: r.artist,
    meta: parseJson(r.meta, []),
    sections: parseJson(r.sections, []),
    listIds: parseJson(r.listIds, []),
    youtube: r.youtube,
    spotify: r.spotify,
    needsChorusTag: r.needsChorusTag === true || r.needsChorusTag === 'TRUE' || r.needsChorusTag === 'true',
    source: r.source,
    createdAt: Number(r.createdAt) || 0,
    updatedAt: Number(r.updatedAt) || 0,
    // rows written before the column existed fall back to creation order
    sortIndex: (r.sortIndex === '' || r.sortIndex === null || r.sortIndex === undefined)
      ? (Number(r.createdAt) || 0) : Number(r.sortIndex),
    headingId: r.headingId || '',
    // stored so the index never has to open the lyrics to count them
    sectionCount: (r.sectionCount === '' || r.sectionCount === null ||
                   r.sectionCount === undefined) ? null : Number(r.sectionCount),
    // same idea, for the two counts the game time limits are rates against
    lineCount: (r.lineCount === '' || r.lineCount === null ||
                r.lineCount === undefined) ? null : Number(r.lineCount),
    wordCount: (r.wordCount === '' || r.wordCount === null ||
                r.wordCount === undefined) ? null : Number(r.wordCount),
    /* What the app has learned about which PARTS of this song you know. Rides
       on the song rather than the index: the index is read for all 242 songs on
       every boot and has to stay small. */
    heat: parseJson(r.heat, null),
    // the chord shapes, and the fret. The sounding key is worked out on the
    // page from these two and never stored, so it cannot drift from them.
    playKey: String(r.playKey || ''),
    capo: capoFromRow(r.capo, null),
    _row: r._row
  };
}

/* A blank capo cell means it was never set, so the songbook's own "Capo II"
   line stands in for it. Anything chosen in the app - "No capo" included, which
   is stored as 0 - wins over the doc from then on. The stand-in is applied
   only where a song is handed to the page (apiGetSong), never on the way back
   to the sheet, so a re-import that changes the doc's capo line is still
   picked up. */
function capoFromRow(v, meta) {
  if (v !== '' && v !== null && v !== undefined && !isNaN(Number(v))) {
    return Math.max(0, Math.min(12, Math.round(Number(v))));
  }
  for (var i = 0; i < (meta || []).length; i++) {
    var m = String(meta[i]).match(/^\s*capo\s*(?:on\s*)?(?:fret\s*)?([ivx]+|\d+)\b/i);
    if (!m) continue;
    var n = /^\d+$/.test(m[1]) ? Number(m[1]) : romanValue(m[1]);
    if (n >= 1 && n <= 12) return n;
  }
  return null;
}
function romanValue(r) {
  var v = { i: 1, v: 5, x: 10 }, s = String(r).toLowerCase(), out = 0;
  for (var i = 0; i < s.length; i++) {
    var a = v[s.charAt(i)], b = v[s.charAt(i + 1)] || 0;
    out += a < b ? -a : a;
  }
  return out;
}

function songToRow(s) {
  return {
    id: s.id,
    title: s.title,
    titleKey: normalizeTitle(s.title),
    artist: s.artist || '',
    meta: JSON.stringify(s.meta || []),
    sections: JSON.stringify(s.sections || []),
    listIds: JSON.stringify(s.listIds || []),
    youtube: s.youtube || '',
    spotify: s.spotify || '',
    needsChorusTag: !!s.needsChorusTag,
    source: s.source || 'manual',
    createdAt: s.createdAt || Date.now(),
    updatedAt: Date.now(),
    sortIndex: (s.sortIndex === undefined || s.sortIndex === null || s.sortIndex === '')
      ? (s.createdAt || Date.now()) : Number(s.sortIndex),
    headingId: s.headingId || '',
    sectionCount: unitCounts(s.sections).sections,
    lineCount: unitCounts(s.sections).lines,
    wordCount: unitCounts(s.sections).words,
    /* Round-trips through songFromRow, so every read-modify-write path that
       goes through here - list membership, chorus tagging - carries the
       standings across without having to know they exist. */
    heat: s.heat ? JSON.stringify(s.heat) : '',
    playKey: s.playKey || '',
    capo: (s.capo === null || s.capo === undefined || s.capo === '') ? '' : Number(s.capo)
  };
}

/* ============================================================
   The heatmap: what the app has learned about you
   ------------------------------------------------------------
   Every word, line and verse carries a STANDING from 0 to 100. Everything
   starts at 100 and only moves when a run says something about it:

     standing += (target - standing) x rate x weight

   The three grains differ only in what the target is. A word is 0 or 100 -
   you had it or you did not. A line is the SHARE of that line's tested words
   the run got right, and a verse the share of that verse's. So one fluffed
   word out of eight dents its line to 87.5 rather than condemning it, and
   barely touches a thirty-two word verse.

   Because every move is a fraction of the distance remaining, a standing can
   never leave 0-100 and never needs clamping, and an item that has been wrong
   ten times does not sit on a floor pretending it is as bad as it can get.

   THE CLIENT OWNS THE ADDRESS SPACE. It sends {s, l, w, ok} against real
   sections, their non-empty lines and the words in them; the server grows the
   blob to fit whatever arrives and never has to agree with the page about how
   many words a line holds. The one place it does need to know is the
   re-anchor, which is why heatWordCount exists and why it splits exactly the
   way the page does.
   ============================================================ */

var HEAT_VERSION = 1;

function blankHeat() { return { v: HEAT_VERSION, sections: [] }; }

/** Split a line the way the PAGE splits it. These two must not drift. */
function heatWordCount(t) {
  var parts = String(t || '').split(TAB_CHAR).join(' ').split(' '), n = 0;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === '') continue;
    /* THE PAGE'S words() DROPS A TOKEN WITH NO LETTERS IN IT as of 1.52, and
       this has to drop the same ones or the heat address space is off by one
       from the run that filled it - every tint after a stray dash would land
       on the wrong word. The two splitters must not drift; that is the whole
       reason this function exists rather than calling the page's. */
    if (!heatHasLetter(parts[i])) continue;
    n++;
  }
  return n;
}

/**
 * Does this token carry a letter at all?
 *
 * THIS IS THE PAGE'S isLetterCode, and it has to stay that way: accented
 * letters count, and the curly marks a word processor makes do not. The two
 * readings living in two halves of one file is the price of the page being a
 * template literal; they are checked against each other by inspection, and the
 * cost of them drifting is every heat tint after a stray dash landing on the
 * wrong word.
 */
var HEAT_HIGH_PUNCT = {};
(function () {
  var codes = [8216, 8217, 8218, 8219, 8220, 8221, 8222, 8223,
               8208, 8209, 8210, 8211, 8212, 8213,
               8226, 8230, 8231, 8242, 8243,
               171, 187, 183, 8194, 8195, 8201, 8203];
  for (var i = 0; i < codes.length; i++) HEAT_HIGH_PUNCT[codes[i]] = true;
})();

function heatHasLetter(w) {
  var t = String(w || '');
  for (var i = 0; i < t.length; i++) {
    var c = t.charCodeAt(i);
    if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) return true;
    if (c > 127 && !HEAT_HIGH_PUNCT[c]) return true;
  }
  return false;
}

/** The heat address space: real sections, each as its list of non-empty lines. */
function heatSections(sections) {
  var out = [];
  for (var i = 0; i < (sections || []).length; i++) {
    var sec = sections[i];
    if (!sec || sec.type === 'marker') continue;
    var text = [];
    for (var j = 0; j < (sec.lines || []).length; j++) {
      if (sec.lines[j] && sec.lines[j].t) text.push(sec.lines[j].t);
    }
    if (text.length) out.push(text);
  }
  return out;
}

function heatSectionAt(h, i) {
  while (h.sections.length <= i) {
    h.sections.push({ verse: [100, 0, 0], lines: [], words: [] });
  }
  return h.sections[i];
}
function heatLineAt(sec, j) {
  while (sec.lines.length <= j) { sec.lines.push([100, 0, 0]); sec.words.push([]); }
  return sec.lines[j];
}
function heatWordAt(sec, j, k) {
  heatLineAt(sec, j);
  var row = sec.words[j];
  while (row.length <= k) row.push([100, 0]);
  return row[k];
}

/**
 * How much a standing is still worth as a claim about you TODAY. Halves every
 * `fade` days. Nothing decays the standing itself - inventing a value nothing
 * measured would be a lie of a different kind - only how far the app is
 * prepared to move off it, and how much ink the page spends on it.
 */
function heatFresh(lastDay, today, fade) {
  if (!lastDay) return 0;
  var days = today - lastDay;
  if (!(days > 0)) return 1;
  return Math.pow(0.5, days / Math.max(1, Number(fade) || 90));
}

/**
 * One observation against one standing.
 *
 * STALE EVIDENCE YIELDS TO FRESH EVIDENCE TWICE AS FAST, so coming back to a
 * song after six months is not sticky. But that boost applies only where there
 * IS prior evidence: an untested item sits at 100 because 100 is the
 * assumption, not because anything measured it, and doubling the first
 * observation against a default would make one slip look like three.
 */
function heatMove(cell, target, weight, fresh, st) {
  var cur = Number(cell[0]);
  var rate = (target < cur ? Number(st.sting) : Number(st.mend)) / 100;
  if (cell[1] > 0) rate = rate * (2 - fresh);
  rate = rate * weight;
  if (rate > 1) rate = 1;
  if (rate < 0) rate = 0;
  var next = Math.round(cur + (target - cur) * rate);
  cell[0] = next < 0 ? 0 : (next > 100 ? 100 : next);
  cell[1] = Math.min(99, (Number(cell[1]) || 0) + 1);
}

/**
 * Fold one run's observations into a song's standings.
 *
 * obs is a list of {s, l, w, ok}: w >= 0 is a word, w < 0 with l >= 0 is a
 * whole line (the placement games), and l < 0 is a whole verse. THE LINE AND
 * VERSE ROLLUPS FROM WORD EVIDENCE ARE DERIVED HERE, never sent, so the page
 * and the server cannot disagree about them.
 */
function heatApply(heat, obs, weight, today, st) {
  var h = (heat && Number(heat.v) === HEAT_VERSION && heat.sections)
    ? heat : blankHeat();
  var byLine = {}, bySec = {}, i, o, s, l, w, key;

  for (i = 0; i < obs.length; i++) {
    o = obs[i] || {};
    s = Number(o.s); l = Number(o.l); w = Number(o.w);
    if (!(s >= 0)) continue;
    var sec = heatSectionAt(h, s);

    if (l >= 0 && w >= 0) {
      // a word: graded against the line's freshness, since the line is what
      // carries the day stamp for everything inside it
      var cell = heatWordAt(sec, l, w);
      heatMove(cell, o.ok ? 100 : 0, weight,
               heatFresh(sec.lines[l][2], today, st.fade), st);
      key = s + '|' + l;
      if (!byLine[key]) byLine[key] = { s: s, l: l, n: 0, ok: 0 };
      byLine[key].n++; if (o.ok) byLine[key].ok++;
      if (!bySec[s]) bySec[s] = { n: 0, ok: 0 };
      bySec[s].n++; if (o.ok) bySec[s].ok++;
    } else if (l >= 0) {
      var lc = heatLineAt(sec, l);
      heatMove(lc, o.ok ? 100 : 0, weight, heatFresh(lc[2], today, st.fade), st);
      lc[2] = today;
    } else {
      heatMove(sec.verse, o.ok ? 100 : 0, weight,
               heatFresh(sec.verse[2], today, st.fade), st);
      sec.verse[2] = today;
    }
  }

  /* The rollups. Each reads its OWN old day stamp for freshness and is stamped
     afterwards, so a line is never graded against the timestamp this very run
     is about to give it. */
  for (key in byLine) {
    if (!byLine.hasOwnProperty(key)) continue;
    var b = byLine[key];
    var line = heatLineAt(heatSectionAt(h, b.s), b.l);
    heatMove(line, Math.round(100 * b.ok / b.n), weight,
             heatFresh(line[2], today, st.fade), st);
    line[2] = today;
  }
  for (key in bySec) {
    if (!bySec.hasOwnProperty(key)) continue;
    var v = bySec[key];
    var vs = heatSectionAt(h, Number(key));
    heatMove(vs.verse, Math.round(100 * v.ok / v.n), weight,
             heatFresh(vs.verse[2], today, st.fade), st);
    vs.verse[2] = today;
  }
  return h;
}

/**
 * Carry standings across an edit to the lyrics.
 *
 * Addresses are positional, which is compact and needs no keys, and which
 * breaks exactly once: when the words move. So lines are matched on their
 * NORMALISED TEXT, each old line claimable once. Words come with a line only
 * when the count still matches - a line with a word added is a different line
 * to be tested on. A section inherits the verse standing of whichever old
 * section it shares the most lines with.
 *
 * Fixing a typo therefore keeps the history for the whole song; rewriting a
 * verse resets that verse and nothing else; reordering costs nothing at all.
 */
function heatReanchor(oldHeat, oldSections, newSections) {
  if (!oldHeat || Number(oldHeat.v) !== HEAT_VERSION || !oldHeat.sections) return null;
  var oldText = heatSections(oldSections), newText = heatSections(newSections);
  if (!oldText.length || !newText.length) return null;

  // every old line, by normalised text, with where it came from
  var pool = {}, s, l, k;
  for (s = 0; s < oldText.length; s++) {
    for (l = 0; l < oldText[s].length; l++) {
      k = heatNorm(oldText[s][l]);
      if (!pool[k]) pool[k] = [];
      pool[k].push({ s: s, l: l });
    }
  }

  var out = blankHeat();
  for (s = 0; s < newText.length; s++) {
    var sec = heatSectionAt(out, s);
    var votes = {};
    for (l = 0; l < newText[s].length; l++) {
      heatLineAt(sec, l);
      k = heatNorm(newText[s][l]);
      var from = (pool[k] && pool[k].length) ? pool[k].shift() : null;
      if (!from) continue;
      var oldSec = oldHeat.sections[from.s];
      if (!oldSec || !oldSec.lines || !oldSec.lines[from.l]) continue;
      sec.lines[l] = oldSec.lines[from.l].slice();
      var oldWords = (oldSec.words && oldSec.words[from.l]) ? oldSec.words[from.l] : [];
      // the same words, or none: a line that gained a word is a new question
      if (oldWords.length === heatWordCount(newText[s][l])) {
        var copy = [];
        for (var q = 0; q < oldWords.length; q++) copy.push(oldWords[q].slice());
        sec.words[l] = copy;
      }
      votes[from.s] = (votes[from.s] || 0) + 1;
    }
    var best = -1, bestN = 0;
    for (var v in votes) {
      if (votes.hasOwnProperty(v) && votes[v] > bestN) { bestN = votes[v]; best = Number(v); }
    }
    if (best >= 0 && oldHeat.sections[best] && oldHeat.sections[best].verse) {
      sec.verse = oldHeat.sections[best].verse.slice();
    }
  }
  return out;
}

/** Letters and digits only - the same reading of "the same line" the graders use. */
function heatNorm(t) {
  var s2 = String(t || '').toLowerCase(), out = '';
  for (var i = 0; i < s2.length; i++) {
    var c = s2.charCodeAt(i);
    if ((c >= 48 && c <= 57) || (c >= 97 && c <= 122)) out += s2.charAt(i);
  }
  return out;
}

function parseJson(v, fallback) {
  if (v === '' || v === null || v === undefined) return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (e) { return fallback; }
}

var TAB_CHAR = String.fromCharCode(9);
var NL_CHAR  = String.fromCharCode(10);


/* ============================================================
   Scoring: points, and a song that runs hot or cold
   ------------------------------------------------------------
   Each quiz banks points, scaled by how well you did:

     points = DEFAULT_POINTS[mode] x how far above the floor you scored

   Where those points go depends on the song's state.

   HOT means the song is resting and loses nothing. A quiz puts it
   there and buys HOT_PCT% of the points earned, rounded, in days:
   30 points at 10% is 3 days. The counter ticks down one a night and
   0 is still hot - it is the last day before the song turns.

   COLD means the song is bleeding. The night it turns it loses
   nothing, but it starts carrying a rate of DECAY_PER_DAY. Every
   night after that the rate comes off the score and then grows by
   DECAY_PER_DAY again: 1, then 2, then 3. Neglect compounds, which
   is the whole point - a song left alone for a fortnight is not
   twice as forgotten as one left a week, it is far worse.

   Practising a cold song pays the rate down before it buys any hot
   days, AND THE PAYMENT COMES OUT OF THE AWARD. Losing 5 a night
   and you bank 3? The rate drops to 2, the song stays cold, and the
   score has not moved - the three points went to the arrears. Bank
   30 and the rate clears for 5, leaving 25 to go on the score and
   convert into 3 hot days.

   Once a score hits zero the rate stops growing. There is nothing
   left to take, and letting it climb forever would put a song
   permanently out of reach of any single quiz.

   Because the state depends on the ORDER of quizzes and gaps
   between them, none of this has a closed form - scoreFromAttempts
   walks the history a night at a time. It is still cheap: hot
   stretches are skipped in one jump and a cold song reaches zero
   in a handful of nights, after which nothing changes at all.

   Deliberately uncapped - quiz something often enough and it keeps
   going up - which is why the colours everywhere are percentile-based
   rather than fixed thresholds.

   Every knob is here. Change a number and the whole app follows,
   including all past attempts, since points are recomputed from
   accuracy and level rather than stored.
   ============================================================ */

/**
 * The quiz ladder, easiest first. pts is what a flawless run banks; all of
 * these are tunable from Settings, along with the decay and the floor.
 */
/**
 * GAMES are tapping and recognition. QUIZZES are typing and recall, and carry
 * the weight. Both are tunable, and every game has three levels of its own.
 *
 * THE IDS NEVER MOVE. Labels have been reshuffled twice now - what is called
 * Easy today was Medium yesterday and old-Easy before that - but an attempt
 * recorded under `medium` in March has to keep meaning the same measurement in
 * September, so the id stays put and only the label changes. The mapping as of
 * 1.2a:
 *
 *   id            label       mask
 *   firstLines    Blank Lines whole lines removed, no shape given
 *   easy          Beginner    the opening words of each line
 *   medium        Easy        the first letter of every word
 *   hard          Medium      a blank per letter
 *   blind         Hard        nothing at all
 *   verseOrder    Build       (was Verse Order)
 *   lineOrder     Build       (was Line Order)
 *
 * unit is what one run is measured in - a game that walks six verses and a quiz
 * that makes you type four hundred words are not comparable per anything.
 */
var QUIZ_MODES = [
  { id: 'verseSort',    kind: 'game', family: 'sort',     variant: 'Verses', unit: 'verse',
    label: 'Order Verses',     full: 'Order Verses',
    blurb: 'Put the sections back in order. Some are lifted from other songs, some are this song with the words tampered with - throw both out.' },
  { id: 'lineSort',     kind: 'game', family: 'sort',     variant: 'Lines',  unit: 'line',
    label: 'Order Lines',      full: 'Order Lines',
    blurb: 'The same idea, line by line inside one section. Some strays are this song, from another part of it.' },

  { id: 'verseOrder',   kind: 'game', family: 'build',    variant: 'Verses', unit: 'verse',
    label: 'Build Verses',     full: 'Build Verses',
    blurb: 'One at a time: which section comes next? The wrong answers include tampered copies of your own.' },
  { id: 'lineOrder',    kind: 'game', family: 'build',    variant: 'Lines',  unit: 'line',
    label: 'Build Lines',      full: 'Build Lines',
    blurb: 'One at a time: which line comes next?' },

  /* THE BIGGER CHUNK GOES ON THE LEFT, in every family. Order and Build read
     Verses then Lines; Scramble and Impostor used to read Words then Lines,
     which put the smaller unit first in half the picker and made the four
     cards disagree with each other about which way the axis ran. The ids have
     not moved - only the order they are listed in - so no history changes. */
  { id: 'lineScramble', kind: 'game', family: 'scramble', variant: 'Lines',  unit: 'line',
    label: 'Scramble Lines',   full: 'Scramble Lines',
    blurb: 'The whole song, with lines lifted out of it. Put them back - the bank holds a few that were never there.' },
  { id: 'wordScramble', kind: 'game', family: 'scramble', variant: 'Words',  unit: 'word',
    label: 'Scramble Words',   full: 'Scramble Words',
    blurb: 'Words are lifted out of every section. Tap them back where they belong - the bank holds a few that never belonged.' },

  { id: 'lineImpostor', kind: 'game', family: 'impostor', variant: 'Lines',  unit: 'line',
    label: 'Impostor Lines',   full: 'Impostor Lines',
    blurb: 'The whole song, no extra rows, some lines wrong. Tapping a line swaps it - leave the page reading right.' },
  { id: 'wordImpostor', kind: 'game', family: 'impostor', variant: 'Words',  unit: 'word',
    label: 'Impostor Words',   full: 'Impostor Words',
    blurb: 'The whole song, with words swapped for fakes. Tapping a word swaps it again - leave the page reading right.' },

  { id: 'firstLines',   kind: 'quiz', unit: 'word',  tier: 0,
    label: 'Beginner - Blank Lines', full: 'Beginner - Blank Lines',
    blurb: 'One line taken out of every section, with the rest of it around you. The blanks show you its shape.' },
  { id: 'easy',         kind: 'quiz', unit: 'word',  tier: 0,
    label: 'Beginner - Opening Words', full: 'Beginner - Opening Words',
    blurb: 'The opening words of each line are showing.' },
  { id: 'medium',       kind: 'quiz', unit: 'word',  tier: 1, label: 'Easy', full: 'Easy',
    /* Deliberately vague as of 1.51: what this rung shows is four dials now,
       and a blurb that named one setting would be wrong the moment any of them
       moved. The picker prints the real arrangement underneath - see
       letterRuleText. */
    blurb: 'Some of the letters of every word are showing.' },
  { id: 'hard',         kind: 'quiz', unit: 'word',  tier: 2, label: 'Medium', full: 'Medium',
    blurb: 'A blank for every letter, and nothing else.' },
  { id: 'blind',        kind: 'quiz', unit: 'word',  tier: 3, label: 'Hard', full: 'Hard',
    blurb: 'No blanks, no shape, no help. Just an empty line.' }
];

/* The four families, in the order the picker lays them out. Each is one card
   with two columns. */
var GAME_FAMILIES = [
  { id: 'sort',     label: 'Order',    blurb: 'Drag to put them back in order' },
  { id: 'build',    label: 'Build',    blurb: 'One at a time: what comes next?' },
  { id: 'scramble', label: 'Scramble', blurb: 'Put back what has been taken out' },
  { id: 'impostor', label: 'Impostor', blurb: 'Tap whatever does not belong' }
];

/* THE ORDER THE EIGHT GAMES OPEN IN - 1.50.
 *
 * A fresh song offers ONE thing: Order Verses on Easy. Banking on a game opens
 * the next game in this list at Easy, and opens Medium on the game you just
 * passed; banking on that Medium opens its Hard. So the eight are walked
 * ACROSS before they are walked UP, and the first thing anyone meets on a song
 * they have never sung is the gentlest question the app asks.
 *
 * The order is roughly how much of the song each one demands: whole sections
 * first, then lines, then individual words, with the two verse games at the
 * head because they are the only ones you can play knowing the shape of a song
 * and not much else.
 *
 * A SONG THAT CANNOT PLAY A GAME DOES NOT STOP THE CHAIN. The two verse games
 * need three sections, and on a two-section song they are simply not in the
 * chain at all - otherwise the head of the list would be a locked door with no
 * key, and the song would offer nothing at all, forever.
 */
var GAME_CHAIN = ['verseSort', 'verseOrder', 'lineScramble', 'lineImpostor',
                  'lineSort', 'lineOrder', 'wordScramble', 'wordImpostor'];

/** The two that need three sections to have a board at all. */
var VERSE_GAMES = { verseSort: 1, verseOrder: 1 };

/** The chain as it applies to one song, with what it cannot play left out. */
function gameChainFor(sectionCount) {
  var out = [];
  for (var i = 0; i < GAME_CHAIN.length; i++) {
    var id = GAME_CHAIN[i];
    if (VERSE_GAMES[id] && Number(sectionCount || 0) < 3) continue;
    out.push(id);
  }
  return out;
}

/* Modes that used to exist. Old attempts still point at them, and a history
   entry with no name at all is worse than a retired one.

   THE FIRST LINES GAME IS GONE FROM HERE AS OF 1.50 - its runs are deleted
   from the sheet outright by purgeRetiredModes, so there is no longer a row
   anywhere for this table to name. */
var RETIRED_MODES = {};


/* ============================================================
   Medals
   ============================================================ */

/**
 * FOUR MEDALS PER SONG, and they are the only thing in the app that changes
 * what a run is WORTH rather than what it unlocks.
 *
 * The multiplier goes on hotPct - the share of a quiz's points that becomes
 * rest days. A song with no medal converts at the dial (10% by default); a
 * bronze converts at twice that and a platinum at five times. So a song you
 * have genuinely finished holds its heat for a week off the same run that
 * buys a stranger a single day, and the library starts rewarding depth
 * instead of only breadth.
 *
 * Deliberately NOT a points multiplier. Points are the record of what you
 * actually did; multiplying them would rewrite your history the moment a medal
 * landed, and the score-over-time chart would climb for reasons that had
 * nothing to do with the runs drawn on it. Rest days are a claim about the
 * FUTURE, which is the right tense for a reward.
 */
var MEDALS = ['bronze', 'silver', 'gold', 'platinum'];
/* THE DEFAULTS, not the rule - 1.63. These four and the hot share they multiply
   are the whole economy of the medals, and they were the last numbers in that
   economy that could only be changed by editing this file. They are dials now,
   stored in the settings blob beside the hot share itself, and everything below
   reads them through medalMultOf rather than off this object. It stays as what
   a fresh install starts with and what the reset button goes back to. */
var MEDAL_MULT = { bronze: 2, silver: 3, gold: 4, platinum: 5 };
function defaultMedalMult() {
  var out = {};
  for (var i = 0; i < MEDALS.length; i++) out[MEDALS[i]] = MEDAL_MULT[MEDALS[i]];
  return out;
}
/** What a tier multiplies the hot share by, as the settings currently stand. */
function medalMultOf(settings, tier) {
  if (!tier) return 1;
  var m = settings && settings.medalMult;
  var v = m ? Number(m[tier]) : NaN;
  if (!(v >= 0)) v = MEDAL_MULT[tier] || 1;
  return v;
}
var MEDAL_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };

/**
 * WHAT EACH MEDAL ASKS FOR, in the order they have to be earned.
 *
 *   games   [level, perfect]  every playable game banked at that level;
 *                             perfect means at 100% as well as banked
 *   quiz    [mode, perfect]   that quiz rung banked, optionally at 100%
 *
 * Every tier implies the one below it BY CONSTRUCTION rather than by listing
 * its requirements over again: the tiers are checked in order and a later one
 * cannot be met until every earlier one is. That is what makes the dates mean
 * something - a silver date is the day the silver conditions closed, and it
 * can never fall before the bronze.
 *
 * The quiz ids are the ones that NEVER MOVE: 'medium' is the rung labelled
 * Easy, 'hard' is Medium, 'blind' is Hard. See the note above QUIZ_MODES.
 */
var MEDAL_SPEC = {
  bronze: {
    games: [['easy', false]],
    quizzes: [['firstLines', true], ['easy', true], ['medium', false]]
  },
  silver: {
    games: [['medium', false], ['easy', true]],
    quizzes: [['medium', true], ['hard', false]]
  },
  gold: {
    games: [['hard', false], ['medium', true]],
    quizzes: [['hard', true], ['blind', false]]
  },
  platinum: {
    games: [['hard', true]],
    quizzes: [['blind', true]]
  }
};

/* HOW EACH REQUIREMENT IS WORDED - 1.52.
 *
 * "every game on Medium and clean on Easy" reads as one condition with a
 * qualifier, and it is two. It also leaned on "clean", which is a word this
 * app made up for the occasion. Every line says PASSED or 100% now, because
 * those are the two things a run can be and the difference between them is the
 * whole structure of the medals.
 *
 * The labels live beside the rules rather than on the page, so the checklist
 * and the requirement it is checking cannot come to say different things. */
var LEVEL_WORD = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
var QUIZ_WORD = {
  firstLines: 'Beginner - Blank Lines', easy: 'Beginner - Opening Words',
  medium: 'Easy quiz', hard: 'Medium quiz', blind: 'Hard quiz'
};

function medalGameLabel(level, perfect) {
  return perfect
    ? 'Every game 100% on ' + LEVEL_WORD[level]
    : 'Every game passed on ' + LEVEL_WORD[level];
}
function medalQuizLabel(mode, perfect) {
  return QUIZ_WORD[mode] + (perfect ? ' 100%' : ' passed');
}

/**
 * WHAT ONE OUTSTANDING REQUIREMENT IS WORTH, which is the whole of the Medals
 * sort - 1.61.
 *
 * The sort ranks a song by the medal it holds and then, inside that band, by
 * how much work is left before the next one. "How much work" needs a number,
 * and the number has to agree with what the app already believes is hard:
 *
 *   passing a game  <  100% on a game  <  passing a quiz  <  100% on a quiz
 *
 * so the four classes get four BANDS rather than four multipliers, and the
 * difficulty inside a class only ever moves a requirement within its own band.
 * Bands rather than multipliers because the ordering above is the stated one and
 * a multiplier lets it cross over - five times a game comes out as a quiz,
 * which is the one thing this must never say. The rung or the level adds 1 to 4
 * on top, so Hard outranks Easy without ever outranking the class above it.
 *
 * It lives HERE, beside MEDAL_SPEC and the labels, for the same reason the
 * labels do: a requirement cannot be weighed in one place and described in
 * another and be trusted to still mean the same thing. The page sums the undone
 * ones and never decides what any one of them is worth.
 *
 * The numbers are deliberately coarse. They are a RANKING, not a currency -
 * nothing is paid out of them and nothing is stored, so changing one reorders a
 * list and does nothing else anywhere in the app.
 */
var MEDAL_COST_BAND = { gamePass: 0, gamePerfect: 10, quizPass: 20, quizPerfect: 30 };
var QUIZ_RUNG = { firstLines: 1, easy: 1, medium: 2, hard: 3, blind: 4 };
var LEVEL_RUNG = { easy: 1, medium: 2, hard: 3 };

function medalGameCost(level, perfect) {
  return MEDAL_COST_BAND[perfect ? 'gamePerfect' : 'gamePass'] + (LEVEL_RUNG[level] || 1);
}
function medalQuizCost(mode, perfect) {
  return MEDAL_COST_BAND[perfect ? 'quizPerfect' : 'quizPass'] + (QUIZ_RUNG[mode] || 1);
}

/**
 * Which medals a song holds, and the day each one was earned.
 *
 * Walked FORWARD through the history rather than tested against the finished
 * totals, because the date is half the answer. A song that has everything a
 * gold needs cannot be told, from the totals alone, whether that happened last
 * night or eighteen months ago - and the expanded card promises to say. So the
 * requirements are accumulated a run at a time and each tier is stamped the
 * first moment it closes.
 *
 * Banking is the test, exactly as it is for the ladders: a run at or under the
 * floor proves nothing, and a practice run is not in the history at all. A
 * perfect run has to bank AND read 100% - a flawless practice run is still a
 * practice run.
 *
 * sectionCount decides which games count. A two-section song has no board for
 * the two verse games, so asking for all eight would put every medal out of
 * reach of a whole shelf of the library for a reason that has nothing to do
 * with how well any of it is known.
 */
function medalsFor(ascending, settings, sectionCount) {
  var st = settings || getSettings();
  var chain = gameChainFor(sectionCount);
  var pass = {}, perfect = {}, qPass = {}, qPerfect = {};
  var earned = { bronze: null, silver: null, gold: null, platinum: null };

  function haveGames(level, wantPerfect) {
    var book = wantPerfect ? perfect : pass;
    for (var i = 0; i < chain.length; i++) {
      if (!book[chain[i] + '|' + level]) return false;
    }
    return chain.length > 0;
  }
  function haveQuiz(mode, wantPerfect) {
    return !!(wantPerfect ? qPerfect : qPass)[mode];
  }
  /** This tier AND every tier under it, so silver can never precede bronze. */
  function met(tier) {
    for (var t = 0; t < MEDALS.length; t++) {
      var name = MEDALS[t];
      var spec = MEDAL_SPEC[name];
      for (var g = 0; g < spec.games.length; g++) {
        if (!haveGames(spec.games[g][0], spec.games[g][1])) return false;
      }
      for (var q = 0; q < spec.quizzes.length; q++) {
        if (!haveQuiz(spec.quizzes[q][0], spec.quizzes[q][1])) return false;
      }
      if (name === tier) return true;
    }
    return false;
  }

  for (var i = 0; i < ascending.length; i++) {
    var a = ascending[i];
    if (a.practice) continue;
    var got = pointsForAttempt(a.accuracy, a.mode, st, a.speedFactor, a.level);
    if (!(got > 0)) continue;
    var flawless = Number(a.accuracy) >= 100;
    if (isGameMode(a.mode)) {
      var lv = levelOfRow(a.mode, a.level);
      pass[a.mode + '|' + lv] = true;
      // 100% carries everything under it - see spreadGamePerfect
      if (flawless) spreadGamePerfect(pass, perfect, a.mode, lv);
    } else {
      qPass[a.mode] = true;
      if (flawless) spreadQuizPerfect(qPass, qPerfect, a.mode);
    }
    for (var t2 = 0; t2 < MEDALS.length; t2++) {
      if (earned[MEDALS[t2]] === null && met(MEDALS[t2])) earned[MEDALS[t2]] = a.date;
    }
  }

  var best = null;
  for (var b = 0; b < MEDALS.length; b++) if (earned[MEDALS[b]] !== null) best = MEDALS[b];

  /* THE CHECKLIST, taken from the state the walk finished in - which is the
     state as of today, not as of whichever run last closed a tier. The dates
     above are history; this is a to-do list, and a to-do list has to describe
     where you are standing now.
     Built from MEDAL_SPEC rather than written out again, so a requirement
     cannot be changed in one place and still be promised in the other. */
  var checks = {};
  for (var t3 = 0; t3 < MEDALS.length; t3++) {
    var tier = MEDALS[t3], spec = MEDAL_SPEC[tier], list = [];
    for (var g3 = 0; g3 < spec.games.length; g3++) {
      var lvl = spec.games[g3][0], wantP = spec.games[g3][1];
      var book = wantP ? perfect : pass;
      var doneN = 0;
      for (var c3 = 0; c3 < chain.length; c3++) if (book[chain[c3] + '|' + lvl]) doneN++;
      list.push({ label: medalGameLabel(lvl, wantP),
                  done: chain.length > 0 && doneN === chain.length,
                  at: doneN, of: chain.length,
                  cost: medalGameCost(lvl, wantP) });
    }
    for (var q3 = 0; q3 < spec.quizzes.length; q3++) {
      var qm = spec.quizzes[q3][0], qp = spec.quizzes[q3][1];
      list.push({ label: medalQuizLabel(qm, qp),
                  done: !!(qp ? qPerfect : qPass)[qm],
                  cost: medalQuizCost(qm, qp) });
    }
    checks[tier] = list;
  }

  return { earned: earned, best: best, mult: medalMultOf(st, best), checks: checks };
}

/**
 * The hot-share multiplier in force on the day of one attempt.
 *
 * A medal earned in March cannot be allowed to pay for a run taken in
 * February. The score walk replays the whole history from nothing, so it has
 * to ask what was true AT THAT POINT rather than what is true now - otherwise
 * every past quiz on a gold song would be re-credited with four times the rest
 * days it actually bought, and the curve would bear no relation to the one you
 * watched being drawn.
 */
function medalMultAt(medals, when, settings) {
  if (!medals || !medals.earned) return 1;
  var mult = 1;
  for (var i = 0; i < MEDALS.length; i++) {
    var at = medals.earned[MEDALS[i]];
    if (at !== null && at !== undefined && at <= when) {
      mult = medalMultOf(settings, MEDALS[i]);
    }
  }
  return mult;
}

/* Quizzes carry the points. A game is worth a few and is there to keep a song
   from freezing between real sittings; a quiz is where progress is made. */
var DEFAULT_POINTS = {
  firstLines: 5, easy: 5, medium: 10, hard: 25, blind: 50
};

var GAME_LEVELS = ['easy', 'medium', 'hard'];

/**
 * Every game, and which dials it actually has. The Settings screen is built
 * from this table and so are the defaults, so a game can never be tunable in
 * one place and not the other.
 *
 *   editN    how many tampered copies of this song's own material to plant
 *   editPct  how much of a tampered unit gets swapped for fake words. HIGH is
 *            EASY: a verse with a third of its words wrong is obvious on
 *            sight, one with a tenth wrong has to be read
 *   borrowN  how many units planted that are NOT this song in this place -
 *            split between lines borrowed from other songs and decoys, which
 *            are this song's own lines shown somewhere they do not belong
 *   decoyPct what share of that split is decoys rather than borrowed. A
 *            borrowed line is foreign and reads foreign, so it is the easy
 *            catch; a decoy is in your own handwriting and has to be placed,
 *            which is why the harder levels lean on it
 *   missPct  Scramble: share of the words (or lines) lifted out to be put back
 *   extraN   Scramble Words: words in the bank that belong to nothing
 *   trayN    Scramble: how many chips are ON THE TRAY at once. The deck is
 *            unchanged - every missing word or line is still in it, plus the
 *            ringers - and this is the size of the WINDOW onto it. More is
 *            harder, because the haystack is bigger; see makeTray
 *   fakePct  Impostor: share of the units swapped for fakes
 *   fakesPer Impostor: how many wrong ones hide behind each unit. Tapping
 *            walks the ring, so ONE is the easy end - a tap on a planted word
 *            lands straight on the truth - and more means a tap is a guess.
 *            Asking for more than the song can supply gets you fewer, never
 *            worse ones - see fakesPerOf
 *   floor    accuracy at or under which this level banks nothing at all
 *   choiceCount  the pick-one games: how many options a question offers
 *   secsPer  the time limit, in seconds PER UNIT OF THE SONG - see below
 *
 * THE FLOOR IS PER LEVEL, not one number for the whole app. A floor is a
 * statement about how hard the thing is - 75% of an Easy board you can half
 * read off the page is not the achievement 75% of a Hard one is - so it lives
 * with the rest of that level's difficulty rather than sitting above all of
 * them. Same reason the options count sits on the two games that ask
 * questions: four options at Easy and four at Hard were never the same dial.
 *
 * The N dials are ranges - a fixed count is a tell after two rounds.
 *
 * THE TIME LIMIT IS A RATE, NOT A NUMBER. A two-verse song and a nine-verse
 * one cannot share a stopwatch, so each game states what it charges per unit of
 * whatever it walks you through - seconds per verse, per line, or per word -
 * and the limit for a given song is that rate times what the song actually
 * holds. `unit` says which count it multiplies.
 */
var GAME_SPEC = {
  verseSort:    { unit: 'section', dials: ['editN', 'editPct', 'borrowN', 'floor', 'secsPer'] },
  lineSort:     { unit: 'line',    dials: ['editN', 'editPct', 'borrowN', 'decoyPct', 'floor', 'secsPer'] },
  verseOrder:   { unit: 'section', dials: ['editN', 'editPct', 'borrowN', 'decoyPct', 'choiceCount', 'floor', 'secsPer'] },
  lineOrder:    { unit: 'line',    dials: ['editN', 'editPct', 'borrowN', 'decoyPct', 'choiceCount', 'floor', 'secsPer'] },
  wordScramble: { unit: 'word',    dials: ['missPct', 'extraN', 'trayN', 'floor', 'secsPer'] },
  /* NO DECOY DIAL, for exactly the reason Order Verses has none: the whole
     song is on the board, so a line of this song from somewhere else is
     sitting there in its real place for you to see. It stops being a question.
     What is left is BORROWED - foreign lines, the easy reject - and TAMPERED
     copies of the very lines that are missing, which is the hard one, because
     the only way to tell is to know the line. */
  lineScramble: { unit: 'line',    dials: ['missPct', 'borrowN', 'editN', 'editPct', 'trayN', 'floor', 'secsPer'] },
  wordImpostor: { unit: 'word',    dials: ['fakePct', 'fakesPer', 'floor', 'secsPer'] },
  lineImpostor: { unit: 'line',    dials: ['fakePct', 'fakesPer', 'editN', 'editPct', 'decoyPct', 'floor', 'secsPer'] }
};

/* A quiz has no levels - the mask IS the level - so it gets one set of dials
   rather than three. It is declared the same way as a game so the Settings
   screen can render both off one table and neither can be tunable in one place
   and not the other. */
/* WHICH LETTERS THE EASY RUNG SHOWS - 1.51.
 *
 * It used to be the first letter of every word, full stop. That is a very
 * particular kind of help: the first letter is the one you are most likely to
 * be able to guess from the line before it, and it turns a memory test into a
 * crossword you can often solve without the song. A letter from the MIDDLE of
 * a word is a much better prompt - it tells you the shape you are reaching for
 * without handing you the way in.
 *
 * So the rung is four dials rather than a rule:
 *
 *   letterPick    'first' - the leading letters, as it always was
 *                 'random' - that many letters, anywhere in the word
 *   letterScope   'word' - a flat count per word, the same for every word
 *                 'line' / 'verse' / 'song' - a SHARE of the letters in that
 *                 unit, spread across its words in proportion to their length
 *   letterCount   the flat count, when the scope is 'word'
 *   letterPct     the share, when it is anything else
 *
 * The two counts are kept as separate dials rather than one field read two
 * ways, because "2" and "20%" are not the same number wearing different hats -
 * and a single field would silently reinterpret whatever was in it the moment
 * you changed the scope.
 */
var LETTER_PICKS  = ['first', 'random'];
var LETTER_SCOPES = ['word', 'line', 'verse', 'song'];

var QUIZ_SPEC = {
  firstLines: { dials: ['pts', 'floor'] },
  easy:       { dials: ['pts', 'floor'] },
  medium:     { dials: ['pts', 'floor', 'letterPick', 'letterScope',
                         'letterCount', 'letterPct'] },
  hard:       { dials: ['pts', 'floor'] },
  blind:      { dials: ['pts', 'floor'] }
};

/* Not every dial is a number, and the two that are not have to be named
   somewhere both halves of the app can see - the settings screen builds a
   dropdown from this and apiSetSettings refuses anything not in it. */
var QUIZ_CHOICE_DIALS = { letterPick: LETTER_PICKS, letterScope: LETTER_SCOPES };

function isQuizMode(id) { return QUIZ_SPEC.hasOwnProperty(id); }

/** Point value and floor for every quiz, built from the two constants. */
function defaultQuizSettings() {
  var out = {};
  for (var id in QUIZ_SPEC) {
    if (!QUIZ_SPEC.hasOwnProperty(id)) continue;
    out[id] = { pts: DEFAULT_POINTS[id] === undefined ? 10 : DEFAULT_POINTS[id],
                floor: POINTS_FLOOR };
  }
  /* ONE RANDOM LETTER PER WORD is the new Easy. Same amount of help as the old
     first-letter rule by the count, and a good deal more useful per letter,
     because a middle letter cannot be inferred from the line before it. */
  out.medium.letterPick  = 'random';
  out.medium.letterScope = 'word';
  out.medium.letterCount = 1;
  out.medium.letterPct   = 20;
  return out;
}

/** The dials that decide what the Easy rung shows, whatever is in the blob. */
function letterRuleOf(settings) {
  var q = (settings && settings.quizzes && settings.quizzes.medium) || {};
  return {
    pick:  LETTER_PICKS.indexOf(q.letterPick) === -1 ? 'random' : q.letterPick,
    scope: LETTER_SCOPES.indexOf(q.letterScope) === -1 ? 'word' : q.letterScope,
    count: Math.max(0, Math.min(12, Math.round(Number(q.letterCount) || 0))),
    pct:   Math.max(0, Math.min(100, Number(q.letterPct) || 0))
  };
}

/* Ranges, percentages, rates and point values, per game per level. Built rather
   than typed out: the games share one shape and the exceptions are spelled out
   underneath. */
function defaultGameSettings() {
  /* decoyPct climbs with the level for the same reason editPct falls: the
     easy rungs plant material that announces itself, the hard ones plant
     material you can only place by knowing where it really goes. */
  var shared = {
    easy:   { pts: 1, editN: [0, 1], editPct: 30, borrowN: [0, 1], decoyPct: 20,
              floor: POINTS_FLOOR, choiceCount: CHOICE_COUNT },
    medium: { pts: 2, editN: [1, 2], editPct: 20, borrowN: [1, 2], decoyPct: 50,
              floor: POINTS_FLOOR, choiceCount: CHOICE_COUNT },
    hard:   { pts: 3, editN: [2, 3], editPct: 10, borrowN: [2, 3], decoyPct: 80,
              floor: POINTS_FLOOR, choiceCount: CHOICE_COUNT }
  };
  /* Seconds per unit, easy / medium / hard. Reading a whole verse off a card
     costs more than glancing at a line, and a line costs more than a word, so
     the three scales are an order of magnitude apart. Every one of these is a
     starting guess and every one is tunable. */
  var rates = {
    verseSort:    [22, 16, 11],     // per section, and you must order them all
    lineSort:     [7, 5, 3.5],      // per line, one board per section
    verseOrder:   [26, 19, 13],     // per section: a question each, whole verses to read
    lineOrder:    [11, 8, 5.5],     // per line: a question each
    wordScramble: [1.6, 1.3, 1],    // per word in the song
    lineScramble: [9, 7, 5],        // per line in the song
    wordImpostor: [1.3, 1, 0.8],    // per word: every one is a judgement
    lineImpostor: [7, 5, 3.5]       // per line
  };
  var out = {};
  for (var id in GAME_SPEC) {
    if (!GAME_SPEC.hasOwnProperty(id)) continue;
    out[id] = {};
    for (var i = 0; i < GAME_LEVELS.length; i++) {
      var lv = GAME_LEVELS[i];
      var src = shared[lv], cfg = { pts: src.pts };
      var dials = GAME_SPEC[id].dials;
      for (var d = 0; d < dials.length; d++) {
        var k = dials[d];
        if (src[k] !== undefined) {
          cfg[k] = (src[k] instanceof Array) ? src[k].slice() : src[k];
        }
      }
      cfg.secsPer = rates[id][i];
      out[id][lv] = cfg;
    }
  }
  // Scramble: more of the song gone, and more junk in the bank.
  out.wordScramble.easy.missPct   = 20;  out.wordScramble.easy.extraN   = [0, 1];
  out.wordScramble.medium.missPct = 40;  out.wordScramble.medium.extraN = [1, 2];
  out.wordScramble.hard.missPct   = 60;  out.wordScramble.hard.extraN   = [3, 4];

  /* HOW BIG THE TRAY IS - 1.63. A long verse used to put every missing word on
     screen at once, which on Hard is thirty-odd chips and stops being a memory
     game some way before it stops being a reading exercise. The deck is
     unchanged; this is how much of it you can see.
     MORE IS HARDER, so the numbers climb with the level - a bigger haystack,
     and less of the verse confirmed for you at any one moment. It also cuts the
     other way at the end of a board: the tray used to shrink as you spent it,
     so the last few words were a choice of three. A window stays the size it
     is until the deck itself runs out. */
  out.wordScramble.easy.trayN   = 8;
  out.wordScramble.medium.trayN = 12;
  out.wordScramble.hard.trayN   = 16;
  out.lineScramble.easy.trayN   = 8;
  out.lineScramble.medium.trayN = 12;
  out.lineScramble.hard.trayN   = 16;
  // Scramble Lines takes the same shares, applied to lines rather than words,
  // and fills its bank with tampered and borrowed lines instead of odd words.
  out.lineScramble.easy.missPct   = 20;
  out.lineScramble.medium.missPct = 40;
  out.lineScramble.hard.missPct   = 60;
  // Impostor Words grades every word as a judgement, so sitting on your hands
  // scores exactly the share NOT swapped. Below 25% doing nothing would clear
  // the 75% floor and bank points, which is why easy starts there and the
  // harder levels swap MORE, not fewer.
  out.wordImpostor.easy.fakePct   = 25;
  out.wordImpostor.medium.fakePct = 35;
  out.wordImpostor.hard.fakePct   = 45;
  /* Line Impostor is a share now for exactly the same reason. It shows the
     WHOLE song with no extra rows, so a fixed count of wrong lines would mean
     a forty-line song was 92% right for doing nothing at all - over the floor,
     banking points for sitting still. A share cannot drift with song length.
     editN is what is left of the old count: how many of those wrong lines are
     this song's own words meddled with, the rest splitting borrowed/decoy. */
  out.lineImpostor.easy.fakePct   = 30;
  out.lineImpostor.medium.fakePct = 40;
  out.lineImpostor.hard.fakePct   = 50;
  /* HOW MANY HIDE BEHIND EACH ONE. A tap walks the ring, so the count of
     fakes behind a unit is the count of taps a wrong one can cost you - and
     with one behind it, a tap on something you know is wrong lands on the
     answer. That is the easy end by construction. */
  out.wordImpostor.easy.fakesPer   = 1;
  out.wordImpostor.medium.fakesPer = 2;
  out.wordImpostor.hard.fakesPer   = 3;
  out.lineImpostor.easy.fakesPer   = 1;
  out.lineImpostor.medium.fakesPer = 2;
  out.lineImpostor.hard.fakesPer   = 3;
  return out;
}

function isGameMode(id) { return GAME_SPEC.hasOwnProperty(id); }

/**
 * WHAT YOU HAVE EARNED THE RIGHT TO PLAY, and what you have already spent today.
 *
 * Both are DERIVED FROM THE ATTEMPT HISTORY, never stored. That is the whole
 * trick: there is no unlock table to migrate, no daily counter to reset at
 * midnight and no way for the two to disagree with the runs that produced them.
 * It also means a library with years of history behind it arrives already
 * unlocked to wherever it had got to, rather than being marched back to Easy.
 *
 * GAMES ladder per song AND per game - eight of them, each on its own. Beating
 * Order Verses on Easy says nothing about whether you can hold Scramble Words
 * together at Medium.
 *
 * QUIZZES share one ladder per song, four rungs deep: the two Beginner quizzes,
 * then Easy, Medium, Hard.
 *
 * The rule for both: you may play up to one rung above the highest you have ever
 * BANKED POINTS at. Banking is the test, not attempting - a run under the floor
 * earns nothing and proves nothing. Reading it as "highest ever banked, plus
 * one" rather than "did you bank at exactly the rung below" is what keeps old
 * history sane: a song you once took at Hard does not have to be re-earned from
 * the bottom.
 */
var QUIZ_TIER_COUNT = 4;

function quizTierOf(mode) {
  for (var i = 0; i < QUIZ_MODES.length; i++) {
    if (QUIZ_MODES[i].id === mode) {
      return QUIZ_MODES[i].tier === undefined ? -1 : QUIZ_MODES[i].tier;
    }
  }
  return -1;
}

function levelIndex(level) {
  var i = GAME_LEVELS.indexOf(cleanLevel(level) || 'easy');
  return i < 0 ? 0 : i;
}

/* ============================================================
   A FLAWLESS RUN CARRIES THE RUNGS UNDER IT - 1.62
   ============================================================

 * 100% on Hard is not evidence that you could pass Medium, it is a STRICTER
 * version of the same evidence. The board is the same song, the questions are
 * the same questions, and the only thing Hard changed was how much help you
 * were given. So asking somebody who has just dropped nothing on Hard to go
 * back and drop nothing on Easy is not a requirement, it is a chore - and the
 * medals were made of exactly those chores.
 *
 * So a run at 100% ticks every rung at or below the one it was taken on, for
 * BOTH the passed and the flawless books. Anything less than 100% is left
 * alone: a 90% on Hard says nothing certain about Easy, because the ten
 * percent you dropped might be the whole of what Easy was going to ask.
 *
 * STRICTLY BELOW, on the quiz side, by the tier a rung declares rather than by
 * its position in the list. The two Beginner quizzes share tier 0, so 100% on
 * either one carries neither - they are two different questions about the same
 * song, not two heights of one. Everything above them carries both.
 *
 * It is one rule in one place because it has two readers that must never
 * disagree: the medal walk, which decides what you have earned, and
 * progressFor, which decides what the picker ticks and how wide the pips on a
 * song card are drawn. Two copies of this would be two answers to "have I
 * finished Easy".
 *
 * Retroactive by construction, like everything else here: both callers replay
 * the whole history from nothing, so a medal this opens up is dated the day the
 * flawless run actually happened, not today. */
function spreadGamePerfect(pass, perfect, mode, level) {
  var top = levelIndex(level);
  for (var i = 0; i <= top; i++) {
    var key = mode + '|' + GAME_LEVELS[i];
    if (pass) pass[key] = true;
    if (perfect) perfect[key] = true;
  }
}
function spreadQuizPerfect(qPass, qPerfect, mode) {
  var top = quizTierOf(mode);
  for (var i = 0; i < QUIZ_MODES.length; i++) {
    var q = QUIZ_MODES[i];
    if (q.kind !== 'quiz') continue;
    var t = quizTierOf(q.id);
    if (q.id !== mode && !(t >= 0 && top >= 0 && t < top)) continue;
    if (qPass) qPass[q.id] = true;
    if (qPerfect) qPerfect[q.id] = true;
  }
}

/**
 * list is one song's attempts, already scored. Returns the highest level
 * unlocked for each game, the highest quiz rung unlocked, and what has already
 * been taken for credit today.
 */
function progressFor(list, settings, today, sectionCount) {
  var bestGame = {}, bestQuiz = -1;
  var usedGames = {}, usedQuiz = false;
  var perfect = {};
  for (var g in GAME_SPEC) if (GAME_SPEC.hasOwnProperty(g)) bestGame[g] = -1;

  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    if (a.practice) continue;                   // practice proves nothing and spends nothing
    var got = pointsForAttempt(a.accuracy, a.mode, settings, a.speedFactor, a.level);
    var isGame = isGameMode(a.mode);
    if (got > 0) {
      if (isGame) {
        var lv = levelOfRow(a.mode, a.level);
        var li = levelIndex(lv);
        if (li > bestGame[a.mode]) bestGame[a.mode] = li;
        /* A LEVEL CLEARED WITHOUT DROPPING A MARK gets a tick on the picker,
           and it is the same fact the medals are built out of - so it is
           gathered here rather than worked out twice from two readings of the
           same rows. */
        if (Number(a.accuracy) >= 100) spreadGamePerfect(null, perfect, a.mode, lv);
      } else {
        var qt = quizTierOf(a.mode);
        if (qt > bestQuiz) bestQuiz = qt;
        if (Number(a.accuracy) >= 100) spreadQuizPerfect(null, perfect, a.mode);
      }
    }
    if (dayIndex(a.date) === today) {
      if (isGame) usedGames[a.mode] = true; else usedQuiz = true;
    }
  }

  /* THE CHAIN - 1.50. Easy on a game is no longer simply open: it has to be
     reached, by banking on the game before it in GAME_CHAIN. The head of the
     chain is always open, so a song brand new to the library offers exactly
     one thing. Within a game the old rule stands unchanged - one rung above
     the highest you have ever banked at - so nobody is marched back down a
     ladder they had already climbed. */
  var chain = gameChainFor(sectionCount);
  var reached = {};
  for (var c = 0; c < chain.length; c++) {
    reached[chain[c]] = (c === 0) || (bestGame[chain[c - 1]] >= 0);
  }

  var unlocks = {}, locked = {};
  for (var m in bestGame) {
    if (!bestGame.hasOwnProperty(m)) continue;
    var top = Math.min(bestGame[m] + 1, GAME_LEVELS.length - 1);
    unlocks[m] = GAME_LEVELS[top];
    if (!reached[m]) locked[m] = true;
  }

  /* THE TWO BEGINNER QUIZZES ARE BEHIND THE WHOLE GAMES SHELF. Typing a song
     back from memory is a different order of ask from tapping cards into
     order, and going straight to it on a song you have never played is how a
     first sitting ends in a blank page. Every playable game passed on Easy is
     the receipt for having been round the song once.

     -1, not 0: the quiz ladder has no rung standing at all until that is
     done, and quizTier is read everywhere as "the highest rung open". */
  var beginnerLocked = false;
  for (var b = 0; b < chain.length; b++) {
    if (bestGame[chain[b]] < 0) { beginnerLocked = true; break; }
  }
  if (!chain.length) beginnerLocked = true;

  return {
    unlocks: unlocks,
    gameLocked: locked,
    perfect: perfect,
    beginnerLocked: beginnerLocked,
    quizTier: beginnerLocked ? -1 : Math.min(bestQuiz + 1, QUIZ_TIER_COUNT - 1),
    usedGames: usedGames,
    usedQuiz: usedQuiz
  };
}

function cleanLevel(v) {
  var lv = String(v || '');
  return (lv === 'easy' || lv === 'medium' || lv === 'hard') ? lv : '';
}

/**
 * The level of a stored attempt, as everything downstream should read it.
 *
 * A GAME ROW WITH NO LEVEL IS AN EASY RUN. Rows written before the games grew
 * levels carry an empty level column, and the two halves of the app were
 * reading that gap differently: `levelIndex` has always defaulted a missing
 * level to Easy, so those runs DID unlock Medium - while the picker looked up
 * `verseSort|easy`, found nothing, and reported the level as untried. One run,
 * two answers, and the ladder was the one that looked wrong.
 *
 * It is an inference either way. The only question is whether the whole app
 * makes the same one, so it is made here, once, and `levelIndex` agrees with
 * it by construction. Quizzes keep an empty level because a quiz genuinely
 * has none.
 */
function levelOfRow(mode, raw) {
  var lv = cleanLevel(raw);
  if (lv) return lv;
  return isGameMode(mode) ? 'easy' : '';
}

/* The heatmap. sting and mend are the asymmetry: one fluffed word costs about
   seven clean runs to work off, which is what decides whether the map nags you
   or forgives you too quickly. fade is how long an observation stays worth
   full weight as a claim about you. */
var HEAT_STING = 35;         // how far a miss pulls a standing toward 0, percent
var HEAT_MEND  = 18;         // how far a hit pulls it back toward 100, percent
var HEAT_GAME  = 40;         // what a game is worth against a quiz's 100
var HEAT_FADE  = 90;         // days after which an observation counts half

var DECAY_PER_DAY = 1;       // y: what a cold song's nightly loss grows by
var POINTS_FLOOR  = 75;      // at or under this accuracy a run banks nothing
var HOT_PCT       = 10;      // x: percent of points banked that becomes hot days
var SPEED_MOD     = true;    // let the stopwatch bend a quiz award at all
var SPEED_SWING   = 20;      // percent the award can move, each way
var TIMER_MIN     = 5;       // runs at a level before the time challenge unlocks
var CHOICE_COUNT  = 4;       // floor on the options in the pick-one games
var DAY_MS = 86400000;

/* Bumped when the shape or the defaults of the settings blob change. A stored
   blob from an older revision keeps its decay, floor and hot share - the parts
   that are yours - and takes the new point values and game dials, which is the
   whole point of a rebalance. */
var SETTINGS_REV = 5;
/**
 * Which calendar day a timestamp falls on, in the script's timezone. The
 * whole hot/cold model turns on nights passing, so it has to count local
 * midnights - "23 hours ago" is one night if you practised last night and
 * none if you practised this morning.
 */
function dayIndex(ms) {
  var d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/**
 * The tiers were renamed when the ladder grew. Attempts written before that
 * carry the OLD names in difficulty, and those names meant different things:
 * old easy showed opening words (now Medium), old medium was underscores (now
 * Hard), old hard was blind (now Blind). New attempts write the mode into its
 * own mode column, so a legacy row is never mistaken for a new one and a new
 * 'easy' is never remapped.
 */
var LEGACY_MODE = { easy: 'medium', medium: 'hard', hard: 'blind' };

function modeOfRow(row) {
  if (row.mode) return String(row.mode);
  var legacy = String(row.difficulty || '').toLowerCase();
  return LEGACY_MODE[legacy] || 'hard';
}

function round1(n) { return Math.round(n * 10) / 10; }

/** Settings live in Meta, so they survive every redeploy. */
var _settings = null;

function getSettings() {
  if (!_settings) _settings = computeSettings();
  return _settings;
}

function num(v, lo, hi, fallback, whole) {
  var n = Number(v);
  if (v === null || v === undefined || v === '' || isNaN(n) || n < lo || n > hi) return fallback;
  return whole ? Math.round(n) : n;
}

/** A [min, max] pair, clamped and ordered. */
function range(v, lo, hi, fallback) {
  if (!(v instanceof Array) || v.length !== 2) return fallback;
  var a = num(v[0], lo, hi, null, true);
  var b = num(v[1], lo, hi, null, true);
  if (a === null || b === null) return fallback;
  return a <= b ? [a, b] : [b, a];
}

function computeSettings() {
  var s = {
    rev: SETTINGS_REV,
    decay: DECAY_PER_DAY, floor: POINTS_FLOOR, hotPct: HOT_PCT,
    speedMod: SPEED_MOD, speedSwing: SPEED_SWING, timerMin: TIMER_MIN,
    choiceCount: CHOICE_COUNT,
    sting: HEAT_STING, mend: HEAT_MEND, gameWeight: HEAT_GAME, fade: HEAT_FADE,
    medalMult: defaultMedalMult(),
    games: defaultGameSettings(), quizzes: defaultQuizSettings()
  };
  // build f kept the decay on its own key; honour it before the newer blob
  var legacyDecay = metaGet('decayPerDay');
  if (legacyDecay !== null && legacyDecay !== '' && !isNaN(Number(legacyDecay))) {
    s.decay = Math.round(Number(legacyDecay));
  }
  var raw = metaGet('settings');
  var stored = null;
  if (raw) { try { stored = JSON.parse(raw); } catch (e) { stored = null; } }
  if (!stored) return s;

  s.decay       = num(stored.decay, 0, 25, s.decay, true);
  s.floor       = num(stored.floor, 0, 99, s.floor);
  /* The old blob kept one floor for everything and quiz values under `points`.
     Both are now per level, and both are carried across the revision bump
     rather than reset: a number you chose is a number you chose, wherever it
     used to live. The seeds go in BEFORE the revision check, so they survive
     it. */
  if (stored.points) {
    for (var lp in s.quizzes) {
      if (!s.quizzes.hasOwnProperty(lp)) continue;
      s.quizzes[lp].pts = num(stored.points[lp], 0, 1000, s.quizzes[lp].pts);
    }
  }
  if (stored.floor !== undefined && !stored.quizzes) {
    for (var lf in s.quizzes) {
      if (s.quizzes.hasOwnProperty(lf)) s.quizzes[lf].floor = s.floor;
    }
    for (var lg in s.games) {
      if (!s.games.hasOwnProperty(lg)) continue;
      for (var li0 = 0; li0 < GAME_LEVELS.length; li0++) {
        s.games[lg][GAME_LEVELS[li0]].floor = s.floor;
      }
    }
  }
  if (stored.choiceCount !== undefined && !stored.quizzes) {
    var cc = num(stored.choiceCount, 2, 8, CHOICE_COUNT, true);
    for (var lc in s.games) {
      if (!s.games.hasOwnProperty(lc)) continue;
      for (var li1 = 0; li1 < GAME_LEVELS.length; li1++) {
        if (s.games[lc][GAME_LEVELS[li1]].choiceCount !== undefined) {
          s.games[lc][GAME_LEVELS[li1]].choiceCount = cc;
        }
      }
    }
  }
  s.hotPct      = num(stored.hotPct, 0, 100, s.hotPct);
  /* Personal dials, so they are read BEFORE the revision check and survive it.
     Absent from any blob written before 1.40, in which case num() falls back
     to the default - which is why the heatmap needed no SETTINGS_REV bump. */
  s.sting       = num(stored.sting, 1, 100, s.sting);
  s.mend        = num(stored.mend, 1, 100, s.mend);
  s.gameWeight  = num(stored.gameWeight, 0, 100, s.gameWeight);
  s.fade        = num(stored.fade, 7, 3650, s.fade, true);
  /* READ ABOVE THE REVISION GATE, with the heatmap dials and for the same
     reason: what a medal is worth to YOU is not part of a balance somebody
     else ships, and a rebalance has no business resetting it. Absent from every
     blob written before 1.63, in which case each falls back to its default -
     which is why this needed no SETTINGS_REV bump. */
  if (stored.medalMult) {
    for (var mm = 0; mm < MEDALS.length; mm++) {
      s.medalMult[MEDALS[mm]] = num(stored.medalMult[MEDALS[mm]], 1, 20,
                                    s.medalMult[MEDALS[mm]]);
    }
  }
  s.speedSwing  = num(stored.speedSwing, 0, 50, s.speedSwing);
  s.timerMin    = num(stored.timerMin, 1, 50, s.timerMin, true);
  s.choiceCount = num(stored.choiceCount, 2, 8, s.choiceCount, true);
  if (typeof stored.speedMod === 'boolean') s.speedMod = stored.speedMod;

  /* THE LETTER DIALS ARE READ ABOVE THE REVISION GATE, like the heatmap's,
     because they are a PREFERENCE rather than part of the balance - a
     rebalance has no business deciding how much of a word you like to see.
     They are absent from every blob written before 1.51, in which case these
     fall back to the defaults, which is why no SETTINGS_REV bump was needed to
     introduce them. */
  if (stored.quizzes && stored.quizzes.medium) {
    var lm0 = stored.quizzes.medium;
    if (LETTER_PICKS.indexOf(lm0.letterPick) !== -1) {
      s.quizzes.medium.letterPick = lm0.letterPick;
    }
    if (LETTER_SCOPES.indexOf(lm0.letterScope) !== -1) {
      s.quizzes.medium.letterScope = lm0.letterScope;
    }
    s.quizzes.medium.letterCount = num(lm0.letterCount, 0, 12,
                                       s.quizzes.medium.letterCount, true);
    s.quizzes.medium.letterPct   = num(lm0.letterPct, 0, 100, s.quizzes.medium.letterPct);
  }

  // Anything older than the current revision keeps the dials that are personal
  // and takes the new balance wholesale.
  if (Number(stored.rev) !== SETTINGS_REV) return s;

  if (stored.quizzes) {
    for (var q in s.quizzes) {
      if (!s.quizzes.hasOwnProperty(q) || !stored.quizzes[q]) continue;
      s.quizzes[q].pts   = num(stored.quizzes[q].pts, 0, 1000, s.quizzes[q].pts);
      s.quizzes[q].floor = num(stored.quizzes[q].floor, 0, 99, s.quizzes[q].floor);
    }
  }
  if (stored.games) {
    for (var g in s.games) {
      if (!s.games.hasOwnProperty(g) || !stored.games[g]) continue;
      for (var li = 0; li < GAME_LEVELS.length; li++) {
        var lv = GAME_LEVELS[li];
        var mine = s.games[g][lv], theirs = stored.games[g][lv];
        if (!theirs) continue;
        mine.pts = num(theirs.pts, 0, 1000, mine.pts);
        if (mine.editPct !== undefined) mine.editPct = num(theirs.editPct, 5, 100, mine.editPct);
        if (mine.missPct !== undefined) mine.missPct = num(theirs.missPct, 5, 100, mine.missPct);
        if (mine.fakePct !== undefined) mine.fakePct = num(theirs.fakePct, 5, 100, mine.fakePct);
        /* A NEW DIAL DOES NOT NEED A REVISION BUMP. It is absent from every
           blob written before it existed, num() falls back, and the level
           takes the default - which is what a bump would have done anyway,
           except a bump would also have thrown away every dial he HAD set. */
        if (mine.fakesPer !== undefined) mine.fakesPer = num(theirs.fakesPer, 1, 8, mine.fakesPer, true);
        if (mine.decoyPct !== undefined) mine.decoyPct = num(theirs.decoyPct, 0, 100, mine.decoyPct);
        if (mine.floor !== undefined) mine.floor = num(theirs.floor, 0, 99, mine.floor);
        if (mine.choiceCount !== undefined) {
          mine.choiceCount = num(theirs.choiceCount, 2, 8, mine.choiceCount, true);
        }
        if (mine.secsPer !== undefined) mine.secsPer = num(theirs.secsPer, 0.1, 600, mine.secsPer);
        if (mine.editN   !== undefined) mine.editN   = range(theirs.editN, 0, 6, mine.editN);
        if (mine.borrowN !== undefined) mine.borrowN = range(theirs.borrowN, 0, 6, mine.borrowN);
        if (mine.extraN  !== undefined) mine.extraN  = range(theirs.extraN, 0, 12, mine.extraN);
        if (mine.trayN   !== undefined) mine.trayN   = num(theirs.trayN, 2, 40, mine.trayN, true);
      }
    }
  }
  return s;
}

/**
 * Every patch is merged on top of what is stored, written, and read back
 * through computeSettings' own validator - one set of range rules rather than
 * two that can drift apart. An out-of-range value is ignored, not rejected:
 * the caller is a slider that cannot produce one.
 */
function apiSetSettings(payload) {
  var s = getSettings();
  payload = payload || {};

  var simple = ['decay', 'floor', 'hotPct', 'speedSwing', 'timerMin', 'choiceCount',
                'sting', 'mend', 'gameWeight', 'fade'];
  for (var i = 0; i < simple.length; i++) {
    if (payload[simple[i]] !== undefined) s[simple[i]] = Number(payload[simple[i]]);
  }
  if (payload.speedMod !== undefined) s.speedMod = !!payload.speedMod;
  if (payload.medalMult) {
    for (var mt = 0; mt < MEDALS.length; mt++) {
      var got = payload.medalMult[MEDALS[mt]];
      if (got !== undefined) s.medalMult[MEDALS[mt]] = Number(got);
    }
  }

  if (payload.quizzes) {
    for (var k in payload.quizzes) {
      if (!payload.quizzes.hasOwnProperty(k) || !s.quizzes[k]) continue;
      for (var qd in payload.quizzes[k]) {
        if (!payload.quizzes[k].hasOwnProperty(qd)) continue;
        if (s.quizzes[k][qd] === undefined) continue;
        /* NOT EVERY DIAL IS A NUMBER as of 1.51. Number('random') is NaN, and
           a NaN written into the blob would come back out as a mask that shows
           nothing at all - a silent, total change to what a rung looks like,
           from a coercion nobody asked for. A choice dial takes only the values
           it declares and anything else is dropped on the floor. */
        if (QUIZ_CHOICE_DIALS[qd]) {
          var allowed = QUIZ_CHOICE_DIALS[qd];
          var want = String(payload.quizzes[k][qd]);
          if (allowed.indexOf(want) !== -1) s.quizzes[k][qd] = want;
          continue;
        }
        s.quizzes[k][qd] = Number(payload.quizzes[k][qd]);
      }
    }
  }
  if (payload.games) {
    for (var g in payload.games) {
      if (!payload.games.hasOwnProperty(g) || !s.games[g]) continue;
      for (var li = 0; li < GAME_LEVELS.length; li++) {
        var lv = GAME_LEVELS[li];
        var patch = payload.games[g][lv];
        if (!patch) continue;
        for (var d in patch) {
          if (patch.hasOwnProperty(d) && s.games[g][lv][d] !== undefined) {
            s.games[g][lv][d] = patch[d];
          }
        }
      }
    }
  }
  if (payload.reset === 'medals') s.medalMult = defaultMedalMult();
  if (payload.reset === 'games') s.games = defaultGameSettings();
  if (payload.reset === 'points') s.quizzes = defaultQuizSettings();

  s.rev = SETTINGS_REV;
  metaSet('settings', JSON.stringify(s));
  metaSet('decayPerDay', '');        // superseded by the blob
  _settings = null;                  // recompute, and validate on the way back
  return getSettings();
}

function medianOf(vals) {
  if (!vals || !vals.length) return null;
  var v = vals.slice().sort(function (a, b) { return a - b; });
  var n = v.length;
  return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}

/**
 * How much pace bends the award.
 *
 * Symmetric in doubling: twice as fast as your own median earns the full
 * swing, twice as slow gives it all back, and running at your median is
 * exactly 1.0. Working in log space rather than raw ratio is what makes the
 * two directions cost the same - "half the time" and "double the time" are
 * the same size of change, which a plain percentage difference gets wrong.
 */
function speedFactorFor(baseline, secs, swingPct) {
  if (!baseline || !secs || baseline <= 0 || secs <= 0) return 1;
  var lg = Math.log(baseline / secs) / Math.LN2;
  if (lg > 1) lg = 1;
  if (lg < -1) lg = -1;
  return 1 + lg * ((swingPct || 0) / 100);
}

/**
 * Tag every attempt with the pace multiplier that applied AT THE TIME.
 *
 * Two rules make this trustworthy:
 *
 *   1. The baseline is built only from runs BEFORE this one. An attempt can
 *      never take part in judging itself, and replaying the history always
 *      lands on the same numbers.
 *   2. Mode and device both have to match. A phone thumb-typing a verse and a
 *      full keyboard doing it are not the same measurement, and pooling them
 *      would tell you your phone is bad at Blind rather than that phones are
 *      slower.
 *
 *   3. You have to have ASKED for it. The stopwatch runs on every quiz and is
 *      reported everywhere, but it only moves points on a run where the timer
 *      box was ticked - which the picker only offers once there is a prior run
 *      to be measured against. Games are never timed at all.
 */
function annotateSpeed(ascending, settings) {
  var st = settings || getSettings();
  var prior = {};
  for (var i = 0; i < ascending.length; i++) {
    var a = ascending[i];
    var secs = Number(a.seconds) || 0;
    var dev = a.device || '';
    var key = (a.mode || 'hard') + '|' + dev;
    a.speedFactor = 1;
    a.speedBaseline = null;
    if (st.speedMod && a.timed && secs > 0 && dev && !isGameMode(a.mode)) {
      var pool = prior[key];
      if (pool && pool.length) {
        a.speedBaseline = medianOf(pool);
        a.speedFactor = speedFactorFor(a.speedBaseline, secs, st.speedSwing);
      }
    }
    if (secs > 0 && dev && !isGameMode(a.mode)) {
      if (!prior[key]) prior[key] = [];
      prior[key].push(secs);
    }
  }
  return ascending;
}

/**
 * Austere on purpose: anything at or under the floor banks nothing at all, and
 * the award ramps linearly from the floor up to a flawless run.
 *   floor 75, Medium worth 10:  75% -> 0.0   87.5% -> 5.0   100% -> 10.0
 *
 * Pace then multiplies whatever accuracy earned - so it also feeds hot days,
 * and a quick run keeps a song warm slightly longer.
 */
/** The dial block for whatever was played: a game at a level, or a quiz. */
function dialBlock(mode, level, settings) {
  var s = settings || getSettings();
  if (isGameMode(mode)) {
    var lv = cleanLevel(level) || 'easy';
    return (s.games[mode] && s.games[mode][lv]) || null;
  }
  return s.quizzes[mode] || s.quizzes.hard || null;
}

function baseValue(mode, level, settings) {
  var d = dialBlock(mode, level, settings);
  return d && d.pts !== undefined ? d.pts : (isGameMode(mode) ? 1 : 10);
}

/** Per level, falling back to the blob's seed for anything that has none. */
function floorFor(mode, level, settings) {
  var s = settings || getSettings();
  var d = dialBlock(mode, level, s);
  return (d && d.floor !== undefined) ? d.floor : s.floor;
}

function pointsForAttempt(accuracy, mode, settings, speedFactor, level) {
  var s = settings || getSettings();
  var base = baseValue(mode, level, s);
  var acc = Number(accuracy) || 0;
  var fl = floorFor(mode, level, s);
  if (acc <= fl) return 0;
  var span = 100 - fl;
  var raw = base * (span <= 0 ? 1 : (acc - fl) / span);
  var f = (speedFactor === undefined || speedFactor === null) ? 1 : speedFactor;
  return round1(raw * f);
}

/**
 * How many more nights before the score reaches zero, given where the song
 * stands right now. Hot nights cost nothing, and so does the night it turns;
 * after that the loss grows by y each time, so this walks it rather than
 * solving it - the loop is over in a handful of passes because the losses
 * compound.
 */
function nightsToZero(score, hot, hotDays, coldRate, y) {
  if (score <= 0) return 0;
  var rate = hot ? y : coldRate;
  if (rate <= 0 && y <= 0) return null;          // nothing is being taken, ever
  // hot: hotDays more hot nights, then the turn, and only then does it bite
  var nights = hot ? hotDays + 1 : 0;
  var left = score, guard = 0;
  while (left > 0 && guard++ < 4000) {
    left = round1(left - rate);
    rate = Math.round(rate + y);
    nights++;
  }
  return nights;
}

/**
 * Walk a song's history a night at a time and report where it stands.
 *
 * Everything the model does depends on order and on the gaps between
 * quizzes, so there is no formula to shortcut - but the walk is cheap. A
 * hot stretch is skipped in a single jump, and a cold song bottoms out in
 * a few nights, after which the state is frozen and the rest of the gap is
 * skipped too.
 *
 * Returns the score now plus the corners of the curve, which is everything
 * the score-over-time chart needs: the segments between corners are straight
 * lines by construction.
 */
function scoreFromAttempts(ascending, now, settings, medals) {
  var st = settings || getSettings();
  var y = st.decay;
  var pct = st.hotPct === undefined ? HOT_PCT : st.hotPct;

  annotateSpeed(ascending, st);      // idempotent; every caller is covered by this

  var score = 0, earned = 0, last = null, curve = [];
  var hot = false, hotDays = 0, coldRate = 0;
  var day = null;

  // Day indices are integers; the chart wants timestamps. Anchor on now so
  // the axis labels land on the right calendar dates.
  var nowDay = dayIndex(now);
  function stampOf(d) { return now - (nowDay - d) * DAY_MS; }

  /** Run the nights between where we are and the given day. */
  function nightsUntil(target) {
    while (day < target) {
      if (hot) {
        if (hotDays > 0) {
          // nothing changes on a hot night, so take them all in one step
          var jump = Math.min(target - day, hotDays);
          hotDays -= jump;
          day += jump;
          continue;
        }
        // the turn itself is free - the song is cold tomorrow, not poorer
        hot = false;
        coldRate = y;
        day++;
        continue;
      }
      // cold, and once there is nothing left to take nothing more changes
      if (score <= 0 || (coldRate <= 0 && y <= 0)) { day = target; return; }
      score = Math.max(0, round1(score - coldRate));
      day++;
      curve.push({ d: stampOf(day), s: score });
      if (score <= 0) {
        // FROZEN. The arrears die with the score: a song worth nothing owes
        // nothing, so any quiz at all starts it moving again rather than
        // spending its first few points clearing a debt it cannot see.
        coldRate = 0;
        day = target;
        return;
      }
      coldRate = Math.round(coldRate + y);
    }
    day = target;
  }

  for (var i = 0; i < ascending.length; i++) {
    var a = ascending[i];
    var t = Number(a.date) || 0;
    var d = dayIndex(t);
    if (day === null) day = d; else nightsUntil(d);

    curve.push({ d: stampOf(day), s: score });
    var pts = pointsForAttempt(a.accuracy, a.mode, st, a.speedFactor, a.level);
    earned = round1(earned + pts);

    // What you earn always clears the arrears first. What happens to the
    // remainder is the one place games and quizzes differ, and it is the whole
    // balance of the app:
    //
    //   A GAME pays the rate down and stops there. Clear the rate outright and
    //   the song goes hot for TODAY ONLY - hot with zero days left - which
    //   buys back the one free night before the cold bites again and resets
    //   the compounding to y. It can never add a day, and a game played on an
    //   already-hot song cannot extend it by so much as a night. So games hold
    //   a song at a tight cadence and are worth nothing at a loose one.
    //
    //   A QUIZ pays the rate down and then converts what is left into rest
    //   days at hotPct. On an already-hot song the whole award converts and
    //   the days stack on top of what is there.
    //
    // The rate is a WHOLE NUMBER, always. A game worth 0.3 against a rate of 1
    // used to leave the song "losing 0.7 a night", which is not a thing anyone
    // wants to read on a card - so what is left is rounded, and what was spent
    // is derived from the rounding rather than the other way round. That
    // derivation is what keeps a part-payment honest now that the payment
    // comes out of the award: 0.3 against a rate of 1 rounds back to 1, so
    // nothing was cleared and nothing is charged.
    /* THE ARREARS ARE PAID OUT OF THE AWARD, NOT ON TOP OF IT - 1.53.
       Until now the whole award went onto the score AND cleared the rate, so a
       song on 20 losing 2 a night answered a 3-point game with 23 and a free
       night. That is the debt being forgiven rather than settled, and it made
       the cheapest run on the most neglected song the best value in the app.
       What clears the rate is now SPENT: the same song lands on 21, hot for
       today, and the two points went where they were owed. */
    var rateBefore = coldRate;
    var paid = Math.min(pts, coldRate);
    coldRate = Math.max(0, Math.round(coldRate - paid));
    /* What the arrears ACTUALLY swallowed. The rate is a whole number and is
       rounded back to one above, so a 0.3 game against a rate of 1 pays
       nothing and keeps its 0.3 - and a 0.6 one clears the whole rate without
       ever costing more than it was worth, which is what the min guards. */
    var spent = Math.min(pts, round1(rateBefore - coldRate));
    if (!(spent > 0)) spent = 0;
    var net = round1(pts - spent);
    if (net < 0) net = 0;
    score = round1(score + net);
    // read back by the results screen and by the attempt log
    a.pointsPaid = spent;
    a.pointsNet  = net;
    if (coldRate <= 0) {
      coldRate = 0;
      if (isGameMode(a.mode)) {
        // today, and not one night more
        if (!hot) { hot = true; hotDays = 0; }
      } else {
        // only what survived the arrears buys rest
        var over = net;
        if (over < 0) over = 0;
        /* THE MEDAL MULTIPLIES THE HOT SHARE, and only the hot share. It is
           read AS OF THIS ATTEMPT, not as of today: a gold earned last month
           must not retroactively pay for a quiz taken in the spring, or the
           curve on screen would bear no relation to the one that was actually
           lived. See medalMultAt. */
        var gain = Math.round(over * (pct * medalMultAt(medals, a.date, settings)) / 100);
        hotDays = hot ? hotDays + gain : gain;
        hot = true;
      }
    }
    curve.push({ d: stampOf(day), s: score });
    last = t;
  }

  if (day !== null) {
    nightsUntil(nowDay);
    curve.push({ d: now, s: score });
  }

  return {
    score: score,
    curve: curve,
    totalEarned: earned,
    lastDate: last,
    daysSince: last === null ? null : Math.max(0, nowDay - dayIndex(last)),
    hot: last === null ? null : hot,
    hotDays: last === null ? null : (hot ? hotDays : 0),
    coldRate: last === null ? null : (hot ? 0 : coldRate),
    daysLeft: last === null ? null : nightsToZero(score, hot, hotDays, coldRate, y)
  };
}


/**
 * Median pace per mode-and-device bucket.
 *
 * Raw seconds only compare within one song - a six-verse ballad is not slower
 * than a two-verse one, it is longer. perWord divides by the words actually
 * graded, which is the only figure that means anything ACROSS songs.
 */
function timingBuckets(list) {
  var by = {};
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    var secs = Number(a.seconds) || 0;
    var dev = a.device || '';
    if (!secs || !dev) continue;                 // untimed or pre-timing rows sit out
    if (isGameMode(a.mode)) continue;            // games are not timed any more
    var key = (a.mode || 'hard') + '|' + dev;
    if (!by[key]) by[key] = { mode: a.mode || 'hard', device: dev, secs: [], perWord: [] };
    by[key].secs.push(secs);
    var w = Number(a.totalWords) || 0;
    if (w > 0) by[key].perWord.push(secs / w);
  }
  var out = [];
  for (var k in by) {
    if (!by.hasOwnProperty(k)) continue;
    var b = by[k];
    var fastest = b.secs[0];
    for (var f = 1; f < b.secs.length; f++) if (b.secs[f] < fastest) fastest = b.secs[f];
    out.push({
      mode: b.mode, device: b.device, n: b.secs.length,
      median: Math.round(medianOf(b.secs)),
      fastest: fastest,
      perWord: b.perWord.length ? Math.round(medianOf(b.perWord) * 100) / 100 : null
    });
  }
  return out;
}


/**
 * ONE ROW PER GAME-AND-LEVEL AND PER QUIZ, across the whole library - 1.50.
 *
 * The Insights panel behind it exists to answer one question that no per-song
 * screen can: are the timers set anywhere near right? Everything else in here
 * is context for that number.
 *
 * TIME LEFT IS CARRIED AS A SHARE, NOT AS SECONDS. Every game's limit is a
 * rate times the length of the song it is played on, so a raw "48 seconds
 * left" from a nine-verse ballad and the same figure from a two-verse one are
 * not the same fact and cannot be averaged. left / limit can be, and it reads
 * directly as a dial: a level finishing with 60% of the clock unspent is one
 * where the countdown is not doing any work, and one finishing at 2% is a
 * level being decided by typing speed rather than by memory.
 *
 * Practice runs are not in here - they are not written at all - and neither
 * are forfeits, which carry an accuracy of 0 and a variant that names them.
 * A forfeit is a fact about a day, not about how hard a level is.
 */
function modeStats(flat, settings) {
  var st = settings || getSettings();
  var by = {};
  for (var i = 0; i < flat.length; i++) {
    var a = flat[i];
    if (a.practice) continue;
    if (String(a.variant || '') === 'forfeit') continue;
    var game = isGameMode(a.mode);
    var lv = game ? levelOfRow(a.mode, a.level) : '';
    var key = a.mode + (lv ? '|' + lv : '');
    if (!by[key]) {
      by[key] = { mode: a.mode, level: lv, n: 0, accs: [], banked: 0, perfect: 0,
                  shares: [], secs: [] };
    }
    var b = by[key];
    b.n++;
    b.accs.push(Number(a.accuracy) || 0);
    if (Number(a.accuracy) >= 100) b.perfect++;
    if (pointsForAttempt(a.accuracy, a.mode, st, a.speedFactor, a.level) > 0) b.banked++;
    if (game) {
      if (a.secsLimit > 0 && a.secsLeft !== null && a.secsLeft !== undefined) {
        b.shares.push(Math.max(0, Math.min(1, a.secsLeft / a.secsLimit)));
      }
    } else if (Number(a.seconds) > 0) {
      b.secs.push(Number(a.seconds));
    }
  }
  var out = [];
  for (var k in by) {
    if (!by.hasOwnProperty(k)) continue;
    var r = by[k];
    var sum = 0, best = 0;
    for (var j = 0; j < r.accs.length; j++) {
      sum += r.accs[j];
      if (r.accs[j] > best) best = r.accs[j];
    }
    out.push({
      mode: r.mode, level: r.level, n: r.n,
      avgAccuracy: r.n ? round1(sum / r.n) : null,
      bestAccuracy: r.n ? Math.round(best) : null,
      passRate: r.n ? Math.round((r.banked / r.n) * 100) : null,
      perfectRate: r.n ? Math.round((r.perfect / r.n) * 100) : null,
      /* Mean, not median, and on purpose: the runs that end at zero left are
         exactly the ones a timer dial has to hear about, and a median quietly
         throws them away. */
      timeLeftPct: r.shares.length
        ? Math.round((r.shares.reduce(function (x, y) { return x + y; }, 0) /
                      r.shares.length) * 100) : null,
      timedRuns: r.shares.length,
      /* How often the clock actually ran out. The share above can look healthy
         while a fifth of the runs are being graded mid-board. */
      expiredPct: r.shares.length
        ? Math.round((r.shares.filter(function (x) { return x <= 0; }).length /
                      r.shares.length) * 100) : null,
      medianSecs: r.secs.length ? Math.round(medianOf(r.secs)) : null
    });
  }
  return out;
}


/* ============================================================
   API handlers
   ============================================================ */

function apiInit() {
  // Migrate EVERY tab before recording the schema as current. Setting the flag
  // partway through would let a later tab skip its own migration and then be
  // read with more columns than it physically has.
  if (!schemaIsCurrent()) {
    sheetFor(TAB_SONGS, SONG_COLS);
    sheetFor(TAB_ATTEMPTS, ATTEMPT_COLS);
    sheetFor(TAB_LISTS, LIST_COLS);
    sheetFor(TAB_META, META_COLS);
    metaSet('schemaVersion', SCHEMA_VERSION);
    _schemaOk = true;
  }
  ensureBurners();
  backfillCounts();                       // one slow pass, once, ever
  purgeRetiredModes();                    // ditto - guarded by its own meta flag
  var songs = readSongIndexRows().map(songFromRow);
  var attempts = readRows(TAB_ATTEMPTS, ATTEMPT_COLS);
  var lists = readRows(TAB_LISTS, LIST_COLS).map(function (r) {
    return {
      id: r.id, name: r.name, createdAt: Number(r.createdAt) || 0,
      role: r.role || '', order: parseJson(r.order, [])
    };
  });

  var now = Date.now();
  var settings = getSettings();
  var bySong = {}, flatAttempts = [];
  for (var i = 0; i < attempts.length; i++) {
    var a = attempts[i];
    if (!bySong[a.songId]) bySong[a.songId] = [];
    var entry = {
      date: Number(a.date) || 0,
      accuracy: Number(a.accuracy) || 0,
      mode: modeOfRow(a),
      seconds: Number(a.seconds) || 0,
      device: a.device || '',
      level: levelOfRow(modeOfRow(a), a.level),
      timed: String(a.timed || '') === '1',
      variant: String(a.variant || ''),
      practice: String(a.practice || '') === '1',
      totalWords: Number(a.totalWords) || 0,
      secsLeft: a.secsLeft === '' || a.secsLeft === null || a.secsLeft === undefined
        ? null : Number(a.secsLeft),
      secsLimit: a.secsLimit === '' || a.secsLimit === null || a.secsLimit === undefined
        ? null : Number(a.secsLimit)
    };
    bySong[a.songId].push(entry);
    flatAttempts.push(entry);
  }
  /* Section counts up front, keyed by id. The chain and the medal rules both
     need to know whether a song has a board for the two verse games, and
     asking the sheet per song inside the loop would be 242 reads to answer a
     question the index rows already carry. */
  var secCounts = {};
  for (var sc0 = 0; sc0 < songs.length; sc0++) {
    var sg0 = songs[sc0];
    secCounts[sg0.id] = sg0.sectionCount === null
      ? unitCounts(sg0.sections).sections : sg0.sectionCount;
  }

  var stats = {};
  for (var key in bySong) {
    if (!bySong.hasOwnProperty(key)) continue;
    var list = bySong[key];
    list.sort(function (x, y) { return x.date - y.date; });   // oldest first
    var best = 0, accTotal = 0, modes = {}, modeSum = {}, modeAcc = {};
    for (var m = 0; m < QUIZ_MODES.length; m++) {
      modes[QUIZ_MODES[m].id] = 0;
      modeSum[QUIZ_MODES[m].id] = 0;
    }
    for (var b = 0; b < list.length; b++) {
      if (list[b].accuracy > best) best = list[b].accuracy;
      accTotal += list[b].accuracy;
      if (modes[list[b].mode] === undefined) { modes[list[b].mode] = 0; modeSum[list[b].mode] = 0; }
      modes[list[b].mode]++;
      modeSum[list[b].mode] += list[b].accuracy;
    }
    // Average accuracy per mode, so the burner stat can be filtered to one
    // level. 100% on Verse Sort and 88% on Blind are not the same achievement,
    // and averaging them together said nothing.
    for (var mk in modes) {
      if (!modes.hasOwnProperty(mk)) continue;
      if (modes[mk]) modeAcc[mk] = round1(modeSum[mk] / modes[mk]);
    }
    var newest = list[list.length - 1];
    var secN = secCounts[key];
    annotateSpeed(list, settings);
    var medals = medalsFor(list, settings, secN);
    var sc = scoreFromAttempts(list, now, settings, medals);
    var prog = progressFor(list, settings, dayIndex(now), secN);
    stats[key] = {
      unlocks: prog.unlocks, quizTier: prog.quizTier,
      gameLocked: prog.gameLocked, perfect: prog.perfect,
      beginnerLocked: prog.beginnerLocked,
      medals: medals,
      usedGames: prog.usedGames, usedQuiz: prog.usedQuiz,
      n: list.length, last: newest.accuracy, lastDate: newest.date,
      timeMed: (function () {
        // 'hard|desktop' -> median seconds. Only buckets that exist, so a
        // library of untimed songs adds nothing to the payload.
        var tb = timingBuckets(list), o = {};
        for (var z = 0; z < tb.length; z++) o[tb[z].mode + '|' + tb[z].device] = tb[z].median;
        return o;
      })(),
      lastMode: newest.mode, best: best, modes: modes, modeAcc: modeAcc,
      avgAccuracy: round1(accTotal / list.length),
      score: sc.score, daysSince: sc.daysSince, daysLeft: sc.daysLeft,
      hot: sc.hot, hotDays: sc.hotDays, coldRate: sc.coldRate,
      totalEarned: sc.totalEarned,
      lastPoints: pointsForAttempt(newest.accuracy, newest.mode, settings,
                                   newest.speedFactor, newest.level)
    };
  }

  // index only — full lyrics are fetched per song
  var index = songs.map(function (s) {
    var freshN = s.sectionCount === null ? unitCounts(s.sections).sections : s.sectionCount;
    var fresh = progressFor([], settings, 0, freshN);
    var st = stats[s.id] || {
      n: 0, last: null, lastDate: 0, best: 0, lastMode: null, modes: {}, modeAcc: {}, timeMed: {},
      avgAccuracy: null, hot: null, hotDays: null, coldRate: null,
      score: null, daysSince: null, daysLeft: null, totalEarned: 0, lastPoints: 0,
      unlocks: fresh.unlocks, quizTier: fresh.quizTier,
      gameLocked: fresh.gameLocked, perfect: {},
      beginnerLocked: fresh.beginnerLocked,
      /* A SONG NOBODY HAS OPENED STILL HAS A ROUTE THROUGH IT - 1.61. This used
         to be a hand-built blob with no checks on it, which meant the one song
         most in need of being told what a medal wants - the one with no history
         at all - was the only song whose medal panel showed four dates and no
         checklist. Walking an empty history gives the right answer for free. */
      medals: medalsFor([], settings, freshN),
      usedGames: {}, usedQuiz: false
    };
    return {
      id: s.id, title: s.title, artist: s.artist, listIds: s.listIds,
      needsChorusTag: s.needsChorusTag, createdAt: s.createdAt, sortIndex: s.sortIndex,
      attempts: st.n, lastAccuracy: st.last, lastDate: st.lastDate, bestAccuracy: st.best,
      source: s.source || 'manual', headingId: s.headingId || '',
      // on the index so a set list can show every song's capo before any
      // lyrics have arrived - planning around capo changes needs all of them
      playKey: s.playKey || '',
      capo: s.capo === null ? capoFromRow('', s.meta) : s.capo,
      lastMode: st.lastMode, modes: st.modes, modeAcc: st.modeAcc, timeMed: st.timeMed,
      avgAccuracy: st.avgAccuracy,
      score: st.score, daysSince: st.daysSince, daysLeft: st.daysLeft,
      hot: st.hot, hotDays: st.hotDays, coldRate: st.coldRate,
      totalEarned: st.totalEarned, lastPoints: st.lastPoints,
      sectionCount: s.sectionCount === null ? unitCounts(s.sections).sections : s.sectionCount,
      lineCount: s.lineCount === null ? unitCounts(s.sections).lines : s.lineCount,
      wordCount: s.wordCount === null ? unitCounts(s.sections).words : s.wordCount,
      unlocks: st.unlocks, quizTier: st.quizTier,
      gameLocked: st.gameLocked, perfect: st.perfect,
      beginnerLocked: st.beginnerLocked, medals: st.medals,
      usedGames: st.usedGames, usedQuiz: st.usedQuiz
    };
  });

  /* Points banked inside each window, summed across the library.
     Aggregated here rather than shipping every attempt's date and award to the
     page: the windows are a fixed short list, and a library with a few thousand
     runs behind it would otherwise pay for the whole log on every load just to
     draw six numbers. */
  var windows = [1, 3, 7, 15, 30, 90, 365];
  var earned = { all: 0 };
  var firstAt = null;
  for (var wi = 0; wi < windows.length; wi++) earned[windows[wi]] = 0;
  for (var sk in bySong) {
    if (!bySong.hasOwnProperty(sk)) continue;
    var run = bySong[sk];
    annotateSpeed(run, settings);
    for (var ri = 0; ri < run.length; ri++) {
      var got = pointsForAttempt(run[ri].accuracy, run[ri].mode, settings,
                                 run[ri].speedFactor, run[ri].level);
      if (!got) continue;
      earned.all = round1(earned.all + got);
      if (firstAt === null || run[ri].date < firstAt) firstAt = run[ri].date;
      for (var wj = 0; wj < windows.length; wj++) {
        if (run[ri].date >= now - windows[wj] * DAY_MS) {
          earned[windows[wj]] = round1(earned[windows[wj]] + got);
        }
      }
    }
  }

  return {
    build: BUILD,
    songs: index,
    earned: earned,
    firstAttempt: firstAt,
    lists: lists,
    settings: settings,
    modes: QUIZ_MODES,
    families: GAME_FAMILIES,
    retired: RETIRED_MODES,
    timing: timingBuckets(flatAttempts),
    modeStats: modeStats(flatAttempts, settings),
    lastImport: metaGet('lastImport') || '',
    // Both blank-safe: no songbook set is a state the page draws for, and the
    // sheet names itself rather than being reassembled out of an id we may
    // not have.
    docUrl: docId() ? 'https://docs.google.com/document/d/' + docId() + '/edit' : '',
    docTitle: metaGet('docTitle') || '',
    sheetUrl: ss().getUrl()
  };
}

function apiGetSong(id) {
  // Find the row from the id column alone, then pull that single row. This used
  // to read all 242 lyric blobs to return one of them - it was the pause when
  // you tapped a song.
  var row = findSongRow(id);
  if (row < 0) throw new Error('Song not found');
  var s = songFromRow(readSongRow(row));
  delete s._row;
  if (s.capo === null) s.capo = capoFromRow('', s.meta);
  s.history = attemptsForSong(id);
  var settings = getSettings();
  var secN = s.sectionCount === null || s.sectionCount === undefined
    ? unitCounts(s.sections).sections : s.sectionCount;
  s.medals = medalsFor(s.history, settings, secN);
  var sc = scoreFromAttempts(s.history, Date.now(), settings, s.medals);
  s.score = sc.score;
  s.curve = sc.curve;
  s.daysSince = sc.daysSince;
  s.daysLeft = sc.daysLeft;
  s.hot = sc.hot;
  s.hotDays = sc.hotDays;
  s.coldRate = sc.coldRate;
  s.totalEarned = sc.totalEarned;
  s.times = timingBuckets(s.history);
  s.scoring = settings;
  var prog = progressFor(s.history, settings, dayIndex(Date.now()), secN);
  s.unlocks = prog.unlocks;
  s.quizTier = prog.quizTier;
  s.gameLocked = prog.gameLocked;
  s.perfect = prog.perfect;
  s.beginnerLocked = prog.beginnerLocked;
  s.usedGames = prog.usedGames;
  s.usedQuiz = prog.usedQuiz;
  return s;
}

function attemptsForSong(id) {
  var rows = readRows(TAB_ATTEMPTS, ATTEMPT_COLS);
  var st = getSettings();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].songId !== id) continue;
    out.push({
      id: rows[i].id, date: Number(rows[i].date) || 0,
      accuracy: Number(rows[i].accuracy) || 0,
      mode: modeOfRow(rows[i]),
      seconds: Number(rows[i].seconds) || 0,
      device: rows[i].device || '',
      level: levelOfRow(modeOfRow(rows[i]), rows[i].level),
      timed: String(rows[i].timed || '') === '1',
      variant: String(rows[i].variant || ''),
      practice: String(rows[i].practice || '') === '1',
      totalWords: Number(rows[i].totalWords) || 0,
      secsLeft: rows[i].secsLeft === '' || rows[i].secsLeft === null ||
                rows[i].secsLeft === undefined ? null : Number(rows[i].secsLeft),
      secsLimit: rows[i].secsLimit === '' || rows[i].secsLimit === null ||
                 rows[i].secsLimit === undefined ? null : Number(rows[i].secsLimit)
    });
  }
  // Sort BEFORE annotating: the pace factor is built from what came earlier,
  // so an out-of-order list would grade a run against its own future.
  out.sort(function (a, b) { return a.date - b.date; });
  annotateSpeed(out, st);
  for (var p = 0; p < out.length; p++) {
    out[p].points = pointsForAttempt(out[p].accuracy, out[p].mode, st, out[p].speedFactor,
                                     out[p].level);
  }
  return out;
}

/**
 * Several songs in one call. Used only by the background prefetch, so the one
 * full-sheet read it costs is paid off the critical path - far cheaper than the
 * caller making twenty separate round trips.
 */
function apiGetSongs(ids) {
  if (!ids || !ids.length) return [];
  var want = {};
  for (var i = 0; i < ids.length && i < 60; i++) want[ids[i]] = true;
  var settings = getSettings();
  var now = Date.now();
  var rows = readRows(TAB_SONGS, SONG_COLS);
  var attempts = readRows(TAB_ATTEMPTS, ATTEMPT_COLS);

  var byId = {};
  for (var a = 0; a < attempts.length; a++) {
    if (!byId[attempts[a].songId]) byId[attempts[a].songId] = [];
    byId[attempts[a].songId].push({
      id: attempts[a].id,
      date: Number(attempts[a].date) || 0,
      accuracy: Number(attempts[a].accuracy) || 0,
      mode: modeOfRow(attempts[a]),
      seconds: Number(attempts[a].seconds) || 0,
      device: attempts[a].device || '',
      level: levelOfRow(modeOfRow(attempts[a]), attempts[a].level),
      timed: String(attempts[a].timed || '') === '1',
      variant: String(attempts[a].variant || ''),
      practice: String(attempts[a].practice || '') === '1',
      totalWords: Number(attempts[a].totalWords) || 0,
      secsLeft: attempts[a].secsLeft === '' || attempts[a].secsLeft === null ||
                attempts[a].secsLeft === undefined ? null : Number(attempts[a].secsLeft),
      secsLimit: attempts[a].secsLimit === '' || attempts[a].secsLimit === null ||
                 attempts[a].secsLimit === undefined ? null : Number(attempts[a].secsLimit)
    });
  }

  var out = [];
  for (var r = 0; r < rows.length; r++) {
    if (!want[rows[r].id]) continue;
    var s = songFromRow(rows[r]);
    delete s._row;
    if (s.capo === null) s.capo = capoFromRow('', s.meta);
    var hist = byId[s.id] || [];
    hist.sort(function (x, y) { return x.date - y.date; });
    annotateSpeed(hist, settings);
    for (var h = 0; h < hist.length; h++) {
      hist[h].points = pointsForAttempt(hist[h].accuracy, hist[h].mode, settings,
                                        hist[h].speedFactor, hist[h].level);
    }
    s.history = hist;
    s.times = timingBuckets(hist);
    var secN2 = s.sectionCount === null || s.sectionCount === undefined
      ? unitCounts(s.sections).sections : s.sectionCount;
    s.medals = medalsFor(hist, settings, secN2);
    var sc = scoreFromAttempts(hist, now, settings, s.medals);
    s.score = sc.score;
    s.curve = sc.curve;
    s.daysSince = sc.daysSince;
    s.daysLeft = sc.daysLeft;
    s.hot = sc.hot;
    s.hotDays = sc.hotDays;
    s.coldRate = sc.coldRate;
    s.totalEarned = sc.totalEarned;
    s.scoring = settings;
    out.push(s);
  }
  return out;
}

/**
 * Verses and lines lifted from OTHER songs, for the games that need ringers.
 *
 * Reads the id column, picks a few rows at random, and pulls only those -
 * the whole point is not to read 242 lyric blobs to get six verses. The page
 * asks once per session and keeps them.
 */
/**
 * Material from other songs, for the ringers every game plants.
 *
 * Each verse carries its own line count so the caller can match shape: a
 * ten-line verse dropped into a song where everything is four lines is spotted
 * without reading a word of it, which makes the game a shape-matching exercise
 * rather than a memory one.
 *
 * One row read per song, deliberately - pulling the whole sections column would
 * drag every lyric in the book across for a handful of verses. Fetched once a
 * session and kept.
 */
function apiGetDecoys(excludeId, want) {
  var n = Math.max(1, Math.min(24, Number(want) || 6));
  var sh = sheetFor(TAB_SONGS, SONG_COLS);
  var last = sh.getLastRow();
  if (last < 2) return { verses: [], lines: [] };

  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  var rows = [];
  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i][0] || '');
    if (id && id !== excludeId) rows.push(i + 2);
  }
  if (!rows.length) return { verses: [], lines: [] };

  for (var s = rows.length - 1; s > 0; s--) {         // shuffle, then take
    var j = Math.floor(Math.random() * (s + 1));
    var t = rows[s]; rows[s] = rows[j]; rows[j] = t;
  }

  var verses = [], lines = [];
  for (var r = 0; r < rows.length && r < n; r++) {
    var sg;
    try { sg = songFromRow(readSongRow(rows[r])); } catch (e) { continue; }
    var taken = 0;
    for (var c = 0; c < sg.sections.length && taken < 3; c++) {
      var sec = sg.sections[c];
      if (sec.type === 'marker') continue;
      var text = [];
      for (var l = 0; l < sec.lines.length; l++) {
        if (sec.lines[l].t) text.push(sec.lines[l].t);
      }
      if (!text.length) continue;
      verses.push({ type: sec.type, from: sg.title, lines: text, n: text.length });
      for (var q = 0; q < text.length; q++) lines.push({ t: text[q], from: sg.title });
      taken++;
    }
  }
  return { verses: verses, lines: lines };
}

function apiSaveSong(song) {
  if (song.id) {
    var row = findSongRow(song.id);
    if (row > 0) {
      var existing = songFromRow(readSongRow(row));
      song.createdAt = existing.createdAt;
      song.source = existing.source;
      song.headingId = song.headingId || existing.headingId;
      /* The standings are addressed by position, so an edit has to carry them
         over by matching the text instead. Without this, correcting one typo
         would silently re-point every standing in the song at the wrong word. */
      song.heat = heatReanchor(existing.heat, existing.sections, song.sections);
      if (song.playKey === undefined) song.playKey = existing.playKey;
      if (song.capo === undefined) song.capo = existing.capo;
      writeRow(TAB_SONGS, SONG_COLS, row, songToRow(song));
      return { id: song.id };
    }
  }
  song.id = song.id || uid();
  song.createdAt = Date.now();
  song.source = song.source || 'manual';
  appendRow(TAB_SONGS, SONG_COLS, songToRow(song));
  return { id: song.id };
}

function apiDeleteSong(id) {
  var rows = readRows(TAB_SONGS, SONG_COLS);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) { deleteRow(TAB_SONGS, SONG_COLS, rows[i]._row); break; }
  }
  var att = readRows(TAB_ATTEMPTS, ATTEMPT_COLS);
  for (var j = att.length - 1; j >= 0; j--) {
    if (att[j].songId === id) deleteRow(TAB_ATTEMPTS, ATTEMPT_COLS, att[j]._row);
  }
  return { ok: true };
}

function apiSetSongLists(id, listIds) {
  var row = findSongRow(id);
  if (row < 0) throw new Error('Song not found');
  var s = songFromRow(readSongRow(row));
  s.listIds = listIds || [];
  writeRow(TAB_SONGS, SONG_COLS, row, songToRow(s));
  return { ok: true };
}

/** Promote section [index] to chorus and clear the needs-tagging flag. */
function apiTagChorus(id, index) {
  var row = findSongRow(id);
  if (row < 0) throw new Error('Song not found');
  var s = songFromRow(readSongRow(row));
  if (s.sections[index]) s.sections[index].type = 'chorus';
  s.needsChorusTag = false;
  writeRow(TAB_SONGS, SONG_COLS, row, songToRow(s));
  return { ok: true };
}

/**
 * Record the run, then hand back everything the results screen wants to say.
 *
 * The page used to navigate to the results screen while a refresh was still
 * in flight, so it could not show what the quiz had actually DONE to the song.
 * Working it out here is both authoritative and free: the rows are already in
 * hand for the write, and it saves the page a second round trip.
 */
function apiSaveAttempt(a) {
  a.id = a.id || uid();
  a.date = a.date || Date.now();
  var mode = a.mode || (a.detail && a.detail.mode) || 'hard';
  var level = isGameMode(mode) ? (cleanLevel(a.level) || 'easy') : '';
  // Games are not timed at all, so nothing about them can be paced.
  var secs = isGameMode(mode) ? 0 : Math.max(0, Math.round(Number(a.seconds) || 0));
  var dev = (a.device === 'phone' || a.device === 'desktop') ? a.device : '';
  var timed = (!isGameMode(mode) && a.timed) ? '1' : '';
  var words = Number(a.totalWords) || 0;

  /* THE COUNTDOWN, BOTH ENDS OF IT - 1.50. Only a game has one, and only a
     game played for credit: a practice run builds no clock at all, and a
     practice run reporting "0s left" would be inventing a defeat. Blank rather
     than zero where there was no clock, so the Insights panel can tell "ran it
     to the wire" from "never had one". */
  var hadClock = isGameMode(mode) && !a.practice &&
                 Number(a.secsLimit) > 0 && a.secsLeft !== null && a.secsLeft !== undefined;
  var sLeft  = hadClock ? Math.max(0, Math.round(Number(a.secsLeft) || 0)) : '';
  var sLimit = hadClock ? Math.max(0, Math.round(Number(a.secsLimit) || 0)) : '';

  appendRow(TAB_ATTEMPTS, ATTEMPT_COLS, {
    id: a.id, songId: a.songId, date: a.date, accuracy: a.accuracy,
    totalWords: a.totalWords, correctWords: a.correctWords,
    detail: JSON.stringify(a.detail || {}),
    difficulty: mode, mode: mode, seconds: secs, device: dev,
    level: level, timed: timed, variant: String(a.variant || ''),
    practice: a.practice ? '1' : '',
    secsLeft: sLeft, secsLimit: sLimit
  });

  /* The run's observations ride along with the row, inside the same lock. A
     second round trip would be a second chance to half-succeed. */
  if (a.heat && a.heat.length) {
    try { applyHeatToSong(a.songId, mode, a.heat); } catch (e) {}
  }

  var st = getSettings();
  var rows = readRows(TAB_ATTEMPTS, ATTEMPT_COLS);
  var mine = [], all = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var e = {
      id: r.id, date: Number(r.date) || 0, accuracy: Number(r.accuracy) || 0,
      mode: modeOfRow(r), seconds: Number(r.seconds) || 0,
      device: r.device || '', level: levelOfRow(modeOfRow(r), r.level),
      timed: String(r.timed || '') === '1',
      variant: String(r.variant || ''),
      practice: String(r.practice || '') === '1',
      totalWords: Number(r.totalWords) || 0,
      secsLeft: r.secsLeft === '' || r.secsLeft === null || r.secsLeft === undefined
        ? null : Number(r.secsLeft),
      secsLimit: r.secsLimit === '' || r.secsLimit === null || r.secsLimit === undefined
        ? null : Number(r.secsLimit)
    };
    all.push(e);
    if (r.songId === a.songId) mine.push(e);
  }
  mine.sort(function (x, y) { return x.date - y.date; });

  var now = Date.now();
  /* The medal state on both sides of the run, because a run that finishes a
     medal has to be able to say so - and because the hot share the run is paid
     at depends on which medals were standing when it happened. */
  var secCount = sectionCountOf(a.songId);
  var prior = [];
  for (var p = 0; p < mine.length; p++) if (mine[p].id !== a.id) prior.push(mine[p]);
  annotateSpeed(mine, st);
  annotateSpeed(prior, st);
  var medalsAfter = medalsFor(mine, st, secCount);
  var medalsBefore = medalsFor(prior, st, secCount);

  // Order matters: score the full history first so the new run gets its pace
  // factor, THEN score the history without it. Dropping the newest attempt
  // cannot change what came before it, so the earlier factors are untouched.
  var after = scoreFromAttempts(mine, now, st, medalsAfter);
  var before = scoreFromAttempts(prior, now, st, medalsBefore);

  var fresh = null;
  for (var q = 0; q < mine.length; q++) if (mine[q].id === a.id) fresh = mine[q];
  var gained = fresh ? pointsForAttempt(fresh.accuracy, fresh.mode, st, fresh.speedFactor,
                                        fresh.level) : 0;
  /* What the run was WORTH and what it actually ADDED are two numbers now that
     arrears are settled out of the award. scoreFromAttempts wrote both onto the
     attempt as it walked past it - `after` is the walk that includes this run,
     and it ran before `before`, which cannot touch it because it does not
     contain it. */
  var netGain = fresh && fresh.pointsNet !== undefined ? fresh.pointsNet : gained;
  var paidOff = fresh && fresh.pointsPaid !== undefined ? fresh.pointsPaid : 0;

  // pace: this song at this level on this device, and the same level everywhere
  var songPool = [], modePool = [];
  for (var s2 = 0; s2 < prior.length; s2++) {
    if (prior[s2].mode === mode && prior[s2].device === dev && prior[s2].seconds > 0) {
      songPool.push(prior[s2].seconds);
    }
  }
  for (var t = 0; t < all.length; t++) {
    if (all[t].id === a.id) continue;
    if (all[t].mode !== mode || all[t].device !== dev) continue;
    if (all[t].seconds > 0 && all[t].totalWords > 0) {
      modePool.push(all[t].seconds / all[t].totalWords);
    }
  }

  return {
    id: a.id,
    points: gained,
    netPoints: netGain,
    paidDebt: paidOff,
    speedFactor: fresh ? fresh.speedFactor : 1,
    speedBaseline: fresh ? fresh.speedBaseline : null,
    timed: !!timed,
    speedOn: !!st.speedMod && !isGameMode(mode),
    level: level,
    before: {
      score: before.score, hot: before.hot,
      hotDays: before.hotDays, coldRate: before.coldRate,
      any: prior.length > 0
    },
    after: {
      score: after.score, hot: after.hot,
      hotDays: after.hotDays, coldRate: after.coldRate
    },
    medals: medalsAfter,
    /* The one the run just finished, if it finished one. Null the rest of the
       time, which is nearly always - a medal that announced itself on every
       results screen would stop being an announcement. */
    medalGained: (medalsAfter.best && medalsAfter.best !== medalsBefore.best)
      ? medalsAfter.best : null,
    timing: {
      seconds: secs, device: dev,
      songMedian: songPool.length ? Math.round(medianOf(songPool)) : null,
      songCount: songPool.length,
      perWord: (secs > 0 && words > 0) ? secs / words : null,
      modePerWord: modePool.length ? medianOf(modePool) : null,
      modeCount: modePool.length
    }
  };
}

/**
 * Point the app at a songbook, or at none.
 *
 * IT IS OPENED BEFORE IT IS SAVED. A doc id that parses is not a doc you can
 * read - it may be a spreadsheet, a file someone else owns, or a typo that
 * happens to be the right shape - and the alternative to checking here is the
 * import failing minutes later with a Google error that names none of that.
 * The title comes back with it, so the settings screen can say which document
 * it is actually pointed at rather than echoing the id back at you.
 */
function apiSetDoc(url) {
  var raw = String(url || '').trim();
  if (!raw) {
    metaSet('docId', '');
    return { docId: '', docUrl: '', docTitle: '' };
  }
  var id = docIdFrom(raw);
  if (!id) {
    throw new Error('That does not look like a Google Doc link. Open the doc and copy the address bar.');
  }
  var title;
  try {
    title = DocumentApp.openById(id).getName();
  } catch (e) {
    throw new Error('Could not open that document. Check the link, and that it is a Google Doc you own.');
  }
  metaSet('docId', id);
  metaSet('docTitle', title);
  return {
    docId: id, docTitle: title,
    docUrl: 'https://docs.google.com/document/d/' + id + '/edit'
  };
}


/**
 * Wipe one song's runs, and only the kind you asked for. Games and quizzes are
 * separately clearable because they mean different things: a game history full
 * of easy sessions is noise you may want gone without losing the record of the
 * Blind runs that actually cost you something.
 *
 * kind is 'game', 'quiz' or 'both'. Rows are deleted bottom-up so the earlier
 * indices stay valid as the sheet shrinks under them.
 */
/**
 * Fold a run's observations into one song's standings and write it back.
 * Shared by the practice route and the credit-run write, so there is one
 * updater and the two cannot drift.
 */
function applyHeatToSong(songId, mode, obs) {
  if (!songId || !obs || !obs.length) return null;
  var row = findSongRow(songId);
  if (row < 0) return null;
  var s = songFromRow(readSongRow(row));
  var st = getSettings();
  var weight = isGameMode(mode) ? (Number(st.gameWeight) / 100) : 1;
  s.heat = heatApply(s.heat, obs, weight, dayIndex(Date.now()), st);
  writeRow(TAB_SONGS, SONG_COLS, row, songToRow(s));
  return s.heat;
}

function apiUpdateHeat(songId, mode, obs) {
  var heat = applyHeatToSong(songId, mode, obs);
  return { ok: !!heat, heat: heat };
}

function apiClearSongData(songId, kind) {
  if (!songId) throw new Error('No song given');
  var want = String(kind || 'both');
  if (want !== 'game' && want !== 'quiz' && want !== 'both') want = 'both';
  var sh = sheetFor(TAB_ATTEMPTS, ATTEMPT_COLS);
  var last = sh.getLastRow();
  if (last < 2) return { removed: 0 };
  var vals = sh.getRange(2, 1, last - 1, ATTEMPT_COLS.length).getValues();
  var songCol = ATTEMPT_COLS.indexOf('songId');
  var modeCol = ATTEMPT_COLS.indexOf('mode');
  var diffCol = ATTEMPT_COLS.indexOf('difficulty');
  var kill = [];
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][songCol]) !== String(songId)) continue;
    var mode = String(vals[i][modeCol] || '');
    if (!mode) mode = LEGACY_MODE[String(vals[i][diffCol] || '').toLowerCase()] || 'hard';
    var isGame = isGameMode(mode);
    if (want === 'both' || (want === 'game') === isGame) kill.push(i + 2);
  }
  for (var k = kill.length - 1; k >= 0; k--) sh.deleteRow(kill[k]);

  /* THE MAP GOES WITH THE RUNS, whichever kind you cleared. Standings cannot be
     partially unwound - only the running figures are kept, never the individual
     results - and a map built out of runs that no longer exist would be
     incoherent: the ladders would reset while the heatmap went on remembering. */
  var srow = findSongRow(songId);
  if (srow > 0) {
    var sg = songFromRow(readSongRow(srow));
    if (sg.heat) {
      sg.heat = null;
      writeRow(TAB_SONGS, SONG_COLS, srow, songToRow(sg));
    }
  }
  return { removed: kill.length, heatCleared: true };
}

function apiClearAttempts() {
  var sh = sheetFor(TAB_ATTEMPTS, ATTEMPT_COLS);
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  return { ok: true };
}

/**
 * Wipe the library so the Doc can be re-imported from scratch. Takes quiz
 * history with it - scores point at song ids that will not exist afterwards.
 * Lists survive, but every song loses its membership along with everything else.
 */
function apiClearAllSongs() {
  var songs = sheetFor(TAB_SONGS, SONG_COLS);
  var removed = Math.max(0, songs.getLastRow() - 1);
  if (removed > 0) songs.deleteRows(2, removed);

  var att = sheetFor(TAB_ATTEMPTS, ATTEMPT_COLS);
  var removedAttempts = Math.max(0, att.getLastRow() - 1);
  if (removedAttempts > 0) att.deleteRows(2, removedAttempts);

  metaSet('lastImport', '');
  return { removed: removed, removedAttempts: removedAttempts };
}

/** order is [{id, sortIndex}, ...]. One pass, one write per changed row. */
function apiReorder(order) {
  if (!order || !order.length) return { ok: true };
  // only ever writes one cell per song, so it needs the id column and nothing
  // else - it used to pull every lyric in the book to move one row
  var sh = sheetFor(TAB_SONGS, SONG_COLS);
  var last = sh.getLastRow();
  if (last < 2) return { ok: true };
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  var byId = {};
  for (var i = 0; i < ids.length; i++) if (ids[i][0]) byId[ids[i][0]] = i + 2;
  var col = SONG_COLS.indexOf('sortIndex') + 1;
  for (var j = 0; j < order.length; j++) {
    var row = byId[order[j].id];
    if (!row) continue;
    sh.getRange(row, col).setValue(Number(order[j].sortIndex));
  }
  return { ok: true, moved: order.length };
}

function apiCreateList(name) {
  var list = {
    id: uid(), name: String(name || 'New list').trim(),
    isDashboard: false, createdAt: Date.now(), role: ''
  };
  appendRow(TAB_LISTS, LIST_COLS, list);
  return list;
}

function apiRenameList(id, name) {
  var rows = readRows(TAB_LISTS, LIST_COLS);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      writeRow(TAB_LISTS, LIST_COLS, rows[i]._row, {
        id: id, name: String(name).trim(),
        isDashboard: rows[i].isDashboard, createdAt: rows[i].createdAt,
        role: rows[i].role || '', order: rows[i].order || ''
      });
      return { ok: true };
    }
  }
  throw new Error('List not found');
}

/**
 * A list's own running order - the set list. Writes the one cell. Ids are
 * taken as given: the page sends the whole order every time, so a song that
 * has since left the list simply stops being named, and one that joins later
 * falls in at the end until it is placed.
 */
function apiSetListOrder(id, order) {
  var rows = readRows(TAB_LISTS, LIST_COLS);
  var clean = [];
  for (var j = 0; j < (order || []).length; j++) {
    var sid = String(order[j] || '');
    if (sid && clean.indexOf(sid) === -1) clean.push(sid);
  }
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id !== id) continue;
    var sh = sheetFor(TAB_LISTS, LIST_COLS);
    sh.getRange(rows[i]._row, LIST_COLS.indexOf('order') + 1).setValue(JSON.stringify(clean));
    return { ok: true, n: clean.length };
  }
  throw new Error('List not found');
}

function apiDeleteList(id) {
  var rows = readRows(TAB_LISTS, LIST_COLS);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) { deleteRow(TAB_LISTS, LIST_COLS, rows[i]._row); break; }
  }
  var songs = readRows(TAB_SONGS, SONG_COLS);
  for (var j = 0; j < songs.length; j++) {
    var s = songFromRow(songs[j]);
    if (s.listIds.indexOf(id) === -1) continue;
    var next = [];
    for (var k = 0; k < s.listIds.length; k++) if (s.listIds[k] !== id) next.push(s.listIds[k]);
    s.listIds = next;
    writeRow(TAB_SONGS, SONG_COLS, songs[j]._row, songToRow(s));
  }
  return { ok: true };
}

/** Make one list the front or back burner; whichever held that role loses it. */
function apiSetListRole(id, role) {
  if (role !== 'front' && role !== 'back' && role !== '') throw new Error('Bad role');
  var rows = readRows(TAB_LISTS, LIST_COLS);
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var next = r.role || '';
    if (r.id === id) next = role;
    else if (role !== '' && next === role) next = '';    // only one of each
    if (next === (r.role || '')) continue;
    writeRow(TAB_LISTS, LIST_COLS, r._row, {
      id: r.id, name: r.name, isDashboard: next === 'front',
      createdAt: r.createdAt, role: next, order: r.order || ''
    });
  }
  ensureBurners();
  return { ok: true };
}

/** Add or remove one song from one list without touching its other lists. */
function apiToggleListMembership(songId, listId, on) {
  var row = findSongRow(songId);
  if (row < 0) throw new Error('Song not found');
  var s = songFromRow(readSongRow(row));
  var ids = s.listIds || [];
  var at = ids.indexOf(listId);
  if (on && at === -1) ids.push(listId);
  if (!on && at !== -1) ids.splice(at, 1);
  s.listIds = ids;
  writeRow(TAB_SONGS, SONG_COLS, row, songToRow(s));
  return { listIds: ids };
}


/* ============================================================
   Doc importer
   ------------------------------------------------------------
   Conventions in Kyle's songbook, which ARE the data model:
     Heading 1        -> song title
     bold paragraph   -> chord line (they are set in Courier New)
     indentStart > 0  -> chorus
     centered         -> section marker ("Chorus", "Solo", "Refrain")
     empty paragraph  -> stanza break

   Indent and alignment are paragraph properties: they do not survive any
   text export, so this must read the document structure itself. One
   Docs.Documents.get call fetches the lot; walking 8,900 paragraphs through
   DocumentApp one getter at a time would run past the 6 minute limit.
   ============================================================ */

var VTAB_CHAR = String.fromCharCode(11);   // Shift+Enter inside a paragraph
var CR_CHAR   = String.fromCharCode(13);

function isBlankChar(ch) {
  return ch === ' ' || ch === TAB_CHAR || ch === NL_CHAR || ch === CR_CHAR;
}

function fetchDocParagraphs() {
  var id = docId();
  if (!id) throw new Error('No songbook set. Settings, Songbook, paste the link to your Google Doc.');
  var doc = Docs.Documents.get(id);
  return docToParagraphs(doc);
}

/** Split out from the fetch so it can be tested against a saved document. */
function docToParagraphs(doc) {
  var content = (doc.body && doc.body.content) || [];
  var out = [];
  for (var i = 0; i < content.length; i++) {
    var p = content[i].paragraph;
    if (!p) continue;
    var style = p.paragraphStyle || {};
    var elements = p.elements || [];

    // Track boldness per character so a paragraph broken by Shift+Enter can be
    // split into real lines afterwards, each judged on its own.
    var chars = [];
    for (var e = 0; e < elements.length; e++) {
      var tr = elements[e].textRun;
      if (!tr) continue;
      var t = tr.content || '';
      var isBold = !!(tr.textStyle && tr.textStyle.bold);
      for (var c = 0; c < t.length; c++) chars.push({ ch: t.charAt(c), bold: isBold });
    }

    var indent = 0;
    if (style.indentStart && style.indentStart.magnitude) indent = style.indentStart.magnitude;
    if (!indent && style.indentFirstLine && style.indentFirstLine.magnitude) {
      indent = style.indentFirstLine.magnitude;
    }
    var heading = style.namedStyleType === 'HEADING_1';
    var center = style.alignment === 'CENTER';
    // Docs gives every heading its own anchor; it is what lets the app link
    // straight to a song instead of dumping you at the top of the doc.
    var headingId = style.headingId || '';

    // A vertical tab is a soft line break; the songbook has 231 of them, and
    // treating one as a space would weld a chord line onto its lyric line.
    var segments = [[]];
    for (var k = 0; k < chars.length; k++) {
      var chr = chars[k].ch;
      if (chr === VTAB_CHAR) { segments.push([]); continue; }
      if (chr === NL_CHAR || chr === CR_CHAR) continue;
      segments[segments.length - 1].push(chars[k]);
    }

    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s];
      var text = '', boldChars = 0, totalChars = 0;
      for (var m = 0; m < seg.length; m++) {
        text += seg[m].ch;
        if (isBlankChar(seg[m].ch)) continue;
        totalChars++;
        if (seg[m].bold) boldChars++;
      }
      out.push({
        text: text,
        heading: heading,
        headingId: headingId,
        indent: indent,
        center: center,
        // bold is the real chord signal: a plain regex misses  C /B A- /G F,
        // Bb^7, and superscript sevens (403 such lines in the songbook)
        bold: totalChars > 0 && (boldChars / totalChars) > 0.5
      });
    }
  }
  return out;
}

function isMarkerText(t) {
  var s = String(t || '').toLowerCase().replace(/^[^a-z]+/, '');
  var words = ['chorus', 'refrain', 'solo', 'bridge', 'verse', 'tag', 'outro', 'instrumental', 'interlude'];
  for (var i = 0; i < words.length; i++) {
    if (s.indexOf(words[i]) === 0) return true;
  }
  return false;
}

function isMetaText(t) {
  var s = String(t || '').toLowerCase();
  return s.indexOf('capo') === 0 || s.indexOf('intro:') === 0 ||
         s.indexOf('key:') === 0 || s.indexOf('tuning') === 0;
}

/** Turn the flat paragraph list into song records. Pure: unit-testable. */
function parseSongs(paras) {
  var songs = [];
  var cur = null;
  var block = [];
  var inHeader = false;

  function closeBlock() {
    if (block.length && cur) cur._blocks.push(block);
    block = [];
  }
  function closeSong() {
    closeBlock();
    if (cur) songs.push(cur);
    cur = null;
  }

  for (var i = 0; i < paras.length; i++) {
    var p = paras[i];
    // keep the raw text: chord lines are aligned over their lyrics with runs
    // of spaces and tabs, and that spacing is the whole point of showing them
    var t = String(p.text || '');
    var trimmed = t.replace(/^\s+|\s+$/g, '');

    if (p.heading) {
      if (trimmed === '') continue;
      closeSong();
      cur = { title: trimmed, artist: '', meta: [], headingId: p.headingId || '', _blocks: [] };
      inHeader = true;
      continue;
    }
    if (!cur) continue;

    if (trimmed === '') { closeBlock(); inHeader = false; continue; }

    if (inHeader) {
      if (isMetaText(trimmed)) { cur.meta.push(trimmed); continue; }
      if (!cur.artist && !p.bold && !isMarkerText(trimmed)) { cur.artist = trimmed; continue; }
    }
    block.push({ text: t, trimmed: trimmed, bold: p.bold, indent: p.indent, center: p.center });
  }
  closeSong();

  var out = [];
  for (var s = 0; s < songs.length; s++) {
    out.push(buildSong(songs[s]));
  }
  return out;
}

function buildSong(raw) {
  var sections = [];
  for (var b = 0; b < raw._blocks.length; b++) {
    var blk = raw._blocks[b];
    if (!blk.length) continue;

    var allCentered = true;
    for (var i = 0; i < blk.length; i++) if (!blk[i].center) allCentered = false;
    if (allCentered && blk.length <= 2 && isMarkerText(blk[0].trimmed)) {
      sections.push({ type: 'marker', ref: blk[0].trimmed, lines: [] });
      continue;
    }

    var indented = 0;
    for (var j = 0; j < blk.length; j++) if (blk[j].indent > 0) indented++;
    var type = indented > blk.length / 2 ? 'chorus' : 'verse';

    var lines = [];
    var pending = null;
    for (var k = 0; k < blk.length; k++) {
      if (blk[k].bold) {
        pending = pending === null ? blk[k].text : pending + NL_CHAR + blk[k].text;
      } else {
        lines.push({ c: pending, t: blk[k].trimmed });
        pending = null;
      }
    }
    if (pending !== null) lines.push({ c: pending, t: '' });
    if (lines.length) sections.push({ type: type, lines: lines });
  }

  var hasChorus = false, hasChorusMarker = false;
  for (var m = 0; m < sections.length; m++) {
    if (sections[m].type === 'chorus') hasChorus = true;
    if (sections[m].type === 'marker' &&
        String(sections[m].ref).toLowerCase().indexOf('chorus') === 0) hasChorusMarker = true;
  }

  return {
    title: raw.title,
    artist: raw.artist,
    meta: raw.meta,
    headingId: raw.headingId || '',
    sections: sections,
    // the songbook says "repeat the chorus" but never indented one, so we
    // cannot tell which block it means. Flag it; the app asks once.
    needsChorusTag: hasChorusMarker && !hasChorus
  };
}

/**
 * Write a song back into the songbook using the Doc's own conventions, so a
 * page added from the app looks hand-typed and the importer reads it back
 * identically: Heading 1 title in bold, artist beneath, a blank paragraph
 * between stanzas, choruses indented half an inch, markers centred and bold,
 * chord lines bold in Courier New.
 *
 * Appends at the end rather than slotting in alphabetically. Finding the right
 * spot means walking ~8,900 paragraphs through DocumentApp, which is the slow
 * path this app deliberately avoids, and the importer matches on title, so
 * position has never mattered to it. Move it in the doc afterwards if you like.
 */
/**
 * What the rest of the book is set in.
 *
 * Sampled, never hardcoded - the whole point of writing a song back is that it
 * should be indistinguishable from one that was always there. Chord lines are
 * bold, so they are skipped when looking for the body face.
 */
function sampleBookStyle(body) {
  var out = { font: null, size: null, titleFont: null, titleSize: null, after: 0 };
  var n = body.getNumChildren();
  var scanned = 0;
  for (var i = 0; i < n && scanned < 500; i++) {
    var ch = body.getChild(i);
    if (ch.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    scanned++;
    var p = ch.asParagraph();
    var txt = p.getText();
    if (!txt || !txt.replace(/\s/g, '')) continue;
    try {
      var t = p.editAsText();
      if (p.getHeading() === DocumentApp.ParagraphHeading.HEADING1) {
        if (out.titleFont === null) {
          out.titleFont = t.getFontFamily(0);
          out.titleSize = t.getFontSize(0);
        }
        continue;
      }
      if (t.isBold(0)) continue;                 // a chord line, not body text
      if (out.font === null) {
        out.font = t.getFontFamily(0);
        out.size = t.getFontSize(0);
        out.after = p.getSpacingAfter() || 0;
      }
    } catch (e) { continue; }
    if (out.font !== null && out.titleFont !== null) break;
  }
  if (!out.size) out.size = 11;
  if (!out.titleSize) out.titleSize = out.size + 3;
  return out;
}

/** Printable area, in points. */
function pageBox(body) {
  var box = { w: 468, h: 648 };                  // letter with one-inch margins
  try {
    box.w = body.getPageWidth() - body.getMarginLeft() - body.getMarginRight();
    box.h = body.getPageHeight() - body.getMarginTop() - body.getMarginBottom();
  } catch (e) {}
  if (!(box.w > 50)) box.w = 468;
  if (!(box.h > 50)) box.h = 648;
  return box;
}

/**
 * The largest scale at or below 1 that keeps the whole song on one page.
 *
 * Rough by necessity: Docs will not report how tall a paragraph is until it
 * has laid it out, so this models it - every paragraph costs its point size
 * times the default 1.15 leading plus the book's paragraph spacing, and a
 * line long enough to wrap costs whole extra lines. Glyphs in a proportional
 * face average a bit under half the point size wide.
 *
 * Erring small is the right way to be wrong here, so it never scales up and
 * stops at 0.6 - past that it is too small to sing from, and overflowing is
 * the better failure.
 */
function fitScale(plan, box) {
  for (var step = 0; step <= 8; step++) {
    var f = 1 - step * 0.05;
    var total = 0;
    for (var i = 0; i < plan.length; i++) {
      var size = plan[i].size * f;
      var chars = (plan[i].text || '').length;
      var width = Math.max(20, box.w - (plan[i].indent || 0));
      var rows = chars ? Math.ceil((chars * size * 0.48) / width) : 1;
      if (rows < 1) rows = 1;
      total += rows * size * 1.15 + (plan[i].after || 0) * f;
    }
    if (total <= box.h) return f;
  }
  return 0.6;
}

function apiAppendToDoc(songId) {
  var found = findSongRow(songId);
  if (found < 0) throw new Error('Song not found');
  var song = songFromRow(readSongRow(found));
  if (!song.sections.length) throw new Error('That song has no verses to write');

  var id = docId();
  if (!id) throw new Error('No songbook set. Settings, Songbook, paste the link to your Google Doc.');
  var doc = DocumentApp.openById(id);
  var body = doc.getBody();

  // Every paragraph is reset explicitly - appendParagraph inherits the previous
  // paragraph's heading, indent and alignment, which would smear the title
  // style down the whole song.
  function plain(text) {
    var p = body.appendParagraph(text || '');
    p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    p.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    p.setIndentStart(0);
    p.setIndentFirstLine(0);
    if (text) p.editAsText().setBold(false);
    return p;
  }

  // Every song in the book starts on a fresh page, and the break rides on the
  // LAST paragraph of the song before it, with the heading immediately after -
  // no blank line between. 223 of the 228 breaks in the doc do exactly this.
  var kids = body.getNumChildren();
  for (var k = kids - 1; k >= 0 && k > kids - 8; k--) {
    var child = body.getChild(k);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    var prev = child.asParagraph();
    var already = false;
    for (var c = prev.getNumChildren() - 1; c >= 0; c--) {
      if (prev.getChild(c).getType() === DocumentApp.ElementType.PAGE_BREAK) {
        already = true;
        break;
      }
    }
    if (!already) prev.appendPageBreak();
    break;
  }

  // Lay the whole song out on paper before writing a word of it - the type
  // size depends on how much there is, so nothing can be emitted until the
  // last line is known.
  var style = sampleBookStyle(body);
  var box = pageBox(body);
  var plan = [];
  function put(text, kind, indent) {
    plan.push({
      text: text || '', kind: kind, indent: indent || 0,
      size: kind === 'title' ? style.titleSize : style.size,
      after: kind === 'title' ? style.after : style.after
    });
  }

  put(song.title, 'title', 0);
  if (song.artist) put(song.artist, 'body', 0);
  for (var m = 0; m < song.meta.length; m++) put(song.meta[m], 'body', 0);

  var lineCount = 0;
  for (var s = 0; s < song.sections.length; s++) {
    var sec = song.sections[s];
    put('', 'blank', 0);                        // the stanza break
    if (sec.type === 'marker') {
      put(sec.ref || 'Chorus', 'marker', 0);
      continue;
    }
    var ind = sec.type === 'chorus' ? 36 : 0;   // half an inch
    for (var l = 0; l < sec.lines.length; l++) {
      var ln = sec.lines[l];
      if (ln.c) put(ln.c, 'chord', ind);
      if (!ln.t) continue;
      put(ln.t, 'body', ind);
      lineCount++;
    }
  }

  var f = fitScale(plan, box);
  function scaled(size) { return Math.max(5, Math.round(size * f * 2) / 2); }

  for (var q = 0; q < plan.length; q++) {
    var it = plan[q];
    var p;
    if (it.kind === 'title') {
      p = body.appendParagraph(it.text);
      p.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      p.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
      p.setIndentStart(0);
      p.editAsText().setBold(true);
      if (style.titleFont) p.editAsText().setFontFamily(style.titleFont);
      p.editAsText().setFontSize(scaled(style.titleSize));
      continue;
    }
    p = plain(it.text);
    if (it.indent) p.setIndentStart(it.indent);
    if (it.kind === 'marker') {
      p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      p.editAsText().setBold(true);
    }
    if (!it.text) continue;                     // a blank has nothing to style
    var tx = p.editAsText();
    // A chord line inside a chorus is indented WITH it, exactly as the
    // songbook does it. Leaving it flush left drops the block below the
    // majority-indented test on re-import and it comes back as a verse.
    if (it.kind === 'chord') tx.setBold(true).setFontFamily('Courier New');
    else if (style.font) tx.setFontFamily(style.font);
    tx.setFontSize(scaled(style.size));
  }
  doc.saveAndClose();

  // now that it lives in the doc, a re-import would match it by title
  song.source = 'doc';
  writeRow(TAB_SONGS, SONG_COLS, found, songToRow(song));
  return {
    title: song.title, lines: lineCount,
    font: style.font || 'the book default',
    size: scaled(style.size),
    shrunk: f < 1
  };
}

/**
 * Run this from the editor BEFORE importing. It reads the Doc and reports what
 * it found without writing a single cell, so a parsing surprise costs nothing.
 * Expected on the songbook as of 2026-08-16: 242 songs, 0 without an artist,
 * 0 with no sections, about 20 flagged for chorus tagging.
 */
/* ============================================================
   Lyric lookup
   ------------------------------------------------------------
   Two keyless sources, tried in order. lrclib is first because it
   matches on artist AND track and returns clean plain text; lyrics.ovh
   is the fallback and needs an artist to work at all.

   Whatever comes back is guessed into verses and choruses. It will not
   always be right - the preview exists so nothing lands in the form
   without being looked at first.

   NOTE: this is the only thing in the app that reaches outside Google,
   so it adds an external-request permission. After pasting this build,
   run any function once in the editor to accept it, then redeploy.
   ============================================================ */

function httpJson(url) {
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'SongBurner/1.0 (personal lyric practice app)' }
    });
    if (res.getResponseCode() !== 200) return null;
    return JSON.parse(res.getContentText());
  } catch (e) {
    return null;
  }
}

function enc(s) { return encodeURIComponent(String(s || '').trim()); }

/** Pick the first result that actually carries plain lyrics. */
function firstWithLyrics(arr) {
  if (!arr || !arr.length) return null;
  for (var i = 0; i < arr.length; i++) {
    var r = arr[i];
    if (r && !r.instrumental && r.plainLyrics && String(r.plainLyrics).trim()) return r;
  }
  return null;
}

function lrclibLookup(title, artist, tried) {
  var hit = null;
  if (artist) {
    tried.push('lrclib exact');
    var one = httpJson('https://lrclib.net/api/get?artist_name=' + enc(artist) +
                       '&track_name=' + enc(title));
    if (one && !one.instrumental && one.plainLyrics) hit = one;
    if (!hit) {
      tried.push('lrclib search');
      hit = firstWithLyrics(httpJson('https://lrclib.net/api/search?artist_name=' +
                                     enc(artist) + '&track_name=' + enc(title)));
    }
  }
  if (!hit) {
    tried.push('lrclib title only');
    hit = firstWithLyrics(httpJson('https://lrclib.net/api/search?q=' +
                                   enc(title + (artist ? ' ' + artist : ''))));
  }
  if (!hit) return null;
  return {
    text: String(hit.plainLyrics),
    source: 'LRCLIB',
    matchedTitle: hit.trackName || title,
    matchedArtist: hit.artistName || artist
  };
}

function lyricsOvhLookup(title, artist, tried) {
  if (!artist) return null;                 // it has no search, only artist/title
  tried.push('lyrics.ovh');
  var r = httpJson('https://api.lyrics.ovh/v1/' + enc(artist) + '/' + enc(title));
  if (!r || !r.lyrics || !String(r.lyrics).trim()) return null;
  return {
    text: String(r.lyrics),
    source: 'lyrics.ovh',
    matchedTitle: title,
    matchedArtist: artist
  };
}

/* Lines these sources bolt on that are not part of the song. */
function isLyricJunk(line) {
  var l = line.toLowerCase();
  if (l.indexOf('you might also like') !== -1) return true;
  if (l.indexOf('paroles de la chanson') !== -1) return true;
  if (/^\d*\s*embed$/.test(l)) return true;
  if (/^\d+ contributors?/.test(l)) return true;
  if (/^see .+ live$/.test(l)) return true;
  return false;
}

/** A block reduced to something comparable, for spotting repeats. */
function blockKey(lines) {
  var s = lines.join(' ').toLowerCase();
  s = s.replace(/[^a-z0-9 ]+/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Guess verses and choruses out of a plain lyric sheet.
 *
 * Two strategies, in order of how much they can be trusted:
 *   1. Explicit [Chorus] / (Verse 2) headers, when the source has them.
 *   2. Repetition - the block that appears more than once is the chorus.
 *
 * Repeats are collapsed to a single block, which is how the songbook doc
 * writes a chorus: once, indented, with later returns marked rather than
 * retyped.
 */
function analyzeLyrics(text) {
  var raw = String(text || '').replace(/\r/g, '');
  var lines = raw.split('\n');
  var blocks = [], cur = [], tags = [], curTag = '';

  function close() {
    if (cur.length) { blocks.push(cur); tags.push(curTag); }
    cur = []; curTag = '';
  }
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/\s+$/, '').replace(/^\s+/, '');
    if (!line) { close(); continue; }
    if (isLyricJunk(line)) continue;
    var m = line.match(/^[\[\(]\s*([^\]\)]+?)\s*[\]\)]$/);
    if (m) {                                 // a section header on its own line
      close();
      curTag = m[1].toLowerCase();
      continue;
    }
    cur.push(line);
  }
  close();

  // Nothing blank-separated? Some sources return one wall of text. Chunk it
  // so there is at least something to move around.
  if (blocks.length === 1 && blocks[0].length > 8) {
    var all = blocks[0], chunked = [], t2 = [];
    for (var c = 0; c < all.length; c += 4) {
      chunked.push(all.slice(c, c + 4));
      t2.push('');
    }
    blocks = chunked; tags = t2;
  }

  var taggedChorus = false;
  for (var g = 0; g < tags.length; g++) if (tags[g].indexOf('chorus') !== -1) taggedChorus = true;

  var counts = {};
  for (var k = 0; k < blocks.length; k++) {
    var key = blockKey(blocks[k]);
    counts[key] = (counts[key] || 0) + 1;
  }

  var out = [], seen = {}, collapsed = 0;
  for (var b = 0; b < blocks.length; b++) {
    var kk = blockKey(blocks[b]);
    if (!kk) continue;
    if (seen[kk]) { collapsed++; continue; }   // the chorus, coming round again
    seen[kk] = true;
    var isChorus;
    if (taggedChorus) {
      // a pre-chorus is its own thing; only an actual chorus counts
      isChorus = tags[b].indexOf('chorus') !== -1 && tags[b].indexOf('pre') === -1;
    } else {
      isChorus = counts[kk] > 1;
    }
    var ls = [];
    for (var l2 = 0; l2 < blocks[b].length; l2++) ls.push({ c: null, t: blocks[b][l2] });
    out.push({ type: isChorus ? 'chorus' : 'verse', lines: ls });
  }
  return { sections: out, collapsed: collapsed, tagged: taggedChorus };
}

function apiFetchLyrics(title, artist) {
  title = String(title || '').trim();
  artist = String(artist || '').trim();
  if (!title) throw new Error('Type a title first, and an artist if you have one.');

  var tried = [];
  var found = lrclibLookup(title, artist, tried);
  if (!found) found = lyricsOvhLookup(title, artist, tried);
  if (!found) {
    throw new Error('No lyrics came back for "' + title + '"' +
      (artist ? ' by ' + artist : ' (no artist given - adding one helps a lot)') +
      '. Tried ' + tried.join(', ') + '.');
  }

  var an = analyzeLyrics(found.text);
  if (!an.sections.length) throw new Error('Found a match but it had no usable lyrics in it.');
  return {
    source: found.source,
    matchedTitle: found.matchedTitle,
    matchedArtist: found.matchedArtist,
    sections: an.sections,
    collapsed: an.collapsed,
    tagged: an.tagged
  };
}


function testParse() {
  var paras = fetchDocParagraphs();
  var songs = parseSongs(paras);

  var verses = 0, choruses = 0, markers = 0, lyricLines = 0, chordLines = 0;
  var noArtist = [], noSections = [], flagged = [], dupes = [], seen = {};

  for (var i = 0; i < songs.length; i++) {
    var s = songs[i];
    if (!s.artist) noArtist.push(s.title);
    if (!s.sections.length) noSections.push(s.title);
    if (s.needsChorusTag) flagged.push(s.title);
    var key = normalizeTitle(s.title);
    if (seen[key]) dupes.push(s.title); else seen[key] = true;
    for (var j = 0; j < s.sections.length; j++) {
      var sec = s.sections[j];
      if (sec.type === 'marker') { markers++; continue; }
      if (sec.type === 'chorus') choruses++; else verses++;
      for (var k = 0; k < sec.lines.length; k++) {
        if (sec.lines[k].t) lyricLines++;
        if (sec.lines[k].c) chordLines++;
      }
    }
  }

  var report = [
    'Paragraphs read : ' + paras.length,
    'Songs parsed    : ' + songs.length,
    'Verses          : ' + verses,
    'Choruses        : ' + choruses,
    'Markers         : ' + markers,
    'Lyric lines     : ' + lyricLines,
    'Lines w/ chords : ' + chordLines,
    '',
    'Songs with no artist   : ' + noArtist.length + (noArtist.length ? ' -> ' + noArtist.join(', ') : ''),
    'Songs with no sections : ' + noSections.length + (noSections.length ? ' -> ' + noSections.join(', ') : ''),
    'Duplicate titles       : ' + dupes.length + (dupes.length ? ' -> ' + dupes.join(', ') : ''),
    '',
    'Need chorus tagging (' + flagged.length + '):',
    '  ' + flagged.join(', ')
  ].join(NL_CHAR);

  Logger.log(report);
  return report;
}

/**
 * Import songs from the Doc.
 * Matched on normalized title, so re-ordering or re-alphabetizing the Doc
 * changes nothing. Existing songs are left alone unless replaceAll is set.
 */
function apiImportDoc(replaceAll) {
  var parsed = parseSongs(fetchDocParagraphs());
  var existing = readRows(TAB_SONGS, SONG_COLS).map(songFromRow);

  var byKey = {};
  for (var i = 0; i < existing.length; i++) byKey[existing[i].titleKey] = existing[i];

  var added = [], updated = [], skipped = 0, flagged = [];
  var toAppend = [];
  var importStamp = Date.now();

  for (var j = 0; j < parsed.length; j++) {
    var song = parsed[j];
    var key = normalizeTitle(song.title);
    if (!key) continue;
    var prior = byKey[key];

    if (prior && !replaceAll) {
      skipped++;
      // refresh the deep-link anchor even when the song itself is untouched -
      // Docs reissues heading ids when the doc is edited
      if (song.headingId && prior.headingId !== song.headingId) {
        prior.headingId = song.headingId;
        writeRow(TAB_SONGS, SONG_COLS, prior._row, songToRow(prior));
      }
      continue;
    }

    if (prior && replaceAll) {
      prior.artist = song.artist;
      prior.meta = song.meta;
      prior.sections = song.sections;
      prior.needsChorusTag = song.needsChorusTag;
      prior.headingId = song.headingId || prior.headingId;
      prior.source = 'doc';
      writeRow(TAB_SONGS, SONG_COLS, prior._row, songToRow(prior));
      updated.push(song.title);
    } else {
      toAppend.push(songToRow({
        id: uid(), title: song.title, artist: song.artist, meta: song.meta,
        sections: song.sections, listIds: [], youtube: '', spotify: '',
        headingId: song.headingId || '',
        needsChorusTag: song.needsChorusTag, source: 'doc', createdAt: Date.now(),
        // spread these out so the doc's own order is the starting manual order;
        // a shared Date.now() would tie every imported song together
        sortIndex: importStamp + j
      }));
      added.push(song.title);
    }
    if (song.needsChorusTag) flagged.push(song.title);
  }

  appendRows(TAB_SONGS, SONG_COLS, toAppend);
  metaSet('lastImport', new Date().toISOString());

  return {
    parsed: parsed.length,
    added: added.length,
    updated: updated.length,
    skipped: skipped,
    addedTitles: added.slice(0, 60),
    flagged: flagged.length,
    flaggedTitles: flagged.slice(0, 60)
  };
}


/* ============================================================
   The page.

   Everything below lives inside one template literal, which means three
   characters are forbidden in here: a backtick, a dollar-brace, and a
   BACKSLASH. JS swallows a lone backslash before the browser ever sees it,
   so "\n" would arrive as "n" and a regex like \S would quietly become S and
   match the wrong thing. Hence String.fromCharCode for control characters and
   string methods instead of regular expressions throughout.
   ============================================================ */

/* ---- end of Code.gs server half ---- */
return { apiCall: apiCall, setup: setup, BUILD: BUILD };
};
