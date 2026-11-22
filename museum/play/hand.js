/* Hand percussion from around the world: congas, bongos, agogô, cowbell, claves, güiro,
   shaker, cabasa, log drum and sleigh bells (the kalimba is in kalimba.js). Each is a solid
   model at its real size (solid.js), lit from the upper left and resting on a woven palm-leaf
   mat, seen from where its player stands.
   Each exhibit lists its parts (opts.parts): a sound from /assets/sounds/ and a shape.
   Tap a drum or bell; a drum is fullest in the middle, a bell near its open end. Scrape the
   güiro along its ridges, and the faster you scrape the brighter it rasps. Shake the shaker,
   cabasa or sleigh bells by moving a finger back and forth on them (or tap). On a computer,
   the letters on each part play it. */

import { surface, label, fine } from '../surface.js';
import { hit } from '../audio.js';
import { layer, put, wood, rand, pattern, place, TAU } from '../paint.js';
import { face, ripple, stick, mat } from '../drums.js';
import { view, turned, tube, loft, flat, render, norm, add, sub, mul, dot, cross, across, moved, LIGHT, picture, show, extent, shadow } from '../solid.js';
import { tines } from './kalimba.js';

/* How each shape is played: struck once, shaken (each change of direction sounds), or scraped. */
const HOW = { drum: 'strike', bongo: 'strike', bell: 'strike', agogo: 'strike', claves: 'strike', slit: 'strike', guiro: 'scrape', shaker: 'shake', cabasa: 'shake', sleigh: 'shake' };
const KEYS = 'fjdksla;';
const rad = (d) => (d * Math.PI) / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

/* What metal sees of the mat below it, and some materials. */
const STRAW = '#B8955A';
const CHROME = { kind: 'metal', ramp: 'chrome', rough: 0.1, floor: STRAW };
const STEEL = { kind: 'metal', ramp: 'steel', rough: 0.28, floor: STRAW };
const SATIN = { kind: 'metal', ramp: 'chrome', rough: 0.42, floor: STRAW };
const RUBBER = { kind: 'paint', color: '#1C1B1A', amb: 0.42, gloss: 0.16, shine: 12 };

export async function mount(stage, ex, kit) {
  const o = ex.opts;
  if (o.tines) return tines(stage, ex, kit);
  const parts = o.parts.map((p, i) => ({ ...p, key: KEYS[i], at: 0, power: 0, x: 0, y: 0, hold: null, let: null, tip: null, auto: null }));
  const sounds = Object.fromEntries(await Promise.all([...new Set(parts.map((p) => p.sound))].map(async (n) => [n, await hit(n)])));
  const shape = parts[0].shape;

  const box = document.createElement('div');
  box.className = `zone hand ${shape}`;
  stage.append(box);

  let G = null;
  function geom(s) {
    const key = `${shape}:${s.W}x${s.H}`;
    if (G?.key !== key) G = { key, ...SCENES[shape](s, parts) };
    return G;
  }

  // Each part's letter in lessons.js: x for a single instrument, h and l for a high and low pair.
  const code = (i) => (parts.length === 1 ? 'x' : 'hl'[i]);

  function strike(i, d = 0.3, x = 0, y = 0, power = null) {
    const p = parts[i];
    // nearer the middle of a drum is fuller; a bell rings best near its open end
    const vel = power ?? Math.max(0.2, 1 - d * 0.6);
    sounds[p.sound].play({ vol: 0.45 + 0.5 * vel, rate: (p.rate || 1) * (0.99 + Math.random() * 0.02) });
    Object.assign(p, { at: performance.now(), power: vel, x, y });
    s.animate(1000);
    kit.hit(code(i));
  }

  function scrape(i, long = false, vol = 0.7) {
    const part = parts[i];
    sounds[part.sound].play({ vol, rate: long ? 0.8 : 1.2 });
    const now = performance.now();
    Object.assign(part, { at: now, power: 0.8, auto: { at: now, long } });
    s.animate(long ? 1000 : 700);
    kit.hit(code(i), { scrape: true });
  }

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p) {
      const h = geom(s).hit(p.u, p.v);
      if (!h) return;
      p.data.part = h.i;
      p.data.dir = 0;
      p.data.travel = 0;
      const part = parts[h.i];
      const how = HOW[part.shape];
      if (how === 'shake') {
        part.hold = { u: p.u, v: p.v, dx: 0, dy: 0 };
        part.let = null;
      }
      if (how === 'scrape') {
        part.tip = [p.u, p.v];
        part.auto = null;
        s.animate(400);
      }
      if (how === 'strike' || how === 'shake') strike(h.i, h.d, h.x, h.y);
    },
    move(p) {
      const i = p.data.part;
      if (i == null) return;
      const part = parts[i];
      const how = HOW[part.shape];
      const du = p.u - p.pu;
      const dv = p.v - p.pv;
      const dt = Math.max(1, p.t - p.pt);
      if (how === 'shake') {
        // the instrument goes where the hand takes it, a little way
        part.hold.dx = p.u - part.hold.u;
        part.hold.dy = p.v - part.hold.v;
        s.animate(700);
        // a shake sounds each time the hand turns around
        const along = Math.abs(du) > Math.abs(dv) ? du : dv;
        const dir = Math.sign(along);
        const speed = Math.abs(along) / dt;
        if (dir && p.data.dir && dir !== p.data.dir && speed > 0.15) strike(i, 0, 0, 0, Math.min(1, 0.3 + speed * 0.5));
        if (dir) p.data.dir = dir;
      } else if (how === 'scrape') {
        part.tip = [p.u, p.v];
        s.animate(400);
        // the güiro sounds as the stick crosses its ridges: every so far along it
        p.data.travel += Math.abs(du) + Math.abs(dv);
        if (p.data.travel > G.step) {
          p.data.travel = 0;
          const speed = Math.hypot(du, dv) / dt;
          sounds[part.sound].play({ vol: 0.5 + Math.min(0.4, speed * 0.3), rate: 0.85 + Math.min(0.5, speed * 0.4) });
          Object.assign(part, { at: performance.now(), power: 0.8 });
          kit.hit(code(i), { scrape: true });
        }
      }
    },
    up(p) {
      const i = p.data.part;
      if (i == null) return;
      const part = parts[i];
      if (part.hold) {
        part.let = { at: performance.now(), dx: part.hold.dx, dy: part.hold.dy };
        part.hold = null;
        s.animate(1000);
      }
      if (part.tip) {
        part.tip = null;
        s.animate(100);
      }
    },
  });
  s.onresize = () => { G = null; };

  function draw(g, s) {
    const now = performance.now();
    geom(s);
    put(g, s, layer(s, 'hand', G.key, (c) => G.still(c, s)));
    G.live(g, s, now);
    parts.forEach((p, i) => {
      const t = G.tag(i);
      if (p.name && t.name) words(g, s, p.name, t.name, 15, 0.92);
      if (fine() && t.key) words(g, s, p.key.toUpperCase(), t.key, 12, 0.62);
    });
  }

  /* For tests: where a part is on the screen ('middle', 'edge', or 'off' it), and for the
     güiro, where a scrape starts and ends. */
  s.canvas.museumAt = (i, where) => {
    const S = geom(s);
    if (where === 'off') {
      const p = [[8, s.H - 8], [s.W - 8, s.H - 8], [8, 8], [s.W - 8, 8]].find(([u, v]) => !S.hit(u, v));
      return p && { u: p[0], v: p[1] };
    }
    const p = S.at(i, where);
    return p && { u: p[0], v: p[1] };
  };

  function keydown(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const i = parts.findIndex((p) => p.key === e.key.toLowerCase());
    if (i < 0) return;
    if (HOW[parts[i].shape] === 'scrape') scrape(i, e.shiftKey);
    else strike(i, 0.3);
  }
  addEventListener('keydown', keydown);

  // Listen: each part played by itself; the güiro scraped short (x) or long (z).
  kit.performer({
    levels: parts.length === 2 ? ['l', 'h'] : ['x'],
    ladder: parts.length === 2 ? ['h', 'l'] : ['x', 'x'],
    names: Object.fromEntries(parts.map((p, i) => [code(i), p.name || ex.name])),
    can: (e) => e.part != null && (parts.some((_, i) => code(i) === e.part) || (e.part === 'z' && parts.length === 1)),
    down(e) {
      const i = e.part === 'z' ? 0 : parts.findIndex((_, k) => code(k) === e.part);
      const v = e.vel ?? 0.72;
      if (HOW[parts[i].shape] === 'scrape') scrape(i, e.part === 'z' || e.dur > 0.45, 0.45 + v * 0.4);
      else strike(i, 0.3, 0, 0, Math.max(0.25, Math.min(1, v)));
      return null;
    },
    up() {},
    finish() {},
  });
  return () => {
    removeEventListener('keydown', keydown);
    s.destroy();
  };
}

/* A name or a key's letter, light on the mat. */
function words(g, s, text, [u, v], size, alpha) {
  g.save();
  g.shadowColor = 'rgba(0,0,0,.9)';
  g.shadowBlur = 5 * s.dpr;
  label(g, s, text, u, v, { size, color: `rgba(250,244,230,${alpha})` });
  g.restore();
}

/* ---------- shared ---------- */

/* The part of the screen a scene fits into: room above for names, below for keys. */
const room = (s, { top = 30, bottom = 16, side = 14 } = {}) => ({ x: side, y: top, w: s.W - side * 2, h: s.H - top - bottom });

/* Wood (or another grain) for a solid, its grain running at angle degrees on the screen. */
function grainy(kind, { angle = 0, scale = 1, seed = 0, glaze, lift = 0.38, gloss = 0.35, shine = 30, dark = 0 } = {}) {
  return { kind: 'grain', fill: (g) => wood(g, kind, { angle, scale, seed }), glaze, lift, gloss, shine, dark };
}
/* The angle (degrees) a direction in the world runs at on the screen. */
function screenAngle(V, d) {
  const a = V.at([0, 0, 0]);
  const b = V.at(d);
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
}
const woodScale = (V) => clamp(V.k / 30, 0.45, 2.6);

/* A frame for something lying on the mat, its length along A (turned phi from the x axis,
   tipped up by pitch), S across it, and N up from it; at(a, s, n) is a point in the world. */
function frame(phi, { o = [0, 0, 0], pitch = 0 } = {}) {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const A = [Math.cos(phi) * cp, Math.sin(phi) * cp, sp];
  const S = [-Math.sin(phi), Math.cos(phi), 0];
  const N = cross(A, S);
  return { A, S, N, at: (a, s = 0, n = 0) => add(o, add(add(mul(A, a), mul(S, s)), mul(N, n))) };
}

