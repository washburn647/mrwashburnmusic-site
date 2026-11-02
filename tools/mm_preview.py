"""Copy Musician Maker and the site assets it uses into one folder that works on its own,
for a private Claude Artifact preview (publish every file in it, index.html at the root).
Absolute /assets/ paths become relative. The mic is blocked inside artifacts; tapping works.

    python tools/mm_preview.py [out_dir]     (default .mm-preview, git-ignored)
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / '.mm-preview'))
# Sounds: only what sound.js loads (HITS, PITCHED, takes), to stay under 256 files.
SOUNDS = ['index.json', 'samples.js', 'hits', 'bass', 'horn', 'marimba', 'trombone', 'takes']
ASSETS = ['patterns', 'fonts/fredoka-latin.woff2', 'vendor/vexflow'] + [f'sounds/{s}' for s in SOUNDS]

shutil.rmtree(OUT, ignore_errors=True)
OUT.mkdir(parents=True)
for f in (ROOT / 'musician-maker').iterdir():
    if f.is_file() and f.suffix in ('.html', '.js', '.css'):
        text = f.read_text().replace("'/assets/", "'./assets/").replace('"/assets/', '"./assets/')
        text = text.replace('<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n', '')
        (OUT / f.name).write_text(text)
for a in ASSETS:
    src = ROOT / 'assets' / a
    dst = OUT / 'assets' / a
    if not src.exists():
        continue
    if src.is_dir():
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns('*.md', '*.txt', '*.py'))
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, dst)

files = [{'as': p.relative_to(OUT).as_posix(), 'path': str(p)} for p in sorted(OUT.rglob('*')) if p.is_file()]
(OUT.parent / f'{OUT.name}-files.json').write_text(json.dumps(files))
print(f'{len(files)} files in {OUT}; list in {OUT.parent / (OUT.name + "-files.json")}')
