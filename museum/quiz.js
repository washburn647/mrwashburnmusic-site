/* The quiz at the end of the tour (#quiz): six questions, one from each stop, two of them by
   ear. A question missed comes back at the end until it is answered right; answering all six
   earns the Museum Explorer badge, kept in the passport (passport.js). */

import { ROOMS, byId } from './data.js';
import { art } from './art.js';
import { pitched, now } from './audio.js';
import { LESSONS } from './lessons.js';
import * as score from './score.js';
import * as passport from './passport.js';

export const QUESTIONS = [
  {
    room: 'keyboard', about: 'piano', ask: 'Press a piano key. What makes the sound?',
    words: ['A felt hammer strikes steel strings', 'Air rushes through a pipe', 'A bow rubs a string', 'Lips buzz in a mouthpiece'],
    answer: 'A felt hammer strikes steel strings',
    why: 'Inside a piano, a felt hammer strikes steel strings. Air through a pipe is the organ.',
  },
  {
    room: 'strings', ask: 'Listen! Which one is playing?', hear: 'bass',
    pics: ['violin', 'bass'], answer: 'bass',
    why: 'Low and deep: the double bass. The bigger the string instrument, the lower its voice.',
  },
  {
    room: 'woodwinds', ask: 'Which woodwind has no reed?',
    pics: ['clarinet', 'flute', 'oboe', 'saxophone'], answer: 'flute',
    why: 'The flute: you blow across a hole, like blowing across a bottle.',
  },
  {
    room: 'brass', about: 'trumpet', ask: 'How does a trumpet player make a sound?',
    words: ['They buzz their lips in the mouthpiece', 'They blow across a hole', 'They pluck a string', 'They shake it'],
    answer: 'They buzz their lips in the mouthpiece',
    why: 'Brass players buzz their lips. Tighter lips play higher notes.',
  },
  {
    room: 'percussion', ask: 'Listen! Which drum is playing these notes?', hear: 'timpani',
    pics: ['snare', 'timpani', 'bassdrum', 'drums'], answer: 'timpani',
    why: 'Timpani play notes: a pedal tightens the drumhead, and the note goes up.',
  },
  {
    room: 'world', ask: 'Which one do you play with your thumbs?',
    pics: ['claves', 'shaker', 'kalimba', 'bongos'], answer: 'kalimba',
    why: 'The kalimba: your thumbs pluck its metal tines.',
  },
];

/* The sound for a question by ear: the start of the instrument's own tune. */
const SAMPLE = { bass: 'bass', timpani: 'timpani' };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
const NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let run = null;     // { queue: [question index...], right: Set, tries, first: Set }
let voices = [];    // sounds playing

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function mount() {
  run = { queue: QUESTIONS.map((_, i) => i), right: new Set(), wrongOnce: new Set() };
  // the tour is over once you reach the quiz
  if (passport.tourStop() >= 1) passport.setTourStop(7);
  ask();
}

export function unmount() {
  hush();
  run = null;
  const main = $('quiz-main');
  if (main) main.innerHTML = '';
}

function dots() {
  $('quiz-dots').innerHTML = QUESTIONS.map((q, i) => {
    const hue = ROOMS.find((r) => r.id === q.room).hue;
    const state = run.right.has(i) ? 'right' : run.queue[0] === i ? 'now' : run.wrongOnce.has(i) ? 'again' : '';
    return `<li class="${state}" style="--dot:${hue}"><span class="sr">Question ${i + 1}${state === 'right' ? ', answered' : ''}</span></li>`;
  }).join('');
}

function ask() {
  dots();
  const main = $('quiz-main');
  if (!run.queue.length) { done(); return; }
  const i = run.queue[0];
  const q = QUESTIONS[i];
  const room = ROOMS.find((r) => r.id === q.room);
  main.style.setProperty('--hue', room.hue);
  const again = run.wrongOnce.has(i);
  // a question in words shows the instrument it is about
  const who = q.words ? `<span class="who" aria-hidden="true">${art(q.about)}</span>` : '';
  let s = `<section class="q" aria-labelledby="q-ask"><div class="head">${who}<div><p class="qno">${again ? 'Try this one again' : `Question ${i + 1} of ${QUESTIONS.length}`} · ${esc(room.name)}</p>`;
  s += `<h3 id="q-ask" tabindex="-1">${esc(q.ask)}</h3></div></div>`;
  if (q.hear) s += `<button class="tool hear" type="button">${PLAY}<span>Play the sound</span></button>`;
  const choices = shuffle(q.pics || q.words);
  s += `<div class="choices ${q.pics ? 'pics' : 'words'}${choices.length === 2 ? ' two' : ''}" role="group" aria-label="Choices">`;
  for (const c of choices) {
    const label = q.pics ? byId[c].name : c;
    s += `<button class="choice" type="button" data-v="${esc(c)}">${q.pics ? `<span class="pic">${art(c)}</span>` : ''}<span class="t">${esc(label)}</span><span class="mark" aria-hidden="true"></span></button>`;
  }
  s += '</div><p class="why" role="status" hidden></p></section>';
  main.innerHTML = s;
  main.querySelector('.hear')?.addEventListener('click', () => hear(q.hear));
  for (const b of main.querySelectorAll('.choice')) b.addEventListener('click', () => answer(i, b));
  // a question by ear plays as it comes up, once the browser lets sound play
  if (q.hear) hear(q.hear);
  main.querySelector('h3').focus({ preventScroll: true });
}

