/* Drum set, seen from the drummer's seat: a five-piece kit with real sizes (a 22-inch bass
   drum, a 14-inch snare, 10- and 12-inch toms on the bass drum, a 16-inch floor tom, 14-inch
   hi-hats, a 16-inch crash, a 10-inch splash and a 20-inch ride), each standing where a
   drummer would put it. Tap a drum or cymbal; nearer the middle of a drum is fuller. The
   snare's rim is a cross-stick, the ride's bell rings like a bell. Keep a finger on a cymbal
   to choke it. The hi-hat pedal: hold it to open the hi-hat, let go to close it. The bass
   drum plays from its pedal or its head. On a computer, the letters on each drum play it;
   Space is the bass drum. */

import { surface, label, fine } from '../surface.js';
import { hit } from '../audio.js';
import { layer, put, metal, rand, TAU, bar } from '../paint.js';
import { camera, bounds, sprite, drum, ripple, cymbal, stand, stick, planks, spot, shade } from '../drums.js';

/* Each part: what it is, its sound and key, its size and shell depth in inches, and where it
   stands, measured from the seat, for a wide screen and a tall one: [x right, y forward,
   z up, how far its face is tipped toward the drummer in degrees]. */
const PARTS = [
  { id: 'kick', kind: 'kick', sound: 'kit-kick', key: ' ', size: 22, depth: 18, wide: [2, 26, 11, 90], tall: [0, 26, 11, 90] },
  { id: 'floor', kind: 'drum', sound: 'kit-tom-low', key: 'g', size: 16, depth: 16, lugs: 8, wide: [22, 12, 21, 0], tall: [16.5, 12, 21, 0] },
  { id: 'tom1', kind: 'drum', sound: 'kit-tom-high', key: 'r', size: 10, depth: 8, lugs: 6, wide: [-5, 33, 33.5, 16], tall: [-6.5, 33, 35, 16] },
  { id: 'tom2', kind: 'drum', sound: 'kit-tom-high', key: 't', size: 12, depth: 9, lugs: 6, wide: [9.5, 35, 34.5, 16], tall: [8, 35, 36, 16] },
  { id: 'snare', kind: 'snare', sound: 'kit-snare', key: 'f', size: 14, depth: 5.5, lugs: 10, wide: [-8.5, 13, 25, 5], tall: [-9, 13, 25.5, 5] },
  { id: 'hihat', kind: 'hats', sound: 'kit-hihat-closed', key: 'h', size: 14, wide: [-25, 15, 35, 3], tall: [-20.5, 21, 39, 3] },
  { id: 'crash', kind: 'cymbal', sound: 'kit-crash', key: 'e', size: 16, wide: [-26, 37, 51, 24], tall: [-15, 45, 61, 26] },
  { id: 'splash', kind: 'cymbal', sound: 'kit-splash', key: 'w', size: 10, wide: [3, 50, 50, 24], tall: [8, 55, 58, 24] },
  { id: 'ride', kind: 'cymbal', sound: 'kit-ride', key: 'i', size: 20, wide: [34, 31, 41, 14], tall: [21, 37, 51, 14] },
  { id: 'pedal', kind: 'pedal', sound: 'kit-hihat-pedal', key: 'shift' },
];
const RATE = { tom2: 0.86, floor: 0.92 };
/* Each part's letter in lessons.js, and its name. */
const CODE = { kick: 'k', snare: 's', hihat: 'h', pedal: 'p', ride: 'r', crash: 'c', splash: 'w', tom1: 't', tom2: 'm', floor: 'f' };
const NAMES = { k: 'Kick', s: 'Snare', x: 'Cross-stick', h: 'Hi-hat', o: 'Open hi-hat', p: 'Hi-hat pedal', r: 'Ride', b: 'Ride bell', c: 'Crash', w: 'Splash', t: 'Tom 1', m: 'Tom 2', f: 'Floor tom' };
/* Which hand plays it: the right crosses over to the hi-hat. */
const HAND = { snare: -1, crash: -1, tom1: -1, splash: -1, hihat: 1, tom2: 1, floor: 1, ride: 1 };
/* A wine-red sparkle finish, chrome hardware, coated heads. */
const FINISH = { kind: 'sparkle', color: '#6E1020', gloss: 0.55 };

