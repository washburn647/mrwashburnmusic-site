/* The radio's station library in the studio (see /radio/).
   - Every station a listener can add from the radio's Stations sheet, by genre.
   - ★ makes a station one of Kyle's picks: picks are on every listener's dial the first time
     they open the radio after it's published (one they take off stays off), and listed first.
   - Dial is where the station sits on the dial (MHz); left empty, the radio picks a free spot.
   - Kept on this device as a draft; "Publish to site" puts it on the radio right away
     (/api/live/radio.json, see worker/index.js), and "Download" saves stations.json, the same
     file tools/pull_live.py writes to radio/stations.json.
   The studio's own page can't play outside streams (its Content-Security-Policy), so Listen
   opens the stream in a new tab. */

import { h, confirmButton } from '../dom.js';

const app = document.getElementById('app');
const DRAFT_KEY = 'studio-radio-draft';
const TAB_KEY = 'studio-radio-tab';
const PICKS = '★', ALL = '';
const LO = 87.5, HI = 108;

let site = null;     // what is on the site now
let draft = null;    // what is being edited
let status = '';
let tab = load(TAB_KEY) ?? PICKS;
let fresh = null;    // id of a station just added, to focus its name

function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function save(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
const clone = (o) => JSON.parse(JSON.stringify(o));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* The file as the radio reads it: genres in their order, then any new ones, and only those in use. */
function packed(d) {
  const used = [...new Set(d.stations.map((s) => s.genre.trim()).filter(Boolean))];
  const genres = [...d.genres.filter((g) => used.includes(g)), ...used.filter((g) => !d.genres.includes(g))];
  const ids = new Set(d.stations.map((s) => s.id));
  const stations = d.stations.map((s) => {
    const o = { id: s.id, name: s.name.trim() };
    if (s.freq !== '' && s.freq != null) o.freq = Math.round(Number(s.freq) * 10) / 10;
    o.where = s.where.trim();
    o.genre = s.genre.trim();
    o.url = s.url.trim();
    return o;
  });
  return { genres, picks: d.picks.filter((id) => ids.has(id)), stations };
}
function unpacked(c) {
  return {
    genres: [...(c.genres || [])],
    picks: [...(c.picks || [])],
    stations: (c.stations || []).map((s) => ({ id: s.id, name: s.name || '', freq: s.freq ?? '', where: s.where || '', genre: s.genre || '', url: s.url || '' }))
  };
}
const keep = () => save(DRAFT_KEY, same(packed(draft), packed(site)) ? null : JSON.stringify(draft));

/* What is wrong with a station, or ''. The Worker checks the same before it publishes. */
function problem(s) {
  if (!s.name.trim()) return 'Needs a name';
  let u;
  try { u = new URL(s.url.trim()); } catch (e) { return 'Needs a link'; }
  if (u.protocol !== 'https:') return 'The link must start with https://';
  if (s.freq !== '' && s.freq != null && !(Number(s.freq) >= LO && Number(s.freq) <= HI)) return `Dial goes from ${LO} to ${HI}`;
  return '';
}
function clash(s) {
  if (s.freq === '' || s.freq == null) return null;
  return draft.stations.find((o) => o !== s && o.freq !== '' && o.freq != null &&
    draft.picks.includes(o.id) && draft.picks.includes(s.id) && Math.abs(Number(o.freq) - Number(s.freq)) < 0.15) || null;
}

async function start() {
  let c = null;
  for (const u of ['/api/live/radio.json', '/radio/stations.json']) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (r.ok) { c = await r.json(); break; }
    } catch (e) {}
  }
  site = unpacked(c || {});
  let mine = null;
  try { mine = JSON.parse(load(DRAFT_KEY) || 'null'); } catch (e) {}
  draft = mine && Array.isArray(mine.stations) ? mine : clone(site);
  render();
}

