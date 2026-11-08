/* Keyboards and mallet bars: piano, glockenspiel, xylophone, marimba.
   A map of the whole range sits on top; drag it to move along the keyboard.
   Slide a finger across the keys for a glissando. Nearer the front of a key (or the middle of
   a bar) plays louder. On a computer, the letter keys play (A is C, W is C♯, ...), Z and X move
   down and up an octave, and Space holds the piano's pedal. */

import { surface, rr, label, fine } from '../surface.js';
import { pitched } from '../audio.js';

const BLACK = new Set([1, 3, 6, 8, 10]);
const isBlack = (m) => BLACK.has(((m % 12) + 12) % 12);
const KEYS = 'awsedftgyhujkolp;\'';

const LOOKS = {
  piano: { white: '#FBF8F1', whiteEdge: '#CFC6B4', black: '#1D1A18', bg: '#141210', felt: '#7A1F23' },
  glock: { white: '#E3E8EC', black: '#C9D1D7', bg: '#2C3237', rail: '#5B4636', bars: true, metal: true },
  xylo: { white: '#BE7442', black: '#A65F33', bg: '#3A2A20', rail: '#2A1D15', bars: true },
  marimba: { white: '#8F4B2A', black: '#7C3F22', bg: '#2B211B', rail: '#1E1712', bars: true, tubes: true },
};

