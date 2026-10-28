/* Flash card games for a deck (see cards.js).
   Notes: Flip (tap the card to see and hear it) or Quiz (tap the name, against the clock).
   Rhythm: Flip (tap to hear it with its syllables) or Tap (tap the rhythm after a count-in). */

import * as C from './cards.js';
import * as snd from './sound.js';
import { confetti, starRow } from './fun.js';

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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const starsFor = (pct) => (pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct >= 0.4 ? 1 : 0);

export function openDeck(host, deck, { title = '', best = {}, onResult, onClose } = {}) {
  const isNotes = deck.k === 'n';
  const body = el('div', { class: 'gbody' });
  const status = el('div', { class: 'gstatus' });
  const root = el('div', { class: 'game' },
    el('div', { class: 'ptop' },
      el('button', { class: 'close', 'aria-label': 'Close', onclick: () => close() }, '✕'),
      el('h2', { textContent: title }),
      status),
    body);
  host.append(root);
  document.body.classList.add('playing-piece');
  let token = 0;
  let tempo = deck.q || 80;

  function close() {
    token++;
    root.remove();
    document.body.classList.remove('playing-piece');
    if (onClose) onClose();
  }

  function bestLine(mode) {
    const b = best[mode];
    if (!b) return null;
    return el('small', { class: 'best' }, '🏅 ', `${b.score}/${b.of}`, b.ms ? ` · ${clock(b.ms)}` : '');
  }

  function start() {
    token++;
    status.replaceChildren();
    const modes = isNotes ? [['flip', '🃏', 'Flip'], ['quiz', '⚡', 'Quiz']] : [['flip', '🃏', 'Flip'], ['tap', '👏', 'Tap']];
    body.replaceChildren(el('div', { class: 'gstart' },
      modes.map(([id, icon, label]) => el('button', { class: 'gmode', onclick: () => (id === 'flip' ? flip() : id === 'quiz' ? quiz() : tap()) },
        el('span', { class: 'gicon' }, icon), el('span', {}, label), bestLine(id))),
      !isNotes && el('div', { class: 'gtempo' },
        el('button', { onclick: () => { tempo = Math.max(40, tempo - 5); out.textContent = `♩ ${tempo}`; } }, '−'),
        el('output', { textContent: `♩ ${tempo}` }),
        el('button', { onclick: () => { tempo = Math.min(200, tempo + 5); out.textContent = `♩ ${tempo}`; } }, '+')),
    ));
    const out = body.querySelector('.gtempo output');
  }

  /* A round of cards: each is a pitch (notes) or a pattern (rhythm). */
  function deal(n) {
    if (isNotes) {
      const out = [];
      while (out.length < n) out.push(...C.shuffle(deck.r));
      for (let i = 1; i < out.length; i++) if (out[i] === out[i - 1] && deck.r.length > 1) [out[i], out[(i + 1) % out.length]] = [out[(i + 1) % out.length], out[i]];
      return out.slice(0, n);
    }
    const seen = new Set();
    const out = [];
    for (let tries = 0; out.length < n && tries < n * 20; tries++) {
      const p = C.rhythmPattern(deck);
      const key = JSON.stringify(p);
      if (!p.length || (seen.has(key) && tries < n * 10)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  }

  async function cardFace(card, holder) {
    const svgBox = el('div', { class: 'gstaff' });
    holder.replaceChildren(svgBox);
    const draw = await C.cardDrawer(svgBox);
    const twoBars = !isNotes && deck.n > 1;
    await draw(isNotes ? C.noteXML(deck, card) : C.rhythmXML(deck, card), isNotes ? 1.5 : twoBars ? 0.9 : 1.2);
  }

  /* ---------- Flip ---------- */

  async function flip() {
    const my = ++token;
    const queue = deal(isNotes ? Math.max(10, deck.r.length) : 8);
    const total = queue.length;
    const firstTry = new Set();
    const missed = new Set();
    let done = 0;
    while (queue.length) {
      if (my !== token) return;
      const card = queue.shift();
      status.textContent = `${done}/${total}`;
      const face = el('div', { class: 'gface' });
      const back = el('div', { class: 'gback' });
      const cardEl = el('button', { class: 'gcard', 'aria-label': 'Flip' }, face, back);
      const btns = el('div', { class: 'gbtns', hidden: true });
      body.replaceChildren(cardEl, btns);
      await cardFace(card, face);
      const answer = await new Promise((resolve) => {
        let flipped = false;
        cardEl.addEventListener('click', () => {
          if (isNotes) C.playNote(card);
          else hear(card, back);
          if (flipped) return;
          flipped = true;
          cardEl.classList.add('flipped');
          if (isNotes) back.replaceChildren(el('span', { class: 'gname' }, C.noteAnswer(deck, card)));
          btns.hidden = false;
          btns.replaceChildren(
            el('button', { class: 'again', onclick: () => resolve(false) }, '😅'),
            el('button', { class: 'got', onclick: () => resolve(true) }, '😃'));
        });
      });
      const key = JSON.stringify(card);
      if (answer) {
        done++;
        if (!missed.has(key)) firstTry.add(key);
        snd.yes();
      } else {
        missed.add(key);
        queue.splice(Math.min(queue.length, 2 + Math.floor(Math.random() * 3)), 0, card);
      }
    }
    finish('flip', firstTry.size, total, 0);
  }

  function hear(card, back) {
    const { events } = C.rhythmEvents(deck, card);
    const syl = events.map((e) => el('span', {}, e.s));
    back.replaceChildren(el('div', { class: 'gsyl' }, syl));
    C.playRhythm(deck, card, { tempo, onSyllable: (i) => { syl.forEach((s, j) => s.classList.toggle('now', j === i)); } });
  }

  /* ---------- Quiz (notes) ---------- */

  async function quiz() {
    const my = ++token;
    const cards = deal(10);
    const names = [...new Set(deck.r.map((p) => C.noteAnswer(deck, p)))];
    const order = deck.a === 1 ? ['do', 'di', 'ra', 're', 'ri', 'me', 'mi', 'fa', 'fi', 'se', 'so', 'si', 'le', 'la', 'li', 'te', 'ti'] : null;
    const sortKey = (n) => (order ? order.indexOf(n) : 'CDEFGAB'.indexOf(n[0]) * 3 + (n.includes('♭') ? 0 : n.includes('♯') ? 2 : 1));
    // At least three buttons, so it is never a free answer.
    const extra = deck.a === 1 ? ['do', 're', 'mi', 'fa', 'so', 'la', 'ti'] : ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    for (const x of extra) if (names.length < 3 && !names.includes(x)) names.push(x);
    names.sort((a, b) => sortKey(a) - sortKey(b));
    let right = 0;
    let streak = 0;
    const t0 = performance.now();
    const tick = setInterval(() => { if (my !== token) clearInterval(tick); else timeEl.textContent = clock(performance.now() - t0); }, 250);
    const timeEl = el('span', { class: 'gtime' });
    const streakEl = el('span', { class: 'gstreak' });
    for (let i = 0; i < cards.length; i++) {
      if (my !== token) return;
      const card = cards[i];
      const want = C.noteAnswer(deck, card);
      status.replaceChildren(streakEl, timeEl, el('span', {}, `${i + 1}/${cards.length}`));
      const face = el('div', { class: 'gface' });
      const cardEl = el('div', { class: 'gcard' }, face);
      const btns = el('div', { class: 'ganswers' });
      body.replaceChildren(cardEl, btns);
      await cardFace(card, face);
      const ok = await new Promise((resolve) => {
        let tried = false;
        btns.replaceChildren(...names.map((n) => el('button', { onclick: (ev) => {
          if (tried) return;
          tried = true;
          const b = ev.currentTarget;
          if (n === want) { b.classList.add('right'); snd.yes(); resolve(true); return; }
          b.classList.add('wrong');
          cardEl.classList.add('shake');
          [...btns.children].find((x) => x.textContent === want)?.classList.add('right');
          C.playNote(card);
          resolve(false);
        } }, n)));
      });
      if (ok) { right++; streak++; } else streak = 0;
      streakEl.textContent = streak >= 3 ? `🔥${streak}` : '';
      if (ok && streak > 0 && streak % 5 === 0) confetti(60);
      await wait(ok ? 450 : 1300);
    }
    clearInterval(tick);
    finish('quiz', right, cards.length, performance.now() - t0);
  }

  /* ---------- Tap (rhythm) ---------- */

  async function tap() {
    const my = ++token;
    const cards = deal(6);
    let score = 0;
    let of = 0;
    for (let i = 0; i < cards.length; i++) {
      if (my !== token) return;
      const card = cards[i];
      status.textContent = `${i + 1}/${cards.length}`;
      const face = el('div', { class: 'gface' });
      const back = el('div', { class: 'gback' });
      const cardEl = el('div', { class: 'gcard flipped-open' }, face, back);
      const pad = el('button', { class: 'gpad', disabled: true }, '👏');
      const go = el('button', { class: 'ggo' }, '▶');
      const ear = el('button', { class: 'gear', 'aria-label': 'Hear it', onclick: () => hear(card, back) }, '👂');
      const dots = el('div', { class: 'gdots' });
      body.replaceChildren(cardEl, dots, el('div', { class: 'gbtns' }, ear, go), pad);
      await cardFace(card, face);
      await new Promise((resolve) => { go.onclick = resolve; });
      go.disabled = true;
      ear.disabled = true;
      // Only the beat plays while they tap.
      const run = C.playRhythm(deck, card, { tempo, countIn: true, sound: false, beat: true });
      const latency = (snd.ac().outputLatency || 0) + (snd.ac().baseLatency || 0);
      const taps = [];
      const onTap = (ev) => {
        if (ev.type === 'keydown' && ev.key !== ' ' && ev.key !== 'Enter') return;
        ev.preventDefault();
        taps.push(snd.now());
        pad.classList.remove('hit');
        void pad.offsetWidth;
        pad.classList.add('hit');
      };
      pad.disabled = false;
      pad.addEventListener('pointerdown', onTap);
      document.addEventListener('keydown', onTap);
      await wait((run.end - snd.now() + run.beatSec * 0.6) * 1000);
      pad.removeEventListener('pointerdown', onTap);
      document.removeEventListener('keydown', onTap);
      pad.disabled = true;
      if (my !== token) return;
      const tol = Math.min(0.16, run.beatSec * 0.3);
      // Taps during the count-in don't count against them.
      taps.splice(0, taps.length, ...taps.filter((t) => t >= run.start + latency - tol));
      const used = new Set();
      const marks = run.events.map((e) => {
        const want = run.start + e.beat * run.beatSec + latency;
        let bestJ = -1;
        let bestD = Infinity;
        taps.forEach((t, j) => { const d = Math.abs(t - want); if (!used.has(j) && d < bestD) { bestD = d; bestJ = j; } });
        if (bestJ >= 0 && bestD <= tol) { used.add(bestJ); return true; }
        return false;
      });
      const extra = Math.max(0, taps.length - used.size);
      const got = Math.max(0, marks.filter(Boolean).length - extra);
      score += got;
      of += marks.length;
      dots.replaceChildren(...marks.map((m) => el('span', { class: m ? 'ok' : 'miss' }, m ? '●' : '○')));
      if (got === marks.length) { snd.yes(); confetti(50); } else snd.no();
      hear(card, back);
      await wait(run.events.length * run.beatSec * 1000 / 1.5 + 1400);
    }
    finish('tap', score, of, 0);
  }

  /* ---------- End of a round ---------- */

  function finish(mode, score, of, ms) {
    const pct = of ? score / of : 0;
    const stars = starsFor(pct);
    const b = best[mode];
    const isBest = of > 0 && (!b || pct > b.score / b.of || (pct === b.score / b.of && ms > 0 && (!b.ms || ms < b.ms)));
    if (isBest) best[mode] = { score, of, ms: Math.round(ms) || undefined };
    if (onResult) onResult(best, { mode, score, of, ms, stars });
    status.replaceChildren();
    body.replaceChildren(el('div', { class: 'gend' },
      starRow(stars),
      el('p', { class: 'gscore' }, `${score}/${of}`, ms ? ` · ${clock(ms)}` : ''),
      isBest && b ? el('p', { class: 'newbest' }, '🏅') : null,
      el('div', { class: 'gbtns' },
        el('button', { onclick: () => (mode === 'flip' ? flip() : mode === 'quiz' ? quiz() : tap()) }, '🔁'),
        el('button', { onclick: start }, '↩'))));
    if (stars >= 2) { snd.fanfare(); confetti(); }
  }

  start();
  return { close };
}
