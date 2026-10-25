# mrwashburnmusic.com

Static site for Mr. Washburn Music. No build step: every file here is served as is.

## Layout

- `index.html`: the public coming soon page
- `studio/`: private behind-the-scenes tools (locked with Cloudflare Access, see below)
- `assets/logo/`: logo files (`logo-stacked.svg`, `option-a-ligature.svg`, `icon.svg`)
- `assets/fonts/`: Fredoka (SIL Open Font License), self-hosted so no visitor data goes to Google
- `_headers`: security headers for Cloudflare Pages
- `tools/make_logo.py`: regenerates the logo SVGs (`pip install fonttools`, then `python tools/make_logo.py Fredoka-SemiBold.ttf assets/logo`)

Later apps each get their own folder (`/songburner/`, `/pitch-by-pitch/`, `/play/`, `/class/`) so each PWA installs and caches on its own.

## Deploy on Cloudflare Pages

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git, pick the repo.
3. Framework preset: None. Build command: empty. Output directory: `/`.
4. After the first deploy, open the project > Custom domains, and add `mrwashburnmusic.com` and `www.mrwashburnmusic.com`.

## Lock the studio

1. Cloudflare dashboard > Zero Trust (free plan, up to 50 users).
2. Access > Applications > Add > Self-hosted.
3. Domain `mrwashburnmusic.com`, path `studio`. Add the same app for the `*.pages.dev` preview address.
4. Policy: Allow, Include > Emails > your email. Login method: One-time PIN.

Anyone opening `/studio/` then has to enter a code emailed to you. Nothing in this repo should ever hold passwords or API keys, because the files are public on GitHub and the site.
