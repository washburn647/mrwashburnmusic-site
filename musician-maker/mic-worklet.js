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
    this.riseStart = 0; // where the syllable began (dated back to where the level left the floor)
    this.riseAt = 0; // when the level crossed into voice
    this.lastPeak = DB_MIN; // the last syllable's loudest point
    this.endAt = -9; // when the last syllable went quiet
    this.echoDrop = 10; // dB: a much quieter sound just after a syllable is its tail or echo
    this.pend = null; // a rise after a dip, waiting to show it's a new syllable
    this.hist = []; // the envelope over the last attackWin seconds: [t, dB]
    this.attack = 12; // dB: a rise this big this fast is a new syllable, dip or no dip
    this.attackWin = 0.06; // s
    this.risePeak = DB_MIN;
    this.peak = DB_MIN; // highest point since the last onset or valley
    this.valley = 0; // lowest point of the current dip
    this.dipped = false;
    this.last = -1;
    this.minGap = 0.11; // s, set from the tempo
    this.dip = 6; // dB below the syllable's peak that counts as a dip (the "d")
    this.deepDip = 9; // dB: a dip this deep is a clear break between syllables
    this.near = 3; // dB: after a shallower one, the voice must come back this close to its peak
    this.rise = 5; // dB back up out of a dip that starts a new syllable
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
    const hist = this.hist;
    hist.push([t, env]);
    while (hist.length && hist[0][0] < t - this.attackWin) hist.shift();
    if (this.age < 0.5) return null;
    if (this.state === 'quiet') {
      if (env < this.floor + 6) this.stir = t + dt;
      if (env > on) {
        this.state = 'rising';
        this.riseAt = t;
        this.riseStart = Math.max(this.stir, t - 0.03);
        this.risePeak = env;
      }
    } else if (this.state === 'rising') {
      this.risePeak = Math.max(this.risePeak, env);
      if (env < off) this.state = 'quiet';
      else if (t - this.riseAt >= 0.03) {
        // Up for 30 ms and clearly loud: a syllable, dated to where it began.
        // Just after a syllable, a much quieter sound is that syllable's tail coming back
        // (the room, or the echo canceller letting go), not a new one.
        const tail = this.riseStart - this.endAt < 0.25 && this.risePeak < this.lastPeak - this.echoDrop;
        if (this.risePeak > on + 3 && this.riseStart - this.last >= this.minGap && !tail) onset = this.riseStart;
        if (!tail) this.lastPeak = this.risePeak;
        this.state = 'voiced';
        this.peak = this.risePeak;
        this.dipped = false;
      }
    } else {
      if (env > this.lastPeak) this.lastPeak = env;
      if (env < off) {
        this.state = 'quiet';
        this.endAt = t;
        this.pend = null;
      } else if (this.attackFrom(t, env)) {
        // A sharp jump while the level never fell to quiet (the call or the band still
        // in the room, a "bum" running into the next): a new syllable starts here.
        // Like a rise after a dip, it counts once it gets near the last syllable's level.
        // A rise already waiting (after a dip) keeps its own start and level to reach.
        this.pend ||= { start: this.stir, at: t, need: this.peak - this.echoDrop };
        this.dipped = false;
        this.peak = env;
      } else if (!this.dipped) {
        this.peak = Math.max(this.peak, env);
        // A rise after a dip is a new syllable once it gets near the last one's level;
        // one that stays well below it is that syllable's tail, not a "de".
        const p = this.pend;
        if (p && env >= p.need) {
          if (p.start - this.last >= this.minGap) onset = p.start;
          this.pend = null;
        } else if (p && t - p.at > 0.08) this.pend = null;
        if (env < this.peak - this.dip) { this.dipped = true; this.valley = env; this.stir = t; }
      } else {
        if (env < this.valley) { this.valley = env; this.stir = t; }
        if (env < this.valley + 2) this.stir = t;
        if (env > this.valley + this.rise) {
          // A shallow dip (a soft "d", the "m" of a "bum") counts only if the voice comes
          // back up near where it was: a vowel fading with a wobble doesn't.
          const deep = this.peak - this.valley >= this.deepDip;
          this.pend = { start: this.stir, at: t, need: this.peak - (deep ? this.echoDrop : this.near) };
          this.dipped = false;
          this.peak = env;
        }
      }
    }
    if (onset != null) this.last = onset;
    return onset;
  }

  /* Did the envelope just jump by `attack` dB within attackWin? Sets stir to where it began. */
  attackFrom(t, env) {
    let lo = Infinity;
    let at = t;
    for (const [ht, he] of this.hist) if (he < lo) { lo = he; at = ht; }
    if (env - lo < this.attack) return false;
    // Date it to where the rise left the low point.
    for (const [ht, he] of this.hist) if (ht >= at && he < lo + 3) this.stir = ht;
    this.hist = [[t, env]];
    return true;
  }
}

if (typeof registerProcessor === 'function') {
  registerProcessor('syllables', class extends AudioWorkletProcessor {
    constructor() {
      super();
      this.d = new SyllableDetector(sampleRate);
      this.sent = 0;
      this.rec = null; // Test mode: the mic's samples, sent in chunks with their start time
      this.port.onmessage = (e) => {
        if (e.data?.minGap) this.d.minGap = e.data.minGap;
        if (e.data?.rec === true) this.rec = { buf: new Float32Array(8192), n: 0, t: 0 };
        if (e.data?.rec === false) { this.flush(); this.rec = null; }
      };
    }

    flush() {
      const r = this.rec;
      if (!r?.n) return;
      this.port.postMessage({ pcm: r.buf.slice(0, r.n), t: r.t });
      r.n = 0;
    }

    process(inputs) {
      const ch = inputs[0]?.[0];
      if (ch) {
        const t = currentTime;
        const onset = this.d.block(ch, t);
        const r = this.rec;
        if (r) {
          if (!r.n) r.t = t;
          r.buf.set(ch, r.n);
          r.n += ch.length;
          if (r.n + ch.length > r.buf.length) this.flush();
        }
        if (onset != null) this.port.postMessage({ onset });
        if (t - this.sent > 0.03) { this.sent = t; this.port.postMessage({ level: this.d.level }); }
      }
      return true;
    }
  });
}

if (typeof module === 'object') module.exports = { SyllableDetector };
