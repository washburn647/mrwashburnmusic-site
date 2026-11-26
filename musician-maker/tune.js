/* The tuned instruments for do re mi (Play It, task 'tune'): one key per tone of the unit,
   low on the left, high on the right, in the tone's colour (do red, re orange, mi yellow...).
   Looks: a harp (strings that get shorter as they get higher), gong bowls (smaller as they get
   higher) and a xylophone (shorter bars). A key's syllable shows on it once the step uses
   syllables (step 2 on). Fixed markup only: tones come from the pattern catalogue. */

import { toneLabel, TONES } from '/assets/patterns/patterns.js';

const HARP = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M5 96 V8 Q5 2 12 3 Q40 6 60 22 Q80 38 95 44 V96 Z" fill="none" stroke="#c79a3a" stroke-width="5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><path d="M5 96 H95" stroke="#8a6224" stroke-width="12" vector-effect="non-scaling-stroke"/></svg>';

export const TONE_COLORS = {
  do: '#e5484d', re: '#f2853a', mi: '#f5c518', fa: '#46a758', so: '#12a5a5', la: '#3e7be0', ti: '#8e4ec6',
};
const base = (t) => (t.length === 3 ? t.slice(1) : t);
export const toneColor = (t) => TONE_COLORS[base(t)] || '#999';

/* h: main.js's element helper. tones: low to high. onPress(tone, ev, key). Returns
   { el, keys: tone → button, strike(tone) } (strike: the key shows a hit, for demos). */
export function tunePad(h, { look = 'harp', tones, labels = true, onPress }) {
  const lo = TONES[tones[0]];
  const span = Math.max(1, TONES[tones[tones.length - 1]] - lo);
  const keys = {};
  const row = h('div', { class: 'tune-keys' }, ...tones.map((tone, i) => {
    const up = (TONES[tone] - lo) / span; // 0 lowest, 1 highest
    const b = h('button', {
      class: `tune-key tk-${base(tone)}`,
      'aria-label': labels ? toneLabel(tone) : `note ${i + 1} of ${tones.length}, low to high`,
      'data-tone': tone,
      onpointerdown: (e) => { e.preventDefault(); onPress(tone, e, b); },
    }, h('i', { class: 'tk-body' }), h('b', { class: 'tk-label' }, labels ? toneLabel(tone) : ''));
    b.style.setProperty('--c', toneColor(tone));
    b.style.setProperty('--up', up.toFixed(3));
    keys[tone] = b;
    return b;
  }));
  const el = h('div', { class: `big-tune look-${look}` }, row);
  if (look === 'harp') {
    // The frame: a pillar on the low side, the neck sloping down to the high side, the sound box along the bottom.
    const frame = h('span', { class: 'harp-frame' });
    frame.innerHTML = HARP; // fixed markup
    el.prepend(frame);
  }
  const strike = (tone) => {
    const b = keys[tone];
    if (!b) return;
    b.classList.remove('hit');
    void b.offsetWidth;
    b.classList.add('hit');
  };
  return { el, keys, strike };
}
