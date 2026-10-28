"""Put voice takes from the studio's voice recorder on the site.

  python tools/add_takes.py voice-kyle-2026-10-28.zip

Unpacks the zip's mp3s into assets/sounds/voice/<voice>/ and lists them in
assets/sounds/index.json, replacing that voice's earlier list (the zip holds every take
the recorder has, so takes deleted there go here too).
"""

import json
import os
import shutil
import sys
import zipfile

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')


def main():
    with zipfile.ZipFile(sys.argv[1]) as z:
        name = next(n for n in z.namelist() if n.endswith('/takes.json'))
        data = json.loads(z.read(name))
        voice = data['voice']
        folder = os.path.join(OUT, 'voice', voice)
        shutil.rmtree(folder, ignore_errors=True)
        os.makedirs(folder)
        patterns = {}
        for text, takes in data['patterns'].items():
            if not takes:
                continue
            patterns[text] = []
            for t in takes:
                if not t['file'].startswith(f'voice/{voice}/') or '..' in t['file']:
                    raise SystemExit(f'Unexpected file name {t["file"]}')
                with open(os.path.join(OUT, t['file']), 'wb') as f:
                    f.write(z.read(t['file']))
                patterns[text].append({'file': t['file'], 'bpm': t['bpm']})
    index_path = os.path.join(OUT, 'index.json')
    index = json.load(open(index_path))
    index.setdefault('voices', {})[voice] = {'label': data.get('label', voice), 'patterns': patterns}
    with open(index_path, 'w') as f:
        json.dump(index, f, indent=1)
        f.write('\n')
    print(f'{voice}: {len(patterns)} patterns, {sum(len(t) for t in patterns.values())} takes')


if __name__ == '__main__':
    main()
