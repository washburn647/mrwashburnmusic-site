# Musician Maker

Music literacy games for learners 9 and up, following John Feierabend's
Conversational Solfège (Levels 1–3, the grade 2+ units). First Steps in Music,
the readiness years, lives elsewhere on the site and has no XP.

**Status: offline test build.** Not linked from the site and not deployed. Open
`index.html` straight from the folder (double-click); no server or internet needed.

## How it works

- **Map:** two tracks, Rhythm and Tonal, units in manual order. The first unit of each
  track is open; finishing a unit opens the next one on its track.
- **Unit:** the 12 Conversational Solfège steps in three bands: Ear (1–5),
  Read (6–8), Write (9–12). One game per step so far; more games per step will come.
- **Mastery:** a step opens when the one before it is mastered. Mastered = enough XP
  earned in that step (`xpGoal`: 150, or 100 for the two create steps) and at least one
  round at 80% or better. XP keeps adding up after that.
- **XP:** 10 for a right answer, 5 on the second try, +20 for a round with no misses.
  Mic answers will earn more (`MIC_XP`) once singing is added.
- **Warm-up:** a short mix of mastered steps, least recently played first.
- **Test out:** a 10-item check (decode new patterns by ear and from notation). 80% marks
  the whole unit done.
- **Mookie mode:** Mookie (Kyle's cat, drawn as in the Mookie mockups) guides with one
  short line, rounds are 6 items instead of 10, tempo is 15% slower, and a miss replays
  the pattern slower. Content and XP rules are the same.
- **Test mode** (Settings): every unit and step open, XP goals one fifth. For Kyle's
  testing only; remove before publishing.

## Content

Units 1 (du, du-de in 2/4) and 4 (do re mi, do = F) are playable. The rest show on the
map, locked, until they are filled in from the manuals. Patterns are generated from each
unit's syllables (`music.js`); the books' pattern sets are not copied here. Each unit has
a fixed "familiar" set and draws "unfamiliar" patterns from everything else.

Rhythm is written on a single line; tonal patterns on the full staff from the start.

## Files

- `index.html`, `lit.css`: page and styles. Classic scripts so the folder works from `file://`.
- `audio.js`: Web Audio sounds (woodblock, beat tick, sung tone). No recordings yet;
  Kyle will record the syllables.
- `music.js`: steps, units, pattern generation, notation drawing.
- `store.js`: progress on the device (IndexedDB, localStorage fallback) and backup files.
- `app.js`: screens, games, XP and mastery.

## Student data

No accounts, names or analytics. Progress stays on the device; the backup file is the
only way it moves. When singing is added, mic audio is analysed live and never saved or sent.
