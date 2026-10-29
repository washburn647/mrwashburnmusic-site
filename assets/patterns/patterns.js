/* The pattern catalogue: every rhythm and tonal pattern, by category, for the voice
   recorder, lesson pages and Musician Maker. Pattern ids never change once recorded:
     rhythm/2-4/q-ee        2/4, one bar: du | du de
     rhythm/6-8/dq-eee-qe-dq 6/8, two bars: du du da di | du di du
     tonal/major/so-mi-do   tonal patterns name their notes; lso is low so, hdo high do
   Rhythm syllables are Feierabend's; tonal patterns are movable do, minor la-based. */

export const METERS = {
  '2/4': {
    label: '2/4',
    beatsPerBar: 2,
    time: { num: 2, value: 4 },
    beam: [2, 8],
    cells: {
      q: { syllables: ['du'], notes: ['q'], glyph: '♩' },
      ee: { syllables: ['du', 'de'], notes: ['8', '8'], glyph: '♫' },
    },
  },
  '6/8': {
    label: '6/8',
    beatsPerBar: 2,
    time: { num: 6, value: 8 },
    beam: [3, 8],
    cells: {
      dq: { syllables: ['du'], notes: ['qd'], glyph: '♩.' },
      eee: { syllables: ['du', 'da', 'di'], notes: ['8', '8', '8'], glyph: '♪♪♪' },
      qe: { syllables: ['du', 'di'], notes: ['q', '8'], glyph: '♩♪' },
    },
  },
};

// Semitones from do. Low notes start with l, high ones with h.
export const TONES = {
  lmi: -8, lso: -5, lsi: -4, lla: -3, lti: -1,
  do: 0, re: 2, mi: 4, fa: 5, so: 7, si: 8, la: 9, ti: 11, hdo: 12,
};
// Scale degree above do (for spelling): si is a raised so.
const DEGREE = { do: 0, re: 1, mi: 2, fa: 3, so: 4, si: 4, la: 5, ti: 6 };

export const TONALITIES = {
  major: {
    label: 'Major',
    tones: ['lso', 'lla', 'lti', 'do', 're', 'mi', 'fa', 'so', 'la', 'ti', 'hdo'],
    tonic: ['do', 'mi', 'so'],
    presets: {
      'so mi': ['mi', 'so'],
      'so mi la': ['mi', 'so', 'la'],
      'mi re do': ['do', 're', 'mi'],
      'do mi so': ['do', 'mi', 'so'],
      'Dominant': ['lso', 'lti', 're', 'fa'],
      'Pentatonic': ['do', 're', 'mi', 'so', 'la'],
    },
    defaults: ['do', 'mi', 'so'],
  },
  minor: {
    label: 'Minor',
    tones: ['lmi', 'lsi', 'lla', 'lti', 'do', 're', 'mi', 'fa', 'so', 'si', 'la'],
    tonic: ['lla', 'do', 'mi'],
    presets: {
      'la do mi': ['lla', 'do', 'mi'],
      'Dominant': ['lmi', 'lsi', 'lti', 're'],
      'Pentatonic': ['lla', 'do', 're', 'mi', 'so'],
    },
    defaults: ['lla', 'do', 'mi'],
  },
};

// Keys by the tonic's letter. do is the relative major's do, for spelling.
export const KEYS = {
  major: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
    .map((name, i) => ({ name, do: name, midi: 48 + i })),
  minor: [['A', 'C'], ['Bb', 'Db'], ['B', 'D'], ['C', 'Eb'], ['C#', 'E'], ['D', 'F'],
    ['Eb', 'Gb'], ['E', 'G'], ['F', 'Ab'], ['F#', 'A'], ['G', 'Bb'], ['G#', 'B']]
    .map(([name, d], i) => ({ name, do: d, midi: 45 + i })),
};

/* Display form of a tone: low so is "so,", high do is "do'". */
export function toneLabel(tone) {
  if (tone.startsWith('l') && tone.length === 3) return `${tone.slice(1)},`;
  if (tone.startsWith('h')) return `${tone.slice(1)}'`;
  return tone;
}
const base = (tone) => (tone.length === 3 ? tone.slice(1) : tone);

function product(options, n) {
  let out = [[]];
  for (let i = 0; i < n; i++) out = out.flatMap((p) => options.map((o) => [...p, o]));
  return out;
}

