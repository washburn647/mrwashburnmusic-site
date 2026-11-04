/* One turn of a task: the controls the learner answers with, what they did, and the grade.
   The run (main.js) and the task intros and practice (intro.js) all use it, so a task
   answers and grades the same everywhere.

   Controls per task (tasks.js):
     say, tap, play  a pad, tapped in time. Say It is said or sung: the mic counts it (only
                     Say It listens), and without the mic the learner taps along as they say
                     it. Tap It taps the game's object, Play It plays its instrument.
     du              the unit's syllable tiles (du, de), tapped in time: the right tile on the
                     right part of the beat.
     note            notation tiles (♩, ♫) and a backspace, picked out of time, all four
                     before the turn's 4 beats are up.
   Every turn is 4 beats. Echo steps grade against the call's pattern; create steps (5, 12)
   want a whole pattern of the learner's own, different from the call. */

import { onsets, readTaps, fromCells, sylText, SYLS, isCreate } from './steps.js';
import { look } from './tasks.js';

export const TURN_BEATS = 4;

/* Fixed markup for the note tiles and the answer slots. */
export const NOTE_SVG = {
  q: '<svg viewBox="0 0 20 40" aria-hidden="true"><ellipse cx="7.5" cy="33" rx="7" ry="5" transform="rotate(-20 7.5 33)"/><rect x="12.6" y="3" width="2.4" height="30"/></svg>',
  ee: '<svg viewBox="0 0 42 40" aria-hidden="true"><ellipse cx="7.5" cy="33" rx="7" ry="5" transform="rotate(-20 7.5 33)"/><ellipse cx="30.5" cy="33" rx="7" ry="5" transform="rotate(-20 30.5 33)"/><rect x="12.6" y="5" width="2.4" height="28"/><rect x="35.6" y="5" width="2.4" height="28"/><rect x="12.6" y="3" width="25.4" height="6"/></svg>',
};

/* Why a turn missed, for the line under the game. */
export const WHY = {
  missing: 'Not enough notes',
  extra: 'Too many notes',
  same: 'Make it different from mine!',
  unclear: 'Couldn\'t make out a pattern',
  tiles: 'Some tiles were wrong',
  unfinished: 'Not finished in time',
};

/* item: { task, step, stim, pattern }. game: for its object, instrument and sounds.
   ui: { h, now() audio time, latency(), hit(name, vol), mic (the mic is on), tResp (audio time
   the turn starts), spb, feel(info) optional: tap feedback for the host to draw }.
   Returns { el, keys(e), input(time, fromMic, ev), grade(), reveal(res), inputs() }. */
