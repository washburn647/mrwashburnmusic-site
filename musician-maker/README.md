# Musician Maker

Music literacy for learners 9 and up, following John Feierabend's Conversational Solfège.
Press play and it never stops: a stream of quick, silly micro-games on one groove that
speeds up as you go. The stream engine design doc in the Musician Maker project explains why
it works this way; this file says where things are.

**Status: first playable loop, Unit 1 only (du, du-de in 2/4).** Not linked from the site.
Served at `/musician-maker/`; try it with any static server from the repo root.

## A run

- **Lap:** three sets of 4 micro-games (3 in Mookie mode) at 92, 108 and 126 bpm, each
  followed by an 8-beat breather, then a boss (The Big Cheese, The Big Fluff or The Mane Event, by turns) and an intermission where the
  learner can stop. The next lap starts back at 92. A rung is held when the learner is
  struggling.
- **Micro-game:** cue (4 beats) · call (4) · response (4 beats; Build and Compose 8) · payoff
  (4; Compose 8, to play the pattern back). Every part is whole bars, and the groove loop
  restarts at bar 1 on each call, so a game never lands mid-loop. The call is "bum" (neutral), syllables, notation or text, depending on the step.
  Syllables on screen carry iconic notation: a stem over each note, a beam over each du-de.
- **Band seats:** either side of the bouncing ball, one seat per layer (bass, drums, horns,
  keys). Each lights up when its layer joins at a combo tier and bobs on the beat.
- **Answer modes:** Perform (tap or speak in time), Pick (1 of 2–4), Build (four ♩/♫ slots),
  Create (answer with a different pattern), Compose (any pattern, played back).
- **Combo:** 3, 6, 10 and 15 in a row add bass, drums, horns and the full band to the groove
  and multiply XP ×2 to ×5. A miss resets it (Mookie mode: drops one tier). XP is never lost.
- **XP:** 10 a right answer, +5 for perfect timing, × tempo (1, 1.5, 2), × 1.5 by mic,
  × combo. +50 for a set with no misses, +100 for beating the boss, +50 for the first run of
  the day. No game over, no leaderboards, no streak that can break.

## Files

- `main.js`: title, progress view, the run (laps, games, breathers, boss, intermission), grading.
- `director.js`: picks every next game (60% newest step, 25% weak steps, 15% review), tracks
  strength per step, pattern and pattern feature, re-queues misses, keeps success near 80%,
  and decides mastery (strength 80+, 10+ items, half Perform/Build, 3 right at 108+).
- `steps.js`: the 12 steps (call, answer modes, familiar/unfamiliar set) and Unit 1's patterns
  from `/assets/patterns/patterns.js`. Kyle's familiar marks from the recorder
  (`/assets/patterns/units.json`) replace the built-in set once published.
- `games.js`: the micro-games. A game is a scene and a gesture; it never knows the step.
  Mouse Catcher, Supper Time and Brushing Time are in their own files. A game with a `bossName` can host
  the boss; `main.js` takes turns between them by lap.
- `sound.js`: the groove, calls, cue words, effects. Uses Kyle's recordings where they're on
  the site (takes on "bum" and in syllables, cue words, groove loops per layer and tempo) and
  the site's sampled instruments for anything missing.
- `cues.js`: the cue words Kyle records at `/studio/record/` (Cue words).
- `grooves.json`: the grooves, made in the studio's Groove Lab (`/studio/groove/`, added with
  `tools/add_grooves.py`). The game plays what the Lab last published (`/api/live/grooves.json`)
  ahead of this file. Notes on a 16th-note grid in six layers, so they play at any tempo. A groove can have a
  2/4 and a 6/8 version on the same instruments and chords; `snd.setGrooveMeter` switches
  between them mid-loop (for review items from a unit in the other meter);
  `sound.js` plays them with the same code as the Lab. The title's Groove button picks one, or
  Mix: a different groove each lap, from the grooves in the unit's meter.
- `options.js`, `games.json`: game options from the studio's Musician Maker game workshop
  (`/studio/games/`): per game, whether it's in the stream, whether it hosts the boss, which win
  and fail gags can come up, and its tap sound. The workshop keeps drafts on Kyle's device;
  "Publish to site" puts them in the game straight away (`/api/live/games.json`, played ahead of
  this file); "Download" saves `games.json`, which `tools/add_games.py` checks and puts here.
  Learners get `games.json`; a workshop test run (`?test=<game id>`, plus `step`, `tempo`,
  `start=boss`, `pace=mookie`, `groove`) plays only that game, with the drafts, and saves nothing.
