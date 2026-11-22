/* Drawings of each instrument for the hall and the placards (inline SVG, 120 × 120). Each shows
   the whole instrument in the pose it is best known by, drawn from its real measurements, in the
   woods, metals and heads of its exhibit, and lit as the exhibits are, from the upper left.
   Round tubes and bells are shaded where that light would catch them (tube, cone); drums, bells
   and the piano are seen from a little above, through a small camera (cam). */


const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const f = (n) => Math.round(n * 10) / 10;
const xy = (p) => `${f(p[0])} ${f(p[1])}`;
const poly = (pts, close = true) => `M${pts.map(xy).join('L')}${close ? 'Z' : ''}`;
const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

/* A smooth path through points (Catmull-Rom), and several smooth runs joined at corners (a
   violin's corners, a guitar's horns): each run starts where the one before it ended. */
function smooth(pts, closed = false) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  let d = `M${xy(pts[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [a, b, c, e] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${xy([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6])} ${xy([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6])} ${xy(c)}`;
  }
  return closed ? `${d}Z` : d;
}
function runs(pieces, closed = true) {
  const d = pieces.map((p, k) => (k ? smooth(p).replace(/^M[^C]*/, '') : smooth(p))).join('');
  return closed ? `${d}Z` : d;
}
/* A symmetric outline from its right half (runs from the top middle down to the bottom middle). */
function mirrored(pieces) {
  const back = pieces.slice().reverse().map((p) => p.slice().reverse().map(([x, y]) => [-x, y]));
  return runs([...pieces, ...back]);
}
/* Points along a cubic Bézier. */
function bez(p0, p1, p2, p3, n = 16) {
  return range(n + 1, (k) => {
    const t = k / n;
    const a = (1 - t) ** 3;
    const b = 3 * t * (1 - t) ** 2;
    const c = 3 * t * t * (1 - t);
    const e = t ** 3;
    return [a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]];
  });
}
const arcPts = (cx, cy, r, a0, a1, n = 12) => range(n + 1, (k) => {
  const a = (a0 + ((a1 - a0) * k) / n) * DEG;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});

/* ---- materials ---- */
const stops = (s) => s.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a == null ? '' : ` stop-opacity="${a}"`}/>`).join('');
const lin = (id, v, s, more = '') => `<linearGradient id="${id}" x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}"${more}>${stops(s)}</linearGradient>`;
const rad = (id, v, s, more = '') => `<radialGradient id="${id}" cx="${v[0]}" cy="${v[1]}" r="${v[2]}"${v.length > 3 ? ` fx="${v[3]}" fy="${v[4]}"` : ''}${more}>${stops(s)}</radialGradient>`;
const across = (id, s) => lin(id, [0, 0, 1, 0], s) + lin(`${id}Y`, [0, 0, 0, 1], s);

const BRASS = [[0, '#5E3E0C'], [0.07, '#9C6F1F'], [0.2, '#F4DA8E'], [0.3, '#FFF3C8'], [0.4, '#DDB04E'], [0.66, '#AE7F28'], [0.86, '#80571A'], [1, '#5A3B0B']];
const SILVER = [[0, '#4C5861'], [0.08, '#95A2AB'], [0.2, '#EEF2F4'], [0.3, '#FFFFFF'], [0.42, '#C2CCD2'], [0.68, '#88959E'], [0.88, '#6A7780'], [1, '#48535C']];
const CHROME = [[0, '#2E373D'], [0.1, '#A9B4BB'], [0.22, '#FFFFFF'], [0.34, '#B7C2C9'], [0.5, '#4D5960'], [0.62, '#77838B'], [0.82, '#E3E9EC'], [1, '#56626A']];

/* Gradients any drawing can use by name: each drawing gets the ones it refers to. */
const LIB = {
  shadow: rad('shadow', [0.5, 0.5, 0.5], [[0, '#000', 0.5], [0.55, '#000', 0.24], [1, '#000', 0]]),
  cyl: across('cyl', [[0, '#000', 0.45], [0.1, '#000', 0.12], [0.26, '#fff', 0.3], [0.38, '#fff', 0.08], [0.58, '#000', 0.04], [0.84, '#000', 0.3], [1, '#000', 0.6]]),
  brassC: across('brassC', BRASS),
  silverC: across('silverC', SILVER),
  chromeC: across('chromeC', CHROME),
  dome: rad('dome', [0.38, 0.32, 0.78], [[0, '#fff', 0.55], [0.35, '#fff', 0.12], [0.7, '#000', 0], [1, '#000', 0.35]]),
  bellIn: rad('bellIn', [0.5, 0.5, 0.5], [[0, '#1E1203'], [0.4, '#4E3409'], [0.75, '#A67B24'], [0.93, '#E9C46A'], [1, '#FCEBB0']]),
  pearl: rad('pearl', [0.4, 0.35, 0.7], [[0, '#FFFFFF'], [0.5, '#F3EEE2'], [0.85, '#D2C8B3'], [1, '#A39780']]),
  cup: rad('cup', [0.38, 0.34, 0.75], [[0, '#FFFFFF'], [0.4, '#E2E8EC'], [0.8, '#98A4AD'], [1, '#606C75']]),
  chromeD: rad('chromeD', [0.42, 0.38, 0.62], [[0, '#FFFFFF'], [0.35, '#C9D2D8'], [0.6, '#7C8890'], [0.8, '#D9E0E4'], [1, '#56626A']]),
  frost: rad('frost', [0.42, 0.38, 0.7], [[0, '#FFFFFF'], [0.6, '#F1EEE6'], [1, '#D8D2C4']]),
  mapleC: across('mapleC', [[0, '#7A4A1C'], [0.18, '#D9A05A'], [0.34, '#F4D29A'], [0.6, '#C98A44'], [1, '#6A3E14']]),
  goldC: across('goldC', [[0, '#7A5313'], [0.2, '#E9C46A'], [0.35, '#FFF1B8'], [0.6, '#C99A3A'], [1, '#6A4810']]),
  walnut: across('walnut', [[0, '#2A170A'], [0.2, '#6B4022'], [0.36, '#8A5634'], [0.62, '#5A341A'], [1, '#26140A']]),
  headW: rad('headW', [0.42, 0.36, 0.7], [[0, '#FFFFFF'], [0.65, '#F5F2EA'], [1, '#D9D2C2']]),
  calf: rad('calf', [0.4, 0.35, 0.72], [[0, '#FBF3DE'], [0.6, '#EBDDB8'], [1, '#C9B184']]),
  hide: rad('hide', [0.4, 0.35, 0.72], [[0, '#F6E6C2'], [0.55, '#E3C68E'], [1, '#B48A50']]),
  copper: rad('copper', [0.34, 0.12, 0.9], [[0, '#FFD6B0'], [0.22, '#EE9A60'], [0.5, '#BC6331'], [0.8, '#7E3618'], [1, '#5A240E']]),
  cymbal: rad('cymbal', [0.4, 0.36, 0.7], [[0, '#FFF4C4'], [0.3, '#EBC76C'], [0.66, '#C99A3A'], [1, '#8A6418']]),
  ball: rad('ball', [0.36, 0.32, 0.72], [[0, '#FFF6D2'], [0.3, '#E9C46A'], [0.72, '#A87A22'], [1, '#5A3A0C']]),
  ball2: rad('ball2', [0.36, 0.32, 0.72], [[0, '#FFFFFF'], [0.35, '#D9E0E4'], [0.75, '#7C8890'], [1, '#3E4951']]),
  egg: rad('egg', [0.38, 0.3, 0.75], [[0, '#FFC678'], [0.45, '#F08A24'], [0.85, '#B8560E'], [1, '#8A3A08']]),
  enamel: lin('enamel', [0, 0, 1, 1], [[0, '#fff', 0.3], [0.3, '#fff', 0.05], [0.6, '#fff', 0], [1, '#fff', 0.12]]),
  rubber: rad('rubber', [0.36, 0.3, 0.7], [[0, '#8A7A6A'], [0.4, '#3A3430'], [1, '#141210']]),
  koa: lin('koa', [0, 0, 1, 1], [[0, '#E8A860'], [0.4, '#C27A34'], [0.7, '#A85E22'], [1, '#7A3E14']]),
  cream: across('cream', [[0, '#9C927C'], [0.2, '#F4EEDF'], [0.35, '#FFFDF6'], [0.7, '#DDD3BD'], [1, '#A59A82']]),
  bcup: rad('bcup', [0.38, 0.34, 0.75], [[0, '#FFF6D2'], [0.4, '#E9C46A'], [0.8, '#A87A22'], [1, '#6A4810']]),
};

/* ---- lit tubes ----
   The light comes from the upper left and toward you. Across a round tube (u from -1 on one
   side to 1 on the other) the brightest place is where its surface faces the light most, which
   moves across the tube as the tube turns; cone() follows it along a tube of any width, tube()
   fakes it for even ones by drawing lighter, narrower strokes moved toward the light. */
const L3 = [-0.45, -0.6, 0.66];
const H3 = (() => { const h = [L3[0], L3[1], L3[2] + 1]; const l = Math.hypot(...h); return h.map((v) => v / l); })();
let spin = 0;   // the turn of the drawing being made, in degrees: its light turns the other way
const lightIn = (v) => {
  const c = Math.cos(-spin * DEG);
  const s = Math.sin(-spin * DEG);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
};

const TONE = {
  brass: { edge: '#4A3008', deep: '#7A5313', shade: '#A97A22', base: '#D2A23D', light: '#F2D47C', glint: '#FFF8DF', rim: '#C5973A' },
  silver: { edge: '#3E4951', deep: '#66727B', shade: '#8B979F', base: '#B8C2C9', light: '#E8EDF0', glint: '#FFFFFF', rim: '#A9B4BB' },
  chrome: { edge: '#262E33', deep: '#3F4A51', shade: '#6C7880', base: '#AAB5BC', light: '#F2F5F7', glint: '#FFFFFF', rim: '#C9D2D7' },
  black: { edge: '#000000', deep: '#070606', shade: '#121110', base: '#22201E', light: '#3C3835', glint: '#9A938C', rim: '#2E2B28' },
  rose: { edge: '#1E0804', deep: '#3A1208', shade: '#5A1E10', base: '#7A2C18', light: '#A64A2C', glint: '#E2A68A', rim: '#6A2614' },
  ebony: { edge: '#000000', deep: '#0B0908', shade: '#171310', base: '#2A231E', light: '#4A3F37', glint: '#A08F80', rim: '#3A3029' },
  maple: { edge: '#2A0C03', deep: '#4E1A08', shade: '#6E2A10', base: '#8E3D1B', light: '#B9673A', glint: '#E9B48A', rim: '#7F3517' },
  wood: { edge: '#3A2008', deep: '#5E3611', shade: '#80501E', base: '#A8692C', light: '#CF9555', glint: '#F2D2A4', rim: '#94602A' },
};

function tube(d, w, tone = 'brass', cap = 'round') {
  const t = TONE[tone];
  const [lx, ly] = lightIn([-0.6, -0.8, 0]);
  const o = (k) => (k ? ` transform="translate(${f(lx * k * w)} ${f(ly * k * w)})"` : '');
  const layer = (c, k, off) => `<path d="${d}" stroke="${c}" stroke-width="${f(w * k) || 0.1}"${o(off)}/>`;
  return `<g fill="none" stroke-linecap="${cap}" stroke-linejoin="round">${layer(t.edge, 1, 0)}${layer(t.deep, 0.84, 0.03)}${layer(t.base, 0.62, 0.09)}${layer(t.light, 0.3, 0.19)}${layer(t.glint, 0.1, 0.26)}</g>`;
}

function cone(pts, rad, tone = 'brass', { edge = null, glint = true } = {}) {
  const t = TONE[tone];
  const n = pts.length;
  const R = (i) => (typeof rad === 'function' ? rad(i, i / (n - 1)) : rad);
  const N = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l];
  });
  const L = lightIn(L3);
  const H = lightIn(H3);
  const peak = (v) => N.map(([x, y]) => { const a = x * v[0] + y * v[1]; return a / Math.hypot(a, v[2]); });
  const hd = peak(L);
  const hs = peak(H);
  const at = (i, u) => [pts[i][0] + N[i][0] * u * R(i), pts[i][1] + N[i][1] * u * R(i)];
  const band = (lo, hi, c) => {
    const A = [];
    const B = [];
    let any = false;
    for (let i = 0; i < n; i++) {
      const a = clamp(lo(i));
      const b = Math.max(a, clamp(hi(i)));
      if (b - a > 0.02) any = true;
      A.push(at(i, a));
      B.push(at(i, b));
    }
    return any ? `<path d="${poly(A.concat(B.reverse()))}" fill="${c}"/>` : '';
  };
  const away = (k, c) => band(() => -1, (i) => hd[i] - k, c) + band((i) => hd[i] + k, () => 1, c);
  const ew = edge ?? Math.max(0.3, Math.min(...pts.map((_, i) => R(i))) * 0.08);
  return `<path d="${poly(pts.map((_, i) => at(i, -1)).concat(pts.map((_, i) => at(i, 1)).reverse()))}" fill="${t.base}" stroke="${t.edge}" stroke-width="${f(ew * 2)}" stroke-linejoin="round"/>`
    + away(0.5, t.shade) + away(0.95, t.deep) + away(1.5, t.rim)
    + band((i) => hd[i] - 0.32, (i) => hd[i] + 0.32, t.light)
    + (glint ? band((i) => hs[i] - 0.08, (i) => hs[i] + 0.08, t.glint) : '');
}
const straight = (x0, y0, x1, y1, n = 2) => range(n + 1, (k) => [lerp(x0, x1, k / n), lerp(y0, y1, k / n)]);

/* A soft shadow on the floor. */
const shadow = (cx, cy, rx, ry, a = 1) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#shadow)"${a === 1 ? '' : ` opacity="${a}"`}/>`;
/* A drawing made in its own units (millimetres, mostly), turned and fitted into the frame. */
function place(body, { at = [60, 60], turn = 0, scale = 1, about = [0, 0] }) {
  return `<g transform="translate(${f(at[0])} ${f(at[1])})${turn ? ` rotate(${turn})` : ''} scale(${scale}) translate(${f(-about[0])} ${f(-about[1])})">${body}</g>`;
}
// Where to put a drawing made in its own units, turned by `turn`, so it fills `box`.
function fitTurned(pts, turn, [x0, y0, x1, y1]) {
  const c = Math.cos(turn * DEG);
  const sn = Math.sin(turn * DEG);
  const q = pts.map(([x, y]) => [x * c - y * sn, x * sn + y * c]);
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  const [ax, bx, ay, by] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((x1 - x0) / (bx - ax), (y1 - y0) / (by - ay));
  return { turn, scale, about: [0, 0], at: [(x0 + x1) / 2 - ((ax + bx) / 2) * scale, (y0 + y1) / 2 - ((ay + by) / 2) * scale] };
}

function turned(deg, fn) {
  spin = deg;
  try { return fn(); } finally { spin = 0; }
}

/* ---- brass ---- */

// A piston valve seen side on: casing, knurled caps, the stem and its pearl-topped button.
function piston(x, top, bot, w, { cap = 8, btn = 8.6, stem = 15, k = 1 } = {}) {
  const h = w / 2;
  const knurl = (y0, y1, hw) => range(Math.round((y1 - y0) / (1.6 * k)), (i) => `M${f(x - hw)} ${f(y0 + 1 + i * 1.6 * k)}h${f(hw * 2)}`).join('');
  const yb = top - cap - stem;
  return `<rect x="${f(x - 2.3 * k)}" y="${f(yb)}" width="${f(4.6 * k)}" height="${f(stem + 2)}" fill="url(#silverC)"/>`
    + `<rect x="${f(x - btn)}" y="${f(yb - 5 * k)}" width="${f(btn * 2)}" height="${f(5 * k)}" rx="${f(1.2 * k)}" fill="url(#brassC)"/>`
    + `<ellipse cx="${f(x)}" cy="${f(yb - 5 * k)}" rx="${f(btn)}" ry="${f(2.6 * k)}" fill="url(#pearl)" stroke="#8A6A2A" stroke-width="${f(0.6 * k)}"/>`
    + `<rect x="${f(x - h)}" y="${f(top)}" width="${f(w)}" height="${f(bot - top)}" fill="url(#brassC)" stroke="#5A3B0B" stroke-width="${f(0.7 * k)}"/>`
    + `<rect x="${f(x - h - 1.4 * k)}" y="${f(top - cap)}" width="${f(w + 2.8 * k)}" height="${f(cap)}" rx="${f(1.4 * k)}" fill="url(#brassC)" stroke="#5A3B0B" stroke-width="${f(0.7 * k)}"/>`
    + `<path d="${knurl(top - cap, top, h + 1.4 * k)}" stroke="#6B4A12" stroke-width="${f(0.5 * k)}" opacity=".7"/>`
    + `<rect x="${f(x - h - 1 * k)}" y="${f(bot)}" width="${f(w + 2 * k)}" height="${f(cap * 1.2)}" rx="${f(1.4 * k)}" fill="url(#brassC)" stroke="#5A3B0B" stroke-width="${f(0.7 * k)}"/>`
    + `<path d="${knurl(bot, bot + cap * 1.2, h + 1 * k)}" stroke="#6B4A12" stroke-width="${f(0.5 * k)}" opacity=".7"/>`;
}
// A bell's open end seen a little from the front: its throat, and the bright rolled rim.
function rim(cx, cy, rx, ry, rot, w) {
  return `<g transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#bellIn)"/>`
    + `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="none" stroke="#5A3B0B" stroke-width="${f(w * 1.6)}"/>`
    + `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="none" stroke="#E9C46A" stroke-width="${f(w)}"/>`
    + `<path d="M${f(cx - rx * 0.35)} ${f(cy - ry * 0.94)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx - rx * 0.98)} ${f(cy + ry * 0.2)}" fill="none" stroke="#FFF6D6" stroke-width="${f(w * 0.5)}"/></g>`;
}
// A mouthpiece: the cup's rim at x0, the shank narrowing to x1 (the receiver).
function mouthpiece(x0, x1, y, rRim, rShank, tone = 'silver') {
  const xs = range(14, (k) => lerp(x0, x1, k / 13));
  const r = (i) => rShank + (rRim - rShank) * Math.pow(1 - i / 13, 3.2);
  return cone(xs.map((x) => [x, y]), r, tone)
    + `<ellipse cx="${f(x0)}" cy="${f(y)}" rx="${f(rRim * 0.22)}" ry="${f(rRim)}" fill="#E8EDF0" stroke="#4C5861" stroke-width="${f(rRim * 0.08)}"/>`
    + `<ellipse cx="${f(x0 - rRim * 0.04)}" cy="${f(y)}" rx="${f(rRim * 0.12)}" ry="${f(rRim * 0.62)}" fill="#59646C"/>`;
}

function trumpet() {
  return turned(-14, () => {
    const R = 61.5;
    const RIM = 470;
    const bes = (x) => R * (13 / (RIM - x + 13)) ** 0.75;
    const b0 = bes(42);
    const rb = (x) => 5.9 + 1.2 * clamp((x - 42) / (RIM - 42), 0, 1) + ((R - 7.1) * Math.max(0, bes(x) - b0)) / (R - b0);
    const xs = range(32, (k) => 42 + (RIM - 42) * (1 - (1 - k / 31) ** 2.6));
    const W = 11.6;
    let s = '';
    s += tube('M186 19H258A15.5 15.5 0 0 1 258 50H186', W);
    s += tube('M186 28H221A9 9 0 0 1 221 46H186', W);
    s += `<path d="M222 46.5c2 6 8 9 12 8" fill="none" stroke="#B5852B" stroke-width="2.4"/><circle cx="238" cy="55" r="4.4" fill="none" stroke="#C99A3A" stroke-width="2"/>`;
    s += tube('M120 25H97A7.6 7.6 0 0 0 97 40.2H120', W);
    s += tube('M149 66V77A7 7 0 0 0 163 77V66', W);
    s += tube('M50 0H42A30 30 0 0 0 42 60H124', W);
    s += cone(xs.map((x) => [x, 0]), (i) => rb(xs[i]));
    for (const x of [130, 156, 182]) s += piston(x, -12, 60, 19.5);
    s += tube('M-14 18.5H188', W * 0.9);
    s += `<rect x="-22" y="11.5" width="16" height="14" rx="2" fill="url(#brassCY)" stroke="#5A3B0B" stroke-width=".7"/>`;
    s += `<path d="M66 18.5h3M100 18.5h3" stroke="#7A5313" stroke-width="13"/><path d="M196 0v19M280 0v19" stroke="#B5852B" stroke-width="2.6"/>`;
    s += mouthpiece(-92, -20, 18.5, 13, 4.6);
    s += rim(RIM, 0, R * 0.17, R, 0, 2.6);
    return place(s, { at: [59.4, 61], turn: -14, scale: 0.2, about: [194, 10] });
  });
}

