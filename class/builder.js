/* Builds one class's deck from the year plan, the way the Apps Script deck
   builder did: the title slide, each song's slides copied from its category
   deck, and the exit slide.

   - Song slides get x/y stamped as plays so far / Max, and a rail of the
     class's song icons down the right edge, with a check on each song done.
   - The title slide gets the class number, the song list (*asterisks* on a
     debut, underlined italics on a farewell) and a column of icons.
   - The exit slide gets next class's icons along the bottom.

   Title and exit slides come from a class deck in the library (one named
   like "1 29"), the same reference deck the Apps Script builder used. */

import { readClass, categoryDeck, indexSongs, KIDS_CHOICE, CONCERT } from './plans.js';
import { textOf } from './marks.js';

// Measured off the 2025-26 decks, in slide pixels (960 x 540).
const RAIL = { x: 912, top: 0, step: 41.73, size: 48 };
const TITLE = { iconX: 193.87, iconY: 94.13, iconStep: 45.6, iconSize: 57.6, pt: 12, ptTight: 10 };
const NEXT = { margin: 15.33, top: 434.93, size: 96, gap: 8 };
const NEAR = 5.3;
const COUNTER = /^\s*x\s*\/\s*y\s*$/i;
const CLASS_DECK = /^(PK|K|\d)\s+\d+$/i;

/** Returns { deck, name, missing } or throws when the class has nothing slated. */
export function buildClass(plan, grade, no, decks) {
  const cls = readClass(plan, grade, no);
  if (!cls || !cls.songs.length) throw new Error(grade + ' class ' + no + ' has no songs slated.');
  const template = pickTemplate(decks);
  const W = template ? template.deck.w : 960, H = template ? template.deck.h : 540;
  const check = template ? findCheck(template.deck) : null;

  const sources = new Map();                 // category -> { rec, index }
  const source = (category) => {
    if (!sources.has(category)) {
      const rec = categoryDeck(decks, category);
      sources.set(category, rec && { rec, index: indexSongs(rec.deck, (plan.catalog[category] || []).map((s) => s.name)) });
    }
    return sources.get(category);
  };

  const icons = [];
  const missing = [];
  const copied = [];                         // { slide, song, from: { id, i } }

  cls.songs.forEach((entry, songIndex) => {
    const src = source(entry.category);
    if (entry.special === CONCERT) {
      icons.push(null);
      copied.push({ slide: { els: [], bg: { type: 'solid', color: '#ffffff' }, title: CONCERT }, song: songIndex });
      return;
    }
    if (!src) { icons.push(null); missing.push(entry.category + ' deck'); return; }
    const picks = entry.special === KIDS_CHOICE ? [1] : src.index.get(norm(entry.song)) || [];
    if (!picks.length || !src.rec.deck.slides[picks[0]]) {
      icons.push(null);
      missing.push(entry.special ? KIDS_CHOICE + ' ' + entry.category : entry.song);
      return;
    }
    icons.push(iconOf(src.rec.deck.slides[picks[0]]));
    for (const i of picks) {
      const slide = copySlide(src.rec.deck.slides[i]);
      stampCounter(slide, entry.special === KIDS_CHOICE ? '?/?' : entry.plays + '/' + entry.max);
      slide.plan = { category: entry.category, song: entry.special ? null : entry.song };
      copied.push({ slide, song: songIndex, from: { id: src.rec.id, i } });
    }
  });

  // Links inside a copied song now point at its copy, or back into the category deck.
  const at = new Map(copied.map((c, k) => [c.from ? c.from.id + ':' + c.from.i : '', k + 1]));
  for (const c of copied) {
    if (!c.from) continue;
    const srcDeck = sources.get(c.slide.plan.category).rec.deck;
    eachLink(c.slide, (link) => {
      if (link.slide == null) return link;
      const mine = at.get(c.from.id + ':' + link.slide);
      if (mine != null) return { slide: mine };
      const target = srcDeck.slides[link.slide];
      return target && target.menu ? { deck: c.from.id, menu: true } : { deck: c.from.id, slide: link.slide };
    });
  }

  const title = template ? copySlide(template.deck.slides[0]) : plainSlide();
  const exit = template ? copySlide(template.deck.slides[template.deck.slides.length - 1]) : plainSlide();
  clearGenerated(title);
  clearGenerated(exit);

  copied.forEach((c) => drawRail(c.slide, icons, c.song, check));
  drawRail(exit, icons, icons.length, check);

  if (plan.titleBg !== 'template') title.bg = { type: 'solid', color: '#ffffff' };
  stampNumber(title, no);
  writeList(title, cls.songs);
  // A long class squeezes the icon column to end where the list box does.
  const list = listBox(title);
  const bottom = list ? list.y + list.h : H;
  const step = icons.length > 1 ? Math.min(TITLE.iconStep, (bottom - TITLE.iconY - TITLE.iconSize) / (icons.length - 1)) : 0;
  icons.forEach((icon, j) => {
    if (icon) title.els.push(pic(icon, TITLE.iconX, TITLE.iconY + step * j, TITLE.iconSize));
  });

  const next = readClass(plan, grade, no + 1);
  if (next) {
    const nextIcons = next.songs.map((e) => {
      if (e.special) return null;
      const src = source(e.category);
      const i = src && (src.index.get(norm(e.song)) || [])[0];
      return i != null ? iconOf(src.rec.deck.slides[i]) : null;
    });
    drawNext(exit, nextIcons, W);
  }

  const deck = { w: W, h: H, slides: [title, ...copied.map((c) => c.slide), exit], gradesSet: true,
                 built: { year: plan.year, grade, no, at: Date.now() } };
  return { deck, name: grade + ' ' + no, missing };
}

