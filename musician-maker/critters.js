/* The mouse and The Big Cheese (the boss rat), drawn in SVG with parts the scenes move:
   eyes (blink), mouth (closed, open, tongue), arms, tail, and props (sunglasses, a white
   flag, dizzy stars, sweat; the boss's cheese crown, bandage and gold tooth).
   Fixed markup only: nothing a learner types goes in here. */

const NS = 'http://www.w3.org/2000/svg';

const LOOK = {
  mouse: { fur: '#a9a2ae', dark: '#857d8b', belly: '#e2dce4', ear: '#f0aab6', tail: '#e4a3ad', size: 1 },
  boss: { fur: '#6d6676', dark: '#4f4957', belly: '#a59daa', ear: '#d98c99', tail: '#d6939d', size: 1 },
};

function markup(kind) {
  const c = LOOK[kind];
  const boss = kind === 'boss';
  return `
<g class="c-root">
  <path class="c-tail" d="M76 114 C100 122 116 106 106 92 C99 82 110 72 117 78" stroke="${c.tail}" stroke-width="${boss ? 5 : 3.5}" fill="none" stroke-linecap="round"/>
  <path d="M60 60 C36 60 30 96 34 112 C36 123 84 123 86 112 C90 96 84 60 60 60 Z" fill="${c.fur}"/>
  <ellipse cx="60" cy="100" rx="15" ry="17" fill="${c.belly}"/>
  <ellipse cx="45" cy="121" rx="10" ry="4.5" fill="${c.ear}"/><ellipse cx="75" cy="121" rx="10" ry="4.5" fill="${c.ear}"/>
  <g class="c-arm-l"><path d="M44 78 Q36 88 40 98" stroke="${c.fur}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="40" cy="99" r="4" fill="${c.ear}"/></g>
  <g class="c-arm-r"><path d="M76 78 Q84 88 80 98" stroke="${c.fur}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="80" cy="99" r="4" fill="${c.ear}"/>
    <g class="c-flag"><path d="M80 99 L80 52" stroke="#8a6a3c" stroke-width="2.5" stroke-linecap="round"/>
      <path class="c-flag-cloth" d="M80 53 Q90 49 98 54 Q106 59 114 55 L114 75 Q106 79 98 74 Q90 69 80 73 Z" fill="#fff" stroke="#cfcfcf" stroke-width="1"/></g></g>
  <g class="c-head">
    <g class="c-ear-l"><circle cx="${boss ? 38 : 36}" cy="${boss ? 28 : 25}" r="${boss ? 13 : 17}" fill="${c.fur}"/><circle cx="${boss ? 38 : 36}" cy="${boss ? 28 : 25}" r="${boss ? 8 : 11}" fill="${c.ear}"/></g>
    <g class="c-ear-r"><circle cx="${boss ? 82 : 84}" cy="${boss ? 28 : 25}" r="${boss ? 13 : 17}" fill="${c.fur}"/><circle cx="${boss ? 82 : 84}" cy="${boss ? 28 : 25}" r="${boss ? 8 : 11}" fill="${c.ear}"/></g>
    <ellipse cx="60" cy="47" rx="25" ry="22" fill="${c.fur}"/>
    ${boss ? `<path d="M60 52 L60 52 Q82 54 88 60 Q80 66 60 64 Q40 66 32 60 Q38 54 60 52 Z" fill="${c.belly}"/>` : `<ellipse cx="60" cy="57" rx="13" ry="9" fill="${c.belly}"/>`}
    <g class="c-eyes">
      <g class="c-eye"><ellipse cx="50" cy="43" rx="4.4" ry="5.8" fill="#141418"/><circle cx="51.5" cy="41" r="1.6" fill="#fff"/></g>
      <g class="c-eye"><ellipse cx="70" cy="43" rx="4.4" ry="5.8" fill="#141418"/><circle cx="71.5" cy="41" r="1.6" fill="#fff"/></g>
    </g>
    <g class="c-dizzy-eyes" stroke="#141418" stroke-width="1.8" fill="none" stroke-linecap="round">
      <path d="M46 40 L54 47 M54 40 L46 47"/><path d="M66 40 L74 47 M74 40 L66 47"/></g>
    ${boss ? `<path d="M43 34 L56 39 M77 34 L64 39" stroke="#2a252e" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M72 33 L67 52" stroke="#e8c7cc" stroke-width="1.6" stroke-linecap="round"/>` : ''}
    <circle cx="60" cy="${boss ? 53 : 52}" r="${boss ? 4.5 : 3.6}" fill="#e07a8c"/>
    <path class="c-mouth c-closed" d="M54 60 Q60 65 66 60" stroke="#4a3438" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <g class="c-mouth c-open"><ellipse cx="60" cy="63" rx="5" ry="5.5" fill="#4a3438"/>
      <rect x="56.6" y="57.6" width="3.2" height="4.2" rx=".8" fill="${boss ? '#f2c94c' : '#fff'}"/><rect x="60.2" y="57.6" width="3.2" height="4.2" rx=".8" fill="#fff"/></g>
    <g class="c-mouth c-tongue"><path d="M53 60 Q60 66 67 60" stroke="#4a3438" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M56 61 Q55 72 60 73 Q65 72 64 61 Z" fill="#e8798c" stroke="#b9566a" stroke-width="1"/></g>
    <g stroke="#fff" stroke-opacity=".7" stroke-width="1" stroke-linecap="round"><path d="M52 55 L34 51 M52 58 L33 60 M68 55 L86 51 M68 58 L87 60"/></g>
    <g class="c-shades"><rect x="40" y="36" width="17" height="11" rx="4" fill="#111"/><rect x="63" y="36" width="17" height="11" rx="4" fill="#111"/>
      <path d="M57 40 H63 M40 39 L33 36 M80 39 L87 36" stroke="#111" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M44 39 L48 39 M67 39 L71 39" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/></g>
    ${boss ? `<g class="c-crown"><path d="M38 24 L42 6 L51 17 L60 2 L69 17 L78 6 L82 24 Z" fill="#f2c94c" stroke="#c99a2e" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="50" cy="19" r="2.2" fill="#d9a93a"/><circle cx="66" cy="14" r="1.8" fill="#d9a93a"/><circle cx="73" cy="20" r="2.4" fill="#d9a93a"/><circle cx="58" cy="21" r="1.5" fill="#d9a93a"/></g>
      <g class="c-bandage"><rect x="40" y="27" width="22" height="7" rx="2" fill="#f4e4c8" transform="rotate(-18 51 30)"/><rect x="40" y="27" width="22" height="7" rx="2" fill="#f4e4c8" transform="rotate(18 51 30)"/></g>
      <ellipse class="c-lump" cx="72" cy="27" rx="6" ry="5" fill="#e0909c"/>` : ''}
    <path class="c-sweat" d="M89 30 Q94 38 89 41 Q84 38 89 30 Z" fill="#9fd3f0" stroke="#5b9ec4" stroke-width=".8"/>
  </g>
  <g class="c-stars" fill="#f2c94c" stroke="#c99a2e" stroke-width=".8">
    <path d="M40 18 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0 Z"/><path d="M78 10 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0 Z"/><path d="M60 0 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0 Z"/></g>
</g>`;
}

export function critter(kind = 'mouse') {
  const el = document.createElement('div');
  el.className = `critter ${kind}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', kind === 'boss' ? '0 -6 120 136' : '0 0 120 130');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = markup(kind); // fixed markup
  el.append(svg);
  /* Faces and props are classes on the element: talk, tongue, shades, flag, dizzy, sweat,
     stars, hurt (bandage and lump). */
  el.set = (cls, on = true) => el.classList.toggle(cls, on);
  el.say = (ms = 160) => {
    el.classList.add('talk');
    clearTimeout(el._talk);
    el._talk = setTimeout(() => el.classList.remove('talk'), ms);
  };
  return el;
}
