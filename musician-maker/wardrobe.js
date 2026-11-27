/* What the avatar wears, holds and stands in front of (avatar.js draws the animal). All of it
   is drawn on the avatar's 200 × 220 frame: head at 100,88 (r 48), eyes at 83 and 117 (y 86),
   neck at 100,136, body at 100,176, feet at 80 and 120 (y 210), the raised right paw at
   158,136. Fixed markup only. */

export const INK = '#23232b';
export const PINK = '#f2a6b8';
export const BEAK = '#f29a3c';
export const BEAK_D = '#c46d1c';

export const star = (x, y, r, fill, extra = '') => {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.45 : r;
    p.push(`${(x + rr * Math.cos(a)).toFixed(1)} ${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<path d="M${p.join(' L')} Z" fill="${fill}" ${extra}/>`;
};
export const heart = (x, y, s, fill, extra = '') => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 6 C-14 -4 -8 -14 0 -7 C8 -14 14 -4 0 6 Z" fill="${fill}" ${extra}/>`;
// A four-pointed glint.
export const glint = (x, y, r, fill = '#fff', extra = '') => `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${fill}" ${extra}/>`;
const dots = (list, fill, extra = '') => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`).join('');
// A small flower: five petals and a middle.
const flower = (x, y, r, petal, mid = '#f2c94c') => [0, 1, 2, 3, 4].map((i) => {
  const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
  return `<circle cx="${(x + r * Math.cos(a)).toFixed(1)}" cy="${(y + r * Math.sin(a)).toFixed(1)}" r="${(r * 0.85).toFixed(1)}" fill="${petal}"/>`;
}).join('') + `<circle cx="${x}" cy="${y}" r="${(r * 0.6).toFixed(1)}" fill="${mid}"/>`;
// Points along a quadratic curve, for things strung round the neck.
const along = (n, [x0, y0], [cx, cy], [x1, y1]) => Array.from({ length: n }, (_, i) => {
  const t = n === 1 ? 0.5 : i / (n - 1);
  return [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1].map((v) => +v.toFixed(1));
});

/* ---------- hats ---------- */
export const HATS = {
  none: '',
  beanie: '<path d="M54 66 Q54 30 100 28 Q146 30 146 66 Z" fill="#d9534f"/><path d="M52 60 H148 V72 H52 Z" fill="#b23b37"/><path d="M70 40 V58 M86 32 V58 M100 30 V58 M114 32 V58 M130 40 V58" stroke="#e98380" stroke-width="3"/><circle cx="100" cy="24" r="10" fill="#fff"/><circle cx="97" cy="21" r="3" fill="#fff" stroke="#e9e2d6" stroke-width="1"/>',
  bow: '<g transform="translate(130 46) rotate(18)"><path d="M0 0 Q-24 -20 -26 0 Q-24 20 0 0 Z" fill="#ee6fa0" stroke="#b8406e" stroke-width="2" stroke-linejoin="round"/><path d="M0 0 Q24 -20 26 0 Q24 20 0 0 Z" fill="#ee6fa0" stroke="#b8406e" stroke-width="2" stroke-linejoin="round"/><path d="M-16 -6 Q-10 0 -16 6 M16 -6 Q10 0 16 6" stroke="#b8406e" stroke-width="1.6" fill="none" opacity=".6"/><path d="M-3 4 L-9 18 L-2 15 Z M3 4 L9 18 L2 15 Z" fill="#d9558a"/><circle r="6" fill="#d9558a" stroke="#b8406e" stroke-width="2"/></g>',
  party: '<path d="M74 52 L100 2 L126 52 Z" fill="#5b8fd9"/><path d="M84 32 L116 32 M80 42 L120 42 M90 20 L110 20" stroke="#f2c94c" stroke-width="4"/><circle cx="100" cy="4" r="8" fill="#ee8fb2"/><path d="M72 52 Q100 60 128 52" stroke="#f2c94c" stroke-width="4" fill="none"/>',
  flower: '<g transform="translate(134 50)"><circle cx="0" cy="-11" r="9" fill="#ee8fb2"/><circle cx="10.5" cy="-3.4" r="9" fill="#ee8fb2"/><circle cx="6.5" cy="9" r="9" fill="#ee8fb2"/><circle cx="-6.5" cy="9" r="9" fill="#ee8fb2"/><circle cx="-10.5" cy="-3.4" r="9" fill="#ee8fb2"/><circle r="7" fill="#f2c94c"/></g><path d="M112 58 Q120 52 124 58" stroke="#4a9748" stroke-width="4" fill="none"/>',
  headphones: '<path d="M54 92 Q50 30 100 30 Q150 30 146 92" stroke="#2c2c34" stroke-width="9" fill="none" stroke-linecap="round"/><rect x="40" y="74" width="20" height="34" rx="9" fill="#d9534f"/><rect x="140" y="74" width="20" height="34" rx="9" fill="#d9534f"/><rect x="48" y="80" width="8" height="22" rx="4" fill="#2c2c34"/><rect x="144" y="80" width="8" height="22" rx="4" fill="#2c2c34"/>',
  cowboy: '<path d="M68 54 Q66 16 86 18 Q100 28 114 18 Q134 16 132 54 Z" fill="#a0683c"/><path d="M68 46 H132 V54 H68 Z" fill="#6a4129"/><path d="M34 52 Q100 76 166 52 Q158 44 132 50 Q100 56 68 50 Q42 44 34 52 Z" fill="#8c5a32"/>',
  pirate: '<path d="M46 58 Q58 18 100 22 Q142 18 154 58 Q128 46 100 50 Q72 46 46 58 Z" fill="#26262e" stroke="#111" stroke-width="2" stroke-linejoin="round"/><path d="M50 56 Q100 38 150 56" stroke="#d9b26f" stroke-width="3" fill="none"/>'
    + '<circle cx="100" cy="34" r="7" fill="#f7f4ee"/><circle cx="97.5" cy="33.5" r="1.8" fill="#26262e"/><circle cx="102.5" cy="33.5" r="1.8" fill="#26262e"/><path d="M92 42 L108 48 M108 42 L92 48" stroke="#f7f4ee" stroke-width="2.6" stroke-linecap="round"/>',
  viking: '<path d="M60 50 Q38 44 34 14 Q46 30 64 38 Z" fill="#f3e6c4" stroke="#b9a678" stroke-width="2" stroke-linejoin="round"/><path d="M140 50 Q162 44 166 14 Q154 30 136 38 Z" fill="#f3e6c4" stroke="#b9a678" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M56 62 Q56 24 100 22 Q144 24 144 62 Z" fill="#9aa3b5" stroke="#5f677a" stroke-width="2.5" stroke-linejoin="round"/><path d="M60 40 Q100 30 140 40" stroke="#fff" stroke-width="3" fill="none" opacity=".35"/>'
    + '<path d="M52 58 H148 V68 H52 Z" fill="#b88d1c"/><path d="M100 24 V58" stroke="#b88d1c" stroke-width="7"/>' + dots([[62, 63, 2], [78, 63, 2], [94, 63, 2], [106, 63, 2], [122, 63, 2], [138, 63, 2]], '#f2c94c'),
  tophat: '<rect x="72" y="4" width="56" height="46" rx="4" fill="#22222a"/><rect x="72" y="36" width="56" height="9" fill="#c4505f"/><ellipse cx="100" cy="50" rx="44" ry="9" fill="#22222a"/><path d="M78 10 V32" stroke="#fff" stroke-width="3" opacity=".18" stroke-linecap="round"/>',
  wizard: '<path d="M62 52 L108 -2 L104 18 L138 52 Z" fill="#6a48ae"/><ellipse cx="100" cy="52" rx="46" ry="9" fill="#5a3a98"/>'
    + `${star(96, 30, 6, '#f2c94c')}${star(114, 40, 4.5, '#f2c94c')}${star(84, 44, 4, '#fff3c4')}`,
  crown: '<path d="M64 54 L62 18 L82 36 L100 10 L118 36 L138 18 L136 54 Z" fill="#f2c94c" stroke="#b88d1c" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="42" r="6" fill="#d9534f"/><circle cx="78" cy="46" r="4.5" fill="#5b8fd9"/><circle cx="122" cy="46" r="4.5" fill="#6cbf6a"/>',
  // Boss trophies.
  cheese: '<path d="M50 64 L104 14 L152 52 L152 66 Q100 74 50 72 Z" fill="#f6c945" stroke="#c9961a" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 64 L104 14 L152 52 Q100 60 50 64 Z" fill="#fbdc6e"/>'
    + '<path d="M50 64 Q100 60 152 52" stroke="#c9961a" stroke-width="2" fill="none"/>' + dots([[84, 48, 5], [108, 38, 4], [124, 50, 3.5], [96, 28, 3], [72, 66, 3.5], [114, 64, 4], [138, 62, 3]], '#e0a92a'),
  chef: '<rect x="66" y="36" width="68" height="20" rx="5" fill="#fffdf7" stroke="#b3aa9b" stroke-width="2.2"/><path d="M80 39 V54 M92 39 V54 M108 39 V54 M120 39 V54" stroke="#e2d9ca" stroke-width="2"/>'
    + dots([[74, 26, 15], [100, 14, 19], [126, 26, 15], [88, 22, 14], [112, 22, 14]], '#fffdf7', 'stroke="#b3aa9b" stroke-width="2.2"') + dots([[74, 28, 13], [100, 16, 17], [126, 28, 13], [88, 24, 12], [112, 24, 12]], '#fffdf7')
    + '<path d="M64 33 Q72 40 84 37 Q96 42 108 37 Q122 41 136 33" stroke="#e8e0d2" stroke-width="3" fill="none" stroke-linecap="round"/>',
  nightcap: '<path d="M54 64 Q54 22 100 20 Q138 20 156 46 Q168 64 172 96 L162 98 Q156 70 142 58 Q146 64 146 66 Z" fill="#5b8fd9" stroke="#335f9f" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M70 32 Q80 50 78 62 M96 22 Q104 44 102 62 M124 26 Q128 46 126 62 M150 42 Q148 56 152 68 M160 66 Q158 78 164 88" stroke="#cfe0f7" stroke-width="7" fill="none"/>'
    + '<path d="M50 58 Q100 50 150 58 L150 70 Q100 62 50 70 Z" fill="#f7f4ee" stroke="#c9c1b2" stroke-width="1.6"/>' + dots([[168, 100, 10]], '#f7f4ee', 'stroke="#c9c1b2" stroke-width="1.6"'),
  // Mastery prizes.
  beret: '<ellipse cx="96" cy="46" rx="48" ry="15" fill="#c4505f" transform="rotate(-8 96 46)"/><ellipse cx="96" cy="42" rx="42" ry="10" fill="#d4636f" transform="rotate(-8 96 42)"/><path d="M93 32 l3 -10 l4 10 Z" fill="#9a3a46"/><path d="M58 58 Q100 64 138 48" stroke="#9a3a46" stroke-width="4" fill="none" stroke-linecap="round"/>',
  laurel: (() => {
    const leaves = (side) => {
      let s = '';
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const a = Math.PI * (1.05 - 0.48 * t);
        const x = 100 + 50 * Math.cos(a) * side;
        const y = 76 - 44 * Math.sin(a);
        const rot = (side > 0 ? -1 : 1) * (70 - t * 70) + (side > 0 ? 180 : 0);
        s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="4.4" fill="${i % 2 ? '#7fb35a' : '#9bc96e'}" stroke="#4f7a32" stroke-width="1.4" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }
      return s;
    };
    return `<path d="M52 82 Q54 38 96 32 M148 82 Q146 38 104 32" stroke="#4f7a32" stroke-width="2.5" fill="none"/>${leaves(-1)}${leaves(1)}${star(100, 30, 5, '#f2c94c', 'stroke="#b88d1c" stroke-width="1.2"')}`;
  })(),
};

/* ---------- glasses ---------- */
export const GLASSES = {
  none: '',
  round: '<g stroke="#5a3b1e" stroke-width="3.2" fill="#fff" fill-opacity=".15"><circle cx="83" cy="87" r="14"/><circle cx="117" cy="87" r="14"/></g><path d="M97 86 Q100 82 103 86" stroke="#5a3b1e" stroke-width="3" fill="none"/>',
  shades: '<path d="M66 78 H98 Q98 98 82 98 Q66 98 66 78 Z M102 78 H134 Q134 98 118 98 Q102 98 102 78 Z" fill="#14141a"/><path d="M62 79 H138" stroke="#14141a" stroke-width="4"/><path d="M71 83 L79 83 M107 83 L115 83" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/>',
  hearts: `${heart(83, 88, 1.45, '#e0457b', 'fill-opacity=".9" stroke="#9c2150" stroke-width="1.6"')}${heart(117, 88, 1.45, '#e0457b', 'fill-opacity=".9" stroke="#9c2150" stroke-width="1.6"')}<path d="M98 85 H102" stroke="#9c2150" stroke-width="3"/>`,
  stars: `${star(83, 87, 16, '#f2c94c', 'fill-opacity=".92" stroke="#b07d12" stroke-width="1.6"')}${star(117, 87, 16, '#f2c94c', 'fill-opacity=".92" stroke="#b07d12" stroke-width="1.6"')}<path d="M98 87 H102" stroke="#b07d12" stroke-width="3"/>`,
  monocle: '<circle cx="117" cy="87" r="14" stroke="#c9a23a" stroke-width="3.2" fill="#fff" fill-opacity=".18"/><path d="M128 96 Q140 120 128 140" stroke="#c9a23a" stroke-width="1.6" fill="none"/>',
  mask: '<path fill-rule="evenodd" d="M56 82 Q62 70 83 73 Q100 77 117 73 Q138 70 144 82 Q144 100 122 100 Q108 100 100 92 Q92 100 78 100 Q56 100 56 82 Z M74 86 a9 7 0 1 0 18 0 a9 7 0 1 0 -18 0 Z M108 86 a9 7 0 1 0 18 0 a9 7 0 1 0 -18 0 Z" fill="#d9534f" stroke="#9e2f2b" stroke-width="2"/><path d="M144 82 L156 76 M144 84 L154 92" stroke="#d9534f" stroke-width="4" stroke-linecap="round"/>',
  visor: '<rect x="60" y="75" width="80" height="22" rx="11" fill="#5ad1e6" fill-opacity=".72" stroke="#2a8aa0" stroke-width="2.6"/><path d="M68 81 H96" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>' + dots([[112, 90, 1.6], [118, 90, 1.6], [124, 90, 1.6]], '#fff', 'opacity=".8"'),
  // A mastery prize: half-moon reading glasses, low on the nose.
  reading: '<g stroke="#b88d1c" stroke-width="2.8" fill="#fff" fill-opacity=".2"><path d="M70 90 H96 Q96 102 83 102 Q70 102 70 90 Z"/><path d="M104 90 H130 Q130 102 117 102 Q104 102 104 90 Z"/></g><path d="M96 92 Q100 89 104 92" stroke="#b88d1c" stroke-width="2.6" fill="none"/><path d="M70 90 L56 84 M130 90 L144 84" stroke="#b88d1c" stroke-width="2.2"/>',
};

/* ---------- round the neck (drawn behind the head) ---------- */
export const NECKS = {
  none: '',
  bowtie: '<g transform="translate(100 141)"><path d="M0 0 L-18 -11 Q-23 0 -18 11 Z" fill="#d9534f" stroke="#9e2f2b" stroke-width="2" stroke-linejoin="round"/><path d="M0 0 L18 -11 Q23 0 18 11 Z" fill="#d9534f" stroke="#9e2f2b" stroke-width="2" stroke-linejoin="round"/><path d="M-13 -5 Q-9 0 -13 5 M13 -5 Q9 0 13 5" stroke="#9e2f2b" stroke-width="1.4" fill="none" opacity=".6"/><rect x="-5.5" y="-6.5" width="11" height="13" rx="3.5" fill="#b23b37" stroke="#9e2f2b" stroke-width="1.6"/></g>',
  collar: '<path d="M60 128 Q100 156 140 128" stroke="#d9534f" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M62 126 Q100 152 138 126" stroke="#fff" stroke-width="1.6" fill="none" opacity=".35"/>'
    + '<circle cx="100" cy="149" r="8" fill="#f2c94c" stroke="#b88d1c" stroke-width="2"/><path d="M93 149 H107" stroke="#b88d1c" stroke-width="1.6"/><circle cx="100" cy="153" r="1.8" fill="#8a6614"/><circle cx="97" cy="145.5" r="2" fill="#fff" opacity=".7"/>',
  scarf: '<path d="M56 124 Q100 150 144 124 L146 138 Q100 166 54 138 Z" fill="#5b8fd9" stroke="#335f9f" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M118 144 L132 190 L114 192 L106 148 Z" fill="#5b8fd9" stroke="#335f9f" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M120 156 L110 158 M124 170 L113 172" stroke="#f7f4ee" stroke-width="5"/><path d="M72 134 Q100 152 128 134" stroke="#f7f4ee" stroke-width="5" fill="none" opacity=".9"/>'
    + '<path d="M115 192 l-1 6 M120 191.5 l0 6 M125 191 l1 6 M130 190.5 l2 6" stroke="#335f9f" stroke-width="2" stroke-linecap="round"/>',
  bandana: '<path d="M62 130 Q100 146 138 130 L100 172 Z" fill="#d9534f" stroke="#9e2f2b" stroke-width="2" stroke-linejoin="round"/>'
    + dots([[100, 150, 2.4], [88, 140, 2], [112, 140, 2], [100, 162, 1.8], [94, 156, 1.4], [106, 156, 1.4]], '#fff', 'opacity=".9"')
    + '<path d="M62 130 L54 124 M62 130 L56 138" stroke="#9e2f2b" stroke-width="4" stroke-linecap="round"/>',
  lei: along(9, [58, 126], [100, 170], [142, 126]).map(([x, y], i) => flower(x, y, 6, ['#ee6fa0', '#f2c94c', '#f29a3c', '#9a6ad6'][i % 4], '#fff3c4')).join(''),
  pearls: along(11, [66, 130], [100, 164], [134, 130]).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.6" fill="#fbf7f0" stroke="#c9c1b2" stroke-width="1.2"/><circle cx="${x - 1.4}" cy="${y - 1.6}" r="1.4" fill="#fff"/>`).join('')
    + '<circle cx="100" cy="155" r="6.5" fill="#fbf7f0" stroke="#c9c1b2" stroke-width="1.4"/><circle cx="98" cy="153" r="2" fill="#fff"/>',
  // A boss trophy: the Big Stink's air freshener.
  pine: '<path d="M90 130 L100 150 L110 130" stroke="#8d929c" stroke-width="2" fill="none"/><rect x="96" y="148" width="8" height="6" rx="1.5" fill="#f2c94c"/>'
    + '<path d="M100 152 L116 172 H109 L120 188 H80 L91 172 H84 Z" fill="#3f9a4a" stroke="#2a6a30" stroke-width="2" stroke-linejoin="round"/><rect x="96" y="188" width="8" height="6" fill="#2a6a30"/>'
    + '<path d="M92 176 Q100 172 108 176" stroke="#9fd6a0" stroke-width="2" fill="none"/>',
  // Mastery prizes.
  medal: '<path d="M84 130 L95 160 L105 160 L116 130 L107 130 L100 150 L93 130 Z" fill="#5b8fd9" stroke="#335f9f" stroke-width="1.6" stroke-linejoin="round"/><path d="M93 130 L100 150 L107 130" fill="#d9534f"/>'
    + '<circle cx="100" cy="168" r="11" fill="#e5b93a" stroke="#a8800f" stroke-width="2.4"/>' + star(100, 168, 6.5, '#fff3c4', 'stroke="#a8800f" stroke-width="1"'),
  goldnote: '<path d="M64 128 Q100 160 136 128" stroke="#e5b93a" stroke-width="2.4" fill="none" stroke-dasharray="3 2"/>'
    + '<g transform="translate(100 156)"><ellipse cx="-3" cy="9" rx="7" ry="5.4" transform="rotate(-20 -3 9)" fill="#f2c94c" stroke="#a8800f" stroke-width="1.8"/><rect x="2.5" y="-12" width="3" height="21" fill="#f2c94c" stroke="#a8800f" stroke-width="1.2"/><path d="M5.5 -12 Q15 -7 12 2 Q11 -4 5.5 -5 Z" fill="#f2c94c" stroke="#a8800f" stroke-width="1.2"/></g>',
};