const norm = (s) => String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^a-z0-9']+/g, ' ').trim();

/** The Class template deck, else the newest class deck brought in by hand, else one built here. */
function pickTemplate(decks) {
  const own = decks.find((d) => d.deck.template && d.deck.slides.length >= 2);
  if (own) return own;
  const classDecks = decks.filter((d) => CLASS_DECK.test(d.name.trim()) && d.deck.slides.length >= 2)
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return classDecks.find((d) => !d.deck.built) || classDecks[0] || null;
}

/** A "Class template" deck (title and exit slides) made from an imported class
    deck such as "1 29", so that deck can go. Null when there is one already or
    nothing to make it from. Its own song icons are cleared; builds draw them. */
export function makeTemplate(decks) {
  if (decks.some((d) => d.deck.template)) return null;
  const src = decks.filter((d) => CLASS_DECK.test(d.name.trim()) && !d.deck.built && d.deck.slides.length >= 2)
    .sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
  if (!src) return null;
  const title = copySlide(src.deck.slides[0]);
  const exit = copySlide(src.deck.slides[src.deck.slides.length - 1]);
  // Keep one rail check on the exit slide: it is where builds find the check picture.
  const check = findCheck(src.deck);
  clearGenerated(title);
  clearGenerated(exit);
  if (check) exit.els.push(pic(check, RAIL.x, RAIL.top, RAIL.size));
  for (const s of [title, exit]) for (const e of s.els) if (e.text && /^\d+$/.test(textOf(e)) && e.x <= 120 && e.y <= 80) e.text.paras[0].runs.forEach((r) => { if (r.t) r.t = '#'; });
  return { w: src.deck.w, h: src.deck.h, slides: [title, exit], gradesSet: true, template: true };
}

/** The rail's check: the picture repeated down the exit slide's rail. */
function findCheck(deck) {
  const exit = deck.slides[deck.slides.length - 1];
  const count = new Map();
  for (const e of exit.els) {
    if (e.t === 'pic' && Math.abs(e.x - RAIL.x) <= NEAR) count.set(e.media, (count.get(e.media) || 0) + 1);
  }
  const best = [...count].sort((a, b) => b[1] - a[1])[0];
  return best && (best[1] > 1 || deck.template) ? best[0] : null;
}

