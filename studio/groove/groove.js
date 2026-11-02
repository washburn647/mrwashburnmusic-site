/* Groove Lab: Musician Maker's backing grooves, made here on the site's sampled instruments.
   A groove is a loop of 8 or 16 beats on a 16th-note grid, in 2/4 (4 steps a beat) or 6/8
   (6 steps a dotted-quarter beat; the game plays these in compound units), in six layers: pulse, bass,
   drums, horns and band join as the combo grows (0, 3, 6, 10, 15 in a row), and breakdown
   plays alone in the breathers. Each layer holds tracks: a percussion sound (one row of steps)
   or a pitched instrument (a piano roll). The game plays grooves with the same code as here
   (musician-maker/sound.js), so what you hear is what the kids hear, at any tempo.
   Grooves are kept on this device (localStorage) with undo. "Save for site" downloads
   grooves.json for musician-maker/grooves.json (tools/add_grooves.py). */

import * as samples from '/assets/sounds/samples.js';
import * as snd from '/musician-maker/sound.js';
import { makeClock } from '/musician-maker/clock.js';
import { h, confirmButton } from '../dom.js';

const app = document.getElementById('app');
const KEY = 'mwm-groove-lab-1';
const LAYER_INFO = {
  pulse: { label: 'Pulse', when: 'Always playing' },
  bass: { label: 'Bass', when: 'Joins at combo 3' },
  drums: { label: 'Drums', when: 'Joins at combo 6' },
  horns: { label: 'Horns', when: 'Joins at combo 10' },
  band: { label: 'Band', when: 'Joins at combo 15' },
  breakdown: { label: 'Breakdown', when: 'Plays alone in the breathers' },
};
const HEAR = {
  pulse: 'Combo 0', bass: '3', drums: '6', horns: '10', band: '15', breakdown: 'Breather', solo: 'This layer',
};
const LENGTHS = { '2/4': { 1: '16th', 2: '8th', 4: 'Quarter', 8: 'Half' }, '6/8': { 1: '16th', 2: '8th', 4: 'Quarter', 6: 'Dotted quarter' } };
const VELS = { soft: 'Soft', normal: 'Normal', loud: 'Loud' };
const VEL = { soft: 0.45, normal: 0.8, loud: 1 };
const KEYS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const BLACK = [1, 3, 6, 8, 10];
const DEFAULT_TRACKS = { pulse: ['claves'], bass: ['bass'], drums: ['bass-drum', 'snare'], horns: ['horn'], band: ['tambourine'], breakdown: [] };

/* ---------- state ---------- */

let grooves = [];
let index = null; // samples index.json: instruments and their ranges
const settings = { groove: 'basic', layer: 'pulse', bpm: 108, hear: 'band', len: 1, vel: 'normal' };
const vel = () => VEL[settings.vel] || 0.8;
let past = [];
let future = [];
let status = '';

const whole = () => grooves.find((g) => g.id === settings.groove) || grooves[0];
// The version being edited: the groove in the meter picked (2/4 or 6/8), if it has one.
const now = () => whole()?.versions[settings.meter || '2/4'];
const isHit = (name) => index?.instruments[name]?.kind === 'hit';
const label = (name) => index?.instruments[name]?.label || name;
const per = (g) => snd.stepsPerBeat(g);
const steps = (g) => g.beats * per(g);

function store() {
  try { localStorage.setItem(KEY, JSON.stringify({ grooves, settings })); } catch { /* not kept */ }
}

/* Call before a change: keeps the state for undo. */
function snapshot() {
  past.push(JSON.stringify(grooves));
  if (past.length > 200) past.shift();
  future = [];
}

function changed() {
  store();
  render();
}

function undo(redo = false) {
  const from = redo ? future : past;
  if (!from.length) return;
  (redo ? past : future).push(JSON.stringify(grooves));
  grooves = JSON.parse(from.pop());
  changed();
  snd.useInstruments(grooves);
}

async function start() {
  try { index = await samples.list(); } catch (e) { app.textContent = `Couldn't load the sounds: ${e.message}`; return; }
  let kept = null;
  try { kept = JSON.parse(localStorage.getItem(KEY)); } catch { /* none */ }
  if (kept?.grooves?.length) {
    grooves = snd.checkGrooves(kept.grooves);
    Object.assign(settings, kept.settings || {});
  } else {
    grooves = await snd.loadGrooves();
    grooves = structuredClone(grooves);
  }
  if (!grooves.length) grooves = [blank('My groove')];
  render();
}

