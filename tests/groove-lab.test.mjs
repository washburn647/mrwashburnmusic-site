/* The studio's Groove Lab (studio/groove/). In Node: its note logic (notes.js) and MIDI messages
   (midi.js). In Chromium, with the site's headers: piano-roll rows that stay put under the
   pointer, a shaky click that removes a note instead of moving it, the roll's scroll through
   Undo and Restore, Publish asking before it takes grooves out of the game, a MIDI keyboard's
   step recording, picking, copying and pasting, Key lock, the other layers' notes, mute and
   solo, transpose and velocity. */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const N = await import('../studio/groove/notes.js');
const M = await import('../studio/groove/midi.js');
const INDEX = JSON.parse(fs.readFileSync(new URL('../assets/sounds/index.json', import.meta.url), 'utf8'));
const zones = (inst) => INDEX.instruments[inst].zones;

/* ---------- notes.js and midi.js ---------- */

test('a piano roll keeps its rows when a note goes in its top or bottom row', () => {
  const { lo, hi } = N.rollRange(zones('bass'), []);
  assert.deepEqual({ lo, hi }, { lo: 28, hi: 61 });
  // The bug: a note on the top row used to add two rows above it, so the next click landed
  // two half steps higher.
  assert.deepEqual(N.rollRange(zones('bass'), [{ s: 0, m: hi, l: 1 }, { s: 1, m: lo, l: 1 }]), { lo, hi });
  // A note already outside the instrument (from another instrument) is still shown.
  assert.deepEqual(N.rollRange(zones('bass'), [{ s: 0, m: 70 }]), { lo: 28, hi: 70 });
  assert.deepEqual(N.rollRange([], []), { lo: 34, hi: 86 });
});

test('the key: in or out, snapping, and scale steps', () => {
  const F = 5;
  assert.equal(N.inKey(65, F), true); // F
  assert.equal(N.inKey(70, F), true); // B♭
  assert.equal(N.inKey(71, F), false); // B
  assert.equal(N.snapToKey(71, F, true), 72);
  assert.equal(N.snapToKey(71, F, false), 70);
  assert.equal(N.snapToKey(69, F, true), 69);
  assert.equal(N.scaleStep(65, F, 1), 67);
  assert.equal(N.scaleStep(69, F, 1), 70); // A to B♭: a half step in the scale
  assert.equal(N.scaleStep(65, F, -1), 64);
  assert.equal(N.scaleStep(65, F, 7), 77);
  assert.equal(N.scaleStep(66, F, 1), 67); // from outside the key: the next one up
  assert.equal(N.scaleSteps(65, 72, F), 4);
  assert.equal(N.scaleSteps(72, 65, F), -4);
});

test('notes move together, as far as all of them can, and land on top of nothing', () => {
  const a = { s: 2, m: 60, l: 2, v: 0.8 };
  const b = { s: 28, m: 61, l: 3, v: 0.8 };
  const items = [N.moving(a, false, 50, 62), N.moving(b, false, 50, 62)];
  // b can only go 1 step later in a 32-step loop, and 1 half step up.
  assert.deepEqual(N.shiftNotes(items, { dc: 5, dp: 4, steps: 32 }), { dc: 1, dp: 1 });
  assert.deepEqual([a.s, a.m, b.s, b.m], [3, 61, 29, 62]);
  // From where they started, not where they are.
  assert.deepEqual(N.shiftNotes(items, { dc: -10, dp: -3, steps: 32 }), { dc: -2, dp: -3 });
  assert.deepEqual([a.s, a.m, b.s, b.m], [0, 57, 26, 58]);
  // Key lock: scale steps; octaves.
  const c = { s: 0, m: 65, l: 1 };
  N.shiftNotes([N.moving(c, false, 40, 90)], { dp: 2, steps: 32, key: 5 });
  assert.equal(c.m, 69);
  N.shiftNotes([N.moving(c, false, 40, 90)], { dp: -1, steps: 32, octave: true });
  assert.equal(c.m, 57);
  assert.equal(N.canShift([N.moving(c, false, 40, 60)], 1, { octave: true }), false);
  assert.equal(N.canShift([], 1), false);
  // A percussion hit moves in time only.
  const hit = { s: 31, v: 1 };
  assert.deepEqual(N.shiftNotes([N.moving(hit, true)], { dc: 4, dp: 3, steps: 32 }), { dc: 0, dp: 3 });
  assert.equal(hit.s, 31);
  assert.equal(hit.m, undefined);
  // What a moved note lands on gives way.
  const list = [{ s: 4, m: 60 }, { s: 4, m: 62 }, { s: 4, m: 60, moved: true }];
  N.dropCovered(list, new Set([list[2]]));
  assert.deepEqual(list.map((n) => [n.s, n.m, !!n.moved]), [[4, 62, false], [4, 60, true]]);
});

