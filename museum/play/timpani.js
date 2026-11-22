/* Timpani: four kettledrums of polished copper, 32, 29, 26 and 23 inches across, standing in
   an arc around the timpanist, biggest (lowest) on the left. Tap a head to strike it; the
   best sound is partway between the middle and the edge, as players strike them. Hold for a
   roll. Each drum's tuning gauge, on its rim nearest you, shows the note it is tuned to: drag
   along the gauge (or the pedal on the floor below) to tune it, and moving it while the drum
   rings slides the note. On a computer, A S D F strike the four drums (hold for a roll), Z X
   C V and Shift+Z X C V move their pedals down and up. */

import { surface, label, fine } from '../surface.js';
import { pitched, context, out } from '../audio.js';
import * as notes from '../notes.js';
import { layer, put, metal, rand, tint, bar, TAU } from '../paint.js';
import { camera, bounds, face, flange, ringBand, ripple, planks, spot, shade, stick } from '../drums.js';

const DRUMS = [
  { size: 32, lo: 38, hi: 45, tune: 43 },
  { size: 29, lo: 41, hi: 48, tune: 48 },
  { size: 26, lo: 46, hi: 53, tune: 50 },
  { size: 23, lo: 50, hi: 57, tune: 55 },
];
const KEYS = 'asdf';
const PEDAL_KEYS = 'zxcv';
/* Where each stands (inches from the timpanist): in an arc on a wide screen; on a tall one,
   two rows, the biggest two behind, far enough back that their pedals show. */
const WIDE = [[-46, 20], [-15, 31], [15, 31], [42, 22]];
const TALL = [[-16.5, 84], [16, 84], [-14.5, 4], [13.5, 4]];
const SPAN = 0.42;   // the gauge reaches this far (radians) each side of its middle

