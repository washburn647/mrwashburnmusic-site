/* Groove Lab: Musician Maker's backing grooves, made here on the site's sampled instruments.
   A groove is a loop of 8 or 16 beats on a 16th-note grid, in 2/4 (4 steps a beat) or 6/8
   (6 steps a dotted-quarter beat; the game plays these in compound units), in six layers: pulse, bass,
   drums, horns and band join as the combo grows (0, 3, 6, 10, 15 in a row), and breakdown
   plays alone in the breathers. Each layer holds tracks: a percussion sound (one row of steps)
   or a pitched instrument (a piano roll). Each groove names its layers and picks their icons
   (the game's band seats show them), and a layer can have variations: other takes, each with
   its own chance of playing in place of the main one each time round the loop. The game plays grooves with the same code as here
   (musician-maker/sound.js), so what you hear is what the kids hear, at any tempo.
   Editing: draw notes, or pick them (Select) to move, copy and paste at the cursor, transpose,
   or change their velocity; Key lock keeps new notes in the key; each piano roll shows the
   other layers' notes faintly; tracks mute and solo while you listen; a MIDI keyboard
   (midi.js) plays the piano roll last touched and step records into it. The note logic is in
   notes.js. Picks, the cursor, mutes and solos stay on this page, never in the grooves.
   Grooves are kept on this device (localStorage) with undo. "Publish to site" puts them in the
   game right away (/api/live/grooves.json, see worker/index.js), first asking if that would take
   any groove out of the game; "Download" saves grooves.json,
   a backup that Restore reads and tools/add_grooves.py puts in musician-maker/grooves.json.
   "In the game" lists them against what the game plays now: what's live, changed here or new,
   their order, record-shop price and whether the shop sells them, and anything live that this
   device doesn't have (to bring back). */

import * as samples from '/assets/sounds/samples.js';
import * as snd from '/musician-maker/sound.js';
import { makeClock } from '/musician-maker/clock.js';
import { siteShop } from '/musician-maker/shop.js';
import { h, confirmButton } from '../dom.js';
import * as nt from './notes.js';
import * as midi from './midi.js';

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
const BLACK = [1, 3, 6, 8, 10];
const DEFAULT_TRACKS = { pulse: ['claves'], bass: ['bass'], drums: ['bass-drum', 'snare'], horns: ['horn'], band: ['tambourine'], breakdown: [] };
const PICKED = '#D9822B'; // picked notes, the cursor and the box being dragged
const GHOST = 'rgba(176, 122, 58, .2)'; // the other layers' notes in a piano roll

/* ---------- state ---------- */

let grooves = [];
let index = null; // samples index.json: instruments and their ranges
const settings = { view: 'edit', groove: 'basic', layer: 'pulse', variant: -1, roll: false, bpm: 108, hear: 'band', len: 1, vel: 'normal', zoomX: 1, zoomY: 1,
  tool: 'draw', keyLock: false, ghosts: true, midi: false };
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
const kindsOf = (tracks) => ({ hit: tracks.filter((t) => isHit(t.inst)), pitched: tracks.filter((t) => !isHit(t.inst)) });
const sortNotes = (tr) => tr.notes.sort((a, b) => a.s - b.s || (a.m ?? 0) - (b.m ?? 0));
const lockKey = () => (settings.keyLock ? whole().key : null);

function store() {
  try { localStorage.setItem(KEY, JSON.stringify({ grooves, settings })); } catch { /* not kept */ }
}

/* Call before a change: keeps the state for undo. */
function snapshot() {
  past.push(JSON.stringify(grooves));
  if (past.length > 200) past.shift();
  future = [];
}

