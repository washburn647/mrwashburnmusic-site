/* The learner's own avatar: a little animal they dress up with music notes (♪) earned in
   runs. One look per device, kept with the progress (store.js: st.look, st.owned,
   st.tokens). What there is and what it costs is shop.js; what it wears is wardrobe.js.
   The avatar is drawn in parts that move (avatar.css): ears, tail, wings, arms, legs, head,
   eyes that blink and look about, and a face for each mood. setMood() makes it cheer, droop,
   gasp, sing, play what it holds, dance or doze; beat() bounces it on the beat.
   Fixed markup only: nothing a learner types ever goes in here. */

import { HATS, GLASSES, NECKS, SHOES, PATTERNS, HOLDS, BGS, INK, PINK, BEAK, BEAK_D, star, heart, glint } from './wardrobe.js';
import { DEFAULT_LOOK } from './shop.js';

export {
  SLOTS, GROUPS, ITEMS, CATALOG, DEFAULT_LOOK, EARN, PRICES, priceOf, nameOf, owns, won, lookOf, cleanLook, keepLook,
  groovePrice, ownsGroove, itemOfSlot,
} from './shop.js';

// fur, belly, darker (ears, outlines, markings)
const COLORS = {
  orange: ['#e3893b', '#f7d9b0', '#b9682a'],
  black: ['#2e2e36', '#55555f', '#121216'],
  gray: ['#8d929c', '#d7d9de', '#5f636c'],
  cream: ['#efd9ac', '#fbf1db', '#c2a26a'],
  brown: ['#8c5a3a', '#d9b28f', '#5e3a24'],
  white: ['#f7f4ee', '#ffffff', '#c9c1b2'],
  red: ['#d9534f', '#f6d2cf', '#9e2f2b'],
  blue: ['#5b8fd9', '#cfe0f7', '#335f9f'],
  teal: ['#3fb0a6', '#c9efe9', '#23756e'],
  pink: ['#ee8fb2', '#fbd9e6', '#c25d85'],
  green: ['#6cbf6a', '#d6f0cf', '#3f8a3d'],
  purple: ['#9a6ad6', '#e3d3f6', '#6a42a3'],
  silver: ['#c3c8d2', '#eef0f4', '#7d8494'],
  gold: ['#e5b93a', '#fff0bf', '#a8800f'],
  rainbow: ['url(#R)', '#ffffff', '#7a4cb8'],
  galaxy: ['url(#G)', '#d9ccf6', '#2a1f5e'],
};

let uid = 0;

/* A ring of puffs (a mane, wool, a cloud of fur): n circles of radius r around (cx, cy) at distance d. */
const puffs = (cx, cy, d, r, n, fill, extra = '', from = 0, to = 360) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = ((from + (to - from) * (i + 0.5) / n) * Math.PI) / 180;
    s += `<circle cx="${(cx + d * Math.cos(a)).toFixed(1)}" cy="${(cy + d * Math.sin(a)).toFixed(1)}" r="${r}" fill="${fill}" ${extra}/>`;
  }
  return s;
};
const mirror = (s) => `${s}<g transform="translate(200 0) scale(-1 1)">${s}</g>`;
/* A left-side part and its mirror, each in its own group so they can move apart (ears, wings). */
const pair = (cls, s, at) => {
  if (!s) return '';
  const o = (x) => (at ? ` style="transform-origin:${x}px ${at[1]}px"` : '');
  return `<g class="${cls} l"${o(at?.[0])}>${s}</g><g class="${cls} r"${o(200 - at?.[0])}><g transform="translate(200 0) scale(-1 1)">${s}</g></g>`;
};

/* The animals. Each draws its own parts around one shared body and head (head at 100,88 r48;
   eyes at 83 and 117, y 86; nose at 100,100; right paw at 158,136), so every hat, pair of
   glasses and held thing fits all of them. c: { fur, belly, dark, ol (an outline), id }.
   Parts: tail and wings (behind the body; wings the left one only), feet, arm ('paw', 'wing',
   'flipper', 'hoof'), limbs (arm and leg color), body (marks on the body, clipped to it), ears
   (the left one, behind the head) and flaps (the left one, over it: a dog's), mane (behind the
   head), marks (on the head, clipped to it), over (on the head, before the face), nose (after
   the face), top (horns, tufts: before glasses and hats), whiskers. ear: where the left ear
   turns (its root); iris: the eyes' color. */
