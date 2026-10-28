/* A lesson page travels inside its own link, after the #, so it is never
   sent to or stored on any server. The part after # is the page's JSON,
   deflated and base64url encoded. Pieces (MusicXML) ride along inside it.

   v2: { v: 2, n: first name, i: instrument, d: 'YYYY-MM-DD', m: note,
         s: stars 0-3, k: sticker, w: practice minutes a day,
         g: [[goal or piece, status 0 learning / 1 polishing / 2 done]],
         t: [{ a: title, b: detail, l: link, q: tempo, p: piece index, u: piece setup, c: card deck }],
         p: [MusicXML] }
   v1 (older links): { v: 1, n, i, d, m, t: [[title, detail, link]] } */

export const STICKERS = ['⭐', '🌟', '🏆', '🎸', '🎹', '🎺', '🥁', '🎻', '🎷', '🎤', '🎵', '🦄', '🐱', '🐶', '🦖', '🐙', '🦊', '🐸', '🚀', '🌈', '🔥', '💎', '🍕', '🍩', '🎉', '👑', '💪', '😎'];

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function encodeLesson(page) {
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify(page)), new CompressionStream('deflate-raw'));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const str = (x, max = 20000) => (typeof x === 'string' ? x.slice(0, max) : '');
const int = (x, lo, hi) => (Number.isInteger(x) && x >= lo && x <= hi ? x : undefined);
const ints = (x, lo, hi) => (Array.isArray(x) ? x.filter((n) => int(n, lo, hi) !== undefined).slice(0, 64) : undefined);

/* Only the settings the player knows, as small whole numbers. */
export function cleanSetup(u) {
  if (!u || typeof u !== 'object') return {};
  const out = { s: int(u.s, 20, 200), k: int(u.k, -12, 12), n: int(u.n, 0, 2), c: int(u.c, 0, 1), x: int(u.x, 0, 1), ci: int(u.ci, 0, 1), m: ints(u.m, 0, 999), h: ints(u.h, 0, 999), a: int(u.a, 0, 9999), b: int(u.b, 0, 9999) };
  for (const k of Object.keys(out)) if (out[k] === undefined || (Array.isArray(out[k]) && !out[k].length)) delete out[k];
  if ((out.a === undefined) !== (out.b === undefined)) { delete out.a; delete out.b; }
  return out;
}

const PITCH = /^[A-G](#|b)?[0-8]$/;
const CELLS = /^[a-z0-9]{1,6}$/;
export function cleanDeck(c) {
  if (!c || typeof c !== 'object') return null;
  if (c.k === 'n') {
    const notes = (Array.isArray(c.r) ? c.r : []).filter((p) => typeof p === 'string' && PITCH.test(p)).slice(0, 60);
    if (!notes.length) return null;
    return { k: 'n', f: ['g', 'f', 'c', 'gf'].includes(c.f) ? c.f : 'g', r: notes, y: int(c.y, -7, 7) ?? 0, a: int(c.a, 0, 1) ?? 0 };
  }
  if (c.k === 'r') {
    const cells = (Array.isArray(c.l) ? c.l : []).filter((x) => typeof x === 'string' && CELLS.test(x)).slice(0, 20);
    if (!cells.length) return null;
    return { k: 'r', m: ['2/4', '3/4', '4/4', '6/8'].includes(c.m) ? c.m : '4/4', l: cells, n: int(c.n, 1, 4) ?? 1, q: int(c.q, 40, 200) ?? 80 };
  }
  return null;
}

export async function decodeLesson(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const page = JSON.parse(new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw'))));
  if (!page || (page.v !== 1 && page.v !== 2)) throw new Error('not a lesson page');
  const pieces = (page.v === 2 && Array.isArray(page.p) ? page.p : []).map((x) => str(x, 4e6));
  const items = (Array.isArray(page.t) ? page.t : []).slice(0, 100).map((r) => {
    if (Array.isArray(r)) return { a: str(r[0]), b: str(r[1]), l: safeLink(r[2]) };
    if (!r || typeof r !== 'object') return { a: '', b: '', l: '' };
    const it = { a: str(r.a), b: str(r.b), l: safeLink(r.l) };
    const q = int(r.q, 20, 300);
    if (q) it.q = q;
    const p = int(r.p, 0, pieces.length - 1);
    if (p !== undefined && pieces[p]) { it.p = p; it.u = cleanSetup(r.u); }
    const c = cleanDeck(r.c);
    if (c) it.c = c;
    return it;
  });
  return {
    n: str(page.n, 100), i: str(page.i, 100), d: str(page.d, 10), m: str(page.m),
    s: int(page.s, 0, 3) || 0, k: STICKERS.includes(page.k) ? page.k : '', w: int(page.w, 1, 240) || 0,
    g: (Array.isArray(page.g) ? page.g : []).slice(0, 50).map((x) => (Array.isArray(x) ? [str(x[0], 300), int(x[1], 0, 2) || 0] : null)).filter((x) => x && x[0]),
    t: items, p: pieces,
  };
}

/* Only plain web links; anything else (javascript:, data:) is dropped. */
export function safeLink(link) {
  if (typeof link !== 'string' || !link.trim()) return '';
  let s = link.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch { return ''; }
}

export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return new Date(+m[1], m[2] - 1, +m[3]).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
