/* Note names and a one-note staff for the exhibit's readout. */

const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const VF_SHARP = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const VF_FLAT = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];

export function name(midi, flats = false) {
  const m = Math.round(midi);
  return (flats ? FLAT : SHARP)[((m % 12) + 12) % 12];
}

export function octave(midi) { return Math.floor(Math.round(midi) / 12) - 1; }

export const full = (midi, flats) => `${name(midi, flats)}${octave(midi)}`;

/* Hz to MIDI and back. */
export const midiOf = (hz) => 69 + 12 * Math.log2(hz / 440);

let vex = null;
function loadVex() {
  vex ||= new Promise((ok, fail) => {
    if (window.Vex) return ok(window.Vex);
    const s = document.createElement('script');
    s.src = new URL('../assets/vendor/vexflow/vexflow-bravura.js', import.meta.url).href;
    s.onload = () => ok(window.Vex);
    s.onerror = fail;
    document.head.append(s);
  });
  return vex;
}

const staves = new Map();

/* SVG markup: one whole note on a staff. clef: treble, bass, alto, treble8 (sounds an octave
   lower: guitar, tenor voice), bass8 (double bass). midi is the written note. */
export async function staff(midi, clef = 'treble', flats = false) {
  const key = `${clef}:${midi}:${flats}`;
  if (staves.has(key)) return staves.get(key);
  const Vex = await loadVex();
  const VF = Vex.Flow;
  const m = Math.round(midi);
  const pc = ((m % 12) + 12) % 12;
  const spelled = (flats ? VF_FLAT : VF_SHARP)[pc];
  const div = document.createElement('div');
  const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
  const W = 116;
  const H = 170;
  renderer.resize(W, H);
  const ctx = renderer.getContext();
  ctx.setFillStyle('currentColor');
  ctx.setStrokeStyle('currentColor');
  const vfClef = clef.replace(/8$/, '');
  const stave = new VF.Stave(0, 30, W - 2);
  stave.addClef(vfClef, 'default', clef.endsWith('8') ? '8vb' : undefined);
  stave.setContext(ctx).draw();
  const shown = clef.endsWith('8') ? m + 12 : m;
  const note = new VF.StaveNote({ keys: [`${spelled}/${Math.floor(shown / 12) - 1}`], duration: 'w', clef: vfClef });
  if (spelled.length > 1) note.addModifier(new VF.Accidental(spelled.endsWith('b') ? 'b' : '#'));
  const voice = new VF.Voice({ num_beats: 4, beat_value: 4 });
  voice.addTickables([note]);
  new VF.Formatter().joinVoices([voice]).format([voice], W - stave.getNoteStartX() - 20);
  voice.draw(ctx, stave);
  const svg = div.querySelector('svg');
  // Just the staff and a few ledger lines either side.
  svg.setAttribute("viewBox", `0 40 ${W} 100`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('style');
  svg.setAttribute('aria-hidden', 'true');
  const html = svg.outerHTML;
  staves.set(key, html);
  return html;
}
