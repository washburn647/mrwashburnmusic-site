/* Supper Time, the full production. A kitchen at sunset: a lamp that swings on the beat, a
   pot that rattles its lid, a chalkboard menu (fish, fish, more fish), a checkerboard floor.
   Mookie (rig.js) is fast asleep in her basket, snot bubble and all. Her supper sits in her
   bowl: a 200-year-old Japanese gong bowl, with its own gilded beater.
   The call: Chef Bastet, a 2,500-year-old Egyptian bronze cat in a chef's hat and googly
   eyes, sings it from the counter. While she sings, Bindi and Rusty (cats.js) tiptoe out
   from behind the counter, one step per note. The response: every tap rings the bowl. The
   thieves freeze mid-sneak, Mookie stirs, the snot bubble shrinks.
   Win (random, never twice running): Mookie pops her bubble and rockets to her bowl; a royal
   Sèvres tureen lands with a fanfare; a porcelain hen tureen squawks the thieves away; or a
   500-year-old bronze lobster pinches Rusty. Miss: the masked heist; Bindi's yowl blows
   Mookie out of bed; Rusty flops belly-up on the bowl; or the cats swap supper for a stone fish.
   The kitchen parties as the combo grows: the menu bops, the lamp goes disco and a fish
   garland drops, spotlights swing and the cats dance, the floor lights up, Mookie wears shades.
   Boss: Rusty, The Big Fluff, sprawled on a silver tureen. Each hit rings a shockwave that
   blows his fur up; four and he's blasted off the tureen and lands as a rug.
   Real photos are CC0 museum objects and one CC0 herring (props/CREDITS.txt).
   Fixed markup only: nothing a learner types goes in here (call syllables are du/de). */

import { rigMookie } from './rig.js';
import { rigCat } from './cats.js';
import { toon } from './sound.js';

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

const WINDOW = `<svg viewBox="0 0 100 110" aria-hidden="true">
  <defs><linearGradient id="sp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4a8a"/><stop offset=".45" stop-color="#e2768a"/><stop offset=".8" stop-color="#f6b25e"/><stop offset="1" stop-color="#ffd98a"/></linearGradient></defs>
  <rect x="8" y="8" width="84" height="84" rx="4" fill="url(#sp-sky)"/>
  <circle class="sp-sun" cx="50" cy="80" r="16" fill="#fff1b8"/>
  <path d="M8 74 Q24 64 40 72 T72 68 T92 72 V92 H8 Z" fill="#6b4a6e"/><path d="M8 82 Q30 76 54 82 T92 80 V92 H8 Z" fill="#4e3657"/>
  <g class="sp-birds" stroke="#3b2b44" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M22 30 q4 -4 8 0 q4 -4 8 0"/><path d="M60 22 q3 -3 6 0 q3 -3 6 0"/></g>
  <path d="M50 8 V92 M8 50 H92" stroke="#fff7e6" stroke-width="4"/>
  <rect x="8" y="8" width="84" height="84" rx="4" fill="none" stroke="#fff7e6" stroke-width="6"/>
  <path d="M0 4 H100" stroke="#b5562f" stroke-width="5" stroke-linecap="round"/>
  <path d="M2 6 Q16 30 4 58 Q14 56 22 60 Q26 30 22 6 Z" fill="#e8bd3f"/><path d="M98 6 Q84 30 96 58 Q86 56 78 60 Q74 30 78 6 Z" fill="#e8bd3f"/>
  <path d="M6 10 V54 M14 10 V56 M94 10 V54 M86 10 V56" stroke="#d9a62c" stroke-width="1.4"/>
  <rect x="2" y="96" width="96" height="8" rx="2" fill="#fff7e6"/>
</svg>`;

const MENU = `<svg viewBox="0 0 100 120" aria-hidden="true">
  <rect x="2" y="2" width="96" height="116" rx="6" fill="#8a5a32"/><rect x="8" y="8" width="84" height="104" rx="3" fill="#2f3b33"/>
  <g fill="#f4efe4" font-family="Fredoka, sans-serif" text-anchor="middle">
    <text x="50" y="28" font-size="15" font-weight="700" letter-spacing="1">MENU</text>
    <text x="50" y="48" font-size="10">fish</text><text x="50" y="64" font-size="10">fish</text>
    <text x="50" y="80" font-size="10">more fish</text>
    <text x="50" y="98" font-size="8" opacity=".8">(no Rusty)</text></g>
  <path d="M20 33 H80" stroke="#f4efe4" stroke-width="1" opacity=".6"/>
  <g stroke="#f4efe4" stroke-width="1.2" fill="none" opacity=".75"><path d="M14 58 q6 -6 12 0 q-6 6 -12 0 Z M26 58 l4 -3 v6 Z"/><path d="M74 74 q6 -6 12 0 q-6 6 -12 0 Z M86 74 l4 -3 v6 Z"/></g>
  <rect x="30" y="112" width="40" height="5" rx="2" fill="#6e4526"/><rect x="56" y="109" width="10" height="4" rx="1" fill="#f4efe4"/>
</svg>`;

