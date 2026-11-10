/* Bindi and Rusty, rigged: Kyle's other two cats, for Supper Time (scene-supper.js).
   Bindi is a fluffy black cat with a white locket on her chest, pale green eyes and a very
   big voice. Rusty is a huge brown tabby Maine Coon: lynx tufts on his ears, a lion's ruff,
   a tail like a feather duster and a permanent frown.
   Same family as rig.js (Mookie): parts on damped springs, drawn in one SVG, front view.
     const c = rigCat('rusty');  stage.append(c.el);
     c.mood('sneak');  c.step();  c.look(1, 0);  c.reach(x, y)  (page px)  c.beat(down, spb, tier)
     c.set('mask')  c.poof(1.3)  c.say(200)
   Moods: idle, sneak, freeze, smug, yowl, shock, dizzy, eat, sad, happy, sleepy.
   Props (classes on the svg): mask (bandit), shades, bib, crumbs, stars, sweat.
   Fixed markup only: nothing a learner types goes in here. Stops itself when removed. */

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

const LOOKS = {
  bindi: {
    fur: '#18171b', fur2: '#2f2c34', edge: '#3a3740', light: '#18171b', chest: '#f3efe8', eye: '#cfe6a0',
    pupil: '#0c0c0e', nose: '#3d2e33', ear: '#4a3a40', tuft: '#9a94a0', whisker: '#fff', mouth: '#7a6e7c',
    arm: 15, paw: 10, tail: [6, 13], lid: 0.04, slit: false,
  },
  rusty: {
    fur: '#8d6b47', fur2: '#a98458', edge: '#5e4530', dark: '#3a2a1d', light: '#dcc6a0', chest: '#efe4cf', eye: '#cdc65c',
    pupil: '#141008', nose: '#b8756a', ear: '#c99488', tuft: '#efe4cf', whisker: '#fff', mouth: '#4a3426',
    arm: 19, paw: 12, tail: [8, 17], lid: 0.3, slit: true,
  },
};

/* Seeded random, so the fur grows the same way every time. */
function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const f1 = (n) => n.toFixed(1);

/* A furry outline: an egg with tufts that all sweep the same way. top/bottom widen or narrow
   the upper and lower halves; flat cuts the bottom off at a floor line. Mookie's coat in
   Brushing Time (rig.js) and Rusty's shed coat use it too. */
export function fur(cx, cy, rx, ry, { tufts = 20, amp = 5, seed = 1, flat = null, top = 1, bottom = 1 } = {}) {
  const r = rng(seed);
  const n = tufts * 2;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = Math.sin(a);
    const w = s < 0 ? 1 + (top - 1) * -s : 1 + (bottom - 1) * s;
    const out = i % 2 ? amp * (0.55 + r() * 0.9) : -amp * 0.2;
    let x = cx + Math.cos(a) * (rx * w + out);
    let y = cy + s * (ry + out);
    if (flat != null && y > flat) y = flat + (i % 2 ? 1.2 : 0);
    pts.push([x, y]);
  }
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 1; i <= n; i++) {
    const a = pts[i - 1];
    const b = pts[i % n];
    const k = i % 2 ? 0.24 : -0.1;
    const mx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * k;
    const my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * k;
    d += ` Q${f1(mx)} ${f1(my)} ${f1(b[0])} ${f1(b[1])}`;
  }
  return `${d}Z`;
}

