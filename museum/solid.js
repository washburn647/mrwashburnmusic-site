/* Solid things, for the hand percussion: bodies turned on a lathe (barrels, bells, eggs,
   sticks), tubes bent along a path (a handle), and shapes lofted through their cross-sections
   (a cowbell), cut into small flat facets, each lit by the way it faces. Drawn without
   perspective, as drums.js draws: the camera looks down at tilt radians (0: from the front,
   π/2: from straight above), with the object first turned yaw radians about the vertical.
   World units are inches: x to the right, y away from you, z up.

   Wood, gourd and leather are drawn with their own pattern, then darkened by how little light
   each facet gets, and given their gloss (the 'grain' material). Metals reflect a room: a
   bright ceiling, a soft light up to the left, and a floor (the mat they rest on) below. */

import { hex, TAU } from './paint.js';

export const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* Toward the light: up, from the left, a little from in front. */
export const LIGHT = norm([-0.5, -0.4, 0.78]);

/* ---------- the camera ---------- */

export function view(tilt, yaw = 0) {
  const st = Math.sin(tilt);
  const ct = Math.cos(tilt);
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const V = {
    tilt, yaw, k: 1, ox: 0, oy: 0,
    // toward you, from the scene
    eye: [0, -ct, st],
    // a point or a direction, turned by yaw about the vertical
    turn: (p) => [p[0] * cy - p[1] * sy, p[0] * sy + p[1] * cy, p[2]],
    // a turned point on the screen: [x, y, how far away]
    put: (q) => [V.ox + q[0] * V.k, V.oy - (q[1] * st + q[2] * ct) * V.k, q[1] * ct - q[2] * st],
    at: (p) => V.put(V.turn(p)),
    /* Size and place the camera so the points fit the box B (as large as they go, up to most
       pixels an inch). */
    fit(pts, B, most = Infinity) {
      let x0 = Infinity;
      let x1 = -Infinity;
      let u0 = Infinity;
      let u1 = -Infinity;
      for (const p of pts) {
        const q = V.turn(p);
        const u = q[1] * st + q[2] * ct;
        x0 = Math.min(x0, q[0]);
        x1 = Math.max(x1, q[0]);
        u0 = Math.min(u0, u);
        u1 = Math.max(u1, u);
      }
      V.k = Math.min(B.w / (x1 - x0 || 1), B.h / (u1 - u0 || 1), most);
      V.ox = B.x + (B.w - (x1 - x0) * V.k) / 2 - x0 * V.k;
      V.oy = B.y + (B.h - (u1 - u0) * V.k) / 2 + u1 * V.k;
      return V;
    },
  };
  return V;
}

/* ---------- shapes ---------- */

/* Two directions square to the axis ax, and to each other: angle 0 of a body turned about ax
   points along the first, angle π/2 along the second. */
export function across(ax) {
  const u = norm(Math.abs(ax[2]) < 0.9 ? cross(ax, [0, 0, 1]) : cross([1, 0, 0], ax));
  return [u, cross(ax, u)];
}

/* A body turned on a lathe: profile [[h, r], ...] along the axis ax from c, cut into n facets
   round (from angle a0 to a1). Walk the profile with the outside on your right: up the outside
   of a bell from its tip, round its lip and back down the inside, and each face's normal points
   to the side you can see (inside: true turns them all round). m: a material, or one for each
   facet: m(h, angle, j, i), j round and i along the profile. */
