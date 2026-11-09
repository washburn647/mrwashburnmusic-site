/* One turn of a task: the controls the learner answers with, what they did, and the grade.
   The run (main.js) and the task intros and practice (intro.js) all use it, so a task
   answers and grades the same everywhere.

   Controls per task (tasks.js):
     say             said or sung into the mic, shown as a big mic that glows with the voice;
                     nothing to tap (without the mic, Say It doesn't come up in a run).
     tap             the game's object, big, tapped right on, in time.
     play            the game's instrument, big (instruments.js), tapped right on, in time;
                     each tap strikes the other side or hand.
     du              two tiles, du (a quarter) and du-de (two eighths, tapped twice), tapped in
                     time: each note on its own tile.
                     right part of the beat.
     note            notation tiles (♩, ♫) and a backspace, picked out of time, all four
                     before the turn's 8 beats are up.
   A turn is 4 beats, or the task's own (tasks.js beatsOf). Echo steps grade against the call's pattern; create steps (5, 12)
   want a whole pattern of the learner's own, different from the call. */

import { onsets, readTaps, fromCells, sylText, isCreate } from './steps.js';
import { look, beatsOf, sayOn } from './tasks.js';
import { art, lookOf } from './instruments.js';

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
   Returns { el, beats, keys(e), input(time, fromMic, ev), grade(), reveal(res), inputs() }. */
