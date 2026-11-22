/* Drums, cymbals and their stands, drawn as you see them from where you play: from above and
   in front. A small camera looks down at the instrument at a slant; the world is measured in
   inches (x to the right, y away from you, z up from the floor) and drawn without
   perspective, so every drum keeps its true size wherever it stands, and a round head is an
   ellipse whose height shows how far it is tipped toward you. Used by the drum set, the
   timpani, the orchestra's percussion and the hand drums. */

import { metal, sheen, lathe, head as skin, wood, pool, rand, tint, mix, pattern, place, bar, RES, TAU } from './paint.js';

/* ---------- the camera ---------- */

/* Looking down at tilt radians below level (0: straight from the front, π/2: from above). */
export function camera(tilt) {
  const s = Math.sin(tilt);
  const c = Math.cos(tilt);
  const cam = {
    tilt, s, c, k: 1, ox: 0, oy: 0,
    X: (x) => cam.ox + x * cam.k,
    Y: (y, z) => cam.oy - (y * s + z * c) * cam.k,
    at: (x, y, z) => [cam.ox + x * cam.k, cam.oy - (y * s + z * c) * cam.k],
    // how far from the eye, for drawing the far things first
    depth: (y, z) => y * c - z * s,
    /* A round face r across its middle, centred at (x, y, z), tipped toward you by phi from
       level: a drum head or a cymbal (phi a little), a bass drum's head standing up (π/2).
       Its outline is an ellipse rx by ry (q = ry / rx); a step of d inches along its axis,
       away from the face (down a drum's shell), moves it d * down pixels down the screen. */
    disc(x, y, z, r, phi = 0) {
      const [X, Y] = cam.at(x, y, z);
      const q = Math.sin(tilt + phi);
      return { X, Y, rx: r * cam.k, ry: r * cam.k * Math.abs(q), q: Math.abs(q), down: cam.k * Math.cos(tilt + phi), r, phi, k: cam.k, x, y, z };
    },
    /* A point on that face: h across (to the right) and v toward you, in radii. */
    onDisc(D, h, v, lift = 0) {
      const cp = Math.cos(D.phi);
      const sp = Math.sin(D.phi);
      // across the face: (1, 0, 0); up the face, away from you: (0, cos phi, sin phi); out of it: (0, -sin phi, cos phi)
      const x = D.x + h * D.r;
      const y = D.y - v * D.r * cp - lift * sp;
      const z = D.z - v * D.r * sp + lift * cp;
      return [x, y, z];
    },
    /* Fit what spans x0..x1 across and u0..u1 up the screen (u = y sin + z cos, in inches)
       into the box B, as big as it goes. */
    fit(x0, x1, u0, u1, B, most = Infinity) {
      cam.k = Math.min(B.w / (x1 - x0), B.h / (u1 - u0), most);
      cam.ox = B.x + (B.w - (x1 - x0) * cam.k) / 2 - x0 * cam.k;
      cam.oy = B.y + (B.h - (u1 - u0) * cam.k) / 2 + u1 * cam.k;
      return cam;
    },
  };
  return cam;
}

/* Something whose screen extent we collect, to fit it: the up (u) of a point. */
export function bounds() {
  const b = { x0: Infinity, x1: -Infinity, u0: Infinity, u1: -Infinity };
  b.add = (x, u) => {
    b.x0 = Math.min(b.x0, x);
    b.x1 = Math.max(b.x1, x);
    b.u0 = Math.min(b.u0, u);
    b.u1 = Math.max(b.u1, u);
    return b;
  };
  return b;
}

/* ---------- sprites: small pictures painted once ---------- */

export function sprite(s, key, w, h, paint) {
  if (!s.sprites) s.sprites = new Map();
  const full = `${key}|${Math.round(w)}x${Math.round(h)}@${s.dpr}`;
  let c = s.sprites.get(full);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * s.dpr));
    c.height = Math.max(1, Math.ceil(h * s.dpr));
    const g = c.getContext('2d');
    g.scale(s.dpr, s.dpr);
    paint(g);
    s.sprites.set(full, c);
    if (s.sprites.size > 80) s.sprites.delete(s.sprites.keys().next().value);
  }
  return c;
}

/* ---------- finishes ---------- */

/* Glitter in lacquer, as on a sparkle drum kit: flecks that catch the light. */
function sparkleTile(c, w, h) {
  const r = rand(77);
  for (let i = 0; i < 220; i++) {
    const x = r() * w;
    const y = r() * h;
    const sz = 0.25 + r() * r() * 1.1;
    const pick = r();
    c.fillStyle = pick < 0.45 ? '#FFFFFF' : pick < 0.7 ? '#FFD0D8' : pick < 0.88 ? '#FF7E92' : '#FFE2A0';
    c.globalAlpha = 0.2 + r() * 0.8;
    c.beginPath();
    c.arc(x, y, sz, 0, TAU);
    c.fill();
  }
}

