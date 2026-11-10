/* The big instruments the learner plays on (Play It), and the big mic (Speak/Sing It), as
   drawings. Fixed markup only: nothing a learner types ever goes in here.
   Parts carry classes the styles move: a tap strikes one side, then the other (data-side on
   the button), so two hands take turns, the way the instrument is really played. */

const WOOD = '#9a5b32';
const WOOD_DARK = '#6e3b1d';
const HEAD = '#f3e6c4';
const RIM = '#c9ccd2';

const bongo = (cx, w, side) => `
  <g class="part ${side}">
    <path d="M${cx - w / 2} 58 L${cx - w * 0.36} 122 Q${cx} 130 ${cx + w * 0.36} 122 L${cx + w / 2} 58 Z" fill="${WOOD}"/>
    <path d="M${cx - w * 0.46} 78 L${cx + w * 0.46} 78 M${cx - w * 0.42} 100 L${cx + w * 0.42} 100" stroke="${WOOD_DARK}" stroke-width="4"/>
    <ellipse cx="${cx}" cy="58" rx="${w / 2 + 3}" ry="13" fill="${RIM}"/>
    <ellipse class="head" cx="${cx}" cy="56" rx="${w / 2 - 2}" ry="10" fill="${HEAD}"/>
  </g>`;

const maraca = (side, x, rot, a, b) => `
  <g class="part ${side}" transform="rotate(${rot} ${x} 120)">
    <rect x="${x - 5}" y="66" width="10" height="58" rx="5" fill="${WOOD}"/>
    <ellipse cx="${x}" cy="46" rx="27" ry="34" fill="${a}"/>
    <path d="M${x - 26} 40 Q${x} 30 ${x + 26} 40 L${x + 26} 50 Q${x} 40 ${x - 26} 50 Z" fill="${b}"/>
    <path d="M${x - 22} 62 Q${x} 54 ${x + 22} 62" stroke="${b}" stroke-width="6" fill="none"/>
    <ellipse cx="${x - 9}" cy="30" rx="6" ry="10" fill="#fff" opacity=".35"/>
  </g>`;

const ART = {
  bongos: `<svg viewBox="0 0 200 140" aria-hidden="true">
    <rect x="80" y="84" width="40" height="10" rx="4" fill="${WOOD_DARK}"/>
    ${bongo(52, 74, 'l')}${bongo(146, 62, 'r')}</svg>`,
  bell: `<svg viewBox="0 0 200 140" aria-hidden="true">
    <g class="part swing">
      <rect x="92" y="2" width="16" height="44" rx="7" fill="${WOOD}"/>
      <rect x="88" y="40" width="24" height="10" rx="4" fill="${WOOD_DARK}"/>
      <path d="M100 48 C70 48 66 74 62 100 C60 112 48 116 48 122 L152 122 C152 116 140 112 138 100 C134 74 130 48 100 48 Z" fill="#e2b33e"/>
      <path d="M78 64 C74 80 72 96 70 108" stroke="#f6dc8e" stroke-width="6" stroke-linecap="round" fill="none"/>
      <rect x="46" y="118" width="108" height="8" rx="4" fill="#c8962a"/>
      <circle class="clapper" cx="100" cy="128" r="8" fill="#8a6a2a"/>
    </g></svg>`,
  maracas: `<svg viewBox="0 0 200 140" aria-hidden="true">
    ${maraca('l', 70, -16, '#e0603c', '#f4c44a')}${maraca('r', 130, 16, '#3c9bd6', '#9fd14f')}</svg>`,
  drum: `<svg viewBox="0 0 200 140" aria-hidden="true">
    <g class="part l r">
      <path d="M40 50 L40 112 Q100 134 160 112 L160 50 Z" fill="#c4473a"/>
      <path d="M40 60 L60 104 L80 64 L100 108 L120 64 L140 104 L160 60" stroke="#f3e6c4" stroke-width="5" fill="none" stroke-linejoin="round"/>
      <ellipse cx="100" cy="112" rx="60" ry="14" fill="none" stroke="${RIM}" stroke-width="6"/>
      <ellipse cx="100" cy="50" rx="62" ry="16" fill="${RIM}"/>
      <ellipse class="head" cx="100" cy="48" rx="56" ry="12" fill="${HEAD}"/>
    </g></svg>`,
  // A guiro: a ridged gourd and its scraper. The gourd and the stick take turns.
  guiro: `<svg viewBox="0 0 200 140" aria-hidden="true">
    <g class="part l">
      <path d="M30 86 C30 56 62 44 104 44 C150 44 178 62 178 86 C178 110 150 124 104 124 C62 124 30 114 30 86 Z" fill="#c98a3c"/>
      <path d="M40 74 C60 56 140 54 168 72" stroke="#e8b46a" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>
      <g stroke="${WOOD_DARK}" stroke-width="4" stroke-linecap="round"><path d="M62 60 V112 M76 54 V118 M90 51 V121 M104 50 V122 M118 51 V121 M132 54 V118 M146 59 V113"/></g>
      <circle cx="44" cy="88" r="5" fill="${WOOD_DARK}"/><circle cx="164" cy="88" r="5" fill="${WOOD_DARK}"/>
    </g>
    <g class="part r"><rect x="60" y="20" width="120" height="9" rx="4.5" fill="${WOOD}" transform="rotate(-14 120 24)"/>
      <rect x="150" y="6" width="34" height="13" rx="6" fill="${WOOD_DARK}" transform="rotate(-14 167 12)"/></g></svg>`,
  mic: `<svg viewBox="0 0 200 160" aria-hidden="true">
    <path d="M60 70 Q60 118 100 118 Q140 118 140 70" stroke="#5b6168" stroke-width="8" fill="none" stroke-linecap="round"/>
    <rect x="94" y="118" width="12" height="26" fill="#5b6168"/>
    <rect x="70" y="142" width="60" height="10" rx="5" fill="#3f454b"/>
    <g class="part capsule">
      <rect x="72" y="10" width="56" height="92" rx="28" fill="#7d858e"/>
      <rect x="76" y="14" width="48" height="56" rx="24" fill="#c9ced4"/>
      <g class="grille" stroke="#8e969e" stroke-width="3">
        <path d="M80 28 H120 M78 40 H122 M78 52 H122 M80 64 H120"/>
      </g>
      <rect x="72" y="72" width="56" height="8" fill="#5b6168"/>
      <circle class="light" cx="100" cy="90" r="5" fill="#e0603c"/>
    </g></svg>`,
};

/* Which drawing a kit's instrument gets: its own `look`, or one that matches its sound. */
export function lookOf(inst = {}) {
  if (inst.look && ART[inst.look]) return inst.look;
  const s = inst.sound || '';
  if (s.startsWith('bongo')) return 'bongos';
  if (/bell|cowbell|agogo|triangle/.test(s)) return 'bell';
  if (/shaker|maraca/.test(s)) return 'maracas';
  if (s === 'guiro') return 'guiro';
  return 'drum';
}

export const art = (look) => ART[look] || ART.drum;
