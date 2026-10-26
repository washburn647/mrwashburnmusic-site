# Song Burner — setup

One file: `Code.gs`. Everything — server and page — is in it.

**Nothing in the file is tied to a particular person or a particular set of
files.** The app uses whichever Sheet you paste it into, and you point it at
your own songbook from inside the app. Copy `Code.gs`, hand it to anyone, and
their install is theirs.

**This file is the things you do with your hands** — installing it, deploying
it, getting songs in, starting over. Why the app behaves the way it does lives
in [DESIGN.md](DESIGN.md), and how to work on the code is the last chapter of
that file.

---

## Installing

You need a Google account. Everything below happens in the browser, and takes
about ten minutes.

### 1. Make a spreadsheet

[sheets.new](https://sheets.new) — a blank one. Give it a name you will
recognise later; it is where all your songs and scores will live.

**This is the sheet the app will use.** There is no id to copy anywhere: the
script reads whichever sheet it is attached to.

### 2. Paste the code

In that sheet: **Extensions → Apps Script**.

Select everything already in the editor's `Code.gs` and paste this file over
it. **Ctrl-S** to save.

### 3. Turn on the Docs API

In the left sidebar, next to **Services**, click **+**.
Pick **Google Docs API**, leave the identifier as `Docs`, click **Add**.

This is only needed if you want to import songs from a Google Doc. Adding it
now costs nothing and saves you coming back.

### 4. Run `setup`

Pick `setup` from the function dropdown at the top, click **Run**.

Google will ask for permissions, and will warn that the app is unverified.
That is your own script, and the warning is what Google says about any script
that has not been through its review process. Click through
**Advanced → Go to (your project name)**.

It creates four tabs — `Songs`, `Attempts`, `Lists`, `Meta` — plus a **Front
Burner** and a **Back Burner** list, and then prints which spreadsheet it built
them in. Check that name is the one you meant. Safe to re-run.

### 5. Deploy it as a web app

**Deploy → New deployment**. Click the gear next to "Select type" and pick
**Web app**.

- Execute as: **Me**
- Who has access: **Only myself**

Deploy, then copy the **`/exec` URL**. That URL is the app. It is yours alone —
"Only myself" means nobody else can open it even with the link.

### 6. Open it

Paste the URL into a browser. You should get an empty Pantry.

On your phone, open the same URL, then **Share → Add to Home Screen**. It
behaves like an app from there.

---

## Getting songs in

Two ways, and you can use both.

### By hand

**Add** in the bottom bar. Title, artist, and the words. **Search for lyrics**
looks up whatever title and artist you have typed and shows you a preview
before anything lands in the form.

This needs no Google Doc at all.

### From a Google Doc

If you keep your lyrics in a doc already, the app can bulk-import from it.

**Gear → Settings → Songbook**, paste the link to your doc, **Save**. Just copy
the address bar from the doc — the app pulls the id out of it. It opens the
document to check it before saving, so a wrong link is refused there and then
rather than failing during an import.

Then **Import new songs from Doc**.

**The import reads formatting, not text.** It works out what is a title and
what is a chorus from how the paragraphs are styled, so your doc has to follow
these conventions or the import will read it and get it wrong:

| In the doc | Becomes |
|---|---|
| Heading 1 | song title |
| the line under the title | artist |
| `Capo II`, `Intro: …` | song metadata |
| **bold** paragraph | chord line (not quizzed) |
| indented paragraph | chorus |
| centered `Chorus` / `Solo` / `Refrain` | a repeat marker — shown, never typed, not scored |
| empty paragraph | stanza break |

Repeat markers are display-only and excluded from the word count, so accuracy
measures the whole song rather than whichever chorus repeats most.

**Adding songs later**: write them in the doc as always, then hit **Import new
songs from Doc** again. Matching is on normalized title, so **re-ordering or
re-alphabetizing the doc changes nothing** — it only adds titles that are not
already in the Sheet, and never touches songs you have edited in the app.

Renaming a song in the doc will import it as a *new* song, since the title is
the identity. The import reports what it added before you go looking.

**Dry run first, on a long doc.** In the Apps Script editor, run `testParse`.
It reads the doc and reports what it found **without writing anything** — open
**View → Logs**. If the numbers look wrong, stop; nothing has been written.

---

## Updating the app later

Pasting new code is **not** enough. The `/exec` URL keeps serving whatever
version was deployed until you tell it otherwise:

**Deploy → Manage deployments →** pencil icon **→ Version: New version → Deploy**

The build number at the bottom of every screen is how you confirm it took. If
the footer still says the old one, the paste landed but the deployment did not.

---

## Starting over

Gear → **Reset** holds both destructive actions:

- **Clear quiz history** — scores only, songs and lists untouched.
- **Clear all songs** — wipes the library *and* all scores so a doc can be
  re-imported clean after wholesale changes. Lists survive but come back empty.
  Asks twice and makes you type ERASE. Your doc is never touched.

---

## For the curious: what the two constants at the top do

`SHEET_ID` and `DOC_ID` at the top of `Code.gs` are both **blank, and should
stay that way** for a normal install.

- Blank `SHEET_ID` means "the spreadsheet this script is attached to". Fill it
  in only if you deliberately want a script to drive a sheet it does not live
  in.
- Blank `DOC_ID` means "whatever was set in Settings". It is only a fallback
  for an install that wants a songbook baked in before the app is ever opened.

They used to hold real file ids, which made the file unsendable in the most
dangerous way available: the script reached *past* the sheet it was pasted into
and into the one named there. If that sheet happened to be shared with whoever
installed it, setup succeeded, their runs went into someone else's library, and
nothing on screen said so.

## The home-screen icon — parked

`ICON_FILE_ID` is deliberately **blank**, and the favicon is skipped when it is.

The Drive-hosted route was tried and rejected by Apps Script with "file type
not supported", so it is not wired up. The underlying limit is worth recording
so it does not get re-attempted from scratch: the page runs in an iframe Google
serves, and the shortcut icon comes from the *top-level* document
(`script.google.com`), which is not ours. `setFaviconUrl()` is the only hook
Apps Script exposes, it wants a URL it will accept, and even when it takes one,
iOS prefers an `apple-touch-icon` on the top-level page and otherwise falls back
to a screenshot. Short of self-hosting the shell there is no further lever.

Generated icons are in `icons/` (32, 64, 180, 192, 512) if a working host turns
up later. Setting `ICON_FILE_ID` to a URL Apps Script accepts is the only change
needed.

## Two things that cannot be fixed from here

**The "created by a Google Apps Script user" banner.** Not removable. It is
injected into the top-level `script.google.com` page that wraps the app; the
app itself runs in an iframe on a different origin and cannot reach that
document. Any trick to hide it would mean scripting a page we do not control,
which the browser blocks by design. It goes away only by not being an Apps
Script web app.

**A percentage on the import.** The whole import is one `google.script.run`
call — parse the document, diff against the sheet, write the new rows — and
nothing comes back until it is finished, so there is no progress to report
midway. What the app shows instead is honest: a moving bar, a running
seconds counter on the button, and a green Done panel naming exactly what was
added, with a button through to the Library. If it ever stops finishing at all,
that is the document size hitting the six-minute limit, and the fix is to chunk
the write.
