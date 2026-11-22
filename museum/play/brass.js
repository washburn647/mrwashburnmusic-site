/* Trumpet, French horn, trombone, tuba, drawn from the real instruments' measurements. The
   player is on the left: the lips are there (below, on a tall screen), the mouthpiece points
   at them, and the bell goes out to the right (up, on the tuba). Valve 1 is the one nearest
   the mouthpiece, as on the real thing. Touch the lips to buzz; higher up is tighter lips,
   which jump to the next note of the harmonic series. Out toward the wide end is louder. On a
   computer: A S D F are the valves, 1 to 7 the slide positions, the mouse buzzes on the lips
   (or hold Space), and the up and down arrows move the lips. */

import { surface, rr, label, fine } from '../surface.js';
import { pitched } from '../audio.js';
import { metal, pin, pool, layer, put, TAU, sides, outline } from '../paint.js';

const VALVE_KEYS = 'asdf';
const LIGHT = [-0.45, -0.89];          // where the light comes from: up and a little left

/* ---- centre lines for tubes ---- */

// Round a bend: centre (cx, cy), radius r, from angle a0 to a1.
function arc(cx, cy, r, a0, a1, n = 18) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}
// A straight run, a point every `step` or so.
function run(x0, y0, x1, y1, step = 6) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
  const out = [];
  for (let k = 0; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  return out;
}
// A cubic curve from p0 to p3.
function curve(p0, p1, p2, p3, n = 24) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const a = (1 - t) ** 3;
    const b = 3 * t * (1 - t) ** 2;
    const c = 3 * t * t * (1 - t);
    const d = t ** 3;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return out;
}
// Runs and bends joined into one line.
function join(...parts) {
  const out = [];
  for (const p of parts) {
    for (const q of p) {
      const l = out[out.length - 1];
      if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6) out.push(q);
    }
  }
  return out;
}
// A U of tubing: legs from (ax, ay) and (bx, by) going (dx, dy) for depth, joined by a half
// circle.
function uLoop(ax, ay, bx, by, dx, dy, depth) {
  const pts = run(ax, ay, ax + dx * depth, ay + dy * depth, depth / 6 || 1);
  const mx = (ax + bx) / 2 + dx * depth;
  const my = (ay + by) / 2 + dy * depth;
  const r = Math.hypot(bx - ax, by - ay) / 2;
  const a0 = Math.atan2(ay - by, ax - bx);
  const turn = Math.cos(a0 + Math.PI / 2 - Math.atan2(dy, dx)) > 0.5 ? Math.PI : -Math.PI;
  for (let k = 1; k < 16; k++) {
    const a = a0 + (turn * k) / 16;
    pts.push([mx + Math.cos(a) * r, my + Math.sin(a) * r]);
  }
  return pts.concat(run(bx + dx * depth, by + dy * depth, bx, by, depth / 6 || 1));
}
// How far along a line each point is, 0 to 1.
function along(pts) {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1] || 1;
  return d.map((v) => v / L);
}

/* ---- painting tubes ---- */

/* The colours of a polished tube from edge to edge: [edge, dark, light, peak, light turned
   from the light, dark turned from the light, light thrown back onto the far edge]. */
const TONES = {
  brass: ['#4A300A', '#9A6E22', '#EBC66C', '#FFF2C4', '#D2A44C', '#875E1C', '#B8903E'],
  silver: ['#46505A', '#8E9AA4', '#E2E8EC', '#FFFFFF', '#B8C2CA', '#6E7A84', '#A6B0B8'],
  nickel: ['#4E5152', '#9C9F9E', '#E6E7E2', '#FAFAF6', '#B4B7B3', '#787C7B', '#A4A7A4'],
};
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixed = new Map();
function mix(a, b, t) {
  const key = `${a}${b}${t}`;
  let v = mixed.get(key);
  if (!v) {
    const [p, q] = [rgb(a), rgb(b)];
    v = `rgb(${p.map((x, i) => Math.round(x + (q[i] - x) * t)).join(',')})`;
    mixed.set(key, v);
  }
  return v;
}
/* Light across a tube from (ax, ay), its side toward the light, to (bx, by). a is how squarely
   the light falls across it: 0 when the tube points at the light (lit evenly, both edges
   alike), 1 when it lies square to it. The shading turns smoothly as a tube bends. */
function lit(c, kind, ax, ay, bx, by, a) {
  const T = TONES[kind] || TONES.brass;
  const q = Math.round(Math.max(0, Math.min(1, a)) * 20) / 20;
  const h = 0.5 - 0.14 * q;
  const gr = c.createLinearGradient(ax, ay, bx, by);
  gr.addColorStop(0, T[0]);
  gr.addColorStop(h - 0.3, T[1]);
  gr.addColorStop(h - 0.12, T[2]);
  gr.addColorStop(h, T[3]);
  gr.addColorStop(h + 0.12, mix(T[2], T[4], q));
  gr.addColorStop(h + 0.3, mix(T[1], T[5], q));
  gr.addColorStop(1, mix(T[0], T[6], q * 0.8));
  return gr;
}
// The light across a piece of tube whose sides are at (lx, ly) and (rx, ry).
function across(c, kind, lx, ly, rx, ry) {
  const n = Math.hypot(lx - rx, ly - ry) || 1;
  const f = ((lx - rx) * LIGHT[0] + (ly - ry) * LIGHT[1]) / n;
  return f >= 0 ? lit(c, kind, lx, ly, rx, ry, f) : lit(c, kind, rx, ry, lx, ly, -f);
}

/* Polished metal along a tube: each short piece lit across its width, reaching a little into
   the next so no seam shows. */
function shine(c, kind, { L, R }) {
  for (let i = 0; i < L.length - 1; i++) {
    const [a, b, cc, d] = [L[i], L[i + 1], R[i + 1], R[i]];
    const lx = (a[0] + b[0]) / 2;
    const ly = (a[1] + b[1]) / 2;
    const rx = (cc[0] + d[0]) / 2;
    const ry = (cc[1] + d[1]) / 2;
    c.fillStyle = across(c, kind, lx, ly, rx, ry);
    const e = 0.25;
    c.beginPath();
    c.moveTo(a[0] - (b[0] - a[0]) * e, a[1] - (b[1] - a[1]) * e);
    c.lineTo(b[0] + (b[0] - a[0]) * e, b[1] + (b[1] - a[1]) * e);
    c.lineTo(cc[0] + (cc[0] - d[0]) * e, cc[1] + (cc[1] - d[1]) * e);
    c.lineTo(d[0] - (cc[0] - d[0]) * e, d[1] - (cc[1] - d[1]) * e);
    c.closePath();
    c.fill();
  }
}

/* A metal tube along a centre line [[x, y]...]: w its half width, or w(t) from end to end (t
   0 to 1 along it), or a list of widths, one for each point. */
function tube(c, pts, w, kind = 'brass', shadow = true) {
  const t = along(pts);
  const ws = Array.isArray(w) ? w : pts.map((_, i) => (typeof w === 'function' ? w(t[i]) : w));
  const o2 = sides(pts.map(([x, y], i) => [x, y, ws[i]]));
  c.save();
  if (shadow) {
    c.shadowColor = 'rgba(0,0,0,.42)';
    c.shadowBlur = 10;
    c.shadowOffsetY = 5;
  }
  outline(c, o2);
  c.fillStyle = kind === 'brass' ? '#4A320A' : '#3A3E40';
  c.fill();
  c.restore();
  shine(c, kind, o2);
  return o2;
}

/* A ring round a tube (a ferrule, a slide's end): at point (x, y) of a tube going (ux, uy),
   w long, h its half height. */
function ferrule(c, x, y, ux, uy, w, h, kind = 'brass') {
  c.save();
  c.translate(x, y);
  c.rotate(Math.atan2(uy, ux));
  const lit = Math.abs(ux) > 0.2 ? ux > 0 : uy < 0;
  c.fillStyle = metal(c, kind, 0, lit ? -h : h, 0, lit ? h : -h);
  rr(c, -w / 2, -h, w, h * 2, Math.min(2, w / 3));
  c.fill();
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.fillRect(-w / 2, -h + 1, Math.max(0.8, w * 0.12), h * 2 - 2);
  c.fillRect(w / 2 - Math.max(0.8, w * 0.12), -h + 1, Math.max(0.8, w * 0.12), h * 2 - 2);
  c.restore();
}

/* A rod or brace from (x0, y0) to (x1, y1), w thick. */
function rod(c, x0, y0, x1, y1, w, kind = 'brass') {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  c.save();
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x0 + 0.8, y0 + w * 0.4 + 1);
  c.lineTo(x1 + 0.8, y1 + w * 0.4 + 1);
  c.strokeStyle = 'rgba(0,0,0,.3)';
  c.lineWidth = w + 1;
  c.stroke();
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  c.strokeStyle = across(c, kind, mx + nx * w * 0.5, my + ny * w * 0.5, mx - nx * w * 0.5, my - ny * w * 0.5);
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.restore();
}

// A bell's rim seen from the side, facing right: the rolled edge, and a glimpse of the inside.
function bellRim(c, x, y, r) {
  c.beginPath();
  c.ellipse(x, y, r * 0.15, r, 0, 0, TAU);
  const ig = c.createLinearGradient(x - r * 0.15, 0, x + r * 0.15, 0);
  ig.addColorStop(0, '#2E1C06');
  ig.addColorStop(0.55, '#7A5418');
  ig.addColorStop(1, '#D8A548');
  c.fillStyle = ig;
  c.fill();
  c.lineWidth = Math.max(2.5, r * 0.07);
  c.strokeStyle = metal(c, 'brass', x, y - r, x, y + r);
  c.stroke();
  c.beginPath();
  c.ellipse(x, y, r * 0.15, r, 0, -Math.PI * 0.5, Math.PI * 0.12);
  c.strokeStyle = 'rgba(255,246,214,.75)';
  c.lineWidth = Math.max(1, r * 0.02);
  c.stroke();
}

// A bell opening upward, seen a little from above: the rim, the bead round it, the dark inside.
function bellMouthUp(c, x, y, r) {
  c.beginPath();
  c.ellipse(x, y, r, r * 0.24, 0, 0, TAU);
  const ig = c.createRadialGradient(x + r * 0.12, y + r * 0.06, r * 0.04, x, y, r);
  ig.addColorStop(0, '#1C1208');
  ig.addColorStop(0.45, '#5E3E10');
  ig.addColorStop(0.8, '#B8862E');
  ig.addColorStop(1, '#EEC978');
  c.fillStyle = ig;
  c.fill();
  c.lineWidth = Math.max(3, r * 0.045);
  c.strokeStyle = metal(c, 'brass', x - r, y - r * 0.24, x + r * 0.6, y + r * 0.24);
  c.stroke();
  c.beginPath();
  c.ellipse(x, y, r * 0.985, r * 0.235, 0, Math.PI * 1.05, Math.PI * 1.6);
  c.strokeStyle = 'rgba(255,248,222,.8)';
  c.lineWidth = Math.max(1, r * 0.012);
  c.stroke();
}