/* Runs a change, keeping one undo step for it if it changed anything. */
function edit(fn) {
  const before = JSON.stringify(grooves);
  fn();
  if (JSON.stringify(grooves) === before) return false;
  past.push(before);
  if (past.length > 200) past.shift();
  future = [];
  return true;
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
  if (settings.midi && midi.supported()) midiStart(true);
  await loadLive();
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

/* ---------- editing: kept on this page, never in the grooves (they'd be published) ---------- */

// The notes picked (note objects of the tracks being edited), and the bars a double-click
// picked (Copy takes them as its block).
const sel = new Set();
let selBars = null;
// Copied notes (notes.copyBlock), and the cursor: the step Paste and step recording put notes at.
let clip = null;
let cursor = 0;
// A track's place: groove, meter, layer, take (-1 the main one, else the variation) and its
// place in the take. It outlasts Undo and Restore, which replace the track objects.
const placeKey = (G, g, layer, take, i) => `${G.id}|${g.meter}|${layer}|${take}|${i}`;
const keyOf = (tr) => placeKey(whole(), now(), settings.layer, settings.variant, editTracks(now()).indexOf(tr));
// Muted and soloed tracks (place → 'mute' | 'solo'), and where each piano roll is scrolled to
// (place → the pitch at its top edge, so a redraw keeps the same notes on screen).
const mix = new Map();
const rollTops = new Map();

/* A track list's places shift when a track or variation goes: forget what was kept for them. */
function forget(prefix) {
  for (const m of [mix, rollTops]) for (const k of [...m.keys()]) if (k.startsWith(prefix)) m.delete(k);
  if (target?.startsWith(prefix)) target = null;
}

function pruneSel(tracks) {
  const alive = new Set(tracks.flatMap((t) => t.notes));
  for (const n of sel) if (!alive.has(n)) sel.delete(n);
  if (!sel.size) selBars = null;
}

const cursorShown = () => settings.tool === 'select' || rec || !!clip;

/* Does this track sound now? Not if it's muted, or if another track of the version is soloed. */
function audible(tr) {
  const G = whole();
  const g = now();
  const p = `${G.id}|${g.meter}|`;
  const solo = [...mix].some(([k, s]) => s === 'solo' && k.startsWith(p));
  const s = mix.get(keyOf(tr));
  return solo ? s === 'solo' : s !== 'mute';
}

/* The version as it sounds with the tracks muted and soloed here, kept while nothing about them
   changes (the game's variation dice are rolled per version, once round the loop). */
let mixed = { g: null, sig: '', out: null };
function sounding(G, g) {
  const p = `${G.id}|${g.meter}|`;
  const shape = snd.ALL_LAYERS.map((l) => `${(g.layers[l] || []).length}.${variantsOf(g, l).map((v) => v.tracks.length).join('.')}`).join(',');
  const sig = `${[...mix].filter(([k]) => k.startsWith(p)).join(';')}#${shape}#${g.beats}#${g.swing}`;
  if (mixed.g !== g || mixed.sig !== sig) {
    mixed = { g, sig, out: nt.mixVersion(g, (l, take, i) => mix.get(placeKey(G, g, l, take, i)), snd.ALL_LAYERS) };
  }
  return mixed.out;
}

/* The takes with a soloed track: their layers play whatever Hear says, each in that take. */
function soloTakes(G, g) {
  const p = `${G.id}|${g.meter}|`;
  return [...mix].filter(([k, s]) => s === 'solo' && k.startsWith(p)).map(([k]) => {
    const parts = k.slice(p.length).split('|');
    return { l: parts[0], take: Number(parts[1]) };
  });
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

// The first press anywhere on the page lets sound start (a MIDI key can't) and loads the
// groove's instruments, so a MIDI keyboard or a click sounds like the band right away.
let warmed = false;
document.addEventListener('pointerdown', () => {
  const c = snd.ac();
  if (c.state === 'suspended') c.resume().catch(() => {});
  if (!warmed && now()) { warmed = true; snd.useInstruments([now()]); }
}, true);

async function play() {
  await audio();
  if (!clock) {
    // Scheduled further ahead than the game: editing redraws the page, and on a tablet a redraw
    // can hold up the page long enough to make notes late.
    clock = makeClock(ctx, { ahead: 0.3 });
    clock.onBeat((i, t, spb) => {
      const G = whole();
      const g = now();
      if (!g) return;
      // A beat whose time has passed (the page was busy, or asleep) is skipped, not played late
      // in a heap: the groove carries on in time from the next beat.
      if (t < ctx.currentTime - 0.02) return;
      // The layer being edited plays the take being edited; with "Roll variations" on, every
      // layer rolls its variations as in the game. A soloed track's layer plays, in its take.
      let force = settings.roll ? null : Object.fromEntries(snd.ALL_LAYERS.map((l) => [l, l === settings.layer ? settings.variant : -1]));
      let layers = hearLayers();
      const editor = settings.view === 'edit';
      if (editor) {
        const solos = soloTakes(G, g);
        if (solos.length) {
          force ||= {};
          for (const s of solos) force[s.l] = s.take;
          layers = [...new Set([...layers, ...solos.map((s) => s.l)])];
        }
      }
      snd.playGrooveBeat(editor ? sounding(G, g) : g, i, t, spb, { layers, force });
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
  if (!playing) { head = -1; drawHeads(); return; }
  const beats = (ctx.currentTime - snd.latency() - startT) / (60 / settings.bpm);
  const g = now();
  const step = beats < 0 ? -1 : Math.floor(beats * per(g)) % steps(g);
  if (step !== head) { head = step; drawHeads(); }
  requestAnimationFrame(tick);
}

function preview(tr, m) {
  audio().then(() => {
    const t = ctx.currentTime + 0.01;
    if (m == null) snd.hit(tr.inst, t, tr.vol * vel());
    else snd.note(tr.inst, m, t, 0.3, tr.vol * vel() * 0.5);
  });
}

/* ---------- MIDI keyboard ---------- */

let midiOn = false;
let midiNames = [];
let rec = false; // step recording into the MIDI keyboard's piano roll, at the cursor
let target = null; // place of the piano roll the keyboard plays: the last one touched
const held = new Map(); // key → stops its sound
const keysDown = nt.chords();
let entry = null; // the chord being recorded: { at, l }
const entered = []; // chords recorded, for Backspace

/* The piano roll a MIDI keyboard plays: the last one touched, else the layer's first. */
function midiTrack(g) {
  const pitched = kindsOf(editTracks(g)).pitched;
  return pitched.find((t) => keyOf(t) === target) || pitched[0] || null;
}

async function midiStart(auto = false) {
  if (!auto) audio().catch(() => {}); // a click: sound can start now
  try {
    await midi.connect(onMidi, (names) => {
      midiNames = names;
      const tag = document.querySelector('.midi-name');
      if (tag) tag.textContent = `🎹 ${names[0] || 'No keyboard'}`;
    });
    midiOn = true;
    settings.midi = true;
    if (now()) snd.useInstruments([now()]);
  } catch {
    midiOn = false;
    settings.midi = false;
    if (!auto) status = 'This browser didn\'t allow MIDI.';
  }
  store();
  render();
}

function midiStop() {
  midi.disconnect();
  for (const stopIt of held.values()) stopIt?.();
  held.clear();
  midiOn = false;
  settings.midi = false;
  setRec(false);
  store();
  render();
}

function setRec(on) {
  rec = on;
  entry = null;
  keysDown.reset();
  entered.length = 0;
}

function onMidi({ on, note: m }) {
  const g = settings.view === 'edit' ? now() : null;
  if (!on) {
    held.get(m)?.();
    held.delete(m);
    if (keysDown.release(m) && g) endEntry(g);
    return;
  }
  if (!g) return;
  const tr = midiTrack(g);
  if (!tr) return;
  held.get(m)?.();
  ctx = snd.ac();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  held.set(m, snd.note(tr.inst, m, ctx.currentTime + 0.005, 6, tr.vol * vel() * 0.5) || null);
  if (rec) record(g, tr, m);
}

/* A key down while recording: its note goes in at the chord's step, for the note length picked
   (Key lock leaves out keys outside the key). */
function record(g, tr, m) {
  const { lo, hi } = range(tr);
  if (m < lo || m > hi || (settings.keyLock && !nt.inKey(m, whole().key))) return;
  const how = keysDown.press(m, performance.now());
  if (how === 'next') endEntry(g, false);
  if (how !== 'join' || !entry) {
    if (cursor >= steps(g)) cursor = 0;
    snapshot();
    entry = { at: cursor, l: Math.min(settings.len, steps(g) - cursor) };
  }
  const i = tr.notes.findIndex((x) => x.s === entry.at && x.m === m);
  if (i >= 0) tr.notes.splice(i, 1);
  tr.notes.push({ s: entry.at, m, l: entry.l, v: vel() });
  sortNotes(tr);
  store();
  drawAll();
}

/* The chord is done: the cursor moves on past it. */
function endEntry(g, redraw = true) {
  if (!entry) return;
  entered.push(entry);
  if (entered.length > 64) entered.shift();
  cursor = entry.at + entry.l >= steps(g) ? 0 : entry.at + entry.l;
  entry = null;
  if (redraw) changed();
  else drawAll();
}

/* Backspace while recording: back to the chord before the cursor, taking it out. */
function stepBack(g) {
  const tr = midiTrack(g);
  if (!tr) return;
  const n = steps(g);
  const last = entered[entered.length - 1];
  const back = last && (last.at + last.l) % n === cursor % n ? entered.pop().at : (((cursor - settings.len) % n) + n) % n;
  edit(() => { tr.notes = tr.notes.filter((x) => x.s !== back); });
  cursor = back;
  changed();
}

/* ---------- picking, copying, moving ---------- */

/* Movers for the picked notes (notes.moving), each with its track. */
function pickedMovers(g) {
  const out = [];
  for (const tr of editTracks(g)) {
    const hit = isHit(tr.inst);
    const r = hit ? null : range(tr);
    for (const n of tr.notes) if (sel.has(n)) out.push({ ...nt.moving(n, hit, r?.lo, r?.hi), tr });
  }
  return out;
}

function pickAll(g) {
  sel.clear();
  selBars = null;
  for (const tr of editTracks(g)) for (const n of tr.notes) sel.add(n);
  render();
}

/* Double-click in Select: every note of the bar there, in every track of the take. */
function pickBar(g, col, add) {
  const bar = per(g) * 2;
  const from = Math.floor(col / bar) * bar;
  const to = Math.min(steps(g), from + bar);
  if (!add) sel.clear();
  for (const tr of editTracks(g)) for (const n of tr.notes) if (n.s >= from && n.s < to) sel.add(n);
  selBars = add && selBars ? { from: Math.min(selBars.from, from), to: Math.max(selBars.to, to) } : { from, to };
  render();
}

function copySel(g, cut = false) {
  const tracks = editTracks(g);
  const kinds = kindsOf(tracks);
  const entries = [];
  for (const tr of tracks) {
    const hit = isHit(tr.inst);
    for (const n of tr.notes) if (sel.has(n)) entries.push({ hit, inst: tr.inst, k: kinds[hit ? 'hit' : 'pitched'].indexOf(tr), n });
  }
  const block = nt.copyBlock(entries, per(g), selBars);
  if (!block) return;
  clip = block;
  // Paste goes right after what was copied: Ctrl+V again and again fills the bars that follow.
  cursor = block.from + block.span >= steps(g) ? 0 : block.from + block.span;
  if (cut) {
    edit(() => { for (const tr of tracks) tr.notes = tr.notes.filter((n) => !sel.has(n)); });
    sel.clear();
    selBars = null;
    changed();
    return;
  }
  render();
}

function paste(g) {
  if (!clip) return;
  const n = steps(g);
  const at = cursor < n ? cursor : 0;
  let put = new Set();
  edit(() => { put = nt.pasteBlock(clip, kindsOf(editTracks(g)), at, n, range); });
  sel.clear();
  for (const x of put) sel.add(x);
  selBars = put.size ? { from: at, to: Math.min(n, at + clip.span) } : null;
  cursor = at + clip.span >= n ? 0 : at + clip.span;
  changed();
}

function deleteSel(g) {
  edit(() => { for (const tr of editTracks(g)) tr.notes = tr.notes.filter((n) => !sel.has(n)); });
  sel.clear();
  selBars = null;
  changed();
}

/* Arrow keys with notes picked: a step sideways (a beat with Shift), a half step or scale
   step up and down (an octave with Shift). */
function nudge(g, key, big) {
  const items = pickedMovers(g);
  if (!items.length) return;
  const across = { ArrowLeft: -1, ArrowRight: 1 }[key] || 0;
  const up = { ArrowUp: 1, ArrowDown: -1 }[key] || 0;
  let done = null;
  edit(() => {
    done = nt.shiftNotes(items, { dc: across * (big ? per(g) : 1), dp: up, steps: steps(g), key: lockKey(), octave: big && !!up });
    const moved = new Set(items.map((it) => it.n));
    for (const tr of editTracks(g)) { nt.dropCovered(tr.notes, moved); sortNotes(tr); }
  });
  if (done?.dp) {
    const p = items.find((it) => !it.hit);
    if (p) preview(p.tr, p.n.m);
  }
  changed();
}

function setVelocity(v) {
  edit(() => { for (const n of sel) n.v = v; });
}

/* ---------- page ---------- */

function seg(options, value, onpick, titles = {}) {
  return h('span', { class: 'seg' }, Object.entries(options).map(([v, text]) =>
    h('button', { class: String(v) === String(value) ? 'on' : '', title: titles[v] || null, onclick: () => onpick(v) }, text)));
}

const canvases = [];

/* The title, the two views, and saving: on both views. */
function header(restore) {
  return h('div', { class: 'bar' },
    h('h1', {}, 'Groove Lab', h('small', {}, ' Musician Maker')),
    seg({ edit: 'Editor', game: `In the game${live ? ` · ${gameCount()}` : ''}` }, settings.view, (v) => { settings.view = v; store(); render(); }),
    h('span', { class: 'grow' }),
    h('button', { onclick: () => restore.click() }, 'Restore'),
    restore,
    h('button', { onclick: download }, 'Download'),
    h('button', { class: 'primary', disabled: publishing, onclick: publish }, publishing ? 'Publishing…' : 'Publish to site'));
}

function render() {
  if (settings.view === 'game') { renderGame(); return; }
  const G = whole();
  if (!G) return;
  const g = now();
  if (!g) { renderMissing(G); return; }
  canvases.length = 0;
  const pageY = window.scrollY;
  const restore = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: () => { restoreFile(restore.files[0]); restore.value = ''; } });
  const layer = settings.layer;
  if (!editing(g)) settings.variant = -1;
  const tracks = editTracks(g);
  pruneSel(tracks);
  if (cursor >= steps(g)) cursor = 0;
  const info = (l) => snd.layerInfo(G, l);
  const hits = tracks.filter((tr) => isHit(tr.inst));
  const pitched = tracks.filter((tr) => !isHit(tr.inst));
  const count = (l) => g.layers[l].reduce((n, tr) => n + tr.notes.length, 0);

  app.replaceChildren(...[
    header(restore),
    h('div', { class: 'bar' },
      h('select', { class: 'pick', onchange: (e) => { settings.groove = e.target.value; store(); render(); } },
        grooves.map((x) => h('option', { value: x.id, selected: x.id === G.id }, `${x.name} · ${Object.keys(x.versions).join(' + ')}`))),
      h('input', { class: 'name', value: G.name, 'aria-label': 'Groove name', onchange: (e) => { snapshot(); G.name = e.target.value.trim() || G.name; changed(); } }),
      h('button', { onclick: () => { snapshot(); const x = blank('New groove'); grooves.push(x); settings.groove = x.id; changed(); } }, 'New'),
      h('button', { onclick: () => { snapshot(); const x = { ...structuredClone(G), id: `g-${Date.now().toString(36)}`, name: `${G.name} copy` }; grooves.push(x); settings.groove = x.id; changed(); } }, 'Copy'),
      grooves.length > 1 ? confirmButton('Delete', 'Delete?', () => { snapshot(); forget(`${G.id}|`); grooves = grooves.filter((x) => x !== G); settings.groove = grooves[0].id; changed(); }) : null,
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
      Object.keys(G.versions).length > 1 ? confirmButton(`Remove ${g.meter}`, 'Remove?', () => { snapshot(); forget(`${G.id}|${g.meter}|`); delete G.versions[g.meter]; settings.meter = Object.keys(G.versions)[0]; changed(); }) : null,
      h('span', { class: 'label' }, 'Length'),
      seg({ 8: '8 beats', 16: '16 beats' }, g.beats, (v) => setLength(g, Number(v))),
      g.meter === '6/8' ? null : h('label', {}, 'Swing', h('input', { type: 'range', min: 0, max: 100, value: Math.round(g.swing * 100), onchange: (e) => { snapshot(); g.swing = Number(e.target.value) / 100; changed(); } }),
        h('span', { class: 'total' }, `${Math.round(g.swing * 100)}%`)),
      keySelect(G),
      h('label', { title: 'Only notes in the key can be placed, and notes move by scale steps' },
        h('input', { type: 'checkbox', checked: settings.keyLock, onchange: (e) => { settings.keyLock = e.target.checked; store(); render(); } }), 'Key lock'),
    ),
    layerColumns(G, g, count),
    layerSettings(G, g),
    h('div', { class: 'bar brush' },
      seg({ draw: 'Draw', select: 'Select' }, settings.tool, (v) => { settings.tool = v; store(); render(); },
        { draw: 'Click to add notes (Shift+drag picks)', select: 'Drag a box to pick notes, double-click a bar, click to place the cursor' }),
      h('span', { class: 'label' }, 'Note'),
      seg(LENGTHS[g.meter], settings.len, (v) => { settings.len = Number(v); store(); render(); }),
      seg(VELS, settings.vel, (v) => {
        settings.vel = v;
        if (sel.size) setVelocity(VEL[v]);
        changed();
      }, sel.size ? { soft: 'Soft, and the picked notes too', normal: 'Normal, and the picked notes too', loud: 'Loud, and the picked notes too' } : {}),
      h('span', { class: 'grow' }),
      h('span', { class: 'zoom' }, h('span', { class: 'label' }, 'Zoom'), h('span', { class: 'seg' },
        h('button', { title: 'Narrower steps', disabled: settings.zoomX <= ZOOM_X[0], onclick: () => zoomBy(1 / 1.5, 1) }, '↔ −'),
        h('button', { title: 'Wider steps (scroll sideways)', disabled: settings.zoomX >= ZOOM_X[1], onclick: () => zoomBy(1.5, 1) }, '↔ +'),
        h('button', { title: 'Shorter piano-roll rows', disabled: settings.zoomY <= ZOOM_Y[0], onclick: () => zoomBy(1, 1 / 1.3) }, '↕ −'),
        h('button', { title: 'Taller piano-roll rows', disabled: settings.zoomY >= ZOOM_Y[1], onclick: () => zoomBy(1, 1.3) }, '↕ +'))),
    ),
    settings.tool === 'select' ? pickTools(g) : null,
    h('div', { class: 'bar tracks' },
      h('label', { title: 'Show the other layers\' notes faintly in each piano roll' },
        h('input', { type: 'checkbox', checked: settings.ghosts, onchange: (e) => { settings.ghosts = e.target.checked; store(); drawAll(); } }), 'Other layers'),
      midiControls(),
      h('span', { class: 'grow' }),
      addSound(g, layer),
      tracks.length ? confirmButton('Clear layer', 'Clear?', () => { snapshot(); tracks.forEach((tr) => { tr.notes = []; }); changed(); }) : null,
    ),
    hits.length ? hitCard(g, hits) : null,
    ...pitched.map((tr) => rollCard(g, tr)),
    tracks.length ? null : h('p', { class: 'empty' }, `No sounds in ${info(layer).name}${editing(g) ? ` variation ${settings.variant + 1}` : ''} yet. Add one above.`),
    h('p', { class: 'hint' }, 'Click adds a note; drag to lengthen. Drag a note to move it, its end to resize, click to remove. Select: drag a box or double-click a bar, then arrows, Ctrl+C, Ctrl+V, Delete. Pinch to zoom. Space plays.'),
    status ? h('p', { class: 'status' }, status) : null,
  ].filter(Boolean));
  // Size and draw the grids now, before the browser lays out the page: an unsized grid is
  // short, and the page would jump up to fit it.
  drawAll();
  centerRolls();
  if (window.scrollY !== pageY) window.scrollTo(0, pageY);
}

/* Select's tools, always in the same place (greyed out until there's something to act on),
   so picking notes never moves the grids. */
function pickTools(g) {
  const n = sel.size;
  const pct = n ? Math.round((100 * [...sel].reduce((a, x) => a + (x.v ?? 0.8), 0)) / n) : 80;
  let sliding = false;
  return h('div', { class: 'bar picks' },
    h('button', { title: 'Copy (Ctrl+C)', disabled: !n, onclick: () => copySel(g) }, 'Copy'),
    h('button', { title: 'Paste at the cursor (Ctrl+V)', disabled: !clip, onclick: () => paste(g) }, 'Paste'),
    h('button', { class: 'danger', title: 'Delete', disabled: !n, onclick: () => deleteSel(g) }, 'Delete'),
    h('label', { title: 'Velocity of the picked notes' }, 'Velocity',
      h('input', { type: 'range', min: 5, max: 100, step: 5, value: pct, disabled: !n, 'aria-label': 'Velocity',
        oninput: (e) => {
          if (!sliding) { snapshot(); sliding = true; }
          for (const x of sel) x.v = Number(e.target.value) / 100;
          e.target.nextSibling.textContent = `${e.target.value}%`;
          drawAll();
        },
        onchange: () => { sliding = false; changed(); } }),
      h('span', { class: 'total' }, n ? `${pct}%` : '')));
}

function midiControls() {
  if (!midi.supported()) return null;
  if (!midiOn) return h('button', { title: 'Play and step record with a MIDI keyboard', onclick: () => midiStart() }, '🎹 MIDI');
  return h('span', { class: 'seg midi' },
    h('button', { class: 'on midi-name', title: 'Turn the MIDI keyboard off', onclick: midiStop }, `🎹 ${midiNames[0] || 'No keyboard'}`),
    h('button', { class: rec ? 'on rec' : '', 'aria-pressed': String(rec), title: 'Step record: each note or chord goes in at the cursor for the note length, and the cursor moves on (→ for a rest, Backspace to go back)',
      onclick: () => { setRec(!rec); render(); } }, '● Rec'));
}

/* The six layers side by side: each column is the layer's tab (its main take) with its
   variations below it and a button to add one. */
function layerColumns(G, g, count) {
  const pick = (l, v) => { settings.layer = l; settings.variant = v; store(); render(); };
  const notes = (tracks) => tracks.reduce((n, tr) => n + tr.notes.length, 0);
  const marks = (l) => {
    const p = `${G.id}|${g.meter}|${l}|`;
    const states = [...mix].filter(([k]) => k.startsWith(p)).map(([, s]) => s);
    return `${states.includes('solo') ? ' · 🎧' : ''}${states.includes('mute') ? ' · 🔇' : ''}`;
  };
  return h('div', { class: 'layers' }, snd.ALL_LAYERS.map((l) => {
    const info = snd.layerInfo(G, l);
    const vars = variantsOf(g, l);
    return h('div', { class: 'layer-col' },
      h('button', { class: `layer-tab${l === settings.layer && settings.variant < 0 ? ' on' : ''}`, onclick: () => pick(l, -1) },
        h('span', { class: 'ic' }, info.icon), h('b', {}, info.name), h('small', {}, `${WHEN[l]} · ${count(l)} notes${marks(l)}`)),
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
      forget(`${G.id}|${g.meter}|${l}|`);
      g.variants[l].splice(settings.variant, 1);
      if (!g.variants[l].length) delete g.variants[l];
      if (!Object.keys(g.variants).length) delete g.variants;
      settings.variant = -1;
      changed();
    }) : h('span', { class: 'hint inline' }, variantsOf(g, l).length ? 'Main take: plays when no variation comes up.' : 'Add a variation for a different take that comes up now and then.'));
}

/* The sound picker's sections, in order. A sound not listed goes under Other. */
const SECTIONS = [
  ['Keys and mallets', ['piano', 'electric-piano', 'organ', 'marimba', 'xylophone', 'glockenspiel', 'kalimba', 'harp']],
  ['Guitars and bass', ['guitar', 'electric-guitar', 'ukulele', 'banjo', 'electric-bass', 'bass']],
  ['Synths', ['synth-lead', 'synth-pad', 'synth-bass']],
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
      forget(`${whole().id}|${g.meter}|${settings.layer}|${settings.variant}|`);
      const list2 = editTracks(g);
      list2.splice(list2.indexOf(tr), 1);
      changed();
    } }, '×'),
  ];
}