export function turned(profile, { c = [0, 0, 0], ax = [0, 0, 1], n = 36, m, inside = false, a0 = 0, a1 = TAU, tag } = {}) {
  ax = norm(ax);
  const [u, w] = across(ax);
  const dir = (a) => add(mul(u, Math.cos(a)), mul(w, Math.sin(a)));
  const pt = (h, r, a) => add(c, add(mul(ax, h), mul(dir(a), r)));
  const faces = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [h0, r0] = profile[i];
    const [h1, r1] = profile[i + 1];
    if (Math.abs(h1 - h0) < 1e-9 && Math.abs(r1 - r0) < 1e-9) continue;
    for (let j = 0; j < n; j++) {
      const b0 = a0 + ((a1 - a0) * j) / n;
      const b1 = a0 + ((a1 - a0) * (j + 1)) / n;
      const bm = (b0 + b1) / 2;
      // square to the profile's slope, in the plane of the axis
      let nn = norm(add(mul(dir(bm), h1 - h0), mul(ax, -(r1 - r0))));
      if (inside) nn = mul(nn, -1);
      const hm = (h0 + h1) / 2;
      faces.push({ p: [pt(h0, r0, b0), pt(h0, r0, b1), pt(h1, r1, b1), pt(h1, r1, b0)], n: nn, m: typeof m === 'function' ? m(hm, bm, j, i) : m, a: bm, h: hm, i, j, tag });
    }
  }
  return faces;
}

/* A round tube of radius r bent along path (points), n facets round. */
export function tube(path, r, { n = 14, m, tag, ends = true } = {}) {
  const faces = [];
  const rings = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const t = norm(sub(b, a));
    const [u, w] = across(t);
    return Array.from({ length: n }, (_, j) => {
      const ang = (j / n) * TAU;
      const d = add(mul(u, Math.cos(ang)), mul(w, Math.sin(ang)));
      return { p: add(p, mul(d, r)), d };
    });
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const A = rings[i];
      const B = rings[i + 1];
      const nn = norm(add(add(A[j].d, A[k].d), add(B[j].d, B[k].d)));
      faces.push({ p: [A[j].p, A[k].p, B[k].p, B[j].p], n: nn, m, tag });
    }
  }
  if (ends) {
    for (const [i, s] of [[0, -1], [rings.length - 1, 1]]) {
      const a = path[Math.max(0, i - 1)];
      const b = path[Math.min(path.length - 1, i + 1)];
      faces.push({ p: rings[i].map((q) => q.p), n: mul(norm(sub(b, a)), s), m, tag });
    }
  }
  return faces;
}

/* A shape lofted through cross-sections (each a closed ring of points, all the same count),
   its faces' normals pointing away from centre (toward it, inside: true). */
export function loft(sections, { m, tag, centre, caps = false, inside = false } = {}) {
  const faces = [];
  const n = sections[0].length;
  for (let i = 0; i < sections.length - 1; i++) {
    const A = sections[i];
    const B = sections[i + 1];
    const mid = centre || mul(add(avg(A), avg(B)), 0.5);
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const p = [A[j], A[k], B[k], B[j]];
      let nn = norm(cross(sub(p[2], p[0]), sub(p[3], p[1])));
      if ((dot(nn, sub(avg(p), mid)) < 0) !== inside) nn = mul(nn, -1);
      faces.push({ p, n: nn, m: typeof m === 'function' ? m(i, j) : m, tag, i, j });
    }
  }
  if (caps) {
    for (const [S, other] of [[sections[0], sections[1]], [sections[sections.length - 1], sections[sections.length - 2]]]) {
      let nn = norm(cross(sub(S[1], S[0]), sub(S[2], S[0])));
      if (dot(nn, sub(avg(S), avg(other))) < 0) nn = mul(nn, -1);
      faces.push({ p: S, n: nn, m, tag });
    }
  }
  return faces;
}

/* A flat face (a polygon) with its normal. */
export function flat(p, nn, m, tag) {
  return { p, n: norm(nn), m, tag };
}

export const avg = (ps) => mul(ps.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / ps.length);

