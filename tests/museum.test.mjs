/* The Instrument Museum (museum/), in Chromium: every exhibit opens, a few play the notes they
   should, and the sound engine (museum/audio.js) picks samples by strength, varies drum takes
   and grows vibrato. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';
import { EXHIBITS } from '../museum/data.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let browser, mock, page;
const errors = [];
before(async () => {
  mock = await startMock();
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(mock.base + '/museum/');
});
after(async () => {
  await browser.close();
  await mock.close();
});

test('every exhibit opens and is ready to play', async () => {
  for (const ex of EXHIBITS) {
    await page.evaluate((id) => { location.hash = id; }, ex.id);
    await page.waitForFunction(() => !document.getElementById('stage').classList.contains('loading')
      && document.querySelector('#stage canvas'), null, { timeout: 15000 });
  }
  await page.evaluate(() => { location.hash = ''; });
  assert.deepEqual(errors, []);
});

test('the violin and cello exhibits play solo instruments, not sections', async () => {
  const byId = Object.fromEntries(EXHIBITS.map((e) => [e.id, e]));
  assert.equal(byId.violin.opts.arco, 'violin');
  assert.equal(byId.cello.opts.arco, 'cello');
  assert.equal(byId.cello.opts.pizz, 'cello-pizz-solo');
});

test('a soft piano note plays the softly recorded sample', async () => {
  const r = await page.evaluate(async () => {
    const audio = await import('/museum/audio.js');
    const piano = await audio.pitched('piano', 21, 108);
    // The other levels load in the background.
    for (let i = 0; i < 200 && piano.layers.some((l) => !l.main && l.zones.length < 30); i++) await new Promise((ok) => setTimeout(ok, 50));
    const main = piano.zone(60);
    return {
      levels: piano.layers.map((l) => l.zones.length),
      soft: piano.zone(60, 0.1) !== main && piano.zone(60, 0.1).buffer !== main.buffer,
      usual: piano.zone(60, 0.75) === main,
      none: piano.zone(60) === main,
      loud: piano.zone(60, 1) !== main,
      midi: piano.zone(61, 0.1).midi,
    };
  });
  assert.deepEqual(r.levels, [30, 30, 30, 30]);
  assert.ok(r.soft && r.usual && r.none && r.loud);
  assert.equal(r.midi, 60);
});

test('a drum never plays the same take twice running, and plays softer takes softly', async () => {
  const r = await page.evaluate(async () => {
    const audio = await import('/museum/audio.js');
    const snare = await audio.hit('kit-snare');
    for (let i = 0; i < 200 && snare.layers.some((l) => l.takes.length < 4); i++) await new Promise((ok) => setTimeout(ok, 50));
    const picks = Array.from({ length: 20 }, () => snare.take(0.9));
    const repeats = picks.filter((p, i) => i && p === picks[i - 1]).length;
    const loud = new Set(snare.layers[2].takes);
    const soft = new Set(snare.layers[0].takes);
    return {
      repeats,
      kinds: new Set(picks).size,
      allLoud: picks.every((p) => loud.has(p)),
      soft: Array.from({ length: 5 }, () => snare.take(0.2)).every((p) => soft.has(p)),
      plain: snare.take(null) === snare.s,
    };
  });
  assert.equal(r.repeats, 0);
  assert.ok(r.kinds >= 3);
  assert.ok(r.allLoud && r.soft && r.plain);
});

test('a held cello note grows vibrato once it settles, and a new note starts it again', async () => {
  const r = await page.evaluate(async () => {
    const audio = await import('/museum/audio.js');
    const ac = audio.context();
    await ac.resume();
    const cello = await audio.pitched('cello', 36, 81);
    const v = cello.sustain({ vibrato: { cents: 22 } });
    const wait = (s) => new Promise((ok) => setTimeout(ok, s * 1000));
    v.start(48, 0.5);
    await wait(0.05);
    const early = v.depth.gain.value;
    await wait(1.0);
    const grown = v.depth.gain.value;
    v.pitch(50);
    await wait(0.12);
    const after = v.depth.gain.value;
    v.vibrato(false);
    await wait(1.0);
    const off = v.depth.gain.value;
    v.stop(0.05);
    return { early, grown, after, off, running: ac.state };
  });
  assert.equal(r.running, 'running');
  assert.ok(r.early < 2, `no vibrato at the start (${r.early})`);
  assert.ok(r.grown > 20, `vibrato grown (${r.grown})`);
  assert.ok(r.after < 5, `stopped by a new note (${r.after})`);
  assert.ok(r.off < 0.5, `turned off (${r.off})`);
});

/** The note name in the readout, as text (C4, F♯3...). */
const readout = () => page.evaluate(() => document.getElementById('nn').textContent);
async function open(id) {
  await page.evaluate((x) => { location.hash = x; }, id);
  await page.waitForFunction(() => !document.getElementById('stage').classList.contains('loading')
    && document.querySelector('#stage canvas'), null, { timeout: 15000 });
}

test('a harp pedal changes every string of its letter', async () => {
  await open('harp');
  await page.keyboard.press('a');
  assert.equal(await readout(), 'C4');
  await page.keyboard.press('f');
  assert.equal(await readout(), 'F4');
  // Penta: F strings go down to F flat, which sounds E; B strings up to B sharp, which sounds C.
  await page.getByRole('radio', { name: 'Penta' }).click();
  await page.keyboard.press('f');
  assert.equal(await readout(), 'E4');
  await page.keyboard.press('j');
  assert.equal(await readout(), 'C5');
  await page.evaluate(() => { location.hash = ''; });
});

