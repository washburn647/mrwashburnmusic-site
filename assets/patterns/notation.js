/* Draws a pattern from patterns.js as notation (SVG), with VexFlow.
   The page loads /assets/vendor/vexflow/vexflow-bravura.js first (a plain script: window.Vex).
   Rhythms go on a one-line staff; tonal patterns on a treble staff in the chosen key,
   an octave up from how they sound (the 8 under the clef), as stemless noteheads. */

import { METERS, KEYS, spell, toneMidi } from './patterns.js';

const INK = '#2F4A3A';
const cache = new Map();

function svgFor(width, height, draw) {
  const VF = window.Vex.Flow;
  const div = document.createElement('div');
  const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  ctx.setFillStyle(INK);
  ctx.setStrokeStyle(INK);
  draw(VF, ctx);
  const svg = div.querySelector('svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  return svg.outerHTML;
}

function rhythm(pattern) {
  const VF = window.Vex.Flow;
  const m = METERS[pattern.meter];
  const bars = [];
  for (let i = 0; i < pattern.cells.length; i += m.beatsPerBar) bars.push(pattern.cells.slice(i, i + m.beatsPerBar));
  const first = 50;
  const barWidth = 110;
  const width = first + bars.length * barWidth + 2;
  return svgFor(width, 80, (VF, ctx) => {
    let x = 0;
    bars.forEach((bar, b) => {
      const w = barWidth + (b ? 0 : first);
      // Five lines with only the middle one showing, so the time signature sits right.
      const stave = new VF.Stave(x, -10, w);
      stave.setConfigForLines([0, 1, 2, 3, 4].map((l) => ({ visible: l === 2 })));
      if (!b) stave.addTimeSignature(pattern.meter);
      if (b === bars.length - 1) stave.setEndBarType(VF.Barline.type.SINGLE);
      stave.setContext(ctx).draw();
      const notes = bar.flatMap((c) => m.cells[c].notes.map((d) => {
        const n = new VF.StaveNote({ keys: ['b/4'], duration: d, stem_direction: 1 });
        if (d.endsWith('d')) VF.Dot.buildAndAttach([n], { all: true });
        return n;
      }));
      const voice = new VF.Voice({ num_beats: m.time.num, beat_value: m.time.value });
      voice.addTickables(notes);
      const beams = VF.Beam.generateBeams(notes, { groups: [new VF.Fraction(...m.beam)], stem_direction: 1 });
      new VF.Formatter().joinVoices([voice]).format([voice], w - (b ? 20 : first + 10));
      voice.draw(ctx, stave);
      beams.forEach((beam) => beam.setContext(ctx).draw());
      x += w;
    });
  });
}

function tonal(pattern, tonic) {
  const key = KEYS[pattern.tonality].find((k) => k.midi === tonic) || KEYS[pattern.tonality][0];
  const keySpec = pattern.tonality === 'minor' ? `${key.name}m` : key.name;
  const width = 90 + pattern.tones.length * 42;
  return svgFor(width, 140, (VF, ctx) => {
    const stave = new VF.Stave(0, 15, width - 2);
    stave.addClef('treble', 'default', '8vb').addKeySignature(keySpec);
    stave.setContext(ctx).draw();
    const notes = pattern.tones.map((tone) => {
      const n = new VF.StaveNote({ keys: [spell(key.do, tone, toneMidi(pattern.tonality, key.midi, tone) + 12)], duration: 'q', auto_stem: true });
      n.setStemStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' });
      return n;
    });
    const voice = new VF.Voice({ num_beats: notes.length, beat_value: 4 });
    voice.addTickables(notes);
    VF.Accidental.applyAccidentals([voice], keySpec);
    new VF.Formatter().joinVoices([voice]).format([voice], width - stave.getNoteStartX() - 20);
    voice.draw(ctx, stave);
  });
}

/* SVG markup for a pattern. tonic: sounding midi of do (major) or la (minor). */
export function notation(pattern, tonic) {
  const id = pattern.kind === 'tonal' ? `${pattern.id}@${tonic}` : pattern.id;
  if (!cache.has(id)) cache.set(id, pattern.kind === 'tonal' ? tonal(pattern, tonic) : rhythm(pattern));
  return cache.get(id);
}
