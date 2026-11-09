/* Sub plans (#/sub): which deck a substitute gets, and the code that opens it at
   /sub/. The website keeps the setting (/api/class/sub, see subApi in worker/index.js)
   with the ids of the decks the sub deck links into, so links work there too; when
   those links change, the app sends the new list (refreshSub, after each sync). */

import * as store from './store.js';
import { el } from './ui.js';
import * as sync from './sync.js';

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
  const now = linkedDecks(had.deck, decks);
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
        save({ code: code.value, deck: pick.value, decks: linkedDecks(pick.value, decks) });
      } }, 'Save'),
      el('button', { class: 'btn quiet', onclick: () => save({ code: '' }) }, 'Turn off')),
    msg));
  paint();
}
