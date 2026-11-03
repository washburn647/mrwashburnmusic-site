/* Mookie, rigged: the big Mookie that lives in a scene. Same drawing as mookie.js (Kyle's
   mockups), cut into parts that move on springs: body (bob, squash, lean), head (tilt, bob),
   ears, eyes (look, pupils, blinks), arms (rest, raise, a rubber-hose reach to any point on
   the page), tail (a chain that sways), collar bell. Expressions swap the eyes and mouth.
     const m = rigMookie();  stage.append(m.el);
     m.mood('hunt');  m.look(1, 0);  m.reach(x, y)  (page px)  m.beat(down, spb, tier)
   Supper Time adds sleep (with an optional snot bubble: class "snot" on the svg, size --snot),
   eat (cheeks full) and sad.
   Brushing Time gives him a coat (classes on the svg): "furry" (a fluffy outline, size from
   m.fluff(n), and tufts that sproing out with m.tuft(i)), "tangled" (knots) and "sleek"
   (gloss, sparkles and a slicked-back quiff).
   Fixed markup only: nothing a learner types goes in here. Stops itself when removed. */

import { fur } from './cats.js';

const CAT = '#17171b';
const EDGE = '#34343d';
const EYE = '#cde374';
const PINK = '#c98a93';
const NS = 'http://www.w3.org/2000/svg';

/* Brushing Time's coat: a fluffy outline behind the body and head, knots, gloss, and tufts
   that stick out (x, y, angle: 0 points up). The first four are on the head. */
const FLUFF_BODY = fur(100, 154, 46, 52, { tufts: 22, amp: 8, seed: 41, flat: 204, top: 0.8 });
const FLUFF_HEAD = fur(100, 78, 45, 39, { tufts: 26, amp: 7, seed: 43, bottom: 1.1 });
const TUFTS = [[100, 41, 0], [58, 82, -80], [142, 82, 80], [80, 44, -30], [60, 146, -100], [140, 146, 100], [63, 178, -112], [137, 178, 112]];
const TUFT = 'M-7 2 Q-9 -10 -4 -18 Q-3 -10 0 -24 Q3 -10 5 -18 Q9 -9 7 2 Z';
const tufts = (list) => list.map(([x, y, a]) => `<g transform="translate(${x} ${y}) rotate(${a})"><path class="r-tuft" d="${TUFT}" fill="${CAT}" stroke="${EDGE}" stroke-width="1.2"/></g>`).join('');
const knots = (list) => list.map(([x, y]) => `<path d="M${x} ${y} c6 -6 12 2 6 6 c-6 4 -11 -6 -2 -8 c9 -2 11 9 1 11 c-7 1 -9 -5 -4 -7"/>`).join('');
const SPARK = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -10 Q1.5 -1.5 10 0 Q1.5 1.5 0 10 Q-1.5 1.5 -10 0 Q-1.5 -1.5 0 -10 Z"/>`;

