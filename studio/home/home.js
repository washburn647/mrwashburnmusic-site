/* The homepage (/home/) in the studio.
   - Question: the first thing a visitor sees, and the two buttons.
   - Kids and Grown-ups: each side's headline, line under it, the button to the other side, and
     its menu: notes on a staff, in order, each a place, a pitch and a length (for the tune).
   - Places: everything a note can point to. A place with a link is open; without one it says
     "Coming soon". Links stay on this site's public pages (the Worker checks the same).
   - Photos: which of the photos in /home/photos/ show behind the top, in order, and which part
     of each stays in view.
   Kept on this device as a draft ("Preview draft" shows it on the homepage, in this browser only);
   "Publish to site" puts it on the homepage right away (/api/live/home.json, see worker/index.js),
   and "Download" saves home.json, the same file tools/pull_live.py writes to home/home.json. */

import { h, confirmButton } from '../dom.js';

const app = document.getElementById('app');
const DRAFT_KEY = 'studio-home-draft';   // /home/?preview reads this too
const TAB_KEY = 'studio-home-tab';
const TABS = [['kids', 'Kids'], ['grownups', 'Grown-ups'], ['places', 'Places'], ['photos', 'Photos'], ['question', 'Question']];
const PAGES = ['/songburner/', '/radio/', '/musician-maker/', '/museum/', '/lesson/'];
const PRIVATE = /^\/(studio|class|sub|api|songburner\/account)(\/|$)/;

/* Pitches, from the A below the staff (n = -3) to the B above it (n = 10). n 0 is the bottom line, E. */
const LETTERS = ['E', 'F', 'G', 'A', 'B', 'C', 'D'];
const COLORS = ['#E0A800', '#5E9E2E', '#0E9384', '#6B4FA8', '#D2468C', '#DC3B30', '#EC7F1A'];
const SEMITONES = [0, 1, 3, 5, 7, 8, 10];
const mod7 = (n) => ((n % 7) + 7) % 7;
const pitchName = (n) => {
  const octave = 4 + Math.floor((n + 2) / 7);
  const where = n >= 0 && n <= 8 ? (n % 2 ? ' · space' : ' · line') : '';
  return `${LETTERS[mod7(n)]}${octave}${where}`;
};
const PITCHES = [...Array(14).keys()].map((i) => i - 3).reverse();
const BEATS = [[0.5, '½ beat'], [1, '1 beat'], [1.5, '1½ beats'], [2, '2 beats']];

let site = null;      // what is on the site now
let draft = null;     // what is being edited
let files = [];       // photos in /home/photos/
let status = '';
let tab = load(TAB_KEY) || 'kids';

function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function save(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
const clone = (o) => JSON.parse(JSON.stringify(o));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keep = () => save(DRAFT_KEY, same(draft, site) ? null : JSON.stringify(draft));

/* ---------- Sound, to hear a note or the tune ---------- */

let audio = null;
function ring(n, delay = 0, length = 0.8) {
  try { audio ||= new AudioContext(); if (audio.state === 'suspended') audio.resume(); } catch (e) { return; }
  const t = audio.currentTime + delay;
  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  g.connect(audio.destination);
  const o = audio.createOscillator();
  o.type = 'triangle';
  o.frequency.value = 329.63 * 2 ** ((SEMITONES[mod7(n)] + 12 * Math.floor(n / 7)) / 12);
  o.connect(g);
  o.start(t);
  o.stop(t + length + 0.05);
}
function playTune(notes) {
  let at = 0.05;
  for (const x of notes) { ring(x.n, at, Math.max(0.5, x.beats * 0.86)); at += x.beats * 0.48; }
}

/* ---------- What is wrong, or '' (the Worker checks the same) ---------- */

function badLink(v) {
  const s = (v || '').trim();
  if (!s) return '';
  if (!s.startsWith('/') || s.startsWith('//') || /[\s\\]/.test(s)) return 'Links start with / (a page on this site)';
  if (PRIVATE.test(s)) return 'That page is private';
  return '';
}
function placeProblem(p) {
  if (!p.name.trim()) return 'Needs a name';
  return badLink(p.href) || badLink(p.extraHref) || ((p.extraHref || '').trim() && !(p.extraLabel || '').trim() ? 'The second button needs words' : '');
}

/* ---------- Load, publish, download ---------- */

async function start() {
  let c = null;
  for (const u of ['/api/live/home.json', '/home/home.json']) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (r.ok) { c = await r.json(); break; }
    } catch (e) {}
  }
  try { files = (await (await fetch('/home/photos/photos.json', { cache: 'no-store' })).json()).files || []; } catch (e) {}
  site = normal(c || {});
  let mine = null;
  try { mine = JSON.parse(load(DRAFT_KEY) || 'null'); } catch (e) {}
  draft = mine && Array.isArray(mine.places) ? normal(mine) : clone(site);
  render();
}

