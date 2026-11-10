/* Petting Time. Mookie (rig.js) sits on something soft and a hand on a very long arm pets him.
   The call: the Pug (a porcelain pug's head from 1750 with googly eyes, who wants the pets
   himself) barks it from his pedestal. With every note Mookie's tail thumps and an empty heart
   floats up over his head. The response: every tap is a pet. He squishes like dough, a heart
   fills, the purr-o-meter climbs.
   The hand is a different one every round (HANDS): a cartoon glove, a knight's gauntlet, an
   oven mitt, an 800-year-old golden arm, a robot claw, a foam finger. So is the place
   (THEMES): grandma's armchair, an old painting, a cat cafe, the Moon, the Great Wave.
   Win (random, never twice running): hearts everywhere and a pat for the Pug; he melts into a
   puddle; he purrs so hard he revs like a motorbike and rides off; long cat; he makes biscuits
   and a tray of real ones turns up; a propeller beanie carries him away.
   Miss: he bites, and he's delighted about it every time. A love bite and a bandage; the belly
   trap; he slurps the whole arm like a noodle; the hand comes back as bones; he turns into a
   cactus just as the hand lands.
   The room parties as the combo grows: the meter bops, a 2,000-year-old dog pops up to howl
   along, spotlights swing, it rains hearts, Mookie wears shades.
   Boss: The Belly. Rusty (cats.js) upside down on an ottoman beside a DO NOT PET sign. Each hit
   is a belly rub and his legs kick faster; the last one and he pedals off the screen.
   Real photos are CC0 museum objects, paintings, NASA pictures and textures (props/CREDITS.txt,
   bg/CREDITS.txt).
   Fixed markup only: nothing a learner types goes in here (call syllables are du/de). */

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
const INK = '#17171b';

/* ---------------- the hands ---------------- */

/* Every hand is drawn in a 100 x 100 box, fingers down, with its arm running off the top right
   of the stage. `at` is the spot that touches the cat (percent of the box). A photo hand's
   picture is placed over the box by scene-pet.css (.k-<kind> .pt-hand-photo). */
const ARM = 'M50 12 C62 -70 150 -190 330 -380';
const sleeve = (w = 22) => `<path class="pt-arm pt-sleeve" d="${ARM}" stroke-width="${w}" fill="none" stroke-linecap="round"/>
  <path class="pt-arm" d="${ARM}" stroke="#fff" stroke-width="${w}" stroke-dasharray="7 15" fill="none" opacity=".4"/>`;

const GLOVE = `${sleeve()}
  <g fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <rect x="27" y="46" width="13" height="34" rx="6.5"/><rect x="39.5" y="46" width="13" height="46" rx="6.5"/>
    <rect x="52" y="46" width="13" height="48" rx="6.5"/><rect x="64.5" y="46" width="13" height="38" rx="6.5"/>
    <path d="M30 36 Q11 31 11 47 Q12 59 22 58 Q30 57 31 47"/>
    <path d="M27 60 V24 Q27 20 31 20 H73.5 Q77.5 20 77.5 24 V60"/>
    <rect x="24" y="6" width="56" height="17" rx="8.5"/>
  </g>
  <path d="M40 30 V44 M52 28 V44 M64.5 30 V44" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;

const MITT = `${sleeve()}
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <path d="M30 40 Q10 34 10 52 Q12 66 24 63 Q31 61 32 50" fill="#e0483c"/>
    <path d="M27 22 H77 V66 Q77 94 52 94 Q27 94 27 66 Z" fill="#e0483c"/>
    <rect x="23" y="6" width="58" height="18" rx="9" fill="#fff6e4"/>
  </g>
  <g stroke="#ffb3a6" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round" fill="none">
    <path d="M31 46 L52 31 L73 46 M31 70 L52 55 L73 70 M38 86 L52 76 L66 86"/></g>
  <path d="M52 50 c-3 -5 -10 -2 -8 4 c1 4 8 8 8 8 c0 0 7 -4 8 -8 c2 -6 -5 -9 -8 -4 Z" fill="#fff6e4" stroke="${INK}" stroke-width="1.6"/>`;

const CLAW = `<path class="pt-arm" d="${ARM}" stroke="#4f565d" stroke-width="20" fill="none" stroke-linecap="round"/>
  <path class="pt-arm" d="${ARM}" stroke="#ffd84a" stroke-width="13" stroke-dasharray="10 12" fill="none"/>
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path class="pt-prong l" d="M40 40 Q16 50 18 72 Q20 86 34 92 L38 84 Q30 78 30 70 Q30 58 46 52 Z" fill="#c9d1d8"/>
    <path class="pt-prong r" d="M60 40 Q84 50 82 72 Q80 86 66 92 L62 84 Q70 78 70 70 Q70 58 54 52 Z" fill="#c9d1d8"/>
    <rect x="44" y="44" width="12" height="26" rx="4" fill="#9aa3ab"/>
    <circle cx="50" cy="75" r="7.5" fill="#e0483c"/>
    <rect x="30" y="6" width="40" height="22" rx="5" fill="#9aa3ab"/>
    <circle cx="50" cy="40" r="13" fill="#c9d1d8"/>
  </g>
  <circle cx="50" cy="40" r="4" fill="${INK}"/><circle cx="38" cy="17" r="2.4" fill="${INK}"/><circle cx="62" cy="17" r="2.4" fill="${INK}"/>
  <path d="M43 33 Q50 29 57 33" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>`;

const FOAM = `${sleeve(18)}
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round" fill="#2d6fd0">
    <rect x="41" y="44" width="20" height="50" rx="10"/>
    <path d="M22 30 Q8 28 9 40 Q10 50 22 48"/>
    <path d="M22 16 Q22 8 30 8 H72 Q80 8 80 16 V48 Q80 58 70 58 H32 Q22 58 22 48 Z"/>
  </g>
  <rect x="43" y="52" width="16" height="10" fill="#2d6fd0"/>
  <text x="51" y="43" font-family="Fredoka, sans-serif" font-weight="700" font-size="25" text-anchor="middle" fill="#fff">#1</text>
  <path d="M31 15 H58" stroke="#8fc0ff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;

/* The photo hands only draw the rest of their arm here. */
const STEEL_ARM = 'M76 -22 C104 -80 176 -190 340 -390';
const STEEL = `<path class="pt-arm" d="${STEEL_ARM}" stroke="#565d66" stroke-width="22" fill="none" stroke-linecap="round"/>
  <path class="pt-arm" d="${STEEL_ARM}" stroke="#c3cad1" stroke-width="18" stroke-dasharray="15 4" fill="none"/>`;
const GOLD_ARM = 'M50 -96 C58 -160 150 -270 340 -440';
const GOLD = `<path class="pt-arm" d="${GOLD_ARM}" stroke="#7a5a12" stroke-width="21" fill="none" stroke-linecap="round"/>
  <path class="pt-arm" d="${GOLD_ARM}" stroke="#d9b04e" stroke-width="16" fill="none" stroke-linecap="round"/>
  <path class="pt-arm" d="${GOLD_ARM}" stroke="#f6e3a1" stroke-width="4" stroke-dasharray="3 9" fill="none" opacity=".8"/>`;

/* What a hand can come back as (the misses): bones, a bandage, a fistful of cactus spines. */
const finger = (x, tip) => {
  const len = tip - 30;
  const a = len * 0.42;
  const b = len * 0.32;
  return `<rect x="${x}" y="30" width="8.5" height="${(a - 2.5).toFixed(1)}" rx="4"/><rect x="${x}" y="${(30 + a).toFixed(1)}" width="8.5" height="${(b - 2.5).toFixed(1)}" rx="4"/><rect x="${x}" y="${(30 + a + b).toFixed(1)}" width="8.5" height="${(len - a - b).toFixed(1)}" rx="4"/>`;
};
const EXTRAS = `<g class="pt-bones" fill="#f6f1e4" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round">
    <path class="pt-arm" d="${ARM}" stroke-width="13" fill="none" stroke-linecap="round"/><path class="pt-arm" d="${ARM}" stroke="#f6f1e4" stroke-width="8.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="40" cy="15" rx="6" ry="5"/><ellipse cx="51.5" cy="13" rx="6" ry="5"/><ellipse cx="63" cy="15" rx="6" ry="5"/>
    <ellipse cx="46" cy="23" rx="5.5" ry="4.5"/><ellipse cx="58" cy="23" rx="5.5" ry="4.5"/>
    ${finger(29, 80)}${finger(40.5, 92)}${finger(52, 94)}${finger(63.5, 84)}
    <g transform="rotate(40 27 30)"><rect x="18" y="29" width="8.5" height="14" rx="4"/><rect x="18" y="45" width="8.5" height="12" rx="4"/></g></g>
  <g class="pt-bandage" stroke="${INK}" stroke-width="2">
    <rect x="24" y="58" width="56" height="15" rx="7" fill="#f6dcb4" transform="rotate(-24 52 66)"/>
    <rect x="24" y="58" width="56" height="15" rx="7" fill="#f6dcb4" transform="rotate(24 52 66)"/>
    <rect x="45" y="59.5" width="14" height="13" rx="3" fill="#fff6e4" stroke-width="1.4"/></g>
  <g class="pt-spines" stroke="${INK}" stroke-width="2.2" stroke-linecap="round">
    <path d="M32 80 l-7 9 M42 90 l-3 12 M52 93 l1 13 M62 91 l5 11 M72 82 l8 8 M36 68 l-10 3 M70 68 l10 2"/></g>`;

const HANDS = {
  glove: { art: GLOVE, at: [52, 92] },
  gauntlet: { art: STEEL, photo: 'gauntlet', at: [20, 88] },
  mitt: { art: MITT, at: [52, 93] },
  gold: { art: GOLD, photo: 'gold-hand', at: [50, 97] },
  claw: { art: CLAW, at: [50, 82] },
  foam: { art: FOAM, at: [51, 93] },
};
const HAND_ORDER = Object.keys(HANDS);
let handAt = Math.floor(Math.random() * HAND_ORDER.length);
const nextHand = () => HAND_ORDER[handAt++ % HAND_ORDER.length];
const REST = -12; // the hand's resting tilt, degrees (also in scene-pet.css)

