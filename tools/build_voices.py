"""Make the spoken syllable clips in assets/sounds/voice/ with Kokoro text-to-speech.

  pip install kokoro-onnx soundfile
  python tools/build_voices.py KOKORO_DIR

KOKORO_DIR holds kokoro-v1.0.onnx and voices-v1.0.bin from
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0 (Apache 2.0).
Each syllable is spoken on its own, so a page can place it on any beat, pitch or speed.
Needs ffmpeg. Adds the voices to assets/sounds/index.json, with each clip's measured
speaking pitch, so a page can shift a syllable onto a note.
"""

import json
import os
import subprocess
import sys

import numpy as np
from kokoro_onnx import Kokoro

from build_sounds import SR, decode, pitch

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')

VOICES = {
    'af_heart': 'Voice 1',
    'af_bella': 'Voice 2',
    'am_michael': 'Voice 3',
    'bm_george': 'Voice 4',
}

# Kokoro phonemes (misaki: A = "ay", O = "oh"). Rhythm syllables are Feierabend's
# (du, du-de, du-ta-de-ta; du-da-di, du-ta-da-ta-di-ta); tonal syllables are movable do.
SYLLABLES = {
    'du': 'dˈu', 'de': 'dˈA', 'da': 'dˈɑ', 'di': 'dˈi', 'ta': 'tˈɑ',
    'do': 'dˈO', 're': 'ɹˈA', 'mi': 'mˈi', 'fa': 'fˈɑ', 'so': 'sˈO', 'la': 'lˈɑ', 'ti': 'tˈi',
}


def trim(x, sr):
    peak = np.max(np.abs(x)) or 1
    loud = np.nonzero(np.abs(x) > peak * 0.02)[0]
    x = x[max(0, loud[0] - int(0.005 * sr)):loud[-1] + int(0.03 * sr)].astype(np.float32)
    fade = int(0.03 * sr)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x * 0.89 / peak


def speaking_pitch(x):
    """Median pitch over the loud part of the syllable, where the vowel is."""
    frame = int(0.06 * SR)
    hop = frame // 3
    loud = max(np.sqrt(np.mean(x[i:i + frame] ** 2)) for i in range(0, len(x) - frame, hop))
    found = []
    for i in range(0, len(x) - 2 * frame, hop):
        part = x[i:i + 2 * frame]
        if np.sqrt(np.mean(part[:frame] ** 2)) > loud * 0.5:
            hz = pitch(np.concatenate([np.zeros(int(0.02 * SR), np.float32), part]))
            if hz and 70 < hz < 500:
                found.append(69 + 12 * np.log2(hz / 440))
    return float(np.median(found))


def main():
    k = Kokoro(os.path.join(sys.argv[1], 'kokoro-v1.0.onnx'), os.path.join(sys.argv[1], 'voices-v1.0.bin'))
    index_path = os.path.join(OUT, 'index.json')
    index = json.load(open(index_path)) if os.path.exists(index_path) else {}
    voices = index.setdefault('voices', {})
    for voice, label in VOICES.items():
        files = {}
        for syl, ph in SYLLABLES.items():
            x, sr = k.create(ph, voice=voice, speed=1.0, is_phonemes=True)
            rel = f'voice/{voice}/{syl}.mp3'
            path = os.path.join(OUT, rel)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', '-',
                            '-codec:a', 'libmp3lame', '-q:a', '5', path],
                           input=trim(x, sr).tobytes(), check=True)
            files[syl] = {'file': rel, 'midi': round(speaking_pitch(decode(path)), 1)}
        voices[voice] = {'label': label, 'syllables': files, 'credit': 'kokoro'}
        print(voice, len(files))
    with open(index_path, 'w') as f:
        json.dump(index, f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
