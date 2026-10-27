/* A grade's menu, built when it is asked for: every song in the deck that is
   for that grade, as its icon, each one jumping to its song. It takes the
   look (background and title box) of the deck's own menu slides. */

import { forGrade, textOf } from './marks.js';

const GAP = 14;
const MAX_ICON = 124;

export function buildMenu(deck, grade, name) {
  const songs = deck.slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.song && s.song.kind === 'song' && s.song.icon && !s.hidden && forGrade(s, grade));
  const menus = deck.slides.filter((s) => s.menu);
  // The deck's plain menu (no grade in its title) is the best look to borrow.
  const template = menus.find((s) => !/^(PK|K|1)\s/i.test(s.title || '')) || menus[0];
  const els = [];
  let top = 24;
  const head = template && template.els
    .filter((e) => e.text && textOf(e) && e.y < 120)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const title = (grade ? grade + ' ' : '') + name;
  if (head) {
    const t = structuredClone(head);
    delete t.link;
    const run = t.text.paras.flatMap((p) => p.runs).find((r) => r.t) || {};
    t.text.paras = [{ ...t.text.paras[0], runs: [{ ...run, t: title }] }];
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
    const size = Math.min(MAX_ICON, (W - GAP * (cols - 1)) / cols, (H - GAP * (rows - 1)) / rows);
    if (size > best.size) best = { size, cols };
  }
  const { size, cols } = best;
  const rows = Math.ceil(n / cols);
  const y0 = top + (H - (rows * size + (rows - 1) * GAP)) / 2;
  songs.forEach(({ s, i }, k) => {
    const row = Math.floor(k / cols), col = k % cols;
    const inRow = Math.min(cols, n - row * cols);
    const x0 = GAP + (W - (inRow * size + (inRow - 1) * GAP)) / 2;
    els.push({ t: 'pic', x: x0 + col * (size + GAP), y: y0 + row * (size + GAP), w: size, h: size,
      geom: 'rect', media: s.song.icon, alt: s.song.name, link: { slide: i } });
  });
  return { els, bg: template ? template.bg : null, title, generated: true };
}
