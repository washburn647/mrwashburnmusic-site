/* The closet: the learner dresses up their avatar (avatar.js) with music notes earned in runs.
   Built for kids who don't read well yet: a tab is an icon, an item is a picture of it, a price
   is the gold note and a number, and 🔊 reads the screen out.
   Three rooms: the Closet (the look, in four groups: Me, Wear, Play, Stage), the Collection
   book (everything there is, what's still to get as a shadow with how to get it) and the
   Record Shop (grooves). Tapping an item tries it on and the avatar reacts; one you have goes
   straight on, one you don't shows its price and a ✓ to buy it (or how far your notes have to
   go), and 🎯 makes it your goal (shown on the title and lap screens). Prizes (shop.js unlock)
   aren't sold: beating a boss or mastering a step wins them, and they come with ✨ until
   they're tried on. Three outfits keep looks to switch between, 🎲 shuffles what you have.
   Leaving without buying keeps the old look.
   In the Record Shop a tap plays two bars of a groove (the avatar dances to it); one you have
   becomes the one that plays (🔀 is Mix: a different one of yours each lap). */

import {
  SLOTS, GROUPS, ITEMS, owns, lookOf, cleanLook, keepLook, avatar, avatarSvg, itemSvg, fitItems, token, groovePrice, ownsGroove, setMood,
} from './avatar.js';
import { itemOfSlot, forSale, won, howToGet } from './shop.js';
import { unitById } from './path.js';
import { CLOSET_SPEECH } from './narration.js';
import * as snd from './sound.js';
import * as FX from './effects.js';

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const svgEl = (cls, markup) => {
  const el = h('span', { class: cls, 'aria-hidden': 'true' });
  el.innerHTML = markup; // fixed markup (avatar.js)
  return el;
};

const price = (n) => h('span', { class: 'price' }, token(), String(n));
const same = (a, b) => SLOTS.every(({ id }) => a[id] === b[id]);
const slotOf = (id) => SLOTS.find((s) => s.id === id);
// A coat hanger, over the outfits.
const HANGER = '<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M24 11 V8 a4 4 0 1 1 4 -4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M24 11 L4 25 Q2 27 5 27 H43 Q46 27 44 25 Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/></svg>';
const BAND = ['bass', 'drums', 'horns', 'band'];
// Slots whose things are shapes: still to get, they show as a shadow in the book.
const SHAPES = new Set(['kind', 'hat', 'glasses', 'neck', 'shoes', 'hold']);

/* The learner's goal: the item or groove they pinned with 🎯, while they don't have it yet. */
export function goalOf(st, grooves = []) {
  const [slot, id] = (st.goal || '').split(':');
  if (!slot || !id) return null;
  if (slot === 'groove') {
    const g = grooves.find((x) => x.id === id);
    if (!g || ownsGroove(st, g, grooves)) return null;
    return { slot, id, name: g.name, cost: groovePrice(g, grooves), groove: g };
  }
  const item = itemOfSlot(slot, id);
  if (!item || owns(st, slot, id) || !forSale(st, item)) return null;
  return { slot, id, name: item.name, cost: item.price };
}

/* A goal's picture: the item by itself (call fitItems once it's on the page), or a groove's band. */
function goalArt(st, goal) {
  if (goal.slot === 'groove') return h('span', { class: 'goal-art gr', 'aria-hidden': 'true' }, '🎵');
  return svgEl('goal-art', itemSvg(goal.slot, goal.id, lookOf(st)));
}

/* The goal as a chip: its picture, a bar of notes toward it, and how many there are. For the
   title (opens the closet) and the lap screen. from: notes to show it starting at (the lap
   screen counts up from there). */
export function goalChip(st, grooves, { onclick, from } = {}) {
  const goal = goalOf(st, grooves);
  if (!goal) return null;
  const have = Math.min(st.tokens, goal.cost);
  const ready = st.tokens >= goal.cost;
  const fill = h('span', { style: `width:${Math.round(100 * Math.min(from ?? have, goal.cost) / Math.max(1, goal.cost))}%` });
  const chip = h(onclick ? 'button' : 'div', {
    class: `goal-chip ${ready ? 'ready' : ''}`,
    'aria-label': ready ? `Goal: ${goal.name}. You have enough notes!` : `Goal: ${goal.name}. ${have} of ${goal.cost} notes`,
    onclick,
  },
  h('span', { class: 'goal-ic', 'aria-hidden': 'true' }, '🎯'),
  goalArt(st, goal),
  h('span', { class: 'xpbar' }, fill),
  h('b', {}, ready ? '✓' : `${have}/${goal.cost}`));
  if (from != null && from < have) requestAnimationFrame(() => setTimeout(() => { fill.style.width = `${Math.round(100 * have / goal.cost)}%`; }, 300));
  requestAnimationFrame(() => fitItems(chip));
  return chip;
}

