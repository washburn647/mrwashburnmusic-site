/* Voice recorder: Kyle's own voice for every rhythm and tonal pattern in
   /assets/patterns/patterns.js, a few takes of each at three speeds.
   Each take is recorded after a count-in (tonal ones after the key on the piano), trimmed
   to where the voice starts, and saved as a small mp3 (24 kHz mono) on this device
   (IndexedDB 'mwm-voice'). "Download for site" makes a zip that tools/add_takes.py puts in
   /assets/sounds/, where samples.takes() plays a different take each time a pattern comes up. */

import * as samples from '/assets/sounds/samples.js';
import { METERS, TONALITIES, KEYS, rhythmPatterns, tonalPatterns, toneLabel, toneMidi, patternById } from '/assets/patterns/patterns.js';
import { notation } from '/assets/patterns/notation.js';
import { h } from '../dom.js';
import { makeZip, readZip } from './zip.js';

const app = document.getElementById('app');
const SPEEDS = { slow: 'Slow', medium: 'Medium', fast: 'Fast' };
const TABS = { '2/4': 'Rhythm 2/4', '6/8': 'Rhythm 6/8', major: 'Major', minor: 'Minor' };
const isRhythm = (tab) => tab in METERS;

/* ---------- Storage ---------- */

// takes: { id, pattern, speed, bpm, key (sounding midi of do or la; null for rhythm), created, seconds, mp3 }
// (lines is the first version's text list, kept so nothing recorded with it is lost.)
let dbPromise = null;
function db() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('mwm-voice', 2);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('lines')) d.createObjectStore('lines', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('takes')) d.createObjectStore('takes', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction('takes', mode);
    const req = fn(t.objectStore('takes'));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
  }));
}
const allTakes = () => tx('readonly', (s) => s.getAll());
const putTake = (take) => tx('readwrite', (s) => s.put(take));
const deleteTake = (id) => tx('readwrite', (s) => s.delete(id));

const SETTINGS = 'mwm-voice-settings-2';
const settings = {
  voice: 'kyle',
  tab: '2/4',
  bars: { '2/4': 1, '6/8': 1 },
  length: { major: 3, minor: 3 },
  tones: { major: TONALITIES.major.defaults, minor: TONALITIES.minor.defaults },
  key: { major: 48, minor: 45 },
  bpm: { slow: 60, medium: 80, fast: 100 },
  speed: 'medium',
  want: 3,
  countIn: 4,
  firstNote: true,
};
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS)) || {}); } catch { /* defaults */ }
function save() {
  try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch { /* not kept */ }
}

const today = () => new Date().toISOString().slice(0, 10);
const keyName = (tab, midi) => KEYS[tab].find((k) => k.midi === midi)?.name || '';

/* ---------- Audio ---------- */

let ctx = null;
let mic = null;
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

async function microphone() {
  mic ||= await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: false },
  });
  return mic;
}

/* Trim to the voice (ignoring anything before `from` seconds, where the count-in clicks
   may have bled in), resample to 24 kHz mono and encode as mp3. */
async function processTake(blob, from) {
  const decoded = await new Promise((ok, fail) => blob.arrayBuffer().then((b) => ctx.decodeAudioData(b, ok, fail)));
  const sr = decoded.sampleRate;
  const x = new Float32Array(decoded.length);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const ch = decoded.getChannelData(c);
    for (let i = 0; i < x.length; i++) x[i] += ch[i] / decoded.numberOfChannels;
  }
  const skip = Math.max(0, Math.floor(from * sr));
  let peak = 0;
  for (let i = skip; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak < 0.02) return null;
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
  const buffer = await new Promise((ok, fail) => blob.arrayBuffer().then((b) => ctx.decodeAudioData(b, ok, fail)));
  try { playing?.stop(); } catch { /* already ended */ }
  playing = ctx.createBufferSource();
  playing.buffer = buffer;
  playing.connect(ctx.destination);
  playing.start();
}

/* ---------- Page ---------- */

let takes = [];
let patterns = [];
let current = null;
let recording = null;

function patternsFor(tab) {
  return isRhythm(tab)
    ? rhythmPatterns(tab, settings.bars[tab])
    : tonalPatterns(tab, settings.tones[tab], settings.length[tab]);
}

