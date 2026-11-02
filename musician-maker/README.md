# Musician Maker

Music literacy for learners 9 and up, following John Feierabend's Conversational Solfège.
Press play and it never stops: a stream of quick, silly micro-games on one groove that
speeds up as you go. The stream engine design doc in the Musician Maker project explains why
it works this way; this file says where things are.

**Status: first playable loop, Unit 1 only (du, du-de in 2/4).** Not linked from the site.
Served at `/musician-maker/`; try it with any static server from the repo root.

## A run

- **Lap:** three sets of 4 micro-games (3 in Mookie mode) at 92, 108 and 126 bpm, each
  followed by an 8-beat breather, then a boss (The Big Cheese) and an intermission where the
  learner can stop. The next lap starts back at 92. A rung is held when the learner is
  struggling.
- **Micro-game:** cue (2 beats) · call (4) · response (4 beats; Build and Compose 8) · payoff
  (2). The call is "bum" (neutral), syllables, notation or text, depending on the step.
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
  First versions of Mouse Catcher and Supper Time.
- `sound.js`: the groove, calls, cue words, effects. Uses Kyle's recordings where they're on
  the site (takes on "bum" and in syllables, cue words, groove loops per layer and tempo) and
  the site's sampled instruments for anything missing.
- `cues.js`: the cue words Kyle records at `/studio/record/` (Cue words).
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
- `scene-mouse.js`: Mouse Catcher in full (Mookie sits right beside the hole, so her reach stays short): the room (pendulum clock on the beat, WANTED poster,
  window, mouse hole), rigged Mookie's rubber-hose swipes, the win and miss gags, close-up
  cutaways, a party that grows with the combo, and The Big Cheese for the boss. Win and fail
  gags are picked at random (never the same twice running). Real photo props join in: the
  Critic (a googly-eyed Roman bust who sings along and tuts), a hopping frog flask, a teacup
  trap, a jousting helmet, a bronze decoy mouse, and for the boss a bell drop and a trophy.
  Styles in `scenes.css`.
- `props/`: the photo props, CC0 museum objects cut out with a sticker edge
  (`props/CREDITS.txt`). New props should be CC0 or public domain, transparent PNG, about
  320px on the long side.
- `rig.js`: rigged Mookie for scenes: springs on body, head, ears, eyes, arms and tail; moods
  (idle, hunt, happy, smug, star, shock, dizzy); `reach()` to any point on the page.
- `critters.js`: the mouse and The Big Cheese, with props (shades, flag, crown, bandage).
  `photoMouse()` is the mouse as a real photo with the same props and API; Mouse Catcher uses it.
- `fx/`: cartoon sound effects from Kenney's CC0 packs (`fx/CREDITS.txt`); `toon()` in
  `sound.js` plays them and synthesizes the rest (slide whistle, squeak, raspberry, zip, bike
  horn, frog croak, gong, choir).
- `mookie.js`: Mookie (placeholder art from the Mookie mockups).
- `store.js`: progress on this device (localStorage). No accounts, names or analytics.

Every game shows a what-to-do line (`howTo` in `steps.js`), marked NEW the first time that
kind of game comes up. The pad says Listen or Read until it's the learner's turn.
How to play (on the title screen) explains the loop in four lines.

Private preview: `python tools/mm_preview.py` copies the app and the assets it uses into
`.mm-preview/` (git-ignored) for publishing as a Claude Artifact. The mic doesn't work there.

Test mode (My progress → Test mode) adds a Drill button to every step, for trying any step's
games without earning your way there.

## Next

Kyle's recordings ("bum" takes, cue words, groove loops), more of Kyle's games, the progress backup
file, Gauntlet mode (4 lives), and Unit 4 (tonal, sung into the mic).
