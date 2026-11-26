/* The closet's catalog: every item the avatar can have, its price in music notes (♪) and how
   it's won. avatar.js and wardrobe.js draw them; this says what they cost.
   - CATALOG: the items as the game ships them. Price 0 is free from the start.
   - unlock: an item that's won, not bought: { boss: <game id> } (beat that game's boss once),
     { step: 'unit-1:5' } (master that step, path.js keys), or { level: n }. Once won it's free,
     unless it has a price too (then it can be bought once it's won).
   - hidden: out of the shop. Anyone who has it keeps it.
   Kyle's studio shop editor (/studio/shop/) changes prices, names, unlocks, what's hidden and
   the order, and what runs pay: it publishes shop.json (/api/live/shop.json, see
   worker/index.js), and the game reads that over this file's catalog (applyShop). Nothing a
   learner has is ever taken away: st.owned keeps every item they've bought or worn. */

export const SLOTS = [
  { id: 'kind', icon: '🐾', group: 'me', name: 'Animal' },
  { id: 'color', icon: '🎨', group: 'me', name: 'Color' },
  { id: 'pattern', icon: '🦓', group: 'me', name: 'Pattern' },
  { id: 'face', icon: '😀', group: 'me', name: 'Face' },
  { id: 'hat', icon: '🎩', group: 'wear', name: 'Hat' },
  { id: 'glasses', icon: '🕶️', group: 'wear', name: 'Glasses' },
  { id: 'neck', icon: '🎀', group: 'wear', name: 'Neck' },
  { id: 'shoes', icon: '👟', group: 'wear', name: 'Shoes' },
  { id: 'hold', icon: '🎸', group: 'play', name: 'Instrument' },
  { id: 'bg', icon: '🖼️', group: 'stage', name: 'Background' },
];
export const GROUPS = [
  { id: 'me', icon: '🐾', name: 'Me' },
  { id: 'wear', icon: '🎩', name: 'Wear' },
  { id: 'play', icon: '🎸', name: 'Play' },
  { id: 'stage', icon: '🖼️', name: 'Stage' },
];

/* The bosses, by game, for the trophies they give (main.js records st.bosses[game id]). */
export const BOSSES = {
  'mouse-catcher': { name: 'The Big Cheese', icon: '🧀', game: 'Mouse Catcher' },
  'supper-time': { name: 'The Big Fluff', icon: '🥣', game: 'Supper Time' },
  'brushing-time': { name: 'The Mane Event', icon: '🪮', game: 'Brushing Time' },
  'petting-time': { name: 'The Belly', icon: '🐈‍⬛', game: 'Petting Time' },
  litterbox: { name: 'The Big Stink', icon: '💩', game: 'Litterbox' },
  'dancing-time': { name: 'Saturday Night Fur', icon: '🪩', game: 'Dancing Time' },
  bedtime: { name: 'The Bed Hog', icon: '🛏️', game: 'Bedtime' },
};