/* Light across a round shell lit from the upper left: a gloss on the lit side, shade
   toward both edges. */
export function roundness(g, x0, x1, { gloss = 0.5, dark = 0.62 } = {}) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, `rgba(0,0,0,${dark})`);
  gr.addColorStop(0.07, `rgba(0,0,0,${dark * 0.4})`);
  gr.addColorStop(0.2, `rgba(255,255,255,${gloss * 0.12})`);
  gr.addColorStop(0.27, `rgba(255,255,255,${gloss * 0.7})`);
  gr.addColorStop(0.31, `rgba(255,255,255,${gloss * 0.22})`);
  gr.addColorStop(0.42, 'rgba(255,255,255,0)');
  gr.addColorStop(0.66, `rgba(0,0,0,${dark * 0.22})`);
  gr.addColorStop(0.86, `rgba(0,0,0,${dark * 0.62})`);
  gr.addColorStop(0.95, `rgba(0,0,0,${dark * 0.85})`);
  gr.addColorStop(1, `rgba(0,0,0,${dark * 0.55})`);
  return gr;
}

/* Fill the current path with a finish: { kind: 'sparkle' | 'lacquer' | 'wood', color, wood }. */
export function finish(g, f, x0, x1, y0, y1) {
  const kind = f.kind || 'lacquer';
  if (kind === 'wood') {
    g.fillStyle = wood(g, f.wood || 'maple', { x: x0, y: y0, angle: f.angle ?? 90, scale: f.scale ?? 0.6, seed: f.seed || 1 });
    g.fill();
    if (f.color) {
      g.save();
      g.globalAlpha = f.stain ?? 0.35;
      g.fillStyle = f.color;
      g.fill();
      g.restore();
    }
  } else if (kind === 'metal') {
    g.fillStyle = metal(g, f.metal || 'chrome', x0, 0, x1, 0);
    g.fill();
    return;
  } else {
    const base = f.color || '#7A1424';
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, tint(base, 0.08));
    gr.addColorStop(1, tint(base, -0.18));
    g.fillStyle = gr;
    g.fill();
    if (kind === 'sparkle') {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.42;
      g.fillStyle = place(pattern(g, 'sparkle', 64, 64, sparkleTile), x0, y0, 0, f.scale ?? 1);
      g.fill();
      g.restore();
    }
  }
  g.fillStyle = roundness(g, x0, x1, { gloss: f.gloss ?? 0.5 });
  g.fill();
}

/* ---------- drum parts ---------- */

/* The side of a cylinder seen from above: between the face at (X, Y) and the same face h
   pixels down the screen (or up, h < 0, as the shell of a bass drum lying down goes away). */
export function shellPath(g, X, Y, R, q, h) {
  g.beginPath();
  g.moveTo(X - R, Y);
  g.lineTo(X - R, Y + h);
  if (h >= 0) {
    g.ellipse(X, Y + h, R, R * q, 0, Math.PI, 0, true);
    g.lineTo(X + R, Y);
    g.ellipse(X, Y, R, R * q, 0, 0, Math.PI, false);
  } else {
    g.ellipse(X, Y + h, R, R * q, 0, Math.PI, TAU, false);
    g.lineTo(X + R, Y);
    g.ellipse(X, Y, R, R * q, 0, TAU, Math.PI, true);
  }
  g.closePath();
}

/* A ring: the band of a hoop between Y and Y + h, seen on its near side. kind: a metal, or a
   finish (a wooden hoop, as a bass drum's, with a strip of inlay round it). */
export function ringBand(g, X, Y, R, q, h, kind = 'chrome') {
  shellPath(g, X, Y, R, q, h);
  if (typeof kind === 'object') {
    finish(g, kind, X - R, X + R, Math.min(Y, Y + h) - R * q, Math.max(Y, Y + h) + R * q);
    if (kind.inlay) {
      g.save();
      g.clip();
      g.strokeStyle = kind.inlay;
      g.lineWidth = Math.abs(h) * 0.22;
      g.beginPath();
      if (h >= 0) g.ellipse(X, Y + h * 0.5, R, R * q, 0, 0, Math.PI, false);
      else g.ellipse(X, Y + h * 0.5, R, R * q, 0, TAU, Math.PI, true);
      g.stroke();
      g.fillStyle = roundness(g, X - R, X + R, { gloss: 0.3, dark: 0.4 });
      g.fillRect(X - R, Math.min(Y, Y + h) - R * q, R * 2, Math.abs(h) + R * q * 2);
      g.restore();
    }
    return;
  }
  g.fillStyle = metal(g, kind, X - R, 0, X + R, 0);
  g.fill();
  // a shadow along its lower edge and a bright line along its top
  g.save();
  g.clip();
  g.lineWidth = Math.max(0.8, Math.abs(h) * 0.22);
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.beginPath();
  if (h >= 0) g.ellipse(X, Y + h, R, R * q, 0, Math.PI, 0, true);
  else g.ellipse(X, Y + h, R, R * q, 0, Math.PI, TAU, false);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.45)';
  g.lineWidth = Math.max(0.6, Math.abs(h) * 0.12);
  g.beginPath();
  if (h >= 0) g.ellipse(X, Y, R, R * q, 0, 0, Math.PI, false);
  else g.ellipse(X, Y, R, R * q, 0, TAU, Math.PI, true);
  g.stroke();
  g.restore();
}