/* ---------------- drawings ---------------- */

const HEART = '<svg viewBox="0 0 32 30" aria-hidden="true"><path d="M16 28 C5 20 1 14 1 9 A7.5 7.5 0 0 1 16 6.5 A7.5 7.5 0 0 1 31 9 C31 14 27 20 16 28 Z"/></svg>';

/* The purr-o-meter: four zones, a needle that scene-pet.css turns with --purr (0 to 1). */
const zone = (a0, a1, fill) => {
  const p = (a) => `${(60 + 46 * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(70 - 46 * Math.sin((a * Math.PI) / 180)).toFixed(1)}`;
  return `<path d="M60 70 L${p(a0)} A46 46 0 0 1 ${p(a1)} Z" fill="${fill}"/>`;
};
const METER = `<svg viewBox="0 0 120 94" aria-hidden="true">
  <rect class="pt-m-case" x="2" y="2" width="116" height="90" rx="11"/>
  <rect class="pt-m-face" x="8" y="8" width="104" height="68" rx="7"/>
  ${zone(180, 135, '#9fd3f0')}${zone(135, 90, '#ffe08a')}${zone(90, 45, '#ffab6b')}${zone(45, 0, '#ff6f91')}
  <path d="M14 70 A46 46 0 0 1 106 70" fill="none" stroke="${INK}" stroke-width="2.5"/>
  <g font-family="Fredoka, sans-serif" font-weight="700" font-size="6.5" text-anchor="middle" fill="${INK}">
    <text x="26" y="62">zzz</text><text x="46" y="42">mrr</text><text x="74" y="42">purr</text><text x="95" y="62">MAX</text></g>
  <g class="pt-needle"><path d="M60 70 L60 27" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/><path d="M60 22 l-4 8 h8 Z" fill="#e0483c" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/></g>
  <circle cx="60" cy="70" r="6" fill="${INK}"/><circle cx="60" cy="70" r="2" fill="#c9d1d8"/>
  <text class="pt-m-name" x="60" y="87.5" font-family="Fredoka, sans-serif" font-weight="700" font-size="8" letter-spacing=".6" text-anchor="middle" data-fit="104">PURR-O-METER</text>
</svg>`;

/* What Mookie sits on. 300 x 150, the sitting surface at y = 60, 150 across the middle.
   `front` is drawn in front of him. */
const ARMCHAIR = `<svg viewBox="0 0 300 150" aria-hidden="true">
  <rect x="42" y="126" width="13" height="22" rx="3" fill="#6e3c16"/><rect x="245" y="126" width="13" height="22" rx="3" fill="#6e3c16"/>
  <path d="M50 74 V-66 Q50 -150 150 -150 Q250 -150 250 -66 V74 Z" fill="#c97a8e" stroke="#7d3c50" stroke-width="3"/>
  <path d="M68 60 V-62 Q68 -132 150 -132 Q232 -132 232 -62 V60" fill="none" stroke="#a85870" stroke-width="3" opacity=".7"/>
  <g fill="#7d3c50"><circle cx="100" cy="-74" r="4"/><circle cx="150" cy="-96" r="4"/><circle cx="200" cy="-74" r="4"/><circle cx="82" cy="-18" r="4"/><circle cx="218" cy="-18" r="4"/></g>
  <path d="M92 -136 Q104 -150 118 -143 Q134 -156 150 -146 Q166 -156 182 -143 Q196 -150 208 -136 Q212 -112 196 -108 Q182 -100 166 -108 Q150 -98 134 -108 Q118 -100 104 -108 Q88 -112 92 -136 Z" fill="#fffaf0" stroke="#d9cdb8" stroke-width="2"/>
  <g fill="none" stroke="#d9cdb8" stroke-width="1.6"><circle cx="118" cy="-126" r="6"/><circle cx="150" cy="-128" r="7"/><circle cx="182" cy="-126" r="6"/></g>
  <path d="M30 132 Q150 144 270 132 V96 H30 Z" fill="#b6657c" stroke="#7d3c50" stroke-width="3"/>
  <rect x="64" y="54" width="172" height="40" rx="15" fill="#d68ea1" stroke="#7d3c50" stroke-width="3"/>
  <path d="M20 44 Q20 14 46 14 Q72 14 72 44 V120 H20 Z" fill="#c97a8e" stroke="#7d3c50" stroke-width="3"/>
  <path d="M228 44 Q228 14 254 14 Q280 14 280 44 V120 H228 Z" fill="#c97a8e" stroke="#7d3c50" stroke-width="3"/>
  <path d="M30 28 Q46 18 62 28 M238 28 Q254 18 270 28" stroke="#e3a4b5" stroke-width="4" fill="none" stroke-linecap="round"/>
  <g stroke="${INK}" stroke-width="1.5" stroke-linejoin="round">
    <path d="M78 66 L96 58 L114 66 L132 58 L150 66 L168 58 L186 66 L204 58 L222 66 V78 L204 70 L186 78 L168 70 L150 78 L132 70 L114 78 L96 70 L78 78 Z" fill="#ffd84a"/>
    <path d="M78 78 L96 70 L114 78 L132 70 L150 78 L168 70 L186 78 L204 70 L222 78 V90 L204 82 L186 90 L168 82 L150 90 L132 82 L114 90 L96 82 L78 90 Z" fill="#7fe3d2"/>
    <path d="M78 90 L96 82 L114 90 L132 82 L150 90 L168 82 L186 90 L204 82 L222 90 V102 L204 94 L186 102 L168 94 L150 102 L132 94 L114 102 L96 94 L78 102 Z" fill="#ff8fa0"/></g>
</svg>`;
const CUSHION = `<svg viewBox="0 0 300 150" aria-hidden="true">
  <g stroke="#7a5a12" stroke-width="3" fill="#c9a24a" stroke-linejoin="round">
    <path d="M88 104 Q84 130 70 148 H84 Q98 130 102 104 Z"/><path d="M212 104 Q216 130 230 148 H216 Q202 130 198 104 Z"/>
    <path d="M64 94 H236 L228 112 H72 Z"/></g>
  <path d="M82 103 H218" stroke="#f6e3a1" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M46 62 Q150 42 254 62 Q268 82 254 102 Q150 116 46 102 Q32 82 46 62 Z" fill="#8e1f3c" stroke="#4d0f20" stroke-width="3"/>
  <path d="M58 68 Q150 50 242 68" stroke="#c7506e" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>
  <path d="M46 62 Q150 42 254 62 M46 102 Q150 116 254 102" stroke="#e0bb4a" stroke-width="3" fill="none"/>
  <g class="pt-tassel" fill="#e0bb4a" stroke="#7a5a12" stroke-width="1.5">
    <path d="M40 60 q-10 4 -12 16 l8 2 q2 -8 8 -12 Z"/><path d="M260 60 q10 4 12 16 l-8 2 q-2 -8 -8 -12 Z"/>
    <path d="M40 104 q-12 2 -16 14 l8 3 q4 -8 10 -10 Z"/><path d="M260 104 q12 2 16 14 l-8 3 q-4 -8 -10 -10 Z"/></g>
</svg>`;
const CAT_TREE = `<svg viewBox="0 0 300 150" aria-hidden="true">
  <rect x="92" y="138" width="116" height="14" rx="5" fill="#7fb7a6" stroke="#3f7a6a" stroke-width="3"/>
  <rect x="128" y="74" width="44" height="66" fill="#e3c798" stroke="#8a6a3c" stroke-width="3"/>
  <path d="M128 86 L172 80 M128 96 L172 90 M128 106 L172 100 M128 116 L172 110 M128 126 L172 120 M128 136 L172 130" stroke="#b08d58" stroke-width="2.5"/>
  <g class="pt-toy"><path d="M74 78 V110" stroke="#5b5148" stroke-width="2"/><circle cx="74" cy="119" r="10" fill="#ff8fa0" stroke="#b3475a" stroke-width="2.5"/>
    <path d="M68 114 q6 -4 12 2 M67 122 q7 5 14 0" stroke="#b3475a" stroke-width="1.5" fill="none"/></g>
  <rect x="40" y="56" width="220" height="26" rx="13" fill="#7fb7a6" stroke="#3f7a6a" stroke-width="3"/>
  <path d="M56 64 H244" stroke="#b6e0d3" stroke-width="5" stroke-linecap="round" opacity=".8"/>
</svg>`;
const MOON_ROCK = `<svg viewBox="0 0 300 150" aria-hidden="true">
  <path d="M256 78 V-30" stroke="#e7ebef" stroke-width="3.5" stroke-linecap="round"/>
  <g class="pt-flag"><path d="M256 -30 H300 V2 H256 Z" fill="#fff" stroke="#5f636b" stroke-width="2.5" stroke-linejoin="round"/>
    <g fill="#e0483c"><ellipse cx="278" cy="-10" rx="7" ry="5.5"/><circle cx="268" cy="-18" r="3"/><circle cx="276" cy="-22" r="3"/><circle cx="285" cy="-20" r="3"/></g></g>
  <path d="M30 152 Q26 96 62 74 Q100 54 150 58 Q204 54 240 72 Q276 96 270 152 Z" fill="#c3c6cc" stroke="#5f636b" stroke-width="3"/>
  <path d="M150 58 Q204 54 240 72 Q276 96 270 152 H196 Q238 104 150 58 Z" fill="#8d9199" opacity=".75"/>
  <g fill="#9a9ea6" stroke="#5f636b" stroke-width="2"><ellipse cx="84" cy="106" rx="17" ry="7"/><ellipse cx="150" cy="130" rx="12" ry="5"/><ellipse cx="216" cy="118" rx="14" ry="6"/></g>
  <path d="M62 82 Q100 62 148 64" stroke="#eef0f3" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
</svg>`;
const BOAT_BACK = `<svg viewBox="0 0 300 150" aria-hidden="true">
  <path d="M22 56 Q150 40 278 56 Q260 76 150 76 Q40 76 22 56 Z" fill="#5e3a17" stroke="#3a2209" stroke-width="3"/>
</svg>`;
const BOAT_FRONT = `<svg viewBox="0 0 300 150" aria-hidden="true">
  <path d="M14 56 Q40 72 150 72 Q260 72 286 56 Q280 106 238 122 H62 Q20 106 14 56 Z" fill="#b5793f" stroke="#5e3a17" stroke-width="3" stroke-linejoin="round"/>
  <path d="M26 80 Q150 96 274 80 M40 100 Q150 114 260 100" stroke="#5e3a17" stroke-width="2" fill="none" opacity=".7"/>
  <path d="M14 56 Q40 72 150 72 Q260 72 286 56" stroke="#e3b072" stroke-width="6" fill="none" stroke-linecap="round"/>
  <text x="150" y="94" font-family="Fredoka, sans-serif" font-weight="700" font-size="13" letter-spacing="1.5" text-anchor="middle" fill="#fbf3dc" data-fit="120">S.S. MOOKIE</text>
  <g class="pt-foam">
    <path d="M-10 156 V126 Q4 108 20 122 Q34 104 52 120 Q70 100 90 120 Q110 102 130 120 Q150 100 170 120 Q190 102 210 120 Q230 100 248 120 Q266 104 280 122 Q296 108 310 126 V156 Z" fill="#f4ecd8" stroke="#1d3f6e" stroke-width="3" stroke-linejoin="round"/>
    <path d="M-10 156 V140 Q20 128 50 140 Q80 128 110 140 Q140 128 170 140 Q200 128 230 140 Q260 128 310 140 V156 Z" fill="#2a5a9a" stroke="#1d3f6e" stroke-width="2.5"/>
    <g fill="#f4ecd8" stroke="#1d3f6e" stroke-width="1.5"><circle cx="36" cy="104" r="3.5"/><circle cx="118" cy="98" r="3"/><circle cx="196" cy="100" r="3.5"/><circle cx="262" cy="104" r="3"/></g></g>
</svg>`;
/* The boss's seat: a tufted ottoman. */
const OTTOMAN = `<svg viewBox="0 0 300 150" aria-hidden="true">
  <rect x="50" y="132" width="14" height="18" rx="3" fill="#4a2c16"/><rect x="236" y="132" width="14" height="18" rx="3" fill="#4a2c16"/>
  <path d="M26 78 Q26 54 58 54 H242 Q274 54 274 78 V124 Q274 138 258 138 H42 Q26 138 26 124 Z" fill="#7a5bb0" stroke="#3f2a6e" stroke-width="3"/>
  <path d="M46 66 H254" stroke="#a78bdc" stroke-width="6" stroke-linecap="round" opacity=".8"/>
  <path d="M26 96 Q88 108 150 96 Q212 108 274 96" stroke="#3f2a6e" stroke-width="2" fill="none" opacity=".7"/>
  <g fill="#e0bb4a" stroke="#3f2a6e" stroke-width="1.5"><circle cx="88" cy="102" r="5"/><circle cx="150" cy="96" r="5"/><circle cx="212" cy="102" r="5"/></g>
  <path d="M30 136 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10 l6 10" stroke="#e0bb4a" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
</svg>`;
/* The boss's sign. KO turns it round. */
const SIGN = `<svg viewBox="0 0 100 120" aria-hidden="true">
  <rect x="45" y="50" width="10" height="72" fill="#8a5a32" stroke="#4a2c16" stroke-width="2"/>
  <g class="s-board"><rect x="4" y="4" width="92" height="56" rx="6" fill="#fff8ec" stroke="${INK}" stroke-width="3.5"/>
    <g class="s-no" font-family="Fredoka, sans-serif" font-weight="700" text-anchor="middle" fill="#d23a48">
      <text x="50" y="27" font-size="17" data-fit="80">DO NOT</text><text x="50" y="51" font-size="24" data-fit="80">PET</text></g>
    <g class="s-yes" font-family="Fredoka, sans-serif" font-weight="700" text-anchor="middle" fill="#2f8f5b">
      <text x="50" y="27" font-size="17" data-fit="80">OK FINE</text><text x="50" y="51" font-size="24" data-fit="80">PET</text></g></g>
</svg>`;

