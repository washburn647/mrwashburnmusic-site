/* Drawings of each instrument for the hall and the placards (inline SVG, 120 × 120). */

const svg = (body, label) => `<svg viewBox="0 0 120 120" role="img" aria-label="${label}">${body}</svg>`;

const WOOD = '#B86E35';
const WOOD_D = '#7C4521';
const WOOD_L = '#DA9A5B';
const BRASS = '#E2B44A';
const BRASS_D = '#A97B1F';
const BRASS_L = '#F6DB8C';
const SILVER = '#D4DBE0';
const SILVER_D = '#8D99A3';
const EBONY = '#2A2622';
const INK = '#1F3329';

function fiddle({ s = 1, endpin = false, bass = false } = {}) {
  // A violin-family body drawn standing up, scaled about its center.
  const body = bass
    ? 'M60 40 C50 40 46 44 44 50 C38 52 33 58 34 66 C35 72 40 74 41 77 C35 80 31 87 32 95 C34 105 46 108 60 108 C74 108 86 105 88 95 C89 87 85 80 79 77 C80 74 85 72 86 66 C87 58 82 52 76 50 C74 44 70 40 60 40Z'
    : 'M60 42 C48 42 38 45 38 56 C38 63 44 66 44 70 C44 73 36 76 36 88 C36 101 46 107 60 107 C74 107 84 101 84 88 C84 76 76 73 76 70 C76 66 82 63 82 56 C82 45 72 42 60 42Z';
  return `<g transform="translate(60 64) scale(${s}) translate(-60 -64)">
    <path d="${body}" fill="${WOOD}" stroke="${WOOD_D}" stroke-width="2"/>
    <path d="${body}" fill="url(#shine)" opacity=".5"/>
    <rect x="56" y="10" width="8" height="66" rx="3" fill="${EBONY}"/>
    <path d="M56 12 C52 10 52 3 58 2 C64 1 66 6 63 9" fill="none" stroke="${WOOD_D}" stroke-width="4" stroke-linecap="round"/>
    <path d="M49 74 C46 78 46 84 50 87 M71 74 C74 78 74 84 70 87" fill="none" stroke="${EBONY}" stroke-width="2" stroke-linecap="round"/>
    <rect x="52" y="82" width="16" height="3" rx="1" fill="${WOOD_L}"/>
    <path d="M55 92 L58 103 L62 103 L65 92Z" fill="${EBONY}"/>
    <g stroke="#EFE6D2" stroke-width=".7"><path d="M57.5 12V94M59.2 12V94M60.8 12V94M62.5 12V94"/></g>
    ${endpin ? `<path d="M60 107V118" stroke="${SILVER_D}" stroke-width="2"/>` : ''}
  </g>`;
}

const defs = `<defs>
  <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BRASS_L}"/><stop offset=".55" stop-color="${BRASS}"/><stop offset="1" stop-color="${BRASS_D}"/></linearGradient>
  <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F7F9"/><stop offset=".6" stop-color="${SILVER}"/><stop offset="1" stop-color="${SILVER_D}"/></linearGradient>
  <radialGradient id="cym" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#F7E2A0"/><stop offset=".6" stop-color="#D9A93E"/><stop offset="1" stop-color="#A9781F"/></radialGradient>
  <radialGradient id="copper" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#F0A877"/><stop offset=".6" stop-color="#C46A3A"/><stop offset="1" stop-color="#7E3F1E"/></radialGradient>
  <radialGradient id="head" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#FFFDF7"/><stop offset="1" stop-color="#E7DDC8"/></radialGradient>
</defs>`;

const keysRow = (x, y, w, h, n) => {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FBF8F0" stroke="${INK}" stroke-width="1"/>`;
  const kw = w / n;
  for (let i = 1; i < n; i++) out += `<path d="M${x + i * kw} ${y}V${y + h}" stroke="${INK}" stroke-width=".8"/>`;
  [0, 1, 3, 4, 5].forEach((k) => { for (let o = 0; o < n; o += 7) if (o + k + 1 < n) out += `<rect x="${x + (o + k + 0.65) * kw}" y="${y}" width="${kw * 0.7}" height="${h * 0.6}" fill="${EBONY}"/>`; });
  return out;
};

function bars(colors, resonators) {
  let out = '';
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x = 16 + i * 11.5;
    const h = 64 - i * 4.5;
    const y = 30 + i * 2.2;
    if (resonators) out += `<rect x="${x + 2}" y="${y + h - 4}" width="5.5" height="${26 - i * 1.6}" rx="2" fill="${SILVER_D}"/>`;
    out += `<rect x="${x}" y="${y}" width="9.5" height="${h}" rx="2.2" fill="${colors[i % colors.length]}" stroke="rgba(0,0,0,.25)"/>`;
    out += `<circle cx="${x + 4.75}" cy="${y + 6}" r="1.1" fill="rgba(0,0,0,.35)"/><circle cx="${x + 4.75}" cy="${y + h - 6}" r="1.1" fill="rgba(0,0,0,.35)"/>`;
  }
  out += `<g stroke="${WOOD_D}" stroke-width="2.6" stroke-linecap="round"><path d="M82 14L98 34"/><path d="M98 12L88 36"/></g>`;
  out += `<circle cx="81" cy="12.5" r="4.5" fill="${resonators ? '#6C5A8E' : '#D9573E'}"/><circle cx="99.5" cy="10.5" r="4.5" fill="${resonators ? '#6C5A8E' : '#D9573E'}"/>`;
  return out;
}

