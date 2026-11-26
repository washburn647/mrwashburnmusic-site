/* Musician Maker's shop (musician-maker/shop.js): the catalog, the studio shop editor's
   overrides (completeShop), prizes won by beating a boss or mastering a step, and keeping what
   a learner has. In Chromium: prizes in the closet (✨ when just won, how to win one), the
   collection book, hidden items, and the learner's avatar beside the band in a run. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const S = await import('../musician-maker/shop.js');

const ids = (list) => list.map((x) => x.id);

test('the shop editor\'s file changes prices, names, order and what\'s hidden, and nothing else', () => {
  const plain = S.completeShop({});
  for (const { id } of S.SLOTS) assert.deepEqual(ids(plain.items[id]), ids(S.CATALOG[id]));
  assert.deepEqual(plain.earn, { every: 3, clean: 1, boss: 3, bossTry: 1, daily: 2 });
  assert.equal(plain.groovePrice, 60);

  const shop = S.completeShop({
    items: {
      hat: [
        { id: 'crown', price: 99, name: '  Big crown  ' },
        { id: 'none', price: 50, hidden: true },
        { id: 'bogus', price: 1 },
        { id: 'crown', price: 1 },
        { id: 'beanie', hidden: true, price: -4 },
        { id: 'chef', unlock: { step: 'unit-1:3' } },
        { id: 'tophat', unlock: { boss: 'nobody' } },
        { id: 'party', unlock: { level: 4 } },
      ],
    },
    earn: { every: 0, boss: 7, daily: 999 },
    groovePrice: 25,
  });
  const hats = shop.items.hat;
  // The default stays first, free and shown; the rest in the file's order, then the catalog's.
  assert.deepEqual(ids(hats).slice(0, 6), ['none', 'crown', 'beanie', 'chef', 'tophat', 'party']);
  assert.equal(hats.length, S.CATALOG.hat.length);
  assert.deepEqual(hats[0], { id: 'none', name: 'No hat', price: 0 });
  assert.deepEqual(hats[1], { id: 'crown', name: 'Big crown', price: 99 });
  assert.deepEqual(hats[2], { id: 'beanie', name: 'Beanie', price: 15, hidden: true });
  assert.deepEqual(hats[3].unlock, { step: 'unit-1:3' });
  assert.equal(hats[4].unlock, undefined); // no such boss: on sale instead
  assert.deepEqual(hats[5].unlock, { level: 4 });
  assert.deepEqual(shop.earn, { every: 3, clean: 1, boss: 7, bossTry: 1, daily: 2 });
  assert.equal(shop.groovePrice, 25);
  // Another slot the file doesn't mention is as it ships.
  assert.deepEqual(shop.items.kind, S.CATALOG.kind);
});

test("prizes: a boss's trophy, a mastered step's prize, a level's; and they're announced once", () => {
  S.applyShop(S.completeShop({ items: { hat: [{ id: 'party', price: 0, unlock: { level: 2 } }, { id: 'bow', unlock: { level: 2 } }] } }));
  try {
    const st = { owned: [], bosses: {}, steps: {}, mel: { steps: {} }, xp: 0, gifts: [] };
    assert.equal(S.owns(st, 'hat', 'cheese'), false);
    assert.equal(S.forSale(st, S.itemOfSlot('hat', 'cheese')), false);
    st.bosses['mouse-catcher'] = 1;
    assert.equal(S.owns(st, 'hat', 'cheese'), true);
    assert.equal(S.owns(st, 'hat', 'chef'), false);
    // Unit 1's steps in the save's top level, do re mi's in st.mel.
    st.steps[5] = { mastered: true };
    st.mel.steps[1] = { mastered: true };
    assert.equal(S.owns(st, 'hat', 'beret'), true);
    assert.equal(S.owns(st, 'hold', 'bell'), true);
    assert.equal(S.owns(st, 'shoes', 'winged'), false);
    // A level prize: not yet at level 1, won at level 2 (150 XP).
    assert.equal(S.owns(st, 'hat', 'party'), false);
    st.xp = 150;
    assert.equal(S.owns(st, 'hat', 'party'), true);
    // A prize with a price too: on sale once won.
    assert.equal(S.owns(st, 'hat', 'bow'), false);
    assert.equal(S.forSale(st, S.itemOfSlot('hat', 'bow')), true);
    assert.deepEqual(S.newlyWon(st).map((x) => x.key).sort(), ['hat:beret', 'hat:cheese', 'hat:party', 'hold:bell']);
    st.gifts = ['hat:cheese', 'hat:beret'];
    assert.deepEqual(S.newlyWon(st).map((x) => x.key).sort(), ['hat:party', 'hold:bell']);
    assert.deepEqual(S.howToGet(S.itemOfSlot('hat', 'cheese')), { boss: 'mouse-catcher', name: 'The Big Cheese', icon: '🧀', game: 'Mouse Catcher' });
    assert.deepEqual(S.howToGet(S.itemOfSlot('shoes', 'winged')), { step: 'unit-4:5', unit: 'unit-4', n: 5 });
  } finally {
    S.applyShop(S.completeShop());
  }
});

test('what a learner wears stays theirs when its price goes up or it\'s hidden', () => {
  const st = { owned: [], look: { color: 'orange', hat: 'none' } };
  S.keepLook(st, S.lookOf(st));
  assert.deepEqual(st.owned, ['color:orange']);
  S.applyShop(S.completeShop({ items: { color: [{ id: 'orange', price: 40, hidden: true }, { id: 'black', price: 40 }] } }));
  try {
    assert.equal(S.lookOf(st).color, 'orange');
    // Never worn: now it costs.
    assert.equal(S.owns(st, 'color', 'black'), false);
  } finally {
    S.applyShop(S.completeShop());
  }
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
async function load(st) {
  await page.goto(mock.base + '/musician-maker/');
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE, st]);
  await page.reload();
  await page.waitForSelector('.to-closet');
}

test('a prize just won sparkles until it\'s tried on; one still to win says how', async () => {
  await load({ tokens: 0, bosses: { 'mouse-catcher': 1 }, gifts: ['hat:cheese'], fresh: ['hat:cheese'] });
  assert.equal(await page.locator('.hero-av.has-fresh').count(), 1);
  await page.click('.to-closet');
  // It opens on the prize.
  await page.waitForSelector('.cl-item');
  assert.equal(await page.locator('.cl-group.on').getAttribute('aria-label'), 'Wear');
  assert.equal(await page.locator('.cl-tab.on').getAttribute('aria-label'), 'Hat');
  assert.equal(await page.locator('.cl-tab[aria-label="Hat"] .new-dot').count(), 1);
  assert.equal(await page.locator('.cl-item[aria-label="Cheese hat"] .fresh').count(), 1);
  await page.click('.cl-item[aria-label="Cheese hat"]');
  let st = await saved();
  assert.equal(st.look.hat, 'cheese');
  assert.deepEqual(st.fresh, []);
  assert.ok(st.owned.includes('hat:cheese'));
  // The avatar reacts.
  assert.equal(await page.locator('.cl-stage .avatar').getAttribute('data-mood'), 'happy');

  // Not won yet: its badge, and the bar says how to win it (no buying).
  const chef = page.locator('.cl-item[aria-label^="Chef\'s hat"]');
  assert.match(await chef.getAttribute('class'), /prize/);
  assert.equal(await chef.locator('.prize-tag').innerText(), '🥣');
  await chef.click();
  await page.waitForSelector('.cl-bar.show .cl-how');
  assert.match(await page.locator('.cl-how').innerText(), /Beat The Big Fluff/);
  assert.equal(await page.locator('.cl-buy').count(), 0);
  assert.equal(await page.locator('.cl-stage .avatar').getAttribute('data-mood'), 'wow');
  st = await saved();
  assert.equal(st.look.hat, 'cheese');
  noErrors();
});

test('the collection book counts what you have and shows the rest as shadows', async () => {
  await load({ tokens: 0, owned: ['kind:dog'], look: { kind: 'dog' } });
  await page.click('.to-closet');
  await page.click('.cl-room[aria-label="Collection"]');
  await page.waitForSelector('.book');
  const total = S.SLOTS.reduce((n, { id }) => n + S.CATALOG[id].filter((x) => x.id !== 'none').length, 0);
  const have = await page.locator('.bk-item.mine').count();
  assert.equal(await page.locator('.bk-item').count(), total);
  assert.equal(await page.locator('.bk-top b').innerText(), `${have}/${total}`);
  // The animals: cat and bunny are free, the dog was bought.
  assert.equal(await page.locator('.bk-sec').first().locator('small').innerText(), '3/21');
  // A shadow goes to it in the closet, tried on.
  await page.click('.bk-item.cl-kind[aria-label^="Dragon"]');
  await page.waitForSelector('.cl-bar.show');
  assert.equal(await page.locator('.cl-item.tried').getAttribute('aria-label'), 'Dragon, 100 notes');
  assert.equal(await page.locator('.cl-room.on').getAttribute('aria-label'), 'Closet');
  noErrors();
});

test('a hidden item leaves the shop, but not the closet of someone who has it', async () => {
  await page.route('**/api/live/shop.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: { hat: [{ id: 'crown', hidden: true }, { id: 'beanie', price: 3 }] } }) }));
  try {
    await load({ tokens: 10, owned: [] });
    await page.click('.to-closet');
    await page.click('.cl-group[aria-label="Wear"]');
    assert.equal(await page.locator('.cl-item[aria-label^="Crown"]').count(), 0);
    assert.equal(await page.locator('.cl-item[aria-label="Beanie, 3 notes"]').count(), 1);
    await load({ tokens: 10, owned: ['hat:crown'], look: { hat: 'crown' } });
    await page.click('.to-closet');
    await page.click('.cl-group[aria-label="Wear"]');
    assert.equal(await page.locator('.cl-item[aria-label="Crown"].on').count(), 1);
  } finally {
    await page.unroute('**/api/live/shop.json');
  }
  noErrors();
});

