"""Put the avatar shop from the studio's shop editor into the game.

  python tools/add_shop.py shop.json

Checks the file the shop editor's "Download" saves, or what it published (each slot's items
in order with a name, a price in music notes, hidden, and how a prize is won; what runs pay;
a groove's price) and writes it to musician-maker/shop.json, one item per line. Item ids must
be ones the game draws (musician-maker/shop.js); the game reads this file over its catalog.
"""

import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
MM = os.path.join(ROOT, 'musician-maker')
OUT = os.path.join(MM, 'shop.json')
SLOTS = ['kind', 'color', 'pattern', 'face', 'hat', 'glasses', 'neck', 'shoes', 'hold', 'bg']
EARN = {'every': (1, 50), 'clean': (0, 50), 'boss': (0, 50), 'bossTry': (0, 50), 'daily': (0, 50)}


def catalog():
    """Each slot's item ids, and the boss game ids, read from shop.js."""
    src = open(os.path.join(MM, 'shop.js'), encoding='utf-8').read()
    raw = re.search(r'^const RAW = \{(.*?)^\};', src, re.S | re.M).group(1)
    ids = {}
    for slot in SLOTS:
        m = re.search(r'^  ' + slot + r': \[(.*?)\],\n(?=  \w+: \[|$)', raw + '\n', re.S | re.M)
        if not m:
            raise SystemExit(f'shop.js: no {slot} list')
        ids[slot] = re.findall(r"\['([a-z0-9-]+)', ", m.group(1))
    bosses = set(re.findall(r"^  '?([a-z0-9-]+)'?: \{ name: ", re.search(r'export const BOSSES = \{(.*?)\};', src, re.S).group(1), re.M))
    return ids, bosses


def whole(v, lo, hi, what):
    if not isinstance(v, int) or isinstance(v, bool) or not lo <= v <= hi:
        raise SystemExit(f'{what} must be a whole number from {lo} to {hi}')
    return v


def main():
    data = json.load(open(sys.argv[1], encoding='utf-8'))
    items = data.get('items')
    if not isinstance(items, dict):
        raise SystemExit('No items in that file')
    known, bosses = catalog()
    out = {}
    for slot in SLOTS:
        if slot not in items:
            continue
        seen = set()
        out[slot] = []
        for o in items[slot]:
            iid = o.get('id') if isinstance(o, dict) else None
            if iid not in known[slot]:
                raise SystemExit(f'{slot}: no item "{iid}" in the game')
            if iid in seen:
                raise SystemExit(f'{slot}: "{iid}" twice')
            seen.add(iid)
            it = {'id': iid}
            if 'name' in o:
                if not isinstance(o['name'], str) or not o['name'].strip() or len(o['name'].strip()) > 40:
                    raise SystemExit(f'{slot} {iid}: a name of 1 to 40 letters')
                it['name'] = o['name'].strip()
            if 'price' in o:
                it['price'] = whole(o['price'], 0, 999, f'{slot} {iid}: price')
            if o.get('hidden') is True:
                it['hidden'] = True
            if 'unlock' in o:
                u = o['unlock']
                if u is None:
                    it['unlock'] = None
                elif isinstance(u, dict) and u.get('boss') in bosses:
                    it['unlock'] = {'boss': u['boss']}
                elif isinstance(u, dict) and isinstance(u.get('step'), str) and re.fullmatch(r'unit-\d{1,2}:\d{1,2}', u['step']):
                    it['unlock'] = {'step': u['step']}
                elif isinstance(u, dict) and 'level' in u:
                    it['unlock'] = {'level': whole(u['level'], 2, 50, f'{slot} {iid}: level')}
                else:
                    raise SystemExit(f'{slot} {iid}: a prize is won by a boss, a step or a level')
            out[slot].append(it)
    earn = {}
    for k, (lo, hi) in EARN.items():
        if k in (data.get('earn') or {}):
            earn[k] = whole(data['earn'][k], lo, hi, f'earn {k}')
    groove = whole(data.get('groovePrice', 60), 0, 999, 'groovePrice')
    lines = []
    for slot, lst in out.items():
        rows = ',\n'.join('  ' + json.dumps(it, ensure_ascii=False) for it in lst)
        lines.append(f'{json.dumps(slot)}: [\n{rows}\n]')
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{"items": {\n' + ',\n'.join(lines) + '\n},\n"earn": ' + json.dumps(earn) + ',\n"groovePrice": ' + str(groove) + '}\n')
    print(f'Wrote {sum(len(v) for v in out.values())} items to musician-maker/shop.json')


if __name__ == '__main__':
    main()
