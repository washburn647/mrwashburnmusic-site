/* The Instrument Museum's placards (museum/placard.js): how each instrument makes its sound
   (how.js), the photo and the real piece when the museum has them (media.js), and the way to
   its family side by side (compare.js); and the hall every note is played in (audio.js), the
   made-up one and a recorded one. In Node, and in Chromium under the site's real headers. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';
import { EXHIBITS, GROUPS, byId } from '../museum/data.js';
import { BOX } from '../museum/art.js';
import { KINDS, HOW, diagram } from '../museum/how.js';
import * as media from '../museum/media.js';
import * as notes from '../museum/notes.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let browser, mock;
const contexts = [];
before(async () => {
  mock = await startMock({ headers: true });
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
});
after(async () => {
  for (const c of contexts) await c.close().catch(() => {});
  await browser.close();
  await mock.close();
});

/* ---------- test files ---------- */

/* A WAV file: fill(t, channel) gives each sample, -1 to 1. */
function wav(seconds, fill, { channels = 1, rate = 22050 } = {}) {
  const n = Math.floor(seconds * rate);
  const b = Buffer.alloc(44 + n * channels * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * channels * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * channels * 2, 28);
  b.writeUInt16LE(channels * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * channels * 2, 40);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < channels; c++) b.writeInt16LE(Math.round(32767 * Math.max(-1, Math.min(1, fill(i / rate, c)))), 44 + (i * channels + c) * 2);
  }
  return b;
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const TONE = wav(2, (t) => 0.3 * Math.sin(2 * Math.PI * 440 * t));
let seed = 7;
const noise = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
const ECHO = wav(0.6, (t) => noise() * Math.exp(-t * 8), { channels: 2, rate: 44100 });

/* museum/media.js as it would be with these photos, pieces and hall. */
const mediaJs = ({ photos = {}, pieces = {}, hall = null }) => `export const PHOTOS = ${JSON.stringify(photos)};
export const PIECES = ${JSON.stringify(pieces)};
export const HALL = ${JSON.stringify(hall)};
export const url = (file) => new URL(\`media/\${file}\`, import.meta.url).href;`;

const VIOLIN_PHOTO = { file: 'test-violin.png', alt: 'A violin lying on a blue cloth', by: 'A. Photographer', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Test_violin.jpg' };
const VIOLIN_PIECE = { file: 'test-piece.wav', title: 'Test Piece in A', composer: 'A. Composer', played: 'A. Violinist', by: 'A. Recordist', license: 'CC BY 4.0', source: 'https://example.org/test-piece' };

/* What the page starts sounds with: every AudioBufferSourceNode started (when, and the
   context's time then), and every <audio> played. */
function spies() {
  window.museumStarts = [];
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when = 0, ...rest) {
    window.museumStarts.push({ when, now: this.context.currentTime });
    return start.call(this, when, ...rest);
  };
  window.museumMedia = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (!window.museumMedia.includes(this)) window.museumMedia.push(this);
    return play.call(this);
  };
}

/* A new visit (a tab with a history of its own), at this address, with this media.js and these
   files in museum/media/. */
async function visit(hash = '', { media: m = null, files = {}, reduced = false, phone = false } = {}) {
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  contexts.push(ctx);
  if (m) await ctx.route('**/museum/media.js', (r) => r.fulfill({ contentType: 'text/javascript', body: mediaJs(m) }));
  for (const [name, f] of Object.entries(files)) await ctx.route(`**/museum/media/${name}`, (r) => r.fulfill({ status: f.status || 200, contentType: f.type, body: f.body }));
  await ctx.addInitScript(spies);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${mock.base}/museum/${hash}`);
  return { page, errors };
}
async function readyAt(page, id) {
  await page.waitForFunction(([id, name]) => location.hash === `#${id}` && document.getElementById('ex-name').textContent === name
    && !document.getElementById('stage').classList.contains('loading') && document.querySelector('#stage canvas'), [id, byId[id].name], { timeout: 15000 });
}
async function comparing(page, id) {
  const g = GROUPS.find((x) => x.id === id);
  await page.waitForFunction(([id, name, n]) => location.hash === `#compare/${id}` && !document.getElementById('compare').hidden
    && document.getElementById('cmp-name').textContent === name && document.querySelectorAll('#cmp-line a.mem').length === n, [id, g.name, g.members.length]);
}
async function placard(page) {
  await page.click('#info');
  await page.waitForFunction(() => document.getElementById('placard').open && document.querySelector('#pl-more .how-art'));
}

/* ---------- how each instrument makes its sound ---------- */

