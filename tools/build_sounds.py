"""Build the shared instrument samples in assets/sounds/ from the source libraries.

  python tools/build_sounds.py VSCO_DIR PIANO_DIR [--only NAME,NAME]

VSCO_DIR   a clone of https://github.com/sgossner/VSCO-2-CE (CC0)
PIANO_DIR  the audio/ folder of the npm package @audio-samples/piano-mp3-velocity10
           (Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0)

Needs ffmpeg and numpy. Every sample is checked with a pitch detector: the file name's
octave is corrected when the source counts octaves differently, and the measured tuning
is kept in the index so the player can correct it (not for the piano, which is
stretch tuned on purpose). A note a semitone off its name is relabelled. Writes one mono mp3 per sample and
assets/sounds/index.json, keeping any voices already listed there.
"""

import glob
import json
import os
import re
import subprocess
import sys

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

# name: label, source, glob, layers (first one present wins per note),
#       seconds kept, release (s, used by the player), even (match loudness across notes)
PITCHED = {
    'piano': ('Piano', 'piano', '*.mp3', [''], None, 0.25, False),
    'violins': ('Violins', 'vsco', 'Strings/Violin Section/susVib/*.wav', ['v2', 'v1'], 4, 0.3, True),
    'violas': ('Violas', 'vsco', 'Strings/Viola Section/susvib/*.wav', ['v2', 'v1'], 4, 0.3, True),
    'cellos': ('Cellos', 'vsco', 'Strings/Cello Section/susvib/*.wav', ['v3', 'v1'], 4, 0.3, True),
    'bass': ('Double bass', 'vsco', 'Strings/Solo Contrabass/SusVib/*.wav', ['v3', 'v1'], 4, 0.3, True),
    'pizzicato': ('Pizzicato strings', 'vsco', 'Strings/Violin Section/Pizz/*rr1.wav', ['v2', 'v1'], 1.5, 0.15, True),
    'cello-pizz': ('Cello pizzicato', 'vsco', 'Strings/Cello Section/pizzT/*RR1.wav', ['v2', 'v1'], 2, 0.15, True),
    'harp': ('Harp', 'vsco', 'Strings/Harp/*.wav', [''], 3.5, 0.3, True),
    'flute': ('Flute', 'vsco', 'Woodwinds/Flute/susNV/*.wav', ['v3', 'v2', 'v1'], 4, 0.15, True),
    'oboe': ('Oboe', 'vsco', 'Woodwinds/Oboe/Sus/*.wav', ['v3', 'v1'], 4, 0.15, True),
    'clarinet': ('Clarinet', 'vsco', 'Woodwinds/Clarinet/susLong/*.wav', ['v2', 'v3', 'v1'], 4, 0.15, True),
    'bassoon': ('Bassoon', 'vsco', 'Woodwinds/Bassoon/sus/*.wav', ['v2', 'v1'], 4, 0.15, True),
    'trumpet': ('Trumpet', 'vsco', 'Brass/Trumpet/sus/*.wav', ['v3', 'v1'], 4, 0.15, True),
    'horn': ('French horn', 'vsco', 'Brass/F Horn/sus/*.wav', ['v2', 'v3', 'v1'], 4, 0.2, True),
    'trombone': ('Trombone', 'vsco', 'Brass/Tenor Trombone/sus/*.wav', ['v2', 'v3', 'v1'], 4, 0.2, True),
    'tuba': ('Tuba', 'vsco', 'Brass/Tuba/sus/*.wav', ['v2', 'v3', 'v1'], 4, 0.2, True),
    'glockenspiel': ('Glockenspiel', 'vsco', 'Percussion/Glock/*.wav', [''], 3, 0.4, True),
    'xylophone': ('Xylophone', 'vsco', 'Percussion/Xylo/*.wav', [''], 1.5, 0.2, True),
    'marimba': ('Marimba', 'vsco', 'Percussion/Marimba/*.wav', [''], 2.5, 0.3, True),
}

