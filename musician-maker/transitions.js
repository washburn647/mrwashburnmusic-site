/* Transitions between micro-games. Each one covers the stage on the beat, the next game's
   scene is swapped in underneath, then it uncovers. Times are in beats, so they speed up
   with the tempo:
     cover   beats from the downbeat until the stage is fully hidden (the swap happens then)
     reveal  beats to uncover
   build(layer, spb) draws the pieces; style.css animates them with the classes tx-in and
   tx-out. sound(snd, t, spb) plays its sound from audio time t (the downbeat).
   Fixed markup only: nothing a learner types goes in here. */

import { mookie } from './mookie.js';

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

const rnd = (a, b) => a + Math.random() * (b - a);

export const TRANSITIONS = [
  {
    id: 'paw',
    name: 'Paw Swipe',
    about: 'Three claw swipes rip across, a paw print stamps, the claws rip away.',
    cover: 0.5,
    reveal: 0.75,
    build(layer) {
      [0, 1, 2].forEach((i) => {
        const c = h('div', 'claw');
        c.style.setProperty('--i', i);
        layer.append(c);
      });
      layer.append(h('div', 'paw-stamp', '🐾'));
    },
    sound(snd, t, spb) {
      [0, 1, 2].forEach((i) => snd.hit('guiro', t + i * spb / 6, 0.6));
      snd.hit('bass-drum', t + spb / 2, 0.7);
    },
  },
  {
    id: 'curtain',
    name: 'Curtain Call',
    about: 'Red velvet curtains swing shut on a drum roll and open on a cymbal.',
    cover: 0.75,
    reveal: 0.75,
    build(layer) {
      layer.append(h('div', 'drape l'), h('div', 'drape r'), h('div', 'valance'));
    },
    sound(snd, t, spb) {
      for (let k = 0; k < 6; k++) snd.hit('snare', t + k * spb / 8, 0.25 + k * 0.07);
      snd.hit('cymbal', t + 0.75 * spb, 0.45);
    },
  },
  {
    id: 'iris',
    name: 'Mookie Iris',
    about: 'The screen closes to a circle around Mookie, he grins, it shuts and opens on the new game.',
    cover: 1,
    reveal: 0.75,
    build(layer) {
      const ring = h('div', 'iris');
      const cat = mookie('');
      ring.append(cat);
      layer.append(ring);
      layer.grin = () => cat.mood('happy');
    },
    sound(snd, t, spb) {
      snd.hit('triangle', t, 0.4);
      snd.hit('finger-cymbals', t + 0.5 * spb, 0.5);
      snd.hit('bongo-low', t + spb, 0.6);
    },
    mid(layer, spb) { setTimeout(() => layer.grin?.(), 0.45 * spb * 1000); },
  },
  {
    id: 'keys',
    name: 'Piano Keys',
    about: 'Eight piano keys drop one by one up a scale, then lift back down it.',
    cover: 0.75,
    reveal: 0.75,
    build(layer) {
      for (let i = 0; i < 8; i++) {
        const k = h('div', `pkey${[0, 1, 3, 4, 5].includes(i) ? ' sharp' : ''}`);
        k.style.setProperty('--i', i);
        layer.append(k);
      }
    },
    sound(snd, t, spb) {
      const up = [60, 62, 64, 65, 67, 69, 71, 72];
      const step = (0.75 * spb * 0.7) / 7;
      up.forEach((m, i) => snd.note('marimba', m + 12, t + i * step, 0.12, 0.28));
      [...up].reverse().forEach((m, i) => snd.note('marimba', m + 12, t + 0.75 * spb + i * step, 0.12, 0.22));
    },
  },
  {
    id: 'yarn',
    name: 'Yarn Ball',
    about: 'A ball of yarn rolls across and unrolls a stripe over the stage; Mookie chases it off.',
    cover: 0.75,
    reveal: 0.75,
    build(layer) {
      layer.append(h('div', 'yarn-band'), h('div', 'yarn-ball', '🧶'));
      const cat = mookie('');
      cat.classList.add('yarn-cat');
      layer.append(cat);
    },
    sound(snd, t, spb) {
      for (let k = 0; k < 6; k++) snd.hit('shaker', t + k * spb / 8, 0.5);
      snd.hit('cowbell', t + 0.75 * spb, 0.35);
      for (let k = 0; k < 4; k++) snd.hit('shaker', t + 0.75 * spb + k * spb / 6, 0.4);
    },
  },
  {
    id: 'record',
    name: 'Spin the Record',
    about: 'A giant record spins in to cover the stage, gets scratched, and spins away.',
    cover: 0.75,
    reveal: 0.75,
    build(layer) {
      const disc = h('div', 'vinyl');
      const label = h('div', 'vinyl-label');
      label.append(mookie('happy'));
      disc.append(label);
      layer.append(disc);
    },
    sound(snd, t, spb) {
      snd.hit('log-drum-low', t, 0.6);
      snd.hit('log-drum-high', t + spb / 4, 0.5);
      snd.fx.scratch(t + 0.75 * spb);
    },
  },
  {
    id: 'notes',
    name: 'Note Storm',
    about: 'A blizzard of quarter and eighth notes blows in, fills the stage, and blows away.',
    cover: 0.75,
    reveal: 0.75,
    build(layer) {
      layer.append(h('div', 'storm-bg'));
      const glyphs = ['♩', '♫', '♩', '♫', '♪'];
      for (let i = 0; i < 28; i++) {
        const n = h('div', 'storm-note', glyphs[i % glyphs.length]);
        n.style.setProperty('--x', `${rnd(-4, 96).toFixed(1)}%`);
        n.style.setProperty('--y', `${rnd(-6, 86).toFixed(1)}%`);
        n.style.setProperty('--rot', `${rnd(-40, 40).toFixed(0)}deg`);
        n.style.setProperty('--d', rnd(0, 0.45).toFixed(2));
        n.style.setProperty('--s', rnd(0.8, 1.6).toFixed(2));
        layer.append(n);
      }
    },
    sound(snd, t, spb) {
      snd.hit('sleigh-bells', t, 0.35);
      snd.hit('finger-cymbals', t + 0.75 * spb, 0.4);
      [79, 84, 88].forEach((m, i) => snd.note('marimba', m, t + 0.75 * spb + i * 0.05, 0.12, 0.2));
    },
  },
  {
    id: 'pounce',
    name: 'Mookie Pounce',
    about: 'Mookie leaps at the screen and fills it with black fur, then drops out of sight.',
    cover: 0.75,
    reveal: 0.75,
    build(layer) {
      const cat = mookie('happy');
      cat.classList.add('pounce-cat');
      layer.append(h('div', 'fur'), cat);
    },
    sound(snd, t, spb) {
      snd.hit('bongo-low', t, 0.6);
      snd.hit('bongo-high', t + spb / 4, 0.6);
      snd.hit('conga', t + 0.6 * spb, 0.7);
      snd.hit('bass-drum', t + 0.75 * spb, 0.6);
    },
  },
];

