/* Cue words Kyle records at /studio/record/ (Cue words). Each is said on a beat at 108 bpm,
   within 2 beats, and played as recorded. Ids name the files; don't rename one with takes. */

export const CUES = [
  { id: 'echo', text: 'Echo!' },
  { id: 'say-it', text: 'Say it!' },
  { id: 'name-it', text: 'Name it!' },
  { id: 'answer', text: 'Answer!' },
  { id: 'match', text: 'Match!' },
  { id: 'read', text: 'Read!' },
  { id: 'build', text: 'Build!' },
  { id: 'write', text: 'Write!' },
  { id: 'compose', text: 'Compose!' },
  { id: 'tap-it', text: 'Tap it!' },
  { id: 'play-it', text: 'Play it!' },
  { id: 'du-it', text: 'Du it!' },
  { id: 'note-it', text: 'Note it!' },
  { id: 'boss', text: 'Boss!' },
  { id: 'new-step', text: 'New step!' },
  { id: 'perfect', text: 'Perfect!' },
  { id: 'groovy', text: 'Groovy!' },
  { id: 'hot', text: 'Hot!' },
  { id: 'on-fire', text: 'On fire!' },
  { id: 'legendary', text: 'Legendary!' },
  // Praise for a right answer (PRAISE), a different one each time.
  { id: 'yes', text: 'Yes!', praise: true },
  { id: 'nice', text: 'Nice!', praise: true },
  { id: 'wow', text: 'Wow!', praise: true },
  { id: 'great', text: 'Great!', praise: true },
  { id: 'got-it', text: 'Got it!', praise: true },
  { id: 'awesome', text: 'Awesome!', praise: true },
  { id: 'amazing', text: 'Amazing!', praise: true },
  { id: 'excellent', text: 'Excellent!', praise: true },
  { id: 'fantastic', text: 'Fantastic!', praise: true },
  { id: 'extraordinary', text: 'Extraordinary!', praise: true },
  { id: 'sweet', text: 'Sweet!', praise: true },
  { id: 'nailed-it', text: 'Nailed it!', praise: true },
  { id: 'way-to-go', text: 'Way to go!', praise: true },
  { id: 'you-got-it', text: 'You got it!', praise: true },
  { id: 'super', text: 'Super!', praise: true },
  { id: 'brilliant', text: 'Brilliant!', praise: true },
  { id: 'woo', text: 'Woo!', praise: true },
  { id: 'yeah', text: 'Yeah!', praise: true },
];

export const PRAISE = CUES.filter((c) => c.praise);

export const cueById = (id) => CUES.find((c) => c.id === id);

/* Cue text (a task's cue in tasks.js) to its id: 'SAY IT!' → 'say-it'. */
export const cueId = (text) => text.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/ +/g, '-');
