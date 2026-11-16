/* Slide audio: recordings for the class app's slides, in layers (an instrument, a voice...),
   each layer recorded while the others play (on headphones), so they line up.
   Kept with the Class app's own files on the website (/studio/api/class/, private behind
   Kyle's sign-in, never the public site), one record per recording in the library kind
   (id 'audio-…', see class/tracks.js), each layer an mp3 in its media (tagged classroom).
   The class app gets them by its sync; a slide plays one through its Recording widget.

   Lining up: the take is moved earlier by the time sound takes to come out of the speakers
   and back in through the microphone (what the browser reports), and by the mp3's own delay
   (measured once), so a new layer sits where it was played. Nudge moves a layer by hand
   (ms; later is more). Count-in clicks go before the take; Click keeps them going. */

import { h, confirmButton } from '../dom.js';
import { Mixer, decodeLayers, kindOf } from '/class/mixer.js';

const API = '/studio/api/class/';
const RATE = 44100;              // the mp3s' sample rate
const KBPS = 128;
const MAX_SECONDS = 600;         // a take stops on its own after this

let deps = null;                 // { render, getMic, ensureMic, micError }
let list = null;                 // the recordings, as on the website
let songs = [];                  // the year plan's catalog, for the song box
let loading = null;
let loadError = '';
let sel = null;                  // the recording open
let msg = { text: '', bad: false };
let rec = null;                  // the take being recorded: { track, layer, stop, phase }
let mix = null;                  // what's playing here
const muted = new Set();         // layers left out of playing and playing along
const blobs = new Map();         // media hash -> mp3 Blob
let ctx = null;

export function setup(d) { deps = d; }
export const busy = () => !!rec;

/* ---------- The website ---------- */

async function call(path, opts = {}) {
  const r = await fetch(API + path, { cache: 'no-store', redirect: 'manual', ...opts });
  if (r.type === 'opaqueredirect' || r.status === 401 || r.status === 403) throw new Error('your sign-in ran out. Reload the page and try again');
  return r;
}

async function getJSON(path) {
  const r = await call(path);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`the site said ${r.status}`);
  return r.json();
}

async function load() {
  try {
    const state = await getJSON('state');
    const ids = Object.entries(state.library || {}).filter(([id, v]) => id.startsWith('audio-') && !v.gone).map(([id]) => id);
    list = (await Promise.all(ids.map((id) => getJSON('library/' + encodeURIComponent(id))))).filter((t) => t && Array.isArray(t.layers));
    const years = Object.entries(state.plans || {}).filter(([, v]) => !v.gone).map(([y]) => y).sort();
    if (years.length) {
      const plan = await getJSON('plans/' + encodeURIComponent(years[years.length - 1]));
      const names = Object.values(plan?.catalog || {}).flat().filter((s) => s && s.name && !s.shelf).map((s) => s.name);
      songs = [...new Set(names)].sort((a, b) => a.localeCompare(b));
    }
    if (!list.some((t) => t.id === sel)) sel = list[0]?.id || null;
  } catch (e) {
    loadError = `Couldn't load the recordings: ${e.message}`;
  }
  deps.render();
}

const blank = (id) => ({ id, kind: 'audio', name: '', song: '', bpm: 100, countIn: 4, click: false, created: Date.now(), updated: 0, layers: [] });

/* A change to a recording as it is on the website now, one at a time (see the picture
   library's save). Resolves to the saved record. */
let saving = Promise.resolve();
function change(id, fn) {
  const run = saving.then(() => saveNow(id, fn));
  saving = run.catch(() => {});
  return run.catch((e) => { say(`Couldn't save: ${e.message}`, true); throw e; });
}

async function saveNow(id, fn) {
  let base = null;
  for (let tries = 0; tries < 4; tries++) {
    const now = (await getJSON('library/' + encodeURIComponent(id))) || blank(id);
    const was = base != null ? base : now.updated || 0;
    fn(now);
    const u = Math.max(Date.now(), was + 1);
    now.updated = u;
    delete now.synced;
    const r = await call(`library/${encodeURIComponent(id)}?u=${u}${was ? `&base=${was}` : ''}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(now) });
    if (r.status === 409) { base = (await r.json().catch(() => ({}))).u || null; continue; }
    if (!r.ok) throw new Error(`the site said ${r.status}`);
    const i = list.findIndex((t) => t.id === id);
    if (i >= 0) list[i] = now; else list.push(now);
    return now;
  }
  throw new Error('it kept changing. Reload and try again');
}

async function remove(t) {
  stopPlay();
  try {
    const now = await getJSON('library/' + encodeURIComponent(t.id));
    if (now) {
      const was = now.updated || 0;
      const u = Math.max(Date.now(), was + 1);
      const r = await call(`library/${encodeURIComponent(t.id)}?u=${u}${was ? `&base=${was}` : ''}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`the site said ${r.status}`);
    }
    list = list.filter((x) => x.id !== t.id);
    sel = list[0]?.id || null;
    say('');
  } catch (e) {
    say(`Couldn't delete: ${e.message}`, true);
  }
  deps.render();
}

