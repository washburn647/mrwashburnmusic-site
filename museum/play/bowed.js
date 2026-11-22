/* Violin, viola, cello, double bass. Fingers press the strings on the fingerboard (left);
   there are no frets, so a finger can land anywhere and slide. The bow is on the right: touch a
   string there and move back and forth; faster bowing is louder. Between two strings, the bow
   plays both. Pizz plucks instead. On a computer, hold the mouse on the fingerboard and hold
   Space to bow that string.

   The view is close up, along the strings: the scroll and pegbox (a bass has metal tuning
   machines), the ebony fingerboard, narrower at the nut, where the strings are closer
   together, then the varnished spruce top with its shoulders, purfling and f-holes, rosin dust
   under the bow, the maple bridge and the tailpiece with its fine tuners. A bowed string blurs
   as it vibrates. */

import { surface, rr } from '../surface.js';
import { pitched } from '../audio.js';
import { wood, metal, string, pool, layer, put, rand, pin } from '../paint.js';

// What each instrument looks like: its varnish, its strings (lowest first: colour, whether wound,
// how thick, the silk wound round its end), its shoulders, and how it is tuned.
const LOOKS = {
  violin: { varnish: 'varnish', strings: ['#B5BBC1', '#C3C8CD', '#D3D7DB', '#EEF1F3'], wound: [1, 1, 1, 0], width: [2.2, 1.9, 1.6, 1.15], silk: ['#3E7A4E', '#C9A23A', '#B4423A', '#6E5AA0'], shoulder: 0.05, tuners: true },
  viola: { varnish: 'redvarnish', strings: ['#9EA5AC', '#B5BBC1', '#C8CDD2', '#E6EAED'], wound: [1, 1, 1, 0], width: [2.5, 2.1, 1.8, 1.4], silk: ['#C9A23A', '#3E7A4E', '#B4423A', '#4B6CA0'], shoulder: 0.06, tuners: true },
  cello: { varnish: 'oldvarnish', strings: ['#8C939A', '#9AA1A8', '#C9CED3', '#E2E6E9'], wound: [1, 1, 0, 0], width: [3.4, 2.8, 2.2, 1.8], silk: ['#B4423A', '#B4423A', '#C9A23A', '#C9A23A'], shoulder: 0.07, tuners: true },
  bass: { varnish: 'darkvarnish', strings: ['#8E959C', '#979EA5', '#A3AAB0', '#B0B6BC'], wound: [1, 1, 1, 1], width: [5, 4.2, 3.5, 2.8], silk: ['#2B2B2B', '#2B2B2B', '#2B2B2B', '#2B2B2B'], shoulder: 0.2, machines: true },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export async function mount(stage, ex, kit) {
  const o = ex.opts;
  const open = o.strings;
  const N = open.length;
  const span = o.span;
  const lo = open[0];
  const hi = open[N - 1] + span;
  const [arco, pizz] = await Promise.all([pitched(o.arco, lo, hi), pitched(o.pizz, lo, hi)]);
  const voices = open.map(() => arco.sustain({ attack: 0.07, release: 0.18, glide: 0.008, vibrato: o.vibrato }));

  const box = document.createElement('div');
  box.className = 'zone bowed';
  stage.append(box);

  let mode = 'arco';
  const fingers = new Map();     // pointer id -> { string, u }
  const bows = new Map();        // pointer id -> { dist, last, strings: Set }
  const state = open.map(() => ({ level: 0, target: 0, on: false, pluck: 0, at: 0, pv: null }));
  let lastString = 0;
  let spaceBow = false;
  const autoBow = new Map();     // string -> level, while the instrument plays a tune itself

  const look = LOOKS[ex.id] || LOOKS.violin;
  let G = null;
  function geom(s) {
    const nut = Math.max(44, s.W * 0.075);     // the pegbox and the scroll lie beyond it
    const fbEnd = s.W * 0.6;
    const bridge = s.W * 0.875;
    const mid = s.H / 2;
    const spread = s.H * 0.68;                  // across the strings, at the bridge
    const reach = 1 - 2 ** (-span / 12);
    const fracOf = (k) => (1 - 2 ** (-k / 12)) / reach;
    // the strings are closer together at the nut, as the fingerboard narrows
    G = { nut, fbEnd, bridge, mid, spread, fracOf, reach, taper: 0.6, H: s.H, W: s.W };
    return G;
  }
  // How far apart the strings are at u, and where string i is there.
  const gapAt = (u) => (G.spread / (N - 1)) * (G.taper + (1 - G.taper) * clamp((u - G.nut) / (G.bridge - G.nut), 0, 1));
  const sv = (i, u) => G.mid + (i - (N - 1) / 2) * gapAt(u);
  // The string at (u, v), if one is within `within` of a gap of it.
  const stringAt = (u, v, within) => {
    const i = Math.round((v - G.mid) / gapAt(u) + (N - 1) / 2);
    return i >= 0 && i < N && Math.abs(v - sv(i, u)) <= gapAt(u) * within ? i : -1;
  };
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

  function stringsUnder(u, v) {
    const out = [];
    for (let i = 0; i < N; i++) if (Math.abs(v - sv(i, u)) < gapAt(u) * 0.62) out.push(i);
    return out;
  }

  function pluck(i, vol = 0.75) {
    const m = pitchOf(i);
    pizz.play(m, { vol });
    state[i].pluck = 1;
    state[i].at = performance.now();
    state[i].pv = m;
    kit.note(m, 'fresh');
    s.animate(1200);
  }

  const s = surface(box, {
    label: ex.name,
    draw,
    down(p) {
      if (p.u < G.fbEnd) {
        const i = stringAt(Math.max(G.nut, p.u), p.v, 0.6);
        if (i < 0) return;
        fingers.set(p.id, { string: i, u: Math.max(G.nut, p.u) });
        lastString = i;
        retune(i);
        if (spaceBow) run();
        return;
      }
      if (mode === 'pizz') {
        p.data.pizz = true;
        const i = stringAt(p.u, p.v, 0.35);
        if (i >= 0) { pluck(i); p.data.hit = i; }
        return;
      }
      bows.set(p.id, { dist: 0, strings: new Set(stringsUnder(p.u, p.v)), u: p.u, v: p.v, dir: 0, run: 0 });
      run();
    },
    move(p) {
      const f = fingers.get(p.id);
      if (f) {
        // A finger slides along its string; it can also roll onto the next string.
        const i = stringAt(Math.max(G.nut, p.u), p.v, 0.42);
        const ni = i >= 0 ? i : f.string;
        const was = f.string;
        f.string = ni;
        f.u = Math.max(G.nut, Math.min(G.fbEnd, p.u));
        retune(ni);
        if (was !== ni) retune(was);
        return;
      }
      if (p.data.pizz) {
        for (let i = 0; i < N; i++) {
          const y = sv(i, p.u);
          if ((p.pv - y) * (p.v - y) < 0 && p.data.hit !== i) pluck(i, 0.7);
          if (p.data.hit === i && Math.abs(p.v - y) > gapAt(p.u) * 0.35) p.data.hit = null;
        }
        return;
      }
      const b = bows.get(p.id);
      if (!b) return;
      // Turning the bow round starts a new stroke: a new note, so a repeated note counts.
      const dir = Math.sign(p.u - b.u);
      if (dir && dir !== b.dir) {
        if (b.dir && b.run > gapAt(b.u) * 0.6) for (const i of b.strings) if (state[i].on) kit.note(pitchOf(i), 'fresh');
        b.dir = dir;
        b.run = 0;
      }
      b.run += Math.abs(p.u - b.u);
      b.dist += Math.hypot(p.u - b.u, p.v - b.v);
      b.u = p.u;
      b.v = p.v;
      b.strings = new Set(stringsUnder(p.u, p.v));
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
    for (const [i, lvl] of autoBow) state[i].target = Math.max(state[i].target, lvl);
    let busy = bows.size > 0 || spaceBow || autoBow.size > 0;
    state.forEach((st, i) => {
      // Bow speed changes smoothly; a stopped bow fades quickly (a player crossing strings, more so).
      const k = st.target > st.level ? (st.quick ? 0.6 : 0.35) : (st.quick ? 0.45 : 0.18);
      st.level += (st.target - st.level) * k;
      if (st.level > 0.035 && !st.on) {
        st.on = true;
        voices[i].start(pitchOf(i), st.level * 0.9);
        kit.note(pitchOf(i), 'fresh');
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
    put(g, s, layer(s, 'body', mode, (c) => paintBody(c, s)));
    // the strings, from the nut to the bridge; the part between the finger and the bridge rings
    for (let i = 0; i < N; i++) {
      const st = state[i];
      const u = stopped(i);
      const from = u == null ? G.nut : u;
      const pl = st.pluck * Math.exp(-(now - st.at) / 380);
      const amp = Math.max(st.on ? st.level : 0, pl);
      string(g, G.nut, sv(i, G.nut), G.bridge, sv(i, G.bridge), {
        width: look.width[i] * thick(),
        color: look.strings[i],
        wound: !!look.wound[i],
        amp: amp > 0.02 ? (0.3 + amp) * Math.min(gapAt(G.bridge) * 0.1, 8) : 0,
        glow: amp > 0.02 ? Math.min(1, amp * 1.5) : 0,
        t: now,
        freq: 1.4 + i * 0.3,
        from: (from - G.nut) / (G.bridge - G.nut),
        to: 1,
      });
    }
    // fingertips
    for (const f of fingers.values()) {
      const y = sv(f.string, f.u);
      const r = Math.min(18, gapAt(f.u) * 0.32);
      g.save();
      g.shadowColor = 'rgba(0,0,0,.5)';
      g.shadowBlur = 8;
      g.shadowOffsetX = 2;
      g.shadowOffsetY = 3;
      const fg = g.createRadialGradient(f.u - r * 0.3, y - r * 0.3, 1, f.u, y, r * 1.2);
      fg.addColorStop(0, 'rgba(255,226,160,.95)');
      fg.addColorStop(1, 'rgba(214,160,70,.92)');
      g.fillStyle = fg;
      g.beginPath();
      g.ellipse(f.u, y, r * 1.15, r, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    if (mode === 'arco') drawBow(g, s, now);
  }

  // Strings look thicker on a bigger screen, as they would closer up.
  const thick = () => clamp(G.H / 400, 1, 2);

  /* What doesn't move: the top and its shoulders, the f-holes, the bridge, the tailpiece, the
     fingerboard, the nut, the pegbox and the scroll; and the strings beyond the nut and the
     bridge, which don't ring. */
  function paintBody(c, s) {
    const { nut, fbEnd, bridge, mid, H, W } = G;
    c.fillStyle = '#15110E';
    c.fillRect(0, 0, W, H);
    pool(c, W * 0.6, mid, W * 0.6, '#3A2E25', 0.5, 0.8);
    // the top, from the shoulders (where the neck meets the body) to past the bridge
    const ub = nut + (bridge - nut) * 0.4;
    const fbHalf = (u) => (gapAt(u) * (N - 1)) / 2 + gapAt(u) * 0.48;
    const neck = fbHalf(ub) * 0.92;
    const fl = W * look.shoulder;
    const outline = () => {
      c.moveTo(W + 20, -20);
      c.lineTo(ub + fl + 6, -20);
      c.bezierCurveTo(ub + fl * 0.6, mid - neck - H * 0.2, ub + 2, mid - neck - H * 0.05, ub, mid - neck);
      c.lineTo(ub, mid + neck);
      c.bezierCurveTo(ub + 2, mid + neck + H * 0.05, ub + fl * 0.6, mid + neck + H * 0.2, ub + fl + 6, H + 20);
      c.lineTo(W + 20, H + 20);
      c.closePath();
    };
    const topWood = () => wood(c, look.varnish, { scale: 1.15, seed: 2 });
    c.save();
    c.beginPath();
    outline();
    c.shadowColor = 'rgba(0,0,0,.6)';
    c.shadowBlur = 18;
    c.fillStyle = topWood();
    c.fill();
    c.restore();
    c.save();
    c.beginPath();
    outline();
    c.clip();
    // the arching: light along the middle, shade toward the edges
    const arch = c.createLinearGradient(0, 0, 0, H);
    arch.addColorStop(0, 'rgba(0,0,0,.42)');
    arch.addColorStop(0.3, 'rgba(255,214,160,.06)');
    arch.addColorStop(0.42, 'rgba(255,226,180,.16)');
    arch.addColorStop(0.6, 'rgba(0,0,0,0)');
    arch.addColorStop(1, 'rgba(0,0,0,.45)');
    c.fillStyle = arch;
    c.fillRect(0, 0, W, H);
    // the purfling inlaid along the edge (black, white, black), then the edge itself
    c.beginPath();
    outline();
    for (const [w, st] of [[24, '#1A0C05'], [21, '#E6CDA0'], [18, '#1A0C05']]) {
      c.lineWidth = w;
      c.strokeStyle = st;
      c.stroke();
    }
    c.lineWidth = 15;
    c.strokeStyle = topWood();
    c.stroke();
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(255,220,170,.3)';
    c.stroke();
    // rosin dust, where the bow goes
    const r = rand(7);
    const dx0 = fbEnd + (bridge - fbEnd) * 0.18;
    const dx1 = bridge - 14;
    const dust = c.createLinearGradient(dx0, 0, dx1, 0);
    dust.addColorStop(0, 'rgba(255,250,240,0)');
    dust.addColorStop(0.5, 'rgba(255,250,240,.12)');
    dust.addColorStop(1, 'rgba(255,250,240,.04)');
    c.fillStyle = dust;
    c.fillRect(dx0, mid - G.spread * 0.55, dx1 - dx0, G.spread * 1.1);
    c.fillStyle = 'rgba(255,252,245,.5)';
    for (let k = 0; k < 260; k++) {
      const x = dx0 + (dx1 - dx0) * (0.3 + 0.7 * r());
      const y = mid + (r() - 0.5) * G.spread * 1.1;
      c.globalAlpha = r() * 0.5;
      c.fillRect(x, y, 1 + r(), 1 + r());
    }
    c.globalAlpha = 1;
    // the f-holes, either side of the bridge, their notches level with it
    const fLen = Math.min(W * 0.22, (W - bridge) * 2 - 16, H * 0.55);
    const fv = Math.min(H * 0.43, G.spread / 2 + gapAt(bridge) * 0.5);
    const fw = fLen * 0.075;
    for (const side of [-1, 1]) fHole(c, bridge, mid + side * fv, fLen, fw, side);
    c.restore();

    // the fingerboard: ebony, narrowing toward the nut, raised over the top
    const fbPath = () => {
      c.beginPath();
      c.moveTo(nut - 3, mid - fbHalf(nut));
      c.lineTo(fbEnd, mid - fbHalf(fbEnd));
      c.quadraticCurveTo(fbEnd + 10, mid, fbEnd, mid + fbHalf(fbEnd));
      c.lineTo(nut - 3, mid + fbHalf(nut));
      c.closePath();
    };
    c.save();
    fbPath();
    c.shadowColor = 'rgba(0,0,0,.6)';
    c.shadowBlur = 14;
    c.shadowOffsetX = 3;
    c.shadowOffsetY = 6;
    c.fillStyle = wood(c, 'ebony', { scale: 0.9 });
    c.fill();
    c.restore();
    c.save();
    fbPath();
    c.clip();
    const cam = c.createLinearGradient(0, mid - fbHalf(fbEnd), 0, mid + fbHalf(fbEnd));
    cam.addColorStop(0, 'rgba(0,0,0,.35)');
    cam.addColorStop(0.35, 'rgba(255,255,255,.07)');
    cam.addColorStop(0.5, 'rgba(255,255,255,.03)');
    cam.addColorStop(1, 'rgba(0,0,0,.4)');
    c.fillStyle = cam;
    c.fillRect(nut - 4, 0, fbEnd - nut + 14, H);
    // tapes, where beginners put their fingers
    for (const k of o.tapes) {
      const x = uOf(k);
      c.fillStyle = 'rgba(250,246,236,.82)';
      c.fillRect(x - 2.5, 0, 5, H);
      c.fillStyle = 'rgba(0,0,0,.18)';
      c.fillRect(x + 2.5, 0, 1, H);
    }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,.08)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(nut, mid - fbHalf(nut) + 1);
    c.lineTo(fbEnd, mid - fbHalf(fbEnd) + 1);
    c.stroke();

    // the bridge: maple, flecked, standing on its feet, the strings in its notches
    const bw = clamp(W * 0.009, 5, 12);
    const bh = G.spread / 2 + gapAt(bridge) * 0.4;
    c.fillStyle = 'rgba(0,0,0,.45)';
    rr(c, bridge - bw / 2 + 4, mid - bh, bw + 2, bh * 2, 3);
    c.fill();
    c.fillStyle = (() => {
      const bg = c.createLinearGradient(bridge - bw / 2, 0, bridge + bw / 2, 0);
      bg.addColorStop(0, '#C9A46E');
      bg.addColorStop(0.4, '#F1DDB4');
      bg.addColorStop(1, '#B48C58');
      return bg;
    })();
    rr(c, bridge - bw / 2, mid - bh, bw, bh * 2, 2.5);
    c.fill();
    // its feet
    for (const side of [-1, 1]) {
      c.fillStyle = '#D9BC8A';
      rr(c, bridge - bw * 0.9, mid + side * bh - (side > 0 ? bw * 0.9 : 0), bw * 1.8, bw * 0.9, 2);
      c.fill();
    }
    const fr = rand(3);
    c.fillStyle = 'rgba(150,100,50,.35)';
    for (let k = 0; k < 18; k++) c.fillRect(bridge - bw / 2 + fr() * bw, mid - bh + fr() * bh * 2, 1.2, 2 + fr() * 3);

    // past the bridge: the strings to the tailpiece, and its fine tuners
    const tp = bridge + (W - bridge) * 0.5;
    const tw = (i) => mid + (i - (N - 1) / 2) * gapAt(G.bridge) * 0.7;
    c.save();
    c.beginPath();
    c.moveTo(tp, tw(0) - gapAt(bridge) * 0.45);
    c.lineTo(W + 10, mid - gapAt(bridge) * 0.9);
    c.lineTo(W + 10, mid + gapAt(bridge) * 0.9);
    c.lineTo(tp, tw(N - 1) + gapAt(bridge) * 0.45);
    c.quadraticCurveTo(tp - 8, mid, tp, tw(0) - gapAt(bridge) * 0.45);
    c.shadowColor = 'rgba(0,0,0,.55)';
    c.shadowBlur = 10;
    c.shadowOffsetX = 3;
    c.shadowOffsetY = 4;
    c.fillStyle = wood(c, 'ebony', { scale: 0.8, seed: 4 });
    c.fill();
    c.restore();
    for (let i = 0; i < N; i++) {
      const w = look.width[i] * thick();
      string(c, bridge, sv(i, bridge), tp + 12, tw(i), { width: w, color: look.strings[i], wound: !!look.wound[i] });
      if (look.tuners) {
        // a fine tuner: a little lever with a thumb screw
        const x = tp + 6;
        const y = tw(i);
        const tr = clamp(gapAt(bridge) * 0.13, 4, 9);
        c.fillStyle = metal(c, 'chrome', x - tr, y - tr, x + tr, y + tr);
        rr(c, x - tr * 0.6, y - tr * 0.55, tr * 2.6, tr * 1.1, tr * 0.4);
        c.fill();
        pin(c, x + tr * 2.4, y, tr * 0.75, 'chrome');
      } else {
        pin(c, tp + 10, tw(i), 2.5, 'nickel');
      }
    }

    // the nut, and beyond it the pegbox, the pegs (or a bass's machines) and the scroll
    const nh = fbHalf(nut);
    c.fillStyle = '#100C0A';
    c.fillRect(nut - 7, mid - nh, 7, nh * 2);
    c.fillStyle = 'rgba(255,255,255,.18)';
    c.fillRect(nut - 2.5, mid - nh, 1.5, nh * 2);
    pegbox(c, nh);
  }

  /* An f-hole, lying along the strings: a small eye toward the neck, a bigger one toward the
     tailpiece, a stem curving between them and two notches in its middle. */
  function fHole(c, u, v, len, w, side) {
    const pts = [];
    const n = 24;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = u - len / 2 + len * t;
      // the eye toward the neck sits nearer the strings than the one toward the tailpiece
      const y = v - side * len * 0.06 * Math.cos(Math.PI * t);
      const half = w * (0.25 + 0.75 * Math.pow(Math.sin(Math.PI * t), 1.4)) / 2;
      pts.push([x, y, half]);
    }
    c.save();
    c.beginPath();
    pts.forEach(([x, y, h], k) => (k ? c.lineTo(x, y - h) : c.moveTo(x, y - h)));
    for (let k = pts.length - 1; k >= 0; k--) c.lineTo(pts[k][0], pts[k][1] + pts[k][2]);
    c.closePath();
    const [ax, ay] = pts[0];
    const [bx, by] = pts[n];
    c.moveTo(ax + w * 0.55, ay);
    c.arc(ax, ay, w * 0.55, 0, Math.PI * 2);
    c.moveTo(bx + w * 0.7, by);
    c.arc(bx, by, w * 0.7, 0, Math.PI * 2);
    c.fillStyle = '#120804';
    c.fill('nonzero');
    // the cut edge shows paler wood
    c.strokeStyle = 'rgba(255,214,160,.28)';
    c.lineWidth = 1;
    c.stroke();
    // the notches
    const [mx, my, mh] = pts[n / 2];
    c.strokeStyle = '#120804';
    c.lineWidth = Math.max(1.2, w * 0.25);
    c.beginPath();
    c.moveTo(mx, my - mh - w * 0.7);
    c.lineTo(mx, my + mh + w * 0.7);
    c.stroke();
    c.restore();
  }

  /* The pegbox: the strings go into it and wind round the pegs, whose heads stick out of its
     sides, alternately; then the scroll. A double bass has brass tuning machines instead. */
  function pegbox(c, nh) {
    const { nut, mid } = G;
    const x0 = nut - 7;
    const sc = Math.max(10, nut * 0.3);       // where the scroll begins
    const half = nh * 0.92;
    const maple = () => wood(c, 'flame', { scale: 0.7, seed: 5 });
    c.save();
    c.beginPath();
    c.moveTo(x0, mid - half);
    c.lineTo(sc, mid - half * 0.86);
    c.lineTo(sc, mid + half * 0.86);
    c.lineTo(x0, mid + half);
    c.closePath();
    c.shadowColor = 'rgba(0,0,0,.6)';
    c.shadowBlur = 10;
    c.shadowOffsetY = 4;
    c.fillStyle = maple();
    c.fill();
    c.restore();
    // varnish over the maple, as on the body
    c.fillStyle = 'rgba(120,40,8,.35)';
    c.beginPath();
    c.moveTo(x0, mid - half);
    c.lineTo(sc, mid - half * 0.86);
    c.lineTo(sc, mid + half * 0.86);
    c.lineTo(x0, mid + half);
    c.closePath();
    c.fill();
    // the hollow, where the strings wind on
    c.fillStyle = '#1A0E08';
    rr(c, sc + 4, mid - half * 0.62, x0 - sc - 6, half * 1.24, 4);
    c.fill();
    // the strings from the nut into the pegbox, each to its peg
    const pegs = [];
    for (let i = 0; i < N; i++) {
      // pegs alternate sides; the middle strings' pegs nearest the nut
      const order = [3, 1, 0, 2][i] ?? i;
      const x = x0 - 6 - ((x0 - sc - 14) * (order + 0.5)) / N;
      pegs.push({ x, side: i < N / 2 ? -1 : 1 });
      c.save();
      c.beginPath();
      c.rect(sc, 0, x0 - sc + 8, G.H);
      c.clip();
      string(c, nut - 4, sv(i, nut), x, mid + (i - (N - 1) / 2) * half * 0.22, { width: look.width[i] * thick(), color: look.strings[i], wound: !!look.wound[i] });
      // the silk wound round its end
      c.strokeStyle = look.silk[i];
      c.lineWidth = look.width[i] * thick() + 1.5;
      c.beginPath();
      const yA = sv(i, nut);
      const yB = mid + (i - (N - 1) / 2) * half * 0.22;
      const t0 = 0.12;
      const t1 = 0.4;
      c.moveTo(nut - 4 + (x - nut + 4) * t0, yA + (yB - yA) * t0);
      c.lineTo(nut - 4 + (x - nut + 4) * t1, yA + (yB - yA) * t1);
      c.stroke();
      c.restore();
    }
    for (const { x, side } of pegs) {
      if (look.machines) {
        // a brass plate and gear on the side, its key sticking out
        const kx = x;
        const ky = mid + side * (half + 10);
        c.fillStyle = metal(c, 'brass', kx - 9, 0, kx + 9, 0);
        rr(c, kx - 8, mid + side * half - (side > 0 ? 0 : 6), 16, 6, 2);
        c.fill();
        c.fillStyle = 'rgba(0,0,0,.35)';
        rr(c, kx - 1, Math.min(ky, ky + side * 22) + 3, 6, 22, 2);
        c.fill();
        c.fillStyle = metal(c, 'brass', kx - 3, 0, kx + 3, 0);
        rr(c, kx - 2.5, Math.min(ky, ky + side * 16), 5, 16, 2);
        c.fill();
        c.beginPath();
        c.ellipse(kx, ky + side * 22, 9, 6, 0, 0, Math.PI * 2);
        c.fillStyle = metal(c, 'brass', kx - 9, 0, kx + 9, 0);
        c.fill();
        c.strokeStyle = 'rgba(70,40,0,.5)';
        c.lineWidth = 1;
        c.stroke();
        // the shaft across the hollow
        c.fillStyle = metal(c, 'brass', 0, mid - 3, 0, mid + 3);
        c.fillRect(kx - 2, mid - half * 0.62, 4, half * 1.24);
      } else {
        // the peg's shaft across the hollow, its head outside
        const hw = clamp(nh * 0.2, 5, 11);
        c.fillStyle = wood(c, 'ebony', { angle: 90, seed: x });
        c.fillRect(x - hw * 0.35, mid - half * 0.62, hw * 0.7, half * 1.24);
        // the collar, the spade you turn it by, and the pip at its end
        const v0 = mid + side * half;
        const hy = v0 + side * hw * 1.75;
        c.save();
        c.shadowColor = 'rgba(0,0,0,.5)';
        c.shadowBlur = 6;
        c.shadowOffsetX = 2;
        c.shadowOffsetY = 3;
        c.fillStyle = '#16100D';
        c.fillRect(x - hw * 0.22, v0, hw * 0.44, side * hw * 3);
        c.beginPath();
        c.ellipse(x, hy, hw * 1.05, hw * 1.15, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
        const sg = c.createLinearGradient(x - hw, 0, x + hw, 0);
        sg.addColorStop(0, '#3A302A');
        sg.addColorStop(0.35, '#1C1512');
        sg.addColorStop(1, '#0C0908');
        c.fillStyle = sg;
        c.beginPath();
        c.ellipse(x, hy, hw * 1.05, hw * 1.15, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#4A3D34';
        c.fillRect(x - hw * 0.5, side > 0 ? v0 : v0 - hw * 0.5, hw, hw * 0.5);
        c.beginPath();
        c.arc(x, v0 + side * hw * 3.05, hw * 0.3, 0, Math.PI * 2);
        c.fillStyle = '#EDE6D6';
        c.fill();
      }
    }
    // the scroll: its volute seen from above, a spiral each side of the middle
    const sw = half * 1.05;
    c.save();
    c.beginPath();
    c.ellipse(sc * 0.5, mid, sc * 0.75, sw, 0, 0, Math.PI * 2);
    c.shadowColor = 'rgba(0,0,0,.6)';
    c.shadowBlur = 8;
    c.shadowOffsetY = 3;
    c.fillStyle = maple();
    c.fill();
    c.restore();
    c.fillStyle = 'rgba(120,40,8,.4)';
    c.beginPath();
    c.ellipse(sc * 0.5, mid, sc * 0.75, sw, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(30,10,2,.55)';
    c.lineWidth = 1.2;
    for (const side of [-1, 1]) {
      c.beginPath();
      for (let k = 0; k <= 40; k++) {
        const a = k * 0.32;
        const rr2 = sw * 0.42 * (1 - k / 48);
        const x = sc * 0.5 + Math.cos(a) * rr2 * 0.55;
        const y = mid + side * (sw * 0.45 + Math.sin(a) * rr2 * 0.6);
        if (k) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.stroke();
    }
    c.strokeStyle = 'rgba(255,220,170,.25)';
    c.beginPath();
    c.moveTo(0, mid);
    c.lineTo(sc + 2, mid);
    c.stroke();
  }

  /* The bow: a pernambuco stick over a ribbon of horsehair, an ebony frog with its pearl eye at
     one end and the white tip at the other, lying across the strings. */
  function drawBow(g, s, now) {
    const b = [...bows.values()][0];
    const ab = [...autoBow.keys()].at(-1);
    let x = b ? b.u : G.fbEnd + (G.bridge - G.fbEnd) * 0.36;
    let yc = b ? b.v : G.mid;
    if (!b && ab != null) {
      // playing by itself: the bow rides on its string, back and forth
      x = G.fbEnd + (G.bridge - G.fbEnd) * (0.36 + 0.1 * Math.sin(now / 260));
      yc = sv(ab, x);
    }
    const len = G.spread + gapAt(G.bridge) * 1.15;
    const k = clamp(G.H / 600, 0.75, 1.4);
    // where the hair grips a sounding string, it glows
    for (let i = 0; i < N; i++) {
      if (state[i].on && state[i].level > 0.05) pool(g, x, sv(i, x), 14 + 18 * state[i].level, '#FFE2A8', 0.5 * Math.min(1, state[i].level * 2));
    }
    g.save();
    g.globalAlpha = b || ab != null ? 1 : 0.55;
    g.translate(x, yc);
    g.rotate(-0.06);
    // its shadow on the strings and the top
    g.fillStyle = 'rgba(0,0,0,.3)';
    rr(g, 8 * k, -len / 2 + 6, 9 * k, len - 4, 4);
    g.fill();
    // the hair
    g.fillStyle = '#EFE8D4';
    rr(g, -3.5 * k, -len / 2 + 14 * k, 7 * k, len - 44 * k, 2);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,.08)';
    for (let i = -2; i <= 2; i++) g.fillRect(i * 1.3 * k - 0.3, -len / 2 + 14 * k, 0.6, len - 44 * k);
    // the stick, curving toward the hair in the middle
    g.strokeStyle = '#5E220E';
    g.lineWidth = 5.5 * k;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(9 * k, -len / 2 + 6 * k);
    g.quadraticCurveTo(3 * k, 0, 9 * k, len / 2 - 26 * k);
    g.stroke();
    g.strokeStyle = 'rgba(255,200,160,.35)';
    g.lineWidth = 1.5 * k;
    g.beginPath();
    g.moveTo(8 * k, -len / 2 + 8 * k);
    g.quadraticCurveTo(2 * k, 0, 8 * k, len / 2 - 28 * k);
    g.stroke();
    // the tip
    g.fillStyle = '#F4EFE4';
    rr(g, -4 * k, -len / 2, 16 * k, 14 * k, 3 * k);
    g.fill();
    g.fillStyle = '#2A1A10';
    g.fillRect(-4 * k, -len / 2 + 11 * k, 16 * k, 2 * k);
    // the frog: ebony, a pearl eye, a silver ferrule and the screw at its end
    const fy = len / 2 - 32 * k;
    g.fillStyle = '#120D0A';
    rr(g, -6 * k, fy, 20 * k, 30 * k, 4 * k);
    g.fill();
    g.fillStyle = metal(g, 'silver', -6 * k, 0, 14 * k, 0);
    g.fillRect(-6 * k, fy, 20 * k, 3.5 * k);
    g.beginPath();
    g.arc(4 * k, fy + 15 * k, 3.4 * k, 0, Math.PI * 2);
    const pearl = g.createRadialGradient(3 * k, fy + 14 * k, 0.5, 4 * k, fy + 15 * k, 3.4 * k);
    pearl.addColorStop(0, '#FFFFFF');
    pearl.addColorStop(0.5, '#DDEBF0');
    pearl.addColorStop(1, '#B8C9D8');
    g.fillStyle = pearl;
    g.fill();
    g.fillStyle = metal(g, 'silver', 4 * k, 0, 13 * k, 0);
    rr(g, 5 * k, fy + 30 * k, 8 * k, 9 * k, 2 * k);
    g.fill();
    g.restore();
  }

  if (o.vibrato) {
    kit.toggle({
      label: 'Vibrato',
      on: true,
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c2-5 4-5 5 0s3 5 5 0 3-5 5 0 3 5 5 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
      onChange: (on) => voices.forEach((v) => v.vibrato(on)),
    });
  }

  // Listen: a finger goes down where the note is, on the highest string that has it (so open
  // strings ring where they can, as in first position), and the bow plays it, or it is plucked.
  const stringFor = (m) => {
    for (let i = N - 1; i >= 0; i--) if (m >= open[i] - 0.01) return m - open[i] <= span + 0.01 ? i : -1;
    return -1;
  };
  let autoNote = 0;
  const latest = new Map();   // string -> the last note played on it
  kit.performer({
    can: (e) => e.midi != null && stringFor(e.midi) >= 0,
    down(e) {
      const i = stringFor(e.midi);
      const semis = e.midi - open[i];
      const id = `auto${i}`;
      if (semis > 0.01) fingers.set(id, { string: i, u: uOf(semis) });
      else fingers.delete(id);
      lastString = i;
      const n = ++autoNote;
      latest.set(i, n);
      if (mode === 'pizz' || e.pizz) { pluck(i, 0.4 + (e.vel ?? 0.7) * 0.5); return { i, n }; }
      state[i].quick = true;
      autoBow.set(i, 0.35 + (e.vel ?? 0.7) * 0.5);
      // a string already sounding gets a new bow stroke
      if (state[i].on) { voices[i].pitch(pitchOf(i)); kit.note(pitchOf(i), 'fresh'); }
      run();
      return { i, n };
    },
    up(h) {
      if (latest.get(h.i) !== h.n) return;   // a newer note has the string now
      autoBow.delete(h.i);
      fingers.delete(`auto${h.i}`);
      s.redraw();
    },
    finish() {
      autoBow.clear();
      for (const id of [...fingers.keys()]) if (String(id).startsWith('auto')) fingers.delete(id);
      state.forEach((st) => { st.quick = false; });
      s.redraw();
    },
  });

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
