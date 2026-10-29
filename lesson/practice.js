/* Flash card practice: one mode, cards keep coming until the student stops.
   Kyle sets the deck's ways of answering and a goal; past the goal they may keep going.
   Cards they miss come back sooner. At the end: how it went, and what to practise.
   history: { [card]: [tries, right] } from earlier sessions, to weight the cards.
   onEnd(session) gets { k, mode, n, ok, ms, at, items: { [card]: [tries, right, ms] } }. */

import * as C from './cards.js';
import * as snd from './sound.js';
import { keyboard } from './keyboard.js';
import { confetti } from './fun.js';

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
const bump = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

export function openPractice(host, deck, { title = '', history = {}, onEnd, onClose } = {}) {
  const cards = C.cardsOf(deck);
  const modes = C.modesOf(deck);
  const goal = deck.g || 0;
  const body = el('div', { class: 'gbody' });
  const count = el('span', { class: 'gcount' });
  const meter = el('span', { class: 'gmeter' }, el('i'));
  const streakEl = el('span', { class: 'gstreak' });
  const doneBtn = el('button', { class: 'gdone', hidden: true, onclick: () => finish() }, '✓');
  const root = el('div', { class: 'game' },
    el('div', { class: 'ptop' },
      el('button', { class: 'close', 'aria-label': 'Close', onclick: () => (s && s.n ? finish() : close()) }, '✕'),
      el('h2', { textContent: title }),
      el('div', { class: 'gstatus' }, streakEl, meter, count, doneBtn)),
    body);
  host.append(root);
  document.body.classList.add('playing-piece');
  C.prepare(deck).catch(() => {});

  let token = 0;   // bumps when a session ends, so its pending steps stop
  let s = null;    // the session under way

  function close() {
    if (s?.n && !s.ended) report();
    token++;
    root.remove();
    document.body.classList.remove('playing-piece');
    if (onClose) onClose();
  }

  /* ---------- Start ---------- */

  function start() {
    token++;
    s = null;
    count.textContent = '';
    streakEl.textContent = '';
    meter.hidden = true;
    doneBtn.hidden = true;
    const keyTag = deck.k !== 'r' && tag();
    body.replaceChildren(el('div', { class: 'gstart' },
      keyTag,
      el('div', { class: 'gmodes' }, modes.map(([, id, icon, label]) =>
        el('button', { class: 'gmode', onclick: () => begin(id) }, el('span', { class: 'gicon' }, icon), el('span', {}, label)))),
      goal ? el('span', { class: 'ggoal' }, `🎯 ${goal}`) : null));
  }

  /* "do = G" beside notes and tonal cards, so they know where do is. */
  function tag() {
    if (deck.k === 'n') return el('span', { class: 'gtag' }, `do = ${C.doName(deck.y)}`);
    return el('span', { class: 'gtag' }, `do = ${C.keyLabel(deck).do}`);
  }

  async function begin(mode) {
    const my = ++token;
    s = { mode, n: 0, ok: 0, ms: 0, streak: 0, best: 0, items: {}, last: null, again: [], t0: Date.now(), ended: false };
    meter.hidden = !goal;
    show();
    if (deck.k === 't') {
      body.replaceChildren(el('div', { class: 'gready' }, '🎵'));
      await wait(await C.playTonic(deck));
    }
    while (my === token) await card(my);
  }

  function show() {
    count.textContent = goal ? `${s.n} / ${goal}` : String(s.n);
    meter.firstChild.style.width = `${Math.min(1, goal ? s.n / goal : 0) * 100}%`;
    streakEl.textContent = s.streak >= 2 ? `🔥 ${s.streak}` : '';
    doneBtn.hidden = !s.n;
  }

  /* ---------- Which card next ---------- */

  function pick() {
    const due = s.again.findIndex((a) => a.at <= s.n && a.card !== s.last);
    if (due >= 0) return s.again.splice(due, 1)[0].card;
    const pool = cards.length > 1 ? cards.filter((c) => c !== s.last) : cards;
    const weight = (c) => {
      const [tries, right] = [(history[c]?.[0] || 0) + (s.items[c]?.[0] || 0), (history[c]?.[1] || 0) + (s.items[c]?.[1] || 0)];
      return 1 + 4 * (tries - right + 0.3) / (tries + 1) + (s.items[c] ? 0 : 0.5);
    };
    const ws = pool.map(weight);
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  /* ---------- One card ---------- */

  async function card(my) {
    const id = pick();
    s.last = id;
    const face = el('div', { class: 'gstaff' });
    face.innerHTML = await C.cardSVG(deck, id);
    if (my !== token) return;
    const cardEl = el('div', { class: 'gcard in' }, face, deck.k === 't' || s.mode === 'solfa' ? tag() : null);
    const under = el('div', { class: 'gunder' });
    const answer = el('div', { class: 'ganswer' });
    body.replaceChildren(cardEl, under, answer);

    if (deck.w && C.PLAYED.has(s.mode)) {
      await new Promise((go) => answer.replaceChildren(el('button', { class: 'gsay', onclick: go },
        el('span', {}, deck.k === 't' ? '🎤' : '🗣'), el('span', { class: 'gnext' }, '▶'))));
      if (my !== token) return;
    }
    const t0 = performance.now();
    const ok = await MODE[s.mode]({ id, cardEl, under, answer, my });
    if (my !== token || ok == null) return;
    score(id, ok, performance.now() - t0, cardEl);
    await wait(ok ? 650 : 1500);
    if (my !== token) return;
    cardEl.classList.add(ok ? 'out' : 'outx');
    await wait(220);
  }

  function score(id, ok, ms, cardEl) {
    s.n++;
    s.ms += ms;
    const it = (s.items[id] ||= [0, 0, 0]);
    it[0]++;
    it[2] += Math.round(ms);
    if (ok) {
      s.ok++;
      it[1]++;
      s.streak++;
      s.best = Math.max(s.best, s.streak);
      snd.yes();
      bump(cardEl, 'yay');
      if (s.streak % 10 === 0) confetti(40);
    } else {
      s.streak = 0;
      snd.no();
      bump(cardEl, 'shake');
      // Back again in a few cards.
      s.again.push({ card: id, at: s.n + 2 + Math.floor(Math.random() * 2) });
    }
    show();
    if (goal && s.n === goal) {
      confetti(140);
      snd.fanfare();
      bump(doneBtn, 'glow');
    }
  }

  /* ---------- Ways of answering. Each resolves true (right) or false. ---------- */

  const buttons = (labels, answer, onPick) => {
    const row = el('div', { class: 'ganswers' }, labels.map((l) => el('button', { onclick: (e) => onPick(l, e.currentTarget, row) }, l)));
    answer.replaceChildren(row);
    return row;
  };

  /* Notes: tap the name (letters or solfège). */
  const nameIt = (labels) => ({ id, answer }) => new Promise((done) => {
    const want = C.noteAnswer(deck, id, s.mode);
    buttons(labels, answer, (l, b, row) => {
      row.querySelectorAll('button').forEach((x) => { x.disabled = true; if (x.textContent === want) x.classList.add('right'); });
      if (l !== want) b.classList.add('wrong');
      C.playNote(C.parsePitch(id).midi);
      done(l === want);
    });
  });

  /* A keyboard around the cards' notes. Answers by pitch class, so any octave counts. */
  function keys(answer, lo, hi, dot, onKey) {
    const kb = keyboard({ lo, hi, dot, onKey: (m) => { C.playNote(m, undefined, 0.6); onKey(m); } });
    answer.replaceChildren(kb.el);
    return kb;
  }
  const same = (a, b) => ((a - b) % 12 + 12) % 12 === 0;

  const MODE = {
    letters: nameIt(C.letterButtons(deck.y || 0)),
    solfa: deck.k === 'n' ? nameIt(C.SOLFA) : tapSolfa,
    keys: deck.k === 'n' ? noteKeys : tonalKeys,
    sing: selfCheck,
    say: selfCheck,
    tap: tapRhythm,
  };

  function noteKeys({ id, answer }) {
    const midis = deck.r.map((p) => C.parsePitch(p).midi);
    const want = C.parsePitch(id).midi;
    return new Promise((done) => {
      let kb = null;
      kb = keys(answer, Math.min(...midis) - 2, Math.max(...midis) + 2, null, (m) => {
        const ok = same(m, want);
        kb.el.classList.add('locked');
        if (!ok) { kb.flash(m, 'wrong', 1400); kb.flash(want, 'right', 1400); } else kb.flash(m, 'right', 900);
        done(ok);
      });
    });
  }

  /* Tonal patterns: the syllables appear under the card as they go. */
  function slots(under, notes) {
    const row = el('div', { class: 'gsyl' }, notes.map(() => el('span', { class: 'slot' }, '·')));
    under.replaceChildren(row);
    return [...row.children];
  }
  function reveal(under, notes) {
    const row = el('div', { class: 'gsyl' }, notes.map((n) => el('span', {}, n.syl)));
    under.replaceChildren(row);
    return [...row.children];
  }

  function tonalKeys({ id, under, answer }) {
    const notes = C.tonalNotes(deck, id);
    const home = C.homeMidi(deck);
    const doMidi = C.tonalityOf(deck) === 'minor' ? home + 3 : home;
    const spots = slots(under, notes);
    let at = 0;
    return new Promise((done) => {
      let kb = null;
      kb = keys(answer, home - 7, home + 14, doMidi, (m) => {
        if (at >= notes.length) return;
        if (same(m, notes[at].midi)) {
          spots[at].textContent = notes[at].syl;
          spots[at].classList.add('ok');
          if (++at === notes.length) { kb.el.classList.add('locked'); done(true); }
          return;
        }
        kb.el.classList.add('locked');
        kb.flash(m, 'wrong', 1400);
        kb.flash(notes[at].midi, 'right', 1400);
        const all = reveal(under, notes);
        all[at].classList.add('miss');
        done(false);
      });
    });
  }

  function tapSolfa({ id, under, answer }) {
    const notes = C.tonalNotes(deck, id);
    const spots = slots(under, notes);
    const home = C.homeMidi(deck);
    const doMidi = C.tonalityOf(deck) === 'minor' ? home + 3 : home;
    let at = 0;
    return new Promise((done) => {
      buttons(C.deckSyllables(deck), answer, (l, b, row) => {
        if (at >= notes.length) return;
        const want = notes[at];
        if (l === want.base) {
          C.playNote(want.midi, undefined, 0.6);
          spots[at].textContent = want.syl;
          spots[at].classList.add('ok');
          if (++at === notes.length) { row.querySelectorAll('button').forEach((x) => { x.disabled = true; }); done(true); }
          return;
        }
        C.playNote(doMidi + (TONE_STEPS[l] ?? 0), undefined, 0.6);
        row.querySelectorAll('button').forEach((x) => { x.disabled = true; if (x.textContent === want.base) x.classList.add('right'); });
        b.classList.add('wrong');
        reveal(under, notes)[at].classList.add('miss');
        done(false);
      });
    });
  }

  /* Sing or say it, then hear it, then say how it went. */
  function selfCheck({ id, under, answer, my }) {
    return new Promise((done) => {
      const listen = el('button', { class: 'glisten', 'aria-label': 'Listen' }, '👂');
      const yes = el('button', { class: 'got', 'aria-label': 'Got it', disabled: true }, '👍');
      const no = el('button', { class: 'again', 'aria-label': 'Not yet', disabled: true }, '🔁');
      const home = deck.k === 't' && el('button', { class: 'ghome', 'aria-label': 'do' }, '🎵');
      answer.replaceChildren(el('div', { class: 'gbtns' }, home, listen), el('div', { class: 'gbtns' }, yes, no));
      answer.firstChild.prepend(el('span', { class: 'gme' }, deck.k === 't' ? '🎤' : '🗣'));
      if (home) home.onclick = () => C.playNote(C.tonalityOf(deck) === 'minor' ? C.homeMidi(deck) + 3 : C.homeMidi(deck), undefined, 1.2);
      listen.onclick = async () => {
        const syl = deck.k === 't' ? reveal(under, C.tonalNotes(deck, id)) : reveal(under, C.rhythmEvents(id).events.map((e) => ({ syl: e.s })));
        await C.playModel(deck, id, { onEvent: (i) => { syl.forEach((x) => x.classList.remove('now')); syl[i]?.classList.add('now'); } });
        if (my !== token) return;
        yes.disabled = false;
        no.disabled = false;
      };
      yes.onclick = () => done(true);
      no.onclick = () => done(false);
    });
  }

  /* Tap the rhythm after a bar of count-in, then hear it. */
  async function tapRhythm({ id, under, answer, my }) {
    const pad = el('button', { class: 'gpad', disabled: true, 'aria-label': 'Tap' }, '👏');
    const go = el('button', { class: 'ggo', 'aria-label': 'Start' }, '▶');
    answer.replaceChildren(go, pad);
    await new Promise((r) => { go.onclick = r; });
    if (my !== token) return null;
    go.remove();
    const run = C.tapRun(deck, id);
    const taps = [];
    const onTap = (ev) => {
      if (ev.type === 'keydown' && ev.key !== ' ' && ev.key !== 'Enter') return;
      ev.preventDefault();
      taps.push(snd.now());
      bump(pad, 'hit');
    };
    pad.disabled = false;
    pad.addEventListener('pointerdown', onTap);
    document.addEventListener('keydown', onTap);
    await wait((run.end - snd.now() + run.beat * 0.6) * 1000);
    pad.removeEventListener('pointerdown', onTap);
    document.removeEventListener('keydown', onTap);
    pad.disabled = true;
    if (my !== token) return null;
    const { hits, extra } = C.scoreTaps(run, taps);
    const syl = reveal(under, run.events.map((e) => ({ syl: e.s })));
    hits.forEach((h, i) => syl[i].classList.add(h ? 'ok' : 'miss'));
    const ok = hits.every(Boolean) && extra <= 0;
    if (!ok) await wait(await C.playModel(deck, id));
    return ok;
  }

  /* ---------- The end ---------- */

  function report() {
    s.ended = true;
    if (onEnd) onEnd({ k: deck.k, mode: s.mode, n: s.n, ok: s.ok, ms: Math.round(s.ms), at: new Date().toISOString().slice(0, 10), items: s.items });
  }

  async function finish() {
    if (!s || !s.n) { close(); return; }
    token++;
    if (!s.ended) report();
    doneBtn.hidden = true;
    const weak = Object.entries(s.items)
      .filter(([, [tries, right]]) => right < tries)
      .sort((a, b) => (a[1][1] / a[1][0]) - (b[1][1] / b[1][0]))
      .slice(0, 6);
    const list = el('div', { class: 'gweak' });
    for (const [id, [tries, right]] of weak) {
      const pic = el('div', { class: 'gstaff' });
      pic.innerHTML = await C.cardSVG(deck, id);
      list.append(el('div', { class: 'gw' }, pic, el('span', {}, `✓ ${right}  ✗ ${tries - right}`)));
    }
    const pct = s.ok / s.n;
    body.replaceChildren(el('div', { class: 'gend' },
      el('div', { class: 'gbig' }, el('span', {}, '⭐'), el('strong', {}, String(s.ok)), el('small', {}, `/ ${s.n}`)),
      el('p', { class: 'gscore' }, `${clock(Date.now() - s.t0)}`, s.best >= 3 ? `  ·  🔥 ${s.best}` : '', goal && s.n >= goal ? '  ·  🎯' : ''),
      weak.length ? list : el('p', { class: 'gperfect' }, pct === 1 ? '🏆' : '👍'),
      el('div', { class: 'gbtns' },
        el('button', { 'aria-label': 'Again', onclick: () => start() }, '🔁'),
        el('button', { class: 'got', 'aria-label': 'Done', onclick: () => close() }, '✓'))));
    if (pct === 1 || (goal && s.n >= goal)) confetti(80);
  }

  start();
  return Promise.resolve({ close });
}

/* Semitones above do of the syllable buttons. */
const TONE_STEPS = { do: 0, re: 2, mi: 4, fa: 5, so: 7, si: 8, la: 9, ti: 11 };
