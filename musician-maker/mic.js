/* Mic input: finds the start of each spoken or sung syllable, so "du du-de du du" said
   into the mic counts like taps. Audio is analysed live on the device and never kept.
   The detector runs on the audio thread (mic-worklet.js), which sees every sample. */

let stream = null;
let node = null;
let src = null;
let listener = null;
let level = 0; // 0-1, for meters
let lag = 0.01; // mic input delay, s

export const on = () => !!stream;
export const getLevel = () => level;
/* What the mic hears arrives this much after it was said. */
export const inputLag = () => lag;

export async function start(ctx) {
  if (stream) return;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no mic access here.');
  if (!ctx.audioWorklet) throw new Error('This browser can\'t listen for syllables. Tapping still works.');
  await ctx.audioWorklet.addModule(new URL('./mic-worklet.js', import.meta.url));
  // Auto gain pumps the room noise up between syllables, which reads as more syllables:
  // leave it off, the detector measures against the room's own noise level instead.
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
  });
  const set = stream.getAudioTracks()[0]?.getSettings?.() || {};
  if (set.latency > 0 && set.latency < 0.2) lag = set.latency;
  src = ctx.createMediaStreamSource(stream);
  node = new AudioWorkletNode(ctx, 'syllables', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
  node.port.onmessage = (e) => {
    if (e.data.level != null) level = e.data.level;
    if (e.data.onset != null) listener?.(e.data.onset - lag);
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
  stream?.getTracks().forEach((t) => t.stop());
  src?.disconnect();
  node?.disconnect();
  stream = null;
  node = null;
  src = null;
  listener = null;
  level = 0;
}
