/* Sound: the site's sampled instruments, the backing groove that grows with the combo,
   pattern calls, cue words and game sound effects. Kyle's recordings (takes on "bum" and in
   syllables, cue words, groove loops) are used wherever they're on the site; anything missing
   or failing to load falls back to a sampled or synthesized stand-in, so the stream always plays. */

import * as samples from '/assets/sounds/samples.js';
import { onsets } from './steps.js';

let ctx = null;
let master = null;
let grooveBus = null;
let loopBus = null; // Kyle's groove loops, ducked as one
const inst = {};
let kyle = null; // recorded voice, once Kyle's takes are on the site
let loops = {}; // Kyle's groove loops: layer → bpm → { buffer, start, beats }
let grooves = []; // grooves.json, made in the studio's Groove Lab
let G = null; // the groove playing

export const HITS = ['claves', 'log-drum-low', 'log-drum-high', 'bass-drum', 'snare', 'shaker', 'tambourine',
  'cymbal', 'triangle', 'cowbell', 'agogo', 'guiro', 'bongo-high', 'bongo-low', 'conga', 'finger-cymbals', 'sleigh-bells'];
const PITCHED = { bass: [36, 52], horn: [60, 74], marimba: [60, 88], trombone: [40, 55] };

export function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    grooveBus = ctx.createGain();
    grooveBus.connect(master);
    loopBus = ctx.createGain();
    loopBus.gain.value = 1;
    loopBus.connect(grooveBus);
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
    (async () => {
      kyle = await samples.takes('kyle');
      await Promise.allSettled([kyle.prepare(kyle.patterns), kyle.prepareCues()]);
    })(),
    (async () => { loops = await samples.grooveLoops(); })(),
    loadGrooves(),
    ...TOON_FILES.map(loadToon),
  ]).then(() => useInstruments(grooves));
  return loading;
}

/* The groove list alone (no sound), e.g. for a picker. */
let groovesLoading = null;
export function loadGrooves() {
  // What Groove Lab last published, otherwise the repo's copy.
  const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  groovesLoading ||= get('/api/live/grooves.json')
    .then(async (live) => (live?.grooves?.length ? live : (await get(new URL('grooves.json', import.meta.url))) || { grooves: [] }))
    .then((data) => {
      grooves = checkGrooves(data.grooves);
      G ||= grooves[0] || null;
      return grooves;
    })
    .catch(() => grooves);
  return groovesLoading;
}

/* Loads every instrument these grooves use, over the notes they play. */
export async function useInstruments(list) {
  const want = {};
  const versions = list.flatMap((g) => (g.versions ? Object.values(g.versions) : [g]));
  const sets = versions.flatMap((g) => [...Object.values(g.layers), ...Object.values(g.variants || {}).flat().map((v) => v.tracks)]);
  for (const tracks of sets) for (const tr of tracks) {
    const w = (want[tr.inst] ||= { lo: 127, hi: 0 });
    for (const n of tr.notes) if (n.m != null) { w.lo = Math.min(w.lo, n.m); w.hi = Math.max(w.hi, n.m); }
  }
  await Promise.allSettled(Object.entries(want).map(async ([name, { lo, hi }]) => {
    if (inst[name]?.hit) return;
    const [plo, phi] = PITCHED[name] || [lo, hi];
    inst[name] = await samples.instrument(name, hi >= lo ? { lo: Math.min(lo, plo), hi: Math.max(hi, phi) } : {});
  }));
}

/* ---------- cartoon effects for the scenes ---------- */
// Recorded ones are Kenney's CC0 packs (fx/CREDITS.txt); the rest are synthesized.
const TOON_FILES = ['swish', 'punch', 'thud', 'step-1', 'step-2', 'pot', 'boing', 'creak', 'tin', 'clink', 'wah', 'pep'];
const toonBuf = {};
const toonBase = new URL('./fx/', import.meta.url);
async function loadToon(name) {
  const r = await fetch(new URL(`${name}.mp3`, toonBase));
  if (!r.ok) return;
  const data = await r.arrayBuffer();
  toonBuf[name] = await new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail));
}

