/* Markup mode, for Kyle: freeze whatever is on screen (a game, a card between games, the
   title, an intro), drop numbered notes on it and draw on it, and keep each one. "Download"
   saves them all as one file (pictures, notes, and what was under each note) to hand to Claude.

   On when Test mode is (My progress), in a workshop test run, or with ?markup. The ✏️ button
   sits bottom left. Freezing pauses the sound (and so the beat clock); Done lets it go on.
   A picture of the screen needs "Allow" for screen capture once a visit (the browser asks);
   without it, a markup keeps its notes, drawing and the screen's words.

   Markups stay on this device (IndexedDB) until downloaded and cleared. */

const DB = 'musician-maker-markup';
let enabled = () => false;
let where = () => '';
let audio = null;
let btn = null;
let open = null; // the markup being made
let capture = null; // { stream, video } once screen capture is allowed

export function setup(opts) {
  // While marking up, keys type into notes and never reach the game.
  for (const t of ['keydown', 'keyup']) addEventListener(t, (e) => { if (open) e.stopImmediatePropagation(); }, true);
  enabled = opts.enabled;
  where = opts.where;
  audio = opts.audio;
  btn = el('button', { class: 'mk-btn', 'aria-label': 'Markup mode', title: 'Markup mode' }, '✏️');
  btn.addEventListener('click', start);
  document.body.append(btn);
  refresh();
}

/* Show or hide the button (each screen change calls this). */
export function refresh() {
  if (btn) btn.hidden = !enabled() || !!open;
  count().then((n) => { if (btn) btn.dataset.n = n || ''; });
}

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}

/* ---------- the store ---------- */

function db() {
  return new Promise((ok, fail) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('marks', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, fail) => {
    const t = d.transaction('marks', mode);
    const out = fn(t.objectStore('marks'));
    t.oncomplete = () => ok(out?.result ?? out);
    t.onerror = () => fail(t.error);
  });
}
const all = () => tx('readonly', (s) => s.getAll()).catch(() => []);
const put = (m) => tx('readwrite', (s) => s.put(m));
const del = (id) => tx('readwrite', (s) => s.delete(id));
const clearAll = () => tx('readwrite', (s) => s.clear());
const count = () => tx('readonly', (s) => s.count()).catch(() => 0);

/* ---------- making a markup ---------- */

async function start() {
  if (open) return;
  const ctx = audio?.();
  const wasRunning = ctx?.state === 'running';
  if (wasRunning) await ctx.suspend();
  const app = document.getElementById('app');
  // Freeze: a still copy of the screen, animations held, on top of the live page.
  const text = words(app); // before it's hidden: hidden text has no innerText
  const still = app.cloneNode(true); // keeps the id, for #app's own layout
  still.classList.add('mk-still');
  app.style.visibility = 'hidden'; // the live page goes on underneath until Done
  const W = innerWidth;
  const H = innerHeight;
  const layer = el('div', { class: 'mk-layer' });
  const ink = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ink.setAttribute('class', 'mk-ink');
  ink.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const pins = el('div', { class: 'mk-pins' });
  const freeze = el('div', { class: 'mk-freeze' }, el('div', { class: 'mk-shot' }, still), ink, pins, layer);
  freeze.style.setProperty('--sx', `${-scrollX}px`);
  freeze.style.setProperty('--sy', `${-scrollY}px`);
  let tool = 'note';
  const m = { id: Date.now(), at: new Date().toISOString(), screen: where(), size: [W, H], notes: [], strokes: [], text };
  const tools = el('div', { class: 'mk-tools' });
  const say = el('span', { class: 'mk-hint' });
  const drawTools = () => {
    tools.replaceChildren(
      el('button', { class: tool === 'note' ? 'on' : '', onclick: () => { tool = 'note'; drawTools(); } }, '📍 Note'),
      el('button', { class: tool === 'draw' ? 'on' : '', onclick: () => { tool = 'draw'; drawTools(); } }, '✏️ Draw'),
      el('button', { onclick: undo }, '↩︎'),
      el('button', { onclick: () => list() }, '🗂️'),
      el('button', { class: 'mk-save', onclick: save }, 'Save'),
      el('button', { onclick: () => close(false) }, '✕'),
      say);
    say.textContent = tool === 'note' ? 'Tap where the note goes' : 'Draw on the screen';
  };
  drawTools();
  freeze.append(tools);
  document.body.append(freeze);
  open = { m, freeze, wasRunning, app };
  refresh();

  const pt = (e) => [e.clientX, e.clientY];
  let line = null;
  layer.addEventListener('pointerdown', (e) => {
    if (tool === 'draw') {
      layer.setPointerCapture(e.pointerId);
      line = { pts: [pt(e)], path: document.createElementNS('http://www.w3.org/2000/svg', 'path') };
      ink.append(line.path);
      return;
    }
    e.preventDefault(); // keeps the new note's box focused
    const [x, y] = pt(e);
    addNote(x, y);
  });
  layer.addEventListener('pointermove', (e) => {
    if (!line) return;
    line.pts.push(pt(e));
    line.path.setAttribute('d', `M${line.pts.map((p) => p.join(' ')).join(' L')}`);
  });
  const end = () => {
    if (!line) return;
    if (line.pts.length > 1) m.strokes.push(line.pts.map(([x, y]) => [Math.round(x), Math.round(y)]));
    else line.path.remove();
    line = null;
  };
  layer.addEventListener('pointerup', end);
  layer.addEventListener('pointercancel', end);

  function addNote(x, y) {
    const n = m.notes.length + 1;
    const under = whatIsAt(still, x, y);
    const box = el('textarea', { class: 'mk-text', rows: 3, placeholder: `Note ${n}` });
    const pin = el('div', { class: 'mk-pin' }, el('b', {}, String(n)), box);
    pin.style.left = `${x}px`;
    pin.style.top = `${y}px`;
    if (x + 20 + Math.min(200, W * 0.44) > W - 4) pin.classList.add('left');
    if (y > H * 0.6) pin.classList.add('up');
    pins.append(pin);
    const note = { n, x: Math.round(x), y: Math.round(y), text: '', under };
    m.notes.push(note);
    box.addEventListener('input', () => { note.text = box.value; });
    box.addEventListener('pointerdown', (e) => e.stopPropagation());
    setTimeout(() => box.focus(), 0);
  }

  function undo() {
    if (tool === 'draw' && m.strokes.length) { m.strokes.pop(); ink.lastElementChild?.remove(); return; }
    if (m.notes.length) { m.notes.pop(); pins.lastElementChild?.remove(); return; }
    if (m.strokes.length) { m.strokes.pop(); ink.lastElementChild?.remove(); }
  }

  async function save() {
    m.notes = m.notes.filter((x) => x.text.trim() || m.strokes.length);
    if (!m.notes.length && !m.strokes.length) { say.textContent = 'Add a note or draw first'; return; }
    tools.hidden = true;
    pins.querySelectorAll('textarea').forEach((t) => { t.blur(); });
    m.picture = await shoot();
    tools.hidden = false;
    await put(m);
    close(true);
  }
}

