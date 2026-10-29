/* Voice recorder: Kyle's own voice for the patterns of each Conversational Solfege unit,
   a few takes of each at three speeds.
   A unit brings in rhythm cells in a meter, or tonal syllables (assets/patterns/patterns.js);
   its patterns are generated from them, then Kyle removes the ones he doesn't want and marks
   the rest familiar or unfamiliar. Each take is recorded after a count-in (tonal ones after the
   key on the piano), stops on its own after the pattern, is trimmed to the voice and saved as a
   small mp3 (24 kHz mono) on this device (IndexedDB 'mwm-voice'). "Save for site" writes
   voice-kyle.zip (every take, tagged by pattern, plus the units) for tools/add_takes.py. */

import * as samples from '/assets/sounds/samples.js';
import { METERS, TONALITIES, KEYS, DEFAULT_UNITS, unitPatterns, conceptLabel, toneMidi, patternById } from '/assets/patterns/patterns.js';
import { notation } from '/assets/patterns/notation.js';
import { h, confirmButton } from '../dom.js';
import { makeZip, readZip } from './zip.js';

const app = document.getElementById('app');
const SPEEDS = { slow: 'Slow', medium: 'Medium', fast: 'Fast' };
const MARKS = { familiar: 'Familiar', unfamiliar: 'Unfamiliar' };
const FILTERS = { all: 'All', familiar: 'Familiar', unfamiliar: 'Unfamiliar', unmarked: 'Unmarked' };
const KINDS = { rhythm: 'Rhythm', tonal: 'Tonal' };
const ZIP_NAME = 'voice-kyle.zip';

/* ---------- Storage ---------- */

// takes: { id, pattern, speed, bpm, key (sounding midi of do or la; null for rhythm), created, seconds, mp3 }
// misc: 'units' (the unit list), 'folder' (where Save for site writes)
// (lines is the first version's text list, kept so nothing recorded with it is lost.)
let dbPromise = null;
function db() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('mwm-voice', 3);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('lines')) d.createObjectStore('lines', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('takes')) d.createObjectStore('takes', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('misc')) d.createObjectStore('misc');
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Close the recorder in other tabs, then reload'));
  });
  return dbPromise;
}

function store(name) {
  const run = (mode, fn) => db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(name, mode);
    const req = fn(t.objectStore(name));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
  }));
  return {
    all: () => run('readonly', (s) => s.getAll()),
    get: (key) => run('readonly', (s) => s.get(key)),
    put: (value, key) => run('readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key))),
    delete: (key) => run('readwrite', (s) => s.delete(key)),
  };
}
const takeStore = store('takes');
const misc = store('misc');

const SETTINGS = 'mwm-voice-settings-3';
const settings = {
  voice: 'kyle',
  unit: 'unit-1',
  key: { major: 48, minor: 45 },
  bpm: { slow: 60, medium: 80, fast: 100 },
  speed: 'medium',
  want: 3,
  countIn: 4,
  firstNote: true,
  mic: '',
  filter: 'all',
  folder: '', // its name
};
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS)) || {}); } catch { /* defaults */ }
function save() {
  try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch { /* not kept */ }
}

const keyName = (tonality, midi) => KEYS[tonality].find((k) => k.midi === midi)?.name || '';
const pretty = (name) => name.replace('b', '♭').replace('#', '♯');

/* ---------- Microphone ---------- */

let mic = null;
let micError = '';
let devices = [];
let meterCtx = null;
let analyser = null;

async function startMic(deviceId) {
  stopMic();
  micError = '';
  try {
    mic = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  } catch (e) {
    if (deviceId && e.name === 'OverconstrainedError') return startMic('');
    micError = {
      NotAllowedError: 'Microphone blocked: allow it in the address bar, then reload',
      NotFoundError: 'No microphone found',
      NotReadableError: 'The microphone is in use by another app',
    }[e.name] || `Microphone: ${e.message}`;
    return;
  }
  const track = mic.getAudioTracks()[0];
  settings.mic = track.getSettings().deviceId || deviceId || '';
  save();
  track.onended = () => { stopMic(); micError = 'The microphone was disconnected'; render(); };
  devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  meter(track);
}

function stopMic() {
  mic?.getTracks().forEach((t) => t.stop());
  mic = null;
  analyser = null;
  meterCtx?.close();
  meterCtx = null;
}