test('in a run the avatar stands with the band and bounces on the beat', async () => {
  await page.goto(mock.base + '/musician-maker/?test=petting-time&task=tap&step=1');
  await page.click('button.play', { force: true });
  await page.waitForSelector('.lane .avatar.me');
  // Beside the band's seats, not covering the stage.
  const me = await page.locator('.lane .avatar.me').boundingBox();
  const stage = await page.locator('.stage-wrap').boundingBox();
  assert.ok(me.y >= stage.y + stage.height - 1, 'below the stage');
  let bounced = false;
  for (let i = 0; i < 30 && !bounced; i++) {
    bounced = await page.locator('.lane .avatar.me').evaluate((el) => /av-beat/.test(el.className));
    await page.waitForTimeout(150);
  }
  assert.ok(bounced);
  assert.match(await page.locator('.lane .avatar.me').getAttribute('data-mood'), /idle|cheer|sad|play/);
  noErrors();
});

test('the studio shop editor: a price, out of the shop, a prize, undo, and Publish sends what the game reads', async () => {
  let sent = null;
  await page.route('**/studio/api/live/shop', async (r) => {
    sent = JSON.parse(r.request().postData());
    await page.route('**/api/live/shop.json', (q) => q.fulfill({ contentType: 'application/json', headers: { 'Last-Modified': new Date().toUTCString() }, body: JSON.stringify(sent) }));
    await r.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
  });
  const draft = () => page.evaluate(() => JSON.parse(localStorage.getItem('mwm-shop-editor-1')).shop);
  const hat = async (id) => (await draft()).items.hat.find((x) => x.id === id);
  try {
    await page.goto(mock.base + '/studio/shop/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.it-row');
    assert.equal(await page.locator('.chip.live').count(), 1);
    await page.click('nav.tabs button[data-k="tab:hat"]');
    assert.equal(await page.locator('.it-row').count(), S.CATALOG.hat.length);

    // Typing a price doesn't redraw the list, so the click that ends it still lands.
    const crown = page.locator('.it-row[data-id="crown"]');
    await crown.locator('input[type=number]').fill('65');
    assert.equal(await page.locator('.chip.changed').count(), 1);
    await crown.locator('.it-shop input').click();
    assert.deepEqual(await hat('crown'), { id: 'crown', name: 'Crown', price: 65, hidden: true });
    assert.match(await crown.getAttribute('class'), /hidden/);

    // A prize: won by reaching a level; a prize the catalog has, sold instead.
    await page.locator('.it-row[data-id="cheese"] select.won').selectOption('');
    await page.locator('.it-row[data-id="tophat"] select.won').selectOption('level:5');
    assert.deepEqual((await hat('tophat')).unlock, { level: 5 });
    assert.equal((await hat('cheese')).unlock, null);
    assert.match(await page.locator('.pv-name').innerText(), /Top hat\s+⭐ Reach level 5, then ♪ 40/);

    // ↺ puts back the game's own; undo takes it back.
    await crown.locator('.it-reset').click();
    assert.deepEqual(await hat('crown'), { id: 'crown', name: 'Crown', price: 80 });
    assert.equal(await crown.locator('.it-reset').isHidden(), true);
    await page.click('button:has-text("Undo")');
    assert.deepEqual(await hat('crown'), { id: 'crown', name: 'Crown', price: 65, hidden: true });

    await page.click('button:has-text("Publish to site")');
    await page.waitForSelector('.chip.live');
    const shop = S.completeShop(sent);
    const got = (id) => shop.items.hat.find((x) => x.id === id);
    assert.deepEqual(got('crown'), { id: 'crown', name: 'Crown', price: 65, hidden: true });
    assert.deepEqual(got('tophat').unlock, { level: 5 });
    assert.equal(got('cheese').unlock, undefined);
    assert.deepEqual(got('chef').unlock, { boss: 'supper-time' });
    assert.deepEqual(shop.earn, S.completeShop().earn);
    assert.match(await page.locator('.sum-bar').innerText(), /Published/);
  } finally {
    await page.unroute('**/studio/api/live/shop');
    await page.unroute('**/api/live/shop.json');
  }
  noErrors();
});
