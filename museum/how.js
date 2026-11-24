/* How each instrument makes its sound, for its placard: a little moving diagram of what shakes
   (a string, a reed, the lips, a drumhead, a bar, the air in a pipe), the steps in words, and
   one thing particular to the instrument.
   The diagrams move by SVG's own animation (<animate>), all on one clock, so the parts keep
   time with each other: the mallet lands just as the bar starts to ring, and the piano's
   damper drops just as its string stops. For visitors who ask for less motion they are drawn
   still, at the moment they sound. Each is 240 by 140 units. */

const f = (x) => Math.round(x * 100) / 100;
const INK = '#1F3329';
const WOOD = '#B4683A';
const WOOD_DK = '#7A3F1D';
const WOOD_LT = '#E2A56C';
const STEEL = '#AEB6BD';
const STEEL_DK = '#6F7880';
const BRASS = '#D2A13A';
const BRASS_DK = '#94691A';
const SKIN = '#EDBB98';
const SKIN_DK = '#B57B58';
const LIP = '#D9826E';
const LIP_DK = '#C46A58';
const AIR = '#4F95BF';
const BLACK = '#1D1D20';

let still = false;   // drawing without motion
let uid = 0;         // for gradient ids, unique on the page
const id = (name) => `hw${++uid}${name}`;

/* An SVG animation of `attr` through frames [[time (0 to 1 of the cycle), value], ...], over
   dur seconds, round and round. `more`: other attributes (calcMode, keySplines, begin). */
function anim(attr, frames, dur, more = '') {
  if (still) return '';
  const fr = frames.map(([t, v]) => [Math.min(1, Math.max(0, t)), v]);
  if (fr[0][0] > 0) fr.unshift([0, fr[0][1]]);
  if (fr[fr.length - 1][0] < 1) fr.push([1, fr[fr.length - 1][1]]);
  for (let i = 1; i < fr.length; i++) fr[i][0] = Math.max(fr[i][0], fr[i - 1][0]);
  const kt = fr.map(([t]) => Math.round(t * 1e4) / 1e4).join(';');
  const vs = fr.map(([, v]) => v).join(';');
  const tag = attr.startsWith('transform:') ? `animateTransform attributeName="transform" type="${attr.slice(10)}"` : `animate attributeName="${attr}"`;
  return `<${tag} dur="${dur}s" repeatCount="indefinite" keyTimes="${kt}" values="${vs}"${more ? ` ${more}` : ''}/>`;
}
const ease = (n) => `calcMode="spline" keySplines="${Array(n).fill('.42 0 .58 1').join(';')}"`;

/* A shape's outline, swinging: shape(a) draws it at a swing of a (-1 to 1, 0 at rest).
   steady: swinging evenly the whole cycle. Otherwise still until `hit`, then swinging less
   each time until `end`, `keep` of the swing left by then, the first swing towards `first`;
   `lead` frames (a pull before it is let go) come first. */
function swing(shape, dur, { hz = 9, hit = 0, end = 1, keep = 0.06, steady = false, lead = [], first = -1 } = {}) {
  if (steady) {
    const n = Math.max(2, Math.round(dur * hz) * 2);
    return Array.from({ length: n + 1 }, (_, j) => [j / n, shape(j % 2 ? -1 : 1)]);
  }
  const fr = lead.length ? [...lead] : [[0, shape(0)], [hit, shape(0)]];
  const n = Math.max(2, Math.round((end - hit) * dur * hz * 2));
  for (let j = 1; j <= n; j++) {
    const a = j === n ? 0 : (j % 2 ? first : -first) * keep ** ((j - 1) / (n - 1)) * (lead.length ? 0.92 : 1);
    fr.push([hit + ((end - hit) * j) / n, shape(a)]);
  }
  fr.push([1, shape(0)]);
  return fr;
}

/* Sound spreading from (x, y) towards dir degrees (0 right, 90 down): three arcs that grow
   and fade. when: 'steady', or the strikes that set them off, [time, strength], each lasting
   `life` of the cycle. */
function waves(x, y, dir, { r = 11, step = 9, dur = 1.2, when = 'steady', life = 0.28 } = {}) {
  let s = `<g transform="translate(${x} ${y}) rotate(${dir})">`;
  const a = 0.66;
  for (let i = 0; i < 3; i++) {
    const R = r + i * step;
    let m = '';
    if (when === 'steady') {
      const P = 1.2;
      const begin = `begin="${f(-(i * P) / 3)}s"`;
      m = anim('transform:scale', [[0, 0.72], [1, 1.28]], P, begin) + anim('opacity', [[0, 0], [0.2, 0.9], [1, 0]], P, begin);
    } else {
      const sc = [[0, 0.72]];
      const op = [[0, 0]];
      for (const [t0, k] of when) {
        const t = t0 + i * 0.035;
        sc.push([t, 0.72], [t + life, 1.28]);
        op.push([t, 0], [t + 0.03, 0.95 * k], [t + life, 0]);
      }
      m = anim('transform:scale', sc, dur) + anim('opacity', op, dur);
    }
    s += `<path class="w" d="M${f(R * Math.cos(a))} ${f(-R * Math.sin(a))}A${R} ${R} 0 0 1 ${f(R * Math.cos(a))} ${f(R * Math.sin(a))}" fill="none" stroke="#B5653A" stroke-width="3" stroke-linecap="round" opacity="${f(0.85 - i * 0.2)}">${m}</path>`;
  }
  return `${s}</g>`;
}

/* Sound coming out towards you, from a round hole or a speaker: rings that grow and fade. */
function rings(x, y, r0, r1, { dur = 1.2, when = 'steady', life = 0.3 } = {}) {
  let s = '';
  for (let i = 0; i < 3; i++) {
    let m = '';
    if (when === 'steady') {
      const begin = `begin="${f(-(i * dur) / 3)}s"`;
      m = anim('r', [[0, r0], [1, r1]], dur, begin) + anim('opacity', [[0, 0], [0.15, 0.8], [1, 0]], dur, begin);
    } else {
      const rr = [[0, r0]];
      const op = [[0, 0]];
      for (const [t0, k] of when) {
        const t = t0 + i * 0.06;
        rr.push([t, r0], [t + life, r1]);
        op.push([t, 0], [t + 0.03, 0.85 * k], [t + life, 0]);
      }
      m = anim('r', rr, dur) + anim('opacity', op, dur);
    }
    s += `<circle class="w" cx="${x}" cy="${y}" r="${f(r0 + ((r1 - r0) * (i + 1)) / 4)}" fill="none" stroke="#B5653A" stroke-width="2.6" opacity="${f(0.75 - i * 0.2)}">${m}</circle>`;
  }
  return s;
}

/* Air streaming along a path. */
const air = (d, { w = 2.6, dur = 0.8 } = {}) => `<path d="${d}" fill="none" stroke="${AIR}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="5 8">${anim('stroke-dashoffset', [[0, 13], [1, 0]], dur)}</path>`;

/* A fingertip pointing down (rotate it for other ways), its tip at (0, 0). */
const fingertip = (w = 14, h = 40) => `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="${w / 2}" fill="${SKIN}" stroke="${SKIN_DK}" stroke-width="1.2"/><path d="M${f(-w * 0.32)} ${f(-w * 0.75)}Q0 ${f(-w * 0.95)} ${f(w * 0.32)} ${f(-w * 0.75)}V${f(-w * 0.2)}Q0 ${f(w * 0.02)} ${f(-w * 0.32)} ${f(-w * 0.2)}Z" fill="#F8DED0" stroke="${SKIN_DK}" stroke-width=".6"/>`;

