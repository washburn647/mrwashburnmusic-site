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

Kyle records spoken and sung patterns at `/studio/record/` (several takes each). Its
"Download for site" zip goes in with `python tools/add_takes.py voice-kyle-....zip`. Then:

```js
const kyle = await samples.takes('kyle');
await kyle.prepare(['du de du de', 'du da di du']);   // load ahead
kyle.say('du-de du-de', t, { bpm: 84 });             // a different take each time
```

Patterns match whatever the case, spacing or hyphens. `bpm` stretches a take from the tempo
it was recorded at (its pitch moves too, so stay close).

## Rebuild

`tools/build_sounds.py` makes the instruments from the source libraries, checking every
sample's pitch. The top of the file says what it needs.
