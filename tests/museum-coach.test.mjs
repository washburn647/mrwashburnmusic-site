/* Listen and Try this, in the Instrument Museum (museum/coach.js, lessons.js, score.js): every
   exhibit has a tune of its own and three tasks, plays every note of all its tunes on itself, and
   its "Show me" for each task passes that task. Then the buttons, in Chromium. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';
import { EXHIBITS } from '../museum/data.js';
import { LESSONS, COMMON } from '../museum/lessons.js';
import * as score from '../museum/score.js';

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
  // The same module the page uses (one copy per URL), for its state.
  await page.evaluate(async () => { window.__coach = await import('/museum/coach.js'); });
});
after(async () => {
  await browser.close();
  await mock.close();
});

async function open(id) {
  await page.evaluate((x) => { location.hash = x; }, id);
  await page.waitForFunction((x) => !document.getElementById('stage').classList.contains('loading')
    && document.querySelector('#stage canvas') && window.__coach?.state().cur?.ex.id === x, id, { timeout: 15000 });
}

test('score.js reads notes, parts, chords, lengths and loudness', () => {
  const e = score.events('C4 D4/ E4- r F#4. Bb3* G4!~ A4? C4+E4 k+s @Am^/', { bpm: 60 });
  const at = (i) => Math.round(e[i].at * 1000) / 1000;
  assert.deepEqual(e.slice(0, 6).map((x) => x.midi), [60, 62, 64, 66, 58, 67]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(at), [0, 1, 1.5, 4.5, 6, 6.667, 7.667], 'a rest takes its time');
  assert.equal(e[3].dur, 1.5);
  assert.equal(e[5].vel, 1);
  assert.equal(e[5].slur, true);
  assert.equal(e[6].glide, true, 'a slur glides into the next note');
  assert.equal(e[6].vel, 0.45);
  assert.deepEqual(e.filter((x) => Math.abs(x.at - 8.667) < 0.01).map((x) => x.midi), [60, 64]);
  assert.deepEqual(e.filter((x) => x.part).map((x) => x.part), ['k', 's']);
  const { chord, up, dur } = e.at(-1);
  assert.deepEqual({ chord, up, dur }, { chord: 'Am', up: true, dur: 0.5 });
  assert.deepEqual(score.events(['C4 D4', 'E3-'], { shift: 2 }).map((x) => x.midi), [62, 54, 64]);
  assert.equal(score.length(score.events('C4 D4-', { bpm: 120 })), 1.5);
});

test('every exhibit has a tune of its own and an easy, a medium and a hard task', () => {
  const kinds = ['notes', 'any', 'together', 'hits', 'chords', 'steady', 'fast', 'gliss', 'rhythm', 'roll', 'choke'];
  assert.deepEqual(COMMON.map((c) => c.name), ['Scale', 'Hot Cross Buns', 'Twinkle, Twinkle, Little Star']);
  assert.deepEqual(Object.keys(LESSONS).sort(), EXHIBITS.map((x) => x.id).sort());
  for (const ex of EXHIBITS) {
    const L = LESSONS[ex.id];
    assert.ok(L.tune.name && L.tune.by && L.tune.bpm > 30, `${ex.id}: its tune has a name, a line about it and a speed`);
    assert.ok(score.events(L.tune.voices).length >= 6, `${ex.id}: its tune has notes`);
    if (L.home) assert.notEqual(score.midi(L.home), null, `${ex.id}: home ${L.home}`);
    assert.equal(L.tasks.length, 3, `${ex.id}: three tasks`);
    for (const [text, goal] of L.tasks) {
      assert.ok(text.length > 12 && /[.!]$/.test(text), `${ex.id}: "${text}"`);
      const [kind, arg] = goal.split(':');
      assert.ok(kinds.includes(kind), `${ex.id}: ${goal}`);
      if (['notes', 'any', 'together'].includes(kind)) {
        for (const n of arg.split(' ')) assert.notEqual(score.midi(n), null, `${ex.id}: ${n} in ${goal}`);
      }
    }
  }
});

/* Plays everything an exhibit has to play, one sound at a time, straight away (not in time),
   and notes what the instrument says it played: each sound must be the one asked for. Each
   task's Show me, as the instrument played it, is then given to that task's checker, with the
   times it would have had. */
