/* Class times (class/present.js): what a whole-class run saves, in Chromium with a fake clock. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const MIN = 60e3;

let browser, mock;
before(async () => {
  mock = await startMock();
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
  await mock.close();
});

/** A built class deck (title, two songs, exit) in Present, on the title slide. */
async function presenting() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto(mock.base + '/404.html');
  await page.evaluate(async () => {
    const { present } = await import('/class/present.js');
    const store = await import('/class/store.js');
    const blank = (plan) => ({ els: [], bg: { type: 'solid', color: '#ffffff' }, ...(plan ? { plan } : {}) });
    const record = { id: 'c1', name: 'Class 1', deck: { w: 960, h: 540, built: { grade: 'K' },
      slides: [blank(), blank({ song: 'Song A', category: 'Echo' }), blank({ song: 'Song B', category: 'Move' }), blank()] } };
    window.closed = new Promise((resolve) => {
      window.show = present(record, 0, {}, (at, saved) => resolve(saved), null, {});
    });
    window.runs = async () => { await window.closed; return (await store.listTimings()).map((r) => ({ ms: store.classMs(r), songs: r.songs })); };
  });
  return page;
}

// A minute at a time, a tick each: as behind another app, where timers run once a minute.
async function wait(page, ms) {
  for (let t = 0; t < ms; t += MIN) await page.clock.fastForward(Math.min(MIN, ms - t));
}
const close = (page) => page.evaluate(() => window.show.close());
const key = (page, k) => page.keyboard.press(k);

test('the total is the songs, not the title or exit slide', async () => {
  const page = await presenting();
  await wait(page, 15 * MIN);              // title slide up before class
  await key(page, 'ArrowRight'); await wait(page, 10 * MIN);
  await key(page, 'ArrowRight'); await wait(page, 12 * MIN);
  await key(page, 'ArrowRight'); await wait(page, 40 * MIN);   // exit slide left up
  await close(page);
  const runs = await page.evaluate(() => window.runs());
  assert.equal(runs.length, 1);
  assert.equal(Math.round(runs[0].ms / 1000), 22 * 60);
  assert.deepEqual(runs[0].songs.map((x) => Math.round(x.ms / MIN)), [10, 12]);
});

test('time the device sleeps is not counted', async () => {
  const page = await presenting();
  await key(page, 'ArrowRight'); await wait(page, 10 * MIN);
  await page.clock.fastForward(60 * MIN);  // asleep: no ticks, then the clock jumps
  await wait(page, 2 * MIN);
  await key(page, 'ArrowRight'); await wait(page, 5 * MIN);
  await key(page, 'ArrowRight');
  await close(page);
  const runs = await page.evaluate(() => window.runs());
  assert.equal(Math.round(runs[0].ms / MIN), 17);
});

test('going back to the title slide from the exit slide starts the next class', async () => {
  const page = await presenting();
  for (const m of [10, 15]) {
    await key(page, 'ArrowRight'); await wait(page, m * MIN);
    await key(page, 'ArrowRight'); await wait(page, m * MIN);
    await key(page, 'ArrowRight'); await wait(page, 5 * MIN);
    await key(page, 'Home'); await wait(page, 3 * MIN);
  }
  await key(page, 'ArrowRight'); await key(page, 'ArrowRight'); await key(page, 'ArrowRight');
  await close(page);
  const runs = await page.evaluate(() => window.runs());
  assert.deepEqual(runs.map((r) => Math.round(r.ms / MIN)).sort((a, b) => a - b), [20, 30]);
});
