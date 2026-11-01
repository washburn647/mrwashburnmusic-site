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
- **Micro-game:** cue (2 beats) · call (4) · response (4 beats; Pick 6 in Mookie mode, Build
  and Compose 8) · payoff (2). The call is "bum" (neutral), syllables, notation or text,
  depending on the step.
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
- `sound.js`: the groove, calls, effects, on the site's sampled instruments
  (`/assets/sounds/`). Calls use Kyle's recorded takes when they're on the site, and stand-in
  drum sounds until then.
- `clock.js`: the beat clock everything is scheduled on.
- `mic.js`: syllable onsets from the mic, analysed live and never kept.
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

Kyle's "bum" takes and cue words in the recorder, more of Kyle's games, the progress backup
file, Gauntlet mode (4 lives), and Unit 4 (tonal, sung into the mic).
