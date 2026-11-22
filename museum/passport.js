/* The visitor's museum passport, kept in this browser: the instruments they have played (a
   room's stamp comes with the first one played there, a gold stamp with all of them), how far
   they are through the audio tour, and their badges. */

import { ROOMS, EXHIBITS } from './data.js';

const KEY = 'museum-passport';
const listeners = new Set();

export function read() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY)) || {};
    return { played: p.played || [], badges: p.badges || {}, tour: p.tour || 0 };
  } catch {
    return { played: [], badges: {}, tour: 0 };
  }
}

function write(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* a private window: it lasts this visit */ }
  listeners.forEach((fn) => fn(p));
}

export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const played = () => new Set(read().played);

/* The visitor played this instrument. Gives true the first time. */
export function play(id) {
  const p = read();
  if (p.played.includes(id)) return false;
  p.played.push(id);
  if (EXHIBITS.every((e) => p.played.includes(e.id))) p.badges.maestro ||= today();
  write(p);
  return true;
}

/* Each room's stamp: 'gold' when every instrument in it has been played, 'stamp' for some, '' for none. */
export function stamps() {
  const mine = played();
  return Object.fromEntries(ROOMS.map((r) => {
    const all = EXHIBITS.filter((e) => e.room === r.id);
    const n = all.filter((e) => mine.has(e.id)).length;
    return [r.id, n === all.length ? 'gold' : n ? 'stamp' : ''];
  }));
}

/* The tour: the stop the visitor is at (1 to 6), 7 once they reach the quiz, 0 before it starts. */
export function tourStop() { return read().tour; }
export function setTourStop(n) {
  const p = read();
  p.tour = n;
  write(p);
}

/* Badges: tour (all six stops), quiz (the quiz passed), maestro (every instrument played). */
export function earn(name) {
  const p = read();
  if (p.badges[name]) return false;
  p.badges[name] = today();
  write(p);
  return true;
}
export const badges = () => read().badges;

function today() { return new Date().toISOString().slice(0, 10); }
