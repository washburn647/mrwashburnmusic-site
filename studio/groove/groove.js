/* Groove Lab: Musician Maker's backing grooves, made here on the site's sampled instruments.
   A groove is a loop of 8 or 16 beats on a 16th-note grid, in 2/4 (4 steps a beat) or 6/8
   (6 steps a dotted-quarter beat; the game plays these in compound units), in six layers: pulse, bass,
   drums, horns and band join as the combo grows (0, 3, 6, 10, 15 in a row), and breakdown
   plays alone in the breathers. Each layer holds tracks: a percussion sound (one row of steps)
   or a pitched instrument (a piano roll). Each groove names its layers and picks their icons
   (the game's band seats show them), and a layer can have variations: other takes, each with
   its own chance of playing in place of the main one each time round the loop. The game plays grooves with the same code as here
   (musician-maker/sound.js), so what you hear is what the kids hear, at any tempo.
   Grooves are kept on this device (localStorage) with undo. "Save for site" downloads
   grooves.json for musician-maker/grooves.json (tools/add_grooves.py). */

import * as samples from '/assets/sounds/samples.js';
import * as snd from '/musician-maker/sound.js';
import { makeClock } from '/musician-maker/clock.js';
import { h, confirmButton } from '../dom.js';

const app = document.getElementById('app');
const KEY = 'mwm-groove-lab-1';
// When each layer plays. Its name and icon are the groove's own (snd.layerInfo).
const WHEN = {
  pulse: 'Always playing', bass: 'Joins at combo 3', drums: 'Joins at combo 6',
  horns: 'Joins at combo 10', band: 'Joins at combo 15', breakdown: 'Plays alone in breathers',
};
// Icons to pick from for a layer's seat in the game (any emoji can be typed in too).
const ICONS = ['🎸', '🪕', '🎻', '🥁', '🪘', '🪇', '🎺', '🎷', '🪈', '🎹', '🪗', '🎤', '🔔', '🥢', '👏', '🎵',
  '🎶', '🌙', '⭐', '🔥', '🐭', '🐱', '🧀', '🦁', '🐸', '🐦', '🚀', '🌊', '🌵', '🍕', '👑', '💎'];
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
const settings = { groove: 'basic', layer: 'pulse', variant: -1, roll: false, bpm: 108, hear: 'band', len: 1, vel: 'normal' };
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
// The variations of a layer in a version, and the tracks being edited: the main take, or the
// variation picked under the layer's tab.
const variantsOf = (g, layer) => g.variants?.[layer] || [];
const editing = (g) => variantsOf(g, settings.layer)[settings.variant] || null;
const editTracks = (g) => editing(g)?.tracks || g.layers[settings.layer];
// Every track list in a version: main takes and variations (for length and meter changes).
const allTracks = (g) => [...Object.values(g.layers), ...Object.values(g.variants || {}).flat().map((v) => v.tracks)];
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
    clock.onBeat((i, t, spb) => {
      const g = now();
      if (!g) return;
      // The layer being edited plays the take being edited; with "Roll variations" on, every
      // layer rolls its variations as in the game.
      const force = settings.roll ? null : Object.fromEntries(snd.ALL_LAYERS.map((l) => [l, l === settings.layer ? settings.variant : -1]));
      snd.playGrooveBeat(g, i, t, spb, { layers: hearLayers(), force });
    });
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
  if (!editing(g)) settings.variant = -1;
  const tracks = editTracks(g);
  const info = (l) => snd.layerInfo(G, l);
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
      h('label', { title: 'Off: the layer you are editing plays the take you picked. On: every layer rolls its variations each time round, as in the game.' },
        h('input', { type: 'checkbox', checked: settings.roll, onchange: (e) => { settings.roll = e.target.checked; store(); } }), 'Roll variations'),
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
    layerColumns(G, g, count),
    layerSettings(G, g),
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
    tracks.length ? null : h('p', { class: 'empty' }, `No sounds in ${info(layer).name}${editing(g) ? ` variation ${settings.variant + 1}` : ''} yet. Add one above.`),
    h('p', { class: 'hint' }, 'Click a step to add a note and drag to make it longer. Drag a note\'s right end to stretch or shorten it, drag the rest of it to move it, click it to remove it. Space plays and stops.'),
    status ? h('p', { class: 'status' }, status) : null,
  ].filter(Boolean));
  requestAnimationFrame(() => { drawAll(); centerRolls(); });
}

