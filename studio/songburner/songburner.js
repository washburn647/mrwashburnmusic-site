/* Song Burner in the studio.
   - Testers: who has signed in to the beta and how much they use it, from the roster the Worker
     keeps (/studio/api/songburner/users, see worker/index.js). Counts only: no songs or scores.
     Remove deletes a tester's cloud copy and signs them out everywhere.
   - Defaults: the settings every tester starts from. A tester's own changes still win; what they
     never changed follows these. Built from Song Burner's own rules (/songburner/engine.js), so
     the ranges and dials are the app's. Kept on this device as a draft; Publish puts only what
     differs from the built-in values on the site (/api/live/songburner.json).
   - Songbook: open Kyle's songbook doc and copy songs into it (songbook.js). The public app
     does not show these. */

import { h, confirmButton } from '../dom.js';
import { songbook } from './songbook.js';

const app = document.getElementById('app');
const R = window.SongBurnerEngine({}).settings;
const BUILT = R.builtIn();
const DRAFT_KEY = 'studio-songburner-defaults';
const TAB_KEY = 'studio-songburner-tab';

const LEVELS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']];
const GAMES = R.modes.filter((m) => m.kind === 'game');
const QUIZZES = R.modes.filter((m) => m.kind === 'quiz');
const KINDS = {
  altered: 'This song, altered', other: 'Another song', place: 'This song, wrong place',
  alteredOther: 'Another song, altered', own: 'Words from this song', otherW: 'Words from other songs'
};
const MEDALS = [['bronze', 'Bronze'], ['silver', 'Silver'], ['gold', 'Gold'], ['platinum', 'Platinum']];

let tab = load(TAB_KEY) || 'users';
let site = null;            // the published defaults, full
let draft = null;           // what is being edited, full
let status = '';
let gameId = GAMES[0].id;
let users = null, usersErr = '', now = Date.now();
let requests = [];

