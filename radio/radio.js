// Radio: a tuning dial over internet radio stations. Everything stays in this browser.
(() => {
  'use strict';

  const LO = 87.5, HI = 108.0;
  const LOCK = 0.25;            // MHz either side of a station where it comes in
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

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1 = (f) => Math.round(f * 10) / 10;
  const fmt = (f) => r1(f).toFixed(1);

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
  const audio = new Audio();
  audio.preload = 'none';

  // ---------- scale ----------
  const pct = (f) => ((f - LO) / (HI - LO)) * 100;
  for (let f = 88; f <= 108; f++) {
    const t = document.createElement('span');
    t.className = 'tick' + (f % 4 === 0 ? ' major' : '');
    t.style.left = pct(f) + '%';
    if (f % 4 === 0) t.dataset.n = f;
    scale.appendChild(t);
  }
  for (let f = 88.5; f < 108; f++) {
    const t = document.createElement('span');
    t.className = 'tick minor';
    t.style.left = pct(f) + '%';
    scale.appendChild(t);
  }
  function drawMarks() {
    scale.querySelectorAll('.mark').forEach((m) => m.remove());
    for (const s of state.stations) {
      const m = document.createElement('span');
      m.className = 'mark';
      m.style.left = pct(s.freq) + '%';
      scale.appendChild(m);
    }
  }

  // ---------- sound ----------
  let ctx = null, noiseGain = null, on = false;
  let tuned = null;      // station whose stream is loaded
  let playing = false;   // stream is actually sounding
  let failed = null;     // station id that would not play
  let signal = 0;        // 0..1 how close the needle is to a station
  let pendingTimer = 0;

  function startNoise() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.6 + w * 0.4;
      d[i] = (Math.random() < 0.0008 ? w * 3 : last);   // hiss with the odd crackle
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.5;
    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    src.connect(bp).connect(noiseGain).connect(ctx.destination);
    src.start();
  }

  function mix() {
    const sig = on && playing ? signal : 0;
    const v = state.vol * state.vol;      // feels even across the knob
    audio.volume = clamp(v * Math.min(1, sig * 1.15), 0, 1);
    if (noiseGain) {
      const n = on ? v * 0.16 * (1 - sig) : 0;
      noiseGain.gain.setTargetAtTime(n, ctx.currentTime, 0.03);
    }
    const shown = on ? (playing ? signal : signal * 0.35) : 0;
    meter.style.setProperty('--s', shown.toFixed(3));
    bars.forEach((b, i) => b.classList.toggle('lit', shown > i / 5 + 0.02));
  }

  function nearest(f) {
    let best = null, bd = Infinity;
    for (const s of state.stations) {
      const d = Math.abs(s.freq - f);
      if (d < bd) { bd = d; best = s; }
    }
    return { st: best, d: bd };
  }

  function load(st) {
    tuned = st; playing = false; failed = null;
    audio.src = st.url;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
    setMedia(st);
  }
  function unload() {
    tuned = null; playing = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setMedia(null);
  }

  audio.addEventListener('playing', () => { playing = true; mix(); paint(); });
  audio.addEventListener('waiting', () => { playing = false; mix(); });
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return;
    playing = false;
    if (tuned) failed = tuned.id;
    mix(); paint();
  });

  function update() {
    const { st, d } = nearest(state.freq);
    signal = st && d < LOCK ? clamp((1 - d / LOCK) * 1.6, 0, 1) : 0;
    const want = signal > 0 ? st : null;
    if (on && want !== tuned) {
      clearTimeout(pendingTimer);
      if (want) pendingTimer = setTimeout(() => load(want), 150);
      else pendingTimer = setTimeout(unload, 900);
    } else if (on) {
      clearTimeout(pendingTimer);
    }
    mix(); paint();
  }

  // ---------- drawing ----------
  function paint() {
    const f = state.freq;
    needle.style.left = pct(f) + '%';
    tuneKnob.style.setProperty('--a', ((f - LO) * 120) + 'deg');
    tuneKnob.setAttribute('aria-valuenow', fmt(f));
    tuneKnob.setAttribute('aria-valuetext', fmt(f) + ' FM');
    volKnob.style.setProperty('--a', (-135 + state.vol * 270) + 'deg');
    volKnob.setAttribute('aria-valuenow', Math.round(state.vol * 100));
    freqEl.textContent = fmt(f);
    const { st } = nearest(f);
    let name = '';
    if (on && st && signal > 0.3) name = failed === st.id ? 'No signal' : st.name;
    nameEl.textContent = name;
    radio.classList.toggle('on', on);
  }

  // ---------- tuning ----------
  let glide = 0;
  function setFreq(f) {
    state.freq = clamp(f, LO, HI);
    save(); update();
  }
  function snap() {
    const { st, d } = nearest(state.freq);
    setFreq(st && d < LOCK ? st.freq : r1(state.freq));
  }
  function stopGlide() { cancelAnimationFrame(glide); glide = 0; }
  function glideTo(target, done) {
    stopGlide();
    const from = state.freq, t0 = performance.now();
    const ms = clamp(Math.abs(target - from) * 90, 250, 1100);
    const step = (now) => {
      const k = clamp((now - t0) / ms, 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setFreq(from + (target - from) * e);
      if (k < 1) glide = requestAnimationFrame(step);
      else { glide = 0; if (done) done(); }
    };
    glide = requestAnimationFrame(step);
  }
  function seek(dir, done) {
    const list = [...state.stations].sort((a, b) => a.freq - b.freq);
    if (!list.length) return;
    const f = state.freq;
    let next = dir > 0 ? list.find((s) => s.freq > f + 0.05) : [...list].reverse().find((s) => s.freq < f - 0.05);
    if (!next) next = dir > 0 ? list[0] : list[list.length - 1];
    glideTo(next.freq, done);
  }

  // scan: stop at each station for a few seconds
  let scanning = false, scanTimer = 0;
  function setScan(v) {
    scanning = v;
    clearTimeout(scanTimer);
    scanBtn.setAttribute('aria-pressed', String(v));
    if (v) { if (!on) power(true); scanStep(); }
  }
  function scanStep() {
    if (!scanning) return;
    seek(1, () => { scanTimer = setTimeout(scanStep, 7000); });
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
  knob(volKnob,
    (d) => { state.vol = clamp(state.vol + d / 270, 0, 1); save(); mix(); paint(); },
    (dir, big) => { state.vol = clamp(state.vol + dir * (big ? 0.2 : 0.05), 0, 1); save(); mix(); paint(); });

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
  const dialEnd = () => { if (dialDrag) { dialDrag = false; snap(); } };
  dial.addEventListener('pointerup', dialEnd);
  dial.addEventListener('pointercancel', dialEnd);

  // ---------- power and buttons ----------
  function power(v) {
    on = v;
    powerBtn.setAttribute('aria-pressed', String(on));
    if (on) {
      startNoise();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      tuned = null;
    } else {
      setScan(false);
      clearTimeout(pendingTimer);
      unload();
    }
    update();
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

  // ---------- station list ----------
  const dlg = $('list'), ul = $('stations'), form = $('add'), err = $('err');
  $('open').addEventListener('click', () => { renderList(); dlg.showModal(); });
  $('close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  function clashes(s) {
    return state.stations.some((o) => o !== s && Math.abs(o.freq - s.freq) < 0.15);
  }
  function changed() { save(); drawMarks(); update(); }

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
        if (tuned === s) unload();
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
  paint(); mix();
})();
