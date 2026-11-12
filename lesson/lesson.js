/* A private lesson student's page. It opens two ways:
   - with their code (/lesson/#tiger-moon-...): their locked pages from the site, this
     week's lesson first, earlier ones below (see locked.js). The code is remembered on
     this device; flash card results go back to Kyle, encrypted.
   - with a lesson link: the whole page is inside the link (see codec.js).
   Checkmarks and practice minutes are kept only in this browser. */

import { decodeLesson, cleanPage, formatDate } from './codec.js';
import { secretFor, openPages, sendResult, PICKS } from './locked.js';
import { LOGO, QR_SRC, LESSON_PAGE } from './paths.js';
import { loadScript } from './score.js';
import { confetti } from './fun.js';
import { openPlayer, PIECE_MODES } from './player.js';
import { openPractice } from './practice.js';
import * as snd from './sound.js';

// Opened over plain http (a typed address can land there), the browser has no crypto.subtle,
// so a student's pages can't be unlocked: go to the https page.
if (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) location.replace(`https://${location.host}${location.pathname}${location.search}${location.hash}`);

const main = document.getElementById('page');

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  e.append(...kids.flat().filter((x) => x != null && x !== false));
  return e;
}

async function keyFor(hash) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hash));
  return `lesson:${[...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* Whole days from today to a 'YYYY-MM-DD' date, or null. */
function daysUntil(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return null;
  const now = new Date();
  return Math.round((new Date(+m[1], m[2] - 1, +m[3]) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
}

/* ---------- Overlays (piece player, flash cards) close with Back ---------- */

let overlay = null;
let ownBacks = 0;  // history.back() calls of ours whose popstate hasn't come yet
function openOverlay(make) {
  history.pushState({ overlay: 1 }, '');
  const me = { ctl: null };
  overlay = me;
  return make(() => {
    if (overlay !== me) return;
    overlay = null;
    ownBacks++;
    history.back();
  }).then((ctl) => { me.ctl = ctl; });
}
window.addEventListener('popstate', () => {
  if (ownBacks) { ownBacks--; return; }
  if (overlay) { const o = overlay; overlay = null; o.ctl?.close(); }
});

/* ---------- Which page ---------- */

const CODE = 'lesson:code';
const savedCode = () => { try { return localStorage.getItem(CODE) || ''; } catch { return ''; } };
const logo = () => el('header', {}, el('img', { src: LOGO, alt: 'Mr. Washburn Music' }));

async function show() {
  const hash = decodeURIComponent(location.hash.slice(1));
  const code = !hash && savedCode();
  if (code && code.includes('/')) { showLocked(code); return; }
  let page = null;
  if (hash) { try { page = await decodeLesson(hash); } catch { page = null; } }
  if (!page) { showEntry(); return; }
  render(page, { key: await keyFor(hash), qr: location.href });
}

/* Where a student signs in: their first name and their four emojis. */
function showEntry(problem = '') {
  stop();
  document.title = 'Lesson · Mr. Washburn Music';
  const picks = [...PICKS].sort((a, b) => a[0].localeCompare(b[0]));
  const name = el('input', { class: 'codename', autocomplete: 'off', autocapitalize: 'words', spellcheck: false, 'aria-label': 'First name', placeholder: '🙂' });
  const lists = [1, 2, 3, 4].map((n) => el('select', { class: 'codepick', 'aria-label': `Emoji ${n}` },
    el('option', { value: '' }, '—'),
    ...picks.map(([w, e]) => el('option', { value: w }, `${e} ${w}`))));
  const form = el('form', { class: 'codeform' + (problem ? ' shake' : ''), onsubmit: (e) => {
    e.preventDefault();
    const secret = secretFor(name.value, lists.map((x) => x.value).join(' '));
    if (!secret) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); return; }
    showLocked(secret);
  } }, name, el('div', { class: 'picks' }, ...lists), el('button', { class: 'go', 'aria-label': 'Open' }, '▶'));
  main.replaceChildren(logo(), form, ...(problem ? [el('p', { class: 'codeerr' }, problem)] : []));
  name.focus();
}

async function showLocked(code) {
  stop();
  main.replaceChildren(logo(), el('p', { class: 'loading' }, '🎵'));
  let pages;
  try {
    pages = await openPages(code);
  } catch {
    main.replaceChildren(logo(), el('p', { class: 'codeerr' }, '📡'), el('button', { class: 'go', 'aria-label': 'Try again', onclick: () => showLocked(code) }, '🔁'));
    return;
  }
  if (!pages || !pages.l?.length) { showEntry(savedCode() !== code ? '✗' : ''); return; }
  try { localStorage.setItem(CODE, code); } catch { /* private window */ }
  sendPending(code);
  const lessons = pages.l.map((l) => cleanPage({ ...l, v: 2, n: pages.n, i: pages.i, p: pages.p }));
  const upcoming = Array.isArray(pages.u) ? pages.u.filter((d) => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d)).sort() : null;
  // The songs and material Kyle picked for them to keep, from every lesson.
  const shelf = pages.b?.length ? cleanPage({ v: 2, n: pages.n, i: pages.i, t: pages.b, p: pages.p }) : null;
  const forget = () => { try { localStorage.removeItem(CODE); } catch { /* nothing kept */ } showEntry(); };
  const openShelf = async () => {
    render(shelf, {
      key: await keyFor(`${code}/library`), qr: LESSON_PAGE, shelf: true, lessons, index: -1, open, openShelf, forget,
      onCards: (it, r) => queueResult(code, { y: 'c', t: Date.now(), d: 'library', a: it.a, ...r }),
      onPiece: (it, r) => queueResult(code, { y: 'p', t: Date.now(), d: 'library', a: it.a, ...r }),
    });
    scrollTo(0, 0);
  };
  const open = async (index) => {
    render(lessons[index], {
      key: await keyFor(`${code}/${lessons[index].d}`),
      qr: LESSON_PAGE,
      lessons, index, open, openShelf: shelf && openShelf, upcoming,
      onCards: (it, r) => queueResult(code, { y: 'c', t: Date.now(), d: lessons[index].d, a: it.a, ...r }),
      onPiece: (it, r) => queueResult(code, { y: 'p', t: Date.now(), d: lessons[index].d, a: it.a, ...r }),
      onVisit: () => visited(code, lessons[index].d),
      forget,
    });
    scrollTo(0, 0);
  };
  open(0);
}

/* Kyle sees the days the page was opened: one note a day. */
async function visited(code, d) {
  const key = `${await keyFor(code)}:seen`;
  const day = iso(new Date());
  if (load(key).day === day) return;
  try { localStorage.setItem(key, JSON.stringify({ day })); } catch { /* nothing kept */ }
  queueResult(code, { y: 'v', t: Date.now(), d });
}

/* Flash card results go to Kyle, encrypted; ones that can't go yet wait on this device. */
const pendingKey = async (code) => `${await keyFor(code)}:pending`;
async function queueResult(code, result) {
  const key = await pendingKey(code);
  const list = load(key).list || [];
  list.push(result);
  try { localStorage.setItem(key, JSON.stringify({ list: list.slice(-200) })); } catch { /* nothing kept */ }
  sendPending(code);
}
let sending = false;
async function sendPending(code) {
  if (sending) return;
  sending = true;
  const key = await pendingKey(code);
  try {
    let list = load(key).list || [];
    while (list.length) {
      await sendResult(code, list[0]);
      list = (load(key).list || []).slice(1);
      localStorage.setItem(key, JSON.stringify({ list }));
    }
  } catch { /* offline: next time */ }
  sending = false;
}

/* Timers of the page on show, stopped when another is shown. */
let timers = [];
function stop() { timers.forEach(clearInterval); timers = []; }

/* ---------- The page ---------- */

function render(page, { key, qr: qrText, lessons, index = 0, open, openShelf, shelf = false, upcoming, onCards, onPiece, onVisit, forget }) {
  stop();
  const header = logo();
  document.title = `${page.n || 'Lesson'} · Mr. Washburn Music`;
  const state = load(key);
  state.cards = state.cards || {};
  state.plays = state.plays || {};
  state.party = state.party || {};
  const save = () => { try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* private window: nothing stays */ } };

  header.append(el('div', {},
    el('h1', { textContent: page.n }),
    el('p', { textContent: shelf ? '📚' : [page.i, formatDate(page.d)].filter(Boolean).join(' · ') })));

  /* Stars from Mr. W */
  const reward = page.s ? el('div', { class: 'reward' }, el('span', { class: 'rstars', 'aria-label': `${page.s} stars` }, '★'.repeat(page.s))) : null;

  /* Days until the next lesson, and what they've done this week */
  const today = iso(new Date());
  // The next lesson date from the calendar (pages opened by name), else the one the page names.
  const until = Array.isArray(upcoming) && upcoming.length
    ? upcoming.map(daysUntil).find((n) => n != null && n >= 0) ?? null
    : daysUntil(page.x);
  const next = until != null && until >= 0 && el('p', { class: 'nextlesson' },
    until === 0 ? '🎵 Lesson today!' : el('span', {}, el('b', {}, String(until)), until === 1 ? ' day until your next lesson' : ' days until your next lesson'));
  const doneEl = el('div', { class: 'done' });
  const showDone = () => {
    const mins = Math.round((state.secs || 0) / 60);
    const plays = Object.values(state.plays).reduce((a, b) => a + b, 0);
    const cards = Object.values(state.cards).reduce((a, c) => a + (c.n || 0), 0);
    doneEl.replaceChildren(
      el('span', { title: 'Minutes', 'aria-label': `${mins} minutes` }, '⏱ ', el('b', {}, String(mins)), page.w ? ` / ${page.w * 7}` : '', ' min'),
      el('span', { title: 'Times played', 'aria-label': `${plays} plays` }, '🎵 ', el('b', {}, String(plays))),
      el('span', { title: 'Flash cards', 'aria-label': `${cards} cards` }, '🃏 ', el('b', {}, String(cards))));
  };
  const addTime = (secs) => {
    state.secs = (state.secs || 0) + Math.min(secs, 4 * 3600);
    save();
    showDone();
  };
  showDone();
  const practice = shelf ? null : el('section', { class: 'practice' }, next, doneEl);
  if (onVisit) onVisit();

  /* The list */
  const boxes = [];
  function checkAll() {
    if (boxes.length && boxes.every((b) => b.checked) && !state.party[`all${today}`]) {
      state.party[`all${today}`] = 1;
      save();
      snd.fanfare();
      confetti(160);
    }
  }

  const list = el('ol', { class: 'items' }, ...page.t.map((it, i) => {
    const box = el('input', { type: 'checkbox', checked: !!state[`item${i}`] });
    box.setAttribute('aria-label', it.a || `Item ${i + 1}`);
    box.addEventListener('change', () => { state[`item${i}`] = box.checked; save(); if (box.checked) { snd.yes(); checkAll(); } });
    boxes.push(box);
    const tools = el('div', { class: 'itools' });
    if (it.p !== undefined) {
      const plays = el('span', { class: 'plays' });
      const showPlays = () => { plays.textContent = state.plays[i] ? `🔁 ${state.plays[i]}` : ''; };
      showPlays();
      const open = (mode) => {
        const use = { secs: 0, plays: 0 };
        openOverlay(async (done) => openPlayer(document.body, {
          xml: page.p[it.p], title: it.a, setup: it.u, mode,
          onClose: () => { done(); if (onPiece) onPiece(it, { mode, secs: Math.round(use.secs), plays: use.plays }); },
          onPlaying: (secs) => { use.secs += secs; addTime(secs); },
          onFinish: () => { use.plays++; state.plays[i] = (state.plays[i] || 0) + 1; save(); showPlays(); showDone(); },
        }));
      };
      const v = it.u?.v ?? 3;
      for (const [bit, mode, icon, label] of PIECE_MODES) {
        if (v & bit) tools.append(el('button', { class: 'go piece', 'aria-label': label, title: label, onclick: () => open(mode) }, `${icon} ▶`));
      }
      tools.append(plays);
    }
    if (it.c) {
      // Results per card, over every session: { [card]: [tries, right] }.
      const mine = (state.cards[i] ||= { history: {}, done: 0 });
      const badge = el('span', { class: 'plays' });
      const showStars = () => { badge.textContent = mine.done ? `⭐ ${mine.done}` : ''; };
      showStars();
      tools.append(el('button', { class: 'go cards', 'aria-label': 'Flash cards', onclick: () => openOverlay(async (done) =>
        openPractice(document.body, it.c, { title: it.c.nm || it.a, history: mine.history, onClose: done, onEnd: (r) => {
          for (const [card, [tries, right]] of Object.entries(r.items)) {
            const h = (mine.history[card] ||= [0, 0]);
            h[0] += tries;
            h[1] += right;
          }
          mine.done += r.ok;
          mine.n = (mine.n || 0) + r.n;
          save();
          showStars();
          addTime(r.ms / 1000);
          if (onCards) onCards(it, r);
        } })) }, it.c.nm ? `🃏 ${it.c.nm}` : '🃏'), badge);
    }
    return el('li', { class: shelf ? 'shelf' : null },
      shelf ? null : box,
      el('strong', { textContent: it.a }),
      it.b ? el('p', { textContent: it.b }) : null,
      it.l ? el('a', { href: it.l, textContent: new URL(it.l).hostname.replace(/^www\./, ''), target: '_blank', rel: 'noopener noreferrer' }) : null,
      tools.childNodes.length ? tools : null);
  }));

  /* Earlier lessons, when the page came with the student's code */
  const earlier = (lessons?.length > 1 || openShelf) && el('nav', { class: 'earlier' },
    openShelf ? el('button', { class: 'tolib', 'aria-current': shelf ? 'true' : null, 'aria-label': 'Library', onclick: openShelf }, '📚') : null,
    lessons.map((l, i) =>
      el('button', { 'aria-current': i === index ? 'true' : null, onclick: () => open(i) }, formatDate(l.d).replace(/^\w+, /, '') || '·')));

  /* Printing: a QR code back to this page when the link is short enough */
  const qr = el('div', { class: 'qr' });
  if (qrText.length <= 2300) {
    loadScript(QR_SRC).then(() => {
      const q = window.qrcode(0, 'L');
      q.addData(qrText);
      q.make();
      const n = q.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      qr.innerHTML = `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" aria-hidden="true"><path d="${d}"/></svg>`;
    }).catch(() => {});
  }

  main.replaceChildren(...[
    header, shelf ? earlier : null, reward, practice, list,
    page.m ? el('p', { class: 'note', textContent: page.m }) : null,
    shelf ? null : earlier,
    el('div', { class: 'foot' },
      el('button', { class: 'print', 'aria-label': 'Print', onclick: () => print() }, '🖨'),
      forget && el('button', { class: 'print', 'aria-label': 'Sign out on this device', onclick: forget }, '🚪'),
      qr),
  ].filter(Boolean));
}

window.addEventListener('hashchange', () => { if (!overlay) show(); });
show();
