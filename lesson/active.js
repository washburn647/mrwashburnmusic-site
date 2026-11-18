/* Practice time that counts only while someone is there: the clock runs without long gaps
   (a gap means the device slept or the page was in the background), and someone touched the
   page in the last few minutes. tick() says false once nobody has, so the caller can stop. */
export const IDLE_MS = 5 * 60 * 1000;
export const GAP_MS = 5000;

export function activeClock({ now = () => Date.now(), idle = IDLE_MS, gap = GAP_MS } = {}) {
  let total = 0;
  let last = null;
  let seen = now();
  const tick = () => {
    if (last == null) return true;
    const t = now();
    const upTo = Math.min(t, seen + idle);
    if (t - last <= gap && upTo > last) total += upTo - last;
    last = t;
    return t - seen < idle;
  };
  return {
    touch() { seen = now(); },
    start() { last = seen = now(); },
    tick,
    /* Seconds counted since start(). */
    stop() {
      tick();
      last = null;
      const secs = total / 1000;
      total = 0;
      return secs;
    },
  };
}
