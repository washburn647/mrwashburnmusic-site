"""Copy what Kyle published from the studio back into the repo.

  python tools/pull_live.py [https://mrwashburnmusic.com]

Groove Lab's, the game workshop's and the voice recorder's "Publish to site" put grooves,
game options, voice takes and units
on the live site (/api/live/, see worker/index.js), and the site plays those ahead of the
repo's files. This brings the repo up to date with them, so a later change starts from what
is live and the repo stays a full copy:
  - grooves → musician-maker/grooves.json (checked by tools/add_grooves.py)
  - game options → musician-maker/games.json (checked by tools/add_games.py)
  - each voice's takes → assets/sounds/voice/<voice>/<take id>.mp3, listed in index.json
  - units → assets/patterns/units.json
Anything not published is left as it is.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..')
SOUNDS = os.path.join(ROOT, 'assets', 'sounds')
VOICES = ['kyle']
FILE = re.compile(r'^/api/live/voice/([a-z0-9]+)/([0-9a-f-]{8,40})\.mp3$')


def get(base, path):
    req = urllib.request.Request(base + path, headers={'User-Agent': 'mrwashburnmusic-site pull_live'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def main():
    base = (sys.argv[1] if len(sys.argv) > 1 else 'https://mrwashburnmusic.com').rstrip('/')

    for name, tool in (('grooves', 'add_grooves.py'), ('games', 'add_games.py')):
        data = get(base, f'/api/live/{name}.json')
        if not data:
            print(f'{name}: none published')
            continue
        with tempfile.NamedTemporaryFile('wb', suffix='.json', delete=False) as f:
            f.write(data)
        try:
            subprocess.run([sys.executable, os.path.join(ROOT, 'tools', tool), f.name], check=True)
        finally:
            os.unlink(f.name)

    units = get(base, '/api/live/units.json')
    if units:
        data = json.loads(units)
        with open(os.path.join(ROOT, 'assets', 'patterns', 'units.json'), 'w') as f:
            json.dump({'units': data['units']}, f, indent=1, ensure_ascii=False)
            f.write('\n')
        print(f'{len(data["units"])} units')
    else:
        print('units: none published')

    index_path = os.path.join(SOUNDS, 'index.json')
    index = json.load(open(index_path))
    for voice in VOICES:
        spec = get(base, f'/api/live/voice/{voice}.json')
        if not spec:
            print(f'{voice}: no takes published')
            continue
        spec = json.loads(spec)
        folder = os.path.join(SOUNDS, 'voice', voice)
        fresh = folder + '.new'
        shutil.rmtree(fresh, ignore_errors=True)
        os.makedirs(fresh)
        count = 0
        for group in ('patterns', 'cues'):
            for options in spec.get(group, {}).values():
                for o in options:
                    m = FILE.match(o['file'])
                    if not m or m.group(1) != voice:
                        raise SystemExit(f'Unexpected file {o["file"]}')
                    data = get(base, o['file'])
                    if data is None:
                        raise SystemExit(f'Missing {o["file"]}')
                    with open(os.path.join(fresh, m.group(2) + '.mp3'), 'wb') as f:
                        f.write(data)
                    o['file'] = f'voice/{voice}/{m.group(2)}.mp3'
                    count += 1
        shutil.rmtree(folder, ignore_errors=True)
        os.rename(fresh, folder)
        index.setdefault('voices', {})[voice] = {
            'label': spec.get('label', voice),
            'patterns': dict(sorted(spec.get('patterns', {}).items())),
            'cues': dict(sorted(spec.get('cues', {}).items())),
        }
        print(f'{voice}: {len(spec.get("patterns", {}))} patterns, {count} takes')
    with open(index_path, 'w') as f:
        json.dump(index, f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