# name: label, file in VSCO_DIR, seconds kept
HITS = {
    'claves': ('Claves', 'Percussion/Claves1_Hit_v2_rr1_Sum.wav', 0.6),
    'log-drum-high': ('Log drum (high)', 'Percussion/LogDrumHi_MedM_v2_rr1_Sum.wav', 0.8),
    'log-drum-low': ('Log drum (low)', 'Percussion/LogDrumLo_MedM_v2_rr1_Sum.wav', 0.8),
    'cowbell': ('Cowbell', 'Percussion/Cowbell1_Hit_v2_rr1_Sum.wav', 0.8),
    'agogo': ('Agogo bell', 'VSCO 1 Percussion/varMetal/various/agogoBell_f_1.wav', 1),
    'triangle': ('Triangle', 'Percussion/Triangle3-Hit_v2_rr1_Sum.wav', 3),
    'finger-cymbals': ('Finger cymbals', 'VSCO 1 Percussion/varMetal/various/Fing_Cymb.wav', 2.5),
    'tambourine': ('Tambourine', 'Percussion/Tamb1-Hit_v2_rr1_Sum.wav', 1),
    'sleigh-bells': ('Sleigh bells', 'Percussion/Sleighbells_Hit_v1_rr1_Mid.wav', 1.2),
    'shaker': ('Shaker', "VSCO 1 Percussion/varWood/Camo's Shaker/shake1.wav", 0.5),
    'cabasa': ('Cabasa', 'VSCO 1 Percussion/varMetal/various/cabasa_1.wav', 0.6),
    'guiro': ('Guiro', 'Percussion/Guiro-Hit_v1_rr1_Sum.wav', 0.6),
    'snare': ('Snare drum', 'Percussion/Snare2-HitSN_v5_rr1_Sum.wav', 1),
    'bass-drum': ('Bass drum', 'Percussion/BDrumNewhit_v4_rr1_Sum.wav', 2),
    'conga': ('Conga', 'Percussion/Conga-HitN_v2_rr1_Sum.wav', 1),
    'bongo-high': ('Bongo (high)', 'VSCO 1 Percussion/drums/other/Bongos/HighBongo1.wav', 0.6),
    'bongo-low': ('Bongo (low)', 'VSCO 1 Percussion/drums/other/Bongos/LowBongo1.wav', 0.7),
    'cymbal': ('Crash cymbal', 'Percussion/cymbal-crash1_mf_rr1.wav', 3.5),
}

CREDITS = {
    'piano': 'salamander',
}


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def encode(x, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-codec:a', 'libmp3lame', '-q:a', '5', path],
                   input=x.astype(np.float32).tobytes(), check=True)


