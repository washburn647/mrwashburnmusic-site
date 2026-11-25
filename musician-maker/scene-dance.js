/* Dancing Time. Mookie (rig.js) on a dance floor under a mirror ball. The call: Grammy, a
   gramophone with googly eyes on her horn, sings it, and a note flies to Mookie with every
   sound. The response: every tap is a dance move. He hits a pose (arms on springs that flow
   from one move into the next), stomps, the floor lights up under him and a paw print lands
   in the dance diagram at his feet: gold on time, silver close, red off.
   Judge Hoot (a barn owl behind a desk) bobs along and holds up the scorecards. A crowd
   stands round the floor: cats, or aliens on the Moon, fish on the reef, penguins under the
   northern lights. The place is different every round (THEMES): the disco, the theater, the
   Moon, a coral reef, the Arctic.
   Win (random, never twice running): he dances your pattern back and takes a bow; the
   moonwalk; a headspin; a kick line of Mookies; a tango with a flamingo; a stage dive and a
   crowd surf.
   Miss: he goes to sleep, every time. A yawn and a nightcap; the record runs down and so does
   he; he sleepwalks off the front of the stage; the curtain comes down on him; he dreams
   he can dance.
   The room parties as the combo grows: the mirror ball turns faster and throws more light,
   the crowd waves light sticks, a flamingo struts by, fog, lasers, confetti.
   In melodic runs the diagram has a row for each note, low at the front and high at the back,
   and each print lands on its note's row; a step on the wrong row is red.
   Boss: Saturday Night Fur. Rusty (cats.js) in a white disco suit, in a dance-off. Each hit
   and a piece of his suit flies off; the last one and the mirror ball comes down on him.
   Real photos are CC0 or public domain (props/CREDITS.txt, bg/CREDITS.txt).
   Fixed markup only: nothing a learner types goes in here (call syllables are du/de, or do re mi). */

import { rigMookie } from './rig.js';
import { rigCat } from './cats.js';
import { toon } from './sound.js';
import { gagDeck } from './gags.js';
import { callBubble } from './speech.js';
import { fitSigns } from './signs.js';

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
/* Keyframes for n spins on the spot. The width follows a turning body's (a cosine), so he's
   broad most of the time and edge-on only for a moment. */
const turns = (n) => Array.from({ length: 12 * n + 1 }, (_, k) => ({ scale: `${Math.cos((k / 12) * Math.PI * 2).toFixed(3)} 1` }));
const rnd = (a, b) => a + Math.random() * (b - a);
const INK = '#17171b';
// Reduced motion: the ball turns slowly and its lights stay put.
const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const GAGS = {
  win: { steps: 'Dances it back and takes a bow', moonwalk: 'The moonwalk', spin: 'A headspin', chorus: 'A kick line of Mookies', tango: 'A tango with the flamingo', dive: 'Stage dive and crowd surf' },
  fail: { yawn: 'Yawns, nightcap, asleep', record: 'The record runs down, and so does he', sleepwalk: 'Sleepwalks off the stage', curtain: 'The curtain comes down', dream: 'Dreams he can dance' },
};
const winGag = gagDeck(['steps', 'steps', 'moonwalk', 'spin', 'chorus', 'tango', 'dive'], () => dancingTime.gagsOn?.win);
const failGag = gagDeck(['yawn', 'yawn', 'record', 'sleepwalk', 'curtain', 'dream'], () => dancingTime.gagsOn?.fail);

/* ---------------- drawings ---------------- */

/* The dance floor: glass tiles in one-point perspective (the columns run off both sides and
   meet far behind the crowd). preserveAspectRatio none: it stretches to any stage. */
const ROWS = [0, 28, 66, 118, 190, 300];
const COLS = 14;
const xAt = (c, y) => 500 + (-400 + (c / COLS) * 1800 - 500) * (0.55 + 0.45 * (y / 300));
const f1 = (v) => v.toFixed(1);
const FLOOR = (() => {
  let tiles = '';
  for (let r = 0; r < ROWS.length - 1; r++) {
    for (let c = 0; c < COLS; c++) {
      const [y0, y1] = [ROWS[r], ROWS[r + 1]];
      tiles += `<path class="t" data-r="${r}" data-c="${c}" d="M${f1(xAt(c, y0))} ${y0} L${f1(xAt(c + 1, y0))} ${y0} L${f1(xAt(c + 1, y1))} ${y1} L${f1(xAt(c, y1))} ${y1} Z"/>`;
    }
  }
  let lines = ROWS.slice(1, -1).map((y) => `M0 ${y} H1000`).join(' ');
  for (let c = 0; c <= COLS; c++) lines += ` M${f1(xAt(c, 0))} 0 L${f1(xAt(c, 300))} 300`;
  return `<svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
  <rect class="f-base" width="1000" height="300"/><g class="f-tiles">${tiles}</g>
  <path class="f-lines" d="${lines}" fill="none" vector-effect="non-scaling-stroke"/>
  <rect class="f-gloss" width="1000" height="300"/></svg>`;
})();

/* A cat's paw print, for the dance diagram. */
const PAW = `<svg viewBox="0 0 40 44" aria-hidden="true"><ellipse cx="20" cy="30" rx="11" ry="9.5"/>
  <ellipse cx="7" cy="17" rx="4.6" ry="5.6" transform="rotate(-20 7 17)"/><ellipse cx="15.5" cy="8.5" rx="4.6" ry="5.8" transform="rotate(-6 15.5 8.5)"/>
  <ellipse cx="24.5" cy="8.5" rx="4.6" ry="5.8" transform="rotate(6 24.5 8.5)"/><ellipse cx="33" cy="17" rx="4.6" ry="5.6" transform="rotate(20 33 17)"/></svg>`;

/* The crowd, as silhouettes against the lights (40 x 50 each, standing on y = 50). */
const FANS = {
  cat: `<svg viewBox="0 0 40 50" aria-hidden="true"><g class="fan-b"><path d="M5 50 Q5 33 20 32 Q35 33 35 50 Z"/>
    <path d="M10 22 L9 6 L16.5 13 Q20 11.5 23.5 13 L31 6 L30 22 Q30 31 20 31 Q10 31 10 22 Z"/>
    <g class="eyes"><ellipse cx="15.5" cy="20.5" rx="1.7" ry="2.3"/><ellipse cx="24.5" cy="20.5" rx="1.7" ry="2.3"/></g></g></svg>`,
  alien: `<svg viewBox="0 0 40 50" aria-hidden="true"><g class="fan-b"><path d="M7 50 Q8 36 20 35 Q32 36 33 50 Z"/>
    <path d="M14 11 L9 2 M26 11 L31 2" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="2" r="2.4"/><circle cx="31" cy="2" r="2.4"/>
    <path d="M20 8 C31 8 33 17 32 23 C31 30 25 34 20 34 C15 34 9 30 8 23 C7 17 9 8 20 8 Z"/>
    <g class="eyes"><ellipse cx="15" cy="21" rx="4" ry="2.3" transform="rotate(28 15 21)"/><ellipse cx="25" cy="21" rx="4" ry="2.3" transform="rotate(-28 25 21)"/></g></g></svg>`,
  fish: `<svg viewBox="0 0 40 50" aria-hidden="true"><g class="fan-b"><path d="M8 27 L1 18 L3 27 L1 36 Z"/>
    <path d="M7 27 Q16 12 29 21 Q35 24 38 27 Q35 30 29 33 Q16 42 7 27 Z"/><path d="M17 17 Q22 10 28 14 L26 19 Z"/>
    <g class="eyes"><circle cx="30" cy="25" r="2"/></g></g></svg>`,
  penguin: `<svg viewBox="0 0 40 50" aria-hidden="true"><g class="fan-b"><path d="M20 5 C28 5 31 13 31 23 C33 35 32 47 28 50 L12 50 C8 47 7 35 9 23 C9 13 12 5 20 5 Z"/>
    <path d="M9 24 Q1 32 3 39 Q8 33 10 31 Z M31 24 Q39 32 37 39 Q32 33 30 31 Z"/></g>
    <path class="belly" d="M20 15 C26 15 27 25 27 33 C27 43 24 48.5 20 48.5 C16 48.5 13 43 13 33 C13 25 14 15 20 15 Z"/>
    <path class="beak" d="M18 12.5 L22 12.5 L20 16 Z"/><g class="eyes"><circle cx="17" cy="10" r="1.3"/><circle cx="23" cy="10" r="1.3"/></g></svg>`,
};

/* The judge's desk (120 x 56). */
const DESK = `<svg viewBox="0 0 120 56" aria-hidden="true">
  <path d="M4 10 H116 V56 H4 Z" fill="#6b3a1e" stroke="${INK}" stroke-width="2.5"/>
  <path d="M10 18 H55 V50 H10 Z M65 18 H110 V50 H65 Z" fill="#7d4524" stroke="#4a2410" stroke-width="2"/>
  <rect x="0" y="3" width="120" height="10" rx="3" fill="#9a5a30" stroke="${INK}" stroke-width="2.5"/>
  <path d="M6 7 H114" stroke="#c98a5a" stroke-width="2" stroke-linecap="round" opacity=".7"/>
  <rect x="30" y="23" width="60" height="18" rx="3" fill="#e0bb4a" stroke="#7a5a12" stroke-width="1.8"/>
  <text x="60" y="36.5" font-family="Fredoka, sans-serif" font-weight="700" font-size="11.5" letter-spacing="1.2" text-anchor="middle" fill="#3a2a08" data-fit="52">JUDGE</text>
</svg>`;

