/* Skill intros. The first time a kind of game comes up (a step and an answer mode: the same key
   as the NEW tag, `${step}-${mode}`), the stream stops for a short introduction before it:
   a title, a few lines on what to do, Kyle's recorded message when there is one (audio or
   video), and a practice round to try it, slowly, with no score. "Let's play" goes back to the
   stream with a count-in, and the game it was about comes next. Once seen it isn't shown again
   (store: st.intro). The studio's game workshop can preview each one (?intro=<key>).

   INTROS holds the written ones. A skill without one gets its lines from the step (howTo), so
   every skill has an intro from the start; write one here to change what it says.
     title   the big word
     lines   what to do, one short sentence each
     media   { video: 'intros/1-perform.mp4' } or { audio: 'intros/1-perform.mp3' } (files in
             musician-maker/intros/), shown above the practice
     tries   practice rounds before "Let's play" lights up (default 1; 0 to skip practice) */

import * as snd from './sound.js';
import { STEPS, ALL, onsets, patternsFor, options, readTaps, fromCells, howTo, sylText } from './steps.js';

export const INTROS = {
  '1-perform': {
    title: 'Echo!',
    lines: [
      'Someone sings a little pattern on "bum".',
      'Then it\'s your turn: tap it back, just the same, in time.',
      'Listen first. Tap when the box glows.',
    ],
    media: null,
  },
};

const PRACTICE_BPM = 84;

export const introKey = (item) => `${item.step}-${item.mode}`;

export function introFor(key) {
  const [n, mode] = key.split('-');
  const step = STEPS[Number(n)];
  const { how } = howTo(step.n, mode);
  const d = INTROS[key] || {};
  return {
    key, step, mode,
    title: d.title || step.name,
    lines: d.lines || [step.say, how].filter((x, i, a) => x && a.indexOf(x) === i),
    media: d.media || null,
    tries: d.tries ?? 1,
  };
}

/* Every skill there is, for the workshop. */
export function allIntroKeys() {
  return STEPS.slice(1).flatMap((s) => s.modes.map((m) => `${s.n}-${m}`));
}

/* Show the intro in `host` and call done() when the learner is ready to play.
   ui: { h, notes, sylIcons, mic } from main.js (mic: the mic is on). Returns { keys(e) } for the
   page's key handler and { mic(time) } for each syllable the mic hears. */
