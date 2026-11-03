/* Musician Maker game workshop: the games one at a time.
   - Try it: the game's scene as in the game, on the groove at any combo tier, with its call,
     taps, every win and fail gag, and its boss. Uses the game's own code (musician-maker/).
   - Options: whether it comes up in the stream, whether it hosts the boss, which gags can come
     up, its tap sound (musician-maker/options.js). Kept on this device as a draft; "Save for
     site" downloads games.json for musician-maker/games.json (tools/add_games.py).
   - Test play: the real game with only this game in it, the draft options and a step, tempo,
     pace and groove picked here. Progress isn't saved in a test run. */

import * as snd from '/musician-maker/sound.js';
import { makeClock } from '/musician-maker/clock.js';
import { GAMES } from '/musician-maker/games.js';
import * as OPT from '/musician-maker/options.js';
import { STEPS, ALL, onsets } from '/musician-maker/steps.js';
import { TIER_NAMES } from '/musician-maker/director.js';
import { h } from '../dom.js';

const app = document.getElementById('app');
const TIER_LABELS = ['Combo 0', ...TIER_NAMES.slice(1)];

let site = OPT.complete();
const draft = OPT.loadDraft();
let opts = draft.games || site;
const test = { step: '', tempo: 'climb', start: 'games', pace: 'normal', groove: 'mix', ...draft.test };
let gameId = (GAMES.find((g) => g.id === test.game) || GAMES[0]).id;
let labels = {}; // sound names, from the samples index
let status = '';

const game = () => GAMES.find((g) => g.id === gameId);
const keep = () => {
  draft.games = opts;
  draft.test = { ...test, game: gameId };
  OPT.saveDraft(draft);
  OPT.apply(opts);
};
const same = () => JSON.stringify(OPT.complete(opts)) === JSON.stringify(site);

/* ---------- the scene ---------- */

const bench = { api: null, stage: null, wrap: null, boss: false, tier: 0, bpm: 108, clock: null, beat: 0 };

function mount() {
  bench.stage.replaceChildren();
  bench.stage.className = 'stage';
  bench.api = game().make(bench.stage, { boss: bench.boss });
}

async function ready() {
  const ctx = snd.ac();
  if (ctx.state === 'suspended') await ctx.resume();
  await snd.load();
  return ctx;
}

const later = (ctx, t, fn) => setTimeout(fn, Math.max(0, (t - ctx.currentTime + snd.latency()) * 1000));

async function grooveOn() {
  const ctx = await ready();
  grooveOff();
  snd.setGrooveMeter('2/4');
  const list = snd.grooveList('2/4');
  snd.setGroove(list.some((g) => g.id === test.groove) ? test.groove : list[0]?.id);
  snd.setGroovePhase(0);
  const clock = makeClock(ctx);
  bench.clock = clock;
  clock.onBeat((i, t, spb) => {
    snd.groove(i, t, spb, { tier: bench.tier, mode: 'play', duck: false });
    later(ctx, t, () => {
      if (bench.clock !== clock) return;
      bench.beat = i;
      bench.api?.onBeat?.(i % 2 === 0, spb, bench.tier);
      if (i % 2 === 0) bump(bench.wrap, 'thump');
    });
  });
  clock.start(ctx.currentTime + 0.1, bench.bpm);
}

function grooveOff() {
  bench.clock?.stop();
  bench.clock = null;
  snd.grooveStop();
}