/* A child's face in profile, looking right, the mouth at (x, y). */
const face = (x, y) => `<path d="M${x - 70} ${y - 90}C${x - 40} ${y - 92} ${x - 30} ${y - 66} ${x - 27} ${y - 50}C${x - 25} ${y - 40} ${x - 20} ${y - 34} ${x - 10} ${y - 24}C${x - 6} ${y - 20} ${x - 8} ${y - 15} ${x - 14} ${y - 14}C${x - 11} ${y - 11} ${x - 6} ${y - 8} ${x - 4} ${y - 4}L${x - 2} ${y}L${x - 4} ${y + 4}C${x - 6} ${y + 9} ${x - 7} ${y + 13} ${x - 9} ${y + 17}C${x - 11} ${y + 24} ${x - 19} ${y + 29} ${x - 28} ${y + 30}C${x - 32} ${y + 44} ${x - 32} ${y + 64} ${x - 30} ${y + 90}H${x - 140}V${y - 90}Z" fill="#F3CFB0" stroke="${SKIN_DK}" stroke-width="1.2"/>`
  + `<path d="M${x - 140} ${y - 90}H${x - 42}C${x - 40} ${y - 74} ${x - 52} ${y - 62} ${x - 64} ${y - 58}C${x - 76} ${y - 54} ${x - 84} ${y - 40} ${x - 88} ${y - 30}H${x - 140}Z" fill="#5A3A22"/>`
  + `<path d="M${x - 36} ${y - 38}q4.5 3 9 0" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M${x - 38} ${y - 46}q6 -4 12 -1" fill="none" stroke="#5A3A22" stroke-width="1.8" stroke-linecap="round"/>`
  + `<ellipse cx="${x - 26}" cy="${y - 16}" rx="7" ry="4.5" fill="#E89A8A" opacity=".45"/>`;

/* Lips seen from the side, buzzing or blowing towards the right; the gap between them at (x, y). */
function lips(x, y, { buzz = 0, dur = 1.2 } = {}) {
  const up = `<path d="M${x - 24} ${y - 13}C${x - 14} ${y - 17} ${x - 3} ${y - 11} ${x} ${y - 1.5}C${x - 9} ${y - 1} ${x - 18} ${y - 2} ${x - 24} ${y - 5}Z" fill="${LIP}"/>`;
  const lo = `<path d="M${x - 24} ${y + 13}C${x - 14} ${y + 17} ${x - 3} ${y + 11} ${x} ${y + 1.5}C${x - 9} ${y + 1} ${x - 18} ${y + 2} ${x - 24} ${y + 5}Z" fill="${LIP_DK}"/>`;
  if (!buzz) return up + lo;
  const go = (k) => anim('transform:translate', swing((a) => `0 ${f(k * buzz * (a + 1) * 0.5)}`, dur, { steady: true, hz: 8 }), dur);
  return `<g>${go(-1)}${up}</g><g>${go(1)}${lo}</g>`;
}

/* A bar struck in the middle bends like this: its ends and middle swing opposite ways, about
   its two still points (nodes), a little under a quarter of the way in from each end. */
const BEND = (() => {
  const b = 4.730;
  const s = 0.9825;
  const w = (u) => (Math.cosh(b * u) + Math.cos(b * u) - s * (Math.sinh(b * u) + Math.sin(b * u))) / 2;
  return Array.from({ length: 11 }, (_, i) => w(i / 10));
})();

