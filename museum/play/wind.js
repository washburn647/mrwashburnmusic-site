/* Flute, clarinet, oboe, saxophone. The keys sit where the fingers go on the real instrument:
   left hand nearer the mouthpiece, right hand farther down, thumbs underneath. Hold the
   mouthpiece to blow (the lock keeps the air going). Change fingers while blowing to slur.
   On the flute, blowing higher on the lip plate overblows to the next octave; the clarinet's
   register key jumps a twelfth; the sax and oboe have an octave key.
   On a computer: F D S A are the left hand's fingers and pinky, J K L ; the right hand's,
   V the thumb key, B the clarinet's register key, Space blows, Shift overblows the flute.
   A click on a key presses it until the next click. */

import { surface, rr, label, fine } from '../surface.js';
import { pitched } from '../audio.js';

/* Keys: id, where along the body (0 mouthpiece end .. 1 bell), side (-1 above, 0 on, 1 below),
   size (1 = a finger hole), computer key. */
const KEYSETS = {
  flute: [
    ['T', 0.31, 1, 0.8, 'v'],
    ['L1', 0.33, 0, 1, 'f'], ['L2', 0.42, 0, 1, 'd'], ['L3', 0.51, 0, 1, 's'], ['Lp', 0.56, -1, 0.6, 'a'],
    ['R1', 0.65, 0, 1, 'j'], ['R2', 0.74, 0, 1, 'k'], ['R3', 0.83, 0, 1, 'l'], ['Rp', 0.9, -1, 0.6, ';'],
  ],
  clarinet: [
    ['Rg', 0.25, 1, 0.55, 'b'], ['T', 0.32, 1, 0.8, 'v'], ['A', 0.27, -1, 0.55, 'r'], ['Gs', 0.33, -1, 0.5, 'e'],
    ['L1', 0.36, 0, 1, 'f'], ['L2', 0.45, 0, 1, 'd'], ['L3', 0.54, 0, 1, 's'], ['Lp', 0.6, 1, 0.6, 'a'],
    ['R1', 0.67, 0, 1, 'j'], ['R2', 0.76, 0, 1, 'k'], ['R3', 0.85, 0, 1, 'l'], ['Rp', 0.92, 1, 0.6, ';'],
  ],
  sax: [
    ['Oct', 0.28, 1, 0.6, 'v'],
    ['L1', 0.33, 0, 1, 'f'], ['L2', 0.42, 0, 1, 'd'], ['L3', 0.51, 0, 1, 's'], ['Lp', 0.56, -1, 0.6, 'a'],
    ['R1', 0.65, 0, 1, 'j'], ['R2', 0.74, 0, 1, 'k'], ['R3', 0.83, 0, 1, 'l'], ['Eb', 0.9, 1, 0.6, ';'], ['C', 0.9, -1, 0.6, '\''],
  ],
};
KEYSETS.oboe = KEYSETS.sax;