test('every exhibit has a way of making its sound, told in steps, and a note of its own', () => {
  assert.deepEqual(Object.keys(HOW).sort(), EXHIBITS.map((e) => e.id).sort());
  for (const [id, [kind, note]] of Object.entries(HOW)) {
    assert.ok(KINDS[kind], `${id}: there is no way of making sound called ${kind}`);
    assert.ok(note.length > 30 && /[.!]$/.test(note), `${id}: its note should be a sentence or two`);
  }
  for (const [kind, k] of Object.entries(KINDS)) {
    assert.ok(k.name && k.steps.length >= 2 && k.steps.every((s) => /[.!]$/.test(s)), `${kind}: a name and steps`);
    assert.ok(Object.values(HOW).some(([x]) => x === kind), `no exhibit makes its sound by ${kind}`);
  }
});

test('each diagram’s parts move round on one clock, loop without a jump, and keep still when asked', () => {
  const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  // a path's shape: its commands, with every number a #
  const form = (d) => d.replace(/-?(\d+\.?\d*|\.\d+)(e-?\d+)?/g, '#').replace(/[\s,]+/g, '');
  const others = new Set();
  for (const kind of Object.keys(KINDS)) {
    const svg = diagram(kind);
    assert.match(svg, new RegExp(`^<svg class="how-art kind-${kind}" viewBox="0 0 240 140" aria-hidden="true">`));
    const anims = [...svg.matchAll(/<(animate|animateTransform)\b([^>]*)\/>/g)].map((m) => ({ tag: m[1], at: m.index, ...attrs(m[2]) }));
    assert.ok(anims.length >= 4, `${kind}: it hardly moves`);
    // the flowing air and signal (a dash pattern sliding along) may run at their own speed;
    // everything else repeats in step with the slowest part, so the parts keep time
    const flows = anims.filter((a) => a.attributeName === 'stroke-dashoffset');
    const beats = anims.filter((a) => a.attributeName !== 'stroke-dashoffset').map((a) => parseFloat(a.dur));
    const cycle = Math.max(...beats);
    for (const d of beats) assert.ok(Math.abs(cycle / d - Math.round(cycle / d)) < 1e-6, `${kind}: a part repeats every ${d} s, out of step with the ${cycle} s cycle`);
    for (const a of anims) {
      const what = `${kind}: its ${a.attributeName}${a.type ? ` ${a.type}` : ''}`;
      assert.equal(a.repeatCount, 'indefinite', what);
      const kt = a.keyTimes.split(';').map(Number);
      const vs = a.values.split(';');
      assert.equal(kt.length, vs.length, `${what} has ${kt.length} times for ${vs.length} values`);
      assert.ok(kt[0] === 0 && kt[kt.length - 1] === 1 && kt.every((t, i) => !i || t >= kt[i - 1]), `${what}: its times should run from 0 to 1`);
      if (a.calcMode === 'spline') assert.equal(a.keySplines.split(';').length, kt.length - 1, `${what}: one easing for each step`);
      if (a.attributeName === 'd') assert.equal(new Set(vs.map(form)).size, 1, `${what}: every shape it moves through needs the same points, or it jumps`);
      if (a.tag === 'animateTransform') assert.equal(new Set(vs.map((v) => v.trim().split(/[\s,]+/).length)).size, 1, `${what}: the same numbers each step`);
    }
    for (const a of flows) {
      // a dash pattern slid by exactly its own length loops without a jump
      const owner = svg.slice(0, a.at).match(/stroke-dasharray="([^"]+)"[^<]*>$/);
      assert.ok(owner, `${kind}: a flow with no dashes`);
      const period = owner[1].split(/[\s,]+/).reduce((s, x) => s + Number(x), 0);
      const [v0, v1] = a.values.split(';').map(Number);
      assert.equal(Math.abs(v0 - v1), period, `${kind}: the dashes slide ${Math.abs(v0 - v1)}, not their length ${period}`);
    }
    // a drawing's own gradients: each found, and no id shared with another drawing on the page
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    for (const r of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(r[1]), `${kind}: url(#${r[1]}) is not in the drawing`);
    for (const i of ids) {
      assert.ok(!others.has(i), `${kind}: id ${i} is used twice on a page`);
      others.add(i);
    }
    const still = diagram(kind, { still: true });
    assert.ok(!/<animate/.test(still), `${kind}: it moves for a visitor who asked for less motion`);
    assert.ok(still.length > 400, `${kind}: drawn still, it is empty`);
  }
});

