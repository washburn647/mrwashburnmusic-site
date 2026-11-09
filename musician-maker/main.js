/* Musician Maker: one nonstop stream of micro-games on one groove.
   A run is laps of three sets (92, 108, 126 bpm), each set followed by a breather, then a
   boss and an intermission. A micro-game is cue (4 beats), call (4), the learner's turn (4;
   Note It 8), payoff (4): whole bars, and the groove's 4-bar loop starts again on every call.
   The director (director.js) rolls each game's step, task (tasks.js), stimulus and pattern;
   the turn's controls are turn.js; the groove (sound.js) grows with the combo.
   Why it works this way: the stream engine design doc in the project. */

import * as snd from './sound.js';
import { makeClock } from './clock.js';
import * as mic from './mic.js';
import { STEPS, BANDS, UNIT, onsets, sylText, loadMarks, isCreate, shows, bumText } from './steps.js';
import { TASKS, taskById, taskKey, howTo, tasksAt, stepsOf, allTaskKeys, beatsOf, XP_NO_NOTES, repeatFactor } from './tasks.js';
import { makeTurn, WHY, NOTE_SVG } from './turn.js';
import { makeDirector, tierOf, TIERS, TIER_NAMES, levelOf } from './director.js';
import { GAMES, mouseCatcher, bump } from './games.js';
import * as OPT from './options.js';
import { showIntro } from './intro.js';
import { mookie } from './mookie.js';
import { MIC_SPEECH } from './narration.js';
import * as TX from './transitions.js';
import * as FX from './effects.js';
import { cueId, PRAISE } from './cues.js';
import { notation } from '/assets/patterns/notation.js';
import * as store from './store.js';
import * as markup from './markup.js';

const app = document.getElementById('app');
const Q = new URLSearchParams(location.search);
/* A test run from the studio's game workshop (?test=<game id>): only that game (and its boss),
   with the workshop's draft options and test settings, and nothing saved. */
const TEST = GAMES.some((g) => g.id === Q.get('test')) ? {
  game: GAMES.find((g) => g.id === Q.get('test')),
  step: Number(Q.get('step')) || null,
  task: taskById(Q.get('task')) ? Q.get('task') : null,
  tempo: [92, 108, 126].includes(Number(Q.get('tempo'))) ? Number(Q.get('tempo')) : null,
  boss: Q.get('start') === 'boss',
  groove: Q.get('groove') || null,
  mookie: Q.get('pace') === 'mookie',
  intros: Q.get('intros') === 'all', // show every task intro again
  mic: Q.get('input') === 'mic',
} : null;
const WORKSHOP = '/studio/games/';
let st = store.load();
if (TEST) {
  st.mookie = TEST.mookie;
  if (TEST.groove) st.groove = TEST.groove;
  if (TEST.intros) st.intro = {};
  st.input = TEST.mic ? 'mic' : 'tap';
}
st.intro ||= {};
let dir = makeDirector(st);
let R = null; // the run being played
loadMarks();
// Which games play, and their options: games.json for learners, the workshop's draft in a test.
let LINEUP = OPT.apply(TEST ? OPT.loadDraft().games || OPT.complete() : OPT.complete(), TEST?.game.id);
if (!TEST) OPT.siteOptions().then((o) => { LINEUP = OPT.apply(o); });

const save = () => { if (!TEST) store.save(st); };
const today = () => new Date().toLocaleDateString('en-CA');
const LADDER = () => (TEST?.tempo ? [TEST.tempo, TEST.tempo, TEST.tempo] : st.mookie ? [92, 108, 108] : [92, 108, 126]);
const TEMPO_XP = { 92: 1, 108: 1.5, 126: 2 };
const TIER_COLORS = ['#5E7D4F', '#5E7D4F', '#d08a2e', '#C46A5A', '#8a5ac4'];
// The band's seats beside the beat lane, one per layer that joins (bass, drums, horns, band at
// combo tiers 1 to 4): each lights up when its layer joins and bobs on the beat. The icons and
// names are the groove's own (Groove Lab), so they change with the groove.
const SEATS = [['bass', 1], ['drums', 2], ['horns', 3], ['band', 4]];
const seatInfo = (layer) => snd.layerInfo(snd.grooveNow(), layer);
// The band parading in at a new tier: the layers that have joined so far, newest first.
const bandAt = (tier) => SEATS.filter(([, t]) => t <= tier).map(([layer]) => seatInfo(layer).icon).reverse();
const STICKERS = ['🧀', '🐭', '🥁', '🎺', '🎻', '🪕', '🎷', '🏆'];

/* Small DOM builder. Text always goes in as text, never as HTML. */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

/* Notation markup comes from VexFlow and the catalogue, never from a learner. */
/* Syllables with iconic notation above them: a stem over each note, and a beam joining the
   two eighths of a du-de. */
function sylIcons(p, cls = '') {
  return h('span', { class: `syl-ic ${cls}`, 'aria-label': sylText(p) },
    ...p.cells.map((c) => h('span', { class: `ic-beat ${c}` },
      ...(c === 'ee' ? ['du', 'de'] : ['du']).map((w) => h('span', { class: 'ic-note' }, h('i', {}), h('b', {}, w))))));
}

function notes(p) {
  const el = h('div', { class: 'notation' });
  el.innerHTML = notation(p);
  return el;
}

/* A pattern as the step can show it (steps.js shows): on "bum" at Rote, then syllables, then
   the notes too. */
function answerOf(p, step) {
  const k = shows(step);
  if (k === 'bum') return [h('span', { class: 'bum' }, bumText(p))];
  return k === 'notes' ? [notes(p), sylIcons(p)] : [sylIcons(p)];
}

/* ---------------- title ---------------- */

function seg(options, value, change) {
  const wrap = h('div', { class: 'seg' });
  const draw = () => wrap.replaceChildren(...Object.entries(options).map(([v, label]) =>
    h('button', { class: v === value ? 'on' : '', onclick: () => { value = v; change(v); draw(); } }, label)));
  draw();
  return wrap;
}

/* Which screen is showing, for the page background (the title is a stage at night). */
function scene(name) {
  if (document.body.dataset.screen !== name) snd.hush();
  document.body.dataset.screen = name;
  markup.refresh();
}

/* Which groove plays: Mix (a different one each lap) or one the learner picks. Each tap
   moves to the next. The list loads with the sounds, so it fills in once they have. */
function groovePick() {
  const label = () => (st.groove === 'mix' ? 'Mix: a new one each lap' : snd.grooveList(UNIT.meter).find((g) => g.id === st.groove)?.name || 'Mix: a new one each lap');
  const small = h('small', {}, label());
  const b = h('button', { class: 'switch groove-pick', onclick: () => {
    const ids = ['mix', ...snd.grooveList(UNIT.meter).map((g) => g.id)];
    st.groove = ids[(ids.indexOf(st.groove) + 1) % ids.length] || 'mix';
    save();
    small.textContent = label();
  } }, h('span', { class: 'sw-text' }, h('b', {}, 'Groove'), small), h('span', { class: 'gp-ico', 'aria-hidden': 'true' }, '♫'));
  snd.loadGrooves().then(() => { small.textContent = label(); });
  return b;
}

/* The groove for a new lap, in the unit's meter. (A review item from a unit in the other
   meter can switch it with snd.setGrooveMeter: the groove carries on in its other version.) */
function pickGroove() {
  snd.setGrooveMeter(UNIT.meter);
  const list = snd.grooveList(UNIT.meter);
  if (st.groove !== 'mix' && list.some((g) => g.id === st.groove)) return snd.setGroove(st.groove);
  const others = list.filter((g) => g !== snd.grooveNow());
  const pool = others.length ? others : list;
  return pool.length ? snd.setGroove(pool[Math.floor(Math.random() * pool.length)].id) : null;
}

/* An on/off switch with a label and a short hint under it. */
function toggle(label, hint, on, change) {
  const b = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(on), onclick: () => {
    on = !on;
    b.setAttribute('aria-checked', String(on));
    change(on);
  } }, h('span', { class: 'sw-text' }, h('b', {}, label), h('small', {}, hint)), h('span', { class: 'sw-knob' }));
  return b;
}

function floatNote(kind, i) {
  const el = h('span', { class: `fnote fn${i}` });
  el.innerHTML = NOTE_SVG[kind]; // fixed markup (turn.js)
  return el;
}

