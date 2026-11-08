/* Timpani: four kettledrums, biggest (lowest) on the left. Tap a head to strike it; the best
   sound is partway between the middle and the edge, as players strike them. Hold for a roll.
   Each drum's pedal (below it) tunes it, and moving the pedal while it rings slides the note.
   On a computer, A S D F strike the four drums (hold for a roll), Z X C V and Shift+Z X C V
   move their pedals down and up. */

import { surface, rr, label, fine } from '../surface.js';
import { pitched, context, out } from '../audio.js';
import * as notes from '../notes.js';

const DRUMS = [
  { size: 32, lo: 38, hi: 45, tune: 43 },
  { size: 29, lo: 41, hi: 48, tune: 48 },
  { size: 26, lo: 46, hi: 53, tune: 50 },
  { size: 23, lo: 50, hi: 57, tune: 55 },
];
const KEYS = 'asdf';
const PEDAL_KEYS = 'zxcv';

export async function mount(stage, ex, kit) {
  const [hits, rolls] = await Promise.all([pitched('timpani', 36, 58), pitched('timpani-roll', 36, 58)]);
  const box = document.createElement('div');
  box.className = 'zone timpani';
  stage.append(box);

  const drums = DRUMS.map((d) => ({ ...d, pitch: d.tune, voices: [], roll: null, at: 0, hx: 0, hy: 0 }));
  const holds = new Map();   // pointer id -> { drum, timer } or { pedal }

  let layout = [];
  function geom(s) {
    const n = drums.length;
    const tall = s.H > s.W * 1.05;
    const cols = tall ? 2 : 4;
    const rows = tall ? 2 : 1;
    const cw = s.W / cols;
    const ch = (s.H - 10) / rows;
    const maxR = Math.min(cw * 0.41, ch * 0.36);
    layout = drums.map((d, i) => {
      const c = i % cols;
      const r = maxR * (0.78 + 0.22 * ((d.size - 23) / 9));
      const row = Math.floor(i / cols);
      // a gentle arc, as they stand around the player
      const arc = tall ? 0 : Math.sin(((c + 0.5) / cols) * Math.PI) * ch * -0.05;
      const x = cw * (c + 0.5);
      const y = row * ch + ch * 0.44 + arc;
      const pedal = { x: x - Math.min(cw * 0.36, 120), y: y + r + Math.min(ch * 0.12, 46), w: Math.min(cw * 0.72, 240), h: 34 };
      return { x, y, r, pedal };
    });
    return n;
  }

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
    kit.note(dr.pitch);
    s.animate(1500);
  }

  function startRoll(i) {
    const dr = drums[i];
    if (dr.roll) return;
    dr.roll = rolls.sustain({ attack: 0.25, release: 0.9 });
    dr.roll.start(dr.pitch, 0.8);
    kit.note(dr.pitch);
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
    kit.note(dr.pitch);
    s.redraw();
  }

  const pedalAt = (i, u) => {
    const p = layout[i].pedal;
    const f = Math.max(0, Math.min(1, (u - p.x) / p.w));
    return drums[i].lo + f * (drums[i].hi - drums[i].lo);
  };

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p) {
      for (let i = 0; i < drums.length; i++) {
        const q = layout[i];
        const pd = q.pedal;
        if (p.u > pd.x - 14 && p.u < pd.x + pd.w + 14 && p.v > pd.y - 18 && p.v < pd.y + pd.h + 18) {
          holds.set(p.id, { pedal: i });
          setPitch(i, pedalAt(i, p.u));
          return;
        }
        const d = Math.hypot(p.u - q.x, p.v - q.y) / q.r;
        if (d <= 1) {
          strike(i, d, (p.u - q.x) / q.r, (p.v - q.y) / q.r);
          const timer = setTimeout(() => startRoll(i), 230);
          holds.set(p.id, { drum: i, timer });
          return;
        }
      }
    },
    move(p) {
      const h = holds.get(p.id);
      if (h && h.pedal != null) setPitch(h.pedal, pedalAt(h.pedal, p.u));
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
  s.onresize = geom;
  geom(s);

  function draw(g, s) {
    const now = performance.now();
    const bg = g.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#1C2620');
    bg.addColorStop(1, '#121A15');
    g.fillStyle = bg;
    g.fillRect(0, 0, s.W, s.H);
    drums.forEach((dr, i) => {
      const { x, y, r, pedal } = layout[i];
      // copper bowl seen from above: the rim and a glint of the bowl
      const bowl = g.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.2, x, y, r * 1.12);
      bowl.addColorStop(0, '#F0A877');
      bowl.addColorStop(0.6, '#C46A3A');
      bowl.addColorStop(1, '#6E3418');
      g.fillStyle = bowl;
      g.beginPath(); g.arc(x, y, r * 1.1, 0, 7); g.fill();
      g.fillStyle = '#B9C2C8';
      g.beginPath(); g.arc(x, y, r * 1.02, 0, 7); g.fill();
      // the head
      const age = (now - dr.at) / 1000;
      const ring = (dr.roll ? 0.6 : 0) + Math.exp(-age * 2.5);
      const head = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
      head.addColorStop(0, '#FFFBF0');
      head.addColorStop(1, '#E3D6B8');
      g.fillStyle = head;
      g.beginPath(); g.arc(x, y, r * 0.96, 0, 7); g.fill();
      // the playing spot
      g.strokeStyle = 'rgba(150,110,60,.18)';
      g.lineWidth = r * 0.22;
      g.beginPath(); g.arc(x, y, r * 0.62, 0, 7); g.stroke();
      if (ring > 0.02) {
        g.save();
        g.beginPath(); g.arc(x, y, r * 0.96, 0, 7); g.clip();
        for (let k = 0; k < 4; k++) {
          const rr2 = r * (0.25 + ((now / 900 + k / 4) % 1) * 0.8);
          g.strokeStyle = `rgba(196,106,58,${0.3 * Math.min(1, ring)})`;
          g.lineWidth = 3;
          g.beginPath(); g.arc(x + dr.hx * r * 0.3, y + dr.hy * r * 0.3, rr2, 0, 7); g.stroke();
        }
        g.restore();
      }
      // tension rods
      g.fillStyle = '#8D99A3';
      for (let k = 0; k < 8; k++) {
        const t = (k / 8) * Math.PI * 2 + 0.2;
        g.beginPath(); g.arc(x + Math.cos(t) * r * 1.06, y + Math.sin(t) * r * 1.06, Math.max(3, r * 0.04), 0, 7); g.fill();
      }
      // the note it is tuned to
      label(g, s, notes.full(dr.pitch), x, y, { size: Math.max(16, r * 0.2), color: 'rgba(110,52,24,.75)' });
      // pedal: a track from its lowest to its highest note
      g.fillStyle = 'rgba(255,255,255,.08)';
      rr(g, pedal.x, pedal.y, pedal.w, pedal.h, pedal.h / 2);
      g.fill();
      const f = (dr.pitch - dr.lo) / (dr.hi - dr.lo);
      for (let m = dr.lo; m <= dr.hi; m++) {
        const tx = pedal.x + ((m - dr.lo) / (dr.hi - dr.lo)) * pedal.w;
        g.fillStyle = 'rgba(246,241,228,.3)';
        g.fillRect(tx - 1, pedal.y + pedal.h * 0.3, 2, pedal.h * 0.4);
      }
      const px = pedal.x + f * pedal.w;
      g.save();
      g.shadowColor = 'rgba(0,0,0,.5)';
      g.shadowBlur = 8;
      g.fillStyle = '#2B2622';
      rr(g, px - 22, pedal.y - 6, 44, pedal.h + 12, 10);
      g.fill();
      g.restore();
      g.fillStyle = '#C9D1D6';
      rr(g, px - 16, pedal.y, 32, pedal.h, 7);
      g.fill();
      if (fine()) {
        label(g, s, KEYS[i].toUpperCase(), x, y + r * 0.35, { size: 12, color: 'rgba(110,52,24,.5)' });
        label(g, s, PEDAL_KEYS[i].toUpperCase(), pedal.x - 10, pedal.y + pedal.h / 2, { size: 11, color: 'rgba(246,241,228,.45)', align: 'right' });
      }
    });
  }

  const keyHolds = new Map();
  function keydown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const i = KEYS.indexOf(k);
    if (i >= 0 && !e.repeat) {
      strike(i);
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

  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    drums.forEach((d, i) => { stopRoll(i); d.voices.forEach((v) => v.stop(0.2)); });
    s.destroy();
  };
}
