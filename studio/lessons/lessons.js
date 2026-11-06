/* Private lesson pages: one page per lesson for each private student.
   Students, pieces (MusicXML) and the practice library are kept on this
   device (see ../db.js). A student gets their pages two ways:
   - a code: Publish locks all their lessons with it and puts them on the site,
     where only the code opens them (see /lesson/locked.js). Their flash card
     results come back the same way, and Results shows the weak spots.
   - a link to one lesson, with the page inside the link (see /lesson/codec.js).
   Everything also syncs through Kyle's private copy on the website (sync.js), so
   every device he signs in on has the same students, pieces and library.
   #/ is the week, #/library the practice library, #/<student> and
   #/<student>/<lesson> one student. */

import { store, newId, downloadJSON, today } from '../db.js';
import { h, grow, confirmButton } from '../dom.js';
import { encodeLesson, safeLink, formatDate, cleanDeck, cleanSetup } from '/lesson/codec.js';
import { readPieceFile, slimXML, pieceInfo } from '/lesson/score.js';
import { openPlayer, PIECE_MODES, KEYBOARD_MODES } from '/lesson/player.js';
import { openPractice } from '/lesson/practice.js';
import { LESSON_PAGE, LOCAL_PAGE, STUDIO_HOME, API } from '/lesson/paths.js';
import { newCode, cleanCode, publish, results, unpublish, secretFor, PICKS } from '/lesson/locked.js';
import { cardLabel, KINDS } from '/lesson/cards.js';
import { editDeck, deckSummary, newDeck } from './decks.js';
import * as sync from './sync.js';

const students = store('students');
const pieces = store('pieces');
const library = store('library');
const app = document.getElementById('app');

const INSTRUMENTS = ['Piano', 'Guitar'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const newItem = () => ({ id: newId(), title: '', detail: '', link: '', piece: null, setup: {}, deck: null });
const newLesson = (items = [newItem()]) => ({ id: newId(), date: today(), items, note: '', private: '', stars: 0, minutes: '' });
const copyItem = (it) => ({ ...newItem(), ...structuredClone(it), id: newId() });

/* Older records (before pieces and decks) get the new fields. */
function upgrade(s) {
  s.day ??= '';
  s.time ??= '';
  for (const l of s.lessons) {
    l.private ??= '';
    l.stars ??= 0;
    l.minutes ??= '';
    l.items = l.items.map((it) => {
      const out = { ...newItem(), ...it, deck: cleanDeck(it.deck) };
      if (out.piece && out.deck) out.deck = null;
      return out;
    });
  }
  return s;
}

/* ---------- The week ---------- */

function weekOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  return start.getTime();
}

async function showList() {
  document.title = 'Lesson pages · Studio';
  const all = (await students.all()).map(upgrade);
  const restore = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: () => restoreBackup(restore.files[0]) });
  const thisWeek = weekOf(today());
  const byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99') || a.name.localeCompare(b.name);
  const row = (s) => {
    const last = s.lessons[s.lessons.length - 1];
    const done = last && weekOf(last.date) === thisWeek;
    return h('li', {}, h('a', { href: `#/${s.id}` },
      h('span', {}, s.time ? h('b', { class: 'time' }, s.time.replace(/^0/, '')) : null, s.name || 'New student'),
      h('small', {}, [s.instrument, last && formatDate(last.date).replace(/^\w+, /, '')].filter(Boolean).join(' · '), done ? ' ✓' : '')));
  };
  const groups = DAYS.map((name, i) => [name, all.filter((s) => String(s.day) === String(i)).sort(byTime)]).filter(([, list]) => list.length);
  const rest = all.filter((s) => s.day === '' || s.day == null).sort((a, b) => a.name.localeCompare(b.name));
  const todayDay = new Date().getDay();
  // The week starts with today.
  groups.sort((a, b) => ((DAYS.indexOf(a[0]) - todayDay + 7) % 7) - ((DAYS.indexOf(b[0]) - todayDay + 7) % 7));

  app.replaceChildren(
    ...(STUDIO_HOME ? [h('div', { class: 'bar' }, h('a', { class: 'back', href: STUDIO_HOME }, '‹ Studio'))] : []),
    h('div', { class: 'bar' },
      h('h1', { class: 'grow' }, 'Lesson pages'),
      syncMark(),
      h('a', { class: 'button', href: '#/library' }, 'Library'),
      h('button', { onclick: backup, disabled: !all.length }, 'Backup'),
      h('button', { onclick: () => restore.click() }, 'Restore'),
      restore,
      h('button', { class: 'primary', onclick: addStudent }, 'Add student'),
    ),
    ...groups.map(([name, list]) => h('section', { class: 'day' }, h('h2', {}, name), h('ul', { class: 'sheets' }, list.map(row)))),
    ...(rest.length ? [h('section', { class: 'day' }, groups.length ? h('h2', {}, '—') : null, h('ul', { class: 'sheets' }, rest.map(row)))] : []),
  );
}

async function backup() {
  downloadJSON({ kind: 'mwm-lesson-students', version: 2, students: await students.all(), pieces: await pieces.all(), library: await library.all() }, `lesson-students-${today()}.json`);
}

