/* Flash card decks. Kyle picks one in the studio; it travels with the lesson page.
   Notes:  { k: 'n', f: clef g/f/c/gf, r: ['C4', 'F#4'...], y: key (fifths), o, w, g }
   Tonal:  { k: 't', u: unit name, p: [pattern ids], y: tonic (sounding midi), o, w, g, q: tempo }
   Rhythm: { k: 'r', u: unit name, p: [pattern ids], o, w, g, q: tempo }
   o: which ways of answering the student may pick (bits, see MODES), w: say or sing it
   before playing it, g: how many cards make the goal (0: none).
   Tonal and rhythm cards are the patterns in /assets/patterns (the units Kyle records). */

import { patternById, toneMidi, toneLabel, METERS, TONALITIES, KEYS } from '/assets/patterns/patterns.js';
import { notation } from '/assets/patterns/notation.js';
import * as samples from '/assets/sounds/samples.js';
import { loadScript, letterName, solfege } from './score.js';
import { VEXFLOW_SRC } from './paths.js';
import * as snd from './sound.js';

/* Ways to answer, by deck kind: [bit, id, icon, label]. */
export const MODES = {
  n: [[1, 'letters', '🔤', 'Letters'], [2, 'keys', '🎹', 'Keyboard'], [4, 'solfa', '🎵', 'Solfège']],
  t: [[1, 'sing', '🎤', 'Sing'], [2, 'keys', '🎹', 'Keyboard'], [4, 'solfa', '🎵', 'Solfège']],
  r: [[1, 'say', '🗣', 'Say'], [2, 'tap', '👏', 'Tap']],
};
export const KINDS = { n: 'Notes', t: 'Tonal patterns', r: 'Rhythm patterns' };
export const modesOf = (deck) => MODES[deck.k].filter(([bit]) => deck.o & bit);
/* Modes played on an instrument, where "say it first" applies. */
export const PLAYED = new Set(['keys', 'tap']);

/* The cards in a deck: pitches for notes, pattern ids for the others. */
export const cardsOf = (deck) => (deck.k === 'n' ? deck.r : deck.p);

/* ---------- Notes ---------- */

export function parsePitch(p) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(p);
  if (!m) return null;
  const letter = 'CDEFGAB'.indexOf(m[1]);
  const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const octave = +m[3];
  return { letter, alter, octave, midi: 12 * (octave + 1) + [0, 2, 4, 5, 7, 9, 11][letter] + alter };
}

/* The alteration a key signature gives each letter. */
export function keyAlter(letter, fifths) {
  const sharps = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
  const flats = [6, 2, 5, 1, 4, 0, 3];  // B E A D G C F
  if (fifths > 0) return sharps.slice(0, fifths).includes(letter) ? 1 : 0;
  if (fifths < 0) return flats.slice(0, -fifths).includes(letter) ? -1 : 0;
  return 0;
}

/* With a key signature, a picked letter means the note the key gives it. */
export function inKey(pitch, fifths) {
  const p = parsePitch(pitch);
  const a = keyAlter(p.letter, fifths);
  return `${'CDEFGAB'[p.letter]}${a > 0 ? '#' : a < 0 ? 'b' : ''}${p.octave}`;
}

/* Every note a clef offers in the studio's note picker, low to high. */
export function clefRange(f) {
  const ranges = { g: ['G3', 'C6'], f: ['C2', 'E4'], c: ['B2', 'D5'], gf: ['C2', 'C6'] };
  const [lo, hi] = ranges[f].map(parsePitch);
  const out = [];
  for (let o = lo.octave; o <= hi.octave; o++) {
    for (let l = 0; l < 7; l++) {
      const midi = 12 * (o + 1) + [0, 2, 4, 5, 7, 9, 11][l];
      if (midi >= lo.midi && midi <= hi.midi) out.push(`${'CDEFGAB'[l]}${o}`);
    }
  }
  return out;
}

export const KEY_NAMES = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const keyName = (fifths) => KEY_NAMES[fifths + 7];
const pretty = (name) => name.replace('#', '♯').replace(/b$/, '♭');

/* The letter (with the key's sharp or flat) that names each of the seven letters. */
export const letterButtons = (fifths) => [0, 1, 2, 3, 4, 5, 6].map((l) => letterName(l, keyAlter(l, fifths)));
export const SOLFA = ['do', 're', 'mi', 'fa', 'so', 'la', 'ti'];
export const doName = (fifths) => pretty(keyName(fifths));