const ART = {
  piano: () => `
    <path d="M14 46 L14 70 L84 70 C100 70 110 64 110 54 C110 40 92 40 84 34 C74 26 66 22 50 22 L14 22 Z" fill="${EBONY}"/>
    <path d="M14 22 L70 6 L74 12 L50 22Z" fill="#3B3632"/>
    <path d="M62 10 L60 24" stroke="#5A534D" stroke-width="2"/>
    ${keysRow(8, 70, 70, 10, 14)}
    <path d="M8 70h70" stroke="${EBONY}" stroke-width="2"/>
    <g fill="${EBONY}"><rect x="16" y="80" width="5" height="30" rx="2"/><rect x="92" y="66" width="5" height="44" rx="2"/><rect x="66" y="80" width="5" height="30" rx="2"/></g>
    <path d="M50 108h16M48 112h20" stroke="${BRASS}" stroke-width="2"/>`,
  violin: () => fiddle({ s: 0.95 }),
  viola: () => fiddle({ s: 1.02 }),
  cello: () => fiddle({ s: 1.06, endpin: true }),
  bass: () => fiddle({ s: 1.08, endpin: true, bass: true }),
  guitar: () => `
    <g transform="rotate(-35 60 60)">
      <path d="M60 50 C49 50 44 55 45 63 C46 68 50 70 50 73 C42 75 37 82 38 92 C40 104 50 110 60 110 C70 110 80 104 82 92 C83 82 78 75 70 73 C70 70 74 68 75 63 C76 55 71 50 60 50Z" fill="${WOOD_L}" stroke="${WOOD_D}" stroke-width="2"/>
      <circle cx="60" cy="78" r="7.5" fill="${EBONY}"/>
      <circle cx="60" cy="78" r="9.5" fill="none" stroke="${WOOD_D}" stroke-width="1.5"/>
      <rect x="55.5" y="6" width="9" height="66" rx="2" fill="#4A2E1B"/>
      <path d="M54 4 h12 l1 -2 l-14 0z" fill="${WOOD_D}"/>
      <rect x="53.5" y="-6" width="13" height="12" rx="3" fill="${WOOD_D}"/>
      <g stroke="${SILVER}" stroke-width=".8">${[14, 22, 29, 36, 42, 48, 53].map((y) => `<path d="M55.5 ${y}h9"/>`).join('')}</g>
      <rect x="51" y="94" width="18" height="4" rx="1.5" fill="${EBONY}"/>
      <g stroke="#F3EBD9" stroke-width=".6">${[56.5, 58, 59.4, 60.6, 62, 63.5].map((x) => `<path d="M${x} 0V96"/>`).join('')}</g>
    </g>`,
  flute: () => `
    <g transform="rotate(-32 60 60)">
      <rect x="2" y="54" width="116" height="9" rx="4.5" fill="url(#silver)" stroke="${SILVER_D}"/>
      <ellipse cx="16" cy="54" rx="5" ry="2.6" fill="${SILVER_D}"/><ellipse cx="16" cy="54" rx="2.4" ry="1.3" fill="${EBONY}"/>
      <path d="M30 54v9M100 54v9" stroke="${SILVER_D}" stroke-width="1.4"/>
      ${[42, 50, 58, 70, 78, 86].map((x) => `<circle cx="${x}" cy="58.5" r="3.6" fill="#EEF2F4" stroke="${SILVER_D}" stroke-width="1.2"/>`).join('')}
      <path d="M62 52h8M90 52h8" stroke="${SILVER_D}" stroke-width="2" stroke-linecap="round"/>
    </g>`,
  clarinet: () => `
    <g transform="rotate(14 60 60)">
      <path d="M56 4 h8 l-1 12 h-6z" fill="${EBONY}"/>
      <rect x="54.5" y="15" width="11" height="6" rx="1.5" fill="${SILVER}"/>
      <rect x="55.5" y="20" width="9" height="78" fill="${EBONY}"/>
      <rect x="54.5" y="52" width="11" height="4" fill="${SILVER}"/>
      <path d="M55.5 96 C55 104 50 110 48 114 H72 C70 110 65 104 64.5 96Z" fill="${EBONY}"/>
      <rect x="47" y="112" width="26" height="3" rx="1.5" fill="${SILVER}"/>
      ${[30, 38, 45, 63, 71, 79].map((y) => `<circle cx="60" cy="${y}" r="2.6" fill="#141210" stroke="${SILVER}" stroke-width="1.3"/>`).join('')}
      <path d="M65 28 l4 4 v12 M65 62 l4 4 v14" fill="none" stroke="${SILVER}" stroke-width="1.4"/>
    </g>`,
  oboe: () => `
    <g transform="rotate(14 60 60)">
      <path d="M58.6 2 h2.8 l.6 9 h-4z" fill="#C79A64"/>
      <rect x="57.8" y="10" width="4.4" height="5" fill="${SILVER}"/>
      <path d="M56.5 14 h7 l1.2 86 h-9.4z" fill="${EBONY}"/>
      <path d="M55.3 98 C55 106 52 110 51 114 H69 C68 110 65 106 64.7 98Z" fill="${EBONY}"/>
      <rect x="55" y="54" width="10" height="3" fill="${SILVER}"/>
      ${[26, 34, 42, 64, 72, 80].map((y) => `<circle cx="60" cy="${y}" r="2.6" fill="${SILVER}" stroke="${SILVER_D}"/>`).join('')}
      <path d="M64 22 v28 M64 60 v30 M56 30 v18" stroke="${SILVER}" stroke-width="1.2"/>
    </g>`,
  saxophone: () => `
    <path d="M58 8 C56 8 54 10 55 12 L58 22" fill="none" stroke="${EBONY}" stroke-width="4" stroke-linecap="round"/>
    <path d="M57 20 C64 24 66 30 64 38 L58 78 C55 96 64 108 78 106 C90 104 96 94 92 82 L88 68" fill="none" stroke="url(#brass)" stroke-width="13" stroke-linejoin="round"/>
    <path d="M80 70 C82 60 94 58 102 62 L94 80 C90 76 84 74 80 70Z" fill="url(#brass)" stroke="${BRASS_D}" stroke-width="1.5"/>
    <ellipse cx="98" cy="70" rx="5" ry="10" transform="rotate(25 98 70)" fill="${BRASS_D}"/>
    ${[44, 52, 60, 70, 80, 90].map((y, i) => `<circle cx="${i < 3 ? 64 - i * 1.6 : 60 - (i - 3) * 0.8}" cy="${y}" r="3.2" fill="${BRASS_L}" stroke="${BRASS_D}"/>`).join('')}`,
  trumpet: () => `
    <path d="M6 58 h6" stroke="${SILVER_D}" stroke-width="4" stroke-linecap="round"/>
    <path d="M12 58 H80" stroke="url(#brass)" stroke-width="5"/>
    <path d="M30 58 V72 H76 C84 72 84 58 76 58" fill="none" stroke="url(#brass)" stroke-width="5"/>
    <path d="M80 54 C92 54 100 48 114 40 V76 C100 68 92 62 80 62Z" fill="url(#brass)" stroke="${BRASS_D}" stroke-width="1.2"/>
    <ellipse cx="114" cy="58" rx="3" ry="18" fill="${BRASS_D}"/>
    ${[44, 54, 64].map((x) => `<rect x="${x}" y="46" width="7" height="32" rx="2" fill="url(#brass)" stroke="${BRASS_D}"/><rect x="${x + 0.5}" y="38" width="6" height="8" rx="1" fill="${BRASS_L}" stroke="${BRASS_D}"/><ellipse cx="${x + 3.5}" cy="37" rx="5" ry="2.2" fill="#F8EBC3" stroke="${BRASS_D}"/>`).join('')}`,
  horn: () => `
    <circle cx="54" cy="60" r="34" fill="none" stroke="url(#brass)" stroke-width="7"/>
    <circle cx="54" cy="60" r="24" fill="none" stroke="url(#brass)" stroke-width="5"/>
    <path d="M78 84 C86 92 92 100 112 104 L104 116 C90 112 80 102 72 92Z" fill="url(#brass)" stroke="${BRASS_D}"/>
    <ellipse cx="108" cy="110" rx="4" ry="9" transform="rotate(-55 108 110)" fill="${BRASS_D}"/>
    <path d="M30 40 L18 28" stroke="url(#brass)" stroke-width="4"/><path d="M18 28 l-6 -6" stroke="${SILVER_D}" stroke-width="4" stroke-linecap="round"/>
    ${[44, 54, 64].map((x) => `<circle cx="${x}" cy="56" r="5" fill="${BRASS_L}" stroke="${BRASS_D}" stroke-width="1.5"/>`).join('')}`,
  trombone: () => `
    <path d="M4 66 h4" stroke="${SILVER_D}" stroke-width="4" stroke-linecap="round"/>
    <path d="M8 66 H110 M8 74 H110" stroke="url(#silver)" stroke-width="3.4"/>
    <path d="M110 66 C118 66 118 74 110 74" fill="none" stroke="url(#silver)" stroke-width="3.4"/>
    <path d="M24 66 V48 H62" fill="none" stroke="url(#brass)" stroke-width="4"/>
    <path d="M24 66 V56" stroke="url(#brass)" stroke-width="4"/>
    <path d="M62 44 C74 44 84 36 98 24 V72 C84 60 74 52 62 52Z" fill="url(#brass)" stroke="${BRASS_D}"/>
    <ellipse cx="98" cy="48" rx="3.5" ry="24" fill="${BRASS_D}"/>
    <path d="M86 66 V74" stroke="${SILVER_D}" stroke-width="3"/>`,
  tuba: () => `
    <path d="M36 112 C30 112 26 104 28 94 L36 56 C38 44 46 40 56 40 H74 C84 40 88 46 86 56 L80 96 C78 108 70 112 60 112Z" fill="url(#brass)" stroke="${BRASS_D}" stroke-width="1.5"/>
    <path d="M58 40 L50 14 C49 8 64 4 82 4 C94 4 100 8 98 12 L78 40Z" fill="url(#brass)" stroke="${BRASS_D}"/>
    <ellipse cx="74" cy="8" rx="24" ry="5" fill="${BRASS_D}"/>
    ${[48, 56, 64, 72].map((x) => `<rect x="${x}" y="58" width="6" height="22" rx="2" fill="${BRASS_L}" stroke="${BRASS_D}"/><ellipse cx="${x + 3}" cy="57" rx="4" ry="2" fill="#F8EBC3" stroke="${BRASS_D}"/>`).join('')}
    <path d="M28 70 C14 70 12 60 18 54" fill="none" stroke="url(#brass)" stroke-width="4"/><path d="M18 54 l-4 -6" stroke="${SILVER_D}" stroke-width="4" stroke-linecap="round"/>`,
  drums: () => `
    <ellipse cx="22" cy="40" rx="17" ry="4" fill="url(#cym)"/><path d="M22 40V110M14 110h16" stroke="${SILVER_D}" stroke-width="2"/>
    <ellipse cx="98" cy="26" rx="19" ry="4.5" fill="url(#cym)"/><path d="M98 26V110M90 110h16" stroke="${SILVER_D}" stroke-width="2"/>
    <circle cx="60" cy="84" r="25" fill="#C4403A" stroke="#7E2421" stroke-width="3"/><circle cx="60" cy="84" r="20" fill="url(#head)"/>
    <ellipse cx="43" cy="52" rx="13" ry="5" fill="url(#head)" stroke="#7E2421" stroke-width="2"/><path d="M30 52v12c0 3 6 5 13 5s13-2 13-5V52" fill="#C4403A"/>
    <ellipse cx="77" cy="52" rx="13" ry="5" fill="url(#head)" stroke="#7E2421" stroke-width="2"/><path d="M64 52v12c0 3 6 5 13 5s13-2 13-5V52" fill="#C4403A"/>
    <ellipse cx="60" cy="84" rx="7" ry="7" fill="#C4403A" opacity=".35"/>`,
  timpani: () => `
    <path d="M14 46 H106 C106 80 86 98 60 98 C34 98 14 80 14 46Z" fill="url(#copper)"/>
    <ellipse cx="60" cy="46" rx="46" ry="9" fill="url(#head)" stroke="#B9A98A" stroke-width="2"/>
    <path d="M30 92 L22 114 M90 92 L98 114 M60 98 V114" stroke="${SILVER_D}" stroke-width="3"/>
    <rect x="50" y="108" width="20" height="6" rx="2" fill="${EBONY}"/>
    <g stroke="${WOOD_D}" stroke-width="2.4" stroke-linecap="round"><path d="M38 10L54 36"/><path d="M86 8L68 36"/></g>
    <circle cx="36" cy="8" r="5" fill="#F3EBD9" stroke="#B9A98A"/><circle cx="88" cy="6" r="5" fill="#F3EBD9" stroke="#B9A98A"/>`,
  snare: () => `
    <path d="M18 58 V84 C18 92 102 92 102 84 V58" fill="#E9EEF1" stroke="${SILVER_D}" stroke-width="2"/>
    <path d="M18 62 C18 70 102 70 102 62 M18 80 C18 88 102 88 102 80" fill="none" stroke="${SILVER_D}" stroke-width="2"/>
    ${[28, 46, 64, 82, 94].map((x) => `<path d="M${x} ${64 + (x > 60 ? 1 : 0)}V${84}" stroke="${SILVER_D}" stroke-width="2.4"/>`).join('')}
    <ellipse cx="60" cy="58" rx="42" ry="9" fill="url(#head)" stroke="${SILVER_D}" stroke-width="2"/>
    <g stroke="${WOOD_L}" stroke-width="3" stroke-linecap="round"><path d="M22 18L66 52"/><path d="M98 16L56 52"/></g>`,
  bassdrum: () => `
    <circle cx="60" cy="58" r="44" fill="#2F4A3A" stroke="#1C2E24" stroke-width="3"/>
    <circle cx="60" cy="58" r="38" fill="url(#head)"/>
    ${Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return `<rect x="${60 + Math.cos(a) * 41 - 2}" y="${58 + Math.sin(a) * 41 - 2}" width="4" height="4" fill="${SILVER_D}"/>`; }).join('')}
    <path d="M30 98 L22 116 M90 98 L98 116" stroke="${SILVER_D}" stroke-width="3"/>
    <path d="M96 26 L74 50" stroke="${WOOD_L}" stroke-width="3" stroke-linecap="round"/><circle cx="72" cy="52" r="7" fill="#EFE2C8" stroke="#B9A98A"/>`,
  cymbals: () => `
    <ellipse cx="42" cy="58" rx="30" ry="30" fill="url(#cym)" transform="rotate(-20 42 58) scale(1 1)"/>
    <ellipse cx="42" cy="58" rx="7" ry="7" fill="#C99A3E"/><circle cx="42" cy="58" r="2.4" fill="${INK}"/>
    <ellipse cx="80" cy="62" rx="30" ry="30" fill="url(#cym)"/>
    <ellipse cx="80" cy="62" rx="7" ry="7" fill="#C99A3E"/><circle cx="80" cy="62" r="2.4" fill="${INK}"/>
    ${[18, 24].map((r) => `<circle cx="80" cy="62" r="${r}" fill="none" stroke="#B38630" stroke-width=".6" opacity=".7"/>`).join('')}
    <path d="M12 44 l-6 -4 M10 62 l-8 0 M110 50 l6 -4 M112 68 l7 0" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`,
  triangle: () => `
    <path d="M60 10 V26" stroke="${INK}" stroke-width="1.5"/>
    <path d="M56 32 L28 98 H96 L66 30" fill="none" stroke="url(#silver)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M56 32 L28 98 H96 L66 30" fill="none" stroke="${SILVER_D}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>
    <path d="M60 22 c-6 0 -6 10 0 10 c6 0 6 -10 0 -10" fill="none" stroke="${INK}" stroke-width="1.2"/>
    <path d="M100 44 L70 76" stroke="${SILVER_D}" stroke-width="3" stroke-linecap="round"/>
    <path d="M14 66 l-8 -2 M14 80 l-8 2 M104 92 l8 2" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".45"/>`,
  tambourine: () => `
    <circle cx="60" cy="60" r="42" fill="${WOOD_L}" stroke="${WOOD_D}" stroke-width="2"/>
    <circle cx="60" cy="60" r="35" fill="url(#head)"/>
    ${Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; const x = 60 + Math.cos(a) * 38.5; const y = 60 + Math.sin(a) * 38.5; return `<g transform="rotate(${(a * 180) / Math.PI + 90} ${x} ${y})"><rect x="${x - 7}" y="${y - 3.4}" width="14" height="6.8" rx="1.5" fill="${EBONY}"/><circle cx="${x - 3.2}" cy="${y}" r="3.4" fill="url(#cym)"/><circle cx="${x + 3.2}" cy="${y}" r="3.4" fill="url(#cym)"/></g>`; }).join('')}`,
  gong: () => `
    <path d="M12 116 V12 H108 V116" fill="none" stroke="${WOOD_D}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M40 12 V22 M80 12 V22" stroke="${INK}" stroke-width="1.5"/>
    <circle cx="60" cy="64" r="42" fill="url(#cym)" stroke="#9A6E1E" stroke-width="2"/>
    <circle cx="60" cy="64" r="34" fill="none" stroke="#9A6E1E" stroke-width="1" opacity=".6"/>
    <circle cx="60" cy="64" r="12" fill="#C99A3E" stroke="#9A6E1E"/>`,
  organ: () => `
    <rect x="14" y="12" width="92" height="58" rx="4" fill="${WOOD_D}"/>
    ${[22, 32, 42, 52, 62, 72, 82, 92].map((x, i) => `<rect x="${x}" y="${20 + Math.abs(i - 3.5) * 4}" width="6" height="${44 - Math.abs(i - 3.5) * 4}" rx="2" fill="url(#silver)" stroke="${SILVER_D}" stroke-width=".8"/>`).join('')}
    <rect x="10" y="70" width="100" height="10" rx="2" fill="${WOOD}"/>
    ${keysRow(14, 80, 92, 12, 14)}
    <rect x="10" y="92" width="100" height="20" rx="3" fill="${WOOD}"/>
    <g fill="#E9E2D0">${[24, 36, 48, 60].map((x) => `<rect x="${x}" y="72" width="3" height="6" rx="1"/>`).join('')}</g>`,
  'electric-guitar': () => `
    <g transform="rotate(-35 60 60)">
      <path d="M60 58 C50 56 40 58 40 68 C40 74 46 76 44 82 C40 90 38 100 46 106 C54 112 66 112 74 106 C82 100 80 90 76 82 C74 76 80 74 80 68 C80 58 70 56 60 58Z" fill="#C8333A" stroke="#7E1A1F" stroke-width="2"/>
      <path d="M54 70 C50 74 50 92 56 98 L68 98 C72 92 72 76 66 70Z" fill="#F3EEE4"/>
      <rect x="53" y="76" width="14" height="4" rx="1.5" fill="#141414"/><rect x="53" y="86" width="14" height="4" rx="1.5" fill="#141414"/>
      <rect x="55.5" y="6" width="9" height="68" rx="2" fill="#E3C79A"/>
      <path d="M54 6 L52 -6 L66 -6 L66 6Z" fill="#E3C79A" stroke="${WOOD_D}" stroke-width="1"/>
      <g stroke="${SILVER_D}" stroke-width=".8">${[14, 22, 29, 36, 42, 48, 53].map((y) => `<path d="M55.5 ${y}h9"/>`).join('')}</g>
      <rect x="51" y="96" width="18" height="3" rx="1.5" fill="${SILVER_D}"/>
      <g stroke="#ECEFF1" stroke-width=".6">${[56.5, 58, 59.4, 60.6, 62, 63.5].map((x) => `<path d="M${x} -4V98"/>`).join('')}</g>
    </g>`,
  'electric-bass': () => `
    <g transform="rotate(-35 60 60)">
      <path d="M60 62 C50 60 40 62 40 72 C40 78 46 80 44 86 C40 94 40 104 48 108 C56 113 66 113 74 108 C82 104 80 94 76 86 C74 80 80 78 80 72 C80 62 70 60 60 62Z" fill="#2E5A8C" stroke="#173252" stroke-width="2"/>
      <path d="M53 74 C50 80 50 96 56 100 L68 100 C71 94 70 80 66 74Z" fill="#1A1A1A"/>
      <rect x="53" y="82" width="14" height="5" rx="1.5" fill="#3A3A3A"/>
      <rect x="56" y="-4" width="8" height="80" rx="2" fill="#4A2E1B"/>
      <g fill="${SILVER}">${[-4, 2, 8, 14].map((y, i) => `<circle cx="${i % 2 ? 68 : 52}" cy="${y}" r="2.6"/>`).join('')}</g>
      <g stroke="${SILVER_D}" stroke-width=".8">${[10, 20, 29, 37, 44, 51, 57].map((y) => `<path d="M56 ${y}h8"/>`).join('')}</g>
      <g stroke="#ECEFF1" stroke-width="1">${[57.5, 59.3, 61, 62.7].map((x) => `<path d="M${x} -6V100"/>`).join('')}</g>
    </g>`,
  banjo: () => `
    <g transform="rotate(-35 60 60)">
      <rect x="56" y="-6" width="8" height="70" rx="2" fill="#4A2E1B"/>
      <rect x="54" y="-12" width="12" height="9" rx="3" fill="${WOOD_D}"/>
      <circle cx="60" cy="84" r="27" fill="${SILVER_D}"/>
      ${Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return `<circle cx="${60 + Math.cos(a) * 25.5}" cy="${84 + Math.sin(a) * 25.5}" r="1.3" fill="#F4F7F9"/>`; }).join('')}
      <circle cx="60" cy="84" r="23" fill="url(#head)"/>
      <rect x="52" y="92" width="16" height="3" rx="1" fill="${WOOD_L}"/>
      <g stroke="${SILVER_D}" stroke-width=".8">${[6, 14, 21, 28, 34, 40, 45].map((y) => `<path d="M56 ${y}h8"/>`).join('')}</g>
      <circle cx="65" cy="22" r="1.6" fill="#F1E9D6"/>
      <g stroke="#ECEFF1" stroke-width=".55">${[57.5, 59, 60.5, 62].map((x) => `<path d="M${x} -6V106"/>`).join('')}<path d="M63.5 22V106"/></g>
    </g>`,
  ukulele: () => `
    <g transform="rotate(-35 60 60) translate(60 64) scale(.82) translate(-60 -64)">
      <path d="M60 50 C49 50 44 55 45 63 C46 68 50 70 50 73 C42 75 37 82 38 92 C40 104 50 110 60 110 C70 110 80 104 82 92 C83 82 78 75 70 73 C70 70 74 68 75 63 C76 55 71 50 60 50Z" fill="#CF9455" stroke="${WOOD_D}" stroke-width="2"/>
      <circle cx="60" cy="76" r="8" fill="${EBONY}"/>
      <rect x="55.5" y="14" width="9" height="58" rx="2" fill="#4A2E1B"/>
      <rect x="53.5" y="2" width="13" height="13" rx="3" fill="${WOOD_D}"/>
      <g stroke="${SILVER}" stroke-width=".8">${[22, 30, 37, 44, 50, 55].map((y) => `<path d="M55.5 ${y}h9"/>`).join('')}</g>
      <rect x="51" y="94" width="18" height="4" rx="1.5" fill="${EBONY}"/>
      <g stroke="#F3EBD9" stroke-width=".7">${[57, 59, 61, 63].map((x) => `<path d="M${x} 6V96"/>`).join('')}</g>
    </g>`,
  harp: () => `
    <path d="M24 112 L24 18 C40 10 60 20 74 28 C88 36 98 34 104 30" fill="none" stroke="${WOOD_L}" stroke-width="6" stroke-linecap="round"/>
    <path d="M28 108 L100 40" stroke="${WOOD}" stroke-width="9" stroke-linecap="round"/>
    <g stroke-width="1">${Array.from({ length: 13 }, (_, i) => { const x = 32 + i * 5.6; const top = 19 + Math.sin((i / 12) * Math.PI) * 8 + i * 0.6; const bot = 104 - i * 5.3; return `<path d="M${x} ${top}V${bot}" stroke="${i % 7 === 0 ? '#D2443B' : i % 7 === 3 ? '#2B2F4A' : '#EEE4CE'}"/>`; }).join('')}</g>
    <rect x="18" y="108" width="20" height="8" rx="2" fill="${WOOD_D}"/>`,
  bassoon: () => `
    <g transform="rotate(10 60 60)">
      <path d="M44 22 C40 14 32 10 26 12" fill="none" stroke="${SILVER}" stroke-width="2.4"/>
      <path d="M24 10 l-4 -3" stroke="#C79A64" stroke-width="3" stroke-linecap="round"/>
      <rect x="44" y="14" width="10" height="92" rx="3" fill="#7A3519"/>
      <rect x="56" y="4" width="13" height="104" rx="3" fill="#8E4220"/>
      <path d="M44 104 h25 v8 a4 4 0 0 1 -4 4 h-17 a4 4 0 0 1 -4 -4z" fill="#5E2412"/>
      <rect x="55" y="2" width="15" height="5" rx="2" fill="${SILVER}"/>
      <rect x="43" y="60" width="27" height="3" fill="${SILVER}"/>
      ${[30, 38, 46, 70, 78, 86].map((y) => `<circle cx="${y < 60 ? 49 : 62.5}" cy="${y}" r="2.4" fill="#2A1008" stroke="${SILVER}" stroke-width="1"/>`).join('')}
    </g>`,
  'sleigh-bells': () => `
    <path d="M16 70 C30 40 90 40 104 70" fill="none" stroke="#5A2E16" stroke-width="9" stroke-linecap="round"/>
    <rect x="48" y="78" width="24" height="34" rx="6" fill="${WOOD_D}"/>
    ${[22, 34, 47, 60, 73, 86, 98].map((x, i) => { const y = 66 - Math.sin(((x - 16) / 88) * Math.PI) * 22; return `<circle cx="${x}" cy="${y}" r="7" fill="url(#cym)" stroke="#9A6E1E"/><path d="M${x - 4} ${y + 2}h8" stroke="#3A2408" stroke-width="1.4"/>`; }).join('')}`,
  congas: () => `
    <path d="M22 30 C18 60 20 90 28 112 H54 C62 90 64 60 60 30Z" fill="#9A4E22" stroke="#5E2C10" stroke-width="2"/>
    <ellipse cx="41" cy="30" rx="19" ry="5" fill="url(#head)" stroke="${SILVER_D}" stroke-width="2"/>
    <path d="M58 40 C54 68 56 94 64 114 H94 C102 94 104 68 100 40Z" fill="#B8622E" stroke="#5E2C10" stroke-width="2"/>
    <ellipse cx="79" cy="40" rx="21" ry="5.5" fill="url(#head)" stroke="${SILVER_D}" stroke-width="2"/>
    <path d="M23 50 H59 M60 62 H101" stroke="${SILVER_D}" stroke-width="1.5" opacity=".7"/>`,
  bongos: () => `
    <path d="M14 56 L20 92 H48 L54 56Z" fill="#8E4A22" stroke="#5E2C10" stroke-width="2"/>
    <ellipse cx="34" cy="56" rx="20" ry="6" fill="url(#head)" stroke="${SILVER_D}" stroke-width="2.4"/>
    <rect x="52" y="66" width="14" height="10" rx="2" fill="${WOOD_D}"/>
    <path d="M62 50 L70 94 H106 L112 50Z" fill="#9A5226" stroke="#5E2C10" stroke-width="2"/>
    <ellipse cx="87" cy="50" rx="25" ry="7" fill="url(#head)" stroke="${SILVER_D}" stroke-width="2.4"/>`,
  agogo: () => `
    <path d="M30 20 L22 84 H50 L42 20Z" fill="url(#silver)" stroke="${SILVER_D}" stroke-width="1.5"/>
    <ellipse cx="36" cy="84" rx="14" ry="4" fill="${SILVER_D}"/>
    <path d="M78 30 L68 98 H104 L94 30Z" fill="url(#silver)" stroke="${SILVER_D}" stroke-width="1.5"/>
    <ellipse cx="86" cy="98" rx="18" ry="5" fill="${SILVER_D}"/>
    <path d="M36 20 C36 4 86 6 86 30" fill="none" stroke="${SILVER_D}" stroke-width="4"/>
    <path d="M58 6 V112" stroke="${SILVER_D}" stroke-width="4" stroke-linecap="round"/>`,
  cowbell: () => `
    <path d="M44 20 H76 L92 96 H28Z" fill="#555553" stroke="#2A2A2A" stroke-width="2"/>
    <path d="M44 20 H60 L56 96 H28Z" fill="#6E6E6A"/>
    <ellipse cx="60" cy="96" rx="32" ry="6" fill="#1C1C1C"/>
    <rect x="54" y="10" width="12" height="12" rx="2" fill="#8A8A86"/>
    <path d="M100 40 L74 76" stroke="${WOOD_L}" stroke-width="4" stroke-linecap="round"/>`,
  claves: () => `
    <g stroke-linecap="round">
      <path d="M18 80 L102 66" stroke="#5A2E12" stroke-width="12"/><path d="M18 80 L102 66" stroke="#A35E2A" stroke-width="8"/>
      <path d="M30 26 L92 62" stroke="#5A2E12" stroke-width="12"/><path d="M30 26 L92 62" stroke="#B86E35" stroke-width="8"/>
    </g>
    <path d="M58 52 l-6 -6 M64 48 l2 -8 M70 54 l8 -4" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`,
  guiro: () => `
    <ellipse cx="58" cy="66" rx="46" ry="20" fill="#C08A46" stroke="#6E4418" stroke-width="2"/>
    <g stroke="#6E4418" stroke-width="1.6">${Array.from({ length: 15 }, (_, i) => { const x = 24 + i * 5; const h = Math.sqrt(Math.max(0, 1 - ((x - 58) / 46) ** 2)) * 16; return `<path d="M${x} ${66 - h}V${66 + h}"/>`; }).join('')}</g>
    <path d="M88 52 L112 20" stroke="${WOOD_L}" stroke-width="4" stroke-linecap="round"/>`,
  shaker: () => `
    <ellipse cx="46" cy="64" rx="20" ry="28" fill="#E0A02E" stroke="#9A6410" stroke-width="2"/>
    <ellipse cx="40" cy="54" rx="6" ry="9" fill="#FFE08A" opacity=".7"/>
    <ellipse cx="82" cy="58" rx="14" ry="20" fill="#D24A3A" stroke="#8A2418" stroke-width="2"/>
    <path d="M14 40 l-6 -4 M12 64 h-8 M108 46 l6 -4 M110 66 h7" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`,
  cabasa: () => `
    <rect x="54" y="78" width="12" height="38" rx="4" fill="${WOOD_D}"/>
    <ellipse cx="60" cy="50" rx="34" ry="30" fill="#8E5A2E"/>
    ${Array.from({ length: 7 }, (_, r) => Array.from({ length: 11 }, (_, k) => { const x = 30 + k * 6; const y = 30 + r * 6.5; return ((x - 60) / 33) ** 2 + ((y - 50) / 29) ** 2 < 0.9 ? `<circle cx="${x}" cy="${y}" r="2.4" fill="${(r + k) % 2 ? SILVER : '#F4F7F9'}" stroke="${SILVER_D}" stroke-width=".4"/>` : ''; }).join('')).join('')}`,
  'log-drum': () => `
    <path d="M10 56 L22 96 H98 L110 56Z" fill="#6E3A18"/>
    <rect x="10" y="44" width="100" height="14" rx="3" fill="#A3622E"/>
    <path d="M20 51 H58 M66 51 H100" stroke="#2A1408" stroke-width="3"/>
    <path d="M58 51 v-4 v8 M20 51 v-4 v8 M66 51 v-4 v8 M100 51 v-4 v8" stroke="#2A1408" stroke-width="2"/>
    <g stroke="${WOOD_L}" stroke-width="3" stroke-linecap="round"><path d="M30 14L40 40"/><path d="M90 12L78 40"/></g>
    <circle cx="29" cy="12" r="5" fill="#3B2418"/><circle cx="91" cy="10" r="5" fill="#3B2418"/>`,
  kalimba: () => `
    <rect x="14" y="20" width="92" height="84" rx="12" fill="${WOOD}" stroke="${WOOD_D}" stroke-width="2"/>
    <circle cx="60" cy="88" r="7" fill="#2A1708"/>
    ${[22, 30, 38, 46, 54, 62, 70, 78, 86, 94].map((x, i) => { const rank = Math.abs(x - 58) / 8; const top = 26 + rank * 6; return `<rect x="${x - 2.5}" y="${top}" width="5" height="${64 - top}" rx="2.5" fill="url(#silver)" stroke="${SILVER_D}" stroke-width=".6"/>`; }).join('')}
    <rect x="18" y="62" width="84" height="5" rx="1" fill="${SILVER_D}"/>`,
  glockenspiel: () => bars(['#E6EBEE', '#D2D9DE'], false),
  xylophone: () => bars(['#B5683A', '#A55B30'], false),
  marimba: () => bars(['#8E4A2A', '#7F4024'], true),
};

let n = 0;
export function art(id, label = '') {
  // Gradient ids are made unique per drawing: a hidden drawing's gradients don't paint.
  const k = `a${++n}`;
  return svg(defs + (ART[id] ? ART[id]() : ''), label).replace(/id="(\w+)"/g, `id="${k}$1"`).replace(/url\(#(\w+)\)/g, `url(#${k}$1)`);
}
