/* Musician Maker's avatar (musician-maker/avatar.js) and closet (closet.js). In Node: every
   animal draws in every color with every item, old saved looks still load. In Chromium, on a
   phone-sized page with the site's headers: the closet's rooms and groups, buying, the goal,
   outfits, shuffle, the avatar staying in view while the items scroll, and what an avatar holds:
   in its paws, played for real, and in the picture in every mood. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const A = await import('../musician-maker/avatar.js');

test('every animal draws in every color, with every item, and nothing is left undefined', () => {
  for (const { id: kind } of A.ITEMS.kind) {
    for (const { id: color } of A.ITEMS.color) {
      const svg = A.avatarSvg({ kind, color, pattern: 'stripes', hat: 'crown', glasses: 'shades', neck: 'scarf', shoes: 'boots', hold: 'guitar', bg: 'space' });
      assert.doesNotMatch(svg, /undefined|NaN|null/, `${kind} ${color}`);
    }
    for (const { id: slot } of A.SLOTS) {
      for (const { id } of A.ITEMS[slot]) {
        assert.doesNotMatch(A.itemSvg(slot, id, { kind }), /undefined|NaN/, `${kind} ${slot} ${id}`);
        assert.doesNotMatch(A.avatarSvg({ kind, [slot]: id }), /undefined|NaN|null/, `${kind} wearing ${slot} ${id}`);
      }
    }
  }
  assert.equal(A.ITEMS.kind.length >= 20, true);
  // Every item has a name and a price, and the first of each slot is free.
  for (const { id: slot } of A.SLOTS) {
    for (const it of A.ITEMS[slot]) assert.ok(it.name && Number.isInteger(it.price), `${slot} ${it.id}`);
    assert.equal(A.ITEMS[slot][0].price, 0);
  }
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
  assert.deepEqual(await page.locator('.cl-group').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))), ['Me', 'Wear', 'Play', 'Stage']);
  assert.deepEqual(await page.locator('.cl-tab').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))), ['Animal', 'Color', 'Pattern', 'Face']);
  // The animals you have come first.
  const first = await page.locator('.cl-item').evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute('aria-label')));
  assert.deepEqual(first, ['Cat', 'Bunny']);
  await page.click('.cl-group[aria-label="Wear"]');
  assert.deepEqual(await page.locator('.cl-tab').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))), ['Hat', 'Glasses', 'Neck', 'Shoes']);

  // Play: the instruments alone (one slot, so no tabs), fitted to their tiles.
  await page.click('.cl-group[aria-label="Play"]');
  assert.equal(await page.locator('.cl-tab').count(), 0);
  const vb = await page.locator('.cl-item[aria-label^="Trumpet"] .art svg').getAttribute('viewBox');
  assert.notEqual(vb, '0 0 200 220');

  // Too dear: 🎯 makes it the goal; the title shows it.
  await page.click('.cl-item[aria-label^="Ukulele"]');
  await page.click('.cl-goal');
  assert.equal((await saved()).goal, 'hold:guitar');
  assert.equal(await page.locator('.cl-item[aria-label^="Ukulele"] .goal-pin').count(), 1);
  await page.click('.cl-head .back');
  await page.waitForSelector('.to-goal .goal-chip');
  assert.match(await page.locator('.to-goal .goal-chip').getAttribute('aria-label'), /30 of 50/);

  // With the notes, buying it clears the goal and puts it on.
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.tokens = 60; localStorage.setItem(k, JSON.stringify(s)); }, SAVE);
  await page.reload();
  assert.match(await page.locator('.to-goal .goal-chip').getAttribute('aria-label'), /enough/);
  await page.click('.to-goal .goal-chip', { force: true }); // it throbs when there are enough notes
  await page.click('.cl-group[aria-label="Play"]');
  await page.click('.cl-item[aria-label^="Ukulele"]');
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
  await page.click('.cl-item[aria-label="Bunny"]');
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
  await page.click('.cl-item[aria-label^="Dragon"]');
  assert.equal(await stageTop(), before);
  assert.equal(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), true);
  await page.click('.cl-room[aria-label="Record shop"]');
  await page.waitForSelector('.cl-groove');
  assert.equal(await page.locator('.cl-group').count(), 0);
  assert.equal(await page.locator('.cl-shuffle').count(), 0);
  assert.equal(await page.locator('.cl-groove[aria-label="Mix"].on').count(), 1);
  noErrors();
});

/* What an avatar holds (wardrobe.js HOLDS), drawn in a 200 x 220 box so a pixel is a unit of
   its drawing. T.thing(x, y): is some part of the thing (its drawings on the body, at the mouth,
   in a paw, or the drum that pops up) under this point? */