test('the diagrams really move in the browser, and keep still for a visitor who asks for less motion', async () => {
  const { page, errors } = await visit('#violin');
  await readyAt(page, 'violin');
  const moves = await page.evaluate(async () => {
    const { KINDS, diagram } = await import('/museum/how.js');
    const out = {};
    for (const kind of Object.keys(KINDS)) {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;left:0;top:0;width:480px;z-index:99';
      div.innerHTML = diagram(kind);
      document.body.append(div);
      const svg = div.firstElementChild;
      svg.pauseAnimations();
      // each painted shape: where it is, and how much of it shows
      const shapes = [...svg.querySelectorAll('path, rect, circle, ellipse, line, polygon, polyline')].filter((el) => !el.closest('defs'));
      const look = async (t) => {
        svg.setCurrentTime(t);
        await new Promise((ok) => requestAnimationFrame(ok));
        return shapes.map((el) => {
          const r = el.getBoundingClientRect();
          let shows = 1;
          for (let e = el; e && e !== svg; e = e.parentElement) shows *= Number(getComputedStyle(e).opacity);
          const cs = getComputedStyle(el);
          shows *= Math.max(cs.fill === 'none' ? 0 : Number(cs.fillOpacity), cs.stroke === 'none' ? 0 : Number(cs.strokeOpacity));
          return [r.x, r.y, r.width, r.height, shows];
        });
      };
      const seen = new Set();
      for (const t of [0.05, 0.3, 0.55, 0.8, 1.05, 1.5, 2.0, 2.6]) seen.add((await look(t)).map((v) => v.map((x) => x.toFixed(1)).join(',')).join(' '));
      // at the end of the cycle, everything is where the next one starts: no jump
      const cycle = Math.max(...[...svg.querySelectorAll('animate, animateTransform')].filter((a) => a.getAttribute('attributeName') !== 'stroke-dashoffset').map((a) => parseFloat(a.getAttribute('dur'))));
      const [end, start] = [await look(cycle - 0.001), await look(cycle + 0.001)];
      const jumps = [];
      end.forEach((e, i) => {
        const s = start[i];
        if (e[4] < 0.03 && s[4] < 0.03) return;
        if (Math.abs(e[4] - s[4]) > 0.1 || e.slice(0, 4).some((v, j) => Math.abs(v - s[j]) > 1)) jumps.push(`${shapes[i].tagName} ${e.map((x) => x.toFixed(1))} → ${s.map((x) => x.toFixed(1))}`);
      });
      out[kind] = { looks: seen.size, jumps };
      div.remove();
    }
    return out;
  });
  for (const [kind, { looks, jumps }] of Object.entries(moves)) {
    assert.ok(looks >= 3, `${kind}: drawn the same at ${8 - looks + 1} of 8 moments`);
    assert.deepEqual(jumps, [], `${kind}: parts jump as the cycle starts again`);
  }
  await placard(page);
  assert.ok(await page.evaluate(() => document.querySelectorAll('#pl-more .how-art animate, #pl-more .how-art animateTransform').length) > 4);
  assert.deepEqual(errors, []);

  const calm = await visit('#violin', { reduced: true });
  await readyAt(calm.page, 'violin');
  await placard(calm.page);
  assert.equal(await calm.page.evaluate(() => document.querySelectorAll('#pl-more .how-art animate, #pl-more .how-art animateTransform').length), 0);
  await calm.page.evaluate(() => { location.hash = 'compare/brass'; });
  await comparing(calm.page, 'brass');
  assert.equal(await calm.page.evaluate(() => document.querySelectorAll('#cmp-main .kd svg').length), 1);
  assert.equal(await calm.page.evaluate(() => document.querySelectorAll('#cmp-main animate, #cmp-main animateTransform').length), 0);
  assert.deepEqual(calm.errors, []);
});

/* ---------- the placard ---------- */

