/* Single percussion instruments: snare drum, bass drum, cymbals, triangle, tambourine, gong.
   Tap to strike. Hold for a roll on the snare, triangle, tambourine and suspended cymbal;
   holding the crash cymbals chokes them, and a hand left on the bass drum or gong stops it.
   On a computer, Space strikes (hold it for a roll or to stop the sound). */

import { surface, rr } from '../surface.js';
import { hit } from '../audio.js';

const SPECS = {
  snare: { sound: 'snare', roll: 'snare-roll' },
  bassdrum: { sound: 'bass-drum', damp: true },
  cymbals: { sound: 'cymbal', choke: true, alt: { sound: 'sus-cymbal', roll: 'sus-cymbal-roll' } },
  triangle: { sound: 'triangle', roll: 'triangle-roll' },
  tambourine: { sound: 'tambourine', roll: 'tambourine-roll', shake: 'tambourine-shake' },
  gong: { sound: 'gong', damp: true, wait: 700 },
};

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
  let last = { at: 0, x: 0, y: 0, power: 0 };
  const holds = new Map();
  let suspended = false;

  function strike(d = 0.5, x = 0, y = 0) {
    let vol = 0.85;
    let filter = null;
    if (kind === 'snare') vol = 0.95 - d * 0.4;
    if (kind === 'bassdrum') { vol = 0.75 + (1 - d) * 0.25; filter = 600 + (1 - d) * 3000; }
    if (kind === 'gong') { vol = 0.6 + (1 - d) * 0.35; filter = 1500 + (1 - d) * 8000; }
    if (kind === 'triangle') vol = 0.8;
    const v = sounds[spec.sound].play({ vol, filter });
    ringing.push(v);
    if (ringing.length > 4) ringing.shift().stop(0.3);
    last = { at: performance.now(), x, y, power: vol };
    s.animate(kind === 'gong' ? 8000 : kind === 'cymbals' || kind === 'triangle' ? 3000 : 900);
  }

  function hush(release = 0.08) {
    ringing.forEach((v) => v.stop(release));
    ringing = [];
    last.at = 0;
    s.redraw();
  }

  function startRoll() {
    if (!spec.roll || roll) return;
    roll = sounds[spec.roll].play({ vol: 0.8, loop: true });
    s.animate(60000);
  }
  function stopRoll() {
    if (!roll) return;
    roll.stop(kind === 'triangle' || kind === 'cymbals' ? 0.6 : 0.12);
    roll = null;
    s.animating = performance.now() + 1500;
    s.redraw();
  }

  // Where the instrument is, for hits.
  let G = { cx: 0, cy: 0, r: 0 };
  function geom(s) {
    G = { cx: s.W / 2, cy: s.H / 2, r: Math.min(s.W, s.H) * 0.4 };
    return G;
  }

  function hold(id) {
    const h = holds.get(id);
    if (!h) return;
    if (spec.roll) startRoll();
    else if (spec.choke) hush(0.06);
    else if (spec.damp) hush(0.15);
  }

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p) {
      const dx = (p.u - G.cx) / G.r;
      const dy = (p.v - G.cy) / G.r;
      const d = Math.hypot(dx, dy);
      if (kind !== 'cymbals' && kind !== 'triangle' && d > 1.15) return;
      // A second hand on a ringing bass drum or gong stops it at once.
      if (spec.damp && holds.size) { hush(0.12); return; }
      strike(Math.min(1, d), dx, dy);
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
  s.onresize = geom;
  geom(s);

  function draw(g, s) {
    const now = performance.now();
    const age = last.at ? (now - last.at) / 1000 : 99;
    const bg = g.createRadialGradient(s.W / 2, s.H * 0.45, 20, s.W / 2, s.H / 2, Math.max(s.W, s.H) * 0.7);
    bg.addColorStop(0, '#2A3A31');
    bg.addColorStop(1, '#121A15');
    g.fillStyle = bg;
    g.fillRect(0, 0, s.W, s.H);
    const { cx, cy, r } = G;
    const rolling = !!roll;
    const shake = rolling ? Math.sin(now / 18) * 2 : 0;
    ({ snare, bassdrum, cymbals, triangle, tambourine, gong })[kind](g, cx, cy, r, age, rolling, shake, now);
  }

  function ripple(g, cx, cy, r, age, color) {
    if (age > 0.8) return;
    g.save();
    g.beginPath(); g.arc(cx, cy, r * 0.94, 0, 7); g.clip();
    for (let k = 0; k < 3; k++) {
      const t = age - k * 0.07;
      if (t < 0) continue;
      g.strokeStyle = color.replace('A', String(0.45 * (1 - t / 0.8)));
      g.lineWidth = 3;
      g.beginPath(); g.arc(cx + last.x * r, cy + last.y * r, t * r * 2.4, 0, 7); g.stroke();
    }
    g.restore();
  }

  function head(g, cx, cy, r, tint = '#E9E0CC') {
    const h = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    h.addColorStop(0, '#FFFDF7');
    h.addColorStop(1, tint);
    g.fillStyle = h;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }

  function snare(g, cx, cy, r, age, rolling, shake) {
    const hoop = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    hoop.addColorStop(0, '#F4F7F9'); hoop.addColorStop(0.5, '#8D99A3'); hoop.addColorStop(1, '#E3E8EC');
    g.fillStyle = '#7D888F';
    g.beginPath(); g.arc(cx, cy + 8, r * 1.04, 0, 7); g.fill();
    g.fillStyle = hoop;
    g.beginPath(); g.arc(cx, cy, r * 1.04, 0, 7); g.fill();
    head(g, cx + shake, cy, r * 0.95);
    for (let k = 0; k < 10; k++) {
      const t = (k / 10) * Math.PI * 2;
      g.fillStyle = '#C9D1D6';
      g.beginPath(); g.arc(cx + Math.cos(t) * r * 1.0, cy + Math.sin(t) * r * 1.0, r * 0.035, 0, 7); g.fill();
    }
    ripple(g, cx, cy, r, rolling ? (performance.now() / 1000) % 0.3 : age, 'rgba(150,110,60,A)');
  }

  function bassdrum(g, cx, cy, r, age) {
    const wob = Math.exp(-age * 4) * Math.sin(age * 40) * 0.012;
    g.fillStyle = '#1F3329';
    g.beginPath(); g.arc(cx, cy, r * 1.06, 0, 7); g.fill();
    g.strokeStyle = '#C9D1D6';
    g.lineWidth = r * 0.03;
    g.beginPath(); g.arc(cx, cy, r * 0.99, 0, 7); g.stroke();
    head(g, cx, cy, r * (0.96 + wob), '#E6DABE');
    for (let k = 0; k < 14; k++) {
      const t = (k / 14) * Math.PI * 2;
      g.fillStyle = '#C9D1D6';
      rr(g, cx + Math.cos(t) * r * 1.03 - 4, cy + Math.sin(t) * r * 1.03 - 4, 8, 8, 2);
      g.fill();
    }
    ripple(g, cx, cy, r, age, 'rgba(120,90,50,A)');
  }

  function cymbals(g, cx, cy, r, age, rolling, shake, now) {
    const ring = ringing.length ? Math.exp(-age * 1.2) : 0;
    const one = (x, y, rad, tilt) => {
      const wob = (ring + (rolling ? 0.4 : 0)) * Math.sin(now / 30) * 0.03;
      g.save();
      g.translate(x, y);
      g.scale(1 + wob, 1 - wob);
      const c = g.createRadialGradient(-rad * 0.3, -rad * 0.35, rad * 0.05, 0, 0, rad);
      c.addColorStop(0, '#FBEAB5'); c.addColorStop(0.55, '#D9A93E'); c.addColorStop(1, '#9A6E1E');
      g.fillStyle = c;
      g.beginPath(); g.ellipse(0, 0, rad, rad * tilt, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(120,80,20,.35)';
      for (let k = 0.3; k < 1; k += 0.1) { g.beginPath(); g.ellipse(0, 0, rad * k, rad * k * tilt, 0, 0, 7); g.stroke(); }
      g.fillStyle = '#E8C268';
      g.beginPath(); g.ellipse(0, 0, rad * 0.24, rad * 0.24 * tilt, 0, 0, 7); g.fill();
      g.restore();
    };
    if (suspended) {
      g.strokeStyle = '#4A4440';
      g.lineWidth = 8;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, s.H); g.stroke();
      one(cx, cy, r * 1.05, 0.55);
    } else {
      // the pair, swinging together as they crash
      const gap = r * 0.08 + Math.min(1, age * 3) * r * 0.06 * (ring ? 1 : 0.5);
      one(cx - r * 0.55 - gap, cy, r * 0.75, 1);
      one(cx + r * 0.55 + gap, cy, r * 0.75, 1);
      // straps
      g.fillStyle = '#5A3A1E';
      for (const x of [cx - r * 0.55 - gap, cx + r * 0.55 + gap]) { rr(g, x - 10, cy - 10, 20, 20, 5); g.fill(); }
    }
    if (ring > 0.05) s.animate(200);
  }

  function triangle(g, cx, cy, r, age, rolling, shake, now) {
    const ring = ringing.length ? Math.exp(-age * 0.8) : 0;
    const a = r * 1.05;
    const top = { x: cx, y: cy - a * 0.75 };
    const left = { x: cx - a * 0.85, y: cy + a * 0.7 };
    const right = { x: cx + a * 0.85, y: cy + a * 0.7 };
    // the string it hangs from
    g.strokeStyle = 'rgba(246,241,228,.6)';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, top.y - 14); g.stroke();
    g.beginPath(); g.arc(cx, top.y - 4, 10, 0, 7); g.stroke();
    const sway = Math.sin(now / 300) * ring * 0.02;
    g.save();
    g.translate(cx, top.y - 14);
    g.rotate(sway);
    g.translate(-cx, -(top.y - 14));
    g.save();
    if (ring > 0.02 || rolling) { g.shadowColor = 'rgba(220,240,255,.9)'; g.shadowBlur = 20 * Math.max(ring, rolling ? 0.6 : 0); }
    const steel = g.createLinearGradient(left.x, top.y, right.x, left.y);
    steel.addColorStop(0, '#F4F7F9'); steel.addColorStop(0.5, '#A9B4BB'); steel.addColorStop(1, '#E3E8EC');
    g.strokeStyle = steel;
    g.lineWidth = Math.max(8, r * 0.06);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(top.x - a * 0.06, top.y + a * 0.12);
    g.lineTo(left.x, left.y);
    g.lineTo(right.x, right.y);
    g.lineTo(top.x + a * 0.06, top.y + a * 0.02);
    g.stroke();
    g.restore();
    g.restore();
    // the beater, in a corner when rolling
    g.strokeStyle = '#8D99A3';
    g.lineWidth = 5;
    g.lineCap = 'round';
    const bx = rolling ? left.x + a * 0.3 + Math.sin(now / 25) * 10 : right.x + 20;
    const by = rolling ? left.y - a * 0.15 : cy - a * 0.2;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + a * 0.5, by - a * 0.45); g.stroke();
    if (ring > 0.02) s.animate(120);
  }

  function tambourine(g, cx, cy, r, age, rolling, shake) {
    const jig = rolling ? shake * 2 : Math.exp(-age * 8) * Math.sin(age * 60) * 4;
    g.save();
    g.translate(jig, 0);
    g.fillStyle = '#B86E35';
    g.beginPath(); g.arc(cx, cy, r * 1.08, 0, 7); g.fill();
    g.fillStyle = '#DA9A5B';
    g.beginPath(); g.arc(cx, cy, r * 1.02, 0, 7); g.fill();
    head(g, cx, cy, r * 0.9);
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2 + 0.2;
      const x = cx + Math.cos(t) * r * 0.97;
      const y = cy + Math.sin(t) * r * 0.97;
      g.save();
      g.translate(x, y);
      g.rotate(t + Math.PI / 2);
      g.fillStyle = '#3B2418';
      rr(g, -r * 0.13, -r * 0.05, r * 0.26, r * 0.1, 3);
      g.fill();
      for (const dx of [-r * 0.06, r * 0.06]) {
        const c = g.createRadialGradient(dx - 2, -2, 1, dx, 0, r * 0.06);
        c.addColorStop(0, '#FBEAB5'); c.addColorStop(1, '#A9781F');
        g.fillStyle = c;
        g.beginPath(); g.arc(dx + (rolling ? Math.sin(performance.now() / 20 + k) * 2 : 0), 0, r * 0.058, 0, 7); g.fill();
      }
      g.restore();
    }
    g.restore();
    ripple(g, cx, cy, r * 0.9, age, 'rgba(150,110,60,A)');
  }

  function gong(g, cx, cy, r, age, rolling, shake, now) {
    const ring = ringing.length ? Math.min(1, age * 4) * Math.exp(-age * 0.25) : 0;
    // frame
    g.strokeStyle = '#5A3A1E';
    g.lineWidth = 14;
    g.lineJoin = 'round';
    g.beginPath(); g.moveTo(cx - r * 1.25, s.H); g.lineTo(cx - r * 1.25, cy - r * 1.2); g.lineTo(cx + r * 1.25, cy - r * 1.2); g.lineTo(cx + r * 1.25, s.H); g.stroke();
    g.strokeStyle = 'rgba(246,241,228,.5)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - r * 0.5, cy - r * 1.2); g.lineTo(cx - r * 0.4, cy - r * 0.9); g.moveTo(cx + r * 0.5, cy - r * 1.2); g.lineTo(cx + r * 0.4, cy - r * 0.9); g.stroke();
    const sway = Math.sin(now / 700) * ring * 0.012;
    g.save();
    g.translate(cx, cy - r * 1.2);
    g.rotate(sway);
    g.translate(-cx, -(cy - r * 1.2));
    g.save();
    if (ring > 0.02) { g.shadowColor = `rgba(255,200,100,${0.8 * ring})`; g.shadowBlur = 50 * ring; }
    const c = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r);
    c.addColorStop(0, '#FBEAB5'); c.addColorStop(0.5, '#D9A93E'); c.addColorStop(1, '#8A5E17');
    g.fillStyle = c;
    g.beginPath(); g.arc(cx, cy, r * 0.95, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(110,70,15,.4)';
    g.lineWidth = r * 0.04;
    g.beginPath(); g.arc(cx, cy, r * 0.88, 0, 7); g.stroke();
    g.lineWidth = 1;
    for (let k = 0.35; k < 0.85; k += 0.08) { g.beginPath(); g.arc(cx, cy, r * k, 0, 7); g.stroke(); }
    g.fillStyle = '#C99A3E';
    g.beginPath(); g.arc(cx, cy, r * 0.22, 0, 7); g.fill();
    g.restore();
    if (ring > 0.02) s.animate(200);
  }

  if (kind === 'cymbals') {
    kit.choice({
      label: 'Cymbal',
      value: 'crash',
      options: [{ value: 'crash', label: 'Crash' }, { value: 'sus', label: 'Suspended' }],
      onChange(v) {
        suspended = v === 'sus';
        spec = suspended ? base.alt : base;
        hush(0.2);
        stopRoll();
      },
    });
  }

  let keyTimer = null;
  function keydown(e) {
    if (e.key !== ' ' || e.repeat) return;
    e.preventDefault();
    strike(0.4);
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
