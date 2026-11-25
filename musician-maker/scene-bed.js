/* Bedtime, melodic only: the learner sits up in bed (their own avatar) and calls Mookie to bed
   with a tune. One of five bedrooms takes turns (THEMES): a kid's room, a castle, a camping
   tent, a spaceship bunk, a treehouse. A mobile turns over the bed on the beat, a night light
   glows, the moon is in the window, and on the right a doorway opens onto the dark hall.
   The call: Nanny Hoo, a German stoneware owl jug from 1540 with googly eyes, sings it from the
   nightstand; her head is the jug's lid and lifts on every note. Each note lights a star over
   the bed, as high as the note, so the stars are the tune. Mookie, a black cat in a dark hall,
   is only his eyes at first.
   The response: each note the learner sings or plays fills a star (gold on time, silver close,
   red way off; played notes go at their own height) and Mookie comes a step closer: eyes, then
   his head round the door frame, then all of him in the doorway.
   Win (random, never twice running): he hops up and snuggles; makes biscuits on the blanket;
   curls up on the learner's head like a hat; brings a sock as a present first; or Bindi and
   Rusty pile on too and the bed sags. Miss: the camera zooms in on the doorway and Mookie
   doesn't come: crickets; a dust bunny rolls past; two eyes blink and close; his tail flicks
   past and away; a cut to him asleep in the laundry basket; or Rusty comes instead.
   Boss: Rusty, The Bed Hog, sprawled across the whole bed with Mookie stuck on the floor. Each
   hit is a lullaby that makes him droop (eyelids, ears, a yawn, a snore); the last one and he
   rolls off onto the dog bed and Mookie takes his spot. A miss and he sits up wide awake.
   The owl is a CC0 museum photo (props/CREDITS.txt). Fixed markup only: nothing a learner
   types goes in here (call syllables are do, re, mi). */

import { rigMookie } from './rig.js';
import { rigCat } from './cats.js';
import { toon } from './sound.js';
import { gagDeck } from './gags.js';
import { avatar } from './avatar.js';
import { callBubble } from './speech.js';

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