/* The boss gets its own: hazard-striped blast doors slam shut. */
export const BOSS_TX = {
  id: 'boss',
  name: 'Boss Doors',
  about: 'Hazard-striped doors slam shut with a shake, then grind open on the boss.',
  cover: 0.5,
  reveal: 1,
  build(layer) {
    layer.append(h('div', 'door top'), h('div', 'door bottom'), h('div', 'door-sign', '⚠ BOSS ⚠'));
  },
  sound(snd, t, spb) {
    snd.hit('bass-drum', t + 0.5 * spb, 0.9);
    snd.hit('cymbal', t + 0.5 * spb, 0.5);
  },
};

export const byId = (id) => [...TRANSITIONS, BOSS_TX].find((x) => x.id === id);

let last = null;

/* Pick the next one: the chosen favourite, or any but the last. */
export function pick(choice) {
  const fixed = byId(choice);
  if (fixed) return fixed;
  const list = TRANSITIONS.filter((x) => x !== last);
  last = list[Math.floor(Math.random() * list.length)];
  return last;
}

/* Run tx over wrap, starting now. swap() runs when the stage is hidden. */
export function play(wrap, tx, spb, swap) {
  wrap.querySelectorAll(':scope > .tx').forEach((old) => old.remove());
  const layer = h('div', `tx tx-${tx.id}`);
  const cover = tx.cover * spb;
  const reveal = tx.reveal * spb;
  layer.style.setProperty('--c', `${cover}s`);
  layer.style.setProperty('--r', `${reveal}s`);
  tx.build(layer, spb);
  const stage = wrap.querySelector('.stage');
  stage.after(layer);
  void layer.offsetWidth;
  layer.classList.add('tx-in');
  tx.mid?.(layer, spb);
  setTimeout(() => {
    swap();
    layer.classList.replace('tx-in', 'tx-out');
    setTimeout(() => layer.remove(), reveal * 1000 + 80);
  }, cover * 1000);
}
