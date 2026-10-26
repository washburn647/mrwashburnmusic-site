# -*- coding: utf-8 -*-
"""
Build the web copy of Song Burner from songburner/src/Code.gs.

    python tools/build_songburner.py

Code.gs stays the one source of truth, and still pastes into Apps Script as is.
This splits it into what a static site serves:

    songburner/index.html   the page, with its script moved out (the site's
                            Content-Security-Policy blocks inline scripts) and
                            Google Fonts swapped for the self-hosted copies
    songburner/app.js       the page's script, byte for byte
    songburner/engine.js    the server half, wrapped as a factory so every call
                            gets a fresh scope, the way Apps Script runs it

host.js (hand written) stands in for the Sheet and for google.script.run.
Edit Code.gs, run this, commit all of it. Never edit the generated files.
"""
import io, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'songburner', 'src', 'Code.gs')
OUT = os.path.join(ROOT, 'songburner')

src = io.open(SRC, encoding='utf-8', newline='').read().replace('\r\n', '\n')

m = re.search(r'^var PAGE = `', src, re.M)
assert m, 'no PAGE literal in Code.gs'
# The literal ends where the statement ends, not at the first backtick.
page_end = src.rindex('`;')
page = src[m.end():page_end]
server = src[:m.start()]

# PAGE is a template literal; check.py forbids escapes and ${} in it, and so
# does this, because a raw slice would otherwise differ from what JS builds.
assert '\\' not in page, 'backslash inside PAGE - run tools/check.py'
assert '${' not in page, 'template substitution inside PAGE'

build = re.search(r"^var BUILD\s*=\s*'([^']*)'", server, re.M).group(1)

# ---- page: pull the one inline script out ----------------------------------
scripts = list(re.finditer(r'<script>\n?(.*?)</script>', page, re.S))
assert len(scripts) == 1, 'expected exactly one inline <script> in PAGE, found %d' % len(scripts)
app_js = scripts[0].group(1)
page = page[:scripts[0].start()] + (
    '<script src="host.js"></script>\n'
    '<script src="engine.js"></script>\n'
    '<script src="app.js"></script>'
) + page[scripts[0].end():]

# ---- page: what changes when it is not inside script.google.com ------------
# Every patch must match exactly once, so a change to Code.gs that moves one of
# these breaks the build loudly instead of shipping a half-patched page.
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono'
         ':wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">')
HEAD_EXTRA = (
    '<link rel="stylesheet" href="fonts.css">\n'
    '<link rel="manifest" href="manifest.webmanifest">\n'
    '<link rel="icon" href="icons/icon-32.png" sizes="32x32" type="image/png">\n'
    '<link rel="icon" href="icons/icon-192.png" sizes="192x192" type="image/png">\n'
    '<link rel="apple-touch-icon" href="icons/icon-180.png">\n'
    '<meta name="description" content="Learn song lyrics by heart, one burner at a time.">')
PATCHES = [
    ('page', FONTS, HEAD_EXTRA),
    # Settings links "the data sheet"; on the web that is the backup page
    # (host.js hands it out as the sheet URL).
    ('app', 'Open the data sheet', 'Back up or move your data'),
]
for where, old, new in PATCHES:
    text = page if where == 'page' else app_js
    n = text.count(old)
    assert n == 1, 'patch %r matched %d times in %s' % (old[:40], n, where)
    text = text.replace(old, new)
    if where == 'page':
        page = text
    else:
        app_js = text

page = page.lstrip('\n')
page = page.replace('<!DOCTYPE html>\n', '<!DOCTYPE html>\n<!-- GENERATED from src/Code.gs by '
                    'tools/build_songburner.py. Do not edit. -->\n', 1)

# ---- server half: a factory, one fresh scope per call ----------------------
SERVICES = ['SpreadsheetApp', 'LockService', 'UrlFetchApp', 'DocumentApp', 'Docs',
            'Logger', 'HtmlService']
engine = (
    '/* GENERATED from src/Code.gs by tools/build_songburner.py. Do not edit.\n'
    '   The server half of Song Burner %s. host.js calls this once per request with\n'
    '   its stand-ins for the Apps Script services. */\n'
    'window.SongBurnerEngine = function (services) {\n'
    '%s\n'
    '\n'
    '/* ---- end of Code.gs server half ---- */\n'
    'return { apiCall: apiCall, setup: setup, BUILD: BUILD };\n'
    '};\n'
) % (build,
     ''.join('var %s = services.%s;\n' % (s, s) for s in SERVICES) + server.rstrip('\n'))

app = ('/* GENERATED from src/Code.gs by tools/build_songburner.py. Do not edit. */\n'
       + app_js.lstrip('\n'))

def write(name, text):
    with io.open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)

write('index.html', page)
write('app.js', app)
write('engine.js', engine)
print('Song Burner %s: index.html %d KB, app.js %d KB, engine.js %d KB' % (
    build, len(page.encode('utf-8')) // 1024, len(app.encode('utf-8')) // 1024,
    len(engine.encode('utf-8')) // 1024))