function normal(c) {
  const side = (s) => ({ headline: s?.headline || '', lede: s?.lede || '', switch: s?.switch || '', notes: (s?.notes || []).map((x) => ({ place: x.place, n: Number(x.n) || 0, beats: Number(x.beats) || 1 })) });
  return {
    question: c.question || '', kidButton: c.kidButton || '', grownButton: c.grownButton || '', sign: c.sign || '',
    places: (c.places || []).map((p) => ({ id: p.id, name: p.name || '', about: p.about || '', href: p.href || '', extraLabel: p.extraLabel || '', extraHref: p.extraHref || '' })),
    kids: side(c.kids), grownups: side(c.grownups),
    photos: (c.photos || []).map((p) => ({ file: p.file, y: Number(p.y) || 0 }))
  };
}

/* The file as the homepage reads it: empty fields left out. */
function packed(d) {
  const places = d.places.map((p) => {
    const o = { id: p.id, name: p.name.trim(), about: p.about.trim() };
    if (p.href.trim()) o.href = p.href.trim();
    if (p.extraHref.trim()) { o.extraLabel = p.extraLabel.trim(); o.extraHref = p.extraHref.trim(); }
    return o;
  });
  const ids = new Set(places.map((p) => p.id));
  const side = (s) => ({ headline: s.headline.trim(), lede: s.lede.trim(), switch: s.switch.trim(), notes: s.notes.filter((x) => ids.has(x.place)) });
  return { question: d.question.trim(), kidButton: d.kidButton.trim(), grownButton: d.grownButton.trim(), sign: d.sign.trim(),
    places, kids: side(d.kids), grownups: side(d.grownups), photos: d.photos };
}

async function publish() {
  const body = packed(draft);
  status = 'Publishing…';
  render();
  try {
    const r = await fetch('/studio/api/live/home', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) {
      let why = '';
      try { why = (await r.json()).error || ''; } catch (e) {}
      throw new Error(r.status === 401 ? 'Sign in again' : `Could not publish (${why || r.status})`);
    }
    site = normal(body);
    draft = clone(site);
    keep();
    status = 'Published';
  } catch (e) {
    status = e.message;
  }
  render();
}

