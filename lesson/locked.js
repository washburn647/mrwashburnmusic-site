/* Locked student pages. Each private student has a code of five words. The code makes
   (in this browser, never sent anywhere) a key that encrypts their pages, an id that names
   their box on the site, and a token that lets them add practice results to it. The site
   keeps only what it can't read (see /worker/index.js). Kyle keeps the codes in the studio.

   Pages: { v: 1, n: first name, i: instrument, l: [lesson pages, newest first], p: [MusicXML] }
   (lesson pages as in codec.js; their pieces point into the shared p). */

import { API } from './paths.js';

const WORDS = `
  acorn angel apple apron arrow badge bagel baker banjo beach beans bear bell berry bike bird blue
  boat bones book boots brave bread brick broom brush bubble bunny cabin cake camel candy canoe cape
  cards carrot castle cello chalk cheese cherry chess chick chips clay cliff clock cloud clover coast
  cocoa comet cookie coral corn cotton cozy crab crane crayon cream crown cub cupcake daisy dance deer
  desert dino dolphin donut dragon drum duck eagle earth elf fairy farm feather fern fiddle field fig
  finch fire fish flag flute foam fog forest fox frog frost fudge garden gecko gem giant ginger glass
  glove goat gold goose grape grass green guitar gull hammer happy harp hat hawk heart hedge hero hill
  hippo honey hoop horn horse house igloo iris island ivy jam jelly jewel joke juice jump kayak kettle
  kite kiwi koala ladder lake lamb lamp lemon leaf lime lion llama lucky lunch magic mango maple
  marble meadow melon mint mitten mole moon moose moss mouse muffin music nest noodle oak ocean olive
  orange otter owl paint panda paper park peach pear pebble pencil penny pepper piano pickle pie pig
  pillow pine pizza planet plum pony popcorn puppy puzzle rabbit radio rain ribbon river robin rocket
  rose ruby salad sand scarf seed shell ship silver skate sky sled snail snow sock song spoon star
  stone storm sugar sun swan swing table taco tea teddy tent tiger toast tomato train tree tulip tuba
  turtle valley violin wagon walrus water whale wheat willow wind wolf yarn yeti yogurt zebra
`.trim().split(/\s+/);
const SET = new Set(WORDS);

export function newCode() {
  const n = crypto.getRandomValues(new Uint8Array(5));
  return [...n].map((x) => WORDS[x]).join('-');
}

/* A typed or linked code, tidied: "Tiger moon, PIANO..." becomes "tiger-moon-piano...". */
export function cleanCode(text) {
  const words = String(text || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return words.length === 5 && words.every((w) => SET.has(w)) ? words.join('-') : '';
}

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
async function sha256(text) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}

const made = new Map();
/* { key, id, token } for a code. Slow on purpose, so codes can't be guessed quickly. */
export function keysFor(code) {
  if (!made.has(code)) {
    made.set(code, (async () => {
      const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
      const bits = new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('mwm-student-v1'), iterations: 300000 }, base, 512));
      const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
      return { key, id: hex(bits.slice(32, 48)), token: hex(bits.slice(48, 64)) };
    })());
  }
  return made.get(code);
}

export async function seal(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream('deflate-raw'));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function unseal(key, box) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
  return JSON.parse(new TextDecoder().decode(await pipe(new Uint8Array(plain), new DecompressionStream('deflate-raw'))));
}

async function call(path, init) {
  if (API == null) throw new Error('offline');
  const r = await fetch(API + path, { cache: 'no-store', ...init });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

/* ---------- The student's side ---------- */

/* Their pages, or null when the code opens nothing. */
export async function openPages(code) {
  const { key, id } = await keysFor(code);
  const box = await call(`/api/s/${id}`);
  return box && unseal(key, box);
}

export async function sendResult(code, result) {
  const { key, id, token } = await keysFor(code);
  await call(`/api/s/${id}/r`, { method: 'POST', headers: { 'X-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify(await seal(key, result)) });
}

/* ---------- Kyle's side (the studio, behind Cloudflare Access) ---------- */

export async function publish(code, pages) {
  const { key, id, token } = await keysFor(code);
  const box = await seal(key, pages);
  return call(`/studio/api/s/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...box, token: await sha256(token) }) });
}

export async function results(code) {
  const { key, id } = await keysFor(code);
  const got = await call(`/studio/api/s/${id}/r`);
  const out = [];
  for (const r of got?.results || []) { try { out.push(await unseal(key, r)); } catch { /* not ours */ } }
  return out;
}

export async function unpublish(code) {
  const { id } = await keysFor(code);
  return call(`/studio/api/s/${id}`, { method: 'DELETE' });
}
