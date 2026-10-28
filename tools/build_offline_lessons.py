"""Builds an offline copy of the lesson tools: a folder that opens straight
from disk (double-click), with no server or internet needed.

    python tools/build_offline_lessons.py OUT_FOLDER

Browsers don't run ES modules from file://, so each page's modules are
joined into one classic script. lesson/paths.js is swapped for paths next
to the HTML files. Copy link still gives a mrwashburnmusic.com/lesson/ link.
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

OFFLINE_PATHS = """
export const OSMD_SRC = 'vendor/opensheetmusicdisplay.min.js';
export const QR_SRC = 'vendor/qrcode.js';
export const LOGO = 'logo.svg';
export const LESSON_PAGE = 'https://mrwashburnmusic.com/lesson/';
export const LOCAL_PAGE = 'lesson.html';
export const STUDIO_HOME = '';
"""

IMPORT = re.compile(r"^import\s+(.+?)\s+from\s+'([^']+)';\s*$", re.M)
EXPORT = re.compile(r"^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)", re.M)


def resolve(spec, importer):
    if spec.startswith('/'):
        return (ROOT / spec.lstrip('/')).resolve()
    return (importer.parent / spec).resolve()


def bundle(entry):
    order, seen = [], set()

    def visit(path):
        if path in seen:
            return
        seen.add(path)
        src = OFFLINE_PATHS if path == ROOT / 'lesson' / 'paths.js' else path.read_text(encoding='utf-8')
        for _, spec in IMPORT.findall(src):
            visit(resolve(spec, path))
        order.append((path, src))

    visit(entry.resolve())
    names = {p: f'__m{i}' for i, (p, _) in enumerate(order)}
    out = ['/* Built by tools/build_offline_lessons.py. Edit the sources in the repo. */', '(() => {', "'use strict';"]
    for path, src in order:
        lines = []
        for what, spec in IMPORT.findall(src):
            mod = names[resolve(spec, path)]
            if what.startswith('* as '):
                lines.append(f'const {what[5:].strip()} = {mod};')
            else:
                parts = [x.strip() for x in what.strip('{} ').split(',') if x.strip()]
                lines.append('const { ' + ', '.join(p.replace(' as ', ': ') for p in parts) + f' }} = {mod};')
        body = IMPORT.sub('', src)
        exported = EXPORT.findall(body)
        body = re.sub(r'^export\s+', '', body, flags=re.M)
        if re.search(r'^\s*export\b', body, re.M) or 'import(' in body:
            sys.exit(f'{path}: unsupported import/export form')
        rel = path.relative_to(ROOT) if path.is_relative_to(ROOT) else 'paths.js (offline)'
        out.append(f'\n/* ---- {rel} ---- */')
        out.append(f'const {names[path]} = (() => {{')
        out.extend(lines)
        out.append(body)
        out.append(f"return {{ {', '.join(exported)} }};")
        out.append('})();')
    out.append('})();')
    return '\n'.join(out)


def page(title, css, script, body):
    links = '\n  '.join(f'<link rel="stylesheet" href="{c}">' for c in css)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <link rel="icon" href="logo.svg" type="image/svg+xml">
  {links}
</head>
<body>
  {body}
  <script src="{script}"></script>
</body>
</html>
"""


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = Path(sys.argv[1])
    if out.exists():
        shutil.rmtree(out)
    (out / 'vendor').mkdir(parents=True)
    (out / 'fonts').mkdir()
    for f in ['opensheetmusicdisplay.min.js', 'LICENSE-opensheetmusicdisplay.txt', 'qrcode.js']:
        shutil.copy(ROOT / 'lesson' / 'vendor' / f, out / 'vendor' / f)
    shutil.copy(ROOT / 'assets' / 'fonts' / 'fredoka-latin.woff2', out / 'fonts')
    shutil.copy(ROOT / 'assets' / 'logo' / 'option-f-notes-badge-icon.svg', out / 'logo.svg')
    for src, name in [('studio/tools.css', 'tools.css'), ('studio/lessons/lessons.css', 'lessons.css'),
                      ('lesson/lesson.css', 'lesson.css'), ('lesson/player.css', 'player.css')]:
        css = (ROOT / src).read_text(encoding='utf-8').replace('/assets/fonts/', 'fonts/')
        (out / name).write_text(css, encoding='utf-8')
    (out / 'studio.js').write_text(bundle(ROOT / 'studio' / 'lessons' / 'lessons.js'), encoding='utf-8')
    (out / 'lesson.js').write_text(bundle(ROOT / 'lesson' / 'lesson.js'), encoding='utf-8')
    (out / 'Lesson pages.html').write_text(page('Lesson pages', ['tools.css', 'lessons.css', 'player.css'], 'studio.js', '<main id="app"></main>'), encoding='utf-8')
    (out / 'lesson.html').write_text(page('Lesson', ['lesson.css', 'player.css'], 'lesson.js', '<main id="page"></main>'), encoding='utf-8')
    shutil.copy(ROOT / 'tools' / 'offline_lessons_README.txt', out / 'README.txt')
    print(f'Built {out}')


if __name__ == '__main__':
    main()
