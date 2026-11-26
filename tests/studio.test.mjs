/* The studio's hub and sections (studio/sections.js, hub.js, nav.js): every tool folder is in a
   section and every section's tool has a page with the section bar; in Chromium, with the
   site's headers, the hub shows each section and a tool's bar marks where you are. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { SECTIONS, toolHref } = await import('../studio/sections.js');
const ROOT = new URL('../studio/', import.meta.url);

const tools = SECTIONS.flatMap((s) => s.tools);
const folders = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(new URL(`${d.name}/index.html`, ROOT))).map((d) => d.name);

test('every studio tool is in one section, and its page loads the section bar', () => {
  assert.deepEqual(tools.map((t) => t.id).sort(), folders.sort());
  assert.equal(new Set(tools.map((t) => t.id)).size, tools.length);
  for (const t of tools) {
    const html = fs.readFileSync(new URL(`${t.id}/index.html`, ROOT), 'utf8');
    assert.match(html, /<script type="module" src="\.\.\/nav\.js"><\/script>/, t.id);
    assert.match(html, /href="\.\.\/tools\.css"/, t.id);
    // The bar is the way back: no tool draws its own link to the hub.
    for (const f of fs.readdirSync(new URL(`${t.id}/`, ROOT)).filter((x) => x.endsWith('.js'))) {
      assert.doesNotMatch(fs.readFileSync(new URL(`${t.id}/${f}`, ROOT), 'utf8'), /href: '\/studio\/'/, `${t.id}/${f}`);
    }
    assert.ok(t.name && t.icon, t.id);
  }
  for (const s of SECTIONS) assert.ok(s.id && s.name && /^#[0-9A-F]{6}$/i.test(s.tint) && s.tools.length, s.id);
});

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

test('the hub shows each section with its apps first, then its tools', async () => {
  await page.goto(mock.base + '/studio/#website');
  await page.waitForSelector('.sec');
  assert.deepEqual(await page.locator('.sec h2').allInnerTexts(), SECTIONS.map((s) => s.name));
  for (const s of SECTIONS) {
    const hrefs = await page.locator(`#${s.id} a`).evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    assert.deepEqual(hrefs, [...(s.apps || []).map((a) => a.href), ...s.tools.map(toolHref)]);
  }
  // On a phone the sections stack, and a link to one opens on it.
  assert.ok(await page.evaluate(() => scrollY > 0));
  assert.equal(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors.splice(0), []);
});

test("a tool's bar: the hub, its section, the section's tools with this one marked, its apps", async () => {
  await page.goto(mock.base + '/studio/shop/');
  await page.waitForSelector('.studio-nav');
  assert.equal(await page.locator('.studio-nav .sn-home').getAttribute('href'), '/studio/');
  assert.equal(await page.locator('.studio-nav .sn-sec').innerText(), 'Musician Maker');
  assert.equal(await page.locator('.studio-nav .sn-sec').getAttribute('href'), '/studio/#musician-maker');
  assert.deepEqual(await page.locator('.studio-nav .sn-tools a').evaluateAll((els) => els.map((a) => a.textContent)), ['🎮Game workshop', '🥁Groove Lab', '🛍️Avatar shop']);
  assert.equal(await page.locator('.studio-nav [aria-current="page"]').textContent(), '🛍️Avatar shop');
  assert.equal(await page.locator('.studio-nav .sn-apps a').getAttribute('href'), '/musician-maker/');
  // It stays when the tool redraws its page.
  await page.waitForSelector('.it-row');
  await page.click('nav.tabs button[data-k="tab:hat"]');
  assert.equal(await page.locator('.studio-nav').count(), 1);
  assert.deepEqual(errors.splice(0), []);
});
