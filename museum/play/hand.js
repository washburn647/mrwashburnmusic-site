/* Hand percussion from around the world: congas, bongos, agogô, cowbell, claves, güiro,
   shaker, cabasa, log drum, sleigh bells, and the kalimba. Each exhibit lists its parts
   (opts.parts): a sound from /assets/sounds/ and a shape to draw.
   Tap a drum or bell; a drum is fullest in the middle. Scrape the güiro along its ridges, and
   the faster you scrape the brighter it rasps. Shake the shaker, cabasa or sleigh bells by
   moving a finger back and forth on them (or tap). Pluck the kalimba's tines with your thumbs.
   On a computer, the letters on each part play it. */

import { surface, label, fine } from '../surface.js';
import { hit, pitched } from '../audio.js';

/* How each shape is played: struck once, shaken (each change of direction sounds), or scraped. */
const HOW = { drum: 'strike', bongo: 'strike', bell: 'strike', agogo: 'strike', claves: 'strike', slit: 'strike', guiro: 'scrape', shaker: 'shake', cabasa: 'shake', sleigh: 'shake' };
const KEYS = 'fjdksla;';

export async function mount(stage, ex, kit) {
  const o = ex.opts;
  if (o.tines) return tines(stage, ex, kit);
  const parts = o.parts.map((p, i) => ({ ...p, key: KEYS[i], at: 0, power: 0, x: 0, y: 0 }));
  const sounds = Object.fromEntries(await Promise.all([...new Set(parts.map((p) => p.sound))].map(async (n) => [n, await hit(n)])));

  const box = document.createElement('div');
  box.className = 'zone hand';
  stage.append(box);

  let cells = [];
  function layout(s) {
    // side by side on a wide screen, one above the other on a tall one
    const n = parts.length;
    const wide = s.W >= s.H;
    cells = parts.map((p, i) => {
      const w = wide ? s.W / n : s.W;
      const h = wide ? s.H : s.H / n;
      const cx = wide ? w * (i + 0.5) : s.W / 2;
      const cy = wide ? s.H / 2 : h * (i + 0.5);
      const r = Math.min(w, h) * 0.34 * (p.size || 1);
      return { cx, cy, r, w, h };
    });
  }

  function strike(i, d = 0.3, x = 0, y = 0, power = null) {
    const p = parts[i];
    // nearer the middle of a drum is fuller; a bell rings best near its open end
    const vel = power ?? Math.max(0.2, 1 - d * 0.6);
    sounds[p.sound].play({ vol: 0.45 + 0.5 * vel, rate: (p.rate || 1) * (0.99 + Math.random() * 0.02) });
    Object.assign(p, { at: performance.now(), power: vel, x, y });
    s.animate(700);
  }

  function partAt(u, v) {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (Math.abs(u - c.cx) < c.w / 2 && Math.abs(v - c.cy) < c.h / 2) {
        const dx = (u - c.cx) / c.r;
        const dy = (v - c.cy) / c.r;
        return { i, d: Math.min(1, Math.hypot(dx, dy)), dx, dy };
      }
    }
    return null;
  }

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p) {
      const h = partAt(p.u, p.v);
      if (!h) return;
      p.data.part = h.i;
      p.data.dir = 0;
      p.data.travel = 0;
      const how = HOW[parts[h.i].shape];
      if (how === 'strike' || how === 'shake') strike(h.i, h.d, h.dx, h.dy);
    },
    move(p) {
      const i = p.data.part;
      if (i == null) return;
      const part = parts[i];
      const how = HOW[part.shape];
      const du = p.u - p.pu;
      const dv = p.v - p.pv;
      const dt = Math.max(1, p.t - p.pt);
      if (how === 'shake') {
        // a shake sounds each time the hand turns around
        const along = Math.abs(du) > Math.abs(dv) ? du : dv;
        const dir = Math.sign(along);
        const speed = Math.abs(along) / dt;
        if (dir && p.data.dir && dir !== p.data.dir && speed > 0.15) strike(i, 0, 0, 0, Math.min(1, 0.3 + speed * 0.5));
        if (dir) p.data.dir = dir;
      } else if (how === 'scrape') {
        // the güiro sounds as the stick crosses its ridges: every so far along it
        p.data.travel += Math.abs(du) + Math.abs(dv);
        const step = cells[i].r * 0.9;
        if (p.data.travel > step) {
          p.data.travel = 0;
          const speed = Math.hypot(du, dv) / dt;
          sounds[part.sound].play({ vol: 0.5 + Math.min(0.4, speed * 0.3), rate: 0.85 + Math.min(0.5, speed * 0.4) });
          Object.assign(part, { at: performance.now(), power: 0.8, x: (p.u - cells[i].cx) / cells[i].r, y: 0 });
          s.animate(400);
        }
      }
    },
  });
  s.onresize = layout;
  layout(s);

  function draw(g, s) {
    const bg = g.createRadialGradient(s.W / 2, s.H * 0.45, 20, s.W / 2, s.H / 2, Math.max(s.W, s.H) * 0.7);
    bg.addColorStop(0, '#2A3A31');
    bg.addColorStop(1, '#121A15');
    g.fillStyle = bg;
    g.fillRect(0, 0, s.W, s.H);
    const now = performance.now();
    parts.forEach((p, i) => {
      const c = cells[i];
      const age = (now - p.at) / 1000;
      const jolt = p.at ? Math.exp(-age * 9) * p.power : 0;
      g.save();
      g.translate(c.cx, c.cy);
      SHAPES[p.shape](g, c.r, jolt, p, now);
      g.restore();
      if (fine()) label(g, s, p.key.toUpperCase(), c.cx, c.cy + c.r * 1.2 + 16, { size: 12, color: 'rgba(246,241,228,.5)' });
      if (p.name) label(g, s, p.name, c.cx, c.cy - c.r * 1.2 - 16, { size: 15, color: 'rgba(246,241,228,.8)' });
    });
  }

  function keydown(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const i = parts.findIndex((p) => p.key === e.key.toLowerCase());
    if (i < 0) return;
    if (HOW[parts[i].shape] === 'scrape') {
      sounds[parts[i].sound].play({ vol: 0.7 });
      Object.assign(parts[i], { at: performance.now(), power: 0.8 });
      s.animate(400);
    } else strike(i, 0.3);
  }
  addEventListener('keydown', keydown);
  return () => {
    removeEventListener('keydown', keydown);
    s.destroy();
  };
}

