/* Listen and Try this, on every exhibit (the tunes and tasks are in lessons.js).
   Listen: the instrument plays a tune on itself, pressing its own keys, valves and strings.
   Try this: an easy, a medium and a hard task, checked as the visitor plays.
   Each instrument module gives the coach a performer (kit.performer) that knows how to play
   one sound of a tune on it:
     can(ev)         it can play this sound (a note in its range, a part it has)
     prepare(evs)    get ready for a tune: scroll the keys into view, set the harp's pedals...
     down(ev)        play it, and show it; gives a handle for up
     up(handle, ev)  let it go
     finish()        lift everything
   plus, for drums, levels (its parts from low to high, for a melody's rhythm) and names. */

import * as score from './score.js';
import { LESSONS, COMMON } from './lessons.js';

const $ = (id) => document.getElementById(id);
const LEVELS = ['Easy', 'Medium', 'Hard'];
let cur = null;       // the exhibit on show: { ex, kit, lesson }
let show = null;      // the tune playing: { timers, name }
let task = null;      // the task being tried: { n, check }

/* ---------- tunes ---------- */

/* The sounds of one of the exhibit's tunes (0 scale, 1 Hot Cross Buns, 2 Twinkle, 3 its own). */
export function tune(ex, n) {
  const L = LESSONS[ex.id];
  const written = ex.written || 0;
  if (n === 3) {
    const t = L.tune;
    return { name: t.name, by: t.by, evs: score.events(t.voices, { bpm: t.bpm, shift: -written }) };
  }
  const c = COMMON[n];
  if (L.home) {
    // Written in C from middle C: moved to the instrument's home key, then to sounding pitch.
    const shift = score.midi(L.home) - 60 - written;
    return { name: c.name, by: n === 0 ? `${L.home.replace(/\d/, '').replace('b', '♭').replace('#', '♯')} major, up and down` : c.by, evs: score.events(c.voices, { bpm: c.bpm, shift }) };
  }
  // A drum: the same rhythm, on its parts from low to high where it has several.
  if (n === 0) return { name: 'Rhythm ladder', by: 'Whole, half, quarter and eighth notes', evs: ladder() };
  const evs = score.events(c.voices, { bpm: c.bpm + 6 });
  const levels = cur?.kit.perf?.levels || ['x'];
  const ms = [...new Set(evs.map((e) => e.midi))].sort((a, b) => a - b);
  evs.forEach((e) => {
    e.part = levels[Math.min(levels.length - 1, Math.floor((ms.indexOf(e.midi) / ms.length) * levels.length))];
    delete e.midi;
  });
  return { name: c.name, by: 'Its rhythm', evs };
}

function ladder() {
  const perf = cur?.kit.perf;
  const [main, end] = perf?.ladder || [perf?.levels?.at(-1) || 'x', perf?.levels?.[0] || 'x'];
  const bar = (n) => Array(n).fill(`${main}${['---', '-', '', '/'][Math.log2(n)]}`).join(' ');
  return score.events(`${bar(1)} ${bar(2)} ${bar(4)} ${bar(8)} ${end}!---`, { bpm: 96 });
}

/* Play sounds on the instrument. */
export function play(evs, { name = '', by = '' } = {}) {
  stop();
  const perf = cur?.kit.perf;
  if (!perf) return;
  perf.prepare?.(evs);
  const ok = evs.filter((e) => perf.can(e));
  const timers = [];
  const start = performance.now() + 150;
  const at = (s, f) => timers.push(setTimeout(f, Math.max(0, start + s * 1000 - performance.now())));
  for (const e of ok) {
    at(e.at, () => {
      const h = perf.down(e);
      // Held sounds part a little before the next note, so each one is heard on its own.
      if (!e.slur) at(e.at + e.dur * (e.midi != null ? 0.92 : 1), () => perf.up(h, e));
    });
  }
  const total = score.length(ok);
  at(total + 0.3, () => stop());
  show = { timers, name };
  if (name) strip({ kind: 'listen', title: name, sub: by, total });
  else if (task) taskStrip();
}

export function stop() {
  if (!show) return;
  show.timers.forEach(clearTimeout);
  const was = show;
  show = null;
  cur?.kit.perf?.finish?.();
  if (was.name) task ? taskStrip() : strip(null);
  else if (task) taskStrip();
}

