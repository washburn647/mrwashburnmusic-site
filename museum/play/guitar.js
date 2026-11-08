/* Guitar: the neck on the left, where fingers press the frets; the body on the right, where
   you strum or pick. Chords mode puts chord shapes on the left instead: pick one and strum.
   On a computer, click a fret to put a finger there (click again to lift it), drag across the
   strings to strum, Space strums down (Shift+Space up), and 1 to 0 pick chords. */

import { surface, rr, label } from '../surface.js';
import { pitched } from '../audio.js';

const CHORDS = [
  ['C', [-1, 3, 2, 0, 1, 0]],
  ['G', [3, 2, 0, 0, 0, 3]],
  ['D', [-1, -1, 0, 2, 3, 2]],
  ['A', [-1, 0, 2, 2, 2, 0]],
  ['E', [0, 2, 2, 1, 0, 0]],
  ['F', [-1, -1, 3, 2, 1, 1]],
  ['Am', [-1, 0, 2, 2, 1, 0]],
  ['Em', [0, 2, 2, 0, 0, 0]],
  ['Dm', [-1, -1, 0, 2, 3, 1]],
  ['G7', [3, 2, 0, 0, 0, 1]],
  ['D7', [-1, -1, 0, 2, 1, 2]],
  ['E7', [0, 2, 0, 1, 0, 0]],
];
const CHORD_KEYS = '1234567890-=';

const FRETBOARD = '#3B2418';
const BODY = '#D8A266';