function title() {
  scene('title');
  const lv = levelOf(st.xp);
  const toNext = 150 * lv.n * (lv.n + 1) / 2;
  app.replaceChildren(h('div', { class: 'title' },
    h('div', { class: 'headliner' },
      h('header', { class: 'marquee' }, h('div', { class: 'marquee-in' },
        h('small', {}, 'Mookie presents'),
        h('h1', {}, 'Musician', h('br'), 'Maker'))),
      h('p', { class: 'unit-tag' }, h('span', {}, 'Unit 1'), ' du · du-de'),
      h('div', { class: 'hero' },
        h('div', { class: 'beam' }),
        ...['q', 'ee', 'q', 'ee', 'q'].map(floatNote),
        mookie('happy'),
        h('div', { class: 'rug' })),
      h('button', { class: 'play big-play', onclick: () => startRun() }, h('span', { class: 'tri' }), 'Play'),
      h('button', { class: 'link', onclick: howToPlay }, 'How to play')),
    h('div', { class: 'side' },
      h('div', { class: 'pass' },
        h('div', { class: 'pass-top' }, 'Backstage pass'),
        h('div', { class: 'pass-body' },
          h('div', { class: 'pass-lv' }, h('small', {}, 'Level'), h('b', {}, String(lv.n))),
          h('div', { class: 'pass-who' },
            h('b', {}, lv.title),
            h('span', { class: 'xpbar' }, h('span', { style: `width:${Math.round(lv.frac * 100)}%` })),
            h('small', {}, `${st.xp} / ${toNext} XP`))),
        h('div', { class: 'pass-stats' },
          h('span', {}, h('b', {}, String(st.bestCombo)), ' best combo'),
          h('span', {}, h('b', {}, String(st.days)), st.days === 1 ? ' day played' : ' days played')),
        st.stickers.length ? h('p', { class: 'stickers' }, st.stickers.join(' ')) : null),
      h('div', { class: 'switches' },
        toggle('Mookie mode', 'An easier pace', st.mookie, (v) => { st.mookie = v; dir = makeDirector(st); save(); }),
        groovePick()),
      h('button', { class: 'to-map', onclick: progress },
        h('span', { class: 'staff-ico' }), 'My progress'))));
}

/* Say "du du-de du du" and watch the meter: shows whether the mic hears you, and how many
   syllables it counts. A pause of 1.5 s starts a new count, so each try is counted alone. */
function micCheck(onProblem = null) {
  const fill = h('span', {});
  const heard = h('span', { class: 'heard' }, '');
  let count = 0;
  let lastAt = -9;
  let raf = 0;
  let holding = false;
  const box = h('div', { class: 'miccheck' },
    h('button', { class: 'mini', onclick: async () => {
      try {
        mic.setEcho(st.echo !== false);
        if (!holding) await mic.start(snd.ac());
        holding = true;
        heard.textContent = 'Say "du du-de du du"…';
        mic.listen((t) => {
          if (t - lastAt > 1.5) count = 0;
          lastAt = t;
          count++;
          heard.textContent = `Heard ${count} ${count === 1 ? 'syllable' : 'syllables'}`;
          bump(fill.parentElement, 'blip');
        });
        const draw = () => {
          // Leaving the page lets go of the mic; a run that has started keeps its own hold.
          if (!box.isConnected) { mic.stop(); holding = false; return; }
          fill.style.width = `${Math.round(mic.getLevel() * 100)}%`;
          raf = requestAnimationFrame(draw);
        };
        cancelAnimationFrame(raf);
        draw();
      } catch (e) {
        heard.textContent = onProblem ? '' : micProblem(e);
        onProblem?.(micProblem(e));
      }
    } }, 'Test the mic'),
    h('span', { class: 'meter' }, fill), heard);
  return box;
}

function howToPlay() {
  scene('progress');
  const tip = (icon, text) => h('li', {}, h('span', { class: 'ic' }, icon), text);
  app.replaceChildren(h('div', { class: 'progress howto' },
    h('button', { class: 'back', 'aria-label': 'Back', onclick: title }, '‹'),
    h('h2', {}, 'How to play'),
    h('ol', { class: 'tips' },
      tip('👂', 'Listen. Mookie plays a little pattern.'),
      tip('✨', 'The box glows. Now it\'s your turn!'),
      tip('🥁', 'Do what the words say: say it, tap it, play it, du it or note it.'),
      tip('🔥', 'Get lots right in a row and the band joins in.')),
    h('p', { class: 'note' }, 'Miss one? No problem. The next one is coming. Press ❚❚ to stop.'),
    h('button', { class: 'play', onclick: () => startRun() }, 'Play')));
}

function micProblem(e) {
  if (e?.name === 'NotAllowedError') return 'The mic is blocked. Allow it in the browser\'s site settings (the icon left of the address).';
  if (e?.name === 'NotFoundError') return 'No mic found on this device.';
  return `The mic didn't start (${e?.message || e}).`;
}

/* Progress: Unit 1 as one long staff that winds down the page. Each step is a note on it:
   hollow while locked, filled once open, gold when mastered. Mookie sits on the current one. */
const STATE_TEXT = { mastered: '★ Mastered', now: 'Learning now', open: 'Practising', locked: 'Locked' };

function stepInfo() {
  return STEPS.slice(1).map((s) => {
    const p = dir.step(s.n);
    const state = p.mastered ? 'mastered' : s.n === st.frontier ? 'now' : s.n < st.frontier ? 'open' : 'locked';
    return { s, p, state };
  });
}

/* A task at a step: met once its intro has played (then it can be practised from here),
   open while its step is, locked after. */
function taskState(id, n) {
  if (st.intro[taskKey(id, n)]) return 'met';
  return n <= st.frontier ? 'open' : 'locked';
}

const TASK_STATE = { met: '', open: 'Coming up', locked: 'Locked' };

function taskIcon(t, cls = '') {
  return h('span', { class: `ticon t-${t.id} ${cls}`, 'aria-hidden': 'true' }, t.icon);
}

/* My progress has two views: Steps (the map) and Tasks (each task's steps). */
let progressView = 'steps';

function progress(view = progressView) {
  progressView = view;
  scene('progress');
  const info = stepInfo();
  const done = info.filter((i) => i.state === 'mastered').length;
  const map = h('div', { class: 'map' });
  const sheet = h('div', { class: 'psheet', role: 'dialog' });
  app.replaceChildren(h('div', { class: 'progress' },
    h('header', { class: 'phead' },
      h('button', { class: 'back', 'aria-label': 'Back', onclick: () => { title(); } }, '‹'),
      h('div', {}, h('h2', {}, 'My progress'), h('p', {}, `Unit 1 · ${done} of 12 steps mastered`))),
    h('div', { class: 'pviews' }, seg({ steps: 'Steps', tasks: 'Tasks' }, view, (v) => progress(v))),
    view === 'tasks' ? taskGrid(sheet) : map,
    view === 'steps' ? h('p', { class: 'note' }, 'Master a step to open the next one. The music picks what you play.') : null,
    h('div', { class: 'testbox' },
      h('label', {}, 'Test mode (for Kyle): drill any step, markup ✏️', seg({ off: 'Off', on: 'On' }, st.test ? 'on' : 'off', (v) => { st.test = v === 'on'; save(); progress(); })),
      st.test ? h('label', {}, 'Record the mic in runs (saves a file for Claude)', seg({ off: 'Off', on: 'On' }, st.recMic ? 'on' : 'off', (v) => { st.recMic = v === 'on'; save(); })) : null,
      st.test ? h('label', {}, 'Mic echo cancelling', seg({ on: 'On', off: 'Off' }, st.echo === false ? 'off' : 'on', (v) => { st.echo = v === 'on'; save(); })) : null,
      st.test ? h('button', { class: 'mini', onclick: lab }, 'Transitions lab') : null,
      st.test ? h('button', { class: 'mini danger', onclick: () => { st = store.reset(); dir = makeDirector(st); progress(); } }, 'Reset all progress') : null),
    sheet));
  if (view === 'tasks') return;
  drawMap(map, info, sheet);
  map.querySelector('.pnode.now, .pnode.open')?.scrollIntoView({ block: 'center' });
}

/* Tasks: one card per task, its 12 steps in a row. A step the task doesn't use is blank. */
function taskGrid(sheet) {
  return h('div', { class: 'tgrid' }, ...TASKS.map((t) => {
    const ns = stepsOf(t.id);
    const met = ns.filter((n) => taskState(t.id, n) === 'met').length;
    return h('div', { class: 'tcard' },
      h('div', { class: 'tcard-top' }, taskIcon(t), h('b', {}, t.name), h('small', {}, `${met} of ${ns.length}`)),
      h('div', { class: 'tsteps' }, ...STEPS.slice(1).map((s) => {
        if (!t.steps[s.n]) return h('span', { class: 'tstep na' });
        const state = taskState(t.id, s.n);
        return h('button', { class: `tstep ${state} ${s.band}`, 'aria-label': `${t.name}, step ${s.n}: ${s.name}. ${TASK_STATE[state] || 'Unlocked'}`,
          onclick: () => showTask(sheet, t, s.n) }, String(s.n));
      })));
  }));
}

/* A task at a step: how strong it is, and (once met) its practice round and intro. */
function showTask(sheet, t, n) {
  const s = STEPS[n];
  const state = taskState(t.id, n);
  const p = dir.task(t.id, n);
  const can = state === 'met' || st.test;
  sheet.replaceChildren(...[
    h('button', { class: 'close', 'aria-label': 'Close', onclick: () => sheet.classList.remove('show') }, '×'),
    h('span', { class: `band ${s.band}` }, BANDS[s.band]),
    h('h3', { class: 'task-h' }, taskIcon(t), t.name),
    h('p', { class: 'intro-step' }, `Step ${n}: ${s.name}`),
    state === 'met' ? h('div', { class: 'sheet-bar' }, h('span', { class: 'pbar' }, h('span', { style: `width:${Math.round(p.s)}%` })), h('small', {}, `${Math.round(p.s)}% strong`)) : null,
    TASK_STATE[state] ? h('p', { class: `sheet-state ${state}` }, TASK_STATE[state]) : null,
    can ? h('div', { class: 'row' },
      h('button', { class: 'mini', onclick: () => practise(t, n, false) }, 'Practice'),
      h('button', { class: 'mini', onclick: () => practise(t, n, true) }, 'Watch the intro')) : null].filter(Boolean));
  sheet.classList.add('show');
}

