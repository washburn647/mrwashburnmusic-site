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
  { id: 'boss', text: 'Boss!' },
  { id: 'new-step', text: 'New step!' },
  { id: 'perfect', text: 'Perfect!' },
  { id: 'groovy', text: 'Groovy!' },
  { id: 'hot', text: 'Hot!' },
  { id: 'on-fire', text: 'On fire!' },
  { id: 'legendary', text: 'Legendary!' },
];

export const cueById = (id) => CUES.find((c) => c.id === id);

/* Step cue text (steps.js) to its id: 'NAME IT!' → 'name-it'. */
export const cueId = (text) => text.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/ +/g, '-');
