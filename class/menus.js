/* A grade's menu, built when it is asked for: every song in the deck that is
   for that grade or an earlier one (a 1st grade menu holds the PK and K songs
   too), as its icon, each one jumping to its song. The icons are as big as the
   page allows. It takes the look (background and title box) of the deck's own
   menu slides, with the title shrunk to fit its box.

   opts.locked: slide indexes of songs not unlocked yet. They show under a
   lock (opts.lock, the decks' lock picture, or a grey veil) and don't jump.
   opts.order: slide indexes in the order the songs should show (others after).
   opts.only: just these slide indexes (a menu of the deck's own, such as its
   dances), with opts.title in place of the deck's name. */

import { forGradeOrEarlier, textOf } from './marks.js';
import { fontStack } from './render.js';

const GAP = 14;
const PX_PER_PT = 960 / 720;

export function buildMenu(deck, grade, name, opts = {}) {
  const songs = deck.slides
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => s.song && s.song.kind === 'song' && s.song.icon && !s.hidden && forGradeOrEarlier(s, grade) &&
      (!opts.only || opts.only.has(i)))
    // A song over several slides shows once, jumping to its first.
    .filter(({ s }, k, all) => all.findIndex((x) => x.s.song.icon === s.song.icon) === k);
  if (opts.order) {
    const rank = new Map(opts.order.map((i, k) => [deck.slides[i].song && deck.slides[i].song.icon, k]));
    const at = ({ s }) => rank.has(s.song.icon) ? rank.get(s.song.icon) : 1e9;
    songs.sort((a, b) => at(a) - at(b));
  }
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
  // The biggest icons that fit every song in the space left.
  const W = deck.w - 2 * GAP, H = deck.h - top - GAP, n = songs.length;
  let best = { size: 0, cols: 1 };
  for (let cols = 1; cols <= Math.max(n, 1); cols++) {
    const rows = Math.ceil(n / cols);
    const size = Math.min((W - GAP * (cols - 1)) / cols, (H - GAP * (rows - 1)) / rows);
    if (size > best.size) best = { size, cols };
  }
  const { size, cols } = best;
  const rows = Math.ceil(n / cols);
  const y0 = top + (H - (rows * size + (rows - 1) * GAP)) / 2;
  songs.forEach(({ s, i }, k) => {
    const row = Math.floor(k / cols), col = k % cols;
    const inRow = Math.min(cols, n - row * cols);
    const x0 = GAP + (W - (inRow * size + (inRow - 1) * GAP)) / 2;
    const x = x0 + col * (size + GAP), y = y0 + row * (size + GAP);
    const locked = opts.locked && opts.locked.has(i);
    els.push({ t: 'pic', x, y, w: size, h: size, geom: 'rect', media: s.song.icon, alt: s.song.name,
      link: locked ? undefined : { slide: i } });
    if (locked && opts.lock) els.push({ t: 'pic', x: x - size * 0.02, y: y - size * 0.02, w: size * 1.04, h: size * 1.04, geom: 'rect', media: opts.lock });
    else if (locked) els.push({ t: 'sp', x, y, w: size, h: size, geom: 'roundRect', adj: {},
      fill: { type: 'solid', color: '#55555599' } });
  });
  return { els, bg: template ? template.bg : null, title, generated: true };
}

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