test('the bassoon plays its scale from the six finger holes and the thumb keys', async () => {
  await open('bassoon');
  const k = page.keyboard;
  for (const key of 'fdsjkl') await k.down(key);
  await k.down(' ');
  assert.equal(await readout(), 'G2');
  await k.up('l');
  assert.equal(await readout(), 'A2');
  await k.down('l');
  await k.down('n');
  assert.equal(await readout(), 'F2');
  await k.down('v');
  assert.equal(await readout(), 'F3');
  for (const key of 'fdsjklnv ') await k.up(key);
  await page.evaluate(() => { location.hash = ''; });
});

/* The keys are drawn to a piano's proportions, black keys leaning as they do, and you can play
   the strings inside the piano and the organ's pipes: touching any of them plays the note drawn
   there. */
test('keys, bars, strings and pipes play the note drawn where they are touched', async () => {
  const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const full = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
  async function touch(m, where) {
    const at = await page.evaluate(([m, where]) => {
      const c = document.querySelector('#stage canvas');
      const p = c.museumAt(m, where);
      const r = c.getBoundingClientRect();
      return p && { x: r.left + p.u, y: r.top + p.v };
    }, [m, where]);
    assert.ok(at, `${full(m)} ${where || ''} is showing`);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    const n = await readout();
    await page.mouse.up();
    return n;
  }
  await open('piano');
  for (let m = 48; m < 72; m++) assert.equal(await touch(m), full(m));
  for (const m of [50, 61, 66, 70]) assert.equal(await touch(m, 'inside'), full(m), 'its strings');
  await open('organ');
  for (const m of [49, 54, 58, 60]) assert.equal(await touch(m), full(m));
  assert.equal(await touch(55, 'inside'), full(55), 'its pipe');
  // (the readout shows the written note: a glockenspiel's music is written two octaves down)
  for (const [id, lo] of [['glockenspiel', 79], ['xylophone', 72], ['marimba', 55]]) {
    await open(id);
    const written = EXHIBITS.find((e) => e.id === id).written || 0;
    for (let m = lo; m < lo + 12; m++) assert.equal(await touch(m), full(m + written), id);
  }
  await page.evaluate(() => { location.hash = ''; });
  assert.deepEqual(errors, []);
});

/* The brass are drawn as they're held: the lips on the player's side, then the mouthpiece, then
   valve 1 (nearest the mouthpiece, as on the real instrument), 2 and 3. A finger on a valve and
   one on the lips play the harmonic drawn there, lowered by the valve; the trombone's slide
   plays the position under it. On a phone the valves are shown again, close up, big enough to
   finger. */
test('brass play what is drawn, valve 1 nearest the mouthpiece, big valves on a phone', async () => {
  const at = (pg, what, i) => pg.evaluate(([what, i]) => {
    const c = document.querySelector('#stage canvas');
    const p = c.museumAt(what, i);
    const r = c.getBoundingClientRect();
    return p && { x: r.left + p.u, y: r.top + p.v };
  }, [what, i]);
  const finger = (pg, type, id, p) => pg.evaluate(([type, id, p]) => {
    document.querySelector('#stage canvas').dispatchEvent(new PointerEvent(type, {
      pointerId: id, clientX: p.x, clientY: p.y, bubbles: true, cancelable: true, pointerType: 'touch',
    }));
  }, [type, id, p]);
  await open('trumpet');
  const [lips, mp, v1, v2, v3] = [await at(page, 'lips', 2), await at(page, 'mouthpiece'),
    await at(page, 'valve', 0), await at(page, 'valve', 1), await at(page, 'valve', 2)];
  assert.ok(lips.x < mp.x && mp.x < v1.x && v1.x < v2.x && v2.x < v3.x, 'lips, mouthpiece, then valves 1, 2, 3');
  // the fourth harmonic is B♭4 (written C5); valve 1 lowers it a whole step (written B♭4)
  await finger(page, 'pointerdown', 2, v1);
  await finger(page, 'pointerdown', 3, lips);
  assert.equal(await readout(), 'B♭4');
  await finger(page, 'pointerup', 2, v1);
  assert.equal(await readout(), 'C5');
  await finger(page, 'pointerdown', 4, v3);
  assert.equal(await readout(), 'A4');
  await finger(page, 'pointerup', 4, v3);
  await finger(page, 'pointerup', 3, lips);
  // the trombone: lips on its second band (F3), the slide out to fourth position (D3)
  await open('trombone');
  const tl = await at(page, 'lips', 1);
  await finger(page, 'pointerdown', 5, await at(page, 'slide', 4));
  await finger(page, 'pointerup', 5, await at(page, 'slide', 4));
  await finger(page, 'pointerdown', 6, tl);
  assert.equal(await readout(), 'D3');
  await finger(page, 'pointerup', 6, tl);

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await ctx.newPage();
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(mock.base + '/museum/#tuba');
  await phone.waitForFunction(() => !document.getElementById('stage').classList.contains('loading')
    && document.querySelector('#stage canvas'), null, { timeout: 15000 });
  const b = [];
  for (let i = 0; i < 4; i++) b.push(await at(phone, 'valve', i));
  for (let i = 1; i < 4; i++) assert.ok(b[i].x - b[i - 1].x >= 60, `tuba valves ${i} and ${i + 1} a finger apart on a phone`);
  const pl = await at(phone, 'lips', 0);
  await finger(phone, 'pointerdown', 2, b[3]);
  await finger(phone, 'pointerdown', 3, pl);
  // the tuba's second harmonic is B♭1; valve 4 lowers it a fourth, to F1
  assert.equal(await phone.evaluate(() => document.getElementById('nn').textContent), 'F1');
  await ctx.close();
  await page.evaluate(() => { location.hash = ''; });
  assert.deepEqual(errors, []);
});
