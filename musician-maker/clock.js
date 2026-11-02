/* The beat clock. Everything in a run happens on a beat of one continuous clock, scheduled
   a little ahead on the audio clock so sound never waits for the page.
     clock.at(beat, (t) => …)   runs once, just before that beat, with its audio time
     clock.onBeat((i, t, spb) => …)  runs for every beat (the groove)
   Tempo changes only at a segment's first beat: setBpm(bpm, fromBeat). */

const AHEAD = 0.15; // seconds scheduled ahead
const TICK = 25; // ms between looks

export function makeClock(ctx) {
  let bpm = 92;
  let originTime = 0; // audio time of beat originIndex
  let originIndex = 0;
  let next = 0; // next beat index to schedule
  let timer = null;
  const jobs = new Map();
  const listeners = [];

  const spb = () => 60 / bpm;
  const timeOf = (i) => originTime + (i - originIndex) * spb();

  function tick() {
    while (timeOf(next) < ctx.currentTime + AHEAD) {
      const i = next;
      const t = timeOf(i);
      const due = jobs.get(i) || [];
      jobs.delete(i);
      // Jobs first: a segment that starts on this beat may set its tempo.
      due.forEach((fn) => fn(t));
      listeners.forEach((fn) => fn(i, t, spb()));
      next++;
    }
  }

  return {
    get bpm() { return bpm; },
    spb,
    timeOf,
    setBpm(value, fromBeat) {
      originTime = timeOf(fromBeat);
      originIndex = fromBeat;
      bpm = value;
    },
    at(i, fn) {
      if (!jobs.has(i)) jobs.set(i, []);
      jobs.get(i).push(fn);
    },
    onBeat(fn) { listeners.push(fn); },
    start(t, startBpm = bpm) {
      bpm = startBpm;
      originTime = t;
      originIndex = 0;
      next = 0;
      jobs.clear();
      clearInterval(timer);
      timer = setInterval(tick, TICK);
      tick();
    },
    stop() {
      clearInterval(timer);
      timer = null;
      jobs.clear();
    },
  };
}
