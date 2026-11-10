/* Widgets: slide elements that do something in Present.
   { t: 'wg', kind, x, y, w, h, ... }
   - timer:   secs (counts down from it; 0 counts up). Tap to start or pause.
   - spinner: picks a student. Names stay on this device (see names below),
              never in a deck, so they never leave it.
   - video:   url (YouTube) or media (a video file kept on the device), name
   - sound:   media (a sound file kept on the device), name
   - spotify: url (an open.spotify.com track, album or playlist), name
   - draw:    a box to draw on, bg (its color)
   - thinkspeak: pics [{ media }], a row to say and a row to think: a tap
              moves a picture to the other row, in its own column
   - streetview: places [{ name, src }], Google Maps embeds (Share > Embed a
              map), the first where it starts, the rest in a list under it
   The spinner, video, Spotify, the drawing box, think/speak and Street View
   sit on the slide as a small box (ICON_ONLY: just their icon); tapped, they
   open big over the slide (OPENS), clear of the slide's scaling. Elsewhere
   (thumbnails, the editor) a widget draws as a quiet label or its icon.
   Everything set up in the editor lives on the element, so it saves with the
   slide and goes wherever the slide or element is copied. */

export const KINDS = { timer: 'Timer', spinner: 'Spinner', video: 'Video', sound: 'Sound', spotify: 'Spotify', draw: 'Drawing box',
  thinkspeak: 'Think/speak', streetview: 'Street View' };
const ICONS = { timer: '⏱', spinner: '🎡', video: '▶', sound: '🔊', spotify: '🎵', draw: '✏', thinkspeak: '💬', streetview: '🌍' };
const OPENS = ['spinner', 'video', 'spotify', 'draw', 'thinkspeak', 'streetview'];
const ICON_ONLY = ['spinner', 'draw', 'thinkspeak', 'streetview'];   // on the slide, just their icon
const INK = ['#000000', '#D04B4B', '#3B83C0', '#4A9C5C', '#E8A33D', '#9257BD'];
const COLORS = ['#E8A33D', '#5E7D4F', '#3B83C0', '#D04B4B', '#9257BD', '#C9A41F', '#4A9C5C', '#DD8033'];
const SVG = 'http://www.w3.org/2000/svg';

const h = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** The node for a widget. opts.live: working (Present); opts.media(hash) -> URL. */
export function drawWidget(el, opts = {}) {
  const d = h('div', 'el wg wg-' + el.kind);
  Object.assign(d.style, { left: el.x + 'px', top: el.y + 'px', width: el.w + 'px', height: el.h + 'px' });
  if (ICON_ONLY.includes(el.kind)) d.classList.add('wg-iconly');
  d.style.fontSize = (ICON_ONLY.includes(el.kind) ? Math.max(12, Math.min(el.w, el.h) * 0.6)
    : OPENS.includes(el.kind) ? Math.max(12, Math.min(el.h / 2.6, el.w / 8))
    : Math.max(12, Math.min(el.w, el.h) / 6)) + 'px';
  if (!opts.live) {
    d.classList.add('wg-face');
    if (OPENS.includes(el.kind)) d.classList.add('wg-tile');
    d.append(icon(el.kind), h('span', 'wg-label', label(el)));
    return d;
  }
  const make = { timer, spinner, video, sound, spotify, draw, thinkspeak, streetview }[el.kind];
  if (make) make(d, el, opts);
  // A widget is for using: clicks on it are not "show the controls" clicks.
  d.addEventListener('click', (e) => e.stopPropagation());
  return d;
}

export function label(el) {
  if (el.kind === 'timer') return el.secs ? clock(el.secs) : '0:00 +';
  if (['sound', 'video', 'spotify'].includes(el.kind)) return el.name || KINDS[el.kind];
  if (el.kind === 'streetview') return el.name || (el.places && el.places[0] && el.places[0].name) || KINDS.streetview;
  return KINDS[el.kind] || '';
}

