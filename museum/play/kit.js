/* Drum set, seen from the drummer's seat. Tap a drum or cymbal; nearer the middle of a drum
   is fuller. The snare's rim is a cross-stick, the ride's bell rings like a bell. Keep a finger
   on a cymbal to choke it. The hi-hat pedal: hold it to open the hi-hat, let go to close it.
   On a computer, the letters on each drum play it; Space is the bass drum. */

import { surface, label, fine } from '../surface.js';
import { hit } from '../audio.js';

const PARTS = [
  // id, kind, sound, x, y (wide screen), x, y (tall screen), size, key
  ['crash', 'cymbal', 'kit-crash', 0.15, 0.2, 0.22, 0.1, 0.15, 'e'],
  ['splash', 'cymbal', 'kit-splash', 0.36, 0.1, 0.55, 0.06, 0.09, 'w'],
  ['ride', 'cymbal', 'kit-ride', 0.86, 0.25, 0.8, 0.13, 0.17, 'i'],
  ['hihat', 'hats', 'kit-hihat-closed', 0.1, 0.6, 0.16, 0.38, 0.12, 'h'],
  ['tom1', 'drum', 'kit-tom-high', 0.4, 0.36, 0.38, 0.26, 0.1, 'r'],
  ['tom2', 'drum', 'kit-tom-high', 0.58, 0.34, 0.62, 0.27, 0.11, 't'],
  ['snare', 'snare', 'kit-snare', 0.3, 0.68, 0.32, 0.52, 0.12, 'f'],
  ['floor', 'drum', 'kit-tom-low', 0.74, 0.68, 0.72, 0.5, 0.14, 'g'],
  ['kick', 'kick', 'kit-kick', 0.52, 0.8, 0.52, 0.72, 0.15, ' '],
  ['pedal', 'pedal', 'kit-hihat-pedal', 0.1, 0.9, 0.16, 0.86, 0.07, 'shift'],
];
const RATE = { tom2: 0.86, floor: 0.92 };