test('a copied block pastes into the tracks it came from, at the cursor, inside the loop', () => {
  const bass = { inst: 'bass', notes: [] };
  const piano = { inst: 'piano', notes: [{ s: 9, m: 60, l: 1 }] };
  const kick = { inst: 'kit-kick', notes: [] };
  const entries = [
    { hit: false, inst: 'piano', k: 1, n: { s: 9, m: 60, l: 1, v: 0.5 } },
    { hit: false, inst: 'bass', k: 0, n: { s: 10, m: 40, l: 4, v: 0.8 } },
    { hit: true, inst: 'kit-kick', k: 0, n: { s: 8, v: 1 } },
  ];
  // From the start of the first note's beat to the end of the last one's.
  const clip = N.copyBlock(entries, 4);
  assert.deepEqual([clip.from, clip.span], [8, 8]);
  // Or the bars picked.
  assert.deepEqual(N.copyBlock(entries, 4, { from: 8, to: 16 }).span, 8);
  const rangeOf = (tr) => N.rollRange(zones(tr.inst), tr.notes);
  const put = N.pasteBlock(clip, { hit: [kick], pitched: [bass, piano] }, 16, 32, rangeOf);
  assert.equal(put.size, 3);
  assert.deepEqual(piano.notes.map((n) => [n.s, n.m]), [[9, 60], [17, 60]]);
  assert.deepEqual(bass.notes.map((n) => [n.s, n.m, n.l]), [[18, 40, 4]]);
  assert.deepEqual(kick.notes.map((n) => n.s), [16]);
  // Past the end: left out, or cut short. Pasting again on the same spot doubles nothing.
  N.pasteBlock(clip, { hit: [kick], pitched: [bass, piano] }, 28, 32, rangeOf);
  assert.deepEqual(bass.notes.map((n) => [n.s, n.l]), [[18, 4], [30, 2]]);
  N.pasteBlock(clip, { hit: [kick], pitched: [bass, piano] }, 16, 32, rangeOf);
  assert.deepEqual(kick.notes.map((n) => n.s), [16, 28]);
  // Out of an instrument's range: left out.
  const flute = { inst: 'flute', notes: [] };
  N.pasteBlock(N.copyBlock([entries[1]], 4), { hit: [], pitched: [flute] }, 0, 32, rangeOf);
  assert.deepEqual(flute.notes, []);
});