// A mouthpiece in profile, its shank in the receiver at (x, y), its rim toward the player on
// the left (along (ux, uy) backward). len from shank to rim, rim its outer radius.
function mouthpiece(c, x, y, ux, uy, len, rim, kind = 'silver') {
  const pts = [];
  const ws = [];
  for (let k = 0; k <= 40; k++) {
    const t = k / 40;
    pts.push([x - ux * len * t, y - uy * len * t]);
    let w;
    if (t < 0.56) w = rim * (0.36 + 0.1 * (t / 0.56));
    else if (t < 0.93) w = rim * (0.46 + 0.42 * ((t - 0.56) / 0.37) ** 1.7);
    else w = rim * (0.88 + 0.12 * Math.sin(((t - 0.93) / 0.07) * Math.PI * 0.5));
    ws.push(w);
  }
  tube(c, pts, ws, kind);
  const ex = x - ux * len;
  const ey = y - uy * len;
  c.save();
  c.translate(ex, ey);
  c.rotate(Math.atan2(uy, ux));
  c.beginPath();
  c.ellipse(0, 0, rim * 0.12, rim, 0, 0, TAU);
  c.fillStyle = metal(c, kind, 0, -rim, 0, rim);
  c.fill();
  c.beginPath();
  c.ellipse(-rim * 0.02, 0, rim * 0.07, rim * 0.62, 0, 0, TAU);
  c.fillStyle = '#2A2E30';
  c.fill();
  c.restore();
}