/* The six layers side by side: each column is the layer's tab (its main take) with its
   variations below it and a button to add one. */
function layerColumns(G, g, count) {
  const pick = (l, v) => { settings.layer = l; settings.variant = v; store(); render(); };
  const notes = (tracks) => tracks.reduce((n, tr) => n + tr.notes.length, 0);
  return h('div', { class: 'layers' }, snd.ALL_LAYERS.map((l) => {
    const info = snd.layerInfo(G, l);
    const vars = variantsOf(g, l);
    return h('div', { class: 'layer-col' },
      h('button', { class: `layer-tab${l === settings.layer && settings.variant < 0 ? ' on' : ''}`, onclick: () => pick(l, -1) },
        h('span', { class: 'ic' }, info.icon), h('b', {}, info.name), h('small', {}, `${WHEN[l]} · ${count(l)} notes`)),
      ...vars.map((v, k) => h('button', {
        class: `variant${l === settings.layer && settings.variant === k ? ' on' : ''}`,
        title: `Plays in place of the main ${info.name} ${Math.round(v.chance * 100)}% of the times round the loop`,
        onclick: () => pick(l, k),
      }, `Variation ${k + 1}`, h('small', {}, ` · ${Math.round(v.chance * 100)}% · ${notes(v.tracks)} notes`))),
      h('button', { class: 'variant add-var', title: `Another take on ${info.name}, starting as a copy of the main one`, onclick: () => {
        snapshot();
        g.variants ||= {};
        (g.variants[l] ||= []).push({ chance: 0.25, tracks: structuredClone(g.layers[l]) });
        settings.layer = l;
        settings.variant = g.variants[l].length - 1;
        changed();
      } }, '+ Variation'));
  }));
}

/* The picked layer's name and game icon (the groove's own), and the picked variation's chance. */
function layerSettings(G, g) {
  const l = settings.layer;
  const info = snd.layerInfo(G, l);
  const setInfo = (key, value) => {
    snapshot();
    G.layerInfo ||= {};
    G.layerInfo[l] = { ...(G.layerInfo[l] || {}), [key]: value };
    changed();
  };
  const v = editing(g);
  const icons = h('details', { class: 'add icons' },
    h('summary', { title: 'The icon for this layer\'s seat in the game' }, info.icon, ' Icon'),
    h('div', { class: 'picker icon-picker' },
      h('div', { class: 'pick-grid icon-grid' }, ICONS.map((ic) => h('button', { class: ic === info.icon ? 'on' : '', onclick: () => setInfo('icon', ic) }, ic))),
      h('label', {}, 'Or type one', h('input', { class: 'emoji', maxlength: 8, value: info.icon, onchange: (e) => { if (e.target.value.trim()) setInfo('icon', e.target.value.trim()); } }))));
  return h('div', { class: 'bar layer-set' },
    h('label', {}, 'Layer name', h('input', { class: 'name small', maxlength: 24, value: info.name, 'aria-label': 'Layer name',
      onchange: (e) => setInfo('name', e.target.value.trim() || snd.LAYER_DEFAULTS[l].name) })),
    icons,
    v ? h('label', { title: 'Each time round the loop, this variation gets this chance of playing in place of the main take. If two come up, the first in the list plays.' },
      `Variation ${settings.variant + 1} plays`,
      h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(v.chance * 100),
        oninput: (e) => { e.target.nextSibling.textContent = `${e.target.value}% of the time`; },
        onchange: (e) => { snapshot(); v.chance = Number(e.target.value) / 100; changed(); } }),
      h('span', { class: 'total' }, `${Math.round(v.chance * 100)}% of the time`)) : null,
    v ? confirmButton(`Delete variation ${settings.variant + 1}`, 'Delete?', () => {
      snapshot();
      g.variants[l].splice(settings.variant, 1);
      if (!g.variants[l].length) delete g.variants[l];
      if (!Object.keys(g.variants).length) delete g.variants;
      settings.variant = -1;
      changed();
    }) : h('span', { class: 'hint inline' }, variantsOf(g, l).length ? 'Main take: plays when no variation comes up.' : 'Add a variation for a different take that comes up now and then.'));
}

