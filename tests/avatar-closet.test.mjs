/* Musician Maker's avatar (musician-maker/avatar.js) and closet (closet.js). In Node: every
   animal draws in every color, old saved looks still load. In Chromium, on a phone-sized page
   with the site's headers: the closet's rooms and groups, buying, the goal, outfits, shuffle,
   and the avatar staying in view while the items scroll. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const A = await import('../musician-maker/avatar.js');

test('every animal draws in every color, with every item, and nothing is left undefined', () => {
  for (const [kind] of A.ITEMS.kind) {
    for (const [color] of A.ITEMS.color) {
      const svg = A.avatarSvg({ kind, color, hat: 'crown', glasses: 'shades', hold: 'guitar', bg: 'space' });
      assert.doesNotMatch(svg, /undefined|NaN|null/, `${kind} ${color}`);
    }
    for (const slot of ['hat', 'glasses', 'hold', 'bg', 'kind', 'color', 'face']) {
      for (const [id] of A.ITEMS[slot]) assert.doesNotMatch(A.itemSvg(slot, id, { kind }), /undefined|NaN/, `${kind} ${slot} ${id}`);
    }
  }
  assert.equal(A.ITEMS.kind.length >= 20, true);
});

test('a look saved before the new animals still loads, and the default is the animal\'s own colors', () => {
  const st = { look: { kind: 'bear', color: 'orange', hat: 'crown' }, owned: ['kind:bear', 'hat:crown'] };
  assert.deepEqual(A.lookOf(st), { ...A.DEFAULT_LOOK, kind: 'bear', color: 'orange', hat: 'crown' });
  assert.equal(A.DEFAULT_LOOK.color, 'natural');
  // Not owned: back to the default.
  assert.equal(A.lookOf({ look: { kind: 'dragon' }, owned: [] }).kind, 'cat');
  // An outfit with something since lost (or never bought) is cleaned the same way.
  assert.equal(A.cleanLook({ owned: [] }, { kind: 'lion', hat: 'none' }).kind, 'cat');
});

const SAVE = 'musician-maker-stream-1';
let browser, mock, page;
const errors = [];
before(async () => {
  mock = await startMock({ headers: true });
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
});
after(async () => {
  await browser?.close();
  await mock?.close();
});
const noErrors = () => assert.deepEqual(errors.splice(0), []);
const saved = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);

async function openWith(st) {
  await page.goto(mock.base + '/musician-maker/');
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE, st]);
  await page.reload();
  await page.click('.to-closet');
  await page.waitForSelector('.closet .cl-item');
}

test('the closet: groups, items alone on their tiles, owned first, a goal, then buying it', async () => {
  await openWith({ tokens: 30, owned: [] });
  assert.equal(await page.locator('.cl-group').count(), 3);
  assert.deepEqual(await page.locator('.cl-tab').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))), ['kind', 'color', 'face']);
  // The animals you have come first.
  const first = await page.locator('.cl-item').evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute('aria-label')));
  assert.deepEqual(first, ['cat', 'bunny']);

  // Wear > Hold: the held things alone, fitted to their tiles.
  await page.click('.cl-group[aria-label="wear"]');
  await page.click('.cl-tab[aria-label="hold"]');
  const vb = await page.locator('.cl-item[aria-label^="trumpet"] .art svg').getAttribute('viewBox');
  assert.notEqual(vb, '0 0 200 220');

  // Too dear: 🎯 makes it the goal; the title shows it.
  await page.click('.cl-item[aria-label^="guitar"]');
  await page.click('.cl-goal');
  assert.equal((await saved()).goal, 'hold:guitar');
  assert.equal(await page.locator('.cl-item[aria-label^="guitar"] .goal-pin').count(), 1);
  await page.click('.cl-head .back');
  await page.waitForSelector('.to-goal .goal-chip');
  assert.match(await page.locator('.to-goal .goal-chip').getAttribute('aria-label'), /30 of 50/);

  // With the notes, buying it clears the goal and puts it on.
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.tokens = 60; localStorage.setItem(k, JSON.stringify(s)); }, SAVE);
  await page.reload();
  assert.match(await page.locator('.to-goal .goal-chip').getAttribute('aria-label'), /enough/);
  await page.click('.to-goal .goal-chip', { force: true }); // it throbs when there are enough notes
  await page.click('.cl-group[aria-label="wear"]');
  await page.click('.cl-tab[aria-label="hold"]');
  await page.click('.cl-item[aria-label^="guitar"]');
  await page.waitForTimeout(300); // the bar slides up
  await page.click('.cl-buy', { force: true });
  const st = await saved();
  assert.equal(st.goal, null);
  assert.equal(st.tokens, 10);
  assert.equal(st.look.hold, 'guitar');
  assert.ok(st.owned.includes('hold:guitar'));
  noErrors();
});

test('outfits keep a look and put it back on; shuffle uses only what you have', async () => {
  await openWith({ tokens: 0, owned: ['kind:fox', 'hat:crown'], look: { kind: 'fox', hat: 'crown' } });
  await page.click('.cl-outfit-wear >> nth=0');
  assert.deepEqual((await saved()).outfits[0], { ...A.DEFAULT_LOOK, kind: 'fox', hat: 'crown' });
  await page.click('.cl-item[aria-label="bunny"]');
  assert.equal((await saved()).look.kind, 'bunny');
  await page.click('.cl-outfit-wear >> nth=0');
  assert.equal((await saved()).look.kind, 'fox');
  for (let i = 0; i < 8; i++) {
    await page.click('.cl-shuffle');
    const { look } = await saved();
    for (const [slot, id] of Object.entries(look)) assert.ok(A.owns({ owned: ['kind:fox', 'hat:crown'] }, slot, id), `${slot}:${id}`);
  }
  noErrors();
});

test('the avatar stays in view while the items scroll, and the record shop sells grooves', async () => {
  await openWith({ tokens: 5, owned: [] });
  const stageTop = async () => (await page.locator('.cl-stage').boundingBox()).y;
  const before = await stageTop();
  await page.locator('.cl-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.click('.cl-item[aria-label^="dragon"]');
  assert.equal(await stageTop(), before);
  assert.equal(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), true);
  await page.click('.cl-room[aria-label="Record shop"]');
  await page.waitForSelector('.cl-groove');
  assert.equal(await page.locator('.cl-group').count(), 0);
  assert.equal(await page.locator('.cl-shuffle').count(), 0);
  assert.equal(await page.locator('.cl-groove[aria-label="Mix"].on').count(), 1);
  noErrors();
});