// [id, name, price, unlock]. The first of each slot is the default look's.
const T = (game) => ({ boss: game });
const S = (key) => ({ step: key });
const RAW = {
  kind: [['cat', 'Cat', 0], ['bunny', 'Bunny', 0], ['bear', 'Bear', 20], ['dog', 'Dog', 20], ['mouse', 'Mouse', 20],
    ['pig', 'Pig', 20], ['frog', 'Frog', 25], ['fox', 'Fox', 30], ['koala', 'Koala', 30], ['sheep', 'Sheep', 30],
    ['cow', 'Cow', 30], ['monkey', 'Monkey', 35], ['raccoon', 'Raccoon', 35], ['penguin', 'Penguin', 40], ['owl', 'Owl', 40],
    ['panda', 'Panda', 45], ['elephant', 'Elephant', 45], ['tiger', 'Tiger', 50], ['lion', 'Lion', 60],
    ['unicorn', 'Unicorn', 80], ['dragon', 'Dragon', 100]],
  // 'natural' is each animal's own colors (a fox orange, a frog green, a panda black and white).
  color: [['natural', 'Its own colors', 0], ['orange', 'Orange', 0], ['black', 'Black', 0], ['gray', 'Gray', 0],
    ['cream', 'Cream', 0], ['brown', 'Brown', 10], ['white', 'White', 10], ['red', 'Red', 20], ['blue', 'Blue', 20],
    ['teal', 'Teal', 20], ['pink', 'Pink', 20], ['green', 'Green', 20], ['purple', 'Purple', 30], ['silver', 'Silver', 45],
    ['gold', 'Gold', 50], ['rainbow', 'Rainbow', 80], ['galaxy', 'Galaxy', 100]],
  pattern: [['none', 'No pattern', 0], ['stripes', 'Stripes', 15], ['spots', 'Spots', 15], ['patches', 'Patches', 20],
    ['stars', 'Stars', 30], ['hearts', 'Hearts', 30], ['sparkle', 'Sparkle', 50]],
  face: [['smile', 'Smile', 0], ['happy', 'Happy', 0], ['wow', 'Wow', 10], ['wink', 'Wink', 15], ['grin', 'Grin', 15],
    ['cool', 'Cool', 15], ['silly', 'Silly', 15], ['kitty', 'Kitty', 20], ['shy', 'Shy', 20], ['star', 'Star eyes', 30],
    ['love', 'Heart eyes', 35]],
  hat: [['none', 'No hat', 0], ['beanie', 'Beanie', 15], ['bow', 'Bow', 15], ['party', 'Party hat', 20],
    ['flower', 'Flower', 20], ['headphones', 'Headphones', 30], ['cowboy', 'Cowboy hat', 30], ['pirate', 'Pirate hat', 35],
    ['tophat', 'Top hat', 40], ['viking', 'Viking helmet', 45], ['wizard', 'Wizard hat', 50], ['crown', 'Crown', 80],
    ['cheese', 'Cheese hat', 0, T('mouse-catcher')], ['chef', 'Chef\'s hat', 0, T('supper-time')],
    ['nightcap', 'Nightcap', 0, T('bedtime')], ['beret', 'Beret', 0, S('unit-1:5')], ['laurel', 'Laurels', 0, S('unit-1:12')]],
  glasses: [['none', 'No glasses', 0], ['round', 'Round glasses', 12], ['shades', 'Shades', 20], ['hearts', 'Heart glasses', 25],
    ['mask', 'Hero mask', 30], ['stars', 'Star glasses', 30], ['monocle', 'Monocle', 35], ['visor', 'Visor', 40],
    ['reading', 'Reading glasses', 0, S('unit-1:8')]],
  neck: [['none', 'Nothing', 0], ['bowtie', 'Bow tie', 15], ['collar', 'Bell collar', 15], ['scarf', 'Scarf', 20],
    ['bandana', 'Bandana', 20], ['lei', 'Flower lei', 30], ['pearls', 'Pearls', 35],
    ['pine', 'Air freshener', 0, T('litterbox')], ['medal', 'Medal', 0, S('unit-1:1')], ['goldnote', 'Gold note', 0, S('unit-4:8')]],
  shoes: [['none', 'No shoes', 0], ['sneakers', 'Sneakers', 15], ['slippers', 'Bunny slippers', 25], ['boots', 'Boots', 25],
    ['flippers', 'Flippers', 30], ['tap', 'Tap shoes', 35], ['skates', 'Roller skates', 45], ['winged', 'Winged sandals', 0, S('unit-4:5')]],
  hold: [['none', 'Nothing', 0], ['maracas', 'Maracas', 15], ['triangle', 'Triangle', 15], ['sticks', 'Drumsticks', 20],
    ['cowbell', 'Cowbell', 20], ['mic', 'Microphone', 25], ['tambourine', 'Tambourine', 25], ['guiro', 'Guiro', 25],
    ['baton', 'Baton', 30], ['bongos', 'Bongos', 35], ['gong', 'Gong', 35], ['trumpet', 'Trumpet', 40], ['xylophone', 'Xylophone', 40],
    ['harp', 'Harp', 45], ['guitar', 'Ukulele', 50], ['keytar', 'Keytar', 70],
    ['brush', 'Golden brush', 0, T('brushing-time')], ['wand', 'Feather wand', 0, T('petting-time')], ['bell', 'Handbell', 0, S('unit-4:1')]],
  bg: [['plain', 'Plain', 0], ['mint', 'Mint', 0], ['notes', 'Notes', 12], ['rainbow', 'Rainbow', 20], ['beach', 'Beach', 25],
    ['forest', 'Forest', 25], ['stars', 'Starry night', 25], ['stage', 'Stage', 30], ['spotlight', 'Spotlight', 30],
    ['space', 'Space', 40], ['concert', 'Concert', 45], ['disco', 'Disco floor', 0, T('dancing-time')]],
};

