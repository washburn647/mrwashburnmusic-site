/* An exhibit's placard (the ⓘ in its header): its drawing, or a photograph when the museum has
   one; its family, name, facts, range and size; a real piece to hear it in, when there is one;
   how it makes its sound (how.js), moving; and the way to its family, side by side (compare.js). */

import { ROOMS, byId, groupOf } from './data.js';
import { art } from './art.js';
import * as notes from './notes.js';
import { sizeText } from './gallery.js';
import { section } from './how.js';
import { lineup } from './compare.js';
import { PHOTOS, PIECES, url } from './media.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const dialog = () => $('placard');
let audio = null;

/* "Photo: Jane Smith, CC BY-SA 4.0" with the source linked. */
const credit = (what, m) => `${what}: ${esc(m.by)}, <a href="${esc(m.source)}" target="_blank" rel="noopener">${esc(m.license)}</a>`;

const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';

const time = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '–:––');

function piece(id) {
  const p = PIECES[id];
  if (!p) return '';
  return `<section class="pl-piece" aria-labelledby="pl-piece-h"><h3 id="pl-piece-h">Hear it in a real piece</h3>`
    + `<div class="player"><button class="play" id="pl-play" aria-label="Play ${esc(p.title)}">${PLAY}</button>`
    + `<div class="meta"><b>${esc(p.title)}</b><span>${esc(p.composer)}</span><small>Played by ${esc(p.played)}</small>`
    + `<div class="prog"><span id="pl-bar"></span></div><small class="t" id="pl-time">0:00</small></div></div>`
    + `<p class="credit">${credit('Recording', p)}</p></section>`;
}

function compareLink(id) {
  const g = groupOf(id);
  // in a sentence: "Trumpet, French horn, trombone and tuba"
  const names = g.members.map((m, i) => (i && !/^French /.test(byId[m].name) ? byId[m].name.toLowerCase() : byId[m].name));
  const list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `<a class="pl-compare" href="#compare/${g.id}"><span class="mini">${lineup(g, 200, 56, { labels: false }).svg}</span>`
    + `<span class="words"><b>Compare: ${esc(g.short)}</b><small>${esc(list)}, side by side</small></span><span class="go" aria-hidden="true">→</span></a>`;
}

export function open(ex) {
  const pl = dialog();
  const room = ROOMS.find((r) => r.id === ex.room);
  const photo = PHOTOS[ex.id];
  $('pl-art').innerHTML = photo
    ? `<img src="${esc(url(photo.file))}" alt="${esc(photo.alt)}" loading="lazy"><figcaption>${credit('Photo', photo)}</figcaption>`
    : art(ex.id, ex.name);
  $('pl-art').classList.toggle('photo', !!photo);
  $('pl-fam').textContent = room.name;
  $('pl-name').textContent = ex.name;
  $('pl-facts').innerHTML = ex.facts.map((t) => `<li>${t}</li>`).join('');
  const flats = !!ex.flats;
  $('pl-range').innerHTML = (ex.range
    ? `<div><dt>Range</dt><dd>${notes.full(ex.range[0] + (ex.written || 0), flats)} – ${notes.full(ex.range[1] + (ex.written || 0), flats)}</dd></div>`
    : '') + (ex.size ? `<div><dt>Size</dt><dd>${sizeText(ex.size)}</dd></div>` : '');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('pl-more').innerHTML = piece(ex.id)
    + `<section class="pl-how" aria-label="How it makes its sound">${section(ex.id, esc, { still })}</section>`
    + compareLink(ex.id);
  pl.style.setProperty('--hue', room.hue);
  wire(ex.id);
  pl.showModal();
  pl.querySelector('.card').scrollTop = 0;
}

/* The real piece's play button, bar and time. (Its own element, a: after the placard closes
   it still tells of its pause and its emptying, and `audio` is gone by then.) */
function wire(id) {
  stopPiece();
  const p = PIECES[id];
  const btn = $('pl-play');
  if (!p || !btn) return;
  const a = new Audio();
  audio = a;
  a.preload = 'none';
  a.src = url(p.file);
  const bar = $('pl-bar');
  const t = $('pl-time');
  const show = () => {
    const on = !a.paused;
    btn.innerHTML = on ? PAUSE : PLAY;
    btn.setAttribute('aria-label', `${on ? 'Pause' : 'Play'} ${p.title}`);
  };
  a.addEventListener('timeupdate', () => {
    bar.style.width = `${a.duration ? (100 * a.currentTime) / a.duration : 0}%`;
    t.textContent = `${time(a.currentTime)} / ${time(a.duration)}`;
  });
  a.addEventListener('play', show);
  a.addEventListener('pause', show);
  a.addEventListener('ended', show);
  btn.addEventListener('click', () => (a.paused ? a.play().catch(() => {}) : a.pause()));
}

function stopPiece() {
  if (!audio) return;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  audio = null;
}

export function close() {
  stopPiece();
  if (dialog().open) dialog().close();
}

dialog().addEventListener('close', () => {
  stopPiece();
  // the moving diagram stops with it
  $('pl-more').innerHTML = '';
});
