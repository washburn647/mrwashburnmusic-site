/* Song Burner in a real browser (Chromium, through Playwright), against mock-server.mjs. Covers
   what has broken before: saves lost during a sync, number-like titles, shared computers,
   failed saves, lyrics search, the dashboard feed, links, and text from a library showing as
   text. Every test starts in a fresh browser profile, signed in as t@example.com. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let browser, mock;
before(async () => {
  mock = await startMock();
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
  await mock.close();
});

const SEC = [{ type: 'verse', lines: [{ c: null, t: 'one two three four' }, { c: null, t: 'five six seven eight' }] },
  { type: 'chorus', lines: [{ c: null, t: 'la la la la' }] }];

/** A fresh profile on the app. signedIn: as the gate lets testers in. */
async function open({ signedIn = true } = {}) {
  mock.reset();
  const ctx = await browser.newContext();
  if (signedIn) {
    await ctx.addInitScript(() => {
      if (!sessionStorage.getItem('t-init')) {
        sessionStorage.setItem('t-init', '1');
        localStorage.setItem('sb-account', JSON.stringify({ email: 't@example.com', lastSync: 0 }));
      }
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(mock.base + '/songburner/');
  await page.waitForFunction(() => window.google && google.script && google.script.run);
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}

const call = (page, action, params) => page.evaluate(([action, params]) => new Promise((res) =>
  google.script.run
    .withSuccessHandler((o) => res(JSON.parse(o)))
    .withFailureHandler((e) => res({ ok: false, error: String((e && e.message) || e) }))
    .apiCall(JSON.stringify({ action, params }))), [action, params]);
const titles = async (page) => (await call(page, 'init', {})).data.songs.map((s) => s.title).sort();
const addSong = (page, title, extra = {}) => call(page, 'saveSong', { song: { title, artist: 'x', sections: SEC, listIds: [], ...extra } });
const sync = (page) => page.evaluate(() => SongBurnerHost.cloud.syncNow());

test('titles and artists that look like numbers stay text, and the filter works', async () => {
  const { ctx, page, errors } = await open({ signedIn: false });
  for (const [t, a] of [['1979', 'Smashing Pumpkins'], ['22', 'Taylor Swift'], ['Down', '311'], ['True', 'Band'], ['007', 'Bond']]) {
    await addSong(page, t, { artist: a });
  }
  const songs = (await call(page, 'init', {})).data.songs;
  for (const s of songs) {
    assert.equal(typeof s.title, 'string');
    assert.equal(typeof s.artist, 'string');
  }
  assert.deepEqual(songs.map((s) => s.title).sort(), ['007', '1979', '22', 'Down', 'True']);
  await page.reload();
  await page.waitForTimeout(800);
  await page.getByText('Pantry', { exact: true }).last().click();
  await page.locator('input').first().fill('s');
  await page.waitForTimeout(300);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('no save is lost while syncs run alongside', async () => {
  const { ctx, page } = await open();
  mock.state.delay = 15;
  const N = 40;
  await page.evaluate(async ([SEC, N]) => {
    const call = (a, params) => new Promise((res) => google.script.run.withSuccessHandler(res).apiCall(JSON.stringify({ action: a, params })));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < N; i++) {
      const s = SongBurnerHost.cloud.syncNow().catch(() => {});
      await wait(10 + Math.random() * 45);
      await call('saveSong', { song: { title: 'S' + i, artist: 'x', sections: SEC, listIds: [] } });
      await s;
    }
    await SongBurnerHost.cloud.syncNow();
  }, [SEC, N]);
  // a backup taken while a save lands keeps it too
  await page.evaluate(async (SEC) => {
    const b = SongBurnerHost.exportBackup();
    await new Promise((res) => google.script.run.withSuccessHandler(res).apiCall(JSON.stringify({ action: 'saveSong', params: { song: { title: 'During backup', artist: 'x', sections: SEC, listIds: [] } } })));
    await b;
  }, SEC);
  mock.state.delay = 0;
  await sync(page);
  await page.reload();
  await page.waitForTimeout(800);
  const have = await titles(page);
  const want = [...Array(N).keys()].map((i) => 'S' + i).concat('During backup');
  assert.deepEqual(want.filter((t) => !have.includes(t)), [], 'missing on the device');
  assert.deepEqual(want.filter((t) => !mock.cloudSongs().includes(t)), [], 'missing in the cloud');
  await ctx.close();
});

test('a shared computer: the next student gets their own songs, never the last one\'s', async () => {
  const { ctx, page } = await open({ signedIn: false });
  const signIn = async (email) => {
    mock.state.who = email;
    await page.evaluate(() => localStorage.setItem('sb-account-signin', '1'));
    await page.goto(mock.base + '/songburner/');
    await page.waitForTimeout(2000);
  };
  await signIn('a@x.org');
  await addSong(page, 'A song');
  await sync(page);
  await addSong(page, 'A last-minute song');
  await page.evaluate(() => SongBurnerHost.cloud.signOut(false));
  await page.waitForTimeout(1200);
  assert.deepEqual(mock.cloudSongs('a@x.org'), ['A last-minute song', 'A song'], 'sign out syncs first');
  await signIn('b@x.org');
  assert.deepEqual(await titles(page), []);
  assert.deepEqual(mock.cloudSongs('b@x.org'), []);
  await addSong(page, 'B song');
  await sync(page);
  await page.evaluate(() => SongBurnerHost.cloud.signOut(false));
  await page.waitForTimeout(1200);
  await signIn('a@x.org');
  assert.deepEqual(await titles(page), ['A last-minute song', 'A song']);
  assert.deepEqual(mock.cloudSongs('b@x.org'), ['B song']);
  const roles = (await call(page, 'init', {})).data.lists.map((l) => l.role).filter(Boolean).sort();
  assert.deepEqual(roles, ['back', 'front'], 'one Front and one Back Burner');
  await ctx.close();
});

test('a save the device refuses can be sent again, and is kept once', async () => {
  const { ctx, page } = await open({ signedIn: false });
  const id = (await addSong(page, 'Song')).data.id;
  const out = await page.evaluate(async (songId) => {
    const call = (a, params) => new Promise((res) => google.script.run
      .withSuccessHandler((o) => res(JSON.parse(o))).withFailureHandler((e) => res({ ok: false, error: String(e) }))
      .apiCall(JSON.stringify({ action: a, params })));
    const put = IDBObjectStore.prototype.put;
    let once = true;
    IDBObjectStore.prototype.put = function (v, k) {
      if (once && k === 'Attempts') { once = false; throw new DOMException('full', 'QuotaExceededError'); }
      return put.apply(this, arguments);
    };
    const a = { id: 'fixed-run-id1', songId, date: Date.now(), accuracy: 90, totalWords: 9, correctWords: 8,
      mode: 'medium', seconds: 10, device: 'desktop', detail: {}, heat: [] };
    const first = await call('saveAttempt', { attempt: a });
    const second = await call('saveAttempt', { attempt: a });
    IDBObjectStore.prototype.put = put;
    return { first: first.ok !== false, second: second.ok };
  }, id);
  assert.deepEqual(out, { first: false, second: true });
  await page.reload();
  await page.waitForTimeout(800);
  const backup = await page.evaluate(() => SongBurnerHost.exportBackup());
  assert.equal(backup.tabs.Attempts.slice(1).filter((r) => String(r[0]) === 'fixed-run-id1').length, 1);
  await ctx.close();
});

test('lyrics search waits without freezing the page, and only for signed-in testers', async () => {
  const { ctx, page } = await open();
  const asked = [];
  await ctx.route('https://lrclib.net/**', async (route) => {
    asked.push(new URL(route.request().url()).pathname);
    await new Promise((r) => setTimeout(r, 700));
    if (route.request().url().includes('/api/get')) return route.fulfill({ status: 404, body: '{}' });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify([{ trackName: 'Song', artistName: 'Band', plainLyrics: 'line one\nline two\n\nline three\nline four' }]) });
  });
  await ctx.route('https://api.lyrics.ovh/**', (route) => { asked.push('ovh'); return route.fulfill({ status: 404, body: '{}' }); });
  const r = await page.evaluate(async (SEC) => {
    const call = (a, params) => new Promise((res) => google.script.run.withSuccessHandler((o) => res(JSON.parse(o))).apiCall(JSON.stringify({ action: a, params })));
    let ticks = 0;
    const iv = setInterval(() => ticks++, 50);
    const search = call('fetchLyrics', { title: 'Song', artist: 'Band' });
    await new Promise((r) => setTimeout(r, 100));
    const t = performance.now();
    await call('saveSong', { song: { title: 'Saved during search', artist: 'x', sections: SEC, listIds: [] } });
    const saveMs = performance.now() - t;
    const found = await search;
    clearInterval(iv);
    return { ok: found.ok, sections: found.ok && found.data.sections.length, ticks, saveMs };
  }, SEC);
  assert.equal(r.ok, true);
  assert.equal(r.sections, 2);
  assert.ok(r.ticks > 15, 'the page kept running: ' + r.ticks);
  assert.ok(r.saveMs < 500, 'a save did not wait for the search: ' + r.saveMs);
  assert.deepEqual(asked, ['/api/get', '/api/search'], 'one lookup at a time, none after a hit');
  await page.getByText('Add', { exact: true }).last().click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#findLyrics').isVisible(), true);
  await ctx.close();

  const out = await open({ signedIn: false });
  await out.page.getByText('Add', { exact: true }).last().click();
  await out.page.waitForTimeout(400);
  for (const id of ['#findLyrics', '#ytFind', '#spFind']) assert.equal(await out.page.locator(id).isVisible(), false, id);
  const blocked = await call(out.page, 'fetchLyrics', { title: 'Song', artist: 'Band' });
  assert.equal(blocked.ok, false);
  await out.ctx.close();
});

test('song titles go to the dashboard feed only when it is on', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { localStorage.removeItem('sb-dash-off'); localStorage.removeItem('sb-dash-on'); });
  await addSong(page, 'Dash');
  let from = mock.state.log.length;
  await sync(page);
  await page.waitForTimeout(500);
  let dash = mock.state.log.slice(from).filter((l) => l.p.endsWith('/dashboard'));
  assert.deepEqual(dash.map((l) => [l.probe, l.n]), [['1', 2]]);
  mock.state.dashOn = true;
  await page.evaluate(() => localStorage.removeItem('sb-dash-off'));
  await addSong(page, 'Dash 2');
  from = mock.state.log.length;
  await sync(page);
  await page.waitForTimeout(500);
  dash = mock.state.log.slice(from).filter((l) => l.p.endsWith('/dashboard'));
  assert.equal(dash.length, 2);
  assert.ok(dash[1].n > 20 && dash[1].probe === '');
  await ctx.close();
});

