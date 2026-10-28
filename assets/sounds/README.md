# Shared sounds

Recorded instruments and spoken syllables for any page on the site. Nothing loads until a page
asks for it, and then only the notes it needs. Credits and licences: `CREDITS.txt` (the piano
needs credit; keep that file served).

## Use

```js
import * as samples from '/assets/sounds/samples.js';

samples.setup(snd.ac(), snd.bus());        // optional: share lesson/sound.js's context and mix
const piano = await samples.instrument('piano', { lo: 48, hi: 84 });
const stop = piano.note(60, t, 0.5, { vol: 0.25, dest });   // same call as sound.js note()
(await samples.instrument('claves')).hit(t, { vol: 0.8 });
const v = await samples.voice('af_heart');
v.say('du', t, { dur: 0.3 });              // dur cuts it short with a quick fade
v.say('so', t, { midi: 67 });              // shifted onto a pitch (speed changes with it)
```

`t` is on the audio clock. `samples.list()` gives `index.json`: every instrument, its notes,
and the voices. Each sound starts at its measured onset, so rhythms line up to about 1 ms.
The try-out page is `/studio/sounds/`.

- Pitched: piano, violins, violas, cellos, bass, pizzicato, cello-pizz, harp, flute, oboe,
  clarinet, bassoon, trumpet, horn, trombone, tuba, glockenspiel, xylophone, marimba
- Hits: claves, log-drum-high, log-drum-low, cowbell, agogo, triangle, finger-cymbals,
  tambourine, sleigh-bells, shaker, cabasa, guiro, snare, bass-drum, conga, bongo-high,
  bongo-low, cymbal
- Voices (trial, text to speech): af_heart, af_bella, am_michael, bm_george, each saying
  du de da di ta (Feierabend rhythm syllables) and do re mi fa so la ti

Spoken syllables shifted onto pitches only come within a semitone or two, because speech
glides. Sung recordings will do tonal patterns better: drop them in `voice/<name>/` and list
them in `index.json` the same way.

## Rebuild

`tools/build_sounds.py` makes the instruments from the source libraries, checking every
sample's pitch. `tools/build_voices.py` makes the syllables. Each file's top says what it needs.
