/* Feedback effects: particles, ripples, flying XP, shakes. Purely visual; each piece removes
   itself. Fixed markup only: nothing a learner types goes in here. */

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

const rnd = (a, b) => a + Math.random() * (b - a);

/* Restart a CSS animation class. */
export function bump(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

const KINDS = {
  confetti: { glyphs: [''], colors: ['#5E7D4F', '#D9B26F', '#C46A5A', '#4F6F8F', '#9DB58C', '#d08a2e'] },
  stars: { glyphs: ['★', '✦', '★'], colors: ['#f2c94c', '#D9B26F', '#fff3c4'] },
  notes: { glyphs: ['♩', '♫', '♪'], colors: ['#2F4A3A', '#5E7D4F', '#A8743A'] },
  hearts: { glyphs: ['❤'], colors: ['#C46A5A', '#e08a7a'] },
};

/* Particles bursting out from (x, y) in el's box (fractions 0-1). */
export function burst(el, { x = 0.5, y = 0.5, kind = 'confetti', count = 18, spread = 1, colors } = {}) {
  if (!el) return;
  const k = KINDS[kind];
  const box = h('div', 'fx-burst');
  box.style.left = `${x * 100}%`;
  box.style.top = `${y * 100}%`;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd(-0.3, 0.3);
    const r = rnd(50, 130) * spread;
    const p = h('i', `fx-p ${kind}`, k.glyphs[i % k.glyphs.length]);
    const c = (colors || k.colors)[i % (colors || k.colors).length];
    p.style.setProperty('--c', c);
    p.style.setProperty('--dx', `${Math.cos(a) * r}px`);
    p.style.setProperty('--dy', `${Math.sin(a) * r - 30}px`);
    p.style.setProperty('--rot', `${rnd(-360, 360)}deg`);
    p.style.setProperty('--d', `${rnd(0.6, 1)}s`);
    box.append(p);
  }
  el.append(box);
  setTimeout(() => box.remove(), 1100);
}

/* A ring spreading out from a point in el (px from el's top-left). */
export function ripple(el, x, y, cls = '') {
  if (!el) return;
  const r = h('i', `fx-ripple ${cls}`);
  r.style.left = `${x}px`;
  r.style.top = `${y}px`;
  el.append(r);
  setTimeout(() => r.remove(), 600);
}

/* A word that pops up at a point in el and floats away. */
export function pop(el, x, y, text, cls = '') {
  if (!el) return;
  const w = h('b', `fx-pop ${cls}`, text);
  w.style.left = `${x}px`;
  w.style.top = `${y}px`;
  el.append(w);
  setTimeout(() => w.remove(), 800);
}

/* "+15" flies from one element to another (the XP counter), then the target bumps. */
export function fly(from, to, text, cls = '') {
  if (!from || !to) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const f = h('b', `fx-fly ${cls}`, text);
  f.style.left = `${a.left + a.width / 2}px`;
  f.style.top = `${a.top + a.height / 2}px`;
  document.body.append(f);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  f.animate([
    { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
    { transform: 'translate(-50%, -90%) scale(1.4)', opacity: 1, offset: 0.25 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 0.9 },
  ], { duration: 750, easing: 'cubic-bezier(.4,0,.6,1)' }).onfinish = () => {
    f.remove();
    bump(to, 'fx-got');
  };
}

/* A ring that sweeps out over the whole of el (combo tier up). */
export function shockwave(el, color) {
  if (!el) return;
  const s = h('i', 'fx-shock');
  s.style.setProperty('--c', color);
  el.append(s);
  setTimeout(() => s.remove(), 800);
}

/* Emoji that tumble in from the sides and bounce (the band joining). */
export function parade(el, glyphs) {
  if (!el) return;
  const box = h('div', 'fx-parade');
  glyphs.forEach((g, i) => {
    const p = h('i', '', g);
    p.style.setProperty('--i', i);
    p.style.setProperty('--from', i % 2 ? '120%' : '-120%');
    box.append(p);
  });
  el.append(box);
  setTimeout(() => box.remove(), 1600);
}

/* A number that drops and fades (a combo that was lost). */
export function drop(el, text) {
  if (!el) return;
  const d = h('b', 'fx-drop', text);
  el.append(d);
  setTimeout(() => d.remove(), 900);
}
