/* Class app shell: the library of decks, a deck's slides, and importing.
   Routes live in the hash: #/ is the library, #/deck/<id> is one deck,
   #/plan is the planner, #/sub sub plans. */

import { convertPptx } from './pptx.js';
import { present, MENU } from './present.js';
import { buildMenu } from './menus.js';
import { openEditor } from './editor.js';
import { el, thumb, loadMedia } from './ui.js';
import * as store from './store.js';
import { missingIcons, forGrade, taggedFor, GRADES, songSection, SECTIONS } from './marks.js';
import { showPlanner, saveBuild } from './planner.js';
import { gradeHint, normName, classAsOf, lockedSlides, indexSongs, firstClasses, readClass, schoolYear } from './plans.js';
import { makeTemplate } from './builder.js';
import * as sync from './sync.js';
import './library.js';
import { showSub, refreshSub } from './subs.js';
import { refreshSubSongs } from './subsongs.js';

const CATEGORIES = ['Vocal Warmup', 'Song Fragments', 'Simple Songs', 'Arioso', 'Movement Exploration',
  'Form and Expression', 'Beat Motions', 'Songtales'];

const LOCK = 'e8a2199e2a0d291cde34b6ad10564b06';     // the lock picture the decks' menus use
const PART_LABELS = { main: '', moveIt: 'Move It', dance: 'Dances' };

const $ = (sel) => document.querySelector(sel);
const main = $('#main');
const picker = $('#picker');
let gradePick = null;                     // the grade the deck pages show, or null for all

// ---- library ---------------------------------------------------------------