/* The top of a hoop: a flat ring from r0 to r1. */
export function flange(g, X, Y, r0, r1, q, kind = 'chrome') {
  g.beginPath();
  g.ellipse(X, Y, r1, r1 * q, 0, 0, TAU);
  g.ellipse(X, Y, r0, r0 * q, 0, 0, TAU, true);
  if (typeof kind === 'object') {
    const gr = g.createLinearGradient(X - r1, Y - r1 * q, X + r1 * 0.6, Y + r1 * q);
    gr.addColorStop(0, tint(kind.color || '#6E1020', 0.25));
    gr.addColorStop(0.5, kind.color || '#6E1020');
    gr.addColorStop(1, tint(kind.color || '#6E1020', -0.4));
    g.fillStyle = gr;
    g.fill();
    if (kind.kind === 'sparkle') {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35;
      g.fillStyle = place(pattern(g, 'sparkle', 64, 64, sparkleTile), X, Y, 0, 1);
      g.fill();
      g.restore();
    }
  } else {
    g.fillStyle = metal(g, kind, X - r1, Y - r1 * q * 2, X + r1 * 0.7, Y + r1 * q * 2);
    g.fill();
  }
  g.lineWidth = Math.max(0.6, (r1 - r0) * 0.25);
  g.strokeStyle = 'rgba(0,0,0,.3)';
  g.beginPath();
  g.ellipse(X, Y, r0, r0 * q, 0, 0, TAU);
  g.stroke();
}

/* Where angle a (around the face; a = 3π/2 is nearest you) lands on an ellipse. */
const around = (X, Y, R, q, a) => [X + R * Math.cos(a), Y - R * q * Math.sin(a)];

/* The lugs on a shell's near side (and the tension rods that come down to them). */
export function lugs(g, X, Y, R, q, h, n, { k = 1, a0 = 0, kind = 'chrome', length = 0.3, at = 0.5, rod = 0, w = 0.55, style = 'tube' } = {}) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU + Math.PI / 2;
    const facing = h >= 0 ? -Math.sin(a) : Math.sin(a);
    if (facing < 0.04) continue;
    items.push([a, facing]);
  }
  // the ones toward the edges first, so the ones facing you sit on top
  items.sort((p, q2) => p[1] - q2[1]);
  for (const [a, facing] of items) {
    const [px, py] = around(X, Y, R + 0.3 * k, q, a);
    const lw = w * k * (0.3 + 0.7 * facing);
    const y0 = py + h * (at - length / 2);
    const y1 = py + h * (at + length / 2);
    const top = Math.min(y0, y1);
    const bot = Math.max(y0, y1);
    if (rod) {
      // the rod from the hoop down to the lug
      const ry = h >= 0 ? py : py;
      const rx = px;
      g.strokeStyle = 'rgba(0,0,0,.35)';
      g.lineWidth = rod * k * 1.6;
      g.beginPath();
      g.moveTo(rx + 1, ry);
      g.lineTo(rx + 1, h >= 0 ? top : bot);
      g.stroke();
      g.strokeStyle = metal(g, kind, rx - rod * k, 0, rx + rod * k, 0);
      g.lineWidth = rod * k;
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx, h >= 0 ? top : bot);
      g.stroke();
    }
    // shadow on the shell, to the lower right
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath();
    g.roundRect(px - lw / 2 + lw * 0.35, top + lw * 0.25, lw, bot - top, lw / 2);
    g.fill();
    g.fillStyle = metal(g, kind, px - lw / 2, 0, px + lw / 2, 0);
    g.beginPath();
    if (style === 'tube') g.roundRect(px - lw / 2, top, lw, bot - top, lw / 2);
    else g.ellipse(px, (top + bot) / 2, lw / 2, (bot - top) / 2, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)';
    g.lineWidth = 0.6;
    g.stroke();
  }
}

