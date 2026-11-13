# Class on mrwashburnmusic.com

Served at `/class/`. Kyle's classroom slides app: bring in Google Slides decks
(downloaded as PowerPoint) and present them full screen on the classroom TV.
Installable from Chrome on a Chromebook, and works offline once a deck is in.

The plan for the whole app (planner, editor, widgets, substitute access,
copyright rules) is in the project's "Classroom slides app plan" doc.

## Files

- `index.html`, `app.js`: the library (`#/`) and one deck's slides (`#/deck/<id>`), plus importing.
  The header links Decks, Planner, Calendar, Lists and Sub plans, the one on show highlighted.
- `editor.js`: the slide editor (`#/deck/<id>/edit/<n>`). Select, move (with snapping; Alt turns
  it off), resize, type in boxes (Ctrl+Shift+> and < step text size as Google Slides does, 11 included), add text, shapes and pictures, links, marks, layer order
  (Ctrl+↑ or Ctrl+↓ one step, with Shift to the front or back), slide strip with drag to reorder. Undo keeps earlier lists of slides: each change copies only
  the slides it touches. Slide links follow their slide when slides move. Saves as it goes.
- `ui.js`: helpers the pages share (thumbnails, picture URLs).
- `menus.js`: builds a grade's menu on demand: the icon of every song for that grade or an
  earlier one (a 1st grade menu has the PK and K songs too), once per song, as big as the page
  allows, in the look of the deck's own menu slides with the title shrunk to fit its box. The
  deck page's grade chips (All, PK, K, 1) show only the slides tagged for that grade (a class
  deck's untagged slides show for every grade), Present skips the rest, and Menu opens the built
  menu. A link to one of the deck's own menu slides opens a built one too: "PK/K/1 ..." menus
  become that grade's menu, others (its dances) keep their songs for the grade on show. Songs this grade hasn't reached yet are locked (`lockedSlides`): up to
  today's class on the calendar (`classAsOf`), or a built class's number when opened from it.
  Songs with a Max in an earlier grade are from an earlier year and never locked.
  The deck page sorts a category deck's songs (deck order, A–Z, Z–A, class order either way,
  custom); the menus follow the same order. Sorted views keep a deck's usual songs first, then
  its Move Its (titled "Move It ..."), then its dances (a DANCE banner). A grade's menu holds the
  usual songs plus one icon each (the deck's own button picture) for a Move It menu and a dance
  menu (`{ submenu }` links); Move Its carry their numbers there, since they share an icon. Class order is the first class that slates a song
  for the grade (any grade under All); songs no class slates come last. Custom order is set by
  dragging songs, saved with the deck (`deck.songOrder`, song keys). The sort is remembered on
  the device (`class.sort`).
- Pictures from the web: the editor's search button opens Google Images (SafeSearch on) in its
  own tab; a copied picture pastes in with Ctrl+V, and "Use as background" turns a picture into
  the slide background. In-app search would need an API key on a server, which this site
  doesn't have yet.
- A deck page shows a deck's Move Its and dances apart from its usual songs, each under a line
  of its own (in every sort); the Sub plans song list does the same.
- `planner.js`, `plans.js`, `xlsx.js`: the planner (`#/plan`), ported from the Apps Script
  planner. Import DATABASE.xlsx once per year (read in the browser, kept in IndexedDB `plans`).
  Grade tabs, years ("New year" keeps the catalog, empties plans, zeroes Max), catalog with Max,
  drag to place or swap, Shift-click to hold a song another class, Max raised when a song is
  placed past it, undo (Ctrl+Z), class totals. Shift-click a catalog song to add it to the first
  empty slot; more shift-clicks of that song keep to that column. Placeholders: ??? (the class
  picks), CONCERT (an empty slide), NULL (left empty on purpose: no slide, no icon, not counted).
  Catalog categories start folded. Saves run in order, and each checks the stored plan is the
  one on screen: if another tab or a sync changed it, nothing is overwritten and it reloads.
  Build waits for saves. A song's Max per grade also sets which grades
  its slides are for (any number above 0), even after grades are set by hand in the editor.
  A song slide the plan doesn't have (or has only below SUMMARY) is for no grade; a song's
  later slides (same icon) go with it. The editor decides only slides that aren't songs. Timed minutes from Present
  show on the catalog chips' tooltips.
- `calendar.js` (`#/plan/calendar`): the workbook's Calendar sheet a month at a time: each school
  day's rotation code (A12 = group A, class 12, for K and 1) or what it is instead, PK's week
  number per week. Picking a day lists each grade's class that day with Build/Open. Changing a
  day can move the later classes with it (a lost class day pushes them back one class day).
- `lists.js` (`#/plan/lists`): a category's songs as on its sheet: details, per-grade Plan / Max
  / Left (the planner's Max), the sheet's extra columns (Key, Lessons, Notes...). Add, rename
  (renames in the plans too), shelve, remove (only when no class uses it).
- The library starts with "This week": each grade's current class from the calendar
  (`classAsOf` for today, in the plan for this school year), its built deck or a placeholder
  with Build. A built class's page has Rebuild (`saveBuild` in `planner.js`, as the planner and
  calendar use): the deck is made again from the category decks as they are now, keeping its id
  and the background on its title slide. Other hand edits to a built deck are replaced.
  Presenting a built class with every slide shown, through to the end screen, saves a run
  when Present closes (a `timings` row with `kind: 'run'`: each song's time and the total; time
  in a deck a slide links to counts for that slide). Nothing else is timed, so a quick look in
  Present leaves no times. The class's page lists them under Times. Runs carry `v: 2`; older
  timings were cleared and are dropped on every device (`purgeTimings`, `TIMING_V` in `store.js`).
- Present keeps the screen awake (Screen Wake Lock) while it is open.
- The library groups decks: the category decks (in plan order), then classes (built ones, the Class template,
  imported class decks), then everything else. The Class template deck is made once from an
  imported class deck like "1 29" (its title and exit slides); builds use it, so that deck can go.
- `builder.js`: Build on a planner row makes that class's deck in the library, as the Apps
  Script builder did: title and exit slides from a class deck in the library (named like
  "1 29"), song slides copied from the category decks (matched by a line of text equal to the
  catalog name) with x/y stamped, the icon rail with checks, the song list, next class's icons.
  Links on a copied slide into its category deck open that deck; a link to a menu opens the
  grade's built menu with songs the plan hasn't reached yet locked.
- `widgets.js`: slide elements that work in Present (`{ t: 'wg', kind }`): timer (counts down
  and chimes, or up), spinner, video (YouTube, through the no-cookie player, or a video file),
  sound file, Spotify, drawing box, think/speak, Street View. Added from the editor's 🧩 menu;
  double-click one to change it. Elsewhere they draw as labels or icons. What a widget is set up
  with lives on its element, so it saves with the slide and copies with it (duplicate slide, Ctrl+C
  and Ctrl+V, even into another deck, and class builds).
  The spinner, video, Spotify, the drawing box, think/speak and Street View sit on the slide as
  a small box (the spinner, drawing box, think/speak and Street View as just their icon, think/speak's
  a thought cloud; the others with a title, `name`) and open
  big over the slide when tapped, outside the slide's scaling
  so they stay sharp: video starts playing, Spotify shows its player (closing tucks it away still
  playing; the box's ■ stops it), the drawing box gives a canvas with pens, eraser and clear,
  and takes pictures: 🔎 opens a Google Images tab for see-through pictures (SafeSearch on);
  a copied picture pastes in (Ctrl+V or 📋), a picture file drops in, and ✋ moves and sizes
  them (✕ takes one off). Pictures stay under the ink and are never saved to the deck.
  A spinner opens on the list set for it in the editor (`el.list`, only the list's name; double-click
  it to change), or on the last list used. Numbers 1–20 and Letters A–Z are on every device.
  The spinner takes a picked name off the wheel until everyone has had a turn; "Leave in" puts
  it back, ↺ puts everyone back. Think/speak (`pics: [{ media }]`, chosen in the editor) opens on
  white with a speak row and a think row; a tap moves a picture to the other row in its column,
  for the sitting only. Street View (`places: [{ name, src }]`) opens Google Maps' embed of the
  first place, with the others in a list under it; the two used to be wide boxes, and `markDeck`
  shrinks old ones to an icon once (`el.icon`); each `src` comes from pasting Maps' Share > Embed a map code.
  No key or account: the flying-between-places animation would need Google's 3D Maps API.
  Escape closes an open one; leaving the slide closes it. Drawings last for the sitting only,
  unless 💾 saves a PNG to the device's downloads. The spinner's class lists live only in this browser's localStorage
  (`class.names`), never in a deck, so student names stay on the device. A slide's old link to
  an online name spinner opens this spinner instead.
- `library.js`: the picture library, pictures kept for the drawing box and think/speak, in
  groups (a game's pictures), each with a name. Kept up in the studio (`/studio/pictures/`,
  straight on the website through `/studio/api/class/`): paste a picture or its address (the
  website fetches it, `grab` in `worker/index.js`; a Google Images result link works too), pick
  files or drop them, name, find, group. In the drawing box, 📚 opens a tray of the library:
  type to find by name in every group, tap a picture to put it on the board; ⭐ keeps the chosen
  board picture in the tray's group, named for what 🔎 last searched. Think/speak's picture list
  takes them too ("From the library", with a search). One synced record (`library`, below).
- Lists (`lists.js`) colors its cells by value (a scale for Min., Eng. and Cmf., a color per
  choice for Turns, Pos. and Loc., done / some / none left for each grade). Timed, beside Min., is
  the song's average over whole-class runs (`songTimes`); tapping it makes it the Min.
- `subsongs.js`: sub songs. In Sub plans, Kyle taps a category deck's song to make it a sub song:
  its slides are copied into the "Sub songs" deck (`deck.subSongs`, each slide tagged
  `subSong`), where ✎ opens them in the editor to add videos, sounds and the like for the sub.
  A grade sees a song unlocked when an earlier grade has it (last year) or the calendar has
  reached the class that first slates it; locked when the grade has it later this year (a
  Max, or a later class); not at all when only a later grade has it (`from`, worked out from
  the plan when the app opens and on Sub plans). 🔒 / 🔓 unlocks one by hand. Each category's
  menus take the look of its deck's menu slide (`looks`: background and title box). Sub plans
  has no deck to pick: the code opens the Sub songs deck. At
  /sub/ the sub picks a grade and gets the workout: a menu per category in plan order, each with
  → to the next category; a song's slides keep the keys to that song, and its Menu link (or a ▦
  button added for the sub) goes back to the menu.
- `subs.js` (`#/sub`) and `/sub/` (`sub/index.html`, `sub/sub.js`): sub plans. Kyle picks a deck
  and a code (6+ letters or numbers; case, spaces and dashes don't count); a substitute types the
  code at /sub/ and presents that deck, and the decks it links into (`linkedDecks`, sent again
  after a sync when its links change). The setting lives on the website (`sub/config.json` in the
  bucket, `/api/class/sub` for Kyle, `/api/sub/` for the sub; see subApi in `worker/index.js`).
  The sub gets the decks and a random key for their pictures only; a new code makes a new key.
  Wrong codes are rate limited. The sub view keeps nothing on the device (no IndexedDB, no
  timings) and has no picture library. Edit the sub deck like any other; the sub sees the
  synced copy.
- `sync.js`: keeps decks, pictures, plans, the picture library and timings in step with the website's copy
  (`/api/class/`, `worker/index.js`), so home and school share one library. Signing in goes
  through Cloudflare Access (Kyle's login). Sync runs when the app opens, comes online or back
  into view, and a moment after each change; the cloud in the header shows how it went.
  - Each deck and plan has `updated` (its version) and `synced` (the version the website last
    had). Changed only here: it goes up. Changed only there: it comes down. Changed in both: a
    plan or built deck keeps the newer; another deck keeps both, this device's as "(copy)".
  - A removal is remembered (localStorage `class.sync`) until the website has it, then removes
    the deck everywhere.
  - A device's first sync matches its decks to the website's by name: the website's copy wins,
    this device's stays as a copy if it differs, and links between decks follow.
  - The deck open in the editor is never swapped out under it. Pulled changes redraw the
    library, a deck's page and the planner, but never Present.
  - A new device's empty library and planner show Sign in, then "Syncing…" while the first
    sync runs. Each kind (decks, plans, library, timings) shows as soon as it arrives, and a
    picture that fails to download doesn't stop the rest.
  - Spinner names are not synced. The service worker never caches `/api/`.
- `pptx.js` (with `zip.js`): converts a .pptx into the deck format below, right in the browser.
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
  deck's PK / K / 1 / EXTRA sections: a song is for its section's grade and the ones after it
  (only with no year plan; with one, songs go by the plan).
  Runs on import and on every load.
- `store.js`: IndexedDB. Decks and pictures live on the device they were imported on.
  `timings` gets a row for each whole-class run (see the library above), for average song lengths.
- `sw.js`: keeps an offline copy of the app (not the data). Network first, but after 3 seconds
  the last copy answers, so slow school wifi doesn't hold the app up.
- `fonts/`: Comic Neue (SIL Open Font License), the stand-in for Comic Sans MS,
  which Chromebooks don't have.

## Deck format

```
deck = { w: 960, h: 540, googleId, gradesSet, songOrder: [key], warnings: [], slides: [slide] }
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

```
library = { id: 'pictures', name, created, updated, groups: [{ name, pics: [{ media, name }] }] }
```

Pictures are stored once each, keyed by a hash of their bytes (`media`), with a
`rights` tag. Imports start as `classroom`: classroom-only material that must never
be published on the public site.

## Private material

Kyle's decks hold school material and pictures from the web. They are never
committed here (this repo is public). Sync keeps them in a private R2 bucket that
only Kyle's Access login reaches; nothing there is ever served on the public site.
