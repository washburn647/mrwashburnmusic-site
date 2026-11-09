/* The picture library: pictures Kyle keeps for the drawing box and think/speak,
   in groups (a game's pictures, say), each with a name to search by. Synced like
   decks (sync.js, kind `library`, one record). Kept up in the studio
   (/studio/pictures/, straight on the website) and by ⭐ in the drawing box here;
   widgets.js reaches it through useLibrary(). */

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
export async function addToLibrary(blob, groupName, name = '') {
  const hash = await store.keepBlob(blob, '');
  const rec = await getLibrary();
  let g = rec.groups.find((x) => x.name === groupName) || rec.groups[0];
  if (!g) rec.groups.push(g = { name: groupName || 'Pictures', pics: [] });
  if (!g.pics.some((p) => p.media === hash)) {
    g.pics.push(name ? { media: hash, name } : { media: hash });
    await save(rec);
  }
  return hash;
}

// What the drawing box sees.
useLibrary({
  async groups() {
    const rec = await getLibrary();
    const url = await loadHashes(store.libraryMedia(rec));
    return rec.groups.map((g) => ({ name: g.name, pics: g.pics.map((p) => ({ media: p.media, name: p.name || '', src: url(p.media) })) }));
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
    let shown = rec.groups[0];
    const paint = (g) => {
      shown = g;
      const q = find.value.trim().toLowerCase();
      tabs.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', !q && c.textContent === g.name));
      const pics = q ? rec.groups.flatMap((x) => x.pics).filter((p) => (p.name || '').toLowerCase().includes(q)) : g.pics;
      grid.replaceChildren(...pics.map((p) => el('button', {
        title: p.name || '',
        class: 'pics-cell' + (picked.includes(p.media) ? ' on' : ''),
        onclick: (e) => {
          const i = picked.indexOf(p.media);
          if (i < 0) picked.push(p.media); else picked.splice(i, 1);
          e.currentTarget.classList.toggle('on', i < 0);
        }
      }, el('img', { src: url(p.media), alt: '' }))));
    };
    const find = el('input', { type: 'search', class: 'pics-find', placeholder: '🔎' });
    find.addEventListener('input', () => paint(shown));
    const tabs = el('div', { class: 'pics-tabs' }, rec.groups.map((g) =>
      el('button', { class: 'chip', onclick: () => { find.value = ''; paint(g); } }, g.name)));
    const box = el('div', { class: 'wg-names' },
      el('div', { class: 'wg-names-box wg-dialog' }, find, tabs, grid,
        el('div', { class: 'wg-names-row' }, el('span', { class: 'spacer' }),
          el('button', { class: 'btn quiet', onclick: () => done([]) }, 'Cancel'),
          el('button', { class: 'btn', onclick: () => done(picked) }, 'Add'))));
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') done([]); });
    (document.fullscreenElement || document.body).append(box);
    if (rec.groups[0]) paint(rec.groups[0]);
    find.focus();
  });
}