function ripple(g, r, jolt, p, color) {
  if (jolt < 0.02) return;
  g.save();
  g.beginPath(); g.arc(0, 0, r * 0.95, 0, 7); g.clip();
  g.strokeStyle = color.replace('A', String(0.5 * jolt));
  g.lineWidth = 3;
  g.beginPath(); g.arc(p.x * r, p.y * r, (1 - jolt) * r * 1.6 + 4, 0, 7); g.stroke();
  g.restore();
}

function head(g, r, tint = '#E6D7B8') {
  const h = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  h.addColorStop(0, '#FFF8E8');
  h.addColorStop(1, tint);
  g.fillStyle = h;
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
}

const SHAPES = {
  // A conga seen from above: a tall wooden barrel with a skin head and a metal rim.
  drum(g, r, jolt, p) {
    g.fillStyle = '#7A3E1C';
    g.beginPath(); g.arc(0, 0, r * 1.12, 0, 7); g.fill();
    g.fillStyle = '#B9C0C5';
    g.beginPath(); g.arc(0, 0, r * 1.03, 0, 7); g.fill();
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2 + 0.3;
      g.fillStyle = '#E8ECEF';
      g.beginPath(); g.arc(Math.cos(t) * r * 1.075, Math.sin(t) * r * 1.075, r * 0.03, 0, 7); g.fill();
    }
    head(g, r * (0.95 + jolt * 0.01), '#D9C39A');
    ripple(g, r, jolt, p, 'rgba(120,80,40,A)');
  },
  // A bongo: smaller, with a wide metal rim.
  bongo(g, r, jolt, p) {
    g.fillStyle = '#5E3418';
    g.beginPath(); g.arc(0, 0, r * 1.15, 0, 7); g.fill();
    g.fillStyle = '#C9CED2';
    g.beginPath(); g.arc(0, 0, r * 1.06, 0, 7); g.fill();
    head(g, r * 0.96, '#E2CFA6');
    ripple(g, r, jolt, p, 'rgba(120,80,40,A)');
  },
  // A cowbell: a flat-sided iron bell, struck with a stick near its open end.
  bell(g, r, jolt) {
    g.rotate(-0.25 + Math.sin(performance.now() / 30) * jolt * 0.03);
    const m = g.createLinearGradient(-r, 0, r, 0);
    m.addColorStop(0, '#3A3A3A'); m.addColorStop(0.5, '#7A7A78'); m.addColorStop(1, '#2A2A2A');
    g.fillStyle = m;
    g.beginPath();
    g.moveTo(-r * 0.35, -r * 0.9); g.lineTo(r * 0.35, -r * 0.9);
    g.lineTo(r * 0.6, r * 0.9); g.lineTo(-r * 0.6, r * 0.9); g.closePath();
    g.fill();
    g.fillStyle = '#151515';
    g.beginPath(); g.ellipse(0, r * 0.9, r * 0.6, r * 0.12, 0, 0, 7); g.fill();
    g.fillStyle = '#9A9A96';
    g.fillRect(-r * 0.12, -r * 1.15, r * 0.24, r * 0.3);
  },
  // An agogô: two bells of different sizes joined by a bent handle, from Brazil.
  agogo(g, r, jolt, p) {
    const big = (p.rate || 1) < 1;
    const s = big ? 1 : 0.8;
    g.rotate((big ? 0.3 : -0.3) + Math.sin(performance.now() / 25) * jolt * 0.04);
    const m = g.createLinearGradient(-r, 0, r, 0);
    m.addColorStop(0, '#B8BEC3'); m.addColorStop(0.5, '#F2F5F7'); m.addColorStop(1, '#8D99A3');
    g.fillStyle = m;
    g.beginPath();
    g.moveTo(-r * 0.12 * s, -r * 0.9 * s); g.lineTo(r * 0.12 * s, -r * 0.9 * s);
    g.lineTo(r * 0.45 * s, r * 0.85 * s); g.lineTo(-r * 0.45 * s, r * 0.85 * s); g.closePath();
    g.fill();
    g.fillStyle = '#4A5258';
    g.beginPath(); g.ellipse(0, r * 0.85 * s, r * 0.45 * s, r * 0.1 * s, 0, 0, 7); g.fill();
    g.strokeStyle = '#8D99A3'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, -r * 0.9 * s); g.quadraticCurveTo(0, -r * 1.2, big ? -r * 0.8 : r * 0.8, -r * 1.1); g.stroke();
  },
  // Claves: two hardwood sticks, one resting in a cupped hand, struck by the other.
  claves(g, r, jolt) {
    const wood = (len) => {
      const w = g.createLinearGradient(0, -r * 0.12, 0, r * 0.12);
      w.addColorStop(0, '#C9874E'); w.addColorStop(0.5, '#8E4E22'); w.addColorStop(1, '#5A2E12');
      g.fillStyle = w;
      g.beginPath(); g.roundRect ? g.roundRect(-len / 2, -r * 0.12, len, r * 0.24, r * 0.12) : g.rect(-len / 2, -r * 0.12, len, r * 0.24); g.fill();
    };
    g.save(); g.translate(0, r * 0.25); g.rotate(0.15); wood(r * 1.9); g.restore();
    g.save(); g.translate(r * 0.1, -r * 0.35 + jolt * r * 0.25); g.rotate(-0.55); wood(r * 1.8); g.restore();
  },
  // A güiro: a gourd with ridges cut across it, scraped with a stick.
  guiro(g, r, jolt, p) {
    const len = r * 2.2;
    const gr = g.createLinearGradient(0, -r * 0.45, 0, r * 0.45);
    gr.addColorStop(0, '#E2B66E'); gr.addColorStop(0.5, '#B07A3A'); gr.addColorStop(1, '#6E4418');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(0, 0, len / 2, r * 0.42, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(60,35,10,.7)';
    g.lineWidth = 2;
    for (let x = -len * 0.38; x <= len * 0.38; x += r * 0.09) {
      const hgt = Math.sqrt(Math.max(0, 1 - (x / (len / 2)) ** 2)) * r * 0.38;
      g.beginPath(); g.moveTo(x, -hgt); g.lineTo(x, hgt); g.stroke();
    }
    g.fillStyle = '#3B2210';
    g.beginPath(); g.ellipse(-len * 0.2, r * 0.42, r * 0.12, r * 0.05, 0, 0, 7); g.fill();
    // the stick
    const sx = p.at ? p.x * r : len * 0.45;
    g.strokeStyle = '#D9C39A'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx, -r * 0.2 - jolt * 4); g.lineTo(sx + r * 0.6, -r * 0.95); g.stroke();
  },
  // A shaker: an egg-shaped shell full of seeds or beads.
  shaker(g, r, jolt) {
    g.translate(Math.sin(performance.now() / 18) * jolt * 6, 0);
    const sh = g.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.05, 0, 0, r * 0.8);
    sh.addColorStop(0, '#FFE08A'); sh.addColorStop(0.6, '#E0A02E'); sh.addColorStop(1, '#9A6410');
    g.fillStyle = sh;
    g.beginPath(); g.ellipse(0, 0, r * 0.55, r * 0.75, 0, 0, 7); g.fill();
  },
  // A cabasa: steel bead chains wrapped around a ridged cylinder, on a handle.
  cabasa(g, r, jolt) {
    g.rotate(Math.sin(performance.now() / 20) * jolt * 0.08);
    g.fillStyle = '#5A3A1E';
    g.fillRect(-r * 0.12, r * 0.4, r * 0.24, r * 0.75);
    g.fillStyle = '#8E5A2E';
    g.beginPath(); g.ellipse(0, 0, r * 0.65, r * 0.5, 0, 0, 7); g.fill();
    for (let row = -3; row <= 3; row++) {
      for (let k = -6; k <= 6; k++) {
        const x = k * r * 0.09;
        const y = row * r * 0.12;
        if ((x / (r * 0.65)) ** 2 + (y / (r * 0.5)) ** 2 > 0.9) continue;
        g.fillStyle = (row + k) % 2 ? '#E8ECEF' : '#B8BEC3';
        g.beginPath(); g.arc(x, y, r * 0.035, 0, 7); g.fill();
      }
    }
  },
  // A log drum (slit drum): a hollow wooden box with two tongues cut in its top.
  slit(g, r, jolt, p) {
    const hi = (p.rate || 1) > 1 || p.sound.endsWith('high');
    g.fillStyle = '#6E3A18';
    g.beginPath(); g.roundRect ? g.roundRect(-r, -r * 0.55, r * 2, r * 1.1, r * 0.15) : g.rect(-r, -r * 0.55, r * 2, r * 1.1); g.fill();
    g.fillStyle = '#A3622E';
    g.beginPath(); g.roundRect ? g.roundRect(-r * 0.85, -r * 0.42, r * 1.7, r * 0.84, r * 0.1) : g.rect(-r * 0.85, -r * 0.42, r * 1.7, r * 0.84); g.fill();
    // the tongue: a long one plays low, a short one high
    g.strokeStyle = '#2A1408';
    g.lineWidth = 3;
    const len = hi ? r * 0.9 : r * 1.4;
    g.strokeRect(-len / 2, -r * 0.18 - jolt * 2, len, r * 0.36);
  },
  // Sleigh bells: a row of small round bells on a strap.
  sleigh(g, r, jolt) {
    g.translate(Math.sin(performance.now() / 15) * jolt * 5, 0);
    g.fillStyle = '#5A2E16';
    g.beginPath(); g.roundRect ? g.roundRect(-r * 1.1, -r * 0.15, r * 2.2, r * 0.3, r * 0.1) : g.rect(-r * 1.1, -r * 0.15, r * 2.2, r * 0.3); g.fill();
    for (let k = -4; k <= 4; k++) {
      const x = k * r * 0.25;
      const b = g.createRadialGradient(x - r * 0.04, -r * 0.05, 1, x, 0, r * 0.12);
      b.addColorStop(0, '#FBEAB5'); b.addColorStop(1, '#A9781F');
      g.fillStyle = b;
      g.beginPath(); g.arc(x, 0, r * 0.11, 0, 7); g.fill();
      g.fillStyle = '#3A2408';
      g.fillRect(x - r * 0.06, r * 0.02, r * 0.12, r * 0.02);
    }
  },
};