const DIAGRAMS = {
  /* A violin from the front: the bow crossing its strings between the fingerboard and the
     bridge, the D string swinging most far from the bridge, the sound coming from the body. */
  bow: () => {
    const D = 2.4;
    const g = id('v');
    let s = `<defs><radialGradient id="${g}" cx=".4" cy=".3" r=".85"><stop offset="0" stop-color="#DA9A5A"/><stop offset=".55" stop-color="#B0602F"/><stop offset="1" stop-color="#7C3B17"/></radialGradient></defs>`;
    const body = 'M120 6C136 6 150 14 151 30C152 42 148 49 143 52L146 55C139 60 139 77 146 83L143 86C152 89 158 97 158 108C158 126 142 136 120 136C98 136 82 126 82 108C82 97 88 89 97 86L94 83C101 77 101 60 94 55L97 52C92 49 88 42 89 30C90 14 104 6 120 6Z';
    s += `<path d="${body}" fill="url(#${g})" stroke="#5E2C10" stroke-width="1.6"/>`;
    s += `<path d="${body}" transform="translate(120 71) scale(.93) translate(-120 -71)" fill="none" stroke="#4A220C" stroke-width=".7" opacity=".6"/>`;
    // f-holes: the small eye at the top towards the middle, the big one at the bottom outside
    for (const k of [1, -1]) {
      const X = (x) => f(120 + k * (x - 120));
      s += `<path d="M${X(137.5)} 77C${X(144)} 83 ${X(137)} 94 ${X(143)} 99.5" fill="none" stroke="#2A1206" stroke-width="2.2" stroke-linecap="round"/><circle cx="${X(137.5)}" cy="75.5" r="2" fill="#2A1206"/><circle cx="${X(143.5)}" cy="101.5" r="2.6" fill="#2A1206"/>`;
    }
    s += `<path d="M110 -4H130L131.5 74Q120 77 108.5 74Z" fill="#1E1A17"/>`;
    s += `<path d="M112 101H128L125 131Q120 134 115 131Z" fill="#1E1A17"/><circle cx="120" cy="127" r="1.6" fill="#8A6B4A"/>`;
    s += `<path d="M103 95Q120 88 137 95V98Q120 92 103 98Z" fill="#E7BC85" stroke="#8A5528" stroke-width=".8"/>`;
    // the strings, G D A E, from the fingerboard over the bridge to the tailpiece
    const top = [113.5, 117.8, 122.2, 126.5];
    const br = [111.8, 117.3, 122.7, 128.2];
    const tp = [114.5, 118.2, 121.8, 125.5];
    const wd = [1.7, 1.4, 1.15, 0.9];
    const col = (i) => (i === 3 ? '#E1E4E7' : '#CDB98E');
    for (const i of [0, 2, 3]) s += `<path d="M${top[i]} -4L${br[i]} 93.4L${tp[i]} 101" fill="none" stroke="${col(i)}" stroke-width="${wd[i]}"/>`;
    const dStr = (a) => `M${f(top[1] + 3.4 * a)} -4L${br[1]} 93.4`;
    s += `<path d="${dStr(0.8)}" fill="none" stroke="${col(1)}" stroke-width="${wd[1]}">${anim('d', swing(dStr, D, { steady: true }), D)}</path><path d="M${br[1]} 93.4L${tp[1]} 101" stroke="${col(1)}" stroke-width="${wd[1]}"/>`;
    // the bow, sliding: horsehair underneath, the stick above, the frog at the right
    const bow = '<path d="M-60 79.2H196V82.2H-60Z" fill="#F4EFE1" stroke="#CBBFA6" stroke-width=".6"/>'
      + '<path d="M-62 77Q60 79.5 190 71.5" fill="none" stroke="#5A2E14" stroke-width="2.6" stroke-linecap="round"/>'
      + '<path d="M-66 76L-58 74.5L-58 82.2L-64 82.2Z" fill="#EDE6D6" stroke="#5A2E14" stroke-width="1"/>'
      + `<path d="M180 70.5H200V83H184Z" fill="${BLACK}"/><rect x="179" y="80" width="5" height="3.6" fill="#C9CED2"/><circle cx="192" cy="76.5" r="2.2" fill="#F1F4F6"/><rect x="200" y="70" width="10" height="4" rx="1" fill="#C9CED2"/>`;
    s += `<g>${anim('transform:translate', [[0, '-34 0'], [0.5, '34 0'], [1, '-34 0']], D, ease(2))}${bow}</g>`;
    return s + waves(76, 94, 180) + waves(164, 94, 0);
  },

  /* A guitar from above, its neck to the left: a finger pulls a string and lets go, the string
     swings, and the sound rings out of the round hole. */
  pluck: () => {
    const D = 2.4;
    const g = id('t');
    let s = `<defs><radialGradient id="${g}" cx=".55" cy=".45" r=".7"><stop offset="0" stop-color="#F2D49E"/><stop offset="1" stop-color="#D9A865"/></radialGradient></defs>`;
    s += `<path d="M50 70C50 40 64 19 92 19C112 19 118 26 127 26C138 26 150 2 182 2C212 2 230 30 230 70C230 110 212 138 182 138C150 138 138 114 127 114C118 114 112 121 92 121C64 121 50 100 50 70Z" fill="url(#${g})" stroke="#5A3418" stroke-width="2.6"/>`;
    s += `<circle cx="104" cy="70" r="23" fill="none" stroke="#3D2716" stroke-width="1.4"/><circle cx="104" cy="70" r="20.6" fill="none" stroke="#A0522D" stroke-width="2.6" stroke-dasharray="2 1.6"/><circle cx="104" cy="70" r="18.4" fill="none" stroke="#3D2716" stroke-width="1"/>`;
    s += `<circle cx="104" cy="70" r="15.6" fill="#24160C"/>`;
    // the fingerboard and its frets, closer together towards the body
    s += `<rect x="-6" y="59" width="92" height="22" fill="#3B2416"/>`;
    for (const x of [4, 14.5, 24.5, 34, 43, 51.5, 59.5, 67, 74, 80.5]) s += `<rect x="${x}" y="59" width="1.4" height="22" fill="#C9CCD0"/>`;
    // the bridge, its white saddle, and the strings tied behind it
    s += `<rect x="170" y="36" width="16" height="68" rx="4" fill="#4A2A14"/><rect x="174.5" y="49" width="2.4" height="42" rx="1" fill="#F2EAD8"/>`;
    const L = [58.4, 63.2, 68, 72.8, 77.6, 82.4];
    const R = [55, 61, 67, 73, 79, 85];
    const wd = [2.2, 1.9, 1.6, 1.3, 1.1, 0.9];
    const col = (i) => (i < 3 ? '#C8CACC' : '#F4EEE0');
    for (let i = 0; i < 6; i++) {
      s += `<circle cx="182" cy="${R[i]}" r="1.3" fill="#1A0F08"/>`;
      if (i === 2) continue;
      s += `<path d="M-6 ${L[i] + 0.8}L176 ${R[i] + 0.8}" stroke="#5A3A1C" stroke-width="${wd[i]}" opacity=".3"/><path d="M-6 ${L[i]}L176 ${R[i]}H182" fill="none" stroke="${col(i)}" stroke-width="${wd[i]}"/>`;
    }
    // the D string: pulled at the finger, then swinging about its middle
    const pulled = (k) => `M-6 68C120 ${f(68 + 6.2 * k)} 158 ${f(67 + 7 * k)} 176 67`;
    const ringing = (a) => `M-6 68C55 ${f(67.7 + 5 * a)} 115 ${f(67.3 + 5 * a)} 176 67`;
    const fr = swing(ringing, D, { hit: 0.14, end: 0.94, keep: 0.05, lead: [[0, pulled(0)], [0.06, pulled(0)], [0.14, pulled(1)]] });
    s += `<path d="${ringing(0.8)}" fill="none" stroke="${col(2)}" stroke-width="${wd[2]}">${anim('d', fr, D)}</path><path d="M176 67H182" stroke="${col(2)}" stroke-width="${wd[2]}"/>`;
    // the finger: on the string, pulls it, slips off, and comes back
    const fm = anim('transform:translate', [[0, '0 -7'], [0.06, '0 0'], [0.14, '0 5.5'], [0.18, '0 14'], [0.3, '0 14'], [0.86, '0 -7']], D)
      + anim('opacity', [[0, 1], [0.2, 1], [0.3, 0], [0.86, 0], [0.95, 1]], D);
    s += `<g opacity=".95">${fm}<g transform="translate(150 66) rotate(200)">${fingertip(13, 44)}</g></g>`;
    return s + rings(104, 70, 16, 34, { dur: D, when: [[0.14, 1], [0.44, 0.6], [0.72, 0.3]], life: 0.22 });
  },

  /* An electric guitar's strings over its pickup (magnets wound with fine wire), the cable,
     and the amplifier's speaker. */
  pickup: () => {
    const D = 1.2;
    const g = id('c');
    let s = `<defs><radialGradient id="${g}" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#6A645E"/><stop offset="1" stop-color="#2C2926"/></radialGradient></defs>`;
    s += `<path d="M44 36C40 24 32 8 20 8C6 8 2 24 4 42C6 60 0 76 2 98C4 126 30 142 64 142C98 142 124 126 126 98C128 76 120 60 124 42C126 26 122 14 112 14C100 14 92 26 84 36Z" fill="#C2372E" stroke="#7E1C16" stroke-width="2"/>`;
    s += `<path d="M32 42H96Q114 44 116 64L118 112Q102 128 72 126L42 120Q26 104 30 74Z" fill="#F4F1EA" stroke="#C9C2B4" stroke-width="1"/>`;
    s += `<rect x="46" y="-6" width="36" height="46" fill="#3A2616"/>`;
    for (const y of [2, 14, 25]) s += `<rect x="46" y="${y}" width="36" height="1.4" fill="#C9CCD0"/>`;
    s += `<circle cx="64" cy="20" r="2.2" fill="#EDE6D6"/>`;
    // the pickup under the strings, shown opened: copper wire wound round six magnets
    s += `<rect x="40" y="52" width="48" height="16" rx="7" fill="#B8692E" stroke="#7A3F12" stroke-width="1"/>`;
    for (let x = 43; x < 86; x += 2.2) s += `<line x1="${f(x)}" y1="53" x2="${f(x)}" y2="67" stroke="#8A4A1A" stroke-width=".6"/>`;
    s += `<rect x="38" y="94" width="52" height="14" rx="7" fill="#F2EEE6" stroke="#C9C2B4"/>`;
    const T = [50.5, 55.5, 60.5, 65.5, 70.5, 75.5];
    const B = [49, 54.6, 60.2, 65.8, 71.4, 77];
    const wd = [1.8, 1.6, 1.4, 1.1, 0.9, 0.8];
    for (let i = 0; i < 6; i++) s += `<circle cx="${f((T[i] + B[i]) / 2)}" cy="60" r="2.4" fill="#D5DADF" stroke="#7C858D" stroke-width=".6"/><circle cx="${f((T[i] + B[i]) / 2)}" cy="101" r="2.2" fill="#9AA3AA"/>`;
    s += `<rect x="40" y="116" width="48" height="14" rx="2" fill="#C9CED2" stroke="#8A939A"/>`;
    for (let i = 0; i < 6; i++) {
      s += `<rect x="${f(B[i] - 2)}" y="118" width="4" height="7" rx="1" fill="#E6E9EC" stroke="#8A939A" stroke-width=".5"/>`;
      if (i !== 2) s += `<line x1="${T[i]}" y1="-6" x2="${B[i]}" y2="120" stroke="#DADDE0" stroke-width="${wd[i]}"/>`;
    }
    const str = (a) => `M${T[2]} -6C${f(T[2] + 6 * a)} 36 ${f(B[2] + 6 * a)} 80 ${B[2]} 120`;
    s += `<path d="${str(0.8)}" fill="none" stroke="#DADDE0" stroke-width="${wd[2]}">${anim('d', swing(str, D, { steady: true }), D)}</path>`;
    for (const [x, y] of [[104, 106], [110, 120], [96, 122]]) s += `<circle cx="${x}" cy="${y}" r="4.2" fill="#F4F1EA" stroke="#8A8478"/>`;
    // the cable, its signal running to the amplifier
    s += `<circle cx="121" cy="124" r="3" fill="#C9CED2" stroke="#6F7880"/><path d="M121 124C142 140 146 76 158 48" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    s += `<path d="M121 124C142 140 146 76 158 48" fill="none" stroke="#F1C54B" stroke-width="2" stroke-dasharray="3 9">${anim('stroke-dashoffset', [[0, 12], [1, 0]], 0.45)}</path>`;
    s += `<rect x="150" y="34" width="86" height="102" rx="6" fill="#2B2724" stroke="#141210" stroke-width="2"/><rect x="155" y="38" width="76" height="14" rx="2" fill="#D7B36E"/>`;
    s += `<circle cx="160" cy="45" r="3" fill="#C9CED2" stroke="#6F7880"/>`;
    for (const x of [176, 188, 200, 212, 224]) s += `<circle cx="${x}" cy="45" r="3.2" fill="#2B2724"/>`;
    s += `<rect x="156" y="56" width="74" height="74" rx="3" fill="#3A3632"/><circle cx="193" cy="93" r="31" fill="#1C1A18"/>`;
    s += `<g transform="translate(193 93)"><g>${anim('transform:scale', swing((a) => f(1 + (0.035 * (a + 1)) / 2), D, { steady: true }), D)}<circle r="27" fill="url(#${g})"/><circle r="9" fill="#232120"/></g></g>`;
    return s + rings(193, 93, 30, 46);
  },

  /* A piano key, the hammer it throws, the string, its damper, and the soundboard, from the
     side: the damper lifts, the hammer strikes and drops back, and when the key is let go the
     damper stops the string. */
  hammer: () => {
    const D = 3.2;
    const press = [[0, 0], [0.05, 0], [0.12, 1], [0.66, 1], [0.74, 0], [1, 0]];
    const at = (fr, fn) => fr.map(([t, k]) => [t, fn(k)]);
    let s = `<rect x="2" y="22" width="20" height="26" rx="2" fill="#5A3418"/><circle cx="14" cy="33" r="3.2" fill="#9AA3AA" stroke="#5E666C"/>`;
    s += `<rect x="222" y="22" width="18" height="26" rx="2" fill="#B8954A"/><circle cx="230" cy="33" r="2.6" fill="#7E6630"/>`;
    s += `<rect x="112" y="52" width="124" height="7" fill="#EED9A8" stroke="#C9AE74" stroke-width=".8"/>`;
    for (const y of [54, 56.5]) s += `<line x1="114" y1="${y}" x2="234" y2="${y}" stroke="#D9BF86" stroke-width=".6"/>`;
    s += `<path d="M190 52L192 35H200L202 52Z" fill="#6B3E1C"/>`;
    // the string: still until struck, ringing while the key is held, stopped by the damper
    const str = (a) => `M14 33Q123 ${f(33 + 6 * a)} 230 33`;
    const fr = swing(str, D, { hit: 0.12, end: 0.67, keep: 0.42 });
    fr.splice(fr.length - 2, 2, [0.685, str(0.25)], [0.7, str(0)], [1, str(0)]);
    s += `<path d="${str(0.7)}" fill="none" stroke="#8C949B" stroke-width="2">${anim('d', fr, D)}</path>`;
    s += `<g transform="translate(0 -8)">${anim('transform:translate', [[0, '0 0'], [0.07, '0 0'], [0.11, '0 -8'], [0.66, '0 -8'], [0.7, '0 0'], [1, '0 0']], D)}<rect x="90.5" y="0" width="3" height="20" fill="#9C9384"/><rect x="84" y="18" width="16" height="14.4" rx="2" fill="#F0EDE6" stroke="#9C9384"/><rect x="84" y="29" width="16" height="3.4" fill="#B9B1A2"/></g>`;
    // the key on its balance point, and the jack that lifts the hammer
    s += `<rect x="0" y="128" width="124" height="5" fill="#8A5A30"/><path d="M64 128H72L68 122Z" fill="#6B3E1C"/>`;
    s += `<g transform="translate(0 -4)">${anim('transform:translate', at(press, (k) => `0 ${-4 * k}`), D)}<rect x="93.5" y="80" width="5" height="30" rx="1" fill="#D8B98A" stroke="#A4865A" stroke-width=".6"/></g>`;
    s += `<g transform="rotate(-5 68 122)">${anim('transform:rotate', at(press, (k) => `${-5 * k} 68 122`), D)}<rect x="4" y="110" width="114" height="12" rx="1.5" fill="#E3C79B" stroke="#A88A5C" stroke-width=".8"/><rect x="4" y="109" width="38" height="13" rx="1.5" fill="#FBF8F1" stroke="#9C9384" stroke-width=".8"/></g>`;
    // the hammer on its pivot: up to the string, back a little, down when the key comes up
    const hm = anim('transform:rotate', [[0, '0 112 78'], [0.05, '0 112 78'], [0.12, '24 112 78'], [0.17, '11 112 78'], [0.66, '11 112 78'], [0.74, '0 112 78'], [1, '0 112 78']], D);
    s += `<rect x="106" y="72" width="12" height="12" rx="2" fill="#7A4A26"/>`;
    s += `<g transform="rotate(24 112 78)">${hm}<rect x="56" y="75" width="56" height="4.6" rx="2" fill="#C99A62" stroke="#9C7444" stroke-width=".6"/><rect x="52" y="63" width="12" height="15" rx="2" fill="#A8743E"/><rect x="49" y="62" width="18" height="3.2" fill="#B54A3C"/><path d="M49 63C49 56.5 53 53 58 53S67 56.5 67 63Z" fill="#F3EAD3" stroke="#B8AA88" stroke-width=".8"/></g>`;
    s += `<g transform="translate(19 113.3)">${anim('transform:translate', [[0, '19 106'], [0.05, '19 109'], [0.12, '19 113.3'], [0.66, '19 113.3'], [0.74, '19 109'], [0.8, '19 106'], [1, '19 106']], D)}${fingertip(14, 46)}</g>`;
    return s + waves(176, 61, 90, { r: 8, step: 7, dur: D, when: [[0.12, 1], [0.31, 0.7], [0.5, 0.45]], life: 0.17 });
  },

  /* An organ pipe from the side, with its mouth: air from the windchest comes up the foot and
     out of a slit at the bottom of the mouth, and flutters in and out at the sharp lip above
     it; the air inside rings. Behind it stand a shorter, higher pipe and a longer, lower one. */
  pipe: () => {
    const D = 1.2;
    const g = id('p');
    let s = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8D959C"/><stop offset=".35" stop-color="#F1F3F5"/><stop offset=".7" stop-color="#C3C9CE"/><stop offset="1" stop-color="#7E868D"/></linearGradient></defs>`;
    /* a pipe x0..x1 wide, from top down to its foot in the chest, its mouth's lip at y */
    const pipe = (x0, x1, top, y, fill, op = 1) => {
      const w = x1 - x0;
      const m = w * 0.45;
      const cx = (x0 + x1) / 2;
      return `<g opacity="${op}"><path d="M${x0} ${top}H${x1}V${f(y - 5)}L${f(x1 - w * 0.11)} ${y}V${f(y + m)}L${x1} ${f(y + m + 1)}V${f(y + m + 4)}L${f(cx + w * 0.17)} 117H${f(cx - w * 0.17)}L${x0} ${f(y + m + 4)}Z" fill="${fill}" stroke="#6F7880" stroke-width=".9"/>`
        + `<rect x="${f(x1 - w * 0.26)}" y="${y}" width="${f(w * 0.15)}" height="${f(m)}" fill="#2E3338"/><rect x="${x0}" y="${f(y + m + 1)}" width="${f(w * 0.85)}" height="2" fill="#6F7880" opacity=".6"/></g>`;
    };
    s += pipe(28, 46, 54, 92, `url(#${g})`, 0.7) + pipe(184, 210, -6, 88, `url(#${g})`, 0.7);
    s += `<rect x="6" y="116" width="228" height="22" rx="3" fill="#8A5A30"/><rect x="6" y="116" width="228" height="4" fill="#6E4422"/>`;
    s += air('M0 128H120V118', { dur: 0.6 });
    s += pipe(100, 140, 6, 74, `url(#${g})`);
    // the sheet of air, out of the slit and flipping in and out at the lip
    const jet = (a) => `M136.4 92Q${f(136.4 + a)} 82 ${f(137.6 + 6.5 * a)} 70`;
    s += `<path d="${jet(0.8)}" fill="none" stroke="${AIR}" stroke-width="2.6" stroke-linecap="round">${anim('d', swing(jet, D, { steady: true, hz: 6 }), D)}</path>`;
    return s + waves(150, 82, 0, { r: 9, step: 8 });
  },

  /* Blowing across the hole of a flute's head joint: the stream of air flips in and out at the
     far edge of the hole, and the air in the tube rings. */
  edge: () => {
    const D = 1.2;
    const g = id('s');
    let s = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2F4F6"/><stop offset=".5" stop-color="#C9CFD4"/><stop offset="1" stop-color="#8D959C"/></linearGradient></defs>`;
    s += face(86, 68) + lips(86, 68);
    s += `<rect x="56" y="80" width="190" height="20" fill="url(#${g})" stroke="${STEEL_DK}" stroke-width="1"/>`;
    s += `<rect x="60" y="83" width="186" height="14" fill="${AIR}" opacity=".2">${anim('opacity', swing((a) => f(0.24 + 0.16 * a), D, { steady: true, hz: 7 }), D)}</rect>`;
    s += `<rect x="48" y="79" width="12" height="22" rx="4" fill="url(#${g})" stroke="${STEEL_DK}"/>`;
    for (const x of [170, 196, 222]) s += `<rect x="${x - 2}" y="72" width="4" height="8" fill="#9AA1A8"/><ellipse cx="${x}" cy="72" rx="9" ry="3.4" fill="url(#${g})" stroke="${STEEL_DK}" stroke-width=".8"/>`;
    s += `<path d="M78 80Q78 75 84 75H104Q110 75 110 80Z" fill="url(#${g})" stroke="${STEEL_DK}" stroke-width=".8"/>`;
    s += `<ellipse cx="94" cy="77" rx="7" ry="2.4" fill="#2E3338"/>`;
    const jet = (a) => `M86 68.5Q93 70 ${f(98.5 + 2 * a)} ${f(75 + a)}T${f(104 + 6 * a)} ${f(78 + 7 * a)}`;
    s += `<path d="${jet(0.8)}" fill="none" stroke="${AIR}" stroke-width="2.6" stroke-linecap="round">${anim('d', swing(jet, D, { steady: true, hz: 7 }), D)}</path>`;
    return s + waves(108, 66, 300, { r: 9, step: 8 }) + waves(222, 64, 270, { r: 7, step: 6 });
  },

  /* A clarinet's mouthpiece from the side: the thin reed under it beats against its tip,
     letting in puffs of air, and the air in the tube rings. */
  reed: () => {
    const D = 1.2;
    let s = face(58, 72) + `<rect x="114" y="49" width="32" height="30" rx="5" fill="${BLACK}"/><rect x="146" y="51" width="100" height="26" fill="${BLACK}"/>`;
    for (const x of [113, 145]) s += `<rect x="${x}" y="48" width="3" height="32" rx="1" fill="#C9CED2"/>`;
    for (const x of [176, 200, 224]) s += `<ellipse cx="${x}" cy="51.5" rx="5.5" ry="2" fill="#0B0B0D" stroke="#C9CED2" stroke-width="1.4"/>`;
    s += `<path d="M160 49H232" stroke="#C9CED2" stroke-width="1.4"/>`;
    s += `<path d="M26 72Q26 67 32 66L100 50H114V78H104L34 74Q27 74 26 72Z" fill="${BLACK}"/>`;
    s += `<path d="M44 70Q80 63 112 64" fill="none" stroke="#3A3A40" stroke-width="5" stroke-linecap="round"/>`;
    // the reed: its tip beats up against the mouthpiece and back
    const rd = (a) => { const k = (a + 1) / 2; return `M28 ${f(75.6 - 3.2 * k)}Q60 ${f(74.4 - 0.9 * k)} 80 74.2L104 74.2V80L80 79Q60 ${f(78.4 - 0.9 * k)} 30 ${f(77.3 - 3.2 * k)}Z`; };
    s += `<path d="${rd(0)}" fill="#E7C57A" stroke="#A9853A" stroke-width=".8">${anim('d', swing(rd, D, { steady: true, hz: 7 }), D)}</path>`;
    s += `<path d="M75 54Q84 51 93 52V82Q84 84 75 82Z" fill="#C9CED2" stroke="#6F7880" stroke-width=".8"/><rect x="77" y="82" width="4" height="5" fill="#8A939A"/><rect x="87" y="82" width="4" height="5" fill="#8A939A"/>`;
    s += `<path d="M36 64Q46 58 58 58L60 63Q48 66 38 69Z" fill="${LIP}"/><path d="M30 79Q44 77 58 79Q56 88 44 89Q32 88 30 79Z" fill="${LIP_DK}"/>`;
    s += air('M29 73.6Q60 66 110 64H238', { dur: 0.7 });
    return s + waves(224, 46, 270, { r: 7, step: 6 });
  },

  /* An oboe's reed from the side: two blades of cane tied on a little tube, buzzing against
     each other at their tips, then the oboe's black tube with its keys. */
  'double-reed': () => {
    const D = 1.2;
    let s = face(46, 68.5) + `<path d="M110 57L246 54V83L110 80Z" fill="${BLACK}"/>`;
    s += `<path d="M124 59H240" stroke="#C9CED2" stroke-width="1.4"/>`;
    for (const x of [150, 172, 196, 220]) s += `<ellipse cx="${x}" cy="56" rx="5.5" ry="2" fill="#C9CED2" stroke="#6F7880" stroke-width=".6"/>`;
    s += `<circle cx="136" cy="70" r="4" fill="none" stroke="#C9CED2" stroke-width="1.4"/>`;
    s += `<rect x="96" y="61" width="16" height="15" rx="2" fill="#C9A37A" stroke="#8E6E46" stroke-width=".8"/>`;
    s += `<rect x="74" y="59" width="23" height="19" rx="2" fill="#B7442E"/>`;
    for (let x = 76; x < 96; x += 3) s += `<line x1="${x}" y1="59" x2="${x + 2}" y2="78" stroke="#8E2F1E" stroke-width=".8"/>`;
    const k = (a) => (a + 1) / 2;
    const top = (a) => `M20 ${f(66.5 + 0.9 * k(a))}Q48 ${f(63.2 + 0.4 * k(a))} 74 61V65.5Q48 ${f(66.4 + 0.4 * k(a))} 20 ${f(67.6 + 0.9 * k(a))}Z`;
    const bot = (a) => `M20 ${f(70.5 - 0.9 * k(a))}Q48 ${f(73.8 - 0.4 * k(a))} 74 76V71.5Q48 ${f(70.6 - 0.4 * k(a))} 20 ${f(69.4 - 0.9 * k(a))}Z`;
    s += `<path d="${top(0)}" fill="#E9C77A" stroke="#A9853A" stroke-width=".7">${anim('d', swing(top, D, { steady: true, hz: 8 }), D)}</path>`;
    s += `<path d="${bot(0)}" fill="#E1BB66" stroke="#A9853A" stroke-width=".7">${anim('d', swing(bot, D, { steady: true, hz: 8 }), D)}</path>`;
    s += `<path d="M22 57Q34 55 46 59L44 63.8Q34 63 24 64.6Z" fill="${LIP}"/><path d="M22 80Q34 82 46 78L44 73.2Q34 74 24 72.4Z" fill="${LIP_DK}"/>`;
    s += air('M21 68.5H236', { dur: 0.7 });
    return s + waves(220, 50, 270, { r: 7, step: 6 });
  },

  /* Lips buzzing into a trumpet's mouthpiece, and the air ringing along the tube and out of
     the bell. */
  lips: () => {
    const D = 1.2;
    const g = id('b');
    let s = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3D98A"/><stop offset=".45" stop-color="${BRASS}"/><stop offset="1" stop-color="#8A6216"/></linearGradient></defs>`;
    s += face(24, 65);
    s += `<path d="M50 61H150C164 61 170 58 176 57C192 54 204 40 212 16V114C204 90 192 76 176 73C170 72 164 69 150 69H50Z" fill="url(#${g})" stroke="${BRASS_DK}" stroke-width="1.4"/>`;
    s += `<ellipse cx="212" cy="65" rx="3" ry="49" fill="#7A5512"/>`;
    for (const x of [84, 98, 112]) s += `<rect x="${x}" y="44" width="11" height="40" rx="2" fill="url(#${g})" stroke="${BRASS_DK}" stroke-width="1"/><rect x="${x + 3}" y="38" width="5" height="6" fill="${STEEL}"/><ellipse cx="${x + 5.5}" cy="37" rx="6" ry="2.6" fill="#F5F0E6" stroke="#B9B2A4" stroke-width=".8"/>`;
    s += `<path d="M24 50H30C38 50 42 59 46 62.5H52V67.5H46C42 71 38 80 30 80H24Z" fill="url(#${g})" stroke="${BRASS_DK}" stroke-width="1.2"/>`;
    s += air('M26 65H208', { dur: 0.6 });
    s += lips(24, 65, { buzz: 1.4, dur: D });
    return s + waves(216, 65, 0, { r: 6, step: 7 });
  },

  /* A drum: the stick strikes the head, the head bounces up and down, and the drum booms. */
  drumhead: () => {
    const D = 2;
    const g = id('d');
    const h = id('h');
    let s = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4E0A16"/><stop offset=".4" stop-color="#A8243A"/><stop offset="1" stop-color="#4E0A16"/></linearGradient><radialGradient id="${h}" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#FBF6EC"/><stop offset="1" stop-color="#E6DAC2"/></radialGradient></defs>`;
    s += `<path d="M40 56V112A80 16 0 0 0 200 112V56Z" fill="url(#${g})"/>`;
    s += `<path d="M38 112A82 17 0 0 0 202 112" fill="none" stroke="#8E969D" stroke-width="5"/>`;
    for (const th of [200, 235, 270, 305, 340]) {
      const x = f(120 + 80 * Math.cos((th * Math.PI) / 180));
      s += `<line x1="${x}" y1="60" x2="${x}" y2="116" stroke="#C9CED2" stroke-width="1.6"/><rect x="${f(x - 3.5)}" y="78" width="7" height="16" rx="3" fill="#DDE1E4" stroke="#8E969D" stroke-width=".8"/>`;
    }
    s += `<ellipse cx="120" cy="56" rx="79" ry="15.5" fill="url(#${h})"/>`;
    const head = (a) => `M44 56Q120 ${f(56 + 15 * a)} 196 56`;
    s += `<path d="${head(0.7)}" fill="none" stroke="#B9A98A" stroke-width="2">${anim('d', swing(head, D, { hit: 0.1, end: 0.5, keep: 0.08, hz: 7, first: 1 }), D)}</path>`;
    s += `<ellipse cx="120" cy="56" rx="82" ry="17" fill="none" stroke="#8E969D" stroke-width="5"/>`;
    const st = anim('transform:rotate', [[0, '18 226 6'], [0.1, '0 226 6'], [0.2, '10 226 6'], [0.45, '18 226 6'], [1, '18 226 6']], D, 'calcMode="spline" keySplines=".6 0 1 1;0 0 .4 1;.4 0 .6 1;0 0 1 1"');
    s += `<g transform="rotate(4 226 6)">${st}<path d="M226 3.4L142 48.6L143.6 51.4L227.2 8.6Z" fill="#E5C38F" stroke="#9C6B33" stroke-width=".8"/><ellipse cx="140.6" cy="50.6" rx="3.6" ry="2.6" transform="rotate(-27 140.6 50.6)" fill="#E5C38F" stroke="#9C6B33" stroke-width=".8"/></g>`;
    return s + waves(30, 84, 180, { dur: D, when: [[0.1, 1]], life: 0.3 }) + waves(210, 84, 0, { dur: D, when: [[0.1, 1]], life: 0.3 });
  },

  /* A bar on its cords, struck in the middle by a mallet: it bends about its two still points,
     less each time. A xylophone's or marimba's has a tube under it, ringing with it. */
  struck: (o = {}) => {
    const D = 2.2;
    const L = o.metal ? 144 : 180;
    const x0 = 120 - L / 2;
    const th = o.metal ? 9 : 12;
    const end = o.metal ? 0.97 : o.tube ? 0.66 : 0.3;
    const g = id('m');
    const [c0, c1, edge] = o.metal ? ['#E9EDF0', '#9AA3AA', STEEL_DK] : ['#C27A45', '#8A4A22', WOOD_DK];
    let s = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs>`;
    if (o.tube) {
      s += `<rect x="40" y="86" width="160" height="6" rx="2" fill="#6B3E1C"/>`;
      s += `<rect x="104" y="64" width="32" height="74" rx="3" fill="#C4C9CE" stroke="${STEEL_DK}" stroke-width="1.2"/><ellipse cx="120" cy="64" rx="16" ry="4" fill="#2E3338"/>`;
      s += `<rect x="107" y="68" width="26" height="66" fill="${AIR}" opacity=".3">${anim('opacity', [[0, 0], [0.1, 0], [0.12, 0.5], [end, 0], [1, 0]], D)}</rect>`;
    }
    const nodes = [x0 + 0.224 * L, x0 + 0.776 * L];
    for (const x of nodes) s += `<rect x="${f(x - 1.5)}" y="${50 + th / 2}" width="3" height="${o.tube ? 30 : 20}" fill="#7A4A26"/>`;
    const bar = (a) => {
      const A = 4.5 * a;
      const top = BEND.map((w, i) => `${f(x0 + (L * i) / 10)} ${f(50 - th / 2 + A * w)}`);
      const bot = BEND.map((w, i) => `${f(x0 + (L * i) / 10)} ${f(50 + th / 2 + A * w)}`).reverse();
      return `M${top.join('L')}L${bot.join('L')}Z`;
    };
    s += `<path d="${bar(0.7)}" fill="url(#${g})" stroke="${edge}" stroke-width="1.2" stroke-linejoin="round">${anim('d', swing(bar, D, { hit: 0.1, end, keep: 0.06, hz: 7 }), D)}</path>`;
    for (const x of nodes) s += `<circle cx="${f(x)}" cy="50" r="1.8" fill="#3A1C0C"/><line x1="${f(x - 10)}" y1="50" x2="${f(x + 10)}" y2="50" stroke="#C64A4A" stroke-width="1.2" opacity=".8"/>`;
    const head = o.metal ? '#3B4A6B' : o.tube ? '#C64A4A' : '#8A5A30';
    const ml = anim('transform:rotate', [[0, '16 228 4'], [0.1, '0 228 4'], [0.18, '9 228 4'], [0.4, '16 228 4'], [1, '16 228 4']], D, 'calcMode="spline" keySplines=".6 0 1 1;0 0 .4 1;.4 0 .6 1;0 0 1 1"');
    s += `<g transform="rotate(3 228 4)">${ml}<line x1="228" y1="4" x2="126" y2="${f(50 - th / 2 - 9.4)}" stroke="#E2B27A" stroke-width="3.2" stroke-linecap="round"/><circle cx="126" cy="${50 - th / 2 - 9.4}" r="9" fill="${head}"/><circle cx="123" cy="${50 - th / 2 - 12}" r="2.6" fill="#fff" opacity=".35"/></g>`;
    const when = o.metal ? [[0.1, 1], [0.38, 0.65], [0.66, 0.35]] : o.tube ? [[0.1, 1], [0.36, 0.5]] : [[0.1, 1]];
    return s + waves(x0 - 6, 50, 180, { r: 7, step: 7, dur: D, when, life: 0.26 }) + waves(246 - x0, 50, 0, { r: 7, step: 7, dur: D, when, life: 0.26 });
  },

  /* A maraca rocking from side to side: the seeds inside fly across and hit the shell. */
  shake: () => {
    const D = 1.2;
    let s = `<g transform="rotate(10 120 136)">${anim('transform:rotate', [[0, '0 120 136'], [0.25, '12 120 136'], [0.75, '-12 120 136'], [1, '0 120 136']], D, 'calcMode="spline" keySplines="0 0 .58 1;.42 0 .58 1;.42 0 1 1"')}`;
    s += `<rect x="115" y="88" width="10" height="46" rx="4" fill="#9C6B33" stroke="#6B4520"/><ellipse cx="120" cy="135" rx="7" ry="4" fill="#8A5A2A"/>`;
    s += `<ellipse cx="120" cy="54" rx="42" ry="38" fill="#E8A845" stroke="#9A6418" stroke-width="2.4"/>`;
    s += `<path d="M80 44Q120 30 160 44M78 64Q120 78 162 64" fill="none" stroke="#C64A4A" stroke-width="5" opacity=".85"/>`;
    s += `<ellipse cx="120" cy="54" rx="34" ry="30" fill="#F7E2B4"/>`;
    const beads = [[-8, -10], [2, -14], [-12, 2], [0, 0], [10, -4], [-4, 12], [8, 10], [-14, -6], [4, 16]];
    beads.forEach(([dx, dy], i) => {
      const j = (i % 3) * 0.015;
      const m = anim('transform:translate', [[0, '-12 0'], [0.06 + j, '-12 0'], [0.2 + j, '12 0'], [0.56 + j, '12 0'], [0.7 + j, '-12 0'], [1, '-12 0']], D);
      s += `<circle cx="${120 + dx}" cy="${54 + dy}" r="4.2" fill="#6B3E12" transform="translate(12 0)">${m}</circle>`;
    });
    const tick = (x, k, at) => `<path d="M${x} 36l${4 * k} -6M${x + 6 * k} 54h${8 * k}M${x} 72l${4 * k} 6" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" opacity="${k > 0 ? 1 : 0}">${anim('opacity', [[0, 0], [at, 0], [at + 0.02, 1], [at + 0.14, 0], [1, 0]], D)}</path>`;
    s += tick(164, 1, 0.2) + tick(76, -1, 0.7);
    return `${s}</g>${waves(186, 50, 0, { dur: D, when: [[0.2, 1]], life: 0.26 })}${waves(54, 50, 180, { dur: D, when: [[0.7, 1]], life: 0.26 })}`;
  },

  /* A güiro: a stick pulled over its ridges clicks at each one, and comes back lifted. */
  scrape: () => {
    const D = 1.6;
    let s = `<path d="M20 86C20 62 60 54 120 54C180 54 222 64 226 86C222 108 180 118 120 118C60 118 20 110 20 86Z" fill="#D9A55A" stroke="#8E5E1E" stroke-width="2"/>`;
    s += `<path d="M30 84C40 70 80 62 120 62" fill="none" stroke="#F1C98A" stroke-width="4" stroke-linecap="round" opacity=".6"/>`;
    for (let x = 64; x <= 192; x += 8) s += `<path d="M${x} ${f(57 + Math.abs(x - 125) * 0.03)}Q${x - 3} 74 ${x} 92" fill="none" stroke="#8E5E1E" stroke-width="2.4" stroke-linecap="round"/>`;
    s += `<ellipse cx="70" cy="104" rx="7" ry="3.4" fill="#5A3A12"/><ellipse cx="96" cy="108" rx="7" ry="3.4" fill="#5A3A12"/>`;
    const n = 16;
    const fr = [];
    for (let k = 0; k <= n; k++) fr.push([(0.56 * k) / n, `${f(-44 + (100 * k) / n)} ${k % 2 ? -1.8 : 0}`]);
    fr.push([0.64, '56 -14'], [0.94, '-44 -14'], [1, '-44 0']);
    // the clicks flash at each ridge (from nothing at the start, so the loop doesn't pop)
    const tk = [[0, 0]];
    for (let k = 0; k <= n; k++) tk.push([Math.max(0.012, (0.56 * k) / n), k % 2 ? 0.15 : 1]);
    tk.push([0.6, 0], [1, 0]);
    s += `<g transform="translate(4 -1.8)">${anim('transform:translate', fr, D)}<path d="M100 56L190 22" stroke="${WOOD_LT}" stroke-width="5" stroke-linecap="round"/><path d="M100 56L190 22" stroke="${WOOD_DK}" stroke-width="1" stroke-linecap="round" opacity=".5"/><path d="M96 46v-7M88 49l-5-4M104 49l5-4" stroke="${INK}" stroke-width="2" stroke-linecap="round">${anim('opacity', tk, D)}</path></g>`;
    const when = [[0, 0.9], [0.19, 0.9], [0.38, 0.8]];
    return s + waves(15, 86, 180, { r: 4, step: 5, dur: D, when, life: 0.18 }) + waves(231, 86, 0, { r: 4, step: 5, dur: D, when, life: 0.18 });
  },

  /* A kalimba from the side: a thumb pushes a tine's end down and lets go, and it springs up
     and down, fixed at the bridge. Shorter tines stand behind it. */
  tine: () => {
    const D = 2.2;
    const g = id('k');
    let s = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C98552"/><stop offset="1" stop-color="#8E4E24"/></linearGradient></defs>`;
    s += `<rect x="30" y="94" width="180" height="30" rx="6" fill="url(#${g})" stroke="${WOOD_DK}" stroke-width="1.4"/><circle cx="188" cy="110" r="6" fill="#3A1C0C"/>`;
    for (const [end, y, c] of [[110, 74, '#C9CFD4'], [90, 77, '#B4BCC3'], [72, 80, '#9EA7AF']]) s += `<path d="M204 ${y - 2}L176 ${y}H${end}" fill="none" stroke="#6F7880" stroke-width="4" stroke-linecap="round"/><path d="M204 ${y - 2}L176 ${y}H${end}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`;
    s += `<rect x="170" y="86" width="12" height="8" fill="#7A4A26"/><circle cx="176" cy="85.4" r="2.6" fill="#8F979E"/>`;
    const tine = (d) => `M204 81L176 83C140 83 100 ${f(83 + 0.35 * d)} 56 ${f(83 + d)}`;
    const fr = swing((a) => tine(6 * a), D, { hit: 0.15, end: 0.92, keep: 0.05, hz: 6, lead: [[0, tine(0)], [0.06, tine(0)], [0.13, tine(7)]] });
    s += `<path d="${tine(-4)}" fill="none" stroke="#5E666C" stroke-width="5" stroke-linecap="round">${anim('d', fr, D)}</path><path d="${tine(-4)}" fill="none" stroke="#DDE2E6" stroke-width="3" stroke-linecap="round">${anim('d', fr, D)}</path>`;
    s += `<rect x="188" y="74" width="16" height="8" rx="1.5" fill="#8F979E" stroke="#5E666C" stroke-width=".8"/><circle cx="196" cy="78" r="2" fill="#5E666C"/>`;
    const th = anim('transform:translate', [[0, '0 -10'], [0.06, '0 -1'], [0.13, '0 7'], [0.17, '-14 4'], [0.24, '-24 -16'], [0.9, '0 -10']], D)
      + anim('opacity', [[0, 1], [0.2, 1], [0.28, 0], [0.88, 0], [0.97, 1]], D);
    s += `<g transform="translate(-14 4)">${th}<g transform="translate(60 80) rotate(145)">${fingertip(16, 46)}</g></g>`;
    return s + waves(24, 108, 180, { r: 6, step: 7, dur: D, when: [[0.15, 1], [0.45, 0.55]], life: 0.26 }) + waves(216, 108, 0, { r: 6, step: 7, dur: D, when: [[0.15, 1], [0.45, 0.55]], life: 0.26 });
  },
};