test('a placard shows the photo and plays the real piece when the museum has them, each credited and linked', async () => {
  const { page, errors } = await visit('#violin', {
    media: { photos: { violin: VIOLIN_PHOTO }, pieces: { violin: VIOLIN_PIECE } },
    files: { 'test-violin.png': { type: 'image/png', body: PNG }, 'test-piece.wav': { type: 'audio/wav', body: TONE } },
  });
  await readyAt(page, 'violin');
  await placard(page);
  await page.waitForFunction(() => document.querySelector('#pl-art img')?.complete);
  const shown = await page.evaluate(() => {
    const img = document.querySelector('#pl-art img');
    const a = (sel) => { const l = document.querySelector(sel); return l && { text: l.closest('p, figcaption').textContent, href: l.href, target: l.target, rel: l.rel }; };
    return {
      photo: document.getElementById('pl-art').classList.contains('photo'),
      drawing: !!document.querySelector('#pl-art > svg'),
      src: img.getAttribute('src'), alt: img.alt, loaded: img.naturalWidth > 0,
      photoCredit: a('#pl-art figcaption a'),
      heading: document.querySelector('.pl-piece h3').textContent,
      meta: [...document.querySelectorAll('.pl-piece .meta > b, .pl-piece .meta > span, .pl-piece .meta > small:not(.t)')].map((e) => e.textContent),
      pieceCredit: a('.pl-piece .credit a'),
      button: document.getElementById('pl-play').getAttribute('aria-label'),
      order: [...document.getElementById('pl-more').children].map((e) => e.className),
    };
  });
  assert.equal(shown.photo, true);
  assert.equal(shown.drawing, false);
  assert.match(shown.src, /\/museum\/media\/test-violin\.png$/);
  assert.equal(shown.alt, VIOLIN_PHOTO.alt);
  assert.equal(shown.loaded, true);
  assert.deepEqual(shown.photoCredit, { text: 'Photo: A. Photographer, CC BY-SA 4.0', href: VIOLIN_PHOTO.source, target: '_blank', rel: 'noopener' });
  assert.equal(shown.heading, 'Hear it in a real piece');
  assert.deepEqual(shown.meta, ['Test Piece in A', 'A. Composer', 'Played by A. Violinist']);
  assert.deepEqual(shown.pieceCredit, { text: 'Recording: A. Recordist, CC BY 4.0', href: VIOLIN_PIECE.source, target: '_blank', rel: 'noopener' });
  assert.equal(shown.button, 'Play Test Piece in A');
  // the piece first, then how it makes its sound, then its family
  assert.deepEqual(shown.order, ['pl-piece', 'pl-how', 'pl-compare']);

  // it plays, shows how far it has got, pauses, and stops when the placard closes
  await page.click('#pl-play');
  await page.waitForFunction(() => document.getElementById('pl-play').getAttribute('aria-label') === 'Pause Test Piece in A');
  await page.waitForFunction(() => /^0:0\d \/ 0:02$/.test(document.getElementById('pl-time').textContent) && parseFloat(document.getElementById('pl-bar').style.width) > 0);
  await page.click('#pl-play');
  await page.waitForFunction(() => document.getElementById('pl-play').getAttribute('aria-label') === 'Play Test Piece in A');
  await page.click('#pl-play');
  await page.waitForFunction(() => window.museumMedia.some((a) => !a.paused));
  await page.click('#placard-close');
  await page.waitForFunction(() => !document.getElementById('placard').open);
  assert.ok(await page.evaluate(() => window.museumMedia.length > 0 && window.museumMedia.every((a) => a.paused && !a.getAttribute('src'))), 'the piece plays on after the placard is closed');
  await page.waitForFunction(() => document.getElementById('pl-more').innerHTML === '');

  // closed with Escape, too
  await placard(page);
  await page.click('#pl-play');
  await page.waitForFunction(() => window.museumMedia.some((a) => !a.paused));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('placard').open && document.getElementById('pl-more').innerHTML === '');
  assert.ok(await page.evaluate(() => window.museumMedia.every((a) => a.paused)), 'the piece plays on after Escape');

  // an instrument with neither keeps its drawing, and has no player
  await page.evaluate(() => { location.hash = 'cello'; });
  await readyAt(page, 'cello');
  await placard(page);
  assert.deepEqual(await page.evaluate(() => ({
    photo: document.getElementById('pl-art').classList.contains('photo'),
    drawing: !!document.querySelector('#pl-art > svg'),
    img: !!document.querySelector('#pl-art img'),
    piece: !!document.querySelector('.pl-piece'),
  })), { photo: false, drawing: true, img: false, piece: false });
  assert.deepEqual(errors, []);
});

test('a placard tells its family in a sentence and leads to it', async () => {
  const { page, errors } = await visit('#horn');
  await readyAt(page, 'horn');
  await placard(page);
  const link = await page.evaluate(() => {
    const a = document.querySelector('.pl-compare');
    return { href: a.getAttribute('href'), b: a.querySelector('b').textContent, small: a.querySelector('small').textContent, pics: a.querySelectorAll('.mini svg .fig').length };
  });
  assert.deepEqual(link, { href: '#compare/brass', b: 'Compare: Brass', small: 'Trumpet, French horn, trombone and tuba, side by side', pics: 4 });
  assert.equal(await page.evaluate(() => document.querySelector('#pl-more .pl-how .kind').textContent), KINDS[HOW.horn[0]].name);
  assert.deepEqual(errors, []);
});

/* ---------- Compare ---------- */

test('every exhibit belongs to exactly one family', () => {
  const all = GROUPS.flatMap((g) => g.members);
  assert.deepEqual([...all].sort(), EXHIBITS.map((e) => e.id).sort());
  assert.equal(new Set(GROUPS.map((g) => g.id)).size, GROUPS.length);
  for (const g of GROUPS) assert.ok(g.members.length >= 2 && g.name && g.short && g.about, g.id);
});

