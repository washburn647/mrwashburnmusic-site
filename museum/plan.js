/* The lobby's floor plan: the museum as a cut-away dollhouse, seen from the front and a little
   above. Its six rooms stand in a ring round the rotunda, in the order a visitor walks them, each
   with its instruments standing on its floor. An instrument opens it, a room's sign walks
   through the room (gallery.js), and the desk in the rotunda starts the tour.
   It is laid out for the width it has, in CSS pixels: three columns of rooms on a wide screen,
   the keyboards, rotunda and entrance down the middle; two on a phone, the rotunda at the foot.
   Walls running across the page show the face that looks toward you; walls running up the page
   show only their tops. Rooms are drawn in the order you walk them, which is the order the
   keyboard's Tab key goes through them too. */

import { ROOMS, EXHIBITS } from './data.js';
import { art, BOX } from './art.js';

const f = (n) => Math.round(n * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex = (h) => (h.length === 4 ? [1, 2, 3].map((i) => parseInt(h[i] + h[i], 16)) : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
export const mix = (a, b, t) => `#${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const CREAM = '#F6F1E4';
const INK = '#1F3329';
const STONE = '#E9E0CB';
const STONE_DK = '#B9AC8E';

/* Each room's paint, from its colour, and its floor. */
export function paint(id) {
  const hue = ROOMS.find((r) => r.id === id)?.hue || '#C9B99A';
  return {
    hue,
    wall: mix(hue, CREAM, 0.36),
    wallHi: mix(hue, CREAM, 0.55),
    low: mix(hue, '#2A1A12', 0.12),
    trim: mix(hue, '#1A120D', 0.5),
    floor: FLOORS[id] || 'marble',
  };
}
const FLOORS = { keyboard: 'parquet', strings: 'planks', woodwinds: 'oak', brass: 'carpet', percussion: 'checker', world: 'terracotta' };

/* ---------- where everything goes ---------- */

export function layout(width) {
  const W = clamp(Math.floor(width), 300, 1180);
  const two = W < 700;
  const edge = two ? 8 : 16;
  const ext = two ? 9 : 12;               // the outside walls' thickness
  const center = two ? 0 : Math.round(W * 0.235);
  const side = (W - 2 * edge - center) / 2;
  const padX = two ? 7 : 12;
  const per = clamp(Math.round((side - 2 * padX) / (two ? 86 : 96)), 2, 5);
  const cell = (side - 2 * padX) / per;
  const S = Math.min(cell * 0.94, 104);   // a drawing's 120 units, in pixels
  const Hw = Math.round(clamp(cell * 0.42, 28, 42));
  const font = clamp(cell * 0.125, 10.5, 13);
  const plaque = (name, wide) => (name.length * font * 0.56 + 12 > wide - 4 && name.includes(' ') ? 2 : 1);
  const plaqueH = (lines) => lines * font * 1.1 + 6;
  const rowH = (s, lines) => s * 0.92 + plaqueH(lines) + 10;   // feet to feet, row to row
  const top = 14;                         // lawn above the building
  const L = { W, two, edge, ext, center, side, padX, per, cell, S, Hw, font, rooms: [], items: [], doors: [], bars: [] };

  const inRoom = (id) => EXHIBITS.filter((e) => e.room === id);
  // a room's rows: how many to a row, each row's height
  const rowsOf = (id, across, s, wide) => {
    const list = inRoom(id);
    const rows = [];
    for (let i = 0; i < list.length; i += across) {
      const lines = Math.max(...list.slice(i, i + across).map((e) => plaque(e.name, wide)));
      rows.push(rowH(s, lines));
    }
    return rows;
  };
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const need = (rows) => 12 + sum(rows) + Hw + 6;
  const col = (ids, x0, x1) => ids.map((id) => ({ id, x0, x1, need: need(rowsOf(id, per, S, cell)) }));

  const xs = two ? [edge, edge + side, W - edge] : [edge, edge + side, edge + side + center, W - edge];
  let cols;
  let K = null;     // the keyboards in the middle column: bigger, one or two to a row
  if (two) {
    cols = [col(['world', 'percussion'], xs[0], xs[1]), col(['keyboard', 'strings', 'woodwinds', 'brass'], xs[1], xs[2])];
  } else {
    const across = center >= cell * 2.3 ? 2 : 1;
    const SK = Math.min((center - 20) / across * 0.94, S * 1.4);
    K = { across, SK, rows: rowsOf('keyboard', across, SK, (center - 2 * padX) / across) };
    const rx = center / 2 - 16;
    const rot = { id: 'rotunda', x0: xs[1], x1: xs[2], need: Hw + Hw * 1.5 + rx * 0.9 + 34 };
    const ent = { id: 'entrance', x0: xs[1], x1: xs[2], need: Hw + 96 };
    cols = [
      col(['world', 'percussion'], xs[0], xs[1]),
      [{ id: 'keyboard', x0: xs[1], x1: xs[2], need: need(K.rows) }, rot, ent],
      col(['strings', 'woodwinds', 'brass'], xs[2], xs[3]),
    ];
  }
  // Every column as tall as the tallest: the spare height shared out in proportion.
  const height = Math.max(...cols.map((c) => c.reduce((a, r) => a + r.need, 0)));
  for (const c of cols) {
    const spare = height - c.reduce((a, r) => a + r.need, 0);
    const total = c.reduce((a, r) => a + r.need, 0);
    let y = top + Hw;
    for (const r of c) {
      r.y0 = y;
      y += r.need + spare * (r.need / total);
      r.y1 = y;
    }
  }
  L.rooms = cols.flat();
  let B = top + Hw + height;              // the building's front: the facade's foot
  if (two) {
    // The rotunda across the foot, the entrance in its front wall.
    const rx = Math.min(W * 0.3, 150);
    const foot = { id: 'rotunda', x0: xs[0], x1: xs[2], y0: B, need: Hw + Hw * 1.5 + rx * 0.9 + 70 };
    foot.y1 = foot.y0 + foot.need;
    L.rooms.push(foot);
    B = foot.y1;
  }
  L.B = B;
  L.top = top;
  L.H = B + Math.round(Hw * 2.9);
  L.cols = cols;

  // The instruments, in rows, the block of them in the middle of its room.
  for (const r of L.rooms) {
    const list = inRoom(r.id);
    if (!list.length) continue;
    const big = r.id === 'keyboard' && K;
    const across = big ? K.across : per;
    const s = big ? K.SK : S;
    const wide = (r.x1 - r.x0 - 2 * padX) / across;
    const rows = rowsOf(r.id, across, s, wide);
    const room = r.y1 - Hw - 6 - (r.y0 + 12);
    let y = r.y0 + 12 + Math.max(0, (room - sum(rows)) / 2);
    rows.forEach((h, row) => {
      const inRow = list.slice(row * across, row * across + across);
      inRow.forEach((ex, k) => {
        const x = (r.x0 + r.x1) / 2 + (k - (inRow.length - 1) / 2) * wide;
        L.items.push({ ex, room: r.id, x, y: y + s * 0.92, s, lines: plaque(ex.name, wide) });
      });
      y += h;
    });
  }

  // Doors: between rooms one behind the other, in the front room's back wall, and between rooms
  // side by side, in the wall up the page between them.
  const dw = clamp(cell * 0.44, 30, 46);
  const gap = Hw + clamp(cell * 0.38, 26, 42);
  for (const c of cols) {
    for (let i = 1; i < c.length; i++) {
      const r = c[i];
      const mid = (r.x0 + r.x1) / 2;
      const off = r.x0 === xs[0] ? -0.3 : r.x1 === xs[xs.length - 1] ? 0.3 : 0;
      const wide = r.id === 'entrance' ? dw * 1.9 : dw;
      L.doors.push({ wall: 'face', room: r.id, x: mid + off * (r.x1 - r.x0), w: wide });
    }
  }
  if (two) {
    for (const c of cols) {
      const r = c[c.length - 1];
      L.doors.push({ wall: 'face', room: 'rotunda', x: (r.x0 + r.x1) / 2, w: dw });
    }
  }
  // the walls up the page, and their doors where rooms side by side meet
  const runs = [];
  xs.forEach((x, k) => {
    const outside = k === 0 || k === xs.length - 1;
    runs.push({ x, outside, from: top + Hw, to: two ? L.rooms.find((r) => r.id === 'rotunda').y0 : B, gaps: [] });
  });
  if (two) {
    runs[0].to = B;
    runs[runs.length - 1].to = B;
  }
  for (let k = 0; k < cols.length - 1; k++) {
    const run = runs[k + 1];
    for (const a of cols[k]) {
      for (const b of cols[k + 1]) {
        const lo = Math.max(a.y0, b.y0);
        const hi = Math.min(a.y1, b.y1) - Hw;
        if (hi - lo > gap + 24) run.gaps.push([(lo + hi) / 2 - gap / 2 + Hw / 2, (lo + hi) / 2 + gap / 2 + Hw / 2]);
      }
    }
  }
  L.bars = runs;
  L.dw = dw;
  return L;
}

/* ---------- drawing ---------- */

/* played: ids of instruments the visitor has played (a gold check on the plaque). */
export function plan(width, { played = new Set() } = {}) {
  const L = layout(width);
  const { W, H, Hw } = L;
  let s = lawn(L);
  s += `<rect x="${f(L.edge - 2)}" y="${f(L.top + 4)}" width="${f(W - 2 * L.edge + 10)}" height="${f(L.B - L.top + 6)}" rx="4" fill="#000" opacity=".22"/>`;
  for (const r of L.rooms) s += floor(r, L);
  // Rooms in walking order, each its back wall, then its instruments front to back.
  const order = ['keyboard', 'strings', 'woodwinds', 'brass', 'percussion', 'world', 'rotunda', 'entrance'];
  const rooms = [...L.rooms].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  for (const r of rooms) {
    let g = face(r, L);
    if (r.id === 'rotunda') g += rotunda(r, L);
    else if (r.id === 'entrance') g += entrance(r, L);
    else {
      g += L.items.filter((it) => it.room === r.id).sort((a, b) => a.y - b.y).map((it) => item(it, L, played.has(it.ex.id))).join('');
    }
    s += `<g class="room" data-room="${r.id}">${g}</g>`;
  }
  s += L.bars.map((b) => bar(b, L)).join('');
  s += facade(L);
  s += outside(L);
  const label = 'Floor plan of the museum. Six rooms in a ring round the rotunda.';
  return `<svg class="plan-svg" viewBox="0 0 ${W} ${f(H)}" width="${W}" height="${f(H)}" role="group" aria-label="${label}"><defs>${defs(L)}</defs>${s}</svg>`;
}

function defs(L) {
  const p = (id, w, h, body) => `<pattern id="mp-${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern>`;
  const line = (d, c = '#000', o = 0.3, w = 0.7) => `<path d="${d}" stroke="${c}" stroke-opacity="${o}" stroke-width="${w}" fill="none"/>`;
  let d = '';
  // keyboards: basket-weave parquet
  d += p('parquet', 16, 9, `<rect width="16" height="9" fill="#C8925A"/><rect width="8" height="4.5" fill="#CF9A60"/><rect x="8" y="4.5" width="8" height="4.5" fill="#CF9A60"/>${line('M0 1.5h8M0 3h8M8 6h8M8 7.5h8', '#6B4020', 0.16, 0.5)}${line('M10.7 0v4.5M13.3 0v4.5M2.7 4.5v4.5M5.3 4.5v4.5', '#6B4020', 0.16, 0.5)}${line('M0 4.5h16M8 0v9M0 9h16', '#5A3416', 0.24, 0.6)}`);
  // strings: long walnut boards
  d += p('planks', 150, 10, `<rect width="150" height="10" fill="#A56C3D"/><rect y="5" width="150" height="5" fill="#9E6638"/><rect x="88" width="62" height="5" fill="#AA7141"/>${line('M0 5h150M0 10h150', '#3E2210', 0.28, 0.7)}${line('M0 0v5M88 0v5M40 5v5M122 5v5', '#3E2210', 0.22, 0.7)}`);
  // woodwinds: pale oak boards
  d += p('oak', 140, 10, `<rect width="140" height="10" fill="#D7B27C"/><rect y="5" width="140" height="5" fill="#D1AA72"/><rect x="70" width="70" height="5" fill="#DBB883"/>${line('M0 5h140M0 10h140', '#6E4E24', 0.24, 0.7)}${line('M0 0v5M70 0v5M30 5v5M108 5v5', '#6E4E24', 0.2, 0.7)}`);
  // brass: a red carpet with a gold lattice
  d += p('carpet', 20, 11, `<rect width="20" height="11" fill="#86303A"/>${line('M0 5.5L10 0L20 5.5L10 11Z', '#E9C46A', 0.25, 0.8)}<circle cx="10" cy="5.5" r="1" fill="#E9C46A" opacity=".4"/>`);
  // percussion: grey stone tiles
  d += p('checker', 24, 13, `<rect width="24" height="13" fill="#C4CCD2"/><rect width="12" height="6.5" fill="#A8B4BD"/><rect x="12" y="6.5" width="12" height="6.5" fill="#A8B4BD"/>${line('M0 6.5h24M0 13h24M12 0v13M24 0v13', '#6E7C87', 0.25, 0.6)}`);
  // around the world: terracotta tiles
  d += p('terracotta', 48, 26, `<rect width="48" height="26" fill="#C2704A"/><rect x="24" width="24" height="13" fill="#BA6942"/><rect y="13" width="24" height="13" fill="#BA6942"/><path d="M36 16.5l4 3-4 3-4-3z" fill="#F2D5A8" opacity=".35"/>${line('M0 13h48M0 26h48M24 0v26M48 0v26', '#F3E3C6', 0.45, 0.9)}`);
  // the rotunda and the entrance: marble, and a checkered hall
  d += p('marble', 30, 16, `<rect width="30" height="16" fill="#EFE7D6"/><path d="M2 14C9 9 14 12 20 6S28 3 30 1" stroke="#B9AE98" stroke-opacity=".3" stroke-width=".7" fill="none"/>${line('M0 16h30M30 0v16', '#B9AE98', 0.4, 0.8)}`);
  d += p('hallfloor', 20, 11, `<rect width="20" height="11" fill="#EDE4D0"/><rect width="10" height="5.5" fill="#3C5A48"/><rect x="10" y="5.5" width="10" height="5.5" fill="#3C5A48"/>`);
  d += p('grass', 24, 24, `<rect width="24" height="24" fill="#4A6B43"/><path d="M3 5l1-3 1 3M14 13l1-3 1 3M7 20l1-3 1 3M19 4l1-3 1 3" stroke="#6A8F5C" stroke-width=".8" fill="none" opacity=".7"/>`);
  d += `<linearGradient id="mp-dim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".26"/><stop offset=".22" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`;
  d += `<linearGradient id="mp-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".08"/></linearGradient>`;
  d += `<linearGradient id="mp-col" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#A89C82"/><stop offset=".3" stop-color="#FFFBF0"/><stop offset=".55" stop-color="#EFE6D2"/><stop offset="1" stop-color="#9F937A"/></linearGradient>`;
  d += `<radialGradient id="mp-shadow"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
  d += `<radialGradient id="mp-leaf" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#8DB86E"/><stop offset=".55" stop-color="#4E7A3C"/><stop offset="1" stop-color="#2C4A24"/></radialGradient>`;
  d += `<linearGradient id="mp-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9FC3D8"/><stop offset=".5" stop-color="#3D6A86"/><stop offset="1" stop-color="#284B62"/></linearGradient>`;
  return d;
}

function lawn(L) {
  return `<rect width="${L.W}" height="${f(L.H)}" fill="url(#mp-grass)"/>`
    + `<rect width="${L.W}" height="${f(L.H)}" fill="url(#mp-dim)" opacity=".5"/>`;
}

function floor(r, L) {
  const { Hw } = L;
  const fill = r.id === 'rotunda' ? 'marble' : r.id === 'entrance' ? 'hallfloor' : paint(r.id).floor;
  const [x, y, w, h] = [r.x0, r.y0 - Hw, r.x1 - r.x0, r.y1 - r.y0 + Hw];
  const walk = ROOMS.some((m) => m.id === r.id);
  let s = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="url(#mp-${fill})"/>`;
  s += `<rect x="${f(x)}" y="${f(r.y0)}" width="${f(w)}" height="${f(Math.min(h, 120))}" fill="url(#mp-dim)"/>`;
  // a room's floor walks through it, as its sign does (one tab stop is enough: the sign)
  if (walk) s = `<a href="#room/${r.id}" tabindex="-1" aria-hidden="true" class="floor">${s}</a>`;
  return s;
}

/* A room's back wall, the face of it toward you, with its doors and its sign. */
function face(r, L) {
  const { Hw } = L;
  const north = r.y0 === L.top + Hw;
  const c = ROOMS.some((m) => m.id === r.id) ? paint(r.id) : { wall: '#E4DAC4', wallHi: '#F2EBDC', low: '#CFC2A6', trim: '#8E806A' };
  const y = r.y0 - Hw;
  const doors = L.doors.filter((d) => d.wall === 'face' && d.room === r.id).sort((a, b) => a.x - b.x);
  // the wall in pieces between its doors
  const pieces = [];
  let x = r.x0;
  for (const d of doors) {
    pieces.push([x, d.x - d.w / 2]);
    x = d.x + d.w / 2;
  }
  pieces.push([x, r.x1]);
  const lowH = Hw * 0.4;
  let s = '';
  for (const [a, b] of pieces) {
    if (b - a < 0.5) continue;
    const w = b - a;
    s += `<rect x="${f(a)}" y="${f(y)}" width="${f(w)}" height="${Hw}" fill="${c.wall}"/>`;
    s += `<rect x="${f(a)}" y="${f(r.y0 - lowH)}" width="${f(w)}" height="${f(lowH)}" fill="${c.low}"/>`;
    // panels in the wainscot
    const n = Math.max(1, Math.round(w / (Hw * 0.9)));
    for (let k = 0; k < n; k++) {
      const pw = w / n;
      s += `<rect x="${f(a + k * pw + 2.5)}" y="${f(r.y0 - lowH + 2.5)}" width="${f(pw - 5)}" height="${f(lowH - 6)}" fill="none" stroke="${c.trim}" stroke-opacity=".35" stroke-width=".8" rx="1"/>`;
    }
    s += `<rect x="${f(a)}" y="${f(y)}" width="${f(w)}" height="${Hw}" fill="url(#mp-face)"/>`;
    s += `<path d="M${f(a)} ${f(r.y0 - lowH)}h${f(w)}" stroke="${c.trim}" stroke-width="1.4" opacity=".7"/>`;
    s += `<path d="M${f(a)} ${f(r.y0 - 1.2)}h${f(w)}" stroke="${c.trim}" stroke-width="2.4"/>`;
    s += `<path d="M${f(a)} ${f(y + 2)}h${f(w)}" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>`;
  }
  // door frames, and the threshold
  for (const d of doors) {
    const [a, b] = [d.x - d.w / 2, d.x + d.w / 2];
    s += `<path d="M${f(a - 1.5)} ${f(r.y0)}V${f(y + 1)}M${f(b + 1.5)} ${f(r.y0)}V${f(y + 1)}" stroke="${c.trim}" stroke-width="3"/>`;
    s += `<path d="M${f(a)} ${f(y + 3)}H${f(b)}" stroke="${c.trim}" stroke-width="4"/>`;
    s += `<path d="M${f(a)} ${f(r.y0 - 0.5)}H${f(b)}" stroke="#fff" stroke-opacity=".5" stroke-width="1.2"/>`;
  }
  // the top of the wall
  const t = north ? L.ext * 0.55 : 4.5;
  s += `<rect x="${f(r.x0)}" y="${f(y - t)}" width="${f(r.x1 - r.x0)}" height="${f(t)}" fill="${north ? STONE : '#F4EEE2'}" stroke="${STONE_DK}" stroke-width=".6"/>`;
  // a shadow on the floor at the wall's foot
  s += `<rect x="${f(r.x0)}" y="${f(r.y0)}" width="${f(r.x1 - r.x0)}" height="5" fill="#000" opacity=".1"/>`;
  if (ROOMS.some((m) => m.id === r.id)) s += sign(r, L, c, doors);
  return s;
}

/* How wide a room's name is on its sign: each capital's width in its font, with the sign's
   letter spacing, in ems (measured in Chromium; anything else is taken as a wide letter). */
const EM = { A: 0.79, B: 0.72, C: 0.72, D: 0.77, E: 0.71, F: 0.72, G: 0.81, H: 0.76, I: 0.33, J: 0.64, K: 0.69, L: 0.66, M: 0.91, N: 0.78, O: 0.82, P: 0.7, Q: 0.86, R: 0.71, S: 0.65, T: 0.75, U: 0.79, V: 0.69, W: 1.05, X: 0.79, Y: 0.74, Z: 0.69, ' ': 0.35 };
const capsWidth = (t, fs) => [...t].reduce((a, ch) => a + (EM[ch] ?? 0.85), 0) * fs;

function sign(r, L, c, doors) {
  const { Hw } = L;
  const room = ROOMS.find((m) => m.id === r.id);
  const fs = clamp(Hw * 0.34, 10.5, 14);
  const text = room.name.toUpperCase();
  // the name, a gap, the arrow, and the same room either end
  const w = capsWidth(text, fs) + fs * 2.2;
  let x = (r.x0 + r.x1) / 2;
  // clear of the doors in this wall
  for (const d of doors) {
    if (Math.abs(d.x - x) < w / 2 + d.w / 2 + 6) x = d.x < x ? d.x + d.w / 2 + w / 2 + 8 : d.x - d.w / 2 - w / 2 - 8;
  }
  x = clamp(x, r.x0 + w / 2 + 6, r.x1 - w / 2 - 6);
  const h = fs + 9;
  const y = r.y0 - Hw * 0.58 - h / 2;
  return `<a href="#room/${r.id}" class="sign" aria-label="${esc(room.name)}: walk through the room">`
    + `<rect class="ring" x="${f(x - w / 2 - 3)}" y="${f(y - 3)}" width="${f(w + 6)}" height="${f(h + 6)}" rx="${f(h / 2 + 3)}"/>`
    + `<rect x="${f(x - w / 2)}" y="${f(y + 1.5)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="#000" opacity=".25"/>`
    + `<rect class="tag" x="${f(x - w / 2)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="${c.trim}" stroke="${mix(c.trim, '#fff', 0.35)}" stroke-width="1"/>`
    + `<text x="${f(x - fs * 0.34)}" y="${f(y + h / 2 + fs * 0.36)}" text-anchor="middle" font-size="${f(fs)}" font-weight="600" letter-spacing=".1em" fill="${CREAM}">${esc(text)}</text>`
    + `<path d="M${f(x + w / 2 - fs * 1.09)} ${f(y + h / 2 - fs * 0.3)}l${f(fs * 0.32)} ${f(fs * 0.3)}l${f(-fs * 0.32)} ${f(fs * 0.3)}" fill="none" stroke="${CREAM}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
    + '</a>';
}

/* An instrument standing on the floor, its plaque in front. */
function item(it, L, played) {
  const { ex, x, y, s } = it;
  const fs = L.font;
  let g = figure(ex.id, x, y, s);
  // the plaque
  const words = it.lines === 2 ? splitName(ex.name) : [ex.name];
  const w = Math.max(...words.map((t) => t.length)) * fs * 0.56 + 12;
  const h = words.length * fs * 1.1 + 6;
  const py = y + 4;
  const c = paint(it.room);
  let p = `<rect x="${f(x - w / 2)}" y="${f(py + 1.2)}" width="${f(w)}" height="${f(h)}" rx="3" fill="#000" opacity=".22"/>`
    + `<rect class="tag" x="${f(x - w / 2)}" y="${f(py)}" width="${f(w)}" height="${f(h)}" rx="3" fill="${CREAM}" stroke="${c.trim}" stroke-opacity=".5" stroke-width=".8"/>`;
  words.forEach((t, k) => {
    p += `<text x="${f(x)}" y="${f(py + 3 + fs * 0.88 + k * fs * 1.1)}" text-anchor="middle" font-size="${f(fs)}" font-weight="600" fill="${INK}">${esc(t)}</text>`;
  });
  if (played) {
    const cx = x + w / 2 - 1;
    const cy = py + 1;
    p += `<g class="played"><circle cx="${f(cx)}" cy="${f(cy)}" r="6.5" fill="#E9B949" stroke="#8A6418" stroke-width="1"/><path d="M${f(cx - 3)} ${f(cy)}l2.1 2.2 3.9-4.2" fill="none" stroke="#3A2A08" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  const top = y - s * ((BOX[ex.id][3] - BOX[ex.id][1]) / 120);
  const ring = `<rect class="ring" x="${f(x - Math.max(w, s * 0.8) / 2 - 4)}" y="${f(top - 4)}" width="${f(Math.max(w, s * 0.8) + 8)}" height="${f(py + h - top + 8)}" rx="8"/>`;
  return `<a href="#${ex.id}" class="ex" aria-label="${esc(ex.name)}${played ? ' (played)' : ''}">${ring}<g class="fig">${g}</g>${p}</a>`;
}

function splitName(name) {
  const words = name.split(' ');
  let best = [name];
  let bestW = Infinity;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' ');
    const b = words.slice(k).join(' ');
    const w = Math.max(a.length, b.length);
    if (w < bestW) { bestW = w; best = [a, b]; }
  }
  return best;
}

