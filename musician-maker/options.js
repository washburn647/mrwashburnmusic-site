/* Game options, set in the studio's Musician Maker game workshop (/studio/games/).
   Per game: whether it comes up in the stream, whether it can host the boss, which win and
   fail gags can come up, its tap sound (Tap It's object) and its instrument's sound (Play It).
   - games.json: the options learners get. The workshop's "Save for site" downloads it and
     tools/add_games.py puts it here.
   - The workshop's own copy (localStorage on Kyle's device): drafts. Only a workshop test
     run (?test=<game id>) plays with them.
   A game missing from either gets its defaults: everything on, its own tap sound. */

import { GAMES } from './games.js';

const KEY = 'musician-maker-workshop-1';
for (const g of GAMES) {
  g.baseTap ??= g.tap;
  g.basePlay ??= g.kit.instrument.sound;
  g.baseTune ??= g.kit.tune?.sound || null;
}

export function defaults(g) {
  return {
    stream: true,
    boss: !!g.bossName,
    win: Object.keys(g.gags?.win || {}),
    fail: Object.keys(g.gags?.fail || {}),
    tap: g.baseTap,
    play: g.basePlay,
    tune: g.baseTune,
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
      play: typeof o.play === 'string' && o.play ? o.play : d.play,
      tune: d.tune && typeof o.tune === 'string' && o.tune ? o.tune : d.tune,
    };
  }
  return out;
}

let rawLoading = null;
function siteRaw() {
  // What the workshop last published (worker/index.js), otherwise the repo's copy.
  const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  rawLoading ||= get('/api/live/games.json')
    .then(async (live) => (live?.games ? live : (await get(new URL('games.json', import.meta.url))) || {}))
    .catch(() => ({}));
  return rawLoading;
}
export const siteOptions = () => siteRaw().then((data) => complete(data?.games)).catch(() => complete());

/* The path's settings (path.js): when each unit opens, as { opensAt: { unitId: step } }. */
export function completePath(raw = {}) {
  const opensAt = {};
  for (const [id, n] of Object.entries(raw?.opensAt || {})) {
    const k = Math.round(Number(n));
    if (/^unit-\d+$/.test(id) && k >= 1 && k <= 13) opensAt[id] = k;
  }
  return { opensAt };
}
export const sitePath = () => siteRaw().then((data) => completePath(data?.path)).catch(() => completePath());

/* The workshop's copy: { games, path, test } (test: the last test-run settings). */
export function loadDraft() {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY)) || {};
    return { games: kept.games ? complete(kept.games) : null, path: kept.path ? completePath(kept.path) : null, test: kept.test || {} };
  } catch {
    return { games: null, path: null, test: {} };
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
    g.play = o.play;
    g.tune = o.tune;
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
