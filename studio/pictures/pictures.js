/* The picture library: pictures for the class app's drawing box and think/speak, in groups,
   each with a name the drawing box can search by. Edited straight on the website (the Class
   app's files, /studio/api/class/, see worker/index.js); the class app gets it by its sync.
   A picture comes in by pasting it, or its address (copy image address in Google Images:
   the website fetches it), by file or by dropping it. A picture can be in more than one
   group (the same media in each), with one name. */

import { h, confirmButton } from '../dom.js';

const API = '/studio/api/class/';
const ID = 'pictures';
const app = document.getElementById('app');

let rec = null;          // the library as last read or saved
let into = 0;            // the group new pictures go to
let note = '', bad = false;
let busy = 0;

const empty = () => ({ id: ID, name: 'Picture library', created: Date.now(), updated: 0, groups: [{ name: 'Pictures', pics: [] }] });
const src = (hash) => API + 'media/' + hash;

async function read() {
  const res = await fetch(API + 'library/' + ID, { cache: 'no-store', redirect: 'manual' });
  if (res.status === 404) return empty();
  if (!res.ok) throw new Error(res.status === 401 || res.type === 'opaqueredirect' ? 'Sign in again (reload the page).' : 'Couldn\'t load the library (' + res.status + ').');
  return res.json();
}

/** Make a change to the library as it is on the website now, and save it. One at a time,
    so quick changes (naming one picture after another) don't trip over each other.
    quiet: don't redraw (a name; the boxes already show it). */
let saving = Promise.resolve();
function change(fn, quiet = false) {
  const run = saving.then(() => save(fn, quiet));
  saving = run.catch(() => {});
  return run;
}

async function save(fn, quiet) {
  let base = null;
  for (let tries = 0; tries < 4; tries++) {
    const now = await read();
    const was = base != null ? base : now.updated || 0;
    fn(now);
    const u = Math.max(Date.now(), was + 1);
    now.updated = u;
    delete now.synced;
    const res = await fetch(API + 'library/' + ID + '?u=' + u + (was ? '&base=' + was : ''), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(now) });
    if (res.status === 409) { base = (await res.json().catch(() => ({}))).u || null; continue; }
    if (!res.ok) throw new Error('Saving didn\'t work (' + res.status + ').');
    rec = now;
    if (!quiet) paint();
    return;
  }
  throw new Error('Saving didn\'t work. Reload and try again.');
}

async function hashOf(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(d.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Upload a picture file (a Blob); returns its hash. */
async function upload(blob, name) {
  if (!/^image\//.test(blob.type)) throw new Error('That isn\'t a picture.');
  const bytes = await blob.arrayBuffer();
  const hash = await hashOf(bytes);
  const res = await fetch(API + 'media/' + hash, { method: 'PUT', body: bytes,
    headers: { 'Content-Type': blob.type, 'X-Rights': 'classroom', 'X-Name': encodeURIComponent(name || '') } });
  if (!res.ok) throw new Error('Uploading didn\'t work (' + res.status + ').');
  return hash;
}

/** A picture by its web address: the website fetches it. */
async function grab(url, name) {
  const res = await fetch(API + 'grab', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, name }) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'That didn\'t work (' + res.status + ').');
  return out.hash;
}

function dataBlob(text) {
  const m = /^data:(image\/[\w+.-]+);base64,(.*)$/s.exec(text.trim());
  if (!m) return null;
  const bin = atob(m[2].replace(/\s/g, ''));
  return new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: m[1] });
}

/** Add pictures (Blobs) or addresses (text) to group gi. */
async function add(items, gi = into) {
  const name = nameBox.value.trim();
  busy++;
  say('Adding…');
  try {
    const added = [];
    for (const it of items) {
      if (typeof it === 'string') {
        const blob = dataBlob(it);
        added.push({ media: blob ? await upload(blob, name) : await grab(it.trim(), name), name });
      } else {
        // A file is named by its file name unless a name is typed.
        const n = name || (it.name || '').replace(/\.[^.]+$/, '');
        added.push({ media: await upload(it, n), name: n });
      }
    }
    await change((r) => {
      const g = r.groups[gi] || r.groups[0];
      const all = r.groups.flatMap((x) => x.pics);
      for (const { media, name: n } of added) {
        // A picture has one name, whichever groups it's in; a file's name fills in one left blank.
        for (const x of all) if (x.media === media && (name || !x.name)) x.name = n || '';
        if (g.pics.some((p) => p.media === media)) continue;
        const was = all.find((p) => p.media === media);
        g.pics.push({ media, name: (was && was.name) || n || '' });
      }
    });
    nameBox.value = '';
    pasteBox.value = '';
    say(added.length === 1 ? 'Added.' : added.length + ' added.');
  } catch (e) {
    say(e.message, true);
  } finally {
    busy--;
  }
}

