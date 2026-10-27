/* Musician Maker: map, units, the 12 step games, XP and mastery.
   See README.md for how progression works. */
(function () {
  'use strict';

  const M = LP.music;
  const S = LP.store;
  const A = LP.snd;
  const app = document.getElementById('app');

  let st = null;        // saved progress
  let screen = null;    // { name, args }
  let R = null;         // the round being played
  let token = 0;        // bumps on every redraw, so stale timers do nothing

  /* ---------------- small helpers ---------------- */
  function h(tag, a, kids) {
    const e = document.createElement(tag);
    a = a || {};
    for (const k in a) {
      const v = a[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  const ICONS = {
    back: 'M15 5l-7 7 7 7',
    gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.7-1L15 3.6h-4l-.4 2.4a7.5 7.5 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.7 1.7 1l.4 2.4h4l.4-2.4c.6-.3 1.2-.6 1.7-1l2.3.9 2-3.4z',
    trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4',
    play: 'M8 5l11 7-11 7z',
    replay: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4',
    undo: 'M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2',
    ear: 'M7 10a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.5M10 10a2 2 0 0 1 4 0',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    pencil: 'M4 20l1-5L16 4l4 4L9 19zM14 6l4 4',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
    check: 'M5 12.5l4.5 4.5L19 7',
    next: 'M5 12h14M13 6l6 6-6 6',
    x: 'M6 6l12 12M18 6L6 18',
    drum: 'M4 9c0-2 3.6-3.5 8-3.5s8 1.5 8 3.5-3.6 3.5-8 3.5S4 11 4 9zM4 9v6c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5V9M15 2l-2 4M9 2l2 4',
    note: 'M9 18V5l10-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5A5.5 5.5 0 0 1 5 17l-2-4a1.5 1.5 0 0 1 2.6-1.5L8 14',
    skip: 'M5 5l8 7-8 7zM15 5v14',
    save: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    load: 'M12 20V9M7 14l5-5 5 5M5 4h14',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    person: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
    fire: 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'
  };

  function icon(name, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'ic ' + (cls || ''));
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ICONS[name]);
    s.appendChild(p);
    return s;
  }

  function btn(cls, kids, onclick, label) {
    return h('button', { class: cls, onclick: onclick, 'aria-label': label, type: 'button' }, kids);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function later(t, fn) {
    const mine = token;
    setTimeout(function () { if (mine === token) fn(); }, Math.max(0, (t - A.now()) * 1000));
  }
  function after(ms, fn) {
    const mine = token;
    setTimeout(function () { if (mine === token) fn(); }, ms);
  }

  /* ---------------- progress rules ---------------- */
  const TITLES = ['Listener', 'Echo', 'Pattern Finder', 'Syllable Singer', 'Reader', 'Sight Reader',
    'Writer', 'Composer', 'Conductor', 'Maestro'];

  function level(xp) { let L = 1; while (xp >= 50 * (L + 1) * L) L++; return L; }
  function levelStart(L) { return 50 * L * (L - 1); }
  function title(L) { return TITLES[Math.min(L, TITLES.length) - 1]; }

  function sk(u, n) { return 'u' + u + 's' + n; }
  function stepRec(u, n) { return st.steps[sk(u, n)] || null; }
  function mastered(u, n) { const s = stepRec(u, n); return !!(s && s.mastered); }
  function stepOpen(u, n) { return st.test || n === 1 || mastered(u, n - 1); }
  function unitDone(id) { return !!(st.units[id] && st.units[id].done); }
  function track(name) { return M.UNITS.filter(function (u) { return u.track === name; }); }
  function unitOpen(u) {
    if (!u.ready) return false;
    if (st.test) return true;
    const t = track(u.track);
    const i = t.indexOf(u);
    return i === 0 || unitDone(t[i - 1].id);
  }
  function stars(acc) { return acc >= 1 ? 3 : acc >= 0.8 ? 2 : acc >= 0.5 ? 1 : 0; }
  function mookie() { return st.mookie === true; }
  function bpm() { return Math.round(st.tempo * (mookie() ? 0.85 : 1)); }
  function roundLen() { return mookie() ? 6 : 10; }
  // XP a step needs before the next one opens. A round at 80% or better is also needed,
  // so XP can't be piled up by guessing. Mic answers will earn more (MIC_XP) once singing is in.
  const MIC_XP = 1.5;
  function xpGoal(n) {
    const g = n === 5 || n === 12 ? 100 : 150;
    return st.test ? Math.round(g / 5) : g;
  }
  function newRec() { return { xp: 0, best: 0, passed: false, mastered: false, rounds: 0, last: 0 }; }

  /* ---------------- Mookie (placeholder art) ---------------- */
  const SAY = {
    1: 'Listen, then tap it back!',
    2: 'Watch the syllables, then say them back!',
    3: 'What did you hear?',
    4: 'A new one! What did you hear?',
    5: 'Answer me with your own pattern!',
    6: 'Which one did you hear?',
    7: 'Read it!',
    8: 'A new one. Read it!',
    9: 'Write the notes!',
    10: 'Write what you hear!',
    11: 'A new one. Write what you hear!',
    12: 'Make your own!',
    warm: 'Warm-up time!',
    yes: ['Yes!', 'You got it!', 'Nice!', 'Great ears!'],
    oops: 'Listen again...'
  };

  // Mookie, Kyle's black cat, as drawn in the project's Mookie mockups.
  // Fixed markup only: nothing a learner types ever goes in here.
  const CAT = '#17171b', EYE = '#cde374', PINK = '#c98a93';
  function catEyes(happy) {
    if (happy) {
      return '<path d="M71 78 Q82 66 93 78" stroke="' + EYE + '" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
        '<path d="M107 78 Q118 66 129 78" stroke="' + EYE + '" stroke-width="4.5" fill="none" stroke-linecap="round"/>';
    }
    function blink(r) { return '<animate attributeName="ry" values="' + r + ';' + r + ';0.8;' + r + '" keyTimes="0;0.93;0.965;1" dur="4.2s" repeatCount="indefinite"/>'; }
    function one(cx) {
      return '<ellipse cx="' + cx + '" cy="75" rx="11.5" ry="12.5" fill="' + EYE + '">' + blink(12.5) + '</ellipse>' +
        '<ellipse cx="' + (cx - 2) + '" cy="76" rx="2.6" ry="9" fill="#0b0b0d">' + blink(9) + '</ellipse>' +
        '<circle cx="' + (cx + 1.5) + '" cy="71" r="2" fill="#fff" opacity=".8"/>';
    }
    return one(82) + one(118);
  }
  function catHead(happy) {
    return '<path d="M61 64 L56 16 L94 44 Z" fill="' + CAT + '"/><path d="M139 64 L144 16 L106 44 Z" fill="' + CAT + '"/>' +
      '<path d="M66 57 L63 29 L87 46 Z" fill="' + PINK + '"/><path d="M134 57 L137 29 L113 46 Z" fill="' + PINK + '"/>' +
      '<path d="M57 79 C57 52 77 39 100 39 C123 39 143 52 143 79 C143 103 124 115 100 115 C76 115 57 103 57 79 Z" fill="' + CAT + '"/>' +
      catEyes(happy) + '<path d="M95.5 91 L104.5 91 L100 96.5 Z" fill="#4a3438"/>' +
      (happy ? '<path d="M93 100 Q100 110 107 100 Z" fill="' + PINK + '"/>'
        : '<path d="M100 96.5 Q96 102 91 100 M100 96.5 Q104 102 109 100" stroke="#55555c" stroke-width="1.6" fill="none" stroke-linecap="round"/>') +
      '<g stroke="#fff" stroke-opacity=".55" stroke-width="1.3" stroke-linecap="round"><path d="M84 95 L52 89"/><path d="M84 99 L51 101"/><path d="M116 95 L148 89"/><path d="M116 99 L149 101"/></g>';
  }
  const CAT_COLLAR = '<path d="M70 109 Q100 127 130 109" stroke="#a8d98f" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="100" cy="124" r="6.5" fill="#f2c94c"/>';
  const CAT_BODY = '<path d="M100 100 C62 104 52 150 58 188 C61 204 139 204 142 188 C148 150 138 104 100 100 Z" fill="' + CAT + '"/>' +
    '<ellipse cx="86" cy="199" rx="13" ry="8" fill="' + CAT + '"/><ellipse cx="114" cy="199" rx="13" ry="8" fill="' + CAT + '"/>';
  const CAT_TAIL = '<path class="mk-tail" d="M140 183 C170 197 152 215 112 209 C96 207 82 205 70 201" stroke="' + CAT + '" stroke-width="13" fill="none" stroke-linecap="round"/>';
  const CAT_ARMS = '<g class="mk-arm-l"><path d="M74 128 L42 74" stroke="' + CAT + '" stroke-width="16" stroke-linecap="round"/><circle cx="41" cy="71" r="10" fill="' + CAT + '"/></g>' +
    '<g class="mk-arm-r"><path d="M126 128 L158 74" stroke="' + CAT + '" stroke-width="16" stroke-linecap="round"/><circle cx="159" cy="71" r="10" fill="' + CAT + '"/></g>';

  function catMarkup(mood) {
    const happy = mood === 'happy';
    const head = '<g class="mk-head">' + catHead(happy) + '</g>';
    return '<svg viewBox="0 0 200 222" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      (happy ? CAT_ARMS : CAT_TAIL) + CAT_BODY + head + CAT_COLLAR + '</svg>';
  }

  function mookieSVG(mood) {
    const wrap = document.createElement('div');
    wrap.className = 'mookie ' + (mood || '');
    wrap.innerHTML = catMarkup(mood);
    wrap.setMood = function (m) {
      wrap.className = 'mookie ' + (m || '');
      wrap.innerHTML = catMarkup(m);
    };
    return wrap;
  }

  /* ---------------- navigation ---------------- */
  function go(name, args) {
    screen = { name: name, args: args || {} };
    draw();
  }

  function draw() {
    token++;
    app.textContent = '';
    window.scrollTo(0, 0);
    if (st.mookie === null) return welcome();
    const fn = SCREENS[screen.name] || SCREENS.map;
    fn(screen.args);
  }

  /* ---------------- welcome ---------------- */
  function welcome() {
    function choose(v) { st.mookie = v; S.save(); A.ac(); go('map'); }
    app.appendChild(h('main', { class: 'welcome' }, [
      h('div', { class: 'choices' }, [
        btn('choice', [mookieSVG('happy'), h('span', { text: 'With Mookie' })], function () { choose(true); }),
        btn('choice', [icon('person', 'big'), h('span', { text: 'On my own' })], function () { choose(false); })
      ])
    ]));
  }

  /* ---------------- map ---------------- */
  function topBar(left, right) {
    return h('header', { class: 'top' }, [h('div', { class: 'tl' }, left), h('div', { class: 'tr' }, right)]);
  }

  function levelChip() {
    const L = level(st.xp);
    const a = levelStart(L), b = levelStart(L + 1);
    const pct = Math.round(100 * (st.xp - a) / (b - a));
    return h('div', { class: 'lvl' }, [
      h('div', { class: 'lvl-n', text: String(L) }),
      h('div', { class: 'lvl-info' }, [
        h('div', { class: 'lvl-t', text: title(L) }),
        h('div', { class: 'bar' }, [h('div', { class: 'bar-f', style: 'width:' + pct + '%' })]),
        h('div', { class: 'lvl-xp', text: st.xp + ' XP' })
      ])
    ]);
  }

  function unitProgress(id) {
    let n = 0;
    for (let s = 1; s <= 12; s++) if (mastered(id, s)) n++;
    return n;
  }

  function masteredSteps() {
    const out = [];
    M.UNITS.forEach(function (u) {
      if (!u.ready) return;
      for (let n = 1; n <= 12; n++) {
        if (n === 5 || n === 12) continue;
        const r = stepRec(u.id, n);
        if (r && r.mastered) out.push({ u: u.id, n: n, last: r.last || 0 });
      }
    });
    return out;
  }

  function mapScreen() {
    app.appendChild(topBar([levelChip()], [
      btn('icon-btn', [icon('trophy')], function () { go('trophies'); }, 'Badges'),
      btn('icon-btn', [icon('gear')], function () { go('settings'); }, 'Settings')
    ]));
    const main = h('main', { class: 'map' });
    if (masteredSteps().length) {
      main.appendChild(btn('warm', [icon('fire'), h('span', { text: 'Warm-up' })], startWarmUp));
    }
    const cols = h('div', { class: 'tracks' });
    [['rhythm', 'Rhythm', 'drum'], ['tonal', 'Tonal', 'note']].forEach(function (t) {
      const col = h('section', { class: 'track' }, [h('h2', {}, [icon(t[2]), t[1]])]);
      track(t[0]).forEach(function (u) {
        const open = unitOpen(u);
        const prog = u.ready ? unitProgress(u.id) : 0;
        const cls = 'unit-tile' + (open ? '' : ' locked') + (unitDone(u.id) ? ' done' : '') + (u.ready ? '' : ' soon');
        col.appendChild(btn(cls, [
          h('span', { class: 'u-n', text: String(u.id) }),
          h('span', { class: 'u-l', text: u.label || '' }),
          open ? h('span', { class: 'u-bar' }, [h('span', { style: 'width:' + Math.round(prog / 12 * 100) + '%' })]) : icon('lock', 'u-lock')
        ], open ? function () { go('unit', { id: u.id }); } : null, 'Unit ' + u.id));
      });
      cols.appendChild(col);
    });
    main.appendChild(cols);
    app.appendChild(main);
  }

  /* ---------------- unit ---------------- */
  const BAND_ICON = { ear: 'ear', read: 'eye', write: 'pencil' };

  function starRow(n) {
    return h('span', { class: 'stars' }, [0, 1, 2].map(function (i) { return icon('star', i < n ? 'on' : ''); }));
  }

  function stepBar(rec, n, cls) {
    const pct = rec ? Math.min(100, Math.round(100 * (rec.xp || 0) / xpGoal(n))) : 0;
    return h('span', { class: 'step-bar ' + (cls || '') }, [h('span', { style: 'width:' + pct + '%' })]);
  }

  function unitScreen(a) {
    const u = M.unit(a.id);
    app.appendChild(topBar([
      btn('icon-btn', [icon('back')], function () { go('map'); }, 'Back'),
      h('h1', {}, ['Unit ' + u.id, h('small', { text: u.label + (u.meter ? '  ·  ' + u.meter : '') })])
    ], [
      unitDone(u.id) ? null : btn('pill', [icon('skip'), h('span', { text: 'Test out' })], function () { startTestOut(u.id); })
    ]));
    const main = h('main', { class: 'unit' });
    M.BANDS.forEach(function (b) {
      const row = h('div', { class: 'nodes' });
      b.steps.forEach(function (n) {
        const open = stepOpen(u.id, n);
        const r = stepRec(u.id, n);
        const isM = !!(r && r.mastered);
        const cur = open && !isM;
        row.appendChild(btn('node' + (open ? '' : ' locked') + (isM ? ' mastered' : '') + (cur ? ' current' : ''), [
          h('span', { class: 'node-c' }, [open ? String(n) : icon('lock')]),
          isM ? starRow(stars(r.best)) : (open ? stepBar(r, n) : starRow(0))
        ], open ? function () { startStep(u.id, n); } : null, 'Step ' + n));
      });
      main.appendChild(h('section', { class: 'band band-' + b.id }, [
        h('h2', {}, [icon(BAND_ICON[b.id]), b.name, st.badges['u' + u.id + '-' + b.id] ? icon('check', 'band-done') : null]),
        row
      ]));
    });
    app.appendChild(main);
  }

  /* ---------------- rounds ---------------- */
  function makeItems(u, spec, n) {
    if (spec.set === 'compose') {
      const out = [];
      for (let i = 0; i < n; i++) out.push({ u: u, spec: spec, p: null });
      return out;
    }
    return M.draw(u, spec.set === 'create' ? 'fam' : spec.set, n).map(function (p) { return { u: u, spec: spec, p: p }; });
  }

  function startStep(uid, n) {
    A.ac();
    const u = M.unit(uid);
    const spec = M.STEPS[n - 1];
    const len = spec.set === 'create' || spec.set === 'compose' ? 4 : roundLen();
    R = { kind: 'step', uid: uid, n: n, items: makeItems(u, spec, len), i: 0, points: 0, xp: 0, firstTry: 0 };
    go('game');
  }

  function startWarmUp() {
    A.ac();
    const list = masteredSteps().sort(function (a, b) { return a.last - b.last; });
    const items = [];
    const n = mookie() ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const s = list[i % list.length];
      items.push(makeItems(M.unit(s.u), M.STEPS[s.n - 1], 1)[0]);
      items[items.length - 1].warm = s;
    }
    R = { kind: 'warm', items: items, i: 0, points: 0, xp: 0, firstTry: 0 };
    go('game');
  }

  function startTestOut(uid) {
    A.ac();
    const u = M.unit(uid);
    const items = [];
    const a = makeItems(u, M.STEPS[3], 5), b = makeItems(u, M.STEPS[7], 5);
    for (let i = 0; i < 5; i++) items.push(a[i], b[i]);
    R = { kind: 'check', uid: uid, items: items, i: 0, points: 0, xp: 0, firstTry: 0 };
    go('game');
  }

  /* ---------------- playing patterns ---------------- */
  // Plays a pattern; onEvent(eventIndex, tokenIndex) fires as each note sounds, then (-1, -1).
  function playPattern(u, p, o) {
    o = o || {};
    const beat = 60 / (bpm() * (o.slow ? 0.8 : 1));
    const t0 = A.now() + 0.12;
    const lat = A.latency();
    const evs = [];
    let end;
    if (u.track === 'rhythm') {
      const ci = o.countIn === false ? 0 : 2;
      for (let b = 0; b < ci; b++) A.tick(t0 + b * beat, b === 0, 0.08);
      const ps = t0 + ci * beat;
      for (let b = 0; b < p.length; b++) A.tick(ps + b * beat, b % 2 === 0, 0.03);
      M.rhythmEvents(p).forEach(function (e, i) {
        A.block(ps + e.beat * beat);
        evs.push({ t: ps + e.beat * beat, i: i, tok: e.tok });
      });
      end = ps + p.length * beat;
    } else {
      let s = t0;
      if (o.tonic !== false) { A.chord(M.tonic(u), t0, beat * 1.4); s = t0 + beat * 2; }
      p.forEach(function (syl, i) {
        A.tone(M.freq(u, syl), s + i * beat, beat * 0.9);
        evs.push({ t: s + i * beat, i: i, tok: i });
      });
      end = s + p.length * beat;
    }
    return new Promise(function (resolve) {
      evs.forEach(function (e) { later(e.t + lat, function () { if (o.onEvent) o.onEvent(e.i, e.tok); }); });
      later(end + lat, function () { if (o.onEvent) o.onEvent(-1, -1); resolve(); });
    });
  }

  // The syllables of a pattern, one chip per sound.
  function syllChips(u, p) {
    const words = u.track === 'tonal' ? p : M.rhythmEvents(p).map(function (e) { return e.syl; });
    const box = h('div', { class: 'chips' }, words.map(function (w) { return h('span', { class: 'chip', text: w }); }));
    box.light = function (i) {
      Array.prototype.forEach.call(box.children, function (c, j) { c.classList.toggle('hi', j === i); });
    };
    return box;
  }

  function notationBox(u, p, opts) {
    const box = h('div', { class: 'notation-box' });
    function paint(hi) {
      box.textContent = '';
      box.appendChild(M.notation(u, p, Object.assign({}, opts || {}, { hi: hi })));
    }
    paint(-1);
    box.light = paint;
    return box;
  }

  // Shows a pattern with notation and syllables and plays it.
  function showAndPlay(stage, u, p, opts) {
    opts = opts || {};
    stage.textContent = '';
    const nb = opts.notation === false ? null : notationBox(u, p);
    const chips = syllChips(u, p);
    if (nb) stage.appendChild(nb);
    stage.appendChild(chips);
    return playPattern(u, p, {
      slow: opts.slow,
      onEvent: function (i, tok) { chips.light(i); if (nb) nb.light(tok); }
    });
  }

  /* ---------------- the game screen ---------------- */
  function gameScreen() {
    const it = R.items[R.i];
    const u = it.u, spec = it.spec;
    it.tries = 0;

    const dots = h('div', { class: 'dots' }, R.items.map(function (x, i) {
      return h('span', { class: 'dot' + (i < R.i ? ' done' : '') + (i === R.i ? ' now' : '') });
    }));
    const xpPill = h('div', { class: 'xp', text: '+' + R.xp });
    app.appendChild(topBar([
      btn('icon-btn', [icon('x')], quit, 'Stop'), dots
    ], [xpPill]));

    const main = h('main', { class: 'game band-' + spec.band });
    const guide = h('div', { class: 'guide' });
    let mk = null, bubble = null;
    if (mookie()) {
      mk = mookieSVG();
      bubble = h('div', { class: 'bubble', text: R.kind === 'warm' && R.i === 0 ? SAY.warm : SAY[spec.n] });
      guide.appendChild(mk);
      guide.appendChild(bubble);
    } else {
      guide.appendChild(icon(BAND_ICON[spec.band], 'guide-ic'));
    }
    const stage = h('div', { class: 'stage' });
    const answer = h('div', { class: 'answer' });
    const controls = h('div', { class: 'controls' });
    main.appendChild(guide);
    main.appendChild(stage);
    main.appendChild(answer);
    main.appendChild(controls);
    app.appendChild(main);

    const G = {
      it: it, u: u, spec: spec, stage: stage, answer: answer, controls: controls,
      mood: function (m, line) {
        if (mk) {
          mk.setMood(m);
          if (line) bubble.textContent = line;
        }
      },
      right: function (show) {
        const first = it.tries === 0;
        R.points += first ? 1 : 0.5;
        R.xp += first ? 10 : 5;
        if (first) R.firstTry++;
        xpPill.textContent = '+' + R.xp;
        main.classList.add('good');
        A.yes();
        G.mood('happy', M.pick(SAY.yes));
        const done = show ? show() : Promise.resolve();
        done.then(function () { after(500, nextItem); });
      },
      wrong: function (retry, reveal) {
        it.tries++;
        A.no();
        main.classList.remove('shake');
        void main.offsetWidth;
        main.classList.add('shake');
        if (it.tries < 2) {
          G.mood('oops', SAY.oops);
          retry();
        } else {
          G.mood('', '');
          reveal();
          controls.textContent = '';
          controls.appendChild(btn('big-btn', [icon('next')], nextItem, 'Next'));
        }
      }
    };
    GAMES[spec.resp](G);
    keyHandler = G.onKey || null;
  }

  function quit() {
    const r = R;
    R = null;
    if (r && r.uid) go('unit', { id: r.uid }); else go('map');
  }

  function nextItem() {
    R.i++;
    if (R.i >= R.items.length) return finishRound();
    go('game');
  }

  /* ---------------- the games ---------------- */
  function playButton(fn) {
    return btn('play-btn', [icon('play')], fn, 'Play');
  }

  // Step 1: echo. Rhythm: tap it back in time. Tonal: tap the pitches in order.
  function echoGame(G) {
    if (G.u.track === 'tonal') return echoTonal(G);
    const u = G.u, p = G.it.p;
    const listen = h('div', { class: 'beats' }, [icon('ear')].concat([0, 1, 2, 3].map(function () { return h('span', { class: 'beat' }); })));
    const yours = h('div', { class: 'beats' }, [icon('hand')].concat([0, 1, 2, 3].map(function () { return h('span', { class: 'beat' }); })));
    G.stage.appendChild(listen);
    G.stage.appendChild(yours);
    let phase = 'wait', taps = [];
    const tapPad = btn('tap-pad', [icon('hand', 'big')], function () {}, 'Tap');
    function tap(e) {
      if (e) e.preventDefault();
      if (phase !== 'go') return;
      taps.push(A.now());
      A.block(A.now(), 0.5);
      tapPad.classList.remove('hit'); void tapPad.offsetWidth; tapPad.classList.add('hit');
    }
    tapPad.addEventListener('pointerdown', tap);
    G.onKey = function (e) { if (e.code === 'Space' || e.code === 'Enter') tap(e); };
    G.answer.appendChild(tapPad);

    function light(row, b) {
      Array.prototype.forEach.call(row.querySelectorAll('.beat'), function (x, i) { x.classList.toggle('on', i === b); });
    }

    function run(slow) {
      phase = 'wait';
      taps = [];
      tapPad.classList.remove('live');
      const beat = 60 / (bpm() * (slow ? 0.8 : 1));
      const lat = A.latency();
      const t0 = A.now() + 0.25;
      for (let b = 0; b < 10; b++) A.tick(t0 + b * beat, b % 2 === 0, b < 2 ? 0.08 : 0.04);
      const ps = t0 + 2 * beat;
      M.rhythmEvents(p).forEach(function (e) { A.block(ps + e.beat * beat); });
      const ws = t0 + 6 * beat;
      for (let b = 0; b < 4; b++) {
        later(ps + b * beat + lat, function () { light(listen, b); });
        later(ws + b * beat + lat, function () { light(listen, -1); light(yours, b); });
      }
      later(ws - 0.3 * beat + lat, function () { phase = 'go'; tapPad.classList.add('live'); });
      later(ws + 4 * beat + lat + 0.2 * beat, function () {
        phase = 'wait';
        tapPad.classList.remove('live');
        light(yours, -1);
        const expected = M.rhythmEvents(p).map(function (e) { return ws + e.beat * beat + lat; });
        judge(expected, beat);
      });
    }

    function judge(expected, beat) {
      const tol = 0.25 * beat;
      const used = {};
      const ok = taps.length === expected.length && expected.every(function (t) {
        for (let i = 0; i < taps.length; i++) {
          if (!used[i] && Math.abs(taps[i] - t) <= tol) { used[i] = 1; return true; }
        }
        return false;
      });
      if (ok) G.right();
      else G.wrong(function () { after(900, function () { run(mookie()); }); }, function () {
        G.controls.textContent = '';
        after(300, function () { playPattern(u, p); });
      });
    }

    G.controls.appendChild(btn('icon-btn', [icon('replay')], function () { run(false); }, 'Again'));
    after(500, function () { run(false); });
  }

  function echoTonal(G) {
    const u = G.u, p = G.it.p;
    let ans = [];
    let ready = false;
    const pads = h('div', { class: 'pads' });
    // Unlabelled pads, high to low: readiness is before syllables.
    u.tokens.slice().reverse().forEach(function (t, i, arr) {
      pads.appendChild(btn('pad pad-' + (arr.length - 1 - i), [], function () {
        if (!ready) return;
        A.tone(M.freq(u, t), A.now() + 0.01, 0.4);
        ans.push(t);
        if (ans.length === p.length) check();
      }, 'Pitch'));
    });
    G.answer.appendChild(pads);
    function play(slow) {
      ready = false;
      ans = [];
      pads.classList.add('wait');
      playPattern(u, p, { slow: slow }).then(function () { ready = true; pads.classList.remove('wait'); });
    }
    function check() {
      ready = false;
      if (M.key(ans) === M.key(p)) G.right();
      else G.wrong(function () { after(700, function () { play(mookie()); }); }, function () { play(false); });
    }
    G.controls.appendChild(btn('icon-btn', [icon('replay')], function () { play(false); }, 'Again'));
    after(400, function () { play(false); });
  }

  // Steps 2-5 and 7-12: build the answer from syllable or note buttons.
  function buildGame(G) {
    const u = G.u, spec = G.spec, p = G.it.p;
    const len = u.len;
    const notes = spec.resp === 'notes';
    let ans = [];
    let locked = false;

    // What the learner is given.
    function stim(slow) {
      if (spec.stim === 'neutral') {
        locked = spec.set === 'create';
        return playPattern(u, p, { slow: slow }).then(function () { locked = false; });
      }
      if (spec.stim === 'syll') {
        locked = true;
        paintAnswer(true);
        const chips = syllChips(u, p);
        G.stage.textContent = '';
        G.stage.appendChild(chips);
        return playPattern(u, p, { slow: slow, onEvent: function (i) { chips.light(i); } }).then(function () {
          after(250, function () { G.stage.textContent = ''; G.stage.appendChild(playButton(function () { stim(false); })); locked = false; paintAnswer(); });
        });
      }
      return Promise.resolve();
    }

    if (spec.stim === 'notation') G.stage.appendChild(notationBox(u, p));
    else if (spec.stim === 'text') G.stage.appendChild(syllChips(u, p));
    else if (spec.stim === 'neutral') G.stage.appendChild(playButton(function () { stim(false); }));
    else if (spec.stim === 'none') G.stage.appendChild(icon('pencil', 'stage-ic'));

    const slots = h('div', { class: 'slots' });
    const keys = h('div', { class: 'keys' + (u.track === 'tonal' && !notes ? ' keys-tonal' : '') });
    G.answer.appendChild(slots);
    G.answer.appendChild(keys);

    function paintAnswer(hidden) {
      slots.textContent = '';
      if (hidden) return;
      if (notes) {
        slots.appendChild(M.notation(u, ans, { slots: len }));
      } else {
        const words = M.syllables(u, ans);
        for (let i = 0; i < len; i++) slots.appendChild(h('span', { class: 'slot-chip' + (i < ans.length ? ' full' : ''), text: words[i] || '' }));
      }
    }

    const order = u.track === 'tonal' && !notes ? u.tokens.slice().reverse() : u.tokens;
    order.forEach(function (t) {
      const face = notes ? [M.tokenSVG(u, t)] : [h('span', { text: M.syllables(u, [t])[0] })];
      keys.appendChild(btn('key' + (notes ? ' key-notes' : ''), face, function () {
        if (locked || ans.length >= len) return;
        if (u.track === 'tonal') A.tone(M.freq(u, t), A.now() + 0.01, 0.35);
        else M.CELLS[t].on.forEach(function (o) { A.block(A.now() + 0.01 + o * 60 / bpm(), 0.6); });
        ans.push(t);
        paintAnswer();
        if (ans.length === len) after(250, check);
      }, M.syllables(u, [t])[0]));
    });
    G.controls.appendChild(btn('icon-btn', [icon('undo')], function () {
      if (locked) return;
      ans.pop();
      paintAnswer();
    }, 'Undo'));

    function clear() { ans = []; paintAnswer(); }

    function reveal() {
      locked = true;
      if (M.key(ans) !== M.key(p)) slots.classList.add('missed');
      return showAndPlay(G.stage, u, p);
    }

    function check() {
      locked = true;
      if (spec.set === 'create') {
        if (M.key(ans) === M.key(p)) {
          A.no();
          G.mood('oops', 'Make it different from mine!');
          locked = false;
          return clear();
        }
        const mine = ans.slice();
        return G.right(function () {
          return showAndPlay(G.stage, u, p, { notation: false }).then(function () {
            return showAndPlay(G.stage, u, mine, { notation: false });
          });
        });
      }
      if (spec.set === 'compose') {
        const mine = ans.slice();
        st.notebook.push({ unit: u.id, p: mine, at: Date.now() });
        S.save();
        return G.right(function () { return showAndPlay(G.stage, u, mine); });
      }
      if (M.key(ans) === M.key(p)) {
        G.right(reveal);
      } else {
        G.wrong(function () {
          clear();
          locked = false;
          if (mookie() && spec.stim !== 'notation' && spec.stim !== 'text') after(600, function () { stim(true); });
        }, function () {
          reveal();
        });
      }
    }

    paintAnswer();
    if (spec.stim === 'neutral' || spec.stim === 'syll') after(400, function () { stim(false); });
  }

  // Step 6: hear it, pick its notation.
  function cardGame(G) {
    const u = G.u, p = G.it.p;
    const choices = M.cardChoices(u, p, mookie() ? 3 : 4);
    G.stage.appendChild(playButton(function () { playPattern(u, p); }));
    const grid = h('div', { class: 'cards' });
    choices.forEach(function (c) {
      const b = btn('card', [M.notation(u, c)], function () {
        if (b.disabled) return;
        if (M.key(c) === M.key(p)) {
          b.classList.add('right');
          G.right(function () { return showAndPlay(G.stage, u, p); });
        } else {
          b.classList.add('wrong-card');
          b.disabled = true;
          G.wrong(function () { if (mookie()) after(600, function () { playPattern(u, p, { slow: true }); }); }, function () {
            Array.prototype.forEach.call(grid.children, function (x) { x.disabled = true; });
            showAndPlay(G.stage, u, p);
          });
        }
      }, 'Choice');
      grid.appendChild(b);
    });
    G.answer.appendChild(grid);
    after(400, function () { playPattern(u, p); });
  }

  const GAMES = { echo: echoGame, syll: buildGame, notes: buildGame, card: cardGame };

  let keyHandler = null;
  document.addEventListener('keydown', function (e) {
    if (screen && screen.name === 'game' && keyHandler) keyHandler(e);
  });

  /* ---------------- end of a round ---------------- */
  function award(id, earned) {
    if (!st.badges[id]) { st.badges[id] = today(); earned.push(id); }
  }

  function checkUnit(uid, earned) {
    M.BANDS.forEach(function (b) {
      if (b.steps.every(function (n) { return mastered(uid, n); })) award('u' + uid + '-' + b.id, earned);
    });
    if (mastered(uid, 12)) {
      st.units[uid] = { done: true };
      award('u' + uid + '-unit', earned);
    }
  }

  function finishRound() {
    const r = R;
    const n = r.items.length;
    const acc = r.points / n;
    const perfect = r.firstTry === n;
    const bonus = perfect ? 20 : 0;
    const earned = [];
    const res = { acc: acc, xp: r.xp + bonus, bonus: bonus, kind: r.kind, uid: r.uid, n: r.n, earned: earned };
    st.xp += r.xp + bonus;
    const now = Date.now();

    if (r.kind === 'step') {
      const k = sk(r.uid, r.n);
      const rec = st.steps[k] || newRec();
      rec.rounds++;
      rec.xp = (rec.xp || 0) + r.xp + bonus;
      rec.last = now;
      rec.best = Math.max(rec.best, acc);
      if (acc >= 0.8) rec.passed = true;
      const was = rec.mastered;
      if (rec.passed && rec.xp >= xpGoal(r.n)) rec.mastered = true;
      st.steps[k] = rec;
      res.rec = rec;
      res.newlyMastered = rec.mastered && !was;
      checkUnit(r.uid, earned);
    } else if (r.kind === 'warm') {
      r.items.forEach(function (it) {
        const rec = stepRec(it.warm.u, it.warm.n);
        if (rec) rec.last = now;
      });
    } else if (r.kind === 'check') {
      res.passed = acc >= 0.8;
      if (res.passed) {
        for (let s = 1; s <= 12; s++) {
          const k = sk(r.uid, s);
          const rec = st.steps[k] || newRec();
          rec.mastered = true;
          rec.passed = true;
          rec.xp = Math.max(rec.xp || 0, xpGoal(s));
          rec.best = Math.max(rec.best, acc);
          rec.last = now;
          st.steps[k] = rec;
        }
        checkUnit(r.uid, earned);
      }
    }
    S.save();
    R = null;
    go('results', res);
  }

  function badgeName(id) {
    const m = /^u(\d+)-(\w+)$/.exec(id);
    const what = { ear: 'Ear', read: 'Reader', write: 'Writer', unit: 'Unit' }[m[2]];
    return { unit: m[1], what: what, kind: m[2] };
  }

  function badge(id) {
    const b = badgeName(id);
    const ic = { ear: 'ear', read: 'eye', write: 'pencil', unit: 'trophy' }[b.kind];
    return h('div', { class: 'badge badge-' + b.kind }, [icon(ic), h('span', { text: b.what + ' · ' + b.unit })]);
  }

  function resultsScreen(res) {
    const main = h('main', { class: 'results' });
    if (mookie()) main.appendChild(mookieSVG(res.acc >= 0.8 ? 'happy' : ''));
    if (res.kind === 'check') {
      main.appendChild(h('div', { class: 'big-mark' + (res.passed ? ' ok' : '') }, [icon(res.passed ? 'check' : 'replay')]));
    } else {
      main.appendChild(h('div', { class: 'big-stars' }, [starRow(stars(res.acc))]));
    }
    main.appendChild(h('div', { class: 'gain', text: '+' + res.xp + ' XP' }));
    if (res.kind === 'step') {
      const rec = res.rec;
      if (rec.mastered) {
        main.appendChild(h('div', { class: 'mastery ok' }, [icon('check')]));
      } else {
        main.appendChild(stepBar(rec, res.n, 'mastery-bar'));
        if (!rec.passed) main.appendChild(h('div', { class: 'need80' }, [starRow(2)]));
      }
    }
    if (res.earned.length) main.appendChild(h('div', { class: 'badges' }, res.earned.map(badge)));

    const row = h('div', { class: 'row' });
    if (res.kind === 'step') {
      row.appendChild(btn('big-btn ghost', [icon('replay')], function () { startStep(res.uid, res.n); }, 'Again'));
      if (res.n < 12 && stepOpen(res.uid, res.n + 1)) {
        row.appendChild(btn('big-btn', [icon('next')], function () { startStep(res.uid, res.n + 1); }, 'Next step'));
      } else {
        row.appendChild(btn('big-btn', [icon('check')], function () { go('unit', { id: res.uid }); }, 'Done'));
      }
    } else if (res.kind === 'check') {
      row.appendChild(btn('big-btn', [icon('check')], function () { go('unit', { id: res.uid }); }, 'Done'));
    } else {
      row.appendChild(btn('big-btn', [icon('check')], function () { go('map'); }, 'Done'));
    }
    main.appendChild(row);
    app.appendChild(main);
    if (res.acc >= 0.8) A.yes();
  }

  /* ---------------- badges and notebook ---------------- */
  function trophiesScreen() {
    app.appendChild(topBar([btn('icon-btn', [icon('back')], function () { go('map'); }, 'Back'), levelChip()], []));
    const main = h('main', { class: 'trophies' });
    const ids = Object.keys(st.badges);
    main.appendChild(h('h2', {}, [icon('trophy'), 'Badges']));
    main.appendChild(ids.length ? h('div', { class: 'badges' }, ids.map(badge)) : h('div', { class: 'empty' }, [icon('lock')]));
    main.appendChild(h('h2', {}, [icon('pencil'), 'Notebook']));
    if (!st.notebook.length) main.appendChild(h('div', { class: 'empty' }, [icon('lock')]));
    st.notebook.slice().reverse().forEach(function (e) {
      const u = M.unit(e.unit);
      const box = notationBox(u, e.p);
      main.appendChild(h('div', { class: 'nb' }, [
        btn('icon-btn', [icon('play')], function () { playPattern(u, e.p, { onEvent: function (i, t) { box.light(t); } }); }, 'Play'),
        box
      ]));
    });
    app.appendChild(main);
  }

  /* ---------------- settings ---------------- */
  function settingsScreen() {
    app.appendChild(topBar([btn('icon-btn', [icon('back')], function () { go('map'); }, 'Back'), h('h1', { text: 'Settings' })], []));
    const main = h('main', { class: 'settings' });

    function seg(options) {
      return h('div', { class: 'seg' }, options.map(function (o) {
        return btn('seg-b' + (o.on ? ' on' : ''), o.kids, o.fn, o.label);
      }));
    }

    main.appendChild(h('div', { class: 'set-row' }, [h('span', { text: 'Guide' }), seg([
      { kids: [mookieSVG(), h('span', { text: 'Mookie' })], on: st.mookie === true, fn: function () { st.mookie = true; S.save(); draw(); } },
      { kids: [icon('person'), h('span', { text: 'Off' })], on: st.mookie === false, fn: function () { st.mookie = false; S.save(); draw(); } }
    ])]));

    main.appendChild(h('div', { class: 'set-row' }, [h('span', { text: 'Tempo' }), h('div', { class: 'stepper' }, [
      btn('icon-btn', [icon('minus')], function () { st.tempo = Math.max(52, st.tempo - 4); S.save(); draw(); }, 'Slower'),
      h('span', { class: 'tempo', text: String(st.tempo) }),
      btn('icon-btn', [icon('plus')], function () { st.tempo = Math.min(112, st.tempo + 4); S.save(); draw(); }, 'Faster'),
      btn('icon-btn', [icon('play')], function () {
        const t = A.now() + 0.1, b = 60 / bpm();
        for (let i = 0; i < 4; i++) A.tick(t + i * b, i === 0, 0.1);
      }, 'Hear tempo')
    ])]));

    const file = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
    file.addEventListener('change', function () {
      const f = file.files[0];
      if (!f) return;
      f.text().then(function (t) {
        try { S.restore(t); st = S.get(); go('map'); } catch (e) { file.value = ''; A.no(); }
      });
    });
    main.appendChild(h('div', { class: 'set-row' }, [h('span', { text: 'Backup' }), h('div', { class: 'stepper' }, [
      btn('pill', [icon('save'), h('span', { text: 'Save' })], function () {
        const url = URL.createObjectURL(S.backupBlob());
        const a = h('a', { href: url, download: 'musician-maker-backup-' + today() + '.json' });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      }),
      btn('pill', [icon('load'), h('span', { text: 'Load' })], function () { file.click(); }),
      file
    ])]));

    main.appendChild(h('div', { class: 'set-row test' }, [h('span', { text: 'Test mode' }), seg([
      { kids: [h('span', { text: 'On' })], on: st.test, fn: function () { st.test = true; S.save(); draw(); } },
      { kids: [h('span', { text: 'Off' })], on: !st.test, fn: function () { st.test = false; S.save(); draw(); } }
    ])]));

    let armed = false;
    const reset = btn('pill danger', [icon('x'), h('span', { text: 'Reset progress' })], function () {
      if (!armed) { armed = true; reset.lastChild.textContent = 'Tap again to reset'; return; }
      S.reset(); st = S.get(); go('map');
    });
    main.appendChild(h('div', { class: 'set-row' }, [h('span'), reset]));
    app.appendChild(main);
  }

  const SCREENS = {
    map: mapScreen, unit: unitScreen, game: gameScreen, results: resultsScreen,
    trophies: trophiesScreen, settings: settingsScreen
  };

  // Read-only peek for automated tests.
  LP.debug = { round: function () { return R; }, state: function () { return st; } };

  S.load().then(function (s) { st = s; go('map'); });
})();
