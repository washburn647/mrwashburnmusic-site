/* Avatar shop: everything in Musician Maker's closet (musician-maker/shop.js), a slot at a
   time: each item's picture, name, price in music notes, whether the shop sells it, and how a
   prize is won (beat a boss, master a step, reach a level), in the collection book's order.
   Earning: what runs pay, and a groove's price in the record shop. Beside the list, the avatar
   wears the item picked, in any mood.
   Kept on this device as a draft, with undo; "Publish to site" puts it in the game right away
   (/api/live/shop.json, see worker/index.js); "Download" saves shop.json, a backup Restore
   reads and tools/add_shop.py puts in musician-maker/shop.json.
   Typing in a field changes the draft without redrawing the page (so a click that ends the
   edit still lands); everything else redraws it, and the field that had focus keeps it. */

import * as S from '/musician-maker/shop.js';
import { avatar, itemSvg, fitItems, setMood, MOODS } from '/musician-maker/avatar.js';
import { STEPS } from '/musician-maker/steps.js';
import { UNITS } from '/musician-maker/path.js';
import { h, confirmButton } from '../dom.js';

const app = document.getElementById('app');
const KEY = 'mwm-shop-editor-1';
const EARN = [
  ['every', 'A note for every', 'right answers', 1],
  ['clean', 'A set with no misses', 'notes', 0],
  ['boss', 'Beating a boss', 'notes', 0],
  ['bossTry', 'A boss that gets away', 'notes', 0],
  ['daily', 'The day\'s first run', 'notes', 0],
];
const MOOD_ICON = { idle: '🙂', happy: '😄', cheer: '🙌', sad: '😢', wow: '😮', sing: '🎤', play: '🎸', dance: '💃', sleep: '😴' };

let shop = null; // the draft, in completeShop's shape
let site = null; // what the game has now: { shop, at, from: 'live' | 'repo' }
let tab = 'kind'; // a slot's id, or 'earn'
let picked = null; // the item the avatar wears, in the tab's slot
let mood = 'idle';
let base = { ...S.DEFAULT_LOOK }; // the avatar's look under the item
let past = [];
let future = [];
let status = '';
let publishing = false;
let refocusing = false; // render putting focus back: not the user moving to a row

/* ---------- the file ---------- */

/* The draft as shop.json: every item in order, with what the catalog has unless changed. */
function fileOf(x) {
  const items = {};
  for (const { id: slot } of S.SLOTS) {
    items[slot] = x.items[slot].map((it) => {
      const out = { id: it.id, name: it.name, price: it.price };
      if (it.hidden) out.hidden = true;
      if (it.unlock) out.unlock = it.unlock;
      else if (catOf(slot, it.id)?.unlock) out.unlock = null;
      return out;
    });
  }
  return { items, earn: x.earn, groovePrice: x.groovePrice };
}
const fileText = (x) => {
  const f = fileOf(x);
  const slots = Object.entries(f.items).map(([slot, list]) => `${JSON.stringify(slot)}: [\n${list.map((it) => `  ${JSON.stringify(it)}`).join(',\n')}\n]`);
  return `{"items": {\n${slots.join(',\n')}\n},\n"earn": ${JSON.stringify(f.earn)},\n"groovePrice": ${f.groovePrice}}\n`;
};
const same = () => site && fileText(shop) === fileText(site.shop);
const catOf = (slot, id) => S.CATALOG[slot].find((c) => c.id === id);
const wonKey = (u) => (!u ? '' : u.boss ? `boss:${u.boss}` : u.step ? `step:${u.step}` : `level:${u.level}`);
/* Changed from the game's own catalog (what ↺ puts back). */
const differs = (slot, it) => {
  const cat = catOf(slot, it.id);
  return it.name !== cat.name || it.price !== cat.price || !!it.hidden || wonKey(it.unlock) !== wonKey(cat.unlock);
};

function store() {
  try { localStorage.setItem(KEY, JSON.stringify({ shop: fileOf(shop), tab, base })); } catch { /* not kept */ }
}
/* Before an edit: the draft as it was, for undo. */
function snapshot(before = JSON.stringify(shop)) {
  past.push(before);
  if (past.length > 200) past.shift();
  future = [];
  status = '';
}
function changed() {
  store();
  render();
}
function undo(redo = false) {
  const from = redo ? future : past;
  if (!from.length) return;
  (redo ? past : future).push(JSON.stringify(shop));
  shop = JSON.parse(from.pop());
  status = '';
  changed();
}