async function addStudent() {
  const now = Date.now();
  const s = { id: newId(), name: '', instrument: '', day: '', time: '', created: now, updated: now, lessons: [newLesson()] };
  await students.put(s);
  location.hash = `#/${s.id}`;
}

/* Restore adds from the file; a student already here is replaced only by a newer copy. */
async function restoreBackup(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { data = null; }
  if (!data || data.kind !== 'mwm-lesson-students' || !Array.isArray(data.students)) {
    alert('That file is not a lesson pages backup.');
    return;
  }
  const str = (x) => String(x ?? '');
  const id = (x) => (typeof x === 'string' && x ? x : newId());
  const cleanItem = (it) => ({
    id: id(it.id), title: str(it.title), detail: str(it.detail), link: str(it.link),
    piece: typeof it.piece === 'string' ? it.piece : null,
    setup: cleanSetup(it.setup), deck: cleanDeck(it.deck, { studio: true }), shelf: !!it.shelf,
  });
  for (const p of Array.isArray(data.pieces) ? data.pieces : []) {
    if (!p || typeof p.id !== 'string' || typeof p.xml !== 'string' || await pieces.get(p.id)) continue;
    try { pieceInfo(p.xml); } catch { continue; }
    await pieces.put({ id: p.id, name: str(p.name), title: str(p.title), xml: p.xml, parts: Array.isArray(p.parts) ? p.parts.map(str) : [], measures: Number(p.measures) || 0, created: Number(p.created) || Date.now() });
  }
  for (const e of Array.isArray(data.library) ? data.library : []) {
    if (!e || typeof e.id !== 'string' || !e.item || await library.get(e.id)) continue;
    await library.put({ id: e.id, created: Number(e.created) || Date.now(), item: cleanItem(e.item) });
  }
  for (const s of data.students) {
    if (!s || typeof s.id !== 'string' || !Array.isArray(s.lessons)) continue;
    const here = await students.get(s.id);
    if (here && here.updated >= s.updated) continue;
    await students.put({
      id: s.id, name: str(s.name), instrument: str(s.instrument), code: str(s.code).split('-').slice(0, 5).map((w) => (PICKS.some(([x]) => x === w) ? w : '')).join('-'), pubSecret: str(s.pubSecret), published: Number(s.published) || 0,
      day: s.day === '' || s.day == null ? '' : Math.max(0, Math.min(6, Number(s.day) || 0)), time: /^\d\d:\d\d$/.test(s.time) ? s.time : '',
      created: Number(s.created) || Date.now(), updated: Number(s.updated) || Date.now(),
      lessons: s.lessons.map((l) => ({
        id: id(l.id), date: str(l.date), note: str(l.note), private: str(l.private),
        stars: [0, 1, 2, 3].includes(l.stars) ? l.stars : 0,
        minutes: Number(l.minutes) > 0 ? Math.round(Number(l.minutes)) : '',
        items: (Array.isArray(l.items) ? l.items : []).map(cleanItem),
      })),
    });
  }
  showList();
}

/* ---------- Pieces ---------- */

async function addPieceFile(file) {
  const xml = slimXML(await readPieceFile(file));
  const info = pieceInfo(xml);
  const p = { id: newId(), name: file.name.replace(/\.(mxl|musicxml|xml)$/i, ''), title: info.title, xml, parts: info.parts, measures: info.measures, created: Date.now() };
  await pieces.put(p);
  return p;
}

const pieceName = (p) => p.title || p.name || 'Piece';
const composer = (p) => (p.composer ??= (/<creator[^>]*type="composer"[^>]*>([^<]*)</.exec(p.xml)?.[1] || '').trim());
const lastName = (p) => composer(p).split(/\s+/).pop() || '\uffff';

/* How piece lists are sorted; remembered on this device. */
const SORTS = [
  ['name', 'A–Z', (a, b) => pieceName(a).localeCompare(pieceName(b))],
  ['composer', 'Composer', (a, b) => lastName(a).localeCompare(lastName(b)) || pieceName(a).localeCompare(pieceName(b))],
  ['new', 'Newest', (a, b) => (b.created || 0) - (a.created || 0)],
  ['old', 'Oldest', (a, b) => (a.created || 0) - (b.created || 0)],
  ['bars', 'Length', (a, b) => (a.measures || 0) - (b.measures || 0) || pieceName(a).localeCompare(pieceName(b))],
];
let pieceSort = 'name';
try { pieceSort = localStorage.getItem('lessons.pieceSort') || 'name'; } catch { /* private window */ }
const sortPieces = (list) => list.sort((SORTS.find(([k]) => k === pieceSort) || SORTS[0])[2]);
function sortSelect(then) {
  return h('select', { class: 'sort', 'aria-label': 'Sort', onchange: (e) => {
    pieceSort = e.target.value;
    try { localStorage.setItem('lessons.pieceSort', pieceSort); } catch { /* private window */ }
    then();
  } }, SORTS.map(([k, label]) => h('option', { value: k, selected: k === pieceSort }, label)));
}
const pieceSmall = (p) => [composer(p), p.parts.filter(Boolean).join(', '), p.measures && `${p.measures} bars`].filter(Boolean).join(' · ');

