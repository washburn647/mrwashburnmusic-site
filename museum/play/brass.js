/* Trumpet, French horn, trombone, tuba. Left: the valves (or the trombone's slide).
   Right: the lips. Touch there to buzz; higher up is tighter lips, which jump to the next note
   of the harmonic series. Toward the outside of the curve is louder. On a computer: A S D F
   are the valves, 1 to 7 the slide positions, the mouse buzzes on the right (or hold Space),
   and the up and down arrows move the lips. */

import { surface, rr, label, fine } from '../surface.js';
import { pitched } from '../audio.js';

const VALVE_KEYS = 'asdf';

export async function mount(stage, ex, kit) {
  const o = ex.opts;
  const parts = o.partials;
  const valves = o.valves || [];
  const slide = !!o.slide;
  const drop = slide ? 6 : valves.reduce((a, b) => a + b, 0);
  const pitchOf = (n) => o.fundamental + 12 * Math.log2(n);
  const lo = Math.floor(pitchOf(parts[0]) - drop - 1);
  const hi = Math.ceil(pitchOf(parts[parts.length - 1]) + 1);
  const inst = await pitched(o.sound, lo, hi);
  const voice = inst.sustain({ attack: 0.035, release: 0.1, glide: 0.018 });

  const box = document.createElement('div');
  box.className = 'zone brass';
  stage.append(box);

  const down = new Set();            // valves held (0-based)
  const valvePointers = new Map();   // pointer id -> valve
  const keysDown = new Set();
  let pos = 1;                       // trombone slide position, 1..7, continuous
  let slidePointer = null;
  let lip = null;                    // { id, x, y } in the lips area, 0..1
  let keyPartial = 1;
  let spaceBlow = false;
  let sounding = false;

  let G = null;
  // The valves (or slide) and the lips side by side; on a tall screen, one above the other.
  function geom(s) {
    if (s.H > s.W * 1.05) {
      const h = s.H * 0.5;
      G = { left: { x: 0, y: 0, w: s.W, h }, lips: { x: 16, y: h + 6, w: s.W - 32, h: s.H - h - 22 } };
    } else {
      const split = s.W * (slide ? 0.66 : 0.58);
      G = { left: { x: 0, y: 0, w: split, h: s.H }, lips: { x: split + 18, y: 18, w: s.W - split - 36, h: s.H - 36 } };
    }
    return G;
  }
  const inLips = (u, v) => u > G.lips.x - 12 && v > G.lips.y - 12 && u < G.lips.x + G.lips.w + 12 && v < G.lips.y + G.lips.h + 12;

  // ---- what note is playing ----
  const bandOf = (y) => Math.max(0, Math.min(parts.length - 1, Math.floor(y * parts.length)));
  function current() {
    let semis = 0;
    if (slide) semis = pos - 1;
    else for (const v of down) semis += valves[v];
    let band;
    let bend = 0;
    let loud = 0.75;
    if (lip) {
      band = bandOf(lip.y);
      const inBand = lip.y * parts.length - band;
      bend = (inBand - 0.5) * 0.3;
      loud = 0.35 + 0.6 * lip.x;
    } else {
      band = keyPartial;
    }
    return { midi: pitchOf(parts[band]) - semis + bend, band, loud };
  }

  function update(attack = false) {
    const playing = !!lip || spaceBlow;
    if (!playing) {
      if (sounding) { voice.stop(); sounding = false; }
      kit.note(null);
      s.redraw();
      return;
    }
    const c = current();
    if (!sounding || attack) {
      voice.start(c.midi, c.loud);
      sounding = true;
    } else {
      voice.pitch(c.midi);
      voice.level(c.loud, 0.06);
    }
    kit.note(c.midi);
    s.redraw();
  }

  // ---- the slide ----
  // Each position is a little farther than the last, as on a real trombone.
  const SLIDE_K = 2 ** (6 / 12) - 1;
  const slideSpan = () => ({ a: G.left.x + G.left.w * 0.1, b: G.left.x + G.left.w * 0.54 });
  const slideU = (p) => { const { a, b } = slideSpan(); return a + (b - a) * ((2 ** ((p - 1) / 12) - 1) / SLIDE_K); };
  const posAt = (u) => {
    const { a, b } = slideSpan();
    const f = Math.max(0, Math.min(1, (u - a) / (b - a)));
    return 1 + 12 * Math.log2(1 + f * SLIDE_K);
  };

  // ---- the valves ----
  function valveRects(s) {
    const n = valves.length;
    const A = G.left;
    const size = Math.min(A.w / (n + 0.8), A.h * 0.45, 150);
    const gap = size * 0.22;
    const total = n * size + (n - 1) * gap;
    const x0 = A.x + (A.w - total) / 2;
    const y = A.y + A.h / 2 - size * 0.75;
    return valves.map((_, i) => ({ x: x0 + i * (size + gap), y, w: size, h: size }));
  }

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p, s) {
      if (inLips(p.u, p.v)) {
        lip = { id: p.id, x: lipXof(p.u), y: lipYof(p.v) };
        update(true);
        return;
      }
      if (slide) {
        slidePointer = p.id;
        pos = posAt(p.u);
        update();
        return;
      }
      const r = valveRects(s);
      const i = r.findIndex((q) => p.u > q.x - 10 && p.u < q.x + q.w + 10 && p.v > q.y - 30 && p.v < q.y + q.h + 30);
      if (i < 0) return;
      valvePointers.set(p.id, i);
      down.add(i);
      update();
    },
    move(p) {
      if (lip && lip.id === p.id) {
        lip.x = lipXof(p.u);
        lip.y = lipYof(p.v);
        update();
      } else if (slidePointer === p.id) {
        pos = posAt(p.u);
        update();
      }
    },
    up(p) {
      if (lip && lip.id === p.id) { lip = null; update(); return; }
      if (slidePointer === p.id) { slidePointer = null; return; }
      if (valvePointers.has(p.id)) {
        const i = valvePointers.get(p.id);
        valvePointers.delete(p.id);
        if (![...valvePointers.values()].includes(i) && !keysDown.has(i)) down.delete(i);
        update();
      }
    },
  });
  s.onresize = geom;
  geom(s);

  // Lips area: 0..1 across (soft to loud) and up (low to high), wherever the screen puts it.
  const lipXof = (u) => Math.max(0, Math.min(1, (u - G.lips.x) / G.lips.w));
  const lipYof = (v) => Math.max(0, Math.min(0.9999, 1 - (v - G.lips.y) / G.lips.h));

  function draw(g, s) {
    geom(s);
    const c = current();
    // left: dark velvet
    const bg = g.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#1E2A23');
    bg.addColorStop(1, '#152019');
    g.fillStyle = bg;
    g.fillRect(0, 0, s.W, s.H);

    if (slide) drawSlide(g, s);
    else drawValves(g, s);

    // right: the lips, a column of the harmonic series
    const { x, w, y: top, h } = G.lips;
    const bh = h / parts.length;
    g.save();
    rr(g, x, top, w, h, 18);
    g.clip();
    for (let i = 0; i < parts.length; i++) {
      const y = top + h - (i + 1) * bh;
      const active = (lip || spaceBlow) && c.band === i;
      // a hairpin: soft (narrow) to loud (wide)
      const grad = g.createLinearGradient(x, 0, x + w, 0);
      const tone = 0.28 + (i / parts.length) * 0.35;
      grad.addColorStop(0, `rgba(226,180,74,${tone * 0.35})`);
      grad.addColorStop(1, `rgba(226,180,74,${tone})`);
      g.fillStyle = active ? 'rgba(246,219,140,.85)' : grad;
      g.beginPath();
      g.moveTo(x, y + bh * 0.42);
      g.lineTo(x + w, y + 3);
      g.lineTo(x + w, y + bh - 3);
      g.lineTo(x, y + bh * 0.58);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect(x, y, w, 2);
    }
    g.restore();
    g.strokeStyle = 'rgba(226,180,74,.55)';
    g.lineWidth = 2;
    rr(g, x, top, w, h, 18);
    g.stroke();
    // the lips themselves, where the finger is
    if (lip) {
      const lx = x + lip.x * w;
      const ly = top + h - lip.y * h;
      g.save();
      g.shadowColor = 'rgba(255,214,140,.9)';
      g.shadowBlur = 24;
      g.fillStyle = '#F4B3A0';
      g.beginPath(); g.ellipse(lx, ly - 7, 26, 9, 0, Math.PI, 0); g.fill();
      g.beginPath(); g.ellipse(lx, ly + 7, 26, 9, 0, 0, Math.PI); g.fill();
      g.restore();
      g.strokeStyle = '#B4584A';
      g.lineWidth = 2;
      g.beginPath();
      for (let k = -24; k <= 24; k += 3) g.lineTo(lx + k, ly + Math.sin(k + performance.now() / 20) * 2.5);
      g.stroke();
      s.animate(100);
    }
  }

  function drawValves(g, s) {
    const r = valveRects(s);
    // the tubing behind the valves
    const midY = r[0].y + r[0].h * 0.5;
    g.strokeStyle = '#B98A27';
    g.lineWidth = Math.max(10, r[0].w * 0.16);
    g.beginPath();
    g.moveTo(G.left.x, midY + r[0].h * 0.75);
    g.lineTo(G.left.x + G.left.w, midY + r[0].h * 0.75);
    g.stroke();
    r.forEach((q, i) => {
      const on = down.has(i);
      const press = on ? q.h * 0.18 : 0;
      // casing
      const cg = g.createLinearGradient(q.x, 0, q.x + q.w, 0);
      cg.addColorStop(0, '#A97B1F'); cg.addColorStop(0.35, '#F6DB8C'); cg.addColorStop(0.7, '#E2B44A'); cg.addColorStop(1, '#9A6E1E');
      g.fillStyle = cg;
      rr(g, q.x + q.w * 0.18, q.y + q.h * 0.42, q.w * 0.64, q.h * 0.95, 10);
      g.fill();
      if (o.look === 'horn') {
        // a rotary valve: a round case with a lever
        g.fillStyle = cg;
        g.beginPath(); g.arc(q.x + q.w / 2, q.y + q.h * 0.95, q.w * 0.36, 0, 7); g.fill();
        g.save();
        g.translate(q.x + q.w / 2, q.y + q.h * 0.95);
        g.rotate(on ? 0.5 : 0);
        g.fillStyle = '#2B2622';
        g.beginPath(); g.arc(0, 0, q.w * 0.12, 0, 7); g.fill();
        g.restore();
      }
      // stem
      g.fillStyle = '#D4DBE0';
      g.fillRect(q.x + q.w * 0.44, q.y + press + q.h * 0.2, q.w * 0.12, q.h * 0.3);
      // finger button: mother of pearl
      const fg = g.createRadialGradient(q.x + q.w * 0.42, q.y + press + q.h * 0.14, 2, q.x + q.w / 2, q.y + press + q.h * 0.2, q.w * 0.45);
      fg.addColorStop(0, '#FFFFFF');
      fg.addColorStop(0.5, on ? '#F2D79A' : '#EAE4F2');
      fg.addColorStop(1, on ? '#C9963A' : '#B7AFC4');
      g.save();
      g.shadowColor = 'rgba(0,0,0,.5)';
      g.shadowBlur = on ? 4 : 14;
      g.shadowOffsetY = on ? 2 : 8;
      g.fillStyle = fg;
      g.beginPath(); g.ellipse(q.x + q.w / 2, q.y + press + q.h * 0.2, q.w * 0.42, q.w * 0.3, 0, 0, 7); g.fill();
      g.restore();
      label(g, s, String(i + 1), q.x + q.w / 2, q.y + q.h * 1.55, { size: 16, color: 'rgba(246,241,228,.55)' });
      if (fine()) label(g, s, VALVE_KEYS[i].toUpperCase(), q.x + q.w / 2, q.y + press + q.h * 0.2, { size: 13, color: 'rgba(60,40,10,.55)' });
    });
  }

  function drawSlide(g, s) {
    const A = G.left;
    const y1 = A.y + A.h * 0.34;
    const y2 = A.y + A.h * 0.54;
    const x0 = A.x + A.w * 0.03;
    const brace = slideU(pos);
    const L = A.w * 0.34;
    const silver = (y, h) => {
      const sg = g.createLinearGradient(0, y - h / 2, 0, y + h / 2);
      sg.addColorStop(0, '#F4F7F9'); sg.addColorStop(0.5, '#C9D1D6'); sg.addColorStop(1, '#7D888F');
      return sg;
    };
    // the inner slide stays put; the outer slide rides over it
    for (const y of [y1, y2]) {
      g.fillStyle = silver(y, 10);
      g.fillRect(x0, y - 5, slideU(7) - x0 + L * 0.6, 10);
    }
    for (const y of [y1, y2]) {
      g.fillStyle = silver(y, 16);
      g.fillRect(brace - 6, y - 8, L, 16);
    }
    g.strokeStyle = '#B4BEC5';
    g.lineWidth = 16;
    g.beginPath();
    g.arc(brace + L - 6, (y1 + y2) / 2, (y2 - y1) / 2, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    // where the slide joins the rest of the trombone
    g.fillStyle = '#E2B44A';
    rr(g, x0 - 2, y1 - 12, 14, y2 - y1 + 24, 5);
    g.fill();
    // position marks
    for (let p = 1; p <= 7; p++) {
      const x = slideU(p);
      const near = Math.abs(pos - p) < 0.25;
      g.fillStyle = near ? '#F6DB8C' : 'rgba(246,241,228,.35)';
      g.beginPath(); g.arc(x, A.y + A.h * 0.72, near ? 7 : 5, 0, 7); g.fill();
      label(g, s, String(p), x, A.y + A.h * 0.8, { size: 15, color: near ? '#F6DB8C' : 'rgba(246,241,228,.5)' });
    }
    // the brace you hold
    g.save();
    g.shadowColor = 'rgba(0,0,0,.5)';
    g.shadowBlur = 12;
    g.fillStyle = '#E2B44A';
    rr(g, brace - 12, y1 - 18, 24, y2 - y1 + 36, 10);
    g.fill();
    g.restore();
    g.fillStyle = '#F6DB8C';
    rr(g, brace - 6, y1 - 10, 12, y2 - y1 + 20, 6);
    g.fill();
  }

  // ---- computer keys ----
  function keydown(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const v = VALVE_KEYS.indexOf(k);
    if (!slide && v >= 0 && v < valves.length) { keysDown.add(v); down.add(v); update(); return; }
    if (slide && /^[1-7]$/.test(k)) { pos = Number(k); update(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      keyPartial = Math.max(0, Math.min(parts.length - 1, keyPartial + (e.key === 'ArrowUp' ? 1 : -1)));
      update();
      return;
    }
    if (k === ' ') { e.preventDefault(); spaceBlow = true; update(true); }
  }
  function keyup(e) {
    const k = e.key.toLowerCase();
    const v = VALVE_KEYS.indexOf(k);
    if (!slide && v >= 0) {
      keysDown.delete(v);
      if (![...valvePointers.values()].includes(v)) down.delete(v);
      update();
    }
    if (k === ' ') { spaceBlow = false; update(); }
  }
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);

  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    voice.stop(0.1);
    s.destroy();
  };
}
