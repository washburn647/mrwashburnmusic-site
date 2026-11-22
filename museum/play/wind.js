/* Flute, clarinet, oboe, saxophone, bassoon. The keys sit where the fingers go on the real instrument:
   left hand nearer the mouthpiece, right hand farther down, thumbs underneath. Hold the
   mouthpiece to blow (the lock keeps the air going). Change fingers while blowing to slur.
   On the flute, blowing higher on the lip plate overblows to the next octave; the clarinet's
   register key jumps a twelfth; the sax and oboe have an octave key. The bassoon's thumb keys
   reach its lowest notes (F, and E with the pinky), and its flick key, like an octave key,
   lifts the same fingers to the next register.
   On a computer: F D S A are the left hand's fingers and pinky, J K L ; the right hand's,
   V the thumb key, B the clarinet's register key, Space blows, Shift overblows the flute.
   A click on a key presses it until the next click. */

import { surface, rr, label, fine } from '../surface.js';
import { pitched } from '../audio.js';
import { wood, metal, pin, pool, layer, put } from '../paint.js';

/* Keys: id, where along the body (0 mouthpiece end .. 1 bell), side (-1 above, 0 on, 1 below),
   size (1 = a finger hole), computer key. */
const KEYSETS = {
  flute: [
    ['T', 0.31, 1, 0.8, 'v'],
    ['L1', 0.33, 0, 1, 'f'], ['L2', 0.42, 0, 1, 'd'], ['L3', 0.51, 0, 1, 's'], ['Lp', 0.56, -1, 0.6, 'a'],
    ['R1', 0.65, 0, 1, 'j'], ['R2', 0.74, 0, 1, 'k'], ['R3', 0.83, 0, 1, 'l'], ['Rp', 0.9, -1, 0.6, ';'],
  ],
  clarinet: [
    ['Rg', 0.25, 1, 0.55, 'b'], ['T', 0.32, 1, 0.8, 'v'], ['A', 0.27, -1, 0.55, 'r'], ['Gs', 0.33, -1, 0.5, 'e'],
    ['L1', 0.36, 0, 1, 'f'], ['L2', 0.45, 0, 1, 'd'], ['L3', 0.54, 0, 1, 's'], ['Lp', 0.6, 1, 0.6, 'a'],
    ['R1', 0.67, 0, 1, 'j'], ['R2', 0.76, 0, 1, 'k'], ['R3', 0.85, 0, 1, 'l'], ['Rp', 0.92, 1, 0.6, ';'],
  ],
  oboe: [
    ['Oct', 0.28, 1, 0.6, 'v'],
    ['L1', 0.33, 0, 1, 'f'], ['L2', 0.42, 0, 1, 'd'], ['L3', 0.51, 0, 1, 's'], ['Lp', 0.56, -1, 0.6, 'a'],
    ['R1', 0.65, 0, 1, 'j'], ['R2', 0.74, 0, 1, 'k'], ['R3', 0.83, 0, 1, 'l'], ['Eb', 0.9, 1, 0.6, ';'], ['C', 0.9, -1, 0.6, '\''],
  ],
};
// The saxophone's two right pinky keys sit side by side under the bow, as on a real one, which
// leaves room above for the bell turning up.
KEYSETS.sax = KEYSETS.oboe.map((k) => (k[0] === 'Eb' ? ['Eb', 0.87, 1, 0.6, ';'] : k[0] === 'C' ? ['C', 0.94, 1, 0.6, '\''] : k));
KEYSETS.bassoon = [
  ['Oct', 0.28, 1, 0.6, 'v'],
  ['L1', 0.33, 0, 1, 'f'], ['L2', 0.42, 0, 1, 'd'], ['L3', 0.51, 0, 1, 's'],
  ['R1', 0.65, 0, 1, 'j'], ['R2', 0.74, 0, 1, 'k'], ['R3', 0.83, 0, 1, 'l'],
  ['Ft', 0.7, 1, 0.65, 'n'], ['E', 0.78, 1, 0.55, 'm'], ['Ab', 0.9, -1, 0.6, ';'],
];

/* Fingerings: keys pressed -> written note. */
const F = (list) => list.map(([k, m]) => [new Set(k.split(' ').filter(Boolean)), m]);
const FINGERINGS = {
  flute: F([
    ['T L1 L2 L3 R1 R2 R3', 62], ['T L1 L2 L3 R1 R2 R3 Rp', 63], ['T L1 L2 L3 R1 R2 Rp', 64], ['T L1 L2 L3 R1 Rp', 65],
    ['T L1 L2 L3 R3 Rp', 66], ['T L1 L2 L3 Rp', 67], ['T L1 L2 L3 Lp Rp', 68], ['T L1 L2 Rp', 69], ['T L1 R1 Rp', 70],
    ['T L1 Rp', 71], ['L1 Rp', 72], ['Rp', 73], ['', 73], ['T L2 L3 R1 R2 R3', 74], ['T L2 L3 R1 R2 R3 Rp', 75],
  ]),
  clarinet: F([
    ['T L1 L2 L3 R1 R2 R3 Lp', 52], ['T L1 L2 L3 R1 R2 R3 Rp', 53], ['T L1 L2 L3 R1 R2 R3', 55], ['T L1 L2 L3 R1 R2', 57],
    ['T L1 L2 L3 R1', 58], ['T L1 L2 L3 R2', 59], ['T L1 L2 L3', 60], ['T L1 L2', 62], ['T L1', 64], ['T', 65],
    ['L1', 66], ['', 67], ['Gs', 68], ['A', 69], ['A Rg', 70], ['Rg', 70],
  ]),
  sax: F([
    ['L1 L2 L3 R1 R2 R3 C', 60], ['L1 L2 L3 R1 R2 R3', 62], ['L1 L2 L3 R1 R2 R3 Eb', 63], ['L1 L2 L3 R1 R2', 64],
    ['L1 L2 L3 R1', 65], ['L1 L2 L3 R2', 66], ['L1 L2 L3', 67], ['L1 L2 L3 Lp', 68], ['L1 L2', 69], ['L1 R1', 70],
    ['L1', 71], ['L2', 72], ['', 73],
  ]),
};
FINGERINGS.oboe = FINGERINGS.sax;
// Bassoon (sounds as written, in bass clef): six fingers make the scale from G to F, like a
// recorder, and the right thumb's keys go lower.
FINGERINGS.bassoon = F([
  ['L1 L2 L3 R1 R2 R3 Ft E', 40], ['L1 L2 L3 R1 R2 R3 Ft', 41], ['L1 L2 L3 R1 R2 R3 Ft Ab', 42],
  ['L1 L2 L3 R1 R2 R3', 43], ['L1 L2 L3 R1 R2 R3 Ab', 44], ['L1 L2 L3 R1 R2', 45], ['L1 L2 L3 R1 Ft', 46],
  ['L1 L2 L3 R1', 47], ['L1 L2 L3', 48], ['L1 L2 L3 Ab', 49], ['L1 L2', 50], ['L1 L3', 51], ['L1', 52], ['', 53],
  ['L2 L3', 54],
]);
const MAIN = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'];
const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/* The written note a set of keys plays, and with how much air. */
function writtenNote(kind, keys, high) {
  const table = FINGERINGS[kind];
  const find = (set) => table.find(([k]) => same(k, set))?.[1];
  if (kind === 'clarinet') {
    const reg = keys.has('Rg');
    const base = new Set([...keys].filter((k) => k !== 'Rg'));
    if (reg && (keys.has('A') || base.size === 0)) return 70;
    let m = find(base);
    if (m == null) {
      // Otherwise the first open hole from the top decides, as on a recorder.
      const order = ['T', ...MAIN];
      let n = 0;
      while (n < order.length && keys.has(order[n])) n++;
      m = [67, 65, 64, 62, 60, 58, 57, 55][n];
      if (!keys.has('T') && keys.has('L1')) m = 66;
    }
    return reg ? m + 19 : m;
  }
  const oct = kind === 'flute' ? high : keys.has('Oct');
  const base = new Set([...keys].filter((k) => k !== 'Oct'));
  let m = find(base);
  if (m == null && kind === 'flute') {
    const no = new Set([...base].filter((k) => k !== 'Rp'));
    m = find(no) ?? find(new Set([...no, 'Rp']));
  }
  if (m == null) {
    let n = 0;
    while (n < MAIN.length && base.has(MAIN[n])) n++;
    m = (kind === 'bassoon' ? [53, 52, 50, 48, 47, 45, 43] : [73, 71, 69, 67, 65, 64, 62])[n];
    if (kind === 'flute' && !base.has('T') && n >= 1) m += 1;
  }
  return oct ? m + 12 : m;
}

/* ---------- how each one looks ---------- */

