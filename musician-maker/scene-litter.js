/* Litterbox. Rhythm only. The camera points straight down into Mookie's litter box, like a
   satellite over a desert. The sand is a real heightfield (a canvas): it piles, slumps to its
   angle of rest and keeps every mark, and the marks carry over (fading) into the next game, so
   the box fills up with what was played.
   The call: The Stink, a wobbly green gas with an unsettlingly human face, sings it from the
   corner of the box, and every note burps a stinklet out of the sand. They sit in a row, in
   time: a note's place across the box is when it sounded, so a du-de is two little stinklets
   close together and a du one big one on its own. The row is the notation.
   The response: Mookie's paw, on a very long arm from the bottom of the screen. Each tap is a
   scratch that buries the next stinklet. On time: a neat mound. A bit early or late: a lopsided
   one, and it peeks out. Way off: the sand flies at the screen and sticks to the glass, and
   the stinklet stays out. A scratch outside the turn, or with nothing left to bury, buries
   nothing. Nothing is ever buried without a tap.
   Each game is a different world (WORLDS): a zen garden, the Sahara, a slice of cake, the
   deep sea floor, a glitter disco.
   Win (random, never twice running): Mookie's giant face rises over the rim like a moon; the
   mound turns into a sphinx with his face; the Stink is sealed in a jar; the sand rakes
   itself into a smiley; the zoomies.
   Fail: the room gets stinky. Green fog, then: a zoom out to the house, the town and the whole
   planet; the houseplant faints; the screen peels off like a sticker; a fly in a tuxedo
   conducts the stinklets; Mookie strolls off and leaves it.
   Combo: the box levitates, stinklets wear shades, the sand goes disco, Bindi and Rusty peer
   in from the edges like gods.
   Boss: The Big Stink, the Stink grown huge, with four gassy arms. Each hit buries an arm; at
   the end Mookie sits on it.
   Fixed markup only: nothing a learner types goes in here (call syllables are du/de). */

import { rigMookie } from './rig.js';
import { rigCat } from './cats.js';
import { toon } from './sound.js';
import { gagDeck } from './gags.js';
import { callBubble } from './speech.js';

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

function bump(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

const later = (ms, fn) => setTimeout(fn, ms);
const rnd = (a, b) => a + Math.random() * (b - a);
const INK = '#17171b';

/* ---------------- the sand ---------------- */

const SW = 200; // heightfield cells across
const SH = 120; // and down
const STAIN = [112, 176, 44];
const SPRINKLES = [[255, 92, 120], [92, 196, 255], [255, 214, 74], [146, 226, 120], [196, 128, 255]];
let carry = null; // the last box's marks (height above its own ground), for the next box

/* Smooth value noise, 0..1. */
function hash(x, y, seed) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(x - xi);
  const v = s(y - yi);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/* The worlds: the ground's colours and shape (x, y in cells), the floor round the box, and a
   few things in it. */
const WORLDS = [
  {
    id: 'zen', plate: 'ZEN GARDEN · DO NOT RAKE', lo: [126, 120, 106], hi: [250, 246, 234],
    ground(x, y) {
      // Raked lines, and rings round the rock (top right).
      const d = Math.hypot(x - 164, (y - 36) * 1.3);
      if (d < 13) return 0;
      if (d < 34) return 0.32 * Math.sin(d * 1.25);
      return 0.32 * Math.sin(y * 1.25);
    },
  },
  {
    id: 'sahara', plate: 'SAHARA (SCALE 1:1)', lo: [170, 92, 40], hi: [255, 214, 150],
    ground(x, y, seed) {
      const dune = 2.4 * Math.sin((x * 0.55 + y) * 0.09 + 2.4 * vnoise(x / 40, y / 40, seed));
      return dune + 0.22 * Math.sin(x * 0.9 + y * 0.35 + 3 * vnoise(x / 12, y / 12, seed + 1));
    },
  },
  {
    id: 'cake', plate: 'A SLICE OF CAKE (NOT FOR CATS)', lo: [212, 124, 160], hi: [255, 238, 246], speck: true,
    ground(x, y, seed) {
      const d = Math.hypot(x - 100, (y - 60) * 1.4);
      return 0.4 * Math.sin(d * 0.55 + Math.atan2(y - 60, x - 100) * 2) + 0.8 * vnoise(x / 16, y / 16, seed);
    },
  },
  {
    id: 'sea', plate: 'DEEP SEA FLOOR · 4000 M', lo: [24, 58, 80], hi: [146, 196, 186],
    ground(x, y, seed) {
      const w = x + 7 * vnoise(x / 22, y / 22, seed);
      return 0.36 * Math.sin(w * 0.75) + 1.2 * vnoise(x / 30, y / 30, seed + 5);
    },
  },
  {
    id: 'disco', plate: 'GLITTER (ALL OF IT)', lo: [70, 28, 118], hi: [238, 184, 255],
    ground(x, y, seed) {
      return 1.6 * vnoise(x / 18, y / 18, seed) + 0.18 * Math.sin(x * 1.5) * Math.sin(y * 1.5);
    },
  },
];
let worldAt = Math.floor(Math.random() * WORLDS.length);
const nextWorld = () => WORLDS[worldAt++ % WORLDS.length];

/* A box of sand: a canvas SW x SH, stretched over the box. Places are fractions of the box
   (0..1 across, 0..1 down); sizes are in cells. */
function makeSand(world) {
  const cv = h('canvas', 'lb-sand');
  cv.width = SW;
  cv.height = SH;
  const g = cv.getContext('2d');
  const img = g.createImageData(SW, SH);
  const px = img.data;
  const N = SW * SH;
  const hgt = new Float32Array(N);
  const base = new Float32Array(N);
  const stain = new Float32Array(N);
  const grain = new Float32Array(N);
  const speck = new Uint8Array(N);
  const seed = Math.floor(Math.random() * 1e6);
  for (let y = 0, i = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++, i++) {
      base[i] = world.ground(x, y, seed);
      grain[i] = hash(x, y, seed + 9) * 2 - 1;
      if (world.speck && hash(x, y, seed + 3) < 0.014) speck[i] = 1 + Math.floor(hash(y, x, seed + 4) * SPRINKLES.length);
      hgt[i] = base[i] + (carry ? carry[i] * 0.55 : 0);
    }
  }

  function render() {
    const [lr, lg, lb] = world.lo;
    const [hr, hg, hb] = world.hi;
    for (let y = 0, i = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++, i++) {
        const l = hgt[x ? i - 1 : i];
        const r = hgt[x < SW - 1 ? i + 1 : i];
        const u = hgt[y ? i - SW : i];
        const d = hgt[y < SH - 1 ? i + SW : i];
        let s = 0.56 + (l - r + u - d) * 0.4 + (hgt[i] - base[i]) * 0.06;
        // A soft shadow from whatever stands up and to the left.
        if (x > 2 && y > 2) {
          const up = hgt[i - SW * 3 - 3] - hgt[i] - 0.9;
          if (up > 0) s -= up * 0.07;
        }
        s = s < 0 ? 0 : s > 1 ? 1 : s;
        const gr = 1 + grain[i] * 0.07;
        let R = (lr + (hr - lr) * s) * gr;
        let G = (lg + (hg - lg) * s) * gr;
        let B = (lb + (hb - lb) * s) * gr;
        const st = stain[i];
        if (st > 0.02) {
          const k = st > 0.85 ? 0.85 : st;
          const sh = 0.55 + s * 0.6;
          R = R * (1 - k) + STAIN[0] * sh * k;
          G = G * (1 - k) + STAIN[1] * sh * k;
          B = B * (1 - k) + STAIN[2] * sh * k;
        }
        if (speck[i]) {
          const c = SPRINKLES[speck[i] - 1];
          const sh = 0.7 + s * 0.5;
          R = c[0] * sh; G = c[1] * sh; B = c[2] * sh;
        }
        const o = i * 4;
        px[o] = R; px[o + 1] = G; px[o + 2] = B; px[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }

  /* Sand slumps until no slope is steeper than it can hold. */
  const TALUS = 0.55;
  function relax() {
    for (let y = 0, i = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++, i++) {
        if (x < SW - 1) {
          const dd = hgt[i] - hgt[i + 1];
          if (dd > TALUS || dd < -TALUS) {
            const m = (dd - Math.sign(dd) * TALUS) * 0.25;
            hgt[i] -= m; hgt[i + 1] += m;
          }
        }
        if (y < SH - 1) {
          const dd = hgt[i] - hgt[i + SW];
          if (dd > TALUS || dd < -TALUS) {
            const m = (dd - Math.sign(dd) * TALUS) * 0.25;
            hgt[i] -= m; hgt[i + SW] += m;
          }
        }
      }
    }
  }

  let settle = 0;
  let dirty = false;
  let raf = 0;
  function tick() {
    raf = 0;
    if (!cv.isConnected) return;
    if (settle > 0) { relax(); relax(); settle--; dirty = true; }
    if (dirty) { render(); dirty = false; }
    if (settle > 0) raf = requestAnimationFrame(tick);
  }
  function wake(n = 24) {
    settle = Math.max(settle, n);
    dirty = true;
    if (!raf) raf = requestAnimationFrame(tick);
  }
  /* Every cell near a point, with its weight (a soft round brush of radius r cells). */
  function brush(fx, fy, r, fn) {
    const cx = fx * SW;
    const cy = fy * SH;
    const R = Math.ceil(r * 2.6);
    const x0 = Math.max(0, Math.floor(cx - R));
    const x1 = Math.min(SW - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R));
    const y1 = Math.min(SH - 1, Math.ceil(cy + R));
    const k = 1 / (2 * r * r);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const w = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) * k);
        if (w > 0.01) fn(y * SW + x, w);
      }
    }
  }
  const api = {
    el: cv,
    world,
    /* A heap of sand; it covers up any stink under it. */
    pile(fx, fy, r, amt) {
      brush(fx, fy, r, (i, w) => {
        hgt[i] += amt * w;
        stain[i] *= Math.max(0, 1 - amt * w * 1.6);
      });
      wake();
    },
    dig(fx, fy, r, amt) { brush(fx, fy, r, (i, w) => { hgt[i] -= amt * w; }); wake(); },
    stain(fx, fy, r, amt = 1) { brush(fx, fy, r, (i, w) => { stain[i] = Math.min(1, stain[i] + amt * w); }); wake(4); },
    cleanAll() { stain.fill(0); wake(4); },
    clean(fx, fy, r) { brush(fx, fy, r, (i, w) => { stain[i] *= Math.max(0, 1 - w * 2.5); }); wake(4); },
    /* Claw marks: three grooves from one point to another. */
    claw(fx0, fy0, fx1, fy1, depth = 0.7) {
      const dx = (fx1 - fx0) * SW;
      const dy = (fy1 - fy0) * SH;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      for (let s = 0; s <= len; s += 1) {
        const f = s / len;
        for (const off of [-2.2, 0, 2.2]) {
          const x = (fx0 * SW + dx * f + nx * off) / SW;
          const y = (fy0 * SH + dy * f + ny * off) / SH;
          brush(x, y, 0.8, (i, w) => { hgt[i] -= depth * w * 0.5; });
        }
      }
      wake();
    },
    /* A groove along a list of points (fractions), for raking pictures. */
    groove(pts, depth = 0.9, r = 1.1) {
      for (let k = 1; k < pts.length; k++) {
        const [ax, ay] = pts[k - 1];
        const [bx, by] = pts[k];
        const n = Math.max(1, Math.ceil(Math.hypot((bx - ax) * SW, (by - ay) * SH)));
        for (let s = 0; s < n; s++) {
          const f = s / n;
          brush(ax + (bx - ax) * f, ay + (by - ay) * f, r, (i, w) => {
            hgt[i] -= depth * w * 0.4;
            stain[i] *= 1 - w * 0.5;
          });
        }
      }
      wake();
    },
    /* Everything flattened a little, as if shaken. */
    shake(amt = 0.4) {
      for (let i = 0; i < N; i++) hgt[i] = hgt[i] * (1 - amt) + base[i] * amt;
      wake();
    },
    /* What's been done to this box, for the next one. */
    marks() {
      const m = new Float32Array(N);
      for (let i = 0; i < N; i++) m[i] = hgt[i] - base[i];
      return m;
    },
    render,
  };
  render();
  return api;
}

