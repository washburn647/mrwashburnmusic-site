/* A walk through the whole Instrument Museum (museum/) in Chromium, as a visitor on a computer
   and one on a phone, under the headers the site really sends (_headers, its strict
   Content-Security-Policy among them): the floor plan, every room, every stop of the tour, the
   quiz, every family side by side, and every exhibit, ready to play, with its placard open.
   Every page must load with no script error, nothing in the console's errors, no file that
   fails to load or that the policy blocks, and nothing sticking out past the side of the
   screen. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock, headersFor } from './mock-server.mjs';
import { ROOMS, EXHIBITS, GROUPS } from '../museum/data.js';
import { STOPS } from '../museum/tour.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const VISITORS = {
  computer: { viewport: { width: 1280, height: 800 } },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

let browser, mock;
before(async () => {
  mock = await startMock({ headers: true });
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
});
after(async () => {
  await browser.close();
  await mock.close();
});

/* Anything on the page that sticks out past the left or right of the screen, and is not inside
   something that scrolls or clips it on purpose (the walk through a room, a row of families);
   and any page-sized area that scrolls sideways (only a row is meant to). */
function sticksOut() {
  const W = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (/auto|scroll/.test(s.overflowX) && s.overflowY !== 'hidden' && el.clientHeight > innerHeight * 0.4
      && el.scrollWidth > el.clientWidth + 1 && !el.closest('[hidden], dialog:not([open])')) {
      out.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${String(el.className).trim().split(/\s+/).join('.')} scrolls sideways by ${el.scrollWidth - el.clientWidth} px`);
    }
  }
  const held = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (getComputedStyle(a).overflowX !== 'visible') return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg *, [hidden], dialog:not([open])')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    if ((r.right > W + 1 || r.left < -1) && !held(el)) {
      const name = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}`;
      out.push(`${name} runs from ${Math.round(r.left)} to ${Math.round(r.right)} px on a screen ${W} px wide`);
    }
  }
  return out.slice(0, 5);
}

/* One visitor's walk, start to finish. Gives everything that went wrong, and where. */
async function walk(who) {
  const ctx = await browser.newContext(VISITORS[who]);
  const page = await ctx.newPage();
  const problems = [];
  let where = 'the floor plan';
  const note = (what) => problems.push(`${who}, ${where}: ${what}`);
  await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => {
    console.error(`the security policy blocked ${e.blockedURI || 'an inline script or style'} (${e.violatedDirective})`);
  }));
  page.on('pageerror', (e) => note(`script error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') note(`console error: ${m.text()}`); });
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText || '';
    // a sound or a file the page let go of when the visitor moved on
    if (!/ERR_ABORTED/.test(why)) note(`${r.url().replace(mock.base, '')} failed to load (${why})`);
  });
  page.on('response', (r) => { if (r.status() >= 400) note(`${r.url().replace(mock.base, '')} answered ${r.status()}`); });
  const check = async () => {
    for (const p of await page.evaluate(sticksOut)) note(p);
  };
  // Go to a page, wait till it is ready, and look it over. A page that never gets ready is
  // noted, and the walk goes on to the next.
  const visit = async (hash, ready, arg, more) => {
    where = hash || 'the floor plan';
    try {
      if (hash != null) await page.evaluate((h) => { location.hash = h; }, hash);
      await page.waitForFunction(ready, arg, { timeout: 15000 });
      await check();
      await more?.();
    } catch (e) {
      note(`never got ready (${e.message.split('\n')[0]})`);
    }
  };
  try {
    const res = await page.goto(mock.base + '/museum/');
    assert.equal(res.headers()['content-security-policy'], headersFor('/museum/')['content-security-policy'], 'the museum is under the site’s security policy');
    const lobby = () => !document.getElementById('hall').hidden && document.querySelector('#plan svg') && document.querySelectorAll('#families a').length;
    await visit(null, lobby);

    for (const r of ROOMS) {
      await visit(`#room/${r.id}`, ([name, n]) => !document.getElementById('gallery').hidden
        && document.getElementById('gal-name').textContent === name && document.querySelectorAll('#track .bay').length === n,
      [r.name, EXHIBITS.filter((e) => e.room === r.id).length]);
    }
    for (let i = 1; i <= STOPS.length; i++) {
      await visit(`#tour/${i}`, (id) => !document.getElementById('gallery').hidden && !document.getElementById('docent').hidden
        && document.querySelector(`#track .bay[href="#${id}"]`), STOPS[i - 1].id);
    }
    await visit('#quiz', () => !document.getElementById('quiz').hidden && document.querySelector('#quiz-main .q'));
    for (const g of GROUPS) {
      await visit(`#compare/${g.id}`, ([name, n]) => !document.getElementById('compare').hidden
        && document.getElementById('cmp-name').textContent === name
        && document.querySelectorAll('#cmp-line a.mem').length === n && document.querySelector('#cmp-main .kgrid .kd svg'), [g.name, g.members.length]);
    }
    for (const ex of EXHIBITS) {
      await visit(`#${ex.id}`, ([id, name]) => location.hash === `#${id}` && document.getElementById('ex-name').textContent === name
        && !document.getElementById('stage').classList.contains('loading') && document.querySelector('#stage canvas'), [ex.id, ex.name], async () => {
        // its placard: the drawing (or photo), how it makes its sound, and the way to its family
        where = `#${ex.id}, its placard`;
        await page.click('#info', { timeout: 5000 });
        await page.waitForFunction((name) => document.getElementById('placard').open
          && document.getElementById('pl-name').textContent === name
          && document.querySelector('#pl-art svg, #pl-art img') && document.querySelector('#pl-more .how-art') && document.querySelector('#pl-more .pl-compare'), ex.name, { timeout: 5000 })
          .catch(() => note('did not open with its drawing, how it makes its sound and its family'));
        const card = await page.evaluate(() => {
          const c = document.querySelector('#placard .card');
          const r = c.getBoundingClientRect();
          return { wide: c.scrollWidth - c.clientWidth, left: r.left, right: r.right, W: document.documentElement.clientWidth };
        });
        if (card.wide > 1) note(`scrolls sideways by ${card.wide} px`);
        if (card.left < -1 || card.right > card.W + 1) note(`runs from ${Math.round(card.left)} to ${Math.round(card.right)} px on a screen ${card.W} px wide`);
        await check();
        if (await page.evaluate(() => document.getElementById('placard').open)) {
          await page.click('#placard-close', { timeout: 5000 });
          await page.waitForFunction(() => !document.getElementById('placard').open, null, { timeout: 5000 });
        }
      });
    }
    await visit('', lobby);
  } catch (e) {
    note(`stopped: ${e.message.split('\n')[0]}`);
  } finally {
    await ctx.close();
  }
  return problems;
}

test('every page and exhibit of the museum opens cleanly under the site’s security policy, on a computer and on a phone', async () => {
  const [computer, phone] = await Promise.all([walk('computer'), walk('phone')]);
  assert.deepEqual([...computer, ...phone], []);
});