function horn() {
  const r = 6.6;
  const W = r * 2;
  const Rc = 142;
  let s = '';
  // the bell: out of the bottom of the outer wrap, round to the right, and flaring
  const bp = bez([0, Rc], [95, Rc + 6], [170, 128], [252, 100], 30);
  const q0 = (0.08 / 1.08) ** 0.8;
  const rb = (i, t) => r + (150 - r) * (((0.08 / (1 - t + 0.08)) ** 0.8 - q0) / (1 - q0));
  s += cone(bp, rb);
  // the coil
  for (const rr of [Rc, Rc - 2.4 * r, Rc - 4.8 * r]) s += tube(`M${-rr} 0a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0`, W);
  for (const a of [-58, 22, 148]) {
    const c = Math.cos(a * DEG);
    const n = Math.sin(a * DEG);
    s += `<path d="M${f(c * (Rc + 4))} ${f(n * (Rc + 4))}L${f(c * (Rc - 4.8 * r - 4))} ${f(n * (Rc - 4.8 * r - 4))}" stroke="#9C6F1F" stroke-width="3"/>`;
  }
  // the valves' slides, the tubing between them, and the rotors
  const xs = [-40, 0, 40];
  [44, 30, 56].forEach((dp, i) => { const x = xs[i]; s += tube(`M${x - 8.5} -6V${f(dp * 0.78)}A8.5 8.5 0 0 0 ${x + 8.5} ${f(dp * 0.78)}V-6`, W * 0.9); });
  s += tube('M-60 -30C-52 -18 -48 -16 -40 -16H40C60 -16 74 -8 86 10', W);
  for (const x of xs) {
    s += `<circle cx="${x}" cy="-16" r="15" fill="url(#bcup)" stroke="#4A3008" stroke-width="1"/><circle cx="${x}" cy="-16" r="8" fill="none" stroke="#7A5313" stroke-width="1.4"/><circle cx="${x}" cy="-16" r="3" fill="#E8EDF0" stroke="#59646C"/>`;
    s += `<path d="M${x + 2} -18L${x - 6} -56" stroke="#9AA6AF" stroke-width="3" stroke-linecap="round"/><ellipse cx="${x - 7}" cy="-64" rx="12" ry="8" fill="url(#bcup)" stroke="#4A3008" stroke-width="1"/>`;
  }
  // the leadpipe and mouthpiece, from the upper left
  s += cone(bez([-214, -80], [-150, -80], [-96, -52], [-60, -30], 14), (i, t) => 4.6 + 1.6 * t);
  s += `<rect x="-222" y="-87" width="18" height="14" rx="2" fill="url(#brassCY)" stroke="#5A3B0B" stroke-width=".7"/>`;
  s += mouthpiece(-280, -214, -80, 12, 4.4);
  s += rim(252, 100, 62, 150, -17, 4);
  return place(s, { at: [58.7, 58], scale: 0.19, about: [16, 52] });
}

function trombone() {
  return turned(-30, () => {
    const R = 108;
    const RIM = 560;
    const sep = 76;
    const yB = -128;
    const W = 13.4;
    const bes = (x) => R * (14 / (RIM - x + 14)) ** 0.75;
    const b0 = bes(-210);
    const rb = (x) => 6.4 + 1.6 * clamp((x + 210) / (RIM + 210), 0, 1) + ((R - 8) * Math.max(0, bes(x) - b0)) / (R - b0);
    const xs = range(34, (k) => -210 + (RIM + 210) * (1 - (1 - k / 33) ** 2.8));
    let s = '';
    // the bell section: the neck from the slide, back round the tuning slide, and out to the bell
    s += tube(`M64 ${sep}V-62H-215`, W);
    s += tube(`M-215 -62A33 33 0 0 0 -215 ${yB}`, W, 'silver');
    s += cone(xs.map((x) => [x, yB]), (i) => rb(xs[i]));
    s += `<path d="M120 -62V${yB + 7}M380 -10V${yB + 11}" stroke="#B5852B" stroke-width="3.4"/>`;
    s += `<rect x="-232" y="-71" width="14" height="18" rx="2" fill="url(#silverC)"/><rect x="-232" y="${yB - 9}" width="14" height="18" rx="2" fill="url(#silverC)"/>`;
    // the slide: two long tubes, the crook at the far end, and the braces
    s += tube(`M40 0H736A38 38 0 0 1 736 ${sep}H40`, W * 0.92, 'silver');
    s += `<path d="M736 ${sep + 9}h18" stroke="#2A2522" stroke-width="10" stroke-linecap="round"/>`;
    s += `<rect x="94" y="-5" width="11" height="${sep + 10}" rx="3" fill="url(#silverC)"/><rect x="680" y="-4" width="9" height="${sep + 8}" rx="3" fill="url(#brassC)"/>`;
    s += `<rect x="36" y="-9" width="22" height="18" rx="2" fill="url(#silverCY)"/><rect x="36" y="${sep - 9}" width="22" height="18" rx="2" fill="url(#silverCY)"/>`;
    s += `<rect x="290" y="-8.5" width="16" height="17" rx="2" fill="url(#brassCY)"/><rect x="290" y="${sep - 8.5}" width="16" height="17" rx="2" fill="url(#brassCY)"/>`;
    s += mouthpiece(-34, 38, 0, 13, 4.8);
    s += rim(RIM, yB, R * 0.17, R, 0, 3.4);
    return place(s, { at: [60, 62], turn: -30, scale: 0.12, about: [262, -40] });
  });
}

function tuba() {
  const T = 1;
  const r = 10;
  const W = r * 2;
  const R = 235;
  const xs = [0, 44, 88, 132];
  const bx = 250;
  const yRim = -250;
  const yBow = 300;
  const lx = -68;
  const rc = 66;
  let s = '';
  s += shadow(110, yBow + 40, 330, 34, 0.9);
  // the bell branch and the bottom bow
  const q = (y) => (76 / (y - yRim + 76)) ** 0.8;
  const qb = q(yBow - rc);
  const rb = (y) => 30 + (R - 30) * Math.max(0, (q(y) - qb) / (1 - qb));
  const ys = range(34, (k) => yBow - rc - (yBow - rc - yRim) * (1 - (1 - k / 33) ** 2.4));
  s += tube(`M${lx} -40V${yBow - rc}A${rc} ${rc} 0 0 0 ${lx + rc} ${yBow}H${bx - rc}A${rc} ${rc} 0 0 0 ${bx} ${yBow - rc}`, 60 * T);
  s += cone(ys.map((y) => [bx, y]), (i) => rb(ys[i]));
  // the valve slides below the casings, then the casings and their buttons
  [40, 26, 54, 70].forEach((dp, i) => { const x = xs[i]; s += tube(`M${x - 10.5} 150V${166 + dp}A10.5 10.5 0 0 0 ${x + 10.5} ${166 + dp}V150`, W); });
  s += tube(`M${lx} 60H0M132 40H${bx - 40}M132 110H${bx - 50}`, W);
  for (const x of xs) s += piston(x, 0, 150, 33, { cap: 14, btn: 12, stem: 22, k: 1.6 });
  // the leadpipe and mouthpiece
  s += tube(`M-150 -40H${lx}`, 22);
  s += mouthpiece(-226, -150, -40, 17, 6.5);
  s += rim(bx, yRim, R, R * 0.2, 0, 7);
  return place(s, { at: [60, 60], scale: 0.152, about: [120, 40] });
}

/* ---- woodwinds ---- */

// A key's cup seen face on; an open hole (French flute) shows dark in the middle.
const kcup = (x, y, r, { open = false, gold = false, k = 1 } = {}) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#${gold ? 'bcup' : 'cup'})" stroke="${gold ? '#5A3B0B' : '#4C5861'}" stroke-width="${f(0.7 * k)}"/>${open ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.34)}" fill="#20262A"/>` : ''}`;
// A tone hole with a ring key around it (clarinet, oboe).
const ringKey = (x, y, r, k = 1) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#0C0B0A"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.06)}" fill="none" stroke="#C9D2D8" stroke-width="${f(1.3 * k)}"/>`;
const ferrule = (x, w, r) => `<rect x="${f(x)}" y="${f(-r)}" width="${f(w)}" height="${f(2 * r)}" rx="${f(w * 0.25)}" fill="url(#silverCY)" stroke="#4C5861" stroke-width=".5"/>`;

function flute() {
  return turned(-44, () => {
    const r = 9.5;
    let s = '';
    s += tube('M232 -12.5H476M560 -12.5H652', 2.8, 'silver');
    for (const x of [236, 300, 360, 420, 470, 566, 648]) s += `<rect x="${x - 2}" y="-15" width="4" height="7" fill="#8B979F"/>`;
    s += cone(straight(-6, 0, 668, 0, 4), r, 'silver');
    s += `<rect x="-14" y="-10.4" width="12" height="20.8" rx="4" fill="url(#silverCY)" stroke="#4C5861" stroke-width=".6"/>`;
    s += ferrule(190, 9, 10.4) + ferrule(534, 9, 10.4);
    s += `<rect x="36" y="-12.5" width="40" height="25" rx="11" fill="url(#cup)" stroke="#4C5861" stroke-width=".8"/><ellipse cx="56" cy="0" rx="6.4" ry="4.8" fill="#1A1F22"/>`;
    const arm = (x, w) => `<path d="M${x - w} -4L${x} -13L${x + w} -4Z" fill="#AEB9C0"/>`;
    for (const [x, rr, open] of [[268, 7, 0], [294, 7, 1], [320, 7, 1], [346, 5, 0], [384, 7, 1], [410, 7, 1], [436, 7, 0], [362, 4.4, 0]]) s += arm(x, rr * 0.5) + kcup(x, 0, rr, { open });
    s += `<path d="M460 3h24" stroke="#C2CCD2" stroke-width="3.6" stroke-linecap="round"/>`;
    for (const [x, rr] of [[584, 7.4], [612, 7.4], [640, 7]]) s += arm(x, 3.5) + kcup(x, 0, rr);
    s += `<rect x="556" y="1" width="10" height="7" rx="3.5" fill="url(#silverCY)"/>`;
    return place(s, { at: [60, 60], turn: -44, scale: 0.214, about: [327, 0] });
  });
}

// A conical wooden body: from x0 to x1, its radius from r0 to r1.
const bodyAlong = (x0, x1, r0, r1, tone, n = 4) => cone(straight(x0, 0, x1, 0, n), (i, t) => lerp(r0, r1, t), tone);

function clarinet() {
  return turned(47, () => {
    let s = '';
    s += `<path d="M3 4L64 10.5V13L5 7Z" fill="#D8BC82"/>`;
    s += cone([[0, -1], [14, -0.4], [30, 0], [60, 0], [86, 0]], (i) => [4.6, 8.4, 11, 12.5, 13][i], 'black');
    s += `<rect x="38" y="-14.2" width="18" height="28.4" rx="2" fill="url(#silverCY)" stroke="#4C5861" stroke-width=".6"/><path d="M42 -14v-3M52 -14v-3" stroke="#9AA6AF" stroke-width="2.4" stroke-linecap="round"/>`;
    s += cone([[86, 0], [100, 0], [118, 0], [136, 0], [150, 0]], (i) => [13.8, 14.6, 15, 14.6, 13.8][i], 'black');
    s += bodyAlong(150, 370, 13, 13.2, 'black') + bodyAlong(370, 580, 13.4, 13.8, 'black');
    s += cone(range(12, (k) => [580 + (82 * k) / 11, 0]), (i, t) => 13.8 + 19.4 * t ** 2.3, 'black');
    s += ferrule(84, 6, 14.6) + ferrule(148, 6, 14.2) + ferrule(364, 10, 14.2) + ferrule(574, 8, 14.6) + ferrule(654, 7, 33.6);
    s += `<path d="M178 -9H350M392 -9H560" stroke="#AEB9C0" stroke-width="2.4"/>`;
    for (const x of [230, 255, 282, 420, 446, 472]) s += ringKey(x, 0, 4.4);
    s += kcup(200, 3, 4.6) + kcup(176, -2, 4) + kcup(316, 4, 4.4) + kcup(512, 2, 6.4) + kcup(540, -1, 6.6);
    s += `<path d="M300 8l40 4M492 9l32 4" stroke="#C2CCD2" stroke-width="3" stroke-linecap="round"/>`;
    return place(s, { at: [60, 60], turn: 47, scale: 0.205, about: [330, 0] });
  });
}

function oboe() {
  return turned(42, () => {
    let s = '';
    s += `<path d="M0 -3.6Q14 -4.4 26 -2.6V2.6Q14 4.4 0 3.6Z" fill="#E0C48C" stroke="#9B7A3E" stroke-width=".6"/><path d="M0 0H22" stroke="#B29257" stroke-width=".7"/>`;
    s += `<rect x="25" y="-3.6" width="20" height="7.2" rx="1.6" fill="#2F6B4A"/><path d="M27 -3.6v7.2M31 -3.6v7.2M35 -3.6v7.2M39 -3.6v7.2" stroke="#1E4A33" stroke-width=".8"/>`;
    s += `<rect x="44" y="-4.2" width="20" height="8.4" rx="1.6" fill="#B08A5A"/>`;
    s += bodyAlong(62, 300, 6.8, 9.6, 'black') + bodyAlong(300, 540, 9.8, 12.6, 'black');
    s += cone(range(12, (k) => [540 + (110 * k) / 11, 0]), (i, t) => 12.8 + 8.6 * Math.sin(t * 2.1) * (t < 0.85 ? t : 1) - (t > 0.85 ? (t - 0.85) * 14 : 0), 'black');
    s += ferrule(60, 6, 7.4) + ferrule(296, 7, 10.4) + ferrule(536, 7, 13.4);
    s += `<path d="M84 -8H290M312 -11H530M100 8H280M330 10H520" stroke="#AEB9C0" stroke-width="2"/>`;
    for (const x of [130, 152, 176, 350, 376, 402]) s += ringKey(x, 0, 3.6, 0.8);
    s += kcup(96, -3, 3.4) + kcup(216, 2, 3.6) + kcup(240, -2, 3.4) + kcup(440, 3, 4.2) + kcup(476, -2, 4.6) + kcup(510, 2, 5) + kcup(555, -2, 5.4);
    for (const x of [90, 200, 260, 320, 430, 500]) s += `<rect x="${x - 1.6}" y="-11" width="3.2" height="5" fill="#8B979F"/>`;
    return place(s, { at: [60, 60], turn: 42, scale: 0.222, about: [325, 0] });
  });
}

function saxophone() {
  let s = '';
  // body (mm): from the neck socket down, round the bow, up the bell branch, flaring forward
  const body = [...straight(0, 0, 38, 440, 10), ...arcPts(96, 440, 58, 180, 0, 14).slice(1), ...bez([154, 440], [158, 360], [162, 300], [170, 250], 8).slice(1), ...bez([170, 250], [176, 214], [190, 186], [214, 164], 10).slice(1)];
  const n = body.length;
  const rb = (i) => {
    const t = i / (n - 1);
    const base = 11.5 + 25 * t;
    const flare = t > 0.86 ? ((t - 0.86) / 0.14) ** 2.4 * 26 : 0;
    return base + flare;
  };
  s += cone(body, rb);
  // the bell's rim: opening up and forward
  s += rim(214, 164, 21, 64, -42, 3.6);
  s += `<path d="M150 470C170 470 182 440 178 400" fill="none" stroke="#B5852B" stroke-width="5"/>`;
  // key cups along the body's front, pearls on its back
  for (const [x, y, r] of [[22, 92, 13], [28, 140, 13], [32, 188, 12], [40, 262, 13], [46, 312, 13], [50, 362, 12]]) s += kcup(x + 6, y, r, { gold: true, k: 1.4 });
  for (const [x, y] of [[-6, 86], [-4, 134], [-2, 182], [6, 258], [10, 306], [14, 356]]) s += `<ellipse cx="${x}" cy="${y}" rx="7.5" ry="6.2" fill="url(#pearl)" stroke="#8A6A2A" stroke-width="1"/>`;
  for (const [x, y, r] of [[96, 486, 14], [128, 478, 13], [170, 330, 15], [176, 284, 14]]) s += kcup(x, y, r, { gold: true, k: 1.4 });
  s += `<path d="M30 70V380M58 120V400" stroke="#C99A3A" stroke-width="3"/>`;
  // neck and mouthpiece
  const neck = bez([0, 4], [0, -50], [-34, -96], [-98, -112], 12);
  s += cone(neck, (i, t) => 11.5 - 4 * t);
  s += `<path d="M-30 -84L-40 -104" stroke="#C99A3A" stroke-width="3"/>`;
  s += cone(bez([-96, -112], [-118, -116], [-140, -118], [-170, -118], 6), (i, t) => 8.5 - 2 * t * t, 'black');
  s += `<rect x="-128" y="-128" width="14" height="20" rx="2" fill="url(#silverC)" transform="rotate(-6 -121 -118)"/>`;
  return shadow(66, 113, 30, 4, 0.8) + place(s, { at: [62, 58], scale: 0.168, about: [40, 192] });
}

function bassoon() {
  return turned(22, () => {
    let s = '';
    // (mm, upright: the floor at y = 0, up is negative)
    const stripe = (x, y0, y1, w) => range(Math.floor((y0 - y1) / 26), (i) => `<path d="M${f(x - w)} ${f(y0 - 12 - i * 26)}q${f(w)} 5 ${f(2 * w)} 0" stroke="#5A2010" stroke-width="5" fill="none" opacity=".35"/>`).join('');
    s += cone(straight(-22, -40, -22, -1000, 6), (i, t) => lerp(19, 16, t), 'maple');
    s += stripe(-22, -40, -1000, 17);
    s += cone(straight(22, -40, 22, -1340, 8), (i, t) => lerp(22, 25, t), 'maple');
    s += stripe(22, -40, -1300, 21);
    s += cone(straight(0, -20, 0, -560, 4), 47, 'maple');
    s += stripe(0, -20, -560, 40);
    s += `<rect x="-49" y="-24" width="98" height="26" rx="8" fill="url(#silverC)" stroke="#4C5861"/>`;
    s += `<rect x="-3" y="-1372" width="50" height="36" rx="5" fill="url(#cream)" stroke="#9A8F78"/>`;
    s += `<rect x="-3" y="-1100" width="50" height="10" fill="url(#silverC)"/><rect x="-45" y="-1004" width="46" height="10" fill="url(#silverC)"/><rect x="-49" y="-568" width="98" height="12" fill="url(#silverC)"/>`;
    for (const y of [-880, -830, -780]) s += `<circle cx="-22" cy="${y}" r="5.4" fill="#1A0A04" stroke="#C9D2D8" stroke-width="1.6"/>`;
    for (const y of [-420, -370]) s += `<circle cx="-12" cy="${y}" r="6" fill="#1A0A04" stroke="#C9D2D8" stroke-width="1.6"/>`;
    s += `<path d="M38 -1290V-600M30 -1200V-640M-38 -950V-620M14 -520V-140" stroke="#C2CCD2" stroke-width="3.6"/>`;
    s += kcup(30, -300, 11) + kcup(-20, -250, 10) + kcup(34, -1210, 9) + kcup(-34, -960, 8);
    // the bocal and reed
    s += tube('M-26 -1000C-26 -1080 -44 -1130 -96 -1150C-140 -1166 -170 -1150 -196 -1128', 9, 'silver');
    s += `<path d="M-196 -1128L-232 -1110" stroke="#D9BC80" stroke-width="10" stroke-linecap="round"/><path d="M-200 -1126L-214 -1119" stroke="#B0302C" stroke-width="11"/>`;
    return place(s, { at: [62, 60], turn: 22, scale: 0.086, about: [-30, -690] });
  });
}

/* ---- strings ---- */

// The outline of a violin's body (and viola's and cello's, which are the same shape), as the
// right half from the top of the upper bout down to the bottom, in body lengths.
const FIDDLE = [
  [[0, 0], [0.08, 0.006], [0.155, 0.03], [0.205, 0.07], [0.231, 0.125], [0.236, 0.19], [0.228, 0.25], [0.21, 0.3], [0.196, 0.338], [0.212, 0.368]],
  [[0.212, 0.368], [0.188, 0.374], [0.167, 0.392], [0.157, 0.43], [0.154, 0.47], [0.156, 0.51], [0.163, 0.55], [0.176, 0.585], [0.196, 0.606], [0.218, 0.612]],
  [[0.218, 0.612], [0.226, 0.632], [0.25, 0.672], [0.276, 0.722], [0.29, 0.78], [0.29, 0.835], [0.278, 0.885], [0.25, 0.932], [0.2, 0.968], [0.13, 0.991], [0.06, 1], [0, 1]],
];
// The double bass's: sloping shoulders, its widest low down, the C-bouts less pinched.
const BASS = [
  [[0, 0], [0.05, 0.004], [0.1, 0.022], [0.148, 0.058], [0.188, 0.104], [0.218, 0.158], [0.234, 0.21], [0.236, 0.26], [0.224, 0.305], [0.205, 0.342], [0.222, 0.372]],
  [[0.222, 0.372], [0.2, 0.38], [0.18, 0.4], [0.172, 0.44], [0.171, 0.48], [0.174, 0.52], [0.184, 0.56], [0.204, 0.592], [0.232, 0.606]],
  [[0.232, 0.606], [0.248, 0.632], [0.278, 0.68], [0.302, 0.74], [0.31, 0.8], [0.302, 0.86], [0.278, 0.91], [0.234, 0.955], [0.16, 0.988], [0.08, 1], [0, 1]],
];

// Light from the upper left, in the drawing's own turned frame: where a highlight sits on a
// dome of radius r, and which way a shadow falls.
const toLight = (r) => { const [x, y] = lightIn([-0.6, -0.8, 0]); return [x * r, y * r]; };

/* A violin-family instrument seen from the front, scroll up, in millimetres: the body from y = 0
   (its top) to y = L. */
