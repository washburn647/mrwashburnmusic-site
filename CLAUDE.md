# mrwashburnmusic.com

Static site on Cloudflare Workers (static assets). No build step for the site itself:
every file is served as is, except what `.assetsignore` lists. A push to `main` deploys.
Pull requests get a Cloudflare preview build (`npx wrangler preview`).

## Rules for the whole site

- Never put passwords, API keys or personal data in this repo. It is public, and so is the site.
- `_headers` sets a strict Content-Security-Policy: no inline `<script>`, no external scripts,
  fonts or stylesheets. Self-host anything a page needs.
- `/studio/` is private (Cloudflare Access). Don't link to it from public pages.

## Publishing from the studio

Groove Lab, the game workshop, the voice recorder and the radio stations page have "Publish to
site": Kyle's grooves, game options, voice takes, units and radio stations go straight to the live
site (`/api/live/`, a Durable Object in `worker/index.js`), and the site reads them ahead of the
repo's files. So the repo's `musician-maker/grooves.json`, `games.json`,
`assets/patterns/units.json`, `radio/stations.json` and voice takes can be behind: run `python tools/pull_live.py` first when a change touches them, and commit what it
pulls.

## Song Burner (`songburner/`)

A lyric memorization app, served at `/songburner/`. Read `songburner/README.md` first.

- **Edit only `songburner/src/Code.gs`** (plus `host.js`, `backup/`, `sw.js` when the change is
  about the web host). `index.html`, `app.js` and `engine.js` are generated: after any
  `Code.gs` edit run `python tools/build_songburner.py` and commit source and output together.
- Bump `BUILD` near the top of `Code.gs` for every release. The footer shows it.
- Why the app behaves as it does is in `songburner/src/DESIGN.md`. Keep it current.
- Data lives on each device (IndexedDB, via `host.js`), and moves between devices as a backup
  file, or by cloud sync for closed-beta testers (13+ only): Cloudflare Access sign-in, one
  private Durable Object per tester (`/api/songburner/`), merging in `host.js`. See the README's
  "Cloud sync" section. Don't add other servers or logins unless asked.
- The old copy in Kyle's `Claude Files\songburner-app` folder is retired. This repo is the source.
- Test in a browser before opening a PR: Playwright and Chromium are preinstalled in cloud
  sessions. Serve the repo root with a static server and open `/songburner/`.

## Class (`class/`)

Kyle's classroom slides app, served at `/class/`. Read `class/README.md` first.

- Kyle's decks and pictures (school material, pictures from the web) must never be committed
  here. Test with copies outside the repo.
- Every picture carries a `rights` tag. Anything tagged `classroom` stays in the private app and
  sub view; never publish it on the public site.
- `render.js` is shared by Present mode and thumbnails: check both after changing it.
- Bump `CACHE` in `class/sw.js` when the app's file list changes.
- Sync (`class/sync.js`, `worker/index.js`) keeps Kyle's files in a private R2 bucket behind
  Cloudflare Access. Never make the bucket public or serve its files without the Access check.
  The one exception is the sub view (`/sub/`, `/api/sub/`): only the deck Kyle picks for subs
  (and decks it links into), only with his current code. Keep it that narrow.