function emptyVersion(meter, beats = 8) {
  return {
    meter,
    beats,
    swing: 0,
    layers: Object.fromEntries(snd.ALL_LAYERS.map((l) => [l, DEFAULT_TRACKS[l].map((inst) => ({ inst, vol: 1, notes: [] }))])),
  };
}

function blank(name) {
  const meter = settings.meter || '2/4';
  return { id: `g-${Date.now().toString(36)}`, name, key: 5, versions: { [meter]: emptyVersion(meter) } };
}

/* ---------- playback ---------- */

let clock = null;
let playing = false;
let startT = 0;
let ctx = null;

function hearLayers() {
  if (settings.hear === 'solo') return [settings.layer];
  if (settings.hear === 'breakdown') return ['breakdown'];
  return snd.LAYERS.slice(0, snd.LAYERS.indexOf(settings.hear) + 1);
}

async function audio() {
  ctx = snd.ac();
  if (ctx.state === 'suspended') await ctx.resume();
  return ctx;
}

async function play() {
  await audio();
  if (!clock) {
    clock = makeClock(ctx);
    clock.onBeat((i, t, spb) => { const g = now(); if (g) snd.playGrooveBeat(g, i, t, spb, { layers: hearLayers() }); });
  }
  await snd.useInstruments([now()]);
  startT = ctx.currentTime + 0.1;
  clock.start(startT, settings.bpm);
  playing = true;
  render();
  requestAnimationFrame(tick);
}

function stop() {
  clock?.stop();
  playing = false;
  render();
}

// The playhead: the step sounding now.
let head = -1;
function tick() {
  if (!playing) { head = -1; drawAll(); return; }
  const beats = (ctx.currentTime - snd.latency() - startT) / (60 / settings.bpm);
  const g = now();
  const step = beats < 0 ? -1 : Math.floor(beats * per(g)) % steps(g);
  if (step !== head) { head = step; drawAll(); }
  requestAnimationFrame(tick);
}

function preview(tr, m) {
  audio().then(() => {
    const t = ctx.currentTime + 0.01;
    if (m == null) snd.hit(tr.inst, t, tr.vol * vel());
    else snd.note(tr.inst, m, t, 0.3, tr.vol * vel() * 0.5);
  });
}

/* ---------- page ---------- */

function seg(options, value, onpick, titles = {}) {
  return h('span', { class: 'seg' }, Object.entries(options).map(([v, text]) =>
    h('button', { class: String(v) === String(value) ? 'on' : '', title: titles[v] || null, onclick: () => onpick(v) }, text)));
}

const canvases = [];

