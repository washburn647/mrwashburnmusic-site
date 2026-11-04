/* The director picks every next game: which step, which task, which stimulus, which pattern.
   New steps arrive in curriculum order; weak spots come more often; mastered steps spiral
   back in. At a step it rolls one of the tasks that step uses (tasks.js), weaker ones more
   often and Speak/Sing It most, then one of that task's stimuli for the step. It also keeps
   the learner near 80% success (flow). */

import { STEPS, patternsFor, byId } from './steps.js';
import { tasksAt, cellOf, stepsOf, taskKey } from './tasks.js';

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
  const retries = []; // { step, task, id, due }
  let played = 0;

  const step = (n) => (st.steps[n] ||= { s: 0, n: 0, fast: 0, mastered: false });
  const task = (id, n) => ((st.tasks ||= {})[taskKey(id, n)] ||= { s: 0, n: 0 });
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

  /* A task the step uses: Speak/Sing It twice as often (it's the fundamental one), and any
     task that's weak at this step more often. */
  function chooseTask(stepN, noSay) {
    const all = tasksAt(stepN);
    const list = noSay && all.length > 1 ? all.filter((t) => t.id !== 'say') : all;
    const ws = list.map((t) => (t.id === 'say' ? 2 : 1) * (1.25 - task(t.id, stepN).s / 100));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) if ((r -= ws[i]) <= 0) return list[i].id;
    return list[list.length - 1].id;
  }

  const chooseStim = (taskId, stepN) => pick(cellOf(taskId, stepN));

  /* A step for a task picked in a test: the frontier if the task works there, else the
     nearest open step that has it, else its first step. */
  function stepFor(taskId) {
    const ns = stepsOf(taskId);
    if (ns.includes(st.frontier)) return st.frontier;
    const open = ns.filter((n) => n <= st.frontier);
    return open.length ? open[open.length - 1] : ns[0];
  }

  return {
    flow,
    mastered,
    step,
    /* The next item: { step, task, stim, pattern }. warm: mastered material only. force: drill
       one step. forceTask: only this task (a workshop test); with force too, when it fits.
       noSay: no Speak/Sing It (the mic is off). */
    next({ warm = false, force = null, forceTask = null, noSay = false } = {}) {
      if (noSay && forceTask === 'say') forceTask = null;
      played++;
      if (forceTask && !(force && cellOf(forceTask, force))) force = stepFor(forceTask);
      const due = !force && retries.findIndex((r) => r.due <= played);
      if (due !== false && due >= 0) {
        const r = retries.splice(due, 1)[0];
        return { step: r.step, task: r.task, stim: chooseStim(r.task, r.step), pattern: byId(r.id), retry: true };
      }
      const frontier = force || st.frontier;
      const done = mastered().filter((n) => n !== frontier);
      const weak = STEPS.slice(1, frontier).filter((s) => !step(s.n).mastered && step(s.n).n > 0).map((s) => s.n);
      let n;
      const r = Math.random();
      if (force) n = force;
      else if (warm && done.length) n = pick(done);
      else if (r < 0.6) n = frontier;
      else if (r < 0.85 && weak.length) n = weak.sort((a, b) => step(a).s - step(b).s)[0];
      else if (done.length) {
        // Spiral review: least recently played first, roughly.
        n = done.sort((a, b) => (step(a).seen || 0) - (step(b).seen || 0))[Math.floor(Math.random() * Math.min(2, done.length))];
      } else n = frontier;
      const id = choosePattern(n);
      lastPatterns.push(id);
      if (lastPatterns.length > 4) lastPatterns.shift();
      const t = forceTask && cellOf(forceTask, n) ? forceTask : chooseTask(n, noSay);
      return { step: n, task: t, stim: chooseStim(t, n), pattern: byId(id) };
    },
    task,
    record({ item, right, bpm }) {
      recent.push(right);
      const st8 = step(item.step);
      st8.s = ease(st8.s, right ? 100 : 0, right ? 0.2 : 0.3);
      st8.n++;
      st8.seen = Date.now();
      if (right && bpm >= 108) st8.fast++;
      const tk = task(item.task, item.step);
      tk.s = ease(tk.s, right ? 100 : 0, right ? 0.2 : 0.3);
      tk.n++;
      const id = item.pattern.id;
      st.pat[id] = ease(st.pat[id] ?? 30, right ? 100 : 0, right ? 0.25 : 0.35);
      for (const f of features(item.pattern)) st.feat[f] = ease(st.feat[f] ?? 30, right ? 100 : 0, right ? 0.15 : 0.25);
      // A miss comes back a few games later: the same pattern and task, a fresh stimulus.
      if (!right && !item.retry) retries.push({ step: item.step, task: item.task, id, due: played + 3 + Math.floor(Math.random() * 3) });
      // A step is mastered at strength 80+, 10+ graded items, and 3 right at 108 or faster.
      const fastNeed = st.mookie ? 0 : 3;
      if (!st8.mastered && st8.s >= 80 && st8.n >= 10 && st8.fast >= fastNeed) {
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