export function noteAnswer(deck, pitch, mode) {
  const p = parsePitch(pitch);
  return mode === 'solfa' ? solfege(p.letter, p.alter, deck.y) : letterName(p.letter, p.alter);
}

/* ---------- Drawing (VexFlow) ---------- */

const INK = '#2F4A3A';
let vex = null;
export const loadVex = () => (vex ||= loadScript(VEXFLOW_SRC).then(() => window.Vex));

function svgFor(width, height, draw) {
  const VF = window.Vex.Flow;
  const div = document.createElement('div');
  const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  ctx.setFillStyle(INK);
  ctx.setStrokeStyle(INK);
  draw(VF, ctx);
  const svg = div.querySelector('svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  return svg.outerHTML;
}

const CLEF = { g: 'treble', f: 'bass', c: 'alto' };

function noteSVG(deck, pitch) {
  const p = parsePitch(pitch);
  const key = keyName(deck.y);
  const vfKey = `${pitch[0].toLowerCase()}${pitch.slice(1, -1)}/${p.octave}`;
  const width = 170 + Math.abs(deck.y) * 10;
  const grand = deck.f === 'gf';
  return svgFor(width, grand ? 220 : 140, (VF, ctx) => {
    const staves = grand
      ? [new VF.Stave(14, 0, width - 16).addClef('treble'), new VF.Stave(14, 90, width - 16).addClef('bass')]
      : [new VF.Stave(2, 20, width - 4).addClef(CLEF[deck.f])];
    staves.forEach((s) => s.addKeySignature(key).setContext(ctx).draw());
    if (grand) {
      new VF.StaveConnector(staves[0], staves[1]).setType('brace').setContext(ctx).draw();
      new VF.StaveConnector(staves[0], staves[1]).setType('singleLeft').setContext(ctx).draw();
    }
    const on = grand && p.midi < 60 ? 1 : 0;
    const clef = grand ? (on ? 'bass' : 'treble') : CLEF[deck.f];
    const note = new VF.StaveNote({ keys: [vfKey], duration: 'w', clef });
    const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).addTickables([note]);
    VF.Accidental.applyAccidentals([voice], key);
    new VF.Formatter().joinVoices([voice]).format([voice], 40);
    // Centre the note in the space after the key signature.
    const stave = staves[on];
    const room = stave.getX() + stave.getWidth() - stave.getNoteStartX();
    note.setXShift(room / 2 - 30);
    voice.draw(ctx, stave);
  });
}

/* SVG markup for a card. Loads VexFlow first. */
export async function cardSVG(deck, card) {
  await loadVex();
  if (deck.k === 'n') return noteSVG(deck, card);
  return notation(patternById(card), deck.y);
}

/* What the card says, for summaries and answers: a note name, or the pattern's syllables. */
export function cardLabel(deck, card) {
  if (deck.k === 'n') { const p = parsePitch(card); return letterName(p.letter, p.alter) + p.octave; }
  return patternById(card)?.syllables || card;
}

/* ---------- Tonal patterns ---------- */

/* Written pitches (an octave above how the voice sounds), and syllables, of a tonal pattern. */
export function tonalNotes(deck, card) {
  const pat = patternById(card);
  return pat.tones.map((t) => ({ midi: toneMidi(pat.tonality, deck.y, t) + 12, syl: toneLabel(t), base: t.length === 3 ? t.slice(1) : t }));
}
export const tonalityOf = (deck) => (deck.p[0] || '').split('/')[1] || 'major';
/* Written midi of do (major) or la (minor). */
export const homeMidi = (deck) => deck.y + 12;
export function keyLabel(deck) {
  const t = tonalityOf(deck);
  const k = KEYS[t].find((x) => x.midi === deck.y) || KEYS[t][0];
  return { name: pretty(k.name) + (t === 'minor' ? 'm' : ''), do: pretty(k.do) };
}
/* Syllable buttons for a deck: every tone its patterns use, low to high. */
export function deckSyllables(deck) {
  const t = tonalityOf(deck);
  const used = new Set(deck.p.flatMap((id) => patternById(id).tones.map((x) => (x.length === 3 ? x.slice(1) : x))));
  return TONALITIES[t].tones.filter((x) => x.length === 2 && used.has(x));
}

/* ---------- Rhythm patterns ---------- */

