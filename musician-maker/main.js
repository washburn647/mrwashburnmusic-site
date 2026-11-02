/* Musician Maker: one nonstop stream of micro-games on one groove.
   A run is laps of three sets (92, 108, 126 bpm), each set followed by a breather, then a
   boss and an intermission. A micro-game is cue (4 beats), call (4), response, payoff (4):
   whole 2-bar phrases, so the groove's 4-bar loop starts again on every call.
   The director (director.js) picks every game; the groove (sound.js) grows with the combo.
   Why it works this way: the stream engine design doc in the project. */

import * as snd from './sound.js';
import { makeClock } from './clock.js';
import * as mic from './mic.js';
import { STEPS, BANDS, UNIT, onsets, sylText, options, readTaps, fromCells, loadMarks, howTo } from './steps.js';
import { makeDirector, tierOf, TIERS, TIER_NAMES, levelOf } from './director.js';
import { GAMES, mouseCatcher, bump } from './games.js';
import { mookie } from './mookie.js';
import * as TX from './transitions.js';
import * as FX from './effects.js';
import { cueId } from './cues.js';
import { notation } from '/assets/patterns/notation.js';
import * as store from './store.js';

const app = document.getElementById('app');
let st = store.load();
let dir = makeDirector(st);
let R = null; // the run being played
loadMarks();

const save = () => store.save(st);
const today = () => new Date().toLocaleDateString('en-CA');
const LADDER = () => (st.mookie ? [92, 108, 108] : [92, 108, 126]);
const TEMPO_XP = { 92: 1, 108: 1.5, 126: 2 };
const TIER_COLORS = ['#5E7D4F', '#5E7D4F', '#d08a2e', '#C46A5A', '#8a5ac4'];
// The band joining at each combo tier: bass, drums, horns, everyone.
const BAND = [[], ['🎸'], ['🥁', '🎸'], ['🎺', '🥁', '🎺'], ['🎷', '🎺', '🥁', '🎸', '🎹']];
// The band's seats beside the beat lane: each lights up when its layer joins, and bobs on the beat.
const SEATS = [['🎸', 'Bass', 1], ['🥁', 'Drums', 2], ['🎺', 'Horns', 3], ['🎹', 'Keys', 4]];
const PRAISE = ['Yes!', 'Nice!', 'Got it!', 'Woo!', 'Yeah!'];
const STICKERS = ['🧀', '🐭', '🥁', '🎺', '🎻', '🪕', '🎷', '🏆'];
const GAGS = ['Mookie licks a paw. Coolly.', 'Mookie knocks a pencil off the desk.', 'Mookie does a little stretch.',
  'Mookie stares at nothing for a while.', 'Mookie pretends that was on purpose.', 'Mookie purrs in 2/4.'];

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
  document.body.dataset.screen = name;
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

const NOTE_SVG = {
  q: '<svg viewBox="0 0 20 40" aria-hidden="true"><ellipse cx="7.5" cy="33" rx="7" ry="5" transform="rotate(-20 7.5 33)"/><rect x="12.6" y="3" width="2.4" height="30"/></svg>',
  ee: '<svg viewBox="0 0 42 40" aria-hidden="true"><ellipse cx="7.5" cy="33" rx="7" ry="5" transform="rotate(-20 7.5 33)"/><ellipse cx="30.5" cy="33" rx="7" ry="5" transform="rotate(-20 30.5 33)"/><rect x="12.6" y="5" width="2.4" height="28"/><rect x="35.6" y="5" width="2.4" height="28"/><rect x="12.6" y="3" width="25.4" height="6"/></svg>',
};

function floatNote(kind, i) {
  const el = h('span', { class: `fnote fn${i}` });
  el.innerHTML = NOTE_SVG[kind]; // fixed markup above
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
        toggle('Use the mic', 'Say your answers too', st.input === 'mic', (v) => { st.input = v ? 'mic' : 'tap'; save(); title(); }),
        st.input === 'mic' ? micCheck() : null,
        groovePick()),
      h('button', { class: 'to-map', onclick: progress },
        h('span', { class: 'staff-ico' }), 'My progress'))));
}

/* Say "du du-de du du" and watch the meter: shows whether the mic hears you, and how many
   syllables it counts. A pause of 1.5 s starts a new count, so each try is counted alone. */
