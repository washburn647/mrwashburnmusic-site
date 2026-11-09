/* Voice recorder: Kyle's own voice for the patterns of each Conversational Solfege unit,
   a few takes of each at three speeds.
   A unit brings in rhythm cells in a meter, or tonal syllables (assets/patterns/patterns.js);
   its patterns are generated from them, then Kyle removes the ones he doesn't want and marks
   the rest familiar or unfamiliar. Each take is recorded after a count-in (tonal ones after the
   key on the piano), stops on its own after the pattern, is trimmed to the voice and saved as a
   small mp3 (24 kHz mono) on this device (IndexedDB 'mwm-voice'). "Publish to site" uploads
   the takes the site doesn't have yet and then the take list and units, so the games and
   lessons use them right away (/api/live/, see worker/index.js). "Download" writes
   voice-kyle.zip (every take, tagged by pattern, plus the units): a backup Restore reads, and
   what tools/add_takes.py puts in the repo.
   Each pattern is recorded in syllables and on "bum" (Musician Maker's neutral call), and
   Cue words holds Musician Maker's spoken cues (musician-maker/cues.js), at one speed.
   Narration holds the words behind Musician Maker's 🔊 read-aloud buttons
   (musician-maker/narration.js): free length, no count-in, Record then Stop, one take each
   (recording again replaces it). They publish with the cues, as line/<id>. */

import * as samples from '/assets/sounds/samples.js';
import { timing, offbeat, forSite } from '/assets/sounds/timing.js';
import { METERS, TONALITIES, KEYS, DEFAULT_UNITS, unitPatterns, conceptLabel, toneMidi, patternById } from '/assets/patterns/patterns.js';
import { notation } from '/assets/patterns/notation.js';
import { h, confirmButton } from '../dom.js';
import { makeZip, readZip } from './zip.js';
import { CUES, cueById } from '/musician-maker/cues.js';
import { LINES, lineById } from '/musician-maker/narration.js';

const app = document.getElementById('app');
const SPEEDS = { slow: 'Slow', medium: 'Medium', fast: 'Fast' };
const MARKS = { familiar: 'Familiar', unfamiliar: 'Unfamiliar' };
const RECORDED = { all: 'Any', done: 'Recorded', todo: 'Not yet' };
const FILTERS = { all: 'All', familiar: 'Familiar', unfamiliar: 'Unfamiliar', unmarked: 'Unmarked' };
const KINDS = { rhythm: 'Rhythm', tonal: 'Tonal' };
const VOICES = { syllables: 'Syllables', bum: 'On “bum”' };
const CUE_UNIT = 'cues'; // the Cue words list, shown in place of a unit
const LINE_UNIT = 'lines'; // the Narration list, the same way
const LINE_MAX = 90; // seconds: a narration take stops on its own after this
const CUE_SPEED = 'medium'; // cue words are recorded once, at this speed
const ZIP_NAME = 'voice-kyle.zip';

/* ---------- Storage ---------- */

// takes: { id, pattern, as, speed, bpm, key (sounding midi of do or la; null for rhythm), created, seconds, mp3 }
//   as: 'syllables' (also when missing: takes from before "bum"), 'bum', or 'cue' (pattern is cue/<id>)
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
  bpm: { slow: 92, medium: 108, fast: 126 },
  speed: 'medium',
  as: 'syllables',
  want: 3,
  countIn: 4,
  firstNote: true,
  mic: '',
  filter: 'all',
  recorded: 'all', // all, done (every speed has its takes, in the voice shown), todo
  folder: '', // its name
};
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS)) || {}); } catch { /* defaults */ }
// The first speeds were 60, 80 and 100; a device still on them moves to the new ones.
if (settings.bpm.slow === 60 && settings.bpm.medium === 80 && settings.bpm.fast === 100) {
  settings.bpm = { slow: 92, medium: 108, fast: 126 };
}
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
let showOffbeat = false;
let status = { text: '', bad: false };
let folder = null; // where Save for site writes, once picked