function bump(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/* The call on "bum": a random Unit 1 pattern, on the next bar when the groove is playing. */
async function call() {
  const ctx = await ready();
  const spb = 60 / bench.bpm;
  let t = ctx.currentTime + 0.1;
  if (bench.clock) {
    const c = bench.clock;
    let i = Math.ceil((t - c.timeOf(0)) / spb);
    if (i % 2) i++;
    t = c.timeOf(i);
  }
  const p = ALL[Math.floor(Math.random() * ALL.length)];
  snd.call(p, 'neutral', t, spb);
  onsets(p).forEach((o, i) => later(ctx, t + o.b * spb, () => bench.api?.onCall(i, null)));
}

async function tap() {
  const ctx = await ready();
  snd.hit(game().tap, ctx.currentTime, 0.9);
  bench.api?.onTap();
}

/* A gag on a fresh scene, as after a game's response. */
async function gag(kind, name) {
  const ctx = await ready();
  mount();
  requestAnimationFrame(() => {
    if (kind === 'win') { snd.fx.win(ctx.currentTime + 0.02); bench.api.win(name); } else { snd.fx.fail(ctx.currentTime + 0.02); bench.api.fail(name); }
  });
}

async function bossDo(what) {
  const ctx = await ready();
  if (what === 'hit') { snd.fx.win(ctx.currentTime + 0.02); bench.api.hit?.(); }
  if (what === 'miss') { snd.fx.fail(ctx.currentTime + 0.02); bench.api.miss?.(); }
  if (what === 'ko') bench.api.win();
  if (what === 'lose') bench.api.fail();
}

function seg(options, value, change, cls = '') {
  const wrap = h('div', { class: `seg ${cls}` });
  const draw = () => wrap.replaceChildren(...Object.entries(options).map(([v, label]) =>
    h('button', { class: String(v) === String(value) ? 'on' : '', onclick: () => { value = v; change(v); draw(); } }, label)));
  draw();
  return wrap;
}

function tryCard() {
  const g = game();
  bench.stage = h('div', { class: 'stage' });
  bench.wrap = h('div', { class: 'ws-stage-wrap' }, bench.stage);
  const playBtn = h('button', { class: bench.clock ? 'on' : '', onclick: async () => {
    if (bench.clock) grooveOff(); else await grooveOn();
    playBtn.classList.toggle('on', !!bench.clock);
    playBtn.textContent = bench.clock ? '■ Stop' : '▶ Groove';
  } }, bench.clock ? '■ Stop' : '▶ Groove');
  const rows = [
    h('div', { class: 'try' },
      playBtn,
      seg({ 92: '92', 108: '108', 126: '126' }, bench.bpm, async (v) => { bench.bpm = Number(v); if (bench.clock) await grooveOn(); }),
      seg(Object.fromEntries(TIER_LABELS.map((l, i) => [i, l])), bench.tier, (v) => { bench.tier = Number(v); })),
  ];
  if (bench.boss) {
    rows.push(h('div', { class: 'try' },
      h('span', { class: 'label' }, 'Boss'),
      h('button', { onclick: call }, 'Call'),
      h('button', { onclick: tap }, 'Tap'),
      h('button', { onclick: () => bossDo('hit') }, 'Hit'),
      h('button', { onclick: () => bossDo('miss') }, 'Miss'),
      h('button', { onclick: () => bossDo('ko') }, 'Beat him'),
      h('button', { onclick: () => bossDo('lose') }, 'He gets away'),
      h('span', { class: 'grow' }),
      h('button', { onclick: mount }, 'Reset')));
  } else {
    rows.push(h('div', { class: 'try' },
      h('span', { class: 'label' }, 'Game'),
      h('button', { onclick: call }, 'Call'),
      h('button', { onclick: tap }, 'Tap (or space)'),
      h('span', { class: 'grow' }),
      h('button', { onclick: mount }, 'Reset')));
    for (const kind of ['win', 'fail']) {
      const list = g.gags?.[kind] || {};
      rows.push(h('div', { class: 'try' },
        h('span', { class: 'label' }, kind === 'win' ? 'Win' : 'Miss'),
        h('button', { onclick: () => gag(kind, null), title: 'One of the gags that are on' }, 'Random'),
        ...Object.entries(list).map(([id, label]) => h('button', { onclick: () => gag(kind, id) }, label))));
    }
  }
  const card = h('section', { class: 'card' },
    h('div', { class: 'bar' },
      h('h2', { class: 'grow' }, 'Try it'),
      g.bossName ? seg({ game: 'Game', boss: g.bossName }, bench.boss ? 'boss' : 'game', (v) => { bench.boss = v === 'boss'; drawBench(); }) : null),
    bench.wrap, ...rows);
  requestAnimationFrame(mount);
  return card;
}

/* ---------- options ---------- */

function switchRow(label, hint, on, change) {
  const b = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(on), 'aria-label': label, onclick: () => {
    on = !on;
    b.setAttribute('aria-checked', String(on));
    change(on);
  } });
  return h('div', { class: 'opt-row' }, h('div', {}, h('b', {}, label), h('small', {}, hint)), b);
}

