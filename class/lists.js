/* Lists: a category's songs as the workbook's category sheet showed them.
   Edit any detail in place; Max is the same Max the planner shows. Songs
   in rotation come first, then the shelf (out of rotation). A renamed song
   is renamed in the plans too. */

import { el } from './ui.js';
import { playCount, slotsOf } from './plans.js';

const recall = (k) => { try { return localStorage.getItem('class.' + k); } catch (e) { return null; } };
const remember = (k, v) => { try { localStorage.setItem('class.' + k, v); } catch (e) { /* private window */ } };

const BASIC = [
  ['min', 'Min.', 'num'], ['turns', 'Turns', ['', 'Y', 'N']], ['pos', 'Pos.', ['', 'Up', 'Down']],
  ['loc', 'Loc.', ['', 'Rug', 'Spread', 'Squares']], ['eng', 'Eng.', 'num'], ['cmf', 'Cmf.', 'num']
];

export function renderLists(main, ctx, head) {
  const { rec } = ctx;
  let category = rec.categories.includes(recall('list')) ? recall('list') : rec.categories[0];
  const body = el('div', { class: 'ls-wrap' });
  const pick = el('span', { class: 'grades ls-cats' });
  main.replaceChildren(el('div', { class: 'planner' }, head, el('div', { class: 'ls-bar' }, pick), body));

  function paint() {
    pick.replaceChildren(...rec.categories.map((c, i) => el('button', {
      class: 'chip cat' + i + (c === category ? ' on' : ''),
      onclick: () => { category = c; remember('list', c); paint(); }
    }, c)));
    const list = rec.catalog[category] || (rec.catalog[category] = []);
    const more = (rec.fields && rec.fields[category]) || [];
    const headRow = el('tr', {},
      el('th', { class: 'ls-name' }, 'Song'),
      BASIC.map(([, label]) => el('th', {}, label)),
      rec.grades.map((g) => el('th', { class: 'ls-g', colspan: '3' }, g)),
      more.map((f) => el('th', {}, f)),
      el('th', {}));
    const subRow = el('tr', { class: 'ls-sub' }, el('th'), BASIC.map(() => el('th')),
      rec.grades.flatMap(() => [el('th', {}, 'Plan'), el('th', {}, 'Max'), el('th', {}, 'Left')]), more.map(() => el('th')), el('th'));
    const rows = [];
    const inRotation = list.filter((s) => !s.shelf), shelf = list.filter((s) => s.shelf);
    inRotation.forEach((s) => rows.push(row(s, list, more)));
    rows.push(addRow(list, more));
    if (shelf.length) {
      rows.push(el('tr', { class: 'ls-shelf-head' }, el('td', { colspan: String(1 + BASIC.length + rec.grades.length * 3 + more.length + 1) }, 'Out of rotation')));
      shelf.forEach((s) => rows.push(row(s, list, more)));
    }
    body.replaceChildren(el('table', { class: 'ls-table' }, el('thead', {}, headRow, subRow), el('tbody', {}, rows)));
  }

  function input(value, onSave, kind, label) {
    let node;
    if (Array.isArray(kind)) {
      node = el('select', { class: 'ls-in', 'aria-label': label }, [...new Set([...kind, value])].map((v) => el('option', { value: v, selected: v === value }, v)));
      node.addEventListener('change', () => onSave(node.value));
      return node;
    }
    node = el('input', { class: 'ls-in' + (kind === 'num' ? ' num' : ''), value: value == null ? '' : String(value),
      type: kind === 'num' ? 'number' : 'text', min: kind === 'num' ? '0' : null, step: 'any', 'aria-label': label });
    let was = node.value;
    node.addEventListener('blur', () => { if (node.value !== was) { was = node.value; onSave(kind === 'num' ? Number(node.value) || 0 : node.value.trim()); } });
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') node.blur(); if (e.key === 'Escape') { node.value = was; node.blur(); } });
    return node;
  }

  function row(s, list, more) {
    const tr = el('tr', { class: s.shelf ? 'ls-off' : '' });
    tr.append(el('td', { class: 'ls-name' }, input(s.name, (v) => rename(s, v), 'text', 'Song')));
    for (const [k, label, kind] of BASIC) tr.append(el('td', {}, input(s[k], (v) => { s[k] = v; ctx.save(); }, kind, label + ', ' + s.name)));
    for (const g of rec.grades) {
      const used = playCount(rec, g, category, s.name);
      const max = s.max[g] || 0;
      tr.append(el('td', { class: 'ls-used' }, String(used)),
        el('td', {}, input(max, (v) => { s.max[g] = v; ctx.save(); paint(); }, 'num', 'Max ' + g + ', ' + s.name)),
        el('td', { class: 'ls-left' + (max - used < 0 ? ' over' : '') }, String(max - used)));
    }
    for (const f of more) {
      tr.append(el('td', { class: f === 'Notes' ? 'ls-notes' : '' }, input((s.more || {})[f] || '', (v) => {
        s.more = s.more || {};
        if (v) s.more[f] = v; else delete s.more[f];
        ctx.save();
      }, 'text', f + ', ' + s.name)));
    }
    tr.append(el('td', {}, el('div', { class: 'ls-act' },
      el('button', { class: 'btn quiet small', title: s.shelf ? 'Back into rotation' : 'Out of rotation',
        onclick: () => { s.shelf = !s.shelf; list.splice(list.indexOf(s), 1); s.shelf ? list.push(s) : list.splice(list.filter((x) => !x.shelf).length, 0, s); ctx.save(); paint(); } },
      s.shelf ? '↑ Rotation' : '↓ Shelf'),
      el('button', { class: 'btn danger small', title: 'Remove', onclick: () => remove(s, list) }, '✕'))));
    return tr;
  }

  function addRow(list, more) {
    const name = el('input', { class: 'ls-in', placeholder: 'New song', 'aria-label': 'New song' });
    const add = () => {
      const v = name.value.trim();
      if (!v) return;
      if (list.some((s) => s.name.toLowerCase() === v.toLowerCase())) { window.alert(v + ' is already in ' + category + '.'); return; }
      const max = {};
      for (const g of rec.grades) max[g] = 0;
      list.splice(list.filter((x) => !x.shelf).length, 0, { name: v, min: 0, turns: '', pos: '', loc: '', eng: 0, cmf: 0, max, shelf: false, more: {} });
      ctx.save();
      paint();
    };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    return el('tr', { class: 'ls-add' }, el('td', { class: 'ls-name' }, name),
      el('td', { colspan: String(BASIC.length + rec.grades.length * 3 + more.length + 1) },
        el('button', { class: 'btn small', onclick: add }, 'Add')));
  }

  function slotsUsing(name) {
    const idx = slotsOf(rec, category);
    let n = 0;
    for (const g of rec.grades) for (const c of rec.plan[g] || []) for (const i of idx) if (c.slots[i] === name) n++;
    return n;
  }

  function rename(s, v) {
    if (!v || v === s.name) { paint(); return; }
    const list = rec.catalog[category];
    if (list.some((x) => x !== s && x.name.toLowerCase() === v.toLowerCase())) { window.alert(v + ' is already in ' + category + '.'); paint(); return; }
    const idx = slotsOf(rec, category);
    for (const g of rec.grades) for (const c of rec.plan[g] || []) for (const i of idx) if (c.slots[i] === s.name) c.slots[i] = v;
    s.name = v;
    ctx.save();
    paint();
  }

  function remove(s, list) {
    const n = slotsUsing(s.name);
    if (n) { window.alert(s.name + ' is in ' + n + ' planned class' + (n > 1 ? 'es' : '') + '. Take it out of those first, or move it to the shelf.'); return; }
    if (!window.confirm('Remove ' + s.name + ' from ' + category + '?')) return;
    list.splice(list.indexOf(s), 1);
    ctx.save();
    paint();
  }

  paint();
}
