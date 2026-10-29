/* Class app shell: the library of decks, a deck's slides, and importing.
   Routes live in the hash: #/ is the library, #/deck/<id> is one deck,
   #/plan is the planner. */

import { convertPptx } from './pptx.js';
import { present, MENU } from './present.js';
import { buildMenu } from './menus.js';
import { openEditor } from './editor.js';
import { el, thumb, loadMedia } from './ui.js';
import * as store from './store.js';
import { missingIcons, forGrade, GRADES } from './marks.js';
import { showPlanner } from './planner.js';
import { gradeHint, indexSongs, playCount, normName } from './plans.js';
import { makeTemplate } from './builder.js';

const CATEGORIES = ['Vocal Warmup', 'Song Fragments', 'Simple Songs', 'Arioso', 'Movement Exploration',
  'Form and Expression', 'Beat Motions', 'Songtales'];

const LOCK = 'e8a2199e2a0d291cde34b6ad10564b06';     // the lock picture the decks' menus use

const $ = (sel) => document.querySelector(sel);
const main = $('#main');
const picker = $('#picker');
let gradePick = null;                     // the grade the deck pages show, or null for all

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
  // Builds take their title and exit slides from a Class template deck, made once from "1 29".
  const made = makeTemplate(decks);
  if (made) {
    const now = Date.now();
    await store.putDeck({ id: newId(), name: 'Class template', created: now, updated: now, source: 'template', deck: made });
    return showLibrary();
  }
  // The category decks first, then classes (built here, the template, imported class decks), then the rest.
  const years = await store.listPlans().catch(() => []);
  const cats = new Set((years.length ? years[years.length - 1].categories : CATEGORIES).map(normName));
  const isCat = (d) => cats.has(normName(d.name));
  const isClass = (d) => d.deck.built || d.deck.template || /^(PK|K|\d)\s+\d+$/i.test(d.name.trim());
  const order = (d) => d.deck.template ? [-1, 0] : [['PK', 'K', '1', '2'].indexOf(d.name.split(/\s+/)[0].toUpperCase()), Number(d.name.split(/\s+/)[1]) || 0];
  const classes = decks.filter((d) => !isCat(d) && isClass(d)).sort((a, b) => {
    const x = order(a), y = order(b);
    return x[0] - y[0] || x[1] - y[1];
  });
  const sections = [
    ['Category decks', decks.filter(isCat)],
    ['Classes', classes],
    ['Other', decks.filter((d) => !isCat(d) && !isClass(d))]
  ];
  const out = [];
  for (const [title, list] of sections) {
    if (!list.length) continue;
    const grid = el('div', { class: 'decks' });
    for (const rec of list) {
      const media = await loadMedia(rec.deck);
      const first = rec.deck.slides.find((s) => !s.hidden) || rec.deck.slides[0];
      grid.append(el('button', { class: 'deck-card', onclick: () => { location.hash = '#/deck/' + rec.id; } },
        first ? thumb(first, rec.deck, media) : el('div', { class: 'thumb' }),
        el('div', { class: 'meta' },
          el('div', { class: 'name' }, rec.name),
          el('div', { class: 'count' }, rec.deck.slides.length + ' slides'))));
    }
    out.push(el('h2', { class: 'lib-h' }, title), grid);
  }
  main.replaceChildren(...out);
}

// ---- one deck --------------------------------------------------------------

