/* Flash card decks: notes on the staff, and rhythm patterns.
   A deck is a small recipe Kyle picks in the studio (which notes, which
   rhythm cells) that travels in the lesson link; cards are drawn with
   OpenSheetMusicDisplay from MusicXML made here.
   Notes: { k: 'n', f: clef g/f/c/gf, r: ['C4', 'F#4'...], y: key (fifths), a: 0 letters / 1 solfege }
   Rhythm: { k: 'r', m: '4/4', l: [cell ids], n: bars, q: tempo } */

import { loadOSMD, parseXML, letterName, solfege } from './score.js';
import * as snd from './sound.js';

/* ---------- Rhythm cells (Feierabend syllables) ---------- */
// d: length in whole notes, r: rest. 'duple' cells fill quarter-note beats, 'triple' dotted-quarter beats.
export const CELLS = {
  q: { kind: 'duple', beats: 1, ev: [{ d: 1 / 4, s: 'du' }] },
  ee: { kind: 'duple', beats: 1, ev: [{ d: 1 / 8, s: 'du' }, { d: 1 / 8, s: 'de' }] },
  qr: { kind: 'duple', beats: 1, ev: [{ d: 1 / 4, r: 1 }] },
  h: { kind: 'duple', beats: 2, ev: [{ d: 1 / 2, s: 'du-u' }] },
  dqe: { kind: 'duple', beats: 2, ev: [{ d: 3 / 8, s: 'du-u' }, { d: 1 / 8, s: 'de' }] },
  w: { kind: 'duple', beats: 4, ev: [{ d: 1, s: 'du-u-u-u' }] },
  ssss: { kind: 'duple', beats: 1, ev: [{ d: 1 / 16, s: 'du' }, { d: 1 / 16, s: 'ta' }, { d: 1 / 16, s: 'de' }, { d: 1 / 16, s: 'ta' }] },
  ess: { kind: 'duple', beats: 1, ev: [{ d: 1 / 8, s: 'du' }, { d: 1 / 16, s: 'de' }, { d: 1 / 16, s: 'ta' }] },
  sse: { kind: 'duple', beats: 1, ev: [{ d: 1 / 16, s: 'du' }, { d: 1 / 16, s: 'ta' }, { d: 1 / 8, s: 'de' }] },
  dq: { kind: 'triple', beats: 1, ev: [{ d: 3 / 8, s: 'du' }] },
  eee: { kind: 'triple', beats: 1, ev: [{ d: 1 / 8, s: 'du' }, { d: 1 / 8, s: 'da' }, { d: 1 / 8, s: 'di' }] },
  qe: { kind: 'triple', beats: 1, ev: [{ d: 1 / 4, s: 'du' }, { d: 1 / 8, s: 'di' }] },
  dqr: { kind: 'triple', beats: 1, ev: [{ d: 3 / 8, r: 1 }] },
  dh: { kind: 'triple', beats: 2, ev: [{ d: 3 / 4, s: 'du-u' }] },
};
export const DUPLE = ['q', 'ee', 'qr', 'h', 'dqe', 'w', 'ssss', 'ess', 'sse'];
export const TRIPLE = ['dq', 'eee', 'qe', 'dqr', 'dh'];

const meterOf = (m) => {
  const [num, den] = m.split('/').map(Number);
  return den === 8 ? { num, den, beats: num / 3, kind: 'triple' } : { num, den, beats: num, kind: 'duple' };
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];
export function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

const isRest = (c) => CELLS[c].ev.every((e) => e.r);

/* One random pattern: a list of bars, each a list of cell ids. */
export function rhythmPattern(deck) {
  const me = meterOf(deck.m);
  const cells = deck.l.filter((c) => CELLS[c] && CELLS[c].kind === me.kind);
  if (!cells.length) return [];
  for (let tries = 0; tries < 30; tries++) {
    const bars = [];
    for (let b = 0; b < deck.n; b++) {
      const bar = [];
      let at = 0;
      while (at < me.beats) {
        // Longer cells start on a strong beat and stay inside the bar.
        const prev = bar[bar.length - 1];
        const fit = cells.filter((c) => CELLS[c].beats <= me.beats - at && (CELLS[c].beats === 1 || at % CELLS[c].beats === 0)
          && !(isRest(c) && prev && isRest(prev)));
        // Rests come up half as often as sounds.
        const pool = fit.flatMap((c) => (isRest(c) ? [c] : [c, c]));
        const c = pool.length ? pick(pool) : null;
        if (!c) break;
        bar.push(c);
        at += CELLS[c].beats;
      }
      if (at !== me.beats) { bars.length = 0; break; }
      bars.push(bar);
    }
    if (bars.length && bars.flat().some((c) => !isRest(c))) return bars;
  }
  return [];
}

