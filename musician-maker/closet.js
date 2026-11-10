/* The closet: the learner dresses up their avatar (avatar.js) with music notes earned in runs.
   Built for kids who don't read well yet: a tab is an icon, an item is a picture of it on the
   avatar, a price is the gold note and a number, and 🔊 reads the screen out. Tapping an item
   tries it on; one you have goes straight on, one you don't shows its price and a ✓ to buy it
   (or how far your notes have to go). Leaving without buying keeps the old look.
   The 🎵 tab sells grooves the same way: a tap plays two bars of one, a groove you have becomes
   the one that plays (🔀 is Mix: a different one of yours each lap). */

import { SLOTS, ITEMS, owns, lookOf, avatar, token, TILE_VIEW, groovePrice, ownsGroove } from './avatar.js';
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

const price = (n) => h('span', { class: 'price' }, token(), String(n));

export function closet(app, st, { save, back, grooves = () => [] }) {
  st.owned ||= [];
  st.tokens ||= 0;
  let look = lookOf(st);
  let slot = 'hat';
  let trying = null; // [slot, id, price] of an item tried on but not bought
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
  const stage = h('div', { class: 'cl-stage' });
  const tabs = h('div', { class: 'cl-tabs', role: 'tablist' });
  const grid = h('div', { class: 'cl-grid' });
  const bar = h('div', { class: 'cl-bar' });

  function draw() {
    wallet.replaceChildren(token('big'), h('b', {}, String(st.tokens)));
    wallet.setAttribute('aria-label', `${st.tokens} music notes`);
    const shown = trying && trying[0] !== 'groove' ? { ...look, [trying[0]]: trying[1] } : look;
    stage.replaceChildren(avatar(shown, { cls: 'big' }));
    tabs.replaceChildren(...[...SLOTS, { id: 'groove', icon: '🎵' }].map((s) => h('button', {
      class: `cl-tab ${s.id === slot ? 'on' : ''}`, role: 'tab', 'aria-selected': String(s.id === slot), 'aria-label': s.id,
      onclick: () => { slot = s.id; trying = null; hushDemo(); draw(); },
    }, s.icon)));
    if (slot === 'groove') { drawGrooves(); drawBar(); return; }
    grid.replaceChildren(...ITEMS[slot].map(([id, cost]) => {
      const mine = owns(st, slot, id);
      const on = look[slot] === id && !trying;
      const tried = trying?.[0] === slot && trying[1] === id;
      const can = !mine && st.tokens >= cost;
      return h('button', {
        class: `cl-item ${on ? 'on' : ''} ${tried ? 'tried' : ''} ${mine ? 'mine' : can ? 'can' : 'locked'}`,
        'aria-label': `${id}${mine ? '' : `, ${cost} notes`}`,
        onclick: (e) => pick(id, cost, e.currentTarget),
      },
      avatar({ ...look, [slot]: id }, { view: TILE_VIEW[slot], bg: slot === 'bg' }),
      on ? h('span', { class: 'tick' }, '✓') : null,
      mine ? null : price(cost),
      !mine && !can ? h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒') : null);
    }));
    drawBar();
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
          draw();
        },
      },
      h('span', { class: 'gr-art avatar', 'aria-hidden': 'true' }, ...icons.map((ic) => h('i', {}, ic))),
      h('b', { class: 'gr-name' }, name),
      on ? h('span', { class: 'tick' }, '✓') : null,
      mine ? null : price(cost),
      !mine && !can ? h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒') : null);
    };
    grid.replaceChildren(
      tile('mix', 'Mix', ['🔀'], 0, true, null),
      ...list.map((g) => tile(g.id, g.name, ['bass', 'drums', 'horns', 'band'].map((l) => snd.layerInfo(g, l).icon),
        groovePrice(g, list), ownsGroove(st, g, list), g)));
  }

  function drawBar() {
    bar.className = 'cl-bar';
    if (!trying) { bar.replaceChildren(); return; }
    const [, , cost] = trying;
    if (st.tokens >= cost) {
      bar.classList.add('show');
      bar.replaceChildren(
        h('button', { class: 'cl-no', 'aria-label': 'Not now', onclick: () => { trying = null; draw(); } }, '✕'),
        h('button', { class: 'cl-buy', 'aria-label': `Get it for ${cost} notes`, onclick: buy }, price(cost), h('span', { class: 'ok' }, '✓')));
    } else {
      // Not enough yet: how far the notes have to go, and Play to earn more.
      bar.classList.add('show', 'short');
      bar.replaceChildren(
        h('button', { class: 'cl-no', 'aria-label': 'Not now', onclick: () => { trying = null; draw(); } }, '✕'),
        h('div', { class: 'cl-need', 'aria-label': `${st.tokens} of ${cost} notes` },
          token(), h('span', { class: 'xpbar' }, h('span', { style: `width:${Math.round(100 * st.tokens / cost)}%` })),
          h('b', {}, `${st.tokens}/${cost}`)),
        h('span', { class: 'cl-earn', 'aria-hidden': 'true' }, '▶ 🎵'));
    }
  }

  function pick(id, cost, el) {
    if (owns(st, slot, id)) {
      look[slot] = id;
      st.look = { ...look };
      trying = null;
      save();
      sound((t) => snd.toon('pop', t));
      draw();
      return;
    }
    trying = [slot, id, cost];
    if (st.tokens < cost) { FX.bump(el, 'fx-no'); sound((t) => snd.toon('squeak', t)); } else sound((t) => snd.toon('sproing', t));
    draw();
  }

  function buy() {
    const [s, id, cost] = trying;
    if (st.tokens < cost) return;
    st.tokens -= cost;
    st.owned = [...new Set([...st.owned, `${s}:${id}`])];
    if (s === 'groove') st.groove = id;
    else {
      look[s] = id;
      st.look = { ...look };
    }
    trying = null;
    save();
    sound((t) => snd.fx.win(t));
    draw();
    FX.burst(stage, { kind: 'notes', y: 0.4, count: 26, spread: 1.4 });
    FX.burst(stage, { y: 0.3, count: 24, spread: 1.6 });
    FX.bump(stage.firstChild, 'fx-got');
  }

  app.replaceChildren(h('div', { class: 'closet' },
    h('header', { class: 'cl-head' },
      h('button', { class: 'back', 'aria-label': 'Back', onclick: () => { snd.hush(); hushDemo(); back(); } }, '‹'),
      h('button', { class: 'speak', 'aria-label': 'Read it to me', onclick: () => snd.narrate('closet', CLOSET_SPEECH) }, '🔊'),
      wallet),
    stage, tabs, grid, bar));
  draw();
  snd.loadGrooves().then(() => { if (slot === 'groove' && grid.isConnected) draw(); });
}