export const CATALOG = Object.fromEntries(Object.entries(RAW).map(([slot, list]) => [slot,
  list.map(([id, name, price, unlock]) => ({ id, name, price, ...(unlock ? { unlock } : {}) }))]));
export const DEFAULT_LOOK = Object.fromEntries(Object.entries(CATALOG).map(([slot, list]) => [slot, list[0].id]));

/* What a run pays in notes (main.js), and a groove's price when the Lab gives none. */
const BASE_EARN = { every: 3, clean: 1, boss: 3, bossTry: 1, daily: 2 }; // 1 note every 3 right answers
export const EARN = { ...BASE_EARN };
export const PRICES = { groove: 60 };

/* The catalog in play: CATALOG with the shop editor's changes (applyShop). */
export const ITEMS = structuredClone(CATALOG);

/* A shop editor file ({ items: { slot: [{ id, name?, price?, hidden?, unlock? }] }, earn, groovePrice })
   over the catalog: known items only, each slot in the file's order (any it leaves out after,
   as they were), prices whole notes from 0 to 999. */
export function completeShop(raw = {}) {
  const items = {};
  for (const [slot, list] of Object.entries(CATALOG)) {
    const over = Array.isArray(raw?.items?.[slot]) ? raw.items[slot] : [];
    const seen = new Set();
    const out = [];
    for (const o of over) {
      const base = list.find((x) => x.id === o?.id);
      if (!base || seen.has(base.id)) continue;
      seen.add(base.id);
      out.push(itemOf(base, o, slot));
    }
    for (const base of list) if (!seen.has(base.id)) out.push({ ...base });
    // The default look's item stays first and free.
    const first = out.findIndex((x) => x.id === list[0].id);
    const [def] = out.splice(first, 1);
    out.unshift({ ...def, price: 0, hidden: false, unlock: undefined });
    items[slot] = out.map((x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined && v !== false)));
  }
  const earn = { ...BASE_EARN };
  for (const k of Object.keys(BASE_EARN)) {
    const n = Math.round(Number(raw?.earn?.[k]));
    if (Number.isFinite(n) && n >= (k === 'every' ? 1 : 0) && n <= 50) earn[k] = n;
  }
  const g = Math.round(Number(raw?.groovePrice));
  return { items, earn, groovePrice: Number.isFinite(g) && g >= 0 && g <= 999 ? g : 60 };
}

const UNIT = /^unit-\d+:\d{1,2}$/;
function itemOf(base, o, slot) {
  const out = { ...base };
  if (typeof o.name === 'string' && o.name.trim()) out.name = o.name.trim().slice(0, 40);
  const p = Math.round(Number(o.price));
  if (Number.isFinite(p) && p >= 0 && p <= 999) out.price = p;
  if (o.hidden === true) out.hidden = true;
  if ('unlock' in o) {
    const u = o.unlock;
    if (u && typeof u.boss === 'string' && BOSSES[u.boss]) out.unlock = { boss: u.boss };
    else if (u && typeof u.step === 'string' && UNIT.test(u.step)) out.unlock = { step: u.step };
    else if (u && Number.isInteger(u.level) && u.level >= 2 && u.level <= 50) out.unlock = { level: u.level };
    else out.unlock = undefined;
  }
  if (slot && out.id === CATALOG[slot][0].id) out.unlock = undefined;
  return out;
}

/* Put a shop on the game (completeShop's shape). */
export function applyShop(shop = completeShop()) {
  for (const slot of Object.keys(ITEMS)) ITEMS[slot] = shop.items[slot].map((x) => ({ ...x }));
  Object.assign(EARN, shop.earn);
  PRICES.groove = shop.groovePrice;
}

let loading = null;
/* What the shop editor last published, else the repo's shop.json, else the catalog. */
export function siteShop() {
  const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  loading ||= get('/api/live/shop.json')
    .then(async (live) => (live?.items ? live : (await get(new URL('shop.json', import.meta.url))) || {}))
    .then((raw) => completeShop(raw))
    .catch(() => completeShop());
  return loading;
}