/* Things Mookie wears, drawn into his head (his own 200 x 222 drawing), so they move with
   him: a fedora, a nightcap, a rose in his teeth, a yawn as big as his head. */
const HEAD_PROPS = `
  <g class="dt-prop dt-yawnm"><ellipse cx="100" cy="106" rx="12" ry="15" fill="#4a2a30" stroke="#2a1418" stroke-width="1.4"/>
    <ellipse cx="100" cy="114" rx="7.5" ry="5" fill="#e07d90"/><path d="M92 93 L94.5 99 L97 93 Z M103 93 L105.5 99 L108 93 Z" fill="#fff"/></g>
  <g class="dt-prop dt-rose"><path d="M106 101 Q124 104 140 92" stroke="#2f7a3c" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M122 101 Q128 108 134 102 Q128 98 122 101 Z" fill="#3f9a4c"/>
    <g transform="translate(144 88)"><circle r="8.5" fill="#d0213b" stroke="#7a0f1f" stroke-width="1.4"/><path d="M-5 -2 Q0 -8 5 -2 Q0 4 -5 -2 Z M-3 3 Q0 7 4 2" stroke="#7a0f1f" stroke-width="1.3" fill="none"/></g></g>
  <g class="dt-prop dt-fedora"><g transform="rotate(-9 100 44)"><path d="M50 52 Q100 34 150 50 Q158 56 146 59 Q100 46 56 61 Q44 60 50 52 Z" fill="#1f1f27" stroke="#000" stroke-width="1.5"/>
    <path d="M68 52 Q68 22 100 18 Q132 20 134 49 Q100 40 68 52 Z" fill="#2b2b35" stroke="#000" stroke-width="1.5"/>
    <path d="M69 45 Q100 35 133 42 L134 49 Q100 40 68 52 Z" fill="#f2f2f2"/><path d="M88 22 Q100 31 114 22" stroke="#45454f" stroke-width="2.2" fill="none"/></g></g>
  <g class="dt-prop dt-cap"><path d="M60 54 Q62 16 104 14 Q146 16 170 58 Q176 72 168 80 Q160 58 140 50 Q104 38 60 54 Z" fill="#5b7fd6" stroke="#2c3f7a" stroke-width="1.8"/>
    <path d="M84 20 Q92 36 88 48 M114 16 Q120 32 120 44 M142 26 Q148 40 150 54" stroke="#ffd84a" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>
    <circle cx="169" cy="84" r="9" fill="#fff" stroke="#c9ccd4" stroke-width="1.6"/>
    <path d="M56 56 Q100 36 146 50 L144 60 Q100 48 60 64 Z" fill="#fff" stroke="#c9ccd4" stroke-width="1.6"/></g>`;

/* Rusty's white disco suit, drawn into his own drawing (cats.js, 200 x 222) under his arms,
   in pieces that fly off one hit at a time. */
const SUIT = `<g class="dt-suit">
  <g class="pc pc-flares" style="--dx: -40px; --dy: 90px; --r: -60deg">
    <path d="M58 180 L97 180 L100 207 L52 207 Z M103 180 L142 180 L148 207 L100 207 Z" fill="#f7f4ec" stroke="#b9b2a2" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M60 196 L98 196 M102 196 L140 196" stroke="#d9d2c2" stroke-width="2"/></g>
  <g class="pc pc-jl" style="--dx: -170px; --dy: -60px; --r: -260deg">
    <path d="M86 112 L100 160 L96 190 Q72 194 55 186 Q48 150 57 122 Q68 110 86 112 Z" fill="#f7f4ec" stroke="#b9b2a2" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M86 112 L100 158 L88 150 L66 124 L80 122 L74 114 Z" fill="#e9e4d8" stroke="#b9b2a2" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M60 140 Q58 160 62 180" stroke="#ddd6c6" stroke-width="3" fill="none" stroke-linecap="round"/></g>
  <g class="pc pc-jr" style="--dx: 170px; --dy: -70px; --r: 280deg">
    <path d="M114 112 L100 160 L104 190 Q128 194 145 186 Q152 150 143 122 Q132 110 114 112 Z" fill="#f7f4ec" stroke="#b9b2a2" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M114 112 L100 158 L112 150 L134 124 L120 122 L126 114 Z" fill="#e9e4d8" stroke="#b9b2a2" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="104" cy="166" r="2.6" fill="#d9a62c"/></g>
  <g class="pc pc-collar" style="--dx: 60px; --dy: -160px; --r: 200deg">
    <path d="M98 110 L72 134 L84 112 Z M102 110 L128 134 L116 112 Z" fill="#22222a" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M94 114 L80 126 M106 114 L120 126" stroke="#4a4a58" stroke-width="1.5" stroke-linecap="round"/></g>
  <g class="pc pc-med" style="--dx: -80px; --dy: -170px; --r: -380deg">
    <path d="M86 116 Q100 146 114 116" stroke="#e0bb4a" stroke-width="2" fill="none" stroke-dasharray="2.5 1.5"/>
    <circle cx="100" cy="140" r="7.5" fill="#f2c94c" stroke="#a87b16" stroke-width="1.6"/>
    <path d="M100 135 L101.6 138.6 L105.4 138.8 L102.4 141.2 L103.4 145 L100 142.9 L96.6 145 L97.6 141.2 L94.6 138.8 L98.4 138.6 Z" fill="#fff6c4"/></g>
</g>`;
const SUIT_ORDER = ['med', 'collar', 'jl', 'jr', 'flares'];

/* The thought cloud he dreams in. */
/* His tail, curling out from under the curtain. */
const TAIL = `<svg class="dt-tail" viewBox="0 0 50 50" aria-hidden="true"><path d="M14 52 C12 36 10 22 20 14 C28 8 41 10 40 21 C39.5 27 33 28 31 23" fill="none" stroke="#17171b" stroke-width="7.5" stroke-linecap="round"/></svg>`;
const CLOUD = `<svg viewBox="0 0 200 130" aria-hidden="true"><path d="M40 112 C14 112 6 88 22 76 C8 60 22 36 46 42 C50 18 82 10 98 26 C112 6 150 10 156 34
  C182 30 198 56 184 74 C198 90 184 116 160 110 C150 126 120 128 108 116 C94 128 58 126 40 112 Z" fill="#fff" stroke="${INK}" stroke-width="3"/></svg>`;

/* ---------------- photos ---------------- */

/* Real photos, cut out like stickers (props/CREDITS.txt): a gramophone, a barn owl, a
   flamingo, the trophy. The places' pictures are in bg/ (bg/CREDITS.txt). */
const PHOTOS = { gramophone: 'props/gramophone.webp', owl: 'props/owl.webp', flamingo: 'props/flamingo.webp', trophy: 'props/trophy.png' };
const BACKDROPS = ['curtain', 'wood', 'moon', 'earth', 'reef', 'aurora'];
const photoUrl = (name) => new URL(`./${PHOTOS[name]}`, import.meta.url).href;
let preloaded = false;
function preload() {
  if (preloaded) return;
  preloaded = true;
  Object.keys(PHOTOS).forEach((n) => { const i = new Image(); i.src = photoUrl(n); });
  BACKDROPS.forEach((n) => { const i = new Image(); i.src = new URL(`./bg/${n}.jpg`, import.meta.url).href; });
}
function photo(name, cls = '') {
  const i = document.createElement('img');
  i.src = photoUrl(name);
  i.alt = '';
  i.draggable = false;
  i.className = `ms-photo ${cls}`;
  return i;
}
function googly(x, y, size) {
  const g = h('span', 'googly');
  g.style.left = `${x}%`;
  g.style.top = `${y}%`;
  g.style.setProperty('--gs', `${size}%`);
  g.append(h('i'));
  return g;
}
function jiggle(root) {
  root.querySelectorAll('.googly i').forEach((p) => {
    p.style.setProperty('--px', `${Math.round(Math.random() * 90 - 45)}%`);
    p.style.setProperty('--py', `${Math.round(Math.random() * 90 - 45)}%`);
  });
}

/* ---------------- the mirror ball ---------------- */

/* Drawn on a canvas every frame: rows of little square mirrors on a sphere, turning. Each
   catches the light by where it faces; the ones that face the light flash white, a few
   throw back the room's colour. level: 0 (lights out) to 1. */