function clock(s) {
  s = Math.max(0, Math.round(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** Ticks while the node is on screen, and stops for good once it isn't. */
function every(node, ms, fn, gone) {
  const id = setInterval(() => {
    if (node.isConnected) { fn(); return; }
    clearInterval(id);
    if (gone) gone();
  }, ms);
  return id;
}

// ---- timer -------------------------------------------------------------------

function timer(d, el) {
  const face = h('div', 'wg-time', label(el));
  const reset = h('button', 'wg-btn wg-reset', '↺');
  reset.title = 'Reset';
  d.append(face, reset);
  let run = false, base = 0, since = 0, done = false;
  const elapsed = () => base + (run ? (performance.now() - since) / 1000 : 0);
  const paint = () => {
    const t = el.secs ? el.secs - elapsed() : elapsed();
    face.textContent = clock(el.secs ? Math.ceil(t) : t);
    if (el.secs && t <= 0 && !done) {
      done = true;
      run = false;
      base = el.secs;
      d.classList.add('wg-done');
      chime();
    }
  };
  d.addEventListener('click', () => {
    if (done) return;
    if (run) { base = elapsed(); run = false; } else { since = performance.now(); run = true; }
    d.classList.toggle('wg-running', run);
  });
  reset.addEventListener('click', (e) => {
    e.stopPropagation();
    run = false; base = 0; done = false;
    d.classList.remove('wg-done', 'wg-running');
    paint();
  });
  every(d, 200, paint);
}

function chime() {
  try {
    const ac = new AudioContext();
    [0, 0.25, 0.5].forEach((at, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = [784, 988, 1175][i];
      g.gain.setValueAtTime(0.0001, ac.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + 0.6);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + at);
      o.stop(ac.currentTime + at + 0.65);
    });
    setTimeout(() => ac.close(), 1500);
  } catch (e) { /* no sound available */ }
}

// ---- names, for the spinner --------------------------------------------------
// Class lists live only in this browser's storage on this device: they are
// not part of any deck, backup or sync.

const NAMES_KEY = 'class.names';

export function loadNames() {
  try {
    const v = JSON.parse(localStorage.getItem(NAMES_KEY) || '{}');
    return { lists: v.lists || {}, last: v.last || '' };
  } catch (e) { return { lists: {}, last: '' }; }
}

function saveNames(v) {
  try { localStorage.setItem(NAMES_KEY, JSON.stringify(v)); } catch (e) { /* storage blocked */ }
}

// Who has had a turn, per list, for this sitting only.
const turns = new Map();

// ---- spinner -----------------------------------------------------------------

/** On the slide, a small icon; tapped, the wheel opens big. */
function spinner(d, el) {
  tile(d, el);
  let p = null;
  d.addEventListener('click', () => {
    if (p) return;
    p = panel(d, 'wg-panel-spin', (me) => { me.shade.remove(); p = null; });
    const w = h('div', 'wg wg-spinner');
    p.box.append(w);
    spinnerBody(w);
  });
  every(d, 500, () => {}, () => { if (p) p.close(); });
}

/* The wheel. A name picked comes off the wheel until everyone has had a turn;
   "Leave in" puts the last one back, ↺ puts everyone back. */
function spinnerBody(d) {
  d.classList.add('wg-spin');
  const wheelBox = h('div', 'wg-wheel');
  const pointer = h('div', 'wg-pointer');
  const result = h('div', 'wg-result');
  const bar = h('div', 'wg-spinbar');
  const pick = h('select', 'wg-list');
  const edit = h('button', 'wg-btn', '✎');
  edit.title = 'Edit names';
  const again = h('button', 'wg-btn', '↺');
  again.title = 'Put everyone back';
  const keepIn = h('button', 'wg-keep', 'Leave in');
  keepIn.hidden = true;
  let last = null;
  bar.append(pick, edit, again, keepIn);
  d.append(wheelBox, pointer, result, bar);

  let names = loadNames();
  let list = names.last && names.lists[names.last] ? names.last : Object.keys(names.lists)[0] || '';
  let angle = 0, spinning = false;

  const left = () => {
    const all = names.lists[list] || [];
    const had = turns.get(list) || new Set();
    const rest = all.filter((n) => !had.has(n));
    return rest.length ? rest : all;
  };

  function fillPick() {
    pick.replaceChildren(...Object.keys(names.lists).sort().map((k) => {
      const o = h('option', null, k);
      o.value = k;
      o.selected = k === list;
      return o;
    }));
    pick.hidden = !Object.keys(names.lists).length;
  }

  function drawWheel() {
    const n = left();
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '-100 -100 200 200');
    if (!n.length) {
      const c = document.createElementNS(SVG, 'circle');
      c.setAttribute('r', '98');
      c.setAttribute('fill', '#E4DCC8');
      svg.append(c);
    }
    n.forEach((name, i) => {
      const a0 = (i / n.length) * 2 * Math.PI, a1 = ((i + 1) / n.length) * 2 * Math.PI;
      const p = document.createElementNS(SVG, 'path');
      const big = a1 - a0 > Math.PI ? 1 : 0;
      p.setAttribute('d', n.length === 1 ? 'M0 -98 A98 98 0 1 1 -0.01 -98 Z'
        : 'M0 0 L' + 98 * Math.sin(a0) + ' ' + -98 * Math.cos(a0) + ' A98 98 0 ' + big + ' 1 ' +
          98 * Math.sin(a1) + ' ' + -98 * Math.cos(a1) + ' Z');
      p.setAttribute('fill', COLORS[i % COLORS.length]);
      p.setAttribute('stroke', '#fff');
      p.setAttribute('stroke-width', '1');
      svg.append(p);
      const mid = (a0 + a1) / 2;
      const t = document.createElementNS(SVG, 'text');
      t.textContent = name.length > 14 ? name.slice(0, 13) + '…' : name;
      t.setAttribute('transform', 'rotate(' + (mid * 180 / Math.PI - 90) + ') translate(92 0)');
      t.setAttribute('text-anchor', 'end');
      t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('font-size', Math.max(6, Math.min(14, 300 / Math.max(n.length, 1))));
      t.setAttribute('fill', '#fff');
      svg.append(t);
    });
    svg.style.transform = 'rotate(' + angle + 'deg)';
    wheelBox.replaceChildren(svg);
    return svg;
  }

  function spin() {
    if (spinning) return;
    const n = left();
    if (!n.length) { editNames(); return; }
    spinning = true;
    result.textContent = '';
    keepIn.hidden = true;
    const k = Math.floor(Math.random() * n.length);
    // Land the middle of slice k under the pointer at the top, on a wheel of the names left.
    const target = 360 - ((k + 0.5) / n.length) * 360;
    const svg = drawWheel();
    svg.getBoundingClientRect();
    angle = angle - (angle % 360) + 360 * 5 + target;
    svg.style.transition = 'transform 4s cubic-bezier(.15,.85,.25,1)';
    svg.style.transform = 'rotate(' + angle + 'deg)';
    setTimeout(() => {
      spinning = false;
      result.textContent = n[k];
      const had = turns.get(list) || new Set();
      if (had.size >= (names.lists[list] || []).length) had.clear();
      had.add(n[k]);
      turns.set(list, had);
      last = n[k];
      keepIn.hidden = false;
    }, 4100);
  }

  function editNames() {
    const host = document.fullscreenElement || document.body;
    const box = h('div', 'wg-names');
    const panel = h('div', 'wg-names-box');
    const nameIn = h('input', 'wg-names-title');
    nameIn.value = list;
    nameIn.placeholder = 'Class';
    const area = h('textarea', 'wg-names-list');
    area.value = (names.lists[list] || []).join('\n');
    area.placeholder = 'One name per line';
    const save = h('button', 'btn', 'Save');
    const del = h('button', 'btn danger', 'Delete');
    const cancel = h('button', 'btn quiet', 'Cancel');
    del.hidden = !list;
    panel.append(nameIn, area, h('div', 'wg-names-row'));
    panel.lastChild.append(del, h('span', 'spacer'), cancel, save);
    box.append(panel);
    host.append(box);
    nameIn.focus();
    const close = () => box.remove();
    cancel.addEventListener('click', close);
    del.addEventListener('click', () => {
      delete names.lists[list];
      list = Object.keys(names.lists)[0] || '';
      names.last = list;
      saveNames(names);
      close();
      fillPick();
      result.textContent = '';
      drawWheel();
    });
    save.addEventListener('click', () => {
      const title = nameIn.value.trim() || 'Class';
      const all = area.value.split('\n').map((s) => s.trim()).filter(Boolean);
      if (title !== list) delete names.lists[list];
      names.lists[title] = [...new Set(all)];
      list = names.last = title;
      saveNames(names);
      turns.delete(title);
      close();
      fillPick();
      result.textContent = '';
      drawWheel();
    });
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); });
    box.addEventListener('click', (e) => e.stopPropagation());
  }

  pick.addEventListener('click', (e) => e.stopPropagation());
  pick.addEventListener('change', () => {
    list = names.last = pick.value;
    saveNames(names);
    result.textContent = '';
    drawWheel();
  });
  edit.addEventListener('click', (e) => { e.stopPropagation(); editNames(); });
  keepIn.addEventListener('click', (e) => {
    e.stopPropagation();
    const had = turns.get(list);
    if (had && last) had.delete(last);
    keepIn.hidden = true;
    result.textContent = '';
    drawWheel();
  });
  again.addEventListener('click', (e) => {
    e.stopPropagation();
    if (spinning) return;
    turns.delete(list);
    keepIn.hidden = true;
    result.textContent = '';
    drawWheel();
  });
  wheelBox.addEventListener('click', spin);
  result.addEventListener('click', spin);
  fillPick();
  drawWheel();
}

