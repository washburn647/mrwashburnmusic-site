# mrwashburnmusic.com

Static site for Mr. Washburn Music. No build step: every file here is served as is.

## Layout

- `index.html`: the public coming soon page
- `songburner/`: Song Burner, the lyric memorization app (see `songburner/README.md`)
- `class/`: the classroom slides app, for presenting lessons on the classroom TV (see `class/README.md`)
- `studio/`: private behind-the-scenes tools (locked with Cloudflare Access, see below). The hub links to Class, the planner, Song Burner and the tools. Tools keep their data on the device (IndexedDB `mwm-studio`, `studio/db.js`) and move between devices as a backup file.
  - `studio/cues/`: video cue sheets (shots with length, running time, what to say, on-screen text, notes; prints)
  - `studio/lessons/`: private lesson pages. One page per lesson for each student, first names only. Copy link gives a `/lesson/#...` link with the whole page packed after the `#` (`lesson/codec.js`), so the page is never sent to or stored on the server. A new lesson starts from the last one's list.
- `lesson/`: the page a lesson student opens from that link. Practice-day and item checkmarks stay in the student's browser.
- `assets/logo/`: logo options; the site uses `option-f-notes-badge.svg` and its icon as `favicon.svg`
- `assets/fonts/`: Fredoka (SIL Open Font License), self-hosted so no visitor data goes to Google
- `_headers`: security headers
- `tools/make_logo.py`: regenerates the logo SVGs (`pip install fonttools brotli`, then `python -m fontTools.varLib.instancer assets/fonts/fredoka-latin.woff2 wght=600 -o Fredoka-SemiBold.ttf` and `python tools/make_logo.py Fredoka-SemiBold.ttf assets/logo`)

Later apps each get their own folder (`/pitch-by-pitch/`, `/play/`) so each PWA installs and caches on its own.

## Deploy

The site runs on Cloudflare Workers (static assets), set up in `wrangler.jsonc`, which also attaches `mrwashburnmusic.com` and `www.mrwashburnmusic.com`. Every push to `main` deploys automatically. Files listed in `.assetsignore` are not served.

## Lock the studio

1. Cloudflare dashboard > Zero Trust (free plan, up to 50 users).
2. Access > Applications > Add > Self-hosted.
3. Domain `mrwashburnmusic.com`, path `studio`. The `workers.dev` address is turned off in `wrangler.jsonc`, so the real domain is the only way in.
4. Policy: Allow, Include > Emails > your email. Login method: One-time PIN.

Anyone opening `/studio/` then has to enter a code emailed to you. Nothing in this repo should ever hold passwords or API keys, because the files are public on GitHub and the site.
