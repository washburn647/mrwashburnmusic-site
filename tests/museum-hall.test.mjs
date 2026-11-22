/* The Instrument Museum's building, in Chromium: the floor plan in the lobby (museum/plan.js,
   lobby.js), the rooms to walk through (gallery.js), the audio tour (tour.js), the quiz and its
   badge (quiz.js), the visitor's passport (passport.js), and where Back goes (app.js). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';
import { ROOMS, EXHIBITS } from '../museum/data.js';
import { LESSONS } from '../museum/lessons.js';
import { STOPS } from '../museum/tour.js';
import { sizeText } from '../museum/gallery.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let browser, mock, page;
const errors = [];
before(async () => {
  mock = await startMock();
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
});
after(async () => {
  await browser.close();
  await mock.close();
});

/* A new visit, in a new tab (so a history of its own), straight to this address, with this
   passport (none: a first visit). */
async function visit(passport = null, hash = '') {
  await page?.close();
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(mock.base + '/museum/' + hash);
  await page.evaluate((p) => {
    if (p) localStorage.setItem('museum-passport', JSON.stringify(p));
    else localStorage.removeItem('museum-passport');
  }, passport);
  await page.reload();
  if (!hash) await page.waitForSelector('#hall:not([hidden]) #plan svg');
}
const passport = () => page.evaluate(() => JSON.parse(localStorage.getItem('museum-passport') || '{}'));
const hash = () => page.evaluate(() => location.hash);
const focused = () => page.evaluate(() => document.activeElement?.getAttribute('href'));
async function inRoom(id) {
  const name = ROOMS.find((r) => r.id === id).name;
  const hrefs = EXHIBITS.filter((e) => e.room === id).map((e) => `#${e.id}`).join(' ');
  await page.waitForFunction(([name, hrefs]) => !document.getElementById('gallery').hidden && document.getElementById('gal-name').textContent === name
    && [...document.querySelectorAll('#track .bay')].map((b) => b.getAttribute('href')).join(' ') === hrefs, [name, hrefs]);
}
async function atExhibit(id) {
  const name = EXHIBITS.find((e) => e.id === id).name;
  await page.waitForFunction(([id, name]) => location.hash === `#${id}` && document.getElementById('ex-name').textContent === name
    && !document.getElementById('stage').classList.contains('loading') && document.querySelector('#stage canvas'), [id, name], { timeout: 15000 });
}
async function inLobby() {
  await page.waitForFunction(() => !document.getElementById('hall').hidden && location.hash.replace('#', '') === '');
}

test('the floor plan shows every room and instrument, room by room as you walk round, with nothing hidden or overlapping', async () => {
  await visit({ played: ['violin', 'congas'], badges: {}, tour: 0 });
  // each room's sign, then its instruments, round the building; then the tour desk
  const order = [];
  for (const r of ROOMS) order.push(`#room/${r.id}`, ...EXHIBITS.filter((e) => e.room === r.id).map((e) => `#${e.id}`));
  order.push('#tour/1');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForFunction(() => document.querySelector('#plan svg')?.getAttribute('width') === String(Math.min(1180, Math.max(300, Math.floor(document.getElementById('plan').clientWidth)))));
    const got = await page.evaluate(() => {
      const plan = document.querySelector('#plan svg').getBoundingClientRect();
      const links = [...document.querySelectorAll('#plan a')].filter((a) => a.getAttribute('tabindex') !== '-1');
      const out = [];
      for (const el of document.querySelectorAll('#plan a .ring, #plan a .tag')) {
        const b = el.getBoundingClientRect();
        if (b.left < plan.left - 1 || b.right > plan.right + 1 || b.top < plan.top - 1 || b.bottom > plan.bottom + 1) out.push(`${el.closest('a').getAttribute('href')} is off the plan`);
      }
      const tags = [...document.querySelectorAll('#plan a .tag')].map((el) => [el.closest('a').getAttribute('href'), el.getBoundingClientRect()]);
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const [p, q] = [tags[i][1], tags[j][1]];
          if (Math.min(p.right, q.right) - Math.max(p.left, q.left) > 0.5 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 0.5) out.push(`${tags[i][0]} and ${tags[j][0]} overlap`);
        }
      }
      return { links: links.map((a) => [a.getAttribute('href'), a.getAttribute('aria-label')]), out, tags: tags.length };
    });
    assert.deepEqual(got.links.map(([h]) => h), order, `the links, in order, at ${width}px`);
    assert.equal(got.tags, EXHIBITS.length + ROOMS.length, 'a plaque for each instrument and a sign for each room');
    assert.deepEqual(got.out, [], `at ${width}px`);
    const label = Object.fromEntries(got.links);
    assert.equal(label['#violin'], 'Violin (played)');
    assert.equal(label['#congas'], 'Congas (played)');
    assert.equal(label['#piano'], 'Piano');
    assert.equal(label['#room/strings'], 'Strings: walk through the room');
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  // the passport: a stamp for each room played in
  const stamps = await page.evaluate(() => [...document.querySelectorAll('#passport .stamp')].map((s) => s.className.replace('stamp ', '')));
  assert.deepEqual(stamps, ROOMS.map((r) => (r.id === 'strings' || r.id === 'world' ? 'stamp' : 'none')));
  assert.match(await page.textContent('#passport .count'), new RegExp(`^2 of ${EXHIBITS.length} instruments played`));
  assert.deepEqual(errors, []);
});