export async function mount(stage, ex, kit) {
  const o = ex.opts;
  const tuning = o.strings;
  const N = tuning.length;
  const FRETS = o.frets;
  const inst = await pitched(o.sound, tuning[0], tuning[N - 1] + FRETS);

  const box = document.createElement('div');
  box.className = 'zone guitar';
  stage.append(box);

  let mode = 'notes';
  let chord = 0;
  const fingers = new Map();      // pointer id -> { string, fret }
  const sticky = new Map();       // string -> fret (mouse)
  const ring = Array.from({ length: N }, () => ({ voice: null, at: 0, amp: 0, fret: 0 }));

  // ---- geometry, in instrument space ----
  let G = null;
  function geom(s) {
    const neckEnd = s.W * (s.tall ? 0.62 : 0.64);
    const nut = Math.max(18, s.W * 0.025);
    const top = s.H * 0.13;
    const bottom = s.H * 0.87;
    const gap = (bottom - top) / (N - 1);
    const reach = 1 - 2 ** (-(FRETS + 0.6) / 12);
    const fretAt = (n) => nut + ((1 - 2 ** (-n / 12)) / reach) * (neckEnd - nut);
    const bridge = s.W - Math.max(26, s.W * 0.05);
    const hole = neckEnd + (bridge - neckEnd) * 0.38;
    G = { neckEnd, nut, top, bottom, gap, fretAt, bridge, hole };
    return G;
  }
  // Strings fan in a little toward the bridge, like a real guitar.
  const stringV = (i) => G.top + i * G.gap;

  function fretted(i) {
    if (mode === 'chords') return CHORDS[chord][1][i];
    let f = sticky.get(i) || 0;
    for (const p of fingers.values()) if (p.string === i) f = Math.max(f, p.fret);
    return f;
  }

  function pluck(i, vol = 0.7) {
    const f = fretted(i);
    if (f < 0) return;
    const r = ring[i];
    r.voice?.stop(0.05);
    const midi = tuning[i] + f;
    r.voice = inst.play(midi, { vol });
    r.at = performance.now();
    r.amp = Math.min(1, vol + 0.2);
    r.fret = f;
    if (mode === 'notes') kit.note(midi);
    s.animate(1800);
  }

  // A finger landing or lifting on a ringing string changes its note: hammer-on, pull-off.
  function refret(i) {
    const r = ring[i];
    const f = fretted(i);
    if (f === r.fret || !r.voice || performance.now() - r.at > 2500 || f < 0) return;
    r.voice.stop(0.03);
    r.voice = inst.play(tuning[i] + f, { vol: 0.42 });
    r.fret = f;
    r.at = performance.now();
    r.amp = Math.max(r.amp * 0.6, 0.35);
    kit.note(tuning[i] + f);
    s.animate(1500);
  }

  function neckHit(p) {
    if (p.u > G.neckEnd || p.u < G.nut - 4) return null;
    const i = Math.round((p.v - G.top) / G.gap);
    if (i < 0 || i >= N || Math.abs(p.v - stringV(i)) > G.gap * 0.62) return null;
    let f = 1;
    while (f < FRETS && p.u > G.fretAt(f)) f++;
    return { string: i, fret: f };
  }

  const s = surface(box, {
    label: ex.name,
    draw,
    down(p) {
      if (p.u < G.neckEnd) {
        if (mode === 'chords') return;
        const h = neckHit(p);
        if (!h) return;
        if (p.type === 'mouse') {
          if (sticky.get(h.string) === h.fret) sticky.delete(h.string);
          else sticky.set(h.string, h.fret);
        } else {
          fingers.set(p.id, h);
        }
        refret(h.string);
        return;
      }
      p.data.strum = true;
      p.data.last = performance.now();
      const i = Math.round((p.v - G.top) / G.gap);
      if (i >= 0 && i < N && Math.abs(p.v - stringV(i)) < G.gap * 0.3) { pluck(i, 0.62); p.data.hit = i; }
    },
    move(p) {
      if (fingers.has(p.id)) {
        const h = neckHit(p);
        const was = fingers.get(p.id);
        if (!h) return;
        if (h.string !== was.string || h.fret !== was.fret) {
          fingers.set(p.id, h);
          refret(was.string);
          refret(h.string);
        }
        return;
      }
      if (!p.data.strum) return;
      const dv = p.v - p.pv;
      const dt = Math.max(1, p.t - p.pt);
      const speed = Math.abs(dv) / dt;
      for (let i = 0; i < N; i++) {
        const y = stringV(i);
        if ((p.pv - y) * (p.v - y) < 0 && p.data.hit !== i) {
          pluck(i, Math.min(0.95, 0.4 + speed * 0.35));
        }
        if (p.data.hit === i && Math.abs(p.v - y) > G.gap * 0.3) p.data.hit = null;
      }
    },
    up(p) {
      const was = fingers.get(p.id);
      fingers.delete(p.id);
      if (was) refret(was.string);
    },
  });
  s.onresize = (s) => { geom(s); placePads(); };
  geom(s);

  function draw(g, s, t) {
    geom(s);
    const now = performance.now();
    // body
    const bodyGrad = g.createLinearGradient(G.neckEnd, 0, s.W, 0);
    bodyGrad.addColorStop(0, '#C98E50');
    bodyGrad.addColorStop(1, BODY);
    g.fillStyle = bodyGrad;
    g.fillRect(G.neckEnd - 2, 0, s.W - G.neckEnd + 2, s.H);
    // wood grain
    g.strokeStyle = 'rgba(120,70,30,.10)';
    g.lineWidth = 1;
    for (let y = 6; y < s.H; y += 9) { g.beginPath(); g.moveTo(G.neckEnd, y); g.bezierCurveTo(G.neckEnd + 80, y + 3, s.W - 80, y - 3, s.W, y + 1); g.stroke(); }
    // sound hole and rosette
    const hr = Math.min(s.H * 0.36, (G.bridge - G.neckEnd) * 0.34);
    g.fillStyle = '#5A3A1E';
    g.beginPath(); g.arc(G.hole, s.H / 2, hr + 12, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#E9C893'; g.lineWidth = 3;
    g.beginPath(); g.arc(G.hole, s.H / 2, hr + 7, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#1B120C';
    g.beginPath(); g.arc(G.hole, s.H / 2, hr, 0, Math.PI * 2); g.fill();
    // bridge
    g.fillStyle = '#2C1B10';
    rr(g, G.bridge - 8, G.top - G.gap * 0.6, 22, G.bottom - G.top + G.gap * 1.2, 6);
    g.fill();
    g.fillStyle = '#EFE6D2';
    g.fillRect(G.bridge - 2, G.top - G.gap * 0.4, 4, G.bottom - G.top + G.gap * 0.8);

    // neck
    g.fillStyle = '#1A110B';
    g.fillRect(0, 0, G.neckEnd, s.H);
    const fb = g.createLinearGradient(0, G.top - G.gap * 0.7, 0, G.bottom + G.gap * 0.7);
    fb.addColorStop(0, '#2C1A11'); fb.addColorStop(0.5, FRETBOARD); fb.addColorStop(1, '#2C1A11');
    g.fillStyle = fb;
    g.fillRect(G.nut, G.top - G.gap * 0.7, G.neckEnd - G.nut, G.bottom - G.top + G.gap * 1.4);
    // inlays
    g.fillStyle = 'rgba(240,232,214,.75)';
    for (const n of [3, 5, 7, 9, 12, 15]) {
      if (n > FRETS) continue;
      const x = (G.fretAt(n - 1) + G.fretAt(n)) / 2;
      const r = Math.min(9, G.gap * 0.22);
      if (n === 12) {
        g.beginPath(); g.arc(x, G.top + G.gap * 1.5, r, 0, 7); g.arc(x, G.bottom - G.gap * 1.5, r, 0, 7); g.fill();
      } else { g.beginPath(); g.arc(x, s.H / 2, r, 0, 7); g.fill(); }
    }
    // frets
    for (let n = 1; n <= FRETS; n++) {
      const x = G.fretAt(n);
      const fg = g.createLinearGradient(x - 2, 0, x + 2, 0);
      fg.addColorStop(0, '#8E979E'); fg.addColorStop(0.5, '#F2F5F7'); fg.addColorStop(1, '#7D868D');
      g.fillStyle = fg;
      g.fillRect(x - 2, G.top - G.gap * 0.7, 4, G.bottom - G.top + G.gap * 1.4);
    }
    // nut
    g.fillStyle = '#F1E9D6';
    g.fillRect(G.nut - 7, G.top - G.gap * 0.7, 7, G.bottom - G.top + G.gap * 1.4);

    // strings
    for (let i = 0; i < N; i++) {
      const y = stringV(i);
      const r = ring[i];
      const age = (now - r.at) / 1000;
      const amp = r.voice ? r.amp * Math.exp(-age * 2.2) : 0;
      const w = 1.2 + (N - 1 - i) * 0.45;
      const f = fretted(i);
      const from = f > 0 ? G.fretAt(f - 1) + (G.fretAt(f) - G.fretAt(f - 1)) * 0.5 : G.nut;
      const wound = i < 3;
      g.strokeStyle = wound ? '#D9B98A' : '#ECE7DD';
      g.lineWidth = w;
      g.beginPath(); g.moveTo(G.nut - 6, y); g.lineTo(from, y); g.stroke();
      // the part that vibrates
      if (amp > 0.01) {
        const k = 18 + i * 3;
        g.save();
        g.globalAlpha = 0.9;
        g.beginPath();
        for (let x = from; x <= G.bridge; x += 6) {
          const pos = (x - from) / (G.bridge - from);
          const env = Math.sin(pos * Math.PI);
          const dy = Math.sin(now / (8 - i) + x / k) * amp * env * Math.min(G.gap * 0.28, 9);
          x === from ? g.moveTo(x, y + dy) : g.lineTo(x, y + dy);
        }
        g.lineTo(G.bridge, y);
        g.stroke();
        g.restore();
      } else {
        g.beginPath(); g.moveTo(from, y); g.lineTo(G.bridge, y); g.stroke();
      }
      if (mode === 'chords' && f < 0) {
        g.strokeStyle = 'rgba(0,0,0,.45)';
        g.lineWidth = w + 3;
        g.beginPath(); g.moveTo(G.neckEnd, y); g.lineTo(G.bridge, y); g.stroke();
      }
    }

    // fingers
    const dots = [];
    if (mode === 'chords') {
      CHORDS[chord][1].forEach((f, i) => { if (f > 0) dots.push([i, f]); });
    } else {
      for (let i = 0; i < N; i++) { const f = fretted(i); if (f > 0) dots.push([i, f]); }
    }
    for (const [i, f] of dots) {
      const x = G.fretAt(f - 1) + (G.fretAt(f) - G.fretAt(f - 1)) * 0.55;
      const y = stringV(i);
      const r = Math.min(G.gap * 0.36, 17);
      g.save();
      g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 6;
      g.fillStyle = '#E8B85A';
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.restore();
      g.strokeStyle = '#FFF3D0'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    }
    // open and muted marks at the nut in chord mode
    if (mode === 'chords') {
      CHORDS[chord][1].forEach((f, i) => {
        const y = stringV(i);
        if (f < 0) label(g, s, '✕', G.nut / 2 - 1, y, { size: Math.min(16, G.gap * 0.5), color: '#E08A7A' });
      });
    }
  }

  // ---- chord pads ----
  const pads = document.createElement('div');
  pads.className = 'chords';
  pads.setAttribute('role', 'radiogroup');
  pads.setAttribute('aria-label', 'Chords');
  pads.hidden = true;
  CHORDS.forEach(([name, shape], k) => {
    const b = document.createElement('button');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(k === chord));
    b.setAttribute('aria-label', `${name} chord`);
    b.innerHTML = `${diagram(shape)}<span class="cn">${name.replace('m', '<small>m</small>')}</span><span class="keycap">${CHORD_KEYS[k]}</span>`;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); pick(k); });
    b.addEventListener('click', () => pick(k));
    pads.append(b);
  });
  box.append(pads);

  function pick(k) {
    chord = k;
    pads.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-checked', String(j === k)));
    kit.text(CHORDS[k][0]);
    // Changing chord while strings ring moves them to the new shape, as a real hand would mute them.
    for (const r of ring) if (r.voice) { r.voice.stop(0.08); r.voice = null; }
    s.redraw();
  }

  function placePads() {
    if (!G) return;
    if (s.tall) Object.assign(pads.style, { left: '0', top: '0', width: '100%', height: `${G.neckEnd}px` });
    else Object.assign(pads.style, { left: '0', top: '0', width: `${G.neckEnd}px`, height: '100%' });
    pads.classList.toggle('tall', s.tall);
  }
  placePads();

  kit.choice({
    label: 'Play',
    value: 'notes',
    options: [{ value: 'notes', label: 'Notes' }, { value: 'chords', label: 'Chords' }],
    onChange(v) {
      mode = v;
      pads.hidden = v !== 'chords';
      fingers.clear();
      if (v === 'chords') pick(chord);
      else kit.text('');
      s.redraw();
    },
  });

  function strumAll(up = false) {
    const order = [...Array(N).keys()];
    if (up) order.reverse();
    order.forEach((i, k) => setTimeout(() => pluck(i, 0.72), k * 14));
  }

  function keydown(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); strumAll(e.shiftKey); return; }
    const k = CHORD_KEYS.indexOf(e.key);
    if (k >= 0 && mode === 'chords') pick(k);
  }
  addEventListener('keydown', keydown);

  return () => {
    removeEventListener('keydown', keydown);
    for (const r of ring) r.voice?.stop(0.2);
    s.destroy();
  };
}

/* A small chord chart: strings up and down, frets across, like the neck beside it. */
function diagram(shape) {
  const W = 64;
  const H = 46;
  const x0 = 10;
  const fw = (W - x0 - 2) / 4;
  const y = (i) => 5 + i * ((H - 10) / 5);
  let out = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
  out += `<rect x="${x0 - 3}" y="3" width="3" height="${H - 6}" fill="currentColor"/>`;
  for (let f = 1; f <= 4; f++) out += `<path d="M${x0 + f * fw} 4V${H - 4}" stroke="currentColor" stroke-width="1" opacity=".45"/>`;
  shape.forEach((f, i) => {
    out += `<path d="M${x0} ${y(i)}H${W - 2}" stroke="currentColor" stroke-width="${i < 3 ? 1.3 : 0.9}" opacity=".7"/>`;
    if (f > 0) out += `<circle cx="${x0 + (f - 0.5) * fw}" cy="${y(i)}" r="3.6" fill="currentColor"/>`;
    if (f < 0) out += `<path d="M1.5 ${y(i) - 2.5}l5 5m0-5l-5 5" stroke="currentColor" stroke-width="1.3"/>`;
  });
  return `${out}</svg>`;
}