function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function save(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
const clone = (o) => JSON.parse(JSON.stringify(o));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keep = () => save(DRAFT_KEY, same(draft, site) ? null : JSON.stringify(R.diff(draft, BUILT)));

/* ---------- testers ---------- */

const DAY = 86400e3;
function ago(t) {
  if (!t) return '–';
  const days = Math.floor(now / DAY) - Math.floor(t / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function week(u) {
  const today = Math.floor(now / DAY);
  let n = 0;
  for (const [d, c] of Object.entries(u.days || {})) if (Number(d) > today - 7) n += c;
  return n;
}
const size = (b) => !b ? '–' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

async function loadUsers() {
  try {
    const r = await fetch('/studio/api/songburner/users', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status === 401 ? 'Sign in again' : `Could not load (${r.status})`);
    const d = await r.json();
    users = d.users;
    now = d.now || Date.now();
    usersErr = '';
  } catch (e) {
    usersErr = e.message;
  }
  render();
}

/* Beta requests from the app's Apply for beta. Add the address to the Access policy, then Done. */
async function loadRequests() {
  try {
    const r = await fetch('/studio/api/songburner/requests', { cache: 'no-store' });
    if (r.ok) requests = (await r.json()).requests || [];
  } catch (e) {}
  render();
}

async function dropRequest(q) {
  const r = await fetch(`/studio/api/songburner/requests/${q.id}`, { method: 'DELETE' });
  if (r.ok) requests = requests.filter((x) => x.id !== q.id);
  render();
}

function requestsView() {
  if (!requests.length) return null;
  const list = requests.slice().sort((a, b) => a.at - b.at);
  return h('div', { class: 'card' }, h('h2', {}, `Waiting to join (${list.length})`),
    list.map((q) => h('div', { class: 'req-row' },
      h('span', { class: 'req-mail' }, q.email),
      h('span', { class: 'quiet' }, ago(q.at)),
      h('button', { onclick: (e) => { navigator.clipboard.writeText(q.email).then(() => { e.target.textContent = 'Copied'; }, () => {}); } }, 'Copy'),
      h('button', { onclick: () => dropRequest(q) }, 'Done'))));
}

async function remove(u) {
  const r = await fetch(`/studio/api/songburner/users/${u.id}`, { method: 'DELETE' });
  if (!r.ok) { usersErr = `Could not remove (${r.status})`; render(); return; }
  users = users.filter((x) => x.id !== u.id);
  render();
}

function usersView() {
  if (usersErr) return [requestsView(), h('p', { class: 'status bad' }, usersErr)];
  if (!users) return [requestsView(), h('p', { class: 'status' }, 'Loading…')];
  const list = users.slice().sort((a, b) => (b.seen || 0) - (a.seen || 0));
  const active = list.filter((u) => week(u) > 0).length;
  const box = (n, label) => h('div', { class: 'total-box' }, h('b', {}, String(n)), h('span', {}, label));
  const cell = (label, text, cls) => h('td', { 'data-label': label, class: cls }, text);
  return [
    requestsView(),
    h('div', { class: 'totals' },
      box(list.length, 'Testers'),
      box(active, 'Practiced this week'),
      box(list.reduce((n, u) => n + (u.songs || 0), 0), 'Songs'),
      box(list.reduce((n, u) => n + week(u), 0), 'Runs this week')),
    list.length ? h('table', { class: 'users' },
      h('thead', {}, h('tr', {}, ['Tester', 'Songs', 'Runs this week', 'Runs', 'Last practiced', 'Last seen', 'Since', 'Cloud', '']
        .map((t, i) => h('th', { class: i && i < 4 ? 'n' : '' }, t)))),
      h('tbody', {}, list.map((u) => h('tr', {},
        cell('', u.email || u.id.slice(0, 12)),
        cell('Songs', String(u.songs || 0), 'n'),
        cell('Runs this week', String(week(u)), 'n'),
        cell('Runs', String(u.runs || 0), 'n'),
        cell('Last practiced', ago(u.lastRun)),
        cell('Last seen', ago(u.seen)),
        cell('Since', ago(u.first), 'quiet'),
        cell('Cloud', size(u.bytes), 'quiet'),
        h('td', {}, confirmButton('Remove', 'Delete their cloud copy?', () => remove(u)))))))
      : null
  ];
}

/* ---------- defaults ---------- */

async function loadDefaults() {
  let published = null;
  try {
    const r = await fetch('/api/live/songburner.json', { cache: 'no-store' });
    if (r.ok) published = await r.json();
  } catch (e) {}
  site = R.from(published);
  let mine = null;
  try { mine = JSON.parse(load(DRAFT_KEY) || 'null'); } catch (e) {}
  draft = mine ? R.from(mine) : clone(site);
  render();
}

async function publish() {
  const blob = R.diff(R.from(R.diff(draft, BUILT)), BUILT);
  status = 'Publishing…';
  render();
  try {
    const r = await fetch('/studio/api/live/songburner', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(blob) });
    if (!r.ok) throw new Error(r.status === 401 ? 'Sign in again' : `Could not publish (${r.status})`);
    site = R.from(blob);
    draft = clone(site);
    keep();
    status = 'Published';
  } catch (e) {
    status = e.message;
  }
  render();
}

function unitWords(m) {
  if (m.unit === 'section' || m.unit === 'verse') return { one: 'verse', many: 'verses' };
  if (m.unit === 'word') return { one: 'word', many: 'words' };
  return { one: 'line', many: 'lines' };
}

/* What each game dial is called and how far it goes, as in the app's Settings. */
function gameDial(m, key) {
  const u = unitWords(m);
  return ({
    wrongN: [`Wrong ${u.many}`, 0, 8, 1],
    fakePct: [`Wrong ${u.many}`, 5, 100, 1, '%'],
    extraN: ['Extra words', 0, 12, 1],
    missN: [m.id === 'wordScramble' ? 'Words missing per verse' : 'Lines missing', 1, 40, 1],
    editPct: [`Words swapped in an altered ${u.one}`, 5, 100, 1, '%'],
    fakesPer: ['Choices behind each', 1, 8, 1],
    choiceCount: ['Choices per question', 2, 8, 1],
    trayN: ['Shown at once', 2, 40, 1],
    pts: ['Points', 0, 1000, 1],
    floor: ['Passing score', 0, 99, 1, '%'],
    secsPer: [`Seconds per ${u.one}`, 0.1, 600, 0.1]
  })[key];
}

function numberIn(value, min, max, step, label, onset) {
  return h('input', { type: 'number', min, max, step, value, 'aria-label': label, onchange: (e) => {
    const v = Number(e.target.value);
    if (e.target.value === '' || !(v >= min && v <= max)) { e.target.value = value; return; }
    onset(v);
  } });
}

function changed() { keep(); status = ''; render(); }

function setMix(mix, kind, v) {
  const kinds = Object.keys(mix);
  const others = kinds.filter((k) => k !== kind);
  const rest = others.reduce((n, k) => n + (Number(mix[k]) || 0), 0);
  const left = 100 - v;
  let total = 0;
  for (const k of others) { mix[k] = Math.round(rest > 0 ? (Number(mix[k]) || 0) * left / rest : left / others.length); total += mix[k]; }
  mix[kind] = v;
  if (others.length) {
    const big = others.reduce((a, b) => (mix[b] > mix[a] ? b : a));
    mix[big] += left - total;
  }
}

/* One row: label, input(s), unit. The row is marked when it differs from the built-in value. */
function row(label, value, base, input, unit) {
  return h('div', { class: 'row' + (same(value, base) ? '' : ' changed') },
    h('label', {}, label), input, h('span', { class: 'unit' }, unit || ''));
}

function simple(key, label, min, max, step, unit) {
  return row(label, draft[key], BUILT[key], numberIn(draft[key], min, max, step, label, (v) => { draft[key] = v; changed(); }), unit);
}

function rangeIn(arr, min, max, label, onset) {
  return h('span', { class: 'pair' },
    numberIn(arr[0], min, max, 1, label + ' from', (v) => onset(v <= arr[1] ? [v, arr[1]] : [arr[1], v])), '–',
    numberIn(arr[1], min, max, 1, label + ' to', (v) => onset(v >= arr[0] ? [arr[0], v] : [v, arr[0]])));
}

function gameTable(m) {
  const d = draft.games[m.id], b = BUILT.games[m.id];
  // Points are on every level; the app's dial table leaves them out because every game has them.
  const dials = R.games[m.id].dials.flatMap((k) => (k === 'floor' ? ['pts', 'floor'] : [k]));
  const body = [];
  const td = (lv, key, input) => h('td', { class: same(d[lv][key], b[lv][key]) ? '' : 'changed' }, input);
  for (const key of dials) {
    if (key === 'mix') {
      body.push(h('tr', {}, h('td', { colspan: 4 }, 'Wrong pieces are')));
      for (const kind of R.games[m.id].kinds) {
        body.push(h('tr', { class: 'sub' }, h('td', {}, KINDS[kind] + ' %'), LEVELS.map(([lv]) => {
          const cellBox = h('td', { class: same(d[lv].mix, b[lv].mix) ? '' : 'changed' },
            numberIn(d[lv].mix[kind] || 0, 0, 100, 5, `${KINDS[kind]}, ${lv}`, (v) => { setMix(d[lv].mix, kind, v); changed(); }));
          return cellBox;
        })));
      }
      continue;
    }
    const [label, min, max, step, unit] = gameDial(m, key);
    body.push(h('tr', {}, h('td', {}, label + (unit ? ` ${unit}` : '')), LEVELS.map(([lv]) => {
      const v = d[lv][key];
      if (Array.isArray(v)) return td(lv, key, rangeIn(v, min, max, `${label}, ${lv}`, (r) => { d[lv][key] = r; changed(); }));
      return td(lv, key, numberIn(v, min, max, step, `${label}, ${lv}`, (n) => { d[lv][key] = n; changed(); }));
    })));
  }
  return h('table', { class: 'levels' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), LEVELS.map(([, name]) => h('th', {}, name)))),
    h('tbody', {}, body));
}