/* A task's practice round, or its whole intro again, on its own page. The mic hears Speak/Sing
   It when it's on. */
async function practise(t, n, intro) {
  scene('progress');
  const key = taskKey(t.id, n);
  const pool = LINEUP.stream.length ? LINEUP.stream : GAMES;
  const game = pool[Math.floor(Math.random() * pool.length)];
  const card = h('div', { class: 'intro-preview' });
  let micOn = false;
  const back = () => {
    document.onkeydown = null;
    mic.listen(null);
    if (micOn) mic.stop();
    micOn = false;
    progress('tasks');
  };
  app.replaceChildren(h('div', { class: 'progress' },
    h('button', { class: 'back', 'aria-label': 'Back', onclick: back }, '‹'), card));
  if (t.id === 'say') {
    mic.setEcho(st.echo !== false);
    try { await mic.start(snd.ac()); micOn = true; } catch { micOn = false; }
  }
  if (!card.isConnected) { if (micOn) mic.stop(); return; }
  const it = showIntro(card, key, { h, notes, sylIcons, mic: micOn }, back, { game, practice: !intro });
  if (micOn) {
    mic.setTempo(84);
    mic.listen((time) => it.mic(time));
  }
  document.onkeydown = (e) => { if (!e.repeat && it.keys(e)) e.preventDefault(); };
}