function copySlide(slide) {
  const s = structuredClone(slide);
  delete s.grades;
  delete s.menu;
  delete s.gid;
  return s;
}

function plainSlide() {
  return { els: [], bg: { type: 'solid', color: '#ffffff' } };
}

function iconOf(slide) {
  if (slide.song && slide.song.icon) return slide.song.icon;
  const e = slide.els.find((x) => x.role === 'songIcon');
  return e ? e.media : null;
}

function pic(media, x, y, size) {
  return { t: 'pic', x, y, w: size, h: size, geom: 'rect', media };
}

/** Icons a reference deck still carries from its own class. */
function clearGenerated(slide) {
  const near = (a, b) => Math.abs(a - b) <= NEAR;
  slide.els = slide.els.filter((e) => !(e.t === 'pic' && (
    near(e.x, RAIL.x) ||
    (near(e.x, TITLE.iconX) && near(e.w, TITLE.iconSize)) ||
    (near(e.y, NEXT.top) && e.w <= NEXT.size + NEAR))));
}

function eachLink(slide, fn) {
  for (const e of slide.els) {
    if (e.link) e.link = fn(e.link);
    if (e.text) for (const p of e.text.paras) for (const r of p.runs) if (r.link) r.link = fn(r.link);
  }
}

function setText(e, value) {
  const run = e.text.paras.flatMap((p) => p.runs).find((r) => r.t) || e.text.paras[0].runs[0] || {};
  e.text.paras = [{ ...e.text.paras[0], runs: [{ ...run, t: value }] }];
}

function stampCounter(slide, value) {
  for (const e of slide.els) if (e.text && COUNTER.test(textOf(e))) setText(e, value);
}

function drawRail(slide, icons, done, check) {
  icons.forEach((icon, i) => {
    const y = RAIL.top + RAIL.step * i;
    if (icon) slide.els.push(pic(icon, RAIL.x, y, RAIL.size));
    if (check && i < done) slide.els.push(pic(check, RAIL.x, y, RAIL.size));
  });
}

/** The small box top left of the title slide holds the class number. */
function stampNumber(slide, no) {
  const box = slide.els.find((e) => e.text && e.x <= 120 && e.y <= 80 && e.w <= 120);
  if (box) setText(box, String(no));
}

/** One song per paragraph with a blank line between, in the tall box on the left. */
function listBox(slide) {
  return slide.els.filter((e) => e.text && e.h >= 200 && e.w <= 333).sort((a, b) => a.x - b.x)[0] || null;
}

function writeList(slide, songs) {
  const box = listBox(slide);
  if (!box) return;
  const paras = box.text.paras;
  const run = paras.flatMap((p) => p.runs).find((r) => r.t) || { font: 'Comic Sans MS', color: '#000000' };
  const blankPara = paras.find((p) => !p.runs.some((r) => r.t));
  const blank = blankPara ? blankPara.runs[0] || run : run;
  const pt = songs.length > 9 ? TITLE.ptTight : TITLE.pt;
  const base = { ...paras[0], sz: pt };
  const out = [];
  songs.forEach((s, k) => {
    if (k) out.push({ ...base, runs: [{ ...blank, t: '' }] });
    const label = s.isFirst ? '*' + s.song + '*' : s.song;
    const last = s.isLast && !s.special;
    out.push({ ...base, runs: [{ ...run, sz: pt, b: true, i: last, u: last, t: label }] });
  });
  box.text.paras = out;
}

function drawNext(slide, icons, W) {
  if (!icons.length) return;
  const usable = W - NEXT.margin * 2;
  const size = Math.min(NEXT.size, (usable - NEXT.gap * (icons.length - 1)) / icons.length);
  const step = icons.length > 1 ? (usable - size) / (icons.length - 1) : 0;
  const top = NEXT.top + (NEXT.size - size);
  icons.forEach((icon, i) => { if (icon) slide.els.push(pic(icon, NEXT.margin + step * i, top, size)); });
}
