/* Musician Maker: one nonstop stream of micro-games on one groove.
   A run is laps of three sets (92, 108, 126 bpm), each set followed by a breather, then a
   boss and an intermission. A micro-game is cue (2 beats), call (4), response, payoff (2).
   The director (director.js) picks every game; the groove (sound.js) grows with the combo.
   Why it works this way: the stream engine design doc in the project. */

import * as snd from './sound.js';
import { makeClock } from './clock.js';
import * as mic from './mic.js';
import { STEPS, BANDS, onsets, sylText, options, readTaps, fromCells, loadMarks } from './steps.js';
import { makeDirector, tierOf, TIERS, TIER_NAMES, levelOf } from './director.js';
import { GAMES, mouseCatcher, bump } from './games.js';
import { mookie } from './mookie.js';
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

function title() {
  const lv = levelOf(st.xp);
  app.replaceChildren(h('div', { class: 'title' },
    h('h1', {}, 'Musician Maker'),
    h('p', { class: 'sub' }, 'Unit 1 · du, du-de'),
    mookie('happy'),
    h('button', { class: 'play', onclick: () => startRun() }, 'Play'),
    h('div', { class: 'opts' },
      h('label', {}, 'Mookie mode', seg({ off: 'Off', on: 'On' }, st.mookie ? 'on' : 'off', (v) => { st.mookie = v === 'on'; dir = makeDirector(st); save(); })),
      h('label', {}, 'Answer by', seg({ tap: 'Tapping', mic: 'Mic and tapping' }, st.input, (v) => { st.input = v; save(); title(); })),
      st.input === 'mic' ? micCheck() : null),
    h('p', { class: 'stats' }, `Level ${lv.n} ${lv.title} · ${st.xp} XP · best combo ${st.bestCombo} · ${st.days} ${st.days === 1 ? 'day' : 'days'} played`),
    st.stickers.length ? h('p', { class: 'stickers' }, st.stickers.join(' ')) : null,
    h('button', { class: 'link', onclick: progress }, 'My progress')));
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

function micProblem(e) {
  if (e?.name === 'NotAllowedError') return 'The mic is blocked. Allow it in the browser\'s site settings (the icon left of the address).';
  if (e?.name === 'NotFoundError') return 'No mic found on this device.';
  return `The mic didn't start (${e?.message || e}).`;
}

function progress() {
  const rows = STEPS.slice(1).map((s) => {
    const p = dir.step(s.n);
    const state = p.mastered ? 'mastered' : s.n === st.frontier ? 'now' : s.n < st.frontier ? 'open' : 'locked';
    return h('div', { class: `prow ${state}` },
      h('span', { class: `band ${s.band}` }, BANDS[s.band]),
      h('span', { class: 'pname' }, `${s.n}. ${s.name}`),
      h('span', { class: 'pbar' }, h('span', { style: `width:${Math.round(p.s)}%` })),
      h('span', { class: 'pstate' }, { mastered: '★ mastered', now: 'learning now', open: 'practising', locked: 'locked' }[state]),
      st.test ? h('button', { class: 'mini', onclick: () => startRun({ force: s.n }) }, 'Drill') : null);
  });
  app.replaceChildren(h('div', { class: 'progress' },
    h('button', { class: 'link back', onclick: title }, '‹ Back'),
    h('h2', {}, 'Unit 1 progress'),
    h('p', { class: 'note' }, 'New steps open as you master the one before. The stream picks what you play.'),
    ...rows,
    h('div', { class: 'testbox' },
      h('label', {}, 'Test mode (for Kyle): drill any step', seg({ off: 'Off', on: 'On' }, st.test ? 'on' : 'off', (v) => { st.test = v === 'on'; save(); progress(); })),
      st.test ? h('button', { class: 'mini danger', onclick: () => { st = store.reset(); dir = makeDirector(st); progress(); } }, 'Reset all progress') : null)));
}

/* ---------------- the run ---------------- */

function later(t, fn) {
  if (!R) return;
  const run = R;
  setTimeout(() => { if (R === run && !run.ended) fn(); }, Math.max(0, (t - run.ctx.currentTime + snd.latency()) * 1000));
}

async function startRun(opts = {}) {
  const ctx = snd.ac();
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
    later(t, () => bump(R.dom.pulse, 'beat'));
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
  d.pulse = h('div', { class: 'pulse' });
  d.pause = h('button', { class: 'pause', 'aria-label': 'Pause', onclick: askPause }, '❚❚');
  d.stage = h('div', { class: 'stage' });
  d.cue = h('div', { class: 'cue' });
  d.prompt = h('div', { class: 'prompt' });
  d.dots = h('div', { class: 'dots' });
  d.controls = h('div', { class: 'controls' });
  d.overlay = h('div', { class: 'overlay' });
  d.flash = h('div', { class: 'flash' });
  app.replaceChildren(h('div', { class: 'run' },
    h('header', { class: 'hud' }, h('div', { class: 'hud-l' }, d.level, d.xp), d.combo, h('div', { class: 'hud-r' }, d.pulse, d.tempo, d.pause)),
    d.sets,
    h('div', { class: 'stage-wrap' }, d.stage, d.cue, d.flash),
    d.prompt, d.dots, d.controls, d.overlay));
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
  d.xp.replaceChildren(h('span', { class: 'xpbar' }, h('span', { style: `width:${Math.round(lv.frac * 100)}%` })), ` ${st.xp} XP`);
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
  const respBeats = { perform: 4, create: 4, pick: st.mookie ? 6 : 4, build: 8, compose: 8 }[item.mode];
  const payBeats = item.mode === 'compose' ? 6 : 2;
  const c0 = B + 2;
  const r0 = c0 + callBeats;
  const p0 = r0 + respBeats;
  const end = p0 + payBeats;
  const q = question(item, step);
  const win = { tResp: T(r0), spb, from: T(r0) - 0.25 * spb, to: T(p0) - 0.05 * spb, taps: [], usedMic: false, choice: null, slots: [null, null, null, null] };

  snd.fx.cue(T(B));
  later(T(B), () => {
    hud();
    showGame(item, step, game, q, win);
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
    flash(item.mode === 'compose' ? 'GO!' : 'YOUR TURN!', 'turn');
  });
  for (let k = 0; k < respBeats; k++) later(T(r0 + k), () => dots(k, respBeats, 'resp'));
  later(T(p0), () => {
    R.dom.controls.classList.remove('live');
    R.dom.stage.parentElement.classList.remove('yours');
    const res = grade(item, q, win);
    result(item, res, { onWin: () => R.api.win(), onFail: () => R.api.fail(), t: T(p0) });
    if (item.mode === 'compose' && res.got) {
      snd.playBack(res.got, T(p0 + 1), spb);
      R.dom.prompt.replaceChildren(h('div', { class: 'answer' }, h('span', {}, 'Your pattern'), notes(res.got), h('b', {}, sylText(res.got))));
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
  R.dom.dots.className = `dots ${kind}`;
  R.dom.dots.replaceChildren(...Array.from({ length: n }, (_, i) => h('i', { class: i < k ? 'past' : i === k ? 'now' : '' })));
}

function showGame(item, step, game, q, win) {
  const d = R.dom;
  overlay(null);
  d.stage.replaceChildren();
  R.api = game.make(d.stage, {});
  d.cue.textContent = step.cue;
  bump(d.cue, 'slam');
  d.prompt.replaceChildren();
  if (st.mookie) d.prompt.append(h('div', { class: 'say' }, mookie('happy'), h('span', {}, step.say)));
  if (step.call === 'notation') d.prompt.append(notes(item.pattern));
  if (step.call === 'text') d.prompt.append(h('div', { class: 'syl-card' }, sylText(item.pattern)));
  d.dots.replaceChildren();
  R.win = win;
  R.item = { item, q };
  controlsFor(item, game, q, win);
}

function controlsFor(item, game, q, win) {
  const d = R.dom;
  R.keys = null;
  R.onInput = null;
  if (item.mode === 'perform' || item.mode === 'create') {
    let tappedAt = -9;
    const tap = (time, fromMic) => {
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
    };
    const pad = h('button', { class: 'pad', onpointerdown: (e) => { e.preventDefault(); tap(R.ctx.currentTime, false); } },
      h('b', {}, item.mode === 'create' ? 'ANSWER BACK' : 'TAP'), R.micOn ? h('small', {}, 'or say it') : h('small', {}, 'or press space'),
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
    }, q.show === 'notation' ? notes(p) : h('span', { class: 'syl' }, sylText(p))));
    const choose = (i) => {
      if (!R.win || win.choice != null) return;
      win.choice = i;
      buttons[i].classList.add('chosen');
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
    const draw = () => slots.forEach((b, i) => {
      const c = win.slots[i];
      b.className = `slot ${c || 'empty'}`;
      b.replaceChildren(h('b', {}, c === 'ee' ? '♫' : c === 'q' ? '♩' : '?'), h('small', {}, c ? game.slotIcon(c) : `beat ${i + 1}`));
    });
    const cycle = (i) => {
      if (!R.win) return;
      win.slots[i] = win.slots[i] === 'q' ? 'ee' : 'q';
      snd.hit(game.tap, R.ctx.currentTime, 0.6);
      draw();
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
    R.pickButtons?.forEach((b, i) => b.classList.add(i === q.correct ? 'right' : 'dim'));
    return { right: win.choice === q.correct };
  }
  const full = win.slots.every(Boolean);
  if (item.mode === 'compose') return { right: full, got: full ? fromCells(win.slots) : null };
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
    if (tier > before) {
      snd.fx.tier(t);
      flash(`${TIER_NAMES[tier]}! ×${tier + 1}`, `tier t${tier}`);
    } else if (!quiet) flash(`${res.perfect ? 'PERFECT! ' : ''}+${gained}`, 'plus');
  } else {
    const was = R.combo;
    const tier = tierOf(R.combo);
    R.combo = st.mookie && tier > 0 ? TIERS[tier - 1] : 0;
    R.setMisses++;
    onFail();
    if (was >= 3) snd.fx.scratch(t);
    else snd.fx.fail(t);
    if (!quiet) {
      const why = { missing: 'Not enough notes', extra: 'Too many notes', same: 'Make it different from mine!', unclear: "Couldn't hear a pattern" }[res.why];
      R.dom.prompt.replaceChildren(h('div', { class: 'answer' },
        h('span', {}, why || (item.mode === 'create' ? '' : 'It was')),
        item.mode === 'create' ? null : notes(item.pattern),
        item.mode === 'create' ? null : h('b', {}, sylText(item.pattern))));
    }
  }
  st.bestCombo = Math.max(st.bestCombo, R.combo);
  save();
  hud();
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
    if (opened) lines.push(`NEW STEP: ${STEPS[opened].name}!`);
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
    // XP counts up on the beat.
    for (let k = 1; k <= 4; k++) later(T(B + k), () => { count.textContent = `+${Math.round(setXP * k / 4)}`; bump(count, 'beat'); });
    hud();
  });
  R.clock.at(B + 8, () => {
    R.groove.mode = 'play';
    next(B + 8);
  });
}

/* ---------------- boss ---------------- */

const BOSS_CALL = { 1: 'neutral', 2: 'syllables', 3: 'neutral', 4: 'neutral', 5: 'syllables', 6: 'syllables', 7: 'notation', 8: 'notation', 9: 'notation', 10: 'neutral', 11: 'neutral', 12: 'notation' };

function boss(B) {
  const T = (i) => R.clock.timeOf(i);
  const spb = R.clock.spb();
  const rounds = 4;
  let hits = 0;
  snd.fx.boss(T(B));
  later(T(B), () => {
    hud();
    overlay(null);
    R.dom.stage.replaceChildren();
    R.api = mouseCatcher.make(R.dom.stage, { boss: true });
    R.dom.cue.textContent = 'BOSS!';
    bump(R.dom.cue, 'slam');
    R.dom.prompt.replaceChildren(h('div', { class: 'boss-name' }, 'The Big Cheese'), h('div', { class: 'hearts' }, '❤️❤️❤️❤️'));
  });
  for (let r = 0; r < rounds; r++) {
    const c0 = B + 2 + r * 8;
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
        onWin: () => { R.dom.prompt.querySelector('.hearts').textContent = '❤️'.repeat(rounds - hits) + '🖤'.repeat(hits); flash('BAM!', 'plus'); },
        onFail: () => flash('missed!', 'bad'),
      });
    });
  }
  const done = B + 2 + rounds * 8;
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
    R.dom.dots.replaceChildren();
    hud();
  });
  R.clock.at(done + 4, () => next(done + 4));
}

/* ---------------- intermission, pause, end ---------------- */

function intermission() {
  R.clock.stop();
  R.groove.mode = 'off';
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
}

function askPause() {
  if (!R || R.paused) return;
  R.paused = true;
  flash('Pausing after this one…', 'small');
}

function pauseNow() {
  R.clock.stop();
  R.groove.mode = 'off';
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
  mic.stop();
  document.onkeydown = null;
  R = null;
  save();
  if (new URLSearchParams(location.search).has('debug')) window.mmDebug = () => R;

title();
}

if (new URLSearchParams(location.search).has('debug')) window.mmDebug = () => R;

title();