function quizCard() {
  const rows = [];
  for (const m of QUIZZES) {
    const d = draft.quizzes[m.id], b = BUILT.quizzes[m.id];
    rows.push(h('h3', {}, m.label));
    rows.push(row('Points', d.pts, b.pts, numberIn(d.pts, 0, 1000, 1, `${m.label} points`, (v) => { d.pts = v; changed(); })));
    rows.push(row('Passing score', d.floor, b.floor, numberIn(d.floor, 0, 99, 1, `${m.label} passing score`, (v) => { d.floor = v; changed(); }), '%'));
    if (m.id === 'medium') {
      const choice = (key, opts, label) => row(label, d[key], b[key], h('select', { 'aria-label': label, onchange: (e) => { d[key] = e.target.value; changed(); } },
        opts.map(([v, t]) => h('option', { value: v, selected: d[key] === v }, t))));
      rows.push(choice('letterPick', [['random', 'At random'], ['first', 'From the start']], 'Letters shown'));
      rows.push(choice('letterScope', [['word', 'Each word'], ['line', 'Each line'], ['verse', 'Each verse'], ['song', 'The whole song']], 'Counted over'));
      if (d.letterScope === 'word') rows.push(row('Letters per word', d.letterCount, b.letterCount, numberIn(d.letterCount, 0, 12, 1, 'Letters per word', (v) => { d.letterCount = v; changed(); })));
      else rows.push(row('Share of letters', d.letterPct, b.letterPct, numberIn(d.letterPct, 0, 100, 1, 'Share of letters', (v) => { d.letterPct = v; changed(); }), '%'));
    }
  }
  return h('div', { class: 'card' }, h('h2', {}, 'Quizzes'), rows);
}