/* Where everything is in the row of a family, in the row's own units (its pixels): the floor,
   the ten-year-old, and each instrument's drawing, its place and its words. */
function measureLine() {
  const svg = document.querySelector('#cmp-line svg');
  const o = svg.getBoundingClientRect();
  const rel = (q) => ({ l: q.left - o.left, r: q.right - o.left });
  const kid = svg.querySelector('g.kid > g');
  const m = kid.transform.baseVal.consolidate().matrix;
  const kb = kid.getBBox();
  return {
    floor: +svg.querySelector(':scope > rect').getAttribute('y'),
    kid: { perCm: m.a, b: m.f + (kb.y + kb.height) * m.d },
    members: [...svg.querySelectorAll('a.mem')].map((a) => {
      const fig = a.querySelector('.fig > svg');
      const ring = a.querySelector('rect.ring');
      return {
        id: a.dataset.id,
        x: +fig.getAttribute('x'), y: +fig.getAttribute('y'), s: +fig.getAttribute('width'),
        ring: { l: +ring.getAttribute('x'), r: +ring.getAttribute('x') + +ring.getAttribute('width') },
        words: [...a.querySelectorAll('text.nm, text.sz')].map((t) => ({ text: t.textContent, ...rel(t.getBoundingClientRect()) })),
      };
    }),
  };
}

for (const phone of [false, true]) {
  test(`Compare stands each family on one floor at their real sizes, next to a ten-year-old, with nothing overlapping (${phone ? 'phone' : 'computer'})`, async () => {
    const { page, errors } = await visit('#compare/violins', { phone });
    for (const g of GROUPS) {
      await page.evaluate((id) => { location.hash = `compare/${id}`; }, g.id);
      await comparing(page, g.id);
      const L = await page.evaluate(measureLine);
      assert.deepEqual(L.members.map((m) => m.id), g.members, `${g.id}: in the family’s order`);
      assert.ok(Math.abs(L.kid.b - L.floor) <= 0.6, `${g.id}: the ten-year-old stands ${(L.floor - L.kid.b).toFixed(1)} px off the floor`);
      let least = Infinity;
      for (const m of L.members) {
        // what is painted of the drawing (its BOX, which museum.test.mjs checks against the paint)
        const [x0, y0, x1, y1, cm] = BOX[m.id];
        const u = m.s / 120;
        const art = { l: m.x + x0 * u, r: m.x + x1 * u, t: m.y + y0 * u, b: m.y + y1 * u };
        const perCm = Math.max(x1 - x0, y1 - y0) * u / cm;
        assert.ok(Math.abs(perCm / L.kid.perCm - 1) < 0.015, `${g.id}: the ${m.id} is drawn at ${perCm.toFixed(3)} px a centimetre, the ten-year-old at ${L.kid.perCm.toFixed(3)}`);
        assert.ok(Math.abs(art.b - L.floor) <= 0.6, `${g.id}: the ${m.id} stands ${(L.floor - art.b).toFixed(1)} px off the floor`);
        assert.ok(art.l >= m.ring.l - 0.2 && art.r <= m.ring.r + 0.2, `${g.id}: the ${m.id} is drawn outside its place`);
        for (const w of m.words) assert.ok(w.l >= m.ring.l - 1 && w.r <= m.ring.r + 1, `${g.id}: “${w.text}” runs out of the ${m.id}’s place`);
        least = Math.min(least, Math.max(art.r - art.l, art.b - art.t));
      }
      const rings = L.members.map((m) => m.ring).sort((p, q) => p.l - q.l);
      for (let i = 1; i < rings.length; i++) assert.ok(rings[i - 1].r <= rings[i].l + 0.5, `${g.id}: two instruments’ places overlap`);
      assert.ok(least >= 16, `${g.id}: the smallest is only ${least.toFixed(1)} px, too small to see`);
    }
    assert.deepEqual(errors, []);
  });
}

