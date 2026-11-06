# Song Burner on mrwashburnmusic.com

Served at `/songburner/`. Installable on phones (Share > Add to Home Screen, or
the browser's Install button) and works offline once it has loaded once.

## Where the code lives

- `src/Code.gs` is the app, the same single file that pastes into Apps Script.
  **Edit this one.** `src/DESIGN.md` and `src/SETUP.md` are its notes.
- `index.html`, `app.js`, `engine.js` are **generated** from it. After any edit:

      python tools/build_songburner.py

  then commit the source and the generated files together.
- `host.js` stands in for Google: a small SpreadsheetApp that keeps the four
  tabs (Songs, Attempts, Lists, Meta) in this browser's IndexedDB, and a
  `google.script.run` that runs the server half of Code.gs right in the page.
  Because of this the server code runs unchanged.
- `backup/` is the "Your data" page: download a backup, restore one, or move in
  from the Google Sheets version (File > Download > Microsoft Excel, then
  choose the .xlsx).
- `sw.js` keeps an offline copy of the app (not the data).
- `account/` is where Sign in lands, behind Cloudflare Access. The Worker
  answers it too: a valid Access login there gets a 30-day session cookie of
  the site's own (`sb_session`, sent only to `/api/songburner/`). The cloud copy
  itself is `/api/songburner/` in `worker/index.js` (the Vault Durable Object),
  which reads that cookie, and the merging is in `host.js`.

## What is different from the Sheets version

- Songs and scores live on the device, not in a Google Sheet. Backups move them,
  and so does cloud sync for beta testers who sign in.
- Importing from a Google Doc songbook is not available; adding songs by hand
  and lyrics search are. A library moved in from Sheets keeps its per-song
  links back to the doc.
- Fonts are self-hosted, so nothing calls Google.

## Cloud sync (closed beta)

Testers sign in with Cloudflare Access (a code emailed to them), and their
library is kept in one private Durable Object each, named by a hash of their
email. The app stays public and works offline; only the account part sits
behind Access. The free Zero Trust plan allows 50 users, and Kyle's own studio
sign-in is one of them. Beta testers are 13 and up.

Switching it on, once, in the Cloudflare dashboard (Zero Trust; menu names as of
November 2026):

1. **Integrations > Identity providers > Add new identity provider >
   One-time PIN**, so testers sign in with an emailed code and need no account.
2. **Access controls > Applications > Create new application > Self-hosted and
   private > Add public hostname**: `mrwashburnmusic.com`, path
   `songburner/account`. Name it *Song Burner beta*. Only that path: the API
   must stay outside Access, because every Access application on the domain
   shares one login cookie and the studio's would get in the way (fixed in
   beta 1.01; the API checks the site's own session cookie instead).
3. Under **Access policies**, create an **Allow** policy that includes
   **Emails** and lists the testers. Inviting someone later is adding their
   address here. Login method: One-time PIN. Session duration: 1 month.
4. **Edit > Additional settings**: copy the **Application Audience (AUD) Tag**
   into `SONGBURNER_AUD` in `wrangler.jsonc` and deploy. It is not a secret.
   Until it is set, the Account card stays hidden and `/api/songburner/`
   answers 503.
5. Optional, to keep seats free: turn on seat expiration (Team & Resources >
   Users), so testers who stop using it give their seat back after a month.

Removing a tester: take their address off the policy, then remove them under
**Team & Resources > Users** to free the seat.
