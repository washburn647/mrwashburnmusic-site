/* Mouse Catcher, the full production: a room with a pendulum clock that swings on the beat,
   a WANTED poster, a mouse hole in the baseboard, and rigged Mookie (rig.js) on her rug.
   The mouse squeaks the call from the hole; every tap is a rubber-hose paw swipe at it.
   Win: she yanks the mouse out by the tail and it waves a white flag. Miss: it zips out in
   sunglasses, blows a raspberry and zips home. Now and then a WarioWare-style close-up cuts
   in. The room gets a party as the combo grows: the poster bops, a disco ball drops, the
   spotlights swing, and at full band the floor lights up and Mookie puts on her shades.
   Boss: The Big Cheese stands by the hole; each hit bonks him, the last one launches him.
   Fixed markup only: nothing a learner types goes in here (call syllables are du/de). */

import { rigMookie } from './rig.js';
import { critter } from './critters.js';
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

const CLOCK = `<svg viewBox="0 0 80 150" aria-hidden="true">
  <g class="ms-pend"><path d="M40 60 L40 128" stroke="#8a6a3c" stroke-width="3"/><circle cx="40" cy="132" r="10" fill="#e3b85a" stroke="#a87f2a" stroke-width="2"/><circle cx="37" cy="129" r="3" fill="#fff3c4" opacity=".7"/></g>
  <path d="M10 46 L40 12 L70 46 L70 140 L10 140 Z" fill="#9c6b3e" opacity="0"/>
  <path d="M12 40 Q40 4 68 40 L68 64 L12 64 Z" fill="#8a5a32" stroke="#5f3c20" stroke-width="2"/>
  <circle cx="40" cy="40" r="20" fill="#fbf3dc" stroke="#5f3c20" stroke-width="3"/>
  <g stroke="#5f3c20" stroke-width="2" stroke-linecap="round"><path d="M40 23 V27 M40 53 V57 M23 40 H27 M53 40 H57"/></g>
  <g class="ms-hands" stroke="#2a2a2a" stroke-linecap="round"><path class="ms-hand-h" d="M40 40 L40 30" stroke-width="3"/><path class="ms-hand-m" d="M40 40 L50 40" stroke-width="2"/></g>
  <circle cx="40" cy="40" r="2.4" fill="#2a2a2a"/>
  <path d="M14 64 H66 L62 70 H18 Z" fill="#6e4526"/>
</svg>`;

const POSTER = `<svg viewBox="0 0 90 110" aria-hidden="true">
  <path d="M4 4 L86 2 L88 106 L2 108 Z" fill="#f1dfb4" stroke="#c8a96a" stroke-width="2"/>
  <text x="45" y="22" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="17" fill="#6b3d1f">WANTED</text>
  <g transform="translate(19 26) scale(.43)">
    <circle cx="36" cy="25" r="17" fill="#a9a2ae"/><circle cx="36" cy="25" r="11" fill="#f0aab6"/>
    <circle cx="84" cy="25" r="17" fill="#a9a2ae"/><circle cx="84" cy="25" r="11" fill="#f0aab6"/>
    <ellipse cx="60" cy="47" rx="25" ry="22" fill="#a9a2ae"/><ellipse cx="60" cy="57" rx="13" ry="9" fill="#e2dce4"/>
    <ellipse cx="50" cy="43" rx="4.4" ry="5.8" fill="#141418"/><ellipse cx="70" cy="43" rx="4.4" ry="5.8" fill="#141418"/>
    <circle cx="60" cy="52" r="3.6" fill="#e07a8c"/><path d="M54 60 Q60 65 66 60" stroke="#4a3438" stroke-width="1.6" fill="none"/></g>
  <text x="45" y="84" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="9" fill="#6b3d1f">REWARD</text>
  <g transform="translate(22 88)"><path d="M0 12 L22 2 L22 12 Z" fill="#f2c94c"/><circle cx="16" cy="8" r="1.6" fill="#d9a93a"/>
    <path d="M24 12 L46 2 L46 12 Z" fill="#f2c94c"/><circle cx="38" cy="8" r="1.6" fill="#d9a93a"/></g>
  <circle cx="45" cy="5" r="2.5" fill="#b33"/>
</svg>`;