const takesFor = (id, speed) => takes.filter((t) => t.pattern === id && (!speed || t.speed === speed)).sort((a, b) => a.created - b.created);
const done = (id, speed) => takesFor(id, speed).length >= settings.want;

async function show() {
  takes = await allTakes();
  render();
}

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

function render() {
  const tab = settings.tab;
  patterns = patternsFor(tab);
  if (!patterns.some((p) => p.id === current)) current = (patterns.find((p) => !done(p.id, settings.speed)) || patterns[0])?.id;
  const restore = h('input', { type: 'file', accept: '.zip,application/zip', hidden: true, onchange: () => restoreZip(restore.files[0]) });
  const pick = (fn) => (v) => { fn(v); save(); render(); };

  const options = isRhythm(tab)
    ? [h('label', {}, 'Bars', seg({ 1: '1', 2: '2' }, settings.bars[tab], pick((v) => { settings.bars[tab] = Number(v); })))]
    : [
      h('select', { onchange: (e) => pick((v) => { settings.key[tab] = Number(v); })(e.target.value) },
        KEYS[tab].map((k) => h('option', { value: k.midi, selected: k.midi === settings.key[tab] }, `${tab === 'major' ? 'Do' : 'La'} = ${k.name.replace('b', '♭').replace('#', '♯')}`))),
      seg({ 3: '3 notes', 4: '4 notes' }, settings.length[tab], pick((v) => { settings.length[tab] = Number(v); })),
      h('select', { onchange: (e) => { if (e.target.value) pick((v) => { settings.tones[tab] = TONALITIES[tab].presets[v]; })(e.target.value); } },
        h('option', { value: '' }, 'Notes…'),
        Object.keys(TONALITIES[tab].presets).map((name) => h('option', { value: name }, name))),
      h('span', { class: 'chips' }, TONALITIES[tab].tones.map((tone) => h('button', {
        class: settings.tones[tab].includes(tone) ? 'on' : '',
        onclick: pick(() => {
          const set = settings.tones[tab];
          settings.tones[tab] = set.includes(tone) ? set.filter((t) => t !== tone) : [...set, tone];
        }),
      }, toneLabel(tone)))),
    ];

  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '‹ Studio')),
    h('div', { class: 'bar' },
      h('h1', { class: 'grow' }, 'Voice recorder'),
      h('button', { onclick: () => restore.click() }, 'Restore'),
      restore,
      h('button', { class: 'primary', onclick: downloadZip, disabled: !takes.length }, 'Download for site'),
    ),
    h('div', { class: 'bar tabs' }, seg(TABS, tab, pick((v) => { settings.tab = v; }))),
    h('div', { class: 'bar' }, options),
    h('div', { class: 'bar settings' },
      Object.entries(SPEEDS).map(([s, label]) => h('label', {}, label, number(() => settings.bpm[s], (v) => { settings.bpm[s] = v; }, 30, 220))),
      h('label', {}, 'Takes', number(() => settings.want, (v) => { settings.want = v; }, 1, 10)),
      h('label', {}, 'Count-in', number(() => settings.countIn, (v) => { settings.countIn = v; }, 1, 8)),
      isRhythm(tab) ? null : h('label', {}, h('input', { type: 'checkbox', checked: settings.firstNote, onchange: (e) => { settings.firstNote = e.target.checked; save(); } }), 'First note'),
      h('span', { class: 'total' }, `${patterns.length} patterns`),
    ),
    h('div', { class: `grid ${isRhythm(tab) && settings.bars[tab] === 2 ? 'wide' : ''}` }, patterns.map(card)),
    stage(),
  );
  observe();
  app.querySelector('.card.on')?.scrollIntoView({ block: 'nearest' });
}

const tonicOf = (p) => (p.kind === 'tonal' ? settings.key[p.tonality] : null);

function counts(id) {
  return h('span', { class: 'counts' }, Object.entries(SPEEDS).map(([s, label]) =>
    h('span', { class: done(id, s) ? 'sp done' : 'sp', title: `${label}, ${settings.bpm[s]} bpm` }, `${label[0]} ${takesFor(id, s).length}`)));
}

