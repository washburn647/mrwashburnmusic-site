"""Put game options from the studio's Musician Maker game workshop into the game.

  python tools/add_games.py games.json

Checks the file the workshop's "Save for site" downloads (each game a known id, with stream
and boss on or off, lists of win and fail gags, and a tap sound the game loads) and writes it
to musician-maker/games.json, one game per line. At least one game must stay in the stream.
"""

import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
MM = os.path.join(ROOT, 'musician-maker')
OUT = os.path.join(MM, 'games.json')


def known_games():
    """Game ids and their gags, read from the scene files."""
    games = {}
    for name in sorted(os.listdir(MM)):
        if not (name.startswith('scene-') and name.endswith('.js')):
            continue
        src = open(os.path.join(MM, name), encoding='utf-8').read()
        m = re.search(r"^\s*id: '([a-z0-9-]+)',", src, re.M)
        if not m:
            continue
        gags = {}
        for kind in ('win', 'fail'):
            g = re.search(r'^\s*' + kind + r': \{(.*)\},?$', src, re.M)
            gags[kind] = set(re.findall(r'(\w+): ', g.group(1))) if g else set()
        games[m.group(1)] = gags
    return games


def main():
    data = json.load(open(sys.argv[1], encoding='utf-8'))
    games = data.get('games')
    if not isinstance(games, dict) or not games:
        raise SystemExit('No games in that file')
    known = known_games()
    src = open(os.path.join(MM, 'sound.js'), encoding='utf-8').read()
    taps = set(re.findall(r"'([a-z0-9-]+)'", re.search(r'export const HITS = \[(.*?)\];', src, re.S).group(1)))
    for gid, o in games.items():
        if gid not in known:
            raise SystemExit(f'{gid}: no game with that id')
        for key in ('stream', 'boss'):
            if not isinstance(o.get(key), bool):
                raise SystemExit(f'{gid}: {key} must be true or false')
        for kind in ('win', 'fail'):
            gags = o.get(kind)
            if not isinstance(gags, list) or not gags:
                raise SystemExit(f'{gid}: {kind} needs at least one gag')
            if known[gid][kind] and set(gags) - known[gid][kind]:
                raise SystemExit(f'{gid}: unknown {kind} gag {sorted(set(gags) - known[gid][kind])}')
        if o.get('tap') not in taps:
            raise SystemExit(f'{gid}: no tap sound "{o.get("tap")}"')
    if not any(o['stream'] for o in games.values()):
        raise SystemExit('At least one game has to stay in the stream')
    lines = ',\n'.join(f'  {json.dumps(gid)}: {json.dumps(o, ensure_ascii=False)}' for gid, o in games.items())
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('{"games": {\n' + lines + '\n}}\n')
    print(f'Wrote {len(games)} game(s) to musician-maker/games.json')


if __name__ == '__main__':
    main()
