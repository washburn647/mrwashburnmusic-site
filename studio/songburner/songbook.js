/* Song Burner's songbook doc, in the studio.
   The public app no longer shows the songbook buttons: the doc is Kyle's own. Here they read the
   Song Burner library kept on this device (the same IndexedDB the app uses, same site address),
   through the app's own engine, and never write to it.
   - Open the doc, or open it at a song (the heading link the import saved).
   - Copy a song for the songbook: rich text in the doc's conventions (Heading 1 title on a new
     page, artist under it, choruses indented half an inch, chord lines bold Courier New, a
     "Chorus" marker centred and bold). Paste it at the end of the doc. */

import { h } from '../dom.js';

const DOC_KEY = 'studio-songburner-doc';
const COPIED_KEY = 'studio-songburner-copied';
const FILTER_KEY = 'studio-songburner-book-filter';

function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function save(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

/* ---------- the library on this device, read only ---------- */

function readTabs() {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open('songburner', 1); } catch (e) { resolve(null); return; }
    // No library on this device: do not create one here.
    req.onupgradeneeded = () => { req.transaction.abort(); };
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('tabs')) { d.close(); resolve(null); return; }
      const tabs = {};
      const tx = d.transaction('tabs', 'readonly');
      const cur = tx.objectStore('tabs').openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return;
        if (c.key !== '__order') tabs[c.key] = c.value || [];
        c.continue();
      };
      tx.oncomplete = () => { d.close(); resolve(tabs); };
      tx.onerror = () => { d.close(); resolve(null); };
    };
  });
}

/* Just enough of SpreadsheetApp for the engine's reads. Anything it writes stays in memory. */
function workbook(tabs) {
  const empty = (r) => !r || r.every((v) => v === '' || v === undefined);
  const sheet = (name) => ({
    getName: () => name,
    getLastRow() { const rows = tabs[name]; for (let i = rows.length - 1; i >= 0; i--) if (!empty(rows[i])) return i + 1; return 0; },
    getMaxColumns() { return Math.max(26, ...tabs[name].map((r) => r.length)); },
    getMaxRows() { return Math.max(1000, tabs[name].length); },
    insertColumnsAfter() { return this; },
    setFrozenRows() { return this; },
    appendRow(v) { tabs[name].splice(this.getLastRow(), Infinity, v.slice()); return this; },
    deleteRow() { return this; },
    deleteRows() { return this; },
    getRange(row, col, nr = 1, nc = 1) {
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const src = tabs[name][row - 1 + i] || [];
            out.push(Array.from({ length: nc }, (_, j) => (src[col - 1 + j] === undefined ? '' : src[col - 1 + j])));
          }
          return out;
        },
        getValue() { return this.getValues()[0][0]; },
        setValues(vals) {
          vals.forEach((line, i) => {
            const r = (tabs[name][row - 1 + i] = tabs[name][row - 1 + i] || []);
            line.forEach((v, j) => { r[col - 1 + j] = v; });
          });
          return this;
        },
        setValue(v) { return this.setValues([[v]]); }
      };
    }
  });
  const book = {
    getName: () => 'Song Burner', getUrl: () => '/songburner/backup/', getId: () => 'local',
    getSheetByName: (n) => (tabs[n] ? sheet(n) : null),
    getSheets: () => Object.keys(tabs).map(sheet),
    insertSheet(n) { tabs[n] = tabs[n] || []; return sheet(n); },
    deleteSheet() {}
  };
  const noDocs = () => { throw new Error('No Google Docs here'); };
  return {
    SpreadsheetApp: { getActiveSpreadsheet: () => book, openById: () => book },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    UrlFetchApp: { fetch: noDocs },
    DocumentApp: { openById: noDocs, ElementType: {}, ParagraphHeading: {}, HorizontalAlignment: {} },
    Docs: { Documents: { get: noDocs } },
    Logger: { log() {} },
    HtmlService: {}
  };
}

function call(services, action, params) {
  const out = JSON.parse(window.SongBurnerEngine(services).apiCall(JSON.stringify({ action, params })));
  if (!out.ok) throw new Error(out.error);
  return out.data;
}

/* ---------- the song, the way the doc writes it ---------- */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const keepSpaces = (s) => esc(s).replace(/ /g, ' ');

export function songbookCopy(song) {
  const html = [], text = [];
  html.push(`<h1 style="page-break-before:always;font-weight:bold">${esc(song.title)}</h1>`);
  text.push(song.title);
  for (const line of [song.artist, ...(song.meta || [])]) {
    if (!line) continue;
    html.push(`<p>${esc(line)}</p>`);
    text.push(line);
  }
  for (const sec of song.sections || []) {
    html.push('<p><br></p>');
    text.push('');
    if (sec.type === 'marker') {
      html.push(`<p style="text-align:center"><b>${esc(sec.ref || 'Chorus')}</b></p>`);
      text.push(sec.ref || 'Chorus');
      continue;
    }
    const pad = sec.type === 'chorus' ? ' style="margin-left:0.5in"' : '';
    const tab = sec.type === 'chorus' ? '\t' : '';
    for (const ln of sec.lines || []) {
      if (ln.c) {
        html.push(`<p${pad}><b style="font-family:'Courier New',monospace">${keepSpaces(ln.c)}</b></p>`);
        text.push(tab + ln.c);
      }
      if (!ln.t) continue;
      html.push(`<p${pad}>${esc(ln.t)}</p>`);
      text.push(tab + ln.t);
    }
  }
  return { html: html.join(''), text: text.join('\n') };
}