export const itemOfSlot = (slot, id) => ITEMS[slot]?.find((x) => x.id === id) || null;
export const priceOf = (slot, id) => itemOfSlot(slot, id)?.price ?? Infinity;
export const nameOf = (slot, id) => itemOfSlot(slot, id)?.name || CATALOG[slot]?.find((x) => x.id === id)?.name || id;

/* Level from XP (director.js levelOf, without its imports). */
const levelNum = (xp = 0) => {
  let n = 0;
  while (xp >= 150 * (n + 1) * (n + 2) / 2) n++;
  return n + 1;
};
/* Whether a step is mastered ('unit-4:3': do re mi's own progress, st.mel). */
export function stepMastered(st, key) {
  const [unit, n] = String(key).split(':');
  const steps = unit === 'unit-4' ? st.mel?.steps : unit === 'unit-1' ? st.steps : null;
  return !!steps?.[n]?.mastered;
}
/* Whether a won item has been won. */
export function won(st, item) {
  const u = item?.unlock;
  if (!u) return true;
  if (u.boss) return (st.bosses?.[u.boss] || 0) > 0;
  if (u.step) return stepMastered(st, u.step);
  if (u.level) return levelNum(st.xp) >= u.level;
  return false;
}
/* The learner has it: bought, worn before, or free (and won, for a won item). */
export function owns(st, slot, id) {
  const item = itemOfSlot(slot, id);
  if (!item) return false;
  if ((st.owned || []).includes(`${slot}:${id}`)) return true;
  return item.price === 0 && won(st, item);
}
/* It can be bought now: won (or never needed winning), and not had yet. */
export const forSale = (st, item) => won(st, item) && !item.hidden;

/* The saved look, with anything unknown or not owned put back to the default. */
export function lookOf(st) {
  const look = { ...DEFAULT_LOOK };
  for (const slot of Object.keys(ITEMS)) {
    const id = st.look?.[slot];
    if (id && owns(st, slot, id)) look[slot] = id;
  }
  return look;
}
/* A look made only of things the learner has (an outfit saved before, a shuffle). */
export const cleanLook = (st, look) => lookOf({ ...st, look });
/* Keep every item of a look in st.owned, so it stays theirs whatever its price becomes. */
export function keepLook(st, look) {
  const have = new Set(st.owned || []);
  for (const [slot, id] of Object.entries(look)) if (id !== DEFAULT_LOOK[slot] && owns(st, slot, id)) have.add(`${slot}:${id}`);
  st.owned = [...have];
}

/* Prizes won and not announced yet (not in st.gifts): { slot, item, key: 'slot:id' }. main.js
   announces them and adds them to st.fresh; the closet clears each from st.fresh when it's
   tried on. A hidden prize isn't announced, nor one with a price (winning it puts it on sale). */
export function newlyWon(st) {
  const out = [];
  for (const [slot, list] of Object.entries(ITEMS)) {
    for (const item of list) {
      if (!item.unlock || item.hidden) continue;
      const key = `${slot}:${item.id}`;
      if (item.price === 0 && won(st, item) && !(st.gifts || []).includes(key)) out.push({ slot, item, key });
    }
  }
  return out;
}

/* How to get an item, for the collection book: { price } or { boss, name, icon } or
   { step, unit, n } or { level }. */
export function howToGet(item) {
  const u = item.unlock;
  if (u?.boss) return { boss: u.boss, ...BOSSES[u.boss] };
  if (u?.step) {
    const [unit, n] = u.step.split(':');
    return { step: u.step, unit, n: Number(n) };
  }
  if (u?.level) return { level: u.level };
  return { price: item.price };
}

/* Grooves (grooves.json, Kyle's Groove Lab) are bought in the record shop too. The first in
   the list (Basic) is free; any other costs its own price if the Lab gives one, or the shop's.
   A hidden groove (the Lab's "In the shop" off) isn't sold or played, except for anyone who
   bought it. */
export const groovePrice = (g, list) => (g === list[0] || g.id === 'basic' ? 0 : g.price ?? PRICES.groove);
export const ownsGroove = (st, g, list) => (st.owned || []).includes(`groove:${g.id}`) || (!g.hidden && groovePrice(g, list) === 0);
