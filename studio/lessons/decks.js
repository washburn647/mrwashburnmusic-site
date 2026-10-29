/* The flash card deck editor. Notes decks list the notes; tonal and rhythm decks take
   their patterns from a unit (as Kyle keeps them in the recorder), all of them or the
   familiar or unfamiliar ones, and he can leave out single patterns. See /lesson/cards.js. */

import { h } from '../dom.js';
import { clefRange, inKey, noteAnswer, KEY_NAMES, MODES, KINDS, cardLabel } from '/lesson/cards.js';
import { openPractice } from '/lesson/practice.js';
import { DEFAULT_UNITS, KEYS, unitPatterns, patternById } from '/assets/patterns/patterns.js';

const CLEF_NAMES = [['g', 'Treble'], ['f', 'Bass'], ['c', 'Alto'], ['gf', 'Grand']];
const SETS = [['all', 'All'], ['familiar', 'Familiar'], ['unfamiliar', 'Unfamiliar']];

export const newDeck = (k) => (k === 'n'
  ? { k: 'n', f: 'g', r: ['C4', 'D4', 'E4', 'F4', 'G4'], y: 0, o: 1, w: 0, g: 20 }
  : { k, u: '', p: [], o: 1, w: 0, g: 20, q: 80, ...(k === 't' ? { y: 48 } : {}) });

export function deckSummary(d) {
  if (!d) return '';
  if (d.k === 'n') {
    const clef = CLEF_NAMES.find(([k]) => k === d.f)?.[1] || '';
    return `${clef} · ${d.r.map((p) => noteAnswer(d, p, 'letters') + p.slice(-1)).join(' ')}`;
  }
  return `${d.u || KINDS[d.k]} · ${d.p.length}`;
}

/* Units: the recorder's own copy on this device when there is one, else the site's. */
let unitList = null;
async function recorderUnits() {
  if (!(await indexedDB.databases?.())?.some((x) => x.name === 'mwm-voice')) return null;
  return new Promise((resolve) => {
    const req = indexedDB.open('mwm-voice');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const d = req.result;
      try {
        const get = d.transaction('misc').objectStore('misc').get('units');
        get.onsuccess = () => { d.close(); resolve(get.result || null); };
        get.onerror = () => { d.close(); resolve(null); };
      } catch { d.close(); resolve(null); }
    };
  });
}
export function loadUnits() {
  unitList ||= (async () => {
    const mine = await recorderUnits().catch(() => null);
    if (mine?.length) return mine;
    try {
      const r = await fetch('/assets/patterns/units.json');
      if (r.ok) return (await r.json()).units;
    } catch { /* offline */ }
    return DEFAULT_UNITS;
  })().then((list) => list.map((u) => ({ removed: [], marks: {}, ...u })));
  return unitList;
}

/* A unit's patterns, as Kyle kept them, with their marks. */
function patternsOf(unit) {
  if (Array.isArray(unit.patterns)) return unit.patterns.map((p) => ({ id: p.id, mark: p.mark }));
  return unitPatterns(unit).filter((p) => !unit.removed.includes(p.id)).map((p) => ({ id: p.id, mark: unit.marks[p.id] || null }));
}

function seg(options, value, set) {
  return h('div', { class: 'seg' }, options.map(([v, label]) =>
    h('button', { type: 'button', 'aria-pressed': String(value === v), onclick: () => set(v) }, label)));
}