function fiddle(m) {
  const { L, wide = [1, 1, 1], out = FIDDLE, neck, box, scroll, fb, fbW, bridge, bridgeW, tail, varnish, endpin = 0, gears = false } = m;
  const pieces = out.map((run, k) => run.map(([x, y]) => [x * L * wide[k], y * L]));
  const body = mirrored(pieces);
  const [sx, sy] = toLight(-L * 0.022);
  const [hx, hy] = toLight(L * 0.07);
  const { base, light, dark, deep, edge } = varnish;
  const g = (id, cx, cy, r, c, a) => rad(id, [cx, cy, r], [[0, c, a], [1, c, 0]], ' gradientUnits="userSpaceOnUse"');
  let s = `<defs><clipPath id="top"><path d="${body}"/></clipPath>${g('up', hx, 0.19 * L + hy, 0.2 * L, '#FFE9C8', 0.55)}${g('low', hx, 0.78 * L + hy, 0.27 * L, '#FFE9C8', 0.5)}${g('mid', 0, 0.49 * L, 0.2 * L, '#000', 0.25)}</defs>`;
  if (endpin) s += `<path d="M0 ${L}V${L + endpin}" stroke="#5E6A72" stroke-width="${f(L * 0.012)}" stroke-linecap="round"/><path d="M0 ${L - 4}v${f(L * 0.05)}" stroke="#1A1512" stroke-width="${f(L * 0.04)}" stroke-linecap="round"/>`;
  // the ribs show a little on the shadowed side, then the arched top
  s += `<path d="${body}" fill="${deep}" transform="translate(${f(sx)} ${f(sy)})"/>`;
  s += `<path d="${body}" fill="${base}"/>`;
  s += `<g clip-path="url(#top)">`;
  s += range(15, (i) => { const x = (i - 7) * L * 0.034; return `<path d="M${f(x)} 0C${f(x * 1.06)} ${f(L * 0.35)} ${f(x * 0.98)} ${f(L * 0.65)} ${f(x * 1.04)} ${L}" stroke="${dark}" stroke-width="${f(L * 0.004)}" fill="none" opacity=".35"/>`; }).join('');
  s += `<rect x="${-L}" y="0" width="${2 * L}" height="${L}" fill="url(#up)"/><rect x="${-L}" y="0" width="${2 * L}" height="${L}" fill="url(#low)"/><rect x="${-L}" y="0" width="${2 * L}" height="${L}" fill="url(#mid)"/>`;
  s += `<path d="${body}" fill="none" stroke="${deep}" stroke-width="${f(L * 0.06)}" opacity=".45"/>`;
  s += `<path d="${body}" fill="none" stroke="#1C0C04" stroke-width="${f(L * 0.042)}"/><path d="${body}" fill="none" stroke="${edge}" stroke-width="${f(L * 0.03)}"/>`;
  s += `</g><path d="${body}" fill="none" stroke="${deep}" stroke-width="${f(L * 0.005)}"/>`;
  // f-holes
  const fh = [[0.065, 0.44], [0.072, 0.48], [0.092, 0.53], [0.11, 0.58], [0.125, 0.62], [0.14, 0.645]];
  for (const side of [1, -1]) {
    const p = fh.map(([x, y]) => [side * x * L, y * L]);
    s += `<path d="${smooth(p)}" fill="none" stroke="#1A0A03" stroke-width="${f(L * 0.011)}" stroke-linecap="round"/>`;
    s += `<circle cx="${f(p[0][0])}" cy="${f(p[0][1])}" r="${f(L * 0.011)}" fill="#1A0A03"/><circle cx="${f(p[5][0])}" cy="${f(p[5][1])}" r="${f(L * 0.014)}" fill="#1A0A03"/>`;
    s += `<path d="M${f(side * 0.083 * L)} ${f(0.52 * L)}l${f(side * -0.012 * L)} ${f(-0.004 * L)}M${f(side * 0.107 * L)} ${f(0.574 * L)}l${f(side * 0.012 * L)} ${f(0.004 * L)}" stroke="#1A0A03" stroke-width="${f(L * 0.005)}"/>`;
  }
  // the tailpiece, its saddle and the chin rest (violin and viola)
  const [t0, t1] = tail;
  s += `<path d="M${f(-0.055 * L)} ${f(t0)}Q0 ${f(t0 - 0.02 * L)} ${f(0.055 * L)} ${f(t0)}L${f(0.03 * L)} ${f(t1)}Q0 ${f(t1 + 0.012 * L)} ${f(-0.03 * L)} ${f(t1)}Z" fill="#17110D" stroke="#000" stroke-width="${f(L * 0.003)}"/>`;
  s += `<path d="M${f(-0.03 * L)} ${f(t0 + 0.02 * L)}L${f(-0.018 * L)} ${f(t1 - 0.02 * L)}" stroke="#5A4C42" stroke-width="${f(L * 0.008)}" opacity=".7"/>`;
  s += `<rect x="${f(-0.04 * L)}" y="${f(L * 0.985)}" width="${f(0.08 * L)}" height="${f(0.017 * L)}" rx="${f(0.004 * L)}" fill="#0E0A08"/>`;
  if (m.chin) s += `<path d="M${f(-0.2 * L)} ${f(0.86 * L)}C${f(-0.2 * L)} ${f(0.8 * L)} ${f(-0.08 * L)} ${f(0.79 * L)} ${f(-0.06 * L)} ${f(0.85 * L)}C${f(-0.05 * L)} ${f(0.9 * L)} ${f(-0.06 * L)} ${f(0.96 * L)} ${f(-0.12 * L)} ${f(0.965 * L)}C${f(-0.18 * L)} ${f(0.97 * L)} ${f(-0.2 * L)} ${f(0.92 * L)} ${f(-0.2 * L)} ${f(0.86 * L)}Z" fill="#1A1310" stroke="#000" stroke-width="${f(L * 0.003)}"/><path d="M${f(-0.17 * L)} ${f(0.84 * L)}C${f(-0.15 * L)} ${f(0.82 * L)} ${f(-0.11 * L)} ${f(0.82 * L)} ${f(-0.09 * L)} ${f(0.85 * L)}" stroke="#5A4C42" stroke-width="${f(L * 0.008)}" fill="none" opacity=".8"/>`;
  // the fingerboard, from the nut down over the body
  const [w0, w1] = fbW;
  s += `<path d="M${f(-w0 / 2)} ${-neck}L${f(w0 / 2)} ${-neck}L${f(w1 / 2)} ${fb}Q0 ${f(fb + w1 * 0.12)} ${f(-w1 / 2)} ${fb}Z" fill="#141010" stroke="#000" stroke-width="${f(L * 0.003)}"/>`;
  s += `<path d="M${f(-w0 * 0.3)} ${-neck + 4}L${f(-w1 * 0.3)} ${fb - 4}" stroke="#4A403A" stroke-width="${f(w0 * 0.18)}" opacity=".6"/>`;
  s += `<rect x="${f(-w0 / 2)}" y="${f(-neck - L * 0.012)}" width="${w0}" height="${f(L * 0.012)}" fill="#E9DFC8"/>`;
  // the bridge, standing up toward you, and the strings over it
  s += `<path d="M${f(-bridgeW / 2)} ${f(bridge + L * 0.006)}L${f(bridgeW / 2)} ${f(bridge + L * 0.006)}L${f(bridgeW * 0.42)} ${f(bridge - L * 0.006)}L${f(-bridgeW * 0.42)} ${f(bridge - L * 0.006)}Z" fill="#E7CF9F" stroke="#9A7A44" stroke-width="${f(L * 0.002)}"/>`;
  const sw = [0.024, 0.0085].map((v) => v * L);
  s += range(4, (i) => {
    const u = (i - 1.5) / 1.5;
    return `<path d="M${f(u * w0 * 0.33)} ${-neck}L${f(u * bridgeW * 0.36)} ${bridge}L${f(u * 0.04 * L)} ${f(t0 + 0.01 * L)}" stroke="${i < 2 ? '#C9C3B6' : '#E4E0D6'}" stroke-width="${f(sw[1] * (1.2 - i * 0.12))}" fill="none"/>`;
  }).join('');
  if (m.fine) s += `<rect x="${f(0.03 * L)}" y="${f(t0 + 0.012 * L)}" width="${f(0.022 * L)}" height="${f(0.03 * L)}" rx="${f(0.005 * L)}" fill="url(#silverC)"/>`;
  // the pegbox, pegs (or a bass's gears) and the scroll
  const [b0, b1] = box;
  const pw = w0 * 0.55;
  s += `<path d="M${f(-w0 * 0.5)} ${-neck}L${f(-pw)} ${f(-neck - b0)}L${f(pw)} ${f(-neck - b0)}L${f(w0 * 0.5)} ${-neck}Z" fill="${base}" stroke="${deep}" stroke-width="${f(L * 0.004)}"/>`;
  s += `<path d="M${f(-w0 * 0.26)} ${f(-neck - L * 0.02)}L${f(-pw * 0.5)} ${f(-neck - b0 + L * 0.015)}L${f(pw * 0.5)} ${f(-neck - b0 + L * 0.015)}L${f(w0 * 0.26)} ${f(-neck - L * 0.02)}Z" fill="#1A0A03"/>`;
  const pegs = [[-1, 0.25], [1, 0.4], [-1, 0.6], [1, 0.78]];
  for (const [side, t] of pegs) {
    const y = -neck - b0 * t;
    if (gears) {
      s += `<rect x="${f(side > 0 ? w0 * 0.45 : -w0 * 0.45 - b1 * 0.16)}" y="${f(y - b1 * 0.07)}" width="${f(b1 * 0.16)}" height="${f(b1 * 0.14)}" rx="${f(b1 * 0.02)}" fill="url(#brassC)" stroke="#5A3B0B" stroke-width="${f(L * 0.002)}"/>`;
      s += `<path d="M${f(side * w0 * 0.6)} ${f(y)}h${f(side * b1 * 0.32)}" stroke="#2A221C" stroke-width="${f(b1 * 0.035)}"/><ellipse cx="${f(side * (w0 * 0.6 + b1 * 0.36))}" cy="${f(y)}" rx="${f(b1 * 0.06)}" ry="${f(b1 * 0.11)}" fill="#1A1310" stroke="#000" stroke-width="${f(L * 0.002)}"/>`;
    } else {
      s += `<path d="M${f(side * pw * 0.6)} ${f(y)}h${f(side * w0 * 0.9)}" stroke="#1A1310" stroke-width="${f(w0 * 0.17)}" stroke-linecap="round"/><ellipse cx="${f(side * (pw * 0.6 + w0 * 1.05))}" cy="${f(y)}" rx="${f(w0 * 0.28)}" ry="${f(w0 * 0.34)}" fill="#1A1310" stroke="#000" stroke-width="${f(L * 0.002)}"/><circle cx="${f(side * (pw * 0.6 + w0 * 1.05))}" cy="${f(y)}" r="${f(w0 * 0.08)}" fill="#C9B89A"/>`;
    }
  }
  const sc = scroll / 2;
  const yc = -neck - b0 - sc * 0.75;
  s += `<ellipse cx="0" cy="${f(yc)}" rx="${f(sc * 0.95)}" ry="${f(sc * 1.05)}" fill="${base}" stroke="${deep}" stroke-width="${f(L * 0.004)}"/>`;
  s += `<ellipse cx="${f(-sc * 0.32)}" cy="${f(yc - sc * 0.25)}" rx="${f(sc * 0.35)}" ry="${f(sc * 0.4)}" fill="${light}" opacity=".6"/>`;
  s += `<path d="M${f(-sc * 0.55)} ${f(yc + sc * 0.2)}a${f(sc * 0.45)} ${f(sc * 0.5)} 0 1 1 ${f(sc * 0.9)} 0a${f(sc * 0.3)} ${f(sc * 0.32)} 0 1 1 ${f(-sc * 0.58)} -${f(sc * 0.1)}" fill="none" stroke="${deep}" stroke-width="${f(L * 0.005)}"/>`;
  s += `<rect x="${f(-sc * 0.14)}" y="${f(yc - sc * 1.05)}" width="${f(sc * 0.28)}" height="${f(sc * 1.9)}" rx="${f(sc * 0.12)}" fill="${dark}" opacity=".55"/>`;
  return s;
}

// A bow: from the frog (x = 0) to the tip (x = len), in millimetres, hair below the stick.
function bow(len, { stick = 8, hair = 9, frog = 22, head = 18 } = {}) {
  const gap = (x) => frog * 0.95 - (frog * 0.95 - head * 0.55) * (x / len) - Math.sin((x / len) * Math.PI) * frog * 0.32;
  const top = range(13, (k) => { const x = (k / 12) * len; return [x, -gap(x)]; });
  let s = `<path d="M${frog * 0.5} ${f(hair * 0.1)}L${len - 6} ${f(-head * 0.42)}" stroke="#F4EEDC" stroke-width="${hair}" stroke-linecap="butt"/><path d="M${frog * 0.5} ${f(hair * 0.1 - hair * 0.3)}L${len - 6} ${f(-head * 0.42 - hair * 0.3)}" stroke="#FFFFFF" stroke-width="${f(hair * 0.25)}" opacity=".8"/>`;
  s += `<path d="${smooth(top)}" fill="none" stroke="#3A1607" stroke-width="${stick}" stroke-linecap="round"/><path d="${smooth(top)}" fill="none" stroke="#8A3A16" stroke-width="${f(stick * 0.5)}" transform="translate(0 ${f(-stick * 0.15)})"/>`;
  s += `<path d="M${len - 14} ${f(-gap(len) + 2)}L${len + 4} ${f(-gap(len) - 2)}L${len - 2} ${f(-head * 0.3)}L${len - 16} ${f(-head * 0.35)}Z" fill="#3A1607"/><path d="M${len - 2} ${f(-gap(len) - 1)}L${len + 4} ${f(-gap(len) - 2)}L${len - 2} ${f(-head * 0.3)}Z" fill="#F4EEDC"/>`;
  s += `<path d="M2 ${f(-frog * 0.95)}H${frog * 2.2}L${frog * 2.6} ${f(-hair * 0.2)}H${frog * 0.2}Q-2 ${f(-frog * 0.5)} 2 ${f(-frog * 0.95)}Z" fill="#141010" stroke="#000" stroke-width="1"/>`;
  s += `<circle cx="${frog * 1.1}" cy="${f(-frog * 0.55)}" r="${f(frog * 0.18)}" fill="#E9F0F2" stroke="#9AA6AF" stroke-width="1"/><rect x="${frog * 0.2}" y="${f(-hair * 0.35)}" width="${frog * 2.3}" height="${f(hair * 0.45)}" fill="url(#silverCY)"/>`;
  s += `<rect x="${-frog * 0.9}" y="${f(-frog * 1.15)}" width="${frog * 0.9}" height="${f(frog * 0.42)}" rx="2" fill="url(#silverCY)"/><rect x="${-frog * 1.15}" y="${f(-frog * 1.12)}" width="${f(frog * 0.3)}" height="${f(frog * 0.36)}" rx="2" fill="#141010"/>`;
  return s;
}

const VARNISH = {
  violin: { base: '#B4531B', light: '#E58C46', dark: '#6E2A0B', deep: '#4A1A06', edge: '#CF6E2E' },
  viola: { base: '#9E4215', light: '#D97A3A', dark: '#5E220A', deep: '#3E1505', edge: '#BE5C26' },
  cello: { base: '#A84A18', light: '#E0843F', dark: '#66260A', deep: '#431705', edge: '#C6662A' },
  bass: { base: '#8A3A14', light: '#C9743A', dark: '#552008', deep: '#371304', edge: '#A9542A' },
};

// The fiddle on one diagonal, its bow across the strings on the other: a bow is longer than the
// violin, and the diagonal is the only line long enough for it.
const FIDDLE_BOX = [5, 5, 115, 115];
function violin() {
  return turned(45, () => {
    const v = fiddle({ L: 356, neck: 130, box: [64, 30], scroll: 44, fb: 140, fbW: [24, 42], bridge: 195, bridgeW: 41, tail: [247, 350], varnish: VARNISH.violin, chin: true, fine: true });
    const b = place(bow(750), { at: [-250, 170], scale: 1 });
    const pts = [[0, -238], [0, 362], [-104, 280], [104, 280], [-86, 70], [86, 70], [-52, -150], [52, -150], [-276, 140], [-276, 176], [506, 150], [506, 172]];
    return place(v + b, fitTurned(pts, 45, FIDDLE_BOX));
  });
}
function viola() {
  return turned(45, () => {
    const v = fiddle({ L: 410, wide: [0.98, 1.03, 0.98], neck: 150, box: [72, 34], scroll: 50, fb: 152, fbW: [25, 45], bridge: 226, bridgeW: 46, tail: [285, 404], varnish: VARNISH.viola, chin: true });
    const b = place(bow(740, { stick: 8.6, hair: 10, frog: 24 }), { at: [-236, 198], scale: 1 });
    const pts = [[0, -280], [0, 416], [-126, 322], [126, 322], [-100, 80], [100, 80], [-56, -172], [56, -172], [-264, 168], [-264, 206], [508, 178], [508, 200]];
    return place(v + b, fitTurned(pts, 45, FIDDLE_BOX));
  });
}
function cello() {
  return turned(-10, () => {
    const v = fiddle({ L: 755, wide: [0.95, 0.99, 1], neck: 285, box: [135, 64], scroll: 92, fb: 300, fbW: [32, 60], bridge: 404, bridgeW: 92, tail: [486, 746], varnish: VARNISH.cello, endpin: 170 });
    const b = place(bow(715, { stick: 10, hair: 13, frog: 30, head: 22 }), { at: [-330, 360], turn: -14, scale: 1 });
    return shadow(66, 116.5, 21, 3.2, 0.9) + place(v + b, { at: [60, 63.2], turn: -10, scale: 0.085, about: [0, 280] });
  });
}
function bass() {
  return turned(9, () => {
    const v = fiddle({ L: 1110, out: BASS, neck: 440, box: [210, 100], scroll: 120, fb: 430, fbW: [44, 80], bridge: 610, bridgeW: 150, tail: [720, 1096], varnish: VARNISH.bass, endpin: 170, gears: true });
    const b = place(bow(710, { stick: 12, hair: 16, frog: 40, head: 26 }), { at: [-400, 470], turn: -24, scale: 1 });
    return shadow(53, 116, 21, 3.2, 0.9) + place(v + b, { at: [60, 66], turn: 9, scale: 0.0585, about: [0, 420] });
  });
}

// The classical guitar's body (the ukulele's is nearly the same), right half, in body lengths.
const GUITAR = [[0, 0], [0.1, 0.004], [0.18, 0.02], [0.235, 0.05], [0.272, 0.1], [0.286, 0.16], [0.28, 0.22], [0.262, 0.28], [0.246, 0.34], [0.24, 0.4], [0.246, 0.46], [0.272, 0.52], [0.31, 0.58], [0.345, 0.64], [0.368, 0.7], [0.378, 0.76], [0.372, 0.82], [0.35, 0.88], [0.305, 0.935], [0.23, 0.975], [0.12, 0.996], [0, 1]];
const frets = (scale, from, to) => range(to - from + 1, (k) => scale * (1 - 2 ** (-(from + k) / 12)));

// A flat wooden top: base colour, grain along it, the light on it, a shaded rim and binding.
function plate(path, L, W, { base, light, dark, deep, bind = '#EFE6D2', grain = 16, id = 'pl' }) {
  const [hx, hy] = toLight(Math.max(L, W) * 0.12);
  let s = `<defs><clipPath id="${id}"><path d="${path}"/></clipPath>${rad(`${id}g`, [hx, L * 0.62 + hy, W * 0.75], [[0, light, 0.85], [0.6, light, 0], [1, '#000', 0]], ' gradientUnits="userSpaceOnUse"')}</defs>`;
  s += `<path d="${path}" fill="${base}"/><g clip-path="url(#${id})">`;
  s += range(grain, (i) => { const x = ((i + 0.5) / grain - 0.5) * W * 1.1; return `<path d="M${f(x)} ${f(-L * 0.05)}C${f(x * 1.04)} ${f(L * 0.35)} ${f(x * 0.97)} ${f(L * 0.7)} ${f(x * 1.02)} ${f(L * 1.05)}" stroke="${dark}" stroke-width="${f(W * 0.004)}" fill="none" opacity=".4"/>`; }).join('');
  s += `<rect x="${f(-W)}" y="${f(-L * 0.1)}" width="${f(2 * W)}" height="${f(L * 1.2)}" fill="url(#${id}g)"/>`;
  s += `<path d="${path}" fill="none" stroke="${deep}" stroke-width="${f(W * 0.07)}" opacity=".35"/><path d="${path}" fill="none" stroke="${bind}" stroke-width="${f(W * 0.022)}"/><path d="${path}" fill="none" stroke="${deep}" stroke-width="${f(W * 0.008)}"/>`;
  return `${s}</g>`;
}

function guitar() {
  return turned(42, () => {
    const L = 490;
    const body = mirrored([GUITAR.map(([x, y]) => [x * L, y * L])]);
    const [sx, sy] = toLight(-9);
    let s = `<path d="${body}" fill="#4A2010" transform="translate(${f(sx)} ${f(sy)})"/>`;
    s += plate(body, L, 370, { base: '#E6C489', light: '#FBEBC4', dark: '#B48A4E', deep: '#6E4A1C', bind: '#F4EBD8' });
    // rosette and soundhole
    s += `<circle cx="0" cy="150" r="58" fill="none" stroke="#3A2414" stroke-width="10"/><circle cx="0" cy="150" r="58" fill="none" stroke="#C99A55" stroke-width="6" stroke-dasharray="3 2.4"/><circle cx="0" cy="150" r="49" fill="none" stroke="#3A2414" stroke-width="2.4"/>`;
    s += `<circle cx="0" cy="150" r="43" fill="#140B05"/><path d="M-30 128A43 43 0 0 1 30 128" fill="none" stroke="#000" stroke-width="10" opacity=".45"/>`;
    // the bridge: tie block, wings and saddle
    s += `<path d="M-96 330Q-60 314 -40 314H40Q60 314 96 330Q60 348 40 348H-40Q-60 348 -96 330Z" fill="#3A1C0E" stroke="#1E0E06" stroke-width="1.4"/><rect x="-40" y="322" width="80" height="5" rx="1.5" fill="#F4EEDF"/>`;
    // the neck, fingerboard and frets
    s += `<path d="M-26 -325L26 -325L32 100Q0 104 -32 100Z" fill="#2A1710" stroke="#120804" stroke-width="1.4"/>`;
    s += frets(650, 1, 18).map((d) => { const y = -325 + d; const w = 26 + (6 * (y + 325)) / 425; return `<path d="M${f(-w)} ${f(y)}H${f(w)}" stroke="#D9DDE0" stroke-width="2.2"/>`; }).join('');
    s += `<rect x="-26" y="-330" width="52" height="6" fill="#F4EEDF"/>`;
    // strings: three nylon trebles, three silver-wound basses
    s += range(6, (i) => { const u = (i - 2.5) / 2.5; return `<path d="M${f(u * 21)} -326L${f(u * 29)} 324L${f(u * 30)} 338" stroke="${i < 3 ? '#D9DDE0' : '#F5F0E2'}" stroke-width="${f(2.6 - i * 0.22)}" fill="none"/>`; }).join('');
    // the slotted head
    s += `<path d="M-27 -325L-36 -500Q-36 -516 -20 -514L0 -506L20 -514Q36 -516 36 -500L27 -325Z" fill="#3A1C0E" stroke="#1E0E06" stroke-width="1.4"/>`;
    s += `<rect x="-20" y="-492" width="12" height="140" rx="6" fill="#120804"/><rect x="8" y="-492" width="12" height="140" rx="6" fill="#120804"/>`;
    for (const y of [-470, -428, -386]) {
      s += `<rect x="-22" y="${y - 4}" width="44" height="8" rx="4" fill="#F1EADB"/>`;
      s += `<path d="M-36 ${y}h-14M36 ${y}h14" stroke="#B9A06A" stroke-width="5"/><ellipse cx="-56" cy="${y}" rx="9" ry="7" fill="url(#pearl)" stroke="#9A8A6A"/><ellipse cx="56" cy="${y}" rx="9" ry="7" fill="url(#pearl)" stroke="#9A8A6A"/>`;
    }
    return place(s, { at: [57, 62], turn: 42, scale: 0.117, about: [0, 0] });
  });
}

