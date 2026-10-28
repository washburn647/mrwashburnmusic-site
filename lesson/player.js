/* The piece player: a MusicXML score that plays back at any speed with a
   cursor (and a hopping ball) following along. Tap the music to start there,
   loop a few bars, turn parts or hands on and off, transpose, and show note
   names or colours. Used on the student's page and in the studio, where
   Kyle sets a piece up (bars, speed, parts...) before sending it. */

import { loadOSMD, parseXML, letterName, solfege } from './score.js';
import * as snd from './sound.js';

const NAMES = ['', 'ABC', 'Do'];
const BOOMWHACKER = ['#E5243B', '#F47B20', '#F5C400', '#7DC242', '#11A38B', '#7F4FA3', '#E0569B', '#2F4A3A'];
const PIANO = /piano|keyboard|organ|harpsichord|celest|clavi/i;

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

/* ---------- The music as a list of timed events ---------- */

function buildTimeline(osmd) {
  const it = osmd.Sheet.MusicPartManager.getIterator();
  const steps = [];
  const notes = [];
  const measures = [];
  const tempo = [];
  let prevM = -1;
  while (!it.EndReached) {
    const t = it.CurrentEnrolledTimestamp.RealValue;
    const m = it.CurrentMeasureIndex;
    const bpm = it.CurrentBpm || 100;
    if (!tempo.length || tempo[tempo.length - 1].bpm !== bpm) tempo.push({ t, bpm });
    if (m !== prevM) {
      const sm = osmd.Sheet.SourceMeasures[m];
      const sig = sm.ActiveTimeSignature;
      measures.push({ m, t: t - it.CurrentRelativeInMeasureTimestamp.RealValue, len: sm.Duration.RealValue, num: sig ? sig.Numerator : 4, den: sig ? sig.Denominator : 4 });
      prevM = m;
    }
    const step = { t, m, src: it.CurrentSourceTimestamp.RealValue, notes: [] };
    for (const ve of it.CurrentVoiceEntries) {
      if (ve.IsGrace) continue;
      for (const n of ve.Notes) {
        if (n.isRest() || !n.Pitch) continue;
        const tie = n.NoteTie;
        if (tie && tie.StartNote !== n) continue;
        const ins = n.ParentStaff.ParentInstrument;
        const ev = { t, dur: tie ? tie.Duration.RealValue : n.Length.RealValue, midi: n.halfTone + 12 + (ins.PlaybackTranspose || 0), staff: n.ParentStaff.idInMusicSheet };
        notes.push(ev);
        step.notes.push(ev);
      }
    }
    steps.push(step);
    it.moveToNext();
  }
  // A tempo marked in the first full bar also covers the pickup before it.
  if (tempo.length > 1 && measures[1] && tempo[1].t < measures[1].t + measures[1].len - 1e-9) { tempo.shift(); tempo[0].t = 0; }
  const last = measures[measures.length - 1];
  const end = last ? last.t + last.len : 0;
  // Seconds at each tempo change, at full speed (bpm counts quarter notes).
  let sec = 0;
  tempo.forEach((seg, i) => {
    if (i) sec += (seg.t - tempo[i - 1].t) * 240 / tempo[i - 1].bpm;
    seg.sec = sec;
  });
  const clicks = [];
  for (const ms of measures) {
    const compound = ms.den === 8 && ms.num % 3 === 0 && ms.num > 3;
    const beat = compound ? 3 / 8 : 1 / ms.den;
    for (let k = 0, b = 0; b < ms.len - 1e-9; k++, b += beat) clicks.push({ t: ms.t + b, accent: k === 0 });
  }
  return { steps, notes, measures, tempo, end, clicks };
}

function segAt(tl, t) {
  let s = tl.tempo[0];
  for (const seg of tl.tempo) { if (seg.t <= t + 1e-9) s = seg; else break; }
  return s;
}
const secAt = (tl, t) => { const s = segAt(tl, t); return s.sec + (t - s.t) * 240 / s.bpm; };
function tAtSec(tl, sec) {
  let s = tl.tempo[0];
  for (const seg of tl.tempo) { if (seg.sec <= sec + 1e-9) s = seg; else break; }
  return s.t + (sec - s.sec) * s.bpm / 240;
}

