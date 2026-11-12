/* Sub songs: songs Kyle has vetted for a substitute, each with a sub version of its
   slides (videos, sounds and the like added for the sub), kept in one deck, "Sub songs"
   (deck.subSongs). The sub view (/sub/) makes a menu of them for each category in plan
   order, a workout: pick a song, come back to the menu, go on to the next category.

   deck.subSongs = { categories: [name], lock: media, songs: [{ key, category, name, icon,
                     from: { grade: 'YYYY-MM-DD' | '' | null }, open }] }
   A song's slides are the deck's slides with slide.subSong === its key, so the editor can
   add, move and remove them freely. `from` is when each grade reaches the song on the
   calendar ('' already: an earlier grade has it; null: not planned for that grade), worked
   out here from the plan, so the sub view needs no plan. `open` is Kyle's manual unlock. */

import * as store from './store.js';
import { normName, categoryDeck, indexSongs, firstClasses, ROTATION } from './plans.js';
import { buildMenu } from './menus.js';

export const LOCK = 'e8a2199e2a0d291cde34b6ad10564b06';   // the lock picture the decks' menus use

export const songKey = (category, name) => normName(category) + '|' + normName(name);

/** The Sub songs deck record, or null. */
export async function subDeck(decks) {
  return (decks || await store.listDecks()).find((d) => d.deck.subSongs) || null;
}

function newDeck() {
  const now = Date.now();
  return { id: now.toString(36) + Math.random().toString(36).slice(2, 8), name: 'Sub songs', created: now, updated: now,
    deck: { w: 960, h: 540, slides: [], gradesSet: true, subSongs: { categories: [], lock: null, songs: [] } } };
}

/** Tag a song as sub-ready (copying its slides from the category deck) or untag it. */
export async function setSubSong(plan, category, name, on) {
  const decks = await store.listDecks();
  let rec = await subDeck(decks);
  if (!rec && !on) return null;
  rec = rec || newDeck();
  const sub = rec.deck.subSongs;
  const key = songKey(category, name);
  const had = sub.songs.find((s) => s.key === key);
  if (on && !had) {
    const src = categoryDeck(decks, category);
    const idx = src ? indexSongs(src.deck, [name]).get(normName(name)) || [] : [];
    if (!idx.length) throw new Error(name + ' has no slides in the ' + category + ' deck.');
    const base = rec.deck.slides.length;
    const at = new Map(idx.map((i, k) => [i, base + k]));
    for (const i of idx) {
      const s = structuredClone(src.deck.slides[i]);
      delete s.gid;
      delete s.menu;
      s.subSong = key;
      eachLink(s, (link) => {
        if (link.slide == null) return link.deck || link.gdoc ? null : link;
        if (at.has(link.slide)) return { slide: at.get(link.slide) };
        const t = src.deck.slides[link.slide];
        return t && t.menu ? { jump: 'menu' } : null;
      });
      rec.deck.slides.push(s);
    }
    const first = src.deck.slides[idx[0]];
    sub.songs.push({ key, category, name, icon: iconOf(first), from: {}, open: false });
  } else if (!on && had) {
    sub.songs.splice(sub.songs.indexOf(had), 1);
    dropSlides(rec.deck, (s) => s.subSong === key);
  } else return rec;
  sub.lock = await lockPicture();
  refresh(rec, plan);
  rec.updated = Date.now();
  await store.putDeck(rec);
  return rec;
}

/** Kyle's manual unlock for a song (every grade). */
export async function setOpen(key, open) {
  const rec = await subDeck();
  const song = rec && rec.deck.subSongs.songs.find((s) => s.key === key);
  if (!song) return;
  song.open = open;
  rec.updated = Date.now();
  await store.putDeck(rec);
}

/** Bring the unlock dates and categories up to date with the plan; saves when they change. */
export async function refreshSubSongs(plan) {
  const rec = await subDeck();
  if (!rec || !plan) return;
  const was = JSON.stringify(rec.deck.subSongs);
  rec.deck.subSongs.lock = await lockPicture();
  refresh(rec, plan);
  if (JSON.stringify(rec.deck.subSongs) === was) return;
  rec.updated = Date.now();
  await store.putDeck(rec);
}

function refresh(rec, plan) {
  const sub = rec.deck.subSongs;
  if (!plan) return;
  sub.categories = plan.categories.slice();
  const first = new Map();                   // grade|category -> song -> first class
  for (const s of sub.songs) {
    const from = {};
    const info = (plan.catalog[s.category] || []).find((x) => normName(x.name) === normName(s.name));
    plan.grades.forEach((g, gi) => {
      if (info && plan.grades.slice(0, gi).some((e) => info.max[e] > 0)) { from[g] = ''; return; }
      const k = g + '|' + s.category;
      if (!first.has(k)) first.set(k, firstClasses(plan, s.category, g));
      const no = info && first.get(k).get(normName(info.name));
      from[g] = no ? classStart(plan, g, no) : null;
    });
    s.from = from;
  }
}

/** The decks' lock picture, when this device has it (menus fall back to a grey veil). */
async function lockPicture() {
  try { return (await store.mediaKeys()).includes(LOCK) ? LOCK : null; } catch (e) { return null; }
}

