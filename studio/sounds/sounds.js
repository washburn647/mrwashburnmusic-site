/* Sounds: try the shared samples in /assets/sounds/ (instruments and hits)
   before they go into a lesson page or game. */

import * as samples from '/assets/sounds/samples.js';
import { h } from '../dom.js';

const app = document.getElementById('app');

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

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

  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '‹ Studio')),
    h('div', { class: 'bar' }, h('h1', { class: 'grow' }, 'Sounds')),
    h('h2', {}, 'Instruments'),
    h('div', { class: 'bar' }, pick, lower, where, higher, h('button', { onclick: scale }, 'Scale')),
    keys,
    h('h2', {}, 'Percussion'),
    h('div', { class: 'hits' }, hitButtons),
  );
  drawKeys(48);
  choose(pick.value);
}

show();
