/* The learner's own avatar: a little animal they dress up with music notes (♪) earned in
   runs. One look per device, kept with the progress (store.js: st.look, st.owned,
   st.tokens). Every item has a slot (kind, color, face, hat, glasses, hold, bg) and a price;
   price 0 is free from the start. Bought items stay bought.
   Fixed markup only: nothing a learner types ever goes in here. */

/* The closet's tabs, in three groups: Me (the animal), Wear, Stage. */
export const SLOTS = [
  { id: 'kind', icon: '🐾', group: 'me' },
  { id: 'color', icon: '🎨', group: 'me' },
  { id: 'face', icon: '😀', group: 'me' },
  { id: 'hat', icon: '🎩', group: 'wear' },
  { id: 'glasses', icon: '🕶️', group: 'wear' },
  { id: 'hold', icon: '🎸', group: 'wear' },
  { id: 'bg', icon: '🖼️', group: 'stage' },
];
export const GROUPS = [
  { id: 'me', icon: '🐾' },
  { id: 'wear', icon: '🎩' },
  { id: 'stage', icon: '🖼️' },
];

// [id, price]. The first of each slot is the default look's.
export const ITEMS = {
  kind: [['cat', 0], ['bunny', 0], ['bear', 20], ['dog', 20], ['mouse', 20], ['pig', 20], ['frog', 25], ['fox', 30],
    ['koala', 30], ['sheep', 30], ['cow', 30], ['monkey', 35], ['raccoon', 35], ['penguin', 40], ['owl', 40],
    ['panda', 45], ['elephant', 45], ['tiger', 50], ['lion', 60], ['unicorn', 80], ['dragon', 100]],
  // 'natural' is each animal's own colors (a fox orange, a frog green, a panda black and white).
  color: [['natural', 0], ['orange', 0], ['black', 0], ['gray', 0], ['cream', 0], ['brown', 10], ['white', 10],
    ['blue', 20], ['pink', 20], ['green', 20], ['purple', 30], ['gold', 50], ['rainbow', 80]],
  face: [['smile', 0], ['happy', 0], ['wow', 10], ['cool', 15], ['silly', 15], ['star', 30]],
  hat: [['none', 0], ['beanie', 15], ['party', 20], ['flower', 20], ['headphones', 30], ['cowboy', 30],
    ['tophat', 40], ['wizard', 50], ['crown', 80]],
  glasses: [['none', 0], ['round', 12], ['shades', 20], ['hearts', 25], ['stars', 30], ['monocle', 35]],
  hold: [['none', 0], ['maracas', 15], ['sticks', 20], ['mic', 25], ['tambourine', 25], ['baton', 30],
    ['trumpet', 40], ['guitar', 50]],
  bg: [['plain', 0], ['mint', 0], ['notes', 12], ['rainbow', 20], ['stars', 25], ['stage', 30], ['spotlight', 30],
    ['space', 40]],
};

export const DEFAULT_LOOK = Object.fromEntries(Object.entries(ITEMS).map(([slot, list]) => [slot, list[0][0]]));
export const priceOf = (slot, id) => ITEMS[slot]?.find(([i]) => i === id)?.[1] ?? Infinity;
export const owns = (st, slot, id) => priceOf(slot, id) === 0 || (st.owned || []).includes(`${slot}:${id}`);
/* The saved look, with anything unknown or not owned put back to the default. */
export function lookOf(st) {
  const look = { ...DEFAULT_LOOK };
  for (const slot of Object.keys(ITEMS)) {
    const id = st.look?.[slot];
    if (id && priceOf(slot, id) < Infinity && owns(st, slot, id)) look[slot] = id;
  }
  return look;
}
/* A look made only of things the learner has (an outfit saved before, a shuffle). */
export const cleanLook = (st, look) => lookOf({ ...st, look });

/* Grooves (grooves.json, Kyle's Groove Lab) are bought in the closet too. The first in the
   list (Basic) is free; any other costs its own price if the Lab gives one, or GROOVE_PRICE.
   Mix plays the ones the learner has. */
export const GROOVE_PRICE = 60;
export const groovePrice = (g, list) => (g === list[0] || g.id === 'basic' ? 0 : g.price ?? GROOVE_PRICE);
export const ownsGroove = (st, g, list) => groovePrice(g, list) === 0 || (st.owned || []).includes(`groove:${g.id}`);

/* What a run pays in notes (main.js). */
export const EARN = { every: 3, clean: 1, boss: 3, bossTry: 1, daily: 2 }; // 1 note every 3 right answers

// fur, belly, darker (ears, outlines, markings)
const COLORS = {
  orange: ['#e3893b', '#f7d9b0', '#b9682a'],
  black: ['#2e2e36', '#55555f', '#121216'],
  gray: ['#8d929c', '#d7d9de', '#5f636c'],
  cream: ['#efd9ac', '#fbf1db', '#c2a26a'],
  brown: ['#8c5a3a', '#d9b28f', '#5e3a24'],
  white: ['#f7f4ee', '#ffffff', '#c9c1b2'],
  blue: ['#5b8fd9', '#cfe0f7', '#335f9f'],
  pink: ['#ee8fb2', '#fbd9e6', '#c25d85'],
  green: ['#6cbf6a', '#d6f0cf', '#3f8a3d'],
  purple: ['#9a6ad6', '#e3d3f6', '#6a42a3'],
  gold: ['#e5b93a', '#fff0bf', '#a8800f'],
  rainbow: ['url(#R)', '#ffffff', '#7a4cb8'],
};
const PINK = '#f2a6b8';
const INK = '#23232b';
const BEAK = '#f29a3c';
const BEAK_D = '#c46d1c';

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

/* The animals. Each draws its own parts around one shared body and head (head at 100,88 r48;
   eyes at 83 and 117, y 86; nose at 100,100; right paw at 158,136), so every hat, pair of
   glasses and held thing fits all of them. c: { fur, belly, dark, ol (an outline), id }.
   Parts: tail and wings (behind the body), feet, arm ('paw', 'wing', 'flipper', 'hoof'),
   limbs (arm and leg color), body (marks on the body, clipped to it), ears and mane (behind
   the head), marks (on the head, clipped to it), over (on the head, before the face), nose
   (after the face), top (horns, tufts: before glasses and hats), whiskers. */
