/* Voice recorder: Kyle's list of spoken and sung patterns, a few takes of each.
   Each take is recorded after a count-in, trimmed to where the voice starts, and saved as a
   small mp3 (24 kHz mono) on this device (IndexedDB 'mwm-voice'). "Download for site"
   makes a zip that tools/add_takes.py puts in /assets/sounds/, where samples.takes() plays
   a different take each time a pattern comes up. */

import * as samples from '/assets/sounds/samples.js';
import { h } from '../dom.js';
import { makeZip, readZip } from './zip.js';

const { patternKey } = samples;
const app = document.getElementById('app');

/* ---------- Storage ---------- */

// lines: { id, text, order, takes: [{ id, bpm, created, seconds, mp3: Blob }] }
let dbPromise = null;
function db() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('mwm-voice', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('lines', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction('lines', mode);
    const req = fn(t.objectStore('lines'));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
  }));
}
const allLines = async () => (await tx('readonly', (s) => s.getAll())).sort((a, b) => a.order - b.order);
const putLine = (line) => tx('readwrite', (s) => s.put(line));
const deleteLine = (id) => tx('readwrite', (s) => s.delete(id));

const SETTINGS = 'mwm-voice-settings';
const settings = { voice: 'kyle', bpm: 80, countIn: 4, want: 3, startNote: '' };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS)) || {}); } catch { /* defaults */ }
function saveSettings() {
  try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch { /* not kept */ }
}

const slug = (text) => patternKey(text).replace(/'/g, '').replace(/ +/g, '-') || 'line';
const today = () => new Date().toISOString().slice(0, 10);

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
  piano ||= await samples.instrument('piano', { lo: 60, hi: 71 });
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

let lines = [];
let current = null;
let recording = null;
const NOTES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

async function showList() {
  lines = await allLines();
  if (!lines.length) return showEdit();
  if (!lines.some((l) => l.id === current)) current = (lines.find((l) => l.takes.length < settings.want) || lines[0]).id;

  const restore = h('input', { type: 'file', accept: '.zip,application/zip', hidden: true, onchange: () => restoreZip(restore.files[0]) });
  const number = (key, min, max) => h('input', { type: 'number', min, max, value: settings[key], onchange: (e) => {
    settings[key] = Math.max(min, Math.min(max, Number(e.target.value) || settings[key]));
    e.target.value = settings[key];
    saveSettings();
    if (key === 'want') showList();
  } });
  const startNote = h('select', { onchange: (e) => { settings.startNote = e.target.value; saveSettings(); } },
    h('option', { value: '' }, 'No starting note'),
    Array.from({ length: 12 }, (_, i) => h('option', { value: 60 + i, selected: String(60 + i) === String(settings.startNote) }, `Do = ${NOTES[i]}`)));

  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '‹ Studio')),
    h('div', { class: 'bar' },
      h('h1', { class: 'grow' }, 'Voice recorder'),
      h('button', { onclick: showEdit }, 'Edit list'),
      h('button', { onclick: () => restore.click() }, 'Restore'),
      restore,
      h('button', { class: 'primary', onclick: downloadZip, disabled: !lines.some((l) => l.takes.length) }, 'Download for site'),
    ),
    h('div', { class: 'bar' },
      h('label', {}, 'Tempo', number('bpm', 40, 200)),
      h('label', {}, 'Count-in', number('countIn', 1, 8)),
      h('label', {}, 'Takes', number('want', 1, 10)),
      startNote,
    ),
    h('ul', { class: 'lines' }, lines.map(lineRow)),
    stage(),
  );
  app.querySelector('.lines li.on')?.scrollIntoView({ block: 'nearest' });
}

function lineRow(line) {
  return h('li', {
    class: [line.id === current && 'on', line.takes.length >= settings.want && 'done'].filter(Boolean).join(' '),
    onclick: (e) => { if (!e.target.closest('button') && !recording) { current = line.id; showList(); } },
  },
  h('span', { class: 'text' }, line.text),
  line.takes.map((take, i) => h('span', { class: 'take' },
    h('button', { title: `${take.bpm} bpm`, onclick: () => playBlob(take.mp3) }, `▶ ${i + 1}`),
    h('button', { class: 'x', title: 'Delete take', onclick: () => deleteTake(line, take) }, '×'))),
  h('span', { class: 'count' }, `${line.takes.length}/${settings.want}`));
}

function stage() {
  const line = lines.find((l) => l.id === current);
  return h('div', { class: 'stage' },
    h('span', { class: 'now' }, line?.text || ''),
    h('div', { class: 'beats' }, Array.from({ length: settings.countIn }, () => h('span'))),
    h('div', { class: 'meter' }, h('div')),
    h('span', { class: 'note' }),
    h('button', { class: 'rec', onclick: toggle }, 'Record'),
  );
}

async function deleteTake(line, take) {
  line.takes = line.takes.filter((t) => t !== take);
  await putLine(line);
  showList();
}

/* ---------- Recording ---------- */

async function toggle() {
  if (recording) return recording.stop();
  const line = lines.find((l) => l.id === current);
  if (!line) return;
  const note = app.querySelector('.stage .note');
  note.textContent = '';
  try {
    await audio();
    await microphone();
  } catch {
    note.textContent = 'No microphone';
    return;
  }
  record(line);
}

