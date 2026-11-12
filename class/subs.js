/* Sub plans (#/sub): which deck a substitute gets, and the code that opens it at
   /sub/. The website keeps the setting (/api/class/sub, see subApi in worker/index.js)
   with the ids of the decks the sub deck links into, so links work there too; when
   those links change, the app sends the new list (refreshSub, after each sync). The Sub songs
   deck (subsongs.js) always goes along, for the sub view's song menus. Below the setting,
   Kyle tags sub songs, unlocks them by hand and opens their sub versions to edit. */

import * as store from './store.js';
import { el, loadHashes } from './ui.js';
import * as sync from './sync.js';
import { normName, categoryDeck, indexSongs, schoolYear } from './plans.js';
import { subDeck, setSubSong, setOpen, refreshSubSongs, songKey } from './subsongs.js';

const API = '/api/class/sub';
const KEEP = 'class.sub';                  // { deck, decks } as last sent

function remembered() { try { return JSON.parse(localStorage.getItem(KEEP)) || null; } catch (e) { return null; } }
function remember(v) { try { localStorage.setItem(KEEP, JSON.stringify(v)); } catch (e) { /* private window */ } }

/** The decks a deck links into, and those they link into, by id. */
export function linkedDecks(id, decks) {
  const byId = new Map(decks.map((d) => [d.id, d]));
  const byGoogle = new Map(decks.filter((d) => d.deck.googleId).map((d) => [d.deck.googleId, d.id]));
  const out = [id];
  for (let i = 0; i < out.length; i++) {
    const rec = byId.get(out[i]);
    if (!rec) continue;
    const take = (link) => {
      if (!link) return;
      const to = link.deck || (link.gdoc && byGoogle.get(link.gdoc));
      if (to && byId.has(to) && !out.includes(to)) out.push(to);
    };
    for (const s of rec.deck.slides) for (const e of s.els) {
      take(e.link);
      if (e.text) for (const p of e.text.paras) for (const r of p.runs) take(r.link);
    }
  }
  return out.slice(1);
}

/** The decks to send with the sub deck: those it links into, and the Sub songs deck. */
function withSongs(deck, linked, decks) {
  const songs = decks.find((d) => d.deck.subSongs);
  return songs && songs.id !== deck && !linked.includes(songs.id) ? [...linked, songs.id] : linked;
}

async function send(body) {
  const res = await fetch(API, { method: 'PUT', cache: 'no-store', redirect: 'manual',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'Saving didn\'t work (' + (res.status || 'sign in') + ').');
  remember(out.code ? { deck: out.deck, decks: out.decks.filter((d) => d !== out.deck) } : null);
  return out;
}

/** After a sync: if the sub deck's links now reach other decks, tell the website. */
export async function refreshSub() {
  const had = remembered();
  if (!had || !had.deck) return;
  const decks = await store.listDecks();
  if (!decks.some((d) => d.id === had.deck)) return;
  const now = withSongs(had.deck, linkedDecks(had.deck, decks), decks);
  if (JSON.stringify(now) === JSON.stringify(had.decks)) return;
  try { await send({ deck: had.deck, decks: now }); } catch (e) { /* next time */ }
}

function newCode() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => abc[b % abc.length]).join('');
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function showSub(main) {
  document.title = 'Sub plans · Class';
  main.replaceChildren(el('div', { class: 'deck-head' }, el('h2', {}, 'Sub plans')));
  let set = { code: '' };
  try {
    const res = await fetch(API, { cache: 'no-store', redirect: 'manual' });
    if (res.ok) set = await res.json();
    else throw new Error();
  } catch (e) {
    main.append(el('p', { class: 'sub-note' }, 'Sign in to sync first (the cloud at the top).'));
    return;
  }
  const decks = await store.listDecks();
  const pick = el('select', { class: 'sub-deck' },
    el('option', { value: '' }, '—'),
    decks.map((d) => el('option', { value: d.id, selected: d.id === set.deck }, d.name)));
  const code = el('input', { class: 'sub-code', value: set.code || newCode(), maxlength: 40, autocomplete: 'off', spellcheck: 'false' });
  const msg = el('p', { class: 'sub-note' });
  const where = location.host + '/sub';
  const status = el('p', { class: 'sub-status' });
  const paint = () => {
    status.replaceChildren(set.code
      ? el('span', {}, where + ' · ', el('b', {}, set.code))
      : el('span', {}, 'Off'));
    edit.hidden = !pick.value;
  };
  const edit = el('button', { class: 'btn quiet', onclick: () => { location.hash = '#/deck/' + pick.value + '/edit'; } }, 'Edit');
  pick.addEventListener('change', paint);

  const save = async (body) => {
    msg.textContent = '';
    try {
      await sync.syncNow();                 // the deck has to be on the website first
      set = await send(body);
      paint();
    } catch (e) {
      msg.textContent = e.message;
    }
  };

  main.append(el('div', { class: 'sub-form' },
    status,
    el('label', {}, 'Deck ', pick, edit,
      el('button', { class: 'btn quiet', onclick: async () => {
        const now = Date.now();
        const rec = { id: newId(), name: 'Sub plans', created: now, updated: now,
          deck: { w: 960, h: 540, slides: [{ bg: { type: 'solid', color: '#FFFFFF' }, els: [] }] } };
        await store.putDeck(rec);
        location.hash = '#/deck/' + rec.id + '/edit';
      } }, '+ New')),
    el('label', {}, 'Code ', code,
      el('button', { class: 'btn quiet', title: 'New code', onclick: () => { code.value = newCode(); } }, '↻')),
    el('div', { class: 'sub-row' },
      el('button', { class: 'btn', onclick: () => {
        if (!pick.value) { msg.textContent = 'Pick a deck.'; return; }
        save({ code: code.value, deck: pick.value, decks: withSongs(pick.value, linkedDecks(pick.value, decks), decks) });
      } }, 'Save'),
      el('button', { class: 'btn quiet', onclick: () => save({ code: '' }) }, 'Turn off')),
    msg));
  paint();
  main.append(await songsSection(main));
}