const cuesShown = () => settings.unit === CUE_UNIT;
const linesShown = () => settings.unit === LINE_UNIT;
const listShown = () => cuesShown() || linesShown(); // a Musician Maker list, not a unit
const unitNow = () => units.find((u) => u.id === settings.unit) || units[0];
const isCue = (id) => id?.startsWith('cue/');
const isLine = (id) => id?.startsWith('cue/line/');
const takeAs = (t) => t.as || 'syllables';
const asFor = (id) => (isCue(id) ? 'cue' : settings.as);
const takesFor = (id, speed) => takes.filter((t) => t.pattern === id && takeAs(t) === asFor(id)
  && (!speed || isCue(id) || t.speed === speed)).sort((a, b) => a.created - b.created);
// A take that needs a listen: timing.js couldn't line it up with the beat. Unmeasured takes
// (from before the check) aren't flagged until Check timing measures them.
const flagged = (t) => t.timing !== undefined && offbeat(t.timing, t.bpm);
const offbeatTakes = (id) => takesFor(id).filter(flagged);
const unmeasured = () => takes.filter((t) => t.timing === undefined && !isCue(t.pattern));
const done = (id, speed) => takesFor(id, speed).length >= (isLine(id) ? 1 : settings.want);
// A cue word as the recorder handles it: 2 beats, no notation.
const cueItem = (c) => ({ id: `cue/${c.id}`, kind: 'cue', text: c.text });
// A narration line: read at its own pace, no beats.
const lineItem = (l) => ({ id: `cue/line/${l.id}`, kind: 'line', text: l.text, label: l.label, group: l.group });
const itemById = (id) => {
  if (isLine(id)) return lineById(id.slice(9)) ? lineItem(lineById(id.slice(9))) : null;
  if (isCue(id)) return cueById(id.slice(4)) ? cueItem(cueById(id.slice(4))) : null;
  return patternById(id);
};
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
  if (cuesShown()) return renderCues();
  if (linesShown()) return renderLines();
  const u = unitNow();
  const all = u ? unitPatterns(u) : [];
  const kept = all.filter((p) => !u.removed.includes(p.id));
  const removed = all.filter((p) => u.removed.includes(p.id));
  if (!removed.length) showRemoved = false;
  const markOf = (p) => u.marks[p.id] || 'unmarked';
  const complete = (p) => Object.keys(SPEEDS).every((sp) => done(p.id, sp));
  const recordedOk = (p) => settings.recorded === 'all' || complete(p) === (settings.recorded === 'done');
  const filtered = (settings.filter === 'all' ? kept : kept.filter((p) => markOf(p) === settings.filter)).filter(recordedOk);
  const off = kept.filter((p) => offbeatTakes(p.id).length);
  if (!off.length) showOffbeat = false;
  shown = showRemoved ? removed : showOffbeat ? off : filtered;
  if (!filtered.some((p) => p.id === current)) current = (filtered.find((p) => !done(p.id, settings.speed)) || filtered[0])?.id;
  const counts = Object.fromEntries(Object.keys(FILTERS).map((f) => [f, f === 'all' ? kept.length : kept.filter((p) => markOf(p) === f).length]));

  const wide = u?.kind === 'rhythm' && u.bars > 1;

  app.replaceChildren(
    ...top(u),
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
          (v) => { settings.filter = v; showRemoved = false; showOffbeat = false; save(); render(); }),
        seg(Object.fromEntries(Object.entries(RECORDED).map(([f, label]) => [f, `${label} ${f === 'all' ? kept.length : kept.filter((p) => complete(p) === (f === 'done')).length}`])),
          showRemoved || showOffbeat ? '' : settings.recorded,
          (v) => { settings.recorded = v; showRemoved = false; showOffbeat = false; save(); render(); }),
        removed.length ? h('button', { class: showRemoved ? 'on' : '', onclick: () => { showRemoved = !showRemoved; showOffbeat = false; render(); } }, `Removed ${removed.length}`) : null,
        off.length ? h('button', { class: `offbeat${showOffbeat ? ' on' : ''}`, title: 'Patterns with a take that may be off the beat', onclick: () => { showOffbeat = !showOffbeat; showRemoved = false; render(); } }, `Off the beat ${off.length}`) : null,
        unmeasured().length ? h('button', { disabled: !!checking, onclick: checkTiming }, checking || 'Check timing') : null,
        h('span', { class: 'grow' }),
        h('span', { class: 'label' }, 'Voice'),
        seg(VOICES, settings.as, (v) => { if (!recording) { settings.as = v; current = null; save(); render(); } }),
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