function record(line) {
  const btn = app.querySelector('.rec');
  const dots = [...app.querySelectorAll('.beats span')];
  const beatsEl = app.querySelector('.beats');
  const meter = app.querySelector('.meter div');
  const note = app.querySelector('.stage .note');
  const bpm = settings.bpm;
  const beat = 60 / bpm;

  const recorder = new MediaRecorder(mic);
  const parts = [];
  recorder.ondataavailable = (e) => parts.push(e.data);
  recorder.start();
  const begun = ctx.currentTime;

  let t0 = begun + 0.15;
  if (settings.startNote) {
    piano.note(Number(settings.startNote), t0, beat * 1.8, { vol: 0.3 });
    t0 += beat * 2;
  }
  for (let i = 0; i < settings.countIn; i++) claves.hit(t0 + i * beat, { vol: i ? 0.6 : 1 });
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
    if (recorder.state === 'inactive') return;
    recorder.stop();
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
    const blob = new Blob(parts, { type: recorder.mimeType });
    // Anything before a quarter beat ahead of the downbeat is count-in.
    const take = await processTake(blob, downbeat - begun - beat / 4);
    if (!take) {
      note.textContent = 'Nothing heard';
      return;
    }
    line.takes.push({ id: crypto.randomUUID(), bpm, created: Date.now(), ...take });
    await putLine(line);
    playBlob(take.mp3);
    if (line.takes.length >= settings.want) {
      const next = lines.find((l) => l.order > line.order && l.takes.length < settings.want)
        || lines.find((l) => l.takes.length < settings.want);
      if (next) current = next.id;
    }
    showList();
  };

  recording = { stop };
  btn.textContent = 'Stop';
  btn.classList.add('live');
}

/* ---------- Editing the list ---------- */

async function showEdit() {
  lines = await allLines();
  const area = h('textarea', { class: 'list', placeholder: 'du de du de\ndu da di du\nso mi so mi', value: lines.map((l) => l.text).join('\n') });
  const save = h('button', { class: 'primary', onclick: () => saveList(area.value, save) }, 'Save');
  app.replaceChildren(
    h('div', { class: 'bar' }, h('a', { class: 'back', href: '/studio/' }, '‹ Studio')),
    h('div', { class: 'bar' },
      h('h1', { class: 'grow' }, 'Voice recorder'),
      lines.length ? h('button', { onclick: showList }, 'Cancel') : null,
      save,
    ),
    area,
  );
  area.focus();
}

async function saveList(text, btn) {
  const wanted = [...new Map(text.split('\n').map((t) => t.trim()).filter(Boolean).map((t) => [patternKey(t), t])).values()];
  const keep = new Set(wanted.map(patternKey));
  const losing = lines.filter((l) => !keep.has(patternKey(l.text)));
  const lost = losing.reduce((n, l) => n + l.takes.length, 0);
  if (lost && !btn.dataset.armed) {
    btn.dataset.armed = '1';
    btn.textContent = `Save and delete ${lost} take${lost > 1 ? 's' : ''}`;
    btn.classList.replace('primary', 'danger');
    return;
  }
  const byKey = new Map(lines.map((l) => [patternKey(l.text), l]));
  for (const l of losing) await deleteLine(l.id);
  for (const [i, t] of wanted.entries()) {
    const line = byKey.get(patternKey(t)) || { id: crypto.randomUUID(), takes: [] };
    await putLine({ ...line, text: t, order: i });
  }
  showList();
}

/* ---------- Download and restore ---------- */

async function downloadZip() {
  const voice = settings.voice;
  const files = [];
  const patterns = {};
  for (const line of lines) {
    patterns[line.text] = [];
    for (const [i, take] of line.takes.entries()) {
      const file = `voice/${voice}/${slug(line.text)}-${i + 1}.mp3`;
      files.push({ name: file, data: new Uint8Array(await take.mp3.arrayBuffer()) });
      patterns[line.text].push({ file, bpm: take.bpm, id: take.id, created: take.created, seconds: Math.round(take.seconds * 100) / 100 });
    }
  }
  const json = { voice, label: 'Mr. Washburn', patterns };
  files.unshift({ name: `voice/${voice}/takes.json`, data: new TextEncoder().encode(JSON.stringify(json, null, 1)) });
  const a = h('a', { href: URL.createObjectURL(makeZip(files)), download: `voice-${voice}-${today()}.zip` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* Adds the zip's lines and takes to the ones on this device. */
async function restoreZip(file) {
  if (!file) return;
  const entries = readZip(await file.arrayBuffer());
  const jsonName = Object.keys(entries).find((n) => n.endsWith('/takes.json'));
  if (!jsonName) return;
  const json = JSON.parse(new TextDecoder().decode(entries[jsonName]));
  lines = await allLines();
  const byKey = new Map(lines.map((l) => [patternKey(l.text), l]));
  let order = lines.length;
  for (const [text, takes] of Object.entries(json.patterns)) {
    const line = byKey.get(patternKey(text)) || { id: crypto.randomUUID(), text, order: order++, takes: [] };
    const have = new Set(line.takes.map((t) => t.id));
    for (const t of takes) {
      if (have.has(t.id) || !entries[t.file]) continue;
      line.takes.push({ id: t.id, bpm: t.bpm, created: t.created, seconds: t.seconds, mp3: new Blob([entries[t.file]], { type: 'audio/mpeg' }) });
    }
    await putLine(line);
  }
  showList();
}

/* ---------- Keys ---------- */

document.addEventListener('keydown', (e) => {
  if (e.target.closest('textarea, input, select, button') || !lines.length || !app.querySelector('.lines')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    toggle();
  } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !recording) {
    e.preventDefault();
    const i = lines.findIndex((l) => l.id === current) + (e.key === 'ArrowDown' ? 1 : -1);
    if (lines[i]) { current = lines[i].id; showList(); }
  }
});

showList();