test('each room shows its instruments in order, with their sizes, and a door to the room either side', async () => {
  await visit();
  for (const [i, r] of ROOMS.entries()) {
    await page.evaluate((id) => { location.hash = `room/${id}`; }, r.id);
    await inRoom(r.id);
    const got = await page.evaluate(() => ({
      name: document.getElementById('gal-name').textContent,
      wall: document.querySelector('#track .wall-text h3').textContent,
      bays: [...document.querySelectorAll('#track .bay')].map((b) => ({ label: b.getAttribute('aria-label'), left: b.offsetLeft, right: b.offsetLeft + b.offsetWidth })),
      doors: [...document.querySelectorAll('#track .door')].map((d) => d.getAttribute('href')),
      here: document.querySelector('#gal-map [aria-current]')?.getAttribute('href'),
    }));
    const mine = EXHIBITS.filter((e) => e.room === r.id);
    assert.equal(got.name, r.name);
    assert.equal(got.wall, r.name);
    mine.forEach((e, k) => assert.equal(got.bays[k].label, `${e.name}, ${sizeText(e.size)}`));
    for (let k = 1; k < got.bays.length; k++) assert.ok(got.bays[k].left >= got.bays[k - 1].right - 1, `${mine[k].id} stands clear of ${mine[k - 1].id}`);
    const [prev, next] = [ROOMS[(i + ROOMS.length - 1) % ROOMS.length], ROOMS[(i + 1) % ROOMS.length]];
    assert.deepEqual(got.doors, [`#room/${prev.id}`, `#room/${next.id}`]);
    assert.equal(got.here, `#room/${r.id}`, 'the little map in the header lights this room');
  }
  assert.equal(sizeText([185, 'tall']), '6 feet tall (1.85 m)');
  assert.equal(sizeText([6, 'long']), '2½ inches long (6 cm)');
  assert.deepEqual(errors, []);
});

test('the instruments in the rooms are drawn to one scale, the smallest a little bigger to be seen', async () => {
  const res = await page.evaluate(async () => {
    const { layout } = await import('/museum/gallery.js');
    const { BOX } = await import('/museum/art.js');
    const { ROOMS } = await import('/museum/data.js');
    const out = [];
    for (const [w, h] of [[1280, 640], [390, 520]]) {
      for (const r of ROOMS) {
        const L = layout(r.id, w, h);
        for (const b of L.bays) out.push({ id: b.ex.id, w, cm: BOX[b.ex.id][4], drawn: Math.max(b.dw, b.dh) / L.u, mount: b.mount });
      }
    }
    return out;
  });
  for (const w of [1280, 390]) {
    const all = res.filter((x) => x.w === w);
    // units of the room per centimetre, for every instrument big enough to show at its size
    const k = all.filter((x) => x.cm >= 40).map((x) => x.drawn / x.cm);
    assert.ok(Math.max(...k) / Math.min(...k) < 1.001, `one scale at ${w}px: ${Math.min(...k)} to ${Math.max(...k)}`);
    for (const x of all) {
      assert.ok(x.drawn >= x.cm * k[0] - 0.01, `${x.id} is not drawn smaller than it is`);
      assert.ok(x.drawn <= Math.max(x.cm, 34) * k[0] + 0.01, `${x.id} is not drawn much bigger than it is`);
    }
    // and so a bigger instrument is never drawn smaller than a smaller one
    const by = [...all].sort((a, b) => a.cm - b.cm);
    for (let i = 1; i < by.length; i++) assert.ok(by[i].drawn >= by[i - 1].drawn - 0.01, `${by[i].id} (${by[i].cm} cm) beside ${by[i - 1].id} (${by[i - 1].cm} cm)`);
  }
});