/* The cue words: like a unit with one speed and no notation. */
function renderCues() {
  shown = CUES.map(cueItem);
  if (!shown.some((c) => c.id === current)) current = (shown.find((c) => !done(c.id)) || shown[0]).id;
  const total = shown.reduce((n, c) => n + takesFor(c.id).length, 0);
  app.replaceChildren(
    ...top(null),
    h('div', { class: 'bar summary' },
      h('h2', {}, 'Cue words'),
      h('span', { class: 'total' }, `${CUES.length} words · ${total} takes`),
    ),
    h('p', { class: 'hint' }, `Musician Maker says these on a beat. Say each within 2 beats, at ${settings.bpm[CUE_SPEED]} bpm; a different reading each take.`),
    h('div', { class: 'bar settings' },
      h('label', {}, SPEEDS[CUE_SPEED], number(() => settings.bpm[CUE_SPEED], (v) => { settings.bpm[CUE_SPEED] = v; }, 30, 220)),
      h('label', {}, 'Takes', number(() => settings.want, (v) => { settings.want = v; }, 1, 10)),
      h('label', {}, 'Count-in', number(() => settings.countIn, (v) => { settings.countIn = v; }, 1, 8)),
    ),
    h('div', { class: 'grid cues' }, shown.map((c) => {
      const pick = () => { if (!recording) { current = c.id; render(); } };
      return h('div', {
        class: `card${c.id === current ? ' on' : ''}${done(c.id) ? ' complete' : ''}`,
        tabindex: 0,
        dataset: { id: c.id },
        onclick: pick,
        onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) pick(); },
      },
      h('span', { class: 'word' }, c.text),
      h('span', { class: 'counts' }, h('span', { class: done(c.id) ? 'sp done' : 'sp' }, `${takesFor(c.id).length} of ${settings.want}`)));
    })),
    stage(null),
  );
  app.querySelector('.card.on')?.scrollIntoView({ block: 'nearest' });
}

/* Narration: each 🔊 spot's words, to read in your own way. Grouped like the app. */
function renderLines() {
  shown = LINES.map(lineItem);
  if (!shown.some((c) => c.id === current)) current = (shown.find((c) => !done(c.id)) || shown[0]).id;
  const have = shown.filter((c) => done(c.id)).length;
  const groups = [...new Set(shown.map((c) => c.group))];
  app.replaceChildren(
    ...top(null),
    h('div', { class: 'bar summary' },
      h('h2', {}, 'Narration'),
      h('span', { class: 'total' }, `${have} of ${shown.length} recorded`),
    ),
    h('p', { class: 'hint' }, 'What the 🔊 buttons in Musician Maker say. Pick one, tap Record, read it your way, then Stop. Recording again replaces it. Publish to site and the game plays yours; anything not recorded is read by the device\'s voice.'),
    ...groups.flatMap((g) => [
      h('h3', { class: 'group-head' }, g),
      h('div', { class: 'grid lines' }, shown.filter((c) => c.group === g).map((c) => {
        const pick = () => { if (!recording) { current = c.id; render(); } };
        return h('div', {
          class: `card${c.id === current ? ' on' : ''}${done(c.id) ? ' complete' : ''}`,
          tabindex: 0,
          dataset: { id: c.id },
          onclick: pick,
          onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) pick(); },
        },
        h('b', { class: 'line-label' }, c.label),
        h('span', { class: 'line-text' }, c.text),
        h('span', { class: 'counts' }, h('span', { class: done(c.id) ? 'sp done' : 'sp' }, done(c.id) ? '✓ Recorded' : 'Not yet')));
      })),
    ]),
    stage(null),
  );
  app.querySelector('.card.on')?.scrollIntoView({ block: 'nearest' });
}

