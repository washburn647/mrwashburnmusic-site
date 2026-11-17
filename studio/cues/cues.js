/* Video cue sheets: one sheet per song, listing every shot to film.
   A song is a list of scenes in the order they play (talk, chorus, head, ...).
   A scene with more than one branch is a choice: one branch per option
   (head_0, head_1, head_2, head_own). Each branch has its clapboard text,
   what happens in it, and notes for editing.
   Sheets live on this device only (see ../db.js), and move between
   devices as a backup file. #/ is the list, #/<id> is one sheet. */

import { store, newId, downloadJSON } from '../db.js';
import { h, grow, confirmButton } from '../dom.js';

const cues = store('cues');
const allSheets = cues.all;
const getSheet = cues.get;
const putSheet = cues.put;
const deleteSheet = cues.delete;
const newBranch = () => ({ id: newId(), slate: '', what: '', notes: '' });
const newScene = () => ({ id: newId(), name: '', branches: [newBranch()] });

/* "Make your own!" -> "make_your_own" */
const slug = (text) => String(text).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/* The clapboard text a branch gets when none is typed: chorus, or head_0, head_1, ... */
function autoSlate(scene, i) {
  const base = slug(scene.name);
  if (!base) return '';
  return scene.branches.length > 1 ? `${base}_${i}` : base;
}
const slateOf = (scene, i) => scene.branches[i].slate.trim() || autoSlate(scene, i);

const shotCount = (sheet) => sheet.scenes.reduce((n, s) => n + s.branches.length, 0);

/* Sheets saved before scenes and branches had rows of { dur, say, screen, notes }:
   each row becomes a scene with one branch. */
function upgrade(s) {
  if (Array.isArray(s.scenes)) return s;
  const rows = Array.isArray(s.rows) ? s.rows : [];
  const { rows: _, ...rest } = s;
  return {
    ...rest,
    notes: '',
    scenes: rows.map((r) => ({
      id: newId(),
      name: '',
      branches: [{
        id: typeof r.id === 'string' ? r.id : newId(),
        slate: '',
        what: String(r.say || ''),
        notes: [r.screen, r.notes].map((t) => String(t || '').trim()).filter(Boolean).join('\n'),
      }],
    })),
  };
}

function clean(s) {
  s = upgrade(s);
  return {
    id: s.id,
    title: String(s.title || ''),
    notes: String(s.notes || ''),
    created: Number(s.created) || Date.now(),
    updated: Number(s.updated) || Date.now(),
    scenes: (Array.isArray(s.scenes) ? s.scenes : []).map((sc) => ({
      id: typeof sc.id === 'string' ? sc.id : newId(),
      name: String(sc.name || ''),
      branches: (Array.isArray(sc.branches) && sc.branches.length ? sc.branches : [{}]).map((b) => ({
        id: typeof b.id === 'string' ? b.id : newId(),
        slate: String(b.slate || ''), what: String(b.what || ''), notes: String(b.notes || ''),
      })),
    })),
  };
}

/* The sheet as plain text, to hand over with the footage. */
function asText(sheet) {
  const lines = [`# ${sheet.title || 'Untitled'}`];
  if (sheet.notes.trim()) lines.push('', sheet.notes.trim());
  for (const scene of sheet.scenes) {
    lines.push('', `## ${scene.name.trim() || '(no name)'}`);
    scene.branches.forEach((b, i) => {
      const what = b.what.trim().replace(/\s*\n\s*/g, ' ');
      lines.push(`- ${slateOf(scene, i) || '(no clapboard)'}${what ? `: ${what}` : ''}`);
      for (const n of b.notes.split('\n').map((t) => t.trim()).filter(Boolean)) lines.push(`  - ${n}`);
    });
  }
  return `${lines.join('\n')}\n`;
}

const app = document.getElementById('app');

/* ---------- Sheet list ---------- */

async function showList() {
  document.title = 'Cue sheets · Studio';
  const sheets = (await allSheets()).map(upgrade).sort((a, b) => b.updated - a.updated);
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
      h('button', { class: 'primary', onclick: createSheet }, 'New song'),
    ),
    h('ul', { class: 'sheets' }, sheets.map((s) =>
      h('li', {}, h('a', { href: `#/${s.id}` },
        h('span', {}, s.title || 'Untitled'),
        h('small', {}, `${s.scenes.length} scenes · ${shotCount(s)} shots`),
      )),
    )),
  );
}

async function createSheet() {
  const now = Date.now();
  const sheet = { id: newId(), title: '', notes: '', created: now, updated: now, scenes: [newScene()] };
  await putSheet(sheet);
  location.hash = `#/${sheet.id}`;
}

function downloadBackup(sheets) {
  downloadJSON({ kind: 'mwm-cue-sheets', version: 2, sheets }, `cue-sheets-${new Date().toISOString().slice(0, 10)}.json`);
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
    if (!s || typeof s.id !== 'string' || !(Array.isArray(s.scenes) || Array.isArray(s.rows))) continue;
    const here = await getSheet(s.id);
    if (here && here.updated >= s.updated) continue;
    await putSheet(clean(s));
  }
  showList();
}

/* ---------- One sheet ---------- */

let sheet = null;
let saveTimer = null;

function save() {
  sheet.updated = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; putSheet(sheet); }, 300);
}

function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; return putSheet(sheet); }
  return Promise.resolve();
}

function moveIn(list, item, by) {
  const i = list.indexOf(item);
  const j = i + by;
  if (j < 0 || j >= list.length) return false;
  list.splice(i, 1);
  list.splice(j, 0, item);
  return true;
}

