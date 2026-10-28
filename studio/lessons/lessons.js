/* Private lesson pages: one page per lesson for each private student.
   Students, pieces (MusicXML) and the practice library are kept on this
   device only (see ../db.js). A student gets their page as a link to
   /lesson/ with the page inside the link itself (see /lesson/codec.js),
   so no student information is stored online.
   #/ is the week, #/library the practice library, #/<student> and
   #/<student>/<lesson> one student. */

import { store, newId, downloadJSON, today } from '../db.js';
import { h, grow, confirmButton } from '../dom.js';
import { encodeLesson, safeLink, formatDate, cleanDeck, cleanSetup, STICKERS } from '/lesson/codec.js';
import { readPieceFile, slimXML, pieceInfo } from '/lesson/score.js';
import { openPlayer } from '/lesson/player.js';
import { openDeck } from '/lesson/games.js';
import { LESSON_PAGE, LOCAL_PAGE, STUDIO_HOME } from '/lesson/paths.js';
import { editDeck, deckSummary, newNotesDeck, newRhythmDeck } from './decks.js';

const students = store('students');
const pieces = store('pieces');
const library = store('library');
const app = document.getElementById('app');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STATUS = ['🌱', '✨', '🏆'];

const newItem = () => ({ id: newId(), title: '', detail: '', link: '', tempo: '', piece: null, setup: {}, deck: null });
const newLesson = (items = [newItem()]) => ({ id: newId(), date: today(), items, note: '', private: '', stars: 0, sticker: '', minutes: '' });
const copyItem = (it) => ({ ...newItem(), ...structuredClone(it), id: newId() });

