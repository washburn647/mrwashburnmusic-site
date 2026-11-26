/* Musician Maker's path (musician-maker/path.js): Unit 1's rhythm, then do re mi, in one
   stream. In Chromium (path.js reads the site's pattern files): which units are open, how a
   set mixes them, the workshop's opensAt, a unit opening at a break, bosses and drills. Then
   the game's title and My progress with two units. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SAVE = 'musician-maker-stream-1';

let browser, mock, page;
const errors = [];
before(async () => {
  mock = await startMock({ headers: true });
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(mock.base + '/musician-maker/');
  await page.evaluate(async () => { window.P = await import('/musician-maker/path.js'); });
});
after(async () => {
  await browser?.close();
  await mock?.close();
});
const noErrors = () => assert.deepEqual(errors.splice(0), []);

/* A save with Unit 1's steps 1 to n-1 mastered and its frontier at n. */
const mastered = (n) => ({
  frontier: n,
  steps: Object.fromEntries(Array.from({ length: n - 1 }, (_, i) => [i + 1, { s: 90, n: 20, fast: 5, mastered: true, seen: 1 }])),
  tasks: {}, pat: {}, feat: {},
});

test('a new learner has Unit 1 only, and every game is rhythm', async () => {
  const out = await page.evaluate((st) => {
    const path = window.P.makePath(st);
    const kinds = new Set();
    for (let i = 0; i < 200; i++) kinds.add(path.next({ set: i % 3 }).kind);
    return { open: path.open().map((u) => u.id), kinds: [...kinds] };
  }, mastered(1));
  assert.deepEqual(out, { open: ['unit-1'], kinds: ['rhythm'] });
  noErrors();
});