const WINDOW = `<svg viewBox="0 0 100 110" aria-hidden="true">
  <rect x="8" y="8" width="84" height="84" rx="4" fill="#2c3e66"/>
  <rect x="8" y="8" width="84" height="84" rx="4" fill="url(#ms-sky)"/>
  <defs><linearGradient id="ms-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2a4f"/><stop offset="1" stop-color="#4a5f93"/></linearGradient></defs>
  <circle cx="66" cy="30" r="11" fill="#fff6d0"/><circle cx="71" cy="27" r="10" fill="#2a3a63" opacity=".9"/>
  <g class="ms-stars" fill="#fff6d0"><circle cx="22" cy="22" r="1.4"/><circle cx="40" cy="38" r="1.1"/><circle cx="30" cy="58" r="1.3"/><circle cx="78" cy="62" r="1.2"/><circle cx="55" cy="16" r="1"/></g>
  <path d="M8 76 Q30 66 50 74 T92 70 V92 H8 Z" fill="#22324f" opacity=".9"/>
  <path d="M50 8 V92 M8 50 H92" stroke="#f6ead0" stroke-width="4"/>
  <rect x="8" y="8" width="84" height="84" rx="4" fill="none" stroke="#f6ead0" stroke-width="6"/>
  <path d="M2 4 Q14 50 6 98 L24 98 Q16 50 22 4 Z" fill="#7d9a6b"/><path d="M98 4 Q86 50 94 98 L76 98 Q84 50 78 4 Z" fill="#7d9a6b"/>
  <path d="M0 2 H100" stroke="#8a5a32" stroke-width="5" stroke-linecap="round"/>
  <rect x="2" y="96" width="96" height="8" rx="2" fill="#efe1c2"/>
</svg>`;

const PLANT = `<svg viewBox="0 0 70 110" aria-hidden="true">
  <g class="ms-leaves" fill="#5e7d4f" stroke="#476139" stroke-width="1.2">
    <path d="M35 70 Q10 50 8 22 Q28 34 35 70 Z"/><path d="M35 70 Q60 52 64 24 Q42 36 35 70 Z"/>
    <path d="M35 70 Q24 36 34 4 Q46 36 35 70 Z" fill="#6f9160"/><path d="M35 72 Q14 66 4 52 Q24 54 35 72 Z" fill="#6f9160"/><path d="M35 72 Q56 66 66 52 Q46 54 35 72 Z"/></g>
  <path d="M16 70 H54 L49 106 H21 Z" fill="#c46a5a"/><path d="M13 66 H57 V74 H13 Z" fill="#a85546"/>
</svg>`;

const CHEESE = `<svg viewBox="0 0 60 40" aria-hidden="true"><path d="M2 36 L56 8 L58 36 Z" fill="#f2c94c" stroke="#c99a2e" stroke-width="2" stroke-linejoin="round"/><path d="M56 8 Q40 4 2 36" fill="#ffe28a" opacity=".6"/><circle cx="40" cy="26" r="4" fill="#d9a93a"/><circle cx="26" cy="31" r="2.5" fill="#d9a93a"/><circle cx="50" cy="19" r="2.2" fill="#d9a93a"/></svg>`;