/* The heads of the tension rods, on the hoop, all the way round. */
export function rodHeads(g, X, Y, R, q, n, { k = 1, a0 = 0, size = 0.32, kind = 'chrome', ears = true } = {}) {
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU + Math.PI / 2;
    const [px, py] = around(X, Y, R, q, a);
    const s = size * k;
    if (ears) {
      g.fillStyle = metal(g, kind, px - s * 1.4, py - s, px + s * 1.4, py + s);
      g.beginPath();
      g.ellipse(px, py, s * 1.25, s * 1.25 * Math.max(0.5, q), 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.beginPath();
    g.ellipse(px + s * 0.2, py + s * 0.25, s * 0.75, s * 0.75 * Math.max(0.5, q), 0, 0, TAU);
    g.fill();
    g.fillStyle = metal(g, kind, px - s, py - s, px + s, py + s);
    g.beginPath();
    g.ellipse(px, py, s * 0.7, s * 0.7 * Math.max(0.5, q), 0, 0, TAU);
    g.fill();
  }
}

/* A drum head seen at a slant. */
export function face(g, X, Y, r, q, kind = 'coated', light = 1) {
  g.save();
  g.translate(X, Y);
  g.scale(1, q);
  skin(g, 0, 0, r, { kind, light });
  g.restore();
}

/* A whole drum from D = cam.disc(...) for its top head, its shell len inches long.
   look: { finish, lugs, rod, hoop, hoopW, hoopH, head, bottom, a0 } */
export function drum(g, D, len, look = {}) {
  const { X, Y, rx: R, q, k } = D;
  const h = len * D.down;
  const fin = look.finish || { kind: 'lacquer', color: '#7A1424' };
  const hoop = look.hoop || 'chrome';
  const w = (look.hoopW ?? 0.3) * k;
  const hh = (look.hoopH ?? 0.9) * D.down;
  const n = look.lugs ?? 8;
  // the shell
  shellPath(g, X, Y, R, q, h);
  finish(g, fin, X - R, X + R, Math.min(Y, Y + h) - R * q, Math.max(Y, Y + h) + R * q);
  // the hoop at the far end, holding the other head
  if (look.bottom !== false) ringBand(g, X, Y + h - Math.sign(h) * hh * 0.9, R + w * 0.5, q, Math.sign(h) * hh * 0.9, hoop);
  // the lugs and their rods
  if (n) {
    const deep = Math.abs(len) > 10;
    const opt = { k, a0: look.a0 || 0, kind: look.lugKind || 'chrome', w: look.lugW ?? 0.55, style: look.lugStyle || 'tube' };
    if (deep) {
      lugs(g, X, Y, R, q, h, n, { ...opt, at: 0.16, length: 0.12, rod: 0.16 });
      lugs(g, X, Y + h, R, q, -h, n, { ...opt, at: 0.16, length: 0.12, rod: 0.16 });
    } else {
      lugs(g, X, Y, R, q, h, n, { ...opt, at: 0.5, length: 0.42, rod: 0.16 });
    }
  }
  // the hoop at the top: its band, then the head inside it, then its flange
  ringBand(g, X, Y, R + w, q, hh, hoop);
  face(g, X, Y, R - w * 0.4, q, look.head || 'coated', look.light ?? 1);
  flange(g, X, Y, R - w * 0.4, R + w, q, hoop);
  if (n && look.rods !== false) rodHeads(g, X, Y, R + w * 0.75, q, n, { k, a0: look.a0 || 0, size: 0.26, ears: hoop !== 'wood' });
}

/* A soft ring spreading from where a head was struck: hx, hy in radii across the head. */
export function ripple(g, X, Y, rx, ry, hx, hy, age, { color = '110,70,30', life = 0.6, strength = 1 } = {}) {
  if (age < 0 || age > life) return;
  g.save();
  g.beginPath();
  g.ellipse(X, Y, rx * 0.96, ry * 0.96, 0, 0, TAU);
  g.clip();
  g.translate(X + hx * rx, Y + hy * ry);
  g.scale(1, ry / rx);
  for (let i = 0; i < 3; i++) {
    const t = age - i * 0.06;
    if (t < 0) continue;
    const a = 0.42 * strength * (1 - t / life);
    g.strokeStyle = `rgba(${color},${a})`;
    g.lineWidth = Math.max(1.5, rx * 0.025);
    g.beginPath();
    g.arc(0, 0, 3 + (t / life) * rx * 1.6, 0, TAU);
    g.stroke();
  }
  // the dent where it landed
  if (age < 0.12) {
    const a = (1 - age / 0.12) * 0.25 * strength;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx * 0.16);
    gr.addColorStop(0, `rgba(${color},${a})`);
    gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr;
    g.fillRect(-rx * 0.2, -rx * 0.2, rx * 0.4, rx * 0.4);
  }
  g.restore();
}

/* ---------- cymbals ---------- */

