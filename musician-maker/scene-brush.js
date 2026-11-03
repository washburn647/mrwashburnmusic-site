/* Brushing Time: Salon Mookie. A grooming salon with a barber pole that turns on the beat, a
   mirror ringed with bulbs that chase with the band, a price list, pink and white tiles.
   Mookie (rig.js) sits on the barber stool in his fluffiest coat. A gloved hand on a very long
   arm holds the brush.
   The call: the Head Stylist (a 3,400-year-old granite head of Pharaoh Amenhotep III in his
   round wig, with googly eyes) sings it from his shelf, and with every note a tuft of Mookie's
   fur sproings out. The response: every tap is a brush stroke. A tuft lies flat, a clump of
   hair flies onto the pile on the floor, Mookie purrs.
   Win (random, never twice running): a last flurry and Mookie comes out sleek, shiny and
   slicked back; or so sleek he slides off the stool like soap; or a 800-year-old bronze lion
   spritzes him to a shine; or the hair pile stands up and walks off as a second Mookie.
   Miss: the brush comes back with one hair and his fur gnarls; a porcelain hen nests in the
   knots and lays a 3,000-year-old egg; static blows him up like a dandelion; or the brush
   gets stuck and stays on his head as a hat.
   The salon parties as the combo grows: the price list bops, the bulbs chase, the mirror goes
   disco, spotlights swing, the floor lights up, Mookie wears shades.
   Boss: The Mane Event. Rusty (cats.js) on the stool, fluffed to twice his size. Each hit
   brushes out an armful; four and his whole coat comes off in one piece, and he's tiny.
   Real photos are CC0 museum objects (props/CREDITS.txt).
   Fixed markup only: nothing a learner types goes in here (call syllables are du/de). */

import { rigMookie } from './rig.js';
import { rigCat, fur } from './cats.js';
import { toon } from './sound.js';
import { gagDeck } from './gags.js';

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

