"""Put Kyle's groove loops for Musician Maker on the site.

  python tools/add_groove.py <folder>

The folder holds one audio file (wav, aif, flac or mp3) per layer and tempo, named
<layer>-<bpm>, e.g. bass-108.wav. Layers: pulse, bass, drums, horns, band, breakdown.
Each loop must be whole bars of 2/4 at its tempo, to within 15 ms. Encodes each to
assets/sounds/groove/<layer>-<bpm>.mp3 (44.1 kHz stereo) and lists it in
assets/sounds/index.json under "groove". Loops already there stay unless replaced.
Needs ffmpeg and ffprobe.
"""

import json
import os
import re
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'sounds')
LAYERS = ['pulse', 'bass', 'drums', 'horns', 'band', 'breakdown']
NAME = re.compile(r'^(%s)-(\d{2,3})\.(wav|aiff?|flac|mp3)$' % '|'.join(LAYERS), re.I)


def seconds(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def main():
    src = sys.argv[1]
    index_path = os.path.join(OUT, 'index.json')
    index = json.load(open(index_path))
    groove = index.setdefault('groove', {})
    os.makedirs(os.path.join(OUT, 'groove'), exist_ok=True)
    problems = []
    added = 0
    for name in sorted(os.listdir(src)):
        m = NAME.match(name)
        if not m:
            if not name.startswith('.'):
                problems.append(f'{name}: not named like bass-108.wav')
            continue
        layer, bpm = m.group(1).lower(), int(m.group(2))
        path = os.path.join(src, name)
        dur = seconds(path)
        beats = dur * bpm / 60
        whole = round(beats)
        if abs(beats - whole) * 60 / bpm > 0.015 or whole % 2 or whole == 0:
            problems.append(f'{name}: {dur:.3f} s is {beats:.2f} beats at {bpm}; it needs whole bars of 2/4 '
                            f'(e.g. {8 * 60 / bpm:.3f} s for 8 beats)')
            continue
        file = f'groove/{layer}-{bpm}.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-t', f'{whole * 60 / bpm:.6f}', '-ar', '44100', '-ac', '2',
                        '-c:a', 'libmp3lame', '-b:a', '160k', os.path.join(OUT, file)], check=True)
        groove.setdefault(layer, {})[str(bpm)] = {'file': file, 'beats': whole}
        added += 1
        print(f'{layer} at {bpm}: {whole} beats')
    index['groove'] = {k: dict(sorted(groove[k].items(), key=lambda x: int(x[0]))) for k in LAYERS if k in groove}
    with open(index_path, 'w') as f:
        json.dump(index, f, indent=1)
        f.write('\n')
    print(f'{added} loops added')
    for p in problems:
        print('Skipped', p)
    if problems:
        sys.exit(1)


if __name__ == '__main__':
    main()
