import { rr } from './surface.js';
/* Materials for the museum's instruments: wood with its grain, polished metal, drum heads,
   felt, and strings that blur as they ring. Patterns are painted once into small offscreen
   canvases and reused. The parts of an instrument that never move are painted once into a
   layer (see layer()) and copied onto each frame, so a ringing string redraws only itself. */

/* A seeded random number generator (mulberry32): the same grain every time. */
export function rand(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RES = 2;                     // tiles are painted at twice their size, for sharp screens
const tiles = new Map();
const patterns = new WeakMap();    // context -> key -> CanvasPattern

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/* A tile w by h (in CSS pixels), painted once by paint(context, w, h). */
function tile(key, w, h, paint) {
  let c = tiles.get(key);
  if (!c) {
    c = canvas(w * RES, h * RES);
    const t = c.getContext('2d');
    t.scale(RES, RES);
    paint(t, w, h);
    tiles.set(key, c);
  }
  return c;
}

export function pattern(g, key, w, h, paint) {
  let m = patterns.get(g);
  if (!m) patterns.set(g, (m = new Map()));
  let p = m.get(key);
  if (!p) {
    p = g.createPattern(tile(key, w, h, paint), 'repeat');
    m.set(key, p);
  }
  return p;
}

/* Where a pattern lies: its origin, its angle in degrees (0: grain runs along u), its size. */
export function place(p, x = 0, y = 0, angle = 0, scale = 1) {
  if (p?.setTransform) p.setTransform(new DOMMatrix().translateSelf(x, y).rotateSelf(angle).scaleSelf(scale / RES));
  return p;
}

/* ---------- colour ---------- */

export function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
/* A colour made lighter (amt > 0) or darker (amt < 0), by amt of the way to white or black. */
export function tint(c, amt, alpha = 1) {
  const [r, g, b] = hex(c);
  const f = (v) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  return alpha < 1 ? `rgba(${f(r)},${f(g)},${f(b)},${alpha})` : `rgb(${f(r)},${f(g)},${f(b)})`;
}
export function mix(a, b, t) {
  const x = hex(a), y = hex(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/* ---------- wood ---------- */

const WOODS = {
  spruce: { base: '#E4C690', dark: '#B48A4E', light: '#F4E0B4', lines: 90, wave: 0.35, bands: 10 },
  // spruce under amber varnish, as on a violin's or a cello's top
  varnish: { base: '#B6591E', dark: '#6E2A0C', light: '#E39041', lines: 80, wave: 0.35, bands: 14 },
  // a darker, older varnish (cellos), a redder one (violas) and a brown one (basses)
  oldvarnish: { base: '#8E3A14', dark: '#4E1806', light: '#C2642A', lines: 80, wave: 0.35, bands: 14 },
  redvarnish: { base: '#A2401A', dark: '#5E1A08', light: '#D2703A', lines: 80, wave: 0.35, bands: 14 },
  darkvarnish: { base: '#5A2E16', dark: '#2A1208', light: '#86522E', lines: 80, wave: 0.35, bands: 14 },
  maple: { base: '#D2A26A', dark: '#9C6A34', light: '#EED2A2', lines: 50, wave: 0.8, figure: 0.55, bands: 8 },
  flame: { base: '#C27A34', dark: '#7E4416', light: '#F2C27E', lines: 40, wave: 0.8, figure: 1, bands: 8 },
  rosewood: { base: '#5C2C18', dark: '#2A1008', light: '#86472A', lines: 110, wave: 1.4, pores: 0.8, bands: 16 },
  ebony: { base: '#221C18', dark: '#0D0A08', light: '#3A332E', lines: 40, wave: 0.6, bands: 6 },
  mahogany: { base: '#86401F', dark: '#4E200C', light: '#B0603A', lines: 70, wave: 0.9, pores: 1, bands: 12, ribbon: 0.5 },
  walnut: { base: '#6A4328', dark: '#382012', light: '#946645', lines: 90, wave: 1.6, pores: 0.6, bands: 14 },
  oak: { base: '#B98A52', dark: '#7E5730', light: '#DCB47C', lines: 70, wave: 1.2, pores: 1.2, rays: 1, bands: 12 },
  // the bars of a xylophone (padauk) and of a marimba (Honduras rosewood)
  padauk: { base: '#B9572C', dark: '#7A2C12', light: '#E07C48', lines: 80, wave: 0.7, pores: 0.5, bands: 12 },
  honduras: { base: '#7C3A1E', dark: '#3E160A', light: '#A9593A', lines: 100, wave: 1.1, pores: 0.6, bands: 14 },
  cherry: { base: '#A4552E', dark: '#6A2C12', light: '#CC7A4C', lines: 70, wave: 1, bands: 12 },
  ash: { base: '#D9BE8E', dark: '#A68452', light: '#F0DDB6', lines: 70, wave: 1.8, pores: 0.8, bands: 10 },
  birch: { base: '#E2C79A', dark: '#B9996A', light: '#F4E3C2', lines: 40, wave: 0.6, bands: 6 },
  bamboo: { base: '#D8B46A', dark: '#A4813E', light: '#F0D594', lines: 60, wave: 0.15, bands: 6 },
  teak: { base: '#9A6232', dark: '#5E3414', light: '#C48A52', lines: 90, wave: 1.3, pores: 0.7, bands: 14 },
  // Hawaiian koa, curly, as on a ukulele
  koa: { base: '#A8642C', dark: '#5E2E10', light: '#D9954E', lines: 70, wave: 1.4, figure: 0.7, bands: 14 },
  // grenadilla (African blackwood), as on clarinets and oboes: nearly black, a brown streak here and there
  grenadilla: { base: '#2A2220', dark: '#0E0A09', light: '#54423A', lines: 120, wave: 0.5, pores: 0.35, bands: 12 },
  // flamed maple stained red-brown, as on a bassoon
  bassoon: { base: '#97401E', dark: '#561C08', light: '#CF7444', lines: 50, wave: 0.8, figure: 0.85, bands: 10 },
};

function paintWood(c, w, h, t, seed) {
  const r = rand(seed);
  c.fillStyle = t.base;
  c.fillRect(0, 0, w, h);
  const across = (y0, draw) => { for (const dy of [-h, 0, h]) draw(y0 + dy); };
  // broad bands of lighter and darker wood, the growth of whole seasons
  for (let i = 0; i < (t.bands || 10); i++) {
    const y = r() * h;
    const bh = 3 + r() * 26;
    c.fillStyle = r() < 0.5 ? t.dark : t.light;
    c.globalAlpha = 0.05 + r() * 0.11;
    across(y, (yy) => c.fillRect(0, yy - bh / 2, w, bh));
  }
  // a ribbon figure (mahogany): long soft stripes of sheen
  if (t.ribbon) {
    for (let i = 0; i < 6; i++) {
      const y = r() * h;
      const bh = 6 + r() * 14;
      const gr = c.createLinearGradient(0, y - bh, 0, y + bh);
      gr.addColorStop(0, 'rgba(255,220,180,0)');
      gr.addColorStop(0.5, `rgba(255,220,180,${0.08 * t.ribbon})`);
      gr.addColorStop(1, 'rgba(255,220,180,0)');
      c.fillStyle = gr;
      c.globalAlpha = 1;
      c.fillRect(0, y - bh, w, bh * 2);
    }
  }
  // the grain: thin wavy lines, a whole number of waves across the tile, so it repeats
  c.lineCap = 'round';
  for (let i = 0; i < t.lines; i++) {
    const y0 = r() * h;
    const k1 = 1 + Math.floor(r() * 2);
    const k2 = 2 + Math.floor(r() * 4);
    const a1 = (1 + r() * 4) * t.wave;
    const a2 = r() * 1.6 * t.wave;
    const p1 = r() * 6.283;
    const p2 = r() * 6.283;
    const darkLine = r() < 0.78;
    c.strokeStyle = darkLine ? t.dark : t.light;
    c.globalAlpha = darkLine ? 0.1 + r() * 0.32 : 0.08 + r() * 0.2;
    c.lineWidth = 0.35 + r() * r() * 2.4;
    across(y0, (yy) => {
      c.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const y = yy + a1 * Math.sin((x / w) * k1 * 6.283 + p1) + a2 * Math.sin((x / w) * k2 * 6.283 + p2);
        if (x) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.stroke();
    });
  }
  // pores: short dark dashes along the grain
  if (t.pores) {
    c.fillStyle = t.dark;
    const n = Math.round(w * h / 90 * t.pores);
    for (let i = 0; i < n; i++) {
      const x = r() * w;
      const y = r() * h;
      c.globalAlpha = 0.12 + r() * 0.3;
      c.fillRect(x, y, 1.5 + r() * 5, 0.5 + r() * 0.7);
    }
  }
  // medullary rays (oak): small pale flecks across the grain
  if (t.rays) {
    c.fillStyle = t.light;
    for (let i = 0; i < 60; i++) {
      c.globalAlpha = 0.1 + r() * 0.18;
      c.fillRect(r() * w, r() * h, 6 + r() * 16, 1 + r() * 2);
    }
  }
  // figure: the shimmering stripes across the grain of flamed maple, light and dark in turn,
  // each one wavering a little as it crosses the grain (painted in thin slices, so its light
  // stays in the middle of it as it wanders)
  if (t.figure) {
    const stripes = 24;
    for (let i = 0; i < stripes; i++) {
      const x0 = (i / stripes) * w + r() * 5;
      const sw = 5 + r() * 6;
      const lean = 1.5 + r() * 2.5;
      const ph = r() * 6.283;
      const col = i % 2 ? t.light : t.dark;
      c.globalAlpha = (0.2 + r() * 0.24) * t.figure;
      for (const dx of [-w, 0, w]) {
        for (let y = 0; y < h; y += 3) {
          const x = x0 + dx + lean * Math.sin((y / h) * 6.283 + ph);
          const gr = c.createLinearGradient(x - sw, 0, x + sw, 0);
          gr.addColorStop(0, 'rgba(0,0,0,0)');
          gr.addColorStop(0.5, col);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = gr;
          c.fillRect(x - sw, y, sw * 2, 3.2);
        }
      }
    }
  }
  c.globalAlpha = 1;
}

/* A wood pattern. Its grain runs along u unless angle (degrees) turns it; seed picks which
   piece of the tile shows, so two bars cut from the same wood don't look the same. */
export function wood(g, kind = 'spruce', { x = 0, y = 0, angle = 0, scale = 1, seed = 0 } = {}) {
  const t = WOODS[kind] || WOODS.spruce;
  const p = pattern(g, `wood:${kind}`, 360, 180, (c, w, h) => paintWood(c, w, h, t, kind.length * 977 + 13));
  const r = rand(seed * 31 + 7);
  return place(p, x - r() * 360, y - r() * 180, angle, scale);
}
export const woodColor = (kind, part = 'base') => (WOODS[kind] || WOODS.spruce)[part];

/* ---------- grain of other kinds ---------- */

/* Fine noise, for felt, coated drum heads and the matte of painted things. */
export function noise(g, { alpha = 0.12, scale = 1, dark = true, x = 0, y = 0 } = {}) {
  const key = `noise:${dark ? 'd' : 'l'}`;
  const p = pattern(g, key, 128, 128, (c, w, h) => {
    const id = c.getImageData(0, 0, w * RES, h * RES);
    const r = rand(dark ? 99 : 98);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = dark ? 0 : 255;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = Math.floor(r() * r() * 255);
    }
    c.putImageData(id, 0, 0);
  });
  g.save();
  g.globalAlpha *= alpha;
  place(p, x, y, 0, scale);
  return { p, done: () => g.restore() };
}

/* Fill the current path with noise on top of whatever is there. */
export function grain(g, alpha = 0.12, { dark = true, scale = 1 } = {}) {
  const n = noise(g, { alpha, dark, scale });
  g.fillStyle = n.p;
  g.fill();
  n.done();
}

/* Brushed metal: fine streaks along u (fill with it at a low globalAlpha). */
export function brushed(g, { x = 0, y = 0, angle = 0 } = {}) {
  const p = pattern(g, 'brushed', 256, 128, (c, w, h) => {
    const r = rand(5);
    for (let i = 0; i < 260; i++) {
      const yy = r() * h;
      c.strokeStyle = r() < 0.5 ? '#000' : '#fff';
      c.globalAlpha = 0.05 + r() * 0.18;
      c.lineWidth = 0.3 + r() * 0.6;
      c.beginPath();
      c.moveTo(0, yy);
      c.lineTo(w, yy + (r() - 0.5) * 0.6);
      c.stroke();
    }
  });
  return place(p, x, y, angle, 1);
}

/* ---------- metal ---------- */

const METALS = {
  brass: [[0, '#5A3C0E'], [0.14, '#A87A26'], [0.32, '#EBC66C'], [0.42, '#FFF2C4'], [0.52, '#E6BC58'], [0.74, '#9A6F22'], [0.9, '#6E4D14'], [1, '#B48A3A']],
  gold: [[0, '#6A4A12'], [0.16, '#B88A2E'], [0.34, '#F0D184'], [0.44, '#FFF6D4'], [0.56, '#D9AA48'], [0.78, '#8E6620'], [1, '#C29A48']],
  silver: [[0, '#4C565E'], [0.15, '#97A3AD'], [0.33, '#E4EAEE'], [0.43, '#FFFFFF'], [0.55, '#BFC8D0'], [0.78, '#76828C'], [0.92, '#59646E'], [1, '#A9B3BB']],
  nickel: [[0, '#55585A'], [0.18, '#A4A7A6'], [0.38, '#E8E9E4'], [0.46, '#FAFAF6'], [0.6, '#B9BCB8'], [0.82, '#7D8180'], [1, '#A8ABA8']],
  chrome: [[0, '#2A3036'], [0.12, '#6E7880'], [0.3, '#F4F7F9'], [0.38, '#FFFFFF'], [0.47, '#4B535B'], [0.62, '#A7B0B8'], [0.8, '#E8EDF0'], [0.92, '#59626A'], [1, '#8E979F']],
  steel: [[0, '#5A6168'], [0.2, '#A4ADB4'], [0.42, '#EEF2F4'], [0.56, '#B8C0C6'], [0.8, '#7C858C'], [1, '#9AA2A8']],
  copper: [[0, '#4A1E0A'], [0.16, '#94461E'], [0.36, '#E0905A'], [0.45, '#FFD0A8'], [0.56, '#C86E3A'], [0.8, '#7A3414'], [1, '#A85A30']],
  bronze: [[0, '#5E3E0E'], [0.16, '#A26E22'], [0.36, '#E2AE52'], [0.46, '#FBE2A0'], [0.58, '#C8923A'], [0.8, '#8A5C18'], [1, '#B4833A']],
  iron: [[0, '#1C1D1F'], [0.2, '#3C3F43'], [0.42, '#6E7378'], [0.55, '#45494E'], [1, '#202224']],
  black: [[0, '#0B0B0C'], [0.18, '#2A2C2F'], [0.36, '#5A5E63'], [0.44, '#2E3033'], [0.8, '#151617'], [1, '#2A2B2D']],
};

/* A gradient of polished metal from (x0, y0) to (x1, y1): across a tube, it makes it round. */
export function metal(g, kind, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of METALS[kind] || METALS.steel) gr.addColorStop(o, c);
  return gr;
}
export const metalColor = (kind) => (METALS[kind] || METALS.steel)[3][1];

/* The sheen of a round, flat metal thing (a cymbal, a gong, a bell's mouth): light caught in
   wedges, as a lathe-turned surface does. */
export function sheen(g, kind, cx, cy, r, turn = -0.6) {
  const base = METALS[kind] || METALS.bronze;
  const lo = base[1][1];
  const mid = base[2][1];
  const hi = base[4][1];
  const top = base[3][1];
  if (g.createConicGradient) {
    const gr = g.createConicGradient(turn, cx, cy);
    const stops = [[0, mid], [0.08, top], [0.16, hi], [0.27, lo], [0.38, mid], [0.5, mid], [0.58, top], [0.66, hi], [0.77, lo], [0.88, mid], [1, mid]];
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  }
  const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
  gr.addColorStop(0, top);
  gr.addColorStop(0.5, mid);
  gr.addColorStop(1, lo);
  return gr;
}

/* Fine rings turned on a lathe, as on a cymbal: drawn over the sheen. */
export function lathe(g, cx, cy, r0, r1, { step = 2.2, alpha = 0.16 } = {}) {
  g.save();
  g.lineWidth = step * 0.45;
  let i = 0;
  for (let r = r0; r < r1; r += step, i++) {
    g.strokeStyle = i % 2 ? `rgba(255,248,220,${alpha})` : `rgba(40,24,0,${alpha})`;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

/* ---------- small hardware ---------- */

/* A round screw head, slotted. */
export function screw(g, x, y, r, { kind = 'nickel', angle = 0.6 } = {}) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = metal(g, kind, x - r, y - r, x + r, y + r);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = Math.max(0.6, r * 0.18);
  g.stroke();
  g.beginPath();
  g.moveTo(x - Math.cos(angle) * r * 0.7, y - Math.sin(angle) * r * 0.7);
  g.lineTo(x + Math.cos(angle) * r * 0.7, y + Math.sin(angle) * r * 0.7);
  g.strokeStyle = 'rgba(0,0,0,.55)';
  g.lineWidth = Math.max(0.8, r * 0.28);
  g.stroke();
}

/* A shiny round knob or pin seen from above. */
export function pin(g, x, y, r, kind = 'steel') {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  const st = METALS[kind] || METALS.steel;
  gr.addColorStop(0, '#fff');
  gr.addColorStop(0.35, st[3][1]);
  gr.addColorStop(1, st[1][1]);
  g.fillStyle = gr;
  g.fill();
}

/* ---------- drum heads ---------- */

/* A drum head of radius r at (cx, cy). kind: coated (white, a little rough), clear (you see
   into the drum), calf (natural skin, as on timpani, congas and bongos), black. */
export function head(g, cx, cy, r, { kind = 'coated', light = 1 } = {}) {
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  if (kind === 'clear') {
    const gr = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    gr.addColorStop(0, '#5A524A');
    gr.addColorStop(0.8, '#3A342E');
    gr.addColorStop(1, '#221E1A');
    g.fillStyle = gr;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    // the shine of the plastic
    const sh = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    sh.addColorStop(0, 'rgba(255,255,255,.28)');
    sh.addColorStop(0.35, 'rgba(255,255,255,.04)');
    sh.addColorStop(0.65, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(255,255,255,.12)');
    g.fillStyle = sh;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else if (kind === 'calf') {
    const gr = g.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.05, cx, cy, r);
    gr.addColorStop(0, '#F3E2BE');
    gr.addColorStop(0.6, '#E2C792');
    gr.addColorStop(0.92, '#C9A56C');
    gr.addColorStop(1, '#9C7646');
    g.fillStyle = gr;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    // the skin's fibres and mottling
    const rr = rand(Math.round(r * 13));
    for (let i = 0; i < 26; i++) {
      const a = rr() * 6.283;
      const d = Math.sqrt(rr()) * r;
      const s = r * (0.06 + rr() * 0.2);
      const spot = g.createRadialGradient(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0, cx + Math.cos(a) * d, cy + Math.sin(a) * d, s);
      spot.addColorStop(0, `rgba(150,105,55,${0.08 + rr() * 0.12})`);
      spot.addColorStop(1, 'rgba(150,105,55,0)');
      g.fillStyle = spot;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    g.strokeStyle = 'rgba(140,100,55,.12)';
    g.lineWidth = 0.8;
    for (let i = 0; i < 40; i++) {
      const a = rr() * 6.283;
      const d = rr() * r;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const b = rr() * 6.283;
      const l = r * (0.08 + rr() * 0.22);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(b) * l * 0.5 + l * 0.15, y + Math.sin(b) * l * 0.5, x + Math.cos(b) * l, y + Math.sin(b) * l);
      g.stroke();
    }
    grain(g, 0.1);
  } else if (kind === 'black') {
    const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
    gr.addColorStop(0, '#3A3A3C');
    gr.addColorStop(1, '#111113');
    g.fillStyle = gr;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else {
    const gr = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r);
    gr.addColorStop(0, '#FFFDF8');
    gr.addColorStop(0.55, '#F2EDE2');
    gr.addColorStop(0.9, '#DCD5C6');
    gr.addColorStop(1, '#BDB4A3');
    g.fillStyle = gr;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    grain(g, 0.09, { scale: 0.6 });
  }
  // where the head bends over the shell's edge: the collar
  const col = g.createRadialGradient(cx, cy, r * 0.84, cx, cy, r);
  col.addColorStop(0, 'rgba(0,0,0,0)');
  col.addColorStop(0.7, 'rgba(0,0,0,.08)');
  col.addColorStop(1, 'rgba(0,0,0,.32)');
  g.fillStyle = col;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (light !== 1) {
    g.fillStyle = light > 1 ? `rgba(255,236,190,${Math.min(0.5, (light - 1))})` : `rgba(0,0,0,${Math.min(0.5, 1 - light)})`;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  g.restore();
}

/* ---------- strings ---------- */

/* A string from (x0, y0) to (x1, y1). While it rings (amp > 0, in pixels) it blurs into the
   spindle shape a vibrating string makes to the eye, widest in the middle of what rings, with
   the string itself caught somewhere inside it (t: time, for that). wound: a string wrapped
   in wire, as bass strings are. from/to: the part that rings, as fractions of the length. */
export function string(g, x0, y0, x1, y1, { width = 1.5, color = '#D8DDE2', wound = false, amp = 0, t = 0, from = 0, to = 1, freq = 1, glow = 0 } = {}) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const at = (f, off) => [x0 + dx * f + nx * off, y0 + dy * f + ny * off];
  const ringing = amp > 0.15;
  if (ringing) {
    // the blur: a spindle between from and to
    const steps = 18;
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const f = from + (to - from) * (i / steps);
      const [x, y] = at(f, amp * Math.sin(Math.PI * (i / steps)));
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const f = from + (to - from) * (i / steps);
      const [x, y] = at(f, -amp * Math.sin(Math.PI * (i / steps)));
      g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = glow ? `rgba(255,226,160,${0.3 + 0.3 * glow})` : 'rgba(255,255,255,.2)';
    g.fill();
  }
  // the string: the still ends, and the ringing part where it is caught at this moment
  const phase = Math.cos(t * 0.06 * freq);
  const path = () => {
    g.beginPath();
    g.moveTo(x0, y0);
    if (ringing) {
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const f = from + (to - from) * (i / steps);
        const [x, y] = at(f, amp * phase * Math.sin(Math.PI * (i / steps)));
        g.lineTo(x, y);
      }
    }
    g.lineTo(x1, y1);
  };
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // a dark edge, so a pale string shows on pale wood
  path();
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = width + 1;
  g.stroke();
  path();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
  if (wound && width >= 1.6) {
    path();
    g.setLineDash([0.9, Math.max(0.9, width * 0.45)]);
    g.strokeStyle = 'rgba(0,0,0,.4)';
    g.lineWidth = width * 0.9;
    g.stroke();
    g.setLineDash([]);
  }
  // the shine along it
  g.translate(nx * -width * 0.22, ny * -width * 0.22);
  path();
  g.strokeStyle = 'rgba(255,255,255,.55)';
  g.lineWidth = Math.max(0.5, width * 0.3);
  g.stroke();
  g.restore();
}

/* ---------- light and shadow ---------- */

/* Draw with a soft shadow under it. */
export function shadowed(g, { blur = 8, x = 0, y = 3, color = 'rgba(0,0,0,.45)' } = {}, draw) {
  g.save();
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.shadowOffsetX = x;
  g.shadowOffsetY = y;
  draw();
  g.restore();
}

/* A soft round pool of light or shade, for glows and cast shadows. */
export function pool(g, x, y, r, color, alpha = 1, sy = 1) {
  g.save();
  g.translate(x, y);
  g.scale(1, sy);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
  const [R, G, B] = hex(color);
  gr.addColorStop(0, `rgba(${R},${G},${B},${alpha})`);
  gr.addColorStop(1, `rgba(${R},${G},${B},0)`);
  g.fillStyle = gr;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
}

/* Gloss: a band of reflected light across a shape, for lacquer and polish (clip to it first). */
export function gloss(g, x, y, w, h, { alpha = 0.22, at = 0.3, across = false } = {}) {
  const gr = across ? g.createLinearGradient(x, y, x + w, y) : g.createLinearGradient(x, y, x, y + h);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(Math.max(0, at - 0.12), 'rgba(255,255,255,0)');
  gr.addColorStop(at, `rgba(255,255,255,${alpha})`);
  gr.addColorStop(Math.min(1, at + 0.2), 'rgba(255,255,255,0)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
}

/* ---------- tubes and keywork (wind and brass instruments) ---------- */

export const TAU = Math.PI * 2;
// Small parts in each metal (rods, posts, key cups): shadow, body, light.
export const TONE = {
  silver: ['#56626A', '#B9C3CA', '#F7FAFB'],
  nickel: ['#5A5E5C', '#B6B9B5', '#F4F4F0'],
  brass: ['#6A460E', '#D2A448', '#FFF0C0'],
};
// A round tube: light along its upper part, shade toward both edges.
export const ROUND = [[0, 'rgba(0,0,0,.62)'], [0.1, 'rgba(0,0,0,.2)'], [0.2, 'rgba(255,255,255,.05)'], [0.28, 'rgba(255,255,255,.26)'],
  [0.35, 'rgba(255,255,255,.05)'], [0.6, 'rgba(0,0,0,.04)'], [0.86, 'rgba(0,0,0,.3)'], [1, 'rgba(0,0,0,.66)']];
export const gradient = (g, list) => (y0, y1) => {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of list) gr.addColorStop(o, c);
  return gr;
};

/* A tube along u from x0 to x1, its edges at top(x) and bot(x). */
export function tubePath(g, x0, x1, top, bot) {
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
export function across(g, x0, x1, top, bot, fill) {
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
export function sides(pts) {
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
export function outline(g, { L, R }) {
  g.beginPath();
  L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath();
}
/* Polished metal along a curving tube: each short piece lit across its width, reaching a
   little into the next so no seam shows. */
export function metalAlong(g, kind, { L, R }) {
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
export function band(g, kind, x, w, y0, y1) {
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
export function bar(g, x0, y0, x1, y1, w, kind) {
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
export function post(g, x, y, s, kind) {
  g.beginPath();
  g.ellipse(x + 0.8, y + 1.6, s * 1.3, s * 1.05, 0, 0, TAU);
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.fill();
  pin(g, x, y, s, kind === 'brass' ? 'brass' : 'silver');
}

/* A closed pad cup seen from above: domed metal. */
export function cup(g, x, y, r, kind) {
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


/* ---------- layers ---------- */

/* The parts of an instrument that don't move, painted once by paint(g) into an offscreen
   canvas the size of the surface, in the instrument's own (u, v) space, and painted again
   only when the surface changes size or key changes. Draw it with g.drawImage(c, 0, 0, s.W,
   s.H). Words don't go in a layer: label() turns them upright for the screen, not for it. */
export function layer(s, name, key, paint) {
  if (!s.layers) s.layers = new Map();
  const full = `${s.W}x${s.H}@${s.dpr}|${key}`;
  let L = s.layers.get(name);
  if (!L || L.key !== full) {
    const c = L?.c || canvas(1, 1);
    c.width = Math.max(1, Math.round(s.W * s.dpr));
    c.height = Math.max(1, Math.round(s.H * s.dpr));
    const g = c.getContext('2d');
    g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    g.clearRect(0, 0, s.W, s.H);
    paint(g);
    L = { key: full, c };
    s.layers.set(name, L);
  }
  return L.c;
}
/* Copy a layer onto the frame. */
export function put(g, s, c) {
  g.drawImage(c, 0, 0, s.W, s.H);
}