/* The level meter has its own context at the microphone's rate: Firefox won't connect a
   microphone to a context running at another rate. The recording itself doesn't use it. */
function meter(track) {
  const rates = [track.getSettings().sampleRate, undefined, 48000, 44100, 16000];
  for (const rate of rates) {
    try {
      meterCtx = new AudioContext(rate ? { sampleRate: rate } : {});
      const source = meterCtx.createMediaStreamSource(mic);
      analyser = meterCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      meterCtx.resume();
      break;
    } catch {
      meterCtx?.close();
      meterCtx = null;
      analyser = null;
    }
  }
  if (analyser) requestAnimationFrame(meterTick);
}

let level = -100;
const meterData = new Float32Array(2048);
function meterTick() {
  if (!analyser) return;
  analyser.getFloatTimeDomainData(meterData);
  let peak = 0;
  for (const v of meterData) peak = Math.max(peak, Math.abs(v));
  // Peak level in dB, falling back slowly; the bar spans -60 to 0 dB.
  level = Math.max(peak > 0 ? 20 * Math.log10(peak) : -100, level - 1);
  const width = `${Math.max(0, Math.min(100, ((level + 60) / 60) * 100))}%`;
  for (const bar of app.querySelectorAll('.level')) {
    bar.firstChild.style.width = width;
    bar.classList.toggle('hot', level > -3);
  }
  requestAnimationFrame(meterTick);
}

// A context made without a click may start paused.
document.addEventListener('pointerdown', () => meterCtx?.resume());

/* ---------- Audio ---------- */

let ctx = null;
let claves = null;
let piano = null;

async function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    samples.setup(ctx, ctx.destination);
  }
  if (ctx.state === 'suspended') await ctx.resume();
  claves ||= await samples.instrument('claves');
  piano ||= await samples.instrument('piano', { lo: 36, hi: 72 });
  return ctx;
}

const decode = (blob) => new Promise((ok, fail) => blob.arrayBuffer().then((b) => ctx.decodeAudioData(b, ok, fail), fail));

/* Trim to the voice (ignoring anything before `from` seconds, where the count-in clicks
   may have bled in), resample to 24 kHz mono, bring up to full level and encode as mp3.
   null when nothing was heard. */
async function processTake(blob, from) {
  const decoded = await decode(blob);
  const sr = decoded.sampleRate;
  const x = new Float32Array(decoded.length);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const ch = decoded.getChannelData(c);
    for (let i = 0; i < x.length; i++) x[i] += ch[i] / decoded.numberOfChannels;
  }
  const skip = Math.max(0, Math.floor(from * sr));
  let peak = 0;
  for (let i = skip; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak < 0.003) return null;
  let first = skip;
  while (first < x.length && Math.abs(x[first]) < peak * 0.1) first++;
  let last = x.length - 1;
  while (last > first && Math.abs(x[last]) < peak * 0.03) last--;
  const start = Math.max(skip, first - Math.floor(0.02 * sr));
  const stop = Math.min(x.length, last + Math.floor(0.15 * sr));
  const part = x.slice(start, stop);

  const rate = 24000;
  const off = new OfflineAudioContext(1, Math.ceil(part.length * rate / sr), rate);
  const buf = off.createBuffer(1, part.length, sr);
  buf.copyToChannel(part, 0);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  const y = (await off.startRendering()).getChannelData(0);
  let top = 0;
  for (const v of y) top = Math.max(top, Math.abs(v));
  const fadeIn = Math.floor(0.005 * rate);
  const fadeOut = Math.min(Math.floor(0.05 * rate), y.length >> 2);
  const pcm = new Int16Array(y.length);
  for (let i = 0; i < y.length; i++) {
    let g = 0.9 / top;
    if (i < fadeIn) g *= i / fadeIn;
    if (i > y.length - fadeOut) g *= (y.length - i) / fadeOut;
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(y[i] * g * 32767)));
  }
  const enc = new window.lamejs.Mp3Encoder(1, rate, 48);
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) chunks.push(enc.encodeBuffer(pcm.subarray(i, i + 1152)));
  chunks.push(enc.flush());
  return { mp3: new Blob(chunks, { type: 'audio/mpeg' }), seconds: y.length / rate };
}

// Through Web Audio: the site's CSP keeps <audio> off blob: URLs.
let playing = null;
async function playBlob(blob) {
  await audio();
  const buffer = await decode(blob);
  try { playing?.stop(); } catch { /* already ended */ }
  playing = ctx.createBufferSource();
  playing.buffer = buffer;
  playing.connect(ctx.destination);
  playing.start();
}