/* Title, microphone and the unit picker: the top of every view. */
function top(u) {
  const restore = h('input', { type: 'file', accept: '.zip,application/zip', hidden: true, onchange: () => { restoreZip(restore.files[0]); restore.value = ''; } });
  const pickUnit = (id) => { if (recording) return; settings.unit = id; showRemoved = false; current = null; save(); render(); };
  return [
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '‹ Studio')),
    h('div', { class: 'bar' },
      h('h1', { class: 'grow' }, 'Voice recorder'),
      h('button', { onclick: () => restore.click() }, 'Restore'),
      restore,
      settings.folder && window.showDirectoryPicker ? h('button', { class: 'icon', title: 'Change folder', onclick: () => saveForSite(true) }, `Folder: ${settings.folder}`) : null,
      h('button', { onclick: () => saveForSite() }, 'Download'),
      h('button', { class: 'primary', disabled: publishing, onclick: publish }, publishing ? 'Publishing…' : 'Publish to site'),
    ),
    micBar(),
    h('div', { class: 'bar units' },
      Object.entries(KINDS).map(([kind, label]) => {
        const list = units.filter((x) => x.kind === kind);
        return list.length ? h('div', { class: 'group' },
          h('span', { class: 'label' }, label),
          h('span', { class: 'seg' }, list.map((x) => h('button', {
            class: x.id === u?.id ? 'on' : '',
            onclick: () => pickUnit(x.id),
          }, h('b', {}, x.name), h('small', {}, describe(x)))))) : null;
      }),
      h('button', { onclick: newUnit }, '+ Unit'),
      h('div', { class: 'group' },
        h('span', { class: 'label' }, 'Musician Maker'),
        h('span', { class: 'seg' }, h('button', { class: cuesShown() ? 'on' : '', onclick: () => pickUnit(CUE_UNIT) },
          h('b', {}, 'Cue words'), h('small', {}, `${CUES.length} words`)),
        h('button', { class: linesShown() ? 'on' : '', onclick: () => pickUnit(LINE_UNIT) },
          h('b', {}, 'Narration'), h('small', {}, `${LINES.length} spots`)))),
    ),
  ];
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
  const pick = () => {
    if (recording || out) return;
    current = p.id;
    // Off the beat: open the speed with the take to listen to.
    const f = showOffbeat && offbeatTakes(p.id)[0];
    if (f) settings.speed = f.speed;
    render();
  };
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
    h('span', { class: done(p.id, s) ? 'sp done' : 'sp', title: `${label}, ${settings.bpm[s]} bpm` }, `${label[0]} ${takesFor(p.id, s).length}`)),
  offbeatTakes(p.id).length ? h('span', { class: 'sp offbeat', title: 'Takes that may be off the beat' }, `⚠ ${offbeatTakes(p.id).length}`) : null),
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

const beatsOf = (p) => (p.kind === 'line' ? 0 : p.kind === 'cue' ? 2 : p.kind === 'rhythm' ? p.cells.length : p.tones.length);
function takeTitle(take) {
  const t = take.timing;
  if (t === undefined || isCue(take.pattern)) return `${take.bpm} bpm`;
  if (!t) return `${take.bpm} bpm · may be off the beat: couldn't find every syllable. Listen, and record it again if it's off`;
  if (flagged(take)) return `${take.bpm} bpm · may be off the beat: a syllable is ${Math.round(t.off * 100)}% of a beat out. Listen, and record it again if it's off`;
  return `${take.bpm} bpm · sung at ${Math.round(t.tempo)}; the game plays it in time`;
}
const bumOf = (p) => p.syllables.replace(/[a-z]+/gi, 'bum');

