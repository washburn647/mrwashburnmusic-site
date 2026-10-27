# Class on mrwashburnmusic.com

Served at `/class/`. Kyle's classroom slides app: bring in Google Slides decks
(downloaded as PowerPoint) and present them full screen on the classroom TV.
Installable from Chrome on a Chromebook, and works offline once a deck is in.

The plan for the whole app (planner, editor, widgets, substitute access,
copyright rules) is in the project's "Classroom slides app plan" doc.

## Files

- `index.html`, `app.js`: the library (`#/`) and one deck's slides (`#/deck/<id>`), plus importing.
- `editor.js`: the slide editor (`#/deck/<id>/edit/<n>`). Select, move (with snapping; Alt turns
  it off), resize, type in boxes, add text, shapes and pictures, links, marks, layer order,
  slide strip with drag to reorder. Undo keeps earlier lists of slides: each change copies only
  the slides it touches. Slide links follow their slide when slides move. Saves as it goes.
- `ui.js`: helpers the pages share (thumbnails, picture URLs).
- `menus.js`: builds a grade's menu on demand: the icon of every song for that grade, each one
  jumping to its song, in the look of the deck's own menu slides. The deck page's grade chips
  (All, PK, K, 1) filter the slides, Present skips other grades, and Menu opens the built menu.
- Pictures from the web: the editor's search button opens Google Images (SafeSearch on) in its
  own tab; a copied picture pastes in with Ctrl+V, and "Use as background" turns a picture into
  the slide background. In-app search would need an API key on a server, which this site
  doesn't have yet.
- `planner.js`, `plans.js`, `xlsx.js`: the planner (`#/plan`), ported from the Apps Script
  planner. Import DATABASE.xlsx once per year (read in the browser, kept in IndexedDB `plans`).
  Grade tabs, years ("New year" keeps the catalog, empties plans, zeroes Max), catalog with Max,
  drag to place or swap, Shift-click to hold a song another class, Max raised when a song is
  placed past it, undo (Ctrl+Z), class totals. A song's Max per grade also sets which grades
  its slides are for, until grades are set by hand in the editor. Timed minutes from Present
  show on the catalog chips' tooltips.
- `builder.js`: Build on a planner row makes that class's deck in the library, as the Apps
  Script builder did: title and exit slides from a class deck in the library (named like
  "1 29"), song slides copied from the category decks (matched by a line of text equal to the
  catalog name) with x/y stamped, the icon rail with checks, the song list, next class's icons.
  Links on a copied slide into its category deck open that deck; a link to a menu opens the
  grade's built menu with songs the plan hasn't reached yet locked.
- `pptx.js` (with `zip.js`): converts a .pptx into the deck format below, right in the browser.
  Nothing is uploaded anywhere.
- `render.js`: draws one slide on a 960 x 540 stage. Present mode, thumbnails and
  (later) the editor all use it.
- `present.js`: full-screen Present mode. Clicker, arrow keys and swipes (a plain tap
  does not advance: slides have things to play with), live song timers, links between slides
  (Google decks link to their own slides with web addresses; the converter turns
  those into slide jumps), and links into another imported deck.
- `marks.js`: finds what the planner relies on. On song slides (the ones with an
  `x/y` box, or a filled-in one like `4/4` top left): the `x/y` counter (plays so far / Max for
  the year), the `<<0:00+>>` timer, the song's icon (the 1.00 inch square picture, the Apps
  Script planner's own rule), the position figure in the ring (stand, sit or lie, by picture),
  the minutes number under the counter, and the return arrow (notched arrow: next week; four-way
  arrow: later). On any slide, a shape linking to a name spinner. A mark set in the editor
  (`el.mark`) wins over the rules. Also marks menu slides (`slide.menu`), and until grades are
  set by hand (`deck.gradesSet`, set when the editor opens) guesses each slide's grades from the
  deck's PK / K / 1 / EXTRA sections: a song is for its section's grade and the ones after it.
  Runs on import and on every load.
- `store.js`: IndexedDB. Decks and pictures live on the device they were imported on.
  `timings` gets a row each time a slide is on screen for 2 seconds or more
  (deck, slide, song, milliseconds), for average song lengths later.
- `sw.js`: keeps an offline copy of the app (not the data).
- `fonts/`: Comic Neue (SIL Open Font License), the stand-in for Comic Sans MS,
  which Chromebooks don't have.

## Deck format

```
deck = { w: 960, h: 540, googleId, gradesSet, warnings: [], slides: [slide] }
slide = { bg: fill, els: [element], notes, title, gid, hidden, spinner, menu, grades: ['PK', 'K', '1'],
          song: { kind: 'song' | 'kidsChoice', name, icon, minutes, position, returns, spinner } }
element = { t: 'sp' | 'pic', x, y, w, h, rot, flipH, flipV, geom, adj,
            fill, line, text, link, media, crop, alpha,
            role: 'counter' | 'timer' | 'songIcon' | 'position' | 'minutes' | 'returns' | 'spinner',
            mark, box }
fill = { type: 'solid', color } | { type: 'linear', angle, stops } | { type: 'radial', stops }
     | { type: 'image', media }
link = { slide: index } | { url } | { gdoc, gslide, url } | { jump: 'next' | 'previous' | ... }
```

Pictures are stored once each, keyed by a hash of their bytes (`media`), with a
`rights` tag. Imports start as `classroom`: classroom-only material that must never
be published on the public site.

## Private material

Kyle's decks hold school material and pictures from the web. They are never
committed here (this repo is public), and the app never sends them anywhere.
