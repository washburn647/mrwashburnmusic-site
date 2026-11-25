/* Compare (#compare/violins): a family of instruments side by side, drawn at their real sizes
   on one floor next to a ten-year-old; how high and low each one plays, on a piano's keyboard;
   how each makes its sound; and the same tune (or its rhythm) played on each in turn. */

import { ROOMS, GROUPS, byId } from './data.js';
import { BOX } from './art.js';
import { figure } from './plan.js';
import { sizeText } from './gallery.js';
import { KINDS, HOW, diagram } from './how.js';
import * as notes from './notes.js';
import { LESSONS } from './lessons.js';
import { events, midi as midiOf, length } from './score.js';
import { context, pitched, hit } from './audio.js';
import { SPECS } from './play/perc.js';

const $ = (id) => document.getElementById(id);
const f = (x) => Math.round(x * 10) / 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const hueOf = (id) => ROOMS.find((r) => r.id === byId[id].room).hue;
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const KID = 140;  // a ten-year-old, cm
/* A child standing, 40 by 140 units (one unit a centimetre). */
const CHILD = '<circle cx="20" cy="12" r="11"/><path d="M8 30Q20 23 32 30L34 72Q20 76 6 72Z"/>'
  + '<path d="M9 31Q3 50 5 73M31 31Q37 50 35 73" fill="none" stroke-width="6" stroke-linecap="round"/>'
  + '<path d="M14.5 72L13.5 134M25.5 72L26.5 134" fill="none" stroke-width="8" stroke-linecap="round"/>'
  + '<ellipse cx="12" cy="137" rx="6" ry="3"/><ellipse cx="28" cy="137" rx="6" ry="3"/>';

/* "2 feet long (60 cm)" as ["2 feet long", "60 cm"]. */
const sizeLines = (size) => {
  const m = /^(.*) \((.*)\)$/.exec(sizeText(size));
  return m ? [m[1], m[2]] : [sizeText(size), ''];
};

/* The family standing on one floor at one scale, the ten-year-old first, for a box w pixels
   wide and h high (the drawings' part of it). Bigger than that only if the smallest would
   shrink out of sight (under 18 pixels): then it is wider than w, to scroll, and taller than
   h if it must be (a kalimba beside an organ, on a phone). labels: names and sizes under
   them, and each a link to its exhibit; without them it is a little picture, which keeps to
   its h, and has no ten-year-old. */