/* ---------- The player ---------- */

export async function openPlayer(host, { xml, title = '', setup = {}, onSave, onClose, onFinish }) {
  const O = await loadOSMD();
  const st = {
    speed: setup.s || 100, transpose: setup.k || 0, names: setup.n || 0, colors: !!setup.c,
    click: !!setup.x, countIn: setup.ci !== 0, zoom: 0,
    muted: new Set(setup.m || []), hidden: new Set(setup.h || []),
    loop: Number.isInteger(setup.a) && Number.isInteger(setup.b) ? [setup.a, setup.b] : null, picking: null,
  };

  const sheet = el('div', { class: 'psheet' });
  const layer = el('div', { class: 'player-layer' });
  const ball = el('div', { class: 'ball', hidden: true });
  layer.append(ball);
  const stage = el('div', { class: 'pstage' }, sheet, layer);
  const scroller = el('div', { class: 'pscore' }, stage);
  const playBtn = el('button', { class: 'play', 'aria-label': 'Play', onclick: () => (playing ? pause() : play()) }, '▶');
  const speedOut = el('output', { class: 'speed' });
  const speedIn = el('input', { type: 'range', min: 20, max: 200, step: 5, value: st.speed, 'aria-label': 'Speed', oninput: () => setSpeed(+speedIn.value) });
  const loopBtn = el('button', { class: 'loop', 'aria-label': 'Loop', onclick: toggleLoop }, '🔁');
  const moreBtn = el('button', { 'aria-label': 'More', onclick: () => { more.hidden = !more.hidden; } }, '⚙');
  const more = el('div', { class: 'pmore', hidden: true });
  const bar = el('div', { class: 'pbar' },
    el('button', { 'aria-label': 'Back to start', onclick: () => { const was = playing; pause(); seekT(loopRange()?.[0] ?? 0); if (was) play(); } }, '⏮'),
    playBtn,
    el('div', { class: 'speedbox' },
      el('button', { class: 'small', 'aria-label': 'Slower', onclick: () => setSpeed(st.speed - 5) }, '−'),
      speedIn,
      el('button', { class: 'small', 'aria-label': 'Faster', onclick: () => setSpeed(st.speed + 5) }, '+'),
      speedOut),
    loopBtn, moreBtn);
  const saveBtn = onSave && el('button', { class: 'primary', onclick: () => { onSave(currentSetup()); saveBtn.textContent = 'Saved'; setTimeout(() => { saveBtn.textContent = 'Save setup'; }, 1500); } }, 'Save setup');
  const top = el('div', { class: 'ptop' },
    el('button', { class: 'close', 'aria-label': 'Close', onclick: () => close() }, '✕'),
    el('h2', { textContent: title }),
    saveBtn);
  const root = el('div', { class: 'player' }, top, scroller, more, bar);
  host.append(root);
  document.body.classList.add('playing-piece');

  const osmd = new O.OpenSheetMusicDisplay(sheet, {
    autoResize: false, backend: 'svg', drawTitle: true, drawComposer: true, drawPartNames: true,
    drawCredits: false, followCursor: false, pageBackgroundColor: '#FFFFFF',
    cursorsOptions: [{ type: 0, color: '#E0A458', alpha: 0.55, follow: false }],
  });
  osmd.TransposeCalculator = new O.IntervalTransposeCalculator();
  try {
    const doc = parseXML(xml);
    // No title in the file: leave it off rather than show "Untitled Score".
    if (![...doc.querySelectorAll('work-title, movement-title, credit-words')].some((e) => e.textContent.trim())) osmd.setOptions({ drawTitle: false });
    await osmd.load(doc);
  } catch {
    sheet.append(el('p', { class: 'perr', textContent: '⚠' }));
    return { close };
  }

  const staves = [];
  for (const ins of osmd.Sheet.Instruments) {
    ins.Staves.forEach((s, i) => {
      let name = ins.Name || `Part ${staves.length + 1}`;
      if (ins.Staves.length === 2 && PIANO.test(ins.Name || 'Piano')) name = i ? 'Left hand' : 'Right hand';
      else if (ins.Staves.length > 1) name += ` ${i + 1}`;
      staves.push({ id: s.idInMusicSheet, staff: s, name });
    });
  }
  const buses = {};
  for (const s of staves) buses[s.id] = null;
  const busFor = (id) => {
    if (!buses[id]) buses[id] = snd.bus(st.muted.has(id) ? 0 : 1);
    return buses[id];
  };

  // Key signature (as written) for each measure and staff, for solfege.
  const keys = [];
  {
    const cur = {};
    osmd.Sheet.SourceMeasures.forEach((sm, mi) => {
      sm.FirstInstructionsStaffEntries.forEach((se, si) => {
        const k = se?.Instructions?.find((x) => 'Key' in x && 'Mode' in x);
        if (k) cur[si] = k.keyTypeOriginal ?? k.Key;
      });
      keys[mi] = { ...cur };
    });
  }

  const tl = buildTimeline(osmd);
  const startBpm = tl.tempo[0]?.bpm || 100;

  /* ---------- drawing ---------- */

  function render() {
    const w = scroller.clientWidth;
    if (!st.zoom) st.zoom = w < 520 ? 0.5 : w < 820 ? 0.75 : 1;
    osmd.zoom = st.zoom;
    for (const s of staves) s.staff.Visible = !st.hidden.has(s.id);
    osmd.Sheet.Transpose = st.transpose;
    osmd.setOptions({ coloringEnabled: st.colors, coloringMode: st.colors ? O.ColoringModes.CustomColorSet : O.ColoringModes.XML, coloringSetCustom: BOOMWHACKER, colorStemsLikeNoteheads: st.colors });
    osmd.updateGraphic();
    osmd.render();
    osmd.cursor.show();
    seekT(pos, true);
    drawLayer();
  }

  const unit = () => 10 * osmd.zoom;
  function origin() {
    const svg = sheet.querySelector('svg');
    if (!svg) return { x: 0, y: 0 };
    const a = svg.getBoundingClientRect();
    const b = stage.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top };
  }

  function measureBoxes() {
    const u = unit();
    const o = origin();
    return osmd.GraphicSheet.MeasureList.map((row) => {
      let box = null;
      for (const gm of row || []) {
        if (!gm || !gm.ParentStaff?.isVisible?.()) continue;
        const p = gm.PositionAndShape;
        const r = { x: p.AbsolutePosition.x, y: p.AbsolutePosition.y + p.BorderTop, x2: p.AbsolutePosition.x + p.Size.width, y2: p.AbsolutePosition.y + p.BorderBottom };
        box = box ? { x: Math.min(box.x, r.x), y: Math.min(box.y, r.y), x2: Math.max(box.x2, r.x2), y2: Math.max(box.y2, r.y2) } : r;
      }
      return box && { x: o.x + box.x * u, y: o.y + box.y * u, w: (box.x2 - box.x) * u, h: (box.y2 - box.y) * u, gms: row };
    });
  }

  function drawLayer() {
    layer.replaceChildren(ball);
    const boxes = measureBoxes();
    const sel = st.picking != null ? [st.picking, st.picking] : st.loop;
    if (sel) {
      for (let i = Math.min(...sel); i <= Math.max(...sel); i++) {
        const b = boxes[i];
        if (b) layer.append(el('div', { class: `loopbox${st.picking != null ? ' picking' : ''}`, style: `left:${b.x}px;top:${b.y - 6}px;width:${b.w}px;height:${b.h + 12}px` }));
      }
    }
    if (st.names) drawNames(boxes);
    loopBtn.classList.toggle('on', !!st.loop || st.picking != null);
  }

  function drawNames(boxes) {
    const u = unit();
    const o = origin();
    boxes.forEach((b, mi) => {
      if (!b) return;
      b.gms.forEach((gm, si) => {
        if (!gm || !gm.ParentStaff?.isVisible?.()) return;
        const fifths = keys[mi]?.[si] ?? 0;
        const y = o.y + (gm.PositionAndShape.AbsolutePosition.y + 4) * u + 4;
        for (const se of gm.staffEntries) {
          const names = [];
          let x = null;
          for (const gve of se.graphicalVoiceEntries) {
            for (const gn of gve.notes) {
              const n = gn.sourceNote;
              if (n.isRest() || !n.Pitch || (n.NoteTie && n.NoteTie.StartNote !== n)) continue;
              if (x == null) x = gn.PositionAndShape.AbsolutePosition.x;
              const p = st.names === 1 ? (n.TransposedPitch || n.Pitch) : n.Pitch;
              const letter = Math.max(0, [0, 2, 4, 5, 7, 9, 11].indexOf(p.FundamentalNote));
              const alter = Math.round(p.AccidentalHalfTones || 0);
              names.push({ h: n.halfTone, s: st.names === 1 ? letterName(letter, alter) : solfege(letter, alter, fifths) });
            }
          }
          if (!names.length) continue;
          names.sort((a, c) => c.h - a.h);
          const uniq = [...new Set(names.map((nm) => nm.s))];
          layer.append(el('div', { class: 'nname', style: `left:${o.x + x * u + 5 * osmd.zoom}px;top:${y}px;font-size:${Math.max(10, 13 * osmd.zoom)}px`, textContent: uniq.join('\n') }));
        }
      });
    });
  }

  /* ---------- cursor ---------- */

  let pos = 0;        // where we are, in whole notes along the played order
  let stepIdx = 0;    // the cursor's step

  function stepAtT(t) {
    let i = 0;
    while (i + 1 < tl.steps.length && tl.steps[i + 1].t <= t + 1e-9) i++;
    return i;
  }

  function moveCursorTo(i, force) {
    if (!force && i === stepIdx) return;
    const c = osmd.cursor;
    if (force || i < stepIdx) { c.reset(); stepIdx = 0; }
    while (stepIdx < i && !c.Iterator.EndReached) { c.Iterator.moveToNext(); stepIdx++; }
    c.update();
    placeBall();
  }

  function seekT(t, force) {
    pos = Math.max(0, Math.min(t, tl.end));
    moveCursorTo(stepAtT(pos), force);
  }

  let followPaused = 0;
  scroller.addEventListener('wheel', () => { followPaused = performance.now(); }, { passive: true });
  scroller.addEventListener('touchmove', () => { followPaused = performance.now(); }, { passive: true });

  function placeBall() {
    const ce = osmd.cursor.cursorElement;
    if (!ce || ce.style.display === 'none') { ball.hidden = true; return; }
    const cr = ce.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    ball.hidden = false;
    ball.style.left = `${cr.left - sr.left + cr.width / 2}px`;
    ball.style.top = `${cr.top - sr.top - 16}px`;
    ball.classList.remove('hop');
    void ball.offsetWidth;
    ball.classList.add('hop');
    if (performance.now() - followPaused < 2500) return;
    const vr = scroller.getBoundingClientRect();
    if (cr.top < vr.top + 30 || cr.bottom > vr.bottom - 20) {
      scroller.scrollTo({ top: scroller.scrollTop + (cr.top - vr.top) - vr.height * 0.25, behavior: 'smooth' });
    }
  }

  /* ---------- playback ---------- */

  let playing = false;
  let timer = null;
  let raf = 0;
  let anchors = [];   // { from: audio time it applies from, ctx: audio time of t0, t0 }
  let ni = 0;         // next note to schedule
  let ci = 0;         // next click to schedule
  let voices = [];
  const LOOK = 0.25;

  const loopRange = () => {
    if (!st.loop) return null;
    const [a, b] = [Math.min(...st.loop), Math.max(...st.loop)];
    const first = tl.measures.find((ms) => ms.m === a);
    if (!first) return null;
    const lastM = tl.measures.find((ms) => ms.m === b && ms.t >= first.t) || tl.measures[tl.measures.length - 1];
    return [first.t, lastM.t + lastM.len];
  };

  const sp = () => st.speed / 100;
  const whenOf = (a, t) => a.ctx + (secAt(tl, t) - secAt(tl, a.t0)) / sp();

  function posNow() {
    const n = snd.now();
    let a = anchors[0];
    for (const x of anchors) if (x.from <= n) a = x;
    if (!a || n < a.ctx) return a ? a.t0 : pos;
    return tAtSec(tl, secAt(tl, a.t0) + (n - a.ctx) * sp());
  }

  function play(countIn = st.countIn) {
    if (playing || !tl.steps.length) return;
    const range = loopRange();
    if (pos >= tl.end - 1e-6 || (range && (pos < range[0] - 1e-6 || pos >= range[1] - 1e-6))) pos = range ? range[0] : 0;
    playing = true;
    playBtn.textContent = '⏸';
    playBtn.setAttribute('aria-label', 'Pause');
    let t0 = snd.now() + 0.12;
    if (countIn) {
      const ms = tl.measures.find((x) => x.t <= pos + 1e-9 && x.t + x.len > pos) || tl.measures[0];
      const full = ms.num / ms.den;
      const compound = ms.den === 8 && ms.num % 3 === 0 && ms.num > 3;
      const beat = compound ? 3 / 8 : 1 / ms.den;
      const beatSec = beat * 240 / segAt(tl, pos).bpm / sp();
      const n = Math.round(full / beat);
      for (let k = 0; k < n; k++) snd.click(t0 + k * beatSec, k === 0);
      t0 += n * beatSec;
    }
    anchors = [{ from: 0, ctx: t0, t0: pos }];
    ni = tl.notes.findIndex((e) => e.t >= pos - 1e-9);
    if (ni < 0) ni = tl.notes.length;
    ci = tl.clicks.findIndex((e) => e.t >= pos - 1e-9);
    if (ci < 0) ci = tl.clicks.length;
    schedule();
    timer = setInterval(schedule, 40);
    raf = requestAnimationFrame(frame);
  }

  function schedule() {
    const horizon = snd.now() + LOOK;
    for (;;) {
      const a = anchors[anchors.length - 1];
      const range = loopRange();
      const stopAt = range ? range[1] : tl.end;
      const nextNote = tl.notes[ni];
      const nextClick = st.click ? tl.clicks[ci] : null;
      const nextT = Math.min(nextNote ? nextNote.t : Infinity, nextClick ? nextClick.t : Infinity);
      if (nextT >= stopAt - 1e-9 || nextT === Infinity) {
        const endWhen = whenOf(a, stopAt);
        if (!range || endWhen > horizon) return;
        // Wrap the loop: the next lap starts where this one ends.
        anchors.push({ from: endWhen, ctx: endWhen, t0: range[0] });
        if (anchors.length > 4) anchors.shift();
        ni = tl.notes.findIndex((e) => e.t >= range[0] - 1e-9);
        ci = tl.clicks.findIndex((e) => e.t >= range[0] - 1e-9);
        if (ni < 0) ni = tl.notes.length;
        if (ci < 0) ci = tl.clicks.length;
        continue;
      }
      const when = whenOf(a, nextT);
      if (when > horizon) return;
      if (nextNote && nextNote.t === nextT) {
        const d = secAt(tl, Math.min(nextNote.t + nextNote.dur, tl.end)) - secAt(tl, nextNote.t);
        voices.push({ when, stop: snd.note(nextNote.midi + st.transpose, Math.max(when, snd.now()), Math.max(0.08, d / sp() - 0.02), { vol: 0.22, dest: busFor(nextNote.staff) }) });
        ni++;
      } else {
        snd.click(Math.max(when, snd.now()), nextClick.accent);
        ci++;
      }
      if (voices.length > 400) voices = voices.slice(-200);
    }
  }

  function frame() {
    if (!playing) return;
    const t = posNow();
    const range = loopRange();
    if (!range && t >= tl.end - 1e-6) {
      pause();
      seekT(0);
      if (onFinish) onFinish();
      return;
    }
    pos = t;
    moveCursorTo(stepAtT(t));
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    if (!playing) return;
    pos = Math.min(posNow(), tl.end);
    playing = false;
    clearInterval(timer);
    cancelAnimationFrame(raf);
    voices.forEach((v) => v.stop());
    voices = [];
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Play');
  }

  function restartIfPlaying(fn) {
    const was = playing;
    pause();
    fn();
    if (was) play(false);
  }

  function setSpeed(v) {
    v = Math.max(20, Math.min(200, Math.round(v / 5) * 5));
    restartIfPlaying(() => { st.speed = v; });
    speedIn.value = v;
    speedOut.textContent = `♩ ${Math.round(startBpm * v / 100)}`;
    speedOut.title = `${v}%`;
    speedOut.dataset.pct = `${v}%`;
  }

  /* ---------- tapping the music ---------- */

  function hit(ev) {
    const sr = stage.getBoundingClientRect();
    const x = ev.clientX - sr.left;
    const y = ev.clientY - sr.top;
    const boxes = measureBoxes();
    let best = -1;
    let bestD = Infinity;
    boxes.forEach((b, i) => {
      if (!b) return;
      const dx = x < b.x ? b.x - x : x > b.x + b.w ? x - b.x - b.w : 0;
      const dy = y < b.y - 20 ? b.y - 20 - y : y > b.y + b.h + 20 ? y - b.y - b.h - 20 : 0;
      const d = dx + dy * 3;
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best < 0 || bestD > 60) return null;
    // The nearest beat in that bar.
    const u = unit();
    const o = origin();
    let src = null;
    let dBest = Infinity;
    for (const gm of boxes[best].gms) {
      if (!gm) continue;
      for (const se of gm.staffEntries) {
        const sx = o.x + se.PositionAndShape.AbsolutePosition.x * u;
        const d = Math.abs(sx - x);
        if (d < dBest) { dBest = d; src = gm.parentSourceMeasure.AbsoluteTimestamp.RealValue + se.sourceStaffEntry.Timestamp.RealValue; }
      }
    }
    return { m: best, src };
  }

  stage.addEventListener('click', (ev) => {
    const h = hit(ev);
    if (!h) return;
    if (st.picking != null) {
      st.loop = [st.picking, h.m].sort((a, b) => a - b);
      st.picking = null;
      drawLayer();
      restartIfPlaying(() => seekT(loopRange()[0]));
      return;
    }
    if (loopBtn.classList.contains('arming')) {
      loopBtn.classList.remove('arming');
      st.picking = h.m;
      drawLayer();
      return;
    }
    const i = tl.steps.findIndex((s) => s.m === h.m && s.src >= h.src - 1e-9);
    if (i < 0) return;
    const range = loopRange();
    if (range && (tl.steps[i].t < range[0] || tl.steps[i].t >= range[1])) { st.loop = null; drawLayer(); }
    restartIfPlaying(() => {
      seekT(tl.steps[i].t);
      if (!playing) {
        const n = snd.now() + 0.02;
        tl.steps[i].notes.forEach((e) => { if (!st.muted.has(e.staff)) snd.note(e.midi + st.transpose, n, 0.5, { vol: 0.2 }); });
      }
    });
  });

  function toggleLoop() {
    if (st.loop || st.picking != null || loopBtn.classList.contains('arming')) {
      st.loop = null;
      st.picking = null;
      loopBtn.classList.remove('arming');
      drawLayer();
      return;
    }
    loopBtn.classList.add('arming');
  }

  /* ---------- the More panel ---------- */

  function seg(label, options, value, set) {
    return el('div', { class: 'prow' }, el('span', {}, label), el('div', { class: 'seg' }, options.map((o, i) =>
      el('button', { 'aria-pressed': String(value() === i), onclick: () => { set(i); fillMore(); } }, o))));
  }
  function stepper(label, show, change) {
    return el('div', { class: 'prow' }, el('span', {}, label), el('div', { class: 'seg' },
      el('button', { onclick: () => { change(-1); fillMore(); } }, '−'),
      el('output', { textContent: show() }),
      el('button', { onclick: () => { change(1); fillMore(); } }, '+')));
  }

  function fillMore() {
    more.replaceChildren(
      seg('🥁', ['Off', 'On'], () => +st.click, (i) => restartIfPlaying(() => { st.click = !!i; })),
      seg('1 2 3 4', ['Off', 'On'], () => +st.countIn, (i) => { st.countIn = !!i; }),
      seg('A B C', ['Off', 'ABC', 'Do re mi'], () => st.names, (i) => { st.names = i; drawLayer(); }),
      seg('🌈', ['Off', 'On'], () => +st.colors, (i) => { st.colors = !!i; restartIfPlaying(render); }),
      stepper('♯♭', () => (st.transpose > 0 ? `+${st.transpose}` : String(st.transpose)), (d) => {
        st.transpose = Math.max(-12, Math.min(12, st.transpose + d));
        restartIfPlaying(render);
      }),
      stepper('🔍', () => `${Math.round(st.zoom * 100)}%`, (d) => {
        st.zoom = Math.max(0.4, Math.min(2, Math.round((st.zoom + d * 0.1) * 10) / 10));
        render();
      }),
      staves.length > 1 && el('div', { class: 'parts' }, staves.map((s) => el('div', { class: 'prow' },
        el('span', { textContent: s.name }),
        el('div', { class: 'seg' },
          el('button', { 'aria-label': 'Sound', 'aria-pressed': String(!st.muted.has(s.id)), onclick: () => {
            if (st.muted.has(s.id)) st.muted.delete(s.id); else st.muted.add(s.id);
            if (buses[s.id]) buses[s.id].gain.setTargetAtTime(st.muted.has(s.id) ? 0 : 1, snd.now(), 0.02);
            fillMore();
          } }, st.muted.has(s.id) ? '🔇' : '🔊'),
          el('button', { 'aria-label': 'Show', 'aria-pressed': String(!st.hidden.has(s.id)), onclick: () => {
            if (st.hidden.has(s.id)) st.hidden.delete(s.id);
            else if (st.hidden.size < staves.length - 1) st.hidden.add(s.id);
            restartIfPlaying(render);
            fillMore();
          } }, '👁'))))),
    );
  }

  function currentSetup() {
    const out = {};
    if (st.speed !== 100) out.s = st.speed;
    if (st.transpose) out.k = st.transpose;
    if (st.names) out.n = st.names;
    if (st.colors) out.c = 1;
    if (st.click) out.x = 1;
    if (!st.countIn) out.ci = 0;
    if (st.muted.size) out.m = [...st.muted];
    if (st.hidden.size) out.h = [...st.hidden];
    if (st.loop) { out.a = st.loop[0]; out.b = st.loop[1]; }
    return out;
  }

  /* ---------- open and close ---------- */

  function onKey(ev) {
    if (ev.key === ' ' && !/INPUT|TEXTAREA|BUTTON/.test(ev.target.tagName)) { ev.preventDefault(); if (playing) pause(); else play(); }
    if (ev.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);

  let lastW = 0;
  let resizeTimer = null;
  const ro = new ResizeObserver(() => {
    const w = scroller.clientWidth;
    if (Math.abs(w - lastW) < 4) return;
    lastW = w;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => restartIfPlaying(render), 150);
  });

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    pause();
    ro.disconnect();
    document.removeEventListener('keydown', onKey);
    Object.values(buses).forEach((b) => b && b.disconnect());
    root.remove();
    document.body.classList.remove('playing-piece');
    if (onClose) onClose(currentSetup());
  }

  setSpeed(st.speed);
  fillMore();
  lastW = scroller.clientWidth;
  render();
  if (st.loop) { const r = loopRange(); if (r) seekT(r[0]); }
  ro.observe(scroller);
  return { close, play, pause };
}
