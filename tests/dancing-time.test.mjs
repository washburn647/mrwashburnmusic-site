/* Dancing Time (musician-maker/scene-dance.js) in Chromium: the scene builds in each of its rooms,
   takes every call, tap and beat the game sends, and plays every win, every fail and the boss
   without an error. Plus what other files read from it: its id and gags (tools/add_games.py),
   its tap sound, and the tambourine for Play It. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, ROOT), 'utf8');

/* A page with nothing but stages, the scene's styles and a few helpers. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/musician-maker/style.css">
<link rel="stylesheet" href="/musician-maker/scenes.css">
<link rel="stylesheet" href="/musician-maker/scene-dance.css">
<style>.stage-wrap { position: relative; width: 760px; height: 400px; flex: none; }</style>
</head><body><script type="module" src="/__dance.js"></script></body></html>`;
const DRIVER = `
import { dancingTime } from '/musician-maker/scene-dance.js';
import { GAMES, KITS } from '/musician-maker/games.js';
import { HITS } from '/musician-maker/sound.js';
import { lookOf, art } from '/musician-maker/instruments.js';
window.T = { dancingTime, GAMES, KITS, HITS, lookOf, art };
/* A new stage on the page, and the scene made on it. */
window.scene = (opts = {}, w = 760, ht = 400) => {
  const wrap = document.createElement('div');
  wrap.className = 'stage-wrap';
  wrap.style.width = w + 'px';
  wrap.style.height = ht + 'px';
  const stage = document.createElement('div');
  stage.className = 'stage';
  wrap.append(stage);
  document.body.append(wrap);
  return { stage, api: dancingTime.make(stage, opts) };
};
window.wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* One round as the game plays it, at the fastest tempo: beats, a call of four steps (du du de du),
   then the learner's four taps, a beat later each (jit: how far off each tap is, in beats).
   Resolves at the payoff. */
window.SPB = 0.42;
window.round = (api, taps = [['on', 0.02], ['on', 0.04], ['close', 0.12], ['on', 0]], tier = 1) => new Promise((done) => {
  const ms = window.SPB * 1000;
  for (let k = 0; k < 9; k++) setTimeout(() => api.onBeat(k % 2 === 0, window.SPB, tier), k * ms);
  ['du', 'du', 'de', 'du'].forEach((syl, i) => setTimeout(() => api.onCall(i, syl), i * ms));
  taps.forEach(([cls, jit], i) => setTimeout(() => api.onTap({ cls }), (4 + i + jit) * ms));
  setTimeout(done, 8 * ms + 20);
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
  await page.route('**/__dance.html', (r) => r.fulfill({ contentType: 'text/html', body: PAGE }));
  await page.route('**/__dance.js', (r) => r.fulfill({ contentType: 'text/javascript', body: DRIVER }));
  await page.goto(mock.base + '/__dance.html');
  await page.waitForFunction(() => window.T && window.scene);
});
after(async () => {
  await browser.close();
  await mock.close();
});
const noErrors = () => assert.deepEqual(errors.splice(0), []);

test('Dancing Time builds in each of its five rooms', async () => {
  const rooms = await page.evaluate(() => {
    const out = [];
    for (let k = 0; k < 5; k++) {
      const { stage } = window.scene();
      out.push({
        theme: stage.dataset.theme,
        scene: stage.classList.contains('scene-dt'),
        gram: !!stage.querySelector('.dt-gram .g-horn .googly'),
        judge: !!stage.querySelector('.dt-judge .j-owl'),
        mookie: !!stage.querySelector('.dt-mookie svg'),
        fans: stage.querySelectorAll('.dt-crowd .dt-fan').length,
        counts: [...stage.querySelectorAll('.dt-steps .dt-count')].map((c) => c.textContent).join(''),
        ball: !!stage.querySelector('.dt-ball canvas'),
      });
    }
    return out;
  });
  assert.deepEqual(rooms.map((r) => r.theme).sort(), ['arctic', 'disco', 'moon', 'reef', 'stage']);
  for (const r of rooms) assert.deepEqual(r, { ...r, scene: true, gram: true, judge: true, mookie: true, fans: 13, counts: '1234', ball: true });
  noErrors();
});

test('it takes every call, tap and beat the game sends, on a stage or not yet on one', async () => {
  const seen = await page.evaluate(async () => {
    const { stage, api } = window.scene();
    const out = {};
    const going = window.round(api, [['on', 0.02], ['close', 0.12], ['off', 0.45], ['tap', 0]], 4);
    await window.wait(3.5 * window.SPB * 1000);
    out.calls = stage.querySelectorAll('.dt-print.call').length;
    await going;
    for (const k of ['on', 'close', 'off', 'tap']) out[k] = stage.querySelectorAll(`.dt-print.${k}`).length;
    // And what else can come: an idle tap, a word with an off tap, and Note It's taps (no timing).
    for (const fb of [{ cls: 'idle' }, { cls: 'off', word: 'du!' }, {}, { word: 'de' }]) api.onTap(fb);
    out.tier = stage.dataset.tier;
    // The game makes each scene off the stage first, and may talk to that one for a moment.
    const off = window.T.dancingTime.make(document.createElement('div'), {});
    for (let t = 0; t <= 4; t++) off.onBeat(t % 2 === 0, window.SPB, t);
    ['du', 'du', 'de', null].forEach((syl, i) => off.onCall(i, syl));
    for (const fb of [{ cls: 'on' }, { cls: 'off', word: 'du!' }, { cls: 'idle' }, {}]) off.onTap(fb);
    off.win();
    await window.wait(600);
    return out;
  });
  assert.deepEqual(seen, { calls: 4, on: 1, close: 1, off: 1, tap: 1, tier: '4' });
  noErrors();
});