/** The spinner on its own, over the whole screen: what a slide's old spinner link opens. */
export function spinnerOverlay(host) {
  const box = h('div', 'wg-overlay');
  const close = h('button', 'wg-btn wg-close', '✕');
  close.title = 'Close';
  const w = h('div', 'wg wg-spinner');
  w.style.position = 'relative';
  w.style.width = w.style.height = 'min(80vh, 80vw)';
  w.style.fontSize = '24px';
  spinnerBody(w);
  box.append(w, close);
  host.append(box);
  const done = () => box.remove();
  close.addEventListener('click', (e) => { e.stopPropagation(); done(); });
  box.addEventListener('click', (e) => e.stopPropagation());
  return done;
}

// ---- video, sound, Spotify ---------------------------------------------------

export function youtubeId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

export function spotifyPath(url) {
  const m = String(url || '').match(/open\.spotify\.com\/(?:intl-\w+\/)?(?:embed\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
  return m ? m[1] + '/' + m[2] : null;
}

function frame(d, src, title) {
  const f = h('iframe', 'wg-frame');
  f.src = src;
  f.title = title;
  f.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
  f.setAttribute('allowfullscreen', '');
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  d.append(f);
}

// ---- opening big over the slide -----------------------------------------------

/** The small box on the slide: an icon and the widget's name. */
function tile(d, el) {
  d.classList.add('wg-tile');
  d.append(icon(el.kind), h('span', 'wg-label', label(el)));
}

/** A widget's icon: think/speak's is a thought cloud, the rest an emoji. */
function icon(kind) {
  if (kind !== 'thinkspeak') return h('span', 'wg-icon', ICONS[kind] || '?');
  const svg = bubble('think');
  svg.setAttribute('viewBox', '2 10 96 86');
  svg.classList.add('wg-icon', 'wg-cloud');
  return svg;
}

let openPanel = null;                      // { close } of the panel showing now

/** A panel over the whole slide, for a widget that opened. Keys go to it, not to
    Present: Escape closes it. Closes by itself when its slide goes away. */
function panel(d, cls, onClose) {
  if (openPanel) openPanel.close();
  const host = d.closest('.present') || document.body;
  const shade = h('div', 'wg-shade');
  const box = h('div', 'wg-panel ' + cls);
  const x = h('button', 'wg-btn wg-close', '✕');
  x.title = 'Close';
  shade.append(box, x);
  host.append(shade);
  const keys = (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); me.close(); }
  };
  const me = {
    box, shade,
    close() {
      window.removeEventListener('keydown', keys, true);
      if (openPanel === me) openPanel = null;
      onClose(me);
    },
    /** Shows a tucked-away panel again. */
    reopen() {
      if (openPanel && openPanel !== me) openPanel.close();
      window.addEventListener('keydown', keys, true);
      openPanel = me;
      shade.classList.remove('wg-tucked');
    }
  };
  window.addEventListener('keydown', keys, true);
  shade.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === shade) me.close(); });
  // Drawing and tapping in here aren't swipes to another slide.
  for (const t of ['touchstart', 'touchend']) shade.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
  x.addEventListener('click', () => me.close());
  openPanel = me;
  return me;
}