const MARKUP = `
<g class="r-root">
  <path class="r-tail" fill="none" stroke="${CAT}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  <path class="r-fluff" d="${FLUFF_BODY}" fill="${CAT}" stroke="${EDGE}" stroke-width="1.2"/>
  <path d="M100 100 C62 104 52 150 58 188 C61 204 139 204 142 188 C148 150 138 104 100 100 Z" fill="${CAT}"/>
  <g class="r-tufts">${tufts(TUFTS.slice(4))}</g>
  <g class="r-knots" stroke="#5c5c6a" stroke-width="2.2" fill="none" stroke-linecap="round">${knots([[72, 136], [118, 146], [80, 172], [114, 180], [96, 158]])}</g>
  <g class="r-gloss" stroke="#fff" stroke-linecap="round" fill="none"><path d="M68 132 Q63 160 71 186" stroke-width="4" opacity=".4"/><path d="M132 134 Q138 156 132 176" stroke-width="3" opacity=".3"/></g>
  <ellipse cx="80" cy="200" rx="15" ry="8" fill="${CAT}"/><ellipse cx="120" cy="200" rx="15" ry="8" fill="${CAT}"/>
  <g class="r-arm-l"><path class="r-arm" fill="none" stroke="${CAT}" stroke-width="15" stroke-linecap="round"/>
    <g class="r-paw"><circle r="10" fill="${CAT}" stroke="${EDGE}" stroke-width="1.5"/>
      <g class="r-beans" fill="${PINK}"><ellipse cx="0" cy="2.5" rx="4" ry="3"/><circle cx="-5" cy="-3" r="1.9"/><circle cx="0" cy="-5.2" r="1.9"/><circle cx="5" cy="-3" r="1.9"/></g></g></g>
  <g class="r-arm-r"><path class="r-arm" fill="none" stroke="${CAT}" stroke-width="15" stroke-linecap="round"/>
    <path class="r-smear" fill="none" stroke="${CAT}" stroke-opacity=".35" stroke-width="22" stroke-linecap="round"/>
    <g class="r-paw"><circle r="10" fill="${CAT}" stroke="${EDGE}" stroke-width="1.5"/>
      <g class="r-beans" fill="${PINK}"><ellipse cx="0" cy="2.5" rx="4" ry="3"/><circle cx="-5" cy="-3" r="1.9"/><circle cx="0" cy="-5.2" r="1.9"/><circle cx="5" cy="-3" r="1.9"/></g></g></g>
  <path d="M70 109 Q100 127 130 109" stroke="#a8d98f" stroke-width="6" fill="none" stroke-linecap="round"/>
  <g class="r-bell"><circle cx="100" cy="124" r="6.5" fill="#f2c94c"/><path d="M95 124 H105" stroke="#b8902a" stroke-width="1.4"/><circle cx="100" cy="127.5" r="1.3" fill="#8a6a1c"/></g>
  <g class="r-head">
    <g class="r-ear-l"><path d="M61 64 L56 16 L94 44 Z" fill="${CAT}"/><path d="M66 57 L63 29 L87 46 Z" fill="${PINK}"/></g>
    <g class="r-ear-r"><path d="M139 64 L144 16 L106 44 Z" fill="${CAT}"/><path d="M134 57 L137 29 L113 46 Z" fill="${PINK}"/></g>
    <path class="r-fluff r-fluff-head" d="${FLUFF_HEAD}" fill="${CAT}" stroke="${EDGE}" stroke-width="1.2"/>
    <g class="r-tufts">${tufts(TUFTS.slice(0, 4))}</g>
    <path d="M57 79 C57 52 77 39 100 39 C123 39 143 52 143 79 C143 103 124 115 100 115 C76 115 57 103 57 79 Z" fill="${CAT}"/>
    <g class="r-knots" stroke="#5c5c6a" stroke-width="2.2" fill="none" stroke-linecap="round">${knots([[74, 48], [118, 50], [60, 94], [134, 96]])}</g>
    <path class="r-quiff" d="M74 50 Q76 12 116 12 Q140 12 146 26 Q134 20 122 24 Q136 30 134 44 Q116 34 98 40 Q84 44 80 54 Z" fill="${CAT}" stroke="${EDGE}" stroke-width="1.2"/>
    <g class="r-gloss" stroke="#fff" stroke-linecap="round" fill="none"><path d="M68 62 Q80 46 100 45" stroke-width="4" opacity=".5"/><path d="M84 28 Q98 16 124 17" stroke-width="3.5" opacity=".6"/></g>
    <g class="r-eyes-open">
      <g class="r-eye" data-x="82"><ellipse class="r-white" cx="82" cy="75" rx="11.5" ry="12.5" fill="${EYE}"/>
        <ellipse class="r-pupil" cx="80" cy="76" rx="2.6" ry="9" fill="#0b0b0d"/><circle class="r-shine" cx="83.5" cy="71" r="2.2" fill="#fff" opacity=".85"/></g>
      <g class="r-eye" data-x="118"><ellipse class="r-white" cx="118" cy="75" rx="11.5" ry="12.5" fill="${EYE}"/>
        <ellipse class="r-pupil" cx="116" cy="76" rx="2.6" ry="9" fill="#0b0b0d"/><circle class="r-shine" cx="119.5" cy="71" r="2.2" fill="#fff" opacity=".85"/></g>
    </g>
    <g class="r-eyes-happy" stroke="${EYE}" stroke-width="4.5" fill="none" stroke-linecap="round">
      <path d="M71 78 Q82 66 93 78"/><path d="M107 78 Q118 66 129 78"/></g>
    <g class="r-eyes-dizzy" stroke="${EYE}" stroke-width="2.6" fill="none" stroke-linecap="round">
      <path d="M82 75 m-1 0 a1 1 0 1 1 2 0 a3 3 0 1 1 -6 0 a5 5 0 1 1 10 0 a7 7 0 1 1 -14 0"/>
      <path d="M118 75 m-1 0 a1 1 0 1 1 2 0 a3 3 0 1 1 -6 0 a5 5 0 1 1 10 0 a7 7 0 1 1 -14 0"/></g>
    <g class="r-eyes-sleep" stroke="${EYE}" stroke-width="4" fill="none" stroke-linecap="round">
      <path d="M71 76 Q82 84 93 76"/><path d="M107 76 Q118 84 129 76"/></g>
    <g class="r-eyes-star" fill="#f2c94c">
      <path d="M82 63 L85 72 L94 72 L87 78 L90 87 L82 81 L74 87 L77 78 L70 72 L79 72 Z"/>
      <path d="M118 63 L121 72 L130 72 L123 78 L126 87 L118 81 L110 87 L113 78 L106 72 L115 72 Z"/></g>
    <g class="r-shades"><path d="M66 68 H96 Q96 86 82 86 Q68 86 66 68 Z M104 68 H134 Q132 86 118 86 Q104 86 104 68 Z" fill="#111"/>
      <path d="M62 68 H138" stroke="#111" stroke-width="4"/><path d="M71 72 L77 72 M109 72 L115 72" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/></g>
    <g class="r-blush" fill="#e58a9a" opacity=".55"><ellipse cx="68" cy="92" rx="7" ry="4"/><ellipse cx="132" cy="92" rx="7" ry="4"/></g>
    <path d="M95.5 91 L104.5 91 L100 96.5 Z" fill="#4a3438"/>
    <path class="r-mouth m-w" d="M100 96.5 Q96 102 91 100 M100 96.5 Q104 102 109 100" stroke="#6a6a72" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path class="r-mouth m-open" d="M91 99 Q100 114 109 99 Z" fill="${PINK}" stroke="#4a3438" stroke-width="1.2"/>
    <ellipse class="r-mouth m-o" cx="100" cy="104" rx="4.5" ry="6" fill="#4a3438"/>
    <path class="r-mouth m-grin" d="M86 98 Q100 110 114 96" stroke="#6a6a72" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <g class="r-mouth m-chew"><ellipse cx="66" cy="96" rx="12" ry="10" fill="${CAT}" stroke="${EDGE}" stroke-width="1.2"/><ellipse cx="134" cy="96" rx="12" ry="10" fill="${CAT}" stroke="${EDGE}" stroke-width="1.2"/>
      <path d="M93 101 Q100 105 107 101" stroke="#6a6a72" stroke-width="2" fill="none" stroke-linecap="round"/></g>
    <path class="r-mouth m-wavy" d="M89 103 Q92 99 95 103 T101 103 T107 103 T113 103" stroke="#6a6a72" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <g class="r-whiskers" stroke="#fff" stroke-opacity=".55" stroke-width="1.3" stroke-linecap="round"><path d="M84 95 L52 89"/><path d="M84 99 L51 101"/><path d="M116 95 L148 89"/><path d="M116 99 L149 101"/></g>
    <g class="r-snot"><circle cx="111" cy="97" r="8" fill="#d8f0fb" fill-opacity=".55" stroke="#8fc8e6" stroke-width="1.3"/><circle cx="108" cy="94" r="2.2" fill="#fff" opacity=".8"/></g>
    <path class="r-sweat" d="M146 50 Q152 60 146 64 Q140 60 146 50 Z" fill="#9fd3f0" stroke="#5b9ec4" stroke-width="1"/>
  </g>
  <g class="r-sparkles" fill="#fff">${SPARK(50, 40, 1.5)}${SPARK(154, 116, 1.2)}${SPARK(60, 168, 1)}${SPARK(150, 54, 0.9)}</g>
</g>`;