/** Sub songs, by category: tap a song to tag it (or untag it), ✎ edits its sub version,
    the lock opens it for the sub whether or not the class has reached it. */
const opened = new Set();                  // categories opened on the page, kept while it redraws

async function songsSection(main) {
  const box = el('div', { class: 'sub-songs' });
  const years = await store.listPlans().catch(() => []);
  const plan = years.find((y) => y.year === schoolYear()) || years[years.length - 1];
  if (!plan) return box;
  await refreshSubSongs(plan);
  const decks = await store.listDecks();
  const rec = await subDeck(decks);
  const tagged = new Map(rec ? rec.deck.subSongs.songs.map((x) => [x.key, x]) : []);
  const out = [el('h2', {}, 'Sub songs')];
  for (const category of plan.categories) {
    const src = categoryDeck(decks, category);
    if (!src) continue;
    const list = (plan.catalog[category] || []).map((x) => x.name);
    const index = indexSongs(src.deck, list);
    const songs = list.filter((n) => (index.get(normName(n)) || []).length);
    if (!songs.length) continue;
    const icons = new Map(songs.map((n) => {
      const sl = src.deck.slides[index.get(normName(n))[0]];
      return [n, sl.song && sl.song.icon];
    }));
    const media = await loadHashes([...icons.values()].filter(Boolean));
    const count = songs.filter((n) => tagged.has(songKey(category, n))).length;
    const grid = el('div', { class: 'sub-grid' }, songs.map((n) => {
      const key = songKey(category, n);
      const t = tagged.get(key);
      const at = t && rec ? rec.deck.slides.findIndex((x) => x.subSong === key) : -1;
      return el('div', { class: 'sub-song' + (t ? ' on' : '') },
        el('button', { class: 'sub-pick', title: t ? 'Sub song' : '', onclick: async () => {
          if (t && !window.confirm('Take ' + n + ' out of the sub songs? Its sub version goes too.')) return;
          try { await setSubSong(plan, category, n, !t); } catch (e) { window.alert(e.message); }
          showSub(main);
        } }, icons.get(n) ? el('img', { src: media(icons.get(n)), alt: '' }) : null, el('span', {}, n)),
        t ? el('span', { class: 'sub-tools' },
          el('button', { class: 'btn quiet small', title: 'Edit the sub version',
            onclick: () => { location.hash = '#/deck/' + rec.id + '/edit/' + (Math.max(0, at) + 1); } }, '✎'),
          el('button', { class: 'btn quiet small' + (t.open ? ' on' : ''), title: t.open ? 'Unlocked' : 'Locks until the class reaches it',
            onclick: async () => { await setOpen(key, !t.open); showSub(main); } }, t.open ? '🔓' : '🔒')) : null);
    }));
    const d = el('details', { class: 'sub-cat', open: count || opened.has(category) ? true : null },
      el('summary', {}, category, count ? el('span', { class: 'count' }, String(count)) : null), grid);
    d.addEventListener('toggle', () => { if (d.open) opened.add(category); else opened.delete(category); });
    out.push(d);
  }
  box.replaceChildren(...out);
  return box;
}
