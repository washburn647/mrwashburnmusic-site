# mrwashburnmusic.com

Static site for Mr. Washburn Music. No build step: every file here is served as is.

## Layout

- `index.html`: the public coming soon page
- `songburner/`: Song Burner, the lyric memorization app (see `songburner/README.md`)
- `class/`: the classroom slides app, for presenting lessons on the classroom TV (see `class/README.md`)
- `studio/`: private behind-the-scenes tools (locked with Cloudflare Access, see below). The hub links to Class, the planner, Song Burner and the tools. Tools keep their data on the device (IndexedDB `mwm-studio`, `studio/db.js`) and move between devices as a backup file.
  - `studio/cues/`: video cue sheets (shots with length, running time, what to say, on-screen text, notes; prints)
  - `studio/lessons/`: private lesson pages. One page per lesson for each student, first names only. Each practice item has one piece (MusicXML: playback settings, and a Student view with the buttons, speed range, sections and parts the student gets) or one flash card deck (notes, or tonal or rhythm patterns from a unit; which ways of answering, say or sing first, a goal). Each student has a code of five words: Publish locks their last 20 lessons with it in the browser and stores them on the site, where only the code opens them (`lesson/locked.js`, `worker/`); Results shows their flash card sessions and the notes and patterns they miss most. Copy link still gives a single lesson inside a `/lesson/#...` link (`lesson/codec.js`). Private notes never leave the studio. The library keeps items and pieces for reuse. A new lesson starts from the last one's list.
- `lesson/`: the student's page, opened with their code (remembered on that device) or a lesson link: this week's lesson, earlier ones, practice timer and days, the list, the piece player (`player.js`: 🎹 a small listening window, 🎼 the sheet music; drawn by OpenSheetMusicDisplay in `lesson/vendor/`, BSD licence) and flash card practice (`cards.js`, `practice.js`, `keyboard.js`, VexFlow). Checkmarks and minutes stay in the student's browser; flash card results go to Kyle, encrypted with the student's code.
- `worker/`: the site's only server code. It keeps each coded student's locked pages and results in a Durable Object, and can't read them. Studio calls also check the Cloudflare Access token (see below).
  - `studio/record/`: voice recorder, by Conversational Solfege unit. Each unit's rhythm or tonal patterns are generated from its concepts (`assets/patterns/patterns.js`), drawn in notation, trimmed by hand and marked familiar or unfamiliar; a few takes of each at three speeds are trimmed and saved as small mp3s on the device (IndexedDB `mwm-voice`). "Save for site" writes `voice-kyle.zip` (takes tagged by pattern, plus the units) to a chosen folder, or downloads it, for `tools/add_takes.py`
- `assets/logo/`: logo options; the site uses `option-f-notes-badge.svg` and its icon as `favicon.svg`
- `assets/sounds/`: shared recorded instruments and percussion, loaded on demand by `samples.js` (see `assets/sounds/README.md`); try them at `/studio/sounds/`
- `assets/patterns/`: the rhythm and tonal pattern catalogue (`patterns.js`, ids used by recordings, lessons and Musician Maker), its notation (`notation.js`, VexFlow in `assets/vendor/vexflow/`, MIT), and `units.json` (from the recorder: each unit's patterns in order, marked familiar or unfamiliar)
- `assets/fonts/`: Fredoka (SIL Open Font License), self-hosted so no visitor data goes to Google
- `_headers`: security headers
- `tools/build_offline_lessons.py OUT`: an offline copy of the lesson tools that opens from disk, for trying changes before they go live
- `tools/make_logo.py`: regenerates the logo SVGs (`pip install fonttools brotli`, then `python -m fontTools.varLib.instancer assets/fonts/fredoka-latin.woff2 wght=600 -o Fredoka-SemiBold.ttf` and `python tools/make_logo.py Fredoka-SemiBold.ttf assets/logo`)

Later apps each get their own folder (`/pitch-by-pitch/`, `/play/`) so each PWA installs and caches on its own.

## Deploy

The site runs on Cloudflare Workers (static assets), set up in `wrangler.jsonc`, which also attaches `mrwashburnmusic.com` and `www.mrwashburnmusic.com`. Every push to `main` deploys automatically. Files listed in `.assetsignore` are not served.

## Lock the studio

1. Cloudflare dashboard > Zero Trust (free plan, up to 50 users).
2. Access > Applications > Add > Self-hosted.
3. Domain `mrwashburnmusic.com`, path `studio`. The `workers.dev` address is turned off in `wrangler.jsonc`, so the real domain is the only way in.
4. Policy: Allow, Include > Emails > your email. Login method: One-time PIN.

Anyone opening `/studio/` then has to enter a code emailed to you.

5. For Publish and Results in the lesson pages, the Worker checks the Access token too. In the Access application, copy the Application Audience (AUD) tag. Then Workers & Pages > mrwashburnmusic-site > Settings > Variables and secrets, add `ACCESS_TEAM` (your team name, the part before `.cloudflareaccess.com`) and `ACCESS_AUD` (the tag). Until they are set, Publish answers 403. Nothing in this repo should ever hold passwords or API keys, because the files are public on GitHub and the site.