export async function mount(stage, ex, kit) {
  const [hits, rolls] = await Promise.all([pitched('timpani', 36, 58), pitched('timpani-roll', 36, 58)]);
  const box = document.createElement('div');
  box.className = 'zone timpani';
  stage.append(box);

  const drums = DRUMS.map((d) => ({ ...d, pitch: d.tune, voices: [], roll: null, at: 0, hx: 0, hy: 0, side: 1 }));
  const holds = new Map();   // pointer id -> { drum, timer } or { pedal }

  /* ---------- where everything is ---------- */

  let G = null;
  function geom(s) {
    const key = `${s.W}x${s.H}:${fine()}`;
    if (G?.key === key) return G;
    const tall = s.H > s.W * 1.05;
    const cam = camera(((tall ? 40 : 36) * Math.PI) / 180);
    const place = tall ? TALL : WIDE;
    const b = bounds();
    const up = (y, z) => y * cam.s + z * cam.c;
    const items = drums.map((d, i) => {
      const [x, y] = place[i];
      const r = d.size / 2;
      const z = 29 + (32 - d.size) * 0.22;     // the smaller drums stand a little taller
      // the gauge faces the player
      const face = -Math.PI / 2;
      const pedal = { x: x + Math.cos(face) * (r + 4), y: y + Math.sin(face) * (r + 4), a: face };
      b.add(x - r - 1.6, up(y, z) + r * cam.s + 3);
      b.add(x + r + 1.6, up(y, z) - r * cam.s - 6);
      b.add(x, up(y - r - 2, 0));
      b.add(pedal.x, up(pedal.y + Math.sin(face) * 7, 0));
      return { x, y, z, r, face, pedal };
    });
    const pad = Math.min(s.W, s.H) * 0.04;
    const lab = fine() ? 18 : 0;
    cam.fit(b.x0, b.x1, b.u0, b.u1, { x: pad, y: pad + 6, w: s.W - pad * 2, h: s.H - pad * 2 - 6 - lab });
    for (const it of items) {
      it.D = cam.disc(it.x, it.y, it.z, it.r, 0);
      // the pedal's footprint on the screen
      const corners = footplate(cam, it, 0.5);
      const xs = corners.map((p) => p[0]);
      const ys = corners.map((p) => p[1]);
      it.pbox = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    G = { key, tall, cam, items };
    return G;
  }

  /* The four corners of a pedal's footplate (f: how far it is pressed, 0 to 1). */
  function footplate(cam, it, f) {
    const { pedal: p } = it;
    const ux = Math.cos(p.a);
    const uy = Math.sin(p.a);
    const heel = 10;
    const toeZ = 8 - f * 5;
    const pt = (along, across, z) => cam.at(p.x + ux * along - uy * across, p.y + uy * along + ux * across, z);
    return [pt(-1, -3.2, 2.2 + (toeZ - 2.2) * 0.1), pt(-1, 3.2, 2.2 + (toeZ - 2.2) * 0.1), pt(heel, 3.6, 1.2), pt(heel, -3.6, 1.2)].map(([x, y], i) => (i < 2 ? [x, y - (toeZ - 2) * cam.k * cam.c * 0.9] : [x, y]));
  }

  /* A point on drum i's hoop at angle a (radians round it; its gauge's middle is it.face). */
  const onHoop = (it, a, out2 = 0) => G.cam.at(it.x + Math.cos(a) * (it.r + out2), it.y + Math.sin(a) * (it.r + out2), it.z + 0.5);

  /* ---------- playing ---------- */

  function strike(i, d = 0.6, hx = 0, hy = 0) {
    const dr = drums[i];
    // Struck near the middle a timpani sounds dull and short; near the edge, thin.
    const best = 1 - Math.min(1, Math.abs(d - 0.65) / 0.65);
    const c = context();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500 + best * 5000;
    f.connect(out());
    const v = hits.play(dr.pitch, { vol: 0.5 + best * 0.45, dest: f });
    dr.voices.push(v);
    if (dr.voices.length > 3) dr.voices.shift().stop(0.3);
    dr.at = performance.now();
    dr.hx = hx;
    dr.hy = hy;
    dr.side = -dr.side;
    kit.note(dr.pitch, 'fresh');
    s.animate(1500);
  }

  function startRoll(i) {
    const dr = drums[i];
    if (dr.roll) return;
    dr.roll = rolls.sustain({ attack: 0.25, release: 0.9 });
    dr.roll.start(dr.pitch, 0.8);
    kit.note(dr.pitch, 'show');
    kit.hit(i, { roll: true });
    s.animate(60000);
  }
  function stopRoll(i) {
    const dr = drums[i];
    if (!dr.roll) return;
    dr.roll.stop(0.9);
    dr.roll = null;
    if (!drums.some((d) => d.roll)) s.animating = performance.now() + 1200;
    s.redraw();
  }

  function setPitch(i, m) {
    const dr = drums[i];
    dr.pitch = Math.max(dr.lo, Math.min(dr.hi, m));
    for (const v of dr.voices) v.bend(dr.pitch, 0.05);
    dr.roll?.pitch(dr.pitch, 0.05);
    kit.note(dr.pitch, 'show');
    s.redraw();
  }

  /* Where (u, v) is on drum i's gauge, as a note; null if it isn't on it. */
  function gaugeAt(i, u, v, grow = 1) {
    const it = G.items[i];
    const { D } = it;
    const dx = (u - D.X) / D.rx;
    const dy = (v - D.Y) / D.ry;
    const rad = Math.hypot(dx, dy);
    if (rad < 0.86 / grow || rad > 1.0 + 0.3 * grow) return null;
    const a = Math.atan2(-dy, dx);
    let off = a - it.face;
    off = Math.atan2(Math.sin(off), Math.cos(off));
    if (Math.abs(off) > SPAN + 0.12 * grow) return null;
    const f = Math.max(0, Math.min(1, (off + SPAN) / (SPAN * 2)));
    return drums[i].lo + f * (drums[i].hi - drums[i].lo);
  }
  function pedalAt(i, u) {
    const b = G.items[i].pbox;
    const f = Math.max(0, Math.min(1, (u - b.x) / b.w));
    return drums[i].lo + f * (drums[i].hi - drums[i].lo);
  }
  const inPedal = (i, u, v) => {
    const b = G.items[i].pbox;
    const grow = Math.max(8, (48 - b.h) / 2);
    return u > b.x - 10 && u < b.x + b.w + 10 && v > b.y - grow && v < b.y + b.h + grow;
  };

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p) {
      geom(s);
      // the nearest drum's gauge and head first
      const order = G.items.map((_, i) => i).sort((a, b) => G.items[a].y - G.items[b].y);
      for (const i of order) {
        const m = gaugeAt(i, p.u, p.v);
        if (m != null) { holds.set(p.id, { gauge: i }); setPitch(i, m); return; }
        if (inPedal(i, p.u, p.v)) { holds.set(p.id, { pedal: i }); setPitch(i, pedalAt(i, p.u)); return; }
        const { D } = G.items[i];
        const hx = (p.u - D.X) / D.rx;
        const hy = (p.v - D.Y) / D.ry;
        const d = Math.hypot(hx, hy);
        if (d <= 1) {
          strike(i, d, hx, hy);
          const timer = setTimeout(() => startRoll(i), 230);
          holds.set(p.id, { drum: i, timer });
          return;
        }
      }
    },
    move(p) {
      const h = holds.get(p.id);
      if (!h) return;
      if (h.pedal != null) setPitch(h.pedal, pedalAt(h.pedal, p.u));
      if (h.gauge != null) {
        const m = gaugeAt(h.gauge, p.u, p.v, 3);
        if (m != null) setPitch(h.gauge, m);
      }
    },
    up(p) {
      const h = holds.get(p.id);
      holds.delete(p.id);
      if (h && h.drum != null) {
        clearTimeout(h.timer);
        if (![...holds.values()].some((x) => x.drum === h.drum)) stopRoll(h.drum);
      }
    },
  });
  s.onresize = () => { G = null; };

  /* ---------- drawing ---------- */

  function draw(g, s) {
    const now = performance.now();
    geom(s);
    put(g, s, layer(s, 'timpani', G.key, (c) => paintStill(c, s)));
    // the far drums first
    const order = G.items.map((_, i) => i).sort((a, b) => G.items[b].y - G.items[a].y);
    for (const i of order) {
      const dr = drums[i];
      const it = G.items[i];
      const { D } = it;
      const f = (dr.pitch - dr.lo) / (dr.hi - dr.lo);
      pedal(g, it, f);
      // the head, and the ripples spreading on it
      g.drawImage(headSprite(s, it), D.X - D.rx - 2, D.Y - D.ry - 2, D.rx * 2 + 4, D.ry * 2 + 4);
      const age = (now - dr.at) / 1000;
      if (dr.roll) {
        for (let k2 = 0; k2 < 3; k2++) ripple(g, D.X, D.Y, D.rx, D.ry, dr.hx * 0.4, dr.hy * 0.4, ((now / 1000 + k2 * 0.11) % 0.33), { color: '120,70,30', life: 0.33, strength: 0.6 });
      } else ripple(g, D.X, D.Y, D.rx, D.ry, dr.hx, dr.hy, age, { color: '120,70,30', life: 1.1 });
      gauge(g, s, it, dr, f);
      // the mallets
      if (dr.roll) {
        const t = now / 1000;
        mallet(g, it, dr.hx * 0.5 - 0.18, dr.hy * 0.5 + 0.1, Math.abs(Math.sin(t * 22)) * 3.5, -1);
        mallet(g, it, dr.hx * 0.5 + 0.18, dr.hy * 0.5 + 0.1, Math.abs(Math.cos(t * 22)) * 3.5, 1);
      } else if (age < 0.36) {
        const lift = Math.sin(Math.min(1, age / 0.2) * Math.PI / 2) * 7;
        mallet(g, it, dr.hx, dr.hy, lift, dr.side, age < 0.2 ? 1 : 1 - (age - 0.2) / 0.16);
      }
      if (fine()) {
        label(g, s, KEYS[i].toUpperCase(), D.X, D.Y - D.ry * 0.15, { size: 13, color: 'rgba(110,60,25,.5)' });
        const b = it.pbox;
        label(g, s, PEDAL_KEYS[i].toUpperCase(), b.x + b.w / 2, b.y + b.h + 11, { size: 11, color: 'rgba(246,241,228,.6)' });
      }
    }
  }

  /* The floor and, for each drum, its shadow, base, struts and copper bowl. */
  function paintStill(g, s) {
    const { cam, items } = G;
    g.fillStyle = '#140E0A';
    g.fillRect(0, 0, s.W, s.H);
    planks(g, s.W, s.H, cam, { kind: 'walnut', width: 6, tone: -0.35, seed: 6 });
    spot(g, s.W, s.H, s.W / 2, s.H * 0.45, Math.max(s.W, s.H) * 0.7, { light: 0.16, dark: 0.55 });
    const order = items.map((_, i) => i).sort((a, b) => items[b].y - items[a].y);
    for (const i of order) kettle(g, cam, items[i], i);
  }

  function kettle(g, cam, it, i) {
    const { D, x, y, z, r } = it;
    const k = cam.k;
    const depth = r * 1.12;                  // the bowl's depth below the rim
    const rb = r - 0.3;
    const bottom = z - depth;
    const [fx, fy] = cam.at(x, y, 0);
    shade(g, fx + k * 2, fy, r * k * 1.05, r * k * cam.s * 1.05, 0.6);
    // the base: a hub with three legs on casters; struts rise from the legs' ends to the
    // ring the bowl hangs from
    const legs = [Math.PI, 1.12, -1.12].map((a) => it.face + a);
    const foot = (a) => [x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82];
    const ringZ = z - 2.6;
    const strut = (a) => {
      const [lx, ly] = foot(a);
      const [sx0, sy0] = cam.at(lx, ly, 3.2);
      const [sx1, sy1] = cam.at(x + Math.cos(a) * (r + 0.7), y + Math.sin(a) * (r + 0.7), ringZ);
      bar(g, sx0, sy0, sx1, sy1, Math.max(1.6, k * 0.5), 'silver');
    };
    const [hx, hy] = cam.at(x, y, 5.5);
    const [, cy] = cam.at(x, y, bottom + 1);
    bar(g, hx, hy, hx, cy, Math.max(3, k * 1.6), 'silver');
    const order = legs.slice().sort((p, q) => Math.sin(q) - Math.sin(p));
    for (const a of order) {
      const [lx, ly] = foot(a);
      const [px, py] = cam.at(lx, ly, 2.6);
      bar(g, hx, hy, px, py, Math.max(2.5, k * 1.0), 'silver');
      // a caster under it
      g.fillStyle = '#18181A';
      g.beginPath();
      g.ellipse(px, py + k * 1.6 * cam.c, k * 1.2, k * 1.0, 0, 0, TAU);
      g.fill();
      g.fillStyle = metal(g, 'chrome', px - k, 0, px + k, 0);
      g.beginPath();
      g.ellipse(px, py, k * 0.9, k * 0.55, 0, 0, TAU);
      g.fill();
      if (Math.sin(a) > -0.2) strut(a);
    }
    // the copper bowl
    const X = D.X;
    const Y = D.Y;
    const R = rb * k;
    const ry = R * cam.s;
    const ryb = k * Math.hypot(rb * cam.s, depth * cam.c);
    g.beginPath();
    g.moveTo(X - R, Y);
    g.ellipse(X, Y, R, ryb, 0, Math.PI, 0, true);
    g.ellipse(X, Y, R, ry, 0, 0, Math.PI, true);
    g.closePath();
    g.save();
    g.clip();
    g.fillStyle = metal(g, 'copper', X - R, 0, X + R, 0);
    g.fillRect(X - R, Y - ry, R * 2, ryb + ry + 2);
    // darker toward the bottom, where it curves away from the light
    const dn = g.createRadialGradient(X - R * 0.25, Y + ryb * 0.1, R * 0.2, X, Y + ryb * 0.25, R * 1.2);
    dn.addColorStop(0, 'rgba(255,200,150,.16)');
    dn.addColorStop(0.5, 'rgba(60,20,0,0)');
    dn.addColorStop(1, 'rgba(40,12,0,.62)');
    g.fillStyle = dn;
    g.fillRect(X - R, Y - ry, R * 2, ryb + ry + 2);
    // the reflections of the hall's lights, curving with the bowl
    g.strokeStyle = 'rgba(255,240,222,.55)';
    g.lineWidth = R * 0.06;
    g.lineCap = 'round';
    g.beginPath();
    g.ellipse(X, Y, R * 0.6, ryb * 0.9, 0, Math.PI * 0.66, Math.PI * 0.84);
    g.stroke();
    g.strokeStyle = 'rgba(255,240,222,.22)';
    g.lineWidth = R * 0.035;
    g.beginPath();
    g.ellipse(X, Y, R * 0.84, ryb * 0.96, 0, Math.PI * 0.26, Math.PI * 0.4);
    g.stroke();
    g.lineCap = 'butt';
    // hammer marks, faint
    const rr = rand(i * 13 + 5);
    for (let n = 0; n < 90; n++) {
      const a = Math.PI * (0.04 + rr() * 0.92);
      const d = 0.25 + rr() * 0.72;
      const px = X + Math.cos(a) * R * d;
      const py = Y + Math.sin(a) * ryb * d;
      g.fillStyle = `rgba(${rr() < 0.5 ? '255,220,190' : '70,25,5'},${0.05 + rr() * 0.07})`;
      g.beginPath();
      g.ellipse(px, py, R * 0.035, R * 0.022, a, 0, TAU);
      g.fill();
    }
    g.restore();
    // the bowl's rolled lip and the ring it hangs from
    ringBand(g, X, Y, R + k * 0.25, cam.s, k * 0.9 * cam.c, 'copper');
    ringBand(g, X, Y + k * 2.4 * cam.c, R + k * 0.7, cam.s, k * 1.0 * cam.c, 'chrome');
    for (const a of order) if (Math.sin(a) <= -0.2) strut(a);
    // the counter hoop, and the tension rods' T-handles on it
    flange(g, X, Y, D.rx * 0.985, D.rx + k * 1.1, cam.s, 'chrome');
    ringBand(g, X, Y, D.rx + k * 1.1, cam.s, k * 0.8 * cam.c, 'chrome');
    for (let n = 0; n < 8; n++) {
      const a = it.face + Math.PI / 8 + (n / 8) * TAU;
      const [tx, ty] = onHoop(it, a, 0.6);
      const hw = k * 1.1;
      const up2 = k * 1.4 * cam.c;
      g.strokeStyle = 'rgba(0,0,0,.4)';
      g.lineWidth = Math.max(1.5, k * 0.45);
      g.beginPath();
      g.moveTo(tx - hw + 1, ty - up2 + 1.5);
      g.lineTo(tx + hw + 1, ty - up2 + 1.5);
      g.stroke();
      g.strokeStyle = metal(g, 'chrome', tx - hw, ty - up2 - k * 0.4, tx + hw, ty - up2 + k * 0.4);
      g.lineWidth = Math.max(1.2, k * 0.32);
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(tx, ty - up2);
      g.moveTo(tx - hw, ty - up2);
      g.lineTo(tx + hw, ty - up2);
      g.stroke();
    }
  }

  /* The head: calfskin-coloured plastic, painted once per drum. */
  function headSprite(s, it) {
    const { D } = it;
    if (!s.heads) s.heads = new Map();
    const key = `${G.key}:${D.rx}:${D.ry}`;
    let c = s.heads.get(key);
    if (!c) {
      const w = D.rx * 2 + 4;
      const h = D.ry * 2 + 4;
      c = document.createElement('canvas');
      c.width = Math.ceil(w * s.dpr);
      c.height = Math.ceil(h * s.dpr);
      const g = c.getContext('2d');
      g.scale(s.dpr, s.dpr);
      face(g, w / 2, h / 2, D.rx * 0.985, D.q, 'calf', 1.08);
      s.heads.set(key, c);
    }
    return c;
  }

  /* The tuning gauge: a plate on the rim marked with the notes, and a pointer. */
  function gauge(g, s, it, dr, f) {
    const { D } = it;
    const k = G.cam.k;
    const a0 = it.face - SPAN;
    const a1 = it.face + SPAN;
    const steps = 24;
    const arc = (out2) => Array.from({ length: steps + 1 }, (_, n) => onHoop(it, a0 + ((a1 - a0) * n) / steps, out2));
    const inner = arc(-1.8);
    const outer = arc(1.9);
    g.save();
    // the plate's shadow and the plate
    g.beginPath();
    inner.forEach(([x, y], n) => (n ? g.lineTo(x + 1.5, y + 2.5) : g.moveTo(x + 1.5, y + 2.5)));
    for (let n = steps; n >= 0; n--) g.lineTo(outer[n][0] + 1.5, outer[n][1] + 2.5);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fill();
    g.beginPath();
    inner.forEach(([x, y], n) => (n ? g.lineTo(x, y) : g.moveTo(x, y)));
    for (let n = steps; n >= 0; n--) g.lineTo(outer[n][0], outer[n][1]);
    g.closePath();
    const pl = g.createLinearGradient(inner[0][0], inner[0][1], outer[steps][0], outer[steps][1]);
    pl.addColorStop(0, '#EDEAE0');
    pl.addColorStop(0.5, '#FBF9F2');
    pl.addColorStop(1, '#D8D3C4');
    g.fillStyle = pl;
    g.fill();
    g.strokeStyle = 'rgba(60,50,40,.55)';
    g.lineWidth = 1;
    g.stroke();
    // a mark for each half step, longer at the notes of the scale, which are named
    const n0 = dr.lo;
    const n1 = dr.hi;
    for (let m = n0; m <= n1; m++) {
      const t = (m - n0) / (n1 - n0);
      const a = a0 + (a1 - a0) * t;
      const natural = !notes.full(m).includes('♯') && !notes.full(m).includes('♭');
      const [x0, y0] = onHoop(it, a, 1.6);
      const [x1, y1] = onHoop(it, a, natural ? 0.2 : 0.9);
      g.strokeStyle = natural ? 'rgba(40,30,25,.85)' : 'rgba(40,30,25,.45)';
      g.lineWidth = natural ? 1.4 : 1;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    }
    g.restore();
    // the note names on the scale (upright, so drawn outside the layer)
    const size = Math.max(9, Math.min(13, k * 1.35));
    for (let m = n0; m <= n1; m++) {
      const name = notes.full(m);
      if (name.includes('♯') || name.includes('♭')) continue;
      const a = a0 + ((a1 - a0) * (m - n0)) / (n1 - n0);
      const [x, y] = onHoop(it, a, -0.75);
      label(g, s, name.replace(/\d/, ''), x, y, { size, color: 'rgba(40,30,25,.8)', weight: 700 });
    }
    // the pointer
    const a = a0 + (a1 - a0) * f;
    const [px0, py0] = onHoop(it, a, -2.6);
    const [px1, py1] = onHoop(it, a, 2.6);
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = Math.max(2.5, k * 0.5);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(px0 + 1, py0 + 2);
    g.lineTo(px1 + 1, py1 + 2);
    g.stroke();
    g.strokeStyle = '#C0302A';
    g.lineWidth = Math.max(2, k * 0.36);
    g.beginPath();
    g.moveTo(px0, py0);
    g.lineTo(px1, py1);
    g.stroke();
    g.fillStyle = metal(g, 'chrome', px1 - 4, py1 - 4, px1 + 4, py1 + 4);
    g.beginPath();
    g.arc(px1, py1, Math.max(2.5, k * 0.45), 0, TAU);
    g.fill();
    g.lineCap = 'butt';
    // the note it is tuned to, on a little card by the gauge
    const [cx, cy] = onHoop(it, it.face, 4.4);
    const name = notes.full(Math.round(dr.pitch));
    const w = Math.max(34, size * 3.2);
    const h = size * 1.9;
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.beginPath();
    g.roundRect(cx - w / 2 + 1, cy - h / 2 + 2, w, h, h * 0.3);
    g.fill();
    g.fillStyle = '#F6F1E4';
    g.beginPath();
    g.roundRect(cx - w / 2, cy - h / 2, w, h, h * 0.3);
    g.fill();
    label(g, s, name, cx, cy + 0.5, { size: size * 1.15, color: '#6E3418', weight: 700 });
  }

  /* The pedal on the floor in front: its toe goes down as the note goes up. */
  function pedal(g, it, f) {
    const { cam } = G;
    const k = cam.k;
    const c = footplate(cam, it, f);
    const [ax, ay] = cam.at(it.pedal.x + Math.cos(it.pedal.a) * 9.5, it.pedal.y + Math.sin(it.pedal.a) * 9.5, 0);
    const [bx, by] = cam.at(it.x + Math.cos(it.pedal.a) * it.r * 0.7, it.y + Math.sin(it.pedal.a) * it.r * 0.7, 6);
    bar(g, ax, ay, bx, by, Math.max(2, k * 0.8), 'silver');
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.beginPath();
    c.forEach(([x, y], n) => (n ? g.lineTo(x + k * 0.6, y + k) : g.moveTo(x + k * 0.6, y + k)));
    g.fill();
    const gr = g.createLinearGradient(c[0][0], c[0][1], c[2][0], c[2][1]);
    gr.addColorStop(0, '#3A3C40');
    gr.addColorStop(0.5, '#6A6E74');
    gr.addColorStop(1, '#2A2C30');
    g.fillStyle = gr;
    g.beginPath();
    c.forEach(([x, y], n) => (n ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.strokeStyle = metal(g, 'chrome', c[0][0], c[0][1], c[1][0], c[1][1]);
    g.lineWidth = Math.max(1.4, k * 0.4);
    g.stroke();
    // its rubber ridges
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 1;
    for (let t = 0.15; t < 0.9; t += 0.12) {
      g.beginPath();
      g.moveTo(c[0][0] + (c[3][0] - c[0][0]) * t, c[0][1] + (c[3][1] - c[0][1]) * t);
      g.lineTo(c[1][0] + (c[2][0] - c[1][0]) * t, c[1][1] + (c[2][1] - c[1][1]) * t);
      g.stroke();
    }
  }

  /* A timpani mallet: a felt ball on a long wooden shaft, held from the player's side. */
  function mallet(g, it, hx, hy, lift, side, alpha = 1) {
    const { cam } = G;
    const D = it.D;
    const [tx, ty, tz] = cam.onDisc(D, Math.max(-0.9, Math.min(0.9, hx)), Math.max(-0.9, Math.min(0.9, hy)), lift + 1);
    const hand = [it.x * 0.55 + side * 9, -4, 38];
    const dx = hand[0] - tx;
    const dy = hand[1] - ty;
    const dz = hand[2] - tz;
    const len = Math.hypot(dx, dy, dz) || 1;
    const [x0, y0] = cam.at(tx, ty, tz);
    const [x1, y1] = cam.at(tx + (dx / len) * 14, ty + (dy / len) * 14, tz + (dz / len) * 14);
    const k = cam.k;
    g.save();
    g.globalAlpha = alpha;
    stick(g, x0, y0, x1, y1, Math.max(2.5, k * 0.42), { color: '#C99A62' });
    // the felt ball
    const rb = Math.max(4, k * 1.25);
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath();
    g.ellipse(x0 + rb * 0.3, y0 + rb * 0.5, rb, rb * 0.9, 0, 0, TAU);
    g.fill();
    const fg = g.createRadialGradient(x0 - rb * 0.35, y0 - rb * 0.4, rb * 0.1, x0, y0, rb);
    fg.addColorStop(0, '#FFFBF0');
    fg.addColorStop(0.6, '#E9E0CC');
    fg.addColorStop(1, '#B8AC94');
    g.fillStyle = fg;
    g.beginPath();
    g.arc(x0, y0, rb, 0, TAU);
    g.fill();
    // its seam
    g.strokeStyle = 'rgba(120,100,70,.4)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.ellipse(x0, y0, rb * 0.95, rb * 0.35, 0.5, 0, TAU);
    g.stroke();
    g.restore();
  }

  // Listen: before a tune the timpanist tunes the drums to its notes; a note no drum is tuned
  // to is reached by re-tuning the drum that has rung longest, after stopping it.
  const covers = (i, m) => m >= drums[i].lo && m <= drums[i].hi;
  let lastDrum = 0;
  function retune(i, m) {
    drums[i].voices.forEach((v) => v.stop(0.05));
    drums[i].voices = [];
    setPitch(i, m);
  }
  kit.performer({
    can: (e) => e.part === 'roll' || (e.midi != null && drums.some((_, i) => covers(i, Math.round(e.midi)))),
    prepare(evs) {
      const count = new Map();
      for (const e of evs) if (e.midi != null) count.set(Math.round(e.midi), (count.get(Math.round(e.midi)) || 0) + 1);
      const used = new Set();
      for (const m of [...count.keys()].sort((a, b) => count.get(b) - count.get(a))) {
        const free = drums.map((_, i) => i).filter((i) => !used.has(i) && covers(i, m));
        // the drum whose range it sits most comfortably in
        free.sort((a, b) => Math.abs(m - (drums[a].lo + drums[a].hi) / 2) - Math.abs(m - (drums[b].lo + drums[b].hi) / 2));
        if (free.length) { used.add(free[0]); retune(free[0], m); }
      }
    },
    down(e) {
      if (e.part === 'roll') { strike(lastDrum, 0.62, 0.1, 0.35); startRoll(lastDrum); return { roll: lastDrum }; }
      const m = Math.round(e.midi);
      let i = drums.findIndex((d) => Math.round(d.pitch) === m);
      if (i < 0) {
        i = drums.map((_, k) => k).filter((k) => covers(k, m)).sort((a, b) => drums[a].at - drums[b].at)[0];
        retune(i, m);
      }
      lastDrum = i;
      strike(i, 0.62, 0.12, 0.42);
      return null;
    },
    up(h) { if (h?.roll != null) stopRoll(h.roll); },
    finish() { drums.forEach((_, i) => stopRoll(i)); },
  });

  const keyHolds = new Map();
  function keydown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const i = KEYS.indexOf(k);
    if (i >= 0 && !e.repeat) {
      strike(i, 0.62, 0.1, 0.42);
      keyHolds.set(k, setTimeout(() => startRoll(i), 230));
      return;
    }
    const j = PEDAL_KEYS.indexOf(k);
    if (j >= 0) setPitch(j, Math.round(drums[j].pitch) + (e.shiftKey ? 1 : -1));
  }
  function keyup(e) {
    const k = e.key.toLowerCase();
    const i = KEYS.indexOf(k);
    if (i >= 0) { clearTimeout(keyHolds.get(k)); keyHolds.delete(k); stopRoll(i); }
  }
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);

  // For tests: where drum i's head, gauge (at a fraction f along it) and pedal are.
  s.canvas.museumAt = (what, i = 0, f = 0.5) => {
    geom(s);
    const it = G.items[i];
    if (!it) return null;
    if (what === 'head') return { u: it.D.X + it.D.rx * 0.1, v: it.D.Y + it.D.ry * 0.5 };
    if (what === 'gauge') { const [u, v] = onHoop(it, it.face - SPAN + SPAN * 2 * f, 0); return { u, v }; }
    if (what === 'pedal') return { u: it.pbox.x + it.pbox.w * f, v: it.pbox.y + it.pbox.h / 2 };
    return null;
  };
  s.canvas.museumPitch = (i) => drums[i].pitch;

  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    drums.forEach((d, i) => { stopRoll(i); d.voices.forEach((v) => v.stop(0.2)); });
    s.destroy();
  };
}