/* The sound picker's sections, in order. A sound not listed goes under Other. */
const SECTIONS = [
  ['Keys and mallets', ['piano', 'marimba', 'xylophone', 'glockenspiel', 'harp']],
  ['Guitars and bass', ['guitar', 'banjo', 'electric-bass', 'bass']],
  ['Strings', ['violins', 'violas', 'cellos', 'pizzicato', 'cello-pizz']],
  ['Woodwinds', ['flute', 'oboe', 'clarinet', 'bassoon']],
  ['Brass', ['trumpet', 'horn', 'trombone', 'tuba']],
  ['Drum kit', ['kit-kick', 'kit-snare', 'kit-snare-ghost', 'kit-cross-stick', 'kit-hihat-closed', 'kit-hihat-pedal',
    'kit-hihat-open', 'kit-tom-high', 'kit-tom-low', 'kit-ride', 'kit-ride-bell', 'kit-crash', 'kit-splash']],
  ['Hand drums', ['conga', 'bongo-high', 'bongo-low', 'log-drum-high', 'log-drum-low']],
  ['Shakers and scrapers', ['shaker', 'cabasa', 'guiro', 'tambourine', 'sleigh-bells']],
  ['Bells and wood', ['claves', 'cowbell', 'agogo', 'triangle', 'finger-cymbals']],
  ['Concert percussion', ['snare', 'bass-drum', 'cymbal']],
];

/* Sections with the sounds index.json has, for a picker or a track's select. */
function sections(filter = () => true) {
  const all = index.instruments;
  const listed = new Set(SECTIONS.flatMap(([, ids]) => ids));
  const out = SECTIONS.map(([title, ids]) => [title, ids.filter((id) => all[id] && filter(all[id]))]);
  out.push(['Other', Object.keys(all).filter((id) => !listed.has(id) && filter(all[id]))]);
  return out.filter(([, ids]) => ids.length);
}

function addSound(g, layer) {
  const picker = h('details', { class: 'add' },
    h('summary', {}, '+ Add a sound'),
    h('div', { class: 'picker' }, sections().map(([title, ids]) => h('div', { class: ids.length > 8 ? 'pick-group wide' : 'pick-group' },
      h('div', { class: 'label' }, title),
      h('div', { class: 'pick-grid' }, ids.map((id) => h('button', {
        title: index.instruments[id].kind === 'hit' ? 'Percussion row' : 'Piano roll',
        onclick: () => {
          snapshot();
          editTracks(g).push({ inst: id, vol: 1, notes: [] });
          snd.useInstruments([g]);
          changed();
        },
      }, index.instruments[id].label)))))));
  return picker;
}

// The sound picker closes on a click outside it or on Escape.
document.addEventListener('pointerdown', (e) => {
  for (const d of document.querySelectorAll('details.add[open]')) if (!d.contains(e.target)) d.open = false;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') for (const d of document.querySelectorAll('details.add[open]')) d.open = false;
});