/* Opens a dialog; resolves with the edited deck, or null when cancelled. */
export async function editDeck(start, title = '') {
  let d = structuredClone(start || newDeck('n'));
  const units = await loadUnits();
  // Which unit and set the deck came from; the set isn't kept in the deck.
  let set = 'all';
  const dlg = h('dialog', { class: 'deckdlg' });
  document.body.append(dlg);

  return new Promise((resolve) => {
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });

    const kindUnits = () => units.filter((u) => u.kind === (d.k === 't' ? 'tonal' : 'rhythm'));
    function useUnit(u) {
      d.u = u.name;
      d.p = patternsOf(u).filter((p) => set === 'all' || p.mark === set).map((p) => p.id);
      if (d.k === 't') {
        const keys = KEYS[u.tonality || 'major'];
        if (!keys.some((k) => k.midi === d.y)) d.y = keys[0].midi;
      }
    }

    function draw() {
      const rows = [seg(Object.entries(KINDS), d.k, (k) => {
        if (k === d.k) return;
        d = { ...newDeck(k), o: 1, w: d.w, g: d.g };
        if (k !== 'n' && kindUnits()[0]) useUnit(kindUnits()[0]);
        draw();
      })];
      if (d.k === 'n') {
        const range = clefRange(d.f);
        const picked = new Set(d.r);
        rows.push(
          seg(CLEF_NAMES, d.f, (f) => { d.f = f; const r = new Set(clefRange(f)); d.r = d.r.filter((p) => r.has(p.replace(/[#b]/, ''))); draw(); }),
          h('label', { class: 'row' }, 'Key ', h('select', { onchange: (e) => { d.y = +e.target.value; d.r = d.r.map((p) => inKey(p.replace(/[#b]/, ''), d.y)); draw(); } },
            KEY_NAMES.map((n, i) => h('option', { value: i - 7, selected: i - 7 === d.y }, n.replace('#', '♯').replace(/b$/, '♭'))))),
          h('div', { class: 'notepick' }, range.map((nat) => {
            const p = inKey(nat, d.y);
            const on = picked.has(p);
            return h('button', { type: 'button', 'aria-pressed': String(on), onclick: () => {
              d.r = on ? d.r.filter((x) => x !== p) : [...d.r, p];
              draw();
            } }, noteAnswer(d, p, 'letters'), h('sub', {}, p.slice(-1)));
          })),
        );
      } else {
        const list = kindUnits();
        const unit = list.find((u) => u.name === d.u) || null;
        const all = unit ? patternsOf(unit) : d.p.map((id) => ({ id, mark: null }));
        const shown = all.filter((p) => set === 'all' || p.mark === set);
        const picked = new Set(d.p);
        const tonality = d.k === 't' ? (patternById(d.p[0] || shown[0]?.id || 'tonal/major/do')?.tonality || 'major') : null;
        rows.push(
          h('div', { class: 'row' },
            h('select', { 'aria-label': 'Unit', onchange: (e) => { useUnit(list[+e.target.value]); draw(); } },
              unit ? null : h('option', { value: '', selected: true }, d.u || '—'),
              list.map((u, i) => h('option', { value: i, selected: u === unit }, u.name))),
            seg(SETS, set, (v) => { set = v; if (unit) useUnit(unit); draw(); })),
          h('div', { class: 'patpick' }, shown.map((p) => {
            const on = picked.has(p.id);
            return h('button', { type: 'button', 'aria-pressed': String(on), class: p.mark || '', onclick: () => {
              d.p = on ? d.p.filter((x) => x !== p.id) : shown.map((x) => x.id).filter((x) => x === p.id || picked.has(x));
              draw();
            } }, cardLabel(d, p.id));
          })),
          h('div', { class: 'row' },
            d.k === 't' && h('label', {}, 'Key ', h('select', { onchange: (e) => { d.y = +e.target.value; } },
              KEYS[tonality].map((k) => h('option', { value: k.midi, selected: k.midi === d.y }, k.name.replace('#', '♯').replace(/b$/, '♭') + (tonality === 'minor' ? 'm' : ''))))),
            h('label', {}, ' ♩ ', h('input', { type: 'number', min: 40, max: 200, value: d.q, class: 'tempo', 'aria-label': 'Tempo', onchange: (e) => { d.q = Math.max(40, Math.min(200, +e.target.value || 80)); } }))),
        );
      }
      // How the student may answer.
      rows.push(
        h('div', { class: 'row modes' }, MODES[d.k].map(([bit, , icon, label]) => h('label', {},
          h('input', { type: 'checkbox', checked: !!(d.o & bit), onchange: (e) => { d.o = e.target.checked ? d.o | bit : d.o & ~bit; draw(); } }), ` ${icon} ${label}`))),
        h('div', { class: 'row' },
          h('label', {}, h('input', { type: 'checkbox', checked: !!d.w, onchange: (e) => { d.w = e.target.checked ? 1 : 0; } }), d.k === 't' ? ' 🎤 Sing first, then play' : ' 🗣 Say first, then play'),
          h('label', {}, ' 🎯 ', h('input', { type: 'number', min: 0, max: 500, value: d.g || '', placeholder: '—', class: 'tempo', 'aria-label': 'Goal', onchange: (e) => { d.g = Math.max(0, Math.min(500, Math.round(+e.target.value) || 0)); } }))),
      );
      const ok = (d.k === 'n' ? d.r.length > 0 : d.p.length > 0) && d.o > 0;
      dlg.replaceChildren(h('form', { method: 'dialog', onsubmit: (e) => e.preventDefault() },
        ...rows,
        h('div', { class: 'bar actions' },
          h('button', { type: 'button', class: 'primary', disabled: !ok, onclick: () => done(d) }, 'Save'),
          h('button', { type: 'button', disabled: !ok, onclick: () => openPractice(dlg, d, { title }) }, 'Try'),
          h('span', { class: 'grow' }),
          h('button', { type: 'button', onclick: () => done(null) }, 'Cancel'))));
    }
    if (d.k !== 'n' && !d.p.length && kindUnits()[0]) useUnit(kindUnits()[0]);
    draw();
    dlg.showModal();
  });
}
