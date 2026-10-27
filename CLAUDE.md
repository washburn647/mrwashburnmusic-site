# mrwashburnmusic.com

Static site on Cloudflare Workers (static assets). No build step for the site itself:
every file is served as is, except what `.assetsignore` lists. A push to `main` deploys.
Pull requests get a Cloudflare preview build (`npx wrangler preview`).

## Rules for the whole site

- Never put passwords, API keys or personal data in this repo. It is public, and so is the site.
- `_headers` sets a strict Content-Security-Policy: no inline `<script>`, no external scripts,
  fonts or stylesheets. Self-host anything a page needs.
- `/studio/` is private (Cloudflare Access). Don't link to it from public pages.

## Song Burner (`songburner/`)

A lyric memorization app, served at `/songburner/`. Read `songburner/README.md` first.

- **Edit only `songburner/src/Code.gs`** (plus `host.js`, `backup/`, `sw.js` when the change is
  about the web host). `index.html`, `app.js` and `engine.js` are generated: after any
  `Code.gs` edit run `python tools/build_songburner.py` and commit source and output together.
- Bump `BUILD` near the top of `Code.gs` for every release. The footer shows it.
- Why the app behaves as it does is in `songburner/src/DESIGN.md`. Keep it current.
- Data lives on each device (IndexedDB, via `host.js`), and moves between devices as a backup
  file. Accounts and sync are planned, 13+ only. Don't add a server or logins unless asked.
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
