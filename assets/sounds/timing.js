/* How well a recorded take keeps the beat. The voice recorder (/studio/record/) measures each
   take, flags the ones that need a listen, and publishes what it measured with the take.
     const t = timing(samples, sampleRate, pattern, bpm);
     // { tempo: 95.1, off: 0.06, lead: 0.01 }, or null when it can't find every syllable
   It finds where each syllable starts (the rises in a spectrum, so "du de" counts as two even
   without a gap) and lines them up with where the pattern puts them:
     tempo  the bpm the take was really sung at, fitted to every syllable. Takes drift (slow
            ones rush, fast ones drag), so samples.js plays a take at this tempo rather than
            the count-in's, and the drift is gone in the game.
     off    the worst syllable still off the beat after that, in beats.
     lead   seconds from the first sound to the first syllable (a breath, the "m" of a hum).
            samples.js starts the take that much early, so the syllable lands on the beat.
   offbeat() says when a take needs a listen: a syllable more than LIMIT of a beat off, or no
   tempo that can be trusted. Those play as before, at the count-in's tempo. */

// Where each cell's syllables fall, in beats from the cell's start. Every cell is one beat.
const CELLS = {
  q: [0], ee: [0, 0.5], // 2/4
  dq: [0], eee: [0, 1 / 3, 2 / 3], qe: [0, 2 / 3], // 6/8, a beat is a dotted quarter
};

export const LIMIT = 0.12; // beats

export function grid(p) {
  if (p?.kind === 'rhythm') {
    if (!p.cells.every((c) => CELLS[c])) return null;
    return p.cells.flatMap((c, i) => CELLS[c].map((d) => i + d));
  }
  if (p?.kind === 'tonal') return p.tones.map((_, i) => i);
  return null;
}

export const offbeat = (t, bpm) => !t || t.off > LIMIT || Math.abs(Math.log(t.tempo / bpm)) > 0.12;

/* What the site plays a take with, when the measure can be trusted: { tempo, lead }. A tonal
   take keeps its tempo, since playing it faster would also play it sharp. */
export function forSite(t, p, bpm) {
  if (offbeat(t, bpm)) return {};
  return { ...(p.kind === 'rhythm' ? { tempo: t.tempo } : {}), ...(t.lead > 0.04 ? { lead: t.lead } : {}) };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    const wr = Math.cos(a);
    const wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k;
        const q = p + len / 2;
        const tr = re[q] * cr - im[q] * ci;
        const ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr;
        im[q] = im[p] - ti;
        re[p] += tr;
        im[p] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/* Spectral flux, one value per hop: how much louder each frequency got. */
function flux(x, sr, hop) {
  let win = 256;
  while (win < 0.04 * sr) win <<= 1;
  const hann = Float32Array.from({ length: win }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1)));
  const frames = Math.ceil(x.length / hop);
  const out = new Float32Array(frames);
  const re = new Float32Array(win);
  const im = new Float32Array(win);
  let prev = null;
  for (let f = 0; f < frames; f++) {
    const at = f * hop - win / 2;
    for (let i = 0; i < win; i++) {
      const j = at + i;
      re[i] = j >= 0 && j < x.length ? x[j] * hann[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
    const mag = new Float32Array(win / 2 + 1);
    let sum = 0;
    for (let k = 0; k <= win / 2; k++) {
      mag[k] = Math.log1p(100 * Math.hypot(re[k], im[k]));
      if (prev) sum += Math.max(0, mag[k] - prev[k]);
    }
    out[f] = sum;
    prev = mag;
  }
  const smooth = new Float32Array(frames);
  for (let f = 0; f < frames; f++) smooth[f] = (out[f] + (out[f - 1] || 0) + (out[f + 1] || 0)) / 3;
  return smooth;
}

// The first sound, as samples.js finds it to start a take.
function start(x, sr) {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > peak * 0.05) return Math.max(0, i / sr - 0.001);
  return 0;
}

export function timing(x, sr, p, bpm) {
  const g = grid(p);
  if (!g || !bpm) return null;
  const beat = 60 / bpm;
  const hop = Math.round(sr / 200);
  const f = flux(x, sr, hop);
  // The strongest rises, at least 0.3 beat apart, as many as the pattern has syllables.
  const peaks = [];
  for (let i = 1; i < f.length - 1; i++) if (f[i] > 0 && f[i] >= f[i - 1] && f[i] > f[i + 1]) peaks.push(i);
  peaks.sort((a, b) => f[b] - f[a]);
  const gap = (0.3 * beat * sr) / hop;
  const chosen = [];
  for (const i of peaks) {
    if (chosen.every((j) => Math.abs(i - j) >= gap)) chosen.push(i);
    if (chosen.length === g.length) break;
  }
  if (chosen.length < g.length) return null;
  const on = chosen.sort((a, b) => a - b).map((i) => (i * hop) / sr);
  const rel = on.map((t) => t - on[0]);
  let num = 0;
  let den = 0;
  g.forEach((b, i) => { num += b * rel[i]; den += b * b; });
  const k = num / den; // seconds per beat
  const off = Math.max(...g.map((b, i) => Math.abs(rel[i] - k * b) / k));
  const r = (v) => Math.round(v * 1000) / 1000;
  return { tempo: Math.round((600 / k)) / 10, off: r(off), lead: r(Math.max(0, on[0] - start(x, sr))) };
}