function video(d, el, opts) {
  tile(d, el);
  let p = null;
  const shut = () => { if (p) { const q = p; p = null; q.close(); } };
  d.addEventListener('click', () => {
    if (p) return;
    p = panel(d, 'wg-panel-video', (me) => { me.shade.remove(); if (p === me) p = null; });
    const id = youtubeId(el.url);
    if (id) frame(p.box, 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&modestbranding=1&autoplay=1', label(el));
    else if (el.media && opts.media) {
      const v = h('video', 'wg-media');
      v.src = opts.media(el.media);
      v.controls = true;
      v.playsInline = true;
      v.autoplay = true;
      p.box.append(v);
    }
  });
  every(d, 500, () => {}, shut);
}

/* Spotify plays only from its own player, so the box opens it; closing tucks it
   away still playing, and the box's ■ stops it. */
function spotify(d, el) {
  tile(d, el);
  const path = spotifyPath(el.url);
  const stop = h('button', 'wg-btn wg-stop', '■');
  stop.title = 'Stop';
  stop.hidden = true;
  d.append(stop);
  let p = null;
  const end = () => {
    if (!p) return;
    const q = p;
    p = null;
    q.close();
    q.shade.remove();
    stop.hidden = true;
    d.classList.remove('wg-on');
  };
  d.addEventListener('click', () => {
    if (!path) return;
    if (p) { p.reopen(); return; }
    p = panel(d, 'wg-panel-spotify', (me) => {
      if (me === p) me.shade.classList.add('wg-tucked'); else me.shade.remove();
    });
    frame(p.box, 'https://open.spotify.com/embed/' + path + '?utm_source=generator', label(el));
    stop.hidden = false;
    d.classList.add('wg-on');
  });
  stop.addEventListener('click', (e) => { e.stopPropagation(); end(); });
  every(d, 500, () => {}, end);
}

// ---- drawing box ---------------------------------------------------------------
// A board to draw on, and to put pictures on: 🔎 looks for see-through pictures
// in a Google Images tab (SafeSearch on), and a copied picture comes back in by
// pasting (Ctrl+V or 📋), a picture file by dropping it, or from the picture
// library (📚; ⭐ keeps the chosen picture there). ✋ moves and sizes
// pictures. It all lasts for this sitting only, unless 💾 saves a copy (PNG) to
// the device. Nothing goes to the website but pictures kept with ⭐.

const boards = new WeakMap();              // widget -> { ink: data URL, pics: [{ img, blob, x, y, w, h }], look: data URL }

// The picture library (library.js), where the app has one (not the sub view):
// { groups() -> [{ name, pics: [{ media, src }] }], blob(hash), add(blob, groupName) }.
let library = null;
export function useLibrary(lib) { library = lib; }
const CW = 1600;                           // the board's width in canvas pixels

function draw(d, el) {
  d.classList.add('wg-draw');
  d.style.background = el.bg || '#FFFFFF';
  const preview = h('img', 'wg-preview');
  preview.alt = '';
  const face = h('div', 'wg-tile');
  face.append(h('span', 'wg-icon', ICONS.draw), h('span', 'wg-label', label(el)));
  d.append(preview, face);
  const paintPreview = () => {
    const b = boards.get(el);
    const url = b && b.look;
    preview.hidden = !url;
    face.hidden = !!url;
    if (url) preview.src = url;
  };
  paintPreview();
  let p = null;
  d.addEventListener('click', () => {
    if (p) return;
    const cw = CW, ch = Math.round(CW * el.h / el.w);
    const state = boards.get(el) || { ink: null, pics: [], look: null };
    const k = Math.min(window.innerWidth * 0.92 / cw, (window.innerHeight * 0.92 - 64) / ch);
    const board = h('div', 'wg-board');
    Object.assign(board.style, { width: cw * k + 'px', height: ch * k + 'px', background: el.bg || '#FFFFFF' });
    const layer = h('div', 'wg-pics');
    const canvas = h('canvas', 'wg-canvas');
    canvas.width = cw;
    canvas.height = ch;
    board.append(layer, canvas);
    const g = canvas.getContext('2d');
    if (state.ink) { const img = new Image(); img.onload = () => g.drawImage(img, 0, 0); img.src = state.ink; }

    // Everything on the board as one picture.
    const flat = () => {
      const out = h('canvas');
      out.width = cw;
      out.height = ch;
      const o = out.getContext('2d');
      o.fillStyle = el.bg || '#FFFFFF';
      o.fillRect(0, 0, cw, ch);
      for (const q of state.pics) if (q.img.complete) o.drawImage(q.img, q.x, q.y, q.w, q.h);
      o.drawImage(canvas, 0, 0);
      return out;
    };

    p = panel(d, 'wg-panel-draw', (me) => {
      window.removeEventListener('paste', onPaste, true);
      state.ink = canvas.toDataURL();
      state.look = state.pics.length || !blank(g, cw, ch) ? flat().toDataURL('image/jpeg', 0.8) : null;
      boards.set(el, state);
      me.shade.remove();
      p = null;
      paintPreview();
    });

    // ---- pictures: placed, moved and sized in board pixels
    let chosen = null;
    const place = (q) => {
      Object.assign(q.node.style, { left: q.x * k + 'px', top: q.y * k + 'px', width: q.w * k + 'px', height: q.h * k + 'px' });
    };
    const choose = (q) => {
      chosen = q;
      for (const x of state.pics) x.node.classList.toggle('on', x === q);
      if (keepBtn) keepBtn.disabled = !q;
    };
    let keepBtn = null;
    const showPic = (q) => {
      const node = h('div', 'wg-pic');
      const grip = h('div', 'wg-grip');
      const drop = h('button', 'wg-drop', '✕');
      drop.title = 'Take off';
      node.append(q.img, grip, drop);
      q.node = node;
      layer.append(node);
      place(q);
      drop.addEventListener('pointerdown', (e) => e.stopPropagation());
      drop.addEventListener('click', () => {
        state.pics.splice(state.pics.indexOf(q), 1);
        node.remove();
        if (chosen === q) chosen = null;
      });
      node.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        choose(q);
        const sizing = e.target === grip;
        const x0 = e.clientX, y0 = e.clientY, start = { ...q };
        node.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const dx = (ev.clientX - x0) / k, dy = (ev.clientY - y0) / k;
          if (sizing) {
            const s = Math.max(40 / start.w, (start.w + Math.max(dx, dy * start.w / start.h)) / start.w);
            q.w = start.w * s;
            q.h = start.h * s;
          } else {
            q.x = start.x + dx;
            q.y = start.y + dy;
          }
          place(q);
        };
        const up = () => {
          node.removeEventListener('pointermove', move);
          node.removeEventListener('pointerup', up);
          node.removeEventListener('pointercancel', up);
        };
        node.addEventListener('pointermove', move);
        node.addEventListener('pointerup', up);
        node.addEventListener('pointercancel', up);
      });
    };
    const addPicture = (blob) => {
      if (!blob || !/^image\//.test(blob.type)) return;
      const q = { blob };
      const img = new Image();
      img.draggable = false;
      img.alt = '';
      img.onload = () => {
        const s = Math.min(1, cw * 0.4 / img.naturalWidth, ch * 0.6 / img.naturalHeight);
        const w = img.naturalWidth * s, hh = img.naturalHeight * s;
        Object.assign(q, { img, x: (cw - w) / 2, y: (ch - hh) / 2, w, h: hh });
        state.pics.push(q);
        showPic(q);
        setMode('move');
        choose(q);
      };
      img.src = URL.createObjectURL(blob);
    };
    state.pics.forEach(showPic);
    const onPaste = (e) => {
      const items = [...((e.clipboardData && e.clipboardData.items) || [])].filter((i) => /^image\//.test(i.type));
      if (!items.length) return;
      e.preventDefault();
      for (const i of items) addPicture(i.getAsFile());
    };
    window.addEventListener('paste', onPaste, true);
    board.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    board.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      for (const f of (e.dataTransfer && e.dataTransfer.files) || []) addPicture(f);
    });

    // ---- tools
    let pen = INK[0], mode = 'pen';
    const tools = h('div', 'wg-drawbar');
    let handBtn = null;
    const setMode = (m, b) => {
      mode = m;
      board.classList.toggle('moving', m === 'move');
      if (m !== 'move') choose(null);
      const on = b || (m === 'move' ? handBtn : null);
      tools.querySelectorAll('.ink, .wg-erase, .wg-hand').forEach((x) => x.classList.toggle('on', x === on));
    };
    const tool = (cls, text, title, fn) => {
      const b = h('button', cls, text);
      b.title = title;
      b.addEventListener('click', () => fn(b));
      tools.append(b);
      return b;
    };
    INK.forEach((c, i) => {
      const b = tool('ink' + (i === 0 ? ' on' : ''), '', 'Pen', (me) => { pen = c; setMode('pen', me); });
      b.style.background = c;
    });
    tool('wg-erase', '⌫', 'Eraser', (b) => setMode('erase', b));
    handBtn = tool('wg-hand', '✋', 'Move pictures', (b) => setMode('move', b));
    tool('wg-wipe', '🗑', 'Clear', () => {
      g.clearRect(0, 0, cw, ch);
      state.pics.forEach((q) => q.node.remove());
      state.pics.length = 0;
      chosen = null;
    });
    const find = h('input', 'wg-find');
    find.type = 'search';
    find.placeholder = 'Picture of…';
    find.hidden = true;
    find.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { find.hidden = true; return; }
      if (e.key !== 'Enter' || !find.value.trim()) return;
      // See-through pictures only, SafeSearch on. Copy one there, paste it here.
      window.open('https://www.google.com/search?udm=2&safe=active&tbs=ic:trans&q=' +
        encodeURIComponent(find.value.trim()), '_blank', 'noopener');
      find.hidden = true;
    });
    tool('wg-search', '🔎', 'Find a picture', () => { find.hidden = !find.hidden; if (!find.hidden) find.focus(); });
    tools.append(find);
    tool('wg-paste', '📋', 'Paste a picture', async () => {
      try {
        for (const item of await navigator.clipboard.read()) {
          const type = item.types.find((t) => /^image\//.test(t));
          if (type) { addPicture(await item.getType(type)); return; }
        }
      } catch (e) { /* nothing to paste, or not allowed */ }
    });
    // The picture library: a tray of its pictures (tap one to put it on the board),
    // and ⭐ to keep the chosen picture in the group the tray shows.
    // Typing in the tray finds pictures by name in every group.
    let tray = null, group = null;
    const look = h('input', 'wg-tray-find');
    look.type = 'search';
    look.placeholder = '🔎';
    look.addEventListener('input', () => paintTray());
    look.addEventListener('keydown', (e) => e.stopPropagation());
    const paintTray = async () => {
      const groups = await library.groups();
      group = groups.find((g) => g.name === group) ? group : groups[0] && groups[0].name;
      const q = look.value.trim().toLowerCase();
      const tabs = h('div', 'wg-tray-tabs');
      for (const g of groups) {
        const b = h('button', 'wg-tray-tab' + (!q && g.name === group ? ' on' : ''), g.name);
        b.addEventListener('click', () => { group = g.name; look.value = ''; paintTray(); });
        tabs.append(b);
      }
      const pics = h('div', 'wg-tray-pics');
      const list = q ? groups.flatMap((g) => g.pics).filter((x, i, all) => x.name.toLowerCase().includes(q) && all.findIndex((y) => y.media === x.media) === i)
        : (groups.find((g) => g.name === group) || { pics: [] }).pics;
      for (const pic of list) {
        const b = h('button', 'wg-tray-pic');
        b.title = pic.name;
        const img = h('img');
        img.src = pic.src;
        img.alt = '';
        b.append(img);
        b.addEventListener('click', async () => addPicture(await library.blob(pic.media)));
        pics.append(b);
      }
      tray.replaceChildren(look, tabs, pics);
    };
    if (library) {
      tool('wg-lib', '📚', 'Picture library', (b) => {
        if (tray) { tray.remove(); tray = null; b.classList.remove('on'); return; }
        tray = h('div', 'wg-tray');
        p.shade.append(tray);
        b.classList.add('on');
        paintTray();
        look.focus();
      });
      keepBtn = tool('wg-keep-pic', '⭐', 'Keep in the picture library', async (b) => {
        if (!chosen || !chosen.blob) return;
        // Named for what was searched for (🔎), if anything.
        await library.add(chosen.blob, group, find.value.trim());
        b.classList.add('on');
        setTimeout(() => b.classList.remove('on'), 900);
        if (tray) paintTray();
      });
      keepBtn.disabled = true;
    }
    tool('wg-save', '💾', 'Save a copy', () => {
      flat().toBlob((blob) => {
        if (!blob) return;
        const a = h('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'drawing ' + new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '-') + '.png';
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }, 'image/png');
    });
    p.box.append(board, tools);

    canvas.addEventListener('pointerdown', (e) => {
      if (mode === 'move') return;
      const r = canvas.getBoundingClientRect();
      const at = (ev) => [(ev.clientX - r.left) * cw / r.width, (ev.clientY - r.top) * ch / r.height];
      const erase = mode === 'erase';
      g.strokeStyle = pen;
      g.lineWidth = erase ? 60 : 10;
      g.lineCap = g.lineJoin = 'round';
      g.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
      let [x, y] = at(e);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 0.1, y);
      g.stroke();
      canvas.setPointerCapture(e.pointerId);
      const move = (ev) => { [x, y] = at(ev); g.lineTo(x, y); g.stroke(); };
      const up = () => {
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', up);
      };
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
    });
  });
  every(d, 500, () => {}, () => { if (p) p.close(); });
}