export async function mount(stage, ex, kit) {
  const names = [...new Set(PARTS.map((p) => p.sound))].concat(['kit-hihat-open', 'kit-cross-stick', 'kit-ride-bell', 'kit-snare-ghost']);
  const sounds = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await hit(n)])));

  const box = document.createElement('div');
  box.className = 'zone kit';
  stage.append(box);

  const ringing = new Map();   // part id -> voice (cymbals, open hi-hat)
  const anim = new Map();      // part id -> { at, hx, hy, power }
  const holds = new Map();     // pointer id -> { part, at }
  let open = false;            // hi-hat pedal lifted
  let keyPedal = false;

  /* ---------- where everything is ---------- */

  let G = null;
  function geom(s) {
    const key = `${s.W}x${s.H}:${fine()}`;
    if (G?.key === key) return G;
    const tall = s.H > s.W * 1.05;
    const cam = camera(((tall ? 50 : 52) * Math.PI) / 180);
    const at = (p) => p[tall ? 'tall' : 'wide'];
    const by = Object.fromEntries(PARTS.map((p) => [p.id, p]));
    // fit every part, its stand's feet and the pedals
    const b = bounds();
    const up = (y, z) => y * cam.s + z * cam.c;
    for (const p of PARTS) {
      if (p.kind === 'pedal') continue;
      const [x, y, z, phi] = at(p);
      const r = p.size / 2;
      const q = Math.sin(cam.tilt + (phi * Math.PI) / 180);
      const u = up(y, z);
      b.add(x - r - 1, u + r * q + 1.5);
      b.add(x + r + 1, u - r * q);
      if (p.kind !== 'kick') b.add(x, up(y - 11, 0));
    }
    const [kx, ky] = at(by.kick);
    const [hx, hy] = at(by.hihat);
    b.add(kx, up(ky - 17, 0));
    b.add(hx, up(hy - 15, 0));
    const pad = Math.min(s.W, s.H) * 0.035;
    const lab = fine() ? 22 : 0;
    cam.fit(b.x0, b.x1, b.u0, b.u1, { x: pad, y: pad, w: s.W - pad * 2, h: s.H - pad * 2 - lab });
    const parts = {};
    for (const p of PARTS) {
      if (p.kind === 'pedal') continue;
      const [x, y, z, phi] = at(p);
      parts[p.id] = { ...cam.disc(x, y, z, p.size / 2, (phi * Math.PI) / 180), part: p };
    }
    // the pedals: the bass drum's under the right foot, the hi-hat's under the left
    const pedals = {
      kick: { x: kx + 1.5, y0: ky - 15.5, y1: ky - 3.5 },
      hihat: { x: hx + 0.5, y0: hy - 14.5, y1: hy - 3 },
    };
    for (const pd of Object.values(pedals)) {
      const [X0, Y0] = cam.at(pd.x - 2.2, pd.y0, 0);
      const [X1, Y1] = cam.at(pd.x + 2.2, pd.y1, 4);
      pd.box = { x: X0, y: Y1, w: X1 - X0, h: Y0 - Y1 };
    }
    G = { key, tall, cam, parts, pedals, at, by };
    return G;
  }

  /* ---------- playing ---------- */

  function strike(id, touch = null) {
    const at = touch || { hx: 0, hy: 0, d: 0 };
    const part = PARTS.find((p) => p.id === id);
    const kind = part.kind;
    let name = part.sound;
    let vol = 0.85;
    if (kind === 'drum' || kind === 'snare') vol = 0.95 - at.d * 0.35;
    // How hard: a drum is hit hardest in the middle, a cymbal toward its edge. A computer key
    // plays a solid hit. Each strength has its own recordings, a different one every time.
    let vel = 0.8;
    if (touch) {
      if (kind === 'drum' || kind === 'snare' || kind === 'kick') vel = 1 - at.d * 0.6;
      else if (kind === 'cymbal') vel = 0.45 + at.d * 0.55;
      else if (kind === 'hats') vel = 1 - at.d * 0.5;
    }
    if (kind === 'snare' && at.d > 0.86) name = 'kit-cross-stick';
    if (id === 'ride' && at.d < 0.3) name = 'kit-ride-bell';
    if (kind === 'hats') {
      name = open ? 'kit-hihat-open' : 'kit-hihat-closed';
      ringing.get('hihat')?.stop(0.04);
    }
    if (kind === 'pedal') {
      ringing.get('hihat')?.stop(0.03);
      ringing.delete('hihat');
    }
    const v = sounds[name].play({ vol, vel, rate: RATE[id] || 1 });
    if (kind === 'cymbal' || (kind === 'hats' && open)) ringing.set(kind === 'hats' ? 'hihat' : id, v);
    anim.set(id, { at: performance.now(), hx: at.hx || 0, hy: at.hy || 0, power: vol, cross: name === 'kit-cross-stick' });
    s.animate(kind === 'cymbal' ? 2400 : kind === 'hats' && open ? 1200 : 700);
    const code = name === 'kit-cross-stick' ? 'x' : name === 'kit-ride-bell' ? 'b' : name === 'kit-hihat-open' ? 'o' : CODE[id];
    kit.hit(code);
  }

  const inBox = (b, u, v, grow) => u > b.x - grow && u < b.x + b.w + grow && v > b.y - grow && v < b.y + b.h + grow;

  /* What is under (u, v): the cymbals on top, then the pedals, then the drums. */
  function partAt(u, v) {
    const { parts, pedals } = geom(s);
    const near = (D) => {
      const hx = (u - D.X) / D.rx;
      const hy = (v - D.Y) / D.ry;
      return { hx, hy, d: Math.hypot(hx, hy) };
    };
    const { cam } = G;
    const cyms = ['hihat', 'crash', 'ride', 'splash'].sort((a, b) => cam.depth(parts[a].y, parts[a].z) - cam.depth(parts[b].y, parts[b].z));
    for (const id of cyms) {
      const D = parts[id];
      const lift = id === 'hihat' ? D.down * (open ? 1.3 : 0.25) : 0;
      const h = near({ ...D, Y: D.Y - lift });
      if (h.d <= 1.04) return { id, ...h, d: Math.min(1, h.d) };
    }
    const grow = Math.max(6, 22 - pedals.kick.box.w / 2);
    if (inBox(pedals.hihat.box, u, v, grow)) return { id: 'pedal', hx: 0, hy: 0, d: 0 };
    if (inBox(pedals.kick.box, u, v, grow)) return { id: 'kick', hx: 0, hy: 0.2, d: 0.2 };
    for (const id of ['snare', 'floor', 'tom1', 'tom2']) {
      const D = parts[id];
      const h = near(D);
      if (h.d <= 1.06) return { id, ...h, d: Math.min(1, h.d) };
    }
    // the bass drum: its head, or the top of its shell going away
    const K = parts.kick;
    const h = near(K);
    if (h.d <= 1.04) return { id: 'kick', ...h, d: Math.min(1, h.d) };
    const top = K.Y + K.part.depth * K.down;
    if (Math.abs(u - K.X) < K.rx && v > top - K.ry && v < K.Y) return { id: 'kick', hx: (u - K.X) / K.rx, hy: 0, d: 0.5 };
    return null;
  }

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p) {
      const h = partAt(p.u, p.v);
      if (!h) return;
      if (h.id === 'pedal') { open = true; s.redraw(); holds.set(p.id, { part: 'pedal', at: performance.now() }); return; }
      strike(h.id, h);
      holds.set(p.id, { part: h.id, at: performance.now() });
      const kind = PARTS.find((q) => q.id === h.id).kind;
      // A finger left on a cymbal grabs it: choke.
      if (kind === 'cymbal') {
        setTimeout(() => {
          const still = holds.get(p.id);
          if (still && still.part === h.id) { ringing.get(h.id)?.stop(0.06); ringing.delete(h.id); }
        }, 280);
      }
    },
    up(p) {
      const h = holds.get(p.id);
      holds.delete(p.id);
      if (h?.part === 'pedal' && ![...holds.values()].some((x) => x.part === 'pedal') && !keyPedal) {
        open = false;
        strike('pedal');
      }
    },
  });
  s.onresize = () => { G = null; };

  /* ---------- drawing ---------- */

  function draw(g, s) {
    const now = performance.now();
    const { cam, parts, pedals } = geom(s);
    put(g, s, layer(s, 'kit', G.key, (c) => paintKit(c, s)));
    pedal(g, pedals.kick, 'kick', now);
    pedal(g, pedals.hihat, 'hihat', now);
    // a struck head ripples
    for (const id of ['kick', 'floor', 'tom1', 'tom2', 'snare']) {
      const a = anim.get(id);
      if (!a) continue;
      const D = parts[id];
      const age = (now - a.at) / 1000;
      if (a.cross) continue;
      ripple(g, D.X, D.Y, D.rx * 0.95, D.ry * 0.95, id === 'kick' ? 0 : a.hx, id === 'kick' ? -0.25 : a.hy, age, { strength: a.power });
    }
    // cymbals, the farthest first
    const order = ['splash', 'ride', 'crash', 'hihat'].sort((a, b) => cam.depth(parts[b].y, parts[b].z) - cam.depth(parts[a].y, parts[a].z));
    for (const id of order) drawCymbal(g, s, parts[id], id, now);
    // the sticks, just after they land
    for (const [id, a] of anim) {
      if (!(id in HAND)) continue;
      const age = (now - a.at) / 1000;
      if (age > 0.32) continue;
      drawStick(g, parts[id], id, a, age);
    }
    if (fine()) {
      for (const p of PARTS) {
        let x;
        let y;
        if (p.kind === 'pedal') { const b = pedals.hihat.box; x = b.x + b.w / 2; y = b.y + b.h + 12; }
        else if (p.kind === 'kick') { const b = pedals.kick.box; x = b.x + b.w / 2; y = b.y + b.h + 12; }
        else {
          const D = parts[p.id];
          x = D.X;
          y = D.Y + D.ry + (p.depth ? p.depth * D.down : 0) + 12;
          if (p.kind === 'cymbal' || p.kind === 'hats') y = D.Y + D.ry + 11;
        }
        label(g, s, p.key === ' ' ? 'Space' : p.key === 'shift' ? 'Shift' : p.key.toUpperCase(), x, y, { size: 12, color: 'rgba(246,241,228,.7)' });
      }
    }
  }

  /* The still parts: the floor and rug, the stands and the drums. */
  function paintKit(g, s) {
    const { cam, parts, tall } = G;
    const k = cam.k;
    g.fillStyle = '#1A120D';
    g.fillRect(0, 0, s.W, s.H);
    planks(g, s.W, s.H, cam, { kind: 'oak', width: 5.5, tone: -0.42, seed: 4 });
    // the rug the kit stands on
    rug(g, cam, tall ? [-33, 37] : [-44, 51], [-14, 60]);
    const K = parts.kick;
    spot(g, s.W, s.H, K.X, K.Y - K.ry * 2, Math.max(s.W, s.H) * 0.75, { light: 0.12, dark: 0.5 });
    // shadows on the rug
    for (const id of ['floor', 'snare', 'hihat', 'crash', 'ride', 'splash']) {
      const D = parts[id];
      const [X, Y] = cam.at(D.x, D.y, 0);
      shade(g, X + k * 1.5, Y, D.rx * 0.95, D.rx * 0.95 * cam.s, id === 'floor' ? 0.5 : 0.32);
    }
    shade(g, K.X + k * 2, cam.Y(K.y + 9, 0), K.rx * 1.2, K.part.depth * k * cam.s * 0.9, 0.5);
    // the stands at the back
    for (const id of ['splash', 'crash', 'ride']) {
      const D = parts[id];
      stand(g, cam, D.x, D.y, D.z - 1.4, { spread: id === 'splash' ? 9 : 12, turn: id === 'ride' ? 0.4 : id === 'crash' ? -0.4 : 0 });
      tilter(g, cam, D);
    }
    // the bass drum, lying on its side, its shell going away from you
    const kd = K.part.depth;
    drum(g, K, kd, { finish: FINISH, lugs: 10, hoop: { ...FINISH, inlay: '#E9E1CC' }, hoopW: 0.9, hoopH: 1.6, head: 'coated', a0: Math.PI / 10, rods: false });
    kickHoop(g, K, kd);
    // the toms' holder, standing on the bass drum
    const [tx, ty] = cam.at(K.x + 1.5, K.y + kd * 0.45, K.z + K.r);
    for (const id of ['tom1', 'tom2']) {
      const D = parts[id];
      const [bx, byy] = cam.at(D.x + Math.sign(K.x + 1.5 - D.x) * D.r * 0.9, D.y + 1, D.z - D.part.depth * 0.55);
      bar(g, tx, ty, tx + (bx - tx) * 0.3, byy, Math.max(2, k * 0.75), 'silver');
      bar(g, tx + (bx - tx) * 0.3, byy, bx, byy, Math.max(2, k * 0.6), 'silver');
    }
    g.fillStyle = metal(g, 'chrome', tx - k * 1.2, 0, tx + k * 1.2, 0);
    g.beginPath();
    g.roundRect(tx - k * 1.1, ty - k * 1.6, k * 2.2, k * 2.4, k * 0.4);
    g.fill();
    for (const id of ['tom1', 'tom2']) {
      const D = parts[id];
      drum(g, D, D.part.depth, { finish: FINISH, lugs: D.part.lugs, hoopW: 0.28, a0: Math.PI / 6 });
    }
    // the floor tom on its three legs
    const F = parts.floor;
    floorLegs(g, cam, F, true);
    drum(g, F, F.part.depth, { finish: FINISH, lugs: 8, hoopW: 0.3, a0: Math.PI / 8 });
    floorLegs(g, cam, F, false);
    // the snare, in its stand's basket
    const S = parts.snare;
    snareStand(g, cam, S);
    drum(g, S, S.part.depth, { finish: FINISH, lugs: 10, hoopW: 0.3, hoopH: 0.75, a0: Math.PI / 10 });
    throwOff(g, S);
    // the hi-hat's stand (its cymbals move, so they are drawn each frame)
    const H = parts.hihat;
    stand(g, cam, H.x, H.y + 1, H.z - 0.6, { spread: 10, base: 11, turn: Math.PI / 3 });
  }

  /* A rug in a classic pattern: a deep red field with a medallion and a lattice of little
     flowers, a navy border with gold stars between cream lines, and a fringe at each end. */
  function rug(g, cam, [x0, x1], [y0, y1]) {
    const k = cam.k;
    const L = cam.X(x0);
    const R = cam.X(x1);
    const T = cam.Y(y1, 0);
    const B = cam.Y(y0, 0);
    const sy = cam.s;
    const W = R - L;
    const H = B - T;
    g.save();
    // fringe
    g.strokeStyle = 'rgba(232,220,190,.8)';
    g.lineWidth = Math.max(0.8, k * 0.18);
    for (let x = L + k; x < R - k * 0.5; x += k * 0.9) {
      g.beginPath();
      g.moveTo(x, T);
      g.lineTo(x + k * 0.15, T - k * 2.2 * sy);
      g.moveTo(x, B);
      g.lineTo(x - k * 0.1, B + k * 2.2 * sy);
      g.stroke();
    }
    // a shadow under its edges
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(L + k * 0.4, T + k * 0.6, W, H);
    g.beginPath();
    g.rect(L, T, W, H);
    g.clip();
    g.fillStyle = '#7C1F1E';
    g.fillRect(L, T, W, H);
    const bw = k * 5;
    const bh = bw * sy;
    // the field: a lattice of little four-petal flowers
    const flower = (x, y, r, c1, c2) => {
      g.fillStyle = c1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        g.beginPath();
        g.ellipse(x + dx * r * 0.55, y + dy * r * 0.55 * sy, r * 0.42, r * 0.42 * sy, 0, 0, TAU);
        g.fill();
      }
      g.fillStyle = c2;
      g.beginPath();
      g.ellipse(x, y, r * 0.3, r * 0.3 * sy, 0, 0, TAU);
      g.fill();
    };
    const step = k * 7;
    let row = 0;
    for (let y = T + bh * 1.6; y < B - bh; y += step * sy, row++) {
      for (let x = L + bw * 1.6 + (row % 2) * step * 0.5; x < R - bw; x += step) flower(x, y, k * 1.1, 'rgba(217,192,138,.5)', 'rgba(34,48,90,.8)');
    }
    // the medallion in the middle, and a quarter of one in each corner
    const medal = (cx, cy, mw, mh) => {
      g.fillStyle = '#22305A';
      g.beginPath();
      g.moveTo(cx, cy - mh);
      g.quadraticCurveTo(cx + mw * 0.3, cy - mh * 0.3, cx + mw, cy);
      g.quadraticCurveTo(cx + mw * 0.3, cy + mh * 0.3, cx, cy + mh);
      g.quadraticCurveTo(cx - mw * 0.3, cy + mh * 0.3, cx - mw, cy);
      g.quadraticCurveTo(cx - mw * 0.3, cy - mh * 0.3, cx, cy - mh);
      g.fill();
      g.strokeStyle = '#D9C08A';
      g.lineWidth = Math.max(1, k * 0.4);
      g.stroke();
      flower(cx, cy, Math.min(mw, mh / sy) * 0.28, '#B8862E', '#7C1F1E');
    };
    medal(L + W / 2, T + H / 2, W * 0.2, H * 0.2);
    for (const [cx, cy] of [[L + bw, T + bh], [R - bw, T + bh], [L + bw, B - bh], [R - bw, B - bh]]) medal(cx, cy, W * 0.12, H * 0.12);
    // the border: navy between cream lines, with stars
    const band = (inset, w, color) => {
      g.strokeStyle = color;
      g.lineWidth = w;
      g.strokeRect(L + inset, T + inset * sy, W - inset * 2, H - inset * sy * 2);
    };
    band(bw * 0.5, bw * 0.9, '#22305A');
    band(bw * 0.06, k * 0.5, '#D9C08A');
    band(bw * 0.98, k * 0.45, '#D9C08A');
    g.fillStyle = '#D9C08A';
    const star = (x, y, r) => {
      g.beginPath();
      g.moveTo(x, y - r * sy);
      g.lineTo(x + r * 0.6, y);
      g.lineTo(x, y + r * sy);
      g.lineTo(x - r * 0.6, y);
      g.closePath();
      g.fill();
    };
    for (let x = L + bw; x < R - bw * 0.6; x += bw * 0.9) { star(x, T + bh * 0.5, k * 1.2); star(x, B - bh * 0.5, k * 1.2); }
    for (let y = T + bh * 1.6; y < B - bh; y += bh * 0.9) { star(L + bw * 0.5, y, k * 1.2); star(R - bw * 0.5, y, k * 1.2); }
    // the wool: fine speckle
    const r = rand(9);
    for (let i = 0; i < 1400; i++) {
      const x = L + r() * W;
      const y = T + r() * H;
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.16)' : 'rgba(255,230,200,.07)';
      g.fillRect(x, y, k * 0.35, k * 0.35 * sy);
    }
    g.restore();
  }

  /* The bass drum's hoop has T-handled rods all round it, their handles toward you, and a
     felt patch where the beater lands. */
  function kickHoop(g, K, kd) {
    const k = K.k;
    const toward = Math.abs(K.down) * 1.3;    // 1.3 inches toward the drummer, on the screen
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 10 + (i / 10) * TAU + Math.PI / 2;
      if (Math.sin(a) < -0.75) continue;   // the ones by the floor, behind the pedal
      const x = K.X + Math.cos(a) * (K.rx + k * 0.75);
      const y = K.Y - Math.sin(a) * (K.ry + k * 0.75 * K.q);
      // the claw on the hoop
      g.fillStyle = metal(g, 'chrome', x - k * 0.5, 0, x + k * 0.5, 0);
      g.beginPath();
      g.roundRect(x - k * 0.35, y - k * 0.5, k * 0.7, k * 0.9, k * 0.2);
      g.fill();
      // the rod's end and its T-handle
      g.strokeStyle = 'rgba(0,0,0,.35)';
      g.lineWidth = Math.max(1.2, k * 0.34);
      g.beginPath();
      g.moveTo(x - k * 0.75 + 1, y + toward + 1.5);
      g.lineTo(x + k * 0.75 + 1, y + toward + 1.5);
      g.stroke();
      g.strokeStyle = metal(g, 'chrome', x - k * 0.75, y + toward - k * 0.3, x + k * 0.75, y + toward + k * 0.3);
      g.lineWidth = Math.max(1, k * 0.24);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + toward);
      g.stroke();
      g.lineWidth = Math.max(1.2, k * 0.3);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - k * 0.75, y + toward);
      g.lineTo(x + k * 0.75, y + toward);
      g.stroke();
      g.lineCap = 'butt';
    }
    // a felt patch where the beater lands
    g.fillStyle = 'rgba(40,40,44,.2)';
    g.beginPath();
    g.ellipse(K.X + k * 1.5, K.Y - K.ry * 0.28, k * 1.9, k * 1.9 * K.q, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(40,40,44,.18)';
    g.lineWidth = 1;
    g.stroke();
  }

  /* The swivel that tips a cymbal toward the drummer. */
  function tilter(g, cam, D) {
    const [x, y] = cam.at(D.x, D.y, D.z - 1.2);
    const k = cam.k;
    g.fillStyle = metal(g, 'chrome', x - k, 0, x + k, 0);
    g.beginPath();
    g.roundRect(x - k * 0.55, y - k * 0.4, k * 1.1, k * 1.4, k * 0.3);
    g.fill();
  }

  function floorLegs(g, cam, F, back) {
    const k = cam.k;
    for (const a of [Math.PI * 0.5, Math.PI * 1.18, Math.PI * 1.82]) {
      const isBack = Math.sin(a) > 0;
      if (isBack !== back) continue;
      const bx = F.x + Math.cos(a) * (F.r + 1.2);
      const byy = F.y + Math.sin(a) * (F.r + 1.2);
      const [x0, y0] = cam.at(bx, byy, F.z - 3);
      const [x1, y1] = cam.at(F.x + Math.cos(a) * (F.r + 3.5), F.y + Math.sin(a) * (F.r + 3.5), 0);
      bar(g, x0, y0, x1, y1, Math.max(1.6, k * 0.5), 'silver');
      g.fillStyle = '#16120F';
      g.beginPath();
      g.ellipse(x1, y1, k * 0.7, k * 0.45, 0, 0, TAU);
      g.fill();
      // the bracket on the shell
      g.fillStyle = metal(g, 'chrome', x0 - k, 0, x0 + k, 0);
      g.beginPath();
      g.roundRect(x0 - k * 0.7, y0 - k * 1.2, k * 1.4, k * 1.8, k * 0.3);
      g.fill();
    }
  }

  function snareStand(g, cam, S) {
    const z = S.z - S.part.depth - 0.8;
    const st = stand(g, cam, S.x, S.y, z, { spread: 10, base: 9, turn: Math.PI / 3, joint: 0.55 });
    // the basket's three arms reaching up to the bottom hoop
    const k = cam.k;
    for (const a of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.5]) {
      const [x1, y1] = cam.at(S.x + Math.cos(a) * (S.r - 0.6), S.y + Math.sin(a) * (S.r - 0.6) * Math.cos(S.phi), z + 0.6);
      bar(g, st.x, st.top, x1, y1, Math.max(1.4, k * 0.38), 'silver');
    }
  }

  /* The snare's strainer: the lever that sets the snares against the bottom head. */
  function throwOff(g, S) {
    const k = S.k;
    const a = Math.PI * 1.08;
    const x = S.X + Math.cos(a) * (S.rx + k * 0.4);
    const y = S.Y - Math.sin(a) * S.ry + S.part.depth * S.down * 0.45;
    g.fillStyle = metal(g, 'chrome', x - k * 0.8, 0, x + k * 0.8, 0);
    g.beginPath();
    g.roundRect(x - k * 0.55, y - k * 1.5, k * 1.1, k * 3, k * 0.35);
    g.fill();
    g.strokeStyle = metal(g, 'chrome', x - k, y, x + k, y);
    g.lineWidth = Math.max(1.4, k * 0.35);
    g.beginPath();
    g.moveTo(x, y - k * 1.2);
    g.lineTo(x - k * 1.3, y + k * 0.9);
    g.stroke();
  }

  /* A cymbal (or the hi-hat's pair), on its stand, rocking after it is struck. */
  function drawCymbal(g, s, D, id, now) {
    const a = anim.get(id);
    const age = a ? (now - a.at) / 1000 : 9;
    const rings = ringing.has(id) || (id === 'hihat' && open && ringing.has('hihat'));
    const amp = a ? Math.exp(-age * (rings ? 2.4 : 9)) * (rings ? 1 : 0.4) * (0.5 + a.power * 0.5) : 0;
    const wob = amp * Math.sin(age * 26) * 0.1;
    const turn = amp * Math.sin(age * 19 + 1) * 0.035;
    const lift = D.down * 0.9;
    const pad = 4;
    const w = D.rx * 2 + pad * 2;
    const h = D.ry * 2 + lift + pad * 2 + 3;
    const paintOne = (felt, seed) => sprite(s, `cym:${id}:${felt}`, w, h, (c) => cymbal(c, w / 2, pad + lift + D.ry, D.rx, D.ry, { lift, felt, seed, bell: id === 'hihat' ? 0.36 : 0.3 }));
    const blit = (c, dy, wobble, tw) => {
      g.save();
      g.translate(D.X, D.Y + dy);
      g.rotate(tw);
      g.scale(1, 1 + wobble);
      g.drawImage(c, -w / 2, -(pad + lift + D.ry), w, h);
      g.restore();
    };
    if (id === 'hihat') {
      const gap = D.down * (open ? 1.3 : 0.25);
      const k = D.k;
      blit(paintOne(false, 11), 0, 0, 0);
      // the clutch and pull rod
      blit(paintOne(true, 12), -gap, open ? wob : wob * 0.2, open ? turn : 0);
      g.strokeStyle = metal(g, 'chrome', D.X - k * 0.2, 0, D.X + k * 0.2, 0);
      g.lineWidth = Math.max(1, k * 0.25);
      g.beginPath();
      g.moveTo(D.X, D.Y - gap - lift - k * 0.8);
      g.lineTo(D.X, D.Y - gap - lift - k * 3.2);
      g.stroke();
    } else {
      blit(paintOne(true, id.length * 5), 0, wob, turn);
    }
    if (a && age < 0.4 && a.power) {
      // a flash of light where it was struck
      const fx = D.X + a.hx * D.rx;
      const fy = D.Y + a.hy * D.ry;
      const r = D.rx * (0.3 + age);
      const gr = g.createRadialGradient(fx, fy, 0, fx, fy, r);
      gr.addColorStop(0, `rgba(255,246,214,${0.45 * (1 - age / 0.4)})`);
      gr.addColorStop(1, 'rgba(255,246,214,0)');
      g.fillStyle = gr;
      g.fillRect(fx - r, fy - r, r * 2, r * 2);
    }
  }

  /* The bass drum's pedal and the hi-hat's: a footboard on the floor that tips down. */
  function pedal(g, pd, which, now) {
    const { cam } = G;
    const k = cam.k;
    const a = anim.get(which === 'kick' ? 'kick' : 'pedal');
    const age = a ? (now - a.at) / 1000 : 9;
    let press;
    if (which === 'kick') press = age < 0.18 ? Math.cos((age / 0.18) * Math.PI / 2) : 0;
    else press = open ? 0 : 1;
    const P = (x, y, z) => cam.at(pd.x + x, y, z);
    // the base plate
    const [b0x, b0y] = P(-2, pd.y0 - 1.5, 0);
    const [b1x, b1y] = P(2, pd.y1 + 1.5, 0);
    g.fillStyle = '#1C1C1E';
    g.beginPath();
    g.roundRect(b0x, b1y, b1x - b0x, b0y - b1y, k * 0.6);
    g.fill();
    // the frame: two posts and the axle, the spring on the right
    const fy = pd.y1 + 1.2;
    const postH = 7.5;
    for (const sx of [-2.6, 2.6]) {
      const [x0, y0] = P(sx, fy, 0);
      const [, y1] = P(sx, fy, postH);
      bar(g, x0, y0, x0, y1, Math.max(2, k * 0.7), 'silver');
    }
    const [ax0, ay] = P(-2.6, fy, postH - 0.6);
    const [ax1] = P(2.6, fy, postH - 0.6);
    bar(g, ax0, ay, ax1, ay, Math.max(1.6, k * 0.5), 'silver');
    // the toe end goes down when pressed
    const toe = which === 'kick' ? 4.2 - press * 1.8 : 4.6 - press * 3.2;
    const corners = [P(-1.7, pd.y0, 0.9), P(1.7, pd.y0, 0.9), P(1.9, pd.y1, toe), P(-1.9, pd.y1, toe)];
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.beginPath();
    corners.forEach(([x, y], i) => (i ? g.lineTo(x + k * 0.5, y + k * 0.8) : g.moveTo(x + k * 0.5, y + k * 0.8)));
    g.fill();
    const fb = g.createLinearGradient(corners[0][0], 0, corners[1][0], 0);
    fb.addColorStop(0, '#4A4D52');
    fb.addColorStop(0.35, '#9AA0A6');
    fb.addColorStop(0.6, '#5E6368');
    fb.addColorStop(1, '#2E3034');
    g.fillStyle = fb;
    g.beginPath();
    corners.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.5)';
    g.lineWidth = 1;
    g.stroke();
    // grip ridges
    g.strokeStyle = 'rgba(0,0,0,.28)';
    for (let f = 0.15; f < 0.9; f += 0.1) {
      const [lx, ly] = P(-1.5, pd.y0 + (pd.y1 - pd.y0) * f, 0.9 + (toe - 0.9) * f);
      const [rx] = P(1.5, 0, 0);
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(rx, ly);
      g.stroke();
    }
    // the chain from the toe up to the cam
    const [cx0, cy0] = P(0, pd.y1, toe);
    const [, cy1] = P(0, fy, postH - 0.6);
    g.strokeStyle = '#2A2A2C';
    g.lineWidth = Math.max(1.4, k * 0.4);
    g.setLineDash([k * 0.3, k * 0.25]);
    g.beginPath();
    g.moveTo(cx0, cy0);
    g.lineTo(cx0, cy1);
    g.stroke();
    g.setLineDash([]);
    if (which === 'kick') {
      // the beater: back at rest, against the head when it strikes
      const K = G.parts.kick;
      const len = 8;
      const back = 0.62 * (1 - press);
      const by0 = fy;
      const bz0 = postH - 0.6;
      const by1 = by0 + Math.sin(0.12 - back) * len;
      const bz1 = bz0 + Math.cos(0.12 - back) * len;
      const [sx0, sy0] = P(0, by0, bz0);
      const [sx1, sy1] = P(0, Math.min(by1, K.y - 1.2), bz1);
      bar(g, sx0, sy0, sx1, sy1, Math.max(1.4, k * 0.35), 'silver');
      // the felt beater head: a short cylinder lying across
      const bw = k * 1.3;
      const bh = k * 1.25 * (0.55 + 0.45 * cam.s);
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.beginPath();
      g.ellipse(sx1 + k * 0.3, sy1 + k * 0.5, bw, bh, 0, 0, TAU);
      g.fill();
      const fg = g.createLinearGradient(sx1 - bw, 0, sx1 + bw, 0);
      fg.addColorStop(0, '#9D978C');
      fg.addColorStop(0.3, '#F3EEE3');
      fg.addColorStop(0.7, '#D9D2C4');
      fg.addColorStop(1, '#8C867B');
      g.fillStyle = fg;
      g.beginPath();
      g.roundRect(sx1 - bw, sy1 - bh, bw * 2, bh * 2, bh * 0.8);
      g.fill();
      g.fillStyle = '#26262A';
      g.beginPath();
      g.roundRect(sx1 - bw * 0.22, sy1 - bh * 1.05, bw * 0.44, bh * 2.1, bw * 0.12);
      g.fill();
    } else {
      // the hi-hat's pull rod disappears up into the stand
      const H = G.parts.hihat;
      const [hx2, hy2] = cam.at(H.x, H.y + 1, 9);
      bar(g, cx0, cy1, hx2, hy2, Math.max(1, k * 0.3), 'silver');
    }
  }

  /* A drumstick from the hand to where it landed, bouncing back up. */
  function drawStick(g, D, id, a, age) {
    const { cam } = G;
    const side = HAND[id];
    const lift = Math.sin(Math.min(1, age / 0.16) * Math.PI / 2) * 5;
    const [tx, ty, tz] = cam.onDisc(D, a.cross ? -0.98 : Math.max(-0.9, Math.min(0.9, a.hx)), a.cross ? 0 : Math.max(-0.9, Math.min(0.9, a.hy)), lift + 0.4);
    // the hand: below and toward its own side
    const hand = [side * 7 + tx * 0.35, -2, 30];
    const dx = hand[0] - tx;
    const dy = hand[1] - ty;
    const dz = hand[2] - tz;
    const len = Math.hypot(dx, dy, dz) || 1;
    const L = 16;
    const [x0, y0] = cam.at(tx, ty, tz);
    const [x1, y1] = cam.at(tx + (dx / len) * L, ty + (dy / len) * L, tz + (dz / len) * L);
    const alpha = age < 0.18 ? 1 : 1 - (age - 0.18) / 0.14;
    stick(g, x0, y0, x1, y1, Math.max(3, cam.k * 0.6), { alpha, tip: 'wood' });
  }

  // Listen: the sticks (and feet) play each part by itself. A drum is hit harder nearer the
  // middle, a cymbal nearer the edge.
  const ID = Object.fromEntries(Object.entries(CODE).map(([id, c]) => [c, id]));
  kit.performer({
    levels: ['f', 'm', 't'],
    ladder: ['s', 'c+k'],
    names: NAMES,
    can: (e) => e.part != null && (e.part in ID || 'xob'.includes(e.part)),
    down(e) {
      const v = e.vel ?? 0.72;
      if (e.part === 'x') strike('snare', { hx: -0.92, hy: 0.2, d: 0.92 });
      else if (e.part === 'b') strike('ride', { hx: 0.05, hy: -0.05, d: 0.1 });
      else if (e.part === 'o') { open = true; strike('hihat', { hx: 0.3, hy: 0.4, d: 0.5 }); open = false; }
      else if (e.part === 'p') strike('pedal');
      else {
        const id = ID[e.part];
        const kind = PARTS.find((q) => q.id === id).kind;
        const d = kind === 'cymbal' ? Math.max(0, (v - 0.45) / 0.55) : kind === 'hats' ? (1 - v) * 2 : (1 - v) / 0.6;
        const dd = Math.max(0, Math.min(0.85, d));
        // a cymbal is struck toward the drummer's side of it, a drum near the middle
        strike(id, { hx: (HAND[id] || 0) * -0.15 * dd, hy: kind === 'cymbal' || kind === 'hats' ? dd : dd * 0.7, d: dd });
      }
      s.redraw();
      return null;
    },
    up() {},
    finish() {},
  });

  function keydown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Shift') { if (!e.repeat) { keyPedal = true; open = true; s.redraw(); } return; }
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    const p = PARTS.find((q) => q.key === k);
    if (!p) return;
    if (k === ' ') e.preventDefault();
    strike(p.id, { hx: 0.1, hy: 0.25, d: 0.3 });
  }
  function keyup(e) {
    if (e.key === 'Shift') { keyPedal = false; open = false; strike('pedal'); }
  }
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);

  // For tests: where a part is on the screen.
  s.canvas.museumAt = (id) => {
    const { parts, pedals } = geom(s);
    if (id === 'pedal') { const b = pedals.hihat.box; return { u: b.x + b.w / 2, v: b.y + b.h / 2 }; }
    if (id === 'kickpedal') { const b = pedals.kick.box; return { u: b.x + b.w / 2, v: b.y + b.h / 2 }; }
    const D = parts[id];
    if (!D) return null;
    const lift = id === 'hihat' ? D.down * (open ? 1.3 : 0.25) : 0;
    return { u: D.X, v: D.Y - lift, rx: D.rx, ry: D.ry };
  };

  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    for (const v of ringing.values()) v.stop(0.3);
    s.destroy();
  };
}