/* Is (u, v) inside the polygon? */
function inside(poly, u, v) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi || 1e-9) + xi) c = !c;
  }
  return c;
}
/* The convex hull of points on the screen. */
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length > 1 && turn(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const hi = [];
  for (const q of p.reverse()) {
    while (hi.length > 1 && turn(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop();
    hi.push(q);
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
/* Where (u, v) is along the screen line from a to b (t: 0 at a, 1 at b), and how far off it. */
function along(a, b, u, v) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy || 1);
  return { t, off: Math.hypot(u - (a[0] + dx * t), v - (a[1] + dy * t)) };
}

/* A thing's two shadows on the mat: the soft one the room's light casts, and the dark just
   under it where it touches. */
function shadows(s, V, faces, { cast = 0.42, under = 0.6, touching = faces } = {}) {
  return [
    shadow(s, V, faces, { blur: Math.max(3, V.k * 0.5), alpha: cast }),
    shadow(s, V, touching, { dir: [0, 0, 1], blur: Math.max(2, V.k * 0.14), alpha: under }),
  ];
}

/* How far a shaken thing has been moved from where it lies: following the hand while held
   (never further than reach), swinging back when let go. */
function sway(p, now, reach) {
  const soft = (d) => reach * Math.tanh(d / reach);
  if (p.hold) return [soft(p.hold.dx), soft(p.hold.dy)];
  if (p.let) {
    const t = (now - p.let.at) / 1000;
    if (t > 1.2) return [0, 0];
    const e = Math.exp(-t * 7) * Math.cos(t * 18);
    return [soft(p.let.dx) * e, soft(p.let.dy) * e];
  }
  return [0, 0];
}
/* A quick shiver after each shake or tap. */
function shiver(p, now, amp) {
  if (!p.at) return [0, 0];
  const t = (now - p.at) / 1000;
  if (t > 0.5) return [0, 0];
  const e = Math.exp(-t * 11) * amp * (0.4 + p.power * 0.6);
  return [Math.sin(t * 95) * e, Math.cos(t * 77) * e * 0.6];
}

/* A stick (or a mallet's handle) coming down on (x, y) from the hand, toward (dx, dy) on the
   screen: lifted off what it hit as it bounces back, then fading. */
function striker(g, V, p, now, x, y, dx, dy, { len = 11, w = 0.36, head = null, color = '#D9B47C' } = {}) {
  const age = (now - p.at) / 1000;
  if (!p.at || age > 0.5) return;
  const alpha = age < 0.3 ? 1 : 1 - (age - 0.3) / 0.2;
  // up off the instrument and back: inches
  const lift = Math.sin(Math.min(1, age / 0.22) * (Math.PI / 2)) * 1.4 * (0.5 + p.power * 0.5);
  const up = lift * Math.cos(V.tilt) * V.k;
  const l = Math.hypot(dx, dy) || 1;
  const L = len * V.k;
  const tx = x;
  const ty = y - up;
  const bx = tx + (dx / l) * L;
  const by = ty + (dy / l) * L - L * 0.18 * Math.cos(V.tilt);
  // its shadow on the mat, off to the right
  g.save();
  g.globalAlpha = alpha * 0.35;
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  g.lineWidth = w * V.k;
  const sx = lift * 0.6 * V.k + V.k * 0.5;
  g.beginPath();
  g.moveTo(tx + sx, y + V.k * 0.25);
  g.lineTo(bx + sx + V.k * 2, by + L * 0.18 + V.k);
  g.stroke();
  g.restore();
  if (head) {
    stick(g, bx, by, tx, ty, w * V.k, { alpha, color, tip: 'wood' });
    show(g, head, { dx: tx, dy: ty, alpha });
  } else {
    stick(g, tx, ty, bx, by, w * V.k, { alpha, color, tip: 'wood' });
  }
}

/* A ball of radius r pixels in material m, lit as the room is: a picture centred on (0, 0). */
function ball(s, r, m, tilt = rad(60)) {
  const V = view(tilt);
  V.k = 1;
  const steps = r > 12 ? 24 : 14;
  const P = [];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI;
    P.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  const f = turned(P, { n: steps * 2, m });
  return picture(s, { x0: -r, y0: -r, x1: r, y1: r }, (g) => render(g, V, f, { grow: 0.3 }), 2);
}

/* ---------- congas ---------- */

/* Two congas as the player stands over them: the conga (11¾ inches across the head) and the
   bigger tumba (12½), each 30 inches tall, barrel-shaped, of oak staves under amber lacquer,
   with calfskin heads and chrome rims pulled down by six rods. On a tall screen the tumba
   stands behind, to the right, as many players set them. */
function congaScene(s, parts) {
  const tall = s.H > s.W * 1.05;
  const V = view(rad(tall ? 56 : 50));
  const H = 30;
  // the shell's radius up its height, as a fraction of the head's: narrow at the foot, a
  // belly above the middle, in again to the head
  const f = (t) => 0.76 + 1.2175 * t - 1.0397 * t * t + 0.06225 * t * t * t;
  const D = [
    { i: 0, R: 5.875, x: tall ? -3.6 : -7.6, y: tall ? -7.5 : 0 },
    { i: 1, R: 6.25, x: tall ? 3.8 : 7.6, y: tall ? 9 : 2 },
  ];
  const pts = [];
  for (const d of D) {
    d.r = (h) => d.R * f(h / H);
    for (let a = 0; a < TAU; a += TAU / 24) {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      pts.push([d.x + ca * (d.R + 0.7), d.y + sa * (d.R + 0.7), H + 0.7]);
      pts.push([d.x + ca * d.R * 1.14, d.y + sa * d.R * 1.14, H * 0.62]);
      pts.push([d.x + ca * d.R * 0.82, d.y + sa * d.R * 0.82, 0]);
      pts.push([d.x + ca * (d.r(H - 5.4) + 0.95), d.y + sa * (d.r(H - 5.4) + 0.95), H - 5.4]);
    }
  }
  V.fit(pts, room(s, { top: 34, bottom: tall || !fine() ? 14 : 34 }), 34);
  const q = Math.sin(V.tilt);
  const ws = woodScale(V);
  const dirA = (a) => [Math.sin(a), -Math.cos(a), 0];

  for (const d of D) {
    const c = [d.x, d.y, 0];
    const R = d.R;
    // the shell: twelve staves, each its own piece of oak, darker toward the ends
    const prof = [];
    for (let k = 0; k <= 30; k++) prof.push([(k / 30) * H, d.r((k / 30) * H)]);
    prof.push([H + 0.1, R - 0.1]);
    const tone = rand(Math.round(R * 1000));
    const tones = Array.from({ length: 12 }, () => tone());
    d.body = turned(prof, {
      c, n: 48, a0: TAU / 24, a1: TAU / 24 + TAU,
      m: (h, a, j) => {
        const st = Math.floor(j / 4);
        const t = h / H;
        return { kind: 'grain', fill: (g) => wood(g, 'oak', { angle: 90, scale: ws, seed: st * 5 + d.i * 3 }), glaze: '#E39C4A', lift: 0.32, gloss: 0.55, shine: 34, dark: 0.6 * Math.pow(Math.abs(t - 0.56) / 0.56, 2.4) + tones[st] * 0.14 };
      },
    });
    const r0 = d.r(0);
    d.foot = turned([[0, r0 - 0.4], [0, r0 + 0.12], [0.55, r0 + 0.14], [0.8, r0 + 0.03]], { c, n: 48, m: RUBBER });
    d.rim = turned([[H - 0.85, R + 0.3], [H - 0.55, R + 0.48], [H - 0.2, R + 0.56], [H + 0.12, R + 0.52], [H + 0.36, R + 0.36], [H + 0.47, R + 0.15], [H + 0.42, R - 0.02], [H + 0.2, R - 0.1]], { c, n: 72, m: CHROME });
    // six lugs: a side plate on the shell, its ear, the tuning nut under it, and the rod up to
    // a hook over the rim
    d.lugs = [-150, -90, -30, 30, 90, 150].map((deg) => {
      const a = rad(deg);
      const u = dirA(a);
      const P = (h, r) => [d.x + u[0] * r, d.y + u[1] * r, h];
      const he = H - 5.4;
      const Rr = d.r(he) + 0.62;
      const plate = [];
      for (let k = 0; k <= 6; k++) {
        const h = H - 9.2 + k * 0.66;
        plate.push([h, d.r(h) + 0.08]);
      }
      const w = 0.62 / d.r(H - 7);
      const hard = [
        ...turned(plate, { c, n: 3, a0: a - w, a1: a + w, m: SATIN }),
        ...tube([P(he, d.r(he) - 0.1), P(he, Rr + 0.3)], 0.3, { n: 12, m: SATIN }),
        ...turned([[0, 0], [0, 0.3], [0.55, 0.3], [0.55, 0]], { c: P(he - 0.95, Rr), n: 6, a0: a, a1: a + TAU, m: CHROME }),
      ];
      const rod = tube([P(he - 0.4, Rr), P(H - 0.25, Rr)], 0.13, { n: 10, m: CHROME, ends: false });
      const hook = tube([P(H - 0.3, Rr), P(H + 0.2, Rr - 0.03), P(H + 0.52, Rr - 0.25), P(H + 0.68, R + 0.6), P(H + 0.62, R + 0.28), P(H + 0.44, R + 0.12)], 0.13, { n: 10, m: CHROME });
      return { a, front: dot(V.turn(u), V.eye) > -0.12, hard, rod, hook };
    });
    const [X, Y] = V.at([d.x, d.y, H + 0.18]);
    Object.assign(d, { X, Y, rx: (R - 0.06) * V.k, ry: (R - 0.06) * V.k * q });
    d.shade = shadows(s, V, [...d.body, ...d.rim], { touching: d.foot, under: 0.75 });
  }
  // the one at the back first
  const order = [...D].sort((a, b) => b.y - a.y);

  function seams(g, d) {
    g.save();
    g.lineWidth = Math.max(0.6, V.k * 0.03);
    g.strokeStyle = 'rgba(34,14,2,.55)';
    for (let k = 0; k < 12; k++) {
      const a = TAU / 24 + (k * TAU) / 12;
      const u = dirA(a);
      if (dot(V.turn(u), V.eye) < 0.08) continue;
      g.beginPath();
      for (let j = 0; j <= 30; j++) {
        const h = (j / 30) * H;
        const r = d.r(h) + 0.01;
        const [x, y] = V.at([d.x + u[0] * r, d.y + u[1] * r, h]);
        if (j) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
    g.restore();
  }

  function drawDrum(g, d) {
    const back = d.lugs.filter((l) => !l.front);
    const front = d.lugs.filter((l) => l.front);
    render(g, V, back.flatMap((l) => [...l.hard, ...l.rod]));
    render(g, V, [...d.body, ...d.foot]);
    seams(g, d);
    render(g, V, front.flatMap((l) => l.hard));
    face(g, d.X, d.Y, d.rx, q, 'rawhide');
    render(g, V, [...d.rim, ...d.lugs.flatMap((l) => l.hook), ...front.flatMap((l) => l.rod)]);
  }

  const front = [...D].sort((a, b) => a.y - b.y);
  return {
    still(g, s) {
      mat(g, s.W, s.H, { k: V.k, tilt: V.tilt, x: s.W / 2, y: s.H * 0.5 });
      for (const d of order) d.shade.forEach((p) => show(g, p));
      for (const d of order) drawDrum(g, d);
    },
    live(g, s, now) {
      for (const d of order) {
        const p = parts[d.i];
        if (p.at) ripple(g, d.X, d.Y, d.rx, d.ry, p.x, p.y, (now - p.at) / 1000, { life: 0.7, color: '92,58,24', strength: 0.5 + p.power * 0.6 });
      }
    },
    hit(u, v) {
      for (const d of front) {
        const x = (u - d.X) / d.rx;
        const y = (v - d.Y) / d.ry;
        const r = Math.hypot(x, y);
        if (r <= 1.12) return { i: d.i, d: Math.min(1, r), x, y };
      }
      return null;
    },
    at: (i, where) => (where === 'edge' ? [D[i].X + D[i].rx * 0.86, D[i].Y] : [D[i].X, D[i].Y]),
    tag(i) {
      const d = D[i];
      const top = d.Y - d.ry - V.k * 0.9;
      const foot = V.at([d.x, d.y - d.r(0), 0])[1];
      return { name: [d.X, top - 12], key: tall ? [d.X + d.rx + 26, top - 12] : [d.X, foot + 18] };
    },
  };
}

/* ---------- bongos ---------- */

/* A pair of bongos as the player looks down at them between the knees: the macho (7¼ inches)
   and the hembra (8⅝), six-inch cherry shells joined by a block, calfskin heads, chrome rims
   tuned by four rods each from the top. */
function bongoScene(s, parts) {
  const tall = s.H > s.W * 1.05;
  // on a tall screen, turned so the hembra is behind the macho
  const V = view(rad(tall ? 60 : 58), tall ? rad(90) : 0);
  const H = 6;
  const D = [{ i: 0, R: 3.625 }, { i: 1, R: 4.3125 }];
  const gap = 0.85;
  D[0].x = -(D[0].R + gap);
  D[1].x = D[1].R + gap;
  const mid = (D[0].x - D[0].R + D[1].x + D[1].R) / 2;
  const pts = [];
  for (const d of D) {
    d.x -= mid;
    d.r = (h) => d.R * (0.86 + 0.14 * Math.pow(h / H, 0.8));
    for (let a = 0; a < TAU; a += TAU / 24) {
      pts.push([d.x + Math.cos(a) * (d.R + 0.9), Math.sin(a) * (d.R + 0.9), H + 0.6]);
      pts.push([d.x + Math.cos(a) * d.R * 0.9, Math.sin(a) * d.R * 0.9, 0]);
    }
  }
  V.fit(pts, room(s, { top: 34, bottom: fine() ? 34 : 16 }), 52);
  const q = Math.sin(V.tilt);
  const ws = woodScale(V);
  const dirA = (a) => [Math.sin(a), -Math.cos(a), 0];
  const cherry = (seed, dark = 0) => grainy('cherry', { angle: 90, scale: ws, seed, glaze: '#E8B080', lift: 0.3, gloss: 0.6, shine: 36, dark });

  // the block between them
  const bx0 = D[0].x + D[0].r(3) * 0.6;
  const bx1 = D[1].x - D[1].r(3) * 0.6;
  const [y0, y1, z0, z1] = [-1.25, 1.25, 1.5, 4.6];
  const cw = grainy('cherry', { angle: 0, scale: ws, seed: 9, glaze: '#E8B080', lift: 0.3, gloss: 0.5, shine: 30, dark: 0.15 });
  const block = [
    flat([[bx0, y0, z1], [bx1, y0, z1], [bx1, y1, z1], [bx0, y1, z1]], [0, 0, 1], cw),
    flat([[bx0, y0, z0], [bx1, y0, z0], [bx1, y0, z1], [bx0, y0, z1]], [0, -1, 0], cw),
  ];

  for (const d of D) {
    const c = [d.x, 0, 0];
    const R = d.R;
    const prof = [];
    for (let k = 0; k <= 12; k++) prof.push([(k / 12) * H, d.r((k / 12) * H)]);
    prof.push([H + 0.08, R - 0.08]);
    const tone = rand(Math.round(R * 777));
    const tones = Array.from({ length: 8 }, () => tone());
    d.body = turned(prof, {
      c, n: 48, a0: TAU / 16, a1: TAU / 16 + TAU,
      m: (h, a, j) => {
        const st = Math.floor(j / 6);
        return cherry(st * 3 + d.i, 0.45 * Math.pow(Math.abs(h / H - 0.5) / 0.5, 2) + tones[st] * 0.12);
      },
    });
    const r0 = d.r(0);
    d.band = turned([[0, r0 - 0.12], [0, r0 + 0.07], [0.62, d.r(0.62) + 0.07], [0.7, d.r(0.7)]], { c, n: 48, m: CHROME });
    d.rim = turned([[H - 0.5, R + 0.22], [H - 0.3, R + 0.36], [H, R + 0.4], [H + 0.22, R + 0.32], [H + 0.32, R + 0.12], [H + 0.28, R - 0.02], [H + 0.1, R - 0.08]], { c, n: 64, m: CHROME });
    // four lugs: an ear on the rim with its tuning nut on top, and the rod down to a lug low
    // on the shell
    d.lugs = [-135, -45, 45, 135].map((deg) => {
      const a = rad(deg);
      const u = dirA(a);
      const P = (h, r) => [d.x + u[0] * r, u[1] * r, h];
      const Rr = R + 0.64;
      const hard = [
        ...turned([[0, 0], [0, 0.24], [0.3, 0.24], [0.3, 0]], { c: P(H + 0.02, Rr), n: 6, a0: a, a1: a + TAU, m: CHROME }),
        ...tube([P(H + 0.3, Rr), P(H + 0.52, Rr)], 0.09, { n: 8, m: CHROME }),
        ...tube([P(H - 0.12, R + 0.3), P(H - 0.12, Rr + 0.22)], 0.2, { n: 10, m: CHROME }),
      ];
      const rod = tube([P(H - 0.2, Rr), P(2.1, d.r(2.1) + 0.42)], 0.1, { n: 8, m: CHROME, ends: false });
      const plate = [];
      for (let k = 0; k <= 3; k++) {
        const h = 1.1 + k * 0.4;
        plate.push([h, d.r(h) + 0.06]);
      }
      const w = 0.4 / d.r(1.6);
      const low = [
        ...turned(plate, { c, n: 2, a0: a - w, a1: a + w, m: SATIN }),
        ...tube([P(2.1, d.r(2.1) - 0.05), P(2.1, d.r(2.1) + 0.5)], 0.17, { n: 10, m: CHROME }),
      ];
      return { front: dot(V.turn(u), V.eye) > 0, top: hard, rod, low };
    });
    const [X, Y] = V.at([d.x, 0, H + 0.14]);
    Object.assign(d, { X, Y, rx: (R - 0.08) * V.k, ry: (R - 0.08) * V.k * q });
  }
  const all = [...block, ...D.flatMap((d) => [...d.body, ...d.rim])];
  const shade = shadows(s, V, all, { touching: D.flatMap((d) => d.band), under: 0.7 });

  function drawDrum(g, d) {
    const back = d.lugs.filter((l) => !l.front);
    const front = d.lugs.filter((l) => l.front);
    render(g, V, back.flatMap((l) => [...l.low, ...l.rod]));
    render(g, V, [...d.body, ...d.band]);
    render(g, V, front.flatMap((l) => l.low));
    face(g, d.X, d.Y, d.rx, q, 'rawhide');
    render(g, V, [...d.rim, ...d.lugs.flatMap((l) => l.top), ...front.flatMap((l) => l.rod)]);
  }

  const order = [...D].sort((a, b) => V.at([b.x, 0, 0])[2] - V.at([a.x, 0, 0])[2]);
  return {
    still(g, s) {
      mat(g, s.W, s.H, { k: V.k, tilt: V.tilt, x: s.W / 2, y: s.H * 0.5 });
      shade.forEach((p) => show(g, p));
      render(g, V, block);
      for (const d of order) drawDrum(g, d);
    },
    live(g, s, now) {
      for (const d of D) {
        const p = parts[d.i];
        if (p.at) ripple(g, d.X, d.Y, d.rx, d.ry, p.x, p.y, (now - p.at) / 1000, { life: 0.5, color: '92,58,24', strength: 0.5 + p.power * 0.6 });
      }
    },
    hit(u, v) {
      for (const d of [...order].reverse()) {
        const x = (u - d.X) / d.rx;
        const y = (v - d.Y) / d.ry;
        const r = Math.hypot(x, y);
        if (r <= 1.15) return { i: d.i, d: Math.min(1, r), x, y };
      }
      return null;
    },
    at: (i, where) => (where === 'edge' ? [D[i].X + D[i].rx * 0.85, D[i].Y] : [D[i].X, D[i].Y]),
    tag(i) {
      const d = D[i];
      const top = d.Y - d.ry - V.k * 0.8;
      if (tall) {
        const far = d === order[0];
        const y = far ? top - 12 : V.at([d.x, 0, 0])[1] + d.R * V.k * Math.sin(V.tilt) + 16;
        return { name: [d.X, y], key: [d.X + 44, y] };
      }
      return { name: [d.X, top - 12], key: [d.X, V.at([d.x, -d.r(0), 0])[1] + 18] };
    },
  };
}

/* ---------- agogô ---------- */

/* An agogô lying on the mat: two chrome-plated steel bells, 6 and 7¼ inches long, welded to a
   bent steel rod with a rubber grip. Struck with a wooden stick, best near the mouth. */
function agogoScene(s, parts) {
  const tall = s.H > s.W * 1.05;
  const V = view(rad(tall ? 60 : 56));
  const phi = tall ? rad(-68) : rad(-12);
  const F = frame(phi);
  const zA = 1.55;
  const inner = { kind: 'metal', ramp: 'iron', rough: 0.45 };
  const B = [
    { i: 0, L: 6.0, r0: 0.3, r1: 1.35, s: -1.3, splay: rad(-4) },
    { i: 1, L: 7.2, r0: 0.36, r1: 1.65, s: 1.5, splay: rad(4) },
  ];
  for (const b of B) {
    b.ax = add(mul(F.A, Math.cos(b.splay)), mul(F.S, Math.sin(b.splay)));
    b.tip = F.at(0, b.s, zA - 1.55 + b.r1);
    const P = [[0, 0], [0.05, b.r0 * 0.75], [0.16, b.r0]];
    const rr = (t) => b.r0 + (b.r1 - b.r0) * Math.pow(t, 1.3);
    for (let k = 1; k <= 18; k++) P.push([0.16 + (k / 18) * (b.L - 0.16), rr(k / 18)]);
    const out = P.length - 1;
    P.push([b.L + 0.05, b.r1 + 0.05], [b.L + 0.08, b.r1 - 0.03], [b.L - 0.06, b.r1 - 0.1]);
    for (let k = 17; k >= 3; k--) P.push([0.16 + (k / 18) * (b.L - 0.16), rr(k / 18) - 0.1]);
    b.faces = turned(P, { c: b.tip, ax: b.ax, n: 44, m: (h, a, j, i) => (i >= out + 2 ? inner : CHROME) });
    b.rr = rr;
  }
  // the rod: from one bell's tip, back round in a U to the other's, and on into the handle
  const sc = (B[0].s + B[1].s) / 2;
  const ur = (B[1].s - B[0].s) / 2;
  const U = [F.at(0.1, B[0].s, zA), F.at(-0.5, B[0].s, zA)];
  for (let k = 1; k < 12; k++) {
    const t = (Math.PI * k) / 12;
    U.push(F.at(-0.5 - Math.sin(t) * ur, sc - Math.cos(t) * ur, zA));
  }
  U.push(F.at(-0.5, B[1].s, zA), F.at(0.1, B[1].s, zA));
  const a0 = -0.5 - ur;
  const hz = (a) => zA - clamp((a0 - a) / 7.6, 0, 1) * (zA - 0.44);
  const rod = [];
  for (let k = 0; k <= 8; k++) {
    const a = a0 - k * 0.95;
    rod.push(F.at(a, sc, hz(a)));
  }
  const g0 = F.at(a0 - 2.2, sc, hz(a0 - 2.2));
  const g1 = F.at(a0 - 7.6, sc, hz(a0 - 7.6));
  const gripProf = [[0, 0.21], [0, 0.4], [0.25, 0.45]];
  for (let k = 0; k <= 22; k++) gripProf.push([0.35 + k * 0.22, k % 2 ? 0.43 : 0.46]);
  gripProf.push([5.25, 0.44], [5.4, 0.3], [5.45, 0]);
  const handle = [
    ...tube(U, 0.17, { n: 12, m: STEEL }),
    ...tube(rod, 0.19, { n: 12, m: STEEL }),
    ...turned(gripProf, { c: g0, ax: norm(sub(g1, g0)), n: 20, m: RUBBER }),
  ];
  const all = [...handle, ...B.flatMap((b) => b.faces)];
  V.fit(all.flatMap((f) => f.p), room(s, { top: 34, bottom: fine() ? 34 : 18, side: 24 }), 64);
  const shade = shadows(s, V, all, { cast: 0.4, under: 0.55 });
  // the far bell first
  const order = [...B].sort((a, b) => V.at(b.tip)[2] - V.at(a.tip)[2]);
  for (const b of B) {
    b.pic = picture(s, extent(V, b.faces), (g) => render(g, V, b.faces));
    b.a = V.at(b.tip);
    b.b = V.at(add(b.tip, mul(b.ax, b.L)));
  }
  const onBell = (b, u, v) => {
    const { t, off } = along(b.a, b.b, u, v);
    if (t < -0.06 || t > 1.08) return null;
    return off <= b.rr(clamp(t, 0, 1)) * V.k + 8 ? { t, off } : null;
  };
  // the stick comes from the player's right hand
  const hand = tall ? [1, 0.35] : [0.45, 1];
  return {
    still(g, s) {
      mat(g, s.W, s.H, { k: V.k, tilt: V.tilt, x: s.W / 2, y: s.H * 0.5 });
      shade.forEach((p) => show(g, p));
      render(g, V, handle);
    },
    live(g, s, now) {
      for (const b of order) {
        const [dx, dy] = shiver(parts[b.i], now, 1.6);
        show(g, b.pic, { dx, dy });
      }
      for (const b of B) {
        const p = parts[b.i];
        const t = 0.62 - p.x * 0.3;
        const x = lerp(b.a[0], b.b[0], t);
        const y = lerp(b.a[1], b.b[1], t) - b.rr(t) * V.k * 0.55;
        striker(g, V, p, now, x, y, hand[0], hand[1], { len: 12 });
      }
    },
    hit(u, v) {
      for (const b of order.slice().reverse()) {
        const h = onBell(b, u, v);
        if (h) return { i: b.i, d: clamp(1 - h.t, 0, 1), x: clamp(0.62 - h.t, -1, 1) / 0.3, y: 0 };
      }
      return null;
    },
    at(i, where) {
      const b = B[i];
      const t = where === 'edge' ? 0.3 : 0.7;
      return [lerp(b.a[0], b.b[0], t), lerp(b.a[1], b.b[1], t)];
    },
    tag(i) {
      const b = B[i];
      const m = [(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2];
      if (tall) return { name: [b.b[0], b.b[1] + b.r1 * V.k + 14], key: [b.b[0], b.b[1] + b.r1 * V.k + 32] };
      const above = i === order[0].i;
      const y = above ? Math.min(b.a[1], b.b[1]) - b.r1 * V.k - 14 : Math.max(b.a[1], b.b[1]) + b.r1 * V.k + 14;
      return { name: [m[0] + V.k * 1.5, y], key: [m[0] + V.k * 1.5 + 54, y] };
    },
  };
}

/* ---------- cowbell ---------- */

/* A cowbell lying on its side: 6½ inches long, its flattened mouth 4½ by 3, black enamel
   over steel with the mouth's edge left bright, struck with a stick. */
function cowbellScene(s, parts) {
  const tall = s.H > s.W * 1.05;
  const V = view(rad(58));
  const L = 6.6;
  const size = (a) => {
    const t = Math.pow(a / L, 1.15);
    return { w: lerp(1.2, 2.25, t), h: lerp(0.78, 1.45, t), rc: lerp(0.3, 0.52, a / L) };
  };
  const pitch = Math.atan2(size(L).h - size(0).h, L);
  const F = frame(tall ? rad(-62) : rad(-24), { pitch, o: [0, 0, 0] });
  // lift it so its lower face rests on the mat
  const lift = size(0).h * Math.cos(pitch) + 0.02;
  const P = (a, s2, n) => add(F.at(a, s2, n), [0, 0, lift]);
  const ring = (a, inset = 0) => {
    const { w, h, rc } = size(a);
    const W = w - inset;
    const Hh = h - inset;
    const r = Math.max(0.05, rc - inset * 0.5);
    const out = [];
    for (const [cs, cn, a0] of [[1, 1, 0], [-1, 1, Math.PI / 2], [-1, -1, Math.PI], [1, -1, (3 * Math.PI) / 2]]) {
      for (let k = 0; k <= 5; k++) {
        const t = a0 + (k / 5) * (Math.PI / 2);
        out.push(P(a, cs * (W - r) + Math.cos(t) * r, cn * (Hh - r) + Math.sin(t) * r));
      }
    }
    return out;
  };
  const enamel = { kind: 'metal', ramp: 'black', rough: 0.22, floor: STRAW, floorMix: 0.25 };
  const edge = { kind: 'metal', ramp: 'steel', rough: 0.18, floor: STRAW };
  const dark = { kind: 'metal', ramp: 'iron', rough: 0.5, dim: 0.8 };
  const secs = [];
  for (let k = 0; k <= 16; k++) secs.push((k / 16) * (L - 0.45));
  secs.push(L - 0.42, L - 0.2, L);
  const outer = loft(secs.map((a) => ring(a)), { m: (i) => (secs[i] >= L - 0.43 ? edge : enamel), centre: P(L / 2, 0, 0) });
  const cap = flat(ring(0), mul(F.A, -1), enamel);
  const inSecs = [L, L - 0.6, L - 1.6, L - 3, 1.2];
  const inner = loft(inSecs.map((a) => ring(a, 0.08)), { m: dark, centre: P(L / 2, 0, 0), inside: true });
  const lip = loft([ring(L), ring(L, 0.08)], { m: edge, centre: P(L - 1.5, 0, 0) });
  // the seam where the sheet was folded and welded, along its near side
  const seam = tube([P(0.15, -size(0.15).w - 0.01, 0), P(L - 0.5, -size(L - 0.5).w - 0.01, 0)], 0.045, { n: 6, m: enamel, ends: false });
  const all = [cap, ...inner, ...outer, ...lip, ...seam];
  V.fit(all.flatMap((f) => f.p), room(s, { top: 24, bottom: fine() ? 34 : 18, side: 30 }), 70);
  const shade = shadows(s, V, all, { cast: 0.45, under: 0.6 });
  const pic = picture(s, extent(V, all), (g) => {
    render(g, V, inner);
    render(g, V, [cap, ...outer, ...seam]);
    render(g, V, lip);
  });
  const outline = hull(outer.flatMap((f) => f.p.map((p) => V.at(p))));
  const top = V.at(P(0, 0, 0));
  const mouth = V.at(P(L, 0, 0));
  const hand = tall ? [1, 0.25] : [0.55, 1];
  return {
    still(g, s) {
      mat(g, s.W, s.H, { k: V.k, tilt: V.tilt, x: s.W / 2, y: s.H * 0.5 });
      shade.forEach((p) => show(g, p));
    },
    live(g, s, now) {
      const p = parts[0];
      const [dx, dy] = shiver(p, now, 1.8);
      show(g, pic, { dx, dy });
      const t = clamp(0.7 - p.x * 0.3, 0.1, 0.95);
      const x = lerp(top[0], mouth[0], t);
      const y = lerp(top[1], mouth[1], t) - size(t * L).h * V.k * Math.cos(V.tilt) * 0.9;
      striker(g, V, p, now, x, y, hand[0], hand[1], { len: 12 });
    },
    hit(u, v) {
      if (!inside(outline, u, v)) return null;
      const { t } = along(top, mouth, u, v);
      return { i: 0, d: clamp(1 - t, 0, 1), x: (0.7 - clamp(t, 0, 1)) / 0.3, y: 0 };
    },
    at: (i, where) => {
      const t = where === 'edge' ? 0.25 : 0.75;
      return [lerp(top[0], mouth[0], t), lerp(top[1], mouth[1], t)];
    },
    tag: () => {
      const b = extent(V, outer);
      return { name: null, key: [(b.x0 + b.x1) / 2, b.y1 + 22] };
    },
  };
}

/* ---------- claves ---------- */

/* Claves: two rosewood sticks, 8 inches by 1, the upper one resting across the lower with its
   end on the mat. Tap them and the upper one clicks down onto the lower. */
function clavesScene(s, parts) {
  const tall = s.H > s.W * 1.05;
  const V = view(rad(60));
  const len = 8;
  const r = 0.5;
  const prof = [[0, 0], [0.03, 0.3], [0.1, 0.45], [0.22, r], [len - 0.22, r], [len - 0.1, 0.45], [len - 0.03, 0.3], [len, 0]];
  const ws = woodScale(V);
  const make = (c, ax, seed) => {
    const ang = screenAngle(V, ax);
    return turned(prof, { c, ax, n: 40, m: (h) => grainy('rosewood', { angle: ang, scale: ws * 0.8, seed, lift: 0.3, gloss: 0.75, shine: 44, dark: h < 0.12 || h > len - 0.12 ? 0.3 : 0 }) });
  };
  const p1 = tall ? rad(64) : rad(10);
  const p2 = tall ? rad(118) : rad(64);
  const A1 = [Math.cos(p1), Math.sin(p1), 0];
  const mid = [0, 0, r];
  const low = make(sub(mid, mul(A1, len / 2)), A1, 3);
  // the upper one: its near end on the mat, crossing the lower 4.6 inches along
  const cross0 = add(mid, [0, 0, r * 2]);
  const lean = Math.asin((r * 2) / 4.6);
  const A2 = [Math.cos(p2) * Math.cos(lean), Math.sin(p2) * Math.cos(lean), Math.sin(lean)];
  const foot = sub(cross0, mul(A2, 4.6));
  const up = make(foot, A2, 11);
  // its axis for lifting: level, square to it
  const pivot = [-Math.sin(p2), Math.cos(p2), 0];
  V.fit([...low, ...up].flatMap((f) => f.p), room(s, { top: 30, bottom: fine() ? 34 : 18, side: 40 }), 62);
  const shadeLow = shadows(s, V, low, { cast: 0.45, under: 0.65 });
  const shadeUp = shadows(s, V, up, { cast: 0.4, under: 0.5, touching: up.filter((f) => f.h < 1.2) });
  const lowPic = picture(s, extent(V, low), (g) => render(g, V, low));
  const upPic = picture(s, extent(V, up), (g) => render(g, V, up));
  const ends = (A, c) => [V.at(c), V.at(add(c, mul(A, len)))];
  const lowLine = ends(A1, sub(mid, mul(A1, len / 2)));
  const upLine = ends(A2, foot);
  const click = V.at(cross0);
  return {
    still(g, s) {
      mat(g, s.W, s.H, { k: V.k, tilt: V.tilt, x: s.W / 2, y: s.H * 0.5 });
      shadeLow.forEach((p) => show(g, p));
      shadeUp.forEach((p) => show(g, p));
      show(g, lowPic);
    },
    live(g, s, now) {
      const p = parts[0];
      const t = p.at ? (now - p.at) / 1000 : 9;
      if (t < 0.45) {
        // it bounces up off the lower one and settles
        const a = rad(7) * Math.abs(Math.sin((t / 0.45) * Math.PI * 2.2)) * Math.exp(-t * 6) * (0.5 + p.power * 0.6);
        render(g, V, moved(up, { ax: pivot, a: -a, c: foot }));
        if (t < 0.12) {
          // the click: a flash where they meet
          const k = 1 - t / 0.12;
          const R = V.k * (0.6 + 1.4 * (1 - k));
          const gr = g.createRadialGradient(click[0], click[1], 0, click[0], click[1], R);
          gr.addColorStop(0, `rgba(255,248,224,${0.75 * k})`);
          gr.addColorStop(1, 'rgba(255,248,224,0)');
          g.fillStyle = gr;
          g.fillRect(click[0] - R, click[1] - R, R * 2, R * 2);
          g.strokeStyle = `rgba(255,244,214,${0.8 * k})`;
          g.lineWidth = 2;
          g.lineCap = 'round';
          for (let j = 0; j < 7; j++) {
            const an = (j / 7) * TAU + 0.3;
            g.beginPath();
            g.moveTo(click[0] + Math.cos(an) * R * 0.7, click[1] + Math.sin(an) * R * 0.7);
            g.lineTo(click[0] + Math.cos(an) * R * 1.25, click[1] + Math.sin(an) * R * 1.25);
            g.stroke();
          }
        }
      } else {
        show(g, upPic);
      }
    },
    hit(u, v) {
      for (const [a, b] of [upLine, lowLine]) {
        const { t, off } = along(a, b, u, v);
        if (t > -0.04 && t < 1.04 && off < r * V.k + 12) return { i: 0, d: Math.min(1, Math.abs(t - 0.5) * 2), x: 0, y: 0 };
      }
      return null;
    },
    at: (i, where) => {
      const [a, b] = where === 'edge' ? lowLine : upLine;
      const t = where === 'edge' ? 0.85 : 0.35;
      return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    },
    tag: () => {
      const b = extent(V, [...low, ...up]);
      return { name: null, key: [(b.x0 + b.x1) / 2, b.y1 + 22] };
    },
  };
}

/* ---------- güiro ---------- */

/* The gourd's skin: tan, mottled with darker patches and freckles. */
function paintGourd(c, w, h) {
  const r = rand(61);
  c.fillStyle = '#C28E4C';
  c.fillRect(0, 0, w, h);
  const blot = (x, y, s, col, a) => {
    for (const dx of [-w, 0, w]) {
      for (const dy of [-h, 0, h]) {
        const gr = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, s);
        gr.addColorStop(0, `rgba(${col},${a})`);
        gr.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = gr;
        c.fillRect(x + dx - s, y + dy - s, s * 2, s * 2);
      }
    }
  };
  for (let i = 0; i < 46; i++) blot(r() * w, r() * h, 8 + r() * 30, r() < 0.62 ? '110,64,22' : '236,196,130', 0.12 + r() * 0.22);
  for (let i = 0; i < 700; i++) {
    c.fillStyle = r() < 0.7 ? `rgba(90,52,16,${0.1 + r() * 0.3})` : `rgba(250,220,170,${0.1 + r() * 0.2})`;
    c.fillRect(r() * w, r() * h, 0.6 + r() * 1.2, 0.6 + r());
  }
  // faint streaks along it, as a dried gourd has
  c.lineWidth = 0.6;
  for (let i = 0; i < 40; i++) {
    const y = r() * h;
    c.strokeStyle = `rgba(110,66,24,${0.06 + r() * 0.1})`;
    c.beginPath();
    c.moveTo(0, y);
    c.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 6, w * 0.7, y + (r() - 0.5) * 6, w, y);
    c.stroke();
  }
}

/* A güiro lying on the mat: a gourd 14 inches long, ridges cut across its top, burned
   patterns round its ends, and the stick that scrapes it. */
function guiroScene(s, parts) {
  const tall = s.H > s.W * 1.05;
  const V = view(rad(58));
  const Lg = 14;
  // the gourd's radius along it: a narrow neck, a long body, a round end
  const rOf = (h) => {
    if (h <= 0.3) return 0.25 + h * 0.6;
    if (h < 9.2) return 2.1 * (1 - Math.pow((9.2 - h) / 9.2, 1.6) * 0.8);
    return 2.1 * Math.sqrt(Math.max(0, 1 - ((h - 9.2) / 4.8) ** 2));
  };
  const zc = 2.0;
  const F = frame(tall ? rad(-60) : rad(4), { o: [0, 0, zc] });
  const ax = F.A;
  const c = F.at(-Lg / 2);
  const [u0, w0] = across(ax);
  // the ridges face up and a little toward you
  const want = norm([0, -0.42, 1]);
  const mid = Math.atan2(dot(want, w0), dot(want, u0));
  const spread = 1.3;
  const g0 = 2.7;
  const g1 = 12.3;
  const N = 36;
  const pitch = (g1 - g0) / N;
  const smooth = [[0, 0]];
  for (let k = 1; k <= 56; k++) {
    const h = (k / 56) * Lg;
    smooth.push([h, rOf(h)]);
  }
  smooth[smooth.length - 1] = [Lg, 0];
  const cut = [[0, 0]];
  for (let k = 1; k <= 12; k++) cut.push([(k / 12) * g0, rOf((k / 12) * g0)]);
  for (let k = 0; k < N; k++) {
    const h = g0 + (k + 0.5) * pitch;
    cut.push([h - pitch * 0.32, rOf(h - pitch * 0.32)], [h, rOf(h) - 0.08], [h + pitch * 0.32, rOf(h + pitch * 0.32)]);
  }
  for (let k = 0; k <= 12; k++) {
    const h = g1 + (k / 12) * (Lg - g1);
    cut.push([h, k === 12 ? 0 : rOf(h)]);
  }
  const gs = clamp(V.k / 34, 0.4, 2.4);
  const skin = (dark = 0) => ({ kind: 'grain', fill: (g) => place(pattern(g, 'gourd', 160, 160, paintGourd), 0, 0, 0, gs), lift: 0.36, gloss: 0.3, shine: 26, dark });
  const body = [
    ...turned(cut, { c, ax, n: 26, a0: mid - spread, a1: mid + spread, m: (h, a, j, i) => skin(h > g0 && h < g1 && cut[i + 1] && cut[i + 1][1] < rOf(cut[i + 1][0]) - 0.04 ? 0.12 : 0) }),
    ...turned(smooth, { c, ax, n: 26, a0: mid + spread, a1: mid - spread + TAU, m: skin() }),
  ];
  // the stem, a dry nub at the neck
  const stem = tube([F.at(-Lg / 2 + 0.1), F.at(-Lg / 2 - 0.45, 0.05, 0.08)], 0.16, { n: 8, m: grainy('walnut', { lift: 0.4, gloss: 0.1 }) });
  // the scraper, lying in front of it
  const stickAx = norm(tall ? [Math.cos(rad(-70)), Math.sin(rad(-70)), 0] : [Math.cos(rad(-8)), Math.sin(rad(-8)), 0]);
  const stickAt = tall ? F.at(-1, -4.2, 0.12 - zc) : F.at(-3.5, -3.6, 0.12 - zc);
  const stickProf = [[0, 0], [0.04, 0.09], [0.12, 0.12], [6.6, 0.12], [6.9, 0.15], [7.4, 0.15], [7.5, 0]];
  const scraper = turned(stickProf, { c: stickAt, ax: stickAx, n: 12, m: grainy('ash', { angle: screenAngle(V, stickAx), scale: 0.6, lift: 0.45, gloss: 0.3 }) });
  const all = [...body, ...stem];
  V.fit([...all, ...scraper].flatMap((f) => f.p), room(s, { top: 24, bottom: fine() ? 34 : 18, side: 26 }), 58);
  const shade = shadows(s, V, all, { cast: 0.42, under: 0.6 });
  const stickShade = shadows(s, V, scraper, { cast: 0.35, under: 0.5 });
  const stickPic = picture(s, extent(V, scraper), (g) => render(g, V, scraper));
  // the ridge line along the top, for the stick to run on
  const ridge = (t) => {
    const h = lerp(g0, g1, t);
    const d = add(mul(u0, Math.cos(mid)), mul(w0, Math.sin(mid)));
    return V.at(add(add(c, mul(ax, h)), mul(d, rOf(h) - 0.02)));
  };
  const head = V.at(c);
  const tail = V.at(add(c, mul(ax, Lg)));
  const radiusAt = (t) => rOf(clamp(t, 0, 1) * Lg);

  /* Burned patterns round the gourd: two lines and a zigzag between them, at h0 to h1. */
  function burn(g, h0, h1, teeth) {
    const ptAt = (h, a) => {
      const d = add(mul(u0, Math.cos(a)), mul(w0, Math.sin(a)));
      return { p: V.at(add(add(c, mul(ax, h)), mul(d, rOf(h) + 0.005))), seen: dot(V.turn(d), V.eye) > 0.12 };
    };
    g.save();
    g.strokeStyle = 'rgba(52,24,6,.78)';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(0.8, V.k * 0.05);
    const line = (fn) => {
      let on = false;
      g.beginPath();
      for (let k = 0; k <= 160; k++) {
        const { p, seen } = fn(k / 160);
        if (!seen) { on = false; continue; }
        if (on) g.lineTo(p[0], p[1]);
        else g.moveTo(p[0], p[1]);
        on = true;
      }
      g.stroke();
    };
    line((t) => ptAt(h0, t * TAU));
    line((t) => ptAt(h1, t * TAU));
    line((t) => {
      const a = t * TAU;
      const z = (t * teeth) % 1;
      return ptAt(lerp(h0 + 0.12, h1 - 0.12, z < 0.5 ? z * 2 : 2 - z * 2), a);
    });
    // dots in the zigzag's gaps
    g.fillStyle = 'rgba(52,24,6,.7)';
    for (let k = 0; k < teeth; k++) {
      const { p, seen } = ptAt(lerp(h0, h1, 0.28), ((k + 0.5) / teeth) * TAU);
      if (!seen) continue;
      g.beginPath();
      g.arc(p[0], p[1], Math.max(0.8, V.k * 0.045), 0, TAU);
      g.fill();
    }
    g.restore();
  }

  const hand = tall ? [1, 0.2] : [0.5, 1];
  return {
    step: Math.hypot(tail[0] - head[0], tail[1] - head[1]) * 0.2,
    still(g, s) {
      mat(g, s.W, s.H, { k: V.k, tilt: V.tilt, x: s.W / 2, y: s.H * 0.5 });
      shade.forEach((p) => show(g, p));
      render(g, V, [...stem, ...body]);
      burn(g, 1.35, 2.2, 22);
      burn(g, 12.55, 13.35, 18);
      stickShade.forEach((p) => show(g, p));
    },
    live(g, s, now) {
      const p = parts[0];
      let tip = p.tip;
      if (!tip && p.auto) {
        // played from the keyboard (or by Listen): the stick runs along the ridges by itself
        const t = (now - p.auto.at) / 1000;
        const dur = p.auto.long ? 0.6 : 0.22;
        if (t < dur + 0.15) {
          const k = clamp(t / dur, 0, 1);
          tip = ridge(p.auto.long ? 0.05 + k * 0.9 : 0.55 + k * 0.3);
        }
      }
      if (tip) {
        striker(g, V, { at: now - 300, power: 0 }, now, tip[0], tip[1], hand[0], hand[1], { len: 7.2, w: 0.26, color: '#E2C796' });
      } else {
        show(g, stickPic);
      }
    },
    hit(u, v) {
      const { t, off } = along(head, tail, u, v);
      if (t < 0 || t > 1) return null;
      return off <= radiusAt(t) * V.k + 10 ? { i: 0, d: 0.3, x: 0, y: 0 } : null;
    },
    at: (i, where) => (where === 'end' ? ridge(0.9) : where === 'edge' ? ridge(0.15) : ridge(0.5)),
    tag: () => {
      const b = extent(V, all);
      return { name: null, key: [(b.x0 + b.x1) / 2, Math.min(s.H - 10, b.y1 + 26)] };
    },
  };
}

/* ---------- shaker ---------- */

/* An egg shaker, 2⅓ inches long, its amber shell clear enough to see the seeds inside jump
   as you shake it. */
function shakerScene(s, parts) {
  const tall = s.H > s.W * 1.05;
  const V = view(rad(62));
  const Lg = 2.35;
  const Rg = 0.88;
  const prof = [];
  for (let k = 0; k <= 30; k++) {
    const x = -1 + (2 * k) / 30;
    prof.push([((x + 1) * Lg) / 2, Rg * Math.sqrt(Math.max(0, 1 - x * x)) * (1 - 0.1 * x)]);
  }
  const F = frame(tall ? rad(58) : rad(24), { o: [0, 0, Rg * 0.97] });
  const c = F.at(-Lg / 2);
  const shell = turned(prof, { c, ax: F.A, n: 40, m: { kind: 'paint', color: '#F29A1E', amb: 0.66, gloss: 0.9, shine: 70 } });
  V.fit(shell.flatMap((f) => f.p), room(s, { top: 24, bottom: fine() ? 34 : 18, side: 40 }), 120);
  const shade = shadows(s, V, shell, { cast: 0.4, under: 0.65 });
  // the inside of the far half, seen through the near
  const back = shell.map((f) => ({ ...f, n: mul(f.n, -1), m: { kind: 'paint', color: '#B85A08', amb: 0.8, gloss: 0 } }));
  const box = extent(V, shell);
  const backPic = picture(s, box, (g) => render(g, V, back));
  const frontPic = picture(s, box, (g) => {
    render(g, V, shell);
    // the seam where its two halves join
    g.strokeStyle = 'rgba(120,52,0,.55)';
    g.lineWidth = Math.max(0.8, V.k * 0.02);
    g.beginPath();
    let on = false;
    const [u0, w0] = across(F.A);
    for (let k = 0; k <= 64; k++) {
      const a = (k / 64) * TAU;
      const d = add(mul(u0, Math.cos(a)), mul(w0, Math.sin(a)));
      if (dot(V.turn(d), V.eye) < 0.02) { on = false; continue; }
      const p = V.at(add(F.at(0.02), mul(d, Rg + 0.002)));
      if (on) g.lineTo(p[0], p[1]);
      else g.moveTo(p[0], p[1]);
      on = true;
    }
    g.stroke();
  });
  // the light's reflection: where the shell faces halfway between the light and you
  const Hh = norm(add(LIGHT, V.eye));
  let best = null;
  for (const f of shell) {
    const e = dot(V.turn(f.n), Hh);
    if (!best || e > best.e) best = { e, f };
  }
  const hp = V.at(best.f.p.reduce((a, q) => add(a, mul(q, 0.25)), [0, 0, 0]));
  const shinePic = picture(s, box, (g) => {
    const glow = (r, a) => {
      const gr = g.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], r);
      gr.addColorStop(0, `rgba(255,252,240,${a})`);
      gr.addColorStop(0.45, `rgba(255,248,228,${a * 0.45})`);
      gr.addColorStop(1, 'rgba(255,248,228,0)');
      g.fillStyle = gr;
      g.fillRect(hp[0] - r, hp[1] - r, r * 2, r * 2);
    };
    glow(V.k * 0.55, 0.22);
    glow(V.k * 0.17, 0.95);
  });
  const centre = V.at(F.at(0));
  const outline = hull(shell.flatMap((f) => f.p.map((p) => V.at(p))));
  // the seeds, where they lie at rest (in pixels from the middle), and how they move
  const r = rand(5);
  const seeds = Array.from({ length: 80 }, () => {
    const a = (r() - 0.5) * 1.6;
    const sn = (r() - 0.5) * 1.3;
    const p = V.at(F.at(a * 0.72, sn * 0.6 * Math.sqrt(1 - a * a * 0.3), -0.45 + r() * 0.35));
    return { rx: p[0] - centre[0], ry: p[1] - centre[1], x: 0, y: 0, vx: 0, vy: 0, turn: r() * TAU, size: 0.6 + r() * 0.5, tone: r() };
  });
  const sk = V.k;
  let last = 0;
  let prev = [0, 0];
  let vel = [0, 0];
  let kicked = 0;
  return {
    still(g, s) {
      mat(g, s.W, s.H, { k: Math.min(V.k, 40), tilt: V.tilt, x: s.W / 2, y: s.H * 0.5 });
      shade.forEach((p) => show(g, p));
    },
    live(g, s, now) {
      const p = parts[0];
      const [ox, oy] = sway(p, now, V.k * 0.9);
      const [jx, jy] = shiver(p, now, 3);
      const dx = ox + jx;
      const dy = oy + jy;
      // the seeds: pulled back to where they lie, flung the other way when the egg moves
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      const v = [(dx - prev[0]) / (dt || 1), (dy - prev[1]) / (dt || 1)];
      const acc = dt ? [(v[0] - vel[0]) / dt, (v[1] - vel[1]) / dt] : [0, 0];
      prev = [dx, dy];
      vel = dt ? v : vel;
      if (p.at && p.at !== kicked) {
        kicked = p.at;
        for (const b of seeds) {
          b.vx += (Math.random() - 0.5) * sk * 14 * (0.4 + p.power);
          b.vy += (Math.random() - 0.5) * sk * 14 * (0.4 + p.power);
        }
      }
      for (const b of seeds) {
        if (!dt) break;
        const ax2 = -b.x * 60 - b.vx * 7 - clamp(acc[0], -4e4, 4e4) * 0.35;
        const ay2 = -b.y * 60 - b.vy * 7 - clamp(acc[1], -4e4, 4e4) * 0.35;
        b.vx += ax2 * dt;
        b.vy += ay2 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const lim = sk * 0.45;
        const d = Math.hypot(b.x + b.rx * 0.3, b.y + b.ry * 0.3);
        if (d > lim) {
          b.x *= lim / d;
          b.y *= lim / d;
          b.vx *= -0.4;
          b.vy *= -0.4;
        }
        b.turn += b.vx * dt * 0.05;
      }
      show(g, backPic, { dx, dy });
      g.save();
      g.translate(dx, dy);
      g.beginPath();
      outline.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.clip();
      for (const b of seeds) {
        const x = centre[0] + b.rx + b.x;
        const y = centre[1] + b.ry + b.y;
        const R = sk * 0.042 * b.size;
        g.save();
        g.translate(x, y);
        g.rotate(b.turn);
        g.fillStyle = b.tone < 0.6 ? '#3A1E0C' : b.tone < 0.85 ? '#6A3C18' : '#E8D6B0';
        g.beginPath();
        g.ellipse(0, 0, R * 1.35, R, 0, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,240,210,.35)';
        g.beginPath();
        g.ellipse(-R * 0.4, -R * 0.35, R * 0.45, R * 0.28, 0, 0, TAU);
        g.fill();
        g.restore();
      }
      g.restore();
      show(g, frontPic, { dx, dy, alpha: 0.6 });
      show(g, shinePic, { dx, dy });
      if (p.hold || (p.let && now - p.let.at < 1200)) s.animate(120);
    },
    hit(u, v) {
      return inside(outline, u, v) || Math.hypot(u - centre[0], v - centre[1]) < V.k * 1.3 ? { i: 0, d: 0, x: 0, y: 0 } : null;
    },
    at: (i, where) => (where === 'edge' ? [centre[0] + V.k * 0.6, centre[1]] : centre),
    tag: () => ({ name: null, key: [box.x0 / 2 + box.x1 / 2, box.y1 + 26] }),
  };
}

/* ---------- cabasa ---------- */

/* A cabasa lying on the mat: a turned maple handle and a cylinder of ridged steel 3 inches
   across, wrapped in eight loops of steel beads that roll round as you shake it. */
function cabasaScene(s, parts) {
  const tall = s.H > s.W * 1.05;
  const V = view(rad(60));
  const c0 = 5.0;
  const c1 = 9.2;
  const Rc = 1.5;
  const Rb = Rc + 0.13;
  const tilt = Math.atan2(Rb + 0.1 - 0.5, c1 - 0.3);
  const F = frame(tall ? rad(-66) : rad(16), { o: [0, 0, 0.5], pitch: tilt });
  const ax = F.A;
  const c = F.at(-(c0 + c1) / 2);
  const ws = woodScale(V);
  const maple = grainy('maple', { angle: screenAngle(V, ax), scale: ws, seed: 4, glaze: '#F0C890', lift: 0.36, gloss: 0.55, shine: 32 });
  const handle = turned([[0, 0], [0.04, 0.3], [0.15, 0.48], [0.45, 0.56], [0.75, 0.5], [0.95, 0.42], [1.2, 0.45], [2.2, 0.5], [3.2, 0.52], [3.9, 0.47], [4.4, 0.4], [4.6, 0.5], [4.8, 0.64], [5.0, 0.7]], { c, ax, n: 24, m: maple });
  const caps = [
    ...turned([[c0, 0.7], [c0, Rc + 0.08], [c0 + 0.2, Rc + 0.12], [c0 + 0.24, Rc]], { c, ax, n: 40, m: maple }),
    ...turned([[c1 - 0.24, Rc], [c1 - 0.2, Rc + 0.12], [c1, Rc + 0.08], [c1, 0]], { c, ax, n: 40, m: maple }),
  ];
  // the ridged steel: each facet leans one way, then the other
  const steel = turned([[c0 + 0.24, Rc], [c1 - 0.24, Rc]], { c, ax, n: 56, m: { kind: 'metal', ramp: 'steel', rough: 0.2, floor: STRAW } })
    .map((f) => ({ ...f, n: norm(add(f.n, mul(cross(ax, f.n), f.j % 2 ? 0.5 : -0.5))) }));
  const all = [...handle, ...caps, ...steel];
  V.fit(all.flatMap((f) => f.p), room(s, { top: 24, bottom: fine() ? 34 : 18, side: 30 }), 64);
  const shade = shadows(s, V, all, { cast: 0.42, under: 0.6 });
  const body = picture(s, extent(V, all), (g) => render(g, V, all));
  const bead = ball(s, Math.max(1.5, 0.1 * V.k), { kind: 'metal', ramp: 'chrome', rough: 0.05, floor: STRAW });
  const [u0, w0] = across(ax);
  const rows = 8;
  const per = Math.round((TAU * Rb) / 0.21);
  const spin = new Array(rows).fill(0);
  const outline = hull(all.flatMap((f) => f.p.map((p) => V.at(p))));
  const mid = V.at(add(c, mul(ax, (c0 + c1) / 2)));
  let lastHold = null;
  return {
    still(g, s) {
      mat(g, s.W, s.H, { k: V.k, tilt: V.tilt, x: s.W / 2, y: s.H * 0.5 });
      shade.forEach((p) => show(g, p));
    },
    live(g, s, now) {
      const p = parts[0];
      const [ox, oy] = sway(p, now, V.k * 1.1);
      const [jx, jy] = shiver(p, now, 2.5);
      const dx = ox + jx;
      const dy = oy + jy;
      // the loops roll round with the hand
      if (p.hold) {
        const d = lastHold ? (p.hold.dx - lastHold[0]) + (p.hold.dy - lastHold[1]) : 0;
        for (let k = 0; k < rows; k++) spin[k] += (d / V.k) * (0.32 + ((k * 37) % 10) / 40);
        lastHold = [p.hold.dx, p.hold.dy];
      } else {
        lastHold = null;
      }
      show(g, body, { dx, dy });
      const list = [];
      for (let k = 0; k < rows; k++) {
        const h = c0 + 0.45 + (k * (c1 - c0 - 0.9)) / (rows - 1);
        const at = add(c, mul(ax, h));
        for (let j = 0; j < per; j++) {
          const a = (j / per) * TAU + spin[k] + (k % 2) * (TAU / per / 2);
          const d = add(mul(u0, Math.cos(a)), mul(w0, Math.sin(a)));
          const e = dot(V.turn(d), V.eye);
          if (e < -0.25) continue;
          const q = V.at(add(at, mul(d, Rb)));
          list.push(q);
        }
      }
      list.sort((a, b) => b[2] - a[2]);
      for (const q of list) show(g, bead, { dx: q[0] + dx, dy: q[1] + dy });
      if (p.hold || (p.let && now - p.let.at < 1200)) s.animate(120);
    },
    hit(u, v) {
      return inside(outline, u, v) ? { i: 0, d: 0, x: 0, y: 0 } : null;
    },
    at: (i, where) => (where === 'edge' ? V.at(add(c, mul(ax, 1.6))) : mid),
    tag: () => {
      const b = extent(V, all);
      return { name: null, key: [(b.x0 + b.x1) / 2, b.y1 + 26] };
    },
  };
}

/* ---------- log drum ---------- */

/* A log drum (a slit drum) on the mat: a box of walnut 20 inches long with a padauk top, and
   an H cut through the top leaving two tongues: the short one plays high, the long one low.
   Struck with rubber mallets. */
function slitScene(s, parts) {
  const tall = s.H > s.W * 1.05;
  const V = view(rad(tall ? 58 : 60), tall ? rad(78) : rad(-12));
  const [X, Y, Z, T] = [10, 4, 7.3, 0.55];
  const z0 = 0.35;
  const ws = woodScale(V);
  const ang = screenAngle(V, [1, 0, 0]);
  const angY = screenAngle(V, [0, 1, 0]);
  const walnut = (seed, a = ang) => grainy('walnut', { angle: a, scale: ws, seed, lift: 0.34, gloss: 0.4, shine: 28 });
  const padauk = (seed, dark = 0) => grainy('padauk', { angle: ang, scale: ws, seed, lift: 0.34, gloss: 0.5, shine: 30, dark });
  const box = [
    flat([[-X, -Y, Z], [X, -Y, Z], [X, Y, Z], [-X, Y, Z]], [0, 0, 1], padauk(2)),
    flat([[-X, -Y, z0], [X, -Y, z0], [X, -Y, Z - T], [-X, -Y, Z - T]], [0, -1, 0], walnut(5)),
    flat([[-X, -Y, Z - T], [X, -Y, Z - T], [X, -Y, Z], [-X, -Y, Z]], [0, -1, 0], padauk(6, 0.25)),
    flat([[-X, Y, z0], [X, Y, z0], [X, Y, Z], [-X, Y, Z]], [0, 1, 0], walnut(7)),
    flat([[X, -Y, z0], [X, Y, z0], [X, Y, Z - T], [X, -Y, Z - T]], [1, 0, 0], walnut(8, angY)),
    flat([[X, -Y, Z - T], [X, Y, Z - T], [X, Y, Z], [X, -Y, Z]], [1, 0, 0], padauk(9, 0.25)),
    flat([[-X, -Y, z0], [-X, Y, z0], [-X, Y, Z - T], [-X, -Y, Z - T]], [-1, 0, 0], walnut(10, angY)),
    flat([[-X, -Y, Z - T], [-X, Y, Z - T], [-X, Y, Z], [-X, -Y, Z]], [-1, 0, 0], padauk(11, 0.25)),
  ];
  const feet = [[-9, -3.2], [9, -3.2], [-9, 3.2], [9, 3.2]].flatMap(([x, y]) => turned([[0, 0], [0, 0.5], [z0 + 0.02, 0.5], [z0 + 0.02, 0]], { c: [x, y, 0], n: 16, m: RUBBER }));
  // the cut: two long slots and the bar between them, off the middle
  const xc = -2.4;
  const sy = 1.6;
  const sw = 0.11;
  const xe = 7.6;
  const pts = [...box, ...feet].flatMap((f) => f.p);
  V.fit(pts, room(s, { top: 34, bottom: fine() ? 34 : 18, side: 20 }), 52);
  const shade = shadows(s, V, [...box, ...feet], { cast: 0.45, under: 0.7, touching: feet });
  const P = (x, y) => V.at([x, y, Z]);
  const tongue = [
    { i: 0, x0: -xe, x1: xc - sw, free: xc - sw },
    { i: 1, x0: xc + sw, x1: xe, free: xc + sw },
  ];
  for (const t of tongue) t.poly = [P(t.x0, -sy + sw), P(t.x1, -sy + sw), P(t.x1, sy - sw), P(t.x0, sy - sw)];
  const topPoly = [P(-X, -Y), P(X, -Y), P(X, Y), P(-X, Y)];
  const slots = [
    [[-xe, -sy - sw], [xe, -sy - sw], [xe, -sy + sw], [-xe, -sy + sw]],
    [[-xe, sy - sw], [xe, sy - sw], [xe, sy + sw], [-xe, sy + sw]],
    [[xc - sw, -sy], [xc + sw, -sy], [xc + sw, sy], [xc - sw, sy]],
  ];
  /* Where a point on the screen is on the top, in inches. */
  const onTop = (u, v) => {
    const q0 = (u - V.ox) / V.k;
    const q1 = ((V.oy - v) / V.k - Z * Math.cos(V.tilt)) / Math.sin(V.tilt);
    const cy = Math.cos(V.yaw);
    const sy2 = Math.sin(V.yaw);
    return [q0 * cy + q1 * sy2, -q0 * sy2 + q1 * cy];
  };
  const head = ball(s, Math.max(4, 0.62 * V.k), { kind: 'paint', color: '#9A1C14', amb: 0.4, gloss: 0.45, shine: 26 });
  return {
    still(g, s) {
      mat(g, s.W, s.H, { k: V.k, tilt: V.tilt, x: s.W / 2, y: s.H * 0.5 });
      shade.forEach((p) => show(g, p));
      render(g, V, [...feet, ...box]);
      // the cut, dark inside, its far wall catching a little light
      for (const sl of slots) {
        const poly = sl.map(([x, y]) => P(x, y));
        g.fillStyle = '#140A04';
        g.beginPath();
        poly.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
      }
      g.fillStyle = 'rgba(160,70,30,.55)';
      for (const [x, y] of [[-xe, -sy], [xe, -sy], [-xe, sy], [xe, sy]]) {
        const [px, py] = P(x, y);
        g.beginPath();
        g.ellipse(px, py, 0.2 * V.k, 0.2 * V.k * Math.sin(V.tilt), 0, 0, TAU);
        g.fillStyle = '#140A04';
        g.fill();
      }
      // box joints at the corners: the panels' fingers interlocking, end grain showing
      const fx = 0.5;
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 9; k++) {
          const za = z0 + ((Z - T - z0) * k) / 9;
          const zb = z0 + ((Z - T - z0) * (k + 1)) / 9;
          const q = k % 2
            ? [[sx * X, -Y, za], [sx * X, -Y + fx, za], [sx * X, -Y + fx, zb], [sx * X, -Y, zb]]
            : [[sx * (X - fx), -Y, za], [sx * X, -Y, za], [sx * X, -Y, zb], [sx * (X - fx), -Y, zb]];
          // only on a face you can see
          const nrm = k % 2 ? [sx, 0, 0] : [0, -1, 0];
          if (dot(V.turn(nrm), V.eye) <= 0.02) continue;
          const poly = q.map((p) => V.at(p));
          g.fillStyle = k % 2 ? 'rgba(30,14,4,.35)' : 'rgba(20,8,2,.42)';
          g.beginPath();
          poly.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.closePath();
          g.fill();
          g.strokeStyle = 'rgba(0,0,0,.35)';
          g.lineWidth = 0.8;
          g.stroke();
        }
      }
      // a round port in the end you can see, to let the sound out
      const endX = dot(V.turn([1, 0, 0]), V.eye) > 0 ? X : -X;
      if (Math.abs(dot(V.turn([1, 0, 0]), V.eye)) > 0.05) {
        const ring = [];
        for (let k = 0; k <= 40; k++) {
          const a = (k / 40) * TAU;
          ring.push(V.at([endX, Math.cos(a) * 1.15, 3.6 + Math.sin(a) * 1.15]));
        }
        g.fillStyle = '#120804';
        g.beginPath();
        ring.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(214,150,96,.4)';
        g.lineWidth = Math.max(1, V.k * 0.08);
        g.stroke();
      }
      // the edge of each tongue, rounded off
      g.strokeStyle = 'rgba(255,214,170,.18)';
      g.lineWidth = Math.max(0.8, V.k * 0.04);
      for (const t of tongue) {
        g.beginPath();
        t.poly.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.stroke();
      }
    },
    live(g, s, now) {
      for (const t of tongue) {
        const p = parts[t.i];
        const age = p.at ? (now - p.at) / 1000 : 9;
        if (age > 0.6) continue;
        // the struck tongue glows as it rings
        g.save();
        g.globalAlpha = 0.22 * Math.exp(-age * 6) * (0.5 + p.power);
        g.fillStyle = '#FFE2B0';
        g.beginPath();
        t.poly.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
        g.restore();
        // the mallet: the left hand plays the high tongue, the right the low
        const [hx, hy] = P(lerp(t.free, t.free === t.x0 ? t.x1 : t.x0, 0.22 + p.x * 0.1), p.y * sy * 0.6);
        const dir = tall ? [1, t.i ? -0.2 : 0.3] : [t.i ? 0.6 : -0.6, 1];
        striker(g, V, p, now, hx, hy - 0.6 * V.k * Math.cos(V.tilt), dir[0], dir[1], { len: 10, w: 0.32, head, color: '#D8B37A' });
      }
    },
    hit(u, v) {
      if (!inside(topPoly, u, v)) return null;
      const [x, y] = onTop(u, v);
      const t = x < xc ? tongue[0] : tongue[1];
      const len = Math.abs(t.x1 - t.x0);
      return { i: t.i, d: clamp(Math.abs(x - t.free) / len, 0, 1), x: (x - t.free) / len, y: clamp(y / sy, -1, 1) };
    },
    at: (i, where) => {
      const t = tongue[i];
      const x = lerp(t.free, t.free === t.x0 ? t.x1 : t.x0, where === 'edge' ? 0.8 : 0.3);
      return P(x, 0);
    },
    tag(i) {
      const t = tongue[i];
      const mx = (t.x0 + t.x1) / 2;
      if (tall) {
        const [x, y] = P(mx, -Y);
        return { name: [x - V.k * 4.4, y], key: [x - V.k * 4.4, y + 18] };
      }
      const [x, y] = P(mx, Y);
      return { name: [x, y - 16], key: [P(mx, -Y)[0], V.at([mx, -Y, 0])[1] + 18] };
    },
  };
}

