/* The planner: a grade's year as classes x slots, the song catalog beside it.
   Drag a song from the catalog onto a slot of its category, or drag between
   slots to move or swap. Shift-click a song to hold it one more class.
   Placing a song past its Max raises the Max to match. Each class can be
   built into a deck for the library. Everything saves to this device. */

import * as store from './store.js';
import { el } from './ui.js';
import { readWorkbook } from './xlsx.js';
import { fromWorkbook, schoolYear, nextYearLabel, newYear, SPECIALS, KIDS_CHOICE, isSpecial,
         songInfo, slotsOf, playCount, gradeHint, normName, songTimes } from './plans.js';
import { buildClass } from './builder.js';

const LONG_CLASS = 30;                      // minutes; a class planned longer shows red
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

const remember = (k, v) => { try { localStorage.setItem('class.' + k, v); } catch (e) { /* private window */ } };
const recall = (k) => { try { return localStorage.getItem('class.' + k); } catch (e) { return null; } };

let undoStack = [];
let keyHandler = null;

export async function showPlanner(main) {
  document.title = 'Planner · Class';
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  const years = await store.listPlans();
  const rec = years.find((y) => y.year === recall('year')) || years[years.length - 1];
  if (!rec) { main.replaceChildren(emptyView(main)); return; }
  const grade = rec.grades.includes(recall('grade')) ? recall('grade') : rec.grades[0];
  const decks = await store.listDecks();
  const times = songTimes(await store.listTimings());
  undoStack = [];
  render(main, { rec, years, grade, decks, times });
}

function emptyView(main) {
  return el('div', { class: 'empty' },
    el('h2', {}, 'No plan on this device yet'),
    el('p', {}, el('button', { class: 'btn', onclick: () => importWorkbook(main, []) }, 'Import DATABASE.xlsx')));
}

async function importWorkbook(main, years) {
  const input = el('input', { type: 'file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const label = (window.prompt('Which school year is this?', schoolYear()) || '').trim();
    if (!label) return;
    if (years.some((y) => y.year === label) && !window.confirm('Replace the ' + label + ' plan on this device with this workbook?')) return;
    try {
      const rec = fromWorkbook(await readWorkbook(await f.arrayBuffer()), label);
      await store.putPlan(rec);
      remember('year', label);
      store.setGradeHint(gradeHint(rec));
      showPlanner(main);
    } catch (err) {
      console.error(err);
      window.alert('That workbook could not be read: ' + err.message);
    }
  });
  input.click();
}