export function lineup(group, w, h, { labels = true } = {}) {
  const GAP = labels ? 8 : 5;
  // room for the words under each, about 7.4 px a letter of the name, 6.3 of its size
  const room = (name, lines) => (labels ? Math.max(name.length * 7.4, ...lines.map((l) => l.length * 6.3)) + 10 : 0);
  const items = labels ? [{ kid: true, wcm: 40, hcm: KID, lab: room('A ten-year-old', ['4½ feet tall']) }] : [];
  for (const id of group.members) {
    const [x0, y0, x1, y1, cm] = BOX[id];
    const big = Math.max(x1 - x0, y1 - y0);
    items.push({ id, ex: byId[id], wcm: (cm * (x1 - x0)) / big, hcm: (cm * (y1 - y0)) / big, cm, big, lab: room(byId[id].name, sizeLines(byId[id].size)) });
  }
  const tall = Math.max(...items.map((i) => i.hcm));
  const least = Math.min(...items.map((i) => Math.max(i.wcm, i.hcm)));
  const span = (k) => items.reduce((a, i) => a + Math.max(i.wcm * k, i.lab) + GAP, GAP);
  let k = h / tall;
  const min = (labels ? 18 : 9) / least;
  while (k > min && span(k) > w) k *= 0.97;
  k = Math.max(k, labels ? min : Math.min(min, h / tall));
  const W = span(k);
  const top = labels ? 26 : 4;
  const floor = top + tall * k;
  const H = floor + (labels ? 58 : 6);
  let s = `<svg class="lineup-svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}" height="${f(H)}" role="${labels ? 'group' : 'img'}" aria-label="${esc(labels ? `${group.name}, side by side at their real sizes` : `${group.name} side by side`)}">`;
  s += `<rect x="0" y="${f(floor)}" width="${f(W)}" height="${labels ? 9 : 3}" fill="#C9A06A"/><rect x="0" y="${f(floor)}" width="${f(W)}" height="1.5" fill="#8A6A3A"/>`;
  let x = GAP;
  for (const it of items) {
    const slot = Math.max(it.wcm * k, it.lab);
    const cx = x + slot / 2;
    x += slot + GAP;
    if (it.kid) {
      s += `<g class="kid" aria-hidden="true"><g transform="translate(${f(cx - 20 * k)} ${f(floor - KID * k)}) scale(${f(k * 100) / 100})" fill="#8DA595" stroke="#8DA595">${CHILD}</g>`;
      if (labels) s += `<text x="${f(cx)}" y="${f(floor + 24)}" text-anchor="middle" class="nm">A ten-year-old</text><text x="${f(cx)}" y="${f(floor + 39)}" text-anchor="middle" class="sz">4½ feet tall</text><text x="${f(cx)}" y="${f(floor + 53)}" text-anchor="middle" class="sz">1.4 m</text>`;
      s += '</g>';
      continue;
    }
    const sc = (it.cm * k * 120) / it.big;
    const fig = `<g class="fig">${figure(it.id, cx, floor, sc, { shadow: labels })}</g>`;
    if (!labels) { s += fig; continue; }
    const [us, metric] = sizeLines(it.ex.size);
    const figTop = floor - it.hcm * k;
    s += `<a class="mem" href="#${it.id}" data-id="${it.id}" aria-label="${esc(it.ex.name)}, ${esc(sizeText(it.ex.size))}">`
      + `<rect class="ring" x="${f(cx - slot / 2)}" y="${f(Math.min(figTop, floor - 30) - 6)}" width="${f(slot)}" height="${f(H - Math.min(figTop, floor - 30) + 4)}" rx="10"/>`
      + `<text class="ping" x="${f(cx)}" y="${f(figTop - 6)}" text-anchor="middle" aria-hidden="true">♪</text>`
      + fig
      + `<text x="${f(cx)}" y="${f(floor + 24)}" text-anchor="middle" class="nm">${esc(it.ex.name)}</text>`
      + `<text x="${f(cx)}" y="${f(floor + 39)}" text-anchor="middle" class="sz">${esc(us)}</text>`
      + `<text x="${f(cx)}" y="${f(floor + 53)}" text-anchor="middle" class="sz">${esc(metric)}</text></a>`;
  }
  return { svg: `${s}</svg>`, k, width: W, height: H };
}

/* ---------- ranges, on a piano's keyboard (A0 to C8) ---------- */
const LOW = 21;
const HIGH = 108;
const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
const isWhite = (m) => WHITE.has(m % 12);
const whites = (m) => { let n = 0; for (let i = LOW; i < m; i++) if (isWhite(i)) n++; return n; };
const N = whites(HIGH + 1);
/* Where key m's left and right edges are, 0 to 1 across the keyboard. */
const left = (m) => (isWhite(m) ? whites(m) : whites(m) - 0.32) / N;
const right = (m) => (isWhite(m) ? whites(m) + 1 : whites(m) + 0.32) / N;

function keyboard() {
  const u = 10;
  let s = `<svg class="kb" viewBox="0 0 ${N * u} 46" preserveAspectRatio="none" aria-hidden="true">`;
  for (let m = LOW; m <= HIGH; m++) if (isWhite(m)) s += `<rect data-m="${m}" x="${whites(m) * u}" y="0" width="${u}" height="44" rx="1.5" fill="${m === 60 ? '#F6DB8C' : '#FFFDF7'}" stroke="#9C9384" stroke-width=".8"/>`;
  for (let m = LOW; m <= HIGH; m++) if (!isWhite(m)) s += `<rect data-m="${m}" x="${f((whites(m) - 0.32) * u)}" y="0" width="${f(0.64 * u)}" height="27" rx="1" fill="#26221E"/>`;
  return `${s}</svg>`;
}