function render() {
  const G = whole();
  if (!G) return;
  const g = now();
  if (!g) { renderMissing(G); return; }
  canvases.length = 0;
  const restore = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: () => { restoreFile(restore.files[0]); restore.value = ''; } });
  const layer = settings.layer;
  const tracks = g.layers[layer];
  const hits = tracks.filter((tr) => isHit(tr.inst));
  const pitched = tracks.filter((tr) => !isHit(tr.inst));
  const count = (l) => g.layers[l].reduce((n, tr) => n + tr.notes.length, 0);

  app.replaceChildren(...[
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '‹ Studio')),
    h('div', { class: 'bar' },
      h('h1', { class: 'grow' }, 'Groove Lab', h('small', {}, ' Musician Maker')),
      h('button', { onclick: () => restore.click() }, 'Restore'),
      restore,
      h('button', { class: 'primary', onclick: saveForSite }, 'Save for site'),
    ),
    h('div', { class: 'bar' },
      h('select', { class: 'pick', onchange: (e) => { settings.groove = e.target.value; store(); render(); } },
        grooves.map((x) => h('option', { value: x.id, selected: x.id === G.id }, `${x.name} · ${Object.keys(x.versions).join(' + ')}`))),
      h('input', { class: 'name', value: G.name, 'aria-label': 'Groove name', onchange: (e) => { snapshot(); G.name = e.target.value.trim() || G.name; changed(); } }),
      h('button', { onclick: () => { snapshot(); const x = blank('New groove'); grooves.push(x); settings.groove = x.id; changed(); } }, 'New'),
      h('button', { onclick: () => { snapshot(); const x = { ...structuredClone(G), id: `g-${Date.now().toString(36)}`, name: `${G.name} copy` }; grooves.push(x); settings.groove = x.id; changed(); } }, 'Copy'),
      grooves.length > 1 ? confirmButton('Delete', 'Delete?', () => { snapshot(); grooves = grooves.filter((x) => x !== G); settings.groove = grooves[0].id; changed(); }) : null,
      h('span', { class: 'grow' }),
      h('button', { class: 'icon', title: 'Undo (Ctrl+Z)', disabled: !past.length, onclick: () => undo() }, '↶ Undo'),
      h('button', { class: 'icon', title: 'Redo (Ctrl+Shift+Z)', disabled: !future.length, onclick: () => undo(true) }, '↷ Redo'),
    ),
    h('div', { class: 'bar transport' },
      h('button', { class: `primary play${playing ? ' on' : ''}`, onclick: () => (playing ? stop() : play()) }, playing ? '■ Stop' : '▶ Play'),
      h('span', { class: 'label' }, 'Tempo'),
      seg({ 92: '92', 108: '108', 126: '126' }, settings.bpm, (v) => { settings.bpm = Number(v); store(); if (playing) play(); else render(); }),
      h('span', { class: 'label' }, 'Hear'),
      seg(HEAR, settings.hear, (v) => { settings.hear = v; store(); render(); },
        { pulse: 'Pulse only, like the start of a run', bass: 'Pulse and bass', drums: 'Up to drums', horns: 'Up to horns', band: 'Every layer: the full band', breakdown: 'The breakdown, as in a breather', solo: 'Only the layer you are editing' }),
    ),
    h('div', { class: 'bar' },
      h('span', { class: 'label' }, 'Meter'),
      meterSeg(G),
      Object.keys(G.versions).length > 1 ? confirmButton(`Remove ${g.meter}`, 'Remove?', () => { snapshot(); delete G.versions[g.meter]; settings.meter = Object.keys(G.versions)[0]; changed(); }) : null,
      h('span', { class: 'label' }, 'Length'),
      seg({ 8: '8 beats', 16: '16 beats' }, g.beats, (v) => setLength(g, Number(v))),
      g.meter === '6/8' ? null : h('label', {}, 'Swing', h('input', { type: 'range', min: 0, max: 100, value: Math.round(g.swing * 100), onchange: (e) => { snapshot(); g.swing = Number(e.target.value) / 100; changed(); } }),
        h('span', { class: 'total' }, `${Math.round(g.swing * 100)}%`)),
      keySelect(G),
    ),
    h('div', { class: 'bar layers' }, snd.ALL_LAYERS.map((l) => h('button', {
      class: l === layer ? 'on' : '',
      onclick: () => { settings.layer = l; store(); render(); },
    }, h('b', {}, LAYER_INFO[l].label), h('small', {}, `${LAYER_INFO[l].when} · ${count(l)} notes`)))),
    h('div', { class: 'bar brush' },
      h('span', { class: 'label' }, 'Note'),
      seg(LENGTHS[g.meter], settings.len, (v) => { settings.len = Number(v); store(); render(); }),
      seg(VELS, settings.vel, (v) => { settings.vel = v; store(); render(); }),
      h('span', { class: 'grow' }),
      addSound(g, layer),
      tracks.length ? confirmButton('Clear layer', 'Clear?', () => { snapshot(); tracks.forEach((tr) => { tr.notes = []; }); changed(); }) : null,
    ),
    hits.length ? hitCard(g, hits) : null,
    ...pitched.map((tr) => rollCard(g, tr)),
    tracks.length ? null : h('p', { class: 'empty' }, `No sounds in ${LAYER_INFO[layer].label.toLowerCase()} yet. Add one above.`),
    h('p', { class: 'hint' }, 'Click a step to add a note, drag to make it longer, click a note to remove it. Space plays and stops.'),
    status ? h('p', { class: 'status' }, status) : null,
  ].filter(Boolean));
  requestAnimationFrame(() => { drawAll(); centerRolls(); });
}

function addSound(g, layer) {
  const list = Object.entries(index.instruments);
  return h('select', { class: 'add', onchange: (e) => {
    const inst = e.target.value;
    if (!inst) return;
    snapshot();
    g.layers[layer].push({ inst, vol: 1, notes: [] });
    snd.useInstruments([g]);
    changed();
  } },
  h('option', { value: '' }, '+ Add a sound…'),
  h('optgroup', { label: 'Drum kit' }, list.filter(([, s]) => s.group === 'kit').map(([n, s]) => h('option', { value: n }, s.label))),
  h('optgroup', { label: 'Percussion' }, list.filter(([, s]) => s.kind === 'hit' && s.group !== 'kit').map(([n, s]) => h('option', { value: n }, s.label))),
  h('optgroup', { label: 'Instruments' }, list.filter(([, s]) => s.kind !== 'hit').map(([n, s]) => h('option', { value: n }, s.label))));
}