// Each one's keys, how thick its tube is (a bore of 1 is a tube as wide as a finger key), what
// its keywork is made of, and where it lies across the screen.
const LOOKS = {
  flute: { key: 'cup', bore: 1.1, metal: 'silver', at: 0.48 },
  clarinet: { key: 'ring', bore: 1.3, metal: 'nickel', at: 0.48 },
  oboe: { key: 'plate', bore: 1.16, metal: 'silver', at: 0.48 },
  sax: { key: 'pearl', bore: 1.3, metal: 'brass', at: 0.56 },
  bassoon: { key: 'hole', bore: 1.2, metal: 'nickel', at: 0.54 },
};
const TAU = Math.PI * 2;
// Small parts in each metal: shadow, body, light.
const TONE = {
  silver: ['#56626A', '#B9C3CA', '#F7FAFB'],
  nickel: ['#5A5E5C', '#B6B9B5', '#F4F4F0'],
  brass: ['#6A460E', '#D2A448', '#FFF0C0'],
};
// A finger over a hole or a key: warm, as the other instruments light up.
const WARM = ['#FFF3CC', '#F2C866', '#B8842E'];
// A round tube: light along its upper part, shade toward both edges.
const ROUND = [[0, 'rgba(0,0,0,.62)'], [0.1, 'rgba(0,0,0,.2)'], [0.2, 'rgba(255,255,255,.05)'], [0.28, 'rgba(255,255,255,.26)'],
  [0.35, 'rgba(255,255,255,.05)'], [0.6, 'rgba(0,0,0,.04)'], [0.86, 'rgba(0,0,0,.3)'], [1, 'rgba(0,0,0,.66)']];
const gradient = (g, list) => (y0, y1) => {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of list) gr.addColorStop(o, c);
  return gr;
};

/* A tube along u from x0 to x1, its edges at top(x) and bot(x). */
function tubePath(g, x0, x1, top, bot) {
  const n = Math.max(2, Math.ceil(Math.abs(x1 - x0) / 4));
  g.beginPath();
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    if (k) g.lineTo(x, top(x));
    else g.moveTo(x, top(x));
  }
  for (let k = n; k >= 0; k--) {
    const x = x0 + ((x1 - x0) * k) / n;
    g.lineTo(x, bot(x));
  }
  g.closePath();
}

/* Paint across a tube in strips 4 pixels wide, each with its own gradient from edge to edge,
   so a cone or a flaring bell is lit as well as a straight tube. (Strips on whole multiples of
   4 meet on whole device pixels at the usual screen scales, so no seams show.) */
function across(g, x0, x1, top, bot, fill) {
  g.save();
  tubePath(g, x0, x1, top, bot);
  g.clip();
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  for (let x = Math.floor(lo / 4) * 4; x < hi; x += 4) {
    const m = Math.max(lo, Math.min(hi, x + 2));
    const t = top(m);
    const d = bot(m);
    g.fillStyle = fill(t, d);
    g.fillRect(x, t - 3, 4, d - t + 6);
  }
  g.restore();
}

/* The two sides of a tube along a curving centre line [[x, y, half width]...]. */
function sides(pts) {
  const L = [];
  const R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dx = (b[0] - a[0]) / d;
    const dy = (b[1] - a[1]) / d;
    const [x, y, w] = pts[i];
    L.push([x + dy * w, y - dx * w]);
    R.push([x - dy * w, y + dx * w]);
  }
  return { L, R };
}
function outline(g, { L, R }) {
  g.beginPath();
  L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath();
}
/* Polished metal along a curving tube: each short piece lit across its width, reaching a
   little into the next so no seam shows. */
function metalAlong(g, kind, { L, R }) {
  for (let i = 0; i < L.length - 1; i++) {
    const [a, b, c, d] = [L[i], L[i + 1], R[i + 1], R[i]];
    const e = 0.2;
    g.fillStyle = metal(g, kind, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (c[0] + d[0]) / 2, (c[1] + d[1]) / 2);
    g.beginPath();
    g.moveTo(a[0] - (b[0] - a[0]) * e, a[1] - (b[1] - a[1]) * e);
    g.lineTo(b[0] + (b[0] - a[0]) * e, b[1] + (b[1] - a[1]) * e);
    g.lineTo(c[0] + (c[0] - d[0]) * e, c[1] + (c[1] - d[1]) * e);
    g.lineTo(d[0] - (c[0] - d[0]) * e, d[1] - (c[1] - d[1]) * e);
    g.closePath();
    g.fill();
  }
}

/* A metal ring around a tube at x, w wide, from y0 to y1. */
function band(g, kind, x, w, y0, y1) {
  g.fillStyle = metal(g, kind, 0, y0, 0, y1);
  rr(g, x - w / 2, y0, w, y1 - y0, Math.min(2, w / 3));
  g.fill();
  const e = Math.max(0.8, w * 0.1);
  g.fillStyle = 'rgba(0,0,0,.32)';
  g.fillRect(x - w / 2, y0 + 1, e, y1 - y0 - 2);
  g.fillRect(x + w / 2 - e, y0 + 1, e, y1 - y0 - 2);
  g.fillStyle = 'rgba(255,255,255,.4)';
  g.fillRect(x - w * 0.2, y0 + 1, e, y1 - y0 - 2);
}

/* A metal rod or lever from (x0, y0) to (x1, y1), w thick, with its shadow. */
function bar(g, x0, y0, x1, y1, w, kind) {
  const [d, m, l] = TONE[kind] || TONE.silver;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ox = ((y1 - y0) / len) * w * 0.22;
  const oy = (-(x1 - x0) / len) * w * 0.22;
  const line = (dx, dy) => {
    g.beginPath();
    g.moveTo(x0 + dx, y0 + dy);
    g.lineTo(x1 + dx, y1 + dy);
  };
  g.save();
  g.lineCap = 'round';
  line(0.8, w * 0.5 + 1);
  g.strokeStyle = 'rgba(0,0,0,.28)';
  g.lineWidth = w + 1;
  g.stroke();
  line(0, 0);
  g.strokeStyle = d;
  g.lineWidth = w;
  g.stroke();
  g.strokeStyle = m;
  g.lineWidth = w * 0.6;
  g.stroke();
  line(ox, oy);
  g.strokeStyle = l;
  g.lineWidth = Math.max(0.7, w * 0.22);
  g.stroke();
  g.restore();
}

/* A post holding a rod, seen from above: a little pillar on its foot. */
function post(g, x, y, s, kind) {
  g.beginPath();
  g.ellipse(x + 0.8, y + 1.6, s * 1.3, s * 1.05, 0, 0, TAU);
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.fill();
  pin(g, x, y, s, kind === 'brass' ? 'brass' : 'silver');
}

/* A closed pad cup seen from above: domed metal. */
function cup(g, x, y, r, kind) {
  const [d, m, l] = TONE[kind] || TONE.silver;
  g.beginPath();
  g.arc(x + r * 0.08, y + r * 0.18, r, 0, TAU);
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fill();
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  gr.addColorStop(0, '#fff');
  gr.addColorStop(0.35, l);
  gr.addColorStop(0.75, m);
  gr.addColorStop(1, d);
  g.fillStyle = gr;
  g.fill();
  g.beginPath();
  g.arc(x, y, r * 0.78, 0, TAU);
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.lineWidth = Math.max(0.6, r * 0.06);
  g.stroke();
}

/* A single-reed mouthpiece in profile, its tip at x0, going into the instrument at x1: the
   beak above, the cane reed under its table, held by the ligature and its two screws. */
function mouthpiece(g, x0, x1, cy, R, lig) {
  const L = x1 - x0;
  const top = (x) => {
    const t = Math.max(0, Math.min(1, (x - x0) / (L * 0.56)));
    return cy - R * (-0.1 + 0.92 * (1 - (1 - t) ** 2.3));
  };
  const table = cy + R * 0.3;
  const bot = (x) => {
    const t = (x - x0) / L;
    if (t < 0.64) return table;
    const u = Math.min(1, (t - 0.64) / 0.16);
    return table + R * 0.52 * u * u * (3 - 2 * u);
  };
  g.save();
  g.shadowColor = 'rgba(0,0,0,.5)';
  g.shadowBlur = R * 0.5;
  g.shadowOffsetY = R * 0.25;
  tubePath(g, x0, x1, top, bot);
  g.fillStyle = '#100E0E';
  g.fill();
  g.restore();
  // hard rubber, glossy
  across(g, x0, x1, top, bot, gradient(g, [[0, '#030303'], [0.14, '#1E1C1C'], [0.26, '#6A6866'], [0.34, '#1C1A1A'],
    [0.7, '#0C0B0B'], [1, '#020202']]));
  // the reed under the table: thin at its tip, its bark showing toward the heel
  const rx1 = x0 + L * 0.76;
  const rb = (x) => table + 0.6 + R * 0.24 * Math.min(1, Math.max(0, (x - x0) / (L * 0.42))) ** 0.8;
  tubePath(g, x0 - 1, rx1, () => table, rb);
  const cane = g.createLinearGradient(x0, 0, rx1, 0);
  cane.addColorStop(0, '#F4E2B0');
  cane.addColorStop(0.42, '#E2C07A');
  cane.addColorStop(0.5, '#C9A050');
  cane.addColorStop(1, '#B88A3C');
  g.fillStyle = cane;
  g.fill();
  g.strokeStyle = 'rgba(90,60,20,.45)';
  g.lineWidth = 0.6;
  for (let k = 1; k < 4; k++) {
    g.beginPath();
    g.moveTo(x0 + L * 0.42, table + R * 0.06 * k);
    g.lineTo(rx1 - 2, table + R * 0.06 * k);
    g.stroke();
  }
  // the ligature, round mouthpiece and reed, and its two screws below
  const a = x0 + L * 0.5;
  const b = x0 + L * 0.68;
  const y1 = rb(b) + R * 0.06;
  g.beginPath();
  g.moveTo(a, top(a) - 1.5);
  g.lineTo(b, top(b) - 1.5);
  g.lineTo(b, y1);
  g.lineTo(a, y1);
  g.closePath();
  g.fillStyle = metal(g, lig, 0, top(a), 0, y1);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.4)';
  g.lineWidth = 0.8;
  g.stroke();
  for (const f of [0.22, 0.78]) {
    const x = a + (b - a) * f;
    const w = Math.max(3, R * 0.16);
    g.fillStyle = metal(g, lig, x - w / 2, 0, x + w / 2, 0);
    g.fillRect(x - w / 2, y1 - 1, w, R * 0.26);
    g.beginPath();
    g.arc(x, y1 + R * 0.3, w * 0.75, 0, TAU);
    g.fill();
  }
}