async function blobOf(hash) {
  if (blobs.has(hash)) return blobs.get(hash);
  const r = await call('media/' + hash);
  if (!r.ok) throw new Error(`a layer's sound didn't load (${r.status})`);
  const b = await r.blob();
  blobs.set(hash, b);
  return b;
}

async function upload(blob, name) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hash = Array.from(d.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
  const r = await call('media/' + hash, { method: 'PUT', body: blob,
    headers: { 'Content-Type': 'audio/mpeg', 'X-Rights': 'classroom', 'X-Name': encodeURIComponent(name) } });
  if (!r.ok) throw new Error(`the site said ${r.status}`);
  blobs.set(hash, blob);
  return hash;
}

/* ---------- Audio ---------- */

/* One context for playing and recording. With a microphone, it must take it: Firefox won't
   connect a microphone to a context at another rate, so it's made again at the mic's. */
async function audio(mic) {
  if (ctx && mic) {
    try { ctx.createMediaStreamSource(mic).disconnect(); } catch { await ctx.close(); ctx = null; }
  }
  if (!ctx) {
    const rate = mic?.getAudioTracks()[0]?.getSettings().sampleRate;
    for (const r of [rate, undefined, 48000, 44100]) {
      try {
        const c = new AudioContext({ latencyHint: 'interactive', ...(r ? { sampleRate: r } : {}) });
        if (mic) c.createMediaStreamSource(mic).disconnect();
        ctx = c;
        ctx.worklet = null;
        break;
      } catch { /* the next rate */ }
    }
    if (!ctx) throw new Error('no audio here');
  }
  if (ctx.state === 'suspended') await ctx.resume();
  if (mic) {
    ctx.worklet ||= ctx.audioWorklet.addModule('/studio/record/capture-worklet.js');
    await ctx.worklet;
  }
  return ctx;
}

function click(c, t, accent) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.value = accent ? 1760 : 1320;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.06);
}

function encode(pcm) {
  const enc = new window.lamejs.Mp3Encoder(1, RATE, KBPS);
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) chunks.push(enc.encodeBuffer(pcm.subarray(i, i + 1152)));
  chunks.push(enc.flush());
  return new Blob(chunks, { type: 'audio/mpeg' });
}

const decode = (c, blob) => blob.arrayBuffer().then((b) => new Promise((ok, fail) => c.decodeAudioData(b, ok, fail)));

/* How late an mp3 made here plays back (the encoder's padding), in seconds: measured once
   with a click. */
let codec = null;
async function codecDelay(c) {
  if (codec != null) return codec;
  const pcm = new Int16Array(RATE / 2);
  const at = RATE / 10;
  pcm[at] = 30000;
  pcm[at + 1] = -30000;
  try {
    const b = await decode(c, encode(pcm));
    const x = b.getChannelData(0);
    let best = 0;
    for (let i = 1; i < x.length; i++) if (Math.abs(x[i]) > Math.abs(x[best])) best = i;
    codec = Math.max(0, Math.min(0.2, best / b.sampleRate - at / RATE));
  } catch {
    codec = 0;
  }
  return codec;
}

/* The take as an mp3: resampled to 44.1 kHz mono and brought up toward full level. */
async function toMp3(x, sr) {
  let y = x;
  if (sr !== RATE) {
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(x.length * RATE / sr)), RATE);
    const buf = off.createBuffer(1, x.length, sr);
    buf.copyToChannel(x, 0);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination);
    src.start();
    y = (await off.startRendering()).getChannelData(0);
  }
  let top = 0;
  for (const v of y) top = Math.max(top, Math.abs(v));
  const g = Math.min(8, 0.9 / top);
  const fade = Math.min(Math.floor(0.01 * RATE), y.length >> 2);
  const pcm = new Int16Array(y.length);
  for (let i = 0; i < y.length; i++) {
    let k = g;
    if (i > y.length - fade) k *= (y.length - i) / fade;
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(y[i] * k * 32767)));
  }
  await new Promise((r) => setTimeout(r));
  return { mp3: encode(pcm), seconds: y.length / RATE };
}