function markup(kind, id) {
  const c = LOOKS[kind];
  const rusty = kind === 'rusty';
  const body = rusty
    ? fur(100, 154, 47, 50, { tufts: 22, amp: 6, seed: 7, flat: 202, top: 0.8, bottom: 1.05 })
    : fur(100, 156, 41, 47, { tufts: 18, amp: 5, seed: 3, flat: 202, top: 0.78 });
  const head = rusty
    ? fur(100, 76, 49, 39, { tufts: 24, amp: 5, seed: 11, bottom: 1.16 })
    : fur(100, 78, 45, 37, { tufts: 20, amp: 4.5, seed: 5, bottom: 1.12 });
  const ruff = rusty ? fur(100, 116, 44, 20, { tufts: 16, amp: 8, seed: 13 }) : '';
  const belly = rusty ? fur(100, 160, 24, 34, { tufts: 12, amp: 4, seed: 17, flat: 196 }) : '';
  const locket = rusty ? '' : fur(100, 127, 6, 7, { tufts: 6, amp: 1.6, seed: 19 });
  const eyes = rusty ? { rx: 11, ry: 9, y: 79 } : { rx: 12.5, ry: 13, y: 77 };
  const eye = (cx) => `<g class="k-eye" data-x="${cx}">
      <clipPath id="${id}-e${cx}"><ellipse cx="${cx}" cy="${eyes.y}" rx="${eyes.rx}" ry="${eyes.ry}"/></clipPath>
      <ellipse cx="${cx}" cy="${eyes.y}" rx="${eyes.rx}" ry="${eyes.ry}" fill="${c.eye}" stroke="${c.edge}" stroke-width="1.2"/>
      <g clip-path="url(#${id}-e${cx})">
        <ellipse class="k-pupil" cx="${cx}" cy="${eyes.y + 1}" rx="${rusty ? 2.6 : 5}" ry="${rusty ? 7.5 : 7}" fill="${c.pupil}"/>
        <circle cx="${cx + 3.5}" cy="${eyes.y - 4}" r="2.4" fill="#fff" opacity=".85"/>
        <rect class="k-lid" x="${cx - eyes.rx - 2}" y="${eyes.y - eyes.ry - 2}" width="${eyes.rx * 2 + 4}" height="${eyes.ry * 2 + 4}" fill="${c.fur}"/>
        <path class="k-lid-edge" d="M${cx - eyes.rx - 2} ${eyes.y - eyes.ry} H${cx + eyes.rx + 2}" stroke="${c.edge}" stroke-width="2"/>
      </g></g>`;
  const ear = (side) => {
    const m = side === 'l' ? 1 : -1;
    const X = (x) => f1(100 + (x - 100) * m);
    const tip = rusty ? [52, 4] : [56, 17];
    const lynx = rusty
      ? `<path d="M${X(49)} 8 Q${X(46)} -2 ${X(50)} -9 Q${X(53)} -1 ${X(56)} 9 Z" fill="${c.dark}"/>`
      : '';
    return `<g class="k-ear-${side}">
      <path d="M${X(rusty ? 56 : 60)} ${rusty ? 60 : 62} Q${X(rusty ? 46 : 51)} ${rusty ? 30 : 36} ${X(tip[0])} ${tip[1]} Q${X(rusty ? 76 : 78)} ${rusty ? 20 : 27} ${X(93)} ${rusty ? 40 : 44} Z" fill="${c.fur}" stroke="${c.edge}" stroke-width="1"/>
      <path d="M${X(rusty ? 63 : 65)} ${rusty ? 54 : 56} Q${X(rusty ? 57 : 60)} ${rusty ? 34 : 40} ${X(rusty ? 57 : 61)} ${rusty ? 18 : 28} Q${X(76)} ${rusty ? 30 : 34} ${X(86)} ${rusty ? 44 : 47} Z" fill="${c.ear}"/>
      <path d="M${X(66)} 52 Q${X(68)} 40 ${X(64)} 32 M${X(70)} 50 Q${X(73)} 42 ${X(71)} 34 M${X(74)} 50 Q${X(78)} 44 ${X(77)} 38" stroke="${c.tuft}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".9"/>
      ${lynx}</g>`;
  };
  const stripes = rusty ? `
    <g class="k-stripes" stroke="${c.dark}" stroke-linecap="round" fill="none">
      <path d="M86 52 L90 41 L96 50 L100 39 L104 50 L110 41 L114 52" stroke-width="3"/>
      <path d="M100 39 V30 M93 44 L91 33 M107 44 L109 33" stroke-width="2.6"/>
      <path d="M57 74 Q64 76 69 72 M56 82 Q64 84 70 80 M143 74 Q136 76 131 72 M144 82 Q136 84 130 80" stroke-width="2.4"/>
      <path d="M84 70 Q80 64 74 64 M116 70 Q120 64 126 64" stroke-width="1.6" stroke="${c.light}"/>
    </g>` : `
    <g class="k-sheen" stroke="${c.fur2}" stroke-width="1.6" fill="none" stroke-linecap="round">
      <path d="M78 52 Q86 46 96 47 M106 47 Q115 46 122 52 M64 92 Q60 98 63 104 M136 92 Q140 98 137 104"/></g>`;
  const muzzle = rusty
    ? `<ellipse cx="100" cy="99" rx="18" ry="11" fill="${c.light}"/><ellipse cx="100" cy="109" rx="10" ry="5.5" fill="${c.chest}"/>
       <path d="M90 64 Q100 60 110 64" stroke="${c.light}" stroke-width="2" fill="none" opacity=".6"/>`
    : '';
  const brows = rusty
    ? `<g class="k-brows" stroke="${c.dark}" stroke-width="3.2" stroke-linecap="round">
         <path class="k-brow-l" d="M70 66 L92 70"/><path class="k-brow-r" d="M130 66 L108 70"/></g>`
    : `<g class="k-brows" stroke="${c.fur2}" stroke-width="2.4" stroke-linecap="round">
         <path class="k-brow-l" d="M72 62 L90 63"/><path class="k-brow-r" d="M128 62 L110 63"/></g>`;
  const ny = rusty ? 92 : 91;
  const legBands = rusty ? `<path class="k-band" fill="none" stroke="${c.dark}" stroke-width="${c.arm + 0.5}" stroke-dasharray="3 8" stroke-linecap="butt"/>` : '';
  const arm = (side) => `<g class="k-arm-${side}"><path class="k-arm" fill="none" stroke="${c.fur}" stroke-width="${c.arm}" stroke-linecap="round"/>
      ${legBands}${side === 'r' ? `<path class="k-smear" fill="none" stroke="${c.fur}" stroke-opacity=".35" stroke-width="${c.arm + 8}" stroke-linecap="round"/>` : ''}
      <g class="k-paw"><ellipse rx="${c.paw}" ry="${c.paw * 0.85}" fill="${rusty ? c.light : c.fur}" stroke="${c.edge}" stroke-width="1.4"/>
        <path d="M-3.5 ${c.paw * 0.85} V${c.paw * 0.3} M3.5 ${c.paw * 0.85} V${c.paw * 0.3}" stroke="${c.edge}" stroke-width="1.2"/></g></g>`;
  return `
<g class="k-root">
  <g class="k-tail"></g>
  <g class="k-feet"><ellipse class="k-foot-l" cx="80" cy="200" rx="${rusty ? 17 : 14}" ry="8" fill="${rusty ? c.light : c.fur}" stroke="${c.edge}" stroke-width="1"/>
    <ellipse class="k-foot-r" cx="120" cy="200" rx="${rusty ? 17 : 14}" ry="8" fill="${rusty ? c.light : c.fur}" stroke="${c.edge}" stroke-width="1"/></g>
  <g class="k-body">
    <path d="${body}" fill="${c.fur}" stroke="${c.edge}" stroke-width="1.2"/>
    ${rusty ? `<path d="${belly}" fill="${c.light}"/>
      <g stroke="${c.dark}" stroke-width="3.4" fill="none" stroke-linecap="round">
        <path d="M60 140 Q68 146 74 140 M57 158 Q66 166 74 158 M59 176 Q67 183 74 177 M140 140 Q132 146 126 140 M143 158 Q134 166 126 158 M141 176 Q133 183 126 177"/></g>`
    : `<g stroke="${c.fur2}" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M70 150 Q66 160 70 172 M130 150 Q134 160 130 172 M84 182 Q88 188 94 188"/></g>
      <path d="${locket}" fill="${c.chest}"/>`}
  </g>
  ${rusty ? `<path class="k-ruff" d="${ruff}" fill="${c.light}" stroke="${c.fur2}" stroke-width="1"/>` : ''}
  ${arm('l')}${arm('r')}
  <g class="k-bib"><path d="M76 112 L124 112 L100 150 Z" fill="#fff" stroke="#d8d0c4" stroke-width="1.5"/>
    <path d="M84 118 H116 M90 128 H110 M95 138 H105" stroke="#e05a4f" stroke-width="3" stroke-dasharray="4 4"/>
    <circle cx="76" cy="112" r="4" fill="#fff" stroke="#d8d0c4"/><circle cx="124" cy="112" r="4" fill="#fff" stroke="#d8d0c4"/></g>
  <g class="k-head">
    ${ear('l')}${ear('r')}
    <path d="${head}" fill="${c.fur}" stroke="${c.edge}" stroke-width="1.2"/>
    ${stripes}${muzzle}
    <g class="k-eyes-open">${eye(81)}${eye(119)}</g>
    <g class="k-eyes-happy" stroke="${c.eye}" stroke-width="4.5" fill="none" stroke-linecap="round">
      <path d="M70 80 Q81 68 92 80"/><path d="M108 80 Q119 68 130 80"/></g>
    <g class="k-eyes-shut" stroke="${c.eye}" stroke-width="3.6" fill="none" stroke-linecap="round">
      <path d="M70 78 Q81 86 92 78"/><path d="M108 78 Q119 86 130 78"/></g>
    <g class="k-eyes-dizzy" stroke="${c.eye}" stroke-width="2.6" fill="none" stroke-linecap="round">
      <path d="M81 77 m-1 0 a1 1 0 1 1 2 0 a3 3 0 1 1 -6 0 a5 5 0 1 1 10 0 a7 7 0 1 1 -14 0"/>
      <path d="M119 77 m-1 0 a1 1 0 1 1 2 0 a3 3 0 1 1 -6 0 a5 5 0 1 1 10 0 a7 7 0 1 1 -14 0"/></g>
    ${brows}
    <path d="M94.5 ${ny} L105.5 ${ny} L100 ${ny + 6} Z" fill="${c.nose}" stroke="${c.edge}" stroke-width=".8"/>
    <path class="k-mouth m-w" d="M100 ${ny + 6} Q96 ${ny + 11} 91 ${ny + 9} M100 ${ny + 6} Q104 ${ny + 11} 109 ${ny + 9}" stroke="${c.mouth}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path class="k-mouth m-flat" d="M100 ${ny + 6} V${ny + 9} M90 ${ny + 12} Q100 ${ny + 8} 110 ${ny + 12}" stroke="${c.mouth}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <g class="k-mouth m-open"><path d="M90 ${ny + 8} Q100 ${ny + 22} 110 ${ny + 8} Z" fill="#c9707e" stroke="${c.mouth}" stroke-width="1.2"/></g>
    <g class="k-mouth m-yowl"><path d="M84 ${ny + 7} Q100 ${ny + 1} 116 ${ny + 7} Q118 ${ny + 34} 100 ${ny + 36} Q82 ${ny + 34} 84 ${ny + 7} Z" fill="#5a1f2a" stroke="${c.mouth}" stroke-width="1.4"/>
      <path d="M88 ${ny + 28} Q100 ${ny + 20} 112 ${ny + 28} Q108 ${ny + 35} 100 ${ny + 35} Q92 ${ny + 35} 88 ${ny + 28} Z" fill="#e47d90"/>
      <path d="M87 ${ny + 8} L89.5 ${ny + 16} L92 ${ny + 8} Z M108 ${ny + 8} L110.5 ${ny + 16} L113 ${ny + 8} Z" fill="#fff"/></g>
    <ellipse class="k-mouth m-o" cx="100" cy="${ny + 13}" rx="3.6" ry="4.6" fill="#4a2a30"/>
    <path class="k-mouth m-grin" d="M86 ${ny + 8} Q100 ${ny + 20} 114 ${ny + 5}" stroke="${c.mouth}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <g class="k-mouth m-chew"><ellipse cx="72" cy="${ny + 6}" rx="11" ry="9" fill="${rusty ? c.light : c.fur}" stroke="${c.edge}"/><ellipse cx="128" cy="${ny + 6}" rx="11" ry="9" fill="${rusty ? c.light : c.fur}" stroke="${c.edge}"/>
      <path d="M94 ${ny + 11} Q100 ${ny + 14} 106 ${ny + 11}" stroke="${c.mouth}" stroke-width="2" fill="none" stroke-linecap="round"/></g>
    <g class="k-mouth m-tongue"><path d="M92 ${ny + 9} Q100 ${ny + 13} 108 ${ny + 9}" stroke="${c.mouth}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M95 ${ny + 10} Q94 ${ny + 22} 100 ${ny + 23} Q106 ${ny + 22} 105 ${ny + 10} Z" fill="#e8798c" stroke="#b9566a"/></g>
    <g class="k-whiskers" stroke="${c.whisker}" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round">
      <path d="M84 ${ny + 5} L46 ${ny - 3}"/><path d="M84 ${ny + 9} L44 ${ny + 10}"/><path d="M85 ${ny + 12} L50 ${ny + 22}"/>
      <path d="M116 ${ny + 5} L154 ${ny - 3}"/><path d="M116 ${ny + 9} L156 ${ny + 10}"/><path d="M115 ${ny + 12} L150 ${ny + 22}"/></g>
    <g class="k-crumbs" fill="#c99a5a"><circle cx="88" cy="${ny + 22}" r="1.8"/><circle cx="111" cy="${ny + 20}" r="1.5"/><circle cx="104" cy="${ny + 27}" r="2"/><circle cx="93" cy="${ny + 30}" r="1.3"/></g>
    <g class="k-mask"><path fill-rule="evenodd" d="M56 70 Q100 58 144 70 L143 88 Q100 80 57 88 Z M81 ${eyes.y} m-10 0 a10 8 0 1 0 20 0 a10 8 0 1 0 -20 0 M119 ${eyes.y} m-10 0 a10 8 0 1 0 20 0 a10 8 0 1 0 -20 0" fill="#111"/>
      <path d="M144 72 Q156 66 162 58 M144 80 Q158 82 164 90" stroke="#111" stroke-width="4" fill="none" stroke-linecap="round"/></g>
    <g class="k-shades"><path d="M64 70 H96 Q96 90 81 90 Q66 90 64 70 Z M104 70 H136 Q134 90 119 90 Q104 90 104 70 Z" fill="#111"/>
      <path d="M58 70 H142" stroke="#111" stroke-width="4"/><path d="M70 75 L77 75 M109 75 L116 75" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/></g>
    <path class="k-sweat" d="M150 50 Q156 60 150 64 Q144 60 150 50 Z" fill="#9fd3f0" stroke="#5b9ec4" stroke-width="1"/>
  </g>
  <g class="k-stars" fill="#f2c94c" stroke="#c99a2e" stroke-width=".8">
    <path d="M62 30 l2.5 6 6 0 -5 3.5 2 6 -5.5 -3.6 -5.5 3.6 2 -6 -5 -3.5 6 0 Z"/><path d="M138 26 l2.5 6 6 0 -5 3.5 2 6 -5.5 -3.6 -5.5 3.6 2 -6 -5 -3.5 6 0 Z"/><path d="M100 10 l2.5 6 6 0 -5 3.5 2 6 -5.5 -3.6 -5.5 3.6 2 -6 -5 -3.5 6 0 Z"/></g>
</g>`;
}

