"""Put grooves from the studio's Groove Lab into Musician Maker.

  python tools/add_grooves.py grooves.json

Checks the file Groove Lab's "Save for site" downloads (every groove has an id, whole beats,
known layers, and notes inside the loop on sounds in assets/sounds/index.json) and writes it to
musician-maker/grooves.json, one groove per line. It replaces the grooves there: the Lab keeps
them all and saves them all.
"""

import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'musician-maker', 'grooves.json')
LAYERS = ['pulse', 'bass', 'drums', 'horns', 'band', 'breakdown']
STEPS_PER_BEAT = 4


def main():
    data = json.load(open(sys.argv[1]))
    sounds = json.load(open(os.path.join(ROOT, 'assets', 'sounds', 'index.json')))['instruments']
    grooves = data.get('grooves')
    if not isinstance(grooves, list) or not grooves:
        raise SystemExit('No grooves in that file')
    ids = set()
    for g in grooves:
        name = g.get('name', g.get('id'))
        if not isinstance(g.get('id'), str) or g['id'] in ids:
            raise SystemExit(f'{name}: missing or repeated id')
        ids.add(g['id'])
        if g.get('beats') not in (8, 16):
            raise SystemExit(f'{name}: beats must be 8 or 16')
        if set(g.get('layers', {})) - set(LAYERS):
            raise SystemExit(f'{name}: unknown layer {set(g["layers"]) - set(LAYERS)}')
        steps = g['beats'] * STEPS_PER_BEAT
        for layer, tracks in g['layers'].items():
            for t in tracks:
                spec = sounds.get(t.get('inst'))
                if not spec:
                    raise SystemExit(f'{name} {layer}: no sound "{t.get("inst")}"')
                for n in t.get('notes', []):
                    if not (isinstance(n.get('s'), int) and 0 <= n['s'] < steps):
                        raise SystemExit(f'{name} {layer}: a note outside the loop')
                    if spec['kind'] != 'hit' and not isinstance(n.get('m'), int):
                        raise SystemExit(f'{name} {layer}: a {t["inst"]} note without a pitch')
        notes = sum(len(t.get('notes', [])) for ts in g['layers'].values() for t in ts)
        print(f'{name}: {g["beats"]} beats, {notes} notes')
    with open(OUT, 'w') as f:
        f.write('{"grooves":[\n' + ',\n'.join(json.dumps(g, separators=(',', ':'), ensure_ascii=False) for g in grooves) + '\n]}\n')
    print(f'{len(grooves)} grooves written to musician-maker/grooves.json')


if __name__ == '__main__':
    main()
