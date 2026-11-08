/* A playing surface: a canvas filling its box, with every finger (or the mouse) tracked.
   Instruments draw and think in their own space: u runs along the instrument (left to right
   when the screen is wide), v across it. On a tall screen the instrument stands up: u runs
   down the screen and v across, like a chord chart. */

export function surface(box, { turn = true, draw, down, move, up, label = '' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'surface';
  canvas.setAttribute('role', 'application');
  if (label) canvas.setAttribute('aria-label', label);
  box.append(canvas);
  const g = canvas.getContext('2d');
  const s = {
    canvas, g, W: 0, H: 0, tall: false, dpr: 1,
    pointers: new Map(),
    dirty: true,
    animating: 0,
    redraw() { s.dirty = true; kick(); },
    // Keep drawing every frame for ms milliseconds (vibrating strings, ringing drums).
    animate(ms = 600) { s.animating = Math.max(s.animating, performance.now() + ms); kick(); },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); canvas.remove(); },
    // Screen point (relative to canvas) to instrument space.
    toUV(x, y) { return s.tall ? { u: y, v: x } : { u: x, v: y }; },
  };

  let raf = 0;
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(t) {
    raf = 0;
    if (s.dirty || t < s.animating) {
      s.dirty = false;
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (s.tall) g.transform(0, 1, 1, 0, 0, 0);
      draw?.(g, s, t);
    }
    if (t < s.animating) kick();
  }

  function resize() {
    const r = box.getBoundingClientRect();
    s.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.max(1, Math.round(r.width * s.dpr));
    canvas.height = Math.max(1, Math.round(r.height * s.dpr));
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
    s.tall = turn && r.height > r.width * 1.05;
    s.W = s.tall ? r.height : r.width;
    s.H = s.tall ? r.width : r.height;
    s.onresize?.(s);
    s.redraw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(box);

  function point(e) {
    const r = canvas.getBoundingClientRect();
    const { u, v } = s.toUV(e.clientX - r.left, e.clientY - r.top);
    return { u, v, t: e.timeStamp || performance.now(), type: e.pointerType, pressure: e.pressure };
  }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
    const p = { id: e.pointerId, ...point(e), start: null, data: {} };
    p.start = { u: p.u, v: p.v, t: p.t };
    p.pu = p.u; p.pv = p.v; p.pt = p.t;
    s.pointers.set(e.pointerId, p);
    down?.(p, s, e);
    s.redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = s.pointers.get(e.pointerId);
    if (!p) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ce of events.length ? events : [e]) {
      const q = point(ce);
      p.pu = p.u; p.pv = p.v; p.pt = p.t;
      Object.assign(p, q);
      move?.(p, s, ce);
    }
    s.redraw();
  });
  const end = (e) => {
    const p = s.pointers.get(e.pointerId);
    if (!p) return;
    s.pointers.delete(e.pointerId);
    up?.(p, s, e);
    s.redraw();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  resize();
  return s;
}

/* Rounded rectangle path. */
export function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* Text that stays upright when the instrument is turned. */
export function label(g, s, text, u, v, { size = 14, color = '#fff', weight = 600, align = 'center' } = {}) {
  g.save();
  if (s.tall) {
    g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    [u, v] = [v, u];
  }
  g.font = `${weight} ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(text, u, v);
  g.restore();
}

export const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