def trim(x, seconds):
    """Start just before the onset; keep `seconds`, fading the last part out."""
    peak = np.max(np.abs(x)) or 1
    start = max(0, int(np.argmax(np.abs(x) > peak * 0.02)) - int(0.002 * SR))
    x = x[start:]
    if seconds:
        x = x[:int(seconds * SR)]
    # Drop a silent tail.
    loud = np.nonzero(np.abs(x) > peak * 0.001)[0]
    if len(loud):
        x = x[:loud[-1] + 1]
    fade = min(len(x) // 4, int(0.4 * SR))
    if fade:
        x[-fade:] *= np.linspace(1, 0, fade) ** 2
    x[:16] *= np.linspace(0, 1, 16)
    return x


def pitch(x):
    """Fundamental in Hz (YIN), measured on the steady part of the note."""
    seg = x[int(0.15 * SR):int(0.65 * SR)] if len(x) > 0.7 * SR else x[int(0.02 * SR):int(0.3 * SR)]
    w = 2048
    if len(seg) < 2 * w:
        return None
    lo, hi = int(SR / 4500), int(SR / 25)
    frames = [seg[i:i + 2 * w] for i in range(0, len(seg) - 2 * w, w // 2)][:12]
    taus = []
    for f in frames:
        d = np.array([np.sum((f[:w] - f[t:t + w]) ** 2) for t in range(hi + 1)])
        cm = d[1:] * np.arange(1, hi + 1) / np.maximum(np.cumsum(d[1:]), 1e-12)
        cm = np.concatenate([[1], cm])
        below = np.nonzero(cm[lo:] < 0.15)[0]
        t = lo + (below[0] if len(below) else int(np.argmin(cm[lo:])))
        while t + 1 <= hi and cm[t + 1] < cm[t]:
            t += 1
        if 1 <= t < hi:  # parabolic interpolation
            a, b, c = cm[t - 1], cm[t], cm[t + 1]
            t = t + (a - c) / (2 * (a - 2 * b + c) or 1)
        taus.append(t)
    hz = SR / float(np.median(taus))
    # YIN finds the right note; the strongest spectral peak near it gives the cents.
    win = x[int(0.05 * SR):int(1.05 * SR)]
    win = win * np.hanning(len(win))
    spec = np.abs(np.fft.rfft(win, 8 * len(win)))
    freqs = np.fft.rfftfreq(8 * len(win), 1 / SR)
    near = (freqs > hz * 2 ** (-0.6 / 12)) & (freqs < hz * 2 ** (0.6 / 12))
    return float(freqs[near][np.argmax(spec[near])]) if near.any() else hz


def label_midi(name):
    m = re.search(r'(?<![A-Za-z])([A-G])(#?)(-?\d)(?=[_v.]|$)', name)
    if not m:
        return None
    return 12 * (int(m.group(3)) + 1) + NAMES[m.group(1)] + (1 if m.group(2) else 0)


def build_pitched(name, spec, src):
    label, source, pattern, layers, seconds, release, even = spec
    files = sorted(glob.glob(os.path.join(src[source], pattern)))
    by_note = {}
    for f in files:
        base = os.path.basename(f)
        m = label_midi(base)
        if m is None:
            continue
        rank = next((i for i, l in enumerate(layers) if not l or re.search(rf'_{l}(_|\.|$)', base)), None)
        if rank is not None and (m not in by_note or rank < by_note[m][0]):
            by_note[m] = (rank, f)
    zones = []
    for m, (_, f) in sorted(by_note.items()):
        x = decode(f)
        hz = pitch(x)
        measured = 69 + 12 * np.log2(hz / 440) if hz else None
        zones.append({'labelled': m, 'measured': measured, 'file': f, 'x': x})
    # The octave shift that fits most notes: some sources call middle C "C3".
    shifts = [round((z['measured'] - z['labelled']) / 12) for z in zones if z['measured'] is not None]
    shift = max(set(shifts), key=shifts.count) * 12 if shifts else 0
    out = []
    for z in zones:
        root = z['labelled'] + shift
        tune = 0
        if z['measured'] is not None:
            cents = (z['measured'] - root) * 100
            if abs(cents) >= 50 and abs(cents) < 150:
                # Mislabelled in the source (VSCO's clarinet "F#5" is an F).
                print(f'  {name}: {os.path.basename(z["file"])} measured {z["measured"]:.2f}, relabelled')
                root = int(round(z['measured']))
                cents = (z['measured'] - root) * 100
            if abs(cents) < 50:
                # Pianos are stretch tuned on purpose.
                tune = round(cents) if name != 'piano' else 0
            else:
                print(f'  {name}: {os.path.basename(z["file"])} measured {z["measured"]:.2f}, using {root}')
        x = trim(z['x'], seconds if seconds else max(2, min(7, 7 - (root - 21) * 0.06)))
        z.update(root=root, tune=tune, x=x)
        out.append(z)
    rms = lambda x: np.sqrt(np.mean(x[:int(0.5 * SR)] ** 2)) or 1
    if even:
        target = np.median([rms(z['x']) for z in out])
        for z in out:
            z['x'] *= target / rms(z['x'])
    top = max(np.max(np.abs(z['x'])) for z in out)
    entries = []
    for z in out:
        rel = f'{name}/{z["root"]}.mp3'
        encode(z['x'] * 0.89 / top, os.path.join(OUT, rel))
        entry = {'midi': z['root'], 'file': rel}
        if z['tune']:
            entry['tune'] = z['tune']
        entries.append(entry)
    print(f'{name}: {len(entries)} notes {entries[0]["midi"]}-{entries[-1]["midi"]}, octave shift {shift // 12}')
    inst = {'label': label, 'kind': 'pitched', 'release': release, 'zones': entries,
            'credit': CREDITS.get(name, 'vsco')}
    return inst


def build_hit(name, spec, src):
    label, path, seconds = spec
    x = trim(decode(os.path.join(src['vsco'], path)), seconds)
    rel = f'hits/{name}.mp3'
    encode(x * 0.89 / np.max(np.abs(x)), os.path.join(OUT, rel))
    return {'label': label, 'kind': 'hit', 'file': rel, 'credit': 'vsco'}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    only = None
    if '--only' in sys.argv:
        only = set(sys.argv[sys.argv.index('--only') + 1].split(','))
        args = [a for a in args if a != sys.argv[sys.argv.index('--only') + 1]]
    src = {'vsco': args[0], 'piano': args[1]}
    index_path = os.path.join(OUT, 'index.json')
    index = json.load(open(index_path)) if os.path.exists(index_path) else {}
    instruments = index.get('instruments', {})
    for name, spec in PITCHED.items():
        if not only or name in only:
            instruments[name] = build_pitched(name, spec, src)
    for name, spec in HITS.items():
        if not only or name in only:
            instruments[name] = build_hit(name, spec, src)
    index['instruments'] = instruments
    index.setdefault('voices', {})
    index['credits'] = {
        'salamander': 'Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0',
        'vsco': 'VSCO 2: Community Edition by Versilian Studios (Sam Gossner) and Ivy Audio (Simon Dalzell), CC0',
    }
    with open(index_path, 'w') as f:
        json.dump(index, f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
