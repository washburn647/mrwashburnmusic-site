/* Guitar and its relatives (electric guitar, electric bass, banjo, ukulele): the neck on the
   left, where fingers press the frets; the body on the right, where you strum or pick. Chords
   mode puts chord shapes on the left instead: pick one and strum.
   opts: sound, strings (open notes, from the string nearest the player's face), frets,
   chords (a set below, or none), look (classical, electric, bass, banjo, ukulele) and short
   (a string that starts partway up the neck, like the banjo's fifth: { string, from }).
   On a computer, click a fret to put a finger there (click again to lift it), drag across the
   strings to strum, Space strums down (Shift+Space up), and 1 to 0 pick chords.

   Each is drawn as itself: a classical guitar's spruce top, mosaic rosette and tie-block
   bridge, with nylon trebles and wound basses, and its slotted headstock; a ukulele in curly
   koa; an electric guitar's red solid body with its horns, pickguard, three pickups and steel
   saddles, and a maple neck; an electric bass in blue with its split pickup; a banjo's drum,
   with its chrome hoop and hooks, its thin bridge on the head and pearl inlays up the neck.
   The strings spread a little from the nut to the bridge, and blur as they ring. */

import { surface, rr, label } from '../surface.js';
import { pitched } from '../audio.js';
import { wood, metal, string, pool, layer, put, rand, pin, screw, grain, head, gloss } from '../paint.js';

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

/* How each one looks: its top (wood) or paint, its fingerboard, its strings (plain and wound),
   and what sits on its body. */