/* An exhibit's drawing, s pixels to its 120 units, its bottom edge on the floor at (x, y). */
export function figure(id, x, y, s, { shadow = true } = {}) {
  const [x0, , x1, y1] = BOX[id];
  const k = s / 120;
  let svg = art(id).replace(/^<svg viewBox="0 0 120 120" role="img" aria-label="[^"]*">/,
    `<svg x="${f(x - ((x0 + x1) / 2) * k)}" y="${f(y - y1 * k)}" width="${f(s)}" height="${f(s)}" viewBox="0 0 120 120" overflow="visible" aria-hidden="true">`);
  if (!shadow) svg = svg.replace(/<(ellipse|path|circle)[^>]*fill="url\(#a\d+shadow\)"[^>]*\/>/g, '');
  return svg;
}

/* A wall up the page: only its top shows, and its end where it stops. */
function bar(b, L) {
  const { Hw } = L;
  const t = b.outside ? L.ext : 7;
  const segs = [];
  let y = b.from;
  for (const [g0, g1] of b.gaps.sort((p, q) => p[0] - q[0])) {
    segs.push([y, g0]);
    y = g1;
  }
  segs.push([y, b.to]);
  let s = '';
  for (const [a, z] of segs) {
    if (z - a < 1) continue;
    s += `<rect x="${f(b.x - t / 2)}" y="${f(a - Hw)}" width="${f(t)}" height="${f(z - a)}" fill="${b.outside ? STONE : '#F4EEE2'}" stroke="${STONE_DK}" stroke-width=".6"/>`;
    s += `<rect x="${f(b.x - t / 2)}" y="${f(z - Hw)}" width="${f(t)}" height="${f(Hw)}" fill="${b.outside ? '#CFC4AA' : '#DDD3C0'}" stroke="${STONE_DK}" stroke-width=".6"/>`;
  }
  return s;
}

