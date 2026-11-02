/* Progress on this device only: no accounts, names or analytics. */

const KEY = 'musician-maker-stream-1';

const DEFAULTS = {
  xp: 0,
  bestCombo: 0,
  days: 0, // days played; never resets
  lastDay: '',
  mookie: false,
  input: 'tap', // or 'mic'
  frontier: 1, // newest unlocked step
  steps: {}, // n: { s strength 0-100, n graded, pb perform/build graded, fast right at 108+, mastered }
  pat: {}, // pattern id: strength
  feat: {}, // pattern feature: strength
  stickers: [],
  seen: {}, // step-mode: 1 once that kind of game has been played (its instruction stops saying NEW)
  test: false,
  tx: 'mix', // transitions between games: 'mix' or one transition's id (transitions lab)
};

export function load() {
  try {
    return { ...structuredClone(DEFAULTS), ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function save(st) {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* not kept */ }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* nothing kept */ }
  return structuredClone(DEFAULTS);
}