/* How a prize is won: a badge for its tile, an icon and words for the bar. */
export function howOf(item) {
  const how = howToGet(item);
  if (how.boss) return { badge: how.icon, icon: `🏆${how.icon}`, text: `Beat ${how.name}` };
  if (how.step) {
    const u = unitById(how.unit);
    return { badge: `★${how.n}`, icon: `${u?.icon || ''}★`, text: `Master ${u?.name || 'a unit'}, step ${how.n}` };
  }
  if (how.level) return { badge: `⭐${how.level}`, icon: '⭐', text: `Reach level ${how.level}` };
  return null;
}

// What each kind of try-on sounds like, and how the avatar takes it (a mood, for how long).
const TRY_SOUND = {
  kind: 'boing', color: 'swish', pattern: 'swish', face: 'wah', hat: 'pop', glasses: 'clink', neck: 'pop', shoes: 'step-1',
  hold: 'tin', bg: 'swish', all: 'sproing', prize: 'twinkle',
};
const REACT = {
  kind: ['wow', 1100], color: ['happy', 1500], pattern: ['happy', 1500], face: ['happy', 1500], hat: ['happy', 1500],
  glasses: ['wow', 1100], neck: ['happy', 1500], shoes: ['dance', 2400], hold: ['play', 2400], bg: ['happy', 1500],
  all: ['cheer', 1300], prize: ['wow', 1100], groove: ['dance', 4400],
};