function electricGuitar() {
  return turned(42, () => {
    const out = [[-28, 0], [-36, -30], [-50, -58], [-70, -74], [-90, -68], [-104, -44], [-122, 0], [-145, 50], [-152, 100], [-142, 145], [-150, 190], [-163, 245], [-160, 300], [-140, 348], [-98, 386], [-36, 401], [36, 401], [98, 386], [140, 348], [160, 300], [163, 245], [152, 192], [140, 150], [150, 104], [148, 58], [130, 12], [112, -22], [94, -40], [78, -36], [64, -16], [48, 18], [30, 32]];
    const body = smooth(out, true);
    const [sx, sy] = toLight(-7);
    const [hx, hy] = toLight(60);
    let s = `<defs><clipPath id="eg"><path d="${body}"/></clipPath>${rad('egl', [hx, 160 + hy, 230], [[0, '#FF7A7A', 0.75], [0.5, '#F0434B', 0.2], [1, '#F0434B', 0]], ' gradientUnits="userSpaceOnUse"')}</defs>`;
    s += `<path d="${body}" fill="#5E0A10" transform="translate(${f(sx)} ${f(sy)})"/><path d="${body}" fill="#C01C26"/>`;
    s += `<g clip-path="url(#eg)"><rect x="-200" y="-100" width="400" height="520" fill="url(#egl)"/><path d="${body}" fill="none" stroke="#5E0A10" stroke-width="22" opacity=".55"/><path d="${body}" fill="none" stroke="#FFB3B3" stroke-width="6" opacity=".5" transform="translate(${f(-sx * 0.6)} ${f(-sy * 0.6)})"/></g>`;
    // the pickguard, pickups, bridge, controls
    const guard = smooth([[-26, 2], [-42, -26], [-66, -48], [-92, -44], [-110, 0], [-126, 60], [-130, 120], [-122, 180], [-112, 236], [-92, 280], [-52, 300], [10, 304], [64, 330], [108, 332], [128, 298], [126, 240], [110, 190], [98, 150], [104, 100], [98, 60], [70, 30], [40, 28]], true);
    s += `<path d="${guard}" fill="#F3EEE4" stroke="#9C958A" stroke-width="2"/><path d="${guard}" fill="none" stroke="#1A1A1A" stroke-width=".8" transform="translate(1.6 1.6)" opacity=".5"/>`;
    for (const [y, a] of [[100, 0], [152, 0], [206, -9]]) s += `<g transform="rotate(${a} 0 ${y})"><rect x="-36" y="${y - 9}" width="72" height="18" rx="9" fill="#F7F3EA" stroke="#B8B0A2" stroke-width="1.4"/>${range(6, (i) => `<circle cx="${-25 + i * 10}" cy="${y}" r="2.6" fill="#B9C3CA"/>`).join('')}</g>`;
    s += `<rect x="-44" y="244" width="88" height="34" rx="4" fill="url(#chromeC)" stroke="#3E4951" stroke-width="1.2"/>${range(6, (i) => `<rect x="${-37 + i * 12.6}" y="250" width="10" height="16" rx="2" fill="#E8EDF0" stroke="#59646C" stroke-width=".8"/>`).join('')}`;
    s += `<path d="M44 270C70 276 96 296 112 322" fill="none" stroke="#C9D2D8" stroke-width="4" stroke-linecap="round"/><circle cx="113" cy="324" r="5" fill="#F3EEE4"/>`;
    for (const [x, y] of [[74, 232], [92, 270], [96, 310]]) s += `<circle cx="${x}" cy="${y}" r="11" fill="url(#cup)" stroke="#8E877C" stroke-width="1.2"/><circle cx="${x - 3}" cy="${y - 3}" r="4" fill="#fff" opacity=".7"/>`;
    s += `<path d="M66 192l10 -6" stroke="#F3EEE4" stroke-width="6" stroke-linecap="round"/>`;
    // the maple neck and its fingerboard
    s += `<path d="M-21 -397L21 -397L28 70Q0 76 -28 70Z" fill="#E7C78E" stroke="#9E7A3E" stroke-width="1.4"/><path d="M-14 -394L-18 66" stroke="#F8E6C0" stroke-width="7" opacity=".7"/>`;
    s += frets(648, 1, 22).map((d) => { const y = -397 + d; const w = 21 + (7 * (y + 397)) / 467; return `<path d="M${f(-w)} ${f(y)}H${f(w)}" stroke="#9AA3A9" stroke-width="2"/>`; }).join('');
    const fp = frets(648, 0, 22);
    for (const n of [3, 5, 7, 9, 15, 17, 19, 21]) s += `<circle cx="0" cy="${f(-397 + (fp[n] + fp[n - 1]) / 2)}" r="3.6" fill="#1A1410"/>`;
    s += `<circle cx="-9" cy="${f(-397 + (fp[12] + fp[11]) / 2)}" r="3.6" fill="#1A1410"/><circle cx="9" cy="${f(-397 + (fp[12] + fp[11]) / 2)}" r="3.6" fill="#1A1410"/>`;
    s += `<rect x="-21" y="-402" width="42" height="5" fill="#F4EEDF"/>`;
    s += range(6, (i) => { const u = (i - 2.5) / 2.5; return `<path d="M${f(u * 18)} -400L${f(u * 26)} 256" stroke="#E6E9EB" stroke-width="${f(2.2 - i * 0.18)}"/>`; }).join('');
    // the head, six tuners in a line
    s += `<path d="M-21 -397L-24 -430L-48 -470L-60 -540L-54 -580L-30 -594L4 -586L20 -560L22 -480L21 -397Z" fill="#E7C78E" stroke="#9E7A3E" stroke-width="1.4"/>`;
    for (let i = 0; i < 6; i++) {
      const y = -440 - i * 24;
      const x = -30 - Math.min(i, 3) * 6 + (i > 3 ? (i - 3) * 2 : 0);
      s += `<path d="M${x} ${y}h-30" stroke="#AEB9C0" stroke-width="5"/><rect x="${x - 40}" y="${y - 6}" width="12" height="12" rx="3" fill="url(#chromeC)"/><circle cx="${x}" cy="${y}" r="5.4" fill="url(#cup)" stroke="#59646C" stroke-width="1"/>`;
    }
    return place(s, { at: [58, 63], turn: 42, scale: 0.117, about: [0, -95] });
  });
}

function electricBass() {
  return turned(42, () => {
    const out = [[-30, 30], [-38, -10], [-50, -60], [-62, -110], [-80, -146], [-100, -150], [-114, -120], [-126, -60], [-148, 10], [-160, 80], [-152, 150], [-160, 210], [-174, 280], [-170, 350], [-146, 410], [-100, 452], [-36, 470], [36, 470], [104, 452], [148, 410], [170, 350], [172, 280], [160, 216], [150, 160], [158, 104], [150, 50], [128, 4], [108, -26], [92, -36], [76, -28], [62, 0], [46, 40], [30, 52]];
    const body = smooth(out, true);
    const [sx, sy] = toLight(-8);
    const [hx, hy] = toLight(70);
    let s = `<defs><clipPath id="eb"><path d="${body}"/></clipPath>${rad('ebl', [hx, 180 + hy, 260], [[0, '#7FB0E8', 0.8], [0.5, '#3F78C0', 0.2], [1, '#3F78C0', 0]], ' gradientUnits="userSpaceOnUse"')}</defs>`;
    s += `<path d="${body}" fill="#0E2442" transform="translate(${f(sx)} ${f(sy)})"/><path d="${body}" fill="#2A5C9E"/>`;
    s += `<g clip-path="url(#eb)"><rect x="-200" y="-200" width="400" height="700" fill="url(#ebl)"/><path d="${body}" fill="none" stroke="#0E2442" stroke-width="24" opacity=".55"/><path d="${body}" fill="none" stroke="#BFD8F5" stroke-width="7" opacity=".45" transform="translate(${f(-sx * 0.6)} ${f(-sy * 0.6)})"/></g>`;
    const guard = smooth([[-28, 30], [-40, -20], [-56, -80], [-78, -120], [-102, -100], [-116, -40], [-132, 40], [-136, 120], [-126, 190], [-112, 250], [-80, 280], [-30, 270], [20, 262], [70, 270], [110, 250], [122, 200], [116, 150], [120, 100], [112, 50], [80, 30], [50, 40]], true);
    s += `<path d="${guard}" fill="#151515" stroke="#3A3A3A" stroke-width="2"/>`;
    s += `<g transform="rotate(-4 0 190)"><rect x="-46" y="168" width="44" height="20" rx="8" fill="#1E1E1E" stroke="#4A4A4A" stroke-width="1.4"/><rect x="2" y="190" width="44" height="20" rx="8" fill="#1E1E1E" stroke="#4A4A4A" stroke-width="1.4"/></g>`;
    s += `<rect x="-48" y="292" width="96" height="22" rx="9" fill="#1E1E1E" stroke="#4A4A4A" stroke-width="1.4"/>`;
    s += `<rect x="-46" y="340" width="92" height="40" rx="4" fill="url(#chromeC)" stroke="#3E4951" stroke-width="1.2"/>${range(4, (i) => `<rect x="${-38 + i * 20}" y="346" width="16" height="20" rx="2" fill="#E8EDF0" stroke="#59646C" stroke-width=".8"/>`).join('')}`;
    for (const [x, y] of [[96, 300], [112, 340], [114, 384]]) s += `<circle cx="${x}" cy="${y}" r="12" fill="#1A1A1A" stroke="#555" stroke-width="1.6"/><circle cx="${x - 3}" cy="${y - 3}" r="3.6" fill="#777"/>`;
    // the neck: rosewood fingerboard with pearl dots
    s += `<path d="M-23 -512L23 -512L32 80Q0 86 -32 80Z" fill="#E2BE84" stroke="#9E7A3E" stroke-width="1.4"/><path d="M-21 -512L21 -512L29 80Q0 85 -29 80Z" fill="#2E1A12"/>`;
    s += frets(864, 1, 20).map((d) => { const y = -512 + d; const w = 21 + (8 * (y + 512)) / 592; return `<path d="M${f(-w)} ${f(y)}H${f(w)}" stroke="#B9C3CA" stroke-width="2.2"/>`; }).join('');
    const fp = frets(864, 0, 20);
    for (const n of [3, 5, 7, 9, 15, 17, 19]) s += `<circle cx="0" cy="${f(-512 + (fp[n] + fp[n - 1]) / 2)}" r="4" fill="#EDE6D8"/>`;
    s += `<circle cx="-10" cy="${f(-512 + (fp[12] + fp[11]) / 2)}" r="4" fill="#EDE6D8"/><circle cx="10" cy="${f(-512 + (fp[12] + fp[11]) / 2)}" r="4" fill="#EDE6D8"/>`;
    s += `<rect x="-23" y="-517" width="46" height="5" fill="#F4EEDF"/>`;
    s += range(4, (i) => { const u = (i - 1.5) / 1.5; return `<path d="M${f(u * 15)} -515L${f(u * 30)} 352" stroke="#D5DBDF" stroke-width="${f(3.4 - i * 0.4)}"/>`; }).join('');
    s += `<path d="M-23 -512L-28 -550L-56 -600L-66 -700L-56 -736L-28 -746L6 -738L24 -712L26 -600L23 -512Z" fill="#E2BE84" stroke="#9E7A3E" stroke-width="1.4"/>`;
    for (let i = 0; i < 4; i++) {
      const y = -560 - i * 44;
      const x = -40 - Math.min(i, 2) * 6;
      s += `<path d="M${x} ${y}h-34" stroke="#AEB9C0" stroke-width="7"/><path d="M${x - 46} ${y - 12}h16v24h-16z" fill="url(#chromeC)" stroke="#59646C"/><circle cx="${x}" cy="${y}" r="9" fill="url(#cup)" stroke="#59646C" stroke-width="1.2"/>`;
    }
    return place(s, { at: [58, 63], turn: 42, scale: 0.1, about: [0, -140] });
  });
}

function banjo() {
  return turned(40, () => {
    let s = '';
    // the pot: the resonator's flange, the tension hoop and its hooks, the head
    s += `<circle cx="0" cy="0" r="170" fill="#4A2210"/><circle cx="0" cy="0" r="164" fill="url(#chromeD)" stroke="#2E373D" stroke-width="2"/>`;
    s += range(24, (i) => { const a = (i / 24) * TAU; return `<circle cx="${f(Math.cos(a) * 152)}" cy="${f(Math.sin(a) * 152)}" r="6" fill="#2E373D"/>`; }).join('');
    s += `<circle cx="0" cy="0" r="142" fill="none" stroke="#56626A" stroke-width="8"/>`;
    s += range(24, (i) => { const a = ((i + 0.5) / 24) * TAU; return `<path d="M${f(Math.cos(a) * 128)} ${f(Math.sin(a) * 128)}L${f(Math.cos(a) * 146)} ${f(Math.sin(a) * 146)}" stroke="#D7DEE3" stroke-width="5" stroke-linecap="round"/>`; }).join('');
    s += `<circle cx="0" cy="0" r="130" fill="url(#chromeD)" stroke="#3E4951" stroke-width="2"/><circle cx="0" cy="0" r="122" fill="url(#frost)"/>`;
    // tailpiece, bridge, armrest
    s += `<path d="M-14 166L14 166L22 82L-22 82Z" fill="url(#chromeC)" stroke="#3E4951" stroke-width="1.4"/>`;
    s += `<path d="M-38 56L38 56L34 46L-34 46Z" fill="#D9B97A" stroke="#8A6A34" stroke-width="1.4"/>`;
    s += `<path d="M84 104A136 136 0 0 0 120 52" fill="none" stroke="#C9D2D8" stroke-width="9" stroke-linecap="round"/>`;
    // the neck, fingerboard, the fifth string's peg, and the head
    s += `<path d="M-22 -600L22 -600L28 -118L-28 -118Z" fill="#3A1C0E" stroke="#1E0E06" stroke-width="1.4"/><path d="M-20 -600L20 -600L25 -120L-25 -120Z" fill="#1E120C"/>`;
    s += frets(667, 1, 22).map((d) => { const y = -600 + d; return y < -120 ? `<path d="M${f(-20 - (y + 600) * 0.01)} ${f(y)}h${f(40 + (y + 600) * 0.02)}" stroke="#C9D2D8" stroke-width="2"/>` : ''; }).join('');
    const fp = frets(667, 0, 22);
    for (const n of [3, 5, 7, 10, 12, 15, 17]) s += `<path d="M0 ${f(-600 + (fp[n] + fp[n - 1]) / 2 - 5)}l5 5l-5 5l-5 -5z" fill="#EDE6D8"/>`;
    s += `<rect x="-20" y="-604" width="40" height="5" fill="#F4EEDF"/>`;
    const y5 = -600 + fp[5];
    s += `<path d="M-26 ${f(y5)}h-14" stroke="#1E120C" stroke-width="6"/><ellipse cx="-44" cy="${f(y5)}" rx="7" ry="8" fill="url(#pearl)" stroke="#8A7A5A"/>`;
    s += range(4, (i) => { const u = (i - 1.5) / 1.5; return `<path d="M${f(u * 14)} -602L${f(u * 30)} 52L${f(u * 10)} 160" stroke="#E6E9EB" stroke-width="1.8" fill="none"/>`; }).join('');
    s += `<path d="M-23 ${f(y5)}L-34 52L-12 160" stroke="#E6E9EB" stroke-width="1.6" fill="none"/>`;
    s += `<path d="M-22 -600L-36 -640Q-48 -690 -30 -740Q0 -768 30 -740Q48 -690 36 -640L22 -600Z" fill="#3A1C0E" stroke="#1E0E06" stroke-width="1.4"/><path d="M-12 -720Q0 -738 12 -720Q0 -700 -12 -720Z" fill="#E9E2D2"/>`;
    for (const [x, y] of [[-1, -650], [1, -650], [-1, -706], [1, -706]]) s += `<path d="M${x * 30} ${y}h${x * 20}" stroke="#AEB9C0" stroke-width="5"/><ellipse cx="${x * 58}" cy="${y}" rx="8" ry="10" fill="url(#pearl)" stroke="#8A7A5A"/>`;
    return place(s, { at: [57, 63], turn: 40, scale: 0.122, about: [0, -270] });
  });
}

function ukulele() {
  return turned(40, () => {
    const L = 240;
    const body = mirrored([GUITAR.map(([x, y]) => [x * L * 1.04, y * L])]);
    const [sx, sy] = toLight(-6);
    let s = `<path d="${body}" fill="#5A2C0E" transform="translate(${f(sx)} ${f(sy)})"/>`;
    s += plate(body, L, 190, { base: '#C27A34', light: '#F2B66C', dark: '#7A4216', deep: '#4A220A', bind: '#F1E6CF', grain: 12, id: 'uk' });
    s += range(5, (i) => `<path d="M${-70 + i * 30} 10C${-60 + i * 30} 80 ${-80 + i * 30} 160 ${-66 + i * 30} 236" stroke="#8A4C1A" stroke-width="5" fill="none" opacity=".25"/>`).join('');
    s += `<circle cx="0" cy="74" r="30" fill="none" stroke="#F1E6CF" stroke-width="3"/><circle cx="0" cy="74" r="25" fill="#140B05"/>`;
    s += `<path d="M-46 172Q-30 164 -20 164H20Q30 164 46 172Q30 180 20 180H-20Q-30 180 -46 172Z" fill="#3A1C0E"/><rect x="-22" y="167" width="44" height="3.6" rx="1.2" fill="#F4EEDF"/>`;
    s += `<path d="M-18 -172L18 -172L22 44Q0 47 -22 44Z" fill="#3A1C0E" stroke="#1E0E06" stroke-width="1"/>`;
    s += frets(345, 1, 15).map((d) => { const y = -172 + d; return y < 44 ? `<path d="M${f(-18 - (y + 172) * 0.018)} ${f(y)}h${f(36 + (y + 172) * 0.036)}" stroke="#D9DDE0" stroke-width="1.6"/>` : ''; }).join('');
    s += `<rect x="-18" y="-176" width="36" height="4" fill="#F4EEDF"/>`;
    s += range(4, (i) => { const u = (i - 1.5) / 1.5; return `<path d="M${f(u * 12)} -174L${f(u * 17)} 170" stroke="#F3EEDF" stroke-width="1.8"/>`; }).join('');
    s += `<path d="M-18 -172L-26 -250Q-26 -262 -14 -262H14Q26 -262 26 -250L18 -172Z" fill="#7A3E14" stroke="#3A1C0E" stroke-width="1.2"/>`;
    for (const [x, y] of [[-1, -198], [1, -198], [-1, -236], [1, -236]]) s += `<circle cx="${x * 12}" cy="${y}" r="4.6" fill="url(#cup)"/><path d="M${x * 24} ${y}h${x * 10}" stroke="#AEB9C0" stroke-width="4"/><ellipse cx="${x * 40}" cy="${y}" rx="7" ry="8" fill="url(#pearl)" stroke="#8A7A5A"/>`;
    return place(s, { at: [57, 63], turn: 40, scale: 0.205, about: [0, 0] });
  });
}

