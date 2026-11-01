/* Sound: the site's sampled instruments, the backing groove that grows with the combo,
   pattern calls, and game sound effects. Anything that fails to load falls back to a
   synthesized tone, so the stream always plays. */

import * as samples from '/assets/sounds/samples.js';
import { onsets } from './steps.js';

let ctx = null;
let master = null;
let grooveBus = null;
const inst = {};
let kyle = null; // recorded voice, once Kyle's takes are on the site

const HITS = ['claves', 'log-drum-low', 'log-drum-high', 'bass-drum', 'snare', 'shaker', 'tambourine',
  'cymbal', 'triangle', 'cowbell', 'agogo', 'guiro', 'bongo-high', 'bongo-low'];
const PITCHED = { bass: [36, 52], horn: [60, 74], marimba: [60, 88], trombone: [40, 55] };

export function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    grooveBus = ctx.createGain();
    grooveBus.connect(master);
    samples.setup(ctx, master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/* Output delay: what the learner hears lags the audio clock by this much. */
export const latency = () => (ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0);

let loading = null;
export function load() {
  loading ||= Promise.allSettled([
    ...HITS.map(async (n) => { inst[n] = await samples.instrument(n); }),
    ...Object.entries(PITCHED).map(async ([n, [lo, hi]]) => { inst[n] = await samples.instrument(n, { lo, hi }); }),
    (async () => { kyle = await samples.takes('kyle'); })(),
  ]);
  return loading;
}

/* ---------- basic voices ---------- */

function synth(t, freq, dur, vol, dest, type = 'triangle', slide = 0) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(dest || master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const FALLBACK = {
  claves: [2500, 0.05], 'log-drum-low': [160, 0.2], 'log-drum-high': [320, 0.15], 'bass-drum': [70, 0.25],
  snare: [220, 0.12], shaker: [6000, 0.03], tambourine: [5000, 0.06], cymbal: [7000, 0.4], triangle: [3000, 0.4],
  cowbell: [800, 0.15], agogo: [900, 0.15], guiro: [1200, 0.1], 'bongo-high': [400, 0.1], 'bongo-low': [250, 0.12],
};

export function hit(name, t, vol = 0.8, dest = master) {
  if (!ctx) return;
  t = Math.max(t, ctx.currentTime);
  if (inst[name]?.hit) inst[name].hit(t, { vol, dest });
  else {
    const [f, d] = FALLBACK[name] || [600, 0.1];
    synth(t, f, d, vol * 0.4, dest, f > 2000 ? 'square' : 'triangle', 0.7);
  }
}

export function note(name, midi, t, dur, vol = 0.25, dest = master) {
  if (!ctx) return;
  t = Math.max(t, ctx.currentTime);
  if (inst[name]?.note) inst[name].note(midi, t, dur, { vol, dest });
  else synth(t, 440 * 2 ** ((midi - 69) / 12), Math.max(dur, 0.1), vol * 0.5, dest);
}

/* ---------- the call: a pattern on "bum" or in syllables ---------- */

export function call(p, kind, t, spb) {
  if (kind === 'syllables' && kyle?.has(p.id)) {
    kyle.say(p.id, t, { bpm: 60 / spb });
    return;
  }
  // Stand-ins until the takes exist: a low thump for "bum", a bright one for syllables.
  for (const o of onsets(p)) {
    if (kind === 'neutral') hit('log-drum-low', t + o.b * spb, 1);
    else hit('log-drum-high', t + o.b * spb, 0.9);
  }
}

/* A learner's own pattern played back (compose). */
export function playBack(p, t, spb) {
  for (const o of onsets(p)) note('marimba', o.syl === 'du' ? 72 : 76, t + o.b * spb, spb * 0.45, 0.35);
}

/* ---------- effects ---------- */

export const fx = {
  cue(t) { [67, 72, 79].forEach((m, i) => note('marimba', m, t + i * 0.06, 0.15, 0.3)); },
  win(t) { [72, 76, 79, 84].forEach((m, i) => note('marimba', m, t + i * 0.07, 0.25, 0.35)); },
  fail(t) {
    note('trombone', 50, t, 0.3, 0.35);
    note('trombone', 47, t + 0.32, 0.6, 0.35);
  },
  scratch(t) {
    t = Math.max(t, ctx.currentTime);
    const len = 0.35;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const x = buf.getChannelData(0);
    for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / x.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(3000, t);
    bp.frequency.exponentialRampToValueAtTime(300, t + len);
    const g = ctx.createGain();
    g.gain.value = 0.7;
    src.connect(bp).connect(g).connect(master);
    src.start(t);
  },
  tier(t) { hit('cymbal', t, 0.5); },
  boss(t) { [45, 44, 43].forEach((m, i) => note('trombone', m, t + i * 0.25, 0.25, 0.4)); },
};

/* ---------- the groove ---------- */

// Combo tiers: each adds a layer. 0 pulse, 1 bass, 2 drums, 3 horns, 4 full band.
const ROOTS = [41, 46, 48, 41]; // F Bb C F, one per bar of 2/4
const CHORD = { 41: [65, 69, 72], 46: [65, 70, 74], 48: [64, 67, 72] };

export function groove(i, t, spb, { tier, mode, duck }) {
  if (mode === 'off') return;
  const bar = Math.floor(i / 2);
  const onOne = i % 2 === 0;
  const root = ROOTS[bar % 4];
  const g = grooveBus;
  // While the mic listens, only the claves keep the beat: the mic hears everything else.
  if (duck === 'mic') { hit('claves', t, onOne ? 0.3 : 0.2, g); return; }
  const level = duck ? 0.35 : 1;
  hit('claves', t, (onOne ? 0.55 : 0.4) * level, g);
  if (mode === 'breakdown') {
    if (onOne) note('bass', root, t, spb * 1.6, 0.4, g);
    hit('shaker', t + spb / 2, 0.25, g);
    return;
  }
  if (tier >= 1) note('bass', onOne ? root : root + 7, t, spb * 0.85, 0.42 * level, g);
  if (tier >= 2) {
    hit(onOne ? 'bass-drum' : 'snare', t, (onOne ? 0.8 : 0.45) * level, g);
    hit('shaker', t, 0.18 * level, g);
    hit('shaker', t + spb / 2, 0.22 * level, g);
  }
  if (tier >= 3 && !onOne && !duck) CHORD[root].forEach((m) => note('horn', m, t + spb / 2, spb * 0.35, 0.16, g));
  if (tier >= 4 && !duck) {
    hit('tambourine', t + spb / 2, 0.3, g);
    if (i % 8 === 0) hit('cymbal', t, 0.35, g);
  }
}
