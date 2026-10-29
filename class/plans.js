/* The year plan: the song catalog and which song fills each slot of each
   class, per grade. Same rules as the Apps Script planner it replaces.

   A year record:
   { year: '2026-27', grades: ['PK', 'K', '1'],
     slots: ['Vocal Warmup', 'Song Fragments', 'Simple Songs', 'Simple Songs', ...],
     categories: [...],                    // each once, in slot order
     catalog: { category: [{ name, min, turns, pos, loc, eng, cmf, max: { PK: 6 }, shelf, more }] },
     fields: { category: ['Key', 'Ton.', 'Met.', 'Lesson 1', ..., 'Notes'] },   // what `more` holds
     plan: { PK: [{ no, intro, special, slots: ['Slide Whistle', '', ...] }] },
     calendar: [{ date: '2026-08-26', code: 'C1' }, ...],   // school days, Monday to Friday
     pkWeeks: { '2026-08-24': 1, ... },                     // Monday -> PK's class that week
     intro: [{ name, url }],                                // the intro music list
     titleBg: 'blank' | 'template', updated } */

export const KIDS_CHOICE = '???';
export const CONCERT = 'CONCERT';
export const SPECIALS = [KIDS_CHOICE, CONCERT];

const FIRST_PLAN_ROW = 7;                  // class 1 on row 7, class n on row 7 + (n - 1) * 2
const FIRST_SLOT_COL = 4;                  // D, then every five columns
const SLOT_STEP = 5;
const CATALOG_FIRST_ROW = 4;