function harp() {
  // a concert pedal harp from the side, the column on the left: 1.85 metres tall, 47 strings
  // (we draw every other one) from the neck down to the soundboard (millimetres, floor at y = 0)
  let h = '';
  const B0 = [196, -150];
  const B1 = [866, -1480];
  const bl = Math.hypot(B1[0] - B0[0], B1[1] - B0[1]);
  const up = [(B1[0] - B0[0]) / bl, (B1[1] - B0[1]) / bl];
  const back = [-up[1], up[0]];
  const board = (t) => [lerp(B0[0], B1[0], t), lerp(B0[1], B1[1], t)];
  const boardY = (x) => B0[1] + ((x - B0[0]) * (B1[1] - B0[1])) / (B1[0] - B0[0]);
  // the neck's curve, under it the brass plates of the pedal action
  const nb = [[20, -1690], [200, -1644], [380, -1566], [520, -1530], [650, -1540], [770, -1578], [884, -1530]];
  const nt = [[20, -1800], [200, -1742], [380, -1658], [520, -1622], [640, -1640], [770, -1700], [880, -1694], [940, -1630], [918, -1520]];
  const neckY = (x) => {
    for (let i = 0; i < nb.length - 1; i++) {
      const [a, b] = [nb[i], nb[i + 1]];
      if (x <= b[0]) { const t = (x - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], (1 - Math.cos(t * Math.PI)) / 2); }
    }
    return nb[nb.length - 1][1];
  };
  const gm = board(0.35);
  h += `<defs><linearGradient id="hbox" gradientUnits="userSpaceOnUse" x1="${f(gm[0])}" y1="${f(gm[1])}" x2="${f(gm[0] + back[0] * 250)}" y2="${f(gm[1] + back[1] * 250)}">${stops([[0, '#F2C98A'], [0.3, '#D99A55'], [0.75, '#A8682C'], [1, '#7A4416']])}</linearGradient>${lin('hneck', [0, 0, 0, 1], [[0, '#F7D9A6'], [0.4, '#DDA25C'], [1, '#9A5E24']])}</defs>`;
  // the soundbox: its back swells out behind the board, deepest at the foot
  const backPts = range(13, (k) => {
    const t = k / 12;
    const d = lerp(372, 104, t) * (1 + 0.07 * Math.sin(t * Math.PI));
    const p = board(t);
    return [p[0] + back[0] * d, p[1] + back[1] * d];
  });
  const boxPath = `${smooth([...backPts].reverse(), false)}L${xy(B0)}L${xy(B1)}Z`;
  h += `<path d="${boxPath}" fill="url(#hbox)" stroke="#5A3410" stroke-width="6"/>`;
  h += `<path d="${smooth(backPts)}" fill="none" stroke="#5A3410" stroke-width="22" opacity=".35" transform="translate(${f(-back[0] * 12)} ${f(-back[1] * 12)})"/>`;
  h += `<path d="${smooth(backPts.map(([x, y], k) => { const t = k / 12; const p = board(t); return [lerp(p[0], x, 0.34), lerp(p[1], y, 0.34)]; }))}" fill="none" stroke="#FFF0D0" stroke-width="16" opacity=".35"/>`;
  // the soundboard's edge and the string rib up its middle
  h += `<path d="M${xy(B0)}L${xy(B1)}" stroke="#F4DEB4" stroke-width="34" stroke-linecap="round"/><path d="M${xy(B0)}L${xy(B1)}" stroke="#C99A3A" stroke-width="8"/>`;
  // the strings: Cs red, Fs dark blue, the lowest wound with wire
  const N = 26;
  const xs = range(N, (i) => lerp(216, 850, i / (N - 1)));
  h += xs.map((x, i) => {
    const yt = neckY(x) + 34;
    const yb = boardY(x) - 6;
    const note = (N - 1 - i) % 7;
    const c = i < 6 ? '#B07A44' : note === 0 ? '#C8322B' : note === 3 ? '#26305C' : '#F4EAD2';
    const w = lerp(13, 6, i / (N - 1));
    return `<path d="M${f(x)} ${f(yt)}V${f(yb)}" stroke="#000" stroke-width="${f(w * 1.5)}" opacity=".2" transform="translate(5 0)"/><path d="M${f(x)} ${f(yt)}V${f(yb)}" stroke="${c}" stroke-width="${f(w)}"/>`;
  }).join('');
  // the neck, its brass action plate, a gold disc where each string meets it, tuning pins above
  h += `<path d="${smooth([...nt, ...[...nb].reverse()], false)}Z" fill="url(#hneck)" stroke="#5A3410" stroke-width="6"/>`;
  h += `<path d="${smooth(nt.slice(0, 7))}" fill="none" stroke="#FFF0D0" stroke-width="12" transform="translate(0 18)" opacity=".6"/>`;
  const plate = [...nb.slice(0, 6).map(([x, y]) => [x + 20, y - 8]), ...nb.slice(0, 6).reverse().map(([x, y]) => [x + 20, y - 62])];
  h += `<path d="${smooth(plate, true)}" fill="url(#goldCY)" stroke="#7A5313" stroke-width="4"/>`;
  h += xs.map((x) => `<circle cx="${f(x)}" cy="${f(neckY(x) + 4)}" r="11" fill="url(#ball)" stroke="#6A4810" stroke-width="2"/><circle cx="${f(x - 6)}" cy="${f(neckY(x) - 52)}" r="6" fill="#2A1A0A"/>`).join('');
  // the column, fluted, a gold crown on top and a gold ring at its foot
  h += `<rect x="-46" y="-1716" width="92" height="1590" fill="url(#mapleC)" stroke="#5A3410" stroke-width="6"/>`;
  h += range(5, (i) => `<path d="M${-28 + i * 14} -1690V-170" stroke="#8A5A24" stroke-width="4" opacity=".45"/>`).join('');
  h += `<rect x="-60" y="-1740" width="120" height="30" rx="8" fill="url(#goldC)" stroke="#6A4810" stroke-width="4"/>`;
  h += `<path d="M-50 -1740C-66 -1780 -78 -1820 -70 -1850H70C78 -1820 66 -1780 50 -1740Z" fill="url(#goldC)" stroke="#6A4810" stroke-width="4"/>`;
  h += range(5, (i) => { const x = -56 + i * 28; return `<path d="M${x} -1745C${x - 12} -1790 ${x - 4} -1830 ${x + 10} -1846C${x + 18} -1820 ${x + 14} -1780 ${x + 2} -1745Z" fill="#FFF1B8" opacity=".45"/>`; }).join('');
  h += `<rect x="-84" y="-1872" width="168" height="26" rx="8" fill="url(#goldC)" stroke="#6A4810" stroke-width="4"/><path d="M-30 -1872Q0 -1920 30 -1872Z" fill="url(#goldC)" stroke="#6A4810" stroke-width="4"/>`;
  h += `<rect x="-62" y="-170" width="124" height="44" rx="8" fill="url(#goldC)" stroke="#6A4810" stroke-width="4"/>`;
  // the base: a maple plinth on four feet, gold trim, and the pedals in their slots
  h += `<path d="M-96 -132H548L560 -28H-104Z" fill="url(#mapleCY)" stroke="#5A3410" stroke-width="6"/><path d="M-96 -120H548" stroke="#E9C46A" stroke-width="8"/>`;
  for (let i = 0; i < 7; i++) {
    const x = -50 + i * 58 + (i > 2 ? 40 : 0);
    h += `<path d="M${x} -96v52" stroke="#2A1608" stroke-width="16" stroke-linecap="round"/><path d="M${x - 22} -62h44" stroke="#6A4810" stroke-width="18" stroke-linecap="round"/><path d="M${x - 22} -64h44" stroke="#F2D47C" stroke-width="10" stroke-linecap="round"/>`;
  }
  h += `<path d="M-92 -28h52v28h-52zM496 -28h56v28h-56z" fill="#4A2A10"/>`;
  return shadow(62, 113, 40, 4, 0.9) + place(h, { at: [62, 113], scale: 0.0575, about: [420, 0] });
}

/* ---- a small camera, for things seen from a little above ----
   World: x to the right, y away from you, z up; the camera turns by `yaw` about the vertical,
   tilts down by `pitch`, and fits what it is shown into `box`. */
function cam(yaw, pitch) {
  const cy = Math.cos(yaw * DEG);
  const sy = Math.sin(yaw * DEG);
  const cp = Math.cos(pitch * DEG);
  const sp = Math.sin(pitch * DEG);
  const rot = ([x, y, z]) => [x * cy - y * sy, x * sy + y * cy, z];
  const C = { k: 1, ox: 0, oy: 0, e: sp };
  C.raw = (p) => { const [X, Y, z] = rot(p); return [X, -(Y * sp + z * cp)]; };
  C.P = (p) => { const [u, v] = C.raw(p); return [C.ox + u * C.k, C.oy + v * C.k]; };
  C.depth = (p) => { const [, Y, z] = rot(p); return Y * cp - z * sp; };
  C.facing = (n) => { const [, Y, z] = rot(n); return -Y * cp + z * sp; };
  const Lr = [-0.45, 0.6 * sp - 0.66 * cp, 0.6 * cp + 0.66 * sp];
  C.lit = (n) => { const [X, Y, z] = rot(n); return Math.max(0, X * Lr[0] + Y * Lr[1] + z * Lr[2]); };
  const Hv = [Lr[0], Lr[1] - cp, Lr[2] + sp].map((v, i, a) => v / Math.hypot(...a));
  C.spec = (n, p = 30) => { const [X, Y, z] = rot(n); return Math.max(0, X * Hv[0] + Y * Hv[1] + z * Hv[2]) ** p; };
  C.fit = (pts, [x0, y0, x1, y1], { bottom = false } = {}) => {
    const q = pts.map(C.raw);
    const minX = Math.min(...q.map((p) => p[0]));
    const maxX = Math.max(...q.map((p) => p[0]));
    const minY = Math.min(...q.map((p) => p[1]));
    const maxY = Math.max(...q.map((p) => p[1]));
    C.k = Math.min((x1 - x0) / (maxX - minX), (y1 - y0) / (maxY - minY));
    C.ox = (x0 + x1) / 2 - ((minX + maxX) / 2) * C.k;
    C.oy = bottom ? y1 - maxY * C.k : (y0 + y1) / 2 - ((minY + maxY) / 2) * C.k;
    return C;
  };
  C.path = (pts, close = true) => poly(pts.map(C.P), close);
  return C;
}
const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a, b, t) => { const A = hexRGB(a); const B = hexRGB(b); return `#${A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join('')}`; };
function sampled(pts, per = 6) {
  // points along a Catmull-Rom curve through pts
  const out = [];
  const n = pts.length;
  const at = (i) => pts[clamp(i, 0, n - 1)];
  for (let i = 0; i < n - 1; i++) {
    const [a, b, c, e] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - e[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + e[j]) * t3)));
    }
  }
  out.push(pts[n - 1]);
  return out;
}

function piano() {
  // a grand piano, lid up on its long stick, seen from the audience's side (centimetres)
  const C = cam(-60, 22);
  const A = 36 * DEG;
  const TOP = 100;
  const BOT = 64;
  const plan = [[0, 24], [150, 24], ...sampled([[150, 30], [150, 62], [146, 92], [128, 116], [104, 134], [86, 152], [74, 172], [64, 188], [48, 199], [26, 203], [8, 200], [0, 190]], 8), [0, 24]];
  const lid = (x, y) => [x * Math.cos(A), y, TOP + 1 + x * Math.sin(A)];
  const all = [...plan.map(([x, y]) => [x, y, 0]), ...plan.map(([x, y]) => lid(x, y)), [0, 0, 80], [150, 0, 64]];
  C.fit(all, [5, 7, 115, 112], { bottom: true });
  let s = '';
  // the floor shadow, darkest under the middle
  const [cxS, cyS] = [75, 110];
  const fl = plan.map(([x, y]) => C.P([x + 3, y + 2, 0]));
  s += `<path d="${poly(fl)}" fill="#000" opacity=".1"/>` + `<path d="${poly(plan.map(([x, y]) => C.P([cxS + (x - cxS) * 0.8, cyS + (y - cyS) * 0.8, 0])))}" fill="#000" opacity=".08"/>`;
  // legs (and the lyre with its pedals), behind the case
  const leg = (x, y) => {
    const w = 4.5;
    const top = C.P([x, y, BOT]);
    const bot = C.P([x, y, 2]);
    const hw = w * C.k;
    return `<path d="M${f(top[0] - hw)} ${f(top[1])}L${f(top[0] + hw)} ${f(top[1])}L${f(bot[0] + hw * 0.6)} ${f(bot[1])}L${f(bot[0] - hw * 0.6)} ${f(bot[1])}Z" fill="#111114"/><path d="M${f(top[0] - hw * 0.4)} ${f(top[1])}L${f(bot[0] - hw * 0.25)} ${f(bot[1])}" stroke="#55575E" stroke-width="${f(hw * 0.35)}"/><ellipse cx="${f(bot[0])}" cy="${f(bot[1])}" rx="${f(hw * 0.8)}" ry="${f(hw * 0.4)}" fill="#C99A3A"/>`;
  };
  s += leg(50, 178);
  const ly = [[70, 30], [80, 30]].map(([x, y]) => [C.P([x, y, BOT]), C.P([x, y, 10])]);
  s += ly.map(([a, b]) => `<path d="M${xy(a)}L${xy(b)}" stroke="#141417" stroke-width="${f(2.4 * C.k)}"/>`).join('');
  s += `<path d="${C.path([[64, 26, 12], [86, 26, 12], [86, 36, 12], [64, 36, 12]])}" fill="#1A1A1E"/><path d="${C.path([[64, 26, 4], [86, 26, 4], [86, 26, 12], [64, 26, 12]])}" fill="#2A2A30"/>`;
  for (const x of [68.5, 75, 81.5]) s += `<path d="M${xy(C.P([x, 26, 7]))}L${xy(C.P([x, 14, 6]))}" stroke="#E2B85A" stroke-width="${f(1.8 * C.k)}" stroke-linecap="round"/>`;
  // the case's sides: black lacquer, lit by which way each piece faces
  let walls = '';
  for (let i = 0; i < plan.length - 1; i++) {
    const [a, b] = [plan[i], plan[i + 1]];
    const n = [b[1] - a[1], -(b[0] - a[0]), 0];
    const l = Math.hypot(n[0], n[1]) || 1;
    const nn = [n[0] / l, n[1] / l, 0];
    if (C.facing(nn) <= 0.02) continue;
    const v = C.lit(nn);
    const c = mixHex('#060608', '#5A5D66', v * 0.9 + Math.pow(Math.max(0, C.facing(nn)), 6) * 0.35);
    walls += `<path d="${C.path([[a[0], a[1], TOP], [b[0], b[1], TOP], [b[0], b[1], BOT], [a[0], a[1], BOT]])}" fill="${c}" stroke="${c}" stroke-width=".3"/>`;
  }
  s += walls;
  // the rim's top edge, and inside: the golden iron frame and the strings
  const rimTop = plan.map(([x, y]) => [x, y, TOP]);
  s += `<defs><clipPath id="in"><path d="${C.path(rimTop)}"/></clipPath>${lin('plate', [0, 0, 1, 1], [[0, '#F6DC8C'], [0.5, '#D3A645'], [1, '#9C7424']])}</defs>`;
  s += `<path d="${C.path(rimTop)}" fill="#22170F"/>`;
  const cx = 70;
  const cyy = 110;
  const inner = plan.map(([x, y]) => [cx + (x - cx) * 0.92, cyy + (y - cyy) * 0.93, TOP - 9]);
  s += `<g clip-path="url(#in)"><path d="${C.path(inner)}" fill="url(#plate)"/>`;
  s += range(26, (i) => { const x = 10 + i * 5; return `<path d="M${xy(C.P([x, 34, TOP - 8]))}L${xy(C.P([x * 0.95 + 2, 200, TOP - 8]))}" stroke="${i < 8 ? '#C98A4A' : '#EDE7DA'}" stroke-width="${f(0.32 * C.k)}" opacity=".8"/>`; }).join('');
  s += `<path d="M${xy(C.P([8, 34, TOP - 8]))}L${xy(C.P([142, 34, TOP - 8]))}" stroke="#8A6A2A" stroke-width="${f(2 * C.k)}"/>`;
  s += [[40, 40, 30, 190], [70, 40, 80, 170], [100, 40, 120, 120]].map(([a, b, c, d]) => `<path d="M${xy(C.P([a, b, TOP - 7]))}L${xy(C.P([c, d, TOP - 7]))}" stroke="#B8902E" stroke-width="${f(2.4 * C.k)}"/>`).join('');
  s += `</g><path d="${C.path(rimTop)}" fill="none" stroke="#8D9099" stroke-width="${f(0.5 * C.k)}"/>`;
  // the keyboard: key slip, the keys, and the cheeks at each end
  s += `<path d="${C.path([[0, 0, 64], [150, 0, 64], [150, 0, 72], [0, 0, 72]])}" fill="#0E0E11"/>`;
  s += `<path d="${C.path([[0, 0, 72], [150, 0, 72], [150, 16, 74], [0, 16, 74]])}" fill="#F7F4EC"/>`;
  const W = (150 - 12) / 52;
  s += range(51, (i) => `<path d="M${xy(C.P([6 + (i + 1) * W, 0, 74]))}L${xy(C.P([6 + (i + 1) * W, 16, 74]))}" stroke="#B9B3A6" stroke-width="${f(0.12 * C.k)}"/>`).join('');
  const black = [];
  for (let i = 0; i < 51; i++) { const note = (i + 5) % 7; if (note !== 2 && note !== 6) black.push(i); }
  s += black.map((i) => { const x = 6 + (i + 1) * W; return `<path d="${C.path([[x - W * 0.3, 6, 75.5], [x + W * 0.3, 6, 75.5], [x + W * 0.3, 16, 75.5], [x - W * 0.3, 16, 75.5]])}" fill="#141418"/>`; }).join('');
  s += `<path d="${C.path([[0, 16, 74], [150, 16, 74], [150, 24, 88], [0, 24, 88]])}" fill="#17171B"/>`;
  for (const x0 of [0, 144]) {
    s += `<path d="${C.path([[x0, 0, 64], [x0 + 6, 0, 64], [x0 + 6, 0, 80], [x0, 0, 80]])}" fill="#1C1C21"/>`;
    s += `<path d="${C.path([[x0, 0, 80], [x0 + 6, 0, 80], [x0 + 6, 24, 80], [x0, 24, 80]])}" fill="#3B3D44"/>`;
  }
  s += `<path d="${C.path([[150, 0, 64], [150, 24, 64], [150, 24, 80], [150, 0, 80]])}" fill="#26272D"/>`;
  s += leg(6, 12) + leg(144, 12);
  // the lid on its stick, and the music desk
  const lidPts = plan.map(([x, y]) => lid(x, y));
  s += `<path d="${C.path(lidPts)}" fill="url(#lidU)" stroke="#000" stroke-width="${f(0.4 * C.k)}"/>`;
  s += `<defs>${lin('lidU', [0, 1, 0.6, 0], [[0, '#2C2418'], [0.35, '#0B0B0D'], [0.7, '#1F2026'], [1, '#55585F']])}</defs>`;
  s += `<path d="${C.path(lidPts.slice(2, -2), false)}" fill="none" stroke="#6E7179" stroke-width="${f(0.8 * C.k)}"/>`;
  const st = C.P([136, 100, TOP]);
  const sb = C.P(lid(146, 100));
  s += `<path d="M${xy(st)}L${xy(sb)}" stroke="#101013" stroke-width="${f(1.6 * C.k)}"/>`;
  s += `<path d="${C.path([[36, 30, TOP], [114, 30, TOP], [114, 36, TOP + 24], [36, 36, TOP + 24]])}" fill="#121216" stroke="#3E4048" stroke-width="${f(0.5 * C.k)}"/>`;
  s += `<path d="M${xy(C.P([38, 36, TOP + 23]))}L${xy(C.P([112, 36, TOP + 23]))}" stroke="#6E7179" stroke-width="${f(0.5 * C.k)}"/>`;
  return s;
}

// A box seen by the camera: the faces that face it, shaded by how they face the light.
function box3(C, [x0, y0, z0], [x1, y1, z1], col, { edge = null, lit = true } = {}) {
  const faces = [
    [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], col.top],
    [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], col.front],
    [[1, 0, 0], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], col.side ?? col.front],
    [[-1, 0, 0], [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], col.side ?? col.front],
  ];
  return faces.filter(([n]) => C.facing(n) > 0.01).map(([n, p, c]) => {
    const fill = lit && Array.isArray(c) ? mixHex(c[0], c[1], C.lit(n)) : (Array.isArray(c) ? c[1] : c);
    return `<path d="${C.path(p)}" fill="${fill}"${edge ? ` stroke="${edge}" stroke-width="${f(0.25 * C.k)}" stroke-linejoin="round"` : ''}/>`;
  }).join('');
}

/* ---- the mallet keyboards ----
   Two octaves of bars laid out like a piano's keys: naturals in front, sharps behind and a
   little higher. A bar's length goes as one over the square root of its pitch, so the rows
   narrow toward the treble and the frame with them. Each bar rests on rails under its two
   nodes, 0.224 of its length from each end, where it hardly moves; under a marimba's or a
   xylophone's bars hang tubes tuned to ring with them, long in the bass and short in the treble.
   Sizes are in centimetres, from real instruments. */
const MALLETS = {
  glockenspiel: { lo: 79, bw: [2.5, 2.5], gap: 0.9, len: [16, 10.5], th: 1, rise: 1.6, row: 1.8, yaw: 14, pitch: 52,
    bar: { top: ['#8E9AA3', '#F7FAFB'], front: ['#4E5A62', '#9AA6AF'], side: ['#46525A', '#8996A0'] }, streak: 0.85,
    head: 'url(#ball)', hr: 1.5, shaft: '#C9A46A' },
  xylophone: { lo: 65, bw: [3.8, 3.8], gap: 1.1, len: [34, 19], th: 2.4, rise: 3.6, row: 2.6, yaw: 22, pitch: 46,
    bar: { top: ['#7A3414', '#E08A50'], front: ['#4A1C08', '#8A4220'], side: ['#3E1606', '#7A3A18'] }, streak: 0.3,
    res: [24, 8], rr: [1.9, 1.5], tube: 'silverC', cap: '#6C7880', height: 84, leg: 1.25, head: '#C8322B', hr: 2.1, shaft: '#D9B57A' },
  marimba: { lo: 48, bw: [6, 4.7], gap: 1.3, len: [46, 26], th: 2.4, rise: 4.4, row: 2.8, yaw: 22, pitch: 36,
    bar: { top: ['#4A1C0A', '#B05A2E'], front: ['#2A0E04', '#5E2812'], side: ['#240C04', '#4E200E'] }, streak: 0.22,
    res: [64, 13], rr: [3.3, 2.3], tube: 'goldC', cap: '#8A6418', height: 88, leg: 1.6, head: '#5B4B9E', hr: 3.1, yarn: true, shaft: '#D9B57A' },
};
const NATURAL = [0, 2, 4, 5, 7, 9, 11];

// A straight beam of square section, its top face's centre line from a to b: the faces turned
// toward the camera, each shaded by how it faces the light.
function beam(C, a, b, w, h, col) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const d = [(b[0] - a[0]) / l, (b[1] - a[1]) / l, 0];
  const n = [-d[1], d[0], 0];
  const off = (p, k) => [p[0] + n[0] * k * w / 2, p[1] + n[1] * k * w / 2, p[2]];
  const [A0, A1, B0, B1] = [off(a, -1), off(a, 1), off(b, -1), off(b, 1)];
  const dn = (p) => [p[0], p[1], p[2] - h];
  const faces = [
    [[0, 0, 1], [A0, B0, B1, A1], col.top],
    [n.map((v) => -v), [A0, B0, dn(B0), dn(A0)], col.front],
    [n, [A1, B1, dn(B1), dn(A1)], col.front],
    [d.map((v) => -v), [A0, A1, dn(A1), dn(A0)], col.side ?? col.front],
    [d, [B0, B1, dn(B1), dn(B0)], col.side ?? col.front],
  ];
  return faces.filter(([nn]) => C.facing(nn) > 0.01)
    .map(([nn, p, c]) => `<path d="${C.path(p)}" fill="${Array.isArray(c) ? mixHex(c[0], c[1], C.lit(nn)) : c}"/>`).join('');
}

