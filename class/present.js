/* Present mode: one slide at a time, filling the screen.

   Keys: Right, Down, Space, Page Down, Enter = next (clickers send Page Down)
         Left, Up, Page Up, Backspace = previous
         Home / End = first / last   F = full screen   N = notes   Esc = leave
   Clicking a linked shape follows its link; clicking anywhere else goes on. */

import { renderSlide } from './render.js';

export function present(record, startAt, media, onClose, findGoogle) {
  let deck = record.deck;
  const root = document.createElement('div');
  root.className = 'present';
  root.tabIndex = -1;
  const frame = document.createElement('div');
  frame.className = 'frame';
  root.appendChild(frame);

  const notes = document.createElement('div');
  notes.className = 'notes';
  notes.hidden = true;
  root.appendChild(notes);

  const bar = document.createElement('div');
  bar.className = 'bar';
  const btn = (label, title, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    bar.appendChild(b);
    return b;
  };
  const backBtn = btn('↩', 'Back to where the link was', () => back());
  btn('‹', 'Previous slide', () => step(-1));
  const num = document.createElement('span');
  num.className = 'num';
  bar.appendChild(num);
  btn('›', 'Next slide', () => step(1));
  btn('☰', 'Speaker notes (N)', () => toggleNotes());
  btn('⛶', 'Full screen (F)', () => toggleFull());
  btn('✕', 'Leave (Esc)', () => close());
  root.appendChild(bar);

  let index = clamp(startAt || 0);
  const trail = [];                       // { deck, media, index } a link jumped away from
  let hideTimer = null;

  function clamp(i) { return Math.max(0, Math.min(deck.slides.length - 1, i)); }

  function show(i) {
    index = clamp(i);
    const slide = deck.slides[index];
    const stage = renderSlide(slide, deck, { media, onLink: follow });
    frame.replaceChildren(stage);
    fit();
    num.textContent = (index + 1) + ' / ' + deck.slides.length;
    notes.textContent = slide.notes || 'No notes on this slide.';
    backBtn.hidden = !trail.length;
  }

  function fit() {
    const W = window.innerWidth, H = window.innerHeight;
    const s = Math.min(W / deck.w, H / deck.h);
    frame.style.width = deck.w + 'px';
    frame.style.height = deck.h + 'px';
    frame.style.left = (W - deck.w * s) / 2 + 'px';
    frame.style.top = (H - deck.h * s) / 2 + 'px';
    frame.style.transformOrigin = '0 0';
    frame.style.transform = 'scale(' + s + ')';
  }

  // Sequential moves skip hidden slides, as in Google Slides.
  function step(dir) {
    let i = index + dir;
    while (i >= 0 && i < deck.slides.length && deck.slides[i].hidden) i += dir;
    if (i < 0 || i >= deck.slides.length) return;
    show(i);
  }

  async function follow(link) {
    if (link.slide != null) { trail.push({ deck, media, index }); show(link.slide); return; }
    if (link.gdoc && findGoogle) {
      // A link into another Google deck: open our copy of it if we have one.
      const hit = await findGoogle(link.gdoc, link.gslide);
      if (hit) {
        trail.push({ deck, media, index });
        deck = hit.deck;
        media = hit.media;
        show(hit.index);
        return;
      }
    }
    if (link.jump === 'next') step(1);
    else if (link.jump === 'previous') step(-1);
    else if (link.jump === 'first') show(0);
    else if (link.jump === 'last') show(deck.slides.length - 1);
    else if (link.url) window.open(link.url, '_blank', 'noopener');
  }

  function back() {
    if (!trail.length) return;
    const t = trail.pop();
    deck = t.deck;
    media = t.media;
    show(t.index);
  }

  function toggleNotes() { notes.hidden = !notes.hidden; }

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else root.requestFullscreen().catch(() => {});
  }

  function wake() {
    root.classList.add('show-ui');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => root.classList.remove('show-ui'), 2500);
  }

  function onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) step(1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) step(-1);
    else if (k === 'Home') show(0);
    else if (k === 'End') show(deck.slides.length - 1);
    else if (k === 'f' || k === 'F') toggleFull();
    else if (k === 'n' || k === 'N') toggleNotes();
    else if (k === 'b' || k === 'B') back();
    else if (k === 'Escape') { if (!document.fullscreenElement) close(); return; }
    else return;
    e.preventDefault();
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', fit);
    clearTimeout(hideTimer);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    root.remove();
    if (onClose) onClose(index);
  }

  // Swipe on a touch screen.
  let touchX = null;
  root.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) { step(dx < 0 ? 1 : -1); e.preventDefault(); }
  });

  root.addEventListener('click', (e) => {
    if (bar.contains(e.target) || notes.contains(e.target)) return;
    step(1);
  });
  root.addEventListener('mousemove', wake);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', fit);

  document.body.appendChild(root);
  root.requestFullscreen().catch(() => {});
  root.focus();
  show(index);
  wake();
  return { show, close };
}
