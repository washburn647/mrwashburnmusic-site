/* The homepage: a kid or grown-up question, then that side's menu, drawn as notes on a staff.
   Nothing here is sent anywhere. The answer and the sound switch stay in this browser. */

/* What the page says and links to is in home.json, or what Kyle published from the studio
   (/studio/home/, /api/live/home.json), which comes first. ?preview shows the studio's unpublished
   draft, kept in this browser. Each note's n is its place on the staff: 0 is the bottom line,
   1 the space above it, and so on; beats is how long it lasts when the tune plays. */
let C = null;
let PLACES = {};
const SIDES = { kids: null, grownups: null };

async function content() {
  if (new URLSearchParams(location.search).has('preview')) {
    try { const d = JSON.parse(localStorage.getItem('studio-home-draft') || 'null'); if (d && d.places) return d; } catch { /* none */ }
  }
  for (const u of ['/api/live/home.json', 'home.json']) {
    try {
      const r = await fetch(u, { cache: 'no-cache' });
      if (r.ok) return await r.json();
    } catch { /* next */ }
  }
  return null;
}

/* A colour for each note name, from the bottom line (E) up. */
const COLORS = ['#E0A800', '#5E9E2E', '#0E9384', '#6B4FA8', '#D2468C', '#DC3B30', '#EC7F1A'];
const SEMITONES = [0, 1, 3, 5, 7, 8, 10];

const $ = (id) => document.getElementById(id);
const gate = $('gate');
const site = $('site');
const staff = $('staff');
const card = $('card');

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k in node && k !== 'href') node[k] = v;
    else node.setAttribute(k, v);
  }
  node.append(...kids);
  return node;
}

function recall(key) { try { return localStorage.getItem(key); } catch { return null; } }
function remember(key, value) { try { localStorage.setItem(key, value); } catch { /* private window */ } }

/* ---------- Sound ---------- */

let audio = null;
let soundOn = recall('mwm-home-sound') !== 'off';

function wake() {
  if (!soundOn) return null;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
  return audio;
}

const hz = (n) => 329.63 * 2 ** ((SEMITONES[((n % 7) + 7) % 7] + 12 * Math.floor(n / 7)) / 12);

/* One soft mallet note. */
function ring(n, delay = 0, length = 0.9) {
  const ctx = wake();
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, t + length);
  out.connect(ctx.destination);
  for (const [mult, level, type] of [[1, 1, 'triangle'], [2, 0.3, 'sine'], [4, 0.08, 'sine']]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = hz(n) * mult;
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }
}

const soundBtn = $('sound');
function showSound() {
  soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off';
  soundBtn.setAttribute('aria-pressed', String(soundOn));
}
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  remember('mwm-home-sound', soundOn ? 'on' : 'off');
  showSound();
  if (soundOn) { wake(); ring(4, 0.05); }
});
showSound();
// A browser only lets sound start after a tap or a key.
addEventListener('pointerdown', wake, { passive: true });
addEventListener('keydown', wake);

/* ---------- Which side ---------- */

let who = '';

function show(side, { fresh = false } = {}) {
  who = (side === 'kids' || side === 'grownups') && SIDES[side] ? side : '';
  hideCard();
  stopTune();
  document.body.dataset.who = who;
  gate.hidden = !!who;
  site.hidden = !who;
  if (!who) return;
  remember('mwm-home-who', who);
  if (location.hash !== `#${who}`) history.replaceState(null, '', `#${who}`);
  const s = SIDES[who];
  $('headline').textContent = s.headline || '';
  $('lede').textContent = s.lede || '';
  $('lede').hidden = !s.lede;
  $('switch').textContent = s.switch || (who === 'kids' ? 'Grown-ups' : 'Kids');
  draw(s.notes.filter((x) => PLACES[x.place]));
  if (fresh) { site.classList.remove('arrive'); void site.offsetWidth; site.classList.add('arrive'); scrollTo(0, 0); }
}

for (const door of gate.querySelectorAll('.door')) {
  door.addEventListener('click', () => {
    wake();
    [0, 2, 4, 7].forEach((n, i) => ring(n + (door.dataset.who === 'kids' ? 2 : 0), 0.05 + i * 0.09, 0.7));
    show(door.dataset.who, { fresh: true });
  });
}
$('switch').addEventListener('click', () => show(who === 'kids' ? 'grownups' : 'kids', { fresh: true }));
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h !== who) show(h); });

/* ---------- The staff ---------- */