export async function mount(stage, ex, kit) {
  const o = ex.opts;
  const look = LOOKS[o.look];
  const inst = await pitched(o.sound, o.lo, o.hi);
  const whites = [];
  for (let m = o.lo; m <= o.hi; m++) if (!isBlack(m)) whites.push(m);

  const box = document.createElement('div');
  box.className = 'zone';
  stage.append(box);

  let first = Math.max(0, whites.indexOf(o.start));   // first white key showing
  let count = 14;
  let pedal = false;
  const down = new Map();        // midi -> { voice, by: Set of sources }
  const lit = new Map();         // midi -> time it was struck (for the glow)
  const held = new Map();        // pointer id or key letter -> midi
  let last = null;

  const STRIP = 30;
  const layout = (s) => {
    const target = s.W > 900 ? 58 : s.W > 600 ? 50 : 42;
    count = Math.max(7, Math.min(whites.length, Math.floor((s.W - 16) / target)));
    first = Math.max(0, Math.min(first, whites.length - count));
  };

  function geometry(s) {
    const top = STRIP + 14;
    const pad = 8;
    const kw = (s.W - pad * 2) / count;
    const kh = s.H - top - pad;
    return { top, pad, kw, kh };
  }

  /* Which note is under a point of the keys. */
  function keyAt(s, u, v) {
    const { top, pad, kw, kh } = geometry(s);
    if (v < top) return null;
    const i = Math.floor((u - pad) / kw);
    if (i < 0 || i >= count) return null;
    const w = whites[first + i];
    const y = (v - top) / kh;
    if (look.bars) {
      // Two rows: the sharps and flats on the back row, like a real mallet instrument.
      const back = y < 0.42;
      if (!back) return { midi: w, depth: 1 - Math.abs((y - 0.71) / 0.29) };
      const x = (u - pad) / kw - i;
      const m = x < 0.5 ? w - 1 : w + 1;
      if (isBlack(m) && m >= o.lo && m <= o.hi) return { midi: m, depth: 1 - Math.abs((y - 0.21) / 0.21) };
      return null;
    }
    if (y < 0.62) {
      const x = (u - pad) / kw - i;
      if (x < 0.32 && isBlack(w - 1) && w - 1 >= o.lo) return { midi: w - 1, depth: y / 0.62 };
      if (x > 0.68 && isBlack(w + 1) && w + 1 <= o.hi) return { midi: w + 1, depth: y / 0.62 };
    }
    return { midi: w, depth: y };
  }

  function strike(midi, depth = 0.7, from) {
    const vol = 0.42 + 0.5 * Math.max(0, Math.min(1, depth));
    const d = down.get(midi);
    if (d && !look.bars) d.voice.stop(0.03);
    const voice = inst.play(midi, { vol });
    const entry = { voice, by: new Set([from]) };
    if (d && look.bars) d.voice.stop?.(0.4);
    down.set(midi, entry);
    lit.set(midi, performance.now());
    last = midi;
    kit.note(midi);
    s.animate(look.bars ? 700 : 120);
  }

  function lift(midi, from) {
    const d = down.get(midi);
    if (!d) return;
    d.by.delete(from);
    if (d.by.size) return;
    if (!look.bars) {
      if (pedal) d.pedalled = true;
      else { d.voice.stop(); down.delete(midi); }
    } else {
      down.delete(midi);
    }
    s.redraw();
  }

  function setPedal(on) {
    pedal = on;
    pedalTool?.set(on);
    if (!on) {
      for (const [m, d] of down) if (!d.by.size) { d.voice.stop(); down.delete(m); }
    }
    s.redraw();
  }

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p, s) {
      if (p.v < STRIP + 10) { p.data.strip = true; scrollTo(s, p.u); return; }
      const k = keyAt(s, p.u, p.v);
      if (!k) return;
      held.set(p.id, k.midi);
      strike(k.midi, k.depth, p.id);
    },
    move(p, s) {
      if (p.data.strip) { scrollTo(s, p.u); return; }
      const k = keyAt(s, p.u, p.v);
      const was = held.get(p.id);
      if ((k && k.midi) === was) return;
      if (was != null) lift(was, p.id);
      held.delete(p.id);
      if (k) { held.set(p.id, k.midi); strike(k.midi, k.depth, p.id); }
    },
    up(p) {
      const was = held.get(p.id);
      held.delete(p.id);
      if (was != null) lift(was, p.id);
    },
  });
  s.onresize = layout;
  layout(s);

  function scrollTo(s, u) {
    const pad = 8;
    const sw = (s.W - pad * 2) / whites.length;
    first = Math.round((u - pad) / sw - count / 2);
    first = Math.max(0, Math.min(first, whites.length - count));
    s.redraw();
  }

  function draw(g, s, t) {
    const { top, pad, kw, kh } = geometry(s);
    const now = performance.now();
    g.fillStyle = look.bg;
    g.fillRect(0, 0, s.W, s.H);

    // the map of the whole range
    const sw = (s.W - pad * 2) / whites.length;
    rr(g, pad, 8, s.W - pad * 2, STRIP - 6, 6);
    g.fillStyle = 'rgba(255,255,255,.06)';
    g.fill();
    whites.forEach((m, i) => {
      g.fillStyle = pressed(m) ? '#D9B26F' : look.bars ? look.white : '#E9E4D8';
      g.fillRect(pad + i * sw + 0.5, 10, Math.max(1, sw - 1), STRIP - 10);
    });
    if (!look.bars) {
      whites.forEach((m, i) => {
        if (isBlack(m + 1) && m + 1 <= o.hi) {
          g.fillStyle = pressed(m + 1) ? '#D9B26F' : '#1D1A18';
          g.fillRect(pad + (i + 0.65) * sw, 10, sw * 0.7, (STRIP - 10) * 0.6);
        }
      });
    }
    // C markers on the map, so the octaves are easy to find.
    whites.forEach((m, i) => { if (m % 12 === 0) { g.fillStyle = 'rgba(217,178,111,.9)'; g.fillRect(pad + i * sw, STRIP + 1, Math.max(2, sw), 2); } });
    g.strokeStyle = '#D9B26F';
    g.lineWidth = 2.5;
    rr(g, pad + first * sw - 1, 6, count * sw + 2, STRIP - 2, 5);
    g.stroke();

    if (look.bars) drawBars(g, s, now, { top, pad, kw, kh });
    else drawPiano(g, s, now, { top, pad, kw, kh });
  }

  const pressed = (m) => !!down.get(m)?.by.size;
  function glow(m, now) {
    const at = lit.get(m);
    if (pressed(m)) return 1;
    if (!at) return 0;
    return Math.max(0, 1 - (now - at) / 650);
  }

  function letterFor(m) {
    const c = whites[first];
    const base = c - (((c % 12) + 12) % 12) + (c % 12 === 0 ? 0 : 12);
    const i = m - base;
    return i >= 0 && i < KEYS.length ? KEYS[i].toUpperCase() : '';
  }

  function drawPiano(g, s, now, { top, pad, kw, kh }) {
    // felt strip
    g.fillStyle = look.felt;
    g.fillRect(pad, top - 6, s.W - pad * 2, 6);
    const showKeys = fine();
    for (let i = 0; i < count; i++) {
      const m = whites[first + i];
      const x = pad + i * kw;
      const on = glow(m, now);
      const grad = g.createLinearGradient(0, top, 0, top + kh);
      grad.addColorStop(0, on ? '#F2D79A' : '#F4F0E6');
      grad.addColorStop(1, on ? '#E2B865' : look.white);
      g.fillStyle = grad;
      rr(g, x + 1, top, kw - 2, kh - (pressed(m) ? 0 : 3), 6);
      g.fill();
      if (!pressed(m)) { g.fillStyle = look.whiteEdge; g.fillRect(x + 1, top + kh - 6, kw - 2, 3); }
      if (m % 12 === 0) label(g, s, `C${Math.floor(m / 12) - 1}`, x + kw / 2, top + kh - 18, { size: 12, color: '#9A8F7B', weight: 500 });
      if (showKeys) { const l = letterFor(m); if (l) label(g, s, l, x + kw / 2, top + kh - 40, { size: 12, color: '#B5AA95', weight: 600 }); }
    }
    for (let i = 0; i < count; i++) {
      const w = whites[first + i];
      for (const m of [w + 1]) {
        if (!isBlack(m) || m > o.hi) continue;
        const x = pad + (i + 0.66) * kw;
        const bw = kw * 0.68;
        const bh = kh * 0.62;
        const on = glow(m, now);
        const grad = g.createLinearGradient(0, top, 0, top + bh);
        grad.addColorStop(0, on ? '#B4893A' : '#2B2724');
        grad.addColorStop(1, on ? '#D9B26F' : look.black);
        g.fillStyle = grad;
        rr(g, x, top - 2, bw, bh, 4);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.12)';
        rr(g, x + bw * 0.18, top + bh - 16, bw * 0.64, 10, 3);
        g.fill();
        if (showKeys) { const l = letterFor(m); if (l) label(g, s, l, x + bw / 2, top + bh - 30, { size: 11, color: '#8E857A' }); }
      }
      // a black key whose white neighbour is off the left edge
      if (i === 0 && isBlack(w - 1) && w - 1 >= o.lo) {
        const on = glow(w - 1, now);
        g.fillStyle = on ? '#D9B26F' : look.black;
        rr(g, pad - kw * 0.34, top - 2, kw * 0.68, kh * 0.62, 4);
        g.fill();
      }
    }
  }

  function drawBars(g, s, now, { top, pad, kw, kh }) {
    const rowF = { y: top + kh * 0.44, h: kh * 0.56 };
    const rowB = { y: top, h: kh * 0.42 };
    const span = whites.length;
    const barFor = (m, row, x, bw) => {
      // Lower notes have longer bars.
      const k = (whites.indexOf(isBlack(m) ? m - 1 : m) / span);
      const shrink = 0.22 * k;
      const h = row.h * (1 - shrink);
      const y = row.y + (row.h - h) / 2;
      const on = glow(m, now);
      if (look.tubes) {
        g.fillStyle = '#4C4F55';
        rr(g, x + bw * 0.3, y + h * 0.55, bw * 0.4, h * 0.5, bw * 0.2);
        g.fill();
      }
      const grad = g.createLinearGradient(x, 0, x + bw, 0);
      const base = isBlack(m) ? look.black : look.white;
      grad.addColorStop(0, shade(base, look.metal ? 18 : 12));
      grad.addColorStop(0.5, base);
      grad.addColorStop(1, shade(base, -18));
      g.fillStyle = grad;
      g.save();
      if (on) { g.shadowColor = 'rgba(255,214,140,.9)'; g.shadowBlur = 24 * on; }
      rr(g, x, y, bw, h, Math.min(8, bw * 0.18));
      g.fill();
      g.restore();
      if (on) {
        g.fillStyle = `rgba(255,236,190,${0.45 * on})`;
        rr(g, x, y, bw, h, Math.min(8, bw * 0.18));
        g.fill();
      }
      // the cord holes
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.beginPath();
      g.arc(x + bw / 2, y + h * 0.2, Math.max(2, bw * 0.05), 0, Math.PI * 2);
      g.arc(x + bw / 2, y + h * 0.8, Math.max(2, bw * 0.05), 0, Math.PI * 2);
      g.fill();
    };
    // rails
    g.fillStyle = look.rail;
    for (const row of [rowB, rowF]) {
      g.fillRect(pad, row.y + row.h * 0.18, s.W - pad * 2, 5);
      g.fillRect(pad, row.y + row.h * 0.78, s.W - pad * 2, 5);
    }
    const gap = Math.max(3, kw * 0.08);
    for (let i = 0; i < count; i++) {
      const w = whites[first + i];
      barFor(w, rowF, pad + i * kw + gap / 2, kw - gap);
      if (isBlack(w + 1) && w + 1 <= o.hi) barFor(w + 1, rowB, pad + (i + 0.5) * kw + gap / 2, kw - gap);
      if (i === 0 && isBlack(w - 1) && w - 1 >= o.lo) barFor(w - 1, rowB, pad - kw / 2 + gap / 2, kw - gap);
      if (fine()) { const l = letterFor(w); if (l) label(g, s, l, pad + i * kw + kw / 2, rowF.y + rowF.h - 14, { size: 12, color: 'rgba(0,0,0,.45)' }); }
    }
  }

  let pedalTool = null;
  if (o.look === 'piano') {
    pedalTool = kit.toggle({
      label: 'Pedal',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14l-2 4H7z" fill="currentColor"/><path d="M12 3v14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
      onChange: (on) => setPedal(on),
    });
  }

  function keydown(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === ' ' && o.look === 'piano') { e.preventDefault(); setPedal(true); return; }
    if (k === 'z' || k === 'x') {
      first = Math.max(0, Math.min(whites.length - count, first + (k === 'z' ? -7 : 7)));
      s.redraw();
      return;
    }
    const i = KEYS.indexOf(k);
    if (i < 0) return;
    const c = whites[first];
    const base = c - (((c % 12) + 12) % 12) + (c % 12 === 0 ? 0 : 12);
    const m = base + i;
    if (m < o.lo || m > o.hi) return;
    held.set(`k${k}`, m);
    strike(m, 0.75, `k${k}`);
    s.redraw();
  }
  function keyup(e) {
    const k = e.key.toLowerCase();
    if (k === ' ' && o.look === 'piano') { setPedal(false); return; }
    const m = held.get(`k${k}`);
    if (m == null) return;
    held.delete(`k${k}`);
    lift(m, `k${k}`);
  }
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);

  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    for (const d of down.values()) d.voice.stop(0.2);
    s.destroy();
  };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