/* ---------- sleigh bells ---------- */

/* Sleigh bells lying on the mat: a dozen brass bells, an inch across, each with a loose ball
   inside and a slit to let the sound out, on a loop of leather strap with a wooden handle. */
function sleighScene(s, parts) {
  const tall = s.H > s.W * 1.05;
  const V = view(rad(62));
  const F = frame(tall ? rad(-75) : rad(-28));
  const ra = 3.4;
  const rs = 2.7;
  const cen = 3.5;
  const hz = 0.55;
  // the loop: an oval, from the handle's top round and back
  const loopAt = (t) => {
    const a = Math.PI + t * TAU;
    return { p: F.at(cen + Math.cos(a) * ra, Math.sin(a) * rs, 0), o: norm(add(mul(F.A, Math.cos(a) / ra), mul(F.S, Math.sin(a) / rs))) };
  };
  const secs = [];
  for (let k = 0; k <= 64; k++) {
    const { p, o } = loopAt(k / 64);
    const sec = [];
    for (const [w, h] of [[-0.06, 0.05], [0.06, 0.05], [0.06, 0.95], [-0.06, 0.95]]) sec.push(add(add(p, mul(o, w)), [0, 0, h]));
    secs.push(sec);
  }
  const leather = { kind: 'paint', color: '#5C2C14', amb: 0.4, gloss: 0.3, shine: 18 };
  const strap = loft(secs, { m: leather, centre: F.at(cen, 0, 0.5) });
  const ws = woodScale(V);
  const handle = [
    ...turned([[0, 0], [0.05, 0.34], [0.2, 0.52], [0.5, 0.58], [0.8, 0.5], [1.2, 0.46], [3.6, 0.52], [4.4, 0.48], [4.7, 0.5], [4.72, 0]], { c: F.at(-5.2, 0, hz), ax: F.A, n: 22, m: grainy('rosewood', { angle: screenAngle(V, F.A), scale: ws, seed: 2, lift: 0.34, gloss: 0.6, shine: 34 }) }),
    ...turned([[0, 0], [0, 0.56], [0.7, 0.56], [0.75, 0.45], [0.75, 0]], { c: F.at(-0.55, 0, hz), ax: F.A, n: 22, m: { kind: 'metal', ramp: 'brass', rough: 0.2, floor: STRAW } }),
  ];
  const n = 12;
  const bells = Array.from({ length: n }, (_, k) => {
    const t = (k + 0.5) / n;
    const { p, o } = loopAt(t);
    return { at: add(add(p, mul(o, 0.62)), [0, 0, 0.55]), o, k };
  });
  const all = [...strap, ...handle];
  V.fit([...all.flatMap((f) => f.p), ...bells.flatMap((b) => [add(b.at, mul(b.o, 0.6)), add(b.at, [0, 0, 0.6])])], room(s, { top: 24, bottom: fine() ? 34 : 18, side: 24 }), 70);
  const shade = shadows(s, V, all, { cast: 0.4, under: 0.6 });
  const R = 0.55 * V.k;
  const brass = ball(s, R, { kind: 'metal', ramp: 'brass', rough: 0.12, floor: STRAW });
  const bellShade = picture(s, { x0: -R * 1.6, y0: -R * 1.6, x1: R * 1.6, y1: R * 1.6 }, (g) => {
    const gr = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.5);
    gr.addColorStop(0, 'rgba(0,0,0,.5)');
    gr.addColorStop(0.55, 'rgba(0,0,0,.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(-R * 1.6, -R * 1.6, R * 3.2, R * 3.2);
  });
  for (const b of bells) {
    b.s = V.at(b.at);
    b.far = dot(V.turn(b.o), V.eye) < -0.15;
    b.phase = b.k * 1.7;
    // the slit: across the side of the bell facing away from the strap
    const side = norm(cross(b.o, [0, 0, 1]));
    b.slit = [];
    for (let j = 0; j <= 10; j++) {
      const a = (-0.55 + (j / 10) * 1.1);
      const d = norm(add(mul(b.o, Math.cos(a)), mul(side, Math.sin(a))));
      const q = add(b.at, add(mul(d, 0.53), [0, 0, -0.06]));
      b.slit.push({ p: V.at(q), seen: dot(V.turn(d), V.eye) > 0.05 });
    }
  }
  const strapPic = picture(s, extent(V, all), (g) => {
    render(g, V, all);
    // stitching along its top edge
    g.strokeStyle = 'rgba(240,214,170,.55)';
    g.lineWidth = Math.max(0.6, V.k * 0.025);
    g.setLineDash([V.k * 0.12, V.k * 0.1]);
    g.beginPath();
    for (let k = 0; k <= 120; k++) {
      const { p, o } = loopAt(k / 120);
      const [x, y] = V.at(add(add(p, mul(o, 0.065)), [0, 0, 0.8]));
      if (k) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    g.setLineDash([]);
  });
  const outline = hull([...all.flatMap((f) => f.p.map((p) => V.at(p))), ...bells.map((b) => b.s)]);
  const handleAt = V.at(F.at(-2.6, 0, hz));
  const ringAt = V.at(F.at(cen, 0, hz));

  function bell(g, b, dx, dy) {
    show(g, bellShade, { dx: b.s[0] + dx + R * 0.25, dy: b.s[1] + dy + R * 0.5 });
    show(g, brass, { dx: b.s[0] + dx, dy: b.s[1] + dy });
    g.save();
    g.translate(dx, dy);
    g.strokeStyle = 'rgba(30,16,2,.85)';
    g.lineCap = 'round';
    g.lineWidth = Math.max(1, V.k * 0.08);
    g.beginPath();
    let on = false;
    for (const q of b.slit) {
      if (!q.seen) { on = false; continue; }
      if (on) g.lineTo(q.p[0], q.p[1]);
      else g.moveTo(q.p[0], q.p[1]);
      on = true;
    }
    g.stroke();
    g.fillStyle = 'rgba(30,16,2,.9)';
    for (const q of [b.slit[0], b.slit[b.slit.length - 1]]) {
      if (!q.seen) continue;
      g.beginPath();
      g.arc(q.p[0], q.p[1], Math.max(1.2, V.k * 0.09), 0, TAU);
      g.fill();
    }
    g.restore();
  }
  const order = [...bells].sort((a, b) => b.s[2] - a.s[2]);
  return {
    still(g, s) {
      mat(g, s.W, s.H, { k: V.k, tilt: V.tilt, x: s.W / 2, y: s.H * 0.5 });
      shade.forEach((p) => show(g, p));
    },
    live(g, s, now) {
      const p = parts[0];
      const [ox, oy] = sway(p, now, V.k * 1.2);
      const [jx, jy] = shiver(p, now, 2);
      const t = p.at ? (now - p.at) / 1000 : 9;
      const each = (b) => {
        const e = t < 0.6 ? Math.exp(-t * 8) * (0.5 + p.power) * V.k * 0.12 : 0;
        return [ox + jx + Math.sin(t * 70 + b.phase) * e, oy + jy + Math.cos(t * 61 + b.phase) * e];
      };
      for (const b of order) if (b.far) bell(g, b, ...each(b));
      show(g, strapPic, { dx: ox + jx, dy: oy + jy });
      for (const b of order) if (!b.far) bell(g, b, ...each(b));
      if (p.hold || (p.let && now - p.let.at < 1200)) s.animate(120);
    },
    hit(u, v) {
      return inside(outline, u, v) ? { i: 0, d: 0, x: 0, y: 0 } : null;
    },
    at: (i, where) => (where === 'edge' ? handleAt : order[order.length - 1].s.slice(0, 2)),
    tag: () => {
      const b = extent(V, all);
      return { name: null, key: [(b.x0 + b.x1) / 2, Math.min(s.H - 10, b.y1 + R + 22)] };
    },
    ringAt,
  };
}

const SCENES = { drum: congaScene, bongo: bongoScene, agogo: agogoScene, bell: cowbellScene, claves: clavesScene, guiro: guiroScene, shaker: shakerScene, cabasa: cabasaScene, slit: slitScene, sleigh: sleighScene };