/* Older records (before pieces and decks) get the new fields. */
function upgrade(s) {
  s.day ??= '';
  s.time ??= '';
  s.goals ??= [];
  for (const l of s.lessons) {
    l.private ??= '';
    l.stars ??= 0;
    l.sticker ??= '';
    l.minutes ??= '';
    l.items = l.items.map((it) => ({ ...newItem(), ...it }));
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
  const s = { id: newId(), name: '', instrument: '', day: '', time: '', goals: [], created: now, updated: now, lessons: [newLesson()] };
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
    tempo: Number(it.tempo) > 0 ? Math.round(Number(it.tempo)) : '', piece: typeof it.piece === 'string' ? it.piece : null,
    setup: cleanSetup(it.setup), deck: cleanDeck(it.deck),
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
      id: s.id, name: str(s.name), instrument: str(s.instrument),
      day: s.day === '' || s.day == null ? '' : Math.max(0, Math.min(6, Number(s.day) || 0)), time: /^\d\d:\d\d$/.test(s.time) ? s.time : '',
      goals: (Array.isArray(s.goals) ? s.goals : []).map((g) => ({ id: id(g.id), text: str(g.text), status: [0, 1, 2].includes(g.status) ? g.status : 0 })),
      created: Number(s.created) || Date.now(), updated: Number(s.updated) || Date.now(),
      lessons: s.lessons.map((l) => ({
        id: id(l.id), date: str(l.date), note: str(l.note), private: str(l.private),
        stars: [0, 1, 2, 3].includes(l.stars) ? l.stars : 0, sticker: STICKERS.includes(l.sticker) ? l.sticker : '',
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
    const all = (await pieces.all()).sort((a, b) => pieceName(a).localeCompare(pieceName(b)));
    dlg.append(
      h('div', { class: 'bar' }, h('button', { class: 'primary', onclick: () => file.click() }, 'Add MusicXML file'), file, h('span', { class: 'grow' }), h('button', { onclick: () => done(null) }, 'Cancel')),
      h('ul', { class: 'sheets' }, all.map((p) => h('li', {}, h('a', { href: '#', onclick: (e) => { e.preventDefault(); done(p); } },
        h('span', {}, pieceName(p)), h('small', {}, [p.parts.filter(Boolean).join(', '), p.measures && `${p.measures} bars`].filter(Boolean).join(' · ')))))),
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
  return [it.piece && `🎼 ${pieceMap[it.piece] ? pieceName(pieceMap[it.piece]) : ''}`, it.deck && `🃏 ${deckSummary(it.deck)}`, it.tempo && `♩ ${it.tempo}`, it.detail].filter(Boolean).join(' · ');
}

async function showLibrary() {
  document.title = 'Library · Lesson pages';
  const all = (await library.all()).sort((a, b) => a.item.title.localeCompare(b.item.title));
  const allPieces = (await pieces.all()).sort((a, b) => pieceName(a).localeCompare(pieceName(b)));
  const pieceMap = Object.fromEntries(allPieces.map((p) => [p.id, p]));
  const used = new Set();
  for (const s of await students.all()) for (const l of s.lessons) for (const it of l.items) if (it.piece) used.add(it.piece);
  for (const e of all) if (e.item.piece) used.add(e.item.piece);
  const file = h('input', { type: 'file', accept: '.mxl,.musicxml,.xml', multiple: true, hidden: true, onchange: async () => {
    for (const f of file.files) { try { await addPieceFile(f); } catch { alert(`${f.name} is not a MusicXML score.`); } }
    showLibrary();
  } });
  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '#/' }, '‹ Lesson pages')),
    h('div', { class: 'bar' }, h('h1', { class: 'grow' }, 'Library'),
      h('button', { onclick: async () => { const it = newItem(); it.deck = newNotesDeck(); const d = await editDeck(it.deck); if (!d) return; it.deck = d; it.title = d.k === 'n' ? 'Note cards' : 'Rhythm cards'; await library.put({ id: newId(), created: Date.now(), item: it }); showLibrary(); } }, 'New deck')),
    h('ul', { class: 'sheets lib' }, all.map((e) => h('li', {},
      h('div', { class: 'libitem' },
        h('input', { class: 'item-title', value: e.item.title, 'aria-label': 'Title', placeholder: 'Practice', onchange: (ev) => { e.item.title = ev.target.value; library.put(e); } }),
        h('small', {}, itemBadges(e.item, pieceMap)),
        e.item.deck && h('button', { class: 'icon', title: 'Edit deck', onclick: async () => { const d = await editDeck(e.item.deck, e.item.title); if (d) { e.item.deck = d; await library.put(e); showLibrary(); } } }, '🃏'),
        confirmButton('×', 'Remove?', async () => { await library.delete(e.id); showLibrary(); }))))),
    h('h2', {}, 'Pieces'),
    h('div', { class: 'bar' }, h('button', { onclick: () => file.click() }, 'Add MusicXML files'), file),
    h('ul', { class: 'sheets lib' }, allPieces.map((p) => h('li', {},
      h('div', { class: 'libitem' },
        h('input', { class: 'item-title', value: pieceName(p), 'aria-label': 'Piece name', onchange: (ev) => { p.title = ev.target.value; pieces.put(p); } }),
        h('small', {}, [p.parts.filter(Boolean).join(', '), p.measures && `${p.measures} bars`, `${Math.round(p.xml.length / 1024)} KB`].filter(Boolean).join(' · ')),
        h('button', { class: 'icon', title: 'Play', onclick: () => openPlayer(document.body, { xml: p.xml, title: pieceName(p) }) }, '▶'),
        used.has(p.id) ? null : confirmButton('×', 'Remove?', async () => { await pieces.delete(p.id); showLibrary(); }))))),
  );
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
    if (Number(it.tempo) > 0) out.q = Math.round(Number(it.tempo));
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
  if (lesson.note.trim()) page.m = lesson.note.trim();
  if (lesson.stars) page.s = lesson.stars;
  if (lesson.sticker) page.k = lesson.sticker;
  if (Number(lesson.minutes) > 0) page.w = Math.round(Number(lesson.minutes));
  const goals = s.goals.filter((g) => g.text.trim()).map((g) => [g.text.trim(), g.status]);
  if (goals.length) page.g = goals;
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

function chooseSticker(current) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'stickerdlg' });
    document.body.append(dlg);
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(current); });
    dlg.append(h('div', { class: 'stickers' },
      h('button', { onclick: () => done('') }, '∅'),
      STICKERS.map((s) => h('button', { 'aria-pressed': String(s === current), onclick: () => done(s) }, s))));
    dlg.showModal();
  });
}

