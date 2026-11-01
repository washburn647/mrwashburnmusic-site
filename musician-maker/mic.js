/* Mic input: finds the start of each spoken or sung syllable, so "du du-de du du" said
   into the mic counts like taps. Audio is analysed live on the device and never kept. */

let stream = null;
let analyser = null;
let ctx = null;
let raf = 0;
let listener = null;
let floor = 0.01;
let last = -1;
let prev = 0;

export const on = () => !!stream;

export async function start(audioCtx) {
  if (stream) return;
  ctx = audioCtx;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
  });
  const src = ctx.createMediaStreamSource(stream);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const loop = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const now = ctx.currentTime;
    const threshold = Math.max(floor * 4, 0.03);
    // A syllable starts where the level jumps past the threshold, at least 110 ms after the last one.
    if (rms > threshold && prev <= threshold && now - last > 0.11) {
      last = now;
      // The level rises over one analysis window; date it to the window's middle.
      listener?.(now - analyser.fftSize / ctx.sampleRate / 2);
    }
    if (rms < threshold) floor = floor * 0.98 + rms * 0.02;
    prev = rms;
    raf = requestAnimationFrame(loop);
  };
  loop();
}

export function listen(fn) { listener = fn; }

export function stop() {
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  listener = null;
}
