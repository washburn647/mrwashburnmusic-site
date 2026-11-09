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
import { STEPS, ALL, patternsFor, byId, sayAs, isCreate, onsets } from './steps.js';
import { taskById, parseKey, cellOf, introLines, howTo, look, beatsOf } from './tasks.js';
import { makeTurn, WHY, NOTE_SVG } from './turn.js';

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

/* An intro's words as one passage, the way 🔊 reads them. */
export const introSpeech = (it) => [it.title.replace('/', ' or '), ...it.lines].join(' ');

/* Show the intro in `host` and call done() when the learner is ready to play.
   ui: { h, notes, sylIcons, mic } from main.js (mic: the mic is on). game: whose object and
   instrument the practice uses. practice: just the practice round, from My progress (no NEW
   tag, nothing to unlock). Returns { keys(e) } for the page's key handler and { mic(time) }
   for each syllable the mic hears.

   Made for learners who may not read well yet: a picture strip says what to do (listen or
   look, then copy it or make your own, on what), 🔊 reads the words aloud, and Watch plays a
   demo round on the real controls, a ghost hand tapping each note in time, before Try it. A
   new intro starts with the demo. */
export function showIntro(host, key, ui, done, { game = null, practice = false } = {}) {
  const { h, notes } = ui;
  const it = introFor(key, game);
  const { task, step } = it;
  const kit = game?.kit || {};
  const create = isCreate(step.n);
  let tries = 0;
  let busy = false;
  let turn = null;
  let watching = false;

  const media = practice ? null : it.media?.video
    ? h('video', { class: 'intro-media', src: new URL(it.media.video, import.meta.url).href, controls: true, playsInline: true, preload: 'metadata' })
    : it.media?.audio
      ? h('audio', { class: 'intro-media', src: new URL(it.media.audio, import.meta.url).href, controls: true, preload: 'metadata' })
      : null;
  const shown = h('div', { class: 'intro-shown' });
  const dots = h('div', { class: 'dots' });
  const area = h('div', { class: 'intro-area controls' });
  const said = h('p', { class: 'intro-said' });
  const ghost = h('span', { class: 'ghost', 'aria-hidden': 'true' }, '👆');
  const tryBox = h('div', { class: 'intro-try' }, shown, dots, area, said, ghost);
  const watchBtn = h('button', { class: 'mini', onclick: () => round(true) }, '▶ Watch');
  const tryBtn = h('button', { class: 'mini', onclick: () => round(false) }, '✋ Try it');
  const go = h('button', { class: 'play', onclick: () => { stopVoice(); media?.pause?.(); done(); } }, practice ? 'Done' : 'Let\'s play');
  const ready = () => { go.disabled = !practice && tries < it.tries; };
  ready();

  // 🔊: Kyle's narration of this intro (narration.js), or the device's voice until it's recorded.
  const voice = true;
  const stopVoice = () => snd.hush();
  const readAloud = () => snd.narrate(`intro-${key}`, introSpeech(it));

  const cell = cellOf(task.id, step.n);
  const hears = cell.some((x) => x.hear);
  const sees = cell.some((x) => x.see);
  const pic = (icon, label) => h('div', { class: 'pic' }, icon, h('small', {}, label));
  const what = () => {
    if (task.id === 'du') return h('span', { class: 'pic-ic mini-tiles' }, h('b', {}, 'du'), h('b', {}, 'du-de'));
    if (task.id === 'note') {
      const el = h('span', { class: 'pic-ic mini-notes' });
      el.innerHTML = NOTE_SVG.q + NOTE_SVG.ee; // fixed markup
      return el;
    }
    const icon = { say: '🎤', tap: kit.object?.icon || '👆', play: kit.instrument?.icon || '🥁' }[task.id];
    return h('span', { class: 'pic-ic' }, icon);
  };
  const story = h('div', { class: 'intro-story' },
    pic(h('span', { class: 'pic-ic' }, `${hears ? '👂' : ''}${sees ? '👀' : ''}`), hears && sees ? 'Listen, look' : hears ? 'Listen' : 'Look'),
    h('span', { class: 'pic-arrow', 'aria-hidden': 'true' }, '➜'),
    pic(what(), create ? 'Make your own' : 'Copy it'));

  host.replaceChildren(h('div', { class: 'card intro' },
    practice ? h('b', { class: 'tag soft' }, 'Practice') : h('b', { class: 'tag' }, 'NEW'),
    h('div', { class: 'cue-word small' }, it.title),
    h('p', { class: 'intro-step' }, `Step ${step.n}: ${step.name}`),
    story,
    practice ? null : h('p', { class: 'intro-how' },
      h('span', {}, howTo({ task: task.id, step: step.n, stim: cell[0] }, game).how),
      voice ? h('button', { class: 'speak', 'aria-label': 'Read it to me', onclick: readAloud }, '🔊') : null),
    media,
    tryBox,
    h('div', { class: 'row' }, watchBtn, it.tries || practice ? tryBtn : null, go)));

  const ctx = () => snd.ac();
  const spb = 60 / PRACTICE_BPM;
  const at = (t, fn) => setTimeout(fn, Math.max(0, (t - ctx().currentTime + snd.latency()) * 1000));
  const beatDots = (k, n, kind) => {
    dots.className = `dots ${kind}${n > 4 ? ' long' : ''}`;
    dots.replaceChildren(...Array.from({ length: n }, (_, i) => h('i', { class: i < k ? 'past' : i === k ? 'now' : '' })));
  };

  /* The ghost hand moves onto what it's about to press, then presses it. */
  const point = (target) => {
    if (!target) return;
    const box = tryBox.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    ghost.style.left = `${r.left - box.left + r.width / 2}px`;
    ghost.style.top = `${r.top - box.top + r.height * 0.55}px`;
    ghost.classList.add('on');
  };
  const tap = () => { ghost.classList.remove('tap'); void ghost.offsetWidth; ghost.classList.add('tap'); };
  const fake = (k) => ({ key: k, preventDefault() {} });

  /* One round, like the game's but slower, with a click on every beat. demo: the ghost hand
     answers (it doesn't count as a try). */
  async function round(demo) {
    if (busy) return;
    busy = true;
    watching = demo;
    watchBtn.disabled = true;
    tryBtn.disabled = true;
    tryBtn.classList.remove('nudge');
    said.textContent = '';
    said.className = 'intro-said';
    area.classList.remove('over');
    ghost.classList.remove('on', 'tap');
    await snd.load();
    const ids = patternsFor(step.set);
    const list = (ids.length ? ids : ALL.map((x) => x.id)).map(byId).filter(Boolean);
    const pattern = list[Math.floor(Math.random() * list.length)] || ALL[0];
    const others = list.filter((x) => x.id !== pattern.id);
    const answer = create ? others[Math.floor(Math.random() * others.length)] || pattern : pattern;
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
    at(t0, () => { said.textContent = `${demo ? '👀 Watch! ' : ''}${l === 'read' ? '👀' : l === 'both' ? '👂👀' : '👂'}`; });
    if (stim.hear) snd.call(pattern, stim.hear, c0, spb, game?.play || kit.instrument?.sound);
    turn = makeTurn(item, game, {
      h, mic: ui.mic || demo, tResp: r0, spb,
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
    if (demo) showHow(answer, r0);
    at(r0 + n * spb, () => {
      area.classList.remove('live');
      area.classList.add('over');
      ghost.classList.remove('on');
      busy = false;
      watching = false;
      watchBtn.disabled = false;
      tryBtn.disabled = false;
      if (demo) {
        turn = null;
        said.className = 'intro-said right';
        said.textContent = '👍 Your turn!';
        tryBtn.classList.add('nudge');
        return;
      }
      const res = turn.grade();
      turn.reveal(res);
      turn = null;
      tries++;
      said.className = `intro-said ${res.right ? 'right' : 'wrong'}`;
      said.textContent = res.right
        ? (create ? `👍 ${sayAs(res.got, step.n)}` : '👍 Yes!')
        : `${WHY[res.why] || 'Not quite'}${create ? '' : `: ${sayAs(pattern, step.n)}`}`;
      if (res.right) snd.fx.win(ctx().currentTime + 0.02);
      else snd.fx.fail(ctx().currentTime + 0.02);
      if (create && res.got && task.id === 'note') snd.playBack(res.got, ctx().currentTime + 0.3, spb);
      tryBtn.textContent = '✋ Again';
      ready();
    });
  }

  /* The demo's answer: the ghost hand plays it on the real controls, in time. Speak/Sing It
     has nothing to press: the answer is sung (Kyle's take, or its stand-in) and the mic's
     pad lights up on each syllable. */
  function showHow(answer, r0) {
    const el = turn.el;
    if (task.id === 'note') {
      answer.cells.forEach((c, i) => {
        const tile = el.querySelector(c === 'q' ? '.n-q' : '.n-ee');
        at(r0 + (0.3 + i * 0.9) * spb, () => point(tile));
        at(r0 + (0.6 + i * 0.9) * spb, () => { tap(); turn?.keys(fake(c === 'q' ? '1' : '2')); });
      });
      return;
    }
    const ons = onsets(answer);
    if (task.id === 'say') {
      snd.call(answer, step.n === 1 ? 'neutral' : 'syllables', r0, spb);
      const words = [];
      ons.forEach((o) => at(r0 + o.b * spb, () => {
        el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
        words.push(step.n === 1 ? 'bum' : o.syl);
        said.textContent = `🎤 ${words.join(' ')}`;
      }));
      return;
    }
    ons.forEach((o) => {
      const c = answer.cells[Math.floor(o.b)];
      const target = task.id === 'du' ? el.querySelector(c === 'q' ? '.du-q' : '.du-ee') : el;
      at(r0 + (o.b - 0.35) * spb, () => point(target));
      at(r0 + o.b * spb, () => { tap(); turn?.keys(fake(task.id === 'du' ? (c === 'q' ? 'f' : 'j') : ' ')); });
    });
  }

  // A new intro shows how first.
  if (!practice) setTimeout(() => { if (host.isConnected) round(true); }, 600);

  return {
    keys: (e) => (turn && !watching ? turn.keys(e) : false),
    mic: (time) => (watching ? undefined : turn?.input(time, true)),
  };
}
