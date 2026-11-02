/* The piece player, in these modes:
   - 'teach' (studio): everything. Kyle tries a piece, marks sections (bars named
     with a letter or a title), types fingerings, and saves the student's settings.
   - 'sheet' (student): the score full screen with a cursor and a hopping ball,
     play/pause, speed within Kyle's range, his sections and the parts.
   - 'keys' (student): a keyboard that lights up as the music plays, no score.
   - 'both' (student): the score with the lit keyboard under it.
   - 'listen' (student): a small window with no score: speed, back, play/pause,
     forward, sections, parts.
   Students never see the settings. Notes play on the sampled piano when it
   loads (assets/sounds), otherwise on the built-in tone. */

import { loadOSMD, parseXML, letterName, solfege } from './score.js';
import { keyboard } from './keyboard.js';
import * as snd from './sound.js';

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

/* Bar numbers as printed -> measure index. */
function indexOfBar(osmd, bar) {
  const i = osmd.Sheet.SourceMeasures.findIndex((sm) => sm.MeasureNumber === bar);
  return i < 0 ? null : i;
}

/* The buttons a student can get for a piece: [bit in setup.v, mode, icon, what it is]. */
export const PIECE_MODES = [[1, 'listen', '👂🎶', 'Listen'], [4, 'keys', '🎹', 'Keyboard'], [2, 'sheet', '🎼', 'Sheet music'], [8, 'both', '🎼🎹', 'Sheet music and keyboard']];
export const KEYBOARD_MODES = 12;

/* Where a fingering belongs: measure, staff, and time in the measure. */
const fingerKey = (mi, si, se) => `${mi}.${si}.${Math.round(se.sourceStaffEntry.Timestamp.RealValue * 960)}`;

