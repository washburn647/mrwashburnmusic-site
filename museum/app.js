/* The museum. Its places, by the address after the #:
     (nothing)       the lobby: the floor plan, the tour's ticket, the passport (lobby.js)
     room/strings    a walk through a room (gallery.js)
     tour/3          the tour's third stop: its room, with the docent's card (tour.js)
     quiz            the quiz at the end of the tour (quiz.js)
     compare/brass   a family side by side (compare.js)
     piano, violin…  an exhibit, to play; its ⓘ opens the placard (placard.js) */

import { ROOMS, GROUPS, byId } from './data.js';
import * as notes from './notes.js';
import { context } from './audio.js';
import * as coach from './coach.js';
import * as lobby from './lobby.js';
import * as gallery from './gallery.js';
import * as tour from './tour.js';
import * as quiz from './quiz.js';
import * as passport from './passport.js';
import * as compare from './compare.js';
import * as placard from './placard.js';

const $ = (id) => document.getElementById(id);
const hall = $('hall');
const galleryView = $('gallery');
const quizView = $('quiz');
const compareView = $('compare');
const exhibit = $('exhibit');
const stage = $('stage');
const tools = $('ex-tools');

export function route(hash) {
  const h = decodeURIComponent(hash.replace(/^#/, ''));
  if (byId[h]) return { view: 'exhibit', ex: byId[h] };
  const m = h.match(/^(room|tour|compare)\/([\w-]+)$/);
  if (m?.[1] === 'room' && ROOMS.some((r) => r.id === m[2])) return { view: 'gallery', room: m[2] };
  if (m?.[1] === 'tour' && tour.STOPS[+m[2] - 1]) return { view: 'gallery', room: tour.STOPS[+m[2] - 1].room, stop: +m[2] };
  if (m?.[1] === 'compare' && GROUPS.some((g) => g.id === m[2])) return { view: 'compare', group: m[2] };
  if (h === 'quiz') return { view: 'quiz' };
  return { view: 'lobby' };
}

/* What an instrument module gets: the readout, a place for its switches, and the coach (Listen
   and Try this), which hears what is played and borrows the instrument to play tunes. */
function kitFor(ex) {
  let shown = null;
  let pending = 0;
  const flats = !!ex.flats;
  const written = ex.written || 0;
  const nn = $('nn');
  const staffEl = $('staff');
  const readout = $('readout');
  readout.hidden = !ex.clef;
  readout.classList.add('empty');
  nn.textContent = '';
  staffEl.innerHTML = '';
  // The passport: played, when the visitor makes a sound (not when the instrument plays a tune).
  let marked = false;
  const mine = () => {
    if (marked || coach.state().show) return;
    marked = true;
    passport.play(ex.id);
  };
  return {
    perf: null,
    /* Show a sounding note (MIDI, may be fractional while sliding). null clears. how: 'fresh'
       for a new attack (a key struck, a string plucked: the same note again counts), 'show' to
       show it without its being played (a timpani being tuned). */
    note(midi, how) {
      const m = midi == null ? null : Math.round(midi + written);
      if (midi != null && how !== 'show' && (how === 'fresh' || m !== shown)) {
        coach.heard({ midi: Math.round(midi) });
        mine();
      }
      if (m === shown) return;
      shown = m;
      if (m == null) { readout.classList.add('idle'); return; }
      readout.classList.remove('idle', 'empty');
      staffEl.hidden = false;
      nn.innerHTML = `${notes.name(m, flats)}<sub>${notes.octave(m)}</sub>`;
      const clef = ex.clef === 'grand' ? (m >= 60 ? 'treble' : 'bass') : ex.clef;
      const ticket = ++pending;
      notes.staff(m, clef, flats).then((html) => { if (ticket === pending) staffEl.innerHTML = html; });
    },
    name: (midi) => notes.full(Math.round(midi + written), flats),
    /* A drum or part struck (its code in lessons.js: k, s, h...), or a chord strummed. */
    hit(part, how = {}) {
      // (for tests: how many strokes so far, and the last part struck)
      stage.museumHeard = { n: (stage.museumHeard?.n || 0) + 1, part };
      coach.heard({ part, ...how });
      mine();
    },
    chord(name) { coach.heard({ chord: name }); mine(); },
    /* How the instrument plays a tune by itself (see coach.js). */
    performer(p) { this.perf = p; },
    /* Show a word instead of a note (a chord name). */
    text(t) {
      shown = null;
      pending++;
      readout.classList.toggle('idle', !t);
      readout.classList.toggle('empty', !t);
      nn.textContent = t || '';
      staffEl.innerHTML = '';
      staffEl.hidden = true;
    },
    /* A two-way switch in the header. */
    toggle({ label, on = false, icon = '', onChange, key }) {
      const b = document.createElement('button');
      b.className = 'tool';
      b.setAttribute('aria-pressed', String(on));
      // On a narrow screen a switch with an icon shows just the icon (museum.css, span.word).
      b.innerHTML = icon ? `${icon}<span class="word">${label}</span>` : `<span>${label}</span>`;
      if (icon) b.setAttribute('aria-label', label);
      b.addEventListener('click', () => {
        on = !on;
        b.setAttribute('aria-pressed', String(on));
        onChange(on);
      });
      if (key) b.dataset.key = key;
      tools.append(b);
      return { set(v) { on = v; b.setAttribute('aria-pressed', String(v)); }, el: b };
    },
    /* A choice of a few, in the header. */
    choice({ options, value, onChange, label }) {
      const g = document.createElement('div');
      g.className = 'seg';
      g.setAttribute('role', 'radiogroup');
      g.setAttribute('aria-label', label);
      for (const o of options) {
        const b = document.createElement('button');
        b.setAttribute('role', 'radio');
        b.textContent = o.label;
        b.setAttribute('aria-checked', String(o.value === value));
        b.addEventListener('click', () => {
          value = o.value;
          g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
          onChange(value);
        });
        g.append(b);
      }
      tools.append(g);
      return g;
    },
  };
}

let unmount = null;
let token = 0;
let last = null;      // the place showing
let lastHash = null;  // and its address
let cameFrom = null;  // the address of the page before it in this visit, null if it is the first

/* Each page of the visit remembers the museum page before it, in its history entry, so the
   Back button knows it after the browser's Back and Forward and after a reload. */
function stamp(from) {
  const st = history.state;
  if (st && typeof st === 'object' && 'museumFrom' in st) return st.museumFrom;
  history.replaceState({ ...(st && typeof st === 'object' ? st : {}), museumFrom: from }, '');
  return from;
}

async function show() {
  const here = location.hash;
  const to = route(here);
  const was = last || {};
  cameFrom = stamp(last ? lastHash : null);
  last = to;
  lastHash = here;
  coach.unmount();
  unmount?.();
  unmount = null;
  stage.innerHTML = '';
  tools.innerHTML = '';
  tour.hideBar();
  placard.close();
  if (to.view !== 'gallery') { gallery.unmount(); tour.hideCard(); }
  if (to.view !== 'quiz') quiz.unmount();
  if (to.view !== 'compare') compare.unmount();
  if (to.view !== 'lobby') lobby.unmount();
  hall.hidden = to.view !== 'lobby';
  galleryView.hidden = to.view !== 'gallery';
  quizView.hidden = to.view !== 'quiz';
  compareView.hidden = to.view !== 'compare';
  exhibit.hidden = to.view !== 'exhibit';
  document.body.classList.toggle('in-room', to.view !== 'lobby');
  const mine = ++token;

  if (to.view === 'lobby') {
    document.title = 'Instrument Museum · Mr. Washburn Music';
    lobby.mount();
    // back from an exhibit, a room or a family: stand where you were on the plan; from the
    // tour or the quiz, at the ticket
    const back = was.view === 'exhibit' ? `#${was.ex.id}` : was.view === 'gallery' && !was.stop ? `#room/${was.room}` : was.view === 'compare' ? `#compare/${was.group}` : null;
    if (back) document.querySelector(`#hall a[href="${back}"]`)?.focus({ preventScroll: false });
    else if (was.stop || was.view === 'quiz') $('ticket').querySelector('a')?.focus({ preventScroll: true });
    return;
  }
  if (to.view === 'gallery') {
    const room = ROOMS.find((r) => r.id === to.room);
    document.title = `${to.stop ? `Tour stop ${to.stop}: ` : ''}${room.name} · Instrument Museum`;
    let from = 'left';
    try { from = sessionStorage.getItem('museum-door') || 'left'; sessionStorage.removeItem('museum-door'); } catch { /* fine */ }
    // back from an exhibit in this room: stand in front of it again
    const focus = to.stop ? tour.STOPS[to.stop - 1].id : was.view === 'exhibit' && was.ex.room === to.room ? was.ex.id : null;
    const stopId = to.stop ? tour.STOPS[to.stop - 1].id : null;
    if (to.stop) tour.showCard(to.stop);
    else tour.hideCard();
    gallery.mount(to.room, { focus, from, stop: stopId, stopNo: to.stop, played: passport.played() });
    if (focus && was.view === 'exhibit' && was.ex.id === focus) document.querySelector(`#track a[href="#${focus}"]`)?.focus({ preventScroll: true });
    // at a new stop, the docent's Hear it play is next for the keyboard
    if (to.stop && !galleryView.contains(document.activeElement)) $('docent').querySelector('.hear')?.focus({ preventScroll: true });
    return;
  }
  if (to.view === 'quiz') {
    document.title = 'Museum quiz · Instrument Museum';
    quiz.mount();
    return;
  }
  if (to.view === 'compare') {
    document.title = `${GROUPS.find((g) => g.id === to.group).name}, side by side · Instrument Museum`;
    compare.mount(to.group);
    $('cmp-main').scrollTop = 0;
    return;
  }

  const ex = to.ex;
  exhibit.dataset.room = ex.room;
  exhibit.style.setProperty('--hue', ROOMS.find((r) => r.id === ex.room).hue);
  $('ex-name').textContent = ex.name;
  document.title = `${ex.name} · Instrument Museum`;
  stage.dataset.play = ex.play;
  stage.classList.add('loading');
  tour.showBar(ex);
  const mod = await import(`./play/${ex.play}.js`);
  if (mine !== token) return;
  const kit = kitFor(ex);
  unmount = await mod.mount(stage, ex, kit);
  if (mine !== token) { unmount?.(); unmount = null; return; }
  coach.mount(ex, kit);
  stage.classList.remove('loading');
  // Hear it play, from the tour: the instrument plays its own tune
  let auto = null;
  try { auto = sessionStorage.getItem('museum-autoplay'); sessionStorage.removeItem('museum-autoplay'); } catch { /* fine */ }
  if (auto === ex.id && kit.perf) {
    const t = coach.tune(ex, 3);
    coach.play(t.evs, t);
  }
}

$('info').addEventListener('click', () => { const ex = byId[decodeURIComponent(location.hash.slice(1))]; if (ex) placard.open(ex); });
$('placard-close').addEventListener('click', () => placard.close());
$('placard').addEventListener('click', (e) => { if (e.target.id === 'placard') placard.close(); });
/* Back. An exhibit goes back to where you came from in the museum (the plan, its room, a tour
   stop, a family side by side), or up to its room if you came straight to it. A family side
   by side goes back to where you came from too, or to the floor plan. A room and the quiz go
   to the floor plan. The browser's own Back is used only when the page before is that place,
   so this button never takes you out of the museum, and never round the rooms you walked
   through. */
for (const b of document.querySelectorAll('.back')) {
  b.addEventListener('click', (e) => {
    e.preventDefault();
    const from = cameFrom == null ? null : route(cameFrom);
    if (last.view === 'exhibit') {
      if (from) history.back();
      else location.hash = `room/${last.ex.room}`;
    } else if (last.view === 'compare' && from) history.back();
    else if (from?.view === 'lobby') history.back();
    else location.hash = '';
  });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-from]');
  // through a door: come in by the matching door of the next room
  if (a) try { sessionStorage.setItem('museum-door', a.dataset.from); } catch { /* fine */ }
});
$('gal-prev').addEventListener('click', () => gallery.step(-1));
$('gal-next').addEventListener('click', () => gallery.step(1));
document.addEventListener('keydown', (e) => {
  if (galleryView.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest('input, textarea, select, #docent')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const links = [...document.querySelectorAll('#track .door, #track .bay')].sort((a, b) => a.offsetLeft - b.offsetLeft);
    const at = links.indexOf(document.activeElement);
    if (at < 0) { gallery.step(e.key === 'ArrowRight' ? 1 : -1); return; }
    const next = links[at + (e.key === 'ArrowRight' ? 1 : -1)];
    if (next) {
      next.focus({ preventScroll: true });
      next.scrollIntoView({ inline: 'center', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }
});
passport.onChange(() => { if (!hall.hidden) lobby.mount(); });
// Keep the browser from scrolling or zooming the page while an instrument is played.
document.addEventListener('gesturestart', (e) => e.preventDefault());
window.addEventListener('hashchange', show);
document.addEventListener('pointerdown', () => context(), { once: true });

show();