/* A double reed seen flat, from its base (bx, by) to its tip (tx, ty), w across at its widest:
   two cane blades bound with thread, on a cork (the oboe's) or with wire rings and a ball of
   thread (the bassoon's). */
function doubleReed(g, bx, by, tx, ty, w, { thread, cork }) {
  const L = Math.hypot(tx - bx, ty - by);
  g.save();
  g.translate(bx, by);
  g.rotate(Math.atan2(ty - by, tx - bx));
  g.shadowColor = 'rgba(0,0,0,.45)';
  g.shadowBlur = w * 0.4;
  g.shadowOffsetY = w * 0.2;
  const xb = L * (cork ? 0.3 : 0.2);     // where the thread starts
  const xt = L * (cork ? 0.56 : 0.42);  // where the blades come out of it
  // the cork, or the reed's round tube end
  g.fillStyle = cork ? '#B98A58' : metal(g, 'silver', 0, -w * 0.3, 0, w * 0.3);
  rr(g, 0, -w * (cork ? 0.36 : 0.26), xb + 2, w * (cork ? 0.72 : 0.52), 2);
  g.fill();
  g.shadowColor = 'transparent';
  if (cork) {
    g.fillStyle = 'rgba(90,55,20,.5)';
    for (let k = 0; k < 18; k++) g.fillRect(((k * 37) % 100) / 100 * xb, (((k * 53) % 100) / 100 - 0.5) * w * 0.6, 1.4, 1.4);
  }
  // the blades, widening to the tip: the heart scraped thin, the tip thinnest
  g.beginPath();
  g.moveTo(xt - 2, -w * 0.3);
  g.bezierCurveTo(xt + (L - xt) * 0.5, -w * 0.32, L - w * 0.1, -w * 0.42, L, -w * 0.41);
  g.quadraticCurveTo(L + w * 0.05, 0, L, w * 0.41);
  g.bezierCurveTo(L - w * 0.1, w * 0.42, xt + (L - xt) * 0.5, w * 0.32, xt - 2, w * 0.3);
  g.closePath();
  const cg = g.createLinearGradient(xt, 0, L, 0);
  cg.addColorStop(0, '#C79A4E');
  cg.addColorStop(0.35, '#D9B266');
  cg.addColorStop(0.62, '#B98C48');
  cg.addColorStop(0.86, '#E6CC92');
  cg.addColorStop(1, '#F2E2B6');
  g.fillStyle = cg;
  g.fill();
  g.strokeStyle = 'rgba(110,70,20,.5)';
  g.lineWidth = 0.7;
  g.stroke();
  g.beginPath();
  g.moveTo(xt + 2, 0);
  g.lineTo(L - 1, 0);
  g.strokeStyle = 'rgba(90,55,15,.35)';
  g.stroke();
  // the scraped heart, a little darker, and the thin tip, paler
  g.save();
  g.clip();
  g.beginPath();
  g.ellipse(xt + (L - xt) * 0.62, 0, (L - xt) * 0.2, w * 0.3, 0, 0, TAU);
  g.fillStyle = 'rgba(140,90,30,.25)';
  g.fill();
  g.fillStyle = 'rgba(255,248,225,.35)';
  g.fillRect(L - (L - xt) * 0.12, -w, w, w * 2);
  g.restore();
  // the thread wound round it, in bands
  g.fillStyle = thread[0];
  rr(g, xb, -w * 0.34, xt - xb, w * 0.68, w * 0.12);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.14)';
  for (let x = xb + 1.5; x < xt - 1; x += 2.2) g.fillRect(x, -w * 0.33, 0.8, w * 0.66);
  g.fillStyle = thread[1];
  g.fillRect(xb + (xt - xb) * 0.18, -w * 0.34, (xt - xb) * 0.12, w * 0.68);
  g.fillRect(xb + (xt - xb) * 0.74, -w * 0.34, (xt - xb) * 0.08, w * 0.68);
  const sh = g.createLinearGradient(0, -w * 0.34, 0, w * 0.34);
  sh.addColorStop(0, 'rgba(0,0,0,.4)');
  sh.addColorStop(0.3, 'rgba(255,255,255,.18)');
  sh.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = sh;
  rr(g, xb, -w * 0.34, xt - xb, w * 0.68, w * 0.12);
  g.fill();
  if (!cork) {
    // the bassoon reed's wires round the blades
    for (const f of [0.12, 0.3]) {
      const x = xt + (L - xt) * f;
      g.fillStyle = metal(g, 'brass', 0, -w * 0.36, 0, w * 0.36);
      g.fillRect(x - 1.2, -w * 0.36, 2.4, w * 0.72);
    }
  }
  g.restore();
}