function answer(i, button) {
  const q = QUESTIONS[i];
  const main = $('quiz-main');
  if (main.querySelector('.choice[aria-disabled="true"]')) return;
  const right = button.dataset.v === q.answer;
  for (const b of main.querySelectorAll('.choice')) {
    b.setAttribute('aria-disabled', 'true');
    if (b === button) b.classList.add(right ? 'right' : 'wrong');
    if (b.dataset.v === q.answer) b.classList.add('answer');
  }
  button.querySelector('.mark').textContent = right ? '✓' : '✗';
  const why = main.querySelector('.why');
  why.hidden = false;
  why.innerHTML = `<b>${right ? 'Yes!' : 'Not quite.'}</b> ${esc(q.why)}`;
  run.queue.shift();
  if (right) run.right.add(i);
  else {
    run.wrongOnce.add(i);
    run.queue.push(i);     // it comes back at the end
  }
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'tool next';
  next.innerHTML = `${NEXT}<span>${run.queue.length ? 'Next question' : 'See your badge'}</span>`;
  next.addEventListener('click', () => { hush(); ask(); });
  main.querySelector('.q').append(next);
  next.focus();
  dots();
}

function done() {
  hush();
  const fresh = passport.earn('quiz');
  const perfect = run.wrongOnce.size === 0;
  const main = $('quiz-main');
  main.style.removeProperty('--hue');
  main.innerHTML = `<section class="won" aria-labelledby="won-title">${medal()}`
    + `<p class="qno">${perfect ? 'Six out of six, first time!' : 'All six answered!'}</p>`
    + `<h3 id="won-title" tabindex="-1">Museum Explorer</h3>`
    + `<p>${fresh ? 'You earned the Museum Explorer badge. It’s in your passport, in the lobby.' : 'You’ve earned this badge before. It’s in your passport, in the lobby.'}</p>`
    + `<div class="acts"><a class="tool next" href="#">${NEXT}<span>Back to the museum</span></a><a class="tool" href="#quiz" data-again>Take it again</a></div></section>`;
  main.querySelector('[data-again]').addEventListener('click', (e) => {
    // already on #quiz: start over without a new hash
    e.preventDefault();
    mount();
  });
  main.querySelector('h3').focus({ preventScroll: true });
  dots();
}

/* The badge: a gold medal on a ribbon striped in the six rooms' colours. */
let medals = 0;
export function medal(size = 160) {
  const k = `md${++medals}`;
  const stripes = ROOMS.map((r, i) => `<rect x="${30 + i * 10}" y="0" width="10" height="70" fill="${r.hue}"/>`).join('');
  return `<svg class="medal" viewBox="0 0 120 150" width="${size}" height="${size * 1.25}" aria-hidden="true">`
    + `<defs><radialGradient id="${k}-gold" cx=".38" cy=".32" r=".8">`
    + '<stop offset="0" stop-color="#FFF4C4"/><stop offset=".4" stop-color="#E9C46A"/><stop offset=".8" stop-color="#B5852A"/><stop offset="1" stop-color="#7A5313"/></radialGradient>'
    + `<clipPath id="${k}-rib"><path d="M30 0H90V58L60 78L30 58Z"/></clipPath></defs>`
    + `<g clip-path="url(#${k}-rib)">${stripes}</g><path d="M30 0H90V58L60 78L30 58Z" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1.5"/>`
    + '<circle cx="60" cy="98" r="44" fill="#000" opacity=".18"/>'
    + `<circle cx="60" cy="95" r="44" fill="url(#${k}-gold)" stroke="#7A5313" stroke-width="2"/>`
    + '<circle cx="60" cy="95" r="35" fill="none" stroke="#7A5313" stroke-opacity=".5" stroke-width="1.5" stroke-dasharray="2 3"/>'
    // two beamed eighth notes
    + '<g fill="#5A3B0B"><ellipse cx="47" cy="111" rx="8.5" ry="6.2" transform="rotate(-20 47 111)"/><ellipse cx="73" cy="105" rx="8.5" ry="6.2" transform="rotate(-20 73 105)"/>'
    + '<rect x="53.2" y="76" width="3.4" height="35"/><rect x="79.2" y="70" width="3.4" height="35"/><path d="M53.2 76L82.6 70V79L53.2 85Z"/></g>'
    + '<path d="M30 72a34 34 0 0 1 22-14" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>'
    + '</svg>';
}

/* Play the start of an instrument's own tune, on its own sound. */
async function hear(id) {
  hush();
  const ex = byId[id];
  const t = LESSONS[id].tune;
  const evs = score.events(t.voices, { bpm: t.bpm, shift: -(ex.written || 0) }).filter((e) => e.midi != null && e.at < 4.5);
  if (!evs.length) return;
  const ms = evs.map((e) => e.midi);
  let inst;
  try { inst = await pitched(SAMPLE[id], Math.min(...ms), Math.max(...ms)); } catch { return; }
  if (!run) return;
  const t0 = now() + 0.1;
  for (const e of evs) voices.push(inst.play(e.midi, { at: t0 + e.at, dur: e.dur * 0.95, vel: e.vel, vol: 0.85 }));
}

function hush() {
  for (const v of voices) { try { v.stop(0.08); } catch { /* done */ } }
  voices = [];
}