function playBuf(buf, t, vol = 0.6, rate = 1) {
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  src.playbackRate.value = rate;
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start(Math.max(t, ctx.currentTime));
}

function noise(t, len, vol, filter, from, to, q = 1) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
  const x = buf.getChannelData(0);
  for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.setValueAtTime(vol, t + len * 0.7);
  g.gain.linearRampToValueAtTime(0, t + len);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

/* toon(name, t): play a scene effect at audio time t (now if t is left out). */
export function toon(name, t, opts = {}) {
  if (!ctx) return;
  t = Math.max(t ?? ctx.currentTime, ctx.currentTime);
  const { vol = 1, rate = 1 } = opts;
  if (toonBuf[name]) { playBuf(toonBuf[name], t, 0.6 * vol, rate); return; }
  const tone = (f, len, v, type, slide) => synth(t, f, len, v * vol, master, type, slide);
  switch (name) {
    case 'whistle-up': tone(500, 0.35, 0.18, 'sine', 3.2); break;
    case 'whistle-down': tone(1500, 0.45, 0.18, 'sine', 0.3); break;
    case 'squeak': tone(1900, 0.07, 0.12, 'sine', 1.5); synth(t + 0.08, 2300, 0.06, 0.1 * vol, master, 'sine', 1.3); break;
    case 'pop': tone(700, 0.06, 0.3, 'sine', 2.2); break;
    case 'zip': noise(t, 0.22, 0.35 * vol, 'bandpass', 900, 6000, 3); break;
    case 'raspberry': {
      // A wobbling buzz: a low sawtooth under a fast tremolo.
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t);
      o.frequency.linearRampToValueAtTime(80, t + 0.45);
      lfo.frequency.value = 28;
      lg.gain.value = 0.18 * vol;
      f.type = 'lowpass';
      f.frequency.value = 1400;
      g.gain.setValueAtTime(0.18 * vol, t);
      g.gain.linearRampToValueAtTime(0, t + 0.5);
      lfo.connect(lg).connect(g.gain);
      o.connect(f).connect(g).connect(master);
      o.start(t); lfo.start(t);
      o.stop(t + 0.55); lfo.stop(t + 0.55);
      break;
    }
    case 'twinkle': [88, 91, 96].forEach((m, i) => note('marimba', m, t + i * 0.07, 0.2, 0.25)); break;
    case 'honk': {
      // A bicycle horn: two buzzy reeds a little out of tune, squeezed twice.
      [0, 0.16].forEach((d) => {
        [370, 377].forEach((fq) => {
          const o = ctx.createOscillator();
          const f = ctx.createBiquadFilter();
          const g = ctx.createGain();
          o.type = 'square';
          o.frequency.setValueAtTime(fq * rate, t + d);
          o.frequency.linearRampToValueAtTime(fq * rate * 0.94, t + d + 0.13);
          f.type = 'bandpass';
          f.frequency.value = 1100;
          f.Q.value = 1.4;
          g.gain.setValueAtTime(0, t + d);
          g.gain.linearRampToValueAtTime(0.13 * vol, t + d + 0.012);
          g.gain.setValueAtTime(0.13 * vol, t + d + 0.1);
          g.gain.linearRampToValueAtTime(0, t + d + 0.14);
          o.connect(f).connect(g).connect(master);
          o.start(t + d);
          o.stop(t + d + 0.16);
        });
      });
      break;
    }
    case 'gong': {
      // A big bronze bell: inharmonic partials that ring for a long time, with a slow beat.
      [[110, 0.3, 3.2], [111.4, 0.22, 3.2], [264, 0.16, 2.2], [302, 0.1, 1.8], [453, 0.08, 1.2], [701, 0.05, 0.8]].forEach(([fq, v, len]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = fq * rate;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v * vol, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0005, t + len);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + len + 0.05);
      });
      noise(t, 0.08, 0.25 * vol, 'bandpass', 2400, 900, 1.5);
      break;
    }
    case 'croak': {
      // A frog: a low buzzy pulse train, twice.
      [0, 0.2].forEach((d) => {
        const o = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(95 * rate, t + d);
        o.frequency.linearRampToValueAtTime(130 * rate, t + d + 0.14);
        lfo.type = 'square';
        lfo.frequency.value = 34;
        lg.gain.value = 0.16 * vol;
        f.type = 'bandpass';
        f.frequency.value = 700;
        f.Q.value = 3;
        g.gain.setValueAtTime(0.16 * vol, t + d);
        g.gain.linearRampToValueAtTime(0, t + d + 0.16);
        lfo.connect(lg).connect(g.gain);
        o.connect(f).connect(g).connect(master);
        o.start(t + d); lfo.start(t + d);
        o.stop(t + d + 0.18); lfo.stop(t + d + 0.18);
      });
      break;
    }
    case 'choir': {
      // "Aaah": a major chord of soft vowel-ish voices that swell in.
      [60, 64, 67, 72].forEach((m) => {
        [-6, 6].forEach((cents) => {
          const o = ctx.createOscillator();
          const f = ctx.createBiquadFilter();
          const g = ctx.createGain();
          o.type = 'sawtooth';
          o.frequency.value = 440 * 2 ** ((m - 69) / 12) * 2 ** (cents / 1200);
          f.type = 'bandpass';
          f.frequency.value = 800;
          f.Q.value = 1.2;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.035 * vol, t + 0.25);
          g.gain.setValueAtTime(0.035 * vol, t + 0.9);
          g.gain.linearRampToValueAtTime(0, t + 1.4);
          o.connect(f).connect(g).connect(master);
          o.start(t);
          o.stop(t + 1.45);
        });
      });
      break;
    }
    case 'slide-up': tone(300, 0.5, 0.16, 'triangle', 4); break;
    case 'slide-down': tone(1300, 0.6, 0.16, 'triangle', 0.22); break;
    /* Supper Time (scene-supper.js) */
    case 'ding': {
      // Mookie's bowl is an old Japanese gong bowl: a bright ring with a slow shimmer.
      [[660, 0.16, 1.4], [664, 0.12, 1.4], [1782, 0.06, 0.8], [3366, 0.03, 0.4]].forEach(([fq, v, len]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = fq * rate;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v * vol, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0005, t + len);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + len + 0.05);
      });
      break;
    }
    case 'meow': case 'yowl': {
      // A cat: a buzzy voice whose pitch and vowel rise and fall ("mee-OW"). The yowl is
      // longer, lower, louder and wobbles.
      const yowl = name === 'yowl';
      const len = (yowl ? 0.85 : 0.38) / rate;
      const p = (yowl ? 360 : 520) * rate;
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(p, t);
      o.frequency.linearRampToValueAtTime(p * 1.55, t + len * 0.35);
      o.frequency.linearRampToValueAtTime(p * 0.8, t + len);
      if (yowl) {
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 7;
        lg.gain.value = p * 0.06;
        lfo.connect(lg).connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + len + 0.05);
      }
      f.type = 'bandpass';
      f.Q.value = 2.2;
      f.frequency.setValueAtTime(800, t);
      f.frequency.linearRampToValueAtTime(1800, t + len * 0.4);
      f.frequency.linearRampToValueAtTime(700, t + len);
      const v = (yowl ? 0.3 : 0.22) * vol;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.04);
      g.gain.setValueAtTime(v, t + len * 0.7);
      g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(f).connect(g).connect(master);
      o.start(t);
      o.stop(t + len + 0.05);
      break;
    }
    case 'chomp':
      [0, 0.13].forEach((d) => {
        noise(t + d, 0.07, 0.35 * vol, 'lowpass', 1400, 500, 1);
        synth(t + d, 150, 0.08, 0.25 * vol, master, 'sine', 0.5);
      });
      break;
    case 'burp': {
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(95 * rate, t);
      o.frequency.linearRampToValueAtTime(70 * rate, t + 0.5);
      lfo.frequency.value = 22;
      lg.gain.value = 0.2 * vol;
      f.type = 'lowpass';
      f.frequency.value = 500;
      g.gain.setValueAtTime(0.22 * vol, t);
      g.gain.linearRampToValueAtTime(0, t + 0.55);
      lfo.connect(lg).connect(g.gain);
      o.connect(f).connect(g).connect(master);
      o.start(t); lfo.start(t);
      o.stop(t + 0.6); lfo.stop(t + 0.6);
      break;
    }
    case 'cluck': [0, 0.09, 0.16].forEach((d, i) => synth(t + d, (i === 2 ? 820 : 640) * rate, 0.05, 0.14 * vol, master, 'square', 0.6)); break;
    case 'fanfare': [[67, 0, 0.1], [72, 0.12, 0.1], [76, 0.24, 0.1], [79, 0.36, 0.5]].forEach(([m, d, len]) => {
      synth(t + d, 440 * 2 ** ((m - 69) / 12), len, 0.12 * vol, master, 'sawtooth');
      synth(t + d, 440 * 2 ** ((m - 69) / 12) * 1.003, len, 0.08 * vol, master, 'square');
    }); break;
    case 'hiss': noise(t, 0.45, 0.22 * vol, 'highpass', 3500, 5000, 0.7); break;
    case 'snore': noise(t, 0.6, 0.18 * vol, 'lowpass', 250, 700, 2); synth(t, 70, 0.55, 0.12 * vol, master, 'sawtooth', 1.3); break;
    case 'tiptoe': synth(t, 1100 * rate, 0.05, 0.1 * vol, master, 'triangle', 0.7); break;
    /* Brushing Time (scene-brush.js) */
    case 'brush': noise(t, 0.13, 0.12 * vol, 'bandpass', 1800 * rate, 5200 * rate, 1.2); break;
    case 'sproing': tone(240 * rate, 0.16, 0.14, 'triangle', 2.6); synth(t + 0.05, 420 * rate, 0.14, 0.08 * vol, master, 'sine', 0.7); break;
    case 'ting': [2637, 3951, 5274].forEach((fq, i) => synth(t + i * 0.05, fq * rate, 0.35, 0.07 * vol, master, 'sine')); break;
    case 'spritz': [0, 0.11].forEach((d) => noise(t + d, 0.09, 0.3 * vol, 'highpass', 4000, 7000, 0.8)); break;
    case 'zap':
      // Static: a fistful of crackles.
      for (let k = 0; k < 7; k++) noise(t + k * 0.035 + Math.random() * 0.02, 0.025, 0.35 * vol, 'highpass', 2500 + Math.random() * 3000, 6000, 1);
      synth(t, 1800, 0.12, 0.05 * vol, master, 'square', 0.4);
      break;
    case 'purr': {
      // A low motor that flutters 24 times a second.
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 52 * rate;
      lfo.frequency.value = 24;
      lg.gain.value = 0.14 * vol;
      f.type = 'lowpass';
      f.frequency.value = 600;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.14 * vol, t + 0.08);
      g.gain.linearRampToValueAtTime(0, t + 0.7);
      lfo.connect(lg).connect(g.gain);
      o.connect(f).connect(g).connect(master);
      o.start(t); lfo.start(t);
      o.stop(t + 0.75); lfo.stop(t + 0.75);
      break;
    }
    case 'roar':
      // An 800-year-old bronze lion clears his throat.
      noise(t, 0.7, 0.3 * vol, 'lowpass', 500, 180, 3);
      synth(t, 110 * rate, 0.7, 0.16 * vol, master, 'sawtooth', 0.6);
      synth(t, 82 * rate, 0.7, 0.12 * vol, master, 'square', 0.7);
      break;
    case 'sneeze':
      // "Ah..." (a rising buzzy vowel) "...CHOO!" (a burst of noise).
      synth(t, 300 * rate, 0.32, 0.08 * vol, master, 'sawtooth', 1.6);
      noise(t + 0.34, 0.16, 0.5 * vol, 'bandpass', 3000, 1200, 1.2);
      synth(t + 0.34, 520 * rate, 0.1, 0.12 * vol, master, 'square', 0.5);
      break;
    default: break;
  }
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
  conga: [200, 0.15], 'finger-cymbals': [4000, 0.5], 'sleigh-bells': [6000, 0.3],
};