function trackTools(g, tr, kind) {
  const list = Object.entries(index.instruments).filter(([, s]) => (s.kind === 'hit') === (kind === 'hit'));
  return [
    h('select', { onchange: (e) => { snapshot(); tr.inst = e.target.value; snd.useInstruments([g]); changed(); } },
      list.map(([n, s]) => h('option', { value: n, selected: n === tr.inst }, s.label))),
    h('input', { type: 'range', min: 0, max: 150, value: Math.round(tr.vol * 100), title: 'Volume',
      onchange: (e) => { snapshot(); tr.vol = Number(e.target.value) / 100; changed(); } }),
    h('button', { class: 'icon', title: 'Remove this sound', onclick: () => {
      snapshot();
      const list2 = g.layers[settings.layer];
      list2.splice(list2.indexOf(tr), 1);
      changed();
    } }, '×'),
  ];
}

/* ---------- grids ---------- */

const GUTTER = 44;
const HIT_ROW = 40;
const ROLL_ROW = 15;

function cellWidth(g, wrapWidth) {
  return Math.max(12, Math.floor((wrapWidth - GUTTER - 2) / steps(g)));
}

function makeCanvas(wrap, rows, rowH, draw, onDown) {
  const canvas = h('canvas', { class: 'grid' });
  const item = { canvas, wrap, rows, rowH, draw, cw: 16 };
  canvas.addEventListener('pointerdown', (e) => onDown(e, item));
  canvases.push(item);
  return canvas;
}

function sizeCanvas(item, g) {
  const width = item.wrap.clientWidth || 800;
  item.cw = cellWidth(g, width);
  const w = GUTTER + steps(g) * item.cw;
  const hgt = item.rows * item.rowH;
  const dpr = window.devicePixelRatio || 1;
  if (item.canvas.width !== Math.round(w * dpr) || item.canvas.height !== Math.round(hgt * dpr)) {
    item.canvas.width = Math.round(w * dpr);
    item.canvas.height = Math.round(hgt * dpr);
    item.canvas.style.width = `${w}px`;
    item.canvas.style.height = `${hgt}px`;
  }
  const c = item.canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return c;
}

function drawAll() {
  const g = now();
  if (!g) return;
  for (const item of canvases) item.draw(sizeCanvas(item, g), item, g);
}
window.addEventListener('resize', () => drawAll());

/* Columns: shaded by bar of 2/4, lines on 16ths, beats and bars, and the playhead. */
function columns(c, item, g, hgt) {
  const n = steps(g);
  for (let s = 0; s < n; s++) {
    const x = GUTTER + s * item.cw;
    c.fillStyle = Math.floor(s / (per(g) * 2)) % 2 ? '#F3EEE1' : '#FFFFFF';
    if (s === head) c.fillStyle = '#E3EEDC';
    c.fillRect(x, 0, item.cw, hgt);
  }
  for (let s = 0; s <= n; s++) {
    const x = GUTTER + s * item.cw + 0.5;
    // Bar, beat, then the 8ths of a 6/8 beat, then 16ths.
    c.strokeStyle = s % (per(g) * 2) === 0 ? '#9AA79C' : s % per(g) === 0 ? '#C9CFC4' : g.meter === '6/8' && s % 2 === 0 ? '#DCD8CB' : '#EFEBE0';
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, hgt);
    c.stroke();
  }
}

function noteFill(v) {
  return `rgba(47, 74, 58, ${0.35 + 0.65 * Math.min(1, v ?? 0.8)})`;
}

