/* Widgets: slide elements that do something in Present.
   { t: 'wg', kind, x, y, w, h, ... }
   - timer:   secs (counts down from it; 0 counts up). Tap to start or pause.
   - spinner: picks a student. Names stay on this device (see names below),
              never in a deck, so they never leave it.
   - video:   url (YouTube) or media (a video file kept on the device), name
   - sound:   media (a sound file kept on the device), name
   - spotify: url (an open.spotify.com track, album or playlist), name
   - draw:    a box to draw on, bg (its color)
   Video, Spotify and the drawing box sit on the slide as a small labeled box;
   tapped, they open big over the slide (OPENS), clear of the slide's scaling.
   Elsewhere (thumbnails, the editor) a widget draws as a quiet label. */

export const KINDS = { timer: 'Timer', spinner: 'Spinner', video: 'Video', sound: 'Sound', spotify: 'Spotify', draw: 'Drawing box' };
const ICONS = { timer: '⏱', spinner: '🎡', video: '▶', sound: '🔊', spotify: '🎵', draw: '✏' };
const OPENS = ['video', 'spotify', 'draw'];
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
  d.style.fontSize = (OPENS.includes(el.kind) ? Math.max(12, Math.min(el.h / 2.6, el.w / 8))
    : Math.max(12, Math.min(el.w, el.h) / 6)) + 'px';
  if (!opts.live) {
    d.classList.add('wg-face');
    if (OPENS.includes(el.kind)) d.classList.add('wg-tile');
    d.append(h('span', 'wg-icon', ICONS[el.kind] || '?'), h('span', 'wg-label', label(el)));
    return d;
  }
  const make = { timer, spinner, video, sound, spotify, draw }[el.kind];
  if (make) make(d, el, opts);
  // A widget is for using: clicks on it are not "show the controls" clicks.
  d.addEventListener('click', (e) => e.stopPropagation());
  return d;
}

export function label(el) {
  if (el.kind === 'timer') return el.secs ? clock(el.secs) : '0:00 +';
  if (['sound', 'video', 'spotify'].includes(el.kind)) return el.name || KINDS[el.kind];
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

function spinner(d, el) {
  d.classList.add('wg-spin');
  const wheelBox = h('div', 'wg-wheel');
  const pointer = h('div', 'wg-pointer');
  const result = h('div', 'wg-result');
  const bar = h('div', 'wg-spinbar');
  const pick = h('select', 'wg-list');
  const edit = h('button', 'wg-btn', '✎');
  edit.title = 'Edit names';
  bar.append(pick, edit);
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
    const k = Math.floor(Math.random() * n.length);
    // Land the middle of slice k under the pointer at the top.
    const target = 360 - ((k + 0.5) / n.length) * 360;
    const svg = wheelBox.firstChild;
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
  const w = drawWidget({ t: 'wg', kind: 'spinner', x: 0, y: 0, w: 480, h: 480 }, { live: true });
  w.style.position = 'relative';
  w.style.left = w.style.top = '';
  w.style.width = w.style.height = 'min(80vh, 80vw)';
  w.style.fontSize = '24px';
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
  d.append(h('span', 'wg-icon', ICONS[el.kind]), h('span', 'wg-label', label(el)));
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
// What's drawn stays for this sitting only; it is never saved.

const drawn = new WeakMap();               // widget -> data URL

function draw(d, el) {
  d.classList.add('wg-draw');
  d.style.background = el.bg || '#FFFFFF';
  const preview = h('img', 'wg-preview');
  preview.alt = '';
  const face = h('div', 'wg-tile');
  face.append(h('span', 'wg-icon', ICONS.draw), h('span', 'wg-label', label(el)));
  d.append(preview, face);
  const paintPreview = () => {
    const url = drawn.get(el);
    preview.hidden = !url;
    face.hidden = !!url;
    if (url) preview.src = url;
  };
  paintPreview();
  let p = null;
  d.addEventListener('click', () => {
    if (p) return;
    p = panel(d, 'wg-panel-draw', (me) => {
      drawn.set(el, canvas.toDataURL());
      me.shade.remove();
      p = null;
      paintPreview();
    });
    // The canvas keeps the box's shape, as big as the screen allows.
    const cw = 1600, ch = Math.round(1600 * el.h / el.w);
    const canvas = h('canvas', 'wg-canvas');
    canvas.width = cw;
    canvas.height = ch;
    const k = Math.min(window.innerWidth * 0.92 / cw, (window.innerHeight * 0.92 - 64) / ch);
    canvas.style.width = cw * k + 'px';
    canvas.style.height = ch * k + 'px';
    canvas.style.background = el.bg || '#FFFFFF';
    const g = canvas.getContext('2d');
    const had = drawn.get(el);
    if (had) { const img = new Image(); img.onload = () => g.drawImage(img, 0, 0); img.src = had; }
    let pen = INK[0], erase = false;
    const tools = h('div', 'wg-drawbar');
    const pick = (b) => tools.querySelectorAll('.ink, .wg-erase').forEach((x) => x.classList.toggle('on', x === b));
    INK.forEach((c, i) => {
      const b = h('button', 'ink' + (i === 0 ? ' on' : ''));
      b.style.background = c;
      b.title = 'Pen';
      b.addEventListener('click', () => { pen = c; erase = false; pick(b); });
      tools.append(b);
    });
    const rub = h('button', 'wg-erase', '⌫');
    rub.title = 'Eraser';
    rub.addEventListener('click', () => { erase = true; pick(rub); });
    const wipe = h('button', 'wg-wipe', '🗑');
    wipe.title = 'Clear';
    wipe.addEventListener('click', () => g.clearRect(0, 0, cw, ch));
    tools.append(rub, wipe);
    p.box.append(canvas, tools);

    canvas.addEventListener('pointerdown', (e) => {
      const r = canvas.getBoundingClientRect();
      const at = (ev) => [(ev.clientX - r.left) * cw / r.width, (ev.clientY - r.top) * ch / r.height];
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
