/* Harp: a row of strings, one for each note of a scale, lowest on the left. Pluck one, or
   sweep across them for a glissando. The red strings are the Cs and the dark ones the Fs, as
   on a real harp. Seven pedals at the bottom, one for each letter (D C B with the left foot,
   E F G A with the right), each set flat, natural or sharp: up, middle, down. A pedal changes
   that letter on every string at once, and a string that is ringing bends to its new note.
   On a computer, the letter keys A to K pluck C to C, Z and X move down and up an octave.

   It is drawn as a concert pedal harp: a gilded column with its crown, the neck sweeping over
   the strings with a pair of brass discs on each string (they turn to grip it, sharpening it,
   as its pedal moves), the soundbox slanting up to the shoulder, gut strings with wound ones
   in the bass, and the pedals in their notched slots in the base. */

import { surface, label, fine, rr } from '../surface.js';
import { pitched } from '../audio.js';
import { wood, metal, string, pool, layer, put, pin } from '../paint.js';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const PEDALS = ['D', 'C', 'B', 'E', 'F', 'G', 'A'];   // left foot, then right foot
const KEYS = 'asdfghjk';

/* A smooth curve through points [x, y], x rising: each piece a cubic, sloped at each point as
   its neighbours are. */
function spline(pts) {
  const m = pts.map((_, k) => {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(pts.length - 1, k + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  });
  return (x) => {
    let k = 0;
    while (k < pts.length - 2 && x > pts[k + 1][0]) k++;
    const [x0, y0] = pts[k];
    const [x1, y1] = pts[k + 1];
    const h = x1 - x0;
    const t = (x - x0) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[k + 1];
  };
}

export async function mount(stage, ex, kit) {
  const o = ex.opts;
  const lowest = o.low;                 // the lowest string, a C
  const count = o.strings;
  const strings = Array.from({ length: count }, (_, i) => ({
    letter: i % 7,
    base: lowest + 12 * Math.floor(i / 7) + NATURAL[i % 7],
    voice: null, at: 0, amp: 0,
  }));
  const inst = await pitched(o.sound, lowest - 1, strings[count - 1].base + 1);
  const pedal = [0, 0, 0, 0, 0, 0, 0];  // by letter: -1 flat, 0 natural, 1 sharp
  const noteOf = (i) => strings[i].base + pedal[strings[i].letter];
  let octave = Math.max(0, Math.floor(count / 7 / 2));   // for the computer keys

  const box = document.createElement('div');
  box.className = 'zone harp';
  stage.append(box);

  let G = null;
  // The neck's harmonic curve, as a fraction of the harp's height at each point along the row
  // of strings (0 at the lowest, 1 at the highest): high at the column, dipping over the long
  // strings, rising in a hump over the middle ones, falling to the knee on the soundbox.
  const neckCurve = spline([[-0.25, 0.12], [0, 0.135], [0.3, 0.205], [0.7, 0.14], [1, 0.235], [1.25, 0.36]]);
  function geom(s) {
    const left = Math.max(44, s.W * 0.075);           // room for the column
    const right = s.W - Math.max(34, s.W * 0.06);
    const gap = (right - left) / (count - 1);
    const strip = Math.min(110, s.H * 0.24);
    const T = s.H - strip;                             // the harp stands on its base, above the pedals
    // The soundboard slants: long strings low on the left, short ones high on the right.
    const neckY = (t) => T * neckCurve(t);
    const boardY = (t) => T * (0.95 - 0.58 * t);
    const neck = (i) => neckY(i / (count - 1));
    const board = (i) => boardY(i / (count - 1));
    G = { left, right, gap, strip, neck, board, neckY, boardY, T, W: s.W, H: s.H, nt: Math.max(16, T * 0.06) };
    return G;
  }
  const su = (i) => G.left + i * G.gap;

  function pluck(i, vol = 0.7) {
    const st = strings[i];
    st.voice?.stop(0.06);
    const m = noteOf(i);
    st.voice = inst.play(m, { vol });
    st.at = performance.now();
    st.amp = 1;
    kit.note(m, 'fresh');
    s.animate(2400);
  }

  function stringAt(u) {
    const i = Math.round((u - G.left) / G.gap);
    return i >= 0 && i < count ? i : null;
  }

  function pedalBox(k, s) {
    // three on the left, a gap, four on the right
    const w = Math.min(70, (s.W - 80) / 9);
    const mid = s.W / 2;
    const x = k < 3 ? mid - 40 - (3 - k) * (w + 10) : mid + 40 + (k - 3) * (w + 10);
    return { x, y: s.H - G.strip + 8, w, h: G.strip - 16 };
  }

  function setPedal(letter, to) {
    if (pedal[letter] === to) return;
    pedal[letter] = to;
    // Ringing strings of that letter slide to their new note, as the pedal turns their discs.
    strings.forEach((st, i) => {
      if (st.letter === letter && st.voice && performance.now() - st.at < 3000) st.voice.bend(noteOf(i), 0.04);
    });
    s.redraw();
  }

  const s = surface(box, {
    label: ex.name,
    draw,
    down(p) {
      if (p.v > s.H - G.strip) {
        for (let k = 0; k < 7; k++) {
          const b = pedalBox(k, s);
          if (p.u >= b.x - 6 && p.u <= b.x + b.w + 6) {
            const third = Math.floor(((p.v - b.y) / b.h) * 3);
            setPedal(LETTERS.indexOf(PEDALS[k]), Math.max(-1, Math.min(1, third - 1)));
            return;
          }
        }
        return;
      }
      p.data.harp = true;
      const i = stringAt(p.u);
      if (i != null && Math.abs(p.u - su(i)) < G.gap * 0.45) { pluck(i); p.data.hit = i; }
    },
    move(p) {
      if (!p.data.harp) return;
      // A sweep across the strings plucks each one it crosses: a glissando.
      const speed = Math.abs(p.u - p.pu) / Math.max(1, p.t - p.pt);
      for (let i = 0; i < count; i++) {
        const x = su(i);
        if ((p.pu - x) * (p.u - x) < 0 && p.data.hit !== i) pluck(i, Math.min(0.8, 0.35 + speed * 0.3));
      }
      if (p.data.hit != null && Math.abs(p.u - su(p.data.hit)) > G.gap * 0.45) p.data.hit = null;
    },
  });
  s.onresize = geom;
  geom(s);

  const colorOf = (i) => (strings[i].letter === 0 ? '#C8362E' : strings[i].letter === 3 ? '#262A4E' : i < 5 ? '#B98E5A' : i > count - 8 ? '#F2EEE4' : '#E8D3A8');
  const widthOf = (i) => (1 + ((count - i) / count) * 2.4) * Math.max(1, Math.min(1.5, G.T / 520)) * (i < 5 ? 1.25 : 1);

  function draw(g, s) {
    geom(s);
    const now = performance.now();
    put(g, s, layer(s, 'harp', '', (c) => paintHarp(c, s)));
    // strings, and their discs: the upper one grips the string for natural, both for sharp
    for (let i = 0; i < count; i++) {
      const st = strings[i];
      const x = su(i);
      const y0 = G.neck(i) + G.T * 0.02;
      const y1 = G.board(i);
      const age = (now - st.at) / 1000;
      const amp = st.voice ? st.amp * Math.exp(-age * 1.6) : 0;
      string(g, x, y0, x, y1, {
        width: widthOf(i),
        color: colorOf(i),
        wound: i < 5,
        amp: amp > 0.01 ? amp * Math.min(G.gap * 0.42, 7) : 0,
        glow: amp > 0.05 ? amp : 0,
        t: now,
        freq: 1 + (i % 7) * 0.12,
        from: 0.1,
        to: 1,
      });
      const p = pedal[st.letter];
      const dr = Math.max(2.4, Math.min(G.gap * 0.32, 6));
      for (const [k, on] of [[0, p >= 0], [1, p > 0]]) {
        const dy = y0 + G.T * (0.035 + k * 0.035);
        g.save();
        g.translate(x, dy);
        g.beginPath();
        g.arc(0, 0, dr, 0, Math.PI * 2);
        g.fillStyle = metal(g, 'brass', -dr, -dr, dr, dr);
        g.fill();
        g.strokeStyle = 'rgba(60,40,0,.5)';
        g.lineWidth = 0.8;
        g.stroke();
        // its two pins: across the string when they grip it, along it when they don't
        g.rotate(on ? 0 : Math.PI / 2.6);
        g.fillStyle = on ? '#FFF2C4' : '#8A6A2A';
        for (const side of [-1, 1]) {
          g.beginPath();
          g.arc(side * dr * 0.72, 0, Math.max(1, dr * 0.28), 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
    }
    // letters under the strings, on a computer
    if (fine()) {
      for (let k = 0; k < KEYS.length; k++) {
        const i = octave * 7 + k;
        if (i < count) label(g, s, KEYS[k].toUpperCase(), su(i), G.board(i) + 26, { size: 11, color: 'rgba(246,241,228,.55)' });
      }
    }
    // pedals: brass levers in notched slots, flat up, natural in the middle, sharp down
    for (let k = 0; k < 7; k++) {
      const b = pedalBox(k, s);
      const letter = LETTERS.indexOf(PEDALS[k]);
      const v = pedal[letter];
      const y = b.y + (v + 1.5) * (b.h / 3);
      const pw = b.w * 0.8;
      const ph = Math.min(22, b.h / 4.2);
      g.save();
      g.shadowColor = 'rgba(0,0,0,.55)';
      g.shadowBlur = 6;
      g.shadowOffsetY = 3;
      g.fillStyle = metal(g, 'brass', b.x, y - ph, b.x + b.w, y + ph);
      rr(g, b.x + (b.w - pw) / 2, y - ph / 2, pw, ph, ph / 2);
      g.fill();
      g.restore();
      g.strokeStyle = v === 0 ? 'rgba(80,50,0,.5)' : '#FFE9A8';
      g.lineWidth = v === 0 ? 1 : 2;
      rr(g, b.x + (b.w - pw) / 2, y - ph / 2, pw, ph, ph / 2);
      g.stroke();
      label(g, s, PEDALS[k] + (v < 0 ? '♭' : v > 0 ? '♯' : ''), b.x + b.w / 2, y + 0.5, { size: 13, color: '#2A1C08' });
    }
  }

  /* What doesn't move: the soundbox and its soundboard, the neck, the knee, the gilded column
     with its crown and foot, the base and the pedal slots. */
  function paintHarp(c, s) {
    const { T, W, H, left, right, gap, neckY, boardY, nt } = G;
    c.fillStyle = '#15201A';
    c.fillRect(0, 0, W, H);
    pool(c, W * 0.45, T * 0.45, W * 0.7, '#2E4236', 0.6, 0.9);
    const n = count - 1;
    const tAt = (x) => (x - left) / (right - left);
    const xAt = (t) => left + (right - left) * t;
    const colW = Math.max(16, Math.min(34, W * 0.026));
    const colX = left - colW * 0.5 - Math.max(10, gap * 0.8);
    const shadow = (blur, x, y, a = 0.55) => {
      c.shadowColor = `rgba(0,0,0,${a})`;
      c.shadowBlur = blur;
      c.shadowOffsetX = x;
      c.shadowOffsetY = y;
    };
    const gilt = (width = 2) => {
      c.lineWidth = width + 1;
      c.strokeStyle = '#8A621C';
      c.stroke();
      c.lineWidth = width * 0.5;
      c.strokeStyle = '#F6DC94';
      c.stroke();
    };

    /* The soundbox slants from the base up to the knee: deep at the bottom, slim at the top.
       Its soundboard shows a little from the front, spruce with gold leaf on it, the strings
       going into the strip down its middle. */
    const bx0 = colX + colW * 0.7;
    const bx1 = right + gap * 0.55;
    const A = [bx0, boardY(tAt(bx0))];
    const B = [bx1, boardY(tAt(bx1))];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const ux = (B[0] - A[0]) / L;
    const uy = (B[1] - A[1]) / L;
    const at = (a, d) => [A[0] + ux * L * a - uy * d, A[1] + uy * L * a + ux * d];
    const faceW = (a) => T * (0.05 - 0.024 * a);
    const deep = (a) => T * (0.075 + 0.22 * (1 - a) ** 1.6);
    const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
    const edge = (f, a0 = 0, a1 = 1, join = false) => {
      for (let k = 0; k <= 60; k++) {
        const a = a0 + ((a1 - a0) * k) / 60;
        const [x, y] = at(a, f(a));
        if (k || join) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
    };
    const end = deep(1) * 0.55 / L;
    const boxPath = () => {
      c.beginPath();
      edge((a) => -faceW(a) / 2);
      const [p0x, p0y] = at(1 + end, -faceW(1) / 2);
      const [p1x, p1y] = at(1 + end * 1.15, deep(1) * 0.85);
      const [p2x, p2y] = at(1, deep(1));
      c.bezierCurveTo(p0x, p0y, p1x, p1y, p2x, p2y);
      edge(deep, 1, 0, true);
      c.closePath();
    };
    const facePath = (w = 0.5) => {
      c.beginPath();
      edge((a) => -faceW(a) * w);
      edge((a) => faceW(a) * w, 1, 0, true);
      c.closePath();
    };
    c.save();
    c.beginPath();
    c.rect(0, 0, W, T);
    c.clip();
    c.save();
    shadow(20, 6, 4);
    boxPath();
    c.fillStyle = wood(c, 'flame', { angle, scale: 1.1, seed: 2 });
    c.fill();
    c.restore();
    c.save();
    boxPath();
    c.clip();
    // round: light along the soundboard, darker toward the back
    const [g0x, g0y] = at(0.5, 0);
    const [g1x, g1y] = at(0.5, deep(0.5));
    const rg = c.createLinearGradient(g0x, g0y, g1x, g1y);
    rg.addColorStop(0, 'rgba(255,236,200,.3)');
    rg.addColorStop(0.3, 'rgba(255,236,200,0)');
    rg.addColorStop(0.7, 'rgba(20,6,0,.22)');
    rg.addColorStop(1, 'rgba(20,6,0,.55)');
    c.fillStyle = rg;
    c.fillRect(0, 0, W, T);
    // the staves of its back, and the varnish catching the light along them
    for (const f of [0.38, 0.66]) {
      c.beginPath();
      edge((a) => faceW(a) / 2 + (deep(a) - faceW(a) / 2) * f);
      c.strokeStyle = 'rgba(40,14,2,.4)';
      c.lineWidth = 1.2;
      c.stroke();
      c.beginPath();
      edge((a) => faceW(a) / 2 + (deep(a) - faceW(a) / 2) * f + 1.6);
      c.strokeStyle = 'rgba(255,220,170,.16)';
      c.lineWidth = 1;
      c.stroke();
    }
    c.beginPath();
    edge((a) => faceW(a) / 2 + (deep(a) - faceW(a) / 2) * 0.16);
    c.strokeStyle = 'rgba(255,240,210,.22)';
    c.lineWidth = Math.max(2, T * 0.008);
    c.stroke();
    c.restore();
    // the soundboard
    facePath();
    c.fillStyle = wood(c, 'spruce', { angle: angle + 90, scale: 0.7, seed: 5 });
    c.fill();
    c.save();
    facePath();
    c.clip();
    const fg = c.createLinearGradient(...at(0.5, -faceW(0.5) / 2), ...at(0.5, faceW(0.5) / 2));
    fg.addColorStop(0, 'rgba(0,0,0,.16)');
    fg.addColorStop(0.45, 'rgba(255,250,230,.12)');
    fg.addColorStop(1, 'rgba(0,0,0,.24)');
    c.fillStyle = fg;
    c.fillRect(0, 0, W, T);
    // gold leaf: a vine winding up each side of the middle strip, with its leaves
    const vine = (side) => (a) => side * faceW(a) * (0.3 + 0.07 * Math.sin(a * 56 + side));
    c.lineWidth = Math.max(1, T * 0.0024);
    for (const side of [-1, 1]) {
      c.beginPath();
      edge(vine(side), 0.02, 0.97);
      c.strokeStyle = 'rgba(214,168,64,.95)';
      c.stroke();
      for (let k = 0; k < 36; k++) {
        const a = 0.03 + (k / 36) * 0.93;
        const [x, y] = at(a, vine(side)(a));
        const r = faceW(a) * 0.13;
        c.save();
        c.translate(x, y);
        c.rotate((angle * Math.PI) / 180 + (k % 2 ? 0.8 : -0.8) * side);
        c.beginPath();
        c.ellipse(r * 1.2, 0, r * 1.3, r * 0.55, 0, 0, Math.PI * 2);
        c.fillStyle = k % 3 ? 'rgba(226,186,90,.92)' : 'rgba(246,214,130,.95)';
        c.fill();
        c.restore();
      }
    }
    c.restore();
    // the middle strip the strings go into, and the soundboard's gilded edges
    facePath(0.085);
    c.fillStyle = wood(c, 'maple', { angle, seed: 7 });
    c.fill();
    c.strokeStyle = 'rgba(60,30,6,.5)';
    c.lineWidth = 0.8;
    c.stroke();
    for (const f of [-0.5, 0.5]) {
      c.beginPath();
      edge((a) => f * faceW(a));
      gilt(2);
    }
    c.restore();
    for (let i = 0; i <= n; i++) {
      const r = Math.max(1.6, Math.min(3, gap * 0.14));
      c.beginPath();
      c.arc(su(i), G.board(i), r + 1, 0, Math.PI * 2);
      c.fillStyle = 'rgba(40,20,0,.45)';
      c.fill();
      pin(c, su(i), G.board(i), r, 'brass');
    }

    /* The neck sweeps from the crown over the strings to the knee, its tuning pins in a row,
       and ends in a gilded scroll over the top of the soundbox. */
    const ts = tAt(colX);
    const te = tAt(right + gap * 0.62);
    const top = (t) => neckY(t) - nt * 0.42;
    const bot = (t) => neckY(t) + nt * 0.62;
    const run = (f, t0, t1, join = false) => {
      for (let k = 0; k <= 80; k++) {
        const t = t0 + ((t1 - t0) * k) / 80;
        if (k || join) c.lineTo(xAt(t), f(t));
        else c.moveTo(xAt(t), f(t));
      }
    };
    const ex = xAt(te);
    const ey = neckY(te) + nt * 0.1;
    const er = nt * 0.52;
    const neckPath = () => {
      c.beginPath();
      run(top, ts, te);
      c.arc(ex, ey, er, -Math.PI / 2, Math.PI / 2);
      run(bot, te, ts, true);
      c.closePath();
    };
    // the knee: under the scroll, down onto the soundbox
    const kw = Math.max(nt * 0.9, gap * 0.8);
    const kTop = bot(tAt(ex - kw * 0.7));
    const kBot = B[1] - faceW(1) * 0.5;
    const kneePath = () => {
      c.beginPath();
      c.moveTo(ex - kw * 0.7, kTop - 2);
      c.quadraticCurveTo(ex - kw * 0.2, (kTop + kBot) / 2, ex - kw * 0.55, kBot + 2);
      c.lineTo(ex + kw * 0.75, kBot + 4);
      c.quadraticCurveTo(ex + er * 0.95, (kTop + kBot) / 2, ex + er * 0.55, ey + er * 0.8);
      c.closePath();
    };
    c.save();
    shadow(14, 3, 6);
    kneePath();
    c.fillStyle = wood(c, 'maple', { angle: 80, scale: 0.8, seed: 9 });
    c.fill();
    neckPath();
    c.fillStyle = wood(c, 'maple', { angle: -6, scale: 0.9, seed: 4 });
    c.fill();
    c.restore();
    c.save();
    kneePath();
    c.clip();
    const kg = c.createLinearGradient(ex - kw, 0, ex + kw, 0);
    kg.addColorStop(0, 'rgba(30,12,0,.4)');
    kg.addColorStop(0.45, 'rgba(255,240,210,.14)');
    kg.addColorStop(1, 'rgba(30,12,0,.45)');
    c.fillStyle = kg;
    c.fillRect(0, 0, W, T);
    c.restore();
    kneePath();
    gilt(1.4);
    // round: light along its top, shade along its underside
    c.save();
    neckPath();
    c.clip();
    for (let k = 0; k < 12; k++) {
      const f = k / 11;
      c.beginPath();
      run((t) => top(t) + (bot(t) - top(t)) * f, ts, te + er / (right - left));
      c.lineWidth = nt / 9;
      c.strokeStyle = f < 0.35 ? `rgba(255,244,214,${0.26 * (1 - f / 0.35)})` : `rgba(30,12,0,${0.42 * ((f - 0.35) / 0.65) ** 1.4})`;
      c.stroke();
    }
    c.restore();
    neckPath();
    gilt(1.6);
    // the tuning pins, with a bridge pin under each where the string leaves the neck
    for (let i = 0; i <= n; i++) {
      const x = su(i);
      const r = Math.max(1.8, Math.min(3.4, gap * 0.16));
      c.beginPath();
      c.arc(x + 0.6, G.neck(i) + nt * 0.33 + 1, r + 0.8, 0, Math.PI * 2);
      c.fillStyle = 'rgba(30,14,0,.45)';
      c.fill();
      pin(c, x, G.neck(i) + nt * 0.33, r, 'steel');
      pin(c, x + r * 0.9, bot(i / n) - nt * 0.16, r * 0.55, 'brass');
    }
    // the scroll: a gilded spiral on the rounded end of the neck
    const vr = er * 0.86;
    c.beginPath();
    for (let k = 0; k <= 120; k++) {
      const th = (k / 120) * Math.PI * 4.4;
      const r = vr * (1 - k / 138);
      const x = ex + Math.cos(th - 1.2) * r;
      const y = ey + Math.sin(th - 1.2) * r;
      if (k) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    gilt(Math.max(1.2, nt * 0.06));
    c.beginPath();
    c.arc(ex, ey, vr * 0.22, 0, Math.PI * 2);
    c.fillStyle = metal(c, 'gold', ex - vr * 0.22, ey - vr * 0.22, ex + vr * 0.22, ey + vr * 0.22);
    c.fill();
    // a gilded leaf hanging down the knee from the scroll
    const lx = ex - kw * 0.12;
    const ly0 = ey + er * 0.75;
    const ly1 = kBot - 3;
    if (ly1 > ly0 + 6) {
      c.beginPath();
      c.moveTo(lx, ly0);
      c.quadraticCurveTo(lx + kw * 0.34, (ly0 + ly1) / 2, lx - kw * 0.05, ly1);
      c.quadraticCurveTo(lx - kw * 0.3, (ly0 + ly1) / 2, lx, ly0);
      c.fillStyle = metal(c, 'gold', lx - kw * 0.25, 0, lx + kw * 0.3, 0);
      c.fill();
      c.beginPath();
      c.moveTo(lx, ly0 + 2);
      c.quadraticCurveTo(lx + kw * 0.05, (ly0 + ly1) / 2, lx - kw * 0.04, ly1 - 2);
      c.strokeStyle = 'rgba(110,70,10,.7)';
      c.lineWidth = 0.8;
      c.stroke();
    }

    /* The column: gilded and fluted, on its foot, under its crown. */
    const capH = Math.max(18, nt * 1.25);
    const shaftTop = top(ts) + nt * 0.1;
    const footH = Math.max(14, colW * 0.9);
    const shaftBot = T - footH;
    c.save();
    shadow(16, 5, 0, 0.6);
    c.fillStyle = metal(c, 'gold', colX - colW / 2, 0, colX + colW / 2, 0);
    c.fillRect(colX - colW / 2, shaftTop, colW, shaftBot - shaftTop);
    c.restore();
    for (let k = 1; k < 5; k++) {
      const x = colX - colW / 2 + (colW * k) / 5;
      c.fillStyle = 'rgba(90,58,8,.38)';
      c.fillRect(x - 0.9, shaftTop + capH * 0.5, 1.8, shaftBot - shaftTop - capH);
      c.fillStyle = 'rgba(255,246,210,.3)';
      c.fillRect(x + 0.9, shaftTop + capH * 0.5, 1, shaftBot - shaftTop - capH);
    }
    const ring = (y, w, h) => {
      c.fillStyle = metal(c, 'gold', colX - w / 2, 0, colX + w / 2, 0);
      rr(c, colX - w / 2, y - h / 2, w, h, h / 2);
      c.fill();
      c.strokeStyle = 'rgba(80,50,6,.5)';
      c.lineWidth = 0.8;
      c.stroke();
    };
    // the foot: rings, a swelling torus and a square plinth on the base
    c.save();
    shadow(10, 3, 2);
    c.fillStyle = metal(c, 'gold', colX - colW * 0.85, 0, colX + colW * 0.85, 0);
    c.fillRect(colX - colW * 0.85, T - footH * 0.42, colW * 1.7, footH * 0.42);
    c.restore();
    ring(T - footH * 0.56, colW * 1.45, footH * 0.36);
    ring(T - footH * 0.86, colW * 1.18, footH * 0.2);
    ring(shaftTop + capH * 0.3, colW * 1.15, Math.max(4, capH * 0.12));
    // the crown: a bell of gilded leaves, a slab, and a little dome on top
    const cb = shaftTop + capH * 0.18;
    const ct = cb - capH;
    const crown = (w0, w1) => {
      c.beginPath();
      c.moveTo(colX - w0 / 2, cb);
      c.bezierCurveTo(colX - w0 / 2, cb - capH * 0.5, colX - w1 / 2, cb - capH * 0.6, colX - w1 / 2, ct);
      c.lineTo(colX + w1 / 2, ct);
      c.bezierCurveTo(colX + w1 / 2, cb - capH * 0.6, colX + w0 / 2, cb - capH * 0.5, colX + w0 / 2, cb);
      c.closePath();
    };
    c.save();
    shadow(12, 4, 3);
    crown(colW, colW * 1.85);
    c.fillStyle = metal(c, 'gold', colX - colW, 0, colX + colW, 0);
    c.fill();
    c.restore();
    // its leaves, two rows of them, curling out at the tips
    for (const [row, k0, k1] of [[0, -2, 2], [1, -1.5, 1.5]]) {
      for (let k = k0; k <= k1; k += 1) {
        const x = colX + k * colW * (row ? 0.42 : 0.36);
        const yb = cb - row * capH * 0.32;
        const yt = yb - capH * (row ? 0.68 : 0.55);
        const w = colW * 0.36;
        c.beginPath();
        c.moveTo(x, yb);
        c.quadraticCurveTo(x - w, yb - (yb - yt) * 0.5, x + k * w * 0.18, yt);
        c.quadraticCurveTo(x + k * w * 0.18 + w * 0.5, yt + capH * 0.06, x + k * w * 0.3, yt + capH * 0.12);
        c.quadraticCurveTo(x + w, yb - (yb - yt) * 0.5, x, yb);
        c.fillStyle = metal(c, 'gold', x - w, yt, x + w, yb);
        c.fill();
        c.strokeStyle = 'rgba(100,64,8,.6)';
        c.lineWidth = 0.8;
        c.stroke();
        c.beginPath();
        c.moveTo(x, yb - 1);
        c.lineTo(x + k * w * 0.12, yt + capH * 0.1);
        c.stroke();
      }
    }
    // the slab, and the dome with its finial
    const slabH = Math.max(4, capH * 0.16);
    c.save();
    shadow(6, 2, 2, 0.4);
    c.fillStyle = metal(c, 'gold', colX - colW, 0, colX + colW, 0);
    rr(c, colX - colW * 1.02, ct - slabH, colW * 2.04, slabH, 2);
    c.fill();
    c.restore();
    c.strokeStyle = 'rgba(90,58,8,.55)';
    c.lineWidth = 0.8;
    c.stroke();
    const domeH = Math.min(capH * 0.45, ct - slabH - 2);
    if (domeH > 3) {
      c.beginPath();
      c.ellipse(colX, ct - slabH, colW * 0.62, domeH, 0, Math.PI, 0);
      c.fillStyle = metal(c, 'gold', colX - colW * 0.62, 0, colX + colW * 0.62, 0);
      c.fill();
      c.stroke();
      for (let k = -2; k <= 2; k++) {
        c.beginPath();
        c.moveTo(colX + k * colW * 0.22, ct - slabH);
        c.quadraticCurveTo(colX + k * colW * 0.16, ct - slabH - domeH * 0.8, colX + k * colW * 0.05, ct - slabH - domeH * 0.98);
        c.strokeStyle = 'rgba(100,64,8,.4)';
        c.stroke();
      }
      pin(c, colX, ct - slabH - domeH, Math.max(2, colW * 0.14), 'gold');
    }

    /* The base: a plinth along the bottom, the pedals in their notched slots. */
    c.save();
    shadow(14, 0, -2, 0.6);
    c.fillStyle = wood(c, 'maple', { scale: 0.9, seed: 12 });
    rr(c, 6, T - 6, W - 12, H - T - 2, 10);
    c.fill();
    c.restore();
    const bg = c.createLinearGradient(0, T - 6, 0, H);
    bg.addColorStop(0, 'rgba(255,235,190,.25)');
    bg.addColorStop(0.1, 'rgba(0,0,0,0)');
    bg.addColorStop(1, 'rgba(0,0,0,.4)');
    c.fillStyle = bg;
    rr(c, 6, T - 6, W - 12, H - T - 2, 10);
    c.fill();
    c.beginPath();
    c.moveTo(14, T - 2);
    c.lineTo(W - 14, T - 2);
    gilt(1.6);
    c.beginPath();
    c.moveTo(18, H - 12);
    c.lineTo(W - 18, H - 12);
    c.strokeStyle = 'rgba(40,20,4,.45)';
    c.lineWidth = 1.5;
    c.stroke();
    for (let k = 0; k < 7; k++) {
      const b = pedalBox(k, s);
      c.fillStyle = '#1A110A';
      rr(c, b.x + b.w * 0.36, b.y, b.w * 0.28, b.h, b.w * 0.12);
      c.fill();
      // the three notches: flat, natural, sharp
      for (let q = 0; q < 3; q++) {
        const y = b.y + (q + 0.5) * (b.h / 3);
        c.fillStyle = '#120B06';
        c.fillRect(b.x + b.w * 0.28, y - 2, b.w * 0.44, 4);
        c.fillStyle = 'rgba(255,230,190,.25)';
        c.fillRect(b.x + b.w * 0.28, y + 2, b.w * 0.44, 1);
      }
    }
  }

  kit.choice({
    label: 'Pedals',
    value: 'C',
    options: [{ value: 'C', label: 'C' }, { value: 'Eb', label: 'E♭' }, { value: 'pent', label: 'Penta' }],
    onChange(v) {
      // A quick way to set all seven: E♭ major flattens E, A and B. Pentatonic tunes the F
      // strings down to F♭ (which sounds E) and the B strings up to B♯ (which sounds C), so every
      // string plays C, D, E, G or A, the C pentatonic scale: no wrong notes in a glissando.
      const set = { C: [0, 0, 0, 0, 0, 0, 0], Eb: [0, 0, -1, 0, 0, -1, -1], pent: [0, 0, 0, -1, 0, 0, 1] }[v];
      set.forEach((to, letter) => setPedal(letter, to));
    },
  });

  // Listen: before a tune the harpist sets the pedals for its key (F♯ is the F pedal down, B♭
  // the B pedal up...), then plucks each note's string.
  const SPELL = { 1: [[0, 1], [1, -1]], 3: [[2, -1], [1, 1]], 6: [[3, 1], [4, -1]], 8: [[5, -1], [4, 1]], 10: [[6, -1], [5, 1]] };
  const stringOf = (m) => strings.findIndex((_, i) => noteOf(i) === m);
  kit.performer({
    can: (e) => e.midi != null && stringOf(e.midi) >= 0,
    prepare(evs) {
      const pcs = new Set(evs.filter((e) => e.midi != null).map((e) => ((e.midi % 12) + 12) % 12));
      const want = [0, 0, 0, 0, 0, 0, 0];
      const naturals = new Set([...pcs].filter((pc) => NATURAL.includes(pc)).map((pc) => NATURAL.indexOf(pc)));
      for (const pc of pcs) {
        // A sharp or flat goes on a letter the tune doesn't need as a natural.
        const pick = SPELL[pc]?.find(([letter]) => !naturals.has(letter) && !want[letter]);
        if (pick) want[pick[0]] = pick[1];
      }
      want.forEach((to, letter) => setPedal(letter, to));
    },
    down(e) {
      const i = stringOf(e.midi);
      pluck(i, 0.4 + (e.vel ?? 0.7) * 0.45);
      return null;
    },
    up() {},
    finish() {},
  });

  function keydown(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'z') { octave = Math.max(0, octave - 1); s.redraw(); return; }
    if (k === 'x') { octave = Math.min(Math.floor((count - 1) / 7), octave + 1); s.redraw(); return; }
    const n = KEYS.indexOf(k);
    if (n >= 0 && octave * 7 + n < count) pluck(octave * 7 + n);
  }
  addEventListener('keydown', keydown);

  return () => {
    removeEventListener('keydown', keydown);
    for (const st of strings) st.voice?.stop(0.2);
    s.destroy();
  };
}