export function showIntro(host, key, ui, done) {
  const { h, notes, sylIcons } = ui;
  const it = introFor(key);
  const { step, mode } = it;
  let tries = 0;
  let busy = false;
  let keyFn = null;
  let micFn = null;

  const media = it.media?.video
    ? h('video', { class: 'intro-media', src: new URL(it.media.video, import.meta.url).href, controls: true, playsInline: true, preload: 'metadata' })
    : it.media?.audio
      ? h('audio', { class: 'intro-media', src: new URL(it.media.audio, import.meta.url).href, controls: true, preload: 'metadata' })
      : null;
  const shown = h('div', { class: 'intro-shown' });
  const dots = h('div', { class: 'dots' });
  const area = h('div', { class: 'intro-area' });
  const said = h('p', { class: 'intro-said' });
  const tryBtn = h('button', { class: 'mini', onclick: () => practice() }, 'Try it');
  const go = h('button', { class: 'play', onclick: () => { stopMedia(); done(); } }, 'Let\'s play');
  const ready = () => { go.disabled = tries < it.tries; };
  const stopMedia = () => media?.pause?.();
  ready();

  host.replaceChildren(h('div', { class: 'card intro' },
    h('b', { class: 'tag' }, 'NEW'),
    h('div', { class: 'cue-word small' }, it.title),
    h('ul', { class: 'intro-lines' }, ...it.lines.map((l) => h('li', {}, l))),
    media,
    it.tries ? h('div', { class: 'intro-try' }, shown, dots, area, said) : null,
    h('div', { class: 'row' }, it.tries ? tryBtn : null, go)));

  const ctx = () => snd.ac();
  const spb = 60 / PRACTICE_BPM;
  const at = (t, fn) => setTimeout(fn, Math.max(0, (t - ctx().currentTime + snd.latency()) * 1000));
  const beatDots = (k, n, kind) => {
    dots.className = `dots ${kind}`;
    dots.replaceChildren(...Array.from({ length: n }, (_, i) => h('i', { class: i < k ? 'past' : i === k ? 'now' : '' })));
  };
  const finish = (right, text) => {
    busy = false;
    keyFn = null;
    micFn = null;
    tries++;
    said.className = `intro-said ${right ? 'right' : 'wrong'}`;
    said.textContent = text;
    if (right) snd.fx.win(ctx().currentTime + 0.02);
    else snd.fx.fail(ctx().currentTime + 0.02);
    tryBtn.textContent = 'Try again';
    tryBtn.disabled = false;
    ready();
  };

  /* One practice round, like the game's but slower, with a click on every beat. */
  async function practice() {
    if (busy) return;
    busy = true;
    tryBtn.disabled = true;
    said.textContent = '';
    said.className = 'intro-said';
    await snd.load();
    const pool = patternsFor(step.set);
    const p = (pool.length ? pool : ALL.map((x) => x.id)).map((id) => ALL.find((x) => x.id === id) || null).filter(Boolean);
    const pattern = p[Math.floor(Math.random() * p.length)] || ALL[0];
    const listen = step.call === 'neutral' || step.call === 'syllables';
    shown.replaceChildren();
    if (step.call === 'notation') shown.append(notes(pattern));
    if (step.call === 'text') shown.append(h('div', { class: 'syl-card' }, sylIcons(pattern)));
    area.replaceChildren();
    const t0 = ctx().currentTime + 0.2;
    // A bar of clicks to count in, then the call (listen) or a bar to read it.
    const lead = step.call === 'none' ? 0 : 4;
    const c0 = t0 + 2 * spb; // 2 clicks of count-in
    const r0 = c0 + lead * spb;
    for (let k = 0; k < 2; k++) snd.hit('claves', t0 + k * spb, 0.5);
    for (let k = 0; k < lead; k++) {
      snd.hit('claves', c0 + k * spb, k % 2 ? 0.25 : 0.4);
      at(c0 + k * spb, () => beatDots(k, lead, 'call'));
    }
    at(t0, () => { said.textContent = listen ? 'Listen…' : step.call === 'none' ? '' : 'Read it…'; });
    if (listen) snd.call(pattern, step.call, c0, spb);
    at(r0, () => { said.textContent = howTo(step.n, mode).go; });

    if (mode === 'perform' || mode === 'create') {
      const taps = [];
      const pad = h('button', { class: 'pad intro-pad', onpointerdown: (e) => { e.preventDefault(); tap(); } }, h('b', {}, 'TAP'), h('small', {}, ui.mic ? 'or say it' : 'or press space'));
      let tappedAt = -9;
      // Taps and the mic, as in the game: a tap's own sound isn't a syllable, and a tap and a
      // syllable together count once.
      const tap = (time = ctx().currentTime, fromMic = false) => {
        if (fromMic && time > tappedAt - 0.05 && time < tappedAt + snd.latency() + 0.12) return;
        const t = time - snd.latency();
        const b = (t - r0) / spb;
        if (fromMic && (b < -0.25 || b > 3.75)) return;
        if (!fromMic) { tappedAt = time; snd.hit('snare', time, 0.8); }
        pad.classList.remove('hit'); void pad.offsetWidth; pad.classList.add('hit');
        if (t >= r0 - 0.25 * spb && !taps.some((x) => Math.abs(x - b) < 0.15)) taps.push(b);
      };
      keyFn = (e) => { if (e.key === ' ' || e.key === 'Enter') { tap(); return true; } return false; };
      micFn = (time) => tap(time, true);
      area.append(pad);
      for (let k = 0; k < 4; k++) {
        snd.hit('claves', r0 + k * spb, 0.25);
        at(r0 + k * spb, () => beatDots(k, 4, 'resp'));
      }
      at(r0 + 4 * spb, () => {
        const got = readTaps(taps);
        if (mode === 'perform') {
          const right = got?.id === pattern.id;
          finish(right, right ? 'Yes! That\'s it.' : `Close! It was ${sylText(pattern)}. Try again?`);
        } else {
          const right = !!got && got.id !== pattern.id;
          finish(right, right ? `Yes! You answered ${sylText(got)}.` : got ? 'Make yours different from mine!' : 'Tap four beats\' worth, in time.');
        }
      });
    } else if (mode === 'pick') {
      const q = options(pattern, 3, false);
      const show = step.show;
      const btns = q.list.map((x, i) => h('button', { class: 'opt', onclick: () => choose(i) }, show === 'notation' ? notes(x) : sylIcons(x, 'syl')));
      const choose = (i) => {
        if (!busy) return;
        btns.forEach((b, j) => b.classList.add(j === q.correct ? 'right' : j === i ? 'wrong' : 'dim'));
        finish(i === q.correct, i === q.correct ? 'Yes! That\'s the one.' : 'Not that one. The green one was it.');
      };
      keyFn = (e) => { const n = Number(e.key); if (n >= 1 && n <= btns.length) { choose(n - 1); return true; } return false; };
      at(r0, () => area.replaceChildren(h('div', { class: `opts n${btns.length}` }, ...btns)));
    } else {
      // Build and compose: four slots, each ♩ or ♫, then Check.
      const cells = [null, null, null, null];
      const slots = cells.map((_, i) => h('button', { class: 'slot empty', onclick: () => cycle(i) }));
      const draw = () => slots.forEach((b, i) => {
        b.className = `slot ${cells[i] || 'empty'}`;
        b.replaceChildren(h('b', {}, cells[i] === 'ee' ? '♫' : cells[i] === 'q' ? '♩' : '?'));
      });
      const cycle = (i) => { if (!busy) return; cells[i] = cells[i] === 'q' ? 'ee' : 'q'; snd.hit('snare', ctx().currentTime, 0.5); draw(); };
      const check = h('button', { class: 'mini', onclick: () => {
        if (!busy) return;
        if (!cells.every(Boolean)) { said.textContent = 'Fill all four boxes.'; return; }
        const got = fromCells(cells);
        check.remove();
        if (mode === 'compose') {
          snd.playBack(got, ctx().currentTime + 0.1, spb);
          finish(true, `Yours: ${sylText(got)}. Nice!`);
          return;
        }
        slots.forEach((b, i) => b.classList.add(cells[i] === pattern.cells[i] ? 'right' : 'wrong'));
        const right = got.id === pattern.id;
        finish(right, right ? 'Yes! Spot on.' : `It was ${sylText(pattern)}.`);
      } }, 'Check');
      keyFn = (e) => { const n = Number(e.key); if (n >= 1 && n <= 4) { cycle(n - 1); return true; } return false; };
      draw();
      at(r0, () => area.replaceChildren(h('div', { class: 'slots intro-slots' }, ...slots), check));
    }
  }

  return { keys: (e) => (keyFn ? keyFn(e) : false), mic: (time) => micFn?.(time) };
}
