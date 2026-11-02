/* The micro-games. A game is a silly world and a gesture; the engine hands it a question
   and grades the answer. Each game draws its scene into the stage and returns:
     onCall(i, syl)  a note of the call sounds (syl is set when the call is in syllables)
     onTap()         the learner tapped (or spoke) a note
     win(), fail()   the payoff gag
     onBeat(down, spb, tier)  every beat of the groove (down: beat 1 of the 2/4 bar; tier:
                     the combo tier), so the scene shows the pulse and parties with the band
     hit(), miss()   boss rounds only (optional)
   plus its look for Pick options (pickClass) and Build slots (slotIcon).
   These are first versions of Kyle's ideas; see the design doc's Game ideas. */

import { mookie } from './mookie.js';
import { mouseCatcher } from './scene-mouse.js';

export { mouseCatcher };

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