test('a room\'s doors lead on round the museum, and the arrow keys walk from one instrument to the next', async () => {
  await visit(null, '#room/brass');
  await inRoom('brass');
  await page.focus('#track .bay');
  await page.keyboard.press('ArrowRight');
  assert.equal(await focused(), '#horn');
  await page.keyboard.press('ArrowRight');
  assert.equal(await focused(), '#trombone');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await focused(), '#horn');
  // through the far door, and into the next room by its near door
  await page.click('#track .door.right', { force: true });
  await inRoom('percussion');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => Math.round(document.getElementById('walk').scrollLeft)), 0);
  // and back: into the room by its far door
  await page.click('#track .door.left', { force: true });
  await inRoom('brass');
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => { const w = document.getElementById('walk'); return w.scrollWidth - w.clientWidth - w.scrollLeft < 3; }), 'at the far end of the room');
  assert.deepEqual(errors, []);
});

test('the audio tour stops at one instrument in each room, plays its own tune, and ends at the quiz', async () => {
  await visit();
  await page.click('#ticket a.go');
  for (const [i, st] of STOPS.entries()) {
    const n = i + 1;
    const room = ROOMS.find((r) => r.id === st.room);
    await page.waitForFunction((n) => location.hash === `#tour/${n}` && !document.getElementById('docent').hidden
      && document.querySelector('#docent .where')?.textContent.startsWith(`Stop ${n} of 6`), n);
    await inRoom(st.room);
    assert.equal(await page.textContent('#gal-name'), room.name);
    assert.equal(await page.evaluate(() => { const a = document.activeElement; return a?.matches('#docent a.hear') || `${a?.tagName}.${a?.className} ${a?.getAttribute('href')}`; }), true, `stop ${n}: Hear it play is next for the keyboard`);
    assert.equal(await page.getAttribute('#track .bay.stop', 'href'), `#${st.id}`, `stop ${n} is at the ${st.id}`);
    // standing in front of it
    const off = await page.evaluate(() => {
      const w = document.getElementById('walk');
      const b = document.querySelector('#track .bay.stop');
      const off = b.offsetLeft + b.offsetWidth / 2 - (w.scrollLeft + w.clientWidth / 2);
      // (or as near as the room's ends let you)
      return Math.abs(off) < 4 || (off > 0 && w.scrollLeft >= w.scrollWidth - w.clientWidth - 2) || (off < 0 && w.scrollLeft <= 2) ? 0 : off;
    });
    assert.equal(off, 0, `the ${st.id} is in front of you`);
    // Hear it play: the instrument plays its own tune by itself
    await page.click('#docent a.hear');
    await atExhibit(st.id);
    await page.waitForFunction((t) => !document.getElementById('coach').hidden && document.querySelector('#coach .title')?.textContent === t, LESSONS[st.id].tune.name);
    assert.match(await page.textContent('#tourbar .words'), new RegExp(`^Stop ${n} of 6`));
    await page.waitForTimeout(700);
    assert.ok(!(await passport()).played.includes(st.id), `the ${st.id} playing by itself is not the visitor playing it`);
    await page.click('#tourbar a.next');
  }
  await page.waitForSelector('#quiz:not([hidden]) #quiz-main .q');
  const p = await passport();
  assert.ok(p.badges.tour, 'the Toured badge');
  assert.equal(p.tour, 7);
  assert.deepEqual(errors, []);
});

test('the lobby\'s ticket keeps your place in the tour, and a second tour shows every stop again', async () => {
  await visit({ played: [], badges: {}, tour: 3 });
  assert.match(await page.textContent('#ticket p'), /stop 3 of 6: the flute/);
  assert.equal(await page.getAttribute('#ticket a.go', 'href'), '#tour/3');
  await visit({ played: [], badges: { tour: '2026-01-01' }, tour: 7 });
  assert.equal(await page.getAttribute('#ticket a.go', 'href'), '#quiz');
  await visit({ played: [], badges: { tour: '2026-01-01', quiz: '2026-01-01' }, tour: 7 });
  assert.equal(await page.textContent('#ticket a.go'), 'Take the tour again');
  await page.click('#ticket a.go');
  await page.waitForSelector('#docent:not([hidden])');
  await page.click('#docent a.hear');
  await atExhibit('piano');
  assert.ok(await page.evaluate(() => !document.getElementById('tourbar').hidden), 'the tour bar, the second time round');
  assert.match(await page.textContent('#tourbar .words'), /^Stop 1 of 6/);
  assert.equal((await passport()).tour, 1);
  assert.deepEqual(errors, []);
});