/* ---------- shoes (one per foot, at x; drawn in front of the body) ---------- */
const sole = (x, fill = '#fff', edge = '#d8d2c6') => `<rect x="${x - 18}" y="211" width="36" height="7" rx="3.5" fill="${fill}" stroke="${edge}" stroke-width="1.4"/>`;
export const SHOES = {
  none: null,
  sneakers: (x) => `<path d="M${x - 16} 213 Q${x - 17} 199 ${x} 198 Q${x + 17} 199 ${x + 16} 213 Z" fill="#e05a5a" stroke="#a83b3b" stroke-width="1.6"/>`
    + `<path d="M${x - 11} 212 Q${x} 205 ${x + 11} 212 Z" fill="#fff"/><path d="M${x - 6} 201 L${x + 6} 206 M${x + 6} 201 L${x - 6} 206" stroke="#fff" stroke-width="2" stroke-linecap="round"/>${sole(x)}`,
  slippers: (x) => `<path d="M${x - 14} 197 Q${x - 12} 182 ${x - 8} 186 Q${x - 6} 194 ${x - 6} 199 Z M${x + 14} 197 Q${x + 12} 182 ${x + 8} 186 Q${x + 6} 194 ${x + 6} 199 Z" fill="#fbd9e6" stroke="#d98aa6" stroke-width="1.6"/>`
    + `<path d="M${x - 17} 215 Q${x - 18} 198 ${x} 197 Q${x + 18} 198 ${x + 17} 215 Z" fill="#fbe7ee" stroke="#d98aa6" stroke-width="1.6"/>`
    + `<circle cx="${x - 5}" cy="205" r="1.8" fill="${INK}"/><circle cx="${x + 5}" cy="205" r="1.8" fill="${INK}"/><circle cx="${x}" cy="209" r="1.6" fill="#e57d97"/>${sole(x, '#f2a6b8', '#d98aa6')}`,
  boots: (x) => `<path d="M${x - 13} 190 H${x + 13} V205 Q${x + 18} 207 ${x + 17} 213 H${x - 17} Q${x - 18} 207 ${x - 13} 205 Z" fill="#8c5a32" stroke="#5e3a24" stroke-width="1.6" stroke-linejoin="round"/>`
    + `<rect x="${x - 15}" y="187" width="30" height="7" rx="3" fill="#6a4129"/><path d="M${x - 8} 196 V204" stroke="#b07c50" stroke-width="2.4" stroke-linecap="round"/>${sole(x, '#4a2c1a', '#2e1a0e')}`,
  flippers: (x) => `<path d="M${x - 9} 200 Q${x} 196 ${x + 9} 200 L${x + 22} 217 Q${x} 221 ${x - 22} 217 Z" fill="#4fb3a5" stroke="#2c7d72" stroke-width="1.8" stroke-linejoin="round"/>`
    + `<path d="M${x - 8} 216 L${x - 4} 203 M${x + 8} 216 L${x + 4} 203 M${x} 217 V202" stroke="#2c7d72" stroke-width="1.6" opacity=".6"/>`,
  tap: (x) => `<path d="M${x - 16} 213 Q${x - 17} 199 ${x} 198 Q${x + 17} 199 ${x + 16} 213 Z" fill="#22222a" stroke="#000" stroke-width="1.4"/>`
    + `<path d="M${x - 9} 203 Q${x - 4} 200 ${x + 1} 202" stroke="#fff" stroke-width="2.2" fill="none" opacity=".5" stroke-linecap="round"/>`
    + `<path d="M${x - 4} 202 L${x} 205 L${x + 4} 202 L${x} 199 Z" fill="#c4505f"/>${sole(x, '#d7d9de', '#8d929c')}`,
  skates: (x) => `<path d="M${x - 14} 208 Q${x - 15} 192 ${x} 191 Q${x + 15} 192 ${x + 14} 208 Z" fill="#fbf7f0" stroke="#c9c1b2" stroke-width="1.6"/>`
    + `<path d="M${x - 6} 195 L${x + 6} 199 M${x + 6} 195 L${x - 6} 199 M${x - 6} 201 L${x + 6} 205 M${x + 6} 201 L${x - 6} 205" stroke="#ee6fa0" stroke-width="1.8" stroke-linecap="round"/>`
    + `<rect x="${x - 16}" y="207" width="32" height="5" rx="2.5" fill="#9a6ad6"/><circle cx="${x - 9}" cy="215" r="4.4" fill="#f2c94c" stroke="#b88d1c" stroke-width="1.6"/><circle cx="${x + 9}" cy="215" r="4.4" fill="#f2c94c" stroke="#b88d1c" stroke-width="1.6"/>`,
  // A mastery prize: golden sandals with little wings.
  winged: (x) => `<path d="M${x - 15} 212 Q${x - 16} 202 ${x} 201 Q${x + 16} 202 ${x + 15} 212 Z" fill="#f2c94c" stroke="#a8800f" stroke-width="1.6"/>`
    + `<path d="M${x - 15} 206 Q${x - 26} 196 ${x - 30} 186 Q${x - 22} 190 ${x - 18} 196 Q${x - 24} 186 ${x - 24} 178 Q${x - 14} 190 ${x - 12} 202 Z" fill="#fff" stroke="#c9c1b2" stroke-width="1.4" stroke-linejoin="round"/>`
    + `<path d="M${x - 6} 203 V211 M${x + 6} 203 V211" stroke="#a8800f" stroke-width="1.6"/>${sole(x, '#e5b93a', '#a8800f')}`,
};

