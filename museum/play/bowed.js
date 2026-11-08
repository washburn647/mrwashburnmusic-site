/* Violin, viola, cello, double bass. Fingers press the strings on the fingerboard (left);
   there are no frets, so a finger can land anywhere and slide. The bow is on the right: touch a
   string there and move back and forth; faster bowing is louder. Between two strings, the bow
   plays both. Pizz plucks instead. On a computer, hold the mouse on the fingerboard and hold
   Space to bow that string. */

import { surface, rr } from '../surface.js';
import { pitched } from '../audio.js';

export async function mount(stage, ex, kit) {
  const o = ex.opts;
  const open = o.strings;
  const N = open.length;
  const span = o.span;
  const lo = open[0];
  const hi = open[N - 1] + span;
  const [arco, pizz] = await Promise.all([pitched(o.arco, lo, hi), pitched(o.pizz, lo, hi)]);
  const voices = open.map(() => arco.sustain({ attack: 0.07, release: 0.18, glide: 0.008 }));

  const box = document.createElement('div');
  box.className = 'zone bowed';
  stage.append(box);

  let mode = 'arco';
  const fingers = new Map();     // pointer id -> { string, u }
  const bows = new Map();        // pointer id -> { dist, last, strings: Set }
  const state = open.map(() => ({ level: 0, target: 0, on: false, pluck: 0, at: 0, pv: null }));
  let lastString = 0;
  let spaceBow = false;

  let G = null;
  function geom(s) {
    const nut = Math.max(20, s.W * 0.03);
    const fbEnd = s.W * 0.6;
    const top = s.H * 0.16;
    const bottom = s.H * 0.84;
    const gap = (bottom - top) / (N - 1);
    const bridge = s.W - Math.max(22, s.W * 0.04);
    const reach = 1 - 2 ** (-span / 12);
    const fracOf = (k) => (1 - 2 ** (-k / 12)) / reach;
    G = { nut, fbEnd, top, bottom, gap, bridge, fracOf, reach };
    return G;
  }
  const sv = (i) => G.top + i * G.gap;
  const semisAt = (u) => {
    const f = Math.max(0, Math.min(1, (u - G.nut) / (G.fbEnd - G.nut)));
    return -12 * Math.log2(1 - f * G.reach);
  };
  const uOf = (semis) => G.nut + G.fracOf(semis) * (G.fbEnd - G.nut);

  function stopped(i) {
    let best = null;
    for (const f of fingers.values()) if (f.string === i && (best == null || f.u > best)) best = f.u;
    return best;
  }
  const pitchOf = (i) => {
    const u = stopped(i);
    return open[i] + (u == null ? 0 : semisAt(u));
  };

  function retune(i) {
    const st = state[i];
    if (st.on) {
      const m = pitchOf(i);
      voices[i].pitch(m);
      kit.note(m);
    }
  }

  function stringsUnder(v) {
    const out = [];
    for (let i = 0; i < N; i++) if (Math.abs(v - sv(i)) < G.gap * 0.62) out.push(i);
    return out;
  }

  function pluck(i, vol = 0.75) {
    const m = pitchOf(i);
    pizz.play(m, { vol });
    state[i].pluck = 1;
    state[i].at = performance.now();
    state[i].pv = m;
    kit.note(m);
    s.animate(1200);
  }

  const s = surface(box, {
    label: ex.name,
    draw,
    down(p) {
      if (p.u < G.fbEnd) {
        const i = Math.round((p.v - G.top) / G.gap);
        if (i < 0 || i >= N || Math.abs(p.v - sv(i)) > G.gap * 0.6) return;
        fingers.set(p.id, { string: i, u: Math.max(G.nut, p.u) });
        lastString = i;
        retune(i);
        if (spaceBow) run();
        return;
      }
      if (mode === 'pizz') {
        p.data.pizz = true;
        const i = Math.round((p.v - G.top) / G.gap);
        if (i >= 0 && i < N && Math.abs(p.v - sv(i)) < G.gap * 0.35) { pluck(i); p.data.hit = i; }
        return;
      }
      bows.set(p.id, { dist: 0, strings: new Set(stringsUnder(p.v)), u: p.u, v: p.v });
      run();
    },
    move(p) {
      const f = fingers.get(p.id);
      if (f) {
        // A finger slides along its string; it can also roll onto the next string.
        const i = Math.round((p.v - G.top) / G.gap);
        const ni = i >= 0 && i < N && Math.abs(p.v - sv(i)) < G.gap * 0.42 ? i : f.string;
        const was = f.string;
        f.string = ni;
        f.u = Math.max(G.nut, Math.min(G.fbEnd, p.u));
        retune(ni);
        if (was !== ni) retune(was);
        return;
      }
      if (p.data.pizz) {
        for (let i = 0; i < N; i++) {
          const y = sv(i);
          if ((p.pv - y) * (p.v - y) < 0 && p.data.hit !== i) pluck(i, 0.7);
          if (p.data.hit === i && Math.abs(p.v - y) > G.gap * 0.35) p.data.hit = null;
        }
        return;
      }
      const b = bows.get(p.id);
      if (!b) return;
      b.dist += Math.hypot(p.u - b.u, p.v - b.v);
      b.u = p.u;
      b.v = p.v;
      b.strings = new Set(stringsUnder(p.v));
    },
    up(p) {
      const f = fingers.get(p.id);
      fingers.delete(p.id);
      if (f) retune(f.string);
      bows.delete(p.id);
    },
  });
  s.onresize = geom;
  geom(s);

  // The bow: every frame, how far it moved sets how loud each string it touches sounds.
  let raf = 0;
  let lastT = 0;
  function tick(t = performance.now()) {
    const dt = Math.max(8, t - (lastT || t - 16));
    lastT = t;
    for (const st of state) st.target = 0;
    for (const b of bows.values()) {
      const speed = b.dist / dt;           // px per ms
      b.dist = 0;
      const lvl = Math.min(1, (speed / 1.1) ** 0.7);
      for (const i of b.strings) state[i].target = Math.max(state[i].target, lvl);
    }
    if (spaceBow) state[keyString()].target = Math.max(state[keyString()].target, 0.7);
    let busy = bows.size > 0 || spaceBow;
    state.forEach((st, i) => {
      // Bow speed changes smoothly; a stopped bow fades quickly.
      const k = st.target > st.level ? 0.35 : 0.18;
      st.level += (st.target - st.level) * k;
      if (st.level > 0.035 && !st.on) {
        st.on = true;
        voices[i].start(pitchOf(i), st.level * 0.9);
        kit.note(pitchOf(i));
      } else if (st.on && st.level <= 0.02) {
        st.on = false;
        voices[i].stop();
      } else if (st.on) {
        voices[i].level(st.level * 0.9, 0.05);
      }
      if (st.on) busy = true;
    });
    s.redraw();
    raf = busy ? requestAnimationFrame(tick) : 0;
    if (!busy) lastT = 0;
  }
  const keyString = () => {
    for (const f of fingers.values()) return f.string;
    return lastString;
  };
  function run() { if (!raf) raf = requestAnimationFrame(tick); }

  function draw(g, s) {
    geom(s);
    const now = performance.now();
    // body of the instrument under the bow
    const body = g.createLinearGradient(G.fbEnd, 0, s.W, 0);
    body.addColorStop(0, '#8A4B22');
    body.addColorStop(0.5, '#B8692F');
    body.addColorStop(1, '#9C5626');
    g.fillStyle = body;
    g.fillRect(G.fbEnd - 2, 0, s.W - G.fbEnd + 2, s.H);
    g.strokeStyle = 'rgba(60,25,8,.12)';
    for (let y = 4; y < s.H; y += 7) { g.beginPath(); g.moveTo(G.fbEnd, y); g.lineTo(s.W, y + 2); g.stroke(); }
    // f-holes, lying along the strings
    g.strokeStyle = '#26120A';
    g.fillStyle = '#26120A';
    g.lineWidth = 4;
    g.lineCap = 'round';
    const fx = G.fbEnd + (G.bridge - G.fbEnd) * 0.62;
    const fl = Math.min(70, (G.bridge - G.fbEnd) * 0.3);
    for (const [y, d] of [[G.top - G.gap * 0.5, 1], [G.bottom + G.gap * 0.5, -1]]) {
      g.beginPath();
      g.moveTo(fx - fl, y + 6 * d);
      g.bezierCurveTo(fx - fl / 3, y + 10 * d, fx + fl / 3, y - 10 * d, fx + fl, y - 6 * d);
      g.stroke();
      g.beginPath(); g.arc(fx - fl, y + 6 * d, 5, 0, 7); g.arc(fx + fl, y - 6 * d, 5, 0, 7); g.fill();
      g.beginPath(); g.moveTo(fx - 4, y - 8); g.lineTo(fx + 4, y + 8); g.lineWidth = 2; g.stroke(); g.lineWidth = 4;
    }
    // bridge
    g.fillStyle = '#E8D3AC';
    rr(g, G.bridge - 6, G.top - G.gap * 0.45, 12, G.bottom - G.top + G.gap * 0.9, 4);
    g.fill();

    // fingerboard
    g.fillStyle = '#171310';
    g.fillRect(0, 0, G.fbEnd, s.H);
    const fb = g.createLinearGradient(0, G.top - G.gap * 0.6, 0, G.bottom + G.gap * 0.6);
    fb.addColorStop(0, '#26201B'); fb.addColorStop(0.5, '#33291F'); fb.addColorStop(1, '#26201B');
    g.fillStyle = fb;
    rr(g, G.nut, G.top - G.gap * 0.6, G.fbEnd - G.nut + 30, G.bottom - G.top + G.gap * 1.2, 10);
    g.fill();
    // tapes, where beginners put their fingers
    g.fillStyle = 'rgba(246,241,228,.5)';
    for (const k of o.tapes) {
      const x = uOf(k);
      g.fillRect(x - 2, G.top - G.gap * 0.6, 4, G.bottom - G.top + G.gap * 1.2);
    }
    // nut
    g.fillStyle = '#ECE2CC';
    g.fillRect(G.nut - 8, G.top - G.gap * 0.6, 8, G.bottom - G.top + G.gap * 1.2);

    // strings
    for (let i = 0; i < N; i++) {
      const y = sv(i);
      const st = state[i];
      const u = stopped(i);
      const from = u == null ? G.nut : u;
      const w = 1.4 + (N - 1 - i) * 0.6;
      const pl = st.pluck * Math.exp(-(now - st.at) / 380);
      const amp = Math.max(st.on ? st.level : 0, pl);
      g.strokeStyle = i === N - 1 ? '#E8ECEF' : '#CBB98E';
      g.lineWidth = w;
      g.beginPath(); g.moveTo(G.nut - 8, y); g.lineTo(from, y); g.stroke();
      if (amp > 0.02) {
        g.save();
        g.strokeStyle = 'rgba(255,240,200,.95)';
        g.shadowColor = 'rgba(255,214,140,.8)';
        g.shadowBlur = 10 * amp;
        g.beginPath();
        for (let x = from; x <= G.bridge; x += 5) {
          const env = Math.sin(((x - from) / (G.bridge - from)) * Math.PI);
          const dy = Math.sin(now / 7 + x / 9 + i) * amp * env * Math.min(G.gap * 0.18, 7);
          x === from ? g.moveTo(x, y + dy) : g.lineTo(x, y + dy);
        }
        g.stroke();
        g.restore();
      } else {
        g.beginPath(); g.moveTo(from, y); g.lineTo(G.bridge, y); g.stroke();
      }
    }
    // fingertips
    for (const f of fingers.values()) {
      const y = sv(f.string);
      g.save();
      g.fillStyle = 'rgba(232,184,90,.9)';
      g.shadowColor = 'rgba(0,0,0,.45)';
      g.shadowBlur = 8;
      g.beginPath(); g.ellipse(f.u, y, Math.min(16, G.gap * 0.3), Math.min(20, G.gap * 0.36), 0, 0, 7); g.fill();
      g.restore();
    }

    // the bow
    if (mode === 'arco') {
      const b = [...bows.values()][0];
      const x = b ? b.u : G.fbEnd + (G.bridge - G.fbEnd) * 0.36;
      const yc = b ? b.v : (G.top + G.bottom) / 2;
      const len = G.bottom - G.top + G.gap * 1.3;
      g.save();
      g.globalAlpha = b ? 1 : 0.45;
      g.translate(x, yc);
      g.rotate(-0.06);
      // stick
      g.strokeStyle = '#5B2A12';
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(12, -len / 2); g.quadraticCurveTo(4, 0, 12, len / 2); g.stroke();
      // hair
      g.strokeStyle = '#F4EEDC';
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, -len / 2 + 10); g.lineTo(0, len / 2 - 22); g.stroke();
      // frog
      g.fillStyle = '#1C1612';
      rr(g, -6, len / 2 - 26, 22, 26, 5); g.fill();
      g.fillStyle = '#E6EBEE';
      g.beginPath(); g.arc(5, len / 2 - 12, 3.5, 0, 7); g.fill();
      g.restore();
    }
  }

  kit.choice({
    label: 'Bow or pluck',
    value: 'arco',
    options: [{ value: 'arco', label: 'Arco' }, { value: 'pizz', label: 'Pizz' }],
    onChange(v) {
      mode = v;
      bows.clear();
      s.redraw();
    },
  });

  function keydown(e) {
    if (e.key !== ' ' || e.repeat) return;
    e.preventDefault();
    if (mode === 'pizz') { pluck(keyString()); return; }
    spaceBow = true;
    run();
  }
  function keyup(e) {
    if (e.key !== ' ') return;
    spaceBow = false;
  }
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);

  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    cancelAnimationFrame(raf);
    voices.forEach((v) => v.stop(0.1));
    s.destroy();
  };
}
