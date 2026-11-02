/* The micro-games. A game is a silly world and a gesture; the engine hands it a question
   and grades the answer. Each game draws its scene into the stage and returns:
     onCall(i, syl)  a note of the call sounds (syl is set when the call is in syllables)
     onTap()         the learner tapped (or spoke) a note
     win(), fail()   the payoff gag
     onBeat(down)    every beat of the groove (down: beat 1 of the 2/4 bar), so the scene
                     shows the pulse
   plus its look for Pick options (pickClass) and Build slots (slotIcon).
   These are first versions of Kyle's ideas; see the design doc's Game ideas. */

import { mookie } from './mookie.js';

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

/* Restart a CSS animation class. */
export function bump(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function bubble(stage, text, cls = '') {
  const b = h('div', `bubble ${cls}`, text);
  stage.append(b);
  setTimeout(() => b.remove(), 900);
}

export const mouseCatcher = {
  id: 'mouse-catcher',
  name: 'Mouse Catcher',
  tap: 'snare',
  pickClass: 'opt-hole',
  slotIcon: (c) => (c === 'ee' ? '🧀🧀' : '🧀'),
  make(stage, { boss = false } = {}) {
    stage.className = 'stage scene-mouse';
    const cat = mookie('');
    cat.classList.add('mc-cat');
    const paw = h('div', 'mc-paw', '🐾');
    const hole = h('div', 'mc-hole');
    const mouse = h('div', boss ? 'mc-mouse boss' : 'mc-mouse', boss ? '🐀' : '🐭');
    const eyes = h('div', 'mc-eyes');
    eyes.append(h('i'), h('i'));
    hole.append(eyes, mouse);
    stage.append(h('div', 'floor'), hole, cat, paw);
    return {
      // Mookie's head ticks side to side like a metronome; eyes blink in the hole on beat 1.
      onBeat(down) {
        cat.classList.toggle('lean-l', down);
        cat.classList.toggle('lean-r', !down);
        if (down) { bump(cat, 'flick'); bump(eyes, 'blink'); }
      },
      onCall(i, syl) {
        bump(mouse, 'peek');
        bubble(stage, syl || 'squeak!', 'mc-squeak');
      },
      onTap() { bump(paw, 'swipe'); },
      win() {
        mouse.classList.add('caught');
        cat.mood('happy');
        bubble(stage, 'GOTCHA!', 'big');
      },
      fail() {
        mouse.classList.add('flee');
        cat.mood('oops');
        bubble(stage, 'HA HA HA!', 'big bad');
      },
    };
  },
};

export const supperTime = {
  id: 'supper-time',
  name: 'Supper Time',
  tap: 'agogo',
  pickClass: 'opt-bowl',
  slotIcon: (c) => (c === 'ee' ? '🐟🐟' : '🐟'),
  make(stage) {
    stage.className = 'stage scene-supper';
    const cat = mookie('sleep');
    cat.classList.add('st-cat');
    const zzz = h('div', 'st-zzz', 'z z z');
    const bowl = h('div', 'st-bowl', '🥣');
    const thieves = h('div', 'st-thieves', '🐈 🐈');
    zzz.replaceChildren(h('i', '', 'z'), h('i', '', 'z'), h('i', '', 'z'));
    const cushion = h('div', 'st-cushion');
    stage.append(h('div', 'floor'), cushion, cat, zzz, bowl, thieves);
    let n = 0;
    const clang = (text) => {
      bump(bowl, 'wobble');
      bubble(stage, text, 'st-clang');
    };
    return {
      onCall(i, syl) { clang(syl || 'clang!'); },
      onTap() { clang('CLANG!'); },
      // Mookie snores on the beat: a big breath on 1, a small one on 2, and one z floats up per beat.
      onBeat(down) {
        if (!cat.classList.contains('dash')) {
          bump(cat, down ? 'breathe' : 'breathe-s');
          bump(cushion, down ? 'squish' : 'squish-s');
        }
        if (zzz.isConnected) bump(zzz.children[n++ % 3], 'zpop');
      },
      win() {
        zzz.remove();
        cat.mood('happy');
        cat.classList.add('dash');
        bubble(stage, 'NOM NOM NOM!', 'big');
      },
      fail() {
        thieves.classList.add('steal');
        bowl.classList.add('gone');
        bubble(stage, 'Bindi and Rusty got your supper!', 'big bad');
      },
    };
  },
};

export const GAMES = [mouseCatcher, supperTime];
