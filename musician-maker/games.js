/* The micro-games. A game is a silly world and a gesture; the engine hands it a question
   and grades the answer. Each game draws its scene into the stage and returns:
     onCall(i, syl)  a note of the call sounds (syl is set when the call is in syllables)
     onTap()         the learner tapped (or spoke) a note
     win(), fail()   the payoff gag
     onBeat(down, spb, tier)  every beat of the groove (down: beat 1 of the 2/4 bar; tier:
                     the combo tier), so the scene shows the pulse and parties with the band
     hit(), miss()   boss rounds only (optional; a game with a bossName can host the boss)
   plus its kit for the tasks (tasks.js): the object Tap It taps and the instrument Play It
   plays (and the stimulus "on the instrument" sounds on). KITS holds them, so a scene file
   doesn't need to; a scene can set its own `kit` instead. Their sounds can be changed in the
   game workshop (options.js: tap, play).
   These are first versions of Kyle's ideas; see the design doc's Game ideas. */

import { mouseCatcher } from './scene-mouse.js';
import { supperTime } from './scene-supper.js';
import { brushingTime } from './scene-brush.js';
import { pettingTime } from './scene-pet.js';

export { mouseCatcher, supperTime, brushingTime, pettingTime };

/* Restart a CSS animation class. */
export function bump(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export const GAMES = [mouseCatcher, supperTime, brushingTime, pettingTime];

export const KITS = {
  'mouse-catcher': { object: { name: 'the mouse', icon: '🐭' }, instrument: { name: 'the bongos', icon: '🪘', sound: 'bongo-high' } },
  'supper-time': { object: { name: 'the gong bowl', icon: '🥣' }, instrument: { name: 'the dinner bell', icon: '🔔', sound: 'cowbell' } },
  'brushing-time': { object: { name: 'the brush', icon: '🪮' }, instrument: { name: 'the maracas', icon: '🪇', sound: 'shaker' } },
  'petting-time': { object: { name: 'Mookie', icon: '🐈‍⬛' }, instrument: { name: 'the guiro', icon: '🪵', sound: 'guiro' } },
};
const DEFAULT_KIT = { object: { name: 'the pad', icon: '👆' }, instrument: { name: 'the drum', icon: '🥁', sound: 'conga' } };
for (const g of GAMES) g.kit ||= KITS[g.id] || DEFAULT_KIT;
