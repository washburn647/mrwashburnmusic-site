/* The learner's own avatar: a little animal they dress up with music notes (♪) earned in
   runs. One look per device, kept with the progress (store.js: st.look, st.owned,
   st.tokens). Every item has a slot (kind, color, face, hat, glasses, hold, bg) and a price;
   price 0 is free from the start. Bought items stay bought.
   Fixed markup only: nothing a learner types ever goes in here. */

export const SLOTS = [
  { id: 'kind', icon: '🐾' },
  { id: 'color', icon: '🎨' },
  { id: 'face', icon: '😀' },
  { id: 'hat', icon: '🎩' },
  { id: 'glasses', icon: '🕶️' },
  { id: 'hold', icon: '🎸' },
  { id: 'bg', icon: '🖼️' },
];

// [id, price]. The first of each slot is the default look's.
export const ITEMS = {
  kind: [['cat', 0], ['bunny', 0], ['bear', 20], ['dog', 20]],
  color: [['orange', 0], ['black', 0], ['gray', 0], ['cream', 0], ['brown', 10], ['white', 10], ['blue', 20],
    ['pink', 20], ['green', 20], ['purple', 30], ['gold', 50], ['rainbow', 80]],
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

/* What a run pays in notes (main.js). */
export const EARN = { right: 1, clean: 3, boss: 10, bossTry: 3, daily: 5 };

// fur, belly, darker (ears, feet)
const COLORS = {
  orange: ['#e3893b', '#f7d9b0', '#b9682a'],
  black: ['#26262d', '#4c4c57', '#121216'],
  gray: ['#8d929c', '#d7d9de', '#6b6f78'],
  cream: ['#efd9ac', '#fbf1db', '#cdb17d'],
  brown: ['#8c5a3a', '#d9b28f', '#6a4129'],
  white: ['#f7f4ee', '#ffffff', '#d8d2c6'],
  blue: ['#5b8fd9', '#cfe0f7', '#3e6db3'],
  pink: ['#ee8fb2', '#fbd9e6', '#cc6990'],
  green: ['#6cbf6a', '#d6f0cf', '#4a9748'],
  purple: ['#9a6ad6', '#e3d3f6', '#7448ae'],
  gold: ['#e5b93a', '#fff0bf', '#b88d1c'],
  rainbow: ['url(#R)', '#ffffff', '#8a5ac4'],
};
const PINK = '#f2a6b8';
const INK = '#23232b';

let uid = 0;

const ears = (k, [fur, , dark]) => ({
  cat: `<path d="M58 74 L56 24 L94 50 Z" fill="${fur}"/><path d="M142 74 L144 24 L106 50 Z" fill="${fur}"/>
    <path d="M64 64 L63 36 L86 52 Z" fill="${PINK}"/><path d="M136 64 L137 36 L114 52 Z" fill="${PINK}"/>`,
  bunny: `<g transform="rotate(-12 80 56)"><ellipse cx="80" cy="30" rx="14" ry="36" fill="${fur}"/><ellipse cx="80" cy="32" rx="7" ry="26" fill="${PINK}"/></g>
    <g transform="rotate(12 120 56)"><ellipse cx="120" cy="30" rx="14" ry="36" fill="${fur}"/><ellipse cx="120" cy="32" rx="7" ry="26" fill="${PINK}"/></g>`,
  bear: `<circle cx="62" cy="50" r="18" fill="${fur}"/><circle cx="138" cy="50" r="18" fill="${fur}"/>
    <circle cx="62" cy="50" r="9" fill="${dark}"/><circle cx="138" cy="50" r="9" fill="${dark}"/>`,
  dog: '',
}[k]);
// The dog's ears flop over the head, so they go on after it.
const flops = (k, [, , dark]) => (k === 'dog'
  ? `<ellipse cx="56" cy="88" rx="14" ry="30" fill="${dark}" transform="rotate(22 56 70)"/><ellipse cx="144" cy="88" rx="14" ry="30" fill="${dark}" transform="rotate(-22 144 70)"/>`
  : '');
const muzzle = (k, [, belly]) => (k === 'bear' || k === 'dog' ? `<ellipse cx="100" cy="106" rx="22" ry="15" fill="${belly}"/>` : '');
const whiskers = (k) => (k === 'cat'
  ? `<g stroke="${INK}" stroke-opacity=".35" stroke-width="1.4" stroke-linecap="round"><path d="M80 102 L52 97"/><path d="M80 106 L52 109"/><path d="M120 102 L148 97"/><path d="M120 106 L148 109"/></g>`
  : '');

const eye = (x) => `<ellipse cx="${x}" cy="86" rx="10" ry="11" fill="#fff"/><circle cx="${x + 1}" cy="88" r="6.5" fill="${INK}"/><circle cx="${x + 3}" cy="85" r="2.2" fill="#fff"/>`;
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

/* The avatar's svg markup. view: a viewBox, to zoom in on one part (the closet's item tiles). */
export function avatarSvg(look = DEFAULT_LOOK, { view = '0 0 200 220', bg = true } = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  const id = ++uid;
  const c = (COLORS[L.color] || COLORS.orange).map((x) => x.replace('url(#R)', `url(#R${id})`));
  const [fur, belly, dark] = c;
  const defs = L.color === 'rainbow'
    ? `<defs><linearGradient id="R${id}" x1="0" y1="0" x2="1" y2="1">${['#e05a5a', '#f29a3c', '#f2c94c', '#6cbf6a', '#5b8fd9', '#9a6ad6'].map((s, i) => `<stop offset="${i / 5}" stop-color="${s}"/>`).join('')}</linearGradient></defs>`
    : '';
  const guitar = L.hold === 'guitar';
  return `<svg viewBox="${view}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs}
    ${bg ? (BGS[L.bg] || BGS.plain)(id) : ''}
    <g class="av-body">
      <ellipse cx="80" cy="212" rx="16" ry="8" fill="${dark}"/><ellipse cx="120" cy="212" rx="16" ry="8" fill="${dark}"/>
      <ellipse cx="100" cy="176" rx="44" ry="40" fill="${fur}"/><ellipse cx="100" cy="184" rx="26" ry="26" fill="${belly}"/>
      <path d="M62 158 Q46 176 54 196" stroke="${fur}" stroke-width="15" fill="none" stroke-linecap="round"/>
      ${guitar ? HOLDS.guitar : ''}
      <path d="M138 158 Q156 154 158 138" stroke="${fur}" stroke-width="15" fill="none" stroke-linecap="round"/>
      <circle cx="158" cy="136" r="9" fill="${fur}"/>
      ${guitar ? '' : HOLDS[L.hold] || ''}
    </g>
    <g class="av-head">
      ${ears(L.kind, c) || ''}
      <circle cx="100" cy="88" r="48" fill="${fur}"/>
      ${flops(L.kind, c)}
      ${muzzle(L.kind, c)}
      <ellipse cx="68" cy="104" rx="8" ry="5" fill="${PINK}" opacity=".6"/><ellipse cx="132" cy="104" rx="8" ry="5" fill="${PINK}" opacity=".6"/>
      ${(FACES[L.face] || FACES.smile)()}
      <path d="M94 99 H106 L100 105 Z" fill="${L.kind === 'bunny' ? PINK : INK}"/>
      ${whiskers(L.kind)}
      ${GLASSES[L.glasses] || ''}
      ${HATS[L.hat] || ''}
    </g>
  </svg>`;
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
  kind: '20 0 160 150', color: '0 0 200 220', face: '46 56 108 76', hat: '26 -6 148 116',
  glasses: '46 56 108 76', hold: '64 70 136 150', bg: '0 0 200 220',
};
