/* Task intros. The first time a task comes up at a step (Speak/Sing It at step 1, then at
   step 2, and so on: the key is taskKey, e.g. 'say-1'), the stream stops for a short
   introduction before that game: what the task is, what to do at this step, Kyle's recorded
   message when there is one (audio or video), and a practice round to try it, slowly, with
   no score. "Let's play" goes back to the stream with a count-in, and the game it was about
   comes next. Once seen it isn't shown again (store: st.intro). My progress can play any
   unlocked one again, or just the practice round; the game workshop previews them all
   (?intro=<key>).

   INTROS holds the written ones. Any task and step without one gets its lines from the task
   tables (tasks.js introLines), so every one has an intro from the start; write one here to
   change what it says.
     title   the big word (default: the task's name)
     lines   what to do, one short sentence each
     media   { video: 'intros/say-1.mp4' } or { audio: 'intros/say-1.mp3' } (files in
             musician-maker/intros/), shown above the practice
     tries   practice rounds before "Let's play" lights up (default 1; 0 to skip practice) */

import * as snd from './sound.js';
import { STEPS, ALL, patternsFor, byId, sayAs, isCreate } from './steps.js';
import { taskById, parseKey, cellOf, introLines, howTo, look, beatsOf } from './tasks.js';
import { makeTurn, WHY } from './turn.js';

export const INTROS = {
  'say-1': {
    title: 'Speak/Sing It!',
    lines: [
      'You\'ll hear a little pattern, on "bum" or on an instrument.',
      'Then it\'s your turn: say it back on "bum", just the same, in time.',
      'Listen first. Say it when the box glows.',
    ],
    media: null,
  },
};

const PRACTICE_BPM = 84;

export function introFor(key, game = null) {
  const k = parseKey(key);
  if (!k) return null;
  const task = taskById(k.task);
  const step = STEPS[k.step];
  const d = INTROS[key] || {};
  return {
    key, task, step,
    title: d.title || `${task.name}!`,
    lines: d.lines || introLines(k.task, k.step, game),
    media: d.media || null,
    tries: d.tries ?? 1,
  };
}

/* Show the intro in `host` and call done() when the learner is ready to play.
   ui: { h, notes, sylIcons, mic } from main.js (mic: the mic is on). game: whose object and
   instrument the practice uses. practice: just the practice round, from My progress (no NEW
   tag, nothing to unlock). Returns { keys(e) } for the page's key handler and { mic(time) }
   for each syllable the mic hears. */