/* ---------- State ---------- */

let takes = [];
let units = [];
let shown = [];
let current = null;
let recording = null;
let editing = false;
let showRemoved = false;
let status = { text: '', bad: false };
let folder = null; // where Save for site writes, once picked

const unitNow = () => units.find((u) => u.id === settings.unit) || units[0];
const takesFor = (id, speed) => takes.filter((t) => t.pattern === id && (!speed || t.speed === speed)).sort((a, b) => a.created - b.created);
const done = (id, speed) => takesFor(id, speed).length >= settings.want;
const tonicOf = (p) => (p.kind === 'tonal' ? settings.key[p.tonality] : null);
const saveUnits = () => misc.put(units, 'units');

/* Status line by the Record button. */
function say(text, bad = false) {
  status = { text, bad };
  for (const el of app.querySelectorAll('.stage .status')) {
    el.textContent = text;
    el.classList.toggle('bad', bad);
  }
}

async function show() {
  try {
    [takes, units] = await Promise.all([takeStore.all(), misc.get('units')]);
  } catch (e) {
    app.replaceChildren(h('p', { class: 'status bad' }, `Couldn't open the recordings on this device: ${e.message}`));
    return;
  }
  if (!units) {
    units = structuredClone(DEFAULT_UNITS);
    await saveUnits();
  }
  render();
}

/* ---------- Page ---------- */

function seg(options, value, onpick) {
  return h('span', { class: 'seg' }, Object.entries(options).map(([v, label]) =>
    h('button', { class: String(v) === String(value) ? 'on' : '', onclick: () => onpick(v) }, label)));
}

function number(get, set, min, max) {
  return h('input', { type: 'number', min, max, value: get(), onchange: (e) => {
    const v = Math.max(min, Math.min(max, Number(e.target.value) || get()));
    e.target.value = v;
    set(v);
    save();
    render();
  } });
}

const describe = (u) => {
  const list = (u.require.length ? u.require : u.concepts).map((c) => conceptLabel(u, c));
  return u.kind === 'rhythm' ? `${u.meter} · ${list.join(', ')}` : list.join(' ');
};

