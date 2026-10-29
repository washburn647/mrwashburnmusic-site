/* Calendar: the school year from the workbook's Calendar sheet, a month at a
   time. Each school day shows its K and 1 rotation (A12, B12, C12: group and
   class number) or what it is instead (-, HD, Inservice), and each week PK's
   class number. Picking a day shows which class each grade has that day,
   with its deck. A day can be changed; later classes can move with it. */

import * as store from './store.js';
import { el } from './ui.js';
import { readWorkbook } from './xlsx.js';
import { readCalendar, dayInfo, setDay, mondayOf, ROTATION } from './plans.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const NOT_CLASS = ['-', 'HD', 'Inservice', 'CON'];
const PK = 'PK';                           // PK meets once a week, so it counts weeks

let shown = null;                          // 'YYYY-MM' on screen
let picked = null;                         // the chosen day

const iso = (d) => d.toISOString().slice(0, 10);
const todayIso = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const nice = (s) => {
  const d = new Date(s + 'T12:00:00Z');
  return DAYS[(d.getUTCDay() + 6) % 7] + ' ' + MONTHS[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCDate();
};

export function renderCalendar(main, ctx, head) {
  const { rec } = ctx;
  const days = rec.calendar || [];
  if (!days.length) {
    main.replaceChildren(el('div', { class: 'planner' }, head,
      el('div', { class: 'empty' }, el('h2', {}, 'No calendar for ' + rec.year + ' yet'),
        el('p', {}, el('button', { class: 'btn', onclick: () => importCalendar(ctx) }, 'Import the Calendar sheet')))));
    return;
  }
  const today = todayIso();
  const first = days[0].date, last = days[days.length - 1].date;
  if (!picked || picked < first || picked > last) picked = today >= first && today <= last ? today : first;
  if (!shown || shown + '-31' < first || shown + '-01' > last) shown = picked.slice(0, 7);

  const grid = el('div', { class: 'cal-grid' });
  const panel = el('aside', { class: 'cal-panel' });
  const title = el('h3', { class: 'cal-month' });
  const move = (k) => {
    const [y, m] = shown.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + k, 1));
    const next = iso(d).slice(0, 7);
    if (next + '-31' < first || next + '-01' > last) return;
    shown = next;
    paint();
  };

  main.replaceChildren(el('div', { class: 'planner' }, head,
    el('div', { class: 'cal-body' },
      el('div', { class: 'cal-main' },
        el('div', { class: 'cal-nav' },
          el('button', { class: 'btn quiet small', onclick: () => move(-1), 'aria-label': 'Previous month' }, '‹'),
          title,
          el('button', { class: 'btn quiet small', onclick: () => move(1), 'aria-label': 'Next month' }, '›'),
          el('button', { class: 'btn quiet small', onclick: () => { picked = today; shown = today.slice(0, 7); paint(); } }, 'Today')),
        grid),
      panel)));

  function paint() {
    const [y, m] = shown.split('-').map(Number);
    title.textContent = MONTHS[m - 1] + ' ' + y;
    const start = new Date(mondayOf(shown + '-01') + 'T12:00:00Z');
    const cells = [el('div', { class: 'cal-h' }, 'PK'), ...DAYS.map((d) => el('div', { class: 'cal-h' }, d))];
    for (let w = 0; w < 6; w++) {
      const mon = new Date(start);
      mon.setUTCDate(start.getUTCDate() + w * 7);
      if (w && mon.getUTCMonth() + 1 !== m) break;
      const pk = (rec.pkWeeks || {})[iso(mon)];
      cells.push(el('div', { class: 'cal-wk' }, pk ? String(pk) : ''));
      for (let k = 0; k < 5; k++) {
        const d = new Date(mon);
        d.setUTCDate(mon.getUTCDate() + k);
        const s = iso(d);
        const info = dayInfo(rec, s);
        const inMonth = d.getUTCMonth() + 1 === m;
        const known = days.some((x) => x.date === s);
        cells.push(el('button', {
          class: 'cal-day' + (inMonth ? '' : ' out') + (s === today ? ' today' : '') + (s === picked ? ' on' : '') +
            (info.rotation ? ' g-' + info.rotation.group : known && info.code ? ' off' : ''),
          onclick: () => { picked = s; paint(); }
        }, el('span', { class: 'cal-n' }, String(d.getUTCDate())), el('span', { class: 'cal-code' }, info.code)));
      }
    }
    grid.replaceChildren(...cells);
    paintPanel();
  }

  function paintPanel() {
    const info = dayInfo(rec, picked);
    const known = days.some((x) => x.date === picked);
    const rows = [];
    for (const g of rec.grades) {
      const no = g === PK ? info.pk : info.rotation && info.rotation.no;
      if (!no || (g !== PK && !info.rotation)) continue;
      const deck = ctx.decks.find((d) => d.deck.built && d.deck.built.year === rec.year && d.deck.built.grade === g && d.deck.built.no === no);
      rows.push(el('div', { class: 'cal-class' },
        el('b', {}, g + ' ' + no + (g !== PK ? ' · ' + info.rotation.group : '')),
        deck ? el('a', { class: 'btn small', href: '#/deck/' + deck.id }, 'Open') : null,
        el('button', { class: 'btn quiet small', onclick: (e) => { e.target.disabled = true; ctx.build(g, no).then((ok) => { e.target.disabled = !ok ? false : true; }); } }, deck ? 'Rebuild' : 'Build')));
    }

    const sel = el('select', { class: 'pl-select', 'aria-label': 'What this day is' },
      el('option', { value: '' }, ROTATION.test(info.code) ? info.code : 'Class'),
      NOT_CLASS.map((c) => el('option', { value: c, selected: c === info.code }, c)),
      !ROTATION.test(info.code) && info.code && !NOT_CLASS.includes(info.code) ? el('option', { value: info.code, selected: true }, info.code) : null,
      el('option', { value: '__other' }, 'Other…'));
    sel.addEventListener('change', () => {
      let v = sel.value;
      if (v === '__other') v = (window.prompt('What is this day?', info.code) || '').trim();
      if (!v && !ROTATION.test(info.code)) v = '+';           // back to a class day
      if (!v) { paint(); return; }
      const shift = window.confirm(v === '+' ? 'Move later classes earlier to fill this day?' : 'Move later classes back a day?');
      setDay(rec, picked, v, shift);
      ctx.save();
      paint();
    });

    panel.replaceChildren(
      el('h3', {}, nice(picked)),
      known ? el('div', { class: 'cal-what' }, sel) : el('p', { class: 'cal-none' }, 'Not a school day'),
      info.pk ? el('p', { class: 'cal-pk' }, 'PK week ' + info.pk) : null,
      ...rows);
  }

  paint();
}

async function importCalendar(ctx) {
  const input = el('input', { type: 'file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    try {
      const sheets = await readWorkbook(await f.arrayBuffer());
      const { calendar, pkWeeks } = readCalendar(sheets.get('Calendar'));
      if (!calendar.length) throw new Error('it has no Calendar sheet with dates.');
      ctx.rec.calendar = calendar;
      ctx.rec.pkWeeks = pkWeeks;
      await store.putPlan(ctx.rec);
      ctx.reload();
    } catch (err) {
      console.error(err);
      window.alert('That workbook could not be read: ' + err.message);
    }
  });
  input.click();
}