/** Must match the planner's and the deck builder's: slides are found by it. */
export function normName(s) {
  return String(s || '').toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[^a-z0-9']+/g, ' ').trim();
}

const str = (v) => (v == null ? '' : String(v).trim());
const num = (v) => Number(v) || 0;

/** A planning workbook (DATABASE.xlsx), read by xlsx.js, as a year record. */
export function fromWorkbook(sheets, year) {
  const gradeSheets = [...sheets].filter(([, rows]) => /^week$/i.test(str(rows[0] && rows[0][0])));
  if (!gradeSheets.length) throw new Error('No grade sheets in this workbook.');

  // Slots from the first grade sheet's header row. A category that runs two
  // slots has its name only over the first (the cells are merged).
  const head = gradeSheets[0][1][0];
  const cats = new Set();
  for (const [name, rows] of sheets) {
    if (/^song/i.test(str(rows[1] && rows[1][0]))) cats.add(name);
  }
  const slots = [];
  let last = '';
  for (let c = FIRST_SLOT_COL - 1; ; c += SLOT_STEP) {
    const h = str(head[c]) || last;
    if (!cats.has(h)) break;
    slots.push(h);
    last = h;
  }
  if (!slots.length) throw new Error('The grade sheets have no song columns.');
  const categories = [...new Set(slots)];

  // Grade columns on a category sheet: the grade over "Plan", "Max", "Diff.".
  const catHead = sheets.get(categories[0])[1];
  const gradeCols = [];
  catHead.forEach((v, c) => { if (c > 6 && v !== '' && v != null && gradeCols.length < gradeSheets.length) gradeCols.push({ key: str(v), max: c + 1 }); });
  const grades = gradeCols.map((g) => g.key);
  const firstMore = gradeCols.length ? gradeCols[gradeCols.length - 1].max + 2 : 7;

  const catalog = {};
  const fields = {};
  for (const category of categories) {
    const rows = sheets.get(category);
    // Whatever the sheet keeps after the grade columns: Key, Lesson 1, Notes...
    const more = [];
    (rows[1] || []).forEach((v, c) => { if (c >= firstMore && str(v) && !/^\d+(\.\d+)?$/.test(str(v))) more.push({ c, name: str(v) }); });
    fields[category] = more.map((m) => m.name);
    const out = [];
    let shelf = false;
    for (let r = CATALOG_FIRST_ROW - 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const name = str(row[0]);
      if (!name) continue;
      if (name.toUpperCase() === 'SUMMARY') { shelf = true; continue; }
      if (SPECIALS.includes(name)) continue;            // the sheet's own ??? and CONCERT rows
      const max = {};
      for (const g of gradeCols) max[g.key] = num(row[g.max]);
      const extra = {};
      for (const m of more) if (str(row[m.c])) extra[m.name] = str(row[m.c]);
      out.push({ name, min: num(row[1]), turns: str(row[2]), pos: str(row[3]), loc: str(row[4]),
                 eng: num(row[5]), cmf: num(row[6]), max, shelf, more: extra });
    }
    catalog[category] = out;
  }

  const plan = {};
  gradeSheets.forEach(([, rows], gi) => {
    const key = grades[gi];
    if (!key) return;
    const classes = [];
    for (let r = FIRST_PLAN_ROW - 1; r < rows.length; r += 2) {
      const row = rows[r] || [];
      const no = num(row[0]);
      if (!no) continue;
      classes.push({ no, intro: str(row[1]), special: str(row[2]),
                     slots: slots.map((_, i) => str(row[FIRST_SLOT_COL - 1 + i * SLOT_STEP])) });
    }
    plan[key] = classes;
  });

  const { calendar, pkWeeks } = readCalendar(sheets.get('Calendar'));
  const intro = (sheets.get('Intro Music') || []).filter((r) => r && str(r[1]))
    .map((r) => ({ name: str(r[1]), url: str(r[2]) }));
  return { year, grades, slots, categories, catalog, fields, plan, calendar, pkWeeks, intro,
           titleBg: 'blank', updated: Date.now() };
}

// Excel keeps a date as days since 1899-12-30.
function isoDate(v) {
  if (typeof v !== 'number' || v < 30000) return null;
  return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
}

/* The Calendar sheet: a row of Monday-Friday dates (with PK's week number in
   F), then a row of what each day is: A12, B12, C12 for the K and 1
   rotation, or '-', HD, Inservice and the like. */
export function readCalendar(rows) {
  const calendar = [], pkWeeks = {};
  if (!rows) return { calendar, pkWeeks };
  for (let r = 0; r < rows.length - 1; r++) {
    const dates = (rows[r] || []).slice(0, 5).map(isoDate);
    if (!dates.some(Boolean)) continue;
    const codes = rows[r + 1] || [];
    dates.forEach((d, i) => { if (d) calendar.push({ date: d, code: str(codes[i]) }); });
    const wk = num((rows[r] || [])[5]);
    if (wk && dates[0]) pkWeeks[dates[0]] = wk;
    r++;
  }
  return { calendar, pkWeeks };
}

export const ROTATION = /^([A-Z])(\d+)$/;

/** Monday of the week a date is in, as YYYY-MM-DD. */
export function mondayOf(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** What happens on a date: { code, rotation: { group, no } | null, pk }. */
export function dayInfo(rec, iso) {
  const day = (rec.calendar || []).find((d) => d.date === iso);
  const m = day && ROTATION.exec(day.code);
  return { code: day ? day.code : '', rotation: m ? { group: m[1], no: Number(m[2]) } : null,
           pk: (rec.pkWeeks || {})[mondayOf(iso)] || null };
}

/** A class day becomes `code` (or goes back to a class); later classes move with it when `shift`. */
export function setDay(rec, iso, code, shift) {
  const days = rec.calendar || (rec.calendar = []);
  const i = days.findIndex((d) => d.date === iso);
  if (i < 0) return;
  const was = days[i].code;
  const later = days.slice(i + 1).filter((d) => ROTATION.test(d.code));
  if (shift && ROTATION.test(was) && !ROTATION.test(code)) {
    // A class day lost: every later class slides one class day later.
    const codes = [was, ...later.map((d) => d.code)];
    days[i].code = code;
    later.forEach((d, k) => { d.code = codes[k]; });
  } else if (shift && !ROTATION.test(was) && code === '+') {
    // A class day gained: this day takes the next class, the rest slide earlier.
    if (!later.length) return;
    days[i].code = later[0].code;
    later.forEach((d, k) => { d.code = k + 1 < later.length ? later[k + 1].code : '-'; });
  } else {
    days[i].code = code === '+' ? '' : code;
  }
}

/** "2026-27" for a date from August on, else the year before. */
export function schoolYear(d = new Date()) {
  const a = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return a + '-' + String((a + 1) % 100).padStart(2, '0');
}

export function nextYearLabel(label) {
  const m = /^(\d{4})-(\d{2})$/.exec(label);
  if (!m) return '';
  const a = Number(m[1]) + 1;
  return a + '-' + String((a + 1) % 100).padStart(2, '0');
}

/** A new year from an old one: catalog and ratings kept, plans emptied, every Max back to 0. */
export function newYear(rec, label) {
  const y = structuredClone(rec);
  y.year = label;
  y.calendar = [];
  y.pkWeeks = {};
  for (const list of Object.values(y.catalog)) for (const s of list) for (const g of Object.keys(s.max)) s.max[g] = 0;
  for (const classes of Object.values(y.plan)) {
    for (const c of classes) { c.intro = ''; c.special = ''; c.slots = c.slots.map(() => ''); }
  }
  y.updated = Date.now();
  return y;
}

// ---- reading a plan ---------------------------------------------------------

export const isSpecial = (name) => SPECIALS.includes(name);

export function songInfo(rec, category, name) {
  return (rec.catalog[category] || []).find((s) => s.name === name) || null;
}

export function slotsOf(rec, category) {
  return rec.slots.map((c, i) => (c === category ? i : -1)).filter((i) => i >= 0);
}

/** Times a song is slated in its category for a grade, through class `through` (all if left out). */
export function playCount(rec, grade, category, name, through) {
  const idx = slotsOf(rec, category);
  let n = 0;
  for (const c of rec.plan[grade] || []) {
    if (through != null && c.no > through) continue;
    for (const i of idx) if (c.slots[i] === name) n++;
  }
  return n;
}

/** One class's running order, with the counts its slides show. */
export function readClass(rec, grade, no) {
  const cls = (rec.plan[grade] || []).find((c) => c.no === no);
  if (!cls) return null;
  const songs = [];
  cls.slots.forEach((song, i) => {
    if (!song) return;
    const category = rec.slots[i];
    if (isSpecial(song)) { songs.push({ category, song, special: song, plays: 0, max: 0, isFirst: false, isLast: false }); return; }
    const plays = playCount(rec, grade, category, song, no);
    const info = songInfo(rec, category, song);
    const max = info ? info.max[grade] || 0 : 0;
    songs.push({ category, song, special: null, plays, max, isFirst: plays === 1, isLast: max > 0 && plays >= max });
  });
  return { grade, no, intro: cls.intro, special: cls.special, songs };
}

/** normName -> the grades a song has a Max in, for marks.js to tag song slides with. */
export function gradeHint(rec) {
  const out = new Map();
  if (!rec) return out;
  for (const list of Object.values(rec.catalog)) {
    for (const s of list) {
      const g = rec.grades.filter((k) => s.max[k] > 0);
      if (g.length) out.set(normName(s.name), g);
    }
  }
  return out;
}

// ---- slides -----------------------------------------------------------------

/** The library deck for a category: the one with the category's name. */
export function categoryDeck(decks, category) {
  const want = normName(category);
  return decks.find((d) => normName(d.name) === want) || null;
}

function lines(slide) {
  const out = [];
  for (const el of slide.els) {
    if (!el.text) continue;
    for (const p of el.text.paras) {
      const t = p.runs.map((r) => r.t || '').join('').trim();
      if (t) out.push(t);
    }
  }
  return out;
}

/** normName -> slide indexes, for every slide that names a catalog song in a line of its own. */
export function indexSongs(deck, names) {
  const known = new Map(names.map((n) => [normName(n), n]));
  const index = new Map();
  deck.slides.forEach((slide, i) => {
    const hit = lines(slide).map(normName).find((n) => known.has(n));
    if (!hit) return;
    if (!index.has(hit)) index.set(hit, []);
    index.get(hit).push(i);
  });
  return index;
}

/** Average minutes per class a song took, from the timings Present saved. normName -> { min, n }. */
export function songTimes(timings) {
  const sittings = new Map();                // song|deck|day -> ms
  for (const t of timings) {
    if (!t.song) continue;
    const key = normName(t.song) + '|' + t.deck + '|' + new Date(t.at).toDateString();
    sittings.set(key, (sittings.get(key) || 0) + t.ms);
  }
  const sums = new Map();
  for (const [key, ms] of sittings) {
    const song = key.split('|')[0];
    const s = sums.get(song) || { ms: 0, n: 0 };
    s.ms += ms; s.n++;
    sums.set(song, s);
  }
  const out = new Map();
  for (const [song, s] of sums) out.set(song, { min: s.ms / s.n / 60000, n: s.n });
  return out;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (iso) => MON[Number(iso.slice(5, 7)) - 1] + ' ' + Number(iso.slice(8, 10));

/** class number -> when it falls, from the calendar: "Oct 26–28" for the rotation, "wk of Oct 26" for PK. */
export function classDates(rec, grade) {
  const out = new Map();
  if (grade === 'PK') {
    for (const [mon, no] of Object.entries(rec.pkWeeks || {})) if (!out.has(no)) out.set(no, 'wk of ' + short(mon));
    return out;
  }
  const spans = new Map();
  for (const d of rec.calendar || []) {
    const m = ROTATION.exec(d.code);
    if (!m) continue;
    const no = Number(m[2]);
    const s = spans.get(no) || { from: d.date, to: d.date };
    if (d.date < s.from) s.from = d.date;
    if (d.date > s.to) s.to = d.date;
    spans.set(no, s);
  }
  for (const [no, s] of spans) {
    const a = short(s.from), b = short(s.to);
    out.set(no, a === b ? a : a.slice(0, 3) === b.slice(0, 3) ? a + '–' + b.slice(4) : a + '–' + b);
  }
  return out;
}