export async function mount(stage, ex) {
  const names = [...new Set(PARTS.map((p) => p[2])), 'kit-hihat-open', 'kit-cross-stick', 'kit-ride-bell', 'kit-snare-ghost'];
  const sounds = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await hit(n)])));

  const box = document.createElement('div');
  box.className = 'zone kit';
  stage.append(box);

  const ringing = new Map();   // part id -> voice (cymbals, open hi-hat)
  const anim = new Map();      // part id -> { at, x, y, power }
  const holds = new Map();     // pointer id -> { part, at }
  let open = false;            // hi-hat pedal lifted
  let tall = false;

  let size = 1;
  const place = (p, s) => {
    tall = s.H > s.W * 1.05;
    const x = (tall ? p[5] : p[3]) * s.W;
    const y = (tall ? p[6] : p[4]) * s.H;
    return { x, y, r: p[7] * size };
  };

  function strike(id, at = { x: 0, y: 0, d: 0 }) {
    const part = PARTS.find((p) => p[0] === id);
    const kind = part[1];
    let name = part[2];
    let vol = 0.85;
    if (kind === 'drum' || kind === 'snare') vol = 0.95 - at.d * 0.35;
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
    const v = sounds[name].play({ vol, rate: RATE[id] || 1 });
    if (kind === 'cymbal' || (kind === 'hats' && open)) {
      ringing.set(kind === 'hats' ? 'hihat' : id, v);
    }
    anim.set(id, { at: performance.now(), x: at.x, y: at.y, power: vol });
    s.animate(kind === 'cymbal' ? 2200 : 700);
  }

  function partAt(u, v) {
    let best = null;
    for (const p of PARTS) {
      const q = place(p, s);
      const d = Math.hypot(u - q.x, v - q.y) / q.r;
      if (d <= 1.08 && (!best || d < best.d)) best = { id: p[0], d, x: (u - q.x) / q.r, y: (v - q.y) / q.r };
    }
    return best;
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
      const kind = PARTS.find((q) => q[0] === h.id)[1];
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
  s.onresize = (s) => { size = s.H > s.W * 1.05 ? Math.min(s.W, s.H / 1.5) : Math.min(s.W / 1.5, s.H); };
  s.onresize(s);

  function draw(g, s) {
    const now = performance.now();
    // a rug under the kit
    const rug = g.createRadialGradient(s.W / 2, s.H * 0.6, 10, s.W / 2, s.H * 0.6, Math.max(s.W, s.H) * 0.7);
    rug.addColorStop(0, '#5A2A24');
    rug.addColorStop(0.7, '#3B1C18');
    rug.addColorStop(1, '#1B1210');
    g.fillStyle = rug;
    g.fillRect(0, 0, s.W, s.H);
    // stands under the cymbals, then the drums, then the cymbals on top
    const order = ['kick', 'pedal', 'floor', 'snare', 'tom1', 'tom2', 'hihat', 'crash', 'splash', 'ride'];
    for (const id of order) {
      const p = PARTS.find((q) => q[0] === id);
      const q = place(p, s);
      const a = anim.get(id);
      const age = a ? (now - a.at) / 1000 : 9;
      const kind = p[1];
      if (kind === 'cymbal' || kind === 'hats') cymbal(g, q, age, a, kind, id);
      else if (kind === 'pedal') pedal(g, q);
      else drum(g, q, age, a, kind);
      if (fine()) label(g, s, p[8] === ' ' ? 'Space' : p[8] === 'shift' ? 'Shift' : p[8].toUpperCase(), q.x, q.y + q.r + 14, { size: 12, color: 'rgba(246,241,228,.55)' });
    }
  }

  function drum(g, { x, y, r }, age, a, kind) {
    const kick = kind === 'kick';
    // shell
    g.fillStyle = kick ? '#7E2421' : '#9C2E2A';
    g.beginPath(); g.arc(x, y + (kick ? 0 : r * 0.08), r * 1.04, 0, 7); g.fill();
    // chrome hoop
    const hoop = g.createLinearGradient(x - r, y - r, x + r, y + r);
    hoop.addColorStop(0, '#F4F7F9'); hoop.addColorStop(0.5, '#9AA5AD'); hoop.addColorStop(1, '#E3E8EC');
    g.strokeStyle = hoop;
    g.lineWidth = Math.max(3, r * 0.07);
    g.beginPath(); g.arc(x, y, r * 0.98, 0, 7); g.stroke();
    // head
    const pulse = a ? Math.exp(-age * 9) : 0;
    const head = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    head.addColorStop(0, '#FFFDF7');
    head.addColorStop(1, kick ? '#D9CDB4' : '#E9E0CC');
    g.fillStyle = head;
    g.beginPath(); g.arc(x, y, r * (0.93 - pulse * 0.02), 0, 7); g.fill();
    if (kick) {
      g.fillStyle = 'rgba(126,36,33,.18)';
      g.beginPath(); g.arc(x, y, r * 0.55, 0, 7); g.fill();
    }
    if (kind === 'snare') {
      g.strokeStyle = 'rgba(0,0,0,.08)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r * 0.86, 0, 7); g.stroke();
    }
    // tension lugs
    g.fillStyle = '#C9D1D6';
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2;
      g.beginPath(); g.arc(x + Math.cos(t) * r * 1.02, y + Math.sin(t) * r * 1.02, Math.max(2, r * 0.045), 0, 7); g.fill();
    }
    ripple(g, x, y, r, age, a);
  }

  function cymbal(g, { x, y, r }, age, a, kind, id) {
    const wob = a ? Math.exp(-age * 2.5) * Math.sin(age * 28) * 0.05 * (ringing.has(id === 'hihat' ? 'hihat' : id) || kind === 'hats' ? 1 : 0.3) : 0;
    g.save();
    g.translate(x, y);
    g.scale(1 + wob, 1 - wob);
    // stand
    g.fillStyle = '#2A2523';
    g.beginPath(); g.arc(0, 0, r * 0.08, 0, 7); g.fill();
    const draw1 = (dx, dy, rr2) => {
      const c = g.createRadialGradient(dx - rr2 * 0.3, dy - rr2 * 0.35, rr2 * 0.05, dx, dy, rr2);
      c.addColorStop(0, '#FBEAB5'); c.addColorStop(0.55, '#D9A93E'); c.addColorStop(1, '#9A6E1E');
      g.fillStyle = c;
      g.beginPath(); g.arc(dx, dy, rr2, 0, 7); g.fill();
      g.strokeStyle = 'rgba(120,80,20,.35)';
      g.lineWidth = 1;
      for (let k = 0.3; k < 1; k += 0.12) { g.beginPath(); g.arc(dx, dy, rr2 * k, 0, 7); g.stroke(); }
      // bell
      g.fillStyle = '#E8C268';
      g.beginPath(); g.arc(dx, dy, rr2 * 0.28, 0, 7); g.fill();
      g.fillStyle = '#2A2523';
      g.beginPath(); g.arc(dx, dy, rr2 * 0.05, 0, 7); g.fill();
    };
    if (kind === 'hats') {
      // two hats: apart when the pedal is up
      const gap = open ? r * 0.16 : r * 0.04;
      g.globalAlpha = 0.9;
      draw1(0, gap, r * 0.98);
      g.globalAlpha = 1;
      draw1(0, -gap, r);
    } else {
      draw1(0, 0, r);
    }
    g.restore();
    if (a && age < 0.5) {
      g.fillStyle = `rgba(255,240,190,${0.5 * (1 - age / 0.5)})`;
      g.beginPath(); g.arc(x, y, r * (1 + age * 0.6), 0, 7); g.fill();
    }
  }

  function pedal(g, { x, y, r }) {
    g.save();
    g.translate(x, y);
    g.fillStyle = '#2B2622';
    g.beginPath();
    g.roundRect ? g.roundRect(-r * 0.55, -r, r * 1.1, r * 2, r * 0.3) : g.rect(-r * 0.55, -r, r * 1.1, r * 2);
    g.fill();
    g.fillStyle = open ? '#E2B44A' : '#9AA5AD';
    g.beginPath();
    g.roundRect ? g.roundRect(-r * 0.42, -r * 0.85 - (open ? 0 : -r * 0.1), r * 0.84, r * 1.6, r * 0.25) : g.rect(-r * 0.42, -r * 0.85, r * 0.84, r * 1.6);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.3)';
    for (let k = -0.6; k < 0.8; k += 0.25) { g.beginPath(); g.moveTo(-r * 0.3, r * k); g.lineTo(r * 0.3, r * k); g.stroke(); }
    g.restore();
  }

  function ripple(g, x, y, r, age, a) {
    if (!a || age > 0.6) return;
    g.save();
    g.beginPath(); g.arc(x, y, r * 0.93, 0, 7); g.clip();
    const hx = x + a.x * r;
    const hy = y + a.y * r;
    for (let k = 0; k < 3; k++) {
      const t = age - k * 0.06;
      if (t < 0) continue;
      g.strokeStyle = `rgba(180,120,60,${0.45 * (1 - t / 0.6)})`;
      g.lineWidth = 3;
      g.beginPath(); g.arc(hx, hy, t * r * 3, 0, 7); g.stroke();
    }
    g.restore();
  }

  let keyPedal = false;
  function keydown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Shift') { if (!e.repeat) { keyPedal = true; open = true; s.redraw(); } return; }
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    const p = PARTS.find((q) => q[8] === k);
    if (!p) return;
    if (k === ' ') e.preventDefault();
    strike(p[0], { x: 0, y: 0, d: 0.3 });
  }
  function keyup(e) {
    if (e.key === 'Shift') { keyPedal = false; open = false; strike('pedal'); }
  }
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);

  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    for (const v of ringing.values()) v.stop(0.3);
    s.destroy();
  };
}