async function showLibrary() {
  document.title = 'Class · Mr. Washburn Music';
  const decks = await store.listDecks();
  if (!decks.length && sync.getStatus() === 'signin') {
    // A new device: everything is on the website, once signed in.
    main.replaceChildren(el('div', { class: 'empty' },
      el('p', {}, el('a', { class: 'btn', href: '/api/class/login' }, 'Sign in'))));
    return;
  }
  if (!decks.length && sync.getStatus() === 'syncing') {
    main.replaceChildren(el('div', { class: 'empty' }, el('h2', {}, 'Syncing…')));
    return;
  }
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
  // This week's classes, from the calendar: one each for PK, K and 1, built or not yet.
  const now = years.find((y) => y.year === schoolYear()) || await currentPlan();
  const current = [];
  if (now) for (const g of now.grades) {
    const no = classAsOf(now, g, today());
    if (!no) continue;
    const rec = decks.find((d) => d.deck.built && d.deck.built.year === now.year && d.deck.built.grade === g && d.deck.built.no === no);
    const cls = readClass(now, g, no);
    current.push(rec || { grade: g, no, slated: !!(cls && cls.songs.length) });
  }
  const sections = [
    ['This week', current],
    ['Category decks', decks.filter(isCat)],
    ['Classes', classes.filter((d) => !current.includes(d))],
    ['Other', decks.filter((d) => !isCat(d) && !isClass(d))]
  ];
  const out = [];
  for (const [title, list] of sections) {
    if (!list.length) continue;
    const grid = el('div', { class: 'decks' });
    for (const rec of list) {
      if (!rec.deck) { grid.append(placeholder(now, rec)); continue; }
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

/** A class on the calendar with no deck yet: its name and a Build button. */
function placeholder(plan, { grade, no, slated }) {
  const btn = el('button', { class: 'btn', disabled: !slated, onclick: async () => {
    btn.disabled = true;
    if (await saveBuild(plan, grade, no)) showLibrary(); else btn.disabled = false;
  } }, 'Build');
  return el('div', { class: 'deck-card to-build' },
    el('div', { class: 'thumb' }, btn),
    el('div', { class: 'meta' }, el('div', { class: 'name' }, grade + ' ' + no)));
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
  // A deck with grade tags (a category deck) shows a grade's slides only; in others (class decks)
  // untagged slides are for every grade.
  const strict = !built && rec.deck.slides.some((s) => s.grades && s.grades.length);
  const fits = (s) => (strict ? taggedFor : forGrade)(s, grade);
  const plan = await currentPlan(built);
  const menu = grade ? await gradeMenu(rec, grade, media, built, plan) : null;
  const menuFor = async (deckId, g, extra) => {
    const r = await store.getDeck(deckId);
    return r ? gradeMenu(r, g, await loadMedia(r.deck), built, plan, extra) : null;
  };
  const run = (i, wantMenu) => present(rec, wantMenu ? MENU : i, media, (at, saved) => {
    const card = main.querySelector('.slide-card[data-n="' + at + '"]');
    if (card) card.scrollIntoView({ block: 'center' });
    if (saved) saved.then(async () => {
      const now = await classTimes(rec), was = main.querySelector('.runs');
      if (was) was.replaceWith(now); else if (now) main.append(now);
    });
  }, findGoogle, { grade: grade || (built && built.grade), menu, menuFor, strict,
                   openDeck: (link) => openDeck(link, built, grade) });
  const first = () => Math.max(0, rec.deck.slides.findIndex((s) => !s.hidden && fits(s) && !(grade && s.menu)));
  // Only a deck of songs (a category deck) sorts.
  const sortable = !built && rec.deck.slides.some((s) => s.song && s.song.kind === 'song');
  const sort = sortable ? recall('sort') || 'deck' : 'deck';

  const chips = el('span', { class: 'grades' },
    [null, ...GRADES].map((g) => el('button', {
      class: 'chip' + (g === grade ? ' on' : ''),
      onclick: () => { gradePick = g; showDeck(id); }
    }, g || 'All')));

  const head = el('div', { class: 'deck-head' },
    el('h2', {}, rec.name),
    chips,
    !sortable ? null : el('select', { class: 'sort', title: 'Sort', onchange: (e) => { remember('sort', e.target.value); showDeck(id); } },
      SORTS.map(([v, label]) => el('option', { value: v, selected: v === sort }, label))),
    grade ? el('button', { class: 'btn quiet', onclick: () => run(0, true) }, '▦ Menu') : null,
    el('button', { class: 'btn', onclick: () => run(first()) }, '▶ Present'),
    el('button', { class: 'btn quiet', onclick: () => { location.hash = '#/deck/' + rec.id + '/edit'; } }, 'Edit'),
    built && plan ? el('button', { class: 'btn quiet', onclick: async (e) => {
      e.target.disabled = true;
      if (await saveBuild(plan, built.grade, built.no)) showDeck(id); else e.target.disabled = false;
    } }, 'Rebuild') : null,
    el('button', { class: 'btn danger', onclick: async () => {
      if (!window.confirm('Remove "' + rec.name + '"?')) return;
      await store.deleteDeck(rec.id);
      await store.pruneMedia();
      location.hash = '#/';
    } }, 'Remove'));

  const notes = [...(rec.deck.warnings || [])];
  const noIcon = missingIcons(rec.deck);
  if (noIcon.length) {
    notes.push('No song icon: ' + noIcon.map(({ s, i }) => (s.title || 'untitled') + ' (' + (i + 1) + ')').join(', ') + '.');
  }
  const songs = rec.deck.slides.filter((s) => s.song && s.song.kind === 'song' && fits(s)).length;
  const summary = songs ? el('p', { class: 'deck-sum' }, songs + ' song slides') : null;
  const warn = notes.length ? el('div', { class: 'warn' }, notes.join(' ')) : null;

  const grid = el('div', { class: 'slides' });
  const card = (s, i) => el('button', {
    class: 'slide-card' + (s.hidden ? ' hidden-slide' : ''), 'data-n': i,
    title: s.hidden ? 'Hidden slide (skipped when you click through)' : 'Present from here',
    onclick: () => run(i)
  }, thumb(s, rec.deck, media),
  el('div', { class: 'cap' }, el('b', {}, String(i + 1)),
    s.song && s.song.icon ? el('img', { class: 'song-icon', src: media(s.song.icon), alt: '' }) : null,
    el('span', { class: 'cap-t' }, s.title || ''),
    s.grades && s.grades.length ? el('span', { class: 'cap-g' }, s.grades.join(' ')) : null));
  // Move Its and dances sit apart from the usual songs, each under a line of its own.
  const parts = new Set(rec.deck.slides.filter((s) => s.song && s.song.kind === 'song').map(songSection));
  let part = 'main';
  const apart = (s) => {
    if (parts.size < 2 || !s.song || s.song.kind !== 'song') return;
    const p = songSection(s);
    if (p === part) return;
    part = p;
    grid.append(el('div', { class: 'slide-sep' + (p === 'main' ? ' plain' : '') }, PART_LABELS[p]));
  };
  if (sort === 'deck') {
    rec.deck.slides.forEach((s, i) => { if (fits(s) && !(grade && s.menu)) { apart(s); grid.append(card(s, i)); } });
  } else {
    // Sorted, a deck shows its songs only, each song's slides together.
    const groups = sortGroups(rec, songGroups(rec, plan, fits), sort, plan, grade);
    let dragged = null;
    for (const g of groups) {
      for (const i of g.slides) {
        apart(rec.deck.slides[i]);
        const c = card(rec.deck.slides[i], i);
        if (sort === 'custom') {
          c.draggable = true;
          c.addEventListener('dragstart', (e) => { dragged = g; e.dataTransfer.effectAllowed = 'move'; c.classList.add('dragging'); });
          c.addEventListener('dragend', () => c.classList.remove('dragging'));
          c.addEventListener('dragover', (e) => { if (dragged && dragged !== g) e.preventDefault(); });
          c.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (!dragged || dragged === g) return;
            const keys = groups.map((x) => x.key).filter((k) => k !== dragged.key);
            const r = c.getBoundingClientRect();
            const after = e.clientX > r.left + r.width / 2;
            keys.splice(keys.indexOf(g.key) + (after ? 1 : 0), 0, dragged.key);
            // Songs not in this view keep their places after these.
            const rest = (rec.deck.songOrder || []).filter((k) => !keys.includes(k));
            rec.deck.songOrder = [...keys, ...rest];
            await store.putDeck(rec);
            showDeck(id);
          });
        }
        grid.append(c);
      }
    }
  }
  main.replaceChildren(head, summary || '', warn || '', grid, built ? await classTimes(rec) : '');
  if (startPresenting) run(first());
}

/** The times kept each time this class was presented start to finish (present.js). */
async function classTimes(rec) {
  const runs = (await store.listTimings().catch(() => [])).filter((t) => t.kind === 'run' && t.deck === rec.id)
    .sort((a, b) => b.at - a.at);
  if (!runs.length) return '';
  const songs = [...new Set(runs.flatMap((r) => r.songs.map((x) => x.song)))];
  const date = (at) => new Date(at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return el('div', { class: 'runs' },
    el('h3', {}, 'Times'),
    el('table', {},
      el('tr', {}, el('th', {}, ''), ...songs.map((n) => el('th', {}, n)), el('th', {}, 'Total')),
      runs.map((r) => el('tr', {},
        el('td', {}, date(r.at)),
        ...songs.map((n) => {
          const hit = r.songs.find((x) => x.song === n);
          return el('td', {}, hit ? clock(hit.ms) : '');
        }),
        el('td', {}, clock(r.ms))))));
}

function clock(ms) {
  const t = Math.round(ms / 1000);
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
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
  hit.menu = await gradeMenu(rec, grade, media, built);
  return hit;
}

/** The year plan in use: a built class's own, or the one the planner last showed. */
async function currentPlan(built) {
  const years = await store.listPlans().catch(() => []);
  return (built ? years.find((y) => y.year === built.year)
    : years.find((y) => y.year === recall('year')) || years[years.length - 1]) || null;
}

/** A category deck's menu for a grade, with songs not reached yet locked: by a built class,
    the plan up to that class; otherwise the plan up to today's class on the calendar.
    Its songs come in the order the deck page is sorted by. */
async function gradeMenu(rec, grade, media, built, plan, extra = {}) {
  if (plan === undefined) plan = await currentPlan(built);
  const through = !plan ? null : built ? built.no : classAsOf(plan, grade, today());
  const locked = through == null ? new Set() : lockedSlides(plan, grade, rec.deck, rec.name, through);
  const lock = media(LOCK) ? LOCK : null;
  const sort = recall('sort') || 'deck';
  const order = sort === 'deck' ? null
    : sortGroups(rec, songGroups(rec, plan, () => true), sort, plan, grade).map((g) => g.slides[0]);
  return buildMenu(rec.deck, grade, rec.name, { locked, lock, order, ...extra });
}

// ---- sorting a deck's songs -------------------------------------------------

const SORTS = [['deck', 'Deck order'], ['az', 'A–Z'], ['za', 'Z–A'], ['class', 'Class order'],
  ['class-r', 'Class order, last first'], ['custom', 'Custom order']];

/** A deck's songs: { key, name, slides }, a song over several slides as one. */
function songGroups(rec, plan, fits) {
  const category = plan && plan.categories.find((c) => normName(c) === normName(rec.name));
  const names = new Map();                 // slide index -> the plan's name for its song
  const shown = new Map();                 // normName -> that name as the plan writes it
  if (category) {
    const list = (plan.catalog[category] || []).map((s) => s.name);
    for (const n of list) shown.set(normName(n), n);
    for (const [n, idx] of indexSongs(rec.deck, list)) {
      for (const i of idx) names.set(i, n);
    }
  }
  const groups = [], seen = new Map();
  let last = null;
  rec.deck.slides.forEach((s, i) => {
    if (!s.song || s.song.kind !== 'song' || !fits(s)) { last = null; return; }
    const name = s.song.name || s.title || '';
    // A song's later slides share its icon, and its title or none.
    if (last && s.song.icon === last.icon && (!normName(name) || normName(name) === normName(last.name))) {
      last.slides.push(i);
      return;
    }
    const base = normName(name) || s.song.icon || String(i);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    groups.push(last = { key: n > 1 ? base + '#' + n : base, icon: s.song.icon, slides: [i], name,
                         planned: names.get(i) || null, part: SECTIONS.indexOf(songSection(s)), label: shown.get(names.get(i)) || name });
  });
  return groups;
}

function sortGroups(rec, groups, sort, plan, grade) {
  const by = (fn) => groups.map((g, k) => ({ g, k, v: fn(g) }));
  // The usual songs, then the Move Its, then the dances, each sorted.
  const done = (list, cmp) => list.sort((a, b) => a.g.part - b.g.part || cmp(a, b) || a.k - b.k).map((x) => x.g);
  if (sort === 'az' || sort === 'za') {
    const dir = sort === 'az' ? 1 : -1;
    return done(by((g) => g.label.trim()), (a, b) => dir * a.v.localeCompare(b.v, undefined, { numeric: true, sensitivity: 'base' }));
  }
  if (sort === 'class' || sort === 'class-r') {
    // Songs the plan doesn't slate come last either way.
    const first = firstClasses(plan, rec.name, grade);
    const dir = sort === 'class' ? 1 : -1;
    return done(by((g) => g.planned != null && first.has(g.planned) ? first.get(g.planned) : null),
      (a, b) => (a.v == null) - (b.v == null) || (a.v == null ? 0 : dir * (a.v - b.v)));
  }
  if (sort === 'custom') {
    const order = rec.deck.songOrder || [];
    const at = (g) => { const k = order.indexOf(g.key); return k < 0 ? 1e9 : k; };
    return done(by(at), (a, b) => a.v - b.v);
  }
  return groups;
}

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
  const here = location.hash.match(/^#\/(plan\/calendar|plan\/lists|plan|sub)?/);
  for (const a of $('#views').children) a.classList.toggle('on', a.getAttribute('href') === '#/' + ((here && here[1]) || ''));
  const plan = location.hash.match(/^#\/plan(?:\/(calendar|lists))?/);
  if (plan) { showPlanner(main, plan[1] || 'plan'); return; }
  if (location.hash.startsWith('#/sub')) { showSub(main); return; }
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

// Sync with the website: the cloud in the header shows how it went.
const cloud = $('#sync');
const LOOK = { signin: ['Sign in', 'Sign in'], syncing: ['☁', 'Syncing…'], ok: ['☁', 'Synced'],
  offline: ['☁', 'Offline'], error: ['☁', 'Sync failed'] };
sync.onStatus((s, detail) => {
  cloud.hidden = s === 'off';
  // An empty library waits on sync: show sign in, syncing, or what came down.
  if (main.querySelector(':scope > .empty') && !location.hash.startsWith('#/sub')) route();
  if (s === 'ok') refreshSub();
  if (s === 'off') return;
  const [text, title] = LOOK[s];
  cloud.textContent = text;
  cloud.title = detail ? title + ': ' + detail : title;
  cloud.className = 'sync ' + s + (s === 'signin' ? ' btn quiet' : '');
  if (s === 'signin') cloud.href = '/api/class/login'; else cloud.removeAttribute('href');
});
cloud.addEventListener('click', (e) => { if (sync.getStatus() !== 'signin') { e.preventDefault(); sync.syncNow(); } });
// The deck open in the editor is never swapped out under it.
sync.holdWhile(() => {
  const m = location.hash.match(/^#\/deck\/([\w-]+)\/edit/);
  return m ? [m[1]] : [];
});
// Show what came down, unless it would pull the page out from under someone.
sync.onPulled((list) => {
  if (/\/(edit|present)/.test(location.hash) || document.querySelector('.present')) return;
  const a = document.activeElement;
  if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && main.contains(a)) return;
  const m = location.hash.match(/^#\/deck\/([\w-]+)/);
  if (m && !list.some((x) => x.kind === 'decks' && x.id === m[1])) return;
  // A new plan changes the songs' grades: take it in before redrawing.
  const hinted = list.some((x) => x.kind === 'plans')
    ? store.listPlans().then((years) => store.setGradeHint(gradeHint(years.find((y) => y.year === recall('year')) || years[years.length - 1])))
    : Promise.resolve();
  hinted.catch(() => {}).then(() => route());
});

function recall(k) { try { return localStorage.getItem('class.' + k); } catch (e) { return null; } }
function remember(k, v) { try { localStorage.setItem('class.' + k, v); } catch (e) { /* private window */ } }

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Song slides take their grades from the plan's Max columns, so load it first.
store.purgeTimings().catch(() => {});
store.listPlans().then((years) => {
  store.setGradeHint(gradeHint(years.find((y) => y.year === recall('year')) || years[years.length - 1]));
  // The sub songs' unlock dates follow the plan and calendar.
  return refreshSubSongs(years.find((y) => y.year === schoolYear()) || years[years.length - 1]);
}).catch(() => {}).finally(() => { route(); sync.syncNow(); });