const LIGHT = [-0.42, 0.62, 0.66];
const HALF = (() => {
  const v = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();
function drawBall(g, S, rot, level, hue) {
  const r = S * 0.47;
  const cx = S / 2;
  const cy = S / 2;
  g.clearRect(0, 0, S, S);
  const base = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  base.addColorStop(0, '#8d93a3');
  base.addColorStop(1, '#16171e');
  g.fillStyle = base;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  const rows = 12;
  const gap = (Math.PI / rows) * 0.1;
  const P = (la, lo) => [cx + r * Math.cos(la) * Math.sin(lo), cy - r * Math.sin(la)];
  for (let i = 0; i < rows; i++) {
    const la0 = -Math.PI / 2 + (i / rows) * Math.PI + gap;
    const la1 = -Math.PI / 2 + ((i + 1) / rows) * Math.PI - gap;
    const lam = (la0 + la1) / 2;
    const n = Math.max(4, Math.round(rows * 2 * Math.cos(lam)));
    const w = (Math.PI * 2) / n;
    for (let j = 0; j < n; j++) {
      const lo0 = j * w + rot + (i % 2) * (w / 2);
      const lom = lo0 + w / 2;
      const nz = Math.cos(lam) * Math.cos(lom);
      if (nz <= 0.04) continue;
      const nx = Math.cos(lam) * Math.sin(lom);
      const ny = Math.sin(lam);
      const d = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const s = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]) ** 36;
      const k = (i * 31 + j * 17) % 9;
      const a = P(la0, lo0 + gap);
      const b = P(la0, lo0 + w - gap);
      const c = P(la1, lo0 + w - gap);
      const e = P(la1, lo0 + gap);
      const L = (14 + d * 50 + k * 2.2) * (0.35 + 0.65 * level);
      if (s > 0.25 && level > 0.15) g.fillStyle = `hsl(${hue} 60% ${Math.min(97, L + s * 70)}%)`;
      else if (k === 0 && level > 0.2) g.fillStyle = `hsl(${(hue + j * 40) % 360} 85% ${L + 12}%)`;
      else g.fillStyle = `hsl(225 10% ${L}%)`;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.lineTo(c[0], c[1]);
      g.lineTo(e[0], e[1]);
      g.closePath();
      g.fill();
    }
  }
  // Round shading, and a glint.
  const rim = g.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = rim;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  if (level > 0.2) {
    const gx = cx - r * 0.42;
    const gy = cy - r * 0.46;
    const len = r * (0.35 + 0.25 * Math.abs(Math.sin(rot * 3))) * level;
    g.strokeStyle = `rgba(255,255,255,${0.9 * level})`;
    g.lineWidth = Math.max(1, S * 0.012);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(gx - len, gy);
    g.lineTo(gx + len, gy);
    g.moveTo(gx, gy - len);
    g.lineTo(gx, gy + len);
    g.stroke();
  }
}

