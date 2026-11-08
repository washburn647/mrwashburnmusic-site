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
`samples.raw(name, { lo, hi })` gives the decoded samples themselves, for a player that changes
a note while it sounds (the instrument museum's bows, slides and timpani pedals, `museum/audio.js`).
The try-out page is `/studio/sounds/`.

- Pitched: piano, violin (solo), violins, violas, cellos, bass, pizzicato, violin-pizz,
  viola-pizz, cello-pizz, bass-pizz, harp, flute, oboe, tenor-sax,
  clarinet, bassoon, trumpet, horn, trombone, tuba, glockenspiel, xylophone, marimba, guitar
  (nylon), banjo, electric-bass (banjo and electric bass are GNU GPL: see `CREDITS.txt`),
  electric-guitar, electric-piano, organ, ukulele, kalimba, synth-lead, synth-pad, synth-bass
- Hits: claves, log-drum-high, log-drum-low, cowbell, agogo, triangle, finger-cymbals,
  tambourine, sleigh-bells, shaker, cabasa, guiro, snare, bass-drum, conga, bongo-high,
  bongo-low, cymbal, gong, sus-cymbal, and rolls that loop: snare-roll, triangle-roll,
  tambourine-roll, tambourine-shake, sus-cymbal-roll
- Timpani (pitched, five drums): timpani, timpani-roll
- Drum kit (`group: "kit"`): kit-kick, kit-snare, kit-snare-ghost, kit-cross-stick,
  kit-hihat-closed, kit-hihat-open, kit-hihat-pedal, kit-tom-high, kit-tom-low, kit-ride,
  kit-ride-bell, kit-crash, kit-splash (Salamander Drumkit, CC BY-SA: see `CREDITS.txt`)

## Recorded voice

Kyle records the patterns of each unit at `/studio/record/` (pattern ids from
`/assets/patterns/patterns.js`), a few takes each at three speeds. Its "Publish to site" button
puts the takes on the site straight away (`/api/live/voice/kyle.json`, which `samples.takes()`
reads ahead of this folder). Its "Download" zip goes in with
`python tools/add_takes.py voice-kyle.zip`, which also writes the units to
`/assets/patterns/units.json`. Then:

```js
const kyle = await samples.takes('kyle');
await kyle.prepare(['rhythm/2-4/q-ee']);                    // load ahead
kyle.say('rhythm/2-4/q-ee', t, { bpm: 84 });               // a different take each time
kyle.say('tonal/major/so-mi-do', t, { speed: 'slow', key: 50 });
```

`bpm` picks the takes recorded nearest that tempo and stretches them to it; `key` (sounding
midi of do, or la in minor) moves a tonal take. Pitch and tempo move together, so stay close
to how it was recorded. `{ as: 'bum' }` picks the takes on "bum" (`kyle.has(id, 'bum')`).
Musician Maker's cue words (`musician-maker/cues.js`) play as recorded:
`kyle.hasCue('echo') && kyle.cue('echo', t)`.

## Groove loops

Musician Maker's backing band, recorded by Kyle a layer at a time (pulse, bass, drums, horns,
band, plus breakdown for breathers) at 92, 108 and 126 bpm. `python tools/add_groove.py <folder>`
takes files named like `bass-108.wav`, checks each is whole bars of 2/4, encodes them to
`groove/` and lists them under `groove` in `index.json`. `samples.grooveLoops()` loads them;
`musician-maker/sound.js` plays each on the beat clock, and a stand-in for any layer missing.

## Rebuild

`tools/build_sounds.py` makes the instruments from the source libraries, checking every
sample's pitch. The top of the file says what it needs.
