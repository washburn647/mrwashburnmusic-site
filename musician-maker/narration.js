/* Kyle's narration: the words behind every 🔊 read-aloud button, recorded at /studio/record/
   (Narration) and published with the voice takes. Until a line is recorded, the device's voice
   reads it. Ids name the takes: don't rename one that has takes. The text is a script to read
   from; the recording is what plays, word for word as Kyle says it. */

import { allTaskKeys } from './tasks.js';
import { introFor, introSpeech } from './intro.js';

export const MIC_SPEECH = 'Sing with the mic! Tap Test the mic, and say du, du-de, du, du. '
  + 'When the bar moves, the mic can hear you. Then tap Let\'s play.';

export const CLOSET_SPEECH = 'Dress up your buddy! Tap a picture to try it on. '
  + 'Play to earn music notes. When you have enough notes, tap the check to get it.';

// The intros as narrated: no game in particular, so the words fit every game.
const ANY_GAME = { kit: { object: { name: 'the picture' }, instrument: { name: 'the instrument' } } };

export const LINES = [
  { id: 'mic', group: 'Screens', label: 'Microphone screen', text: MIC_SPEECH },
  { id: 'closet', group: 'Screens', label: 'Dress-up screen (avatar)', text: CLOSET_SPEECH },
  ...allTaskKeys().map((key) => {
    const it = introFor(key, ANY_GAME);
    return { id: `intro-${key}`, group: 'Intros', label: `${it.task.name} · step ${it.step.n}, ${it.step.name}`, text: introSpeech(it) };
  }),
];

export const lineById = (id) => LINES.find((l) => l.id === id);