/* What happens, step by step, for each way of making a sound. */
export const KINDS = {
  bow: { name: 'Bowed string', diagram: 'bow', steps: [
    'Rosin makes the bow’s hair sticky, so it grabs the string, pulls it sideways and lets it slip back, hundreds of times a second.',
    'The bridge passes the string’s shaking into the wooden body.',
    'The hollow body makes the sound big, and it comes out of the f-holes.',
  ] },
  pluck: { name: 'Plucked string', diagram: 'pluck', steps: [
    'A finger or a pick pulls the string to one side and lets go.',
    'The string swings back and forth, and the bridge passes its shaking into the body.',
    'The body rings with it, and the sound comes out of the hole.',
  ] },
  pickup: { name: 'Electric string', diagram: 'pickup', steps: [
    'The steel string shakes above the pickup: magnets wrapped in fine wire.',
    'Its shaking makes a tiny electric signal in the wire.',
    'The amplifier makes the signal strong, and its speaker turns it back into sound.',
  ] },
  hammer: { name: 'Struck string', diagram: 'hammer', steps: [
    'Pressing a key flings a felt hammer up at the strings.',
    'The hammer bounces straight off, and the strings ring.',
    'A wooden soundboard under the strings makes them loud. Let go of the key, and a felt damper stops them.',
  ] },
  pipe: { name: 'Pipe', diagram: 'pipe', steps: [
    'A key opens a valve, and air from a fan rushes into the foot of a pipe.',
    'The air hits a sharp edge at the pipe’s mouth and flutters in and out.',
    'The air inside the pipe rings at one note: a long pipe sounds low, a short one high.',
  ] },
  edge: { name: 'Air over an edge', diagram: 'edge', steps: [
    'You blow across the hole, like blowing over the top of a bottle.',
    'The stream of air hits the far edge of the hole and flips in and out, hundreds of times a second.',
    'That sets the air in the tube ringing. Cover holes, and the ringing air is longer and the note lower.',
  ] },
  reed: { name: 'Single reed', diagram: 'reed', steps: [
    'You blow into the mouthpiece, and a thin reed of cane beats against it.',
    'Each beat lets a puff of air into the tube.',
    'The air in the tube rings at one note. Keys and holes change how long it is.',
  ] },
  'double-reed': { name: 'Double reed', diagram: 'double-reed', steps: [
    'Two thin blades of cane are tied together, with a tiny gap between them.',
    'Blowing makes the blades buzz against each other, opening and closing the gap.',
    'The buzz sets the air in the tube ringing. Keys and holes change how long it is.',
  ] },
  lips: { name: 'Buzzing lips', diagram: 'lips', steps: [
    'You press your lips into the cup of the mouthpiece and buzz them.',
    'The buzz sets the air in the long tube ringing.',
    'Tighter lips buzz faster and play higher. Valves or a slide add tube for lower notes.',
  ] },
  drumhead: { name: 'Drumhead', diagram: 'drumhead', steps: [
    'A stick or a hand strikes the drumhead, a skin stretched tight over the drum.',
    'The head bounces up and down, pushing the air.',
    'The drum rings with it. A big, loose head sounds low, and a small, tight one high.',
  ] },
  bar: { name: 'Struck bar', diagram: 'struck', opts: { tube: true }, steps: [
    'A mallet strikes the bar, and it bends back and forth very fast.',
    'A shorter bar shakes faster, so it plays higher.',
    'The tube underneath rings at the same note and makes it louder.',
  ] },
  metal: { name: 'Struck metal', diagram: 'struck', opts: { metal: true }, steps: [
    'A stick or a beater strikes the metal.',
    'The whole piece shakes, and metal keeps on shaking for a long time.',
    'Its shaking pushes the air, and that is the sound.',
  ] },
  wood: { name: 'Struck wood', diagram: 'struck', opts: {}, steps: [
    'A stick strikes the hard wood.',
    'The wood shakes for a moment and stops, so the sound is a short click or knock.',
  ] },
  shake: { name: 'Shaken', diagram: 'shake', steps: [
    'Shaking throws the seeds, balls or jingles against each other and the shell.',
    'Every little hit clicks, and hundreds of clicks together make the swish or jingle.',
  ] },
  scrape: { name: 'Scraped', diagram: 'scrape', steps: [
    'A stick, or a ring of beads, is pulled over a row of ridges.',
    'Each ridge flicks it, and every flick clicks.',
    'Quick clicks run together into a rasp.',
  ] },
  tine: { name: 'Plucked tine', diagram: 'tine', steps: [
    'Your thumb pushes the end of a metal tine down and lets it go.',
    'The tine springs back and forth: a short tine fast and high, a long one slow and low.',
    'The wooden box underneath makes it louder.',
  ] },
};

