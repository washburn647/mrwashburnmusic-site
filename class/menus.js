/* A grade's menu, built when it is asked for: every song in the deck that is
   for that grade or an earlier one (a 1st grade menu holds the PK and K songs
   too), as its icon, each one jumping to its song. The icons are as big as the
   page allows. It takes the look (background and title box) of the deck's own
   menu slides, with the title shrunk to fit its box.

   opts.locked: slide indexes of songs not unlocked yet. They show under a
   lock (opts.lock, the decks' lock picture, or a grey veil) and don't jump.
   opts.order: slide indexes in the order the songs should show (others after).
   opts.only: just these slide indexes (a menu of the deck's own, such as its
   dances), with opts.title in place of the deck's name.
   The songs come in sections, each starting a new row: the usual ones, then
   the Move Its, then the dances. */

import { forGradeOrEarlier, textOf, songSection, SECTIONS } from './marks.js';
import { fontStack } from './render.js';

const GAP = 14;
const PX_PER_PT = 960 / 720;

export function buildMenu(deck, grade, name, opts = {}) {
  const songs = deck.slides
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => s.song && s.song.kind === 'song' && s.song.icon && !s.hidden && forGradeOrEarlier(s, grade) &&
      (!opts.only || opts.only.has(i)))
    .map((x) => ({ ...x, part: songSection(x.s) }))
    // A song over several slides shows once, jumping to its first. The Move Its share
    // one icon, so they go by name.
    .filter(({ s, part }, k, all) => all.findIndex((x) => part === 'moveIt'
      ? x.part === part && norm(x.s.title) === norm(s.title) : x.s.song.icon === s.song.icon) === k);
  const rank = new Map((opts.order || []).map((i, k) => [i, k]));
  const at = ({ i }) => rank.has(i) ? rank.get(i) : 1e9;
  songs.sort((a, b) => SECTIONS.indexOf(a.part) - SECTIONS.indexOf(b.part) || at(a) - at(b));
  const menus = deck.slides.filter((s) => s.menu);
  // The deck's plain menu (no grade in its title) is the best look to borrow.
  const template = menus.find((s) => !/^(PK|K|1)\s/i.test(s.title || '')) || menus[0];
  const els = [];
  let top = 24;
  const head = template && template.els
    .filter((e) => e.text && textOf(e) && e.y < 120)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const title = (grade ? grade + ' ' : '') + (opts.title || name);
  if (head) {
    const t = structuredClone(head);
    delete t.link;
    const run = t.text.paras.flatMap((p) => p.runs).find((r) => r.t) || {};
    const sz = fitText(title, run, t);
    t.text.paras = [{ ...t.text.paras[0], sz, runs: [{ ...run, sz, t: title }] }];
    els.push(t);
    top = t.y + t.h + GAP;
  } else {
    els.push({ t: 'sp', x: 180, y: 14, w: deck.w - 360, h: 70, geom: 'roundRect', adj: {},
      fill: { type: 'solid', color: '#FFFDF7' }, line: { color: '#000000', width: 3 },
      text: { anchor: 'ctr', ins: [10, 6, 10, 6], wrap: true,
        paras: [{ algn: 'ctr', runs: [{ t: title, sz: 36, b: true, font: 'Comic Sans MS', color: '#000000' }] }] } });
    top = 14 + 70 + GAP;
  }
  // The biggest icons that fit every song in the space left, each section on rows of its own.
  const parts = SECTIONS.map((p) => songs.filter((x) => x.part === p)).filter((l) => l.length);
  const W = deck.w - 2 * GAP, H = deck.h - top - GAP, n = Math.max(...parts.map((l) => l.length), 1);
  const BREAK = GAP * 2;                   // extra space between sections
  const rowsFor = (cols) => parts.reduce((t, l) => t + Math.ceil(l.length / cols), 0);
  let best = { size: 0, cols: 1 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = rowsFor(cols);
    const size = Math.min((W - GAP * (cols - 1)) / cols, (H - GAP * (rows - 1) - BREAK * (parts.length - 1)) / rows);
    if (size > best.size) best = { size, cols };
  }
  const { size, cols } = best;
  const rows = rowsFor(cols);
  let y = top + (H - (rows * size + (rows - 1) * GAP + BREAK * (parts.length - 1))) / 2;
  const placed = [];
  for (const list of parts) {
    for (let r = 0; r * cols < list.length; r++) {
      const row = list.slice(r * cols, r * cols + cols);
      const x0 = GAP + (W - (row.length * size + (row.length - 1) * GAP)) / 2;
      row.forEach((song, c) => placed.push({ ...song, x: x0 + c * (size + GAP), y }));
      y += size + GAP;
    }
    y += BREAK;
  }
  placed.forEach(({ s, i, part, x, y }) => {
    const locked = opts.locked && opts.locked.has(i);
    els.push({ t: 'pic', x, y, w: size, h: size, geom: 'rect', media: s.song.icon, alt: s.song.name,
      link: locked ? undefined : { slide: i } });
    // Placed as the decks place it: its bottom margin cropped off, its ring centered on the icon.
    if (locked && opts.lock) els.push({ t: 'pic', x: x - size * 3 / 145, y, w: size * 151 / 145, h: size,
      geom: 'rect', media: opts.lock, crop: [0, 0, 0, 0.08215] });
    else if (locked) els.push({ t: 'sp', x, y, w: size, h: size, geom: 'roundRect', adj: {},
      fill: { type: 'solid', color: '#55555599' } });
    // Move Its share an icon: each carries its number.
    const no = part === 'moveIt' && /(\d+)\s*$/.exec(s.title || '');
    if (no) {
      const d = size * 0.36;
      els.push({ t: 'sp', x: x + size - d, y: y + size - d, w: d, h: d, geom: 'ellipse', adj: {},
        fill: { type: 'solid', color: '#FFFFFF' }, line: { color: '#000000', width: Math.max(1.5, size / 60) },
        text: { anchor: 'ctr', ins: [0, 0, 0, 0], wrap: false,
          paras: [{ algn: 'ctr', runs: [{ t: no[1], sz: Math.round(d / PX_PER_PT * 0.55), b: true, font: 'Comic Sans MS', color: '#000000' }] }] } });
    }
  });
  return { els, bg: template ? template.bg : null, title, generated: true };
}

const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();

let ruler = null;

/** The run's size, or smaller, so the title fits its box on one line. */
function fitText(text, run, box) {
  const want = run.sz || 36;
  const ins = (box.text && box.text.ins) || [10, 5, 10, 5];
  const w = box.w - ins[0] - ins[2], h = box.h - ins[1] - ins[3];
  try {
    ruler = ruler || document.createElement('canvas').getContext('2d');
    ruler.font = (run.b ? 'bold ' : '') + want * PX_PER_PT + 'px ' + fontStack(run.font);
    const wide = ruler.measureText(text).width;
    // Room to spare: the deck's font may not have loaded when this is measured.
    const byWidth = wide ? want * (w * 0.92) / wide : want;
    const byHeight = h / (1.2 * PX_PER_PT);
    return Math.max(8, Math.floor(Math.min(want, byWidth, byHeight)));
  } catch (e) {
    return want;
  }
}
