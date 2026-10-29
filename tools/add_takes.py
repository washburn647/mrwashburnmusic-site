"""Put voice takes from the studio's voice recorder on the site.

  python tools/add_takes.py voice-kyle.zip

Unpacks the zip's mp3s into assets/sounds/voice/<voice>/ and lists them in
assets/sounds/index.json by pattern id (see assets/patterns/patterns.js), replacing that
voice's earlier list: the zip holds every take the recorder has, so takes deleted there go
here too. The recorder's units (patterns kept, familiar or unfamiliar) go in
assets/patterns/units.json.
"""

import json
import os
import re
import shutil
import sys
import zipfile

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'sounds')
UNITS = os.path.join(ROOT, 'assets', 'patterns', 'units.json')
SAFE = re.compile(r'^voice/[a-z0-9]+/(rhythm|tonal)/[a-z0-9/-]+/[a-z]+(-[A-G][bs]?)?-\d+\.mp3$')


def main():
    with zipfile.ZipFile(sys.argv[1]) as z:
        name = next(n for n in z.namelist() if n.endswith('/takes.json'))
        data = json.loads(z.read(name))
        voice = data['voice']
        folder = os.path.join(OUT, 'voice', voice)
        shutil.rmtree(folder, ignore_errors=True)
        patterns = {}
        for t in data['takes']:
            if not SAFE.match(t['file']) or not t['file'].startswith(f'voice/{voice}/'):
                raise SystemExit(f'Unexpected file name {t["file"]}')
            path = os.path.join(OUT, t['file'])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'wb') as f:
                f.write(z.read(t['file']))
            entry = {'file': t['file'], 'speed': t['speed'], 'bpm': t['bpm']}
            if t.get('key') is not None:
                entry['key'] = t['key']
            patterns.setdefault(t['pattern'], []).append(entry)
    index_path = os.path.join(OUT, 'index.json')
    index = json.load(open(index_path))
    index.setdefault('voices', {})[voice] = {'label': data.get('label', voice), 'patterns': dict(sorted(patterns.items()))}
    with open(index_path, 'w') as f:
        json.dump(index, f, indent=1)
        f.write('\n')
    print(f'{voice}: {len(patterns)} patterns, {sum(len(t) for t in patterns.values())} takes')
    units = data.get('units')
    if units:
        if not all(isinstance(u, dict) and isinstance(u.get('id'), str) for u in units):
            raise SystemExit('Unexpected units in takes.json')
        with open(UNITS, 'w') as f:
            json.dump({'units': units}, f, indent=1, ensure_ascii=False)
            f.write('\n')
        print(f'{len(units)} units')


if __name__ == '__main__':
    main()