/* ---------- patterns (on the fur, clipped to the body and head) ---------- */
export const PATTERNS = {
  none: null,
  stripes: {
    body: (c) => `<g stroke="${c.dark}" stroke-width="8" stroke-linecap="round" opacity=".45" fill="none">${[-3, -2, -1, 0, 1, 2, 3].map((i) => `<path d="M${100 + i * 15 - 14} 138 Q${100 + i * 15 + 4} 176 ${100 + i * 15 - 10} 216"/>`).join('')}</g>`,
    head: (c) => `<g stroke="${c.dark}" stroke-width="6.5" stroke-linecap="round" opacity=".45" fill="none"><path d="M86 42 Q90 52 88 60"/><path d="M100 40 V58"/><path d="M114 42 Q110 52 112 60"/><path d="M52 80 Q60 82 66 78"/><path d="M52 94 Q60 94 64 90"/><path d="M148 80 Q140 82 134 78"/><path d="M148 94 Q140 94 136 90"/></g>`,
  },
  spots: {
    body: (c) => dots([[66, 160, 7], [88, 146, 5], [130, 154, 8], [140, 184, 6], [62, 192, 6], [118, 204, 5], [80, 208, 4]], c.dark, 'opacity=".5"'),
    head: (c) => dots([[66, 60, 7], [138, 66, 5], [130, 50, 3.5], [58, 98, 4], [146, 104, 4.5]], c.dark, 'opacity=".5"'),
  },
  patches: {
    body: (c) => `<path d="M56 146 Q80 140 84 162 Q86 184 64 190 Q50 180 56 146 Z" fill="${c.dark}" opacity=".55"/><path d="M118 186 Q140 176 150 194 Q148 216 124 214 Q110 204 118 186 Z" fill="${c.dark}" opacity=".55"/>`,
    head: (c) => `<path d="M100 40 Q130 36 146 62 Q150 86 134 92 Q114 90 108 72 Q102 56 100 40 Z" fill="${c.dark}" opacity=".55"/>`,
  },
  stars: {
    body: () => [[68, 158, 6], [126, 150, 5], [140, 186, 6.5], [62, 196, 5], [110, 206, 4.5], [92, 144, 4]].map(([x, y, r]) => star(x, y, r, '#fff8d6', 'opacity=".85"')).join(''),
    head: () => [[64, 64, 6], [136, 60, 5], [146, 98, 4], [56, 100, 4.5]].map(([x, y, r]) => star(x, y, r, '#fff8d6', 'opacity=".85"')).join(''),
  },
  hearts: {
    body: () => [[68, 160, 0.55], [128, 152, 0.5], [140, 188, 0.6], [62, 196, 0.48], [112, 208, 0.42]].map(([x, y, s]) => heart(x, y, s, '#ff8fb6', 'opacity=".75"')).join(''),
    head: () => [[64, 64, 0.5], [136, 60, 0.45], [146, 100, 0.4], [56, 100, 0.42]].map(([x, y, s]) => heart(x, y, s, '#ff8fb6', 'opacity=".75"')).join(''),
  },
  sparkle: {
    body: () => [[66, 158, 6], [128, 150, 4.5], [142, 186, 5.5], [64, 196, 4], [112, 206, 5], [94, 146, 3.5], [82, 182, 3]].map(([x, y, r]) => glint(x, y, r, '#fff', 'opacity=".9"')).join(''),
    head: () => [[62, 64, 5], [138, 62, 4.5], [148, 100, 3.5], [56, 102, 3.5], [124, 46, 3]].map(([x, y, r]) => glint(x, y, r, '#fff', 'opacity=".9"')).join(''),
  },
};