/* ---------- the view ---------- */

export function songbook(render) {
  let state = 'loading', services = null, songs = [], docUrl = '', err = '', q = '', note = '';
  let filter = load(FILTER_KEY) || 'new';
  let copied = {};
  try { copied = JSON.parse(load(COPIED_KEY) || '{}') || {}; } catch (e) {}

  async function start() {
    const tabs = await readTabs();
    if (!tabs || !tabs.Songs) { state = 'none'; render(); return; }
    try {
      services = workbook(tabs);
      const d = call(services, 'init', {});
      songs = d.songs || [];
      docUrl = d.docUrl || '';
      state = songs.length ? 'ready' : 'none';
    } catch (e) {
      state = 'error';
      err = e.message;
    }
    render();
  }

  function myDoc() {
    if (docUrl) return docUrl;
    const id = load(DOC_KEY);
    return id ? `https://docs.google.com/document/d/${id}/edit` : '';
  }

  async function copy(s) {
    note = '';
    try {
      const song = call(services, 'getSong', { id: s.id });
      const { html, text } = songbookCopy(song);
      if (window.ClipboardItem && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      copied[s.id] = Date.now();
      save(COPIED_KEY, JSON.stringify(copied));
      note = `Copied "${s.title}". Paste it at the end of the songbook.`;
    } catch (e) {
      note = `Could not copy: ${e.message}`;
    }
    render();
  }

  function docBar() {
    const url = myDoc();
    if (url) {
      return h('div', { class: 'bar' },
        h('a', { class: 'button primary', href: url, target: '_blank', rel: 'noopener' }, 'Open songbook'),
        docUrl ? null : h('button', { onclick: () => { save(DOC_KEY, null); render(); } }, 'Change link'));
    }
    const input = h('input', { type: 'url', class: 'doc-in', placeholder: 'Link to the songbook doc', 'aria-label': 'Songbook link' });
    return h('div', { class: 'bar' }, input, h('button', { onclick: () => {
      const m = input.value.match(/\/d\/([A-Za-z0-9_-]{10,})/);
      if (!m) { note = 'That is not a Google Doc link.'; render(); return; }
      save(DOC_KEY, m[1]);
      note = '';
      render();
    } }, 'Save'));
  }

  let started = false;
  function view() {
    if (!started) { started = true; start(); }
    if (state === 'loading') return h('p', { class: 'status' }, 'Loading…');
    if (state === 'error') return h('p', { class: 'status bad' }, err);
    if (state === 'none') {
      return [docBar(), h('p', { class: 'status' }, 'No Song Burner library on this device. Open ',
        h('a', { href: '/songburner/' }, 'Song Burner'), ' here first.')];
    }
    const needle = q.trim().toLowerCase();
    const list = songs
      .filter((s) => filter === 'all' || s.source !== 'doc')
      .filter((s) => !needle || `${s.title} ${s.artist || ''}`.toLowerCase().includes(needle))
      .sort((a, b) => a.title.localeCompare(b.title));
    const url = myDoc();
    const pick = (id, name) => h('button', { class: filter === id ? 'on' : '', onclick: () => { filter = id; save(FILTER_KEY, id); render(); } }, name);
    return [
      docBar(),
      note ? h('p', { class: 'status' }, note) : null,
      h('div', { class: 'bar' },
        h('div', { class: 'seg small' }, pick('new', 'Not in the songbook'), pick('all', 'All songs')),
        h('input', { type: 'search', class: 'find', placeholder: 'Find', value: q, 'aria-label': 'Find a song',
          oninput: (e) => { q = e.target.value; render(); } })),
      list.length ? h('div', { class: 'book' }, list.map((s) => h('div', { class: 'book-row' },
        h('div', { class: 'book-name' }, h('b', {}, s.title), s.artist ? h('span', {}, s.artist) : null),
        copied[s.id] && s.source !== 'doc' ? h('span', { class: 'tag' }, 'Copied') : null,
        url && s.headingId ? h('a', { class: 'button', href: `${url}#heading=${encodeURIComponent(s.headingId)}`, target: '_blank', rel: 'noopener' }, 'Open') : null,
        s.source !== 'doc' ? h('button', { onclick: () => copy(s) }, 'Copy for songbook') : null)))
        : h('p', { class: 'status' }, filter === 'new' && !needle ? 'Every song is in the songbook.' : 'No songs match.')
    ];
  }

  return view;
}
