/* A private lesson student's page. Everything on it comes from the link
   (see codec.js). Checkmarks, practice minutes and best scores are kept
   only in this browser. */

import { decodeLesson, formatDate } from './codec.js';
import { LOGO, QR_SRC } from './paths.js';
import { loadScript } from './score.js';
import { confetti } from './fun.js';
import { openPlayer } from './player.js';
import { openDeck } from './games.js';
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

/* ---------- A metronome for an item's tempo ---------- */

const metro = { on: null, bpm: 0, next: 0, beat: 0, timer: null };
function metroStart(owner, bpm) {
  metroStop();
  metro.on = owner;
  metro.bpm = bpm;
  metro.next = snd.now() + 0.08;
  metro.beat = 0;
  metro.timer = setInterval(() => {
    while (metro.next < snd.now() + 0.2) {
      snd.click(metro.next, metro.beat % 4 === 0);
      const at = metro.next;
      setTimeout(() => owner.classList.toggle('tick', metro.beat % 2 === 0), Math.max(0, (at - snd.now()) * 1000));
      metro.next += 60 / metro.bpm;
      metro.beat++;
    }
  }, 30);
  owner.classList.add('on');
}
function metroStop() {
  clearInterval(metro.timer);
  if (metro.on) metro.on.classList.remove('on', 'tick');
  metro.on = null;
}

/* ---------- Overlays (piece player, flash cards) close with Back ---------- */

let overlay = null;
let ownBacks = 0;  // history.back() calls of ours whose popstate hasn't come yet
function openOverlay(make) {
  metroStop();
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

/* ---------- The page ---------- */

async function show() {
  const header = el('header', {}, el('img', { src: LOGO, alt: 'Mr. Washburn Music' }));
  const hash = location.hash.slice(1);
  let page = null;
  if (hash) { try { page = await decodeLesson(hash); } catch { page = null; } }
  if (!page) { main.replaceChildren(header); return; }

  document.title = `${page.n || 'Lesson'} · Mr. Washburn Music`;
  const key = await keyFor(hash);
  const state = load(key);
  state.mins = state.mins || {};
  state.best = state.best || {};
  state.plays = state.plays || {};
  state.party = state.party || {};
  const save = () => { try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* private window: nothing stays */ } };

  header.append(el('div', {},
    el('h1', { textContent: page.n }),
    el('p', { textContent: [page.i, formatDate(page.d)].filter(Boolean).join(' · ') })));

  /* Reward from Mr. W */
  const reward = (page.s || page.k) && el('div', { class: 'reward' },
    page.k && el('span', { class: 'sticker', textContent: page.k }),
    page.s ? el('span', { class: 'rstars', 'aria-label': `${page.s} stars` }, '★'.repeat(page.s)) : null);

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
    if (state.run) { stopRun(); clearInterval(tick); } else { state.run = Date.now(); tick = setInterval(drawTimer, 500); }
    save();
    drawTimer();
    refreshDays();
  });
  if (state.run) {
    if (Date.now() - state.run > 7200e3) { stopRun(); save(); } else tick = setInterval(drawTimer, 500);
  }
  setInterval(() => { if (state.run) { stopRun(); state.run = Date.now(); save(); refreshDays(); } }, 30000);
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
      tools.append(el('button', { class: 'go piece', 'aria-label': 'Play the music', onclick: () => openOverlay(async (done) =>
        openPlayer(document.body, {
          xml: page.p[it.p], title: it.a, setup: it.u,
          onClose: done,
          onFinish: () => { state.plays[i] = (state.plays[i] || 0) + 1; save(); showPlays(); snd.fanfare(); confetti(80); },
        })) }, '♫ ▶'), plays);
    }
    if (it.c) {
      const badge = el('span', { class: 'plays' });
      const showBest = () => {
        const b = state.best[i] || {};
        const top = Object.values(b).reduce((m, x) => Math.max(m, x.score / x.of), 0);
        badge.textContent = top ? `🏅 ${Math.round(top * 100)}%` : '';
      };
      showBest();
      tools.append(el('button', { class: 'go cards', 'aria-label': 'Flash cards', onclick: () => openOverlay(async (done) =>
        openDeck(document.body, it.c, { title: it.a, best: state.best[i] || {}, onClose: done, onResult: (best) => { state.best[i] = best; save(); showBest(); } })) }, '🃏'), badge);
    }
    if (it.q) {
      let bpm = it.q;
      const label = el('span', {}, `♩ ${bpm}`);
      const chip = el('div', { class: 'metro' });
      const set = (d) => { bpm = Math.max(30, Math.min(260, bpm + d)); label.textContent = `♩ ${bpm}`; metro.bpm = bpm; };
      chip.append(
        el('button', { class: 'm-', 'aria-label': 'Slower', onclick: () => set(-4) }, '−'),
        el('button', { class: 'mgo', 'aria-label': 'Metronome', onclick: () => (metro.on === chip ? metroStop() : metroStart(chip, bpm)) }, label),
        el('button', { class: 'm+', 'aria-label': 'Faster', onclick: () => set(4) }, '+'));
      tools.append(chip);
    }
    return el('li', {},
      box,
      el('strong', { textContent: it.a }),
      it.b ? el('p', { textContent: it.b }) : null,
      it.l ? el('a', { href: it.l, textContent: new URL(it.l).hostname.replace(/^www\./, ''), target: '_blank', rel: 'noopener noreferrer' }) : null,
      tools.childNodes.length ? tools : null);
  }));

  /* Pieces and goals */
  const STATUS = [['🌱', 'Learning'], ['✨', 'Polishing'], ['🏆', 'Done']];
  const goals = page.g.length && el('ul', { class: 'goals' }, page.g.map(([text, s]) =>
    el('li', { class: `g${s}` }, el('span', { class: 'gs', title: STATUS[s][1], 'aria-label': STATUS[s][1] }, STATUS[s][0]), el('span', {}, text))));

  /* Printing: a QR code back to this page when the link is short enough */
  const qr = el('div', { class: 'qr' });
  if (location.href.length <= 2300) {
    loadScript(QR_SRC).then(() => {
      const q = window.qrcode(0, 'L');
      q.addData(location.href);
      q.make();
      const n = q.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      qr.innerHTML = `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" aria-hidden="true"><path d="${d}"/></svg>`;
    }).catch(() => {});
  }

  main.replaceChildren(...[
    header, reward, practice, list, goals,
    page.m ? el('p', { class: 'note', textContent: page.m }) : null,
    el('div', { class: 'foot' }, el('button', { class: 'print', 'aria-label': 'Print', onclick: () => print() }, '🖨'), qr),
  ].filter(Boolean));
}

window.addEventListener('hashchange', () => { if (!overlay) show(); });
show();
