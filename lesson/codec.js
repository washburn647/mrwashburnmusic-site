/* A lesson page travels inside its own link, after the #, so it is never
   sent to or stored on any server. The part after # is the page's JSON,
   deflated and base64url encoded.
   { v: 1, n: first name, i: instrument, d: 'YYYY-MM-DD', t: [[title, detail, link]], m: note } */

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function encodeLesson(page) {
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify(page)), new CompressionStream('deflate-raw'));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function decodeLesson(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const page = JSON.parse(new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw'))));
  if (!page || page.v !== 1) throw new Error('not a lesson page');
  const str = (x) => (typeof x === 'string' ? x : '');
  return {
    n: str(page.n), i: str(page.i), d: str(page.d), m: str(page.m),
    t: (Array.isArray(page.t) ? page.t : []).map((r) => (Array.isArray(r) ? r : [])).map((r) => [str(r[0]), str(r[1]), safeLink(r[2])]),
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