/* The specks of light the ball throws round the room: soft dots, one sprite per colour. */
let SPRITES = null;
function sprites() {
  if (SPRITES) return SPRITES;
  SPRITES = [0, 48, 190, 280, 320, 130].map((hue) => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.22, `hsla(${hue},100%,82%,.95)`);
    gr.addColorStop(1, `hsla(${hue},100%,60%,0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    return c;
  });
  return SPRITES;
}

/* Size a canvas to its box (and the screen's pixels). False when it has no box. */
function fit(cv) {
  const w = cv.clientWidth;
  const hh = cv.clientHeight;
  if (!w || !hh) return false;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(w * dpr);
  const H = Math.round(hh * dpr);
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  return true;
}

/* ---------------- five places ---------------- */

/* One per round in turn (styles in scene-dance.css under [data-theme]; the pictures are in
   bg/). fan: who's in the crowd. hues: the floor's colours. deco adds a place's own pieces
   to the background (bg) and the front of the stage (front). */
const THEMES = [
  { id: 'disco', fan: 'cat', hues: [0, 360], ball: 300,
    deco(bg) {
      const neon = h('div', 'dt-neon');
      neon.append(h('b', '', 'BOOGIE'), h('i'));
      bg.append(h('div', 'dt-wall'), h('div', 'dt-strings'), neon);
    } },
  { id: 'stage', fan: 'cat', hues: [24, 60], ball: 40,
    deco(bg, front) {
      bg.append(h('div', 'dt-drape'));
      const foot = h('div', 'dt-footlights');
      for (let k = 0; k < 11; k++) foot.append(h('i'));
      front.append(h('div', 'dt-valance'), foot);
    } },
  { id: 'moon', fan: 'alien', hues: [170, 290], ball: 200,
    deco(bg) { bg.append(h('div', 'dt-stars'), h('div', 'dt-earth')); } },
  { id: 'reef', fan: 'fish', hues: [150, 215], ball: 180,
    deco(bg, front) {
      bg.append(h('div', 'dt-sea'));
      const bubbles = h('div', 'dt-bubbles');
      for (let k = 0; k < 9; k++) {
        const b = h('i');
        b.style.left = `${rnd(2, 98).toFixed(1)}%`;
        b.style.setProperty('--d', `${rnd(0, 4).toFixed(2)}s`);
        b.style.setProperty('--s', rnd(0.5, 1.3).toFixed(2));
        bubbles.append(b);
      }
      front.append(h('div', 'dt-caustics'), bubbles);
    } },
  { id: 'arctic', fan: 'penguin', hues: [120, 310], ball: 160,
    deco(bg, front) {
      bg.append(h('div', 'dt-sky'));
      const snow = h('div', 'dt-snow');
      for (let k = 0; k < 18; k++) {
        const f = h('i');
        f.style.left = `${rnd(0, 100).toFixed(1)}%`;
        f.style.setProperty('--d', `${rnd(0, 3).toFixed(2)}s`);
        f.style.setProperty('--s', rnd(0.5, 1.2).toFixed(2));
        snow.append(f);
      }
      front.append(snow);
    } },
];
let themeAt = Math.floor(Math.random() * THEMES.length);
const nextTheme = () => THEMES[themeAt++ % THEMES.length];

/* Dance moves: one per tap, in turn. Arm angles are degrees from hanging down (150 is
   straight up; the arm on the viewer's right is negative); sway leans him about his feet;
   footL and footR lift a foot (0 to 1). */
const POSES = [
  { l: 28, r: -148, sway: 8, footL: 0.55, footR: 0 }, // the disco point
  { l: 148, r: -28, sway: -8, footL: 0, footR: 0.55 }, // and the other way
  { l: 138, r: -138, sway: 0, footL: 0, footR: 0 }, // a V
  { l: 86, r: -86, sway: -5, footL: 0.7, footR: 0 }, // wings
  { l: 104, r: -32, sway: 9, footL: 0, footR: 0.45 }, // the swim
  { l: 165, r: -100, sway: -5, footL: 0.35, footR: 0 }, // one up, one out
];
const STAND = { l: 18, r: -18, sway: 0, footL: 0, footR: 0 };

export const dancingTime = {
  id: 'dancing-time',
  name: 'Dancing Time',
  tap: 'triangle',
  pickClass: 'opt-dance',
  slotIcon: (c) => (c === 'ee' ? '👣👣' : '👣'),
  bossName: 'Saturday Night Fur',
  gags: GAGS,
  make(stage, { boss = false } = {}) {
    stage.className = `stage scene-dt${boss ? ' boss' : ''}`;
    const theme = nextTheme();
    stage.dataset.theme = theme.id;
    stage.dataset.tier = '0';
    preload();

    const cam = h('div', 'dt-cam');
    const bg = h('div', 'dt-bg');
    const front = h('div', 'dt-front');
    theme.deco?.(bg, front);
    if (boss) {
      const banner = h('div', 'dt-banner');
      banner.append(h('b', '', 'DANCE-OFF!'));
      bg.append(banner);
    }
    const beams = h('div', 'dt-beams');
    beams.append(h('i', 'b1'), h('i', 'b2'), h('i', 'b3'), h('i', 'b4'));
    /* The crowd at the back of the floor. */
    const crowd = h('div', 'dt-crowd');
    const fans = [];
    const nFans = 13;
    for (let k = 0; k < nFans; k++) {
      const f = h('div', `dt-fan f-${theme.fan}`);
      f.innerHTML = FANS[theme.fan]; // fixed markup
      const x = ((k + 0.5) / nFans) * 100 + rnd(-2.2, 2.2);
      f.style.left = `${x.toFixed(1)}%`;
      f.style.setProperty('--s', rnd(0.8, 1.15).toFixed(2));
      f.style.setProperty('--d', `${rnd(0, 0.14).toFixed(2)}s`);
      f.style.setProperty('--h', `${Math.round(rnd(0, 360))}`);
      if (theme.fan === 'fish' && x > 50) f.classList.add('flip');
      f.append(h('i', 'stick'));
      crowd.append(f);
      fans.push(f);
    }
    const floor = h('div', 'dt-floor');
    floor.innerHTML = FLOOR; // fixed markup
    const tiles = [...floor.querySelectorAll('.t')];
    const under = tiles.filter((t) => Number(t.dataset.r) >= 3 && [6, 7].includes(Number(t.dataset.c)));
    const pool = h('div', 'dt-pool');
    const spot = h('div', 'dt-spot');
    const fog = h('div', 'dt-fog');
    fog.append(h('i'), h('i'));
    /* The mirror ball, on its chain. */
    const ball = h('div', 'dt-ball');
    const ballCv = h('canvas');
    ball.append(h('i', 'dt-chain'), ballCv);
    /* Grammy: a gramophone (a photo) whose horn is her face: googly eyes, and her mouth is
       the horn's throat. The horn and the box are the top and bottom of the same photo, so
       the horn can sing, and droop. */
    const gram = h('div', 'dt-gram');
    const horn = h('div', 'g-horn');
    const gMouth = h('i', 'g-mouth');
    horn.append(photo('gramophone', 'g-hornpic'), gMouth, googly(29, 18.5, 15), googly(61, 15.5, 15));
    const rec = h('i', 'g-rec');
    rec.append(h('i'));
    gram.append(photo('gramophone', 'g-box'), rec, horn, h('b', 'g-plate', 'GRAMMY'));
    /* Judge Hoot: a barn owl behind a desk, with eyelids for when it gets boring. */
    const judge = h('div', 'dt-judge');
    const owl = h('div', 'j-owl');
    owl.append(photo('owl'), googly(33.4, 41.5, 13), googly(65.5, 43.5, 13));
    owl.querySelectorAll('.googly').forEach((g) => g.append(h('b', 'lid')));
    const desk = h('div', 'j-desk');
    desk.innerHTML = DESK; // fixed markup
    fitSigns(desk);
    judge.append(owl, desk);
    /* A flamingo, who struts by when the band is going, and tangos. */
    const flamingo = h('div', 'dt-flamingo');
    const fIn = h('div', 'f-in');
    fIn.append(photo('flamingo'), googly(8.3, 8.2, 5));
    flamingo.append(fIn);
    /* Mookie, and in the boss, Rusty in his suit. */
    const cat = rigMookie();
    cat.el.classList.add('dt-mookie');
    cat.svg.querySelector('.r-head').insertAdjacentHTML('beforeend', HEAD_PROPS); // fixed markup
    const rusty = boss ? rigCat('rusty') : null;
    if (rusty) {
      rusty.el.classList.add('dt-rusty');
      rusty.el.querySelector('.k-arm-l').insertAdjacentHTML('beforebegin', SUIT); // fixed markup
      rusty.set('shades');
    }
    /* The dance diagram at his feet: counts 1 to 4, and paw prints for the steps. */
    const steps = h('div', 'dt-steps');
    for (let k = 0; k < 4; k++) {
      const n = h('b', 'dt-count', String(k + 1));
      n.style.left = `${((k + 0.25) / 4) * 100}%`;
      steps.append(n);
    }
    const night = h('div', 'dt-night');
    const specks = h('canvas', 'dt-specks');
    const lasers = h('div', 'dt-lasers');
    for (let k = 0; k < 4; k++) lasers.append(h('i'));
    const lights = h('div', 'ms-lights dt-lights');
    lights.append(h('i', 'l'), h('i', 'r'));
    const fx = h('div', 'ms-fx dt-fx');
    const speed = h('div', 'ms-speed');
    cam.append(bg, beams, crowd, floor, pool, spot, fog, flamingo, ball, gram, judge, night);
    if (rusty) cam.append(rusty.el);
    cam.append(cat.el, steps, front, specks, lasers, lights);
    stage.append(cam, speed, fx);

    let busy = false;
    let spb = 60 / 108;
    let beatN = 0;
    let tier = 0;
    let callT0 = null; // when the call's first note sounded (ms)
    let tapT0 = null; // with no call to go by: the first tap
    let callBeats = [];
    let taps = []; // { b, cls } this turn
    let prints = []; // { el, b, call, done }
    let moveK = Math.floor(Math.random() * POSES.length);
    let side = 1;
    let restT = 0;
    let noteK = 0;
    let tonal = false; // a melodic run: each print sits on the floor row of its note
    let strutted = false;
    let hits = 0;
    let suitAt = 0;
    let party = false; // a win: the floor and the ball keep going, flat out
    const disco = { rot: Math.random() * 6, speed: 0.3, level: 0.45, tSpeed: 0.3, tLevel: 0.45, hue: theme.ball };
    const SPECKS = Array.from({ length: 70 }, () => ({ az: rnd(0, Math.PI * 2), y: rnd(0.04, 1), s: Math.random(), c: Math.floor(rnd(0, 6)), tw: rnd(0, 6) }));
    let giant = null; // the KO's giant mirror ball: { cv, at }

    const beatMs = () => Math.min(0.68, Math.max(0.42, spb)) * 1000;
    const at = (beats, fn) => later(beats * beatMs(), fn);
    const box = () => stage.getBoundingClientRect();
    const centre = (el, fx0 = 0.5, fy = 0.5) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width * fx0, y: r.top + r.height * fy };
    };
    const local = (p) => {
      const b = box();
      return { x: p.x - b.left, y: p.y - b.top };
    };
    /* A point on a rigged cat (its own 200 x 222 drawing), on the page. Mookie: 100 41 the
       top of his head, 100 100 his mouth, 100 160 his belly, 80 200 and 120 200 his feet. */
    const rigPt = (c, x, y) => {
      const svg = c.el.querySelector('svg');
      const m = svg.getScreenCTM();
      if (!m) return centre(c.el);
      const p = new DOMPoint(x, y).matrixTransform(m);
      return { x: p.x, y: p.y };
    };
    const clampX = (x, pad = 0.14) => {
      const w = box().width;
      return Math.max(w * pad, Math.min(w * (1 - pad), x));
    };
    function comic(text, at0, cls = '') {
      const p = local(at0);
      const c = h('b', `ms-comic ${cls}`, text);
      c.style.left = `${clampX(p.x, cls.includes('big') ? 0.3 : 0.16)}px`;
      c.style.top = `${Math.max(30, p.y)}px`;
      c.style.setProperty('--rot', `${(Math.random() * 16 - 8).toFixed(1)}deg`);
      fx.append(c);
      later(900, () => c.remove());
      return c;
    }
    function dust(at0, n = 6, cls = '') {
      const p = local(at0);
      for (let i = 0; i < n; i++) {
        const d = h('i', `ms-dust ${cls}`);
        d.style.left = `${p.x}px`;
        d.style.top = `${p.y}px`;
        d.style.setProperty('--dx', `${(Math.random() * 2 - 1) * 46}px`);
        d.style.setProperty('--dy', `${-Math.random() * 30}px`);
        d.style.setProperty('--s', (0.6 + Math.random() * 0.8).toFixed(2));
        fx.append(d);
        later(600, () => d.remove());
      }
    }
    function bubble(text, at0) {
      const p = local(at0);
      const b = h('div', 'ms-bubble', text);
      b.style.left = `${clampX(p.x)}px`;
      b.style.top = `${Math.max(34, p.y)}px`;
      fx.append(b);
      later(700, () => b.remove());
    }
    function punch(at0, scale = 1.12, ms = 520) {
      const p = local(at0);
      cam.style.transformOrigin = `${p.x}px ${p.y}px`;
      cam.animate([
        { transform: 'scale(1)' }, { transform: `scale(${scale}) rotate(-1.5deg)`, offset: 0.18 },
        { transform: `scale(${scale * 1.02}) rotate(-1.5deg)`, offset: 0.6 }, { transform: 'scale(1)' },
      ], { duration: ms, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
    function flashSpeed(cls = '') {
      speed.className = `ms-speed ${cls}`;
      bump(speed, 'go');
    }
    /* Fly something along an arc, from one point to another (stage px). */
    function fling(el, from, to, ms = 380, lift = 70, spin = 0) {
      fx.append(el);
      const w = el.getBoundingClientRect().width || 20;
      const hgt = el.getBoundingClientRect().height || 20;
      el.style.left = `${to.x - w / 2}px`;
      el.style.top = `${to.y - hgt / 2}px`;
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      return el.animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(0) scale(.5)`, opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) rotate(${spin * 0.55}deg) scale(1.1)`, offset: 0.55, opacity: 1 },
        { transform: `translate(0, 0) rotate(${spin}deg) scale(.8)`, opacity: 0 },
      ], { duration: ms, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'both' });
    }
    /* Sparkles: little four-point stars bursting from a point. */
    function sparkle(at0, n = 6, cls = '') {
      const p = local(at0);
      for (let i = 0; i < n; i++) {
        const s = h('i', `dt-spark ${cls}`);
        const a = (i / n) * Math.PI * 2 + Math.random();
        const d = rnd(24, 60);
        s.style.left = `${p.x}px`;
        s.style.top = `${p.y}px`;
        s.style.setProperty('--dx', `${(Math.cos(a) * d).toFixed(0)}px`);
        s.style.setProperty('--dy', `${(Math.sin(a) * d).toFixed(0)}px`);
        s.style.setProperty('--s', rnd(0.6, 1.3).toFixed(2));
        fx.append(s);
        later(650, () => s.remove());
      }
    }
    /* Confetti from the top, n pieces. */
    function confetti(n = 30) {
      const w = box().width;
      for (let i = 0; i < n; i++) {
        const c = h('i', 'dt-confetti');
        c.style.left = `${(Math.random() * w).toFixed(0)}px`;
        c.style.setProperty('--h', Math.round(rnd(0, 360)));
        c.style.setProperty('--dx', `${rnd(-60, 60).toFixed(0)}px`);
        c.style.setProperty('--r', `${rnd(-720, 720).toFixed(0)}deg`);
        c.style.setProperty('--t', `${rnd(1.1, 1.9).toFixed(2)}s`);
        c.style.animationDelay = `${rnd(0, 0.35).toFixed(2)}s`;
        fx.append(c);
        later(2400, () => c.remove());
      }
    }
    /* Z's floating up from a sleeper. */
    function zzz(at0, n = 3) {
      const p = local(at0);
      for (let i = 0; i < n; i++) {
        later(i * beatMs() * 0.45, () => {
          const z = h('b', 'dt-z', 'z');
          z.style.left = `${p.x}px`;
          z.style.top = `${p.y}px`;
          z.style.setProperty('--dx', `${rnd(10, 40).toFixed(0)}px`);
          fx.append(z);
          later(1500, () => z.remove());
        });
      }
    }

    /* ---- the room ---- */

    const hueAt = (c, r) => {
      const [a, b] = theme.hues;
      return Math.round(a + (((c * 23 + r * 41 + beatN * 37) % 100) / 100) * (b - a));
    };
    /* The floor lights up in a pattern on every beat; a new pattern every two bars. */
    function lightFloor(level = tier) {
      const n = beatN;
      const pat = Math.floor(n / 8) % 5;
      const step = n % 8;
      floor.style.setProperty('--lit', [0.3, 0.45, 0.62, 0.8, 0.9][level]);
      tiles.forEach((t, k) => {
        const r = Number(t.dataset.r);
        const c = Number(t.dataset.c);
        let on;
        if (pat === 0) on = (c + step) % 4 === 0;
        else if (pat === 1) on = (r + c + step) % 2 === 0;
        else if (pat === 2) on = r === step % 5;
        else if (pat === 3) on = Math.round(Math.abs(c - 6.5) + r * 0.6) % 4 === step % 4;
        else on = Math.random() < 0.3;
        if (on && (level > 0 || (k + n) % 2 === 0)) {
          t.style.setProperty('--tc', `hsl(${hueAt(c, r)} 95% 62%)`);
          t.classList.add('lit');
        } else t.classList.remove('lit');
      });
    }
    /* The tiles under him flash with a step: gold, silver, red. */
    function flashTiles(cls) {
      const col = { on: 'hsl(48 100% 62%)', close: 'hsl(205 40% 82%)', off: 'hsl(0 90% 55%)' }[cls] || 'hsl(320 100% 80%)';
      under.forEach((t) => {
        t.style.setProperty('--hc', col);
        bump(t, 'hit');
      });
      clearTimeout(flashTiles.t);
      flashTiles.t = later(260, () => under.forEach((t) => t.classList.remove('hit')));
    }
    /* How the ball turns and shines: by the combo, or as told. */
    function ballBy(t) {
      disco.tSpeed = still ? 0.06 : [0.28, 0.42, 0.6, 0.8, 1.05][t];
      disco.tLevel = [0.45, 0.6, 0.75, 0.9, 1][t];
    }
    function lightsOut() {
      disco.tSpeed = 0;
      disco.tLevel = 0.08;
      night.classList.add('on');
      floor.classList.add('off');
      stage.classList.add('dt-out');
    }
    let raf = 0;
    let lastT = performance.now();
    let lastDraw = 0;
    let away = 0;
    function loop(now) {
      if (!cam.isConnected) {
        if (++away > 120) { raf = 0; return; }
      } else away = 0;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      disco.speed += (disco.tSpeed - disco.speed) * Math.min(1, dt * 2.2);
      disco.level += (disco.tLevel - disco.level) * Math.min(1, dt * 2.6);
      disco.rot += disco.speed * dt;
      if (cam.isConnected && now - lastDraw > 30) {
        lastDraw = now;
        if (fit(ballCv)) drawBall(ballCv.getContext('2d'), ballCv.width, disco.rot, disco.level, disco.hue);
        if (giant && fit(giant.cv)) drawBall(giant.cv.getContext('2d'), giant.cv.width, disco.rot * 1.6, Math.max(0.6, disco.level), disco.hue);
        drawSpecks(now / 1000);
      }
      raf = requestAnimationFrame(loop);
    }
    function drawSpecks(t) {
      if (!fit(specks)) return;
      const g = specks.getContext('2d');
      const W = specks.width;
      const H = specks.height;
      g.clearRect(0, 0, W, H);
      if (disco.level < 0.05) return;
      const sp = sprites();
      g.globalCompositeOperation = 'lighter';
      const base = Math.min(W, H) * 0.02;
      for (const s of SPECKS) {
        const a = s.az + disco.rot;
        const c = Math.cos(a);
        if (c < 0.08) continue;
        const x = W / 2 + Math.sin(a) * W * 0.62;
        const y = H * s.y;
        const size = base * (0.55 + s.s) * (0.5 + 0.5 * c);
        const tw = still ? 1 : 0.65 + 0.35 * Math.sin(t * 4 + s.tw);
        g.globalAlpha = Math.min(1, disco.level * (0.2 + 0.7 * c) * tw);
        const w = size * (1.7 - 0.7 * c);
        g.drawImage(sp[s.c], x - w / 2, y - size / 2, w, size);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    raf = requestAnimationFrame(loop);

    /* ---- the dance diagram ---- */

    const spbMs = () => spb * 1000;
    const xOf = (b) => ((Math.max(-0.2, Math.min(3.95, b)) + 0.25) / 4) * 100;
    function addPrint(b, cls, foot) {
      const el = h('i', `dt-print ${cls} ${foot}`);
      el.innerHTML = PAW; // fixed markup
      el.style.left = `${xOf(b).toFixed(2)}%`;
      steps.append(el);
      const p = { el, b, call: cls === 'call', done: false };
      prints.push(p);
      return p;
    }
    function clearPrints() {
      prints.splice(0).forEach((p) => {
        p.el.classList.add('gone');
        later(400, () => p.el.remove());
      });
    }
    /* Where a step lands in the diagram (in beats of the turn), or null outside it. */
    function stepBeat(cls) {
      const now = performance.now();
      if (!cls) return noteK++ % 4; // Note It: one step per note picked, in order
      if (callT0 != null && now - callT0 < 10 * spbMs()) return (now - callT0) / spbMs() - 4;
      if (cls === 'idle') return null;
      if (tapT0 == null || now - tapT0 > 5 * spbMs()) {
        tapT0 = now;
        clearPrints();
      }
      return (now - tapT0) / spbMs();
    }
    function stepPrint(cls, up = null) {
      const b = stepBeat(cls);
      if (b == null || b < -0.6 || b > 4.4) return null;
      let kind = cls || 'tap';
      taps.push({ b, cls: kind });
      // On (or close to) one of the call's steps: fill it in.
      let near = null;
      prints.forEach((p) => {
        if (p.call && !p.done && Math.abs(p.b - b) < 0.3 && (!near || Math.abs(p.b - b) < Math.abs(near.b - b))) near = p;
      });
      // A melodic run: a note played on another row is a step in the wrong place.
      if (near && up != null && near.up != null && Math.abs(near.up - up) > 0.01) {
        kind = 'off';
        near = null;
      }
      if (!near && up == null && tonal) up = prints.filter((p) => p.call)[taps.length - 1]?.up ?? 0.5;
      if (near && kind !== 'off') {
        near.done = true;
        near.el.classList.remove('call');
        near.el.classList.add(kind);
        bump(near.el, 'land');
        return near;
      }
      const p = addPrint(b, kind, prints.length % 2 ? 'r' : 'l');
      if (up != null) { p.up = up; p.el.style.setProperty('--up', up.toFixed(3)); }
      bump(p.el, 'land');
      return p;
    }

    /* ---- Grammy ---- */

    function grammySing(i, syl) {
      bump(horn, 'sing');
      gram.classList.add('open');
      later(140, () => gram.classList.remove('open'));
      jiggle(gram);
      const m = centre(gMouth);
      if (syl) {
        const p = local(centre(horn, 0.5, 0.02));
        callBubble(fx, i, syl, p.x, Math.max(34, p.y));
      }
      const ring = h('i', 'dt-ring');
      const lp = local(m);
      ring.style.left = `${lp.x}px`;
      ring.style.top = `${lp.y}px`;
      fx.append(ring);
      later(600, () => ring.remove());
      const note = h('b', `dt-note n${i % 4}`, i % 3 === 2 ? '♫' : '♪');
      fling(note, lp, local(rigPt(boss ? rusty : cat, 100, 30)), beatMs() * 0.9, 50, 20);
      later(beatMs() * 0.95, () => note.remove());
    }

    /* ---- Judge Hoot ---- */

    function hoot() {
      bump(owl, 'hoot');
      jiggle(owl);
      toon('hoot', undefined, { vol: 0.7 });
    }
    /* A scorecard, held up over the desk. */
    function score(text, cls = '') {
      if (!judge.offsetWidth) return;
      const c = h('b', `dt-card ${cls}`, text);
      judge.append(c);
      hoot();
      at(2.2, () => c.classList.add('down'));
      at(2.8, () => c.remove());
    }

    /* ---- Mookie dances ---- */

    function pawAt(pose, which) {
      const [sx, a] = which < 0 ? [77, pose.l] : [123, pose.r];
      const rad = (a * Math.PI) / 180;
      return rigPt(cat, sx - Math.sin(rad) * 54, 130 + Math.cos(rad) * 54);
    }
    /* One move: a pose, a stomp, the floor flashes under him. cls: on, close, off, tap. */
    function move(cls = 'tap', who = cat) {
      side = -side;
      if (cls === 'off') {
        who.mood('shock');
        who.pose({ l: 64, r: -128, sway: side * 14, footL: side < 0 ? 0.8 : 0, footR: side > 0 ? 0.8 : 0 });
        who.stomp(side, 0.5);
        toon('squeak', undefined, { vol: 0.4, rate: 0.8 });
      } else {
        if (who.moodName !== 'dance') who.mood('dance');
        const p = POSES[moveK++ % POSES.length];
        const k = cls === 'close' ? 0.72 : 1;
        who.pose({ l: 14 + (p.l - 14) * k, r: -14 + (p.r + 14) * k, sway: p.sway * k, footL: p.footL * k, footR: p.footR * k });
        who.stomp(side, k);
        toon('tapshoe', undefined, { vol: 0.35, rate: 0.9 + Math.random() * 0.25 });
        if (who === cat) {
          const hand = p.l > -p.r ? -1 : 1;
          sparkle(pawAt(p, hand), cls === 'on' ? 6 : 3, cls === 'on' ? 'gold' : '');
        }
      }
      if (who === cat) {
        flashTiles(cls);
        bump(pool, 'hit');
      }
      clearTimeout(who.restT);
      who.restT = later(beatMs() * 0.85, () => {
        if (busy) return;
        who.pose(STAND);
        if (who.moodName === 'shock') who.mood('dance');
      });
    }

    // Starting poses.
    ballBy(0);
    cat.mood('idle');
    cat.look(boss ? 0.6 : -0.6, -0.2);
    if (boss) {
      rusty.mood('smug');
      rusty.look(-0.7, 0);
    }

    return {
      onCall(i, syl, tone) {
        if (busy) return;
        const now = performance.now();
        if (tone && !tonal) { tonal = true; steps.classList.add('tonal'); }
        if (i === 0 || callT0 == null) {
          callT0 = now;
          tapT0 = null;
          callBeats = [];
          taps = [];
          noteK = 0;
          clearPrints();
        }
        const b = Math.round(((now - callT0) / spbMs()) * 2) / 2;
        callBeats.push(b);
        const p = addPrint(b, 'call', i % 2 ? 'r' : 'l');
        if (tone) { p.up = tone.up; p.el.style.setProperty('--up', tone.up.toFixed(3)); }
        bump(p.el, 'land');
        if (boss) {
          // Rusty sings it, and points at the sky.
          rusty.say(180, 'yowl');
          rusty.step(0.7);
          const head = rigPt(rusty, 100, 40);
          rusty.reach(head.x + (i % 2 ? -1 : 1) * box().width * 0.06, head.y - box().height * 0.25, 0.16);
          if (syl) {
            const q = local(rigPt(rusty, 100, 20));
            callBubble(fx, i, syl, q.x, Math.max(34, q.y));
          } else bubble('ow!', rigPt(rusty, 100, 20));
          cat.look(0.8, -0.2);
          return;
        }
        grammySing(i, syl);
        // Mookie listens, and can't help a little foot tap.
        cat.look(-0.8, -0.15);
        cat.stomp(i % 2 ? 1 : -1, 0.3);
      },
      onTap(fb) {
        if (busy) return;
        const cls = fb?.cls;
        if (cls === 'idle') {
          cat.stomp((side = -side), 0.4);
          return;
        }
        stepPrint(cls, fb?.up ?? null);
        move(cls || 'tap');
        cat.look(0, -0.3);
      },
      onBeat(down, spb0, t = 0) {
        if (spb0) spb = spb0;
        beatN++;
        tier = Math.max(0, Math.min(4, t));
        const show = party ? 4 : tier;
        stage.dataset.tier = show;
        stage.dataset.beat = down ? 'a' : 'b';
        if (!busy) {
          ballBy(tier);
          cat.beat(down, spb, tier);
          rusty?.beat(down, spb, tier);
        }
        if (!busy || party) lightFloor(show);
        lights.className = show >= 3 && (!busy || party) ? `ms-lights dt-lights on ${down ? 'a' : 'b'}` : 'ms-lights dt-lights';
        if (tier >= 2 && !strutted && !busy && !boss) strut();
        if (tier >= 4 && !busy && down) confetti(6);
        jiggle(stage);
      },
      /* Boss rounds: a hit is the better move, and a piece of Rusty's suit flies off; a miss
         is Rusty's move, and Mookie nods off for a beat. */
      hit() {
        hits++;
        const mid = rigPt(rusty, 100, 120);
        spin(cat, 0.8);
        cat.mood('star');
        cat.pose({ l: 150, r: -150 });
        at(0.4, () => {
          suitOff(1);
          rusty.mood('shock');
          rusty.hop(0.6);
          toon('punch', undefined, { vol: 0.8 });
          comic(['FUNKY!', 'GROOVY!', 'FAR OUT!', 'BOOGIE!'][(hits - 1) % 4], { x: mid.x, y: mid.y - 60 }, 'hit');
          punch(rigPt(cat, 100, 100), 1.06, 380);
          crowdCheer();
          score(String(Math.min(10, 7 + hits)));
        });
        at(2.2, () => {
          rusty.mood('smug');
          cat.mood('idle');
          cat.pose(STAND);
        });
      },
      miss() {
        // Rusty's move: a spin and the point. Mookie nods off.
        spin(rusty, 0.7);
        const head = rigPt(rusty, 100, 40);
        at(0.5, () => {
          rusty.mood('smug');
          rusty.reach(head.x + box().width * 0.05, head.y - box().height * 0.3, 0.5);
          comic('DISCO!', { x: head.x, y: head.y - 30 }, 'bad');
          crowdCheer();
        });
        at(0.7, () => {
          cat.mood('yawn');
          cat.svg.classList.add('dt-yawning');
          toon('yawn', undefined, { vol: 0.6, rate: 1.2 });
        });
        at(1.9, () => {
          cat.svg.classList.remove('dt-yawning');
          cat.mood('idle');
          cat.pose(STAND);
        });
      },
      win(force) {
        busy = true;
        party = true;
        clearTimeout(cat.restT);
        if (boss) return bossKO();
        const gag = winGag(force);
        if (gag === 'moonwalk') return winMoonwalk();
        if (gag === 'spin') return winSpin();
        if (gag === 'chorus') return winChorus();
        if (gag === 'tango') return winTango();
        if (gag === 'dive') return winDive();
        return winSteps();
      },
      fail(force) {
        busy = true;
        clearTimeout(cat.restT);
        if (boss) return bossLose();
        const gag = failGag(force);
        if (gag === 'record') return failRecord();
        if (gag === 'sleepwalk') return failSleepwalk();
        if (gag === 'curtain') return failCurtain();
        if (gag === 'dream') return failDream();
        return failYawn();
      },
    };

    /* ---------------- the room's party ---------------- */

    /* The flamingo struts by at the back, once, when the band gets going. */
    function strut() {
      strutted = true;
      flamingo.classList.add('strut');
      flamingo.style.setProperty('--t', `${(beatMs() * 8) / 1000}s`);
      flamingo.style.setProperty('--b', `${beatMs() / 1000}s`);
    }
    /* A spin about his own middle (as seen from the front: a flip, and back). */
    function spin(who, beats = 1) {
      who.el.animate(turns(2), { duration: beats * beatMs(), easing: 'ease-in-out' });
      toon('swish', undefined, { vol: 0.6 });
    }
    /* The crowd jumps for a couple of beats. */
    function crowdCheer() {
      bump(crowd, 'cheer');
      clearTimeout(crowdCheer.t);
      crowdCheer.t = at(2, () => crowd.classList.remove('cheer'));
    }
    function cheer(big = true) {
      crowd.classList.remove('droop', 'sleep');
      crowdCheer();
      toon('cheer', undefined, { vol: big ? 0.9 : 0.6 });
      toon('applause', undefined, { vol: big ? 1 : 0.7 });
      ballBy(4);
      floor.style.setProperty('--lit', 1);
    }

    /* ---------------- wins ---------------- */

    /* He dances the learner's pattern back, twice as fast, the prints light up step by
       step, then a TA-DA. */
    function winSteps() {
      let beats = taps.filter((x) => x.cls !== 'off').map((x) => x.b);
      if (beats.length < 2) beats = callBeats.length ? callBeats : [0, 1, 2, 3];
      beats = beats.filter((b) => b >= -0.3 && b <= 4).slice(0, 8);
      const done = prints.filter((p) => !p.call || p.done).sort((a, b) => a.b - b.b);
      cat.mood('dance');
      beats.forEach((b, k) => at(Math.max(0, b) / 2, () => {
        move('on');
        const p = done[k];
        if (p) bump(p.el, 'shine');
      }));
      at(2.1, () => {
        const top = rigPt(cat, 100, 10);
        cat.mood('star');
        cat.pose({ l: 150, r: -150, sway: 0, footL: 0, footR: 0 });
        cat.hop(0.8);
        flashSpeed('gold');
        comic('TA-DA!', top, 'big');
        confetti(40);
        cheer();
        toon('fanfare', undefined, { vol: 0.7 });
      });
      at(2.5, () => score('10'));
      at(3, () => cat.pose({ l: 40, r: -150, sway: 6 }));
    }
    /* A fedora, and the moonwalk: gliding back while he walks forward. */
    function winMoonwalk() {
      cat.svg.classList.add('dt-fedora');
      toon('pop', undefined, { vol: 0.9 });
      bump(cat.svg.querySelector('.dt-fedora'), 'on');
      cat.mood('smug');
      cat.pose({ l: 40, r: -60, sway: 4, footL: 0, footR: 0 });
      fog.classList.add('on');
      // About 24u: far enough to read as a glide, short of Grammy.
      const go = -24 * Math.min(box().height / 100, box().width * 0.009);
      at(0.3, () => {
        toon('swish', undefined, { vol: 0.7, rate: 0.7 });
        cat.el.animate([{ translate: '0 0' }, { translate: `${go}px 0` }], { duration: beatMs() * 2, easing: 'cubic-bezier(.3,0,.6,1)', fill: 'forwards' });
      });
      for (let k = 0; k < 8; k++) {
        at(0.3 + k * 0.25, () => {
          const up = k % 2 ? 'footR' : 'footL';
          const down = k % 2 ? 'footL' : 'footR';
          cat.pose({ [up]: 0.6, [down]: 0, l: 40 + (k % 2) * 16, r: -60 - (k % 2) * 16 });
          if (k % 2 === 0) dust(rigPt(cat, 100, 205), 2);
        });
      }
      at(2.4, () => {
        spin(cat, 0.45);
        toon('whistle-up', undefined, { vol: 0.6 });
      });
      at(2.85, () => {
        const top = rigPt(cat, 100, 10);
        cat.pose({ l: 160, r: -30, sway: -4, footL: 0, footR: 0.2 });
        cat.hop(0.4);
        comic('SMOOTH.', top, 'big');
        cheer(false);
      });
      at(3.1, () => score('10'));
    }
    /* Upside down on his head, spinning, sparks flying; then up, and a pose. */
    function winSpin() {
      cat.el.classList.add('dt-glow'); // upside down, his legs are up against the night
      cat.mood('star');
      cat.pose({ l: 90, r: -90, sway: 0, footL: 0.3, footR: 0.3 });
      cat.el.animate([{ translate: '0 0', rotate: '0deg' }, { translate: '0 -30%', rotate: '90deg', offset: 0.5 }, { translate: '0 11%', rotate: '180deg' }],
        { duration: beatMs() * 0.6, easing: 'ease-in-out', fill: 'forwards' });
      toon('whistle-up', undefined, { vol: 0.6 });
      at(0.6, () => {
        toon('zip', undefined, { vol: 0.8 });
        cat.el.animate(turns(1), { duration: beatMs() * 0.36, iterations: 5 });
        bump(owl, 'spin');
        flashSpeed();
      });
      for (let k = 0; k < 7; k++) at(0.65 + k * 0.25, () => sparkle(rigPt(cat, 100, 40), 5, 'gold'));
      at(2.55, () => {
        cat.el.animate([{ translate: '0 11%', rotate: '180deg' }, { translate: '0 -34%', rotate: '270deg', offset: 0.5 }, { translate: '0 0', rotate: '360deg' }],
          { duration: beatMs() * 0.6, easing: 'ease-in-out', fill: 'forwards' });
      });
      at(3.1, () => {
        cat.el.classList.remove('dt-glow');
        cat.pose({ l: 150, r: -150 });
        cat.hop(0.6);
        comic('WHOA!', rigPt(cat, 100, 10), 'big');
        cheer();
        confetti(24);
      });
      at(3.3, () => score('10'));
    }
    /* Four more Mookies pop up, and it's a kick line. */
    function winChorus() {
      const line = h('div', 'dt-line');
      const clones = [-2, -1, 1, 2].map((k) => {
        const m = rigMookie();
        m.el.classList.add('dt-clone');
        m.el.style.setProperty('--k', k);
        m.mood('dance');
        line.append(m.el);
        return m;
      });
      cam.insertBefore(line, cat.el);
      cat.mood('dance');
      clones.forEach((m, i) => later(i * 70, () => { bump(m.el, 'pop'); toon('pop', undefined, { vol: 0.5, rate: 0.8 + i * 0.15 }); }));
      const all = [clones[0], clones[1], cat, clones[2], clones[3]];
      for (let k = 0; k < 5; k++) {
        all.forEach((m, i) => at(0.5 + k * 0.5 + i * 0.07, () => {
          const s = k % 2 ? 1 : -1;
          m.pose({ l: 80, r: -80, sway: -s * 6, footL: s < 0 ? 1 : 0, footR: s > 0 ? 1 : 0 });
          if (i === 2) toon('tapshoe', undefined, { vol: 0.5 });
        }));
      }
      at(3, () => {
        all.forEach((m) => { m.mood('star'); m.pose({ l: 150, r: -150, sway: 0, footL: 0, footR: 0 }); m.hop(0.5); });
        comic('KICK LINE!', rigPt(cat, 100, 0), 'big');
        cheer();
        confetti(20);
      });
      at(3.2, () => score('10'));
    }
    /* The flamingo comes in, a rose in his teeth, a tango, and the dip. */
    function winTango() {
      cat.svg.classList.add('dt-rose');
      cat.mood('smug');
      toon('wah', undefined, { vol: 0.7 });
      flamingo.className = 'dt-flamingo tango';
      flamingo.style.setProperty('--b', `${beatMs() / 1000}s`);
      at(0.9, () => {
        toon('honk', undefined, { vol: 0.8 });
        bubble('honk', centre(flamingo, 0.15, 0.05));
        cat.pose({ l: 120, r: -40, sway: -10, footL: 0, footR: 0.5 });
      });
      at(1.4, () => {
        const go = -box().width * 0.06;
        [cat.el, flamingo].forEach((el) => el.animate([{ translate: '0 0' }, { translate: `${go}px 0` }], { duration: beatMs() * 0.6, easing: 'ease-in-out', fill: 'forwards' }));
        cat.pose({ l: 130, r: -30, sway: -14, footL: 0.8, footR: 0 });
        toon('tapshoe', undefined, { vol: 0.6 });
      });
      at(2.1, () => {
        flamingo.classList.add('dip');
        cat.pose({ l: 60, r: -100, sway: 16, footL: 0, footR: 0.6 });
        toon('ding', undefined, { vol: 0.7 });
        comic('OLÉ!', rigPt(cat, 100, 10), 'big');
        cheer();
        for (let k = 0; k < 10; k++) later(k * 40, () => sparkle(centre(stage, rnd(0.2, 0.8), rnd(0.05, 0.3)), 2, 'rose'));
      });
      at(2.7, () => score('10'));
    }
    /* Into the crowd, and they carry him off. */
    function winDive() {
      cat.mood('star');
      cat.pose({ l: 150, r: -150 });
      cat.el.classList.add('dt-glow');
      crowd.classList.add('ready');
      const b0 = box();
      comic('STAGE DIVE!', { x: b0.left + b0.width / 2, y: b0.top + b0.height * 0.12 }, 'big'); // above his flight
      toon('whistle-up', undefined, { vol: 0.6 });
      const cb = crowd.getBoundingClientRect();
      const cr = cat.el.getBoundingClientRect();
      const dx = cb.left + cb.width * 0.42 - (cr.left + cr.width / 2);
      const dy = cb.top + cb.height * 0.1 - (cr.top + cr.height / 2);
      at(0.5, () => {
        cat.pose({ l: 160, r: -160, sway: 0 });
        cat.el.animate([
          { translate: '0 0', rotate: '0deg', scale: '1' },
          { translate: `${dx * 0.5}px ${dy - cr.height * 0.6}px`, rotate: '-50deg', scale: '.75', offset: 0.55 },
          { translate: `${dx}px ${dy}px`, rotate: '-90deg', scale: '.58' },
        ], { duration: beatMs() * 1.1, easing: 'ease-in-out', fill: 'forwards' });
      });
      at(1.6, () => {
        crowd.classList.add('surf');
        toon('cheer', undefined, { vol: 0.9 });
        ballBy(4);
        cat.el.animate([
          { translate: `${dx}px ${dy}px`, rotate: '-90deg', scale: '.58' },
          { translate: `${dx + cb.width * 0.3}px ${dy - 6}px`, rotate: '-84deg', scale: '.58' },
        ], { duration: beatMs() * 2.2, easing: 'linear', fill: 'forwards' });
        cat.mood('happy');
      });
      for (let k = 0; k < 4; k++) at(1.7 + k * 0.5, () => cat.pose({ l: 40, r: k % 2 ? -170 : -120 }));
      at(2.6, () => {
        comic('CROWD SURF!', centre(crowd, 0.6, 0), 'big');
        toon('applause', undefined, { vol: 1 });
        toon('airhorn', undefined, { vol: 0.8 });
        confetti(20);
      });
      at(2.9, () => score('10'));
    }

    /* ---------------- misses: he goes to sleep ---------------- */

    function sleepy(who = cat) {
      who.svg.classList.remove('dt-yawning', 'shades');
      who.mood('sleep');
      who.pose(STAND);
    }
    /* A yawn as big as his head, a nightcap drops on, and he's out. */
    function failYawn() {
      lightsOut();
      crowd.classList.add('droop');
      cat.mood('yawn');
      cat.svg.classList.add('dt-yawning');
      cat.pose({ l: 160, r: -160, sway: 0, footL: 0, footR: 0 });
      toon('yawn', undefined, { vol: 0.9 });
      at(1.3, () => {
        cat.svg.classList.add('dt-cap');
        bump(cat.svg.querySelector('.dt-cap'), 'on');
        toon('boing', undefined, { vol: 0.5, rate: 0.8 });
      });
      at(1.7, () => {
        sleepy();
        toon('snore', undefined, { vol: 1 });
        zzz(rigPt(cat, 140, 40), 4);
      });
      at(2.3, () => {
        judge.classList.add('doze');
        score('zzz', 'zz');
        crowd.classList.add('sleep');
      });
    }
    /* The record winds down: the horn droops, the ball stops, and he winds down too. */
    function failRecord() {
      toon('scratch', undefined, { vol: 0.9 });
      gram.classList.add('droop');
      lightsOut();
      toon('rundown', undefined, { vol: 1 });
      cat.mood('dizzy');
      cat.pose({ l: 110, r: -60, sway: -6 });
      cat.el.style.transformOrigin = '50% 92%';
      at(0.4, () => {
        cat.el.animate([{ rotate: '0deg' }, { rotate: '-12deg', offset: 0.3 }, { rotate: '-84deg' }], { duration: beatMs() * 2, easing: 'cubic-bezier(.6,0,.9,.6)', fill: 'forwards' });
        cat.pose({ l: 60, r: -30, sway: 0 });
      });
      at(1.2, () => sleepy());
      at(2.4, () => {
        toon('thud', undefined, { vol: 0.9 });
        dust(rigPt(cat, 60, 120), 6);
        punch(rigPt(cat, 100, 120), 1.05, 300);
        zzz(rigPt(cat, 60, 60), 3);
        crowd.classList.add('droop');
      });
      at(2.8, () => score('zzz', 'zz'));
    }
    /* Eyes shut, arms out, he walks off the front of the stage. Then he looks down. */
    function failSleepwalk() {
      lightsOut();
      sleepy();
      cat.pose({ l: 94, r: -94, sway: 0 });
      zzz(rigPt(cat, 140, 40), 3);
      cat.el.style.transformOrigin = '50% 100%';
      cat.el.animate([{ translate: '0 0', scale: '1' }, { translate: '0 18%', scale: '1.35' }], { duration: beatMs() * 2, easing: 'linear', fill: 'forwards' });
      for (let k = 0; k < 4; k++) {
        at(k * 0.5, () => {
          cat.stomp(k % 2 ? 1 : -1, 0.8);
          cat.pose({ l: 94 + (k % 2) * 8, r: -94 - (k % 2 ? 0 : 8) });
          toon('tiptoe', undefined, { vol: 0.6 });
        });
      }
      at(2.05, () => {
        cat.mood('shock');
        cat.pose({ l: 150, r: -150 });
        comic('?!', rigPt(cat, 100, 0), 'bad');
        toon('whistle-down', undefined, { vol: 0.8 });
      });
      at(2.6, () => {
        cat.el.animate([{ translate: '0 18%', scale: '1.35' }, { translate: '0 130%', scale: '1.35' }], { duration: beatMs() * 0.5, easing: 'cubic-bezier(.5,0,1,.6)', fill: 'forwards' });
      });
      at(3.05, () => {
        toon('thud', undefined, { vol: 1 });
        const b = box();
        dust({ x: b.left + b.width / 2, y: b.bottom - 8 }, 8);
        punch({ x: b.left + b.width / 2, y: b.bottom }, 1.06, 300);
        score('zzz', 'zz');
      });
    }
    /* The curtain comes down on him mid-move. His tail sticks out underneath. Snoring. */
    function failCurtain() {
      cat.mood('shock');
      cat.pose({ l: 86, r: -86, sway: -5, footL: 0.7 });
      const cur = h('div', 'dt-curtain');
      cur.innerHTML = TAIL; // fixed markup
      cam.append(cur);
      toon('whistle-down', undefined, { vol: 0.6, rate: 1.3 });
      at(0.55, () => {
        toon('thud', undefined, { vol: 1 });
        const b = box();
        dust({ x: b.left + b.width * 0.3, y: b.bottom - 6 }, 5);
        dust({ x: b.left + b.width * 0.7, y: b.bottom - 6 }, 5);
        lightsOut();
      });
      at(1.3, () => {
        cur.classList.add('tail');
        sleepy();
      });
      at(1.8, () => {
        toon('snore', undefined, { vol: 1 });
        zzz(centre(cur, 0.5, 0.55), 4);
      });
      at(2.6, () => comic('THE END', centre(cur, 0.5, 0.35), 'bad'));
    }
    /* He sleeps, and dreams he's dancing perfectly. */
    function failDream() {
      lightsOut();
      sleepy();
      toon('snore', undefined, { vol: 0.9 });
      const dream = h('div', 'dt-dream');
      dream.innerHTML = CLOUD; // fixed markup
      const mini = rigMookie();
      mini.el.classList.add('dt-mini');
      mini.mood('star');
      const tiny = h('i', 'dt-tinyball');
      dream.append(h('i', 'b1'), h('i', 'b2'), tiny, mini.el);
      const top = local(rigPt(cat, 150, 20));
      dream.style.left = `${clampX(top.x, 0.2)}px`;
      dream.style.top = `${top.y}px`;
      fx.append(dream);
      at(0.3, () => toon('twinkle', undefined, { vol: 0.6 }));
      for (let k = 0; k < 9; k++) {
        at(0.6 + k * 0.33, () => {
          const p = POSES[k % POSES.length];
          mini.pose(p);
          mini.stomp(k % 2 ? 1 : -1, 1);
        });
      }
      at(1.2, () => zzz(rigPt(cat, 60, 50), 3));
      at(2.4, () => bubble('awww', centre(crowd, 0.3, 0.2)));
      at(2.6, () => crowd.classList.add('droop'));
      later(beatMs() * 4.2, () => dream.remove());
    }

    /* ---------------- boss ---------------- */

    /* One more piece of Rusty's suit flies off. */
    function suitOff(n = 1) {
      for (let k = 0; k < n && suitAt < SUIT_ORDER.length; k++) {
        const pc = rusty.el.querySelector(`.pc-${SUIT_ORDER[suitAt++]}`);
        pc?.classList.add('off');
      }
    }
    function bossKO() {
      // The mirror ball comes down on him: BONK. He spins away like a top.
      const head = rigPt(rusty, 100, 30);
      const cv = h('canvas');
      const g = h('div', 'dt-giant');
      g.append(h('i', 'dt-chain'), cv);
      const p = local(head);
      const gw = Math.min(box().height * 0.34, box().width * 0.3);
      g.style.left = `${p.x}px`;
      g.style.width = `${gw}px`;
      g.style.setProperty('--y', `${p.y - gw * 0.92}px`);
      g.style.setProperty('--drop', `${(beatMs() * 0.55) / 1000}s`);
      cam.append(g);
      giant = { cv };
      ball.classList.add('gone');
      toon('whistle-down', undefined, { vol: 0.8 });
      at(0.55, () => {
        toon('gong', undefined, { vol: 0.8 });
        toon('tin', undefined, { vol: 0.9 });
        rusty.mood('dizzy');
        suitOff(5);
        comic('BONK!', head, 'big');
        punch(head, 1.1, 400);
        flashSpeed('gold');
        cat.mood('star');
        cat.pose({ l: 150, r: -150 });
      });
      at(1.2, () => {
        toon('zip', undefined, { vol: 1 });
        rusty.el.animate(turns(1), { duration: 160, iterations: 10 });
        rusty.el.animate([{ translate: '0 0' }, { translate: '60cqw 0' }], { duration: beatMs() * 2.4, easing: 'cubic-bezier(.45,0,.85,.55)', fill: 'forwards' });
        g.classList.add('up');
      });
      at(2, () => {
        const cup = photo('trophy', 'ms-trophy');
        const top = local(rigPt(cat, 100, 30));
        cup.style.left = `${top.x}px`;
        cup.style.top = `${top.y}px`;
        fx.append(cup);
        toon('choir', undefined, { vol: 1 });
        later(beatMs() * 0.5, () => toon('airhorn', undefined, { vol: 0.8 }));
        cheer();
        confetti(40);
        later(250, () => comic('CHAMPION!', { x: rigPt(cat, 100, 30).x, y: box().top + box().height * 0.14 }, 'big')); // over the cup
      });
      at(2.4, () => score('10'));
    }
    function bossLose() {
      // Rusty takes the trophy and does the point. Mookie's asleep.
      const cup = photo('trophy', 'ms-trophy');
      const top = local(rigPt(rusty, 100, 20));
      cup.style.left = `${top.x}px`;
      cup.style.top = `${top.y}px`;
      fx.append(cup);
      toon('fanfare', undefined, { vol: 0.6, rate: 0.8 });
      rusty.mood('happy');
      crowdCheer();
      cat.mood('yawn');
      cat.svg.classList.add('dt-yawning');
      toon('yawn', undefined, { vol: 0.8 });
      at(0.8, () => {
        const head = rigPt(rusty, 100, 40);
        rusty.reach(head.x + box().width * 0.06, head.y - box().height * 0.3, 1.2);
        rusty.mood('smug');
        comic('DISCO KING.', head, 'bad');
        score('10', 'rusty');
      });
      at(1.4, () => {
        sleepy();
        cat.svg.classList.add('dt-cap');
        bump(cat.svg.querySelector('.dt-cap'), 'on');
        toon('snore', undefined, { vol: 0.9 });
        zzz(rigPt(cat, 140, 40), 3);
      });
    }
  },
};