async function loadSite() {
  const get = async (url) => {
    const r = await fetch(url, { cache: 'no-store' });
    return r.ok ? { data: await r.json(), at: r.headers.get('Last-Modified') } : null;
  };
  const live = await get('/api/live/shop.json').catch(() => null);
  if (live?.data?.items) site = { shop: S.completeShop(live.data), at: live.at, from: 'live' };
  else site = { shop: S.completeShop((await get('/musician-maker/shop.json').catch(() => null))?.data || {}), at: null, from: 'repo' };
}

async function start() {
  let kept = null;
  try { kept = JSON.parse(localStorage.getItem(KEY)); } catch { /* none */ }
  await loadSite();
  shop = kept?.shop ? S.completeShop(kept.shop) : structuredClone(site.shop);
  if (kept?.tab && (kept.tab === 'earn' || S.SLOTS.some((s) => s.id === kept.tab))) tab = kept.tab;
  if (kept?.base) base = { ...S.DEFAULT_LOOK, ...kept.base };
  render();
}

/* ---------- fields ---------- */

/* A typed field: the draft follows each key without a redraw; undo takes the whole edit as one
   step. apply(text, done) sets the draft and, once done, gives the value to show. */
function typed(props, apply) {
  let before = null;
  return h('input', {
    ...props,
    onfocus: () => { before = JSON.stringify(shop); },
    oninput: (e) => { apply(e.target.value, false); store(); refresh(); },
    onchange: (e) => {
      e.target.value = apply(e.target.value, true);
      const now = JSON.stringify(shop);
      if (before && before !== now) snapshot(before);
      before = now;
      store();
      refresh();
    },
  });
}
const whole = (text, lo, hi) => {
  const n = Math.round(Number(text));
  return text.trim() !== '' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null;
};
function numberField(key, get, lo, hi, set, label) {
  return typed({ type: 'number', min: lo, max: hi, step: 1, value: get(), 'aria-label': label, dataset: { k: key } }, (text, done) => {
    const n = whole(text, lo, hi);
    if (n !== null) set(n);
    return done ? String(get()) : text;
  });
}

/* How a prize is won, as a select: sold (no prize), a boss, a step, a level. */
const WON_BY = [
  ['', 'For sale'],
  ['Beat a boss', Object.entries(S.BOSSES).map(([id, b]) => [`boss:${id}`, `${b.icon} ${b.name} · ${b.game}`])],
  ...UNITS.map((u) => [`Master a step · ${u.name} ${u.label}`, Array.from({ length: u.top }, (_, i) => [`step:${u.id}:${i + 1}`, `${u.icon} ${u.name}, step ${i + 1}: ${STEPS[i + 1].name}`])]),
  ['Reach a level', Array.from({ length: 29 }, (_, i) => [`level:${i + 2}`, `⭐ Level ${i + 2}`])],
];
const wonOf = (key) => {
  const [kind, ...rest] = key.split(':');
  if (kind === 'boss') return { boss: rest[0] };
  if (kind === 'step') return { step: rest.join(':') };
  if (kind === 'level') return { level: Number(rest[0]) };
  return undefined;
};
function wonSelect(slot, it, onpick) {
  const now = wonKey(it.unlock);
  return h('select', { class: 'won', 'aria-label': `How to get ${it.name}`, dataset: { k: `won:${slot}:${it.id}` }, onchange: (e) => onpick(wonOf(e.target.value)) },
    WON_BY.map(([a, b]) => (Array.isArray(b)
      ? h('optgroup', { label: a }, b.map(([v, t]) => h('option', { value: v, selected: v === now }, t)))
      : h('option', { value: a, selected: a === now }, b))));
}
const howText = (it) => {
  const how = it.unlock ? S.howToGet(it) : null;
  if (!how) return it.price ? `♪ ${it.price}` : 'Free';
  const won = how.boss ? `🏆 Beat ${how.name} in ${how.game}`
    : how.step ? `★ Master ${UNITS.find((u) => u.id === how.unit)?.name || how.unit}, step ${how.n}` : `⭐ Reach level ${how.level}`;
  return it.price ? `${won}, then ♪ ${it.price}` : won;
};

