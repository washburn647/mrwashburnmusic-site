/* The slide editor: a strip of slides on the left, the slide in the middle,
   speaker notes underneath, tools along the top.

   Every change copies the slides it touches before changing them, so undo
   only has to keep the earlier list of slides. Changes save to the device
   as they happen. Slide links ({ slide: n }) follow their slide when slides
   are moved, added or deleted. */

import { renderSlide, drawElement, geometry } from './render.js';
import { markDeck, ROLES } from './marks.js';
import { guessTitle } from './pptx.js';
import { present } from './present.js';
import * as store from './store.js';
import { el, thumb, addMediaUrl } from './ui.js';

const SHAPES = [
  ['rect', 'Rectangle'], ['roundRect', 'Rounded rectangle'], ['ellipse', 'Circle'],
  ['triangle', 'Triangle'], ['rightArrow', 'Arrow'], ['star5', 'Star'], ['heart', 'Heart'], ['cloud', 'Cloud']
];
const FONTS = ['Comic Sans MS', 'Arial', 'Times New Roman', 'Fredoka'];
const LINE_WIDTHS = [0, 1, 2, 3, 5, 8];
const SNAP = 6;                            // screen px
const NUDGE = 1, NUDGE_BIG = 10;
const MIN_SIZE = 4;

export function openEditor(rec, startAt, { media, findGoogle, onExit }) {
  const deck = rec.deck;
  let index = Math.max(0, Math.min(deck.slides.length - 1, startAt || 0));
  let sel = [];                            // element indexes on this slide
  let editing = null;                      // { i, txt } while typing in a box
  let undo = [], redo = [];
  let writable = null;                     // indexes of slides copied for the change in progress
  let lastKey = null, lastAt = 0;
  let clip = null;                         // copied elements
  let scale = 1;
  let stage = null;
  let saveTimer = null;
  let dragFrom = null;

  // ---- layout ---------------------------------------------------------------

  const tool = (label, title, fn, cls) => {
    const b = el('button', { class: 'ed-btn' + (cls ? ' ' + cls : ''), title, 'aria-label': title }, label);
    // Keep the caret in a text box while a tool is pressed.
    b.addEventListener('pointerdown', (e) => { if (editing) e.preventDefault(); });
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(e); });
    return b;
  };
  const color = (title, fn) => {
    const c = el('input', { type: 'color', class: 'ed-color', title, 'aria-label': title });
    c.addEventListener('input', () => fn(c.value));
    return c;
  };
  const group = (...kids) => el('span', { class: 'ed-group' }, ...kids);

  const picker = el('input', { type: 'file', accept: 'image/*', hidden: true, multiple: true });
  const replacer = el('input', { type: 'file', accept: 'image/*', hidden: true });

  const undoBtn = tool('↶', 'Undo (Ctrl+Z)', () => doUndo());
  const redoBtn = tool('↷', 'Redo (Ctrl+Y)', () => doRedo());

  const shapeMenu = el('div', { class: 'ed-menu', hidden: true });
  for (const [geom, name] of SHAPES) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-2 -2 28 28');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', geometry(geom, 24, geom === 'rightArrow' ? 14 : 24, {}).fill);
    if (geom === 'rightArrow') path.setAttribute('transform', 'translate(0 5)');
    svg.appendChild(path);
    shapeMenu.appendChild(tool(svg, name, () => { shapeMenu.hidden = true; addShape(geom); }));
  }
  const shapeBtn = tool('◆', 'Shape', () => { shapeMenu.hidden = !shapeMenu.hidden; });

  const bgColor = color('Background color', (v) => setBackground(v));
  const fillColor = color('Fill color', (v) => setFill(v));
  const noFill = tool('∅', 'No fill', () => setFill(null));
  const lineColor = color('Line color', (v) => setLine({ color: v }));
  const lineWidth = el('select', { class: 'ed-select', title: 'Line width', 'aria-label': 'Line width' },
    LINE_WIDTHS.map((w) => el('option', { value: w }, w ? w + ' px' : 'No line')));
  lineWidth.addEventListener('change', () => setLine({ width: Number(lineWidth.value) }));

  const fontSel = el('select', { class: 'ed-select', title: 'Font', 'aria-label': 'Font' },
    FONTS.map((f) => el('option', { value: f }, f)));
  fontSel.addEventListener('change', () => setRuns({ font: fontSel.value }));
  const sizeOut = el('span', { class: 'ed-size' }, '');
  const smaller = tool('A−', 'Smaller text', () => resizeText(-1));
  const bigger = tool('A+', 'Bigger text', () => resizeText(1));
  const boldBtn = tool(el('b', {}, 'B'), 'Bold (Ctrl+B)', () => toggleStyle('b', 'bold'));
  const italicBtn = tool(el('i', {}, 'I'), 'Italic (Ctrl+I)', () => toggleStyle('i', 'italic'));
  const underBtn = tool(el('u', {}, 'U'), 'Underline (Ctrl+U)', () => toggleStyle('u', 'underline'));
  const textColor = color('Text color', (v) => setTextColor(v));
  const alignBtns = [['l', '⇤', 'Align left'], ['ctr', '↔', 'Center'], ['r', '⇥', 'Align right']]
    .map(([a, label, title]) => tool(label, title, () => setAlign(a)));

  const linkBtn = tool('🔗', 'Link', () => openLink());
  const linkBox = el('div', { class: 'ed-menu ed-link', hidden: true });
  const linkInput = el('input', { type: 'text', class: 'ed-input', placeholder: 'Slide number or web address',
    'aria-label': 'Slide number or web address' });
  linkBox.append(linkInput, tool('✓', 'Set link', () => applyLink()), tool('✕', 'Remove link', () => applyLink(true)));
  linkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
    if (e.key === 'Escape') { e.preventDefault(); linkBox.hidden = true; }
  });

  const markSel = el('select', { class: 'ed-select', title: 'Mark as', 'aria-label': 'Mark as' },
    el('option', { value: '' }, 'Not marked'),
    Object.entries(ROLES).map(([k, v]) => el('option', { value: k }, v)));
  markSel.addEventListener('change', () => setMark(markSel.value));

  const replaceBtn = tool('🖼', 'Replace picture', () => replacer.click());
  const frontBtn = tool('⤒', 'Bring to front', () => restack(1));
  const backBtn = tool('⤓', 'Send to back', () => restack(-1));
  const dupBtn = tool('⧉', 'Duplicate (Ctrl+D)', () => duplicate());
  const delBtn = tool('🗑', 'Delete', () => removeSelected());

  const shapeTools = group(fillColor, noFill, lineColor, lineWidth);
  const textTools = group(fontSel, smaller, sizeOut, bigger, boldBtn, italicBtn, underBtn, textColor, ...alignBtns);
  const objTools = group(linkBtn, markSel, replaceBtn, frontBtn, backBtn, dupBtn, delBtn);
  const slideTools = group(el('label', { class: 'ed-label' }, 'Background', bgColor));

  const top = el('header', { class: 'ed-top' },
    tool('‹', 'Back to the deck', () => close(), 'ed-back'),
    el('h1', {}, rec.name),
    group(undoBtn, redoBtn),
    group(tool('T', 'Text box', () => addText()), el('span', { class: 'ed-anchor' }, shapeBtn, shapeMenu),
      tool('🖼', 'Picture', () => picker.click())),
    slideTools, shapeTools, textTools, el('span', { class: 'ed-anchor' }, objTools, linkBox),
    el('span', { class: 'spacer' }),
    el('button', { class: 'btn', onclick: () => run() }, '▶ Present'),
    picker, replacer);

  const list = el('div', { class: 'ed-list' });
  const strip = el('aside', { class: 'ed-strip' }, list,
    el('div', { class: 'ed-strip-tools' },
      tool('＋', 'New slide (Ctrl+M)', () => addSlide()),
      tool('⧉', 'Duplicate slide', () => duplicateSlide()),
      tool('👁', 'Hide or show slide', () => toggleHidden()),
      tool('🗑', 'Delete slide', () => deleteSlide())));

  const overlay = el('div', { class: 'ed-overlay' });
  const canvas = el('div', { class: 'ed-canvas' });
  const box = el('div', { class: 'ed-stagebox' }, canvas);
  const notes = el('textarea', { class: 'ed-notes', placeholder: 'Speaker notes', 'aria-label': 'Speaker notes' });
  const root = el('div', { class: 'editor' }, top,
    el('div', { class: 'ed-body' }, strip, el('section', { class: 'ed-main' }, box, notes)));

  // ---- drawing --------------------------------------------------------------

  const cur = () => deck.slides[index];

  function draw() {
    stage = renderSlide(cur(), deck, { media });
    overlay.style.width = deck.w + 'px';
    overlay.style.height = deck.h + 'px';
    canvas.replaceChildren(stage, overlay);
    canvas.style.width = deck.w + 'px';
    canvas.style.height = deck.h + 'px';
    fit();
    paintSel();
    if (document.activeElement !== notes) notes.value = cur().notes || '';
    tools();
  }

  function fit() {
    const W = box.clientWidth - 32, H = box.clientHeight - 32;
    scale = Math.max(0.1, Math.min(W / deck.w, H / deck.h));
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.style.left = (box.clientWidth - deck.w * scale) / 2 + 'px';
    canvas.style.top = (box.clientHeight - deck.h * scale) / 2 + 'px';
    canvas.style.setProperty('--k', 1 / scale);
  }

  const nodeOf = (i) => stage.querySelector(':scope > [data-i="' + i + '"]');

  function redrawNode(i) {
    const old = nodeOf(i);
    const node = drawElement(cur().els[i], { media });
    if (!node) return;
    node.dataset.i = i;
    if (old) old.replaceWith(node); else stage.appendChild(node);
  }

  function paintSel() {
    overlay.replaceChildren();
    const els = cur().els;
    sel = sel.filter((i) => els[i]);
    for (const i of sel) {
      const e = els[i];
      const b = el('div', { class: 'ed-box' });
      place(b, e);
      if (e.rot) b.style.transform = 'rotate(' + e.rot + 'deg)';
      if (sel.length === 1) {
        for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) b.appendChild(el('div', { class: 'ed-h ed-h-' + h, 'data-h': h }));
        if (e.role) b.appendChild(el('div', { class: 'ed-tag' }, ROLES[e.role]));
      }
      overlay.appendChild(b);
    }
  }

  function enable(group, on) {
    group.classList.toggle('off', !on);
    for (const c of group.querySelectorAll('button, input, select')) c.disabled = !on;
  }

  function place(node, r) {
    node.style.left = r.x + 'px';
    node.style.top = r.y + 'px';
    node.style.width = Math.max(r.w, 0) + 'px';
    node.style.height = Math.max(r.h, 0) + 'px';
  }

  // Show the tools that fit what is selected, set to its current values.
  function tools() {
    const els = sel.map((i) => cur().els[i]);
    const one = els.length === 1 ? els[0] : null;
    // Tools stay in place and grey out, so the slide never jumps under the pointer.
    enable(shapeTools, els.some((e) => e.t === 'sp'));
    enable(textTools, els.some((e) => e.text && e.role !== 'timer') || !!editing);
    enable(objTools, els.length > 0);
    replaceBtn.disabled = !(one && one.t === 'pic');
    linkBtn.disabled = markSel.disabled = !one;
    bgColor.value = solid(cur().bg) || '#ffffff';
    const shape = els.find((e) => e.t === 'sp');
    if (shape) {
      fillColor.value = solid(shape.fill) || '#ffffff';
      lineColor.value = shape.line ? toHex(shape.line.color) : '#000000';
      const w = shape.line ? shape.line.width : 0;
      lineWidth.value = LINE_WIDTHS.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a));
    }
    const run = firstRun(els.find((e) => e.text));
    if (run) {
      if (FONTS.includes(run.font)) fontSel.value = run.font;
      sizeOut.textContent = Math.round(run.sz || 18);
      textColor.value = toHex(run.color || '#000000');
      boldBtn.classList.toggle('on', !!run.b);
      italicBtn.classList.toggle('on', !!run.i);
      underBtn.classList.toggle('on', !!run.u);
    }
    if (one) markSel.value = one.role || '';
    linkBtn.classList.toggle('on', !!(one && one.link));
    undoBtn.disabled = !undo.length;
    redoBtn.disabled = !redo.length;
  }

  // ---- the slide strip ------------------------------------------------------

  function buildStrip() {
    list.replaceChildren(...deck.slides.map((s, i) => stripItem(s, i)));
    markStrip();
  }

  function stripItem(s, i) {
    const item = el('div', { class: 'ed-slide' + (s.hidden ? ' hidden-slide' : ''), draggable: 'true', 'data-n': i },
      el('span', { class: 'n' }, String(i + 1)), thumb(s, deck, media));
    item.addEventListener('click', () => go(i));
    item.addEventListener('dragstart', (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragover', (e) => {
      if (dragFrom == null) return;
      e.preventDefault();
      const r = item.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      item.classList.toggle('drop-before', !after);
      item.classList.toggle('drop-after', after);
    });
    item.addEventListener('dragleave', () => item.classList.remove('drop-before', 'drop-after'));
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const after = item.classList.contains('drop-after');
      item.classList.remove('drop-before', 'drop-after');
      if (dragFrom == null) return;
      let to = i + (after ? 1 : 0);
      if (dragFrom < to) to--;
      moveSlide(dragFrom, to);
      dragFrom = null;
    });
    item.addEventListener('dragend', () => { dragFrom = null; });
    return item;
  }

  function refreshStripItem(i) {
    const old = list.children[i];
    if (old) old.replaceWith(stripItem(deck.slides[i], i));
    markStrip();
  }

  function markStrip() {
    [...list.children].forEach((c, i) => c.classList.toggle('on', i === index));
    const on = list.children[index];
    if (on) on.scrollIntoView({ block: 'nearest' });
  }

  function go(i) {
    commitText();
    index = Math.max(0, Math.min(deck.slides.length - 1, i));
    sel = [];
    linkBox.hidden = true;
    history.replaceState(null, '', '#/deck/' + rec.id + '/edit/' + (index + 1));
    markStrip();
    draw();
  }

  // ---- changes and undo -----------------------------------------------------

  // key: repeated changes with the same key (typing notes, nudging) undo as one.
  function begin(key) {
    const now = Date.now();
    if (!(key && key === lastKey && now - lastAt < 1500)) {
      undo.push({ slides: deck.slides, index });
      if (undo.length > 300) undo.shift();
      redo = [];
    }
    lastKey = key || null;
    lastAt = now;
    deck.slides = deck.slides.slice();
    writable = new Set();
  }

  function ws(i = index) {
    if (!writable.has(i)) {
      deck.slides[i] = structuredClone(deck.slides[i]);
      writable.add(i);
    }
    return deck.slides[i];
  }

  function commit({ structural = false, redraw = true } = {}) {
    for (const i of writable) {
      const s = deck.slides[i];
      if (s) s.title = guessTitle(s);
    }
    const touched = writable;
    writable = null;
    markDeck(deck);
    save();
    if (structural) buildStrip(); else for (const i of touched) refreshStripItem(i);
    if (redraw) draw(); else tools();
  }

  // Drop a change that turned out to change nothing.
  function cancel() {
    const last = undo.pop();
    if (last) deck.slides = last.slides;
    writable = null;
    lastKey = null;
  }

  function change(fn, key) {
    begin(key);
    fn();
    commit();
  }

  function doUndo() {
    commitText();
    if (!undo.length) return;
    redo.push({ slides: deck.slides, index });
    restore(undo.pop());
  }

  function doRedo() {
    commitText();
    if (!redo.length) return;
    undo.push({ slides: deck.slides, index });
    restore(redo.pop());
  }

  function restore(state) {
    deck.slides = state.slides;
    index = Math.max(0, Math.min(deck.slides.length - 1, state.index));
    sel = [];
    lastKey = null;
    markDeck(deck);
    save();
    buildStrip();
    draw();
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 500);
  }

  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    rec.updated = Date.now();
    return store.putDeck(rec).catch((err) => { console.error(err); window.alert('Could not save: ' + err.message); });
  }

  // When an element that the planner relies on is changed, keep its mark,
  // so resizing the song icon doesn't stop it being the song icon.
  function keepMark(e) {
    if (e.role && !e.mark) e.mark = e.role;
  }

  // ---- adding things ---------------------------------------------------------

  function addElements(els, select = true) {
    begin();
    const s = ws();
    const start = s.els.length;
    s.els.push(...els);
    commit();
    if (select) { sel = els.map((_, k) => start + k); paintSel(); tools(); }
  }

  function addText() {
    commitText();
    const e = { t: 'sp', x: 280, y: 200, w: 400, h: 90, geom: 'rect', text: blankText('l', 't') };
    addElements([e]);
    editText(cur().els.length - 1, null, true);
  }

  function addShape(geom) {
    commitText();
    const wide = geom === 'rightArrow';
    const w = wide ? 240 : 180, h = wide ? 120 : 180;
    addElements([{ t: 'sp', x: (deck.w - w) / 2, y: (deck.h - h) / 2, w, h, geom, adj: {},
      fill: { type: 'solid', color: '#9DB58C' }, line: { color: '#2F4A3A', width: 2 } }]);
  }

  async function addPictures(files, at) {
    const added = [];
    for (const f of files) {
      if (!/^image\//.test(f.type)) continue;
      const pic = await readPicture(f);
      if (!pic) continue;
      const k = Math.min(1, 480 / pic.w, 320 / pic.h);
      const w = pic.w * k, h = pic.h * k;
      const off = added.length * 20;
      const x = at ? at.x - w / 2 : (deck.w - w) / 2 + off;
      const y = at ? at.y - h / 2 : (deck.h - h) / 2 + off;
      added.push({ t: 'pic', x, y, w, h, geom: 'rect', media: pic.hash });
    }
    if (added.length) addElements(added);
  }

  async function replacePicture(file) {
    const i = sel[0];
    const e = cur().els[i];
    if (!e || e.t !== 'pic') return;
    const pic = await readPicture(file);
    if (!pic) return;
    change(() => {
      const x = ws().els[i];
      keepMark(x);
      x.media = pic.hash;
      delete x.crop;
    });
  }

  function blankText(algn, anchor) {
    return { anchor, ins: [10, 6, 10, 6], wrap: true,
      paras: [{ algn, runs: [{ t: '', sz: 28, font: 'Comic Sans MS', color: '#000000' }] }] };
  }

  // ---- selecting, moving and resizing -----------------------------------------

  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (editing && editing.txt.contains(e.target)) return;
    shapeMenu.hidden = true;
    linkBox.hidden = true;
    commitText();
    const handle = e.target.closest('.ed-h');
    if (handle) { e.preventDefault(); resizeDrag(e, handle.dataset.h); return; }
    const node = e.target.closest('.slide-stage > .el');
    if (!node) { e.preventDefault(); marquee(e); return; }
    e.preventDefault();
    const i = Number(node.dataset.i);
    const was = sel.includes(i);
    if (e.shiftKey || e.ctrlKey || e.metaKey) sel = was ? sel.filter((k) => k !== i) : sel.concat(i);
    else if (!was) sel = [i];
    paintSel();
    tools();
    if (sel.includes(i)) moveDrag(e, () => { if (was && !e.shiftKey && sel.length > 1) { sel = [i]; paintSel(); tools(); } });
  });

  canvas.addEventListener('dblclick', (e) => {
    const node = e.target.closest('.slide-stage > .el');
    if (!node || editing) return;
    editText(Number(node.dataset.i), e);
  });

  function track(e, move, up) {
    const id = e.pointerId;
    const onMove = (ev) => { if (ev.pointerId === id) move(ev); };
    const onUp = (ev) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      up(ev);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function moveDrag(e, clicked) {
    const start = point(e);
    const idx = sel.slice();
    const orig = idx.map((i) => ({ ...rect(cur().els[i]) }));
    const others = cur().els.filter((_, k) => !idx.includes(k)).map(rect);
    let began = false;
    track(e, (ev) => {
      const p = point(ev);
      let dx = p.x - start.x, dy = p.y - start.y;
      if (!began) {
        if (Math.hypot(dx, dy) * scale < 4) return;
        begin();
        began = true;
      }
      const g = bounds(orig.map((r) => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h })));
      const snap = ev.altKey ? { dx: 0, dy: 0, lines: [] } : snapTo(g, others);
      dx += snap.dx; dy += snap.dy;
      const s = ws();
      idx.forEach((i, k) => {
        s.els[i].x = orig[k].x + dx;
        s.els[i].y = orig[k].y + dy;
        const n = nodeOf(i);
        if (n) { n.style.left = s.els[i].x + 'px'; n.style.top = s.els[i].y + 'px'; }
      });
      paintSel();
      guides(snap.lines);
    }, () => {
      guides([]);
      if (began) commit(); else clicked();
    });
  }

  function resizeDrag(e, h) {
    const i = sel[0];
    const o = { ...rect(cur().els[i]) };
    const rot = (cur().els[i].rot || 0) * Math.PI / 180;
    const isPic = cur().els[i].t === 'pic';
    const start = point(e);
    let began = false;
    track(e, (ev) => {
      const p = point(ev);
      // Measure the drag along the element's own (possibly rotated) sides.
      const gx = p.x - start.x, gy = p.y - start.y;
      const dx = gx * Math.cos(rot) + gy * Math.sin(rot);
      const dy = -gx * Math.sin(rot) + gy * Math.cos(rot);
      if (!began) { if (Math.hypot(dx, dy) * scale < 2) return; begin(); began = true; }
      let { x, y, w, h: hh } = o;
      if (h.includes('e')) w = o.w + dx;
      if (h.includes('w')) { w = o.w - dx; x = o.x + dx; }
      if (h.includes('s')) hh = o.h + dy;
      if (h.includes('n')) { hh = o.h - dy; y = o.y + dy; }
      // Corners keep the shape of pictures; Shift does the same for anything.
      if (h.length === 2 && (isPic !== ev.shiftKey) && o.w && o.h) {
        const k = Math.max(w / o.w, hh / o.h);
        const nw = o.w * k, nh = o.h * k;
        if (h.includes('w')) x = o.x + o.w - nw;
        if (h.includes('n')) y = o.y + o.h - nh;
        w = nw; hh = nh;
      }
      if (w < MIN_SIZE) { if (h.includes('w')) x -= MIN_SIZE - w; w = MIN_SIZE; }
      if (hh < MIN_SIZE) { if (h.includes('n')) y -= MIN_SIZE - hh; hh = MIN_SIZE; }
      const s = ws();
      Object.assign(s.els[i], { x, y, w, h: hh });
      keepMark(s.els[i]);
      redrawNode(i);
      paintSel();
    }, () => { if (began) commit(); });
  }

  function marquee(e) {
    const start = point(e);
    const band = el('div', { class: 'ed-band' });
    let moved = false;
    track(e, (ev) => {
      const p = point(ev);
      if (!moved && Math.hypot(p.x - start.x, p.y - start.y) * scale < 4) return;
      if (!moved) { moved = true; overlay.appendChild(band); }
      place(band, norm(start, p));
    }, (ev) => {
      band.remove();
      if (moved) {
        const r = norm(start, point(ev));
        sel = cur().els.map((x, k) => [x, k]).filter(([x]) => x.x >= r.x && x.y >= r.y &&
          x.x + x.w <= r.x + r.w && x.y + x.h <= r.y + r.h).map(([, k]) => k);
      } else sel = [];
      paintSel();
      tools();
    });
  }

  function snapTo(g, others) {
    const tol = SNAP / scale;
    const xs = [0, deck.w / 2, deck.w], ys = [0, deck.h / 2, deck.h];
    for (const r of others) { xs.push(r.x, r.x + r.w / 2, r.x + r.w); ys.push(r.y, r.y + r.h / 2, r.y + r.h); }
    const best = (edges, targets) => {
      let hit = null;
      for (const a of edges) for (const t of targets) {
        const d = t - a;
        if (Math.abs(d) <= tol && (!hit || Math.abs(d) < Math.abs(hit.d))) hit = { d, at: t };
      }
      return hit;
    };
    const bx = best([g.x, g.x + g.w / 2, g.x + g.w], xs);
    const by = best([g.y, g.y + g.h / 2, g.y + g.h], ys);
    const lines = [];
    if (bx) lines.push({ x: bx.at });
    if (by) lines.push({ y: by.at });
    return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, lines };
  }

  function guides(lines) {
    for (const g of overlay.querySelectorAll('.ed-guide')) g.remove();
    for (const l of lines) {
      const g = el('div', { class: 'ed-guide' });
      if (l.x != null) place(g, { x: l.x, y: 0, w: 0, h: deck.h });
      else place(g, { x: 0, y: l.y, w: deck.w, h: 0 });
      overlay.appendChild(g);
    }
  }

  // ---- editing text -----------------------------------------------------------

  // fresh: the box was just added, so leaving it empty takes it away again.
  function editText(i, evt, fresh) {
    const e = cur().els[i];
    if (!e || e.t !== 'sp' || e.role === 'timer') return;
    if (!e.text) {
      change(() => { ws().els[i].text = blankText('ctr', 'ctr'); });
    }
    sel = [i];
    paintSel();
    const node = nodeOf(i);
    const txt = node && node.querySelector('.txt');
    if (!txt) return;
    node.classList.add('editing');
    txt.contentEditable = 'true';
    txt.spellcheck = true;
    editing = { i, txt, fresh };
    txt.focus();
    const range = evt && document.caretRangeFromPoint ? document.caretRangeFromPoint(evt.clientX, evt.clientY) : null;
    const selection = window.getSelection();
    selection.removeAllRanges();
    if (range && txt.contains(range.startContainer)) selection.addRange(range);
    else {
      const all = document.createRange();
      all.selectNodeContents(txt);
      if (textOfNode(txt)) selection.addRange(all);
      else { all.collapse(false); selection.addRange(all); }
    }
    txt.addEventListener('paste', (pe) => {
      pe.preventDefault();
      pe.stopPropagation();
      document.execCommand('insertText', false, pe.clipboardData.getData('text/plain'));
    });
    tools();
  }

  function commitText() {
    if (!editing) return;
    const { i, txt, fresh } = editing;
    editing = null;
    const e = cur().els[i];
    if (!e) { draw(); return; }
    const text = readText(txt, e.text);
    const empty = text.paras.every((p) => p.runs.every((r) => !r.t));
    const textBox = !e.fill && !e.line;
    if (!(empty && textBox) && JSON.stringify(text) === JSON.stringify(e.text)) { draw(); return; }
    if (empty && textBox && fresh) {
      sel = [];
      restore(undo.pop());
      return;
    }
    begin();
    const s = ws();
    if (empty && textBox) {
      s.els.splice(i, 1);
      sel = [];
    } else {
      s.els[i].text = text;
      keepMark(s.els[i]);
    }
    commit();
  }

  // ---- changing what is selected ------------------------------------------------

  // A color picker sends many changes while it is open; they undo as one.
  function setFill(color) {
    if (!sel.length) return;
    change(() => {
      const s = ws();
      for (const i of sel) {
        const e = s.els[i];
        if (e.t !== 'sp') continue;
        if (color) e.fill = { type: 'solid', color }; else delete e.fill;
      }
    }, 'fill');
  }

  function setLine(part) {
    if (!sel.length) return;
    change(() => {
      const s = ws();
      for (const i of sel) {
        const e = s.els[i];
        if (e.t !== 'sp') continue;
        if (part.width === 0) { delete e.line; continue; }
        e.line = Object.assign({ color: '#000000', width: 2 }, e.line, part);
      }
    }, 'line');
  }

  function setBackground(color) {
    change(() => { ws().bg = { type: 'solid', color }; }, 'bg');
  }

  function eachRun(fn) {
    const s = ws();
    for (const i of sel) {
      const e = s.els[i];
      if (!e.text || e.role === 'timer') continue;
      for (const p of e.text.paras) for (const r of p.runs) if (!r.br) fn(r, p);
      keepMark(e);
    }
  }

  function setRuns(props) {
    commitText();
    if (!sel.length) return;
    change(() => eachRun((r) => Object.assign(r, props)));
  }

  function resizeText(dir) {
    commitText();
    if (!sel.length) return;
    change(() => eachRun((r) => {
      const sz = r.sz || 18;
      r.sz = Math.max(6, Math.min(200, dir > 0 ? sz + (sz < 20 ? 2 : 4) : sz - (sz <= 20 ? 2 : 4)));
    }), 'size');
  }

  function toggleStyle(prop, command) {
    if (editing) { document.execCommand(command); return; }
    const run = firstRun(cur().els[sel.find((i) => cur().els[i].text)]);
    if (!run) return;
    setRuns({ [prop]: !run[prop] });
  }

  function setTextColor(color) {
    if (editing) { document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, color); return; }
    if (!sel.length) return;
    change(() => eachRun((r) => { r.color = color; }), 'tcolor');
  }

  function setAlign(a) {
    commitText();
    if (!sel.length) return;
    change(() => eachRun((r, p) => { p.algn = a; }));
  }

  function setMark(role) {
    const i = sel[0];
    change(() => { ws().els[i].mark = role || 'none'; });
  }

  function openLink() {
    const e = cur().els[sel[0]];
    if (!e) return;
    const l = e.link;
    linkInput.value = !l ? '' : l.slide != null ? String(l.slide + 1) : l.url || '';
    linkBox.hidden = false;
    linkInput.focus();
    linkInput.select();
  }

  function applyLink(remove) {
    const i = sel[0];
    const v = linkInput.value.trim();
    linkBox.hidden = true;
    let link = null;
    if (!remove && v) {
      if (/^\d+$/.test(v)) link = { slide: Math.max(0, Math.min(deck.slides.length - 1, Number(v) - 1)) };
      else link = { url: /^[a-z][\w+.-]*:/i.test(v) ? v : 'https://' + v };
      if (link.url && !/^https?:/i.test(link.url)) link = null;   // web addresses only
    }
    change(() => {
      const e = ws().els[i];
      if (link) e.link = link; else delete e.link;
    });
  }

  function restack(dir) {
    if (!sel.length) return;
    change(() => {
      const s = ws();
      const picked = sel.slice().sort((a, b) => a - b).map((i) => s.els[i]);
      const rest = s.els.filter((_, k) => !sel.includes(k));
      s.els = dir > 0 ? rest.concat(picked) : picked.concat(rest);
      sel = picked.map((p) => s.els.indexOf(p));
    });
  }

  function duplicate() {
    if (!sel.length) return;
    const copies = sel.slice().sort((a, b) => a - b).map((i) => {
      const c = structuredClone(cur().els[i]);
      c.x += 20; c.y += 20;
      return c;
    });
    addElements(copies);
  }

  function removeSelected() {
    if (!sel.length) return;
    change(() => {
      const s = ws();
      s.els = s.els.filter((_, k) => !sel.includes(k));
    });
    sel = [];
    paintSel();
    tools();
  }

  function nudge(dx, dy) {
    change(() => {
      const s = ws();
      for (const i of sel) { s.els[i].x += dx; s.els[i].y += dy; }
    }, 'nudge');
  }

  function copy(cut) {
    if (!sel.length) return;
    clip = sel.slice().sort((a, b) => a - b).map((i) => structuredClone(cur().els[i]));
    if (cut) removeSelected();
  }

  function paste() {
    if (!clip) return;
    // Pasting on the slide it came from shifts the copy so it doesn't hide the original.
    const same = clip.every((c) => cur().els.some((e) => e.x === c.x && e.y === c.y && e.w === c.w));
    const copies = clip.map((c) => {
      const x = structuredClone(c);
      if (same) { x.x += 20; x.y += 20; }
      return x;
    });
    addElements(copies);
  }

  // ---- slides -------------------------------------------------------------------

  /* Put the slides in a new order (some added or removed), and point every
     slide link at the same slide it pointed at before. */
  function restructure(next, nextIndex) {
    begin();
    const before = undo[undo.length - 1].slides;
    const target = (l) => {
      const t = before[l.slide];
      return t ? next.indexOf(t) : -1;
    };
    const holders = (slide) => {
      const out = [];
      for (const e of slide.els) {
        out.push(e);
        if (e.text) for (const p of e.text.paras) for (const r of p.runs) out.push(r);
      }
      return out.filter((h) => h.link && h.link.slide != null);
    };
    next.forEach((s, j) => {
      if (!holders(s).some((h) => target(h.link) !== h.link.slide)) return;
      const copy = structuredClone(s);
      for (const h of holders(copy)) {
        const ni = target(h.link);
        if (ni < 0) delete h.link; else h.link = { ...h.link, slide: ni };
      }
      next[j] = copy;
    });
    deck.slides = next;
    index = Math.max(0, Math.min(next.length - 1, nextIndex));
    sel = [];
    commit({ structural: true });
    history.replaceState(null, '', '#/deck/' + rec.id + '/edit/' + (index + 1));
  }

  function addSlide() {
    commitText();
    const s = { els: [], bg: cur().bg ? structuredClone(cur().bg) : null, notes: '', title: '' };
    const next = deck.slides.slice();
    next.splice(index + 1, 0, s);
    restructure(next, index + 1);
  }

  function duplicateSlide() {
    commitText();
    const s = structuredClone(cur());
    delete s.gid;
    const next = deck.slides.slice();
    next.splice(index + 1, 0, s);
    restructure(next, index + 1);
  }

  function deleteSlide() {
    commitText();
    if (deck.slides.length < 2) return;
    const next = deck.slides.slice();
    next.splice(index, 1);
    restructure(next, Math.min(index, next.length - 1));
  }

  function moveSlide(from, to) {
    if (from === to || to < 0 || to >= deck.slides.length) return;
    const next = deck.slides.slice();
    const [s] = next.splice(from, 1);
    next.splice(to, 0, s);
    restructure(next, to);
  }

  function toggleHidden() {
    begin();
    const s = ws();
    if (s.hidden) delete s.hidden; else s.hidden = true;
    commit();
  }

  // ---- keys, paste and drop -------------------------------------------------------

  function onKey(e) {
    const t = e.target;
    const typing = editing || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'));
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (editing && k === 'Escape') { e.preventDefault(); commitText(); return; }
    if (mod && !e.altKey && (k === 'z' || k === 'Z') && !(typing && !editing)) {
      if (editing) return;             // the browser undoes typing inside the box
      e.preventDefault();
      if (e.shiftKey) doRedo(); else doUndo();
      return;
    }
    if (mod && (k === 'y' || k === 'Y') && !typing) { e.preventDefault(); doRedo(); return; }
    if (editing && mod && ['b', 'i', 'u'].includes(k.toLowerCase())) {
      e.preventDefault();
      document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[k.toLowerCase()]);
      return;
    }
    if (typing) return;
    if (mod && (k === 'm' || k === 'M')) { e.preventDefault(); addSlide(); return; }
    if (mod && (k === 'd' || k === 'D')) { e.preventDefault(); duplicate(); return; }
    if (mod && (k === 'c' || k === 'C')) { copy(false); return; }
    if (mod && (k === 'x' || k === 'X')) { copy(true); return; }
    if (mod && (k === 'a' || k === 'A')) { e.preventDefault(); sel = cur().els.map((_, i) => i); paintSel(); tools(); return; }
    if (mod && ['b', 'i', 'u'].includes(k.toLowerCase()) && sel.length) {
      e.preventDefault();
      toggleStyle(k.toLowerCase(), '');
      return;
    }
    if (k === 'Escape') { if (!document.fullscreenElement) { sel = []; paintSel(); tools(); } return; }
    if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      if (sel.length) removeSelected();
      return;
    }
    if (k === 'Enter' && sel.length === 1) { e.preventDefault(); editText(sel[0]); return; }
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      if (!sel.length || mod) {
        const back = k === 'ArrowUp' || k === 'ArrowLeft';
        if (mod && !sel.length) moveSlide(index, index + (back ? -1 : 1));
        else go(index + (back ? -1 : 1));
        return;
      }
      const n = e.shiftKey ? NUDGE_BIG : NUDGE;
      nudge(k === 'ArrowLeft' ? -n : k === 'ArrowRight' ? n : 0, k === 'ArrowUp' ? -n : k === 'ArrowDown' ? n : 0);
      return;
    }
    if (k === 'PageDown') { e.preventDefault(); go(index + 1); }
    if (k === 'PageUp') { e.preventDefault(); go(index - 1); }
  }

  function onPaste(e) {
    const t = e.target;
    if (editing || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return;
    const files = [...(e.clipboardData ? e.clipboardData.files : [])].filter((f) => /^image\//.test(f.type));
    e.preventDefault();
    if (files.length) addPictures(files);
    else paste();
  }

  box.addEventListener('dragover', (e) => { if (dragFrom == null) { e.preventDefault(); e.stopPropagation(); } });
  box.addEventListener('drop', (e) => {
    if (dragFrom != null) return;
    e.preventDefault();
    e.stopPropagation();
    const files = [...e.dataTransfer.files].filter((f) => /^image\//.test(f.type));
    if (files.length) addPictures(files, point(e));
  });

  picker.addEventListener('change', () => { addPictures([...picker.files]); picker.value = ''; });
  replacer.addEventListener('change', () => { if (replacer.files[0]) replacePicture(replacer.files[0]); replacer.value = ''; });

  notes.addEventListener('input', () => {
    begin('notes:' + index);
    ws().notes = notes.value;
    commit({ redraw: false });
  });

  // ---- present and leave ------------------------------------------------------------

  function run() {
    commitText();
    flush();
    document.removeEventListener('keydown', onKey);
    present(rec, index, media, (at) => {
      document.addEventListener('keydown', onKey);
      go(at);
    }, findGoogle);
  }

  function leave() {
    if (!/\/edit/.test(location.hash) && root.isConnected) close();
  }

  function closeMenus(e) {
    if (!shapeMenu.hidden && !e.target.closest('.ed-anchor')) shapeMenu.hidden = true;
  }

  async function close() {
    commitText();
    await flush();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('paste', onPaste);
    refit.disconnect();
    window.removeEventListener('pagehide', flush);
    window.removeEventListener('hashchange', leave);
    document.removeEventListener('pointerdown', closeMenus);
    root.remove();
    document.body.classList.remove('editing-deck');
    if (onExit) onExit(index);
  }

  document.addEventListener('keydown', onKey);
  document.addEventListener('paste', onPaste);
  // The tool bar changes height with what is selected; keep the slide fitted.
  const refit = new ResizeObserver(() => fit());
  refit.observe(box);
  window.addEventListener('pagehide', flush);
  window.addEventListener('hashchange', leave);
  document.addEventListener('pointerdown', closeMenus);

  document.body.classList.add('editing-deck');
  document.body.appendChild(root);
  buildStrip();
  draw();
  return { close };
}

// ---- helpers --------------------------------------------------------------------------

function rect(e) { return { x: e.x, y: e.y, w: e.w, h: e.h }; }

function bounds(rs) {
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
}

function norm(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

function solid(fill) { return fill && fill.type === 'solid' ? toHex(fill.color) : null; }

function firstRun(e) {
  if (!e || !e.text) return null;
  for (const p of e.text.paras) for (const r of p.runs) if (!r.br && r.t) return r;
  for (const p of e.text.paras) for (const r of p.runs) if (!r.br) return r;
  return null;
}

function textOfNode(n) { return n.textContent.replace(/​/g, '').trim(); }

function toHex(c) {
  if (!c) return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map((x) => x + x).join('').toLowerCase();
  const m = String(c).match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
  return '#000000';
}

/* Turn an edited text box back into paragraphs and runs. Each run keeps the
   style of the run its words came from (the renderer tags them), plus any
   bold, italic, underline or color the toolbar added while typing. */
export function readText(txt, old) {
  const paras = [];
  let cur = null;
  const strip = (r) => { const o = Object.assign({}, r); delete o.t; delete o.br; return o; };
  const baseRun = (pi) => {
    const p = old.paras[pi] || old.paras[0];
    const r = p && (p.runs.find((x) => !x.br && x.t) || p.runs.find((x) => !x.br));
    return r ? strip(r) : { sz: 28, font: 'Comic Sans MS', color: '#000000' };
  };
  const startPara = (pd, pi) => {
    const src = old.paras[pi] || old.paras[old.paras.length - 1] || {};
    cur = Object.assign({}, src, { runs: [] });
    cur._pi = pi;
    const ta = pd && pd.style && pd.style.textAlign;
    if (ta) cur.algn = { left: 'l', start: 'l', center: 'ctr', right: 'r', end: 'r', justify: 'just' }[ta] || cur.algn;
    paras.push(cur);
  };
  const runFor = (node) => {
    const span = node.parentElement && node.parentElement.closest('[data-r]');
    let props;
    if (span && txt.contains(span)) {
      const pd = span.closest('[data-p]');
      const p = pd ? old.paras[Number(pd.dataset.p)] : null;
      const r = p && p.runs[Number(span.dataset.r)];
      props = r ? strip(r) : baseRun(cur._pi);
    } else props = baseRun(cur._pi);
    const chain = [];
    for (let n = node.parentElement; n && n !== txt; n = n.parentElement) chain.unshift(n);
    for (const n of chain) {
      const tag = n.tagName;
      if (tag === 'B' || tag === 'STRONG') props.b = true;
      if (tag === 'I' || tag === 'EM') props.i = true;
      if (tag === 'U') props.u = true;
      if (tag === 'S' || tag === 'STRIKE') props.strike = true;
      if (tag === 'FONT' && n.getAttribute('color')) props.color = toHex(n.getAttribute('color'));
      if (n.classList.contains('p')) continue;
      const st = n.style;
      if (n.dataset.r != null) {
        // The renderer writes a run's whole style on its span, and the browser
        // edits that style in place, so what is missing there was taken off.
        const deco = st.textDecorationLine || st.textDecoration || '';
        props.b = st.fontWeight === 'bold' || Number(st.fontWeight) >= 600;
        props.i = st.fontStyle === 'italic';
        props.u = /underline/.test(deco);
        props.strike = /line-through/.test(deco);
        if (st.color) props.color = toHex(st.color);
        continue;
      }
      if (st.fontWeight) props.b = st.fontWeight === 'bold' || Number(st.fontWeight) >= 600;
      if (st.fontStyle) props.i = st.fontStyle === 'italic';
      if (st.color) props.color = toHex(st.color);
      const deco = st.textDecorationLine || st.textDecoration;
      if (deco) { props.u = /underline/.test(deco); props.strike = /line-through/.test(deco); }
    }
    for (const key of ['b', 'i', 'u', 'strike']) if (!props[key]) delete props[key];
    return props;
  };
  const push = (run) => {
    const last = cur.runs[cur.runs.length - 1];
    if (last && !last.br && JSON.stringify(strip(last)) === JSON.stringify(strip(run))) last.t += run.t;
    else cur.runs.push(run);
  };
  const walk = (node) => {
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3) {
        const t = ch.data.replace(/​/g, '');
        if (!t) continue;
        if (!cur) startPara(null, 0);
        push(Object.assign(runFor(ch), { t }));
      } else if (ch.nodeType === 1) {
        if (ch.classList.contains('bu')) continue;
        if (ch.tagName === 'BR') { if (!cur) startPara(null, 0); cur.runs.push({ br: true }); continue; }
        if (ch.tagName === 'DIV' || ch.tagName === 'P') {
          startPara(ch, ch.dataset.p != null ? Number(ch.dataset.p) : (cur ? cur._pi : 0));
          walk(ch);
          continue;
        }
        walk(ch);
      }
    }
  };
  walk(txt);
  if (!paras.length) startPara(null, 0);
  for (const p of paras) {
    // A <br> at the end of a line only holds an empty line open.
    if (p.runs.length && p.runs[p.runs.length - 1].br) p.runs.pop();
    if (!p.runs.some((r) => !r.br)) p.runs.push(Object.assign(baseRun(p._pi), { t: '' }));
    delete p._pi;
  }
  return Object.assign({}, old, { paras });
}

async function readPicture(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let size;
  try {
    const bmp = await createImageBitmap(new Blob([bytes], { type: file.type }));
    size = { w: bmp.width, h: bmp.height };
    bmp.close();
  } catch (e) {
    window.alert(file.name + ' is not a picture this browser can show.');
    return null;
  }
  const d = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(d).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
  await store.putMedia(new Map([[hash, { bytes, type: file.type, name: file.name }]]));
  addMediaUrl(hash, new Blob([bytes], { type: file.type }));
  return { hash, w: size.w, h: size.h };
}
