/* Listen and Try this, for every exhibit (coach.js plays and checks them).
   Every exhibit Listens to a scale, Hot Cross Buns and Twinkle, Twinkle (COMMON, written in C
   and moved to its home key), and to a tune of its own. A drum, which can't play a scale,
   plays a rhythm ladder instead, and the rhythms of the two songs.
   tune: { name, by, bpm, voices } in score.js's notation, in written pitch (what the
   instrument's music shows; the coach moves it to sounding pitch).
   tasks: easy, medium, hard: [what to do, the goal coach.js checks]. Goals:
     notes:C4 D4 E4   these notes in order (written pitch; wrong notes in between don't count)
     any:G3 D4 A4     these notes, in any order          together:C4 E4 G4   at the same time
     hits:k s k s     these parts in order (each instrument's own letters, as in its tune)
     chords:C G       these chords strummed in order     roll / choke   a roll, a stopped sound
     steady:8[:k]     8 even beats (on that part)        fast:12:3      12 beats in 3 seconds
     gliss:8          8 notes in a quick run             rhythm:1 1 2   beats this far apart */

export const COMMON = [
  { name: 'Scale', bpm: 104, voices: 'C4 D4 E4 F4 G4 A4 B4 C5- B4 A4 G4 F4 E4 D4 C4--' },
  { name: 'Hot Cross Buns', by: 'An old street song from England', bpm: 100, voices: 'E4 D4 C4- E4 D4 C4- C4/ C4/ C4/ C4/ D4/ D4/ D4/ D4/ E4 D4 C4-' },
  {
    name: 'Twinkle, Twinkle, Little Star', by: 'A French tune from the 1700s', bpm: 112,
    voices: 'C4 C4 G4 G4 A4 A4 G4- F4 F4 E4 E4 D4 D4 C4- G4 G4 F4 F4 E4 E4 D4- G4 G4 F4 F4 E4 E4 D4- C4 C4 G4 G4 A4 A4 G4- F4 F4 E4 E4 D4 D4 C4--',
  },
];

const HCB = (c, d, e) => `notes:${e} ${d} ${c} ${e} ${d} ${c} ${c} ${c} ${c} ${c} ${d} ${d} ${d} ${d} ${e} ${d} ${c}`;
const times = (n, t) => Array(n).fill(t).join(' ');
/* Two bars of the boogie-woogie shuffle on two strings: root with fifth, sixth, seventh, sixth. */
const pair = (r, n) => `${r}+${n}* ${r}+${n}/* ${r}+${n}* ${r}+${n}/*`;
const boogie = (r, five, six, seven) => `${pair(r, five)} ${pair(r, six)} ${pair(r, seven)} ${pair(r, six)}`;