/* A cymbal: rx by ry, its bell standing lift pixels up the screen from its edge's centre.
   look: { bell (fraction of the radius), kind ('bronze'), hammer, felt (a stand's top through
   its hole), seed, dark (the underside, for a hi-hat's top cymbal seen from below) } */
export function cymbal(g, X, Y, rx, ry, look = {}) {
  const q = ry / rx;
  const bell = look.bell ?? 0.3;
  const lift = look.lift ?? 0;
  const kind = look.kind || 'bronze';
  g.save();
  g.translate(X, Y);
  // its edge has a thickness: a dark line under the near rim
  g.save();
  g.scale(1, q);
  g.beginPath();
  g.arc(0, Math.max(0.8, 1.2 / q), rx, 0, TAU);
  g.fillStyle = 'rgba(40,24,4,.85)';
  g.fill();
  // the bow, lathed
  g.beginPath();
  g.arc(0, 0, rx, 0, TAU);
  g.fillStyle = sheen(g, kind, 0, -lift / q * 0.5, rx, look.turn ?? -0.65);
  g.fill();
  g.save();
  g.clip();
  // the bow falls away from the bell: lighter toward the bell, darker at the far rim
  const fall = g.createRadialGradient(0, -lift / q, rx * bell, 0, 0, rx);
  fall.addColorStop(0, 'rgba(255,240,200,.18)');
  fall.addColorStop(0.55, 'rgba(255,240,200,0)');
  fall.addColorStop(1, 'rgba(60,30,0,.22)');
  g.fillStyle = fall;
  g.fillRect(-rx, -rx, rx * 2, rx * 2);
  lathe(g, 0, -lift / q * 0.35, rx * bell * 1.05, rx * 1.02, { step: Math.max(1.4, rx / 46), alpha: 0.13 });
  if (look.hammer !== false) {
    // hammer marks, a ring of little dents
    const r = rand(look.seed || 3);
    for (let i = 0; i < Math.round(rx * 0.9); i++) {
      const a = r() * TAU;
      const d = rx * (bell + 0.1 + r() * (0.86 - bell));
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d - lift / q * 0.35 * (1 - d / rx);
      const sz = rx * (0.018 + r() * 0.02);
      g.fillStyle = `rgba(60,34,0,${0.05 + r() * 0.07})`;
      g.beginPath();
      g.ellipse(x, y, sz * 1.5, sz, a, 0, TAU);
      g.fill();
      g.fillStyle = `rgba(255,244,210,${0.05 + r() * 0.06})`;
      g.beginPath();
      g.ellipse(x - sz * 0.4, y - sz * 0.4, sz * 0.9, sz * 0.55, a, 0, TAU);
      g.fill();
    }
  }
  g.restore();
  // the rim: bright on the upper left, a dark line round the rest
  g.lineWidth = Math.max(0.7, rx * 0.012);
  g.strokeStyle = 'rgba(70,40,4,.6)';
  g.beginPath();
  g.arc(0, 0, rx, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(255,248,220,.55)';
  g.beginPath();
  g.arc(0, 0, rx - g.lineWidth, Math.PI * 1.05, Math.PI * 1.6);
  g.stroke();
  // the bell: a dome, with a soft shadow where it meets the bow
  const by = -lift / q;
  const rb = rx * bell;
  const sh = g.createRadialGradient(rb * 0.15, by + rb * 0.2, rb * 0.8, rb * 0.15, by + rb * 0.2, rb * 1.35);
  sh.addColorStop(0, 'rgba(50,26,0,.35)');
  sh.addColorStop(1, 'rgba(50,26,0,0)');
  g.fillStyle = sh;
  g.beginPath();
  g.arc(rb * 0.15, by + rb * 0.2, rb * 1.35, 0, TAU);
  g.fill();
  const bl = g.createRadialGradient(-rb * 0.35, by - rb * 0.4, rb * 0.05, 0, by, rb);
  bl.addColorStop(0, '#FFF6D6');
  bl.addColorStop(0.35, '#EBC56A');
  bl.addColorStop(0.75, '#B88A2C');
  bl.addColorStop(1, '#8A6018');
  g.fillStyle = bl;
  g.beginPath();
  g.arc(0, by, rb, 0, TAU);
  g.fill();
  g.save();
  g.clip();
  lathe(g, 0, by, rb * 0.25, rb, { step: Math.max(1.2, rb / 9), alpha: 0.12 });
  g.restore();
  g.restore();
  // what holds it: felt and a wing nut on a stand, or a hole
  const cy = -lift;
  if (look.felt) {
    const f = rx * 0.07;
    g.fillStyle = '#2B2626';
    g.beginPath();
    g.ellipse(0, cy, f * 1.3, f * 1.3 * q, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#3A3536';
    g.beginPath();
    g.ellipse(0, cy - f * 0.3, f * 0.95, f * 0.95 * q, 0, 0, TAU);
    g.fill();
    // the wing nut
    g.fillStyle = metal(g, 'chrome', -f * 1.4, 0, f * 1.4, 0);
    g.beginPath();
    g.ellipse(-f * 0.6, cy - f * 0.75, f * 0.62, f * 0.36, -0.3, 0, TAU);
    g.ellipse(f * 0.6, cy - f * 0.75, f * 0.62, f * 0.36, 0.3, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(0, cy - f * 0.6, f * 0.34, f * 0.34 * Math.max(0.6, q), 0, 0, TAU);
    g.fill();
  } else if (look.hole !== false) {
    g.fillStyle = 'rgba(20,12,2,.85)';
    g.beginPath();
    g.ellipse(0, cy, rx * 0.025 + 0.8, (rx * 0.025 + 0.8) * q, 0, 0, TAU);
    g.fill();
  }
  g.restore();
}

/* ---------- stands and sticks ---------- */

/* A chrome stand from the floor up to z1 at (x, y): a tripod, a thick tube, a thinner one. */
export function stand(g, cam, x, y, z1, { z0 = 0, legs = 3, spread = 11, base = 10, w = 0.9, top = 0.62, joint = 0.6, turn = 0, kind = 'silver', foot = true } = {}) {
  const k = cam.k;
  const [cx, cy] = cam.at(x, y, z0 + base);
  const feet = [];
  for (let i = 0; i < legs; i++) {
    const b = turn + Math.PI / 2 + (i / legs) * TAU;
    feet.push([b, cam.at(x + Math.cos(b) * spread, y + Math.sin(b) * spread, z0)]);
  }
  // the legs farthest from you first
  feet.sort((p, q) => Math.sin(q[0]) - Math.sin(p[0]));
  const [, yb] = cam.at(x, y, z0 + base * 0.35);
  for (const [b, [fx, fy]] of feet) {
    // a brace from partway up the tube to partway down the leg
    const mx = cx + (fx - cx) * 0.5;
    const my = cy + (fy - cy) * 0.5;
    bar(g, cx, yb, mx, my, Math.max(1, w * 0.32 * k), kind);
    bar(g, cx, cy, fx, fy, Math.max(1.4, w * 0.62 * k), kind);
    if (foot) {
      g.fillStyle = '#16120F';
      g.beginPath();
      g.ellipse(fx, fy, Math.max(1.6, w * 0.7 * k), Math.max(1, w * 0.45 * k), b, 0, TAU);
      g.fill();
    }
  }
  const zj = z0 + base + (z1 - z0 - base) * joint;
  const [, yj] = cam.at(x, y, zj);
  const [, yt] = cam.at(x, y, z1);
  bar(g, cx, cy + w * k * 0.4, cx, yj, Math.max(1.8, w * k), kind);
  bar(g, cx, yj, cx, yt, Math.max(1.4, top * k), kind);
  // the clamp at the joint, with its wing bolt
  const cw = w * k * 1.5;
  g.fillStyle = metal(g, 'chrome', cx - cw, 0, cx + cw, 0);
  g.beginPath();
  g.roundRect(cx - cw / 2, yj - cw * 0.35, cw, cw * 0.8, cw * 0.2);
  g.fill();
  g.fillStyle = metal(g, 'chrome', cx + cw * 0.4, yj - cw * 0.4, cx + cw * 1.2, yj + cw * 0.4);
  g.beginPath();
  g.ellipse(cx + cw * 0.85, yj + cw * 0.05, cw * 0.4, cw * 0.22, 0.4, 0, TAU);
  g.fill();
  return { x: cx, top: yt, joint: yj };
}

/* A drumstick from its tip (x0, y0) toward its butt (x1, y1), w pixels thick. */
export function stick(g, x0, y0, x1, y1, w, { alpha = 1, color = '#D8AE74', tip = 'wood' } = {}) {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  const nx = -uy;
  const ny = ux;
  const at = (f, half) => [x0 + ux * len * f + nx * half, y0 + uy * len * f + ny * half];
  const prof = [[0.02, 0.28], [0.06, 0.2], [0.1, 0.24], [0.3, 0.42], [0.5, 0.5], [1, 0.5]];
  g.save();
  g.globalAlpha *= alpha;
  // shadow
  g.beginPath();
  prof.forEach(([f, h2], i) => {
    const [x, y] = at(f, h2 * w);
    if (i) g.lineTo(x + w * 0.5, y + w * 0.8);
    else g.moveTo(x + w * 0.5, y + w * 0.8);
  });
  for (let i = prof.length - 1; i >= 0; i--) {
    const [x, y] = at(prof[i][0], -prof[i][1] * w);
    g.lineTo(x + w * 0.5, y + w * 0.8);
  }
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.fill();
  g.beginPath();
  prof.forEach(([f, h2], i) => {
    const [x, y] = at(f, h2 * w);
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  });
  for (let i = prof.length - 1; i >= 0; i--) {
    const [x, y] = at(prof[i][0], -prof[i][1] * w);
    g.lineTo(x, y);
  }
  g.closePath();
  const gr = g.createLinearGradient(x0 + nx * w * 0.5, y0 + ny * w * 0.5, x0 - nx * w * 0.5, y0 - ny * w * 0.5);
  gr.addColorStop(0, tint(color, -0.45));
  gr.addColorStop(0.3, tint(color, 0.35));
  gr.addColorStop(0.55, color);
  gr.addColorStop(1, tint(color, -0.4));
  g.fillStyle = gr;
  g.fill();
  // the bead at the tip
  const [bx, by] = at(0.025, 0);
  g.beginPath();
  g.ellipse(bx, by, w * 0.42, w * 0.3, Math.atan2(uy, ux), 0, TAU);
  g.fillStyle = tip === 'nylon' ? '#F4F1EA' : tint(color, 0.1);
  g.fill();
  g.restore();
}

/* ---------- floors ---------- */

/* A stage floor of planks running away from you, seen from above. */
export function planks(g, W, H, cam, { kind = 'oak', width = 5, tone = -0.35, seed = 1, run = 1, top = 0 } = {}) {
  const k = cam.k;
  const pw = width * k;
  const r = rand(seed);
  const x0 = cam.ox - Math.ceil(cam.ox / pw) * pw;
  g.save();
  for (let x = x0, i = 0; x < W; x += pw, i++) {
    g.fillStyle = wood(g, kind, { x, y: 0, angle: 90, scale: Math.max(0.35, k / 12), seed: i * 7 + seed });
    g.fillRect(x, top, pw + 0.5, H - top);
    // each plank a little different
    const v = r() - 0.5;
    g.fillStyle = v > 0 ? `rgba(255,236,200,${v * 0.16})` : `rgba(0,0,0,${-v * 0.3})`;
    g.fillRect(x, top, pw, H - top);
    // butt joints
    let y = top - r() * 300 * run;
    while (y < H) {
      y += (60 + r() * 50) * k * 0.6 * run;
      if (y < top) continue;
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(x, y, pw, Math.max(1, k * 0.12 * Math.min(1, run * 2)));
    }
    // the gap between planks
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.fillRect(x, top, Math.max(1, k * 0.12), H - top);
  }
  // stage lighting: darker away from the middle
  g.fillStyle = `rgba(0,0,0,${-tone})`;
  g.fillRect(0, top, W, H - top);
  g.restore();
}

/* The back of a stage seen from the front: a velvet curtain hanging in folds down to the
   floor at screen height y, and the floor's planks in front of it. */
export function backdrop(g, W, H, y, cam, { color = '#5A1218', kind = 'walnut', fold = 0 } = {}) {
  const f = fold || Math.max(30, Math.min(W, H) / 9);
  const base = color;
  for (let x = -f; x < W + f; x += f) {
    const gr = g.createLinearGradient(x, 0, x + f, 0);
    gr.addColorStop(0, tint(base, -0.55));
    gr.addColorStop(0.3, tint(base, 0.12));
    gr.addColorStop(0.45, tint(base, 0.22));
    gr.addColorStop(0.7, tint(base, -0.2));
    gr.addColorStop(1, tint(base, -0.55));
    g.fillStyle = gr;
    g.fillRect(x, 0, f + 0.5, y);
  }
  // the folds catch less light toward the top
  const v = g.createLinearGradient(0, 0, 0, y);
  v.addColorStop(0, 'rgba(0,0,0,.6)');
  v.addColorStop(0.6, 'rgba(0,0,0,.15)');
  v.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, y);
  planks(g, W, H, cam, { kind, width: 6, tone: -0.3, seed: 3, run: Math.max(0.08, cam.s), top: y });
  // where the curtain meets the floor, a soft shadow
  const sh = g.createLinearGradient(0, y, 0, y + Math.max(8, cam.k * 3));
  sh.addColorStop(0, 'rgba(0,0,0,.55)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh;
  g.fillRect(0, y, W, Math.max(8, cam.k * 3));
}

/* A mat woven from strips of palm leaf, each about an inch wide, over one and under the next,
   lying on the floor at 45 degrees and seen at the camera's tilt: what the world's hand drums
   stand on. k: pixels to the inch; (x, y): where the light falls. */
export function mat(g, W, H, { k = 20, tilt = Math.PI / 3, x = W / 2, y = H / 2, light = 0.12, dark = 0.6, dim = 0.36 } = {}) {
  const p = pattern(g, 'mat', 120, 120, paintMat);
  const pitch = Math.max(15, Math.min(46, k * 1.05));
  p.setTransform?.(new DOMMatrix().translateSelf(x, y).scaleSelf(1, Math.max(0.2, Math.sin(tilt))).rotateSelf(45).scaleSelf(pitch / 30 / RES));
  g.save();
  g.fillStyle = p;
  g.fillRect(0, 0, W, H);
  g.fillStyle = `rgba(24,14,4,${dim})`;
  g.fillRect(0, 0, W, H);
  g.restore();
  spot(g, W, H, x, y, Math.max(W, H) * 0.75, { light, dark });
}

/* One tile of the mat: four strips each way, 30 pixels apart. */
function paintMat(c, w, h) {
  const n = 4;
  const P = w / n;
  const gap = P * 0.09;
  const half = (P - gap) / 2;
  const r = rand(23);
  // the straw of each strip, each a little different: paler, greener or browner
  const straw = () => {
    const v = r();
    return mix('#D8B97C', v < 0.35 ? '#BE9552' : v < 0.7 ? '#E4CD98' : '#CDB173', 0.3 + r() * 0.6);
  };
  const across = Array.from({ length: n }, straw);
  const down = Array.from({ length: n }, straw);
  c.fillStyle = '#21160A';
  c.fillRect(0, 0, w, h);
  /* A strip's piece over one crossing: from where it comes up from under one strip to where it
     dives under the next. horiz: it runs across; under: it is the one beneath here. */
  const piece = (i, j, horiz, under) => {
    const col = horiz ? across[j] : down[i];
    c.save();
    if (horiz) c.translate(i * P, j * P + P / 2);
    else { c.translate(i * P + P / 2, j * P); c.rotate(Math.PI / 2); }
    if (under) {
      c.fillStyle = tint(col, -0.5);
      c.fillRect(-0.5, -half, P + 1, half * 2);
      c.restore();
      return;
    }
    // along it: dark where it bends under its neighbours, light where it rides over
    const gr = c.createLinearGradient(0, 0, P, 0);
    gr.addColorStop(0, tint(col, -0.46));
    gr.addColorStop(0.16, tint(col, -0.12));
    gr.addColorStop(0.45, tint(col, 0.08));
    gr.addColorStop(0.84, tint(col, -0.12));
    gr.addColorStop(1, tint(col, -0.46));
    c.fillStyle = gr;
    c.fillRect(-0.5, -half, P + 1, half * 2);
    // across it: a leaf strip is a little cupped, lit on one side
    const ac = c.createLinearGradient(0, -half, 0, half);
    ac.addColorStop(0, 'rgba(255,244,210,.22)');
    ac.addColorStop(0.25, 'rgba(255,244,210,0)');
    ac.addColorStop(0.7, 'rgba(0,0,0,0)');
    ac.addColorStop(1, 'rgba(0,0,0,.32)');
    c.fillStyle = ac;
    c.fillRect(0, -half, P, half * 2);
    // the leaf's veins, running along it
    for (let f = 0; f < 10; f++) {
      const yy = -half + ((f + 0.5 + (r() - 0.5) * 0.7) / 10) * half * 2;
      c.strokeStyle = r() < 0.6 ? `rgba(92,62,24,${0.18 + r() * 0.25})` : `rgba(255,246,220,${0.12 + r() * 0.2})`;
      c.lineWidth = 0.3 + r() * 0.5;
      c.beginPath();
      c.moveTo(0, yy);
      c.lineTo(P, yy + (r() - 0.5) * 0.9);
      c.stroke();
    }
    // now and then a split in the leaf
    if (r() < 0.3) {
      const yy = (r() - 0.5) * half * 1.4;
      const x0 = r() * P * 0.6;
      c.strokeStyle = 'rgba(40,26,8,.45)';
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(x0, yy);
      c.lineTo(x0 + P * (0.2 + r() * 0.3), yy + (r() - 0.5));
      c.stroke();
    }
    c.restore();
  };
  // plain weave: across strips on top where i + j is even, the others where it is odd
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) piece(i, j, (i + j) % 2 === 1, true);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) piece(i, j, (i + j) % 2 === 0, false);
}

/* A soft spotlight and the dark around it. */
export function spot(g, W, H, x, y, r, { light = 0.18, dark = 0.55 } = {}) {
  const gr = g.createRadialGradient(x, y, r * 0.1, x, y, r);
  gr.addColorStop(0, `rgba(255,236,200,${light})`);
  gr.addColorStop(0.55, 'rgba(255,236,200,0)');
  gr.addColorStop(1, `rgba(0,0,0,${dark})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}

/* A shadow on the floor under something, rx by ry. */
export function shade(g, x, y, rx, ry, alpha = 0.45) {
  pool(g, x, y, rx, '#000000', alpha, ry / rx);
}
