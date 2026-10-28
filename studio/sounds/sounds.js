/* Sounds: try the shared samples in /assets/sounds/ (instruments, hits, spoken syllables)
   before they go into a lesson page or game. */

import * as samples from '/assets/sounds/samples.js';
import { h } from '../dom.js';

const app = document.getElementById('app');

const SOLFEGE = { do: 0, re: 2, mi: 4, fa: 5, so: 7, la: 9, ti: 11 };
const repeat = (cell, n = 4) => Array.from({ length: n }, () => cell);

// Each beat is a list of syllables that share it. Tonal beats are [syllable, steps from do].
const PATTERNS = {
  'du': repeat(['du']),
  'du de': repeat(['du', 'de']),
  'du ta de ta': repeat(['du', 'ta', 'de', 'ta']),
  'du · du de · du ta de ta · du': [['du'], ['du', 'de'], ['du', 'ta', 'de', 'ta'], ['du']],
  'du da di': repeat(['du', 'da', 'di']),
  'du ta da ta di ta': repeat(['du', 'ta', 'da', 'ta', 'di', 'ta']),
  'du · du da di · du ta da ta di ta · du': [['du'], ['du', 'da', 'di'], ['du', 'ta', 'da', 'ta', 'di', 'ta'], ['du']],
  'so mi': [[['so', 7]], [['mi', 4]], [['so', 7]], [['mi', 4]]],
  'so la so mi': [[['so', 7]], [['la', 9]], [['so', 7]], [['mi', 4]]],
  'do re mi': [[['do', 0]], [['re', 2]], [['mi', 4]], [['mi', 4]]],
  'mi re do': [[['mi', 4]], [['re', 2]], [['do', 0]], [['do', 0]]],
  'do mi so do': [[['do', 0]], [['mi', 4]], [['so', 7]], [['do', 12]]],
  'do re mi fa so la ti do': [[['do', 0]], [['re', 2]], [['mi', 4]], [['fa', 5]], [['so', 7]], [['la', 9]], [['ti', 11]], [['do', 12]]],
};

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

function range(label, min, max, value, step = 1) {
  const input = h('input', { type: 'range', min, max, value, step });
  const shown = h('output', {}, String(value));
  input.addEventListener('input', () => { shown.textContent = input.value; });
  return { input, el: h('label', {}, label, input, shown) };
}