function spring(x, k = 260, d = 20) {
  return { x, v: 0, t: x, k, d };
}

const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* lid: 0 = wide open, 1 = shut (on top of each cat's own resting lid). crouch: lower and wider.
   tailUp: the tail stands up straight instead of curling along the floor. */
const MOODS = {
  idle: { eyes: 'open', mouth: null, lid: 0, crouch: 0, tail: 0.3, tailSpeed: 2, ears: 0, brow: 0 },
  sneak: { eyes: 'open', mouth: 'grin', lid: 0.28, crouch: 1, tail: 0.5, tailSpeed: 4, ears: -8, brow: 6, look: [0.9, 0] },
  freeze: { eyes: 'open', mouth: 'o', lid: -0.5, crouch: -0.3, tail: 0, tailSpeed: 0, ears: 10, brow: -10, big: true, tailUp: true },
  smug: { eyes: 'open', mouth: 'grin', lid: 0.45, crouch: 0, tail: 0.3, tailSpeed: 2, ears: 2, brow: 4 },
  yowl: { eyes: 'shut', mouth: 'yowl', lid: 0, crouch: -0.4, tail: 0.2, tailSpeed: 9, ears: -16, brow: 10 },
  shock: { eyes: 'open', mouth: 'o', lid: -0.6, crouch: -0.8, tail: 0.05, tailSpeed: 14, ears: 16, brow: -14, big: true, tailUp: true, sweat: true },
  dizzy: { eyes: 'dizzy', mouth: 'tongue', lid: 0, crouch: 0.3, tail: 0.15, tailSpeed: 1.5, ears: -12, brow: 0, sweat: true },
  eat: { eyes: 'happy', mouth: 'chew', lid: 0, crouch: 0.2, tail: 0.6, tailSpeed: 6, ears: 4, brow: 0 },
  happy: { eyes: 'happy', mouth: 'open', lid: 0, crouch: 0, tail: 0.6, tailSpeed: 6, ears: 6, brow: -4, arms: 'up' },
  sad: { eyes: 'open', mouth: 'flat', lid: 0.2, crouch: 0.4, tail: 0.05, tailSpeed: 1, ears: -16, brow: -12 },
  sleepy: { eyes: 'shut', mouth: 'w', lid: 0, crouch: 0.5, tail: 0.1, tailSpeed: 1, ears: -6, brow: 0 },
};

export function rigCat(kind = 'bindi') {
  const c = LOOKS[kind];
  const el = document.createElement('div');
  el.className = `kat ${kind}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 222');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = markup(kind, `k${++uid}`); // fixed markup
  el.append(svg);
  const q = (s) => svg.querySelector(s);
  const P = (x, y) => `${f1(x)} ${f1(y)}`;
  const parts = {
    root: q('.k-root'), head: q('.k-head'), earL: q('.k-ear-l'), earR: q('.k-ear-r'), tail: q('.k-tail'),
    ruff: q('.k-ruff'), body: q('.k-body'), footL: q('.k-foot-l'), footR: q('.k-foot-r'),
    browL: q('.k-brow-l'), browR: q('.k-brow-r'), eyes: [...svg.querySelectorAll('.k-eye')],
    armL: { path: q('.k-arm-l .k-arm'), band: q('.k-arm-l .k-band'), paw: q('.k-arm-l .k-paw'), sx: 79, sy: 128, side: 1 },
    armR: { path: q('.k-arm-r .k-arm'), band: q('.k-arm-r .k-band'), paw: q('.k-arm-r .k-paw'), smear: q('.k-smear'), sx: 121, sy: 128, side: -1 },
  };
  // The tail: a chain of overlapping fur balls that thickens into a plume. Rusty's has rings.
  const BALLS = 13;
  const balls = [];
  const jit = rng(kind === 'rusty' ? 23 : 29);
  for (let i = 0; i < BALLS; i++) {
    const b = document.createElementNS(NS, 'circle');
    const ring = kind === 'rusty' && i % 3 === 1;
    b.setAttribute('fill', ring ? c.dark : i % 4 === 3 ? c.fur2 : c.fur);
    b.setAttribute('stroke', c.edge);
    b.setAttribute('stroke-width', '0.8');
    b.dataset.j = (0.9 + jit() * 0.2).toFixed(2);
    parts.tail.append(b);
    balls.push(b);
  }

  const S = {
    lean: spring(0), bob: spring(0, 320, 18), squash: spring(1, 380, 16), tilt: spring(0, 200, 16), hb: spring(0, 300, 18),
    lx: spring(0, 120, 16), ly: spring(0, 120, 16), lid: spring(c.lid, 300, 26), blink: spring(0, 900, 40),
    earL: spring(0, 400, 14), earR: spring(0, 400, 14), eyeScale: spring(1, 300, 18), brow: spring(0, 300, 20),
    aL: spring(10, 500, 28), aR: spring(-10, 500, 28), liftL: spring(0, 700, 30), liftR: spring(0, 700, 30),
    reachR: spring(0, 1100, 46), poof: spring(1, 180, 9), tailUp: spring(0, 160, 16),
  };
  let mood = MOODS.idle;
  let moodName = 'idle';
  let reachAt = null;
  let tailPhase = Math.random() * 6;
  let last = performance.now();
  let nextBlink = last + 1200 + Math.random() * 1500;
  let raf = 0;
  let beatTilt = 1;
  let stepSide = 1;

  function setMood(name) {
    mood = MOODS[name] || MOODS.idle;
    moodName = name;
    svg.dataset.eyes = mood.eyes;
    svg.dataset.mouth = mood.mouth || (kind === 'rusty' ? 'flat' : 'w');
    svg.classList.toggle('sweat', !!mood.sweat);
    S.lid.t = Math.max(-0.2, Math.min(0.9, c.lid + mood.lid));
    S.earL.t = mood.ears;
    S.earR.t = -mood.ears;
    S.brow.t = mood.brow;
    S.eyeScale.t = mood.big ? 1.22 : 1;
    S.squash.t = 1 - 0.08 * mood.crouch;
    S.bob.t = 8 * Math.max(0, mood.crouch);
    S.tailUp.t = mood.tailUp ? 1 : 0;
    if (mood.look) { S.lx.t = mood.look[0]; S.ly.t = mood.look[1]; }
    if (mood.arms === 'up') { S.aL.t = 150; S.aR.t = -150; } else { S.aL.t = 10; S.aR.t = -10; }
    if (name === 'shock' || name === 'freeze') { S.bob.v -= 240; S.squash.v += 2; S.poof.v += 3; }
    if (name === 'happy') { S.bob.v -= 160; }
  }
  setMood('idle');

  function drawArm(a, angle, lift, reach) {
    const L = 64;
    const rad = (angle * Math.PI) / 180;
    let tx = a.sx - Math.sin(rad) * L;
    let ty = a.sy + Math.cos(rad) * L - lift * 18;
    tx += lift * 6 * a.side * -1;
    if (reach > 0.001 && reachAt) {
      tx += (reachAt.x - tx) * reach;
      ty += (reachAt.y - ty) * reach;
    }
    const mx = (a.sx + tx) / 2;
    const my = (a.sy + ty) / 2;
    const len = Math.hypot(tx - a.sx, ty - a.sy) || 1;
    const nx = -(ty - a.sy) / len;
    const ny = (tx - a.sx) / len;
    const bend = (Math.min(24, len * 0.1) + lift * 8) * (tx > a.sx ? 1 : -1);
    const d = `M${P(a.sx, a.sy)} Q${P(mx + nx * bend, my + ny * bend)} ${P(tx, ty)}`;
    a.path.setAttribute('d', d);
    if (a.band) a.band.setAttribute('d', `M${P(a.sx + (tx - a.sx) * 0.35, a.sy + (ty - a.sy) * 0.35)} Q${P(mx + nx * bend * 0.9, my + ny * bend * 0.9)} ${P(tx - (tx - a.sx) * 0.12, ty - (ty - a.sy) * 0.12)}`);
    const rot = Math.atan2(ty - a.sy, tx - a.sx) * 180 / Math.PI - 90;
    const big = 1 + reach * 0.7;
    a.paw.setAttribute('transform', `translate(${P(tx, ty)}) rotate(${f1(rot)}) scale(${big.toFixed(2)})`);
    if (a.smear) {
      const show = reach > 0.15 && reach < 0.95;
      a.smear.setAttribute('d', show ? `M${P(a.sx, a.sy)} Q${P(mx + nx * bend * 2, my + ny * bend * 2)} ${P(tx, ty)}` : '');
    }
    a.tip = { x: tx, y: ty };
  }

  function drawTail(t) {
    const [r0, r1] = c.tail;
    const up = S.tailUp.x;
    let x = 134;
    let y = 188;
    // Curling along the floor to the right, or standing straight up (shock, freeze).
    let ang = 0.1 * (1 - up) + -1.5 * up;
    const amp = mood.tail;
    for (let i = 0; i < BALLS; i++) {
      const f = i / (BALLS - 1);
      ang += (-0.26 * (1 - up) + 0.02 * up) + Math.sin(t - i * 0.5) * amp * f * 0.5;
      const seg = 6.2 + f * 3;
      x += Math.cos(ang) * seg;
      y += Math.sin(ang) * seg;
      // A plume: thin at the base, fattest two thirds along, round at the tip.
      const r = (r0 + (r1 - r0) * Math.sin(Math.min(1, f * 1.25) * Math.PI * 0.62)) * Number(balls[i].dataset.j) * (0.85 + S.poof.x * 0.15);
      balls[i].setAttribute('cx', f1(x));
      balls[i].setAttribute('cy', f1(y));
      balls[i].setAttribute('r', f1(r));
    }
  }

  function frame(now) {
    if (!el.isConnected) { raf = 0; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const s of Object.values(S)) {
      const a = s.k * (s.t - s.x) - s.d * s.v;
      s.v += a * dt;
      s.x += s.v * dt;
    }
    if (now > nextBlink) {
      blink();
      nextBlink = now + 1600 + Math.random() * 3400;
    }
    tailPhase += dt * mood.tailSpeed;
    const sq = S.squash.x;
    const sx = 1 + (1 - sq) * 0.8;
    const pf = S.poof.x;
    parts.root.setAttribute('transform', `translate(${S.lean.x.toFixed(2)} ${S.bob.x.toFixed(2)}) translate(100 206) scale(${sx.toFixed(3)} ${sq.toFixed(3)}) translate(-100 -206)`);
    parts.body.setAttribute('transform', `translate(100 200) scale(${pf.toFixed(3)} ${(1 + (pf - 1) * 0.6).toFixed(3)}) translate(-100 -200)`);
    if (parts.ruff) parts.ruff.setAttribute('transform', `translate(100 116) scale(${(pf * 1.02).toFixed(3)}) translate(-100 -116)`);
    parts.head.setAttribute('transform', `translate(0 ${S.hb.x.toFixed(2)}) rotate(${S.tilt.x.toFixed(2)} 100 112) translate(100 80) scale(${(1 + (pf - 1) * 0.5).toFixed(3)}) translate(-100 -80)`);
    parts.earL.setAttribute('transform', `rotate(${(-S.earL.x).toFixed(2)} 76 54)`);
    parts.earR.setAttribute('transform', `rotate(${(-S.earR.x).toFixed(2)} 124 54)`);
    const br = S.brow.x;
    if (parts.browL) {
      parts.browL.setAttribute('transform', `rotate(${f1(br)} 81 66) translate(0 ${f1(-Math.min(0, br) * 0.35)})`);
      parts.browR.setAttribute('transform', `rotate(${f1(-br)} 119 66) translate(0 ${f1(-Math.min(0, br) * 0.35)})`);
    }
    const lid = Math.max(0, Math.min(1, S.lid.x + (1 - S.lid.x) * Math.min(1, Math.max(0, S.blink.x))));
    const es = S.eyeScale.x;
    for (const e of parts.eyes) {
      const cx = Number(e.dataset.x);
      const cy = kind === 'rusty' ? 79 : 77;
      e.setAttribute('transform', `translate(${cx} ${cy}) scale(${es.toFixed(3)}) translate(${-cx} ${-cy})`);
      const pupil = e.querySelector('.k-pupil');
      pupil.setAttribute('cx', f1(cx + S.lx.x * 5));
      pupil.setAttribute('cy', f1(cy + 1 + S.ly.x * 3.5));
      const lidEl = e.querySelector('.k-lid');
      const edge = e.querySelector('.k-lid-edge');
      const h = Number(lidEl.getAttribute('height'));
      lidEl.setAttribute('transform', `translate(0 ${f1(-h + h * lid)})`);
      edge.setAttribute('transform', `translate(0 ${f1(h * lid - 1)})`);
    }
    drawArm(parts.armL, S.aL.x, Math.max(0, S.liftL.x), 0);
    drawArm(parts.armR, S.aR.x, Math.max(0, S.liftR.x), Math.max(0, S.reachR.x));
    parts.footL.setAttribute('transform', `translate(0 ${f1(-Math.max(0, S.liftR.x) * 7)})`);
    parts.footR.setAttribute('transform', `translate(0 ${f1(-Math.max(0, S.liftL.x) * 7)})`);
    drawTail(tailPhase);
    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function blink() {
    S.blink.t = 1;
    setTimeout(() => { S.blink.t = 0; }, 90);
  }
  function toRig(x, y) {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(x, y).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  const api = {
    el,
    kind,
    start,
    mood(name) { setMood(name); start(); },
    get moodName() { return moodName; },
    look(x, y = 0) { S.lx.t = Math.max(-1, Math.min(1, x)); S.ly.t = Math.max(-1, Math.min(1, y)); },
    blink,
    /* Props are classes on the drawing: mask, shades, bib, crumbs, stars, sweat. */
    set(prop, on = true) { svg.classList.toggle(prop, on); },
    /* Open the mouth for a moment (a meow, a mrrp). */
    say(ms = 180, shape = 'open') {
      const was = svg.dataset.mouth;
      svg.dataset.mouth = shape;
      S.hb.v -= 60;
      clearTimeout(api._say);
      api._say = setTimeout(() => { svg.dataset.mouth = mood.mouth || (kind === 'rusty' ? 'flat' : 'w'); }, ms);
      return was;
    },
    /* A tiptoe step: one front paw and the opposite back foot lift, the body rises. */
    step(power = 1) {
      stepSide = -stepSide;
      const s = stepSide > 0 ? S.liftL : S.liftR;
      s.t = power;
      setTimeout(() => { s.t = 0; }, 130);
      S.bob.v -= 120 * power;
      S.tilt.v += stepSide * 60;
    },
    /* Fur standing on end: 1 is normal, 1.4 is a dandelion. */
    poof(amount = 1) { S.poof.t = amount; S.poof.v += (amount - 1) * 8; },
    reach(x, y, hold = 0.14) {
      const p = toRig(x, y);
      if (!p) return;
      reachAt = p;
      S.reachR.t = 1;
      S.reachR.v = 18;
      S.lean.v -= 140;
      clearTimeout(api._back);
      api._back = setTimeout(() => { S.reachR.t = 0; }, hold * 1000);
    },
    beat(down, spb, tier = 0) {
      if (still) return;
      if (moodName === 'freeze') return;
      const g = 1 + tier * 0.3;
      S.hb.v += 70 * g;
      beatTilt = -beatTilt;
      S.tilt.t = moodName === 'sneak' ? beatTilt * 2 : beatTilt * (2 + tier * 1.5);
      if (down) {
        S.squash.v -= 0.7 * g;
        S.earL.v += 220;
        S.earR.v -= 220;
      }
      // With the full band in, they can't help themselves: a little hop on beat 1.
      if (tier >= 3 && down && moodName !== 'sneak') S.bob.v -= 150;
    },
    hop(power = 1) { S.bob.v -= 260 * power; S.squash.v += 2 * power; },
    /* Petting Time: a hand pressing down on him. */
    press(power = 1) { S.squash.v -= 2.4 * power; S.hb.v += 120 * power; S.earL.v -= 280 * power; S.earR.v += 280 * power; },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
  start();
  return api;
}