/* Pick a piece already here, or add a file. Resolves with a piece or null. */
function choosePiece() {
  return new Promise(async (resolve) => {
    const dlg = h('dialog', { class: 'pickdlg' });
    document.body.append(dlg);
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    const file = h('input', { type: 'file', accept: '.mxl,.musicxml,.xml', hidden: true, onchange: async () => {
      try { done(await addPieceFile(file.files[0])); } catch { alert('That file is not a MusicXML score.'); }
    } });
    const all = await pieces.all();
    const filter = h('input', { type: 'search', placeholder: 'Search', class: 'search', oninput: () => fill() });
    const list = h('ul', { class: 'sheets' });
    const fill = () => {
      const q = filter.value.trim().toLowerCase();
      list.replaceChildren(...sortPieces(all.filter((p) => !q || `${pieceName(p)} ${p.name} ${composer(p)}`.toLowerCase().includes(q))).map((p) =>
        h('li', {}, h('a', { href: '#', onclick: (e) => { e.preventDefault(); done(p); } }, h('span', {}, pieceName(p)), h('small', {}, pieceSmall(p))))));
    };
    fill();
    dlg.append(
      h('div', { class: 'bar' }, h('button', { class: 'primary', onclick: () => file.click() }, 'Add MusicXML file'), file, h('span', { class: 'grow' }), h('button', { onclick: () => done(null) }, 'Cancel')),
      h('div', { class: 'bar' }, filter, sortSelect(fill)),
      list,
    );
    dlg.showModal();
  });
}

/* ---------- The practice library ---------- */

function chooseFromLibrary() {
  return new Promise(async (resolve) => {
    const dlg = h('dialog', { class: 'pickdlg' });
    document.body.append(dlg);
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    const all = (await library.all()).sort((a, b) => a.item.title.localeCompare(b.item.title));
    const pieceMap = Object.fromEntries((await pieces.all()).map((p) => [p.id, p]));
    const filter = h('input', { type: 'search', placeholder: 'Search', class: 'search', oninput: () => fill() });
    const list = h('ul', { class: 'sheets' });
    const fill = () => {
      const q = filter.value.trim().toLowerCase();
      list.replaceChildren(...all.filter((e) => !q || `${e.item.title} ${e.item.detail}`.toLowerCase().includes(q)).map((e) =>
        h('li', {}, h('a', { href: '#', onclick: (ev) => { ev.preventDefault(); done(e.item); } },
          h('span', {}, e.item.title || '—'), h('small', {}, itemBadges(e.item, pieceMap))))));
    };
    fill();
    dlg.append(h('div', { class: 'bar' }, filter, h('span', { class: 'grow' }), h('button', { onclick: () => done(null) }, 'Cancel')), list);
    dlg.showModal();
    filter.focus();
  });
}

function itemBadges(it, pieceMap) {
  return [it.piece && `🎼 ${pieceMap[it.piece] ? pieceName(pieceMap[it.piece]) : ''}`, it.deck && `🃏 ${deckSummary(it.deck)}`, it.detail].filter(Boolean).join(' · ');
}

async function showLibrary() {
  document.title = 'Library · Lesson pages';
  const all = (await library.all()).sort((a, b) => a.item.title.localeCompare(b.item.title));
  const allPieces = await pieces.all();
  const pieceMap = Object.fromEntries(allPieces.map((p) => [p.id, p]));
  const used = new Set();
  for (const s of await students.all()) for (const l of s.lessons) for (const it of l.items) if (it.piece) used.add(it.piece);
  for (const e of all) if (e.item.piece) used.add(e.item.piece);
  const file = h('input', { type: 'file', accept: '.mxl,.musicxml,.xml', multiple: true, hidden: true, onchange: async () => {
    for (const f of file.files) { try { await addPieceFile(f); } catch { alert(`${f.name} is not a MusicXML score.`); } }
    showLibrary();
  } });
  const pieceSearch = h('input', { type: 'search', placeholder: 'Search', class: 'search', oninput: () => fillPieces() });
  const pieceList = h('ul', { class: 'sheets lib' });
  function fillPieces() {
    const q = pieceSearch.value.trim().toLowerCase();
    pieceList.replaceChildren(...sortPieces(allPieces.filter((p) => !q || `${pieceName(p)} ${p.name} ${composer(p)}`.toLowerCase().includes(q))).map((p) => h('li', {},
      h('div', { class: 'libitem' },
        h('input', { class: 'item-title', value: pieceName(p), 'aria-label': 'Piece name', onchange: (ev) => { p.title = ev.target.value; pieces.put(p); } }),
        h('small', {}, [pieceSmall(p), `${Math.round(p.xml.length / 1024)} KB`].filter(Boolean).join(' · ')),
        h('button', { class: 'icon', title: 'Play', onclick: () => openPlayer(document.body, { xml: p.xml, title: pieceName(p) }) }, '▶'),
        used.has(p.id) ? null : confirmButton('×', 'Remove?', async () => { await pieces.delete(p.id); showLibrary(); })))));
  }
  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '#/' }, '‹ Lesson pages')),
    h('div', { class: 'bar' }, h('h1', { class: 'grow' }, 'Library'),
      h('button', { onclick: async () => { const it = newItem(); const d = await editDeck(newDeck('n')); if (!d) return; it.deck = d; it.title = deckTitle(d); await library.put({ id: newId(), created: Date.now(), item: it }); showLibrary(); } }, 'New deck')),
    h('ul', { class: 'sheets lib' }, all.map((e) => h('li', {},
      h('div', { class: 'libitem' },
        h('input', { class: 'item-title', value: e.item.title, 'aria-label': 'Title', placeholder: 'Practice', onchange: (ev) => { e.item.title = ev.target.value; library.put(e); } }),
        h('small', {}, itemBadges(e.item, pieceMap)),
        e.item.deck && h('button', { class: 'icon', title: 'Edit deck', onclick: async () => { const d = await editDeck(e.item.deck, e.item.title); if (d) { e.item.deck = d; await library.put(e); showLibrary(); } } }, '🃏'),
        confirmButton('×', 'Remove?', async () => { await library.delete(e.id); showLibrary(); }))))),
    h('h2', {}, 'Pieces'),
    h('div', { class: 'bar' }, h('button', { onclick: () => file.click() }, 'Add MusicXML files'), file, h('span', { class: 'grow' }), pieceSearch, sortSelect(fillPieces)),
    pieceList,
  );
  fillPieces();
}

