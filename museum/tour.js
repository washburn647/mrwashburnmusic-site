/* The audio tour: six stops, one in each room (#tour/1 to #tour/6). At each stop the gallery
   stands you in front of one instrument, and the docent's card says what to look and listen
   for. Hear it play opens the instrument and plays its own tune on it, pressing its own keys
   and strings; Next stop walks on. After the last stop comes the quiz (quiz.js). The card can
   read itself aloud, for visitors still learning to read. */

import { ROOMS, byId } from './data.js';
import * as passport from './passport.js';

export const STOPS = [
  {
    room: 'keyboard', id: 'piano',
    say: 'Welcome to the Keyboards room! Press a piano key, and a little felt hammer inside jumps up and strikes steel strings. So a piano is a string instrument and a percussion instrument at once.',
    listen: 'Listen for Für Elise, by Beethoven. Its notes ring on after the hammer has struck.',
  },
  {
    room: 'strings', id: 'violin',
    say: 'The violin is the smallest of the string family, so it sings the highest. Walk along the wall: the viola, the cello and the double bass are each bigger, and lower.',
    listen: 'Listen for the bow pulling a long, singing sound from the strings in Vivaldi’s Spring.',
  },
  {
    room: 'woodwinds', id: 'flute',
    say: 'The flute has no reed. You blow across a hole, like blowing across the top of a bottle. The clarinet, oboe, saxophone and bassoon all have a reed that buzzes.',
    listen: 'Listen for the flute’s airy voice: the sun coming up in Grieg’s Morning Mood.',
  },
  {
    room: 'brass', id: 'trumpet',
    say: 'A trumpet player buzzes their lips into the mouthpiece. Its three valves send the air round extra tubing to make lower notes.',
    listen: 'Taps needs no valves at all: the player just tightens and loosens their lips.',
  },
  {
    room: 'percussion', id: 'timpani',
    say: 'Most drums can’t play a tune, but timpani can. Press the pedal and the drumhead stretches tighter, and the note goes up.',
    listen: 'Listen for the timpani pounding out two notes, C and G, in Also sprach Zarathustra.',
  },
  {
    room: 'world', id: 'kalimba',
    say: 'The kalimba grew from African instruments like the mbira of Zimbabwe. You pluck its metal tines with your thumbs: a shorter tine plays a higher note.',
    listen: 'Listen for rolling chords, one thumb and then the other.',
  },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const $ = (id) => document.getElementById(id);
const HEADPHONES = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-3a8 8 0 0 1 16 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="3" y="14" width="5" height="7" rx="2" fill="currentColor"/><rect x="16" y="14" width="5" height="7" rx="2" fill="currentColor"/></svg>';
const SPEAK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
const NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const title = (n) => `The ${byId[STOPS[n - 1].id].name.toLowerCase()}`;

/* The docent's card for stop n, in the gallery. */
export function showCard(n) {
  const st = STOPS[n - 1];
  const ex = byId[st.id];
  const room = ROOMS.find((r) => r.id === st.room);
  const last = n === STOPS.length;
  const box = $('docent');
  box.innerHTML = `<div class="who">${HEADPHONES}<span class="no">${n}</span></div>`
    + `<div class="said"><p class="where">Stop ${n} of ${STOPS.length} · ${esc(room.name)}</p>`
    + `<h3 id="docent-title">${esc(title(n))}</h3><p class="say">${esc(st.say)}</p><p class="listen">${esc(st.listen)}</p></div>`
    + '<div class="acts">'
    + `<a class="tool hear" href="#${ex.id}" data-autoplay="${ex.id}">${PLAY}<span>Hear it play</span></a>`
    + (last ? `<a class="tool next" href="#quiz">${NEXT}<span>Take the quiz</span></a>` : `<a class="tool next" href="#tour/${n + 1}">${NEXT}<span>Next stop</span></a>`)
    + ('speechSynthesis' in window ? `<button class="tool speak" type="button" aria-pressed="false">${SPEAK}<span class="word">Read to me</span></button>` : '')
    + '</div>'
    + '<a class="end" href="#" aria-label="End the tour" title="End the tour"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></a>';
  box.setAttribute('aria-labelledby', 'docent-title');
  box.hidden = false;
  // the stop the visitor is at, so a second tour shows its bar in each exhibit again
  passport.setTourStop(n);
  if (last) passport.earn('tour');
  box.querySelector('.hear').addEventListener('click', () => {
    try { sessionStorage.setItem('museum-autoplay', ex.id); } catch { /* fine */ }
  });
  const speak = box.querySelector('.speak');
  speak?.addEventListener('click', () => {
    const on = speak.getAttribute('aria-pressed') !== 'true';
    speechSynthesis.cancel();
    speak.setAttribute('aria-pressed', String(on));
    if (!on) return;
    const u = new SpeechSynthesisUtterance(`Stop ${n}. ${title(n)}. ${st.say} ${st.listen}`);
    u.rate = 0.95;
    u.onend = () => speak.setAttribute('aria-pressed', 'false');
    speechSynthesis.speak(u);
  });
}

export function hideCard() {
  const box = $('docent');
  if (!box) return;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  box.hidden = true;
  box.innerHTML = '';
}

/* In an exhibit that is a tour stop: the bar with the next stop. */
export function showBar(ex) {
  const bar = $('tourbar');
  const n = STOPS.findIndex((s) => s.id === ex.id) + 1;
  // only while the visitor is at this stop (they came here from its card)
  const on = n > 0 && passport.tourStop() === n;
  bar.hidden = !on;
  if (!on) { bar.innerHTML = ''; return; }
  const last = n === STOPS.length;
  bar.innerHTML = `<span class="who">${HEADPHONES}<span class="no">${n}</span></span><span class="words"><b>Stop ${n} of ${STOPS.length}</b> ${esc(title(n))}</span>`
    + `<a class="tool" href="#tour/${n}">Back to the stop</a>`
    + (last ? `<a class="tool next" href="#quiz">${NEXT}<span>Take the quiz</span></a>` : `<a class="tool next" href="#tour/${n + 1}">${NEXT}<span>Next stop</span></a>`);
}

export function hideBar() {
  const bar = $('tourbar');
  if (bar) { bar.hidden = true; bar.innerHTML = ''; }
}