/** True when nothing has been drawn. */
function blank(g, w, h) {
  const px = g.getImageData(0, 0, w, h).data;
  for (let i = 3; i < px.length; i += 64) if (px[i]) return false;
  return true;
}

function sound(d, el, opts) {
  const a = h('audio');
  if (el.media && opts.media) a.src = opts.media(el.media);
  const b = h('div', 'wg-play', '▶');
  d.append(a, b, h('div', 'wg-label', el.name || ''));
  const paint = () => { b.textContent = a.paused ? '▶' : '■'; };
  d.addEventListener('click', () => {
    if (a.paused) a.play().catch(() => {}); else { a.pause(); a.currentTime = 0; }
  });
  a.addEventListener('play', paint);
  a.addEventListener('pause', paint);
  a.addEventListener('ended', paint);
  every(d, 500, () => {}, () => a.pause());
}

// ---- think/speak ---------------------------------------------------------------
// Which pictures are thinking (the bottom row), for this sitting only.

const thinking = new WeakMap();            // widget -> Set of picture indexes

/** On the slide, a thought cloud; tapped, the speak and think rows open big on white. */
function thinkspeak(d, el, opts) {
  tile(d, el);
  let p = null;
  d.addEventListener('click', () => {
    if (p) return;
    p = panel(d, 'wg-panel-ts', (me) => { me.shade.remove(); p = null; });
    const board = h('div', 'wg-ts-board');
    p.box.append(board);
    const r = p.box.getBoundingClientRect();
    rows(board, el, r.width, r.height, opts);
  });
  every(d, 500, () => {}, () => { if (p) p.close(); });
}