test('two open tabs settle down after a change (no sync loop)', async () => {
  const { ctx, page } = await open();
  await page.waitForTimeout(1000);
  const p2 = await ctx.newPage();
  await p2.goto(mock.base + '/songburner/');
  await p2.waitForTimeout(1500);
  await addSong(page, 'One change');
  await page.waitForTimeout(17000);           // the quiet-time sync fires at 15 s
  const from = mock.state.log.length;
  await page.waitForTimeout(8000);
  const late = mock.state.log.slice(from).filter((l) => l.p.startsWith('/api/songburner/'));
  assert.deepEqual(late, []);
  await ctx.close();
});

test('text from a library shows as text, and only web addresses become links', async () => {
  const { ctx, page, errors } = await open({ signedIn: false });
  const X = (n) => '<b class="inj">' + n + '</b>"\'';
  const lists = (await call(page, 'init', {})).data.lists;
  const front = lists.find((l) => l.role === 'front');
  const list = (await call(page, 'createList', { name: 'List ' + X('list') })).data;
  const sec = [{ type: 'verse', lines: [{ c: 'G' + X('chord'), t: 'one ' + X('lyric') + ' two' }] }, ...SEC];
  await addSong(page, 'Title ' + X('t'), { artist: 'Artist ' + X('a'), meta: ['Key ' + X('m')], sections: sec,
    listIds: [front.id, list.id], youtube: 'javascript:alert(1)', spotify: 'https://open.spotify.com/track/1' });
  await page.reload();
  await page.waitForTimeout(800);
  for (const tab of ['Front', 'Back', 'Pantry', 'Insights']) {
    await page.getByText(tab, { exact: true }).last().click();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.inj').count(), 0, tab);
  }
  await page.getByText('Pantry', { exact: true }).last().click();
  await page.getByText('Title ', { exact: false }).first().click();
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.inj').count(), 0, 'song page');
  const links = await page.locator('.link-chip').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  assert.deepEqual(links, ['https://open.spotify.com/track/1']);
  assert.deepEqual(errors, []);
  await ctx.close();
});