/* Grandma's lamp; its fringe swings on the beat. */
const LAMP = `<svg viewBox="0 0 80 200" aria-hidden="true">
  <rect x="37" y="60" width="6" height="128" fill="#8a6a3c" stroke="#4a2c16" stroke-width="1.5"/>
  <ellipse cx="40" cy="192" rx="24" ry="7" fill="#8a6a3c" stroke="#4a2c16" stroke-width="2"/>
  <g class="pt-shade"><path d="M22 6 H58 L74 60 H6 Z" fill="#ffe9a6" stroke="#b8902a" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M8 60 v10 M16 60 v12 M24 60 v10 M32 60 v12 M40 60 v10 M48 60 v12 M56 60 v10 M64 60 v12 M72 60 v10" stroke="#e58aa6" stroke-width="3" stroke-linecap="round"/></g>
</svg>`;
/* The cafe's chalkboard. data-fit keeps each line on the board (signs.js). */
const BOARD = `<svg viewBox="0 0 100 120" aria-hidden="true">
  <rect x="2" y="2" width="96" height="116" rx="5" fill="#8a5a32" stroke="#4a2c16" stroke-width="2"/><rect x="8" y="8" width="84" height="104" rx="2" fill="#26332d"/>
  <g font-family="Fredoka, sans-serif" font-weight="700" text-anchor="middle" fill="#fff6c4">
    <text x="50" y="24" font-size="11" letter-spacing=".5" data-fit="74">CAT CAFE</text></g>
  <path d="M20 30 H80" stroke="#ff8fa0" stroke-width="1.5" stroke-dasharray="3 2"/>
  <g font-family="Fredoka, sans-serif" font-size="7.4" fill="#f4f1ea">
    ${[['coffee', '2 fish'], ['pets', 'free'], ['bites', 'also free'], ['the belly', 'NO'], ['Rusty', 'lol']].map(([what, cost], i) => `<text x="13" y="${44 + i * 12}" data-fit="42">${what}</text><text x="87" y="${44 + i * 12}" text-anchor="end" data-fit="30">${cost}</text>`).join('')}</g>
  <text x="50" y="106" font-family="Fredoka, sans-serif" font-size="5.6" text-anchor="middle" fill="#7fe3d2" data-fit="74">pet at your own risk</text>
</svg>`;

/* The wins' and misses' own props. */
const BIKE = `<svg viewBox="0 0 200 100" aria-hidden="true">
  <path d="M34 62 H98" stroke="#c9d1d8" stroke-width="7" stroke-linecap="round"/><path d="M34 62 H98" stroke="${INK}" stroke-width="1.5" stroke-dasharray="2 6"/>
  <g class="pt-wheel"><circle cx="38" cy="72" r="24" fill="#2a2a30" stroke="${INK}" stroke-width="3"/><circle cx="38" cy="72" r="12" fill="#c9d1d8"/><path d="M38 50 V94 M16 72 H60" stroke="#8a8f96" stroke-width="3"/></g>
  <g class="pt-wheel"><circle cx="162" cy="72" r="24" fill="#2a2a30" stroke="${INK}" stroke-width="3"/><circle cx="162" cy="72" r="12" fill="#c9d1d8"/><path d="M162 50 V94 M140 72 H184" stroke="#8a8f96" stroke-width="3"/></g>
  <path d="M38 72 L84 42 H128 L162 72" stroke="#e0483c" stroke-width="9" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M162 72 L140 20 M126 16 L152 24" stroke="#c9d1d8" stroke-width="6" stroke-linecap="round"/>
  <path d="M82 30 Q106 14 134 30 L130 48 H86 Z" fill="#e0483c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M92 28 Q106 20 122 27" stroke="#ff9d92" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <rect x="56" y="32" width="48" height="11" rx="5.5" fill="#2a2a30" stroke="${INK}" stroke-width="2"/>
  <circle cx="150" cy="32" r="8" fill="#ffe45c" stroke="${INK}" stroke-width="2.5"/>
</svg>`;
const biscuit = (x, y) => `<g transform="translate(${x} ${y})"><ellipse rx="14" ry="9.5" fill="#e9b96a" stroke="#8a5a1c" stroke-width="2"/><path d="M-9 -4 Q0 -9 9 -4" stroke="#fbe0a8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <g fill="#c98a3c"><ellipse cy="2.5" rx="4" ry="3"/><circle cx="-5.5" cy="-2" r="1.7"/><circle cy="-4" r="1.7"/><circle cx="5.5" cy="-2" r="1.7"/></g></g>`;
const TRAY = `<svg viewBox="0 0 170 80" aria-hidden="true">
  <g class="pt-steam" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85">
    <path d="M52 30 q-6 -8 0 -14 q6 -6 0 -14"/><path d="M86 28 q-6 -8 0 -14 q6 -6 0 -14"/><path d="M120 30 q-6 -8 0 -14 q6 -6 0 -14"/></g>
  <path d="M8 50 H162 L150 72 H20 Z" fill="#8a8f96" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <ellipse cx="85" cy="50" rx="78" ry="12" fill="#c9d1d8" stroke="${INK}" stroke-width="3"/>
  ${biscuit(36, 48)}${biscuit(70, 53)}${biscuit(102, 47)}${biscuit(134, 52)}${biscuit(86, 41)}
</svg>`;
const BEANIE = `<svg viewBox="0 0 100 72" aria-hidden="true">
  <rect x="48" y="12" width="4" height="16" fill="${INK}"/>
  <g class="pt-prop"><path d="M50 14 L12 7 Q6 14 12 21 Z" fill="#ffd84a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M50 14 L88 7 Q94 14 88 21 Z" fill="#e0483c" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="50" cy="14" r="4" fill="${INK}"/></g>
  <path d="M14 62 Q14 26 50 26 Q86 26 86 62 Z" fill="#2d6fd0" stroke="${INK}" stroke-width="3"/>
  <path d="M38 62 Q38 42 50 26 Q62 42 62 62 Z" fill="#ffd84a" stroke="${INK}" stroke-width="2"/>
  <rect x="9" y="58" width="82" height="10" rx="5" fill="#e0483c" stroke="${INK}" stroke-width="2.5"/>
</svg>`;
const FLOWER = `<g fill="#ff8fc0" stroke="${INK}" stroke-width="1.8"><circle cx="0" cy="-9" r="6.5"/><circle cx="8.5" cy="-3" r="6.5"/><circle cx="5.5" cy="7" r="6.5"/><circle cx="-5.5" cy="7" r="6.5"/><circle cx="-8.5" cy="-3" r="6.5"/></g><circle r="5" fill="#ffd84a" stroke="${INK}" stroke-width="1.8"/>`;
/* Mookie, but a cactus. Same box as the rig (200 x 222), so it stands exactly where he sat. */
const CACTUS = `<svg viewBox="0 0 200 222" aria-hidden="true">
  <path d="M66 204 L74 222 H126 L134 204 Z" fill="#c8693c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <rect x="58" y="192" width="84" height="15" rx="4" fill="#d9794a" stroke="${INK}" stroke-width="3"/>
  <g fill="#5fae5a" stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <path d="M72 154 H52 Q34 154 34 136 V108 Q34 97 45 97 Q56 97 56 108 V132 H72 Z"/>
    <path d="M128 134 H148 Q166 134 166 116 V88 Q166 77 155 77 Q144 77 144 88 V112 H128 Z"/>
    <path d="M74 64 L64 22 L98 46 Z"/><path d="M126 64 L136 22 L102 46 Z"/></g>
  <path d="M64 196 V82 Q64 40 100 40 Q136 40 136 82 V196 Z" fill="#6cc067" stroke="${INK}" stroke-width="3"/>
  <path d="M82 50 V192 M100 44 V192 M118 50 V192" stroke="#4d9a49" stroke-width="2.5" stroke-linecap="round"/>
  <g stroke="${INK}" stroke-width="2" stroke-linecap="round"><path d="M64 96 l-8 -4 M64 126 l-8 0 M64 170 l-8 4 M136 100 l8 -4 M136 150 l8 0 M136 178 l8 4 M34 118 l-7 -3 M166 98 l7 -3 M90 40 l-3 -8 M110 40 l3 -8 M74 140 l5 3 M124 162 l-5 3 M92 176 l4 4"/></g>
  <g stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"><path d="M74 86 Q83 75 92 86"/><path d="M108 86 Q117 75 126 86"/></g>
  <g fill="#f08aa8" opacity=".7"><ellipse cx="72" cy="98" rx="7" ry="4"/><ellipse cx="128" cy="98" rx="7" ry="4"/></g>
  <path d="M86 100 Q100 114 114 100" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <g transform="translate(100 36)">${FLOWER}</g>
</svg>`;