test('muted tracks are left out of what plays, and a solo leaves only the soloed', () => {
  const t = (inst) => ({ inst, vol: 1, notes: [{ s: 0, v: 1 }] });
  const g = { meter: '2/4', beats: 8, swing: 0, layers: { pulse: [t('claves'), t('shaker')], bass: [t('bass')] }, variants: { bass: [{ chance: 0.5, tracks: [t('bass'), t('tuba')] }] } };
  const layers = ['pulse', 'bass'];
  assert.equal(N.mixVersion(g, () => undefined, layers), g);
  const muted = N.mixVersion(g, (l, take, i) => (l === 'pulse' && i === 0 ? 'mute' : undefined), layers);
  assert.deepEqual(muted.layers.pulse.map((x) => x.inst), ['shaker']);
  assert.deepEqual(muted.layers.bass.map((x) => x.inst), ['bass']);
  assert.equal(muted.variants.bass[0].tracks.length, 2);
  assert.equal(muted.beats, 8);
  const solo = N.mixVersion(g, (l, take, i) => (l === 'bass' && take === 0 && i === 1 ? 'solo' : undefined), layers);
  assert.deepEqual(solo.layers.pulse, []);
  assert.deepEqual(solo.layers.bass, []);
  assert.deepEqual(solo.variants.bass[0].tracks.map((x) => x.inst), ['tuba']);
  assert.equal(solo.variants.bass[0].chance, 0.5);
  // The groove itself is untouched.
  assert.equal(g.layers.pulse.length, 2);
});

test('step recording: keys pressed together make a chord, a later key the next step', () => {
  const c = N.chords(100);
  assert.equal(c.press(60, 0), 'new');
  assert.equal(c.press(64, 30), 'join');
  assert.equal(c.release(60), false);
  assert.equal(c.release(64), true);
  assert.equal(c.press(62, 500), 'new');
  // Legato: the next key comes while the last is still down.
  assert.equal(c.press(64, 900), 'next');
  assert.equal(c.release(62), false);
  assert.equal(c.release(64), true);
  assert.equal(c.release(64), false);
});

test('MIDI messages: notes on and off on any channel, nothing else', () => {
  assert.deepEqual(M.parse([0x90, 60, 100]), { on: true, note: 60, vel: 100 });
  assert.deepEqual(M.parse([0x93, 61, 1]), { on: true, note: 61, vel: 1 });
  assert.deepEqual(M.parse([0x90, 60, 0]), { on: false, note: 60, vel: 0 });
  assert.deepEqual(M.parse([0x85, 60, 64]), { on: false, note: 60, vel: 0 });
  assert.equal(M.parse([0xb0, 64, 127]), null); // the sustain pedal
  assert.equal(M.parse([0xf8]), null); // clock
  assert.equal(M.parse(undefined), null);
});

/* ---------- in Chromium ---------- */

let browser, mock, page;
const errors = [];
const W = 1280;
// A fake MIDI keyboard (window.keyboard.play(note) / .stop(note)), and a count of the sounds
// started (window.sounds), for the mute test.
const INIT = () => {
  window.sounds = 0;
  for (const proto of [AudioBufferSourceNode.prototype, OscillatorNode.prototype]) {
    const start = proto.start;
    proto.start = function (...a) { window.sounds++; return start.apply(this, a); };
  }
  const input = { name: 'Test keys', state: 'connected', onmidimessage: null };
  window.keyboard = {
    play: (n) => input.onmidimessage?.({ data: [0x90, n, 100] }),
    stop: (n) => input.onmidimessage?.({ data: [0x80, n, 0] }),
  };
  navigator.requestMIDIAccess = async () => ({ inputs: new Map([['k', input]]), onstatechange: null });
};