export const mouseCatcher = {
  id: 'mouse-catcher',
  name: 'Mouse Catcher',
  tap: 'snare',
  pickClass: 'opt-hole',
  slotIcon: (c) => (c === 'ee' ? '🧀🧀' : '🧀'),
  make(stage, { boss = false } = {}) {
    stage.className = `stage scene-ms${boss ? ' boss' : ''}`;
    const cam = h('div', 'ms-cam');
    const wall = h('div', 'ms-wall');
    const clock = h('div', 'ms-clock');
    clock.innerHTML = CLOCK; // fixed markup
    const pend = clock.querySelector('.ms-pend');
    const poster = h('div', 'ms-poster');
    poster.innerHTML = POSTER; // fixed markup
    const disco = h('div', 'ms-disco');
    disco.append(h('i', 'ms-disco-ball'));
    const lights = h('div', 'ms-lights');
    lights.append(h('i', 'l'), h('i', 'r'));
    const floor = h('div', 'ms-floor');
    const tiles = h('div', 'ms-tiles');
    for (let i = 0; i < 24; i++) tiles.append(h('i'));
    floor.append(tiles);
    const base = h('div', 'ms-base');
    const hole = h('div', 'ms-hole');
    const mask = h('div', 'ms-mask');
    const eyes = h('div', 'ms-eyes');
    eyes.append(h('i'), h('i'));
    const mouse = critter('mouse');
    mouse.classList.add('ms-mouse');
    mask.append(eyes, mouse);
    hole.append(mask, h('div', 'ms-hole-rim'));
    const rug = h('div', 'ms-rug');
    const cat = rigMookie();
    cat.el.classList.add('ms-cat');
    const fx = h('div', 'ms-fx');
    const speed = h('div', 'ms-speed');
    const win = h('div', 'ms-window');
    win.innerHTML = WINDOW; // fixed markup
    const plant = h('div', 'ms-plant');
    plant.innerHTML = PLANT; // fixed markup
    wall.append(win, clock, poster, disco);
    cam.append(wall, lights, floor, base, hole, plant, rug, cat.el);
    let rat = null;
    let cheese = null;
    if (boss) {
      rat = critter('boss');
      rat.classList.add('ms-rat');
      cheese = h('div', 'ms-cheese');
      cheese.innerHTML = CHEESE; // fixed markup
      cam.append(cheese, rat);
    }
    stage.append(cam, speed, fx);

    let swing = 1;
    let tierNow = 0;
    let hits = 0;
    let busy = false; // a gag is playing
    const box = () => stage.getBoundingClientRect();
    const centre = (el, fy = 0.5) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * fy };
    };
    const local = (p) => {
      const b = box();
      return { x: p.x - b.left, y: p.y - b.top };
    };
    const target = () => (rat ? centre(rat, 0.28) : centre(hole, 0.62));

    /* Comic lettering at a point in the stage (fractions or px). */
    function comic(text, at, cls = '') {
      const p = local(at);
      const c = h('b', `ms-comic ${cls}`, text);
      c.style.left = `${p.x}px`;
      c.style.top = `${p.y}px`;
      c.style.setProperty('--rot', `${(Math.random() * 16 - 8).toFixed(1)}deg`);
      fx.append(c);
      later(900, () => c.remove());
      return c;
    }

    function dust(at, n = 6) {
      const p = local(at);
      for (let i = 0; i < n; i++) {
        const d = h('i', 'ms-dust');
        d.style.left = `${p.x}px`;
        d.style.top = `${p.y}px`;
        d.style.setProperty('--dx', `${(Math.random() * 2 - 1) * 46}px`);
        d.style.setProperty('--dy', `${-Math.random() * 26}px`);
        d.style.setProperty('--s', (0.6 + Math.random() * 0.8).toFixed(2));
        fx.append(d);
        later(600, () => d.remove());
      }
    }

    function bubble(text, at) {
      const p = local(at);
      const b = h('div', 'ms-bubble', text);
      b.style.left = `${p.x}px`;
      b.style.top = `${p.y}px`;
      fx.append(b);
      later(700, () => b.remove());
    }

    /* Camera punch-in toward a point, then back. */
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

    /* WarioWare-style close-up: a big face fills the stage for a moment. */
    function cutaway(who, ms = 420) {
      const cut = h('div', `ms-cut ${who}`);
      cut.append(h('div', 'ms-cut-lines'));
      if (who === 'cat') {
        const big = rigMookie();
        big.el.classList.add('ms-cut-face');
        big.mood('smug');
        cut.append(big.el);
        later(ms * 0.4, () => big.mood('star'));
      } else {
        const big = critter(who === 'rat' ? 'boss' : 'mouse');
        big.classList.add('ms-cut-face', 'shades', 'tongue');
        cut.append(big);
      }
      stage.append(cut);
      later(ms, () => cut.classList.add('out'));
      later(ms + 160, () => cut.remove());
    }

    // Mookie watches the hole.
    cat.look(0.9, 0.35);

    return {
      onCall(i, syl) {
        if (busy) return;
        if (cat.moodName === 'idle') cat.mood('hunt');
        if (rat) {
          rat.say(220);
          bump(rat, 'taunt');
          bubble(syl || 'nyah!', centre(rat, 0.05));
          return;
        }
        bump(mouse, 'peek');
        mouse.say(220);
        bubble(syl || 'squeak!', centre(hole, -0.25));
      },
      onTap() {
        if (busy) return;
        const at = target();
        cat.reach(at.x, at.y, 0.09);
        later(70, () => {
          dust({ x: at.x, y: at.y + 10 }, 4);
          if (rat) bump(rat, 'flinch');
          else bump(mouse, 'duck');
        });
        bump(stage, 'ms-thud');
      },
      onBeat(down, spb, tier = 0) {
        tierNow = tier;
        cat.beat(down, spb, tier);
        // The pendulum lands on each beat: it swings to the other side over one beat.
        const to = swing * 22;
        swing = -swing;
        pend.animate([{ transform: `rotate(${-to}deg)` }, { transform: `rotate(${to}deg)` }],
          { duration: spb * 1000, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
        bump(clock, down ? 'tick1' : 'tick2');
        stage.dataset.tier = tier;
        if (tier >= 1) bump(poster, down ? 'bop' : 'bop2');
        bump(plant, down ? 'sway' : 'sway2');
        if (tier >= 2) bump(disco, 'spin');
        if (tier >= 3) lights.className = `ms-lights on ${down ? 'a' : 'b'}`;
        else lights.className = 'ms-lights';
        if (tier >= 4) tiles.querySelectorAll('i').forEach((t) => t.classList.toggle('lit', Math.random() < 0.35));
        if (down && !busy) bump(eyes, 'blink');
        if (tier >= 4 && !busy) bump(eyes, 'dance');
        if (rat && !busy) bump(rat, down ? 'bob' : 'bob2');
        rug.classList.toggle('glow', tier >= 3);
      },
      /* Boss rounds: a hit bonks The Big Cheese; a miss makes him laugh. */
      hit() {
        hits++;
        const at = centre(rat, 0.2);
        cat.reach(at.x, at.y, 0.18);
        toon('pot', undefined, { vol: 0.9 });
        later(60, () => {
          rat.set('hurt', true);
          rat.set('stars', true);
          rat.style.setProperty('--lump', 1 + hits * 0.35);
          bump(rat, 'bonked');
          comic(['BONK!', 'POW!', 'BOINK!', 'KA-BONK!'][(hits - 1) % 4], { x: at.x, y: at.y - 20 }, 'hit');
          punch(at, 1.08, 380);
        });
        later(700, () => rat.set('stars', false));
      },
      miss() {
        rat.set('tongue', true);
        bump(rat, 'laugh');
        cat.mood('shock');
        comic('MWA HA HA!', centre(rat, 0), 'bad');
        later(650, () => { rat.set('tongue', false); cat.mood('hunt'); });
      },
      win() {
        busy = true;
        if (rat) {
          // Launch: the last bonk sends him flying off with a twinkle.
          const at = centre(rat, 0.3);
          cat.reach(at.x, at.y, 0.2);
          toon('punch');
          toon('whistle-up', undefined, { vol: 1.2 });
          later(80, () => {
            rat.set('dizzy', true);
            rat.classList.add('launch');
            cat.mood('star');
            flashSpeed('gold');
            comic('KO!', { x: at.x, y: at.y - 30 }, 'big');
          });
          later(700, () => {
            toon('twinkle');
            const tw = h('i', 'ms-twinkle');
            fx.append(tw);
          });
          return;
        }
        const big = Math.random() < 0.35;
        const at = centre(hole, 0.6);
        const go = () => {
          cat.reach(at.x, at.y, 0.2);
          toon('punch', undefined, { vol: 0.8 });
          mouse.classList.add('gone');
          // The yanked mouse, flying from the hole to above Mookie's head.
          const flyer = critter('mouse');
          flyer.classList.add('ms-flyer', 'dizzy');
          fx.append(flyer);
          const from = local(centre(hole, 0.55));
          const head = cat.el.getBoundingClientRect();
          const to = local({ x: head.left + head.width * 0.62, y: head.top - head.height * 0.12 });
          const w = flyer.getBoundingClientRect().width || 60;
          flyer.style.left = `${to.x - w / 2}px`;
          flyer.style.top = `${to.y - w * 0.4}px`;
          const dx = from.x - to.x;
          const dy = from.y - to.y;
          later(110, () => toon('whistle-up', undefined, { vol: 0.9 }));
          flyer.animate([
            { transform: `translate(${dx}px, ${dy}px) rotate(0) scale(.6)` },
            { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 70}px) rotate(300deg) scale(1)`, offset: 0.55 },
            { transform: 'translate(0, 0) rotate(540deg) scale(1)' },
          ], { duration: 340, delay: 90, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'backwards' });
          later(440, () => {
            flyer.classList.add('dangle');
            cat.mood('star');
            cat.hop(0.6);
          });
          later(620, () => { flyer.classList.add('flag'); toon('pop'); });
          later(140, () => {
            comic('GOTCHA!', { x: at.x - 30, y: at.y - 60 }, 'big');
            punch(centre(cat.el, 0.3), 1.12, 600);
            flashSpeed();
          });
        };
        if (big && !rat) {
          cutaway('cat', 360);
          toon('pep', undefined, { vol: 0.8 });
          later(300, go);
        } else go();
      },
      fail() {
        busy = true;
        if (rat) {
          // He grabs the cheese and moonwalks off.
          rat.set('shades', true);
          rat.set('tongue', true);
          rat.classList.add('exit');
          cheese.classList.add('taken');
          cat.mood('dizzy');
          comic('SEE YA!', centre(rat, 0), 'bad');
          toon('raspberry');
          return;
        }
        const big = Math.random() < 0.35;
        cat.mood('shock');
        toon('zip');
        // The runner: out of the hole, across the floor, raspberry, and home again.
        const run = critter('mouse');
        run.classList.add('ms-runner', 'shades');
        fx.append(run);
        const from = local(centre(hole, 0.75));
        const b = box();
        const catBox = cat.el.getBoundingClientRect();
        const stopX = Math.min(b.width * 0.62, catBox.right - b.left + b.width * 0.1);
        const w = run.getBoundingClientRect().width || 60;
        run.style.left = `${stopX - w / 2}px`;
        run.style.top = `${from.y - w * 0.9}px`;
        const dx = from.x - stopX;
        mouse.classList.add('gone');
        run.animate([
          { transform: `translate(${dx}px, 0) scaleX(-1)` },
          { transform: 'translate(0, 0) scaleX(-1)', offset: 0.8 },
          { transform: 'translate(0, -8px) scaleX(-1)' },
        ], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
        for (let k = 0; k < 4; k++) later(k * 55, () => toon(k % 2 ? 'step-2' : 'step-1', undefined, { rate: 1.8, vol: 0.5 }));
        later(120, () => dust({ x: b.left + stopX + 30, y: b.top + from.y }, 5));
        later(280, () => {
          run.classList.add('tongue');
          toon('raspberry');
          comic('PFFT!', { x: b.left + stopX, y: b.top + from.y - w * 1.1 }, 'bad');
          if (big) cutaway('mouse', 340);
        });
        later(500, () => cat.mood('dizzy'));
        later(720, () => {
          run.classList.remove('tongue');
          toon('zip');
          run.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${dx}px, 0) scale(.7)` }],
            { duration: 220, easing: 'ease-in', fill: 'forwards' });
        });
      },
    };
  },
};
