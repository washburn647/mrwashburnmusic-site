/* The picture library (#/pictures): pictures Kyle keeps for the drawing box and
   think/speak, in groups (a game's pictures, say). Synced like decks (sync.js,
   kind `library`, one record). Pictures come in by file, paste or drop here, and
   by ⭐ in the drawing box; widgets.js reaches them through useLibrary(). */

import * as store from './store.js';
import { el, loadHashes } from './ui.js';
import { useLibrary } from './widgets.js';

const ID = 'pictures';

export async function getLibrary() {
  const rec = await store.getLibrary(ID);
  if (rec) return rec;
  const now = Date.now();
  return { id: ID, name: 'Picture library', created: now, updated: now, groups: [{ name: 'Pictures', pics: [] }] };
}

async function save(rec) {
  await store.putLibrary(rec);
}

/** Keep a picture (a Blob) in a group, made if new. Returns its hash. */
export async function addToLibrary(blob, groupName) {
  const hash = await store.keepBlob(blob, '');
  const rec = await getLibrary();
  let g = rec.groups.find((x) => x.name === groupName) || rec.groups[0];
  if (!g) rec.groups.push(g = { name: groupName || 'Pictures', pics: [] });
  if (!g.pics.some((p) => p.media === hash)) {
    g.pics.push({ media: hash });
    await save(rec);
  }
  return hash;
}

// What the drawing box sees.
useLibrary({
  async groups() {
    const rec = await getLibrary();
    const url = await loadHashes(store.libraryMedia(rec));
    return rec.groups.map((g) => ({ name: g.name, pics: g.pics.map((p) => ({ media: p.media, src: url(p.media) })) }));
  },
  async blob(hash) {
    const [m] = await store.getMedia([hash]);
    return m ? m.blob : null;
  },
  add: addToLibrary
});

/** Choose pictures from the library. Resolves to their hashes ([] on Cancel). */
export async function pickFromLibrary() {
  const rec = await getLibrary();
  const url = await loadHashes(store.libraryMedia(rec));
  return new Promise((resolve) => {
    const picked = [];
    const done = (v) => { box.remove(); resolve(v); };
    const grid = el('div', { class: 'pics-pick' });
    const paint = (g) => {
      tabs.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.textContent === g.name));
      grid.replaceChildren(...g.pics.map((p) => el('button', {
        class: 'pics-cell' + (picked.includes(p.media) ? ' on' : ''),
        onclick: (e) => {
          const i = picked.indexOf(p.media);
          if (i < 0) picked.push(p.media); else picked.splice(i, 1);
          e.currentTarget.classList.toggle('on', i < 0);
        }
      }, el('img', { src: url(p.media), alt: '' }))));
    };
    const tabs = el('div', { class: 'pics-tabs' }, rec.groups.map((g) =>
      el('button', { class: 'chip', onclick: () => paint(g) }, g.name)));
    const box = el('div', { class: 'wg-names' },
      el('div', { class: 'wg-names-box wg-dialog' }, tabs, grid,
        el('div', { class: 'wg-names-row' }, el('span', { class: 'spacer' }),
          el('button', { class: 'btn quiet', onclick: () => done([]) }, 'Cancel'),
          el('button', { class: 'btn', onclick: () => done(picked) }, 'Add'))));
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') done([]); });
    (document.fullscreenElement || document.body).append(box);
    if (rec.groups[0]) paint(rec.groups[0]);
  });
}

// ---- the page ----------------------------------------------------------------

let current = 0;                           // the group pastes go to

export async function showPictures(main) {
  document.title = 'Pictures · Class';
  const rec = await getLibrary();
  const url = await loadHashes(store.libraryMedia(rec));
  current = Math.min(current, rec.groups.length - 1);
  const files = el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  let into = 0;
  const redraw = () => showPictures(main);
  const addBlobs = async (gi, blobs) => {
    const fresh = await getLibrary();
    const g = fresh.groups[gi];
    if (!g) return;
    for (const b of blobs) {
      if (!/^image\//.test(b.type)) continue;
      const hash = await store.keepBlob(b, b.name || '');
      if (!g.pics.some((p) => p.media === hash)) g.pics.push({ media: hash });
    }
    await save(fresh);
    current = gi;
    redraw();
  };
  files.addEventListener('change', () => { addBlobs(into, [...files.files]); files.value = ''; });
  const change = async (fn) => { const fresh = await getLibrary(); fn(fresh); await save(fresh); redraw(); };

  const sections = rec.groups.map((g, gi) => {
    const sec = el('section', { class: 'pics-group' + (gi === current ? ' on' : ''), onclick: () => {
      current = gi;
      main.querySelectorAll('.pics-group').forEach((s, k) => s.classList.toggle('on', k === gi));
    } },
      el('div', { class: 'pics-head' },
        el('h3', {}, g.name),
        el('button', { class: 'btn quiet', title: 'Rename', onclick: () => {
          const name = window.prompt('Group name', g.name);
          if (name && name.trim()) change((r) => { r.groups[gi].name = name.trim(); });
        } }, '✎'),
        el('button', { class: 'btn quiet', title: 'Remove group', onclick: () => {
          if (g.pics.length && !window.confirm('Remove "' + g.name + '" and its ' + g.pics.length + ' pictures?')) return;
          change((r) => { r.groups.splice(gi, 1); if (!r.groups.length) r.groups.push({ name: 'Pictures', pics: [] }); });
        } }, '🗑')),
      el('div', { class: 'pics-grid' },
        g.pics.map((p, pi) => el('div', { class: 'pics-cell' },
          el('img', { src: url(p.media), alt: '' }),
          el('button', { class: 'pics-x', title: 'Take out', onclick: (e) => {
            e.stopPropagation();
            change((r) => { r.groups[gi].pics.splice(pi, 1); });
          } }, '✕'))),
        el('button', { class: 'pics-cell pics-add', title: 'Add pictures', onclick: () => { into = gi; files.click(); } }, '+')));
    sec.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    sec.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addBlobs(gi, [...((e.dataTransfer && e.dataTransfer.files) || [])]);
    });
    return sec;
  });

  main.replaceChildren(
    el('div', { class: 'deck-head' }, el('h2', {}, 'Pictures'), el('span', { class: 'spacer' }),
      el('button', { class: 'btn', onclick: () => {
        const name = window.prompt('Group name');
        if (name && name.trim()) change((r) => { r.groups.push({ name: name.trim(), pics: [] }); current = r.groups.length - 1; });
      } }, '+ Group')),
    ...sections, files);
}

// A copied picture pastes into the group last clicked.
window.addEventListener('paste', async (e) => {
  if (!/^#\/pictures/.test(location.hash) || document.querySelector('.present, .wg-names')) return;
  const blobs = [...((e.clipboardData && e.clipboardData.items) || [])]
    .filter((i) => /^image\//.test(i.type)).map((i) => i.getAsFile()).filter(Boolean);
  if (!blobs.length) return;
  e.preventDefault();
  const rec = await getLibrary();
  const g = rec.groups[current];
  for (const b of blobs) {
    const hash = await store.keepBlob(b, '');
    if (!g.pics.some((p) => p.media === hash)) g.pics.push({ media: hash });
  }
  await save(rec);
  showPictures(document.querySelector('#main'));
});