export function rhythmPattern(meter, cells) {
  const m = METERS[meter];
  const bars = [];
  for (let i = 0; i < cells.length; i += m.beatsPerBar) bars.push(cells.slice(i, i + m.beatsPerBar));
  return {
    id: `rhythm/${meter.replace('/', '-')}/${cells.join('-')}`,
    kind: 'rhythm',
    meter,
    cells,
    bars: bars.length,
    syllables: bars.map((bar) => bar.map((c) => m.cells[c].syllables.join(' ')).join(' · ')).join(' | '),
  };
}

/* Every pattern in a meter, `bars` long, from the given cells (all by default). */
export function rhythmPatterns(meter, bars, cells = Object.keys(METERS[meter].cells)) {
  const m = METERS[meter];
  const order = Object.keys(m.cells).filter((c) => cells.includes(c));
  return product(order, bars * m.beatsPerBar).map((p) => rhythmPattern(meter, p));
}

export function tonalPattern(tonality, tones) {
  return {
    id: `tonal/${tonality}/${tones.join('-')}`,
    kind: 'tonal',
    tonality,
    tones,
    syllables: tones.map(toneLabel).join(' '),
  };
}

/* Every pattern of `length` notes drawn from `tones`, no note twice in a row. */
export function tonalPatterns(tonality, tones, length) {
  const order = TONALITIES[tonality].tones.filter((t) => tones.includes(t));
  return product(order, length)
    .filter((p) => p.every((t, i) => !i || t !== p[i - 1]))
    .map((p) => tonalPattern(tonality, p));
}

/* Units follow Conversational Solfege: each one brings in a concept (rhythm cells in a
   meter, or tonal syllables), and its patterns are drawn from what it allows. Kyle trims the
   generated list and marks each pattern familiar or unfamiliar; the recorder keeps units
   on the device and sends them to the site with the takes (assets/patterns/units.json).
   unit: { id, name, kind: 'rhythm' | 'tonal', meter | tonality, concepts, require, bars | length,
           removed: [pattern ids], marks: { [pattern id]: 'familiar' | 'unfamiliar' } } */
export const DEFAULT_UNITS = [
  { id: 'unit-1', name: 'Unit 1', kind: 'rhythm', meter: '2/4', concepts: ['q', 'ee'], require: [], bars: 2 },
  { id: 'unit-2', name: 'Unit 2', kind: 'rhythm', meter: '6/8', concepts: ['dq', 'eee'], require: [], bars: 2 },
  { id: 'unit-3', name: 'Unit 3', kind: 'rhythm', meter: '6/8', concepts: ['dq', 'eee', 'qe'], require: ['qe'], bars: 2 },
  { id: 'unit-4', name: 'Unit 4', kind: 'tonal', tonality: 'major', concepts: ['do', 're', 'mi'], require: [], length: 3 },
].map((u) => ({ removed: [], marks: {}, ...u }));

/* Display name of a concept: a rhythm cell's syllables, or a tonal syllable. */
export function conceptLabel(unit, concept) {
  return unit.kind === 'rhythm' ? METERS[unit.meter].cells[concept].syllables.join(' ') : toneLabel(concept);
}

/* Every pattern the unit's concepts make (removed ones included), each using a required
   concept when the unit names any. */
export function unitPatterns(unit) {
  const all = unit.kind === 'rhythm'
    ? rhythmPatterns(unit.meter, unit.bars, unit.concepts)
    : tonalPatterns(unit.tonality, unit.concepts, unit.length);
  if (!unit.require?.length) return all;
  return all.filter((p) => (p.cells || p.tones).some((c) => unit.require.includes(c)));
}

export function patternById(id) {
  const [kind, group, body] = id.split('/');
  if (kind === 'rhythm') return rhythmPattern(group.replace('-', '/'), body.split('-'));
  if (kind === 'tonal') return tonalPattern(group, body.split('-'));
  return null;
}

/* Sounding pitch of a tone, given the key's tonic (do for major, la for minor). */
export function toneMidi(tonality, tonic, tone) {
  const doMidi = tonality === 'minor' ? tonic + 3 : tonic;
  return doMidi + TONES[tone];
}

const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const NATURAL = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/* VexFlow key ("f#/4") for a tone, spelled in the key, at a written midi pitch. */
export function spell(doName, tone, midi) {
  const letter = LETTERS[(LETTERS.indexOf(doName[0].toLowerCase()) + DEGREE[base(tone)]) % 7];
  let octave = Math.floor(midi / 12) - 1;
  // The letter's natural pitch nearest the note decides the octave.
  let natural = 12 * (octave + 1) + NATURAL[letter];
  if (natural - midi > 6) { octave--; natural -= 12; }
  if (midi - natural > 6) { octave++; natural += 12; }
  const shift = midi - natural;
  const acc = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' }[shift];
  return `${letter}${acc}/${octave}`;
}