async function playAll(id) {
  await open(id);
  return page.evaluate(async () => {
    const coach = window.__coach;
    const { LESSONS } = await import('/museum/lessons.js');
    const { ex, kit } = coach.state().cur;
    const perf = kit.perf;
    let heard = [];
    const was = { note: kit.note, hit: kit.hit, chord: kit.chord };
    let prev = null;
    kit.note = function (m, how) { if (m != null && how !== 'show') heard.push({ midi: Math.round(m) }); return was.note.call(this, m, how); };
    kit.hit = function (part, how = {}) { heard.push({ part, ...how }); return was.hit.call(this, part, how); };
    kit.chord = function (name) { heard.push({ chord: name }); return was.chord.call(this, name); };
    const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
    const ok = (e) => {
      // (the same chord strummed again straight away is heard once: the strum goes on)
      if (e.chord) return heard.some((h) => h.chord === e.chord) || prev?.chord === e.chord;
      if (e.midi != null) return heard.some((h) => h.midi === Math.round(e.midi));
      if (e.part === 'roll') return heard.some((h) => h.roll);
      if (e.part === 'choke') return heard.some((h) => h.choke);
      if (e.part === 'shake') return heard.some((h) => h.shake);
      if (e.part === 'z') return heard.some((h) => h.scrape);
      return heard.some((h) => h.part === e.part);
    };
    const problems = [];
    const lists = [0, 1, 2, 3].map((n) => ({ name: coach.tune(ex, n).name, evs: coach.tune(ex, n).evs }));
    LESSONS[ex.id].tasks.forEach(([, goal], n) => lists.push({ name: goal, evs: coach.goal(goal, ex).demo(), n }));
    for (const list of lists) {
      if (!list.evs.length) { problems.push(`${list.name}: nothing to play`); continue; }
      // A strum is one chord however many strings it crosses: the same chord again counts after a moment.
      if (list.evs.some((e) => e.chord)) await new Promise((ok) => setTimeout(ok, 300));
      perf.prepare?.(list.evs);
      const fed = [];
      prev = null;
      for (const e of list.evs) {
        const what = JSON.stringify(e.chord ?? e.part ?? e.midi);
        if (!perf.can(e)) { problems.push(`${list.name}: can't play ${what}`); continue; }
        heard = [];
        const h = perf.down(e);
        if (e.chord) for (let k = 0; k < 3; k++) await frame();   // a strum crosses the strings one by one
        for (let k = 0; k < 4 && !ok(e); k++) await frame();
        if (!ok(e)) problems.push(`${list.name}: asked for ${what}, played ${JSON.stringify(heard)}`);
        fed.push(...heard.map((x) => [x, e.at]));
        perf.up(h, e);
        prev = e;
      }
      perf.finish?.();
      if (list.n != null) {
        const g = coach.goal(list.name, ex);
        for (const [x, t] of fed) g.feed(x, t);
        if (!g.done) problems.push(`${list.name}: Show me doesn't pass it (${g.lit.map(Number).join('')})`);
      }
    }
    Object.assign(kit, was);
    return problems;
  });
}

for (const room of ['keyboard', 'strings', 'woodwinds', 'brass', 'percussion', 'world']) {
  test(`the ${room} exhibits play all their tunes and each task's Show me, note for note`, async () => {
    for (const ex of EXHIBITS.filter((x) => x.room === room)) {
      assert.deepEqual(await playAll(ex.id), [], ex.id);
    }
    assert.deepEqual(errors, []);
  });
}

const strip = () => page.evaluate(() => {
  const c = document.getElementById('coach');
  return c.hidden ? null : { kind: c.dataset.kind, text: c.querySelector('.title')?.textContent, chips: [...c.querySelectorAll('.chips li')].map((l) => l.className) };
});

test('Listen plays a tune on the piano by itself, and playing stops it', async () => {
  await open('piano');
  assert.equal(await page.isVisible('#listen'), true);
  await page.click('#listen');
  const items = await page.locator('#menu .item .title').allTextContents();
  assert.deepEqual(items, ['Scale', 'Hot Cross Buns', 'Twinkle, Twinkle, Little Star', 'Für Elise']);
  await page.locator('#menu .item', { hasText: 'Hot Cross Buns' }).click();
  assert.equal(await page.isHidden('#menu'), true);
  assert.deepEqual(await strip(), { kind: 'listen', text: 'Hot Cross Buns', chips: [] });
  // E D C: the keys go down by themselves.
  await page.waitForFunction(() => document.getElementById('nn').textContent === 'E4', null, { timeout: 3000 });
  await page.waitForFunction(() => document.getElementById('nn').textContent === 'D4', null, { timeout: 3000 });
  await page.keyboard.press('q');
  assert.equal(await page.evaluate(() => window.__coach.state().show), null);
  assert.equal(await strip(), null);
  // Going to another exhibit stops a tune too.
  await page.click('#listen');
  await page.locator('#menu .item', { hasText: 'Scale' }).click();
  await open('violin');
  assert.equal(await page.evaluate(() => window.__coach.state().show), null);
  assert.equal(await strip(), null);
});

/* Show me moves the piano's keys into view: find middle C on the computer keys again (A plays
   the first C showing; Z and X move an octave). */
async function middleC() {
  for (let k = 0; k < 8; k++) {
    await page.keyboard.press('a');
    const n = await page.textContent('#nn');
    if (n === 'C4') return;
    await page.keyboard.press(Number(n.at(-1)) > 4 ? 'z' : 'x');
  }
}