/* ---------- One student ---------- */

let student = null;
let saveTimer = null;

function save() {
  student.updated = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; students.put(student); }, 300);
}

function flush() {
  if (!saveTimer) return Promise.resolve();
  clearTimeout(saveTimer);
  saveTimer = null;
  return students.put(student);
}

const hasContent = (it) => it.title.trim() || it.detail.trim() || it.link.trim() || it.piece || it.deck;

async function pageFor(s, lesson) {
  const xmls = [];
  const index = {};
  const items = [];
  for (const it of lesson.items.filter(hasContent)) {
    const out = { a: it.title.trim() };
    if (it.detail.trim()) out.b = it.detail.trim();
    const link = safeLink(it.link);
    if (link) out.l = link;
    if (it.piece) {
      if (!(it.piece in index)) {
        const p = await pieces.get(it.piece);
        index[it.piece] = p ? xmls.push(p.xml) - 1 : -1;
      }
      if (index[it.piece] >= 0) {
        out.p = index[it.piece];
        const u = cleanSetup(it.setup);
        if (Object.keys(u).length) out.u = u;
      }
    }
    const deck = cleanDeck(it.deck);
    if (deck) out.c = deck;
    items.push(out);
  }
  const page = { v: 2, n: s.name.trim(), i: s.instrument.trim(), d: lesson.date, t: items };
  const next = nextLesson(s, lesson.date);
  if (next) page.x = next;
  if (lesson.note.trim()) page.m = lesson.note.trim();
  if (xmls.length) page.p = xmls;
  return page;
}

const linkPart = async (s, lesson) => encodeLesson(await pageFor(s, lesson));

function textarea(obj, key, props) {
  const ta = h('textarea', { rows: 1, value: obj[key], ...props, oninput: () => { obj[key] = ta.value; grow(ta); save(); } });
  requestAnimationFrame(() => grow(ta));
  return ta;
}

function input(obj, key, props, after) {
  const el = h('input', { value: obj[key], ...props, oninput: () => { obj[key] = el.value; save(); if (after) after(); } });
  return el;
}

