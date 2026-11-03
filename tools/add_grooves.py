"""Put grooves from the studio's Groove Lab into Musician Maker.

  python tools/add_grooves.py grooves.json

Checks the file Groove Lab's "Save for site" downloads (every groove has an id and a 2/4 and/or
6/8 version, each with whole beats, known layers, and notes inside the loop on sounds in assets/sounds/index.json;
variations of a layer each with a chance from 0 to 1; layer names and icons) and writes it to
musician-maker/grooves.json, one groove per line. It replaces the grooves there: the Lab keeps
them all and saves them all.
"""

import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'musician-maker', 'grooves.json')
LAYERS = ['pulse', 'bass', 'drums', 'horns', 'band', 'breakdown']
STEPS_PER_BEAT = {'2/4': 4, '6/8': 6}  # 16ths of a quarter, or of a dotted quarter


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
        info = g.get('layerInfo', {})
        if not isinstance(info, dict) or set(info) - set(LAYERS):
            raise SystemExit(f'{name}: layerInfo names an unknown layer')
        versions = g.get('versions')
        if not isinstance(versions, dict) or not versions or set(versions) - set(STEPS_PER_BEAT):
            raise SystemExit(f'{name}: needs a 2/4 and/or a 6/8 version')
        for meter, v in versions.items():
            if v.get('beats') not in (8, 16):
                raise SystemExit(f'{name} {meter}: beats must be 8 or 16')
            if set(v.get('layers', {})) - set(LAYERS):
                raise SystemExit(f'{name} {meter}: unknown layer {set(v["layers"]) - set(LAYERS)}')
            steps = v['beats'] * STEPS_PER_BEAT[meter]

            def check(where, tracks):
                for t in tracks:
                    spec = sounds.get(t.get('inst'))
                    if not spec:
                        raise SystemExit(f'{where}: no sound "{t.get("inst")}"')
                    for n in t.get('notes', []):
                        if not (isinstance(n.get('s'), int) and 0 <= n['s'] < steps):
                            raise SystemExit(f'{where}: a note outside the loop')
                        if spec['kind'] != 'hit' and not isinstance(n.get('m'), int):
                            raise SystemExit(f'{where}: a {t["inst"]} note without a pitch')
            for layer, tracks in v['layers'].items():
                check(f'{name} {meter} {layer}', tracks)
            variants = v.get('variants', {})
            if set(variants) - set(LAYERS):
                raise SystemExit(f'{name} {meter}: variations of unknown layer {set(variants) - set(LAYERS)}')
            for layer, vs in variants.items():
                for k, x in enumerate(vs, 1):
                    if not (isinstance(x.get('chance'), (int, float)) and 0 <= x['chance'] <= 1):
                        raise SystemExit(f'{name} {meter} {layer} variation {k}: chance must be 0 to 1')
                    check(f'{name} {meter} {layer} variation {k}', x.get('tracks', []))
            notes = sum(len(t.get('notes', [])) for ts in v['layers'].values() for t in ts)
            nvar = sum(len(vs) for vs in variants.values())
            print(f'{name} {meter}: {v["beats"]} beats, {notes} notes' + (f', {nvar} variations' if nvar else ''))
    with open(OUT, 'w') as f:
        f.write('{"grooves":[\n' + ',\n'.join(json.dumps(g, separators=(',', ':'), ensure_ascii=False) for g in grooves) + '\n]}\n')
    print(f'{len(grooves)} grooves written to musician-maker/grooves.json')


if __name__ == '__main__':
    main()
