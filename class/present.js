/* Present mode: one slide at a time, filling the screen.

   Keys: Right, Down, Space, Page Down, Enter = next (clickers send Page Down)
         Left, Up, Page Up, Backspace = previous
         Home / End = first / last   F = full screen   N = notes   D = draw
         M = menu   Esc = leave
   Swipe left or right on a touch screen. Clicking a linked shape follows its
   link; clicking anywhere else only shows the controls, because slides hold
   things to play with. Widgets (widgets.js) work here, and only here.

   Each slide's timer box counts up only while that slide is on screen, and
   every stretch on screen is saved, so songs can be timed on average later. */

import { renderSlide } from './render.js';
import { logTiming } from './store.js';
import { forGrade } from './marks.js';
import { spinnerOverlay } from './widgets.js';

const SPINNER_URL = /spinthewheel\.app|wheelofnames\.com|pickerwheel\.com|classtools\.net\/random-name/i;
const INK = ['#000000', '#D04B4B', '#3B83C0', '#4A9C5C', '#FFFFFF'];

export const MENU = -1;                    // the index Present gives a grade's built menu

/** opts.grade: show only that grade's slides. opts.menu: a built menu slide (see menus.js).
    opts.openDeck(link): another library deck for a { deck } link, as { deck, media, deckId,
    deckName, index } or with menu (a built menu) to open on. */
