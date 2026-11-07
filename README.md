# mrwashburnmusic.com

Static site for Mr. Washburn Music. No build step: every file here is served as is.

## Layout

- `index.html`: the public coming soon page
- `songburner/`: Song Burner, the lyric memorization app (see `songburner/README.md`)
- `musician-maker/`: Musician Maker, a nonstop stream of rhythm and melody micro-games for Conversational Solfège (first playable loop, Unit 1; not linked yet; see `musician-maker/README.md`)
- `class/`: the classroom slides app, for presenting lessons on the classroom TV (see `class/README.md`)
- `studio/`: private behind-the-scenes tools (locked with Cloudflare Access, see below). The hub links to Class, the planner, Song Burner and the tools. Tools keep their data on the device (IndexedDB `mwm-studio`, `studio/db.js`) and move between devices as a backup file.
  - `studio/cues/`: video cue sheets (shots with length, running time, what to say, on-screen text, notes; prints)
  - `studio/record/`: voice recorder, by Conversational Solfege unit. Each unit's rhythm or tonal patterns are generated from its concepts (`assets/patterns/patterns.js`), drawn in notation, trimmed by hand and marked familiar or unfamiliar; a few takes of each at three speeds (92, 108 and 126 bpm by default), in syllables and on "bum", plus Musician Maker's cue words, are trimmed and saved as small mp3s on the device (IndexedDB `mwm-voice`). "Publish to site" uploads the new takes and the units straight to the site (`/api/live/`, see `worker/index.js`); "Download" writes `voice-kyle.zip` (takes tagged by pattern, plus the units) to a chosen folder, or downloads it, as a backup for Restore or `tools/add_takes.py`
  - `studio/groove/`: Groove Lab, Musician Maker's backing grooves on the site's sampled instruments: 8 or 16 beats on a 16th-note grid, each groove with a 2/4 and/or a 6/8 version (the second can start as a copy of the first, moved to the new grid), six layers (pulse, bass, drums, horns, band join with the combo; breakdown for breathers), percussion step rows and piano rolls, swing, undo, kept on the device (localStorage). "Publish to site" puts the grooves in the game straight away (`/api/live/grooves.json`); "Download" saves `grooves.json`, a backup for Restore or `tools/add_grooves.py`, which writes `musician-maker/grooves.json`
  - `studio/songburner/`: Song Burner's beta testers (email, songs, runs, last seen; Remove deletes a tester's cloud copy and signs them out) and the default settings every tester starts from ("Publish to site", `/api/live/songburner.json`)
  - `studio/lessons/`: private lesson pages. One page per lesson for each student, first names only. Each student has an instrument (Piano; Guitar is a placeholder that hides the keyboard tools). Each practice item has one piece (MusicXML: playback settings, sections marked with letters or names, typed fingerings, and a Student view with the ways to play it and the speed range) or one flash card deck (notes, or tonal or rhythm patterns from a unit, drawn in notation; which ways of answering, say or sing first, a goal). Each student signs in with their first name and five emojis Kyle picks with them: Publish locks their last 20 lessons and their library (items marked 📚, from any lesson) with these in the browser and stores them on the site, where only that name and those emojis open them (`lesson/locked.js`, `worker/`); Practice shows, by week, the days they opened their page, minutes, plays of each piece by mode, flash card sessions, and the notes and patterns they miss most. Copy link still gives a single lesson inside a `/lesson/#...` link (`lesson/codec.js`), which reports nothing back. Private notes never leave the studio. The library keeps items and pieces for reuse. A new lesson starts from the last one's list.
- `lesson/`: the student's page, opened with their first name and five emojis (remembered on that device) or a lesson link: this week's lesson, earlier ones, their 📚 library, days until the next lesson, their practice so far, the list, the piece player (`player.js`: 👂🎶 listen, 🎹 a keyboard that lights up as it plays, 🎼 the sheet music, or both; drawn by OpenSheetMusicDisplay in `lesson/vendor/`, BSD licence) and flash card practice (`cards.js`, `practice.js`, `keyboard.js`, VexFlow). Checkmarks stay in the student's browser; with a code, visits, piece plays and flash card results go to Kyle, encrypted with the student's code.
- `assets/logo/`: logo options; the site uses `option-f-notes-badge.svg` and its icon as `favicon.svg`
- `assets/sounds/`: shared recorded instruments and percussion, loaded on demand by `samples.js` (see `assets/sounds/README.md`); try them at `/studio/sounds/`
- `assets/patterns/`: the rhythm and tonal pattern catalogue (`patterns.js`, ids used by recordings, lessons and Musician Maker), its notation (`notation.js`, VexFlow in `assets/vendor/vexflow/`, MIT), and `units.json` (from the recorder: each unit's patterns in order, marked familiar or unfamiliar)
- `assets/fonts/`: Fredoka (SIL Open Font License), self-hosted so no visitor data goes to Google
- `worker/`: the only server code. It answers `/api/class/` (the Class app's synced files, kept in R2) and the lesson students' locked boxes (`/api/s/`, `/studio/api/s/`, Durable Objects it can't read); everything else is served as static files
- `_headers`: security headers
- `tools/build_offline_lessons.py OUT`: an offline copy of the lesson tools that opens from disk, for trying changes before they go live
- `tools/make_logo.py`: regenerates the logo SVGs (`pip install fonttools brotli`, then `python -m fontTools.varLib.instancer assets/fonts/fredoka-latin.woff2 wght=600 -o Fredoka-SemiBold.ttf` and `python tools/make_logo.py Fredoka-SemiBold.ttf assets/logo`)

Later apps each get their own folder (`/pitch-by-pitch/`, `/play/`) so each PWA installs and caches on its own.

## Deploy

The site runs on Cloudflare Workers (static assets, plus `worker/index.js` for `/api/`), set up in `wrangler.jsonc`, which also attaches `mrwashburnmusic.com` and `www.mrwashburnmusic.com`. Every push to `main` deploys automatically. Files listed in `.assetsignore` are not served.

## Lock the studio

1. Cloudflare dashboard > Zero Trust (free plan, up to 50 users).
2. Access > Applications > Add > Self-hosted.
3. Domain `mrwashburnmusic.com`, path `studio`. The `workers.dev` address is turned off in `wrangler.jsonc`, so the real domain is the only way in.
4. Policy: Allow, Include > Emails > your email. Login method: One-time PIN.

Anyone opening `/studio/` then has to enter a code emailed to you. Nothing in this repo should ever hold passwords or API keys, because the files are public on GitHub and the site.

## Class sync

The Class app keeps decks, pictures and plans on the website in a private R2 bucket, `mwm-class-files` (public access off). Cloudflare Access guards `/api/class` on `mrwashburnmusic.com` and `www.mrwashburnmusic.com`, as part of the studio application. `wrangler.jsonc` names that Access team domain and the application's Audience (AUD) tag (Access application > Additional settings); they are not secrets. The Worker checks every request's Access login itself as well.

## Lesson students

A student's code opens their locked pages at `/lesson/`. The Worker keeps one Durable Object per student (`Box`), holding only what the browser encrypted. Publish and Results go through `/studio/api/s/`, under the studio's Access application, and the Worker checks the Access login with the same `ACCESS_TEAM` and `ACCESS_AUD` as Class sync.
