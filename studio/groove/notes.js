/* Groove Lab's note editing, apart from the page: a piano roll's rows, the key, moving, copying
   and pasting notes, step recording from a MIDI keyboard, and the mix of muted and soloed
   tracks. A note is { s, v } on a percussion row, { s, l, m, v } in a piano roll: its step, its
   length in steps, its MIDI pitch and its velocity. Tested in Node (tests/groove-lab.test.mjs). */

export const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/* A piano roll's rows, hi at the top to lo at the bottom: the instrument's samples with two
   notes to spare each way, and any note already outside that. Adding or moving a note never
   changes them, so the rows stay put under the pointer. */
export function rollRange(zones = [], notes = []) {
  let lo = Math.min(...zones.map((z) => z.midi)) - 2;
  let hi = Math.max(...zones.map((z) => z.midi)) + 2;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 34; hi = 86; }
  for (const n of notes) if (Number.isFinite(n.m)) { lo = Math.min(lo, n.m); hi = Math.max(hi, n.m); }
  return { lo: Math.max(0, lo), hi: Math.min(127, hi) };
}

/* Is pitch m in the major key whose do is pitch class key? */
export const inKey = (m, key) => MAJOR.includes((((m - key) % 12) + 12) % 12);

/* m, or the pitch in the key next to it, above (up) or below. In a major key every pitch
   outside it sits between two inside it. */
export const snapToKey = (m, key, up) => (inKey(m, key) ? m : up ? m + 1 : m - 1);

/* d steps along the scale from m. A pitch outside the key takes its first step to the
   nearest one inside, that way. */
export function scaleStep(m, key, d) {
  let out = m;
  for (let k = 0; k < Math.abs(d); k++) {
    do out += Math.sign(d); while (!inKey(out, key));
  }
  return out;
}

/* How many scale steps from pitch from reach pitch to (or just past it). */
export function scaleSteps(from, to, key) {
  let k = 0;
  let m = from;
  if (to > from) while (m < to) { m = scaleStep(m, key, 1); k++; }
  else while (m > to) { m = scaleStep(m, key, -1); k--; }
  return k;
}

/* What a note in a list of moving notes started as. lo and hi: its roll's rows. */
export const moving = (n, hit, lo = 0, hi = 127) => ({ n, hit, s: n.s, m: n.m, l: n.l || 1, lo, hi });

/* Moves notes together, from where they started (items, from moving()), by dc steps and dp
   pitch steps: half steps, scale steps of key (Key lock), or octaves. Every note stays inside
   the loop and its roll: when one can't go as far, none goes further than it can. Returns the
   move made. */
export function shiftNotes(items, { dc = 0, dp = 0, steps, key = null, octave = false }) {
  let least = -Infinity;
  let most = Infinity;
  for (const it of items) {
    least = Math.max(least, -it.s);
    most = Math.min(most, steps - it.s - (it.hit ? 1 : it.l));
  }
  dc = items.length ? Math.max(least, Math.min(most, dc)) : 0;
  const pitch = (it, d) => (octave ? it.m + 12 * d : key != null ? scaleStep(it.m, key, d) : it.m + d);
  const fits = (d) => items.every((it) => it.hit || (pitch(it, d) >= it.lo && pitch(it, d) <= it.hi));
  while (dp && !fits(dp)) dp -= Math.sign(dp);
  for (const it of items) {
    it.n.s = it.s + dc;
    if (!it.hit) it.n.m = pitch(it, dp);
  }
  return { dc, dp };
}

/* Could these notes all move dp pitch steps (as shiftNotes would) without leaving their rolls? */
export function canShift(items, dp, { key = null, octave = false } = {}) {
  if (!items.length) return false;
  return items.every((it) => {
    const m = octave ? it.m + 12 * dp : key != null ? scaleStep(it.m, key, dp) : it.m + dp;
    return it.hit || (m >= it.lo && m <= it.hi);
  });
}

const spot = (n) => `${n.s}:${n.m ?? ''}`;

/* After notes move or paste into a list: any other note in the list at the same step and
   pitch as one of them gives way, so nothing plays twice. */
