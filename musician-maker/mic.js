/* Mic input: finds the start of each spoken or sung syllable, so "du du-de du du" said
   into the mic counts like taps. Audio is analysed live on the device and never kept.

   A syllable starts where the level jumps above the noise floor. Joined syllables
   ("du-de") don't fall back to silence between them, so after each start the detector
   re-arms once the level has dipped well below that syllable's peak (the "d"). */

let stream = null;
let analyser = null;
let ctx = null;
let raf = 0;
let listener = null;
let floor = 0.005; // running noise level
let level = 0; // last level, 0-1, for meters
let armed = true;
let peak = 0;
let last = -1;

export const on = () => !!stream;
export const getLevel = () => level;

export async function start(audioCtx) {
  if (stream) return;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no mic access here.');
  ctx = audioCtx;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
  });
  const src = ctx.createMediaStreamSource(stream);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  // Some browsers (Safari) only run nodes that lead to the speakers: a silent path does.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(analyser);
  analyser.connect(mute).connect(ctx.destination);
  const buf = new Float32Array(analyser.fftSize);
  const loop = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const now = ctx.currentTime;
    level = Math.min(1, rms * 8);
    const threshold = Math.max(floor * 3, 0.01);
    if (rms > threshold && armed && now - last > 0.1) {
      armed = false;
      peak = rms;
      last = now;
      // The level rises over one analysis window; date it to the window's middle.
      listener?.(now - analyser.fftSize / ctx.sampleRate / 2);
    } else if (!armed) {
      peak = Math.max(peak, rms);
      if (rms < peak * 0.45 || rms < threshold) armed = true;
    }
    if (rms < threshold) floor = floor * 0.97 + rms * 0.03;
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
  level = 0;
}