const EIGHTHS = { q: 2, 8: 1, qd: 3 };
/* Onsets in beats, with syllables, and the pattern's length in beats. */
export function rhythmEvents(card) {
  const pat = patternById(card);
  const m = METERS[pat.meter];
  const beat = pat.meter === '6/8' ? 3 : 2;
  let at = 0;
  const events = [];
  for (const c of pat.cells) {
    m.cells[c].notes.forEach((n, i) => {
      events.push({ beat: at / beat, s: m.cells[c].syllables[i] });
      at += EIGHTHS[n];
    });
  }
  return { events, beats: at / beat, perBar: m.beatsPerBar };
}

/* ---------- Sounds ---------- */

let voice = null;
const kyle = () => (voice ||= samples.takes('kyle').catch(() => null));
let claves = null;
const clave = () => (claves ||= snd.instrument('claves'));
const piano = () => snd.instrument('piano', { lo: 36, hi: 96 });

/* Load what a deck will play, so the first card isn't late. */
export async function prepare(deck) {
  if (deck.k === 'r') await clave();
  else await piano();
  if (deck.k !== 'n') { const v = await kyle(); if (v) v.prepare(deck.p.filter(v.has)).catch(() => {}); }
}

export async function playNote(midi, t = snd.now() + 0.03, dur = 1) {
  const p = await piano();
  if (p) p.note(midi, t, dur, { vol: 0.3 }); else snd.note(midi, t, dur, { vol: 0.3 });
}

/* do-mi-so-mi-do (la-do-mi-do-la in minor), to hear the key before singing. */
export async function playTonic(deck) {
  const home = homeMidi(deck);
  const steps = tonalityOf(deck) === 'minor' ? [0, 3, 7, 3, 0] : [0, 4, 7, 4, 0];
  const t = snd.now() + 0.05;
  for (let i = 0; i < steps.length; i++) await playNote(home + steps[i], t + i * 0.32, i === steps.length - 1 ? 1 : 0.3);
  return (steps.length * 0.32 + 0.5) * 1000;
}

/* The model: Kyle's take when there is one, otherwise the piano or claves.
   Resolves with how long it lasts (ms). onEvent(i) fires as each note sounds. */
export async function playModel(deck, card, { onEvent } = {}) {
  const v = await kyle();
  const bpm = deck.q || 80;
  if (v?.has(card)) {
    await v.say(card, snd.now() + 0.05, { bpm, key: deck.k === 't' ? deck.y : null });
    return 1800;
  }
  const t0 = snd.now() + 0.08;
  const beat = 60 / bpm;
  const times = [];
  if (deck.k === 't') {
    const notes = tonalNotes(deck, card);
    for (let i = 0; i < notes.length; i++) { times.push(t0 + i * beat); await playNote(notes[i].midi, t0 + i * beat, beat * 0.95); }
  } else {
    const { events } = rhythmEvents(card);
    const c = await clave();
    for (const e of events) { const t = t0 + e.beat * beat; times.push(t); if (c) c.hit(t, { vol: 0.8 }); else snd.block(t); }
  }
  if (onEvent) times.forEach((t, i) => setTimeout(() => onEvent(i), (t - snd.now()) * 1000));
  return (times[times.length - 1] - snd.now() + beat) * 1000;
}

/* A count-in of one bar, then the beat under the student's taps. */
export function tapRun(deck, card) {
  const { events, beats, perBar } = rhythmEvents(card);
  const beat = 60 / (deck.q || 80);
  const start = snd.now() + 0.15 + perBar * beat;
  for (let k = -perBar; k < beats; k++) snd.click(start + k * beat, (k + perBar) % perBar === 0, k < 0 ? 0.35 : 0.18);
  return { start, beat, events, end: start + beats * beat };
}

/* Which notes a student's taps hit. Taps before the first note can't count against them. */
export function scoreTaps(run, taps) {
  const latency = (snd.ac().outputLatency || 0) + (snd.ac().baseLatency || 0);
  const tol = Math.min(0.16, run.beat * 0.3);
  const mine = taps.filter((t) => t >= run.start + latency - tol);
  const used = new Set();
  const hits = run.events.map((e) => {
    const want = run.start + e.beat * run.beat + latency;
    let best = -1;
    let gap = Infinity;
    mine.forEach((t, j) => { const d = Math.abs(t - want); if (!used.has(j) && d < gap) { gap = d; best = j; } });
    if (best >= 0 && gap <= tol) { used.add(best); return true; }
    return false;
  });
  return { hits, extra: mine.length - used.size };
}