let cells = [];

function draw(notes) {
  cells = notes.map(({ place: id, n, beats }, i) => {
    const place = PLACES[id];
    const open = !!place.href;
    const cell = el(open ? 'a' : 'button', { class: `cell notecell ${open ? 'open' : 'soon'} ${n >= 4 ? 'down' : 'up'}` });
    if (open) cell.setAttribute('href', place.href); else cell.type = 'button';
    cell.style.setProperty('--n', n);
    cell.style.setProperty('--c', COLORS[((n % 7) + 7) % 7]);
    cell.style.setProperty('--i', i);
    cell.append(
      el('span', { class: 'note', 'aria-hidden': 'true' },
        el('i', { class: 'stem' }),
        el('i', { class: 'head' }, el('i', { class: 'face' }))),
      el('span', { class: 'name' }, place.name),
      el('span', { class: 'tag' }, open ? 'Open' : 'Coming soon'));
    cell.place = place;
    cell.n = n;
    cell.beats = beats;
    return cell;
  });
  layout();
}

/* Lines of music: as many notes on each line as fit, shared out evenly, a clef on every line. */
let perLine = 0;
function layout(force = true) {
  if (!cells.length) return;
  const sp = parseFloat(getComputedStyle(document.body).getPropertyValue('--sp')) || 16;
  const room = staff.clientWidth - sp * 4.4;
  const fit = Math.max(2, Math.floor(room / Math.max(sp * 5, 88)));
  const lines = Math.ceil(cells.length / fit);
  const each = Math.ceil(cells.length / lines);
  if (!force && each === perLine) return;
  perLine = each;
  const systems = [];
  for (let i = 0; i < cells.length; i += each) {
    const clef = el('div', { class: 'cell clefcell', 'aria-hidden': 'true' });
    clef.innerHTML = '<svg class="clef"><use href="#clef"/></svg>';
    systems.push(el('div', { class: 'system' }, clef, ...cells.slice(i, i + each)));
  }
  systems.at(-1).classList.add('last');
  staff.replaceChildren(...systems);
}

let pageWidth = innerWidth;
addEventListener('resize', () => {
  if (innerWidth === pageWidth) return;
  pageWidth = innerWidth;
  hideCard();
  layout(false);
});

/* How the last press came in: a mouse opens a place straight away, a finger sees the card first. */
let pointer = 'mouse';
addEventListener('pointerdown', (e) => { pointer = e.pointerType || 'mouse'; }, true);
addEventListener('keydown', () => { pointer = 'key'; }, true);

staff.addEventListener('pointerover', (e) => {
  const cell = e.target.closest('.notecell');
  if (!cell || e.pointerType !== 'mouse' || cell.contains(e.relatedTarget)) return;
  ring(cell.n);
  showCard(cell);
});
staff.addEventListener('pointerout', (e) => {
  const cell = e.target.closest('.notecell');
  if (cell && e.pointerType === 'mouse' && !cell.contains(e.relatedTarget)) hideCardSoon();
});
staff.addEventListener('focusin', (e) => {
  const cell = e.target.closest('.notecell');
  if (cell && pointer === 'key') { ring(cell.n); showCard(cell); }
});
staff.addEventListener('click', (e) => {
  const cell = e.target.closest('.notecell');
  if (!cell) return;
  const showing = shown === cell;
  if (cell.place.href && (pointer === 'mouse' || pointer === 'key' || showing)) return; // follow the link
  e.preventDefault();
  ring(cell.n);
  bounce(cell);
  showCard(cell);
});

function bounce(cell) {
  cell.classList.remove('ping');
  void cell.offsetWidth;
  cell.classList.add('ping');
}

/* ---------- The card under a note ---------- */

let shown = null;
let hideTimer = 0;

function showCard(cell) {
  clearTimeout(hideTimer);
  if (shown === cell) return;
  shown?.classList.remove('on');
  shown = cell;
  cell.classList.add('on');
  const p = cell.place;
  card.replaceChildren(
    el('strong', {}, p.name),
    ...(p.about ? [el('p', {}, p.about)] : []),
    el('div', { class: 'card-row' },
      p.href ? el('a', { class: 'go', href: p.href }, 'Open') : el('span', { class: 'soon-chip' }, 'Coming soon'),
      ...(p.extraHref && p.extraLabel ? [el('a', { class: 'go', href: p.extraHref }, p.extraLabel)] : [])));
  card.style.setProperty('--c', cell.style.getPropertyValue('--c'));
  card.hidden = false;
  const box = cell.getBoundingClientRect();
  const width = card.offsetWidth;
  const page = document.documentElement.clientWidth;
  const middle = box.left + box.width / 2;
  const left = Math.max(8, Math.min(page - width - 8, middle - width / 2));
  card.style.left = `${left + scrollX}px`;
  card.style.top = `${box.bottom + scrollY + 6}px`;
  card.style.setProperty('--arrow', `${Math.max(18, Math.min(width - 18, middle - left))}px`);
}