/** The two rows, W x H pixels: a tap moves a picture to the other row, in its column. */
function rows(d, el, W, H, opts) {
  const pics = el.pics || [];
  const below = thinking.get(el) || new Set();
  thinking.set(el, below);
  const half = H / 2;
  const bub = Math.min(half * 0.8, W * 0.2);              // the bubbles' size
  const left = bub + W * 0.03;
  const col = (W - left) / Math.max(pics.length, 1);
  const size = Math.max(8, Math.min(col * 0.86, half * 0.8));
  d.append(at(bubble('speak'), W * 0.01, (half - bub) / 2, bub), at(bubble('think'), W * 0.01, half + (half - bub) / 2, bub));
  const line = h('div', 'wg-ts-line');
  Object.assign(line.style, { top: half - H * 0.01 + 'px', height: H * 0.02 + 'px' });
  d.append(line);
  pics.forEach((p, i) => {
    const img = h('img', 'wg-ts-pic');
    img.alt = '';
    img.draggable = false;
    if (opts.media) img.src = opts.media(p.media);
    const place = () => {
      const row = below.has(i) ? 1 : 0;
      Object.assign(img.style, { left: left + col * i + (col - size) / 2 + 'px', top: row * half + (half - size) / 2 + 'px',
        width: size + 'px', height: size + 'px' });
    };
    place();
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      if (below.has(i)) below.delete(i); else below.add(i);
      place();
    });
    d.append(img);
  });
}