const propUrl = (name) => new URL(`./props/${name}.webp`, import.meta.url).href;
let preloaded = false;
function preload() {
  if (preloaded) return;
  preloaded = true;
  new Image().src = propUrl('owl-jug');
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

/* Five bedrooms, one per game in turn: wall, bed, blanket, window and door frame change
   together (scene-bed.css, [data-theme]). */
const THEMES = ['kid', 'castle', 'tent', 'space', 'tree'];
let themeAt = Math.floor(Math.random() * THEMES.length);
const nextTheme = () => THEMES[themeAt++ % THEMES.length];

const WINDOW = `<svg viewBox="0 0 100 120" aria-hidden="true">
  <rect class="bd-sky" x="6" y="6" width="88" height="108" rx="8"/>
  <g class="bd-twinkle" fill="#fff8d8"><circle cx="24" cy="26" r="1.6"/><circle cx="70" cy="18" r="1.2"/><circle cx="80" cy="56" r="1.5"/><circle cx="18" cy="70" r="1.1"/><circle cx="46" cy="44" r="1"/><circle cx="60" cy="88" r="1.3"/></g>
  <path class="bd-moon" d="M62 30 a18 18 0 1 0 14 30 a14 14 0 1 1 -14 -30 Z" fill="#fff1b8"/>
  <path class="bd-aurora" d="M6 70 Q30 40 52 62 T94 50 V84 Q70 70 48 86 T6 84 Z" fill="url(#bd-aur)" opacity="0"/>
  <defs><linearGradient id="bd-aur" x1="0" x2="1"><stop offset="0" stop-color="#6cf0b0"/><stop offset=".5" stop-color="#7ab8ff"/><stop offset="1" stop-color="#c88cff"/></linearGradient></defs>
  <path d="M50 6 V114 M6 60 H94" class="bd-mull"/>
  <rect x="6" y="6" width="88" height="108" rx="8" class="bd-sash"/>
</svg>`;

/* The bed, side on: headboard on the left, footboard on the right. Back and front are two
   layers, so the learner sits up between them and the blanket covers their legs. */
const BED_BACK = `<svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
  <rect class="bd-wood" x="4" y="8" width="26" height="140" rx="6"/>
  <circle class="bd-wood" cx="17" cy="10" r="11"/>
  <rect class="bd-mattress" x="24" y="88" width="252" height="30" rx="10"/>
  <path class="bd-pillow" d="M30 64 Q30 52 46 54 L98 58 Q112 60 110 74 L108 88 Q104 96 90 94 L42 92 Q28 90 30 78 Z"/>
</svg>`;
const BED_FRONT = `<svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
  <path class="bd-blanket" d="M70 84 Q120 74 170 80 Q230 86 282 82 L284 128 Q200 136 120 132 L66 128 Q58 104 70 84 Z"/>
  <path class="bd-blanket-band" d="M70 84 Q120 74 170 80 Q230 86 282 82 L282 94 Q230 98 170 92 Q120 86 68 96 Z"/>
  <g class="bd-blanket-dots"><circle cx="120" cy="110" r="4"/><circle cx="160" cy="118" r="4"/><circle cx="200" cy="108" r="4"/><circle cx="240" cy="116" r="4"/><circle cx="96" cy="120" r="3"/></g>
  <rect class="bd-wood" x="272" y="64" width="22" height="84" rx="6"/>
  <circle class="bd-wood" cx="283" cy="66" r="9"/>
  <rect class="bd-wood" x="22" y="114" width="262" height="12" rx="4"/>
</svg>`;

const MOBILE = `<svg viewBox="0 0 120 90" aria-hidden="true">
  <path d="M60 0 V18 M20 22 H100" stroke="#d9d2c0" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M60 18 Q40 18 20 22 M60 18 Q80 18 100 22" stroke="#d9d2c0" stroke-width="1.6" fill="none"/>
  <g class="mb-a"><path d="M20 22 V44" stroke="#d9d2c0" stroke-width="1.2"/><path d="M20 44 l4 9 10 1 -8 6 3 10 -9 -6 -9 6 3 -10 -8 -6 10 -1 Z" fill="#f2c94c"/></g>
  <g class="mb-b"><path d="M60 18 V54" stroke="#d9d2c0" stroke-width="1.2"/><path d="M66 54 a12 12 0 1 0 6 20 a9 9 0 1 1 -6 -20 Z" fill="#fff1b8"/></g>
  <g class="mb-c"><path d="M100 22 V40" stroke="#d9d2c0" stroke-width="1.2"/><path d="M88 52 a7 7 0 0 1 6 -11 a9 9 0 0 1 16 2 a6 6 0 0 1 2 11 Z" fill="#cfe2ff"/></g>
</svg>`;

const SOCK = '<svg viewBox="0 0 60 70" aria-hidden="true"><path d="M14 2 H40 V38 Q40 44 46 48 L54 54 Q60 62 52 66 Q44 70 34 62 L18 50 Q12 46 14 38 Z" fill="#e5484d" stroke="#17171b" stroke-width="2.5"/><path d="M14 2 H40 V14 H14 Z" fill="#fff" stroke="#17171b" stroke-width="2.5"/><path d="M14 22 H40 M14 30 H40" stroke="#fff" stroke-width="4"/></svg>';
/* The laundry basket: the laundry behind Mookie, the wicker in front of him (and a sock on top). */
const BASKET_BACK = '<svg viewBox="0 0 200 120" aria-hidden="true"><path d="M24 34 Q14 8 46 12 Q70 -2 100 12 Q130 0 156 14 Q190 8 178 34 Z" fill="#9fc5e8" stroke="#17171b" stroke-width="2.5"/></svg>';
const BASKET = '<svg viewBox="0 0 200 120" aria-hidden="true"><path d="M10 30 H190 L176 114 Q100 122 24 114 Z" fill="#d8a85b" stroke="#17171b" stroke-width="3"/><path d="M20 50 H180 M24 72 H176 M28 94 H172" stroke="#a87a35" stroke-width="5"/><path d="M40 30 V112 M70 30 V116 M100 30 V118 M130 30 V116 M160 30 V112" stroke="#a87a35" stroke-width="4"/><path d="M6 30 Q100 18 194 30" stroke="#17171b" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M150 32 Q148 14 160 12 L172 14 Q176 24 170 32" fill="#e5484d" stroke="#17171b" stroke-width="2.5"/></svg>';
const DOGBED = '<svg viewBox="0 0 200 80" aria-hidden="true"><ellipse cx="100" cy="52" rx="96" ry="26" fill="#7a5bb5" stroke="#17171b" stroke-width="3"/><ellipse cx="100" cy="48" rx="70" ry="14" fill="#b79be8"/><text x="100" y="74" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="13" font-weight="700" fill="#fff">WOOF</text></svg>';
const POT = '<svg viewBox="0 0 80 60" aria-hidden="true"><path d="M8 18 H72 L66 54 Q40 60 14 54 Z" fill="#9aa3ad" stroke="#17171b" stroke-width="3"/><path d="M2 20 H78" stroke="#17171b" stroke-width="5" stroke-linecap="round"/><path d="M30 10 H50" stroke="#17171b" stroke-width="6" stroke-linecap="round"/></svg>';

const GAGS = {
  win: { snuggle: 'Hops up and snuggles', biscuits: 'Biscuits on the blanket', hat: 'Sleeps on your head', sock: 'Brings a sock first', pile: 'Cat pile' },
  fail: { crickets: 'Crickets', dustbunny: 'A dust bunny rolls past', eyes: 'Eyes blink and close', tail: 'Tail flicks away', basket: 'Asleep in the laundry', rusty: 'Rusty comes instead' },
};
const winGag = gagDeck(['snuggle', 'snuggle', 'biscuits', 'hat', 'sock', 'pile'], () => bedtime.gagsOn?.win);
const failGag = gagDeck(['crickets', 'crickets', 'dustbunny', 'eyes', 'tail', 'basket', 'rusty'], () => bedtime.gagsOn?.fail);

/* Mookie in the hall: how far along he is, from out of sight (0) to standing in the doorway
   (3), as his left edge in % of the stage width. */
const COME = [130, 80, 77, 74];
const BED_SPOT = { left: 41, bottom: 31 }; // on the blanket, next to the learner

export const bedtime = {
  id: 'bedtime',
  name: 'Bedtime',
  tap: 'finger-cymbals',
  pickClass: 'opt-bed',
  slotIcon: (c) => (c === 'ee' ? '⭐⭐' : '⭐'),
  bossName: 'The Bed Hog',
  gags: GAGS,
  make(stage, { boss = false, me = null } = {}) {
    stage.className = `stage scene-bd${boss ? ' boss' : ''}`;
    stage.dataset.theme = nextTheme();
    preload();
    const cam = h('div', 'bd-cam');
    const wall = h('div', 'bd-wall');
    const floor = h('div', 'bd-floor');
    const rug = h('div', 'bd-rug');
    const win = h('div', 'bd-window');
    win.innerHTML = WINDOW; // fixed markup
    const glow = h('div', 'bd-glowstars');
    for (let i = 0; i < 9; i++) glow.append(h('i'));
    const mobile = h('div', 'bd-mobile');
    mobile.innerHTML = MOBILE; // fixed markup
    const lamp = h('div', 'bd-nightlight');
    lamp.append(h('i'));
    // The hall: dark, with a little light far back; the frame goes over it, and over Mookie.
    const hall = h('div', 'bd-hall');
    hall.append(h('i', 'bd-hall-light'));
    const frame = h('div', 'bd-frame');
    const wallR = h('div', 'bd-wall-r');
    // Nanny Hoo on the nightstand.
    const stand = h('div', 'bd-stand');
    const owl = h('div', 'bd-owl');
    const owlIn = h('div', 'o-in');
    owlIn.append(photo('owl-jug', 'o-body'), photo('owl-jug', 'o-head'), googly(46, 19.5, 17), googly(76, 19.5, 15));
    const lid = owlIn.querySelector('.o-head');
    owlIn.querySelectorAll('.googly').forEach((g) => lid.after(g));
    owl.append(owlIn);
    const bedBack = h('div', 'bd-bed bd-bed-back');
    bedBack.innerHTML = BED_BACK; // fixed markup
    const bedFront = h('div', 'bd-bed bd-bed-front');
    bedFront.innerHTML = BED_FRONT; // fixed markup
    const kid = me ? avatar(me, { bg: false }) : avatar(undefined, { bg: false });
    kid.classList.add('bd-kid');
    const cat = rigMookie();
    cat.el.classList.add('bd-mookie');
    const ladder = h('div', 'bd-ladder');
    const fx = h('div', 'ms-fx bd-fx');
    const zzz = h('div', 'bd-zzz');
    zzz.append(h('i', '', 'z'), h('i', '', 'z'), h('i', '', 'Z'));
    let rusty = null;
    let dogbed = null;
    if (boss) {
      rusty = rigCat('rusty');
      rusty.el.classList.add('bd-hog');
      dogbed = h('div', 'bd-dogbed');
      dogbed.innerHTML = DOGBED; // fixed markup
      cam.append(wall, glow, win, mobile, lamp, hall, wallR, frame, floor, rug, dogbed, stand, owl, bedBack, kid, rusty.el, bedFront, cat.el, zzz, ladder);
    } else {
      cam.append(wall, glow, win, mobile, lamp, hall, cat.el, wallR, frame, floor, rug, stand, owl, bedBack, kid, bedFront, zzz, ladder);
    }
    stage.append(cam, fx);

    let busy = false;
    let come = 0;
    let swing = 1;
    let downs = 0;
    let droop = 0;
    let calls = []; // the call's notes: { i, up }
    let mine = 0; // the learner's notes so far
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
      c.style.left = `${clampX(p.x, 0.16)}px`;
      c.style.top = `${Math.max(30, p.y)}px`;
      c.style.setProperty('--rot', `${(Math.random() * 16 - 8).toFixed(1)}deg`);
      fx.append(c);
      later(900, () => c.remove());
    }
    function bubble(text, at, ms = 700) {
      const p = local(at);
      const b = h('div', 'ms-bubble', text);
      b.style.left = `${clampX(p.x)}px`;
      b.style.top = `${Math.max(34, p.y)}px`;
      if (ms !== 700) b.style.animationDuration = `${ms}ms`;
      fx.append(b);
      later(ms, () => b.remove());
    }
    function hearts(at, n = 5) {
      const p = local(at);
      for (let k = 0; k < n; k++) {
        const ht = h('i', 'bd-heart', '♥');
        ht.style.left = `${p.x + (Math.random() * 2 - 1) * 40}px`;
        ht.style.top = `${p.y}px`;
        ht.style.animationDelay = `${k * 110}ms`;
        fx.append(ht);
        later(1300 + k * 110, () => ht.remove());
      }
    }

    /* Stars over the bed: the call's (outlined) and the learner's (filled), in columns by note
       and as high as the note. */
    function star(col, up, cls) {
      const s = h('i', `bd-star ${cls}`);
      s.style.setProperty('--col', col);
      s.style.setProperty('--up', (up ?? 0.5).toFixed(3));
      ladder.append(s);
      return s;
    }

    /* Mookie in the hall comes a step closer (or goes back). */
    function place(ms = 260) {
      cat.el.style.transitionDuration = `${ms}ms`;
      cat.el.style.left = `${COME[Math.max(0, Math.min(3, come))]}%`;
      stage.dataset.come = come;
    }

    let owlBusy = 0;
    function owlSing(text, i = 0, syl = null) {
      clearTimeout(owlBusy);
      owl.classList.remove('sing');
      void owl.offsetWidth;
      owl.classList.add('sing', 'talk');
      jiggle(owl);
      later(150, () => owl.classList.remove('talk'));
      const at = centre(owl, 0.55, 0.02);
      if (syl) callBubble(fx, i, syl, local(at).x, Math.max(34, local(at).y));
      else if (text) bubble(text, at);
      owlBusy = later(700, () => owl.classList.remove('sing'));
    }

    // Starting poses.
    cat.mood('idle');
    cat.look(-1, 0);
    if (boss) {
      cat.el.classList.add('floor');
      cat.mood('sad');
      cat.look(-0.6, -0.4);
      rusty.mood('smug');
      rusty.look(1, 0);
      rusty.el.classList.add('lounge');
    } else place(0);

    /* The camera moves in until the doorway fills the middle of the stage. */
    function zoomDoor(scale = 1.45, ms = 650) {
      const p = local(centre(hall, 0.5, 0.5));
      const b = box();
      cam.style.transformOrigin = '0 0';
      cam.style.transition = `transform ${ms}ms cubic-bezier(.3, .7, .3, 1)`;
      cam.style.transform = `translate(${b.width / 2 - p.x * scale}px, ${b.height * 0.55 - p.y * scale}px) scale(${scale})`;
    }

    return {
      onCall(i, syl, tone) {
        if (busy) return;
        if (i === 0) {
          ladder.replaceChildren();
          calls = [];
          mine = 0;
        }
        calls[i] = tone?.up ?? 0.5;
        if (boss) {
          rusty.say(200, 'open');
          bubble(syl || 'mrrp', centre(rusty.el, 0.5, 0.1));
          star(i, tone?.up, 'call');
          return;
        }
        owlSing(syl ? null : '♪ hoo', i, syl);
        star(i, tone?.up, 'call');
        // Somewhere in the dark hall, two eyes open.
        if (come === 0 && i === 0) { come = 1; place(400); }
        cat.look(-1, (tone?.up ?? 0.5) * -0.6);
        bump(cat.el, 'ear');
      },
      onTap(fb = {}) {
        if (busy || fb.cls === 'idle') return;
        const col = mine++;
        const up = fb.up ?? calls[col] ?? 0.5;
        const s = star(col, up, `mine ${fb.cls || 'tap'}`);
        bump(s, 'pop');
        if (boss) {
          rusty.mood('sleepy');
          later(300, () => { if (!busy) rusty.mood(droop >= 2 ? 'sleepy' : 'smug'); });
          return;
        }
        if (fb.cls === 'off') {
          // A sour note: he stops and flattens his ears.
          bump(cat.el, 'balk');
          return;
        }
        come = Math.min(3, come + 1);
        place();
        cat.mood(come >= 3 ? 'happy' : 'idle');
        cat.hop(0.15);
      },
      onBeat(down, spb, tier = 0) {
        stage.dataset.tier = tier;
        cat.beat(down, spb, tier);
        rusty?.beat(down, spb, tier);
        // The mobile swings to each beat; the night light glows on beat 1.
        const to = swing * (6 + tier * 3);
        swing = -swing;
        mobile.animate([{ transform: `rotate(${-to}deg)` }, { transform: `rotate(${to}deg)` }],
          { duration: spb * 1000, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
        if (down) { downs++; bump(lamp, 'glow'); }
        if (down && !busy) bump(owl, 'bob');
        if (tier >= 2) lamp.dataset.hue = downs % 4;
        if (tier >= 3 && down) glow.children[downs % glow.children.length].classList.toggle('on');
        if (boss && droop >= 3 && down) { const z = zzz.children[downs % 3]; bump(z, 'zpop'); }
      },
      /* Boss rounds: each hit is a lullaby, and The Bed Hog droops. */
      hit() {
        droop++;
        toon('choir', undefined, { vol: 0.5 });
        bump(owl, 'bob');
        owlSing('♪ shh', 0);
        const at = centre(rusty.el, 0.5, 0.2);
        rusty.el.dataset.droop = droop;
        if (droop === 1) { rusty.mood('sleepy'); comic('droop…', at, 'hit'); }
        else if (droop === 2) { rusty.mood('sleepy'); rusty.say(700, 'open'); toon('yawn'); comic('YAAAWN', at, 'hit'); }
        else { rusty.mood('sleepy'); toon('snore'); comic('SNORE', at, 'hit'); zzz.classList.add('on'); }
      },
      miss() {
        droop = Math.max(0, droop - 1);
        rusty.el.dataset.droop = droop;
        zzz.classList.toggle('on', droop >= 3);
        rusty.mood('shock');
        bump(rusty.el, 'situp');
        const pot = h('div', 'bd-pot');
        pot.innerHTML = POT; // fixed markup
        const at = local(centre(rusty.el, 0.7, 0.1));
        pot.style.left = `${at.x}px`;
        pot.style.top = `${at.y}px`;
        fx.append(pot);
        later(900, () => pot.remove());
        toon('pot');
        later(180, () => toon('pot', undefined, { rate: 1.2 }));
        comic('CLANG!', centre(rusty.el, 0.7, 0), 'bad');
        later(700, () => rusty.mood('smug'));
        cat.mood('sad');
      },
      win(force) {
        busy = true;
        if (boss) return bossWin();
        const gag = winGag(force);
        if (gag === 'biscuits') return winBiscuits();
        if (gag === 'hat') return winHat();
        if (gag === 'sock') return winSock();
        if (gag === 'pile') return winPile();
        return winSnuggle();
      },
      fail(force) {
        busy = true;
        if (boss) return bossLose();
        const gag = failGag(force);
        zoomDoor();
        // He doesn't come: back into the dark.
        come = 0;
        place(500);
        if (gag === 'dustbunny') return failDustBunny();
        if (gag === 'eyes') return failEyes();
        if (gag === 'tail') return failTail();
        if (gag === 'basket') return failBasket();
        if (gag === 'rusty') return failRusty();
        return failCrickets();
      },
    };

    /* ---------------- wins ---------------- */

    /* Mookie out of the doorway and up onto the bed, in a hop or two. Resolves on landing. */
    function hopToBed(spot = BED_SPOT, ms = 620) {
      cat.el.style.transitionDuration = '0ms';
      const from = cat.el.getBoundingClientRect();
      cat.el.classList.add('onbed');
      cat.el.style.left = `${spot.left}%`;
      cat.el.style.bottom = `${spot.bottom}%`;
      const to = cat.el.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      cat.mood('happy');
      cat.look(-1, 0);
      toon('whistle-up', undefined, { vol: 0.6 });
      cat.el.animate([
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - box().height * 0.22}px)`, offset: 0.5 },
        { transform: 'translate(0, 0)' },
      ], { duration: ms, easing: 'cubic-bezier(.3,.6,.5,1)' });
      return new Promise((r) => later(ms, () => { toon('thud', undefined, { vol: 0.7 }); bump(bedFront, 'squish'); r(); }));
    }
    function settle(delay = 0) {
      later(delay, () => {
        cat.mood('sleep');
        zzz.classList.add('on', 'cat');
        toon('snore', undefined, { vol: 0.5 });
        kid.classList.add('sleepy');
      });
    }
    function winSnuggle() {
      hopToBed().then(() => {
        cat.mood('purr');
        toon('purr');
        hearts(centre(cat.el, 0.5, 0.2));
        bump(kid, 'hug');
        bubble('purrrr', centre(cat.el, 0.5, 0.1), 1000);
        settle(900);
      });
    }
    function winBiscuits() {
      hopToBed().then(() => {
        cat.mood('purr');
        toon('purr');
        for (let k = 0; k < 6; k++) later(k * 170, () => { cat.knead(k % 2 ? 1 : -1); bump(bedFront, 'knead'); toon('pat', undefined, { vol: 0.4, rate: 1.4 }); });
        comic('BISCUITS!', centre(cat.el, 0.5, 0.2), 'hit');
        settle(1100);
      });
    }
    function winHat() {
      const r = kid.getBoundingClientRect();
      const b = box();
      const spot = { left: ((r.left - b.left) / b.width) * 100 - 1, bottom: ((b.bottom - r.top) / b.height) * 100 - 14 };
      hopToBed(spot, 700).then(() => {
        cat.el.classList.add('hat');
        bump(kid, 'squash');
        comic('NEW HAT!', centre(cat.el, 0.5, 0), 'hit');
        toon('boing');
        settle(700);
      });
    }
    function winSock() {
      const sock = h('div', 'bd-sock');
      sock.innerHTML = SOCK; // fixed markup
      cat.el.append(sock);
      hopToBed().then(() => {
        sock.remove();
        const s2 = h('div', 'bd-sock dropped');
        s2.innerHTML = SOCK; // fixed markup
        const at = local(centre(cat.el, 0.1, 0.7));
        s2.style.left = `${at.x}px`;
        s2.style.top = `${at.y}px`;
        fx.append(s2);
        bubble('a present!', centre(cat.el, 0.4, 0), 1000);
        toon('meow', undefined, { rate: 1.1 });
        bump(kid, 'hug');
        later(500, () => { cat.mood('purr'); toon('purr'); });
        settle(1100);
      });
    }
    function winPile() {
      hopToBed().then(() => {
        cat.mood('purr');
        const pile = ['bindi', 'rusty'].map((k, i) => {
          const c = rigCat(k);
          c.el.classList.add('bd-piler', `p${i}`);
          c.mood('happy');
          cam.append(c.el);
          later(200 + i * 300, () => {
            c.el.classList.add('in');
            toon('thud');
            bump(bedFront, 'squish');
            bedBack.classList.add('sag');
            bedFront.classList.add('sag');
          });
          return c;
        });
        later(800, () => { comic('CAT PILE!', centre(bedFront, 0.5, 0), 'hit'); toon('creak'); });
        later(1100, () => { pile.forEach((c) => c.mood('sleepy')); settle(0); });
      });
    }

    /* ---------------- misses: the camera on the empty doorway ---------------- */

    function crickets(n = 3) {
      for (let k = 0; k < n; k++) later(200 + k * 260, () => toon('squeak', undefined, { vol: 0.25, rate: 2 }));
    }
    function failCrickets() {
      crickets(4);
      later(250, () => bubble('…', centre(hall, 0.5, 0.4), 1200));
    }
    function failDustBunny() {
      const bun = h('i', 'bd-dustbunny');
      hall.append(bun);
      crickets(2);
      toon('swish', undefined, { vol: 0.4, rate: 0.6 });
    }
    function failEyes() {
      come = 2;
      place(0);
      cat.mood('idle');
      later(300, () => cat.mood('sleep'));
      later(500, () => bubble('z', centre(hall, 0.6, 0.4), 900));
      toon('yawn', undefined, { vol: 0.6 });
    }
    function failTail() {
      const tail = h('i', 'bd-tail');
      hall.append(tail);
      later(300, () => toon('swish'));
      crickets(2);
    }
    function failBasket() {
      later(350, () => {
        const cut = h('div', 'ms-cut bd-cut');
        cut.append(h('div', 'ms-cut-lines'));
        const back = h('div', 'bd-basket');
        back.innerHTML = BASKET_BACK; // fixed markup
        const basket = h('div', 'bd-basket');
        basket.innerHTML = BASKET; // fixed markup
        const big = rigMookie();
        big.el.classList.add('bd-basket-cat');
        big.mood('sleep');
        cut.append(back, big.el, basket);
        stage.append(cut);
        toon('snore');
        later(1300, () => cut.classList.add('out'));
        later(1460, () => cut.remove());
      });
    }
    function failRusty() {
      const r = rigCat('rusty');
      r.el.classList.add('bd-impostor');
      r.mood('smug');
      r.look(-1, 0);
      cam.insertBefore(r.el, wallR);
      later(80, () => r.el.classList.add('in'));
      later(450, () => { bubble('wrong cat', centre(hall, 0.5, 0.25), 1100); toon('meow', undefined, { rate: 0.8 }); });
    }

    /* ---------------- The Bed Hog ---------------- */

    function bossWin() {
      zzz.classList.remove('on');
      rusty.mood('sleepy');
      toon('snore');
      comic('ZZZ…', centre(rusty.el, 0.5, 0), 'hit');
      // He rolls off the bed onto the dog bed.
      later(400, () => {
        rusty.el.classList.add('rolled');
        toon('whistle-down', undefined, { vol: 0.6 });
        later(600, () => { toon('thud'); comic('FLUMP', centre(dogbed, 0.5, 0), 'hit'); });
      });
      later(900, () => {
        cat.el.classList.remove('floor');
        hopToBed({ left: 42, bottom: 31 }, 560).then(() => {
          cat.mood('purr');
          hearts(centre(cat.el, 0.5, 0.2), 7);
          toon('purr');
          settle(600);
        });
      });
    }
    function bossLose() {
      rusty.mood('sleepy');
      zzz.classList.add('on');
      toon('snore');
      later(300, () => { cat.mood('sad'); bubble('…', centre(cat.el, 0.5, 0), 1000); });
      later(900, () => { cat.mood('sleep'); toon('snore', undefined, { vol: 0.4, rate: 1.3 }); });
    }
  },
};
