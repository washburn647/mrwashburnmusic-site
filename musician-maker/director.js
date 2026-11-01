/* The director picks every next game: which step, which pattern, which answer mode.
   New steps arrive in curriculum order; weak spots come more often; mastered steps
   spiral back in. It also keeps the learner near 80% success (flow). */

import { STEPS, patternsFor, byId } from './steps.js';

export const TIERS = [0, 3, 6, 10, 15]; // combo needed for each groove layer
export const TIER_NAMES = ['', 'Groovy', 'Hot', 'On fire', 'Legendary'];
export const tierOf = (combo) => TIERS.filter((n) => combo >= n).length - 1;

const TITLES = ['Listener', 'Hummer', 'Tapper', 'Clapper', 'Drummer', 'Busker', 'Bandmate', 'Soloist',
  'Bandleader', 'Maestro', 'Virtuoso', 'Legend'];
export function levelOf(xp) {
  let n = 0;
  while (xp >= 150 * (n + 1) * (n + 2) / 2) n++;
  const lo = 150 * n * (n + 1) / 2;
  const hi = 150 * (n + 1) * (n + 2) / 2;
  return { n: n + 1, title: TITLES[Math.min(n, TITLES.length - 1)], frac: (xp - lo) / (hi - lo) };
}

const ease = (s, target, rate) => s + (target - s) * rate;
const features = (p) => [...p.cells.flatMap((c, i) => (c === 'ee' ? [`ee${i}`] : [])), `n${p.cells.filter((c) => c === 'ee').length}`];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function makeDirector(st) {
  const recent = []; // last results, true/false
  const lastPatterns = [];
  const retries = []; // { step, id, due, mode }
  let played = 0;

  const step = (n) => (st.steps[n] ||= { s: 0, n: 0, pb: 0, fast: 0, mastered: false });
  const mastered = () => STEPS.slice(1).filter((s) => step(s.n).mastered).map((s) => s.n);

  function flow() {
    const last = recent.slice(-8);
    return last.length < 4 ? 0.8 : last.filter(Boolean).length / last.length;
  }

  function choosePattern(stepN) {
    const ids = patternsFor(STEPS[stepN].set);
    const fresh = ids.filter((id) => !lastPatterns.includes(id));
    const list = fresh.length ? fresh : ids;
    // Weaker patterns and features come up more.
    const weight = (id) => {
      const p = byId(id);
      const fs = features(p).map((f) => st.feat[f] ?? 30);
      const featWeak = 1 - fs.reduce((a, b) => a + b, 0) / fs.length / 120;
      return (1.2 - (st.pat[id] ?? 30) / 100) * featWeak + 0.05;
    };
    const ws = list.map(weight);
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) if ((r -= ws[i]) <= 0) return list[i];
    return list[list.length - 1];
  }

  function chooseMode(stepN) {
    const modes = STEPS[stepN].modes;
    if (modes.length === 1) return modes[0];
    const s = step(stepN).s;
    const others = modes.filter((m) => m !== 'pick');
    // Pick is the warm-up form of a step: often while it's new, rarely once it's strong.
    const pickChance = s < 40 ? 0.65 : flow() < 0.65 ? 0.5 : 0.3;
    return Math.random() < pickChance ? 'pick' : pick(others);
  }

  return {
    flow,
    mastered,
    step,
    /* The next item. warm: mastered material only. force: drill one step. */
    next({ warm = false, force = null, boss = false } = {}) {
      played++;
      const due = !force && retries.findIndex((r) => r.due <= played);
      if (due !== false && due >= 0) {
        const r = retries.splice(due, 1)[0];
        return { step: r.step, pattern: byId(r.id), mode: boss ? 'perform' : r.mode, retry: true };
      }
      const frontier = force || st.frontier;
      const done = mastered().filter((n) => n !== frontier);
      const weak = STEPS.slice(1, frontier).filter((s) => !step(s.n).mastered && step(s.n).n > 0).map((s) => s.n);
      let n;
      const r = Math.random();
      if (force) n = force;
      else if (warm && done.length) n = pick(done);
      else if (r < 0.6 || boss) n = frontier;
      else if (r < 0.85 && weak.length) n = weak.sort((a, b) => step(a).s - step(b).s)[0];
      else if (done.length) {
        // Spiral review: least recently played first, roughly.
        n = done.sort((a, b) => (step(a).seen || 0) - (step(b).seen || 0))[Math.floor(Math.random() * Math.min(2, done.length))];
      } else n = frontier;
      const id = choosePattern(n);
      lastPatterns.push(id);
      if (lastPatterns.length > 4) lastPatterns.shift();
      let mode = chooseMode(n);
      if (boss) mode = STEPS[n].modes.includes('perform') ? 'perform' : STEPS[n].modes.includes('create') ? 'create' : 'perform';
      return { step: n, pattern: byId(id), mode };
    },
    /* How many Pick options and how close they are, from flow and strength. */
    pickSpec(stepN) {
      const f = flow();
      const s = step(stepN).s;
      const count = st.mookie ? (f > 0.9 ? 3 : 2) : f > 0.9 ? 4 : f < 0.65 ? 2 : 3;
      return { count, close: f > 0.9 || s > 60 };
    },
    record({ item, right, bpm }) {
      recent.push(right);
      const st8 = step(item.step);
      st8.s = ease(st8.s, right ? 100 : 0, right ? 0.2 : 0.3);
      st8.n++;
      st8.seen = Date.now();
      if (item.mode !== 'pick') st8.pb++;
      if (right && bpm >= 108) st8.fast++;
      const id = item.pattern.id;
      st.pat[id] = ease(st.pat[id] ?? 30, right ? 100 : 0, right ? 0.25 : 0.35);
      for (const f of features(item.pattern)) st.feat[f] = ease(st.feat[f] ?? 30, right ? 100 : 0, right ? 0.15 : 0.25);
      if (!right && !item.retry) {
        retries.push({ step: item.step, id, due: played + 3 + Math.floor(Math.random() * 3), mode: 'pick' });
        if (item.mode !== 'pick' && STEPS[item.step].modes.includes(item.mode)) {
          retries.push({ step: item.step, id, due: played + 7 + Math.floor(Math.random() * 3), mode: item.mode });
        }
      }
      // A step is mastered at strength 80+, 10+ graded items, half of them Perform or Build,
      // and 3 right at Medium or faster. Pick-only steps (6) need no Perform/Build.
      const pickOnly = STEPS[item.step].modes.every((m) => m === 'pick');
      const fastNeed = st.mookie ? 0 : 3;
      if (!st8.mastered && st8.s >= 80 && st8.n >= 10 && (pickOnly || st8.pb >= st8.n / 2) && st8.fast >= fastNeed) {
        st8.mastered = true;
        return { mastered: item.step };
      }
      return {};
    },
    /* At a break: the frontier moves on when its step is mastered. */
    advance() {
      if (st.frontier < 12 && step(st.frontier).mastered) {
        st.frontier++;
        return st.frontier;
      }
      return null;
    },
  };
}