function at(node, x, y, size) {
  node.classList.add('wg-ts-bubble');
  Object.assign(node.style, { left: x + 'px', top: y + 'px', width: size + 'px', height: size + 'px' });
  return node;
}

/** A speech bubble or a thought cloud, outlined in black. */
function bubble(kind) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  const path = (d) => {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', '#fff');
    p.setAttribute('stroke', '#000');
    p.setAttribute('stroke-width', '3.5');
    p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
  };
  if (kind === 'speak') {
    path('M50 14 C76 14 96 26 96 43 C96 60 76 72 50 72 C44 72 38 71 33 70 L8 86 L19 66 C9 60 4 52 4 43 C4 26 24 14 50 14 Z');
  } else {
    path('M30 30 C30 18 46 14 52 22 C58 12 76 16 76 28 C90 28 94 44 84 50 C92 60 80 72 68 66 C62 76 44 76 40 66 ' +
      'C28 72 16 62 22 54 C10 50 12 34 30 30 Z');
    path('M20 78 A6 6 0 1 0 20.01 78 Z');
    path('M8 90 A4 4 0 1 0 8.01 90 Z');
  }
  return svg;
}

/** The pictures of a think/speak: add, take off, reorder. pics: [{ media }];
    addFiles() -> media hashes of pictures the teacher picks. Resolves null on Cancel. */