/* Mute and solo, while you listen here (never published). */
function mixTools(tr) {
  const k = keyOf(tr);
  const s = mix.get(k);
  const flip = (v) => {
    if (mix.get(k) === v) mix.delete(k);
    else mix.set(k, v);
    render();
  };
  return h('span', { class: 'ms' },
    h('button', { class: s === 'mute' ? 'on mute' : '', title: 'Mute', 'aria-pressed': String(s === 'mute'), onclick: () => flip('mute') }, 'M'),
    h('button', { class: s === 'solo' ? 'on solo' : '', title: 'Solo', 'aria-pressed': String(s === 'solo'), onclick: () => flip('solo') }, 'S'));
}

/* A piano roll's transpose buttons: its picked notes, or all of them. Key lock moves by
   scale steps. */
function transposeTools(g, tr) {
  const movers = () => {
    const { lo, hi } = range(tr);
    const mine = tr.notes.filter((n) => sel.has(n));
    return (mine.length ? mine : tr.notes).map((n) => nt.moving(n, false, lo, hi));
  };
  const key = lockKey();
  const button = (text, title, dp, octave) => h('button', {
    class: 'icon', title, 'aria-label': title, disabled: !nt.canShift(movers(), dp, { key, octave }),
    onclick: () => {
      const items = movers();
      edit(() => {
        nt.shiftNotes(items, { dp, steps: steps(g), key, octave });
        nt.dropCovered(tr.notes, new Set(items.map((it) => it.n)));
        sortNotes(tr);
      });
      if (items.length) preview(tr, items[0].n.m);
      changed();
    },
  }, text);
  const step = key != null ? 'a scale step' : 'a half step';
  return h('span', { class: 'shift' },
    button('↓8', 'Down an octave', -1, true), button('↓', `Down ${step}`, -1, false),
    button('↑', `Up ${step}`, 1, false), button('↑8', 'Up an octave', 1, true));
}