function render() {
  const u = unitNow();
  const all = u ? unitPatterns(u) : [];
  const kept = all.filter((p) => !u.removed.includes(p.id));
  const removed = all.filter((p) => u.removed.includes(p.id));
  if (!removed.length) showRemoved = false;
  const markOf = (p) => u.marks[p.id] || 'unmarked';
  const filtered = settings.filter === 'all' ? kept : kept.filter((p) => markOf(p) === settings.filter);
  shown = showRemoved ? removed : filtered;
  if (!filtered.some((p) => p.id === current)) current = (filtered.find((p) => !done(p.id, settings.speed)) || filtered[0])?.id;
  const counts = Object.fromEntries(Object.keys(FILTERS).map((f) => [f, f === 'all' ? kept.length : kept.filter((p) => markOf(p) === f).length]));

  const restore = h('input', { type: 'file', accept: '.zip,application/zip', hidden: true, onchange: () => { restoreZip(restore.files[0]); restore.value = ''; } });
  const wide = u?.kind === 'rhythm' && u.bars > 1;

  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '‹ Studio')),
    h('div', { class: 'bar' },
      h('h1', { class: 'grow' }, 'Voice recorder'),
      h('button', { onclick: () => restore.click() }, 'Restore'),
      restore,
      settings.folder && window.showDirectoryPicker ? h('button', { class: 'icon', title: 'Change folder', onclick: () => saveForSite(true) }, `Folder: ${settings.folder}`) : null,
      h('button', { class: 'primary', onclick: () => saveForSite() }, 'Save for site'),
    ),
    micBar(),
    h('div', { class: 'bar units' },
      Object.entries(KINDS).map(([kind, label]) => {
        const list = units.filter((x) => x.kind === kind);
        return list.length ? h('div', { class: 'group' },
          h('span', { class: 'label' }, label),
          h('span', { class: 'seg' }, list.map((x) => h('button', {
            class: x.id === u.id ? 'on' : '',
            onclick: () => { if (recording) return; settings.unit = x.id; showRemoved = false; save(); render(); },
          }, h('b', {}, x.name), h('small', {}, describe(x)))))) : null;
      }),
      h('button', { onclick: newUnit }, '+ Unit'),
    ),
    ...(u ? [
      h('div', { class: 'bar summary' },
        h('h2', {}, u.name),
        h('span', { class: 'total' }, `${kept.length} patterns`),
        u.kind === 'tonal' ? h('select', { onchange: (e) => { settings.key[u.tonality] = Number(e.target.value); save(); render(); } },
          KEYS[u.tonality].map((k) => h('option', { value: k.midi, selected: k.midi === settings.key[u.tonality] }, `${u.tonality === 'major' ? 'Do' : 'La'} = ${pretty(k.name)}`))) : null,
        h('span', { class: 'grow' }),
        h('button', { class: editing ? 'on' : '', onclick: () => { editing = !editing; render(); } }, editing ? 'Done' : 'Edit unit'),
      ),
      editing ? unitEditor(u) : null,
      h('div', { class: 'bar' },
        seg(Object.fromEntries(Object.entries(FILTERS).map(([f, label]) => [f, `${label} ${counts[f]}`])), showRemoved ? '' : settings.filter,
          (v) => { settings.filter = v; showRemoved = false; save(); render(); }),
        removed.length ? h('button', { class: showRemoved ? 'on' : '', onclick: () => { showRemoved = !showRemoved; render(); } }, `Removed ${removed.length}`) : null,
      ),
      h('div', { class: 'bar settings' },
        Object.entries(SPEEDS).map(([s, label]) => h('label', {}, label, number(() => settings.bpm[s], (v) => { settings.bpm[s] = v; }, 30, 220))),
        h('label', {}, 'Takes', number(() => settings.want, (v) => { settings.want = v; }, 1, 10)),
        h('label', {}, 'Count-in', number(() => settings.countIn, (v) => { settings.countIn = v; }, 1, 8)),
        u.kind === 'tonal' ? h('label', {}, h('input', { type: 'checkbox', checked: settings.firstNote, onchange: (e) => { settings.firstNote = e.target.checked; save(); } }), 'First note') : null,
      ),
      h('div', { class: `grid${wide ? ' wide' : ''}` }, shown.map((p) => card(p, u))),
      stage(u),
    ].filter(Boolean) : []),
  );
  observe();
  app.querySelector('.card.on')?.scrollIntoView({ block: 'nearest' });
}

function micBar() {
  return h('div', { class: 'bar micbar' },
    mic
      ? h('select', { title: 'Microphone', onchange: async (e) => { await startMic(e.target.value); render(); } },
        devices.map((d, i) => h('option', { value: d.deviceId, selected: d.deviceId === settings.mic }, d.label || `Microphone ${i + 1}`)))
      : h('button', { onclick: async () => { await startMic(settings.mic); render(); } }, 'Turn on microphone'),
    h('div', { class: 'level big', title: 'Microphone level' }, h('div')),
    micError ? h('span', { class: 'status bad' }, micError) : null,
  );
}

/* ---------- Units ---------- */