function ranges(group) {
  const list = group.members.map((id) => byId[id]).filter((ex) => ex.range);
  if (!list.length) return '';
  let s = '<section class="cmp-card ranges" aria-labelledby="cmp-rg-h"><h3 id="cmp-rg-h">How high and low they play</h3>'
    + '<p class="hint">Each bar shows the notes it plays, laid along a piano’s keys. Tap one to hear its lowest note and its highest.</p><div class="rg">';
  const mc = ((left(60) + right(60)) / 2) * 100;
  for (const ex of list) {
    const [lo, hi] = ex.range;
    const a = left(lo) * 100;
    const b = right(hi) * 100;
    const words = `${notes.full(lo, ex.flats)} to ${notes.full(hi, ex.flats)}`;
    const where = b - a >= 26 ? 'in' : b < 72 ? 'after' : 'before';
    s += `<button class="rg-row" data-id="${ex.id}" style="--c:${hueOf(ex.id)}" aria-label="${esc(ex.name)}: ${esc(words)}. Hear its lowest and highest notes"><span class="nm">${esc(ex.name)}</span>`
      + `<span class="track"><span class="rng" style="left:${f(a)}%;width:${f(b - a)}%"><i class="lo"></i><i class="hi"></i><span class="notes ${where}">${esc(notes.full(lo, ex.flats))}–${esc(notes.full(hi, ex.flats))}</span></span></span></button>`;
  }
  s += `<div class="rg-kb"><span></span><span class="track">${keyboard()}<span class="mc" style="left:${f(mc)}%">Middle C</span></span></div>`;
  return `${s}<span class="mc-line" style="--mcf:${Math.round(mc * 10) / 1000}" aria-hidden="true"></span></div></section>`;
}

/* ---------- how each makes its sound ---------- */
function kinds(group) {
  const by = new Map();
  for (const id of group.members) {
    const k = HOW[id][0];
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(byId[id].name);
  }
  const quiet = still();
  let s = `<section class="cmp-card kinds" aria-labelledby="cmp-k-h"><h3 id="cmp-k-h">How they make their sound</h3><div class="kgrid">`;
  for (const [k, names] of by) {
    s += `<figure class="kd">${diagram(k, { still: quiet })}<figcaption><b>${esc(KINDS[k].name)}</b><span>${esc(names.join(', '))}</span></figcaption></figure>`;
  }
  return `${s}</div></section>`;
}

/* ---------- playing them ---------- */
const TWINKLE = 'C4 C4 G4 G4 A4 A4 G4-';
const BPM = 126;

/* What an exhibit sounds with: a pitched sample, or the hits it is played with. */
function voice(ex) {
  const o = ex.opts || {};
  if (ex.play === 'bowed') return { name: o.arco };
  if (ex.play === 'timpani') return { name: 'timpani' };
  if (ex.range && o.sound) return { name: o.sound };
  if (ex.play === 'perc') return { hits: [{ name: SPECS[o.kind].sound }] };
  if (ex.play === 'kit') return { hits: [{ name: 'kit-snare' }, { name: 'kit-kick' }], crash: 'kit-crash' };
  return { hits: (o.parts || []).map((p) => ({ name: p.sound, rate: p.rate || 1 })) };
}

let voices = [];
let playing = null;

function hush() {
  for (const v of voices) try { v.stop(0.08); } catch { /* done */ }
  voices = [];
}

/* Play the tune (or its rhythm) on ex, from now, unless run has been stopped by the time its
   sounds have loaded. Gives how long it lasts, in seconds. */
