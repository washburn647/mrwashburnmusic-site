# Shared sounds

Recorded instruments for any page on the site. Nothing loads until a page
asks for it, and then only the notes it needs. Credits and licences: `CREDITS.txt` (the piano
needs credit; keep that file served).

## Use

```js
import * as samples from '/assets/sounds/samples.js';

samples.setup(snd.ac(), snd.bus());        // optional: share lesson/sound.js's context and mix
const piano = await samples.instrument('piano', { lo: 48, hi: 84 });
const stop = piano.note(60, t, 0.5, { vol: 0.25, dest });   // same call as sound.js note()
(await samples.instrument('claves')).hit(t, { vol: 0.8 });
```

`t` is on the audio clock. `samples.list()` gives `index.json`: every instrument and its notes. Each sound starts at its measured onset, so rhythms line up to about 1 ms.
The try-out page is `/studio/sounds/`.

- Pitched: piano, violins, violas, cellos, bass, pizzicato, cello-pizz, harp, flute, oboe,
  clarinet, bassoon, trumpet, horn, trombone, tuba, glockenspiel, xylophone, marimba
- Hits: claves, log-drum-high, log-drum-low, cowbell, agogo, triangle, finger-cymbals,
  tambourine, sleigh-bells, shaker, cabasa, guiro, snare, bass-drum, conga, bongo-high,
  bongo-low, cymbal

## Recorded voice

Kyle records every pattern in `/assets/patterns/patterns.js` at `/studio/record/`: rhythm
patterns in 2/4 and 6/8, tonal patterns in major and minor, a few takes each at three speeds.
Its "Download for site" zip goes in with `python tools/add_takes.py voice-kyle-....zip`. Then:

```js
const kyle = await samples.takes('kyle');
await kyle.prepare(['rhythm/2-4/q-ee']);                    // load ahead
kyle.say('rhythm/2-4/q-ee', t, { bpm: 84 });               // a different take each time
kyle.say('tonal/major/so-mi-do', t, { speed: 'slow', key: 50 });
```

`bpm` picks the takes recorded nearest that tempo and stretches them to it; `key` (sounding
midi of do, or la in minor) moves a tonal take. Pitch and tempo move together, so stay close
to how it was recorded.

## Rebuild

`tools/build_sounds.py` makes the instruments from the source libraries, checking every
sample's pitch. The top of the file says what it needs.
