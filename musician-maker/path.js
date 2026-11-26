/* The path: every unit the game plays, in curriculum order, as one stream. There's no
   separate melodic mode: a learner starts on Unit 1 (rhythm: du, du-de) and, once its ear
   steps are mastered, do re mi (Unit 4, tonal) opens and joins the same runs. From then on a
   run moves between rhythm and melody game by game, on the same groove, and keeps cycling
   back through what's been learned.

   Each unit keeps its own progress (director.js: Unit 1 in the save's top level, do re mi in
   st.mel, as before), so nothing a learner has done is lost. The path picks which unit each
   game comes from:
   - Each set of a lap has a focus unit, in turn (set 1 the first open unit, set 2 the next,
     and so on, shifting by one each lap), and most of its games (70%) come from it: new
     steps, weak spots and review, as the director picks them.
   - The rest come from the other open units, mostly mastered material (review), so every
     concept keeps coming back.
   A unit opens when the unit before it reaches the step in `opensAt` (6: its ear steps,
   1 to 5, mastered; past its last step: all of it mastered), or as soon as it has any
   progress of its own. The game workshop can change `opensAt` (games.json "path"). */

import { STEPS, MAX_TONAL_STEP } from './steps.js';
import { makeDirector } from './director.js';
import { taskById } from './tasks.js';

export const UNITS = [
  { id: 'unit-1', kind: 'rhythm', name: 'Unit 1', label: 'du · du-de', icon: '♫', top: 12 },
  { id: 'unit-4', kind: 'tonal', name: 'Unit 4', label: 'do · re · mi', icon: '🎵', top: MAX_TONAL_STEP, opensAt: 6 },
];
export const unitById = (id) => UNITS.find((u) => u.id === id) || null;
export const unitOfKind = (kind) => UNITS.find((u) => u.kind === kind) || UNITS[0];
/* A step's key across units ('unit-4:3'), for strengths and what a set played. */
export const stepKey = (unit, n) => `${unit}:${n}`;
export const parseStepKey = (key) => {
  const [unit, n] = String(key).split(':');
  return { unit: unitById(unit), n: Number(n) };
};

const FOCUS = 0.7; // share of a set's games from its focus unit

/* only: one kind of unit ('rhythm' or 'tonal'), for a workshop test of one game.
   opensAt: { unitId: step } from the workshop, over each unit's own. */
export function makePath(st, { only = null, opensAt = {} } = {}) {
  const dirs = { rhythm: makeDirector(st), tonal: makeDirector(st, 'tonal') };
  const units = UNITS.filter((u) => !only || u.kind === only).map((u) => ({ ...u, dir: dirs[u.kind] }));
  const recent = [];

  const started = (u) => u.dir.frontier() > 1 || Object.values((u.kind === 'tonal' ? st.mel?.steps : st.steps) || {}).some((s) => s.n > 0);
  const opensAtOf = (u) => opensAt[u.id] ?? u.opensAt ?? 1;
  // Past the unit's last step: once that step is mastered.
  const reached = (u, at) => (at > u.top ? u.dir.step(u.top).mastered : u.dir.frontier() >= at);
  function isOpen(u) {
    const i = units.indexOf(u);
    if (i <= 0 || only) return true;
    if (started(u)) return true;
    const before = units[i - 1];
    return isOpen(before) && reached(before, opensAtOf(u));
  }
  const open = () => units.filter(isOpen);
  const of = (x) => units.find((u) => u.id === (x?.unit || x)) || units.find((u) => u.kind === x?.kind) || units[0];

  /* The unit a set focuses on: the open units in turn, a different one first each lap. */
  function focusOf(set = 0, lap = 0, list = open()) {
    return list[(set + lap) % list.length];
  }

  return {
    units,
    open,
    isOpen,
    unit: (id) => units.find((u) => u.id === id) || null,
    dirOf: (kind) => dirs[kind],
    focusOf,
    /* The next game's item, with the unit it's from (item.unit, item.kind).
       set, lap: where in the run (for the focus). kinds: the kinds the game can play (a boss).
       force/forceUnit: drill a step (Test mode). forceTask: only this task (workshop test).
       warm, noSay: as director.next. */
    next({ set = 0, lap = 0, kinds = null, force = null, forceUnit = null, forceTask = null, warm = false, noSay = false } = {}) {
      let list = open();
      if (kinds) list = list.filter((u) => kinds.includes(u.kind));
      if (!list.length) list = units.filter((u) => !kinds || kinds.includes(u.kind)).slice(0, 1);
      if (!list.length) list = [units[0]];
      let u;
      let review = false;
      if (force && forceUnit) u = list.find((x) => x.id === forceUnit) || of(forceUnit);
      else if (force) u = list[0];
      else if (forceTask) u = list.find((x) => x.kind === (taskById(forceTask)?.kind || 'rhythm')) || list[0];
      else if (list.length === 1) u = list[0];
      else {
        const focus = focusOf(set, lap, list);
        if (Math.random() < FOCUS) u = focus;
        else {
          const others = list.filter((x) => x !== focus);
          u = others[Math.floor(Math.random() * others.length)];
          review = true;
        }
      }
      const item = u.dir.next({ warm: warm || review, force: u.id === forceUnit || (force && !forceUnit) ? force : null, forceTask: forceTask && taskById(forceTask)?.kind === u.kind ? forceTask : null, noSay });
      return { ...item, unit: u.id, kind: u.kind };
    },
    record({ item, right, bpm }) {
      recent.push(right);
      return of(item).dir.record({ item, right, bpm });
    },
    flow() {
      const last = recent.slice(-8);
      return last.length < 4 ? 0.8 : last.filter(Boolean).length / last.length;
    },
    /* At a break: each open unit's frontier moves on when its step is mastered, and a unit
       may open. Returns { steps: [{ unit, n }], units: [unit] } of what's new. */
    advance() {
      const was = new Set(open().map((u) => u.id));
      const steps = [];
      for (const u of open()) {
        const n = u.dir.advance();
        if (n) steps.push({ unit: u, n });
      }
      const opened = open().filter((u) => !was.has(u.id));
      return { steps, units: opened };
    },
    /* Every open unit's step strengths, keyed by stepKey. */
    strengths() {
      const out = {};
      for (const u of open()) for (let n = 1; n <= u.top; n++) out[stepKey(u.id, n)] = u.dir.step(n).s;
      return out;
    },
    step: (key) => {
      const { unit, n } = parseStepKey(key);
      const u = units.find((x) => x.id === unit?.id);
      return u ? u.dir.step(n) : null;
    },
    /* What's next to learn: each open unit's frontier step, newest unit first. */
    frontiers() {
      return open().reverse().map((u) => ({ unit: u, n: Math.min(u.dir.frontier(), u.top), step: STEPS[Math.min(u.dir.frontier(), u.top)] }));
    },
  };
}