function bump(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

const later = (ms, fn) => setTimeout(fn, ms);

/* The brush: a wooden slicker brush, a white cartoon glove on the handle, and a long sleeve
   that runs off the top right of the stage. The bristles' middle is at 25% 72% of the box. */
const BRUSH = `<svg viewBox="0 0 240 90" aria-hidden="true">
  <path class="bt-sleeve" d="M214 30 C300 10 360 -120 520 -260" stroke="#f08aa8" stroke-width="20" fill="none" stroke-linecap="round"/>
  <path d="M214 30 C300 10 360 -120 520 -260" stroke="#fff" stroke-width="20" stroke-dasharray="6 14" fill="none" opacity=".5"/>
  <path d="M100 30 L196 26 Q204 34 196 42 L100 42 Z" fill="#a8622c" stroke="#6e3c16" stroke-width="2"/>
  <g class="bt-bristles" stroke="#d9d4cc" stroke-width="2.2" stroke-linecap="round">
    <path d="M18 52 V70 M24 52 V72 M30 52 V73 M36 52 V74 M42 52 V74 M48 52 V74 M54 52 V74 M60 52 V74 M66 52 V74 M72 52 V74 M78 52 V73 M84 52 V72 M90 52 V70"/></g>
  <rect x="10" y="22" width="92" height="32" rx="16" fill="#c27a3c" stroke="#6e3c16" stroke-width="2.5"/>
  <rect x="16" y="27" width="80" height="10" rx="5" fill="#e3a464" opacity=".7"/>
  <rect x="10" y="44" width="92" height="8" rx="3" fill="#d9b04e" stroke="#8a6a1c" stroke-width="1.5"/>
  <g class="bt-glove"><circle cx="196" cy="34" r="17" fill="#fff" stroke="#17171b" stroke-width="3"/>
    <path d="M184 22 q-8 6 -2 14 M182 36 q-8 6 -1 13 M186 46 q-4 8 4 9" stroke="#17171b" stroke-width="3" fill="#fff" stroke-linecap="round"/>
    <rect x="206" y="18" width="14" height="32" rx="6" fill="#fff" stroke="#17171b" stroke-width="3"/></g>
</svg>`;

/* The barber stool: a red cushion on a chrome pedestal. */
const STOOL = `<svg viewBox="0 0 140 100" preserveAspectRatio="none" aria-hidden="true">
  <ellipse cx="70" cy="94" rx="44" ry="6" fill="#9aa3ab" stroke="#5f666d" stroke-width="2"/>
  <rect x="62" y="34" width="16" height="60" fill="#c9d1d8" stroke="#5f666d" stroke-width="2"/>
  <path d="M66 36 V92" stroke="#fff" stroke-width="3" opacity=".7"/>
  <path d="M8 18 Q70 2 132 18 L128 34 Q70 46 12 34 Z" fill="#d83a4a" stroke="#8e1f2c" stroke-width="2.5"/>
  <path d="M20 16 Q70 6 120 16" stroke="#ff8fa0" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M40 22 V36 M70 18 V40 M100 22 V36" stroke="#8e1f2c" stroke-width="1.5" opacity=".6"/>
</svg>`;

/* The price list. */
const SIGN = `<svg viewBox="0 0 100 120" aria-hidden="true">
  <rect class="bt-sign-frame" x="2" y="2" width="96" height="116" rx="6"/><rect x="8" y="8" width="84" height="104" rx="3" fill="#fff8f2"/>
  <g font-family="Fredoka, sans-serif" fill="#7a2742" text-anchor="middle">
    <text x="50" y="23" font-size="10.5" font-weight="700" letter-spacing=".5">SALON</text>
    <text x="50" y="35" font-size="12.5" font-weight="700" letter-spacing="1">MOOKIE</text></g>
  <path d="M20 41 H80" stroke="#f08aa8" stroke-width="1.5"/>
  <g font-family="Fredoka, sans-serif" fill="#3a2a30" font-size="7.4">
    <text x="13" y="55">brush</text><text x="87" y="55" text-anchor="end">1 fish</text>
    <text x="13" y="67">detangle</text><text x="87" y="67" text-anchor="end">2 fish</text>
    <text x="13" y="79">sproing</text><text x="87" y="79" text-anchor="end">free</text>
    <text x="13" y="91">Rusty</text><text x="87" y="91" text-anchor="end">99 fish</text></g>
  <text x="50" y="105" font-family="Fredoka, sans-serif" font-size="5.6" fill="#7a2742" text-anchor="middle" opacity=".85">no refunds on hairballs</text>
</svg>`;

/* A clump of brushed-out hair, and the pile it lands on. */
const clumpSvg = (fill, seed) => `<svg viewBox="0 0 60 44" aria-hidden="true"><path d="${fur(30, 24, 20, 13, { tufts: 9, amp: 5, seed })}" fill="${fill}" stroke="rgba(255,255,255,.35)" stroke-width="1"/></svg>`;
const PILE = (fill, edge) => `<svg viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true"><path d="${fur(100, 92, 92, 70, { tufts: 26, amp: 7, seed: 53, flat: 98 })}" fill="${fill}" stroke="${edge}" stroke-width="1.5"/>
  <path d="M40 70 q10 -10 22 -4 M96 40 q12 -8 22 0 M140 66 q8 -10 18 -2" stroke="rgba(255,255,255,.3)" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
/* Rusty's coat, all in one piece (the boss's knockout). */
const COAT = `<svg viewBox="0 0 200 160" aria-hidden="true">
  <path d="${fur(100, 92, 86, 62, { tufts: 30, amp: 9, seed: 61, top: 0.85 })}" fill="#8d6b47" stroke="#5e4530" stroke-width="2"/>
  <path d="${fur(100, 100, 46, 40, { tufts: 16, amp: 6, seed: 67 })}" fill="#dcc6a0"/>
  <g stroke="#3a2a1d" stroke-width="5" fill="none" stroke-linecap="round"><path d="M34 70 Q44 78 52 70 M30 100 Q42 110 52 100 M166 70 Q156 78 148 70 M170 100 Q158 110 148 100"/></g>
</svg>`;
const ZAP = `<svg viewBox="0 0 40 80" aria-hidden="true"><path d="M24 0 L6 40 L20 40 L10 80 L36 30 L22 30 L32 0 Z" fill="#ffe45c" stroke="#17171b" stroke-width="3" stroke-linejoin="round"/></svg>`;
const HAIR = `<svg viewBox="0 0 40 60" aria-hidden="true"><path d="M20 0 Q30 14 18 24 Q6 34 22 46 Q30 52 24 60" stroke="#17171b" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;

/* Real photos, cut out like stickers: CC0 museum objects (props/CREDITS.txt). */
const PROPS = ['head-stylist', 'lion', 'egg', 'hen-tureen', 'trophy'];
const propUrl = (name) => new URL(`./props/${name}.png`, import.meta.url).href;
let preloaded = false;
function preload() {
  if (preloaded) return;
  preloaded = true;
  PROPS.forEach((n) => { const i = new Image(); i.src = propUrl(n); });
}
function photo(name, cls = '') {
  const i = document.createElement('img');
  i.src = propUrl(name);
  i.alt = '';
  i.draggable = false;
  i.className = `ms-photo ${cls}`;
  return i;
}
function googly(x, y, size) {
  const g = h('span', 'googly');
  g.style.left = `${x}%`;
  g.style.top = `${y}%`;
  g.style.setProperty('--gs', `${size}%`);
  g.append(h('i'));
  return g;
}
function jiggle(root) {
  root.querySelectorAll('.googly i').forEach((p) => {
    p.style.setProperty('--px', `${Math.round(Math.random() * 90 - 45)}%`);
    p.style.setProperty('--py', `${Math.round(Math.random() * 90 - 45)}%`);
  });
}

const GAGS = {
  win: { sleek: 'Sleek and slicked back', slide: 'Slides off like soap', spritz: 'Bronze lion spritz', clone: 'The hair pile walks off' },
  fail: { gnarl: 'One hair, all gnarled', nest: 'A hen moves in', zap: 'Static dandelion', stuck: 'The brush is a hat now' },
};
const winGag = gagDeck(['sleek', 'sleek', 'slide', 'spritz', 'clone'], () => brushingTime.gagsOn?.win);
const failGag = gagDeck(['gnarl', 'gnarl', 'nest', 'zap', 'stuck'], () => brushingTime.gagsOn?.fail);

/* The order tufts sproing out in, call note by call note (rig.js's tufts: 0-3 body, 4-7 head). */
const ORDER = [4, 0, 5, 1, 6, 2, 7, 3];
const REST = -28; // the brush's resting tilt, degrees (also in scene-brush.css)

export const brushingTime = {
  id: 'brushing-time',
  name: 'Brushing Time',
  tap: 'guiro',
  pickClass: 'opt-brush',
  slotIcon: (c) => (c === 'ee' ? '🧹🧹' : '🧹'),
  bossName: 'The Mane Event',
  gags: GAGS,
  make(stage, { boss = false } = {}) {
    stage.className = `stage scene-bt${boss ? ' boss' : ''}`;
    preload();
    const cam = h('div', 'bt-cam');
    const wall = h('div', 'bt-wall');
    const pole = h('div', 'bt-pole');
    const stripes = h('i', 'bt-stripes');
    pole.append(h('b', 'bt-cap top'), stripes, h('b', 'bt-cap bottom'));
    const mirror = h('div', 'bt-mirror');
    const glass = h('div', 'bt-glass');
    mirror.append(glass);
    const BULBS = 14;
    for (let k = 0; k < BULBS; k++) {
      // Round the frame: up the left side, over the arch, down the right.
      const a = Math.PI * (1 - k / (BULBS - 1));
      const b = h('i', 'bt-bulb');
      b.style.left = `${50 + Math.cos(a) * 53}%`;
      b.style.top = `${48 - Math.sin(a) * 52}%`;
      mirror.append(b);
    }
    const sign = h('div', 'bt-sign');
    sign.innerHTML = SIGN; // fixed markup
    /* The Head Stylist: Pharaoh Amenhotep III's granite head (c. 1391-1353 BCE) on a wig stand,
       with googly eyes and a ventriloquist's jaw. */
    const stylist = h('div', 'bt-stylist');
    const sIn = h('div', 's-in');
    sIn.append(h('i', 's-mouth'), photo('head-stylist', 's-jaw'), photo('head-stylist', 's-top'),
      googly(31, 56, 15), googly(66, 56, 15));
    stylist.append(sIn, h('i', 'bt-stand'), h('b', 'bt-plate', 'HEAD STYLIST'));
    wall.append(pole, mirror, sign, stylist);
    const lights = h('div', 'ms-lights bt-lights');
    lights.append(h('i', 'l'), h('i', 'r'));
    const floor = h('div', 'bt-floor');
    const tiles = h('div', 'bt-tiles');
    for (let i = 0; i < 48; i++) tiles.append(h('i', ((i % 12) + Math.floor(i / 12)) % 2 ? 'd' : ''));
    floor.append(tiles);
    const base = h('div', 'bt-base');
    const pile = h('div', 'bt-pile');
    pile.innerHTML = boss ? PILE('#8d6b47', '#5e4530') : PILE('#17171b', '#34343d'); // fixed markup
    const stool = h('div', 'bt-stool');
    stool.innerHTML = STOOL; // fixed markup
    const cat = rigMookie();
    cat.el.classList.add('bt-mookie');
    const rusty = boss ? rigCat('rusty') : null;
    const brush = h('div', 'bt-brush');
    brush.innerHTML = BRUSH; // fixed markup
    const fx = h('div', 'ms-fx bt-fx');
    const speed = h('div', 'ms-speed');
    if (boss) {
      rusty.el.classList.add('bt-rusty');
      cam.append(wall, lights, floor, base, pile, stool, rusty.el, cat.el, brush);
    } else {
      cam.append(wall, lights, floor, base, pile, stool, cat.el, brush);
    }
    stage.append(cam, speed, fx);

    let tierNow = 0;
    let hits = 0;
    let busy = false;
    let notes = 0;
    let fluff = 1.15;
    let piled = 0;
    let poleAt = 0;
    let side = 1;
    let downs = 0;
    let unpurr = 0;
    const up = []; // tufts sticking out, oldest first
    const box = () => stage.getBoundingClientRect();
    const centre = (el, fx0 = 0.5, fy = 0.5) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width * fx0, y: r.top + r.height * fy };
    };
    const local = (p) => {
      const b = box();
      return { x: p.x - b.left, y: p.y - b.top };
    };
    const clampX = (x, pad = 0.14) => {
      const w = box().width;
      return Math.max(w * pad, Math.min(w * (1 - pad), x));
    };
    function comic(text, at, cls = '') {
      const p = local(at);
      const c = h('b', `ms-comic ${cls}`, text);
      c.style.left = `${clampX(p.x, cls.includes('big') ? 0.3 : 0.16)}px`;
      c.style.top = `${Math.max(30, p.y)}px`;
      c.style.setProperty('--rot', `${(Math.random() * 16 - 8).toFixed(1)}deg`);
      fx.append(c);
      later(900, () => c.remove());
      return c;
    }
    function dust(at, n = 6, cls = '') {
      const p = local(at);
      for (let i = 0; i < n; i++) {
        const d = h('i', `ms-dust ${cls}`);
        d.style.left = `${p.x}px`;
        d.style.top = `${p.y}px`;
        d.style.setProperty('--dx', `${(Math.random() * 2 - 1) * 46}px`);
        d.style.setProperty('--dy', `${-Math.random() * 30}px`);
        d.style.setProperty('--s', (0.6 + Math.random() * 0.8).toFixed(2));
        fx.append(d);
        later(600, () => d.remove());
      }
    }
    function bubble(text, at) {
      const p = local(at);
      const b = h('div', 'ms-bubble', text);
      b.style.left = `${clampX(p.x)}px`;
      b.style.top = `${Math.max(34, p.y)}px`;
      fx.append(b);
      later(700, () => b.remove());
    }
    function punch(at, scale = 1.15, ms = 520) {
      const p = local(at);
      cam.style.transformOrigin = `${p.x}px ${p.y}px`;
      cam.animate([
        { transform: 'scale(1)' }, { transform: `scale(${scale}) rotate(-1.5deg)`, offset: 0.18 },
        { transform: `scale(${scale * 1.02}) rotate(-1.5deg)`, offset: 0.6 }, { transform: 'scale(1)' },
      ], { duration: ms, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
    function flashSpeed(cls = '') {
      speed.className = `ms-speed ${cls}`;
      bump(speed, 'go');
    }
    function cutaway(mood = 'shock', ms = 420, setup = null) {
      const cut = h('div', 'ms-cut bt-cut');
      cut.append(h('div', 'ms-cut-lines'));
      const big = rigMookie();
      big.el.classList.add('ms-cut-face');
      setup?.(big);
      big.mood(mood);
      cut.append(big.el);
      stage.append(cut);
      later(ms, () => cut.classList.add('out'));
      later(ms + 160, () => cut.remove());
      return big;
    }
    /* Fly something along an arc, from one point to another (stage px). */
    function fling(el, from, to, ms = 380, lift = 70, spin = 360) {
      fx.append(el);
      const w = el.getBoundingClientRect().width || 40;
      const hgt = el.getBoundingClientRect().height || 20;
      el.style.left = `${to.x - w / 2}px`;
      el.style.top = `${to.y - hgt / 2}px`;
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      return el.animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(0) scale(.6)` },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) rotate(${spin * 0.55}deg) scale(1)`, offset: 0.55 },
        { transform: `translate(0, 0) rotate(${spin}deg) scale(1)` },
      ], { duration: ms, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'both' });
    }

    let talkBusy = 0;
    function stylistSay(text, mood = 'sing', ms = 800) {
      clearTimeout(talkBusy);
      stylist.classList.remove('tsk', 'sing', 'nod');
      jiggle(stylist);
      void stylist.offsetWidth;
      stylist.classList.add(mood);
      const flaps = mood === 'tsk' ? 3 : 1;
      for (let k = 0; k < flaps; k++) {
        later(40 + k * 150, () => { stylist.classList.add('talk'); jiggle(stylist); });
        later(130 + k * 150, () => stylist.classList.remove('talk'));
      }
      if (text) later(40, () => bubble(text, centre(stylist, 0.5, 0.02)));
      talkBusy = later(ms, () => stylist.classList.remove('tsk', 'sing', 'nod'));
    }

    /* The coat: how fluffy, and the pile on the floor. */
    function setFluff(n) {
      fluff = Math.max(0.85, Math.min(1.9, n));
      cat.fluff(fluff);
    }
    function grow(n = 1) {
      piled += n;
      pile.style.setProperty('--pile', Math.min(boss ? 2.2 : 1.7, 0.3 + piled * 0.09).toFixed(2));
      bump(pile, 'plop');
    }

    /* One brush stroke down a side of `who` (an element): from the head to the hip and back to
       rest. Returns where the bristles finished (stage px). */
    function stroke(who, { ms = 200, s = (side = -side), deep = 1 } = {}) {
      const r = who.getBoundingClientRect();
      const b = box();
      const rest = { x: brush.offsetLeft + brush.offsetWidth * 0.25, y: brush.offsetTop + brush.offsetHeight * 0.72 };
      const x0 = r.left - b.left + r.width * (0.5 + s * 0.13);
      const y0 = r.top - b.top + r.height * 0.14;
      const x1 = r.left - b.left + r.width * (0.5 + s * 0.34 * deep);
      const y1 = r.top - b.top + r.height * (0.5 + 0.28 * deep);
      const t = (x, y, a) => `translate(${(x - rest.x).toFixed(1)}px, ${(y - rest.y).toFixed(1)}px) rotate(${a}deg)`;
      brush.animate([
        { transform: `rotate(${REST}deg)` },
        { transform: t(x0, y0, s * 12), offset: 0.3 },
        { transform: t(x1, y1, s * 34), offset: 0.75 },
        { transform: `rotate(${REST}deg)` },
      ], { duration: ms, easing: 'ease-in-out' });
      return { x: x1, y: y1, at: ms * 0.75 };
    }
    /* A clump of hair flies off the brush onto the pile. */
    function clump(from, big = false) {
      const c = h('div', `bt-clump${big ? ' big' : ''}`);
      c.innerHTML = clumpSvg(boss ? '#8d6b47' : '#17171b', 3 + Math.floor(Math.random() * 40)); // fixed markup
      const to = local(centre(pile, 0.35 + Math.random() * 0.3, 0.25));
      const r = fling(c, from, to, 360, 60, 200 + Math.random() * 300);
      r.onfinish = () => { c.remove(); grow(big ? 3 : 1); };
    }
    /* Brush once: stroke, a tuft lies flat, hair flies. */
    function brushOnce({ ms = 200, quiet = false, who = cat.el } = {}) {
      const end = stroke(who, { ms });
      toon('brush', undefined, { vol: quiet ? 0.6 : 1, rate: 0.9 + Math.random() * 0.25 });
      later(end.at, () => {
        clump(end);
        dust({ x: end.x + box().left, y: end.y + box().top }, 3, boss ? 'fur rusty' : 'fur');
        if (who === cat.el) {
          const t = up.length ? up.shift() : ORDER[Math.floor(Math.random() * ORDER.length)];
          cat.tuft(t, false);
          setFluff(fluff - 0.06);
        }
      });
    }

    // Starting poses.
    setFluff(boss ? 1 : 1.15);
    if (boss) {
      cat.mood('hunt');
      cat.look(1, -0.2);
      rusty.mood('smug');
      rusty.look(-0.6, 0);
      rusty.poof(1.55);
      grow(0);
    } else {
      cat.svg.classList.add('furry');
      cat.mood('idle');
      grow(0);
    }

    return {
      onCall(i, syl) {
        if (busy) return;
        if (boss) {
          // Rusty mrrps the call and fluffs up a little more on every note.
          rusty.say(200, 'open');
          bump(rusty.el, 'taunt');
          rusty.poof(1.55 - hits * 0.13 + 0.05);
          bubble(syl || 'mrrp', centre(rusty.el, 0.5, 0.06));
          return;
        }
        // The Head Stylist sings each note; a tuft of Mookie's fur sproings out with it.
        stylistSay(syl || 'brr!', 'sing', 600);
        const t = ORDER[notes++ % ORDER.length];
        if (!up.includes(t)) up.push(t);
        bump(cat.tuft(t, true), 'sproing');
        setFluff(fluff + 0.04);
        cat.look(t % 2 ? 1 : -1, -0.3);
        toon('sproing', undefined, { vol: 0.7, rate: 0.9 + (notes % 3) * 0.12 });
      },
      onTap() {
        if (busy) return;
        if (boss) {
          brushOnce({ who: rusty.el, ms: 180 });
          cat.reach(...Object.values(centre(rusty.el, 0.3, 0.5)), 0.1);
          later(90, () => { bump(rusty.el, 'flinch'); rusty.poof(1.62 - hits * 0.13); });
          later(300, () => rusty.poof(1.55 - hits * 0.13));
          return;
        }
        brushOnce({ ms: 190 });
        // Brushed: eyes shut, a purr.
        later(90, () => {
          if (busy) return;
          cat.mood('happy');
          cat.hop(0.08);
          clearTimeout(unpurr);
          unpurr = later(320, () => { if (!busy) cat.mood('idle'); });
        });
        if (Math.random() < 0.35) later(100, () => toon('purr', undefined, { vol: 0.6 }));
      },
      onBeat(down, spb, tier = 0) {
        tierNow = tier;
        stage.dataset.tier = tier;
        cat.beat(down, spb, tier);
        rusty?.beat(down, spb, tier);
        // The barber pole turns one stripe a beat.
        const from = poleAt;
        poleAt += 1;
        stripes.animate([{ backgroundPosition: `0 ${from * 20}px` }, { backgroundPosition: `0 ${poleAt * 20}px` }],
          { duration: Math.min(260, spb * 600), easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
        if (down) downs++;
        mirror.dataset.chase = tier >= 1 ? (down ? 'a' : 'b') : '';
        if (tier >= 1) bump(sign, down ? 'bop' : 'bop2');
        if (tier >= 3) lights.className = `ms-lights bt-lights on ${down ? 'a' : 'b'}`;
        else lights.className = 'ms-lights bt-lights';
        if (tier >= 4) tiles.querySelectorAll('i').forEach((t) => t.classList.toggle('lit', Math.random() < 0.3));
        bump(stylist, down ? 'bob' : 'bob2');
        if (down) bump(pile, 'jig');
        jiggle(stage);
      },
      /* Boss rounds: a hit brushes out an armful; a miss and he sheds it all back on Mookie. */
      hit() {
        hits++;
        const at = centre(rusty.el, 0.5, 0.45);
        brushOnce({ who: rusty.el, ms: 260 });
        later(120, () => brushOnce({ who: rusty.el, ms: 240, quiet: true }));
        cat.reach(...Object.values(centre(rusty.el, 0.3, 0.5)), 0.2);
        later(300, () => {
          rusty.mood('shock');
          rusty.poof(1.55 - hits * 0.13);
          bump(rusty.el, 'brushed');
          clump(local(at), true);
          comic(['SHWOOP!', 'FLUMPH!', 'FWUFF!', 'KA-FLOOF!'][(hits - 1) % 4], { x: at.x, y: at.y - 40 }, 'hit');
          dust(at, 8, 'fur rusty');
          punch(at, 1.08, 380);
          cat.mood('star');
        });
        later(850, () => { rusty.mood('smug'); cat.mood('hunt'); });
      },
      miss() {
        rusty.mood('smug');
        bump(rusty.el, 'shake');
        rusty.poof(1.75 - hits * 0.13);
        toon('swish', undefined, { vol: 0.9 });
        comic('PFFT.', centre(rusty.el, 0.5, 0.05), 'bad');
        // A cloud of his fur lands on Mookie. Achoo.
        const from = local(centre(rusty.el, 0.4, 0.5));
        for (let k = 0; k < 5; k++) {
          later(k * 40, () => {
            const c = h('div', 'bt-clump');
            c.innerHTML = clumpSvg('#8d6b47', 70 + k); // fixed markup
            const r = fling(c, from, local(centre(cat.el, 0.3 + k * 0.1, 0.2 + (k % 2) * 0.2)), 320, 40, 300);
            r.onfinish = () => later(500, () => c.remove());
          });
        }
        later(350, () => { cat.mood('shock'); toon('sneeze', undefined, { vol: 1 }); });
        later(700, () => { comic('ACHOO!', centre(cat.el, 0.5, 0.1), 'big'); cat.hop(0.8); fx.querySelectorAll('.bt-clump').forEach((c) => c.classList.add('blown')); });
        later(1000, () => cat.mood('hunt'));
      },
      win(force) {
        busy = true;
        clearTimeout(unpurr);
        if (boss) return bossKO();
        const gag = winGag(force);
        if (gag === 'slide') return winSlide();
        if (gag === 'spritz') return winSpritz();
        if (gag === 'clone') return winClone();
        return winSleek();
      },
      fail(force) {
        busy = true;
        clearTimeout(unpurr);
        if (boss) return bossLose();
        const gag = failGag(force);
        if (gag === 'nest') return failNest();
        if (gag === 'zap') return failZap();
        if (gag === 'stuck') return failStuck();
        return failGnarl();
      },
    };

    /* ---------------- wins ---------------- */

    /* A flurry of strokes; the last one blows the loose fur off in a cloud. */
    function flurry(n = 3, gap = 110) {
      for (let k = 0; k < n; k++) later(k * gap, () => brushOnce({ ms: 170, quiet: k > 0 }));
      return n * gap;
    }
    /* Sleek: the fluff goes, the gloss and the slicked-back quiff come in, sparkle. */
    function goSleek(delay = 0, { say = 'SO SLEEK.', big = true } = {}) {
      later(delay, () => {
        const at = centre(cat.el, 0.5, 0.45);
        dust(at, 12, 'fur');
        if (big) clump(local(at), true);
        toon('swish', undefined, { vol: 1.1 });
        comic('FLOOF!', { x: at.x, y: at.y - 30 }, 'hit');
        up.splice(0).forEach((t) => cat.tuft(t, false));
        for (let t = 0; t < 8; t++) cat.tuft(t, false);
        cat.svg.classList.remove('furry', 'tangled');
        cat.svg.classList.add('sleek');
        setFluff(0.85);
        cat.mood('star');
        cat.hop(0.7);
      });
      later(delay + 260, () => {
        toon('ting', undefined, { vol: 1 });
        cat.mood('smug');
        if (say) comic(say, centre(cat.el, 0.5, -0.05), 'big');
      });
    }
    function winSleek() {
      const big = Math.random() < 0.4;
      if (big) {
        cutaway('star', 360, (m) => { m.svg.classList.add('sleek'); });
        toon('pep', undefined, { vol: 0.8 });
      }
      const d = big ? 300 : 0;
      later(d, () => flurry(3));
      goSleek(d + 360);
      if (big) later(d + 360, () => flashSpeed('gold'));
      later(d + 1000, () => stylistSay('fabulous.', 'nod', 900));
    }
    /* So sleek he slides off the stool like a bar of soap, across the floor and into the pile. */
    function winSlide() {
      flurry(2);
      goSleek(240, { say: null });
      later(640, () => {
        const from = cat.el.getBoundingClientRect();
        const to = pile.getBoundingClientRect();
        const dx = to.left + to.width * 0.5 - (from.left + from.width / 2);
        const dy = to.bottom - from.bottom - to.height * 0.1;
        toon('slide-down', undefined, { vol: 0.9 });
        comic('WHEEE!', centre(cat.el, 0.5, 0), 'big');
        cat.mood('happy');
        cat.el.animate([
          { transform: 'translate(0, 0) rotate(0)' },
          { transform: `translate(${dx * 0.15}px, ${dy * 0.7}px) rotate(-25deg)`, offset: 0.25 },
          { transform: `translate(${dx * 0.8}px, ${dy}px) rotate(-12deg)`, offset: 0.75 },
          { transform: `translate(${dx}px, ${dy}px) rotate(0)` },
        ], { duration: 520, easing: 'cubic-bezier(.4,.1,.6,1)', fill: 'forwards' });
        for (let k = 1; k < 4; k++) later(160 + k * 90, () => dust(centre(cat.el, 0.5, 0.95), 3));
      });
      later(1180, () => {
        toon('boing', undefined, { vol: 0.9 });
        bump(pile, 'plop');
        dust(centre(pile, 0.5, 0.3), 8, 'fur');
        cat.mood('star');
        cat.hop(0.6);
        comic('SLIPPERY.', centre(cat.el, 0.5, -0.05), '');
      });
      later(1300, () => stylistSay('ooh.', 'nod', 700));
    }
    /* An 800-year-old bronze lion water jug struts in and spritzes him to a shine. */
    function winSpritz() {
      flurry(2);
      const lion = h('div', 'bt-lion');
      lion.append(photo('lion'), googly(17.5, 23.5, 8));
      fx.append(lion);
      const c = centre(cat.el, 1, 0.75);
      const p = local(c);
      lion.style.left = `${p.x}px`;
      lion.style.top = `${p.y}px`;
      toon('step-1', undefined, { vol: 0.6 });
      later(120, () => toon('step-2', undefined, { vol: 0.6 }));
      later(260, () => { lion.classList.add('in'); jiggle(lion); });
      later(480, () => {
        // The water comes out of his mouth (the jug's spout), in an arc onto Mookie.
        toon('spritz', undefined, { vol: 1.1 });
        comic('SPRITZ!', centre(lion, 0.1, -0.05), 'hit');
        const m = lion.getBoundingClientRect();
        const spout = local({ x: m.left + m.width * 0.02, y: m.top + m.height * 0.27 });
        for (let k = 0; k < 9; k++) {
          later(k * 22, () => {
            const d = h('i', 'bt-drop');
            const r = fling(d, spout, local(centre(cat.el, 0.25 + Math.random() * 0.6, 0.15 + Math.random() * 0.5)), 260, 30 + Math.random() * 40, 0);
            r.onfinish = () => d.remove();
          });
        }
        cat.mood('shock');
      });
      goSleek(820, { say: null, big: false });
      later(1080, () => {
        toon('roar', undefined, { vol: 0.9 });
        jiggle(lion);
        bubble('magnificent.', centre(lion, 0.3, 0));
      });
      later(1300, () => lion.classList.add('out'));
      later(1900, () => lion.remove());
    }
    /* The hair pile gets so big it stands up, meows, and walks off as a second (fluffier) Mookie. */
    function winClone() {
      const n = flurry(4, 100);
      later(n, () => {
        goSleek(0, { say: null, big: true });
        grow(4);
      });
      const twin = rigMookie();
      twin.el.classList.add('bt-twin');
      twin.svg.classList.add('furry', 'tangled');
      twin.fluff(1.7);
      for (let t = 0; t < 8; t++) twin.tuft(t, true);
      twin.mood('sleep');
      later(n + 380, () => {
        const r = pile.getBoundingClientRect();
        const p = local({ x: r.left + r.width / 2, y: r.bottom });
        twin.el.style.left = `${p.x}px`;
        twin.el.style.top = `${p.y}px`;
        fx.append(twin.el);
        pile.classList.add('gone');
        toon('boing', undefined, { vol: 1 });
        dust(centre(twin.el, 0.5, 0.9), 8, 'fur');
      });
      later(n + 620, () => { twin.mood('idle'); twin.look(1, 0); toon('meow', undefined, { rate: 0.8 }); bubble('mrrp?', centre(twin.el, 0.5, 0.05)); cat.mood('shock'); cat.look(-1, 0); });
      later(n + 900, () => comic('TWO MOOKIES?!', centre(stage, 0.5, 0.25), 'big'));
      later(n + 1150, () => {
        twin.mood('happy');
        twin.el.classList.add('leave');
        toon('tiptoe', undefined, { vol: 0.6 });
        cat.mood('smug');
      });
    }

    /* ---------------- misses ---------------- */

    /* Gnarl: every tuft sticks out, knots, a big frizzy coat. */
    function gnarl(delay = 0, say = 'GNARLY.') {
      later(delay, () => {
        cat.svg.classList.add('furry', 'tangled');
        for (let t = 0; t < 8; t++) later(t * 30, () => bump(cat.tuft(t, true), 'sproing'));
        setFluff(1.6);
        toon('boing', undefined, { vol: 1 });
        cat.mood('dizzy');
        bump(cat.el, 'frazzle');
        dust(centre(cat.el, 0.5, 0.4), 8, 'fur');
      });
      if (say) later(delay + 280, () => comic(say, centre(cat.el, 0.5, 0), 'bad'));
    }
    /* The brush comes back with exactly one hair. */
    function failGnarl() {
      stroke(cat.el, { ms: 260, deep: 0.8 });
      toon('brush', undefined, { vol: 0.5, rate: 0.7 });
      const hair = h('div', 'bt-onehair');
      hair.innerHTML = HAIR; // fixed markup
      later(260, () => {
        brush.append(hair);
        toon('wah', undefined, { vol: 0.9 });
        comic('...one.', centre(brush, 0.25, 0.4), 'bad');
      });
      gnarl(700);
      later(1050, () => { cat.mood('sad'); stylistSay('tsk tsk.', 'tsk', 900); });
    }
    /* Gnarled, then a porcelain hen nests in it and lays a 3,000-year-old egg. */
    function failNest() {
      gnarl(0, null);
      const hen = h('div', 'bt-hen');
      hen.append(photo('hen-tureen'), googly(36.5, 22, 5.5), googly(51.5, 19, 4.6));
      later(300, () => {
        const top = local(centre(cat.el, 0.5, 0.1));
        const w = cat.el.getBoundingClientRect().width * 0.9;
        hen.style.left = `${top.x}px`;
        hen.style.top = `${top.y}px`;
        hen.style.width = `${w}px`;
        fx.append(hen);
        toon('whistle-down', undefined, { vol: 0.8 });
      });
      later(620, () => {
        hen.classList.add('sit');
        toon('cluck', undefined, { vol: 1.3 });
        jiggle(hen);
        comic('BAWK!', centre(hen, 0.5, -0.3), 'big');
        cat.mood('shock');
      });
      later(900, () => { toon('cluck', undefined, { vol: 1.2, rate: 1.2 }); jiggle(hen); bump(hen, 'lay'); });
      later(1000, () => {
        const egg = photo('egg', 'bt-egg');
        const from = local(centre(hen, 0.55, 0.7));
        const r = stool.getBoundingClientRect();
        const to = local({ x: r.left + r.width * 0.92, y: r.top + r.height * 0.15 });
        fling(egg, from, to, 360, 40, 30);
        toon('pop', undefined, { vol: 1 });
        later(360, () => { toon('clink', undefined, { vol: 1.1, rate: 0.7 }); bump(egg, 'wobble'); comic('PLOP.', { x: box().left + to.x, y: box().top + to.y - 30 }, 'hit'); });
      });
      later(1250, () => { cat.mood('sad'); stylistSay('new tenant.', 'tsk', 900); });
    }
    /* Too much brushing, too fast: static. He blows up like a dandelion; the brush sticks. */
    function failZap() {
      for (let k = 0; k < 4; k++) later(k * 70, () => { stroke(cat.el, { ms: 110 }); toon('brush', undefined, { vol: 0.6, rate: 1.3 }); });
      later(300, () => {
        toon('zap', undefined, { vol: 1.2 });
        cat.svg.classList.add('furry', 'tangled', 'static');
        for (let t = 0; t < 8; t++) cat.tuft(t, true);
        setFluff(1.9);
        cat.mood('shock');
        flashSpeed();
        const c = cat.el.getBoundingClientRect();
        for (let k = 0; k < 4; k++) {
          const z = h('div', 'bt-zap');
          z.innerHTML = ZAP; // fixed markup
          const p = local({ x: c.left + c.width * [0.05, 0.95, 0.15, 0.85][k], y: c.top + c.height * [0.2, 0.25, 0.65, 0.7][k] });
          z.style.left = `${p.x}px`;
          z.style.top = `${p.y}px`;
          z.style.setProperty('--r', `${[-30, 30, -60, 60][k]}deg`);
          fx.append(z);
          later(650, () => z.remove());
        }
        comic('ZZZAP!', centre(cat.el, 0.5, 0), 'big');
      });
      later(420, () => {
        // The brush sticks to his side, crackling.
        const at = local(centre(cat.el, 0.86, 0.55));
        const rest = { x: brush.offsetLeft + brush.offsetWidth * 0.25, y: brush.offsetTop + brush.offsetHeight * 0.72 };
        brush.animate([{ transform: `rotate(${REST}deg)` }, { transform: `translate(${at.x - rest.x}px, ${at.y - rest.y}px) rotate(18deg)` }],
          { duration: 160, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'forwards' });
        brush.classList.add('stuck');
      });
      later(750, () => { cat.mood('dizzy'); toon('zap', undefined, { vol: 0.6 }); bump(cat.el, 'frazzle'); });
      later(1100, () => stylistSay('bold choice.', 'tsk', 900));
    }
    /* The brush snags a knot, tugs three times, and stays on his head as a hat. */
    function failStuck() {
      gnarl(0, null);
      const top = local(centre(cat.el, 0.5, 0.12));
      const rest = { x: brush.offsetLeft + brush.offsetWidth * 0.25, y: brush.offsetTop + brush.offsetHeight * 0.72 };
      const dx = top.x - rest.x;
      const dy = top.y - rest.y;
      brush.animate([
        { transform: `rotate(${REST}deg)` },
        { transform: `translate(${dx}px, ${dy}px) rotate(0deg)`, offset: 0.2 },
        { transform: `translate(${dx + 30}px, ${dy - 30}px) rotate(8deg)`, offset: 0.35 },
        { transform: `translate(${dx}px, ${dy}px) rotate(0deg)`, offset: 0.5 },
        { transform: `translate(${dx + 36}px, ${dy - 36}px) rotate(10deg)`, offset: 0.65 },
        { transform: `translate(${dx}px, ${dy}px) rotate(0deg)`, offset: 0.8 },
        { transform: `translate(${dx}px, ${dy}px) rotate(-4deg)` },
      ], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
      later(180, () => { toon('creak', undefined, { vol: 0.9 }); comic('SNAG.', { x: box().left + top.x, y: box().top + top.y - 30 }, 'bad'); cat.mood('shock'); });
      [330, 610].forEach((t, k) => later(t, () => {
        toon('creak', undefined, { vol: 0.9, rate: 1 + k * 0.2 });
        cat.el.animate([{ transform: 'none' }, { transform: 'translate(3%, -6%) scale(.94, 1.14)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
      }));
      later(900, () => {
        // The hand gives up and lets go: the arm whips away, the brush stays.
        toon('boing', undefined, { vol: 1.1 });
        brush.classList.add('letgo');
        comic('BOING!', { x: box().left + top.x + 40, y: box().top + top.y - 50 }, 'hit');
        brush.getAnimations().forEach((a) => a.cancel());
        brush.remove();
        const hat = h('div', 'bt-brush bt-hat');
        hat.innerHTML = BRUSH; // fixed markup
        const w = cat.el.getBoundingClientRect().width;
        hat.style.width = `${w * 0.75}px`;
        hat.style.left = `${top.x - w * 0.75 * 0.25}px`;
        hat.style.top = `${top.y - w * 0.75 * 0.375 * 0.72}px`;
        fx.append(hat);
      });
      later(1250, () => { cat.mood('sad'); comic('NEW HAT.', centre(cat.el, 0.5, -0.05), 'big'); });
      later(1400, () => stylistSay('very now.', 'nod', 800));
    }

    /* ---------------- boss ---------------- */

    function bossKO() {
      // The last stroke takes his whole coat off in one piece. Underneath: a very small Rusty.
      const at = centre(rusty.el, 0.5, 0.45);
      brushOnce({ who: rusty.el, ms: 300 });
      cat.reach(...Object.values(centre(rusty.el, 0.3, 0.5)), 0.3);
      later(260, () => {
        toon('zip', undefined, { vol: 1.2 });
        flashSpeed('gold');
        comic('SHHHWOOOP!', { x: at.x, y: at.y - 50 }, 'big');
        const coat = h('div', 'bt-coat');
        coat.innerHTML = COAT; // fixed markup
        const r = rusty.el.getBoundingClientRect();
        const p = local({ x: r.left + r.width / 2, y: r.top + r.height * 0.6 });
        coat.style.left = `${p.x}px`;
        coat.style.top = `${p.y}px`;
        coat.style.width = `${r.width * 1.1}px`;
        fx.append(coat);
        later(20, () => coat.classList.add('off'));
        rusty.poof(0.8);
        rusty.el.classList.add('tiny');
        rusty.mood('shock');
        dust(at, 12, 'fur rusty');
      });
      later(800, () => {
        toon('thud', undefined, { vol: 1.3 });
        bump(stage, 'bt-quake');
        comic('FLUMP.', centre(fx.querySelector('.bt-coat') || rusty.el, 0.5, 0.3), 'hit');
      });
      later(1000, () => {
        rusty.mood('sad');
        toon('squeak', undefined, { vol: 1 });
        bubble('mrrp?', centre(rusty.el, 0.5, 0.05));
        cat.mood('star');
        cat.hop(0.8);
      });
      later(1250, () => {
        const cup = photo('trophy', 'ms-trophy');
        const head = local(centre(cat.el, 0.5, 0));
        cup.style.left = `${head.x}px`;
        cup.style.top = `${head.y}px`;
        fx.append(cup);
        toon('choir', undefined, { vol: 1 });
        later(250, () => comic('CHAMPION!', { x: box().left + head.x + 40, y: box().top + head.y - 30 }, 'big'));
        stylistSay('fabulous!', 'nod', 1000);
      });
    }
    function bossLose() {
      // He shakes like a wet dog. Fur everywhere. Mookie is buried; only his ears stick out.
      rusty.mood('smug');
      rusty.el.classList.add('shaking');
      rusty.poof(1.9);
      toon('swish', undefined, { vol: 1.2 });
      comic('FLOOF BOMB.', centre(rusty.el, 0.5, 0), 'big');
      const from = local(centre(rusty.el, 0.5, 0.5));
      for (let k = 0; k < 14; k++) {
        later(k * 35, () => {
          const c = h('div', 'bt-clump');
          c.innerHTML = clumpSvg('#8d6b47', 80 + k); // fixed markup
          const w = box().width;
          const r = fling(c, from, { x: Math.random() * w, y: box().height * (0.55 + Math.random() * 0.4) }, 420, 90, 400);
          r.onfinish = () => later(800, () => c.remove());
        });
      }
      later(500, () => {
        const drift = h('div', 'bt-drift');
        drift.innerHTML = PILE('#8d6b47', '#5e4530'); // fixed markup
        fx.append(drift);
        later(20, () => drift.classList.add('up'));
        cat.mood('shock');
      });
      later(900, () => {
        rusty.el.classList.remove('shaking');
        toon('sneeze', undefined, { vol: 1.1 });
      });
      later(1240, () => { comic('ACHOO!', centre(stage, 0.3, 0.55), 'big'); stylistSay('tsk tsk.', 'tsk', 900); });
    }
  },
};