- `gags.js`: picks a game's win and fail gags from the ones that are on. Each game lists its gags
  with names (`gags`), and `win(gag)` / `fail(gag)` can force one (the workshop's Try it).
- `intro.js`: skill intros. The first time a kind of game comes up (step and answer mode), the
  stream stops for a pop-up: a title, what to do, Kyle's recorded message when there is one
  (audio or video in `intros/`), and a slow practice try with no score. "Let's play" counts back
  in to that game. Written intros go in `INTROS`; any skill without one uses its step's lines.
  Seen ones are kept in `st.intro`. The workshop previews each one (`?intro=<step>-<mode>`), and
  a test run can show them all again (`intros=all`).
- `speech.js`: the call in syllables, built up in one speech bubble a syllable at a time and left
  up a moment so the whole pattern shows. Every game's singer uses it.
- `clock.js`: the beat clock everything is scheduled on.
- `mic.js`, `mic-worklet.js`: syllable onsets from the mic, found on the audio thread, analysed
  live and never kept. Only counted on the learner's turn; a tap and a syllable together count once.
- `transitions.js`: the transitions between games (cover on the beat, swap the scene, uncover).
  Test mode → Transitions lab plays each one and picks which the stream uses.
- Beat cues: a bouncing ball lands on each beat's dot, the HUD pulse lights beat 1 or 2 of the
  2/4 bar, the stage thumps on beat 1 (glowing in the combo's colour), and each game's
  characters move on the beat (`onBeat` in `games.js`).
- `effects.js`: feedback effects. Taps ripple and leave a tick on the beat lane, coloured by
  timing (on time, early or late); right answers burst confetti (stars when perfect) and fly
  the XP to the counter; misses wobble the stage; combo tiers send a shockwave and the band in.
- `scene-mouse.js`: Mouse Catcher in full (Mookie sits right beside the hole, so his reach stays short): the room (pendulum clock on the beat, WANTED poster,
  window, mouse hole), rigged Mookie's rubber-hose swipes, the win and miss gags, close-up
  cutaways, a party that grows with the combo, and The Big Cheese for the boss. Win and fail
  gags are picked at random (never the same twice running). Real photo props join in: the
  Critic (a googly-eyed Roman bust who sings along and tuts), a hopping frog flask, a teacup
  trap, a jousting helmet, a bronze decoy mouse, and for the boss a bell drop and a trophy.
  The room takes turns in five looks (`THEMES`: parlor, castle, pirate ship, groovy 70s, space
  station), with the poster's words to match; styles in `scenes.css` under `[data-theme]`.
- `signs.js`: `fitSigns(root)` shrinks any SVG `<text data-fit="<width>">` that's too wide for
  its sign, once fonts load. Every sign, menu and poster with words uses it.
- `scene-supper.js`: Supper Time in full (styles in `scene-supper.css`): a kitchen (lamp that
  swings on the beat, rattling pot, menu board, checkerboard floor) in one of five looks that
  take turns game by game (`THEMES`: sunset diner, French bistro, 1950s atomic, farmhouse,
  space diner; wallpaper, tiles, counter, lamp, window sky and menu change together through
  CSS variables under `[data-theme]`). The counter stands against the back wall in the middle, behind the cats. Mookie
  asleep in his basket with a snot bubble, and his supper in a 200-year-old Japanese gong bowl
  with its beater. Chef Bastet (an Egyptian bronze cat in a chef's hat, googly eyes) sings the
  call; Bindi and Rusty tiptoe in from the left one step per note. Each tap rings
  the bowl: the thieves freeze, Mookie stirs, the bubble shrinks. Wins: Mookie rockets to his
  bowl, a royal Sevres tureen lands with a fanfare, a porcelain hen tureen squawks the thieves
  away, a bronze lobster pinches Rusty. Misses: the masked heist, Bindi's yowl, Rusty flops on
  the bowl, the stone-fish swap. The boss is Rusty, The Big Fluff, on a silver tureen: each hit
  blows his fur up, the last blasts him off.
- `scene-brush.js`: Brushing Time (styles in `scene-brush.css`): Salon Mookie, a grooming salon
  (barber pole that turns a stripe a beat, a mirror whose bulbs chase with the band, a price
  list, tiles) in one of five looks that take turns (`THEMES`: pink salon, barber shop, day spa,
  80s neon, Paris; colors are CSS variables under `[data-theme]`, and each has its own price list). Mookie sits on the barber stool in his fluffiest coat; a gloved hand on a
  very long sleeve holds the brush. The Head Stylist (Amenhotep III's granite head, googly
  eyes) sings the call, and a tuft of Mookie's fur sproings out on each note. Each tap is a
  brush stroke: a tuft lies flat and a clump flies onto the hair pile. Wins: sleek and slicked
  back, slides off the stool like soap, a bronze lion aquamanile spritzes him to a shine, the
  hair pile walks off as a second Mookie. Misses: one hair and a gnarled coat, a porcelain hen
  nests in the knots and lays an ancient egg, static turns him into a dandelion, the brush
  gets stuck and stays as a hat. The boss is Rusty, The Mane Event, fluffed to twice his size:
  each hit brushes out an armful, the last takes his whole coat off and he's tiny underneath.
- `cats.js`: Bindi and Rusty, rigged like Mookie (springs, moods, tiptoe steps, rubber-hose
  reach, fur that poofs, bandit masks). Drawn from Kyle's photos of them, which aren't kept here.
- `props/`: the photo props, CC0 museum objects cut out with a sticker edge
  (`props/CREDITS.txt`). New props should be CC0 or public domain, transparent PNG, about
  320px on the long side.
- `rig.js`: rigged Mookie for scenes: springs on body, head, ears, eyes, arms and tail; moods
  (idle, hunt, happy, smug, star, shock, dizzy, and for Supper Time sleep, eat, sad); `reach()`
  to any point on the page. For Brushing Time, a coat: classes `furry` (size from `fluff()`,
  tufts from `tuft()`), `tangled` and `sleek` on the svg.
- `critters.js`: the mouse and The Big Cheese, with props (shades, flag, crown, bandage).
  `photoMouse()` is the mouse as a real photo with the same props and API; Mouse Catcher uses it.
- `fx/`: cartoon sound effects from Kenney's CC0 packs (`fx/CREDITS.txt`); `toon()` in
  `sound.js` plays them and synthesizes the rest (slide whistle, squeak, raspberry, zip, bike
  horn, frog croak, gong, choir, and for Supper Time the bowl ding, meow, yowl, chomp, burp,
  cluck, fanfare, hiss, snore and tiptoe, and for Brushing Time the brush, sproing, ting,
  spritz, static zap, purr, roar and sneeze).
- `mookie.js`: Mookie (placeholder art from the Mookie mockups).
- `store.js`: progress on this device (localStorage). No accounts, names or analytics.

Every game shows a what-to-do line (`howTo` in `steps.js`), marked NEW the first time that
kind of game comes up. The pad says Listen or Read until it's the learner's turn.
How to play (on the title screen) explains the loop in four lines.

Private preview: `python tools/mm_preview.py` copies the app and the assets it uses into
`.mm-preview/` (git-ignored) for publishing as a Claude Artifact. The mic doesn't work there.

Test mode (My progress → Test mode) adds a Drill button to every step, for trying any step's
games without earning your way there.

Test mode can also record the mic in runs: when the run ends, the browser saves a .wav of what
the mic heard, with every turn (beat times, pattern, what was counted) in a JSON chunk inside
it. It stays on the device unless it's uploaded by hand. Test mode can turn off the mic's echo
cancelling too, to compare.

**Game workshop** (`/studio/games/`, private): each game's scene on the groove at any combo
tier, with its call, taps, every gag and its boss; its options; and Test play, which opens the
game with only that game in it. "Answer with: Taps and the mic" starts the test with the mic on
(the test screen has the same switch). `?lab` opens the Transitions lab. A new game goes in `GAMES`
(`games.js`) with an `id`, `gags` and `win(gag)`/`fail(gag)`, and its stylesheet goes in
`studio/games/index.html` as well as `index.html`.

## Next

Kyle's recordings ("bum" takes, cue words, groove loops), more of Kyle's games, the progress backup
file, Gauntlet mode (4 lives), and Unit 4 (tonal, sung into the mic).