/* ---------- tasks ---------- */

/* A task's goal, as lessons.js writes it ('notes:C4 D4', 'steady:8', ...), made into a checker. */
export function goal(text, ex) {
  const [kind, ...args] = text.split(':');
  const written = ex.written || 0;
  const list = (s) => s.trim().split(/\s+/);
  const sounding = (s) => list(s).map((n) => score.midi(n) - written);
  const label = (s) => list(s).map((n) => n.replace(/^([A-G])#/, '$1♯').replace(/^([A-G])b/, '$1♭'));
  const g = { kind, done: false, lit: [], labels: [], targets: [] };
  const times = [];
  if (kind === 'notes' || kind === 'any' || kind === 'together') {
    g.targets = sounding(args[0]);
    g.labels = label(args[0]);
  } else if (kind === 'hits' || kind === 'chords') {
    g.targets = list(args[0]);
    g.labels = g.targets.map((p) => cur?.kit.perf?.names?.[p] || p);
  } else if (kind === 'rhythm') {
    // The gaps between beats, in beats: '1 1 2' is ta, ta, ta-a.
    g.pattern = list(args[0]).map(Number);
    g.labels = Array(g.pattern.length + 1).fill('');
  } else if (kind === 'steady' || kind === 'fast' || kind === 'gliss') {
    g.count = Number(args[0]);
    g.within = Number(args[1]) || 2;
    g.part = kind === 'steady' ? args[1] : args[2];
    g.labels = Array(g.count).fill('');
  } else {
    g.labels = [kind === 'roll' ? 'Roll' : kind === 'choke' ? 'Stop the sound' : kind];
  }
  g.lit = g.labels.map(() => false);
  const matches = (e, target) => (kind === 'chords' ? e.chord === target : kind === 'hits' ? e.part === target : e.midi === target);

  g.feed = (e, t) => {
    if (g.done) return false;
    const was = g.lit.join();
    if (kind === 'notes' || kind === 'hits' || kind === 'chords') {
      // In order; a wrong note in between doesn't matter.
      const i = g.lit.indexOf(false);
      if (matches(e, g.targets[i])) g.lit[i] = true;
    } else if (kind === 'any') {
      g.targets.forEach((m, i) => { if (e.midi === m) g.lit[i] = true; });
    } else if (kind === 'together') {
      times.push([t, e.midi]);
      while (times.length && t - times[0][0] > 0.18) times.shift();
      g.lit = g.targets.map((m) => times.some(([, x]) => x === m));
    } else if (kind === 'steady' || kind === 'fast') {
      if (g.part && e.part !== g.part) return false;
      if (e.midi == null && e.part == null) return false;
      times.push(t);
      let n = 1;
      if (kind === 'fast') n = times.filter((x) => t - x <= g.within).length;
      else {
        // Each gap close to the last ones: an even beat, not too slow.
        for (let k = times.length - 1; k > 0; k--) {
          const gap = times[k] - times[k - 1];
          const ref = times[times.length - 1] - times[times.length - 2];
          if (gap > 1.6 || gap < 0.12 || Math.abs(gap - ref) > ref * 0.22) break;
          n++;
        }
      }
      g.lit = g.labels.map((_, i) => i < n);
    } else if (kind === 'gliss') {
      if (e.midi == null) return false;
      times.push([t, e.midi]);
      let n = 1;
      let dir = 0;
      for (let k = times.length - 1; k > 0; k--) {
        const [ta, a] = times[k - 1];
        const [tb, b] = times[k];
        const d = Math.sign(b - a);
        if (!d || tb - ta > 0.35 || (dir && d !== dir)) break;
        dir = d;
        n++;
      }
      g.lit = g.labels.map((_, i) => i < n);
    } else if (kind === 'rhythm') {
      if (e.midi == null && e.part == null) return false;
      times.push(t);
      // The longest run of the latest beats that fits the start of the rhythm, at any speed.
      let n = 1;
      for (let k = Math.min(times.length, g.pattern.length + 1); k >= 2; k--) {
        const gaps = times.slice(-k).map((x, j, a) => (j ? x - a[j - 1] : 0)).slice(1);
        const want = g.pattern.slice(0, k - 1);
        const scale = gaps.reduce((a, b) => a + b, 0) / want.reduce((a, b) => a + b, 0);
        if (gaps.every((x, j) => x < 2.5 && Math.abs(x - want[j] * scale) <= want[j] * scale * 0.28)) { n = k; break; }
      }
      g.lit = g.labels.map((_, i) => i < n);
    } else if ((kind === 'roll' && e.roll) || (kind === 'choke' && e.choke)) {
      g.lit = [true];
    }
    g.done = g.lit.every(Boolean);
    return g.done || g.lit.join() !== was;
  };

  // "Show me": the same task, played by the instrument.
  g.demo = () => {
    const perf = cur?.kit.perf;
    const L = LESSONS[ex.id];
    const home = L.home ? score.midi(L.home) - written : null;
    const q = (items) => items.join(' ');
    if (kind === 'notes' || kind === 'any') return score.events(q(g.targets.map(midiName)), { bpm: 92 });
    if (kind === 'together') return score.events(`${g.targets.map(midiName).join('+')}--`, { bpm: 92 });
    if (kind === 'hits') return score.events(q(g.targets), { bpm: 92 });
    if (kind === 'chords') return score.events(q(g.targets.map((c) => `@${c}-`)), { bpm: 92 });
    const one = g.part || (home != null ? midiName(home) : perf?.levels?.at(-1) || 'x');
    if (kind === 'steady') return score.events(q(Array(g.count).fill(one)), { bpm: 88 });
    if (kind === 'fast') return score.events(q(Array(g.count).fill(`${one}//`)), { bpm: 100 });
    if (kind === 'gliss' && home != null) {
      const run = [];
      for (let m = home; run.length < g.count + 4; m++) if (perf?.can({ midi: m, at: 0, dur: 0.1 })) run.push(`${midiName(m)}//`);
      return score.events(q(run), { bpm: 70 });
    }
    if (kind === 'rhythm') {
      const [base] = score.events(one);
      const beat = 60 / 92;
      let t = 0;
      return [...g.pattern, 1].map((b) => {
        const e = { ...base, at: t, dur: b * beat };
        t += b * beat;
        return e;
      });
    }
    if (kind === 'roll') return score.events('roll--', { bpm: 80 });
    if (kind === 'choke') return score.events('x! choke', { bpm: 60 });
    return [];
  };
  return g;
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiName = (m) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

function begin(n) {
  stop();
  const [text, g] = LESSONS[cur.ex.id].tasks[n];
  task = { n, text, check: goal(g, cur.ex) };
  taskStrip();
}

/* What the visitor plays, from the instrument: { midi } or { part } or { chord }. */
export function heard(e) {
  if (show || !task || task.check.done) return;
  if (task.check.feed(e, performance.now() / 1000)) {
    if (task.check.done) passed(task.n);
    taskStrip();
  }
}

const KEY = 'museum-tried';
function record() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function passed(n) {
  const all = record();
  const mine = all[cur.ex.id] || [];
  mine[n] = true;
  all[cur.ex.id] = mine;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private window */ }
}

/* ---------- the strip under the header, and the menus ---------- */

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function strip(state) {
  const box = $('coach');
  box.replaceChildren();
  box.hidden = !state;
  if (!state) return;
  box.dataset.kind = state.kind;
  const words = el('div', 'words');
  if (state.badge) words.append(el('span', 'badge', state.badge));
  words.append(el('span', 'title', state.title));
  if (state.sub) words.append(el('span', 'sub', state.sub));
  box.append(words);
  if (state.kind === 'listen') {
    const bar = el('div', 'bar-line');
    const fill = el('span');
    bar.append(fill);
    box.append(bar);
    fill.style.transitionDuration = `${state.total + 0.15}s`;
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = '100%'; }));
  }
  if (state.chips) box.append(state.chips);
  const btns = el('div', 'btns');
  for (const b of state.buttons || []) btns.append(b);
  if (state.kind === 'listen') btns.append(button('Stop', 'stop', () => stop()));
  else btns.append(button('Close', 'close', () => { task = null; stop(); strip(null); }));
  box.append(btns);
}

