/* The 12 steps of Conversational Solfège as the stream uses them, and Unit 1's patterns.
   A step is where the learner is in the curriculum; what they do at a step is a task
   (tasks.js), and what they hear or see first depends on both. Games never know which step
   they are teaching. Patterns and their ids come from the site's catalogue, so recordings made
   at /studio/record/ fit here.
   set: which patterns the step uses (fam: familiar, unf: unfamiliar, any). */

import { DEFAULT_UNITS, unitPatterns, patternById, siteUnits, tonalPattern, toneLabel, TONALITIES, TONES } from '/assets/patterns/patterns.js';

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

/* Do re mi: Unit 4's tonal patterns (do re mi, three notes, one a beat), in major. They
   use steps 1 to 8 (there's no writing on the staff yet). MTONES: the unit's tones, low to
   high, which are the strings of the harp and the rungs the scenes draw notes on. */
export const MUNIT = DEFAULT_UNITS.find((u) => u.id === 'unit-4');
export const MALL = unitPatterns(MUNIT);
export const MAX_TONAL_STEP = 8;
export let MTONES = TONALITIES.major.tones.filter((t) => MUNIT.concepts.includes(t));
let mpool = MALL.map((p) => p.id);
let mfam = new Set(['do-re-mi', 'mi-re-do', 'do-mi-do', 'mi-do-mi', 're-mi-do', 'do-re-do'].map((b) => `tonal/major/${b}`));

/* Kyle's kept patterns and familiar/unfamiliar marks from the recorder, when published. */
export async function loadMarks() {
  try {
    const r = await siteUnits();
    if (!r) return;
    const data = await r.json();
    const units = Array.isArray(data) ? data : data.units || [];
    const unit = units.find((u) => u.id === 'unit-1');
    if (unit?.patterns?.length) {
      const marked = unit.patterns.filter((p) => p.mark === 'familiar').map((p) => p.id);
      pool = unit.patterns.map((p) => p.id);
      if (marked.length) fam = new Set(marked);
    }
    const mel = units.find((u) => u.id === MUNIT.id);
    const kept = (mel?.patterns || []).filter((p) => /^tonal\/major\//.test(p.id) && byId(p.id)?.tones.every((t) => t in TONES));
    if (kept.length) {
      mpool = kept.map((p) => p.id);
      const marked = kept.filter((p) => p.mark === 'familiar').map((p) => p.id);
      if (marked.length) mfam = new Set(marked);
      else mfam = new Set(mpool.filter((id) => mfam.has(id)));
      const used = new Set(mpool.flatMap((id) => byId(id).tones));
      MTONES = TONALITIES.major.tones.filter((t) => used.has(t));
    }
  } catch { /* keep the defaults */ }
}

export const byId = (id) => patternById(id);
/* A step's pattern ids: rhythm (Unit 1) or tonal (Unit 4, kind 'tonal'). */
export function patternsFor(set, kind = 'rhythm') {
  const [all, known] = kind === 'tonal' ? [mpool, mfam] : [pool, fam];
  if (set === 'fam') return all.filter((id) => known.has(id));
  if (set === 'unf') {
    const un = all.filter((id) => !known.has(id));
    return un.length ? un : all.slice();
  }
  return all.slice();
}

/* Note starts in beats from the pattern's downbeat, with their syllables. A tonal pattern's
   notes are a beat each, and carry their tone. */
export function onsets(p) {
  if (p.kind === 'tonal') return p.tones.map((tone, i) => ({ b: i, syl: toneLabel(tone), tone }));
  const out = [];
  p.cells.forEach((c, i) => {
    out.push({ b: i, syl: 'du' });
    if (c === 'ee') out.push({ b: i + 0.5, syl: 'de' });
  });
  return out;
}

export const cellSyl = (c) => (c === 'ee' ? 'du-de' : 'du');
export const sylText = (p) => (p.kind === 'tonal' ? p.tones.map(toneLabel).join('  ') : p.cells.map(cellSyl).join('  '));
export const bumText = (p) => (p.kind === 'tonal' ? p.tones.map(() => 'bum').join('  ') : p.cells.map((c) => (c === 'ee' ? 'bum-bum' : 'bum')).join('  '));
export const fromTones = (tones) => tonalPattern('major', tones);
/* Where a tone sits among the unit's tones, 0 (lowest) to 1 (highest), for drawing. */
export const toneHeight = (tone) => {
  const lo = TONES[MTONES[0]];
  const hi = TONES[MTONES[MTONES.length - 1]];
  return hi > lo ? (TONES[tone] - lo) / (hi - lo) : 0.5;
};
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
