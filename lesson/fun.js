/* Celebrations: confetti. */

const COLORS = ['#E5243B', '#F47B20', '#F5C400', '#7DC242', '#11A38B', '#7F4FA3', '#E0569B'];

export function confetti(amount = 120) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.append(c);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const bits = Array.from({ length: amount }, () => ({
    x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14, vy: -6 - Math.random() * 10,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const start = performance.now();
  (function frame(now) {
    const t = now - start;
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += 0.35;
      b.vx *= 0.99;
      b.x += b.vx;
      b.y += b.vy;
      b.r += b.vr;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.r);
      g.globalAlpha = Math.max(0, 1 - t / 2600);
      g.fillStyle = b.color;
      g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.restore();
    }
    if (t < 2600) requestAnimationFrame(frame); else c.remove();
  })(start);
}