function render(main, ctx) {
  const { rec, grade } = ctx;
  const classes = () => rec.plan[grade] || (rec.plan[grade] = []);
  const classByNo = (no) => classes().find((c) => c.no === no) || null;
  let drag = null;
  let built = builtMap();

  function builtMap() {
    const m = new Map();
    for (const d of ctx.decks) {
      const b = d.deck.built;
      if (b && b.year === rec.year && b.grade === grade) m.set(b.no, d);
    }
    return m;
  }

  const status = el('span', { class: 'pl-status' });
  let statusTimer = null;
  const say = (msg) => {
    status.textContent = msg || '';
    clearTimeout(statusTimer);
    if (msg) statusTimer = setTimeout(() => { status.textContent = ''; }, 2500);
  };

  const save = () => {
    rec.updated = Date.now();
    store.putPlan(rec).catch((err) => { console.error(err); say('Not saved'); });
    store.setGradeHint(gradeHint(rec));
  };

  // ---- header ---------------------------------------------------------------

  const yearSel = el('select', { class: 'pl-select', 'aria-label': 'Year' },
    ctx.years.map((y) => el('option', { value: y.year, selected: y.year === rec.year }, y.year)),
    el('option', { value: '__new' }, 'New year…'),
    el('option', { value: '__import' }, 'Import workbook…'));
  yearSel.addEventListener('change', async () => {
    const v = yearSel.value;
    yearSel.value = rec.year;
    if (v === '__import') { importWorkbook(main, ctx.years); return; }
    if (v === '__new') {
      const label = (window.prompt('Name the new year:', nextYearLabel(rec.year)) || '').trim();
      if (!label) return;
      if (ctx.years.some((y) => y.year === label)) { window.alert('There is already a year called ' + label + '.'); return; }
      if (!window.confirm('Start ' + label + ' from ' + rec.year + '? The catalog carries over; the plans are emptied and every Max goes back to 0. ' + rec.year + ' stays as it is.')) return;
      await store.putPlan(newYear(rec, label));
      remember('year', label);
      showPlanner(main);
      return;
    }
    remember('year', v);
    showPlanner(main);
  });

  const tabs = el('span', { class: 'grades' }, rec.grades.map((g) => el('button', {
    class: 'chip' + (g === grade ? ' on' : ''),
    onclick: () => { remember('grade', g); showPlanner(main); }
  }, g)));

  const undoBtn = el('button', { class: 'btn quiet', disabled: true, onclick: () => undo() }, 'Undo');
  const bgSel = el('select', { class: 'pl-select', title: 'Title slide background on built decks', 'aria-label': 'Title background' },
    el('option', { value: 'blank', selected: rec.titleBg !== 'template' }, 'Blank title'),
    el('option', { value: 'template', selected: rec.titleBg === 'template' }, 'Template title'));
  bgSel.addEventListener('change', () => { rec.titleBg = bgSel.value; save(); });

  const search = el('input', { class: 'pl-search', placeholder: 'Filter songs', autocomplete: 'off', 'aria-label': 'Filter songs' });
  search.addEventListener('input', () => renderCatalog());
  const catList = el('div', { class: 'pl-catlist' });
  const table = el('table', { class: 'pl-grid' });

  main.replaceChildren(el('div', { class: 'planner' },
    el('div', { class: 'pl-head' }, el('h2', {}, 'Planner'), yearSel, tabs, el('span', { class: 'spacer' }), status, bgSel, undoBtn),
    el('div', { class: 'pl-body' },
      el('aside', { class: 'pl-catalog' }, search, catList),
      el('div', { class: 'pl-gridwrap' }, table))));

  keyHandler = (e) => {
    if (!document.body.contains(table)) { document.removeEventListener('keydown', keyHandler); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.code === 'KeyZ')) { e.preventDefault(); undo(); }
  };
  document.addEventListener('keydown', keyHandler);

  // ---- lookups --------------------------------------------------------------

  const catClass = (category) => 'cat' + rec.categories.indexOf(category);
  const plays = (category, name, through) => playCount(rec, grade, category, name, through);

  /** The class a song was last in before its current run: 0 for a debut, -1 inside a run. */
  function lastSeen(category, name, no, slot) {
    const prev = classByNo(no - 1);
    if (prev && prev.slots[slot] === name) return -1;
    const idx = slotsOf(rec, category);
    let best = 0;
    for (const c of classes()) {
      if (c.no >= no) continue;
      for (const i of idx) if (c.slots[i] === name) best = Math.max(best, c.no);
    }
    return best;
  }
  function runStart(name, no, slot) {
    let prev;
    while ((prev = classByNo(no - 1)) && prev.slots[slot] === name) no--;
    return no;
  }
  function runLength(name, no, slot) {
    let n = 0, c = classByNo(no);
    while (c && c.slots[slot] === name) { n++; c = classByNo(c.no + 1); }
    return n;
  }

  function rollup(cls) {
    let min = 0, y = 0, n = 0, rug = 0, score = 0, scored = 0;
    cls.slots.forEach((name, i) => {
      if (!name || isSpecial(name)) return;
      const info = songInfo(rec, rec.slots[i], name);
      if (!info) return;
      min += info.min;
      if (info.turns === 'Y') y++; else if (info.turns === 'N') n++;
      if (info.loc === 'Rug') rug++;
      if (info.eng || info.cmf) { score += (info.eng + info.cmf) / 2; scored++; }
    });
    return { min, y, n, rug, avg: scored ? score / scored : 0 };
  }

  // ---- catalog --------------------------------------------------------------

  function renderCatalog() {
    const q = search.value.trim().toLowerCase();
    const out = [];
    if (!q) {
      out.push(el('div', { class: 'pl-cat-head' }, 'Placeholders'));
      for (const s of SPECIALS) {
        const chip = el('div', { class: 'pl-chip special', draggable: 'true',
          title: s === KIDS_CHOICE ? 'The class picks a song from the category' : 'Concert prep: an empty slide' }, s);
        chip.addEventListener('dragstart', (e) => { drag = { from: 'catalog', category: null, song: s }; e.dataTransfer.setData('text/plain', s); });
        out.push(chip);
      }
    }
    for (const category of rec.categories) {
      const all = rec.catalog[category] || [];
      const songs = all.filter((s) => !q || s.name.toLowerCase().includes(q));
      if (!songs.length) continue;
      const cc = catClass(category);
      out.push(el('div', { class: 'pl-cat-head ' + cc }, category));
      for (const s of songs) out.push(catalogChip(category, s, all, cc));
    }
    catList.replaceChildren(...out);
  }

  function catalogChip(category, s, all, cc) {
    const used = plays(category, s.name);
    const max = s.max[grade] || 0;
    const chip = el('div', { class: 'pl-chip ' + cc + (s.shelf ? ' shelf' : '') + (max ? '' : ' nomax'), draggable: 'true' });
    const maxBtn = el('span', { class: 'maxbtn', title: 'Max for ' + grade }, max ? String(max) : '–');
    maxBtn.addEventListener('click', (e) => { e.stopPropagation(); editMax(s, maxBtn); });
    const bar = el('div', { class: 'bar' + (max && used > max ? ' over' : max && used === max ? ' full' : '') }, el('i'));
    bar.firstChild.style.width = max ? Math.min(100, used / max * 100) + '%' : '0';
    const pos = all.indexOf(s);
    const arrow = (label, d, title) => {
      const blocked = d < 0 ? pos <= 0 : pos >= all.length - 1;
      const b = el('b', { class: blocked ? 'off' : '', title }, label);
      b.addEventListener('click', (e) => { e.stopPropagation(); if (!blocked) moveSong(all, pos, d); });
      return b;
    };
    chip.append(
      el('div', { class: 'body' },
        el('div', { class: 'row1' }, el('span', { class: 'nm' }, s.name),
          el('span', { class: 'meta' }, r1(s.min) + ' min · ' + used + '/', maxBtn)),
        bar),
      el('div', { class: 'arrows' }, arrow('▲', -1, 'Move up'), arrow('▼', 1, 'Move down')));
    const timed = ctx.times.get(normName(s.name));
    chip.title = [s.pos, s.loc, 'Eng ' + s.eng, 'Cmf ' + s.cmf].filter(Boolean).join(' · ') +
      (timed ? ' · timed ' + r1(timed.min) + ' min (' + timed.n + ')' : '');
    chip.addEventListener('dragstart', (e) => { drag = { from: 'catalog', category, song: s.name }; e.dataTransfer.setData('text/plain', s.name); });
    return chip;
  }

  function editMax(s, span) {
    const input = el('input', { type: 'number', min: '0', class: 'maxin', value: String(s.max[grade] || 0) });
    span.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const commit = (keep) => {
      if (done) return;
      done = true;
      const v = Math.max(0, parseInt(input.value, 10) || 0);
      if (keep && v !== (s.max[grade] || 0)) { s.max[grade] = v; save(); say('Max ' + v); }
      redraw();
    };
    input.addEventListener('blur', () => commit(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit(true);
      if (e.key === 'Escape') commit(false);
    });
  }

  // Songs past SUMMARY are the shelf; a song can't be moved across it.
  function moveSong(all, i, d) {
    const j = i + d;
    if (all[i].shelf !== all[j].shelf) { say('The shelf stays below'); return; }
    [all[i], all[j]] = [all[j], all[i]];
    save();
    renderCatalog();
  }

  // ---- grid -----------------------------------------------------------------

  function renderGrid() {
    const head = el('tr', {},
      el('th', { class: 'cls' }, 'Class'),
      el('th', { class: 'meta' }, 'Intro music'),
      el('th', { class: 'meta' }, 'Special'),
      rec.slots.map((c) => el('th', { class: catClass(c) }, c)),
      el('th', { class: 'roll' }, 'Totals'),
      el('th', { class: 'build' }));
    table.replaceChildren(el('thead', {}, head), el('tbody', {}, classes().map(renderRow)));
  }

  function renderRow(cls) {
    const r = rollup(cls);
    const deck = built.get(cls.no);
    const b = el('button', { class: 'btn quiet small', onclick: () => build(cls.no, b) }, 'Build');
    return el('tr', {},
      el('td', { class: 'cls' }, el('div', {}, String(cls.no)),
        deck ? el('a', { class: 'built', href: '#/deck/' + deck.id }, 'built') : null),
      metaCell(cls, 'intro'),
      metaCell(cls, 'special'),
      rec.slots.map((category, i) => renderCell(cls, i, category)),
      el('td', { class: 'roll' },
        el('b', { class: r.min > LONG_CLASS ? 'long' : '' }, String(r1(r.min))), ' min · ',
        el('b', {}, String(r.y)), 'Y/', el('b', {}, String(r.n)), 'N · rug ', el('b', {}, String(r.rug)),
        ' · e/c ', el('b', {}, r.avg ? String(r1(r.avg)) : '–')),
      el('td', { class: 'build' }, b));
  }

  function metaCell(cls, field) {
    const input = el('input', { class: 'metain', value: cls[field] || '', spellcheck: 'false',
      'aria-label': (field === 'intro' ? 'Intro music' : 'Special') + ', class ' + cls.no });
    let committed = input.value;
    input.addEventListener('blur', () => {
      const v = input.value.trim();
      if (v === committed) return;
      committed = v;
      cls[field] = v;
      save();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.value = committed; input.blur(); }
    });
    return el('td', { class: 'meta' }, input);
  }

  function renderCell(cls, slot, category) {
    const td = el('td', { class: 'slot' });
    const name = cls.slots[slot];
    const div = el('div', { class: 'cell ' + catClass(category) + (name ? '' : ' empty') });
    if (name) {
      const special = isSpecial(name);
      const info = special ? null : songInfo(rec, category, name);
      if (!info && !special) div.classList.add('missing');
      const n = special ? 0 : plays(category, name, cls.no);
      const max = info ? info.max[grade] || 0 : 0;
      const first = !!info && n === 1;
      const last = !!info && max > 0 && n >= max;
      const label = first ? '*' + name + '*' : name;
      div.append(el('span', { class: 'nm' }, last ? el('u', {}, label) : label));
      const seen = special ? -1 : lastSeen(category, name, cls.no, slot);
      div.append(el('div', { class: 'foot' },
        el('span', {}, info ? r1(info.min) + ' min · ' + n + '/' + (max || '–') + (info.loc ? ' · ' + info.loc : '')
          : special ? '' : 'not in catalog'),
        seen > 0 ? el('span', { class: 'last' }, 'last ' + seen) : seen === 0 ? el('span', { class: 'last' }, 'new') : null));

      const start = runStart(name, cls.no, slot);
      const len = runLength(name, start, slot);
      if (len > 1) {
        const part = cls.no === start ? 'run-start' : cls.no === start + len - 1 ? 'run-end' : 'run-mid';
        div.classList.add('run', part);
        td.classList.add(part);
        if (part === 'run-start') div.append(el('span', { class: 'runbadge' }, '×' + len));
      }
      const x = el('span', { class: 'x', title: 'Clear' }, '×');
      x.addEventListener('click', (e) => { e.stopPropagation(); apply([{ no: cls.no, slot, value: '' }]); });
      div.append(x);
      div.draggable = true;
      div.title = 'Shift-click to hold for another class';
      div.addEventListener('dragstart', (e) => {
        drag = { from: 'cell', category, song: name, no: cls.no, slot };
        e.dataTransfer.setData('text/plain', name);
      });
      div.addEventListener('click', (e) => { if (e.shiftKey) { e.preventDefault(); extendRun(name, cls.no, slot); } });
    }
    div.addEventListener('dragover', (e) => {
      if (!drag || (drag.category && drag.category !== category)) return;
      e.preventDefault();
      div.classList.add('over');
    });
    div.addEventListener('dragleave', () => div.classList.remove('over'));
    div.addEventListener('drop', (e) => {
      e.preventDefault();
      div.classList.remove('over');
      if (drag) drop(cls.no, slot);
    });
    td.append(div);
    return td;
  }

  function extendRun(name, no, slot) {
    const start = runStart(name, no, slot);
    const end = start + runLength(name, start, slot) - 1;
    const next = classByNo(end + 1);
    if (!next) { say('No class after ' + end); return; }
    const there = next.slots[slot];
    if (there && there !== name && !window.confirm('Class ' + next.no + ' has ' + there + ' there. Replace it with ' + name + '?')) return;
    apply([{ no: next.no, slot, value: name }]);
  }

  function drop(no, slot) {
    const d = drag;
    drag = null;
    if (d.category && d.category !== rec.slots[slot]) return;
    if (d.from === 'catalog') { apply([{ no, slot, value: d.song }]); return; }
    if (d.no === no && d.slot === slot) return;
    const existing = classByNo(no).slots[slot];
    apply([{ no, slot, value: d.song }, { no: d.no, slot: d.slot, value: existing || '' }]);
  }

  function apply(edits) {
    const before = edits.map((e) => ({ no: e.no, slot: e.slot, value: classByNo(e.no).slots[e.slot] }));
    for (const e of edits) classByNo(e.no).slots[e.slot] = e.value;
    undoStack.push({ slots: before, maxes: raiseLimits(edits) });
    undoBtn.disabled = false;
    save();
    redraw();
  }

  // Placing a song it has no room for lifts its Max to match: 5/5 becomes 6/6.
  function raiseLimits(edits) {
    const seen = new Set(), previous = [];
    for (const e of edits) {
      if (!e.value || isSpecial(e.value)) continue;
      const category = rec.slots[e.slot];
      if (seen.has(category + ' ' + e.value)) continue;
      seen.add(category + ' ' + e.value);
      const s = songInfo(rec, category, e.value);
      if (!s) continue;
      const n = plays(category, e.value);
      if ((s.max[grade] || 0) >= n) continue;
      previous.push({ s, max: s.max[grade] || 0 });
      s.max[grade] = n;
    }
    return previous;
  }

  function undo() {
    const step = undoStack.pop();
    if (!step) return;
    for (const m of step.maxes) m.s.max[grade] = m.max;
    for (const e of step.slots) classByNo(e.no).slots[e.slot] = e.value;
    undoBtn.disabled = !undoStack.length;
    save();
    redraw();
    say('Undone');
  }

  function redraw() {
    const wrap = table.parentNode;
    const top = wrap.scrollTop, left = wrap.scrollLeft;
    renderGrid();
    renderCatalog();
    wrap.scrollTop = top;
    wrap.scrollLeft = left;
  }

  // ---- decks ----------------------------------------------------------------

  async function build(no, btn) {
    btn.disabled = true;
    try {
      ctx.decks = await store.listDecks();
      const { deck, name, missing } = buildClass(rec, grade, no, ctx.decks);
      const old = built.get(no);
      const now = Date.now();
      const id = old ? old.id : now.toString(36) + Math.random().toString(36).slice(2, 8);
      await store.putDeck({ id, name, created: old ? old.created : now, updated: now, source: 'planner ' + rec.year, deck });
      ctx.decks = await store.listDecks();
      built = builtMap();
      if (missing.length) window.alert('Built ' + name + ' without: ' + missing.join(', ') + '.');
      location.hash = '#/deck/' + id;
    } catch (err) {
      console.error(err);
      window.alert(err.message);
      btn.disabled = false;
    }
  }

  redraw();
}