// A mallet lying across: shaft from a (the handle) to b, a ball head at b.
function mallet(C, a, b, r, shaft, head, { yarn = false } = {}) {
  const A = C.P(a);
  const B = C.P(b);
  const R = r * C.k;
  return `<path d="M${xy(A)}L${xy(B)}" stroke="#6A4A22" stroke-width="${f(Math.max(0.9, r * 0.36 * C.k))}" stroke-linecap="round"/>`
    + `<path d="M${xy(A)}L${xy(B)}" stroke="${shaft}" stroke-width="${f(Math.max(0.5, r * 0.2 * C.k))}" stroke-linecap="round" transform="translate(-.15 -.15)"/>`
    + `<circle cx="${f(B[0])}" cy="${f(B[1])}" r="${f(R)}" fill="${head}"/>`
    + (yarn ? `<circle cx="${f(B[0])}" cy="${f(B[1])}" r="${f(R * 0.82)}" fill="none" stroke="#000" stroke-width="${f(R * 0.22)}" stroke-dasharray="${f(R * 0.16)} ${f(R * 0.22)}" opacity=".22"/>` : '')
    + `<circle cx="${f(B[0])}" cy="${f(B[1])}" r="${f(R)}" fill="url(#dome)"/>`;
}

function mallets(kind) {
  const K = MALLETS[kind];
  const glock = kind === 'glockenspiel';
  // two octaves of naturals from `lo`, and the sharps between them
  const nat = [];
  for (let m = K.lo; nat.length < 15; m++) if (NATURAL.includes(m % 12)) nat.push(m);
  const span = nat[14] - nat[0];
  const t = (m) => (m - nat[0]) / span;
  const L = (m) => K.len[0] * (K.len[1] / K.len[0]) ** t(m);
  const bw = (m) => lerp(K.bw[0], K.bw[1], t(m));
  let x = 0;
  const front = nat.map((m) => { const b = { m, x, w: bw(m), y: 0 }; x += b.w + K.gap; return b; });
  const W = x - K.gap;
  const back = [];
  for (let i = 0; i < 14; i++) {
    if (nat[i + 1] - nat[i] !== 2) continue;
    const m = nat[i] + 1;
    const w = bw(m);
    back.push({ m, x: front[i].x + front[i].w + K.gap / 2 - w / 2, w, y: (L(m - 1) + L(m)) / 2 + K.row });
  }
  for (const b of [...front, ...back]) b.len = L(b.m);
  const H = glock ? 4.2 : K.height;     // the naturals' tops
  const top = (b) => H + (b.y ? K.rise : 0);
  const res = (m) => K.res[0] * (K.res[1] / K.res[0]) ** t(m);
  const C = cam(K.yaw, K.pitch);

  // the frame's outline at each end: front of the naturals to the back of the sharps
  const ends = [[-3.4, front[0], back[0]], [W + 3.4, front[14], back[back.length - 1]]].map(([ex, fb, bb]) => ({ x: ex, y0: -fb.len / 2 - 2.6, y1: bb.y + bb.len / 2 + 2.6 }));
  const pts = ends.flatMap((e) => [[e.x, e.y0, 0], [e.x, e.y1, 0], [e.x, e.y0, H + K.rise], [e.x, e.y1, H + K.rise]]);
  C.fit(pts, glock ? [6, 16, 114, 104] : [8, 6, 112, 114]);
  let s = '';
  const fp = ends.flatMap((e) => [C.P([e.x, e.y0, 0]), C.P([e.x, e.y1, 0])]);
  const sx = fp.map((p) => p[0]);
  const sy = fp.map((p) => p[1]);
  s += shadow((Math.min(...sx) + Math.max(...sx)) / 2 + 2, (Math.min(...sy) + Math.max(...sy)) / 2 + 2, (Math.max(...sx) - Math.min(...sx)) / 2 + 6, (Math.max(...sy) - Math.min(...sy)) / 2 + 3, glock ? 0.9 : 0.75);

  // rails under each row's nodes, running the length of the instrument
  const rails = (row, z, col, w = 2, h = 2.4) => {
    const [a, b] = [row[0], row[row.length - 1]];
    const ext = (bar, k, sg) => [bar.x + bar.w / 2 + sg * (bar.w / 2 + 2.4), bar.y + k * 0.276 * bar.len, z];
    return [-1, 1].map((k) => beam(C, ext(a, k, -1), ext(b, k, 1), w, h, col)).join('');
  };
  // a bar: its tube underneath, then the bar, its node pins, a gleam along it
  const tubeUnder = (b) => {
    const zt = top(b) - K.th - 3;
    const r = lerp(K.rr[0], K.rr[1], t(b.m));
    const a = C.P([b.x + b.w / 2, b.y, zt]);
    const z = C.P([b.x + b.w / 2, b.y, zt - res(b.m)]);
    const hw = r * C.k;
    return `<path d="M${f(a[0] - hw)} ${f(a[1])}H${f(a[0] + hw)}V${f(z[1])}H${f(a[0] - hw)}Z" fill="url(#${K.tube})"/>`
      + `<ellipse cx="${f(z[0])}" cy="${f(z[1])}" rx="${f(hw)}" ry="${f(hw * C.e)}" fill="${K.cap}"/>`;
  };
  const bar = (b) => {
    const z = top(b);
    let o = box3(C, [b.x, b.y - b.len / 2, z - K.th], [b.x + b.w, b.y + b.len / 2, z], K.bar);
    for (const k of [-1, 1]) {
      const p = C.P([b.x + b.w / 2, b.y + k * 0.276 * b.len, z]);
      o += `<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="${f(b.w * 0.09 * C.k)}" ry="${f(b.w * 0.09 * C.k * C.e)}" fill="#1A1410" opacity=".75"/>`;
    }
    o += `<path d="M${xy(C.P([b.x + b.w * 0.22, b.y - b.len / 2 + 0.8, z]))}L${xy(C.P([b.x + b.w * 0.22, b.y + b.len / 2 - 0.8, z]))}" stroke="#fff" stroke-width="${f(b.w * 0.16 * C.k)}" stroke-linecap="round" opacity="${K.streak}"/>`;
    return o;
  };
  const far = (row) => [...row].sort((p, q) => q.x - p.x);   // the treble end is the farther

  if (glock) {
    // its case: black, lined with red felt, felt rails for the bars
    const [e0, e1] = ends;
    const y0 = Math.min(e0.y0, e1.y0);
    const y1 = Math.max(e0.y1, e1.y1);
    const [x0, x1, wall, floor] = [e0.x, e1.x, 1.1, 1.4];
    s += box3(C, [x0, y0, 0], [x1, y1, H], { top: ['#141010', '#3A3230'], front: ['#0A0808', '#262020'], side: ['#0A0808', '#201A1A'] });
    const inner = [[x0 + wall, y0 + wall], [x1 - wall, y0 + wall], [x1 - wall, y1 - wall], [x0 + wall, y1 - wall]];
    s += `<path d="${C.path(inner.map(([a, b]) => [a, b, floor]))}" fill="#8E1424"/>`;
    s += `<path d="${C.path([[x0 + wall, y1 - wall, floor], [x1 - wall, y1 - wall, floor], [x1 - wall, y1 - wall, H], [x0 + wall, y1 - wall, H]])}" fill="#5E0C18"/>`;
    s += `<path d="${C.path([[x1 - wall, y0 + wall, floor], [x1 - wall, y1 - wall, floor], [x1 - wall, y1 - wall, H], [x1 - wall, y0 + wall, H]])}" fill="#6E1020"/>`;
    // the rim of the case over the felt's edges
    s += `<path d="${C.path([[x0, y0, H], [x1, y0, H], [x1, y1, H], [x0, y1, H]])}${C.path(inner.map(([a, b]) => [a, b, H]))}" fill="#2A2424" fill-rule="evenodd"/>`;
    const feltRail = { top: ['#7A1020', '#C02C3C'], front: ['#4E0812', '#7A1020'] };
    s += rails(back, top(back[0]) - K.th, feltRail, 1.6, top(back[0]) - K.th - floor);
    for (const b of far(back)) s += bar(b);
    s += rails(front, H - K.th, feltRail, 1.6, H - K.th - floor);
    for (const b of far(front)) s += bar(b);
    // two latches on the front
    for (const u of [0.22, 0.78]) {
      const p = C.P([lerp(x0, x1, u), y0, H * 0.55]);
      s += `<rect x="${f(p[0] - 1.6 * C.k)}" y="${f(p[1] - 1.1 * C.k)}" width="${f(3.2 * C.k)}" height="${f(2.2 * C.k)}" rx="${f(0.4 * C.k)}" fill="url(#chromeC)" stroke="#262E33" stroke-width=".3"/>`;
    }
  } else {
    const wood = { top: ['#3A1C0A', '#7A4A26'], front: ['#1E0E04', '#4A2A14'], side: ['#1A0C04', '#3E2210'] };
    const frame = (e, part) => {
      const zr = H - K.th - 2.4;
      const legs = [e.y0 + 1.6, e.y1 - 1.6];
      let o = '';
      if (part !== 'near') {
        o += box3(C, [e.x - K.leg, legs[1] - K.leg, 4], [e.x + K.leg, legs[1] + K.leg, zr + K.rise], wood);
      }
      if (part !== 'back') {
        o += box3(C, [e.x - 1.8, e.y0, zr - 4.4], [e.x + 1.8, e.y1, zr], wood);
        o += box3(C, [e.x - K.leg, e.y0, 19], [e.x + K.leg, e.y1, 22], wood);
        o += box3(C, [e.x - K.leg, legs[0] - K.leg, 4], [e.x + K.leg, legs[0] + K.leg, zr], wood);
        for (const y of legs) {
          const p = C.P([e.x, y, 2]);
          o += `<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="${f(2.4 * C.k)}" ry="${f(2.2 * C.k)}" fill="#141414"/><ellipse cx="${f(p[0] - 0.5 * C.k)}" cy="${f(p[1] - 0.5 * C.k)}" rx="${f(0.9 * C.k)}" ry="${f(0.8 * C.k)}" fill="#6A6A6A"/>`;
        }
      }
      return o;
    };
    const [near, farEnd] = ends;
    s += frame(farEnd, 'all');
    s += frame(near, 'back');
    // the stretcher low down, end to end
    const ym = (farEnd.y0 + farEnd.y1) / 2;
    s += beam(C, [near.x, ym, 22], [farEnd.x, ym, 22], K.leg * 1.6, 3, wood);
    for (const b of far(back)) s += tubeUnder(b);
    s += rails(back, top(back[0]) - K.th, wood);
    for (const b of far(back)) s += bar(b);
    for (const b of far(front)) s += tubeUnder(b);
    s += rails(front, H - K.th, wood);
    for (const b of far(front)) s += bar(b);
    s += frame(near, 'near');
  }

  // a pair of mallets resting across the bars, heads on the sharps
  const zt = top(back[0]) + K.hr * 0.9;
  const m1 = front[4];
  const m2 = front[8];
  const shaft = glock ? 26 : kind === 'xylophone' ? 34 : 40;
  for (const [mb, tw] of [[m1, 0.86], [m2, 1.02]]) {
    const hx = mb.x + mb.w;
    const hy = (back[0].y + back[back.length - 1].y) / 2 * 0.95;
    const hd = [hx, hy, zt];
    const tl = [hx - shaft * Math.sin(tw), hy - shaft * Math.cos(tw), H + K.hr * 0.4];
    s += mallet(C, tl, hd, K.hr, K.shaft, K.head, { yarn: K.yarn });
  }
  return s;
}

function organ() {
  let s = shadow(60, 111, 52, 4);
  const pipe = (x, top, mouth, w, toe = 60) => {
    const h = w / 2;
    return `<path d="M${f(x - h)} ${f(mouth)}L${f(x - w * 0.16)} ${toe}H${f(x + w * 0.16)}L${f(x + h)} ${f(mouth)}Z" fill="url(#silverC)" stroke="#59646C" stroke-width=".2"/>`
      + `<rect x="${f(x - h)}" y="${f(top)}" width="${f(w)}" height="${f(mouth - top)}" fill="url(#silverC)" stroke="#59646C" stroke-width=".2"/>`
      + `<ellipse cx="${f(x)}" cy="${f(top)}" rx="${f(h)}" ry="${f(w * 0.14)}" fill="#59646C"/>`
      + `<path d="M${f(x - w * 0.3)} ${f(mouth + 0.2)}V${f(mouth - w * 0.34)}Q${f(x)} ${f(mouth - w * 0.62)} ${f(x + w * 0.3)} ${f(mouth - w * 0.34)}V${f(mouth + 0.2)}Z" fill="#20262A"/>`;
  };
  // the case: posts, cornices and the pipe shades over the flats
  s += `<rect x="13" y="20" width="94" height="44" fill="url(#walnutY)"/>`;
  s += `<rect x="44" y="9" width="32" height="55" fill="url(#walnutY)"/>`;
  s += `<rect x="15" y="22" width="29" height="40" fill="#1E1208"/><rect x="76" y="22" width="29" height="40" fill="#1E1208"/><rect x="46" y="11" width="28" height="51" fill="#1E1208"/>`;
  // pipes: a tall tower in the middle, a flat either side rising outward
  [[49, 17, 4.6], [54.5, 13, 5], [60, 10, 5.4], [65.5, 13, 5], [71, 17, 4.6]].forEach(([x, t, w]) => { s += pipe(x, t + 3, 41, w); });
  range(6, (i) => [17.6 + i * 4.5, 24 + i * 1.8, 3.8]).forEach(([x, t, w]) => { s += pipe(x, t + 2, 47, w); });
  range(6, (i) => [102.4 - i * 4.5, 24 + i * 1.8, 3.8]).forEach(([x, t, w]) => { s += pipe(x, t + 2, 47, w); });
  s += `<rect x="12" y="17" width="34" height="5" rx="1" fill="url(#walnutY)" stroke="#1A0E06" stroke-width=".4"/><rect x="74" y="17" width="34" height="5" rx="1" fill="url(#walnutY)" stroke="#1A0E06" stroke-width=".4"/>`;
  s += `<path d="M42 9L60 3L78 9V12H42Z" fill="url(#walnutY)" stroke="#1A0E06" stroke-width=".4"/><path d="M42 11.6H78" stroke="#C9A24A" stroke-width="1.2"/><path d="M12 21.4H46M74 21.4H108" stroke="#C9A24A" stroke-width="1"/>`;
  for (const x of [12.5, 43, 75, 105.5]) s += `<rect x="${x}" y="20" width="2.6" height="43" fill="url(#walnut)"/>`;
  // the console below: the music desk, two keyboards, stops either side, the pedals
  s += `<rect x="12" y="62" width="96" height="3" fill="#C9A24A"/><rect x="14" y="65" width="92" height="45" fill="url(#walnutY)"/>`;
  s += `<rect x="27" y="68" width="66" height="31" rx="1" fill="#1A0F07"/><rect x="38" y="69" width="44" height="7" rx="1" fill="url(#walnutY)" stroke="#C9A24A" stroke-width=".4"/>`;
  for (const [y, h] of [[79, 4.6], [86.5, 4.8]]) {
    s += `<rect x="29" y="${y - 1}" width="62" height="${h + 1.2}" fill="#2E1A0C"/><rect x="30" y="${y}" width="60" height="${h}" fill="#F6F2E8"/>`;
    s += range(23, (i) => `<path d="M${f(30 + (i + 1) * (60 / 24))} ${y}v${h}" stroke="#B9B3A6" stroke-width=".18"/>`).join('');
    s += range(23, (i) => (((i + 5) % 7) % 7 !== 2 && ((i + 5) % 7) !== 6 ? `<rect x="${f(30 + (i + 1) * (60 / 24) - 0.75)}" y="${y}" width="1.5" height="${f(h * 0.6)}" fill="#141418"/>` : '')).join('');
  }
  for (const x0 of [18, 95]) for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) s += `<circle cx="${x0 + c * 3.8}" cy="${71 + r * 6.4}" r="1.35" fill="#F4EEDF" stroke="#3A2010" stroke-width=".4"/>`;
  s += `<path d="M24 100H96L102 109H18Z" fill="#2A170A"/>`;
  s += range(17, (i) => `<path d="M${f(28 + i * 4)} 101L${f(24.6 + i * 4.4)} 108.4" stroke="#D9BE8A" stroke-width="2"/>`).join('');
  return s;
}

/* ---- drums and cymbals: seen from a little above, so a circle is an ellipse squashed by e ---- */

// A drum standing up: its shell from the top rim at cy down by h, the head, hoops, lugs and rods.
function drumV(cx, cy, r, h, e, { shell = '#7A1424', head = 'headW', lugs = 8, hoop = '#D7DEE3', wood = false, bottom = true, lugH = 0.34 } = {}) {
  const re = r * e;
  let s = `<path d="M${f(cx - r)} ${f(cy)}V${f(cy + h)}A${f(r)} ${f(re)} 0 0 0 ${f(cx + r)} ${f(cy + h)}V${f(cy)}Z" fill="${shell}"/>`;
  if (wood) s += range(9, (i) => { const x = cx - r + ((i + 0.5) * 2 * r) / 9; return `<path d="M${f(x)} ${f(cy)}v${f(h + re * Math.sqrt(Math.max(0, 1 - ((x - cx) / r) ** 2)))}" stroke="#000" stroke-width="${f(r * 0.012)}" opacity=".25"/>`; }).join('');
  s += `<path d="M${f(cx - r)} ${f(cy)}V${f(cy + h)}A${f(r)} ${f(re)} 0 0 0 ${f(cx + r)} ${f(cy + h)}V${f(cy)}Z" fill="url(#cyl)"/>`;
  if (bottom) s += `<path d="M${f(cx - r)} ${f(cy + h - r * 0.03)}A${f(r)} ${f(re)} 0 0 0 ${f(cx + r)} ${f(cy + h - r * 0.03)}" fill="none" stroke="${hoop}" stroke-width="${f(r * 0.07)}"/>`;
  for (let i = 0; i < lugs; i++) {
    const a = ((i + 0.5) / lugs) * TAU;
    const sn = Math.sin(a);
    if (sn < 0.12) continue;
    const x = cx + Math.cos(a) * r;
    const y = cy + sn * re;
    const w = r * 0.09 * (0.35 + 0.65 * sn);
    s += `<path d="M${f(x)} ${f(y)}V${f(y + h * 0.3)}" stroke="#AEB9C0" stroke-width="${f(r * 0.025)}"/>`;
    s += `<rect x="${f(x - w)}" y="${f(y + h * (0.5 - lugH / 2))}" width="${f(2 * w)}" height="${f(h * lugH)}" rx="${f(w * 0.8)}" fill="url(#chromeC)"/>`;
    if (bottom) s += `<path d="M${f(x)} ${f(y + h * 0.7)}V${f(y + h)}" stroke="#AEB9C0" stroke-width="${f(r * 0.025)}"/>`;
  }
  s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(re)}" fill="url(#${head})"/>`;
  s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(re)}" fill="none" stroke="#56626A" stroke-width="${f(r * 0.09)}"/><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(re)}" fill="none" stroke="${hoop}" stroke-width="${f(r * 0.05)}"/>`;
  s += `<path d="M${f(cx - r * 0.96)} ${f(cy - re * 0.1)}A${f(r)} ${f(re)} 0 0 1 ${f(cx - r * 0.2)} ${f(cy - re * 0.99)}" fill="none" stroke="#fff" stroke-width="${f(r * 0.025)}"/>`;
  return s;
}
// A cymbal, seen from a little above: its bell, the lathe's rings, a glint.
function cymbal(cx, cy, r, e, rot = 0, { bell = 0.2 } = {}) {
  const ry = r * e;
  return `<g transform="rotate(${rot} ${f(cx)} ${f(cy)})"><ellipse cx="${f(cx)}" cy="${f(cy + ry * 0.15)}" rx="${f(r)}" ry="${f(ry)}" fill="#6A4810"/><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(ry)}" fill="url(#cymbal)"/>`
    + range(5, (i) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r * (0.32 + i * 0.14))}" ry="${f(ry * (0.32 + i * 0.14))}" fill="none" stroke="${i % 2 ? '#FFF1B8' : '#9A6E1E'}" stroke-width="${f(r * 0.012)}" opacity=".55"/>`).join('')
    + `<ellipse cx="${f(cx)}" cy="${f(cy - ry * 0.25)}" rx="${f(r * bell)}" ry="${f(ry * bell * 1.2)}" fill="url(#cymbal)" stroke="#9A6E1E" stroke-width="${f(r * 0.015)}"/>`
    + `<path d="M${f(cx - r * 0.85)} ${f(cy - ry * 0.3)}A${f(r)} ${f(ry)} 0 0 1 ${f(cx - r * 0.1)} ${f(cy - ry * 0.98)}" fill="none" stroke="#FFF8DC" stroke-width="${f(r * 0.04)}"/></g>`;
}
const chrome = (d, w) => `<path d="${d}" fill="none" stroke="#3E4951" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#C9D2D8" stroke-width="${f(w * 0.5)}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${f(-w * 0.12)} ${f(-w * 0.12)})"/>`;
const stick = (x0, y0, x1, y1, w = 2.2, c = '#E2BE84') => `<path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}" stroke="#8A6030" stroke-width="${f(w)}" stroke-linecap="round"/><path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}" stroke="${c}" stroke-width="${f(w * 0.6)}" stroke-linecap="round" transform="translate(${f(-w * 0.15)} ${f(-w * 0.15)})"/><ellipse cx="${f(x1)}" cy="${f(y1)}" rx="${f(w * 0.7)}" ry="${f(w * 0.55)}" fill="${c}" stroke="#8A6030" stroke-width="${f(w * 0.2)}"/>`;

