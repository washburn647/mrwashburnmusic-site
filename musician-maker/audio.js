/* Sounds, made in the browser with Web Audio: no recordings, nothing loaded.
   Everything is scheduled on the audio clock, so rhythms stay steady and taps
   can be compared against the same clock. */
window.LP = window.LP || {};
LP.snd = (function () {
  'use strict';

  let ctx = null;
  let out = null;

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      ctx = new C();
      out = ctx.createGain();
      out.gain.value = 0.9;
      out.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function now() { return ac().currentTime; }

  // How long after a scheduled time the sound actually reaches the ears.
  function latency() {
    ac();
    return (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  }

  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // The pattern sound: a short woodblock.
  function block(t, vol) {
    ac();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1150, t);
    o.frequency.exponentialRampToValueAtTime(720, t + 0.05);
    env(g, t, vol || 0.8, 0.003, 0.12);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.16);
  }

  // The steady beat underneath.
  function tick(t, accent, vol) {
    ac();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(accent ? 2400 : 1900, t);
    env(g, t, (vol || 0.06) * (accent ? 1.4 : 1), 0.002, 0.035);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.05);
  }

  // A soft sung-sounding tone.
  function tone(freq, t, dur, vol) {
    ac();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq * 4;
    const peak = vol || 0.22;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.03);
    g.gain.setValueAtTime(peak, t + Math.max(0.04, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [['triangle', 1, 1], ['sine', 2, 0.25]].forEach(function (p) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = p[0];
      o.frequency.value = freq * p[1];
      og.gain.value = p[2];
      o.connect(og); og.connect(f);
      o.start(t); o.stop(t + dur + 0.02);
    });
    f.connect(g); g.connect(out);
  }

  function chord(freqs, t, dur) {
    freqs.forEach(function (fr) { tone(fr, t, dur, 0.09); });
  }

  function yes() {
    const t = now() + 0.02;
    tone(784, t, 0.12, 0.12);
    tone(1175, t + 0.1, 0.22, 0.12);
  }

  function no() {
    const t = now() + 0.02;
    tone(330, t, 0.14, 0.1);
    tone(262, t + 0.12, 0.24, 0.1);
  }

  return { ac, now, latency, block, tick, tone, chord, yes, no };
})();