/* The kalimba: metal tines on a wooden board, longest (lowest) in the middle, the notes of
   the scale alternating right and left as they climb, so neighbouring thumbs play steps. */
async function tines(stage, ex, kit) {
  const o = ex.opts;
  const notes = o.tines;           // the scale, low to high
  const inst = await pitched(o.sound, notes[0], notes[notes.length - 1]);
  // Arrange: the lowest in the middle, then right, left, right, left...
  const n = notes.length;
  const order = new Array(n);
  const mid = Math.floor(n / 2);
  notes.forEach((m, k) => {
    const side = k === 0 ? 0 : k % 2 ? Math.ceil(k / 2) : -Math.ceil(k / 2);
    order[mid + side] = { midi: m, rank: k, at: 0 };
  });
  const box = document.createElement('div');
  box.className = 'zone hand';
  stage.append(box);
  let G = null;
  function geom(s) {
    const w = Math.min(s.W * 0.92, 900);
    const left = (s.W - w) / 2;
    const gap = w / n;
    G = { left, gap, top: s.H * 0.08, bar: s.H * 0.62 };
    return G;
  }
  const tineAt = (u) => {
    const i = Math.floor((u - G.left) / G.gap);
    return i >= 0 && i < n ? i : null;
  };
  const len = (t) => (G.bar - G.top) * (1 - (t.rank / (n - 1)) * 0.55);

  function pluck(i) {
    const t = order[i];
    inst.play(t.midi, { vol: 0.75 });
    t.at = performance.now();
    kit.note(t.midi);
    s.animate(1500);
  }

  const s = surface(box, {
    turn: false,
    label: ex.name,
    draw,
    down(p) {
      const i = tineAt(p.u);
      if (i == null || p.v > G.bar + 30) return;
      pluck(i);
      p.data.last = i;
    },
    move(p) {
      const i = tineAt(p.u);
      if (i != null && i !== p.data.last && p.v < G.bar + 30) { pluck(i); p.data.last = i; }
    },
  });
  s.onresize = geom;
  geom(s);

  function draw(g, s) {
    geom(s);
    const now = performance.now();
    g.fillStyle = '#18231D';
    g.fillRect(0, 0, s.W, s.H);
    // the board, with its sound hole
    const board = g.createLinearGradient(0, 0, 0, s.H);
    board.addColorStop(0, '#C98E50'); board.addColorStop(1, '#8A5226');
    g.fillStyle = board;
    g.beginPath(); g.roundRect ? g.roundRect(G.left - 20, G.top - 20, G.gap * n + 40, s.H - G.top, 26) : g.rect(G.left - 20, G.top - 20, G.gap * n + 40, s.H - G.top); g.fill();
    g.fillStyle = '#2A1708';
    g.beginPath(); g.arc(s.W / 2, G.bar + (s.H - G.bar) * 0.5, Math.min(28, (s.H - G.bar) * 0.22), 0, 7); g.fill();
    // tines
    order.forEach((t, i) => {
      const x = G.left + (i + 0.5) * G.gap;
      const l = len(t);
      const age = (now - t.at) / 1000;
      const wob = t.at ? Math.exp(-age * 5) * Math.sin(age * 90) * 3 : 0;
      const m = g.createLinearGradient(x - 6, 0, x + 6, 0);
      m.addColorStop(0, '#8D99A3'); m.addColorStop(0.5, '#F4F7F9'); m.addColorStop(1, '#8D99A3');
      g.fillStyle = m;
      const w = Math.min(G.gap * 0.55, 18);
      g.beginPath(); g.roundRect ? g.roundRect(x - w / 2 + wob, G.bar - l, w, l + 18, [w / 2, w / 2, 2, 2]) : g.rect(x - w / 2, G.bar - l, w, l + 18); g.fill();
      if (t.rank % 7 === 0) { g.fillStyle = 'rgba(210,68,59,.8)'; g.beginPath(); g.arc(x + wob, G.bar - l + w, 3, 0, 7); g.fill(); }
    });
    // the bridge the tines are pressed across
    g.fillStyle = '#B8BEC3';
    g.fillRect(G.left - 10, G.bar, G.gap * n + 20, 8);
    g.fillStyle = '#5A3A1E';
    g.fillRect(G.left - 10, G.bar + 8, G.gap * n + 20, 10);
  }

  return () => s.destroy();
}