/* ---------------- drawings ---------------- */

/* The Stink: a gas with a face that is a little too human. 160 x 150. */
const STINK_FACE = `
  <g class="s-brow"><path d="M44 52 Q58 41 73 50" stroke="#3b2a17" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <path d="M89 50 Q104 41 118 52" stroke="#3b2a17" stroke-width="3.2" fill="none" stroke-linecap="round"/></g>
  <g class="s-eye"><ellipse cx="59" cy="64" rx="12.5" ry="8.5" fill="#fbf4ea" stroke="#2d4d1c" stroke-width="1.6"/>
    <g class="s-look"><circle cx="61" cy="65" r="5.6" fill="#8a5a2b"/><circle cx="61" cy="65" r="2.7" fill="#120d08"/><circle cx="63" cy="63" r="1.3" fill="#fff"/></g>
    <ellipse class="s-lid" cx="59" cy="64" rx="13.5" ry="9.5" fill="#8fc24a" stroke="#2d4d1c" stroke-width="1.6"/></g>
  <g class="s-eye"><ellipse cx="103" cy="64" rx="12.5" ry="8.5" fill="#fbf4ea" stroke="#2d4d1c" stroke-width="1.6"/>
    <g class="s-look"><circle cx="105" cy="65" r="5.6" fill="#8a5a2b"/><circle cx="105" cy="65" r="2.7" fill="#120d08"/><circle cx="107" cy="63" r="1.3" fill="#fff"/></g>
    <ellipse class="s-lid" cx="103" cy="64" rx="13.5" ry="9.5" fill="#8fc24a" stroke="#2d4d1c" stroke-width="1.6"/></g>
  <path d="M48 75 Q59 80 70 75 M92 75 Q103 80 114 75" stroke="#6f9a3b" stroke-width="1.6" fill="none"/>
  <path d="M82 68 Q79 80 74 85 Q81 90 88 85" stroke="#2d4d1c" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="77.5" cy="86" rx="2" ry="1.2" fill="#2d4d1c"/><ellipse cx="85" cy="86" rx="2" ry="1.2" fill="#2d4d1c"/>
  <g class="s-shut"><path d="M58 101 Q70 94 80 98 Q90 94 102 101 Q80 104 58 101 Z" fill="#d9707a" stroke="#7a2a33" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M58 101 Q80 115 102 101 Q80 106 58 101 Z" fill="#e88a92" stroke="#7a2a33" stroke-width="1.6" stroke-linejoin="round"/></g>
  <g class="s-open"><ellipse cx="80" cy="105" rx="20" ry="13" fill="#3a0f14" stroke="#7a2a33" stroke-width="5"/>
    <rect x="65" y="93.5" width="30" height="6.5" rx="2" fill="#fffbea"/><path d="M72.5 94 V100 M80 94 V100 M87.5 94 V100" stroke="#cfc6ae" stroke-width="1"/>
    <ellipse cx="80" cy="112" rx="10" ry="4.5" fill="#d9707a"/></g>`;
const STINK = `<svg viewBox="0 0 160 150" aria-hidden="true">
  <g class="s-fumes" stroke="#8fc24a" stroke-width="4.5" fill="none" stroke-linecap="round">
    <path d="M52 16 q-7 -8 0 -15 q7 -7 0 -15"/><path d="M82 10 q-7 -8 0 -15 q7 -7 0 -15"/><path d="M112 16 q-7 -8 0 -15 q7 -7 0 -15"/></g>
  <g class="s-gas" fill="#a6d65c" stroke="#2d4d1c" stroke-width="3">
    <circle cx="30" cy="42" r="17"/><circle cx="134" cy="44" r="15"/><circle cx="16" cy="90" r="15"/><circle cx="146" cy="92" r="14"/>
    <circle cx="40" cy="132" r="15"/><circle cx="122" cy="132" r="16"/><circle cx="80" cy="16" r="15"/>
    <path d="M80 14 C112 10 140 30 142 62 C156 74 152 104 132 112 C126 134 98 142 80 134 C60 144 30 136 24 114 C6 104 4 76 20 64 C20 34 48 16 80 14 Z"/></g>
  <path d="M80 14 C112 10 140 30 142 62 C156 74 152 104 132 112 C126 134 98 142 80 134 C60 144 30 136 24 114 C6 104 4 76 20 64 C20 34 48 16 80 14 Z" fill="#a6d65c"/>
  <ellipse cx="58" cy="34" rx="24" ry="9" fill="#dff7a8" opacity=".75" transform="rotate(-18 58 34)"/>
  <path d="M30 118 Q80 146 134 112" stroke="#7fb342" stroke-width="7" fill="none" opacity=".6" stroke-linecap="round"/>
  ${STINK_FACE}
</svg>`;

