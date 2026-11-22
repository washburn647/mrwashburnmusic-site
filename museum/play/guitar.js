/* Guitar and its relatives (electric guitar, electric bass, banjo, ukulele): the neck on the
   left, where fingers press the frets; the body on the right, where you strum or pick. Chords
   mode puts chord shapes on the left instead: pick one and strum.
   opts: sound, strings (open notes, from the string nearest the player's face), frets,
   chords (a set below, or none), look (classical, electric, bass, banjo, ukulele) and short
   (a string that starts partway up the neck, like the banjo's fifth: { string, from }).
   On a computer, click a fret to put a finger there (click again to lift it), drag across the
   strings to strum, Space strums down (Shift+Space up), and 1 to 0 pick chords. */

import { surface, rr, label } from '../surface.js';
import { pitched } from '../audio.js';

const CHORD_SETS = {};
CHORD_SETS.guitar = [
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
// Ukulele, strings G C E A (the G is tuned high, above the C).
CHORD_SETS.ukulele = [
  ['C', [0, 0, 0, 3]],
  ['G', [0, 2, 3, 2]],
  ['F', [2, 0, 1, 0]],
  ['Am', [2, 0, 0, 0]],
  ['D', [2, 2, 2, 0]],
  ['A', [2, 1, 0, 0]],
  ['Em', [0, 4, 3, 2]],
  ['Dm', [2, 2, 1, 0]],
  ['G7', [0, 2, 1, 2]],
  ['C7', [0, 0, 0, 1]],
  ['D7', [2, 2, 2, 3]],
  ['E7', [1, 2, 0, 2]],
];
// Five-string banjo in open G (g D G B D): the short fifth string always rings open.
CHORD_SETS.banjo = [
  ['G', [0, 0, 0, 0, 0]],
  ['C', [0, 2, 0, 1, 2]],
  ['D', [0, 0, 2, 3, 4]],
  ['Em', [0, 2, 0, 0, 2]],
  ['Am', [0, 2, 2, 1, 2]],
  ['F', [0, 3, 2, 1, 3]],
  ['A', [0, 2, 2, 2, 2]],
  ['E', [0, 2, 1, 0, 2]],
  ['G7', [0, 0, 0, 0, 3]],
  ['D7', [0, 0, 2, 1, 0]],
];
const CHORD_KEYS = '1234567890-=';

const FRETBOARD = '#3B2418';

/* How each one looks: the body's wood or paint, and what sits on it. */
const LOOKS = {
  classical: { body: ['#C98E50', '#D8A266'], grain: 'rgba(120,70,30,.10)', top: 'hole', board: FRETBOARD },
  ukulele: { body: ['#B8743C', '#CF9455'], grain: 'rgba(100,55,20,.12)', top: 'hole', board: '#2E1C12' },
  electric: { body: ['#8E1F24', '#C8333A'], grain: null, top: 'pickups', pickups: 3, board: '#E3C79A', guard: '#F3EEE4' },
  bass: { body: ['#1F3E63', '#2E5A8C'], grain: null, top: 'pickups', pickups: 2, board: '#2A1A10', guard: '#1A1A1A' },
  banjo: { body: ['#7A4A24', '#8E5A2E'], grain: 'rgba(60,30,10,.12)', top: 'drum', board: '#22160E' },
};

export async function mount(stage, ex, kit) {
  const o = ex.opts;
  const tuning = o.strings;
  const N = tuning.length;
  const FRETS = o.frets;
  const look = LOOKS[o.look || 'classical'];
  const CHORDS = CHORD_SETS[o.chords] || null;
  const short = o.short || null;   // { string, from }: starts at that fret, open there
  const inst = await pitched(o.sound, Math.min(...tuning), Math.max(...tuning) + FRETS);
  // Thicker strings for lower notes; the low ones are wound with wire.
  const lowest = Math.min(...tuning);
  const highest = Math.max(...tuning);
  const widthOf = (i) => (o.look === 'bass' ? 2.2 : 1.2) + ((highest - tuning[i]) / Math.max(1, highest - lowest)) * (o.look === 'bass' ? 2.4 : 2.2);
  const wound = (i) => o.look === 'bass' || tuning[i] <= 52;
  /* The note of string i stopped at fret f (the short string is open below its first fret). */
  const noteOf = (i, f) => (short && i === short.string ? tuning[i] + Math.max(0, f - short.from) : tuning[i] + f);

  const box = document.createElement('div');
  box.className = 'zone guitar';
  stage.append(box);

  let mode = 'notes';
  let chord = 0;
  const fingers = new Map();      // pointer id -> { string, fret }
  const sticky = new Map();       // string -> fret (mouse)
  const ring = Array.from({ length: N }, () => ({ voice: null, at: 0, amp: 0, fret: 0 }));
  const auto = new Map();         // string -> fret, while the instrument plays a tune itself

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
    if (auto.has(i)) return auto.get(i);
    if (short && i === short.string) {
      // Below its first fret there is no string there to press.
      let f = sticky.get(i) || 0;
      for (const p of fingers.values()) if (p.string === i) f = Math.max(f, p.fret);
      return f > short.from ? f : 0;
    }
    let f = sticky.get(i) || 0;
    for (const p of fingers.values()) if (p.string === i) f = Math.max(f, p.fret);
    return f;
  }

  function pluck(i, vol = 0.7) {
    const f = fretted(i);
    if (f < 0) return;
    const r = ring[i];
    r.voice?.stop(0.05);
    const midi = noteOf(i, f);
    r.voice = inst.play(midi, { vol });
    r.at = performance.now();
    r.amp = Math.min(1, vol + 0.2);
    r.fret = f;
    if (mode === 'notes') kit.note(midi, 'fresh');
    else heardChord();
    s.animate(1800);
  }

  // A finger landing or lifting on a ringing string changes its note: hammer-on, pull-off.
  function refret(i) {
    const r = ring[i];
    const f = fretted(i);
    if (f === r.fret || !r.voice || performance.now() - r.at > 2500 || f < 0) return;
    r.voice.stop(0.03);
    r.voice = inst.play(noteOf(i, f), { vol: 0.42 });
    r.fret = f;
    r.at = performance.now();
    r.amp = Math.max(r.amp * 0.6, 0.35);
    kit.note(noteOf(i, f), 'fresh');
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
    drawBody(g, s);

    // neck
    g.fillStyle = '#1A110B';
    g.fillRect(0, 0, G.neckEnd, s.H);
    const fb = g.createLinearGradient(0, G.top - G.gap * 0.7, 0, G.bottom + G.gap * 0.7);
    fb.addColorStop(0, '#2C1A11'); fb.addColorStop(0.5, FRETBOARD); fb.addColorStop(1, '#2C1A11');
    g.fillStyle = look.board === FRETBOARD ? fb : look.board;
    g.fillRect(G.nut, G.top - G.gap * 0.7, G.neckEnd - G.nut, G.bottom - G.top + G.gap * 1.4);
    // inlays
    g.fillStyle = look.board === '#E3C79A' ? 'rgba(30,20,12,.8)' : 'rgba(240,232,214,.75)';
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
      const w = widthOf(i);
      const f = fretted(i);
      const isShort = short && i === short.string;
      const start = isShort ? G.fretAt(short.from) : G.nut;
      const from = f > 0 && !(isShort && f <= short.from) ? G.fretAt(f - 1) + (G.fretAt(f) - G.fretAt(f - 1)) * 0.5 : start;
      g.strokeStyle = wound(i) ? (o.look === 'electric' || o.look === 'bass' ? '#C9CED2' : '#D9B98A') : '#ECE7DD';
      g.lineWidth = w;
      g.beginPath(); g.moveTo(isShort ? start : G.nut - 6, y); g.lineTo(from, y); g.stroke();
      if (isShort) {
        // the fifth string's own tuning peg, partway up the neck
        g.save();
        g.fillStyle = '#F1E9D6';
        g.beginPath(); g.arc(start - 4, y, Math.min(7, G.gap * 0.22), 0, 7); g.fill();
        g.restore();
      }
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

  function drawBody(g, s) {
    const grad = g.createLinearGradient(G.neckEnd, 0, s.W, 0);
    grad.addColorStop(0, look.body[0]);
    grad.addColorStop(1, look.body[1]);
    g.fillStyle = grad;
    g.fillRect(G.neckEnd - 2, 0, s.W - G.neckEnd + 2, s.H);
    if (look.grain) {
      g.strokeStyle = look.grain;
      g.lineWidth = 1;
      for (let y = 6; y < s.H; y += 9) { g.beginPath(); g.moveTo(G.neckEnd, y); g.bezierCurveTo(G.neckEnd + 80, y + 3, s.W - 80, y - 3, s.W, y + 1); g.stroke(); }
    }
    const cy = (G.top + G.bottom) / 2;
    const span = G.bottom - G.top + G.gap * 1.2;
    if (look.top === 'hole') {
      // sound hole and rosette
      const hr = Math.min(s.H * 0.36, (G.bridge - G.neckEnd) * 0.34);
      g.fillStyle = '#5A3A1E';
      g.beginPath(); g.arc(G.hole, cy, hr + 12, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#E9C893'; g.lineWidth = 3;
      g.beginPath(); g.arc(G.hole, cy, hr + 7, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#1B120C';
      g.beginPath(); g.arc(G.hole, cy, hr, 0, Math.PI * 2); g.fill();
    } else if (look.top === 'pickups') {
      // a pickguard, and the pickups: magnets under each string that turn its shaking into electricity
      g.fillStyle = look.guard;
      rr(g, G.neckEnd + 6, G.top - G.gap * 0.9, (G.bridge - G.neckEnd) * 0.82, span + G.gap * 0.6, 22);
      g.fill();
      const n = look.pickups;
      for (let k = 0; k < n; k++) {
        const x = G.neckEnd + (G.bridge - G.neckEnd) * (0.18 + k * (0.55 / Math.max(1, n - 1)));
        g.fillStyle = '#141414';
        rr(g, x - 12, G.top - G.gap * 0.5, 24, span - G.gap * 0.2, 7);
        g.fill();
        g.fillStyle = '#9AA3A9';
        for (let i = 0; i < N; i++) { g.beginPath(); g.arc(x, G.top + i * G.gap, 3, 0, 7); g.fill(); }
      }
      // volume and tone knobs
      for (let k = 0; k < 2; k++) {
        g.fillStyle = '#E8E2D4';
        g.beginPath(); g.arc(G.bridge - 30 - k * 34, G.bottom + G.gap * 0.55, 10, 0, 7); g.fill();
      }
    } else if (look.top === 'drum') {
      // a banjo's body is a drum: a round frame with a head stretched over it
      const r = Math.max(span * 0.7, (G.bridge - G.neckEnd) * 0.55);
      const cx = G.neckEnd + r * 0.95;
      g.save();
      g.beginPath(); g.rect(G.neckEnd - 2, 0, s.W - G.neckEnd + 2, s.H); g.clip();
      g.fillStyle = '#B8BEC3';
      g.beginPath(); g.arc(cx, cy, r + 10, 0, 7); g.fill();
      for (let k = 0; k < 24; k++) {
        const t = (k / 24) * Math.PI * 2;
        g.fillStyle = '#E8ECEF';
        g.beginPath(); g.arc(cx + Math.cos(t) * (r + 5), cy + Math.sin(t) * (r + 5), 3.2, 0, 7); g.fill();
      }
      const h = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      h.addColorStop(0, '#FFFDF4');
      h.addColorStop(1, '#E6DCC4');
      g.fillStyle = h;
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.restore();
    }
    // bridge
    g.fillStyle = look.top === 'drum' ? '#C9A46A' : '#2C1B10';
    rr(g, G.bridge - 8, G.top - G.gap * 0.6, 22, G.bottom - G.top + G.gap * 1.2, 6);
    g.fill();
    g.fillStyle = look.top === 'pickups' ? '#B7C0C6' : '#EFE6D2';
    g.fillRect(G.bridge - 2, G.top - G.gap * 0.4, 4, G.bottom - G.top + G.gap * 0.8);
  }

  // ---- chord pads ----
  const pads = document.createElement('div');
  pads.className = 'chords';
  pads.setAttribute('role', 'radiogroup');
  pads.setAttribute('aria-label', 'Chords');
  pads.hidden = true;
  (CHORDS || []).forEach(([name, shape], k) => {
    const b = document.createElement('button');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(k === chord));
    b.setAttribute('aria-label', `${name} chord`);
    b.innerHTML = `${diagram(shape, tuning, short)}<span class="cn">${name.replace('m', '<small>m</small>')}</span><span class="keycap">${CHORD_KEYS[k]}</span>`;
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

  // A strum is heard as one chord, however many strings it crosses.
  let lastChord = { name: '', at: 0 };
  function heardChord() {
    const name = CHORDS[chord][0];
    const now = performance.now();
    if (name !== lastChord.name || now - lastChord.at > 260) kit.chord(name);
    lastChord = { name, at: now };
  }

  function setMode(v) {
    mode = v;
    pads.hidden = v !== 'chords';
    fingers.clear();
    if (v === 'chords') pick(chord);
    else kit.text('');
    modeSwitch?.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-checked', String((k === 1) === (v === 'chords'))));
    s.redraw();
  }
  const modeSwitch = CHORDS ? kit.choice({
    label: 'Play',
    value: 'notes',
    options: [{ value: 'notes', label: 'Notes' }, { value: 'chords', label: 'Chords' }],
    onChange: setMode,
  }) : null;

  function strumAll(up = false, vol = 0.72) {
    const order = [...Array(N).keys()];
    if (up) order.reverse();
    return order.map((i, k) => setTimeout(() => pluck(i, vol), k * 14));
  }

  // Listen: a finger goes down at the lowest fret that has the note (open strings first), and
  // the string is picked; chords are strummed from the chord pads.
  const placeFor = (m) => {
    let best = null;
    for (let i = 0; i < N; i++) {
      // The banjo's short string is only played open.
      const f = short && i === short.string ? (m === tuning[i] ? 0 : -1) : m - tuning[i];
      if (f < 0 || f > FRETS || Math.abs(f - Math.round(f)) > 0.01) continue;
      if (!best || f < best.f) best = { i, f: Math.round(f) };
    }
    return best;
  };
  const latest = new Map();
  let autoNote = 0;
  let strumming = [];
  kit.performer({
    can: (e) => (e.chord ? !!CHORDS?.some(([n]) => n === e.chord) : e.midi != null && !!placeFor(e.midi)),
    prepare(evs) {
      const chords = evs.some((e) => e.chord);
      if (chords !== (mode === 'chords')) setMode(chords ? 'chords' : 'notes');
    },
    down(e) {
      if (e.chord) {
        const k = CHORDS.findIndex(([n]) => n === e.chord);
        if (k !== chord || mode !== 'chords') { if (mode !== 'chords') setMode('chords'); pick(k); }
        strumming = strumAll(e.up, 0.45 + (e.vel ?? 0.7) * 0.4);
        return null;
      }
      const p = placeFor(e.midi);
      auto.set(p.i, p.f);
      const n = ++autoNote;
      latest.set(p.i, n);
      pluck(p.i, 0.4 + (e.vel ?? 0.7) * 0.45);
      s.redraw();
      return { ...p, n, voice: ring[p.i].voice };
    },
    up(h) {
      if (!h || latest.get(h.i) !== h.n) return;
      auto.delete(h.i);
      // Lifting a finger stops the string; an open string rings on.
      const r = ring[h.i];
      if (h.f > 0 && r.voice === h.voice) { r.voice.stop(0.12); r.voice = null; }
      s.redraw();
    },
    // (a strum stopped halfway doesn't finish: it would be heard as the visitor's)
    finish() { strumming.forEach(clearTimeout); strumming = []; auto.clear(); s.redraw(); },
  });

  function keydown(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); strumAll(e.shiftKey); return; }
    const k = CHORD_KEYS.indexOf(e.key);
    if (k >= 0 && k < (CHORDS || []).length && mode === 'chords') pick(k);
  }
  addEventListener('keydown', keydown);

  return () => {
    removeEventListener('keydown', keydown);
    for (const r of ring) r.voice?.stop(0.2);
    s.destroy();
  };
}

/* A small chord chart: strings up and down, frets across, like the neck beside it. */
function diagram(shape, tuning, short) {
  const W = 64;
  const H = 46;
  const x0 = 10;
  const fw = (W - x0 - 2) / 4;
  const y = (i) => 5 + i * ((H - 10) / (shape.length - 1));
  let out = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
  out += `<rect x="${x0 - 3}" y="3" width="3" height="${H - 6}" fill="currentColor"/>`;
  for (let f = 1; f <= 4; f++) out += `<path d="M${x0 + f * fw} 4V${H - 4}" stroke="currentColor" stroke-width="1" opacity=".45"/>`;
  shape.forEach((f, i) => {
    // The short fifth string of a banjo doesn't reach the first frets: it isn't drawn there.
    if (short && i === short.string) {
      out += `<circle cx="${x0 - 6}" cy="${y(i)}" r="1.8" fill="currentColor" opacity=".7"/>`;
      return;
    }
    out += `<path d="M${x0} ${y(i)}H${W - 2}" stroke="currentColor" stroke-width="${tuning[i] <= 52 ? 1.3 : 0.9}" opacity=".7"/>`;
    if (f > 0) out += `<circle cx="${x0 + (f - 0.5) * fw}" cy="${y(i)}" r="3.6" fill="currentColor"/>`;
    if (f < 0) out += `<path d="M1.5 ${y(i) - 2.5}l5 5m0-5l-5 5" stroke="currentColor" stroke-width="1.3"/>`;
  });
  return `${out}</svg>`;
}