function gagChips(g, o, kind) {
  const list = g.gags?.[kind] || {};
  const ids = Object.keys(list);
  if (!ids.length) return null;
  const wrap = h('div', { class: 'chips' });
  const draw = () => wrap.replaceChildren(...ids.map((id) => h('button', {
    class: 'chip', 'aria-pressed': String(o[kind].includes(id)),
    onclick: () => {
      const on = o[kind].includes(id);
      if (on && o[kind].length === 1) { setStatus('At least one has to stay on.'); return; }
      o[kind] = on ? o[kind].filter((x) => x !== id) : ids.filter((x) => x === id || o[kind].includes(x));
      changed();
      draw();
    },
  }, list[id])));
  draw();
  return h('div', {}, h('h3', {}, kind === 'win' ? 'Win gags' : 'Miss gags'), wrap);
}

function optionsCard() {
  const g = game();
  const o = opts[g.id];
  const tapSel = h('select', { 'aria-label': 'Tap sound', onchange: (e) => { o.tap = e.target.value; changed(); tap(); } },
    ...snd.HITS.map((n) => h('option', { value: n, selected: n === o.tap }, `${labels[n] || n}${n === g.baseTap ? ' (its own)' : ''}`)));
  return h('section', { class: 'card' },
    h('div', { class: 'bar' },
      h('h2', { class: 'grow' }, 'Options'),
      h('button', { class: 'icon', onclick: () => { opts[g.id] = OPT.defaults(g); changed(); drawBench(); } }, 'Defaults')),
    switchRow('In the stream', 'Comes up in regular play', o.stream, (v) => {
      if (!v && GAMES.every((x) => x === g || !opts[x.id].stream)) { drawBench(); setStatus('At least one game has to stay in the stream.'); return; }
      o.stream = v;
      changed();
    }),
    g.bossName ? switchRow(`Hosts the boss: ${g.bossName}`, 'Takes turns with the other bosses, one a lap', o.boss, (v) => { o.boss = v; changed(); }) : null,
    gagChips(g, o, 'win'),
    gagChips(g, o, 'fail'),
    h('h3', {}, 'Tap sound'),
    h('div', { class: 'try' }, tapSel, h('button', { onclick: tap }, '▶')),
    h('p', { class: 'hint' }, 'Every tap, pick and slot in this game plays it.'));
}

/* ---------- test play ---------- */

function testUrl() {
  const q = new URLSearchParams({ test: gameId });
  if (test.step) q.set('step', test.step);
  if (test.tempo !== 'climb') q.set('tempo', test.tempo);
  if (test.start === 'boss' && game().bossName) q.set('start', 'boss');
  if (test.pace === 'mookie') q.set('pace', 'mookie');
  q.set('groove', test.groove);
  return `/musician-maker/?${q}`;
}

