/* Keyboards and mallet bars: piano, organ, glockenspiel, xylophone, marimba.
   A map of the whole range sits on top; drag it to move along the keyboard.
   Slide a finger across the keys for a glissando. Nearer the front of a key (or the middle of
   a bar) plays louder. On a computer, the letter keys play (A is C, W is C♯, ...), Z and X move
   down and up an octave, and Space holds the piano's pedal. An organ's note lasts as long as
   the key is held, at the same loudness however it is pressed, since air through a pipe, not
   a hammer, makes the sound.

   The keys are drawn to a real piano's proportions (a white key about six times as long as it
   is wide; black keys a little over half as wide and two thirds as long, leaning the way they
   do), and when there is room above them, you look inside: a grand piano's strings, hammers
   and dampers (the strings ring while a key or the pedal holds the damper up), or an organ's
   pipes. The strings and pipes play too. Mallet bars shorten from low to high, on rails
   through the points where a bar doesn't move, over resonator tubes on a marimba and a
   xylophone; a glockenspiel's steel bars sit in a felt-lined case. */

import { surface, rr, label, fine } from '../surface.js';
import { pitched } from '../audio.js';
import { wood, metal, brushed, grain, pin, string, pool, gloss, layer, put, tint, rand } from '../paint.js';

const BLACK = new Set([1, 3, 6, 8, 10]);
const isBlack = (m) => BLACK.has(((m % 12) + 12) % 12);
const KEYS = 'awsedftgyhujkolp;\'';
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

// Where each black key sits, in white keys from the left edge of the white key below it:
// C♯ leans left and D♯ right; F♯ left, G♯ in the middle, A♯ right, as on a real piano.
const BOFF = { 1: 0.9, 3: 1.1, 6: 0.857, 8: 1.0, 10: 1.143 };
const WB = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const whitesBelow = (n) => Math.floor(n / 12) * 7 + WB[((n % 12) + 12) % 12];

