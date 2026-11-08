/* The museum: the hall of exhibits, and each exhibit's room (#piano, #violin, ...). */

import { ROOMS, EXHIBITS, byId } from './data.js';
import { art } from './art.js';
import * as notes from './notes.js';
import { context } from './audio.js';

const $ = (id) => document.getElementById(id);
const hall = $('hall');
const exhibit = $('exhibit');
const stage = $('stage');
const tools = $('ex-tools');
const placard = $('placard');

function buildHall() {
  const rooms = $('rooms');
  for (const room of ROOMS) {
    const sec = document.createElement('section');
    sec.className = 'room';
    sec.style.setProperty('--hue', room.hue);
    sec.innerHTML = `<h2>${room.name}</h2><ul class="cases"></ul>`;
    const ul = sec.querySelector('ul');
    for (const ex of EXHIBITS.filter((e) => e.room === room.id)) {
      const li = document.createElement('li');
      li.innerHTML = `<a class="case" href="#${ex.id}"><span class="plinth">${art(ex.id)}</span><span class="tag">${ex.name}</span></a>`;
      ul.append(li);
    }
    rooms.append(sec);
  }
}

/* What an instrument module gets: the readout, a place for its switches. */
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
  return {
    /* Show a sounding note (MIDI, may be fractional while sliding). null clears. */
    note(midi) {
      const m = midi == null ? null : Math.round(midi + written);
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
      b.innerHTML = icon ? `${icon}<span>${label}</span>` : `<span>${label}</span>`;
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

async function show() {
  const id = location.hash.slice(1);
  const ex = byId[id];
  unmount?.();
  unmount = null;
  stage.innerHTML = '';
  tools.innerHTML = '';
  if (placard.open) placard.close();
  if (!ex) {
    exhibit.hidden = true;
    hall.hidden = false;
    document.title = 'Instrument Museum · Mr. Washburn Music';
    document.body.classList.remove('in-room');
    const back = sessionStorage.getItem('museum-from');
    if (back) document.querySelector(`a[href="#${back}"]`)?.focus({ preventScroll: false });
    return;
  }
  try { sessionStorage.setItem('museum-from', id); } catch { /* private mode */ }
  hall.hidden = true;
  exhibit.hidden = false;
  document.body.classList.add('in-room');
  exhibit.dataset.room = ex.room;
  exhibit.style.setProperty('--hue', ROOMS.find((r) => r.id === ex.room).hue);
  $('ex-name').textContent = ex.name;
  document.title = `${ex.name} · Instrument Museum`;
  const mine = ++token;
  stage.dataset.play = ex.play;
  stage.classList.add('loading');
  const mod = await import(`./play/${ex.play}.js`);
  if (mine !== token) return;
  const kit = kitFor(ex);
  unmount = await mod.mount(stage, ex, kit);
  if (mine !== token) { unmount?.(); unmount = null; return; }
  stage.classList.remove('loading');
}

function openPlacard() {
  const ex = byId[location.hash.slice(1)];
  if (!ex) return;
  $('pl-art').innerHTML = art(ex.id, ex.name);
  $('pl-fam').textContent = ROOMS.find((r) => r.id === ex.room).name;
  $('pl-name').textContent = ex.name;
  $('pl-facts').innerHTML = ex.facts.map((f) => `<li>${f}</li>`).join('');
  const flats = !!ex.flats;
  $('pl-range').innerHTML = ex.range
    ? `<dt>Range</dt><dd>${notes.full(ex.range[0] + (ex.written || 0), flats)} – ${notes.full(ex.range[1] + (ex.written || 0), flats)}</dd>`
    : '';
  placard.style.setProperty('--hue', ROOMS.find((r) => r.id === ex.room).hue);
  placard.showModal();
}

$('info').addEventListener('click', openPlacard);
$('placard-close').addEventListener('click', () => placard.close());
placard.addEventListener('click', (e) => { if (e.target === placard) placard.close(); });
document.querySelector('.back').addEventListener('click', (e) => {
  e.preventDefault();
  if (history.length > 1 && sessionStorage.getItem('museum-entered')) history.back();
  else location.hash = '';
});
document.addEventListener('click', (e) => {
  if (e.target.closest('a.case')) { try { sessionStorage.setItem('museum-entered', '1'); } catch { /* fine */ } }
});
// Keep the browser from scrolling or zooming the page while an instrument is played.
document.addEventListener('gesturestart', (e) => e.preventDefault());
window.addEventListener('hashchange', show);
document.addEventListener('pointerdown', () => context(), { once: true });

buildHall();
show();
