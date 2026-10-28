/* Video cue sheets: plan a video shot by shot.
   Sheets live on this device only (IndexedDB 'mwm-studio'), and move between
   devices as a backup file. #/ is the list, #/<id> is one sheet. */

const DB_NAME = 'mwm-studio';
const VERSION = 1;
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        // cues: { id, title, created, updated, rows: [{ id, dur, say, screen, notes }] }
        req.result.createObjectStore('cues', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction('cues', mode);
    const req = fn(t.objectStore('cues'));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
  }));
}

const allSheets = () => tx('readonly', (s) => s.getAll());
const getSheet = (id) => tx('readonly', (s) => s.get(id));
const putSheet = (sheet) => tx('readwrite', (s) => s.put(sheet));
const deleteSheet = (id) => tx('readwrite', (s) => s.delete(id));

const newId = () => crypto.randomUUID();
const newRow = () => ({ id: newId(), dur: 0, say: '', screen: '', notes: '' });

/* "1:30" -> 90, "45" -> 45, "1:02:03" -> 3723. */
function parseTime(text) {
  const parts = String(text).trim().split(':').map((p) => p.trim());
  if (parts.some((p) => !/^\d*$/.test(p))) return null;
  return parts.reduce((sum, p) => sum * 60 + (Number(p) || 0), 0);
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const totalTime = (sheet) => sheet.rows.reduce((sum, r) => sum + (r.dur || 0), 0);

/* Small DOM builder. Text always goes in as text, never as HTML. */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
}

const app = document.getElementById('app');

/* ---------- Sheet list ---------- */

async function showList() {
  document.title = 'Cue sheets · Studio';
  const sheets = (await allSheets()).sort((a, b) => b.updated - a.updated);
  const restore = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: () => restoreBackup(restore.files[0]) });
  app.replaceChildren(
    h('div', { class: 'bar' },
      h('a', { class: 'back', href: '/studio/' }, '‹ Studio'),
    ),
    h('div', { class: 'bar' },
      h('h1', { class: 'grow' }, 'Cue sheets'),
      h('button', { onclick: () => downloadBackup(sheets), disabled: !sheets.length }, 'Backup'),
      h('button', { onclick: () => restore.click() }, 'Restore'),
      restore,
      h('button', { class: 'primary', onclick: createSheet }, 'New sheet'),
    ),
    h('ul', { class: 'sheets' }, sheets.map((s) =>
      h('li', {}, h('a', { href: `#/${s.id}` },
        h('span', {}, s.title || 'Untitled'),
        h('small', {}, `${s.rows.length} shots · ${formatTime(totalTime(s))}`),
      )),
    )),
  );
}

async function createSheet() {
  const now = Date.now();
  const sheet = { id: newId(), title: '', created: now, updated: now, rows: [newRow()] };
  await putSheet(sheet);
  location.hash = `#/${sheet.id}`;
}

