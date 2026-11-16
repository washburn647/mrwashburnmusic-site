/* Slide audio (tracks.js): hands the microphone's samples to the page in blocks, each with
   the frame it starts on, so the page knows exactly when every sample was heard. */

const BLOCK = 8192;

class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(BLOCK);
    this.n = 0;
    this.start = 0;
    this.on = true;
    this.port.onmessage = (e) => {
      if (e.data !== 'stop') return;
      this.flush();
      this.on = false;
      this.port.postMessage('done');
    };
  }

  flush() {
    if (!this.n) return;
    this.port.postMessage({ frame: this.start, data: this.buf.slice(0, this.n) });
    this.n = 0;
  }

  process(inputs) {
    if (!this.on) return false;
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    if (!this.n) this.start = currentFrame;
    this.buf.set(ch, this.n);
    this.n += ch.length;
    if (this.n + 128 > BLOCK) this.flush();
    return true;
  }
}

registerProcessor('capture', Capture);
