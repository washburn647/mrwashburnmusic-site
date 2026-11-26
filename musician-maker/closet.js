/* The closet: the learner dresses up their avatar (avatar.js) with music notes earned in runs.
   Built for kids who don't read well yet: a tab is an icon, an item is a picture of it, a price
   is the gold note and a number, and 🔊 reads the screen out.
   Two rooms: the Closet (the look, in three groups: Me, Wear, Stage) and the Record Shop
   (grooves). Tapping an item tries it on and the avatar reacts; one you have goes straight on,
   one you don't shows its price and a ✓ to buy it (or how far your notes have to go), and 🎯
   makes it your goal (shown on the title and lap screens). Three outfits keep looks to switch
   between, 🎲 shuffles what you have. Leaving without buying keeps the old look.
   In the Record Shop a tap plays two bars of a groove; one you have becomes the one that plays
   (🔀 is Mix: a different one of yours each lap). */

import {
  SLOTS, GROUPS, ITEMS, owns, lookOf, cleanLook, avatar, avatarSvg, itemSvg, fitItems, token, groovePrice, ownsGroove,
} from './avatar.js';
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
const BAND = ['bass', 'drums', 'horns', 'band'];

/* The learner's goal: the item or groove they pinned with 🎯, while they don't have it yet. */
export function goalOf(st, grooves = []) {
  const [slot, id] = (st.goal || '').split(':');
  if (!slot || !id) return null;
  if (slot === 'groove') {
    const g = grooves.find((x) => x.id === id);
    if (!g || ownsGroove(st, g, grooves)) return null;
    return { slot, id, name: g.name, cost: groovePrice(g, grooves), groove: g };
  }
  const item = ITEMS[slot]?.find(([i]) => i === id);
  if (!item || owns(st, slot, id)) return null;
  return { slot, id, name: id, cost: item[1] };
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
  const fill = h('span', { style: `width:${Math.round(100 * Math.min(from ?? have, goal.cost) / goal.cost)}%` });
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

// What each kind of try-on sounds like.
const TRY_SOUND = { kind: 'boing', color: 'swish', face: 'wah', hat: 'pop', glasses: 'clink', hold: 'tin', bg: 'swish', all: 'sproing' };

export function closet(app, st, { save, back, grooves = () => [] }) {
  st.owned ||= [];
  st.tokens ||= 0;
  st.outfits = [0, 1, 2].map((i) => st.outfits?.[i] || null);
  let look = lookOf(st);
  let room = 'closet';
  let group = 'me';
  let slot = 'kind';
  let trying = null; // [slot, id, price] of an item tried on but not bought
  let react = null; // the slot the avatar reacts to on the next draw
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
  const bar = h('div', { class: 'cl-bar' });

  const isGoal = (s, id) => st.goal === `${s}:${id}`;

  function draw() {
    wallet.replaceChildren(token('big'), h('b', {}, String(st.tokens)));
    wallet.setAttribute('aria-label', `${st.tokens} music notes`);
    rooms.replaceChildren(...[['closet', '👕'], ['records', '💿']].map(([id, icon]) => h('button', {
      class: `cl-room ${room === id ? 'on' : ''}`, role: 'tab', 'aria-selected': String(room === id), 'aria-label': id === 'closet' ? 'Closet' : 'Record shop',
      onclick: () => { if (room === id) return; room = id; trying = null; hushDemo(); draw(); },
    }, icon)));
    const shown = trying && trying[0] !== 'groove' ? { ...look, [trying[0]]: trying[1] } : look;
    const av = avatar(shown, { cls: `big ${react ? `react-${react}` : ''}` });
    react = null;
    stage.replaceChildren(av);
    if (room === 'closet') stage.append(h('button', { class: 'cl-shuffle', 'aria-label': 'Shuffle', onclick: shuffle }, '🎲'));
    if (room === 'records') {
      outfits.replaceChildren();
      groups.replaceChildren();
      tabs.replaceChildren();
      drawGrooves();
      drawBar();
      return;
    }
    drawOutfits();
    groups.replaceChildren(...GROUPS.map((g) => h('button', {
      class: `cl-group ${g.id === group ? 'on' : ''}`, role: 'tab', 'aria-selected': String(g.id === group), 'aria-label': g.id,
      onclick: () => { if (group === g.id) return; group = g.id; slot = SLOTS.find((s) => s.group === g.id).id; trying = null; draw(); },
    }, g.icon)));
    const inGroup = SLOTS.filter((s) => s.group === group);
    tabs.replaceChildren(...(inGroup.length < 2 ? [] : inGroup.map((s) => h('button', {
      class: `cl-tab ${s.id === slot ? 'on' : ''}`, role: 'tab', 'aria-selected': String(s.id === slot), 'aria-label': s.id,
      onclick: () => { slot = s.id; trying = null; draw(); },
    }, s.icon))));
    // What you have first, then by price.
    const list = ITEMS[slot].map(([id, cost], i) => ({ id, cost, i, mine: owns(st, slot, id) }))
      .sort((a, b) => (b.mine - a.mine) || (a.cost - b.cost) || (a.i - b.i));
    grid.replaceChildren(...list.map(({ id, cost, mine }) => {
      const on = look[slot] === id && !trying;
      const tried = trying?.[0] === slot && trying[1] === id;
      const can = !mine && st.tokens >= cost;
      return h('button', {
        class: `cl-item ${on ? 'on' : ''} ${tried ? 'tried' : ''} ${mine ? 'mine' : can ? 'can' : 'locked'} cl-${slot}`,
        'aria-label': `${id}${mine ? '' : `, ${cost} notes`}`,
        onclick: (e) => pick(id, cost, e.currentTarget),
      },
      svgEl('art', itemSvg(slot, id, look)),
      on ? h('span', { class: 'tick' }, '✓') : null,
      isGoal(slot, id) && !mine ? h('span', { class: 'goal-pin', 'aria-hidden': 'true' }, '🎯') : null,
      mine ? null : price(cost),
      !mine && !can ? h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒') : null);
    }));
    fitItems(grid);
    drawBar();
  }

  /* Three outfits: tap an empty one to keep the look, a kept one to put it on, ⤓ to keep the
     look over it. */
  function drawOutfits() {
    const same = (a, b) => Object.keys(ITEMS).every((s) => a[s] === b[s]);
    outfits.replaceChildren(...st.outfits.map((o, i) => {
      const kept = o && cleanLook(st, o);
      const wearing = kept && same(kept, look) && !trying;
      return h('div', { class: `cl-outfit ${wearing ? 'on' : ''} ${kept ? '' : 'empty'}` },
        h('button', {
          class: 'cl-outfit-wear',
          'aria-label': kept ? `Outfit ${i + 1}` : `Keep this look as outfit ${i + 1}`,
          onclick: () => (kept ? wearOutfit(kept) : keepOutfit(i)),
        }, kept ? svgEl('art', avatarSvg(kept, { view: '6 -6 188 156', bg: true })) : h('span', { class: 'plus', 'aria-hidden': 'true' }, '+')),
        kept && !wearing ? h('button', { class: 'cl-outfit-keep', 'aria-label': `Keep this look as outfit ${i + 1}`, onclick: () => keepOutfit(i) }, '⤓') : null);
    }));
  }
  function keepOutfit(i) {
    st.outfits[i] = { ...look };
    save();
    sound((t) => snd.toon('pop', t));
    draw();
    FX.bump(outfits.children[i], 'fx-got');
  }
  function wearOutfit(o) {
    look = { ...o };
    st.look = { ...look };
    trying = null;
    react = 'all';
    save();
    sound((t) => snd.toon(TRY_SOUND.all, t));
    draw();
  }
  function shuffle() {
    const pickOne = (s) => {
      const mine = ITEMS[s].filter(([id]) => owns(st, s, id)).map(([id]) => id);
      return mine[Math.floor(Math.random() * mine.length)];
    };
    look = Object.fromEntries(Object.keys(ITEMS).map((s) => [s, pickOne(s)]));
    st.look = { ...look };
    trying = null;
    react = 'all';
    save();
    sound((t) => snd.toon(TRY_SOUND.all, t));
    draw();
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
          react = 'groove';
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
    const tiles = list.map((g) => ({ g, cost: groovePrice(g, list), mine: ownsGroove(st, g, list) }))
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

  function pick(id, cost, el) {
    react = slot;
    if (owns(st, slot, id)) {
      look[slot] = id;
      st.look = { ...look };
      trying = null;
      save();
      sound((t) => snd.toon(TRY_SOUND[slot] || 'pop', t));
      draw();
      return;
    }
    trying = [slot, id, cost];
    if (st.tokens < cost) { FX.bump(el, 'fx-no'); sound((t) => snd.toon('squeak', t)); } else sound((t) => snd.toon(TRY_SOUND[slot] || 'sproing', t));
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
    }
    trying = null;
    react = 'all';
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
    h('div', { class: 'cl-show' }, outfits, stage), groups, tabs, h('div', { class: 'cl-scroll' }, grid), bar));
  draw();
  snd.loadGrooves().then(() => { if (room === 'records' && grid.isConnected) draw(); });
}