function stage(u) {
  const st = h('span', { class: `status${status.bad ? ' bad' : ''}` }, status.text);
  const p = current && itemById(current);
  if (!p) return h('div', { class: 'stage' }, st);
  const list = takesFor(p.id, settings.speed);
  let now;
  if (p.kind === 'cue') now = h('div', { class: 'now' }, h('span', { class: 'word' }, p.text));
  else if (p.kind === 'line') now = h('div', { class: 'now line' }, h('small', {}, p.label), h('span', { class: 'script' }, p.text));
  else {
    const staff = h('span', { class: 'staff' });
    staff.innerHTML = notation(p, tonicOf(p));
    const m = u.marks[p.id];
    now = h('div', { class: 'now' }, staff, h('span', { class: 'syl' },
      settings.as === 'bum' ? h('span', { class: 'bum' }, bumOf(p)) : p.syllables,
      settings.as === 'bum' ? h('small', {}, ` · ${p.syllables}`) : null,
      m ? h('small', {}, ` · ${MARKS[m]}`) : null));
  }
  return h('div', { class: 'stage' },
    now,
    h('div', { class: 'controls' },
      p.kind === 'line' ? h('span', { class: 'label' }, 'Record, read it, then Stop')
      : p.kind === 'cue'
        ? h('span', { class: 'label' }, `${SPEEDS[CUE_SPEED]} ${settings.bpm[CUE_SPEED]} · ${list.length}`)
        : seg(Object.fromEntries(Object.entries(SPEEDS).map(([s, label]) => [s, `${label} ${settings.bpm[s]} · ${takesFor(p.id, s).length}${takesFor(p.id, s).some(flagged) ? ' ⚠' : ''}`])),
          settings.speed, (v) => { if (!recording) { settings.speed = v; save(); render(); } }),
      h('span', { class: 'takes' }, list.map((take, i) => h('span', { class: 'take' },
        h('button', { class: flagged(take) ? 'offbeat' : '', title: takeTitle(take), onclick: () => playBlob(take.mp3) }, `▶ ${i + 1}${take.key != null ? ` ${pretty(keyName(p.tonality, take.key))}` : ''}${flagged(take) ? ' ⚠' : ''}`),
        h('button', { class: 'x', title: 'Delete take', onclick: async () => { await takeStore.delete(take.id); takes = await takeStore.all(); render(); } }, '×')))),
      h('span', { class: 'grow' }),
      p.kind === 'line' ? null : h('div', { class: 'beats' },
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
  const p = current && itemById(current);
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

/* ---------- Timing ---------- */

// timing.js on a take: { tempo, off, lead }, or null when it can't find every syllable.
async function measure(mp3, p, bpm) {
  try {
    const b = await decode(mp3);
    return timing(b.getChannelData(0), b.sampleRate, p, bpm);
  } catch {
    return null;
  }
}

/* Measures the takes recorded before the check existed. Publish to site afterwards to send the
   game what it found. */
let checking = '';
async function checkTiming() {
  await audio();
  const list = unmeasured();
  for (const [i, take] of list.entries()) {
    checking = `Checking ${i + 1} of ${list.length}…`;
    if (i % 10 === 0) render();
    const p = itemById(take.pattern);
    if (!p) continue;
    take.timing = await measure(take.mp3, p, take.bpm);
    await takeStore.put(take);
  }
  checking = '';
  takes = await takeStore.all();
  const bad = takes.filter(flagged).length;
  say(bad ? `Checked ${list.length} takes. ${bad} may be off the beat ⚠: listen to them, and record again any that are. Publish to site to put the rest in time.`
    : `Checked ${list.length} takes, all on the beat. Publish to site to put them in time.`, false);
  render();
}

function record(p) {
  const btn = app.querySelector('.rec');
  const dots = [...app.querySelectorAll('.beats span')];
  const as = asFor(p.id);
  const speed = p.kind === 'cue' ? CUE_SPEED : settings.speed;
  const bpm = settings.bpm[speed];
  const beat = 60 / bpm;
  const key = p.kind === 'tonal' ? settings.key[p.tonality] : null;

  const recorder = new MediaRecorder(mic);
  const parts = [];
  recorder.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  recorder.start();
  const begun = ctx.currentTime;

  if (p.kind === 'line') return recordLine(p, recorder, parts, begun, btn);
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
      const t = p.kind === 'cue' ? undefined : await measure(take.mp3, p, bpm);
      await takeStore.put({ id: crypto.randomUUID(), pattern: p.id, as, speed, bpm, key, created: Date.now(), ...take, ...(t === undefined ? {} : { timing: t }) });
      playBlob(take.mp3);
      takes = await takeStore.all();
      say(p.kind === 'cue' ? `Saved: take ${takesFor(p.id).length}` : `Saved: ${SPEEDS[speed]}${as === 'bum' ? ' bum' : ''} take ${takesFor(p.id, speed).length}${t !== undefined && offbeat(t, bpm) ? ', but it may be off the beat ⚠' : ''}`, t !== undefined && offbeat(t, bpm));
      if (done(p.id, speed) && current === p.id && asFor(p.id) === as) {
        const list = p.kind === 'cue' ? shown : shown.filter((q) => !unitNow().removed.includes(q.id));
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

/* A narration take: no count-in, as long as it takes; Stop keeps it. It replaces the line's
   earlier take. */
function recordLine(p, recorder, parts, begun, btn) {
  say('Go: read it, then tap Stop');
  const cap = setTimeout(() => finish(true), LINE_MAX * 1000);
  let keep = true;
  function finish(kept) {
    keep = kept;
    if (recorder.state !== 'inactive') recorder.stop();
  }
  recorder.onerror = (e) => say(`Recording failed: ${e.error?.message || 'unknown error'}`, true);
  recorder.onstop = async () => {
    clearTimeout(cap);
    recording = null;
    btn.textContent = 'Record';
    btn.classList.remove('live');
    if (!keep) { say('Stopped, nothing saved'); return; }
    say('Saving…');
    try {
      const take = await processTake(new Blob(parts, { type: recorder.mimeType }), 0.05);
      if (!take) { say('Too quiet, nothing saved. Check the microphone level.', true); return; }
      const old = takesFor(p.id);
      await takeStore.put({ id: crypto.randomUUID(), pattern: p.id, as: 'cue', speed: CUE_SPEED, bpm: 0, key: null, created: Date.now(), ...take });
      for (const t of old) await takeStore.delete(t.id);
      playBlob(take.mp3);
      takes = await takeStore.all();
      say(`Saved (${take.seconds.toFixed(1)} s)`);
      render();
    } catch (e) {
      say(`Couldn't save the take: ${e.message}`, true);
    }
  };
  recording = { cancel: () => finish(true) };
  btn.textContent = 'Stop';
  btn.classList.add('live');
  void begun;
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
    const p = itemById(take.pattern);
    if (!p) continue;
    const as = takeAs(take);
    // cue/echo-1, rhythm/2-4/q-ee/medium-1, rhythm/2-4/q-ee/bum/medium-1, tonal/…/medium-C-1
    const tag = as === 'cue' ? take.pattern
      : `${take.pattern}/${as === 'bum' ? 'bum/' : ''}${take.speed}${take.key != null ? `-${keyName(p.tonality, take.key).replace('#', 's')}` : ''}`;
    numbers.set(tag, (numbers.get(tag) || 0) + 1);
    const file = `voice/${voice}/${tag}-${numbers.get(tag)}.mp3`;
    files.push({ name: file, data: new Uint8Array(await take.mp3.arrayBuffer()) });
    list.push({ pattern: take.pattern, as, speed: take.speed, bpm: take.bpm, key: take.key, file, id: take.id, created: take.created, seconds: Math.round(take.seconds * 100) / 100, ...(take.timing !== undefined ? { timing: take.timing } : {}) });
  }
  const json = { voice, label: 'Mr. Washburn', saved: new Date().toISOString(), takes: list, units: units.map(unitForSite) };
  files.unshift({ name: `voice/${voice}/takes.json`, data: new TextEncoder().encode(JSON.stringify(json, null, 1)) });
  return { blob: makeZip(files), count: list.length };
}

/* Uploads the takes the site doesn't have, then the list of every take and the units. The site
   deletes takes no longer on the list, so it ends up with exactly the takes on this device. */
let publishing = false;
async function publish() {
  const api = `/studio/api/live/voice/${settings.voice}`;
  const call = async (url, options) => {
    const r = await fetch(url, options);
    if (r.status === 401) throw new Error('your sign-in ran out. Reload the page and try again');
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `the site said ${r.status}`);
    return r.json();
  };
  publishing = true;
  render();
  try {
    const have = new Set((await call(api)).takes);
    const list = { label: 'Mr. Washburn', patterns: {}, cues: {}, units: units.map(unitForSite) };
    const send = [];
    for (const take of [...takes].sort((a, b) => a.created - b.created)) {
      if (!itemById(take.pattern)) continue;
      const as = takeAs(take);
      const entry = { take: take.id, speed: take.speed, bpm: take.bpm };
      if (as === 'cue') {
        (list.cues[take.pattern.slice(4)] ||= []).push(entry);
      } else {
        if (as === 'bum') entry.as = 'bum';
        if (take.key != null) entry.key = take.key;
        Object.assign(entry, forSite(take.timing, itemById(take.pattern), take.bpm));
        (list.patterns[take.pattern] ||= []).push(entry);
      }
      if (!have.has(take.id)) send.push(take);
    }
    for (const [i, take] of send.entries()) {
      say(`Uploading take ${i + 1} of ${send.length}…`);
      await call(`${api}/${take.id}.mp3`, { method: 'PUT', headers: { 'Content-Type': 'audio/mpeg' }, body: take.mp3 });
    }
    const r = await call(api, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(list) });
    say(`Published ${r.takes} takes (${send.length} new${r.deleted ? `, ${r.deleted} removed` : ''}). The games and lessons use them now.`);
  } catch (err) {
    say(`Couldn't publish: ${err.message}`, true);
  }
  publishing = false;
  render();
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
      if (have.has(t.id) || !entries[t.file] || !itemById(t.pattern)) continue;
      await takeStore.put({ id: t.id, pattern: t.pattern, as: t.as || 'syllables', speed: t.speed, bpm: t.bpm, key: t.key ?? null, created: t.created, seconds: t.seconds, ...(t.timing !== undefined ? { timing: t.timing } : {}), mp3: new Blob([entries[t.file]], { type: 'audio/mpeg' }) });
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
  const u = listShown() ? null : unitNow();
  if ((!u && !listShown()) || !current) return;
  if (e.code === 'Space') {
    if (e.target.closest('.rec')) return; // the button's own click
    e.preventDefault();
    toggleRecording();
    return;
  }
  if (recording) return;
  const list = u ? shown.filter((p) => !u.removed.includes(p.id)) : shown;
  const key = e.key.toLowerCase();
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const i = list.findIndex((p) => p.id === current) + (e.key === 'ArrowRight' ? 1 : -1);
    if (list[i]) { current = list[i].id; render(); }
  } else if (!u) {
    // Cue words: nothing more to do by key.
  } else if (key === 'b') {
    settings.as = settings.as === 'bum' ? 'syllables' : 'bum';
    save();
    render();
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