/* ---------- held things ----------
   Each is held the way a player holds it. l and r: the arms (left and right as you look at
   the avatar, so l is the animal's right paw: it strums, conducts and strikes), posed from the
   shoulder (s) through the elbow (e) to the paw (p), on a layer: 'back' (behind the body),
   'front' (over the body and what is on it, the default) or 'top' (over the head: something at
   the mouth). held: drawn in that paw, under it (it moves with the arm and turns at the wrist);
   k: which way the paw's fingers point (deg; false: none); moves: the arm's own angles for the
   moods (avatar.js handMoves); still: it doesn't let go in any mood; hangs: what it holds hangs
   straight down whatever the arm does. An arm not given hangs or waves as usual; lead: 'l'
   draws the left arm over the right. front: on the body (a ukulele across the belly, a
   xylophone on the lap); top: at the mouth, over the head (a trumpet); extra: there only while
   playing (a drum for the sticks); tile: how it looks in the closet, when not as held. play:
   how it plays along (avatar.css: data-play, and data-hold for each thing's own moves). */
const at = (x, y, a, inner, s = 1) => `<g transform="translate(${x} ${y})${a ? ` rotate(${a})` : ''}${s !== 1 ? ` scale(${s})` : ''}">${inner}</g>`;
const BRASS = 'fill="#e5b93a" stroke="#a8800f" stroke-width="1.6" stroke-linejoin="round"';
const flip = (inner) => `<g transform="scale(-1 1)">${inner}</g>`;