/* Points or faces moved: turned about the axis ax (through c) by angle a, then shifted by d. */
export function spin(p, ax, a, c = [0, 0, 0]) {
  ax = norm(ax);
  const v = sub(p, c);
  const co = Math.cos(a);
  const si = Math.sin(a);
  // Rodrigues: v cos a + (ax x v) sin a + ax (ax . v)(1 - cos a)
  return add(c, add(add(mul(v, co), mul(cross(ax, v), si)), mul(ax, dot(ax, v) * (1 - co))));
}
export function moved(faces, { ax, a = 0, c = [0, 0, 0], d = [0, 0, 0] } = {}) {
  return faces.map((f) => ({
    ...f,
    p: f.p.map((q) => add(ax && a ? spin(q, ax, a, c) : q, d)),
    n: ax && a ? spin(f.n, ax, a) : f.n,
  }));
}

/* ---------- light ---------- */

/* Metals: what they reflect, dark to light. */
export const RAMPS = {
  chrome: [[0, '#101418'], [0.22, '#353C43'], [0.42, '#7E878F'], [0.58, '#C6CDD2'], [0.78, '#EEF2F4'], [1, '#FFFFFF']],
  steel: [[0, '#2E3236'], [0.35, '#666D73'], [0.62, '#A3AAB0'], [0.85, '#D3D8DB'], [1, '#F1F3F4']],
  brass: [[0, '#2E1C04'], [0.28, '#6E4A12'], [0.52, '#B88A34'], [0.72, '#E2C070'], [0.9, '#F8E4A6'], [1, '#FFF6D6']],
  bronze: [[0, '#2A1404'], [0.3, '#6A3E14'], [0.55, '#AE763A'], [0.75, '#DCAA6A'], [1, '#FBE6C0']],
  iron: [[0, '#0E0F10'], [0.4, '#2A2C2E'], [0.7, '#55595C'], [1, '#9EA3A6']],
  // black enamel: dark, until it catches the light
  black: [[0, '#040405'], [0.5, '#0E0F11'], [0.72, '#1C1E21'], [0.86, '#383B40'], [0.95, '#8C9096'], [1, '#F2F4F6']],
};

function ramp(stops, v) {
  v = clamp(v, 0, 1);
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [o0, c0] = stops[i - 1];
      const [o1, c1] = stops[i];
      const t = (v - o0) / (o1 - o0 || 1);
      const a = hex(c0);
      const b = hex(c1);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  }
  return hex(stops[stops.length - 1][1]);
}
const rgb = (c, a = 1) => `rgba(${Math.round(clamp(c[0], 0, 255))},${Math.round(clamp(c[1], 0, 255))},${Math.round(clamp(c[2], 0, 255))},${a})`;

/* What a polished thing reflects, looking along r: the floor (the mat) below, dark walls round
   the horizon, a dim ceiling, a big soft light up to the left and a smaller one to the right. */
const FILL = norm([0.9, -0.25, 0.45]);
function room(r) {
  let v;
  if (r[2] < 0) v = 0.08 + 0.14 * Math.pow(1 + r[2], 2);
  else if (r[2] < 0.22) v = 0.14 + r[2] * 1.5;
  else v = 0.47 + 0.2 * r[2];
  v += 0.9 * Math.pow(Math.max(0, dot(r, LIGHT)), 9);
  v += 0.28 * Math.pow(Math.max(0, dot(r, FILL)), 7);
  return v;
}

/* How a facet facing nn looks, in material m:
   { kind: 'metal', ramp, rough, floor }  polished (rough 0) to satin (rough 1) metal; floor:
       the colour of what it stands on, seen in it below the horizon
   { kind: 'paint', color, amb, gloss, shine }  painted or lacquered, or plastic
   { kind: 'flat', color }  the same everywhere
   ('grain' is drawn by render()) */