export function makeTurn(item, game, ui) {
  const { h } = ui;
  const { task, step, pattern, stim } = item;
  const create = isCreate(step);
  const kit = game?.kit || {};
  const { tResp, spb } = ui;
  const beats = beatsOf(task);
  const from = tResp - 0.25 * spb;
  const to = tResp + beats * spb - 0.05 * spb;
  const open = (t) => t >= from && t <= to;
  const taps = []; // say/tap/play: times; du: { t, syl }
  const cells = []; // note
  let usedMic = false;
  // Du It's tiles: each note goes on the tile of its beat, du for a quarter, du-de for eighths.
  const TILES = [{ id: 'q', label: 'du' }, { id: 'ee', label: 'du-de' }];
  const tileOf = (p, b) => p.cells[Math.max(0, Math.min(3, Math.floor(b + 0.25)))];
  const expected = create ? null : onsets(pattern).map((o) => ({ t: tResp + o.b * spb, syl: pattern.cells[Math.floor(o.b)] }));
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
    // Speak/Sing It is said or sung into the mic, and only the mic answers it.
    const listens = task === 'say' && ui.mic;
    const tapIn = task !== 'say';
    const press = (e) => { e.preventDefault(); input(ui.now(), false, e); };
    if (task === 'tap') {
      // Tap It: just the game's object, big, to tap right on.
      const obj = kit.object?.icon || '👆';
      el = h('button', { class: 'tap-obj', 'aria-label': `Tap ${kit.object?.name || 'it'}`, onpointerdown: press },
        h('span', { class: 'tap-shadow' }), h('span', { class: 'tap-body' }, h('span', { class: 'tap-face' }, obj)));
      el.style.setProperty('--spb', `${spb}s`);
    } else if (task === 'say') {
      // A big mic: it glows with the voice (--lv, set by the host) and bounces on each syllable.
      const pic = h('span', { class: 'big-art' });
      pic.innerHTML = art('mic'); // fixed markup
      // The speech bubble says what to say it on: "bum" or the rhythm syllables.
      el = h('div', { class: 'big-inst look-mic' }, h('span', { class: 'big-glow' }), pic,
        h('span', { class: `say-on${step === 1 ? ' bum' : ''}` }, sayOn(step, pattern)),
        listens ? null : h('small', {}, 'Turn the mic on to play this one'));
    } else {
      // Play It: the instrument itself, big, to play right on.
      const lk = lookOf(kit.instrument);
      const pic = h('span', { class: 'big-art' });
      pic.innerHTML = art(lk); // fixed markup
      el = h('button', { class: `big-inst look-${lk}`, 'aria-label': `Play ${kit.instrument?.name || 'the drum'}`, onpointerdown: press },
        h('span', { class: 'big-glow' }), h('span', { class: 'tap-shadow' }), pic);
      el.dataset.side = 'r';
    }
    el.style.setProperty('--spb', `${spb}s`);
    input = (time, fromMic, ev) => {
      if (fromMic ? !listens : !tapIn) return;
      if (!fromMic) ui.hit(sound, 0.9);
      // What the learner hears lags the clock; their taps line up with what they hear.
      const t = time - ui.latency();
      // The mic stops a little early: the payoff sounds right after the turn, and it hears them.
      const isOpen = open(t) && (!fromMic || t <= to - 0.2 * spb);
      if (fromMic && !isOpen) return; // the mic only listens on the learner's turn
      if (isOpen && !taps.some((x) => Math.abs(x - t) < 0.15 * spb)) {
        taps.push(t);
        if (fromMic) usedMic = true;
      } else if (fromMic) return;
      if (task === 'play') el.dataset.side = el.dataset.side === 'l' ? 'r' : 'l';
      bumpEl(el, 'hit');
      if (task === 'tap') tapFun(el, ev);
      ui.feel?.({ el, ev, t, b: (t - tResp) / spb, open: isOpen, ...(isOpen ? judge(t) : { cls: 'idle', word: '' }) });
      ui.onPress?.();
    };
    keys = (e) => {
      if (!tapIn) return false;
      if (e.key === ' ' || e.key === 'Enter' || /^[a-z]$/i.test(e.key)) { input(ui.now(), false); return true; }
      return false;
    };
  } else if (task === 'du') {
    const tiles = TILES.map((x, k) => h('button', { class: `du-tile du-${x.id}`, onpointerdown: (e) => { e.preventDefault(); press(x.id, e, tiles[k]); } },
      h('b', {}, x.label)));
    el = h('div', { class: 'du-pad' }, h('b', { class: 'wait' }, waitText), h('div', { class: 'du-tiles' }, ...tiles));
    const press = (syl, ev, tile) => {
      const time = ui.now();
      ui.hit(game?.tap || 'snare', syl === 'q' ? 0.9 : 0.7);
      const t = time - ui.latency();
      const isOpen = open(t);
      if (isOpen) taps.push({ t, syl });
      bumpEl(tile, 'hit');
      let fb = isOpen ? judge(t) : { cls: 'idle', word: '' };
      // The right moment on the wrong tile: say so.
      if (isOpen && expected) {
        const near = expected.reduce((best, x) => (Math.abs(t - x.t) < Math.abs(t - best.t) ? x : best));
        if (Math.abs(t - near.t) <= tol && near.syl !== syl) fb = { cls: 'off', word: `${TILES.find((x) => x.id === near.syl).label}!` };
      }
      ui.feel?.({ el: tile, ev, t, b: (t - tResp) / spb, open: isOpen, ...fb });
      ui.onPress?.();
    };
    input = () => {};
    keys = (e) => {
      const k = e.key.toLowerCase();
      if (['f', 'd', '1', 'arrowleft'].includes(k)) { press('q', null, tiles[0]); return true; }
      if (['j', 'k', '2', 'arrowright'].includes(k)) { press('ee', null, tiles[1]); return true; }
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
      if (task === 'du' && list.some((x) => tileOf(got, (x.t - tResp) / spb) !== x.syl)) return { right: false, why: 'tiles', got, mic: usedMic };
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
    beats,
    tResp, // audio time the turn starts (heard time), for the Test mode mic log
    keys: (e) => keys(e),
    input: (time, fromMic, ev) => input(time, fromMic, ev),
    grade,
    reveal: (res) => el.reveal?.(res),
    inputs: () => (task === 'note' ? cells.slice() : taps.slice()),
    meter: task === 'say' && ui.mic ? el : null, // the host sets --lv (0 to 1) on it from the mic level
    answerText: (res) => (res.got ? sylText(res.got) : ''),
  };
}

/* Tap It: the object squashes and tilts a new way on every tap, and a little copy of it pops
   off and flies away. */
function tapFun(el, ev) {
  const face = el.querySelector('.tap-face');
  el.style.setProperty('--tilt', `${Math.round(Math.random() * 24 - 12)}deg`);
  const r = el.getBoundingClientRect();
  const fly = document.createElement('span');
  fly.className = 'tap-fly';
  fly.textContent = face.textContent;
  fly.style.left = `${ev?.clientX != null ? ev.clientX - r.left : r.width / 2}px`;
  fly.style.top = `${ev?.clientY != null ? ev.clientY - r.top : r.height / 2}px`;
  fly.style.setProperty('--dx', `${Math.round(Math.random() * 160 - 80)}px`);
  fly.style.setProperty('--rot', `${Math.round(Math.random() * 120 - 60)}deg`);
  fly.addEventListener('animationend', () => fly.remove());
  el.append(fly);
}

function bumpEl(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