function unitEditor(u) {
  const change = (fn) => { fn(); current = null; saveUnits(); render(); };
  const toggle = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const options = u.kind === 'rhythm' ? Object.keys(METERS[u.meter].cells) : TONALITIES[u.tonality].tones;
  const chip = (c, on, onclick) => h('button', { class: on ? 'on' : '', onclick },
    u.kind === 'rhythm' ? `${METERS[u.meter].cells[c].glyph} ${conceptLabel(u, c)}` : conceptLabel(u, c));
  const row = (label, ...kids) => h('div', { class: 'row' }, h('span', { class: 'label' }, label), kids);

  return h('div', { class: 'editor' },
    row('Name', h('input', { class: 'name', value: u.name, onchange: (e) => change(() => { u.name = e.target.value.trim() || u.name; }) })),
    row('Kind', seg(KINDS, u.kind, (v) => change(() => {
      if (v === u.kind) return;
      Object.assign(u, v === 'rhythm'
        ? { kind: v, meter: '2/4', concepts: Object.keys(METERS['2/4'].cells), bars: 2, require: [] }
        : { kind: v, tonality: 'major', concepts: [...TONALITIES.major.defaults], length: 3, require: [] });
    }))),
    u.kind === 'rhythm'
      ? [
        row('Meter', seg(Object.fromEntries(Object.keys(METERS).map((m) => [m, m])), u.meter, (v) => change(() => {
          if (v !== u.meter) Object.assign(u, { meter: v, concepts: Object.keys(METERS[v].cells), require: [] });
        }))),
        row('Bars', seg({ 1: '1', 2: '2' }, u.bars, (v) => change(() => { u.bars = Number(v); }))),
      ]
      : [
        row('Tonality', seg(Object.fromEntries(Object.entries(TONALITIES).map(([t, x]) => [t, x.label])), u.tonality, (v) => change(() => {
          if (v !== u.tonality) Object.assign(u, { tonality: v, concepts: [...TONALITIES[v].defaults], require: [] });
        }))),
        row('Notes', seg({ 3: '3', 4: '4' }, u.length, (v) => change(() => { u.length = Number(v); }))),
      ],
    row('Concepts',
      h('span', { class: 'chips' }, options.map((c) => chip(c, u.concepts.includes(c), () => change(() => {
        u.concepts = toggle(u.concepts, c);
        u.require = u.require.filter((r) => u.concepts.includes(r));
      })))),
      u.kind === 'tonal' ? h('select', { onchange: (e) => { if (e.target.value) change(() => { u.concepts = [...TONALITIES[u.tonality].presets[e.target.value]]; u.require = []; }); } },
        h('option', { value: '' }, 'Presets…'),
        Object.keys(TONALITIES[u.tonality].presets).map((name) => h('option', { value: name }, name))) : null,
    ),
    row('New in this unit', h('span', { class: 'chips' }, u.concepts.map((c) => chip(c, u.require.includes(c), () => change(() => { u.require = toggle(u.require, c); }))))),
    h('div', { class: 'row' }, h('span', { class: 'grow' }), confirmButton('Delete unit', 'Delete?', async () => {
      units = units.filter((x) => x.id !== u.id);
      editing = false;
      await saveUnits();
      render();
    })),
  );
}

async function newUnit() {
  if (recording) return;
  const from = unitNow();
  const u = {
    id: `unit-${Date.now().toString(36)}`,
    name: `Unit ${units.length + 1}`,
    ...(from?.kind === 'tonal'
      ? { kind: 'tonal', tonality: from.tonality, concepts: [...from.concepts], length: from.length }
      : { kind: 'rhythm', meter: from?.meter || '2/4', concepts: from ? [...from.concepts] : Object.keys(METERS['2/4'].cells), bars: from?.bars || 2 }),
    require: [],
    removed: [],
    marks: {},
  };
  units.push(u);
  settings.unit = u.id;
  editing = true;
  save();
  await saveUnits();
  render();
}

function mark(u, id, value) {
  if (value) u.marks[id] = value;
  else delete u.marks[id];
  saveUnits();
  render();
}

function remove(u, id, out) {
  u.removed = out ? [...new Set([...u.removed, id])] : u.removed.filter((r) => r !== id);
  saveUnits();
  render();
}

/* ---------- Cards and stage ---------- */

function card(p, u) {
  const m = u.marks[p.id];
  const out = u.removed.includes(p.id);
  const pick = () => { if (!recording && !out) { current = p.id; render(); } };
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  const staff = h('span', { class: 'staff' });
  const key = drawKey(p);
  if (drawn.has(key)) staff.innerHTML = notation(p, tonicOf(p));
  return h('div', {
    class: `card${p.id === current && !out ? ' on' : ''}${m ? ` ${m}` : ''}${Object.keys(SPEEDS).every((s) => done(p.id, s)) ? ' complete' : ''}`,
    tabindex: 0,
    dataset: { id: p.id },
    onclick: pick,
    onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) pick(); },
  },
  staff,
  h('span', { class: 'syl' }, p.syllables),
  h('span', { class: 'counts' }, Object.entries(SPEEDS).map(([s, label]) =>
    h('span', { class: done(p.id, s) ? 'sp done' : 'sp', title: `${label}, ${settings.bpm[s]} bpm` }, `${label[0]} ${takesFor(p.id, s).length}`))),
  h('span', { class: 'marks' },
    out
      ? h('button', { onclick: stop(() => remove(u, p.id, false)) }, 'Put back')
      : [
        ...Object.entries(MARKS).map(([v, label]) => h('button', {
          class: `${v}${m === v ? ' on' : ''}`,
          title: `${label} (${label[0]})`,
          onclick: stop(() => mark(u, p.id, m === v ? null : v)),
        }, label)),
        h('button', { class: 'x', title: 'Remove (X)', onclick: stop(() => remove(u, p.id, true)) }, '×'),
      ]));
}