test('Compare lays each range along a piano’s keys, and tapping one plays its lowest note, then its highest', async () => {
  const { page, errors } = await visit('#compare/violins');
  for (const g of GROUPS.filter((x) => x.members.some((m) => byId[m].range))) {
    await page.evaluate((id) => { location.hash = `compare/${id}`; }, g.id);
    await comparing(page, g.id);
    const want = Object.fromEntries(g.members.filter((m) => byId[m].range).map((m) => [m, byId[m].range]));
    const rows = await page.evaluate((want) => {
      const key = (m) => document.querySelector(`#cmp-main .rg-kb rect[data-m="${m}"]`).getBoundingClientRect();
      const c = key(60);
      return {
        rows: [...document.querySelectorAll('#cmp-main .rg-row')].map((row) => {
          const r = row.querySelector('.rng').getBoundingClientRect();
          const [lo, hi] = want[row.dataset.id];
          return { id: row.dataset.id, label: row.getAttribute('aria-label'), dl: r.left - key(lo).left, dr: r.right - key(hi).right };
        }),
        mc: (() => { const r = document.querySelector('#cmp-main .mc').getBoundingClientRect(); return r.left + r.width / 2 - (c.left + c.width / 2); })(),
        line: (() => { const r = document.querySelector('#cmp-main .mc-line').getBoundingClientRect(); return r.left + r.width / 2 - (c.left + c.width / 2); })(),
      };
    }, want);
    assert.deepEqual(rows.rows.map((r) => r.id), Object.keys(want));
    for (const r of rows.rows) {
      const ex = byId[r.id];
      assert.equal(r.label, `${ex.name}: ${notes.full(ex.range[0], ex.flats)} to ${notes.full(ex.range[1], ex.flats)}. Hear its lowest and highest notes`);
      assert.ok(Math.abs(r.dl) <= 1 && Math.abs(r.dr) <= 1, `${g.id}: the ${r.id}’s bar is ${r.dl.toFixed(1)} px off its lowest key and ${r.dr.toFixed(1)} px off its highest`);
    }
    assert.ok(Math.abs(rows.mc) <= 1, `${g.id}: “Middle C” is ${rows.mc.toFixed(1)} px off its key`);
    assert.ok(Math.abs(rows.line) <= 1.5, `${g.id}: the middle C line is ${rows.line.toFixed(1)} px off its key`);
  }

  await page.evaluate(() => { location.hash = 'compare/violins'; });
  await comparing(page, 'violins');
  const before = await page.evaluate(() => window.museumStarts.length);
  await page.click('.rg-row[data-id="violin"]');
  await page.waitForSelector('.rg-row[data-id="violin"].lo-on');
  const [lo, hi] = byId.violin.range;
  assert.equal(await page.textContent('#cmp-now'), `Violin: lowest ${notes.full(lo)}, highest ${notes.full(hi)}`);
  await page.waitForSelector('.rg-row[data-id="violin"].hi-on', { timeout: 4000 });
  await page.waitForFunction(() => !document.querySelector('#cmp-main .lit'), null, { timeout: 4000 });
  const starts = await page.evaluate((n) => window.museumStarts.slice(n), before);
  assert.ok(starts.some((a) => starts.some((b) => Math.abs(b.when - a.when - 1.3) < 0.02)), `the two notes should start 1.3 s apart: ${JSON.stringify(starts)}`);
  assert.deepEqual(errors, []);
});

test('Hear each one plays the family in turn, lighting each, and Stop stops it', async () => {
  const { page, errors } = await visit('#compare/brass');
  await comparing(page, 'brass');
  await page.click('#cmp-hear');
  assert.equal(await page.getAttribute('#cmp-hear', 'aria-pressed'), 'true');
  assert.equal(await page.textContent('#cmp-hear .word'), 'Stop');
  await page.waitForFunction(() => document.getElementById('cmp-now').textContent === 'Now playing: Trumpet' && document.querySelector('#cmp-line a.mem[data-id="trumpet"].lit'));
  // the tune's seven notes
  await page.waitForFunction(() => window.museumStarts.length >= 7, null, { timeout: 8000 });
  await page.waitForFunction(() => document.getElementById('cmp-now').textContent === 'Now playing: French horn', null, { timeout: 12000 });
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#cmp-main .lit')].map((e) => `${e.dataset.id} ${e.classList.contains('mem') ? 'in the row' : 'in the ranges'}`)),
    ['horn in the row', 'horn in the ranges']);
  await page.click('#cmp-hear');
  assert.equal(await page.getAttribute('#cmp-hear', 'aria-pressed'), 'false');
  assert.equal(await page.textContent('#cmp-hear .word'), 'Hear each one');
  assert.equal(await page.evaluate(() => document.querySelectorAll('#cmp-main .lit').length), 0);
  const n = await page.evaluate(() => window.museumStarts.length);
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => window.museumStarts.length), n, 'it went on playing after Stop');
  assert.equal(await page.textContent('#cmp-now'), 'Now playing: French horn');

  // a family with no notes to play plays the tune's rhythm
  await page.evaluate(() => { location.hash = 'compare/bells'; });
  await comparing(page, 'bells');
  await page.click('#cmp-hear');
  await page.waitForFunction(() => document.getElementById('cmp-now').textContent === 'Now playing: Shaker');
  await page.waitForFunction((n) => window.museumStarts.length >= n + 7, n, { timeout: 8000 });
  // leaving the page stops it
  await page.evaluate(() => { location.hash = ''; });
  await page.waitForFunction(() => !document.getElementById('hall').hidden);
  const m = await page.evaluate(() => window.museumStarts.length);
  await page.waitForTimeout(4500);
  assert.equal(await page.evaluate(() => window.museumStarts.length), m, 'it went on playing after leaving the page');
  assert.deepEqual(errors, []);
});

