# Class on mrwashburnmusic.com

Served at `/class/`. Kyle's classroom slides app: bring in Google Slides decks
(downloaded as PowerPoint) and present them full screen on the classroom TV.
Installable from Chrome on a Chromebook, and works offline once a deck is in.

The plan for the whole app (planner, editor, widgets, substitute access,
copyright rules) is in the project's "Classroom slides app plan" doc.

## Files

- `index.html`, `app.js`: the library (`#/`) and one deck's slides (`#/deck/<id>`), plus importing.
- `pptx.js` (with `zip.js`): converts a .pptx into the deck format below, right in the browser.
  Nothing is uploaded anywhere.
- `render.js`: draws one slide on a 960 x 540 stage. Present mode, thumbnails and
  (later) the editor all use it.
- `present.js`: full-screen Present mode. Clicker and arrow keys, links between slides
  (Google decks link to their own slides with web addresses; the converter turns
  those into slide jumps), and links into another imported deck.
- `store.js`: IndexedDB. Decks and pictures live on the device they were imported on.
- `sw.js`: keeps an offline copy of the app (not the data).
- `fonts/`: Comic Neue (SIL Open Font License), the stand-in for Comic Sans MS,
  which Chromebooks don't have.

## Deck format

```
deck = { w: 960, h: 540, googleId, warnings: [], slides: [slide] }
slide = { bg: fill, els: [element], notes, title, gid, hidden }
element = { t: 'sp' | 'pic', x, y, w, h, rot, flipH, flipV, geom, adj,
            fill, line, text, link, media, crop, alpha }
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