const LAMP = `<svg viewBox="0 0 80 120" aria-hidden="true">
  <path d="M40 0 V52" stroke="#4a3a2a" stroke-width="2"/>
  <path d="M34 50 H46 L48 58 H32 Z" fill="#6e4526"/>
  <path class="sp-shade" d="M32 58 H48 L74 92 Q40 100 6 92 Z" fill="#e05a4f" stroke="#a83f36" stroke-width="2"/>
  <path d="M10 90 Q40 97 70 90" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/>
  <ellipse cx="40" cy="94" rx="10" ry="5" fill="#fff6c8"/>
</svg>`;

const POT = `<svg viewBox="0 0 80 70" aria-hidden="true">
  <g class="sp-lid"><path d="M10 26 Q40 8 70 26 Z" fill="#9aa3ab" stroke="#5f666d" stroke-width="2"/><rect x="34" y="10" width="12" height="6" rx="3" fill="#2f2f33"/></g>
  <path d="M8 28 H72 L68 62 Q40 70 12 62 Z" fill="#b8c0c8" stroke="#5f666d" stroke-width="2"/>
  <path d="M8 34 H2 M72 34 H78" stroke="#2f2f33" stroke-width="5" stroke-linecap="round"/>
  <path d="M16 36 Q18 52 18 58" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const COUNTER = `<svg viewBox="0 0 120 130" preserveAspectRatio="none" aria-hidden="true">
  <rect x="0" y="10" width="120" height="120" fill="#e9dcc0"/>
  <rect x="-4" y="0" width="128" height="12" rx="2" fill="#c9b79a" stroke="#9c8a6c" stroke-width="1.5"/>
  <rect x="8" y="22" width="104" height="26" rx="3" fill="#f5ecd8" stroke="#bfae8c" stroke-width="2"/>
  <rect x="8" y="56" width="48" height="66" rx="3" fill="#f5ecd8" stroke="#bfae8c" stroke-width="2"/>
  <rect x="64" y="56" width="48" height="66" rx="3" fill="#f5ecd8" stroke="#bfae8c" stroke-width="2"/>
  <rect x="48" y="33" width="24" height="5" rx="2.5" fill="#b07a3a"/><circle cx="48" cy="88" r="3.5" fill="#b07a3a"/><circle cx="72" cy="88" r="3.5" fill="#b07a3a"/>
</svg>`;

const BED_BACK = `<svg viewBox="0 0 200 90" preserveAspectRatio="none" aria-hidden="true">
  <ellipse cx="100" cy="52" rx="96" ry="34" fill="#a8743e"/><ellipse cx="100" cy="50" rx="84" ry="24" fill="#7f9bc4"/>
  <ellipse cx="100" cy="48" rx="70" ry="16" fill="#9db6d8"/></svg>`;
const BED_FRONT = `<svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
  <defs><pattern id="sp-wick" width="12" height="10" patternUnits="userSpaceOnUse"><rect width="12" height="10" fill="#c48a4a"/><path d="M0 5 Q3 0 6 5 T12 5" stroke="#8f5f2e" stroke-width="2" fill="none"/><path d="M0 10 Q3 5 6 10 T12 10" stroke="#e0aa66" stroke-width="1.2" fill="none"/></pattern></defs>
  <path d="M4 6 Q100 34 196 6 L190 40 Q100 66 10 40 Z" fill="url(#sp-wick)" stroke="#7a4f24" stroke-width="2.5"/>
  <path d="M4 6 Q100 34 196 6" stroke="#e0aa66" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;

const TOQUE = `<svg viewBox="0 0 100 80" aria-hidden="true">
  <path d="M22 56 Q4 50 8 32 Q12 16 30 20 Q34 2 52 6 Q68 0 74 18 Q94 16 94 34 Q94 50 78 56 Z" fill="#fff" stroke="#c9c2b6" stroke-width="2.5"/>
  <path d="M22 54 H78 L76 74 H24 Z" fill="#fff" stroke="#c9c2b6" stroke-width="2.5"/>
  <path d="M38 24 Q40 40 36 52 M58 22 Q62 38 60 52" stroke="#e4ded4" stroke-width="2" fill="none"/></svg>`;

const BONES = `<svg viewBox="0 0 60 24" aria-hidden="true"><path d="M6 12 H48" stroke="#f4efe4" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M14 5 V19 M21 4 V20 M28 4 V20 M35 5 V19 M42 6 V18" stroke="#f4efe4" stroke-width="2" stroke-linecap="round"/>
  <path d="M48 12 L58 4 L56 12 L58 20 Z" fill="#f4efe4"/><circle cx="6" cy="12" r="5" fill="none" stroke="#f4efe4" stroke-width="2.4"/><circle cx="5" cy="11" r="1.2" fill="#f4efe4"/></svg>`;

/* Real photos, cut out like stickers: CC0 museum objects and a CC0 herring (props/CREDITS.txt). */
const PROPS = ['bowl', 'beater', 'bastet', 'tureen', 'hen-tureen', 'lobster', 'stone-fish', 'herring', 'silver-tureen', 'trophy'];
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
function deck(list) {
  let last = null;
  return () => {
    const pool = list.filter((x) => x !== last);
    last = pool[Math.floor(Math.random() * pool.length)];
    return last;
  };
}
const winGag = deck(['rocket', 'rocket', 'tureen', 'hen', 'lobster']);
const failGag = deck(['heist', 'heist', 'yowl', 'flop', 'decoy']);

/* Where the thieves stand, as % of the stage width: they start behind the counter and gain
   one step per note of the call, up to a little short of the bowl. */