async function showStudent(id, lessonId) {
  student = await students.get(id);
  if (!student) { location.hash = '#/'; return; }
  upgrade(student);
  const lesson = student.lessons.find((l) => l.id === lessonId) || student.lessons[student.lessons.length - 1];
  const setTitle = () => { document.title = `${student.name || 'New student'} · Lesson pages`; };
  setTitle();
  const pieceMap = Object.fromEntries((await pieces.all()).map((p) => [p.id, p]));
  // Keyboard tools (lit keyboard, keyboard answers) are for piano students.
  const playsKeys = () => !/guitar/i.test(student.instrument);

  const items = h('ol', { class: 'items' });

  /* What an item gives the student: one piece or one deck. */
  function attachments(item) {
    const p = item.piece && pieceMap[item.piece];
    if (p) return pieceBox(item, p);
    if (item.deck) {
      return h('div', { class: 'attach' }, h('span', { class: 'chip' }, '🃏 ', deckSummary(item.deck),
        h('button', { class: 'icon', title: 'Edit deck', onclick: async () => { const d = await editDeck(item.deck, item.title, { keys: playsKeys() }); if (d) { item.deck = d; save(); renderItems(); } } }, '✎'),
        h('button', { class: 'icon', title: 'Try', onclick: () => openPractice(document.body, item.deck, { title: item.deck.nm || item.title }) }, '▶'),
        h('button', { class: 'icon', title: 'Remove deck', onclick: () => { item.deck = null; save(); renderItems(); } }, '×')));
    }
    return h('div', { class: 'attach' },
      h('button', { class: 'add', title: 'Add a piece', onclick: async () => {
        const chosen = await choosePiece();
        if (!chosen) return;
        pieceMap[chosen.id] = chosen;
        item.piece = chosen.id;
        item.setup = { v: playsKeys() ? 15 : 3, sp: [50, 100] };
        if (!item.title.trim()) item.title = pieceName(chosen);
        save();
        renderItems();
      } }, '🎼'),
      h('button', { class: 'add', title: 'Add flash cards', onclick: async () => {
        const d = await editDeck(newDeck('n'), item.title, { keys: playsKeys() });
        if (!d) return;
        item.deck = d;
        if (!item.title.trim()) item.title = deckTitle(d);
        save();
        renderItems();
      } }, '🃏'));
  }

  /* A piece, and what the student's page offers for it. */
  function pieceBox(item, p) {
    const u = item.setup ||= {};
    u.v ??= 3;
    u.sp ??= [50, 100];
    delete u.iso;
    const changed = () => { save(); };
    const player = (mode) => openPlayer(document.body, {
      xml: p.xml, title: item.title || pieceName(p), setup: cleanSetup(u), mode,
      ...(mode === 'teach' ? { onSave: (next) => { item.setup = { ...next, v: u.v, sp: u.sp }; save(); renderItems(); } } : {}),
    });
    const num = (value, set, props) => h('input', { type: 'number', class: 'num', value: value ?? '', ...props, onchange: (e) => { set(e.target.value === '' ? null : Math.round(+e.target.value)); changed(); } });
    const [lo, hi] = u.sp;
    const modes = PIECE_MODES.filter(([bit]) => playsKeys() || !(bit & KEYBOARD_MODES));
    return h('div', { class: 'attach piecebox' },
      h('span', { class: 'chip' }, '🎼 ', pieceName(p),
        h('button', { class: 'icon', title: 'Setup: playback, sections, names and fingerings', onclick: () => player('teach') }, '⚙'),
        setupSummary(u) ? h('small', {}, setupSummary(u)) : null,
        h('button', { class: 'icon', title: 'Remove piece', onclick: () => { item.piece = null; item.setup = {}; save(); renderItems(); } }, '×')),
      h('div', { class: 'sview' }, h('h3', {}, 'Student view'),
        h('div', { class: 'row' }, modes.map(([bit, mode, icon, label]) => h('span', { class: 'smode' },
          h('label', { title: label }, h('input', { type: 'checkbox', checked: !!(u.v & bit), onchange: (e) => { u.v = e.target.checked ? u.v | bit : u.v & ~bit; changed(); } }), ` ${icon}`),
          h('button', { class: 'icon', title: `Try: ${label}`, onclick: () => player(mode) }, '▶')))),
        h('div', { class: 'row' }, '% ',
          num(lo, (v) => { u.sp = [Math.max(20, Math.min(200, v ?? 50)), u.sp[1]]; }, { 'aria-label': 'Slowest speed', min: 20, max: 200, step: 5 }), '–',
          num(hi, (v) => { u.sp = [u.sp[0], Math.max(20, Math.min(200, v ?? 100))]; }, { 'aria-label': 'Fastest speed', min: 20, max: 200, step: 5 }))));
  }

  function itemEl(item) {
    const move = (by) => {
      const i = lesson.items.indexOf(item);
      const j = i + by;
      if (j < 0 || j >= lesson.items.length) return;
      lesson.items.splice(i, 1);
      lesson.items.splice(j, 0, item);
      save();
      renderItems();
    };
    const remove = () => {
      lesson.items.splice(lesson.items.indexOf(item), 1);
      if (!lesson.items.length) lesson.items.push(newItem());
      save();
      renderItems();
    };
    // In the student's own library (on their page, beside their lessons).
    const shelfBtn = h('button', { class: 'icon shelf', title: 'In their library', 'aria-pressed': String(!!item.shelf), onclick: () => {
      item.shelf = !item.shelf;
      shelfBtn.setAttribute('aria-pressed', String(item.shelf));
      save();
    } }, '📚');
    const star = h('button', { class: 'icon', title: 'Save to library', onclick: async () => {
      await library.put({ id: newId(), created: Date.now(), item: { ...copyItem(item), shelf: false } });
      star.textContent = '★';
      setTimeout(() => { star.textContent = '☆'; }, 1200);
    } }, '☆');
    return h('li', { dataset: { id: item.id } },
      h('div', { class: 'fields' },
        input(item, 'title', { class: 'item-title', placeholder: 'Practice', 'aria-label': 'Practice' }),
        textarea(item, 'detail', { placeholder: 'Details', 'aria-label': 'Details' }),
        input(item, 'link', { class: 'item-link', placeholder: 'Link', type: 'url', 'aria-label': 'Link' }),
        attachments(item),
      ),
      h('div', { class: 'tools' },
        h('button', { class: 'icon', title: 'Move up', onclick: () => move(-1) }, '↑'),
        h('button', { class: 'icon', title: 'Move down', onclick: () => move(1) }, '↓'),
        shelfBtn,
        star,
        h('button', { class: 'icon', title: 'Remove', onclick: remove }, '×'),
      ),
    );
  }

  function renderItems(focusId) {
    items.replaceChildren(...lesson.items.map(itemEl));
    if (focusId) items.querySelector(`[data-id="${focusId}"] .item-title`).focus();
  }

  const copy = h('button', { class: 'primary', onclick: async () => {
    await flush();
    await navigator.clipboard.writeText(`${LESSON_PAGE}#${await linkPart(student, lesson)}`);
    copy.textContent = 'Copied';
    setTimeout(() => { copy.textContent = 'Copy link'; }, 1500);
  } }, 'Copy link');

  const chipLabel = (l) => formatDate(l.date).replace(/^\w+, /, '') || 'No date';
  const chips = h('nav', { class: 'chips' }, [...student.lessons].reverse().map((l) =>
    h('a', { href: `#/${student.id}/${l.id}`, 'aria-current': l === lesson ? 'true' : null }, chipLabel(l)),
  ));

  // The instrument decides which tools a student's items offer. Guitar is still to come.
  const instrumentSel = h('select', { 'aria-label': 'Instrument', onchange: () => { student.instrument = instrumentSel.value; save(); renderItems(); } },
    h('option', { value: '', selected: !student.instrument }, 'Instrument'),
    [...new Set([...INSTRUMENTS, student.instrument].filter(Boolean))].map((x) => h('option', { value: x, selected: x === student.instrument }, x)));
  const daySel = h('select', { 'aria-label': 'Lesson day', onchange: () => { student.day = daySel.value === '' ? '' : +daySel.value; save(); } },
    h('option', { value: '', selected: student.day === '' }, 'Day'),
    DAYS.map((d, i) => h('option', { value: i, selected: String(student.day) === String(i) }, d)));

  /* How the student signs in (first name and five emojis), and their locked pages on the site */
  function codeBar() {
    const bar = h('div', { class: 'bar codebar' });
    const status = h('small', {});
    const secret = () => secretFor(student.name, student.code);
    const live = () => student.pubSecret && student.pubSecret === secret();
    const showStatus = () => { status.textContent = live() && student.published ? `✓ ${new Date(student.published).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''; };
    const picks = [...PICKS].sort((x, y) => x[0].localeCompare(y[0]));
    const draw = () => {
      showStatus();
      const parts = (student.code || '').split('-');
      const lists = [0, 1, 2, 3, 4].map((i) => h('select', { class: 'codepick', 'aria-label': `Emoji ${i + 1}`, onchange: () => {
        student.code = lists.map((x) => x.value).join('-');
        save();
        pub.disabled = API == null || !secret();
        showStatus();
      } },
      h('option', { value: '' }, '—'),
      picks.map(([w, e]) => h('option', { value: w, selected: parts[i] === w }, `${e} ${w}`))));
      const pub = h('button', { class: 'primary', disabled: API == null || !secret(), onclick: async () => {
        pub.disabled = true;
        pub.textContent = '…';
        try {
          await flush();
          const next = secret();
          await publish(next, await pagesFor(student));
          // A changed name or emojis: the old sign-in stops working.
          const old = student.pubSecret || (student.published && cleanCode(student.code)) || '';
          if (old && old !== next) await unpublish(old).catch(() => {});
          student.pubSecret = next;
          student.published = Date.now();
          save();
        } catch (err) {
          pub.textContent = `✗ ${err.message}`;
          pub.disabled = false;
          return;
        }
        draw();
      } }, 'Publish');
      bar.replaceChildren(
        h('span', { class: 'lock' }, '🔑'),
        h('div', { class: 'picks' }, lists),
        h('button', { class: 'icon', title: 'Pick for me', onclick: () => { student.code = newCode(); save(); draw(); } }, '🎲'),
        pub, status,
        h('button', { disabled: API == null || !student.pubSecret, onclick: () => showResults(student) }, 'Practice'));
    };
    draw();
    // Renaming the student changes how they sign in: the tick goes until the next Publish.
    bar.refresh = () => { bar.querySelector('button.primary')?.toggleAttribute('disabled', API == null || !secret()); showStatus(); };
    return bar;
  }

  const codes = codeBar();
  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '#/' }, '‹ Lesson pages')),
    h('div', { class: 'who' },
      input(student, 'name', { class: 'title', placeholder: 'First name', 'aria-label': 'First name', autocomplete: 'off' }, () => { setTitle(); codes.refresh(); }),
      instrumentSel,
      daySel,
      input(student, 'time', { type: 'time', class: 'time', 'aria-label': 'Lesson time' }),
      confirmButton('Remove student', 'Remove for good?', async () => {
        clearTimeout(saveTimer);
        saveTimer = null;
        if (student.pubSecret) await unpublish(student.pubSecret).catch(() => {});
        await students.delete(student.id);
        student = null;
        location.hash = '#/';
      }),
    ),
    codes,
    h('div', { class: 'bar' },
      chips,
      h('span', { class: 'grow' }),
      h('button', { onclick: async () => {
        // A new lesson starts from the last one's practice list.
        const last = student.lessons[student.lessons.length - 1];
        const fresh = newLesson(last.items.map(copyItem));
        student.lessons.push(fresh);
        save();
        await flush();
        location.hash = `#/${student.id}/${fresh.id}`;
      } }, 'New lesson'),
    ),
    h('div', { class: 'bar' },
      input(lesson, 'date', { class: 'date', type: 'date', 'aria-label': 'Lesson date' },
        () => { chips.querySelector('[aria-current]').textContent = chipLabel(lesson); }),
    ),
    items,
    h('div', { class: 'bar' },
      h('button', { onclick: () => { const it = newItem(); lesson.items.push(it); save(); renderItems(it.id); } }, 'Add'),
      h('button', { onclick: async () => {
        const it = await chooseFromLibrary();
        if (!it) return;
        const fresh = copyItem(it);
        const blank = lesson.items.length === 1 && !hasContent(lesson.items[0]);
        if (blank) lesson.items[0] = fresh; else lesson.items.push(fresh);
        Object.assign(pieceMap, Object.fromEntries((await pieces.all()).map((p) => [p.id, p])));
        save();
        renderItems();
      } }, 'From library'),
    ),
    textarea(lesson, 'note', { class: 'notebox', placeholder: 'Note', 'aria-label': 'Note' }),
    textarea(lesson, 'private', { class: 'notebox private', placeholder: '🔒 Private notes', 'aria-label': 'Private notes' }),
    h('div', { class: 'bar actions' },
      copy,
      h('button', { onclick: async () => { await flush(); window.open(`${LOCAL_PAGE}#${await linkPart(student, lesson)}`, '_blank', 'noopener'); } }, 'Open page'),
      h('span', { class: 'grow' }),
      student.lessons.length > 1 && confirmButton('Delete lesson', 'Delete for good?', async () => {
        student.lessons.splice(student.lessons.indexOf(lesson), 1);
        save();
        await flush();
        location.hash = `#/${student.id}`;
      }),
    ),
  );
  renderItems();
}