/* Fingerings: keys pressed -> written note. */
const F = (list) => list.map(([k, m]) => [new Set(k.split(' ').filter(Boolean)), m]);
const FINGERINGS = {
  flute: F([
    ['T L1 L2 L3 R1 R2 R3', 62], ['T L1 L2 L3 R1 R2 R3 Rp', 63], ['T L1 L2 L3 R1 R2 Rp', 64], ['T L1 L2 L3 R1 Rp', 65],
    ['T L1 L2 L3 R3 Rp', 66], ['T L1 L2 L3 Rp', 67], ['T L1 L2 L3 Lp Rp', 68], ['T L1 L2 Rp', 69], ['T L1 R1 Rp', 70],
    ['T L1 Rp', 71], ['L1 Rp', 72], ['Rp', 73], ['', 73], ['T L2 L3 R1 R2 R3', 74], ['T L2 L3 R1 R2 R3 Rp', 75],
  ]),
  clarinet: F([
    ['T L1 L2 L3 R1 R2 R3 Lp', 52], ['T L1 L2 L3 R1 R2 R3 Rp', 53], ['T L1 L2 L3 R1 R2 R3', 55], ['T L1 L2 L3 R1 R2', 57],
    ['T L1 L2 L3 R1', 58], ['T L1 L2 L3 R2', 59], ['T L1 L2 L3', 60], ['T L1 L2', 62], ['T L1', 64], ['T', 65],
    ['L1', 66], ['', 67], ['Gs', 68], ['A', 69], ['A Rg', 70], ['Rg', 70],
  ]),
  sax: F([
    ['L1 L2 L3 R1 R2 R3 C', 60], ['L1 L2 L3 R1 R2 R3', 62], ['L1 L2 L3 R1 R2 R3 Eb', 63], ['L1 L2 L3 R1 R2', 64],
    ['L1 L2 L3 R1', 65], ['L1 L2 L3 R2', 66], ['L1 L2 L3', 67], ['L1 L2 L3 Lp', 68], ['L1 L2', 69], ['L1 R1', 70],
    ['L1', 71], ['L2', 72], ['', 73],
  ]),
};
FINGERINGS.oboe = FINGERINGS.sax;
const MAIN = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'];
const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/* The written note a set of keys plays, and with how much air. */
function writtenNote(kind, keys, high) {
  const table = FINGERINGS[kind];
  const find = (set) => table.find(([k]) => same(k, set))?.[1];
  if (kind === 'clarinet') {
    const reg = keys.has('Rg');
    const base = new Set([...keys].filter((k) => k !== 'Rg'));
    if (reg && (keys.has('A') || base.size === 0)) return 70;
    let m = find(base);
    if (m == null) {
      // Otherwise the first open hole from the top decides, as on a recorder.
      const order = ['T', ...MAIN];
      let n = 0;
      while (n < order.length && keys.has(order[n])) n++;
      m = [67, 65, 64, 62, 60, 58, 57, 55][n];
      if (!keys.has('T') && keys.has('L1')) m = 66;
    }
    return reg ? m + 19 : m;
  }
  const oct = kind === 'flute' ? high : keys.has('Oct');
  const base = new Set([...keys].filter((k) => k !== 'Oct'));
  let m = find(base);
  if (m == null && kind === 'flute') {
    const no = new Set([...base].filter((k) => k !== 'Rp'));
    m = find(no) ?? find(new Set([...no, 'Rp']));
  }
  if (m == null) {
    let n = 0;
    while (n < MAIN.length && base.has(MAIN[n])) n++;
    m = [73, 71, 69, 67, 65, 64, 62][n];
    if (kind === 'flute' && !base.has('T') && n >= 1) m += 1;
  }
  return oct ? m + 12 : m;
}

const LOOKS = {
  flute: { body: ['#F4F7F9', '#C9D1D6', '#7D888F'], key: 'cup', thick: 0.12 },
  clarinet: { body: ['#3A3634', '#1D1A18', '#0E0C0B'], key: 'ring', thick: 0.15 },
  oboe: { body: ['#3A3634', '#1D1A18', '#0E0C0B'], key: 'plate', thick: 0.12 },
  sax: { body: ['#F6DB8C', '#E2B44A', '#A97B1F'], key: 'pearl', thick: 0.2 },
};