export function dropCovered(notes, mine) {
  const at = new Set(notes.filter((n) => mine.has(n)).map(spot));
  for (let i = notes.length - 1; i >= 0; i--) if (!mine.has(notes[i]) && at.has(spot(notes[i]))) notes.splice(i, 1);
}

/* Copied notes as a block: entries [{ hit, inst, k, n }] (k: the track's place among the
   layer's tracks of its kind). The block runs from the start of its first note's beat to the
   end of its last note's beat, or over the bars picked (bounds). */
export function copyBlock(entries, per, bounds = null) {
  if (!entries.length) return null;
  const from = bounds ? bounds.from : Math.floor(Math.min(...entries.map((e) => e.n.s)) / per) * per;
  const to = bounds ? bounds.to : Math.ceil(Math.max(...entries.map((e) => e.n.s + (e.hit ? 1 : e.n.l || 1))) / per) * per;
  return { span: to - from, from, items: entries.map((e) => ({ hit: e.hit, inst: e.inst, k: e.k, n: { ...e.n, s: e.n.s - from } })) };
}

/* Puts a copied block into tracks at step at. Each note goes to the track it came from (the same
   instrument in the same place), else the same place among the tracks of its kind, else the
   first of its kind. Notes past the loop's end or outside a roll stay out, and lengths stop at
   the end. Returns the notes put in. kinds: { hit: [tracks], pitched: [tracks] };
   rangeOf(track) gives a roll's { lo, hi }. */
export function pasteBlock(clip, kinds, at, steps, rangeOf) {
  const put = new Set();
  const into = new Map();
  for (const it of clip.items) {
    const list = kinds[it.hit ? 'hit' : 'pitched'] || [];
    const tr = (list[it.k]?.inst === it.inst ? list[it.k] : null) || list.find((t) => t.inst === it.inst) || list[it.k] || list[0];
    if (!tr) continue;
    const s = at + it.n.s;
    if (s >= steps) continue;
    const n = { ...it.n, s };
    if (!it.hit) {
      const { lo, hi } = rangeOf(tr);
      if (n.m < lo || n.m > hi) continue;
      n.l = Math.max(1, Math.min(n.l || 1, steps - s));
    }
    tr.notes.push(n);
    put.add(n);
    into.set(tr, true);
  }
  for (const tr of into.keys()) {
    dropCovered(tr.notes, put);
    tr.notes.sort((a, b) => a.s - b.s || (a.m ?? 0) - (b.m ?? 0));
  }
  return put;
}

/* A version with only the tracks that should sound: not the muted ones, and only the soloed
   ones if any are. state(layer, take, i) says 'mute', 'solo' or nothing for track i of a take
   (-1 the main one, else the variation). The version itself when nothing is muted or soloed. */
export function mixVersion(g, state, layers) {
  const all = [];
  for (const l of layers) {
    (g.layers[l] || []).forEach((tr, i) => all.push(state(l, -1, i)));
    (g.variants?.[l] || []).forEach((v, k) => v.tracks.forEach((tr, i) => all.push(state(l, k, i))));
  }
  if (!all.some(Boolean)) return g;
  const solo = all.includes('solo');
  const keep = (l, take) => (tr, i) => (solo ? state(l, take, i) === 'solo' : state(l, take, i) !== 'mute');
  const out = { ...g, layers: {} };
  for (const l of layers) out.layers[l] = (g.layers[l] || []).filter(keep(l, -1));
  if (g.variants) {
    out.variants = {};
    for (const [l, vars] of Object.entries(g.variants)) out.variants[l] = vars.map((v, k) => ({ ...v, tracks: v.tracks.filter(keep(l, k)) }));
  }
  return out;
}

/* Step recording's chords: keys pressed within ms of the first make one chord. press() says
   'new' for the first chord, 'next' when a key comes later (the chord before ends: legato
   playing), 'join' for a key of the chord; release() is true once every key is up, which ends
   the chord. */
export function chords(ms = 120) {
  const down = new Set();
  let open = false;
  let first = 0;
  return {
    press(note, t) {
      down.add(note);
      if (open && t - first <= ms) return 'join';
      const was = open;
      open = true;
      first = t;
      return was ? 'next' : 'new';
    },
    release(note) {
      down.delete(note);
      if (open && !down.size) { open = false; return true; }
      return false;
    },
    reset() { down.clear(); open = false; },
  };
}