// A ukulele, upright: the sound hole at 0,0, the neck up.
const UKE = '<rect x="-5.5" y="-72" width="11" height="52" fill="#5e3a24"/><rect x="-4.4" y="-72" width="8.8" height="52" fill="#3a2416"/>'
  + '<path d="M-4.4 -63 H4.4 M-4.4 -55 H4.4 M-4.4 -48 H4.4 M-4.4 -41.5 H4.4 M-4.4 -35.5 H4.4 M-4.4 -30 H4.4" stroke="#cfc6b4" stroke-width="1"/>'
  + '<path d="M-7 -72 L-9 -89 Q0 -94 9 -89 L7 -72 Z" fill="#4a2c1a"/>'
  + '<path d="M-7.4 -77 H-11 M-8 -84 H-11.6 M7.4 -77 H11 M8 -84 H11.6" stroke="#8d929c" stroke-width="1.6"/>'
  + [[-11.6, -77], [-12.2, -84], [11.6, -77], [12.2, -84]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="2.8" fill="#f3efe6" stroke="#8d929c" stroke-width=".9"/>`).join('')
  + '<rect x="-5.5" y="-73.6" width="11" height="2.6" fill="#f3e6c4"/>'
  + '<path d="M0 -24 C10 -24 18 -16 18 -6 C18 1 15 4 15 8 C15 10 24 13 24 22 C24 36 13 46 0 46 C-13 46 -24 36 -24 22 C-24 13 -15 10 -15 8 C-15 4 -18 1 -18 -6 C-18 -16 -10 -24 0 -24 Z" fill="#df8f3c" stroke="#8f4f1f" stroke-width="2.6"/>'
  + '<path d="M-19 16 Q-21 33 -8 40" stroke="#fff" stroke-width="3" fill="none" opacity=".28" stroke-linecap="round"/>'
  + '<rect x="-4.4" y="-25" width="8.8" height="12" fill="#3a2416"/><path d="M-4.4 -24 H4.4" stroke="#cfc6b4" stroke-width="1"/>'
  + '<circle cy="-2" r="9.6" fill="none" stroke="#f3e6c4" stroke-width="1.6"/><circle cy="-2" r="7.4" fill="#3b2414"/>'
  + '<rect x="-11" y="26" width="22" height="6" rx="2.5" fill="#4a2c1a"/><path d="M-8 28 H8" stroke="#f3e6c4" stroke-width="1.2"/>'
  + '<path d="M-3.3 28 V-73 M-1.1 28 V-73 M1.1 28 V-73 M3.3 28 V-73" stroke="#fff7e0" stroke-width=".7"/>';
// A pick, held at 0,0.
const PICK = '<path d="M-1 -3 Q5 -6 8 -2 Q6 3 0 6 Q-3 1 -1 -3 Z" fill="#5ad1e6" stroke="#2b8a9a" stroke-width=".8"/>';

// A keytar, level: the keys' middle at 0,0, the neck to the right.
const KEYTAR = '<path d="M30 -5 H74 Q80 -5 80 -.5 Q80 4 74 4 H30 Z" fill="#9a6ad6" stroke="#6a42a3" stroke-width="2"/>'
  + '<rect x="42" y="-3.2" width="26" height="3.4" rx="1.7" fill="#5ad1e6"/><circle cx="74.5" cy="-.5" r="2" fill="#f2c94c"/>'
  + '<rect x="-50" y="-13" width="86" height="26" rx="11" fill="#ee6fa0" stroke="#a83a6a" stroke-width="2.4"/>'
  + '<rect x="-46" y="-9.5" width="5" height="10" rx="2" fill="#5ad1e6"/><circle cx="-43.5" cy="5" r="2" fill="#f2c94c"/>'
  + Array.from({ length: 11 }, (_, i) => `<rect x="${-38 + i * 6.2}" y="-8" width="5.6" height="16" rx="1.5" fill="#fff"/>`).join('')
  + [0, 1, 3, 4, 5, 7, 8].map((i) => `<rect x="${-34.2 + i * 6.2}" y="-8" width="3.6" height="9.6" rx="1" fill="#22222a"/>`).join('')
  + '<path d="M-48 -10 Q-30 -13 20 -12" stroke="#fff" stroke-width="1.6" fill="none" opacity=".35" stroke-linecap="round"/>';

// One maraca, held at 0,0, its head up.
const MARACA = (col, band) => '<rect x="-2.8" y="-14" width="5.6" height="28" rx="2.8" fill="#8c5a32"/>'
  + `<ellipse cy="-26" rx="11" ry="13.5" fill="${col}" stroke="rgba(0,0,0,.22)" stroke-width="1.4"/>`
  + `<path d="M-10 -30 Q0 -24 10 -30 M-10.8 -21 Q0 -15 10.8 -21" stroke="${band}" stroke-width="2.6" fill="none"/>`
  + '<ellipse cx="-4" cy="-31" rx="3" ry="4.6" fill="#fff" opacity=".4"/>';

// A drumstick, held at 0,0, its tip up.
const STICK = '<path d="M0 9 V-36" stroke="#9c7040" stroke-width="6.4" stroke-linecap="round"/><path d="M0 9 V-36" stroke="#e0b878" stroke-width="4.4" stroke-linecap="round"/>'
  + '<path d="M0 -36 V-44" stroke="#9c7040" stroke-width="4" stroke-linecap="round"/><path d="M0 -36 V-44" stroke="#e0b878" stroke-width="2.2" stroke-linecap="round"/>'
  + '<ellipse cy="-46" rx="3" ry="3.6" fill="#f1dcb0" stroke="#9c7040" stroke-width="1.2"/><path d="M-1 6 V-32" stroke="#fff" stroke-width="1" opacity=".45"/>';
// A snare drum on the floor in front, for the sticks.
const SNARE = '<path d="M69 192 V208 Q100 220 131 208 V192 Z" fill="#d9534f"/><path d="M69 198 Q100 208 131 198" stroke="#fff" stroke-width="2" fill="none" opacity=".35"/>'
  + [77, 88.5, 100, 111.5, 123].map((x) => `<rect x="${x - 1.6}" y="${196 + (x - 100) ** 2 / 300}" width="3.2" height="11" rx="1.2" fill="#d8d2c6" stroke="#8d929c" stroke-width=".8"/>`).join('')
  + '<path d="M69 208 Q100 220 131 208" stroke="#8d929c" stroke-width="3.2" fill="none"/>'
  + '<ellipse cx="100" cy="192" rx="31" ry="8.5" fill="#f6f2ea" stroke="#8d929c" stroke-width="3.2"/><ellipse cx="94" cy="191" rx="14" ry="3" fill="#fff" opacity=".7"/>';

// A tambourine, its middle at 0,0, held at its edge (right).
const TAMBOURINE = '<circle r="21" fill="#f7e7c4"/><circle r="21" fill="none" stroke="#a0683c" stroke-width="7"/><circle r="17.4" fill="none" stroke="#6a4129" stroke-width="1" opacity=".35"/>'
  + [-160, -115, -70, -25, 160, 115].map((a) => {
    const r = (a * Math.PI) / 180;
    return `<g transform="translate(${(21 * Math.cos(r)).toFixed(1)} ${(21 * Math.sin(r)).toFixed(1)}) rotate(${a + 90})"><rect x="-5" y="-2.6" width="10" height="5.2" rx="1" fill="#5e3a24"/><ellipse rx="4.2" ry="2.4" fill="#eef0f4" stroke="#8d929c" stroke-width="1"/></g>`;
  }).join('')
  + '<path d="M-11 -10 Q-4 -15 3 -14" stroke="#fff" stroke-width="2.4" fill="none" opacity=".6" stroke-linecap="round"/>';

// A microphone, held at 0,0, pointing up; its cord hangs from the end.
const MIC = '<path d="M0 12 Q4 24 -2 30 Q-8 38 0 46 Q6 52 2 62" stroke="#2c2c34" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
  + '<path d="M-4.5 -16 L4.5 -16 L3 12 L-3 12 Z" fill="#2c2c34"/><rect x="-5" y="-19" width="10" height="4" rx="1" fill="#55555f"/>'
  + '<circle cy="-27" r="9.5" fill="#b8bcc6"/><path d="M-6.6 -33.8 L6.6 -20.2 M-6.6 -20.2 L6.6 -33.8 M-9.4 -27 H9.4 M0 -36.4 V-17.6" stroke="#7d828d" stroke-width="1.2"/>'
  + '<circle cy="-27" r="9.5" fill="none" stroke="#6f7480" stroke-width="1.4"/><ellipse cx="-3.4" cy="-31" rx="2.6" ry="2" fill="#fff" opacity=".6"/>';

// A trumpet, pointing right: the mouthpiece at 0,0.
const TRUMPET = '<path d="M27 7 V13 Q27 17 31 17 H44 Q48 17 48 13 V4" stroke="#a8800f" stroke-width="4.8" fill="none"/><path d="M27 7 V13 Q27 17 31 17 H44 Q48 17 48 13 V4" stroke="#e5b93a" stroke-width="2.8" fill="none"/>'
  + `<path d="M0 -2.6 L5 -1.6 H50 L61 -6 Q65 -11 68 -12.5 V12.5 Q65 11 61 6 L50 1.6 H5 L0 2.6 Z" ${BRASS}/>`
  + '<ellipse cx="68" rx="2.6" ry="12.5" fill="#f2c94c" stroke="#a8800f" stroke-width="1.6"/><ellipse cx="68.6" rx="1.2" ry="9.6" fill="#a8800f" opacity=".5"/>'
  + [26, 32.5, 39].map((x) => `<rect x="${x - 2.6}" y="-8" width="5.2" height="15" rx="1.2" ${BRASS}/><rect x="${x - 1}" y="-13" width="2" height="5" fill="#a8800f"/><ellipse cx="${x}" cy="-13.5" rx="3" ry="1.6" fill="#fff3c4" stroke="#a8800f" stroke-width="1"/>`).join('')
  + '<path d="M8 -.4 H48 M53 -2 L62 -5" stroke="#fff" stroke-width="1.2" opacity=".55" stroke-linecap="round"/>'
  + '<path d="M0 -3.4 V3.4" stroke="#a8800f" stroke-width="2" stroke-linecap="round"/>';

// A conductor's baton, held at 0,0, pointing up.
const BATON = '<path d="M0 6 V-46" stroke="#5a3b1e" stroke-width="4.4" stroke-linecap="round"/><path d="M0 4 V-46" stroke="#fffdf7" stroke-width="2.6" stroke-linecap="round"/>'
  + '<path d="M0 10 V0" stroke="#8c5a32" stroke-width="7.5" stroke-linecap="round"/>';

// A handbell, its handle held at 0,0, hanging down.
const BELL = '<rect x="-3.2" y="-8" width="6.4" height="16" rx="3" fill="#5e3a24"/><rect x="-4.4" y="7" width="8.8" height="3" rx="1" fill="#a8800f"/>'
  + '<path d="M-10 13 Q-12 10 0 10 Q12 10 10 13 Q11 26 18 32 H-18 Q-11 26 -10 13 Z" fill="#e5b93a" stroke="#a8800f" stroke-width="2" stroke-linejoin="round"/>'
  + '<path d="M-18 32 Q0 37 18 32" stroke="#a8800f" stroke-width="2" fill="#c99a1f"/><path d="M-6 15 Q-8 24 -12 29" stroke="#fff" stroke-width="2.2" fill="none" opacity=".5" stroke-linecap="round"/>'
  + '<g class="av-clap" style="transform-origin:0px 24px"><path d="M0 24 V35" stroke="#7a5a10" stroke-width="1.6"/><circle cy="36" r="3.2" fill="#7a5a10"/></g>';

// A triangle on its loop of string, hanging from 0,0; and its beater, held at 0,0.
const TRIANGLE = '<path d="M0 0 L-2.4 11 M0 0 L2.4 11" stroke="#8d929c" stroke-width="1.4"/>'
  + '<path d="M-19 46 L0 12 L21 49 H-15.5" fill="none" stroke="#7d8494" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M-19 46 L0 12 L21 49 H-15.5" fill="none" stroke="#dfe2e8" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M2.4 18 L16 42" stroke="#fff" stroke-width="1.2" opacity=".9"/>';
const BEATER = '<path d="M0 6 V-36" stroke="#8d929c" stroke-width="2.6" stroke-linecap="round"/><path d="M0 6 V-4" stroke="#2c2c34" stroke-width="4.4" stroke-linecap="round"/>';

// A cowbell, its handle held at 0,0, its mouth to the right.
const COWBELL = '<rect x="-9" y="-3.4" width="18" height="6.8" rx="3.4" fill="#55555f"/>'
  + '<path d="M6 -9 L38 -15 L38 15 L6 9 Z" fill="#b8bcc6" stroke="#55555f" stroke-width="2.2" stroke-linejoin="round"/>'
  + '<path d="M6 -9 L38 -15 L42 -12 L10 -6.5 Z" fill="#dfe2e8" stroke="#55555f" stroke-width="1.6" stroke-linejoin="round"/>'
  + '<path d="M38 -15 L42 -12 V17 L38 15 Z" fill="#6f7480" stroke="#55555f" stroke-width="1.6" stroke-linejoin="round"/><ellipse cx="40" cy="1.5" rx="1.6" ry="13" fill="#2c2c34"/>'
  + '<path d="M11 -3 L33 -7.6" stroke="#fff" stroke-width="2.2" opacity=".55" stroke-linecap="round"/>';
const STICK_THIN = '<path d="M0 8 V-34" stroke="#b5874e" stroke-width="4.4" stroke-linecap="round"/><path d="M0 8 V-34" stroke="#e0b878" stroke-width="2.8" stroke-linecap="round"/>';

// A guiro, held at its left end (0,0), lying to the right; its scraper, held at 0,0.
const GUIRO = '<path d="M-8 0 Q-8 -9 6 -10 Q30 -13 50 -12 Q66 -10 66 0 Q66 10 50 12 Q30 13 6 10 Q-8 9 -8 0 Z" fill="#d2a05e" stroke="#8c5a32" stroke-width="2.2"/>'
  + '<path d="M4 -8.6 Q30 -12 52 -10.6" stroke="#f0cf96" stroke-width="3" fill="none" opacity=".8"/>'
  + Array.from({ length: 11 }, (_, i) => `<path d="M${10 + i * 4.2} ${-10.6 - (i > 4 ? 0.4 : 0)} q-1.4 5 0 9" stroke="#7a4c2a" stroke-width="1.7" fill="none"/>`).join('')
  + '<ellipse cx="26" cy="6.4" rx="3.2" ry="2.2" fill="#4a2c1a"/><ellipse cx="40" cy="6.4" rx="3.2" ry="2.2" fill="#4a2c1a"/>'
  + '<path d="M66 0 Q70 -1 71 2" stroke="#8c5a32" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
const SCRAPER = '<path d="M0 8 V-30" stroke="#4a2c1a" stroke-width="3.4" stroke-linecap="round"/><path d="M0 8 V-30" stroke="#8c5a32" stroke-width="1.6" stroke-linecap="round"/>'
  + '<path d="M-2.6 -27 L-2.6 -33 M0 -27 V-34 M2.6 -27 V-33" stroke="#4a2c1a" stroke-width="1.4" stroke-linecap="round"/>';

// A gong on its cord, hanging from 0,0; its mallet, held at 0,0.
const GONG = '<path d="M0 0 L-9 12 M0 0 L9 12" stroke="#8d929c" stroke-width="1.4"/>'
  + '<circle cy="28" r="17.5" fill="#e5b93a" stroke="#a8800f" stroke-width="3"/><circle cy="28" r="12" fill="none" stroke="#a8800f" stroke-width="1" opacity=".5"/>'
  + '<circle cy="28" r="6.5" fill="#f2c94c" stroke="#a8800f" stroke-width="1.6"/><path d="M-10 20 Q-6 15 0 14" stroke="#fff" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/>';
const MALLET = '<path d="M0 6 V-28" stroke="#8c5a32" stroke-width="3.6" stroke-linecap="round"/><ellipse cy="-31" rx="6.4" ry="7.4" fill="#d9534f" stroke="#9e2f2b" stroke-width="1.6"/><ellipse cx="-2" cy="-34" rx="1.8" ry="2.4" fill="#fff" opacity=".45"/>';
const XY_MALLET = (col) => `<path d="M0 6 V-28" stroke="#c99a5c" stroke-width="3.4" stroke-linecap="round"/><circle cy="-31" r="5.4" fill="${col}" stroke="rgba(0,0,0,.3)" stroke-width="1.2"/><circle cx="-1.6" cy="-32.6" r="1.4" fill="#fff" opacity=".6"/>`;

// A lap harp on the lap, beside the belly: its column up the left, the soundbox slanting up to
// the right, the neck curling between them; the strings (every C red) run down from the neck.
const HARP = '<path d="M110 206 L152 154" stroke="#6a4129" stroke-width="11" stroke-linecap="round"/><path d="M110 206 L152 154" stroke="#a0683c" stroke-width="7.5" stroke-linecap="round"/>'
  + '<path d="M112.5 197 L147.5 161" stroke="#c99a5c" stroke-width="2" opacity=".7"/>'
  + '<path d="M112 141.9 V201.5" stroke="#e05a5a" stroke-width="1.3"/><path d="M117 140.2 V195.3" stroke="#fff3c4" stroke-width="1.3"/><path d="M122 140.1 V189.1" stroke="#fff3c4" stroke-width="1.3"/><path d="M127 141.6 V183.0" stroke="#e05a5a" stroke-width="1.3"/><path d="M132 144.5 V176.8" stroke="#fff3c4" stroke-width="1.3"/><path d="M137 148.0 V170.6" stroke="#fff3c4" stroke-width="1.3"/><path d="M142 150.1 V164.4" stroke="#e05a5a" stroke-width="1.3"/><path d="M147 150.7 V158.2" stroke="#fff3c4" stroke-width="1.3"/>'
  + '<path d="M106 144 Q118 132 132 142 Q144 152 154 146" stroke="#a8800f" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M106 144 Q118 132 132 142 Q144 152 154 146" stroke="#f2c94c" stroke-width="4" fill="none" stroke-linecap="round"/>'
  + '<path d="M106 208 V142" stroke="#a8800f" stroke-width="8" stroke-linecap="round"/><path d="M106 206 V144" stroke="#f2c94c" stroke-width="4.6" stroke-linecap="round"/>'
  + '<circle cx="106" cy="138" r="5" fill="#f2c94c" stroke="#a8800f" stroke-width="1.8"/><path d="M98 209 H116" stroke="#a8800f" stroke-width="5" stroke-linecap="round"/>';

// A xylophone on the lap; bongos on the floor in front.
const XYLOPHONE = '<path d="M58 182 H142 M60 202 H140" stroke="#8c5a32" stroke-width="5" stroke-linecap="round"/>'
  + ['#e05a5a', '#f29a3c', '#f2c94c', '#6cbf6a', '#5b8fd9', '#9a6ad6', '#ee6fa0'].map((col, i) => `<rect x="${63 + i * 11}" y="${176 + i}" width="9" height="${32 - 2 * i}" rx="2.5" fill="${col}" stroke="rgba(0,0,0,.25)" stroke-width="1"/><circle cx="${67.5 + i * 11}" cy="${180 + i}" r="1.3" fill="#fff" opacity=".8"/>`).join('');
const BONGOS = '<rect x="70" y="190" width="30" height="26" rx="5" fill="#a0683c" stroke="#6a4129" stroke-width="2"/><rect x="104" y="194" width="24" height="22" rx="5" fill="#a0683c" stroke="#6a4129" stroke-width="2"/>'
  + '<rect x="98" y="198" width="8" height="8" fill="#b8bcc6"/><ellipse cx="85" cy="190" rx="16" ry="5.5" fill="#f3e6c4" stroke="#6a4129" stroke-width="2"/><ellipse cx="116" cy="194" rx="13" ry="4.6" fill="#f3e6c4" stroke="#6a4129" stroke-width="2"/>'
  + '<path d="M74 200 H96 M108 203 H124" stroke="#6a4129" stroke-width="2" opacity=".5"/>';

// The golden brush (a boss trophy), held at 0,0, pointing up.
const BRUSH = '<rect x="-3.5" y="-10" width="7" height="22" rx="3" fill="#e5b93a" stroke="#a8800f" stroke-width="1.6"/><ellipse cy="-26" rx="12" ry="16.5" fill="#f2c94c" stroke="#a8800f" stroke-width="2"/>'
  + '<ellipse cy="-26" rx="8.4" ry="12.4" fill="#fff3c4"/>' + dots([[-3.6, -33, 1.3], [0, -35, 1.3], [3.6, -33, 1.3], [-4.6, -27, 1.3], [0, -28, 1.3], [4.6, -27, 1.3], [-3.6, -21, 1.3], [0, -20, 1.3], [3.6, -21, 1.3], [0, -15, 1.3]], '#a8800f');
// The feather wand (a boss trophy), held at 0,0, pointing up; the feathers swing from its tip.
const WAND = (a) => '<path d="M0 6 Q2.4 -24 0 -52" stroke="#5e3a24" stroke-width="4.4" fill="none" stroke-linecap="round"/><path d="M0 6 Q2.4 -24 0 -52" stroke="#a0683c" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
  + `<g class="av-dangle" style="transform-origin:0px -52px"><g transform="translate(0 -52) rotate(${-a})"><path d="M0 0 Q-4 10 0 20" stroke="#8d929c" stroke-width="1.2" fill="none"/>`
  + '<path d="M0 20 Q-12 26 -10 40 Q-2 32 0 20 Z" fill="#ee6fa0"/><path d="M0 20 Q12 26 10 40 Q2 32 0 20 Z" fill="#5ad1e6"/><path d="M0 20 Q-5 30 -3 44" stroke="#9a6ad6" stroke-width="3.4" fill="none" stroke-linecap="round"/>'
  + '<path d="M0 20 Q3 32 1 46" stroke="#f2c94c" stroke-width="3.4" fill="none" stroke-linecap="round"/><circle cy="20" r="2.4" fill="#c9961a"/></g></g>';

// A hand on its hip, for the arm with nothing to do.
const HIP_L = { s: [62, 158], e: [42, 178], p: [60, 194], layer: 'back', k: 20 };

export const HOLDS = {
  none: { play: 'none' },
  maracas: {
    play: 'shake', tile: at(90, 120, -22, MARACA('#d9534f', '#f2c94c')) + at(110, 122, 22, MARACA('#d9534f', '#f2c94c')),
    l: { s: [64, 158], e: [44, 178], p: [42, 148], held: at(42, 148, -14, MARACA('#d9534f', '#f2c94c')), moves: { dn: -16, dnf: -6, dng: -142 } },
    r: { s: [136, 158], e: [156, 178], p: [158, 148], held: at(158, 148, 14, MARACA('#d9534f', '#f2c94c')), moves: { dn: 16, dnf: 6, dng: 142 } },
  },
  sticks: {
    play: 'drum', extra: SNARE,
    l: { s: [64, 158], e: [48, 182], p: [70, 178], held: at(70, 178, 28, STICK) },
    r: { s: [136, 158], e: [152, 182], p: [130, 178], held: at(130, 178, -28, STICK) },
  },
  mic: {
    play: 'sing',
    l: { ...HIP_L, moves: { up: 150, upf: -20 } },
    r: { s: [136, 158], e: [154, 176], p: [126, 150], layer: 'top', held: at(126, 150, -30, MIC), moves: { up: 0, upf: 0, wo: 0, wof: 0 } },
  },
  tambourine: {
    play: 'shake', lead: 'l',
    l: { s: [66, 158], e: [76, 182], p: [104, 158] },
    r: { s: [134, 158], e: [156, 176], p: [142, 158], held: at(124, 150, 0, TAMBOURINE) },
  },
  baton: {
    play: 'conduct',
    l: { s: [64, 158], e: [44, 168], p: [44, 140], held: at(44, 140, -40, BATON), moves: { dnf: 26 } },
    r: { s: [136, 158], e: [156, 170], p: [152, 140], k: -80 },
  },
  trumpet: {
    play: 'blow', top: at(102, 114, -12, TRUMPET),
    l: { s: [70, 156], e: [90, 170], p: [113, 120], layer: 'top', k: -40, still: true },
    r: { s: [134, 156], e: [158, 150], p: [133, 113], layer: 'top', k: -100, still: true },
  },
  guitar: {
    play: 'strum', front: at(92, 184, 58, UKE, 0.86),
    l: { s: [66, 160], e: [52, 180], p: [96, 192], held: at(96, 192, 20, PICK), moves: { up: -6, upf: -75 } },
    r: { s: [134, 158], e: [162, 174], p: [148, 150], k: -150, still: true },
  },
  keytar: {
    play: 'strum', front: at(98, 188, -26, KEYTAR),
    l: { s: [64, 158], e: [56, 186], p: [84, 194], k: 60 },
    r: { s: [136, 158], e: [154, 182], p: [158, 156], k: -150, still: true },
  },
  harp: {
    play: 'strum', front: HARP,
    l: { s: [66, 158], e: [80, 188], p: [116, 178], k: -20 },
    r: { s: [134, 158], e: [160, 176], p: [140, 160], k: 200 },
  },
  xylophone: {
    play: 'drum', front: `<g transform="rotate(-4 100 192)">${XYLOPHONE}</g>`,
    l: { s: [64, 158], e: [48, 178], p: [72, 168], held: at(72, 168, 142, XY_MALLET('#f2f2f2')) },
    r: { s: [136, 158], e: [152, 178], p: [128, 168], held: at(128, 168, -142, XY_MALLET('#f2f2f2')) },
  },
  gong: {
    play: 'drum', lead: 'l',
    l: { s: [66, 158], e: [76, 184], p: [108, 168], held: at(108, 168, 66, MALLET) },
    r: { s: [134, 158], e: [158, 162], p: [152, 126], held: at(152, 126, 0, GONG), k: -90, hangs: true },
  },
  bongos: {
    play: 'drum', front: BONGOS,
    l: { s: [64, 158], e: [52, 184], p: [84, 184], k: 90 },
    r: { s: [136, 158], e: [148, 186], p: [116, 188], k: 90 },
  },
  guiro: {
    play: 'strum', lead: 'l',
    l: { s: [64, 158], e: [40, 172], p: [76, 146], held: at(76, 146, -196, SCRAPER), k: 80, moves: { dn: -10, dnf: -24 } },
    r: { s: [136, 158], e: [150, 190], p: [130, 182], held: at(130, 182, 3, flip(GUIRO)), moves: { dn: -6, dnf: -8 } },
  },
  cowbell: {
    play: 'drum', lead: 'l',
    l: { s: [64, 158], e: [46, 184], p: [66, 178], held: at(66, 178, 46, STICK_THIN) },
    r: { s: [136, 158], e: [150, 182], p: [130, 158], held: at(130, 158, 6, flip(COWBELL)) },
  },
  triangle: {
    play: 'ring', lead: 'l',
    l: { s: [64, 158], e: [46, 184], p: [76, 182], held: at(76, 182, 70, BEATER) },
    r: { s: [136, 158], e: [152, 170], p: [120, 140], held: at(120, 140, 0, flip(TRIANGLE)), k: -90, hangs: true },
  },
  // Boss trophies.
  brush: {
    play: 'sing',
    l: { s: [64, 158], e: [42, 162], p: [30, 140], k: -120, moves: { dn: -34, dnf: -87 } },
    r: { s: [136, 158], e: [156, 176], p: [128, 154], layer: 'top', held: at(128, 154, -22, BRUSH), moves: { up: 0, upf: 0, wo: 0, wof: 0 } },
  },
  wand: {
    play: 'conduct',
    r: { s: [136, 158], e: [158, 170], p: [150, 140], held: at(150, 140, 16, WAND(16)) },
  },
  // A mastery prize: a handbell.
  bell: {
    play: 'ring',
    r: { s: [136, 158], e: [158, 170], p: [158, 142], held: at(158, 142, 0, BELL), k: -60 },
  },
};

/* A held thing by itself (the closet's tiles): what is on the body and in each paw. */
export const holdArt = (h) => h.tile || (h.front || '') + (h.top || '') + (h.l?.held || '') + (h.r?.held || '');

/* ---------- backgrounds ---------- */
const notesBg = () => [[24, 40, -12], [168, 30, 10], [30, 150, 8], [176, 168, -8], [100, 14, 0]]
  .map(([x, y, a]) => `<g transform="translate(${x} ${y}) rotate(${a})" fill="#c99a4f" opacity=".55"><ellipse cx="0" cy="12" rx="7" ry="5" transform="rotate(-20)"/><rect x="5" y="-12" width="2.6" height="24"/><path d="M7.6 -12 Q16 -6 13 4 Q13 -3 7.6 -5 Z"/></g>`).join('');

export const BGS = {
  plain: () => '<rect width="200" height="220" fill="#F6F1E4"/>',
  mint: () => '<rect width="200" height="220" fill="#DCE6D2"/>',
  notes: () => `<rect width="200" height="220" fill="#F2E3C4"/>${notesBg()}`,
  rainbow: () => '<rect width="200" height="220" fill="#cfe9f7"/>'
    + ['#e05a5a', '#f29a3c', '#f2c94c', '#6cbf6a', '#5b8fd9', '#9a6ad6'].map((c, i) => `<path d="M${-10 + i * 9} 190 A${110 - i * 9} ${110 - i * 9} 0 0 1 ${210 - i * 9} 190" stroke="${c}" stroke-width="9" fill="none"/>`).join('')
    + '<ellipse cx="30" cy="196" rx="34" ry="16" fill="#fff"/><ellipse cx="172" cy="196" rx="34" ry="16" fill="#fff"/>',
  beach: () => '<rect width="200" height="220" fill="#bfe6f5"/><circle cx="160" cy="40" r="18" fill="#ffe08a"/><circle cx="160" cy="40" r="26" fill="#ffe08a" opacity=".3"/>'
    + '<path d="M0 140 H200 V178 H0 Z" fill="#4fa3d1"/><path d="M0 146 Q12 140 25 146 T50 146 T75 146 T100 146 T125 146 T150 146 T175 146 T200 146" stroke="#bfe6f5" stroke-width="2.5" fill="none"/>'
    + '<path d="M0 172 Q100 160 200 172 V220 H0 Z" fill="#f3d9a4"/><path d="M24 200 q6 -10 12 0 Z" fill="#f2a6b8"/><path d="M30 31 Q40 24 50 31 M44 50 Q52 44 60 50" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>',
  forest: () => '<rect width="200" height="220" fill="#dff0d8"/><path d="M0 150 Q50 120 100 140 Q150 116 200 138 V220 H0 Z" fill="#b8d8a4"/>'
    + [[18, 168, 1.1], [52, 156, 0.8], [154, 152, 0.9], [186, 168, 1.2]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -60 L22 -10 H12 L28 20 H-28 L-12 -10 H-22 Z" fill="#3f8a3d"/><rect x="-4" y="20" width="8" height="12" fill="#6a4129"/></g>`).join('')
    + '<path d="M0 190 Q100 176 200 190 V220 H0 Z" fill="#8cc06e"/>' + dots([[40, 204, 3], [140, 206, 3], [96, 212, 2.6]], '#fff7c9'),
  stars: () => `<rect width="200" height="220" fill="#24305e"/>${star(30, 34, 7, '#fff3c4')}${star(170, 50, 9, '#f2c94c')}${star(160, 170, 6, '#fff3c4')}${star(26, 150, 8, '#f2c94c')}${star(100, 14, 5, '#fff')}${dots([[60, 20, 1.6], [140, 20, 1.4], [184, 110, 1.8], [14, 96, 1.5], [52, 196, 1.6], [130, 200, 1.4]], '#fff')}`,
  stage: () => '<rect width="200" height="220" fill="#3a1f24"/><rect y="176" width="200" height="44" fill="#a0683c"/><path d="M0 186 H200 M0 200 H200" stroke="#7a4c2a" stroke-width="2"/>'
    + '<path d="M0 0 H40 Q30 90 44 180 H0 Z" fill="#a8423a"/><path d="M200 0 H160 Q170 90 156 180 H200 Z" fill="#a8423a"/><path d="M10 0 Q4 90 14 180 M26 0 Q20 90 30 180 M190 0 Q196 90 186 180 M174 0 Q180 90 170 180" stroke="#7d2e28" stroke-width="3" fill="none"/>'
    + '<path d="M0 0 H200 V16 Q150 28 100 16 Q50 28 0 16 Z" fill="#c4505f"/>',
  spotlight: (id) => `<defs><radialGradient id="S${id}" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="#fff3c4" stop-opacity=".8"/><stop offset=".55" stop-color="#fff3c4" stop-opacity=".15"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></radialGradient></defs>`
    + `<rect width="200" height="220" fill="#17241c"/><path d="M84 0 H116 L190 220 H10 Z" fill="url(#S${id})"/><ellipse cx="100" cy="212" rx="80" ry="12" fill="#fff3c4" opacity=".35"/>`,
  concert: (id) => `<defs><linearGradient id="B${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`
    + '<rect width="200" height="220" fill="#1d1838"/>'
    + [['#ee6fa0', 30, -20], ['#5ad1e6', 100, 0], ['#f2c94c', 170, 20]].map(([c, x, a]) => `<path d="M${x - 8} 0 H${x + 8} L${x + 40 + a} 220 H${x - 40 + a} Z" fill="${c}" opacity=".22"/>`).join('')
    + `<path d="M0 0 H200 V30 H0 Z" fill="url(#B${id})" opacity=".3"/>`
    + Array.from({ length: 11 }, (_, i) => `<circle cx="${i * 20 + (i % 2) * 6}" cy="${206 - (i % 3) * 3}" r="13" fill="#0d0b1c"/>`).join('')
    + '<path d="M28 198 L22 172 M30 180 L18 176 M152 196 L160 168 M156 178 L168 172" stroke="#0d0b1c" stroke-width="6" stroke-linecap="round"/>',
  space: () => `<rect width="200" height="220" fill="#2a1a4a"/>${dots([[20, 30, 1.6], [70, 14, 1.2], [150, 24, 1.8], [186, 90, 1.3], [12, 120, 1.5], [40, 200, 1.4], [176, 200, 1.6], [120, 8, 1]], '#fff')}`
    + '<circle cx="164" cy="160" r="22" fill="#e3893b"/><ellipse cx="164" cy="160" rx="36" ry="8" stroke="#f2c94c" stroke-width="4" fill="none" transform="rotate(-18 164 160)"/>'
    + '<circle cx="34" cy="64" r="12" fill="#6cbf6a"/><circle cx="30" cy="60" r="3" fill="#4a9748"/>',
  // A boss trophy: Saturday Night Fur's light-up floor.
  disco: (id) => `<defs><radialGradient id="D${id}" cx="50%" cy="20%" r="70%"><stop offset="0" stop-color="#ffffff" stop-opacity=".35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>`
    + '<rect width="200" height="220" fill="#2b1446"/>' + `<rect width="200" height="160" fill="url(#D${id})"/>`
    + [[-30, '#ee6fa0'], [-10, '#5ad1e6'], [10, '#f2c94c'], [30, '#9fe0c4']].map(([a, c]) => `<path d="M100 26 L${100 + a * 4 - 14} 170 H${100 + a * 4 + 14} Z" fill="${c}" opacity=".16"/>`).join('')
    + '<path d="M100 0 V12" stroke="#c9ccd4" stroke-width="2"/><circle cx="100" cy="26" r="15" fill="#c9ccd4"/>'
    + [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([i, j]) => `<rect x="${95 + i * 8}" y="${21 + j * 8}" width="6.5" height="6.5" fill="${(i + j) % 2 ? '#eef0f4' : '#9aa3b5'}"/>`).join('')
    + `<circle cx="100" cy="26" r="15" fill="none" stroke="#7d8494" stroke-width="1.4"/>${glint(92, 18, 4)}`
    + Array.from({ length: 20 }, (_, k) => {
      const i = k % 5;
      const j = Math.floor(k / 5);
      const cols = ['#ee6fa0', '#5ad1e6', '#f2c94c', '#9a6ad6', '#6cbf6a'];
      return `<rect x="${i * 40}" y="${170 + j * 13}" width="40" height="13" fill="${cols[(i + j * 2) % 5]}" opacity="${(i + j) % 2 ? 0.85 : 0.55}"/>`;
    }).join('')
    + '<path d="M0 170 H200" stroke="#fff" stroke-width="1.5" opacity=".5"/>',
};