// Draw notation only for the cards on screen.
const drawn = new Set();
const drawKey = (p) => `${p.id}@${tonicOf(p)}`;
let observer = null;
function observe() {
  observer?.disconnect();
  observer = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const p = patternById(el.dataset.id);
    el.querySelector('.staff').innerHTML = notation(p, tonicOf(p));
    drawn.add(drawKey(p));
    observer.unobserve(el);
  }), { rootMargin: '200px' });
  app.querySelectorAll('.card .staff:empty').forEach((el) => observer.observe(el.parentElement));
}

const beatsOf = (p) => (p.kind === 'rhythm' ? p.cells.length : p.tones.length);

function stage(u) {
  const st = h('span', { class: `status${status.bad ? ' bad' : ''}` }, status.text);
  const p = current && patternById(current);
  if (!p) return h('div', { class: 'stage' }, st);
  const list = takesFor(p.id, settings.speed);
  const staff = h('span', { class: 'staff' });
  staff.innerHTML = notation(p, tonicOf(p));
  const m = u.marks[p.id];
  return h('div', { class: 'stage' },
    h('div', { class: 'now' }, staff, h('span', { class: 'syl' }, p.syllables, m ? h('small', {}, ` · ${MARKS[m]}`) : null)),
    h('div', { class: 'controls' },
      seg(Object.fromEntries(Object.entries(SPEEDS).map(([s, label]) => [s, `${label} ${settings.bpm[s]} · ${takesFor(p.id, s).length}`])),
        settings.speed, (v) => { if (!recording) { settings.speed = v; save(); render(); } }),
      h('span', { class: 'takes' }, list.map((take, i) => h('span', { class: 'take' },
        h('button', { title: `${take.bpm} bpm`, onclick: () => playBlob(take.mp3) }, `▶ ${i + 1}${take.key != null ? ` ${pretty(keyName(p.tonality, take.key))}` : ''}`),
        h('button', { class: 'x', title: 'Delete take', onclick: async () => { await takeStore.delete(take.id); takes = await takeStore.all(); render(); } }, '×')))),
      h('span', { class: 'grow' }),
      h('div', { class: 'beats' },
        Array.from({ length: settings.countIn }, () => h('span', { class: 'count' })),
        Array.from({ length: beatsOf(p) }, () => h('span', { class: 'go' }))),
      h('div', { class: 'level', title: 'Microphone level' }, h('div')),
      st,
      h('button', { class: 'rec', onclick: toggleRecording }, 'Record'),
    ));
}

/* ---------- Recording ---------- */

async function toggleRecording() {
  if (recording) return recording.cancel();
  const p = current && patternById(current);
  if (!p) return;
  say('');
  try {
    await audio();
  } catch (e) {
    say(`The count-in sounds didn't load: ${e.message}`, true);
    return;
  }
  if (!mic) {
    await startMic(settings.mic);
    render();
    if (!mic) { say(micError, true); return; }
  }
  try {
    record(p);
  } catch (e) {
    say(`Couldn't start recording: ${e.message}`, true);
  }
}