function download() {
  const blob = new Blob([JSON.stringify(packed(draft), null, 1) + '\n'], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'home.json' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function changed() { keep(); status = ''; render(); }

/* ---------- Pieces ---------- */

function text(obj, key, label, props = {}) {
  return h('label', {}, label, h('input', {
    value: obj[key] || '', placeholder: props.placeholder || '', 'aria-label': label,
    onchange: (e) => { obj[key] = e.target.value; changed(); }
  }));
}

function cellInput(obj, key, label, props = {}) {
  const el = h('input', {
    value: obj[key] || '', placeholder: props.placeholder || '', 'aria-label': label, spellcheck: props.link ? false : undefined,
    onchange: (e) => { obj[key] = e.target.value; changed(); }
  });
  if (props.link) el.setAttribute('list', 'pages');
  return el;
}

function move(list, i, by) {
  const j = i + by;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  changed();
}

function sideTab(key) {
  const s = draft[key];
  const byId = new Map(draft.places.map((p) => [p.id, p]));
  const rows = s.notes.map((x, i) => {
    const p = byId.get(x.place);
    const open = p && p.href.trim();
    return h('tr', {},
      h('td', { class: 'move' },
        h('button', { class: 'icon', 'aria-label': `Move ${p?.name || 'note'} earlier`, disabled: i === 0, onclick: () => move(s.notes, i, -1) }, '▲'),
        h('button', { class: 'icon', 'aria-label': `Move ${p?.name || 'note'} later`, disabled: i === s.notes.length - 1, onclick: () => move(s.notes, i, 1) }, '▼')),
      h('td', { 'data-label': 'Place' },
        h('span', { class: 'dot' + (open ? '' : ' soon'), style: `background:${COLORS[mod7(x.n)]};color:${COLORS[mod7(x.n)]}` }),
        h('select', { 'aria-label': `Place ${i + 1}`, onchange: (e) => { x.place = e.target.value; changed(); } },
          draft.places.map((q) => h('option', { value: q.id, selected: q.id === x.place }, q.name || '(no name)')))),
      h('td', { class: 'pitch', 'data-label': 'Pitch' },
        h('select', { 'aria-label': `Pitch ${i + 1}`, onchange: (e) => { x.n = Number(e.target.value); ring(x.n); changed(); } },
          PITCHES.map((n) => h('option', { value: n, selected: n === x.n }, pitchName(n))))),
      h('td', { class: 'beats', 'data-label': 'Length' },
        h('select', { 'aria-label': `Length ${i + 1}`, onchange: (e) => { x.beats = Number(e.target.value); changed(); } },
          BEATS.map(([b, l]) => h('option', { value: b, selected: b === x.beats }, l)))),
      h('td', { class: 'tools' },
        h('button', { class: 'icon', 'aria-label': `Play ${p?.name || 'note'}`, title: 'Play', onclick: () => ring(x.n) }, '♪'),
        h('button', { class: 'danger', onclick: () => { s.notes.splice(i, 1); changed(); } }, 'Remove')));
  });
  const unused = draft.places.find((p) => !s.notes.some((x) => x.place === p.id));
  return [
    h('div', { class: 'form' },
      text(s, 'headline', 'Headline'),
      text(s, 'lede', 'Line under it', { placeholder: '(none)' }),
      text(s, 'switch', key === 'kids' ? 'Button to the grown-ups’ side' : 'Button to the kids’ side')),
    h('h2', {}, 'Menu'),
    h('p', { class: 'hint' }, 'The notes on the staff, left to right. The tune plays them in this order.'),
    h('table', { class: 'notes' },
      h('thead', {}, h('tr', {}, ['', 'Place', 'Pitch', 'Length', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows)),
    h('div', { class: 'bar' },
      h('button', { class: 'add', disabled: !draft.places.length, onclick: () => {
        const last = s.notes.at(-1);
        s.notes.push({ place: (unused || draft.places[0]).id, n: last ? last.n : 4, beats: 1 });
        changed();
      } }, '+ Note'),
      h('button', { disabled: !s.notes.length, onclick: () => playTune(s.notes) }, '▶ Play the tune'))
  ];
}

function placesTab() {
  const used = (id) => [['kids', 'Kids'], ['grownups', 'Grown-ups']].filter(([k]) => draft[k].notes.some((x) => x.place === id)).map(([, l]) => l).join(', ');
  return [
    h('p', { class: 'hint' }, 'A place with a link is open. Without one it says “Coming soon”.'),
    h('table', { class: 'stations places' },
      h('thead', {}, h('tr', {}, ['Name', 'Mouse-over text', 'Link', 'Second button', 'Its link', 'On', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, draft.places.map((p) => {
        const bad = placeProblem(p);
        return h('tr', { class: bad ? 'bad' : '' },
          h('td', { 'data-label': 'Name' }, cellInput(p, 'name', `Name, ${p.name || 'new place'}`, { placeholder: 'Name' }), bad ? h('small', { class: 'why' }, bad) : null),
          h('td', { 'data-label': 'Mouse-over text' }, cellInput(p, 'about', `Mouse-over text, ${p.name}`)),
          h('td', { 'data-label': 'Link' }, cellInput(p, 'href', `Link, ${p.name}`, { placeholder: 'Coming soon', link: true })),
          h('td', { 'data-label': 'Second button' }, cellInput(p, 'extraLabel', `Second button, ${p.name}`, { placeholder: '(none)' })),
          h('td', { 'data-label': 'Its link' }, cellInput(p, 'extraHref', `Second button's link, ${p.name}`, { link: true })),
          h('td', { class: 'used', 'data-label': 'On' }, used(p.id) || '—'),
          h('td', { class: 'tools' }, confirmButton('Delete', 'Delete it?', () => {
            draft.places = draft.places.filter((x) => x !== p);
            for (const k of ['kids', 'grownups']) draft[k].notes = draft[k].notes.filter((x) => x.place !== p.id);
            changed();
          })));
      }))),
    h('button', { class: 'add', onclick: () => { draft.places.push({ id: 'p' + Date.now().toString(36), name: '', about: '', href: '', extraLabel: '', extraHref: '' }); changed(); } }, '+ Place')
  ];
}

function photosTab() {
  const shown = draft.photos;
  const all = [...shown.map((p) => p.file), ...files.filter((f) => !shown.some((p) => p.file === f))];
  return [
    h('p', { class: 'hint' }, 'Photos show behind the top of the homepage, one at a time, in this order. New photos are added to the site’s files first.'),
    h('ul', { class: 'photos' }, all.map((file) => {
      const i = shown.findIndex((p) => p.file === file);
      const p = shown[i];
      const thumb = h('img', { class: 'thumb', src: `/home/photos/${file}`, alt: '' });
      if (p) thumb.style.objectPosition = `50% ${p.y}%`;
      return h('li', { class: p ? '' : 'off' },
        thumb,
        h('div', { class: 'ctl' },
          h('strong', {}, file),
          p ? (() => {
            const where = (y) => (y <= 20 ? 'top' : y >= 80 ? 'bottom' : 'middle');
            const word = h('span', {}, where(p.y));
            return h('label', { class: 'row' }, 'Show the', h('input', {
              type: 'range', min: 0, max: 100, step: 5, value: p.y, 'aria-label': `Which part of ${file} shows`,
              oninput: (e) => { p.y = Number(e.target.value); thumb.style.objectPosition = `50% ${p.y}%`; word.textContent = where(p.y); },
              onchange: changed
            }), word);
          })() : null),
        h('div', { class: 'row' },
          p ? h('button', { class: 'icon', 'aria-label': `Move ${file} earlier`, disabled: i === 0, onclick: () => move(shown, i, -1) }, '▲') : null,
          p ? h('button', { class: 'icon', 'aria-label': `Move ${file} later`, disabled: i === shown.length - 1, onclick: () => move(shown, i, 1) }, '▼') : null,
          p ? h('button', { onclick: () => { shown.splice(i, 1); changed(); } }, 'Hide')
            : h('button', { onclick: () => { shown.push({ file, y: 20 }); changed(); } }, 'Show')));
    }))
  ];
}

function questionTab() {
  return [h('div', { class: 'form' },
    text(draft, 'question', 'Question'),
    text(draft, 'kidButton', 'Kid button'),
    text(draft, 'grownButton', 'Grown-up button'),
    text(draft, 'sign', 'Sign above the menu', { placeholder: '(none)' }))];
}

/* ---------- The page ---------- */

function render() {
  const focus = document.activeElement && document.activeElement.getAttribute('aria-label');
  const top = [h('div', { class: 'bar' }, h('h1', {}, 'Homepage'),
    h('span', { class: 'grow' }), h('a', { class: 'back', href: '/home/', target: '_blank', rel: 'noopener' }, 'Open the homepage ↗'))];
  if (!draft) { app.replaceChildren(...top, h('p', { class: 'status' }, 'Loading…')); return; }

  const pending = !same(draft, site);
  const bad = draft.places.filter(placeProblem).length;
  const body = tab === 'places' ? placesTab() : tab === 'photos' ? photosTab() : tab === 'question' ? questionTab() : sideTab(tab === 'grownups' ? 'grownups' : 'kids');

  app.replaceChildren(...top,
    h('div', { class: 'bar' },
      h('button', { class: 'primary', disabled: !pending || bad > 0, onclick: publish }, 'Publish to site'),
      pending ? h('a', { class: 'back', href: `/home/?preview#${tab === 'grownups' ? 'grownups' : 'kids'}`, target: '_blank', rel: 'noopener' }, 'Preview draft ↗') : null,
      pending ? h('button', { onclick: () => { draft = clone(site); changed(); } }, 'Discard changes') : null,
      h('button', { onclick: download }, 'Download')),
    h('p', { class: 'status' + (pending ? ' draft' : '') + (bad ? ' bad' : '') },
      status || (bad ? `${bad} ${bad === 1 ? 'place needs' : 'places need'} fixing` : pending ? 'Not published yet' : '')),
    h('div', { class: 'seg tabs' }, TABS.map(([id, name]) => h('button', { class: tab === id ? 'on' : '', onclick: () => { tab = id; save(TAB_KEY, id); render(); } }, name))),
    h('datalist', { id: 'pages' }, PAGES.map((p) => h('option', { value: p }))),
    ...body);

  if (focus) {
    const el = [...app.querySelectorAll('[aria-label]')].find((x) => x.getAttribute('aria-label') === focus);
    if (el) el.focus();
  }
}

render();
start();