function hitCard(g, hits) {
  const wrap = h('div', { class: 'gridwrap' });
  const heads = h('div', { class: 'heads' }, hits.map((tr) => h('div', { class: 'head', style: `height:${HIT_ROW}px` }, trackTools(g, tr, 'hit'))));
  wrap.append(makeCanvas(wrap, hits.length, HIT_ROW, (c, item) => {
    const hgt = item.rows * item.rowH;
    c.clearRect(0, 0, GUTTER + steps(g) * item.cw, hgt);
    columns(c, item, g, hgt);
    hits.forEach((tr, r) => {
      const y = r * HIT_ROW;
      c.strokeStyle = '#E4DCC8';
      c.beginPath();
      c.moveTo(0, y + HIT_ROW - 0.5);
      c.lineTo(GUTTER + steps(g) * item.cw, y + HIT_ROW - 0.5);
      c.stroke();
      for (const n of tr.notes) {
        c.fillStyle = noteFill(n.v);
        const pad = Math.max(2, item.cw * 0.12);
        c.beginPath();
        c.roundRect(GUTTER + n.s * item.cw + pad, y + 6, item.cw - pad * 2, HIT_ROW - 12, 4);
        c.fill();
      }
    });
  }, (e, item) => {
    const at = cellAt(e, item);
    if (!at) return;
    const tr = hits[at.row];
    if (!tr) return;
    snapshot();
    const had = tr.notes.some((n) => n.s === at.col);
    const set = (col) => {
      const i = tr.notes.findIndex((n) => n.s === col);
      if (had && i >= 0) tr.notes.splice(i, 1);
      if (!had && i < 0) { tr.notes.push({ s: col, v: vel() }); preview(tr, null); }
      tr.notes.sort((a, b) => a.s - b.s);
      drawAll();
    };
    set(at.col);
    drag(e, item, (a) => { if (a.row === at.row) set(a.col); });
  }));
  return h('section', { class: 'card' }, h('div', { class: 'card-top' }, h('h2', {}, 'Percussion')), h('div', { class: 'split' }, heads, wrap));
}

function range(tr) {
  const zones = index.instruments[tr.inst]?.zones || [];
  let lo = Math.min(...zones.map((z) => z.midi), ...tr.notes.map((n) => n.m));
  let hi = Math.max(...zones.map((z) => z.midi), ...tr.notes.map((n) => n.m));
  if (!Number.isFinite(lo)) { lo = 36; hi = 84; }
  return { lo: Math.max(0, lo - 2), hi: Math.min(127, hi + 2) };
}

function rollCard(g, tr) {
  const { lo, hi } = range(tr);
  const rows = hi - lo + 1;
  const wrap = h('div', { class: 'gridwrap roll', onscroll: () => scrolls.set(tr, wrap.scrollTop) });
  rollCenter.set(wrap, { tr, y: (hi - (tr.notes.length ? Math.round(tr.notes.reduce((a, n) => a + n.m, 0) / tr.notes.length) : Math.round((lo + hi) / 2))) * ROLL_ROW });
  const rowOf = (m) => hi - m;
  wrap.append(makeCanvas(wrap, rows, ROLL_ROW, (c, item) => {
    const hgt = rows * ROLL_ROW;
    const w = GUTTER + steps(g) * item.cw;
    c.clearRect(0, 0, w, hgt);
    columns(c, item, g, hgt);
    for (let m = hi; m >= lo; m--) {
      const y = rowOf(m) * ROLL_ROW;
      const pc = ((m % 12) + 12) % 12;
      const deg = (pc - whole().key + 12) % 12;
      if (!MAJOR.includes(deg)) { c.fillStyle = 'rgba(47,74,58,.07)'; c.fillRect(GUTTER, y, w - GUTTER, ROLL_ROW); }
      if (deg === 0) { c.fillStyle = 'rgba(233,180,76,.16)'; c.fillRect(GUTTER, y, w - GUTTER, ROLL_ROW); }
      c.fillStyle = BLACK.includes(pc) ? '#3E5446' : '#FBF8F0';
      c.fillRect(0, y, GUTTER - 2, ROLL_ROW);
      c.fillStyle = BLACK.includes(pc) ? '#F6F1E4' : '#5B6B5F';
      c.font = `${pc === 0 ? 600 : 400} 10px Fredoka, sans-serif`;
      c.fillText(`${NAMES[pc]}${Math.floor(m / 12) - 1}`, 4, y + ROLL_ROW - 4);
      c.strokeStyle = pc === 0 ? '#C9CFC4' : '#EFEBE0';
      c.beginPath();
      c.moveTo(GUTTER, y + ROLL_ROW - 0.5);
      c.lineTo(w, y + ROLL_ROW - 0.5);
      c.stroke();
    }
    for (const n of tr.notes) {
      c.fillStyle = noteFill(n.v);
      c.beginPath();
      c.roundRect(GUTTER + n.s * item.cw + 1, rowOf(n.m) * ROLL_ROW + 1, Math.max(1, n.l || 1) * item.cw - 2, ROLL_ROW - 2, 3);
      c.fill();
    }
  }, (e, item) => {
    const at = cellAt(e, item);
    if (!at) return;
    const m = hi - at.row;
    snapshot();
    const hitNote = (col, mm) => tr.notes.findIndex((n) => n.m === mm && col >= n.s && col < n.s + (n.l || 1));
    const i = hitNote(at.col, m);
    if (i >= 0) {
      // Erase: this note and any dragged over.
      tr.notes.splice(i, 1);
      drawAll();
      drag(e, item, (a) => { const j = hitNote(a.col, hi - a.row); if (j >= 0) { tr.notes.splice(j, 1); drawAll(); } });
      return;
    }
    const n = { s: at.col, m, l: Math.min(settings.len, steps(g) - at.col), v: vel() };
    tr.notes.push(n);
    tr.notes.sort((a, b) => a.s - b.s || a.m - b.m);
    preview(tr, m);
    drawAll();
    drag(e, item, (a) => {
      const l = Math.max(1, Math.min(steps(g) - n.s, a.col - n.s + 1));
      if (l !== n.l) { n.l = l; drawAll(); }
    }, true);
  }));
  return h('section', { class: 'card' },
    h('div', { class: 'card-top' }, h('h2', {}, label(tr.inst)), h('span', { class: 'grow' }), trackTools(g, tr, 'pitched')),
    wrap);
}