/* ---------- page ---------- */

function render() {
  if (!shop) return;
  const pageY = window.scrollY;
  const focusKey = document.activeElement?.dataset?.k;
  const restore = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: () => { restoreFile(restore.files[0]); restore.value = ''; } });
  app.replaceChildren(...[
    h('div', { class: 'bar' },
      h('h1', { class: 'grow' }, 'Avatar shop', h('small', {}, ' Musician Maker')),
      h('button', { onclick: () => restore.click() }, 'Restore'),
      restore,
      h('button', { onclick: download }, 'Download'),
      h('button', { class: 'primary', disabled: publishing, onclick: publish }, publishing ? 'Publishing…' : 'Publish to site')),
    sumBar(),
    h('nav', { class: 'tabs', 'aria-label': 'Slots' },
      ...S.SLOTS.map((s) => h('button', { class: tab === s.id ? 'on' : '', dataset: { k: `tab:${s.id}` }, 'aria-current': tab === s.id ? 'page' : null,
        onclick: () => { tab = s.id; picked = null; store(); render(); } },
      h('span', { 'aria-hidden': 'true' }, s.icon), ` ${s.name} `, h('small', {}, String(shop.items[s.id].filter((it) => it.id !== 'none').length)))),
      h('button', { class: tab === 'earn' ? 'on' : '', dataset: { k: 'tab:earn' }, onclick: () => { tab = 'earn'; store(); render(); } }, h('span', { 'aria-hidden': 'true' }, '🪙'), ' Earning')),
    tab === 'earn' ? earning() : slotView(),
  ].filter(Boolean));
  fitItems(app);
  refocusing = true;
  if (focusKey) app.querySelector(`[data-k="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
  refocusing = false;
  if (window.scrollY !== pageY) window.scrollTo(0, pageY);
}

/* What the game has, against the draft; undo; the last thing done. */
function sumBar() {
  const when = site?.at ? new Date(site.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
  return h('div', { class: 'bar sum-bar' },
    h('span', { class: 'total' }, site.from === 'live' ? `Live${when ? `, published ${when}` : ''}` : 'Nothing published: the game uses the repo\'s shop.json'),
    same() ? h('span', { class: 'chip live' }, 'Same as the game') : h('span', { class: 'chip changed' }, 'Changed: publish to put it in the game'),
    status ? h('span', { class: 'status' }, status) : null,
    h('span', { class: 'grow' }),
    same() ? null : confirmButton('Start over from the game', 'Throw away the changes?', () => { snapshot(); shop = structuredClone(site.shop); status = 'Back to what the game has.'; changed(); }),
    h('button', { class: 'icon', title: 'Undo (Ctrl+Z)', disabled: !past.length, onclick: () => undo() }, '↶ Undo'),
    h('button', { class: 'icon', title: 'Redo (Ctrl+Shift+Z)', disabled: !future.length, onclick: () => undo(true) }, '↷ Redo'));
}

/* After typing: the parts of the page that show the draft, without redrawing the fields. */
function refresh() {
  app.querySelector('.sum-bar')?.replaceWith(sumBar());
  if (tab === 'earn') return;
  for (const li of app.querySelectorAll('.it-row')) {
    const it = shop.items[tab].find((x) => x.id === li.dataset.id);
    const reset = li.querySelector('.it-reset');
    if (it && reset) reset.hidden = !differs(tab, it);
  }
  const it = shop.items[tab].find((x) => x.id === picked);
  if (it) app.querySelector('.pv-name')?.replaceWith(pvName(it));
}

/* A slot's items, in the book's order, beside the avatar wearing the one picked. */
function slotView() {
  const slot = tab;
  const list = shop.items[slot];
  if (!list.some((it) => it.id === picked)) picked = list.find((it) => it.id === base[slot])?.id || list[0].id;
  const move = (i, d) => { snapshot(); const [it] = list.splice(i, 1); list.splice(i + d, 0, it); changed(); };
  const edit = (it, fn) => { snapshot(); fn(it); picked = it.id; changed(); };
  // Working on a row puts its item on the avatar.
  const pick = (it) => {
    if (picked === it.id || refocusing) return;
    picked = it.id;
    for (const li of app.querySelectorAll('.it-row')) {
      li.classList.toggle('on', li.dataset.id === picked);
      li.querySelector('.tile')?.setAttribute('aria-pressed', String(li.dataset.id === picked));
    }
    app.querySelector('.pv')?.replaceWith(preview(slot));
  };
  const sorted = (a, b) => (!!a.unlock - !!b.unlock) || (a.price - b.price);
  const inOrder = list.slice(1).every((it, i, rest) => !i || sorted(rest[i - 1], it) <= 0);
  const rows = list.map((it, i) => {
    const first = i === 0;
    const cat = catOf(slot, it.id);
    const k = `${slot}:${it.id}`;
    const art = h('span', { class: 'art', 'aria-hidden': 'true' });
    art.innerHTML = itemSvg(slot, it.id, base); // fixed markup (avatar.js)
    return h('li', { class: `it-row${it.id === picked ? ' on' : ''}${it.hidden ? ' hidden' : ''}${it.unlock ? ' prize' : ''}${first ? ' first' : ''}`, dataset: { id: it.id }, onfocusin: () => pick(it) },
      h('span', { class: 'gg-move' },
        h('button', { class: 'icon', 'aria-label': `Move ${it.name} up`, dataset: { k: `up:${k}` }, disabled: i <= 1, onclick: () => move(i, -1) }, '▲'),
        h('button', { class: 'icon', 'aria-label': `Move ${it.name} down`, dataset: { k: `down:${k}` }, disabled: first || i === list.length - 1, onclick: () => move(i, 1) }, '▼')),
      h('button', { class: `tile cl-${slot}`, 'aria-label': `Try on ${it.name}`, 'aria-pressed': String(it.id === picked), dataset: { k: `tile:${k}` }, onclick: () => pick(it) }, art),
      h('span', { class: 'it-name' },
        typed({ class: 'name small', value: it.name, maxLength: 40, 'aria-label': 'Name', dataset: { k: `name:${k}` } }, (text, done) => {
          it.name = text.trim().slice(0, 40) || cat.name;
          return done ? it.name : text;
        }),
        h('small', {}, it.id)),
      first ? h('span', { class: 'it-first' }, 'Free, everyone has it')
        : [
          h('label', { class: 'it-price', title: it.unlock ? 'Once it\'s won: 0 is free, more is its price' : 'Music notes' }, '♪',
            numberField(`price:${k}`, () => it.price, 0, 999, (n) => { it.price = n; }, `${it.name} price`)),
          wonSelect(slot, it, (u) => edit(it, (x) => { if (u) x.unlock = u; else delete x.unlock; })),
          h('label', { class: 'it-shop', title: 'Off: out of the closet. Anyone who has it keeps it.' },
            h('input', { type: 'checkbox', checked: !it.hidden, dataset: { k: `shop:${k}` }, onchange: (e) => edit(it, (x) => { if (e.target.checked) delete x.hidden; else x.hidden = true; }) }), 'In the shop'),
          h('button', { class: 'icon it-reset', hidden: !differs(slot, it), dataset: { k: `reset:${k}` },
            title: `Back to the game's own: ${cat.name}, ${cat.price} notes${cat.unlock ? ', a prize' : ''}`,
            onclick: () => edit(it, (x) => { Object.keys(x).forEach((key) => delete x[key]); Object.assign(x, structuredClone(cat)); }) }, '↺'),
        ]);
  });
  return h('div', { class: 'split-view' },
    h('div', { class: 'it-col' },
      h('div', { class: 'it-tools' },
        h('span', { class: 'total' }, counts(list)),
        h('span', { class: 'grow' }),
        inOrder ? null : h('button', { class: 'icon', dataset: { k: 'sort' }, onclick: () => { snapshot(); list.splice(1, Infinity, ...list.slice(1).sort(sorted)); changed(); } }, '⇅ Sort by price')),
      h('ol', { class: 'it-list' }, rows)),
    preview(slot));
}
const counts = (list) => {
  const n = (f) => list.slice(1).filter(f).length;
  const sold = n((it) => !it.unlock && !it.hidden);
  const prizes = n((it) => it.unlock && !it.hidden);
  const hidden = n((it) => it.hidden);
  return [`${sold} in the shop`, prizes ? `${prizes} to win` : '', hidden ? `${hidden} out of the shop` : ''].filter(Boolean).join(' · ');
};