test('Back from a family goes where you came from: the exhibit, the floor plan, or the family again from one of its instruments', async () => {
  // from a placard; another family is in place of this one, so Back still goes to the exhibit
  const a = await visit('#violin');
  await readyAt(a.page, 'violin');
  await placard(a.page);
  await a.page.click('.pl-compare');
  await comparing(a.page, 'violins');
  assert.equal(await a.page.evaluate(() => document.getElementById('placard').open), false);
  const length = await a.page.evaluate(() => history.length);
  await a.page.click('#cmp-main .fams a[href="#compare/brass"]');
  await comparing(a.page, 'brass');
  assert.equal(await a.page.evaluate(() => history.length), length);
  assert.equal(await a.page.getAttribute('#cmp-main .fams a.on', 'href'), '#compare/brass');
  assert.equal(await a.page.title(), 'Brass, side by side · Instrument Museum');
  await a.page.click('#compare .back');
  await readyAt(a.page, 'violin');

  // straight to a family: Back goes to the floor plan, standing at that family
  const b = await visit('#compare/drums');
  await comparing(b.page, 'drums');
  await b.page.click('#compare .back');
  await b.page.waitForFunction(() => !document.getElementById('hall').hidden && location.hash === '');
  assert.equal(await b.page.evaluate(() => document.activeElement.getAttribute('href')), '#compare/drums');

  // from the floor plan's row of families, and on to an instrument and back
  const c = await visit('');
  await c.page.waitForSelector('#hall:not([hidden]) #families a');
  assert.deepEqual(await c.page.evaluate(() => [...document.querySelectorAll('#families a')].map((x) => x.getAttribute('href'))), GROUPS.map((g) => `#compare/${g.id}`));
  await c.page.click('#families a[href="#compare/keys"]');
  await comparing(c.page, 'keys');
  await c.page.click('#cmp-line a.mem[data-id="marimba"]');
  await readyAt(c.page, 'marimba');
  const pages = await c.page.evaluate(() => history.length);
  await c.page.click('#exhibit .back');
  await comparing(c.page, 'keys');
  await c.page.click('#compare .back');
  await c.page.waitForFunction(() => !document.getElementById('hall').hidden && location.hash === '');
  assert.equal(await c.page.evaluate(() => history.length), pages, 'Back went forward, to a new page');
  for (const v of [a, b, c]) assert.deepEqual(v.errors, []);
});

/* ---------- the hall ---------- */

test('the made-up hall: a moment’s quiet, early echoes different in each ear, then a tail that dies away and darkens', async () => {
  const { page, errors } = await visit('');
  const h = await page.evaluate(async () => {
    const { room } = await import('/museum/audio.js');
    const sr = 48000;
    const b = room(new OfflineAudioContext(2, sr, sr), 2.2);
    const [L, R] = [b.getChannelData(0), b.getChannelData(1)];
    const span = (d, a, z) => d.subarray(Math.floor(a * sr), Math.floor(z * sr));
    const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
    // how much of it is treble: the energy of its sample-to-sample steps, against its own
    const bright = (x) => { let d = 0, e = 0; for (let i = 1; i < x.length; i++) { d += (x[i] - x[i - 1]) ** 2; e += x[i] * x[i]; } return d / e; };
    let lr = 0, ll = 0, rr = 0;
    for (let i = 0; i < L.length; i++) { lr += L[i] * R[i]; ll += L[i] * L[i]; rr += R[i] * R[i]; }
    return {
      channels: b.numberOfChannels, seconds: b.length / sr,
      quiet: Math.max(...span(L, 0, 0.0135).map(Math.abs), ...span(R, 0, 0.0135).map(Math.abs)),
      firstEcho: [L, R].map((d) => d.findIndex((v) => Math.abs(v) > 0.5) / sr),
      together: lr / Math.sqrt(ll * rr),
      loud: [[0.08, 0.3], [0.8, 1.0], [1.8, 2.0]].map(([a, z]) => rms(span(L, a, z)) + rms(span(R, a, z))),
      treble: [[0.08, 0.3], [1.6, 2.0]].map(([a, z]) => bright(span(L, a, z)) + bright(span(R, a, z))),
    };
  });
  assert.equal(h.channels, 2);
  assert.ok(Math.abs(h.seconds - 2.2) < 0.001);
  assert.equal(h.quiet, 0, 'it should start with a moment’s quiet');
  assert.ok(h.firstEcho.every((t) => t > 0.014 && t < 0.03), `the first echo comes at ${h.firstEcho}`);
  assert.ok(h.firstEcho[0] !== h.firstEcho[1], 'the first echo reaches both ears at once');
  assert.ok(Math.abs(h.together) < 0.3, `the ears hear nearly the same thing (${h.together.toFixed(2)})`);
  assert.ok(h.loud[0] > 2 * h.loud[1] && h.loud[1] > 2 * h.loud[2], `it should die away: ${h.loud.map((x) => x.toFixed(4))}`);
  assert.ok(h.treble[0] > 2 * h.treble[1], `it should lose its treble as it dies: ${h.treble.map((x) => x.toFixed(3))}`);
  assert.deepEqual(errors, []);
});