function cellAt(e, item) {
  const r = item.canvas.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  if (x < GUTTER) return null;
  const col = Math.floor((x - GUTTER) / item.cw);
  const row = Math.floor(y / item.rowH);
  if (col < 0 || col >= steps(now()) || row < 0 || row >= item.rows) return null;
  return { col, row };
}

/* Follows the pointer until it lifts, calling move with each new cell; saves at the end. */
function drag(e, item, move, anyCell = false) {
  e.preventDefault();
  item.canvas.setPointerCapture(e.pointerId);
  let last = cellAt(e, item);
  const onMove = (ev) => {
    const r = item.canvas.getBoundingClientRect();
    const col = Math.max(0, Math.min(steps(now()) - 1, Math.floor((ev.clientX - r.left - GUTTER) / item.cw)));
    const row = Math.floor((ev.clientY - r.top) / item.rowH);
    const at = anyCell ? { col, row } : cellAt(ev, item);
    if (!at || (last && at.col === last.col && at.row === last.row)) return;
    last = at;
    move(at);
  };
  const onUp = () => {
    item.canvas.removeEventListener('pointermove', onMove);
    item.canvas.removeEventListener('pointerup', onUp);
    item.canvas.removeEventListener('pointercancel', onUp);
    changed();
  };
  item.canvas.addEventListener('pointermove', onMove);
  item.canvas.addEventListener('pointerup', onUp);
  item.canvas.addEventListener('pointercancel', onUp);
}

// Piano rolls open scrolled to their notes (or the middle of the instrument), then keep
// where they were scrolled to.
const scrolls = new WeakMap(); // track → scrollTop
const rollCenter = new WeakMap(); // wrap → { tr, y }
function centerRolls() {
  for (const wrap of app.querySelectorAll('.gridwrap.roll')) {
    const { tr, y } = rollCenter.get(wrap) || {};
    if (!tr) continue;
    wrap.scrollTop = scrolls.has(tr) ? scrolls.get(tr) : Math.max(0, y - wrap.clientHeight / 2);
  }
}

/* A groove's other-meter version, started from this one: each note keeps its beat and its
   place in the beat as near as the new grid allows (an 8th stays an 8th: 2 of 4 steps ↔ 3 of
   6), so bars, chords and instruments carry over, ready to reshape. */
function convert(v, meter) {
  const from = per(v);
  const to = meter === '6/8' ? 6 : 4;
  const out = structuredClone(v);
  out.meter = meter;
  out.swing = 0;
  for (const tracks of Object.values(out.layers)) {
    for (const tr of tracks) {
      const seen = new Set();
      tr.notes = tr.notes.map((n) => {
        const s = Math.floor(n.s / from) * to + Math.round((n.s % from) * to / from);
        return { ...n, s: Math.min(s, v.beats * to - 1), ...(n.l ? { l: Math.max(1, Math.round(n.l * to / from)) } : {}) };
      }).filter((n) => { const k = `${n.s}:${n.m}`; if (seen.has(k)) return false; seen.add(k); return true; });
    }
  }
  return out;
}