function trackTools(g, tr, kind) {
  return [
    h('select', { onchange: (e) => { snapshot(); tr.inst = e.target.value; snd.useInstruments([g]); changed(); } },
      sections((s) => (s.kind === 'hit') === (kind === 'hit')).map(([title, ids]) => h('optgroup', { label: title },
        ids.map((n) => h('option', { value: n, selected: n === tr.inst }, index.instruments[n].label))))),
    h('input', { type: 'range', min: 0, max: 150, value: Math.round(tr.vol * 100), title: 'Volume',
      onchange: (e) => { snapshot(); tr.vol = Number(e.target.value) / 100; changed(); } }),
    h('button', { class: 'icon', title: 'Remove this sound', onclick: () => {
      snapshot();
      const list2 = editTracks(g);
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

function makeCanvas(wrap, rows, rowH, draw, onDown, onHover) {
  const canvas = h('canvas', { class: 'grid' });
  const item = { canvas, wrap, rows, rowH, draw, cw: 16 };
  canvas.addEventListener('pointerdown', (e) => onDown(e, item));
  if (onHover) canvas.addEventListener('pointermove', (e) => { if (!e.buttons) onHover(e, item); });
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
      // On a note: drag its right end to stretch or shorten it, drag its body to move it,
      // or click without dragging to remove it.
      const n = tr.notes[i];
      const l0 = n.l || 1;
      const end = atEnd(e, item, n);
      const grab = at.col - n.s;
      let moved = false;
      item.canvas.style.cursor = end ? 'ew-resize' : 'grabbing';
      drag(e, item, (a) => {
        moved = true;
        if (end) {
          n.l = Math.max(1, Math.min(steps(g) - n.s, a.col - n.s + 1));
        } else {
          n.s = Math.max(0, Math.min(steps(g) - l0, a.col - grab));
          const mm = hi - a.row;
          if (mm >= lo && mm <= hi && mm !== n.m) { n.m = mm; preview(tr, mm); }
        }
        drawAll();
      }, true, () => {
        item.canvas.style.cursor = '';
        if (!moved) tr.notes.splice(tr.notes.indexOf(n), 1);
        tr.notes.sort((a, b) => a.s - b.s || a.m - b.m);
        drawAll();
      });
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
  }, (e, item) => {
    // Hover: a resize cursor over a note's right end, a hand over the rest of it.
    const at = cellAt(e, item);
    const n = at && tr.notes.find((x) => x.m === hi - at.row && at.col >= x.s && at.col < x.s + (x.l || 1));
    item.canvas.style.cursor = !n ? '' : atEnd(e, item, n) ? 'ew-resize' : 'grab';
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

/* Is the pointer on a note's right end (its last third, at least 8 px, or the right half of a
   one-step note)? There a drag changes its length. */
function atEnd(e, item, n) {
  const x = e.clientX - item.canvas.getBoundingClientRect().left - GUTTER;
  const right = (n.s + (n.l || 1)) * item.cw;
  const zone = (n.l || 1) === 1 ? item.cw / 2 : Math.max(8, Math.min(item.cw, ((n.l || 1) * item.cw) / 3));
  return x >= right - zone;
}

/* Follows the pointer until it lifts, calling move with each new cell, then end; saves. */
function drag(e, item, move, anyCell = false, end = null) {
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
    if (end) end();
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

/* A groove's other-meter version, started from this one: each note keeps its beat, and its
   place in the beat moves to where a player would put it. Two 8ths in 2/4 become a quarter and
   an 8th in 6/8 (the second 8th moves to the last 8th of the beat, and the first stretches to
   meet it); four 16ths become 8th, 8th, 16th, 16th. 6/8 to 2/4 does the reverse. Lengths
   follow the same map, so a quarter becomes a dotted quarter and a half a dotted half. Bars,
   chords and instruments carry over, ready to reshape. */
const BEAT_MAP = { '2/4>6/8': [0, 2, 4, 5], '6/8>2/4': [0, 1, 1, 2, 2, 3] };
function convert(v, meter) {
  const from = per(v);
  const to = meter === '6/8' ? 6 : 4;
  const map = BEAT_MAP[`${v.meter}>${meter}`] || [...Array(from).keys()].map((i) => Math.round(i * to / from));
  const at = (p) => Math.floor(p / from) * to + map[p % from];
  const out = structuredClone(v);
  out.meter = meter;
  out.swing = 0;
  const last = v.beats * to - 1;
  for (const tracks of allTracks(out)) {
    for (const tr of tracks) {
      const seen = new Set();
      tr.notes = tr.notes.map((n) => {
        const s = Math.min(at(n.s), last);
        return { ...n, s, ...(n.l ? { l: Math.max(1, Math.min(at(n.s + n.l), last + 1) - s) } : {}) };
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
  for (const tracks of allTracks(g)) {
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
  if (e.target.closest('input, select, textarea, summary')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(true); return; }
  if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); if (playing) stop(); else play(); }
});

start();