/* Onsets (in beats) and syllables of a pattern. */
export function rhythmEvents(deck, bars) {
  const me = meterOf(deck.m);
  const beatLen = me.kind === 'triple' ? 3 / 8 : 1 / 4;
  const out = [];
  let t = 0;
  for (const bar of bars) {
    for (const c of bar) {
      for (const e of CELLS[c].ev) {
        if (!e.r) out.push({ beat: t / beatLen, s: e.s });
        t += e.d;
      }
    }
  }
  return { events: out, beats: t / beatLen, beatLen };
}

/* ---------- MusicXML for one card ---------- */

const DIV = 48;
const TYPES = [[1, 'whole', 0], [3 / 4, 'half', 1], [1 / 2, 'half', 0], [3 / 8, 'quarter', 1], [1 / 4, 'quarter', 0], [1 / 8, 'eighth', 0], [1 / 16, '16th', 0]];
const typeOf = (d) => TYPES.find(([len]) => Math.abs(len - d) < 1e-9) || TYPES[4];

function beamsFor(evs) {
  // Beam a cell's eighths and sixteenths together (16ths get a second beam).
  const flags = evs.map((e) => (e.r ? 0 : e.d <= 1 / 16 + 1e-9 ? 2 : e.d <= 1 / 8 + 1e-9 ? 1 : 0));
  const out = evs.map(() => []);
  const run = (lvl) => {
    let i = 0;
    while (i < flags.length) {
      if (flags[i] < lvl) { i++; continue; }
      let j = i;
      while (j + 1 < flags.length && flags[j + 1] >= lvl) j++;
      if (j > i) for (let k = i; k <= j; k++) out[k].push(`<beam number="${lvl}">${k === i ? 'begin' : k === j ? 'end' : 'continue'}</beam>`);
      else if (lvl === 2 && flags[i] === 2) out[i].push(`<beam number="2">${i > 0 && flags[i - 1] >= 1 ? 'backward hook' : 'forward hook'}</beam>`);
      i = j + 1;
    }
  };
  if (flags.filter((f) => f >= 1).length > 1) { run(1); run(2); }
  return out;
}

export function rhythmXML(deck, bars) {
  const me = meterOf(deck.m);
  const measures = bars.map((bar, bi) => {
    const notes = bar.map((c) => {
      const evs = CELLS[c].ev;
      const beams = beamsFor(evs);
      return evs.map((e, i) => {
        const [, type, dot] = typeOf(e.d);
        const body = e.r ? '<rest/>' : '<unpitched><display-step>B</display-step><display-octave>4</display-octave></unpitched>';
        return `<note>${body}<duration>${Math.round(e.d * 4 * DIV)}</duration><type>${type}</type>${dot ? '<dot/>' : ''}${e.r ? '' : '<stem>up</stem>'}${beams[i].join('')}</note>`;
      }).join('');
    }).join('');
    const attrs = bi === 0 ? `<attributes><divisions>${DIV}</divisions><key><fifths>0</fifths></key><time><beats>${me.num}</beats><beat-type>${me.den}</beat-type></time><staff-details><staff-lines>1</staff-lines></staff-details><clef><sign>percussion</sign></clef></attributes>` : '';
    return `<measure number="${bi + 1}">${attrs}${notes}</measure>`;
  }).join('');
  return wrap(measures);
}

const wrap = (measures) => `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name print-object="no"></part-name></score-part></part-list><part id="P1">${measures}</part></score-partwise>`;

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

const CLEFS = { g: ['G', 2], f: ['F', 4], c: ['C', 3] };