function record(p) {
  const btn = app.querySelector('.rec');
  const dots = [...app.querySelectorAll('.beats span')];
  const speed = settings.speed;
  const bpm = settings.bpm[speed];
  const beat = 60 / bpm;
  const key = p.kind === 'tonal' ? settings.key[p.tonality] : null;

  const recorder = new MediaRecorder(mic);
  const parts = [];
  recorder.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  recorder.start();
  const begun = ctx.currentTime;

  let t0 = begun + 0.2;
  if (p.kind === 'tonal') {
    // The key: tonic chord up and back to the tonic, then the pattern's first note.
    const tonic = TONALITIES[p.tonality].tonic.map((tone) => toneMidi(p.tonality, key, tone));
    [...tonic, tonic[0]].forEach((m, i) => piano.note(m, t0 + i * 0.4, i === 3 ? 1 : 0.38, { vol: 0.3 }));
    t0 += 0.4 * 3 + 1.2;
    if (settings.firstNote) {
      piano.note(toneMidi(p.tonality, key, p.tones[0]), t0, 0.9, { vol: 0.3 });
      t0 += 1.2;
    }
  }
  // Count-in on the beat, with the eighths softly in 6/8.
  const sub = p.meter === '6/8' ? 3 : 1;
  for (let i = 0; i < settings.countIn; i++) {
    claves.hit(t0 + i * beat, { vol: i ? 0.6 : 1 });
    for (let j = 1; j < sub; j++) claves.hit(t0 + (i + j / sub) * beat, { vol: 0.2 });
  }
  const downbeat = t0 + settings.countIn * beat;
  // Stops on its own a little after the pattern ends.
  const end = downbeat + beatsOf(p) * beat + 1.2;

  const timers = [];
  const at = (t, fn) => timers.push(setTimeout(fn, Math.max(0, (t - ctx.currentTime) * 1000)));
  const light = (i) => dots.forEach((d, k) => d.classList.toggle('lit', k === i));
  say(p.kind === 'tonal' ? 'Listen' : 'Ready');
  at(t0, () => say('Ready'));
  dots.forEach((_, i) => at(t0 + i * beat, () => light(i)));
  at(downbeat, () => say('Go'));
  at(end, () => finish(true));

  let keep = true;
  function finish(kept) {
    keep = kept;
    if (recorder.state !== 'inactive') recorder.stop();
  }
  recorder.onerror = (e) => say(`Recording failed: ${e.error?.message || 'unknown error'}`, true);
  recorder.onstop = async () => {
    timers.forEach(clearTimeout);
    recording = null;
    btn.textContent = 'Record';
    btn.classList.remove('live');
    light(-1);
    if (!keep) { say('Stopped, nothing saved'); return; }
    say('Saving…');
    try {
      // Anything before a quarter beat ahead of the downbeat is count-in.
      const take = await processTake(new Blob(parts, { type: recorder.mimeType }), downbeat - begun - beat / 4);
      if (!take) { say('Too quiet, nothing saved. Check the microphone level.', true); return; }
      await takeStore.put({ id: crypto.randomUUID(), pattern: p.id, speed, bpm, key, created: Date.now(), ...take });
      playBlob(take.mp3);
      takes = await takeStore.all();
      say(`Saved: ${SPEEDS[speed]} take ${takesFor(p.id, speed).length}`);
      if (done(p.id, speed) && current === p.id) {
        const list = shown.filter((q) => !unitNow().removed.includes(q.id));
        const i = list.findIndex((q) => q.id === p.id);
        const next = [...list.slice(i + 1), ...list.slice(0, i)].find((q) => !done(q.id, speed));
        if (next) current = next.id;
      }
      render();
    } catch (e) {
      say(`Couldn't save the take: ${e.message}`, true);
    }
  };

  recording = { cancel: () => finish(false) };
  btn.textContent = 'Stop';
  btn.classList.add('live');
}

/* ---------- Save for site, and restore ---------- */

/* A unit as the site reads it (assets/patterns/units.json): its settings, and the patterns
   kept, in order, with their marks. */
function unitForSite(u) {
  return {
    ...u,
    patterns: unitPatterns(u).filter((p) => !u.removed.includes(p.id)).map((p) => ({ id: p.id, mark: u.marks[p.id] || null })),
  };
}

async function buildZip() {
  const voice = settings.voice;
  const files = [];
  const list = [];
  const numbers = new Map();
  for (const take of [...takes].sort((a, b) => a.created - b.created)) {
    const p = patternById(take.pattern);
    if (!p) continue;
    const tag = `${take.pattern}/${take.speed}${take.key != null ? `-${keyName(p.tonality, take.key).replace('#', 's')}` : ''}`;
    numbers.set(tag, (numbers.get(tag) || 0) + 1);
    const file = `voice/${voice}/${tag}-${numbers.get(tag)}.mp3`;
    files.push({ name: file, data: new Uint8Array(await take.mp3.arrayBuffer()) });
    list.push({ pattern: take.pattern, speed: take.speed, bpm: take.bpm, key: take.key, file, id: take.id, created: take.created, seconds: Math.round(take.seconds * 100) / 100 });
  }
  const json = { voice, label: 'Mr. Washburn', saved: new Date().toISOString(), takes: list, units: units.map(unitForSite) };
  files.unshift({ name: `voice/${voice}/takes.json`, data: new TextEncoder().encode(JSON.stringify(json, null, 1)) });
  return { blob: makeZip(files), count: list.length };
}