const LOOKS = {
  piano: { natural: '#FBF9F4', sharp: '#151312', felt: '#7A1F23', mini: '#E9E4D8' },
  organ: { natural: '#F2EAD6', sharp: '#1F1511', felt: '#3B5E48', mini: '#EFE6CF', held: true },
  glock: { bars: true, metal: true, ratio: 0.52, maxLen: 5.2, mallet: 'brass', mini: '#CDD4DA' },
  xylo: { bars: true, wood: 'padauk', ratio: 0.5, maxLen: 8.5, res: 0.17, tubes: 'silver', tube: 0.6, mallet: 'rubber', mini: '#C8683A' },
  marimba: { bars: true, wood: 'honduras', ratio: 0.46, maxLen: 7.4, res: 0.27, tubes: 'bronze', tube: 0.78, mallet: 'yarn', mini: '#8E4628' },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export async function mount(stage, ex, kit) {
  const o = ex.opts;
  const look = LOOKS[o.look];
  const inst = await pitched(o.sound, o.lo, o.hi);
  const whites = [];
  for (let m = o.lo; m <= o.hi; m++) if (!isBlack(m)) whites.push(m);
  const W0 = whitesBelow(whites[0]);

  const box = document.createElement('div');
  box.className = 'zone';
  stage.append(box);

  let first = Math.max(0, whites.indexOf(o.start));   // first white key showing
  let count = 14;
  let pedal = false;
  const down = new Map();        // midi -> { voice, by: Set of sources }
  const lit = new Map();         // midi -> time it was struck (for the glow)
  const held = new Map();        // pointer id or key letter -> midi
  const ring = new Map();        // midi -> how far its strings swing (piano)
  let last = null;
  let then = 0;

  const STRIP = 30;
  const layout = (s) => {
    const target = s.W > 900 ? 58 : s.W > 600 ? 50 : 42;
    count = Math.max(7, Math.min(whites.length, Math.floor((s.W - 16) / target)));
    first = Math.max(0, Math.min(first, whites.length - count));
  };

  /* ---------- where things are ---------- */

  /* A piano's or an organ's keys: realistic lengths, and above them the inside when it fits. */
  function kbd(s) {
    const top = STRIP + 14;
    const pad = 8;
    const kw = (s.W - pad * 2) / count;
    const avail = s.H - top - pad;
    let len = Math.min(avail, kw * (look.held ? 5.6 : 6.2));
    let nb = Math.round(clamp(kw * 0.44, 14, 30));       // the name board above the keys
    let room = avail - len - nb;
    if (room < 70) { len = avail; nb = 0; room = 0; }
    const y0 = s.H - pad - len;
    return { top, pad, kw, len, y0, nb, room, bl: len * 0.635, bw: kw * 0.58, sp: kw * 7 / 12, yF: y0 - nb };
  }
  // White keys (from the left edge of the lowest white key) to the screen.
  const ux = (G, x) => G.pad + (x - first) * G.kw;
  // Where note m's strings (or pipe) stand: evenly, twelve to the seven white keys of an octave.
  const sx = (m) => {
    const c = m - (((m % 12) + 12) % 12);
    return whitesBelow(c) - W0 + ((m - c) + 0.5) * 7 / 12;
  };
  // ...and back: the note whose strings are at x (in white keys), fractional for curves.
  const noteAtX = (x) => {
    const X = x + W0;
    const oct = Math.floor(X / 7);
    return oct * 12 + (X - oct * 7) / (7 / 12) - 0.5;
  };

  /* The inside of the piano: from the name board back, the tuning pins on the gold plate, the
     capo bar where the strings start to ring, hammers and dampers, then the strings over the
     soundboard to the bridge, which curves nearer as the strings get shorter, and the rim. */
  function inside(G) {
    const I = G.yF - G.top;
    const pinH = clamp(I * 0.2, 22, 64);
    const yC = G.yF - pinH;
    const Smax = yC - G.top + 6;
    const dA = clamp(I * 0.07, 7, 20);                       // hammers, just behind the capo
    const dH = clamp(I * 0.1, 11, 28);                        // the dampers
    return {
      I, pinH, yC, Smax, dA, dH,
      // the far end of note m's ringing length, and how far the strings lean (overstrung bass)
      bridge: (m) => yC - Math.max(34, Smax * Math.pow(2, -(m - 52) / 14)),
      slant: (m) => (m <= 42 ? 0.36 : 0),
    };
  }
  const strings = (m) => (m < 29 ? 1 : m <= 42 ? 2 : 3);
  const wound = (m) => m <= 42;
  const dampered = (m) => m <= 88;

  /* Mallet bars: two rows, naturals in front, the rest behind. */
  const span = whitesBelow(o.hi) - W0;
  const barPos = (m) => (isBlack(m) ? whitesBelow(m - 1) - W0 + 1 : whitesBelow(m) - W0 + 0.5);
  function bars(s) {
    const top = STRIP + 14;
    const pad = 8;
    const kw = (s.W - pad * 2) / count;
    const gap = Math.max(3, kw * 0.1);
    const bw = kw - gap;
    const avail = s.H - top - pad;
    const front = look.res ? avail * look.res : clamp(avail * 0.07, 16, 34);
    const between = Math.max(8, avail * 0.03);
    const row = Math.max(40, Math.min((avail - front - between) / 2, bw * look.maxLen));
    const h = row * 2 + between + front;
    const y = top + Math.max(0, (avail - h) * 0.7);
    return { top, pad, kw, gap, bw, row, between, front, spare: y - top,
      back: { y, h: row }, fore: { y: y + row + between, h: row }, resY: y + row * 2 + between };
  }
  // The lowest bar fills its row; they shorten evenly to `ratio` of that at the top, which keeps
  // the points where they rest on a straight rail.
  const barLen = (B, m) => B.row * (1 - (1 - look.ratio) * clamp(barPos(m) / span, 0, 1));
  const barX = (B, m) => B.pad + (barPos(m) - first) * B.kw;

  /* Which note is under a point. */
  function keyAt(s, u, v) {
    return look.bars ? barAt(s, u, v) : keyOrString(s, u, v);
  }
  function keyOrString(s, u, v) {
    const G = kbd(s);
    if (v < G.top) return null;
    const x = first + (u - G.pad) / G.kw;
    if (v < G.yF) {
      // inside: the strings (or the pipe) under the finger
      const m = Math.round(noteAtX(x));
      return m >= o.lo && m <= o.hi ? { midi: m, depth: 0.6 } : null;
    }
    const y = Math.max(0, v - G.y0);
    if (y < G.bl) {
      const i = Math.floor(x);
      for (const j of [i, i - 1]) {
        const w = whites[j];
        if (w == null || !isBlack(w + 1) || w + 1 > o.hi) continue;
        if (Math.abs(x - (j + BOFF[(w + 1) % 12])) <= 0.3) return { midi: w + 1, depth: clamp(0.2 + y / G.bl, 0, 1) };
      }
    }
    const w = whites[Math.floor(x)];
    return w == null ? null : { midi: w, depth: clamp(0.15 + y / G.len, 0, 1) };
  }
  function barAt(s, u, v) {
    const B = bars(s);
    if (v < B.back.y - 8) return null;
    const x = first + (u - B.pad) / B.kw;
    const depth = (v0, m) => clamp(1 - (Math.abs(v - v0) / (barLen(B, m) / 2)) * 0.8, 0.2, 1);
    if (v < B.fore.y - B.between / 2) {
      // the back row: the sharps, each over the line between two naturals
      const j = Math.round(x);
      const w = whites[j - 1];
      if (w == null || !isBlack(w + 1) || w + 1 > o.hi) return null;
      return { midi: w + 1, depth: depth(B.back.y + B.row / 2, w + 1) };
    }
    const w = whites[Math.floor(x)];
    if (w == null) return null;
    return { midi: w, depth: v > B.resY ? 0.6 : depth(B.fore.y + B.row / 2, w) };
  }

  /* ---------- playing ---------- */

  function strike(midi, depth = 0.7, from) {
    const vel = Math.max(0, Math.min(1, depth));
    const vol = 0.42 + 0.5 * vel;
    const d = down.get(midi);
    if (d && !look.bars) d.voice.stop(0.03);
    let voice;
    if (look.held) {
      // A held note: the steady part of the sample loops for as long as the key is down.
      voice = inst.sustain({ attack: 0.02, release: 0.08 });
      voice.start(midi, 0.55);
    } else {
      // vel also picks the piano's samples recorded at that strength: soft notes sound soft.
      voice = inst.play(midi, { vol, vel });
    }
    const entry = { voice, by: new Set([from]) };
    if (d && look.bars) d.voice.stop?.(0.4);
    down.set(midi, entry);
    lit.set(midi, performance.now());
    if (o.look === 'piano') ring.set(midi, 2 + 4 * vel);
    last = midi;
    kit.note(midi, 'fresh');
    s.animate(look.bars ? 700 : 160);
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

  /* ---------- drawing ---------- */

  function draw(g, s) {
    const now = performance.now();
    const dt = Math.min(100, then ? now - then : 16);
    then = now;
    if (look.bars) drawMallets(g, s, now);
    else if (o.look === 'organ') drawOrgan(g, s, now);
    else drawPiano(g, s, now, dt);
    drawMap(g, s);
  }

  // the map of the whole range
  function drawMap(g, s) {
    const pad = 8;
    const sw = (s.W - pad * 2) / whites.length;
    g.fillStyle = 'rgba(0,0,0,.35)';
    rr(g, pad - 2, 6, s.W - pad * 2 + 4, STRIP - 2, 6);
    g.fill();
    whites.forEach((m, i) => {
      g.fillStyle = pressed(m) ? '#D9B26F' : look.mini;
      g.fillRect(pad + i * sw + 0.5, 10, Math.max(1, sw - 1), STRIP - 10);
    });
    whites.forEach((m, i) => {
      if (!isBlack(m + 1) || m + 1 > o.hi) return;
      g.fillStyle = pressed(m + 1) ? '#D9B26F' : look.bars ? tint(look.mini, -0.35) : '#1D1A18';
      if (look.bars) g.fillRect(pad + (i + 0.72) * sw, 10, sw * 0.56, (STRIP - 10) * 0.45);
      else g.fillRect(pad + (i + BOFF[(m + 1) % 12] - 0.29) * sw, 10, sw * 0.58, (STRIP - 10) * 0.6);
    });
    // C markers on the map, so the octaves are easy to find.
    g.fillStyle = 'rgba(217,178,111,.9)';
    whites.forEach((m, i) => { if (m % 12 === 0) g.fillRect(pad + i * sw, STRIP + 1, Math.max(2, sw), 2); });
    g.strokeStyle = '#D9B26F';
    g.lineWidth = 2.5;
    rr(g, pad + first * sw - 1, 6, count * sw + 2, STRIP - 2, 5);
    g.stroke();
  }

  /* ---------- piano ---------- */

  function drawPiano(g, s, now, dt) {
    const G = kbd(s);
    put(g, s, layer(s, 'piano', `${first}`, (c) => paintPiano(c, s, G)));
    if (G.room) drawAction(g, s, G, now, dt);
    else ring.clear();
    drawKeys(g, s, G, now);
  }

  /* What stays still: the floor, the case, the plate and soundboard, the bridge, the pins. */
  function paintPiano(c, s, G) {
    c.fillStyle = '#141311';
    c.fillRect(0, 0, s.W, s.H);
    pool(c, s.W * 0.5, s.H * 0.15, s.W * 0.75, '#3C3934', 0.55, 0.55);
    if (!G.room) return;
    const P = inside(G);
    const { yC } = P;
    const xs = [];   // the bridge's curve, as points across the screen
    for (let u = -4; u <= s.W + 8; u += 4) xs.push([u, P.bridge(noteAtX(first + (u - G.pad) / G.kw))]);
    const rimGap = clamp(P.I * 0.07, 12, 22);
    // the curve, dy above or below the bridge (back: right to left; join: go on from the
    // path so far rather than starting a new one)
    const along = (dy, back = false, join = back) => {
      const pts = back ? [...xs].reverse() : xs;
      pts.forEach(([u, y], i) => (i || join ? c.lineTo(u, y + dy) : c.moveTo(u, y + dy)));
    };
    // the inside of the case: the soundboard, spruce, its grain across the strings
    c.save();
    c.beginPath();
    c.moveTo(-4, G.yF);
    along(-rimGap, false, true);
    c.lineTo(s.W + 8, G.yF);
    c.closePath();
    c.save();
    c.clip();
    c.fillStyle = wood(c, 'spruce', { angle: -58, x: -first * G.kw * 0.9, scale: 1.2 });
    c.fillRect(0, 0, s.W, s.H);
    // in shadow under the rim
    const shade = c.createLinearGradient(0, G.top, 0, yC);
    shade.addColorStop(0, 'rgba(40,20,0,.35)');
    shade.addColorStop(1, 'rgba(40,20,0,.05)');
    c.fillStyle = shade;
    c.fillRect(0, 0, s.W, s.H);
    c.restore();
    // the rim of the case: black, polished, curving in as the strings get shorter
    c.beginPath();
    along(-rimGap);
    c.lineWidth = 14;
    c.strokeStyle = '#0C0B0A';
    c.stroke();
    c.beginPath();
    along(-rimGap + 7);
    c.lineWidth = 2.5;
    c.strokeStyle = '#B98E58';      // the inner rim's veneer
    c.stroke();
    c.restore();
    // the plate's hitch rail along the rim, where the strings are tied off
    c.save();
    c.beginPath();
    along(-rimGap + 8);
    along(-6, true);
    c.closePath();
    plate(c, s, G);
    c.restore();
    // the bridge: a curved strip of maple the strings press on
    c.save();
    c.beginPath();
    along(2);
    along(-4, true);
    c.closePath();
    c.fillStyle = wood(c, 'maple', { scale: 0.6 });
    c.shadowColor = 'rgba(0,0,0,.45)';
    c.shadowBlur = 4;
    c.shadowOffsetY = 2;
    c.fill();
    c.restore();
    // struts of the plate, between sections of strings
    for (const m of [42, 63, 80, 96]) {
      const x = ux(G, sx(m) + 7 / 24);
      const w = G.sp * 0.42;
      if (x < -w || x > s.W + w) continue;
      c.save();
      c.beginPath();
      const yTop = P.bridge(m + 0.5) - rimGap + 4;
      rr(c, x - w / 2, yTop, w, yC - yTop + 4, w / 2);
      plate(c, s, G);
      c.restore();
    }
    // the front of the plate, over the pin block: holes, then the tuning pins
    c.save();
    c.beginPath();
    c.rect(-4, yC - 3, s.W + 8, G.yF - yC + 3);
    plate(c, s, G);
    // its holes, showing the dark pin block under it
    const hy = G.yF - P.pinH * 0.2;
    const hr = clamp(P.pinH * 0.11, 3, 7);
    for (let k = Math.floor(first / 1.75) - 1; k * 1.75 < first + count + 2; k++) {
      const x = ux(G, k * 1.75 + 0.9);
      c.beginPath();
      c.ellipse(x, hy, hr * 1.9, hr, 0, 0, Math.PI * 2);
      c.fillStyle = '#2A1A10';
      c.fill();
      c.strokeStyle = 'rgba(255,240,190,.45)';
      c.lineWidth = 1;
      c.stroke();
    }
    // the tuning pins: one for each string, in two staggered rows
    const pr = clamp(G.sp * 0.07, 1.6, 2.8);
    eachString(G, (m, x0, k) => {
      const y = G.yF - P.pinH * (k % 2 ? 0.66 : 0.44);
      const x = x0 - (y - yC) * P.slant(m);
      c.beginPath();
      c.arc(x + 0.6, y + 0.8, pr + 0.4, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.fill();
      pin(c, x, y, pr, 'steel');
    });
    c.restore();
    // hitch pins on the rail, where each string ends
    eachString(G, (m, x0) => {
      const y = P.bridge(m) - rimGap + 11;
      if (y < G.top - 10) return;
      pin(c, x0 + (yC - y) * P.slant(m), y, Math.max(1.2, pr * 0.75), 'steel');
    });
    // the name board's shadow on the plate
    const sh = c.createLinearGradient(0, G.yF - 10, 0, G.yF);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,.4)');
    c.fillStyle = sh;
    c.fillRect(0, G.yF - 10, s.W, 10);
  }

  /* The cast iron plate, painted gold: fill the current path with it. */
  function plate(c, s, G) {
    const gr = c.createLinearGradient(0, G.top, s.W * 0.3, G.yF + 40);
    gr.addColorStop(0, '#A57E35');
    gr.addColorStop(0.45, '#D2AF5C');
    gr.addColorStop(0.7, '#BE963F');
    gr.addColorStop(1, '#94702C');
    c.fillStyle = gr;
    c.save();
    c.shadowColor = 'rgba(0,0,0,.5)';
    c.shadowBlur = 6;
    c.shadowOffsetY = 2;
    c.fill();
    c.restore();
    grain(c, 0.16, { scale: 0.7 });
    c.strokeStyle = 'rgba(255,238,180,.5)';
    c.lineWidth = 1;
    c.stroke();
  }

  /* Each string showing: its note, its x at the capo bar, and which of the note's strings. */
  function eachString(G, fn) {
    const lo = Math.max(o.lo, Math.floor(noteAtX(first - 1.5)) - 4);
    const hi = Math.min(o.hi, Math.ceil(noteAtX(first + count + 1.5)));
    const gs = clamp(G.sp * 0.17, 2.2, 4);
    for (let m = lo; m <= hi; m++) {
      const n = strings(m);
      const x = ux(G, sx(m));
      for (let k = 0; k < n; k++) fn(m, x + (k - (n - 1) / 2) * gs, k, n);
    }
  }

  /* The moving parts: hammers, strings and dampers. */
  function drawAction(g, s, G, now, dt) {
    const P = inside(G);
    const { yC, dA, dH } = P;
    const lifted = (m) => pressed(m) || pedal || !dampered(m);
    for (const [m, a] of ring) {
      const left = a * Math.exp(-dt / (lifted(m) ? 1500 : 70));
      if (left < 0.15) ring.delete(m); else ring.set(m, left);
    }
    if (ring.size) s.animate(60);
    g.save();
    g.beginPath();
    g.rect(0, G.top - 6, s.W, G.yF - G.top + 6);
    g.clip();
    // hammers: felt heads peeking out between the strings, flicking up as they strike
    const lo = Math.max(o.lo, Math.floor(noteAtX(first - 1.5)) - 4);
    const hi = Math.min(o.hi, Math.ceil(noteAtX(first + count + 1.5)));
    const hy = yC - dA * 0.55;
    for (let m = lo; m <= hi; m++) {
      const at = lit.get(m);
      const f = at ? Math.max(0, 1 - (now - at) / 160) : 0;
      const x = ux(G, sx(m)) + (yC - hy) * P.slant(m);
      const w = clamp(G.sp * 0.5, 7, 16) * (1 + 0.3 * f);
      const h = clamp(P.I * 0.035, 5, 10) * (1 + 0.4 * f);
      g.fillStyle = 'rgba(0,0,0,.4)';
      rr(g, x - w / 2 + 1, hy - h / 2 + 2, w, h, h / 2);
      g.fill();
      const hg = g.createLinearGradient(0, hy - h / 2, 0, hy + h / 2);
      hg.addColorStop(0, f ? '#FFFFFF' : '#F1ECE0');
      hg.addColorStop(0.65, f ? '#F4E6C8' : '#D9D1C0');
      hg.addColorStop(0.66, '#8E2A22');
      hg.addColorStop(1, '#5E1712');
      g.fillStyle = hg;
      rr(g, x - w / 2, hy - h / 2, w, h, h / 2);
      g.fill();
    }
    // the strings
    const rimGap = clamp(P.I * 0.07, 12, 22);
    eachString(G, (m, x0, k) => {
      const yPin = G.yF - P.pinH * (k % 2 ? 0.66 : 0.44);
      const bY = P.bridge(m);
      const yEnd = Math.max(G.top - 20, bY - rimGap + 11);
      const sl = P.slant(m);
      const len = yPin - yEnd;
      const amp = ring.get(m) || 0;
      const w = wound(m) ? clamp(G.sp * 0.075, 1.7, 2.8) * (m < 29 ? 1.25 : 1) : clamp(1.35 - (m - 43) / 80, 0.7, 1.3);
      string(g, x0 - (yPin - yC) * sl, yPin, x0 + (yC - yEnd) * sl, yEnd, {
        width: w,
        color: wound(m) ? '#C47A45' : '#D9DEE2',
        wound: wound(m),
        amp: amp * (wound(m) ? 1.3 : 1),
        glow: amp > 0.2 ? 1 : 0,
        t: now + k * 40,
        freq: 1 + (m % 5) * 0.13,
        from: (yPin - yC) / len,
        to: Math.min(1, (yPin - Math.max(bY, G.top - 20)) / len),
      });
    });
    // the capo bar, pressing the strings down where they start to ring
    const cg = g.createLinearGradient(0, yC - 3, 0, yC + 3);
    cg.addColorStop(0, '#F3DA92');
    cg.addColorStop(0.5, '#C9A04A');
    cg.addColorStop(1, '#7E5E22');
    g.fillStyle = cg;
    g.fillRect(0, yC - 3, s.W, 5);
    // the dampers: felt-lined wooden blocks on the strings; they lift off while a key or the
    // pedal holds them up, and the strings go on ringing
    const dy = yC - dA - dH / 2;
    for (let m = lo; m <= Math.min(hi, 88); m++) {
      const up = lifted(m);
      const x = ux(G, sx(m)) + (yC - dy) * P.slant(m);
      const w = clamp(G.sp * 0.8, 8, 30);
      const lift = up ? 3 : 0;
      g.fillStyle = up ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.45)';
      rr(g, x - w / 2 + 1 + lift * 0.5, dy - dH / 2 + 2 + lift, w, dH, 3);
      g.fill();
      const bx = x - w / 2 - lift * 0.4;
      const by = dy - dH / 2 - lift;
      // the black felt underneath shows as a rim
      g.fillStyle = '#1B1A1A';
      rr(g, bx, by, w, dH, 3);
      g.fill();
      const wg = g.createLinearGradient(bx, 0, bx + w, 0);
      wg.addColorStop(0, up ? '#EED3A6' : '#D9B47E');
      wg.addColorStop(1, up ? '#CFA46C' : '#B28552');
      g.fillStyle = wg;
      rr(g, bx + 1, by, w - 2, dH - 3, 2.5);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(bx + 2, by + 1, w - 4, 1.2);
    }
    g.restore();
  }

  /* Keys at a piano's proportions, on their key bed; the name board above them. */
  function drawKeys(g, s, G, now) {
    const { pad, kw, y0, len, bl, bw, nb } = G;
    const fh = clamp(len * 0.028, 4, 9);          // a white key's front edge
    g.fillStyle = '#0B0A09';
    g.fillRect(0, y0 - 3, s.W, s.H - y0 + 3);
    if (nb) nameBoard(g, s, G);
    // the felt the keys rest against
    g.fillStyle = look.felt;
    g.fillRect(0, y0 - 3, s.W, 3);
    const showKeys = fine();
    // white keys
    for (let i = -1; i <= count; i++) {
      const m = whites[first + i];
      if (m == null) continue;
      const x = pad + i * kw;
      const dn = pressed(m);
      const on = glow(m, now);
      const k = dn ? 1.5 : 0;               // a key held down sinks a little
      const body = len - (dn ? fh * 0.35 : fh);
      const gr = g.createLinearGradient(0, y0, 0, y0 + body);
      gr.addColorStop(0, dn ? '#BEB6A6' : tint(look.natural, -0.1));
      gr.addColorStop(0.06, dn ? '#DCD5C7' : look.natural);
      gr.addColorStop(1, dn ? '#E9E3D7' : tint(look.natural, -0.03));
      g.fillStyle = gr;
      g.beginPath();
      keyPath(g, x + 0.75, y0, kw - 1.5, body + k, 3);
      g.fill();
      if (on) {
        g.fillStyle = `rgba(240,190,96,${0.5 * on})`;
        g.fill();
      }
      // light down its left side, shade down its right
      g.fillStyle = 'rgba(255,255,255,.7)';
      g.fillRect(x + 1, y0, 1, body + k - 3);
      g.fillStyle = 'rgba(0,0,0,.07)';
      g.fillRect(x + kw - 3, y0, 2, body + k - 3);
      // its front edge
      const fy = y0 + body + k;
      const fg = g.createLinearGradient(0, fy, 0, y0 + len);
      fg.addColorStop(0, on ? '#E7C27E' : '#DCD5C8');
      fg.addColorStop(1, on ? '#B88D45' : '#9C9384');
      g.fillStyle = fg;
      g.beginPath();
      keyPath(g, x + 0.75, fy - 2, kw - 1.5, y0 + len - fy + 2, 3);
      g.fill();
      if (m % 12 === 0) label(g, s, `C${Math.floor(m / 12) - 1}`, x + kw / 2, y0 + body - 14, { size: 12, color: '#9A8F7B', weight: 500 });
      if (showKeys) { const l = letterFor(m); if (l) label(g, s, l, x + kw / 2, y0 + body - 36, { size: 12, color: '#B5AA95', weight: 600 }); }
    }
    // black keys: their shadows, then the keys
    const blacks = [];
    for (let i = -2; i <= count; i++) {
      const w = whites[first + i];
      if (w == null || !isBlack(w + 1) || w + 1 > o.hi) continue;
      blacks.push({ m: w + 1, x: ux(G, first + i + BOFF[(w + 1) % 12]) - bw / 2 });
    }
    for (const { x } of blacks) {
      g.fillStyle = 'rgba(0,0,0,.14)';
      rr(g, x + 2, y0, bw + 4, bl + 7, 4);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,.16)';
      rr(g, x + 1, y0, bw + 1, bl + 3, 3);
      g.fill();
    }
    for (const { m, x } of blacks) {
      const dn = pressed(m);
      const on = glow(m, now);
      const L = bl - (dn ? 3 : 0);
      g.fillStyle = '#080707';
      rr(g, x, y0 - 3, bw, L + 3, 2.5);
      g.fill();
      const inset = bw * 0.1;
      const fb = clamp(L * 0.085, 6, 18) + (dn ? 4 : 0);       // the slope down to its front
      const tg = g.createLinearGradient(0, y0, 0, y0 + L - fb);
      tg.addColorStop(0, '#1A1817');
      tg.addColorStop(0.5, '#2A2725');
      tg.addColorStop(1, '#353130');
      g.fillStyle = tg;
      rr(g, x + inset, y0 - 3, bw - inset * 2, L - fb + 3, 2);
      g.fill();
      const fg = g.createLinearGradient(0, y0 + L - fb, 0, y0 + L);
      fg.addColorStop(0, '#4A4541');
      fg.addColorStop(1, '#141211');
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(x + inset, y0 + L - fb);
      g.lineTo(x + bw - inset, y0 + L - fb);
      g.lineTo(x + bw - 1, y0 + L - 2);
      g.lineTo(x + 1, y0 + L - 2);
      g.closePath();
      g.fill();
      // a reflection down its top
      g.fillStyle = 'rgba(255,255,255,.09)';
      g.fillRect(x + inset + 1.5, y0, Math.max(1, bw * 0.08), L - fb - 2);
      if (on) {
        g.fillStyle = `rgba(217,170,90,${0.8 * on})`;
        rr(g, x + inset, y0 - 3, bw - inset * 2, L - 2, 2);
        g.fill();
      }
      if (showKeys) { const l = letterFor(m); if (l) label(g, s, l, x + bw / 2, y0 + L - fb - 16, { size: 11, color: on ? '#3A2A10' : '#8E857A' }); }
    }
    // the key slip in front of the keys
    const ks = g.createLinearGradient(0, s.H - pad, 0, s.H);
    ks.addColorStop(0, '#2A2725');
    ks.addColorStop(1, '#0B0A09');
    g.fillStyle = ks;
    g.fillRect(0, s.H - pad + 0.5, s.W, pad);
  }

  /* A key's outline: square at the back, where it goes under the name board; rounded at the
     front. */
  function keyPath(g, x, y, w, h, r) {
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.closePath();
  }

  /* The board above the keys: black lacquer with the maker's name, or an organ's oak. */
  function nameBoard(g, s, G) {
    const y = G.yF;
    const h = G.nb;
    if (o.look === 'organ') {
      g.fillStyle = wood(g, 'oak', { x: -first * G.kw, y, scale: 0.8 });
      g.fillRect(0, y, s.W, h);
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect(0, y + h - 4, s.W, 4);
      g.fillStyle = 'rgba(255,240,200,.25)';
      g.fillRect(0, y, s.W, 1.5);
      // a brass line inlaid along it
      g.fillStyle = metal(g, 'brass', 0, y + h * 0.45, 0, y + h * 0.45 + 2);
      g.fillRect(0, y + h * 0.45, s.W, 2);
      return;
    }
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#2C2926');
    gr.addColorStop(0.12, '#0E0D0C');
    gr.addColorStop(0.7, '#171513');
    gr.addColorStop(1, '#050505');
    g.fillStyle = gr;
    g.fillRect(0, y, s.W, h);
    g.save();
    g.beginPath();
    g.rect(0, y, s.W, h);
    g.clip();
    gloss(g, 0, y, s.W, h, { alpha: 0.12, at: 0.25 });
    g.restore();
    // the maker's name, in gold, in the middle of the keyboard (between E4 and F4)
    const x = ux(G, whitesBelow(65) - W0);
    if (x > -200 && x < s.W + 200) {
      g.save();
      const size = clamp(h * 0.46, 9, 14);
      g.font = `600 ${size}px Georgia, "Times New Roman", serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const word = 'W A S H B U R N';
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillText(word, x + 0.5, y + h * 0.52 + 1);
      g.fillStyle = metal(g, 'gold', 0, y + h * 0.3, 0, y + h * 0.75);
      g.fillText(word, x, y + h * 0.52);
      g.restore();
    }
  }

  /* ---------- organ ---------- */

  function drawOrgan(g, s, now) {
    const G = kbd(s);
    put(g, s, layer(s, 'organ', `${first}`, (c) => paintOrgan(c, s, G)));
    if (G.room) {
      // a pipe speaking: its mouth glows, and sound rises from its top
      let any = false;
      g.save();
      g.beginPath();
      g.rect(0, G.top - 6, s.W, G.yF - G.top + 6);
      g.clip();
      for (const [m] of down) {
        if (!pressed(m)) continue;
        const p = pipe(G, m);
        if (!p || p.x < -40 || p.x > s.W + 40) continue;
        any = true;
        g.save();
        g.shadowColor = 'rgba(255,214,130,.9)';
        g.shadowBlur = 18;
        g.fillStyle = 'rgba(255,226,150,.35)';
        g.fillRect(p.x - p.d / 2, p.top, p.d, p.toe - p.top);
        g.restore();
        pool(g, p.x, p.mouth - p.d * 0.3, p.d * 1.8, '#FFF0C0', 0.8);
        if (p.top > G.top + 6) {
          g.lineWidth = 2;
          for (let k = 0; k < 3; k++) {
            const f = ((now / 900) + k / 3) % 1;
            g.strokeStyle = `rgba(255,236,180,${0.55 * (1 - f)})`;
            g.beginPath();
            g.arc(p.x, p.top - 4 - f * 28, p.d * (0.35 + f * 0.6), Math.PI * 1.15, Math.PI * 1.85);
            g.stroke();
          }
        }
      }
      g.restore();
      if (any) s.animate(100);
    }
    drawKeys(g, s, G, now);
  }

  /* Where note m's pipe stands: lower pipes are longer and wider. */
  function pipe(G, m) {
    if (m < o.lo || m > o.hi) return null;
    const tb = clamp((G.yF - G.top) * 0.08, 10, 22);
    const yT = G.yF - tb;
    const PA = yT - G.top;
    const d = G.sp * 0.86 * Math.pow(2, -(m - 36) / 42);
    const h = Math.max(30, PA * 1.3 * Math.pow(2, (-(m - 48) * 0.72) / 12));
    const foot = clamp(PA * 0.16, 16, 56);
    return { x: ux(G, sx(m)), d, top: yT - h, mouth: yT - foot, toe: yT, foot, tb };
  }

  function paintOrgan(c, s, G) {
    // the case: dark oak, lit from above
    c.fillStyle = '#1C120C';
    c.fillRect(0, 0, s.W, s.H);
    if (!G.room) return;
    c.globalAlpha = 0.5;
    c.fillStyle = wood(c, 'walnut', { angle: 90, scale: 1.4 });
    c.fillRect(0, G.top - 8, s.W, G.yF - G.top + 8);
    c.globalAlpha = 1;
    pool(c, s.W / 2, G.top, s.W * 0.7, '#5A3E26', 0.5, 0.6);
    const lo = Math.max(o.lo, Math.floor(noteAtX(first - 1)) - 1);
    const hi = Math.min(o.hi, Math.ceil(noteAtX(first + count + 1)) + 1);
    c.save();
    c.beginPath();
    c.rect(0, G.top - 8, s.W, G.yF - G.top + 8);
    c.clip();
    for (let m = lo; m <= hi; m++) {
      const { x, d, top, mouth, toe } = pipe(G, m);
      // its shadow on the case behind
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.fillRect(x - d / 2 + 3, top + 4, d, toe - top);
      // the foot: a cone down to the toe
      c.beginPath();
      c.moveTo(x - d / 2, mouth);
      c.lineTo(x + d / 2, mouth);
      c.lineTo(x + d * 0.14, toe);
      c.lineTo(x - d * 0.14, toe);
      c.closePath();
      c.fillStyle = metal(c, 'silver', x - d / 2, 0, x + d / 2, 0);
      c.fill();
      c.fillStyle = 'rgba(0,0,0,.12)';
      c.fill();
      // the body, polished tin
      c.fillStyle = metal(c, 'silver', x - d / 2, 0, x + d / 2, 0);
      c.fillRect(x - d / 2, top, d, mouth - top);
      // the mouth: a dark slit under the upper lip, flattened into a pointed arch
      const mw = d * 0.62;
      const mh = Math.max(2, d * 0.24);
      c.beginPath();
      c.moveTo(x - mw / 2, mouth - mh);
      c.quadraticCurveTo(x - mw * 0.2, mouth - mh - d * 0.5, x, mouth - mh - d * 0.62);
      c.quadraticCurveTo(x + mw * 0.2, mouth - mh - d * 0.5, x + mw / 2, mouth - mh);
      c.closePath();
      c.fillStyle = metal(c, 'nickel', x - mw / 2, 0, x + mw / 2, 0);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,.35)';
      c.lineWidth = 0.8;
      c.stroke();
      c.fillStyle = '#16110D';
      c.fillRect(x - mw / 2, mouth - mh, mw, mh);
      // the lower lip: a little arch on the foot
      c.beginPath();
      c.moveTo(x - mw / 2, mouth);
      c.quadraticCurveTo(x, mouth + d * 0.45, x + mw / 2, mouth);
      c.strokeStyle = 'rgba(0,0,0,.3)';
      c.stroke();
      // the open top
      if (top > G.top - 8) {
        c.beginPath();
        c.ellipse(x, top, d / 2, Math.max(1.5, d * 0.14), 0, 0, Math.PI * 2);
        c.fillStyle = '#20180F';
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,.6)';
        c.lineWidth = 1;
        c.stroke();
      }
    }
    c.restore();
    // the toe board the pipes stand on, the top of the wind chest
    const p = pipe(G, o.lo);
    c.fillStyle = wood(c, 'oak', { x: -first * G.kw, scale: 0.8 });
    c.fillRect(0, p.toe, s.W, p.tb);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.fillRect(0, p.toe, s.W, 2);
    c.fillStyle = 'rgba(255,230,180,.2)';
    c.fillRect(0, p.toe + 2, s.W, 1);
  }

  /* ---------- mallets ---------- */

  function drawMallets(g, s, now) {
    const B = bars(s);
    put(g, s, layer(s, 'bars', `${first}`, (c) => paintMallets(c, s, B)));
    for (const m of visibleBars()) {
      const on = glow(m, now);
      const r = barRect(B, m);
      if (look.metal) engrave(g, s, B, m, r);
      if (!on) continue;
      // a glow around the bar (its shadow, cast from far away so only the glow shows) ...
      g.save();
      g.beginPath();
      g.rect(0, 0, s.W, s.H);
      if (g.roundRect) g.roundRect(r.x, r.y, r.w, r.h, r.r); else g.rect(r.x, r.y, r.w, r.h);
      g.clip('evenodd');
      g.shadowColor = `rgba(255,200,110,${0.9 * on})`;
      g.shadowBlur = 22 * on;
      g.shadowOffsetX = 4000;
      g.fillStyle = '#000';
      rr(g, r.x - 4000, r.y, r.w, r.h, r.r);
      g.fill();
      g.restore();
      // ... and the bar itself lit up, its grain still showing
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = look.metal ? `rgba(70,60,30,${0.45 * on})` : `rgba(95,55,18,${0.5 * on})`;
      rr(g, r.x, r.y, r.w, r.h, r.r);
      g.fill();
      g.restore();
      // the resonator under it sings too
      if (look.tubes && !isBlack(m)) pool(g, r.x + r.w / 2, B.resY + 8, r.w * 0.9, '#FFE2A0', 0.6 * on, 0.6);
    }
    if (fine()) {
      for (const m of visibleBars()) {
        const l = letterFor(m);
        const r = barRect(B, m);
        if (l) label(g, s, l, r.x + r.w / 2, r.y + r.h - 14, { size: 12, color: look.metal ? 'rgba(30,36,42,.55)' : 'rgba(255,235,210,.6)' });
      }
    }
  }

  function* visibleBars() {
    for (let i = -1; i <= count; i++) {
      const w = whites[first + i];
      if (w == null) continue;
      yield w;
      if (isBlack(w + 1) && w + 1 <= o.hi) yield w + 1;
    }
  }

  function barRect(B, m) {
    const row = isBlack(m) ? B.back : B.fore;
    const L = barLen(B, m);
    const cx = barX(B, m);
    return { x: cx - B.bw / 2, y: row.y + (row.h - L) / 2, w: B.bw, h: L, r: Math.min(7, B.bw * 0.16) };
  }

  /* A glockenspiel's bars have their names stamped in. */
  function engrave(g, s, B, m, r) {
    label(g, s, NAMES[m % 12], r.x + r.w / 2, r.y + clamp(r.h * 0.1, 12, 22), { size: clamp(B.bw * 0.26, 9, 14), color: 'rgba(40,46,52,.5)', weight: 600 });
  }

  function paintMallets(c, s, B) {
    const W = s.W;
    // the floor, in a pool of light
    c.fillStyle = look.metal ? '#1D2226' : '#1E1713';
    c.fillRect(0, 0, W, s.H);
    pool(c, W / 2, B.fore.y, W * 0.8, look.metal ? '#3E4850' : '#4A3526', 0.6, 0.6);
    // a bar's length at x across the screen, for the rails (lengths change evenly with x)
    const L = (row, x) => row.h * (1 - (1 - look.ratio) * clamp((first + (x - B.pad) / B.kw) / span, 0, 1));
    if (look.metal) {
      // the case: walnut, lined with red felt
      const y0 = B.back.y - 18;
      const y1 = B.resY + B.front;
      c.fillStyle = wood(c, 'walnut', { x: -first * B.kw, scale: 0.9 });
      rr(c, -10, y0 - 10, W + 20, y1 - y0 + 10, 10);
      c.fill();
      c.beginPath();
      rr(c, -2, y0, W + 4, B.resY - y0 + 4, 6);
      c.fillStyle = '#7E1B26';
      c.fill();
      grain(c, 0.35, { scale: 0.5 });
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.fillRect(-2, y0, W + 4, 6);
      // the felt strips the bars rest on, through the bars' still points
      for (const row of [B.back, B.fore]) {
        for (const side of [-1, 1]) {
          c.beginPath();
          for (let x = -10; x <= W + 10; x += 20) {
            const y = row.y + row.h / 2 + side * L(row, x) * 0.276;
            if (x === -10) c.moveTo(x, y); else c.lineTo(x, y);
          }
          c.strokeStyle = '#A3333F';
          c.lineWidth = clamp(B.bw * 0.22, 6, 12);
          c.stroke();
          c.strokeStyle = 'rgba(0,0,0,.25)';
          c.lineWidth = 1;
          c.stroke();
        }
      }
      // the front of the case, with its brass clasps
      const fy = B.resY + 4;
      c.fillStyle = wood(c, 'walnut', { x: 40 - first * B.kw, y: fy, scale: 0.9 });
      c.fillRect(-10, fy, W + 20, y1 - fy);
      const fg = c.createLinearGradient(0, fy, 0, y1);
      fg.addColorStop(0, 'rgba(255,230,190,.25)');
      fg.addColorStop(0.15, 'rgba(0,0,0,0)');
      fg.addColorStop(1, 'rgba(0,0,0,.45)');
      c.fillStyle = fg;
      c.fillRect(-10, fy, W + 20, y1 - fy);
      for (const x of [W * 0.22, W * 0.78]) {
        const cw = clamp(B.front * 0.9, 12, 26);
        const ch = clamp(B.front * 0.55, 8, 16);
        c.fillStyle = metal(c, 'brass', x - cw / 2, fy, x + cw / 2, fy + ch);
        rr(c, x - cw / 2, fy + (y1 - fy - ch) / 2, cw, ch, 3);
        c.fill();
      }
    } else {
      // the frame: two rails per row, through the bars' still points, with a cord through
      // the bars
      for (const row of [B.back, B.fore]) {
        for (const side of [-1, 1]) {
          const rw = clamp(B.bw * 0.3, 8, 16);
          const pts = [];
          for (let x = -10; x <= W + 10; x += 20) pts.push([x, row.y + row.h / 2 + side * L(row, x) * 0.276]);
          const edge = (dy, back) => (back ? [...pts].reverse() : pts).forEach(([x, y], i) => (i || back ? c.lineTo(x, y + dy) : c.moveTo(x, y + dy)));
          c.save();
          c.beginPath();
          edge(-rw / 2);
          edge(rw / 2, true);
          c.closePath();
          c.shadowColor = 'rgba(0,0,0,.5)';
          c.shadowBlur = 6;
          c.shadowOffsetY = 3;
          c.fillStyle = wood(c, 'walnut', { scale: 0.7, seed: side + 3 });
          c.fill();
          c.restore();
          c.beginPath();
          edge(-rw / 2);
          edge(-rw / 2 + 1.5, true);
          c.fillStyle = 'rgba(255,230,200,.18)';
          c.fill();
          // the cord
          c.beginPath();
          edge(0);
          c.strokeStyle = '#D8C7A2';
          c.lineWidth = 1.6;
          c.stroke();
        }
      }
      // resonators: a tube under each bar of the front row, longer for lower notes
      const tw = B.bw * look.tube;
      for (let i = -1; i <= count; i++) {
        const m = whites[first + i];
        if (m == null) continue;
        const x = barX(B, m);
        const k = clamp(barPos(m) / span, 0, 1);
        const h = B.front * (0.3 + 0.7 * Math.pow(1 - k, 1.25)) - 6;
        const y = B.resY + 2;
        c.fillStyle = 'rgba(0,0,0,.4)';
        rr(c, x - tw / 2 + 3, y + 3, tw, h, tw / 2);
        c.fill();
        c.fillStyle = metal(c, look.tubes, x - tw / 2, 0, x + tw / 2, 0);
        rr(c, x - tw / 2, y, tw, h, tw / 2);
        c.fill();
        // the cap at the bottom
        c.fillStyle = 'rgba(0,0,0,.25)';
        c.beginPath();
        c.ellipse(x, y + h - tw * 0.32, tw / 2 - 0.5, tw * 0.14, 0, 0, Math.PI * 2);
        c.fill();
      }
      // the frame's front rail, hiding the tops of the tubes
      c.fillStyle = wood(c, 'walnut', { x: -first * B.kw, scale: 0.7, seed: 9 });
      c.fillRect(-4, B.resY - 4, W + 8, 10);
      c.fillStyle = 'rgba(255,230,200,.2)';
      c.fillRect(-4, B.resY - 4, W + 8, 1.5);
    }
    // the bars
    for (const m of visibleBars()) bar(c, B, m);
    // posts between the bars (or the pins that hold a glockenspiel's), on each rail
    for (const row of [B.back, B.fore]) {
      for (let i = -1; i <= count + 1; i++) {
        const xb = B.pad + i * B.kw + (row === B.back ? B.kw / 2 : 0);
        for (const side of [-1, 1]) {
          const y = row.y + row.h / 2 + side * L(row, xb) * 0.276;
          c.fillStyle = 'rgba(0,0,0,.4)';
          c.beginPath();
          c.arc(xb + 1, y + 1.5, 2.6, 0, Math.PI * 2);
          c.fill();
          pin(c, xb, y, 2.4, look.metal ? 'brass' : 'nickel');
        }
      }
    }
    if (B.spare > 70) mallets(c, s, B);
  }

  function bar(c, B, m) {
    const { x, y, w, h, r } = barRect(B, m);
    c.save();
    c.fillStyle = 'rgba(0,0,0,.45)';
    rr(c, x + 2, y + 4, w, h, r);
    c.fill();
    rr(c, x, y, w, h, r);
    c.clip();
    if (look.metal) {
      c.fillStyle = metal(c, 'steel', x, 0, x + w, 0);
      c.fillRect(x, y, w, h);
      c.globalAlpha = 0.6;
      c.fillStyle = brushed(c, { angle: 90, x: x + m * 7, y });
      c.fillRect(x, y, w, h);
      c.globalAlpha = 1;
    } else {
      c.fillStyle = wood(c, look.wood, { angle: 90, x, y, seed: m, scale: 0.8 });
      c.fillRect(x, y, w, h);
      // rounded edges, and the shine of the lacquer
      const gr = c.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, 'rgba(255,225,190,.3)');
      gr.addColorStop(0.12, 'rgba(255,225,190,.08)');
      gr.addColorStop(0.35, 'rgba(255,225,190,.14)');
      gr.addColorStop(0.5, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,.38)');
      c.fillStyle = gr;
      c.fillRect(x, y, w, h);
    }
    // the ends, rounded off, a little darker
    const e = c.createLinearGradient(0, y, 0, y + h);
    e.addColorStop(0, 'rgba(0,0,0,.3)');
    e.addColorStop(Math.min(0.5, 6 / h), 'rgba(0,0,0,0)');
    e.addColorStop(Math.max(0.5, 1 - 7 / h), 'rgba(0,0,0,0)');
    e.addColorStop(1, 'rgba(0,0,0,.4)');
    c.fillStyle = e;
    c.fillRect(x, y, w, h);
    c.restore();
    c.strokeStyle = look.metal ? 'rgba(20,26,30,.55)' : 'rgba(20,8,2,.55)';
    c.lineWidth = 1;
    rr(c, x + 0.5, y + 0.5, w - 1, h - 1, r);
    c.stroke();
    if (look.metal) {
      // the holes the pins go through, at the still points
      for (const f of [0.224, 0.776]) {
        c.beginPath();
        c.arc(x + w / 2, y + h * f, clamp(w * 0.07, 2, 3.5), 0, Math.PI * 2);
        c.fillStyle = '#2B1A1E';
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,.6)';
        c.lineWidth = 0.8;
        c.stroke();
      }
    }
  }

  /* A pair of mallets lying above the instrument, when there's room. */
  function mallets(c, s, B) {
    const len = Math.min(s.W * 0.62, 340);
    const cy = B.top + B.spare * 0.5;
    const r = rand(o.lo);
    for (const k of [-1, 1]) {
      const y = cy + k * Math.min(18, B.spare * 0.16);
      const x0 = s.W / 2 - len / 2 + k * 14;
      const ang = k * 0.05 + (r() - 0.5) * 0.04;
      c.save();
      c.translate(x0, y);
      c.rotate(ang);
      // its shadow
      c.fillStyle = 'rgba(0,0,0,.35)';
      rr(c, 6, 5, len, 6, 3);
      c.fill();
      // the shaft: birch
      const sg = c.createLinearGradient(0, -3, 0, 3);
      sg.addColorStop(0, '#F2DDB4');
      sg.addColorStop(0.5, '#D2AE76');
      sg.addColorStop(1, '#9C7A48');
      c.fillStyle = sg;
      rr(c, 0, -3, len, 6, 3);
      c.fill();
      // the head
      const hr = clamp(B.bw * 0.32, 10, 17);
      const hx = len + hr * 0.6;
      c.beginPath();
      c.arc(hx + 2, 4, hr, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.fill();
      c.beginPath();
      c.arc(hx, 0, hr, 0, Math.PI * 2);
      const hg = c.createRadialGradient(hx - hr * 0.35, -hr * 0.35, 1, hx, 0, hr);
      if (look.mallet === 'yarn') {
        hg.addColorStop(0, '#6A6FB8');
        hg.addColorStop(1, '#2A2C5C');
        c.fillStyle = hg;
        c.fill();
        // the yarn wound round it
        c.strokeStyle = 'rgba(255,255,255,.14)';
        c.lineWidth = 0.8;
        for (let i = 0; i < 9; i++) {
          c.beginPath();
          c.ellipse(hx, 0, hr * 0.95, hr * (0.15 + i * 0.1), 0.4 + i * 0.35, 0, Math.PI * 2);
          c.stroke();
        }
      } else if (look.mallet === 'rubber') {
        hg.addColorStop(0, '#FF9A7A');
        hg.addColorStop(0.3, '#D2412E');
        hg.addColorStop(1, '#6E1610');
        c.fillStyle = hg;
        c.fill();
      } else {
        hg.addColorStop(0, '#FFF6D0');
        hg.addColorStop(0.35, '#E2B85A');
        hg.addColorStop(1, '#6E4C12');
        c.fillStyle = hg;
        c.fill();
      }
      c.restore();
    }
  }

  // Listen: the keys go down by themselves, scrolled into view first.
  let auto = 0;
  kit.performer({
    can: (e) => e.midi != null && e.midi >= o.lo && e.midi <= o.hi,
    prepare(evs) {
      const ms = evs.filter((e) => e.midi != null).map((e) => e.midi);
      if (!ms.length) return;
      const at = (m) => Math.max(0, whites.findIndex((w) => w >= m));
      const mid = (at(Math.min(...ms)) + at(Math.max(...ms))) / 2;
      first = Math.max(0, Math.min(whites.length - count, Math.round(mid - count / 2 + 0.5)));
      s.redraw();
    },
    down(e) {
      const id = `auto${++auto}`;
      strike(e.midi, e.vel ?? 0.7, id);
      return { midi: e.midi, id };
    },
    up(h) { lift(h.midi, h.id); },
    finish() {
      for (const [m, d] of down) for (const by of [...d.by]) if (String(by).startsWith('auto')) lift(m, by);
    },
  });

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

  // For tests: where on the canvas note m is drawn (its key, the middle of its bar, or with
  // where 'inside', its strings or pipe).
  s.canvas.museumAt = (m, where) => {
    if (look.bars) {
      const r = barRect(bars(s), m);
      return { u: r.x + r.w / 2, v: r.y + r.h / 2 };
    }
    const G = kbd(s);
    if (where === 'inside') return G.room ? { u: ux(G, sx(m)), v: G.top + (G.yF - G.top) * 0.6 } : null;
    if (isBlack(m)) return { u: ux(G, whitesBelow(m - 1) - W0 + BOFF[m % 12]), v: G.y0 + G.bl * 0.6 };
    return { u: ux(G, whitesBelow(m) - W0 + 0.5), v: G.y0 + G.len * 0.85 };
  };

  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    for (const d of down.values()) d.voice.stop(0.2);
    s.destroy();
  };
}