/* ---------------- photos ---------------- */

/* Real photos, cut out like stickers: CC0 museum objects (props/CREDITS.txt). */
const PROPS = ['pug', 'han-dog', 'gauntlet', 'gold-hand', 'bastet', 'trophy'];
const propUrl = (name) => new URL(`./props/${name}.png`, import.meta.url).href;
let preloaded = false;
function preload() {
  if (preloaded) return;
  preloaded = true;
  PROPS.forEach((n) => { const i = new Image(); i.src = propUrl(n); });
}
function photo(name, cls = '') {
  const i = document.createElement('img');
  i.src = propUrl(name);
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

/* ---------------- five places ---------------- */

/* One per round in turn (styles in scene-pet.css under [data-theme]; the pictures are in bg/).
   deco adds a place's own pieces to the background. */
const THEMES = [
  { id: 'gran',
    plate: 'PET ME',
    seat: ARMCHAIR,
    deco(bg) {
      const frame = h('div', 'pt-portrait');
      frame.append(photo('bastet'), h('b', '', 'GREAT-GRANDMA'));
      const lamp = h('div', 'pt-lamp');
      lamp.innerHTML = LAMP; // fixed markup
      bg.append(h('div', 'pt-floor'), frame, lamp);
    } },
  { id: 'paint',
    plate: 'PUG, c. 1750',
    seat: CUSHION,
    deco(bg) { bg.append(h('div', 'pt-gilt'), h('b', 'pt-brass', 'c. 1772 (cat added later)')); } },
  { id: 'cafe',
    plate: 'PUG OF THE DAY',
    seat: CAT_TREE,
    deco(bg) {
      const bulbs = h('div', 'pt-bulbs');
      for (let k = 0; k < 9; k++) bulbs.append(h('i'));
      const board = h('div', 'pt-board');
      board.innerHTML = BOARD; // fixed markup
      fitSigns(board);
      bg.append(h('div', 'pt-floor'), bulbs, board);
    } },
  { id: 'moon',
    plate: 'SPACE PUG',
    seat: MOON_ROCK,
    deco(bg) { bg.append(h('div', 'pt-stars'), h('div', 'pt-earth'), h('div', 'pt-ground')); } },
  { id: 'wave',
    plate: 'SEA PUG',
    seat: BOAT_BACK,
    front: BOAT_FRONT },
];
let themeAt = Math.floor(Math.random() * THEMES.length);
const nextTheme = () => THEMES[themeAt++ % THEMES.length];

/* Mookie, melted: a puddle of cat with his ears, his face and his tail still on it. */
const PUDDLE = `<svg viewBox="0 0 240 76" aria-hidden="true">
  <path d="M222 50 C244 44 240 16 222 14" fill="none" stroke="#17171b" stroke-width="10" stroke-linecap="round"/>
  <path d="M14 58 C0 50 8 36 30 36 C44 28 66 30 80 32 L88 8 L106 30 C116 28 126 28 134 30 L152 8 L160 32 C182 28 206 30 214 38 C238 38 242 54 226 60 C234 74 212 76 206 66 C180 74 150 72 120 72 C90 72 58 74 36 66 C28 76 6 72 14 58 Z" fill="#17171b"/>
  <path d="M90 16 L101 29 L86 30 Z M150 16 L154 30 L139 29 Z" fill="#c98a93"/>
  <g fill="none" stroke-linecap="round"><path d="M88 50 Q98 40 108 50 M132 50 Q142 40 152 50" stroke="#cde374" stroke-width="4"/>
    <path d="M110 59 Q115 64 120 59 Q125 64 130 59" stroke="#6a6a72" stroke-width="2"/>
    <path d="M70 54 L48 50 M70 60 L50 62 M170 54 L192 50 M170 60 L190 62" stroke="#6a6a72" stroke-width="1.4"/></g>
  <path d="M116 54 L124 54 L120 59 Z" fill="#4a3438"/>
  <g fill="#e58a9a" opacity=".55"><ellipse cx="80" cy="60" rx="8" ry="4"/><ellipse cx="160" cy="60" rx="8" ry="4"/></g>
  <path d="M40 44 Q60 38 78 40" stroke="#34343d" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>`;

const GAGS = {
  win: { happy: 'Hearts, and a pat for the Pug', puddle: 'Melts into a puddle', motor: 'Purr motor: rides off', long: 'Long cat', biscuits: 'Makes biscuits', copter: 'Propeller beanie' },
  fail: { chomp: 'A love bite', trap: 'The belly trap', slurp: 'Slurps the whole arm', bones: 'The hand comes back as bones', cactus: 'Suddenly, a cactus' },
};
const winGag = gagDeck(['happy', 'happy', 'puddle', 'motor', 'long', 'biscuits', 'copter'], () => pettingTime.gagsOn?.win);
const failGag = gagDeck(['chomp', 'chomp', 'trap', 'slurp', 'bones', 'cactus'], () => pettingTime.gagsOn?.fail);

export const pettingTime = {
  id: 'petting-time',
  name: 'Petting Time',
  tap: 'bongo-low',
  pickClass: 'opt-pet',
  slotIcon: (c) => (c === 'ee' ? '🖐️🖐️' : '🖐️'),
  bossName: 'The Belly',
  gags: GAGS,
  make(stage, { boss = false } = {}) {
    stage.className = `stage scene-pt${boss ? ' boss' : ''}`;
    const theme = nextTheme();
    const kind = nextHand();
    stage.dataset.theme = theme.id;
    stage.dataset.hand = kind;
    preload();

    const cam = h('div', 'pt-cam');
    const bg = h('div', 'pt-bg');
    theme.deco?.(bg);
    const glow = h('div', 'pt-glow');
    const meter = h('div', 'pt-meter');
    meter.innerHTML = METER; // fixed markup
    fitSigns(meter);
    /* The Pug: a Meissen porcelain box in the form of a pug's head (c. 1750) on a pedestal,
       with googly eyes and a ventriloquist's jaw. */
    const pug = h('div', 'pt-pug');
    const pIn = h('div', 'p-in');
    pIn.append(h('i', 'p-mouth'), photo('pug', 'p-jaw'), photo('pug', 'p-top'), googly(27.5, 45, 17), googly(70.5, 44.5, 17));
    pug.append(pIn, h('i', 'pt-plinth'), h('b', 'pt-plate', theme.plate));
    const lights = h('div', 'ms-lights pt-lights');
    lights.append(h('i', 'l'), h('i', 'r'));
    /* The ride: the seat and whoever is on it, so a boat can rock and the Moon can float. */
    const ride = h('div', 'pt-ride');
    const seat = h('div', 'pt-seat');
    seat.innerHTML = boss ? OTTOMAN : theme.seat; // fixed markup
    const front = !boss && theme.front ? h('div', 'pt-seat pt-front') : null;
    if (front) { front.innerHTML = theme.front; fitSigns(front); } // fixed markup
    const cat = rigMookie();
    cat.el.classList.add('pt-mookie');
    const rusty = boss ? rigCat('rusty') : null;
    const sign = boss ? h('div', 'pt-sign') : null;
    if (boss) {
      rusty.el.classList.add('pt-rusty');
      sign.innerHTML = SIGN; // fixed markup
      fitSigns(sign);
      ride.append(seat, sign, rusty.el);
    } else {
      ride.append(seat, cat.el);
      if (front) ride.append(front);
    }
    /* The hand. */
    const H = HANDS[kind];
    const hand = h('div', `pt-hand k-${kind}`);
    const palm = h('div', 'pt-palm');
    palm.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="pt-art">${H.art}</g>${EXTRAS}</svg>`; // fixed markup
    if (H.photo) palm.append(photo(H.photo, 'pt-hand-photo'));
    hand.append(palm);
    hand.style.transformOrigin = `${H.at[0]}% ${H.at[1]}%`;
    /* A Han dynasty dog (China, 25-220 CE) who howls along at big combos. */
    const howl = h('div', 'pt-howl');
    howl.append(photo('han-dog'), googly(26, 23, 9), googly(40, 21.5, 9));
    const fx = h('div', 'ms-fx pt-fx');
    const speed = h('div', 'ms-speed');
    cam.append(bg, glow, meter, pug, lights, ride);
    if (boss) cam.append(cat.el);
    cam.append(howl, hand);
    stage.append(cam, speed, fx);

    const who = boss ? rusty : cat; // whoever is being petted
    let hits = 0;
    let busy = false;
    let notes = 0;
    let purr = 0.12;
    let side = 1;
    let unpurr = 0;
    let kicking = 0;
    let howling = false;
    let cool = false; // shades on, whatever the combo
    const wants = []; // the hearts over his head: { el, full }
    const box = () => stage.getBoundingClientRect();
    const centre = (el, fx0 = 0.5, fy = 0.5) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width * fx0, y: r.top + r.height * fy };
    };
    const local = (p) => {
      const b = box();
      return { x: p.x - b.left, y: p.y - b.top };
    };
    const page = (p) => {
      const b = box();
      return { x: p.x + b.left, y: p.y + b.top };
    };
    /* A point on a rigged cat (its own 200 x 222 drawing), on the page: wherever he has been
       turned, tipped or stretched to. Mookie: 100 41 the top of his head, 100 100 his mouth,
       100 160 his belly. */
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
    function comic(text, at, cls = '') {
      const p = local(at);
      const c = h('b', `ms-comic ${cls}`, text);
      c.style.left = `${clampX(p.x, cls.includes('big') ? 0.3 : 0.16)}px`;
      c.style.top = `${Math.max(30, p.y)}px`;
      c.style.setProperty('--rot', `${(Math.random() * 16 - 8).toFixed(1)}deg`);
      fx.append(c);
      later(900, () => c.remove());
      return c;
    }
    function dust(at, n = 6, cls = '') {
      const p = local(at);
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
    function bubble(text, at) {
      const p = local(at);
      const b = h('div', 'ms-bubble', text);
      b.style.left = `${clampX(p.x)}px`;
      b.style.top = `${Math.max(34, p.y)}px`;
      fx.append(b);
      later(700, () => b.remove());
    }
    /* A note of the call: its syllable added to the call's bubble, or a word on its own. */
    function say(i, syl, word, at) {
      if (!syl) { bubble(word, at); return; }
      const p = local(at);
      callBubble(fx, i, syl, p.x, Math.max(34, p.y));
    }
    function punch(at, scale = 1.15, ms = 520) {
      const p = local(at);
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
    function cutaway(mood = 'star', ms = 420, setup = null) {
      const cut = h('div', `ms-cut pt-cut ${mood}`);
      cut.append(h('div', 'ms-cut-lines'));
      const big = rigMookie();
      big.el.classList.add('ms-cut-face');
      setup?.(big);
      big.mood(mood);
      cut.append(big.el);
      stage.append(cut);
      later(ms, () => cut.classList.add('out'));
      later(ms + 160, () => cut.remove());
      return big;
    }
    /* Fly something along an arc, from one point to another (stage px). */
    function fling(el, from, to, ms = 380, lift = 70, spin = 360) {
      fx.append(el);
      const w = el.getBoundingClientRect().width || 40;
      const hgt = el.getBoundingClientRect().height || 20;
      el.style.left = `${to.x - w / 2}px`;
      el.style.top = `${to.y - hgt / 2}px`;
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      return el.animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(0) scale(.6)` },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) rotate(${spin * 0.55}deg) scale(1)`, offset: 0.55 },
        { transform: `translate(0, 0) rotate(${spin}deg) scale(1)` },
      ], { duration: ms, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'both' });
    }

    /* ---- hearts ---- */

    function heartEl(cls) {
      const el = h('i', `pt-heart ${cls}`);
      el.innerHTML = HEART; // fixed markup
      return el;
    }
    /* A little heart that floats up and away from a point (page px). */
    function puff(at, big = false) {
      const p = local(at);
      const el = heartEl(`puff${big ? ' big' : ''}`);
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.setProperty('--dx', `${(Math.random() * 2 - 1) * 30}px`);
      el.style.setProperty('--rot', `${(Math.random() * 40 - 20).toFixed(0)}deg`);
      fx.append(el);
      later(800, () => el.remove());
    }
    /* Hearts in every direction. */
    function burst(at, n = 10) {
      const p = local(at);
      const w = box().width;
      for (let i = 0; i < n; i++) {
        const el = heartEl('fly');
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const d = w * (0.12 + Math.random() * 0.16);
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
        el.style.setProperty('--dx', `${(Math.cos(a) * d).toFixed(0)}px`);
        el.style.setProperty('--dy', `${(Math.sin(a) * d * 0.8 - 20).toFixed(0)}px`);
        el.style.setProperty('--rot', `${(Math.random() * 60 - 30).toFixed(0)}deg`);
        el.style.setProperty('--s', (0.7 + Math.random() * 0.8).toFixed(2));
        fx.append(el);
        later(900, () => el.remove());
      }
    }
    /* A note of the call asks for a pet: an empty heart, in an arc over his head. */
    function want() {
      const k = wants.length;
      const col = k % 6;
      const row = Math.floor(k / 6);
      const c = local(boss ? rigPt(rusty, 100, 150) : rigPt(cat, 100, 78));
      const w = who.el.offsetWidth;
      const a = Math.PI * (0.87 - 0.6 * (col / 5)); // from his left round to his right
      const r = w * (0.6 + row * 0.2);
      const el = heartEl('want');
      el.style.left = `${clampX(c.x + Math.cos(a) * r, 0.05)}px`;
      el.style.top = `${Math.max(18, c.y - Math.sin(a) * r * 0.92)}px`;
      el.style.setProperty('--rot', `${((0.5 - col / 5) * -40).toFixed(0)}deg`);
      fx.append(el);
      wants.push({ el, full: false });
    }
    /* A pet fills the next heart; with none left, a spare one floats off the hand. */
    function love(at) {
      const next = wants.find((x) => !x.full);
      if (next) {
        next.full = true;
        next.el.classList.add('full');
        bump(next.el, 'pop');
      } else puff(at);
    }
    function clearWants(how) {
      wants.splice(0).forEach((x, i) => {
        later(i * 30, () => x.el.classList.add(how));
        later(700 + i * 30, () => x.el.remove());
      });
    }
    function setPurr(n) {
      purr = Math.max(0, Math.min(1, n));
      meter.style.setProperty('--purr', purr.toFixed(2));
    }

    /* ---- the Pug ---- */

    let talkBusy = 0;
    function pugSay(text, mood = 'sing', ms = 800) {
      if (!pug.offsetWidth) return; // no room for him on this screen
      clearTimeout(talkBusy);
      pug.classList.remove('tsk', 'sing', 'nod');
      jiggle(pug);
      void pug.offsetWidth;
      pug.classList.add(mood);
      const flaps = mood === 'tsk' ? 3 : 1;
      for (let k = 0; k < flaps; k++) {
        later(40 + k * 150, () => { pug.classList.add('talk'); jiggle(pug); });
        later(130 + k * 150, () => pug.classList.remove('talk'));
      }
      if (text) later(40, () => bubble(text, centre(pug, 0.5, 0.02)));
      talkBusy = later(ms, () => pug.classList.remove('tsk', 'sing', 'nod'));
    }

    /* ---- the hand ---- */

    /* Where the hand's touching spot rests, and the transform that puts it on a stage point. */
    const restAt = () => ({ x: hand.offsetLeft + (hand.offsetWidth * H.at[0]) / 100, y: hand.offsetTop + (hand.offsetHeight * H.at[1]) / 100 });
    const RESTING = `rotate(${REST}deg)`;
    const tf = (p, a = 0) => {
      const r = restAt();
      return `translate(${(p.x - r.x).toFixed(1)}px, ${(p.y - r.y).toFixed(1)}px) rotate(${a}deg)`;
    };
    function moving(keys, opts) {
      const now = getComputedStyle(hand).transform;
      hand.getAnimations().forEach((a) => { if (a.id === 'move') a.cancel(); });
      const an = hand.animate(keys(now === 'none' ? RESTING : now), opts);
      an.id = 'move';
      return an;
    }
    /* Move the hand to a stage point from wherever it is, and leave it there. */
    function handTo(p, a = 0, ms = 200, easing = 'cubic-bezier(.3,.7,.4,1)') {
      return moving((now) => [{ transform: now }, { transform: tf(p, a) }], { duration: ms, easing, fill: 'forwards' });
    }
    function handHome(ms = 220) {
      return moving((now) => [{ transform: now }, { transform: RESTING }], { duration: ms, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    }
    /* A wave goodbye. */
    function wave(n = 3) {
      hand.animate([{ rotate: '0deg' }, { rotate: '16deg' }, { rotate: '-10deg' }, { rotate: '0deg' }], { duration: 260, iterations: n, easing: 'ease-in-out' });
    }
    /* One pet: down onto the spot, a short stroke, and back up. `to` is a stage point; left
       out, it's the top of Mookie's head (or Rusty's belly), a little to one side then the
       other. Returns where the hand lands and when (ms). */
    function petOnce({ to = null, ms = 190, quiet = false, deep = 1, target = who, hearts = true } = {}) {
      const s = (side = -side);
      const p = to || local(boss ? rigPt(rusty, 100 + s * 13, 158) : rigPt(cat, 100 + s * 13, 46));
      const lift = who.el.offsetHeight * 0.11;
      moving(() => [
        { transform: RESTING },
        { transform: tf({ x: p.x, y: p.y - lift }, s * 5), offset: 0.26 },
        { transform: tf(p, s * 3), offset: 0.44 },
        { transform: tf({ x: p.x + s * lift * 0.9, y: p.y + lift * 0.4 }, s * 15), offset: 0.74 },
        { transform: RESTING },
      ], { duration: ms, easing: 'ease-in-out' });
      toon('pat', undefined, { vol: quiet ? 0.6 : 1, rate: 0.9 + Math.random() * 0.3 });
      later(ms * 0.44, () => {
        bump(hand, 'pat');
        target?.press(deep);
        if (hearts) love(page(p));
      });
      return { x: p.x, y: p.y, at: ms * 0.44 };
    }

    /* Rusty's legs: a kick every `ms` (0 stops them). */
    function kick(ms) {
      clearInterval(kicking);
      if (!ms) return;
      kicking = setInterval(() => {
        if (!rusty.el.isConnected) { clearInterval(kicking); return; }
        rusty.step(1);
      }, ms);
    }

    // Starting poses.
    setPurr(purr);
    if (boss) {
      cat.mood('hunt');
      cat.look(1, -0.3);
      rusty.mood('smug');
      rusty.look(0, 0.6);
    } else {
      cat.mood('idle');
      cat.look(0.5, -0.5);
    }

    return {
      onCall(i, syl) {
        if (busy) return;
        notes++;
        want();
        if (boss) {
          // Rusty mrrps the call and waves a paw: go on, then.
          rusty.say(200, 'open');
          rusty.step(1);
          bump(rusty.el, 'taunt');
          say(i, syl, 'mrrp', centre(rusty.el, 0.5, 0.98));
          return;
        }
        // The Pug barks each note; Mookie's tail thumps along.
        pugSay(syl ? null : 'arf!', 'sing', 600);
        if (syl) later(40, () => say(i, syl, null, centre(pug, 0.5, 0.02)));
        toon('arf', undefined, { vol: 0.5, rate: 0.9 + (notes % 3) * 0.14 });
        cat.thump();
        cat.look(-1, 0.1);
      },
      onTap() {
        if (busy) return;
        const p = petOnce({ ms: boss ? 180 : 190 });
        later(p.at, () => {
          if (busy) return;
          setPurr(purr + 0.11);
          if (boss) { bump(rusty.el, 'flinch'); return; }
          cat.mood('purr');
          clearTimeout(unpurr);
          unpurr = later(380, () => { if (!busy) { cat.mood('idle'); cat.look(0.5, -0.5); } });
        });
        if (Math.random() < 0.4) later(100, () => toon('purr', undefined, { vol: 0.6 }));
      },
      onBeat(down, spb, tier = 0) {
        stage.dataset.tier = tier;
        cat.beat(down, spb, tier);
        if (cool) cat.svg.classList.add('shades');
        rusty?.beat(down, spb, tier);
        // Everything that moves with the beat hangs on this: the Pug, the meter, and each
        // place's own things (a lamp, a string of bulbs, the Earth, a boat).
        stage.dataset.beat = down ? 'a' : 'b';
        if (tier >= 2 && !howling && !busy && !boss) {
          howling = true;
          howl.classList.add('up');
          toon('howl', undefined, { vol: 0.6 });
          later(200, () => bubble('aroo!', centre(howl, 0.3, 0.1)));
        }
        if (howling && down) { bump(howl, 'sing'); jiggle(howl); }
        if (tier >= 3) lights.className = `ms-lights pt-lights on ${down ? 'a' : 'b'}`;
        else lights.className = 'ms-lights pt-lights';
        if (tier >= 4 && !busy) {
          // It rains hearts.
          const w = box().width;
          for (let k = 0; k < 3; k++) {
            const el = heartEl('rain');
            el.style.left = `${Math.random() * w}px`;
            el.style.setProperty('--s', (0.6 + Math.random() * 0.7).toFixed(2));
            el.style.setProperty('--rot', `${(Math.random() * 60 - 30).toFixed(0)}deg`);
            fx.append(el);
            later(1300, () => el.remove());
          }
        }
        jiggle(stage);
      },
      /* Boss rounds: a hit is a proper belly rub; a miss and he nips the hand. */
      hit() {
        hits++;
        const p = petOnce({ ms: 250, deep: 1.4 });
        later(125, () => petOnce({ ms: 230, quiet: true, deep: 1.2 }));
        later(250, () => {
          const at = rigPt(rusty, 100, 150);
          rusty.mood('happy');
          bump(rusty.el, 'rubbed');
          kick([0, 360, 230, 150, 110][Math.min(4, hits)]);
          comic(['RUB RUB!', 'SCRITCH!', 'RUBBA RUBBA!', 'BELLY!'][(hits - 1) % 4], { x: at.x, y: at.y - 46 }, 'hit');
          burst(at, 7);
          punch(at, 1.08, 380);
          toon('purr', undefined, { vol: 1.1, rate: 0.8 });
          sign.style.setProperty('--tilt', `${hits * 8}deg`);
          bump(sign, 'wob');
          cat.mood('star');
          setPurr(0.2 + hits * 0.22);
        });
        later(850, () => { rusty.mood('smug'); cat.mood('hunt'); });
        return p;
      },
      miss() {
        const belly = rigPt(rusty, 100, 150);
        handTo(local(belly), 4, 150);
        later(160, () => {
          rusty.reach(belly.x, belly.y, 0.5);
          rusty.mood('eat');
          toon('chomp', undefined, { vol: 0.9 });
          comic('NOM.', { x: belly.x, y: belly.y - 40 }, 'love');
          bump(palm, 'shake');
          cat.mood('shock');
        });
        later(620, () => { toon('pop', undefined, { vol: 0.9 }); handHome(240); rusty.mood('smug'); bump(rusty.el, 'taunt'); });
        later(1000, () => cat.mood('hunt'));
      },
      win(force) {
        busy = true;
        clearTimeout(unpurr);
        if (boss) return bossKO();
        clearWants('up');
        const gag = winGag(force);
        if (gag === 'puddle') return winPuddle();
        if (gag === 'motor') return winMotor();
        if (gag === 'long') return winLong();
        if (gag === 'biscuits') return winBiscuits();
        if (gag === 'copter') return winCopter();
        return winHappy();
      },
      fail(force) {
        busy = true;
        clearTimeout(unpurr);
        if (boss) return bossLose();
        clearWants('drop');
        const gag = failGag(force);
        if (gag === 'trap') return failTrap();
        if (gag === 'slurp') return failSlurp();
        if (gag === 'bones') return failBones();
        if (gag === 'cactus') return failCactus();
        return failChomp();
      },
    };

    /* ---------------- wins ---------------- */

    /* The needle hits MAX and hearts go everywhere. */
    function maxed(delay = 0, say = 'PURRRR!') {
      later(delay, () => {
        const at = rigPt(cat, 100, 90);
        setPurr(1);
        meter.classList.add('max');
        toon('ting', undefined, { vol: 1 });
        toon('purr', undefined, { vol: 1.3 });
        burst(at, 12);
        if (say) comic(say, rigPt(cat, 100, 10), 'big');
      });
    }
    /* Pure joy. Then the Pug finally gets his pat. */
    function winHappy() {
      const big = Math.random() < 0.4;
      if (big) {
        cutaway('star', 360);
        toon('pep', undefined, { vol: 0.8 });
      }
      const d = big ? 300 : 0;
      later(d, () => petOnce({ ms: 170 }));
      later(d + 110, () => petOnce({ ms: 170, quiet: true }));
      maxed(d + 250);
      later(d + 250, () => { cat.mood('star'); cat.hop(0.7); if (big) flashSpeed('gold'); });
      later(d + 640, () => {
        const top = local(centre(pug, 0.5, 0.06));
        petOnce({ to: top, ms: 320, target: null, hearts: false });
      });
      later(d + 780, () => {
        bump(pug, 'patted');
        toon('arf', undefined, { vol: 0.9, rate: 1.3 });
        puff(centre(pug, 0.5, 0), true);
        pugSay('finally.', 'nod', 900);
        cat.mood('purr');
      });
    }
    /* So relaxed he melts: a puddle of cat with a face. */
    function winPuddle() {
      petOnce({ ms: 180 });
      later(120, () => petOnce({ ms: 200, quiet: true, deep: 1.6 }));
      const pud = h('div', 'pt-puddle');
      pud.innerHTML = PUDDLE; // fixed markup
      later(260, () => {
        cat.mood('purr');
        toon('slide-down', undefined, { vol: 0.9 });
        cat.el.style.transformOrigin = '50% 94%';
        cat.el.animate([{ transform: 'none' }, { transform: 'scale(1.2, .7)', offset: 0.4 }, { transform: 'scale(1.7, .2)' }],
          { duration: 420, easing: 'cubic-bezier(.4,0,.5,1)', fill: 'forwards' });
        setPurr(1);
        meter.classList.add('max');
      });
      later(640, () => {
        const r = cat.el.getBoundingClientRect();
        const p = local({ x: r.left + r.width / 2, y: r.bottom });
        const w = cat.el.offsetWidth * 1.55;
        pud.style.width = `${w}px`;
        pud.style.left = `${p.x - w / 2}px`;
        pud.style.top = `${p.y - w * (76 / 240) * 0.93}px`;
        ride.insertBefore(pud, cat.el.nextSibling);
        cat.el.style.visibility = 'hidden';
        pud.animate([{ scale: '.85 .5' }, { scale: '1.08 1.15', offset: 0.5 }, { scale: '1 1' }], { duration: 260, easing: 'ease-out' });
        toon('boing', undefined, { vol: 0.8, rate: 0.7 });
      });
      later(820, () => {
        toon('purr', undefined, { vol: 1.3 });
        comic('MELTED.', centre(pud, 0.5, -1.4), 'big');
        burst(centre(pud, 0.5, 0.3), 8);
      });
      later(1080, () => {
        // A poke. He ripples.
        petOnce({ to: local(centre(pud, 0.42, 0.5)), ms: 260, target: null, hearts: false });
        later(120, () => {
          pud.animate([{ scale: '1 1' }, { scale: '1.1 .7' }, { scale: '.94 1.2' }, { scale: '1.03 .95' }, { scale: '1 1' }], { duration: 380, easing: 'ease-out' });
          toon('boing', undefined, { vol: 0.6, rate: 1.4 });
          bubble('prrrr', centre(pud, 0.5, -0.5));
        });
      });
      later(1300, () => pugSay('he does that.', 'nod', 800));
    }
    /* He purrs so hard the motor catches. A motorbike turns up under him and he's off. */
    function winMotor() {
      petOnce({ ms: 180 });
      later(140, () => {
        stage.classList.add('pt-rumble');
        toon('vroom', undefined, { vol: 1.1 });
        cat.mood('star');
        comic('VRRRRRR', rigPt(cat, 100, 20), 'hit');
        setPurr(1);
        meter.classList.add('max');
      });
      const puffs = setInterval(() => { if (cat.el.isConnected) dust(rigPt(cat, 40, 196), 2); }, 90);
      later(1500, () => clearInterval(puffs));
      const bike = h('div', 'pt-bike');
      bike.innerHTML = BIKE; // fixed markup
      later(420, () => {
        const r = cat.el.getBoundingClientRect();
        const p = local({ x: r.left + r.width / 2, y: r.bottom });
        bike.style.width = `${r.width * 1.3}px`;
        bike.style.left = `${p.x - r.width * 0.65}px`;
        bike.style.top = `${p.y - r.width * 0.65 * 0.42}px`;
        ride.insertBefore(bike, cat.el);
        bike.animate([{ translate: '-90cqw 0' }, { translate: '0 0' }], { duration: 220, easing: 'cubic-bezier(.2,1.2,.5,1)' });
        toon('zip', undefined, { vol: 0.9 });
      });
      later(660, () => {
        cool = true;
        cat.svg.classList.add('shades');
        cat.mood('smug');
        cat.hop(0.5);
        toon('pop', undefined, { vol: 0.9 });
        comic('LATER!', rigPt(cat, 100, 0), 'big');
      });
      later(860, () => {
        const go = [{ translate: '0 0', rotate: '0deg' }, { translate: '6cqw -2%', rotate: '-9deg', offset: 0.25 }, { translate: '120cqw -4%', rotate: '-12deg' }];
        const o = { duration: 620, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' };
        cat.el.animate(go, o);
        bike.animate(go, o);
        toon('vroom', undefined, { vol: 1.2, rate: 1.5 });
        flashSpeed('gold');
        wave(3);
      });
      later(1100, () => burst(centre(stage, 0.8, 0.6), 8));
      later(1350, () => { stage.classList.remove('pt-rumble'); pugSay('show-off.', 'tsk', 800); });
    }
    /* Every pet makes him longer. Long cat is long. */
    function winLong() {
      petOnce({ ms: 180 });
      const r = cat.el.getBoundingClientRect();
      const b = box();
      // As tall as the stage lets him: his ears stop just under the top edge.
      const grow = Math.max(r.height * 0.3, r.top - b.top - r.height * 0.02);
      const body = h('div', 'pt-long');
      body.style.left = `${r.left - b.left + r.width * 0.29}px`;
      body.style.width = `${r.width * 0.42}px`;
      body.style.bottom = `${b.bottom - r.bottom + r.height * 0.07}px`;
      body.style.height = `${r.height * 0.14}px`;
      ride.insertBefore(body, cat.el);
      later(170, () => {
        const o = { duration: 560, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'forwards' };
        toon('slide-up', undefined, { vol: 0.9 });
        cat.mood('shock');
        cat.el.animate([{ translate: '0 0' }, { translate: `0 ${-grow}px` }], o);
        body.animate([{ height: `${r.height * 0.14}px` }, { height: `${r.height * 0.14 + grow}px` }], o);
        handTo({ x: restAt().x, y: restAt().y - grow * 0.2 }, REST, 300);
      });
      later(760, () => {
        toon('boing', undefined, { vol: 1 });
        cat.mood('purr');
        comic('LOOOONG CAT', centre(stage, 0.5, 0.42), 'big');
        setPurr(1);
        meter.classList.add('max');
      });
      // One long stroke, all the way down.
      later(960, () => {
        const top = local(centre(body, 0.8, 0.24));
        const low = local(centre(body, 0.8, 0.92));
        handTo(top, 6, 160);
        later(170, () => handTo(low, 14, 380, 'ease-in-out'));
        for (let k = 0; k < 5; k++) later(200 + k * 70, () => puff(page({ x: top.x, y: top.y + ((low.y - top.y) * k) / 4 })));
        toon('purr', undefined, { vol: 1.2 });
      });
      later(1560, () => { handHome(260); pugSay('how.', 'tsk', 800); });
    }
    /* He makes biscuits. Real ones. */
    function winBiscuits() {
      petOnce({ ms: 180 });
      later(160, () => { cat.mood('purr'); comic('knead knead', rigPt(cat, 100, 20), 'hit'); });
      for (let k = 0; k < 5; k++) {
        later(200 + k * 100, () => {
          cat.knead(k % 2 ? 1 : -1);
          toon('pat', undefined, { vol: 0.9, rate: 0.7 + (k % 2) * 0.2 });
          dust(rigPt(cat, k % 2 ? 70 : 130, 198), 2);
        });
      }
      const tray = h('div', 'pt-tray');
      tray.innerHTML = TRAY; // fixed markup
      later(720, () => {
        const r = cat.el.getBoundingClientRect();
        const p = local({ x: r.left + r.width * 0.5, y: r.bottom });
        tray.style.width = `${r.width * 0.95}px`;
        tray.style.left = `${p.x - r.width * 0.475}px`;
        tray.style.top = `${p.y - r.width * 0.95 * (80 / 170) * 0.72}px`;
        fx.append(tray);
        toon('ding', undefined, { vol: 1 });
        tray.animate([{ translate: '0 30%', scale: '.2' }, { translate: '0 0', scale: '1' }], { duration: 260, easing: 'cubic-bezier(.3,1.7,.5,1)' });
      });
      later(960, () => {
        cat.mood('star');
        cat.hop(0.6);
        comic('BISCUITS!', rigPt(cat, 100, 0), 'big');
        burst(centre(tray, 0.5, 0.3), 8);
        setPurr(1);
        meter.classList.add('max');
      });
      later(1280, () => pugSay('...for me?', 'nod', 900));
    }
    /* A propeller beanie. Up he goes. */
    function winCopter() {
      petOnce({ ms: 180 });
      const cap = h('div', 'pt-beanie');
      cap.innerHTML = BEANIE; // fixed markup
      later(170, () => {
        cat.el.append(cap);
        toon('pop', undefined, { vol: 1 });
        cat.mood('shock');
        comic('?!', rigPt(cat, 150, 20), 'hit');
      });
      later(400, () => {
        cap.classList.add('spin');
        toon('rotor', undefined, { vol: 1 });
        cat.mood('star');
        setPurr(1);
        meter.classList.add('max');
      });
      later(560, () => {
        dust(centre(cat.el, 0.5, 0.95), 8);
        comic('LIFTOFF!', centre(stage, 0.5, 0.5), 'big');
        cat.el.animate([
          { translate: '0 0', rotate: '0deg' }, { translate: '3% -14%', rotate: '-5deg', offset: 0.3 },
          { translate: '-4% -55%', rotate: '6deg', offset: 0.62 }, { translate: '5% -260%', rotate: '-7deg' },
        ], { duration: 1000, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'forwards' });
        wave(4);
      });
      for (let k = 0; k < 7; k++) later(700 + k * 90, () => { if (cat.el.isConnected) puff(rigPt(cat, 60 + Math.random() * 80, 200)); });
      later(1150, () => { jiggle(pug); pugSay('come back!', 'sing', 900); });
    }

    /* ---------------- misses: he bites, and he couldn't be happier ---------------- */

    /* The wiggle before the pounce, the hand coming in for a pet, and the bite: the hand ends
       up in his mouth (fingers out of sight), cheeks full, eyes shut with joy. Returns when
       (ms) the bite lands. */
    function nom(d = 0) {
      later(d, () => {
        cat.mood('hunt');
        cat.look(0.6, -0.8);
        bump(cat.el, 'wiggle');
        toon('tiptoe', undefined, { vol: 0.7 });
        handTo(local(rigPt(cat, 112, 14)), 4, 230);
      });
      later(d + 150, () => toon('tiptoe', undefined, { vol: 0.7, rate: 1.2 }));
      later(d + 250, () => {
        const mouth = rigPt(cat, 100, 96);
        cat.hop(1);
        cat.mood('eat');
        toon('chomp', undefined, { vol: 1 });
        hand.classList.add('bitten');
        handTo(local(mouth), 0, 80);
        comic('NOM!', rigPt(cat, 150, 30), 'big love');
        flashSpeed();
        setPurr(0.5);
      });
      return d + 250;
    }
    function chew(at, n = 2) {
      for (let k = 0; k < n; k++) {
        later(at + k * 190, () => {
          bump(cat.el, 'nomming');
          bump(palm, 'shake');
          toon('chomp', undefined, { vol: 0.6, rate: 1.2 });
        });
      }
    }
    /* The hand pops free and backs off. */
    function letGo(at, then) {
      later(at, () => {
        const r = restAt();
        toon('pop', undefined, { vol: 1 });
        hand.classList.remove('bitten');
        handTo({ x: r.x + hand.offsetWidth * 0.1, y: r.y + hand.offsetHeight * 0.25 }, 8, 180, 'cubic-bezier(.3,1.6,.5,1)');
        then?.();
      });
    }
    /* A love bite. The hand throbs and gets a very large bandage; Mookie is thrilled. */
    function failChomp() {
      const big = Math.random() < 0.35;
      if (big) cutaway('hunt', 340);
      const t = nom(big ? 300 : 0);
      chew(t + 130, 2);
      letGo(t + 560, () => {
        hand.classList.add('ouch');
        cat.mood('smug');
        cat.hop(0.4);
        comic('love bite!', centre(hand, 0.3, 1.1), 'love');
      });
      later(t + 800, () => { toon('purr', undefined, { vol: 1 }); bubble('hee hee', rigPt(cat, 100, 30)); });
      later(t + 1050, () => pugSay('classic.', 'nod', 800));
    }
    /* He flops over and shows the belly. It is a trap. It has always been a trap. */
    function failTrap() {
      cat.el.style.transformOrigin = '50% 82%';
      cat.el.animate([{ transform: 'none' }, { transform: 'rotate(-112deg)', offset: 0.7 }, { transform: 'rotate(-98deg)' }],
        { duration: 300, easing: 'ease-out', fill: 'forwards' });
      cat.mood('purr');
      toon('boing', undefined, { vol: 0.8 });
      later(140, () => {
        const belly = rigPt(cat, 100, 158);
        comic('belly?', { x: belly.x, y: belly.y - cat.el.offsetHeight * 0.3 }, 'hit');
        for (let k = 0; k < 3; k++) later(k * 70, () => puff(rigPt(cat, 80 + k * 20, 150)));
      });
      later(330, () => handTo(local(rigPt(cat, 100, 156)), 0, 240));
      later(590, () => {
        const belly = rigPt(cat, 100, 156);
        cat.reach(belly.x, belly.y, 2.2);
        cat.mood('eat');
        cat.hop(0.5);
        toon('chomp', undefined, { vol: 1 });
        comic('GOTCHA!', centre(stage, 0.5, 0.3), 'big love');
        flashSpeed();
        setPurr(0.5);
      });
      for (let k = 0; k < 4; k++) {
        later(700 + k * 110, () => {
          bump(cat.el, 'kicks');
          bump(palm, 'shake');
          toon('boing', undefined, { vol: 0.5, rate: 1.5 + (k % 2) * 0.3 });
        });
      }
      later(860, () => comic('kick kick kick', rigPt(cat, 100, 215), 'hit'));
      later(1200, () => { toon('purr', undefined, { vol: 1.1 }); bubble('mine.', rigPt(cat, 100, 60)); });
      later(1350, () => pugSay('every time.', 'tsk', 800));
    }
    /* He doesn't stop at the hand: the whole arm goes in like a noodle. Then a burp. */
    function failSlurp() {
      const t = nom();
      later(t + 170, () => {
        toon('slurp', undefined, { vol: 1.1 });
        comic('SLUUURP', rigPt(cat, 150, 60), 'hit');
        bump(cat.el, 'nomming');
        hand.animate([{ scale: '1' }, { scale: '.02' }], { duration: 480, easing: 'cubic-bezier(.6,0,.9,.5)', fill: 'forwards' });
      });
      later(t + 660, () => { hand.style.visibility = 'hidden'; bump(cat.el, 'nomming'); });
      later(t + 860, () => {
        const mouth = rigPt(cat, 100, 96);
        toon('burp', undefined, { vol: 1 });
        cat.mood('happy');
        comic('BURP.', { x: mouth.x, y: mouth.y - cat.el.offsetHeight * 0.5 }, 'big love');
        // All that comes back is the hand, at speed.
        const back = h('div', `pt-hand pt-spat k-${kind}`);
        back.innerHTML = palm.outerHTML; // fixed markup (the same hand)
        const b = box();
        fling(back, local(mouth), { x: b.width * 0.86, y: -b.height * 0.25 }, 520, 40, 540);
      });
      later(t + 1120, () => { cat.mood('smug'); bubble('excuse me.', rigPt(cat, 100, 30)); });
      later(t + 1280, () => pugSay('gross.', 'tsk', 800));
    }
    /* The hand comes back as bones. It gives a little wave. It's fine. */
    function failBones() {
      const t = nom();
      chew(t + 130, 2);
      letGo(t + 540, () => {
        hand.classList.add('bones');
        toon('bones', undefined, { vol: 1 });
        cat.mood('smug');
        cat.hop(0.4);
        comic('RATTLE', centre(hand, 0.3, 1.15), 'hit');
      });
      later(t + 780, () => { bump(palm, 'rattle'); toon('bones', undefined, { vol: 0.7, rate: 1 }); });
      later(t + 900, () => bubble("it's fine.", centre(hand, 0.2, 0.9)));
      later(t + 1150, () => pugSay('spooky.', 'nod', 800));
    }
    /* Just as the hand lands he is, for one second, a cactus. A very pleased cactus. */
    function failCactus() {
      handTo(local(rigPt(cat, 110, 0)), 4, 260);
      const cac = h('div', 'pt-cactus');
      cac.innerHTML = CACTUS; // fixed markup
      later(180, () => {
        dust(centre(cat.el, 0.5, 0.5), 12);
        toon('pop', undefined, { vol: 1.1 });
        cat.el.append(cac);
        cat.el.classList.add('cactus');
      });
      later(300, () => handTo(local(rigPt(cat, 106, 34)), 2, 90, 'ease-in'));
      later(400, () => {
        const r = restAt();
        toon('zap', undefined, { vol: 0.7 });
        toon('squeak', undefined, { vol: 1 });
        comic('YOWCH!', centre(stage, 0.5, 0.3), 'big love');
        flashSpeed();
        hand.classList.add('spiny');
        handTo({ x: r.x + hand.offsetWidth * 0.1, y: r.y + hand.offsetHeight * 0.2 }, 10, 200, 'cubic-bezier(.3,1.6,.5,1)');
        bump(palm, 'shake');
        setPurr(0.5);
      });
      later(760, () => comic('a cactus?!', centre(hand, 0.3, 1.1), 'hit'));
      later(1020, () => {
        dust(centre(cat.el, 0.5, 0.5), 12);
        toon('pop', undefined, { vol: 1.1 });
        cat.el.classList.remove('cactus');
        cac.remove();
        // He keeps the flower.
        const bloom = h('div', 'pt-bloom');
        bloom.innerHTML = `<svg viewBox="-18 -18 36 36" aria-hidden="true">${FLOWER}</svg>`; // fixed markup
        cat.el.append(bloom);
        cat.mood('smug');
        cat.hop(0.5);
        toon('twinkle', undefined, { vol: 0.9 });
      });
      later(1200, () => { toon('purr', undefined, { vol: 1 }); bubble('hee hee', rigPt(cat, 100, 30)); });
      later(1350, () => pugSay('prickly.', 'tsk', 800));
    }

    /* ---------------- boss ---------------- */

    function bossKO() {
      // The rub he's been waiting for all along. All four legs go, and he pedals away.
      petOnce({ ms: 220, deep: 1.5 });
      later(110, () => petOnce({ ms: 200, quiet: true, deep: 1.5 }));
      later(220, () => petOnce({ ms: 200, quiet: true, deep: 1.5 }));
      later(260, () => {
        const at = rigPt(rusty, 100, 150);
        kick(70);
        rusty.mood('happy');
        rusty.el.classList.add('pedal');
        toon('purr', undefined, { vol: 1.4, rate: 0.8 });
        comic('RUBBA RUBBA RUBBA!', { x: at.x, y: at.y - 50 }, 'big');
        flashSpeed('gold');
        burst(at, 14);
        setPurr(1);
        meter.classList.add('max');
        cat.mood('star');
      });
      later(700, () => {
        toon('zip', undefined, { vol: 1.2 });
        toon('vroom', undefined, { vol: 0.9, rate: 1.6 });
        rusty.el.animate([{ translate: '0 0' }, { translate: '-4cqw 0', offset: 0.2 }, { translate: '130cqw 0' }],
          { duration: 640, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' });
        for (let k = 0; k < 5; k++) later(120 + k * 80, () => { if (rusty.el.isConnected) dust(centre(rusty.el, 0.2, 0.9), 3); });
        wave(3);
      });
      later(1000, () => {
        // The sign spins round.
        sign.classList.add('turned');
        toon('pop', undefined, { vol: 1 });
        cat.hop(0.8);
      });
      later(1250, () => {
        kick(0);
        const cup = photo('trophy', 'ms-trophy');
        const head = local(centre(cat.el, 0.5, 0));
        cup.style.left = `${head.x}px`;
        cup.style.top = `${head.y}px`;
        fx.append(cup);
        toon('choir', undefined, { vol: 1 });
        later(250, () => comic('CHAMPION!', { x: box().left + head.x + 40, y: box().top + head.y - 30 }, 'big'));
        pugSay('good belly.', 'nod', 1000);
      });
    }
    function bossLose() {
      // The belly was a trap. He hugs the hand, and falls asleep on it.
      const belly = rigPt(rusty, 100, 150);
      handTo(local(belly), 0, 200);
      later(220, () => {
        rusty.reach(belly.x, belly.y, 4);
        rusty.mood('eat');
        rusty.hop(0.6);
        toon('chomp', undefined, { vol: 1.1 });
        comic('GOTCHA!', centre(stage, 0.5, 0.3), 'big love');
        flashSpeed();
        cat.mood('shock');
        sign.style.setProperty('--tilt', '0deg');
        bump(sign, 'wob');
      });
      for (let k = 0; k < 3; k++) later(360 + k * 130, () => { bump(palm, 'shake'); bump(rusty.el, 'rubbed'); toon('boing', undefined, { vol: 0.5, rate: 1.5 }); });
      later(860, () => {
        kick(0);
        rusty.mood('sleepy');
        toon('snore', undefined, { vol: 1 });
        bubble('zzz', centre(rusty.el, 0.7, 0.75));
        comic('STUCK.', centre(hand, 0.3, -0.2), 'love');
      });
      later(1150, () => { bump(palm, 'shake'); cat.mood('smug'); toon('purr', undefined, { vol: 1, rate: 0.8 }); });
      later(1300, () => pugSay('told you.', 'tsk', 900));
    }
  },
};