/** The first day of a grade's class `no` on the calendar ('9999' when it isn't on it). */
function classStart(plan, grade, no) {
  if (grade === 'PK') {
    const hit = Object.entries(plan.pkWeeks || {}).filter(([, n]) => n === no).map(([mon]) => mon).sort()[0];
    return hit || '9999-12-31';
  }
  for (const d of plan.calendar || []) {
    const m = ROTATION.exec(d.code);
    if (m && Number(m[2]) === no) return d.date;
  }
  return '9999-12-31';
}

/** Shown on a grade's menu: planned for it (or an earlier grade), or unlocked by hand. */
export const subVisible = (song, grade) => song.open || (song.from && song.from[grade] != null);
export const subLocked = (song, grade, today) => !song.open && !(song.from && song.from[grade] != null && song.from[grade] <= today);

/** The categories of the workout that have songs for this grade, in plan order. */
export function workoutParts(deck, grade) {
  const sub = deck.subSongs;
  const cats = [...sub.categories, ...sub.songs.map((s) => s.category).filter((c) => !sub.categories.includes(c))];
  return [...new Set(cats)].filter((c) => sub.songs.some((s) => s.category === c && subVisible(s, grade) &&
    deck.slides.some((x) => x.subSong === s.key)));
}

/** The menu for part n of the workout: the category's sub songs, locked as the class menus
    lock them, with a button on to the next category. */
export function workoutMenu(deck, grade, n, today) {
  const parts = workoutParts(deck, grade);
  const category = parts[n];
  if (!category) return null;
  const sub = deck.subSongs;
  const only = new Set(), locked = new Set();
  // Each song shows once, by its first slide, as a song with its icon whatever the slide's marks say.
  const slides = deck.slides.slice();
  for (const s of sub.songs) {
    if (s.category !== category || !subVisible(s, grade)) continue;
    const i = slides.findIndex((x) => x.subSong === s.key);
    if (i < 0) continue;
    slides[i] = { ...slides[i], hidden: false,
      song: { ...(slides[i].song || {}), kind: 'song', icon: (slides[i].song && slides[i].song.icon) || s.icon, name: s.name } };
    only.add(i);
    if (subLocked(s, grade, today)) locked.add(i);
  }
  // The icons keep clear of a band at the bottom, where the next button goes.
  const BAND = 84;
  const menu = buildMenu({ ...deck, slides, h: deck.h - BAND }, null, category,
    { only, locked, lock: sub.lock, title: grade + ' ' + category });
  menu.grade = grade;
  if (n + 1 < parts.length) {
    menu.els.push({ t: 'sp', x: deck.w - 14 - 150, y: deck.h - BAND + 8, w: 150, h: 64, geom: 'roundRect', adj: {},
      fill: { type: 'solid', color: '#2F4A3A' }, alt: parts[n + 1], link: { submenu: 'part:' + (n + 1) },
      text: { anchor: 'ctr', ins: [6, 4, 6, 4], wrap: false,
        paras: [{ algn: 'ctr', runs: [{ t: '→', sz: 36, b: true, font: 'Comic Sans MS', color: '#FFFFFF' }] }] } });
  }
  return menu;
}

/** A copy of the deck for the sub: each song slide gets a button back to its menu
    (unless it has one), below everything else on the slide. */
export function withMenuButtons(deck) {
  const out = structuredClone(deck);
  for (const s of out.slides) {
    if (!s.subSong) continue;
    const has = s.els.some((e) => (e.link && e.link.jump === 'menu') ||
      (e.text && e.text.paras.some((p) => p.runs.some((r) => r.link && r.link.jump === 'menu'))));
    if (has) continue;
    s.els.push({ t: 'sp', x: 14, y: out.h - 14 - 56, w: 56, h: 56, geom: 'roundRect', adj: {},
      fill: { type: 'solid', color: '#2F4A3A' }, alt: 'Menu', link: { jump: 'menu' },
      text: { anchor: 'ctr', ins: [0, 0, 0, 0], wrap: false,
        paras: [{ algn: 'ctr', runs: [{ t: '▦', sz: 26, font: 'Arial', color: '#FFFFFF' }] }] } });
  }
  return out;
}

function iconOf(slide) {
  if (slide.song && slide.song.icon) return slide.song.icon;
  const e = slide.els.find((x) => x.role === 'songIcon');
  return e ? e.media : null;
}

function eachLink(slide, fn) {
  for (const e of slide.els) {
    if (e.link) { const l = fn(e.link); if (l) e.link = l; else delete e.link; }
    if (e.text) for (const p of e.text.paras) for (const r of p.runs) if (r.link) { const l = fn(r.link); if (l) r.link = l; else delete r.link; }
  }
}

/** Takes slides out of a deck, keeping links between the rest pointing at the same slides. */
function dropSlides(deck, gone) {
  const map = new Map();
  const keep = [];
  deck.slides.forEach((s, i) => { if (!gone(s)) { map.set(i, keep.length); keep.push(s); } });
  for (const s of keep) eachLink(s, (l) => l.slide == null ? l : map.has(l.slide) ? { ...l, slide: map.get(l.slide) } : null);
  deck.slides = keep;
}
