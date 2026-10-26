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

## What is different from the Sheets version

- Songs and scores live on the device, not in a Google Sheet. Backups move them.
- Importing from a Google Doc songbook is not available; adding songs by hand
  and lyrics search are. A library moved in from Sheets keeps its per-song
  links back to the doc.
- Fonts are self-hosted, so nothing calls Google.