async function showStudent(id, lessonId) {
  student = await students.get(id);
  if (!student) { location.hash = '#/'; return; }
  upgrade(student);
  const lesson = student.lessons.find((l) => l.id === lessonId) || student.lessons[student.lessons.length - 1];
  const setTitle = () => { document.title = `${student.name || 'New student'} · Lesson pages`; };
  setTitle();
  const pieceMap = Object.fromEntries((await pieces.all()).map((p) => [p.id, p]));

  const items = h('ol', { class: 'items' });

  function attachments(item) {
    const row = h('div', { class: 'attach' });
    const p = item.piece && pieceMap[item.piece];
    if (p) {
      row.append(h('span', { class: 'chip' }, '🎼 ', pieceName(p),
        h('button', { class: 'icon', title: 'Set up', onclick: () => openPlayer(document.body, {
          xml: p.xml, title: item.title || pieceName(p), setup: item.setup,
          onSave: (u) => { item.setup = u; save(); renderItems(); },
        }) }, '⚙'),
        Object.keys(item.setup || {}).length ? h('small', {}, setupSummary(item.setup)) : null,
        h('button', { class: 'icon', title: 'Remove piece', onclick: () => { item.piece = null; item.setup = {}; save(); renderItems(); } }, '×')));
    } else {
      row.append(h('button', { class: 'add', title: 'Add a piece', onclick: async () => {
        const chosen = await choosePiece();
        if (!chosen) return;
        pieceMap[chosen.id] = chosen;
        item.piece = chosen.id;
        item.setup = {};
        if (!item.title.trim()) item.title = pieceName(chosen);
        save();
        renderItems();
      } }, '🎼'));
    }
    if (item.deck) {
      row.append(h('span', { class: 'chip' }, '🃏 ', deckSummary(item.deck),
        h('button', { class: 'icon', title: 'Edit deck', onclick: async () => { const d = await editDeck(item.deck, item.title); if (d) { item.deck = d; save(); renderItems(); } } }, '✎'),
        h('button', { class: 'icon', title: 'Try', onclick: () => openDeck(document.body, item.deck, { title: item.title }) }, '▶'),
        h('button', { class: 'icon', title: 'Remove deck', onclick: () => { item.deck = null; save(); renderItems(); } }, '×')));
    } else {
      row.append(h('button', { class: 'add', title: 'Add note cards', onclick: async () => {
        const d = await editDeck(newNotesDeck(), item.title);
        if (!d) return;
        item.deck = d;
        if (!item.title.trim()) item.title = d.k === 'n' ? 'Note cards' : 'Rhythm cards';
        save();
        renderItems();
      } }, '🃏'), h('button', { class: 'add', title: 'Add rhythm cards', onclick: async () => {
        const d = await editDeck(newRhythmDeck(), item.title);
        if (!d) return;
        item.deck = d;
        if (!item.title.trim()) item.title = d.k === 'n' ? 'Note cards' : 'Rhythm cards';
        save();
        renderItems();
      } }, '🥁'));
    }
    row.append(h('label', { class: 'tempo' }, '♩ ', input(item, 'tempo', { type: 'number', min: 20, max: 300, placeholder: '—', 'aria-label': 'Tempo' })));
    return row;
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
    const star = h('button', { class: 'icon', title: 'Save to library', onclick: async () => {
      await library.put({ id: newId(), created: Date.now(), item: copyItem(item) });
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
        star,
        h('button', { class: 'icon', title: 'Remove', onclick: remove }, '×'),
      ),
    );
  }

  function renderItems(focusId) {
    items.replaceChildren(...lesson.items.map(itemEl));
    if (focusId) items.querySelector(`[data-id="${focusId}"] .item-title`).focus();
  }

  /* Pieces and goals, shown on every lesson page */
  const goalList = h('ul', { class: 'goals' });
  function renderGoals() {
    goalList.replaceChildren(...student.goals.map((g) => h('li', {},
      h('button', { class: 'icon status', title: 'Learning / Polishing / Done', onclick: (e) => { g.status = (g.status + 1) % 3; e.currentTarget.textContent = STATUS[g.status]; save(); } }, STATUS[g.status]),
      input(g, 'text', { placeholder: 'Piece or goal', 'aria-label': 'Piece or goal' }),
      h('button', { class: 'icon', title: 'Remove', onclick: () => { student.goals.splice(student.goals.indexOf(g), 1); save(); renderGoals(); } }, '×'))));
  }
  renderGoals();

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

  const stars = h('div', { class: 'starpick', role: 'group', 'aria-label': 'Stars' });
  const drawStars = () => stars.replaceChildren(...[1, 2, 3].map((n) => h('button', { class: n <= lesson.stars ? 'on' : '', onclick: () => {
    lesson.stars = lesson.stars === n ? n - 1 : n;
    save();
    drawStars();
  } }, '★')));
  drawStars();
  const stickerBtn = h('button', { class: 'sticker', title: 'Sticker', onclick: async () => {
    lesson.sticker = await chooseSticker(lesson.sticker);
    stickerBtn.textContent = lesson.sticker || '＋';
    save();
  } }, lesson.sticker || '＋');

  const daySel = h('select', { 'aria-label': 'Lesson day', onchange: () => { student.day = daySel.value === '' ? '' : +daySel.value; save(); } },
    h('option', { value: '', selected: student.day === '' }, 'Day'),
    DAYS.map((d, i) => h('option', { value: i, selected: String(student.day) === String(i) }, d)));

  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '#/' }, '‹ Lesson pages')),
    h('div', { class: 'who' },
      input(student, 'name', { class: 'title', placeholder: 'First name', 'aria-label': 'First name', autocomplete: 'off' }, setTitle),
      input(student, 'instrument', { class: 'instrument', placeholder: 'Instrument', 'aria-label': 'Instrument' }),
      daySel,
      input(student, 'time', { type: 'time', class: 'time', 'aria-label': 'Lesson time' }),
      confirmButton('Remove student', 'Remove for good?', async () => {
        clearTimeout(saveTimer);
        saveTimer = null;
        await students.delete(student.id);
        student = null;
        location.hash = '#/';
      }),
    ),
    goalList,
    h('div', { class: 'bar' }, h('button', { onclick: () => { student.goals.push({ id: newId(), text: '', status: 0 }); save(); renderGoals(); goalList.lastChild.querySelector('input').focus(); } }, 'Add piece or goal')),
    h('div', { class: 'bar' },
      chips,
      h('span', { class: 'grow' }),
      h('button', { onclick: async () => {
        // A new lesson starts from the last one's practice list, goal and private notes.
        const last = student.lessons[student.lessons.length - 1];
        const fresh = newLesson(last.items.map(copyItem));
        fresh.minutes = last.minutes;
        student.lessons.push(fresh);
        save();
        await flush();
        location.hash = `#/${student.id}/${fresh.id}`;
      } }, 'New lesson'),
    ),
    h('div', { class: 'bar' },
      input(lesson, 'date', { class: 'date', type: 'date', 'aria-label': 'Lesson date' },
        () => { chips.querySelector('[aria-current]').textContent = chipLabel(lesson); }),
      stickerBtn,
      stars,
      h('label', { class: 'minutes' }, '🎯 ', input(lesson, 'minutes', { type: 'number', min: 1, max: 240, placeholder: '—', 'aria-label': 'Practice minutes a day' }), ' min'),
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

function setupSummary(u) {
  const out = [];
  if (Number.isInteger(u.a)) out.push('🔁');
  if (u.s) out.push(`${u.s}%`);
  if (u.k) out.push(`${u.k > 0 ? '+' : ''}${u.k}`);
  if (u.m?.length) out.push('🔇');
  if (u.n) out.push(u.n === 1 ? 'ABC' : 'do re mi');
  return out.join(' · ');
}

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