const START = { bindi: 7, rusty: -3 };
const STEP = 4.2;
const MAX_STEPS = 6;

export const supperTime = {
  id: 'supper-time',
  name: 'Supper Time',
  tap: 'finger-cymbals',
  pickClass: 'opt-bowl',
  slotIcon: (c) => (c === 'ee' ? '🐟🐟' : '🐟'),
  bossName: 'The Big Fluff',
  make(stage, { boss = false } = {}) {
    stage.className = `stage scene-sp${boss ? ' boss' : ''}`;
    preload();
    const cam = h('div', 'sp-cam');
    const wall = h('div', 'sp-wall');
    const win = h('div', 'sp-window');
    win.innerHTML = WINDOW; // fixed markup
    const menu = h('div', 'sp-menu');
    menu.innerHTML = MENU; // fixed markup
    const lamp = h('div', 'sp-lamp');
    lamp.innerHTML = LAMP; // fixed markup
    lamp.append(h('i', 'sp-cone'));
    const bunting = h('div', 'sp-bunting');
    for (let i = 0; i < 9; i++) bunting.append(h('i'));
    wall.append(win, menu, bunting, lamp);
    const lights = h('div', 'ms-lights sp-lights');
    lights.append(h('i', 'l'), h('i', 'r'));
    const floor = h('div', 'sp-floor');
    const checks = h('div', 'sp-checks');
    for (let i = 0; i < 65; i++) checks.append(h('i'));
    floor.append(checks);
    const base = h('div', 'sp-base');
    const counter = h('div', 'sp-counter');
    counter.innerHTML = COUNTER; // fixed markup
    const pot = h('div', 'sp-pot');
    pot.innerHTML = POT; // fixed markup
    const steam = h('div', 'sp-steam');
    steam.append(h('i'), h('i'), h('i'));
    pot.append(steam);
    counter.append(pot);
    /* Chef Bastet: an Egyptian bronze cat (600s-300s BCE) in a chef's hat, with googly eyes
       and a ventriloquist's jaw. She lives behind the counter and pops up to sing. */
    const chefMask = h('div', 'sp-chef-mask');
    const chef = h('div', 'sp-chef');
    const chefIn = h('div', 'c-in');
    const toque = h('div', 'sp-toque');
    toque.innerHTML = TOQUE; // fixed markup
    chefIn.append(h('i', 'c-mouth'), photo('bastet', 'c-jaw'), photo('bastet', 'c-top'), toque,
      googly(24, 13.2, 16), googly(41, 10, 14));
    chef.append(chefIn);
    chefMask.append(chef);
    // The supper: the bowl on a placemat, a herring sticking out, the beater resting on the rim.
    const mat = h('div', 'sp-mat');
    mat.append(h('b', 'sp-mat-name', 'MOOKIE'));
    const bowl = h('div', 'sp-bowl');
    const fish = photo('herring', 'sp-fish');
    const bowlImg = photo('bowl', 'sp-bowl-img');
    bowl.append(fish, bowlImg);
    const beater = h('div', 'sp-beater');
    beater.append(photo('beater'));
    const rings = h('div', 'sp-rings');
    // Mookie's basket: back, Mookie, front.
    const bed = h('div', 'sp-bed');
    const bedBack = h('div', 'sp-bed-back');
    bedBack.innerHTML = BED_BACK; // fixed markup
    const bedFront = h('div', 'sp-bed-front');
    bedFront.innerHTML = BED_FRONT; // fixed markup
    const cat = rigMookie();
    cat.el.classList.add('sp-mookie');
    bed.append(bedBack, cat.el, bedFront);
    const zzz = h('div', 'sp-zzz');
    zzz.append(h('i', '', 'z'), h('i', '', 'z'), h('i', '', 'Z'));
    const bindi = rigCat('bindi');
    bindi.el.classList.add('sp-bindi');
    const rusty = rigCat('rusty');
    rusty.el.classList.add('sp-rusty');
    const fx = h('div', 'ms-fx sp-fx');
    const speed = h('div', 'ms-speed');
    let prize = null;
    if (boss) {
      prize = h('div', 'sp-prize');
      prize.append(photo('silver-tureen'));
      cam.append(wall, lights, floor, base, counter, chefMask, bindi.el, mat, bowl, beater, rings, cat.el, prize, rusty.el);
    } else {
      cam.append(wall, lights, floor, base, chefMask, bindi.el, rusty.el, counter, mat, bowl, beater, rings, bed, zzz);
    }
    stage.append(cam, speed, fx);

    let swing = 1;
    let tierNow = 0;
    let hits = 0;
    let busy = false;
    let steps = 0;
    let wake = 0;
    let downs = 0;
    let unfreeze = 0;
    const box = () => stage.getBoundingClientRect();
    const centre = (el, fx0 = 0.5, fy = 0.5) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width * fx0, y: r.top + r.height * fy };
    };
    const local = (p) => {
      const b = box();
      return { x: p.x - b.left, y: p.y - b.top };
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
    /* Keep lettering inside the stage. */
    const clampX = (x, pad = 0.14) => {
      const w = box().width;
      return Math.max(w * pad, Math.min(w * (1 - pad), x));
    };
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
    /* A big face fills the stage for a moment. */
    function cutaway(who, ms = 420, mood = 'yowl') {
      const cut = h('div', `ms-cut sp-cut ${who}`);
      cut.append(h('div', 'ms-cut-lines'));
      const big = who === 'mookie' ? rigMookie() : rigCat(who);
      big.el.classList.add('ms-cut-face');
      big.mood(mood);
      if (who === 'rusty' && mood === 'smug') big.look(0, 0);
      cut.append(big.el);
      stage.append(cut);
      later(ms, () => cut.classList.add('out'));
      later(ms + 160, () => cut.remove());
      return big;
    }
    /* Sound rings out of the bowl. */
    function ring(n = 2, cls = '') {
      const r = local(centre(bowl, 0.5, 0.4));
      for (let k = 0; k < n; k++) {
        const o = h('i', `sp-ring ${cls}`);
        o.style.left = `${r.x}px`;
        o.style.top = `${r.y}px`;
        o.style.animationDelay = `${k * 90}ms`;
        rings.append(o);
        later(700 + k * 90, () => o.remove());
      }
    }
    /* Fly a copy of something along an arc, from one point to another (stage px). */
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

    let chefBusy = 0;
    function chefSay(text, mood = 'sing', ms = 900) {
      clearTimeout(chefBusy);
      chef.classList.remove('tsk', 'sing', 'nod');
      chef.classList.add('up');
      jiggle(chef);
      void chef.offsetWidth;
      chef.classList.add(mood);
      const flaps = mood === 'tsk' ? 3 : 1;
      for (let k = 0; k < flaps; k++) {
        later(40 + k * 150, () => { chef.classList.add('talk'); jiggle(chef); });
        later(130 + k * 150, () => chef.classList.remove('talk'));
      }
      if (text) later(40, () => bubble(text, centre(chefMask, 0.55, 0.16)));
      chefBusy = later(ms, () => chef.classList.remove('up', 'tsk', 'sing', 'nod'));
    }

    /* The thieves: x positions from steps, sneak pose, freeze on a clang. */
    function place(ms = 180) {
      const s = Math.min(steps, MAX_STEPS);
      bindi.el.style.transitionDuration = `${ms}ms`;
      rusty.el.style.transitionDuration = `${ms}ms`;
      bindi.el.style.left = `${START.bindi + s * STEP}%`;
      rusty.el.style.left = `${START.rusty + s * STEP * 0.9}%`;
    }
    function snot() {
      cat.svg.style.setProperty('--snot', (1.05 - wake * 0.55).toFixed(2));
    }

    // Starting poses.
    if (boss) {
      cat.mood('hunt');
      cat.look(1, 0.2);
      rusty.mood('smug');
      rusty.look(-0.8, 0);
      rusty.el.classList.add('lounge');
      bindi.mood('idle');
      bindi.look(1, 0);
      bindi.el.style.left = '4%';
    } else {
      cat.mood('sleep');
      cat.svg.classList.add('snot');
      snot();
      bindi.mood('sneak');
      rusty.mood('sneak');
      place(0);
    }

    return {
      onCall(i, syl) {
        if (busy) return;
        if (boss) {
          rusty.say(200, 'open');
          bump(rusty.el, 'taunt');
          bubble(syl || 'mrrp', centre(rusty.el, 0.5, 0.1));
          return;
        }
        // Chef Bastet sings each note; while she sings, the thieves take a step.
        chefSay(null, 'sing', 700);
        later(30, () => bubble(syl || 'mew!', centre(chefMask, 0.55, 0.16)));
        steps++;
        bindi.mood('sneak');
        rusty.mood('sneak');
        bindi.step();
        later(60, () => rusty.step());
        place();
        toon('tiptoe', undefined, { vol: 0.5, rate: 1 + (steps % 2) * 0.2 });
      },
      onTap() {
        if (busy) return;
        bump(beater, 'strike');
        later(60, () => { ring(2); bump(bowl, 'ding'); });
        if (boss) {
          cat.reach(...Object.values(centre(bowl, 0.5, 0.2)), 0.08);
          later(80, () => { bump(rusty.el, 'flinch'); rusty.poof(1.15); });
          later(260, () => rusty.poof(1 + hits * 0.12));
          return;
        }
        // Clang: the thieves freeze mid-sneak and slide back a little; Mookie stirs.
        bindi.mood('freeze');
        rusty.mood('freeze');
        steps = Math.max(0, steps - 0.5);
        place(120);
        clearTimeout(unfreeze);
        unfreeze = later(380, () => { if (!busy) { bindi.mood('sneak'); rusty.mood('sneak'); } });
        wake = Math.min(1, wake + 0.22);
        snot();
        cat.hop(0.12);
        bump(cat.el, 'stir');
      },
      onBeat(down, spb, tier = 0) {
        tierNow = tier;
        stage.dataset.tier = tier;
        cat.beat(down, spb, tier);
        bindi.beat(down, spb, tier);
        rusty.beat(down, spb, tier);
        // The lamp lands on each beat, like a pendulum.
        const to = swing * 9;
        swing = -swing;
        lamp.animate([{ transform: `rotate(${-to}deg)` }, { transform: `rotate(${to}deg)` }],
          { duration: spb * 1000, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
        bump(pot, down ? 'rattle' : 'rattle2');
        if (down) bump(steam, 'puff');
        if (tier >= 1) bump(menu, down ? 'bop' : 'bop2');
        if (tier >= 3) lights.className = `ms-lights sp-lights on ${down ? 'a' : 'b'}`;
        else lights.className = 'ms-lights sp-lights';
        if (tier >= 4) checks.querySelectorAll('i').forEach((t) => t.classList.toggle('lit', Math.random() < 0.3));
        jiggle(stage);
        if (down) downs++;
        // Asleep: a z floats up each beat and the snot bubble breathes.
        if (!boss && cat.moodName === 'sleep') {
          const z = zzz.children[downs % 3];
          if (down) bump(z, 'zpop');
          cat.svg.style.setProperty('--snot', ((1.05 - wake * 0.55) * (down ? 1.25 : 0.9)).toFixed(2));
        }
        if (boss && !busy && tier >= 1 && down && downs % 2 === 0) bump(bindi.el, 'cheer');
      },
      /* Boss rounds: a hit rings a shockwave at The Big Fluff; a miss and he yawns. */
      hit() {
        hits++;
        const at = centre(rusty.el, 0.5, 0.4);
        bump(beater, 'strike');
        cat.reach(...Object.values(centre(bowl, 0.5, 0.2)), 0.16);
        toon('ding', undefined, { vol: 1.2, rate: 0.9 });
        ring(4, 'big');
        const wave = h('i', 'sp-wave');
        const from = local(centre(bowl, 0.5, 0.4));
        wave.style.left = `${from.x}px`;
        wave.style.top = `${from.y}px`;
        wave.style.setProperty('--to', `${local(at).x - from.x}px`);
        fx.append(wave);
        later(500, () => wave.remove());
        later(260, () => {
          rusty.mood('shock');
          rusty.poof(1 + hits * 0.14);
          rusty.el.style.setProperty('--blown', hits);
          bump(rusty.el, 'blown');
          comic(['FWOOSH!', 'POOF!', 'FLUMPH!', 'KA-FLOOF!'][(hits - 1) % 4], { x: at.x, y: at.y - 30 }, 'hit');
          dust(at, 6, 'fur');
          punch(at, 1.08, 380);
          toon('swish', undefined, { vol: 1.2 });
        });
        later(800, () => rusty.mood('smug'));
      },
      miss() {
        rusty.say(500, 'yowl');
        rusty.mood('smug');
        bump(rusty.el, 'yawn');
        comic('YAWN.', centre(rusty.el, 0.5, 0.1), 'bad');
        later(200, () => { bindi.mood('happy'); toon('meow', undefined, { rate: 1.2 }); bubble('MRROW!', centre(bindi.el, 0.5, 0)); });
        later(700, () => bindi.mood('idle'));
        cat.mood('shock');
        later(650, () => cat.mood('hunt'));
      },
      win() {
        busy = true;
        clearTimeout(unfreeze);
        if (boss) return bossKO();
        const gag = winGag();
        if (gag === 'tureen' || gag === 'hen') return winTureen(gag);
        if (gag === 'lobster') return winLobster();
        return winRocket();
      },
      fail() {
        busy = true;
        clearTimeout(unfreeze);
        if (boss) return bossLose();
        const gag = failGag();
        if (gag === 'yowl') return failYowl();
        if (gag === 'flop') return failFlop();
        if (gag === 'decoy') return failDecoy();
        return failHeist();
      },
    };

    /* ---------------- wins ---------------- */

    /* Mookie wakes (pop!), rockets out of her basket to the bowl and eats. */
    function wakeAndEat(delay = 0, { big = false } = {}) {
      later(delay, () => {
        cat.svg.classList.remove('snot');
        toon('pop', undefined, { vol: 1.2 });
        comic('POP!', centre(cat.el, 0.56, 0.36), 'hit');
        zzz.remove();
        cat.mood('shock');
      });
      later(delay + 150, () => {
        toon('whistle-up', undefined, { vol: 0.9 });
        dust(centre(bed, 0.5, 0.6), 7);
        const from = cat.el.getBoundingClientRect();
        const to = bowl.getBoundingClientRect();
        const dx = to.left + to.width * 0.55 - (from.left + from.width / 2);
        const dy = to.top - from.height * 0.62 - from.top;
        cat.el.animate([
          { transform: 'translate(0, 0) rotate(0)' },
          { transform: `translate(${dx * 0.5}px, ${dy - from.height * 0.5}px) rotate(-200deg)`, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) rotate(-360deg)` },
        ], { duration: 360, easing: 'cubic-bezier(.3,.5,.5,1)', fill: 'forwards' });
        cat.el.classList.add('flying');
      });
      later(delay + 520, () => {
        cat.mood('eat');
        cat.hop(0.4);
        toon('chomp', undefined, { vol: 1.1 });
        fish.classList.add('eaten');
        comic('NOM NOM NOM!', { x: centre(bowl).x, y: centre(bowl, 0.5, -0.6).y }, 'big');
        if (big) flashSpeed();
        punch(centre(bowl), 1.1, 560);
        const b = h('div', 'sp-bones');
        b.innerHTML = BONES; // fixed markup
        fling(b, local(centre(bowl, 0.5, 0)), local(centre(bowl, 1.4, -0.6)), 420, 50, 540);
        later(700, () => b.remove());
      });
      later(delay + 800, () => toon('chomp', undefined, { vol: 0.9 }));
    }
    function thievesFlee(delay = 0, say = 'hmph.') {
      later(delay, () => {
        toon('zip');
        [bindi, rusty].forEach((k, i) => {
          k.mood('shock');
          k.poof(1.35);
          later(120 + i * 60, () => {
            k.el.style.transitionDuration = '360ms';
            k.el.style.left = '-45%';
            k.el.classList.add('flee');
            dust(centre(k.el, 0.5, 0.95), 4);
          });
        });
        later(260, () => bubble(say, centre(rusty.el, 0.5, 0.05)));
      });
    }
    function winRocket() {
      const big = Math.random() < 0.4;
      if (big) {
        cutaway('mookie', 360, 'star');
        toon('pep', undefined, { vol: 0.8 });
      }
      const d = big ? 300 : 0;
      later(d, () => { bindi.mood('freeze'); rusty.mood('freeze'); });
      wakeAndEat(d, { big });
      thievesFlee(d + 420);
      if (tierNow >= 2) later(d + 1000, () => chefSay('magnifique.', 'nod', 900));
    }
    /* A royal tureen lands on the mat. The lid lifts: fish for Mookie (the Sèvres one), or the
       porcelain hen squawks the thieves out of the kitchen (the Chelsea one). */
    function winTureen(kind) {
      const hen = kind === 'hen';
      const tr = h('div', `sp-tureen ${hen ? 'hen' : 'royal'}`);
      const name = hen ? 'hen-tureen' : 'tureen';
      tr.append(photo(name, 't-base'), photo(name, 't-lid'));
      if (hen) tr.append(googly(36.5, 22, 5.5), googly(51.5, 19, 4.6));
      const rays = h('i', 'sp-rays');
      const mr = local({ x: mat.getBoundingClientRect().left, y: mat.getBoundingClientRect().top });
      const m = mat.getBoundingClientRect();
      tr.style.left = `${mr.x + m.width / 2}px`;
      tr.style.top = `${mr.y + m.height * 0.6}px`;
      tr.style.width = `${m.width * (hen ? 1.5 : 1.35)}px`;
      rays.style.left = tr.style.left;
      rays.style.top = `${mr.y - m.height}px`;
      fx.append(rays, tr);
      toon('slide-down', undefined, { vol: 0.8 });
      later(260, () => { bowl.classList.add('hide'); beater.classList.add('hide'); });
      later(280, () => {
        tr.classList.add('land');
        toon('clink', undefined, { vol: 1.3 });
        dust({ x: m.left + m.width / 2, y: m.top + m.height * 0.6 }, 8);
        bindi.mood('freeze');
        rusty.mood('freeze');
      });
      if (!hen) {
        later(420, () => { toon('fanfare'); rays.classList.add('on'); comic('BON APPÉTIT!', { x: m.left + m.width / 2, y: m.top - m.height * 3.2 }, 'big'); });
        later(560, () => {
          tr.classList.add('open');
          for (let k = 0; k < 3; k++) {
            later(k * 90, () => {
              const f = photo('herring', 'sp-flyfish');
              const r = fling(f, local({ x: m.left + m.width / 2, y: m.top }), local(centre(cat.el, 0.5 + (k - 1) * 0.15, 0.45)), 420, 90 + k * 20, 720);
              r.onfinish = () => f.remove();
            });
          }
          cat.svg.classList.remove('snot');
          zzz.remove();
          cat.mood('star');
          cat.hop(0.8);
          toon('pop');
        });
        later(1000, () => { cat.mood('eat'); toon('chomp'); });
        thievesFlee(900, 'not fair.');
        later(1100, () => chefSay('magnifique.', 'nod', 800));
        return;
      }
      // The hen: her lid hops up and down, BAWK BAWK, and the thieves run for it.
      later(480, () => {
        tr.classList.add('bawk');
        toon('cluck', undefined, { vol: 1.3 });
        jiggle(tr);
        comic('BAWK!', { x: m.left + m.width * 0.4, y: m.top - m.height * 2.4 }, 'big');
      });
      later(720, () => { toon('cluck', undefined, { vol: 1.3, rate: 1.15 }); jiggle(tr); });
      thievesFlee(640, 'EEK!');
      later(700, () => {
        cat.svg.classList.remove('snot');
        zzz.remove();
        cat.mood('happy');
        cat.hop(0.6);
      });
      later(1050, () => { cat.mood('smug'); comic('THANKS, HEN.', centre(cat.el, 0.4, -0.05), ''); });
    }
    /* Rusty reaches for the bowl; a bronze lobster in it pinches him. */
    function winLobster() {
      const at = centre(bowl, 0.5, 0.2);
      rusty.mood('smug');
      rusty.el.style.transitionDuration = '200ms';
      rusty.el.style.left = `${Math.max(START.rusty + STEP * 3, parseFloat(bindi.el.style.left) + 2)}%`;
      later(180, () => rusty.reach(at.x, at.y, 0.5));
      const lob = photo('lobster', 'sp-lobster');
      const r = bowl.getBoundingClientRect();
      const p = local({ x: r.left + r.width / 2, y: r.top + r.height * 0.3 });
      lob.style.left = `${p.x}px`;
      lob.style.top = `${p.y}px`;
      lob.style.width = `${r.width * 1.2}px`;
      later(260, () => { fx.append(lob); toon('slide-up', undefined, { vol: 0.6 }); });
      later(460, () => {
        lob.classList.add('snip');
        toon('clink', undefined, { vol: 1.4, rate: 1.4 });
        comic('SNIP!', { x: at.x - 30, y: at.y - 40 }, 'hit');
        punch(at, 1.14, 500);
      });
      later(540, () => {
        rusty.mood('shock');
        rusty.poof(1.45);
        rusty.hop(1.6);
        toon('yowl', undefined, { vol: 1, rate: 0.9 });
        comic('YOWCH!', centre(rusty.el, 0.5, -0.1), 'bad');
      });
      thievesFlee(820, '');
      wakeAndEat(700);
      later(900, () => lob.classList.add('back'));
      later(1300, () => lob.remove());
    }

    /* ---------------- misses ---------------- */

    /* Mookie sleeps through it. Bubble swells and pops; she wakes to an empty mat. */
    function wakeSad(delay) {
      later(delay, () => {
        cat.svg.style.setProperty('--snot', '2.4');
        toon('snore', undefined, { vol: 0.8 });
      });
      later(delay + 280, () => {
        cat.svg.classList.remove('snot');
        toon('pop', undefined, { vol: 1.2 });
        zzz.remove();
        cat.mood('shock');
        comic('POP!', centre(cat.el, 0.56, 0.36), 'hit');
      });
      later(delay + 560, () => { cat.mood('sad'); toon('wah', undefined, { vol: 0.9 }); });
    }
    function failHeist() {
      // Mission: supper. Bandit masks on, a quick tiptoe, Rusty scoops the bowl, gone.
      bindi.set('mask');
      rusty.set('mask');
      bindi.mood('sneak');
      rusty.mood('sneak');
      steps = MAX_STEPS + 1;
      for (let k = 0; k < 5; k++) {
        later(k * 70, () => {
          (k % 2 ? rusty : bindi).step(1.2);
          toon('tiptoe', undefined, { rate: 1 + (k % 3) * 0.15, vol: 0.7 });
        });
      }
      bindi.el.style.transitionDuration = '330ms';
      rusty.el.style.transitionDuration = '330ms';
      const br = bowl.getBoundingClientRect();
      const b = box();
      const rx = ((br.left - b.left) / b.width) * 100 - 14;
      bindi.el.style.left = `${rx - 6}%`;
      rusty.el.style.left = `${rx}%`;
      later(360, () => {
        rusty.reach(br.left + br.width / 2, br.top + br.height * 0.3, 0.3);
        toon('swish', undefined, { vol: 1.1 });
        comic('YOINK!', { x: br.left + br.width / 2, y: br.top - 20 }, 'bad');
      });
      later(470, () => {
        toon('zip');
        bindi.mood('smug');
        rusty.mood('smug');
        [bindi, rusty].forEach((k) => {
          k.el.style.transitionDuration = '420ms';
          k.el.style.left = '-50%';
          k.el.classList.add('flee');
        });
        bowl.style.transition = 'transform .42s ease-in';
        bowl.style.transform = `translate(${-(br.left - b.left) - br.width * 3}px, -30%) rotate(-30deg)`;
        dust({ x: br.left + br.width / 2, y: br.bottom }, 6);
      });
      wakeSad(700);
      later(1250, () => chefSay('tsk tsk.', 'tsk', 900));
    }
    function failYowl() {
      // Bindi lets rip. The blast flips Mookie out of her basket; Rusty eats in the confusion.
      steps = MAX_STEPS;
      place(220);
      later(120, () => {
        bindi.mood('yowl');
        toon('yowl', undefined, { vol: 1.2 });
        cutaway('bindi', 420, 'yowl');
      });
      later(400, () => comic('MRRRAOWWW!', centre(stage, 0.5, 0.3), 'big'));
      later(620, () => {
        bump(stage, 'sp-blast');
        cat.svg.classList.remove('snot');
        zzz.remove();
        cat.mood('dizzy');
        cat.el.classList.add('flipped');
        toon('boing', undefined, { vol: 1 });
        dust(centre(bed, 0.5, 0.5), 8);
      });
      later(640, () => {
        const br = bowl.getBoundingClientRect();
        const b = box();
        rusty.el.style.transitionDuration = '200ms';
        rusty.el.style.left = `${((br.left - b.left) / b.width) * 100 - 16}%`;
        rusty.mood('eat');
        fish.classList.add('eaten');
        toon('chomp', undefined, { vol: 1 });
      });
      later(1000, () => { rusty.mood('smug'); rusty.set('crumbs'); toon('burp'); comic('BURP.', centre(rusty.el, 0.6, 0.1), 'bad'); });
    }
    function failFlop() {
      // Rusty waddles over and flops belly-up across the bowl. MINE.
      const br = bowl.getBoundingClientRect();
      const b = box();
      bindi.mood('smug');
      rusty.mood('smug');
      rusty.el.style.transitionDuration = '300ms';
      rusty.el.style.left = `${((br.left - b.left + br.width / 2) / b.width) * 100 - 14}%`;
      for (let k = 0; k < 4; k++) later(k * 75, () => { rusty.step(1); toon(k % 2 ? 'step-2' : 'step-1', undefined, { vol: 0.5 }); });
      later(340, () => {
        rusty.el.classList.add('flop');
        rusty.mood('happy');
        rusty.set('crumbs', false);
        toon('thud', undefined, { vol: 1.3 });
        bump(stage, 'sp-quake');
        dust({ x: br.left + br.width / 2, y: br.bottom }, 8, 'fur');
        bowl.classList.add('squashed');
      });
      later(520, () => {
        rusty.mood('smug');
        const big = cutaway('rusty', 380, 'smug');
        big.look(0, 0);
      });
      later(940, () => comic('MINE.', centre(rusty.el, 0.5, 0.2), 'big'));
      wakeSad(820);
    }
    function failDecoy() {
      // Mookie wakes late and lunges... and bites a 5,000-year-old stone fish. The thieves
      // stroll off with the herring.
      const br = bowl.getBoundingClientRect();
      bowl.classList.add('decoy');
      const stone = photo('stone-fish', 'sp-stonefish');
      bowl.prepend(stone);
      fish.classList.add('eaten');
      steps = MAX_STEPS;
      place(220);
      const hf = photo('herring', 'sp-loot');
      rusty.el.append(hf);
      later(200, () => { rusty.mood('smug'); bindi.mood('smug'); });
      later(260, () => {
        cat.svg.classList.remove('snot');
        zzz.remove();
        cat.mood('hunt');
        toon('whistle-up', undefined, { vol: 0.8 });
        const from = cat.el.getBoundingClientRect();
        const dx = br.left + br.width * 0.6 - (from.left + from.width / 2);
        const dy = br.top - from.height * 0.6 - from.top;
        cat.el.animate([
          { transform: 'translate(0, 0)' },
          { transform: `translate(${dx * 0.5}px, ${dy - from.height * 0.4}px)`, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px)` },
        ], { duration: 300, easing: 'cubic-bezier(.3,.5,.5,1)', fill: 'forwards' });
      });
      later(560, () => {
        toon('thud', undefined, { vol: 1.2 });
        toon('pot', undefined, { vol: 0.9, rate: 0.6 });
        comic('CLONK!', { x: br.left + br.width / 2, y: br.top - 30 }, 'hit');
        cat.mood('dizzy');
        bump(stage, 'sp-quake');
        punch({ x: br.left + br.width / 2, y: br.top }, 1.14, 600);
      });
      later(820, () => {
        toon('raspberry');
        bubble('hee hee', centre(bindi.el, 0.5, 0.05));
        [bindi, rusty].forEach((k) => {
          k.el.style.transitionDuration = '700ms';
          k.el.style.left = '-45%';
        });
      });
      later(1200, () => chefSay('tsk.', 'tsk', 700));
    }

    /* ---------------- boss ---------------- */

    function bossKO() {
      // The final blast: Rusty is blown off the tureen, spins off the top, and lands flat as a rug.
      const at = centre(rusty.el, 0.5, 0.4);
      bump(beater, 'strike');
      cat.reach(...Object.values(centre(bowl, 0.5, 0.2)), 0.2);
      toon('ding', undefined, { vol: 1.4, rate: 0.8 });
      toon('gong', undefined, { vol: 0.8, rate: 2 });
      ring(5, 'big');
      later(200, () => {
        rusty.mood('shock');
        rusty.poof(1.7);
        rusty.el.classList.add('launch');
        toon('whistle-up', undefined, { vol: 1 });
        comic('KA-FWOOOSH!', { x: at.x, y: at.y - 40 }, 'big');
        flashSpeed('gold');
        dust(at, 10, 'fur');
      });
      later(900, () => {
        rusty.el.classList.remove('launch', 'lounge');
        rusty.el.classList.add('rug');
        rusty.mood('dizzy');
        rusty.poof(1);
        toon('thud', undefined, { vol: 1.4 });
        bump(stage, 'sp-quake');
        comic('FLUMP.', centre(rusty.el, 0.5, 0.6), 'hit');
        dust(centre(rusty.el, 0.5, 0.9), 8, 'fur');
        prize.classList.add('open');
        cat.mood('star');
        cat.hop(0.8);
      });
      later(1150, () => {
        const cup = photo('trophy', 'ms-trophy');
        const head = local(centre(cat.el, 0.5, 0));
        cup.style.left = `${head.x}px`;
        cup.style.top = `${head.y}px`;
        fx.append(cup);
        toon('choir', undefined, { vol: 1 });
        later(250, () => comic('CHAMPION!', { x: head.x + 40, y: head.y - 30 }, 'big'));
        chefSay('magnifique!', 'nod', 1000);
      });
    }
    function bossLose() {
      // He lifts the lid, eats the lot, burps, and rolls belly-up on the tureen.
      rusty.mood('eat');
      prize.classList.add('open');
      toon('chomp', undefined, { vol: 1.1 });
      later(260, () => toon('chomp'));
      later(520, () => { rusty.set('crumbs'); rusty.mood('smug'); toon('burp', undefined, { vol: 1.2 }); comic('BURRRP.', centre(rusty.el, 0.5, 0.1), 'bad'); });
      later(820, () => {
        rusty.el.classList.add('flop');
        rusty.mood('happy');
        bindi.mood('happy');
        toon('meow', undefined, { rate: 1.2 });
        cat.mood('sad');
      });
      later(1100, () => comic('MINE.', centre(rusty.el, 0.5, 0.2), 'big'));
      later(900, () => chefSay('tsk tsk.', 'tsk', 900));
    }
  },
};
