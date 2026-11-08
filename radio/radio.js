// Radio: a tuning dial over internet radio stations. Everything stays in this browser.
(() => {
  'use strict';

  const LO = 87.5, HI = 108.0;
  const LOCK = 0.25;   // MHz either side of a station where its name shows
  const HEAR = 0.6;    // MHz either side where it starts to bleed through the static
  const AHEAD = 1.6;   // MHz either side where it starts loading, when "Load nearby stations" is on
  const MAXCH = 3;     // streams open at once
  const KEY = 'mwm-radio';
  // Kyle's stations (from his dashboard), at their real FM numbers where they have one.
  const SEED = 2;
  const DEFAULTS = [
    { name: 'Groove Salad', freq: 88.5, url: 'https://ice2.somafm.com/groovesalad-128-mp3' },
    { name: 'WGDR', freq: 91.1, url: 'https://wgdr.broadcasttool.stream/wgdr_128' },
    { name: 'Black Sheep', freq: 91.5, url: 'https://wool.broadcasttool.stream/stream' },
    { name: 'VPR Jazz', freq: 93.3, url: 'https://vprjazz.streamguys1.com/vprjazz64.aac' },
    { name: 'WDEV', freq: 96.1, url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WDEVFM.mp3' },
    { name: 'Royalton', freq: 96.5, url: 'https://royaltonradio.streamguys1.com/live' },
    { name: 'VPR Classical', freq: 99.3, url: 'https://vprclassical.streamguys1.com/vprclassical128.mp3' },
    { name: 'Classic Hits', freq: 101.7, url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WCVTFM.mp3' },
    { name: 'WXGR', freq: 103.5, url: 'https://sh.fl-us.audio-stream.com/proxy/seacoast?mp=/stream' },
    { name: 'BBC World Service', freq: 105.3, url: 'https://vprbbc.streamguys1.com/vprbbc24.mp3' },
    { name: 'VPR News', freq: 107.9, url: 'https://vpr.streamguys1.com/vpr96.mp3' },
  ];
  const SKINS = { antique: '#3A2617', atomic: '#7FC8BC', eighties: '#14121C', modern: '#F6F1E4' };
  const OPTS = { shape: 'h', static: 0.7, chatter: true, scanWait: 7, ahead: true };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1 = (f) => Math.round(f * 10) / 10;
  const fmt = (f) => r1(f).toFixed(1);
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- saved state ----------
  let state = null;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* private window */ }
  const seeded = () => DEFAULTS.map((s, i) => ({ id: 's' + SEED + '-' + i, ...s }));
  if (!state || !Array.isArray(state.stations)) {
    state = { stations: seeded(), skin: 'antique', freq: 99.3, vol: 0.6, seed: SEED };
  } else if ((state.seed || 1) < SEED) {
    // new built-in stations replace the old built-in ones; the listener's own stay
    state.stations = seeded().concat(state.stations.filter((s) => String(s.id).startsWith('u')));
    state.seed = SEED;
  }
  state.freq = clamp(+state.freq || 99.3, LO, HI);
  state.vol = clamp(state.vol == null ? 0.6 : +state.vol, 0, 1);
  if (!SKINS[state.skin]) state.skin = 'antique';
  state.opts = { ...OPTS, ...(state.opts || {}) };
  const opts = state.opts;
  if (!['h', 'v', 'round'].includes(opts.shape)) opts.shape = 'h';
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

  // ---------- dial: across, up-down or round ----------
  const pct = (f) => ((f - LO) / (HI - LO)) * 100;
  const ARC = 270;                                   // round dial sweep, degrees
  const ang = (f) => -ARC / 2 + (pct(f) / 100) * ARC;
  function place(el, f) {
    if (opts.shape === 'round') { el.style.cssText = ''; el.style.transform = 'rotate(' + ang(f) + 'deg)'; }
    else if (opts.shape === 'v') { el.style.cssText = ''; el.style.bottom = pct(f) + '%'; }
    else { el.style.cssText = ''; el.style.left = pct(f) + '%'; }
  }
  function piece(cls, f, label) {
    const arm = document.createElement('span');
    arm.className = 'arm ' + cls;
    const t = document.createElement('span');
    t.className = 'pip';
    if (label) {
      const n = document.createElement('b');
      n.textContent = label;
      if (opts.shape === 'round') n.style.transform = 'rotate(' + (-ang(f)) + 'deg)';
      t.appendChild(n);
    }
    arm.appendChild(t);
    place(arm, f);
    return arm;
  }
  function buildScale() {
    dial.dataset.shape = opts.shape;
    document.body.dataset.dial = opts.shape;
    scale.querySelectorAll('.arm').forEach((m) => m.remove());
    for (let f = 88; f <= 108; f++) scale.appendChild(piece(f % 4 === 0 ? 'tick major' : 'tick', f, f % 4 === 0 ? String(f) : ''));
    for (let f = 88.5; f < 108; f++) scale.appendChild(piece('tick minor', f));
    drawMarks();
    paint();
  }
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
    if (opts.ahead) {
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
    for (const ch of chans.values()) {
      const d = Math.abs(f - ch.st.freq);
      let c = d < 0.08 ? 1 : clamp(1 - (d - 0.08) / (HEAR - 0.08), 0, 1);
      if (!ch.ready) c = 0;
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
    if (on && st && d < LOCK) {
      here = st;
      name = failedUrls.has(st.url) ? 'No signal' : st.name;
    }
    if (nameEl.textContent !== name) nameEl.textContent = name;
    if (here !== mediaFor) { mediaFor = here; setMedia(here); }
  }
  function paint() {
    const f = state.freq;
    place(needle, f);
    tuneKnob.style.setProperty('--a', ((f - LO) * 120) + 'deg');
    tuneKnob.setAttribute('aria-valuenow', fmt(f));
    tuneKnob.setAttribute('aria-valuetext', fmt(f) + ' FM');
    volKnob.style.setProperty('--a', (-135 + state.vol * 270) + 'deg');
    volKnob.setAttribute('aria-valuenow', Math.round(state.vol * 100));
    freqEl.textContent = fmt(f);
    radio.classList.toggle('on', on);
    paintName();
  }

  // ---------- tuning ----------
  let glide = 0;
  function setFreq(f) {
    state.freq = clamp(f, LO, HI);
    save(); paint();
  }
  function snap() {
    const { st, d } = nearest(state.freq);
    setFreq(st && d < LOCK ? st.freq : r1(state.freq));
  }
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
  function knob(el, onTurn, onKey, onEnd) {
    let last = null;
    const angle = (e) => {
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
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      last = a;
      onTurn(d);
    });
    const end = () => { if (last == null) return; last = null; el.classList.remove('grab'); if (onEnd) onEnd(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      onKey(e.deltaY < 0 || e.deltaX < 0 ? 1 : -1, false);
    }, { passive: false });
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

  let wheelSnap = 0;
  knob(tuneKnob,
    (d) => { userTouch(); setFreq(state.freq + d / 120); },
    (dir, big) => {
      userTouch();
      setFreq(r1(state.freq) + dir * (big ? 1 : 0.1));
      clearTimeout(wheelSnap);
      wheelSnap = setTimeout(snap, 400);
    },
    snap);
  function setVol(v) {
    state.vol = clamp(v, 0, 1);
    if (master) master.gain.setTargetAtTime(state.vol * state.vol, ctx.currentTime, 0.02);
    save(); paint();
  }
  knob(volKnob,
    (d) => setVol(state.vol + d / 270),
    (dir, big) => setVol(state.vol + dir * (big ? 0.2 : 0.05)));

  // drag along (or around) the dial itself
  let dialDrag = false;
  const dialFreq = (e) => {
    const r = scale.getBoundingClientRect();
    let k;
    if (opts.shape === 'round') {
      const a = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI;
      k = (clamp(a, -ARC / 2, ARC / 2) + ARC / 2) / ARC;
    } else if (opts.shape === 'v') {
      k = (r.bottom - e.clientY) / r.height;
    } else {
      k = (e.clientX - r.left) / r.width;
    }
    return LO + clamp(k, 0, 1) * (HI - LO);
  };
  dial.addEventListener('pointerdown', (e) => {
    dialDrag = true; userTouch();
    dial.setPointerCapture(e.pointerId);
    setFreq(dialFreq(e));
  });
  dial.addEventListener('pointermove', (e) => { if (dialDrag) setFreq(dialFreq(e)); });
  const dialEnd = () => { if (dialDrag) { dialDrag = false; snap(); } };
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
      if (k === 'shape') buildScale();
      engine();
    });
  }

  // ---------- station list ----------
  const dlg = $('list'), ul = $('stations'), form = $('add'), err = $('err');
  $('open').addEventListener('click', () => { renderList(); dlg.showModal(); });
  $('close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

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
      li.classList.toggle('here', Math.abs(s.freq - state.freq) < LOCK);

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
        changed(); renderList();
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
  buildScale();
  paintSignal();
})();