async function holding() {
  await page.goto(mock.base + '/musician-maker/');
  await page.evaluate(async () => {
    const A = await import('/musician-maker/avatar.js');
    const { HOLDS } = await import('/musician-maker/wardrobe.js');
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:220px;z-index:2147483647;background:#fff';
    document.body.append(box);
    const draw = (kind, hold) => {
      const el = A.avatar({ kind, hold }, { bg: false });
      el.style.cssText = 'display:block;width:100%;height:100%';
      box.replaceChildren(el);
      return el;
    };
    const at = (el, t) => {
      for (const a of el.getAnimations({ subtree: true })) {
        if (a instanceof CSSTransition) a.finish();
        else { a.pause(); a.currentTime = t; }
      }
    };
    const thing = (x, y, not) => document.elementsFromPoint(x, y).some((n) => {
      const grip = n.closest('.av-grip');
      return grip ? grip !== not : !!(n.closest('.av-front, .av-extra') || (n.closest('.av-top') && !n.closest('.av-hand')));
    });
    window.T = { A, HOLDS: Object.keys(HOLDS).filter((h) => h !== 'none'), draw, at, thing };
  });
}

test('what an avatar holds is in its paws, and it plays it for real', async () => {
  await holding();
  const wrong = await page.evaluate(({ FREE, HITS, RUBS }) => {
    const { T } = window;
    // The paw: its middle and eight points round its edge.
    const pawOn = (hand) => {
      const b = hand.querySelector('.av-grip + circle').getBoundingClientRect();
      const r = b.width / 2;
      return [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)])]
        .some(([dx, dy]) => T.thing(b.x + r + dx * r, b.y + r + dy * r));
    };
    // What the paw holds is drawn pointing up from it: just inside its far end.
    const tipOn = (hand) => {
      const grip = hand.querySelector('.av-grip');
      const g = grip.firstElementChild;
      const p = new DOMPoint(0, g.getBBox().y + 2).matrixTransform(g.getScreenCTM());
      return T.thing(p.x, p.y, grip);
    };
    const wrong = [];
    for (const kind of ['bear', 'owl', 'penguin']) {
      for (const hold of T.HOLDS) {
        const el = T.draw(kind, hold);
        if (el.dataset.hold !== hold) wrong.push(`${hold}: data-hold`);
        for (const a of el.getAnimations({ subtree: true })) a.cancel();
        const hands = [...el.querySelectorAll('.av-hand')].map((h) => [h.classList.contains('l') ? 'l' : 'r', h]);
        const free = (side) => FREE.includes(`${hold}.${side}`);
        for (const [side, h] of hands) if (!free(side) && !pawOn(h)) wrong.push(`${kind} ${hold}: the ${side} paw is off it`);
        const extra = el.querySelector('.av-extra');
        if (extra && getComputedStyle(extra).display !== 'none') wrong.push(`${hold}: the drum is out before it plays`);
        // Playing: four beats, eight looks a beat.
        T.A.setMood(el, 'play', { beat: 0.5 });
        if (extra && getComputedStyle(extra).display === 'none') wrong.push(`${hold}: no drum to play`);
        const n = { l: [0, 0], r: [0, 0] };
        for (let i = 0; i < 32; i++) {
          T.at(el, i * 62.5);
          for (const [side, h] of hands) {
            if (pawOn(h)) n[side][0]++;
            if ((HITS[hold] || RUBS[hold] || '').includes(side) && tipOn(h)) n[side][1]++;
          }
        }
        for (const [side] of hands) {
          const [paw, tip] = n[side];
          if (!free(side) && paw < 32) wrong.push(`${kind} ${hold}: the ${side} paw leaves it (on it ${paw} of 32)`);
          if (HITS[hold]?.includes(side) && !(tip > 0 && tip < 32)) wrong.push(`${kind} ${hold}: the ${side} lands on it ${tip} of 32`);
          if (RUBS[hold]?.includes(side) && tip < 32) wrong.push(`${kind} ${hold}: the ${side} is on it ${tip} of 32`);
        }
      }
    }
    return wrong;
  }, {
    // l and r as you look at it: the animal's right paw is on the left. A free paw holds nothing.
    FREE: ['mic.l', 'brush.l', 'baton.r'],
    // Struck: the stick comes down on it and lifts off. Rubbed: it stays on it.
    HITS: { sticks: 'lr', xylophone: 'lr', gong: 'l', cowbell: 'l', triangle: 'l' },
    RUBS: { guiro: 'l', guitar: 'l' },
  });
  assert.deepEqual(wrong, []);
  noErrors();
});

test('with something in hand, every mood keeps it in the picture', async () => {
  await holding();
  const out = await page.evaluate(() => {
    const { T } = window;
    const out = [];
    for (const hold of T.HOLDS) {
      for (const mood of ['idle', 'happy', 'cheer', 'sad', 'wow', 'sing', 'play', 'sleep']) {
        const el = T.draw('bear', hold);
        T.A.setMood(el, mood, { beat: 0.5 });
        let worst = 0;
        for (let t = 0; t <= 2000; t += 100) {
          T.at(el, t);
          for (const n of el.querySelectorAll('.av-grip *, .av-front *, .av-extra *, .av-top > :not(.av-hand), .av-top > :not(.av-hand) *')) {
            if (n.tagName === 'g') continue;
            const b = n.getBoundingClientRect();
            worst = Math.max(worst, -b.left, b.right - 200, -b.top, b.bottom - 220);
          }
        }
        // A box round a turned shape is a little bigger than the shape.
        if (worst > 4) out.push(`${hold} ${mood}: ${worst.toFixed(1)} out`);
      }
    }
    return out;
  });
  assert.deepEqual(out, []);
  noErrors();
});