export function closet(app, st, { save, back, grooves = () => [] }) {
  st.owned ||= [];
  st.tokens ||= 0;
  st.fresh ||= [];
  st.outfits = [0, 1, 2].map((i) => st.outfits?.[i] || null);
  let look = lookOf(st);
  let room = 'closet';
  let group = 'me';
  let slot = 'kind';
  let trying = null; // [slot, id, price] of an item tried on but not bought
  let react = null; // what the avatar reacts to on the next draw (REACT)
  const isFresh = (s, id) => st.fresh.includes(`${s}:${id}`);
  // A prize just won: open on it.
  const first = st.fresh.map((k) => k.split(':')).find(([s, id]) => itemOfSlot(s, id));
  if (first) [slot, group] = [first[0], slotOf(first[0]).group];
  try { snd.ac(); snd.load(); } catch { /* no sound */ }
  const sound = (fn) => { try { fn(snd.ac().currentTime); } catch { /* no sound */ } };

  /* Two bars of a groove, the whole band, so it can be heard before it's bought. */
  let demo = null;
  function hushDemo() {
    if (!demo) return;
    const { gain, ctx } = demo;
    demo = null;
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    setTimeout(() => gain.disconnect(), 300);
  }
  async function playDemo(g) {
    hushDemo();
    try {
      const ctx = snd.ac();
      const mine = (demo = { gain: ctx.createGain(), ctx });
      mine.gain.connect(ctx.destination);
      await snd.load();
      if (demo !== mine) return;
      const v = Object.values(g.versions)[0];
      const spb = 60 / 108;
      const t0 = ctx.currentTime + 0.08;
      const beats = Math.min(v.beats, 8);
      for (let i = 0; i < beats; i++) snd.playGrooveBeat(v, i, t0 + i * spb, spb, { layers: snd.LAYERS, level: 0.9, dest: mine.gain });
      mine.gain.gain.setTargetAtTime(0, t0 + beats * spb, 0.15);
    } catch { /* no sound */ }
  }

  const wallet = h('div', { class: 'wallet', 'aria-label': `${st.tokens} music notes` });
  const rooms = h('div', { class: 'cl-rooms', role: 'tablist' });
  const stage = h('div', { class: 'cl-stage' });
  const outfits = h('div', { class: 'cl-outfits' });
  const groups = h('div', { class: 'cl-groups', role: 'tablist' });
  const tabs = h('div', { class: 'cl-tabs', role: 'tablist' });
  const grid = h('div', { class: 'cl-grid' });
  const scroll = h('div', { class: 'cl-scroll' }, grid);
  const bar = h('div', { class: 'cl-bar' });

  const isGoal = (s, id) => st.goal === `${s}:${id}`;

  function draw() {
    wallet.replaceChildren(token('big'), h('b', {}, String(st.tokens)));
    wallet.setAttribute('aria-label', `${st.tokens} music notes`);
    rooms.replaceChildren(...[['closet', '👕', 'Closet'], ['book', '📖', 'Collection'], ['records', '💿', 'Record shop']].map(([id, icon, name]) => h('button', {
      class: `cl-room ${room === id ? 'on' : ''}`, role: 'tab', 'aria-selected': String(room === id), 'aria-label': name,
      onclick: () => { if (room === id) return; room = id; trying = null; hushDemo(); draw(); },
    }, icon)));
    const shown = trying && trying[0] !== 'groove' ? { ...look, [trying[0]]: trying[1] } : look;
    const av = avatar(shown, { cls: 'big' });
    if (react) {
      const [mood, ms] = REACT[react] || REACT.all;
      setMood(av, mood, { for: ms, beat: react === 'groove' ? 60 / 108 : undefined });
    }
    react = null;
    stage.replaceChildren(av);
    if (room === 'closet') stage.append(h('button', { class: 'cl-shuffle', 'aria-label': 'Shuffle', onclick: shuffle }, '🎲'));
    if (room !== 'closet') {
      outfits.replaceChildren();
      groups.replaceChildren();
      tabs.replaceChildren();
      if (room === 'records') {
        scroll.replaceChildren(grid);
        drawGrooves();
      } else drawBook();
      drawBar();
      return;
    }
    scroll.replaceChildren(grid);
    drawOutfits();
    const freshIn = (slots) => st.fresh.some((k) => slots.includes(k.split(':')[0]));
    groups.replaceChildren(...GROUPS.map((g) => h('button', {
      class: `cl-group ${g.id === group ? 'on' : ''}`, role: 'tab', 'aria-selected': String(g.id === group), 'aria-label': g.name,
      onclick: () => { if (group === g.id) return; group = g.id; slot = SLOTS.find((s) => s.group === g.id).id; trying = null; draw(); },
    }, g.icon, freshIn(SLOTS.filter((s) => s.group === g.id).map((s) => s.id)) ? h('i', { class: 'new-dot', 'aria-hidden': 'true' }) : null)));
    const inGroup = SLOTS.filter((s) => s.group === group);
    tabs.replaceChildren(...(inGroup.length < 2 ? [] : inGroup.map((s) => h('button', {
      class: `cl-tab ${s.id === slot ? 'on' : ''}`, role: 'tab', 'aria-selected': String(s.id === slot), 'aria-label': s.name,
      onclick: () => { slot = s.id; trying = null; draw(); },
    }, s.icon, freshIn([s.id]) ? h('i', { class: 'new-dot', 'aria-hidden': 'true' }) : null))));
    // What you have first, then what's for sale by price, then prizes still to win. Hidden
    // things only show to someone who has them.
    const list = ITEMS[slot].map((item, i) => {
      const mine = owns(st, slot, item.id);
      return { item, i, mine, prize: !mine && !won(st, item) };
    }).filter((x) => x.mine || !x.item.hidden)
      .sort((a, b) => (b.mine - a.mine) || (a.prize - b.prize) || (a.item.price - b.item.price) || (a.i - b.i));
    grid.replaceChildren(...list.map(({ item, mine, prize }) => {
      const { id } = item;
      const on = look[slot] === id && !trying;
      const tried = trying?.[0] === slot && trying[1] === id;
      const can = !mine && !prize && st.tokens >= item.price;
      const how = prize ? howOf(item) : null;
      return h('button', {
        class: `cl-item cl-${slot} ${on ? 'on' : ''} ${tried ? 'tried' : ''} ${mine ? 'mine' : prize ? 'prize' : can ? 'can' : 'locked'}`,
        'aria-label': `${item.name}${mine ? '' : prize ? `, prize: ${how.text}` : `, ${item.price} notes`}`,
        onclick: (e) => pick(item, e.currentTarget),
      },
      svgEl('art', itemSvg(slot, id, look)),
      on ? h('span', { class: 'tick' }, '✓') : null,
      mine && isFresh(slot, id) ? h('span', { class: 'fresh', 'aria-hidden': 'true' }, '✨') : null,
      isGoal(slot, id) && !mine ? h('span', { class: 'goal-pin', 'aria-hidden': 'true' }, '🎯') : null,
      prize ? h('span', { class: 'prize-tag', 'aria-hidden': 'true' }, how.badge) : mine ? null : price(item.price),
      !mine && !prize && !can ? h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒') : null);
    }));
    fitItems(grid);
    drawBar();
  }

  /* The collection book: every slot's things (not "none"), what you have in color, the rest as
     shadows with how to get them (a price, a boss, a step). A tap goes to it in the closet. */
  function drawBook() {
    let got = 0;
    let all = 0;
    const secs = SLOTS.map((s) => {
      const items = ITEMS[s.id].filter((it) => it.id !== 'none' && (!it.hidden || owns(st, s.id, it.id)));
      const have = items.filter((it) => owns(st, s.id, it.id)).length;
      got += have;
      all += items.length;
      return h('section', { class: 'bk-sec' },
        h('h3', { class: 'bk-head' }, h('span', { class: 'bk-ic', 'aria-hidden': 'true' }, s.icon), h('span', {}, s.name), h('small', {}, `${have}/${items.length}`)),
        h('div', { class: 'bk-grid' }, ...items.map((it) => bookTile(s.id, it))));
    });
    scroll.replaceChildren(h('div', { class: 'book' },
      h('div', { class: 'bk-top', 'aria-label': `${got} of ${all} collected` },
        h('span', { class: 'bk-ic', 'aria-hidden': 'true' }, '📖'),
        h('span', { class: 'xpbar' }, h('span', { style: `width:${Math.round(100 * got / Math.max(1, all))}%` })),
        h('b', {}, `${got}/${all}`)),
      ...secs));
    fitItems(scroll);
  }
  function bookTile(s, item) {
    const mine = owns(st, s, item.id);
    const how = !mine && !won(st, item) ? howOf(item) : null;
    return h('button', {
      class: `bk-item cl-${s} ${mine ? 'mine' : 'todo'} ${SHAPES.has(s) ? 'shape' : ''} ${how ? 'prize' : ''}`,
      'aria-label': `${item.name}${mine ? '' : how ? `, prize: ${how.text}` : `, ${item.price} notes`}`,
      onclick: () => {
        room = 'closet';
        slot = s;
        group = slotOf(s).group;
        pick(item, null);
      },
    },
    svgEl('art', itemSvg(s, item.id, look)),
    mine && isFresh(s, item.id) ? h('span', { class: 'fresh', 'aria-hidden': 'true' }, '✨') : null,
    mine ? null : how ? h('span', { class: 'prize-tag', 'aria-hidden': 'true' }, how.badge) : price(item.price));
  }

  /* Three outfits, numbered, under a hanger. An empty one (a hanger and +) keeps the look you
     have on; a kept one puts its look back on (the one you're wearing has a ✓); 📸 on a kept
     one snaps the look you have on over it. The same look is never kept twice. Until the
     first one is kept, the first empty one pulses with a finger pointing at it. */
  function drawOutfits() {
    const kept = st.outfits.map((o) => o && cleanLook(st, o));
    const wornAt = trying ? -1 : kept.findIndex((k) => k && same(k, look));
    const savedAt = kept.findIndex((k) => k && same(k, look));
    const firstEmpty = kept.findIndex((k) => !k);
    const hint = !st.tips?.outfits && kept.every((k) => !k);
    outfits.replaceChildren(
      svgEl('cl-hanger', HANGER),
      ...kept.map((k, i) => h('div', { class: `cl-outfit ${i === wornAt ? 'on' : ''} ${k ? '' : 'empty'} ${hint && i === firstEmpty ? 'hint' : ''}` },
        h('button', {
          class: 'cl-outfit-wear',
          'aria-label': k ? `Outfit ${i + 1}${i === wornAt ? ', wearing it' : ''}` : `Keep this look as outfit ${i + 1}`,
          onclick: () => (k ? wearOutfit(k) : keepOutfit(i)),
        }, k ? svgEl('art', avatarSvg(k, { view: '6 -6 188 156', bg: true })) : svgEl('art empty-art', HANGER)),
        h('span', { class: 'cl-outfit-n', 'aria-hidden': 'true' }, String(i + 1)),
        k ? null : h('span', { class: 'cl-outfit-plus', 'aria-hidden': 'true' }, '+'),
        i === wornAt ? h('span', { class: 'cl-outfit-tick', 'aria-hidden': 'true' }, '✓') : null,
        k && i !== wornAt && savedAt < 0 ? h('button', { class: 'cl-outfit-keep', 'aria-label': `Snap this look into outfit ${i + 1}`, onclick: () => keepOutfit(i) }, '📸') : null,
        hint && i === firstEmpty ? h('span', { class: 'cl-outfit-finger', 'aria-hidden': 'true' }, '👉') : null)));
  }
  function keepOutfit(i) {
    // Already kept: point at it instead of keeping it twice.
    const at = st.outfits.findIndex((o) => o && same(cleanLook(st, o), look));
    if (at >= 0 && at !== i) {
      FX.bump(outfits.querySelectorAll('.cl-outfit')[at], 'fx-got');
      sound((t) => snd.toon('squeak', t));
      return;
    }
    st.outfits[i] = { ...look };
    st.tips = { ...st.tips, outfits: 1 };
    save();
    sound((t) => { snd.toon('clink', t); snd.toon('pop', t + 0.08); });
    react = 'all';
    draw();
    const el = outfits.querySelectorAll('.cl-outfit')[i];
    FX.bump(el, 'fx-snap');
  }
  /* Put a whole look on (an outfit, a shuffle). */
  function wearLook(next) {
    look = { ...next };
    st.look = { ...look };
    st.fresh = st.fresh.filter((k) => { const [s, id] = k.split(':'); return look[s] !== id; });
    keepLook(st, look);
    trying = null;
    react = 'all';
    save();
    sound((t) => snd.toon(TRY_SOUND.all, t));
    draw();
  }
  const wearOutfit = (o) => wearLook(o);
  function shuffle() {
    const pickOne = (s) => {
      const mine = ITEMS[s].filter((x) => owns(st, s, x.id)).map((x) => x.id);
      return mine[Math.floor(Math.random() * mine.length)];
    };
    wearLook(Object.fromEntries(SLOTS.map(({ id }) => [id, pickOne(id)])));
  }

  /* Grooves as tiles: the band's icons and the groove's name. */
  function drawGrooves() {
    const list = grooves();
    const tile = (id, name, icons, cost, mine, g) => {
      const on = (st.groove || 'mix') === id && !trying;
      const tried = trying?.[0] === 'groove' && trying[1] === id;
      const can = !mine && st.tokens >= cost;
      return h('button', {
        class: `cl-item cl-groove ${on ? 'on' : ''} ${tried ? 'tried' : ''} ${mine ? 'mine' : can ? 'can' : 'locked'}`,
        'aria-label': `${name}${mine ? '' : `, ${cost} notes`}`,
        onclick: (e) => {
          if (g) playDemo(g); else hushDemo();
          if (mine) { st.groove = id; trying = null; save(); } else {
            trying = ['groove', id, cost];
            if (st.tokens < cost) FX.bump(e.currentTarget, 'fx-no');
          }
          react = g ? 'groove' : 'all';
          draw();
        },
      },
      h('span', { class: 'gr-art', 'aria-hidden': 'true' }, ...icons.map((ic) => h('i', {}, ic))),
      h('b', { class: 'gr-name' }, name),
      on ? h('span', { class: 'tick' }, '✓') : null,
      isGoal('groove', id) && !mine ? h('span', { class: 'goal-pin', 'aria-hidden': 'true' }, '🎯') : null,
      mine ? null : price(cost),
      !mine && !can ? h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒') : null);
    };
    const tiles = list.filter((g) => !g.hidden || ownsGroove(st, g, list))
      .map((g) => ({ g, cost: groovePrice(g, list), mine: ownsGroove(st, g, list) }))
      .sort((a, b) => (b.mine - a.mine) || (a.cost - b.cost));
    grid.replaceChildren(
      tile('mix', 'Mix', ['🔀'], 0, true, null),
      ...tiles.map(({ g, cost, mine }) => tile(g.id, g.name, BAND.map((l) => snd.layerInfo(g, l).icon), cost, mine, g)));
  }

  function drawBar() {
    bar.className = 'cl-bar';
    if (!trying) { bar.replaceChildren(); return; }
    const [s, id, cost] = trying;
    const no = h('button', { class: 'cl-no', 'aria-label': 'Not now', onclick: () => { trying = null; draw(); } }, '✕');
    // A prize: how to win it.
    const item = s === 'groove' ? null : itemOfSlot(s, id);
    if (item && !won(st, item)) {
      const how = howOf(item);
      bar.classList.add('show', 'how');
      bar.replaceChildren(no, h('div', { class: 'cl-how' }, h('span', { class: 'how-ic', 'aria-hidden': 'true' }, how.icon), h('b', {}, how.text)));
      return;
    }
    const goal = h('button', {
      class: `cl-goal ${isGoal(s, id) ? 'on' : ''}`,
      'aria-label': isGoal(s, id) ? 'My goal' : 'Make it my goal',
      'aria-pressed': String(isGoal(s, id)),
      onclick: (e) => {
        st.goal = isGoal(s, id) ? null : `${s}:${id}`;
        save();
        if (st.goal) { sound((t) => snd.toon('pop', t)); FX.burst(e.currentTarget, { y: 0.5, count: 12, spread: 1 }); }
        draw();
      },
    }, '🎯');
    if (st.tokens >= cost) {
      bar.classList.add('show');
      bar.replaceChildren(no,
        h('button', { class: 'cl-buy', 'aria-label': `Get it for ${cost} notes`, onclick: buy }, price(cost), h('span', { class: 'ok' }, '✓')));
    } else {
      // Not enough yet: how far the notes have to go, and 🎯 to save up for it.
      bar.classList.add('show', 'short');
      bar.replaceChildren(no,
        h('div', { class: 'cl-need', 'aria-label': `${st.tokens} of ${cost} notes` },
          token(), h('span', { class: 'xpbar' }, h('span', { style: `width:${Math.round(100 * st.tokens / cost)}%` })),
          h('b', {}, `${st.tokens}/${cost}`)),
        goal);
    }
  }

  function pick(item, el) {
    const { id } = item;
    react = slot;
    if (owns(st, slot, id)) {
      look[slot] = id;
      st.look = { ...look };
      st.fresh = st.fresh.filter((k) => k !== `${slot}:${id}`);
      keepLook(st, look);
      trying = null;
      save();
      sound((t) => snd.toon(TRY_SOUND[slot] || 'pop', t));
      draw();
      return;
    }
    trying = [slot, id, item.price];
    if (!won(st, item)) { react = 'prize'; sound((t) => snd.toon(TRY_SOUND.prize, t)); } else if (st.tokens < item.price) {
      if (el) FX.bump(el, 'fx-no');
      sound((t) => snd.toon('squeak', t));
    } else sound((t) => snd.toon(TRY_SOUND[slot] || 'sproing', t));
    draw();
  }

  function buy() {
    const [s, id, cost] = trying;
    if (st.tokens < cost) return;
    st.tokens -= cost;
    st.owned = [...new Set([...st.owned, `${s}:${id}`])];
    if (isGoal(s, id)) st.goal = null;
    if (s === 'groove') st.groove = id;
    else {
      look[s] = id;
      st.look = { ...look };
      keepLook(st, look);
    }
    trying = null;
    react = s === 'groove' ? 'groove' : 'all';
    save();
    sound((t) => snd.fx.win(t));
    draw();
    FX.burst(stage, { kind: 'notes', y: 0.4, count: 26, spread: 1.4 });
    FX.burst(stage, { y: 0.3, count: 24, spread: 1.6 });
  }

  app.replaceChildren(h('div', { class: 'closet' },
    h('header', { class: 'cl-head' },
      h('button', { class: 'back', 'aria-label': 'Back', onclick: () => { snd.hush(); hushDemo(); back(); } }, '‹'),
      h('button', { class: 'speak', 'aria-label': 'Read it to me', onclick: () => snd.narrate('closet', CLOSET_SPEECH) }, '🔊'),
      rooms,
      wallet),
    h('div', { class: 'cl-show' }, outfits, stage), groups, tabs, scroll, bar));
  draw();
  snd.loadGrooves().then(() => { if (room === 'records' && grid.isConnected) draw(); });
}
