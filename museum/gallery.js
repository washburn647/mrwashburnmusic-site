/* A walk through one room (#room/strings): its long wall, lit, its instruments at their real
   sizes, the big ones on low risers on the floor, the others on pedestals and the smallest in
   glass cases, each with its plaque, and a door at each end into the rooms either side. Scroll,
   swipe or use the arrow keys to walk; tap an instrument to play it.
   Drawn for the height the walk has: one unit (u) is a hundredth of it, and the wall, from the
   floor where the exhibits stand to the ceiling, is three metres. */

import { ROOMS, EXHIBITS } from './data.js';
import { BOX } from './art.js';
import { figure, paint, mix } from './plan.js';

const f = (n) => Math.round(n * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* How each stands: on a riser on the floor, on a pedestal, or in a glass case on a pedestal.
   lean: held at its angle by a clear stand, not resting on a corner. */
const FLOOR = new Set(['piano', 'organ', 'cello', 'bass', 'harp', 'bassoon', 'tuba', 'drums', 'timpani', 'snare', 'bassdrum', 'gong', 'xylophone', 'marimba', 'congas']);
const CASE = new Set(['violin', 'viola', 'ukulele', 'triangle', 'tambourine', 'claves', 'shaker', 'cabasa', 'kalimba']);
const LEAN = new Set(['violin', 'viola', 'ukulele', 'guitar', 'electric-guitar', 'electric-bass', 'banjo', 'flute', 'clarinet', 'oboe', 'agogo', 'sleigh-bells', 'cabasa']);
export const mountOf = (id) => (FLOOR.has(id) ? 'floor' : CASE.has(id) ? 'case' : 'pedestal');

const GROUND = 88;          // where pedestals and risers stand, in u from the top
const CM = 82 / 300;        // u to a centimetre: three metres from there to the ceiling
const PED = 95;             // a pedestal's height, cm
const RISER = 2.4;          // a riser's front, u

/* "1.85 m (6 feet) tall" */
export function sizeText([cm, way]) {
  const inches = cm / 2.54;
  const metric = cm >= 100 ? `${(cm / 100).toFixed(2).replace(/0$/, '').replace(/\.0$/, '')} m` : `${cm} cm`;
  let us;
  if (inches >= 30) {
    const ft = Math.round((inches / 12) * 2) / 2;
    us = `${String(ft).replace('.5', '½')} feet`;
  } else {
    const n = inches < 6 ? Math.round(inches * 2) / 2 : Math.round(inches);
    us = `${String(n).replace('.5', '½')} inch${n === 1 ? '' : 'es'}`;
  }
  return `${us} ${way} (${metric})`;
}

/* Everything's place, for a walk h pixels high and at least w wide. */
export function layout(roomId, w, h) {
  // On a tall, narrow screen the room is drawn no bigger than its width allows, and the wall
  // goes on up to a higher ceiling (dy: how far everything stands below the top).
  const u = Math.min(h, w * 1.5) / 100;
  const dy = h - 100 * u;
  const list = EXHIBITS.filter((e) => e.room === roomId);
  const i = ROOMS.findIndex((r) => r.id === roomId);
  const prev = ROOMS[(i + ROOMS.length - 1) % ROOMS.length];
  const next = ROOMS[(i + 1) % ROOMS.length];
  const door = 26 * u;
  // the wall text, beside the door: on a phone, narrow enough to read without walking on
  const intro = Math.max(190, Math.min(clamp(46 * u, Math.min(250, w - 48), Math.min(420, w - 48)), w - door - 2.4 * u - 12));
  const bays = list.map((ex) => {
    const [x0, y0, x1, y1, cm] = BOX[ex.id];
    const mount = mountOf(ex.id);
    const shown = Math.max(cm, mount === 'case' ? 34 : 28);
    const big = Math.max(x1 - x0, y1 - y0);
    const s = (shown * CM * u * 120) / big;          // the drawing's 120 units, in pixels
    const dw = ((x1 - x0) / 120) * s;
    const dh = ((y1 - y0) / 120) * s;
    const width = Math.max(dw + 12 * u, mount === 'floor' ? 30 * u : 25 * u, 150);
    return { ex, mount, s, dw, dh, width };
  });
  const content = door + intro + bays.reduce((a, b) => a + b.width, 0) + door;
  const W = Math.max(w, content + 8 * u);
  const spare = (W - content) / 2;
  let x = door + spare * 0.6;
  const introX = x;
  x += intro;
  for (const b of bays) {
    b.x = x + b.width / 2;
    x += b.width;
    // where it stands, and its top
    const top = b.mount === 'floor' ? GROUND - RISER - 2.2 : GROUND - PED * CM;
    b.foot = top * u;
    b.lift = LEAN.has(b.ex.id) ? Math.min(b.dh * 0.18, 5 * u) : 0;
    b.top = b.foot - b.lift - b.dh;
  }
  return { roomId, u, dy, W, h, prev, next, door, intro, introX, bays };
}

export function scene(L, { stop = null } = {}) {
  const { u, W, h, dy } = L;
  const top = -dy;          // the ceiling, in the room's own units
  const c = paint(L.roomId);
  const room = ROOMS.find((r) => r.id === L.roomId);
  const id = `g-${L.roomId}`;
  const wall = mix(c.wall, '#000', 0.1);
  let d = '';
  d += `<linearGradient id="${id}-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(wall, '#000', 0.18)}"/><stop offset=".5" stop-color="${wall}"/><stop offset="1" stop-color="${mix(wall, '#000', 0.08)}"/></linearGradient>`;
  d += `<pattern id="${id}-paper" width="${f(3.2 * u)}" height="10" patternUnits="userSpaceOnUse"><rect width="${f(1.1 * u)}" height="10" fill="#fff" opacity=".05"/></pattern>`;
  d += `<pattern id="${id}-panel" x="0" y="${f(54 * u)}" width="${f(17 * u)}" height="${f(20 * u)}" patternUnits="userSpaceOnUse"><rect x="${f(1.8 * u)}" y="${f(2.6 * u)}" width="${f(13.4 * u)}" height="${f(14 * u)}" rx="${f(0.4 * u)}" fill="none" stroke="${c.trim}" stroke-opacity=".45" stroke-width="${f(0.45 * u)}"/><rect x="${f(2.3 * u)}" y="${f(3.1 * u)}" width="${f(12.4 * u)}" height="${f(13 * u)}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="${f(0.25 * u)}"/></pattern>`;
  d += `<linearGradient id="${id}-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6DE" stop-opacity=".34"/><stop offset="1" stop-color="#FFF6DE" stop-opacity="0"/></linearGradient>`;
  d += `<radialGradient id="${id}-pool"><stop offset="0" stop-color="#FFF4D6" stop-opacity=".5"/><stop offset=".6" stop-color="#FFF4D6" stop-opacity=".16"/><stop offset="1" stop-color="#FFF4D6" stop-opacity="0"/></radialGradient>`;
  d += `<radialGradient id="${id}-spot"><stop offset="0" stop-color="#FFF4D6" stop-opacity=".95"/><stop offset=".5" stop-color="#FFE9A8" stop-opacity=".5"/><stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/></radialGradient>`;
  d += `<radialGradient id="${id}-shadow"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
  d += `<linearGradient id="${id}-ped" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#D9D1C0"/><stop offset=".18" stop-color="#FBF8F1"/><stop offset=".55" stop-color="#EEE7D8"/><stop offset="1" stop-color="#BDB3A0"/></linearGradient>`;
  d += `<linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".3" stop-color="#fff" stop-opacity=".06"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#fff" stop-opacity=".16"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  d += `<linearGradient id="${id}-crown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F5EFE2"/><stop offset=".55" stop-color="#E6DCC7"/><stop offset=".56" stop-color="${mix(c.trim, '#fff', 0.55)}"/><stop offset="1" stop-color="${c.trim}"/></linearGradient>`;
  d += floorDefs(id, L, c);
  let s = '';
  // the wall, its wallpaper, the wainscot, the rails, the crown and the skirting
  s += `<rect y="${f(top)}" width="${f(W)}" height="${f(76 * u - top)}" fill="url(#${id}-wall)"/>`;
  s += `<rect y="${f(top + 6 * u)}" width="${f(W)}" height="${f(48 * u - top)}" fill="url(#${id}-paper)"/>`;
  s += `<rect y="${f(54 * u)}" width="${f(W)}" height="${f(20 * u)}" fill="${mix(c.low, '#000', 0.12)}"/><rect y="${f(54 * u)}" width="${f(W)}" height="${f(20 * u)}" fill="url(#${id}-panel)"/>`;
  s += `<rect y="${f(53.2 * u)}" width="${f(W)}" height="${f(1.4 * u)}" fill="${c.trim}"/><rect y="${f(53.2 * u)}" width="${f(W)}" height="${f(0.35 * u)}" fill="#fff" opacity=".35"/>`;
  s += `<rect y="${f(14 * u)}" width="${f(W)}" height="${f(0.6 * u)}" fill="${c.trim}" opacity=".8"/>`;
  s += `<rect y="${f(71.5 * u)}" width="${f(W)}" height="${f(3.5 * u)}" fill="${c.trim}"/><rect y="${f(71.5 * u)}" width="${f(W)}" height="${f(0.4 * u)}" fill="#fff" opacity=".3"/>`;
  s += `<rect y="${f(top)}" width="${f(W)}" height="${f(6 * u)}" fill="url(#${id}-crown)"/>`;
  // the floor
  s += `<rect y="${f(75 * u)}" width="${f(W)}" height="${f(25 * u)}" fill="url(#${id}-floor)"/>`;
  s += `<rect y="${f(75 * u)}" width="${f(W)}" height="${f(25 * u)}" fill="url(#${id}-floorlight)"/>`;
  // the doors at each end
  s += doorway(L, 0, L.prev, c, id);
  s += doorway(L, W - L.door, L.next, c, id);
  // a bench in front of the words on the wall
  s += bench(L.introX + L.intro / 2, u, c);
  // the track the lights hang from
  s += `<rect y="${f(top + 6.4 * u)}" width="${f(W)}" height="${f(0.7 * u)}" fill="#2A2622"/>`;
  // each exhibit: its light, its stand, itself, its case
  for (const b of L.bays) s += exhibit(b, L, c, id, stop === b.ex.id);
  return `<svg class="scene" width="${f(W)}" height="${f(h)}" viewBox="0 0 ${f(W)} ${f(h)}" aria-hidden="true"><defs>${d}</defs><g transform="translate(0 ${f(dy)})">${s}</g></svg>`;
}

function floorDefs(id, L, c) {
  const { u } = L;
  const top = 75 * u;
  const H = 25 * u;
  const T = Math.round(64 * u);
  const look = c.floor;
  // bands toward you, each deeper than the last
  const n = 7;
  const ys = Array.from({ length: n + 1 }, (_, i) => top + H * (i / n) ** 1.3);
  let body = '';
  const base = { parquet: '#C38B53', planks: '#9E6638', oak: '#D1AA72', carpet: '#7E2C36', checker: '#BCC5CC', terracotta: '#BE6B44' }[look];
  body += `<rect y="${f(top)}" width="${T}" height="${f(H)}" fill="${base}"/>`;
  for (let i = 0; i < n; i++) {
    const [a, b] = [ys[i], ys[i + 1]];
    const bh = b - a;
    if (look === 'planks' || look === 'oak' || look === 'parquet') {
      const len = look === 'parquet' ? bh * 2.2 : bh * 9;
      const dark = look === 'oak' ? '#6E4E24' : '#3E2210';
      body += `<path d="M0 ${f(b)}H${T}" stroke="${dark}" stroke-opacity=".35" stroke-width="${f(Math.max(0.6, bh * 0.06))}"/>`;
      if (i % 2) body += `<rect y="${f(a)}" width="${T}" height="${f(bh)}" fill="#000" opacity=".04"/>`;
      for (let x = ((i * 0.37) % 1) * len; x < T; x += len) {
        body += `<path d="M${f(x)} ${f(a)}V${f(b)}" stroke="${dark}" stroke-opacity=".3" stroke-width="${f(Math.max(0.6, bh * 0.05))}"/>`;
        if (look === 'parquet') {
          for (let k = 1; k < 4; k++) body += `<path d="M${f(x + (len * k) / 4)} ${f(a)}V${f(b)}" stroke="${dark}" stroke-opacity=".12" stroke-width=".6"/>`;
        }
      }
    } else if (look === 'checker' || look === 'terracotta') {
      const tw = bh * (look === 'checker' ? 2.6 : 2.2);
      const [c1, c2] = look === 'checker' ? ['#C9D0D5', '#97A4AE'] : ['#C2704A', '#B4613B'];
      for (let x = (i % 2) * -tw * 0.5, k = 0; x < T; x += tw, k++) {
        body += `<rect x="${f(x)}" y="${f(a)}" width="${f(tw)}" height="${f(bh)}" fill="${(k + i) % 2 ? c1 : c2}"/>`;
      }
      const grout = look === 'checker' ? '#6E7C87' : '#F3E3C6';
      body += `<path d="M0 ${f(b)}H${T}" stroke="${grout}" stroke-opacity=".45" stroke-width="${f(Math.max(0.6, bh * 0.05))}"/>`;
    } else if (look === 'carpet') {
      for (let x = 0; x < T; x += bh * 1.6) body += `<path d="M${f(x)} ${f(b)}L${f(x + bh * 0.8)} ${f(a)}L${f(x + bh * 1.6)} ${f(b)}" fill="none" stroke="#E9C46A" stroke-opacity=".16" stroke-width="${f(Math.max(0.6, bh * 0.05))}"/>`;
    }
  }
  if (look === 'carpet') body += `<rect y="${f(top + 1.2 * u)}" width="${T}" height="${f(0.6 * u)}" fill="#E9C46A" opacity=".55"/>`;
  return `<pattern id="${id}-floor" width="${T}" height="${f(top + H)}" patternUnits="userSpaceOnUse">${body}</pattern>`
    + `<linearGradient id="${id}-floorlight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset=".25" stop-color="#000" stop-opacity=".1"/><stop offset=".7" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>`;
}

/* A doorway into the next room: its wall and floor seen through it, and its name above. */
function doorway(L, x, to, c, id) {
  const { u } = L;
  const w = L.door;
  const there = paint(to.id);
  const [x0, x1] = [x + w * 0.16, x + w * 0.84];
  const top = 20 * u;
  let s = `<rect x="${f(x0)}" y="${f(top)}" width="${f(x1 - x0)}" height="${f(75 * u - top)}" fill="${mix(there.wall, '#000', 0.05)}"/>`;
  s += `<rect x="${f(x0)}" y="${f(56 * u)}" width="${f(x1 - x0)}" height="${f(14 * u)}" fill="${there.low}"/>`;
  s += `<rect x="${f(x0)}" y="${f(69 * u)}" width="${f(x1 - x0)}" height="${f(6 * u)}" fill="${mix(there.trim, '#000', 0.1)}" opacity=".9"/>`;
  s += `<rect x="${f(x0)}" y="${f(top)}" width="${f(x1 - x0)}" height="${f(75 * u - top)}" fill="url(#${id}-doorshade)"/>`;
  // the light from the room beyond, on this room's floor
  s += `<path d="M${f(x0)} ${f(75 * u)}H${f(x1)}L${f(x1 + 4 * u)} ${f(98 * u)}H${f(x0 - 4 * u)}Z" fill="#FFF6DE" opacity=".09"/>`;
  // the frame
  const fw = 1.6 * u;
  s += `<path d="M${f(x0 - fw / 2)} ${f(75 * u)}V${f(top - fw / 2)}H${f(x1 + fw / 2)}V${f(75 * u)}" fill="none" stroke="${c.trim}" stroke-width="${f(fw)}"/>`;
  s += `<path d="M${f(x0 - fw)} ${f(top - fw * 1.6)}H${f(x1 + fw)}" stroke="${c.trim}" stroke-width="${f(fw * 1.2)}"/>`;
  s += `<path d="M${f(x0 - fw)} ${f(75 * u)}V${f(top - fw)}H${f(x1 + fw)}V${f(75 * u)}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="${f(0.3 * u)}"/>`;
  return `<defs><linearGradient id="${id}-doorshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset=".5" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient></defs>${s}`;
}

function bench(x, u, c) {
  const w = 30 * u;
  const y = 90 * u;
  const seat = mix(c.trim, '#2A1A12', 0.35);
  return `<ellipse cx="${f(x)}" cy="${f(y + 6.2 * u)}" rx="${f(w * 0.58)}" ry="${f(1.4 * u)}" fill="#000" opacity=".25"/>`
    + `<rect x="${f(x - w / 2 + 1.5 * u)}" y="${f(y)}" width="${f(1.4 * u)}" height="${f(6.4 * u)}" fill="#3A2414"/><rect x="${f(x + w / 2 - 2.9 * u)}" y="${f(y)}" width="${f(1.4 * u)}" height="${f(6.4 * u)}" fill="#3A2414"/>`
    + `<rect x="${f(x - w / 2)}" y="${f(y - 2.6 * u)}" width="${f(w)}" height="${f(3.2 * u)}" rx="${f(1.2 * u)}" fill="${seat}"/>`
    + `<rect x="${f(x - w / 2 + 0.6 * u)}" y="${f(y - 2.4 * u)}" width="${f(w - 1.2 * u)}" height="${f(1 * u)}" rx="${f(0.5 * u)}" fill="#fff" opacity=".14"/>`
    + `<rect x="${f(x - w / 2 + 0.3 * u)}" y="${f(y + 0.4 * u)}" width="${f(w - 0.6 * u)}" height="${f(0.9 * u)}" fill="#3A2414"/>`;
}

function exhibit(b, L, c, id, lit) {
  const { u } = L;
  const { x, s: size, dw, dh } = b;
  let s = '';
  const glow = lit ? 1.5 : 1;
  // the light: a lamp on the track, its beam, its pool on the wall and on the floor
  const poolY = b.top + dh * 0.45;
  s += `<ellipse cx="${f(x)}" cy="${f(poolY)}" rx="${f(dw / 2 + 13 * u)}" ry="${f(Math.max(dh * 0.7, 16 * u))}" fill="url(#${id}-pool)" opacity="${glow}"/>`;
  s += `<ellipse cx="${f(x)}" cy="${f(GROUND * u + 2 * u)}" rx="${f(dw / 2 + 10 * u)}" ry="${f(4 * u)}" fill="url(#${id}-pool)" opacity="${0.8 * glow}"/>`;
  const lampX = x - 4 * u;
  const t = -L.dy;
  s += `<path d="M${f(lampX - 1 * u)} ${f(t + 9.5 * u)}L${f(lampX + 1 * u)} ${f(t + 9.5 * u)}L${f(x + dw / 2 + 7 * u)} ${f(b.foot)}L${f(x - dw / 2 - 7 * u)} ${f(b.foot)}Z" fill="url(#${id}-cone)" opacity="${0.75 * glow}"/>`;
  s += `<path d="M${f(lampX)} ${f(t + 7 * u)}v${f(1.2 * u)}" stroke="#2A2622" stroke-width="${f(0.5 * u)}"/>`
    + `<rect x="${f(lampX - 1.3 * u)}" y="${f(t + 7.8 * u)}" width="${f(2.6 * u)}" height="${f(2.6 * u)}" rx="${f(0.5 * u)}" fill="#2A2622" transform="rotate(14 ${f(lampX)} ${f(t + 9 * u)})"/>`
    + `<ellipse cx="${f(lampX + 0.4 * u)}" cy="${f(t + 10.4 * u)}" rx="${f(1.6 * u)}" ry="${f(1 * u)}" fill="url(#${id}-spot)"/>`;
  // the stand
  if (b.mount === 'floor') {
    const w = Math.max(dw + 6 * u, 20 * u);
    const y = GROUND * u;
    s += `<ellipse cx="${f(x)}" cy="${f(y + 0.6 * u)}" rx="${f(w * 0.56)}" ry="${f(1.6 * u)}" fill="url(#${id}-shadow)"/>`;
    s += `<path d="M${f(x - w / 2)} ${f(y - RISER * u)}L${f(x - w / 2 + 2.5 * u)} ${f(y - (RISER + 4.4) * u)}H${f(x + w / 2 - 2.5 * u)}L${f(x + w / 2)} ${f(y - RISER * u)}Z" fill="${mix(c.trim, '#fff', 0.16)}"/>`;
    s += `<rect x="${f(x - w / 2)}" y="${f(y - RISER * u)}" width="${f(w)}" height="${f(RISER * u)}" fill="${mix(c.trim, '#000', 0.25)}"/>`;
    s += `<path d="M${f(x - w / 2 + 2.5 * u)} ${f(y - (RISER + 4.4) * u)}H${f(x + w / 2 - 2.5 * u)}" stroke="#fff" stroke-opacity=".25" stroke-width="${f(0.3 * u)}"/>`;
    s += figure(b.ex.id, x, b.foot, size);
  } else {
    const pw = clamp(dw + 3 * u, 12 * u, 26 * u);
    const top = b.foot;
    const y = GROUND * u;
    s += `<ellipse cx="${f(x)}" cy="${f(y + 0.4 * u)}" rx="${f(pw * 0.75)}" ry="${f(1.5 * u)}" fill="url(#${id}-shadow)"/>`;
    s += `<rect x="${f(x - pw / 2 - 0.5 * u)}" y="${f(y - 1.6 * u)}" width="${f(pw + 1 * u)}" height="${f(1.6 * u)}" fill="#C9C0AE"/>`;
    s += `<rect x="${f(x - pw / 2)}" y="${f(top + 1.4 * u)}" width="${f(pw)}" height="${f(y - top - 3 * u)}" fill="url(#${id}-ped)"/>`;
    s += `<path d="M${f(x - pw / 2 - 0.7 * u)} ${f(top + 1.6 * u)}L${f(x - pw / 2)} ${f(top - 0.9 * u)}H${f(x + pw / 2)}L${f(x + pw / 2 + 0.7 * u)} ${f(top + 1.6 * u)}Z" fill="#FFFDF8"/>`;
    s += `<rect x="${f(x - pw / 2 - 0.7 * u)}" y="${f(top + 1.6 * u)}" width="${f(pw + 1.4 * u)}" height="${f(1.1 * u)}" fill="#E3DACA"/>`;
    // its shadow on the pedestal's top
    s += `<ellipse cx="${f(x)}" cy="${f(top + 0.4 * u)}" rx="${f(Math.min(dw * 0.45, pw * 0.48))}" ry="${f(0.8 * u)}" fill="#000" opacity=".22"/>`;
    if (b.lift) {
      // a clear stand holding it at its angle
      s += `<path d="M${f(x)} ${f(top)}V${f(b.top + dh * 0.62)}" stroke="#DCE6EA" stroke-opacity=".8" stroke-width="${f(0.7 * u)}"/>`
        + `<rect x="${f(x - 2 * u)}" y="${f(top - 0.6 * u)}" width="${f(4 * u)}" height="${f(0.7 * u)}" rx="${f(0.3 * u)}" fill="#DCE6EA" opacity=".8"/>`;
    }
    s += figure(b.ex.id, x, b.foot - b.lift, size, { shadow: false });
    if (b.mount === 'case') {
      const gw = pw - 0.6 * u;
      const gh = Math.max(dh + b.lift + 5 * u, 16 * u);
      const gy = top - gh;
      s += `<rect x="${f(x - gw / 2)}" y="${f(gy)}" width="${f(gw)}" height="${f(gh)}" fill="#CFE6F2" fill-opacity=".1" stroke="#fff" stroke-opacity=".6" stroke-width="${f(0.3 * u)}"/>`
        + `<rect x="${f(x - gw / 2)}" y="${f(gy)}" width="${f(gw)}" height="${f(gh)}" fill="url(#${id}-glass)"/>`
        + `<path d="M${f(x - gw / 2)} ${f(gy)}L${f(x - gw / 2 + 1.6 * u)} ${f(gy - 1.4 * u)}H${f(x + gw / 2 + 1.6 * u)}V${f(top - 1.4 * u)}L${f(x + gw / 2)} ${f(top)}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="${f(0.3 * u)}"/>`
        + `<path d="M${f(x + gw / 2)} ${f(gy)}L${f(x + gw / 2 + 1.6 * u)} ${f(gy - 1.4 * u)}" stroke="#fff" stroke-opacity=".45" stroke-width="${f(0.3 * u)}"/>`
        + `<path d="M${f(x - gw / 2)} ${f(gy)}L${f(x - gw / 2 + 1.6 * u)} ${f(gy - 1.4 * u)}H${f(x + gw / 2 + 1.6 * u)}L${f(x + gw / 2)} ${f(gy)}Z" fill="#fff" fill-opacity=".14"/>`;
    }
  }
  return s;
}

/* ---------- walking through ---------- */

const $ = (id) => document.getElementById(id);
let cur = null;     // { room, L, onResize, ... }

/* Show the room in #gallery. focus: an exhibit to stand in front of; from: 'left' or 'right',
   the door you came in by; stop: the tour stop being shown here (tour.js), with its card. */
export function mount(roomId, { focus = null, from = 'left', stop = null, played = new Set(), stopNo = null } = {}) {
  unmount();
  const walk = $('walk');
  const track = $('track');
  const room = ROOMS.find((r) => r.id === roomId);
  $('gallery').style.setProperty('--hue', room.hue);
  $('gal-name').textContent = room.name;
  minimap(roomId);
  const draw = () => {
    const h = walk.clientHeight;
    const w = walk.clientWidth;
    if (!h || !w) return;
    const keep = cur?.L ? (walk.scrollLeft + w / 2) / cur.L.W : null;
    const L = layout(roomId, w, h);
    cur.L = L;
    track.style.width = `${f(L.W)}px`;
    track.style.setProperty('--u', `${L.u}px`);
    track.innerHTML = scene(L, { stop }) + overlay(L, { stop, stopNo, played });
    if (keep != null) walk.scrollLeft = keep * L.W - w / 2;
  };
  cur = { roomId, L: null, size: '' };
  draw();
  // where to stand
  const L = cur.L;
  if (L) {
    const b = L.bays.find((x) => x.ex.id === focus);
    if (b) walk.scrollLeft = b.x - walk.clientWidth / 2;
    else walk.scrollLeft = from === 'right' ? L.W : 0;
  }
  const ro = new ResizeObserver(() => {
    const size = `${walk.clientWidth}x${walk.clientHeight}`;
    if (size !== cur.size) { cur.size = size; draw(); }
  });
  cur.size = `${walk.clientWidth}x${walk.clientHeight}`;
  ro.observe(walk);
  const onWheel = (e) => {
    // a mouse wheel walks along the wall
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.ctrlKey) {
      walk.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };
  walk.addEventListener('wheel', onWheel, { passive: false });
  const onScroll = () => steppers();
  walk.addEventListener('scroll', onScroll, { passive: true });
  steppers();
  cur.off = () => {
    ro.disconnect();
    walk.removeEventListener('wheel', onWheel);
    walk.removeEventListener('scroll', onScroll);
  };
  return unmount;
}

export function unmount() {
  cur?.off?.();
  cur = null;
  $('track').innerHTML = '';
}

/* The things you can stop in front of, left to right: the doors, the words, each exhibit. */
function stops() {
  return [...$('track').querySelectorAll('.door, .wall-text, .bay')].map((el) => el.offsetLeft + el.offsetWidth / 2);
}

/* Walk to the next thing along (dir 1) or back (dir -1). */
export function step(dir) {
  const walk = $('walk');
  const mid = walk.scrollLeft + walk.clientWidth / 2;
  const xs = stops();
  const to = dir > 0 ? xs.find((x) => x > mid + 8) : xs.reverse().find((x) => x < mid - 8);
  if (to == null) return;
  walk.scrollTo({ left: to - walk.clientWidth / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function steppers() {
  const walk = $('walk');
  const end = walk.scrollWidth - walk.clientWidth;
  $('gal-prev').disabled = walk.scrollLeft <= 2;
  $('gal-next').disabled = walk.scrollLeft >= end - 2;
}

/* The words on the wall, the doors, and each exhibit's link and plaque. */
function overlay(L, { stop, stopNo, played }) {
  const { u, dy } = L;
  const room = ROOMS.find((r) => r.id === L.roomId);
  const n = L.bays.length;
  let s = `<section class="wall-text" style="left:${f(L.introX)}px;top:${f(dy + 15 * u)}px;width:${f(L.intro)}px">`
    + `<h3>${esc(room.name)}</h3><p>${esc(room.intro)}</p><p class="count">${n} instrument${n === 1 ? '' : 's'} in this room</p></section>`;
  for (const [side, to] of [['left', L.prev], ['right', L.next]]) {
    const x = side === 'left' ? 0 : L.W - L.door;
    s += `<a class="door ${side}" href="#room/${to.id}" data-from="${side === 'left' ? 'right' : 'left'}" style="left:${f(x + L.door * 0.16)}px;top:${f(dy + 20 * u)}px;width:${f(L.door * 0.68)}px;height:${f(55 * u)}px" aria-label="Through the door to ${esc(to.name)}">`
      + `<span class="door-sign" style="--to:${to.hue}">${side === 'left' ? '<span aria-hidden="true">‹</span> ' : ''}${esc(to.name)}${side === 'right' ? ' <span aria-hidden="true">›</span>' : ''}</span></a>`;
  }
  for (const b of L.bays) {
    const top = b.top - 3 * u;
    const plaqueY = b.mount === 'floor' ? (GROUND - RISER - 1) * u : b.foot + 5 * u;
    const w = Math.min(b.width - 2 * u, Math.max(b.dw + 6 * u, 130));
    const mine = played.has(b.ex.id);
    const isStop = stop === b.ex.id;
    s += `<a class="bay${isStop ? ' stop' : ''}" href="#${b.ex.id}" style="left:${f(b.x - w / 2)}px;top:${f(dy + top)}px;width:${f(w)}px;height:${f(plaqueY - top + 9 * u)}px" aria-label="${esc(b.ex.name)}, ${esc(sizeText(b.ex.size))}${mine ? ', played' : ''}">`
      + `<span class="plaque" style="top:${f(plaqueY - top)}px">`
      + (isStop && stopNo ? `<span class="stopno" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0 1 16 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="3" y="14" width="5" height="7" rx="2" fill="currentColor"/><rect x="16" y="14" width="5" height="7" rx="2" fill="currentColor"/></svg>${stopNo}</span>` : '')
      + `<b>${esc(b.ex.name)}</b><small>${esc(sizeText(b.ex.size))}</small>`
      + (mine ? '<i class="check" aria-hidden="true">✓</i>' : '')
      + '</span></a>';
  }
  return s;
}

/* The six rooms as a little plan in the header, this one lit: tap one to go there. */
function minimap(roomId) {
  // where each room is, as on the lobby's plan: three columns round the rotunda
  const at = { world: [0, 0, 1, 1], percussion: [0, 1, 1, 1], keyboard: [1, 0, 1, 0.7], strings: [2, 0, 1, 0.8], woodwinds: [2, 0.8, 1, 0.6], brass: [2, 1.4, 1, 0.6] };
  const c = 15;
  let s = `<svg viewBox="-1 -1 ${3 * c + 2} ${2 * c + 2}"><rect x="${c}" y="${0.7 * c}" width="${c}" height="${1.3 * c}" fill="#F6F1E4" opacity=".14"/><circle cx="${1.5 * c}" cy="${1.3 * c}" r="${c * 0.3}" fill="none" stroke="#F6F1E4" stroke-opacity=".4"/>`;
  for (const r of ROOMS) {
    const [x, y, w, h] = at[r.id];
    const here = r.id === roomId;
    s += `<a href="#room/${r.id}" aria-label="${esc(r.name)}"${here ? ' aria-current="page"' : ''}><rect x="${x * c + 0.8}" y="${y * c + 0.8}" width="${w * c - 1.6}" height="${h * c - 1.6}" rx="1.5" fill="${r.hue}" opacity="${here ? 1 : 0.45}" stroke="${here ? '#F6F1E4' : 'none'}" stroke-width="1.4"/></a>`;
  }
  $('gal-map').innerHTML = `${s}</svg>`;
}

/* For the tests: the exhibits on show, in order. */
export const state = () => ({ room: cur?.roomId, bays: cur?.L?.bays.map((b) => b.ex.id) || [] });