export function shade(m, nn, eye) {
  const d = dot(nn, LIGHT);
  if (m.kind === 'flat') return m.color;
  if (m.kind === 'metal') {
    const ne = dot(nn, eye);
    const r = sub(mul(nn, 2 * ne), eye);
    let v = room(r);
    const rough = m.rough ?? 0;
    v = v * (1 - rough) + (0.22 + 0.62 * Math.max(0, d)) * rough;
    let c = ramp(RAMPS[m.ramp] || RAMPS.chrome, v * (m.dim ?? 1));
    if (m.floor && r[2] < 0) {
      const f = hex(m.floor);
      const t = (m.floorMix ?? 0.35) * Math.min(1, -r[2] * 2.5) * (1 - rough * 0.5);
      const lit = 0.25 + v;
      c = [c[0] + (f[0] * lit - c[0]) * t, c[1] + (f[1] * lit - c[1]) * t, c[2] + (f[2] * lit - c[2]) * t];
    }
    return rgb(c, m.alpha ?? 1);
  }
  const H = norm(add(LIGHT, eye));
  const spec = Math.pow(Math.max(0, dot(nn, H)), m.shine || 30);
  // paint
  const base = hex(m.color);
  const amb = m.amb ?? 0.34;
  const k = amb + (1 - amb) * Math.max(0, d);
  const s = spec * (m.gloss ?? 0.3) * 255;
  return rgb([base[0] * k + s, base[1] * k + s, base[2] * k + s], m.alpha ?? 1);
}

/* ---------- drawing ---------- */

/* The faces you can see, nearest last, on the screen. */
export function project(V, faces, { cull = true } = {}) {
  const list = [];
  for (const f of faces) {
    const nn = V.turn(f.n);
    const e = dot(nn, V.eye);
    if (cull && e < -0.005) continue;
    const s = f.p.map((p) => V.at(p));
    let depth = 0;
    for (const q of s) depth += q[2];
    list.push({ f, s, n: nn, e, depth: depth / s.length + (f.bias || 0) });
  }
  list.sort((a, b) => b.depth - a.depth);
  return list;
}

/* Each face a hair bigger than it is (by pixels, on every side), so no seams show between
   neighbours. */
function swell(pts, by) {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    area += x0 * y1 - x1 * y0;
  }
  const sgn = area < 0 ? -1 : 1;
  // each edge's outward normal
  const nrm = [];
  let around = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const l = Math.hypot(x1 - x0, y1 - y0);
    around += l;
    nrm.push(l < 1e-6 ? null : [((y1 - y0) / l) * sgn, (-(x1 - x0) / l) * sgn]);
  }
  // a sliver, seen edge on, needs (and takes) less: its sharp corners would poke out
  const thick = Math.abs(area) / (around || 1);
  by *= Math.min(1, thick / 1.5);
  if (by < 0.05) return pts;
  return pts.map(([x, y], i) => {
    const a = nrm[(i + n - 1) % n] || nrm[i];
    const b = nrm[i] || a;
    if (!a || !b) return [x, y];
    let mx = a[0] + b[0];
    let my = a[1] + b[1];
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) return [x + a[0] * by, y + a[1] * by];
    mx /= ml;
    my /= ml;
    // out along the bisector, far enough that both edges move by 'by' (but no long spikes)
    const d = Math.min(by * 1.6, by / Math.max(0.2, mx * a[0] + my * a[1]));
    return [x + mx * d, y + my * d];
  });
}

/* Draw faces, lit, the far ones first.
   { kind: 'grain', fill, glaze, lift, dark, gloss, shine }: fill (a colour, or fill(g) giving a
   pattern) stained by glaze, darkened where the light doesn't reach (lift: how light the
   darkest side stays) and by dark (how deep a stain is, 0 to 1), with gloss on top.
   only: 'shine' draws just the gloss of 'paint' and 'grain' faces (for a see-through shell). */