function close(saved) {
  if (!open) return;
  const { freeze, wasRunning, app } = open;
  freeze.remove();
  app.style.visibility = '';
  open = null;
  if (wasRunning) audio?.()?.resume();
  refresh();
  if (saved) toast('Saved ✓');
}

function toast(text) {
  const t = el('div', { class: 'mk-toast' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 1600);
}

/* The words on screen, top to bottom: enough to tell which screen it was. */
function words(root) {
  return (root.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 40).join(' · ');
}

/* What's under a note: the element's classes up its parents, and its words. */
function whatIsAt(still, x, y) {
  const shot = still.parentElement;
  shot.style.pointerEvents = 'auto'; // so the still copy can be hit
  const hits = document.elementsFromPoint(x, y).filter((e) => still.contains(e) && e !== still);
  shot.style.pointerEvents = '';
  const t = hits[0];
  if (!t) return '';
  const chain = [];
  for (let e = t; e && e !== still && chain.length < 5; e = e.parentElement) {
    const c = typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    chain.unshift(`${e.tagName.toLowerCase()}${c ? `.${c}` : ''}`);
  }
  const text = (t.innerText || t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  return `${chain.join(' > ')}${text ? ` "${text}"` : ''}`;
}

/* A picture of the screen as it is now (pins and drawing included), through the browser's
   screen capture. Asked for once a visit; null when it isn't allowed. */
async function shoot() {
  try {
    if (!capture) {
      if (!navigator.mediaDevices?.getDisplayMedia) return null;
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' });
      const video = el('video', { muted: '', playsinline: '' });
      video.srcObject = stream;
      await video.play();
      stream.getVideoTracks()[0].addEventListener('ended', () => { capture = null; });
      capture = { stream, video };
      await new Promise((r) => setTimeout(r, 300));
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const { video } = capture;
    const scale = Math.min(1, 1100 / Math.max(video.videoWidth, video.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(video.videoWidth * scale);
    c.height = Math.round(video.videoHeight * scale);
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } catch {
    return null;
  }
}

/* ---------- the list, download, clear ---------- */

async function list() {
  const marks = (await all()).sort((a, b) => a.id - b.id);
  const body = el('div', { class: 'mk-list' });
  const shut = () => panel.remove();
  const panel = el('div', { class: 'mk-panel' },
    el('div', { class: 'mk-panel-in' },
      el('div', { class: 'mk-panel-top' }, el('b', {}, `Markups (${marks.length})`),
        el('button', { onclick: () => download(marks), disabled: marks.length ? null : '' }, '⬇︎ Download'),
        el('button', { onclick: async () => { if (marks.length) { await clearAll(); shut(); refresh(); toast('Cleared'); } } }, 'Clear all'),
        el('button', { onclick: shut }, '✕')),
      body));
  body.append(...marks.map((m) => el('div', { class: 'mk-item' },
    m.picture ? el('img', { src: m.picture, alt: '' }) : el('div', { class: 'mk-nopic' }, '🖼️'),
    el('div', {}, el('small', {}, `${new Date(m.at).toLocaleString()} · ${m.screen}`),
      el('ol', {}, ...m.notes.map((n) => el('li', {}, n.text || '(drawing)'))),
      m.strokes.length ? el('small', {}, `${m.strokes.length} drawn`) : null),
    el('button', { 'aria-label': 'Delete', onclick: async (e) => { await del(m.id); e.currentTarget.closest('.mk-item').remove(); refresh(); } }, '🗑'))));
  if (!marks.length) body.append(el('p', {}, 'None yet.'));
  (open?.freeze || document.body).append(panel);
}

function download(marks) {
  const data = JSON.stringify({ app: 'musician-maker', made: new Date().toISOString(), ua: navigator.userAgent, marks }, null, 1);
  const a = el('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: `musician-maker-markup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