export async function openPlayer(host, { xml, title = '', setup = {}, mode = 'teach', onSave, onClose, onFinish, onPlaying }) {
  const O = await loadOSMD();
  const teach = mode === 'teach';
  const listen = mode === 'listen';
  const keysOnly = mode === 'keys';
  const withKeys = keysOnly || mode === 'both';
  const noScore = listen || keysOnly;
  const range = Array.isArray(setup.sp) ? setup.sp : [20, 200];
  const lo = teach ? 20 : Math.max(20, Math.min(...range));
  const hi = teach ? 200 : Math.min(200, Math.max(...range));
  const st = {
    speed: Math.max(lo, Math.min(hi, setup.s || 100)), transpose: setup.k || 0, names: setup.n || 0, colors: !!setup.c,
    click: !!setup.x, countIn: setup.ci !== 0, zoom: 0, fingers: { ...(setup.f || {}) },
    muted: new Set(setup.m || []), hidden: new Set(setup.h || []),
    loop: null, picking: null, section: -1,
  };
  const sections = (Array.isArray(setup.sec) ? setup.sec : []).filter((x) => Array.isArray(x) && x.length === 3).map((x) => [...x]);
  const pianoP = snd.instrument('piano', { lo: 21, hi: 108 });
  let piano = null;
  pianoP.then((p) => { piano = p; });

  const sheet = el('div', { class: 'psheet' });
  const layer = el('div', { class: 'player-layer' });
  const ball = el('div', { class: 'ball', hidden: true });
  layer.append(ball);
  const stage = el('div', { class: 'pstage' }, sheet, layer);
  const scroller = el('div', { class: 'pscore' }, stage);
  const playBtn = el('button', { class: 'play', 'aria-label': 'Play', onclick: () => (playing ? pause() : play()) }, '▶');
  const speedOut = el('output', { class: 'speed' });
  const speedIn = teach && el('input', { type: 'range', min: lo, max: hi, step: 5, value: st.speed, 'aria-label': 'Speed', oninput: () => setSpeed(+speedIn.value) });
  const loopBtn = el('button', { class: 'loop', 'aria-label': 'Loop', onclick: toggleLoop }, '🔁');
  const moreBtn = teach && el('button', { 'aria-label': 'More', onclick: () => { more.hidden = !more.hidden; } }, '⚙');
  const more = el('div', { class: 'pmore', hidden: true });
  const chips = el('div', { class: 'pchips' });
  const progress = el('div', { class: 'pprog' }, el('span'));
  const barOut = el('output', { class: 'pbarnum' });
  const toStart = () => restartIfPlaying(() => seekT(loopRange()?.[0] ?? 0));
  const byBar = (d) => restartIfPlaying(() => {
    const i = tl.measures.findIndex((ms) => ms.t <= pos + 1e-9 && ms.t + ms.len > pos + 1e-9);
    const j = Math.max(0, Math.min(tl.measures.length - 1, (i < 0 ? 0 : i) + d));
    seekT(tl.measures[j].t);
  });
  const speedBox = el('div', { class: 'speedbox' },
    el('button', { class: 'small', 'aria-label': 'Slower', onclick: () => setSpeed(st.speed - 5) }, '−'),
    speedIn,
    el('button', { class: 'small', 'aria-label': 'Faster', onclick: () => setSpeed(st.speed + 5) }, '+'),
    speedOut);
  const bar = listen
    ? el('div', { class: 'pbar' },
      el('button', { 'aria-label': 'Back', onclick: () => byBar(-1) }, '⏪'), playBtn,
      el('button', { 'aria-label': 'Forward', onclick: () => byBar(1) }, '⏩'), speedBox)
    : el('div', { class: 'pbar' },
      el('button', { 'aria-label': 'Back to start', onclick: toStart }, '⏮'), playBtn, speedBox,
      teach && loopBtn, teach && el('button', { class: 'addsec', hidden: true, onclick: () => {
        if (!st.loop) return;
        const nums = st.loop.map((i) => osmd.Sheet.SourceMeasures[i].MeasureNumber);
        const used = new Set(sections.map((x) => x[0]));
        let n = 0;
        while (used.has(String.fromCharCode(65 + (n % 26)))) n++;
        sections.push([String.fromCharCode(65 + (n % 26)), Math.min(...nums), Math.max(...nums)]);
        st.section = sections.length - 1;
        drawLayer();
        fillMore();
        more.hidden = false;
        more.querySelector('.secs input:last-of-type')?.focus();
      } }, '＋ Section'), moreBtn);
  const addSec = bar.querySelector('.addsec');
  const saveBtn = onSave && el('button', { class: 'primary', onclick: () => { onSave(currentSetup()); saveBtn.textContent = 'Saved'; setTimeout(() => { saveBtn.textContent = 'Save settings'; }, 1500); } }, 'Save settings');
  const top = el('div', { class: 'ptop' },
    el('button', { class: 'close', 'aria-label': 'Close', onclick: () => close() }, '✕'),
    el('h2', { textContent: title }),
    saveBtn);
  const kbdBox = withKeys && el('div', { class: 'pkeys' });
  const root = listen
    ? el('div', { class: 'player listen' }, el('div', { class: 'lcard' }, top, el('div', { class: 'lprog' }, progress, barOut), chips, bar))
    : el('div', { class: `player ${mode}` }, top, keysOnly ? null : scroller, kbdBox, more, chips, bar);
  if (listen) root.addEventListener('click', (e) => { if (e.target === root) close(); });
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
    (noScore ? chips : sheet).append(el('p', { class: 'perr', textContent: '⚠' }));
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
  const busFor = (id) => {
    if (!buses[id]) buses[id] = snd.bus(st.muted.has(id) ? 0 : 1);
    return buses[id];
  };
  const voice = (midi, t, dur, opts) => (piano ? piano.note(midi, t, dur, opts) : snd.note(midi, t, dur, opts));

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

  /* The keyboard that lights up: the piece's range, at least two octaves. */
  let kbd = null;
  function makeKeys() {
    if (!kbdBox) return;
    const ms = tl.notes.map((n) => n.midi + st.transpose);
    let lo = ms.length ? Math.min(...ms) : 60;
    let hi = ms.length ? Math.max(...ms) : 72;
    while (hi - lo < 24) { lo--; if (hi - lo < 24) hi++; }
    kbd = keyboard({ lo, hi, onKey: (m) => voice(m, snd.now() + 0.01, 0.6, { vol: 0.22 }) });
    kbdBox.replaceChildren(kbd.el);
  }
  const litClass = (staff) => (staves.findIndex((x) => x.id === staff) > 0 ? 'lit2' : 'lit');

  /* ---------- drawing ---------- */

  function render() {
    if (noScore) { drawProgress(); return; }
    // The music fits the width of the screen it's on.
    const w = scroller.clientWidth;
    st.zoom = w < 520 ? 0.5 : w < 820 ? 0.75 : Math.min(1.3, w / 1000);
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
    drawChips();
    if (noScore) return;
    layer.replaceChildren(ball);
    const boxes = measureBoxes();
    const sel = st.picking != null ? [st.picking, st.picking] : st.loop;
    if (sel) {
      for (let i = Math.min(...sel); i <= Math.max(...sel); i++) {
        const b = boxes[i];
        if (b) layer.append(el('div', { class: `loopbox${st.picking != null ? ' picking' : ''}`, style: `left:${b.x}px;top:${b.y - 6}px;width:${b.w}px;height:${b.h + 12}px` }));
      }
    }
    if (st.names === 3) drawFingers(boxes);
    else if (st.names) drawNames(boxes);
    drawSectionMarks(boxes);
    loopBtn.classList.toggle('on', !!st.loop || st.picking != null);
    if (addSec) addSec.hidden = !(st.loop && st.section < 0);
  }

  /* Each section's name over its first bar. */
  function drawSectionMarks(boxes) {
    for (const [name, a] of sections) {
      const b = boxes[indexOfBar(osmd, a)];
      if (b && name) layer.append(el('div', { class: 'secmark', style: `left:${b.x}px;top:${b.y - 30}px`, textContent: name }));
    }
  }

  /* Fingerings Kyle types (they aren't in most files): above the top staff of a part,
     below the others. In the studio each is a box to type in. */
  function drawFingers(boxes) {
    const u = unit();
    const o = origin();
    boxes.forEach((b, mi) => {
      if (!b) return;
      b.gms.forEach((gm, si) => {
        if (!gm || !gm.ParentStaff?.isVisible?.()) return;
        const below = gm.ParentStaff.ParentInstrument.Staves.indexOf(gm.ParentStaff) > 0;
        const y = o.y + (gm.PositionAndShape.AbsolutePosition.y + (below ? 5.2 : -2.6)) * u;
        for (const se of gm.staffEntries) {
          const hasNote = se.graphicalVoiceEntries.some((g) => g.notes.some((gn) => !gn.sourceNote.isRest()));
          if (!hasNote) continue;
          const key = fingerKey(mi, si, se);
          const x = o.x + se.PositionAndShape.AbsolutePosition.x * u;
          const size = Math.max(11, 14 * osmd.zoom);
          if (teach) {
            const box = el('input', { class: 'finger edit', value: st.fingers[key] || '', maxLength: 8, 'aria-label': 'Fingering',
              style: `left:${x - size * 0.2}px;top:${y}px;font-size:${size}px` });
            box.addEventListener('click', (e) => e.stopPropagation());
            box.addEventListener('input', () => {
              const v = box.value.replace(/[^0-9a-zA-Z,\-/ ]/g, '').slice(0, 8);
              if (v !== box.value) box.value = v;
              if (v.trim()) st.fingers[key] = v.trim(); else delete st.fingers[key];
            });
            layer.append(box);
          } else if (st.fingers[key]) {
            layer.append(el('div', { class: 'finger', style: `left:${x}px;top:${y}px;font-size:${size}px`, textContent: st.fingers[key] }));
          }
        }
      });
    });
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

  /* Sections and parts the student can choose. */
  function drawChips() {
    const kids = [];
    if (sections.length) {
      kids.push(el('button', { 'aria-pressed': String(st.section < 0 && !st.loop), onclick: () => pickSection(-1) }, '∞'));
      sections.forEach(([name], i) => kids.push(el('button', { 'aria-pressed': String(st.section === i), onclick: () => pickSection(i) }, name || String(i + 1))));
    }
    if (staves.length > 1 && !teach) {
      if (kids.length) kids.push(el('span', { class: 'gap' }));
      staves.forEach((s) => kids.push(el('button', { class: 'part', 'aria-pressed': String(!st.muted.has(s.id)), onclick: () => toggleMute(s.id) }, s.name)));
    }
    chips.replaceChildren(...kids);
    chips.hidden = !kids.length;
  }

  function pickSection(i) {
    st.section = i;
    if (i < 0) st.loop = null;
    else {
      const [, a, b] = sections[i];
      const ia = indexOfBar(osmd, a);
      const ib = indexOfBar(osmd, b);
      st.loop = ia == null || ib == null ? null : [ia, ib];
    }
    drawLayer();
    restartIfPlaying(() => seekT(loopRange()?.[0] ?? 0));
  }

  function toggleMute(id) {
    if (st.muted.has(id)) st.muted.delete(id);
    else if (st.muted.size < staves.length - 1 || teach) st.muted.add(id);
    if (buses[id]) buses[id].gain.setTargetAtTime(st.muted.has(id) ? 0 : 1, snd.now(), 0.02);
    drawChips();
    if (teach) fillMore();
  }

  /* ---------- cursor (or progress bar when listening) ---------- */

  let pos = 0;        // where we are, in whole notes along the played order
  let stepIdx = 0;    // the cursor's step

  function stepAtT(t) {
    let i = 0;
    while (i + 1 < tl.steps.length && tl.steps[i + 1].t <= t + 1e-9) i++;
    return i;
  }

  function drawProgress() {
    if (!listen) return;
    progress.firstChild.style.width = `${tl.end ? (pos / tl.end) * 100 : 0}%`;
    const ms = tl.measures.find((x) => x.t <= pos + 1e-9 && x.t + x.len > pos + 1e-9) || tl.measures[0];
    barOut.textContent = ms ? String(osmd.Sheet.SourceMeasures[ms.m].MeasureNumber) : '';
  }

  function moveCursorTo(i, force) {
    if (noScore) { drawProgress(); return; }
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

  let playedFrom = 0;   // when this run of playing began (for practice time)
  async function play(countIn = st.countIn) {
    if (playing || !tl.steps.length) return;
    playing = true;
    playedFrom = Date.now();
    // Give the piano a moment to arrive the first time.
    if (!piano) await Promise.race([pianoP, new Promise((r) => setTimeout(r, 2500))]);
    if (!playing) return;
    const range = loopRange();
    if (pos >= tl.end - 1e-6 || (range && (pos < range[0] - 1e-6 || pos >= range[1] - 1e-6))) pos = range ? range[0] : 0;
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
        const len = Math.max(0.08, d / sp() - 0.02);
        voices.push({ when, end: when + len, midi: nextNote.midi + st.transpose, staff: nextNote.staff, stop: voice(nextNote.midi + st.transpose, Math.max(when, snd.now()), len, { vol: 0.22, dest: busFor(nextNote.staff) }) });
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
    if (kbd) {
      const n = snd.now();
      const lit = new Map();
      for (const v of voices) if (v.when <= n && v.end > n && !st.muted.has(v.staff)) lit.set(v.midi, litClass(v.staff));
      kbd.light(lit);
    }
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    if (!playing) return;
    pos = anchors.length ? Math.min(posNow(), tl.end) : pos;
    playing = false;
    if (onPlaying) onPlaying((Date.now() - playedFrom) / 1000);
    clearInterval(timer);
    cancelAnimationFrame(raf);
    voices.forEach((v) => v.stop());
    voices = [];
    if (kbd) kbd.light(new Map());
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
    v = Math.max(lo, Math.min(hi, Math.round(v / 5) * 5));
    restartIfPlaying(() => { st.speed = v; });
    if (speedIn) speedIn.value = v;
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
      st.section = -1;
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
    if (range && (tl.steps[i].t < range[0] || tl.steps[i].t >= range[1])) { st.loop = null; st.section = -1; drawLayer(); }
    restartIfPlaying(() => {
      seekT(tl.steps[i].t);
      if (!playing) {
        const n = snd.now() + 0.02;
        tl.steps[i].notes.forEach((e) => {
          if (st.muted.has(e.staff)) return;
          voice(e.midi + st.transpose, n, 0.5, { vol: 0.2 });
          kbd?.flash(e.midi + st.transpose, litClass(e.staff), 500);
        });
      }
    });
  });

  function toggleLoop() {
    if (st.loop || st.picking != null || loopBtn.classList.contains('arming')) {
      st.loop = null;
      st.picking = null;
      st.section = -1;
      loopBtn.classList.remove('arming');
      drawLayer();
      return;
    }
    loopBtn.classList.add('arming');
  }

  /* ---------- the settings panel (studio only) ---------- */

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
    if (!teach) return;
    more.replaceChildren(...[
      seg('Click', ['Off', 'On'], () => +st.click, (i) => restartIfPlaying(() => { st.click = !!i; })),
      seg('Count in', ['Off', 'On'], () => +st.countIn, (i) => { st.countIn = !!i; }),
      seg('Names', ['Off', 'ABC', 'Do re mi', 'Fingers'], () => st.names, (i) => { st.names = i; drawLayer(); }),
      seg('Colours', ['Off', 'On'], () => +st.colors, (i) => { st.colors = !!i; restartIfPlaying(render); }),
      stepper('Transpose', () => (st.transpose > 0 ? `+${st.transpose}` : String(st.transpose)), (d) => {
        st.transpose = Math.max(-12, Math.min(12, st.transpose + d));
        restartIfPlaying(render);
      }),
      sections.length ? el('div', { class: 'secs' }, sections.map((x, i) => el('div', { class: 'prow' },
        el('input', { value: x[0], maxLength: 30, 'aria-label': 'Section name', oninput: (e) => { x[0] = e.target.value; drawLayer(); } }),
        el('span', { class: 'bars' }, x[1] === x[2] ? String(x[1]) : `${x[1]}–${x[2]}`),
        el('button', { 'aria-label': 'Remove section', onclick: () => { sections.splice(i, 1); st.section = -1; st.loop = null; drawLayer(); fillMore(); } }, '×')))) : null,
      staves.length > 1 ? el('div', { class: 'parts' }, staves.map((s) => el('div', { class: 'prow' },
        el('span', { textContent: s.name }),
        el('div', { class: 'seg' },
          el('button', { 'aria-label': 'Sound', 'aria-pressed': String(!st.muted.has(s.id)), onclick: () => toggleMute(s.id) }, st.muted.has(s.id) ? '🔇' : '🔊'),
          el('button', { 'aria-label': 'Show', 'aria-pressed': String(!st.hidden.has(s.id)), onclick: () => {
            if (st.hidden.has(s.id)) st.hidden.delete(s.id);
            else if (st.hidden.size < staves.length - 1) st.hidden.add(s.id);
            restartIfPlaying(render);
            fillMore();
          } }, '👁'))))) : null,
    ].filter(Boolean));
  }

  /* The settings the student starts with (sections, speed range and the
     rest are edited beside the piece in the studio). */
  function currentSetup() {
    const out = { ...setup };
    for (const k of ['s', 'k', 'n', 'c', 'x', 'ci', 'm', 'h', 'f', 'sec', 'iso']) delete out[k];
    if (st.speed !== 100) out.s = st.speed;
    if (st.transpose) out.k = st.transpose;
    if (st.names) out.n = st.names;
    if (st.colors) out.c = 1;
    if (st.click) out.x = 1;
    if (!st.countIn) out.ci = 0;
    if (st.muted.size) out.m = [...st.muted];
    if (st.hidden.size) out.h = [...st.hidden];
    if (Object.keys(st.fingers).length) out.f = { ...st.fingers };
    const sec = sections.filter((x) => x[0].trim());
    if (sec.length) out.sec = sec.map(([n, a, b]) => [n.trim(), a, b]);
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
  makeKeys();
  lastW = scroller.clientWidth;
  render();
  drawLayer();
  if (!noScore) ro.observe(scroller);
  return { close, play, pause, bars: () => osmd.Sheet.SourceMeasures.map((sm) => sm.MeasureNumber) };
}