export function makeTurn(item, game, ui) {
  const { h } = ui;
  const { task, step, pattern, stim } = item;
  const create = isCreate(step);
  const kit = game?.kit || {};
  const { tResp, spb } = ui;
  const from = tResp - 0.25 * spb;
  const to = tResp + TURN_BEATS * spb - 0.05 * spb;
  const open = (t) => t >= from && t <= to;
  const taps = []; // say/tap/play: times; du: { t, syl }
  const cells = []; // note
  let usedMic = false;
  let tappedAt = -9;
  const expected = create ? null : onsets(pattern).map((o) => ({ t: tResp + o.b * spb, syl: o.syl }));
  const tol = 0.2 * spb + 0.03;
  const tight = 0.08 * spb + 0.02;
  const waitText = look(stim) === 'read' ? '👀 Read…' : '👂 Listen…';

  /* Timing feedback for a press at t (heard time): on time, close or off, when the answer is known. */
  const judge = (t) => {
    if (!expected) return { cls: 'tap', word: '' };
    const e = expected.reduce((best, x) => (Math.abs(t - x.t) < Math.abs(best) ? t - x.t : best), Infinity);
    const a = Math.abs(e);
    if (a <= tight) return { cls: 'on', word: '' };
    if (a <= tol) return { cls: 'close', word: e < 0 ? 'early' : 'late' };
    return { cls: 'off', word: e < 0 ? 'too early' : 'too late' };
  };

  let el;
  let input = () => {};
  let keys = () => false;

  if (task === 'say' || task === 'tap' || task === 'play') {
    const sound = task === 'tap' ? game?.tap || 'snare' : task === 'play' ? game?.play || kit.instrument?.sound || 'conga' : 'claves';
    const listens = task === 'say' && ui.mic;
    const big = task === 'say' ? '🗣️ SAY IT' : task === 'tap' ? `${kit.object?.icon || '👆'} TAP` : `${kit.instrument?.icon || '🥁'} PLAY`;
    const small = task === 'say' ? (listens ? 'the mic hears you, or tap along' : 'say it, and tap along')
      : task === 'tap' ? `${kit.object?.name || 'the pad'} · or press space` : `${kit.instrument?.name || 'the drum'} · or press space`;
    el = h('button', { class: `pad pad-${task}`, onpointerdown: (e) => { e.preventDefault(); input(ui.now(), false, e); } },
      h('b', { class: 'wait' }, waitText), h('b', { class: 'now' }, create ? big.replace(/SAY IT|TAP|PLAY/, 'ANSWER') : big), h('small', {}, small),
      listens ? h('span', { class: 'meter' }, h('span', {})) : null);
    input = (time, fromMic, ev) => {
      if (fromMic && !listens) return;
      // A tap plays a sound, and the mic hears it: that isn't a syllable.
      if (fromMic && time > tappedAt - 0.05 && time < tappedAt + ui.latency() + 0.12) return;
      if (!fromMic) { tappedAt = time; ui.hit(sound, task === 'say' ? 0.5 : 0.9); }
      // What the learner hears lags the clock; their taps line up with what they hear.
      const t = time - ui.latency();
      // The mic stops a little early: the payoff sounds right after the turn, and it hears them.
      const isOpen = open(t) && (!fromMic || t <= to - 0.2 * spb);
      if (fromMic && !isOpen) return; // the mic only listens on the learner's turn
      // Tapping while speaking gives two inputs for one syllable: count it once.
      if (isOpen && !taps.some((x) => Math.abs(x - t) < 0.15 * spb)) {
        taps.push(t);
        if (fromMic) usedMic = true;
      } else if (fromMic) return;
      bumpEl(el, 'hit');
      ui.feel?.({ el, ev, t, b: (t - tResp) / spb, open: isOpen, ...(isOpen ? judge(t) : { cls: 'idle', word: '' }) });
      ui.onPress?.();
    };
    keys = (e) => {
      if (e.key === ' ' || e.key === 'Enter' || /^[a-z]$/i.test(e.key)) { input(ui.now(), false); return true; }
      return false;
    };
  } else if (task === 'du') {
    const tiles = SYLS.map((syl, k) => h('button', { class: `du-tile du-${syl}`, onpointerdown: (e) => { e.preventDefault(); press(syl, e, tiles[k]); } },
      h('b', {}, syl), h('small', {}, k ? 'off the beat' : 'on the beat')));
    el = h('div', { class: 'du-pad' }, h('b', { class: 'wait' }, waitText), h('div', { class: 'du-tiles' }, ...tiles));
    const press = (syl, ev, tile) => {
      const time = ui.now();
      ui.hit(game?.tap || 'snare', syl === SYLS[0] ? 0.9 : 0.6);
      const t = time - ui.latency();
      const isOpen = open(t);
      if (isOpen) taps.push({ t, syl });
      bumpEl(tile, 'hit');
      let fb = isOpen ? judge(t) : { cls: 'idle', word: '' };
      // The right moment on the wrong tile: say so.
      if (isOpen && expected) {
        const near = expected.reduce((best, x) => (Math.abs(t - x.t) < Math.abs(t - best.t) ? x : best));
        if (Math.abs(t - near.t) <= tol && near.syl !== syl) fb = { cls: 'off', word: `${near.syl}!` };
      }
      ui.feel?.({ el: tile, ev, t, b: (t - tResp) / spb, open: isOpen, ...fb });
      ui.onPress?.();
    };
    input = () => {};
    keys = (e) => {
      const k = e.key.toLowerCase();
      if (['f', 'd', '1', 'arrowleft'].includes(k)) { press(SYLS[0], null, tiles[0]); return true; }
      if (['j', 'k', '2', 'arrowright'].includes(k)) { press(SYLS[1], null, tiles[1]); return true; }
      return false;
    };
  } else {
    // Note It: four answer slots that fill left to right, the note tiles and a backspace.
    const slots = [0, 1, 2, 3].map(() => h('span', { class: 'note-slot empty' }));
    const draw = () => slots.forEach((s, i) => {
      s.className = `note-slot ${cells[i] || 'empty'}`;
      s.innerHTML = cells[i] ? NOTE_SVG[cells[i]] : ''; // fixed markup
    });
    const tile = (c) => {
      const b = h('button', { class: `note-tile n-${c}`, 'aria-label': c === 'ee' ? 'two eighth notes' : 'quarter note', onclick: () => add(c, b) });
      b.innerHTML = NOTE_SVG[c]; // fixed markup
      return b;
    };
    const tq = tile('q');
    const te = tile('ee');
    const back = h('button', { class: 'note-tile note-back', 'aria-label': 'Take one back', onclick: () => remove(back) }, '⌫');
    el = h('div', { class: 'note-pad' }, h('b', { class: 'wait' }, waitText), h('div', { class: 'note-slots' }, ...slots), h('div', { class: 'note-tiles' }, tq, te, back));
    const live = () => open(ui.now() - ui.latency());
    const add = (c, b) => {
      if (!live() || cells.length >= 4) return;
      cells.push(c);
      ui.hit(game?.tap || 'snare', 0.6);
      bumpEl(b, 'hit');
      draw();
      ui.onPress?.();
    };
    const remove = (b) => {
      if (!live() || !cells.length) return;
      cells.pop();
      bumpEl(b, 'hit');
      draw();
    };
    keys = (e) => {
      const k = e.key.toLowerCase();
      if (['1', 'q'].includes(k)) { add('q', tq); return true; }
      if (['2', 'e', 'w'].includes(k)) { add('ee', te); return true; }
      if (k === 'backspace') { remove(back); return true; }
      return false;
    };
    draw();
    el.reveal = (res) => {
      if (create || cells.length < 4) return;
      slots.forEach((s, i) => s.classList.add(cells[i] === pattern.cells[i] ? 'right' : 'wrong'));
    };
  }

  function grade() {
    if (task === 'note') {
      const full = cells.length === 4;
      const got = full ? fromCells(cells) : null;
      if (!full) return { right: false, why: 'unfinished', got: null };
      if (create) return { right: got.id !== pattern.id, why: got.id === pattern.id ? 'same' : '', got };
      return { right: got.id === pattern.id, got };
    }
    const list = task === 'du' ? taps.slice().sort((a, b) => a.t - b.t) : taps.slice().sort((a, b) => a - b).map((t) => ({ t, syl: null }));
    if (create) {
      const got = readTaps(list.map((x) => (x.t - tResp) / spb));
      if (!got) return { right: false, why: 'unclear', got: null, mic: usedMic };
      if (task === 'du' && list.some((x) => (Math.round(((x.t - tResp) / spb) * 2) % 2 ? SYLS[1] : SYLS[0]) !== x.syl)) return { right: false, why: 'tiles', got, mic: usedMic };
      return { right: got.id !== pattern.id, why: got.id === pattern.id ? 'same' : '', got, mic: usedMic };
    }
    if (list.length !== expected.length) return { right: false, why: list.length < expected.length ? 'missing' : 'extra', mic: usedMic };
    const errs = expected.map((e, i) => Math.abs(list[i].t - e.t));
    const timed = errs.every((e) => e <= tol);
    if (timed && task === 'du' && expected.some((e, i) => e.syl !== list[i].syl)) return { right: false, why: 'tiles', mic: usedMic };
    return { right: timed, perfect: timed && errs.every((e) => e <= tight), mic: usedMic };
  }

  return {
    el,
    keys: (e) => keys(e),
    input: (time, fromMic, ev) => input(time, fromMic, ev),
    grade,
    reveal: (res) => el.reveal?.(res),
    inputs: () => (task === 'note' ? cells.slice() : taps.slice()),
    meter: el.querySelector?.('.meter span') || null,
    answerText: (res) => (res.got ? sylText(res.got) : ''),
  };
}

function bumpEl(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