function button(label, icon, onClick, word = false) {
  const b = el('button', `tool ${icon}`);
  b.innerHTML = ICONS[icon] || '';
  b.append(el('span', word ? '' : 'word', label));
  if (!word) b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

function taskStrip() {
  if (!task) return;
  const c = task.check;
  const chips = el('ol', `chips ${c.kind}`);
  c.labels.forEach((l, i) => {
    const li = el('li', c.lit[i] ? 'lit' : '', l);
    if (!c.lit[i] && c.lit.indexOf(false) === i && /notes|hits|chords/.test(c.kind)) li.classList.add('next');
    chips.append(li);
  });
  const buttons = [];
  // Passed: on to the next task not yet passed (the harder one first).
  const passedAll = record()[cur.ex.id] || [];
  const left = [1, 2].map((k) => (task.n + k) % 3).find((k) => !passedAll[k]);
  if (c.done) {
    if (left != null) buttons.push(button(`Try ${LEVELS[left].toLowerCase()}`, 'next', () => begin(left), true));
  } else if (show) {
    buttons.push(button('Stop', 'stop', () => stop()));
  } else {
    buttons.push(button('Show me', 'play', () => play(c.demo())));
  }
  strip({
    kind: c.done ? 'done' : 'task',
    badge: c.done ? '★' : LEVELS[task.n],
    title: c.done ? (left == null ? 'You did all three!' : 'You did it!') : task.text,
    sub: c.done ? task.text : '',
    chips: c.done ? null : chips,
    buttons,
  });
  // Keep the next note to find in view on a narrow screen.
  chips.querySelector('.next')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
}

function menu(kind) {
  const m = $('menu');
  if (!m.hidden && m.dataset.kind === kind) { closeMenu(); return; }
  m.replaceChildren();
  m.dataset.kind = kind;
  const section = (head, items) => {
    m.append(el('p', 'head', head));
    for (const [title, sub, go] of items) {
      const b = el('button', 'item');
      b.setAttribute('role', 'menuitem');
      b.append(el('span', 'title', title), el('span', 'sub', sub));
      b.addEventListener('click', () => { closeMenu(); go(); });
      m.append(b);
    }
  };
  if (kind !== 'try') {
    const items = [];
    for (let n = 0; n < 4; n++) {
      const t = tune(cur.ex, n);
      items.push([t.name, t.by, () => play(t.evs, t)]);
    }
    section(`Listen to the ${cur.ex.name.toLowerCase()}`, items);
  }
  if (kind !== 'listen') {
    const done = record()[cur.ex.id] || [];
    section('Try this', LESSONS[cur.ex.id].tasks.map(([text], n) => [`${LEVELS[n]}${done[n] ? ' ✓' : ''}`, text, () => begin(n)]));
  }
  m.hidden = false;
  $(kind === 'try' ? 'try' : 'listen').setAttribute('aria-expanded', 'true');
  m.querySelector('button')?.focus();
}

function closeMenu() {
  const m = $('menu');
  if (m.hidden) return;
  m.hidden = true;
  $('listen').setAttribute('aria-expanded', 'false');
  $('try').setAttribute('aria-expanded', 'false');
}

/* ---------- the exhibit coming and going ---------- */

export function mount(ex, kit) {
  unmount();
  cur = { ex, kit };
  const ok = !!(LESSONS[ex.id] && kit.perf);
  $('listen').hidden = !ok;
  $('try').hidden = !ok;
}

export function unmount() {
  stop();
  task = null;
  closeMenu();
  strip(null);
  cur = null;
}

/* For the tests: what is on show. */
export const state = () => ({ cur, show, task });

// On a phone there is one button for both.
const narrow = matchMedia('(max-width: 480px)');
const label = () => $('listen').setAttribute('aria-label', narrow.matches ? 'Listen and try this' : 'Listen');
narrow.addEventListener('change', label);
label();
$('listen').addEventListener('click', () => cur && menu(narrow.matches ? 'both' : 'listen'));
$('try').addEventListener('click', () => cur && menu('try'));
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#menu, #listen, #try')) closeMenu();
  // Playing the instrument yourself stops the tune.
  if (show && e.target.closest('#stage')) stop();
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeMenu(); return; }
  if (show && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && /^(.|Shift|Arrow\w+)$/.test(e.key) && !e.target.closest?.('#coach, #menu')) stop();
}, true);

const ICONS = {
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
