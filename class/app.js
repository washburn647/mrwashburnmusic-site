/* Class app shell: the library of decks, a deck's slides, and importing.
   Routes live in the hash: #/ is the library, #/deck/<id> is one deck. */

import { convertPptx } from './pptx.js';
import { renderSlide } from './render.js';
import { present } from './present.js';
import * as store from './store.js';
import { missingIcons } from './marks.js';

const $ = (sel) => document.querySelector(sel);
const main = $('#main');
const picker = $('#picker');
const urls = new Map();                   // media hash -> object URL, for this session

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) e.append(c);
  return e;
}

async function loadMedia(deck) {
  const need = store.mediaOf(deck).filter((h) => !urls.has(h));
  if (need.length) {
    const recs = await store.getMedia(need);
    recs.forEach((r, i) => { if (r) urls.set(need[i], URL.createObjectURL(r.blob)); });
  }
  return (hash) => urls.get(hash) || '';
}

// A slide drawn small. The stage is scaled to whatever width the card has.
const sizer = new ResizeObserver((entries) => {
  for (const e of entries) {
    const stage = e.target.firstChild;
    if (stage) stage.style.transform = 'scale(' + e.contentRect.width / stage.offsetWidth + ')';
  }
});

const lazy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    lazy.unobserve(e.target);
    e.target._draw();
  }
}, { rootMargin: '400px' });

function thumb(slide, deck, media) {
  const t = el('div', { class: 'thumb' });
  t._draw = () => {
    t.replaceChildren(renderSlide(slide, deck, { media }));
    sizer.observe(t);
  };
  lazy.observe(t);
  return t;
}

// ---- library ---------------------------------------------------------------

async function showLibrary() {
  document.title = 'Class · Mr. Washburn Music';
  const decks = await store.listDecks();
  if (!decks.length) {
    main.replaceChildren(el('div', { class: 'empty' },
      el('h2', {}, 'No decks on this device yet'),
      el('p', {}, 'Download a Google Slides deck as PowerPoint (File > Download > Microsoft PowerPoint),',
        el('br'), 'then bring it in here. You can pick several at once.'),
      el('p', {}, el('button', { class: 'btn', onclick: () => picker.click() }, 'Import PowerPoint files'))));
    return;
  }
  const grid = el('div', { class: 'decks' });
  for (const rec of decks) {
    const media = await loadMedia(rec.deck);
    const first = rec.deck.slides.find((s) => !s.hidden) || rec.deck.slides[0];
    grid.append(el('button', { class: 'deck-card', onclick: () => { location.hash = '#/deck/' + rec.id; } },
      first ? thumb(first, rec.deck, media) : el('div', { class: 'thumb' }),
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, rec.name),
        el('div', { class: 'count' }, rec.deck.slides.length + ' slides'))));
  }
  main.replaceChildren(grid);
}

// ---- one deck --------------------------------------------------------------