function downloadBackup(sheets) {
  const blob = new Blob([JSON.stringify({ kind: 'mwm-cue-sheets', version: 1, sheets }, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `cue-sheets-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* Restore adds sheets from the file; a sheet already here is replaced only by a newer copy. */
async function restoreBackup(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { data = null; }
  if (!data || data.kind !== 'mwm-cue-sheets' || !Array.isArray(data.sheets)) {
    alert('That file is not a cue sheet backup.');
    return;
  }
  for (const s of data.sheets) {
    if (!s || typeof s.id !== 'string' || !Array.isArray(s.rows)) continue;
    const here = await getSheet(s.id);
    if (here && here.updated >= s.updated) continue;
    await putSheet({
      id: s.id,
      title: String(s.title || ''),
      created: Number(s.created) || Date.now(),
      updated: Number(s.updated) || Date.now(),
      rows: s.rows.map((r) => ({
        id: typeof r.id === 'string' ? r.id : newId(),
        dur: Math.max(0, Math.floor(Number(r.dur) || 0)),
        say: String(r.say || ''), screen: String(r.screen || ''), notes: String(r.notes || ''),
      })),
    });
  }
  showList();
}

/* ---------- One sheet ---------- */

let sheet = null;
let saveTimer = null;

function save() {
  sheet.updated = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => putSheet(sheet), 300);
}

function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; return putSheet(sheet); }
  return Promise.resolve();
}

function grow(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

async function showSheet(id) {
  sheet = await getSheet(id);
  if (!sheet) { location.hash = '#/'; return; }
  document.title = `${sheet.title || 'Untitled'} · Cue sheets`;

  const total = h('span', { class: 'total' });
  const tbody = h('tbody');
  let confirmTimer = null;
  const del = h('button', { class: 'danger', onclick: async () => {
    if (del.dataset.armed) {
      await deleteSheet(sheet.id);
      location.hash = '#/';
      return;
    }
    del.dataset.armed = '1';
    del.textContent = 'Delete for good?';
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => { delete del.dataset.armed; del.textContent = 'Delete'; }, 3000);
  } }, 'Delete');

  function refreshTimes() {
    let at = 0;
    [...tbody.rows].forEach((tr, i) => {
      tr.querySelector('.num').textContent = i + 1;
      tr.querySelector('.at').textContent = formatTime(at);
      at += sheet.rows[i].dur || 0;
    });
    total.textContent = formatTime(totalTime(sheet));
  }

  function field(row, key, label) {
    const ta = h('textarea', { rows: 1, value: row[key], 'aria-label': label,
      oninput: () => { row[key] = ta.value; grow(ta); save(); },
      onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); insertAfter(row); } },
    });
    requestAnimationFrame(() => grow(ta));
    return h('td', { class: key, 'data-label': label }, ta);
  }

  function rowEl(row) {
    const dur = h('input', { value: row.dur ? formatTime(row.dur) : '', placeholder: '0:00', inputMode: 'numeric', 'aria-label': 'Length',
      oninput: () => { const t = parseTime(dur.value); if (t != null) { row.dur = t; save(); refreshTimes(); } },
      onchange: () => { dur.value = row.dur ? formatTime(row.dur) : ''; },
    });
    const move = (by) => {
      const i = sheet.rows.indexOf(row);
      const j = i + by;
      if (j < 0 || j >= sheet.rows.length) return;
      sheet.rows.splice(i, 1);
      sheet.rows.splice(j, 0, row);
      save();
      render(row.id);
    };
    const remove = () => {
      if (sheet.rows.length === 1) return;
      sheet.rows.splice(sheet.rows.indexOf(row), 1);
      save();
      render();
    };
    return h('tr', { dataset: { id: row.id } },
      h('td', { class: 'num' }),
      h('td', { class: 'at' }),
      h('td', { class: 'dur' }, dur),
      field(row, 'say', 'Say'),
      field(row, 'screen', 'On screen'),
      field(row, 'notes', 'Notes'),
      h('td', { class: 'tools' },
        h('button', { class: 'icon', title: 'Move up', onclick: () => move(-1) }, '↑'),
        h('button', { class: 'icon', title: 'Move down', onclick: () => move(1) }, '↓'),
        h('button', { class: 'icon', title: 'Add shot below', onclick: () => insertAfter(row) }, '+'),
        h('button', { class: 'icon', title: 'Remove shot', onclick: remove }, '×'),
      ),
    );
  }

  function insertAfter(row) {
    const fresh = newRow();
    sheet.rows.splice(sheet.rows.indexOf(row) + 1, 0, fresh);
    save();
    render(fresh.id, 'say');
  }

  function render(focusId, focusField) {
    tbody.replaceChildren(...sheet.rows.map(rowEl));
    refreshTimes();
    if (focusId) {
      const tr = [...tbody.rows].find((r) => r.dataset.id === focusId);
      const el = focusField ? tr.querySelector(`.${focusField} textarea`) : tr.querySelector('.tools button');
      el.focus();
    }
  }

  const title = h('input', { class: 'title', value: sheet.title, placeholder: 'Untitled', 'aria-label': 'Title',
    oninput: () => { sheet.title = title.value; document.title = `${sheet.title || 'Untitled'} · Cue sheets`; save(); },
  });

  app.replaceChildren(
    h('div', { class: 'bar' },
      h('a', { class: 'back', href: '#/' }, '‹ Cue sheets'),
    ),
    h('div', { class: 'bar' },
      title,
      total,
      h('button', { class: 'noprint', onclick: () => window.print() }, 'Print'),
      h('span', { class: 'noprint' }, del),
    ),
    h('table', {},
      h('thead', {}, h('tr', {},
        h('th', {}, '#'), h('th', {}, 'At'), h('th', {}, 'Length'),
        h('th', {}, 'Say'), h('th', {}, 'On screen'), h('th', {}, 'Notes'), h('th', { class: 'tools' }),
      )),
      tbody,
    ),
    h('div', { class: 'bar noprint' },
      h('button', { onclick: () => insertAfter(sheet.rows[sheet.rows.length - 1]) }, 'Add shot'),
    ),
  );
  render();
}

/* ---------- Routing ---------- */

async function route() {
  if (sheet) { await flush(); sheet = null; }
  const id = location.hash.replace(/^#\/?/, '');
  if (id) showSheet(id); else showList();
}

window.addEventListener('hashchange', route);
window.addEventListener('pagehide', () => { if (sheet) flush(); });
route();
