/* Mookie, Kyle's black cat, as drawn in the Mookie mockups (placeholder art).
   Fixed markup only: nothing a learner types ever goes in here.
   Moods: '' (awake), 'happy' (arms up), 'sleep' (eyes shut), 'oops'. */

const CAT = '#17171b';
const EYE = '#cde374';
const PINK = '#c98a93';

function eyes(mood) {
  if (mood === 'happy') {
    return `<path d="M71 78 Q82 66 93 78" stroke="${EYE}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M107 78 Q118 66 129 78" stroke="${EYE}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  }
  if (mood === 'sleep') {
    return `<path d="M71 76 Q82 84 93 76" stroke="${EYE}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M107 76 Q118 84 129 76" stroke="${EYE}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }
  const blink = (r) => `<animate attributeName="ry" values="${r};${r};0.8;${r}" keyTimes="0;0.93;0.965;1" dur="4.2s" repeatCount="indefinite"/>`;
  const one = (cx) => `<ellipse cx="${cx}" cy="75" rx="11.5" ry="12.5" fill="${EYE}">${blink(12.5)}</ellipse>
    <ellipse cx="${cx - 2}" cy="76" rx="2.6" ry="9" fill="#0b0b0d">${blink(9)}</ellipse>
    <circle cx="${cx + 1.5}" cy="71" r="2" fill="#fff" opacity=".8"/>`;
  return one(82) + one(118);
}

function head(mood) {
  const happy = mood === 'happy';
  return `<path d="M61 64 L56 16 L94 44 Z" fill="${CAT}"/><path d="M139 64 L144 16 L106 44 Z" fill="${CAT}"/>
    <path d="M66 57 L63 29 L87 46 Z" fill="${PINK}"/><path d="M134 57 L137 29 L113 46 Z" fill="${PINK}"/>
    <path d="M57 79 C57 52 77 39 100 39 C123 39 143 52 143 79 C143 103 124 115 100 115 C76 115 57 103 57 79 Z" fill="${CAT}"/>
    ${eyes(mood)}<path d="M95.5 91 L104.5 91 L100 96.5 Z" fill="#4a3438"/>
    ${happy ? `<path d="M93 100 Q100 110 107 100 Z" fill="${PINK}"/>`
    : `<path d="M100 96.5 Q96 102 91 100 M100 96.5 Q104 102 109 100" stroke="#55555c" stroke-width="1.6" fill="none" stroke-linecap="round"/>`}
    <g stroke="#fff" stroke-opacity=".55" stroke-width="1.3" stroke-linecap="round"><path d="M84 95 L52 89"/><path d="M84 99 L51 101"/><path d="M116 95 L148 89"/><path d="M116 99 L149 101"/></g>`;
}

const COLLAR = '<path d="M70 109 Q100 127 130 109" stroke="#a8d98f" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="100" cy="124" r="6.5" fill="#f2c94c"/>';
const BODY = `<path d="M100 100 C62 104 52 150 58 188 C61 204 139 204 142 188 C148 150 138 104 100 100 Z" fill="${CAT}"/>
  <ellipse cx="86" cy="199" rx="13" ry="8" fill="${CAT}"/><ellipse cx="114" cy="199" rx="13" ry="8" fill="${CAT}"/>`;
const TAIL = `<path class="mk-tail" d="M140 183 C170 197 152 215 112 209 C96 207 82 205 70 201" stroke="${CAT}" stroke-width="13" fill="none" stroke-linecap="round"/>`;
const ARMS = `<g class="mk-arm-l"><path d="M74 128 L42 74" stroke="${CAT}" stroke-width="16" stroke-linecap="round"/><circle cx="41" cy="71" r="10" fill="${CAT}"/></g>
  <g class="mk-arm-r"><path d="M126 128 L158 74" stroke="${CAT}" stroke-width="16" stroke-linecap="round"/><circle cx="159" cy="71" r="10" fill="${CAT}"/></g>`;

function markup(mood) {
  return `<svg viewBox="0 0 200 222" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${mood === 'happy' ? ARMS : TAIL}${BODY}<g class="mk-head">${head(mood)}</g>${COLLAR}</svg>`;
}

export function mookie(mood = '') {
  const el = document.createElement('div');
  el.className = `mookie ${mood}`;
  el.innerHTML = markup(mood);
  el.mood = (m) => {
    el.classList.remove('happy', 'sleep', 'oops');
    if (m) el.classList.add(m);
    el.innerHTML = markup(m);
  };
  return el;
}