export const LESSONS = {
  /* ---------- keyboards ---------- */
  piano: {
    home: 'C4',
    tune: {
      name: 'Für Elise', by: 'Ludwig van Beethoven, 1810', bpm: 72,
      voices: [
        'E5// D#5// E5// D#5// E5// B4// D5// C5// A4/ r// C4// E4// A4// B4/ r// E4// G#4// B4// C5/ r// E4// E5// D#5// E5// D#5// E5// B4// D5// C5// A4/ r// C4// E4// A4// B4/ r// E4// C5// B4// A4--',
        'r- A2// E3// A3// r/. E2// E3// G#3// r/. A2// E3// A3// r/. r. A2// E3// A3// r/. E2// E3// G#3// r/. A2// E3// A3--',
      ],
    },
    tasks: [
      ['Find middle C, then the C one octave higher.', 'notes:C4 C5'],
      ['Play a C major chord: C, E and G at the same time.', 'together:C4 E4 G4'],
      ['Play the C major scale from middle C, up and back down, on the white keys.', 'notes:C4 D4 E4 F4 G4 A4 B4 C5 B4 A4 G4 F4 E4 D4 C4'],
    ],
  },
  organ: {
    home: 'C4',
    tune: {
      name: 'Toccata in D minor', by: 'Johann Sebastian Bach, around 1704', bpm: 56,
      voices: [
        'A5/// G5/// A5-- r/ G5/// F5/// E5/// D5/// C#5- D5-- r A4/// G4/// A4-- r/ G4/// F4/// E4/// D4/// C#4- D4-- r D4---',
        'A4/// G4/// A4-- r/ G4/// F4/// E4/// D4/// C#4- D4-- r A3/// G3/// A3-- r/ G3/// F3/// E3/// D3/// C#3- D3-- r D2+A2+D3+F3---',
      ],
    },
    tasks: [
      ['Play the lowest C, and hold it. An organ note lasts as long as you hold the key.', 'notes:C2'],
      ['Play Hot Cross Buns: E D C, E D C, C C C C, D D D D, E D C.', HCB('C4', 'D4', 'E4')],
      ['Hold an F major chord: F, A and C together.', 'together:F3 A3 C4'],
    ],
  },
  glockenspiel: {
    home: 'C5',
    tune: {
      name: 'The Westminster chimes', by: 'The bells of Big Ben, in London, since 1859', bpm: 80,
      voices: 'E5 G#5 F#5 B4- r E5 F#5 G#5 E5- r G#5 E5 F#5 B4- r B4 F#5 G#5 E5--',
    },
    tasks: [
      ['Find two Cs, an octave apart.', 'notes:C5 C6'],
      ['Play Twinkle, Twinkle: C C G G A A G.', 'notes:C5 C5 G5 G5 A5 A5 G5'],
      ['Play the Westminster chimes: E G♯ F♯ B, E F♯ G♯ E.', 'notes:E5 G#5 F#5 B4 E5 F#5 G#5 E5'],
    ],
  },
  xylophone: {
    home: 'C4',
    tune: {
      name: 'The Entertainer', by: 'Scott Joplin, 1902: ragtime, a favourite of xylophone players', bpm: 76,
      voices: 'D5// D#5// E5// C6/ E5// C6/ E5// C6- r/ C6// D6// D#6// E6// C6// D6// E6/ B5// D6/ C6-- r/ D5// D#5// E5// C6/ E5// C6/ E5// C6--',
    },
    tasks: [
      ['Play a C, then the next C up.', 'notes:C5 C6'],
      ['Play Hot Cross Buns: E D C, E D C, C C C C, D D D D, E D C.', HCB('C5', 'D5', 'E5')],
      ['Sweep up the bars: 8 notes or more in one quick run.', 'gliss:8'],
    ],
  },
  marimba: {
    home: 'C4',
    tune: {
      name: 'La Cucaracha', by: 'A Mexican folk song', bpm: 132,
      voices: 'C4/ C4/ C4/ F4- A4/ r/ C4/ C4/ C4/ F4- A4- r F4 F4 E4 E4 D4 D4 C4-- r C4/ C4/ C4/ E4- G4/ r/ C4/ C4/ C4/ E4- G4- r C5 D5 C5 Bb4 A4 G4 F4--',
    },
    tasks: [
      ['Find the lowest note, then the highest.', 'notes:A2 C7'],
      ['Roll on a bar: hit it again and again, 8 times in 2 seconds.', 'fast:8:2'],
      ['Play La Cucaracha: C C C F A, C C C F A.', 'notes:C4 C4 C4 F4 A4 C4 C4 C4 F4 A4'],
    ],
  },

  /* ---------- strings ---------- */
  violin: {
    home: 'D4',
    tune: {
      name: 'Spring', by: 'Antonio Vivaldi, The Four Seasons, 1725', bpm: 100,
      voices: 'E5/ G#5/ G#5/ G#5/ F#5// E5// B5. B5// A5// G#5?/ G#5?/ G#5?/ F#5?// E5?// B5?. B5?// A5?// G#5/ A5// B5// A5/ G#5/ F#5- G#5?/ A5?// B5?// A5?/ G#5?/ F#5?- E5--',
    },
    tasks: [
      ['Play the four open strings, G, D, A and E, with no fingers down.', 'notes:G3 D4 A4 E5'],
      ['Play Hot Cross Buns on the D string: F♯ E D, F♯ E D, D D D D, E E E E, F♯ E D.', HCB('D4', 'E4', 'F#4')],
      ['Play the D major scale, up the D and A strings: D E F♯ G A B C♯ D.', 'notes:D4 E4 F#4 G4 A4 B4 C#5 D5'],
    ],
  },
  viola: {
    home: 'C4',
    tune: {
      name: 'Ode to Joy', by: 'Ludwig van Beethoven, Symphony No. 9, 1824. Violas and cellos play it there.', bpm: 112,
      voices: 'F#4 F#4 G4 A4 A4 G4 F#4 E4 D4 D4 E4 F#4 F#4. E4/ E4- F#4 F#4 G4 A4 A4 G4 F#4 E4 D4 D4 E4 F#4 E4. D4/ D4-',
    },
    tasks: [
      ['Play the four open strings, C, G, D and A.', 'notes:C3 G3 D4 A4'],
      ['Play Ode to Joy: F♯ F♯ G A, A G F♯ E.', 'notes:F#4 F#4 G4 A4 A4 G4 F#4 E4'],
      ['Play the C major scale from the low C string: C D E F G A B C.', 'notes:C3 D3 E3 F3 G3 A3 B3 C4'],
    ],
  },
  cello: {
    home: 'C3',
    tune: {
      name: 'Prelude', by: 'Johann Sebastian Bach, Cello Suite No. 1, around 1720', bpm: 72,
      voices: `${times(2, 'G2// D3// B3// A3// B3// D3// B3// D3//')} ${times(2, 'G2// E3// C4// B3// C4// E3// C4// E3//')} ${times(2, 'G2// F#3// C4// B3// C4// F#3// C4// F#3//')} G2+G3+B3--`,
    },
    tasks: [
      ['Play the four open strings, from the lowest: C, G, D and A.', 'notes:C2 G2 D3 A3'],
      ['Play an octave: the open C string, then the C on the G string.', 'notes:C2 C3'],
      ['Play the start of Bach’s Prelude: G D B A B D B D.', 'notes:G2 D3 B3 A3 B3 D3 B3 D3'],
    ],
  },
  bass: {
    home: 'C3',
    tune: {
      name: 'Frère Jacques, in minor', by: 'Gustav Mahler, Symphony No. 1, 1888: a solo double bass starts it', bpm: 66,
      voices: 'D3 E3 F3 D3 D3 E3 F3 D3 F3 G3 A3- F3 G3 A3- A3/ Bb3/ A3/ G3/ F3 D3 A3/ Bb3/ A3/ G3/ F3 D3 D3 A2 D3- D3 A2 D3-',
    },
    tasks: [
      ['Play the four open strings: E, A, D and G.', 'notes:E2 A2 D3 G3'],
      ['Play Frère Jacques in minor: D E F D, D E F D.', 'notes:D3 E3 F3 D3 D3 E3 F3 D3'],
      ['Keep a steady beat, like a jazz bass player: 8 even notes.', 'steady:8'],
    ],
  },
  guitar: {
    home: 'C4',
    tune: {
      name: 'Romance', by: 'A Spanish guitar piece of the 1800s; no one knows who wrote it', bpm: 96,
      voices: [
        `${times(3, 'B5/* B4/* G4/*')} B5/* B4/* G4/* A5/* B4/* G4/* G5/* B4/* G4/* G5/* B4/* G4/* F#5/* B4/* G4/* E5/* B4/* G4/* E5/* B4/* G4/* G5/* B4/* G4/* B5/* B4/* G4/* E3+B3+E4+G4+B4+E5--`,
        'E3-- E3-- E3-- E3--',
      ],
    },
    tasks: [
      ['Play the six open strings, from the thickest: E A D G B E.', 'notes:E3 A3 D4 G4 B4 E5'],
      ['Play the C major scale near the nut: C D E F G A B C.', 'notes:C4 D4 E4 F4 G4 A4 B4 C5'],
      ['Play Romance’s tune on the top string: B B B, B A G, G F♯ E.', 'notes:B5 B5 B5 B5 A5 G5 G5 F#5 E5'],
    ],
  },
  'electric-guitar': {
    home: 'C4',
    tune: {
      name: 'Boogie shuffle', by: 'The blues guitar’s oldest rhythm part', bpm: 120,
      voices: `${boogie('E3', 'B3', 'C#4', 'D4')} ${boogie('E3', 'B3', 'C#4', 'D4')} ${boogie('A3', 'E4', 'F#4', 'G4')} ${boogie('E3', 'B3', 'C#4', 'D4')} ${pair('B3', 'F#4')} ${pair('A3', 'E4')} E3+B3+E4--`,
    },
    tasks: [
      ['Play the low E string, then the E an octave up (D string, fret 2).', 'notes:E3 E4'],
      ['Switch to Chords and strum G, then C, then D.', 'chords:G C D'],
      ['Play the shuffle’s top notes: B, C♯, D, C♯ (A string, frets 2, 4, 5, 4).', 'notes:B3 C#4 D4 C#4'],
    ],
  },
  'electric-bass': {
    home: 'C3',
    tune: {
      name: 'Walking bass', by: 'A blues bass line, one note on every beat', bpm: 116,
      voices: 'G2 A2 B2 D3 C3 D3 E3 G3 G2 B2 D3 B2 G2 A2 A#2 B2 C3 E3 G3 E3 C3 D3 D#3 E3 G2 B2 D3 B2 E2 G#2 B2 D3 D3 F#3 A3 F#3 C3 E3 G3 E3 G2 B2 D3 B2 D3 A2 D3 F#2 G2---',
    },
    tasks: [
      ['Play the four open strings: E, A, D and G.', 'notes:E2 A2 D3 G3'],
      ['Play a note and its octave: the open E, then the E on the D string.', 'notes:E2 E3'],
      ['Walk up from G, one note per beat: G A B C D.', 'notes:G2 A2 B2 C3 D3'],
    ],
  },
  banjo: {
    home: 'G4',
    tune: {
      name: 'Oh! Susanna', by: 'Stephen Foster, 1848: “with a banjo on my knee”', bpm: 112,
      voices: [
        'G4/ A4/ B4/ D5/ D5/. E5// D5/ B4/ G4/. A4// B4/ B4/ A4/ G4/ A4- G4/ A4/ B4/ D5/ D5/. E5// D5/ B4/ G4/. A4// B4/ B4/ A4/ A4/ G4--',
        `r ${times(16, 'r/ G5/')}`,
      ],
    },
    tasks: [
      ['Play the five open strings, in any order: together they make a G chord.', 'any:G5 D4 G4 B4 D5'],
      ['Switch to Chords and strum G, C, D, then G again.', 'chords:G C D G'],
      ['Play Oh! Susanna’s first line: G A B D D E D B G A B B A G A.', 'notes:G4 A4 B4 D5 D5 E5 D5 B4 G4 A4 B4 B4 A4 G4 A4'],
    ],
  },
  ukulele: {
    home: 'C4',
    tune: {
      name: 'Island strum', by: 'C, A minor, F and G7, strummed down, down-up, up-down-up', bpm: 100,
      voices: `${['C', 'Am', 'F', 'G7', 'C', 'Am', 'F', 'G7'].map((c) => `@${c} @${c}/ @${c}^/ r/ @${c}^/ @${c}/ @${c}^/`).join(' ')} @C--`,
    },
    tasks: [
      ['Play the four open strings: G C E A. The G is higher than the C!', 'notes:G4 C4 E4 A4'],
      ['Switch to Chords and strum C, then A minor.', 'chords:C Am'],
      ['Strum the island song’s chords: C, Am, F, G7.', 'chords:C Am F G7'],
    ],
  },
  harp: {
    home: 'C4',
    tune: {
      name: 'Canon in D', by: 'Johann Pachelbel, around 1680. Listen for the F and C pedals.', bpm: 66,
      voices: [
        'F#5- E5- D5- C#5- B4- A4- B4- C#5- D5---',
        'D3/ A3/ D4/ F#4/ A2/ E3/ A3/ C#4/ B2/ F#3/ B3/ D4/ F#2/ C#3/ F#3/ A3/ G2/ D3/ G3/ B3/ D3/ A3/ D4/ F#4/ G2/ D3/ G3/ B3/ A2/ E3/ A3/ C#4/ D3+A3+D4+F#4---',
      ],
    },
    tasks: [
      ['Pluck two red strings: middle C, then the C above it.', 'notes:C4 C5'],
      ['Sweep across the strings: a glissando of 8 notes or more.', 'gliss:8'],
      ['Set the F pedal to sharp (down), then play the G major scale: G A B C D E F♯ G.', 'notes:G3 A3 B3 C4 D4 E4 F#4 G4'],
    ],
  },
  /* ---------- woodwinds ---------- */
  flute: {
    home: 'G4',
    tune: {
      name: 'Morning Mood', by: 'Edvard Grieg, Peer Gynt, 1875: the flute plays the sunrise', bpm: 100,
      voices: 'B5/ G#5/ F#5/ E5/ F#5/ G#5/ B5/ G#5/ F#5/ E5/ F#5// G#5// F#5// G#5// B5/ G#5/ B5/ C#6/ G#5/ C#6/ B5/ G#5/ F#5/ E5--',
    },
    tasks: [
      ['Play B, A, G: the first three notes most flute players learn.', 'notes:B4 A4 G4'],
      ['Play a low D, then blow faster (higher on the lip plate) for the D an octave up.', 'notes:D4 D5'],
      ['Play Morning Mood: B G♯ F♯ E F♯ G♯, all with fast air.', 'notes:B5 G#5 F#5 E5 F#5 G#5'],
    ],
  },
  clarinet: {
    home: 'C4',
    tune: {
      name: 'Greensleeves', by: 'An English song from the 1500s, in the clarinet’s warm low notes', bpm: 100,
      voices: 'A4 C5- D5 E5. F5/ E5 D5- B4 G4. A4/ B4 C5- A4 A4. G#4/ A4 B4- G#4 E4- A4 C5- D5 E5. F5/ E5 D5- B4 G4. A4/ B4 C5. B4/ A4 G#4. F#4/ G#4 A4--',
    },
    tasks: [
      ['Play an open G: blow with no keys pressed.', 'notes:G4'],
      ['Play Hot Cross Buns: E D C, E D C, C C C C, D D D D, E D C.', HCB('C4', 'D4', 'E4')],
      ['Cross the break: play A, then cover every hole and press the register key for B.', 'notes:A4 B4'],
    ],
  },
  oboe: {
    home: 'G4',
    tune: {
      name: 'Swan Lake', by: 'Pyotr Tchaikovsky, 1876: the oboe sings the swan’s tune', bpm: 76,
      voices: 'F#5- B4/ C#5/ D5/ E5/ F#5. D5/ F#5. D5/ F#5. B4/ D5/ B4/ G4/ D5/ B4---',
    },
    tasks: [
      ['Play a G: cover the left hand’s three holes.', 'notes:G4'],
      ['Play Hot Cross Buns on B, A, G: B A G, B A G, G G G G, A A A A, B A G.', HCB('G4', 'A4', 'B4')],
      ['Play the start of Swan Lake: F♯ B C♯ D E F♯ (the octave key gives the high notes).', 'notes:F#5 B4 C#5 D5 E5 F#5'],
    ],
  },
  saxophone: {
    home: 'G4',
    tune: {
      name: 'Saxophone blues', by: 'A twelve-bar blues, swung', bpm: 120,
      voices: `${times(2, 'G4* Bb4/* C5* C#5/* D5- Bb4* G4/* r r-')} G5* F5/* Eb5* C5/* D5- C5* Bb4/* r r- G4* Bb4/* C5* C#5/* D5- Bb4* G4/* r r- D5* F#5/* A5* F#5/* D5- C5* E5/* G5* E5/* C5- G4* Bb4/* C5* C#5/* D5* Bb4/* G4 D5--- G4---`,
    },
    tasks: [
      ['Play a G: press the left hand’s three keys.', 'notes:G4'],
      ['Play an octave: G, then the same fingers with the octave key.', 'notes:G4 G5'],
      ['Play the blues notes: G B♭ C C♯ D, then back to G.', 'notes:G4 Bb4 C5 C#5 D5 G4'],
    ],
  },
  bassoon: {
    home: 'C3',
    tune: {
      name: 'In the Hall of the Mountain King', by: 'Edvard Grieg, Peer Gynt, 1875: the bassoons creep in, then it gets faster', bpm: 112,
      voices: 'B2/ C#3/ D3/ E3/ F#3/ D3/ F#3 F3/ C#3/ F3 E3/ C3/ E3 B2/ C#3/ D3/ E3/ F#3/ D3/ F#3/ B3/ A3/ F#3/ D3/ F#3/ A3- B2!// C#3!// D3!// E3!// F#3!// D3!// F#3!/ F3!// C#3!// F3!/ E3!// C3!// E3!/ B2!// C#3!// D3!// E3!// F#3!// D3!// F#3!// B3!// A3!// F#3!// D3!// F#3!// A3!/ B2!-',
    },
    tasks: [
      ['Play an F: cover all six holes and press the thumb’s F key.', 'notes:F2'],
      ['Lift your fingers one at a time from the bottom: G A B C D E.', 'notes:G2 A2 B2 C3 D3 E3'],
      ['Play In the Hall of the Mountain King: B C♯ D E F♯ D F♯.', 'notes:B2 C#3 D3 E3 F#3 D3 F#3'],
    ],
  },

  /* ---------- brass ---------- */
  trumpet: {
    home: 'C4',
    tune: {
      name: 'Taps', by: 'A bugle call from 1862: its 24 notes need no valves at all', bpm: 60,
      voices: 'G4/. G4// C5--- G4/. C5// E5--- G4/. C5// E5 G4/. C5// E5 G4/. C5// E5- C5/. E5// G5--- E5/. C5// G4-- G4/. G4// C5---',
    },
    tasks: [
      ['Play three open notes, no valves: C, G, then high C. Go higher on the lips.', 'notes:C4 G4 C5'],
      ['Play C D E F G. The valves: none, 1 and 3, 1 and 2, 1, none.', 'notes:C4 D4 E4 F4 G4'],
      ['Play the start of Taps: G G C, G C E, G C E.', 'notes:G4 G4 C5 G4 C5 E5 G4 C5 E5'],
    ],
  },
  horn: {
    home: 'C4',
    tune: {
      name: 'Hunting call', by: 'Horns began as hunting horns, with no valves: this call needs none', bpm: 150,
      voices: 'C5/ E5/ G5/ G5. E5/ G5/ E5/ C5. G4/ C5/ E5/ E5/ D5/ C5/ D5. G4. C5/ E5/ G5/ G5. E5/ G5/ E5/ C5/ E5/ G5/ E5/ D5/ C5/ D5/ E5/ D5/ C5-.',
    },
    tasks: [
      ['Play three open notes, no valves: C, E, G. They sit close together on the lips.', 'notes:C4 E4 G4'],
      ['Play the hunting call: C E G G, E G E C.', 'notes:C5 E5 G5 G5 E5 G5 E5 C5'],
      ['Play the scale: C D E F G A B C.', 'notes:C4 D4 E4 F4 G4 A4 B4 C5'],
    ],
  },
  trombone: {
    home: 'Bb2',
    tune: {
      name: 'When the Saints Go Marching In', by: 'A New Orleans march, played on trombones in street parades', bpm: 120,
      voices: 'r F3 A3 Bb3 C4--- r F3 A3 Bb3 C4--- r F3 A3 Bb3 C4- A3- F3- A3- G3--- r A3 A3 G3 F3-. F3/ A3- C4- C4 Bb3-- r- A3 Bb3 C4- A3- F3- G3- F3---',
    },
    tasks: [
      ['Play B♭, F and B♭ again, all in first position: only your lips change.', 'notes:Bb2 F3 Bb3'],
      ['Slide out through all seven positions, one at a time: B♭ A A♭ G G♭ F E.', 'notes:Bb2 A2 Ab2 G2 Gb2 F2 E2'],
      ['Play When the Saints: F A B♭ C, F A B♭ C.', 'notes:F3 A3 Bb3 C4 F3 A3 Bb3 C4'],
    ],
  },
  tuba: {
    home: 'Bb1',
    tune: {
      name: 'Oom-pah', by: 'The tuba’s part in a march: low notes on the beat', bpm: 112,
      voices: 'Bb1 F2 Bb1 F2 Bb1 F2 D2 Bb1 Eb2 Bb1 Eb2 Bb1 F1 C2 F1 C2 Bb1 F2 Bb1 F2 Eb2 Bb1 Eb2 G1 F1 G1 A1 Bb1 F1 r Bb1-',
    },
    tasks: [
      ['Play the lowest open note, B♭, then the F above it. No valves.', 'notes:Bb1 F2'],
      ['Keep the oom-pah going: 8 even beats.', 'steady:8'],
      ['Play the B♭ scale: B♭ C D E♭ F G A B♭. The 4th valve gives the C.', 'notes:Bb1 C2 D2 Eb2 F2 G2 A2 Bb2'],
    ],
  },

  /* ---------- percussion ---------- */
  drums: {
    tune: {
      name: 'Rock beat', by: 'Eighth notes on the hi-hat, kick and snare under them, then a fill down the toms', bpm: 104,
      voices: [
        times(24, 'h/'),
        `${times(3, 'k s k/ k/ s')} s// s// s// s// t// t// t// t// m// m// m// m// f// f// f// f// c+k!---`,
      ],
    },
    tasks: [
      ['Play the kick drum, then the snare, twice: boom, crack, boom, crack.', 'hits:k s k s'],
      ['Play a fill: tom 1, tom 2 and the floor tom, then crash!', 'hits:t m f c'],
      ['Keep time on the hi-hat: 8 even taps, like a drummer in a band.', 'steady:8:h'],
    ],
  },
  timpani: {
    home: 'G2',
    tune: {
      name: 'Also sprach Zarathustra', by: 'Richard Strauss, 1896: the timpani pound out C and G', bpm: 100,
      voices: times(2, 'C3?/ G2?/ C3/ G2/ C3/ G2/ C3!/ G2!/ C3!- r-'),
    },
    tasks: [
      ['Roll on a drum: hold it down, and the sticks keep going.', 'roll'],
      ['Play C, G, C, the notes of Also sprach Zarathustra.', 'notes:C3 G2 C3'],
      ['Play G A B C D. Tune the drums with their pedals as you go.', 'notes:G2 A2 B2 C3 D3'],
    ],
  },
  snare: {
    tune: {
      name: 'Street beat', by: 'A marching drum line’s cadence, with a roll', bpm: 108,
      voices: 'x! x/ x/ x! x x/ x/ x/ x/ x! r x! x/ x/ x! x roll- x! r',
    },
    tasks: [
      ['Roll: hold the drum down, and the sticks bounce fast.', 'roll'],
      ['March: 8 even taps, left, right, left, right.', 'steady:8'],
      ['Fast hands: 16 taps in 3 seconds.', 'fast:16:3'],
    ],
  },
  bassdrum: {
    tune: {
      name: 'March beat', by: 'The bass drum keeps a band in step, loudest on beat 1', bpm: 112,
      voices: `${times(3, 'x! x? x x?')} x!/ x!/ x! choke r`,
    },
    tasks: [
      ['Strike the drum, then leave your finger on it to stop the sound.', 'choke'],
      ['Keep the band in step: 8 even beats.', 'steady:8'],
      ['Play the rhythm ta, ta, ti-ti, ta.', 'rhythm:1 1 0.5 0.5'],
    ],
  },
  cymbals: {
    tune: {
      name: 'Crash!', by: 'The end of a march: crash, let it ring, then stop it against the chest', bpm: 104,
      voices: 'x- x- x!--- choke r x/ x/ x! r x!--- choke',
    },
    tasks: [
      ['Crash the cymbals together.', 'hits:x'],
      ['Crash, then hold them to stop the sound: a choke.', 'choke'],
      ['Switch to Suspended, then hold the cymbal for a roll.', 'roll'],
    ],
  },
  triangle: {
    tune: {
      name: 'Triangle waltz', by: 'A ding on the first beat of each bar, then a roll', bpm: 132,
      voices: 'x!-- x-- x!-- x-- x/ x/ x x x!-- x-- roll-- x!--',
    },
    tasks: [
      ['Hold the triangle for a roll: the beater rattles in a corner.', 'roll'],
      ['Ding 6 times, evenly, one for each beat.', 'steady:6'],
      ['Play the rhythm ta, ti-ti, ta, ta.', 'rhythm:1 0.5 0.5 1'],
    ],
  },
  tambourine: {
    tune: {
      name: 'Tambourine dance', by: 'Taps, shakes and a roll, as in a folk dance', bpm: 116,
      voices: 'x x/ x/ x x! shake shake x x! x x/ x/ x x! roll--- x!-',
    },
    tasks: [
      ['Tap the tambourine 4 times.', 'hits:x x x x'],
      ['Hold it for a roll: the jingles shiver.', 'roll'],
      ['Play the rhythm ti-ti, ta, ti-ti, ta, ta.', 'rhythm:0.5 0.5 1 0.5 0.5 1'],
    ],
  },
  gong: {
    tune: {
      name: 'Gong strokes', by: 'Soft strokes that grow, then one big one, stopped by hand', bpm: 60,
      voices: 'x?- x?- x- x- x!---- choke',
    },
    tasks: [
      ['Strike the gong, and listen to the sound grow.', 'hits:x'],
      ['Strike it, then leave your hand on it to stop the sound.', 'choke'],
      ['Play 6 even strokes, about one a second.', 'steady:6'],
    ],
  },
  'sleigh-bells': {
    tune: {
      name: 'Jingle Bells', by: 'James Lord Pierpont, 1857: the bells shake the song’s rhythm', bpm: 132,
      voices: times(2, 'x x x- x x x- x x x. x/ x--- x x x. x/ x x x x/ x/ x x x x x- x-'),
    },
    tasks: [
      ['Shake the bells 3 times: move your finger back and forth on them, or tap.', 'hits:x x x'],
      ['Shake a steady beat: 8 even shakes.', 'steady:8'],
      ['Play Jingle Bells’ rhythm: jin-gle bells, jin-gle bells, jin-gle all the way.', 'rhythm:1 1 2 1 1 2 1 1 1.5 0.5'],
    ],
  },

  /* ---------- around the world ---------- */
  congas: {
    tune: {
      name: 'Tumbao', by: 'The beat of Cuban salsa on two congas: soft taps, a loud slap, two open tones', bpm: 100,
      voices: times(2, 'h?/ h?/ h!/ h?/ h?/ h?/ h/ h/ h?/ h?/ h!/ h?/ h?/ h?/ l/ l/'),
    },
    tasks: [
      ['Play the conga (high), then the tumba (low).', 'hits:h l'],
      ['Play high, high, low, low, twice.', 'hits:h h l l h h l l'],
      ['Keep a steady beat on the conga: 8 even taps.', 'steady:8:h'],
    ],
  },
  bongos: {
    tune: {
      name: 'Martillo', by: 'The bongo player’s “hammer” in Cuban son: eight strokes, over and over', bpm: 104,
      voices: times(4, 'h!/ h?/ h/ h?/ h!/ h?/ l/ h?/'),
    },
    tasks: [
      ['Play the small drum (macho), then the big one (hembra).', 'hits:h l'],
      ['Play the martillo: macho 6 times, hembra, macho.', 'hits:h h h h h h l h'],
      ['Hammer away: 16 strokes in 4 seconds.', 'fast:16:4'],
    ],
  },
  agogo: {
    tune: {
      name: 'Samba bell', by: 'The agogô’s two bells in a Brazilian samba parade', bpm: 100,
      voices: `${times(3, 'h/ h/ l/ h/ l/ h/ l/ l/')} h!-`,
    },
    tasks: [
      ['Play the high bell, then the low bell.', 'hits:h l'],
      ['Play high, high, low, high, low, low.', 'hits:h h l h l l'],
      ['Keep a steady beat: 8 even strokes, on either bell.', 'steady:8'],
    ],
  },
  cowbell: {
    tune: {
      name: 'Mambo bell', by: 'The cowbell in a Cuban mambo, loud on every beat', bpm: 112,
      voices: `${times(4, 'x! x?/ x?/ x! x?/ x?/')} x!-`,
    },
    tasks: [
      ['Play the cowbell 4 times.', 'hits:x x x x'],
      ['Keep a steady beat: 8 even strokes.', 'steady:8'],
      ['Fast: 12 strokes in 3 seconds.', 'fast:12:3'],
    ],
  },
  claves: {
    tune: {
      name: 'Son clave', by: 'The rhythm that holds Cuban music together: three clicks, then two', bpm: 104,
      voices: times(4, 'x. x. x r x x r'),
    },
    tasks: [
      ['Click the claves 3 times.', 'hits:x x x'],
      ['Keep a steady beat: 8 even clicks.', 'steady:8'],
      ['Play the son clave: one, two, three, wait, four, five.', 'rhythm:1.5 1.5 2 1'],
    ],
  },
  guiro: {
    tune: {
      name: 'Güiro groove', by: 'One long scrape, then two short ones, over and over', bpm: 100,
      voices: `${times(8, 'z x/ x/')} z-`,
    },
    tasks: [
      ['Scrape the güiro: drag along its ridges.', 'hits:x'],
      ['Scrape 4 times, evenly.', 'steady:4'],
      ['Play the rhythm ta, ti-ti, ta, ti-ti, ta.', 'rhythm:1 0.5 0.5 1 0.5 0.5'],
    ],
  },
  shaker: {
    tune: {
      name: 'Shaker groove', by: 'Even eighth notes, louder on beats 2 and 4, as in a pop song', bpm: 104,
      voices: times(4, 'x?/ x?/ x!/ x?/ x?/ x?/ x!/ x?/'),
    },
    tasks: [
      ['Shake it twice: move your finger back and forth on it.', 'hits:x x'],
      ['Shake a steady beat: 8 even shakes.', 'steady:8'],
      ['Shake fast: 16 shakes in 4 seconds.', 'fast:16:4'],
    ],
  },
  cabasa: {
    tune: {
      name: 'Bossa nova', by: 'The cabasa’s soft, steady scratch in Brazilian bossa nova', bpm: 120,
      voices: times(4, 'x!/ x?/ x?/ x!/ x?/ x?/ x!/ x?/'),
    },
    tasks: [
      ['Shake it twice: move your finger back and forth on the beads.', 'hits:x x'],
      ['Keep a steady beat: 8 even shakes.', 'steady:8'],
      ['Play 12 shakes in 3 seconds.', 'fast:12:3'],
    ],
  },
  'log-drum': {
    tune: {
      name: 'Call and answer', by: 'Slit drums can “talk”: the high tongue calls and the low one answers', bpm: 104,
      voices: 'h h/ h/ h- l l/ l/ l- h/ h/ h/ h/ h l- l/ l/ l h-',
    },
    tasks: [
      ['Play the high tongue, then the low one.', 'hits:h l'],
      ['Call and answer: high, high, low, high, high, low.', 'hits:h h l h h l'],
      ['Keep a steady beat on the low tongue: 8 even strokes.', 'steady:8:l'],
    ],
  },
  kalimba: {
    home: 'C4',
    tune: {
      name: 'Thumb piano', by: 'Rolling chords, a note for each thumb in turn: C, F, G and home', bpm: 120,
      voices: 'C4/ E4/ G4/ E4/ C5/ G4/ E4/ G4/ F4/ A4/ C5/ A4/ F5/ C5/ A4/ C5/ G4/ B4/ D5/ B4/ G5/ D5/ B4/ D5/ C5/ G4/ E4/ G4/ C5--',
    },
    tasks: [
      ['Pluck the longest tine, in the middle: it is C.', 'notes:C4'],
      ['Play Hot Cross Buns: E D C, E D C, C C C C, D D D D, E D C.', HCB('C4', 'D4', 'E4')],
      ['Play Twinkle, Twinkle: C C G G A A G, F F E E D D C.', 'notes:C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4'],
    ],
  },
};
