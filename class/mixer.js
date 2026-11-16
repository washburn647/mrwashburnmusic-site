/* Plays a recording's layers together (slide audio, see tracks.js): each layer through its own
   gain, so a layer turns on and off without the others stopping, and one volume over all.
   The layers are lined up (each moved by its nudge) into buffers of one length, so they loop
   together. Looping repeats the whole recording, or from A to B.
   The studio's voice recorder plays and records with it too (/studio/record/tracks.js). */

let shared = null;

/** What a layer is: 'inst' (an accompaniment: a recording's instruments are choices, one at a
    time), 'voice', or 'other'. Layers from before kinds go by their name. */
export function kindOf(l) {
  if (l.kind === 'inst' || l.kind === 'voice' || l.kind === 'other') return l.kind;
  const n = String(l.name || '');
  if (/voice|vocal|sing/i.test(n)) return 'voice';
  if (/instrument|piano|guitar|uke|ukulele|bass|drum|violin|cello|accomp|keys|band/i.test(n)) return 'inst';
  return 'other';
}

/** The class app's one AudioContext, woken up. */
export function audioContext() {
  if (!shared) shared = new (window.AudioContext || window.webkitAudioContext)();
  if (shared.state === 'suspended') shared.resume().catch(() => {});
  return shared;
}

/** Decodes a recording's layers that have audio: [{ ...layer, buffer }]. blobOf(hash) -> Blob. */
export async function decodeLayers(layers, blobOf, ctx = audioContext()) {
  const out = [];
  for (const l of layers || []) {
    if (!l.media) continue;
    const blob = await blobOf(l.media);
    if (!blob) continue;
    const bytes = await blob.arrayBuffer();
    const buffer = await new Promise((ok, fail) => ctx.decodeAudioData(bytes, ok, fail));
    out.push({ ...l, buffer });
  }
  return out;
}

/** nudge: milliseconds later (or earlier, below 0) than recorded. */
function align(ctx, layers) {
  const sr = ctx.sampleRate;
  const shift = (l) => Math.round((Number(l.nudge) || 0) / 1000 * sr);
  const len = Math.max(1, ...layers.map((l) => l.buffer.length + shift(l)));
  return layers.map((l) => {
    const b = ctx.createBuffer(1, len, sr);
    const src = l.buffer.getChannelData(0);
    const dst = b.getChannelData(0);
    const s = shift(l);
    if (s >= 0) dst.set(src.subarray(0, len - s), s);
    else dst.set(src.subarray(Math.min(-s, src.length)));
    return { ...l, buffer: b };
  });
}

export class Mixer {
  /** layers: from decodeLayers. Each starts on, at its own level (vol, 0 to 1). */
  constructor(layers, ctx = audioContext()) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.layers = align(ctx, layers).map((l) => {
      const gain = ctx.createGain();
      gain.gain.value = l.vol ?? 1;
      gain.connect(this.master);
      return { ...l, gain, on: true, level: l.vol ?? 1 };
    });
    this.duration = this.layers.length ? this.layers[0].buffer.duration : 0;
    this.sources = [];
    this.playing = false;
    this.from = 0;                         // where playing started, or where it's paused
    this.startedAt = 0;                    // context time it started
    this.loop = false;
    this.a = null;                         // loop start, or null: the beginning
    this.b = null;                         // loop end, or null: the end
    this.onend = null;
  }

  get loopStart() { return this.a ?? 0; }
  get loopEnd() { return this.b ?? this.duration; }

  /** Seconds into the recording now. */
  position() {
    if (!this.playing) return this.from;
    let p = this.from + Math.max(0, this.ctx.currentTime - this.startedAt);
    const end = this.loopEnd;
    if (this.loop && this.from < end && p >= end) p = this.loopStart + ((p - end) % Math.max(0.01, end - this.loopStart));
    return Math.min(p, this.duration);
  }

  /** Plays from `from` seconds, at context time `when` (soon, when left out). */
  play(from = this.position(), when = 0) {
    this.halt();
    if (this.loop && (from >= this.loopEnd || from < 0)) from = this.loopStart;
    if (from >= this.duration - 0.01) from = this.loop ? this.loopStart : 0;
    const t = Math.max(when, this.ctx.currentTime + 0.03);
    for (const l of this.layers) {
      const s = this.ctx.createBufferSource();
      s.buffer = l.buffer;
      s.loop = this.loop;
      s.loopStart = this.loopStart;
      s.loopEnd = this.loopEnd;
      s.connect(l.gain);
      s.start(t, from);
      this.sources.push(s);
    }
    const first = this.sources[0];
    if (first) first.onended = () => {
      if (this.sources[0] !== first) return;
      this.sources = [];
      this.playing = false;
      this.from = 0;
      if (this.onend) this.onend();
    };
    this.from = from;
    this.startedAt = t;
    this.playing = true;
  }

  pause() {
    this.from = this.position();
    this.halt();
    this.playing = false;
  }

  stop() {
    this.halt();
    this.playing = false;
    this.from = 0;
  }

  seek(t) {
    t = Math.max(0, Math.min(this.duration, t));
    if (this.playing) this.play(t); else this.from = t;
  }

  /** Loop on or off, from a to b (null: the start, the end). */
  setLoop(on, a = this.a, b = this.b) {
    if (a != null && b != null && b < a) [a, b] = [b, a];
    if (a != null && b != null && b - a < 0.05) b = null;
    this.loop = on;
    this.a = a;
    this.b = b;
    if (this.playing) this.play(this.position());
  }

  /** 0 to 1, heard as an even step up. */
  setVolume(v) {
    this.master.gain.setTargetAtTime(Math.max(0, v) ** 2, this.ctx.currentTime, 0.02);
  }

  setLayer(i, on) {
    const l = this.layers[i];
    if (!l) return;
    l.on = on;
    l.gain.gain.setTargetAtTime(on ? l.level : 0, this.ctx.currentTime, 0.015);
  }

  setLevel(i, v) {
    const l = this.layers[i];
    if (!l) return;
    l.level = v;
    if (l.on) l.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015);
  }

  halt() {
    for (const s of this.sources) {
      s.onended = null;
      try { s.stop(); } catch (e) { /* not started */ }
    }
    this.sources = [];
  }

  dispose() {
    this.stop();
    this.master.disconnect();
  }
}
