/* Recorded instrument samples, loaded only when asked for.
   The list of sounds is index.json; tools/build_sounds.py makes it.

   import * as samples from '/assets/sounds/samples.js';
   samples.setup(snd.ac(), snd.bus());            // optional: share another engine's context
   const piano = await samples.instrument('piano', { lo: 48, hi: 84 });
   piano.note(60, t, 0.5, { vol: 0.8 });          // same call as sound.js note(), returns stop()
   (await samples.instrument('claves')).hit(t);

   Times are on the audio clock (context.currentTime). */

const base = new URL('.', import.meta.url);
const buffers = new Map();
let ctx = null;
let out = null;
let index = null;

export function setup(context, output) {
  ctx = context;
  out = output || context.destination;
}

function context() {
  if (!ctx) setup(new (window.AudioContext || window.webkitAudioContext)());
  if (ctx.state === 'suspended' && !(ctx instanceof OfflineAudioContext)) ctx.resume();
  return ctx;
}

export const now = () => context().currentTime;

export function list() {
  index ||= fetch(new URL('index.json', base)).then((r) => {
    if (!r.ok) throw new Error(`index.json: ${r.status}`);
    return r.json();
  });
  return index;
}

/* Decoded buffer plus where the sound starts, measured after decoding:
   mp3 decoders add different amounts of silence, and rhythms need the true start. */
function load(file) {
  if (!buffers.has(file)) {
    buffers.set(file, fetch(new URL(file, base))
      .then((r) => {
        if (!r.ok) throw new Error(`${file}: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((data) => new Promise((ok, fail) => context().decodeAudioData(data, ok, fail)))
      .then((buffer) => ({ buffer, start: onset(buffer) })));
  }
  return buffers.get(file);
}

function onset(buffer) {
  const x = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]) > peak * 0.05) return Math.max(0, i / buffer.sampleRate - 0.001);
  }
  return 0;
}

/* Play a loaded buffer at time t. rate changes speed and pitch together. */
function play(s, t, { vol = 1, dest, rate = 1, dur = null, release = 0.05 } = {}) {
  const c = context();
  const src = c.createBufferSource();
  const g = c.createGain();
  src.buffer = s.buffer;
  src.playbackRate.value = rate;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.001);
  const length = (s.buffer.duration - s.start) / rate;
  let end = t + length;
  if (dur != null && dur < length) {
    g.gain.setTargetAtTime(0, t + dur, release / 3);
    end = t + dur + release * 2;
  }
  src.connect(g);
  g.connect(dest || out);
  src.start(t, s.start);
  src.stop(end + 0.05);
  return () => {
    const n = c.currentTime;
    g.gain.cancelScheduledValues(n);
    g.gain.setValueAtTime(g.gain.value, n);
    g.gain.setTargetAtTime(0, n, 0.02);
    try { src.stop(n + 0.15); } catch { /* already stopped */ }
  };
}

/* Zones nearest to each note from lo to hi: the ones a piece in that range uses. */
function nearest(zones, midi) {
  return zones.reduce((a, b) => (Math.abs(b.midi - midi) < Math.abs(a.midi - midi) ? b : a));
}

/* A named instrument from index.json. Pitched ones have note(), the others hit().
   { lo, hi } loads only the notes that range needs; others load the first time they play. */
export async function instrument(name, { lo = 0, hi = 127 } = {}) {
  const spec = (await list()).instruments[name];
  if (!spec) throw new Error(`No instrument "${name}"`);
  if (spec.kind === 'hit') {
    const s = await load(spec.file);
    return { name, label: spec.label, hit: (t, opts) => play(s, t, opts) };
  }
  const loaded = new Map();
  const want = new Set();
  for (let m = Math.max(lo, 0); m <= Math.min(hi, 127); m++) want.add(nearest(spec.zones, m));
  await Promise.all([...want].map(async (z) => loaded.set(z, await load(z.file))));
  return {
    name,
    label: spec.label,
    note(midi, t, dur, { vol = 0.25, dest } = {}) {
      let z = nearest(spec.zones, midi);
      if (!loaded.has(z)) {
        load(z.file).then((s) => loaded.set(z, s));
        z = nearest([...loaded.keys()], midi);
      }
      const rate = 2 ** ((midi - z.midi - (z.tune || 0) / 100) / 12);
      // Same loudness scale as sound.js, where 0.25 is a normal note.
      return play(loaded.get(z), t, { vol: vol * 3, dest, rate, dur, release: spec.release });
    },
  };
}

/* Patterns match whatever the spacing, case or hyphens: "Du-de du-de" is "du de du de". */
export const patternKey = (text) => String(text).toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();

/* A recorded voice: several takes of each spoken or sung pattern, from /studio/record/.
   say() plays one take, never the same one twice running. bpm stretches it to another
   tempo (pitch moves with it, so keep it near the tempo it was recorded at). */
export async function takes(name) {
  const spec = (await list()).voices?.[name];
  if (!spec) throw new Error(`No voice "${name}"`);
  const patterns = Object.fromEntries(Object.entries(spec.patterns).map(([text, list]) => [patternKey(text), list]));
  const last = new Map();
  const pick = (key) => {
    const options = patterns[key] || [];
    if (options.length < 2) return options[0];
    const others = options.filter((o) => o !== last.get(key));
    const take = others[Math.floor(Math.random() * others.length)];
    last.set(key, take);
    return take;
  };
  return {
    name,
    label: spec.label,
    patterns: Object.keys(patterns),
    has: (text) => patternKey(text) in patterns,
    // Load the takes a page will use, ahead of time.
    prepare: (texts) => Promise.all(texts.flatMap((t) => (patterns[patternKey(t)] || []).map((o) => load(o.file)))),
    async say(text, t, { bpm = null, vol = 1, dest } = {}) {
      const take = pick(patternKey(text));
      if (!take) return () => {};
      const s = await load(take.file);
      return play(s, Math.max(t, context().currentTime), { vol, dest, rate: bpm && take.bpm ? bpm / take.bpm : 1 });
    },
  };
}