/* The rotunda: a ring of columns round a mosaic, and the tour desk in the middle. */
function rotunda(r, L) {
  const { Hw } = L;
  const cx = (r.x0 + r.x1) / 2;
  const rx = L.two ? Math.min(L.W * 0.3, 150) : (r.x1 - r.x0) / 2 - 16;
  const ry = rx * 0.45;
  const colH = Hw * 1.5;
  const cy = L.two ? r.y0 + colH + ry + 10 : (r.y0 + r.y1 - Hw) / 2 + colH / 2 - 4;
  let back = '';
  let front = '';
  // the mosaic
  let s = `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx + 8)}" ry="${f(ry + 4)}" fill="#E3D7BC"/>`;
  [[1, '#F4ECDC'], [0.86, '#3C5A48'], [0.8, '#EFE5CF'], [0.5, '#D9B26F'], [0.44, '#F4ECDC']].forEach(([k, c]) => {
    s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx * k)}" ry="${f(ry * k)}" fill="${c}"/>`;
  });
  // an eight-point star
  const star = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const k = i % 2 ? 0.34 : 0.78;
    star.push(`${f(cx + Math.cos(a) * rx * k)} ${f(cy + Math.sin(a) * ry * k)}`);
  }
  s += `<path d="M${star.join('L')}Z" fill="#3C5A48" opacity=".9"/>`;
  s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx * 0.3)}" ry="${f(ry * 0.3)}" fill="#D9B26F"/>`;
  // the columns: those at the back first, then the ring they hold up, then those in front
  const n = 10;
  const cw = clamp(rx * 0.085, 7, 11);
  const column = (x, y) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(cw * 1.2)}" ry="${f(cw * 0.5)}" fill="#000" opacity=".2"/>`
    + `<rect x="${f(x - cw * 0.72)}" y="${f(y - 3)}" width="${f(cw * 1.44)}" height="3" fill="#E7DDC8" stroke="${STONE_DK}" stroke-width=".5"/>`
    + `<rect x="${f(x - cw / 2)}" y="${f(y - colH)}" width="${f(cw)}" height="${f(colH - 3)}" fill="url(#mp-col)"/>`
    + `<rect x="${f(x - cw * 0.75)}" y="${f(y - colH - 3)}" width="${f(cw * 1.5)}" height="3.5" fill="#F4EEE2" stroke="${STONE_DK}" stroke-width=".5"/>`;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (Math.sin(a) < 0) back += column(x, y);
    else front += column(x, y);
  }
  const ring = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i / 24) * Math.PI;
    ring.push(`${f(cx + Math.cos(a) * rx)} ${f(cy + Math.sin(a) * ry - colH - 4)}`);
  }
  back += `<path d="M${ring.join('L')}" fill="none" stroke="${STONE_DK}" stroke-width="9" stroke-linecap="round"/><path d="M${ring.join('L')}" fill="none" stroke="#F4EEE2" stroke-width="6.5" stroke-linecap="round"/>`;
  // the tour desk
  const dr = clamp(rx * 0.26, 18, 30);
  const dh = dr * 0.5;
  const dy = cy + 2;
  let desk = `<a href="#tour/1" class="desk" aria-label="The tour desk: start the audio tour">`
    + `<ellipse class="ring" cx="${f(cx)}" cy="${f(dy - dh / 2)}" rx="${f(dr + 6)}" ry="${f(dr * 0.42 + dh / 2 + 8)}"/>`
    + `<ellipse cx="${f(cx)}" cy="${f(dy + 2)}" rx="${f(dr * 1.1)}" ry="${f(dr * 0.42)}" fill="#000" opacity=".25"/>`
    + `<path d="M${f(cx - dr)} ${f(dy - dh)}V${f(dy)}A${f(dr)} ${f(dr * 0.38)} 0 0 0 ${f(cx + dr)} ${f(dy)}V${f(dy - dh)}Z" fill="#6B4022"/>`
    + `<path d="M${f(cx - dr)} ${f(dy - dh * 0.35)}A${f(dr)} ${f(dr * 0.38)} 0 0 0 ${f(cx + dr)} ${f(dy - dh * 0.35)}" fill="none" stroke="#D9B26F" stroke-width="1.6"/>`
    + `<ellipse cx="${f(cx)}" cy="${f(dy - dh)}" rx="${f(dr)}" ry="${f(dr * 0.38)}" fill="#8A5634" stroke="#4A2A14" stroke-width=".8"/>`
    + `<ellipse cx="${f(cx)}" cy="${f(dy - dh)}" rx="${f(dr * 0.62)}" ry="${f(dr * 0.22)}" fill="#3C5A48"/>`;
  // headphones on the desk, and a sign
  const hy = dy - dh - dr * 0.12;
  desk += `<path d="M${f(cx - 7)} ${f(hy)}a7 7 0 0 1 14 0" fill="none" stroke="${CREAM}" stroke-width="2"/><rect x="${f(cx - 9)}" y="${f(hy - 1)}" width="4.5" height="6" rx="1.5" fill="${CREAM}"/><rect x="${f(cx + 4.5)}" y="${f(hy - 1)}" width="4.5" height="6" rx="1.5" fill="${CREAM}"/>`;
  const fs = clamp(Hw * 0.3, 10, 12.5);
  const tw = 'Audio tour'.length * fs * 0.58 + 14;
  const ty = dy + dr * 0.38 + 6;
  const label = `<rect x="${f(cx - tw / 2)}" y="${f(ty)}" width="${f(tw)}" height="${f(fs + 7)}" rx="${f((fs + 7) / 2)}" fill="${INK}" stroke="#D9B26F" stroke-width="1"/><text x="${f(cx)}" y="${f(ty + fs * 0.88 + 3)}" text-anchor="middle" font-size="${f(fs)}" font-weight="600" fill="${CREAM}">Audio tour</text>`;
  // On a phone the entrance is in the rotunda's front wall: a runner from the door, and the pin.
  if (L.two) {
    const w = L.dw * 1.2;
    const y0 = cy + ry + 6;
    s += `<rect x="${f(cx - w / 2)}" y="${f(y0)}" width="${f(w)}" height="${f(r.y1 - Hw - y0 + 2)}" fill="#8A2E36"/><rect x="${f(cx - w / 2 + 3)}" y="${f(y0)}" width="${f(w - 6)}" height="${f(r.y1 - Hw - y0 + 2)}" fill="none" stroke="#E9C46A" stroke-opacity=".6" stroke-width="1"/>`;
    front += here(cx, r.y1 - Hw - 8, L);
  }
  // (the desk's link holds its label, drawn over the columns in front)
  return `${s}${back}${desk}</a>${front}<a href="#tour/1" class="desk" tabindex="-1" aria-hidden="true">${label}</a>`;
}