/* Writes voice-kyle.zip to a folder picked once (where the browser allows it), otherwise
   downloads it. Same name every time, so the newest one replaces the last. */
async function saveForSite(change = false) {
  let dir = null;
  if (window.showDirectoryPicker) {
    try {
      dir = change ? null : folder || await misc.get('folder');
      if (dir && (await dir.queryPermission({ mode: 'readwrite' })) !== 'granted'
        && (await dir.requestPermission({ mode: 'readwrite' })) !== 'granted') dir = null;
      if (!dir) {
        dir = await window.showDirectoryPicker({ id: 'voice', mode: 'readwrite', startIn: 'documents' });
        await misc.put(dir, 'folder').catch(() => { /* asked for again next time */ });
        settings.folder = dir.name;
        save();
      }
      folder = dir;
    } catch (err) {
      if (err.name === 'AbortError') return;
      dir = null;
    }
  }
  try {
    const { blob, count } = await buildZip();
    if (dir) {
      const file = await dir.getFileHandle(ZIP_NAME, { create: true });
      const out = await file.createWritable();
      await out.write(blob);
      await out.close();
      say(`Saved ${count} takes to ${dir.name}/${ZIP_NAME}`);
      render();
    } else {
      const a = h('a', { href: URL.createObjectURL(blob), download: ZIP_NAME, hidden: true });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      say(`Downloaded ${ZIP_NAME} with ${count} takes`);
    }
  } catch (err) {
    say(`Couldn't save: ${err.message}`, true);
  }
}

/* Adds the zip's takes to the ones on this device, and takes its units. */
async function restoreZip(file) {
  if (!file) return;
  try {
    const entries = readZip(await file.arrayBuffer());
    const jsonName = Object.keys(entries).find((n) => n.endsWith('/takes.json'));
    if (!jsonName) throw new Error('that zip has no takes.json');
    const json = JSON.parse(new TextDecoder().decode(entries[jsonName]));
    const have = new Set(takes.map((t) => t.id));
    let added = 0;
    for (const t of json.takes || []) {
      if (have.has(t.id) || !entries[t.file] || !patternById(t.pattern)) continue;
      await takeStore.put({ id: t.id, pattern: t.pattern, speed: t.speed, bpm: t.bpm, key: t.key ?? null, created: t.created, seconds: t.seconds, mp3: new Blob([entries[t.file]], { type: 'audio/mpeg' }) });
      added++;
    }
    for (const { patterns, ...x } of json.units || []) {
      const u = { require: [], removed: [], marks: {}, ...x };
      const i = units.findIndex((y) => y.id === u.id);
      if (i >= 0) units[i] = u;
      else units.push(u);
    }
    if (json.units?.length) await saveUnits();
    takes = await takeStore.all();
    say(`Restored ${added} takes`);
    render();
  } catch (e) {
    say(`Couldn't restore: ${e.message}`, true);
  }
}

/* ---------- Keys ---------- */

document.addEventListener('keydown', (e) => {
  if (e.target.closest('textarea, input, select') || e.ctrlKey || e.metaKey || e.altKey) return;
  const u = unitNow();
  if (!u || !current) return;
  if (e.code === 'Space') {
    if (e.target.closest('.rec')) return; // the button's own click
    e.preventDefault();
    toggleRecording();
    return;
  }
  if (recording) return;
  const list = shown.filter((p) => !u.removed.includes(p.id));
  const key = e.key.toLowerCase();
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const i = list.findIndex((p) => p.id === current) + (e.key === 'ArrowRight' ? 1 : -1);
    if (list[i]) { current = list[i].id; render(); }
  } else if (['1', '2', '3'].includes(e.key)) {
    settings.speed = Object.keys(SPEEDS)[Number(e.key) - 1];
    save();
    render();
  } else if (key === 'f' || key === 'u') {
    const v = key === 'f' ? 'familiar' : 'unfamiliar';
    mark(u, current, u.marks[current] === v ? null : v);
  } else if (key === 'x') {
    const i = list.findIndex((p) => p.id === current);
    const next = list[i + 1] || list[i - 1];
    const id = current;
    current = next?.id || null;
    remove(u, id, true);
  }
});

// Turn the microphone on by itself once it's been allowed.
navigator.permissions?.query({ name: 'microphone' })
  .then((p) => { if (p.state === 'granted' && !mic) startMic(settings.mic).then(render); })
  .catch(() => { /* not supported: the button turns it on */ });

show();
