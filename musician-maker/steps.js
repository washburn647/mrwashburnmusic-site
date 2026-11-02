/* The 12 Conversational Solfège steps as the stream uses them, and Unit 1's patterns.
   A step decides what the call is (call) and which answer modes can test it (modes);
   games never know which step they are teaching. Patterns and their ids come from the
   site's catalogue, so recordings made at /studio/record/ fit here. */

import { DEFAULT_UNITS, unitPatterns, patternById } from '/assets/patterns/patterns.js';

// call: neutral = heard on "bum", syllables = heard in syllables, notation = seen as notes,
//       text = seen as syllables, none = nothing (compose)
// show: what Pick options look like
export const STEPS = [
  null,
  { n: 1, band: 'ear', name: 'Echo', cue: 'ECHO!', call: 'neutral', modes: ['perform'], set: 'fam', say: 'Listen, then tap it back!' },
  { n: 2, band: 'ear', name: 'Say it back', cue: 'SAY IT!', call: 'syllables', modes: ['perform'], set: 'fam', say: 'Say it back in syllables!' },
  { n: 3, band: 'ear', name: 'Name it', cue: 'NAME IT!', call: 'neutral', modes: ['perform', 'pick'], show: 'syllables', set: 'fam', say: 'What did you hear?' },
  { n: 4, band: 'ear', name: 'Name it: new', cue: 'NAME IT!', call: 'neutral', modes: ['perform', 'pick'], show: 'syllables', set: 'unf', say: 'A new one! What did you hear?' },
  { n: 5, band: 'ear', name: 'Answer back', cue: 'ANSWER!', call: 'syllables', modes: ['create'], set: 'any', say: 'Answer me with a different one!' },
  { n: 6, band: 'read', name: 'Match', cue: 'MATCH!', call: 'syllables', modes: ['pick'], show: 'notation', set: 'fam', say: 'Which notes did you hear?' },
  { n: 7, band: 'read', name: 'Read it', cue: 'READ!', call: 'notation', modes: ['perform', 'pick'], show: 'syllables', set: 'fam', say: 'Read it!' },
  { n: 8, band: 'read', name: 'Read it: new', cue: 'READ!', call: 'notation', modes: ['perform', 'pick'], show: 'syllables', set: 'unf', say: 'A new one. Read it!' },
  { n: 9, band: 'write', name: 'Build it', cue: 'BUILD!', call: 'text', modes: ['build', 'pick'], show: 'notation', set: 'fam', say: 'Build the notes!' },
  { n: 10, band: 'write', name: 'Dictation', cue: 'WRITE!', call: 'neutral', modes: ['build', 'pick'], show: 'notation', set: 'fam', say: 'Write what you hear!' },
  { n: 11, band: 'write', name: 'Dictation: new', cue: 'WRITE!', call: 'neutral', modes: ['build', 'pick'], show: 'notation', set: 'unf', say: 'A new one. Write what you hear!' },
  { n: 12, band: 'write', name: 'Compose', cue: 'COMPOSE!', call: 'none', modes: ['compose'], set: 'any', say: 'Make your own!' },
];

export const BANDS = { ear: 'Ear', read: 'Read', write: 'Write' };

export const UNIT = DEFAULT_UNITS.find((u) => u.id === 'unit-1');
export const ALL = unitPatterns(UNIT); // every 2-bar pattern of ♩ and ♫ in 2/4

// Until the recorder's marks for Unit 1 are on the site, the test build's familiar set.
let pool = ALL.map((p) => p.id);
let fam = new Set(['q-ee-q-q', 'ee-q-ee-q', 'ee-ee-ee-q', 'q-q-ee-q', 'ee-q-q-q', 'q-ee-ee-q', 'ee-ee-q-q', 'q-ee-q-ee']
  .map((b) => `rhythm/2-4/${b}`));

/* Kyle's kept patterns and familiar/unfamiliar marks from the recorder, when published. */
export async function loadMarks() {
  try {
    const r = await fetch('/assets/patterns/units.json');
    if (!r.ok) return;
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
export const fromCells = (cells) => patternById(`rhythm/2-4/${cells.join('-')}`);

/* Pick options: the answer plus n-1 others, 1 cell away when close, else 2. */
export function options(p, n, close) {
  const diff = (a) => a.cells.reduce((d, c, i) => d + (c !== p.cells[i]), 0);
  const want = close ? 1 : 2;
  const others = ALL.filter((q) => q.id !== p.id)
    .map((q) => ({ q, score: Math.abs(diff(q) - want) + Math.random() * 0.9 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n - 1)
    .map((o) => o.q);
  const list = [...others];
  const at = Math.floor(Math.random() * n);
  list.splice(at, 0, p);
  return { list, correct: at };
}

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

/* What to do, in a few words a young reader can take in at a glance. Shown for the whole
   game: `how` is the full line, `go` the shout when it's the learner's turn, `look` what
   the call asks of them (listen or read). */
export function howTo(stepN, mode) {
  const s = STEPS[stepN];
  const look = s.call === 'neutral' || s.call === 'syllables' ? 'listen' : s.call === 'none' ? '' : 'read';
  const first = look === 'listen' ? 'Listen. Then ' : look === 'read' ? 'Read it. Then ' : '';
  const say = { 1: 'tap it back', 2: 'say it back and tap', 3: 'say it in du and de', 4: 'say it in du and de', 7: 'say it and tap', 8: 'say it and tap' };
  const lines = {
    perform: [`${first}${say[stepN] || 'tap it back'}.`, stepN === 1 ? 'TAP IT!' : 'SAY IT!'],
    create: ['Listen. Then answer with a different one.', 'YOUR TURN!'],
    pick: [look === 'read' ? `${first}tap the one that matches.` : 'Listen. Then tap the one you heard.', 'PICK ONE!'],
    build: [look === 'read' ? `${first}tap the boxes to make these notes.` : 'Listen. Then tap the boxes to write it.', 'BUILD IT!'],
    compose: ['Tap the boxes to make your own.', 'GO!'],
  };
  const [how, go] = lines[mode];
  return { how, go, look };
}
