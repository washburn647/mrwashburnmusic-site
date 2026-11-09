/* Tasks: what the learner does in a game, whatever the game. Every micro-game rolls a step
   (steps.js) and a task that step uses; the step decides the patterns and what the learner
   hears or sees first (the stimulus), the task decides how they answer. Kyle's writeup of the
   tasks is the source: TASKS[].steps follows it cell by cell, and a step a task leaves out
   (N/A in the writeup) has no cell. More tasks will come: add one here, with its controls in
   turn.js.

   A stimulus is { hear, see }:
     hear  'neutral'         the pattern on "bum"
           'instrument'      the pattern on the game's instrument (games.js KITS)
           'syllables'       the pattern in syllables (du, de)
           'syllables+inst'  syllables with the instrument playing along
           null              nothing to hear
     see   'notation'        the notes on screen during the call (and the turn)
           null              nothing to see
   The director rolls one of a cell's stimuli for each game.
   beats: the learner's turn, if not 4 (beatsOf). */

const S = (hear, see = null) => ({ hear, see });
const EAR = [S('instrument'), S('neutral')]; // instrument or neutral syllables
const ANY = [S('syllables'), S('instrument'), S('neutral')]; // syllables, instrument or neutral
const ROTE_READ = [S('syllables', 'notation'), S('syllables+inst', 'notation')]; // syllables, with or without instrument, seeing notation
const READ = [S(null, 'notation')]; // sees notation
const WRITE = ANY.flatMap((x) => [x, { ...x, see: 'notation' }]); // with or without notation (more points without)

export const TASKS = [
  {
    id: 'say', name: 'Speak/Sing It', cue: 'SAY IT!', icon: '🗣️', xp: 1.5,
    about: 'Say or sing it back. The most important one, so it earns extra XP.',
    steps: {
      1: EAR,
      2: [S('syllables+inst')],
      3: EAR,
      4: EAR,
      5: [S('instrument'), S('neutral'), S('syllables')],
      6: ROTE_READ,
      7: READ,
      8: READ,
    },
  },
  {
    id: 'tap', name: 'Tap It', cue: 'TAP IT!', icon: '👆', xp: 1,
    about: 'Tap it back on something in the game.',
    steps: { 1: EAR, 5: ANY, 6: ROTE_READ, 7: READ, 8: READ },
  },
  {
    id: 'play', name: 'Play It', cue: 'PLAY IT!', icon: '🥁', xp: 1,
    about: 'Play it back on the game\'s instrument.',
    steps: { 1: EAR, 5: ANY, 6: ROTE_READ, 7: READ, 8: READ },
  },
  {
    id: 'du', name: 'Du It', cue: 'DU IT!', icon: 'du', xp: 1,
    about: 'Tap the du and du-de tiles in rhythm.',
    steps: { 2: [S('syllables'), S('syllables+inst')], 3: EAR, 4: EAR, 5: ANY, 6: ROTE_READ, 7: READ, 8: READ },
  },
  {
    id: 'note', name: 'Note It', cue: 'NOTE IT!', icon: '♫', xp: 1, beats: 8,
    about: 'Pick the notes on the note tiles before the 8 beats run out.',
    steps: { 9: ROTE_READ, 10: WRITE, 11: WRITE, 12: WRITE },
  },
];

export const taskById = (id) => TASKS.find((t) => t.id === id);
/* How long the learner's turn is, in beats: 4, or a task's own (Note It picks out of rhythm). */
export const beatsOf = (id) => taskById(id)?.beats || 4;
export const taskKey = (task, step) => `${task}-${step}`; // e.g. 'say-1': intros, strength, NEW tags
export const cellOf = (task, step) => taskById(task)?.steps[step] || null;
export const tasksAt = (step) => TASKS.filter((t) => t.steps[step]);
export const stepsOf = (task) => Object.keys(taskById(task).steps).map(Number);
export const allTaskKeys = () => TASKS.flatMap((t) => stepsOf(t.id).map((n) => taskKey(t.id, n)));
export const parseKey = (key) => {
  const [task, n] = String(key).split('-');
  return cellOf(task, Number(n)) ? { task, step: Number(n) } : null;
};

