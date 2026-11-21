/* The museum's rooms and exhibits. Each exhibit names the module that plays it and that
   module's settings; the facts are the placard. Pitches are MIDI numbers (60 = middle C).
   For a transposing instrument, `written` is how far the written note sits above the sound.
   `vibrato` (bowed, wind and brass) adds vibrato to samples recorded without it: how many cents
   either way, and how much the level moves with it (Sustain in audio.js). The violin, viola and
   double bass samples have vibrato already, and the clarinet, French horn and tuba usually play
   without it. */

export const ROOMS = [
  { id: 'keyboard', name: 'Keyboards', hue: '#C9824A' },
  { id: 'strings', name: 'Strings', hue: '#B5653A' },
  { id: 'woodwinds', name: 'Woodwinds', hue: '#5E7D4F' },
  { id: 'brass', name: 'Brass', hue: '#C99A2E' },
  { id: 'percussion', name: 'Percussion', hue: '#4F6E8A' },
  { id: 'world', name: 'Around the world', hue: '#9A5A7A' },
];

export const EXHIBITS = [
  {
    id: 'piano', name: 'Piano', room: 'keyboard', play: 'keys',
    opts: { sound: 'piano', lo: 21, hi: 108, look: 'piano', start: 48 },
    clef: 'grand',
    facts: [
      'Press a key and a felt hammer strikes steel strings inside.',
      'It has 88 keys: 52 white and 36 black.',
      'Its full name, pianoforte, means “soft-loud” in Italian, because it can play both.',
      'Bartolomeo Cristofori built the first one in Italy around 1700.',
    ],
    range: [21, 108],
  },
  {
    id: 'organ', name: 'Organ', room: 'keyboard', play: 'keys',
    opts: { sound: 'organ', lo: 36, hi: 96, look: 'organ', start: 48 },
    clef: 'grand',
    facts: [
      'Air blown through pipes makes its sound, so a note lasts as long as you hold the key.',
      'Pressing harder doesn’t make it louder: the player pulls stops to add more pipes.',
      'Big church organs have thousands of pipes, and a keyboard for the feet.',
      'This is an electric organ with drawbars, like the ones in gospel, rock and jazz.',
    ],
    range: [36, 96],
  },
  {
    id: 'violin', name: 'Violin', room: 'strings', play: 'bowed',
    opts: { arco: 'violin', pizz: 'violin-pizz', strings: [55, 62, 69, 76], tapes: [2, 4, 5, 7], span: 12 },
    clef: 'treble',
    facts: [
      'The smallest and highest member of the string family.',
      'Its four strings are G, D, A and E.',
      'There are no frets, so violinists find every note by ear.',
      'The bow is strung with horsehair, rubbed with rosin so it grips the string.',
    ],
    range: [55, 100],
  },
  {
    id: 'viola', name: 'Viola', room: 'strings', play: 'bowed',
    opts: { arco: 'violas', pizz: 'viola-pizz', strings: [48, 55, 62, 69], tapes: [2, 4, 5, 7], span: 12 },
    clef: 'alto',
    facts: [
      'A little bigger than a violin, with a deeper, warmer voice.',
      'Its strings are C, G, D and A.',
      'Viola music uses the alto clef, which puts middle C on the middle line.',
    ],
    range: [48, 88],
  },
  {
    id: 'cello', name: 'Cello', room: 'strings', play: 'bowed',
    opts: { arco: 'cello', pizz: 'cello-pizz-solo', strings: [36, 43, 50, 57], tapes: [2, 3, 4, 5], span: 12, vibrato: { cents: 22 } },
    clef: 'bass',
    facts: [
      'Played sitting down, resting on a metal endpin on the floor.',
      'Its strings are C, G, D and A, an octave below the viola’s.',
      'Its range is close to the human voice, from deep bass to high tenor.',
    ],
    range: [36, 81],
  },
  {
    id: 'bass', name: 'Double bass', room: 'strings', play: 'bowed',
    opts: { arco: 'bass', pizz: 'bass-pizz', strings: [28, 33, 38, 43], tapes: [2, 3, 4, 5], span: 12 },
    clef: 'bass', written: 12,
    facts: [
      'The biggest and lowest instrument in the string family.',
      'Its strings are E, A, D and G, tuned like the lowest four on a guitar.',
      'Its music is written an octave higher than it sounds.',
      'In jazz, the bass is usually plucked instead of bowed.',
    ],
    range: [28, 67],
  },
  {
    id: 'guitar', name: 'Guitar', room: 'strings', play: 'guitar',
    opts: { sound: 'guitar', strings: [40, 45, 50, 55, 59, 64], frets: 12 },
    clef: 'treble', written: 12,
    facts: [
      'Six strings, tuned E, A, D, G, B and E from lowest to highest.',
      'Pressing behind a fret makes the string shorter, and the note higher.',
      'Each fret is a half step. Twelve frets up is an octave.',
      'This classical guitar has nylon strings. Steel strings sound brighter.',
    ],
    range: [40, 83],
  },
  {
    id: 'electric-guitar', name: 'Electric guitar', room: 'strings', play: 'guitar',
    opts: { sound: 'electric-guitar', strings: [40, 45, 50, 55, 59, 64], frets: 12, chords: 'guitar', look: 'electric' },
    clef: 'treble', written: 12,
    facts: [
      'A solid body with no sound hole: on its own it is very quiet.',
      'Magnets called pickups turn the shaking strings into electricity, and an amplifier makes it loud.',
      'It has steel strings, tuned like any guitar: E, A, D, G, B and E.',
      'It has been at the heart of rock, blues and pop since the 1950s.',
    ],
    range: [40, 83],
  },
  {
    id: 'electric-bass', name: 'Electric bass', room: 'strings', play: 'guitar',
    opts: { sound: 'electric-bass', strings: [28, 33, 38, 43], frets: 12, look: 'bass' },
    clef: 'bass', written: 12,
    facts: [
      'Four thick strings, tuned E, A, D and G, like the double bass.',
      'It usually plays one note at a time: the lowest part of the band.',
      'Bass players lock in with the drummer to make the groove.',
      'Its music is written an octave higher than it sounds.',
    ],
    range: [28, 55],
  },
  {
    id: 'banjo', name: 'Banjo', room: 'strings', play: 'guitar',
    opts: { sound: 'banjo', strings: [67, 50, 55, 59, 62], frets: 12, chords: 'banjo', look: 'banjo', short: { string: 0, from: 5 } },
    clef: 'treble', written: 12,
    facts: [
      'Its body is a drum: a skin (or plastic) head stretched over a round frame.',
      'It came to America with enslaved West Africans, from instruments like the akonting.',
      'The fifth string is short: it starts at the fifth fret and always rings a high G.',
      'Bluegrass and old-time players pick it fast with metal finger picks.',
    ],
    range: [50, 79],
  },
  {
    id: 'ukulele', name: 'Ukulele', room: 'strings', play: 'guitar',
    opts: { sound: 'ukulele', strings: [67, 60, 64, 69], frets: 12, chords: 'ukulele', look: 'ukulele' },
    clef: 'treble',
    facts: [
      'Four nylon strings, tuned G, C, E and A.',
      'The G string is tuned high, so the strings don’t go low to high in order.',
      'Immigrants from Madeira, in Portugal, brought it to Hawaii in 1879. Its name may mean “jumping flea.”',
      'Easy chords make it a great first instrument.',
    ],
    range: [60, 81],
  },
  {
    id: 'harp', name: 'Harp', room: 'strings', play: 'harp',
    opts: { sound: 'harp', low: 36, strings: 33 },
    clef: 'grand',
    facts: [
      'A concert harp has 47 strings and stands taller than most grown-ups.',
      'The red strings are Cs and the dark ones Fs, so the player can find their place.',
      'Seven pedals, one for each letter, make every string of that letter flat, natural or sharp.',
      'Sweeping a hand across the strings is called a glissando.',
      'Try Penta: the pedals tune every string to the pentatonic scale, so any glissando sounds good.',
    ],
    range: [36, 91],
  },
  {
    id: 'flute', name: 'Flute', room: 'woodwinds', play: 'wind',
    opts: { sound: 'flute', kind: 'flute', vibrato: { cents: 16, amp: 0.08 } },
    clef: 'treble',
    facts: [
      'No reed: you blow across a hole, like blowing across a bottle.',
      'It is made of metal, but it is still a woodwind.',
      'Faster air makes the same fingers play an octave higher.',
      'Flutes carved from bone over 40,000 years ago have been found.',
    ],
    range: [60, 96],
  },
  {
    id: 'clarinet', name: 'Clarinet', room: 'woodwinds', play: 'wind',
    opts: { sound: 'clarinet', kind: 'clarinet' },
    clef: 'treble', written: 2, flats: true,
    facts: [
      'One reed vibrates against the mouthpiece.',
      'The register key jumps up a twelfth (an octave and a fifth), not an octave.',
      'This clarinet is in B♭: when it reads C, it sounds B♭.',
    ],
    range: [50, 89],
  },
  {
    id: 'oboe', name: 'Oboe', room: 'woodwinds', play: 'wind',
    opts: { sound: 'oboe', kind: 'oboe', vibrato: { cents: 14, amp: 0.04 } },
    clef: 'treble',
    facts: [
      'Two thin reeds tied together vibrate against each other.',
      'The whole orchestra tunes to the oboe’s A.',
      'Most oboists carve their own reeds.',
    ],
    range: [58, 93],
  },
  {
    id: 'saxophone', name: 'Saxophone', room: 'woodwinds', play: 'wind',
    opts: { sound: 'tenor-sax', kind: 'sax', vibrato: { cents: 18, rate: 5.2, amp: 0.03 } },
    clef: 'treble', written: 14, flats: true,
    facts: [
      'Adolphe Sax invented it in the 1840s.',
      'It is made of brass, but it is a woodwind, because it uses a reed.',
      'This is a tenor sax, in B♭: it sounds a ninth lower than it reads.',
      'You hear it in jazz, marching bands, pop and rock.',
    ],
    range: [44, 76],
  },
  {
    id: 'bassoon', name: 'Bassoon', room: 'woodwinds', play: 'wind',
    opts: { sound: 'bassoon', kind: 'bassoon', vibrato: { cents: 12, amp: 0.03 } },
    clef: 'bass',
    facts: [
      'The lowest of the usual woodwinds, with a double reed like the oboe’s.',
      'Its wooden tube is about 8 feet (2.5 meters) long, folded in half.',
      'The reed sits on a curved metal tube called the bocal.',
      'Bassoonists use both thumbs on many keys at the back.',
    ],
    range: [34, 75],
  },
  {
    id: 'trumpet', name: 'Trumpet', room: 'brass', play: 'brass',
    opts: { sound: 'trumpet', fundamental: 46, partials: [2, 3, 4, 5, 6, 8], valves: [2, 1, 3], look: 'trumpet', vibrato: { cents: 10, amp: 0.03 } },
    clef: 'treble', written: 2, flats: true,
    facts: [
      'The sound starts with your lips buzzing in the mouthpiece.',
      'Tighter lips play higher notes from the same tubing.',
      'Each valve adds tubing: valve 2 lowers a half step, valve 1 a whole step, valve 3 a step and a half.',
      'This trumpet is in B♭: when it reads C, it sounds B♭.',
    ],
    range: [52, 82],
  },
  {
    id: 'horn', name: 'French horn', room: 'brass', play: 'brass',
    opts: { sound: 'horn', fundamental: 29, partials: [2, 3, 4, 5, 6, 8, 9, 10, 12], valves: [2, 1, 3], look: 'horn' },
    clef: 'treble', written: 7, flats: true,
    facts: [
      'About 12 feet (almost 4 meters) of tubing, coiled into a circle.',
      'The player’s right hand rests inside the bell.',
      'Its high notes sit close together, so the lips have to be very exact.',
      'This horn is in F: it sounds a fifth lower than it reads.',
    ],
    range: [34, 77],
  },
  {
    id: 'trombone', name: 'Trombone', room: 'brass', play: 'brass',
    opts: { sound: 'trombone', fundamental: 34, partials: [2, 3, 4, 5, 6, 8], slide: true, look: 'trombone', vibrato: { cents: 9, rate: 5, amp: 0.03 } },
    clef: 'bass', flats: true,
    facts: [
      'A slide instead of valves: seven positions, each a half step lower than the last.',
      'The slide can glide smoothly from note to note. That is a glissando.',
      'Its name means “big trumpet” in Italian.',
    ],
    range: [40, 77],
  },
  {
    id: 'tuba', name: 'Tuba', room: 'brass', play: 'brass',
    opts: { sound: 'tuba', fundamental: 22, partials: [2, 3, 4, 5, 6, 8], valves: [2, 1, 3, 5], look: 'tuba' },
    clef: 'bass', flats: true,
    facts: [
      'The biggest and lowest instrument in the brass family.',
      'This tuba has about 18 feet (5.5 meters) of tubing.',
      'The fourth valve lowers the note by five half steps.',
    ],
    range: [28, 58],
  },
  {
    id: 'drums', name: 'Drum set', room: 'percussion', play: 'kit',
    facts: [
      'One drummer plays it with both hands and both feet.',
      'The bass drum and the hi-hat are played with foot pedals.',
      'The cymbals are made of bronze.',
    ],
  },
  {
    id: 'timpani', name: 'Timpani', room: 'percussion', play: 'timpani',
    clef: 'bass', flats: false,
    facts: [
      'Also called kettledrums: big copper bowls with a drumhead stretched on top.',
      'A pedal tightens the head to raise the note, or loosens it to lower it.',
      'Orchestras usually have four, from about 32 inches (81 cm) across down to 23.',
    ],
    range: [38, 57],
  },
  {
    id: 'snare', name: 'Snare drum', room: 'percussion', play: 'perc', opts: { kind: 'snare' },
    facts: [
      'Metal wires called snares, stretched under the bottom head, make its buzz.',
      'A roll is many quick strokes that blend into one long sound.',
      'Marching bands and orchestras both use it.',
    ],
  },
  {
    id: 'bassdrum', name: 'Bass drum', room: 'percussion', play: 'perc', opts: { kind: 'bassdrum' },
    facts: [
      'The biggest drum in the orchestra. You can feel its boom.',
      'It is played with a big, soft beater.',
      'A hand on the head stops the sound.',
    ],
  },
  {
    id: 'cymbals', name: 'Cymbals', room: 'percussion', play: 'perc', opts: { kind: 'cymbals' },
    facts: [
      'Crash cymbals are a pair, swung together.',
      'Pressing them against your chest stops the sound. That is a choke.',
      'A suspended cymbal hangs on a stand and can roll with soft mallets.',
      'They are made of bronze, a mix of copper and tin.',
    ],
  },
  {
    id: 'triangle', name: 'Triangle', room: 'percussion', play: 'perc', opts: { kind: 'triangle' },
    facts: [
      'A steel bar bent into a triangle, open at one corner.',
      'It hangs from a string, because holding it would stop the ring.',
      'For a roll, the beater taps quickly back and forth inside a corner.',
    ],
  },
  {
    id: 'tambourine', name: 'Tambourine', room: 'percussion', play: 'perc', opts: { kind: 'tambourine' },
    facts: [
      'A small frame drum with metal jingles set into the rim.',
      'You can tap it, shake it, or rub your thumb around the edge.',
      'Drums like it are played all over the world, from Brazil to the Middle East.',
    ],
  },
  {
    id: 'gong', name: 'Gong', room: 'percussion', play: 'perc', opts: { kind: 'gong' },
    facts: [
      'A big bronze disc, first made in East and Southeast Asia.',
      'Its sound swells after you strike it, then fades very slowly.',
      'The biggest gongs are wider than a grown-up is tall.',
    ],
  },
  {
    id: 'sleigh-bells', name: 'Sleigh bells', room: 'percussion', play: 'hand',
    opts: { parts: [{ sound: 'sleigh-bells', shape: 'sleigh', size: 1.1 }] },
    facts: [
      'Small metal bells, each with a loose ball inside, on a strap or handle.',
      'Shake them for a jingle, or tap the handle for one crisp ring.',
      'They were hung on horses’ harnesses so people could hear a sleigh coming.',
    ],
  },
  {
    id: 'glockenspiel', name: 'Glockenspiel', room: 'percussion', play: 'keys',
    opts: { sound: 'glockenspiel', lo: 79, hi: 108, look: 'glock', start: 79 },
    clef: 'treble', written: -24,
    facts: [
      'Its name is German for “bells play.”',
      'Hard mallets strike steel bars.',
      'It sounds two octaves higher than its music is written.',
    ],
    range: [79, 108],
  },
  {
    id: 'xylophone', name: 'Xylophone', room: 'percussion', play: 'keys',
    opts: { sound: 'xylophone', lo: 65, hi: 108, look: 'xylo', start: 72 },
    clef: 'treble', written: -12,
    facts: [
      '“Xylo” means wood in Greek: its bars are hard rosewood.',
      'Tubes under the bars, called resonators, make it louder.',
      'It sounds an octave higher than its music is written.',
    ],
    range: [65, 108],
  },
  {
    id: 'marimba', name: 'Marimba', room: 'percussion', play: 'keys',
    opts: { sound: 'marimba', lo: 45, hi: 96, look: 'marimba', start: 55 },
    clef: 'treble',
    facts: [
      'Wide wooden bars with long resonator tubes give it a deep, warm sound.',
      'Players often hold two mallets in each hand.',
      'It is the national instrument of Guatemala.',
    ],
    range: [45, 96],
  },
  {
    id: 'congas', name: 'Congas', room: 'world', play: 'hand',
    opts: { parts: [{ sound: 'conga', shape: 'drum', rate: 1.08, name: 'Conga' }, { sound: 'conga', shape: 'drum', rate: 0.86, size: 1.12, name: 'Tumba' }] },
    facts: [
      'Tall wooden drums from Cuba, played with the hands.',
      'Their roots are in drums brought from Africa, especially the Congo.',
      'A player often plays two or three at once, each tuned to its own note.',
      'Slapping the edge, or letting the palm ring the middle, gives different sounds.',
    ],
  },
  {
    id: 'bongos', name: 'Bongos', room: 'world', play: 'hand',
    opts: { parts: [{ sound: 'bongo-high', shape: 'bongo', size: 0.85, name: 'Macho' }, { sound: 'bongo-low', shape: 'bongo', size: 1, name: 'Hembra' }] },
    facts: [
      'A pair of small drums joined together, from Cuba.',
      'The small one is the macho, the bigger one the hembra.',
      'They are held between the knees and played with the fingers.',
    ],
  },
  {
    id: 'agogo', name: 'Agogô', room: 'world', play: 'hand',
    opts: { parts: [{ sound: 'agogo', shape: 'agogo', rate: 1, name: 'High' }, { sound: 'agogo', shape: 'agogo', rate: 0.79, name: 'Low' }] },
    facts: [
      'Two bells joined by a handle, from the Yoruba people of West Africa.',
      'In Brazil it leads the rhythm of samba bands.',
      'One bell is smaller and higher: rhythms move back and forth between them.',
    ],
  },
  {
    id: 'cowbell', name: 'Cowbell', room: 'world', play: 'hand',
    opts: { parts: [{ sound: 'cowbell', shape: 'bell' }] },
    facts: [
      'Once hung on cows so farmers could find them; now it keeps the beat in salsa and rock.',
      'It has no clapper inside: it is struck with a stick.',
      'Hitting near the open end sounds bright; near the top, dull.',
    ],
  },
  {
    id: 'claves', name: 'Claves', room: 'world', play: 'hand',
    opts: { parts: [{ sound: 'claves', shape: 'claves' }] },
    facts: [
      'Two sticks of hard wood, clicked together.',
      'One rests on a cupped hand, which makes a hollow space for the sound.',
      'They play the clave, the rhythm that holds Cuban music together.',
    ],
  },
  {
    id: 'guiro', name: 'Güiro', room: 'world', play: 'hand',
    opts: { parts: [{ sound: 'guiro', shape: 'guiro', size: 0.9 }] },
    facts: [
      'A hollow gourd with ridges cut across it, from the Caribbean.',
      'Scraping a stick along the ridges makes its rasp. Try it fast and slow.',
      'Holes underneath are where the player holds it.',
    ],
  },
  {
    id: 'shaker', name: 'Shaker', room: 'world', play: 'hand',
    opts: { parts: [{ sound: 'shaker', shape: 'shaker' }] },
    facts: [
      'A shell filled with seeds, beads or sand.',
      'People everywhere have made them from gourds, shells, baskets and eggs.',
      'Shaking it back and forth keeps a steady beat.',
    ],
  },
  {
    id: 'cabasa', name: 'Cabasa', room: 'world', play: 'hand',
    opts: { parts: [{ sound: 'cabasa', shape: 'cabasa' }] },
    facts: [
      'Loops of steel beads wrapped around a ridged cylinder on a handle.',
      'Turning it against the palm rubs the beads over the ridges.',
      'It is based on the shekere, a gourd covered with a net of beads from West Africa.',
    ],
  },
  {
    id: 'log-drum', name: 'Log drum', room: 'world', play: 'hand',
    opts: { parts: [{ sound: 'log-drum-high', shape: 'slit', name: 'High' }, { sound: 'log-drum-low', shape: 'slit', name: 'Low' }] },
    facts: [
      'A hollow wooden box with tongues cut into its top. It is also called a slit drum.',
      'A longer tongue sounds lower, a shorter one higher.',
      'Huge ones in Africa, Southeast Asia and the Pacific could send messages far away.',
    ],
  },
  {
    id: 'kalimba', name: 'Kalimba', room: 'world', play: 'hand',
    opts: { sound: 'kalimba', tines: [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81] },
    clef: 'treble',
    facts: [
      'Metal tines on a wooden board, plucked with the thumbs.',
      'It grew from African instruments like the mbira of Zimbabwe, played for centuries.',
      'The longest tine is in the middle; the notes of the scale step out to each side.',
      'A shorter tine vibrates faster, so it plays higher.',
    ],
    range: [60, 81],
  },
];

export const byId = Object.fromEntries(EXHIBITS.map((e) => [e.id, e]));
