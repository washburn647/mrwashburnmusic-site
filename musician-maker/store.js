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
  steps: {}, // n: { s strength 0-100, n graded, fast right at 108+, mastered }
  tasks: {}, // task-step (tasks.js taskKey): { s strength 0-100, n graded }
  pat: {}, // pattern id: strength
  feat: {}, // pattern feature: strength
  stickers: [],
  seen: {}, // task-step: 1 once it has been played (its instruction stops saying NEW)
  intro: {}, // task-step: 1 once its task intro has been shown (intro.js)
  made: [], // the learner's last 12 create answers (pattern ids): repeats earn less
  test: false,
  recMic: false, // Test mode: record the mic in runs, saved as a file for Claude
  echo: true, // the mic's echo cancelling (Test mode can turn it off)
  groove: 'mix', // 'mix' (a different groove each lap) or a groove's id (grooves.json)
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