async function show() {
  const index = await samples.list();
  const pitched = Object.entries(index.instruments).filter(([, s]) => s.kind === 'pitched');
  const hits = Object.entries(index.instruments).filter(([, s]) => s.kind === 'hit');

  /* ---------- Instruments ---------- */

  let inst = null;
  let start = 60;
  const keys = h('div', { class: 'keys' });
  const pick = h('select', { onchange: () => choose(pick.value) },
    pitched.map(([name, s]) => h('option', { value: name }, s.label)));
  const lower = h('button', { onclick: () => drawKeys(start - 12) }, '‹ Octave');
  const higher = h('button', { onclick: () => drawKeys(start + 12) }, 'Octave ›');
  const where = h('span', { class: 'total' });

  async function choose(name) {
    pick.disabled = true;
    inst = null;
    const zones = index.instruments[name].zones;
    const lo = zones[0].midi;
    const hi = zones[zones.length - 1].midi;
    inst = Object.assign(await samples.instrument(name), { lo, hi });
    pick.disabled = false;
    drawKeys(Math.max(lo - (lo % 12), Math.min(60, hi - 24 - ((hi - 24) % 12))));
  }

  function drawKeys(from) {
    if (inst) from = Math.max(inst.lo - (inst.lo % 12), Math.min(from, inst.hi - (inst.hi % 12) - 12));
    start = from;
    where.textContent = `${noteName(from)}–${noteName(from + 24)}`;
    const whites = [];
    const blacks = [];
    for (let m = from; m <= from + 24; m++) {
      const black = [1, 3, 6, 8, 10].includes(m % 12);
      const key = h('button', { class: black ? 'black' : 'white', dataset: { midi: m } }, black ? '' : (m % 12 ? '' : noteName(m)));
      (black ? blacks : whites).push(key);
    }
    const width = 100 / whites.length;
    blacks.forEach((key) => {
      const m = Number(key.dataset.midi);
      const before = whites.filter((w) => Number(w.dataset.midi) < m).length;
      key.style.left = `${before * width - width * 0.3}%`;
      key.style.width = `${width * 0.6}%`;
    });
    keys.replaceChildren(...whites, ...blacks);
  }

  const held = new Map();
  keys.addEventListener('pointerdown', (e) => {
    const key = e.target.closest('button');
    if (!key || !inst) return;
    keys.setPointerCapture?.(e.pointerId);
    const m = Number(key.dataset.midi);
    held.set(e.pointerId, { key, stop: inst.note(m, samples.now(), 8) });
    key.classList.add('down');
  });
  const up = (e) => {
    const k = held.get(e.pointerId);
    if (!k) return;
    k.stop();
    k.key.classList.remove('down');
    held.delete(e.pointerId);
  };
  keys.addEventListener('pointerup', up);
  keys.addEventListener('pointercancel', up);

  function scale() {
    if (!inst) return;
    const t = samples.now() + 0.05;
    [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0].forEach((step, i) => inst.note(start + step, t + i * 0.3, i === 14 ? 1.2 : 0.28));
  }

  /* ---------- Hits ---------- */

  const hitButtons = hits.map(([name, s]) => {
    let hit = null;
    return h('button', { onpointerdown: async () => {
      hit ||= await samples.instrument(name);
      hit.hit(samples.now());
    } }, s.label);
  });

  /* ---------- Syllables ---------- */

  let voice = null;
  let beatSound = null;
  let timer = null;
  const voicePick = h('select', { onchange: () => chooseVoice(voicePick.value) },
    Object.entries(index.voices).map(([name, s]) => h('option', { value: name }, s.label)));
  const patternPick = h('select', {}, Object.keys(PATTERNS).map((p) => h('option', { value: p }, p)));
  const beatPick = h('select', { onchange: async () => { beatSound = beatPick.value ? await samples.instrument(beatPick.value) : null; } },
    h('option', { value: '' }, 'No beat'),
    hits.map(([name, s]) => h('option', { value: name }, s.label)));
  const tempo = range('Tempo', 50, 160, 80);
  const shift = range('Pitch', -12, 12, 0);
  const gap = range('Length', 40, 100, 90, 5);
  const said = h('div', { class: 'said' });
  const playBtn = h('button', { class: 'primary', onclick: () => (timer ? stop() : play()) }, 'Play');

  async function chooseVoice(name) {
    voicePick.disabled = true;
    voice = await samples.voice(name);
    voicePick.disabled = false;
  }

  // Do sits on the C nearest the voice's own speaking pitch.
  function doFor(v) {
    const mids = Object.values(index.voices[v.name].syllables).map((s) => s.midi).sort((a, b) => a - b);
    const mid = mids[Math.floor(mids.length / 2)];
    return Math.round(mid / 12) * 12;
  }

  function play() {
    if (!voice) return;
    const beats = PATTERNS[patternPick.value];
    const spans = beats.map((beat) => h('span', {}, beat.map((s) => (Array.isArray(s) ? s[0] : s)).join(' ')));
    said.replaceChildren(...spans.flatMap((s, i) => (i ? [' · ', s] : [s])));
    let t = samples.now() + 0.15;
    let i = 0;
    playBtn.textContent = 'Stop';
    // Schedule a little ahead on the audio clock, so the beat stays steady.
    const tick = () => {
      while (t < samples.now() + 0.2) {
        const beatLen = 60 / Number(tempo.input.value);
        const beat = beats[i % beats.length];
        const sub = beatLen / beat.length;
        const semis = Number(shift.input.value);
        beatSound?.hit(t, { vol: 0.5 });
        beat.forEach((s, j) => {
          const at = t + j * sub;
          const dur = sub * Number(gap.input.value) / 100;
          if (Array.isArray(s)) voice.say(s[0], at, { midi: doFor(voice) + s[1] + semis, dur });
          else voice.say(s, at, { rate: 2 ** (semis / 12), dur });
        });
        const n = i % beats.length;
        setTimeout(() => spans.forEach((sp, k) => sp.classList.toggle('now', k === n)), Math.max(0, (t - samples.now()) * 1000));
        t += beatLen;
        i++;
      }
    };
    tick();
    timer = setInterval(tick, 25);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    playBtn.textContent = 'Play';
    said.querySelectorAll('.now').forEach((s) => s.classList.remove('now'));
  }

  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '‹ Studio')),
    h('div', { class: 'bar' }, h('h1', { class: 'grow' }, 'Sounds')),
    h('h2', {}, 'Instruments'),
    h('div', { class: 'bar' }, pick, lower, where, higher, h('button', { onclick: scale }, 'Scale')),
    keys,
    h('h2', {}, 'Percussion'),
    h('div', { class: 'hits' }, hitButtons),
    h('h2', {}, 'Syllables'),
    h('div', { class: 'bar' }, voicePick, patternPick, beatPick, playBtn),
    h('div', { class: 'bar' }, tempo.el, shift.el, gap.el),
    said,
  );
  drawKeys(48);
  choose(pick.value);
  chooseVoice(voicePick.value);
}

show();