// An engraved scroll, as on a bell.
function flourish(c, x, y, size, tilt = 0) {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(96,60,8,.55)';
  c.lineWidth = Math.max(0.8, size * 0.022);
  c.beginPath();
  c.moveTo(-size * 0.5, size * 0.12);
  c.bezierCurveTo(-size * 0.2, -size * 0.22, size * 0.12, size * 0.26, size * 0.48, -size * 0.1);
  c.stroke();
  for (const [cx, cy, r0, dir] of [[-size * 0.24, -size * 0.04, size * 0.12, 1], [size * 0.16, size * 0.06, size * 0.1, -1], [size * 0.42, -size * 0.16, size * 0.05, 1]]) {
    c.beginPath();
    for (let k = 0; k <= 36; k++) {
      const a = (k / 36) * Math.PI * 1.7 * dir;
      const r = r0 * (1 - k / 48);
      if (k) c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    c.stroke();
  }
  // a few leaves along the stem
  c.fillStyle = 'rgba(96,60,8,.4)';
  for (const [lx, ly, a] of [[-size * 0.36, size * 0.02, -0.8], [-size * 0.02, size * 0.06, 0.6], [size * 0.3, size * 0.02, -0.5]]) {
    c.beginPath();
    c.ellipse(lx, ly, size * 0.05, size * 0.018, a, 0, TAU);
    c.fill();
  }
  c.restore();
}

/* A piston valve's casing: the long cylinder, its knurled top cap, the rings, the bottom cap.
   cx its middle, cw its width, from y0 to y1; capT and capB the caps' heights. */
function casing(c, cx, cw, y0, y1, capT, capB) {
  c.save();
  c.shadowColor = 'rgba(0,0,0,.45)';
  c.shadowBlur = 10;
  c.shadowOffsetX = 3;
  c.shadowOffsetY = 4;
  c.fillStyle = metal(c, 'brass', cx - cw / 2, 0, cx + cw / 2, 0);
  c.fillRect(cx - cw / 2, y0, cw, y1 - y0);
  c.restore();
  const knurl = (y, h, w) => {
    c.fillStyle = metal(c, 'brass', cx - w / 2, 0, cx + w / 2, 0);
    rr(c, cx - w / 2, y, w, h, Math.min(3, h / 3));
    c.fill();
    c.fillStyle = 'rgba(70,44,4,.42)';
    const step = Math.max(2.2, w / 11);
    for (let x = cx - w / 2 + step * 0.6; x < cx + w / 2 - 1; x += step) c.fillRect(x, y + h * 0.22, Math.max(0.8, step * 0.32), h * 0.56);
  };
  // the top cap, a little wider than the casing, and its rim
  knurl(y0 - capT, capT, cw * 1.14);
  c.fillStyle = metal(c, 'brass', cx - cw * 0.6, 0, cx + cw * 0.6, 0);
  c.fillRect(cx - cw * 0.6, y0 - capT * 0.18, cw * 1.2, capT * 0.24);
  // rings round the casing near each end
  for (const y of [y0 + capT * 0.45, y1 - capT * 0.45]) {
    c.fillStyle = metal(c, 'brass', cx - cw * 0.55, 0, cx + cw * 0.55, 0);
    c.fillRect(cx - cw * 0.55, y - capT * 0.14, cw * 1.1, capT * 0.28);
    c.fillStyle = 'rgba(60,36,4,.35)';
    c.fillRect(cx - cw * 0.55, y + capT * 0.14 - 0.8, cw * 1.1, 0.8);
  }
  // the bottom cap, knurled, rounded underneath
  knurl(y1, capB * 0.7, cw * 1.08);
  c.beginPath();
  c.ellipse(cx, y1 + capB * 0.68, cw * 0.5, capB * 0.32, 0, 0, Math.PI);
  c.fillStyle = metal(c, 'brass', cx - cw * 0.5, 0, cx + cw * 0.5, 0);
  c.fill();
}

/* A finger button: a metal cup holding a mother-of-pearl top, its top at yt, its underside at
   yb, rx across. Seen a little from above. */
function pearlButton(c, cx, yt, yb, rx, on) {
  const ry = rx * 0.34;
  c.save();
  c.shadowColor = on ? 'rgba(255,205,100,.75)' : 'rgba(0,0,0,.45)';
  c.shadowBlur = on ? 14 : 10;
  c.shadowOffsetY = on ? 0 : 6;
  c.fillStyle = metal(c, 'brass', cx - rx, 0, cx + rx, 0);
  c.beginPath();
  c.ellipse(cx, yb, rx, ry, 0, 0, Math.PI);
  c.lineTo(cx - rx, yt);
  c.ellipse(cx, yt, rx, ry, 0, Math.PI, TAU);
  c.closePath();
  c.fill();
  c.restore();
  c.beginPath();
  c.ellipse(cx, yt, rx, ry, 0, 0, TAU);
  c.fillStyle = metal(c, 'brass', cx - rx, yt - ry, cx + rx, yt + ry);
  c.fill();
  c.beginPath();
  c.ellipse(cx, yt, rx * 0.8, ry * 0.78, 0, 0, TAU);
  const pg = c.createRadialGradient(cx - rx * 0.28, yt - ry * 0.3, 1, cx, yt, rx * 0.85);
  pg.addColorStop(0, '#FFFFFF');
  pg.addColorStop(0.35, on ? '#FFF0C6' : '#F4EFF8');
  pg.addColorStop(0.7, on ? '#EBC66C' : '#DCD4E6');
  pg.addColorStop(1, on ? '#B8862E' : '#B4ABC4');
  c.fillStyle = pg;
  c.fill();
  // the shimmer of mother of pearl
  c.save();
  c.clip();
  c.globalAlpha = 0.22;
  const tints = ['#F4B8C8', '#B8E4D8', '#C4C8F4'];
  tints.forEach((t, i) => {
    c.beginPath();
    c.ellipse(cx + rx * (i - 1) * 0.3, yt + ry * (0.1 - i * 0.1), rx * 0.32, ry * 0.5, 0.3, 0, TAU);
    c.fillStyle = t;
    c.fill();
  });
  c.restore();
}

/* The light running round a valve's loop while it's down, and the air going through it. */
function glow(c, pts, w) {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.shadowColor = 'rgba(255,200,90,.95)';
  c.shadowBlur = 14;
  c.strokeStyle = 'rgba(255,226,150,.5)';
  c.lineWidth = w * 1.5;
  c.beginPath();
  pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
  c.restore();
}
function airDots(c, pts, w, now) {
  const t = along(pts);
  for (let d = 0; d < 3; d++) {
    const at = (((now / 900 + d / 3) % 1) + 1) % 1;
    let k = 1;
    while (k < t.length - 1 && t[k] < at) k++;
    const f = (at - t[k - 1]) / Math.max(1e-6, t[k] - t[k - 1]);
    c.beginPath();
    c.arc(pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f, Math.max(2, w * 0.6), 0, TAU);
    c.fillStyle = 'rgba(255,250,225,.9)';
    c.fill();
  }
}

/* ---- the instruments, in millimetres ----
   Each is laid out from the real measurements. E enlarges the valves (and, by half as much, the
   tubing and bell) and C shortens the long straight tubes: both only as far as a small screen
   needs to leave room for a finger between the valves. On a big screen, they're true to life. */

// The trumpet: from the middle valve (x) and the bell's axis (y, down).
function trumpetAt(E, C) {
  const T = 1 + (E - 1) * 0.5;
  const d = 26 * E;                          // valve to valve
  const cw = 19.5 * E;                       // a casing's width
  const r = 6.4 * T;                         // the tubing's half width
  const xL = -d - cw / 2;
  const xR = d + cw / 2;
  const bow = { x: xL - 52 * E, r: 26 * E }; // the bell bow, behind the valves
  const rcv = bow.x - bow.r - 22 * C;        // the end of the mouthpiece receiver
  const main = { x: xR + 30 * E + 60 * C, y1: 18 * E, y2: 50 * E };   // the main tuning slide
  const rim = main.x + 16 * E + 150 * C;
  const R = 61 * T;                          // the bell's rim
  const V = {
    btnTop: -42 * E, btnBot: -36 * E, travel: 12 * E, btnR: 8.6 * E, stem: 2.3 * E,
    capTop: -20 * E, top: -12 * E, bot: 60 * E, capB: 12 * E, cw, num: 44 * E, numZ: 2 * E,
  };
  return {
    look: 'trumpet', E, T, d, cw, r, xL, xR, bow, rcv, main, rim, R, V,
    yM: 12.5 * T, mp: 66 * T, xs: [-d, 0, d], gap: d,
    loops: [
      uLoop(xL + 1, 24 * E, xL + 1, 40 * E, -1, 0, 30 * E),
      uLoop(-7.5 * E, 62 * E, 7.5 * E, 62 * E, 0, 1, 15 * E),
      uLoop(xR - 1, 28 * E, xR - 1, 46 * E, 1, 0, 40 * E),
    ],
    zoneBot: 85 * E + r,
    x0: rcv - 66 * T - 4, x1: rim + R * 0.16 + 4,
    y0: Math.min(V.btnTop - 2, -R) - 4, y1: Math.max(85 * E + r, 59 * E + r + 6 * E, R) + 4,
  };
}
// The trumpet's bell: a gentle cone from the bow, then the flare (a Bessel horn) to the rim.
function trumpetBell(m) {
  const x0 = 13 * m.T;
  const bes = (x) => m.R * (x0 / (m.rim - x + x0)) ** 0.75;
  const b0 = bes(m.bow.x);
  const end = m.r * 1.16;
  return (x) => {
    const t = Math.max(0, Math.min(1, (x - m.bow.x) / (m.rim - m.bow.x)));
    return m.r + (end - m.r) * t + ((m.R - end) * Math.max(0, bes(x) - b0)) / (m.R - b0);
  };
}

// The tuba: from the first valve (x) and the top of the valve casings (y, down).
function tubaAt(E, C, n) {
  const T = 1 + (E - 1) * 0.5;
  const d = 44 * E;
  const cw = 33 * E;
  const r = 10 * T;
  const xs = [0, d, 2 * d, 3 * d].slice(0, n);
  const xL = -cw / 2;
  const xR = xs[n - 1] + cw / 2;
  const V = {
    btnTop: -54 * E, btnBot: -45 * E, travel: 16 * E, btnR: 12 * E, stem: 3 * E,
    capTop: -14 * E, top: 0, bot: 150 * E, capB: 20 * E, cw, num: 112 * E, numZ: 26 * E,
  };
  const depth = [40, 26, 54, 70];
  const loops = xs.map((x, i) => uLoop(x - 10.5 * E, 166 * E, x + 10.5 * E, 166 * E, 0, 1, depth[i] * E));
  const slideBot = 166 * E + 70 * E + 10.5 * E + r;
  const R = 235 * (1 + (T - 1) * 0.5);                 // the bell's rim
  const x0b = 76 * (R / 235);
  const q0 = (x0b / (900 + x0b)) ** 0.8;
  const base = 30 * T;                                  // the bell branch, low down
  const bx = xR + 100 * T;                              // the bell branch
  // the bell is high enough that it clears the valve buttons
  const clear = bx - xR - 16 * T;
  const Q = q0 + ((clear - base) / (R - base)) * (1 - q0);
  const yRim = V.btnTop - 14 - (x0b / Q ** 1.25 - x0b);
  const lx = xL - 52 * T;                               // the branch down to the bottom bow
  const rc = 66 * T;                                    // the bow's bends
  const yBow = slideBot + 36 * T + 10 * C;              // the bow's centre line, at the bottom
  const rcv = { x: lx - 30 * T - 46 * C, y: -40 * E };  // the mouthpiece receiver
  const mp = 76 * T;
  return {
    look: 'tuba', E, T, d, cw, r, xs, xL, xR, V, loops, R, x0b, q0, base, bx, yRim, lx, rc, yBow, rcv, mp,
    gap: d, zoneBot: slideBot,
    x0: rcv.x - mp - 4, x1: bx + R + 4, y0: yRim - R * 0.26 - 4, y1: yBow + 32 * T + 4,
  };
}
// The tuba's bell branch: as wide as the bottom bow where it leaves it, flaring to the rim.
const tubaBell = (m) => {
  const q = (y) => (m.x0b / (y - m.yRim + m.x0b)) ** 0.8;
  const qb = q(m.yBow - m.rc);
  return (y) => m.base + (m.R - m.base) * Math.max(0, (q(y) - qb) / (1 - qb));
};

// The French horn: from the middle of its coil.
function hornAt(E, C) {
  const T = 1 + (E - 1) * 0.5;
  const r = 6.6 * T;
  const sp = 40 * E;                                    // rotor to rotor
  const rot = 15 * E;                                   // a rotor's casing, its radius
  const xs = [-sp, 0, sp];
  const yRot = -16 * E;
  const Rc = Math.max(142 * T, sp + rot + 6 * r + 20 * E);
  const wraps = [Rc, Rc - 2.4 * r, Rc - 4.8 * r];
  const V = { pad: yRot - 56 * E, travel: 10 * E, padW: 12.5 * E, padH: 8.5 * E, hinge: yRot - 32 * E };
  const depth = [44, 30, 56];
  const loops = xs.map((x, i) => uLoop(x - 8.5 * E, yRot + rot * 0.6, x + 8.5 * E, yRot + rot * 0.6, 0, 1, depth[i] * E * 0.78));
  const R = 150 * (1 + (T - 1) * 0.5);                  // the bell's rim
  const tilt = 0.42;                                    // the bell points down a little, and toward you
  const rim = { x: Rc * 0.62 + R * 0.62 + 80 * C, y: Rc * 0.72 };
  const rcv = { x: -Rc - 28 * T - 44 * C, y: -Rc * 0.56 };
  const mp = 60 * T;
  const slideTop = yRot + rot * 0.6 + 56 * E * 0.78 + 8.5 * E + r;
  return {
    look: 'horn', E, T, r, sp, rot, xs, yRot, Rc, wraps, V, loops, R, tilt, rim, rcv, mp,
    gap: sp, zoneBot: yRot + rot + 6,
    x0: rcv.x - mp - 4, x1: rim.x + R * Math.sin(tilt) + R * 0.45 + 4,
    y0: -Rc - r - 4, y1: Math.max(rim.y + R * Math.cos(tilt) + 4, Rc + r + 4, slideTop + 4),
  };
}

// The trombone: from the back end of the slide (x) and its lower tube (y), the slide closed.
function tromboneAt(C) {
  const k = 0.55 + 0.45 * C;
  const sep = 76;
  const len = 690 * k;                       // the inner slide
  const travel = 565 * k;                    // first position to seventh
  const R = 108;
  return {
    look: 'trombone', sep, ri: 7.1, ro: 7.9, len, travel, R,
    yBell: -sep - 128, yNeck: -sep - 62, rim: 300 + 255 * C, back: -40 - 240 * C,
    mp: 66, start: 46, hand: 96,
    x0: -66 - 12, x1: Math.max(46 + travel + 96 + 34, 46 + len + 10) + 4,
    y0: -sep - 128 - R - 4, y1: 12,
  };
}
const tromboneBell = (m) => {
  const x0 = 14;
  const bes = (x) => m.R * (x0 / (m.rim - x + x0)) ** 0.75;
  const b0 = bes(m.back);
  return (x) => {
    const t = Math.max(0, Math.min(1, (x - m.back) / (m.rim - m.back)));
    return 6.4 + 1.6 * t + ((m.R - 8) * Math.max(0, bes(x) - b0)) / (m.R - b0);
  };
};

export async function mount(stage, ex, kit) {
  const o = ex.opts;
  const parts = o.partials;
  const valves = o.valves || [];
  const slide = !!o.slide;
  const drop = slide ? 6 : valves.reduce((a, b) => a + b, 0);
  const pitchOf = (n) => o.fundamental + 12 * Math.log2(n);
  const lo = Math.floor(pitchOf(parts[0]) - drop - 1);
  const hi = Math.ceil(pitchOf(parts[parts.length - 1]) + 1);
  const inst = await pitched(o.sound, lo, hi);
  const voice = inst.sustain({ attack: 0.035, release: 0.1, glide: 0.018, vibrato: o.vibrato });

  const box = document.createElement('div');
  box.className = 'zone brass';
  stage.append(box);

  const down = new Set();            // valves held (0-based)
  const autoDown = new Set();        // valves held while the instrument plays a tune itself
  const valvePointers = new Map();   // pointer id -> valve
  const keysDown = new Set();
  let pos = 1;                       // trombone slide position, 1..7, continuous
  let slidePointer = null;
  let lip = null;                    // { id, x, y } in the lips area, 0..1
  let keyPartial = 1;
  let spaceBlow = false;
  let sounding = false;

  let G = null;
  let gKey = '';
  // The lips on the left, where the player is, and the instrument to their right; on a tall
  // screen, the instrument above the lips.
  function geom(s) {
    const key = `${s.W}x${s.H}:${fine()}`;
    if (key === gKey) return G;
    gKey = key;
    const tall = s.H > s.W * 1.05;
    if (tall) {
      const h = Math.round(s.H * 0.5);
      G = { tall, A: { x: 0, y: 0, w: s.W, h }, lips: { x: 16, y: h + 6, w: s.W - 32, h: s.H - h - 22 } };
    } else {
      const pw = Math.round(s.W * (slide ? 0.3 : 0.35));
      G = { tall, A: { x: pw, y: 0, w: s.W - pw, h: s.H }, lips: { x: 18, y: 18, w: pw - 32, h: s.H - 36 } };
    }
    G.F = place(G.A);
    G.Z = null;
    // On a phone held upright the whole instrument is too small to finger, so it shows above a
    // close-up of its valves, as a museum label shows a detail: play on the close-up.
    if (tall && !slide && G.F.gap < want()) {
      const h = Math.round(s.H * 0.56);
      G.A = { x: 0, y: 0, w: s.W, h };
      G.lips = { x: 16, y: h + 6, w: s.W - 32, h: s.H - h - 22 };
      const h1 = Math.round(h * 0.4);
      G.F = place({ x: 0, y: 0, w: s.W, h: h1 }, true);
      G.Z = closeUp(G.F.m, { x: 12, y: h1 + 4, w: s.W - 24, h: h - h1 - 10 });
    }
    G.key = key;
    return G;
  }
  const want = () => (fine() ? 40 : 52);
  const inLips = (u, v) => u > G.lips.x - 12 && v > G.lips.y - 12 && u < G.lips.x + G.lips.w + 12 && v < G.lips.y + G.lips.h + 12;

  // Lay the instrument into the area at the scale that fits it, enlarging the valves only as
  // much as a finger needs (and shortening the long tubes a little before enlarging them more).
  function place(A, real = false) {
    const pad = 20;
    const out = (m, k, extraB = 0) => {
      const ox = A.x + (A.w - (m.x1 - m.x0) * k) / 2 - m.x0 * k;
      const oy = A.y + (A.h - extraB - (m.y1 - m.y0) * k) / 2 - m.y0 * k;
      return { m, k, gap: (m.gap || 0) * k, X: (v) => ox + v * k, Y: (v) => oy + v * k, K: (v) => v * k };
    };
    if (slide) {
      const m = tromboneAt(Math.max(0.6, Math.min(1, (A.w - 40) / 860)));
      const k = Math.min((A.w - pad * 2) / (m.x1 - m.x0), (A.h - pad * 2 - 56) / (m.y1 - m.y0));
      return out(m, k, 56);
    }
    const build = o.look === 'horn' ? hornAt : o.look === 'tuba' ? (E, C) => tubaAt(E, C, valves.length) : trumpetAt;
    if (real) {
      const m = build(1.15, 1);
      return out(m, Math.min((A.w - pad * 2) / (m.x1 - m.x0), (A.h - pad * 2) / (m.y1 - m.y0)));
    }
    const need = want();
    let best = null;
    let most = null;
    for (const C of [1, 0.9, 0.8, 0.7, 0.6]) {
      for (let E = 1.15; E < 2.41; E += 0.05) {
        const m = build(E, C);
        const k = Math.min((A.w - pad * 2) / (m.x1 - m.x0), (A.h - pad * 2) / (m.y1 - m.y0));
        const gap = m.gap * k;
        if (!most || gap > most.gap) most = { m, k, gap };
        if (gap >= need) {
          const cost = E - 1.15 + 2.5 * (1 - C);
          if (!best || cost < best.cost) best = { m, k, cost };
          break;
        }
      }
    }
    const { m, k } = best || most;
    return out(m, k);
  }

  // The close-up: the valves' tops, the buttons (or the horn's levers) as big as fingers.
  function closeUp(m, B) {
    const n = m.xs.length;
    const g = m.gap;
    const x0 = m.xs[0] - g * 0.8;
    const x1 = m.xs[n - 1] + g * 0.8;
    const y0 = m.look === 'horn' ? m.V.pad - m.V.padH - g * 0.3 : m.V.btnTop - g * 0.32;
    const y1 = m.look === 'horn' ? m.yRot + m.rot + g * 0.25 : m.V.top + g * 0.95;
    const k = Math.min(B.w / (x1 - x0), B.h / (y1 - y0));
    const ox = B.x + (B.w - (x1 - x0) * k) / 2 - x0 * k;
    const oy = B.y + (B.h - (y1 - y0) * k) / 2 - y0 * k;
    return { m, k, gap: g * k, box: B, roi: { x0, y0, x1, y1 }, X: (v) => ox + v * k, Y: (v) => oy + v * k, K: (v) => v * k };
  }

  // ---- what note is playing ----
  const bandOf = (y) => Math.max(0, Math.min(parts.length - 1, Math.floor(y * parts.length)));
  function current() {
    let semis = 0;
    if (slide) semis = pos - 1;
    else for (const v of new Set([...down, ...autoDown])) semis += valves[v];
    let band;
    let bend = 0;
    let loud = 0.75;
    if (lip) {
      band = bandOf(lip.y);
      const inBand = lip.y * parts.length - band;
      bend = (inBand - 0.5) * 0.3;
      loud = 0.35 + 0.6 * lip.x;
    } else {
      band = keyPartial;
    }
    return { midi: pitchOf(parts[band]) - semis + bend, band, loud };
  }

  function update(attack = false) {
    const playing = !!lip || spaceBlow;
    if (!playing) {
      if (sounding) { voice.stop(); sounding = false; }
      kit.note(null);
      s.redraw();
      return;
    }
    const c = current();
    const fresh = !sounding || attack;
    if (fresh) {
      voice.start(c.midi, c.loud);
      sounding = true;
    } else {
      voice.pitch(c.midi);
      voice.level(c.loud, 0.06);
    }
    kit.note(c.midi, fresh ? 'fresh' : undefined);
    s.redraw();
  }

  // ---- the slide ----
  // Each position is a little farther than the last, as on a real trombone.
  const SLIDE_K = 2 ** (6 / 12) - 1;
  const slideMM = (p) => G.F.m.travel * ((2 ** ((p - 1) / 12) - 1) / SLIDE_K);
  const slideSpan = () => {
    const { m, X } = G.F;
    return { a: X(m.start + m.hand), b: X(m.start + m.hand + m.travel) };
  };
  const slideU = (p) => G.F.X(G.F.m.start + G.F.m.hand + slideMM(p));
  const posAt = (u) => {
    const { a, b } = slideSpan();
    const f = Math.max(0, Math.min(1, (u - a) / (b - a)));
    return 1 + 12 * Math.log2(1 + f * SLIDE_K);
  };

  // ---- the valves ----
  // Which valve a finger at (u, v) is on: the nearest, in a column as wide as the space
  // between them, from above its button to the bottom of its tubing.
  function valveAt(u, v) {
    if (G.Z) {
      const B = G.Z.box;
      if (u > B.x && u < B.x + B.w && v > B.y && v < B.y + B.h) return valveIn(G.Z, u, v, true);
    }
    return valveIn(G.F, u, v, false);
  }
  function valveIn(F, u, v, whole) {
    const { m, X, Y, K } = F;
    const half = K(m.gap) / 2;
    const top = m.look === 'horn' ? Y(m.V.pad) - K(m.V.padH) : Y(m.V.btnTop);
    if (!whole && (v < top - Math.max(30, half) || v > Y(m.zoneBot) + 12)) return -1;
    let best = -1;
    let bd = Infinity;
    m.xs.forEach((x, i) => {
      const dd = Math.abs(u - X(x));
      if (dd < bd) { bd = dd; best = i; }
    });
    const edge = best === 0 || best === m.xs.length - 1;
    return bd <= half * (edge ? 1.6 : 1) ? best : -1;
  }

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p) {
      if (inLips(p.u, p.v)) {
        lip = { id: p.id, x: lipXof(p.u), y: lipYof(p.v) };
        update(true);
        return;
      }
      if (slide) {
        slidePointer = p.id;
        pos = posAt(p.u);
        update();
        return;
      }
      const i = valveAt(p.u, p.v);
      if (i < 0) return;
      valvePointers.set(p.id, i);
      down.add(i);
      update();
    },
    move(p) {
      if (lip && lip.id === p.id) {
        lip.x = lipXof(p.u);
        lip.y = lipYof(p.v);
        update();
      } else if (slidePointer === p.id) {
        pos = posAt(p.u);
        update();
      }
    },
    up(p) {
      if (lip && lip.id === p.id) { lip = null; update(); return; }
      if (slidePointer === p.id) { slidePointer = null; s.redraw(); return; }
      if (valvePointers.has(p.id)) {
        const i = valvePointers.get(p.id);
        valvePointers.delete(p.id);
        if (![...valvePointers.values()].includes(i) && !keysDown.has(i)) down.delete(i);
        update();
      }
    },
  });
  s.onresize = geom;
  geom(s);

  // The lips: 0..1 from soft (the narrow end, toward the mouthpiece) to loud, and from low to
  // high.
  const lipXof = (u) => {
    const f = Math.max(0, Math.min(1, (u - G.lips.x) / G.lips.w));
    return G.tall ? f : 1 - f;
  };
  const lipU = (f) => (G.tall ? G.lips.x + f * G.lips.w : G.lips.x + (1 - f) * G.lips.w);
  const lipYof = (v) => Math.max(0, Math.min(0.9999, 1 - (v - G.lips.y) / G.lips.h));

  function draw(g, s) {
    geom(s);
    const c = current();
    put(g, s, layer(s, 'brass', `${o.look}:${G.key}`, (L) => paintStill(L, s)));
    g.save();
    g.beginPath();
    g.rect(G.A.x, G.A.y, G.A.w, G.A.h);
    g.clip();
    if (slide) drawSlide(g, s);
    else if (o.look === 'horn') drawLevers(g, s, G.F, !G.Z);
    else drawPistons(g, s, G.F, !G.Z);
    g.restore();
    if (G.Z) {
      const B = G.Z.box;
      g.save();
      rr(g, B.x, B.y, B.w, B.h, 16);
      g.clip();
      if (o.look === 'horn') drawLevers(g, s, G.Z, true);
      else drawPistons(g, s, G.Z, true);
      g.restore();
    }
    drawLips(g, s, c);
  }

  /* The lips: the notes of the harmonic series one above the other, each a hairpin from soft
     (narrow, toward the mouthpiece) to loud. Each shows the note it plays with the valves (or
     slide) as they are. */
  function drawLips(g, s, c) {
    const { x, w, y: top, h } = G.lips;
    const bh = h / parts.length;
    let semis = 0;
    if (slide) semis = pos - 1;
    else for (const v of new Set([...down, ...autoDown])) semis += valves[v];
    g.save();
    g.shadowColor = 'rgba(0,0,0,.5)';
    g.shadowBlur = 16;
    g.shadowOffsetY = 6;
    rr(g, x, top, w, h, 18);
    const pg = g.createLinearGradient(x, top, x + w, top + h);
    pg.addColorStop(0, '#1C1410');
    pg.addColorStop(1, '#120D0A');
    g.fillStyle = pg;
    g.fill();
    g.restore();
    g.save();
    rr(g, x, top, w, h, 18);
    g.clip();
    // drawn narrow end on the left, and turned round when the mouthpiece is to the right
    const flip = !G.tall;
    for (let i = 0; i < parts.length; i++) {
      const y = top + h - (i + 1) * bh;
      const active = (lip || spaceBlow) && c.band === i;
      g.save();
      if (flip) {
        g.translate(x * 2 + w, 0);
        g.scale(-1, 1);
      }
      const grad = g.createLinearGradient(x, 0, x + w, 0);
      const tone = 0.32 + (i / parts.length) * 0.3;
      grad.addColorStop(0, `rgba(226,180,74,${tone * 0.2})`);
      grad.addColorStop(0.6, `rgba(226,180,74,${tone * 0.6})`);
      grad.addColorStop(1, `rgba(240,200,100,${tone})`);
      if (active) {
        g.shadowColor = 'rgba(255,214,120,.9)';
        g.shadowBlur = 18;
      }
      g.fillStyle = active ? 'rgba(250,224,150,.92)' : grad;
      g.beginPath();
      g.moveTo(x, y + bh * 0.44);
      g.quadraticCurveTo(x + w * 0.6, y + bh * 0.3, x + w, y + 4);
      g.lineTo(x + w, y + bh - 4);
      g.quadraticCurveTo(x + w * 0.6, y + bh * 0.7, x, y + bh * 0.56);
      g.closePath();
      g.fill();
      g.restore();
      // a fine groove between the notes
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.fillRect(x, y, w, 1.5);
      g.fillStyle = 'rgba(255,230,180,.06)';
      g.fillRect(x, y + 1.5, w, 1);
      const m = pitchOf(parts[i]) - semis;
      if (bh > 16) {
        label(g, s, kit.name ? kit.name(m) : '', flip ? x + w - 16 : x + 16, y + bh / 2, {
          size: Math.min(13, bh * 0.36), color: active ? '#2A1A04' : 'rgba(246,231,200,.5)', weight: 600, align: flip ? 'right' : 'left',
        });
      }
    }
    g.restore();
    g.save();
    rr(g, x, top, w, h, 18);
    g.lineWidth = 2.5;
    g.strokeStyle = metal(g, 'brass', x, top, x + w, top + h);
    g.stroke();
    g.restore();
    // the lips themselves, where the finger is
    if (lip) {
      const lx = lipU(lip.x);
      const ly = top + h - lip.y * h;
      g.save();
      g.shadowColor = 'rgba(255,214,140,.9)';
      g.shadowBlur = 24;
      const lg = g.createLinearGradient(0, ly - 16, 0, ly + 16);
      lg.addColorStop(0, '#E99C88');
      lg.addColorStop(0.5, '#F7C2B0');
      lg.addColorStop(1, '#D98670');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(lx - 28, ly);
      g.bezierCurveTo(lx - 18, ly - 16, lx - 6, ly - 13, lx, ly - 9);
      g.bezierCurveTo(lx + 6, ly - 13, lx + 18, ly - 16, lx + 28, ly);
      g.bezierCurveTo(lx + 16, ly + 17, lx - 16, ly + 17, lx - 28, ly);
      g.fill();
      g.restore();
      g.strokeStyle = '#A4483A';
      g.lineWidth = 2;
      g.beginPath();
      for (let k = -26; k <= 26; k += 2) g.lineTo(lx + k, ly + Math.sin(k * 0.9 + performance.now() / 18) * 2.2 * (1 - Math.abs(k) / 30));
      g.stroke();
      s.animate(100);
    }
  }

  /* ---- what doesn't move: the room, and the instrument but for its valves (or slide) ---- */

  function paintStill(c, s) {
    const bg = c.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#1E2A23');
    bg.addColorStop(1, '#141E18');
    c.fillStyle = bg;
    c.fillRect(0, 0, s.W, s.H);
    const A = G.A;
    pool(c, A.x + A.w * 0.5, A.y + A.h * 0.5, Math.max(A.w, A.h) * 0.6, '#2E4236', 0.5, 0.8);
    c.save();
    c.beginPath();
    c.rect(A.x, A.y, A.w, A.h);
    c.clip();
    paintInstrument(c, G.F);
    c.restore();
    if (G.Z) paintCloseUp(c, G.Z);
  }
  function paintInstrument(c, F) {
    if (F.m.look === 'trombone') paintTrombone(c, F);
    else if (F.m.look === 'horn') paintHorn(c, F);
    else if (F.m.look === 'tuba') paintTuba(c, F);
    else paintTrumpet(c, F);
  }
  // The close-up below the whole instrument: a frame round its valves, lines down to a panel,
  // and the valves again in it, large.
  function paintCloseUp(c, Z) {
    const B = Z.box;
    const F = G.F;
    const { x0, y0, x1, y1 } = Z.roi;
    const [fx0, fy0, fx1, fy1] = [F.X(x0), F.Y(y0), F.X(x1), F.Y(y1)];
    c.save();
    c.strokeStyle = 'rgba(246,231,200,.42)';
    c.lineWidth = 1.2;
    rr(c, fx0, fy0, fx1 - fx0, fy1 - fy0, 4);
    c.stroke();
    c.setLineDash([3, 4]);
    c.strokeStyle = 'rgba(246,231,200,.28)';
    c.beginPath();
    c.moveTo(fx0 + 2, fy1);
    c.lineTo(B.x + 16, B.y + 1);
    c.moveTo(fx1 - 2, fy1);
    c.lineTo(B.x + B.w - 16, B.y + 1);
    c.stroke();
    c.restore();
    c.save();
    c.shadowColor = 'rgba(0,0,0,.5)';
    c.shadowBlur = 14;
    c.shadowOffsetY = 5;
    rr(c, B.x, B.y, B.w, B.h, 16);
    const pg = c.createRadialGradient(B.x + B.w / 2, B.y + B.h * 0.4, 10, B.x + B.w / 2, B.y + B.h / 2, Math.max(B.w, B.h) * 0.7);
    pg.addColorStop(0, '#2C3F33');
    pg.addColorStop(1, '#141D18');
    c.fillStyle = pg;
    c.fill();
    c.restore();
    c.save();
    rr(c, B.x, B.y, B.w, B.h, 16);
    c.clip();
    paintInstrument(c, Z);
    c.restore();
    c.save();
    rr(c, B.x, B.y, B.w, B.h, 16);
    c.lineWidth = 2;
    c.strokeStyle = metal(c, 'brass', B.x, B.y, B.x + B.w, B.y + B.h);
    c.stroke();
    c.restore();
  }

  const mapper = (F) => (pts) => pts.map(([x, y]) => [F.X(x), F.Y(y)]);

  function paintTrumpet(c, F) {
    const { m, X, Y, K } = F;
    const { E, T, d, cw, r, xL, xR, bow, main, V } = m;
    const P = mapper(F);
    const bell = trumpetBell(m);
    const step = 2.5 / F.k;
    // The bell section, on the far side: out of the first valve, back round the bell bow,
    // forward over the valves and out to the bell.
    const lower = run(xL + 2, 2 * bow.r, bow.x, 2 * bow.r, 8);
    const bend = arc(bow.x, bow.r, bow.r, Math.PI / 2, Math.PI * 1.5, 28);
    const upper = run(bow.x, 0, m.rim, 0, step);
    const line = join(lower, bend, upper);
    const nb = line.length - upper.length;
    tube(c, P(line), line.map(([x], i) => K(i < nb ? r : bell(x))));
    bellRim(c, X(m.rim), Y(0), K(m.R));
    flourish(c, X(m.rim - m.R * 0.62), Y(m.R * 0.04), K(m.R * 0.46));
    // a brace across the bow
    rod(c, X(bow.x - bow.r * 0.2), Y(r * 0.9), X(bow.x - bow.r * 0.2), Y(2 * bow.r - r * 0.9), K(2.2 * T));
    // The first and third valve slides, on the far side, and the second, under its valve.
    tube(c, P(m.loops[0]), K(r * 0.94));
    tube(c, P(m.loops[2]), K(r * 0.94));
    for (const [lp, at] of [[m.loops[0], 0.18], [m.loops[0], 0.82], [m.loops[2], 0.16], [m.loops[2], 0.84]]) {
      const q = lp[Math.round(at * (lp.length - 1))];
      const q2 = lp[Math.round(at * (lp.length - 1)) + 1];
      ferrule(c, X(q[0]), Y(q[1]), q2[0] - q[0], q2[1] - q[1], K(2.6 * T), K(r * 1.12));
    }
    // the first slide's saddle, for the left thumb
    const sx = xL - 22 * E;
    const sy = 24 * E - r * 0.8;
    rod(c, X(sx - 3.4 * E), Y(sy), X(sx - 3.4 * E), Y(sy - 6 * E), K(1.5 * E));
    rod(c, X(sx + 3.4 * E), Y(sy), X(sx + 3.4 * E), Y(sy - 6 * E), K(1.5 * E));
    c.beginPath();
    c.arc(X(sx), Y(sy - 9.5 * E), K(5 * E), 0.15, Math.PI - 0.15);
    c.lineCap = 'round';
    c.lineWidth = K(1.9 * E);
    c.strokeStyle = metal(c, 'brass', 0, Y(sy - 10 * E), 0, Y(sy - 4 * E));
    c.stroke();
    // the third slide's ring, for the left ring finger
    const rx = xR + 34 * E;
    const ry = 46 * E + r + 7.5 * E;
    rod(c, X(rx), Y(46 * E + r * 0.5), X(rx), Y(ry - 5.5 * E), K(1.6 * E));
    c.beginPath();
    c.arc(X(rx), Y(ry), K(6 * E), 0, TAU);
    c.lineWidth = K(1.9 * E);
    c.strokeStyle = metal(c, 'brass', X(rx - 6 * E), Y(ry - 6 * E), X(rx + 6 * E), Y(ry + 6 * E));
    c.stroke();
    tube(c, P(m.loops[1]), K(r * 0.94));
    // The knuckles between the casings, that take the air from valve to valve.
    for (const x of [-d / 2, d / 2]) tube(c, P(run(x - (d - cw) / 2 - 1, 30 * E, x + (d - cw) / 2 + 1, 30 * E)), K(r * 0.8), 'brass', false);
    // The valve casings.
    for (const x of m.xs) casing(c, X(x), K(cw), Y(V.top), Y(V.bot), K(8 * E), K(V.capB));
    // On the near side: the leadpipe, from the mouthpiece receiver down past the valves into
    // the main tuning slide, which turns back into the third valve.
    const a = [m.rcv + 22 * T, m.yM];
    const ux0 = xR + 12 * E - a[0];
    const uy0 = main.y1 - a[1];
    const ul = Math.hypot(ux0, uy0);
    const u = [ux0 / ul, uy0 / ul];
    const nrm = [-u[1], u[0]];
    const rc = (main.y2 - main.y1) / 2;
    const b = [a[0] + u[0] * ((main.x - a[0]) / u[0]), a[1] + u[1] * ((main.x - a[0]) / u[0])];
    const cc = [b[0] + nrm[0] * rc, b[1] + nrm[1] * rc];
    const a0 = Math.atan2(-nrm[1], -nrm[0]);
    const b2 = [b[0] + nrm[0] * rc * 2, b[1] + nrm[1] * rc * 2];
    const back = (xR - 1 - b2[0]) / -u[0];
    const lowEnd = [b2[0] - u[0] * back, b2[1] - u[1] * back];
    const leadEnd = [a[0] + u[0] * ((xR + 22 * E - a[0]) / u[0]), a[1] + u[1] * ((xR + 22 * E - a[0]) / u[0])];
    tube(c, P(run(a[0], a[1], leadEnd[0], leadEnd[1], 8)), (t) => K(r * (0.78 + 0.22 * t)));
    const slideLine = join(run(leadEnd[0], leadEnd[1], b[0], b[1], 8), arc(cc[0], cc[1], rc, a0, a0 + Math.PI, 22), run(b2[0], b2[1], lowEnd[0], lowEnd[1], 8));
    tube(c, P(slideLine), K(r * 1.04));
    // where the slide's outer tubes begin
    ferrule(c, X(leadEnd[0]), Y(leadEnd[1]), u[0], u[1], K(3.2 * T), K(r * 1.22));
    const lowRing = [b2[0] - u[0] * (back - 10 * E), b2[1] - u[1] * (back - 10 * E)];
    ferrule(c, X(lowRing[0]), Y(lowRing[1]), u[0], u[1], K(3.2 * T), K(r * 1.22));
    // its water key, low on the bend, the lever lying back along the lower tube
    const wa = a0 + Math.PI * 0.72;
    const wk = [cc[0] + Math.cos(wa) * (rc + r * 0.9), cc[1] + Math.sin(wa) * (rc + r * 0.9)];
    const lvEnd = [b2[0] - u[0] * 26 * E + nrm[0] * (r + 1.6 * E), b2[1] - u[1] * 26 * E + nrm[1] * (r + 1.6 * E)];
    rod(c, X(wk[0]), Y(wk[1]), X(lvEnd[0]), Y(lvEnd[1]), K(1.7 * E));
    c.beginPath();
    c.ellipse(X(wk[0]), Y(wk[1]), K(2.6 * E), K(2 * E), wa, 0, TAU);
    c.fillStyle = '#A9784A';
    c.fill();
    pin(c, X(lvEnd[0]), Y(lvEnd[1]), K(1.4 * E), 'brass');
    // a brace from the bell down to the slide
    const bxp = main.x - 10 * E;
    const yTop = (bxp - a[0]) / u[0] * u[1] + a[1];
    rod(c, X(bxp), Y(bell(bxp) * 0.9), X(bxp), Y(yTop - r * 0.9), K(2.4 * T));
    // the finger hook on the leadpipe, for the right little finger
    const hx = xR + 4 * E;
    const hy = (hx - a[0]) / u[0] * u[1] + a[1] - r * 0.7;
    rod(c, X(hx), Y(hy + r * 0.3), X(hx), Y(hy - 3.5 * E), K(1.5 * E));
    c.beginPath();
    c.arc(X(hx + 3.2 * E), Y(hy - 3.5 * E), K(3.2 * E), Math.PI, Math.PI * 2.25);
    c.lineCap = 'round';
    c.lineWidth = K(1.6 * E);
    c.strokeStyle = metal(c, 'brass', 0, Y(hy - 7 * E), 0, Y(hy));
    c.stroke();
    // the receiver, and the mouthpiece in it
    mouthpiece(c, X(a[0] + u[0] * 6 * T), Y(a[1] + u[1] * 6 * T), u[0], u[1], K(m.mp + 6 * T), K(13 * T));
    tube(c, P(run(a[0] - u[0] * 3 * T, a[1] - u[1] * 3 * T, a[0] + u[0] * 26 * T, a[1] + u[1] * 26 * T, 6)), K(7.6 * T));
    ferrule(c, X(a[0] - u[0] * 2 * T), Y(a[1] - u[1] * 2 * T), u[0], u[1], K(3 * T), K(8.4 * T));
    ferrule(c, X(a[0] + u[0] * 26 * T), Y(a[1] + u[1] * 26 * T), u[0], u[1], K(2.4 * T), K(8 * T));
  }

  function paintTuba(c, F) {
    const { m, X, Y, K } = F;
    const { E, T, d, cw, r, xs, xL, xR, V, R, bx, lx, rc, yBow } = m;
    const P = mapper(F);
    const rad = tubaBell(m);
    const step = 2.5 / F.k;
    const yb = yBow - rc;
    // One long tube: out of the first valve, down the branch on the left, round the bottom
    // bow and up the bell branch to the great bell.
    const yJ = 122 * E;
    const rb = 40 * T;
    const wL = r * 1.05;
    const wB = m.base - 9 * T;
    const left = join(run(xL + 2, yJ, lx + rb, yJ, 6), arc(lx + rb, yJ + rb, rb, Math.PI * 1.5, Math.PI, 14), run(lx, yJ + rb, lx, yb, 10));
    const bowLine = join(arc(lx + rc, yb, rc, Math.PI, Math.PI / 2, 18), run(lx + rc, yBow, bx - rc, yBow, 10), arc(bx - rc, yb, rc, Math.PI / 2, 0, 18));
    const branch = run(bx, yb, bx, m.yRim, step);
    const tl = along(left);
    const tb = along(bowLine);
    const all = join(left, bowLine, branch);
    const widths = [...tl.map((t) => wL + (wB - wL) * t), ...tb.slice(1).map((t) => wB + (m.base - wB) * t), ...branch.slice(1).map(([, y]) => rad(y))];
    tube(c, P(all), widths.map(K));
    // the bow's water key, at the bottom
    rod(c, X(lx + rc + 30 * T), Y(yBow + wB * 0.92), X(lx + rc + 74 * T), Y(yBow + wB * 0.86), K(2.6 * T));
    c.beginPath();
    c.ellipse(X(lx + rc + 30 * T), Y(yBow + wB * 0.94), K(4 * T), K(3 * T), 0, 0, TAU);
    c.fillStyle = '#A9784A';
    c.fill();
    // a garland round the bell, and the rim
    const yg = m.yRim + R * 0.16;
    const rg = rad(yg);
    c.beginPath();
    c.rect(X(bx - rg - 2), Y(yg - 4 * T), K(rg * 2 + 4), K(8 * T));
    c.fillStyle = metal(c, 'brass', 0, Y(yg - 4 * T), 0, Y(yg + 4 * T));
    c.save();
    c.beginPath();
    const o2 = sides(branch.map(([x, y]) => [X(x), Y(y), K(rad(y)) + 0.5]));
    outline(c, o2);
    c.clip();
    c.fillStyle = metal(c, 'brass', 0, Y(yg - 5 * T), 0, Y(yg + 5 * T));
    c.fillRect(X(bx - R), Y(yg - 5 * T), K(R * 2), K(10 * T));
    c.fillStyle = 'rgba(70,40,4,.4)';
    c.fillRect(X(bx - R), Y(yg + 5 * T) - 1, K(R * 2), 1);
    c.restore();
    bellMouthUp(c, X(bx), Y(m.yRim), K(R));
    flourish(c, X(bx - rad(m.yRim + R * 0.55) * 0.35), Y(m.yRim + R * 0.55), K(R * 0.34), -0.1);
    // a tuning slide on the left branch: its rings
    for (const y of [yJ + rb + 20 * T, yb - 30 * T]) ferrule(c, X(lx), Y(y), 0, 1, K(5 * T), K((wL + (wB - wL) * 0.7) * 1.12));
    // The valve slides, hanging under their valves.
    m.loops.forEach((lp) => tube(c, P(lp), K(r * 0.92)));
    m.loops.forEach((lp) => {
      const q = lp[3];
      ferrule(c, X(q[0]), Y(q[1]), 0, 1, K(4 * T), K(r * 1.1));
      const q2 = lp[lp.length - 4];
      ferrule(c, X(q2[0]), Y(q2[1]), 0, 1, K(4 * T), K(r * 1.1));
    });
    // From the last valve across to the bell branch: braces.
    for (const y of [30 * E, 128 * E]) rod(c, X(xR - 2), Y(y), X(bx - rad(y) * 0.9), Y(y), K(3 * T));
    rod(c, X(lx + 4 * T), Y(yb - 70 * T), X(xL + 6), Y(yb - 70 * T), K(3 * T));
    // The knuckles between the casings, and the casings.
    for (let i = 0; i < xs.length - 1; i++) tube(c, P(run(xs[i] + cw / 2 - 1, 64 * E, xs[i + 1] - cw / 2 + 1, 64 * E)), K(r * 0.88), 'brass', false);
    xs.forEach((x) => casing(c, X(x), K(cw), Y(V.top), Y(V.bot), K(14 * E), K(V.capB)));
    // The leadpipe: from the mouthpiece down into the first valve.
    const rv = m.rcv;
    const lead = curve([rv.x + 24 * T, rv.y], [xL - 40 * T, rv.y], [xL - 34 * T, 30 * E], [xL + 2, 30 * E], 30);
    tube(c, P(lead), (t) => K(r * (0.68 + 0.32 * t)));
    tube(c, P(run(rv.x - 3 * T, rv.y, rv.x + 26 * T, rv.y, 6)), K(9.4 * T));
    mouthpiece(c, X(rv.x + 6 * T), Y(rv.y), 1, 0, K(m.mp + 6 * T), K(16 * T));
    ferrule(c, X(rv.x - 2 * T), Y(rv.y), 1, 0, K(3.4 * T), K(10.2 * T));
    ferrule(c, X(rv.x + 26 * T), Y(rv.y), 1, 0, K(2.6 * T), K(10 * T));
  }

  function paintHorn(c, F) {
    const { m, X, Y, K } = F;
    const { E, T, r, sp, rot, xs, yRot, Rc, R, tilt, rim } = m;
    const P = mapper(F);
    // The coil: the two inner wraps, whole circles...
    m.wraps.slice(1).forEach((rad, k) => tube(c, P(arc(0, 0, rad, -0.3, TAU - 0.3, 96)), K(r * (0.95 - k * 0.05)), 'brass', false));
    // ...and the outer one, which comes round over the top from the right and goes on, out of
    // the bottom of the coil, into the bell: out and down to the right, flaring wide.
    const spiral = [];
    for (let k = 0; k <= 16; k++) {
      const f = k / 16;
      const a = 0.6 - 0.6 * f;
      const rad = m.wraps[1] + (Rc - m.wraps[1]) * f * f * (3 - 2 * f);
      spiral.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    const wrap = join(spiral, arc(0, 0, Rc, 0, -Math.PI * 1.5, 72));
    const axis = [Math.cos(tilt * 0.55), Math.sin(tilt * 0.55)];
    const line = curve([0, Rc], [Rc * 0.7, Rc * 1.02], [rim.x - axis[0] * R * 0.9, rim.y - axis[1] * R * 0.9], [rim.x, rim.y], 80);
    const t = along(line);
    let Lb = 0;
    for (let i = 1; i < line.length; i++) Lb += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    const x0 = 11 * T;
    const bes = (dist) => R * (x0 / (dist + x0)) ** 0.72;
    const b0 = bes(Lb);
    const ws = [...wrap.map(() => r), ...t.slice(1).map((f) => r * (1 + 0.5 * f) + ((R - r * 1.5) * Math.max(0, bes((1 - f) * Lb) - b0)) / (R - b0))];
    tube(c, P(join(wrap, line)), ws.map(K));
    // little braces between the wraps
    for (const a of [-2.3, -0.75, 2.45, 3.3]) {
      const [c0, s0] = [Math.cos(a), Math.sin(a)];
      rod(c, X(c0 * (m.wraps[2] + r * 0.5)), Y(s0 * (m.wraps[2] + r * 0.5)), X(c0 * (m.wraps[0] - r * 0.5)), Y(s0 * (m.wraps[0] - r * 0.5)), K(2.2 * T));
    }
    // the rim, the bell's mouth seen at an angle
    const ang = Math.atan2(line[line.length - 1][1] - line[line.length - 4][1], line[line.length - 1][0] - line[line.length - 4][0]);
    c.save();
    c.translate(X(rim.x), Y(rim.y));
    c.rotate(ang);
    c.beginPath();
    c.ellipse(0, 0, K(R * 0.4), K(R), 0, 0, TAU);
    const ig = c.createRadialGradient(-K(R * 0.12), 0, K(R * 0.05), 0, 0, K(R));
    ig.addColorStop(0, '#1C1208');
    ig.addColorStop(0.5, '#5E3E10');
    ig.addColorStop(0.85, '#B8862E');
    ig.addColorStop(1, '#EEC978');
    c.fillStyle = ig;
    c.fill();
    c.lineWidth = Math.max(3, K(R * 0.045));
    c.strokeStyle = metal(c, 'brass', 0, -K(R), 0, K(R));
    c.stroke();
    c.beginPath();
    c.ellipse(0, 0, K(R * 0.4), K(R), 0, Math.PI * 1.1, Math.PI * 1.75);
    c.strokeStyle = 'rgba(255,248,222,.8)';
    c.lineWidth = Math.max(1, K(R * 0.012));
    c.stroke();
    c.restore();
    flourish(c, X(rim.x - R * 0.85), Y(rim.y - R * 0.08), K(R * 0.42), ang);
    // The valve slides, inside the coil, and the rotors' ports between them.
    m.loops.forEach((lp) => tube(c, P(lp), K(r * 0.92)));
    for (let i = 0; i < xs.length - 1; i++) tube(c, P(run(xs[i] + rot * 0.8, yRot + rot * 0.3, xs[i + 1] - rot * 0.8, yRot + rot * 0.3)), K(r * 0.85), 'brass', false);
    // from the last rotor out to the inner wrap
    tube(c, P(curve([xs[2] + rot * 0.6, yRot], [xs[2] + rot * 2.2, yRot], [m.wraps[2] - 8 * T, yRot + 26 * E], [m.wraps[2], yRot + 40 * E], 20)), K(r * 0.9));
    // The rotor casings: short drums seen end on, each with its cap.
    xs.forEach((x) => {
      const cx = X(x);
      const cy = Y(yRot);
      c.save();
      c.shadowColor = 'rgba(0,0,0,.45)';
      c.shadowBlur = 8;
      c.shadowOffsetY = 3;
      c.beginPath();
      c.arc(cx, cy, K(rot), 0, TAU);
      c.fillStyle = metal(c, 'brass', cx - K(rot), cy - K(rot), cx + K(rot), cy + K(rot));
      c.fill();
      c.restore();
      c.beginPath();
      c.arc(cx, cy, K(rot * 0.8), 0, TAU);
      c.fillStyle = metal(c, 'brass', cx + K(rot), cy + K(rot), cx - K(rot), cy - K(rot));
      c.fill();
      c.strokeStyle = 'rgba(80,50,6,.5)';
      c.lineWidth = 1;
      c.stroke();
      // the knurled edge of the cap
      c.strokeStyle = 'rgba(70,44,4,.35)';
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * TAU;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * K(rot * 0.86), cy + Math.sin(a) * K(rot * 0.86));
        c.lineTo(cx + Math.cos(a) * K(rot * 0.98), cy + Math.sin(a) * K(rot * 0.98));
        c.stroke();
      }
    });
    // The leadpipe: from the mouthpiece, down across the coil into the first rotor.
    const rv = m.rcv;
    const lead = curve([rv.x + 22 * T, rv.y], [-Rc * 0.62, rv.y + 4 * T], [xs[0] - rot * 2.8, yRot - 10 * E], [xs[0] - rot * 0.8, yRot], 40);
    tube(c, P(lead), (t2) => K(r * (0.62 + 0.38 * t2)));
    // the hinge rod the levers turn on, on its posts
    const hy = Y(m.V.hinge);
    for (const [x, xr] of [[xs[0] - sp * 0.45, xs[0] - rot * 0.62], [xs[2] + sp * 0.45, xs[2] + rot * 0.62]]) rod(c, X(x), hy, X(xr), Y(yRot - rot * 0.72), K(2.4 * E), 'nickel');
    rod(c, X(xs[0] - sp * 0.45), hy, X(xs[2] + sp * 0.45), hy, K(2.6 * E), 'nickel');
    for (const x of [xs[0] - sp * 0.45, xs[2] + sp * 0.45]) pin(c, X(x), hy, K(2.4 * E), 'nickel');
    tube(c, P(run(rv.x - 3 * T, rv.y, rv.x + 24 * T, rv.y, 6)), K(7.4 * T));
    mouthpiece(c, X(rv.x + 6 * T), Y(rv.y), 1, 0, K(m.mp + 6 * T), K(11 * T));
    ferrule(c, X(rv.x - 2 * T), Y(rv.y), 1, 0, K(3 * T), K(8.2 * T));
  }

  function paintTrombone(c, F) {
    const { m, X, Y, K } = F;
    const { sep, ri, R } = m;
    const P = mapper(F);
    const bell = tromboneBell(m);
    const step = 2.5 / F.k;
    const rt = 6.6;
    // The bell section: from the slide back over the player's shoulder (its tuning slide is
    // behind the player) and forward again to the bell, above the slide.
    const rc = (m.yNeck - m.yBell) / 2;
    const goose = curve([0, -sep], [-34, -sep], [-26, m.yNeck], [-62, m.yNeck], 20);
    const neck = run(-62, m.yNeck, m.back, m.yNeck, 10);
    const crook = arc(m.back, (m.yNeck + m.yBell) / 2, rc, Math.PI / 2, Math.PI * 1.5, 20);
    const upper = run(m.back, m.yBell, m.rim, m.yBell, step);
    const line = join(goose, neck, crook, upper);
    const n0 = line.length - upper.length;
    tube(c, P(line), line.map(([x], i) => K(i < n0 ? rt : bell(x))));
    bellRim(c, X(m.rim), Y(m.yBell), K(R));
    flourish(c, X(m.rim - R * 0.7), Y(m.yBell + R * 0.04), K(R * 0.44));
    // the tuning slide's rings, and the bell brace from the bell tube down to the neck
    for (const y of [m.yBell, m.yNeck]) ferrule(c, X(m.back + 60), Y(y), 1, 0, K(4), K(rt * 1.2));
    rod(c, X(-52), Y(m.yBell + rt * 0.8), X(-52), Y(m.yNeck - rt * 0.8), K(4.5));
    rod(c, X(-180), Y(m.yBell + rt * 0.8), X(-180), Y(m.yNeck - rt * 0.8), K(4));
    // The inner slide: two long, thin tubes, nickel silver, that stay put.
    for (const y of [-sep, 0]) tube(c, P(run(0, y, m.len, y, 12)), K(ri), 'nickel');
    // the slide lock, and the inner stay you hold with the left hand
    ferrule(c, X(8), Y(-sep), 1, 0, K(10), K(ri * 1.5));
    rod(c, X(26), Y(-sep), X(26), Y(0), K(6));
    c.save();
    c.fillStyle = '#7A5634';
    rr(c, X(26) - K(4.2), Y(-sep * 0.78), K(8.4), K(sep * 0.56), K(3));
    c.fill();
    c.fillStyle = 'rgba(255,230,190,.18)';
    c.fillRect(X(26) - K(2.6), Y(-sep * 0.76), K(1.4), K(sep * 0.52));
    c.restore();
    // The mouthpiece, in the lower tube's end.
    mouthpiece(c, X(10), Y(0), 1, 0, K(m.mp + 10), K(18));
    ferrule(c, X(2), Y(0), 1, 0, K(6), K(ri * 1.4));
    // the positions, as a player learns them
    for (let p = 1; p <= 7; p++) {
      c.beginPath();
      c.arc(slideU(p), Y(0) + Math.max(22, K(36)), Math.max(2.5, K(3)), 0, TAU);
      c.fillStyle = 'rgba(246,231,200,.3)';
      c.fill();
    }
  }

  /* ---- what moves ---- */

  // Piston valves (trumpet, tuba): the buttons go down, and a pressed valve's loop lights up.
  function drawPistons(g, s, F, words) {
    const { m, X, Y, K } = F;
    const V = m.V;
    const now = performance.now();
    const blowing = (lip || spaceBlow) && sounding;
    const P = mapper(F);
    m.xs.forEach((x, i) => {
      if (!(down.has(i) || autoDown.has(i))) return;
      const pts = P(m.loops[i]);
      glow(g, pts, K(m.r));
      if (blowing) { airDots(g, pts, K(m.r), now); s.animate(100); }
    });
    m.xs.forEach((x, i) => {
      const on = down.has(i) || autoDown.has(i);
      const cx = X(x);
      const press = on ? K(V.travel) : 0;
      const yb = Y(V.btnBot) + press;
      const yt = Y(V.btnTop) + press;
      const sw = K(V.stem);
      g.fillStyle = metal(g, 'nickel', cx - sw, 0, cx + sw, 0);
      g.fillRect(cx - sw, yb, sw * 2, Y(V.capTop) - yb + 1);
      // the stem's guide, where it goes into the cap
      g.fillStyle = metal(g, 'brass', cx - sw * 2.2, 0, cx + sw * 2.2, 0);
      g.fillRect(cx - sw * 2.2, Y(V.capTop) - K(2 * m.E), sw * 4.4, K(2 * m.E) + 1);
      pearlButton(g, cx, yt, yb, K(V.btnR), on);
      if (!words) return;
      label(g, s, String(i + 1), cx, Y(F === G.Z ? V.numZ : V.num), { size: Math.max(11, Math.min(20, K(m.cw) * 0.42)), color: 'rgba(84,54,8,.62)', weight: 700 });
      if (fine()) label(g, s, VALVE_KEYS[i].toUpperCase(), cx, yt + 0.5, { size: Math.max(10, Math.min(14, K(V.btnR) * 0.95)), color: on ? 'rgba(70,40,0,.8)' : 'rgba(60,44,70,.75)', weight: 700 });
    });
  }

  // The horn's levers: a brass spatula for each finger, on a hinge, linked down to its rotor,
  // which turns a quarter when the lever is down.
  function drawLevers(g, s, F, words) {
    const { m, X, Y, K } = F;
    const { E, xs, yRot, rot, V } = m;
    const now = performance.now();
    const blowing = (lip || spaceBlow) && sounding;
    const P = mapper(F);
    xs.forEach((x, i) => {
      if (!(down.has(i) || autoDown.has(i))) return;
      const pts = P(m.loops[i]);
      glow(g, pts, K(m.r));
      if (blowing) { airDots(g, pts, K(m.r), now); s.animate(100); }
    });
    xs.forEach((x, i) => {
      const on = down.has(i) || autoDown.has(i);
      const cx = X(x);
      const cy = Y(yRot);
      // the rotor's stop arm, a quarter turn when the lever is down
      const turn = on ? Math.PI / 2 : 0;
      g.save();
      g.translate(cx, cy);
      g.rotate(-0.6 + turn);
      g.fillStyle = metal(g, 'nickel', -K(rot), -K(3 * E), K(rot), K(3 * E));
      rr(g, -K(rot * 0.2), -K(2.6 * E), K(rot * 1.05), K(5.2 * E), K(2.6 * E));
      g.fill();
      g.restore();
      pin(g, cx, cy, K(3.2 * E), 'nickel');
      const arm = [cx + Math.cos(-0.6 + turn) * K(rot * 0.75), cy + Math.sin(-0.6 + turn) * K(rot * 0.75)];
      // the lever: its pad, its arm to the hinge, and the link down to the rotor's arm
      const press = on ? K(V.travel) : 0;
      const py = Y(V.pad) + press;
      const hy = Y(V.hinge);
      const kx = cx + K(rot * 0.9);
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = metal(g, 'brass', cx - K(4 * E), 0, cx + K(4 * E), 0);
      g.lineWidth = K(4.2 * E);
      g.beginPath();
      g.moveTo(cx, py);
      g.quadraticCurveTo(cx, hy - K(6 * E), kx, hy + K(2 * E) + press * 0.3);
      g.stroke();
      g.restore();
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = metal(g, 'nickel', kx - 2, 0, kx + 2, 0);
      g.lineWidth = Math.max(1.6, K(1.6 * E));
      g.beginPath();
      g.moveTo(kx, hy + K(2 * E) + press * 0.3);
      g.lineTo(arm[0], arm[1]);
      g.stroke();
      g.restore();
      pin(g, kx, hy + K(2 * E) + press * 0.3, K(1.8 * E), 'nickel');
      pin(g, arm[0], arm[1], K(1.8 * E), 'nickel');
      // the pad, a spatula for the fingertip
      const pw = K(V.padW);
      const ph = K(V.padH);
      g.save();
      g.shadowColor = on ? 'rgba(255,205,100,.85)' : 'rgba(0,0,0,.5)';
      g.shadowBlur = on ? 14 : 10;
      g.shadowOffsetY = on ? 0 : 5;
      g.beginPath();
      g.ellipse(cx, py, pw, ph, 0, 0, TAU);
      const tg = g.createRadialGradient(cx - pw * 0.3, py - ph * 0.4, 1, cx, py, pw);
      tg.addColorStop(0, '#FFFFFF');
      tg.addColorStop(0.4, on ? '#FFF0C4' : '#F2D88E');
      tg.addColorStop(0.85, on ? '#E8B850' : '#C8963A');
      tg.addColorStop(1, '#7A5414');
      g.fillStyle = tg;
      g.fill();
      g.restore();
      if (on) {
        g.beginPath();
        g.ellipse(cx, py, pw, ph, 0, 0, TAU);
        g.strokeStyle = '#FFF3D0';
        g.lineWidth = 2;
        g.stroke();
      }
      if (words) label(g, s, fine() ? VALVE_KEYS[i].toUpperCase() : String(i + 1), cx, py, { size: Math.max(11, Math.min(14, ph * 1.1)), color: 'rgba(60,40,10,.7)', weight: 700 });
    });
  }

  // The trombone's outer slide, where the hand has it.
  function drawSlide(g, s) {
    const { m, X, Y, K } = G.F;
    const { sep, ro } = m;
    const x0 = m.start + slideMM(pos);
    const x1 = x0 + m.len - 22;
    const P = mapper(G.F);
    // the two outer tubes and the crook that joins them
    const line = join(run(x0, -sep, x1, -sep, 14), arc(x1, -sep / 2, sep / 2, -Math.PI / 2, Math.PI / 2, 22), run(x1, 0, x0, 0, 14));
    tube(g, P(line), K(ro));
    for (const y of [-sep, 0]) ferrule(g, X(x0 + 3), Y(y), 1, 0, K(8), K(ro * 1.22));
    // the bumper on the crook, and its water key
    g.beginPath();
    g.ellipse(X(x1 + sep / 2 + ro * 0.9), Y(-sep / 2), K(ro * 0.9), K(ro * 1.5), 0, 0, TAU);
    g.fillStyle = '#2A2422';
    g.fill();
    const wa = Math.PI * 0.32;
    const wk = [x1 + Math.cos(wa) * (sep / 2 + ro), -sep / 2 + Math.sin(wa) * (sep / 2 + ro)];
    rod(g, X(wk[0]), Y(wk[1]), X(x1 - 34), Y(ro + 3), K(2.6));
    g.beginPath();
    g.ellipse(X(wk[0]), Y(wk[1]), K(4), K(3), wa, 0, TAU);
    g.fillStyle = '#A9784A';
    g.fill();
    // the outer stay, the brace you hold, and a glow while you move it
    const hx = x0 + m.hand;
    g.save();
    if (slidePointer != null) {
      g.shadowColor = 'rgba(255,214,120,.95)';
      g.shadowBlur = 20;
    }
    rod(g, X(hx), Y(-sep + ro * 0.4), X(hx), Y(-ro * 0.4), K(7));
    g.restore();
    rod(g, X(hx - 7), Y(-sep * 0.72), X(hx - 7), Y(-sep * 0.28), K(4.5), 'nickel');
    // the positions: the nearest lit
    const yDot = Y(0) + Math.max(22, K(36));
    for (let p = 1; p <= 7; p++) {
      const x = slideU(p);
      const near = Math.abs(pos - p) < 0.25;
      if (near) {
        g.beginPath();
        g.arc(x, yDot, Math.max(4, K(5)), 0, TAU);
        g.fillStyle = '#F6DB8C';
        g.fill();
      }
      label(g, s, String(p), x, yDot + 18, { size: 15, color: near ? '#F6DB8C' : 'rgba(246,241,228,.5)' });
    }
  }

  // ---- computer keys ----
  function keydown(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const v = VALVE_KEYS.indexOf(k);
    if (!slide && v >= 0 && v < valves.length) { keysDown.add(v); down.add(v); update(); return; }
    if (slide && /^[1-7]$/.test(k)) { pos = Number(k); update(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      keyPartial = Math.max(0, Math.min(parts.length - 1, keyPartial + (e.key === 'ArrowUp' ? 1 : -1)));
      update();
      return;
    }
    if (k === ' ') { e.preventDefault(); spaceBlow = true; update(true); }
  }
  function keyup(e) {
    const k = e.key.toLowerCase();
    const v = VALVE_KEYS.indexOf(k);
    if (!slide && v >= 0) {
      keysDown.delete(v);
      if (![...valvePointers.values()].includes(v)) down.delete(v);
      update();
    }
    if (k === ' ') { spaceBlow = false; update(); }
  }
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);

  // Listen: for each note, the valves (or slide) and the lips a real player would use: the open
  // note just above it, lowered as little as possible. The lips nudge it in tune.
  const combos = new Map();          // half steps down -> the valves that give it most simply
  for (let bits = 0; bits < 2 ** valves.length; bits++) {
    const set = new Set(valves.map((_, i) => i).filter((i) => bits & (1 << i)));
    let semis = 0;
    let cost = 0;
    for (const i of set) { semis += valves[i]; cost += valves[i] === 3 ? 2.2 : 1; }
    if (!combos.has(semis) || cost < combos.get(semis).cost) combos.set(semis, { set, cost });
  }
  function plan(m) {
    let best = null;
    parts.forEach((n, b) => {
      const need = pitchOf(n) - m;
      let c = null;
      if (slide) {
        if (need >= -0.2 && need <= 6.2) c = { b, need, pos: 1 + Math.max(0, need), bend: Math.max(0, -need) };
      } else {
        const k = Math.round(need);
        if (k >= 0 && Math.abs(need - k) <= 0.35 && combos.has(k)) c = { b, need: k, valves: combos.get(k).set, bend: k - need };
      }
      if (c && (!best || c.need < best.need)) best = c;
    });
    return best;
  }
  let tween = 0;
  function slideTo(target, ms) {
    cancelAnimationFrame(tween);
    const from = pos;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      pos = from + (target - from) * k;
      update();
      if (k < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  }
  let autoNote = 0;
  kit.performer({
    can: (e) => e.midi != null && !!plan(e.midi),
    down(e) {
      const p = plan(e.midi);
      const inBand = Math.max(0.03, Math.min(0.97, 0.5 + p.bend / 0.3));
      const glide = e.glide && sounding && slide;
      autoDown.clear();
      if (!slide) p.valves.forEach((v) => autoDown.add(v));
      lip = { id: 'auto', x: 0.45 + (e.vel ?? 0.7) * 0.45, y: (p.b + inBand) / parts.length };
      if (glide) slideTo(p.pos, Math.min(260, e.dur * 500));
      else { if (slide) { cancelAnimationFrame(tween); pos = p.pos; } update(!e.glide); }
      return ++autoNote;
    },
    up(n) {
      if (n !== autoNote) return;
      if (lip?.id === 'auto') lip = null;
      autoDown.clear();
      update();
    },
    finish() { cancelAnimationFrame(tween); if (lip?.id === 'auto') lip = null; autoDown.clear(); update(); },
  });

  if (o.vibrato) {
    kit.toggle({
      label: 'Vibrato',
      on: true,
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c2-5 4-5 5 0s3 5 5 0 3-5 5 0 3 5 5 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
      onChange: (on) => voice.vibrato(on),
    });
  }

  // For tests: where things are drawn. ('valve', i): valve i's button (on the close-up, if
  // there is one); ('lips', band): the middle of that band of the lips; ('slide', p): the
  // trombone's brace at position p; ('mouthpiece'): the mouthpiece's rim.
  s.canvas.museumAt = (what, i = 0) => {
    geom(s);
    const { m, X, Y } = G.F;
    if (what === 'lips') return { u: G.lips.x + G.lips.w / 2, v: G.lips.y + G.lips.h - ((i + 0.5) * G.lips.h) / parts.length };
    if (what === 'mouthpiece') return { u: X(m.x0 + 4), v: Y(m.look === 'trombone' ? 0 : m.look === 'tuba' ? m.rcv.y : m.look === 'horn' ? m.rcv.y : m.yM) };
    if (what === 'slide') return slide ? { u: slideU(i), v: Y(-m.sep / 2) } : null;
    if (what !== 'valve' || slide) return null;
    const F = G.Z || G.F;
    return F.m.look === 'horn' ? { u: F.X(F.m.xs[i]), v: F.Y(F.m.V.pad) } : { u: F.X(F.m.xs[i]), v: F.Y(F.m.V.btnTop) + 3 };
  };

  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    voice.stop(0.1);
    s.destroy();
  };
}