async function showDeck(id, startPresenting) {
  const rec = await store.getDeck(id);
  if (!rec) { location.hash = '#/'; return; }
  document.title = rec.name + ' · Class';
  const media = await loadMedia(rec.deck);
  const run = (i) => present(rec, i, media, (at) => {
    const card = main.querySelectorAll('.slide-card')[at];
    if (card) card.scrollIntoView({ block: 'center' });
  }, findGoogle);

  const head = el('div', { class: 'deck-head' },
    el('h2', {}, rec.name),
    el('button', { class: 'btn', onclick: () => run(0) }, '▶ Present'),
    el('button', { class: 'btn danger', onclick: async () => {
      if (!window.confirm('Remove "' + rec.name + '" from this device?')) return;
      await store.deleteDeck(rec.id);
      await store.pruneMedia();
      location.hash = '#/';
    } }, 'Remove'));

  const notes = [...(rec.deck.warnings || [])];
  const noIcon = missingIcons(rec.deck);
  if (noIcon.length) {
    notes.push(noIcon.length + (noIcon.length === 1 ? ' song slide has' : ' song slides have') +
      ' no 1-inch song icon: ' + noIcon.map(({ s, i }) => (s.title || 'untitled') + ' (' + (i + 1) + ')').join(', ') + '.');
  }
  const songs = rec.deck.slides.filter((s) => s.song && s.song.kind === 'song').length;
  const summary = songs ? el('p', { class: 'deck-sum' }, songs + ' song slides, each with an x/y counter and a timer.') : null;
  const warn = notes.length ? el('div', { class: 'warn' }, notes.join(' ')) : null;

  const grid = el('div', { class: 'slides' });
  rec.deck.slides.forEach((s, i) => {
    grid.append(el('button', {
      class: 'slide-card' + (s.hidden ? ' hidden-slide' : ''),
      title: s.hidden ? 'Hidden slide (skipped when you click through)' : 'Present from here',
      onclick: () => run(i)
    }, thumb(s, rec.deck, media),
    el('div', { class: 'cap' }, el('b', {}, String(i + 1)),
      s.song && s.song.icon ? el('img', { class: 'song-icon', src: media(s.song.icon), alt: '' }) : null,
      s.title || '')));
  });
  main.replaceChildren(head, summary || '', warn || '', grid);
  if (startPresenting) run(0);
}

/** The imported copy of a Google deck (and slide), for links between decks. */
async function findGoogle(gdoc, gslide) {
  const rec = (await store.listDecks()).find((d) => d.deck.googleId === gdoc);
  if (!rec) return null;
  const i = gslide ? rec.deck.slides.findIndex((s) => s.gid === gslide) : 0;
  return { deck: rec.deck, media: await loadMedia(rec.deck), index: Math.max(i, 0),
           deckId: rec.id, deckName: rec.name };
}

// ---- import ----------------------------------------------------------------

function deckName(fileName) {
  return fileName.replace(/\.pptx$/i, '').replace(/^\d+\.\s*/, '').trim() || 'Untitled deck';
}

async function importFiles(files) {
  const list = [...files].filter((f) => /\.pptx$/i.test(f.name));
  if (!list.length) {
    window.alert('Choose PowerPoint (.pptx) files. In Google Slides: File > Download > Microsoft PowerPoint.');
    return;
  }
  const bar = el('i');
  const label = el('div', {}, 'Getting ready…');
  const overlay = el('div', { class: 'progress', role: 'status' },
    el('div', { class: 'box' }, el('strong', {}, 'Bringing in your slides'), label, el('div', { class: 'bar' }, bar)));
  document.body.append(overlay);
  const existing = await store.listDecks();
  const done = [];
  const failed = [];
  try {
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      label.textContent = f.name + ' (' + (i + 1) + ' of ' + list.length + ')';
      bar.style.width = (i / list.length * 100) + '%';
      try {
        const { deck, media } = await convertPptx(await f.arrayBuffer());
        await store.putMedia(media);
        const name = deckName(f.name);
        const same = existing.find((d) => d.name === name);
        const now = Date.now();
        await store.putDeck({ id: same ? same.id : newId(), name, created: same ? same.created : now,
                              updated: now, source: f.name, deck });
        done.push(name);
      } catch (err) {
        console.error(err);
        failed.push(f.name + ': ' + err.message);
      }
    }
    bar.style.width = '100%';
    await store.pruneMedia();
    store.askToKeep();
  } finally {
    overlay.remove();
  }
  if (failed.length) window.alert('Some files could not be brought in:\n\n' + failed.join('\n'));
  route();
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- wiring ----------------------------------------------------------------

function route() {
  const m = location.hash.match(/^#\/deck\/([\w-]+)(\/present)?/);
  if (m) showDeck(m[1], !!m[2]);
  else showLibrary();
}

$('#import').addEventListener('click', () => picker.click());
picker.addEventListener('change', () => {
  const files = picker.files;
  if (files && files.length) importFiles(files);
  picker.value = '';
});
$('#home').addEventListener('click', (e) => { e.preventDefault(); location.hash = '#/'; });
window.addEventListener('hashchange', route);

// Drop .pptx files anywhere on the page.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
route();
