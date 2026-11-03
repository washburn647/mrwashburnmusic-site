/* Mic input: finds the start of each spoken or sung syllable, so "du du-de du du" said
   into the mic counts like taps. Audio is analysed live on the device and never kept.
   The detector runs on the audio thread (mic-worklet.js), which sees every sample. */

let stream = null;
let node = null;
let src = null;
let listener = null;
let level = 0; // 0-1, for meters
let lag = 0.01; // mic input delay, s
let users = 0; // the mic check and the run each hold the mic; it stops when neither does
let opening = null;
let echo = true; // echo cancelling; Test mode can turn it off
let rec = null; // Test mode recording: { rate, chunks, onsets }

/* Test mode: record what the mic hears, and every syllable it finds, until recordStop(). */
export function recordStart() {
  rec = { chunks: [], onsets: [] };
  node?.port.postMessage({ rec: true });
}

/* The recording so far: { rate, t0, samples, onsets }, all times on the audio clock. */
export async function recordStop() {
  if (!rec) return null;
  node?.port.postMessage({ rec: false });
  await new Promise((r) => setTimeout(r, 100)); // the last chunk
  const { chunks, onsets } = rec;
  rec = null;
  if (!chunks.length) return null;
  const n = chunks.reduce((a, c) => a + c.pcm.length, 0);
  const samples = new Float32Array(n);
  let at = 0;
  for (const c of chunks) { samples.set(c.pcm, at); at += c.pcm.length; }
  return { rate: node?.context.sampleRate || 48000, t0: chunks[0].t, samples, onsets, settings: lastSettings };
}

export function setEcho(on) { echo = on; }
let lastSettings = {};

export const on = () => !!stream;
export const getLevel = () => level;
/* What the mic hears arrives this much after it was said. */
export const inputLag = () => lag;

/* Each start() needs its own stop(): the mic stays open while anyone still holds it. */
export async function start(ctx) {
  users++;
  try {
    opening ||= open(ctx);
    await opening;
  } catch (e) {
    users--;
    opening = null;
    throw e;
  }
}

async function open(ctx) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no mic access here.');
  if (!ctx.audioWorklet) throw new Error('This browser can\'t listen for syllables. Tapping still works.');
  await ctx.audioWorklet.addModule(new URL('./mic-worklet.js', import.meta.url));
  // Auto gain pumps the room noise up between syllables, which reads as more syllables:
  // leave it off, the detector measures against the room's own noise level instead.
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: echo, noiseSuppression: false, autoGainControl: false },
  });
  const set = stream.getAudioTracks()[0]?.getSettings?.() || {};
  lastSettings = { ...set, deviceId: undefined, groupId: undefined };
  if (set.latency > 0 && set.latency < 0.2) lag = set.latency;
  src = ctx.createMediaStreamSource(stream);
  node = new AudioWorkletNode(ctx, 'syllables', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
  node.port.onmessage = (e) => {
    if (e.data.level != null) level = e.data.level;
    if (e.data.pcm) rec?.chunks.push(e.data);
    if (e.data.onset != null) {
      rec?.onsets.push(e.data.onset);
      listener?.(e.data.onset - lag);
    }
  };
  // Some browsers (Safari) only run nodes that lead to the speakers: a silent path does.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(node).connect(mute).connect(ctx.destination);
}

export function listen(fn) { listener = fn; }

/* Two syllables can't be closer than about half an eighth note at this tempo. */
export function setTempo(bpm) {
  node?.port.postMessage({ minGap: Math.min(0.16, Math.max(0.08, 0.45 * 30 / bpm)) });
}

export function stop() {
  users = Math.max(0, users - 1);
  if (users) return;
  opening = null;
  stream?.getTracks().forEach((t) => t.stop());
  src?.disconnect();
  node?.disconnect();
  stream = null;
  node = null;
  src = null;
  listener = null;
  level = 0;
}