async function publish() {
  const body = packed(draft);
  status = 'Publishing…';
  render();
  try {
    const r = await fetch('/studio/api/live/radio', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) {
      let why = '';
      try { why = (await r.json()).error || ''; } catch (e) {}
      throw new Error(r.status === 401 ? 'Sign in again' : `Could not publish (${why || r.status})`);
    }
    site = unpacked(body);
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
  const a = h('a', { href: URL.createObjectURL(blob), download: 'stations.json' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function changed() { keep(); status = ''; render(); }

function addStation() {
  const id = 'k' + Date.now().toString(36);
  const genre = tab && tab !== PICKS ? tab : '';
  draft.stations.push({ id, name: '', freq: '', where: '', genre, url: '' });
  if (tab === PICKS) draft.picks.push(id);
  fresh = id;
  changed();
}

function togglePick(s) {
  const i = draft.picks.indexOf(s.id);
  if (i < 0) draft.picks.push(s.id); else draft.picks.splice(i, 1);
  changed();
}

function field(s, key, props) {
  const el = h('input', {
    value: s[key] ?? '', 'aria-label': `${props.label}, ${s.name || 'new station'}`, placeholder: props.placeholder || '',
    type: props.type || 'text', inputmode: props.inputmode, step: props.step, min: props.min, max: props.max,
    spellcheck: props.type === 'url' ? false : undefined,
    onchange: (e) => { s[key] = e.target.value; changed(); }
  });
  if (props.list) el.setAttribute('list', props.list);   // a read-only property, so h() can't set it
  return el;
}

function rowFor(s) {
  const picked = draft.picks.includes(s.id);
  const bad = problem(s);
  const near = clash(s);
  const ok = !bad && s.url.trim();
  return h('tr', { class: bad ? 'bad' : '' },
    h('td', { class: 'star' }, h('button', {
      class: 'icon pick' + (picked ? ' on' : ''), 'aria-pressed': String(picked),
      'aria-label': `Kyle’s pick, ${s.name || 'new station'}`, title: 'Kyle’s pick', onclick: () => togglePick(s)
    }, picked ? '★' : '☆')),
    h('td', { class: 'name', 'data-label': 'Name' }, field(s, 'name', { label: 'Name', placeholder: 'Name' }),
      bad ? h('small', { class: 'why' }, bad) : near ? h('small', { class: 'why soft' }, `Same spot as ${near.name}`) : null),
    h('td', { class: 'freq', 'data-label': 'Dial' }, field(s, 'freq', { label: 'Dial', type: 'number', inputmode: 'decimal', step: 0.1, min: LO, max: HI, placeholder: 'auto' })),
    h('td', { class: 'where', 'data-label': 'Where' }, field(s, 'where', { label: 'Where', placeholder: 'City or network' })),
    h('td', { class: 'genre', 'data-label': 'Genre' }, field(s, 'genre', { label: 'Genre', list: 'genre-list' })),
    h('td', { class: 'url', 'data-label': 'Link' }, field(s, 'url', { label: 'Link', type: 'url', placeholder: 'https://' })),
    h('td', { class: 'tools' },
      ok ? h('a', { class: 'listen', href: s.url.trim(), target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Listen to ${s.name}`, title: 'Listen' }, '▶') : null,
      confirmButton('Delete', 'Delete it?', () => {
        draft.stations = draft.stations.filter((x) => x !== s);
        draft.picks = draft.picks.filter((id) => id !== s.id);
        changed();
      })));
}

function render() {
  const focus = document.activeElement && document.activeElement.getAttribute('aria-label');
  const top = [h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '← Studio'), h('h1', {}, 'Radio stations'),
    h('span', { class: 'grow' }), h('a', { class: 'back', href: '/radio/', target: '_blank', rel: 'noopener' }, 'Open the radio ↗'))];
  if (!draft) { app.replaceChildren(...top, h('p', { class: 'status' }, 'Loading…')); return; }

  const pending = !same(packed(draft), packed(site));
  const bad = draft.stations.filter(problem).length;
  const genres = packed(draft).genres;
  if (tab !== PICKS && tab !== ALL && !genres.includes(tab)) tab = PICKS;
  const count = (g) => draft.stations.filter((s) => s.genre.trim() === g).length;
  const pick = (id, name, n) => h('button', { class: tab === id ? 'on' : '', onclick: () => { tab = id; save(TAB_KEY, id); render(); } },
    name, h('span', { class: 'n' }, String(n)));

  let list;
  if (tab === PICKS) {
    const byId = new Map(draft.stations.map((s) => [s.id, s]));
    list = draft.picks.map((id) => byId.get(id)).filter(Boolean);
  } else if (tab === ALL) {
    list = draft.stations;
  } else {
    list = draft.stations.filter((s) => s.genre.trim() === tab);
  }

  app.replaceChildren(...top,
    h('div', { class: 'bar' },
      h('button', { class: 'primary', disabled: !pending || bad > 0, onclick: publish }, 'Publish to site'),
      pending ? h('button', { onclick: () => { draft = clone(site); changed(); } }, 'Discard changes') : null,
      h('button', { onclick: download }, 'Download')),
    h('p', { class: 'status' + (pending ? ' draft' : '') + (bad ? ' bad' : '') },
      status || (bad ? `${bad} ${bad === 1 ? 'station needs' : 'stations need'} fixing` : pending ? 'Not published yet' : '')),
    h('div', { class: 'seg tabs' },
      pick(PICKS, '★ Kyle’s picks', draft.picks.filter((id) => draft.stations.some((s) => s.id === id)).length),
      pick(ALL, 'All', draft.stations.length),
      genres.map((g) => pick(g, g, count(g)))),
    h('datalist', { id: 'genre-list' }, genres.map((g) => h('option', { value: g }))),
    h('table', { class: 'stations' },
      h('thead', {}, h('tr', {}, ['', 'Name', 'Dial', 'Where', 'Genre', 'Link', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, list.map(rowFor))),
    list.length ? null : h('p', { class: 'status' }, tab === PICKS ? 'No picks yet. Star a station to make it one.' : 'No stations here yet.'),
    h('button', { class: 'add', onclick: addStation }, '+ Station'));

  const want = fresh ? `Name, new station` : focus;
  fresh = null;
  if (want) {
    const el = [...app.querySelectorAll('[aria-label]')].find((x) => x.getAttribute('aria-label') === want);
    if (el) el.focus();
  }
}

render();
start();
