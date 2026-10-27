/* Finds the parts of Kyle's slides that the planner depends on, and marks them.

   - The x/y box is a song slide's counter (plays so far / Max for the year).
   - The <<0:00+>> box beside it is a count-up timer for the song.
   - The 1.00 inch square picture on a song slide is the song's icon, the
     same rule the Apps Script planner uses (GEO.iconSizeOnSongSlide).

   Runs on import and again whenever a deck loads, so decks imported before
   a rule existed pick it up without importing again. */

const ICON_PX = 96;                        // 1.00 in on a 960 px wide, 10 in slide
const ICON_TOLERANCE = 2.7;                // 2 pt, as in the planner
const TIMER_TEXT = /^<*\s*\d{1,2}:\d\d\s*\+?\s*>*$/;
const COUNTER_TEXT = /^\s*x\s*\/\s*y\s*$/i;

export function textOf(el) {
  return el.text ? el.text.paras.map((p) => p.runs.map((r) => r.t || '').join('')).join('\n').trim() : '';
}

export function markDeck(deck) {
  deck.slides.forEach((slide, i) => {
    let counter = false;
    for (const el of slide.els) {
      delete el.role;
      if (el.text) {
        const t = textOf(el);
        if (TIMER_TEXT.test(t)) el.role = 'timer';
        else if (COUNTER_TEXT.test(t)) { el.role = 'counter'; counter = true; }
      }
    }
    for (const el of slide.els) if (el.role === 'timer') el.box = timerBox(el, slide.els);
    const icons = counter ? slide.els.filter((el) => el.t === 'pic' &&
      Math.abs(el.w - ICON_PX) <= ICON_TOLERANCE && Math.abs(el.h - ICON_PX) <= ICON_TOLERANCE) : [];
    icons.forEach((el) => { el.role = 'songIcon'; });
    delete slide.song;
    if (counter) {
      // Slide 2 of a category deck is the kids' choice (???) slide.
      slide.song = { kind: i === 1 ? 'kidsChoice' : 'song', name: slide.title || '' };
      if (icons.length === 1) slide.song.icon = icons[0].media;
    }
  });
  return deck;
}

/* The timer's words sit on a wider text frame ("<<0:00+>>") laid over a
   small empty box. The time belongs in that box. */
function timerBox(timer, els) {
  let best = null, bestArea = 0;
  for (const el of els) {
    if (el === timer || el.t !== 'sp' || el.text || !el.fill) continue;
    if (!['rect', 'roundRect'].includes(el.geom)) continue;
    const ox = Math.min(el.x + el.w, timer.x + timer.w) - Math.max(el.x, timer.x);
    const oy = Math.min(el.y + el.h, timer.y + timer.h) - Math.max(el.y, timer.y);
    if (ox <= 0 || oy <= 0 || el.w > timer.w) continue;
    if (ox * oy > bestArea) { best = el; bestArea = ox * oy; }
  }
  return best ? { x: best.x, y: best.y, w: best.w, h: best.h } : null;
}

/** Song slides that have no 1-inch icon, for the deck page to point out. */
export function missingIcons(deck) {
  return deck.slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.song && s.song.kind === 'song' && !s.song.icon);
}