function drums() {
  let s = shadow(60, 108, 56, 6);
  // stands: hi-hat, crash and ride; then the cymbals on them
  s += chrome('M13 52V104M13 104l-7 6M13 104l7 6M13 104v6', 1.6);
  s += chrome('M30 30L36 46V104M36 104l-7 6M36 104l7 5', 1.4);
  s += chrome('M97 36L90 52V104M90 104l-7 6M90 104l8 5', 1.4);
  s += cymbal(30, 28, 17, 0.24, -10, { bell: 0.17 });
  s += cymbal(98, 36, 19, 0.24, 8, { bell: 0.16 });
  s += cymbal(13, 54, 11, 0.24) + cymbal(13, 50, 11, 0.24);
  // the floor tom on its legs, the snare on its stand
  s += chrome('M84 92L80 108M101 92L104 108', 1.3);
  s += drumV(92, 64, 14, 26, 0.36, { lugs: 8 });
  s += chrome('M27 76V104M27 104l-7 5M27 104l6 6M20 74l7 4l7 -4', 1.3);
  s += drumV(27, 63, 12, 8, 0.4, { lugs: 8, lugH: 0.5 });
  // the bass drum, its front head facing you, the shell turning away to the right
  s += `<ellipse cx="66" cy="82" rx="23" ry="24" fill="#4A0C16"/><path d="M58 58H66V106H58Z" fill="#7A1424"/><path d="M58 58Q63 56 66 58V106Q63 108 58 106Z" fill="url(#cyl)"/>`;
  s += `<ellipse cx="58" cy="82" rx="23.6" ry="24.6" fill="#8E1A2C"/><ellipse cx="58" cy="82" rx="23.6" ry="24.6" fill="none" stroke="#C9D2D8" stroke-width=".8"/>`;
  s += range(10, (i) => { const a = (i / 10) * TAU; return `<rect x="${f(58 + Math.cos(a) * 22.6 - 1.2)}" y="${f(82 + Math.sin(a) * 23.6 - 1.2)}" width="2.4" height="2.4" rx=".6" fill="url(#chromeC)"/>`; }).join('');
  s += `<ellipse cx="58" cy="82" rx="20.4" ry="21.4" fill="url(#headW)" stroke="#4A0C16" stroke-width=".6"/><circle cx="58" cy="82" r="12" fill="none" stroke="#C9C2B4" stroke-width=".5"/><circle cx="66" cy="92" r="3.4" fill="#2A2A2A" opacity=".85"/>`;
  s += chrome('M38 98l-6 9M78 98l6 9', 1.3);
  // the two toms on top
  s += chrome('M58 58V48', 1.6);
  s += drumV(46, 44, 10, 9, 0.48, { lugs: 6 });
  s += drumV(70, 42, 11, 10, 0.48, { lugs: 6 });
  s += stick(36, 40, 60, 62, 1.6) + stick(84, 46, 62, 62, 1.6);
  return s;
}

function timpani() {
  let s = shadow(60, 108, 46, 6);
  // the base, its three legs and the pedal
  s += chrome('M60 92V100M60 100L34 108M60 100L86 108M60 100V109', 2);
  s += `<path d="M52 104h16l2 6h-20z" fill="#2A2A2A"/><path d="M53 104h14" stroke="#9AA6AF" stroke-width="1"/>`;
  // the copper kettle
  s += `<path d="M18 46C18 74 34 94 60 94C86 94 102 74 102 46Z" fill="url(#copper)" stroke="#5A240E" stroke-width=".8"/>`;
  s += range(6, (i) => `<path d="M${f(20 + i * 1.5)} ${f(52 + i * 7)}Q60 ${f(64 + i * 8)} ${f(100 - i * 1.5)} ${f(52 + i * 7)}" fill="none" stroke="${i % 2 ? '#FFC79A' : '#7A3518'}" stroke-width=".5" opacity=".45"/>`).join('');
  s += `<path d="M28 58Q32 80 52 90" fill="none" stroke="#FFE0C2" stroke-width="2.4" opacity=".5"/>`;
  // struts from the rim down to the base ring
  for (const x of [26, 44, 76, 94]) s += chrome(`M${x} 50L${f(60 + (x - 60) * 0.3)} 90`, 1.2);
  s += `<ellipse cx="60" cy="90" rx="14" ry="3.6" fill="none" stroke="#3E4951" stroke-width="2.2"/><ellipse cx="60" cy="90" rx="14" ry="3.6" fill="none" stroke="#C9D2D8" stroke-width="1"/>`;
  // the head (calfskin), the counterhoop and its tuning handles
  s += `<ellipse cx="60" cy="45" rx="42" ry="13" fill="url(#calf)"/><ellipse cx="60" cy="45" rx="42" ry="13" fill="none" stroke="#3E4951" stroke-width="3"/><ellipse cx="60" cy="45" rx="42" ry="13" fill="none" stroke="#D7DEE3" stroke-width="1.4"/>`;
  s += `<path d="M22 42A42 13 0 0 1 48 32.6" fill="none" stroke="#fff" stroke-width="1"/>`;
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * TAU;
    if (Math.sin(a) < 0.1) continue;
    const x = 60 + Math.cos(a) * 42;
    const y = 45 + Math.sin(a) * 13;
    s += chrome(`M${f(x)} ${f(y)}V${f(y + 7)}`, 1.4) + `<path d="M${f(x - 2.4)} ${f(y - 2)}h4.8" stroke="#C9D2D8" stroke-width="1.4" stroke-linecap="round"/>`;
  }
  s += mallet2(40, 22, 64, 44, 4.2) + mallet2(88, 18, 70, 42, 4.2);
  return s;
}
// A timpani or bass drum mallet: a cane shaft and a felt ball, lying from a (handle) to b (head).
const mallet2 = (x0, y0, x1, y1, r, felt = '#F1EBDD') => `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="#7A5A30" stroke-width="${f(r * 0.4)}" stroke-linecap="round"/><path d="M${x0} ${y0}L${x1} ${y1}" stroke="#D9B57A" stroke-width="${f(r * 0.2)}" stroke-linecap="round" transform="translate(-.3 -.3)"/><circle cx="${x1}" cy="${y1}" r="${r}" fill="${felt}" stroke="#A89A80" stroke-width=".5"/><circle cx="${f(x1 - r * 0.3)}" cy="${f(y1 - r * 0.3)}" r="${f(r * 0.45)}" fill="#fff" opacity=".6"/>`;

function snare() {
  let s = shadow(60, 108, 34, 5);
  s += chrome('M60 78V104M60 104L44 110M60 104L77 110M60 104V111', 2);
  s += chrome('M42 72L60 80L78 72', 1.8);
  s += drumV(60, 46, 34, 24, 0.36, { shell: '#B5733A', wood: true, lugs: 10, lugH: 0.44 });
  s += `<rect x="88" y="54" width="7" height="8" rx="1.4" fill="url(#chromeC)"/><path d="M95 56l4 -3" stroke="#3E4951" stroke-width="1.6" stroke-linecap="round"/>`;
  s += stick(26, 24, 64, 46, 2.6) + stick(96, 20, 58, 44, 2.6);
  return s;
}

function bassdrum() {
  // the orchestra's bass drum, tipped in its stand, a lambswool beater against it
  let s = shadow(60, 109, 50, 6);
  s += chrome('M30 96L24 109M92 96L98 109M30 96H92', 2.2);
  s += chrome('M38 86L30 98M84 86L92 98', 2);
  // the shell (mahogany) turning away to the right, then the near head
  s += `<ellipse cx="72" cy="56" rx="15" ry="40" fill="#3A1408"/><path d="M50 16H72V96H50Z" fill="#7A3416"/><path d="M50 16Q62 14 72 16V96Q62 98 50 96Z" fill="url(#cyl)"/>`;
  s += range(12, (i) => { const y = 20 + i * 6.6; return `<path d="M52 ${f(y)}H74" stroke="#D7DEE3" stroke-width=".8"/>`; }).join('');
  s += `<ellipse cx="50" cy="56" rx="17" ry="41" fill="#5A220C"/><ellipse cx="50" cy="56" rx="17" ry="41" fill="none" stroke="#2A0E04" stroke-width="2"/>`;
  s += range(12, (i) => { const a = (i / 12) * TAU; return `<rect x="${f(50 + Math.cos(a) * 16.5 - 1.4)}" y="${f(56 + Math.sin(a) * 40.4 - 1.6)}" width="2.8" height="3.2" rx=".6" fill="url(#chromeC)"/>`; }).join('');
  s += `<ellipse cx="50" cy="56" rx="14" ry="37.4" fill="url(#calf)"/><ellipse cx="46" cy="44" rx="5" ry="14" fill="#fff" opacity=".35"/><ellipse cx="54" cy="66" rx="4" ry="9" fill="#C9A26A" opacity=".25"/>`;
  s += mallet2(92, 28, 64, 60, 6, '#F4EEE4');
  return s;
}

function cymbals() {
  let s = shadow(60, 108, 46, 5);
  const pair = (cx, cy, r, rot) => `<g transform="rotate(${rot} ${cx} ${cy})">${cymbal(cx, cy, r, 0.92, 0, { bell: 0.22 })}</g>`;
  s += pair(78, 54, 30, 18);
  s += `<path d="M78 54C86 48 92 36 90 26" fill="none" stroke="#5A3418" stroke-width="3.4" stroke-linecap="round"/>`;
  s += pair(42, 62, 32, -14);
  s += `<path d="M42 62C34 54 30 42 33 30" fill="none" stroke="#5A3418" stroke-width="3.6" stroke-linecap="round"/><path d="M33 30c2 -3 5 -3 6 0" fill="none" stroke="#5A3418" stroke-width="3"/>`;
  s += `<circle cx="42" cy="62" r="3.4" fill="#5A3418"/><circle cx="78" cy="54" r="3" fill="#5A3418"/>`;
  return s;
}

function triangle() {
  let s = shadow(60, 110, 30, 3.6, 0.7);
  s += `<path d="M60 4V14" stroke="#3A3A3A" stroke-width="1"/><path d="M53 4H67V9H53Z" fill="url(#chromeC)"/>`;
  s += `<path d="M60 14C56 16 56 22 60 24C64 22 64 16 60 14" fill="none" stroke="#2A2A2A" stroke-width=".9"/>`;
  // three steel bars, bent at two corners and open at the third
  const A = [60, 26];
  const B = [24, 92];
  const Cc = [96, 92];
  s += cone([[B[0] + 5, B[1] - 9], [A[0] - 3, A[1] + 3]], 2.4, 'chrome');
  s += cone([[A[0] + 3, A[1] + 3], [Cc[0] - 2, Cc[1] - 3]], 2.4, 'chrome');
  s += cone([[B[0] + 3, B[1]], [Cc[0] - 3, Cc[1]]], 2.4, 'chrome');
  s += tube(`M${A[0] - 3.5} ${A[1] + 4}Q${A[0]} ${A[1] - 3} ${A[0] + 3.5} ${A[1] + 4}`, 4.8, 'chrome');
  s += tube(`M${Cc[0] - 3} ${Cc[1] - 4.5}Q${Cc[0] + 3} ${Cc[1]} ${Cc[0] - 4} ${Cc[1]}`, 4.8, 'chrome');
  s += tube(`M${B[0] + 6} ${B[1] - 10}Q${B[0] + 1} ${B[1] - 2} ${B[0] + 4} ${B[1]}`, 4.8, 'chrome');
  // the beater
  s += cone([[104, 34], [70, 74]], 1.4, 'chrome') + `<path d="M104 34L112 25" stroke="#1A1A1A" stroke-width="3.6" stroke-linecap="round"/>`;
  return s;
}

function tambourine() {
  let s = shadow(60, 100, 46, 7);
  const cx = 60;
  const cy = 54;
  const r = 44;
  const e = 0.5;
  // the wooden hoop, its front showing the jingles in their slots
  s += `<path d="M${cx - r} ${cy}V${cy + 14}A${r} ${r * e} 0 0 0 ${cx + r} ${cy + 14}V${cy}Z" fill="#B8783C"/><path d="M${cx - r} ${cy}V${cy + 14}A${r} ${r * e} 0 0 0 ${cx + r} ${cy + 14}V${cy}Z" fill="url(#cyl)"/>`;
  for (let i = 0; i < 5; i++) {
    const a = (0.12 + (i * 0.76) / 4) * Math.PI;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * e + 7;
    const w = 7.5 * (0.4 + 0.6 * Math.sin(a));
    s += `<rect x="${f(x - w)}" y="${f(y - 4)}" width="${f(2 * w)}" height="8" rx="1.5" fill="#2A1608"/>`;
    s += `<ellipse cx="${f(x - w * 0.45)}" cy="${f(y)}" rx="${f(w * 0.42)}" ry="3.8" fill="url(#cymbal)" stroke="#8A6418" stroke-width=".4"/><ellipse cx="${f(x + w * 0.45)}" cy="${f(y)}" rx="${f(w * 0.42)}" ry="3.8" fill="url(#cymbal)" stroke="#8A6418" stroke-width=".4"/>`;
  }
  // the head, tacked round its edge
  s += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * e}" fill="#8A5428"/><ellipse cx="${cx}" cy="${cy}" rx="${r - 3}" ry="${(r - 3) * e}" fill="url(#calf)"/>`;
  s += range(16, (i) => { const a = (i / 16) * TAU; return `<circle cx="${f(cx + Math.cos(a) * (r - 1.5))}" cy="${f(cy + Math.sin(a) * (r - 1.5) * e)}" r=".8" fill="#E9C46A"/>`; }).join('');
  s += `<ellipse cx="${cx - 12}" cy="${cy - 6}" rx="16" ry="6" fill="#fff" opacity=".3"/>`;
  return s;
}

function gong() {
  let s = shadow(60, 112, 50, 4);
  // the frame: two posts on feet, a beam with turned-up ends
  s += `<path d="M14 18V108M106 18V108" stroke="#3A1408" stroke-width="7"/><path d="M14 18V108M106 18V108" stroke="#8A3A1C" stroke-width="4"/>`;
  s += `<path d="M6 110h18M96 110h18" stroke="#3A1408" stroke-width="4" stroke-linecap="round"/>`;
  s += `<path d="M4 14Q8 20 14 18H106Q112 20 116 14Q114 24 106 24H14Q6 24 4 14Z" fill="#8A3A1C" stroke="#3A1408" stroke-width="1"/>`;
  s += `<path d="M44 24L52 34M76 24L68 34" stroke="#2A1A10" stroke-width="1"/>`;
  // the gong: bronze, a raised boss in the middle, darker rings round it
  s += `<circle cx="60" cy="68" r="38" fill="#5A3A0C"/><circle cx="59" cy="67" r="37" fill="url(#cymbal)"/>`;
  s += `<circle cx="59" cy="67" r="33" fill="none" stroke="#7A5313" stroke-width="2"/><circle cx="59" cy="67" r="24" fill="none" stroke="#8A6418" stroke-width="5" opacity=".55"/><circle cx="59" cy="67" r="16" fill="#9A7020" opacity=".55"/>`;
  s += `<circle cx="59" cy="67" r="8" fill="url(#cymbal)" stroke="#6A4810" stroke-width="1"/><circle cx="57" cy="65" r="3" fill="#FFF6D0" opacity=".8"/>`;
  s += `<path d="M30 52A34 34 0 0 1 52 34" fill="none" stroke="#FFF1B8" stroke-width="2" opacity=".7"/>`;
  s += mallet2(104, 96, 92, 66, 5.4, '#C8322B');
  return s;
}

function sleighBells() {
  let s = shadow(64, 102, 44, 8);
  // a leather strap in a ring, a handle, and brass bells round it
  s += `<ellipse cx="66" cy="66" rx="36" ry="28" fill="none" stroke="#3A1E0C" stroke-width="9"/><ellipse cx="66" cy="66" rx="36" ry="28" fill="none" stroke="#7A4418" stroke-width="6"/><ellipse cx="66" cy="66" rx="36" ry="28" fill="none" stroke="#C9A06A" stroke-width=".6" stroke-dasharray="2 2"/>`;
  s += cone(bez([10, 22], [18, 28], [24, 34], [34, 44], 6), (i, t) => 5.6 + t, 'maple');
  s += `<path d="M31 41l7 7" stroke="#C99A3A" stroke-width="10"/>`;
  const bell = (x, y, r) => `<circle cx="${f(x + r * 0.15)}" cy="${f(y + r * 0.2)}" r="${f(r)}" fill="#5A3A0C" opacity=".5"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#ball)"/><path d="M${f(x - r * 0.55)} ${f(y + r * 0.35)}Q${f(x)} ${f(y + r * 0.6)} ${f(x + r * 0.55)} ${f(y + r * 0.35)}" stroke="#2A1A04" stroke-width="${f(r * 0.22)}" fill="none"/>`;
  const B = range(12, (i) => { const a = -2.2 + (i / 12) * TAU; return [66 + Math.cos(a) * 36, 66 + Math.sin(a) * 28, Math.sin(a)]; });
  for (const [x, y] of B.filter((b) => b[2] < 0)) s += bell(x, y, 6.6);
  for (const [x, y] of B.filter((b) => b[2] >= 0)) s += bell(x, y, 7);
  return s;
}

/* ---- around the world ---- */

// A hand drum standing up: a barrel of staves (its radius along it given by prof, 0 at the
// head to 1 at the foot), a rawhide head with its spine, a chrome rim and side-plate lugs.
function handDrum(cx, top, r, h, e, prof, { wood = '#8A4A1E', staves = 9, lugs = 6, foot = true } = {}) {
  const ts = range(17, (k) => k / 16);
  const side = (sg) => ts.map((t) => [cx + sg * r * prof(t), top + t * h]);
  const re = (t) => r * prof(t) * e;
  const L = side(-1);
  const R = side(1);
  const rb = r * prof(1);
  const shell = `M${xy(L[0])}${L.slice(1).map((p) => `L${xy(p)}`).join('')}A${f(rb)} ${f(re(1))} 0 0 0 ${xy(R[16])}${R.slice(0, 16).reverse().map((p) => `L${xy(p)}`).join('')}Z`;
  let s = `<path d="${shell}" fill="${wood}"/>`;
  s += range(staves, (i) => {
    const u = -1 + ((i + 0.5) * 2) / staves;
    const p = ts.map((t) => [cx + u * r * prof(t), top + t * h + Math.sqrt(1 - u * u) * re(t)]);
    return `<path d="${poly(p, false)}" stroke="#2A1206" stroke-width="${f(r * 0.022)}" fill="none" opacity=".45"/>`;
  }).join('');
  s += `<path d="${shell}" fill="url(#cyl)"/>`;
  if (foot) s += `<path d="M${f(cx - rb)} ${f(top + h - 3)}A${f(rb)} ${f(re(1))} 0 0 0 ${f(cx + rb)} ${f(top + h - 3)}V${f(top + h)}A${f(rb)} ${f(re(1))} 0 0 1 ${f(cx - rb)} ${f(top + h)}Z" fill="#1C1B1A"/>`;
  // lugs: a hook from the rim down to a plate on the shell, on the side toward you
  for (let i = 0; i < lugs; i++) {
    const a = ((i + 0.5) / lugs) * TAU;
    const sn = Math.sin(a);
    if (sn < 0.15) continue;
    const t = 0.24;
    const x0 = cx + Math.cos(a) * r * 1.04;
    const y0 = top + sn * r * e;
    const x1 = cx + Math.cos(a) * r * prof(t) * 1.02;
    const y1 = top + t * h + sn * re(t);
    const w = r * 0.07 * (0.4 + 0.6 * sn);
    s += `<path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1 - 2)}" stroke="#3E4951" stroke-width="${f(r * 0.05)}"/><path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1 - 2)}" stroke="#D7DEE3" stroke-width="${f(r * 0.022)}"/>`;
    s += `<rect x="${f(x1 - w)}" y="${f(y1 - 3)}" width="${f(2 * w)}" height="${f(h * 0.13)}" rx="${f(w * 0.5)}" fill="url(#chromeC)" stroke="#3E4951" stroke-width=".3"/>`;
  }
  // the head, with the spine's darker band, and the rim
  const he = r * e;
  s += `<ellipse cx="${f(cx)}" cy="${f(top)}" rx="${f(r)}" ry="${f(he)}" fill="url(#hide)"/>`;
  s += `<path d="M${f(cx - r * 0.5)} ${f(top - he * 0.85)}Q${f(cx + r * 0.05)} ${f(top)} ${f(cx + r * 0.35)} ${f(top + he * 0.9)}" stroke="#A07440" stroke-width="${f(r * 0.22)}" fill="none" opacity=".28"/>`;
  s += `<ellipse cx="${f(cx - r * 0.25)}" cy="${f(top - he * 0.2)}" rx="${f(r * 0.35)}" ry="${f(he * 0.35)}" fill="#fff" opacity=".22"/>`;
  s += `<ellipse cx="${f(cx)}" cy="${f(top)}" rx="${f(r * 1.03)}" ry="${f(he * 1.03)}" fill="none" stroke="#3E4951" stroke-width="${f(r * 0.11)}"/><ellipse cx="${f(cx)}" cy="${f(top)}" rx="${f(r * 1.03)}" ry="${f(he * 1.03)}" fill="none" stroke="#D7DEE3" stroke-width="${f(r * 0.055)}"/>`;
  s += `<path d="M${f(cx - r)} ${f(top - he * 0.25)}A${f(r * 1.03)} ${f(he * 1.03)} 0 0 1 ${f(cx - r * 0.25)} ${f(top - he)}" fill="none" stroke="#fff" stroke-width="${f(r * 0.03)}"/>`;
  return s;
}

function congas() {
  const conga = (t) => 0.9 + 0.42 * t - 0.62 * t * t + 0.08 * t ** 3 + 0.12 * Math.sin(t * Math.PI) * 0.6;
  let s = shadow(64, 106, 46, 6);
  s += handDrum(80, 18, 18, 84, 0.3, conga, { wood: '#7A3E18' });
  s += handDrum(42, 26, 16.5, 80, 0.3, conga, { wood: '#93501F' });
  return s;
}

function bongos() {
  const bongo = (t) => 1 - 0.18 * t;
  let s = shadow(60, 90, 52, 9);
  s += `<path d="M44 58H74V76H44Z" fill="#5A2410"/><path d="M44 58H74V62H44Z" fill="#7A3418"/>`;
  s += handDrum(84, 46, 23, 34, 0.42, bongo, { wood: '#7A2E16', staves: 0, lugs: 4 });
  s += handDrum(36, 54, 19, 30, 0.42, bongo, { wood: '#86361A', staves: 0, lugs: 4 });
  return s;
}