/* A damped spring toward a target. */
function spring(x, k = 260, d = 20) {
  return { x, v: 0, t: x, k, d };
}

// Reduced motion: no grooving on the beat (poses and reactions still show).
const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const MOODS = {
  idle: { eyes: 'open', mouth: 'w', dil: 1, crouch: 0, tail: 0.25, tailSpeed: 2.2, ears: 0 },
  hunt: { eyes: 'open', mouth: 'w', dil: 2.4, crouch: 1, tail: 0.55, tailSpeed: 5, ears: -6 },
  happy: { eyes: 'happy', mouth: 'open', dil: 1, crouch: 0, tail: 0.6, tailSpeed: 6, ears: 4, arms: 'up', blush: true },
  smug: { eyes: 'happy', mouth: 'grin', dil: 1, crouch: 0, tail: 0.3, tailSpeed: 2, ears: 2 },
  star: { eyes: 'star', mouth: 'open', dil: 1, crouch: 0, tail: 0.7, tailSpeed: 7, ears: 6, arms: 'up', blush: true },
  shock: { eyes: 'open', mouth: 'o', dil: 0.35, crouch: -0.6, tail: 0.1, tailSpeed: 12, ears: 14, big: true, sweat: true },
  dizzy: { eyes: 'dizzy', mouth: 'wavy', dil: 1, crouch: 0.3, tail: 0.15, tailSpeed: 1.5, ears: -12, sweat: true },
  // Supper Time: fast asleep (with a snot bubble the scene can show), chomping, and robbed.
  sleep: { eyes: 'sleep', mouth: 'w', dil: 1, crouch: 0.9, tail: 0.08, tailSpeed: 0.8, ears: -5 },
  eat: { eyes: 'happy', mouth: 'chew', dil: 1, crouch: 0.2, tail: 0.6, tailSpeed: 6, ears: 5, blush: true },
  sad: { eyes: 'open', mouth: 'wavy', dil: 2.8, crouch: 0.5, tail: 0.04, tailSpeed: 0.8, ears: -16, sweat: true },
};