function defaultsView() {
  if (!draft) return h('p', { class: 'status' }, 'Loading…');
  const pending = !same(draft, site);
  const atBuilt = same(draft, BUILT);
  const m = GAMES.find((g) => g.id === gameId);
  return [
    h('div', { class: 'bar' },
      h('button', { class: 'primary', disabled: !pending, onclick: publish }, 'Publish to site'),
      pending ? h('button', { onclick: () => { draft = clone(site); changed(); } }, 'Discard changes') : null,
      atBuilt ? null : confirmButton('Built-in values', 'Back to built-in values?', () => { draft = clone(BUILT); changed(); })),
    h('p', { class: 'status' + (pending ? ' draft' : '') }, status || (pending ? 'Not published yet' : '')),
    h('div', { class: 'cards' },
      h('div', { class: 'card' }, h('h2', {}, 'Practice'),
        simple('decay', 'Cooling speed', 0, 5, 1),
        simple('hotPct', 'Rest days from quizzes', 0, 50, 1, '%')),
      h('div', { class: 'card' }, h('h2', {}, 'Timer'),
        row('Speed bonus on', draft.speedMod, BUILT.speedMod, h('input', { type: 'checkbox', checked: draft.speedMod, 'aria-label': 'Speed bonus on', onchange: (e) => { draft.speedMod = e.target.checked; changed(); } })),
        simple('speedSwing', 'Speed bonus', 0, 50, 5, '±%'),
        simple('timerMin', 'Quizzes before it counts', 1, 50, 1)),
      h('div', { class: 'card' }, h('h2', {}, 'Medal bonus'),
        MEDALS.map(([k, name]) => row(name, draft.medalMult[k], BUILT.medalMult[k],
          numberIn(draft.medalMult[k], 1, 20, 1, `${name} medal bonus`, (v) => { draft.medalMult[k] = v; changed(); }), '×'))),
      h('div', { class: 'card' }, h('h2', {}, 'Lyric heatmap'),
        simple('sting', 'A miss lowers a word by', 1, 100, 1, '%'),
        simple('mend', 'A clean run raises it by', 1, 100, 1, '%'),
        simple('gameWeight', 'Games count for', 0, 100, 1, '%'),
        simple('fade', 'Old results fade after', 7, 3650, 1, 'days'))),
    h('div', { class: 'card' }, h('h2', {}, 'Games'),
      h('select', { class: 'game-pick', 'aria-label': 'Game', onchange: (e) => { gameId = e.target.value; render(); } },
        GAMES.map((g) => h('option', { value: g.id, selected: g.id === gameId }, g.label + (same(draft.games[g.id], BUILT.games[g.id]) ? '' : ' •')))),
      gameTable(m)),
    quizCard()
  ];
}

/* ---------- page ---------- */

function render() {
  const focus = document.activeElement && document.activeElement.getAttribute('aria-label');
  const pick = (id, name) => h('button', { class: tab === id ? 'on' : '', onclick: () => { tab = id; save(TAB_KEY, id); render(); } }, name);
  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '← Studio'), h('h1', {}, 'Song Burner')),
    h('div', { class: 'seg' }, pick('users', 'Testers'), pick('defaults', 'Defaults'), pick('book', 'Songbook')),
    ...[tab === 'users' ? usersView() : tab === 'book' ? bookView() : defaultsView()].flat(2).filter((x) => x != null));
  if (focus) {
    const el = [...app.querySelectorAll('[aria-label]')].find((x) => x.getAttribute('aria-label') === focus);
    if (el) {
      el.focus();
      if (el.type === 'search' || el.type === 'url') el.setSelectionRange?.(el.value.length, el.value.length);
    }
  }
}

const bookView = songbook(() => render());

render();
loadUsers();
loadRequests();
loadDefaults();