/* Note It, without the notes to look at, earns more. */
export const XP_NO_NOTES = 1.5;
/* Create answers: the same pattern again soon after earns less (last 12 kept in st.made). */
export const repeatFactor = (times) => [1, 0.6, 0.35, 0.2][Math.min(times, 3)];

const hearText = (hear, game) => ({
  neutral: 'on "bum"',
  instrument: `on ${game?.kit?.instrument?.name || 'an instrument'}`,
  syllables: 'in syllables',
  'syllables+inst': 'in syllables with the instrument',
  'syllables/inst': 'in syllables, sometimes with the instrument',
}[hear]);

/* The stimulus in a few words: "Listen" / "Read it" / "Listen and read". */
export function look(stim) {
  if (stim.hear && stim.see) return 'both';
  return stim.hear ? 'listen' : stim.see ? 'read' : '';
}

/* What to do, in a few words a young reader can take in at a glance: `how` is the line shown
   for the whole game, `go` the shout when it's the learner's turn. game gives the tap object
   and the instrument their names. */
export function howTo({ task, step, stim }, game = null) {
  const kit = game?.kit || {};
  const create = step === 5 || step === 12;
  const l = look(stim);
  const first = l === 'both' ? 'Listen and read. Then ' : l === 'listen' ? 'Listen. Then ' : l === 'read' ? 'Read it. Then ' : '';
  const obj = kit.object?.name || 'the pad';
  const inst = kit.instrument?.name || 'the drum';
  const lines = {
    say: create ? 'say your own answer' : step === 1 ? 'say it back on "bum"' : 'say it in du and de',
    tap: create ? `tap your own answer on ${obj}` : `tap it back on ${obj}`,
    play: create ? `play your own answer on ${inst}` : `play it back on ${inst}`,
    du: create ? 'answer on the du and du-de tiles, in time' : 'tap it on the du and du-de tiles, in time',
    note: create ? 'write your own answer with the notes' : 'tap the notes to write it',
  };
  // short: the line shown during a game, a glance long ("Listen, then tap.").
  const lead = { both: 'Listen and read', listen: 'Listen', read: 'Read' }[l];
  const verb = create ? 'make your own' : { say: 'say it', tap: 'tap', play: 'play', du: 'tap', note: 'write it' }[task];
  const short = lead ? `${lead}, then ${verb}.` : `${verb[0].toUpperCase()}${verb.slice(1)}.`;
  return { how: `${first}${lines[task]}.`, short, go: taskById(task).cue, look: l };
}

/* An intro's lines for a task at a step, from the tables above (intro.js can replace them). */
export function introLines(task, step, game = null) {
  const cell = cellOf(task, step) || [];
  let hs = [...new Set(cell.map((s) => s.hear).filter(Boolean))];
  if (hs.includes('syllables') && hs.includes('syllables+inst')) hs = hs.filter((x) => x !== 'syllables+inst').map((x) => (x === 'syllables' ? 'syllables/inst' : x));
  const hears = hs.map((x) => hearText(x, game));
  const sees = cell.some((s) => s.see);
  const seesAlways = cell.length && cell.every((s) => s.see);
  const first = [];
  if (hears.length) first.push(`You'll hear a pattern ${hears.join(', or ')}${seesAlways ? ', and see its notes' : sees ? '. Sometimes you\'ll see its notes too' : ''}.`);
  else if (sees) first.push('You\'ll see a pattern\'s notes.');
  const { how } = howTo({ task, step, stim: cell[0] || {} }, game);
  const action = how.replace(/^(Listen and read|Listen|Read it)\. Then /, '');
  const lines = [...first, `${action[0].toUpperCase()}${action.slice(1)}`];
  if (task === 'say') lines.push('Say it out loud: the mic hears you.');
  if (task === 'du') lines.push('Tap du for a du, and du-de twice for a du-de.');
  if (task === 'note') lines.push(`You have ${beatsOf(task)} beats to pick them.`);
  if (step === 5 || step === 12) lines.push('Make yours different from mine, and try new ones: the same answer again earns less.');
  if (task === 'note' && step >= 10) lines.push('No notes to look at earns more points.');
  return lines;
}