const KINDS = {
  cat: {
    nat: ['#e3893b', '#f7d9b0', '#a95c22'],
    ears: ({ fur, ol }) => mirror(`<path d="M58 76 L54 22 L96 50 Z" fill="${fur}" ${ol}/><path d="M64 66 L62 34 L88 52 Z" fill="${PINK}"/><path d="M64 44 L70 52 M62 52 L68 56" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`),
    marks: ({ dark }) => `<g stroke="${dark}" stroke-width="5" stroke-linecap="round" opacity=".55"><path d="M90 42 L93 56"/><path d="M100 40 V57"/><path d="M110 42 L107 56"/></g>`
      + mirror(`<path d="M52 82 L62 84 M52 92 L60 92" stroke="${dark}" stroke-width="4" stroke-linecap="round" opacity=".45"/>`),
    over: ({ belly }) => `<ellipse cx="91" cy="106" rx="11" ry="8" fill="${belly}"/><ellipse cx="109" cy="106" rx="11" ry="8" fill="${belly}"/>`,
    whiskers: true,
    body: ({ dark }) => `<g stroke="${dark}" stroke-width="5" stroke-linecap="round" opacity=".4"><path d="M58 160 L70 164"/><path d="M57 172 L68 174"/><path d="M142 172 L132 174"/></g>`,
    tail: ({ fur, dark, ol }) => `<path d="M68 200 Q28 206 24 172 Q22 148 40 138" stroke="${dark}" stroke-width="17" fill="none" stroke-linecap="round"/>`
      + `<path d="M68 200 Q28 206 24 172 Q22 148 40 138" stroke="${fur}" stroke-width="12" fill="none" stroke-linecap="round"/>`
      + `<path d="M30 190 l8 -6 M24 168 l10 0 M30 148 l8 4" stroke="${dark}" stroke-width="4" stroke-linecap="round" opacity=".5"/>`,
  },
  bunny: {
    nat: ['#d8c4a8', '#f7eee0', '#9c8262'],
    ears: ({ fur, ol }) => mirror(`<g transform="rotate(-12 80 56)"><ellipse cx="80" cy="26" rx="15" ry="40" fill="${fur}" ${ol}/><ellipse cx="80" cy="30" rx="7.5" ry="29" fill="${PINK}"/><path d="M80 10 V44" stroke="#e48aa0" stroke-width="1.5" opacity=".6"/></g>`),
    over: ({ belly }) => `<ellipse cx="92" cy="106" rx="11" ry="9" fill="${belly}"/><ellipse cx="108" cy="106" rx="11" ry="9" fill="${belly}"/>`,
    nose: () => `<path d="M94 99 Q100 96 106 99 L100 105 Z" fill="${PINK}" stroke="#d1708a" stroke-width="1.2"/><path d="M96 113 H104 V120 Q100 122 96 120 Z" fill="#fff" stroke="#c9c1b2" stroke-width="1"/><path d="M100 113 V121" stroke="#c9c1b2" stroke-width="1"/>`,
    whiskers: true,
    tail: ({ belly, dark }) => puffs(52, 196, 7, 9, 6, belly, `stroke="${dark}" stroke-width="1.5" stroke-opacity=".35"`) + `<circle cx="52" cy="196" r="9" fill="${belly}"/>`,
  },
  bear: {
    nat: ['#8c5a3a', '#d9b28f', '#5a3620'],
    ears: ({ fur, belly, ol }) => mirror(`<circle cx="60" cy="50" r="19" fill="${fur}" ${ol}/><circle cx="60" cy="50" r="10" fill="${belly}"/>`),
    over: ({ belly, dark }) => `<ellipse cx="100" cy="107" rx="23" ry="16" fill="${belly}" stroke="${dark}" stroke-width="1.5" stroke-opacity=".3"/>`,
    nose: () => `<ellipse cx="100" cy="100" rx="9" ry="6.5" fill="${INK}"/><ellipse cx="97" cy="98" rx="3" ry="1.6" fill="#fff" opacity=".6"/>`,
    top: ({ fur }) => `<path d="M92 44 Q96 34 100 42 Q104 32 108 44" fill="${fur}"/>`,
    tail: ({ fur, ol }) => `<circle cx="58" cy="202" r="9" fill="${fur}" ${ol}/>`,
  },
  dog: {
    nat: ['#e0b57a', '#f8ead2', '#8f5f30'],
    marks: ({ dark }) => `<ellipse cx="119" cy="84" rx="18" ry="17" fill="${dark}" opacity=".5"/>`,
    over: ({ fur, belly, dark }) => `<ellipse cx="54" cy="86" rx="15" ry="32" fill="${dark}" stroke="${dark}" stroke-width="3" transform="rotate(20 56 66)"/><ellipse cx="146" cy="86" rx="15" ry="32" fill="${dark}" stroke="${dark}" stroke-width="3" transform="rotate(-20 144 66)"/>`
      + `<path d="M50 74 Q46 92 52 108" stroke="${fur}" stroke-width="2" fill="none" opacity=".35"/>`
      + `<ellipse cx="100" cy="107" rx="22" ry="15" fill="${belly}"/>`,
    nose: () => `<path d="M90 98 Q100 92 110 98 Q108 106 100 107 Q92 106 90 98 Z" fill="${INK}"/><ellipse cx="96" cy="97" rx="3.5" ry="1.8" fill="#fff" opacity=".6"/><path d="M100 107 V112" stroke="${INK}" stroke-width="2"/>`,
    tail: ({ fur, dark }) => `<path d="M66 196 Q40 196 34 164" stroke="${dark}" stroke-width="15" fill="none" stroke-linecap="round"/><path d="M66 196 Q40 196 34 164" stroke="${fur}" stroke-width="10" fill="none" stroke-linecap="round"/>`,
  },
  fox: {
    nat: ['#e8742c', '#fff4e6', '#8a3a10'],
    ears: ({ fur, dark, belly, ol }) => mirror(`<path d="M56 78 L50 14 L98 48 Z" fill="${fur}" ${ol}/><path d="M50 14 L54 40 L66 32 Z" fill="${dark}"/><path d="M62 66 L58 32 L86 52 Z" fill="${belly}"/>`),
    marks: ({ belly }) => mirror(`<path d="M44 92 Q72 88 92 110 Q98 124 100 140 L44 140 Z" fill="${belly}"/>`)
      + `<path d="M96 56 L100 70 L104 56" stroke="${belly}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>`,
    nose: () => `<ellipse cx="100" cy="101" rx="6.5" ry="5" fill="${INK}"/><ellipse cx="98" cy="99.5" rx="2" ry="1.2" fill="#fff" opacity=".6"/>`,
    tail: ({ fur, belly, dark }) => `<path d="M70 200 Q20 210 14 168 Q12 140 34 124 Q36 152 54 168 Q64 180 70 200 Z" fill="${fur}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>`
      + `<path d="M34 124 Q26 134 22 146 Q28 140 36 140 Q32 132 34 124 Z" fill="${belly}"/><path d="M36 150 Q30 170 42 186" stroke="${dark}" stroke-width="2" fill="none" opacity=".35"/>`,
    feet: 'paw', limbs: 'dark',
  },
  mouse: {
    nat: ['#a9a3a0', '#ede6e1', '#6f6865'],
    ears: ({ fur, ol }) => mirror(`<circle cx="56" cy="46" r="26" fill="${fur}" ${ol}/><circle cx="57" cy="47" r="16" fill="${PINK}"/><path d="M48 40 Q54 36 60 38" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>`),
    over: ({ belly }) => `<ellipse cx="100" cy="106" rx="18" ry="11" fill="${belly}"/>`,
    nose: () => `<circle cx="100" cy="101" r="5.5" fill="#e57d97"/><circle cx="98.5" cy="99.5" r="1.6" fill="#fff" opacity=".7"/>`,
    whiskers: true,
    tail: () => `<path d="M64 204 Q30 214 22 190 Q14 166 34 160 Q50 156 46 172" stroke="#d1708a" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M64 204 Q30 214 22 190 Q14 166 34 160 Q50 156 46 172" stroke="${PINK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  },
  panda: {
    nat: ['#f8f6f1', '#ffffff', '#2a2a30'],
    ears: ({ dark }) => mirror(`<circle cx="60" cy="48" r="19" fill="${dark}"/><circle cx="58" cy="46" r="7" fill="#fff" opacity=".12"/>`),
    marks: ({ dark }) => mirror(`<ellipse cx="80" cy="88" rx="15" ry="19" fill="${dark}" transform="rotate(28 80 88)"/>`),
    over: ({ belly }) => `<ellipse cx="100" cy="107" rx="18" ry="12" fill="${belly}"/>`,
    nose: () => `<ellipse cx="100" cy="100" rx="8" ry="5.5" fill="${INK}"/><ellipse cx="97.5" cy="98.5" rx="2.4" ry="1.3" fill="#fff" opacity=".6"/>`,
    body: ({ dark }) => `<path d="M50 150 Q100 176 150 150 L150 136 L50 136 Z" fill="${dark}"/>`,
    limbs: 'dark', feet: 'dark',
    tail: ({ fur, ol }) => `<circle cx="58" cy="202" r="8" fill="${fur}" ${ol}/>`,
  },
  lion: {
    nat: ['#e6b04a', '#fbe8c0', '#9a5622'],
    mane: ({ fur, dark }) => puffs(100, 90, 54, 17, 16, dark) + puffs(100, 90, 47, 14, 16, dark, '', 11, 371)
      + puffs(100, 90, 47, 14, 16, fur, 'opacity=".3"', 11, 371),
    ears: ({ fur, belly, ol }) => mirror(`<circle cx="62" cy="52" r="14" fill="${fur}" ${ol}/><circle cx="62" cy="52" r="7" fill="${belly}"/>`),
    over: ({ belly }) => `<ellipse cx="91" cy="107" rx="13" ry="10" fill="${belly}"/><ellipse cx="109" cy="107" rx="13" ry="10" fill="${belly}"/>`
      + `<g fill="#8a5a3a" opacity=".55"><circle cx="86" cy="106" r="1.5"/><circle cx="90" cy="110" r="1.5"/><circle cx="114" cy="106" r="1.5"/><circle cx="110" cy="110" r="1.5"/></g>`,
    nose: () => `<path d="M92 97 H108 L100 106 Z" fill="#7a3f20" stroke="#5a2c14" stroke-width="1.5" stroke-linejoin="round"/><path d="M96 99 H101" stroke="#fff" stroke-width="1.5" opacity=".5" stroke-linecap="round"/>`,
    tail: ({ fur, dark }) => `<path d="M66 200 Q30 206 30 170" stroke="${fur}" stroke-width="7" fill="none" stroke-linecap="round"/>${puffs(30, 162, 5, 8, 5, dark)}`,
  },
  tiger: {
    nat: ['#ee8a2e', '#fff3e2', '#2a2420'],
    ears: ({ fur, belly, ol }) => mirror(`<path d="M56 70 Q50 34 66 30 Q82 32 90 48 Z" fill="${fur}" ${ol}/><path d="M62 62 Q60 42 68 40 Q78 42 82 50 Z" fill="${belly}"/>`),
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
    nat: ['#9a9aa2', '#e8e8ec', '#34343c'],
    ears: ({ fur, dark, belly, ol }) => mirror(`<path d="M56 72 Q48 36 70 30 Q84 34 88 52 Z" fill="${fur}" ${ol}/><path d="M62 64 Q58 42 70 40 Q78 44 80 54 Z" fill="${dark}"/><path d="M70 30 Q60 32 58 44" stroke="${belly}" stroke-width="4" fill="none" stroke-linecap="round"/>`),
    marks: ({ dark, belly }) => `<path d="M52 74 Q76 66 100 78 Q124 66 148 74 Q152 92 140 100 Q124 104 112 96 Q100 92 88 96 Q76 104 60 100 Q48 92 52 74 Z" fill="${dark}"/>`
      + mirror('<path d="M62 70 Q74 62 92 70" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".85"/>')
      + `<path d="M96 46 L100 76 L104 46 Z" fill="${dark}" opacity=".6"/>`,
    over: ({ belly }) => `<ellipse cx="100" cy="108" rx="20" ry="13" fill="${belly}"/>`,
    nose: () => `<ellipse cx="100" cy="101" rx="7" ry="5" fill="${INK}"/><ellipse cx="98" cy="99.5" rx="2.2" ry="1.2" fill="#fff" opacity=".6"/>`,
    whiskers: true, limbs: 'dark',
    tail: ({ fur, dark }) => `<path d="M68 200 Q24 210 18 172 Q16 150 30 134" stroke="${dark}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M68 200 Q24 210 18 172 Q16 150 30 134" stroke="${fur}" stroke-width="17" fill="none" stroke-linecap="round"/>`
      + `<g stroke="${dark}" stroke-width="7"><path d="M50 196 l-2 14"/><path d="M30 192 l-12 10"/><path d="M18 168 h-12"/><path d="M22 146 l-12 -6"/></g><circle cx="30" cy="134" r="9" fill="${dark}"/>`,
  },
  koala: {
    nat: ['#a3a7ae', '#eef0f2', '#575b63'],
    ears: ({ fur, belly, dark }) => mirror(`${puffs(54, 62, 18, 9, 10, fur, `stroke="${dark}" stroke-width="2"`)}<circle cx="54" cy="62" r="22" fill="${fur}"/><circle cx="56" cy="63" r="13" fill="${belly}"/>${puffs(56, 63, 11, 4, 8, '#fff', 'opacity=".7"')}`),
    over: ({ belly }) => `<ellipse cx="100" cy="110" rx="16" ry="9" fill="${belly}" opacity=".8"/>`,
    nose: () => `<ellipse cx="100" cy="100" rx="10" ry="12" fill="#3a3a44"/><ellipse cx="96.5" cy="95" rx="3" ry="4" fill="#fff" opacity=".35"/>`,
    tail: ({ fur, ol }) => `<circle cx="58" cy="202" r="8" fill="${fur}" ${ol}/>`,
  },
  monkey: {
    nat: ['#8a5a36', '#f0cfa6', '#55331a'],
    ears: ({ fur, belly, ol }) => mirror(`<circle cx="50" cy="92" r="17" fill="${fur}" ${ol}/><circle cx="52" cy="92" r="10" fill="${belly}"/>`),
    over: ({ belly }) => `<path d="M100 132 Q60 132 60 106 Q56 92 66 78 Q76 66 92 74 Q100 80 108 74 Q124 66 134 78 Q144 92 140 106 Q140 132 100 132 Z" fill="${belly}"/>`,
    nose: ({ dark }) => `<ellipse cx="96" cy="101" rx="2.2" ry="2.8" fill="${dark}"/><ellipse cx="104" cy="101" rx="2.2" ry="2.8" fill="${dark}"/>`,
    top: ({ fur, dark }) => `<path d="M92 42 Q90 28 100 30 Q96 36 100 42 Q104 30 112 32 Q106 36 108 44" fill="${fur}" stroke="${dark}" stroke-width="2" stroke-linejoin="round"/>`,
    tail: ({ fur, dark }) => `<path d="M68 202 Q24 210 24 176 Q24 150 44 150 Q58 152 54 166 Q50 176 40 170" stroke="${dark}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M68 202 Q24 210 24 176 Q24 150 44 150 Q58 152 54 166 Q50 176 40 170" stroke="${fur}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
  },
  pig: {
    nat: ['#f4a9b8', '#fcd9e0', '#c9677f'],
    ears: ({ fur, dark, ol }) => mirror(`<path d="M58 66 Q50 34 60 26 Q80 34 88 50 Z" fill="${fur}" ${ol}/><path d="M62 58 Q58 40 62 34 Q76 40 80 50 Z" fill="${dark}" opacity=".35"/>`),
    over: ({ dark }) => mirror(`<path d="M60 52 Q56 66 64 72 Q74 66 80 50" fill="${dark}" opacity=".18"/>`),
    nose: ({ fur, dark }) => `<ellipse cx="100" cy="103" rx="15" ry="11" fill="${fur}" stroke="${dark}" stroke-width="2.5"/><ellipse cx="100" cy="103" rx="15" ry="11" fill="${dark}" opacity=".22"/><ellipse cx="95" cy="103" rx="2.6" ry="4" fill="${dark}"/><ellipse cx="105" cy="103" rx="2.6" ry="4" fill="${dark}"/>`,
    feet: 'hoof',
    tail: ({ dark }) => `<path d="M62 196 Q50 196 50 188 Q50 180 58 182 Q64 186 58 190 Q46 194 40 184" stroke="${dark}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  },
  cow: {
    nat: ['#fbf8f2', '#ffffff', '#2e2a28'],
    ears: ({ fur, ol }) => mirror(`<ellipse cx="46" cy="76" rx="20" ry="10" fill="${fur}" transform="rotate(-24 46 76)" ${ol}/><ellipse cx="46" cy="76" rx="12" ry="5" fill="${PINK}" transform="rotate(-24 46 76)"/>`),
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
    nat: ['#f7f3ea', '#e8d9c6', '#5a4f4c'],
    ears: ({ dark }) => mirror(`<ellipse cx="44" cy="84" rx="18" ry="9" fill="${dark}" transform="rotate(20 44 84)"/>`),
    mane: ({ fur, dark }) => puffs(100, 82, 46, 15.5, 14, dark, 'opacity=".35"', 180, 360) + puffs(100, 82, 46, 14, 14, fur, '', 180, 360),
    over: ({ belly }) => `<ellipse cx="100" cy="100" rx="34" ry="32" fill="${belly}"/>`,
    nose: ({ dark }) => `<path d="M94 102 Q100 106 106 102 M100 104 V109" stroke="${dark}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    top: ({ fur, dark }) => puffs(100, 58, 12, 11.5, 6, dark, 'opacity=".35"', 180, 360) + puffs(100, 58, 12, 10, 6, fur, '', 180, 360) + `<circle cx="100" cy="56" r="11" fill="${fur}"/>`,
    wool: true, feet: 'hoof', limbs: 'dark',
    tail: ({ fur, dark }) => puffs(52, 194, 6, 9.5, 5, dark, 'opacity=".35"') + puffs(52, 194, 6, 8, 5, fur),
  },
  elephant: {
    nat: ['#9aa3b5', '#c9d0de', '#5f677a'],
    ears: ({ fur, ol }) => mirror(`<path d="M62 64 Q24 44 18 84 Q16 120 50 120 Q60 112 62 100 Z" fill="${fur}" ${ol}/><path d="M58 72 Q30 58 28 86 Q28 110 50 110 Q56 102 58 94 Z" fill="${PINK}" opacity=".55"/>`),
    nose: ({ fur, dark, ol }) => `<path d="M92 96 Q92 120 98 132 Q104 142 116 138 Q124 134 120 128 Q112 130 110 124 Q106 112 108 96 Z" fill="${fur}" ${ol}/><g stroke="${dark}" stroke-width="2" opacity=".45" stroke-linecap="round"><path d="M95 110 H106"/><path d="M96 118 H107"/><path d="M99 126 H109"/></g>`
      + '<path d="M84 114 Q80 122 84 126" stroke="#fffaf0" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M116 114 Q120 122 116 126" stroke="#fffaf0" stroke-width="5" fill="none" stroke-linecap="round"/>',
    feet: 'nails',
    tail: ({ fur, dark }) => `<path d="M64 198 Q46 200 42 180" stroke="${fur}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M42 180 l-5 -8 M42 180 l1 -10 M42 180 l6 -7" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>`,
  },
  frog: {
    nat: ['#6cbf4a', '#e2f2b8', '#3a7d26'],
    mane: ({ fur, ol }) => `<circle cx="79" cy="56" r="20" fill="${fur}" ${ol}/><circle cx="121" cy="56" r="20" fill="${fur}" ${ol}/>`,
    marks: ({ dark }) => `<g fill="${dark}" opacity=".35"><circle cx="64" cy="64" r="6"/><circle cx="140" cy="60" r="4"/><circle cx="134" cy="72" r="3"/><circle cx="58" cy="80" r="3"/></g>`,
    over: ({ belly }) => `<path d="M58 104 Q100 142 142 104 Q140 128 100 134 Q60 128 58 104 Z" fill="${belly}"/>`,
    nose: ({ dark }) => `<circle cx="95" cy="100" r="2" fill="${dark}"/><circle cx="105" cy="100" r="2" fill="${dark}"/>`,
    body: ({ dark }) => `<g fill="${dark}" opacity=".3"><circle cx="64" cy="162" r="6"/><circle cx="140" cy="176" r="5"/><circle cx="134" cy="158" r="3"/></g>`,
    feet: 'web',
  },
  owl: {
    nat: ['#a0714a', '#f0dcb8', '#5e3c22'],
    ears: ({ fur, ol }) => mirror(`<path d="M56 66 L52 30 L78 48 Z" fill="${fur}" ${ol}/>`),
    over: ({ belly, dark }) => mirror(`<circle cx="82" cy="88" r="21" fill="${belly}" stroke="${dark}" stroke-width="2" stroke-opacity=".35"/>`)
      + `<path d="M70 62 Q84 56 98 66 M102 66 Q116 56 130 62" stroke="${dark}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    nose: () => `<path d="M93 98 Q100 94 107 98 L100 114 Z" fill="${BEAK}" stroke="${BEAK_D}" stroke-width="1.5" stroke-linejoin="round"/>`,
    body: ({ dark }) => [[86, 168], [100, 162], [114, 168], [92, 182], [108, 182], [100, 196]].map(([x, y]) => `<path d="M${x - 5} ${y} Q${x} ${y + 6} ${x + 5} ${y}" stroke="${dark}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".55"/>`).join(''),
    arm: 'wing', feet: 'bird',
    tail: ({ fur, dark }) => `<path d="M80 206 L66 222 L80 216 L84 226 L92 212 Z" fill="${fur}" stroke="${dark}" stroke-width="2" stroke-linejoin="round"/>`,
  },
  penguin: {
    nat: ['#2c3440', '#f8f6f0', '#141920'],
    marks: ({ belly }) => `<path d="M100 140 Q56 140 56 106 Q54 84 72 76 Q88 72 100 84 Q112 72 128 76 Q146 84 144 106 Q144 140 100 140 Z" fill="${belly}"/>`,
    over: () => `<ellipse cx="68" cy="104" rx="8" ry="5" fill="${PINK}" opacity=".7"/><ellipse cx="132" cy="104" rx="8" ry="5" fill="${PINK}" opacity=".7"/>`,
    nose: () => `<path d="M90 98 Q100 92 110 98 L100 110 Z" fill="${BEAK}" stroke="${BEAK_D}" stroke-width="1.5" stroke-linejoin="round"/><path d="M92 100 H108" stroke="${BEAK_D}" stroke-width="1.2"/>`,
    belly: 'big', arm: 'flipper', feet: 'bird', noCheeks: true,
  },
  unicorn: {
    nat: ['#fbf7fb', '#ffffff', '#b9a3cc'],
    ears: ({ fur, ol }) => mirror(`<path d="M62 64 Q54 30 66 22 Q80 36 84 54 Z" fill="${fur}" ${ol}/><path d="M66 56 Q62 36 68 30 Q76 40 78 52 Z" fill="${PINK}"/>`),
    mane: () => ['#f5a3c0', '#ffd27a', '#9fe0c4', '#9cc3f2', '#c6a5ee'].map((col, i) => `<path d="M${132 - i * 4} ${44 + i * 2} Q${168 - i * 6} ${80 + i * 8} ${150 - i * 6} ${128 + i * 6}" stroke="${col}" stroke-width="13" fill="none" stroke-linecap="round"/>`).join(''),
    over: () => '',
    nose: () => '<ellipse cx="95" cy="103" rx="2" ry="3" fill="#c79bb4"/><ellipse cx="105" cy="103" rx="2" ry="3" fill="#c79bb4"/>',
    top: () => '<path d="M92 46 L100 2 L108 46 Z" fill="#ffd96a" stroke="#c9a23a" stroke-width="2" stroke-linejoin="round"/><path d="M94 38 L106 32 M95 28 L105 22 M97 18 L103 14" stroke="#c9a23a" stroke-width="2"/>'
      + ['#f5a3c0', '#ffd27a', '#9fe0c4', '#9cc3f2'].map((col, i) => `<path d="M${76 + i * 10} 44 Q${84 + i * 10} ${58 + (i % 2) * 6} ${80 + i * 12} 66" stroke="${col}" stroke-width="9" fill="none" stroke-linecap="round"/>`).join(''),
    feet: 'hoof',
    tail: () => ['#f5a3c0', '#ffd27a', '#9fe0c4', '#9cc3f2', '#c6a5ee'].map((col, i) => `<path d="M66 ${196 - i * 2} Q${30 - i * 2} ${200 - i * 3} ${24 + i * 4} ${160 + i * 4}" stroke="${col}" stroke-width="8" fill="none" stroke-linecap="round"/>`).join(''),
  },
  dragon: {
    nat: ['#5fae6e', '#f2e2a0', '#2f6a3a'],
    wings: ({ dark, belly }) => mirror(`<path d="M66 150 Q30 108 6 120 Q20 132 14 146 Q30 140 32 156 Q44 150 50 166 Z" fill="${dark}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/><path d="M60 152 Q34 124 16 126 M58 156 Q40 140 30 150" stroke="${belly}" stroke-width="2" fill="none" opacity=".5"/>`),
    mane: () => [[-60, 0], [-90, 0], [-120, 0], [-150, 0], [-30, 0]].map(([a]) => {
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

/* Feet, by kind. */
function feet(type, { fur, dark, ol }) {
  const pads = (x) => `<ellipse cx="${x}" cy="214" rx="6" ry="4" fill="${PINK}" opacity=".9"/>${[-8, 0, 8].map((d) => `<circle cx="${x + d}" cy="207" r="2.4" fill="${PINK}" opacity=".9"/>`).join('')}`;
  const pair = (fn) => fn(80) + fn(120);
  switch (type) {
    case 'bird': return pair((x) => `<path d="M${x - 12} 214 L${x - 4} 204 L${x} 216 L${x + 4} 204 L${x + 12} 214 Z" fill="${BEAK}" stroke="${BEAK_D}" stroke-width="2" stroke-linejoin="round"/>`);
    case 'web': return pair((x) => `<path d="M${x - 16} 216 Q${x - 12} 202 ${x} 204 Q${x + 12} 202 ${x + 16} 216 Q${x + 8} 210 ${x + 4} 216 Q${x} 210 ${x - 4} 216 Q${x - 8} 210 ${x - 16} 216 Z" fill="${fur}" ${ol}/>`);
    case 'hoof': return pair((x) => `<ellipse cx="${x}" cy="210" rx="14" ry="9" fill="${dark}"/><path d="M${x} 203 V217" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`);
    case 'nails': return pair((x) => `<ellipse cx="${x}" cy="210" rx="16" ry="9" fill="${fur}" ${ol}/>${[-7, 0, 7].map((d) => `<ellipse cx="${x + d}" cy="214" rx="3" ry="2.4" fill="#fffaf0"/>`).join('')}`);
    case 'claw': return pair((x) => `<ellipse cx="${x}" cy="210" rx="16" ry="9" fill="${fur}" ${ol}/>${[-8, 0, 8].map((d) => `<path d="M${x + d - 3} 216 L${x + d} 222 L${x + d + 3} 216 Z" fill="#fff3d6"/>`).join('')}`);
    case 'dark': return pair((x) => `<ellipse cx="${x}" cy="210" rx="16" ry="9" fill="${dark}"/>${pads(x)}`);
    default: return pair((x) => `<ellipse cx="${x}" cy="210" rx="16" ry="9" fill="${fur}" ${ol}/>${pads(x)}`);
  }
}

const eye = (x) => `<ellipse cx="${x}" cy="86" rx="10.5" ry="11.5" fill="#fff" stroke="${INK}" stroke-opacity=".25" stroke-width="1.2"/>`
  + `<circle cx="${x + 1}" cy="88" r="7" fill="#4a3426"/><circle cx="${x + 1}" cy="88.5" r="4.4" fill="${INK}"/>`
  + `<circle cx="${x + 3.4}" cy="84.6" r="2.4" fill="#fff"/><circle cx="${x - 1.6}" cy="91.4" r="1.1" fill="#fff" opacity=".8"/>`;
const arc = (x) => `<path d="M${x - 9} 89 Q${x} 77 ${x + 9} 89" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
const star = (x, y, r, fill, extra = '') => {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.45 : r;
    p.push(`${(x + rr * Math.cos(a)).toFixed(1)} ${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<path d="M${p.join(' L')} Z" fill="${fill}" ${extra}/>`;
};
const heart = (x, y, s, fill, extra = '') => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 6 C-14 -4 -8 -14 0 -7 C8 -14 14 -4 0 6 Z" fill="${fill}" ${extra}/>`;

const FACES = {
  smile: () => `${eye(83)}${eye(117)}<path d="M91 110 Q100 118 109 110" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  happy: () => `${arc(83)}${arc(117)}<path d="M89 108 Q100 124 111 108 Z" fill="#c4505f"/><path d="M94 114 Q100 120 106 114" fill="${PINK}"/>`,
  wow: () => `${eye(83)}${eye(117)}<ellipse cx="100" cy="113" rx="6" ry="8" fill="#5a2b33"/>`,
  cool: () => `${eye(83)}${eye(117)}<path d="M72 80 H94 M106 80 H128" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M90 112 Q102 116 111 107" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  silly: () => `${arc(83)}${eye(117)}<path d="M90 109 Q100 115 110 109" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M96 111 Q96 124 102 124 Q108 124 106 111 Z" fill="#e8708a"/>`,
  star: () => `${star(83, 86, 11, '#f2c94c', `stroke="${INK}" stroke-width="1.2"`)}${star(117, 86, 11, '#f2c94c', `stroke="${INK}" stroke-width="1.2"`)}<path d="M89 108 Q100 124 111 108 Z" fill="#c4505f"/>`,
};

const GLASSES = {
  none: '',
  round: `<g stroke="#5a3b1e" stroke-width="3.2" fill="#fff" fill-opacity=".15"><circle cx="83" cy="87" r="14"/><circle cx="117" cy="87" r="14"/></g><path d="M97 86 Q100 82 103 86" stroke="#5a3b1e" stroke-width="3" fill="none"/>`,
  shades: `<path d="M66 78 H98 Q98 98 82 98 Q66 98 66 78 Z M102 78 H134 Q134 98 118 98 Q102 98 102 78 Z" fill="#14141a"/><path d="M62 79 H138" stroke="#14141a" stroke-width="4"/><path d="M71 83 L79 83 M107 83 L115 83" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/>`,
  hearts: `${heart(83, 88, 1.45, '#e0457b', 'fill-opacity=".9" stroke="#9c2150" stroke-width="1.6"')}${heart(117, 88, 1.45, '#e0457b', 'fill-opacity=".9" stroke="#9c2150" stroke-width="1.6"')}<path d="M98 85 H102" stroke="#9c2150" stroke-width="3"/>`,
  stars: `${star(83, 87, 16, '#f2c94c', 'fill-opacity=".92" stroke="#b07d12" stroke-width="1.6"')}${star(117, 87, 16, '#f2c94c', 'fill-opacity=".92" stroke="#b07d12" stroke-width="1.6"')}<path d="M98 87 H102" stroke="#b07d12" stroke-width="3"/>`,
  monocle: `<circle cx="117" cy="87" r="14" stroke="#c9a23a" stroke-width="3.2" fill="#fff" fill-opacity=".18"/><path d="M128 96 Q140 120 128 140" stroke="#c9a23a" stroke-width="1.6" fill="none"/>`,
};

const HATS = {
  none: '',
  beanie: '<path d="M54 66 Q54 30 100 28 Q146 30 146 66 Z" fill="#d9534f"/><path d="M52 60 H148 V72 H52 Z" rx="6" fill="#b23b37"/><path d="M70 40 V58 M86 32 V58 M100 30 V58 M114 32 V58 M130 40 V58" stroke="#e98380" stroke-width="3"/><circle cx="100" cy="24" r="10" fill="#fff"/>',
  party: '<path d="M74 52 L100 2 L126 52 Z" fill="#5b8fd9"/><path d="M84 32 L116 32 M80 42 L120 42 M90 20 L110 20" stroke="#f2c94c" stroke-width="4"/><circle cx="100" cy="4" r="8" fill="#ee8fb2"/><path d="M72 52 Q100 60 128 52" stroke="#f2c94c" stroke-width="4" fill="none"/>',
  flower: '<g transform="translate(134 50)"><circle cx="0" cy="-11" r="9" fill="#ee8fb2"/><circle cx="10.5" cy="-3.4" r="9" fill="#ee8fb2"/><circle cx="6.5" cy="9" r="9" fill="#ee8fb2"/><circle cx="-6.5" cy="9" r="9" fill="#ee8fb2"/><circle cx="-10.5" cy="-3.4" r="9" fill="#ee8fb2"/><circle r="7" fill="#f2c94c"/></g><path d="M112 58 Q120 52 124 58" stroke="#4a9748" stroke-width="4" fill="none"/>',
  headphones: '<path d="M54 92 Q50 30 100 30 Q150 30 146 92" stroke="#2c2c34" stroke-width="9" fill="none" stroke-linecap="round"/><rect x="40" y="74" width="20" height="34" rx="9" fill="#d9534f"/><rect x="140" y="74" width="20" height="34" rx="9" fill="#d9534f"/><rect x="48" y="80" width="8" height="22" rx="4" fill="#2c2c34"/><rect x="144" y="80" width="8" height="22" rx="4" fill="#2c2c34"/>',
  cowboy: '<path d="M68 54 Q66 16 86 18 Q100 28 114 18 Q134 16 132 54 Z" fill="#a0683c"/><path d="M68 46 H132 V54 H68 Z" fill="#6a4129"/><path d="M34 52 Q100 76 166 52 Q158 44 132 50 Q100 56 68 50 Q42 44 34 52 Z" fill="#8c5a32"/>',
  tophat: '<rect x="72" y="4" width="56" height="46" rx="4" fill="#22222a"/><rect x="72" y="36" width="56" height="9" fill="#c4505f"/><ellipse cx="100" cy="50" rx="44" ry="9" fill="#22222a"/>',
  wizard: '<path d="M62 52 L108 -2 L104 18 L138 52 Z" fill="#6a48ae"/><ellipse cx="100" cy="52" rx="46" ry="9" fill="#5a3a98"/>'
    + `${star(96, 30, 6, '#f2c94c')}${star(114, 40, 4.5, '#f2c94c')}${star(84, 44, 4, '#fff3c4')}`,
  crown: '<path d="M64 54 L62 18 L82 36 L100 10 L118 36 L138 18 L136 54 Z" fill="#f2c94c" stroke="#b88d1c" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="42" r="6" fill="#d9534f"/><circle cx="78" cy="46" r="4.5" fill="#5b8fd9"/><circle cx="122" cy="46" r="4.5" fill="#6cbf6a"/>',
};

// Held in the right paw, at (158, 136).
const HOLDS = {
  none: '',
  maracas: '<g transform="translate(158 136) rotate(18)"><rect x="-3" y="-4" width="6" height="26" rx="3" fill="#8c5a32"/><ellipse cx="0" cy="-16" rx="12" ry="15" fill="#d9534f"/><path d="M-8 -20 Q0 -14 8 -20 M-9 -11 Q0 -5 9 -11" stroke="#f2c94c" stroke-width="2.5" fill="none"/></g>',
  sticks: '<g stroke="#c99a5c" stroke-width="5" stroke-linecap="round"><path d="M154 148 L176 96"/><path d="M162 146 L190 108"/></g><circle cx="176" cy="96" r="4" fill="#e9cf9f"/><circle cx="190" cy="108" r="4" fill="#e9cf9f"/>',
  mic: '<g transform="translate(158 136) rotate(16)"><path d="M-5 -8 L5 -8 L3 24 L-3 24 Z" fill="#2c2c34"/><circle cx="0" cy="-18" r="12" fill="#b8bcc6"/><path d="M-8 -24 L8 -12 M-8 -12 L8 -24 M-11 -18 H11" stroke="#7d828d" stroke-width="1.6"/></g>',
  tambourine: '<g transform="translate(166 122)"><circle r="22" fill="#f7e7c4" stroke="#a0683c" stroke-width="7"/>'
    + [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${(22 * Math.cos(i * Math.PI / 3)).toFixed(1)}" cy="${(22 * Math.sin(i * Math.PI / 3)).toFixed(1)}" r="4.5" fill="#d8d2c6" stroke="#8d929c" stroke-width="1.4"/>`).join('')
    + '</g>',
  baton: `<path d="M156 140 L188 84" stroke="#5a3b1e" stroke-width="7" stroke-linecap="round"/><path d="M156 140 L188 84" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M154 144 L160 134" stroke="#8c5a32" stroke-width="8" stroke-linecap="round"/>${star(190, 80, 8, '#f2c94c')}`,
  trumpet: '<g transform="translate(150 132) rotate(-28)"><rect x="0" y="-5" width="38" height="10" rx="4" fill="#e5b93a"/><path d="M36 -5 L54 -16 L54 16 L36 5 Z" fill="#f2c94c" stroke="#b88d1c" stroke-width="2"/><rect x="10" y="-14" width="5" height="10" fill="#b88d1c"/><rect x="19" y="-14" width="5" height="10" fill="#b88d1c"/><rect x="28" y="-14" width="5" height="10" fill="#b88d1c"/></g>',
  // A ukulele across the belly, its neck up to the paw.
  guitar: '<g transform="rotate(43 110 184)"><rect x="106" y="112" width="8" height="70" rx="3" fill="#6a4129"/><rect x="103" y="104" width="14" height="13" rx="3" fill="#4a2c1a"/>'
    + '<path d="M110 158 C96 158 92 170 98 177 C88 184 92 206 110 206 C128 206 132 184 122 177 C128 170 124 158 110 158 Z" fill="#e3893b" stroke="#a0582a" stroke-width="2.5"/>'
    + '<circle cx="110" cy="178" r="6.5" fill="#4a2c1a"/><rect x="101" y="193" width="18" height="5" rx="2" fill="#4a2c1a"/>'
    + '<path d="M108 116 V195 M112 116 V195" stroke="#fff3c4" stroke-width=".9"/></g>',
};

const notesBg = () => [[24, 40, -12], [168, 30, 10], [30, 150, 8], [176, 168, -8], [100, 14, 0]]
  .map(([x, y, a]) => `<g transform="translate(${x} ${y}) rotate(${a})" fill="#c99a4f" opacity=".55"><ellipse cx="0" cy="12" rx="7" ry="5" transform="rotate(-20)"/><rect x="5" y="-12" width="2.6" height="24"/><path d="M7.6 -12 Q16 -6 13 4 Q13 -3 7.6 -5 Z"/></g>`).join('');
const dots = (list, fill) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');

const BGS = {
  plain: () => '<rect width="200" height="220" fill="#F6F1E4"/>',
  mint: () => '<rect width="200" height="220" fill="#DCE6D2"/>',
  notes: () => `<rect width="200" height="220" fill="#F2E3C4"/>${notesBg()}`,
  rainbow: () => '<rect width="200" height="220" fill="#cfe9f7"/>'
    + ['#e05a5a', '#f29a3c', '#f2c94c', '#6cbf6a', '#5b8fd9', '#9a6ad6'].map((c, i) => `<path d="M${-10 + i * 9} 190 A${110 - i * 9} ${110 - i * 9} 0 0 1 ${210 - i * 9} 190" stroke="${c}" stroke-width="9" fill="none"/>`).join('')
    + '<ellipse cx="30" cy="196" rx="34" ry="16" fill="#fff"/><ellipse cx="172" cy="196" rx="34" ry="16" fill="#fff"/>',
  stars: () => `<rect width="200" height="220" fill="#24305e"/>${star(30, 34, 7, '#fff3c4')}${star(170, 50, 9, '#f2c94c')}${star(160, 170, 6, '#fff3c4')}${star(26, 150, 8, '#f2c94c')}${star(100, 14, 5, '#fff')}${dots([[60, 20, 1.6], [140, 20, 1.4], [184, 110, 1.8], [14, 96, 1.5], [52, 196, 1.6], [130, 200, 1.4]], '#fff')}`,
  stage: () => '<rect width="200" height="220" fill="#3a1f24"/><rect y="176" width="200" height="44" fill="#a0683c"/><path d="M0 186 H200 M0 200 H200" stroke="#7a4c2a" stroke-width="2"/>'
    + '<path d="M0 0 H40 Q30 90 44 180 H0 Z" fill="#a8423a"/><path d="M200 0 H160 Q170 90 156 180 H200 Z" fill="#a8423a"/><path d="M10 0 Q4 90 14 180 M26 0 Q20 90 30 180 M190 0 Q196 90 186 180 M174 0 Q180 90 170 180" stroke="#7d2e28" stroke-width="3" fill="none"/>'
    + '<path d="M0 0 H200 V16 Q150 28 100 16 Q50 28 0 16 Z" fill="#c4505f"/>',
  spotlight: (id) => `<defs><radialGradient id="S${id}" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="#fff3c4" stop-opacity=".8"/><stop offset=".55" stop-color="#fff3c4" stop-opacity=".15"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></radialGradient></defs>`
    + `<rect width="200" height="220" fill="#17241c"/><path d="M84 0 H116 L190 220 H10 Z" fill="url(#S${id})"/><ellipse cx="100" cy="212" rx="80" ry="12" fill="#fff3c4" opacity=".35"/>`,
  space: () => `<rect width="200" height="220" fill="#2a1a4a"/>${dots([[20, 30, 1.6], [70, 14, 1.2], [150, 24, 1.8], [186, 90, 1.3], [12, 120, 1.5], [40, 200, 1.4], [176, 200, 1.6], [120, 8, 1]], '#fff')}`
    + '<circle cx="164" cy="160" r="22" fill="#e3893b"/><ellipse cx="164" cy="160" rx="36" ry="8" stroke="#f2c94c" stroke-width="4" fill="none" transform="rotate(-18 164 160)"/>'
    + '<circle cx="34" cy="64" r="12" fill="#6cbf6a"/><circle cx="30" cy="60" r="3" fill="#4a9748"/>',
};


/* The colors a look is drawn in: its color, or the animal's own for 'natural'. */
function paletteOf(L) {
  const k = KINDS[L.kind] || KINDS.cat;
  return L.color === 'natural' || !COLORS[L.color] ? k.nat : COLORS[L.color];
}

/* The avatar's svg markup. view: a viewBox, to zoom in on one part (the closet's tiles).
   bare: no hat, glasses or held thing (tiles for the animal, its color and face). */
export function avatarSvg(look = DEFAULT_LOOK, { view = '0 0 200 220', bg = true, bare = false } = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  if (bare) Object.assign(L, { hat: 'none', glasses: 'none', hold: 'none' });
  const K = KINDS[L.kind] || KINDS.cat;
  const id = ++uid;
  const [fur, belly, dark] = paletteOf(L).map((x) => x.replace('url(#R)', `url(#R${id})`));
  const ol = `stroke="${dark}" stroke-width="3" stroke-linejoin="round"`;
  const c = { fur, belly, dark, ol, id };
  const limb = K.limbs === 'dark' ? dark : fur;
  const part = (name) => (K[name] ? K[name](c) : '');
  const defs = `<defs>${L.color === 'rainbow'
    ? `<linearGradient id="R${id}" x1="0" y1="0" x2="1" y2="1">${['#e05a5a', '#f29a3c', '#f2c94c', '#6cbf6a', '#5b8fd9', '#9a6ad6'].map((s, i) => `<stop offset="${i / 5}" stop-color="${s}"/>`).join('')}</linearGradient>`
    : ''}<radialGradient id="H${id}" cx="36%" cy="28%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></radialGradient>`
    + `<clipPath id="CH${id}"><circle cx="100" cy="88" r="48"/></clipPath><clipPath id="CB${id}"><ellipse cx="100" cy="176" rx="44" ry="40"/></clipPath></defs>`;
  const guitar = L.hold === 'guitar';
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
  return `<svg viewBox="${view}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs}
    ${bg ? (BGS[L.bg] || BGS.plain)(id) : ''}
    <ellipse cx="100" cy="216" rx="58" ry="6" fill="#000" opacity=".12"/>
    <g class="av-body">
      ${part('wings')}${part('tail')}
      ${feet(K.feet, { fur: limb, dark, ol })}
      ${arm('M62 158 Q46 176 54 196', [54, 196])}
      ${wool}
      <ellipse cx="100" cy="176" rx="44" ry="40" fill="${fur}" ${K.wool ? '' : ol}/>
      <g clip-path="url(#CB${id})">
        ${bellyShape.replace('/>', ` fill="${belly}"/>`)}
        <path d="M92 152 L96 160 L100 152 L104 160 L108 152" stroke="${belly}" stroke-width="2.5" fill="none" stroke-linejoin="round" opacity=".7"/>
        ${part('body')}
        <ellipse cx="100" cy="176" rx="44" ry="40" fill="url(#H${id})"/>
      </g>
      ${guitar ? HOLDS.guitar : ''}
      ${arm('M138 158 Q156 154 158 138', [158, 136])}
      ${K.arm && K.arm !== 'paw' ? '' : `<path d="M153 133 L156 128 M158 132 V127 M163 133 L161 128" stroke="${dark}" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>`}
      ${guitar ? '' : HOLDS[L.hold] || ''}
    </g>
    <g class="av-head">
      ${part('ears')}${part('mane')}
      <circle cx="100" cy="88" r="48" fill="${fur}" ${ol}/>
      <g clip-path="url(#CH${id})">${part('marks')}<circle cx="100" cy="88" r="48" fill="url(#H${id})"/></g>
      ${part('over')}
      ${K.noCheeks ? '' : `<ellipse cx="68" cy="104" rx="8" ry="5" fill="${PINK}" opacity=".6"/><ellipse cx="132" cy="104" rx="8" ry="5" fill="${PINK}" opacity=".6"/>`}
      ${(FACES[L.face] || FACES.smile)()}
      ${K.nose ? K.nose(c) : `<path d="M94 99 H106 L100 105 Z" fill="#e57d97" stroke="#b5506a" stroke-width="1.2" stroke-linejoin="round"/>`}
      ${K.whiskers ? `<g stroke="${INK}" stroke-opacity=".35" stroke-width="1.4" stroke-linecap="round"><path d="M80 102 L52 97"/><path d="M80 106 L52 109"/><path d="M120 102 L148 97"/><path d="M120 106 L148 109"/></g>` : ''}
      ${part('top')}
      ${GLASSES[L.glasses] || ''}
      ${HATS[L.hat] || ''}
    </g>
  </svg>`;
}

/* One item on its own, for the closet's tiles: a hat, glasses or held thing by itself (its
   viewBox fitted by fitItems once it is on the page), a background by itself, and the animal,
   color and face as the avatar's head with nothing on. */
export function itemSvg(slot, id, look = DEFAULT_LOOK) {
  const parts = { hat: HATS, glasses: GLASSES, hold: HOLDS };
  if (parts[slot]) {
    if (id === 'none') return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="30" fill="none" stroke="#c9c1b2" stroke-width="6" stroke-dasharray="10 8"/></svg>';
    return `<svg viewBox="0 0 200 220" aria-hidden="true"><g class="fit">${parts[slot][id] || ''}</g></svg>`;
  }
  if (slot === 'bg') return avatarSvg({ ...look, bg: id }, { view: '0 0 200 220' }).replace(/\s*<ellipse cx="100" cy="216"[\s\S]*<\/svg>$/, '</svg>');
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

/* An avatar element (a div holding the svg). */
export function avatar(look, opts = {}) {
  const el = document.createElement('div');
  el.className = `avatar ${opts.cls || ''}`;
  el.innerHTML = avatarSvg(look, opts); // fixed markup
  return el;
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
  kind: '6 -6 188 156', color: '0 0 200 220', face: '46 56 108 76', hat: '26 -6 148 116',
  glasses: '46 56 108 76', hold: '64 70 136 150', bg: '0 0 200 220',
};
