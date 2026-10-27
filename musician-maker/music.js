/* The curriculum: units, the 12 steps, patterns, and how to draw them.
   Patterns are made from each unit's syllables and meter, not copied from the
   Conversational Solfege books. */
window.LP = window.LP || {};
LP.music = (function () {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------------- rhythm cells: one per beat ---------------- */
  const CELLS = {
    du: { on: [0], syl: ['du'] },
    dude: { on: [0, 0.5], syl: ['du', 'de'] },
    du3: { on: [0], syl: ['du'] },
    dudadi: { on: [0, 1 / 3, 2 / 3], syl: ['du', 'da', 'di'] }
  };

  /* ---------------- solfege ---------------- */
  const DEG = { do: 0, re: 1, mi: 2, fa: 3, so: 4, la: 5, ti: 6 };
  const SEMI = [0, 2, 4, 5, 7, 9, 11];
  // do as a MIDI note, and as a staff step counted up from E4 (the bottom line).
  const KEYS = {
    F: { doMidi: 65, doStep: 1, flats: [4] }, // B flat, on the middle line
    G: { doMidi: 67, doStep: 2, sharps: [8] }
  };

  /* ---------------- the 12 steps ----------------
     stim: what the learner gets (neutral sound, sound with syllables, notation,
     syllables as text, nothing). resp: how they answer. set: which patterns. */
  const STEPS = [
    { n: 1, band: 'ear', stim: 'neutral', resp: 'echo', set: 'fam' },
    { n: 2, band: 'ear', stim: 'syll', resp: 'syll', set: 'fam' },
    { n: 3, band: 'ear', stim: 'neutral', resp: 'syll', set: 'fam' },
    { n: 4, band: 'ear', stim: 'neutral', resp: 'syll', set: 'unf' },
    { n: 5, band: 'ear', stim: 'neutral', resp: 'syll', set: 'create' },
    { n: 6, band: 'read', stim: 'neutral', resp: 'card', set: 'fam' },
    { n: 7, band: 'read', stim: 'notation', resp: 'syll', set: 'fam' },
    { n: 8, band: 'read', stim: 'notation', resp: 'syll', set: 'unf' },
    { n: 9, band: 'write', stim: 'text', resp: 'notes', set: 'fam' },
    { n: 10, band: 'write', stim: 'neutral', resp: 'notes', set: 'fam' },
    { n: 11, band: 'write', stim: 'neutral', resp: 'notes', set: 'unf' },
    { n: 12, band: 'write', stim: 'none', resp: 'notes', set: 'compose' }
  ];
  const BANDS = [
    { id: 'ear', name: 'Ear', steps: [1, 2, 3, 4, 5] },
    { id: 'read', name: 'Read', steps: [6, 7, 8] },
    { id: 'write', name: 'Write', steps: [9, 10, 11, 12] }
  ];

  /* ---------------- units ----------------
     ready: playable now. The rest show on the map, locked, until Kyle fills
     them in from the manuals. */
  function rhy(s) { return s.split('').map(function (c) { return c === 'Q' ? 'du' : 'dude'; }); }
  function sol(s) { return s.split(' ').map(function (w) { return w.split('-'); }); }

  const UNITS = [
    {
      id: 1, track: 'rhythm', ready: true, label: 'du · du-de', meter: '2/4',
      tokens: ['du', 'dude'], len: 4,
      fam: ['QEQQ', 'EQEQ', 'EEEQ', 'QQEQ', 'EQQQ', 'QEEQ', 'EEQQ', 'QEQE'].map(rhy)
    },
    { id: 2, track: 'rhythm' },
    { id: 3, track: 'rhythm' },
    {
      id: 4, track: 'tonal', ready: true, label: 'do re mi', key: 'F',
      tokens: ['do', 're', 'mi'], len: 3,
      fam: sol('do-re-mi mi-re-do do-re-do mi-re-mi do-mi-do mi-do-mi re-mi-do mi-mi-do')
    },
    { id: 5, track: 'tonal', label: 'do re mi so' },
    { id: 6, track: 'rhythm' },
    { id: 7, track: 'rhythm' },
    { id: 8, track: 'rhythm' },
    { id: 9, track: 'rhythm' },
    { id: 10, track: 'tonal', label: 'do re mi so la' },
    { id: 11, track: 'tonal', label: 'do re mi fa so' },
    { id: 12, track: 'tonal', label: 'do re mi fa so la' },
    { id: 13, track: 'rhythm' }
  ];

  function key(p) { return p.join(','); }

  // Every pattern a unit's syllables can make, less the dull ones.
  function allPatterns(u) {
    let out = [[]];
    for (let i = 0; i < u.len; i++) {
      const next = [];
      out.forEach(function (p) { u.tokens.forEach(function (t) { next.push(p.concat([t])); }); });
      out = next;
    }
    if (u.track === 'tonal') out = out.filter(function (p) { return p.some(function (t) { return t !== p[0]; }); });
    return out;
  }

  function unfamiliar(u) {
    if (!u._unf) {
      const fam = {};
      u.fam.forEach(function (p) { fam[key(p)] = 1; });
      u._unf = allPatterns(u).filter(function (p) { return !fam[key(p)]; });
    }
    return u._unf;
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // n patterns from a set, without repeating back to back.
  function draw(u, set, n) {
    const pool = set === 'unf' ? unfamiliar(u) : u.fam;
    const out = [];
    let bag = [];
    while (out.length < n) {
      if (!bag.length) bag = shuffle(pool);
      const p = bag.pop();
      if (out.length && key(out[out.length - 1]) === key(p) && pool.length > 1) continue;
      out.push(p);
    }
    return out;
  }

  function cardChoices(u, answer, n) {
    const others = shuffle(allPatterns(u).filter(function (p) { return key(p) !== key(answer); }));
    return shuffle([answer].concat(others.slice(0, n - 1)));
  }

  /* ---------------- sound timing ---------------- */
  // Onsets in beats, with the syllable for each.
  function rhythmEvents(p) {
    const ev = [];
    p.forEach(function (c, b) {
      CELLS[c].on.forEach(function (o, i) { ev.push({ beat: b + o, syl: CELLS[c].syl[i], tok: b }); });
    });
    return ev;
  }

  function freq(u, syl) {
    const k = KEYS[u.key];
    const d = DEG[syl];
    return 440 * Math.pow(2, (k.doMidi + SEMI[d % 7] + 12 * Math.floor(d / 7) - 69) / 12);
  }

  function tonic(u) {
    return [freq(u, 'do'), freq(u, 'mi'), freq(u, 'do') * 1.5].map(function (f) { return f / 2; });
  }

  function syllables(u, p) {
    if (u.track === 'tonal') return p.slice();
    return p.map(function (c) { return CELLS[c].syl.join('-'); });
  }

  /* ---------------- drawing ---------------- */
  function el(tag, attrs, kids) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function head(x, y, cls) {
    return el('ellipse', { cx: x, cy: y, rx: 6.6, ry: 4.8, transform: 'rotate(-20 ' + x + ' ' + y + ')', class: cls || '' });
  }

  function hiClass(i, opts) { return opts.hi === i ? 'hi' : ''; }

  // Rhythm on a single line. Empty slots (past p.length) show as boxes.
  function rhythmSVG(p, opts) {
    opts = opts || {};
    const slots = opts.slots || p.length;
    const W = 56, x0 = 40, Y = 50, TOP = 18;
    const width = x0 + slots * W + 14;
    const g = [];
    g.push(el('line', { x1: 4, x2: width - 4, y1: Y, y2: Y, class: 'staff' }));
    g.push(text(18, 40, '2'), text(18, 64, '4'));
    for (let b = 0; b < slots; b++) {
      const bx = x0 + b * W;
      if (b > 0 && b % 2 === 0) g.push(el('line', { x1: bx - 6, x2: bx - 6, y1: Y - 14, y2: Y + 14, class: 'bar' }));
      if (b >= p.length) {
        g.push(el('rect', { x: bx + 4, y: TOP, width: W - 18, height: Y - TOP + 12, rx: 6, class: 'slot' }));
        continue;
      }
      const c = p[b];
      const cls = hiClass(b, opts);
      const xs = CELLS[c].on.map(function (o) { return bx + 10 + o * (W - 12); });
      const grp = el('g', { class: 'note ' + cls });
      xs.forEach(function (x) {
        grp.appendChild(head(x, Y));
        grp.appendChild(el('line', { x1: x + 6, x2: x + 6, y1: Y - 1, y2: TOP, class: 'stem' }));
      });
      if (xs.length > 1) {
        grp.appendChild(el('rect', { x: xs[0] + 5, y: TOP, width: xs[xs.length - 1] - xs[0] + 2, height: 5.5, class: 'beam' }));
      }
      g.push(grp);
    }
    if (opts.end !== false && p.length >= slots) {
      g.push(el('line', { x1: width - 10, x2: width - 10, y1: Y - 14, y2: Y + 14, class: 'bar' }));
      g.push(el('rect', { x: width - 7, y: Y - 14, width: 3.5, height: 28, class: 'beam' }));
    }
    return el('svg', { viewBox: '0 0 ' + width + ' 80', class: 'notation', role: 'img' }, g);
  }

  function text(x, y, s) {
    const t = el('text', { x: x, y: y, class: 'tsig', 'text-anchor': 'middle' });
    t.textContent = s;
    return t;
  }

  const CLEF = 'M19 74 C13 77 10 68 16 66 C21 64 24 71 19 74 M19 74 L23 12 C24 4 31 7 29 17 C27 28 11 34 11 47 C11 57 22 61 28 55 C33 49 29 40 21 41 C15 42 15 50 21 51';

  // Solfege on a five-line staff in the unit's key.
  function tonalSVG(u, p, opts) {
    opts = opts || {};
    const k = KEYS[u.key];
    const slots = opts.slots || p.length;
    const SP = 44, x0 = 62;
    const width = x0 + slots * SP + 10;
    const g = [];
    for (let i = 0; i < 5; i++) g.push(el('line', { x1: 2, x2: width - 2, y1: 20 + i * 10, y2: 20 + i * 10, class: 'staff' }));
    if (opts.clef !== false) g.push(el('path', { d: CLEF, class: 'clef' }));
    (opts.clef === false ? [] : k.flats || []).forEach(function (s, i) {
      const y = 60 - s * 5, x = 38 + i * 9;
      g.push(el('path', { d: 'M' + x + ' ' + (y - 15) + ' L' + x + ' ' + (y + 4) + ' C' + (x + 9) + ' ' + (y - 1) + ' ' + (x + 8) + ' ' + (y - 8) + ' ' + x + ' ' + (y - 3), class: 'acc' }));
    });
    for (let i = 0; i < slots; i++) {
      const x = x0 + i * SP;
      if (i >= p.length) {
        g.push(el('rect', { x: x - 12, y: 14, width: 26, height: 52, rx: 6, class: 'slot' }));
        continue;
      }
      const step = k.doStep + DEG[p[i]];
      const y = 60 - step * 5;
      const grp = el('g', { class: 'note ' + hiClass(i, opts) });
      if (y >= 70) for (let ly = 70; ly <= y; ly += 10) grp.appendChild(el('line', { x1: x - 11, x2: x + 11, y1: ly, y2: ly, class: 'staff' }));
      grp.appendChild(head(x, y));
      if (y > 40) grp.appendChild(el('line', { x1: x + 6, x2: x + 6, y1: y - 1, y2: y - 33, class: 'stem' }));
      else grp.appendChild(el('line', { x1: x - 6, x2: x - 6, y1: y + 1, y2: y + 33, class: 'stem' }));
      g.push(grp);
    }
    return el('svg', { viewBox: '0 0 ' + width + ' 84', class: 'notation', role: 'img' }, g);
  }

  function notation(u, p, opts) {
    return u.track === 'tonal' ? tonalSVG(u, p, opts) : rhythmSVG(p, opts);
  }

  // One token alone, for the buttons in the writing games.
  function tokenSVG(u, t) {
    if (u.track === 'tonal') {
      const s = tonalSVG(u, [t], { clef: false, slots: 1 });
      s.setAttribute('viewBox', '34 10 56 64');
      return s;
    }
    const s = rhythmSVG([t], { end: false });
    const W = 56;
    s.setAttribute('viewBox', '36 10 ' + W + ' 60');
    return s;
  }

  function unit(id) { return UNITS.filter(function (u) { return u.id === id; })[0]; }

  return {
    STEPS, BANDS, UNITS, CELLS,
    unit, key, draw, allPatterns, cardChoices, shuffle, pick,
    rhythmEvents, freq, tonic, syllables, notation, tokenSVG
  };
})();