/* A stinklet. Three faces, all a bit wrong. 100 x 100, centred. */
const BLOB_BODY = 'M0 -40 C22 -42 40 -26 40 -4 C46 10 36 34 14 38 C2 46 -16 44 -26 36 C-44 30 -46 6 -38 -8 C-40 -30 -20 -40 0 -40 Z';
const FACES = [
  // dots and a wide, wide smile
  `<circle cx="-12" cy="-6" r="5" fill="${INK}"/><circle cx="13" cy="-8" r="5" fill="${INK}"/><circle cx="-10" cy="-8" r="1.6" fill="#fff"/><circle cx="15" cy="-10" r="1.6" fill="#fff"/>
   <path d="M-18 8 Q0 26 20 6" stroke="${INK}" stroke-width="3.5" fill="#3a0f14" stroke-linejoin="round"/><path d="M-12 12 H14" stroke="#fffbea" stroke-width="3"/>`,
  // one big human eye
  `<ellipse cx="0" cy="-6" rx="15" ry="10" fill="#fbf4ea" stroke="#2d4d1c" stroke-width="2"/><circle cx="2" cy="-5" r="6.5" fill="#4a7ab0"/><circle cx="2" cy="-5" r="3" fill="${INK}"/><circle cx="4" cy="-7" r="1.4" fill="#fff"/>
   <path d="M-15 -14 L-12 -19 M-6 -16 L-5 -21 M3 -16 L3 -21 M11 -15 L13 -20" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
   <path d="M-8 14 Q0 18 8 14" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  // eyelashes and lipstick
  `<path d="M-19 -6 Q-12 -14 -5 -6 M5 -6 Q12 -14 19 -6" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
   <path d="M-19 -6 l-3 -4 M-15 -10 l-1 -5 M19 -6 l3 -4 M15 -10 l1 -5" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
   <path d="M-10 10 Q-5 5 0 8 Q5 5 10 10 Q0 20 -10 10 Z" fill="#e0465c" stroke="#7a2a33" stroke-width="1.6"/>`,
];
const SHADES = `<g class="b-shades"><path d="M-26 -14 H26 L23 -2 Q19 4 8 2 L3 -6 H-3 L-8 2 Q-19 4 -23 -2 Z" fill="${INK}"/><path d="M-19 -11 L-13 -11" stroke="#fff" stroke-width="2" opacity=".6"/></g>`;
const blobSvg = (face) => `<svg viewBox="-50 -50 100 100" aria-hidden="true"><g class="b-wob">
  <path d="${BLOB_BODY}" fill="#a6d65c" stroke="#2d4d1c" stroke-width="3.5"/>
  <ellipse cx="-14" cy="-24" rx="12" ry="5" fill="#dff7a8" opacity=".8" transform="rotate(-24 -14 -24)"/>
  <g class="b-face">${FACES[face]}</g>${SHADES}
  <g class="b-hat"><path d="M-8 -36 L6 -66 L18 -32 Z" fill="#ff5c8a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="6" cy="-67" r="5" fill="#ffd84a" stroke="${INK}" stroke-width="2"/></g>
</g></svg>`;

/* Mookie's paw, from above, pointing up: toe beans hidden underneath, claws out to scratch. */
const PAW = `<svg viewBox="0 0 100 110" aria-hidden="true">
  <g class="p-claws" stroke="#f4efe6" stroke-width="4" stroke-linecap="round" fill="none">
    <path d="M24 22 Q20 8 26 0"/><path d="M42 12 Q40 -2 46 -10"/><path d="M60 12 Q60 -2 66 -9"/><path d="M78 22 Q78 8 84 2"/></g>
  <g fill="${INK}" stroke="#34343d" stroke-width="2">
    <ellipse cx="50" cy="66" rx="36" ry="38"/>
    <ellipse cx="24" cy="32" rx="12" ry="14"/><ellipse cx="42" cy="22" rx="12" ry="14"/><ellipse cx="60" cy="22" rx="12" ry="14"/><ellipse cx="77" cy="32" rx="12" ry="14"/></g>
  <path d="M33 26 V40 M51 18 V34 M68 26 V40" stroke="#34343d" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;

/* A houseplant on the floor, from above. It has opinions. */
const PLANT = `<svg viewBox="-50 -50 100 100" aria-hidden="true">
  <circle r="30" fill="#c96b3c" stroke="${INK}" stroke-width="3"/><circle r="24" fill="#5b3a22"/>
  <g class="pl-leaves" fill="#5fae4a" stroke="#2b5a20" stroke-width="2.5">
    <path d="M0 0 C-10 -20 -8 -40 0 -48 C8 -40 10 -20 0 0 Z"/><path d="M0 0 C-10 -20 -8 -40 0 -48 C8 -40 10 -20 0 0 Z" transform="rotate(72)"/>
    <path d="M0 0 C-10 -20 -8 -40 0 -48 C8 -40 10 -20 0 0 Z" transform="rotate(144)"/><path d="M0 0 C-10 -20 -8 -40 0 -48 C8 -40 10 -20 0 0 Z" transform="rotate(216)"/>
    <path d="M0 0 C-10 -20 -8 -40 0 -48 C8 -40 10 -20 0 0 Z" transform="rotate(288)"/></g>
  <g class="pl-face"><path d="M-12 -6 l6 6 m0 -6 l-6 6 M6 -6 l6 6 m0 -6 l-6 6" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="0" cy="12" rx="5" ry="6" fill="${INK}"/></g>
</svg>`;

/* Things in each world. Fractions of the box; markup is fixed. */
const DECO = {
  zen: () => [
    deco('lb-rock', 82, 30, `<svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="M-36 -8 C-34 -32 -6 -40 14 -34 C38 -28 42 -4 36 14 C28 36 -8 40 -26 28 C-40 18 -38 4 -36 -8 Z" fill="#7d7f84" stroke="${INK}" stroke-width="3"/>
      <path d="M-24 -18 C-14 -30 8 -30 20 -22 C8 -20 -10 -14 -24 -18 Z" fill="#9fa2a8"/><path d="M-30 16 C-18 30 12 32 28 14 C14 22 -12 24 -30 16 Z" fill="#6ea04a"/></svg>`),
    deco('lb-bonsai', 92, 80, `<svg viewBox="-50 -50 100 100" aria-hidden="true"><rect x="-26" y="-20" width="52" height="40" rx="6" fill="#2f4f6a" stroke="${INK}" stroke-width="3"/>
      <g fill="#4f8f3a" stroke="#244a1a" stroke-width="2.5"><circle cx="-14" cy="-6" r="14"/><circle cx="12" cy="-12" r="16"/><circle cx="6" cy="10" r="13"/><circle cx="-6" cy="4" r="10"/></g></svg>`),
  ],
  sahara: () => [
    deco('lb-pyramid', 84, 26, `<svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="M-38 -38 H38 V38 H-38 Z" fill="#e0a85e" stroke="${INK}" stroke-width="3"/>
      <path d="M-38 -38 L0 0 L-38 38 Z" fill="#c98a42"/><path d="M38 -38 L0 0 L38 38 Z" fill="#f2c27e"/><path d="M-38 -38 L38 38 M38 -38 L-38 38" stroke="${INK}" stroke-width="2"/></svg>`),
    deco('lb-caravan', 30, 12, `<svg viewBox="0 0 160 40" aria-hidden="true">${[0, 40, 80, 120].map((x) => `<g transform="translate(${x} 0)">
      <path d="M4 26 Q8 12 16 14 Q20 6 26 14 Q30 4 34 18 L36 10 L40 10 L38 20 L34 26 Z" fill="#7a4a22"/><path d="M8 26 V36 M14 26 V36 M28 26 V36 M33 26 V36" stroke="#7a4a22" stroke-width="2.5"/>
      <path d="M2 38 L44 40" stroke="rgba(80,40,10,.35)" stroke-width="5" stroke-linecap="round"/></g>`).join('')}</svg>`),
  ],
  cake: () => [1, 2, 3, 4, 5].map((k) => deco('lb-candle', 12 + k * 15, 8, `<svg viewBox="-50 -50 100 100" aria-hidden="true">
      <circle r="18" fill="${k % 2 ? '#7fd3ff' : '#ff8fb8'}" stroke="${INK}" stroke-width="3"/><circle class="lb-flame" r="10" fill="#ffd84a"/><circle r="4" fill="#fff6c8"/></svg>`)),
  sea: () => [
    deco('lb-star', 88, 76, `<svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="M0 -42 L11 -12 L42 -10 L17 9 L26 40 L0 22 L-26 40 L-17 9 L-42 -10 L-11 -12 Z" fill="#ff8a5c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="-5" cy="-2" r="3" fill="${INK}"/><circle cx="6" cy="-2" r="3" fill="${INK}"/></svg>`),
    deco('lb-angler', 72, 18, `<svg viewBox="-50 -50 100 100" aria-hidden="true"><circle class="lb-lure" cx="0" cy="0" r="30" fill="rgba(255,240,150,.35)"/><circle r="9" fill="#fff6a8" stroke="${INK}" stroke-width="2"/></svg>`),
  ],
  disco: () => [
    deco('lb-ball', 88, 20, `<svg viewBox="-50 -50 100 100" aria-hidden="true"><circle r="36" fill="#cfd3e0" stroke="${INK}" stroke-width="3"/>
      <path d="M-36 0 H36 M0 -36 V36 M-30 -20 H30 M-30 20 H30 M-20 -30 V30 M20 -30 V30" stroke="#8a8fa3" stroke-width="2"/><circle cx="-12" cy="-14" r="8" fill="#fff"/></svg>`),
  ],
};
function deco(cls, x, y, markup) {
  const d = h('div', `lb-deco ${cls}`);
  d.style.left = `${x}%`;
  d.style.top = `${y}%`;
  d.innerHTML = markup; // fixed markup
  return d;
}

/* The jar. 100 x 130. */
const JAR = `<svg viewBox="0 0 100 130" aria-hidden="true">
  <path d="M14 30 Q8 34 8 46 V112 Q8 126 22 126 H78 Q92 126 92 112 V46 Q92 34 86 30 Z" fill="rgba(200,236,255,.32)" stroke="#4d6b7a" stroke-width="4"/>
  <path d="M18 48 V108" stroke="#fff" stroke-width="5" opacity=".6" stroke-linecap="round"/>
  <rect x="24" y="74" width="52" height="28" rx="3" fill="#fff8ec" stroke="${INK}" stroke-width="2.5"/>
  <text x="50" y="93" text-anchor="middle" font-size="14" font-weight="700" fill="${INK}" font-family="Fredoka, sans-serif">1 STINK</text>
  <g class="j-lid"><rect x="10" y="14" width="80" height="18" rx="4" fill="#b9c0c7" stroke="${INK}" stroke-width="3"/><path d="M18 18 V28 M30 18 V28 M42 18 V28 M54 18 V28 M66 18 V28 M78 18 V28" stroke="#7d868f" stroke-width="2"/></g>
</svg>`;

/* The sphinx, with his face. 200 x 150. */
const SPHINX = `<svg viewBox="0 0 200 150" aria-hidden="true">
  <g stroke="${INK}" stroke-width="3.5" stroke-linejoin="round">
    <path d="M20 146 V118 Q20 100 44 98 H156 Q180 100 180 118 V146 Z" fill="#e3b46c"/>
    <path d="M30 146 V128 Q30 120 50 120 H76 V146 Z M124 146 V120 H150 Q170 120 170 128 V146 Z" fill="#f0c98a"/>
    <path d="M60 104 L52 38 L80 58 Q100 50 120 58 L148 38 L140 104 Z" fill="#e3b46c"/>
    <path d="M58 44 L64 62 L76 58 Z M142 44 L136 62 L124 58 Z" fill="#c98a42"/>
    <path d="M56 70 Q100 60 144 70 L140 106 Q100 118 60 106 Z" fill="#e8bd78"/></g>
  <path d="M70 78 Q80 72 90 80 M110 80 Q120 72 130 78" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M94 88 L100 94 L106 88 Z" fill="#b5686f"/><path d="M100 94 Q92 102 86 98 M100 94 Q108 102 114 98" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M66 92 L44 88 M66 96 L44 98 M134 92 L156 88 M134 96 L156 98" stroke="${INK}" stroke-width="2"/>
  <path d="M30 132 H70 M130 132 H164" stroke="#b98a4a" stroke-width="2"/>
</svg>`;

/* A fly in a tuxedo, with a baton. 100 x 80. */
const FLY = `<svg viewBox="-50 -40 100 80" aria-hidden="true">
  <g class="f-wings" fill="rgba(220,240,255,.7)" stroke="#5a6a7a" stroke-width="2"><ellipse cx="-16" cy="-18" rx="18" ry="10" transform="rotate(-30 -16 -18)"/><ellipse cx="16" cy="-18" rx="18" ry="10" transform="rotate(30 16 -18)"/></g>
  <ellipse cx="0" cy="8" rx="16" ry="22" fill="${INK}"/><path d="M-7 -10 L0 16 L7 -10 Z" fill="#fff"/><path d="M-8 -9 L0 -5 L8 -9 L8 -3 L0 -7 L-8 -3 Z" fill="#e0304a"/>
  <circle cx="0" cy="-18" r="11" fill="${INK}"/><circle cx="-7" cy="-21" r="7" fill="#b3202a"/><circle cx="7" cy="-21" r="7" fill="#b3202a"/>
  <circle cx="-8" cy="-23" r="2" fill="#fff"/><circle cx="6" cy="-23" r="2" fill="#fff"/>
  <g class="f-baton"><path d="M14 4 L40 -24" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M12 6 L16 2" stroke="${INK}" stroke-width="5" stroke-linecap="round"/></g>
</svg>`;

/* Mookie's tail, going past. */
const TAIL = `<svg viewBox="0 0 300 120" aria-hidden="true"><path d="M-40 110 C40 100 60 20 140 30 C210 40 220 100 280 60 Q300 46 296 24" stroke="${INK}" stroke-width="30" fill="none" stroke-linecap="round"/></svg>`;

/* The zoom out: the room inside the house inside the town on the planet, each a seventh the
   size of the one around it, all centred on the box. */
const RING = (k) => `<circle class="z-gas z${k}" r="46" fill="#9ad04f" opacity="0"/>`;
const ZOOM = `<svg viewBox="-50 -50 100 100" aria-hidden="true"><g class="lb-z">
  <circle r="44" fill="#3b7fd1" stroke="${INK}" stroke-width=".8"/>
  <path d="M-30 -20 C-20 -34 0 -30 2 -18 C4 -8 -8 -4 -14 4 C-20 14 -32 8 -34 -4 Z M8 6 C18 -2 32 4 34 16 C36 28 22 36 12 30 C4 24 2 14 8 6 Z M10 -34 C18 -38 28 -32 26 -24 C22 -18 12 -22 10 -34 Z" fill="#5bb35b" stroke="${INK}" stroke-width=".6"/>
  <g class="z-face"><circle cx="-12" cy="-6" r="2.6" fill="${INK}"/><circle cx="12" cy="-6" r="2.6" fill="${INK}"/><path d="M-10 12 Q0 6 10 12" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>
  ${RING(3)}
  <g transform="scale(.142857)">
    <rect x="-44" y="-44" width="88" height="88" fill="#cfd8c4"/>
    <path d="M-44 -15 H44 M-44 15 H44 M-15 -44 V44 M15 -44 V44" stroke="#8a8f88" stroke-width="5"/>
    ${[-30, 0, 30].flatMap((x) => [-30, 30].map((y) => `<rect x="${x - 9}" y="${y - 8}" width="18" height="16" fill="${(x + y) % 60 ? '#c75b4a' : '#4a6fc7'}" stroke="${INK}" stroke-width="1.2"/>`)).join('')}
    <rect x="-36" y="-6" width="18" height="12" fill="#6aa04f"/><rect x="18" y="-6" width="18" height="12" fill="#c7a24a" stroke="${INK}" stroke-width="1.2"/>
    ${RING(2)}
    <g transform="scale(.142857)">
      <rect x="-44" y="-44" width="88" height="88" fill="#efe3c8" stroke="${INK}" stroke-width="3"/>
      <path d="M-44 -6 H-8 M8 -6 H44 M-6 -44 V-20 M-6 -8 V44" stroke="${INK}" stroke-width="3"/>
      <rect x="-38" y="-38" width="22" height="26" rx="3" fill="#7a9fd1"/><rect x="14" y="-38" width="24" height="14" rx="3" fill="#c78a5a"/><rect x="-38" y="14" width="26" height="12" rx="3" fill="#a07ac7"/>
      ${RING(1)}
      <g transform="scale(.142857)">
        <rect x="-44" y="-44" width="88" height="88" fill="#d8d2c4" stroke="${INK}" stroke-width="3"/>
        <path d="M-44 -22 H44 M-44 0 H44 M-44 22 H44 M-22 -44 V44 M0 -44 V44 M22 -44 V44" stroke="#bdb5a4" stroke-width="1"/>
        <rect x="-12" y="-8" width="24" height="16" rx="3" fill="#36b0a6" stroke="${INK}" stroke-width="2"/><rect x="-9" y="-5" width="18" height="10" fill="#f0e6cf"/>
        <circle cx="-30" cy="28" r="7" fill="#5fae4a" stroke="${INK}" stroke-width="1.5"/><path d="M30 -44 A16 16 0 0 1 44 -30" stroke="${INK}" stroke-width="2" fill="none"/>
        ${RING(0)}
      </g>
    </g>
  </g>
</g></svg>`;

/* ---------------- the game ---------------- */

const GAGS = {
  win: { moon: 'His face rises like a moon', sphinx: 'The mound becomes a sphinx', jar: 'The Stink, sealed in a jar', smiley: 'The sand rakes itself a smiley', zoomies: 'The zoomies' },
  fail: { earth: 'Zoom out: the whole planet stinks', plant: 'The houseplant faints', peel: 'The screen peels off', fly: 'A fly in a tuxedo conducts', stroll: 'Mookie strolls off' },
};
const winGag = gagDeck(['moon', 'moon', 'sphinx', 'jar', 'smiley', 'zoomies'], () => litterbox.gagsOn?.win);
const failGag = gagDeck(['earth', 'earth', 'plant', 'peel', 'fly', 'stroll'], () => litterbox.gagsOn?.fail);

/* The Big Stink's arms: where each one reaches (fractions of the box). */
const ARMS = [[0.07, 0.2], [0.93, 0.2], [0.15, 0.56], [0.85, 0.56]];

export const litterbox = {
  id: 'litterbox',
  name: 'Litterbox',
  tap: 'shaker',
  pickClass: 'opt-litter',
  slotIcon: (c) => (c === 'ee' ? '🐾🐾' : '🐾'),
  bossName: 'The Big Stink',
  gags: GAGS,
  make(stage, { boss = false } = {}) {
    stage.className = `stage scene-lb${boss ? ' boss' : ''}`;
    const world = nextWorld();
    stage.dataset.world = world.id;
    stage.dataset.tier = 0;

    const cam = h('div', 'lb-cam');
    const floor = h('div', 'lb-floor');
    const plant = h('div', 'lb-plant');
    plant.innerHTML = PLANT; // fixed markup
    const box = h('div', 'lb-box');
    const inn = h('div', 'lb-in');
    const sand = makeSand(world);
    const glint = h('div', 'lb-glint');
    const row = h('div', 'lb-row');
    inn.append(sand.el, glint, ...(boss ? [] : DECO[world.id]()), row);
    box.append(inn, h('b', 'lb-plate', world.plate));
    const gods = h('div', 'lb-gods');
    const stink = h('div', `lb-stink${boss ? ' big' : ''}`);
    stink.innerHTML = STINK; // fixed markup
    const arms = boss ? h('div', 'lb-arms') : null;
    if (arms) {
      arms.innerHTML = `<svg viewBox="0 0 200 110" preserveAspectRatio="none" aria-hidden="true">${ARMS.map(([x, y], k) => {
        const tx = x * 200;
        const ty = y * 110;
        const d = `M100 34 C${(100 + tx) / 2} ${ty - 30} ${tx + (tx < 100 ? 30 : -30)} ${ty + 20} ${tx} ${ty}`;
        return `<g class="a-arm a${k}"><path d="${d}" stroke="#2d4d1c" stroke-width="15" fill="none" stroke-linecap="round"/>
          <path d="${d}" stroke="#a6d65c" stroke-width="10" fill="none" stroke-linecap="round"/></g>`;
      }).join('')}</svg>`; // fixed markup
      inn.insertBefore(arms, row);
    }
    const arm = h('div', 'lb-arm');
    const paw = h('div', 'lb-paw');
    paw.innerHTML = PAW; // fixed markup
    const fog = h('div', 'lb-fog');
    cam.append(floor, plant, box, stink, gods, arm, paw);
    const glass = h('div', 'lb-glass');
    const fx = h('div', 'ms-fx lb-fx');
    const speed = h('div', 'ms-speed');
    stage.append(cam, fog, glass, speed, fx);

    let busy = false;
    let blobs = []; // this call's stinklets: { el, b, small, state }
    let next = 0; // the next stinklet a scratch goes for
    let callAt = 0; // when the call's first note sounded (ms)
    let spbMs = 556;
    let faceAt = Math.floor(Math.random() * FACES.length);
    let armsLeft = ARMS.map((_, k) => k);
    let godsUp = false;
    let mookieBig = null;

    /* ---- places ---- */

    const W = () => stage.clientWidth || 1;
    const H = () => stage.clientHeight || 1;
    /* The box's sand on the stage, in px. */
    const inside = () => ({ x: box.offsetLeft + inn.offsetLeft, y: box.offsetTop + inn.offsetTop, w: inn.offsetWidth || 1, h: inn.offsetHeight || 1 });
    const at = (fx0, fy) => {
      const r = inside();
      return { x: r.x + fx0 * r.w, y: r.y + fy * r.h };
    };
    const mid = (el, fx0 = 0.5, fy = 0.5) => ({ x: el.offsetLeft + el.offsetWidth * fx0, y: el.offsetTop + el.offsetHeight * fy });
    const blobAt = (o) => at(o.x, o.y);
    const clampX = (x, pad = 0.14) => Math.max(W() * pad, Math.min(W() * (1 - pad), x));

    function comic(text, p, cls = '') {
      const c = h('b', `ms-comic ${cls}`, text);
      c.style.left = `${clampX(p.x, cls.includes('big') ? 0.3 : 0.16)}px`;
      c.style.top = `${Math.max(30, p.y)}px`;
      c.style.setProperty('--rot', `${rnd(-8, 8).toFixed(1)}deg`);
      fx.append(c);
      later(900, () => c.remove());
      return c;
    }
    function bubble(text, p) {
      const b = h('div', 'ms-bubble', text);
      b.style.left = `${clampX(p.x)}px`;
      b.style.top = `${Math.max(34, p.y)}px`;
      fx.append(b);
      later(700, () => b.remove());
    }
    function flashSpeed(cls = '') {
      speed.className = `ms-speed ${cls}`;
      bump(speed, 'go');
    }
    function punch(p, scale = 1.12, ms = 480) {
      cam.style.transformOrigin = `${p.x}px ${p.y}px`;
      cam.animate([
        { transform: 'scale(1)' }, { transform: `scale(${scale}) rotate(-1.5deg)`, offset: 0.2 },
        { transform: `scale(${scale * 1.02}) rotate(-1.5deg)`, offset: 0.6 }, { transform: 'scale(1)' },
      ], { duration: ms, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
    /* Grains thrown up from a point (stage px). */
    function spray(p, n = 8, power = 1) {
      for (let k = 0; k < n; k++) {
        const d = h('i', 'lb-grain');
        d.style.left = `${p.x}px`;
        d.style.top = `${p.y}px`;
        d.style.setProperty('--dx', `${(rnd(-1, 1) * 40 * power).toFixed(0)}px`);
        d.style.setProperty('--dy', `${(-rnd(10, 46) * power).toFixed(0)}px`);
        d.style.setProperty('--s', rnd(0.5, 1.2).toFixed(2));
        fx.append(d);
        later(520, () => d.remove());
      }
    }
    /* Sand that hits the camera and sticks to the glass, then slides off. */
    function splat(n = 3, near = null) {
      for (let k = 0; k < n; k++) {
        const s = h('i', 'lb-splat');
        const x = near ? near.x + rnd(-0.12, 0.12) * W() : rnd(0.15, 0.85) * W();
        const y = near ? near.y + rnd(-0.2, 0.05) * H() : rnd(0.2, 0.8) * H();
        s.style.left = `${Math.max(10, Math.min(W() - 10, x))}px`;
        s.style.top = `${Math.max(10, Math.min(H() - 10, y))}px`;
        s.style.setProperty('--s', rnd(0.6, 1.5).toFixed(2));
        s.style.setProperty('--r', `${rnd(0, 360).toFixed(0)}deg`);
        glass.append(s);
        while (glass.childElementCount > 26) glass.firstChild.remove();
        later(3200, () => s.remove());
      }
      if (n) toon('thud', undefined, { vol: 0.35, rate: 1.6 });
    }

    /* ---- the paw, on its long arm from below the screen ---- */

    let pawAt = null;
    let pawAnim = 0;
    const anchor = () => ({ x: W() * 0.74, y: H() * 1.55 });
    const rest = () => ({ x: W() * 0.62, y: H() * 0.93 });
    function setPaw(p) {
      pawAt = p;
      const a = anchor();
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      const len = Math.hypot(dx, dy);
      const ang = (Math.atan2(dx, -dy) * 180) / Math.PI;
      arm.style.height = `${len}px`;
      arm.style.transform = `translate(${a.x}px, ${a.y - len}px) translateX(-50%) rotate(${ang.toFixed(1)}deg)`;
      paw.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -32%) rotate(${ang.toFixed(1)}deg)`;
    }
    const EASE = { out: (t) => 1 - (1 - t) ** 3, inOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2), in: (t) => t * t };
    /* Move the paw through points (stage px), each leg in its own time. */
    function pawPath(legs) {
      cancelAnimationFrame(pawAnim);
      let from = pawAt || rest();
      let k = 0;
      let t0 = performance.now();
      const step = (now) => {
        const leg = legs[k];
        const to = typeof leg.to === 'function' ? leg.to() : leg.to;
        const f = Math.min(1, (now - t0) / leg.ms);
        const e = (EASE[leg.ease] || EASE.out)(f);
        setPaw({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
        if (f >= 1) {
          leg.then?.();
          from = to;
          t0 = now;
          k++;
          if (k >= legs.length) { pawAnim = 0; return; }
        }
        if (paw.isConnected) pawAnim = requestAnimationFrame(step);
      };
      pawAnim = requestAnimationFrame(step);
    }
    const pawHome = (ms = 240) => pawPath([{ to: rest, ms, ease: 'out' }]);

    /* One scratch from a point to a point (fractions of the box). `land` runs as the sand moves. */
    function scratch(fx0, fy0, fx1, fy1, land, ms = 190) {
      paw.classList.add('claws');
      pawPath([
        { to: at(fx0, fy0), ms: ms * 0.36, ease: 'out' },
        { to: at(fx1, fy1), ms: ms * 0.34, ease: 'in' },
        { to: rest, ms: ms * 0.9, ease: 'out', then: () => paw.classList.remove('claws') },
      ]);
      // The sand moves on its own clock, so a scratch that cuts this one short doesn't lose it.
      later(ms * 0.62, () => {
        sand.claw(fx0, fy0 + 0.02, fx1, fy1 + 0.04, 0.8);
        toon('scratch', undefined, { rate: rnd(0.85, 1.2) });
        land?.();
      });
    }

    /* ---- the stinklets ---- */

    function blobEl(small) {
      const el = h('div', `lb-blob${small ? ' small' : ''}`);
      el.innerHTML = blobSvg(faceAt++ % FACES.length); // fixed markup
      el.append(h('i', 'b-fume'), h('i', 'b-fume f2'));
      return el;
    }
    /* A note of the call: a stinklet burps up out of the sand where that note falls in time. */
    function sprout(i, syl) {
      const now = performance.now();
      if (i === 0 || !blobs.length) {
        blobs.forEach((o) => o.el.remove());
        blobs = [];
        next = 0;
        callAt = now;
      }
      const b = Math.max(0, Math.round(((now - callAt) / spbMs) * 2) / 2);
      const half = b % 1 !== 0;
      const small = syl ? syl === 'de' || (blobs.length && blobs[blobs.length - 1].b === b - 0.5) : half;
      if (half && blobs.length) {
        // The du of a du-de is an eighth too.
        const prev = blobs[blobs.length - 1];
        if (prev.b === b - 0.5 && !prev.small) { prev.small = true; prev.el.classList.add('small'); size(prev); }
      }
      const o = { b, small, state: 'out', x: 0.1 + (0.8 * (Math.min(b, 3.75) + 0.25)) / 4, y: boss ? 0.78 : 0.6 };
      o.el = blobEl(small);
      size(o);
      row.append(o.el);
      blobs.push(o);
      sand.dig(o.x, o.y + 0.02, small ? 3 : 4, 1.2);
      sand.stain(o.x, o.y + 0.02, small ? 3.6 : 5, 1);
      spray(blobAt(o), 4, 0.6);
      return o;
    }
    function size(o) {
      o.el.style.left = `${o.x * 100}%`;
      o.el.style.top = `${o.y * 100}%`;
    }
    /* Bury one stinklet, how well depends on the timing. */
    function bury(o, cls) {
      const sm = o.small ? 0.75 : 1;
      if (cls === 'off') {
        // Way off: the sand goes everywhere but on it.
        o.state = 'dusty';
        bump(o.el, 'dusty');
        sand.pile(o.x + rnd(-0.1, 0.1), o.y + 0.16, 3, 1.2);
        splat(3, at(o.x, o.y));
        spray(blobAt(o), 10, 1.4);
        later(160, () => { if (!busy) bubble(Math.random() < 0.5 ? 'missed me' : 'nyeh', at(o.x, o.y - 0.12)); });
        return;
      }
      if (cls === 'close') {
        o.state = 'half';
        o.el.classList.add('half');
        sand.pile(o.x + rnd(-0.03, 0.03), o.y + 0.07, 4.2 * sm, 2.6 * sm);
        sand.clean(o.x, o.y + 0.04, 3 * sm);
        spray(blobAt(o), 7, 1);
        splat(1, at(o.x, o.y));
        return;
      }
      o.state = 'buried';
      o.el.classList.add('buried');
      later(420, () => o.el.remove());
      sand.pile(o.x, o.y + 0.03, 5 * sm, 4.2 * sm);
      sand.clean(o.x, o.y + 0.03, 6 * sm);
      spray(blobAt(o), 8, 0.9);
    }

    /* ---- the Stink ---- */

    let talk = 0;
    function sing(open = true, ms = 170) {
      clearTimeout(talk);
      stink.classList.toggle('open', open);
      bump(stink, 'puff');
      talk = later(ms, () => stink.classList.remove('open'));
    }

    /* ---- the Big Stink's arms ---- */

    function buryArm() {
      const k = armsLeft.shift();
      if (k == null) return null;
      const [x, y] = ARMS[k];
      arms.querySelector(`.a${k}`)?.classList.add('gone');
      scratch(x + (x < 0.5 ? 0.06 : -0.06), Math.min(0.95, y + 0.22), x, y + 0.03, () => {
        sand.pile(x, y, 6, 4.5);
        spray(at(x, y), 12, 1.3);
      }, 220);
      return at(x, y);
    }

    /* Bindi and Rusty, huge, peer in from the edges at the top combo. */
    function summonGods() {
      godsUp = true;
      const b = rigCat('bindi');
      const r = rigCat('rusty');
      b.el.classList.add('lb-god', 'l');
      r.el.classList.add('lb-god', 'r');
      b.mood('happy');
      r.mood('happy');
      b.look(1, 0.6);
      r.look(-1, 0.6);
      gods.append(b.el, r.el);
      gods.cats = [b, r];
      later(30, () => gods.classList.add('up'));
      toon('choir', undefined, { vol: 0.6 });
    }

    // Starting pose.
    setPaw(rest());
    later(0, () => setPaw(rest()));

    return {
      onCall(i, syl) {
        if (busy) return;
        sing(true, 160);
        const o = sprout(i, syl);
        toon('blorp', undefined, { vol: 0.8, rate: o.small ? 1.35 : 1 });
        if (syl) later(30, () => {
          const m = mid(stink, 0.5, boss ? 0.2 : 0.06);
          callBubble(fx, i, syl, m.x, Math.max(34, m.y));
        });
      },
      onTap(fb) {
        if (busy) return;
        const cls = fb?.cls || 'on';
        const o = cls === 'idle' ? null : blobs[next];
        if (o) next++;
        if (!o) {
          // Nothing to bury: a scratch at thin air, and the sand at the camera.
          const x = rnd(0.25, 0.75);
          scratch(x, 0.98, x + rnd(-0.05, 0.05), 0.8, () => {
            spray(at(x, 0.8), 10, 1.5);
            splat(2, at(x, 0.7));
          }, 170);
          return;
        }
        const jx = cls === 'on' || cls === 'tap' ? 0 : rnd(-0.06, 0.06);
        scratch(o.x + jx + rnd(-0.02, 0.02), Math.min(0.98, o.y + 0.3), o.x + jx * 0.5, o.y + 0.08, () => bury(o, cls), 180);
      },
      onBeat(down, spb, tier = 0) {
        spbMs = spb * 1000;
        stage.dataset.tier = tier;
        stage.dataset.beat = down ? 'a' : 'b';
        if (tier >= 4 && !godsUp && !busy) summonGods();
        gods.cats?.forEach((c) => c.beat(down, spb, tier));
        if (tier >= 3) sand.el.style.setProperty('--hue', `${((Number(sand.el.style.getPropertyValue('--hue').replace('deg', '')) || 0) + 70) % 360}deg`);
        mookieBig?.beat(down, spb, tier);
      },
      /* Boss rounds: a hit buries one of his arms; a miss and an arm slaps the paw away. */
      hit() {
        const p = buryArm();
        later(150, () => {
          bump(stink, 'flinch');
          stink.style.setProperty('--size', (1 - (4 - armsLeft.length) * 0.08).toFixed(2));
          if (p) comic(['BURIED!', 'SCRITCH!', 'POMF!', 'GONE!'][(3 - armsLeft.length) % 4], { x: p.x, y: p.y - 30 }, 'hit');
          toon('whistle-down', undefined, { vol: 0.5 });
          sing(true, 300);
        });
      },
      miss() {
        const k = armsLeft[0] ?? 0;
        const [x, y] = ARMS[k];
        pawPath([{ to: at(x, y + 0.15), ms: 140, ease: 'out' }, { to: { x: W() * 1.2, y: H() * 0.4 }, ms: 220, ease: 'out' }, { to: rest, ms: 260, ease: 'inOut' }]);
        later(150, () => {
          arms.querySelector(`.a${k}`) && bump(arms.querySelector(`.a${k}`), 'slap');
          toon('punch', undefined, { vol: 0.9 });
          comic('SLAP!', at(x, y), 'bad');
          sing(true, 500);
          bubble('ha!', mid(stink, 0.5, 0.1));
          fog.classList.add('puff');
          later(700, () => fog.classList.remove('puff'));
        });
      },
      win(force) {
        busy = true;
        carry = sand.marks();
        if (boss) return bossKO();
        tidy();
        const gag = winGag(force);
        if (gag === 'sphinx') return winSphinx();
        if (gag === 'jar') return winJar();
        if (gag === 'smiley') return winSmiley();
        if (gag === 'zoomies') return winZoomies();
        return winMoon();
      },
      fail(force) {
        busy = true;
        carry = sand.marks();
        if (boss) return bossLose();
        const gag = failGag(force);
        stinkUp(gag === 'fly' || gag === 'stroll');
        if (gag === 'plant') return failPlant();
        if (gag === 'peel') return failPeel();
        if (gag === 'fly') return failFly();
        if (gag === 'stroll') return failStroll();
        return failEarth();
      },
    };

    /* ---------------- wins ---------------- */

    /* Whatever's still out gets one more quick scratch, and the Stink gives up. */
    function tidy() {
      const out = blobs.filter((o) => o.state !== 'buried');
      out.forEach((o, k) => later(k * 90, () => scratch(o.x, o.y + 0.25, o.x, o.y + 0.07, () => bury(o, 'on'), 150)));
      later(80, () => {
        stink.classList.add('sad');
        toon('whistle-down', undefined, { vol: 0.6 });
      });
    }
    function lastSpot() {
      const o = blobs[blobs.length - 1];
      return o ? [o.x, o.y] : [0.5, 0.6];
    }
    /* His face rises over the rim like a moon, and he closes his eyes, very slowly. */
    function winMoon() {
      const m = rigMookie();
      m.el.classList.add('lb-moon');
      cam.append(m.el);
      mookieBig = m;
      m.mood('idle');
      m.look(0, 0.4);
      later(200, () => {
        m.el.classList.add('up');
        toon('choir', undefined, { vol: 0.9 });
        flashSpeed('gold');
      });
      later(700, () => { m.mood('happy'); comic('mrrrp.', { x: W() * 0.5, y: H() * 0.22 }, 'big'); });
      later(1050, () => { m.mood('purr'); bubble('satisfactory.', { x: W() * 0.5, y: H() * 0.36 }); });
    }
    /* The last mound swells into a sphinx with his face. */
    function winSphinx() {
      const [x, y] = lastSpot();
      for (let k = 0; k < 4; k++) later(100 + k * 90, () => { sand.pile(x, y, 6 + k, 2.5); spray(at(x, y), 6, 1.2); });
      later(140, () => toon('slide-up', undefined, { vol: 0.8 }));
      const s = h('div', 'lb-sphinx');
      s.innerHTML = SPHINX; // fixed markup
      later(520, () => {
        const p = at(Math.max(0.25, Math.min(0.75, x)), y);
        s.style.left = `${p.x}px`;
        s.style.top = `${p.y}px`;
        cam.append(s);
        toon('gong', undefined, { vol: 0.9 });
        toon('fanfare', undefined, { vol: 0.7 });
        punch(p, 1.1);
      });
      later(800, () => comic('BEHOLD.', { x: W() * 0.5, y: H() * 0.24 }, 'big'));
      later(1150, () => bubble('a monument to me', at(0.5, 0.25)));
    }
    /* The Stink, sealed in a jar. */
    function winJar() {
      const j = h('div', 'lb-jar');
      j.innerHTML = JAR; // fixed markup
      cam.append(j);
      later(60, () => { j.classList.add('in'); toon('zip', undefined, { vol: 0.7 }); });
      // He's sucked out of his corner and into the jar.
      const inJar = h('div', 'lb-jarred');
      inJar.innerHTML = STINK; // fixed markup
      later(380, () => {
        stink.classList.add('sucked');
        toon('slurp', undefined, { vol: 0.8 });
      });
      later(620, () => { j.prepend(inJar); stink.style.visibility = 'hidden'; });
      later(700, () => {
        j.classList.add('shut');
        toon('pop', undefined, { vol: 1 });
        toon('clink', undefined, { vol: 0.8 });
        comic('SEALED.', { x: W() * 0.5, y: H() * 0.16 }, 'big');
      });
      later(1000, () => { bump(inJar, 'press'); bubble('let me out', { x: W() * 0.5, y: H() * 0.3 }); });
    }
    /* The sand rakes itself into a smiley. */
    function winSmiley() {
      const cx = 0.5;
      const cy = 0.5;
      const ring = (r, a0, a1, n = 28) => Array.from({ length: n + 1 }, (_, k) => {
        const a = a0 + ((a1 - a0) * k) / n;
        return [cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r];
      });
      sand.shake(0.5);
      sand.cleanAll();
      blobs.forEach((o) => o.el.remove());
      const parts = [ring(0.42, 0, Math.PI), ring(0.42, Math.PI, Math.PI * 2), ring(0.06, 0, Math.PI * 2, 12).map(([x, y]) => [x - 0.09, y - 0.12]),
        ring(0.06, 0, Math.PI * 2, 12).map(([x, y]) => [x + 0.09, y - 0.12]), ring(0.24, 0.3, Math.PI - 0.3).map(([x, y]) => [x, y + 0.02])];
      parts.forEach((pts, k) => later(80 + k * 150, () => {
        sand.groove(pts, 2.2, 1.4);
        toon('scratch', undefined, { rate: 0.8 + k * 0.1 });
      }));
      later(820, () => { toon('gong', undefined, { vol: 0.8 }); comic(':)', at(0.5, 0.2), 'big'); });
      later(1100, () => bubble('ok fine', mid(stink, 0.6, 0.1)));
    }
    /* The zoomies. */
    function winZoomies() {
      flashSpeed('gold');
      comic('ZOOMIES!', { x: W() * 0.5, y: H() * 0.3 }, 'big');
      for (let k = 0; k < 7; k++) {
        later(k * 120, () => {
          const x = rnd(0.15, 0.85);
          const y = rnd(0.2, 0.85);
          scratch(x + rnd(-0.1, 0.1), Math.min(0.98, y + 0.2), x, y, () => { sand.pile(x, y, 4, 2); spray(at(x, y), 8, 1.6); splat(1); }, 120);
        });
      }
      later(150, () => {
        toon('vroom', undefined, { vol: 0.9, rate: 1.4 });
        box.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 700, easing: 'cubic-bezier(.5,0,.5,1)' });
        stink.classList.add('dizzy');
      });
      later(1000, () => bubble('brb', mid(stink, 0.5, 0.1)));
    }

    /* ---------------- misses: the room gets stinky ---------------- */

    /* What's still out floats up at the camera, and the fog rolls in. */
    function stinkUp(stay = false) {
      let out = blobs.filter((o) => o.state !== 'buried');
      if (!out.length) out = [0.3, 0.5, 0.7].map((x, k) => sprout(k, null)).map((o, k) => { o.x = [0.3, 0.5, 0.7][k]; size(o); return o; });
      out.forEach((o, k) => later(k * 70, () => {
        o.el.classList.remove('half', 'dusty');
        if (!stay) o.el.classList.add('rise');
        toon('blorp', undefined, { vol: 0.7, rate: 0.8 + k * 0.15 });
      }));
      stink.classList.add('smug');
      later(120, () => {
        fog.classList.add(stay ? 'some' : 'on');
        toon('fog', undefined, { vol: 0.9 });
        sing(true, 400);
      });
    }
    /* Zoom out: the room, the house, the town, the planet. All of it, green. */
    function failEarth() {
      const z = h('div', 'lb-zoom');
      z.innerHTML = ZOOM; // fixed markup
      later(380, () => {
        stage.append(z);
        const g = z.querySelector('.lb-z');
        g.animate([{ transform: 'scale(343)' }, { transform: 'scale(49)' }, { transform: 'scale(7)' }, { transform: 'scale(1)' }],
          { duration: 1000, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'forwards' });
        z.querySelectorAll('.z-gas').forEach((c, k) => c.animate([{ opacity: 0, transform: 'scale(.3)' }, { opacity: 0.6, transform: 'scale(1)' }],
          { duration: 360, delay: k * 280, easing: 'ease-out', fill: 'forwards' }));
        toon('whistle-down', undefined, { vol: 0.8 });
      });
      later(420, () => bubble('the room', { x: W() * 0.5, y: H() * 0.2 }));
      later(700, () => bubble('the house', { x: W() * 0.5, y: H() * 0.2 }));
      later(980, () => bubble('the town', { x: W() * 0.5, y: H() * 0.2 }));
      later(1300, () => {
        z.classList.add('ew');
        toon('raspberry', undefined, { vol: 0.9 });
        comic('THE PLANET.', { x: W() * 0.5, y: H() * 0.18 }, 'big bad');
      });
      later(1550, () => bubble('ew.', { x: W() * 0.5, y: H() * 0.42 }));
    }
    /* The houseplant on the floor faints. */
    function failPlant() {
      later(350, () => {
        plant.classList.add('faint');
        toon('slide-down', undefined, { vol: 0.9 });
        punch(mid(plant), 1.25, 900);
      });
      later(700, () => comic('*faints*', mid(plant, 0.5, -0.2), 'hit'));
      later(1100, () => bubble('worth it', mid(stink, 0.6, 0.1)));
    }
    /* The screen peels off like a sticker, and there's nothing behind it but green. */
    function failPeel() {
      later(300, () => {
        stage.classList.add('peel');
        toon('zip', undefined, { vol: 0.9 });
      });
      later(560, () => comic('PEELING.', { x: W() * 0.5, y: H() * 0.3 }, 'big bad'));
      later(900, () => {
        cam.animate([{ translate: '0 0', rotate: '0deg' }, { translate: '6% 140%', rotate: '24deg' }], { duration: 600, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' });
        glass.replaceChildren();
        fog.classList.add('on');
        toon('slide-down', undefined, { vol: 0.8 });
      });
      later(1300, () => bubble('nice.', { x: W() * 0.5, y: H() * 0.45 }));
    }
    /* A fly in a tuxedo arrives and conducts the stinklets. They sing. */
    function failFly() {
      const f = h('div', 'lb-fly');
      f.innerHTML = FLY; // fixed markup
      cam.append(f);
      toon('buzz', undefined, { vol: 1 });
      const p = at(0.5, 0.22);
      f.animate([
        { left: `${W() * 1.1}px`, top: `${H() * 0.1}px` }, { left: `${W() * 0.7}px`, top: `${H() * 0.35}px`, offset: 0.4 },
        { left: `${W() * 0.6}px`, top: `${H() * 0.1}px`, offset: 0.7 }, { left: `${p.x}px`, top: `${p.y}px` },
      ], { duration: 520, easing: 'ease-in-out', fill: 'forwards' });
      later(560, () => {
        f.classList.add('conduct');
        blobs.forEach((o) => o.el.classList.add('choir'));
        toon('choir', undefined, { vol: 1 });
        bubble('aaaaah', at(0.5, 0.45));
      });
      later(1150, () => { f.classList.remove('conduct'); bump(f, 'bow'); comic('bravo.', at(0.5, 0.15), 'hit'); });
    }
    /* Mookie just walks away. Not his problem. */
    function failStroll() {
      pawPath([{ to: { x: W() * 0.62, y: H() * 1.4 }, ms: 260, ease: 'in' }]);
      later(320, () => {
        const t = h('div', 'lb-tail');
        t.innerHTML = TAIL; // fixed markup
        cam.append(t);
        toon('tiptoe', undefined, { vol: 0.8 });
        later(220, () => toon('tiptoe', undefined, { vol: 0.8, rate: 1.2 }));
        later(440, () => toon('tiptoe', undefined, { vol: 0.8 }));
      });
      later(520, () => bubble('not my problem.', { x: W() * 0.5, y: H() * 0.86 }));
      later(1000, () => { blobs.forEach((o) => o.el.classList.add('party')); toon('fanfare', undefined, { vol: 0.5 }); comic('...', at(0.5, 0.3), 'hit'); });
    }

    /* ---------------- boss ---------------- */

    /* Mookie sits on it. */
    function bossKO() {
      armsLeft.splice(0).forEach((k, n) => later(n * 120, () => arms.querySelector(`.a${k}`)?.classList.add('gone')));
      const m = rigMookie();
      m.el.classList.add('lb-sit');
      cam.append(m.el);
      mookieBig = m;
      m.mood('smug');
      later(300, () => {
        m.el.classList.add('down');
        toon('whistle-down', undefined, { vol: 0.9 });
      });
      later(700, () => {
        stink.classList.add('squish');
        toon('thud', undefined, { vol: 1 });
        toon('raspberry', undefined, { vol: 0.9 });
        punch(mid(stink), 1.15, 500);
        spray(mid(stink, 0.5, 0.8), 16, 2);
        splat(4);
        comic('SQUISH.', { x: W() * 0.5, y: H() * 0.2 }, 'big');
        m.mood('happy');
      });
      later(1150, () => { m.mood('purr'); bubble('mine.', mid(m.el, 0.5, 0.05)); toon('fanfare', undefined, { vol: 0.8 }); });
    }
    /* The Big Stink takes over the screen. */
    function bossLose() {
      fog.classList.add('on');
      toon('fog', undefined, { vol: 1 });
      later(200, () => {
        stink.classList.add('huge');
        sing(true, 900);
        toon('raspberry', undefined, { vol: 1 });
      });
      later(700, () => comic('MINE NOW.', { x: W() * 0.5, y: H() * 0.25 }, 'big bad'));
      later(1100, () => pawPath([{ to: { x: W() * 0.62, y: H() * 1.4 }, ms: 300, ease: 'in' }]));
    }
  },
};