test('it plays every win and every fail', async () => {
  const { win, fail } = await page.evaluate(() => {
    const { gags } = window.T.dancingTime;
    return { win: Object.keys(gags.win), fail: Object.keys(gags.fail) };
  });
  assert.deepEqual(win, ['steps', 'moonwalk', 'spin', 'chorus', 'tango', 'dive']);
  assert.deepEqual(fail, ['yawn', 'record', 'sleepwalk', 'curtain', 'dream']);
  const marks = await page.evaluate(async ([win, fail]) => {
    const runs = await Promise.all([...win.map((g) => ['win', g]), ...fail.map((g) => ['fail', g])].map(async ([kind, gag]) => {
      const { stage, api } = window.scene();
      await window.round(api, kind === 'win' ? undefined : [['off', 0.4], ['close', 0.15]]);
      api[kind](gag);
      return { gag, stage };
    }));
    await window.wait(2.2 * window.SPB * 1000);
    const has = (stage, sel) => !!stage.querySelector(sel);
    const out = {};
    for (const { gag, stage } of runs) {
      const cat = stage.querySelector('.dt-mookie');
      out[gag] = {
        steps: has(stage, '.dt-print.shine'),
        moonwalk: has(stage, 'svg.dt-fedora') && cat.getAnimations().length > 0,
        spin: has(stage, '.j-owl.spin') && cat.getAnimations().length > 0,
        chorus: stage.querySelectorAll('.dt-clone').length === 4,
        tango: has(stage, 'svg.dt-rose') && has(stage, '.dt-flamingo.tango'),
        dive: has(stage, '.dt-mookie.dt-glow') && has(stage, '.dt-crowd.ready'),
        yawn: has(stage, 'svg.dt-cap') && has(stage, '.dt-night.on'),
        record: has(stage, '.dt-gram.droop'),
        sleepwalk: has(stage, '.dt-night.on') && cat.style.transformOrigin === '50% 100%',
        curtain: has(stage, '.dt-curtain .dt-tail'),
        dream: has(stage, '.dt-dream .dt-mini'),
      }[gag];
    }
    await window.wait(2.6 * window.SPB * 1000); // to the end of them all
    return out;
  }, [win, fail]);
  assert.deepEqual(marks, Object.fromEntries([...win, ...fail].map((g) => [g, true])));
  noErrors();
});

test('the boss: three hits and the mirror ball KOs him; or he takes the trophy', async () => {
  const seen = await page.evaluate(async () => {
    const one = window.scene({ boss: true });
    const two = window.scene({ boss: true });
    const out = {
      rusty: !!one.stage.querySelector('.dt-rusty .dt-suit'),
      banner: !!one.stage.querySelector('.dt-banner'),
    };
    for (const { api } of [one, two]) api.onBeat(true, 0.42, 1);
    one.api.hit();
    two.api.miss();
    await window.wait(300);
    one.api.miss();
    two.api.hit();
    await window.wait(300);
    one.api.hit();
    one.api.hit();
    two.api.miss();
    await window.wait(300);
    out.offAfterHits = one.stage.querySelectorAll('.dt-suit .pc.off').length;
    one.api.win();
    two.api.fail();
    const g = one.stage.querySelector('.dt-giant');
    out.giant = !!g && parseFloat(g.style.width) > 20 && g.style.getPropertyValue('--y') !== '';
    await window.wait(500);
    out.offAfterKO = one.stage.querySelectorAll('.dt-suit .pc.off').length;
    out.trophy = !!two.stage.querySelector('.ms-trophy');
    await window.wait(1200);
    return out;
  });
  assert.deepEqual(seen, { rusty: true, banner: true, offAfterHits: 3, giant: true, offAfterKO: 5, trophy: true });
  noErrors();
});

test('the game workshop and the tools can find it', async () => {
  const t = await page.evaluate(() => {
    const { GAMES, KITS, HITS, lookOf, art, dancingTime } = window.T;
    return {
      inGames: GAMES.includes(dancingTime),
      tap: HITS.includes(dancingTime.tap),
      kit: KITS['dancing-time'].instrument.sound,
      look: lookOf(KITS['dancing-time'].instrument),
      drawn: art('tambourine') !== art('drum') && art('tambourine').includes('jingle'),
    };
  });
  assert.deepEqual(t, { inGames: true, tap: true, kit: 'tambourine', look: 'tambourine', drawn: true });
  // tools/add_games.py reads each scene file's first id line and its one-line win and fail maps.
  const src = read('musician-maker/scene-dance.js');
  assert.equal(src.match(/^\s*id: '([a-z0-9-]+)',/m)[1], 'dancing-time');
  const gags = (kind) => [...src.match(new RegExp(`^\\s*${kind}: \\{(.*)\\},?$`, 'm'))[1].matchAll(/(\w+): /g)].map((m) => m[1]);
  assert.deepEqual(gags('win'), ['steps', 'moonwalk', 'spin', 'chorus', 'tango', 'dive']);
  assert.deepEqual(gags('fail'), ['yawn', 'record', 'sleepwalk', 'curtain', 'dream']);
  // Its styles load in the app and in the workshop.
  assert.match(read('musician-maker/index.html'), /href="scene-dance\.css"/);
  assert.match(read('studio/games/index.html'), /href="\/musician-maker\/scene-dance\.css"/);
});
