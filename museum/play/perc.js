/* Single percussion instruments: snare drum, bass drum, cymbals, triangle, tambourine, gong,
   each drawn at its real size and as an orchestra's percussionist sees it.
   Tap to strike. Hold for a roll on the snare, triangle, tambourine and suspended cymbal;
   holding the crash cymbals chokes them, and a hand left on the bass drum or gong stops it.
   On a computer, Space strikes (hold it for a roll or to stop the sound). */

import { surface, label } from '../surface.js';
import { hit } from '../audio.js';
import { layer, put, metal, rand, bar, pool, wood, TAU } from '../paint.js';
import { camera, bounds, drum, face, flange, ripple, cymbal, stand, stick, planks, spot, shade, backdrop, sprite, shellPath, finish, roundness } from '../drums.js';

export const SPECS = {
  snare: { sound: 'snare', roll: 'snare-roll' },
  bassdrum: { sound: 'bass-drum', damp: true },
  cymbals: { sound: 'cymbal', choke: true, alt: { sound: 'sus-cymbal', roll: 'sus-cymbal-roll' } },
  triangle: { sound: 'triangle', roll: 'triangle-roll' },
  tambourine: { sound: 'tambourine', roll: 'tambourine-roll', shake: 'tambourine-shake' },
  gong: { sound: 'gong', damp: true, wait: 700 },
};
const rad = (d) => (d * Math.PI) / 180;
// the legs of a three-legged stand turned square to you: one straight back, two toward you
const LEGS = [Math.PI / 2, (Math.PI * 7) / 6, (Math.PI * 11) / 6];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export async function mount(stage, ex, kit) {
  const kind = ex.opts.kind;
  const base = SPECS[kind];
  let spec = base;
  const names = [base.sound, base.roll, base.shake, base.alt?.sound, base.alt?.roll].filter(Boolean);
  const sounds = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await hit(n)])));

  const box = document.createElement('div');
  box.className = `zone perc ${kind}`;
  stage.append(box);

  let ringing = [];
  let roll = null;
  let rollAt = 0;
  let last = { at: 0, x: 0, y: 0, power: 0, shake: false };
  let damped = 0;
  const holds = new Map();
  let suspended = false;

  function strike(d = 0.5, x = 0, y = 0) {
    let vol = 0.85;
    let filter = null;
    if (kind === 'snare') vol = 0.95 - d * 0.4;
    if (kind === 'bassdrum') { vol = 0.75 + (1 - d) * 0.25; filter = 600 + (1 - d) * 3000; }
    if (kind === 'gong') { vol = 0.6 + (1 - d) * 0.35; filter = 1500 + (1 - d) * 8000; }
    if (kind === 'triangle') vol = 0.8;
    // How hard (nearer the middle is harder): each strength has its own recordings, and a
    // different one plays each time, as no two real strokes sound quite alike.
    const vel = Math.max(0.05, Math.min(1, 1 - d * 0.75));
    const v = sounds[spec.sound].play({ vol, vel, filter });
    ringing.push(v);
    if (ringing.length > 4) ringing.shift().stop(0.3);
    last = { at: performance.now(), x, y, power: vol, shake: false };
    damped = 0;
    s.animate(kind === 'gong' ? 9000 : kind === 'cymbals' || kind === 'triangle' ? 3200 : 1000);
    kit.hit('x');
  }

  function hush(release = 0.08) {
    ringing.forEach((v) => v.stop(release));
    ringing = [];
    damped = performance.now();
    s.redraw();
  }

  function startRoll() {
    if (!spec.roll || roll) return;
    roll = sounds[spec.roll].play({ vol: 0.8, loop: true });
    rollAt = performance.now();
    s.animate(60000);
    kit.hit('x', { roll: true });
  }
  function stopRoll() {
    if (!roll) return;
    roll.stop(kind === 'triangle' || kind === 'cymbals' ? 0.6 : 0.12);
    roll = null;
    s.animating = performance.now() + 1500;
    s.redraw();
  }

  /* ---------- where the instrument is ---------- */

  let G = null;
  function geom(s) {
    const key = `${kind}:${suspended}:${s.W}x${s.H}`;
    if (G?.key === key) return G;
    const build = { snare: snareGeom, bassdrum: bassGeom, cymbals: suspended ? susGeom : crashGeom, triangle: triGeom, tambourine: tambGeom, gong: gongGeom }[kind];
    G = { key, tall: s.H > s.W * 1.05, ...build(s) };
    return G;
  }

  function hold(id) {
    const h = holds.get(id);
    if (!h) return;
    if (spec.roll) startRoll();
    else if (spec.choke) { hush(0.06); kit.hit('x', { choke: true }); }
    else if (spec.damp) { hush(0.15); kit.hit('x', { choke: true }); }
  }

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p) {
      const h = geom(s).hit(p.u, p.v);
      if (!h) return;
      // A second hand on a ringing bass drum or gong stops it at once.
      if (spec.damp && holds.size) { hush(0.12); kit.hit('x', { choke: true }); return; }
      strike(Math.min(1, h.d), h.x, h.y);
      const timer = setTimeout(() => hold(p.id), spec.wait || (spec.roll ? 220 : 320));
      holds.set(p.id, { timer });
    },
    up(p) {
      const h = holds.get(p.id);
      holds.delete(p.id);
      if (h) clearTimeout(h.timer);
      if (!holds.size) stopRoll();
    },
  });
  s.onresize = () => { G = null; };

  function draw(g, s) {
    const now = performance.now();
    geom(s);
    put(g, s, layer(s, 'perc', G.key, (c) => G.still(c, s)));
    const age = last.at ? (now - last.at) / 1000 : 99;
    G.live(g, s, now, age);
  }

  /* How much is still ringing (0 to 1), fading as it dies away. */
  const ringLevel = (age, decay) => (ringing.length && !damped ? Math.exp(-age * decay) : 0);

  /* ---------- the snare drum ---------- */

  function snareGeom(s) {
    const tall = s.H > s.W * 1.05;
    const area = tall ? { x: 0, y: 0, w: s.W, h: s.H * 0.66 } : { x: 0, y: 0, w: s.W * 0.63, h: s.H };
    const cam = camera(rad(tall ? 48 : 45));
    const R = 7;
    const depth = 6.5;
    const z = 30;
    const phi = rad(4);
    const q = Math.sin(cam.tilt + phi);
    const b = bounds();
    const up = (y, z2) => y * cam.s + z2 * cam.c;
    b.add(-R - 1.4, up(0, z) + R * q + 1.4);
    b.add(R + 1.4, up(0, z) - depth * Math.cos(cam.tilt + phi) - R * q);
    // the stand's feet: one leg straight back, two splayed toward you
    for (const a of LEGS) b.add(Math.cos(a) * 11, up(Math.sin(a) * 11, 0) - 0.6);
    const pad = Math.min(s.W, s.H) * 0.06;
    cam.fit(b.x0, b.x1, b.u0, b.u1, { x: area.x + pad, y: area.y + pad, w: area.w - pad * 2, h: area.h - pad * 2 }, 44);
    const D = cam.disc(0, 0, z, R, phi);
    const ir = tall ? Math.min(s.W * 0.4, s.H * 0.15) : Math.min(s.W * 0.15, s.H * 0.33);
    const inset = tall ? { cx: s.W / 2, cy: s.H * 0.835, r: ir } : { cx: s.W * 0.815, cy: s.H * 0.5, r: ir };
    const hitHead = (u, v) => {
      const x = (u - D.X) / D.rx;
      const y = (v - D.Y) / D.ry;
      const d = Math.hypot(x, y);
      return d <= 1.15 ? { d: Math.min(1, d), x, y } : null;
    };
    return {
      cam, D, depth, z, inset,
      hit: hitHead,
      at: (w) => (w === 'middle' ? [D.X, D.Y] : w === 'edge' ? [D.X + D.rx * 0.9, D.Y] : [6, s.H - 6]),
      still(g, s) {
        g.fillStyle = '#120C08';
        g.fillRect(0, 0, s.W, s.H);
        planks(g, s.W, s.H, cam, { kind: 'walnut', width: 6, tone: -0.38, seed: 2 });
        spot(g, s.W, s.H, D.X, D.Y, Math.max(s.W, s.H) * 0.7, { light: 0.16, dark: 0.55 });
        const [fx, fy] = cam.at(0, 0, 0);
        shade(g, fx + cam.k * 2, fy, D.rx * 1.3, D.rx * 1.3 * cam.s, 0.5);
        const zs = z - depth - 0.8;
        stand(g, cam, 0, 0, zs, { spread: 11, base: 10, turn: 0, joint: 0.5 });
        drum(g, D, depth, { finish: { kind: 'wood', wood: 'maple', color: '#7A3A12', stain: 0.3, gloss: 0.65, scale: 0.5 }, lugs: 10, hoopW: 0.3, hoopH: 0.8, a0: Math.PI / 10 });
        strainer(g, D, depth);
        // the basket's arms come out from under the drum and hook over its bottom hoop
        for (const a of [LEGS[1], LEGS[2]]) basketArm(g, D, depth, a);
        // the dotted line to the view from underneath
        const I = inset;
        g.save();
        g.setLineDash([4, 5]);
        g.strokeStyle = 'rgba(246,241,228,.35)';
        g.lineWidth = 1.5;
        g.beginPath();
        const bx = D.X + (G.tall ? 0 : D.rx * 0.95);
        const byy = D.Y + depth * D.down + (G.tall ? D.ry : 0);
        g.moveTo(bx, byy);
        g.lineTo(I.cx + (G.tall ? 0 : -I.r * 1.05), I.cy + (G.tall ? -I.r * 1.05 : 0));
        g.stroke();
        g.restore();
        underneathStill(g, I);
      },
      live(g, s, now, age) {
        const rolling = !!roll;
        if (rolling) {
          const t = (now - rollAt) / 1000;
          for (let k2 = 0; k2 < 3; k2++) ripple(g, D.X, D.Y, D.rx * 0.95, D.ry * 0.95, last.x * 0.4, last.y * 0.4, (t + k2 * 0.09) % 0.27, { life: 0.27, strength: 0.6 });
          // a roll: the sticks bounce an inch or so off the head, one after the other
          const lift = (ph) => Math.abs(Math.sin(t * 24 + ph)) * 1.3;
          snareStick(-0.16 + last.x * 0.3, 0.12 + last.y * 0.3, lift(0), -1, 1);
          snareStick(0.16 + last.x * 0.3, 0.12 + last.y * 0.3, lift(Math.PI / 2), 1, 1);
        } else {
          ripple(g, D.X, D.Y, D.rx * 0.95, D.ry * 0.95, last.x, last.y, age, { life: 0.7 });
          if (age < 0.34) snareStick(last.x, last.y, Math.sin(Math.min(1, age / 0.16) * Math.PI / 2) * 2.6, last.x < 0 ? -1 : 1, age < 0.18 ? 1 : 1 - (age - 0.18) / 0.16);
        }
        /* A stick from the player's hand, a few inches above the rim and in front of the
           drum, to its tip on (or just off) the head. */
        function snareStick(hx, hy, lift, side, alpha) {
          const [tx, ty, tz] = cam.onDisc(D, clamp(hx, -0.9, 0.9), clamp(hy, -0.9, 0.9), lift + 0.3);
          const hand = [side * 7 + tx * 0.3, -13, z + 4];
          const dx = hand[0] - tx;
          const dy = hand[1] - ty;
          const dz = hand[2] - tz;
          const len = Math.hypot(dx, dy, dz) || 1;
          const [x0, y0] = cam.at(tx, ty, tz);
          const [x1, y1] = cam.at(tx + (dx / len) * 16, ty + (dy / len) * 16, tz + (dz / len) * 16);
          stick(g, x0, y0, x1, y1, Math.max(3, cam.k * 0.6), { alpha });
        }
        const buzz = rolling ? 0.8 : age < 0.5 && !damped ? Math.exp(-age * 9) : 0;
        underneathLive(g, s, inset, buzz, now);
      },
    };
  }

  /* The strainer that holds the snares against the bottom head, and the butt plate opposite:
     each mounted low on the shell, near the bottom hoop where the snares are. */
  function strainer(g, D, depth) {
    const k = D.k;
    const h = depth * D.down;
    for (const [a, big] of [[Math.PI * 1.08, true], [Math.PI * 1.92, false]]) {
      const x = D.X + Math.cos(a) * (D.rx + k * 0.3);
      const yc = D.Y - Math.sin(a) * D.ry + h * 0.62;
      const bh = (big ? 2.5 : 1.7) * D.down;
      const bw = k * (big ? 1.0 : 0.85);
      // its shadow on the shell, then the body
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath();
      g.roundRect(x - bw / 2 - Math.cos(a) * k * 0.3, yc - bh / 2 + k * 0.2, bw, bh, bw * 0.3);
      g.fill();
      g.fillStyle = metal(g, 'chrome', x - bw / 2, 0, x + bw / 2, 0);
      g.beginPath();
      g.roundRect(x - bw / 2, yc - bh / 2, bw, bh, bw * 0.3);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,.3)';
      g.lineWidth = 0.7;
      g.stroke();
      // the screws that hold it to the shell
      g.fillStyle = 'rgba(40,40,44,.6)';
      for (const f of [-0.3, 0.3]) {
        g.beginPath();
        g.arc(x, yc + bh * f, Math.max(0.8, k * 0.1), 0, TAU);
        g.fill();
      }
      if (big) {
        // the throw-off lever, up (snares on), along the side of the body
        const lx = x + Math.cos(a) * bw * 0.55;
        g.strokeStyle = metal(g, 'chrome', lx - k * 0.3, 0, lx + k * 0.3, 0);
        g.lineWidth = Math.max(1.6, k * 0.3);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(lx, yc + bh * 0.4);
        g.lineTo(lx + Math.cos(a) * k * 0.45, yc - bh * 0.75);
        g.stroke();
        g.lineCap = 'butt';
        // the tension knob on top: a ribbed black cylinder
        const kw = k * 0.62;
        const kt = yc - bh / 2 - 0.55 * D.down;
        g.fillStyle = '#1E1E22';
        g.beginPath();
        g.roundRect(x - kw / 2, kt, kw, yc - bh / 2 - kt + 1, kw * 0.2);
        g.fill();
        g.fillStyle = '#3A3A40';
        g.beginPath();
        g.ellipse(x, kt, kw / 2, kw * 0.22, 0, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,.12)';
        g.lineWidth = 0.6;
        for (let i = 1; i < 4; i++) {
          g.beginPath();
          g.moveTo(x - kw / 2 + (kw * i) / 4, kt + 1);
          g.lineTo(x - kw / 2 + (kw * i) / 4, yc - bh / 2);
          g.stroke();
        }
      }
    }
  }

  /* One arm of the stand's basket: from under the drum up over its bottom hoop, with a rubber
     sleeve where it grips. */
  function basketArm(g, D, depth, a) {
    const k = D.k;
    const h = depth * D.down;
    const R = D.rx + k * 0.45;
    const x = D.X + Math.cos(a) * R;
    const y = D.Y - Math.sin(a) * D.ry + h;
    const bx = D.X + Math.cos(a) * (D.rx - k * 1.2);
    const by = y + k * 1.1;
    bar(g, bx, by, x, y + k * 0.5, Math.max(1.6, k * 0.32), 'silver');
    g.fillStyle = '#1C1A1A';
    g.beginPath();
    g.roundRect(x - k * 0.26, y - 0.7 * D.down, k * 0.52, k * 0.55 + 0.7 * D.down + k * 0.4, k * 0.2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.fillRect(x - k * 0.16, y - 0.6 * D.down, k * 0.08, k * 0.8);
  }

  /* The bottom head seen from underneath, with the snares (coiled wires) across it. */
  function underneathStill(g, I) {
    const { cx, cy, r } = I;
    g.save();
    // the frame round the view
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.beginPath();
    g.arc(cx + 2, cy + 4, r * 1.08, 0, TAU);
    g.fill();
    g.fillStyle = metal(g, 'brass', cx - r * 1.08, cy - r * 1.08, cx + r * 1.08, cy + r * 1.08);
    g.beginPath();
    g.arc(cx, cy, r * 1.08, 0, TAU);
    g.fill();
    g.fillStyle = '#1C1410';
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.clip();
    // the shell's edge and the bottom hoop
    g.fillStyle = wood(g, 'maple', { x: cx, y: cy, angle: 0, scale: 0.5 });
    g.beginPath();
    g.arc(cx, cy, r * 0.97, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(122,58,18,.35)';
    g.fill();
    flange(g, cx, cy, r * 0.84, r * 0.93, 1, 'chrome');
    // the snare-side head: thin, a little see-through
    face(g, cx, cy, r * 0.84, 1, 'coated', 0.92);
    g.restore();
    // the strainer and butt plate on the rim, the snares' cords running to them
    for (const side of [-1, 1]) {
      const x = cx + side * r * 0.89;
      g.fillStyle = metal(g, 'chrome', x - r * 0.05, cy - r * 0.12, x + r * 0.05, cy + r * 0.12);
      g.beginPath();
      g.roundRect(x - r * 0.05, cy - r * 0.15, r * 0.1, r * 0.3, r * 0.03);
      g.fill();
    }
  }
  function underneathLive(g, s, I, buzz, now) {
    const { cx, cy, r } = I;
    const n = 18;
    const half = r * 0.18;
    const x0 = cx - r * 0.66;
    const x1 = cx + r * 0.66;
    const rr = rand(Math.floor(now / 30));
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.clip();
    // the cords from the end plates to the strainer and the butt
    g.strokeStyle = '#2A2622';
    g.lineWidth = Math.max(1, r * 0.012);
    for (const [xa, xb] of [[x0, cx - r * 0.86], [x1, cx + r * 0.86]]) {
      for (const dy of [-half * 0.6, 0, half * 0.6]) {
        g.beginPath();
        g.moveTo(xa, cy + dy);
        g.lineTo(xb, cy + dy * 0.4);
        g.stroke();
      }
    }
    // the wires, buzzing against the head when it is struck
    for (let i = 0; i < n; i++) {
      const y = cy - half + (i / (n - 1)) * half * 2;
      const jig = buzz * (rr() - 0.5) * r * 0.025;
      g.strokeStyle = 'rgba(0,0,0,.25)';
      g.lineWidth = Math.max(1.2, r * 0.016);
      g.beginPath();
      g.moveTo(x0, y + 1.2);
      g.quadraticCurveTo(cx, y + 1.2 + jig * 2, x1, y + 1.2);
      g.stroke();
      g.strokeStyle = metal(g, 'steel', 0, y - 1.5, 0, y + 1.5);
      g.lineWidth = Math.max(1, r * 0.013);
      g.beginPath();
      g.moveTo(x0, y);
      g.quadraticCurveTo(cx, y + jig * 2, x1, y);
      g.stroke();
      // the coil
      g.strokeStyle = 'rgba(40,44,48,.4)';
      g.lineWidth = 0.7;
      g.setLineDash([0.8, Math.max(1.4, r * 0.012)]);
      g.beginPath();
      g.moveTo(x0, y);
      g.quadraticCurveTo(cx, y + jig * 2, x1, y);
      g.stroke();
      g.setLineDash([]);
    }
    // the end plates
    for (const x of [x0, x1]) {
      g.fillStyle = metal(g, 'brass', x - r * 0.04, cy - half, x + r * 0.04, cy + half);
      g.beginPath();
      g.roundRect(x - r * 0.035, cy - half * 1.15, r * 0.07, half * 2.3, r * 0.02);
      g.fill();
    }
    if (buzz > 0.05) {
      g.fillStyle = `rgba(255,250,235,${buzz * 0.15})`;
      g.fillRect(x0, cy - half * 1.2, x1 - x0, half * 2.4);
    }
    g.restore();
    label(g, s, 'Underneath: the snares', cx, cy + r * 1.08 + 16, { size: Math.max(11, Math.min(14, r * 0.11)), color: 'rgba(246,241,228,.75)' });
  }

  /* ---------- the bass drum ---------- */

  function bassGeom(s) {
    const tall = s.H > s.W * 1.05;
    const cam = camera(rad(11));
    const R = 18;
    const depth = 18;
    const yaw = rad(tall ? 18 : 30);
    const zc = R + 9;
    const ex2 = [Math.cos(yaw), -Math.sin(yaw)];
    const ax = [Math.sin(yaw), Math.cos(yaw)];
    // a point on the drum: angle a round it (0: its right side, π/2: the top), along inches
    // back from the front head, r from the axis
    const W3 = (a, along = 0, r = R) => [r * Math.cos(a) * ex2[0] + along * ax[0], r * Math.cos(a) * ex2[1] + along * ax[1], zc + r * Math.sin(a)];
    const b = bounds();
    const u3 = ([x, y, z]) => [x, y * cam.s + z * cam.c];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      b.add(...u3(W3(a, -2, R + 1.5)));
      b.add(...u3(W3(a, depth + 1, R + 1)));
    }
    for (const sx of [-1, 1]) for (const al of [-4, depth + 4]) b.add(...u3([sx * (R + 4) * ex2[0] + al * ax[0], sx * (R + 4) * ex2[1] + al * ax[1], 0]));
    const pad = Math.min(s.W, s.H) * 0.06;
    const floorAt = s.H * (tall ? 0.7 : 0.66);
    cam.fit(b.x0, b.x1, b.u0, b.u1, { x: pad, y: pad, w: s.W - pad * 2, h: s.H - pad * 2 });
    const P = (a, along, r) => cam.at(...W3(a, along, r));
    const ring = (along, r = R, n = 72) => Array.from({ length: n }, (_, i) => P((i / n) * TAU, along, r));
    const k = cam.k;
    const hitHead = (u, v) => {
      const [X0, Y0] = P(0, 0, 0);
      const dX = u - X0;
      const dY = v - Y0;
      const h = dX / (k * R * Math.cos(yaw));
      const vv = (h * Math.sin(yaw) * cam.s * k * R - dY) / (k * R * cam.c);
      const d = Math.hypot(h, vv);
      return d <= 1.1 ? { d: Math.min(1, d), x: h, y: -vv } : null;
    };
    // the wall behind: as far back as the stage is deep
    const [, wallY] = cam.at(0, 60, 0);
    return {
      cam, P, ring, R, depth, yaw, zc, hit: hitHead,
      at: (w) => (w === 'middle' ? P(0, -0.4, 0) : w === 'edge' ? P(0.5, -0.4, R * 0.88) : [6, 6]),
      still(g, s) {
        backdrop(g, s.W, s.H, Math.max(s.H * 0.25, wallY), cam, { color: '#4E1218' });
        spot(g, s.W, s.H, s.W / 2, s.H * 0.45, Math.max(s.W, s.H) * 0.75, { light: 0.16, dark: 0.5 });
        const [cx0, cy0] = cam.at(...W3(0, depth / 2, 0));
        const [, fy] = cam.at(cx0, 0, 0);
        shade(g, cx0, cam.Y(W3(0, depth / 2, 0)[1], 0), R * k * 1.4, R * k * 0.25, 0.6);
        // the cradle's far post, behind the drum
        cradle(g, -1);
        const n = 72;
        const L = [-0.55, -0.35, 0.76];   // toward the light (left, front, up)
        // how squarely the shell at angle a round the drum faces you, and how lit it is
        const facing = (a) => Math.cos(a) * Math.sin(yaw) * cam.c + Math.sin(a) * cam.s;
        const light = (a) => clamp(Math.cos(a) * ex2[0] * L[0] + Math.cos(a) * ex2[1] * L[1] + Math.sin(a) * L[2], -1, 1);
        /* A band round the drum from a0 to a1 inches back, r across: its strips that face you. */
        const band = (a0, a1, r, paint) => {
          const A = ring(a0, r, n);
          const B = ring(a1, r, n);
          for (let i = 0; i < n; i++) {
            const a = ((i + 0.5) / n) * TAU;
            if (facing(a) < 0) continue;
            const j = (i + 1) % n;
            g.beginPath();
            g.moveTo(A[i][0], A[i][1]);
            g.lineTo(A[j][0], A[j][1]);
            g.lineTo(B[j][0], B[j][1]);
            g.lineTo(B[i][0], B[i][1]);
            g.closePath();
            paint(a, light(a), A[i]);
          }
        };
        const shadeStrip = (lit, glow = 0.32, dark = 0.6) => {
          g.fillStyle = lit > 0 ? `rgba(255,236,210,${lit * glow})` : `rgba(0,0,0,${-lit * dark})`;
          g.fill();
          g.strokeStyle = g.fillStyle;
          g.lineWidth = 0.6;
          g.stroke();
        };
        const RODS = 16;
        const rodAngle = (i) => (i / RODS) * TAU + 0.1;
        // the back head's T-handles, sticking out behind
        for (let i = 0; i < RODS; i++) {
          const a = rodAngle(i);
          if (facing(a) < 0.05) continue;
          tHandle(a, depth + 0.7, depth + 2.4);
        }
        // the shell: mahogany, each strip lit by how it faces the light
        band(0, depth, R, (a, lit, [x, y]) => {
          g.fillStyle = wood(g, 'mahogany', { x, y, angle: 0, scale: 0.6, seed: 3 });
          g.fill();
          shadeStrip(lit);
        });
        // the back hoop, as dark as the front one
        band(depth - 0.7, depth + 0.7, R + 1.3, (a, lit) => {
          g.fillStyle = '#3A1A0A';
          g.fill();
          shadeStrip(lit, 0.4, 0.5);
        });
        band(depth - 0.05, depth + 0.05, R + 1.32, () => {
          g.strokeStyle = 'rgba(217,180,100,.7)';
          g.lineWidth = Math.max(1, k * 0.14);
          g.stroke();
        });
        // the tension rods: from a claw on each hoop along the shell to its lug
        for (let i = 0; i < RODS; i++) {
          const a = rodAngle(i);
          if (facing(a) < 0.08) continue;
          for (const sd of [1, -1]) {
            const at = (d) => (sd > 0 ? d : depth - d);
            const [c0x, c0y] = P(a, at(-0.55), R + 1.35);
            const [c1x, c1y] = P(a, at(1.1), R + 0.85);
            const [r1x, r1y] = P(a, at(4.6), R + 0.62);
            const [l0x, l0y] = P(a, at(4.2), R + 0.5);
            const [l1x, l1y] = P(a, at(6.3), R + 0.5);
            bar(g, c1x, c1y, r1x, r1y, Math.max(1, k * 0.26), 'silver');
            bar(g, l0x, l0y, l1x, l1y, Math.max(2.4, k * 0.7), 'nickel');
            bar(g, c0x, c0y, c1x, c1y, Math.max(1.6, k * 0.46), 'silver');
          }
        }
        // the ring the cradle holds it by: a band of brushed steel round its middle
        band(depth / 2 - 0.6, depth / 2 + 0.6, R + 0.35, (a, lit) => {
          const v = Math.round(120 + lit * 105);
          g.fillStyle = `rgb(${v - 6},${v - 2},${v + 4})`;
          g.fill();
          g.strokeStyle = g.fillStyle;
          g.lineWidth = 0.6;
          g.stroke();
        });
        band(depth / 2 - 0.6, depth / 2 - 0.45, R + 0.36, (a, lit) => {
          g.fillStyle = `rgba(255,255,255,${0.2 + Math.max(0, lit) * 0.45})`;
          g.fill();
        });
        // the front hoop: dark wood with a gold line, and the head inside it
        const outer = ring(-0.6, R + 1.3);
        const inner = ring(-0.6, R - 0.2);
        const path = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
        // the hoop's edge (its thickness, toward the shell)
        band(-0.6, 0.8, R + 1.3, (a, lit) => {
          g.fillStyle = '#2A1208';
          g.fill();
          shadeStrip(lit, 0.3, 0.4);
        });
        // the head: a calfskin disc in the plane of the hoop, painted a pixel at a time
        const [hx, hy] = P(0, -0.4, 0);
        g.save();
        path(inner);
        g.clip();
        g.translate(hx, hy);
        // map a circle Rp pixels across onto the head's ellipse
        const Rp = R * k;
        const [ax1, ay1] = P(0, -0.4, R - 0.2);
        const [bx1, by1] = P(Math.PI / 2, -0.4, R - 0.2);
        g.transform((ax1 - hx) / Rp, (ay1 - hy) / Rp, (bx1 - hx) / Rp, (by1 - hy) / Rp, 0, 0);
        g.scale(1, -1);
        face(g, 0, 0, Rp, 1, 'calf', 1.05);
        g.restore();
        // the hoop's face
        g.beginPath();
        outer.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        inner.slice().reverse().forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        const hg = g.createLinearGradient(outer[54][0], outer[54][1], outer[18][0], outer[18][1]);
        hg.addColorStop(0, '#6E3A1E');
        hg.addColorStop(0.5, '#3A1A0A');
        hg.addColorStop(1, '#1E0C04');
        g.fillStyle = hg;
        g.fill('evenodd');
        const mid = ring(-0.6, R + 0.55);
        path(mid);
        g.strokeStyle = 'rgba(217,180,100,.75)';
        g.lineWidth = Math.max(1, k * 0.16);
        g.stroke();
        // the front head's claws over the hoop and T-handles pointing out at you
        for (let i = 0; i < RODS; i++) {
          const a = rodAngle(i);
          const [c0x, c0y] = P(a, -0.75, R + 0.75);
          const [c1x, c1y] = P(a, -0.75, R + 1.35);
          bar(g, c0x, c0y, c1x, c1y, Math.max(1.6, k * 0.5), 'silver');
          tHandle(a, -0.75, -2.4);
        }
        cradle(g, 1);

        /* A T-handle on its rod, from a inches back to b. */
        function tHandle(a, from, to) {
          const [x0, y0] = P(a, from, R + 1.05);
          const [x1, y1] = P(a, to, R + 1.05);
          bar(g, x0, y0, x1, y1, Math.max(1.2, k * 0.3), 'silver');
          // the T, across the rod
          const tx = -Math.sin(a) * k * 1.05;
          const ty = -Math.cos(a) * k * 1.05;
          bar(g, x1 - tx, y1 + ty, x1 + tx, y1 - ty, Math.max(1.4, k * 0.36), 'silver');
        }
      },
      live(g, s, now, age) {
        const [hx, hy] = P(0, -0.4, 0);
        const [ax1, ay1] = P(0, -0.4, R);
        const [bx1, by1] = P(Math.PI / 2, -0.4, R);
        const rx = Math.hypot(ax1 - hx, ay1 - hy);
        const ry = Math.hypot(bx1 - hx, by1 - hy);
        // the head breathes after a hit
        const wob = age < 1.2 && !damped ? Math.exp(-age * 3.5) * Math.sin(age * 38) : 0;
        if (Math.abs(wob) > 0.02) {
          g.save();
          g.beginPath();
          g.ellipse(hx, hy, rx * 0.95, ry * 0.95, Math.atan2(ay1 - hy, ax1 - hx), 0, TAU);
          g.clip();
          const gr = g.createRadialGradient(hx, hy, 0, hx, hy, ry);
          gr.addColorStop(0, `rgba(${wob > 0 ? '255,240,210' : '60,30,10'},${Math.abs(wob) * 0.18})`);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr;
          g.fillRect(hx - rx, hy - ry, rx * 2, ry * 2);
          g.restore();
        }
        ripple(g, hx, hy, rx, ry, last.x * (rx / rx), -last.y, damped ? 9 : age, { life: 1.2, color: '90,55,25' });
        if (age < 0.5) {
          // the beater: a big soft lambswool ball on a long handle
          const lift = Math.sin(Math.min(1, age / 0.25) * Math.PI / 2) * 5;
          const [tx, ty] = cam.at(...W3(Math.atan2(last.y, last.x), -1.6 - lift, Math.hypot(last.x, last.y) * R));
          const alpha = age < 0.3 ? 1 : 1 - (age - 0.3) / 0.2;
          const ux = Math.cos(rad(-55));
          const uy = -Math.sin(rad(-55));
          const L2 = k * 15;
          g.save();
          g.globalAlpha = alpha;
          stick(g, tx, ty, tx + ux * L2, ty + uy * L2, Math.max(3, k * 0.55), { color: '#B9864E' });
          const rb = Math.max(8, k * 2.2);
          g.fillStyle = 'rgba(0,0,0,.3)';
          g.beginPath();
          g.ellipse(tx + rb * 0.25, ty + rb * 0.35, rb * 1.05, rb, 0, 0, TAU);
          g.fill();
          const fg = g.createRadialGradient(tx - rb * 0.35, ty - rb * 0.4, rb * 0.1, tx, ty, rb * 1.05);
          fg.addColorStop(0, '#FFFDF6');
          fg.addColorStop(0.6, '#EDE6D6');
          fg.addColorStop(1, '#B9AE98');
          g.fillStyle = fg;
          g.beginPath();
          g.ellipse(tx, ty, rb * 1.05, rb, 0, 0, TAU);
          g.fill();
          // its wool
          const r2 = rand(5);
          g.strokeStyle = 'rgba(150,135,110,.35)';
          g.lineWidth = 0.8;
          for (let i = 0; i < 14; i++) {
            const a = r2() * TAU;
            const d = r2() * rb * 0.8;
            g.beginPath();
            g.arc(tx + Math.cos(a) * d, ty + Math.sin(a) * d, rb * 0.18, a, a + 2);
            g.stroke();
          }
          g.restore();
        }
      },
    };

    /* The cradle: on each side a post from a wheeled base up to a pivot on the ring. */
    function cradle(g, side) {
      const k = cam.k;
      const a = side > 0 ? 0 : Math.PI;
      const [px, py] = P(a, depth / 2, R + 1.6);
      const [bx, by] = cam.at(...[W3(a, depth / 2, R + 3.5)[0], W3(a, depth / 2, R + 3.5)[1], 4]);
      // the base rail along the drum, on two casters
      const rail = [-3, depth + 3].map((al) => {
        const w = W3(a, al, R + 3.5);
        return cam.at(w[0], w[1], 4);
      });
      bar(g, rail[0][0], rail[0][1], rail[1][0], rail[1][1], Math.max(2.5, k * 1.1), 'silver');
      for (const [cx2, cy2] of rail) {
        g.fillStyle = '#18181A';
        g.beginPath();
        g.ellipse(cx2, cy2 + k * 2.6, k * 1.4, k * 1.3, 0, 0, TAU);
        g.fill();
        g.fillStyle = metal(g, 'chrome', cx2 - k, 0, cx2 + k, 0);
        g.beginPath();
        g.roundRect(cx2 - k * 0.6, cy2, k * 1.2, k * 1.8, k * 0.3);
        g.fill();
      }
      bar(g, bx, by, px, py, Math.max(3, k * 1.2), 'silver');
      // the pivot
      g.fillStyle = metal(g, 'chrome', px - k * 1.5, py - k * 1.5, px + k * 1.5, py + k * 1.5);
      g.beginPath();
      g.arc(px, py, Math.max(4, k * 1.3), 0, TAU);
      g.fill();
      g.fillStyle = '#26262A';
      g.beginPath();
      g.arc(px, py, Math.max(2, k * 0.55), 0, TAU);
      g.fill();
    }
  }

  /* ---------- cymbals: the crash pair ---------- */

  function crashGeom(s) {
    const tall = s.H > s.W * 1.05;
    // each cymbal 18 inches across, held up facing the other, turned so you see into it
    const R = 9;
    const yaw = rad(tall ? 58 : 46);
    const span = 2 * (R * Math.cos(yaw) * 2 + 3);
    const k = Math.min((s.W * 0.86) / span, (s.H * 0.62) / (R * 2), 40);
    const cx = s.W / 2;
    const cy = s.H * 0.48;
    const half = (R * Math.cos(yaw) + 1.6) * k;
    const cam = camera(0);
    cam.k = k;
    cam.ox = cx;
    cam.oy = s.H;
    const hitPair = (u, v) => {
      let best = null;
      for (const sd of [-1, 1]) {
        const x = (u - (cx + sd * half)) / (R * Math.cos(yaw) * k);
        const y = (v - cy) / (R * k);
        const d = Math.hypot(x, y);
        if (!best || d < best.d) best = { d, x, y };
      }
      if (best.d > 1.6) return null;
      return { d: Math.min(1, best.d), x: best.x, y: best.y };
    };
    return {
      cam, hit: hitPair,
      at: (w) => (w === 'middle' ? [cx - half, cy] : w === 'edge' ? [cx + half, cy - R * k * 0.85] : [6, 6]),
      still(g, s) {
        backdrop(g, s.W, s.H, s.H * 0.78, cam, { color: '#4E1218' });
        spot(g, s.W, s.H, cx, cy, Math.max(s.W, s.H) * 0.7, { light: 0.18, dark: 0.45 });
      },
      live(g, s, now, age) {
        const ring = ringLevel(age, 0.9);
        // they come together, then swing apart
        const meet = last.at ? Math.max(0, 1 - age / 0.18) : 0;
        const open = 1 - meet * 0.82;
        const turn = yaw + meet * rad(25);
        const rx = R * Math.abs(Math.cos(turn)) * k;
        const ry = R * k;
        const shimmer = ring * Math.sin(now / 45) * 0.035;
        pool(g, cx, cy + ry * 1.25, ry * 1.4, '#000000', 0.35, 0.18);
        for (const sd of [-1, 1]) {
          const x = cx + sd * (half * open + (1 - open) * rx * 0.2);
          const c = sprite(s, `crash:${Math.round(rx)}:${Math.round(ry)}`, ry * 2 + 10, rx * 2 + 10, (c2) => {
            // drawn lying down, then stood up; turned over, it shows its inside
            cymbal(c2, ry + 5, rx + 5, ry, rx, { lift: 0, bell: 0.28, felt: false, hole: false, seed: 7, turn: -0.65 });
          });
          g.save();
          g.translate(x, cy);
          g.rotate(-Math.PI / 2 + Math.PI + sd * shimmer);
          g.scale(1 + shimmer * sd, 1);
          // turned half way round, the light falls on the far side of the bell: a hollow
          g.drawImage(c, -(ry + 5), -(rx + 5), ry * 2 + 10, rx * 2 + 10);
          g.restore();
          // the leather pad and knot where the strap goes through
          const kn = Math.max(4, k * 0.9);
          g.fillStyle = '#3E2312';
          g.beginPath();
          g.ellipse(x - sd * kn * 0.2, cy, kn * Math.abs(Math.cos(turn)) * 1.3 + 1, kn * 1.3, 0, 0, TAU);
          g.fill();
          g.fillStyle = '#6B4226';
          g.beginPath();
          g.ellipse(x - sd * kn * 0.25, cy - kn * 0.15, kn * Math.abs(Math.cos(turn)) * 0.8 + 1, kn * 0.75, 0, 0, TAU);
          g.fill();
        }
        if (age < 0.35 && last.at) {
          const r = ry * (0.4 + age * 2);
          const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
          gr.addColorStop(0, `rgba(255,248,220,${0.7 * (1 - age / 0.35)})`);
          gr.addColorStop(1, 'rgba(255,248,220,0)');
          g.fillStyle = gr;
          g.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
        if (ring > 0.05) s.animate(200);
      },
    };
  }

  /* ---------- cymbals: one on a stand ---------- */

  function susGeom(s) {
    const tall = s.H > s.W * 1.05;
    const cam = camera(rad(tall ? 40 : 34));
    const R = 9;
    const z = 40;
    const phi = rad(6);
    const b = bounds();
    const up = (y, z2) => y * cam.s + z2 * cam.c;
    const q = Math.sin(cam.tilt + phi);
    b.add(-R - 1, up(0, z) + R * q + 1);
    b.add(R + 1, up(0, z) - R * q - 1);
    // the whole stand, down to its feet
    for (const a of LEGS) b.add(Math.cos(a) * 12, up(Math.sin(a) * 12, 0) - 0.6);
    const pad = Math.min(s.W, s.H) * 0.07;
    cam.fit(b.x0, b.x1, b.u0, b.u1, { x: pad, y: pad, w: s.W - pad * 2, h: s.H - pad * 2 }, 40);
    const D = cam.disc(0, 0, z, R, phi);
    const lift = D.down * 1.1;
    const hitOne = (u, v) => {
      const x = (u - D.X) / D.rx;
      const y = (v - D.Y) / D.ry;
      const d = Math.hypot(x, y);
      return d <= 1.15 ? { d: Math.min(1, d), x, y } : null;
    };
    return {
      cam, D, hit: hitOne,
      at: (w) => (w === 'middle' ? [D.X, D.Y] : w === 'edge' ? [D.X - D.rx * 0.9, D.Y] : [6, s.H - 6]),
      still(g, s) {
        g.fillStyle = '#120C08';
        g.fillRect(0, 0, s.W, s.H);
        planks(g, s.W, s.H, cam, { kind: 'walnut', width: 6, tone: -0.38, seed: 8 });
        spot(g, s.W, s.H, D.X, D.Y, Math.max(s.W, s.H) * 0.7, { light: 0.16, dark: 0.55 });
        const [fx, fy] = cam.at(0, 0, 0);
        shade(g, fx + cam.k * 2, fy, D.rx * 1.1, D.rx * 1.1 * cam.s, 0.45);
        stand(g, cam, 0, 0, z - 1.4, { spread: 12, base: 11, turn: 0 });
      },
      live(g, s, now, age) {
        const ring = Math.max(ringLevel(age, 0.8), roll ? 0.5 : 0);
        const wob = ring * Math.sin(now / 38) * 0.04;
        const pad2 = 4;
        const w = D.rx * 2 + pad2 * 2;
        const h = D.ry * 2 + lift + pad2 * 2 + 3;
        const c = sprite(s, `sus:${G.key}`, w, h, (c2) => cymbal(c2, w / 2, pad2 + lift + D.ry, D.rx, D.ry, { lift, felt: true, seed: 21 }));
        g.save();
        g.translate(D.X, D.Y);
        g.rotate(wob * 0.4);
        g.scale(1, 1 + wob);
        g.drawImage(c, -w / 2, -(pad2 + lift + D.ry), w, h);
        g.restore();
        if (ring > 0.04) {
          // the shimmer of a ringing cymbal: light running round it
          const a = now / 300;
          const gr = g.createRadialGradient(D.X + Math.cos(a) * D.rx * 0.6, D.Y + Math.sin(a) * D.ry * 0.6, 0, D.X + Math.cos(a) * D.rx * 0.6, D.Y + Math.sin(a) * D.ry * 0.6, D.rx * 0.5);
          gr.addColorStop(0, `rgba(255,246,214,${0.25 * ring})`);
          gr.addColorStop(1, 'rgba(255,246,214,0)');
          g.fillStyle = gr;
          g.fillRect(D.X - D.rx, D.Y - D.ry, D.rx * 2, D.ry * 2);
          s.animate(200);
        }
        // yarn mallets: both on the rim for a roll, one where it was struck
        if (roll) {
          const t = (now - rollAt) / 1000;
          yarn(g, -0.93, 0.15, Math.abs(Math.sin(t * 20)) * 2.5, -1, 1);
          yarn(g, 0.93, 0.15, Math.abs(Math.cos(t * 20)) * 2.5, 1, 1);
        } else if (age < 0.4) {
          yarn(g, last.x, last.y, Math.sin(Math.min(1, age / 0.2) * Math.PI / 2) * 6, last.x < 0 ? -1 : 1, age < 0.22 ? 1 : 1 - (age - 0.22) / 0.18);
        }
      },
    };
    function yarn(g, hx, hy, lift, side, alpha) {
      const D = G.D;
      const [tx, ty, tz] = cam.onDisc(D, clamp(hx, -0.95, 0.95), clamp(hy, -0.95, 0.95), lift + 1.2);
      const hand = [side * 9 + tx * 0.3, -13, z + 3];
      const dx = hand[0] - tx;
      const dy = hand[1] - ty;
      const dz = hand[2] - tz;
      const len = Math.hypot(dx, dy, dz) || 1;
      const [x0, y0] = cam.at(tx, ty, tz);
      const [x1, y1] = cam.at(tx + (dx / len) * 15, ty + (dy / len) * 15, tz + (dz / len) * 15);
      g.save();
      g.globalAlpha = alpha;
      stick(g, x0, y0, x1, y1, Math.max(2.5, cam.k * 0.4), { color: '#C9A06A' });
      const rb = Math.max(5, cam.k * 0.9);
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath();
      g.arc(x0 + rb * 0.3, y0 + rb * 0.5, rb, 0, TAU);
      g.fill();
      const gr = g.createRadialGradient(x0 - rb * 0.3, y0 - rb * 0.35, rb * 0.1, x0, y0, rb);
      gr.addColorStop(0, '#8FA6D8');
      gr.addColorStop(0.6, '#3A5296');
      gr.addColorStop(1, '#1E2C5A');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x0, y0, rb, 0, TAU);
      g.fill();
      // the yarn wound round it
      g.strokeStyle = 'rgba(200,215,245,.35)';
      g.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.ellipse(x0, y0, rb * 0.9, rb * (0.25 + i * 0.15), 0.6 + i * 0.5, 0, TAU);
        g.stroke();
      }
      g.restore();
    }
  }

  /* ---------- the triangle ---------- */

  function triGeom(s) {
    // an 8-inch steel triangle of 3/8-inch rod, hanging by a loop of nylon line from a clip,
    // open at its lower left corner, and an 8-inch steel beater
    const side = 8;
    const t = 0.38;
    const k = Math.min(s.W / (side * 2.3), s.H / (side * 1.75), 48);
    const cx = s.W / 2;
    const cy = s.H * 0.56;
    const hR = side / Math.sqrt(3);
    const top = [cx, cy - hR * k];
    const bl = [cx - (side / 2) * k, cy + (hR / 2) * k];
    const br = [cx + (side / 2) * k, cy + (hR / 2) * k];
    const hang = [cx, top[1] - side * 0.34 * k];
    const cam = camera(0);
    cam.k = k;
    const hitAny = (u, v) => {
      const d = Math.hypot(u - cx, v - cy) / (side * k * 0.7);
      return { d: Math.min(1, d), x: (u - cx) / (side * k), y: (v - cy) / (side * k) };
    };
    return {
      cam, k, top, bl, br, hang, t, side, hit: hitAny,
      at: (w) => (w === 'middle' ? [cx, bl[1]] : w === 'edge' ? [(top[0] + br[0]) / 2, (top[1] + br[1]) / 2] : null),
      still(g, s) {
        backdrop(g, s.W, s.H, s.H * 0.86, cam, { color: '#3E1016' });
        spot(g, s.W, s.H, cx, cy, Math.max(s.W, s.H) * 0.6, { light: 0.2, dark: 0.5 });
        // the arm of the stand the clip is fixed to, coming in from the stand off to the left
        const y0 = Math.max(8, hang[1] - side * 0.42 * k);
        const end = cx + k * 1.4;
        bar(g, -10, y0, end, y0, Math.max(4, k * 0.5), 'silver');
        const er = Math.max(3, k * 0.34);
        g.fillStyle = '#1C1C1E';
        g.beginPath();
        g.roundRect(end - er * 0.2, y0 - er, er * 1.6, er * 2, er * 0.6);
        g.fill();
      },
      live(g, s, now, age) {
        const ring = Math.max(ringLevel(age, 0.7), roll ? 0.7 : 0);
        const sway = (last.at ? Math.exp(-age * 1.4) * Math.sin(age * 5.5) * 0.06 : 0) * (damped ? 0 : 1);
        const y0 = Math.max(8, hang[1] - side * 0.42 * k);
        // the clip
        const cw = k * 0.9;
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath();
        g.roundRect(cx - cw / 2 + 2, y0 - k * 0.3 + 3, cw, hang[1] - y0 + k * 0.1, cw * 0.3);
        g.fill();
        g.fillStyle = metal(g, 'chrome', cx - cw / 2, 0, cx + cw / 2, 0);
        g.beginPath();
        g.roundRect(cx - cw / 2, y0 - k * 0.3, cw, hang[1] - y0 + k * 0.1, cw * 0.3);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,.35)';
        for (let i = 0; i < 4; i++) g.fillRect(cx - cw / 2, y0 + k * 0.15 + i * k * 0.28, cw, Math.max(1, k * 0.08));
        g.save();
        g.translate(hang[0], hang[1]);
        g.rotate(sway);
        g.translate(-hang[0], -hang[1]);
        // the loop of line, down from the clip to the bar either side of the top corner
        // (the bend there is an arc of radius rho round the point bend, as triangleBar draws it)
        const wb = t * k;
        const rho = wb * 1.6;
        const bend = [top[0], top[1] + rho * 2];
        const onBend = (th, r) => [bend[0] + Math.sin(th) * r, bend[1] - Math.cos(th) * r];
        const th = rad(34);
        const loop = () => {
          g.strokeStyle = 'rgba(240,240,232,.85)';
          g.lineWidth = Math.max(1, k * 0.07);
          g.lineCap = 'round';
        };
        loop();
        g.beginPath();
        for (const sd of [-1, 1]) {
          const [ox, oy] = onBend(sd * th, rho + wb / 2);
          g.moveTo(hang[0] + sd * k * 0.12, hang[1]);
          g.lineTo(ox, oy);
        }
        g.stroke();
        if (ring > 0.02) {
          g.save();
          g.shadowColor = `rgba(210,232,255,${0.8 * ring})`;
          g.shadowBlur = 24 * ring;
          triangleBar(g, k, top, bl, br, t, 1);
          g.restore();
        }
        triangleBar(g, k, top, bl, br, t, 0);
        // the line wraps round the bar: across its front, and under it inside the corner
        loop();
        g.beginPath();
        for (const sd of [-1, 1]) {
          const [ox, oy] = onBend(sd * th, rho + wb / 2);
          const [ix, iy] = onBend(sd * th, rho - wb / 2);
          g.moveTo(ox, oy);
          g.lineTo(ix, iy);
        }
        g.stroke();
        g.beginPath();
        g.arc(bend[0], bend[1], rho - wb / 2 - g.lineWidth / 2, -Math.PI / 2 - th, -Math.PI / 2 + th);
        g.stroke();
        g.lineCap = 'butt';
        if (ring > 0.04) {
          // glints running along the bar
          const pts = [bl, br, top, bl];
          for (let i = 0; i < 3; i++) {
            const f = ((now / 900 + i / 3) % 1) * 3;
            const seg = Math.floor(f);
            const tt = f - seg;
            const a = pts[seg];
            const b = pts[seg + 1];
            const x = a[0] + (b[0] - a[0]) * tt;
            const y = a[1] + (b[1] - a[1]) * tt;
            const gr = g.createRadialGradient(x, y, 0, x, y, k * 0.9);
            gr.addColorStop(0, `rgba(255,255,255,${0.7 * ring})`);
            gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr;
            g.fillRect(x - k, y - k, k * 2, k * 2);
          }
          s.animate(120);
        }
        g.restore();
        // the beater: in the top corner for a roll, against the bar where it struck, else resting
        let tip;
        let ang;
        if (roll) {
          const w = Math.sin(now / 22) * k * 0.55;
          tip = [top[0] + w, top[1] + k * 1.15];
          ang = rad(-38);
        } else if (age < 0.3) {
          const p = nearestOnBar([cx + last.x * side * k, cy + last.y * side * k]);
          const back = Math.sin(Math.min(1, age / 0.12) * Math.PI / 2) * k * 1.4;
          tip = [p[0] + p[2] * (t * k * 0.6 + back), p[1] + p[3] * (t * k * 0.6 + back)];
          ang = Math.atan2(-p[3], -p[2]) + Math.PI;
          ang = clamp(ang, rad(-80), rad(10));
        } else {
          tip = [br[0] + k * 1.6, cy - k * 0.2];
          ang = rad(-40);
        }
        beater(g, tip, ang, k);
      },
    };
    /* The nearest point on the bar to p, and the way out from it. */
    function nearestOnBar(p) {
      const segs = [[bl, br], [br, top], [top, bl]];
      let best = null;
      for (const [a, b] of segs) {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const L2 = dx * dx + dy * dy;
        const f = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2, 0.15, 0.85);
        const x = a[0] + dx * f;
        const y = a[1] + dy * f;
        const d = Math.hypot(p[0] - x, p[1] - y);
        // outward: away from the middle
        let nx = x - cx;
        let ny = y - cy;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        if (!best || d < best[4]) best = [x, y, nx, ny, d];
      }
      return best;
    }
  }

  /* The triangle's bar: round steel, bent at two corners, open at the lower left. */
  function triangleBar(g, k, top, bl, br, t, glow) {
    const w = t * k;
    const along = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    const start = along(bl, br, 0.07);
    const end = along(bl, top, 0.08);
    const path = () => {
      g.beginPath();
      g.moveTo(start[0], start[1]);
      g.arcTo(br[0], br[1], top[0], top[1], w * 1.6);
      g.arcTo(top[0], top[1], bl[0], bl[1], w * 1.6);
      g.lineTo(end[0], end[1]);
    };
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (glow) {
      path();
      g.strokeStyle = 'rgba(200,220,240,.5)';
      g.lineWidth = w;
      g.stroke();
      return;
    }
    // shadow on the curtain
    g.save();
    g.translate(w * 0.6, w * 1.4);
    path();
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = w * 1.1;
    g.stroke();
    g.restore();
    path();
    g.strokeStyle = '#5E666E';
    g.lineWidth = w;
    g.stroke();
    path();
    g.strokeStyle = '#B9C3CB';
    g.lineWidth = w * 0.66;
    g.stroke();
    g.save();
    g.translate(-w * 0.14, -w * 0.18);
    path();
    g.strokeStyle = 'rgba(255,255,255,.85)';
    g.lineWidth = w * 0.2;
    g.stroke();
    g.restore();
    // the cut ends: flat, a little darker
    for (const [p, q] of [[start, br], [end, top]]) {
      const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
      g.fillStyle = '#7A848C';
      g.beginPath();
      g.ellipse(p[0], p[1], w * 0.16, w * 0.5, a, 0, TAU);
      g.fill();
    }
  }

  /* The triangle beater: a steel rod with a black grip, its tip at tip, pointing back along ang. */
  function beater(g, tip, ang, k) {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const L = 8 * k;
    const end = [tip[0] + ux * L, tip[1] + uy * L];
    const mid = [tip[0] + ux * L * 0.62, tip[1] + uy * L * 0.62];
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = Math.max(2, k * 0.25);
    g.beginPath();
    g.moveTo(tip[0] + 3, tip[1] + 5);
    g.lineTo(end[0] + 3, end[1] + 5);
    g.stroke();
    g.strokeStyle = metal(g, 'steel', tip[0] - uy * 3, tip[1] + ux * 3, tip[0] + uy * 3, tip[1] - ux * 3);
    g.lineWidth = Math.max(1.6, k * 0.22);
    g.beginPath();
    g.moveTo(tip[0], tip[1]);
    g.lineTo(mid[0], mid[1]);
    g.stroke();
    g.strokeStyle = '#1E1E20';
    g.lineWidth = Math.max(4, k * 0.5);
    g.beginPath();
    g.moveTo(mid[0], mid[1]);
    g.lineTo(end[0], end[1]);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.18)';
    g.lineWidth = Math.max(1, k * 0.12);
    g.beginPath();
    g.moveTo(mid[0] - uy * k * 0.1, mid[1] + ux * k * 0.1 - 1);
    g.lineTo(end[0] - uy * k * 0.1, end[1] + ux * k * 0.1 - 1);
    g.stroke();
    g.restore();
  }

  /* ---------- the tambourine ---------- */

  function tambGeom(s) {
    const tall = s.H > s.W * 1.05;
    const cam = camera(rad(tall ? 52 : 46));
    const R = 5;
    const depth = 2.2;
    const z = depth;
    const phi = rad(14);
    const b = bounds();
    const up = (y, z2) => y * cam.s + z2 * cam.c;
    const q = Math.sin(cam.tilt + phi);
    b.add(-R - 1.6, up(0, z) + R * q + 1.4);
    b.add(R + 1.6, up(0, z) - R * q - depth * Math.cos(cam.tilt + phi) - 1.6);
    const pad = Math.min(s.W, s.H) * 0.1;
    cam.fit(b.x0, b.x1, b.u0, b.u1, { x: pad, y: pad, w: s.W - pad * 2, h: s.H - pad * 2 }, 70);
    const D = cam.disc(0, 0, z, R, phi);
    const hitHead = (u, v) => {
      const x = (u - D.X) / D.rx;
      const y = (v - D.Y) / D.ry;
      const d = Math.hypot(x, y);
      return d <= 1.2 ? { d: Math.min(1, d), x, y } : null;
    };
    const slots = 8;
    const jingle = (i) => (i / slots) * TAU + Math.PI / slots + Math.PI / 2;
    const h = depth * D.down;
    return {
      cam, D, hit: hitHead,
      at: (w) => (w === 'middle' ? [D.X, D.Y] : w === 'edge' ? [D.X, D.Y - D.ry * 0.9] : [6, 6]),
      still(g, s) {
        // black felt on the percussion table
        g.fillStyle = '#17171A';
        g.fillRect(0, 0, s.W, s.H);
        const n = 2600;
        const r = rand(17);
        for (let i = 0; i < n; i++) {
          g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.25)';
          g.fillRect(r() * s.W, r() * s.H, 1.2, 1.2);
        }
        spot(g, s.W, s.H, D.X, D.Y, Math.max(s.W, s.H) * 0.65, { light: 0.16, dark: 0.55 });
        shade(g, D.X + D.k * 1.2, D.Y + h + D.k * 2, D.rx * 1.15, D.ry * 1.05, 0.6);
        // the jingles on the far side stick out beyond the frame, behind the head
        for (let i = 0; i < slots; i++) {
          const a = jingle(i);
          if (Math.sin(a) < 0.15) continue;
          jinglePair(g, D, a, h, 0, false);
        }
        // the frame: maple stained honey
        const { X, Y, rx: Rr, q } = D;
        shellPath(g, X, Y, Rr, q, h);
        finish(g, { kind: 'wood', wood: 'maple', color: '#9A5A1E', stain: 0.35, gloss: 0.5, scale: 0.45, angle: 0 }, X - Rr, X + Rr, Y - Rr * q, Y + h + Rr * q);
        // its bottom edge, rounded over
        g.save();
        g.clip();
        g.strokeStyle = 'rgba(40,20,4,.45)';
        g.lineWidth = Math.max(1, D.k * 0.14);
        g.beginPath();
        g.ellipse(X, Y + h, Rr, Rr * q, 0, 0, Math.PI);
        g.stroke();
        g.restore();
        // the skin, pulled over the frame's edge and down its side
        const cl = 0.45 * D.down;
        shellPath(g, X, Y, Rr + 0.4, q, cl);
        const sk = g.createLinearGradient(0, Y, 0, Y + Rr * q + cl);
        sk.addColorStop(0, '#CDAE78');
        sk.addColorStop(1, '#B8955E');
        g.fillStyle = sk;
        g.fill();
        g.fillStyle = roundness(g, X - Rr, X + Rr, { gloss: 0.3, dark: 0.5 });
        g.fill();
        face(g, X, Y, Rr, q, 'calf', 1);
        // where it bends over the edge: a crease, bright where it catches the light
        g.strokeStyle = 'rgba(120,80,30,.35)';
        g.lineWidth = Math.max(1, D.k * 0.1);
        g.beginPath();
        g.ellipse(X, Y, Rr - 1, (Rr - 1) * q, 0, 0, TAU);
        g.stroke();
        g.strokeStyle = 'rgba(255,246,224,.4)';
        g.lineWidth = Math.max(1, D.k * 0.12);
        g.beginPath();
        g.ellipse(X, Y, Rr - D.k * 0.3, (Rr - D.k * 0.3) * q, 0, Math.PI * 1.02, Math.PI * 1.62);
        g.stroke();
        // brass tacks round the side, holding the skin
        for (let i = 0; i < 30; i++) {
          const a = (i / 30) * TAU + 0.06;
          const sa = Math.sin(a);
          if (sa > -0.08) continue;
          const x = X + Math.cos(a) * (Rr + 0.3);
          const y = Y - sa * Rr * q + cl * 0.78;
          const tr = Math.max(1.1, D.k * 0.13);
          const fx = Math.max(0.3, -sa);
          g.fillStyle = 'rgba(0,0,0,.35)';
          g.beginPath();
          g.ellipse(x + tr * 0.3, y + tr * 0.4, tr * fx, tr, 0, 0, TAU);
          g.fill();
          g.fillStyle = metal(g, 'brass', x - tr, y - tr, x + tr, y + tr);
          g.beginPath();
          g.ellipse(x, y, tr * fx, tr, 0, 0, TAU);
          g.fill();
        }
        // the slots on the near side, dark inside
        for (let i = 0; i < slots; i++) {
          const a = jingle(i);
          if (Math.sin(a) > -0.12) continue;
          slot(g, D, a, h);
        }
      },
      live(g, s, now, age) {
        const rolling = !!roll;
        const shake = rolling ? 1 : last.at && age < 0.6 ? Math.exp(-age * 7) : 0;
        // the near jingles, rattling in their slots
        for (let i = 0; i < slots; i++) {
          const a = jingle(i);
          if (Math.sin(a) > -0.12) continue;
          jinglePair(g, D, a, h, shake, true, now + i * 37);
        }
        if (!last.shake) ripple(g, D.X, D.Y, D.rx * 0.95, D.ry * 0.95, last.x, last.y, rolling ? ((now - rollAt) / 1000) % 0.3 : age, { life: rolling ? 0.3 : 0.6, color: '110,70,30' });
        if (shake > 0.05) s.animate(100);
      },
    };
  }

  /* Where the slot at angle a round the frame is: its middle, its size, and which way is out
     (along the wall and away from it, on the screen). */
  function slotAt(D, a, h) {
    const k = D.k;
    const x = D.X + Math.cos(a) * D.rx;
    const y = D.Y - Math.sin(a) * D.ry + h * 0.56;
    // the wall runs along t; n points out of it
    let tx = -D.rx * Math.sin(a);
    let ty = -D.ry * Math.cos(a);
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    let nx = D.ry * Math.cos(a);
    let ny = -D.rx * Math.sin(a);
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const w = 2.3 * k * Math.max(0.2, Math.abs(Math.sin(a)));
    return { x, y, w, hh: h * 0.3, tx, ty, nx, ny };
  }

  /* A slot cut through the frame: dark inside, with the pin the jingles ride on. */
  function slot(g, D, a, h) {
    const S = slotAt(D, a, h);
    g.fillStyle = '#120A04';
    g.beginPath();
    g.roundRect(S.x - S.w / 2, S.y - S.hh, S.w, S.hh * 2, Math.min(S.w, S.hh) * 0.3);
    g.fill();
    // light catching its lower lip
    g.fillStyle = 'rgba(255,220,170,.18)';
    g.fillRect(S.x - S.w / 2 + 1, S.y + S.hh - Math.max(1, D.k * 0.08), S.w - 2, Math.max(1, D.k * 0.08));
    g.strokeStyle = metal(g, 'steel', S.x - 2, 0, S.x + 2, 0);
    g.lineWidth = Math.max(1, D.k * 0.12);
    g.beginPath();
    g.moveTo(S.x, S.y - S.hh);
    g.lineTo(S.x, S.y + S.hh);
    g.stroke();
  }

  /* A pair of jingles (small brass cups) on their pin, in the slot at angle a. Near you, the
     outer half of each sticks out of the frame and the inner half shows through the slot;
     on the far side only the outer halves peek out beyond the rim. */
  function jinglePair(g, D, a, h, shake, near, seed = 0) {
    const k = D.k;
    const S = slotAt(D, a, h);
    const x = near ? S.x : D.X + Math.cos(a) * D.rx;
    const y = near ? S.y : D.Y - Math.sin(a) * D.ry + h * 0.25;
    const r = 1.05 * k;
    const rq = r * D.q * 0.92;
    const gap = Math.max(1.2, 0.22 * D.down);
    const rr = rand(Math.floor(seed / 40));
    const L = r * 3;
    // the half of the screen out from the wall, and the slot's window
    const outside = () => {
      g.beginPath();
      g.moveTo(x + S.tx * L, y + S.ty * L);
      g.lineTo(x - S.tx * L, y - S.ty * L);
      g.lineTo(x - S.tx * L + S.nx * L, y - S.ty * L + S.ny * L);
      g.lineTo(x + S.tx * L + S.nx * L, y + S.ty * L + S.ny * L);
      g.closePath();
    };
    const inside = () => {
      g.beginPath();
      g.moveTo(x + S.tx * L, y + S.ty * L);
      g.lineTo(x - S.tx * L, y - S.ty * L);
      g.lineTo(x - S.tx * L - S.nx * L, y - S.ty * L - S.ny * L);
      g.lineTo(x + S.tx * L - S.nx * L, y + S.ty * L - S.ny * L);
      g.closePath();
    };
    // the lower jingle first: the upper one is nearer the eye and covers it
    for (const dz of [1, -1]) {
      const jx = x + (shake ? (rr() - 0.5) * k * 0.4 * shake : 0);
      const jy = y + dz * gap + (shake ? (rr() - 0.5) * k * 0.3 * shake : 0);
      const tilt = shake ? (rr() - 0.5) * 0.5 * shake : 0;
      const paint = () => {
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath();
        g.ellipse(jx + 1, jy + 1.5, r, rq, tilt, 0, TAU);
        g.fill();
        g.fillStyle = metal(g, 'brass', jx - r, jy - rq, jx + r, jy + rq);
        g.beginPath();
        g.ellipse(jx, jy, r, rq, tilt, 0, TAU);
        g.fill();
        // its rim, and the cup's hollow round the pin hole
        g.strokeStyle = 'rgba(90,60,10,.5)';
        g.lineWidth = Math.max(0.7, k * 0.05);
        g.stroke();
        g.fillStyle = 'rgba(80,50,10,.3)';
        g.beginPath();
        g.ellipse(jx, jy, r * 0.42, rq * 0.42, tilt, 0, TAU);
        g.fill();
        g.fillStyle = '#1A1206';
        g.beginPath();
        g.ellipse(jx, jy, Math.max(1, r * 0.08), Math.max(0.8, rq * 0.08), 0, 0, TAU);
        g.fill();
        if (shake > 0.3) {
          g.fillStyle = `rgba(255,250,220,${0.6 * shake})`;
          g.beginPath();
          g.arc(jx - r * 0.4, jy - rq * 0.3, Math.max(1, k * 0.15), 0, TAU);
          g.fill();
        }
      };
      g.save();
      outside();
      g.clip();
      paint();
      g.restore();
      if (near) {
        g.save();
        inside();
        g.clip();
        g.beginPath();
        g.roundRect(S.x - S.w / 2, S.y - S.hh, S.w, S.hh * 2, Math.min(S.w, S.hh) * 0.3);
        g.clip();
        paint();
        // in there, under the skin, it is dim
        g.fillStyle = 'rgba(18,10,2,.6)';
        g.fillRect(S.x - S.w, S.y - S.hh * 2, S.w * 2, S.hh * 4);
        g.restore();
      }
    }
    if (near) {
      // the pin, through both
      g.strokeStyle = metal(g, 'steel', x - 2, 0, x + 2, 0);
      g.lineWidth = Math.max(1, k * 0.12);
      g.beginPath();
      g.moveTo(x, S.y - S.hh);
      g.lineTo(x, y - gap);
      g.stroke();
    }
  }

  /* ---------- the gong ---------- */

  function gongGeom(s) {
    // a 32-inch Chinese tam-tam hanging by two cords in a wooden frame
    const R = 16;
    const fw = R + 5;              // half the frame's width
    const ht = 2 * R + 22;          // the frame's height
    const k = Math.min((s.W * 0.92) / (fw * 2 + 14), (s.H * 0.9) / (ht + 4), 30);
    const cx = s.W / 2;
    const floor = s.H * 0.5 + (ht / 2) * k + 2 * k;
    const cy = floor - (R + 14) * k;
    const topY = floor - ht * k;
    const cam = camera(rad(4));
    cam.k = k;
    cam.ox = cx;
    cam.oy = floor;
    const hang = [[cx - R * 0.5 * k, topY + 3 * k], [cx + R * 0.5 * k, topY + 3 * k]];
    const holes = [[cx - R * 0.42 * k, cy - R * 0.86 * k], [cx + R * 0.42 * k, cy - R * 0.86 * k]];
    const malletHook = [cx + fw * k + 1.2 * k, cy - R * 0.55 * k];
    const hitGong = (u, v) => {
      const x = (u - cx) / (R * k);
      const y = (v - cy) / (R * k);
      const d = Math.hypot(x, y);
      return d <= 1.08 ? { d: Math.min(1, d), x, y } : null;
    };
    return {
      cam, k, hit: hitGong,
      at: (w) => (w === 'middle' ? [cx, cy] : w === 'edge' ? [cx + R * k * 0.9, cy] : [6, 6]),
      still(g, s) {
        backdrop(g, s.W, s.H, floor - 6 * k, cam, { color: '#4A1418' });
        spot(g, s.W, s.H, cx, cy, Math.max(s.W, s.H) * 0.7, { light: 0.2, dark: 0.45 });
        pool(g, cx, floor, fw * k * 1.2, '#000000', 0.55, 0.12);
        frame(g);
      },
      live(g, s, now, age) {
        const ring = last.at && !damped ? Math.min(1, age * 3) * Math.exp(-age * 0.22) : 0;
        const sway = ring * Math.sin(now / 650) * 0.012;
        const swayX = Math.sin(sway) * (cy - topY);
        // the cords
        g.strokeStyle = '#B33A2A';
        g.lineWidth = Math.max(1.5, k * 0.3);
        for (let i = 0; i < 2; i++) {
          g.beginPath();
          g.moveTo(hang[i][0], hang[i][1]);
          g.lineTo(holes[i][0] + swayX, holes[i][1]);
          g.stroke();
        }
        const c = sprite(s, `gong:${Math.round(k * 100)}`, R * k * 2 + 8, R * k * 2 + 8, (c2) => gongFace(c2, R * k + 4, R * k + 4, R * k));
        g.save();
        g.translate(cx + swayX, cy);
        g.rotate(sway * 0.5);
        if (ring > 0.02) {
          g.shadowColor = `rgba(255,200,110,${0.55 * ring})`;
          g.shadowBlur = 40 * ring;
        }
        g.drawImage(c, -(R * k + 4), -(R * k + 4), R * k * 2 + 8, R * k * 2 + 8);
        g.restore();
        if (ring > 0.02) {
          // the shimmer: bands of light sweeping round as it sings
          g.save();
          g.beginPath();
          g.arc(cx + swayX, cy, R * k, 0, TAU);
          g.clip();
          const a = now / 900;
          for (let i = 0; i < 2; i++) {
            const aa = a + i * Math.PI;
            const gx = cx + swayX + Math.cos(aa) * R * k * 0.5;
            const gy = cy + Math.sin(aa) * R * k * 0.5;
            const gr = g.createRadialGradient(gx, gy, 0, gx, gy, R * k * 0.7);
            gr.addColorStop(0, `rgba(255,230,170,${0.22 * ring})`);
            gr.addColorStop(1, 'rgba(255,230,170,0)');
            g.fillStyle = gr;
            g.fillRect(cx - R * k * 1.2, cy - R * k * 1.2, R * k * 2.4, R * k * 2.4);
          }
          g.restore();
          s.animate(200);
        }
        // the mallet: on its hook on the frame, or against the gong where it struck
        if (age < 0.7) {
          const tx = cx + swayX + last.x * R * k;
          const ty = cy + last.y * R * k;
          const back = Math.sin(Math.min(1, age / 0.3) * Math.PI / 2) * k * 3;
          gongMallet(g, tx + back * 0.6, ty - back * 0.2, rad(-30), k, age < 0.45 ? 1 : 1 - (age - 0.45) / 0.25);
        }
        if (age >= 0.45 || !last.at) {
          // hanging head down from its hook on the right post, by a loop of cord
          const a = age >= 0.7 || !last.at ? 1 : (age - 0.45) / 0.25;
          const [hx, hy] = malletHook;
          const mx = hx + k * 2.2;
          const my = hy + k * 16.4;
          g.save();
          g.globalAlpha = a;
          g.strokeStyle = '#8A2A20';
          g.lineWidth = Math.max(1.2, k * 0.2);
          g.beginPath();
          g.moveTo(hx + k * 0.5, hy + k * 0.2);
          g.lineTo(mx - k * 0.1, my - k * 15.2);
          g.lineTo(hx + k * 0.9, hy - k * 0.1);
          g.stroke();
          g.restore();
          gongMallet(g, mx, my, -Math.PI / 2 - 0.02, k, a);
        }
      },
    };

    function frame(g) {
      const pw = 2.4 * k;
      const postL = cx - fw * k;
      const postR = cx + fw * k;
      const woodFill = (x, y, w, h, angle) => {
        g.fillStyle = wood(g, 'teak', { x, y, angle, scale: 0.5, seed: 4 });
        g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(120,24,16,.45)';
        g.fillRect(x, y, w, h);
      };
      // feet
      for (const x of [postL, postR]) {
        g.fillStyle = 'rgba(0,0,0,.4)';
        g.fillRect(x - 6 * k + 3, floor - 2.6 * k + 4, 12 * k, 2.6 * k);
        woodFill(x - 6 * k, floor - 2.6 * k, 12 * k, 2.6 * k, 0);
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.fillRect(x - 6 * k, floor - 0.6 * k, 12 * k, 0.6 * k);
      }
      // posts
      for (const x of [postL, postR]) {
        woodFill(x - pw / 2, topY, pw, floor - topY - 2.6 * k, 90);
        const gr = g.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
        gr.addColorStop(0, 'rgba(0,0,0,.45)');
        gr.addColorStop(0.3, 'rgba(255,220,180,.15)');
        gr.addColorStop(1, 'rgba(0,0,0,.5)');
        g.fillStyle = gr;
        g.fillRect(x - pw / 2, topY, pw, floor - topY - 2.6 * k);
      }
      // the top beam, its ends curling up like clouds
      const by = topY - 1.2 * k;
      const bh = 2.6 * k;
      const over = 6 * k;
      g.save();
      g.beginPath();
      g.moveTo(postL - over, by + bh);
      g.lineTo(postR + over, by + bh);
      g.quadraticCurveTo(postR + over + 2.4 * k, by + bh * 0.5, postR + over + 1.2 * k, by - bh * 0.6);
      g.quadraticCurveTo(postR + over - 0.2 * k, by - bh * 0.1, postR + over - 1.4 * k, by);
      g.lineTo(postL - over + 1.4 * k, by);
      g.quadraticCurveTo(postL - over + 0.2 * k, by - bh * 0.1, postL - over - 1.2 * k, by - bh * 0.6);
      g.quadraticCurveTo(postL - over - 2.4 * k, by + bh * 0.5, postL - over, by + bh);
      g.closePath();
      g.fillStyle = 'rgba(0,0,0,.4)';
      g.save();
      g.translate(3, 4);
      g.fill();
      g.restore();
      g.clip();
      woodFill(postL - over - 3 * k, by - bh, (postR - postL) + over * 2 + 6 * k, bh * 2.2, 0);
      const gr = g.createLinearGradient(0, by - bh * 0.6, 0, by + bh);
      gr.addColorStop(0, 'rgba(255,220,180,.2)');
      gr.addColorStop(1, 'rgba(0,0,0,.45)');
      g.fillStyle = gr;
      g.fillRect(postL - over - 3 * k, by - bh, (postR - postL) + over * 2 + 6 * k, bh * 2.2);
      g.restore();
      // gold caps where the posts meet the beam
      for (const x of [postL, postR]) {
        g.fillStyle = metal(g, 'gold', x - pw * 0.7, 0, x + pw * 0.7, 0);
        g.fillRect(x - pw * 0.65, by + bh - k * 0.2, pw * 1.3, k * 1.1);
      }
      // the hooks the cords hang from
      for (const [x, y] of hang) {
        g.strokeStyle = metal(g, 'gold', x - 4, y - 4, x + 4, y + 4);
        g.lineWidth = Math.max(1.5, k * 0.35);
        g.beginPath();
        g.arc(x, y, k * 0.6, Math.PI * 0.1, Math.PI * 1.1);
        g.stroke();
      }
      // the mallet's hook on the right post
      const [mx, my] = malletHook;
      g.strokeStyle = metal(g, 'gold', mx - 4, my - 4, mx + 4, my + 4);
      g.lineWidth = Math.max(1.5, k * 0.35);
      g.beginPath();
      g.moveTo(mx - k * 0.6, my);
      g.quadraticCurveTo(mx + k * 1.4, my + k * 0.3, mx + k * 1.2, my - k * 1.0);
      g.stroke();
    }
  }

  /* The face of a tam-tam: dark hammered bronze, a polished middle and a lathed band near the
     rim, which turns over at the edge. */
  function gongFace(g, cx, cy, r) {
    g.save();
    // the turned-over rim
    g.fillStyle = metal(g, 'bronze', cx - r, cy - r, cx + r, cy + r);
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fill();
    // the dark body
    const body = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r * 0.95);
    body.addColorStop(0, '#5A4026');
    body.addColorStop(0.6, '#3A2614');
    body.addColorStop(1, '#22160A');
    g.fillStyle = body;
    g.beginPath();
    g.arc(cx, cy, r * 0.94, 0, TAU);
    g.fill();
    g.save();
    g.clip();
    // hammer marks all over
    // hammer marks all over: shallow facets, each lit on its upper left
    const rr = rand(31);
    for (let i = 0; i < 900; i++) {
      const a = rr() * TAU;
      const d = Math.sqrt(rr()) * r * 0.94;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const sz = r * (0.014 + rr() * 0.022);
      const turn = rr() * Math.PI;
      g.fillStyle = `rgba(255,214,150,${0.03 + rr() * 0.05})`;
      g.beginPath();
      g.ellipse(x - sz * 0.25, y - sz * 0.25, sz, sz * 0.7, turn, 0, TAU);
      g.fill();
      g.fillStyle = `rgba(0,0,0,${0.04 + rr() * 0.06})`;
      g.beginPath();
      g.ellipse(x + sz * 0.3, y + sz * 0.3, sz * 0.7, sz * 0.45, turn, 0, TAU);
      g.fill();
    }
    // a band of fine lathe rings near the rim, bright where the light catches them
    const band = (r0, r1) => {
      g.save();
      g.beginPath();
      g.arc(cx, cy, r1, 0, TAU);
      g.arc(cx, cy, r0, 0, TAU, true);
      g.clip();
      g.fillStyle = (() => {
        if (!g.createConicGradient) return '#C9973E';
        const cg = g.createConicGradient(-0.7, cx, cy);
        for (const [o, c] of [[0, '#8A5E22'], [0.1, '#F2D08A'], [0.2, '#B07A30'], [0.35, '#6A4416'], [0.5, '#9A6A28'], [0.6, '#E8C27A'], [0.7, '#A87430'], [0.85, '#5E3C12'], [1, '#8A5E22']]) cg.addColorStop(o, c);
        return cg;
      })();
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
      g.lineWidth = 0.8;
      for (let rad2 = r0; rad2 < r1; rad2 += Math.max(1.2, r / 90)) {
        g.strokeStyle = `rgba(${rad2 % 3 < 1.5 ? '40,24,4' : '255,240,200'},.16)`;
        g.beginPath();
        g.arc(cx, cy, rad2, 0, TAU);
        g.stroke();
      }
      g.restore();
    };
    band(r * 0.7, r * 0.86);
    band(0, r * 0.2);
    g.restore();
    // the rim's turned edge
    g.strokeStyle = 'rgba(0,0,0,.5)';
    g.lineWidth = Math.max(1, r * 0.012);
    g.beginPath();
    g.arc(cx, cy, r * 0.94, 0, TAU);
    g.stroke();
    g.strokeStyle = 'rgba(255,230,180,.4)';
    g.beginPath();
    g.arc(cx, cy, r * 0.985, Math.PI * 1.05, Math.PI * 1.65);
    g.stroke();
    // the two holes for the cord
    for (const sd of [-1, 1]) {
      g.fillStyle = '#100804';
      g.beginPath();
      g.arc(cx + sd * r * 0.42, cy - r * 0.86, Math.max(1.5, r * 0.018), 0, TAU);
      g.fill();
    }
    g.restore();
  }

  /* A gong mallet: a big fleece-covered head on a wooden handle. */
  function gongMallet(g, x, y, ang, k, alpha) {
    if (alpha <= 0) return;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const L = 15 * k;
    g.save();
    g.globalAlpha = alpha;
    stick(g, x, y, x + ux * L, y + uy * L, Math.max(3, k * 0.9), { color: '#A87444' });
    const rb = Math.max(8, k * 2.6);
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath();
    g.ellipse(x + rb * 0.25, y + rb * 0.35, rb, rb * 0.95, 0, 0, TAU);
    g.fill();
    const fg = g.createRadialGradient(x - rb * 0.35, y - rb * 0.4, rb * 0.1, x, y, rb);
    fg.addColorStop(0, '#F4EEE2');
    fg.addColorStop(0.55, '#D9CFBC');
    fg.addColorStop(1, '#9A8F7C');
    g.fillStyle = fg;
    g.beginPath();
    g.arc(x, y, rb, 0, TAU);
    g.fill();
    // a red band where the fleece is bound
    g.strokeStyle = '#A3302A';
    g.lineWidth = Math.max(2, k * 0.45);
    g.beginPath();
    g.arc(x, y, rb * 0.98, ang - 0.5, ang + 0.5);
    g.stroke();
    g.restore();
  }

  let pick = null;
  if (kind === 'cymbals') {
    pick = kit.choice({
      label: 'Cymbal',
      value: 'crash',
      options: [{ value: 'crash', label: 'Crash' }, { value: 'sus', label: 'Suspended' }],
      onChange(v) {
        suspended = v === 'sus';
        spec = suspended ? base.alt : base;
        hush(0.2);
        stopRoll();
        G = null;
        s.redraw();
      },
    });
  }

  // Listen: struck (x), rolled (roll), stopped (choke) or, the tambourine, shaken (shake).
  kit.performer({
    names: { x: ex.name },
    can: (e) => ['x', 'roll', 'choke', 'shake'].includes(e.part),
    // Crash cymbals choke; a roll needs the suspended cymbal.
    prepare(evs) {
      const want = evs.some((e) => e.part === 'roll') ? 1 : evs.some((e) => e.part === 'choke') ? 0 : -1;
      const b = pick?.querySelectorAll('button')[want];
      if (b && b.getAttribute('aria-checked') !== 'true') b.click();
    },
    down(e) {
      const d = Math.max(0, Math.min(1, (1 - (e.vel ?? 0.72)) / 0.75));
      if (e.part === 'choke') { hush(0.06); kit.hit('x', { choke: true }); return null; }
      if (e.part === 'shake' && base.shake) {
        sounds[base.shake].play({ vol: 0.75 });
        last = { at: performance.now(), x: 0, y: 0, power: 0.6, shake: true };
        s.animate(600);
        kit.hit('x', { shake: true });
        return null;
      }
      // a player strikes a little off the middle
      strike(d, 0.25, -0.2);
      if (e.part === 'roll' && spec.roll) { startRoll(); return 'roll'; }
      return null;
    },
    up(h) { if (h === 'roll') stopRoll(); },
    finish() { stopRoll(); },
  });

  // For tests: on the screen, the middle of what is struck, a point near its edge, and a spot
  // beside it where a tap strikes nothing (none for the triangle, which any tap strikes).
  s.canvas.museumAt = (where) => {
    const p = geom(s).at(where);
    return p && { u: p[0], v: p[1] };
  };

  let keyTimer = null;
  function keydown(e) {
    if (e.key !== ' ' || e.repeat) return;
    e.preventDefault();
    strike(0.4, 0.25, -0.2);
    holds.set('key', {});
    keyTimer = setTimeout(() => hold('key'), spec.wait || (spec.roll ? 220 : 320));
  }
  function keyup(e) {
    if (e.key !== ' ') return;
    clearTimeout(keyTimer);
    holds.delete('key');
    if (!holds.size) stopRoll();
  }
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);

  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    hush(0.3);
    stopRoll();
    s.destroy();
  };
}