/* The avatar wearing the item picked, in a mood; its animal and look can change too. */
function preview(slot) {
  const it = shop.items[slot].find((x) => x.id === picked);
  const av = avatar({ ...base, [slot]: picked }, { cls: 'pv-av' });
  setMood(av, mood, { beat: 0.55 });
  const moods = h('div', { class: 'pv-moods', role: 'group', 'aria-label': 'Mood' }, MOODS.map((m) => h('button', {
    class: m === mood ? 'on' : '', title: m, 'aria-label': m, 'aria-pressed': String(m === mood), dataset: { k: `mood:${m}` },
    onclick: (e) => {
      mood = m;
      setMood(av, m, { beat: 0.55 });
      for (const b of moods.children) { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-pressed', String(b === e.currentTarget)); }
    },
  }, MOOD_ICON[m])));
  const kept = base[slot] === picked;
  return h('aside', { class: 'pv' },
    av,
    h('div', { class: 'pv-side' },
      pvName(it),
      moods,
      h('div', { class: 'pv-tools' },
        slot === 'kind' ? null : h('select', { 'aria-label': 'Animal', dataset: { k: 'base-kind' }, onchange: (e) => { base.kind = e.target.value; store(); render(); } },
          shop.items.kind.map((k) => h('option', { value: k.id, selected: k.id === base.kind }, k.name))),
        h('button', { disabled: kept, dataset: { k: 'keep' }, onclick: () => { base = { ...base, [slot]: picked }; store(); render(); } }, 'Keep it on'),
        h('button', { class: 'icon', dataset: { k: 'bare' }, onclick: () => { base = { ...S.DEFAULT_LOOK, kind: base.kind }; store(); render(); } }, 'Take it all off'))));
}
const pvName = (it) => h('p', { class: 'pv-name' }, h('b', {}, it.name), h('span', {}, howText(it)),
  it.hidden ? h('span', { class: 'chip' }, 'Out of the shop') : null);

/* What runs pay in music notes, and a groove's price in the record shop. */
function earning() {
  return h('div', { class: 'earn' },
    h('section', { class: 'card' },
      h('h2', {}, 'Music notes from runs'),
      h('ul', { class: 'earn-rows' }, EARN.map(([k, label, unit, lo]) => h('li', {},
        h('span', {}, label),
        numberField(`earn:${k}`, () => shop.earn[k], lo, 50, (n) => { shop.earn[k] = n; }, label),
        h('small', {}, unit))))),
    h('section', { class: 'card' },
      h('h2', {}, 'Record shop'),
      h('ul', { class: 'earn-rows' }, h('li', {},
        h('span', {}, 'A groove'),
        numberField('groovePrice', () => shop.groovePrice, 0, 999, (n) => { shop.groovePrice = n; }, 'A groove\'s price'),
        h('small', { title: 'Unless Groove Lab gives it a price' }, 'notes')))));
}

/* ---------- publish, download, restore ---------- */

async function publish() {
  publishing = true;
  render();
  try {
    const r = await fetch('/studio/api/live/shop', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: fileText(shop) });
    if (r.status === 401) throw new Error('your sign-in ran out. Reload the page and try again');
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `the site said ${r.status}`);
    await loadSite();
    status = 'Published. It\'s in Musician Maker now.';
  } catch (e) {
    status = `Couldn't publish: ${e.message}`;
  }
  publishing = false;
  render();
}

function download() {
  const a = h('a', { href: URL.createObjectURL(new Blob([fileText(shop)], { type: 'application/json' })), download: 'shop.json', hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  status = 'Downloaded shop.json.';
  render();
}

async function restoreFile(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data?.items) throw new Error('no shop in that file');
    snapshot();
    shop = S.completeShop(data);
    status = 'Restored.';
    changed();
  } catch (e) {
    status = `Couldn't restore: ${e.message}`;
    render();
  }
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(true); }
});

start();