/* ---------- grids ---------- */

const GUTTER = 44;
const HIT_ROW = 40;
const ROLL_ROW = 15;

// Zoom: steps wider than fit the screen (scroll sideways), and taller piano-roll rows.
const ZOOM_X = [1, 4];
const ZOOM_Y = [0.8, 3];
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

// How far the pointer goes before a press is a drag, not a shaky click.
const SLOP = { mouse: 5, pen: 8, touch: 12 };

function cellWidth(g, wrapWidth) {
  return Math.floor(Math.max(12, (wrapWidth - GUTTER - 2) / steps(g)) * settings.zoomX);
}

/* A grid. One finger (or the mouse) edits. Two fingers scroll it and pinch to zoom: apart
   sideways for wider steps, apart up and down for taller rows. A second finger landing
   takes back what the first one started. Returns the grid's item (item.canvas goes on the page). */
function makeCanvas(wrap, rows, rowH, draw, onDown, onHover, roll = false) {
  const canvas = h('canvas', { class: 'grid' });
  const item = { canvas, wrap, rows, rowH, draw, cw: 16, roll, ox: 0, abort: null, saved: [], picked: [], snapped: false, box: null };
  const touches = new Map();
  let pinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        if (item.abort) {
          item.abort();
          // The notes as they were, the same note objects (the picks hold them).
          for (const [tr, list, was] of item.saved) {
            list.forEach((n, i) => { for (const k of Object.keys(n)) delete n[k]; Object.assign(n, was[i]); });
            tr.notes.splice(0, tr.notes.length, ...list);
          }
          sel.clear();
          for (const n of item.picked) sel.add(n);
          if (item.snapped) past.pop();
          item.snapped = false;
          drawAll();
        }
        pinch = gesture(item, [...touches.values()]);
        return;
      }
      if (touches.size > 2 || pinch) return;
    }
    // What the notes and picks were before this press, in case a second finger takes it back.
    const g = now();
    item.saved = g ? editTracks(g).map((tr) => [tr, [...tr.notes], tr.notes.map((n) => ({ ...n }))]) : [];
    item.picked = [...sel];
    item.snapped = false;
    onDown(e, item);
  });
  const lift = (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
  };
  canvas.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) { pinch.move([...touches.values()]); return; }
    if (onHover && !e.buttons) onHover(e, item);
  });
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
  canvas.addEventListener('wheel', (e) => {
    // Ctrl + wheel (a trackpad pinch): zoom the steps, or the rows with Shift.
    if (!e.ctrlKey) return;
    e.preventDefault();
    const f = Math.exp(-e.deltaY / 200);
    zoomAt(item, e.clientX, e.clientY, e.shiftKey ? 1 : f, e.shiftKey ? f : 1);
  }, { passive: false });
  canvases.push(item);
  return item;
}

/* Call before a press first changes notes: one undo step for the whole press. */
function touch(item) {
  if (item.snapped) return;
  snapshot();
  item.snapped = true;
}

function gesture(item, [a, b]) {
  const start = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dx: Math.abs(a.x - b.x), dy: Math.abs(a.y - b.y), zx: settings.zoomX, zy: settings.zoomY };
  let last = { cx: start.cx, cy: start.cy };
  return {
    move([p, q]) {
      const cx = (p.x + q.x) / 2;
      const cy = (p.y + q.y) / 2;
      item.wrap.scrollLeft -= cx - last.cx;
      item.wrap.scrollTop -= cy - last.cy;
      last = { cx, cy };
      // Only a spread that started wide enough counts, so a two-finger scroll doesn't zoom.
      const zx = start.dx > 60 ? clamp(start.zx * Math.abs(p.x - q.x) / start.dx, ZOOM_X) : settings.zoomX;
      const zy = item.roll && start.dy > 60 ? clamp(start.zy * Math.abs(p.y - q.y) / start.dy, ZOOM_Y) : settings.zoomY;
      if (Math.abs(zx - settings.zoomX) > 0.02 || Math.abs(zy - settings.zoomY) > 0.02) zoomAt(item, cx, cy, zx / settings.zoomX, zy / settings.zoomY);
    },
  };
}