/* ---------- Playing ---------- */

async function mixerFor(t, except) {
  const layers = t.layers.filter((l) => l.media && !muted.has(l.id) && l.id !== except);
  if (!layers.length) return null;
  const c = await audio(null);
  return new Mixer(await decodeLayers(layers, blobOf, c), c);
}

function stopPlay() {
  if (mix) { mix.dispose(); mix = null; }
}

async function play(t, from = 0) {
  if (rec) return;
  if (mix) { stopPlay(); deps.render(); return; }
  try {
    const m = await mixerFor(t);
    if (!m) return;
    stopPlay();
    mix = m;
    mix.onend = () => { if (mix === m) { m.dispose(); mix = null; deps.render(); } };
    mix.play(from);
  } catch (e) {
    say(`Couldn't play: ${e.message}`, true);
  }
  deps.render();
}

/* Played again from where it is, after a layer's nudge or on/off changed. */
async function replay(t) {
  if (!mix) return;
  const at = mix.position();
  stopPlay();
  await play(t, at);
}

/* ---------- Recording ---------- */

async function record(t, layerId) {
  if (rec) { rec.stop(); return; }
  stopPlay();
  say('');
  const mic = await deps.ensureMic();
  if (!mic) { say(deps.micError() || 'Turn on the microphone', true); deps.render(); return; }
  let c, along;
  try {
    c = await audio(mic);
    await codecDelay(c);
    along = await mixerFor(t, layerId);
  } catch (e) {
    say(`Couldn't start recording: ${e.message}`, true);
    return;
  }
  const sr = c.sampleRate;
  const source = c.createMediaStreamSource(mic);
  const node = new AudioWorkletNode(c, 'capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
  const sink = c.createGain();
  sink.gain.value = 0;
  source.connect(node).connect(sink).connect(c.destination);
  const chunks = [];
  let flushed;
  const ended = new Promise((ok) => { flushed = ok; });
  node.port.onmessage = (e) => { if (e.data === 'done') flushed(); else chunks.push(e.data); };

  const beat = 60 / (t.bpm || 100);
  const count = t.countIn || 0;
  const t0 = c.currentTime + 0.3;
  for (let i = 0; i < count; i++) click(c, t0 + i * beat, i === 0);
  const zero = t0 + count * beat;           // the recording's start
  if (along) along.play(0, zero);
  // Click: on through the take, scheduled a little ahead.
  let nextClick = 0;
  const clicker = t.click ? setInterval(() => {
    while (zero + nextClick * beat < c.currentTime + 0.4) {
      if (zero + nextClick * beat >= c.currentTime) click(c, zero + nextClick * beat, false);
      nextClick++;
    }
  }, 100) : 0;
  const timers = [];
  const at = (when, fn) => timers.push(setTimeout(fn, Math.max(0, (when - c.currentTime) * 1000)));
  if (count) {
    for (let i = 0; i < count; i++) at(t0 + i * beat, () => say(String(count - i)));
  }
  at(zero, () => { say('● Recording'); if (rec) { rec.phase = 'on'; } });
  at(zero + MAX_SECONDS, () => finish(true));

  let stopping = false;
  async function finish(keep) {
    if (stopping) return;
    stopping = true;
    timers.forEach(clearTimeout);
    clearInterval(clicker);
    node.port.postMessage('stop');
    await ended;
    source.disconnect();
    node.disconnect();
    sink.disconnect();
    along?.dispose();
    rec = null;
    if (!keep) { say('Stopped, nothing saved'); deps.render(); return; }
    say('Saving…');
    deps.render();
    try {
      await keepTake(t, layerId, chunks, sr, zero, mic, c);
    } catch (e) {
      say(`Couldn't save the take: ${e.message}`, true);
    }
    deps.render();
  }
  rec = { track: t.id, layer: layerId, stop: () => finish(true), phase: count ? 'count' : 'on' };
  say(count ? 'Count-in' : '● Recording');
  deps.render();
}

async function keepTake(t, layerId, chunks, sr, zero, mic, c) {
  if (!chunks.length) throw new Error('nothing came from the microphone');
  const first = chunks[0].frame;
  const last = chunks[chunks.length - 1];
  const all = new Float32Array(last.frame - first + last.data.length);
  for (const k of chunks) all.set(k.data, k.frame - first);
  const inLatency = Number(mic.getAudioTracks()[0]?.getSettings().latency) || 0;
  const lag = (c.outputLatency || 0) + (c.baseLatency || 0) + inLatency + (await codecDelay(c));
  const start = Math.round((zero + lag) * sr) - first;
  let x;
  if (start >= 0) x = all.subarray(Math.min(start, all.length));
  else { x = new Float32Array(all.length - start); x.set(all, -start); }
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  if (x.length < sr * 0.2 || peak < 0.003) { say('Too quiet, nothing saved. Check the microphone level.', true); return; }
  const { mp3, seconds } = await toMp3(x, sr);
  const layer = t.layers.find((l) => l.id === layerId);
  say('Uploading…');
  const hash = await upload(mp3, `${t.name || 'Recording'} · ${layer?.name || 'Layer'}`);
  await change(t.id, (now) => {
    const l = now.layers.find((y) => y.id === layerId);
    if (l) Object.assign(l, { media: hash, seconds: Math.round(seconds * 100) / 100, nudge: 0 });
  });
  say(`Saved (${seconds.toFixed(1)} s)`);
  const fresh = list.find((y) => y.id === t.id);
  if (fresh) play(fresh, 0);
}

/* ---------- Page ---------- */

function say(text, bad = false) {
  msg = { text, bad };
  for (const el of document.querySelectorAll('.tstatus')) {
    el.textContent = text;
    el.classList.toggle('bad', bad);
  }
}

async function newTrack() {
  if (rec) return;
  const id = `audio-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  try {
    await change(id, (t) => {
      t.name = `Recording ${list.length + 1}`;
      t.layers = [{ id: 'l1', name: 'Piano', kind: 'inst', vol: 1 }, { id: 'l2', name: 'Voice', kind: 'voice', vol: 1 }];
    });
    sel = id;
  } catch { /* said */ }
  deps.render();
}

function addLayer(t, kind) {
  const n = Math.max(0, ...t.layers.map((l) => Number(String(l.id).slice(1)) || 0)) + 1;
  const same = t.layers.filter((l) => kindOf(l) === kind).length;
  const name = `${KINDS[kind]}${same ? ` ${same + 1}` : ''}`;
  change(t.id, (now) => { now.layers.push({ id: `l${n}`, name, kind, vol: 1 }); }).then(deps.render, () => {});
}

// Instruments are choices in the slide player (one at a time); voices and others turn on and off.
const KINDS = { inst: 'Instrument', voice: 'Voice', other: 'Layer' };

function edit(t, fn, after) {
  fn(t);
  change(t.id, fn).then(() => { deps.render(); if (after) after(); }, () => {});
}

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function num(value, min, max, onset, title) {
  return h('input', { type: 'number', min, max, value, title, onchange: (e) => {
    const v = Math.max(min, Math.min(max, Math.round(Number(e.target.value)) || 0));
    e.target.value = v;
    onset(v);
  } });
}

export function view() {
  if (loadError) return [h('p', { class: 'status bad' }, loadError)];
  if (!list) {
    loading ||= load();
    return [h('p', { class: 'hint' }, 'Loading…')];
  }
  const t = list.find((x) => x.id === sel) || null;
  const sorted = [...list].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  return [
    h('div', { class: 'bar summary' },
      h('h2', {}, 'Slide audio'),
      h('span', { class: 'total' }, `${list.length} recordings`),
      h('span', { class: 'grow' }),
      h('button', { disabled: !!rec, onclick: newTrack }, '+ Recording')),
    h('div', { class: 'grid tracks' }, sorted.map((x) => h('div', {
      class: `card${x.id === sel ? ' on' : ''}${x.layers.some((l) => l.media) ? ' complete' : ''}`,
      tabindex: 0,
      onclick: () => { if (!rec && sel !== x.id) { stopPlay(); sel = x.id; say(''); deps.render(); } },
      onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) e.currentTarget.click(); },
    },
    h('b', { class: 'line-label' }, x.name || 'Untitled'),
    x.song ? h('span', { class: 'syl' }, x.song) : null,
    h('span', { class: 'counts' }, x.layers.map((l) => h('span', { class: l.media ? 'sp done' : 'sp' }, l.name)))))),
    h('datalist', { id: 'song-list' }, songs.map((s) => h('option', { value: s }))),
    t ? trackEditor(t) : null,
  ];
}

function songBox(t) {
  const box = h('input', { class: 'name', value: t.song || '', onchange: (e) => edit(t, (x) => { x.song = e.target.value.trim(); }) });
  box.setAttribute('list', 'song-list');
  return box;
}

function trackEditor(t) {
  const row = (label, ...kids) => h('div', { class: 'row' }, h('span', { class: 'label' }, label), kids);
  const playing = !!mix;
  const recLayer = rec && rec.track === t.id ? rec.layer : null;
  const longest = Math.max(0, ...t.layers.map((l) => l.seconds || 0));
  return h('div', { class: 'editor track' },
    row('Name', h('input', { class: 'name', value: t.name, onchange: (e) => edit(t, (x) => { x.name = e.target.value.trim() || x.name; }) })),
    row('Song', songBox(t)),
    row('Tempo',
      num(t.bpm || 100, 30, 240, (v) => edit(t, (x) => { x.bpm = v; })),
      h('label', {}, 'Count-in', num(t.countIn ?? 4, 0, 16, (v) => edit(t, (x) => { x.countIn = v; }))),
      h('label', {}, h('input', { type: 'checkbox', checked: !!t.click, onchange: (e) => edit(t, (x) => { x.click = e.target.checked; }) }), 'Click')),
    h('div', { class: 'layers' }, t.layers.map((l, i) => h('div', { class: `layer${l.media ? '' : ' empty'}${recLayer === l.id ? ' live' : ''}` },
      h('input', { type: 'checkbox', title: 'Play', checked: !muted.has(l.id), disabled: !l.media, onchange: (e) => {
        if (e.target.checked) muted.delete(l.id); else muted.add(l.id);
        replay(t);
      } }),
      h('input', { class: 'lname', value: l.name, onchange: (e) => edit(t, (x) => { const y = x.layers.find((z) => z.id === l.id); if (y) y.name = e.target.value.trim() || y.name; }) }),
      h('select', { class: 'lkind', onchange: (e) => edit(t, (x) => { const y = x.layers.find((z) => z.id === l.id); if (y) y.kind = e.target.value; }) },
        Object.entries(KINDS).map(([k, label]) => h('option', { value: k, selected: kindOf(l) === k }, label))),
      h('span', { class: 'sp' }, l.media ? clock(l.seconds || 0) : '–'),
      h('input', { type: 'range', class: 'lvol', title: 'Level', min: 0, max: 1, step: 0.01, value: l.vol ?? 1, disabled: !l.media,
        oninput: (e) => {
          const k = mix?.layers.findIndex((y) => y.id === l.id);
          if (k >= 0) mix.setLevel(k, Number(e.target.value));
        },
        onchange: (e) => edit(t, (x) => { const y = x.layers.find((z) => z.id === l.id); if (y) y.vol = Number(e.target.value); }) }),
      h('label', { title: 'ms later' }, 'Nudge', num(l.nudge || 0, -2000, 2000, (v) => edit(t, (x) => { const y = x.layers.find((z) => z.id === l.id); if (y) y.nudge = v; }, () => replay(list.find((y) => y.id === t.id))), 'ms later')),
      h('span', { class: 'grow' }),
      h('button', { class: `rec small${recLayer === l.id ? ' live' : ''}`, disabled: !!rec && recLayer !== l.id,
        onclick: () => record(t, l.id) }, recLayer === l.id ? 'Stop' : l.media ? 'Record again' : 'Record'),
      confirmButton('×', 'Delete?', () => { stopPlay(); edit(t, (x) => { x.layers = x.layers.filter((y) => y.id !== l.id); }); }),
    ))),
    h('div', { class: 'row' },
      h('button', { disabled: !!rec, onclick: () => addLayer(t, 'inst') }, '+ Instrument'),
      h('button', { disabled: !!rec, onclick: () => addLayer(t, 'voice') }, '+ Voice'),
      h('button', { disabled: !!rec, onclick: () => addLayer(t, 'other') }, '+ Layer'),
      h('span', { class: 'grow' }),
      confirmButton('Delete recording', 'Delete?', () => remove(t))),
    h('div', { class: 'stage' },
      h('button', { class: 'primary', disabled: !!rec || !t.layers.some((l) => l.media), onclick: () => play(t) }, playing ? '■ Stop' : '▶ Play'),
      longest ? h('span', { class: 'total' }, clock(longest)) : null,
      h('span', { class: 'grow' }),
      h('div', { class: 'level', title: 'Microphone level' }, h('div')),
      h('span', { class: `status tstatus${msg.bad ? ' bad' : ''}` }, msg.text)),
  );
}

/* Space: stop recording, or play and stop. */
document.addEventListener('keydown', (e) => {
  if (!deps?.active() || !list || e.code !== 'Space') return;
  if (e.target.closest('textarea, input, select, button') || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  if (rec) { rec.stop(); return; }
  const t = list.find((x) => x.id === sel);
  if (t) play(t);
});