function micCheck() {
  const fill = h('span', {});
  const heard = h('span', { class: 'heard' }, '');
  let count = 0;
  let lastAt = -9;
  let raf = 0;
  const box = h('div', { class: 'miccheck' },
    h('button', { class: 'mini', onclick: async () => {
      try {
        await mic.start(snd.ac());
        heard.textContent = 'Say "du du-de du du"…';
        mic.listen((t) => {
          if (t - lastAt > 1.5) count = 0;
          lastAt = t;
          count++;
          heard.textContent = `Heard ${count} ${count === 1 ? 'syllable' : 'syllables'}`;
          bump(fill.parentElement, 'blip');
        });
        const draw = () => {
          if (!box.isConnected) { mic.stop(); return; }
          fill.style.width = `${Math.round(mic.getLevel() * 100)}%`;
          raf = requestAnimationFrame(draw);
        };
        cancelAnimationFrame(raf);
        draw();
      } catch (e) {
        heard.textContent = micProblem(e);
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
      tip('🥁', 'Do what the words say: tap it, say it, pick it or build it.'),
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

function progress() {
  scene('progress');
  const info = stepInfo();
  const done = info.filter((i) => i.state === 'mastered').length;
  const map = h('div', { class: 'map' });
  const sheet = h('div', { class: 'psheet', role: 'dialog' });
  app.replaceChildren(h('div', { class: 'progress' },
    h('header', { class: 'phead' },
      h('button', { class: 'back', 'aria-label': 'Back', onclick: () => { title(); } }, '‹'),
      h('div', {}, h('h2', {}, 'My progress'), h('p', {}, `Unit 1 · ${done} of 12 steps mastered`))),
    map,
    h('p', { class: 'note' }, 'Master a step to open the next one. The music picks what you play.'),
    h('div', { class: 'testbox' },
      h('label', {}, 'Test mode (for Kyle): drill any step', seg({ off: 'Off', on: 'On' }, st.test ? 'on' : 'off', (v) => { st.test = v === 'on'; save(); progress(); })),
      st.test ? h('button', { class: 'mini', onclick: lab }, 'Transitions lab') : null,
      st.test ? h('button', { class: 'mini danger', onclick: () => { st = store.reset(); dir = makeDirector(st); progress(); } }, 'Reset all progress') : null),
    sheet));
  drawMap(map, info, sheet);
  map.querySelector('.pnode.now, .pnode.open')?.scrollIntoView({ block: 'center' });
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
    h('p', {}, state === 'locked' ? 'Master the step before this one to open it.' : s.say),
    state !== 'locked' ? h('div', { class: 'sheet-bar' }, h('span', { class: 'pbar' }, h('span', { style: `width:${Math.round(p.s)}%` })), h('small', {}, `${Math.round(p.s)}% strong`)) : null,
    h('p', { class: `sheet-state ${state}` }, STATE_TEXT[state]),
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
  const cues = ['TAP IT!', 'SAY IT!', 'PICK ONE!', 'BUILD IT!'];
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
    h('button', { class: 'back', 'aria-label': 'Back', onclick: progress }, '‹'),
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

async function startRun(opts = {}) {
  const ctx = snd.ac();
  scene('run');
  app.replaceChildren(h('div', { class: 'loading' }, mookie(''), h('p', {}, 'Tuning up…')));
  await snd.load();
  let micOn = false;
  let micError = '';
  if (st.input === 'mic') {
    try { await mic.start(ctx); micOn = true; } catch (e) { micError = `${micProblem(e)} Tapping still works.`; }
  }
  R = {
    ctx, clock: makeClock(ctx), force: opts.force || null, lap: 0, plan: [], idx: 0,
    combo: 0, runCombo: 0, runXP: 0, setXP: 0, setMisses: 0, setGames: 0, tempo: 92,
    lastGame: null, micOn, paused: false, ended: false, win: null, api: null,
    groove: { mode: 'play', duckFrom: 0, duckUntil: 0, micFrom: Infinity },
    before: Object.fromEntries(STEPS.slice(1).map((s) => [s.n, dir.step(s.n).s])),
    news: micError ? [micError] : [],
  };
  if (st.lastDay !== today()) {
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
  const per = st.mookie ? 3 : 4;
  const plan = [];
  for (let s = 0; s < 3; s++) {
    for (let g = 0; g < per; g++) plan.push({ type: 'game', set: s, first: g === 0, n: g });
    plan.push({ type: 'breather', set: s });
  }
  plan.push({ type: 'boss' }, { type: 'intermission' });
  return plan;
}

function beginLap() {
  R.plan = lapPlan();
  R.idx = 0;
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
  R.clock.at(4, () => { later(R.clock.timeOf(4), () => overlay(null)); next(4); });
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
  d.seats = SEATS.map(([icon, name, tier]) => h('span', { class: 'seat', title: name, 'data-tier': tier }, icon));
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
  const list = GAMES.filter((g) => g !== R.lastGame);
  const g = list[Math.floor(Math.random() * list.length)];
  R.lastGame = g;
  return g;
}

/* ---------------- one micro-game ---------------- */

function gameSeg(B, seg) {
  const warm = R.lap === 0 && seg.set === 0 && !R.force;
  const item = dir.next({ warm, force: R.force });
  const step = STEPS[item.step];
  const game = pickGame();
  const spb = R.clock.spb();
  const T = (i) => R.clock.timeOf(i);
  const callBeats = step.call === 'none' ? 0 : 4;
  const respBeats = { perform: 4, create: 4, pick: 4, build: 8, compose: 8 }[item.mode];
  // Compose plays the learner's pattern back after 2 beats of payoff, so it gets 8.
  const payBeats = item.mode === 'compose' ? 8 : 4;
  const c0 = B + 4;
  snd.setGroovePhase(c0); // the call (or a compose answer) starts on bar 1 of the groove
  const r0 = c0 + callBeats;
  const p0 = r0 + respBeats;
  const end = p0 + payBeats;
  const q = question(item, step);
  const win = { tResp: T(r0), spb, from: T(r0) - 0.25 * spb, to: T(p0) - 0.05 * spb, taps: [], usedMic: false, choice: null, slots: [null, null, null, null] };

  const tx = TX.pick(st.tx);
  if (!snd.speak(cueId(step.cue), T(B))) snd.fx.cue(T(B));
  tx.sound(snd, T(B), spb);
  later(T(B), () => {
    hud();
    showGame(item, step, game, q, win, tx, spb);
  });
  if (callBeats) {
    R.groove.duckFrom = T(c0);
    R.groove.duckUntil = R.micOn && ['perform', 'create'].includes(item.mode) ? T(p0) : T(r0);
    R.groove.micFrom = T(r0) - 0.3 * spb;
    for (let k = 0; k < callBeats; k++) later(T(c0 + k), () => dots(k, callBeats, 'call'));
  }
  if (step.call === 'neutral' || step.call === 'syllables') {
    snd.call(item.pattern, step.call, T(c0), spb);
    onsets(item.pattern).forEach((o, i) => later(T(c0) + o.b * spb, () => R.api.onCall(i, step.call === 'syllables' ? o.syl : null)));
  }
  later(T(r0), () => {
    R.dom.controls.classList.add('live');
    R.dom.stage.parentElement.classList.add('yours');
    flash(howTo(item.step, item.mode).go, 'turn');
  });
  for (let k = 0; k < respBeats; k++) later(T(r0 + k), () => dots(k, respBeats, 'resp'));
  later(T(p0), () => {
    R.dom.controls.classList.remove('live');
    R.dom.stage.parentElement.classList.remove('yours');
    const res = grade(item, q, win);
    result(item, res, { onWin: () => R.api.win(), onFail: () => R.api.fail(), t: T(p0) });
    if (item.mode === 'compose' && res.got) {
      snd.playBack(res.got, T(p0 + 2), spb);
      R.dom.prompt.replaceChildren(h('div', { class: 'answer' }, h('span', {}, 'Your pattern'), notes(res.got), sylIcons(res.got)));
    }
    R.win = null;
  });
  R.clock.at(end, () => next(end));
}

function question(item, step) {
  if (item.mode === 'pick') {
    const spec = dir.pickSpec(item.step);
    return { ...options(item.pattern, spec.count, spec.close), show: step.show };
  }
  return {};
}

function dots(k, n, kind) {
  if (k === 0 && kind === 'call') clearTicks();
  R.dom.dots.className = `dots ${kind}`;
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

function showGame(item, step, game, q, win, tx, spb) {
  const d = R.dom;
  overlay(null);
  // The new scene goes in once the transition has hidden the old one (transitions.js).
  R.api = game.make(h('div'), {});
  TX.play(d.stage.parentElement, tx, spb, () => {
    if (!R || R.dom !== d) return;
    d.stage.replaceChildren();
    R.api = game.make(d.stage, {});
  });
  d.cue.textContent = step.cue;
  bump(d.cue, 'slam');
  d.prompt.replaceChildren(instruction(item));
  bigHow(item);
  if (step.call === 'notation') d.prompt.append(notes(item.pattern));
  if (step.call === 'text') d.prompt.append(h('div', { class: 'syl-card' }, sylIcons(item.pattern)));
  clearDots();
  R.win = win;
  R.item = { item, q };
  controlsFor(item, game, q, win);
}

/* The what-to-do line, on screen for the whole game. The first time a kind of game comes
   up it's marked NEW and stays big. */
function instruction(item) {
  const key = `${item.step}-${item.mode}`;
  const fresh = !st.seen[key];
  st.seen[key] = 1;
  const { how, look } = howTo(item.step, item.mode);
  return h('div', { class: `say${fresh ? ' new' : ''}` },
    st.mookie ? mookie('happy') : h('span', { class: 'ic' }, look === 'read' ? '👀' : look === 'listen' ? '👂' : '✏️'),
    fresh ? h('b', { class: 'tag' }, 'NEW') : null,
    h('span', {}, how));
}

/* The instruction pops up big over the scene at the start of each game, then shrinks
   away into the line under it. Held for 4 beats (at least 2.4 s) so it can be read. */
function bigHow(item) {
  const wrap = R.dom.stage.parentElement;
  wrap.querySelector('.how-big')?.remove();
  const el = h('div', { class: 'how-big' }, h('span', {}, howTo(item.step, item.mode).how));
  el.style.animationDuration = `${Math.max(2.4, 4 * R.clock.spb())}s`;
  el.addEventListener('animationend', () => el.remove());
  wrap.append(el);
}

function controlsFor(item, game, q, win) {
  const d = R.dom;
  R.keys = null;
  R.onInput = null;
  if (item.mode === 'perform' || item.mode === 'create') {
    let tappedAt = -9;
    // Tap feedback: a ripple where the finger landed, coloured by timing when the answer is
    // known (on time, close, off), and a tick on the beat lane where the tap fell.
    const expected = item.mode === 'perform' ? onsets(item.pattern).map((o) => win.tResp + o.b * win.spb) : null;
    const feel = (t, open, ev) => {
      const r = pad.getBoundingClientRect();
      const x = ev?.clientX != null ? ev.clientX - r.left : r.width / 2;
      const y = ev?.clientY != null ? ev.clientY - r.top : r.height / 2;
      let cls = open ? 'tap' : 'idle';
      let word = '';
      if (open && expected) {
        const e = expected.reduce((best, x) => (Math.abs(t - x) < Math.abs(best) ? t - x : best), Infinity);
        const a = Math.abs(e);
        if (a <= 0.08 * win.spb + 0.02) cls = 'on';
        else if (a <= 0.2 * win.spb + 0.03) { cls = 'close'; word = e < 0 ? 'early' : 'late'; } else { cls = 'off'; word = e < 0 ? 'too early' : 'too late'; }
      }
      FX.ripple(pad, x, y, cls);
      if (word) FX.pop(pad, x, y - 24, word, cls);
      if (open) tick((t - win.tResp) / win.spb, cls);
    };
    const tap = (time, fromMic, ev) => {
      // A tap plays a sound, and the mic hears it: that isn't a syllable.
      if (fromMic && time > tappedAt - 0.05 && time < tappedAt + snd.latency() + 0.12) return;
      if (!fromMic) {
        tappedAt = time;
        snd.hit(game.tap, R.ctx.currentTime, 0.9);
      }
      // What the learner hears lags the clock; their taps line up with what they hear.
      const t = time - snd.latency();
      // The mic stops a little early: the payoff sounds right after the turn, and it hears them.
      const open = R.win && t >= win.from && t <= win.to - (fromMic ? 0.2 * win.spb : 0);
      // The mic only listens on the learner's turn: before it, it would hear the call.
      if (fromMic && !open) return;
      // Tapping while speaking gives two inputs for one syllable: count it once.
      const same = 0.3 * win.spb / 2;
      if (open && !win.taps.some((x) => Math.abs(x - t) < same)) {
        win.taps.push(t);
        if (fromMic) win.usedMic = true;
      } else if (fromMic) return;
      R.api.onTap();
      bump(pad, 'hit');
      feel(t, open, ev);
    };
    const pad = h('button', { class: 'pad', onpointerdown: (e) => { e.preventDefault(); tap(R.ctx.currentTime, false, e); } },
      h('b', { class: 'wait' }, STEPS[item.step].call === 'notation' ? '👀 Read…' : '👂 Listen…'),
      h('b', { class: 'now' }, item.mode === 'create' ? 'ANSWER BACK' : 'TAP'), R.micOn ? h('small', {}, 'or say it') : h('small', {}, 'or press space'),
      R.micOn ? h('span', { class: 'meter' }, h('span', {})) : null);
    if (R.micOn) {
      const fill = pad.querySelector('.meter span');
      const draw = () => {
        if (!pad.isConnected) return;
        fill.style.width = `${Math.round(mic.getLevel() * 100)}%`;
        requestAnimationFrame(draw);
      };
      draw();
    }
    R.onInput = tap;
    R.keys = (e) => {
      if (e.key === ' ' || e.key === 'Enter' || /^[a-z]$/i.test(e.key)) { tap(R.ctx.currentTime, false); return true; }
      return false;
    };
    d.controls.replaceChildren(pad);
  } else if (item.mode === 'pick') {
    const buttons = q.list.map((p, i) => h('button', {
      class: `opt ${game.pickClass}`,
      onclick: () => choose(i),
    }, q.show === 'notation' ? notes(p) : sylIcons(p, 'syl')));
    const choose = (i) => {
      if (!R.win || win.choice != null) return;
      win.choice = i;
      buttons[i].classList.add('chosen');
      bump(buttons[i], 'press');
      snd.hit(game.tap, R.ctx.currentTime, 0.7);
    };
    R.keys = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= buttons.length) { choose(n - 1); return true; }
      return false;
    };
    R.pickButtons = buttons;
    d.controls.replaceChildren(h('div', { class: `opts n${buttons.length}` }, ...buttons));
  } else {
    // Build and compose: four beat slots, each ♩ or ♫.
    const slots = win.slots.map((_, i) => h('button', { class: 'slot', onclick: () => cycle(i) }));
    R.slotButtons = slots;
    const draw = () => slots.forEach((b, i) => {
      const c = win.slots[i];
      b.className = `slot ${c || 'empty'}`;
      b.replaceChildren(h('b', {}, c === 'ee' ? '♫' : c === 'q' ? '♩' : '?'), h('small', {}, c ? game.slotIcon(c) : 'tap me'));
    });
    const cycle = (i) => {
      if (!R.win) return;
      win.slots[i] = win.slots[i] === 'q' ? 'ee' : 'q';
      snd.hit(game.tap, R.ctx.currentTime, 0.6);
      draw();
      bump(slots[i], 'flip');
    };
    R.keys = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) { cycle(n - 1); return true; }
      return false;
    };
    draw();
    d.controls.replaceChildren(h('div', { class: 'slots' }, ...slots));
  }
}

function grade(item, q, win) {
  const p = item.pattern;
  if (item.mode === 'perform') {
    const expected = onsets(p).map((o) => win.tResp + o.b * win.spb);
    const taps = win.taps.slice().sort((a, b) => a - b);
    if (taps.length !== expected.length) return { right: false, why: taps.length < expected.length ? 'missing' : 'extra' };
    const tol = 0.2 * win.spb + 0.03;
    const tight = 0.08 * win.spb + 0.02;
    const errs = expected.map((e, i) => Math.abs(taps[i] - e));
    const right = errs.every((e) => e <= tol);
    return { right, perfect: right && errs.every((e) => e <= tight), mic: win.usedMic };
  }
  if (item.mode === 'create') {
    const got = readTaps(win.taps.map((t) => (t - win.tResp) / win.spb));
    return { right: !!got && got.id !== p.id, got, why: !got ? 'unclear' : got.id === p.id ? 'same' : '', mic: win.usedMic };
  }
  if (item.mode === 'pick') {
    R.pickButtons?.forEach((b, i) => b.classList.add(i === q.correct ? 'right' : i === win.choice ? 'wrong' : 'dim'));
    if (win.choice === q.correct) FX.burst(R.pickButtons[q.correct], { kind: 'stars', count: 10, spread: 0.6 });
    return { right: win.choice === q.correct };
  }
  const full = win.slots.every(Boolean);
  if (item.mode === 'compose') return { right: full, got: full ? fromCells(win.slots) : null };
  // Build: each slot shows whether it was right.
  R.slotButtons?.forEach((b, i) => b.classList.add(win.slots[i] === p.cells[i] ? 'right' : 'wrong'));
  return { right: full && fromCells(win.slots).id === p.id };
}

function result(item, res, { onWin, onFail, t, quiet = false }) {
  const rec = dir.record({ item, right: res.right, bpm: R.tempo });
  if (rec.mastered) R.news.push(`★ Step ${rec.mastered} mastered: ${STEPS[rec.mastered].name}`);
  R.setGames++;
  if (res.right) {
    const before = tierOf(R.combo);
    R.combo++;
    R.runCombo = Math.max(R.runCombo, R.combo);
    const tier = tierOf(R.combo);
    const gained = addXP((10 + (res.perfect ? 5 : 0)) * (TEMPO_XP[R.tempo] || 1) * (res.mic ? 1.5 : 1) * (tier + 1));
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
      FX.parade(wrap, BAND[tier]);
    } else {
      if (res.perfect) snd.speak('perfect', t);
      if (!quiet) flash(res.perfect ? 'PERFECT!' : PRAISE[Math.floor(Math.random() * PRAISE.length)], res.perfect ? 'plus gold' : 'plus');
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
      const why = { missing: 'Not enough notes', extra: 'Too many notes', same: 'Make it different from mine!', unclear: "Couldn't hear a pattern" }[res.why];
      R.dom.prompt.replaceChildren(h('div', { class: 'answer' },
        h('span', {}, why || (item.mode === 'create' ? '' : 'It was')),
        item.mode === 'create' ? null : notes(item.pattern),
        item.mode === 'create' ? null : sylIcons(item.pattern)));
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
  const lines = [];
  if (R.setMisses === 0 && R.setGames > 0) lines.push(`No misses! +${addXP(50)} XP`);
  const lvBefore = levelOf(st.xp - R.setXP).n;
  const lv = levelOf(st.xp);
  if (lv.n > lvBefore) lines.push(`Level up! ${lv.title}`);
  if (!R.force) {
    const opened = dir.advance();
    if (opened) {
      lines.push(`NEW STEP: ${STEPS[opened].name}!`);
      snd.speak('new-step', T(B));
    }
    if (dir.step(12).mastered && !st.unitDone) { st.unitDone = true; lines.push('Unit 1 complete!'); }
  }
  lines.push(...R.news.splice(0));
  const setXP = R.setXP;
  R.setXP = 0;
  R.setMisses = 0;
  R.setGames = 0;
  save();
  later(T(B), () => {
    const count = h('div', { class: 'big-xp' }, '+0');
    overlay(h('div', { class: 'card breather' },
      h('div', { class: 'cue-word small' }, `Set ${seg.set + 1} done`),
      count,
      R.combo >= 3 ? h('p', {}, `${R.combo} in a row, keep it going!`) : null,
      ...lines.map((l) => h('p', { class: 'news' }, l)),
      h('div', { class: 'gag' }, mookie('happy'), h('span', {}, GAGS[Math.floor(Math.random() * GAGS.length)]))));
    // XP counts up on the beat, with a pop of notes; confetti for no misses or a level up.
    for (let k = 1; k <= 4; k++) later(T(B + k), () => { count.textContent = `+${Math.round(setXP * k / 4)}`; bump(count, 'beat'); FX.burst(count, { kind: 'notes', count: 5, spread: 0.6 }); });
    if (lines.some((l) => /No misses|Level up|NEW STEP|complete/.test(l))) later(T(B + 1), () => FX.burst(R.dom.overlay.querySelector('.card'), { y: 0.2, count: 30, spread: 1.6 }));
    hud();
  });
  R.clock.at(B + 8, () => {
    R.groove.mode = 'play';
    next(B + 8);
  });
}

/* ---------------- boss ---------------- */

const BOSS_CALL = { 1: 'neutral', 2: 'syllables', 3: 'neutral', 4: 'neutral', 5: 'syllables', 6: 'syllables', 7: 'notation', 8: 'notation', 9: 'notation', 10: 'neutral', 11: 'neutral', 12: 'notation' };

function bossSay(item, kind) {
  const how = item.mode === 'create' ? 'Listen. Then answer with a different one.'
    : kind === 'notation' ? 'Read it. Then say it and tap.' : 'Listen. Then tap it back.';
  return h('div', { class: 'say' }, h('span', { class: 'ic' }, kind === 'notation' ? '👀' : '👂'), h('span', {}, how));
}

function boss(B) {
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
    R.api = mouseCatcher.make(h('div'), { boss: true });
    TX.play(d.stage.parentElement, TX.BOSS_TX, spb, () => {
      if (!R || R.dom !== d) return;
      d.stage.replaceChildren();
      R.api = mouseCatcher.make(d.stage, { boss: true });
    });
    R.dom.cue.textContent = 'BOSS!';
    bump(R.dom.cue, 'slam');
    R.dom.prompt.replaceChildren(h('div', { class: 'boss-name' }, 'The Big Cheese'), h('div', { class: 'hearts' }, '❤️❤️❤️❤️'));
  });
  snd.setGroovePhase(B + 4);
  for (let r = 0; r < rounds; r++) {
    const c0 = B + 4 + r * 8;
    const r0 = c0 + 4;
    const item = dir.next({ boss: true, force: R.force });
    const kind = BOSS_CALL[item.step];
    const win = { tResp: T(r0), spb, from: T(r0) - 0.25 * spb, to: T(r0 + 4) - 0.05 * spb, taps: [], usedMic: false };
    R.groove.duckFrom = T(c0);
    R.groove.duckUntil = T(R.micOn ? r0 + 4 : r0);
    R.groove.micFrom = T(r0) - 0.3 * spb;
    later(T(c0), () => {
      R.win = null;
      R.dom.prompt.querySelector('.notation')?.remove();
      R.dom.prompt.querySelector('.say')?.remove();
      R.dom.prompt.append(bossSay(item, kind));
      if (kind === 'notation') R.dom.prompt.append(notes(item.pattern));
      R.item = { item, q: {} };
      controlsFor(item, mouseCatcher, {}, win);
    });
    for (let k = 0; k < 4; k++) later(T(c0 + k), () => dots(k, 4, 'call'));
    if (kind !== 'notation') {
      snd.call(item.pattern, kind, T(c0), spb);
      onsets(item.pattern).forEach((o, i) => later(T(c0) + o.b * spb, () => R.api.onCall(i, kind === 'syllables' ? o.syl : null)));
    }
    later(T(r0) - 0.25 * spb, () => { R.win = win; });
    later(T(r0), () => { R.dom.controls.classList.add('live'); flash(item.mode === 'create' ? 'ANSWER!' : 'HIT IT!', 'turn'); });
    for (let k = 0; k < 4; k++) later(T(r0 + k), () => dots(k, 4, 'resp'));
    later(T(r0 + 4), () => {
      R.dom.controls.classList.remove('live');
      R.win = null;
      const res = grade(item, {}, win);
      if (res.right) hits++;
      result(item, res, {
        t: T(r0 + 4),
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
  }
  const done = B + 4 + rounds * 8;
  later(T(done), () => {
    if (hits >= 3) {
      R.api.win();
      const gained = addXP(100);
      const sticker = STICKERS.find((s) => !st.stickers.includes(s));
      if (sticker) st.stickers.push(sticker);
      R.news.push(`Beat The Big Cheese! +${gained} XP${sticker ? ` and a new sticker ${sticker}` : ''}`);
    } else {
      R.api.fail();
      addXP(20);
      R.news.push('The Big Cheese got away. Next lap!');
    }
    save();
    R.dom.controls.replaceChildren();
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
  const grown = STEPS.slice(1).filter((s) => dir.step(s.n).s - R.before[s.n] >= 5)
    .map((s) => `${s.name} +${Math.round(dir.step(s.n).s - R.before[s.n])}`);
  const lv = levelOf(st.xp);
  overlay(h('div', { class: 'card intermission' },
    h('div', { class: 'cue-word small' }, `Lap ${R.lap + 1} done!`),
    h('div', { class: 'big-xp' }, `+${R.runXP} XP`),
    h('p', {}, `Best combo this run: ${R.runCombo} · Level ${lv.n} ${lv.title}`),
    ...R.news.splice(0).map((n) => h('p', { class: 'news' }, n)),
    grown.length ? h('p', {}, `Skills that grew: ${grown.join(', ')}`) : null,
    h('p', {}, `Next up: ${STEPS[R.force || st.frontier].name}`),
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
  mic.stop();
  document.onkeydown = null;
  R = null;
  save();
  if (new URLSearchParams(location.search).has('debug')) window.mmDebug = () => R;

title();
}

if (new URLSearchParams(location.search).has('debug')) window.mmDebug = () => R;

title();