/* The entrance hall: a runner from the door to the rotunda, and where you are. */
function entrance(r, L) {
  const cx = (r.x0 + r.x1) / 2;
  const w = L.dw * 1.2;
  let s = `<rect x="${f(cx - w / 2)}" y="${f(r.y0 - 2)}" width="${f(w)}" height="${f(r.y1 - r.y0 - L.Hw + 2)}" fill="#8A2E36"/><rect x="${f(cx - w / 2 + 3)}" y="${f(r.y0 - 2)}" width="${f(w - 6)}" height="${f(r.y1 - r.y0 - L.Hw + 2)}" fill="none" stroke="#E9C46A" stroke-opacity=".6" stroke-width="1"/>`;
  s += here(cx, Math.min(r.y1 - L.Hw - 12, r.y0 + 62), L);
  return s;
}

function here(x, y, L) {
  const fs = clamp(L.Hw * 0.3, 10, 12);
  const label = 'You are here';
  const w = label.length * fs * 0.55 + 12;
  const lx = x - w / 2;
  const ly = y - 34 - fs - 7;
  return `<g class="here" aria-hidden="true"><ellipse cx="${f(x)}" cy="${f(y)}" rx="7" ry="3" fill="#000" opacity=".25"/>`
    + `<path d="M${f(x)} ${f(y)}C${f(x - 3)} ${f(y - 8)} ${f(x - 9)} ${f(y - 12)} ${f(x - 9)} ${f(y - 19)}A9 9 0 1 1 ${f(x + 9)} ${f(y - 19)}C${f(x + 9)} ${f(y - 12)} ${f(x + 3)} ${f(y - 8)} ${f(x)} ${f(y)}Z" fill="#D2463C" stroke="#7A1E18" stroke-width="1"/>`
    + `<circle cx="${f(x)}" cy="${f(y - 19)}" r="3.6" fill="#fff"/>`
    + `<rect x="${f(lx)}" y="${f(ly)}" width="${f(w)}" height="${f(fs + 7)}" rx="4" fill="${INK}"/><path d="M${f(x - 4)} ${f(ly + fs + 7)}l4 4 4-4z" fill="${INK}"/><text x="${f(x)}" y="${f(ly + fs * 0.88 + 3)}" text-anchor="middle" font-size="${f(fs)}" font-weight="500" fill="${CREAM}">${label}</text></g>`;
}