async function tune(ex, run) {
  const v = voice(ex);
  const home = LESSONS[ex.id]?.home;
  if (v.name && home) {
    const shift = midiOf(home) - 60 - (ex.written || 0);
    const evs = events(TWINKLE, { bpm: BPM, shift });
    const inst = await pitched(v.name, Math.min(...evs.map((e) => e.midi)) - 1, Math.max(...evs.map((e) => e.midi)) + 1);
    if (playing !== run) return 0;
    const t0 = context().currentTime + 0.08;
    for (const e of evs) voices.push(inst.play(e.midi, { at: t0 + e.at, dur: e.dur * 0.9, vol: 0.75, vel: 0.6 }));
    return length(evs) + 0.5;
  }
  const evs = events(TWINKLE, { bpm: BPM });
  const sounds = await Promise.all(v.hits.map((h) => hit(h.name)));
  const crash = v.crash ? await hit(v.crash) : null;
  if (playing !== run) return 0;
  const t0 = context().currentTime + 0.08;
  // the gong and the cymbals ring too long for every note: the gong plays the first, the
  // cymbals the first and the last
  const pick = ex.id === 'gong' ? [0] : ex.id === 'cymbals' ? [0, evs.length - 1] : evs.map((_, i) => i);
  for (const i of pick) {
    const e = evs[i];
    // two sounds: the high one (the first) on the high notes, the low one on C
    const j = sounds.length > 1 && e.midi < 65 ? sounds.length - 1 : 0;
    voices.push(sounds[j].play({ at: t0 + e.at, vol: 0.8, vel: 0.65, rate: v.hits[j].rate || 1 }));
    if (crash && i === evs.length - 1) voices.push(crash.play({ at: t0 + e.at, vol: 0.6, vel: 0.6 }));
  }
  return length(evs) + (ex.id === 'gong' ? 1.6 : 0.5);
}

const wait = (s, run) => new Promise((ok) => { const t = setTimeout(ok, s * 1000); run.timers.push(t); });

function light(id, on) {
  document.querySelectorAll(`#cmp-main [data-id="${id}"]`).forEach((el) => el.classList.toggle('lit', on));
  // the one playing, in view in a row too long for the screen
  const a = on && document.querySelector(`#cmp-line a[data-id="${id}"]`);
  const box = $('cmp-line');
  if (a && box.scrollWidth > box.clientWidth) {
    const r = a.getBBox();
    box.scrollTo({ left: r.x + r.width / 2 - box.clientWidth / 2, behavior: still() ? 'auto' : 'smooth' });
  }
}

async function hearAll(group, btn) {
  if (playing) { stop(); return; }
  context();
  const run = { timers: [] };
  playing = run;
  btn.setAttribute('aria-pressed', 'true');
  btn.querySelector('.word').textContent = 'Stop';
  const say = $('cmp-now');
  try {
    for (const id of group.members) {
      if (playing !== run) return;
      light(id, true);
      say.textContent = `Now playing: ${byId[id].name}`;
      const secs = await tune(byId[id], run);
      await wait(secs, run);
      light(id, false);
    }
  } finally {
    if (playing === run) stop();
  }
}

async function hearRange(ex, row) {
  if (playing) stop();
  context();
  const run = { timers: [] };
  playing = run;
  const v = voice(ex);
  const [lo, hi] = ex.range;
  const [a, b] = await Promise.all([pitched(v.name, lo, lo), pitched(v.name, hi, hi)]);
  if (playing !== run) return;
  const t0 = context().currentTime + 0.05;
  voices.push(a.play(lo, { at: t0, dur: 1.1, vol: 0.85 }), b.play(hi, { at: t0 + 1.3, dur: 1.1, vol: 0.85 }));
  $('cmp-now').textContent = `${ex.name}: lowest ${notes.full(lo, ex.flats)}, highest ${notes.full(hi, ex.flats)}`;
  row.classList.add('lit', 'lo-on');
  await wait(1.3, run);
  row.classList.replace('lo-on', 'hi-on');
  await wait(1.3, run);
  if (playing === run) stop();
}