export function render(g, V, faces, { cull = true, grow = 0.55, list, only } = {}) {
  const L = list || project(V, faces, { cull });
  const H = norm(add(LIGHT, V.eye));
  if (!only && L.some((it) => it.f.m.kind === 'grain')) return layered(g, V, L, grow, H);
  for (const it of L) {
    const m = it.f.m;
    const solid = (m.alpha ?? 1) === 1;
    const gl = m.gloss ? Math.pow(Math.max(0, dot(it.n, H)), m.shine || 30) * m.gloss : 0;
    if (only === 'shine' && gl < 0.01) continue;
    trace(g, solid && grow ? swell(it.s, grow) : it.s);
    if (only === 'shine') {
      g.fillStyle = `rgba(255,252,244,${Math.min(1, gl)})`;
    } else {
      g.fillStyle = shade(m, it.n, V.eye);
    }
    g.fill();
  }
  return L;
}

function trace(g, pts) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

/* Grained faces are drawn in three layers, so that no seams show between them: their pattern
   (and the colour of any metal among them), the light and stain on each (multiplied in), and
   their gloss (added). Each layer's neighbouring faces are alike, so where their edges blur
   together nothing shows. */
const spare = [];
function scratch(i, w, h) {
  let c = spare[i];
  if (!c) c = spare[i] = document.createElement('canvas');
  if (c.width < w || c.height < h) {
    c.width = Math.max(c.width, w);
    c.height = Math.max(c.height, h);
  }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, w, h);
  return c;
}
function layered(g, V, L, grow, H) {
  const M = g.getTransform();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const it of L) {
    for (const [x, y] of it.s) {
      const X = M.a * x + M.c * y + M.e;
      const Y = M.b * x + M.d * y + M.f;
      if (X < x0) x0 = X;
      if (X > x1) x1 = X;
      if (Y < y0) y0 = Y;
      if (Y > y1) y1 = Y;
    }
  }
  if (!Number.isFinite(x0)) return L;
  x0 = Math.floor(x0) - 4;
  y0 = Math.floor(y0) - 4;
  const w = Math.ceil(x1) + 4 - x0;
  const h = Math.ceil(y1) + 4 - y0;
  const C = scratch(0, w, h);
  const T = scratch(1, w, h);
  const S = scratch(2, w, h);
  const ctx = (c) => {
    const t = c.getContext('2d');
    t.setTransform(M.a, M.b, M.c, M.d, M.e - x0, M.f - y0);
    return t;
  };
  const cg = ctx(C);
  const tg = ctx(T);
  const sg = ctx(S);
  for (const it of L) {
    const m = it.f.m;
    const pts = swell(it.s, grow);
    trace(cg, pts);
    trace(tg, pts);
    trace(sg, pts);
    let gl = 0;
    if (m.kind === 'grain') {
      cg.fillStyle = typeof m.fill === 'function' ? m.fill(cg, it) : m.fill;
      cg.fill();
      const lift = m.lift ?? 0.4;
      const v = (lift + (1 - lift) * Math.max(0, dot(it.n, LIGHT)) * 1.08) * (1 - (m.dark || 0));
      const z = m.glaze ? hex(m.glaze) : [255, 255, 255];
      const u = Math.min(1, v);
      tg.fillStyle = rgb([z[0] * u, z[1] * u, z[2] * u]);
      tg.fill();
      gl = (m.gloss ? Math.pow(Math.max(0, dot(it.n, H)), m.shine || 30) * m.gloss : 0) + Math.max(0, v - 1) * 0.6;
    } else {
      cg.fillStyle = shade(m, it.n, V.eye);
      cg.fill();
      tg.fillStyle = '#FFFFFF';
      tg.fill();
    }
    if (gl > 0.01) {
      sg.globalCompositeOperation = 'source-over';
      sg.fillStyle = `rgba(255,250,240,${Math.min(1, gl)})`;
    } else {
      sg.globalCompositeOperation = 'destination-out';
      sg.fillStyle = '#000';
    }
    sg.fill();
  }
  cg.setTransform(1, 0, 0, 1, 0, 0);
  cg.globalCompositeOperation = 'multiply';
  cg.drawImage(T, 0, 0, w, h, 0, 0, w, h);
  // keep only what the faces cover (multiply leaves the light's own edges behind)
  cg.globalCompositeOperation = 'destination-in';
  cg.drawImage(T, 0, 0, w, h, 0, 0, w, h);
  cg.globalCompositeOperation = 'source-over';
  cg.drawImage(S, 0, 0, w, h, 0, 0, w, h);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(C, 0, 0, w, h, x0, y0, w, h);
  g.restore();
  return L;
}