export function noteXML(deck, pitch) {
  const p = parsePitch(pitch);
  const grand = deck.f === 'gf';
  const staff = grand ? (p.midi >= 60 ? 1 : 2) : 1;
  const clefs = grand ? '<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>' : `<clef><sign>${CLEFS[deck.f][0]}</sign><line>${CLEFS[deck.f][1]}</line></clef>`;
  const note = `<note><pitch><step>${'CDEFGAB'[p.letter]}</step>${p.alter ? `<alter>${p.alter}</alter>` : ''}<octave>${p.octave}</octave></pitch><duration>${4 * DIV}</duration><type>whole</type>${grand ? `<staff>${staff}</staff>` : ''}</note>`;
  const other = grand ? `<backup><duration>${4 * DIV}</duration></backup><note print-object="no"><rest measure="yes"/><duration>${4 * DIV}</duration><staff>${3 - staff}</staff></note>` : '';
  return wrap(`<measure number="1"><attributes><divisions>${DIV}</divisions><key><fifths>${deck.y}</fifths></key><time print-object="no"><beats>4</beats><beat-type>4</beat-type></time>${clefs}</attributes>${note}${other}</measure>`);
}

export function noteAnswer(deck, pitch) {
  const p = parsePitch(pitch);
  return deck.a === 1 ? solfege(p.letter, p.alter, deck.y) : letterName(p.letter, p.alter);
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

/* With a key signature, a picked letter means the note the key gives it. */
export function inKey(pitch, fifths) {
  const p = parsePitch(pitch);
  const a = keyAlter(p.letter, fifths);
  return `${'CDEFGAB'[p.letter]}${a > 0 ? '#' : a < 0 ? 'b' : ''}${p.octave}`;
}

/* ---------- Drawing ---------- */

export async function cardDrawer(container) {
  const O = await loadOSMD();
  const osmd = new O.OpenSheetMusicDisplay(container, {
    autoResize: false, backend: 'svg', drawTitle: false, drawSubtitle: false, drawComposer: false, drawLyricist: false,
    drawCredits: false, drawPartNames: false, drawMeasureNumbers: false, autoBeam: false, disableCursor: true,
    drawingParameters: 'compacttight', pageBackgroundColor: '#FFFFFF',
  });
  return async (xml, zoom = 1.6) => {
    await osmd.load(parseXML(xml));
    osmd.zoom = zoom;
    osmd.render();
    // Crop to the music so the card is centred.
    const svg = container.querySelector('svg');
    const bb = svg?.getBBox();
    if (bb && bb.width) {
      const pad = 12;
      svg.setAttribute('viewBox', `${bb.x - pad} ${bb.y - pad} ${bb.width + 2 * pad} ${bb.height + 2 * pad}`);
      svg.setAttribute('width', bb.width + 2 * pad);
      svg.setAttribute('height', bb.height + 2 * pad);
    }
  };
}

/* ---------- Sounds ---------- */

export function playRhythm(deck, bars, { tempo = deck.q, countIn = false, sound = true, beat = false, onSyllable } = {}) {
  const { events, beats, beatLen } = rhythmEvents(deck, bars);
  const me = meterOf(deck.m);
  const beatSec = 60 / tempo;
  let t0 = snd.now() + 0.1;
  if (countIn) {
    for (let k = 0; k < me.beats; k++) snd.click(t0 + k * beatSec, k === 0);
    t0 += me.beats * beatSec;
  }
  if (beat) for (let k = 0; k < beats; k++) snd.click(t0 + k * beatSec, k % me.beats === 0, 0.2);
  const timers = events.map((e, i) => {
    if (sound) snd.block(t0 + e.beat * beatSec);
    return onSyllable ? setTimeout(() => onSyllable(i), (t0 + e.beat * beatSec - snd.now()) * 1000) : 0;
  });
  return { start: t0, beatSec, events, beatLen, end: t0 + beats * beatSec, cancel: () => timers.forEach(clearTimeout) };
}

export const playNote = (pitch) => {
  const p = parsePitch(pitch);
  if (p) snd.note(p.midi, snd.now() + 0.02, 1.2, { vol: 0.3 });
};