export async function mount(stage, ex, kit) {
  const kind = ex.opts.kind;
  const written = ex.written || 0;
  const keyset = KEYSETS[kind];
  const look = LOOKS[kind];
  const range = ex.range;
  const inst = await pitched(ex.opts.sound, range[0] - 2, range[1] + 2);
  const voice = inst.sustain({ attack: kind === 'flute' ? 0.06 : 0.035, release: 0.09, glide: 0.006 });

  const box = document.createElement('div');
  box.className = 'zone wind';
  stage.append(box);

  const pressed = new Map();     // key id -> Set of holders (pointer ids, 'mouse', computer keys)
  const pointerKey = new Map();
  const isDown = (k) => (pressed.get(k)?.size || 0) > 0;
  const press = (k, by) => { if (!pressed.has(k)) pressed.set(k, new Set()); pressed.get(k).add(by); };
  const release = (k, by) => pressed.get(k)?.delete(by);

  let breath = null;             // { id, high }
  let locked = false;
  let spaceBlow = false;
  let shiftHigh = false;
  let sounding = false;
  let lockHigh = false;

  let G = null;
  function geom(s) {
    const pad = Math.min(s.W * 0.17, 200);
    const cy = s.H * 0.48;
    const end = s.W - 14;
    const bodyX = pad + 10;
    const len = end - bodyX;
    const r = Math.min(len * 0.09 * 0.45, s.H * 0.12, 52);
    const th = Math.min(Math.max(s.H * look.thick * 1.6, r * 2.3), 140);
    G = { pad, cy, th, bodyX, len, end, r };
    return G;
  }
  const keyPos = ([, at, side, size]) => {
    const r = G.r * size;
    const u = G.bodyX + (at - 0.05) * G.len * 1.04;
    const v = G.cy + side * (G.th / 2 + r * 1.25);
    return { u, v, r };
  };
  const lockBox = () => ({ u: G.pad / 2, v: G.cy + G.th / 2 + 58, r: 22 });

  function blowing() { return !!breath || locked || spaceBlow; }
  const high = () => (breath ? breath.high : locked ? lockHigh : shiftHigh);

  function keysNow() {
    const out = new Set();
    for (const [k] of keyset) if (isDown(k)) out.add(k);
    return out;
  }

  function update(attack = false) {
    if (!blowing()) {
      if (sounding) { voice.stop(); sounding = false; }
      kit.note(null);
      s.redraw();
      return;
    }
    const w = writtenNote(kind, keysNow(), high());
    const midi = Math.max(range[0], Math.min(range[1], w - written));
    if (!sounding || attack) { voice.start(midi, 0.8); sounding = true; }
    else voice.pitch(midi);
    kit.note(midi);
    s.redraw();
  }

  function hitKey(u, v) {
    let best = null;
    let bd = Infinity;
    for (const k of keyset) {
      const p = keyPos(k);
      const d = Math.hypot(u - p.u, v - p.v);
      const reach = Math.max(p.r * 1.25, 26);
      if (d < reach && d < bd) { best = k[0]; bd = d; }
    }
    return best;
  }

  const s = surface(box, {
    label: ex.name,
    draw,
    down(p) {
      const lb = lockBox();
      if (Math.hypot(p.u - lb.u, p.v - lb.v) < lb.r + 10) {
        locked = !locked;
        lockHigh = breath ? breath.high : false;
        update(locked);
        return;
      }
      if (p.u < G.pad) {
        breath = { id: p.id, high: kind === 'flute' && p.v < G.cy };
        if (locked) lockHigh = breath.high;
        update(true);
        return;
      }
      const k = hitKey(p.u, p.v);
      if (!k) return;
      if (p.type === 'mouse') {
        if (pressed.get(k)?.has('mouse')) release(k, 'mouse');
        else press(k, 'mouse');
      } else {
        press(k, p.id);
        pointerKey.set(p.id, k);
      }
      update();
    },
    move(p) {
      if (breath && breath.id === p.id && kind === 'flute') {
        const h = p.v < G.cy;
        if (h !== breath.high) { breath.high = h; if (locked) lockHigh = h; update(); }
      }
    },
    up(p) {
      if (breath && breath.id === p.id) { breath = null; update(); return; }
      const k = pointerKey.get(p.id);
      if (k) { pointerKey.delete(p.id); release(k, p.id); update(); }
    },
  });
  s.onresize = geom;
  geom(s);

  function draw(g, s) {
    geom(s);
    g.fillStyle = '#16211B';
    g.fillRect(0, 0, s.W, s.H);
    const { cy, th, bodyX, end } = G;

    // mouthpiece / lip plate: the place to blow
    const on = blowing();
    const pg = g.createLinearGradient(0, cy - th, 0, cy + th);
    if (kind === 'flute') {
      // two halves: gentle air (low) and fast air (high)
      g.fillStyle = on && high() ? 'rgba(246,219,140,.28)' : 'rgba(255,255,255,.05)';
      rr(g, 8, 10, G.pad - 16, cy - 14, 18); g.fill();
      g.fillStyle = on && !high() ? 'rgba(246,219,140,.28)' : 'rgba(255,255,255,.05)';
      rr(g, 8, cy + 4, G.pad - 16, s.H - cy - 14, 18); g.fill();
      pg.addColorStop(0, look.body[0]); pg.addColorStop(0.5, look.body[1]); pg.addColorStop(1, look.body[2]);
      g.fillStyle = pg;
      rr(g, G.pad * 0.2, cy - th / 2, bodyX - G.pad * 0.2 + 4, th, th / 2);
      g.fill();
      g.fillStyle = '#E9EEF1';
      g.beginPath(); g.ellipse(G.pad * 0.55, cy, G.pad * 0.36, th * 0.5, 0, 0, 7); g.fill();
      g.fillStyle = '#20262A';
      g.beginPath(); g.ellipse(G.pad * 0.55, cy, G.pad * 0.14, th * 0.17, 0, 0, 7); g.fill();
    } else {
      g.fillStyle = on ? 'rgba(246,219,140,.22)' : 'rgba(255,255,255,.05)';
      rr(g, 8, 10, G.pad - 16, s.H - 20, 18); g.fill();
      // mouthpiece and reed
      g.fillStyle = kind === 'sax' ? '#1D1A18' : '#141210';
      g.beginPath();
      g.moveTo(G.pad * 0.12, cy - th * 0.12);
      g.lineTo(bodyX, cy - th * 0.45);
      g.lineTo(bodyX, cy + th * 0.45);
      g.lineTo(G.pad * 0.12, cy + th * 0.2);
      g.closePath();
      g.fill();
      if (kind !== 'oboe') {
        g.fillStyle = '#D8B878';
        g.fillRect(G.pad * 0.14, cy + th * 0.18, bodyX - G.pad * 0.3, th * 0.12);
      } else {
        g.fillStyle = '#C79A64';
        g.fillRect(G.pad * 0.05, cy - th * 0.08, G.pad * 0.4, th * 0.16);
      }
      g.fillStyle = '#C9D1D6';
      g.fillRect(bodyX - G.pad * 0.28, cy - th * 0.42, 8, th * 0.84);
    }
    // air
    if (on) {
      g.save();
      g.strokeStyle = 'rgba(246,241,228,.35)';
      g.lineWidth = 2;
      const t = performance.now() / 300;
      for (let k = 0; k < 3; k++) {
        const y = cy + (k - 1) * 10;
        g.beginPath();
        for (let x = 8; x < G.pad * 0.5; x += 4) g.lineTo(x, y + Math.sin(x / 8 - t * 3 + k) * 3);
        g.stroke();
      }
      g.restore();
      s.animate(80);
    }
    // the lock
    const lb = lockBox();
    g.fillStyle = locked ? '#E2B44A' : 'rgba(255,255,255,.1)';
    g.beginPath(); g.arc(lb.u, lb.v, lb.r, 0, 7); g.fill();
    g.strokeStyle = locked ? '#2A1B05' : 'rgba(246,241,228,.75)';
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 2.6;
    rr(g, lb.u - 8, lb.v - 2, 16, 12, 3); g.fill();
    g.beginPath();
    if (locked) g.arc(lb.u, lb.v - 3, 5.5, Math.PI, 0);
    else g.arc(lb.u + 6, lb.v - 5, 5.5, Math.PI * 1.1, 0.1);
    g.stroke();

    // body
    const bg = g.createLinearGradient(0, cy - th / 2, 0, cy + th / 2);
    bg.addColorStop(0, look.body[0]); bg.addColorStop(0.45, look.body[1]); bg.addColorStop(1, look.body[2]);
    g.fillStyle = bg;
    if (kind === 'sax') {
      // a conical brass body that widens to the bell
      g.beginPath();
      g.moveTo(bodyX, cy - th * 0.35);
      g.lineTo(end - 40, cy - th * 0.55);
      g.quadraticCurveTo(end, cy - th * 0.6, end, cy - th * 1.1);
      g.lineTo(end, cy + th * 0.8);
      g.quadraticCurveTo(end - 10, cy + th * 0.55, end - 40, cy + th * 0.55);
      g.lineTo(bodyX, cy + th * 0.35);
      g.closePath();
      g.fill();
    } else {
      g.fillRect(bodyX, cy - th / 2, end - bodyX - 30, th);
      // bell (not on the flute)
      if (kind !== 'flute') {
        g.beginPath();
        g.moveTo(end - 32, cy - th / 2);
        g.quadraticCurveTo(end - 8, cy - th / 2, end, cy - th * 0.95);
        g.lineTo(end, cy + th * 0.95);
        g.quadraticCurveTo(end - 8, cy + th / 2, end - 32, cy + th / 2);
        g.fill();
      } else {
        g.fillRect(end - 32, cy - th / 2, 32, th);
      }
    }
    // joint rings
    g.fillStyle = kind === 'sax' ? 'rgba(120,80,20,.5)' : '#C9D1D6';
    for (const at of [0.59]) g.fillRect(G.bodyX + at * G.len - 4, cy - th / 2, 8, th);
    // rods
    g.strokeStyle = kind === 'sax' ? '#A97B1F' : '#B7C0C6';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(keyPos(keyset.find((k) => k[0] === 'L1')).u, cy - th * 0.38); g.lineTo(keyPos(keyset.find((k) => k[0] === 'R3')).u, cy - th * 0.38); g.stroke();

    // keys
    const keysShown = fine();
    for (const k of keyset) {
      const p = keyPos(k);
      const dn = isDown(k[0]);
      drawKey(g, p, dn, k[2] === 0);
      if (keysShown) label(g, s, k[4].toUpperCase(), p.u, p.v, { size: 12, color: dn ? 'rgba(40,25,5,.7)' : 'rgba(255,255,255,.55)' });
    }
  }

  function drawKey(g, { u, v, r }, dn, hole) {
    g.save();
    if (!dn) { g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 10; g.shadowOffsetY = 4; }
    if (look.key === 'ring' && hole) {
      // an open tone hole with a metal ring: you see into it until a finger covers it
      g.fillStyle = dn ? '#E8B85A' : '#0B0908';
      g.beginPath(); g.arc(u, v, r * 0.78, 0, 7); g.fill();
      g.restore();
      g.strokeStyle = '#C9D1D6';
      g.lineWidth = Math.max(3, r * 0.16);
      g.beginPath(); g.arc(u, v, r * 0.82, 0, 7); g.stroke();
      return;
    }
    const kg = g.createRadialGradient(u - r * 0.3, v - r * 0.3, r * 0.1, u, v, r);
    if (look.key === 'pearl') {
      kg.addColorStop(0, '#FFFFFF'); kg.addColorStop(0.6, dn ? '#F2D79A' : '#EAE4F2'); kg.addColorStop(1, dn ? '#C9963A' : '#B7AFC4');
    } else {
      kg.addColorStop(0, '#FFFFFF'); kg.addColorStop(0.6, dn ? '#F2D79A' : '#D9E0E4'); kg.addColorStop(1, dn ? '#C9963A' : '#8D99A3');
    }
    g.fillStyle = kg;
    g.beginPath(); g.arc(u, v, r * (dn ? 0.86 : 0.9), 0, 7); g.fill();
    g.restore();
    if (look.key === 'cup' && hole) {
      // open-hole flute keys have a small hole in the middle
      g.fillStyle = dn ? '#B8873A' : '#4A5258';
      g.beginPath(); g.arc(u, v, r * 0.24, 0, 7); g.fill();
    }
    if (dn) {
      g.strokeStyle = '#FFF3D0';
      g.lineWidth = 2;
      g.beginPath(); g.arc(u, v, r * 0.9, 0, 7); g.stroke();
    }
  }

  // ---- computer keys ----
  function keydown(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Shift') { shiftHigh = true; update(); return; }
    if (e.key === ' ') { e.preventDefault(); spaceBlow = true; update(true); return; }
    const k = keyset.find((x) => x[4] === e.key.toLowerCase());
    if (k) { press(k[0], `key:${k[0]}`); update(); }
  }
  function keyup(e) {
    if (e.key === 'Shift') { shiftHigh = false; update(); return; }
    if (e.key === ' ') { spaceBlow = false; update(); return; }
    const k = keyset.find((x) => x[4] === e.key.toLowerCase());
    if (k) { release(k[0], `key:${k[0]}`); update(); }
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

export { writtenNote };