async function showSheet(id) {
  const found = await getSheet(id);
  if (!found) { location.hash = '#/'; return; }
  sheet = clean(found);
  const setTitle = () => { document.title = `${sheet.title || 'Untitled'} · Cue sheets`; };
  setTitle();

  const list = h('div', { class: 'scenes' });
  const del = confirmButton('Delete', 'Delete for good?', async () => {
    clearTimeout(saveTimer); saveTimer = null;
    await deleteSheet(sheet.id);
    sheet = null;
    location.hash = '#/';
  });

  function textarea(obj, key, label, cls, onchange) {
    const ta = h('textarea', { rows: 1, value: obj[key], 'aria-label': label, placeholder: label, class: cls,
      oninput: () => { obj[key] = ta.value; grow(ta); save(); if (onchange) onchange(); },
    });
    requestAnimationFrame(() => grow(ta));
    return ta;
  }

  /* Fill in automatic clapboard text and mark clapboards used twice. */
  function refreshSlates() {
    const seen = new Map();
    for (const scene of sheet.scenes) {
      scene.branches.forEach((b, i) => {
        const s = slateOf(scene, i).toLowerCase();
        if (s) seen.set(s, (seen.get(s) || 0) + 1);
      });
    }
    for (const el of list.querySelectorAll('.branch')) {
      const scene = sheet.scenes.find((s) => s.id === el.dataset.scene);
      const i = scene.branches.findIndex((b) => b.id === el.dataset.id);
      const input = el.querySelector('.slate');
      input.placeholder = autoSlate(scene, i) || 'Clapboard';
      const s = slateOf(scene, i).toLowerCase();
      input.classList.toggle('twice', !!s && seen.get(s) > 1);
    }
  }

  function branchEl(scene, b) {
    const slate = h('input', { class: 'slate', value: b.slate, 'aria-label': 'Clapboard', spellcheck: false, autocomplete: 'off',
      oninput: () => { b.slate = slate.value; save(); refreshSlates(); },
    });
    const addBelow = () => {
      const fresh = newBranch();
      scene.branches.splice(scene.branches.indexOf(b) + 1, 0, fresh);
      save();
      render(fresh.id);
    };
    const el = h('div', { class: 'branch', dataset: { id: b.id, scene: scene.id },
      onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addBelow(); } },
    },
      slate,
      textarea(b, 'what', 'Scene', 'what'),
      textarea(b, 'notes', 'Notes', 'notes'),
      h('div', { class: 'tools' },
        h('button', { class: 'icon', title: 'Move up', onclick: () => { if (moveIn(scene.branches, b, -1)) { save(); render(b.id); } } }, '↑'),
        h('button', { class: 'icon', title: 'Move down', onclick: () => { if (moveIn(scene.branches, b, 1)) { save(); render(b.id); } } }, '↓'),
        h('button', { class: 'icon', title: 'Remove branch', onclick: () => {
          if (scene.branches.length === 1) return;
          scene.branches.splice(scene.branches.indexOf(b), 1);
          save();
          render();
        } }, '×'),
      ),
    );
    return el;
  }

  function sceneEl(scene, n) {
    const name = h('input', { class: 'scene-name', value: scene.name, placeholder: 'Scene', 'aria-label': 'Scene name', autocomplete: 'off',
      oninput: () => { scene.name = name.value; save(); refreshSlates(); },
    });
    const remove = confirmButton('×', 'Remove?', () => {
      sheet.scenes.splice(sheet.scenes.indexOf(scene), 1);
      save();
      render();
    });
    remove.className = 'icon danger';
    remove.title = 'Remove scene';
    return h('section', { class: 'scene', dataset: { id: scene.id } },
      h('div', { class: 'scene-head' },
        h('span', { class: 'num' }, n),
        name,
        h('div', { class: 'tools' },
          h('button', { class: 'icon', title: 'Move up', onclick: () => { if (moveIn(sheet.scenes, scene, -1)) { save(); render(); } } }, '↑'),
          h('button', { class: 'icon', title: 'Move down', onclick: () => { if (moveIn(sheet.scenes, scene, 1)) { save(); render(); } } }, '↓'),
          remove,
        ),
      ),
      scene.branches.map((b) => branchEl(scene, b)),
      h('button', { class: 'add-branch noprint', onclick: () => {
        const fresh = newBranch();
        scene.branches.push(fresh);
        save();
        render(fresh.id);
      } }, '+ Branch'),
    );
  }

  /* focus: a branch id (its clapboard gets focus) or a scene id (its name does). */
  function render(focus) {
    list.replaceChildren(...sheet.scenes.map((s, i) => sceneEl(s, i + 1)));
    refreshSlates();
    if (focus) {
      const el = list.querySelector(`[data-id="${focus}"]`);
      el?.querySelector(el.classList.contains('scene') ? '.scene-name' : '.slate')?.focus();
    }
  }

  const title = h('input', { class: 'title', value: sheet.title, placeholder: 'Song', 'aria-label': 'Song',
    oninput: () => { sheet.title = title.value; setTitle(); save(); },
  });

  const copy = h('button', { class: 'noprint', onclick: async () => {
    try {
      await navigator.clipboard.writeText(asText(sheet));
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Copy failed';
    }
    setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
  } }, 'Copy');

  app.replaceChildren(
    h('div', { class: 'bar' },
      h('a', { class: 'back', href: '#/' }, '‹ Cue sheets'),
    ),
    h('div', { class: 'bar' },
      title,
      copy,
      h('button', { class: 'noprint', onclick: () => window.print() }, 'Print'),
      h('span', { class: 'noprint' }, del),
    ),
    textarea(sheet, 'notes', 'Notes', 'song-notes'),
    list,
    h('div', { class: 'bar noprint' },
      h('button', { onclick: () => {
        const fresh = newScene();
        sheet.scenes.push(fresh);
        save();
        render(fresh.id);
      } }, '+ Scene'),
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