test('once Unit 1\'s ear steps are mastered, do re mi joins, and each set leans on its own unit', async () => {
  const out = await page.evaluate((st) => {
    const path = window.P.makePath(st);
    const sets = [];
    for (const [set, lap] of [[0, 0], [1, 0], [2, 0], [0, 1]]) {
      const c = { rhythm: 0, tonal: 0, review: 0, reviews: 0 };
      for (let i = 0; i < 600; i++) {
        const it = path.next({ set, lap, noSay: true });
        c[it.kind]++;
        // Unit 1's review games are its mastered steps (do re mi has none yet).
        if (it.kind === 'rhythm' && path.focusOf(set, lap).kind === 'tonal') { c.reviews++; if (it.step < 6) c.review++; }
      }
      sets.push({ focus: path.focusOf(set, lap).id, ...c });
    }
    return { open: path.open().map((u) => u.id), sets, keys: Object.keys(path.strengths()) };
  }, mastered(6));
  assert.deepEqual(out.open, ['unit-1', 'unit-4']);
  // The focus takes turns, starting one later each lap.
  assert.deepEqual(out.sets.map((s) => s.focus), ['unit-1', 'unit-4', 'unit-1', 'unit-4']);
  for (const s of out.sets) {
    const share = s[s.focus === 'unit-1' ? 'rhythm' : 'tonal'] / 600;
    assert.ok(share > 0.62 && share < 0.78, `${s.focus} ${share}`);
  }
  const rev = out.sets.find((s) => s.reviews);
  assert.equal(rev.review, rev.reviews);
  assert.deepEqual(out.keys, [...Array.from({ length: 12 }, (_, i) => `unit-1:${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `unit-4:${i + 1}`)]);
  noErrors();
});

test('a learner who played melodic runs before keeps do re mi', async () => {
  const open = await page.evaluate((st) => window.P.makePath(st).open().map((u) => u.id),
    { ...mastered(2), mel: { frontier: 1, steps: { 1: { s: 40, n: 3, fast: 0, mastered: false } }, tasks: {}, pat: {}, feat: {} } });
  assert.deepEqual(open, ['unit-1', 'unit-4']);
  noErrors();
});

test('the workshop can open do re mi sooner or later', async () => {
  const out = await page.evaluate(([at3, at6]) => ({
    sooner: window.P.makePath(at3, { opensAt: { 'unit-4': 3 } }).open().length,
    notYet: window.P.makePath(at3).open().length,
    allOf: window.P.makePath(at6, { opensAt: { 'unit-4': 13 } }).open().length,
  }), [mastered(3), mastered(12)]);
  assert.deepEqual(out, { sooner: 2, notYet: 1, allOf: 1 });
  const done = await page.evaluate((st) => {
    st.steps[12] = { s: 90, n: 20, fast: 5, mastered: true };
    return window.P.makePath(st, { opensAt: { 'unit-4': 13 } }).open().length;
  }, mastered(12));
  assert.equal(done, 2);
  noErrors();
});

test('mastering step 5 opens step 6 and do re mi at the next break', async () => {
  const out = await page.evaluate((st) => {
    st.steps[5] = { s: 90, n: 20, fast: 5, mastered: true };
    const path = window.P.makePath(st);
    const was = path.open().length;
    const { steps, units } = path.advance();
    return { was, steps: steps.map((s) => `${s.unit.id}:${s.n}`), units: units.map((u) => u.id), now: path.open().length };
  }, { ...mastered(5) });
  assert.deepEqual(out, { was: 1, steps: ['unit-1:6'], units: ['unit-4'], now: 2 });
  noErrors();
});

test('a boss plays only the kinds its game can, a drill stays on its unit, and a workshop test on its kind', async () => {
  const out = await page.evaluate((st) => {
    const path = window.P.makePath(st);
    const kinds = (o) => [...new Set(Array.from({ length: 100 }, () => path.next(o).kind))].sort();
    const drill = Array.from({ length: 30 }, () => path.next({ force: 3, forceUnit: 'unit-4' }));
    const tonal = window.P.makePath(st, { only: 'tonal' });
    return {
      melodicBoss: kinds({ set: 0, kinds: ['tonal'] }),
      rhythmBoss: kinds({ set: 1, kinds: ['rhythm'] }),
      both: kinds({ set: 1, kinds: ['rhythm', 'tonal'] }),
      drill: [...new Set(drill.map((it) => `${it.unit}:${it.step}`))],
      test: [...new Set(Array.from({ length: 50 }, () => tonal.next({ set: 0 }).kind))],
      testUnits: tonal.units.map((u) => u.id),
    };
  }, mastered(6));
  assert.deepEqual(out, {
    melodicBoss: ['tonal'], rhythmBoss: ['rhythm'], both: ['rhythm', 'tonal'],
    drill: ['unit-4:3'], test: ['tonal'], testUnits: ['unit-4'],
  });
  noErrors();
});

test('the title shows both units, and My progress has a tab for each', async () => {
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE, mastered(6)]);
  await page.reload();
  await page.waitForSelector('.unit-tag .ut');
  assert.deepEqual(await page.locator('.unit-tag .ut').allInnerTexts(), ['Unit 1 du · du-de', '🎵 do · re · mi']);
  await page.click('text=My progress');
  await page.waitForSelector('.punit');
  // The newest unit first.
  assert.equal(await page.locator('.punit.on').getAttribute('class'), 'punit tonal on ');
  assert.equal(await page.locator('.map .pnode').count(), 8);
  await page.click('.punit.rhythm');
  assert.equal(await page.locator('.map .pnode').count(), 12);
  assert.match(await page.locator('.phead p').innerText(), /Unit 1 · du · du-de · 5 of 12/);

  // Before it opens: locked, with when it opens.
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE, mastered(2)]);
  await page.reload();
  assert.deepEqual(await page.locator('.unit-tag .ut').allInnerTexts(), ['Unit 1 du · du-de']);
  await page.click('text=My progress');
  await page.click('.punit.tonal');
  assert.match(await page.locator('.progress .note').innerText(), /Opens once Unit 1's ear steps/);
  assert.equal(await page.locator('.map .pnode.locked').count(), 8);
  noErrors();
});
