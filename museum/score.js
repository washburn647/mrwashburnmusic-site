/* A tiny way to write tunes down, for Listen and Try this (lessons.js).
   A tune is one or more voices, each a string of tokens with spaces between:
     C4  F#3  Bb2   a note (C4 is middle C)          r     a rest
     C4+E4+G4       notes played together             |     a bar line (ignored)
     k  s+h         drum parts (each instrument names its own: k kick, s snare, x a hit...)
     @C  @Am^       strum a chord (^ strums up)
   After the note, how long it lasts: nothing is one beat, / half a beat, // a quarter,
   each - one beat more (C4- is two beats), . one and a half times as long, * a triplet.
   Then ! for louder, ? for softer, ~ to glide (slur) into the next note.
   Notes are written pitches (what the instrument's music shows). */

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE = /^([A-G])(#|b)?(-?\d)$/;

/* MIDI number of a note name (C4 = 60), or null. */
export function midi(name) {
  const m = NOTE.exec(name);
  if (!m) return null;
  return (Number(m[3]) + 1) * 12 + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/* Note names to MIDI numbers: 'C4 E4 G4' -> [60, 64, 67]. */
export const pitches = (text) => text.trim().split(/\s+/).map(midi);

function token(tok) {
  const [, body, marks] = /^(.+?)([/\-.*~!?]*)$/.exec(tok);
  let beats = 1;
  for (const c of marks) {
    if (c === '/') beats /= 2;
    else if (c === '-') beats += 1;
    else if (c === '.') beats *= 1.5;
    else if (c === '*') beats *= 2 / 3;
  }
  const vel = marks.includes('!') ? 1 : marks.includes('?') ? 0.45 : 0.72;
  const slur = marks.includes('~');
  if (body === 'r') return { beats };
  if (body[0] === '@') {
    const up = body.endsWith('^');
    return { beats, hits: [{ chord: body.slice(1).replace(/\^$/, ''), up, vel }] };
  }
  const hits = body.split('+').map((b) => {
    const m = midi(b);
    return m == null ? { part: b, vel } : { midi: m, vel };
  });
  return { beats, hits, slur };
}

/* Every sound of a tune, in time order: { at, dur (seconds), midi | part | chord, vel, glide, slur }.
   shift moves every note (from written to sounding pitch, or to another key). */
export function events(voices, { bpm = 100, shift = 0 } = {}) {
  const beat = 60 / bpm;
  const out = [];
  for (const voice of [].concat(voices)) {
    let t = 0;
    let glide = false;
    for (const tok of voice.trim().split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const n = token(tok);
      for (const h of n.hits || []) {
        const e = { ...h, at: t * beat, dur: n.beats * beat, glide, slur: n.slur };
        if (e.midi != null) e.midi += shift;
        out.push(e);
      }
      glide = !!(n.hits && n.slur);
      t += n.beats;
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/* How long a tune lasts, in seconds. */
export const length = (evs) => evs.reduce((a, e) => Math.max(a, e.at + e.dur), 0);