function stop() {
  if (playing) playing.timers.forEach(clearTimeout);
  playing = null;
  hush();
  document.querySelectorAll('#cmp-main .lit').forEach((el) => el.classList.remove('lit', 'lo-on', 'hi-on'));
  const btn = $('cmp-hear');
  if (btn) {
    btn.setAttribute('aria-pressed', 'false');
    btn.querySelector('.word').textContent = 'Hear each one';
  }
}

/* ---------- the page ---------- */
let ro = null;
let drawn = '';
let shown = null;

function draw() {
  const box = $('cmp-line');
  if (!box || !shown) return;
  const w = Math.floor(box.clientWidth);
  const h = innerWidth < 600 ? 190 : Math.min(300, Math.max(200, innerHeight * 0.36));
  const key = `${shown.id}:${w}:${h}`;
  if (!w || key === drawn) return;
  drawn = key;
  const lit = [...box.querySelectorAll('.lit')].map((a) => a.dataset.id);
  box.innerHTML = lineup(shown, w - 4, h).svg;
  lit.forEach((id) => light(id, true));
  edges();
}

/* A row too long for the screen fades at the side there is more to see. */
function edges() {
  const box = $('cmp-line');
  if (!box) return;
  box.classList.toggle('more-l', box.scrollLeft > 4);
  box.classList.toggle('more-r', box.scrollLeft + box.clientWidth < box.scrollWidth - 4);
}

export function mount(id) {
  const group = GROUPS.find((g) => g.id === id) || GROUPS[0];
  stop();
  shown = group;
  drawn = '';
  const view = $('compare');
  view.style.setProperty('--hue', hueOf(group.members[0]));
  $('cmp-name').textContent = group.name;
  const others = GROUPS.map((g) => `<a href="#compare/${g.id}" class="fam${g === group ? ' on' : ''}"${g === group ? ' aria-current="page"' : ''}>${esc(g.short)}</a>`).join('');
  const tunes = group.members.some((m) => byId[m].range) ? 'the start of Twinkle, Twinkle, Little Star' : 'the rhythm of Twinkle, Twinkle, Little Star';
  $('cmp-main').innerHTML = `<nav class="fams" aria-label="Families">${others}</nav>`
    + `<p class="about">${esc(group.about)}</p>`
    + `<section class="cmp-card line" aria-labelledby="cmp-l-h"><div class="head"><h3 id="cmp-l-h">Side by side, at their real sizes</h3>`
    + `<button class="tool hear" id="cmp-hear" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg><span class="word">Hear each one</span></button></div>`
    + `<p class="hint">Each plays ${tunes}, one after another. Tap one to go and play it yourself.</p>`
    + `<div class="line-box" id="cmp-line"></div><p class="sr" id="cmp-now" aria-live="polite"></p></section>`
    + ranges(group) + kinds(group);
  draw();
  $('cmp-line').addEventListener('scroll', edges, { passive: true });
  if (!ro) {
    ro = new ResizeObserver(() => draw());
    ro.observe($('cmp-main'));
  }
  $('cmp-hear').addEventListener('click', (e) => hearAll(group, e.currentTarget));
  $('cmp-main').querySelectorAll('.rg-row').forEach((row) => row.addEventListener('click', () => hearRange(byId[row.dataset.id], row)));
  // another family: in place of this page in the history, so Back still goes where you came from
  $('cmp-main').querySelectorAll('.fams a').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    if (a.classList.contains('on')) return;
    history.replaceState(history.state, '', a.getAttribute('href'));
    dispatchEvent(new HashChangeEvent('hashchange'));
  }));
}

export function unmount() {
  stop();
  shown = null;
  ro?.disconnect();
  ro = null;
}