/* Smooth curve through points (Catmull-Rom as cubic Béziers). */
function curve(pts) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] || pts[i], pts[i], pts[i + 1], pts[i + 2] || pts[i + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1.map(Math.round)} ${c2.map(Math.round)} ${p2.map(Math.round)}`;
  }
  return d;
}

function drawMap(map, info, sheet) {
  const W = Math.max(300, map.clientWidth);
  const A = Math.min(W * 0.27, 170);
  const GAP = 104;
  const BAND_GAP = 46;
  let y = 168;
  let band = '';
  const pos = info.map(({ s }, i) => {
    if (s.band !== band) { if (band) y += BAND_GAP; band = s.band; }
    const p = [W / 2 + A * Math.sin(i * Math.PI / 2 + Math.PI), y];
    y += GAP;
    return p;
  });
  const top = 52;
  const end = y - 10;
  const pts = [[14, top], [W * 0.34, top], ...pos, [W * 0.62, end], [W - 18, end]];
  const H = end + 70;
  map.style.height = `${H}px`;

  // Staff: five parallel lines along any curve, from stacked strokes of shrinking width.
  const d = curve(pts);
  const strokes = [[34, 'ln'], [30, 'bg'], [18, 'ln'], [14, 'bg'], [2, 'ln']]
    .map(([w, c]) => `<path d="${d}" class="st-${c}" stroke-width="${w}"/>`).join('');
  const bars = `<rect x="${W - 26}" y="${end - 17}" width="2" height="34" class="st-fill"/><rect x="${W - 21}" y="${end - 17}" width="5" height="34" class="st-fill"/>`;
  const clef = `<rect x="22" y="${top - 8}" width="4" height="16" class="st-fill"/><rect x="30" y="${top - 8}" width="4" height="16" class="st-fill"/>`;
  const time = `<text x="52" y="${top - 1}" class="st-time">2</text><text x="52" y="${top + 16}" class="st-time">4</text>`;

  // Soft colour behind each band, with a boxed rehearsal mark.
  const regions = [];
  for (const b of Object.keys(BANDS)) {
    const ys = info.map((it, i) => (it.s.band === b ? pos[i][1] : null)).filter((v) => v != null);
    regions.push(h('div', { class: `region ${b}`, style: `top:${ys[0] - 76}px;height:${ys.at(-1) - ys[0] + 128}px` },
      h('span', { class: 'rmark' }, BANDS[b])));
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'staff');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.innerHTML = strokes + bars + clef + time; // built from numbers only

  const nodes = info.map((it, i) => {
    const [x, ny] = pos[i];
    const left = x < W / 2 - 4;
    const room = left ? W - x - 52 : x - 52;
    const node = h('button', { class: `pnode ${it.state} ${it.s.band}`, style: `left:${x}px;top:${ny}px`,
      'aria-label': `${it.s.n}. ${it.s.name}: ${STATE_TEXT[it.state]}`, onclick: () => showStep(sheet, it) },
    h('span', { class: 'head' }, h('b', {}, it.state === 'mastered' ? '★' : String(it.s.n))));
    const label = h('div', { class: `plabel ${it.state} ${left ? 'r' : 'l'}`,
      style: `top:${ny}px;${left ? `left:${x + 46}px` : `right:${W - x + 46}px`};max-width:${room}px` },
    h('b', {}, it.s.name),
    h('small', {}, STATE_TEXT[it.state]),
    h('span', { class: 'ptasks' }, ...tasksAt(it.s.n).map((t) => taskIcon(t, taskState(t.id, it.s.n)))),
    it.state !== 'locked' ? h('span', { class: 'pbar' }, h('span', { style: `width:${Math.round(it.p.s)}%` })) : null);
    return [node, label];
  });

  const cur = info.findIndex((it) => it.state === 'now');
  const cat = cur >= 0 ? mookie('') : null;
  if (cat) {
    // beside the note, on the side away from its label
    const [x, cy] = pos[cur];
    cat.classList.add('map-cat');
    cat.style.cssText = `left:${x < W / 2 - 4 ? x - 58 : x + 58}px;top:${cy + 26}px`;
  }

  map.replaceChildren(...regions, svg, ...nodes.flat(), cat,
    h('div', { class: 'next-unit', style: `top:${end + 26}px` }, 'Unit 2 · coming soon'));
}

function showStep(sheet, { s, p, state }) {
  sheet.replaceChildren(...[
    h('button', { class: 'close', 'aria-label': 'Close', onclick: () => sheet.classList.remove('show') }, '×'),
    h('span', { class: `band ${s.band}` }, BANDS[s.band]),
    h('h3', {}, `${s.n}. ${s.name}`),
    h('p', {}, state === 'locked' ? 'Master the step before this one to open it.' : s.about),
    state !== 'locked' ? h('div', { class: 'sheet-bar' }, h('span', { class: 'pbar' }, h('span', { style: `width:${Math.round(p.s)}%` })), h('small', {}, `${Math.round(p.s)}% strong`)) : null,
    h('p', { class: `sheet-state ${state}` }, STATE_TEXT[state]),
    h('div', { class: 'sheet-tasks' }, ...tasksAt(s.n).map((t) => h('button', { class: `tchip ${taskState(t.id, s.n)}`, onclick: () => showTask(sheet, t, s.n) },
      taskIcon(t), h('span', {}, t.name)))),
    st.test ? h('button', { class: 'mini', onclick: () => startRun({ force: s.n }) }, 'Drill this step') : null].filter(Boolean));
  sheet.classList.add('show');
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const map = document.querySelector('.map');
    if (map) drawMap(map, stepInfo(), document.querySelector('.psheet'));
  }, 150);
});

/* Transitions lab (test mode): play each transition on a demo stage at a game tempo, and
   choose which ones the stream uses. */
function lab() {
  let bpm = 108;
  let flip = 0;
  const stage = h('div', { class: 'stage' });
  const cue = h('div', { class: 'cue' });
  const wrap = h('div', { class: 'stage-wrap' }, stage, cue);
  mouseCatcher.make(stage, {});
  const scenes = [() => GAMES[1].make(stage, {}), () => GAMES[0].make(stage, {})];
  const cues = TASKS.map((t) => t.cue);
  const run = async (tx) => {
    const ctx = snd.ac();
    await snd.load();
    const spb = 60 / bpm;
    const t = ctx.currentTime + 0.1;
    for (let k = 0; k < 3; k++) snd.hit('claves', t + k * spb, k ? 0.4 : 0.7);
    snd.fx.cue(t);
    tx.sound(snd, t, spb);
    setTimeout(() => TX.play(wrap, tx, spb, () => {
      stage.replaceChildren();
      scenes[flip++ % 2]();
      cue.textContent = cues[flip % cues.length];
      bump(cue, 'slam');
    }), Math.max(0, (t - ctx.currentTime + snd.latency()) * 1000));
  };
  const list = h('div', { class: 'txlist' });
  const drawList = () => list.replaceChildren(...[...TX.TRANSITIONS, TX.BOSS_TX].map((tx) =>
    h('button', { class: `txbtn ${st.tx === tx.id ? 'on' : ''}`, onclick: () => run(tx) },
      h('b', {}, tx.name), h('small', {}, tx.about))));
  drawList();
  const choices = { mix: 'Mix them all', ...Object.fromEntries(TX.TRANSITIONS.map((x) => [x.id, x.name])) };
  const pickSel = h('select', { onchange: (e) => { st.tx = e.target.value; save(); drawList(); } },
    ...Object.entries(choices).map(([v, label]) => h('option', { value: v, selected: v === (st.tx || 'mix') }, label)));
  scene('progress');
  app.replaceChildren(h('div', { class: 'progress lab' },
    h('button', { class: 'back', 'aria-label': 'Back', onclick: Q.has('lab') ? () => { location.href = WORKSHOP; } : progress }, '‹'),
    h('h2', {}, 'Transitions lab'),
    h('p', { class: 'note' }, 'Tap one to play it. They run on the beat, so try each tempo.'),
    wrap,
    h('div', { class: 'opts' },
      h('label', {}, 'Tempo', seg({ 92: '92', 108: '108', 126: '126' }, String(bpm), (v) => { bpm = Number(v); })),
      h('label', {}, 'In the game', pickSel)),
    list,
    h('button', { class: 'play', onclick: () => startRun() }, 'Play with these')));
}

/* ---------------- the run ---------------- */

function later(t, fn) {
  if (!R) return;
  const run = R;
  setTimeout(() => { if (R === run && !run.ended) fn(); }, Math.max(0, (t - run.ctx.currentTime + snd.latency()) * 1000));
}

/* The mic for this visit: null until the learner chooses on the mic screen, then 'mic' or
   'none'. Without it, Speak/Sing It doesn't come up. */
let micChoice = null;

/* Before the first run of a visit: a screen that asks for the mic, tests it, and helps when
   the browser blocks it. "Play without the mic" plays on with no Speak/Sing It. */
function micGate(go, problem = '') {
  scene('progress');
  const help = h('div', { class: 'mic-help' });
  const showProblem = (text) => help.replaceChildren(h('p', { class: 'mic-problem' }, text),
    h('ol', {}, h('li', {}, 'Tap the icon left of the web address.'), h('li', {}, 'Set Microphone to Allow.'), h('li', {}, 'Reload the page.')));
  if (problem) showProblem(problem);
  const check = micCheck(showProblem);
  app.replaceChildren(h('div', { class: 'progress howto mic-gate' },
    h('button', { class: 'back', 'aria-label': 'Back', onclick: title }, '‹'),
    h('div', { class: 'mic-big', 'aria-hidden': 'true' }, '🎤'),
    h('h2', { class: 'with-speak' }, 'Sing with the mic!',
      h('button', { class: 'speak', 'aria-label': 'Read it to me', onclick: () => snd.narrate('mic', MIC_SPEECH) }, '🔊')),
    check, help,
    h('button', { class: 'play', onclick: () => { micChoice = 'mic'; go(); } }, 'Let\'s play'),
    h('button', { class: 'link', onclick: () => { micChoice = 'none'; go(); } }, 'Play without the mic')));
}

async function startRun(opts = {}) {
  if (!TEST && !micChoice) { micGate(() => startRun(opts)); return; }
  const ctx = snd.ac();
  scene('run');
  app.replaceChildren(h('div', { class: 'loading' }, mookie(''), h('p', {}, 'Tuning up…')));
  await snd.load();
  if (!TEST) LINEUP = OPT.apply(await OPT.siteOptions());
  let micOn = false;
  let micError = '';
  if (TEST ? st.input === 'mic' : micChoice === 'mic') {
    mic.setEcho(st.echo !== false);
    try { await mic.start(ctx); micOn = true; } catch (e) {
      if (!TEST) { micGate(() => startRun(opts), micProblem(e)); return; }
      micError = micProblem(e);
    }
  }
  const recording = micOn && st.test && st.recMic;
  if (recording) mic.recordStart();
  R = {
    ctx, clock: makeClock(ctx), force: opts.force || TEST?.step || null, lap: 0, plan: [], idx: 0,
    combo: 0, runCombo: 0, runXP: 0, setXP: 0, setMisses: 0, setGames: 0, tempo: LADDER()[0],
    lastGame: null, micOn, paused: false, ended: false, win: null, api: null,
    groove: { mode: 'play', duckFrom: 0, duckUntil: 0, micFrom: Infinity },
    news: micError ? [micError] : [],
    log: recording ? [] : null, // Test mode: every turn, saved with the mic recording
  };
  if (TEST) R.news.push('Workshop test: progress isn\'t saved');
  else if (st.lastDay !== today()) {
    st.days++;
    st.lastDay = today();
    addXP(50);
    R.news.push('Daily downbeat! +50 XP');
  }
  buildRunDom();
  R.clock.onBeat((i, t, spb) => {
    const g = R.groove;
    const duck = t >= g.duckFrom && t < g.duckUntil;
    snd.groove(i, t, spb, { tier: tierOf(R.combo), mode: g.mode, duck: duck && t >= g.micFrom ? 'mic' : duck });
    later(t, () => beat(i, spb));
  });
  mic.listen((time) => R?.onInput?.(time, true));
  beginLap();
}

function lapPlan() {
  const boss = LINEUP.bosses.length ? [{ type: 'boss' }] : [];
  // A workshop test can go straight to the boss.
  if (TEST?.boss && boss.length) return [...boss, { type: 'intermission' }];
  const per = st.mookie ? 3 : 4;
  const plan = [];
  for (let s = 0; s < 3; s++) {
    for (let g = 0; g < per; g++) plan.push({ type: 'game', set: s, first: g === 0, n: g });
    plan.push({ type: 'breather', set: s });
  }
  plan.push(...boss, { type: 'intermission' });
  return plan;
}

/* Every step's strength now, to show what a set or lap added. */
const strengths = () => Object.fromEntries(STEPS.slice(1).map((s) => [s.n, dir.step(s.n).s]));

function beginLap() {
  R.plan = lapPlan();
  R.idx = 0;
  R.lapBefore = strengths();
  R.lapSteps = new Set();
  R.setBefore = R.lapBefore;
  R.setSteps = new Set();
  const g = pickGroove();
  if (g && snd.grooveList(UNIT.meter).length > 1) R.news.push(`Groove: ${g.name}`);
  countIn();
}

/* Four beats of groove with a count, then the stream. */
function countIn() {
  R.groove.mode = 'play';
  const t0 = R.ctx.currentTime + 0.25;
  R.clock.start(t0, R.tempo);
  overlay(h('div', { class: 'card ready' },
    h('div', { class: 'cue-word' }, R.lap ? `Lap ${R.lap + 1}!` : 'Ready?'),
    ...R.news.splice(0).map((n) => h('p', { class: 'news' }, n))));
  [1, 2, 3, 4].forEach((n) => later(R.clock.timeOf(n - 1), () => { R.dom.overlay.querySelector('.cue-word').textContent = String(n); }));
  // Close only the count-in card: a task intro may open on this same beat, and the two
  // timers can fire in either order.
  R.clock.at(4, () => { later(R.clock.timeOf(4), () => { if (R.dom.overlay.querySelector('.ready')) overlay(null); }); next(4); });
}

function next(B) {
  if (!R || R.ended) return;
  if (R.paused) { pauseNow(); return; }
  const seg = R.plan[R.idx++];
  if (seg.type === 'game') {
    if (seg.first) setTempo(seg.set, B);
    gameSeg(B, seg);
  } else if (seg.type === 'breather') breather(B, seg);
  else if (seg.type === 'boss') boss(B);
  else intermission();
}

function setTempo(set, B) {
  let bpm = LADDER()[set];
  // Struggling: hold the rung instead of climbing.
  if (set > 0 && dir.flow() < 0.65) bpm = Math.min(bpm, R.tempo);
  R.tempo = bpm;
  R.clock.setBpm(bpm, B);
  later(R.clock.timeOf(B), () => mic.setTempo(bpm));
  later(R.clock.timeOf(B), hud);
}

/* ---------------- run screen ---------------- */

function buildRunDom() {
  const d = {};
  d.level = h('div', { class: 'lvl' });
  d.xp = h('div', { class: 'xp' });
  d.combo = h('div', { class: 'combo' });
  d.tempo = h('div', { class: 'tempo' });
  d.sets = h('div', { class: 'sets' });
  d.pulse = h('div', { class: 'pulse' }, h('i', {}), h('i', {}));
  d.pause = h('button', { class: 'pause', 'aria-label': 'Pause', onclick: askPause }, '❚❚');
  d.stage = h('div', { class: 'stage' });
  d.cue = h('div', { class: 'cue' });
  d.prompt = h('div', { class: 'prompt' });
  d.dots = h('div', { class: 'dots' });
  d.ball = h('div', { class: 'ball' });
  d.seats = SEATS.map(([layer, tier]) => h('span', { class: 'seat', title: seatInfo(layer).name, 'data-tier': tier, 'data-layer': layer }, seatInfo(layer).icon));
  d.bandTier = -1;
  d.controls = h('div', { class: 'controls' });
  d.overlay = h('div', { class: 'overlay' });
  d.flash = h('div', { class: 'flash' });
  app.replaceChildren(h('div', { class: 'run' },
    h('header', { class: 'hud' }, h('div', { class: 'hud-l' }, d.level, d.xp), d.combo, h('div', { class: 'hud-r' }, d.pulse, d.tempo, d.pause)),
    d.sets,
    h('div', { class: 'stage-wrap' }, d.stage, d.cue, d.flash),
    d.prompt, h('div', { class: 'lane' },
      h('div', { class: 'seats l' }, d.seats[0], d.seats[1]), d.dots, d.ball, h('div', { class: 'seats r' }, d.seats[2], d.seats[3])), d.controls, d.overlay));
  R.dom = d;
  hud();
  document.onkeydown = (e) => {
    if (!R || e.repeat) return;
    if (e.key === 'Escape') { askPause(); return; }
    if (R.keys?.(e)) e.preventDefault();
  };
}

function hud() {
  if (!R) return;
  const d = R.dom;
  const lv = levelOf(st.xp);
  d.level.textContent = `Lv ${lv.n} · ${lv.title}`;
  if (!d.xpFill) {
    d.xpFill = h('span', {});
    d.xpText = h('span', {});
    d.xp.replaceChildren(h('span', { class: 'xpbar' }, d.xpFill), d.xpText);
  }
  d.xpFill.style.width = `${Math.round(lv.frac * 100)}%`;
  d.xpText.textContent = ` ${st.xp} XP`;
  const t = tierOf(R.combo);
  d.combo.className = `combo t${t}`;
  d.combo.replaceChildren(h('b', {}, R.combo ? `${R.combo} in a row` : ''), t ? h('span', {}, ` ×${t + 1} ${TIER_NAMES[t]}`) : '');
  d.tempo.replaceChildren(...LADDER().map((b) => h('i', { class: b <= R.tempo ? 'on' : '' })), h('span', {}, ` ${R.tempo}`));
  const seg = R.plan[R.idx - 1];
  const per = st.mookie ? 3 : 4;
  d.sets.replaceChildren(...[0, 1, 2].map((s) => h('div', { class: `set ${seg?.set === s ? 'now' : ''}` },
    ...Array.from({ length: per }, (_, g) => h('i', { class: seg?.set > s || (seg?.set === s && seg.n >= g) || seg?.type === 'boss' ? 'on' : '' })))),
  h('div', { class: `set boss ${seg?.type === 'boss' ? 'now' : ''}` }, h('i', {})));
}

function overlay(content) {
  R.dom.overlay.replaceChildren(...(content ? [content] : []));
  R.dom.overlay.classList.toggle('show', !!content);
}

function flash(text, cls = '') {
  const f = R.dom.flash;
  f.textContent = text;
  f.className = `flash ${cls}`;
  bump(f, 'go');
}

function addXP(n) {
  n = Math.round(n);
  st.xp += n;
  if (R) { R.runXP += n; R.setXP += n; }
  return n;
}

function pickGame() {
  const others = LINEUP.stream.filter((g) => g !== R.lastGame);
  const list = others.length ? others : LINEUP.stream;
  const g = list[Math.floor(Math.random() * list.length)];
  R.lastGame = g;
  return g;
}

/* ---------------- one micro-game ---------------- */

/* A micro-game: cue (4 beats) · call (4: hear it, read it, or both) · the learner's turn
   (4, any task; Note It 8) · payoff (4; 8 for Writing Create, which plays the learner's pattern back).
   The director has rolled the step, task, stimulus and pattern; the game is any of them. */
function gameSeg(B, seg) {
  const warm = R.lap === 0 && seg.set === 0 && !R.force;
  const pend = R.pending;
  R.pending = null;
  const item = pend?.item || dir.next({ warm, force: R.force, forceTask: TEST?.task, noSay: !R.micOn });
  const game = pend?.game || pickGame();
  // A task's first game at a step: the stream stops for its intro, then this game comes next.
  if (!st.intro[taskKey(item.task, item.step)]) { introBreak(B, item, game); return; }
  const task = taskById(item.task);
  const create = isCreate(item.step);
  const spb = R.clock.spb();
  const T = (i) => R.clock.timeOf(i);
  const c0 = B + 4;
  snd.setGroovePhase(c0); // the call starts on bar 1 of the groove
  const r0 = c0 + 4;
  const n = beatsOf(item.task);
  const p0 = r0 + n;
  const end = p0 + (create && item.task === 'note' ? 8 : 4);
  const turn = makeTurn(item, game, turnUi(T(r0), spb));

  const tx = TX.pick(st.tx);
  if (!snd.speak(cueId(task.cue), T(B))) snd.fx.cue(T(B));
  tx.sound(snd, T(B), spb);
  later(T(B), () => {
    hud();
    showGame(item, game, turn, tx, spb);
  });
  R.groove.duckFrom = T(c0);
  // Only Say It listens: while the mic is on, the groove stays soft through the turn.
  R.groove.duckUntil = R.micOn && item.task === 'say' ? T(p0) : T(r0);
  // Nothing but the call (and a soft pulse) while it plays: no gags, scene sounds or taps.
  snd.clear(T(c0), R.groove.duckUntil);
  R.groove.micFrom = T(r0) - 0.3 * spb;
  for (let k = 0; k < 4; k++) later(T(c0 + k), () => dots(k, 4, 'call'));
  callOut(item, game, T(c0), spb);
  later(T(r0), () => {
    R.dom.controls.classList.add('live');
    R.dom.stage.parentElement.classList.add('yours');
    flash(task.cue, 'turn');
  });
  for (let k = 0; k < n; k++) later(T(r0 + k), () => dots(k, n, 'resp'));
  later(T(p0), () => {
    R.dom.controls.classList.remove('live');
    R.dom.controls.classList.add('over');
    R.dom.stage.parentElement.classList.remove('yours');
    const res = grade(item, turn);
    result(item, res, { onWin: () => R.api.win(), onFail: () => R.api.fail(), t: T(p0) });
    if (create && res.right && res.got) {
      if (item.task === 'note') snd.playBack(res.got, T(p0 + 2), spb);
      R.dom.prompt.replaceChildren(h('div', { class: 'answer' }, h('span', {}, 'Your pattern'), ...answerOf(res.got, item.step)));
    }
  });
  R.clock.at(end, () => next(end));
}

/* The call: the pattern heard (on "bum", in syllables, on the game's instrument, or syllables
   with it), with each note shown in the scene. What's seen goes up in showGame. */
function callOut(item, game, t, spb) {
  const hear = item.stim.hear;
  if (!hear) return;
  snd.call(item.pattern, hear, t, spb, game.play);
  const syl = hear.startsWith('syllables');
  onsets(item.pattern).forEach((o, i) => later(t + o.b * spb, () => R.api.onCall(i, syl ? o.syl : null)));
  if (item.task === 'du' && item.step === 2) fingerShows(item.pattern, t, spb);
}

/* Du It at step 2 (CS Rote): while the call plays, a finger taps the tile for each syllable
   it says, in time (du-de twice), so the learner sees which tile is which. */
function fingerShows(pattern, t, spb) {
  const host = R.dom.controls;
  const hand = h('span', { class: 'ghost', 'aria-hidden': 'true' }, '👆');
  const tileOf = (o) => host.querySelector(pattern.cells[Math.floor(o.b)] === 'q' ? '.du-q' : '.du-ee');
  const point = (tile) => {
    if (!tile) return;
    if (!hand.isConnected) host.append(hand);
    const box = host.getBoundingClientRect();
    const r = tile.getBoundingClientRect();
    hand.style.left = `${r.left - box.left + r.width / 2}px`;
    hand.style.top = `${r.top - box.top + r.height * 0.55}px`;
    hand.classList.add('on');
  };
  onsets(pattern).forEach((o) => {
    later(t + (o.b - 0.35) * spb, () => point(tileOf(o)));
    later(t + o.b * spb, () => {
      const tile = tileOf(o);
      point(tile);
      bump(hand, 'tap');
      if (tile) bump(tile, 'hit');
    });
  });
  later(t + 4 * spb, () => hand.remove());
}

/* What a turn needs from the run: the clock, sounds, the mic, and tap feedback drawn on the
   controls and the beat lane. */
function turnUi(tResp, spb) {
  return {
    h, mic: R.micOn, tResp, spb,
    now: () => R.ctx.currentTime,
    latency: () => snd.latency(),
    hit: (name, vol) => snd.hit(name, R.ctx.currentTime, vol),
    onPress: () => R.api?.onTap(),
    // Tap feedback: a ripple where the finger landed, coloured by timing when the answer is
    // known (on time, close, off), and a tick on the beat lane where the tap fell.
    feel: ({ el, ev, b, open, cls, word }) => {
      const r = el.getBoundingClientRect();
      const x = ev?.clientX != null ? ev.clientX - r.left : r.width / 2;
      const y = ev?.clientY != null ? ev.clientY - r.top : r.height / 2;
      FX.ripple(el, x, y, cls);
      if (word) FX.pop(el, x, y - 24, word, cls);
      if (open) tick(b, cls);
    },
  };
}

/* The turn's controls go in, and the keyboard and the mic answer to them. */
function useTurn(turn) {
  R.turn = turn;
  R.dom.controls.classList.remove('over');
  R.keys = turn.keys;
  R.onInput = turn.input;
  R.dom.controls.replaceChildren(turn.el);
  if (turn.meter) {
    const fill = turn.meter;
    const draw = () => {
      if (!fill.isConnected) return;
      fill.style.setProperty('--lv', Math.min(1, mic.getLevel() * 1.4).toFixed(2));
      requestAnimationFrame(draw);
    };
    draw();
  }
}

/* Stop the stream for a task intro (intro.js), then count back in to the same game. */
function introBreak(B, item, game) {
  R.pending = { item, game };
  R.idx--; // this game segment again after the intro
  R.clock.stop();
  R.groove.mode = 'off';
  snd.grooveStop();
  const key = taskKey(item.task, item.step);
  later(R.clock.timeOf(B), () => {
    R.dom.controls.replaceChildren();
    clearDots();
    const card = h('div', {});
    overlay(card);
    const intro = showIntro(card, key, { h, notes, sylIcons, mic: R.micOn }, () => {
      st.intro[key] = 1;
      save();
      R.keys = null;
      R.onInput = null;
      overlay(null);
      countIn();
    }, { game });
    R.keys = intro.keys;
    // The mic answers the practice round too.
    R.onInput = (time, fromMic) => { if (fromMic) intro.mic(time); };
  });
}

function dots(k, n, kind) {
  if (k === 0 && kind === 'call') clearTicks();
  R.dom.dots.className = `dots ${kind}${n > 4 ? ' long' : ''}`;
  R.dom.dots.replaceChildren(...Array.from({ length: n }, (_, i) => h('i', { class: i < k ? 'past' : i === k ? 'now' : '' })));
  hop(k, n, kind);
}

/* Beat cues: every beat of the groove. The run's pulse lights beat 1 or 2 of the bar (2/4),
   the scene's characters move on the beat (each game's onBeat), and the stage thumps on
   beat 1, harder as the band grows with the combo. */
function beat(i, spb) {
  const d = R.dom;
  const down = i % 2 === 0;
  d.pulse.className = `pulse ${down ? 'one' : 'two'}`;
  bump(d.pulse.children[down ? 0 : 1], 'beat');
  R.api?.onBeat?.(down, spb, tierOf(R.combo));
  seats(down);
  if (down && R.groove.mode === 'play') {
    const wrap = d.stage.parentElement;
    wrap.dataset.tier = tierOf(R.combo);
    bump(wrap, 'thump');
  }
}

/* The band beside the lane: seats light up as layers join (a pop when one joins) and the
   ones playing bob on every beat. */
function seats(down) {
  const d = R.dom;
  const tier = tierOf(R.combo);
  d.seats.forEach((el) => {
    // The groove can change between laps: keep each seat's icon and name its own.
    const info = seatInfo(el.dataset.layer);
    if (el.textContent !== info.icon) el.textContent = info.icon;
    if (el.title !== info.name) el.title = info.name;
    const on = Number(el.dataset.tier) <= tier;
    if (on && !el.classList.contains('on') && d.bandTier >= 0) bump(el, 'join');
    el.classList.toggle('on', on);
    if (on) bump(el, down ? 'bob' : 'bob2');
  });
  d.bandTier = tier;
}

/* The bouncing ball: lands on each beat's dot and hops to the next one in one beat. */
function hop(k, n, kind) {
  const { dots: row, ball } = R.dom;
  const spb = R.clock.spb();
  const x = (j) => {
    const dot = row.children[j];
    return dot.offsetLeft + dot.offsetWidth / 2 - ball.offsetWidth / 2;
  };
  ball.className = `ball on ${kind}`;
  ball.getAnimations().forEach((a) => a.cancel());
  const x0 = x(k);
  const at = (px, y, sx = 1, sy = 1) => `translate(${px}px, ${y}px) scale(${sx}, ${sy})`;
  // Last beat of the call: hop back to the start for the response. Last of the response: stay.
  if (k + 1 >= n && kind !== 'call') {
    ball.animate([{ transform: at(x0, 0, 1.35, 0.7) }, { transform: at(x0, 0), offset: 0.15 }, { transform: at(x0, 0) }], { duration: spb * 1000, fill: 'forwards' });
    return;
  }
  const x1 = x(k + 1 >= n ? 0 : k + 1);
  ball.animate([
    { transform: at(x0, 0, 1.35, 0.7), easing: 'ease-out' },
    { transform: at(x0, -2, 0.9, 1.15), offset: 0.12, easing: 'cubic-bezier(.2,.6,.4,1)' },
    { transform: at((x0 + x1) / 2, k + 1 >= n ? -52 : -36), offset: 0.55, easing: 'cubic-bezier(.6,0,.8,.4)' },
    { transform: at(x1, 0) },
  ], { duration: spb * 1000, fill: 'forwards' });
}

function clearDots() {
  R.dom.dots.replaceChildren();
  R.dom.ball.className = 'ball';
  clearTicks();
}

const clearTicks = () => R.dom.dots.parentElement.querySelectorAll('.tick').forEach((t) => t.remove());

/* A mark on the beat lane where a tap fell (b: beats after the response began). */
function tick(b, cls) {
  const row = R.dom.dots;
  const n = row.children.length;
  if (!n) return;
  const cx = (j) => row.children[j].offsetLeft + row.children[j].offsetWidth / 2;
  const gap = n > 1 ? cx(1) - cx(0) : 22;
  const k = Math.max(0, Math.min(n - 1, Math.floor(b)));
  if (b < -0.5) return;
  const x = cx(k) + (b - k) * gap;
  const m = h('i', { class: `tick ${cls}` });
  m.style.left = `${x}px`;
  row.parentElement.append(m);
}

function showGame(item, game, turn, tx, spb) {
  const d = R.dom;
  overlay(null);
  // The new scene goes in once the transition has hidden the old one (transitions.js).
  R.api = game.make(h('div'), {});
  TX.play(d.stage.parentElement, tx, spb, () => {
    if (!R || R.dom !== d) return;
    d.stage.replaceChildren();
    R.api = game.make(d.stage, {});
  });
  d.cue.textContent = taskById(item.task).cue;
  bump(d.cue, 'slam');
  d.prompt.replaceChildren(instruction(item, game));
  bigHow(item, game);
  if (item.stim.see) d.prompt.append(notes(item.pattern));
  clearDots();
  R.item = item;
  useTurn(turn);
}

const LOOK_ICON = { listen: '👂', read: '👀', both: '👀' };

/* The what-to-do line, on screen for the whole game. The first time a task comes up at a
   step it's marked NEW and stays big. */
function instruction(item, game) {
  const key = taskKey(item.task, item.step);
  const fresh = !st.seen[key];
  st.seen[key] = 1;
  const { short: how, look } = howTo(item, game);
  return h('div', { class: `say${fresh ? ' new' : ''}` },
    st.mookie ? mookie('happy') : h('span', { class: 'ic' }, LOOK_ICON[look] || '✏️'),
    fresh ? h('b', { class: 'tag' }, 'NEW') : null,
    h('span', {}, how));
}

/* The instruction pops up big over the scene at the start of each game, then shrinks
   away into the line under it. Held for 4 beats (at least 2.4 s) so it can be read. */
function bigHow(item, game) {
  const wrap = R.dom.stage.parentElement;
  wrap.querySelector('.how-big')?.remove();
  const el = h('div', { class: 'how-big' }, h('span', {}, howTo(item, game).short));
  el.style.animationDuration = `${Math.max(2.4, 4 * R.clock.spb())}s`;
  el.addEventListener('animationend', () => el.remove());
  wrap.append(el);
}

function grade(item, turn) {
  const res = turn.grade();
  turn.reveal(res);
  R.log?.push({
    step: item.step, task: item.task, stim: item.stim, cells: item.pattern.cells, bpm: R.tempo,
    spb: R.clock.spb(), tResp: turn.tResp, inputs: turn.inputs(), right: res.right, why: res.why || '',
  });
  return res;
}

let lastPraise = null;
function nextPraise() {
  const options = PRAISE.filter((c) => c !== lastPraise);
  lastPraise = options[Math.floor(Math.random() * options.length)];
  return lastPraise;
}

/* XP for a right answer: 10 (+5 perfect) × tempo × the mic (×1.5) × the task (Speak/Sing It
   ×1.5) × no notes to look at in Note It (×1.5) × a create answer's freshness × the combo. */
function result(item, res, { onWin, onFail, t, quiet = false }) {
  const rec = dir.record({ item, right: res.right, bpm: R.tempo });
  if (rec.mastered) R.news.push(`★ Step ${rec.mastered} mastered: ${STEPS[rec.mastered].name}`);
  R.setGames++;
  R.setSteps?.add(item.step);
  R.lapSteps?.add(item.step);
  if (res.right) {
    const before = tierOf(R.combo);
    R.combo++;
    R.runCombo = Math.max(R.runCombo, R.combo);
    const tier = tierOf(R.combo);
    let mult = taskById(item.task).xp;
    if (item.task === 'note' && !item.stim.see) mult *= XP_NO_NOTES;
    // Improvised and composed answers: the same pattern again soon earns less.
    let repeats = 0;
    if (isCreate(item.step) && res.got) {
      repeats = st.made.filter((id) => id === res.got.id).length;
      mult *= repeatFactor(repeats);
      st.made = [...st.made, res.got.id].slice(-12);
    }
    const gained = addXP((10 + (res.perfect ? 5 : 0)) * (TEMPO_XP[R.tempo] || 1) * (res.mic ? 1.5 : 1) * mult * (tier + 1));
    onWin();
    snd.fx.win(t);
    // Right: confetti (stars when perfect) that grows with the combo, and the XP flies to the counter.
    const wrap = R.dom.stage.parentElement;
    FX.burst(wrap, { kind: res.perfect ? 'stars' : 'confetti', y: 0.45, count: 14 + tier * 6, spread: 1 + tier * 0.25 });
    FX.fly(wrap, R.dom.xp, `+${gained}`, res.perfect ? 'gold' : '');
    if (tier > before) {
      snd.fx.tier(t);
      snd.speak(cueId(TIER_NAMES[tier]), t);
      flash(`${TIER_NAMES[tier]}! ×${tier + 1}`, `tier t${tier}`);
      FX.shockwave(wrap, TIER_COLORS[tier]);
      FX.parade(wrap, bandAt(tier));
    } else if (repeats && !quiet) {
      flash('Nice! Try a new one next time', 'plus');
    } else {
      // A praise word on screen, and said once Kyle has recorded it; never the same twice running.
      const p = res.perfect ? null : nextPraise();
      if (res.perfect) snd.speak('perfect', t);
      else snd.speak(p.id, t);
      if (!quiet) flash(res.perfect ? 'PERFECT!' : p.text, res.perfect ? 'plus gold' : 'plus');
    }
  } else {
    const was = R.combo;
    const tier = tierOf(R.combo);
    R.combo = st.mookie && tier > 0 ? TIERS[tier - 1] : 0;
    R.setMisses++;
    onFail();
    if (was >= 3) snd.fx.scratch(t);
    else snd.fx.fail(t);
    // Miss: the stage wobbles, and a lost combo falls off the counter.
    bump(R.dom.stage.parentElement, 'fx-miss');
    if (was >= 3) R.lostCombo = was;
    if (!quiet) {
      const create = isCreate(item.step);
      R.dom.prompt.replaceChildren(h('div', { class: 'answer' },
        h('span', {}, WHY[res.why] || (create ? '' : 'It was')),
        ...(create ? [] : answerOf(item.pattern, item.step))));
    }
  }
  st.bestCombo = Math.max(st.bestCombo, R.combo);
  save();
  hud();
  if (res.right) bump(R.dom.combo, 'fx-got');
  else if (R.lostCombo) {
    FX.drop(R.dom.combo, `${R.lostCombo} in a row`);
    bump(R.dom.combo, 'fx-no');
    R.lostCombo = 0;
  }
}

/* ---------------- breather ---------------- */

function breather(B, seg) {
  const T = (i) => R.clock.timeOf(i);
  R.groove.mode = 'breakdown';
  const chips = [];
  if (R.combo >= 3) chips.push(['🔥', `${R.combo} in a row`]);
  if (R.setMisses === 0 && R.setGames > 0) chips.push(['🎯', `No misses +${addXP(50)}`]);
  const lvBefore = levelOf(st.xp - R.setXP).n;
  const lv = levelOf(st.xp);
  if (lv.n > lvBefore) chips.push(['⬆️', `Level ${lv.n}`]);
  if (!R.force) {
    const opened = dir.advance();
    if (opened) {
      chips.push(['🆕', `Step ${opened}`]);
      snd.speak('new-step', T(B));
    }
    if (dir.step(12).mastered && !st.unitDone) { st.unitDone = true; chips.push(['🏆', 'Unit 1']); }
  }
  const news = R.news.splice(0);
  const setXP = R.setXP;
  const played = [...R.setSteps].sort((a, b) => a - b);
  const before = R.setBefore;
  R.setXP = 0;
  R.setMisses = 0;
  R.setGames = 0;
  R.setBefore = strengths();
  R.setSteps = new Set();
  save();
  const sets = R.plan.filter((x) => x.type === 'breather').length;
  later(T(B), () => {
    const count = h('span', {}, '+0');
    const spb = R.clock.spb();
    overlay(h('div', { class: 'card breather win' },
      h('div', { class: 'win-head' },
        h('div', { class: 'set-dots', 'aria-label': `Set ${seg.set + 1} of ${sets}` },
          ...Array.from({ length: sets }, (_, k) => h('i', { class: k <= seg.set ? 'on' : '' }))),
        h('div', { class: 'cue-word small' }, `Set ${seg.set + 1} ✓`)),
      h('div', { class: 'big-xp' }, h('span', { class: 'star' }, '⭐'), count),
      chips.length ? h('div', { class: 'win-chips' }, ...chips.map(([ic, t]) => chip(ic, t))) : null,
      growth(played, before, spb),
      ...news.map((l) => h('p', { class: 'news' }, l)),
      dancer(spb)));
    // XP counts up on the beat, with a pop of notes; confetti for no misses, a level or a step.
    for (let k = 1; k <= 4; k++) later(T(B + k), () => { count.textContent = `+${Math.round(setXP * k / 4)}`; bump(count.parentElement, 'beat'); FX.burst(count, { kind: 'notes', count: 5, spread: 0.6 }); });
    if (chips.some(([ic]) => ic !== '🔥')) later(T(B + 1), () => FX.burst(R.dom.overlay.querySelector('.card'), { y: 0.2, count: 30, spread: 1.6 }));
    hud();
  });
  R.clock.at(B + 8, () => {
    R.groove.mode = 'play';
    next(B + 8);
  });
}

const chip = (ic, text) => h('span', { class: 'win-chip' }, h('span', { 'aria-hidden': 'true' }, ic), text);

/* Mookie dances to the beat on the set and lap screens. */
function dancer(spb) {
  const m = mookie('happy');
  m.classList.add('dance');
  m.style.animationDuration = `${2 * spb}s`;
  return m;
}

/* The steps played, each with its strength before (filled) and what was added (growing in),
   a ★ when it's mastered. */
function growth(ns, before, spb) {
  if (!ns.length) return null;
  const rows = ns.map((n, i) => {
    const s = STEPS[n];
    const was = Math.round(before?.[n] ?? 0);
    const now = Math.round(dir.step(n).s);
    const add = h('i', { class: 'add' });
    const lost = h('i', { class: 'lost' });
    const base = h('i', { class: 'was' });
    base.style.width = `${Math.min(was, now)}%`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      add.style.transitionDelay = lost.style.transitionDelay = `${0.3 + i * spb * 0.5}s`;
      add.style.width = `${Math.max(0, now - was)}%`;
      lost.style.width = `${Math.max(0, was - now)}%`;
    }));
    return h('div', { class: `sg ${s.band}` },
      h('span', { class: 'sg-n' }, String(n), dir.step(n).mastered ? h('b', {}, '★') : null),
      h('span', { class: 'sg-mid' }, h('small', {}, s.name), h('span', { class: 'sg-bar' }, base, add, lost)),
      h('b', { class: 'sg-plus' }, now > was ? `+${now - was}` : ''));
  });
  return h('div', { class: 'sgrow' }, ...rows);
}

/* ---------------- boss ---------------- */

/* A boss round's item: any task the learner has met (its intro seen), so the boss never
   springs a task on them that they haven't been shown. */
function bossItem() {
  let item = null;
  for (let k = 0; k < 8; k++) {
    item = dir.next({ force: R.force, forceTask: TEST?.task, noSay: !R.micOn });
    if (st.intro[taskKey(item.task, item.step)]) break;
  }
  return item;
}

/* The boss alternates by lap between the games that host one (The Big Cheese in Mouse
   Catcher, The Big Fluff in Supper Time; the workshop's options choose which do). Four
   rounds of call, turn and payoff (4 beats, so the hit or miss is over before the next
   call), each any task; three hits beat him. */
function boss(B) {
  const game = LINEUP.bosses[R.lap % LINEUP.bosses.length];
  const T = (i) => R.clock.timeOf(i);
  const spb = R.clock.spb();
  const rounds = 4;
  let hits = 0;
  snd.fx.boss(T(B));
  snd.speak('boss', T(B));
  TX.BOSS_TX.sound(snd, T(B), spb);
  later(T(B), () => {
    hud();
    overlay(null);
    const d = R.dom;
    R.api = game.make(h('div'), { boss: true });
    TX.play(d.stage.parentElement, TX.BOSS_TX, spb, () => {
      if (!R || R.dom !== d) return;
      d.stage.replaceChildren();
      R.api = game.make(d.stage, { boss: true });
    });
    R.dom.cue.textContent = 'BOSS!';
    bump(R.dom.cue, 'slam');
    R.dom.prompt.replaceChildren(h('div', { class: 'boss-name' }, game.bossName), h('div', { class: 'hearts' }, '❤️❤️❤️❤️'));
  });
  let c0 = B + 4;
  for (let r = 0; r < rounds; r++) {
    const r0 = c0 + 4;
    const item = bossItem();
    const task = taskById(item.task);
    const n = beatsOf(item.task);
    const p0 = r0 + n;
    const call = c0;
    const turn = makeTurn(item, game, turnUi(T(r0), spb));
    // Each round sets the groove as it starts: soft under the call (and Speak/Sing It's turn
    // with the mic), and bar 1 on the call, whatever the turn before it took.
    const groove = () => {
      R.groove.duckFrom = T(call);
      R.groove.duckUntil = T(R.micOn && item.task === 'say' ? p0 : r0);
      snd.clear(T(call), R.groove.duckUntil);
      R.groove.micFrom = T(r0) - 0.3 * spb;
      snd.setGroovePhase(call);
    };
    if (r) R.clock.at(call, groove);
    else groove();
    later(T(call), () => {
      R.dom.prompt.querySelector('.notation')?.remove();
      R.dom.prompt.querySelector('.say')?.remove();
      const { short: how, look } = howTo(item, game);
      R.dom.prompt.append(h('div', { class: 'say' }, h('span', { class: 'ic' }, LOOK_ICON[look] || '✏️'), h('span', {}, how)));
      if (item.stim.see) R.dom.prompt.append(notes(item.pattern));
      R.item = item;
      useTurn(turn);
    });
    for (let k = 0; k < 4; k++) later(T(call + k), () => dots(k, 4, 'call'));
    callOut(item, game, T(call), spb);
    later(T(r0), () => { R.dom.controls.classList.add('live'); flash(task.cue, 'turn'); });
    for (let k = 0; k < n; k++) later(T(r0 + k), () => dots(k, n, 'resp'));
    later(T(p0), () => {
      R.dom.controls.classList.remove('live');
      R.dom.controls.classList.add('over');
      const res = grade(item, turn);
      if (res.right) hits++;
      result(item, res, {
        t: T(p0),
        quiet: true,
        onWin: () => {
          const hearts = R.dom.prompt.querySelector('.hearts');
          hearts.textContent = '❤️'.repeat(rounds - hits) + '🖤'.repeat(hits);
          bump(hearts, 'fx-hit');
          flash('BAM!', 'plus');
          R.api.hit?.();
        },
        onFail: () => { bump(R.dom.prompt.querySelector('.hearts'), 'fx-no'); flash('missed!', 'bad'); R.api.miss?.(); },
      });
    });
    c0 = p0 + 4; // the hit or miss plays out before the next call
  }
  const done = c0;
  later(T(done), () => {
    if (hits >= 3) {
      R.api.win();
      const gained = addXP(100);
      const sticker = STICKERS.find((s) => !st.stickers.includes(s));
      if (sticker) st.stickers.push(sticker);
      R.news.push(`Beat ${game.bossName}! +${gained} XP${sticker ? ` and a new sticker ${sticker}` : ''}`);
    } else {
      R.api.fail();
      addXP(20);
      R.news.push(`${game.bossName} got away. Next lap!`);
    }
    save();
    R.dom.controls.replaceChildren();
    R.keys = null;
    R.onInput = null;
    clearDots();
    hud();
  });
  R.clock.at(done + 4, () => next(done + 4));
}

/* ---------------- intermission, pause, end ---------------- */

function intermission() {
  R.clock.stop();
  R.groove.mode = 'off';
  snd.grooveStop();
  const lv = levelOf(st.xp);
  const tile = (ic, big, small) => h('div', { class: 'win-tile' }, h('span', { class: 'ic', 'aria-hidden': 'true' }, ic), h('b', {}, big), h('small', {}, small));
  const nextN = R.force || st.frontier;
  overlay(h('div', { class: 'card intermission win' },
    h('div', { class: 'win-head' }, h('div', { class: 'cue-word small' }, `Lap ${R.lap + 1} ✓`)),
    h('div', { class: 'win-tiles' },
      tile('⭐', `+${R.runXP}`, 'XP'),
      tile('🔥', String(R.runCombo), 'best in a row'),
      tile('🏅', `Level ${lv.n}`, lv.title)),
    ...R.news.splice(0).map((n) => h('p', { class: 'news' }, n)),
    growth([...R.lapSteps].sort((a, b) => a - b), R.lapBefore, 0.5),
    h('div', { class: 'win-next' }, h('small', {}, 'Next'), h('span', { class: `sg-n ${STEPS[nextN].band}` }, String(nextN)), h('b', {}, STEPS[nextN].name)),
    dancer(0.6),
    h('div', { class: 'row' },
      h('button', { class: 'play', onclick: () => { overlay(null); R.lap++; beginLap(); } }, 'Keep going'),
      h('button', { class: 'link', onclick: endRun }, 'Done for today'))));
  FX.burst(R.dom.overlay.querySelector('.card'), { y: 0.15, count: 36, spread: 1.8 });
}

function askPause() {
  if (!R || R.paused) return;
  R.paused = true;
  flash('Pausing after this one…', 'small');
}

function pauseNow() {
  R.clock.stop();
  R.groove.mode = 'off';
  snd.grooveStop();
  overlay(h('div', { class: 'card' },
    h('div', { class: 'cue-word small' }, 'Paused'),
    h('div', { class: 'row' },
      h('button', { class: 'play', onclick: () => { R.paused = false; overlay(null); countIn(); } }, 'Resume'),
      h('button', { class: 'link', onclick: endRun }, 'Quit'))));
}

function endRun() {
  if (!R) return;
  R.ended = true;
  R.clock.stop();
  snd.grooveStop();
  if (R.log) saveRecording(R.log, R.ctx);
  else mic.stop();
  document.onkeydown = null;
  R = null;
  save();
  if (TEST) testTitle();
  else title();
}

/* Test mode: the run's mic recording as a .wav file, with every turn (beat times, pattern,
   what was counted) in a JSON chunk inside it, so the two stay together. It only goes
   where the learner saves it. */
async function saveRecording(log, ctx) {
  const r = await mic.recordStop();
  mic.stop();
  if (!r) return;
  const step = r.rate > 30000 ? 2 : 1; // 48 kHz → 24 kHz is plenty for speech
  const n = Math.floor(r.samples.length / step);
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = 0; k < step; k++) v += r.samples[i * step + k];
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round((v / step) * 32767)));
  }
  const info = new TextEncoder().encode(JSON.stringify({
    v: 1, rate: r.rate / step, t0: r.t0, onsets: r.onsets, turns: log,
    outputLatency: snd.latency(), inputLag: mic.inputLag(), echo: st.echo !== false,
    sampleRate: ctx.sampleRate, settings: r.settings, ua: navigator.userAgent,
  }));
  const pad = info.length % 2;
  const size = 4 + (8 + 16) + (8 + info.length + pad) + (8 + pcm.byteLength);
  const buf = new ArrayBuffer(8 + size);
  const dv = new DataView(buf);
  let o = 0;
  const tag = (s) => { for (let i = 0; i < 4; i++) dv.setUint8(o++, s.charCodeAt(i)); };
  const u32 = (x) => { dv.setUint32(o, x, true); o += 4; };
  const u16 = (x) => { dv.setUint16(o, x, true); o += 2; };
  tag('RIFF'); u32(size); tag('WAVE');
  tag('fmt '); u32(16); u16(1); u16(1); u32(r.rate / step); u32(r.rate / step * 2); u16(2); u16(16);
  tag('mmlg'); u32(info.length); new Uint8Array(buf, o, info.length).set(info); o += info.length + pad;
  tag('data'); u32(pcm.byteLength); new Int16Array(buf, o, n).set(pcm);
  const a = h('a', { href: URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })), download: `musician-maker-mic-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.wav` });
  document.body.append(a);
  a.click();
  a.remove();
}

/* The start of a workshop test run: what's being tested, Play, and the way back. */
function testTitle() {
  scene('progress');
  const g = TEST.game;
  const bits = [
    TEST.step ? `Step ${TEST.step}: ${STEPS[TEST.step].name}` : 'Steps from my progress',
    TEST.task ? taskById(TEST.task).name : null,
    TEST.tempo ? `${TEST.tempo} bpm` : `${LADDER().join(' · ')} bpm`,
    TEST.boss && LINEUP.bosses.length ? `straight to ${g.bossName}` : null,
    TEST.mookie ? 'Mookie mode' : null,
  ].filter(Boolean);
  app.replaceChildren(h('div', { class: 'progress howto test-title' },
    h('a', { class: 'back', 'aria-label': 'Back to the workshop', href: WORKSHOP }, '‹'),
    h('h2', {}, `Test: ${g.name}`),
    h('p', {}, bits.join(' · ')),
    h('p', { class: 'note' }, 'Only this game comes up, with the workshop\'s options. Progress isn\'t saved.'),
    h('div', { class: 'switches' },
      toggle('Use the mic', 'Say your answers too', st.input === 'mic', (v) => { st.input = v ? 'mic' : 'tap'; testTitle(); }),
      st.input === 'mic' ? micCheck() : null),
    h('button', { class: 'play', onclick: () => startRun() }, 'Play'),
    h('a', { class: 'link', href: WORKSHOP }, 'Back to the workshop')));
}

if (Q.has('debug')) window.mmDebug = () => R;

/* A task intro on its own, from the workshop (?intro=<key>, &game=<id> for its object and
   instrument). */
function introPreview(key) {
  scene('progress');
  const game = GAMES.find((g) => g.id === Q.get('game')) || LINEUP.stream[0] || GAMES[0];
  const card = h('div', { class: 'intro-preview' });
  app.replaceChildren(h('div', { class: 'progress' },
    h('a', { class: 'back', 'aria-label': 'Back to the workshop', href: WORKSHOP }, '‹'), card));
  const show = (micOn) => {
    const intro = showIntro(card, key, { h, notes, sylIcons, mic: micOn }, () => { location.href = WORKSHOP; }, { game });
    if (micOn) { mic.setTempo(84); mic.listen((time) => intro.mic(time)); }
    document.onkeydown = (e) => { if (!e.repeat && intro.keys(e)) e.preventDefault(); };
  };
  // Speak/Sing It needs the mic, here too.
  if (key.startsWith('say-')) mic.start(snd.ac()).then(() => show(true), () => show(false));
  else show(false);
}

// Markup mode (markup.js): Kyle's notes on any screen, in Test mode and workshop tests.
markup.setup({
  enabled: () => !!(st.test || TEST || Q.has('markup')),
  audio: () => snd.ac(),
  where: () => {
    const bits = [document.body.dataset.screen];
    if (R) bits.push(`${R.tempo} bpm`, R.item ? `${taskById(R.item.task).name}, step ${R.item.step}` : '', R.dom?.cue?.textContent || '');
    if (TEST) bits.push(`test: ${TEST.game.name}`);
    return bits.filter(Boolean).join(' · ');
  },
});

if (TEST) testTitle();
else if (allTaskKeys().includes(Q.get('intro'))) introPreview(Q.get('intro'));
else if (Q.has('lab')) lab();
else title();
