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

/* A recorded voice: Kyle's takes of the patterns in /assets/patterns/patterns.js, recorded
   at /studio/record/ at three speeds (and, for tonal patterns, in a key).
     const kyle = await samples.takes('kyle');
     await kyle.prepare(['rhythm/2-4/q-ee']);
     kyle.say('rhythm/2-4/q-ee', t, { bpm: 84 });
   say() picks the takes recorded nearest that tempo (or { speed: 'slow' }), never the same
   take twice running, and stretches it to bpm. { key } moves a tonal take to another key
   (sounding midi of do, or la in minor). Stretching moves pitch and tempo together, so a
   take sounds best near the tempo and key it was recorded in. */
export async function takes(name) {
  const spec = (await list()).voices?.[name];
  if (!spec) throw new Error(`No voice "${name}"`);
  const patterns = spec.patterns;
  const last = new Map();
  const choose = (id, { speed, bpm, key }) => {
    let options = patterns[id] || [];
    if (speed) options = options.filter((o) => o.speed === speed);
    else if (bpm) {
      const gap = (o) => Math.abs(Math.log(o.bpm / bpm));
      const best = Math.min(...options.map(gap));
      options = options.filter((o) => gap(o) - best < 0.05);
    }
    if (key != null && options.some((o) => o.key === key)) options = options.filter((o) => o.key === key);
    if (options.length < 2) return options[0];
    const others = options.filter((o) => o !== last.get(id));
    const take = others[Math.floor(Math.random() * others.length)];
    last.set(id, take);
    return take;
  };
  return {
    name,
    label: spec.label,
    patterns: Object.keys(patterns),
    has: (id) => id in patterns,
    speeds: (id) => [...new Set((patterns[id] || []).map((o) => o.speed))],
    // Load the takes a page will use, ahead of time.
    prepare: (ids) => Promise.all(ids.flatMap((id) => (patterns[id] || []).map((o) => load(o.file)))),
    async say(id, t, { speed = null, bpm = null, key = null, vol = 1, dest } = {}) {
      const take = choose(id, { speed, bpm, key });
      if (!take) return () => {};
      const s = await load(take.file);
      let rate = bpm && take.bpm ? bpm / take.bpm : 1;
      if (key != null && take.key != null) rate *= 2 ** ((key - take.key) / 12);
      return play(s, Math.max(t, context().currentTime), { vol, dest, rate });
    },
  };
}