/* Zooms by fx and fy, keeping the spot under (x, y) where it is. */
function zoomAt(item, x, y, fx, fy) {
  const zx = clamp(settings.zoomX * fx, ZOOM_X);
  const zy = clamp(settings.zoomY * fy, ZOOM_Y);
  const r = item.wrap.getBoundingClientRect();
  const px = x - r.left;
  const py = y - r.top;
  const oldCw = item.cw;
  const oldRow = item.rowH;
  const contentX = item.wrap.scrollLeft + px - GUTTER;
  const contentY = item.wrap.scrollTop + py;
  settings.zoomX = zx;
  settings.zoomY = zy;
  drawAll();
  item.wrap.scrollLeft = contentX * (item.cw / oldCw) - px + GUTTER;
  item.wrap.scrollTop = contentY * (item.rowH / oldRow) - py;
  scrollX = item.wrap.scrollLeft;
  syncScroll(item.wrap);
  // The other piano rolls keep their notes on screen as their rows grow or shrink.
  for (const other of canvases) {
    const top = other !== item && other.roll ? rollTops.get(other.id) : null;
    if (top != null) other.wrap.scrollTop = (other.hi + 1 - top) * other.rowH;
  }
  clearTimeout(zoomSave);
  zoomSave = setTimeout(store, 400);
}
let zoomSave = null;

function zoomBy(fx, fy) {
  settings.zoomX = clamp(settings.zoomX * fx, ZOOM_X);
  settings.zoomY = clamp(settings.zoomY * fy, ZOOM_Y);
  store();
  render();
}

// All grids scroll sideways together, so their beats line up.
let scrollX = 0;
function syncScroll(from) {
  for (const item of canvases) if (item.wrap !== from && item.wrap.scrollLeft !== scrollX) item.wrap.scrollLeft = scrollX;
}
function onGridScroll(wrap) {
  if (wrap.scrollLeft !== scrollX) {
    scrollX = wrap.scrollLeft;
    syncScroll(wrap);
  }
  // Piano rolls keep their keys on screen.
  if (canvases.some((item) => item.roll && item.wrap === wrap && item.ox !== wrap.scrollLeft)) {
    cancelAnimationFrame(redraw);
    redraw = requestAnimationFrame(drawAll);
  }
}
let redraw = 0;

function sizeCanvas(item, g) {
  const width = item.wrap.clientWidth || 800;
  item.cw = cellWidth(g, width);
  if (item.roll) item.rowH = Math.round(ROLL_ROW * settings.zoomY);
  item.ox = item.roll ? item.wrap.scrollLeft : 0;
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
  drawHeads();
}

/* The playhead: a strip over each grid, moved without redrawing the grid. */
function drawHeads() {
  for (const item of canvases) {
    let bar = item.wrap.querySelector('.playhead');
    if (!bar) {
      bar = h('div', { class: 'playhead' });
      item.wrap.append(bar);
    }
    bar.hidden = head < 0;
    if (head < 0) continue;
    bar.style.left = `${GUTTER + head * item.cw}px`;
    bar.style.width = `${item.cw}px`;
    bar.style.height = `${item.rows * item.rowH}px`;
  }
}
window.addEventListener('resize', () => drawAll());