const LOOKS = {
  classical: { top: 'hole', wood: 'spruce', board: 'rosewood', head: 'slotted', plain: 'rgba(244,236,220,.92)', wound: '#CBC5BA', binding: '#3A1C0E', rosette: true, tie: true },
  ukulele: { top: 'hole', wood: 'koa', board: 'rosewood', head: 'pegs', plain: 'rgba(246,242,232,.95)', wound: '#CBC5BA', binding: '#F1E6CF', tie: true, small: true },
  electric: { top: 'pickups', paint: '#B81E28', board: 'maple', head: 'inline', plain: '#E6EAED', wound: '#BFC5CA', guard: '#F4EFE4', pickups: 3, horns: true },
  bass: { top: 'pickups', paint: '#245A9A', board: 'rosewood', head: 'inline', plain: '#B9BFC5', wound: '#AEB5BB', guard: '#1A1A1C', pickups: 2, horns: true },
  banjo: { top: 'drum', board: 'ebony', head: 'peghead', plain: '#E3E7EA', wound: '#C3C9CE' },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
  const widthOf = (i) => ((o.look === 'bass' ? 2.4 : 1.1) + ((highest - tuning[i]) / Math.max(1, highest - lowest)) * (o.look === 'bass' ? 2.6 : 2)) * clamp((G?.H || 600) / 520, 1, 1.7);
  const wound = (i) => o.look === 'bass' || (o.look !== 'ukulele' && tuning[i] <= (o.look === 'banjo' ? 50 : o.look === 'electric' ? 50 : 52));
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
    const nut = Math.max(34, s.W * 0.055);       // the headstock lies beyond it
    const mid = s.H / 2;
    const spread = s.H * 0.74;                    // across the strings, at the bridge
    const reach = 1 - 2 ** (-(FRETS + 0.6) / 12);
    const fretAt = (n) => nut + ((1 - 2 ** (-n / 12)) / reach) * (neckEnd - nut);
    const bridge = s.W - Math.max(30, s.W * 0.075);
    const hole = neckEnd + (bridge - neckEnd) * 0.36;
    G = { neckEnd, nut, mid, spread, fretAt, bridge, hole, taper: 0.8, W: s.W, H: s.H };
    return G;
  }
  // The strings spread a little from the nut to the bridge, like a real guitar's.
  const gapAt = (u) => (G.spread / (N - 1)) * (G.taper + (1 - G.taper) * clamp((u - G.nut) / (G.bridge - G.nut), 0, 1));
  const stringV = (i, u) => G.mid + (i - (N - 1) / 2) * gapAt(u);
  const stringAt = (u, v, within) => {
    const i = Math.round((v - G.mid) / gapAt(u) + (N - 1) / 2);
    return i >= 0 && i < N && Math.abs(v - stringV(i, u)) <= gapAt(u) * within ? i : -1;
  };
  // Half the fingerboard's width at u.
  const boardHalf = (u) => (gapAt(u) * (N - 1)) / 2 + gapAt(u) * 0.55;

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
    const i = stringAt(p.u, p.v, 0.62);
    if (i < 0) return null;
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
      const i = stringAt(p.u, p.v, 0.3);
      if (i >= 0) { pluck(i, 0.62); p.data.hit = i; }
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
        const y = stringV(i, p.u);
        if ((p.pv - y) * (p.v - y) < 0 && p.data.hit !== i) {
          pluck(i, Math.min(0.95, 0.4 + speed * 0.35));
        }
        if (p.data.hit === i && Math.abs(p.v - y) > gapAt(p.u) * 0.3) p.data.hit = null;
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

  function draw(g, s) {
    geom(s);
    const now = performance.now();
    put(g, s, layer(s, 'guitar', '', (c) => paint(c, s)));

    // the strings, nut to bridge (the banjo's short string from its own peg)
    for (let i = 0; i < N; i++) {
      const r = ring[i];
      const age = (now - r.at) / 1000;
      const amp = r.voice ? r.amp * Math.exp(-age * 2.2) : 0;
      const f = fretted(i);
      const isShort = short && i === short.string;
      const start = isShort ? G.fretAt(short.from) - 6 : G.nut;
      const from = f > 0 && !(isShort && f <= short.from) ? G.fretAt(f) - 2 : start;
      const muted = mode === 'chords' && f < 0;
      string(g, start, stringV(i, start), G.bridge, stringV(i, G.bridge), {
        width: widthOf(i),
        color: wound(i) ? look.wound : look.plain,
        wound: wound(i),
        amp: amp > 0.01 ? amp * Math.min(gapAt(G.bridge) * 0.22, 8) : 0,
        glow: amp > 0.05 ? amp : 0,
        t: now,
        freq: 1.6 + (N - i) * 0.25,
        from: (from - start) / (G.bridge - start),
        to: 1,
      });
      if (muted) {
        // a muted string: a finger lies across it, so it doesn't ring
        g.strokeStyle = 'rgba(0,0,0,.45)';
        g.lineWidth = widthOf(i) + 3;
        g.beginPath();
        g.moveTo(G.neckEnd, stringV(i, G.neckEnd));
        g.lineTo(G.bridge, stringV(i, G.bridge));
        g.stroke();
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
      const x = G.fretAt(f - 1) + (G.fretAt(f) - G.fretAt(f - 1)) * 0.6;
      const y = stringV(i, x);
      const r = Math.min(gapAt(x) * 0.36, 17);
      g.save();
      g.shadowColor = 'rgba(0,0,0,.5)';
      g.shadowBlur = 7;
      g.shadowOffsetX = 2;
      g.shadowOffsetY = 3;
      const fg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r * 1.2);
      fg.addColorStop(0, '#FFE3A4');
      fg.addColorStop(1, '#D9A24C');
      g.fillStyle = fg;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.strokeStyle = 'rgba(255,243,208,.9)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
    }
    // muted strings marked at the nut in chord mode
    if (mode === 'chords') {
      CHORDS[chord][1].forEach((f, i) => {
        if (f < 0) label(g, s, '✕', G.nut - 12, stringV(i, G.nut), { size: Math.min(16, gapAt(G.nut) * 0.5), color: '#E08A7A' });
      });
    }
  }

  /* ---- what doesn't move, painted once ---- */

  function paint(c, s) {
    const { W, H, mid } = G;
    c.fillStyle = '#15110E';
    c.fillRect(0, 0, W, H);
    pool(c, W * 0.6, mid, W * 0.65, '#3A2E25', 0.5, 0.8);
    if (look.top === 'drum') paintBanjo(c);
    else if (look.top === 'pickups') paintSolid(c);
    else paintAcoustic(c);
    paintNeck(c);
    paintHead(c);
    // the strings' ends past the bridge (and, on a banjo, to its tailpiece)
    for (let i = 0; i < N; i++) {
      const y = stringV(i, G.bridge);
      const end = look.top === 'drum' ? G.bridge + (W - G.bridge) * 0.55 : look.tie ? G.bridge + 14 : G.bridge + 8;
      const y2 = look.top === 'drum' ? mid + (y - mid) * 0.55 : y;
      string(c, G.bridge, y, end, y2, { width: widthOf(i), color: wound(i) ? look.wound : look.plain, wound: wound(i) });
      if (look.tie) {
        // tied round itself on the tie block, as nylon strings are
        c.strokeStyle = wound(i) ? look.wound : look.plain;
        c.lineWidth = widthOf(i);
        c.beginPath();
        c.ellipse(end + 3, y, 3.5, Math.max(2.5, widthOf(i) * 1.4), 0, 0, Math.PI * 2);
        c.stroke();
        c.strokeStyle = 'rgba(0,0,0,.3)';
        c.lineWidth = 0.8;
        c.stroke();
      }
    }
  }

  /* The body's edge near the neck: shoulders (an acoustic's), or horns (a solid body's). */
  function bodyPath(c) {
    const { neckEnd, mid, H, W } = G;
    const nh = boardHalf(neckEnd) * 0.95;
    c.beginPath();
    if (look.horns) {
      const hl = W * 0.075;                       // the upper horn reaches up the neck
      const hl2 = W * 0.04;
      c.moveTo(W + 20, -20);
      c.lineTo(neckEnd + W * 0.07, -20);
      c.bezierCurveTo(neckEnd + W * 0.01, mid - nh - H * 0.16, neckEnd - hl - 10, mid - nh - H * 0.12, neckEnd - hl, mid - nh - H * 0.03);
      c.quadraticCurveTo(neckEnd - hl + 4, mid - nh, neckEnd - hl + 18, mid - nh);
      c.lineTo(neckEnd + 2, mid - nh);
      c.lineTo(neckEnd + 2, mid + nh);
      c.lineTo(neckEnd - hl2 + 14, mid + nh);
      c.quadraticCurveTo(neckEnd - hl2, mid + nh, neckEnd - hl2, mid + nh + H * 0.04);
      c.bezierCurveTo(neckEnd - hl2 - 6, mid + nh + H * 0.14, neckEnd + W * 0.02, mid + nh + H * 0.2, neckEnd + W * 0.08, H + 20);
      c.lineTo(W + 20, H + 20);
    } else {
      const fl = W * (look.small ? 0.06 : 0.05);
      c.moveTo(W + 20, -20);
      c.lineTo(neckEnd + fl + 6, -20);
      c.bezierCurveTo(neckEnd + fl * 0.6, mid - nh - H * 0.2, neckEnd + 4, mid - nh - H * 0.05, neckEnd + 2, mid - nh);
      c.lineTo(neckEnd + 2, mid + nh);
      c.bezierCurveTo(neckEnd + 4, mid + nh + H * 0.05, neckEnd + fl * 0.6, mid + nh + H * 0.2, neckEnd + fl + 6, H + 20);
      c.lineTo(W + 20, H + 20);
    }
    c.closePath();
  }

  /* A classical guitar or a ukulele: wood top, binding, sound hole and rosette, tie bridge. */
  function paintAcoustic(c) {
    const { neckEnd, mid, H, W, bridge, hole } = G;
    const top = () => wood(c, look.wood, { scale: 1.2, seed: 3 });
    c.save();
    bodyPath(c);
    c.shadowColor = 'rgba(0,0,0,.6)';
    c.shadowBlur = 18;
    c.fillStyle = top();
    c.fill();
    c.restore();
    c.save();
    bodyPath(c);
    c.clip();
    const light = c.createLinearGradient(0, 0, 0, H);
    light.addColorStop(0, 'rgba(0,0,0,.25)');
    light.addColorStop(0.4, 'rgba(255,240,210,.1)');
    light.addColorStop(1, 'rgba(0,0,0,.3)');
    c.fillStyle = light;
    c.fillRect(0, 0, W, H);
    // the binding round the edge, and the purfling strips inside it
    bodyPath(c);
    const strips = look.rosette
      ? [[26, '#1A0C05'], [23, '#E8D6B0'], [21, '#7A2E1E'], [19, '#E8D6B0'], [17, '#1A0C05'], [14, look.binding]]
      : [[16, '#1A0C05'], [13, look.binding]];
    for (const [w, st] of strips) { c.lineWidth = w; c.strokeStyle = st; c.stroke(); }
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(255,230,190,.35)';
    c.stroke();
    // the sound hole, its rosette, and the maker's label glimpsed inside
    const hr = Math.min(H * (look.small ? 0.3 : 0.34), (bridge - neckEnd) * 0.3);
    if (look.rosette) {
      const tiles = 90;
      for (let ring2 = 0; ring2 < 3; ring2++) {
        const r0 = hr + 10 + ring2 * 5;
        for (let k = 0; k < tiles; k++) {
          const a0 = (k / tiles) * Math.PI * 2;
          const a1 = ((k + 1) / tiles) * Math.PI * 2;
          c.beginPath();
          c.arc(hole, mid, r0 + 5, a0, a1);
          c.arc(hole, mid, r0, a1, a0, true);
          c.closePath();
          c.fillStyle = ['#7A2E1E', '#E8D6B0', '#2E4A2E', '#C9A050'][(k + ring2 * 2) % 4];
          c.fill();
        }
      }
      for (const [r, w, st] of [[hr + 6, 2.5, '#1A0C05'], [hr + 9, 1.5, '#E8D6B0'], [hr + 26, 1.5, '#E8D6B0'], [hr + 29, 2.5, '#1A0C05'], [hr + 34, 1.2, '#1A0C05']]) {
        c.beginPath();
        c.arc(hole, mid, r, 0, Math.PI * 2);
        c.lineWidth = w;
        c.strokeStyle = st;
        c.stroke();
      }
    } else {
      for (const [r, w, st] of [[hr + 6, 3, '#F1E6CF'], [hr + 11, 1.5, '#1A0C05'], [hr + 15, 2, '#F1E6CF']]) {
        c.beginPath();
        c.arc(hole, mid, r, 0, Math.PI * 2);
        c.lineWidth = w;
        c.strokeStyle = st;
        c.stroke();
      }
    }
    c.beginPath();
    c.arc(hole, mid, hr, 0, Math.PI * 2);
    const inside = c.createRadialGradient(hole - hr * 0.2, mid - hr * 0.2, hr * 0.1, hole, mid, hr);
    inside.addColorStop(0, '#2A1A10');
    inside.addColorStop(1, '#0C0705');
    c.fillStyle = inside;
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = 'rgba(236,224,196,.5)';
    c.translate(hole + hr * 0.5, mid + hr * 0.28);
    c.rotate(-0.1);
    c.fillRect(-hr * 0.3, -hr * 0.2, hr * 0.6, hr * 0.4);
    c.fillStyle = 'rgba(60,40,20,.35)';
    for (let k = 0; k < 3; k++) c.fillRect(-hr * 0.22, -hr * 0.1 + k * hr * 0.09, hr * (k === 0 ? 0.44 : 0.3), 1.5);
    c.restore();
    c.beginPath();
    c.arc(hole, mid, hr, 0, Math.PI * 2);
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(255,230,190,.35)';
    c.stroke();
    c.restore();
    // the bridge: rosewood, with a bone saddle the strings press on, then the tie block
    const half = (gapAt(bridge) * (N - 1)) / 2;
    const bw = clamp(W * 0.022, 16, 34);
    c.save();
    c.beginPath();
    c.moveTo(bridge - bw * 0.55, mid - half - gapAt(bridge) * 0.8);
    c.quadraticCurveTo(bridge - bw * 0.7, mid - half - gapAt(bridge) * 1.6, bridge + bw * 0.4, mid - half - gapAt(bridge) * 2);
    c.lineTo(bridge + bw * 1.05, mid - half - gapAt(bridge) * 1.6);
    c.lineTo(bridge + bw * 1.05, mid + half + gapAt(bridge) * 1.6);
    c.lineTo(bridge + bw * 0.4, mid + half + gapAt(bridge) * 2);
    c.quadraticCurveTo(bridge - bw * 0.7, mid + half + gapAt(bridge) * 1.6, bridge - bw * 0.55, mid + half + gapAt(bridge) * 0.8);
    c.closePath();
    c.shadowColor = 'rgba(0,0,0,.5)';
    c.shadowBlur = 8;
    c.shadowOffsetX = 3;
    c.shadowOffsetY = 4;
    c.fillStyle = wood(c, 'rosewood', { angle: 90, scale: 0.7, seed: 6 });
    c.fill();
    c.restore();
    // a mosaic strip on the tie block, to match the rosette
    if (look.rosette) {
      const tx = bridge + bw * 0.72;
      for (let k = 0; k < 24; k++) {
        c.fillStyle = ['#7A2E1E', '#E8D6B0', '#2E4A2E', '#C9A050'][k % 4];
        const y0 = mid - half - gapAt(bridge) * 1.2;
        const step = (half * 2 + gapAt(bridge) * 2.4) / 24;
        c.fillRect(tx, y0 + k * step, 4, step);
      }
    }
    c.fillStyle = metal(c, 'nickel', bridge - 3, 0, bridge + 3, 0);
    c.fillStyle = '#F2EBDA';
    rr(c, bridge - 3, mid - half - gapAt(bridge) * 0.55, 6, half * 2 + gapAt(bridge) * 1.1, 2);
    c.fill();
    c.fillStyle = 'rgba(0,0,0,.2)';
    c.fillRect(bridge + 2, mid - half - gapAt(bridge) * 0.55, 1, half * 2 + gapAt(bridge) * 1.1);
  }

  /* An electric guitar or bass: a painted solid body, a pickguard with its screws, pickups
     under the strings, knobs, and a steel bridge with a saddle for each string. */
  function paintSolid(c) {
    const { neckEnd, mid, H, W, bridge } = G;
    c.save();
    bodyPath(c);
    c.shadowColor = 'rgba(0,0,0,.65)';
    c.shadowBlur = 20;
    c.fillStyle = look.paint;
    c.fill();
    c.restore();
    c.save();
    bodyPath(c);
    c.clip();
    // deep lacquer: darker at the edges, where the body rounds over, a sheen across it
    const lac = c.createLinearGradient(0, 0, 0, H);
    lac.addColorStop(0, 'rgba(0,0,0,.45)');
    lac.addColorStop(0.25, 'rgba(255,255,255,.08)');
    lac.addColorStop(0.5, 'rgba(255,255,255,0)');
    lac.addColorStop(1, 'rgba(0,0,0,.5)');
    c.fillStyle = lac;
    c.fillRect(0, 0, W, H);
    gloss(c, neckEnd, 0, W - neckEnd, H, { alpha: 0.16, at: 0.3, across: true });
    bodyPath(c);
    c.lineWidth = 14;
    c.strokeStyle = 'rgba(255,255,255,.12)';
    c.stroke();
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(0,0,0,.35)';
    c.stroke();
    // the pickguard: three layers, so its edge shows a black line
    const gx0 = neckEnd + 4;
    const gx1 = bridge - (bridge - neckEnd) * 0.12;
    const half = G.spread / 2;
    const guard = () => {
      c.beginPath();
      c.moveTo(gx0, mid - half * 0.95);
      c.bezierCurveTo(gx0 + (gx1 - gx0) * 0.3, mid - half * 1.32, gx0 + (gx1 - gx0) * 0.7, mid - half * 1.05, gx1, mid - half * 1.12);
      c.bezierCurveTo(gx1 + 30, mid - half * 0.4, gx1 - 10, mid + half * 0.4, gx1 + 10, mid + half * 1.15);
      c.bezierCurveTo(gx0 + (gx1 - gx0) * 0.6, mid + half * 1.45, gx0 + (gx1 - gx0) * 0.2, mid + half * 1.28, gx0, mid + half * 1.05);
      c.closePath();
    };
    c.save();
    guard();
    c.shadowColor = 'rgba(0,0,0,.45)';
    c.shadowBlur = 6;
    c.shadowOffsetY = 2;
    c.fillStyle = look.guard;
    c.fill();
    c.restore();
    guard();
    c.lineWidth = 3;
    c.strokeStyle = look.guard === '#1A1A1C' ? '#E8E2D4' : '#1A1A1C';
    c.stroke();
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(255,255,255,.25)';
    c.stroke();
    // its screws
    const sr = rand(8);
    for (let k = 0; k < 9; k++) {
      const t = k / 9;
      const x = gx0 + 14 + (gx1 - gx0 - 20) * (t < 0.5 ? t * 2 : (1 - t) * 2);
      const y = t < 0.5 ? mid - half * 1.12 + 12 : mid + half * 1.15 - 12;
      screw(c, x, y + (sr() - 0.5) * 6, 3.2, { kind: 'chrome', angle: sr() * 3 });
    }
    // the pickups, each with a pole piece under every string
    const n = look.pickups;
    for (let k = 0; k < n; k++) {
      const x = neckEnd + (bridge - neckEnd) * (n === 3 ? 0.2 + k * 0.24 : 0.3 + k * 0.36);
      const pw = clamp(gapAt(x) * 0.62, 18, 56);
      const slant = n === 3 && k === 2 ? 0.12 : 0;
      const ph = gapAt(x) * (N - 1) + gapAt(x) * 1.1;
      const split = o.look === 'bass' && k === 0;
      c.save();
      c.translate(x, mid);
      c.rotate(slant);
      for (const part of split ? [-1, 1] : [0]) {
        const y0 = split ? (part < 0 ? -ph / 2 : 0) + part * 4 : -ph / 2;
        const hh = split ? ph / 2 : ph;
        const dx = split ? part * pw * 0.35 : 0;
        c.fillStyle = 'rgba(0,0,0,.4)';
        rr(c, dx - pw / 2 + 2, y0 + 3, pw, hh, pw * 0.4);
        c.fill();
        const cover = c.createLinearGradient(dx - pw / 2, 0, dx + pw / 2, 0);
        const base = o.look === 'bass' ? '#1C1C1E' : '#EFE8D8';
        cover.addColorStop(0, base === '#1C1C1E' ? '#3A3A3E' : '#FFFBF0');
        cover.addColorStop(0.5, base);
        cover.addColorStop(1, base === '#1C1C1E' ? '#0E0E10' : '#CFC6B2');
        c.fillStyle = cover;
        rr(c, dx - pw / 2, y0, pw, hh, pw * 0.4);
        c.fill();
      }
      c.restore();
      for (let i = 0; i < N; i++) {
        const y = stringV(i, x);
        const off = split ? (i < N / 2 ? -1 : 1) * pw * 0.35 : 0;
        pin(c, x + off + (y - mid) * -slant, y, clamp(pw * 0.12, 2.4, 5), 'chrome');
      }
    }
    // knobs and the pickup switch
    const kr = clamp(H * 0.035, 9, 18);
    for (let k = 0; k < (o.look === 'bass' ? 2 : 3); k++) {
      const x = bridge - (bridge - neckEnd) * (0.1 + k * 0.14);
      const y = mid + half * 1.15 + kr * 1.6 + k * kr * 0.6;
      c.save();
      c.shadowColor = 'rgba(0,0,0,.5)';
      c.shadowBlur = 5;
      c.shadowOffsetY = 2;
      c.beginPath();
      c.arc(x, y, kr, 0, Math.PI * 2);
      c.fillStyle = o.look === 'bass' ? metal(c, 'chrome', x - kr, y - kr, x + kr, y + kr) : '#F1EADA';
      c.fill();
      c.restore();
      c.beginPath();
      c.arc(x, y, kr * 0.62, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(0,0,0,.18)';
      c.lineWidth = 1;
      c.stroke();
    }
    if (o.look !== 'bass') {
      const x = neckEnd + (bridge - neckEnd) * 0.62;
      const y = mid + half * 1.12;
      c.fillStyle = '#1A1A1C';
      rr(c, x - 22, y - 3, 44, 6, 3);
      c.fill();
      c.fillStyle = '#F1EADA';
      rr(c, x - 4, y - 6, 9, 12, 3);
      c.fill();
    }
    c.restore();
    // the bridge: a steel plate, a saddle under each string, height screws in them
    const bh = gapAt(bridge) * (N - 1) + gapAt(bridge) * 1.2;
    const bw = clamp(W * 0.03, 20, 40);
    c.save();
    c.shadowColor = 'rgba(0,0,0,.5)';
    c.shadowBlur = 6;
    c.shadowOffsetX = 2;
    c.shadowOffsetY = 3;
    c.fillStyle = metal(c, 'chrome', bridge - bw * 0.3, mid - bh / 2, bridge + bw, mid + bh / 2);
    rr(c, bridge - bw * 0.3, mid - bh / 2, bw * 1.3, bh, 4);
    c.fill();
    c.restore();
    for (let i = 0; i < N; i++) {
      const y = stringV(i, bridge);
      const sh = gapAt(bridge) * 0.78;
      c.fillStyle = metal(c, 'steel', 0, y - sh / 2, 0, y + sh / 2);
      rr(c, bridge - 4 + (i % 2) * 3, y - sh / 2, bw * 0.75, sh, 2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,.35)';
      c.lineWidth = 1;
      c.stroke();
      pin(c, bridge + bw * 0.45, y - sh * 0.25, 1.6, 'steel');
      pin(c, bridge + bw * 0.45, y + sh * 0.25, 1.6, 'steel');
    }
  }

  /* A banjo: a drum under the strings. A chrome hoop holds the head down with hooks and nuts
     all round; a thin maple bridge stands on the head; the strings go on to the tailpiece. */
  function paintBanjo(c) {
    const { neckEnd, mid, H, W, bridge } = G;
    const r = Math.max(G.spread * 1.2, (bridge - neckEnd) * 0.95);
    const cx = neckEnd - 6 + r;
    c.save();
    c.beginPath();
    c.rect(neckEnd - 30, 0, W - neckEnd + 30, H);
    c.clip();
    // the resonator's wooden flange, beyond the hoop
    c.beginPath();
    c.arc(cx, mid, r + 34, 0, Math.PI * 2);
    c.shadowColor = 'rgba(0,0,0,.6)';
    c.shadowBlur = 16;
    c.fillStyle = wood(c, 'mahogany', { angle: 30, seed: 2 });
    c.fill();
    c.shadowColor = 'transparent';
    c.beginPath();
    c.arc(cx, mid, r + 34, 0, Math.PI * 2);
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(255,230,190,.25)';
    c.stroke();
    // the head
    head(c, cx, mid, r, { kind: 'coated' });
    // the tension hoop, and the hooks with their nuts all round it
    c.beginPath();
    c.arc(cx, mid, r + 6, 0, Math.PI * 2);
    c.lineWidth = 12;
    c.strokeStyle = metal(c, 'chrome', cx - r, mid - r, cx + r, mid + r);
    c.stroke();
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(255,255,255,.6)';
    c.beginPath();
    c.arc(cx, mid, r + 2, 0, Math.PI * 2);
    c.stroke();
    const hooks = 24;
    for (let k = 0; k < hooks; k++) {
      const a = (k / hooks) * Math.PI * 2;
      const x = cx + Math.cos(a) * (r + 20);
      const y = mid + Math.sin(a) * (r + 20);
      c.save();
      c.translate(x, y);
      c.rotate(a);
      c.fillStyle = metal(c, 'chrome', -8, -3, 8, 3);
      rr(c, -14, -2.5, 22, 5, 2);
      c.fill();
      c.fillStyle = metal(c, 'nickel', -5, -5, 5, 5);
      c.beginPath();
      for (let q = 0; q < 6; q++) c.lineTo(Math.cos((q / 6) * Math.PI * 2) * 5 + 6, Math.sin((q / 6) * Math.PI * 2) * 5);
      c.closePath();
      c.fill();
      c.restore();
    }
    // the armrest, over the hoop where the picking arm lies
    c.beginPath();
    c.arc(cx, mid, r + 14, 0.25, 1.25);
    c.lineWidth = 10;
    c.strokeStyle = metal(c, 'chrome', cx, mid, cx + r, mid + r);
    c.stroke();
    // the tailpiece the strings go on to
    const tx = bridge + (W - bridge) * 0.55;
    const tw = gapAt(bridge) * (N - 1) * 0.7;
    c.save();
    c.shadowColor = 'rgba(0,0,0,.5)';
    c.shadowBlur = 8;
    c.shadowOffsetX = 3;
    c.shadowOffsetY = 3;
    c.beginPath();
    c.moveTo(tx - 6, mid - tw / 2 - 8);
    c.lineTo(W + 20, mid - tw * 0.3);
    c.lineTo(W + 20, mid + tw * 0.3);
    c.lineTo(tx - 6, mid + tw / 2 + 8);
    c.closePath();
    c.fillStyle = metal(c, 'chrome', tx, mid - tw, tx, mid + tw);
    c.fill();
    c.restore();
    c.restore();
    // the bridge: thin maple with an ebony top, standing on the head
    const bh = gapAt(bridge) * (N - 1) + gapAt(bridge) * 0.9;
    c.save();
    c.shadowColor = 'rgba(0,0,0,.45)';
    c.shadowBlur = 6;
    c.shadowOffsetX = 4;
    c.shadowOffsetY = 3;
    c.fillStyle = '#D6B27A';
    rr(c, bridge - 5, mid - bh / 2, 10, bh, 3);
    c.fill();
    c.restore();
    c.fillStyle = '#1A1210';
    c.fillRect(bridge - 1.5, mid - bh / 2 + 2, 3, bh - 4);
    for (const k of [0.25, 0.5, 0.75]) {
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.fillRect(bridge - 5, mid - bh / 2 + bh * k - 3, 10, 6);
    }
  }

  /* The fingerboard: its wood, inlays, frets and nut; a banjo's short string's peg. */
  function paintNeck(c) {
    const { nut, neckEnd, mid } = G;
    const path = () => {
      c.beginPath();
      c.moveTo(nut - 6, mid - boardHalf(nut));
      c.lineTo(neckEnd + 2, mid - boardHalf(neckEnd));
      c.lineTo(neckEnd + 2, mid + boardHalf(neckEnd));
      c.lineTo(nut - 6, mid + boardHalf(nut));
      c.closePath();
    };
    c.save();
    path();
    c.shadowColor = 'rgba(0,0,0,.6)';
    c.shadowBlur = 14;
    c.shadowOffsetX = 2;
    c.shadowOffsetY = 6;
    c.fillStyle = wood(c, look.board, { scale: 0.9, seed: 1 });
    c.fill();
    c.restore();
    c.save();
    path();
    c.clip();
    // a maple neck is lacquered pale gold; the others are oiled dark wood
    const cam = c.createLinearGradient(0, mid - boardHalf(neckEnd), 0, mid + boardHalf(neckEnd));
    cam.addColorStop(0, 'rgba(0,0,0,.3)');
    cam.addColorStop(0.4, look.board === 'maple' ? 'rgba(255,240,200,.15)' : 'rgba(255,255,255,.05)');
    cam.addColorStop(1, 'rgba(0,0,0,.35)');
    c.fillStyle = cam;
    c.fillRect(nut - 8, 0, neckEnd - nut + 12, G.H);
    // inlays: dots (pearl on dark wood, black on maple), fancier on a banjo
    const pearl = () => {
      const pg = c.createLinearGradient(0, mid - 10, 0, mid + 10);
      pg.addColorStop(0, '#FFFFFF');
      pg.addColorStop(0.5, '#D8E6EC');
      pg.addColorStop(1, '#F2E8F0');
      return pg;
    };
    for (const n of [3, 5, 7, 9, 12, 15]) {
      if (n > FRETS) continue;
      const x = (G.fretAt(n - 1) + G.fretAt(n)) / 2;
      const r = Math.min(9, gapAt(x) * 0.22);
      c.fillStyle = look.board === 'maple' ? '#1C1410' : pearl();
      if (look.top === 'drum') {
        // diamonds, and a double diamond at the twelfth
        const dw = (G.fretAt(n) - G.fretAt(n - 1)) * 0.3;
        for (const dy of n === 12 ? [-gapAt(x) * 0.9, gapAt(x) * 0.9] : [0]) {
          c.beginPath();
          c.moveTo(x - dw, mid + dy);
          c.lineTo(x, mid + dy - r * 1.6);
          c.lineTo(x + dw, mid + dy);
          c.lineTo(x, mid + dy + r * 1.6);
          c.closePath();
          c.fill();
        }
      } else if (n === 12) {
        c.beginPath();
        c.arc(x, mid - gapAt(x) * 1.5, r, 0, Math.PI * 2);
        c.arc(x, mid + gapAt(x) * 1.5, r, 0, Math.PI * 2);
        c.fill();
      } else {
        c.beginPath();
        c.arc(x, mid, r, 0, Math.PI * 2);
        c.fill();
      }
    }
    // frets: nickel silver wire, a highlight along each, a shadow behind
    for (let n = 1; n <= FRETS; n++) {
      const x = G.fretAt(n);
      const h = boardHalf(x);
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.fillRect(x + 1.5, mid - h, 2.5, h * 2);
      c.fillStyle = metal(c, 'nickel', x - 2, 0, x + 2, 0);
      c.fillRect(x - 2, mid - h, 4, h * 2);
    }
    c.restore();
    // the nut: bone
    const nh = boardHalf(nut);
    c.fillStyle = '#F1E9D6';
    c.fillRect(nut - 7, mid - nh, 7, nh * 2);
    c.fillStyle = 'rgba(0,0,0,.2)';
    c.fillRect(nut - 1.5, mid - nh, 1.5, nh * 2);
    // a banjo's short fifth string has its own peg, out of the side of the neck
    if (short) {
      const x = G.fretAt(short.from) - 6;
      const y = stringV(short.string, x);
      const side = y < mid ? -1 : 1;
      const edge = mid + side * boardHalf(x);
      pin(c, x, y, Math.min(4, gapAt(x) * 0.12), 'chrome');
      c.fillStyle = metal(c, 'chrome', x - 3, 0, x + 3, 0);
      c.fillRect(x - 2.5, Math.min(edge, edge + side * 10), 5, 10);
      c.beginPath();
      c.ellipse(x, edge + side * 18, 7, 9, 0, 0, Math.PI * 2);
      c.fillStyle = '#F1E9D6';
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,.25)';
      c.lineWidth = 1;
      c.stroke();
    }
  }

  /* The headstock, beyond the nut, where the strings go to their tuners. */
  function paintHead(c) {
    const { nut, mid } = G;
    const nh = boardHalf(nut);
    const x1 = nut - 7;
    const hh = nh * 1.25;
    const face = look.head === 'inline' ? (look.board === 'maple' ? 'maple' : 'rosewood') : look.head === 'peghead' ? 'ebony' : 'rosewood';
    c.save();
    c.beginPath();
    if (look.head === 'inline') {
      // six (or four) tuners in a line along one side
      c.moveTo(x1, mid - nh);
      c.lineTo(-10, mid - hh * 1.05);
      c.lineTo(-10, mid + nh * 0.6);
      c.quadraticCurveTo(x1 * 0.6, mid + nh * 0.75, x1, mid + nh);
    } else {
      c.moveTo(x1, mid - nh);
      c.lineTo(-10, mid - hh);
      c.lineTo(-10, mid + hh);
      c.lineTo(x1, mid + nh);
    }
    c.closePath();
    c.shadowColor = 'rgba(0,0,0,.6)';
    c.shadowBlur = 10;
    c.shadowOffsetY = 4;
    c.fillStyle = wood(c, face, { scale: 0.8, seed: 7 });
    c.fill();
    c.restore();
    // where each string goes: its post (or roller), along the headstock
    const posts = [];
    for (let i = 0; i < N; i++) {
      if (short && i === short.string) continue;
      let x;
      let y;
      if (look.head === 'inline') {
        x = x1 - 10 - (i / Math.max(1, N - 1)) * Math.max(10, x1 - 24);
        y = mid - nh * 0.55 - (i / Math.max(1, N - 1)) * nh * 0.25;
      } else if (look.head === 'slotted') {
        const side = i < N / 2 ? -1 : 1;
        const k = side < 0 ? i : N - 1 - i;
        x = x1 - 12 - k * Math.max(6, (x1 - 22) / 3);
        y = mid + side * nh * 0.42;
      } else {
        const strs = N - (short ? 1 : 0);
        const j = short && i > short.string ? i - 1 : i;
        const side = j < strs / 2 ? -1 : 1;
        const k = side < 0 ? j : strs - 1 - j;
        x = x1 - 12 - k * Math.max(8, (x1 - 20) / 2);
        y = mid + side * nh * 0.55;
      }
      posts.push({ i, x, y });
    }
    if (look.head === 'slotted') {
      // two slots, with white rollers across them
      for (const side of [-1, 1]) {
        c.fillStyle = '#120A06';
        rr(c, 2, mid + side * nh * 0.42 - nh * 0.16, x1 - 8, nh * 0.32, 3);
        c.fill();
      }
      for (const p of posts) {
        c.fillStyle = metal(c, 'nickel', 0, p.y - nh * 0.16, 0, p.y + nh * 0.16);
        c.fillStyle = '#EFE7D6';
        rr(c, p.x - 3, p.y - nh * 0.17, 6, nh * 0.34, 2);
        c.fill();
      }
    }
    for (const p of posts) {
      const w = widthOf(p.i);
      string(c, nut - 4, stringV(p.i, nut), p.x, p.y, { width: w, color: wound(p.i) ? look.wound : look.plain, wound: wound(p.i) });
      if (look.head !== 'slotted') pin(c, p.x, p.y, look.head === 'inline' ? clamp(nh * 0.09, 3, 6) : clamp(nh * 0.08, 3, 5), 'chrome');
      // the tuner's button, out of the side
      if (look.head !== 'inline') {
        const side = p.y < mid ? -1 : 1;
        const edge = mid + side * (look.head === 'slotted' ? nh : hh * 0.96);
        c.fillStyle = metal(c, 'chrome', p.x - 2, 0, p.x + 2, 0);
        c.fillRect(p.x - 2, Math.min(edge, edge + side * 8), 4, 8);
        c.beginPath();
        c.ellipse(p.x, edge + side * 15, clamp(nh * 0.1, 4, 8), clamp(nh * 0.13, 5, 10), 0, 0, Math.PI * 2);
        c.fillStyle = look.head === 'pegs' ? '#1A1512' : '#F1E9D6';
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,.3)';
        c.lineWidth = 1;
        c.stroke();
      }
    }
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