function say(text, isBad = false) {
  note = text;
  bad = isBad;
  noteEl.textContent = text;
  noteEl.className = 'pics-note' + (bad ? ' bad' : '');
}

// ---- the page ------------------------------------------------------------------

const pasteBox = h('input', { class: 'paste', placeholder: 'Paste a picture or its address', autocomplete: 'off' });
const nameBox = h('input', { class: 'name', placeholder: 'Name', autocomplete: 'off' });
const findBox = h('input', { class: 'pics-find', type: 'search', placeholder: '🔎 Find' });
const files = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
const groupPick = h('select', {});
const noteEl = h('p', { class: 'pics-note' });
const groupsEl = h('div', {});

pasteBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' && pasteBox.value.trim()) add([pasteBox.value]); });
nameBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' && pasteBox.value.trim()) add([pasteBox.value]); });
findBox.addEventListener('input', paint);
files.addEventListener('change', () => { add([...files.files]); files.value = ''; });
groupPick.addEventListener('change', () => { into = Number(groupPick.value); paint(); });

// A copied picture or address pastes in anywhere but a name.
document.addEventListener('paste', (e) => {
  const t = e.target;
  if (t !== pasteBox && t.tagName === 'INPUT') return;
  const cd = e.clipboardData;
  if (!cd) return;
  const pics = [...cd.items].filter((i) => /^image\//.test(i.type)).map((i) => i.getAsFile()).filter(Boolean);
  const text = cd.getData('text/plain').trim();
  if (pics.length) { e.preventDefault(); add(pics); return; }
  if (/^(https?:|data:image\/)/i.test(text)) { e.preventDefault(); pasteBox.value = text.slice(0, 120); add([text]); }
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const gi = e.target.closest && e.target.closest('.pics-group') ? Number(e.target.closest('.pics-group').dataset.i) : into;
  const fs = [...((e.dataTransfer && e.dataTransfer.files) || [])];
  const url = e.dataTransfer && (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'));
  if (fs.length) add(fs, gi);
  else if (url && /^(https?:|data:image\/)/i.test(url.trim())) add([url.split('\n')[0]], gi);
});

// One <img> per picture, kept between paints so nothing reloads or flickers.
const imgs = new Map();
function imgOf(p, key) {
  let el = imgs.get(key);
  if (!el) imgs.set(key, el = h('img', { src: src(p.media), alt: '', loading: 'lazy' }));
  el.alt = p.name || '';
  return el;
}

/** Save a picture's name, in every group it's in. */
function rename(media, v) {
  for (const el of document.querySelectorAll('input[data-key$=":' + media + '"]')) if (el !== document.activeElement) el.value = v;
  return change((r) => {
    for (const g of r.groups) for (const x of g.pics) if (x.media === media) x.name = v;
  }, true).catch((err) => say(err.message, true));
}

/** A picture's name box: saves when you leave it; Enter goes on to the next one. */
function nameInput(p, key) {
  const input = h('input', { value: p.name || '', placeholder: 'Name', dataset: { key }, autocomplete: 'off' });
  const save = () => {
    const v = input.value.trim();
    const now = rec && rec.groups.flatMap((g) => g.pics).find((x) => x.media === p.media);
    if (now && (now.name || '') !== v) rename(p.media, v);
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const all = [...document.querySelectorAll('input[data-key^="n:"]')];
    const next = all[all.indexOf(input) + 1];
    if (next) next.focus(); else input.blur();
  });
  return input;
}

/** Redraw, keeping whatever box you're in (and what you've typed there) as it was. */
function paint() {
  if (!rec) return;
  const a = document.activeElement;
  const kept = a && a.dataset && a.dataset.key ? { key: a.dataset.key, value: a.value, s: a.selectionStart, e: a.selectionEnd } : null;
  draw();
  if (!kept) return;
  const b = document.querySelector('[data-key="' + CSS.escape(kept.key) + '"]');
  if (!b || b === a) return;
  b.value = kept.value;
  b.focus();
  try { b.setSelectionRange(kept.s, kept.e); } catch (e) { /* not a text box */ }
}

function draw() {
  into = Math.min(into, rec.groups.length - 1);
  groupPick.replaceChildren(...rec.groups.map((g, i) => h('option', { value: String(i), selected: i === into }, g.name)));
  const q = findBox.value.trim().toLowerCase();
  shown = [];
  groupsEl.replaceChildren(...rec.groups.map((g, gi) => {
    const pics = g.pics.filter((p) => !q || (p.name || '').toLowerCase().includes(q));
    if (q && !pics.length) return null;
    const title = h('input', { class: 'title', value: g.name, dataset: { key: 'g:' + gi }, onchange: (e) => {
      const v = e.target.value.trim();
      if (v) change((r) => { r.groups[gi].name = v; }).catch((err) => say(err.message, true));
    } });
    return h('section', { class: 'pics-group' + (gi === into ? ' on' : ''), dataset: { i: gi },
      onclick: (e) => { if (into !== gi && !e.target.closest('button, input, .img')) { into = gi; paint(); } } },
      h('div', { class: 'bar' }, title,
        h('button', { onclick: () => { into = gi; files.click(); } }, '+ Files'),
        confirmButton('Remove group', 'Sure?', () => change((r) => {
          r.groups.splice(gi, 1);
          if (!r.groups.length) r.groups.push({ name: 'Pictures', pics: [] });
        }).catch((err) => say(err.message, true)))),
      h('div', { class: 'pics-grid' }, pics.map((p) => {
        const key = gi + ':' + p.media;
        const at = shown.push(p.media) - 1;
        return h('div', { class: 'pic' },
          h('div', { class: 'img', onclick: () => open(at) }, imgOf(p, key)),
          nameInput(p, 'n:' + key),
          h('button', { class: 'x', title: 'Take out', tabIndex: -1, onclick: () => change((r) => {
            const list = r.groups[gi].pics;
            const k = list.findIndex((y) => y.media === p.media);
            if (k >= 0) list.splice(k, 1);
          }).catch((err) => say(err.message, true)) }, '✕'));
      })));
  }));
  paintView();
}

// ---- one picture, large: its name and the groups it's in --------------------------

let shown = [];          // the pictures on the page, in order (media hashes)
let at = -1;             // which of them is open, or -1
const view = h('div', { class: 'pics-view', hidden: true });

function open(i) {
  at = i;
  paintView();
}

function close() {
  at = -1;
  view.hidden = true;
}

function paintView() {
  if (at < 0) return;
  const media = shown[at];
  const p = media && rec.groups.flatMap((g) => g.pics).find((x) => x.media === media);
  if (!p) { close(); return; }
  const ins = rec.groups.map((g) => g.pics.some((x) => x.media === media));
  const count = ins.filter(Boolean).length;
  view.replaceChildren(
    h('div', { class: 'box' },
      h('img', { src: src(media), alt: p.name || '' }),
      h('div', { class: 'row' },
        h('button', { class: 'icon', title: 'Back', disabled: at === 0, onclick: () => open(at - 1) }, '←'),
        nameInput(p, 'v:' + media),
        h('button', { class: 'icon', title: 'Next', disabled: at === shown.length - 1, onclick: () => open(at + 1) }, '→'),
        h('button', { class: 'icon', title: 'Close', onclick: close }, '✕')),
      h('div', { class: 'chips' }, rec.groups.map((g, gi) => h('button', {
        class: 'chip' + (ins[gi] ? ' on' : ''),
        disabled: ins[gi] && count === 1,
        onclick: () => change((r) => {
          const list = r.groups[gi] && r.groups[gi].pics;
          if (!list) return;
          const k = list.findIndex((y) => y.media === media);
          if (k >= 0) { if (r.groups.filter((x) => x.pics.some((y) => y.media === media)).length > 1) list.splice(k, 1); }
          else list.push(p.name ? { media, name: p.name } : { media });
        }).catch((err) => say(err.message, true))
      }, g.name)))));
  view.hidden = false;
}

view.addEventListener('click', (e) => { if (e.target === view) close(); });
document.addEventListener('keydown', (e) => {
  if (at < 0) return;
  if (e.key === 'Escape') { close(); return; }
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft' && at > 0) open(at - 1);
  if (e.key === 'ArrowRight' && at < shown.length - 1) open(at + 1);
});

async function start() {
  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '← Studio'), h('h1', { class: 'grow' }, 'Picture library'),
      findBox,
      h('button', { onclick: () => {
        const name = window.prompt('Group name');
        if (name && name.trim()) change((r) => { r.groups.push({ name: name.trim(), pics: [] }); into = r.groups.length - 1; })
          .catch((err) => say(err.message, true));
      } }, '+ Group')),
    h('div', { class: 'pics-top' },
      h('div', { class: 'pics-add' }, pasteBox, nameBox, groupPick,
        h('button', { class: 'primary', onclick: () => { if (pasteBox.value.trim()) add([pasteBox.value]); else files.click(); } }, 'Add')),
      noteEl),
    groupsEl, files, view);
  try {
    rec = await read();
    paint();
  } catch (e) {
    say(e.message, true);
  }
}

start();
