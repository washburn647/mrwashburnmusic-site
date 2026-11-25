/* Melodic runs and Bedtime (musician-maker/scene-bed.js). In Node: the mic's pitch tracker
   (mic-worklet.js). In Chromium: how a sung or played tune is graded (turn.js), the director's
   melodic track, the Bedtime scene in each room with every gag and its boss, and Supper Time
   and Dancing Time taking a tune. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PitchTracker } = require('../musician-maker/mic-worklet.js');

test('the pitch tracker hears the pitch of a voice from low men to high kids, and not noise', () => {
  const rate = 48000;
  for (const f of [98, 147, 220, 262, 330, 440, 587, 784]) {
    const p = new PitchTracker(rate);
    for (let s = 0; s < 4096; s += 128) {
      const x = new Float32Array(128);
      // A buzzy voice: a fundamental and falling harmonics.
      for (let i = 0; i < 128; i++) {
        const t = (s + i) / rate;
        x[i] = 0.5 * Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t) + 0.2 * Math.sin(6 * Math.PI * f * t);
      }
      p.push(x);
    }
    const got = p.find();
    assert.ok(got && Math.abs(12 * Math.log2(got.hz / f)) < 0.1, `${f} Hz heard as ${got?.hz}`);
  }
  const p = new PitchTracker(rate);
  let seed = 7;
  const x = new Float32Array(4096).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5);
  p.push(x);
  assert.equal(p.find(), null);
});

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/musician-maker/style.css">
<link rel="stylesheet" href="/musician-maker/scenes.css">
<link rel="stylesheet" href="/musician-maker/scene-supper.css">
<link rel="stylesheet" href="/musician-maker/scene-dance.css">
<link rel="stylesheet" href="/musician-maker/scene-bed.css">
<style>.stage-wrap { position: relative; width: 760px; height: 400px; flex: none; }</style>
</head><body><script type="module" src="/__bed.js"></script></body></html>`;
const DRIVER = `
import { bedtime } from '/musician-maker/scene-bed.js';
import { supperTime } from '/musician-maker/scene-supper.js';
import { dancingTime } from '/musician-maker/scene-dance.js';
import { GAMES } from '/musician-maker/games.js';
import * as turn from '/musician-maker/turn.js';
import { makeDirector } from '/musician-maker/director.js';
import { byId, MTONES, onsets, toneHeight } from '/musician-maker/steps.js';
import { TASKS } from '/musician-maker/tasks.js';
import { TONES } from '/assets/patterns/patterns.js';
window.T = { bedtime, supperTime, dancingTime, GAMES, turn, makeDirector, byId, MTONES, onsets, toneHeight, TASKS, TONES };
window.scene = (game = bedtime, opts = {}) => {
  const wrap = document.createElement('div');
  wrap.className = 'stage-wrap';
  const stage = document.createElement('div');
  stage.className = 'stage';
  wrap.append(stage);
  document.body.append(wrap);
  return { stage, api: game.make(stage, opts) };
};
window.wait = (ms) => new Promise((r) => setTimeout(r, ms));
window.SPB = 0.42;
/* A tune's call (do re mi by default) and the learner's notes a beat later each (fb: what each tap says). */
window.round = (api, tones = ['do', 're', 'mi'], fbs = [{ cls: 'on' }, { cls: 'on' }, { cls: 'close' }]) => new Promise((done) => {
  const ms = window.SPB * 1000;
  for (let k = 0; k < 8; k++) setTimeout(() => api.onBeat(k % 2 === 0, window.SPB, 1), k * ms);
  tones.forEach((tone, i) => setTimeout(() => api.onCall(i, tone, { tone, up: toneHeight(tone) }), i * ms));
  fbs.forEach((fb, i) => setTimeout(() => api.onTap(fb), (4 + i) * ms));
  setTimeout(done, 7.5 * ms);
});
`;

let browser, mock, page;
const errors = [];
before(async () => {
  mock = await startMock();
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('**/__bed.html', (r) => r.fulfill({ contentType: 'text/html', body: PAGE }));
  await page.route('**/__bed.js', (r) => r.fulfill({ contentType: 'text/javascript', body: DRIVER }));
  await page.goto(mock.base + '/__bed.html');
  await page.waitForFunction(() => window.T && window.scene);
});
after(async () => {
  await browser?.close();
  await mock?.close();
});
const noErrors = () => assert.deepEqual(errors.splice(0), []);

test('a sung tune counts by its shape: any key, any octave, a little out of tune', async () => {
  const r = await page.evaluate(() => {
    const { tuneMatches, tonesOf } = window.T.turn;
    const tones = ['do', 're', 'mi'];
    return {
      exact: tuneMatches([60, 62, 64], tones).ok,
      octaveDown: tuneMatches([48, 50, 52], tones).ok,
      otherKey: tuneMatches([66.3, 68.1, 70.4], tones).ok,
      flatRe: tuneMatches([60, 61.2, 64], tones).ok,
      wrongNote: tuneMatches([60, 64, 62], tones).ok,
      upsideDown: tuneMatches([64, 62, 60], tones).ok,
      unheard: tuneMatches([60, null, 64], tones).why,
      ownTune: tonesOf([64.2, 59.8, 61.9], 60),
      ownTuneOctave: tonesOf([76, 72, 74], 60),
      notATone: tonesOf([60, 66, 64], 60),
    };
  });
  assert.deepEqual(r, {
    exact: true, octaveDown: true, otherKey: true, flatRe: true, wrongNote: false, upsideDown: false, unheard: 'unheard',
    ownTune: ['mi', 'do', 're'], ownTuneOctave: ['mi', 'do', 're'], notATone: null,
  });
});

test('a legato tune the onset finder runs together is split by pitch', async () => {
  const r = await page.evaluate(() => {
    const { pitchNotes, notePitches } = window.T.turn;
    // 0.4 s each of do, re, mi with no gap, a frame every 20 ms, and an octave slip in re.
    const pts = [];
    [60, 62, 64].forEach((m, k) => {
      for (let j = 0; j < 20; j++) pts.push({ t: 1 + k * 0.4 + j * 0.02, midi: m + (k === 1 && j === 7 ? 12 : 0) + (j % 3) * 0.05, clarity: 0.95 });
    });
    const starts = pitchNotes(pts);
    return { n: starts.length, starts: starts.map((t) => Math.round(t * 10) / 10), midis: notePitches(starts, pts, 0.4).map((m) => Math.round(m)) };
  });
  assert.deepEqual(r, { n: 3, starts: [1, 1.4, 1.8], midis: [60, 62, 64] });
});

/* A turn on its own clock: tResp 10 s, a beat every half second. */
const TURN = `(task, step, tones, inputs, { pitches = [], doMidi = 60 } = {}) => {
  const { makeTurn } = window.T.turn;
  const h = (tag, props = {}, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(props || {})) { if (k.startsWith('on')) el[k] = v; else if (v != null) el.setAttribute(k, v); } el.append(...kids.flat().filter((x) => x != null)); return el; };
  let now = 0;
  const pattern = window.T.byId('tonal/major/' + tones.join('-'));
  const t = makeTurn({ task, step, stim: { hear: 'neutral', see: null }, pattern }, window.T.bedtime, {
    h, mic: true, tResp: 10, spb: 0.5, doMidi, now: () => now, latency: () => 0, hit() {}, note() {},
    pitches: (a, b) => pitches.filter((p) => p.t >= a && p.t <= b),
  });
  for (const [time, key] of inputs) { now = time; if (key === 'mic') t.input(time, true); else t.keys({ key, preventDefault() {} }); }
  return t.grade();
}`;

test('Play It on the harp: the right notes in time, else which way it went wrong', async () => {
  const r = await page.evaluate(`(() => {
    const grade = ${TURN};
    return {
      right: grade('tune', 1, ['do', 're', 'mi'], [[10.02, '1'], [10.51, '2'], [11.0, '3']]),
      wrongNote: grade('tune', 1, ['do', 're', 'mi'], [[10.02, '1'], [10.51, '3'], [11.0, '3']]).why,
      late: grade('tune', 1, ['do', 're', 'mi'], [[10.02, '1'], [10.51, '2'], [11.4, '3']]).right,
      missing: grade('tune', 1, ['do', 're', 'mi'], [[10.02, '1'], [10.51, '2']]).why,
      own: grade('tune', 5, ['do', 're', 'mi'], [[10.0, '3'], [10.5, '1'], [11.0, '2']]),
      same: grade('tune', 5, ['do', 're', 'mi'], [[10.0, '1'], [10.5, '2'], [11.0, '3']]).why,
    };
  })()`);
  assert.equal(r.right.right, true);
  assert.equal(r.right.perfect, true);
  assert.equal(r.wrongNote, 'tones');
  assert.equal(r.late, false);
  assert.equal(r.missing, 'missing');
  assert.equal(r.own.right, true);
  assert.equal(r.own.got.id, 'tonal/major/mi-do-re');
  assert.equal(r.same, 'same');
  noErrors();
});

test('Sing It: the notes the mic finds, and how high each one was sung', async () => {
  const r = await page.evaluate(`(() => {
    const grade = ${TURN};
    const sung = (midis, from = 10.02) => midis.flatMap((m, k) => Array.from({ length: 16 }, (_, j) => ({ t: from + k * 0.5 + 0.03 + j * 0.02, midi: m, clarity: 0.92 })));
    const at = [[10.02, 'mic'], [10.52, 'mic'], [11.02, 'mic']];
    return {
      right: grade('sing', 2, ['mi', 're', 'do'], at, { pitches: sung([57, 55, 53]) }),
      wrong: grade('sing', 2, ['mi', 're', 'do'], at, { pitches: sung([53, 55, 57]) }).why,
      silent: grade('sing', 2, ['mi', 're', 'do'], at, { pitches: [] }).why,
      legato: grade('sing', 2, ['mi', 're', 'do'], [[10.02, 'mic']], { pitches: sung([69, 67, 65]) }).right,
      own: grade('sing', 5, ['do', 're', 'mi'], at, { pitches: sung([62, 60, 64]), doMidi: 60 }).got?.id,
    };
  })()`);
  assert.equal(r.right.right, true);
  assert.deepEqual(r.right.sung, [57, 55, 53]);
  assert.equal(r.wrong, 'pitch');
  assert.equal(r.silent, 'unheard');
  assert.equal(r.legato, true);
  assert.equal(r.own, 'tonal/major/re-do-mi');
  noErrors();
});

test('melodic runs have their own track: tonal patterns, Sing It and Play It, steps 1 to 8', async () => {
  const r = await page.evaluate(() => {
    const st = { mookie: false, frontier: 3, steps: {}, tasks: {}, pat: {}, feat: {} };
    const d = window.T.makeDirector(st, 'tonal');
    const items = Array.from({ length: 40 }, () => d.next());
    const noMic = Array.from({ length: 20 }, () => d.next({ noSay: true }));
    const forced = d.next({ force: 12 });
    const r0 = d.record({ item: items[0], right: true, bpm: 108 });
    return {
      kinds: [...new Set(items.map((i) => i.pattern.kind))],
      tasks: [...new Set(items.map((i) => i.task))].sort(),
      steps: Math.max(...items.map((i) => i.step)),
      noMic: [...new Set(noMic.map((i) => i.task))],
      forced: forced.step,
      own: !!st.mel && st.frontier === 3 && Object.keys(st.steps).length === 0 && r0 !== undefined,
      melodicTasks: window.T.TASKS.filter((t) => t.kind === 'tonal').map((t) => t.id),
    };
  });
  assert.deepEqual(r, { kinds: ['tonal'], tasks: ['sing', 'tune'], steps: 1, noMic: ['tune'], forced: 8, own: true, melodicTasks: ['sing', 'tune'] });
});

test('Bedtime builds in each of its five rooms, melodic only, with the harp', async () => {
  const rooms = await page.evaluate(() => {
    const out = [];
    for (let k = 0; k < 5; k++) {
      const { stage } = window.scene();
      out.push({
        theme: stage.dataset.theme,
        owl: !!stage.querySelector('.bd-owl .o-head') && stage.querySelectorAll('.bd-owl .googly').length === 2,
        kid: !!stage.querySelector('.bd-kid svg'),
        mookie: !!stage.querySelector('.bd-mookie svg'),
        door: !!stage.querySelector('.bd-hall') && !!stage.querySelector('.bd-frame'),
      });
    }
    const g = window.T.bedtime;
    return { out, modes: g.modes, tune: g.kit.tune.look, inGames: window.T.GAMES.includes(g), bossName: g.bossName };
  });
  assert.deepEqual(rooms.out.map((r) => r.theme).sort(), ['castle', 'kid', 'space', 'tent', 'tree']);
  for (const r of rooms.out) assert.deepEqual(r, { ...r, owl: true, kid: true, mookie: true, door: true });
  assert.deepEqual({ ...rooms, out: null }, { out: null, modes: ['tonal'], tune: 'harp', inGames: true, bossName: 'The Bed Hog' });
  noErrors();
});

test('each note of the call lights a star as high as the note, and Mookie comes closer with each answer', async () => {
  const r = await page.evaluate(async () => {
    const { stage, api } = window.scene();
    const left = () => parseFloat(stage.querySelector('.bd-mookie').style.left);
    const at0 = left();
    const going = window.round(api, ['mi', 'do', 're'], [{ cls: 'on', up: 1 }, { cls: 'close', up: 0 }, { cls: 'off', up: 0 }]);
    await window.wait(3.5 * window.SPB * 1000);
    const ups = [...stage.querySelectorAll('.bd-star.call')].map((s) => Number(s.style.getPropertyValue('--up')));
    await going;
    return {
      ups,
      mine: ['on', 'close', 'off'].map((k) => stage.querySelectorAll(`.bd-star.mine.${k}`).length),
      closer: left() < at0,
      come: stage.dataset.come,
    };
  });
  // Two right answers bring him in two steps from the eyes in the dark; the sour note doesn't.
  assert.deepEqual(r, { ups: [1, 0, 0.5], mine: [1, 1, 1], closer: true, come: '3' });
  noErrors();
});

test('it plays every win and every miss', async () => {
  const { win, fail } = await page.evaluate(() => ({ win: Object.keys(window.T.bedtime.gags.win), fail: Object.keys(window.T.bedtime.gags.fail) }));
  assert.deepEqual(win, ['snuggle', 'biscuits', 'hat', 'sock', 'pile']);
  assert.deepEqual(fail, ['crickets', 'dustbunny', 'eyes', 'tail', 'basket', 'rusty']);
  const marks = await page.evaluate(async ([win, fail]) => {
    const runs = await Promise.all([...win.map((g) => ['win', g]), ...fail.map((g) => ['fail', g])].map(async ([kind, gag]) => {
      const { stage, api } = window.scene();
      await window.round(api);
      api[kind](gag);
      return { kind, gag, stage };
    }));
    await window.wait(1300);
    const has = (stage, sel) => !!stage.querySelector(sel);
    const out = {};
    for (const { kind, gag, stage } of runs) {
      const zoomed = stage.querySelector('.bd-cam').style.transform.includes('scale');
      out[gag] = kind === 'fail' ? zoomed && {
        crickets: true,
        dustbunny: has(stage, '.bd-dustbunny'),
        eyes: stage.dataset.come === '2',
        tail: has(stage, '.bd-tail'),
        basket: has(stage, '.bd-cut .bd-basket-cat'),
        rusty: has(stage, '.bd-impostor.in'),
      }[gag] : has(stage, '.bd-mookie.onbed') && {
        snuggle: true,
        biscuits: true,
        hat: has(stage, '.bd-mookie.hat'),
        sock: has(stage, '.bd-sock.dropped'),
        pile: stage.querySelectorAll('.bd-piler.in').length === 2 && has(stage, '.bd-bed.sag'),
      }[gag];
    }
    await window.wait(800);
    return out;
  }, [win, fail]);
  assert.deepEqual(marks, Object.fromEntries([...win, ...fail].map((g) => [g, true])));
  noErrors();
});

test('The Bed Hog droops with each lullaby, sits up at a miss, and rolls off for Mookie', async () => {
  const r = await page.evaluate(async () => {
    const one = window.scene(window.T.bedtime, { boss: true });
    const two = window.scene(window.T.bedtime, { boss: true });
    const out = { hog: !!one.stage.querySelector('.bd-hog'), dogbed: !!one.stage.querySelector('.bd-dogbed') };
    await window.round(one.api);
    one.api.hit();
    one.api.hit();
    one.api.miss();
    one.api.hit();
    one.api.hit();
    out.droop = one.stage.querySelector('.bd-hog').dataset.droop;
    two.api.miss();
    out.pot = !!two.stage.querySelector('.bd-pot');
    one.api.win();
    two.api.fail();
    await window.wait(1800);
    out.rolled = one.stage.querySelector('.bd-hog').classList.contains('rolled');
    out.mookieOnBed = one.stage.querySelector('.bd-mookie').classList.contains('onbed');
    out.mookieFloor = two.stage.querySelector('.bd-mookie').classList.contains('floor');
    return out;
  });
  assert.deepEqual(r, { hog: true, dogbed: true, droop: '3', pot: true, rolled: true, mookieOnBed: true, mookieFloor: true });
  noErrors();
});

test('Supper Time and Dancing Time take a tune too: crates as high as the notes, paw prints on their rows', async () => {
  const r = await page.evaluate(async () => {
    const sp = window.scene(window.T.supperTime);
    const dt = window.scene(window.T.dancingTime);
    await Promise.all([window.round(sp.api, ['do', 'mi', 're']), window.round(dt.api, ['do', 'mi', 're'], [{ cls: 'on', up: 0 }, { cls: 'on', up: 0.5 }, { cls: 'on' }])]);
    return {
      modes: [window.T.supperTime.modes, window.T.dancingTime.modes],
      tunes: [window.T.supperTime.kit.tune.look, window.T.dancingTime.kit.tune.look],
      crates: [...sp.stage.querySelectorAll('.sp-crate')].map((c) => Number(c.style.getPropertyValue('--up'))),
      rows: dt.stage.querySelector('.dt-steps').classList.contains('tonal'),
      callUps: [...dt.stage.querySelectorAll('.dt-print')].filter((p) => p.style.getPropertyValue('--up') !== '').length,
      wrongRow: dt.stage.querySelectorAll('.dt-print.off').length,
    };
  });
  assert.deepEqual(r.modes, [['rhythm', 'tonal'], ['rhythm', 'tonal']]);
  assert.deepEqual(r.tunes, ['bowls', 'xylophone']);
  assert.deepEqual(r.crates, [0, 1, 0.5]);
  assert.equal(r.rows, true);
  assert.ok(r.callUps >= 3);
  assert.equal(r.wrongRow, 1); // the second note played on do's row where the call had mi
  noErrors();
});