/* A canvas w by h CSS pixels at the screen's pixel ratio, its context scaled to match. */
export function canvasFor(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  return c;
}

/* Where faces fall on the screen: { x0, y0, x1, y1 }. */
export function extent(V, faces) {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const f of faces) {
    for (const p of f.p) {
      const [x, y] = V.at(p);
      if (x < b.x0) b.x0 = x;
      if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y;
      if (y > b.y1) b.y1 = y;
    }
  }
  return b;
}

/* A picture of part of a scene, painted once: a canvas covering the box b of the screen (CSS
   pixels, padded by pad), which paint(g) draws on in screen coordinates. Show it with show(). */
export function picture(s, b, paint, pad = 4) {
  const x = Math.floor(b.x0 - pad);
  const y = Math.floor(b.y0 - pad);
  const w = Math.max(1, Math.ceil(b.x1 + pad) - x);
  const h = Math.max(1, Math.ceil(b.y1 + pad) - y);
  const c = canvasFor(w, h, s.dpr);
  const g = c.getContext('2d');
  g.translate(-x, -y);
  paint(g);
  return { c, x, y, w, h };
}
/* Draw a picture, moved by (dx, dy) and turned by angle about (px, py). */
export function show(g, P, { dx = 0, dy = 0, angle = 0, px = 0, py = 0, alpha = 1 } = {}) {
  if (!P || alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  if (angle) {
    g.translate(px + dx, py + dy);
    g.rotate(angle);
    g.translate(-px, -py);
  } else {
    g.translate(dx, dy);
  }
  g.drawImage(P.c, P.x, P.y, P.w, P.h);
  g.restore();
}

/* The shadow faces cast on the floor (z = floor) by a light from dir (LIGHT: the room's light,
   [0, 0, 1]: straight down, for the dark just under a thing), softened by blur pixels: a
   picture to draw under them. */
export function shadow(s, V, faces, { dir = LIGHT, blur = 6, alpha = 0.5, floor = 0, grow = 0 } = {}) {
  const drop = (p) => {
    const q = V.turn(p);
    const t = (q[2] - floor) / dir[2];
    return V.put([q[0] - dir[0] * t, q[1] - dir[1] * t, floor]);
  };
  const polys = faces.map((f) => f.p.map(drop));
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const P of polys) {
    for (const [x, y] of P) {
      b.x0 = Math.min(b.x0, x);
      b.x1 = Math.max(b.x1, x);
      b.y0 = Math.min(b.y0, y);
      b.y1 = Math.max(b.y1, y);
    }
  }
  if (!Number.isFinite(b.x0)) return null;
  const pad = blur * 2 + grow + 4;
  // the outline, solid
  const solid = picture(s, b, (g) => {
    g.fillStyle = '#000';
    g.strokeStyle = '#000';
    g.lineWidth = 1 + grow * 2;
    g.lineJoin = 'round';
    for (const P of polys) {
      g.beginPath();
      P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
      g.stroke();
    }
  }, pad);
  // then softened: drawn far off the canvas, with only its blurred shadow landing on it
  return picture(s, b, (g) => {
    const off = solid.w + pad * 4 + 40;
    g.shadowColor = `rgba(0,0,0,${alpha})`;
    g.shadowBlur = blur * s.dpr;
    g.shadowOffsetX = off * s.dpr;
    g.drawImage(solid.c, solid.x - off, solid.y, solid.w, solid.h);
  }, pad);
}
