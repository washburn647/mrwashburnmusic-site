// Radio: a tuning dial over internet radio stations. Everything stays in this browser.
(() => {
  'use strict';

  const LO = 87.5, HI = 108.0;
  const ON = 0.05;     // tuned right on: the readout shows the station's number and name, the
                       // meter is full, and only that station plays
  const SETTLE = 5000; // ms after the last turn before stations loaded ahead are let go
  const HEAR = 0.6;    // MHz either side where it starts to bleed through the static
  const AHEAD = 1.6;   // MHz either side where it starts loading, when "Load nearby stations" is on
  const MAXCH = 3;     // streams open at once
  const WHEEL_PX = 140; // a tuning wheel moves this many pixels per MHz
  const KNOB_DEG = 180; // the tuning knob turns this many degrees per MHz
  const NOTCH = 60;     // scroll distance (px) per tenth, so a fast scroll can't outrun the loading
  const KEY = 'mwm-radio';
  const SKINS = { antique: '#3A2617', atomic: '#7FC8BC', eighties: '#14121C', modern: '#F6F1E4' };
  const OPTS = { tuner: 'knob', static: 0.7, chatter: true, scanWait: 7, ahead: true, tag: 'tuning' };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1 = (f) => Math.round(f * 10) / 10;
  const fmt = (f) => r1(f).toFixed(1);
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- saved state ----------
  let state = null;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* private window */ }
  // The station library (Kyle's picks and the rest, by genre) comes from stations.json, or
  // what Kyle published from the studio. A dial entry from the library carries its id in "cat".
  if (!state || !Array.isArray(state.stations)) state = { stations: [], skin: 'antique', freq: 99.3, vol: 0.6 };
  if ((state.seed || 1) < 2) state.stations = state.stations.filter((s) => String(s.id).startsWith('u'));
  state.seed = 3;
  state.freq = clamp(+state.freq || 99.3, LO, HI);
  state.vol = clamp(state.vol == null ? 0.6 : +state.vol, 0, 1);
  if (!SKINS[state.skin]) state.skin = 'antique';
  state.opts = { ...OPTS, ...(state.opts || {}) };
  const opts = state.opts;
  delete opts.shape;
  if (!['knob', 'across', 'updown'].includes(opts.tuner)) opts.tuner = 'knob';
  if (!['off', 'tuning', 'always'].includes(opts.tag)) opts.tag = 'tuning';
  // a phone on "save data" gets no loading ahead
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }, 300);
  }

  // ---------- elements ----------
  const radio = $('radio'), scale = $('scale'), needle = $('needle'), dial = $('dial');
  const freqEl = $('freq'), nameEl = $('name'), meter = $('meter');
  const powerBtn = $('power'), scanBtn = $('scan'), tuneKnob = $('tune'), volKnob = $('vol');
  const bars = [...meter.querySelectorAll('i')];
  // the number on the needle (Options: off, while tuning, always)
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.setAttribute('aria-hidden', 'true');
  needle.appendChild(tag);
  dial.dataset.tag = opts.tag;
  let tagTimer = 0;
  function showTag() {
    dial.dataset.tag = opts.tag;
    if (opts.tag !== 'tuning') return;
    dial.classList.add('tuning');
    clearTimeout(tagTimer);
    tagTimer = setTimeout(() => dial.classList.remove('tuning'), 1500);
  }

  // ---------- dial ----------
  const pct = (f) => ((f - LO) / (HI - LO)) * 100;
  function piece(cls, f, label) {
    const arm = document.createElement('span');
    arm.className = 'arm ' + cls;
    arm.style.left = pct(f) + '%';
    const t = document.createElement('span');
    t.className = 'pip';
    if (label) {
      const n = document.createElement('b');
      n.textContent = label;
      t.appendChild(n);
    }
    arm.appendChild(t);
    return arm;
  }
  for (let f = 88; f <= 108; f++) scale.appendChild(piece(f % 4 === 0 ? 'tick major' : 'tick', f, f % 4 === 0 ? String(f) : ''));
  for (let f = 88.5; f < 108; f++) scale.appendChild(piece('tick minor', f));
  function drawMarks() {
    scale.querySelectorAll('.mark').forEach((m) => m.remove());
    for (const s of state.stations) scale.appendChild(piece('mark', s.freq));
  }

  // ---------- sound ----------
  // Every stream runs through Web Audio (the stations send CORS headers), so each can be
  // muffled, faded and mixed with the static. A stream without CORS falls back to plain volume.
  let ctx = null, master = null, noiseGain = null, chatterBus = null, whistle = null, whistleGain = null, noiseBuf = null;
  let on = false;
  let best = 0;                 // clearest station sounding right now, 0..1
  let noiseLevel = 0;           // how much static is showing, 0..1
  const chans = new Map();      // station id -> channel
  const noCors = new Set();     // urls that refused CORS
  const failedUrls = new Set(); // urls that wouldn't play at all this visit

  function startAudio() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = state.vol * state.vol;
    master.connect(ctx.destination);

    // hiss with the odd crackle
    const len = ctx.sampleRate * 3;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.6 + w * 0.4;
      d[i] = Math.random() < 0.0006 ? w * 3.5 : last;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.5;
    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    src.connect(bp).connect(noiseGain).connect(master);
    src.start();

    // chatter: a narrow "radio band" everything faint passes through
    chatterBus = ctx.createGain();
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass'; band.frequency.value = 1500; band.Q.value = 0.8;
    chatterBus.connect(band).connect(master);

    // the whistle you hear sliding past a station
    whistle = ctx.createOscillator();
    whistle.type = 'sine';
    whistleGain = ctx.createGain();
    whistleGain.gain.value = 0;
    whistle.connect(whistleGain).connect(chatterBus);
    whistle.start();
  }

  function makeChan(st) {
    const a = new Audio();
    a.preload = 'auto';
    const ch = { st, url: st.url, a, ready: false, seen: performance.now(), node: null, g: null, lp: null, hp: null };
    const routed = ctx && !noCors.has(st.url);
    if (routed) {
      a.crossOrigin = 'anonymous';
      ch.node = ctx.createMediaElementSource(a);
      ch.hp = ctx.createBiquadFilter(); ch.hp.type = 'highpass'; ch.hp.frequency.value = 350;
      ch.lp = ctx.createBiquadFilter(); ch.lp.type = 'lowpass'; ch.lp.frequency.value = 800;
      ch.g = ctx.createGain(); ch.g.gain.value = 0;
      ch.node.connect(ch.hp).connect(ch.lp).connect(ch.g).connect(master);
    } else {
      a.muted = true;
    }
    a.addEventListener('playing', () => { ch.ready = true; });
    a.addEventListener('waiting', () => { ch.ready = false; });
    a.addEventListener('error', () => {
      if (!a.getAttribute('src')) return;
      dropChan(ch);
      if (routed) noCors.add(ch.url);       // try again without Web Audio
      else failedUrls.add(ch.url);
      paint();
    });
    a.src = st.url;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    chans.set(st.id, ch);
    return ch;
  }
  function dropChan(ch) {
    if (chans.get(ch.st.id) === ch) chans.delete(ch.st.id);
    ch.ready = false;
    try { ch.a.pause(); ch.a.removeAttribute('src'); ch.a.load(); } catch (e) { /* ignore */ }
    if (ch.node) { try { ch.g.disconnect(); ch.node.disconnect(); } catch (e) { /* ignore */ } }
  }
  function dropAll() { [...chans.values()].forEach(dropChan); }

  // where the dial is heading, so those stations load early
  let glideTarget = null, scanNext = null;

  function engine() {
    if (!on) return;
    const now = performance.now();
    const f = state.freq;
    // what to keep open, most wanted first: where the needle is heading, where it is,
    // the next stop on a scan, the next station each way (for the seek buttons), then anything close
    const live = state.stations.filter((s) => !failedUrls.has(s.url));
    const dist = (s, x) => Math.abs(s.freq - x);
    const pick = [];
    const add = (s) => { if (s && !pick.includes(s)) pick.push(s); };
    const closest = (x, within) => live.filter((s) => dist(s, x) < within).sort((a, b) => dist(a, x) - dist(b, x))[0];
    if (glideTarget != null) add(closest(glideTarget, 0.05));
    add(closest(f, HEAR));
    // parked on a station: keep only that stream open, to save data
    const parked = glideTarget == null && !scanning && now - lastTurn > SETTLE && closest(f, ON);
    if (opts.ahead && !saveData && !parked) {
      if (scanNext) add(scanNext);
      add(nextStation(1, f, live)); add(nextStation(-1, f, live));
      live.filter((s) => dist(s, f) < AHEAD).sort((a, b) => dist(a, f) - dist(b, f)).forEach(add);
    }
    const near = pick.slice(0, MAXCH).map((s) => ({ s }));
    for (const { s } of near) {
      let ch = chans.get(s.id);
      if (ch && ch.url !== s.url) { dropChan(ch); ch = null; }
      if (!ch) ch = makeChan(s);
      ch.seen = now;
    }
    for (const ch of [...chans.values()]) {
      if (now - ch.seen > 4000 || !state.stations.includes(ch.st)) dropChan(ch);
    }

    best = 0;
    const t = ctx ? ctx.currentTime : 0;
    // right on a station: that one alone, nothing bleeding in from its neighbours
    const lock = closest(f, ON);
    for (const ch of chans.values()) {
      const d = Math.abs(f - ch.st.freq);
      let c = d < ON ? 1 : clamp(1 - (d - ON) / (HEAR - ON), 0, 1);
      if (!ch.ready || (lock && ch.st !== lock)) c = 0;
      best = Math.max(best, c);
      // half-tuned stations fade in and out
      const flutter = c > 0 && c < 0.95 ? 1 - (1 - c) * 0.6 * Math.random() : 1;
      const g = Math.pow(c, 1.6) * flutter;
      if (ch.node) {
        ch.g.gain.setTargetAtTime(g, t, 0.05);
        ch.lp.frequency.setTargetAtTime(700 + 15000 * Math.pow(c, 3), t, 0.05);
        ch.hp.frequency.setTargetAtTime(20 + 400 * (1 - c), t, 0.05);
      } else {
        ch.a.muted = g < 0.05;
        try { ch.a.volume = clamp(g * state.vol * state.vol, 0, 1); } catch (e) { /* iOS */ }
      }
    }

    noiseLevel = 1 - best * 0.96;
    if (noiseGain) noiseGain.gain.setTargetAtTime(opts.static * 0.22 * noiseLevel, t, 0.04);

    // whistle sliding past the nearest loaded station
    if (whistleGain) {
      let wd = Infinity;
      for (const ch of chans.values()) if (ch.ready) wd = Math.min(wd, Math.abs(f - ch.st.freq));
      const w = opts.chatter && wd > 0.04 && wd < HEAR ? (1 - wd / HEAR) : 0;
      if (isFinite(wd)) whistle.frequency.setTargetAtTime(180 + wd * 5200, t, 0.03);
      whistleGain.gain.setTargetAtTime(0.012 * w * opts.static, t, 0.05);
    }
    paintSignal();
  }
  setInterval(engine, 80);

  // ---------- chatter: faint, broken bits of other broadcasts ----------
  function ghostVoice(t0, amp) {
    const dur = rand(0.5, 1.6);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 7;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 9;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f1).connect(g); src.connect(f2).connect(g); g.connect(chatterBus);
    let t = t0;
    while (t < t0 + dur) {
      const syl = rand(0.06, 0.2);
      f1.frequency.setValueAtTime(rand(350, 900), t);
      f2.frequency.setValueAtTime(rand(1100, 2600), t);
      g.gain.setTargetAtTime(amp * rand(0.4, 1), t, 0.012);
      g.gain.setTargetAtTime(0, t + syl, 0.02);
      t += syl + rand(0.02, 0.1);
    }
    src.start(t0, rand(0, 2));
    src.stop(t + 0.2);
  }
  function morse(t0, amp) {
    const o = ctx.createOscillator(); o.frequency.value = rand(550, 950);
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g).connect(chatterBus);
    let t = t0;
    const n = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const len = Math.random() < 0.5 ? 0.06 : 0.18;
      g.gain.setTargetAtTime(amp, t, 0.004);
      g.gain.setTargetAtTime(0, t + len, 0.004);
      t += len + 0.07;
    }
    o.start(t0); o.stop(t + 0.1);
  }
  function chirp(t0, amp) {
    const o = ctx.createOscillator(); o.type = 'triangle';
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g).connect(chatterBus);
    const up = Math.random() < 0.5;
    o.frequency.setValueAtTime(up ? 300 : 2600, t0);
    o.frequency.exponentialRampToValueAtTime(up ? 2200 : 260, t0 + rand(0.12, 0.35));
    g.gain.setTargetAtTime(amp, t0, 0.01);
    g.gain.setTargetAtTime(0, t0 + 0.25, 0.04);
    o.start(t0); o.stop(t0 + 0.6);
  }
  function burst(t0, amp) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(g).connect(chatterBus);
    const n = 2 + Math.floor(Math.random() * 4);
    let t = t0;
    for (let i = 0; i < n; i++) {
      g.gain.setTargetAtTime(amp, t, 0.003);
      g.gain.setTargetAtTime(0, t + 0.02, 0.01);
      t += rand(0.04, 0.12);
    }
    src.start(t0, rand(0, 2)); src.stop(t + 0.1);
  }
  setInterval(() => {
    if (!on || !ctx || !opts.chatter || document.hidden) return;
    if (noiseLevel < 0.45 || Math.random() > 0.16) return;
    const amp = opts.static * noiseLevel;
    const t = ctx.currentTime + 0.02;
    const r = Math.random();
    if (r < 0.42) ghostVoice(t, amp * 1.6);
    else if (r < 0.6) morse(t, amp * 0.05);
    else if (r < 0.85) chirp(t, amp * 0.04);
    else burst(t, amp * 0.5);
  }, 350);

  // ---------- drawing ----------
  function paintSignal() {
    const ch = nearestChan();
    const shown = on ? Math.max(best, ch ? 0.3 * clamp(1 - Math.abs(state.freq - ch.st.freq) / HEAR, 0, 1) : 0) : 0;
    meter.style.setProperty('--s', shown.toFixed(3));
    bars.forEach((b, i) => b.classList.toggle('lit', shown > i / 5 + 0.02));
    paintName();
  }
  function nearestChan() {
    let bestCh = null, bd = Infinity;
    for (const ch of chans.values()) {
      const d = Math.abs(ch.st.freq - state.freq);
      if (d < bd) { bd = d; bestCh = ch; }
    }
    return bestCh;
  }
  function nearest(f) {
    let st = null, bd = Infinity;
    for (const s of state.stations) {
      const d = Math.abs(s.freq - f);
      if (d < bd) { bd = d; st = s; }
    }
    return { st, d: bd };
  }
  let mediaFor = null;
  function paintName() {
    const { st, d } = nearest(state.freq);
    let name = '', here = null;
    if (on && st && d < ON) {
      here = st;
      name = failedUrls.has(st.url) ? 'No signal' : st.name;
    }
    if (nameEl.textContent !== name) nameEl.textContent = name;
    if (here !== mediaFor) { mediaFor = here; setMedia(here); }
  }
  function paint() {
    const f = state.freq;
    needle.style.left = pct(f) + '%';
    tuneKnob.style.setProperty('--off', ((f - LO) * WHEEL_PX).toFixed(1) + 'px');
    tuneKnob.style.setProperty('--a', ((f - LO) * KNOB_DEG) + 'deg');
    if (tag) tag.textContent = fmt(f);
    tuneKnob.setAttribute('aria-valuenow', fmt(f));
    tuneKnob.setAttribute('aria-valuetext', fmt(f) + ' FM');
    volKnob.style.setProperty('--a', (-135 + state.vol * 270) + 'deg');
    volKnob.setAttribute('aria-valuenow', Math.round(state.vol * 100));
    freqEl.textContent = fmt(f);
    radio.classList.toggle('on', on);
    paintName();
  }

  // ---------- tuning ----------
  let glide = 0, lastTurn = 0;
  function setFreq(f) {
    state.freq = clamp(f, LO, HI);
    lastTurn = performance.now();
    showTag();
    save(); paint();
  }
  // let go of the dial: it rests on the nearest tenth, wherever the stations are
  function settle() { setFreq(r1(state.freq)); }
  function stopGlide() { cancelAnimationFrame(glide); glide = 0; glideTarget = null; }
  function glideTo(target, done) {
    stopGlide();
    glideTarget = target;
    engine();                         // start loading the station now, while the needle travels
    const from = state.freq, t0 = performance.now();
    const ms = clamp(Math.abs(target - from) * 90, 300, 1100);
    const step = (now) => {
      const k = clamp((now - t0) / ms, 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setFreq(from + (target - from) * e);
      if (k < 1) glide = requestAnimationFrame(step);
      else { glide = 0; glideTarget = null; if (done) done(); }
    };
    glide = requestAnimationFrame(step);
  }
  function nextStation(dir, from, among) {
    const list = [...(among || state.stations)].sort((a, b) => a.freq - b.freq);
    if (!list.length) return null;
    let next = dir > 0 ? list.find((s) => s.freq > from + 0.05) : [...list].reverse().find((s) => s.freq < from - 0.05);
    if (!next) next = dir > 0 ? list[0] : list[list.length - 1];
    return next;
  }
  function seek(dir, done) {
    const next = nextStation(dir, state.freq);
    if (next) glideTo(next.freq, done);
  }

  // scan: the button's needle crosses while it waits on a station, then moves on
  let scanning = false, scanFrame = 0;
  function setScan(v) {
    scanning = v;
    cancelAnimationFrame(scanFrame);
    scanNext = null;
    scanBtn.setAttribute('aria-pressed', String(v));
    scanBtn.style.setProperty('--p', 0);
    if (v) { if (!on) power(true); scanStep(); }
  }
  function scanStep() {
    if (!scanning) return;
    scanBtn.style.setProperty('--p', 0);
    seek(1, () => {
      if (!scanning) return;
      const t0 = performance.now();
      if (opts.ahead) scanNext = nextStation(1, state.freq);
      const wait = opts.scanWait * 1000;
      const tick = (now) => {
        if (!scanning) return;
        const p = clamp((now - t0) / wait, 0, 1);
        scanBtn.style.setProperty('--p', p.toFixed(4));
        if (p < 1) scanFrame = requestAnimationFrame(tick);
        else { scanNext = null; scanStep(); }
      };
      scanFrame = requestAnimationFrame(tick);
    });
  }
  function userTouch() { stopGlide(); if (scanning) setScan(false); }

  // ---------- knobs ----------
  // A knob turns; a wheel (across or up and down) is pushed along like a thumbwheel.
  function knob(el, onTurn, onKey, onEnd, axis) {
    let last = null;
    const angle = (e) => {
      const ax = axis && axis();
      if (ax === 'x') return e.clientX * KNOB_DEG / WHEEL_PX;
      if (ax === 'y') return -e.clientY * KNOB_DEG / WHEEL_PX;
      const r = el.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      last = angle(e);
      el.classList.add('grab');
    });
    el.addEventListener('pointermove', (e) => {
      if (last == null) return;
      const a = angle(e);
      let d = a - last;
      if (!(axis && axis())) {
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
      }
      last = a;
      onTurn(d);
    });
    const end = () => { if (last == null) return; last = null; el.classList.remove('grab'); if (onEnd) onEnd(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => scrolled(e, onKey), { passive: false });
    el.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'ArrowRight') onKey(1, false);
      else if (k === 'ArrowDown' || k === 'ArrowLeft') onKey(-1, false);
      else if (k === 'PageUp') onKey(1, true);
      else if (k === 'PageDown') onKey(-1, true);
      else return;
      e.preventDefault();
    });
  }

  // A scroll moves a tenth per notch of a mouse wheel; a trackpad's many small deltas add up
  // to the same, so a flick can't race past stations faster than they load.
  let scrollAcc = 0, scrollAt = 0;
  function scrolled(e, onKey) {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
    const dy = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    const now = performance.now();
    if (now - scrollAt > 300) scrollAcc = 0;
    scrollAt = now;
    scrollAcc += dy;
    // one wheel notch (about 100 px) is always at least a tenth
    if (Math.abs(dy) >= NOTCH) { scrollAcc = 0; onKey(dy < 0 ? 1 : -1, false); return; }
    while (Math.abs(scrollAcc) >= NOTCH) {
      const dir = scrollAcc < 0 ? 1 : -1;
      scrollAcc += dir * NOTCH;
      onKey(dir, false);
    }
  }
  knob(tuneKnob,
    (d) => { userTouch(); setFreq(state.freq + d / KNOB_DEG); },
    (dir, big) => { userTouch(); setFreq(r1(state.freq) + dir * (big ? 1 : 0.1)); },
    settle,
    () => (opts.tuner === 'across' ? 'x' : opts.tuner === 'updown' ? 'y' : null));
  function setTuner() {
    document.body.dataset.tuner = opts.tuner;
    tuneKnob.classList.toggle('wheel', opts.tuner !== 'knob');
    tuneKnob.setAttribute('aria-orientation', opts.tuner === 'updown' ? 'vertical' : 'horizontal');
  }
  function setVol(v) {
    state.vol = clamp(v, 0, 1);
    if (master) master.gain.setTargetAtTime(state.vol * state.vol, ctx.currentTime, 0.02);
    save(); paint();
  }
  knob(volKnob,
    (d) => setVol(state.vol + d / 270),
    (dir, big) => setVol(state.vol + dir * (big ? 0.2 : 0.05)));

  // drag along the dial itself
  let dialDrag = false;
  const dialFreq = (e) => {
    const r = scale.getBoundingClientRect();
    return LO + clamp((e.clientX - r.left) / r.width, 0, 1) * (HI - LO);
  };
  dial.addEventListener('pointerdown', (e) => {
    dialDrag = true; userTouch();
    dial.setPointerCapture(e.pointerId);
    setFreq(dialFreq(e));
  });
  dial.addEventListener('pointermove', (e) => { if (dialDrag) setFreq(dialFreq(e)); });
  const dialEnd = () => { if (dialDrag) { dialDrag = false; settle(); } };
  dial.addEventListener('wheel', (e) => scrolled(e, (dir) => { userTouch(); setFreq(r1(state.freq) + dir * 0.1); }), { passive: false });
  dial.addEventListener('pointerup', dialEnd);
  dial.addEventListener('pointercancel', dialEnd);

  // ---------- power and buttons ----------
  function power(v) {
    on = v;
    powerBtn.setAttribute('aria-pressed', String(on));
    if (on) {
      startAudio();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      engine();
    } else {
      setScan(false);
      dropAll();
      best = 0; noiseLevel = 0;
      if (noiseGain) noiseGain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      if (whistleGain) whistleGain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      paintSignal();
    }
    paint();
  }
  powerBtn.addEventListener('click', () => power(!on));
  scanBtn.addEventListener('click', () => setScan(!scanning));
  $('up').addEventListener('click', () => { userTouch(); if (!on) power(true); seek(1); });
  $('down').addEventListener('click', () => { userTouch(); if (!on) power(true); seek(-1); });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, dialog, [role=slider]')) return;
    if (e.key === ' ') { e.preventDefault(); power(!on); }
    else if (e.key === 'ArrowRight') { userTouch(); seek(1); }
    else if (e.key === 'ArrowLeft') { userTouch(); seek(-1); }
  });

  function setMedia(st) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = st && window.MediaMetadata
        ? new MediaMetadata({ title: st.name, artist: fmt(st.freq) + ' FM' }) : null;
    } catch (e) { /* ignore */ }
  }
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const set = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) { /* unsupported */ } };
    set('play', () => power(true));
    set('pause', () => power(false));
    set('stop', () => power(false));
    set('nexttrack', () => { userTouch(); seek(1); });
    set('previoustrack', () => { userTouch(); seek(-1); });
  }

  // ---------- skins ----------
  const skinBtns = [...document.querySelectorAll('.skins [data-skin]')];
  function setSkin(s) {
    state.skin = s;
    document.body.dataset.skin = s;
    skinBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.skin === s)));
    document.querySelector('meta[name=theme-color]').content = SKINS[s];
    save();
  }
  skinBtns.forEach((b) => b.addEventListener('click', () => setSkin(b.dataset.skin)));

  // ---------- options ----------
  const optDlg = $('opts');
  $('openOpts').addEventListener('click', () => { paintOpts(); optDlg.showModal(); });
  $('closeOpts').addEventListener('click', () => optDlg.close());
  optDlg.addEventListener('click', (e) => { if (e.target === optDlg) optDlg.close(); });
  const segs = [...optDlg.querySelectorAll('[data-opt]')];
  function paintOpts() {
    for (const el of segs) {
      const k = el.dataset.opt;
      if (el.type === 'range') { el.value = opts[k]; continue; }
      el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(String(opts[k]) === b.dataset.v)));
    }
  }
  for (const el of segs) {
    const k = el.dataset.opt;
    if (el.type === 'range') {
      el.addEventListener('input', () => { opts[k] = +el.value; save(); engine(); });
      continue;
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const v = b.dataset.v;
      opts[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
      save(); paintOpts();
      if (k === 'tuner') setTuner();
      if (k === 'tag') showTag();
      engine();
    });
  }

  // ---------- station list ----------
  const dlg = $('list'), ul = $('stations'), form = $('add'), err = $('err');
  $('open').addEventListener('click', () => { renderList(); renderLibrary(); dlg.showModal(); });
  $('close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  // ---------- library ----------
  let catalog = null;
  const libUl = $('library'), chips = $('genres');
  const PICKS = 'picks';
  const onDial = (id) => state.stations.find((d) => d.cat === id);
  // a spot at least `gap` MHz from every other station, as near to f as there is
  function freeNear(f, gap) {
    const taken = (x) => state.stations.some((s) => Math.abs(s.freq - x) < gap);
    if (f && !taken(f)) return r1(f);
    const start = f || 98;
    for (let k = 1; k < 120; k++) {
      for (const x of [start + k * 0.2, start - k * 0.2]) if (x > LO + 0.3 && x < HI - 0.1 && !taken(x)) return r1(x);
    }
    return r1(start);
  }
  // Kyle's picks keep the spot he gave them unless it is taken; the rest keep clear of their neighbours
  function addFromCat(s, pick) {
    const d = { id: 'c:' + s.id, cat: s.id, name: s.name, url: s.url, freq: s.freq ? freeNear(s.freq, pick ? 0.15 : 0.35) : autoFreq(s.url) };
    state.stations.push(d);
    return d;
  }
  function syncCatalog(c) {
    catalog = c;
    const byId = new Map(c.stations.map((s) => [s.id, s]));
    const byUrl = new Map(c.stations.map((s) => [s.url, s]));
    for (const d of state.stations) {
      if (!d.cat && byUrl.has(d.url)) d.cat = byUrl.get(d.url).id;      // dials from before the library
      if (d.cat && byId.has(d.cat)) d.url = byId.get(d.cat).url;        // links Kyle fixes reach every dial
    }
    // each of Kyle's picks lands on the dial once; one taken off stays off
    const first = !Array.isArray(state.seen);
    const seen = new Set(state.seen || []);
    if (first) state.stations.forEach((d) => { if (d.cat) seen.add(d.cat); });
    for (const id of c.picks) {
      if (seen.has(id)) continue;
      seen.add(id);
      const s = byId.get(id);
      if (s && !onDial(id)) addFromCat(s, true);
    }
    state.seen = [...seen];
    changed();
  }
  async function loadCatalog() {
    const get = async (u) => {
      const r = await fetch(u, { cache: 'no-cache', credentials: 'omit' });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      if (!j || !Array.isArray(j.stations) || !Array.isArray(j.picks)) throw new Error('shape');
      return j;
    };
    let c = null;
    try { c = await get('/api/live/radio.json'); } catch (e) {
      try { c = await get('stations.json'); } catch (x) { /* offline: keep the dial as it is */ }
    }
    if (c) syncCatalog(c);
  }
  function renderLibrary() {
    if (!catalog) { libUl.textContent = ''; chips.textContent = ''; return; }
    const tabs = [[PICKS, 'Kyle’s picks'], ...(catalog.genres || []).map((g) => [g, g])];
    if (!tabs.some(([k]) => k === state.lib)) state.lib = PICKS;
    chips.textContent = '';
    for (const [k, label] of tabs) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.setAttribute('aria-pressed', String(k === state.lib));
      b.addEventListener('click', () => { state.lib = k; save(); renderLibrary(); });
      chips.appendChild(b);
    }
    const byId = new Map(catalog.stations.map((s) => [s.id, s]));
    const list = state.lib === PICKS
      ? catalog.picks.map((id) => byId.get(id)).filter(Boolean)
      : catalog.stations.filter((s) => s.genre === state.lib);
    libUl.textContent = '';
    for (const s of list) {
      const li = document.createElement('li');
      const there = onDial(s.id);
      const info = document.createElement('div');
      const b = document.createElement('b'); b.textContent = s.name;
      const sm = document.createElement('small');
      sm.textContent = [there ? fmt(there.freq) : s.freq ? fmt(s.freq) : '', s.where].filter(Boolean).join(' · ');
      info.append(b, sm);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = there ? 'have' : 'plus';
      btn.textContent = there ? '✓' : '+';
      btn.setAttribute('aria-label', (there ? 'Tune to ' : 'Add ') + s.name);
      btn.addEventListener('click', () => {
        const d = onDial(s.id) || addFromCat(s);
        changed(); renderList(); renderLibrary();
        if (there) { userTouch(); if (!on) power(true); glideTo(d.freq); dlg.close(); }
      });
      li.append(info, btn);
      libUl.appendChild(li);
    }
  }

  function clashes(s) {
    return state.stations.some((o) => o !== s && Math.abs(o.freq - s.freq) < 0.15);
  }
  function changed() { save(); drawMarks(); paint(); engine(); }

  function renderList() {
    ul.textContent = '';
    const list = [...state.stations].sort((a, b) => a.freq - b.freq);
    for (const s of list) {
      const li = document.createElement('li');
      li.classList.toggle('clash', clashes(s));
      li.classList.toggle('here', Math.abs(s.freq - state.freq) < ON);

      const go = document.createElement('button');
      go.className = 'go'; go.type = 'button';
      go.setAttribute('aria-label', 'Tune to ' + s.name);
      go.textContent = '▶';
      go.addEventListener('click', () => {
        userTouch(); if (!on) power(true);
        glideTo(s.freq); dlg.close();
      });

      const f = document.createElement('input');
      f.type = 'number'; f.min = LO; f.max = HI; f.step = 0.1; f.value = fmt(s.freq);
      f.className = 'f'; f.setAttribute('aria-label', 'Frequency');
      f.addEventListener('change', () => {
        const v = parseFloat(f.value);
        if (!isNaN(v)) s.freq = r1(clamp(v, LO, HI));
        changed(); renderList();
      });

      const n = document.createElement('input');
      n.value = s.name; n.maxLength = 40; n.className = 'n';
      n.setAttribute('aria-label', 'Name');
      n.addEventListener('input', () => { s.name = n.value.trim() || s.name; save(); paint(); });

      const rm = document.createElement('button');
      rm.className = 'rm'; rm.type = 'button';
      rm.setAttribute('aria-label', 'Remove ' + s.name);
      rm.textContent = '✕';
      rm.addEventListener('click', () => {
        state.stations = state.stations.filter((o) => o !== s);
        const ch = chans.get(s.id);
        if (ch) dropChan(ch);
        changed(); renderList(); renderLibrary();
      });

      li.append(go, f, n, rm);
      ul.appendChild(li);
    }
  }

  // a free spot near where this link hashes to
  function autoFreq(url) {
    let h = 0;
    for (const c of url) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const slots = 100;   // 88.1 .. 107.9, odd tenths
    for (let k = 0; k < slots; k++) {
      const f = r1(88.1 + ((h + k) % slots) * 0.2);
      if (!state.stations.some((s) => Math.abs(s.freq - f) < 0.45)) return f;
    }
    return r1(88.1 + (h % slots) * 0.2);
  }

  // The page may only fetch from this site, so playlist files (.pls, .m3u) can't be read here.
  function resolve(raw) {
    let u;
    try { u = new URL(raw.trim()); } catch (e) { throw new Error('That doesn’t look like a link.'); }
    if (u.protocol === 'http:') u.protocol = 'https:';
    if (u.protocol !== 'https:') throw new Error('That doesn’t look like a link.');
    if (/\.(pls|m3u)$/i.test(u.pathname)) throw new Error('Open that file in a text editor and copy the link inside it.');
    return u.href;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    err.textContent = '';
    const fd = new FormData(form);
    let url;
    try { url = resolve(String(fd.get('url') || '')); } catch (x) { err.textContent = x.message; return; }
    const fv = parseFloat(fd.get('freq'));
    const freq = isNaN(fv) ? autoFreq(url) : r1(clamp(fv, LO, HI));
    let name = String(fd.get('name') || '').trim();
    if (!name) name = new URL(url).hostname.replace(/^www\./, '').split('.')[0];
    const st = { id: 'u' + Date.now().toString(36), name, url, freq };
    const known = catalog && catalog.stations.find((s) => s.url === url);
    if (known) st.cat = known.id;
    failedUrls.delete(url);
    state.stations.push(st);
    form.reset();
    changed(); renderList();
    dlg.close();
    userTouch(); if (!on) power(true);
    glideTo(freq);
  });

  // ---------- start ----------
  setSkin(state.skin);
  drawMarks();
  setTuner();
  paint();
  paintSignal();
  loadCatalog();
})();
