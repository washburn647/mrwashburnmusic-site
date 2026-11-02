/* The micro-games. A game is a silly world and a gesture; the engine hands it a question
   and grades the answer. Each game draws its scene into the stage and returns:
     onCall(i, syl)  a note of the call sounds (syl is set when the call is in syllables)
     onTap()         the learner tapped (or spoke) a note
     win(), fail()   the payoff gag
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
    hole.append(mouse);
    stage.append(h('div', 'floor'), hole, cat, paw);
    return {
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
    stage.append(h('div', 'floor'), h('div', 'st-cushion'), cat, zzz, bowl, thieves);
    const clang = (text) => {
      bump(bowl, 'wobble');
      bubble(stage, text, 'st-clang');
    };
    return {
      onCall(i, syl) { clang(syl || 'clang!'); },
      onTap() { clang('CLANG!'); },
      win() {
        zzz.remove();
        cat.mood('happy');
        cat.classList.add('run');
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
