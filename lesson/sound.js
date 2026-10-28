/* Sounds made in the browser with Web Audio: nothing is loaded or recorded.
   Everything is scheduled on the audio clock so rhythms stay steady. */

let ctx = null;
let out = null;

export function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    out = ctx.createGain();
    out.gain.value = 0.8;
    out.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const now = () => ac().currentTime;

/* A gain node to group voices (one per part), so parts can be muted and mixed. */
export function bus(level = 1) {
  ac();
  const g = ctx.createGain();
  g.gain.value = level;
  g.connect(out);
  return g;
}

export const midiFreq = (m) => 440 * 2 ** ((m - 69) / 12);

/* A plucked, piano-like tone. Returns a function that stops it early. */
export function note(midi, t, dur, { vol = 0.25, dest } = {}) {
  ac();
  const f = midiFreq(midi);
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(f * 8, 12000), t);
  lp.frequency.exponentialRampToValueAtTime(Math.min(f * 3, 8000), t + 0.4);
  // Lower notes ring longer, like a piano.
  const ring = Math.max(0.6, Math.min(3, 2.5 - (midi - 48) / 30));
  const end = t + Math.min(dur, ring) + 0.12;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.25);
  g.gain.exponentialRampToValueAtTime(vol * 0.12, t + ring);
  g.gain.setTargetAtTime(0.0001, Math.max(t + 0.05, end - 0.12), 0.03);
  const oscs = [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 3, 0.12]].map(([type, mult, level]) => {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = type;
    o.frequency.value = f * mult;
    og.gain.value = level;
    o.connect(og);
    og.connect(lp);
    o.start(t);
    o.stop(end + 0.05);
    return o;
  });
  lp.connect(g);
  g.connect(dest || out);
  return () => {
    const n = ctx.currentTime;
    g.gain.cancelScheduledValues(n);
    g.gain.setTargetAtTime(0.0001, n, 0.02);
    oscs.forEach((o) => { try { o.stop(n + 0.1); } catch { /* already stopped */ } });
  };
}

/* Metronome click. */
export function click(t, accent = false, vol = 0.35) {
  ac();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(accent ? 2000 : 1500, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol * (accent ? 1 : 0.6), t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + 0.06);
}

/* Woodblock, for rhythms. */
export function block(t, vol = 0.7) {
  ac();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(1150, t);
  o.frequency.exponentialRampToValueAtTime(720, t + 0.05);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + 0.16);
}

export function yes() {
  const t = now() + 0.02;
  note(79, t, 0.15, { vol: 0.14 });
  note(86, t + 0.09, 0.3, { vol: 0.14 });
}

export function no() {
  const t = now() + 0.02;
  note(52, t, 0.18, { vol: 0.12 });
  note(48, t + 0.13, 0.3, { vol: 0.12 });
}

export function fanfare() {
  const t = now() + 0.02;
  [72, 76, 79, 84].forEach((m, i) => note(m, t + i * 0.1, i === 3 ? 0.8 : 0.15, { vol: 0.13 }));
}