/* The front of the building: stone, tall windows, and the doors in the middle. */
function facade(L) {
  const { Hw, B, W, edge } = L;
  const y = B - Hw;
  const cx = W / 2;
  const door = L.dw * 1.25;
  let s = `<rect x="${f(edge)}" y="${f(y)}" width="${f(W - 2 * edge)}" height="${Hw}" fill="${STONE}"/>`;
  // courses of stone
  for (let k = 1; k < 4; k++) s += `<path d="M${f(edge)} ${f(y + (Hw * k) / 4)}H${f(W - edge)}" stroke="${STONE_DK}" stroke-opacity=".45" stroke-width=".7"/>`;
  s += `<rect x="${f(edge)}" y="${f(y)}" width="${f(W - 2 * edge)}" height="${Hw}" fill="url(#mp-face)"/>`;
  // windows, either side of the doors
  const ww = Math.max(10, Hw * 0.34);
  const wh = Hw * 0.62;
  const step = Math.max(ww * 3.2, 46);
  for (const dir of [-1, 1]) {
    for (let x = cx + dir * (door / 2 + step * 0.9); dir < 0 ? x > edge + ww : x < W - edge - ww; x += dir * step) {
      s += `<path d="M${f(x - ww / 2)} ${f(y + Hw * 0.86)}V${f(y + Hw * 0.86 - wh + ww / 2)}A${f(ww / 2)} ${f(ww / 2)} 0 0 1 ${f(x + ww / 2)} ${f(y + Hw * 0.86 - wh + ww / 2)}V${f(y + Hw * 0.86)}Z" fill="url(#mp-glass)" stroke="#8E806A" stroke-width="1.6"/>`
        + `<path d="M${f(x)} ${f(y + Hw * 0.86)}V${f(y + Hw * 0.86 - wh)}M${f(x - ww / 2)} ${f(y + Hw * 0.86 - wh * 0.45)}H${f(x + ww / 2)}" stroke="#E9E0CB" stroke-width="1"/>`;
    }
  }
  // the doors, open, the hall's floor seen through them
  s += `<rect x="${f(cx - door / 2)}" y="${f(y + 3)}" width="${f(door)}" height="${f(Hw - 3)}" fill="url(#mp-hallfloor)"/><rect x="${f(cx - door / 2)}" y="${f(y + 3)}" width="${f(door)}" height="${f(Hw - 3)}" fill="#000" opacity=".25"/>`;
  s += `<path d="M${f(cx - door / 2)} ${f(B)}V${f(y + 2)}H${f(cx + door / 2)}V${f(B)}" fill="none" stroke="#8E806A" stroke-width="3"/>`;
  // the top of the wall
  const t = L.ext * 0.55;
  s += `<rect x="${f(edge)}" y="${f(y - t)}" width="${f(W - 2 * edge)}" height="${f(t)}" fill="${STONE}" stroke="${STONE_DK}" stroke-width=".6"/>`;
  return s;
}