export async function mount(stage, ex, kit) {
  const kind = ex.opts.kind;
  const written = ex.written || 0;
  const keyset = KEYSETS[kind];
  const look = LOOKS[kind];
  const range = ex.range;
  const inst = await pitched(ex.opts.sound, range[0] - 2, range[1] + 2);
  const voice = inst.sustain({ attack: kind === 'flute' ? 0.06 : 0.035, release: 0.09, glide: 0.006, vibrato: ex.opts.vibrato });

  const box = document.createElement('div');
  box.className = 'zone wind';
  stage.append(box);

  const pressed = new Map();     // key id -> Set of holders (pointer ids, 'mouse', computer keys)
  const pointerKey = new Map();
  const isDown = (k) => (pressed.get(k)?.size || 0) > 0;
  const press = (k, by) => { if (!pressed.has(k)) pressed.set(k, new Set()); pressed.get(k).add(by); };
  const release = (k, by) => pressed.get(k)?.delete(by);

  let breath = null;             // { id, high }
  let locked = false;
  let spaceBlow = false;
  let shiftHigh = false;
  let sounding = false;
  let lockHigh = false;

  let G = null;
  function geom(s) {
    const pad = Math.min(s.W * 0.17, 200);
    const cy = s.H * look.at;
    const end = s.W - 14;
    const bodyX = pad + 10;
    const len = end - bodyX;
    const r = Math.min(len * 0.09 * 0.45, s.H * 0.12, 52);
    const th = Math.min(r * 2 * look.bore, s.H * 0.3);
    G = { pad, cy, th, bodyX, len, end, r };
    return G;
  }
  const keyPos = ([, at, side, size]) => {
    const r = G.r * size;
    const u = G.bodyX + (at - 0.05) * G.len * 1.04;
    const v = G.cy + side * (G.th / 2 + r * 1.25);
    return { u, v, r };
  };
  const lockBox = () => ({ u: G.pad / 2, v: G.cy + G.th / 2 + 58, r: 22 });

  let autoBlow = null;           // { high }, while the instrument plays a tune itself
  function blowing() { return !!breath || locked || spaceBlow || !!autoBlow; }
  const high = () => (breath ? breath.high : locked ? lockHigh : autoBlow ? autoBlow.high : shiftHigh);

  function keysNow() {
    const out = new Set();
    for (const [k] of keyset) if (isDown(k)) out.add(k);
    return out;
  }

  function update(attack = false) {
    if (!blowing()) {
      if (sounding) { voice.stop(); sounding = false; }
      kit.note(null);
      s.redraw();
      return;
    }
    const w = writtenNote(kind, keysNow(), high());
    const midi = Math.max(range[0], Math.min(range[1], w - written));
    const fresh = !sounding || attack;
    if (fresh) { voice.start(midi, autoBlow?.level ?? 0.8); sounding = true; }
    else voice.pitch(midi);
    kit.note(midi, fresh ? 'fresh' : undefined);
    s.redraw();
  }

  function hitKey(u, v) {
    let best = null;
    let bd = Infinity;
    for (const k of keyset) {
      const p = keyPos(k);
      const d = Math.hypot(u - p.u, v - p.v);
      const reach = Math.max(p.r * 1.25, 26);
      if (d < reach && d < bd) { best = k[0]; bd = d; }
    }
    return best;
  }

  const s = surface(box, {
    label: ex.name,
    draw,
    down(p) {
      const lb = lockBox();
      if (Math.hypot(p.u - lb.u, p.v - lb.v) < lb.r + 10) {
        locked = !locked;
        lockHigh = breath ? breath.high : false;
        update(locked);
        return;
      }
      if (p.u < G.pad) {
        breath = { id: p.id, high: kind === 'flute' && p.v < G.cy };
        if (locked) lockHigh = breath.high;
        update(true);
        return;
      }
      const k = hitKey(p.u, p.v);
      if (!k) return;
      if (p.type === 'mouse') {
        if (pressed.get(k)?.has('mouse')) release(k, 'mouse');
        else press(k, 'mouse');
      } else {
        press(k, p.id);
        pointerKey.set(p.id, k);
      }
      update();
    },
    move(p) {
      if (breath && breath.id === p.id && kind === 'flute') {
        const h = p.v < G.cy;
        if (h !== breath.high) { breath.high = h; if (locked) lockHigh = h; update(); }
      }
    },
    up(p) {
      if (breath && breath.id === p.id) { breath = null; update(); return; }
      const k = pointerKey.get(p.id);
      if (k) { pointerKey.delete(p.id); release(k, p.id); update(); }
    },
  });
  s.onresize = geom;
  geom(s);

  function draw(g, s) {
    geom(s);
    const { pad, cy, th } = G;
    put(g, s, layer(s, 'room', '', (c) => {
      c.fillStyle = '#16211B';
      c.fillRect(0, 0, s.W, s.H);
      pool(c, s.W * 0.55, cy, s.W * 0.6, '#2C4034', 0.55, 0.6);
    }));
    // the place to blow: lit while the air goes
    const on = blowing();
    const zone = (x, y, w, h, lit) => {
      rr(g, x, y, w, h, 18);
      g.fillStyle = lit ? 'rgba(246,219,140,.2)' : 'rgba(255,255,255,.045)';
      g.fill();
      g.strokeStyle = lit ? 'rgba(246,219,140,.5)' : 'rgba(255,255,255,.07)';
      g.lineWidth = 1.5;
      g.stroke();
    };
    if (kind === 'flute') {
      zone(8, 10, pad - 16, cy - 14, on && high());
      zone(8, cy + 4, pad - 16, s.H - cy - 14, on && !high());
    } else {
      zone(8, 10, pad - 16, s.H - 20, on);
    }
    put(g, s, layer(s, 'body', '', paintBody));
    // the air, streaming in
    if (on) {
      const t = performance.now() / 1000;
      const flute = kind === 'flute';
      const hx = flute ? pad * 0.56 : pad * 0.62;
      g.save();
      g.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const side = flute ? (high() ? -1 : 1) : k % 2 ? 1 : -1;
        const lane = flute ? k * 0.6 : Math.floor(k / 2);
        const y0 = cy + side * th * (0.72 + lane * 0.2);
        const y1 = flute ? cy + side * th * 0.08 : cy + side * th * (0.6 + lane * 0.08);
        g.beginPath();
        for (let i = 0; i <= 28; i++) {
          const f = i / 28;
          const x = 10 + (hx - 10) * f;
          const y = y0 + (y1 - y0) * f * f + Math.sin(f * 10 - t * 8 + k * 1.7) * 2.6 * (1 - f * 0.5);
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        const gr = g.createLinearGradient(10, 0, hx, 0);
        gr.addColorStop(0, 'rgba(246,241,228,0)');
        gr.addColorStop(0.45, 'rgba(246,241,228,.45)');
        gr.addColorStop(1, 'rgba(246,241,228,0)');
        g.strokeStyle = gr;
        g.lineWidth = 2;
        g.stroke();
      }
      g.restore();
      s.animate(80);
    }
    // the lock
    const lb = lockBox();
    g.beginPath();
    g.arc(lb.u, lb.v, lb.r, 0, TAU);
    g.fillStyle = locked ? '#E2B44A' : 'rgba(255,255,255,.1)';
    g.fill();
    g.strokeStyle = locked ? 'rgba(255,243,208,.8)' : 'rgba(255,255,255,.14)';
    g.lineWidth = 1.5;
    g.stroke();
    g.strokeStyle = locked ? '#2A1B05' : 'rgba(246,241,228,.75)';
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 2.6;
    rr(g, lb.u - 8, lb.v - 2, 16, 12, 3);
    g.fill();
    g.beginPath();
    if (locked) g.arc(lb.u, lb.v - 3, 5.5, Math.PI, 0);
    else g.arc(lb.u + 6, lb.v - 5, 5.5, Math.PI * 1.1, 0.1);
    g.stroke();
    // keys
    const keysShown = fine();
    for (const k of keyset) {
      const p = keyPos(k);
      const dn = isDown(k[0]);
      const style = drawKey(g, k, p, dn);
      const dark = style === 'hole' || style === 'ring' || (style === 'cup' && !k[2]);
      if (keysShown) label(g, s, k[4].toUpperCase(), p.u, p.v, { size: 12, color: dn ? 'rgba(60,36,4,.8)' : dark ? 'rgba(255,255,255,.62)' : 'rgba(30,36,42,.62)' });
    }
  }

  /* ---- the instrument itself, painted once for each size ---- */

  const kp = (id) => keyPos(keyset.find((k) => k[0] === id));
  const X = (f) => G.bodyX + f * G.len;
  function shadowed(c, blur, dy, fill) {
    c.save();
    c.shadowColor = 'rgba(0,0,0,.5)';
    c.shadowBlur = blur;
    c.shadowOffsetY = dy;
    fill();
    c.restore();
  }
  // Each side key's lever, from under its touch to the body's edge.
  function levers(c, edge, kind, skip = []) {
    const { cy, r } = G;
    for (const k of keyset) {
      if (!k[2] || skip.includes(k[0])) continue;
      const p = keyPos(k);
      const toward = Math.sign(cy - p.v);
      const y = edge(p.u, toward);
      bar(c, p.u, p.v, p.u + r * 0.25, y, Math.max(3, p.r * 0.3), kind);
      post(c, p.u + r * 0.25, y + toward * 2, Math.max(2, p.r * 0.16), kind);
    }
  }

  function paintBody(c) {
    ({ flute: paintFlute, clarinet: paintClarinet, oboe: paintOboe, sax: paintSax, bassoon: paintBassoon })[kind](c);
  }

  function paintFlute(c) {
    const { pad, cy, th, bodyX, end, r } = G;
    const R = th / 2;
    const xc = pad * 0.2;                // the crown's inner end
    const xh = X(0.025);                 // the head joint into the body
    const xf = X(0.865);                 // the body into the foot
    const xe = end - 2;
    const rad = (x) => (x < xh ? R * (0.9 + 0.1 * Math.min(1, (x - xc) / (xh - xc))) : R);
    const top = (x) => cy - rad(x);
    const bot = (x) => cy + rad(x);
    shadowed(c, R * 0.7, R * 0.35, () => {
      tubePath(c, xc, xe, top, bot);
      c.fillStyle = '#9AA4AA';
      c.fill();
    });
    across(c, xc, xe, top, bot, (y0, y1) => metal(c, 'silver', 0, y0, 0, y1));
    // the crown, capping the head joint
    const cw = R * 0.5;
    c.fillStyle = metal(c, 'silver', 0, cy - R * 0.95, 0, cy + R * 0.95);
    rr(c, xc - cw, cy - R * 0.95, cw + 2, R * 1.9, R * 0.22);
    c.fill();
    c.beginPath();
    c.ellipse(xc - cw, cy, R * 0.22, R * 0.66, 0, Math.PI / 2, Math.PI * 1.5);
    c.fill();
    pin(c, xc - cw - R * 0.14, cy, R * 0.16, 'silver');
    c.fillStyle = 'rgba(30,38,44,.5)';
    for (const f of [0.28, 0.72]) c.fillRect(xc - cw * f, cy - R * 0.93, 1.2, R * 1.86);
    // the joints, and the foot's end
    band(c, 'silver', xh, R * 0.3, cy - R * 1.05, cy + R * 1.05);
    band(c, 'silver', xf, R * 0.3, cy - R * 1.05, cy + R * 1.05);
    band(c, 'silver', xe - R * 0.1, R * 0.18, cy - R * 1.02, cy + R * 1.02);
    // the lip plate and its embouchure hole, where the air goes
    const lx = pad * 0.56;
    const lw = Math.min(th * 0.72, (xh - xc) * 0.4);
    const lh = th * 0.64;
    shadowed(c, 8, 3, () => {
      rr(c, lx - lw, cy - lh, lw * 2, lh * 2, lh * 0.85);
      const lg = c.createRadialGradient(lx - lw * 0.35, cy - lh * 0.45, lh * 0.05, lx, cy, lw * 1.2);
      lg.addColorStop(0, '#FFFFFF');
      lg.addColorStop(0.4, '#DDE4E8');
      lg.addColorStop(0.8, '#A3AEB5');
      lg.addColorStop(1, '#78848C');
      c.fillStyle = lg;
      c.fill();
    });
    rr(c, lx - lw, cy - lh, lw * 2, lh * 2, lh * 0.85);
    c.strokeStyle = 'rgba(40,50,56,.5)';
    c.lineWidth = 1;
    c.stroke();
    c.beginPath();
    c.ellipse(lx, cy, lw * 0.5, lh * 0.48, 0, 0, TAU);
    c.fillStyle = metal(c, 'silver', lx - lw * 0.5, cy - lh * 0.48, lx + lw * 0.3, cy + lh * 0.48);
    c.fill();
    c.beginPath();
    c.ellipse(lx, cy + 0.5, lw * 0.36, lh * 0.33, 0, 0, TAU);
    const hg = c.createRadialGradient(lx, cy + lh * 0.12, 1, lx, cy, lw * 0.4);
    hg.addColorStop(0, '#05070A');
    hg.addColorStop(0.7, '#171C20');
    hg.addColorStop(1, '#46525A');
    c.fillStyle = hg;
    c.fill();
    // the keywork: one long rod, each cup's arm reaching up to its own hinge tube on it
    const yr = cy - R + Math.max(2.5, R * 0.1);
    const rw = Math.max(2.5, R * 0.09);
    const a = kp('L1');
    const b = kp('R3');
    // two small trill keys on the far side, peeking over the tube
    for (const [p, q] of [['R1', 'R2'], ['R2', 'R3']]) cup(c, (kp(p).u + kp(q).u) / 2, cy - R * 0.84, r * 0.27, 'silver');
    bar(c, a.u - r * 1.05, yr, b.u + r * 1.1, yr, rw, 'silver');
    for (const id of MAIN) {
      const p = kp(id);
      bar(c, p.u - r * 0.5, yr, p.u + r * 0.5, yr, rw * 1.5, 'silver');
      bar(c, p.u, yr, p.u, cy - p.r * 0.7, rw * 1.3, 'silver');
    }
    for (const x of [a.u - r * 1.1, (kp('L3').u + kp('R1').u) / 2, b.u + r * 1.15]) post(c, x, yr, rw * 0.9, 'silver');
    // the foot: its C sharp and C keys, closed cups on their own rod
    const fr = r * 0.52;
    bar(c, X(0.89), yr, xe - R * 0.35, yr, rw, 'silver');
    for (const f of [0.918, 0.962]) {
      bar(c, X(f), yr, X(f), cy - fr * 0.6, rw * 1.2, 'silver');
      cup(c, X(f), cy, fr, 'silver');
    }
    post(c, xe - R * 0.35, yr, rw * 0.9, 'silver');
    levers(c, (u, toward) => cy - toward * (R - 2), 'silver');
  }

  function paintClarinet(c) {
    const { pad, cy, th, end, r } = G;
    const R = th / 2;
    const xm0 = pad * 0.07;
    const xm1 = pad * 0.72;              // the mouthpiece into the barrel
    const xb1 = xm1 + th * 0.95;         // the barrel into the upper joint
    const xj = X(0.59);                  // upper joint into lower
    const xbell = X(0.905);
    const flare = (x) => (x <= xbell ? 0 : ((x - xbell) / (end - xbell)) ** 2.3);
    const top = (x) => cy - R * (1 + 0.9 * flare(x));
    const bot = (x) => cy + R * (1 + 0.9 * flare(x));
    const btop = (x) => cy - R * (1.04 + 0.05 * Math.sin((Math.PI * (x - xm1)) / (xb1 - xm1)));
    const bbot = (x) => 2 * cy - btop(x);
    shadowed(c, R * 0.7, R * 0.35, () => {
      tubePath(c, xm1, end, top, bot);
      c.fillStyle = '#16110F';
      c.fill();
    });
    tubePath(c, xm1, xb1, btop, bbot);
    c.fillStyle = wood(c, 'grenadilla', { scale: 0.7, seed: 1 });
    c.fill();
    across(c, xm1, xb1, btop, bbot, gradient(c, ROUND));
    tubePath(c, xb1, end, top, bot);
    c.fillStyle = wood(c, 'grenadilla', { scale: 0.8, seed: 3 });
    c.fill();
    across(c, xb1, end, top, bot, gradient(c, ROUND));
    const ring = (x, w, k = 1.06) => band(c, 'nickel', x, w, cy - R * k, cy + R * k);
    ring(xm1 + R * 0.1, R * 0.18, 1.1);
    ring(xb1 - R * 0.1, R * 0.18, 1.1);
    ring(xb1 + R * 0.13, R * 0.2);
    ring(xj - R * 0.12, R * 0.2);
    ring(xj + R * 0.12, R * 0.2);
    ring(xbell + R * 0.1, R * 0.2);
    band(c, 'nickel', end - R * 0.12, R * 0.2, top(end) - 1, bot(end) + 1);
    mouthpiece(c, xm0, xm1 + 2, cy, R, 'nickel');
    // the keywork: a rod along each joint, the rings' arms up to it, the trill keys at the side
    const yr = cy - R + Math.max(2.5, R * 0.1);
    const rw = Math.max(2.5, R * 0.08);
    for (const [k, f] of [[0, 0.46], [1, 0.5], [2, 0.54]]) {
      const x = X(f);
      bar(c, x - r * 0.3, cy - R * 0.92, x + r * 0.5, cy - R * 0.92, Math.max(3, r * 0.14) + k * 0.4, 'nickel');
      pin(c, x - r * 0.3, cy - R * 0.92, Math.max(2.2, r * 0.1), 'nickel');
    }
    bar(c, X(0.19), yr, X(0.565), yr, rw, 'nickel');
    bar(c, X(0.61), yr, X(0.86), yr, rw, 'nickel');
    for (const id of MAIN) {
      const p = kp(id);
      bar(c, p.u - p.r * 0.2, yr, p.u - p.r * 0.2, cy - p.r * 0.7, rw * 1.2, 'nickel');
    }
    for (const x of [X(0.19), X(0.565), X(0.61), X(0.86)]) post(c, x, yr, rw * 0.9, 'nickel');
    // the bridge key across the middle joint
    bar(c, xj - R * 0.55, yr + rw * 1.4, xj + R * 0.55, yr + rw * 1.4, rw * 1.2, 'nickel');
    levers(c, (u, toward) => cy - toward * (R - 2), 'nickel', ['T']);
    const t = kp('T');
    bar(c, t.u, t.v, t.u, cy + R - 2, Math.max(3, t.r * 0.3), 'nickel');
  }

  function paintOboe(c) {
    const { pad, cy, th, end, r } = G;
    const R = th / 2;
    const xr0 = pad * 0.07;
    const xt = pad * 0.74;               // the reed's cork into the top joint
    const xj = X(0.47);
    const xbell = X(0.875);
    const half = (x) => {
      if (x < xj) return R * (0.72 + (0.2 * (x - xt)) / (xj - xt));
      if (x < xbell) return R * (0.92 + (0.1 * (x - xj)) / (xbell - xj));
      const t = (x - xbell) / (end - xbell);
      return R * (1.02 + 0.55 * t * t * (3 - 2 * t) - 0.12 * Math.max(0, (t - 0.8) / 0.2) ** 2);
    };
    const top = (x) => cy - half(x);
    const bot = (x) => cy + half(x);
    shadowed(c, R * 0.7, R * 0.35, () => {
      tubePath(c, xt, end, top, bot);
      c.fillStyle = '#16110F';
      c.fill();
    });
    tubePath(c, xt, end, top, bot);
    c.fillStyle = wood(c, 'grenadilla', { scale: 0.75, seed: 6 });
    c.fill();
    across(c, xt, end, top, bot, gradient(c, ROUND));
    const ring = (x, w) => band(c, 'silver', x, w, top(x) - R * 0.06, bot(x) + R * 0.06);
    ring(xt + R * 0.12, R * 0.24);
    ring(xj - R * 0.11, R * 0.18);
    ring(xj + R * 0.11, R * 0.18);
    ring(xbell + R * 0.1, R * 0.18);
    band(c, 'silver', end - R * 0.08, R * 0.14, top(end) - 1, bot(end) + 1);
    doubleReed(c, xt + 4, cy, xr0, cy, R * 0.9, { thread: ['#2F6B4C', '#E0B84E'], cork: true });
    // keywork everywhere, as on a real oboe: rods down both sides, small keys between
    const rw = Math.max(2.2, R * 0.08);
    const yt = (x) => top(x) + Math.max(2.5, R * 0.1);
    const yb = (x) => bot(x) - Math.max(2.5, R * 0.1);
    for (const f of [0.13, 0.19]) cup(c, X(f), top(X(f)) + R * 0.12, r * 0.26, 'silver');
    for (const f of [0.67, 0.765]) cup(c, X(f), top(X(f)) + R * 0.1, r * 0.25, 'silver');
    bar(c, X(0.11), yt(X(0.11)), X(0.455), yt(X(0.455)), rw, 'silver');
    bar(c, X(0.49), yt(X(0.49)), X(0.85), yt(X(0.85)), rw, 'silver');
    bar(c, X(0.2), yb(X(0.2)), X(0.455), yb(X(0.455)), rw, 'silver');
    bar(c, X(0.49), yb(X(0.49)), X(0.84), yb(X(0.84)), rw, 'silver');
    for (const f of [0.11, 0.2, 0.455, 0.49, 0.84, 0.85]) post(c, X(f), f === 0.2 || f === 0.84 ? yb(X(f)) : yt(X(f)), rw * 0.9, 'silver');
    // the side keys, little spatulas along the lower side
    for (const f of [0.345, 0.425, 0.79]) {
      const x = X(f);
      bar(c, x - r * 0.45, yb(x), x + r * 0.2, bot(x) - R * 0.02, Math.max(3, r * 0.15), 'silver');
      cup(c, x + r * 0.22, bot(x) - R * 0.02, Math.max(3, r * 0.17), 'silver');
    }
    for (const id of MAIN) {
      const p = kp(id);
      bar(c, p.u, yt(p.u), p.u, cy - p.r * 0.7, rw * 1.2, 'silver');
      bar(c, p.u - p.r * 0.5, yt(p.u), p.u + p.r * 0.5, yt(p.u), rw * 1.5, 'silver');
    }
    levers(c, (u, toward) => (toward > 0 ? top(u) + 2 : bot(u) - 2), 'silver');
  }

  function paintSax(c) {
    const { pad, cy, th, bodyX, end, r } = G;
    const R = th / 2;
    const xm0 = pad * 0.05;
    const xm1 = pad * 0.5;               // the mouthpiece onto the neck
    const wB = R * 1.18;                 // half its width at the bow
    const RB = wB * 1.28;                // the bow's radius, on its centre line
    const rim = wB * 1.72;               // half the bell's width at its rim
    const rise = wB * 1.6;               // from the bow up to the rim
    const xc = end - rim - 3;            // the bell's centre line
    const xb = xc - RB;                  // where the body starts to turn
    const half = (x) => R * 0.6 + (wB - R * 0.6) * Math.max(0, Math.min(1, (x - bodyX) / (xb - bodyX))) ** 0.8;
    const top = (x) => cy - half(x);
    const bot = (x) => cy + half(x);
    // the bow and the bell, along their centre line
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const a = (Math.PI / 2) * (1 - k / 24);
      pts.push([xb + RB * Math.cos(a), cy - RB + RB * Math.sin(a), wB]);
    }
    for (let k = 1; k <= 30; k++) {
      const t = k / 30;
      pts.push([xc, cy - RB - rise * t, wB + (rim - wB) * t ** 2.6]);
    }
    const bow = sides(pts);
    // the neck, rising over a little hump from the body to the mouthpiece
    const npts = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24;
      npts.push([xm1 + (bodyX + 6 - xm1) * t, cy - R * 0.5 * Math.sin(Math.PI * t) ** 1.6, R * (0.28 + 0.32 * t)]);
    }
    const neck = sides(npts);
    // key cups on the far side, peeking over the body
    const cups = [0.338, 0.43, 0.67, 0.765].map((f) => X(f));
    for (const x of cups) cup(c, x, top(x) + R * 0.1, R * 0.3, 'brass');
    for (const f of [0.17, 0.21, 0.25]) cup(c, X(f), top(X(f)) + R * 0.05, R * 0.2, 'brass');
    shadowed(c, R * 0.7, R * 0.35, () => {
      tubePath(c, bodyX, xb + 1, top, bot);
      c.fillStyle = '#6A4A14';
      c.fill();
      outline(c, bow);
      c.fill();
      outline(c, neck);
      c.fill();
    });
    across(c, bodyX, xb + 1, top, bot, (y0, y1) => metal(c, 'brass', 0, y0, 0, y1));
    metalAlong(c, 'brass', bow);
    metalAlong(c, 'brass', neck);
    // the bell's mouth: the rolled rim, and inside it the dark of the bore
    const yRim = cy - RB - rise;
    c.beginPath();
    c.ellipse(xc, yRim, rim, rim * 0.26, 0, 0, TAU);
    const ig = c.createRadialGradient(xc + rim * 0.2, yRim + rim * 0.06, rim * 0.05, xc, yRim, rim);
    ig.addColorStop(0, '#2A1A06');
    ig.addColorStop(0.55, '#6E4A14');
    ig.addColorStop(0.85, '#C8963E');
    ig.addColorStop(1, '#F0CF80');
    c.fillStyle = ig;
    c.fill();
    c.lineWidth = Math.max(3, R * 0.14);
    c.strokeStyle = metal(c, 'brass', xc - rim, 0, xc + rim, 0);
    c.stroke();
    // engraving on the bell: a curling spray of leaves
    engrave(c, xc - rim * 0.08, cy - RB - rise * 0.42, rim * 0.62);
    // the low key cups round the outside of the bow, and their guard
    for (const deg of [52, 30, 8]) {
      const a = (deg * Math.PI) / 180;
      const d = RB + wB * 0.55;
      cup(c, xb + d * Math.cos(a), cy - RB + d * Math.sin(a), R * 0.42, 'brass');
    }
    c.beginPath();
    c.arc(xb, cy - RB, RB + wB + 5, 0.02, 1.1);
    c.lineWidth = Math.max(2.5, R * 0.08);
    c.strokeStyle = metal(c, 'brass', xb, cy - RB, xb + RB + wB, cy);
    c.stroke();
    // the neck: its cork under the mouthpiece, the octave key on top, the receiver and its screw
    c.fillStyle = '#B98A58';
    rr(c, xm1 - 4, cy - R * 0.33, R * 0.4, R * 0.66, 2);
    c.fill();
    const nk = npts[11];
    cup(c, nk[0] + R * 0.1, nk[1] - nk[2] - R * 0.02, R * 0.2, 'brass');
    bar(c, nk[0] + R * 0.1, nk[1] - nk[2], bodyX + R * 0.4, top(bodyX + R * 0.4) + 3, Math.max(2.5, R * 0.08), 'brass');
    band(c, 'brass', bodyX + R * 0.16, R * 0.3, top(bodyX) - 3, bot(bodyX) + 3);
    pin(c, bodyX + R * 0.16, bot(bodyX) + R * 0.12, R * 0.12, 'brass');
    mouthpiece(c, xm0, xm1, cy, R * 0.5, 'nickel');
    // the rods, and each pearl's cup arm reaching up to them
    const rw = Math.max(2.5, R * 0.08);
    const yr = (x) => top(x) + Math.max(3, R * 0.12);
    const a = kp('L1');
    const b = kp('R3');
    bar(c, a.u - r * 0.9, yr(a.u - r * 0.9), b.u + r * 0.2, yr(b.u + r * 0.2), rw, 'brass');
    for (const id of MAIN) {
      const p = kp(id);
      bar(c, p.u, yr(p.u), p.u, cy - p.r * 0.7, rw * 1.3, 'brass');
    }
    for (const x of [a.u - r * 0.9, (kp('L3').u + kp('R1').u) / 2, b.u + r * 0.2]) post(c, x, yr(x), rw, 'brass');
    // the thumb rest and the strap ring underneath
    const tx = X(0.67);
    bar(c, tx - R * 0.3, bot(tx) + R * 0.12, tx + R * 0.3, bot(tx) + R * 0.12, Math.max(3, R * 0.12), 'brass');
    c.beginPath();
    c.arc(X(0.12), bot(X(0.12)) + R * 0.12, R * 0.12, 0, TAU);
    c.lineWidth = Math.max(1.5, R * 0.05);
    c.strokeStyle = TONE.brass[1];
    c.stroke();
    levers(c, (u, toward) => (toward > 0 ? top(u) + 2 : Math.min(bot(u), u > xb ? cy - RB + Math.sqrt(Math.max(0, (RB + wB) ** 2 - (u - xb) ** 2)) : bot(u)) - 2), 'brass');
  }

  function paintBassoon(c) {
    const { pad, cy, th, bodyX, end, r } = G;
    const R = th / 2;
    const Rw = R * 0.8;                  // the wing joint
    const Rl = R * 0.9;                  // the long joint and the bell
    const xw1 = X(0.565);                // the wing into the boot
    const xbe = X(0.962);                // the boot, under its cap
    const yl = cy - Rw - Rl - Math.max(2, R * 0.06);
    const xl0 = X(0.02);                 // the long joint into the bell joint
    const xbl = pad * 0.2;               // the top of the bell
    const bootTop = yl - Rl - R * 0.05;
    const bootBot = cy + R * 0.92;
    const bulge = (x) => {
      const a = X(0.2);
      const b = X(0.54);
      if (x < a || x > b) return 0;
      return R * 0.22 * Math.sin((Math.PI * (x - a)) / (b - a)) ** 0.6;
    };
    const wTop = () => cy - Rw;
    const wBot = (x) => cy + Rw + bulge(x);
    const swell = (x) => Rl * (x < xl0 ? 1.02 + (0.07 * (xl0 - x)) / (xl0 - xbl) : 1 - (0.06 * (x - xl0)) / (xw1 - xl0));
    const lTop = (x) => yl - swell(x);
    const lBot = (x) => yl + swell(x);
    // the long joint and bell, behind
    shadowed(c, R * 0.6, R * 0.3, () => {
      tubePath(c, xbl, xw1 + R * 0.3, lTop, lBot);
      c.fillStyle = '#4A1A08';
      c.fill();
    });
    tubePath(c, xbl, xw1 + R * 0.3, lTop, lBot);
    c.fillStyle = wood(c, 'bassoon', { scale: 0.8, seed: 2 });
    c.fill();
    across(c, xbl, xw1 + R * 0.3, lTop, lBot, gradient(c, ROUND));
    band(c, 'nickel', xl0, R * 0.2, lTop(xl0) - 1.5, lBot(xl0) + 1.5);
    // the bell's top: its pale ring
    c.fillStyle = gradient(c, [[0, '#9A9284'], [0.3, '#FFFDF4'], [0.5, '#EDE6D4'], [1, '#8C8476']])(lTop(xbl), lBot(xbl));
    rr(c, xbl - 2, lTop(xbl) - 1, R * 0.36, lBot(xbl) - lTop(xbl) + 2, R * 0.12);
    c.fill();
    // the long joint's thumb keys: long levers down its length
    for (let k = 0; k < 3; k++) {
      const y = yl + Rl * (0.2 + k * 0.22);
      bar(c, X(0.06 + k * 0.04), y, X(0.5), y, Math.max(2, R * 0.06), 'nickel');
      cup(c, X(0.06 + k * 0.04), y, Math.max(3, R * 0.13), 'nickel');
    }
    for (const f of [0.12, 0.5]) post(c, X(f), yl + Rl * 0.42, Math.max(2, R * 0.07), 'nickel');
    // the boot, with its metal cap over the turn at the bottom
    shadowed(c, R * 0.7, R * 0.35, () => {
      rr(c, xw1 - R * 0.05, bootTop, xbe - xw1 + R * 0.05, bootBot - bootTop, R * 0.5);
      c.fillStyle = '#4A1A08';
      c.fill();
    });
    rr(c, xw1 - R * 0.05, bootTop, xbe - xw1 + R * 0.05, bootBot - bootTop, R * 0.5);
    c.fillStyle = wood(c, 'bassoon', { scale: 0.9, seed: 5 });
    c.fill();
    c.save();
    rr(c, xw1 - R * 0.05, bootTop, xbe - xw1 + R * 0.05, bootBot - bootTop, R * 0.5);
    c.clip();
    c.fillStyle = gradient(c, ROUND)(bootTop, bootBot);
    c.fillRect(xw1 - R, bootTop - 2, xbe - xw1 + R * 2, bootBot - bootTop + 4);
    c.restore();
    rr(c, xbe - R * 0.3, bootTop + 2, end - 2 - xbe + R * 0.3, bootBot - bootTop - 4, R * 0.45);
    c.fillStyle = metal(c, 'nickel', 0, bootTop, 0, bootBot);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)';
    c.lineWidth = 1;
    c.stroke();
    // the two bores side by side inside it: a soft groove between them
    const yg = cy - Rw - R * 0.04;
    c.fillStyle = 'rgba(40,10,0,.4)';
    c.fillRect(xw1 + R * 0.2, yg - 1, xbe - xw1 - R * 0.4, 2);
    c.fillStyle = 'rgba(255,200,160,.16)';
    c.fillRect(xw1 + R * 0.2, yg + 1, xbe - xw1 - R * 0.4, 2);
    band(c, 'nickel', xw1 + R * 0.12, R * 0.18, bootTop + 2, bootBot - 2);
    // its rods, and the thumb keys' levers under it
    const rw = Math.max(2.2, R * 0.08);
    bar(c, X(0.6), bootTop + R * 0.25, X(0.93), bootTop + R * 0.25, rw, 'nickel');
    for (const f of [0.6, 0.93]) post(c, X(f), bootTop + R * 0.25, rw * 0.9, 'nickel');
    for (let k = 0; k < 2; k++) bar(c, X(0.6 + k * 0.03), bootBot - R * (0.18 + k * 0.16), X(0.9), bootBot - R * (0.18 + k * 0.16), rw, 'nickel');
    // the wing joint, in front
    shadowed(c, R * 0.6, R * 0.3, () => {
      tubePath(c, bodyX, xw1 + R * 0.2, wTop, wBot);
      c.fillStyle = '#4A1A08';
      c.fill();
    });
    tubePath(c, bodyX, xw1 + R * 0.2, wTop, wBot);
    c.fillStyle = wood(c, 'bassoon', { scale: 0.8, seed: 8 });
    c.fill();
    across(c, bodyX, xw1 + R * 0.2, wTop, wBot, gradient(c, ROUND));
    band(c, 'nickel', bodyX + R * 0.1, R * 0.2, cy - Rw - 1.5, cy + Rw + 1.5);
    band(c, 'nickel', xw1 - R * 0.05, R * 0.16, cy - Rw - 1.5, wBot(xw1) + 1.5);
    // the whisper key's lever along the wing's top
    bar(c, X(0.03), cy - Rw + rw, X(0.24), cy - Rw + rw, rw, 'nickel');
    cup(c, X(0.03), cy - Rw + rw * 1.5, Math.max(3, R * 0.14), 'nickel');
    // the bocal, curving from the wing joint to the reed
    const P = [[bodyX + 4, cy - Rw * 0.15], [bodyX - pad * 0.3, cy - R * 0.4], [pad * 0.66, cy + R * 0.6], [pad * 0.42, cy + R * 0.62]];
    const bz = (t) => {
      const u = 1 - t;
      return [0, 1].map((i) => u * u * u * P[0][i] + 3 * u * u * t * P[1][i] + 3 * u * t * t * P[2][i] + t * t * t * P[3][i]);
    };
    const bpts = [];
    for (let k = 0; k <= 30; k++) {
      const [x, y] = bz(k / 30);
      bpts.push([x, y, R * (0.13 - 0.045 * (k / 30))]);
    }
    const boc = sides(bpts);
    shadowed(c, R * 0.3, R * 0.2, () => {
      outline(c, boc);
      c.fillStyle = '#777';
      c.fill();
    });
    metalAlong(c, 'silver', boc);
    pin(c, bpts[6][0], bpts[6][1] - R * 0.12, R * 0.07, 'silver');
    const [ex, ey] = bz(1);
    const [px, py] = bz(0.96);
    const dx = ex - px;
    const dy = ey - py;
    const d = Math.hypot(dx, dy) || 1;
    const rl = pad * 0.36;
    doubleReed(c, ex - (dx / d) * 3, ey - (dy / d) * 3, ex + (dx / d) * rl, ey + (dy / d) * rl, R * 0.78, { thread: ['#9E2A2A', '#F2EEE4'], cork: false });
    // the finger holes' wing, the flick key and the thumb keys
    levers(c, (u, toward) => (toward > 0 ? (u > xw1 ? bootTop : cy - Rw) + 2 : (u > xw1 ? bootBot : wBot(u)) - 2), 'nickel', ['Ab']);
    const ab = kp('Ab');
    bar(c, ab.u, ab.v, ab.u - r * 0.6, bootTop + R * 0.25, Math.max(3, ab.r * 0.3), 'nickel');
  }

  /* An engraved spray of leaves, as on a saxophone's bell. */
  function engrave(c, x, y, size) {
    c.save();
    c.translate(x, y);
    c.lineCap = 'round';
    const line = (w, col) => {
      c.lineWidth = w;
      c.strokeStyle = col;
      c.stroke();
    };
    const stem = () => {
      c.beginPath();
      c.moveTo(-size * 0.45, size * 0.35);
      c.bezierCurveTo(-size * 0.2, size * 0.1, size * 0.1, size * 0.25, size * 0.38, -size * 0.2);
    };
    stem();
    line(Math.max(1.2, size * 0.025), 'rgba(255,240,190,.55)');
    stem();
    line(Math.max(0.8, size * 0.014), 'rgba(110,70,10,.75)');
    const curl = (cx, cy2, r0, turn) => {
      c.beginPath();
      for (let k = 0; k <= 40; k++) {
        const a = (k / 40) * Math.PI * 1.6 * turn;
        const rr2 = r0 * (1 - k / 52);
        const px = cx + Math.cos(a) * rr2;
        const py = cy2 + Math.sin(a) * rr2;
        if (k) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      line(Math.max(0.8, size * 0.014), 'rgba(110,70,10,.7)');
    };
    curl(-size * 0.22, size * 0.02, size * 0.13, 1);
    curl(size * 0.14, size * 0.02, size * 0.1, -1);
    curl(size * 0.3, -size * 0.32, size * 0.08, 1);
    for (const [lx, ly, a] of [[-size * 0.32, size * 0.22, -0.9], [-size * 0.06, size * 0.16, 0.5], [size * 0.2, size * 0.05, -1.2], [size * 0.3, -size * 0.08, 0.3]]) {
      c.save();
      c.translate(lx, ly);
      c.rotate(a);
      c.beginPath();
      c.ellipse(size * 0.07, 0, size * 0.08, size * 0.03, 0, 0, TAU);
      line(Math.max(0.7, size * 0.012), 'rgba(110,70,10,.7)');
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(size * 0.14, 0);
      line(Math.max(0.5, size * 0.008), 'rgba(110,70,10,.5)');
      c.restore();
    }
    c.restore();
  }

  /* A key as it is now, up or pressed. Returns its style. */
  function drawKey(g, k, p, dn) {
    const [id, , side] = k;
    const { u, v, r } = p;
    const style = side === 0 ? look.key : kind === 'clarinet' && id === 'T' ? 'ring' : 'touch';
    const kindM = look.metal;
    const [md, mm, ml] = TONE[kindM];
    g.save();
    if (dn) {
      g.shadowColor = 'rgba(255,205,100,.85)';
      g.shadowBlur = r * 0.7;
    } else {
      g.shadowColor = 'rgba(0,0,0,.45)';
      g.shadowBlur = r * 0.25;
      g.shadowOffsetY = r * 0.12;
    }
    const warm = (x, y, rad) => {
      const wg = g.createRadialGradient(x - rad * 0.3, y - rad * 0.35, rad * 0.05, x, y, rad);
      wg.addColorStop(0, WARM[0]);
      wg.addColorStop(0.6, WARM[1]);
      wg.addColorStop(1, WARM[2]);
      return wg;
    };
    if (style === 'cup' || style === 'plate' || style === 'pearl') {
      const R0 = r * 0.9;
      g.beginPath();
      g.arc(u, v, R0, 0, TAU);
      if (style === 'pearl') {
        g.fillStyle = metal(g, 'brass', u - R0, v - R0, u + R0, v + R0);
      } else {
        const cg = g.createRadialGradient(u - R0 * 0.35, v - R0 * 0.4, R0 * 0.05, u, v, R0);
        cg.addColorStop(0, '#FFFFFF');
        cg.addColorStop(0.45, dn ? '#F6E6B8' : ml);
        cg.addColorStop(0.85, dn ? '#D2AA58' : mm);
        cg.addColorStop(1, dn ? '#8E6A26' : md);
        g.fillStyle = cg;
      }
      g.fill();
      g.restore();
      g.beginPath();
      g.arc(u, v, R0, 0, TAU);
      g.lineWidth = Math.max(1, R0 * 0.05);
      g.strokeStyle = 'rgba(30,36,40,.5)';
      g.stroke();
      g.beginPath();
      g.arc(u, v, R0 * 0.82, 0, TAU);
      g.strokeStyle = 'rgba(255,255,255,.45)';
      g.lineWidth = 1;
      g.stroke();
      if (style === 'cup') {
        // the open hole in the middle of the cup, and its raised rim
        const hr = R0 * 0.3;
        g.beginPath();
        g.arc(u, v, hr * 1.3, 0, TAU);
        g.fillStyle = metal(g, 'silver', u - hr, v - hr, u + hr, v + hr);
        g.fill();
        g.beginPath();
        g.arc(u, v, hr, 0, TAU);
        g.fillStyle = dn ? warm(u, v, hr) : '#161B1E';
        g.fill();
      } else if (style === 'plate') {
        g.beginPath();
        g.arc(u, v, R0 * 0.62, 0, TAU);
        g.strokeStyle = 'rgba(60,70,76,.35)';
        g.stroke();
        g.beginPath();
        g.arc(u, v, R0 * 0.08, 0, TAU);
        g.fillStyle = 'rgba(40,46,50,.6)';
        g.fill();
      } else {
        // mother of pearl, set in the cup, its colours shifting
        const pr = R0 * 0.66;
        g.beginPath();
        g.arc(u, v, pr, 0, TAU);
        g.fillStyle = dn ? warm(u, v, pr) : (() => {
          const pg = g.createRadialGradient(u - pr * 0.3, v - pr * 0.35, pr * 0.05, u, v, pr);
          pg.addColorStop(0, '#FFFFFF');
          pg.addColorStop(0.5, '#F1ECF4');
          pg.addColorStop(0.85, '#D9D4E6');
          pg.addColorStop(1, '#AFA6C0');
          return pg;
        })();
        g.fill();
        if (!dn && g.createConicGradient) {
          const sh = g.createConicGradient(0.6, u, v);
          [['#FFC8DC', 0], ['#C8F0E6', 0.25], ['#D4D0FF', 0.5], ['#FFE6C0', 0.75], ['#FFC8DC', 1]].forEach(([col, o]) => sh.addColorStop(o, col));
          g.globalAlpha = 0.28;
          g.fillStyle = sh;
          g.fill();
          g.globalAlpha = 1;
        }
        g.strokeStyle = 'rgba(90,60,10,.6)';
        g.lineWidth = 1;
        g.stroke();
      }
      if (dn) {
        g.beginPath();
        g.arc(u, v, R0 * 0.94, 0, TAU);
        g.strokeStyle = '#FFF3D0';
        g.lineWidth = 2;
        g.stroke();
      }
      return style;
    }
    if (style === 'ring' || style === 'hole') {
      const hole = style === 'ring' ? r * 0.62 : r * 0.36;
      if (style === 'hole') {
        // the wood round a finger hole, worn smooth and paler by fingers
        g.restore();
        g.save();
        g.beginPath();
        g.arc(u, v, r * 0.84, 0, TAU);
        const wg = g.createRadialGradient(u, v, hole, u, v, r * 0.84);
        wg.addColorStop(0, 'rgba(255,214,170,.28)');
        wg.addColorStop(0.7, 'rgba(255,214,170,.14)');
        wg.addColorStop(1, 'rgba(255,214,170,0)');
        g.fillStyle = wg;
        g.fill();
      }
      g.beginPath();
      g.arc(u, v, dn ? r * 0.7 : hole, 0, TAU);
      if (dn) g.fillStyle = warm(u, v, r * 0.7);
      else {
        const hg = g.createRadialGradient(u + hole * 0.15, v + hole * 0.2, 1, u, v, hole);
        hg.addColorStop(0, '#000');
        hg.addColorStop(0.75, '#0E0A08');
        hg.addColorStop(1, style === 'ring' ? '#3A2E28' : '#5A2A14');
        g.fillStyle = hg;
      }
      g.fill();
      g.restore();
      if (style === 'ring' && !dn) {
        g.beginPath();
        g.arc(u, v, hole + Math.max(1.5, r * 0.09), 0, TAU);
        g.lineWidth = Math.max(3, r * 0.17);
        g.strokeStyle = metal(g, kindM, u - hole, v - hole, u + hole * 0.6, v + hole);
        g.stroke();
      }
      if (dn) {
        g.beginPath();
        g.arc(u, v, r * 0.72, 0, TAU);
        g.strokeStyle = '#FFF3D0';
        g.lineWidth = 2;
        g.stroke();
      }
      return style;
    }
    // a side key's touch: a polished spoon of metal
    const rx = r * 1.02;
    const ry = r * 0.84;
    g.beginPath();
    g.ellipse(u, v, rx, ry, 0, 0, TAU);
    const tg = g.createRadialGradient(u - rx * 0.35, v - ry * 0.45, 1, u, v, rx);
    tg.addColorStop(0, '#FFFFFF');
    tg.addColorStop(0.4, dn ? WARM[0] : ml);
    tg.addColorStop(0.8, dn ? WARM[1] : mm);
    tg.addColorStop(1, dn ? WARM[2] : md);
    g.fillStyle = tg;
    g.fill();
    g.restore();
    g.beginPath();
    g.ellipse(u, v, rx, ry, 0, 0, TAU);
    g.lineWidth = dn ? 2 : 1;
    g.strokeStyle = dn ? '#FFF3D0' : 'rgba(30,36,40,.45)';
    g.stroke();
    g.beginPath();
    g.ellipse(u, v + ry * 0.08, rx * 0.66, ry * 0.56, 0, Math.PI * 1.1, Math.PI * 1.9);
    g.strokeStyle = 'rgba(255,255,255,.55)';
    g.lineWidth = 1;
    g.stroke();
    return style;
  }

  // ---- computer keys ----
  function keydown(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Shift') { shiftHigh = true; update(); return; }
    if (e.key === ' ') { e.preventDefault(); spaceBlow = true; update(true); return; }
    const k = keyset.find((x) => x[4] === e.key.toLowerCase());
    if (k) { press(k[0], `key:${k[0]}`); update(); }
  }
  function keyup(e) {
    if (e.key === 'Shift') { shiftHigh = false; update(); return; }
    if (e.key === ' ') { spaceBlow = false; update(); return; }
    const k = keyset.find((x) => x[4] === e.key.toLowerCase());
    if (k) { release(k[0], `key:${k[0]}`); update(); }
  }
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);

  // Listen: the fingers go down for each note, and the breath plays it (tongued, or slurred).
  const fingering = new Map();   // written note -> { keys, high }
  // The usual fingerings first, then the same with the octave (or register) key or faster air.
  const extra = kind === 'clarinet' ? 'Rg' : kind === 'flute' ? null : 'Oct';
  for (const hi of [false, true]) {
    for (const [keys] of FINGERINGS[kind]) {
      const k = new Set(keys);
      if (hi && extra) k.add(extra);
      const w = writtenNote(kind, k, hi && !extra);
      if (!fingering.has(w)) fingering.set(w, { keys: k, high: hi && !extra });
    }
  }
  let autoNote = 0;
  const lift = () => { for (const [k] of keyset) release(k, 'auto'); };
  kit.performer({
    can: (e) => e.midi != null && fingering.has(Math.round(e.midi + written)),
    down(e) {
      const f = fingering.get(Math.round(e.midi + written));
      lift();
      for (const k of f.keys) press(k, 'auto');
      autoBlow = { high: f.high, level: 0.45 + (e.vel ?? 0.7) * 0.45 };
      update(!e.glide);
      return ++autoNote;
    },
    up(n) {
      if (n !== autoNote) return;
      autoBlow = null;
      lift();
      update();
    },
    finish() { autoBlow = null; lift(); update(); },
  });

  if (ex.opts.vibrato) {
    kit.toggle({
      label: 'Vibrato',
      on: true,
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c2-5 4-5 5 0s3 5 5 0 3-5 5 0 3 5 5 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
      onChange: (on) => voice.vibrato(on),
    });
  }

  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    voice.stop(0.1);
    s.destroy();
  };
}

export { writtenNote };