async function showDeck(id, startPresenting, editAt) {
  const rec = await store.getDeck(id);
  if (!rec) { location.hash = '#/'; return; }
  document.title = rec.name + ' · Class';
  const media = await loadMedia(rec.deck);
  if (editAt != null) {
    openEditor(rec, editAt, { media, findGoogle, onExit: () => { location.hash = '#/deck/' + rec.id; } });
    return;
  }
  const grade = gradePick;
  const built = rec.deck.built;
  const run = (i, menu) => present(rec, menu ? MENU : i, media, (at) => {
    const card = main.querySelector('.slide-card[data-n="' + at + '"]');
    if (card) card.scrollIntoView({ block: 'center' });
  }, findGoogle, { grade: grade || (built && built.grade), menu: grade ? buildMenu(rec.deck, grade, rec.name) : null,
                   openDeck: (link) => openDeck(link, built, grade) });
  const first = () => Math.max(0, rec.deck.slides.findIndex((s) => !s.hidden && forGrade(s, grade) && !(grade && s.menu)));

  const chips = el('span', { class: 'grades' },
    [null, ...GRADES].map((g) => el('button', {
      class: 'chip' + (g === grade ? ' on' : ''),
      onclick: () => { gradePick = g; showDeck(id); }
    }, g || 'All')));

  const head = el('div', { class: 'deck-head' },
    el('h2', {}, rec.name),
    chips,
    grade ? el('button', { class: 'btn quiet', onclick: () => run(0, true) }, '▦ Menu') : null,
    el('button', { class: 'btn', onclick: () => run(first()) }, '▶ Present'),
    el('button', { class: 'btn quiet', onclick: () => { location.hash = '#/deck/' + rec.id + '/edit'; } }, 'Edit'),
    el('button', { class: 'btn danger', onclick: async () => {
      if (!window.confirm('Remove "' + rec.name + '" from this device?')) return;
      await store.deleteDeck(rec.id);
      await store.pruneMedia();
      location.hash = '#/';
    } }, 'Remove'));

  const notes = [...(rec.deck.warnings || [])];
  const noIcon = missingIcons(rec.deck);
  if (noIcon.length) {
    notes.push('No song icon: ' + noIcon.map(({ s, i }) => (s.title || 'untitled') + ' (' + (i + 1) + ')').join(', ') + '.');
  }
  const songs = rec.deck.slides.filter((s) => s.song && s.song.kind === 'song' && forGrade(s, grade)).length;
  const summary = songs ? el('p', { class: 'deck-sum' }, songs + ' song slides') : null;
  const warn = notes.length ? el('div', { class: 'warn' }, notes.join(' ')) : null;

  const grid = el('div', { class: 'slides' });
  rec.deck.slides.forEach((s, i) => {
    if (!forGrade(s, grade) || (grade && s.menu)) return;
    grid.append(el('button', {
      class: 'slide-card' + (s.hidden ? ' hidden-slide' : ''), 'data-n': i,
      title: s.hidden ? 'Hidden slide (skipped when you click through)' : 'Present from here',
      onclick: () => run(i)
    }, thumb(s, rec.deck, media),
    el('div', { class: 'cap' }, el('b', {}, String(i + 1)),
      s.song && s.song.icon ? el('img', { class: 'song-icon', src: media(s.song.icon), alt: '' }) : null,
      el('span', { class: 'cap-t' }, s.title || ''),
      s.grades && s.grades.length ? el('span', { class: 'cap-g' }, s.grades.join(' ')) : null)));
  });
  main.replaceChildren(head, summary || '', warn || '', grid);
  if (startPresenting) run(first());
}

/** A category deck a built class deck links into: a slide, or its menu for the
    class's grade, with songs the plan hasn't reached yet locked. */
async function openDeck(link, built, pick) {
  const rec = await store.getDeck(link.deck);
  if (!rec) return null;
  const media = await loadMedia(rec.deck);
  const hit = { deck: rec.deck, media, deckId: rec.id, deckName: rec.name, index: link.slide || 0 };
  if (!link.menu) return hit;
  const grade = (built && built.grade) || pick;
  if (!grade) return hit;
  const locked = new Set();
  const plan = built && await store.getPlan(built.year);
  const category = plan && plan.categories.find((c) => normName(c) === normName(rec.name));
  if (category) {
    const names = plan.catalog[category].map((s) => s.name);
    const index = indexSongs(rec.deck, names);
    for (const name of names) {
      if (playCount(plan, grade, category, name, built.no) > 0) continue;
      for (const i of index.get(normName(name)) || []) locked.add(i);
    }
  }
  const lock = media(LOCK) ? LOCK : null;
  hit.menu = buildMenu(rec.deck, grade, rec.name, { locked, lock });
  return hit;
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
  main.classList.toggle('wide', location.hash.startsWith('#/plan'));
  const plan = location.hash.match(/^#\/plan(?:\/(calendar|lists))?/);
  if (plan) { showPlanner(main, plan[1] || 'plan'); return; }
  const m = location.hash.match(/^#\/deck\/([\w-]+)(?:\/(present|edit)(?:\/(\d+))?)?/);
  if (m) showDeck(m[1], m[2] === 'present', m[2] === 'edit' ? Math.max(0, (Number(m[3]) || 1) - 1) : null);
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

// Song slides take their grades from the plan's Max columns, so load it first.
store.listPlans().then((years) => {
  let want = null;
  try { want = localStorage.getItem('class.year'); } catch (e) { /* private window */ }
  store.setGradeHint(gradeHint(years.find((y) => y.year === want) || years[years.length - 1]));
}).catch(() => {}).finally(route);
