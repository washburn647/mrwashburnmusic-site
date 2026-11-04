/* The 12 steps of Conversational Solfège as the stream uses them, and Unit 1's patterns.
   A step is where the learner is in the curriculum; what they do at a step is a task
   (tasks.js), and what they hear or see first depends on both. Games never know which step
   they are teaching. Patterns and their ids come from the site's catalogue, so recordings made
   at /studio/record/ fit here.
   set: which patterns the step uses (fam: familiar, unf: unfamiliar, any). */

import { DEFAULT_UNITS, unitPatterns, patternById, siteUnits } from '/assets/patterns/patterns.js';

export const STEPS = [
  null,
  { n: 1, band: 'ear', name: 'Rote', set: 'fam', about: 'Echo patterns you hear on "bum" or on an instrument.' },
  { n: 2, band: 'ear', name: 'CS Rote', set: 'fam', about: 'Echo patterns you hear in syllables.' },
  { n: 3, band: 'ear', name: 'CS Decode Familiar', set: 'fam', about: 'Hear a pattern you know without its syllables, and give them back.' },
  { n: 4, band: 'ear', name: 'CS Decode Unfamiliar', set: 'unf', about: 'The same, with patterns you haven\'t learned yet.' },
  { n: 5, band: 'ear', name: 'Create', set: 'any', about: 'Answer with a pattern of your own.' },
  { n: 6, band: 'read', name: 'Reading Rote', set: 'fam', about: 'Echo the syllables while you see the notes.' },
  { n: 7, band: 'read', name: 'Reading Familiar', set: 'fam', about: 'Read patterns you know.' },
  { n: 8, band: 'read', name: 'Reading Unfamiliar', set: 'unf', about: 'Read patterns you haven\'t learned yet.' },
  { n: 9, band: 'write', name: 'Writing Rote', set: 'fam', about: 'Write the notes while you hear them and see them.' },
  { n: 10, band: 'write', name: 'Writing Familiar', set: 'fam', about: 'Write patterns you know from hearing them.' },
  { n: 11, band: 'write', name: 'Writing Unfamiliar', set: 'unf', about: 'Write patterns you haven\'t learned yet from hearing them.' },
  { n: 12, band: 'write', name: 'Writing Create', set: 'any', about: 'Write a pattern of your own as an answer.' },
];

/* Create steps: the answer is the learner's own pattern, not an echo. */
export const isCreate = (n) => n === 5 || n === 12;

export const BANDS = { ear: 'Ear', read: 'Read', write: 'Write' };

export const UNIT = DEFAULT_UNITS.find((u) => u.id === 'unit-1');
export const ALL = unitPatterns(UNIT); // every 2-bar pattern of ♩ and ♫ in 2/4
// The unit's syllables, for Du It's tiles: on the beat, and on the second half of the beat.
export const SYLS = ['du', 'de'];

// Until the recorder's marks for Unit 1 are on the site, the test build's familiar set.
let pool = ALL.map((p) => p.id);
let fam = new Set(['q-ee-q-q', 'ee-q-ee-q', 'ee-ee-ee-q', 'q-q-ee-q', 'ee-q-q-q', 'q-ee-ee-q', 'ee-ee-q-q', 'q-ee-q-ee']
  .map((b) => `rhythm/2-4/${b}`));

/* Kyle's kept patterns and familiar/unfamiliar marks from the recorder, when published. */
export async function loadMarks() {
  try {
    const r = await siteUnits();
    if (!r) return;
    const data = await r.json();
    const unit = (Array.isArray(data) ? data : data.units || []).find((u) => u.id === 'unit-1');
    if (!unit?.patterns?.length) return;
    const marked = unit.patterns.filter((p) => p.mark === 'familiar').map((p) => p.id);
    pool = unit.patterns.map((p) => p.id);
    if (marked.length) fam = new Set(marked);
  } catch { /* keep the defaults */ }
}

export const byId = (id) => patternById(id);
export function patternsFor(set) {
  if (set === 'fam') return pool.filter((id) => fam.has(id));
  if (set === 'unf') return pool.filter((id) => !fam.has(id));
  return pool.slice();
}

/* Note starts in beats from the pattern's downbeat, with their syllables. */
export function onsets(p) {
  const out = [];
  p.cells.forEach((c, i) => {
    out.push({ b: i, syl: 'du' });
    if (c === 'ee') out.push({ b: i + 0.5, syl: 'de' });
  });
  return out;
}

export const cellSyl = (c) => (c === 'ee' ? 'du-de' : 'du');
export const sylText = (p) => p.cells.map(cellSyl).join('  ');
export const bumText = (p) => p.cells.map((c) => (c === 'ee' ? 'bum-bum' : 'bum')).join('  ');
/* What a step can show of a pattern when it gives the answer: Rote has no syllables yet (on
   "bum"), the ear steps add the syllables, and reading adds the notes. */
export const shows = (n) => (n >= 6 ? 'notes' : n >= 2 ? 'syllables' : 'bum');
export const sayAs = (p, n) => (shows(n) === 'bum' ? bumText(p) : sylText(p));
export const fromCells = (cells) => patternById(`rhythm/2-4/${cells.join('-')}`);

/* Taps (in beats from the response's downbeat) read as a pattern, or null if they
   don't make one. */
export function readTaps(beats) {
  const slots = new Set();
  for (const b of beats) {
    const q = Math.round(b * 2) / 2;
    if (Math.abs(b - q) > 0.2 || q < 0 || q > 3.5) return null;
    slots.add(q);
  }
  const cells = [];
  for (let k = 0; k < 4; k++) {
    if (!slots.has(k)) return null;
    cells.push(slots.has(k + 0.5) ? 'ee' : 'q');
  }
  return fromCells(cells);
}
