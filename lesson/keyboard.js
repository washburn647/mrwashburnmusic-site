/* An on-screen piano keyboard. Keys from lo to hi (midi), starting and ending on
   white keys. Tapping a key calls onKey(midi). mark(midi, cls) colours a key. */

const BLACK = new Set([1, 3, 6, 8, 10]);

export function keyboard({ lo, hi, onKey, dot = null }) {
  while (BLACK.has(((lo % 12) + 12) % 12)) lo--;
  while (BLACK.has(((hi % 12) + 12) % 12)) hi++;
  const wrap = document.createElement('div');
  wrap.className = 'kbd';
  const whites = [];
  for (let m = lo; m <= hi; m++) if (!BLACK.has(m % 12)) whites.push(m);
  const keys = new Map();
  const w = 100 / whites.length;
  for (let m = lo; m <= hi; m++) {
    const black = BLACK.has(m % 12);
    const k = document.createElement('button');
    k.type = 'button';
    k.className = black ? 'kb black' : 'kb white';
    k.setAttribute('aria-label', String(m));
    if (black) {
      const left = whites.indexOf(m - 1);
      k.style.left = `${(left + 1) * w - w * 0.3}%`;
      k.style.width = `${w * 0.6}%`;
    } else {
      k.style.left = `${whites.indexOf(m) * w}%`;
      k.style.width = `${w}%`;
    }
    // Every C is labelled, so the keyboard can be found without naming the answer.
    if (m % 12 === 0) k.append(Object.assign(document.createElement('small'), { textContent: 'C' }));
    if (dot != null && (m - dot) % 12 === 0) k.classList.add('do');
    k.addEventListener('pointerdown', (e) => { e.preventDefault(); onKey(m); flash(m, 'down'); });
    keys.set(m, k);
    wrap.append(k);
  }
  function flash(m, cls, ms = 180) {
    const k = keys.get(m);
    if (!k) return;
    k.classList.add(cls);
    setTimeout(() => k.classList.remove(cls), ms);
  }
  return { el: wrap, flash, lo, hi };
}