before(async () => {
  mock = await startMock({ headers: true });
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: W, height: 1600 } });
  await page.addInitScript(INIT);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
});
after(async () => {
  await browser?.close();
  await mock?.close();
});
beforeEach(async () => {
  await page.unrouteAll();
  await page.goto(mock.base + '/studio/groove/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(mock.base + '/studio/groove/');
  await page.waitForSelector('canvas.grid');
});

const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('mwm-groove-lab-1')));
// The notes of the track being edited (the first, or one by instrument).
async function notesOf(inst) {
  const st = await saved();
  const G = st.grooves.find((g) => g.id === st.settings.groove) || st.grooves[0];
  const v = G.versions[st.settings.meter || '2/4'];
  const take = st.settings.variant >= 0 ? v.variants[st.settings.layer][st.settings.variant].tracks : v.layers[st.settings.layer];
  return take.find((t) => !inst || t.inst === inst).notes;
}
async function layer(name) {
  await page.click(`.layer-tab:has-text("${name}")`);
  await page.waitForTimeout(100);
}
/* A piano roll's grid: where step s of pitch m is on the page (scrolled into view first). */
async function roll(i = 0, inst = 'bass') {
  const { lo, hi } = N.rollRange(zones(inst), []);
  const box = async () => page.evaluate((i) => {
    const c = document.querySelectorAll('.gridwrap.roll canvas')[i];
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  }, i);
  const rowH = 15;
  const at = async (s, m, { dx = 0.5, dy = 0.5 } = {}) => {
    await page.evaluate(({ i, y }) => {
      const w = document.querySelectorAll('.gridwrap.roll')[i];
      w.scrollIntoView({ block: 'center' });
      if (y < w.scrollTop + 20 || y > w.scrollTop + w.clientHeight - 20) w.scrollTop = y - w.clientHeight / 2;
    }, { i, y: (hi - m) * rowH });
    const b = await box();
    const cw = (b.w - 44) / 32;
    return { x: b.left + 44 + (s + dx) * cw, y: b.top + (hi - m + dy) * rowH, cw };
  };
  return { lo, hi, at, box };
}
async function until(ok, ms = 3000) {
  for (const t = Date.now(); !ok(); ) {
    if (Date.now() - t > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}
async function click(p) {
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(60);
}
// A new, empty groove to work in.
async function fresh() {
  await page.click('button:has-text("New")');
  await page.waitForTimeout(100);
}

test('notes go in on the row clicked, even on the top row, and the rows stay put', async () => {
  await layer('Bass');
  await fresh();
  const r = await roll();
  const before = (await r.box()).h;
  await click(await r.at(0, r.hi));
  await click(await r.at(2, r.hi));
  await click(await r.at(4, r.hi - 1));
  await click(await r.at(6, r.lo));
  assert.equal((await r.box()).h, before);
  assert.deepEqual((await notesOf()).map((n) => [n.s, n.m]), [[0, 61], [2, 61], [4, 60], [6, 28]]);
  assert.deepEqual(errors.splice(0), []);
});

test('a shaky click on a note removes it; a drag moves it by whole rows and steps', async () => {
  await layer('Bass');
  await fresh();
  const r = await roll();
  await click(await r.at(4, 48));
  await click(await r.at(12, 50));
  // Pressed near the bottom edge of its row, the mouse slips 4 px into the row below.
  const p = await r.at(4, 48, { dy: 0.85 });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 2, p.y + 4, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  assert.deepEqual((await notesOf()).map((n) => [n.s, n.m]), [[12, 50]]);
  // A real drag (from the note's left half: its right half stretches it): two rows up and
  // three steps on.
  const q = await r.at(12, 50, { dx: 0.25 });
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.mouse.move(q.x + 3 * q.cw, q.y - 2 * 15, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  assert.deepEqual((await notesOf()).map((n) => [n.s, n.m]), [[15, 52]]);
  // One undo step for the drag.
  await page.click('button:has-text("Undo")');
  assert.deepEqual((await notesOf()).map((n) => [n.s, n.m]), [[12, 50]]);
  assert.deepEqual(errors.splice(0), []);
});

test('the piano roll stays scrolled where it was through Undo and Restore', async () => {
  await layer('Horns');
  const r = await roll(0, 'horn');
  await page.evaluate(() => { document.querySelector('.gridwrap.roll').scrollTop = 120; });
  await page.waitForTimeout(100);
  const top = () => page.evaluate(() => document.querySelector('.gridwrap.roll').scrollTop);
  const b = await r.box();
  await page.mouse.click(b.left + 44 + 30 * ((b.w - 44) / 32), b.top + 120 + 100);
  await page.waitForTimeout(100);
  assert.equal(await top(), 120);
  await page.click('button:has-text("Undo")');
  await page.waitForTimeout(100);
  assert.equal(await top(), 120);
  // Restore puts new copies of the grooves in.
  const st = await saved();
  const file = path.join(os.tmpdir(), `grooves-${process.pid}.json`);
  fs.writeFileSync(file, JSON.stringify({ grooves: st.grooves }));
  await page.setInputFiles('input[type=file]', file);
  await page.waitForSelector('.status');
  fs.rmSync(file);
  assert.equal(await top(), 120);
  assert.deepEqual(errors.splice(0), []);
});

test('Publish asks before it takes grooves out of the game, and names them', async () => {
  const mine = (await saved())?.grooves || await page.evaluate(async () => (await (await fetch('/musician-maker/grooves.json')).json()).grooves);
  const old = { id: 'old-one', name: 'City Slicker', key: 0, versions: { '2/4': { meter: '2/4', beats: 8, swing: 0, layers: { pulse: [{ inst: 'claves', vol: 1, notes: [{ s: 0, v: 1 }] }] } } } };
  let gameList = [...mine, old];
  const puts = [];
  await page.route('**/api/live/grooves.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ grooves: gameList }) }));
  await page.route('**/studio/api/live/grooves', (r) => {
    puts.push(JSON.parse(r.request().postData()));
    gameList = puts.at(-1).grooves;
    r.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.click('button:has-text("Publish to site")');
  await page.waitForSelector('dialog.ask');
  assert.match(await page.locator('dialog.ask h2').innerText(), /Take this groove out of the game\?/);
  assert.deepEqual(await page.locator('dialog.ask li').allInnerTexts(), ['City Slicker']);
  await page.click('dialog.ask button:has-text("Cancel")');
  await page.waitForTimeout(100);
  assert.equal(puts.length, 0);
  assert.equal(await page.locator('dialog').count(), 0);
  // Yes: it publishes this list.
  await page.click('button:has-text("Publish to site")');
  await page.click('dialog.ask button:has-text("Publish")');
  await page.waitForSelector('.status');
  assert.equal(puts.length, 1);
  assert.deepEqual(puts[0].grooves.map((g) => g.id), mine.map((g) => g.id));
  // Nothing taken out: no question.
  await page.click('button:has-text("Publish to site")');
  await until(() => puts.length === 2);
  assert.equal(await page.locator('dialog').count(), 0);
  // The site doesn't answer: asks too.
  await page.route('**/api/live/grooves.json', (r) => r.fulfill({ status: 503, body: 'down' }));
  await page.click('button:has-text("Publish to site")');
  await page.waitForSelector('dialog.ask');
  assert.match(await page.locator('dialog.ask h2').innerText(), /Couldn't check/);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  assert.equal(puts.length, 2);
  assert.deepEqual(errors.splice(0), []);
});

test('a MIDI keyboard plays the piano roll and step records chords at the cursor', async () => {
  await layer('Bass');
  await fresh();
  await page.click('button:has-text("MIDI")');
  await page.waitForSelector('.midi-name');
  assert.equal(await page.locator('.midi-name').innerText(), '🎹 Test keys');
  assert.equal(await page.locator('.card.midi').count(), 1);
  const key = async (notes, gap = 0) => {
    for (const n of notes) { await page.evaluate((n) => window.keyboard.play(n), n); if (gap) await page.waitForTimeout(gap); }
    await page.waitForTimeout(20);
    for (const n of notes) await page.evaluate((n) => window.keyboard.stop(n), n);
    await page.waitForTimeout(30);
  };
  // Not recording: it only plays.
  await key([41]);
  assert.deepEqual(await notesOf(), []);
  await page.click('button:has-text("Rec")');
  await page.click('.seg button:has-text("8th")');
  await key([41]);
  await key([45, 48]);
  await key([12]); // far below the bass: left out, no step taken
  await page.keyboard.press('ArrowRight'); // a rest
  await key([43]);
  assert.deepEqual((await notesOf()).map((n) => [n.s, n.m, n.l]), [[0, 41, 2], [2, 45, 2], [2, 48, 2], [6, 43, 2]]);
  // Backspace takes the last step out.
  await page.keyboard.press('Backspace');
  assert.deepEqual((await notesOf()).map((n) => [n.s, n.m]), [[0, 41], [2, 45], [2, 48]]);
  await key([46]);
  assert.deepEqual((await notesOf()).map((n) => [n.s, n.m]), [[0, 41], [2, 45], [2, 48], [6, 46]]);
  // Each chord is one undo step.
  await page.click('button:has-text("Undo")');
  assert.equal((await notesOf()).length, 3);
  // Key lock leaves out keys outside the key (F major: no B natural).
  await page.check('label:has-text("Key lock") input');
  await key([47]);
  assert.equal((await notesOf()).length, 3);
  await page.click('button.midi-name');
  assert.equal(await page.locator('.midi-name').count(), 0);
  assert.deepEqual(errors.splice(0), []);
});

test('Select: a box or a bar picks notes; copy, paste, arrows and Delete work on them', async () => {
  await layer('Bass');
  await fresh();
  const r = await roll();
  for (const [s, m] of [[0, 41], [2, 45], [4, 48], [6, 45]]) await click(await r.at(s, m));
  await page.click('.seg button:has-text("Select")');
  // A double-click in bar 1 picks its notes; copy; paste twice fills bars 2 and 3.
  const p = await r.at(1, 55);
  await page.mouse.dblclick(p.x, p.y);
  await page.waitForTimeout(100);
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await page.keyboard.press('Control+v');
  const ns = (await notesOf()).map((n) => [n.s, n.m]);
  assert.deepEqual(ns, [[0, 41], [2, 45], [4, 48], [6, 45], [8, 41], [10, 45], [12, 48], [14, 45], [16, 41], [18, 45], [20, 48], [22, 45]]);
  // The last paste stays picked: up a half step, one step later.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  assert.deepEqual((await notesOf()).slice(8).map((n) => [n.s, n.m]), [[17, 42], [19, 46], [21, 49], [23, 46]]);
  // Velocity of the picked ones.
  await page.$eval('.bar.picks input[type=range]', (el) => {
    el.value = '30';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.deepEqual((await notesOf()).slice(8).map((n) => n.v), [0.3, 0.3, 0.3, 0.3]);
  assert.equal((await notesOf())[0].v, 0.8);
  await page.keyboard.press('Delete');
  assert.equal((await notesOf()).length, 8);
  // A box over two notes of bar 2.
  const a = await r.at(9, 50);
  const b = await r.at(12.6, 40);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  await page.click('.bar.picks button:has-text("Delete")');
  assert.deepEqual((await notesOf()).map((n) => [n.s, n.m]), [[0, 41], [2, 45], [4, 48], [6, 45], [8, 41], [14, 45]]);
  assert.deepEqual(errors.splice(0), []);
});

test('Key lock puts a click between rows on the nearest note in the key; transpose moves by its steps', async () => {
  await layer('Bass');
  await fresh();
  await page.check('label:has-text("Key lock") input');
  const r = await roll();
  // F major: B2 (47) is out; the top half of its row gives C3, the bottom half B♭2.
  await click(await r.at(0, 47, { dy: 0.25 }));
  await click(await r.at(2, 47, { dy: 0.75 }));
  assert.deepEqual((await notesOf()).map((n) => n.m), [48, 46]);
  await page.click('.shift button[aria-label="Up a scale step"]');
  assert.deepEqual((await notesOf()).map((n) => n.m), [50, 48]);
  await page.uncheck('label:has-text("Key lock") input');
  await page.click('.shift button[aria-label="Down a half step"]');
  assert.deepEqual((await notesOf()).map((n) => n.m), [49, 47]);
  await page.click('.shift button[aria-label="Down an octave"]');
  assert.deepEqual((await notesOf()).map((n) => n.m), [37, 35]);
  // Picked notes only, when some are picked.
  await page.click('.seg button:has-text("Select")');
  await click(await r.at(0, 37));
  await page.click('.shift button[aria-label="Up an octave"]');
  assert.deepEqual((await notesOf()).map((n) => n.m), [49, 35]);
  // With Key lock on, a note outside the key dragged sideways keeps its pitch; dragged a row
  // up, it lands on the next note in the key.
  await page.check('label:has-text("Key lock") input');
  const p = await r.at(0, 49, { dx: 0.25 });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 2 * p.cw, p.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  assert.deepEqual((await notesOf()).map((n) => [n.s, n.m]), [[2, 35], [2, 49]]);
  const q = await r.at(2, 49, { dx: 0.25 });
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.mouse.move(q.x, q.y - 15, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  assert.deepEqual((await notesOf()).map((n) => [n.s, n.m]), [[2, 35], [2, 50]]);
  assert.deepEqual(errors.splice(0), []);
});

test("each piano roll shows the other layers' notes faintly, unless turned off", async () => {
  await layer('Horns');
  // Basic's bass plays F2 (41) on the first step; the horns' roll shows it faintly.
  const { hi } = N.rollRange(zones('horn'), []);
  const pixel = () => page.evaluate((hi) => {
    const c = document.querySelector('.gridwrap.roll canvas');
    const dpr = devicePixelRatio;
    const cw = (c.width / dpr - 44) / 32;
    return [...c.getContext('2d').getImageData(Math.round((44 + cw * 1.5) * dpr), Math.round(((hi - 41) * 15 + 7) * dpr), 1, 1).data];
  }, hi);
  const ghost = await pixel();
  await page.uncheck('label:has-text("Other layers") input');
  await page.waitForTimeout(60);
  const plain = await pixel();
  assert.notDeepEqual(ghost, plain);
  assert.ok(ghost[0] < plain[0], `${ghost} against ${plain}`);
  assert.deepEqual(errors.splice(0), []);
});

test('mute and solo change what plays here, and only here', async () => {
  await page.click('.seg button:has-text("Combo 0")'); // the pulse layer alone: claves
  await layer('Pulse');
  const heard = async () => {
    await page.evaluate(() => { window.sounds = 0; });
    await page.click('button.play');
    await page.waitForTimeout(1200);
    await page.click('button.play');
    return page.evaluate(() => window.sounds);
  };
  assert.ok(await heard() > 0);
  await page.click('.head .ms button[title="Mute"]');
  assert.equal(await page.locator('.layer-tab.on small').innerText().then((t) => t.includes('🔇')), true);
  assert.equal(await heard(), 0);
  await page.click('.head .ms button[title="Mute"]');
  // Solo the bass: only it plays, even with Hear on combo 0.
  await layer('Bass');
  await page.click('.card .ms button[title="Solo"]');
  assert.ok(await heard() > 0);
  await layer('Pulse');
  assert.equal(await page.locator('.head.quiet').count(), 1);
  // Never published: the saved grooves have no trace of it.
  assert.doesNotMatch(JSON.stringify((await saved()).grooves), /mute|solo/);
  assert.deepEqual(errors.splice(0), []);
});

test('the percussion grid still paints hits along a row and takes them off', async () => {
  await layer('Drums');
  await fresh();
  const box = await page.evaluate(() => { const r = document.querySelector('.split canvas').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width }; });
  const cw = (box.w - 44) / 32;
  const y = box.top + 20;
  await page.mouse.move(box.left + 44 + cw * 0.5, y);
  await page.mouse.down();
  await page.mouse.move(box.left + 44 + cw * 3.5, y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  assert.deepEqual((await notesOf('bass-drum')).map((n) => n.s), [0, 1, 2, 3]);
  await page.mouse.click(box.left + 44 + cw * 1.5, y);
  await page.waitForTimeout(60);
  assert.deepEqual((await notesOf('bass-drum')).map((n) => n.s), [0, 2, 3]);
  assert.deepEqual(errors.splice(0), []);
});