function testCard() {
  const g = game();
  const link = h('a', { class: 'button primary play-test', href: testUrl() }, `Play ${g.name}`);
  const set = (k) => (v) => { test[k] = v; keep(); link.href = testUrl(); };
  const grooveSel = h('select', { onchange: (e) => set('groove')(e.target.value) },
    h('option', { value: 'mix', selected: test.groove === 'mix' }, 'Mix: a new one each lap'),
    ...snd.grooveList('2/4').map((x) => h('option', { value: x.id, selected: x.id === test.groove }, x.name)));
  return h('section', { class: 'card' },
    h('h2', {}, 'Test play'),
    h('div', { class: 'test-grid' },
      h('label', {}, 'Steps',
        h('select', { onchange: (e) => set('step')(e.target.value) },
          h('option', { value: '', selected: !test.step }, 'From my progress'),
          ...STEPS.slice(1).map((s) => h('option', { value: String(s.n), selected: String(s.n) === String(test.step) }, `${s.n}. ${s.name}`)))),
      h('label', {}, 'Tempo', seg({ climb: '92 → 126', 92: '92', 108: '108', 126: '126' }, test.tempo, set('tempo'))),
      g.bossName ? h('label', {}, 'Start with', seg({ games: 'Games', boss: g.bossName }, test.start, set('start'))) : null,
      h('label', {}, 'Pace', seg({ normal: 'Normal', mookie: 'Mookie mode' }, test.pace, set('pace'))),
      h('label', {}, 'Groove', grooveSel)),
    link,
    h('p', { class: 'hint' }, 'Only this game comes up, with the options here (saved for the site or not). Progress isn\'t saved.'));
}

/* ---------- page ---------- */

const statusEl = h('p', { class: 'status' });
function setStatus(text) { status = text; drawStatus(); }
function drawStatus() {
  const draftOnly = !same();
  statusEl.className = `status${draftOnly ? ' draft' : ''}`;
  statusEl.textContent = status || (draftOnly ? 'Options changed here are only on this device until you Save for site.' : 'Options match the site.');
}

function changed() {
  status = '';
  keep();
  drawStatus();
  drawTabs();
}

const tabs = h('div', { class: 'games-tabs' });
function drawTabs() {
  tabs.replaceChildren(h('div', { class: 'seg' }, ...GAMES.map((g) => h('button', {
    class: `${g.id === gameId ? 'on' : ''} ${opts[g.id].stream ? '' : 'off'}`,
    title: opts[g.id].stream ? '' : 'Not in the stream',
    onclick: () => { gameId = g.id; bench.boss = false; keep(); drawTabs(); drawBench(); },
  }, g.name))));
}

const benchEl = h('div', { class: 'bench' });
function drawBench() {
  benchEl.replaceChildren(h('div', {}, tryCard()), h('div', {}, optionsCard(), testCard()));
}

function saveForSite() {
  const all = OPT.complete(opts);
  const text = `{"games": {\n${GAMES.map((g) => `  ${JSON.stringify(g.id)}: ${JSON.stringify(all[g.id])}`).join(',\n')}\n}}\n`;
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: 'games.json', hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  setStatus('Downloaded games.json. Upload it to the Musician Maker project to put it in the game.');
}

async function start() {
  [site] = await Promise.all([OPT.siteOptions(), snd.loadGrooves(),
    fetch('/assets/sounds/index.json').then((r) => r.json()).then((d) => {
      labels = Object.fromEntries(Object.entries(d.instruments || {}).map(([k, v]) => [k, v.label || k]));
    }).catch(() => {})]);
  if (!draft.games) opts = structuredClone(site);
  OPT.apply(opts);
  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '‹ Studio')),
    h('div', { class: 'bar' },
      h('h1', { class: 'grow' }, 'Musician Maker game workshop'),
      h('a', { class: 'button', href: '/musician-maker/?lab' }, 'Transitions lab'),
      h('a', { class: 'button', href: '/musician-maker/' }, 'Open the game'),
      h('button', { class: 'primary', onclick: saveForSite }, 'Save for site')),
    statusEl, tabs, benchEl);
  drawStatus();
  drawTabs();
  drawBench();
}

document.addEventListener('keydown', (e) => {
  if (e.key === ' ' && !e.repeat && !bench.boss && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) { e.preventDefault(); tap(); }
});

start();