function card(p) {
  return h('button', {
    class: `card${p.id === current ? ' on' : ''}${Object.keys(SPEEDS).every((s) => done(p.id, s)) ? ' complete' : ''}`,
    dataset: { id: p.id },
    onclick: () => { if (!recording) { current = p.id; render(); } },
  },
  h('span', { class: 'staff' }),
  h('span', { class: 'syl' }, p.syllables),
  counts(p.id));
}

// Draw notation only for the cards on screen.
let observer = null;
function observe() {
  observer?.disconnect();
  observer = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const p = patternById(el.dataset.id);
    el.querySelector('.staff').innerHTML = notation(p, tonicOf(p));
    observer.unobserve(el);
  }), { rootMargin: '200px' });
  app.querySelectorAll('.card').forEach((el) => observer.observe(el));
}

function stage() {
  const p = patternById(current || '') || patterns[0];
  if (!p) return h('div', { class: 'stage' });
  const list = takesFor(p.id, settings.speed);
  const staff = h('span', { class: 'staff' });
  staff.innerHTML = notation(p, tonicOf(p));
  return h('div', { class: 'stage' },
    h('div', { class: 'now' }, staff, h('span', { class: 'syl' }, p.syllables)),
    h('div', { class: 'controls' },
      seg(Object.fromEntries(Object.entries(SPEEDS).map(([s, label]) => [s, `${label} ${settings.bpm[s]} · ${takesFor(p.id, s).length}`])),
        settings.speed, (v) => { settings.speed = v; save(); render(); }),
      h('span', { class: 'takes' }, list.map((take, i) => h('span', { class: 'take' },
        h('button', { title: `${take.bpm} bpm`, onclick: () => playBlob(take.mp3) }, `▶ ${i + 1}${take.key != null ? ` ${keyName(p.tonality, take.key)}` : ''}`),
        h('button', { class: 'x', title: 'Delete take', onclick: async () => { await deleteTake(take.id); show(); } }, '×')))),
      h('span', { class: 'grow' }),
      h('div', { class: 'beats' }, Array.from({ length: settings.countIn }, () => h('span'))),
      h('div', { class: 'meter' }, h('div')),
      h('span', { class: 'note' }),
      h('button', { class: 'rec', onclick: toggle }, 'Record'),
    ));
}

/* ---------- Recording ---------- */

async function toggle() {
  if (recording) return recording.stop();
  const p = patternById(current || '');
  if (!p) return;
  const note = app.querySelector('.stage .note');
  note.textContent = '';
  try {
    await audio();
    await microphone();
  } catch {
    note.textContent = 'No microphone';
    return;
  }
  record(p);
}

function record(p) {
  const btn = app.querySelector('.rec');
  const dots = [...app.querySelectorAll('.beats span')];
  const beatsEl = app.querySelector('.beats');
  const meter = app.querySelector('.meter div');
  const note = app.querySelector('.stage .note');
  const speed = settings.speed;
  const bpm = settings.bpm[speed];
  const beat = 60 / bpm;
  const key = p.kind === 'tonal' ? settings.key[p.tonality] : null;

  const recorder = new MediaRecorder(mic);
  const parts = [];
  recorder.ondataavailable = (e) => parts.push(e.data);
  recorder.start();
  const begun = ctx.currentTime;

  let t0 = begun + 0.15;
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

  // Beat lights: the count-in, then a silent pulse while recording.
  const timers = [];
  const light = (i) => dots.forEach((d, k) => d.classList.toggle('lit', k === i % dots.length));
  for (let i = 0; i < 64; i++) {
    timers.push(setTimeout(() => {
      beatsEl.classList.toggle('go', i >= settings.countIn);
      light(i);
    }, (t0 + i * beat - ctx.currentTime) * 1000));
  }

  // Level meter, and stop on its own after a second and a half of quiet.
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const input = ctx.createMediaStreamSource(mic);
  input.connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  let heard = false;
  let quietSince = null;
  const poll = setInterval(() => {
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += v * v;
    const rms = Math.sqrt(sum / data.length);
    meter.style.width = `${Math.min(100, rms * 400)}%`;
    if (ctx.currentTime < downbeat) return;
    if (rms > 0.02) { heard = true; quietSince = null; } else if (heard) quietSince ??= ctx.currentTime;
    if ((quietSince && ctx.currentTime - quietSince > 1.5) || ctx.currentTime - downbeat > 30) stop();
  }, 50);

  function stop() {
    if (recorder.state !== 'inactive') recorder.stop();
  }
  recorder.onstop = async () => {
    clearInterval(poll);
    timers.forEach(clearTimeout);
    input.disconnect();
    recording = null;
    btn.textContent = 'Record';
    btn.classList.remove('live');
    light(-1);
    meter.style.width = '0';
    // Anything before a quarter beat ahead of the downbeat is count-in.
    const take = await processTake(new Blob(parts, { type: recorder.mimeType }), downbeat - begun - beat / 4);
    if (!take) {
      note.textContent = 'Nothing heard';
      return;
    }
    await putTake({ id: crypto.randomUUID(), pattern: p.id, speed, bpm, key, created: Date.now(), ...take });
    playBlob(take.mp3);
    takes = await allTakes();
    if (done(p.id, speed)) {
      const i = patterns.findIndex((q) => q.id === p.id);
      const next = [...patterns.slice(i + 1), ...patterns.slice(0, i)].find((q) => !done(q.id, speed));
      if (next) current = next.id;
    }
    render();
  };

  recording = { stop };
  btn.textContent = 'Stop';
  btn.classList.add('live');
}