function meterSeg(G) {
  const labels = Object.fromEntries(Object.entries(snd.METERS).map(([m, text]) => [m, G.versions[m] ? text : `${text} +`]));
  return seg(labels, settings.meter || '2/4', (m) => {
    settings.meter = m;
    if (!LENGTHS[m][settings.len]) settings.len = 1;
    store();
    if (playing) stop();
    render();
  }, { '2/4': 'Edit the 2/4 version', '6/8': 'Edit the 6/8 version' });
}

function keySelect(G) {
  return h('label', {}, 'Key', h('select', { onchange: (e) => { snapshot(); G.key = Number(e.target.value); changed(); } },
    KEYS.map((k, i) => h('option', { value: i, selected: i === G.key }, `${k} major`))));
}

/* The groove has no version in this meter yet: start one. */
function renderMissing(G) {
  canvases.length = 0;
  const meter = settings.meter || '2/4';
  const other = Object.values(G.versions)[0];
  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '‹ Studio')),
    h('div', { class: 'bar' }, h('h1', { class: 'grow' }, 'Groove Lab', h('small', {}, ' Musician Maker'))),
    h('div', { class: 'bar' },
      h('select', { class: 'pick', onchange: (e) => { settings.groove = e.target.value; store(); render(); } },
        grooves.map((x) => h('option', { value: x.id, selected: x.id === G.id }, `${x.name} · ${Object.keys(x.versions).join(' + ')}`))),
      h('span', { class: 'label' }, 'Meter'),
      meterSeg(G)),
    h('section', { class: 'card missing' },
      h('h2', {}, `${G.name} has no ${meter} version yet`),
      h('p', {}, `The game plays the ${meter} version in ${meter} units, and switches to it when a review item from a ${meter} unit comes up. Keep the same instruments and chords as the ${other.meter} version so the switch sounds like the same band.`),
      h('div', { class: 'bar' },
        h('button', { class: 'primary', onclick: () => { snapshot(); G.versions[meter] = convert(other, meter); changed(); } }, `Start from the ${other.meter} version`),
        h('button', { onclick: () => { snapshot(); G.versions[meter] = emptyVersion(meter, other.beats); changed(); } }, 'Start empty'))),
  );
}

/* 8 → 16 beats repeats the loop into the new half; 16 → 8 keeps the first half. */
function setLength(g, beats) {
  if (beats === g.beats) return;
  snapshot();
  const n = beats * per(g);
  for (const tracks of Object.values(g.layers)) {
    for (const tr of tracks) {
      if (beats > g.beats) {
        const old = g.beats * per(g);
        const copies = [];
        for (let k = 1; k * old < n; k++) copies.push(...tr.notes.map((x) => ({ ...x, s: x.s + k * old })));
        tr.notes.push(...copies.filter((x) => x.s < n));
      } else {
        tr.notes = tr.notes.filter((x) => x.s < n);
        for (const x of tr.notes) if (x.l) x.l = Math.min(x.l, n - x.s);
      }
    }
  }
  g.beats = beats;
  changed();
}

/* ---------- save for site, restore ---------- */

function saveForSite() {
  const text = `{"grooves":[\n${snd.checkGrooves(grooves).map((g) => JSON.stringify(g)).join(',\n')}\n]}\n`;
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: 'grooves.json', hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  status = `Downloaded grooves.json with ${grooves.length} groove${grooves.length === 1 ? '' : 's'}. Upload it to the Musician Maker project to put it in the game.`;
  render();
}

async function restoreFile(file) {
  if (!file) return;
  try {
    const list = snd.checkGrooves(JSON.parse(await file.text()).grooves);
    if (!list.length) throw new Error('no grooves in that file');
    snapshot();
    for (const g of list) {
      const i = grooves.findIndex((x) => x.id === g.id);
      if (i >= 0) grooves[i] = g;
      else grooves.push(g);
    }
    settings.groove = list[0].id;
    status = `Restored ${list.length} groove${list.length === 1 ? '' : 's'}.`;
    changed();
  } catch (e) {
    status = `Couldn't restore: ${e.message}`;
    render();
  }
}

/* ---------- keys ---------- */

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(true); return; }
  if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); if (playing) stop(); else play(); }
});

start();