function agogo() {
  // two chrome bells, 6 and 7¼ inches long, welded to a steel rod bent round in a U from one
  // bell's tip to the other's and on into a rubber grip (tenths of an inch)
  const T = -36;
  return turned(T, () => {
    const B = [
      { y: -13, L: 60, r0: 3, r1: 13.5, splay: -4 },
      { y: 15, L: 72, r0: 3.6, r1: 16.5, splay: 4 },
    ];
    let s = '';
    const yc = (B[0].y + B[1].y) / 2;
    const ur = (B[1].y - B[0].y) / 2;
    // the rod: back from the tips, round the U, and on into the grip
    const U = [[2, B[0].y], [-5, B[0].y], ...range(11, (k) => { const a = (Math.PI * (k + 1)) / 12; return [-5 - Math.sin(a) * ur, yc - Math.cos(a) * ur]; }), [-5, B[1].y], [2, B[1].y]];
    s += `<ellipse cx="-14" cy="${f(yc + 9)}" rx="92" ry="26" fill="url(#shadow)" opacity=".75"/>`;
    s += tube(`M${U.map(xy).join('L')}`, 3.4, 'chrome');
    const a0 = -5 - ur;
    s += tube(`M${f(a0 + 1)} ${f(yc)}H${f(a0 - 24)}`, 3.8, 'chrome');
    // the grip, ribbed, with a rounded end
    s += cone(straight(a0 - 22, yc, a0 - 76, yc, 6), (i, t) => (t > 0.94 ? 4.2 : 4.6), 'black');
    s += range(17, (k) => { const x = a0 - 25 - k * 3; return `<path d="M${f(x)} ${f(yc - 4.4)}V${f(yc + 4.4)}" stroke="#000" stroke-width=".9" opacity=".55"/><path d="M${f(x - 0.9)} ${f(yc - 4)}V${f(yc - 1)}" stroke="#55504B" stroke-width=".5"/>`; }).join('');
    s += `<ellipse cx="${f(a0 - 76)}" cy="${f(yc)}" rx="1.6" ry="4.2" fill="#141210"/>`;
    // the bells: a closed tip on the rod, opening to the mouth, seen a little from in front
    for (const b of B) {
      const d = [Math.cos(b.splay * DEG), Math.sin(b.splay * DEG)];
      const pts = range(15, (k) => [(k / 14) * b.L * d[0], b.y + (k / 14) * b.L * d[1]]);
      s += cone(pts, (i, t) => b.r0 + (b.r1 - b.r0) * t ** 1.3, 'chrome');
      s += `<ellipse cx="${f(pts[0][0])}" cy="${f(b.y)}" rx="1.4" ry="${f(b.r0)}" fill="#8A969E"/>`;
      const [ex, ey] = pts[14];
      const r = b.r1;
      s += `<g transform="rotate(${f(b.splay)} ${f(ex)} ${f(ey)})">`
        + `<ellipse cx="${f(ex)}" cy="${f(ey)}" rx="${f(r * 0.36)}" ry="${f(r)}" fill="#59656D"/>`
        + `<ellipse cx="${f(ex + r * 0.05)}" cy="${f(ey + r * 0.1)}" rx="${f(r * 0.24)}" ry="${f(r * 0.78)}" fill="#1C2226"/>`
        + `<ellipse cx="${f(ex)}" cy="${f(ey)}" rx="${f(r * 0.36)}" ry="${f(r)}" fill="none" stroke="#262E33" stroke-width="${f(r * 0.1)}"/>`
        + `<path d="M${f(ex - r * 0.2)} ${f(ey - r * 0.84)}A${f(r * 0.36)} ${f(r)} 0 0 1 ${f(ex + r * 0.33)} ${f(ey + r * 0.3)}" fill="none" stroke="#F4F7F9" stroke-width="${f(r * 0.07)}"/></g>`;
    }
    const ext = [[a0 - 78, yc - 5], [a0 - 78, yc + 5], ...B.flatMap((b) => [[b.L, b.y - b.r1 + b.L * Math.sin(b.splay * DEG)], [b.L, b.y + b.r1 + b.L * Math.sin(b.splay * DEG)]])];
    return place(s, fitTurned(ext, T, [4, 8, 116, 110]));
  });
}

// A surface lofted through rings of points, each little face shaded by the way it faces.
function loft(C, rings, paint, { inside = false } = {}) {
  const faces = [];
  for (let i = 0; i < rings.length - 1; i++) {
    const [A, B] = [rings[i], rings[i + 1]];
    const n = A.length;
    const mid = [0, 1, 2].map((k) => (A.reduce((a, p) => a + p[k], 0) + B.reduce((a, p) => a + p[k], 0)) / (2 * n));
    for (let j = 0; j < n; j++) {
      const q = [A[j], A[(j + 1) % n], B[(j + 1) % n], B[j]];
      const u = q[2].map((v, k) => v - q[0][k]);
      const v = q[3].map((w, k) => w - q[1][k]);
      let nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(...nn) || 1;
      nn = nn.map((w) => w / l);
      const c = [0, 1, 2].map((k) => (q[0][k] + q[1][k] + q[2][k] + q[3][k]) / 4);
      const out = nn[0] * (c[0] - mid[0]) + nn[1] * (c[1] - mid[1]) + nn[2] * (c[2] - mid[2]);
      if ((out < 0) !== inside) nn = nn.map((w) => -w);
      if (C.facing(nn) <= 0) continue;
      faces.push({ q, d: C.depth(c), fill: paint(nn, i) });
    }
  }
  return faces.sort((a, b) => b.d - a.d).map(({ q, fill }) => `<path d="${C.path(q)}" fill="${fill}" stroke="${fill}" stroke-width=".25" stroke-linejoin="round"/>`).join('');
}

function cowbell() {
  // lying on its side: 6½ inches long, its flattened mouth 4½ by 3, black enamel over steel with
  // the mouth's edge left bright (inches)
  const C = cam(-40, 30);
  const L = 6.6;
  const size = (a) => {
    const t = (a / L) ** 1.15;
    return { w: lerp(1.2, 2.25, t), h: lerp(0.78, 1.45, t), r: lerp(0.3, 0.52, a / L) };
  };
  const ring = (a, inset = 0) => {
    const { w, h, r } = size(a);
    const [W, Hh, R] = [w - inset, h - inset, Math.max(0.05, r - inset * 0.5)];
    const out = [];
    for (const [cs, cn, a0] of [[1, 1, 0], [-1, 1, Math.PI / 2], [-1, -1, Math.PI], [1, -1, 1.5 * Math.PI]]) {
      for (let k = 0; k <= 3; k++) {
        const t = a0 + (k / 3) * (Math.PI / 2);
        out.push([a, cs * (W - R) + Math.cos(t) * R, h + cn * (Hh - R) + Math.sin(t) * R]);
      }
    }
    return out;
  };
  const secs = [0, 0.8, 1.7, 2.6, 3.5, 4.4, 5.3, L - 0.42, L];
  const stickA = [0.6, -3.6, 0.22];
  const stickB = [7.4, -2.5, 0.22];
  C.fit([...ring(0), ...ring(L), [0, -1.2, 0], [L, -2.25, 0], [L, 2.25, 0], stickA, stickB], [10, 14, 110, 106]);
  const footprint = [[0, -1.2, 0], [L, -2.25, 0], [L, 2.25, 0], [0, 1.2, 0]].map((p) => C.P([p[0] + 0.3, p[1] + 0.4, 0]));
  let s = `<path d="${poly(footprint)}" fill="#000" opacity=".16"/>` + shadow(...C.P([L * 0.55, 0.3, 0]), 3.9 * C.k, 1.9 * C.k);
  const enamel = (n) => mixHex(mixHex('#050506', '#3C3F46', C.lit(n) * 0.9), '#E4E8EC', C.spec(n, 26) * 0.85);
  const steel = (n) => mixHex(mixHex('#4C5861', '#DDE4E8', C.lit(n)), '#FFFFFF', C.spec(n, 18));
  // inside first, seen through the mouth; then the outside over it; then the bright lip
  s += loft(C, [L, L - 0.8, L - 2, L - 3.6, 1].map((a) => ring(a, 0.07)), (n) => mixHex('#0C0D0E', '#4A525A', C.lit(n) * 0.55), { inside: true });
  s += loft(C, secs.map((a) => ring(a)), (n, i) => (secs[i] >= L - 0.43 ? steel(n) : enamel(n)));
  const lip = ring(L);
  const lipIn = ring(L, 0.07);
  s += `<path d="${C.path(lip)}${C.path(lipIn)}" fill="#E8EDF0" fill-rule="evenodd" stroke="#8A969E" stroke-width="${f(0.02 * C.k)}"/>`;
  // the seam where the sheet was folded and welded, along the side toward you
  s += `<path d="M${xy(C.P([0.15, -size(0.15).w, size(0.15).h]))}L${xy(C.P([L - 0.45, -size(L - 0.45).w, size(L - 0.45).h]))}" stroke="#000" stroke-width="${f(0.05 * C.k)}" opacity=".6"/>`;
  // the stick, lying in front
  const [pa, pb] = [C.P(stickA), C.P(stickB)];
  s += stick(pa[0], pa[1], pb[0], pb[1], 0.4 * C.k);
  return s;
}

function claves() {
  let s = shadow(60, 84, 44, 9, 0.8);
  const clave = (a, b, r) => cone([a, [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5)], b], r, 'rose')
    + `<ellipse cx="${f(b[0])}" cy="${f(b[1])}" rx="${f(r * 0.5)}" ry="${f(r)}" transform="rotate(${f(Math.atan2(b[1] - a[1], b[0] - a[0]) / DEG)} ${f(b[0])} ${f(b[1])})" fill="#5A1E10" stroke="#2A0C05" stroke-width=".4"/>`;
  s += clave([12, 78], [108, 58], 5.4);
  s += clave([30, 22], [86, 98], 5.4);
  return s;
}

function guiro() {
  return turned(-22, () => {
    let s = '';
    // the gourd: long and pear shaped, ridged along its top, a stem at its narrow end
    const top = [[-52, 0], [-46, -7], [-30, -13], [-6, -17], [20, -18.5], [40, -16], [52, -9], [56, 0]];
    const body = smooth([...top, ...top.slice(1, -1).reverse().map(([x, y]) => [x, -y])], true);
    const [hx, hy] = toLight(9);
    s += `<defs><clipPath id="gr"><path d="${body}"/></clipPath>${rad('grl', [10 + hx, hy - 4, 40], [[0, '#F1CF8E'], [0.5, '#C9944E'], [1, '#7A4E1E']], ' gradientUnits="userSpaceOnUse"')}</defs>`;
    s += `<path d="${body}" fill="url(#grl)" stroke="#5A3410" stroke-width=".8"/>`;
    s += `<g clip-path="url(#gr)">` + range(34, (i) => { const x = -34 + i * 2.5; return `<path d="M${x} -22Q${x - 3} 0 ${x} 22" fill="none" stroke="#6A4214" stroke-width=".9" opacity=".7"/><path d="M${x + 0.9} -22Q${x - 2.1} 0 ${x + 0.9} 22" fill="none" stroke="#F6DCA4" stroke-width=".5" opacity=".6"/>`; }).join('');
    s += `<path d="M-46 -12L-43 12M-41 -14L-38 14" stroke="#3A2008" stroke-width=".8"/><path d="${range(8, (i) => `${i ? 'L' : 'M'}${-45 + (i % 2) * 3} ${-12 + i * 3.4}`).join('')}" stroke="#3A2008" stroke-width=".7" fill="none"/>`;
    s += `<path d="M48 -14L50 14" stroke="#3A2008" stroke-width=".8"/></g>`;
    s += `<path d="M-52 0q-4 -1 -8 1" stroke="#6A4214" stroke-width="2.4" stroke-linecap="round"/>`;
    // the scraper
    s += `<path d="M-36 32L44 26" stroke="#8A6030" stroke-width="2.4" stroke-linecap="round"/><path d="M-36 32L44 26" stroke="#E2C48E" stroke-width="1.2" stroke-linecap="round" transform="translate(0 -.4)"/>`;
    return shadow(62, 84, 46, 8) + place(s, { at: [60, 58], turn: -22, scale: 0.98, about: [0, 6] });
  });
}

function shaker() {
  let s = shadow(64, 92, 30, 7);
  s += `<g transform="rotate(-28 60 60)"><ellipse cx="60" cy="60" rx="24" ry="31" fill="url(#egg)" stroke="#8A3A08" stroke-width=".8"/>`;
  s += `<path d="M36 64Q60 72 84 64" fill="none" stroke="#9A4A10" stroke-width="1.1"/><path d="M36 64.8Q60 72.8 84 64.8" fill="none" stroke="#FFC27A" stroke-width=".5" opacity=".7"/>`;
  s += `<ellipse cx="51" cy="46" rx="7" ry="10" fill="#fff" opacity=".45"/><ellipse cx="49" cy="43" rx="2.6" ry="3.8" fill="#fff" opacity=".8"/></g>`;
  s += `<path d="M22 44q-4 8 0 16M16 40q-6 12 0 24M100 54q4 8 0 16M106 50q6 12 0 24" fill="none" stroke="#5A4A3A" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>`;
  return s;
}

function cabasa() {
  return turned(-38, () => {
    let s = '';
    // the maple handle, the steel drum and the chains of beads wound round it
    s += cone(straight(-60, 0, -14, 0, 3), (i, t) => 5 + t * 2.6, 'wood');
    s += cone(straight(-66, 0, -58, 0, 1), 6.4, 'wood');
    s += cone(straight(-14, 0, 38, 0, 3), 18, 'silver', { glint: false });
    const L = lightIn([-0.6, -0.8, 0]);
    for (let row = 0; row < 8; row++) {
      const x = -9 + row * 6.4;
      for (let k = 0; k < 9; k++) {
        const u = -0.92 + (k * 1.84) / 8;
        const y = u * 18.6;
        const sz = 2.4 * Math.sqrt(1 - u * u * 0.7);
        s += `<circle cx="${f(x + (row % 2) * 0.4)}" cy="${f(y)}" r="${f(sz)}" fill="url(#ball2)"/>`;
      }
    }
    s += `<ellipse cx="-14" cy="0" rx="5" ry="19" fill="url(#mapleC)" stroke="#5A3410" stroke-width=".5"/><ellipse cx="38" cy="0" rx="5" ry="19" fill="#C98A44" stroke="#5A3410" stroke-width=".5"/><ellipse cx="39" cy="0" rx="3.2" ry="14" fill="#E2B070"/>`;
    void L;
    return shadow(64, 92, 44, 8) + place(s, { at: [62, 58], turn: -38, scale: 1, about: [-12, 0] });
  });
}

function logDrum() {
  const C = cam(-24, 40);
  const [X, Y, Z] = [20, 8, 7.3];
  C.fit([[0, 0, 0], [X, 0, 0], [X, Y, 0], [0, Y, 0], [0, 0, Z], [X, 0, Z], [X, Y, Z], [0, Y, Z]], [8, 14, 112, 104]);
  let s = shadow(60, 98, 54, 9);
  s += box3(C, [0, 0, 0.4], [X, Y, Z], { top: ['#7A2E10', '#C0522A'], front: ['#2E1A0E', '#5A3A22'], side: ['#24140A', '#4A2E1A'] });
  for (const x of [0.6, X - 1.6]) for (const y of [0.4, Y - 1.4]) s += box3(C, [x, y, 0], [x + 1, y + 1, 0.4], { top: '#1C1B1A', front: '#1C1B1A' });
  // box joints along the near corners
  for (let k = 0; k < 6; k += 2) s += `<path d="${C.path([[0, 0, k * 1.2 + 0.4], [0, 0, k * 1.2 + 1.6], [0.6, 0, k * 1.2 + 1.6], [0.6, 0, k * 1.2 + 0.4]])}" fill="#7A3A1C"/><path d="${C.path([[X - 0.6, 0, k * 1.2 + 0.4], [X - 0.6, 0, k * 1.2 + 1.6], [X, 0, k * 1.2 + 1.6], [X, 0, k * 1.2 + 0.4]])}" fill="#7A3A1C"/>`;
  // the H cut in the top: two tongues, a slot between, drilled ends
  const z = Z + 0.02;
  const cut = (pts) => `<path d="${C.path(pts.map(([x, y]) => [x, y, z]), false)}" fill="none" stroke="#1A0804" stroke-width="${f(0.26 * C.k)}" stroke-linecap="round"/>`;
  s += cut([[3, 1.6], [17, 1.6]]) + cut([[3, Y - 1.6], [17, Y - 1.6]]) + cut([[7.6, 1.6], [7.6, Y - 1.6]]);
  for (const [x, y] of [[3, 1.6], [17, 1.6], [3, Y - 1.6], [17, Y - 1.6]]) { const p = C.P([x, y, z]); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(0.24 * C.k)}" fill="#1A0804"/>`; }
  s += range(10, (i) => `<path d="${C.path([[0.4, 0.8 + i * 0.7, z], [X - 0.4, 0.9 + i * 0.7, z]], false)}" stroke="#E07A48" stroke-width="${f(0.05 * C.k)}" opacity=".35"/>`).join('');
  // the port in the near end
  const pc = C.P([X, Y / 2, Z * 0.45]);
  s += `<ellipse cx="${f(pc[0])}" cy="${f(pc[1])}" rx="${f(0.9 * C.k)}" ry="${f(1.3 * C.k)}" fill="#0E0603"/>`;
  // two mallets with rubber balls
  const m1 = [C.P([4, -1.5, Z + 0.6]), C.P([12, 3.2, Z + 0.6])];
  const m2 = [C.P([6, -2.4, Z + 0.6]), C.P([15, 5, Z + 0.6])];
  for (const [a, b] of [m1, m2]) s += `<path d="M${xy(a)}L${xy(b)}" stroke="#7A5A30" stroke-width="${f(0.4 * C.k)}" stroke-linecap="round"/><path d="M${xy(a)}L${xy(b)}" stroke="#E2C48E" stroke-width="${f(0.18 * C.k)}" stroke-linecap="round"/><circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(0.95 * C.k)}" fill="url(#rubber)"/>`;
  return s;
}

function kalimba() {
  const C = cam(0, 52);
  const W = 7.2;
  const H = 6.6;
  const T = 0.6;
  C.fit([[-W / 2, 0, 0], [W / 2, 0, 0], [W / 2, H, T], [-W / 2, H, T], [-W / 2, H + 0.3, T]], [10, 12, 110, 108]);
  let s = shadow(60, 98, 50, 8);
  const outline = (z, inset = 0) => {
    const top = range(9, (i) => { const u = i / 8; return [-W / 2 + inset + u * (W - 2 * inset), H - inset - 0.0 + Math.sin(u * Math.PI) * 0.34, z]; });
    return [[-W / 2 + inset, 0.5 + inset, z], [-W / 2 + 0.5 + inset, inset, z], [W / 2 - 0.5 - inset, inset, z], [W / 2 - inset, 0.5 + inset, z], ...top.reverse()];
  };
  // the board's edge, then its face
  s += `<path d="${C.path(outline(0))}" fill="#5A2E10"/>`;
  s += `<path d="${C.path(outline(0).map(([x, y]) => [x, y, T * 0.5]))}" fill="#7A4218"/>`;
  s += `<path d="${C.path(outline(T))}" fill="url(#koa)" stroke="#4A220A" stroke-width="${f(0.05 * C.k)}"/>`;
  s += range(9, (i) => `<path d="${C.path([[-W / 2 + 0.3 + i * 0.8, 0.2, T], [-W / 2 + 0.5 + i * 0.8, H, T]], false)}" stroke="#7A3E14" stroke-width="${f(0.05 * C.k)}" opacity=".35"/>`).join('');
  // the sound hole, the bridge, the tines (longest in the middle), the bar across them
  const hc = C.P([0, 1.3, T]);
  s += `<ellipse cx="${f(hc[0])}" cy="${f(hc[1])}" rx="${f(0.62 * C.k)}" ry="${f(0.62 * C.k * C.e)}" fill="#1A0B04" stroke="#F1D9A8" stroke-width="${f(0.08 * C.k)}"/>`;
  const yb = 3.0;
  s += box3(C, [-W / 2 + 0.45, yb - 0.15, T], [W / 2 - 0.45, yb + 0.15, T + 0.18], { top: '#E9CC92', front: '#B8955A' });
  const n = 13;
  const order = range(n, (i) => Math.abs(i - 6));
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.6 + (i + 0.5) * ((W - 1.2) / n);
    const len = 3.2 - order[i] * 0.2;
    s += `<path d="${C.path([[x - 0.12, yb - 0.4, T + 0.2], [x + 0.12, yb - 0.4, T + 0.2], [x + 0.12, yb + len, T + 0.24], [x - 0.12, yb + len, T + 0.24]])}" fill="url(#silverC)" stroke="#4C5861" stroke-width="${f(0.02 * C.k)}"/>`;
  }
  s += box3(C, [-W / 2 + 0.5, yb + 0.05, T + 0.26], [W / 2 - 0.5, yb + 0.3, T + 0.44], { top: '#EEF2F4', front: '#7D8A94' });
  for (const x of [-2.6, 0, 2.6]) { const p = C.P([x, yb + 0.18, T + 0.45]); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(0.09 * C.k)}" fill="#4C5861"/>`; }
  return s;
}

const ART = {
  drums,
  timpani,
  snare,
  bassdrum,
  cymbals,
  triangle,
  tambourine,
  gong,
  'sleigh-bells': sleighBells,
  congas,
  bongos,
  agogo,
  cowbell,
  claves,
  guiro,
  shaker,
  cabasa,
  'log-drum': logDrum,
  kalimba,
  piano,
  organ,
  glockenspiel: () => mallets('glockenspiel'),
  xylophone: () => mallets('xylophone'),
  marimba: () => mallets('marimba'),
  guitar,
  'electric-guitar': electricGuitar,
  'electric-bass': electricBass,
  banjo,
  ukulele,
  harp,
  violin,
  viola,
  cello,
  bass,
  trumpet,
  horn,
  trombone,
  tuba,
  flute,
  clarinet,
  oboe,
  saxophone,
  bassoon,
};

let n = 0;
export function art(id, label = '') {
  if (!ART[id]) return '';
  // Gradient ids are made unique per drawing: a hidden drawing's gradients don't paint.
  const k = `a${++n}`;
  let body = ART[id]();
  const used = new Set([...body.matchAll(/url\(#(\w+)\)/g)].map((m) => m[1]));
  let defs = '';
  for (const [name, def] of Object.entries(LIB)) {
    if ([...used].some((u) => u === name || u === `${name}Y`) && !body.includes(`id="${name}"`)) defs += def;
  }
  body = `<defs>${defs}</defs>${body}`;
  return `<svg viewBox="0 0 120 120" role="img" aria-label="${label}">${body}</svg>`
    .replace(/id="(\w+)"/g, `id="${k}$1"`).replace(/url\(#(\w+)\)/g, `url(#${k}$1)`).replace(/href="#(\w+)"/g, `href="#${k}$1"`);
}
