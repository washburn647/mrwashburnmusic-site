/* Finds the parts of Kyle's slides that the planner depends on, and marks them.

   On a song slide (one with an x/y box), top left:
   - counter:  x/y, plays so far / Max for the year
   - timer:    <<0:00+>>, counts up while the slide shows
   - songIcon: the 1.00 inch square picture, the same rule the Apps Script
               planner uses (GEO.iconSizeOnSongSlide)
   - position: the figure in the ring: standing, sitting or lying down
   - minutes:  the number under the counter, how long the activity should take
   - returns:  the arrow beside it, whether the song comes back next week or later
   And on any slide:
   - spinner:  a shape linking to a name spinner that picks a student's turn

   An element the editor marked by hand (el.mark, a role or 'none') keeps that.
   Runs on import and again whenever a deck loads, so decks imported before
   a rule existed pick it up without importing again. */

const ICON_PX = 96;                        // 1.00 in on a 960 px wide, 10 in slide
const ICON_TOLERANCE = 2.7;                // 2 pt, as in the planner
const TIMER_TEXT = /^<*\s*\d{1,2}:\d\d\s*\+?\s*>*$/;
const COUNTER_TEXT = /^\s*x\s*\/\s*y\s*$/i;
const COUNTER_FILLED = /^\s*\d+\s*\/\s*\d+\s*$/;    // as a built class deck shows it, e.g. 4/4
const SPINNER_URL = /spinthewheel\.app|wheelofnames\.com|pickerwheel\.com|classtools\.net\/random-name/i;

// The three figures the decks use, by picture.
const FIGURES = {
  b59b26849b383f51f4ec9edd9cc954c4: 'stand',
  d4688d00438f035e954b74e90d511728: 'sit',
  b2acbb66e6fde6c9137257c04bd83700: 'lie'
};

export const ROLES = {
  songIcon: 'Song icon', counter: 'Counter (x/y)', timer: 'Timer', minutes: 'Minutes',
  position: 'Position', returns: 'Return arrow', spinner: 'Spinner'
};

export function textOf(el) {
  return el.text ? el.text.paras.map((p) => p.runs.map((r) => r.t || '').join('')).join('\n').trim() : '';
}

const topLeft = (el, x, y) => el.x < x && el.y < y;
const inside = (el, ring) => {
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  return cx > ring.x && cx < ring.x + ring.w && cy > ring.y && cy < ring.y + ring.h &&
    el.w <= ring.w && el.h <= ring.h;
};

export const GRADES = ['PK', 'K', '1'];

/** hint: normName(song) -> grades, from the year plan's Max columns (see plans.js). */
export function markDeck(deck, hint) {
  markSlides(deck);
  iconWidgets(deck);
  // A menu: a slide of song icons that each jump to their song.
  deck.slides.forEach((slide) => {
    const jumps = slide.els.filter((el) => el.link && el.link.slide != null &&
      deck.slides[el.link.slide] && deck.slides[el.link.slide].song);
    if (jumps.length >= 4) slide.menu = true; else delete slide.menu;
  });
  const plan = !deck.built && hint && hint.size ? hint : null;
  if (!deck.gradesSet) guessGrades(deck, plan);
  if (plan) planGradesOnly(deck, plan);
  return deck;
}

/* Think/speak and Street View used to sit on the slide as a wide box; now they are an
   icon like the spinner (el.icon). Old ones shrink once to the new size, keeping their
   middle; after that their size is whatever the editor gives them. */
const ICON_WIDGETS = { thinkspeak: 110, streetview: 110 };
export function iconWidgets(deck) {
  for (const slide of deck.slides) for (const el of slide.els) {
    const size = el.t === 'wg' && ICON_WIDGETS[el.kind];
    if (!size || el.icon) continue;
    el.x += (el.w - size) / 2;
    el.y += (el.h - size) / 2;
    el.w = el.h = size;
    el.icon = true;
  }
}

/* The decks run in sections: a big "PK" slide, then the songs that start in
   PK, then "K", then "1", then "EXTRA". Until grades are set by hand, a song
   is for the grade its section starts in and the grades after it, the way the
   old K menus open PK songs too. With a year plan, songs go by the plan
   instead (planGradesOnly). */
function guessGrades(deck, hint) {
  let section = null;
  for (const slide of deck.slides) {
    const t = (slide.title || '').trim().toUpperCase();
    if (!slide.song && !slide.menu && slide.els.length <= 3 && (GRADES.includes(t) || t === 'EXTRA')) {
      section = t === 'EXTRA' ? null : t;
      if (section) slide.grades = [section]; else delete slide.grades;
      continue;
    }
    if (slide.song && slide.song.kind === 'song' && section && !hint) slide.grades = GRADES.slice(GRADES.indexOf(section));
    else delete slide.grades;
  }
}

/* With a year plan, a song slide is for the grades its song has a Max in, and
   for none when the plan doesn't have it. The slides after a song's first that
   carry its icon go with it. Other slides keep the grades set by hand. */
