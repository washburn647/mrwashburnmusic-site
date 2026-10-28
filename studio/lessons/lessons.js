/* Private lesson pages: one page per lesson for each private student.
   Students are kept on this device only (see ../db.js). A student gets
   their page as a link to /lesson/ with the page inside the link itself
   (see /lesson/codec.js), so no student information is stored online.
   #/ is the list, #/<student> and #/<student>/<lesson> one student. */

import { store, newId, downloadJSON, today } from '../db.js';
import { h, grow, confirmButton } from '../dom.js';
import { encodeLesson, safeLink, formatDate } from '/lesson/codec.js';

const students = store('students');
const app = document.getElementById('app');

const newItem = () => ({ id: newId(), title: '', detail: '', link: '' });
const newLesson = (items = [newItem()]) => ({ id: newId(), date: today(), items, note: '' });

/* ---------- Student list ---------- */

async function showList() {
  document.title = 'Lesson pages · Studio';
  const all = (await students.all()).sort((a, b) => a.name.localeCompare(b.name));
  const restore = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: () => restoreBackup(restore.files[0]) });
  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '‹ Studio')),
    h('div', { class: 'bar' },
      h('h1', { class: 'grow' }, 'Lesson pages'),
      h('button', { onclick: () => downloadJSON({ kind: 'mwm-lesson-students', version: 1, students: all }, `lesson-students-${today()}.json`), disabled: !all.length }, 'Backup'),
      h('button', { onclick: () => restore.click() }, 'Restore'),
      restore,
      h('button', { class: 'primary', onclick: addStudent }, 'Add student'),
    ),
    h('ul', { class: 'sheets' }, all.map((s) => {
      const last = s.lessons[s.lessons.length - 1];
      return h('li', {}, h('a', { href: `#/${s.id}` },
        h('span', {}, s.name || 'New student'),
        h('small', {}, [s.instrument, last && formatDate(last.date)].filter(Boolean).join(' · ')),
      ));
    })),
  );
}

async function addStudent() {
  const now = Date.now();
  const s = { id: newId(), name: '', instrument: '', created: now, updated: now, lessons: [newLesson()] };
  await students.put(s);
  location.hash = `#/${s.id}`;
}

/* Restore adds students from the file; one already here is replaced only by a newer copy. */
async function restoreBackup(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { data = null; }
  if (!data || data.kind !== 'mwm-lesson-students' || !Array.isArray(data.students)) {
    alert('That file is not a lesson pages backup.');
    return;
  }
  const str = (x) => String(x || '');
  for (const s of data.students) {
    if (!s || typeof s.id !== 'string' || !Array.isArray(s.lessons)) continue;
    const here = await students.get(s.id);
    if (here && here.updated >= s.updated) continue;
    await students.put({
      id: s.id, name: str(s.name), instrument: str(s.instrument),
      created: Number(s.created) || Date.now(), updated: Number(s.updated) || Date.now(),
      lessons: s.lessons.map((l) => ({
        id: typeof l.id === 'string' ? l.id : newId(), date: str(l.date), note: str(l.note),
        items: (Array.isArray(l.items) ? l.items : []).map((it) => ({
          id: typeof it.id === 'string' ? it.id : newId(), title: str(it.title), detail: str(it.detail), link: str(it.link),
        })),
      })),
    });
  }
  showList();
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

function pageFor(s, lesson) {
  return {
    v: 1, n: s.name.trim(), i: s.instrument.trim(), d: lesson.date, m: lesson.note.trim(),
    t: lesson.items.filter((it) => it.title.trim() || it.detail.trim() || it.link.trim())
      .map((it) => [it.title.trim(), it.detail.trim(), safeLink(it.link)]),
  };
}

async function linkFor(s, lesson) {
  return `${location.origin}/lesson/#${await encodeLesson(pageFor(s, lesson))}`;
}

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
  const lesson = student.lessons.find((l) => l.id === lessonId) || student.lessons[student.lessons.length - 1];
  const setTitle = () => { document.title = `${student.name || 'New student'} · Lesson pages`; };
  setTitle();

  const items = h('ol', { class: 'items' });

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
    return h('li', { dataset: { id: item.id } },
      h('div', { class: 'fields' },
        input(item, 'title', { class: 'item-title', placeholder: 'Practice', 'aria-label': 'Practice' }),
        textarea(item, 'detail', { placeholder: 'Details', 'aria-label': 'Details' }),
        input(item, 'link', { class: 'item-link', placeholder: 'Link', type: 'url', 'aria-label': 'Link' }),
      ),
      h('div', { class: 'tools' },
        h('button', { class: 'icon', title: 'Move up', onclick: () => move(-1) }, '↑'),
        h('button', { class: 'icon', title: 'Move down', onclick: () => move(1) }, '↓'),
        h('button', { class: 'icon', title: 'Remove', onclick: remove }, '×'),
      ),
    );
  }

  function renderItems(focusId) {
    items.replaceChildren(...lesson.items.map(itemEl));
    if (focusId) items.querySelector(`[data-id="${focusId}"] .item-title`).focus();
  }

  const copy = h('button', { class: 'primary', onclick: async () => {
    await navigator.clipboard.writeText(await linkFor(student, lesson));
    copy.textContent = 'Copied';
    setTimeout(() => { copy.textContent = 'Copy link'; }, 1500);
  } }, 'Copy link');

  const chipLabel = (l) => formatDate(l.date).replace(/^\w+, /, '') || 'No date';
  const chips = h('nav', { class: 'chips' }, [...student.lessons].reverse().map((l) =>
    h('a', { href: `#/${student.id}/${l.id}`, 'aria-current': l === lesson ? 'true' : null }, chipLabel(l)),
  ));

  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '#/' }, '‹ Lesson pages')),
    h('div', { class: 'who' },
      input(student, 'name', { class: 'title', placeholder: 'First name', 'aria-label': 'First name', autocomplete: 'off' }, setTitle),
      input(student, 'instrument', { class: 'instrument', placeholder: 'Instrument', 'aria-label': 'Instrument' }),
      confirmButton('Remove student', 'Remove for good?', async () => {
        clearTimeout(saveTimer);
        saveTimer = null;
        await students.delete(student.id);
        student = null;
        location.hash = '#/';
      }),
    ),
    h('div', { class: 'bar' },
      chips,
      h('span', { class: 'grow' }),
      h('button', { onclick: async () => {
        // A new lesson starts from the last one's practice list.
        const last = student.lessons[student.lessons.length - 1];
        const fresh = newLesson(last.items.map((it) => ({ ...it, id: newId() })));
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
    ),
    textarea(lesson, 'note', { class: 'notebox', placeholder: 'Note', 'aria-label': 'Note' }),
    h('div', { class: 'bar actions' },
      copy,
      h('button', { onclick: async () => window.open(await linkFor(student, lesson), '_blank', 'noopener') }, 'Open page'),
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

/* ---------- Routing ---------- */

async function route() {
  if (student) { await flush(); student = null; }
  const [id, lessonId] = location.hash.replace(/^#\/?/, '').split('/');
  if (id) showStudent(id, lessonId); else showList();
}

window.addEventListener('hashchange', route);
window.addEventListener('pagehide', () => { if (student) flush(); });
route();