export function present(record, startAt, media, onClose, findGoogle, opts = {}) {
  const { grade, menu, openDeck } = opts;
  let deck = record.deck;
  let deckId = record.id;
  let deckName = record.name;
  const menus = new Map(menu ? [[record.id, menu]] : []);   // deck id -> its built menu
  const curMenu = () => menus.get(deckId);
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
  const menuBtn = btn('▦', 'Menu (M)', () => show(MENU));
  const penBtn = btn('✏', 'Draw (D)', () => togglePen());
  const inks = document.createElement('span');
  inks.className = 'inks';
  inks.hidden = true;
  INK.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'ink' + (i === 0 ? ' on' : '');
    b.style.background = c;
    b.title = 'Pen color';
    b.addEventListener('click', (e) => { e.stopPropagation(); pen = c; inks.querySelectorAll('.ink').forEach((x) => x.classList.toggle('on', x === b)); });
    inks.appendChild(b);
  });
  const wipe = document.createElement('button');
  wipe.textContent = '⌫';
  wipe.title = 'Clear drawing';
  wipe.addEventListener('click', (e) => { e.stopPropagation(); clearInk(); });
  inks.appendChild(wipe);
  bar.appendChild(inks);
  btn('☰', 'Speaker notes (N)', () => toggleNotes());
  btn('⛶', 'Full screen (F)', () => toggleFull());
  btn('✕', 'Leave (Esc)', () => close());
  root.appendChild(bar);

  // Drawing over the slide: kept per slide for this sitting, never saved.
  const ink = document.createElement('canvas');
  ink.className = 'ink-layer';
  ink.hidden = true;
  const drawings = new Map();               // deckId:index -> data URL
  let pen = INK[0];
  let drawing = false;

  function togglePen() {
    drawing = !drawing;
    ink.hidden = !drawing && !drawings.has(slideKey());
    ink.classList.toggle('on', drawing);
    penBtn.classList.toggle('on', drawing);
    inks.hidden = !drawing;
  }
  function loadInk() {
    ink.width = deck.w;
    ink.height = deck.h;
    const url = drawings.get(slideKey());
    ink.hidden = !drawing && !url;
    if (!url) return;
    const img = new Image();
    img.onload = () => ink.getContext('2d').drawImage(img, 0, 0);
    img.src = url;
  }
  function clearInk() {
    ink.getContext('2d').clearRect(0, 0, ink.width, ink.height);
    drawings.delete(slideKey());
  }
  ink.addEventListener('pointerdown', (e) => {
    if (!drawing) return;
    e.stopPropagation();
    const r = ink.getBoundingClientRect();
    const at = (ev) => [(ev.clientX - r.left) * ink.width / r.width, (ev.clientY - r.top) * ink.height / r.height];
    const g = ink.getContext('2d');
    g.strokeStyle = pen;
    g.lineWidth = pen === '#FFFFFF' ? 28 : 6;
    g.lineCap = g.lineJoin = 'round';
    g.globalCompositeOperation = pen === '#FFFFFF' ? 'destination-out' : 'source-over';
    let [x, y] = at(e);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 0.1, y);
    g.stroke();
    ink.setPointerCapture(e.pointerId);
    const move = (ev) => { [x, y] = at(ev); g.lineTo(x, y); g.stroke(); };
    const up = () => {
      ink.removeEventListener('pointermove', move);
      ink.removeEventListener('pointerup', up);
      drawings.set(slideKey(), ink.toDataURL());
    };
    ink.addEventListener('pointermove', move);
    ink.addEventListener('pointerup', up);
  });
  ink.addEventListener('click', (e) => { if (drawing) e.stopPropagation(); });

  let index = startAt === MENU && menu ? MENU : clamp(startAt || 0);
  const trail = [];                       // { deck, media, index } a link jumped away from
  let hideTimer = null;

  // Time on screen, per deck and slide, for this sitting.
  const onScreen = new Map();               // deckId:index -> ms before the current stretch
  let since = null;                         // when the current stretch began
  const slideKey = () => deckId + ':' + index;
  const elapsed = () => (onScreen.get(slideKey()) || 0) + (since == null ? 0 : performance.now() - since);

  function pause() {
    if (since == null) return;
    const ms = performance.now() - since;
    since = null;
    if (index === MENU) return;
    onScreen.set(slideKey(), (onScreen.get(slideKey()) || 0) + ms);
    if (ms < 2000) return;                  // flicking past a slide isn't teaching it
    const slide = deck.slides[index];
    const song = slide.plan ? slide.plan.song : slide.song ? slide.song.name : null;
    logTiming({ deck: deckId, deckName, slide: index, gid: slide.gid || null,
                song, category: slide.plan ? slide.plan.category : null, title: slide.title || '',
                ms: Math.round(ms), at: Date.now() }).catch(() => {});
  }

  function resume() {
    if (since == null && !document.hidden) since = performance.now();
  }

  function paintTimers() {
    const t = clock(elapsed());
    for (const v of frame.querySelectorAll('.timer-val')) if (v.textContent !== t) v.textContent = t;
  }
  const ticker = setInterval(paintTimers, 250);

  function onVisibility() {
    if (document.hidden) pause(); else resume();
  }

  function clamp(i) { return Math.max(0, Math.min(deck.slides.length - 1, i)); }

  function show(i) {
    pause();
    index = i === MENU && curMenu() ? MENU : clamp(i);
    resume();
    const slide = index === MENU ? curMenu() : deck.slides[index];
    const stage = renderSlide(slide, deck, { media, onLink: follow, timer: () => clock(elapsed()), live: true });
    frame.replaceChildren(stage, ink);
    loadInk();
    fit();
    num.textContent = index === MENU ? '▦' : (index + 1) + ' / ' + deck.slides.length;
    notes.textContent = slide.notes || 'No notes on this slide.';
    backBtn.hidden = !trail.length;
    menuBtn.hidden = !curMenu();
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

  // Sequential moves skip hidden slides, as in Google Slides, and slides for
  // other grades (and the old menu slides) when showing one grade.
  const skip = (s) => s.hidden || !forGrade(s, grade) || (grade && s.menu);
  function step(dir) {
    if (index === MENU && dir < 0) return;
    let i = index + dir;
    while (i >= 0 && i < deck.slides.length && skip(deck.slides[i])) i += dir;
    if (i < 0 || i >= deck.slides.length) return;
    show(i);
  }

  async function follow(link) {
    if (link.deck && openDeck) {
      const hit = await openDeck(link);
      if (hit) {
        trail.push({ deck, media, index, deckId, deckName });
        pause();
        ({ deck, media, deckId, deckName } = hit);
        if (hit.menu) menus.set(deckId, hit.menu);
        show(hit.menu ? MENU : hit.index);
        return;
      }
    }
    if (link.slide != null) { trail.push({ deck, media, index, deckId, deckName }); show(link.slide); return; }
    if (link.gdoc && findGoogle) {
      // A link into another Google deck: open our copy of it if we have one.
      const hit = await findGoogle(link.gdoc, link.gslide);
      if (hit) {
        trail.push({ deck, media, index, deckId, deckName });
        pause();
        ({ deck, media, deckId, deckName } = hit);
        show(hit.index);
        return;
      }
    }
    if (link.jump === 'next') step(1);
    else if (link.jump === 'previous') step(-1);
    else if (link.jump === 'first') show(0);
    else if (link.jump === 'last') show(deck.slides.length - 1);
    else if (link.url && SPINNER_URL.test(link.url)) spinnerOverlay(root);
    else if (link.url) window.open(link.url, '_blank', 'noopener');
  }

  function back() {
    if (!trail.length) return;
    const t = trail.pop();
    pause();
    ({ deck, media, deckId, deckName } = t);
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
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) step(1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) step(-1);
    else if (k === 'Home') show(0);
    else if (k === 'End') show(deck.slides.length - 1);
    else if (k === 'f' || k === 'F') toggleFull();
    else if (k === 'n' || k === 'N') toggleNotes();
    else if (k === 'b' || k === 'B') back();
    else if ((k === 'm' || k === 'M') && curMenu()) show(MENU);
    else if (k === 'd' || k === 'D') togglePen();
    else if (k === 'Escape') { if (!document.fullscreenElement) close(); return; }
    else return;
    e.preventDefault();
  }

  function close() {
    pause();
    clearInterval(ticker);
    document.removeEventListener('visibilitychange', onVisibility);
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
    if (touchX == null || drawing) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) { step(dx < 0 ? 1 : -1); e.preventDefault(); }
  });

  root.addEventListener('click', wake);
  root.addEventListener('mousemove', wake);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', fit);

  document.body.appendChild(root);
  root.requestFullscreen().catch(() => {});
  root.focus();
  show(index);
  wake();
  return { show, close };
}

/** 75 seconds -> "1:15"; an hour or more -> "1:02:03". */
function clock(ms) {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = t % 60;
  const ss = String(sec).padStart(2, '0');
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss;
}