function planGradesOnly(deck, hint) {
  let last = null;
  for (const slide of deck.slides) {
    if (!slide.song || slide.song.kind !== 'song') { last = null; continue; }
    const planned = planGrades(slide, hint) ||
      (last && slide.song.icon && last.song.icon === slide.song.icon ? last.grades : null);
    if (planned) slide.grades = [...planned]; else delete slide.grades;
    last = slide;
  }
}

function planGrades(slide, hint) {
  for (const el of slide.els) {
    if (!el.text) continue;
    for (const p of el.text.paras) {
      const g = hint.get(norm(p.runs.map((r) => r.t || '').join('')));
      const ours = g && g.filter((k) => GRADES.includes(k));
      if (ours && ours.length) return ours;
    }
  }
  return null;
}

// The same as normName in plans.js.
const norm = (s) => String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^a-z0-9']+/g, ' ').trim();

/** The part of a category deck a song belongs to: its usual songs, the Move Its
    (titled "Move It ..."), or the dances (a DANCE banner on the slide). */
export const SECTIONS = ['main', 'moveIt', 'dance'];
export function songSection(slide) {
  if (/^move\s*it\b/i.test((slide.title || (slide.song && slide.song.name) || '').trim())) return 'moveIt';
  if (slide.els.some((el) => /^dance!?$/i.test(textOf(el)))) return 'dance';
  return 'main';
}

/** True when a slide is for this grade or an earlier one: a grade's menu holds both. */
export function forGradeOrEarlier(slide, grade) {
  if (!grade) return true;
  if (!slide.grades || !slide.grades.length) return false;
  const at = GRADES.indexOf(grade);
  return slide.grades.some((g) => GRADES.indexOf(g) <= at);
}

/** True when a slide is tagged for this grade: what a category deck shows for one grade. */
export function taggedFor(slide, grade) {
  return !grade || (slide.grades || []).includes(grade);
}

/** True when a slide belongs in a grade's run of slides. Slides with no grade go everywhere. */
export function forGrade(slide, grade) {
  return !grade || !slide.grades || !slide.grades.length || slide.grades.includes(grade);
}

function markSlides(deck) {
  deck.slides.forEach((slide, i) => {
    const els = slide.els;
    for (const el of els) delete el.role;
    for (const el of els) {
      if (el.text) {
        const t = textOf(el);
        if (TIMER_TEXT.test(t)) el.role = 'timer';
        else if (COUNTER_TEXT.test(t) || (COUNTER_FILLED.test(t) && topLeft(el, 120, 80))) el.role = 'counter';
      }
      if (el.link && el.link.url && SPINNER_URL.test(el.link.url)) el.role = 'spinner';
    }
    const counter = els.some((el) => (el.mark || el.role) === 'counter');
    if (counter) {
      for (const el of els) {
        if (el.role) continue;
        if (el.t === 'pic' && Math.abs(el.w - ICON_PX) <= ICON_TOLERANCE && Math.abs(el.h - ICON_PX) <= ICON_TOLERANCE) {
          el.role = 'songIcon';
        } else if (el.t === 'sp' && /^\d{1,2}$/.test(textOf(el)) && topLeft(el, 200, 200) && el.w < 80 && el.h < 60) {
          el.role = 'minutes';
        } else if (el.t === 'sp' && /^(notchedRightArrow|rightArrow|quadArrow)$/.test(el.geom) && topLeft(el, 260, 200) && el.w < 80) {
          el.role = 'returns';
        }
      }
      const ring = els.find((el) => el.t === 'sp' && el.geom === 'ellipse' && !textOf(el) &&
        el.w > 50 && el.w < 75 && el.h > 45 && el.h < 65 && topLeft(el, 120, 160));
      // Some slides stack two figures in the ring; the top one is the one that shows.
      const figures = ring ? els.filter((el) => !el.role && el.t === 'pic' && inside(el, ring)) : [];
      if (figures.length) figures[figures.length - 1].role = 'position';
    }
    // Marks set by hand win over the rules above.
    for (const el of els) {
      if (el.mark === 'none') delete el.role;
      else if (el.mark) el.role = el.mark;
    }
    for (const el of els) if (el.role === 'timer') el.box = timerBox(el, els);

    delete slide.song;
    delete slide.spinner;
    if (!els.some((el) => el.role === 'counter')) {
      const spin = els.find((el) => el.role === 'spinner');
      if (spin) slide.spinner = spin.link && spin.link.url;
      return;
    }
    // Slide 2 of a category deck is the kids' choice (???) slide.
    const song = slide.song = { kind: i === 1 ? 'kidsChoice' : 'song', name: slide.title || '' };
    const icons = els.filter((el) => el.role === 'songIcon');
    if (icons.length === 1) song.icon = icons[0].media;
    const mins = els.find((el) => el.role === 'minutes');
    if (mins && /^\d+$/.test(textOf(mins))) song.minutes = Number(textOf(mins));
    const figure = els.find((el) => el.role === 'position');
    if (figure) song.position = FIGURES[figure.media] || 'other';
    const ret = els.find((el) => el.role === 'returns');
    if (ret) song.returns = ret.geom === 'quadArrow' ? 'later' : 'nextWeek';
    const spin = els.find((el) => el.role === 'spinner');
    if (spin && spin.link) song.spinner = spin.link.url;
  });
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
