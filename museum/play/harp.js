/* Harp: a row of strings, one for each note of a scale, lowest on the left. Pluck one, or
   sweep across them for a glissando. The red strings are the Cs and the dark ones the Fs, as
   on a real harp. Seven pedals at the bottom, one for each letter (D C B with the left foot,
   E F G A with the right), each set flat, natural or sharp: up, middle, down. A pedal changes
   that letter on every string at once, and a string that is ringing bends to its new note.
   On a computer, the letter keys A to K pluck C to C, Z and X move down and up an octave. */

import { surface, label, fine } from '../surface.js';
import { pitched } from '../audio.js';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const PEDALS = ['D', 'C', 'B', 'E', 'F', 'G', 'A'];   // left foot, then right foot
const KEYS = 'asdfghjk';

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
  function geom(s) {
    const left = Math.max(26, s.W * 0.05);
    const right = s.W - Math.max(26, s.W * 0.04);
    const gap = (right - left) / (count - 1);
    const strip = Math.min(110, s.H * 0.24);
    const neck = (i) => s.H * 0.07 + Math.sin((i / (count - 1)) * Math.PI) * s.H * 0.05;
    // The soundboard slants: long strings low on the left, short ones high on the right.
    const board = (i) => (s.H - strip - 16) - (i / (count - 1)) * (s.H - strip) * 0.42;
    G = { left, right, gap, strip, neck, board };
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
    kit.note(m);
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

  function draw(g, s) {
    geom(s);
    const now = performance.now();
    g.fillStyle = '#18231D';
    g.fillRect(0, 0, s.W, s.H);
    // the neck, curving over the top
    const wood = g.createLinearGradient(0, 0, 0, s.H * 0.2);
    wood.addColorStop(0, '#E3B66E');
    wood.addColorStop(1, '#A8743A');
    g.strokeStyle = wood;
    g.lineWidth = Math.max(12, s.H * 0.05);
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < count; i++) (i ? g.lineTo : g.moveTo).call(g, su(i), G.neck(i) - g.lineWidth * 0.3);
    g.stroke();
    // the soundboard
    g.lineWidth = Math.max(16, s.H * 0.06);
    g.strokeStyle = '#C48A4A';
    g.beginPath(); g.moveTo(su(0) - 12, G.board(0) + 10); g.lineTo(su(count - 1) + 12, G.board(count - 1) + 10); g.stroke();
    // the column, on the left
    g.strokeStyle = '#D9A85E';
    g.lineWidth = Math.max(10, s.W * 0.012);
    g.beginPath(); g.moveTo(G.left - 18, G.neck(0)); g.lineTo(G.left - 18, s.H - G.strip); g.stroke();

    // strings
    for (let i = 0; i < count; i++) {
      const st = strings[i];
      const x = su(i);
      const y0 = G.neck(i);
      const y1 = G.board(i);
      const age = (now - st.at) / 1000;
      const amp = st.voice ? st.amp * Math.exp(-age * 1.6) : 0;
      const color = st.letter === 0 ? '#D2443B' : st.letter === 3 ? '#2B2F4A' : '#EEE4CE';
      g.strokeStyle = color;
      g.lineWidth = 1 + ((count - i) / count) * 2.2;
      g.beginPath();
      if (amp > 0.01) {
        for (let y = y0; y <= y1; y += 5) {
          const pos = (y - y0) / (y1 - y0);
          const dx = Math.sin(now / (6 + i * 0.1) + y / 14) * amp * Math.sin(pos * Math.PI) * Math.min(G.gap * 0.4, 6);
          y === y0 ? g.moveTo(x + dx, y) : g.lineTo(x + dx, y);
        }
        g.lineTo(x, y1);
      } else {
        g.moveTo(x, y0); g.lineTo(x, y1);
      }
      g.stroke();
      // the pedal's discs at the top of each string: turned when it is sharpened or flattened
      const p = pedal[st.letter];
      g.fillStyle = p === 0 ? 'rgba(240,232,214,.55)' : '#E8B85A';
      g.beginPath(); g.arc(x, y0 + 12 + (p > 0 ? 8 : 0), 2.4, 0, 7); g.fill();
    }
    // letters under the strings, on a computer
    if (fine()) {
      for (let k = 0; k < KEYS.length; k++) {
        const i = octave * 7 + k;
        if (i < count) label(g, s, KEYS[k].toUpperCase(), su(i), G.board(i) + 22, { size: 11, color: 'rgba(246,241,228,.5)' });
      }
    }

    // pedals
    for (let k = 0; k < 7; k++) {
      const b = pedalBox(k, s);
      const letter = LETTERS.indexOf(PEDALS[k]);
      const v = pedal[letter];
      g.fillStyle = 'rgba(255,255,255,.06)';
      g.fillRect(b.x, b.y, b.w, b.h);
      // three notches: flat, natural, sharp
      for (let n = 0; n < 3; n++) {
        g.fillStyle = 'rgba(255,255,255,.14)';
        g.fillRect(b.x + b.w * 0.15, b.y + (n + 0.5) * (b.h / 3) - 1, b.w * 0.7, 2);
      }
      const y = b.y + (v + 1.5) * (b.h / 3);
      g.fillStyle = v === 0 ? '#C9CED2' : '#E8B85A';
      g.beginPath(); g.ellipse(b.x + b.w / 2, y, b.w * 0.42, Math.min(12, b.h / 7), 0, 0, 7); g.fill();
      label(g, s, PEDALS[k] + (v < 0 ? '♭' : v > 0 ? '♯' : ''), b.x + b.w / 2, y, { size: 13, color: '#15211A' });
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