export function rigMookie() {
  const el = document.createElement('div');
  el.className = 'rig';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 222');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = MARKUP; // fixed markup
  el.append(svg);
  const q = (s) => svg.querySelector(s);
  const parts = {
    root: q('.r-root'), head: q('.r-head'), earL: q('.r-ear-l'), earR: q('.r-ear-r'), tail: q('.r-tail'), bell: q('.r-bell'),
    eyes: [...svg.querySelectorAll('.r-eye')], whiskers: q('.r-whiskers'),
    armL: { g: q('.r-arm-l'), path: q('.r-arm-l .r-arm'), paw: q('.r-arm-l .r-paw'), sx: 77, sy: 130 },
    armR: { g: q('.r-arm-r'), path: q('.r-arm-r .r-arm'), paw: q('.r-arm-r .r-paw'), smear: q('.r-smear'), sx: 123, sy: 130 },
  };

  const S = {
    lean: spring(0), bob: spring(0, 320, 18), squash: spring(1, 380, 16), tilt: spring(0, 200, 16), hb: spring(0, 300, 18),
    lx: spring(0, 120, 16), ly: spring(0, 120, 16), dil: spring(1, 160, 18), blink: spring(0, 900, 40),
    earL: spring(0, 400, 14), earR: spring(0, 400, 14), bell: spring(0, 180, 6), eyeScale: spring(1, 300, 18),
    // Arms: angle (degrees, 0 = hanging down, negative swings to Mookie's left side of the screen = viewer's right)
    aL: spring(14, 500, 28), aR: spring(-14, 500, 28),
    // Reach: 0 = arm at its angle, 1 = rubber-hose all the way to the reach point.
    reachR: spring(0, 1100, 46),
  };
  let mood = MOODS.idle;
  let moodName = 'idle';
  let reachAt = null; // { x, y } in svg units
  let tailPhase = 0;
  let last = performance.now();
  let nextBlink = last + 1500;
  let raf = 0;
  let beatTilt = 1;

  function setMood(name) {
    mood = MOODS[name] || MOODS.idle;
    moodName = name;
    svg.dataset.eyes = mood.eyes;
    svg.dataset.mouth = mood.mouth;
    svg.classList.toggle('blush', !!mood.blush);
    svg.classList.toggle('sweat', !!mood.sweat);
    S.dil.t = mood.dil;
    S.earL.t = mood.ears;
    S.earR.t = -mood.ears;
    S.eyeScale.t = mood.big ? 1.25 : 1;
    S.squash.t = 1 - 0.07 * Math.max(0, mood.crouch);
    S.bob.t = 7 * mood.crouch;
    if (mood.arms === 'up') { S.aL.t = 150; S.aR.t = -150; } else { S.aL.t = 14; S.aR.t = -14; }
    if (name === 'happy' || name === 'star') { S.bob.v -= 160; S.squash.v += 1.6; }
    if (name === 'shock') { S.bob.v -= 220; S.hb.v -= 120; }
  }
  setMood('idle');

  const P = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;

  function drawArm(a, angle, reach) {
    const L = 54;
    const rad = (angle * Math.PI) / 180;
    // Angle 0 hangs straight down; positive swings toward the viewer's left.
    let tx = a.sx - Math.sin(rad) * L;
    let ty = a.sy + Math.cos(rad) * L;
    if (reach > 0.001 && reachAt) {
      tx += (reachAt.x - tx) * reach;
      ty += (reachAt.y - ty) * reach;
    }
    // Rubber hose: a soft bend that sags more the longer the arm.
    const mx = (a.sx + tx) / 2;
    const my = (a.sy + ty) / 2;
    const len = Math.hypot(tx - a.sx, ty - a.sy) || 1;
    const nx = -(ty - a.sy) / len;
    const ny = (tx - a.sx) / len;
    const bend = Math.min(26, len * 0.12) * (tx > a.sx ? 1 : -1);
    a.path.setAttribute('d', `M${P(a.sx, a.sy)} Q${P(mx + nx * bend, my + ny * bend)} ${P(tx, ty)}`);
    const pawRot = Math.atan2(ty - a.sy, tx - a.sx) * 180 / Math.PI - 90;
    const big = 1 + reach * 0.9;
    a.paw.setAttribute('transform', `translate(${P(tx, ty)}) rotate(${(pawRot + 180).toFixed(1)}) scale(${big.toFixed(2)})`);
    if (a.smear) {
      const show = reach > 0.15 && reach < 0.95;
      a.smear.setAttribute('d', show ? `M${P(a.sx, a.sy)} Q${P(mx + nx * bend * 2, my + ny * bend * 2)} ${P(tx, ty)}` : '');
    }
    a.tip = { x: tx, y: ty };
  }

  function drawTail(t) {
    const n = 7;
    let x = 136;
    let y = 186;
    let ang = 0.15; // pointing right, a little down
    const pts = [[x, y]];
    const amp = mood.tail;
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      ang += -0.32 + Math.sin(t - i * 0.55) * amp * f * 0.9;
      x += Math.cos(ang) * 11;
      y += Math.sin(ang) * 11;
      pts.push([x, y]);
    }
    let d = `M${P(...pts[0])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const [p1, p2] = [pts[i], pts[i + 1]];
      const p3 = pts[i + 2] || p2;
      d += ` C${P(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)} ${P(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)} ${P(...p2)}`;
    }
    parts.tail.setAttribute('d', d);
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
      nextBlink = now + 1800 + Math.random() * 3200;
    }
    tailPhase += dt * mood.tailSpeed;

    const sq = S.squash.x;
    const sx = 1 + (1 - sq) * 0.8;
    parts.root.setAttribute('transform', `translate(${S.lean.x.toFixed(2)} ${S.bob.x.toFixed(2)}) translate(100 206) scale(${sx.toFixed(3)} ${sq.toFixed(3)}) translate(-100 -206)`);
    parts.head.setAttribute('transform', `translate(0 ${S.hb.x.toFixed(2)}) rotate(${S.tilt.x.toFixed(2)} 100 112)`);
    parts.earL.setAttribute('transform', `rotate(${(-S.earL.x).toFixed(2)} 76 52)`);
    parts.earR.setAttribute('transform', `rotate(${(-S.earR.x).toFixed(2)} 124 52)`);
    parts.bell.setAttribute('transform', `rotate(${S.bell.x.toFixed(2)} 100 118)`);
    const lid = 1 - 0.92 * Math.min(1, Math.max(0, S.blink.x));
    const es = S.eyeScale.x;
    for (const e of parts.eyes) {
      const cx = Number(e.dataset.x);
      e.setAttribute('transform', `translate(${cx} 75) scale(${es.toFixed(3)} ${(es * lid).toFixed(3)}) translate(${-cx} -75)`);
      const pupil = e.querySelector('.r-pupil');
      const dil = S.dil.x;
      pupil.setAttribute('rx', (2.6 * dil + (dil > 1.5 ? 2 : 0)).toFixed(2));
      pupil.setAttribute('ry', (9 * Math.min(1, 0.45 + dil * 0.4)).toFixed(2));
      pupil.setAttribute('cx', (cx - 2 + S.lx.x * 4.5).toFixed(2));
      pupil.setAttribute('cy', (76 + S.ly.x * 3.5).toFixed(2));
    }
    drawArm(parts.armL, S.aL.x, 0);
    drawArm(parts.armR, S.aR.x, Math.max(0, S.reachR.x));
    drawTail(tailPhase);
    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  function blink() {
    S.blink.t = 1;
    setTimeout(() => { S.blink.t = 0; }, 90);
  }

  /* A point on the page (client px) in the rig's own units. */
  function toRig(x, y) {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(x, y).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  const api = {
    el,
    start,
    mood(name) { setMood(name); start(); },
    get moodName() { return moodName; },
    svg,
    look(x, y = 0) { S.lx.t = Math.max(-1, Math.min(1, x)); S.ly.t = Math.max(-1, Math.min(1, y)); },
    blink,
    /* Rubber-hose reach with the right paw to a page point; back after hold seconds. */
    reach(x, y, hold = 0.12) {
      const p = toRig(x, y);
      if (!p) return;
      reachAt = p;
      S.reachR.t = 1;
      S.reachR.v = 18;
      S.lean.v += 160;
      S.squash.v -= 2;
      S.bell.v += 400;
      clearTimeout(api._back);
      api._back = setTimeout(() => { S.reachR.t = 0; }, hold * 1000);
    },
    /* Where the reaching paw is, in page px. */
    pawAt() {
      const tip = parts.armR.tip;
      const m = svg.getScreenCTM();
      if (!tip || !m) return null;
      const p = new DOMPoint(tip.x, tip.y).matrixTransform(m);
      return { x: p.x, y: p.y };
    },
    /* Every beat: head bobs and ticks side to side; ears flick and the body breathes on 1.
       In the hunt it's a butt wiggle. With the band in, it grooves harder. */
    beat(down, spb, tier = 0) {
      svg.classList.toggle('shades', tier >= 4);
      if (still) return;
      if (moodName === 'sleep') {
        // Asleep: no grooving, just a big breath on 1 and a small one on 2.
        S.squash.v -= down ? 1.1 : 0.45;
        S.hb.v += down ? 40 : 18;
        S.tilt.t = 0;
        return;
      }
      const g = 1 + tier * 0.35;
      S.hb.v += 90 * g;
      beatTilt = -beatTilt;
      S.tilt.t = beatTilt * (3 + tier * 1.5);
      if (moodName === 'hunt') S.lean.t = beatTilt * 3;
      else S.lean.t = 0;
      S.bell.v += 120 * g;
      if (down) {
        S.squash.v -= 0.9 * g;
        S.earL.v += 260;
        S.earR.v -= 260;
      }
    },
    /* Brushing Time: how fluffy the coat is (1 is his usual fluff), and a tuft sticking out. */
    fluff(n) { svg.style.setProperty('--fluff', n.toFixed(2)); },
    tuft(i, on = true) {
      const all = svg.querySelectorAll('.r-tuft');
      const t = all[((i % all.length) + all.length) % all.length];
      t.classList.toggle('up', on);
      return t;
    },
    /* A quick hop (on a win, say). */
    hop(power = 1) { S.bob.v -= 260 * power; S.squash.v += 2 * power; S.bell.v += 500; },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
  start();
  return api;
}