/* ---------- Download and restore ---------- */

async function downloadZip() {
  const voice = settings.voice;
  const files = [];
  const list = [];
  const numbers = new Map();
  for (const take of takes.sort((a, b) => a.created - b.created)) {
    const p = patternById(take.pattern);
    const tag = `${take.pattern}/${take.speed}${take.key != null ? `-${keyName(p.tonality, take.key).replace('#', 's')}` : ''}`;
    numbers.set(tag, (numbers.get(tag) || 0) + 1);
    const file = `voice/${voice}/${tag}-${numbers.get(tag)}.mp3`;
    files.push({ name: file, data: new Uint8Array(await take.mp3.arrayBuffer()) });
    list.push({ pattern: take.pattern, speed: take.speed, bpm: take.bpm, key: take.key, file, id: take.id, created: take.created, seconds: Math.round(take.seconds * 100) / 100 });
  }
  const json = { voice, label: 'Mr. Washburn', takes: list };
  files.unshift({ name: `voice/${voice}/takes.json`, data: new TextEncoder().encode(JSON.stringify(json, null, 1)) });
  const a = h('a', { href: URL.createObjectURL(makeZip(files)), download: `voice-${voice}-${today()}.zip` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* Adds the zip's takes to the ones on this device. */
async function restoreZip(file) {
  if (!file) return;
  const entries = readZip(await file.arrayBuffer());
  const jsonName = Object.keys(entries).find((n) => n.endsWith('/takes.json'));
  if (!jsonName) return;
  const json = JSON.parse(new TextDecoder().decode(entries[jsonName]));
  const have = new Set(takes.map((t) => t.id));
  for (const t of json.takes || []) {
    if (have.has(t.id) || !entries[t.file] || !patternById(t.pattern)) continue;
    await putTake({ id: t.id, pattern: t.pattern, speed: t.speed, bpm: t.bpm, key: t.key ?? null, created: t.created, seconds: t.seconds, mp3: new Blob([entries[t.file]], { type: 'audio/mpeg' }) });
  }
  show();
}

/* ---------- Keys ---------- */

document.addEventListener('keydown', (e) => {
  if (e.target.closest('textarea, input, select') || !patterns.length) return;
  if (e.code === 'Space') {
    if (e.target.closest('.rec')) return; // the button's own click
    e.preventDefault();
    toggle();
  } else if (recording) {
    // nothing else while recording
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const i = patterns.findIndex((p) => p.id === current) + (e.key === 'ArrowRight' ? 1 : -1);
    if (patterns[i]) { current = patterns[i].id; render(); }
  } else if (['1', '2', '3'].includes(e.key)) {
    settings.speed = Object.keys(SPEEDS)[Number(e.key) - 1];
    save();
    render();
  }
});

show();