/* Outside the front: steps, a portico with the museum's name, the path, trees and lamps. */
function outside(L) {
  const { Hw, B, W, edge } = L;
  const cx = W / 2;
  const span = clamp(L.dw * 3.2, 110, 170);
  let s = '';
  // the path
  const pw = span * 0.6;
  s += `<path d="M${f(cx - pw / 2)} ${f(B)}L${f(cx - pw * 0.7)} ${f(L.H)}H${f(cx + pw * 0.7)}L${f(cx + pw / 2)} ${f(B)}Z" fill="#E3D8C0"/>`;
  s += `<path d="M${f(cx - pw / 2)} ${f(B)}L${f(cx - pw * 0.7)} ${f(L.H)}M${f(cx + pw / 2)} ${f(B)}L${f(cx + pw * 0.7)} ${f(L.H)}" stroke="#B9AC8E" stroke-width="1.5"/>`;
  // hedges along the front
  for (const dir of [-1, 1]) {
    for (let x = cx + dir * (span / 2 + 22); dir < 0 ? x > edge + 8 : x < W - edge - 8; x += dir * 26) {
      s += `<ellipse cx="${f(x)}" cy="${f(B + 6)}" rx="13" ry="5" fill="#000" opacity=".2"/><ellipse cx="${f(x)}" cy="${f(B + 1)}" rx="12" ry="7" fill="url(#mp-leaf)"/>`;
    }
  }
  // the steps
  for (let k = 0; k < 3; k++) {
    const w = span + 10 + k * 14;
    const y = B + k * 5;
    s += `<rect x="${f(cx - w / 2)}" y="${f(y)}" width="${f(w)}" height="5.5" fill="${k % 2 ? '#E2D8C2' : '#EDE5D3'}" stroke="${STONE_DK}" stroke-width=".6"/>`;
  }
  // the portico: four columns, the name across the top, a pediment
  const colH = Hw * 1.55;
  const base = B + 3;
  const cw = 9;
  for (let k = 0; k < 4; k++) {
    const x = cx - span / 2 + 10 + (k * (span - 20)) / 3;
    s += `<rect x="${f(x - cw * 0.7)}" y="${f(base - 3)}" width="${f(cw * 1.4)}" height="3" fill="#E7DDC8" stroke="${STONE_DK}" stroke-width=".5"/>`
      + `<rect x="${f(x - cw / 2)}" y="${f(base - colH)}" width="${cw}" height="${f(colH - 3)}" fill="url(#mp-col)"/>`
      + `<rect x="${f(x - cw * 0.75)}" y="${f(base - colH - 3)}" width="${f(cw * 1.5)}" height="3.5" fill="#F4EEE2" stroke="${STONE_DK}" stroke-width=".5"/>`;
  }
  const eh = clamp(Hw * 0.42, 13, 17);
  const ey = base - colH - 3 - eh;
  s += `<rect x="${f(cx - span / 2)}" y="${f(ey)}" width="${f(span)}" height="${f(eh)}" fill="#F4EEE2" stroke="${STONE_DK}" stroke-width=".8"/>`;
  s += `<text x="${f(cx)}" y="${f(ey + eh * 0.72)}" text-anchor="middle" font-size="${f(eh * 0.56)}" font-weight="600" letter-spacing=".14em" fill="${INK}">INSTRUMENT MUSEUM</text>`;
  s += `<path d="M${f(cx - span / 2 - 4)} ${f(ey)}L${f(cx)} ${f(ey - eh * 1.15)}L${f(cx + span / 2 + 4)} ${f(ey)}Z" fill="#EFE7D6" stroke="${STONE_DK}" stroke-width=".8"/>`;
  s += `<circle cx="${f(cx)}" cy="${f(ey - eh * 0.45)}" r="${f(eh * 0.26)}" fill="none" stroke="#B9AC8E" stroke-width="1.2"/>`;
  // trees and lamps either side of the path
  const tree = (x, y, r) => `<ellipse cx="${f(x + r * 0.3)}" cy="${f(y + 2)}" rx="${f(r * 1.05)}" ry="${f(r * 0.4)}" fill="#000" opacity=".25"/>`
    + `<rect x="${f(x - 2)}" y="${f(y - r * 0.9)}" width="4" height="${f(r * 0.9)}" fill="#5A3A1E"/>`
    + `<circle cx="${f(x)}" cy="${f(y - r * 1.4)}" r="${f(r)}" fill="url(#mp-leaf)"/>`
    + `<circle cx="${f(x - r * 0.35)}" cy="${f(y - r * 1.7)}" r="${f(r * 0.45)}" fill="#9CC47C" opacity=".35"/>`;
  const lamp = (x, y) => `<rect x="${f(x - 1)}" y="${f(y - 30)}" width="2" height="30" fill="#2A2A28"/><circle cx="${f(x)}" cy="${f(y - 32)}" r="4" fill="#FFE9A8" stroke="#2A2A28" stroke-width="1"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="4" ry="1.5" fill="#000" opacity=".3"/>`;
  const ty = L.H - 6;
  const tr = clamp(Hw * 0.5, 13, 20);
  for (const dir of [-1, 1]) {
    s += lamp(cx + dir * (pw * 0.62 + 10), B + Hw * 1.5);
    let x = cx + dir * (pw * 0.75 + tr * 2.2);
    while (dir < 0 ? x > edge + tr : x < W - edge - tr) {
      s += tree(x, ty - ((Math.abs(x - cx) / 37) % 3) * 2, tr * (0.85 + ((Math.abs(x) / 53) % 1) * 0.3));
      x += dir * tr * 3.1;
    }
  }
  return s;
}