/* Columns: shaded by bar of 2/4, lines on 16ths, beats and bars. */
function columns(c, item, g, hgt) {
  const n = steps(g);
  for (let s = 0; s < n; s++) {
    const x = GUTTER + s * item.cw;
    c.fillStyle = Math.floor(s / (per(g) * 2)) % 2 ? '#F3EEE1' : '#FFFFFF';
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

function noteFill(v, quiet = false) {
  return `rgba(47, 74, 58, ${(0.35 + 0.65 * Math.min(1, v ?? 0.8)) * (quiet ? 0.3 : 1)})`;
}

/* A picked note's outline. */
function outline(c) {
  c.lineWidth = 2;
  c.strokeStyle = PICKED;
  c.stroke();
  c.lineWidth = 1;
}

/* Over a grid: the cursor (with step recording, the step and length the next chord takes in the
   keyboard's piano roll) and the box being dragged. */
function overlay(c, item, g) {
  const hgt = item.rows * item.rowH;
  if (cursorShown()) {
    const x = GUTTER + cursor * item.cw;
    if (rec && item.roll && item.tr === midiTrack(g)) {
      c.fillStyle = 'rgba(217, 130, 43, .14)';
      c.fillRect(x, 0, Math.min(settings.len, steps(g) - cursor) * item.cw, hgt);
    }
    c.fillStyle = PICKED;
    c.fillRect(x - 1, 0, 2, hgt);
  }
  if (item.box) {
    const b = item.box;
    const x = Math.min(b.x0, b.x1);
    const y = Math.min(b.y0, b.y1);
    c.fillStyle = 'rgba(217, 130, 43, .1)';
    c.fillRect(x, y, Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    c.strokeStyle = PICKED;
    c.setLineDash([4, 3]);
    c.strokeRect(x + 0.5, y + 0.5, Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    c.setLineDash([]);
  }
}

function hitCard(g, hits) {
  const wrap = h('div', { class: 'gridwrap', onscroll: () => onGridScroll(wrap) });
  const heads = h('div', { class: 'heads' }, hits.map((tr) => h('div', { class: `head${audible(tr) ? '' : ' quiet'}`, style: `height:${HIT_ROW}px` },
    mixTools(tr), trackTools(g, tr, 'hit'))));
  const item = makeCanvas(wrap, hits.length, HIT_ROW, (c, it) => {
    const hgt = it.rows * it.rowH;
    c.clearRect(0, 0, GUTTER + steps(g) * it.cw, hgt);
    columns(c, it, g, hgt);
    hits.forEach((tr, r) => {
      const y = r * HIT_ROW;
      c.strokeStyle = '#E4DCC8';
      c.beginPath();
      c.moveTo(0, y + HIT_ROW - 0.5);
      c.lineTo(GUTTER + steps(g) * it.cw, y + HIT_ROW - 0.5);
      c.stroke();
      const quiet = !audible(tr);
      for (const n of tr.notes) {
        c.fillStyle = noteFill(n.v, quiet);
        const pad = Math.max(2, it.cw * 0.12);
        c.beginPath();
        c.roundRect(GUTTER + n.s * it.cw + pad, y + 6, it.cw - pad * 2, HIT_ROW - 12, 4);
        c.fill();
        if (sel.has(n)) outline(c);
      }
    });
    overlay(c, it, g);
  }, (e, it) => hitDown(e, it, g, hits));
  item.id = 'hits';
  item.rects = () => hits.flatMap((tr, r) => tr.notes.map((n) => ({ n, x: GUTTER + n.s * item.cw, y: r * HIT_ROW, w: item.cw, h: HIT_ROW })));
  wrap.append(item.canvas);
  return h('section', { class: 'card' }, h('div', { class: 'card-top' }, h('h2', {}, 'Percussion')), h('div', { class: 'split' }, heads, wrap));
}

/* A press on the percussion grid. Draw: paint hits along the row (on from an empty step, off
   from a hit), or move the picked ones. Select: pick. */
function hitDown(e, item, g, hits) {
  const at = cellAt(e, item);
  if (!at) return;
  const tr = hits[at.row];
  if (!tr) return;
  const n = tr.notes.find((x) => x.s === at.col);
  const picking = settings.tool === 'select' || e.shiftKey;
  if (n && (picking || sel.has(n))) { noteDown(e, item, g, tr, n, false); return; }
  if (picking) { boxDown(e, item, g, at); return; }
  sel.clear();
  selBars = null;
  touch(item);
  const had = !!n;
  const set = (col) => {
    const i = tr.notes.findIndex((x) => x.s === col);
    if (had && i >= 0) tr.notes.splice(i, 1);
    if (!had && i < 0) { tr.notes.push({ s: col, v: vel() }); preview(tr, null); }
    sortNotes(tr);
    drawAll();
  };
  set(at.col);
  drag(e, item, (a) => { if (a.fresh && a.row === at.row) set(a.col); });
}

const range = (tr) => nt.rollRange(index.instruments[tr.inst]?.zones, tr.notes);
const noteAt = (tr, col, m) => tr.notes.find((n) => n.m === m && col >= n.s && col < n.s + (n.l || 1));

/* The notes of the other pitched parts that sound with a track: the rest of its take, and the
   main takes of the other layers that play with its layer (the breakdown plays alone). */
function ghostNotes(g, tr) {
  const out = [];
  const add = (list) => { for (const t of list) if (t !== tr && !isHit(t.inst)) out.push(...t.notes); };
  add(editTracks(g));
  const alone = settings.layer === 'breakdown';
  for (const l of snd.ALL_LAYERS) if (l !== settings.layer && (l === 'breakdown') === alone) add(g.layers[l] || []);
  return out;
}

function rollCard(g, tr) {
  const { lo, hi } = range(tr);
  const rows = hi - lo + 1;
  const key = keyOf(tr);
  const wrap = h('div', { class: 'gridwrap roll' });
  const rowOf = (m) => hi - m;
  const item = makeCanvas(wrap, rows, ROLL_ROW, (c, it) => {
    const R = it.rowH;
    const hgt = rows * R;
    const w = GUTTER + steps(g) * it.cw;
    const K = whole().key;
    c.clearRect(0, 0, w, hgt);
    columns(c, it, g, hgt);
    for (let m = hi; m >= lo; m--) {
      const y = rowOf(m) * R;
      const pc = ((m % 12) + 12) % 12;
      const deg = (pc - K + 12) % 12;
      if (!nt.MAJOR.includes(deg)) { c.fillStyle = settings.keyLock ? 'rgba(47,74,58,.17)' : 'rgba(47,74,58,.07)'; c.fillRect(GUTTER, y, w - GUTTER, R); }
      if (deg === 0) { c.fillStyle = 'rgba(233,180,76,.16)'; c.fillRect(GUTTER, y, w - GUTTER, R); }
      c.strokeStyle = pc === 0 ? '#C9CFC4' : '#EFEBE0';
      c.beginPath();
      c.moveTo(GUTTER, y + R - 0.5);
      c.lineTo(w, y + R - 0.5);
      c.stroke();
    }
    if (settings.ghosts) {
      c.fillStyle = GHOST;
      for (const n of ghostNotes(g, tr)) {
        if (!(n.m >= lo && n.m <= hi)) continue;
        c.beginPath();
        c.roundRect(GUTTER + n.s * it.cw + 1, rowOf(n.m) * R + 1, Math.max(1, n.l || 1) * it.cw - 2, R - 2, 3);
        c.fill();
      }
    }
    const quiet = !audible(tr);
    for (const n of tr.notes) {
      c.fillStyle = noteFill(n.v, quiet);
      c.beginPath();
      c.roundRect(GUTTER + n.s * it.cw + 1, rowOf(n.m) * R + 1, Math.max(1, n.l || 1) * it.cw - 2, R - 2, 3);
      c.fill();
      if (sel.has(n)) outline(c);
    }
    overlay(c, it, g);
    // The keys, drawn last at the left edge of what's on screen, so they stay put when the
    // roll scrolls sideways.
    const ox = it.ox;
    c.fillStyle = '#FFFFFF';
    c.fillRect(ox, 0, GUTTER, hgt);
    for (let m = hi; m >= lo; m--) {
      const y = rowOf(m) * R;
      const pc = ((m % 12) + 12) % 12;
      c.fillStyle = BLACK.includes(pc) ? '#3E5446' : '#FBF8F0';
      c.fillRect(ox, y, GUTTER - 2, R);
      c.fillStyle = BLACK.includes(pc) ? '#F6F1E4' : '#5B6B5F';
      c.font = `${pc === 0 ? 600 : 400} ${Math.min(13, Math.max(10, R - 5))}px Fredoka, sans-serif`;
      c.fillText(`${NAMES[pc]}${Math.floor(m / 12) - 1}`, ox + 4, y + R - Math.max(4, (R - 10) / 2));
    }
  }, (e, it) => rollDown(e, it, g, tr, lo, hi), (e, it) => {
    // Hover: a resize cursor over a note's right end, a hand over the rest of it, a crosshair
    // where Select drags a box.
    const at = cellAt(e, it);
    const n = at && noteAt(tr, at.col, hi - at.row);
    it.canvas.style.cursor = !n ? (at && settings.tool === 'select' ? 'crosshair' : '') : atEnd(e, it, n) ? 'ew-resize' : 'grab';
  }, true);
  item.id = key;
  item.tr = tr;
  item.lo = lo;
  item.hi = hi;
  item.center = hi - (tr.notes.length ? Math.round(tr.notes.reduce((a, n) => a + n.m, 0) / tr.notes.length) : Math.round((lo + hi) / 2));
  item.rects = () => tr.notes.map((n) => ({ n, x: GUTTER + n.s * item.cw, y: rowOf(n.m) * item.rowH, w: Math.max(1, n.l || 1) * item.cw, h: item.rowH }));
  wrap.addEventListener('scroll', () => {
    rollTops.set(key, hi + 1 - wrap.scrollTop / item.rowH);
    onGridScroll(wrap);
  });
  wrap.append(item.canvas);
  const keys = midiOn && midiTrack(g) === tr;
  return h('section', { class: `card${keys ? ' midi' : ''}` },
    h('div', { class: 'card-top' }, h('h2', {}, label(tr.inst), keys ? h('span', { class: 'keys', title: 'The MIDI keyboard plays this one' }, ' 🎹') : null),
      h('span', { class: 'grow' }), transposeTools(g, tr), mixTools(tr), trackTools(g, tr, 'pitched')),
    wrap);
}

/* Where in its row the pointer is: 0 at the top edge, 1 at the bottom. */
function rowFrac(e, item) {
  const y = (e.clientY - item.canvas.getBoundingClientRect().top) / item.rowH;
  return y - Math.floor(y);
}

/* A press on a piano roll. Draw: a new note (dragged longer), or a note pressed. Select (or
   Shift): a box, or a note pressed. The roll becomes the MIDI keyboard's. */
function rollDown(e, item, g, tr, lo, hi) {
  const was = target;
  target = item.id;
  if (midiOn && was !== target) document.querySelectorAll('.card.midi').forEach((x) => x.classList.remove('midi'));
  const at = cellAt(e, item);
  if (!at) return;
  const m0 = hi - at.row;
  const hit = noteAt(tr, at.col, m0);
  if (hit) { noteDown(e, item, g, tr, hit, true); return; }
  if (settings.tool === 'select' || e.shiftKey) { boxDown(e, item, g, at); return; }
  // Key lock: the nearest row in the key, the way the pointer leans in its row.
  const m = settings.keyLock ? nt.snapToKey(m0, whole().key, rowFrac(e, item) < 0.5) : m0;
  if (m < lo || m > hi) return;
  const there = noteAt(tr, at.col, m);
  if (there) { noteDown(e, item, g, tr, there, true); return; }
  sel.clear();
  selBars = null;
  touch(item);
  const n = { s: at.col, m, l: Math.min(settings.len, steps(g) - at.col), v: vel() };
  const after = () => { cursor = n.s + n.l >= steps(g) ? 0 : n.s + n.l; };
  tr.notes.push(n);
  sortNotes(tr);
  after();
  preview(tr, m);
  drawAll();
  drag(e, item, (a) => {
    const l = Math.max(1, Math.min(steps(g) - n.s, a.col - n.s + 1));
    if (l !== n.l) { n.l = l; after(); drawAll(); }
  }, { anyCell: true });
}

/* A press on a note. Dragging its body moves it, and every picked note with it if it's
   picked, by the cells the pointer has gone from where it pressed (half a cell or row
   counts), so a shaky click doesn't move it; dragging its right end stretches it. A click
   without a drag: Draw takes the note out, Select picks just it, Shift adds or drops it. */
function noteDown(e, item, g, tr, n, roll) {
  const select = settings.tool === 'select';
  const wasPicked = sel.has(n);
  if (e.shiftKey && !wasPicked) { sel.add(n); selBars = null; }
  else if (select && !wasPicked) { sel.clear(); sel.add(n); selBars = null; }
  const tracks = editTracks(g);
  const owner = new Map();
  for (const t of tracks) for (const x of t.notes) owner.set(x, t);
  const items = (sel.has(n) ? [...sel] : [n]).filter((x) => owner.has(x)).map((x) => {
    const t = owner.get(x);
    const hit = isHit(t.inst);
    const r = hit ? null : range(t);
    return nt.moving(x, hit, r?.lo, r?.hi);
  });
  const me = items.find((it) => it.n === n);
  const end = roll && atEnd(e, item, n);
  const key = lockKey();
  let asked = { dc: 0, dp: 0, dl: 0 };
  let strayed = false;
  item.canvas.style.cursor = end ? 'ew-resize' : 'grabbing';
  drawAll();
  drag(e, item, (a) => {
    if (end) {
      const dl = Math.max(1, Math.min(steps(g) - n.s, a.col - n.s + 1)) - me.l;
      if (dl === asked.dl) return;
      asked = { ...asked, dl };
      strayed = true;
      touch(item);
      for (const it of items) if (!it.hit) it.n.l = Math.max(1, Math.min(steps(g) - it.s, it.l + dl));
      drawAll();
      return;
    }
    const dc = Math.round(a.dx / item.cw);
    let dp = 0;
    if (roll) {
      const semis = -Math.round(a.dy / item.rowH);
      if (key == null || !semis) dp = semis;
      else {
        const exact = me.m - a.dy / item.rowH;
        let to = me.m + semis;
        if (!nt.inKey(to, key)) to = exact > to ? to + 1 : to - 1;
        dp = nt.scaleSteps(me.m, to, key);
      }
    }
    if (dc === asked.dc && dp === asked.dp) return;
    asked = { ...asked, dc, dp };
    strayed = true;
    touch(item);
    const pitch = n.m;
    nt.shiftNotes(items, { dc, dp, steps: steps(g), key });
    if (roll && n.m !== pitch) preview(tr, n.m);
    drawAll();
  }, { anyCell: true, end: () => {
    item.canvas.style.cursor = '';
    if (!strayed) {
      if (e.shiftKey) { if (wasPicked) sel.delete(n); }
      else if (select) { if (wasPicked && sel.size > 1) { sel.clear(); sel.add(n); selBars = null; } }
      else { touch(item); tr.notes.splice(tr.notes.indexOf(n), 1); sel.delete(n); }
      return;
    }
    const moved = new Set(items.map((it) => it.n));
    for (const t of tracks) { nt.dropCovered(t.notes, moved); sortNotes(t); }
  } });
}

/* Select's box: drag it over notes to pick them (Shift adds). A click puts the cursor there
   (and drops the picks); a double-click picks the bar. */
let lastTap = null;
function boxDown(e, item, g, at) {
  const t = performance.now();
  if (lastTap && lastTap.id === item.id && t - lastTap.t < 450 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 16) {
    lastTap = null;
    e.preventDefault();
    pickBar(g, at.col, e.shiftKey);
    return;
  }
  const keep = e.shiftKey ? [...sel] : [];
  const where = (ev) => {
    const r = item.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  const p0 = where(e);
  drag(e, item, (a) => {
    const p = where(a.ev);
    item.box = { x0: p0.x, y0: p0.y, x1: p.x, y1: p.y };
    const x0 = Math.min(p0.x, p.x);
    const x1 = Math.max(p0.x, p.x);
    const y0 = Math.min(p0.y, p.y);
    const y1 = Math.max(p0.y, p.y);
    sel.clear();
    for (const n of keep) sel.add(n);
    for (const r of item.rects()) if (r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0) sel.add(r.n);
    selBars = null;
    drawAll();
  }, { anyCell: true, abort: () => { item.box = null; }, end: (dragged) => {
    item.box = null;
    if (dragged) return;
    if (!e.shiftKey) { sel.clear(); selBars = null; }
    cursor = at.col;
    lastTap = { id: item.id, t, x: e.clientX, y: e.clientY };
  } });
}

function cellAt(e, item) {
  const r = item.canvas.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  if (x - item.ox < GUTTER) return null;
  const col = Math.floor((x - GUTTER) / item.cw);
  const row = Math.floor(y / item.rowH);
  if (col < 0 || col >= steps(now()) || row < 0 || row >= item.rows) return null;
  return { col, row };
}

/* The cell under the pointer, kept inside the grid. */
function clampedCell(ev, item) {
  const r = item.canvas.getBoundingClientRect();
  return {
    col: Math.max(0, Math.min(steps(now()) - 1, Math.floor((ev.clientX - r.left - GUTTER) / item.cw))),
    row: Math.max(0, Math.min(item.rows - 1, Math.floor((ev.clientY - r.top) / item.rowH))),
  };
}

/* Is the pointer on a note's right end (its last third, at least 8 px, or the right half of a
   one-step note)? There a drag changes its length. */
function atEnd(e, item, n) {
  const x = e.clientX - item.canvas.getBoundingClientRect().left - GUTTER;
  const right = (n.s + (n.l || 1)) * item.cw;
  const zone = (n.l || 1) === 1 ? item.cw / 2 : Math.max(8, Math.min(item.cw, ((n.l || 1) * item.cw) / 3));
  return x >= right - zone;
}

/* Follows the pointer until it lifts. Once it has gone far enough to be a drag (SLOP), move
   gets the cell under it (kept inside the grid with anyCell), whether that cell is new, and how
   far the pointer has come (dx, dy); then end(dragged). Saves and redraws the page. */
function drag(e, item, move, { anyCell = false, end = null, abort = null } = {}) {
  e.preventDefault();
  try { item.canvas.setPointerCapture(e.pointerId); } catch { /* the pointer is gone */ }
  const x0 = e.clientX;
  const y0 = e.clientY;
  const slop = SLOP[e.pointerType] ?? SLOP.mouse;
  let dragging = false;
  let last = cellAt(e, item);
  const onMove = (ev) => {
    if (ev.pointerId !== e.pointerId) return;
    const dx = ev.clientX - x0;
    const dy = ev.clientY - y0;
    if (!dragging && Math.hypot(dx, dy) < slop) return;
    dragging = true;
    const at = anyCell ? clampedCell(ev, item) : cellAt(ev, item);
    if (!at) return;
    const fresh = !last || at.col !== last.col || at.row !== last.row;
    last = at;
    move({ ...at, fresh, dx, dy, ev });
  };
  const off = () => {
    item.canvas.removeEventListener('pointermove', onMove);
    item.canvas.removeEventListener('pointerup', onUp);
    item.canvas.removeEventListener('pointercancel', onUp);
    item.abort = null;
  };
  const onUp = (ev) => {
    if (ev.pointerId !== e.pointerId) return;
    off();
    if (end) end(dragging);
    changed();
  };
  // A second finger: stop here; makeCanvas takes the change back.
  item.abort = () => { off(); abort?.(); };
  item.canvas.addEventListener('pointermove', onMove);
  item.canvas.addEventListener('pointerup', onUp);
  item.canvas.addEventListener('pointercancel', onUp);
}

/* Piano rolls open scrolled to their notes (or the middle of the instrument), then keep the
   same pitch at the top through redraws, Undo, Restore and zoom. */
function centerRolls() {
  for (const item of canvases) {
    item.wrap.scrollLeft = scrollX;
    if (!item.roll) continue;
    const top = rollTops.get(item.id);
    if (top != null) item.wrap.scrollTop = (item.hi + 1 - top) * item.rowH;
    else {
      item.wrap.scrollTop = Math.max(0, item.center * item.rowH - item.wrap.clientHeight / 2);
      rollTops.set(item.id, item.hi + 1 - item.wrap.scrollTop / item.rowH);
    }
  }
  // Keys follow the sideways scroll just set.
  if (canvases.some((item) => item.roll && item.ox !== item.wrap.scrollLeft)) drawAll();
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

/* ---------- the grooves in the game ---------- */

let live = null; // what the game plays now: { list, at, from: 'live' | 'repo', ok: false if the site didn't answer }
let shopPrice = 60; // a groove's price in the record shop when it has none (the avatar shop editor's)
async function loadLive() {
  try { shopPrice = (await siteShop()).groovePrice; } catch { /* keep the last */ }
  try {
    const r = await fetch('/api/live/grooves.json', { cache: 'no-store' });
    if (!r.ok && r.status !== 404) throw new Error(`the site said ${r.status}`);
    const data = r.ok ? await r.json() : null;
    if (data?.grooves?.length) {
      live = { list: snd.checkGrooves(data.grooves), at: r.headers.get('Last-Modified'), from: 'live', ok: true };
      return;
    }
    // Nothing published: the game plays the repo's grooves.
    const repo = await fetch('/musician-maker/grooves.json', { cache: 'no-store' });
    if (!repo.ok) throw new Error(`the site said ${repo.status}`);
    live = { list: snd.checkGrooves((await repo.json())?.grooves || []), at: null, from: 'repo', ok: true };
  } catch {
    live = { list: live?.list || [], at: live?.at || null, from: live?.from || 'repo', ok: false };
  }
}
const gameCount = () => (live?.list || []).filter((g) => !g.hidden).length;
const sameGroove = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The free one: the first with a 2/4 version (the game's Unit 1 meter), or Basic.
const freeGroove = (list) => list.find((g) => g.versions['2/4']) || list[0];

/* Each groove of this device's list in the game's order: hear it, rename it, move it, price
   it, take it out of the record shop, edit it, remove it. Below them, any the game has that
   this device doesn't. */
let hearing = null;
function renderGame() {
  canvases.length = 0;
  const restore = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: () => { restoreFile(restore.files[0]); restore.value = ''; } });
  const liveById = new Map((live?.list || []).map((g) => [g.id, g]));
  const checked = snd.checkGrooves(grooves);
  const free = freeGroove(checked);
  const defaultPrice = shopPrice;
  const move = (i, d) => { snapshot(); const [g] = grooves.splice(i, 1); grooves.splice(i + d, 0, g); changed(); };
  const row = (G, i) => {
    const g = checked.find((x) => x.id === G.id);
    const was = liveById.get(G.id);
    const state = !was ? ['new', 'Not in the game yet'] : g && sameGroove(was, g) ? ['live', 'In the game'] : ['changed', 'Changed here'];
    const isFree = g === free || G.id === 'basic';
    const on = hearing === G.id && playing;
    return h('li', { class: `gg-row ${state[0]} ${G.hidden ? 'hidden' : ''}` },
      h('span', { class: 'gg-move' },
        h('button', { class: 'icon', title: 'Earlier', 'aria-label': `Move ${G.name} up`, disabled: i === 0, onclick: () => move(i, -1) }, '▲'),
        h('button', { class: 'icon', title: 'Later', 'aria-label': `Move ${G.name} down`, disabled: i === grooves.length - 1, onclick: () => move(i, 1) }, '▼')),
      h('button', { class: `gg-play ${on ? 'on' : ''}`, 'aria-label': on ? 'Stop' : `Hear ${G.name}`, onclick: () => hear(G) }, on ? '■' : '▶'),
      h('span', { class: 'gg-name' },
        h('input', { class: 'name small', value: G.name, 'aria-label': 'Name', onchange: (e) => { snapshot(); G.name = e.target.value.trim() || G.name; changed(); } }),
        h('small', {}, `${Object.keys(G.versions).join(' · ')}  ${['bass', 'drums', 'horns', 'band'].map((l) => snd.layerInfo(G, l).icon).join('')}`)),
      h('span', { class: `gg-state ${state[0]}` }, state[1]),
      isFree ? h('span', { class: 'gg-price free' }, 'Free')
        : h('label', { class: 'gg-price', title: `Music notes in the record shop (empty: ${defaultPrice})` }, '♪',
          h('input', { type: 'number', min: 0, max: 999, step: 1, value: G.price ?? '', placeholder: String(defaultPrice), 'aria-label': `${G.name} price`,
            onchange: (e) => {
              snapshot();
              const n = Math.round(Number(e.target.value));
              if (e.target.value === '' || !Number.isFinite(n)) delete G.price; else G.price = Math.max(0, Math.min(999, n));
              changed();
            } })),
      h('label', { class: 'gg-shop', title: 'Off: out of the record shop and the music. Anyone who bought it keeps it.' },
        h('input', { type: 'checkbox', checked: !G.hidden, onchange: (e) => { snapshot(); if (e.target.checked) delete G.hidden; else G.hidden = true; changed(); } }), 'In the shop'),
      h('button', { onclick: () => { settings.groove = G.id; settings.view = 'edit'; stop(); store(); render(); } }, 'Edit'),
      grooves.length > 1 ? confirmButton('Remove', 'Remove?', () => { snapshot(); forget(`${G.id}|`); grooves = grooves.filter((x) => x !== G); if (settings.groove === G.id) settings.groove = grooves[0].id; changed(); }) : null);
  };
  const gone = (live?.list || []).filter((g) => !grooves.some((x) => x.id === g.id));
  const when = live?.at ? new Date(live.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
  const differs = live && (gone.length || checked.some((g) => !liveById.has(g.id) || !sameGroove(liveById.get(g.id), g)) || checked.map((g) => g.id).join() !== live.list.map((g) => g.id).join());
  app.replaceChildren(...[
    header(restore),
    h('div', { class: 'bar gg-summary' },
      h('span', { class: 'total' }, !live ? 'Checking the game…'
        : !live.ok ? 'Couldn\'t reach the game'
        : live.from === 'live' ? `Live: ${live.list.length} groove${live.list.length === 1 ? '' : 's'}${when ? `, published ${when}` : ''}`
          : `Nothing published: the game plays the repo's ${live.list.length}`),
      differs ? h('span', { class: 'gg-state changed' }, 'Publish to put this list in the game') : live ? h('span', { class: 'gg-state live' }, 'Same as the game') : null,
      h('span', { class: 'grow' }),
      h('span', { class: 'label' }, 'Tempo'),
      seg({ 92: '92', 108: '108', 126: '126' }, settings.bpm, (v) => { settings.bpm = Number(v); store(); if (playing) play(); else render(); }),
      live?.list.length ? confirmButton('Load what\'s in the game', 'Replace this list?', () => {
        snapshot();
        grooves = structuredClone(live.list);
        settings.groove = grooves[0]?.id;
        status = 'Loaded the game\'s grooves.';
        changed();
      }) : null),
    h('ol', { class: 'gg-list' }, grooves.map(row)),
    gone.length ? h('h2', { class: 'gg-gone-head' }, 'In the game, not on this device') : null,
    gone.length ? h('ul', { class: 'gg-list gone' }, gone.map((g) => h('li', { class: 'gg-row gone' },
      h('span', { class: 'gg-name' }, h('b', {}, g.name), h('small', {}, Object.keys(g.versions).join(' · '))),
      h('span', { class: 'gg-state gone' }, 'Leaves the game when you publish'),
      h('button', { onclick: () => { snapshot(); grooves.push(structuredClone(g)); changed(); } }, 'Bring it back')))) : null,
    status ? h('p', { class: 'status' }, status) : null,
  ].filter(Boolean));
}

/* Hear a groove from the list: the whole band, at the tempo picked. */
function hear(G) {
  if (playing && hearing === G.id) { stop(); hearing = null; return; }
  settings.groove = G.id;
  settings.meter = G.versions['2/4'] ? '2/4' : Object.keys(G.versions)[0];
  settings.hear = 'band';
  settings.variant = -1;
  hearing = G.id;
  store();
  play();
}

/* ---------- save for site, restore ---------- */

const siteText = () => `{"grooves":[\n${snd.checkGrooves(grooves).map((g) => JSON.stringify(g)).join(',\n')}\n]}\n`;
const plural = (n) => `${n} groove${n === 1 ? '' : 's'}`;

/* A question in front of the page: resolves true for yes. */
function ask(title, names, yes) {
  return new Promise((done) => {
    const d = h('dialog', { class: 'ask' },
      h('h2', {}, title),
      names.length ? h('ul', {}, names.map((n) => h('li', {}, n))) : null,
      h('div', { class: 'bar' }, h('span', { class: 'grow' }),
        h('button', { onclick: () => d.close('no') }, 'Cancel'),
        h('button', { class: 'go', onclick: () => d.close('yes') }, yes)));
    d.addEventListener('close', () => { d.remove(); done(d.returnValue === 'yes'); }, { once: true });
    document.body.append(d);
    d.showModal();
  });
}

/* Straight to the game: the next time a kid opens Musician Maker, these are the grooves. First,
   a look at what the game has now: if this list would take any groove out of it, say which and
   ask. */
let publishing = false;
async function publish() {
  if (publishing) return;
  publishing = true;
  render();
  try {
    await loadLive();
    const gone = live.ok ? live.list.filter((g) => !grooves.some((x) => x.id === g.id)) : null;
    const sure = !gone ? await ask('Couldn\'t check what\'s in the game. Publish anyway?', [], 'Publish')
      : gone.length ? await ask(`Take ${gone.length === 1 ? 'this groove' : `these ${gone.length} grooves`} out of the game?`, gone.map((g) => g.name), 'Publish')
        : true;
    if (!sure) {
      status = '';
      return;
    }
    const r = await fetch('/studio/api/live/grooves', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: siteText() });
    if (r.status === 401) throw new Error('your sign-in ran out. Reload the page and try again');
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `the site said ${r.status}`);
    status = `Published ${plural(grooves.length)}. They're in Musician Maker now (reload the game if it's open).`;
    await loadLive();
  } catch (e) {
    status = `Couldn't publish: ${e.message}`;
  } finally {
    publishing = false;
    render();
  }
}

function download() {
  const text = siteText();
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: 'grooves.json', hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  status = `Downloaded grooves.json with ${plural(grooves.length)}, a backup you can Restore.`;
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
  if (e.target.closest('input, select, textarea, summary, dialog')) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === 'z') { e.preventDefault(); undo(e.shiftKey); return; }
  if (mod && k === 'y') { e.preventDefault(); undo(true); return; }
  const g = settings.view === 'edit' ? now() : null;
  if (g) {
    if (mod && k === 'a') { e.preventDefault(); pickAll(g); return; }
    if (mod && (k === 'c' || k === 'x')) { if (sel.size) { e.preventDefault(); copySel(g, k === 'x'); } return; }
    if (mod && k === 'v') { if (clip) { e.preventDefault(); paste(g); } return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (sel.size) { e.preventDefault(); deleteSel(g); } else if (rec) { e.preventDefault(); stepBack(g); }
      return;
    }
    if (e.key === 'Escape' && sel.size) { sel.clear(); selBars = null; render(); return; }
    if (e.key.startsWith('Arrow') && !mod && !e.altKey) {
      if (sel.size) { e.preventDefault(); nudge(g, e.key, e.shiftKey); return; }
      const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (d && cursorShown()) {
        // The cursor: by the note length (a rest when step recording).
        e.preventDefault();
        if (rec && entry) endEntry(g, false);
        const n = steps(g);
        cursor = (((cursor + d * settings.len) % n) + n) % n;
        drawAll();
      }
      return;
    }
  }
  if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); if (playing) stop(); else play(); }
});

start();