/* The next lesson after a date: the student's lesson day in the week after it (a week on
   when no day is set). */
function nextLesson(s, date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return '';
  const d = new Date(+m[1], m[2] - 1, +m[3]);
  let add = 7;
  if (s.day !== '' && s.day != null) add = ((Number(s.day) - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + add);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* Everything a student's code opens: their last 20 lessons, newest first, sharing pieces. */
async function pagesFor(s) {
  const pool = [];
  const lessons = [];
  const recent = [...s.lessons].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  for (const lesson of recent) {
    const page = await pageFor(s, lesson);
    const mine = (page.p || []).map((xml) => { const i = pool.indexOf(xml); return i >= 0 ? i : pool.push(xml) - 1; });
    for (const it of page.t) if (it.p !== undefined) it.p = mine[it.p];
    lessons.push({ d: page.d, ...(page.x ? { x: page.x } : {}), t: page.t, ...(page.m ? { m: page.m } : {}), ...(page.s ? { s: page.s } : {}), ...(page.w ? { w: page.w } : {}) });
  }
  // Their library: every item marked for it, from any lesson, newest first, once each.
  const seen = new Set();
  const kept = [];
  for (const lesson of [...s.lessons].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const it of lesson.items) {
      if (!it.shelf || !hasContent(it)) continue;
      const k = JSON.stringify([it.title.trim(), it.piece, it.deck, it.link.trim()]);
      if (seen.has(k)) continue;
      seen.add(k);
      kept.push(it);
    }
  }
  const shelf = await pageFor(s, { items: kept, date: '', note: '' });
  const mine = (shelf.p || []).map((xml) => { const i = pool.indexOf(xml); return i >= 0 ? i : pool.push(xml) - 1; });
  for (const it of shelf.t) if (it.p !== undefined) it.p = mine[it.p];
  return { v: 1, n: s.name.trim(), i: s.instrument.trim(), l: lessons, p: pool, ...(shelf.t.length ? { b: shelf.t } : {}) };
}

/* What a student did with their pages, from the notes their page sends back (encrypted):
   each lesson's week (days opened, minutes, plays of each piece, cards of each deck),
   then the cards each deck's sessions missed most. */
async function showResults(s) {
  const dlg = h('dialog', { class: 'pickdlg results' });
  document.body.append(dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.append(h('p', {}, '…'));
  dlg.showModal();
  let list;
  try { list = await results(s.pubSecret); } catch (err) { dlg.replaceChildren(h('p', {}, `✗ ${err.message}`), h('button', { onclick: close }, 'Close')); return; }
  const weeks = new Map();
  const decks = new Map();
  const week = (d) => {
    if (!weeks.has(d)) weeks.set(d, { d, days: new Set(), secs: 0, pieces: new Map(), decks: new Map() });
    return weeks.get(d);
  };
  for (const r of list) {
    const w = week(r.d || '');
    const day = r.t ? new Date(r.t).toDateString() : r.at;
    if (day) w.days.add(day);
    if (r.y === 'p') {
      const p = w.pieces.get(r.a) || { opens: 0, plays: 0, secs: 0, modes: {} };
      p.opens++;
      p.plays += r.plays || 0;
      p.secs += r.secs || 0;
      p.modes[r.mode] = (p.modes[r.mode] || 0) + 1;
      w.pieces.set(r.a, p);
      w.secs += r.secs || 0;
    } else if (r.y !== 'v') {
      const c = w.decks.get(r.a) || { sessions: 0, n: 0, ok: 0 };
      c.sessions++;
      c.n += r.n || 0;
      c.ok += r.ok || 0;
      w.decks.set(r.a, c);
      w.secs += (r.ms || 0) / 1000;
      const name = r.a || KINDS[r.k] || '';
      const d = decks.get(name) || { name, k: r.k, cards: {} };
      for (const [card, [tries, right]] of Object.entries(r.items || {})) {
        const x = (d.cards[card] ||= [0, 0]);
        x[0] += tries;
        x[1] += right;
      }
      decks.set(name, d);
    }
  }
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
  const icons = Object.fromEntries(PIECE_MODES.map(([, mode, icon]) => [mode, icon]));
  const weekEls = [...weeks.values()].sort((a, b) => b.d.localeCompare(a.d)).map((w) => h('section', { class: 'rweek' },
    h('h3', {}, formatDate(w.d) || '—', h("small", {}, ` · opened ${w.days.size} ${w.days.size === 1 ? "day" : "days"} · ⏱ ${Math.round(w.secs / 60)} min`)),
    h('ul', { class: 'rlist' },
      [...w.pieces].map(([name, p]) => h('li', {}, h('span', {}, '🎼 ', name),
        h('small', {}, `${Object.entries(p.modes).map(([m, n]) => `${icons[m] || m} ${n}`).join('  ')} · 🎵 ${p.plays} · ${Math.round(p.secs / 60)} min`))),
      [...w.decks].map(([name, c]) => h('li', {}, h('span', {}, '🃏 ', name),
        h('small', {}, `${c.sessions} × · ${c.n} cards · ${pct(c.ok, c.n)}`))))));
  const weakEls = [...decks.values()].map((d) => {
    const weak = Object.entries(d.cards).filter(([, [t, r]]) => r < t).sort((a, b) => a[1][1] / a[1][0] - b[1][1] / b[1][0]).slice(0, 10);
    return weak.length ? h('section', { class: 'rdeck' }, h('h3', {}, d.name),
      h('ul', { class: 'weak' }, weak.map(([card, [t, r]]) => h('li', {}, h('span', {}, cardLabel({ k: d.k }, card)), h('small', {}, `${r}/${t}`))))) : null;
  }).filter(Boolean);
  dlg.replaceChildren(
    h('div', { class: 'bar' }, h('h2', { class: 'grow' }, s.name || 'Practice'), h('button', { onclick: close }, 'Close')),
    ...(list.length ? [] : [h('p', {}, '—')]),
    ...weekEls,
    ...(weakEls.length ? [h('h2', {}, 'Missed most'), ...weakEls] : []));
}

function setupSummary(u) {
  const out = [];
  if (u.s && u.s !== 100) out.push(`${u.s}%`);
  if (u.k) out.push(`${u.k > 0 ? '+' : ''}${u.k}`);
  if (u.m?.length) out.push('🔇');
  if (u.n) out.push(['', 'ABC', 'do re mi', 'fingers'][u.n]);
  if (u.sec?.length) out.push(u.sec.map((x) => x[0]).join(' '));
  if (u.c) out.push('🎨');
  return out.join(' · ');
}

const deckTitle = (d) => (d.k === 'n' ? 'Note cards' : d.u || (d.k === 't' ? 'Tonal patterns' : 'Rhythm patterns'));

/* ---------- Routing ---------- */

async function route() {
  if (student) { await flush(); student = null; }
  const [id, lessonId] = location.hash.replace(/^#\/?/, '').split('/');
  if (id === 'library') showLibrary();
  else if (id) showStudent(id, lessonId);
  else showList();
}

window.addEventListener('hashchange', route);
window.addEventListener('pagehide', () => { if (student) flush(); });
route();

/* Sync with the website (not in the offline copy). */
const SYNC_MARK = { syncing: ['☁', 'Syncing'], ok: ['☁✓', 'Synced'], offline: ['☁✗', 'Offline'], signin: ['☁?', 'Sign in again'], error: ['☁✗', 'Sync failed'] };
function syncMark() {
  const m = h('span', { class: 'syncmark' });
  const show = (s) => { const [t, title] = SYNC_MARK[s] || ['', '']; m.textContent = t; m.title = title; m.hidden = !t; };
  show(sync.getStatus());
  sync.onStatus((s) => { if (m.isConnected) show(s); });
  return m;
}
if (API != null) {
  // Records came down: show them, unless Kyle is in the middle of something.
  let stale = false;
  const busy = () => document.querySelector('dialog[open]') || document.body.classList.contains('playing-piece') ||
    (document.activeElement && document.activeElement !== document.body && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
  const refresh = () => { if (busy()) stale = true; else { stale = false; route(); } };
  sync.onPulled(refresh);
  document.addEventListener('focusout', () => { if (stale) setTimeout(refresh, 300); });
  sync.start();
}
