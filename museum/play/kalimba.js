/* The kalimba: thirteen steel tines on a box of koa, seen from above as the player holds it,
   lying on the mat. Each tine rests on a bridge and is clamped by the bar behind it; the part
   past the bridge rings, and a shorter tine rings higher (its length goes as one over the
   square root of its pitch). The lowest is in the middle, and the notes of the scale step out
   to the right and left in turn, so neighbouring thumbs play steps. Engraved on each tine: its
   number in the scale (1 is C), with a dot above for each octave up. */

import { surface, label } from '../surface.js';
import { pitched } from '../audio.js';
import { layer, put, wood, rand, metal, TAU } from '../paint.js';
import { mat } from '../drums.js';

const PITCH = 0.46;          // inches from one tine to the next
const WIDE = 0.25;           // a tine's width
const ring = (m) => 3.7 * Math.pow(2, -(m - 60) / 24);   // how much of it rings, in inches
const NUM = ['1', '', '2', '', '3', '4', '', '5', '', '6', '', '7'];

export async function tines(stage, ex, kit) {
  const o = ex.opts;
  const notes = o.tines;           // the scale, low to high
  const inst = await pitched(o.sound, notes[0], notes[notes.length - 1]);
  // Arrange: the lowest in the middle, then right, left, right, left...
  const n = notes.length;
  const order = new Array(n);
  const mid = Math.floor(n / 2);
  notes.forEach((m, k) => {
    const side = k === 0 ? 0 : k % 2 ? Math.ceil(k / 2) : -Math.ceil(k / 2);
    order[mid + side] = { midi: m, rank: k, at: 0 };
  });
  const box = document.createElement('div');
  box.className = 'zone hand kalimba';
  stage.append(box);

  /* The board, in inches: tines in a row with 0.6 to spare at each side; the bridge far enough
     down for the longest; the clamping bar, the tines' ends and the sound hole below it. */
  const BW = n * PITCH + 1.2;
  const TOP = 0.42;
  const BRIDGE = TOP + ring(notes[0]);
  const BH = BRIDGE + 2.4;
  let G = null;
  function geom(s) {
    const key = `${s.W}x${s.H}`;
    if (G?.key === key) return G;
    const k = Math.min((s.W - 24) / BW, (s.H - 28) / BH, 120);
    const bx = (s.W - BW * k) / 2;
    const by = (s.H - BH * k) / 2;
    G = {
      key, k, bx, by,
      left: bx + 0.6 * k,
      gap: PITCH * k,
      bar: by + BRIDGE * k,
      x: (i) => bx + (0.6 + (i + 0.5) * PITCH) * k,
      tip: (t) => by + (BRIDGE - ring(t.midi)) * k,
    };
    return G;
  }
  const tineAt = (u, v) => {
    const i = Math.floor((u - G.left) / G.gap);
    return i >= 0 && i < n && v > G.by - 16 && v < G.bar + G.k * 0.5 ? i : null;
  };

  function pluck(i) {
    const t = order[i];
    inst.play(t.midi, { vol: 0.75 });
    t.at = performance.now();
    kit.note(t.midi, 'fresh');
    s.animate(1600);
  }

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p) {
      geom(s);
      const i = tineAt(p.u, p.v);
      if (i == null) return;
      pluck(i);
      p.data.last = i;
    },
    move(p) {
      const i = tineAt(p.u, p.v);
      if (i != null && i !== p.data.last) { pluck(i); p.data.last = i; }
    },
  });
  s.onresize = () => { G = null; };
  // for tests: the middle of a tine's ringing part
  s.canvas.museumAt = (i) => {
    geom(s);
    return { u: G.x(i), v: (G.tip(order[i]) + G.bar) / 2 };
  };
  s.canvas.museumTine = (i) => order[i].midi;

  function draw(g, s) {
    geom(s);
    const now = performance.now();
    put(g, s, layer(s, 'kalimba', G.key, (c) => still(c, s)));
    const { k } = G;
    // a plucked tine: its end a blur as it rings, and a glint along it
    order.forEach((t, i) => {
      if (!t.at) return;
      const age = (now - t.at) / 1000;
      if (age > 1.6) return;
      const e = Math.exp(-age * 2.6);
      const x = G.x(i);
      const y0 = G.tip(t);
      const w = WIDE * k;
      const amp = e * k * 0.07;
      g.save();
      for (const d of [-1, 1]) {
        g.globalAlpha = 0.45 * e;
        tine(g, x, y0 + d * amp * Math.abs(Math.sin(age * 40)), y0 + (G.bar - y0) * 0.55, w);
      }
      const gl = g.createLinearGradient(0, y0, 0, G.bar);
      gl.addColorStop(0, `rgba(255,255,255,${0.5 * e})`);
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalAlpha = 1;
      g.fillStyle = gl;
      g.fillRect(x - w / 2, y0, w, G.bar - y0);
      g.restore();
    });
    // what is engraved on each tine
    order.forEach((t, i) => {
      const num = NUM[t.midi % 12];
      if (!num) return;
      const x = G.x(i);
      const y = G.tip(t) + k * 0.42;
      const size = Math.max(9, Math.min(16, k * 0.17));
      label(g, s, num, x, y + 0.7, { size, color: 'rgba(255,255,255,.55)' });
      label(g, s, num, x, y, { size, color: 'rgba(38,42,46,.82)' });
      const up = Math.floor(t.midi / 12) - 5;
      g.fillStyle = 'rgba(38,42,46,.82)';
      for (let d = 0; d < up; d++) {
        g.beginPath();
        g.arc(x, y - size * 0.78 - d * size * 0.36, Math.max(1.2, size * 0.1), 0, TAU);
        g.fill();
      }
    });
  }

  /* A tine from its rounded end at y0 down to y1: a flat strip of spring steel, its edges
     rounded off and catching the light. */
  function tine(g, x, y0, y1, w) {
    const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gr.addColorStop(0, '#5E666C');
    gr.addColorStop(0.1, '#E9EEF1');
    gr.addColorStop(0.2, '#B9C1C7');
    gr.addColorStop(0.55, '#A6AEB5');
    gr.addColorStop(0.82, '#8E979E');
    gr.addColorStop(0.92, '#D5DBDF');
    gr.addColorStop(1, '#4E555A');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x - w / 2, y1);
    g.lineTo(x - w / 2, y0 + w / 2);
    g.arc(x, y0 + w / 2, w / 2, Math.PI, 0);
    g.lineTo(x + w / 2, y1);
    g.closePath();
    g.fill();
  }

  function still(g, s) {
    const { k, bx, by, bar } = G;
    mat(g, s.W, s.H, { k, tilt: Math.PI / 2, x: s.W / 2, y: s.H / 2 });
    const W = BW * k;
    const H = BH * k;
    const arch = 0.32 * k;
    const r = 0.55 * k;
    const outline = () => {
      g.beginPath();
      g.moveTo(bx, by + arch);
      g.quadraticCurveTo(bx + W / 2, by - arch, bx + W, by + arch);
      g.lineTo(bx + W, by + H - r);
      g.arcTo(bx + W, by + H, bx + W - r, by + H, r);
      g.lineTo(bx + r, by + H);
      g.arcTo(bx, by + H, bx, by + H - r, r);
      g.closePath();
    };
    // its shadow, then the board: koa, the grain across it
    g.save();
    g.shadowColor = 'rgba(0,0,0,.55)';
    g.shadowBlur = k * 0.5 * s.dpr;
    g.shadowOffsetX = k * 0.18 * s.dpr;
    g.shadowOffsetY = k * 0.26 * s.dpr;
    outline();
    g.fillStyle = '#7A4318';
    g.fill();
    g.restore();
    g.save();
    outline();
    g.clip();
    g.fillStyle = wood(g, 'koa', { x: bx, y: by, angle: 90, scale: Math.max(0.6, k / 40), seed: 3 });
    g.fillRect(bx, by - arch, W, H + arch);
    // lacquer: light from the upper left, its rounded edge
    const sh = g.createLinearGradient(bx, by, bx + W, by + H);
    sh.addColorStop(0, 'rgba(255,238,200,.16)');
    sh.addColorStop(0.5, 'rgba(255,238,200,0)');
    sh.addColorStop(1, 'rgba(0,0,0,.22)');
    g.fillStyle = sh;
    g.fillRect(bx, by - arch, W, H + arch);
    outline();
    g.lineWidth = k * 0.16;
    g.strokeStyle = 'rgba(255,230,190,.16)';
    g.stroke();
    g.lineWidth = k * 0.05;
    g.strokeStyle = 'rgba(40,16,2,.5)';
    g.stroke();
    g.restore();

    // the sound hole, ringed with a line of pale wood
    const hx = bx + W / 2;
    const hy = bar + 1.55 * k;
    const hr = 0.44 * k;
    g.lineWidth = k * 0.07;
    g.strokeStyle = 'rgba(236,206,150,.75)';
    g.beginPath();
    g.arc(hx, hy, hr + k * 0.13, 0, TAU);
    g.stroke();
    const hole = g.createRadialGradient(hx - hr * 0.25, hy - hr * 0.3, hr * 0.1, hx, hy, hr);
    hole.addColorStop(0, '#0C0602');
    hole.addColorStop(0.75, '#1A0D04');
    hole.addColorStop(1, '#3A1E08');
    g.fillStyle = hole;
    g.beginPath();
    g.arc(hx, hy, hr, 0, TAU);
    g.fill();
    // its far wall, catching the light from the upper left
    g.strokeStyle = 'rgba(214,150,84,.55)';
    g.lineWidth = k * 0.06;
    g.beginPath();
    g.arc(hx, hy, hr - k * 0.03, -0.3, 1.9);
    g.stroke();

    const x0 = G.x(0) - PITCH * k * 0.7;
    const x1 = G.x(n - 1) + PITCH * k * 0.7;
    // the ridges the tines rest on: the bridge, and the back ridge near their ends
    for (const [y, h] of [[bar, 0.22], [bar + 0.9 * k, 0.18]]) {
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.fillRect(x0, y - h * k * 0.5 + k * 0.05, x1 - x0, h * k);
      g.fillStyle = wood(g, 'maple', { x: x0, y, scale: Math.max(0.5, k / 60), seed: 5 });
      g.fillRect(x0, y - h * k * 0.5, x1 - x0, h * k);
      g.fillStyle = metal(g, 'steel', 0, y - k * 0.06, 0, y + k * 0.06);
      g.fillRect(x0, y - k * 0.06, x1 - x0, k * 0.12);
    }
    // the tines' shadows on the board, then the tines
    const w = WIDE * k;
    order.forEach((t, i) => {
      const x = G.x(i);
      g.save();
      g.globalAlpha = 0.35;
      g.fillStyle = '#000';
      g.filter = 'none';
      g.beginPath();
      g.roundRect(x - w / 2 + k * 0.06, G.tip(t) + k * 0.08, w, bar + 0.95 * k - G.tip(t), w / 2);
      g.fill();
      g.restore();
    });
    order.forEach((t, i) => tine(g, G.x(i), G.tip(t), bar + 0.95 * k, w));
    // the bar that clamps them, with its three screws
    const py = bar + 0.45 * k;
    const ph = 0.3 * k;
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(x0 + k * 0.05, py - ph / 2 + k * 0.08, x1 - x0, ph);
    g.fillStyle = metal(g, 'chrome', 0, py - ph / 2, 0, py + ph / 2);
    g.beginPath();
    g.roundRect(x0, py - ph / 2, x1 - x0, ph, k * 0.05);
    g.fill();
    for (const sx of [x0 + k * 0.3, (x0 + x1) / 2, x1 - k * 0.3]) {
      const sr = k * 0.1;
      const gr = g.createRadialGradient(sx - sr * 0.3, py - sr * 0.3, sr * 0.1, sx, py, sr);
      gr.addColorStop(0, '#FFFFFF');
      gr.addColorStop(0.5, '#B8C0C6');
      gr.addColorStop(1, '#5A6268');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(sx, py, sr, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(30,34,38,.7)';
      g.lineWidth = Math.max(1, k * 0.025);
      g.beginPath();
      g.moveTo(sx - sr * 0.6, py - sr * 0.3);
      g.lineTo(sx + sr * 0.6, py + sr * 0.3);
      g.stroke();
    }
    // a scatter of tiny scratches on the bar, from years of thumbs
    const rr = rand(4);
    g.strokeStyle = 'rgba(255,255,255,.18)';
    g.lineWidth = 0.5;
    for (let j = 0; j < 24; j++) {
      const x = x0 + rr() * (x1 - x0);
      const y = py - ph / 2 + rr() * ph;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rr() - 0.5) * k * 0.3, y + (rr() - 0.5) * k * 0.05);
      g.stroke();
    }
  }

  // Listen: the thumbs pluck each note's tine.
  kit.performer({
    can: (e) => e.midi != null && order.some((t) => t.midi === e.midi),
    down(e) { pluck(order.findIndex((t) => t.midi === e.midi)); return null; },
    up() {},
    finish() {},
  });

  return () => s.destroy();
}