test('notes ring in the recorded hall once the museum has one, and in the made-up one if it cannot load', async () => {
  const hall = { file: 'test-hall.wav', place: 'Test Hall', by: 'A. Recordist', license: 'CC0', source: 'https://example.org/test-hall', send: 0.3 };
  const good = await visit('', { media: { hall }, files: { 'test-hall.wav': { type: 'audio/wav', body: ECHO } } });
  await good.page.evaluate(async () => { window.museumAc = (await import('/museum/audio.js')).context(); });
  await good.page.waitForFunction(() => window.museumAc.museumHall === 'test-hall.wav');
  assert.deepEqual(good.errors, []);

  for (const broken of [{ status: 404, type: 'text/plain', body: 'not found' }, { type: 'audio/wav', body: Buffer.from('not a sound at all') }]) {
    const bad = await visit('', { media: { hall }, files: { 'test-hall.wav': broken } });
    const r = await bad.page.evaluate(async () => {
      const audio = await import('/museum/audio.js');
      const ac = audio.context();
      await new Promise((ok) => setTimeout(ok, 800));
      // and it still plays
      const piano = await audio.pitched('piano', 60, 60);
      piano.play(60, { vol: 0.5 });
      return { hall: ac.museumHall || null, started: window.museumStarts.length };
    });
    assert.deepEqual(r, { hall: null, started: 1 });
    assert.deepEqual(bad.errors, []);
  }
});

/* ---------- the photos and recordings ---------- */

test('every photo and recording the museum shows is in museum/media/, freely licensed and credited, and small enough', () => {
  const dir = new URL('../museum/media/', import.meta.url);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => !f.startsWith('.')) : [];
  const FREE = /^(CC0( 1\.0)?|CC BY [1-4]\.0|CC BY-SA [1-4]\.0|public domain)$/i;
  const listed = [];
  const credited = (what, m, ext, most) => {
    assert.ok(m.file && ext.test(m.file), `${what}: ${m.file} should be ${ext}`);
    assert.ok(m.by && FREE.test(m.license) && /^https:\/\//.test(m.source), `${what}: who made it, a free licence and the https page it came from`);
    listed.push(m.file);
    const p = new URL(m.file, dir);
    assert.ok(fs.existsSync(p), `${what}: ${m.file} is not in museum/media/`);
    assert.ok(fs.statSync(p).size <= most, `${what}: ${m.file} is ${fs.statSync(p).size} bytes, more than ${most}`);
  };
  for (const [id, p] of Object.entries(media.PHOTOS)) {
    assert.ok(byId[id], `PHOTOS.${id} is not an exhibit`);
    assert.ok(p.alt && p.alt.length > 10, `${id}: the photo needs words for those who can’t see it`);
    credited(`the ${id} photo`, p, /\.(webp|jpe?g|png)$/, 400e3);
  }
  for (const [id, p] of Object.entries(media.PIECES)) {
    assert.ok(byId[id], `PIECES.${id} is not an exhibit`);
    assert.ok(p.title && p.composer && p.played, `${id}: the piece’s title, composer and player`);
    credited(`the ${id} piece`, p, /\.(mp3|m4a|ogg|wav)$/, 4e6);
  }
  if (media.HALL) {
    assert.ok(media.HALL.place, 'the hall: where it was recorded');
    assert.ok(media.HALL.send == null || (media.HALL.send > 0 && media.HALL.send < 1), 'the hall: how much of the sound goes to it, 0 to 1');
    credited('the hall', media.HALL, /\.(wav|mp3)$/, 2e6);
  }
  for (const f of files) assert.ok(listed.includes(f), `museum/media/${f} is not in media.js, so nothing shows it or credits it`);
  // and the site serves the folder
  assert.ok(!/^museum\/?(media\/?)?$/m.test(fs.readFileSync(new URL('../.assetsignore', import.meta.url), 'utf8')), '.assetsignore leaves out museum/media/');
});
