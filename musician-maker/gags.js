/* Win and fail gags. Each game lists its gags with a name for the studio's game workshop
   (game.gags), and the workshop's options choose which ones can come up (game.gagsOn, set by
   options.js). A deck picks from the ones that are on, never the same one twice running
   unless it's the only one. A name repeated in the list comes up more often. */

export function gagDeck(list, allowed) {
  let last = null;
  return (force) => {
    if (force) return (last = force);
    const on = allowed();
    let pool = on ? list.filter((x) => on.includes(x)) : list;
    if (!pool.length) pool = list;
    const fresh = pool.filter((x) => x !== last);
    if (fresh.length) pool = fresh;
    last = pool[Math.floor(Math.random() * pool.length)];
    return last;
  };
}