test('the quiz brings a missed question back, and six right answers earn the badge', async () => {
  await visit(null, '#quiz');
  const QUESTIONS = await page.evaluate(async () => (await import('/museum/quiz.js')).QUESTIONS.map(({ ask, answer, hear }) => ({ ask, answer, hear })));
  let missed = null;
  for (let k = 0; k < 7; k++) {
    await page.waitForSelector('#quiz-main .q .choice:not([aria-disabled])');
    const ask = await page.textContent('#q-ask');
    const q = QUESTIONS.find((x) => x.ask === ask);
    assert.ok(q, ask);
    assert.equal(!!(await page.$('#quiz-main .hear')), !!q.hear, `${ask}: a sound to play only when it is by ear`);
    if (k === 0) {
      missed = ask;
      await page.click(`#quiz-main .choice:not([data-v="${q.answer}"])`);
      assert.match(await page.textContent('#quiz-main .why'), /^Not quite\./);
      assert.equal(await page.getAttribute('#quiz-main .choice.answer', 'data-v'), q.answer, 'the right answer is shown');
    } else {
      if (k === 6) {
        assert.equal(ask, missed, 'the missed question comes back at the end');
        assert.match(await page.textContent('#quiz-main .qno'), /^Try this one again/);
      }
      await page.click(`#quiz-main .choice[data-v="${q.answer}"]`);
      assert.match(await page.textContent('#quiz-main .why'), /^Yes!/);
    }
    await page.click('#quiz-main .tool.next');
  }
  await page.waitForSelector('#quiz-main .won');
  assert.equal(await page.textContent('#won-title'), 'Museum Explorer');
  assert.ok((await passport()).badges.quiz);
  await page.click('#quiz-main .won a.next');
  await inLobby();
  await page.waitForSelector('#passport .badge-quiz');
  assert.deepEqual(errors, []);
});

test('playing an instrument marks it in the passport and stamps its room', async () => {
  await visit(null, '#congas');
  await atExhibit('congas');
  assert.deepEqual((await passport()).played || [], []);
  const p = await page.evaluate(() => {
    const c = document.querySelector('#stage canvas');
    const at = c.museumAt(0, 'middle');
    const r = c.getBoundingClientRect();
    return { x: r.left + at.u, y: r.top + at.v };
  });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
  assert.deepEqual((await passport()).played, ['congas']);
  await page.evaluate(() => { location.hash = ''; });
  await inLobby();
  assert.equal(await page.getAttribute('#plan a[href="#congas"]', 'aria-label'), 'Congas (played)');
  assert.equal(await page.getAttribute('#passport .stamp:nth-child(6)', 'class'), 'stamp stamp');
  assert.deepEqual(errors, []);
});

test('Back goes up to the floor plan, not back round the rooms you walked through, and never out of the museum', async () => {
  // a room, and the next one through its door: Back goes to the plan, by the room you were in
  await visit();
  await page.click('#plan a.sign[href="#room/brass"]');
  await inRoom('brass');
  await page.click('#track .door.right', { force: true });
  await inRoom('percussion');
  await page.click('#gallery .back');
  await inLobby();
  assert.equal(await focused(), '#room/percussion');
  // an instrument from the plan, and Back: back to the plan (the page before), even after a reload
  await page.click('#plan a.ex[href="#flute"]');
  await atExhibit('flute');
  await page.reload();
  await atExhibit('flute');
  let n = await page.evaluate(() => history.length);
  await page.click('#exhibit .back');
  await inLobby();
  assert.equal(await page.evaluate(() => history.length), n, 'by going back, not on');
  assert.equal(await focused(), '#flute');
  // the quiz from the plan, and back
  await page.evaluate(() => { location.hash = 'quiz'; });
  await page.waitForSelector('#quiz:not([hidden]) .q');
  await page.click('#quiz .back');
  await inLobby();
  // straight to an instrument from outside the museum: Back goes up to its room, then to the plan
  await visit(null, '#tuba');
  await atExhibit('tuba');
  n = await page.evaluate(() => history.length);
  await page.click('#exhibit .back');
  await inRoom('brass');
  assert.equal(await hash(), '#room/brass');
  await page.waitForTimeout(100);
  assert.equal(await focused(), '#tuba', 'standing in front of the tuba');
  await page.click('#gallery .back');
  await inLobby();
  assert.equal(await page.evaluate(() => history.length), n + 2, 'never back out of the museum');
  // an instrument from a tour stop: Back goes back to the stop
  await page.click('#ticket a.go');
  await page.waitForSelector('#docent:not([hidden])');
  await page.click('#docent a.hear');
  await atExhibit('piano');
  await page.click('#exhibit .back');
  await page.waitForFunction(() => location.hash === '#tour/1' && !document.getElementById('docent').hidden);
  assert.deepEqual(errors, []);
});
