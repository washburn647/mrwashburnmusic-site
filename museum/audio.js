/* Sound for the museum: the site's recorded instruments (/assets/sounds/), played so they can
   change while they sound. A plucked or struck note can still bend (a timpani pedal); a held
   note (bow, breath) loops its steady part for as long as it is held, follows the pitch as a
   finger slides, and changes level with bow speed or breath. */

import * as samples from '../assets/sounds/samples.js';

let ac = null;
let master = null;

export function context() {
  if (!ac) {
    // Play even when an iPhone or iPad is set to silent, like a music app.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older browsers */ }
    ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ac.createGain();
    master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    // A little room, so dry samples sound like they are in a hall.
    const verb = ac.createConvolver();
    verb.buffer = room(ac, 1.8);
    const send = ac.createGain();
    send.gain.value = 0.16;
    master.connect(comp);
    master.connect(send);
    send.connect(verb);
    verb.connect(comp);
    comp.connect(ac.destination);
    samples.setup(ac, master);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

export const now = () => context().currentTime;
export const out = () => (context(), master);

function room(c, seconds) {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / c.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.2) * (t < 0.012 ? t / 0.012 : 1);
    }
  }
  return b;
}

// Browsers start sound only after a tap or key press.
['pointerdown', 'keydown', 'touchend'].forEach((e) => addEventListener(e, () => context(), { capture: true, passive: true }));

const rateFor = (z, midi) => 2 ** ((midi - z.midi - z.tune / 100) / 12);
const nearestZone = (zones, midi) => zones.reduce((a, b) => (Math.abs(b.midi - midi) < Math.abs(a.midi - midi) ? b : a));

/* A copy of a sample whose middle loops without a click: the end of the loop is cross-faded
   into what comes just before its start. */
const loops = new WeakMap();
function looped(s, { from = 0.7, to = 0.6, fade = 0.22 } = {}) {
  if (loops.has(s.buffer)) return loops.get(s.buffer);
  const b = s.buffer;
  const sr = b.sampleRate;
  const a = Math.floor((s.start + from) * sr);
  const e = Math.floor((b.duration - to) * sr);
  const x = Math.min(Math.floor(fade * sr), Math.floor((e - a) / 3), a);
  let result;
  if (e - a < sr * 0.3 || x < 64) {
    result = { buffer: b, loopStart: s.start + from, loopEnd: b.duration - 0.05 };
  } else {
    const copy = context().createBuffer(1, b.length, sr);
    const src = b.getChannelData(0);
    const dst = copy.getChannelData(0);
    dst.set(src);
    for (let i = 0; i < x; i++) {
      const w = (i + 1) / x;
      dst[e - x + i] = src[e - x + i] * Math.cos(w * Math.PI / 2) + src[a - x + i] * Math.sin(w * Math.PI / 2);
    }
    result = { buffer: copy, loopStart: a / sr, loopEnd: e / sr };
  }
  loops.set(s.buffer, result);
  return result;
}

const cache = new Map();

/* A pitched instrument from /assets/sounds/, loaded for lo..hi. */
export function pitched(name, lo, hi) {
  const key = `${name}:${lo}:${hi}`;
  if (!cache.has(key)) cache.set(key, samples.raw(name, { lo, hi }).then((spec) => new Pitched(spec)));
  return cache.get(key);
}

/* A hit (drum, cymbal). */
export function hit(name) {
  if (!cache.has(name)) cache.set(name, samples.raw(name).then((s) => new Hit(s)));
  return cache.get(name);
}

class Pitched {
  constructor(spec) {
    this.zones = spec.zones;
    this.release = spec.release || 0.2;
  }

  zone(midi) { return nearestZone(this.zones, midi); }

  /* Play a note from its start. Gives { bend(midi), stop(release) }. */
  play(midi, { vol = 0.8, at = 0, dest, dur = null } = {}) {
    const c = context();
    const t = Math.max(at, c.currentTime);
    const z = this.zone(midi);
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = z.buffer;
    src.playbackRate.value = rateFor(z, midi);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    src.connect(g);
    g.connect(dest || master);
    src.start(t, z.start);
    const stop = (release = this.release) => {
      const n = c.currentTime;
      g.gain.cancelScheduledValues(n);
      g.gain.setValueAtTime(g.gain.value, n);
      g.gain.setTargetAtTime(0, n, release / 3);
      try { src.stop(n + release * 2 + 0.05); } catch { /* done */ }
    };
    if (dur != null) {
      g.gain.setTargetAtTime(0, t + dur, this.release / 3);
      src.stop(t + dur + this.release * 2 + 0.05);
    }
    return {
      bend: (m, glide = 0.03) => src.playbackRate.setTargetAtTime(rateFor(z, m), c.currentTime, glide),
      stop,
      gain: g,
    };
  }

