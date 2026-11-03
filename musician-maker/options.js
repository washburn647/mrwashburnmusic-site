/* Game options, set in the studio's Musician Maker game workshop (/studio/games/).
   Per game: whether it comes up in the stream, whether it can host the boss, which win and
   fail gags can come up, and its tap sound.
   - games.json: the options learners get. The workshop's "Save for site" downloads it and
     tools/add_games.py puts it here.
   - The workshop's own copy (localStorage on Kyle's device): drafts. Only a workshop test
     run (?test=<game id>) plays with them.
   A game missing from either gets its defaults: everything on, its own tap sound. */

import { GAMES } from './games.js';

const KEY = 'musician-maker-workshop-1';
for (const g of GAMES) g.baseTap ??= g.tap;

export function defaults(g) {
  return {
    stream: true,
    boss: !!g.bossName,
    win: Object.keys(g.gags?.win || {}),
    fail: Object.keys(g.gags?.fail || {}),
    tap: g.baseTap,
  };
}

/* Full options for every game, from a partial set (unknown games and gags dropped). */
export function complete(raw = {}) {
  const out = {};
  for (const g of GAMES) {
    const d = defaults(g);
    const o = raw[g.id] || {};
    const pick = (kind) => (Array.isArray(o[kind]) ? o[kind].filter((x) => d[kind].includes(x)) : d[kind]);
    out[g.id] = {
      stream: typeof o.stream === 'boolean' ? o.stream : d.stream,
      boss: !!g.bossName && (typeof o.boss === 'boolean' ? o.boss : d.boss),
      win: pick('win'),
      fail: pick('fail'),
      tap: typeof o.tap === 'string' && o.tap ? o.tap : d.tap,
    };
  }
  return out;
}

let siteLoading = null;
export function siteOptions() {
  siteLoading ||= fetch(new URL('games.json', import.meta.url))
    .then((r) => (r.ok ? r.json() : {}))
    .then((data) => complete(data.games))
    .catch(() => complete());
  return siteLoading;
}

/* The workshop's copy: { games, test } (test: the last test-run settings). */
export function loadDraft() {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY)) || {};
    return { games: kept.games ? complete(kept.games) : null, test: kept.test || {} };
  } catch {
    return { games: null, test: {} };
  }
}

export function saveDraft(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* not kept */ }
}

/* Put options on the games. Returns the lineup: the games for the stream and for the boss.
   With `only`, just that game plays (a workshop test run), whatever its stream option says. */
export function apply(opts, only = null) {
  for (const g of GAMES) {
    const o = opts[g.id];
    g.tap = o.tap;
    g.gagsOn = { win: o.win, fail: o.fail };
  }
  if (only) {
    const g = GAMES.find((x) => x.id === only);
    if (g) return { stream: [g], bosses: g.bossName ? [g] : [] };
  }
  let stream = GAMES.filter((g) => opts[g.id].stream);
  if (!stream.length) stream = GAMES.slice();
  return { stream, bosses: GAMES.filter((g) => g.bossName && opts[g.id].boss) };
}
