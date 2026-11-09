/* The sub view: a substitute types the code from Kyle's sub plans and gets the deck he
   picked (with the decks it links into) to present. Everything stays in this page's
   memory: nothing is stored on the device, and no time on screen is recorded.
   See subApi in worker/index.js and class/subs.js. */

import { present } from '/class/present.js';
import { buildMenu } from '/class/menus.js';
import { mediaOf } from '/class/store.js';

const $ = (s) => document.querySelector(s);
const urls = new Map();                    // picture hash -> object URL
let bundle = null;                         // { start, decks: Map(id -> { id, name, deck }), key }

const mediaUrl = (hash) => urls.get(hash) || '';

async function loadPictures(deck) {
  const need = mediaOf(deck).filter((h) => !urls.has(h));
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(6, need.length) }, async () => {
    while (i < need.length) {
      const hash = need[i++];
      try {
        const res = await fetch('/api/sub/media/' + hash, { headers: { 'X-Sub-Key': bundle.key }, cache: 'no-store' });
        if (res.ok) urls.set(hash, URL.createObjectURL(await res.blob()));
      } catch (e) { /* shows without it */ }
    }
  }));
}

async function open(code) {
  const msg = $('#msg');
  msg.textContent = '…';
  let res;
  try {
    res = await fetch('/api/sub/open', { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  } catch (e) {
    msg.textContent = 'No connection.';
    return;
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) { msg.textContent = out.error || 'That didn\'t work.'; return; }
  bundle = { start: out.start, key: out.key, decks: new Map(out.decks.map((d) => [d.id, d])) };
  const rec = bundle.decks.get(bundle.start);
  await loadPictures(rec.deck);
  msg.textContent = '';
  $('#name').textContent = rec.name;
  document.title = rec.name;
  $('#open').hidden = true;
  $('#ready').hidden = false;
  $('#go').focus();
}

function show() {
  const rec = bundle.decks.get(bundle.start);
  const built = rec.deck.built;
  const grade = built && built.grade;
  const menuFor = async (deckId, g, extra) => {
    const r = bundle.decks.get(deckId);
    if (!r) return null;
    await loadPictures(r.deck);
    return buildMenu(r.deck, g, r.name, extra || {});
  };
  const openDeck = async (link) => {
    const r = bundle.decks.get(link.deck);
    if (!r) return null;
    await loadPictures(r.deck);
    const hit = { deck: r.deck, media: mediaUrl, deckId: r.id, deckName: r.name, index: link.slide || 0 };
    if (link.menu && grade) hit.menu = buildMenu(r.deck, grade, r.name, {});
    return hit;
  };
  const findGoogle = async (gdoc, gslide) => {
    const r = [...bundle.decks.values()].find((d) => d.deck.googleId === gdoc);
    if (!r) return null;
    await loadPictures(r.deck);
    const i = gslide ? r.deck.slides.findIndex((s) => s.gid === gslide) : 0;
    return { deck: r.deck, media: mediaUrl, index: Math.max(i, 0), deckId: r.id, deckName: r.name };
  };
  const first = Math.max(0, rec.deck.slides.findIndex((s) => !s.hidden));
  present(rec, first, mediaUrl, () => $('#go').focus(), findGoogle,
    { grade, menuFor, openDeck, noTimings: true });
}

$('#open').addEventListener('submit', (e) => {
  e.preventDefault();
  open($('#code').value.trim());
});
$('#go').addEventListener('click', show);
