/* The flash card deck editor: which notes or rhythm cells a student's deck uses. */

import { h } from '../dom.js';
import { clefRange, inKey, noteAnswer, DUPLE, TRIPLE } from '/lesson/cards.js';
import { openDeck } from '/lesson/games.js';

const CLEF_NAMES = [['g', 'Treble'], ['f', 'Bass'], ['c', 'Alto'], ['gf', 'Grand']];
const KEY_NAMES = { '-7': 'C♭', '-6': 'G♭', '-5': 'D♭', '-4': 'A♭', '-3': 'E♭', '-2': 'B♭', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F♯', 7: 'C♯' };
export const CELL_NAMES = {
  q: 'du', ee: 'du-de', qr: 'rest', h: 'du-u', dqe: 'du-u-de', w: 'du-u-u-u', ssss: 'du-ta-de-ta', ess: 'du-de-ta', sse: 'du-ta-de',
  dq: 'du', eee: 'du-da-di', qe: 'du-di', dqr: 'rest', dh: 'du-u',
};

export const newNotesDeck = () => ({ k: 'n', f: 'g', r: ['C4', 'D4', 'E4', 'F4', 'G4'], y: 0, a: 0 });
export const newRhythmDeck = () => ({ k: 'r', m: '4/4', l: ['q', 'ee', 'qr'], n: 1, q: 80 });

export function deckSummary(d) {
  if (!d) return '';
  if (d.k === 'n') {
    const clef = CLEF_NAMES.find(([k]) => k === d.f)?.[1] || '';
    return `${clef} · ${d.r.map((p) => noteAnswer({ ...d, a: 0 }, p) + p.slice(-1)).join(' ')}`;
  }
  return `${d.m} · ${d.l.map((c) => CELL_NAMES[c]).join(', ')}`;
}

function seg(options, value, set) {
  return h('div', { class: 'seg' }, options.map(([v, label]) =>
    h('button', { type: 'button', 'aria-pressed': String(value === v), onclick: () => set(v) }, label)));
}

/* Opens a dialog; resolves with the edited deck, or null when cancelled. */
export function editDeck(start, title = '') {
  let d = structuredClone(start || newNotesDeck());
  const dlg = h('dialog', { class: 'deckdlg' });
  document.body.append(dlg);

  return new Promise((resolve) => {
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });

    function draw() {
      const rows = [
        seg([['n', 'Notes'], ['r', 'Rhythm']], d.k, (k) => { if (k !== d.k) d = k === 'n' ? newNotesDeck() : newRhythmDeck(); draw(); }),
      ];
      if (d.k === 'n') {
        const range = clefRange(d.f);
        const picked = new Set(d.r);
        rows.push(
          seg(CLEF_NAMES, d.f, (f) => { d.f = f; const r = new Set(clefRange(f)); d.r = d.r.filter((p) => r.has(p.replace(/[#b]/, ''))); draw(); }),
          h('label', { class: 'row' }, 'Key ', h('select', { onchange: (e) => { d.y = +e.target.value; d.r = d.r.map((p) => inKey(p.replace(/[#b]/, ''), d.y)); draw(); } },
            Object.entries(KEY_NAMES).sort((a, b) => a[0] - b[0]).map(([v, n]) => h('option', { value: v, selected: +v === d.y }, n)))),
          seg([[0, 'ABC'], [1, 'Do re mi']], d.a, (a) => { d.a = a; draw(); }),
          h('div', { class: 'notepick' }, range.map((nat) => {
            const p = inKey(nat, d.y);
            const on = picked.has(p);
            return h('button', { type: 'button', 'aria-pressed': String(on), onclick: () => {
              d.r = on ? d.r.filter((x) => x !== p) : [...d.r, p];
              draw();
            } }, noteAnswer({ ...d, a: 0 }, p), h('sub', {}, p.slice(-1)));
          })),
        );
      } else {
        const cells = d.m === '6/8' ? TRIPLE : DUPLE;
        rows.push(
          seg([['2/4', '2/4'], ['3/4', '3/4'], ['4/4', '4/4'], ['6/8', '6/8']], d.m, (m) => {
            const wasTriple = d.m === '6/8';
            d.m = m;
            if (wasTriple !== (m === '6/8')) d.l = m === '6/8' ? ['dq', 'eee'] : ['q', 'ee'];
            draw();
          }),
          h('div', { class: 'notepick' }, cells.map((c) => {
            const on = d.l.includes(c);
            return h('button', { type: 'button', 'aria-pressed': String(on), onclick: () => {
              d.l = on ? d.l.filter((x) => x !== c) : [...d.l, c];
              draw();
            } }, CELL_NAMES[c]);
          })),
          h('div', { class: 'row' }, 'Bars ', seg([[1, '1'], [2, '2'], [4, '4']], d.n, (n) => { d.n = n; draw(); }),
            h('label', {}, ' ♩ ', h('input', { type: 'number', min: 40, max: 200, value: d.q, class: 'tempo', onchange: (e) => { d.q = Math.max(40, Math.min(200, +e.target.value || 80)); } }))),
        );
      }
      const ok = d.k === 'n' ? d.r.length > 0 : d.l.some((c) => !c.endsWith('r'));
      dlg.replaceChildren(h('form', { method: 'dialog', onsubmit: (e) => e.preventDefault() },
        ...rows,
        h('div', { class: 'bar actions' },
          h('button', { type: 'button', class: 'primary', disabled: !ok, onclick: () => done(d) }, 'Save'),
          h('button', { type: 'button', disabled: !ok, onclick: () => openDeck(dlg, d, { title }) }, 'Try'),
          h('span', { class: 'grow' }),
          h('button', { type: 'button', onclick: () => done(null) }, 'Cancel'))));
    }
    draw();
    dlg.showModal();
  });
}
