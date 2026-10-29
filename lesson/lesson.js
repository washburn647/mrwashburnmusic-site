/* A private lesson student's page. It opens two ways:
   - with their code (/lesson/#tiger-moon-...): their locked pages from the site, this
     week's lesson first, earlier ones below (see locked.js). The code is remembered on
     this device; flash card results go back to Kyle, encrypted.
   - with a lesson link: the whole page is inside the link (see codec.js).
   Checkmarks and practice minutes are kept only in this browser. */

import { decodeLesson, cleanPage, formatDate } from './codec.js';
import { cleanCode, openPages, sendResult } from './locked.js';
import { LOGO, QR_SRC, LESSON_PAGE } from './paths.js';
import { loadScript } from './score.js';
import { confetti } from './fun.js';
import { openPlayer } from './player.js';
import { openPractice } from './practice.js';
import * as snd from './sound.js';

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

/* Seven practice days, starting the day after the lesson. */
function practiceDays(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const start = m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date();
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1 + i));
}

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec) % 60).padStart(2, '0')}`;

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
  const code = cleanCode(hash) || (!hash && savedCode());
  if (code) { showLocked(code, !!hash); return; }
  let page = null;
  if (hash) { try { page = await decodeLesson(hash); } catch { page = null; } }
  if (!page) { showEntry(); return; }
  render(page, { key: await keyFor(hash), qr: location.href });
}

/* Where a student types their code. */
function showEntry(problem = '') {
  stop();
  document.title = 'Lesson · Mr. Washburn Music';
  const box = el('input', { class: 'code', autocomplete: 'off', autocapitalize: 'none', spellcheck: false, 'aria-label': 'Code' });
  const form = el('form', { class: 'codeform' + (problem ? ' shake' : ''), onsubmit: (e) => {
    e.preventDefault();
    const code = cleanCode(box.value);
    if (!code) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); return; }
    showLocked(code, false);
  } }, el('span', { class: 'lock' }, '🔑'), box, el('button', { class: 'go', 'aria-label': 'Open' }, '▶'));
  main.replaceChildren(logo(), form, ...(problem ? [el('p', { class: 'codeerr' }, problem)] : []));
  box.focus();
}

async function showLocked(code, fromLink) {
  stop();
  main.replaceChildren(logo(), el('p', { class: 'loading' }, '🎵'));
  let pages;
  try {
    pages = await openPages(code);
  } catch {
    main.replaceChildren(logo(), el('p', { class: 'codeerr' }, '📡'), el('button', { class: 'go', 'aria-label': 'Try again', onclick: () => showLocked(code, fromLink) }, '🔁'));
    return;
  }
  if (!pages || !pages.l?.length) { showEntry(fromLink || savedCode() !== code ? '✗' : ''); return; }
  try { localStorage.setItem(CODE, code); } catch { /* private window */ }
  // The code stays on this device, not in the address bar.
  if (fromLink) history.replaceState(null, '', location.pathname);
  sendPending(code);
  const lessons = pages.l.map((l) => cleanPage({ ...l, v: 2, n: pages.n, i: pages.i, p: pages.p }));
  const open = async (index) => {
    render(lessons[index], {
      key: await keyFor(`${code}/${lessons[index].d}`),
      qr: `${LESSON_PAGE}#${code}`,
      lessons, index, open,
      onCards: (it, r) => queueResult(code, { d: lessons[index].d, a: it.a, ...r }),
      forget: () => { try { localStorage.removeItem(CODE); } catch { /* nothing kept */ } showEntry(); },
    });
    scrollTo(0, 0);
  };
  open(0);
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