export function hit(name, t, vol = 0.8, dest = master) {
  if (!ctx) return;
  t = Math.max(t, ctx.currentTime);
  if (inst[name]?.hit) return inst[name].hit(t, { vol, dest });
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

/* ---------- the call: a pattern on "bum", in syllables or on an instrument ---------- */

/* kind (tasks.js stimulus `hear`): 'neutral', 'syllables', 'instrument', 'syllables+inst'.
   inst: the instrument's sound (a HITS name), for the last two. */
export function call(p, kind, t, spb, inst = 'conga') {
  if (kind === 'instrument' || kind === 'syllables+inst') {
    for (const o of onsets(p)) hit(inst, t + o.b * spb, kind === 'instrument' ? 0.95 : 0.55);
    if (kind === 'instrument') return;
    kind = 'syllables';
  }
  if (kind === 'syllables' && kyle?.has(p.id)) {
    kyle.say(p.id, t, { bpm: 60 / spb });
    return;
  }
  if (kind === 'neutral' && kyle?.has(p.id, 'bum')) {
    kyle.say(p.id, t, { bpm: 60 / spb, as: 'bum' });
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

/* A cue word in Kyle's voice (cues.js ids). false when it isn't recorded yet. */
export function speak(id, t) {
  if (!ctx || !kyle?.hasCue(id)) return false;
  kyle.cue(id, t, { dest: master });
  return true;
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

// Combo tiers: each adds a layer. 0 pulse, 1 bass, 2 drums, 3 horns, 4 full band; breathers
// play the breakdown layer alone. A groove (grooves.json, from the studio's Groove Lab) is
// notes on a 16th-note grid, so it plays at any tempo. Kyle's recorded loops, if any, play in
// place of the Basic groove's layers at their tempo.
export const LAYERS = ['pulse', 'bass', 'drums', 'horns', 'band'];
export const ALL_LAYERS = [...LAYERS, 'breakdown'];
export const METERS = { '2/4': 'Simple 2/4', '6/8': 'Compound 6/8' };
// Each groove can rename its layers and give them their own icon for the game's band seats.
export const LAYER_DEFAULTS = {
  pulse: { name: 'Pulse', icon: '🥢' },
  bass: { name: 'Bass', icon: '🎸' },
  drums: { name: 'Drums', icon: '🥁' },
  horns: { name: 'Horns', icon: '🎺' },
  band: { name: 'Band', icon: '🎹' },
  breakdown: { name: 'Breakdown', icon: '🌙' },
};
export const layerInfo = (g, name) => ({ ...LAYER_DEFAULTS[name], ...(g?.layerInfo?.[name] || {}) });
// Grid steps in a beat: 16ths of a quarter in 2/4, of a dotted quarter in 6/8.
export const stepsPerBeat = (g) => (g.meter === '6/8' ? 6 : 4);
const ROOTS = [41, 41, 46, 48]; // F F Bb C, one per bar of 2/4 (stand-in when grooves.json is missing)
const CHORD = { 41: [65, 69, 72], 46: [65, 70, 74], 48: [64, 67, 72] };

/* Grooves as the game trusts them. A groove has a name, a key, its layers' names and icons
   (layerInfo, optional) and up to two versions, one per meter (2/4 and 6/8), meant to share
   instruments and chords so the game can switch between them:
   { id, name, key, layerInfo: { bass: { name, icon }, … }, versions: { '2/4': { meter, beats,
   swing, layers, variants }, … } }. A version's variants are other takes on a layer, each with
   its own chance of playing in place of the main one on each time round the loop:
   variants: { bass: [{ chance: 0.1, tracks }] }.
   (A first-format groove, with meter, beats and layers at the top, becomes one version.) */
export function checkGrooves(list) {
  if (!Array.isArray(list)) return [];
  const version = (v, meter) => {
    if (!v || !Number.isInteger(v.beats) || v.beats <= 0 || !v.layers) return null;
    const steps = v.beats * (meter === '6/8' ? 6 : 4);
    const tracks = (list) => (Array.isArray(list) ? list : [])
      .filter((tr) => tr && typeof tr.inst === 'string' && Array.isArray(tr.notes))
      .map((tr) => ({
        inst: tr.inst,
        vol: Math.max(0, Math.min(1.5, Number(tr.vol ?? 1))),
        notes: tr.notes.filter((n) => Number.isInteger(n.s) && n.s >= 0 && n.s < steps),
      }));
    const out = {
      meter,
      beats: v.beats,
      swing: meter === '6/8' ? 0 : Math.max(0, Math.min(1, Number(v.swing) || 0)),
      layers: Object.fromEntries(ALL_LAYERS.map((name) => [name, tracks(v.layers[name])])),
    };
    const variants = ALL_LAYERS.map((name) => [name, (Array.isArray(v.variants?.[name]) ? v.variants[name] : [])
      .filter((x) => x && Array.isArray(x.tracks))
      .map((x) => ({ chance: Math.max(0, Math.min(1, Number(x.chance) || 0)), tracks: tracks(x.tracks) }))])
      .filter(([, list]) => list.length);
    if (variants.length) out.variants = Object.fromEntries(variants);
    return out;
  };
  const info = (x) => {
    const out = {};
    for (const name of ALL_LAYERS) {
      const name2 = String(x?.[name]?.name ?? '').trim().slice(0, 24);
      const icon = String(x?.[name]?.icon ?? '').trim().slice(0, 8);
      const d = LAYER_DEFAULTS[name];
      if ((name2 && name2 !== d.name) || (icon && icon !== d.icon)) {
        out[name] = { ...(name2 && name2 !== d.name ? { name: name2 } : {}), ...(icon && icon !== d.icon ? { icon } : {}) };
      }
    }
    return Object.keys(out).length ? out : null;
  };
  return list.filter((g) => g && typeof g.id === 'string').map((g) => {
    const given = g.versions || (g.layers ? { [g.meter === '6/8' ? '6/8' : '2/4']: g } : {});
    const versions = {};
    for (const meter of Object.keys(METERS)) {
      const v = version(given[meter], meter);
      if (v) versions[meter] = v;
    }
    const layerInfo2 = info(g.layerInfo);
    return { id: g.id, name: String(g.name || g.id), key: Number.isInteger(g.key) ? g.key : 0, ...(layerInfo2 ? { layerInfo: layerInfo2 } : {}), versions };
  }).filter((g) => Object.keys(g.versions).length);
}

export const grooveList = (meter = null) => (meter ? grooves.filter((g) => g.versions[meter]) : grooves);
export const grooveNow = () => G;
export function setGroove(id) {
  G = grooves.find((g) => g.id === id) || G || grooves[0] || null;
  return G;
}

/* The meter the groove plays in: the unit's, or a review item's from another unit. The
   switch takes effect on the next beat, at the same place in the loop, so a groove whose
   versions share bars and chords carries on in the other meter. */
let M = '2/4';
// Beat index where the loop starts: games set it to their call, so every call is on bar 1.
let phase = 0;
export function setGroovePhase(i) { phase = i; }
const loopPos = (i, beats) => (((i - phase) % beats) + beats) % beats;
export const grooveMeter = () => M;
export function setGrooveMeter(meter) { M = meter === '6/8' ? '6/8' : '2/4'; }
const versionNow = () => (G ? G.versions[M] || Object.values(G.versions)[0] : null);

/* The tracks a layer plays this time round the loop: each variant gets its own roll of the dice
   (its chance) once per repetition, and the first that comes up plays in place of the main
   take; if none does, the main one plays. force picks one instead: { bass: 0 } is the first
   variant, -1 the main take (the Groove Lab, when you hear the one you are editing). */
const rolls = new WeakMap(); // version → { layer: { rep, tracks } }
function tracksFor(g, name, i, force) {
  const vars = g.variants?.[name] || [];
  if (force && name in force) return force[name] >= 0 && vars[force[name]] ? vars[force[name]].tracks : g.layers[name] || [];
  if (!vars.length) return g.layers[name] || [];
  const rep = Math.floor((i - phase) / g.beats);
  let r = rolls.get(g);
  if (!r) rolls.set(g, (r = {}));
  if (r[name]?.rep !== rep) {
    const won = vars.find((v) => Math.random() < v.chance);
    r[name] = { rep, tracks: won ? won.tracks : g.layers[name] || [] };
  }
  return r[name].tracks;
}

/* One beat (i) of a groove version's layers, at t. In 2/4, swing moves the off-beat 8th toward a
   triplet (1 = full triplet) and the 16ths with it; 6/8 is already in threes. */
let openHat = null; // stops the open hi-hat ringing now
export function playGrooveBeat(g, i, t, spb, { layers, level = 1, dest = grooveBus, force = null }) {
  const pos = loopPos(i, g.beats);
  const per = stepsPerBeat(g);
  const d = g.meter === '6/8' ? 0 : g.swing / 6;
  const warp = (x) => (x < 0.5 ? x * (0.5 + d) / 0.5 : 0.5 + d + (x - 0.5) * (0.5 - d) / 0.5);
  const step = spb / per;
  for (const name of layers) {
    for (const tr of tracksFor(g, name, i, force)) {
      for (const n of tr.notes) {
        if (Math.floor(n.s / per) !== pos) continue;
        const at = t + warp((n.s % per) / per) * spb;
        const vol = tr.vol * (n.v ?? 0.8) * level;
        if (n.m == null) {
          const stop = hit(tr.inst, at, vol, dest);
          // A closed or pedal hi-hat cuts off an open one, as on a real kit.
          if (tr.inst === 'kit-hihat-open') openHat = stop;
          else if ((tr.inst === 'kit-hihat-closed' || tr.inst === 'kit-hihat-pedal') && openHat) {
            const cut = openHat;
            openHat = null;
            setTimeout(() => cut?.(), Math.max(0, (at - ctx.currentTime) * 1000));
          }
        }
        else note(tr.inst, n.m, at, Math.max(1, n.l || 1) * step * 0.95, vol * 0.5, dest);
      }
    }
  }
}

const live = {}; // layer → the pass playing: { src, gain, bpm, from, until } in beats
let lastBeat = -1;

function stopLayer(name, t) {
  const p = live[name];
  if (!p) return;
  delete live[name];
  t = Math.max(t, ctx.currentTime);
  p.gain.gain.setTargetAtTime(0, t, 0.012);
  try { p.src.stop(t + 0.08); } catch { /* already stopped */ }
}

/* Everything off now: pause, intermission, end of a run. */
export function grooveStop() {
  if (!ctx) return;
  Object.keys(live).forEach((n) => stopLayer(n, ctx.currentTime));
  lastBeat = -1;
}

/* Keeps a layer's loop playing through beat i. A pass runs to the loop's end; joining
   mid-loop (a new combo tier, a new tempo) starts at the matching beat inside it. */
function loopLayer(name, i, t, spb) {
  const bpm = Math.round(60 / spb);
  const L = loops[name]?.[bpm];
  if (!L) { stopLayer(name, t); return false; }
  const p = live[name];
  if (p && p.bpm === bpm && i >= p.from && i < p.until) return true;
  const seamless = p && p.bpm === bpm && i === p.until;
  if (!seamless) stopLayer(name, t);
  const pos = loopPos(i, L.beats);
  const end = t + (L.beats - pos) * spb;
  const src = ctx.createBufferSource();
  src.buffer = L.buffer;
  const gain = ctx.createGain();
  if (pos) {
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.008);
  }
  src.connect(gain).connect(loopBus);
  src.start(t, L.start + pos * spb);
  src.stop(end);
  live[name] = { src, gain, bpm, from: i, until: i + L.beats - pos };
  return true;
}

export function groove(i, t, spb, { tier, mode, duck }) {
  if (mode === 'off') { grooveStop(); return; }
  if (i <= lastBeat) grooveStop(); // the clock started again
  lastBeat = i;
  loopBus.gain.setTargetAtTime(duck ? 0.3 : 1, t, 0.02);
  const rec = {};
  const useLoops = (!G || G.id === 'basic') && M === '2/4';
  for (const [n, name] of ALL_LAYERS.entries()) {
    const want = useLoops && (mode === 'breakdown' ? name === 'breakdown' : name !== 'breakdown' && n <= tier);
    if (want) rec[name] = loopLayer(name, i, t, spb);
    else stopLayer(name, t);
  }
  const V = versionNow();
  if (!V) { standIn(i, t, spb, { tier, mode, duck }, rec); return; }
  // While the mic listens, only the pulse keeps the beat, softly: the mic hears everything else.
  if (duck === 'mic') { playGrooveBeat(V, i, t, spb, { layers: ['pulse'], level: 0.45 }); return; }
  let layers;
  if (mode === 'breakdown') layers = [V.layers.breakdown, ...(V.variants?.breakdown || []).map((x) => x.tracks)].some((ts) => ts.some((tr) => tr.notes.length)) ? ['breakdown'] : ['pulse'];
  else layers = LAYERS.filter((name, n) => n <= tier && !(duck && (name === 'horns' || name === 'band')));
  playGrooveBeat(V, i, t, spb, { layers: layers.filter((name) => !rec[name]), level: duck ? 0.35 : 1 });
}

/* The sampled groove, for every layer Kyle hasn't recorded at this tempo. */
function standIn(i, t, spb, { tier, mode, duck }, rec) {
  const bar = Math.floor(i / 2);
  const onOne = i % 2 === 0;
  const root = ROOTS[bar % 4];
  const g = grooveBus;
  // While the mic listens, only the claves keep the beat: the mic hears everything else.
  if (duck === 'mic') { hit('claves', t, onOne ? 0.3 : 0.2, g); return; }
  const level = duck ? 0.35 : 1;
  if (mode === 'breakdown') {
    if (rec.breakdown) return;
    hit('claves', t, (onOne ? 0.55 : 0.4) * level, g);
    if (onOne) note('bass', root, t, spb * 1.6, 0.4, g);
    hit('shaker', t + spb / 2, 0.25, g);
    return;
  }
  if (!rec.pulse) hit('claves', t, (onOne ? 0.55 : 0.4) * level, g);
  if (tier >= 1 && !rec.bass) note('bass', onOne ? root : root + 7, t, spb * 0.85, 0.42 * level, g);
  if (tier >= 2 && !rec.drums) {
    hit(onOne ? 'bass-drum' : 'snare', t, (onOne ? 0.8 : 0.45) * level, g);
    hit('shaker', t, 0.18 * level, g);
    hit('shaker', t + spb / 2, 0.22 * level, g);
  }
  if (tier >= 3 && !rec.horns && !onOne && !duck) CHORD[root].forEach((m) => note('horn', m, t + spb / 2, spb * 0.35, 0.16, g));
  if (tier >= 4 && !rec.band && !duck) {
    hit('tambourine', t + spb / 2, 0.3, g);
    if (i % 8 === 0) hit('cymbal', t, 0.35, g);
  }
}