  /* A note held as long as you like (bow, breath). */
  sustain(opts) { return new Sustain(this, opts); }
}

class Sustain {
  constructor(inst, { attack = 0.05, release = 0.12, glide = 0.012, dest } = {}) {
    const c = context();
    this.inst = inst;
    this.attack = attack;
    this.release = release;
    this.glide = glide;
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest || master);
    this.cur = null;
    this.midi = 60;
    this.on = false;
  }

  source(z, offset, fadeIn) {
    const c = context();
    const l = looped(z);
    const src = c.createBufferSource();
    src.buffer = l.buffer;
    src.loop = true;
    src.loopStart = l.loopStart;
    src.loopEnd = l.loopEnd;
    src.playbackRate.value = rateFor(z, this.midi);
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(fadeIn ? 0 : 1, t);
    if (fadeIn) g.gain.linearRampToValueAtTime(1, t + fadeIn);
    src.connect(g);
    g.connect(this.out);
    src.start(t, offset == null ? z.start : offset);
    return { src, g, z };
  }

  drop(voice, fade = 0.06) {
    if (!voice) return;
    const t = context().currentTime;
    voice.g.gain.cancelScheduledValues(t);
    voice.g.gain.setValueAtTime(voice.g.gain.value, t);
    voice.g.gain.linearRampToValueAtTime(0, t + fade);
    try { voice.src.stop(t + fade + 0.02); } catch { /* done */ }
  }

  /* Start sounding (or re-tongue / re-bow when already sounding). */
  start(midi, level = 0.8, { attack = this.attack, fresh = true } = {}) {
    const c = context();
    const t = c.currentTime;
    this.midi = midi;
    const z = this.inst.zone(midi);
    if (this.on && this.cur && !fresh) {
      this.pitch(midi);
    } else {
      const old = this.cur;
      this.cur = this.source(z, fresh ? z.start : looped(z).loopStart, old ? 0.012 : 0);
      this.drop(old, 0.03);
    }
    this.on = true;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.setTargetAtTime(level, t, attack / 3);
  }

  /* Follow a new pitch without a new attack: a slide, a slur, a vibrato. */
  pitch(midi, glide = this.glide) {
    this.midi = midi;
    if (!this.cur) return;
    const c = context();
    const z = this.inst.zone(midi);
    if (z !== this.cur.z && Math.abs(midi - this.cur.z.midi) > Math.abs(midi - z.midi) + 0.8) {
      const old = this.cur;
      const l = looped(z);
      // Join the new sample in its steady part, at the same place in its loop.
      const through = (context().currentTime % (l.loopEnd - l.loopStart));
      this.cur = this.source(z, l.loopStart + through, 0.05);
      this.drop(old, 0.05);
    } else {
      this.cur.src.playbackRate.setTargetAtTime(rateFor(this.cur.z, midi), c.currentTime, glide);
    }
  }

  level(v, time = 0.03) {
    const t = context().currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.setTargetAtTime(v, t, time / 3);
  }

  stop(release = this.release) {
    if (!this.on) return;
    this.on = false;
    const t = context().currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.setTargetAtTime(0, t, release / 3);
    const v = this.cur;
    this.cur = null;
    if (v) try { v.src.stop(t + release * 3 + 0.05); } catch { /* done */ }
  }
}

class Hit {
  constructor(s) { this.s = s; }

  /* Play it. { loop: true } keeps a roll going until stop(). */
  play({ vol = 0.8, rate = 1, at = 0, dest, loop = false, filter = null } = {}) {
    const c = context();
    const t = Math.max(at, c.currentTime);
    const src = c.createBufferSource();
    const g = c.createGain();
    if (loop) {
      const l = looped(this.s, { from: 0.5, to: 0.7, fade: 0.3 });
      src.buffer = l.buffer;
      src.loop = true;
      src.loopStart = l.loopStart;
      src.loopEnd = l.loopEnd;
    } else {
      src.buffer = this.s.buffer;
    }
    src.playbackRate.value = rate;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + (loop ? 0.04 : 0.002));
    let tail = g;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      g.connect(f);
      tail = f;
    }
    src.connect(g);
    tail.connect(dest || master);
    src.start(t, this.s.start);
    return {
      stop: (release = 0.08) => {
        const n = c.currentTime;
        g.gain.cancelScheduledValues(n);
        g.gain.setValueAtTime(g.gain.value, n);
        g.gain.setTargetAtTime(0, n, release / 3);
        try { src.stop(n + release * 3 + 0.05); } catch { /* done */ }
      },
      level: (v, time = 0.05) => g.gain.setTargetAtTime(v, c.currentTime, time / 3),
      rate: (r, glide = 0.05) => src.playbackRate.setTargetAtTime(r, c.currentTime, glide),
    };
  }
}