const KINDS = {
  cat: {
    nat: ['#e3893b', '#f7d9b0', '#a95c22'], ear: [72, 62], iris: '#7d9a2e',
    ears: ({ fur, ol }) => `<path d="M58 76 L54 22 L96 50 Z" fill="${fur}" ${ol}/><path d="M64 66 L62 34 L88 52 Z" fill="${PINK}"/><path d="M64 44 L70 52 M62 52 L68 56" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`,
    marks: ({ dark }) => `<g stroke="${dark}" stroke-width="5" stroke-linecap="round" opacity=".55"><path d="M90 42 L93 56"/><path d="M100 40 V57"/><path d="M110 42 L107 56"/></g>`
      + mirror(`<path d="M52 82 L62 84 M52 92 L60 92" stroke="${dark}" stroke-width="4" stroke-linecap="round" opacity=".45"/>`),
    over: ({ belly }) => `<ellipse cx="91" cy="106" rx="11" ry="8" fill="${belly}"/><ellipse cx="109" cy="106" rx="11" ry="8" fill="${belly}"/>`,
    whiskers: true,
    body: ({ dark }) => `<g stroke="${dark}" stroke-width="5" stroke-linecap="round" opacity=".4"><path d="M58 160 L70 164"/><path d="M57 172 L68 174"/><path d="M142 172 L132 174"/></g>`,
    tail: ({ fur, dark }) => `<path d="M68 200 Q28 206 24 172 Q22 148 40 138" stroke="${dark}" stroke-width="17" fill="none" stroke-linecap="round"/>`
      + `<path d="M68 200 Q28 206 24 172 Q22 148 40 138" stroke="${fur}" stroke-width="12" fill="none" stroke-linecap="round"/>`
      + `<path d="M30 190 l8 -6 M24 168 l10 0 M30 148 l8 4" stroke="${dark}" stroke-width="4" stroke-linecap="round" opacity=".5"/>`,
  },
  bunny: {
    nat: ['#d8c4a8', '#f7eee0', '#9c8262'], ear: [82, 60], iris: '#7a4a2a',
    ears: ({ fur, ol }) => `<g transform="rotate(-12 80 56)"><ellipse cx="80" cy="26" rx="15" ry="40" fill="${fur}" ${ol}/><ellipse cx="80" cy="30" rx="7.5" ry="29" fill="${PINK}"/><path d="M80 10 V44" stroke="#e48aa0" stroke-width="1.5" opacity=".6"/></g>`,
    over: ({ belly }) => `<ellipse cx="92" cy="106" rx="11" ry="9" fill="${belly}"/><ellipse cx="108" cy="106" rx="11" ry="9" fill="${belly}"/>`,
    nose: () => `<path d="M94 99 Q100 96 106 99 L100 105 Z" fill="${PINK}" stroke="#d1708a" stroke-width="1.2"/><path d="M96 113 H104 V120 Q100 122 96 120 Z" fill="#fff" stroke="#c9c1b2" stroke-width="1"/><path d="M100 113 V121" stroke="#c9c1b2" stroke-width="1"/>`,
    whiskers: true,
    tail: ({ belly, dark }) => puffs(52, 196, 7, 9, 6, belly, `stroke="${dark}" stroke-width="1.5" stroke-opacity=".35"`) + `<circle cx="52" cy="196" r="9" fill="${belly}"/>`,
  },
  bear: {
    nat: ['#8c5a3a', '#d9b28f', '#5a3620'], ear: [66, 60], iris: '#3e2616',
    ears: ({ fur, belly, ol }) => `<circle cx="60" cy="50" r="19" fill="${fur}" ${ol}/><circle cx="60" cy="50" r="10" fill="${belly}"/>`,
    over: ({ belly, dark }) => `<ellipse cx="100" cy="107" rx="23" ry="16" fill="${belly}" stroke="${dark}" stroke-width="1.5" stroke-opacity=".3"/>`,
    nose: () => `<ellipse cx="100" cy="100" rx="9" ry="6.5" fill="${INK}"/><ellipse cx="97" cy="98" rx="3" ry="1.6" fill="#fff" opacity=".6"/>`,
    top: ({ fur }) => `<path d="M92 44 Q96 34 100 42 Q104 32 108 44" fill="${fur}"/>`,
    tail: ({ fur, ol }) => `<circle cx="58" cy="202" r="9" fill="${fur}" ${ol}/>`,
  },
  dog: {
    nat: ['#e0b57a', '#f8ead2', '#8f5f30'], ear: [60, 58], iris: '#5a3a22',
    marks: ({ dark }) => `<ellipse cx="119" cy="84" rx="18" ry="17" fill="${dark}" opacity=".5"/>`,
    flaps: ({ fur, dark }) => `<ellipse cx="54" cy="86" rx="15" ry="32" fill="${dark}" stroke="${dark}" stroke-width="3" transform="rotate(20 56 66)"/><path d="M50 74 Q46 92 52 108" stroke="${fur}" stroke-width="2" fill="none" opacity=".35"/>`,
    over: ({ belly }) => `<ellipse cx="100" cy="107" rx="22" ry="15" fill="${belly}"/>`,
    nose: () => `<path d="M90 98 Q100 92 110 98 Q108 106 100 107 Q92 106 90 98 Z" fill="${INK}"/><ellipse cx="96" cy="97" rx="3.5" ry="1.8" fill="#fff" opacity=".6"/><path d="M100 107 V112" stroke="${INK}" stroke-width="2"/>`,
    tail: ({ fur, dark }) => `<path d="M66 196 Q40 196 34 164" stroke="${dark}" stroke-width="15" fill="none" stroke-linecap="round"/><path d="M66 196 Q40 196 34 164" stroke="${fur}" stroke-width="10" fill="none" stroke-linecap="round"/>`,
  },
  fox: {
    nat: ['#e8742c', '#fff4e6', '#8a3a10'], ear: [72, 60], iris: '#c27a1a',
    ears: ({ fur, dark, belly, ol }) => `<path d="M56 78 L50 14 L98 48 Z" fill="${fur}" ${ol}/><path d="M50 14 L54 40 L66 32 Z" fill="${dark}"/><path d="M62 66 L58 32 L86 52 Z" fill="${belly}"/>`,
    marks: ({ belly }) => mirror(`<path d="M44 92 Q72 88 92 110 Q98 124 100 140 L44 140 Z" fill="${belly}"/>`)
      + `<path d="M96 56 L100 70 L104 56" stroke="${belly}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>`,
    nose: () => `<ellipse cx="100" cy="101" rx="6.5" ry="5" fill="${INK}"/><ellipse cx="98" cy="99.5" rx="2" ry="1.2" fill="#fff" opacity=".6"/>`,
    tail: ({ fur, belly, dark }) => `<path d="M70 200 Q20 210 14 168 Q12 140 34 124 Q36 152 54 168 Q64 180 70 200 Z" fill="${fur}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>`
      + `<path d="M34 124 Q26 134 22 146 Q28 140 36 140 Q32 132 34 124 Z" fill="${belly}"/><path d="M36 150 Q30 170 42 186" stroke="${dark}" stroke-width="2" fill="none" opacity=".35"/>`,
    feet: 'paw', limbs: 'dark',
  },
  mouse: {
    nat: ['#a9a3a0', '#ede6e1', '#6f6865'], ear: [68, 62], iris: '#2a2a30',
    ears: ({ fur, ol }) => `<circle cx="56" cy="46" r="26" fill="${fur}" ${ol}/><circle cx="57" cy="47" r="16" fill="${PINK}"/><path d="M48 40 Q54 36 60 38" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>`,
    over: ({ belly }) => `<ellipse cx="100" cy="106" rx="18" ry="11" fill="${belly}"/>`,
    nose: () => `<circle cx="100" cy="101" r="5.5" fill="#e57d97"/><circle cx="98.5" cy="99.5" r="1.6" fill="#fff" opacity=".7"/>`,
    whiskers: true,
    tail: () => `<path d="M64 204 Q30 214 22 190 Q14 166 34 160 Q50 156 46 172" stroke="#d1708a" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M64 204 Q30 214 22 190 Q14 166 34 160 Q50 156 46 172" stroke="${PINK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  },
  panda: {
    nat: ['#f8f6f1', '#ffffff', '#2a2a30'], ear: [66, 58], iris: '#3a2a20',
    ears: ({ dark }) => `<circle cx="60" cy="48" r="19" fill="${dark}"/><circle cx="58" cy="46" r="7" fill="#fff" opacity=".12"/>`,
    marks: ({ dark }) => mirror(`<ellipse cx="80" cy="88" rx="15" ry="19" fill="${dark}" transform="rotate(28 80 88)"/>`),
    over: ({ belly }) => `<ellipse cx="100" cy="107" rx="18" ry="12" fill="${belly}"/>`,
    nose: () => `<ellipse cx="100" cy="100" rx="8" ry="5.5" fill="${INK}"/><ellipse cx="97.5" cy="98.5" rx="2.4" ry="1.3" fill="#fff" opacity=".6"/>`,
    body: ({ dark }) => `<path d="M50 150 Q100 176 150 150 L150 136 L50 136 Z" fill="${dark}"/>`,
    limbs: 'dark', feet: 'dark',
    tail: ({ fur, ol }) => `<circle cx="58" cy="202" r="8" fill="${fur}" ${ol}/>`,
  },
  lion: {
    nat: ['#e6b04a', '#fbe8c0', '#9a5622'], ear: [66, 58], iris: '#a0661a',
    mane: ({ fur, dark }) => puffs(100, 90, 54, 17, 16, dark) + puffs(100, 90, 47, 14, 16, dark, '', 11, 371)
      + puffs(100, 90, 47, 14, 16, fur, 'opacity=".3"', 11, 371),
    ears: ({ fur, belly, ol }) => `<circle cx="62" cy="52" r="14" fill="${fur}" ${ol}/><circle cx="62" cy="52" r="7" fill="${belly}"/>`,
    over: ({ belly }) => `<ellipse cx="91" cy="107" rx="13" ry="10" fill="${belly}"/><ellipse cx="109" cy="107" rx="13" ry="10" fill="${belly}"/>`
      + `<g fill="#8a5a3a" opacity=".55"><circle cx="86" cy="106" r="1.5"/><circle cx="90" cy="110" r="1.5"/><circle cx="114" cy="106" r="1.5"/><circle cx="110" cy="110" r="1.5"/></g>`,
    nose: () => `<path d="M92 97 H108 L100 106 Z" fill="#7a3f20" stroke="#5a2c14" stroke-width="1.5" stroke-linejoin="round"/><path d="M96 99 H101" stroke="#fff" stroke-width="1.5" opacity=".5" stroke-linecap="round"/>`,
    tail: ({ fur, dark }) => `<path d="M66 200 Q30 206 30 170" stroke="${fur}" stroke-width="7" fill="none" stroke-linecap="round"/>${puffs(30, 162, 5, 8, 5, dark)}`,
  },
  tiger: {
    nat: ['#ee8a2e', '#fff3e2', '#2a2420'], ear: [72, 58], iris: '#b8860b',
    ears: ({ fur, belly, ol }) => `<path d="M56 70 Q50 34 66 30 Q82 32 90 48 Z" fill="${fur}" ${ol}/><path d="M62 62 Q60 42 68 40 Q78 42 82 50 Z" fill="${belly}"/>`,
    marks: ({ dark, belly }) => `<g fill="${dark}"><path d="M90 40 L100 58 L110 40 Z" opacity=".85"/></g>`
      + mirror(`<path d="M50 78 Q62 80 70 76 Q62 84 50 86 Z M50 94 Q60 96 66 92 Q60 100 50 102 Z M74 48 Q80 56 80 64 Q74 58 70 50 Z" fill="${dark}"/>`)
      + mirror(`<path d="M52 100 Q74 96 92 112 Q96 126 100 140 L52 140 Z" fill="${belly}"/>`),
    nose: () => `<path d="M93 98 Q100 95 107 98 L100 105 Z" fill="#e57d97" stroke="#b5506a" stroke-width="1.2"/>`,
    whiskers: true,
    body: ({ dark }) => mirror(`<path d="M56 152 Q66 156 72 152 Q66 160 56 162 Z M56 172 Q66 176 72 172 Q66 180 56 182 Z" fill="${dark}"/>`)
      + `<path d="M84 140 Q100 150 116 140" stroke="${dark}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    tail: ({ fur, dark }) => `<path d="M68 200 Q28 206 24 172 Q22 150 36 140" stroke="${dark}" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M68 200 Q28 206 24 172 Q22 150 36 140" stroke="${fur}" stroke-width="11" fill="none" stroke-linecap="round"/>`
      + `<g stroke="${dark}" stroke-width="5" stroke-linecap="round"><path d="M52 198 l-2 9"/><path d="M34 192 l-8 7"/><path d="M24 170 h-8"/><path d="M28 150 l-8 -4"/></g><circle cx="36" cy="140" r="6" fill="${dark}"/>`,
  },
  raccoon: {
    nat: ['#9a9aa2', '#e8e8ec', '#34343c'], ear: [72, 60], iris: '#3a3a44',
    ears: ({ fur, dark, belly, ol }) => `<path d="M56 72 Q48 36 70 30 Q84 34 88 52 Z" fill="${fur}" ${ol}/><path d="M62 64 Q58 42 70 40 Q78 44 80 54 Z" fill="${dark}"/><path d="M70 30 Q60 32 58 44" stroke="${belly}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    marks: ({ dark }) => `<path d="M52 74 Q76 66 100 78 Q124 66 148 74 Q152 92 140 100 Q124 104 112 96 Q100 92 88 96 Q76 104 60 100 Q48 92 52 74 Z" fill="${dark}"/>`
      + mirror('<path d="M62 70 Q74 62 92 70" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".85"/>')
      + `<path d="M96 46 L100 76 L104 46 Z" fill="${dark}" opacity=".6"/>`,
    over: ({ belly }) => `<ellipse cx="100" cy="108" rx="20" ry="13" fill="${belly}"/>`,
    nose: () => `<ellipse cx="100" cy="101" rx="7" ry="5" fill="${INK}"/><ellipse cx="98" cy="99.5" rx="2.2" ry="1.2" fill="#fff" opacity=".6"/>`,
    whiskers: true, limbs: 'dark',
    tail: ({ fur, dark }) => `<path d="M68 200 Q24 210 18 172 Q16 150 30 134" stroke="${dark}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M68 200 Q24 210 18 172 Q16 150 30 134" stroke="${fur}" stroke-width="17" fill="none" stroke-linecap="round"/>`
      + `<g stroke="${dark}" stroke-width="7"><path d="M50 196 l-2 14"/><path d="M30 192 l-12 10"/><path d="M18 168 h-12"/><path d="M22 146 l-12 -6"/></g><circle cx="30" cy="134" r="9" fill="${dark}"/>`,
  },
  koala: {
    nat: ['#a3a7ae', '#eef0f2', '#575b63'], ear: [62, 66], iris: '#3a3a44',
    ears: ({ fur, belly, dark }) => `${puffs(54, 62, 18, 9, 10, fur, `stroke="${dark}" stroke-width="2"`)}<circle cx="54" cy="62" r="22" fill="${fur}"/><circle cx="56" cy="63" r="13" fill="${belly}"/>${puffs(56, 63, 11, 4, 8, '#fff', 'opacity=".7"')}`,
    over: ({ belly }) => `<ellipse cx="100" cy="110" rx="16" ry="9" fill="${belly}" opacity=".8"/>`,
    nose: () => `<ellipse cx="100" cy="100" rx="10" ry="12" fill="#3a3a44"/><ellipse cx="96.5" cy="95" rx="3" ry="4" fill="#fff" opacity=".35"/>`,
    tail: ({ fur, ol }) => `<circle cx="58" cy="202" r="8" fill="${fur}" ${ol}/>`,
  },
  monkey: {
    nat: ['#8a5a36', '#f0cfa6', '#55331a'], ear: [58, 92], iris: '#4a2c18',
    ears: ({ fur, belly, ol }) => `<circle cx="50" cy="92" r="17" fill="${fur}" ${ol}/><circle cx="52" cy="92" r="10" fill="${belly}"/>`,
    over: ({ belly }) => `<path d="M100 132 Q60 132 60 106 Q56 92 66 78 Q76 66 92 74 Q100 80 108 74 Q124 66 134 78 Q144 92 140 106 Q140 132 100 132 Z" fill="${belly}"/>`,
    nose: ({ dark }) => `<ellipse cx="96" cy="101" rx="2.2" ry="2.8" fill="${dark}"/><ellipse cx="104" cy="101" rx="2.2" ry="2.8" fill="${dark}"/>`,
    top: ({ fur, dark }) => `<path d="M92 42 Q90 28 100 30 Q96 36 100 42 Q104 30 112 32 Q106 36 108 44" fill="${fur}" stroke="${dark}" stroke-width="2" stroke-linejoin="round"/>`,
    tail: ({ fur, dark }) => `<path d="M68 202 Q24 210 24 176 Q24 150 44 150 Q58 152 54 166 Q50 176 40 170" stroke="${dark}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M68 202 Q24 210 24 176 Q24 150 44 150 Q58 152 54 166 Q50 176 40 170" stroke="${fur}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
  },
  pig: {
    nat: ['#f4a9b8', '#fcd9e0', '#c9677f'], ear: [72, 58], iris: '#4a3426',
    ears: ({ fur, dark, ol }) => `<path d="M58 66 Q50 34 60 26 Q80 34 88 50 Z" fill="${fur}" ${ol}/><path d="M62 58 Q58 40 62 34 Q76 40 80 50 Z" fill="${dark}" opacity=".35"/>`,
    over: ({ dark }) => mirror(`<path d="M60 52 Q56 66 64 72 Q74 66 80 50" fill="${dark}" opacity=".18"/>`),
    nose: ({ fur, dark }) => `<ellipse cx="100" cy="103" rx="15" ry="11" fill="${fur}" stroke="${dark}" stroke-width="2.5"/><ellipse cx="100" cy="103" rx="15" ry="11" fill="${dark}" opacity=".22"/><ellipse cx="95" cy="103" rx="2.6" ry="4" fill="${dark}"/><ellipse cx="105" cy="103" rx="2.6" ry="4" fill="${dark}"/>`,
    feet: 'hoof',
    tail: ({ dark }) => `<path d="M62 196 Q50 196 50 188 Q50 180 58 182 Q64 186 58 190 Q46 194 40 184" stroke="${dark}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  },
  cow: {
    nat: ['#fbf8f2', '#ffffff', '#2e2a28'], ear: [62, 74], iris: '#3a2a20',
    ears: ({ fur, ol }) => `<ellipse cx="46" cy="76" rx="20" ry="10" fill="${fur}" transform="rotate(-24 46 76)" ${ol}/><ellipse cx="46" cy="76" rx="12" ry="5" fill="${PINK}" transform="rotate(-24 46 76)"/>`,
    mane: () => mirror('<path d="M70 48 Q62 30 70 18 Q72 30 80 40 Z" fill="#f3e6c4" stroke="#b9a678" stroke-width="2" stroke-linejoin="round"/>'),
    marks: ({ dark }) => `<path d="M112 40 Q140 38 150 62 Q150 82 136 80 Q122 76 124 62 Q114 56 112 40 Z" fill="${dark}"/><circle cx="66" cy="66" r="7" fill="${dark}"/>`,
    over: () => `<ellipse cx="100" cy="110" rx="28" ry="18" fill="#f5b8c4" stroke="#d68a9c" stroke-width="2"/>`,
    nose: () => '<ellipse cx="90" cy="106" rx="3.5" ry="5" fill="#b85670"/><ellipse cx="110" cy="106" rx="3.5" ry="5" fill="#b85670"/>',
    top: ({ fur, dark }) => `<path d="M90 42 Q94 32 100 40 Q106 30 110 42" fill="${fur}" stroke="${dark}" stroke-width="2" stroke-linejoin="round" opacity=".9"/>`,
    body: ({ dark }) => `<path d="M128 146 Q150 148 150 170 Q140 180 128 172 Q118 160 128 146 Z" fill="${dark}"/><circle cx="66" cy="184" r="9" fill="${dark}"/>`,
    feet: 'hoof',
    tail: ({ fur, dark }) => `<path d="M64 196 Q40 194 36 170" stroke="${fur}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M36 170 l-6 -10 l8 2 l2 -10 l4 10 Z" fill="${dark}"/>`,
  },
  sheep: {
    nat: ['#f7f3ea', '#e8d9c6', '#5a4f4c'], ear: [58, 82], iris: '#4a3426',
    ears: ({ dark }) => `<ellipse cx="44" cy="84" rx="18" ry="9" fill="${dark}" transform="rotate(20 44 84)"/>`,
    mane: ({ fur, dark }) => puffs(100, 82, 46, 15.5, 14, dark, 'opacity=".35"', 180, 360) + puffs(100, 82, 46, 14, 14, fur, '', 180, 360),
    over: ({ belly }) => `<ellipse cx="100" cy="100" rx="34" ry="32" fill="${belly}"/>`,
    nose: ({ dark }) => `<path d="M94 102 Q100 106 106 102 M100 104 V109" stroke="${dark}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    top: ({ fur, dark }) => puffs(100, 58, 12, 11.5, 6, dark, 'opacity=".35"', 180, 360) + puffs(100, 58, 12, 10, 6, fur, '', 180, 360) + `<circle cx="100" cy="56" r="11" fill="${fur}"/>`,
    wool: true, feet: 'hoof', limbs: 'dark',
    tail: ({ fur, dark }) => puffs(52, 194, 6, 9.5, 5, dark, 'opacity=".35"') + puffs(52, 194, 6, 8, 5, fur),
  },
  elephant: {
    nat: ['#9aa3b5', '#c9d0de', '#5f677a'], ear: [60, 84], iris: '#3a3a44',
    ears: ({ fur, ol }) => `<path d="M62 64 Q24 44 18 84 Q16 120 50 120 Q60 112 62 100 Z" fill="${fur}" ${ol}/><path d="M58 72 Q30 58 28 86 Q28 110 50 110 Q56 102 58 94 Z" fill="${PINK}" opacity=".55"/>`,
    nose: ({ fur, dark, ol }) => `<path d="M92 96 Q92 120 98 132 Q104 142 116 138 Q124 134 120 128 Q112 130 110 124 Q106 112 108 96 Z" fill="${fur}" ${ol}/><g stroke="${dark}" stroke-width="2" opacity=".45" stroke-linecap="round"><path d="M95 110 H106"/><path d="M96 118 H107"/><path d="M99 126 H109"/></g>`
      + '<path d="M84 114 Q80 122 84 126" stroke="#fffaf0" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M116 114 Q120 122 116 126" stroke="#fffaf0" stroke-width="5" fill="none" stroke-linecap="round"/>',
    feet: 'nails',
    tail: ({ fur, dark }) => `<path d="M64 198 Q46 200 42 180" stroke="${fur}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M42 180 l-5 -8 M42 180 l1 -10 M42 180 l6 -7" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>`,
  },
  frog: {
    nat: ['#6cbf4a', '#e2f2b8', '#3a7d26'], iris: '#c9a227',
    mane: ({ fur, ol }) => `<circle cx="79" cy="56" r="20" fill="${fur}" ${ol}/><circle cx="121" cy="56" r="20" fill="${fur}" ${ol}/>`,
    marks: ({ dark }) => `<g fill="${dark}" opacity=".35"><circle cx="64" cy="64" r="6"/><circle cx="140" cy="60" r="4"/><circle cx="134" cy="72" r="3"/><circle cx="58" cy="80" r="3"/></g>`,
    over: ({ belly }) => `<path d="M58 104 Q100 142 142 104 Q140 128 100 134 Q60 128 58 104 Z" fill="${belly}"/>`,
    nose: ({ dark }) => `<circle cx="95" cy="100" r="2" fill="${dark}"/><circle cx="105" cy="100" r="2" fill="${dark}"/>`,
    body: ({ dark }) => `<g fill="${dark}" opacity=".3"><circle cx="64" cy="162" r="6"/><circle cx="140" cy="176" r="5"/><circle cx="134" cy="158" r="3"/></g>`,
    feet: 'web',
  },
  owl: {
    nat: ['#a0714a', '#f0dcb8', '#5e3c22'], ear: [66, 56], iris: '#e8a020',
    ears: ({ fur, ol }) => `<path d="M56 66 L52 30 L78 48 Z" fill="${fur}" ${ol}/>`,
    over: ({ belly, dark }) => mirror(`<circle cx="82" cy="88" r="21" fill="${belly}" stroke="${dark}" stroke-width="2" stroke-opacity=".35"/>`)
      + `<path d="M70 62 Q84 56 98 66 M102 66 Q116 56 130 62" stroke="${dark}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    nose: () => `<path d="M93 98 Q100 94 107 98 L100 114 Z" fill="${BEAK}" stroke="${BEAK_D}" stroke-width="1.5" stroke-linejoin="round"/>`,
    body: ({ dark }) => [[86, 168], [100, 162], [114, 168], [92, 182], [108, 182], [100, 196]].map(([x, y]) => `<path d="M${x - 5} ${y} Q${x} ${y + 6} ${x + 5} ${y}" stroke="${dark}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".55"/>`).join(''),
    arm: 'wing', feet: 'bird',
    tail: ({ fur, dark }) => `<path d="M80 206 L66 222 L80 216 L84 226 L92 212 Z" fill="${fur}" stroke="${dark}" stroke-width="2" stroke-linejoin="round"/>`,
  },
  penguin: {
    nat: ['#2c3440', '#f8f6f0', '#141920'], iris: '#2a2a30',
    marks: ({ belly }) => `<path d="M100 140 Q56 140 56 106 Q54 84 72 76 Q88 72 100 84 Q112 72 128 76 Q146 84 144 106 Q144 140 100 140 Z" fill="${belly}"/>`,
    over: () => `<ellipse cx="68" cy="104" rx="8" ry="5" fill="${PINK}" opacity=".7"/><ellipse cx="132" cy="104" rx="8" ry="5" fill="${PINK}" opacity=".7"/>`,
    nose: () => `<path d="M90 98 Q100 92 110 98 L100 110 Z" fill="${BEAK}" stroke="${BEAK_D}" stroke-width="1.5" stroke-linejoin="round"/><path d="M92 100 H108" stroke="${BEAK_D}" stroke-width="1.2"/>`,
    belly: 'big', arm: 'flipper', feet: 'bird', noCheeks: true,
  },
  unicorn: {
    nat: ['#fbf7fb', '#ffffff', '#b9a3cc'], ear: [72, 58], iris: '#8a5ac4',
    ears: ({ fur, ol }) => `<path d="M62 64 Q54 30 66 22 Q80 36 84 54 Z" fill="${fur}" ${ol}/><path d="M66 56 Q62 36 68 30 Q76 40 78 52 Z" fill="${PINK}"/>`,
    mane: () => ['#f5a3c0', '#ffd27a', '#9fe0c4', '#9cc3f2', '#c6a5ee'].map((col, i) => `<path d="M${132 - i * 4} ${44 + i * 2} Q${168 - i * 6} ${80 + i * 8} ${150 - i * 6} ${128 + i * 6}" stroke="${col}" stroke-width="13" fill="none" stroke-linecap="round"/>`).join(''),
    nose: () => '<ellipse cx="95" cy="103" rx="2" ry="3" fill="#c79bb4"/><ellipse cx="105" cy="103" rx="2" ry="3" fill="#c79bb4"/>',
    top: () => '<path d="M92 46 L100 2 L108 46 Z" fill="#ffd96a" stroke="#c9a23a" stroke-width="2" stroke-linejoin="round"/><path d="M94 38 L106 32 M95 28 L105 22 M97 18 L103 14" stroke="#c9a23a" stroke-width="2"/>'
      + ['#f5a3c0', '#ffd27a', '#9fe0c4', '#9cc3f2'].map((col, i) => `<path d="M${76 + i * 10} 44 Q${84 + i * 10} ${58 + (i % 2) * 6} ${80 + i * 12} 66" stroke="${col}" stroke-width="9" fill="none" stroke-linecap="round"/>`).join(''),
    feet: 'hoof',
    tail: () => ['#f5a3c0', '#ffd27a', '#9fe0c4', '#9cc3f2', '#c6a5ee'].map((col, i) => `<path d="M66 ${196 - i * 2} Q${30 - i * 2} ${200 - i * 3} ${24 + i * 4} ${160 + i * 4}" stroke="${col}" stroke-width="8" fill="none" stroke-linecap="round"/>`).join(''),
  },
  dragon: {
    nat: ['#5fae6e', '#f2e2a0', '#2f6a3a'], iris: '#d4a017',
    wings: ({ dark, belly }) => `<path d="M66 150 Q30 108 6 120 Q20 132 14 146 Q30 140 32 156 Q44 150 50 166 Z" fill="${dark}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/><path d="M60 152 Q34 124 16 126 M58 156 Q40 140 30 150" stroke="${belly}" stroke-width="2" fill="none" opacity=".5"/>`,
    mane: () => [-60, -90, -120, -150, -30].map((a) => {
      const r = (a * Math.PI) / 180;
      const x = 100 + 46 * Math.cos(r);
      const y = 88 + 46 * Math.sin(r);
      const tx = 100 + 64 * Math.cos(r);
      const ty = 88 + 64 * Math.sin(r);
      const nx = -Math.sin(r) * 9;
      const ny = Math.cos(r) * 9;
      return `<path d="M${(x - nx).toFixed(1)} ${(y - ny).toFixed(1)} L${tx.toFixed(1)} ${ty.toFixed(1)} L${(x + nx).toFixed(1)} ${(y + ny).toFixed(1)} Z" fill="${BEAK}" stroke="${BEAK_D}" stroke-width="2" stroke-linejoin="round"/>`;
    }).join(''),
    over: ({ belly }) => `<ellipse cx="100" cy="108" rx="24" ry="15" fill="${belly}"/>`,
    nose: ({ dark }) => `<ellipse cx="94" cy="102" rx="2.4" ry="3.2" fill="${dark}"/><ellipse cx="106" cy="102" rx="2.4" ry="3.2" fill="${dark}"/>`,
    top: () => mirror('<path d="M74 52 Q62 34 66 18 Q74 32 86 44 Z" fill="#fff3d6" stroke="#c2a26a" stroke-width="2" stroke-linejoin="round"/>'),
    body: ({ dark }) => [164, 176, 188, 200].map((y) => `<path d="M${84 + (y - 164) / 6} ${y} Q100 ${y + 5} ${116 - (y - 164) / 6} ${y}" stroke="${dark}" stroke-width="2" fill="none" opacity=".35"/>`).join(''),
    feet: 'claw',
    tail: ({ fur, dark }) => `<path d="M68 200 Q24 212 16 176" stroke="${dark}" stroke-width="18" fill="none" stroke-linecap="round"/><path d="M68 200 Q24 212 16 176" stroke="${fur}" stroke-width="13" fill="none" stroke-linecap="round"/>`
      + `<path d="M16 176 L2 160 L18 152 L26 168 Z" fill="${BEAK}" stroke="${BEAK_D}" stroke-width="2" stroke-linejoin="round"/><path d="M44 206 l-4 10 l10 -6 M28 198 l-10 6 l10 2" fill="${BEAK}" stroke="${BEAK_D}" stroke-width="1.5"/>`,
  },
};
export const KIND_IDS = Object.keys(KINDS);

/* One foot, by kind, at x. */
function foot(type, x, { fur, dark, ol }) {
  const pads = `<ellipse cx="${x}" cy="214" rx="6" ry="4" fill="${PINK}" opacity=".9"/>${[-8, 0, 8].map((d) => `<circle cx="${x + d}" cy="207" r="2.4" fill="${PINK}" opacity=".9"/>`).join('')}`;
  switch (type) {
    case 'bird': return `<path d="M${x - 12} 214 L${x - 4} 204 L${x} 216 L${x + 4} 204 L${x + 12} 214 Z" fill="${BEAK}" stroke="${BEAK_D}" stroke-width="2" stroke-linejoin="round"/>`;
    case 'web': return `<path d="M${x - 16} 216 Q${x - 12} 202 ${x} 204 Q${x + 12} 202 ${x + 16} 216 Q${x + 8} 210 ${x + 4} 216 Q${x} 210 ${x - 4} 216 Q${x - 8} 210 ${x - 16} 216 Z" fill="${fur}" ${ol}/>`;
    case 'hoof': return `<ellipse cx="${x}" cy="210" rx="14" ry="9" fill="${dark}"/><path d="M${x} 203 V217" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
    case 'nails': return `<ellipse cx="${x}" cy="210" rx="16" ry="9" fill="${fur}" ${ol}/>${[-7, 0, 7].map((d) => `<ellipse cx="${x + d}" cy="214" rx="3" ry="2.4" fill="#fffaf0"/>`).join('')}`;
    case 'claw': return `<ellipse cx="${x}" cy="210" rx="16" ry="9" fill="${fur}" ${ol}/>${[-8, 0, 8].map((d) => `<path d="M${x + d - 3} 216 L${x + d} 222 L${x + d + 3} 216 Z" fill="#fff3d6"/>`).join('')}`;
    case 'dark': return `<ellipse cx="${x}" cy="210" rx="16" ry="9" fill="${dark}"/>${pads}`;
    default: return `<ellipse cx="${x}" cy="210" rx="16" ry="9" fill="${fur}" ${ol}/>${pads}`;
  }
}

/* ---------- faces ----------
   An eye is a white shape with the iris clipped to it (so it can look about and blink), and a
   lash line along its top. Shapes: full, big (surprised), lid (half-closed, cool) and sad
   (the top slants down to the outside). side: -1 the left eye, 1 the right. */
const EYE = {
  full: (x) => `M${x - 10.5} 86 A10.5 11.5 0 1 1 ${x + 10.5} 86 A10.5 11.5 0 1 1 ${x - 10.5} 86 Z`,
  big: (x) => `M${x - 12.5} 86 A12.5 13.5 0 1 1 ${x + 12.5} 86 A12.5 13.5 0 1 1 ${x - 12.5} 86 Z`,
  lid: (x) => `M${x - 10.5} 84 Q${x} 79 ${x + 10.5} 84 Q${x + 11} 97.5 ${x} 97.5 Q${x - 11} 97.5 ${x - 10.5} 84 Z`,
  sad: (x, side) => (side < 0
    ? `M${x - 10.5} 87 Q${x - 3} 80.5 ${x + 10.5} 77.5 Q${x + 12} 97.5 ${x} 97.5 Q${x - 11} 97 ${x - 10.5} 87 Z`
    : `M${x - 10.5} 77.5 Q${x + 3} 80.5 ${x + 10.5} 87 Q${x + 11} 97 ${x} 97.5 Q${x - 12} 97.5 ${x - 10.5} 77.5 Z`),
};
const LASH = {
  full: (x) => `M${x - 10.5} 86 A10.5 11.5 0 0 1 ${x + 10.5} 86`,
  big: (x) => `M${x - 12.5} 86 A12.5 13.5 0 0 1 ${x + 12.5} 86`,
  lid: (x) => `M${x - 11} 84 Q${x} 79 ${x + 11} 84`,
  sad: (x, side) => (side < 0 ? `M${x - 10.5} 87 Q${x - 3} 80.5 ${x + 10.5} 77.5` : `M${x - 10.5} 77.5 Q${x + 3} 80.5 ${x + 10.5} 87`),
};
function eye(c, x, side, shape = 'full', { pupil = 4.4, iris = 7.2, dx = 1, dy = 0, look = false, key = '' } = {}) {
  const d = EYE[shape](x, side);
  const id = `E${c.id}${key}${side < 0 ? 'l' : 'r'}`;
  const cx = x + dx;
  const cy = 88 + dy;
  const outer = side < 0 ? x - 10.5 : x + 10.5;
  const flick = shape === 'full' || shape === 'big' ? `<path d="M${outer} 85 l${side * 3.2} -2.6" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` : '';
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="#fff"/>`
    + `<g clip-path="url(#${id})"><g${look ? ' class="av-pupil"' : ''}>`
    + `<circle cx="${cx}" cy="${cy}" r="${iris}" fill="${c.iris}"/><circle cx="${cx}" cy="${cy}" r="${iris}" fill="url(#I${c.id})"/>`
    + `<circle cx="${cx}" cy="${cy + 0.6}" r="${pupil}" fill="${INK}"/>`
    + `<circle cx="${cx + 2.6}" cy="${cy - 3.4}" r="2.5" fill="#fff"/><circle cx="${cx - 2.4}" cy="${cy + 3.6}" r="1.2" fill="#fff" opacity=".85"/>`
    + `</g><path d="${d}" fill="none" stroke="${INK}" stroke-opacity=".18" stroke-width="2"/></g>`
    + `<path d="${LASH[shape](x, side)}" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>${flick}`;
}
const both = (c, shape, o = {}) => eye(c, 83, -1, shape, o) + eye(c, 117, 1, shape, o);
const arcEye = (x, w = 4) => `<path d="M${x - 9} 89 Q${x} 77 ${x + 9} 89" stroke="${INK}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
const shutEye = (x, y = 86) => `<path d="M${x - 9} ${y} Q${x} ${y + 8} ${x + 9} ${y}" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
const winkEye = (x) => `<path d="M${x - 9} 88 Q${x} 82 ${x + 9} 88" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M${x - 9} 88 l-3 1.5" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
const starEye = (x) => star(x, 86, 11, '#f2c94c', `stroke="${INK}" stroke-width="1.2"`) + glint(x - 4, 82, 2.4);
const loveEye = (x) => heart(x, 87, 1.25, '#e0457b', `stroke="${INK}" stroke-width="1"`) + `<circle cx="${x - 4.5}" cy="82" r="2" fill="#fff" opacity=".8"/>`;

const MOUTH = {
  smile: `<path d="M91 110 Q100 118 109 110" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  open: `<path d="M88 107 Q100 126 112 107 Z" fill="#b8404f" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M93 116 Q100 112 107 116 Q100 124 93 116 Z" fill="#f08a9c"/>`,
  cheer: `<path d="M85 105 Q100 132 115 105 Z" fill="#b8404f" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M91 119 Q100 112 109 119 Q100 129 91 119 Z" fill="#f08a9c"/><path d="M88 106 H112" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  o: '<ellipse cx="100" cy="114" rx="6" ry="8" fill="#5a2b33"/><ellipse cx="100" cy="118.5" rx="3.6" ry="2.6" fill="#f08a9c"/>',
  smirk: `<path d="M90 111 Q101 117 111 107" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  grin: `<path d="M86 107 Q100 125 114 107 Z" fill="#fff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M89 111 H111 M95 108 V119 M100 108 V121 M105 108 V119" stroke="#d8d2c6" stroke-width="1.2"/>`,
  tongue: `<path d="M90 109 Q100 115 110 109" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M96 111 Q96 124 102 124 Q108 124 106 111 Z" fill="#e8708a" stroke="#b8404f" stroke-width="1.2"/>`,
  kitty: `<path d="M90 108 Q95 115 100 109 Q105 115 110 108" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  wobble: `<path d="M93 113 Q96 110 99 113 Q102 116 105 113" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  frown: `<path d="M91 117 Q100 109 109 117" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  sing: '<g class="av-sing"><ellipse cx="100" cy="113" rx="7" ry="8.5" fill="#5a2b33"/><ellipse cx="100" cy="117.5" rx="4" ry="3" fill="#f08a9c"/></g>',
  snore: '<ellipse cx="100" cy="114" rx="3.4" ry="4" fill="#5a2b33"/>',
};
const BROW = {
  up: (dark) => `<path d="M73 70 Q83 63 93 69 M107 69 Q117 63 127 70" stroke="${dark}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`,
  sad: (dark) => `<path d="M73 73 Q84 72 92 64 M108 64 Q116 72 127 73" stroke="${dark}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`,
  cool: () => `<path d="M71 78 H95 M105 78 H129" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
};

/* A face (the one bought): eyes, mouth and maybe brows. blink: its open eyes blink and look
   about. blush: rosy cheeks. */
const FACES = {
  smile: (c) => ({ eyes: both(c, 'full', { look: true }), mouth: MOUTH.smile, blink: true }),
  happy: () => ({ eyes: arcEye(83) + arcEye(117), mouth: MOUTH.open }),
  wow: (c) => ({ eyes: both(c, 'big', { pupil: 3.6, iris: 6.6, look: true }), mouth: MOUTH.o, blink: true }),
  wink: (c) => ({ eyes: winkEye(83), open: eye(c, 117, 1, 'full', { look: true }), mouth: MOUTH.smirk }),
  grin: (c) => ({ eyes: both(c, 'full', { look: true }), mouth: MOUTH.grin, blink: true }),
  cool: (c) => ({ eyes: both(c, 'lid', { dx: 2, look: true }), mouth: MOUTH.smirk, brows: BROW.cool(), blink: true }),
  silly: (c) => ({ eyes: arcEye(83), open: eye(c, 117, 1, 'full', { look: true }), mouth: MOUTH.tongue }),
  kitty: (c) => ({ eyes: both(c, 'full', { look: true }), mouth: MOUTH.kitty, blink: true }),
  shy: (c) => ({ eyes: both(c, 'full', { dx: -2.5, dy: 2, look: false }), mouth: MOUTH.wobble, blink: true, blush: true }),
  star: () => ({ eyes: starEye(83) + starEye(117), mouth: MOUTH.open }),
  love: () => ({ eyes: loveEye(83) + loveEye(117), mouth: MOUTH.open, blush: true }),
};
export const FACE_IDS = Object.keys(FACES);

/* A face for each mood, over the one bought while the mood lasts (avatar.css). */
function moodFaces(c) {
  const tear = '<path class="av-tear" d="M70 96 Q74 104 70 107 Q66 104 70 96 Z" fill="#8fd0f0" stroke="#4a9fc8" stroke-width="1"/>';
  return {
    happy: arcEye(83) + arcEye(117) + MOUTH.open,
    cheer: arcEye(83, 4.6) + arcEye(117, 4.6) + BROW.up(c.dark) + MOUTH.cheer,
    sad: both(c, 'sad', { dy: 3, dx: 0, key: 's' }) + BROW.sad(c.dark) + MOUTH.frown + tear,
    wow: both(c, 'big', { pupil: 2.8, iris: 5.2, key: 'w' }) + BROW.up(c.dark) + MOUTH.o,
    sing: shutEye(83) + shutEye(117) + BROW.up(c.dark) + MOUTH.sing,
    sleep: shutEye(83, 89) + shutEye(117, 89) + MOUTH.snore,
  };
}

/* Things that come with a mood: notes (singing, playing, dancing), sparkles (cheering, wow),
   a sweat drop (a miss) and Zs (dozing). */
const note = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="10" rx="6" ry="4.4" transform="rotate(-20)" fill="currentColor"/><rect x="4.4" y="-12" width="2.4" height="22" fill="currentColor"/><path d="M6.8 -12 Q15 -7 12 2 Q12 -4 6.8 -5 Z" fill="currentColor"/></g>`;
const zee = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M-6 -6 H6 L-6 6 H6" stroke="#5b6b9a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const FX = `<g class="av-fx" display="none">
  <g class="avx-notes"><g class="n1" color="#2F4A3A">${note(152, 58, 0.9)}</g><g class="n2" color="#A8743A">${note(40, 70, 0.75)}</g><g class="n3" color="#5E7D4F">${note(170, 96, 0.7)}</g></g>
  <g class="avx-spark">${glint(34, 50, 8, '#f2c94c')}${glint(166, 36, 9, '#f2c94c')}${glint(24, 128, 6, '#fff3c4')}${glint(178, 122, 7, '#fff3c4')}</g>
  <g class="avx-drop"><path d="M144 50 Q152 62 144 67 Q136 62 144 50 Z" fill="#8fd0f0" stroke="#4a9fc8" stroke-width="1.4"/></g>
  <g class="avx-zzz"><g class="z1">${zee(140, 52, 0.7)}</g><g class="z2">${zee(154, 36, 0.9)}</g><g class="z3">${zee(170, 18, 1.1)}</g></g>
</g>`;

/* The colors a look is drawn in: its color, or the animal's own for 'natural'. */
function paletteOf(L) {
  const k = KINDS[L.kind] || KINDS.cat;
  return L.color === 'natural' || !COLORS[L.color] ? k.nat : COLORS[L.color];
}

const BODY = 'M100 137 C125 137 142 154 143.5 176 C145 201 126 216 100 216 C74 216 55 201 56.5 176 C58 154 75 137 100 137 Z';
const glitter = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".85"/>`).join('');

/* The avatar's svg markup. view: a viewBox, to zoom in on one part (the closet's tiles).
   bare: nothing worn or held (tiles for the animal, its color, pattern and face). */
export function avatarSvg(look = DEFAULT_LOOK, { view = '0 0 200 220', bg = true, bare = false } = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  if (bare) Object.assign(L, { hat: 'none', glasses: 'none', hold: 'none', neck: 'none', shoes: 'none' });
  const K = KINDS[L.kind] || KINDS.cat;
  const id = ++uid;
  const [fur, belly, dark] = paletteOf(L).map((x) => x.replace('url(#R)', `url(#R${id})`).replace('url(#G)', `url(#G${id})`));
  const ol = `stroke="${dark}" stroke-width="3" stroke-linejoin="round"`;
  const c = { fur, belly, dark, ol, id, iris: K.iris || '#4a3426' };
  const limb = K.limbs === 'dark' ? dark : fur;
  const part = (name) => (K[name] ? K[name](c) : '');
  const hold = HOLDS[L.hold] || HOLDS.none;
  const pattern = PATTERNS[L.pattern];
  const shoe = SHOES[L.shoes];
  const face = (FACES[L.face] || FACES.smile)(c);
  const moods = moodFaces(c);
  const galaxy = L.color === 'galaxy';
  const defs = `<defs>${L.color === 'rainbow'
    ? `<linearGradient id="R${id}" x1="0" y1="0" x2="1" y2="1">${['#e05a5a', '#f29a3c', '#f2c94c', '#6cbf6a', '#5b8fd9', '#9a6ad6'].map((s, i) => `<stop offset="${i / 5}" stop-color="${s}"/>`).join('')}</linearGradient>`
    : ''}${galaxy ? `<linearGradient id="G${id}" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#3a2a8a"/><stop offset=".5" stop-color="#6a3aa8"/><stop offset="1" stop-color="#c0509a"/></linearGradient>` : ''}`
    + `<radialGradient id="H${id}" cx="36%" cy="28%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></radialGradient>`
    + `<radialGradient id="I${id}" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>`
    + `<radialGradient id="K${id}"><stop offset="0" stop-color="${PINK}" stop-opacity=".9"/><stop offset="1" stop-color="${PINK}" stop-opacity="0"/></radialGradient>`
    + `<clipPath id="CH${id}"><circle cx="100" cy="88" r="48"/></clipPath><clipPath id="CB${id}"><path d="${BODY}"/></clipPath></defs>`;
  const arm = (d, end) => {
    const t = K.arm || 'paw';
    const w = t === 'wing' ? 20 : t === 'flipper' ? 17 : 15;
    const tip = t === 'paw' ? `<circle cx="${end[0]}" cy="${end[1]}" r="9.5" fill="${limb}" ${ol}/>` : '';
    const feather = t === 'wing' ? `<path d="${d}" stroke="${belly}" stroke-width="3" fill="none" stroke-dasharray="4 7" opacity=".6"/>` : '';
    return `<path d="${d}" stroke="${dark}" stroke-width="${w + 5}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${limb}" stroke-width="${w}" fill="none" stroke-linecap="round"/>${feather}${tip}`;
  };
  const bellyShape = K.belly === 'big'
    ? '<ellipse cx="100" cy="182" rx="34" ry="32"/>'
    : '<ellipse cx="100" cy="184" rx="27" ry="27"/>';
  const wool = K.wool ? puffs(100, 176, 41, 11.5, 20, dark, 'opacity=".35"') + puffs(100, 176, 41, 10, 20, fur) : '';
  const cheeks = K.noCheeks ? '' : `<g class="av-cheeks" opacity="${face.blush ? 1 : 0.7}"><ellipse cx="68" cy="104" rx="${face.blush ? 11 : 9}" ry="${face.blush ? 7 : 6}" fill="url(#K${id})"/><ellipse cx="132" cy="104" rx="${face.blush ? 11 : 9}" ry="${face.blush ? 7 : 6}" fill="url(#K${id})"/></g>`;
  const ears = part('ears');
  const flaps = part('flaps');
  return `<svg viewBox="${view}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs}
    ${bg ? `<g class="av-bg">${(BGS[L.bg] || BGS.plain)(id)}</g>` : ''}
    <ellipse class="av-shadow" cx="100" cy="216" rx="58" ry="6" fill="#000" opacity=".12"/>
    <g class="av-bounce"><g class="av-all">
      ${pair('av-wing', part('wings'))}
      <g class="av-tail">${part('tail')}</g>
      <g class="av-leg l">${foot(K.feet, 80, { fur: limb, dark, ol })}</g><g class="av-leg r">${foot(K.feet, 120, { fur: limb, dark, ol })}</g>
      <g class="av-arm l">${arm('M62 158 Q46 176 54 196', [54, 196])}</g>
      <g class="av-torso">
        ${wool}
        <path d="${BODY}" fill="${fur}" ${K.wool ? '' : ol}/>
        <g clip-path="url(#CB${id})">
          ${bellyShape.replace('/>', ` fill="${belly}"/>`)}
          <path d="M92 152 L96 160 L100 152 L104 160 L108 152" stroke="${belly}" stroke-width="2.5" fill="none" stroke-linejoin="round" opacity=".7"/>
          ${part('body')}
          ${pattern ? pattern.body(c) : ''}
          ${galaxy ? glitter([[70, 156, 1.4], [126, 150, 1.1], [138, 190, 1.5], [64, 194, 1.2], [104, 204, 1], [90, 170, 0.9]]) : ''}
          <path d="${BODY}" fill="url(#H${id})"/>
        </g>
        ${hold.front || ''}
      </g>
      ${shoe ? `<g class="av-shoe l">${shoe(80)}</g><g class="av-shoe r">${shoe(120)}</g>` : ''}
      <g class="av-arm r">
        ${arm('M138 158 Q156 154 158 138', [158, 136])}
        ${K.arm && K.arm !== 'paw' ? '' : `<path d="M153 133 L156 128 M158 132 V127 M163 133 L161 128" stroke="${dark}" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>`}
        <g class="av-held">${hold.paw || ''}</g>
      </g>
      <g class="av-neck">${NECKS[L.neck] || ''}</g>
      <g class="av-head">
        ${pair('av-ear', ears, K.ear || [72, 60])}${part('mane')}
        <circle cx="100" cy="88" r="48" fill="${fur}" ${ol}/>
        <g clip-path="url(#CH${id})">${part('marks')}${pattern ? pattern.head(c) : ''}${galaxy ? glitter([[70, 60, 1.4], [132, 56, 1.2], [146, 96, 1.1], [58, 100, 1.2], [116, 44, 1]]) : ''}<circle cx="100" cy="88" r="48" fill="url(#H${id})"/></g>
        ${part('over')}
        ${pair('av-ear', flaps, K.ear || [72, 60])}
        ${cheeks}
        <g class="av-face">
          <g class="av-base">${face.brows || ''}${face.blink ? `<g class="av-blink">${face.eyes}</g>` : face.eyes}${face.open ? `<g class="av-blink">${face.open}</g>` : ''}${face.mouth}</g>
          ${Object.entries(moods).map(([m, s]) => `<g class="av-m m-${m}" display="none">${s}</g>`).join('')}
        </g>
        ${K.nose ? K.nose(c) : `<path d="M94 99 H106 L100 105 Z" fill="#e57d97" stroke="#b5506a" stroke-width="1.2" stroke-linejoin="round"/>`}
        ${K.whiskers ? `<g class="av-whiskers" stroke="${INK}" stroke-opacity=".35" stroke-width="1.4" stroke-linecap="round"><path d="M80 102 L52 97"/><path d="M80 106 L52 109"/><path d="M120 102 L148 97"/><path d="M120 106 L148 109"/></g>` : ''}
        ${part('top')}
        ${GLASSES[L.glasses] || ''}
        <g class="av-hat">${HATS[L.hat] || ''}</g>
      </g>
    </g></g>
    ${FX}
  </svg>`;
}

/* One item on its own, for the closet's tiles: a hat, glasses, held thing, neck or shoes by
   itself (its viewBox fitted by fitItems once it is on the page), a background by itself, and
   the animal, color, pattern and face as the avatar with nothing on. */
export function itemSvg(slot, id, look = DEFAULT_LOOK) {
  const alone = {
    hat: () => HATS[id],
    glasses: () => GLASSES[id],
    neck: () => NECKS[id],
    hold: () => (HOLDS[id] ? (HOLDS[id].front || '') + (HOLDS[id].paw || '') : null),
    shoes: () => (SHOES[id] ? SHOES[id](80) + SHOES[id](120) : null),
  };
  if (alone[slot]) {
    if (id === 'none') return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="30" fill="none" stroke="#c9c1b2" stroke-width="6" stroke-dasharray="10 8"/></svg>';
    return `<svg viewBox="0 0 200 220" aria-hidden="true"><g class="fit">${alone[slot]() || ''}</g></svg>`;
  }
  if (slot === 'bg') return `<svg viewBox="0 0 200 220" aria-hidden="true">${(BGS[id] || BGS.plain)(++uid)}</svg>`;
  return avatarSvg({ ...look, [slot]: id }, { view: TILE_VIEW[slot], bg: false, bare: true });
}

/* Fit each item tile's viewBox to its drawing (call once the tiles are on the page). */
export function fitItems(root) {
  for (const g of root.querySelectorAll('g.fit')) {
    try {
      const b = g.getBBox();
      if (!b.width) continue;
      const pad = Math.max(b.width, b.height) * 0.14;
      const s = Math.max(b.width, b.height) + 2 * pad;
      g.ownerSVGElement.setAttribute('viewBox', `${(b.x + b.width / 2 - s / 2).toFixed(1)} ${(b.y + b.height / 2 - s / 2).toFixed(1)} ${s.toFixed(1)} ${s.toFixed(1)}`);
    } catch { /* not drawn yet */ }
  }
}

/* ---------- a live avatar ---------- */

/* The face each mood puts on (dance: happy; play: the face bought, or singing at a mic). */
const MOOD_FACE = { happy: 'happy', cheer: 'cheer', sad: 'sad', wow: 'wow', sing: 'sing', sleep: 'sleep', dance: 'happy' };
export const MOODS = ['idle', 'happy', 'cheer', 'sad', 'wow', 'sing', 'play', 'dance', 'sleep'];

/* An avatar element (a div holding the svg) that idles: breathes, blinks, looks about, wags.
   opts.mood: a mood to start in; opts.still: no moving at all (a picture). */
export function avatar(look, opts = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  const el = document.createElement('div');
  el.className = `avatar ${opts.cls || ''}${opts.still ? ' still' : ''}`;
  el.innerHTML = avatarSvg(L, opts); // fixed markup
  el.dataset.kind = L.kind;
  el.dataset.play = (HOLDS[L.hold] || HOLDS.none).play;
  // Each avatar idles a little out of step with any other on the page.
  el.style.setProperty('--av-d', `${(-Math.random() * 6).toFixed(2)}s`);
  setMood(el, opts.mood || 'idle');
  return el;
}

/* Put an avatar in a mood (MOODS). for: ms until it goes back to the mood it rests in
   (el.dataset.rest, else idle). beat: seconds a beat, for the moods that move in time. The
   same mood again starts its move over. */
export function setMood(el, mood = 'idle', { for: ms = 0, beat } = {}) {
  if (!el) return;
  if (beat) el.style.setProperty('--av-beat', `${beat}s`);
  clearTimeout(el.moodTimer);
  el.moodTimer = null;
  if (el.dataset.mood === mood) {
    el.removeAttribute('data-mood');
    void el.offsetWidth;
  }
  el.dataset.mood = mood;
  const face = mood === 'play' && el.dataset.play === 'sing' ? 'sing' : MOOD_FACE[mood];
  if (face) el.dataset.face = face;
  else el.removeAttribute('data-face');
  if (ms) {
    el.moodTimer = setTimeout(() => {
      el.moodTimer = null;
      setMood(el, el.dataset.rest || 'idle');
    }, ms);
  }
}

/* The mood an avatar goes back to after a short one (setMood's for). */
export function restIn(el, mood = 'idle') {
  if (!el) return;
  el.dataset.rest = mood;
  if (!el.moodTimer && el.dataset.mood !== mood) setMood(el, mood);
}

/* A bounce on the beat (strong: beat 1, a bigger one). */
export function beat(el, strong = false) {
  if (!el) return;
  const cls = strong ? 'av-beat1' : 'av-beat';
  el.classList.remove('av-beat', 'av-beat1');
  void el.offsetWidth;
  el.classList.add(cls);
}

/* The music-note token: a gold coin with an eighth note on it. */
export function token(cls = '') {
  const el = document.createElement('span');
  el.className = `tok ${cls}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f2c94c" stroke="#b88d1c" stroke-width="1.6"/><ellipse cx="10" cy="16.2" rx="3.6" ry="2.7" transform="rotate(-20 10 16.2)" fill="#5a3b1e"/><rect x="12.4" y="5" width="1.8" height="11" fill="#5a3b1e"/><path d="M14.2 5 Q19 7.5 17.2 12 Q17 9 14.2 8.4 Z" fill="#5a3b1e"/></svg>';
  return el;
}

/* Tiles zoom in on the part their slot changes. */
export const TILE_VIEW = {
  kind: '6 -6 188 156', color: '0 0 200 220', pattern: '0 0 200 220', face: '46 56 108 76', hat: '26 -6 148 116',
  glasses: '46 56 108 76', hold: '64 70 136 150', neck: '40 100 120 110', shoes: '40 160 120 64', bg: '0 0 200 220',
};
