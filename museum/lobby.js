/* The lobby: the audio tour's ticket, the visitor's passport, and the floor plan (plan.js),
   drawn again for the width it has when the window changes size. */

import { ROOMS, EXHIBITS, GROUPS } from './data.js';
import { art } from './art.js';
import { plan } from './plan.js';
import * as passport from './passport.js';
import { STOPS, title } from './tour.js';
import { medal } from './quiz.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const HEADPHONES = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-3a8 8 0 0 1 16 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="3" y="14" width="5" height="7" rx="2" fill="currentColor"/><rect x="16" y="14" width="5" height="7" rx="2" fill="currentColor"/></svg>';

let drawn = '';
let ro = null;

export function mount() {
  ticket();
  stamps();
  families();
  draw();
  if (!ro) {
    ro = new ResizeObserver(() => draw());
    ro.observe($('plan'));
  }
}

export function unmount() {
  ro?.disconnect();
  ro = null;
}

/* The plan, for the width it has (not again if nothing changed). */
function draw() {
  const box = $('plan');
  const w = Math.floor(box.clientWidth);
  if (!w) return;
  const played = passport.played();
  const key = `${w}:${[...played].sort().join()}`;
  if (key === drawn) return;
  drawn = key;
  box.innerHTML = plan(w, { played });
}

function ticket() {
  const stop = passport.tourStop();
  const b = passport.badges();
  let words;
  let go;
  if (stop >= 1 && stop <= STOPS.length) {
    words = `You’re at stop ${stop} of ${STOPS.length}: ${esc(title(stop).toLowerCase())}.`;
    go = `<a class="tool go" href="#tour/${stop}">Carry on the tour</a><a class="tool" href="#tour/1">Start again</a>`;
  } else if (stop > STOPS.length && !b.quiz) {
    words = 'You’ve finished the tour. Ready for the quiz?';
    go = '<a class="tool go" href="#quiz">Take the quiz</a><a class="tool" href="#tour/1">Tour again</a>';
  } else {
    words = 'Six stops, one in each room. Hear each instrument play, then take the quiz to earn your badge.';
    go = `<a class="tool go" href="#tour/1">${b.quiz ? 'Take the tour again' : 'Start the tour'}</a>${b.quiz ? '<a class="tool" href="#quiz">Quiz again</a>' : ''}`;
  }
  $('ticket').innerHTML = `<div class="stub">${HEADPHONES}</div><div class="body"><h2>Audio tour</h2><p>${words}</p><div class="acts">${go}</div></div>`;
}

/* The families, each to see side by side (compare.js), with one of its instruments. */
const FACE = { violins: 'cello', plucked: 'guitar', woodwinds: 'clarinet', brass: 'horn', keys: 'xylophone', drums: 'congas', bells: 'tambourine' };

function families() {
  const box = $('families');
  if (box.childElementCount) return;
  box.innerHTML = '<h2>Side by side</h2><div class="fam-row">'
    + GROUPS.map((g) => `<a class="fam" href="#compare/${g.id}"><span class="pic" aria-hidden="true">${art(FACE[g.id])}</span><span>${esc(g.short)}</span></a>`).join('')
    + '</div>';
}

/* Each room's stamp shows one of its instruments. */
const SEAL = { keyboard: 'piano', strings: 'violin', woodwinds: 'saxophone', brass: 'trumpet', percussion: 'drums', world: 'congas' };

function stamps() {
  const st = passport.stamps();
  const played = passport.played();
  const b = passport.badges();
  let s = '<h2>My passport</h2><ol class="stamps">';
  ROOMS.forEach((r, i) => {
    const kind = st[r.id];
    const n = EXHIBITS.filter((e) => e.room === r.id && played.has(e.id)).length;
    const all = EXHIBITS.filter((e) => e.room === r.id).length;
    const tilt = [-8, 5, -3, 9, -6, 4][i];
    const name = r.name.replace('Around the world', 'World');
    s += `<li class="stamp ${kind || 'none'}" style="--st:${r.hue};--tilt:${tilt}deg" title="${esc(r.name)}: ${n} of ${all} played">`
      + `<span class="seal" aria-hidden="true">${art(SEAL[r.id])}</span><span class="name" aria-hidden="true">${esc(name)}</span>`
      + `<span class="sr">${esc(r.name)}: ${n} of ${all} played${kind === 'gold' ? ', all of them' : ''}</span></li>`;
  });
  s += '</ol>';
  s += `<p class="count"><b>${played.size}</b> of ${EXHIBITS.length} instruments played</p>`;
  const got = [];
  if (b.tour) got.push(['Toured', 'tour']);
  if (b.quiz) got.push(['Museum Explorer', 'quiz']);
  if (b.maestro) got.push(['Maestro: played them all', 'maestro']);
  if (got.length) s += `<ul class="badges">${got.map(([t, k]) => `<li class="badge-${k}">${k === 'quiz' ? medal(22) : '★'}<span>${esc(t)}</span></li>`).join('')}</ul>`;
  $('passport').innerHTML = s;
}
