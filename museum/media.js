/* Real photographs and recordings for the museum, each freely licensed and credited where it
   is shown. Their files are in museum/media/. Anything not listed here is simply not shown:
   a placard keeps its drawing and leaves out "Hear it in a real piece", and the reverb keeps
   its made-up hall (audio.js).

   PHOTOS[id]  a photograph of the instrument, for its placard:
     { file, alt, by, license, source }
   PIECES[id]  a recording of the instrument in a real piece:
     { file, title, composer, played, by, license, source }
     (played: who plays it in the recording; by: who made the recording, for the credit)
   HALL        a recording of a concert hall's echo (its impulse response: a clap or a burst
               of sound in the empty hall, and how the hall rings after it), which the museum's
               reverb plays every note through:
     { file, place, by, license, source, send }   (send: how much of the sound goes to it)

   file: a name in museum/media/ (photos .webp or .jpg, recordings .mp3, the hall .wav or .mp3).
   license: as it should read, e.g. 'CC BY-SA 4.0' or 'public domain'. source: the web page the
   file came from, which the credit links to. */

export const PHOTOS = {};

export const PIECES = {};

export const HALL = null;

/* Where a file in museum/media/ is. */
export const url = (file) => new URL(`media/${file}`, import.meta.url).href;