function render(page, { key, qr: qrText, lessons, index = 0, open, onCards, forget }) {
  stop();
  const header = logo();
  document.title = `${page.n || 'Lesson'} · Mr. Washburn Music`;
  const state = load(key);
  state.mins = state.mins || {};
  state.cards = state.cards || {};
  state.plays = state.plays || {};
  state.party = state.party || {};
  const save = () => { try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* private window: nothing stays */ } };

  header.append(el('div', {},
    el('h1', { textContent: page.n }),
    el('p', { textContent: [page.i, formatDate(page.d)].filter(Boolean).join(' · ') })));

  /* Stars from Mr. W */
  const reward = page.s ? el('div', { class: 'reward' }, el('span', { class: 'rstars', 'aria-label': `${page.s} stars` }, '★'.repeat(page.s))) : null;

  /* Practice timer and days */
  const days = practiceDays(page.d);
  const today = iso(new Date());
  const goal = page.w * 60;
  const dayDone = (d) => !!state[`day${d}`] || (state.mins[iso(days[d])] || 0) >= (goal || 60);

  const dayEls = days.map((d, i) => {
    const name = d.toLocaleDateString(undefined, { weekday: 'long' });
    const box = el('input', { type: 'checkbox', checked: dayDone(i) });
    box.setAttribute('aria-label', name);
    box.addEventListener('change', () => { state[`day${i}`] = box.checked; save(); if (box.checked) snd.yes(); });
    const mins = el('small', {});
    const lab = el('label', { title: name, class: iso(d) === today ? 'today' : '' }, box, el('span', {}, name.slice(0, 2)), mins);
    return { lab, box, mins, date: iso(d), i };
  });
  const refreshDays = () => dayEls.forEach((d) => {
    const s = state.mins[d.date] || 0;
    d.mins.textContent = s >= 60 ? `${Math.floor(s / 60)}′` : '';
    d.box.checked = dayDone(d.i);
  });

  const R = 34;
  const ring = el('div', { class: 'ring' });
  ring.innerHTML = `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${R}" class="track"/><circle cx="40" cy="40" r="${R}" class="fill"/></svg>`;
  const fill = ring.querySelector('.fill');
  const C = 2 * Math.PI * R;
  fill.style.strokeDasharray = `${C}`;
  const timeEl = el('span', { class: 'ttime' });
  const timerBtn = el('button', { class: 'timer', 'aria-label': 'Practice timer' }, ring, el('span', { class: 'ticon' }, '▶'), timeEl);
  let tick = null;
  const todaySecs = () => (state.mins[today] || 0) + (state.run ? Math.max(0, (Date.now() - state.run) / 1000) : 0);
  function drawTimer() {
    const s = todaySecs();
    timeEl.textContent = clock(s);
    timerBtn.querySelector('.ticon').textContent = state.run ? '⏸' : '▶';
    timerBtn.classList.toggle('running', !!state.run);
    const frac = goal ? Math.min(1, s / goal) : (s % 60) / 60;
    fill.style.strokeDashoffset = `${C * (1 - frac)}`;
    if (goal && s >= goal && !state.party[`goal${today}`]) {
      state.party[`goal${today}`] = 1;
      save();
      refreshDays();
      snd.fanfare();
      confetti();
    }
  }
  function stopRun() {
    if (!state.run) return;
    // A timer left running for hours counts as 2 hours at most.
    state.mins[today] = Math.min(4 * 3600, (state.mins[today] || 0) + Math.min(7200, (Date.now() - state.run) / 1000));
    state.run = null;
  }
  timerBtn.addEventListener('click', () => {
    if (state.run) { stopRun(); clearInterval(tick); } else { state.run = Date.now(); tick = setInterval(drawTimer, 500); timers.push(tick); }
    save();
    drawTimer();
    refreshDays();
  });
  if (state.run) {
    if (Date.now() - state.run > 7200e3) { stopRun(); save(); } else { tick = setInterval(drawTimer, 500); timers.push(tick); }
  }
  timers.push(setInterval(() => { if (state.run) { stopRun(); state.run = Date.now(); save(); refreshDays(); } }, 30000));
  refreshDays();
  drawTimer();

  const practice = el('section', { class: 'practice' },
    timerBtn,
    goal ? el('span', { class: 'goal' }, `🎯 ${page.w}′`) : null,
    el('div', { class: 'days' }, dayEls.map((d) => d.lab)));

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
      const open = (mode) => openOverlay(async (done) => openPlayer(document.body, {
        xml: page.p[it.p], title: it.a, setup: it.u, mode,
        onClose: done,
        onFinish: () => { state.plays[i] = (state.plays[i] || 0) + 1; save(); showPlays(); },
      }));
      const v = it.u?.v ?? 3;
      if (v & 1) tools.append(el('button', { class: 'go piece', 'aria-label': 'Listen', onclick: () => open('listen') }, '🎹 ▶'));
      if (v & 2) tools.append(el('button', { class: 'go piece', 'aria-label': 'Sheet music', onclick: () => open('sheet') }, '🎼 ▶'));
      tools.append(plays);
    }
    if (it.c) {
      // Results per card, over every session: { [card]: [tries, right] }.
      const mine = (state.cards[i] ||= { history: {}, done: 0 });
      const badge = el('span', { class: 'plays' });
      const showDone = () => { badge.textContent = mine.done ? `⭐ ${mine.done}` : ''; };
      showDone();
      tools.append(el('button', { class: 'go cards', 'aria-label': 'Flash cards', onclick: () => openOverlay(async (done) =>
        openPractice(document.body, it.c, { title: it.a, history: mine.history, onClose: done, onEnd: (r) => {
          for (const [card, [tries, right]] of Object.entries(r.items)) {
            const h = (mine.history[card] ||= [0, 0]);
            h[0] += tries;
            h[1] += right;
          }
          mine.done += r.ok;
          save();
          showDone();
          if (onCards) onCards(it, r);
        } })) }, '🃏'), badge);
    }
    return el('li', {},
      box,
      el('strong', { textContent: it.a }),
      it.b ? el('p', { textContent: it.b }) : null,
      it.l ? el('a', { href: it.l, textContent: new URL(it.l).hostname.replace(/^www\./, ''), target: '_blank', rel: 'noopener noreferrer' }) : null,
      tools.childNodes.length ? tools : null);
  }));

  /* Earlier lessons, when the page came with the student's code */
  const earlier = lessons?.length > 1 && el('nav', { class: 'earlier' }, lessons.map((l, i) =>
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
    header, reward, practice, list,
    page.m ? el('p', { class: 'note', textContent: page.m }) : null,
    earlier,
    el('div', { class: 'foot' },
      el('button', { class: 'print', 'aria-label': 'Print', onclick: () => print() }, '🖨'),
      forget && el('button', { class: 'print', 'aria-label': 'Sign out on this device', onclick: forget }, '🚪'),
      qr),
  ].filter(Boolean));
}

window.addEventListener('hashchange', () => { if (!overlay) show(); });
show();