test('Try this checks what is played, and remembers each task passed', async () => {
  await page.evaluate(() => localStorage.removeItem('museum-tried'));
  await open('piano');
  await page.click('#try');
  assert.deepEqual(await page.locator('#menu .item .title').allTextContents(), ['Easy', 'Medium', 'Hard']);
  await page.locator('#menu .item', { hasText: 'Easy' }).click();
  assert.deepEqual(await strip(), { kind: 'task', text: 'Find middle C, then the C one octave higher.', chips: ['next', ''] });
  await page.keyboard.press('x');   // the computer keys up an octave, from C3 to C4
  await page.keyboard.press('a');
  assert.equal(await page.textContent('#nn'), 'C4');
  assert.deepEqual((await strip()).chips, ['lit', 'next']);
  await page.keyboard.press('k');
  assert.equal(await page.textContent('#nn'), 'C5');
  assert.deepEqual(await strip(), { kind: 'done', text: 'You did it!', chips: [] });
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('museum-tried'))), { piano: [true] });
  // The next one, from the strip; its Show me plays it, but doesn't pass it for you.
  await page.getByRole('button', { name: 'Try medium' }).click();
  assert.equal((await strip()).text, 'Play a C major chord: C, E and G at the same time.');
  await page.getByRole('button', { name: 'Show me' }).click();
  await page.waitForFunction(() => window.__coach.state().show, null, { timeout: 2000 });
  await page.waitForFunction(() => !window.__coach.state().show, null, { timeout: 8000 });
  assert.equal((await strip()).kind, 'task');
  await middleC();
  for (const k of 'adg') await page.keyboard.down(k);
  for (const k of 'adg') await page.keyboard.up(k);
  assert.equal((await strip()).kind, 'done');
  // Two of three: the button goes on to the one left; all three are a full set.
  assert.equal(await page.getByRole('button', { name: 'Try hard' }).isVisible(), true);
  await page.evaluate(() => localStorage.setItem('museum-tried', JSON.stringify({ piano: [true, false, true] })));
  await page.getByRole('button', { name: 'Close' }).click();
  await page.click('#try');
  await page.locator('#menu .item', { hasText: 'Medium' }).click();
  await page.getByRole('button', { name: 'Show me' }).click();
  await page.waitForFunction(() => !window.__coach.state().show, null, { timeout: 8000 });
  await middleC();
  for (const k of 'adg') await page.keyboard.down(k);
  for (const k of 'adg') await page.keyboard.up(k);
  assert.equal((await strip()).text, 'You did all three!');
  assert.equal(await page.locator('#coach .btns button').count(), 1, 'only Close');
  await page.click('#try');
  assert.deepEqual(await page.locator('#menu .item .title').allTextContents(), ['Easy ✓', 'Medium ✓', 'Hard ✓']);
  await page.keyboard.press('Escape');
  assert.equal(await page.isHidden('#menu'), true);
});

test('a drum task: hold the snare for a roll', async () => {
  await open('snare');
  await page.click('#try');
  await page.locator('#menu .item', { hasText: 'Easy' }).click();
  assert.equal((await strip()).kind, 'task');
  await page.keyboard.down(' ');
  await page.waitForTimeout(400);
  await page.keyboard.up(' ');
  assert.equal((await strip()).kind, 'done');
  await page.getByRole('button', { name: 'Close' }).click();
  assert.equal(await strip(), null);
});

test('the instrument redraws at once when the strip opens above it, with no blank frame', async () => {
  await open('harp');
  await page.waitForTimeout(300);
  const drawn = await page.evaluate(async () => {
    document.getElementById('try').click();
    document.querySelector('#menu .item').click();    // the strip opens, and the stage shrinks
    // After this frame is painted, before the next one:
    await new Promise((ok) => requestAnimationFrame(ok));
    await new Promise((ok) => setTimeout(ok, 0));
    const c = document.querySelector('#stage canvas');
    const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < px.length; i += 4 * 97) if (px[i]) n++;
    return n / (px.length / (4 * 97));
  });
  assert.ok(drawn > 0.5, `drawn (${drawn})`);
  await page.getByRole('button', { name: 'Close' }).click();
});

test('on a phone, one button opens both lists', async () => {
  await page.setViewportSize({ width: 390, height: 780 });
  await open('trumpet');
  assert.equal(await page.isHidden('#try'), true);
  assert.equal(await page.getAttribute('#listen', 'aria-label'), 'Listen and try this');
  await page.click('#listen');
  assert.deepEqual(await page.locator('#menu .head').allTextContents(), ['Listen to the trumpet', 'Try this']);
  assert.equal(await page.locator('#menu .item').count(), 7);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => { location.hash = ''; });
  assert.deepEqual(errors, []);
});
