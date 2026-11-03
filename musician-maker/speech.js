/* The call in syllables, built up in one speech bubble: the first note opens it, each note
   after adds its syllable (a de joins its du: du-de), and the whole pattern stays up a moment
   after the last one, so the learner sees all of it. Every game's singer uses this for a call
   in syllables; other words (squeak!, nyah!) still pop one at a time in the game's own bubble.
   fx: the scene's effects layer; (x, y): where the bubble's tail points, in fx pixels. */

const HOLD = 1600; // ms the full pattern stays up after its last syllable

export function callBubble(fx, i, syl, x, y) {
  let b = fx.querySelector('.call-bubble');
  if (i === 0 || !b) {
    b?.remove();
    b = document.createElement('div');
    b.className = 'ms-bubble call-bubble';
    b.dataset.x = x;
    b.style.top = `${y}px`;
    fx.append(b);
  }
  const w = document.createElement('span');
  w.className = 'cb-syl';
  w.textContent = b.childElementCount ? `${syl === 'de' ? '-' : ' '}${syl}` : syl;
  b.append(w);
  // Keep the growing bubble inside the stage.
  const half = b.offsetWidth / 2 + 6;
  const W = fx.clientWidth || 0;
  b.style.left = `${W ? Math.max(half, Math.min(W - half, Number(b.dataset.x))) : Number(b.dataset.x)}px`;
  clearTimeout(b.hold);
  b.hold = setTimeout(() => {
    b.classList.add('out');
    setTimeout(() => b.remove(), 300);
  }, HOLD);
  return b;
}
