/* Syllable onsets from the mic, found on the audio thread so every sample is looked at
   and each onset is dated to the sample block it starts in.

   The level (dB, in 2.7 ms blocks) is smoothed into an envelope. A syllable starts when the
   envelope climbs well above the room's noise floor and stays up long enough to be a voice,
   not a click. Joined syllables ("du-de") don't go quiet between them: inside a syllable a
   new one starts only after a real dip (the "d") followed by a real rise, and never sooner
   than minGap after the last. The wobble inside a held vowel is too small to count. */

const DB_MIN = -100;

class SyllableDetector {
  constructor(rate) {
    this.rate = rate;
    this.floor = -60; // noise floor, dB
    this.env = DB_MIN;
    this.state = 'quiet'; // quiet | rising | voiced
    this.riseStart = 0;
    this.risePeak = DB_MIN;
    this.peak = DB_MIN; // highest point since the last onset or valley
    this.valley = 0; // lowest point of the current dip
    this.dipped = false;
    this.last = -1;
    this.minGap = 0.11; // s, set from the tempo
    this.level = 0;
    this.age = 0; // s since start: the floor is learned fast at first
    this.stir = 0; // when the level last left the floor, for dating onsets
  }

  /* One block of samples starting at audio time t. Returns an onset time or null. */
  block(samples, t) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);
    const db = rms > 1e-5 ? 20 * Math.log10(rms) : DB_MIN;
    const dt = samples.length / this.rate;
    // Fast up, slower down: the envelope follows attacks and smooths pitch ripple.
    const k = db > this.env ? 1 - Math.exp(-dt / 0.004) : 1 - Math.exp(-dt / 0.025);
    this.env += (db - this.env) * k;
    const env = this.env;
    this.level = Math.max(0, Math.min(1, (env - this.floor) / 45));

    // Noise floor: falls quickly to quiet moments, creeps up slowly through loud ones.
    this.age += dt;
    if (this.state === 'quiet') {
      const tau = this.age < 0.5 ? 0.05 : env < this.floor ? 0.3 : 4;
      this.floor += (env - this.floor) * (1 - Math.exp(-dt / tau));
      this.floor = Math.max(-80, Math.min(-25, this.floor));
    }
    const on = Math.max(this.floor + 13, -60); // voice
    const off = on - 6; // back to quiet

    let onset = null;
    if (this.age < 0.5) return null;
    if (this.state === 'quiet') {
      if (env < this.floor + 6) this.stir = t + dt;
      if (env > on) {
        this.state = 'rising';
        this.riseStart = Math.max(this.stir, t - 0.03);
        this.risePeak = env;
      }
    } else if (this.state === 'rising') {
      this.risePeak = Math.max(this.risePeak, env);
      if (env < off) this.state = 'quiet';
      else if (t - this.riseStart >= 0.03) {
        // Up for 30 ms and clearly loud: a syllable, dated to where it began.
        if (this.risePeak > on + 3 && this.riseStart - this.last >= this.minGap) onset = this.riseStart;
        this.state = 'voiced';
        this.peak = this.risePeak;
        this.dipped = false;
      }
    } else {
      if (env < off) {
        this.state = 'quiet';
      } else if (!this.dipped) {
        this.peak = Math.max(this.peak, env);
        if (env < this.peak - 9) { this.dipped = true; this.valley = env; this.stir = t; }
      } else {
        if (env < this.valley) { this.valley = env; this.stir = t; }
        if (env < this.valley + 2) this.stir = t;
        if (env > this.valley + 7) {
          if (this.stir - this.last >= this.minGap) onset = this.stir;
          this.dipped = false;
          this.peak = env;
        }
      }
    }
    if (onset != null) this.last = onset;
    return onset;
  }
}

if (typeof registerProcessor === 'function') {
  registerProcessor('syllables', class extends AudioWorkletProcessor {
    constructor() {
      super();
      this.d = new SyllableDetector(sampleRate);
      this.sent = 0;
      this.port.onmessage = (e) => { if (e.data?.minGap) this.d.minGap = e.data.minGap; };
    }

    process(inputs) {
      const ch = inputs[0]?.[0];
      if (ch) {
        const t = currentTime;
        const onset = this.d.block(ch, t);
        if (onset != null) this.port.postMessage({ onset });
        if (t - this.sent > 0.03) { this.sent = t; this.port.postMessage({ level: this.d.level }); }
      }
      return true;
    }
  });
}

if (typeof module === 'object') module.exports = { SyllableDetector };
