/* The micro-games. A game is a silly world and a gesture; the engine hands it a question
   and grades the answer. Each game draws its scene into the stage and returns:
     onCall(i, syl)  a note of the call sounds (syl is set when the call is in syllables)
     onTap()         the learner tapped (or spoke) a note
     win(), fail()   the payoff gag
     onBeat(down, spb, tier)  every beat of the groove (down: beat 1 of the 2/4 bar; tier:
                     the combo tier), so the scene shows the pulse and parties with the band
     hit(), miss()   boss rounds only (optional; a game with a bossName can host the boss)
   plus its look for Pick options (pickClass) and Build slots (slotIcon).
   These are first versions of Kyle's ideas; see the design doc's Game ideas. */

import { mouseCatcher } from './scene-mouse.js';
import { supperTime } from './scene-supper.js';

export { mouseCatcher, supperTime };

/* Restart a CSS animation class. */
export function bump(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export const GAMES = [mouseCatcher, supperTime];