export function showIntro(host, key, ui, done, { game = null, practice = false } = {}) {
  const { h, notes, sylIcons } = ui;
  const it = introFor(key, game);
  const { task, step } = it;
  let tries = 0;
  let busy = false;
  let turn = null;

  const media = practice ? null : it.media?.video
    ? h('video', { class: 'intro-media', src: new URL(it.media.video, import.meta.url).href, controls: true, playsInline: true, preload: 'metadata' })
    : it.media?.audio
      ? h('audio', { class: 'intro-media', src: new URL(it.media.audio, import.meta.url).href, controls: true, preload: 'metadata' })
      : null;
  const shown = h('div', { class: 'intro-shown' });
  const dots = h('div', { class: 'dots' });
  const area = h('div', { class: 'intro-area controls' });
  const said = h('p', { class: 'intro-said' });
  const tryBox = h('div', { class: 'intro-try', hidden: true }, shown, dots, area, said);
  const tryBtn = h('button', { class: 'mini', onclick: () => round() }, 'Try it');
  const go = h('button', { class: 'play', onclick: () => { media?.pause?.(); done(); } }, practice ? 'Done' : 'Let\'s play');
  const ready = () => { go.disabled = !practice && tries < it.tries; };
  ready();

  host.replaceChildren(h('div', { class: 'card intro' },
    practice ? h('b', { class: 'tag soft' }, 'Practice') : h('b', { class: 'tag' }, 'NEW'),
    h('div', { class: 'cue-word small' }, it.title),
    h('p', { class: 'intro-step' }, `Step ${step.n}: ${step.name}`),
    practice ? null : h('ul', { class: 'intro-lines' }, ...it.lines.map((l) => h('li', {}, l))),
    media,
    it.tries || practice ? tryBox : null,
    h('div', { class: 'row' }, it.tries || practice ? tryBtn : null, go)));

  const ctx = () => snd.ac();
  const spb = 60 / PRACTICE_BPM;
  const at = (t, fn) => setTimeout(fn, Math.max(0, (t - ctx().currentTime + snd.latency()) * 1000));
  const beatDots = (k, n, kind) => {
    dots.className = `dots ${kind}${n > 4 ? ' long' : ''}`;
    dots.replaceChildren(...Array.from({ length: n }, (_, i) => h('i', { class: i < k ? 'past' : i === k ? 'now' : '' })));
  };

  /* One practice round, like the game's but slower, with a click on every beat. */
  async function round() {
    if (busy) return;
    busy = true;
    tryBtn.disabled = true;
    said.textContent = '';
    said.className = 'intro-said';
    tryBox.hidden = false;
    area.classList.remove('over');
    await snd.load();
    const ids = patternsFor(step.set);
    const list = (ids.length ? ids : ALL.map((x) => x.id)).map(byId).filter(Boolean);
    const pattern = list[Math.floor(Math.random() * list.length)] || ALL[0];
    const cell = cellOf(task.id, step.n);
    const stim = cell[Math.floor(Math.random() * cell.length)];
    const item = { task: task.id, step: step.n, stim, pattern };
    const { go: shout } = howTo(item, game);
    shown.replaceChildren();
    if (stim.see) shown.append(notes(pattern));
    const t0 = ctx().currentTime + 0.2;
    const c0 = t0 + 2 * spb; // 2 clicks of count-in, then 4 beats to hear or read it
    const r0 = c0 + 4 * spb;
    for (let k = 0; k < 2; k++) snd.hit('claves', t0 + k * spb, 0.5);
    for (let k = 0; k < 4; k++) {
      snd.hit('claves', c0 + k * spb, k % 2 ? 0.25 : 0.4);
      at(c0 + k * spb, () => beatDots(k, 4, 'call'));
    }
    const l = look(stim);
    at(t0, () => { said.textContent = l === 'read' ? 'Read it…' : l === 'both' ? 'Listen and read…' : 'Listen…'; });
    if (stim.hear) snd.call(pattern, stim.hear, c0, spb, game?.play || game?.kit?.instrument?.sound);
    turn = makeTurn(item, game, {
      h, mic: ui.mic, tResp: r0, spb,
      now: () => ctx().currentTime, latency: () => snd.latency(), hit: (name, vol) => snd.hit(name, ctx().currentTime, vol),
    });
    area.classList.remove('live');
    area.replaceChildren(turn.el);
    at(r0, () => { area.classList.add('live'); said.textContent = shout; });
    const n = beatsOf(task.id);
    for (let k = 0; k < n; k++) {
      snd.hit('claves', r0 + k * spb, 0.25);
      at(r0 + k * spb, () => beatDots(k, n, 'resp'));
    }
    at(r0 + n * spb, () => {
      area.classList.remove('live');
      area.classList.add('over');
      const res = turn.grade();
      turn.reveal(res);
      turn = null;
      busy = false;
      tries++;
      const create = isCreate(step.n);
      said.className = `intro-said ${res.right ? 'right' : 'wrong'}`;
      said.textContent = res.right
        ? (create ? `Yes! Yours was ${sayAs(res.got, step.n)}.` : 'Yes! That\'s it.')
        : `${WHY[res.why] || 'Not quite'}${create ? '' : `. It was ${sayAs(pattern, step.n)}`}. Try again?`;
      if (res.right) snd.fx.win(ctx().currentTime + 0.02);
      else snd.fx.fail(ctx().currentTime + 0.02);
      if (create && res.got && task.id === 'note') snd.playBack(res.got, ctx().currentTime + 0.3, spb);
      tryBtn.textContent = 'Try again';
      tryBtn.disabled = false;
      ready();
    });
  }

  return { keys: (e) => (turn ? turn.keys(e) : false), mic: (time) => turn?.input(time, true) };
}