function hideCard() {
  clearTimeout(hideTimer);
  shown?.classList.remove('on');
  shown = null;
  card.hidden = true;
}
function hideCardSoon() { clearTimeout(hideTimer); hideTimer = setTimeout(hideCard, 180); }

card.addEventListener('pointerenter', () => clearTimeout(hideTimer));
card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hideCardSoon(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') hideCard(); });
addEventListener('pointerdown', (e) => { if (shown && !e.target.closest('.notecell, .card')) hideCard(); });
staff.addEventListener('focusout', (e) => { if (!e.relatedTarget?.closest?.('.notecell, .card')) hideCardSoon(); });

/* ---------- Play the menu as a tune ---------- */

const playBtn = $('play');
let tuneTimers = [];

function stopTune() {
  tuneTimers.forEach(clearTimeout);
  tuneTimers = [];
  playBtn.classList.remove('playing');
}

playBtn.addEventListener('click', () => {
  if (tuneTimers.length) { stopTune(); return; }
  hideCard();
  wake();
  playBtn.classList.add('playing');
  const beat = 0.48;
  let at = 0.05;
  for (const cell of cells) {
    const when = at;
    tuneTimers.push(setTimeout(() => { ring(cell.n, 0, Math.max(0.5, cell.beats * beat * 1.8)); bounce(cell); }, when * 1000));
    at += cell.beats * beat;
  }
  tuneTimers.push(setTimeout(stopTune, at * 1000 + 300));
});

/* ---------- Photos, behind the top of the page ---------- */

let slides = [];
let dots = [];
let slide = 0;
let slideTimer = 0;
const still = matchMedia('(prefers-reduced-motion: reduce)');

function showSlide(i) {
  if (!slides.length) return;
  slide = (i + slides.length) % slides.length;
  slides.forEach((s, k) => s.classList.toggle('on', k === slide));
  dots.forEach((d, k) => d.classList.toggle('on', k === slide));
}
function runSlides() {
  clearInterval(slideTimer);
  if (!still.matches) slideTimer = setInterval(() => { if (!document.hidden && !site.hidden) showSlide(slide + 1); }, 5000);
}
function photos(list) {
  slides = list.map((p) => {
    const img = el('img', { src: `photos/${p.file}`, alt: '' });
    img.style.objectPosition = `50% ${Number(p.y) || 0}%`;
    return el('div', { class: 'slide' }, img);
  });
  $('slides').replaceChildren(...slides);
  dots = slides.length > 1 ? slides.map((_, i) => el('button', { type: 'button', 'aria-label': `Photo ${i + 1}`, onclick: () => { showSlide(i); runSlides(); } })) : [];
  $('dots').replaceChildren(...dots);
  showSlide(0);
  runSlides();
}

/* The big note plays too. */
const bigNote = $('bignote');
let bigTurn = 0;
bigNote.addEventListener('click', () => {
  ring([-3, -1, 1, 4, 1, -1][bigTurn++ % 6], 0, 1.4);
  bigNote.classList.remove('boing');
  void bigNote.offsetWidth;
  bigNote.classList.add('boing');
});

/* ---------- Start ---------- */

C = await content();
if (C) {
  PLACES = Object.fromEntries((C.places || []).map((p) => [p.id, p]));
  SIDES.kids = C.kids;
  SIDES.grownups = C.grownups;
  if (C.question) $('gate-q').textContent = C.question;
  if (C.kidButton) gate.querySelector('.door-kid .door-name').textContent = C.kidButton;
  if (C.grownButton) gate.querySelector('.door-grown .door-name').textContent = C.grownButton;
  $('sign').textContent = C.sign || '';
  $('sign').hidden = !C.sign;
  photos(C.photos || []);
}
const asked = location.hash.slice(1);
show(asked === 'kids' || asked === 'grownups' ? asked : asked === 'choose' ? '' : recall('mwm-home-who') || '');