/* Each instrument: its way of making sound, and one thing about it in particular. */
export const HOW = {
  piano: ['hammer', 'Each key has its own hammer, and most notes have two or three strings tuned together, to ring louder.'],
  organ: ['pipe', 'A big organ has a pipe for every note of every stop. Electric organs copy the sound with spinning metal wheels instead of pipes.'],
  violin: ['bow', 'Its strings are short and thin, so they shake fast: 196 times a second on the lowest, G, and 659 on E.'],
  viola: ['bow', 'Its strings are a little longer and thicker than a violin’s, so they shake more slowly: 131 times a second on its lowest C.'],
  cello: ['bow', 'Its long, thick strings shake only 65 times a second on the lowest C. The cellist sits and rests it on its spike.'],
  bass: ['bow', 'Its lowest string shakes just 41 times a second, slowly enough to feel as well as hear.'],
  guitar: ['pluck', 'Its nylon strings and big hollow body give it a soft, round sound.'],
  'electric-guitar': ['pickup', 'Its body is solid wood, so unplugged it is quiet. The amplifier makes it loud.'],
  'electric-bass': ['pickup', 'Its four long, heavy strings play the same notes as a double bass, through an amplifier.'],
  banjo: ['pluck', 'Its top is a drumhead, not wood, so its notes snap bright and die away quickly.'],
  ukulele: ['pluck', 'Its short nylon strings and small body make a bright, high voice.'],
  harp: ['pluck', 'Each string plays one note. Pedals at its foot turn little discs that grip the strings and shorten them, for sharps.'],
  flute: ['edge', 'It has no reed at all: the edge of the hole does the reed’s job.'],
  clarinet: ['reed', 'Its tube is the same width all the way down, which lets it play very low for its size.'],
  oboe: ['double-reed', 'Oboists make their own reeds, carving the cane with a knife.'],
  saxophone: ['reed', 'It is made of brass, but it has a reed like a clarinet’s, so it counts as a woodwind.'],
  bassoon: ['double-reed', 'Its tube is about two and a half metres long, folded in two so a player can hold it.'],
  trumpet: ['lips', 'Its three valves send the air round extra loops of tube, to play lower notes.'],
  horn: ['lips', 'Its tube is coiled round and round: unwound, it would be nearly 4 metres long.'],
  trombone: ['lips', 'Its slide makes the tube longer or shorter: out for low notes, in for high ones.'],
  tuba: ['lips', 'Its coiled tube is about 5½ metres long, which is why its notes are so low.'],
  drums: ['drumhead', 'Each drum is its own size: the big bass drum booms low and the small toms sound high.'],
  timpani: ['drumhead', 'A pedal stretches its head tighter or looser, so it plays real notes.'],
  snare: ['drumhead', 'Wires stretched under the bottom head buzz against it: that is its snap.'],
  bassdrum: ['drumhead', 'Its head is huge and loose, so it moves slowly and booms.'],
  cymbals: ['metal', 'The whole bronze plate shakes, and its thin edge rings on long after the crash.'],
  triangle: ['metal', 'One corner is left open, so the steel rod can ring freely.'],
  tambourine: ['shake', 'Pairs of metal discs, the jingles, clash together when you shake or strike it.'],
  gong: ['metal', 'Its big bronze disc grows louder for a moment after it is struck, then rings for a long time.'],
  'sleigh-bells': ['shake', 'A little metal ball inside each bell rattles against its sides.'],
  glockenspiel: ['bar', 'Its bars are steel, so they ring bright and long. It needs no tubes: it is loud enough without them.'],
  xylophone: ['bar', 'Its rosewood bars are cut thinner in the middle underneath, which tunes them.'],
  marimba: ['bar', 'Its wide wooden bars and long tubes give it a deep, warm voice.'],
  congas: ['drumhead', 'Players hit near the edge for a ringing tone, in the middle for a deep one, and slap for a crack.'],
  bongos: ['drumhead', 'Two small drums joined together: the smaller one sounds higher.'],
  agogo: ['metal', 'Two bells of different sizes on one handle: the small bell plays high, the big one low.'],
  cowbell: ['metal', 'It has no clapper inside: you strike it with a stick.'],
  claves: ['wood', 'Your cupped hand under one clave makes a little echo chamber, so it clicks louder.'],
  guiro: ['scrape', 'Scrape fast for a short rasp, and slowly for a long one.'],
  shaker: ['shake', 'Hundreds of tiny hits from the seeds blend into one swish.'],
  cabasa: ['scrape', 'Twisting it rolls loops of steel beads over a ridged metal sleeve.'],
  'log-drum': ['wood', 'Each tongue cut into the box rings like a bar, and the hollow box makes it louder. A longer tongue sounds lower.'],
  kalimba: ['tine', 'Its tines are tuned by sliding them in or out: a shorter tine plays higher.'],
};

/* The diagram for a way of making sound, moving unless `still`. */
export function diagram(kind, { still: keep = false } = {}) {
  const k = KINDS[kind];
  still = keep;
  try {
    return `<svg class="how-art kind-${kind}" viewBox="0 0 240 140" aria-hidden="true">${DIAGRAMS[k.diagram](k.opts)}</svg>`;
  } finally {
    still = false;
  }
}

/* The placard's section: the diagram, the steps, and the instrument's own note. */
export function section(id, esc, { still: keep = false } = {}) {
  const [kind, note] = HOW[id];
  const k = KINDS[kind];
  return `<h3>How it makes its sound <span class="kind">${esc(k.name)}</span></h3>`
    + `<div class="how-body">${diagram(kind, { still: keep })}<div><ol>${k.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`
    + `<p class="note">${esc(note)}</p></div></div>`;
}