export function editPictures(pics, mediaUrl, addFiles, fromLibrary) {
  return new Promise((resolve) => {
    let list = pics.map((p) => ({ ...p }));
    const box = h('div', 'wg-names');
    const card = h('div', 'wg-names-box wg-dialog');
    const grid = h('div', 'wg-ts-grid');
    const add = h('button', 'btn quiet', 'Add pictures');
    const lib = h('button', 'btn quiet', '📚 From the library');
    lib.hidden = !fromLibrary;
    const ok = h('button', 'btn', 'Done');
    const cancel = h('button', 'btn quiet', 'Cancel');
    const row = h('div', 'wg-names-row');
    row.append(add, lib, h('span', 'spacer'), cancel, ok);
    card.append(grid, row);
    box.append(card);
    (document.fullscreenElement || document.body).append(box);
    const paint = () => {
      grid.replaceChildren(...list.map((p, i) => {
        const cell = h('div', 'wg-ts-cell');
        const img = h('img');
        img.src = mediaUrl(p.media);
        img.alt = '';
        const back = h('button', 'wg-btn', '‹');
        back.title = 'Earlier';
        back.disabled = i === 0;
        back.addEventListener('click', () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; paint(); });
        const x = h('button', 'wg-btn', '✕');
        x.title = 'Take off';
        x.addEventListener('click', () => { list.splice(i, 1); paint(); });
        cell.append(img, back, x);
        return cell;
      }));
    };
    paint();
    lib.addEventListener('click', async () => {
      const hashes = await fromLibrary();
      list = list.concat(hashes.map((media) => ({ media })));
      paint();
    });
    add.addEventListener('click', async () => {
      const hashes = await addFiles();
      list = list.concat(hashes.map((media) => ({ media })));
      paint();
    });
    const done = (v) => { box.remove(); resolve(v); };
    cancel.addEventListener('click', () => done(null));
    ok.addEventListener('click', () => done(list));
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') done(null); });
  });
}

// ---- Street View ---------------------------------------------------------------

/** The embed address in what Google Maps' Share > Embed a map gives (or the address alone). */
export function mapsEmbed(text) {
  const m = String(text || '').match(/https:\/\/www\.google\.com\/maps\/embed\?[^"'\s<>]+/);
  return m ? m[0].replace(/&amp;/g, '&') : null;
}

function streetview(d, el) {
  tile(d, el);
  const places = (el.places || []).filter((x) => x.src);
  let p = null;
  d.addEventListener('click', () => {
    if (p || !places.length) return;
    p = panel(d, 'wg-panel-map', (me) => { me.shade.remove(); p = null; });
    const view = h('iframe', 'wg-frame');
    view.title = 'Street View';
    view.allow = 'fullscreen';
    view.setAttribute('allowfullscreen', '');
    view.referrerPolicy = 'strict-origin-when-cross-origin';
    const pick = h('select', 'wg-places');
    places.forEach((x, i) => pick.append(new Option(x.name || 'Place ' + (i + 1), i)));
    pick.addEventListener('change', () => { view.src = places[pick.value].src; });
    view.src = places[0].src;
    p.box.append(view);
    if (places.length > 1) p.box.append(pick);
  });
  every(d, 500, () => {}, () => { if (p) p.close(); });
}

/** A Street View widget's places: a name and pasted embed code each, the first where it
    starts. Resolves the new list, or null on Cancel. */
export function editPlaces(places) {
  return new Promise((resolve) => {
    const rows = places.length ? places.map((x) => ({ ...x })) : [{ name: '', src: '' }];
    const box = h('div', 'wg-names');
    const card = h('div', 'wg-names-box wg-dialog');
    const list = h('div', 'wg-place-list');
    const add = h('button', 'btn quiet', 'Add a place');
    const ok = h('button', 'btn', 'Done');
    const cancel = h('button', 'btn quiet', 'Cancel');
    const bar = h('div', 'wg-names-row');
    bar.append(add, h('span', 'spacer'), cancel, ok);
    card.append(list, bar);
    box.append(card);
    (document.fullscreenElement || document.body).append(box);
    const paint = () => {
      list.replaceChildren(...rows.map((x, i) => {
        const r = h('div', 'wg-place-row');
        const name = h('input', 'wg-names-title');
        name.placeholder = 'Name';
        name.value = x.name || '';
        name.addEventListener('input', () => { x.name = name.value; });
        const code = h('input', 'wg-names-title');
        code.placeholder = 'Embed code from Google Maps';
        code.value = x.src || '';
        code.addEventListener('input', () => { x.src = mapsEmbed(code.value) || ''; code.classList.toggle('bad', !!code.value && !x.src); });
        const out = h('button', 'wg-btn', '✕');
        out.title = 'Remove';
        out.addEventListener('click', () => { rows.splice(i, 1); paint(); });
        r.append(name, code, out);
        return r;
      }));
    };
    paint();
    add.addEventListener('click', () => { rows.push({ name: '', src: '' }); paint(); });
    const done = (v) => { box.remove(); resolve(v); };
    cancel.addEventListener('click', () => done(null));
    ok.addEventListener('click', () => done(rows.filter((x) => x.src).map((x) => ({ name: (x.name || '').trim(), src: x.src }))));
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') done(null); });
  });
}
