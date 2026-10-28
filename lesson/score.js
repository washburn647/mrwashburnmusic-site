/* MusicXML: reading piece files, slimming them to travel in a link, and
   loading OpenSheetMusicDisplay (lesson/vendor, BSD licence) to draw them. */

import { OSMD_SRC } from './paths.js';

const scripts = {};
export function loadScript(src) {
  if (!scripts[src]) {
    scripts[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { delete scripts[src]; reject(new Error(`could not load ${src}`)); };
      document.head.append(s);
    });
  }
  return scripts[src];
}

export async function loadOSMD() {
  await loadScript(OSMD_SRC);
  return window.opensheetmusicdisplay;
}

/* ---------- Reading files: .musicxml / .xml, or compressed .mxl (a zip) ---------- */

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf) {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nameLen));
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    files[name] = { method, data: new Uint8Array(buf, start, size) };
    p += 46 + nameLen + extraLen + commentLen;
  }
  const read = async (f) => new TextDecoder().decode(f.method === 8 ? await inflate(f.data) : f.data);
  let root = null;
  if (files['META-INF/container.xml']) {
    const c = new DOMParser().parseFromString(await read(files['META-INF/container.xml']), 'application/xml');
    root = c.querySelector('rootfile')?.getAttribute('full-path');
  }
  if (!root || !files[root]) root = Object.keys(files).find((k) => !k.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(k));
  if (!root) throw new Error('no score in zip');
  return read(files[root]);
}

/* A picked file -> MusicXML text. */
export async function readPieceFile(file) {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  if (head[0] === 0x50 && head[1] === 0x4b) return unzip(buf);
  let text = new TextDecoder().decode(buf);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (/^\s*<\?xml[^>]*encoding="utf-16/i.test(text) || head[0] === 0xff || head[0] === 0xfe) text = new TextDecoder('utf-16').decode(buf);
  return text;
}

export function parseXML(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror') || doc.documentElement.nodeName !== 'score-partwise') throw new Error('not a MusicXML score');
  return doc;
}

/* Layout hints (default-x and friends) make up most of a file and the player
   lays the music out itself, so they are dropped before a piece goes in a link. */
const DROP_ATTRS = ['default-x', 'default-y', 'relative-x', 'relative-y', 'width', 'color', 'font-family', 'font-size', 'font-style', 'font-weight', 'bezier-x', 'bezier-y', 'print-spacing'];

export function slimXML(text) {
  const doc = parseXML(text);
  const walk = document.createTreeWalker(doc, NodeFilter.SHOW_ALL);
  const drop = [];
  for (let n = walk.currentNode; n; n = walk.nextNode()) {
    if (n.nodeType === Node.COMMENT_NODE || n.nodeType === Node.PROCESSING_INSTRUCTION_NODE || n.nodeType === Node.DOCUMENT_TYPE_NODE) drop.push(n);
    else if (n.nodeType === Node.TEXT_NODE && !n.nodeValue.trim()) drop.push(n);
    else if (n.nodeType === Node.ELEMENT_NODE) {
      for (const a of DROP_ATTRS) n.removeAttribute(a);
      if (n.nodeName === 'encoding' || n.nodeName === 'defaults' || n.nodeName === 'appearance') drop.push(n);
    }
  }
  drop.forEach((n) => n.remove());
  return new XMLSerializer().serializeToString(doc);
}

export function pieceInfo(text) {
  const doc = parseXML(text);
  const pick = (sel) => doc.querySelector(sel)?.textContent.trim() || '';
  const credit = [...doc.querySelectorAll('credit')].find((c) => c.querySelector('credit-type')?.textContent === 'title');
  const title = pick('work > work-title') || pick('movement-title') || credit?.querySelector('credit-words')?.textContent.trim() || '';
  const parts = [...doc.querySelectorAll('part-list > score-part')].map((p) => p.querySelector('part-name')?.textContent.trim() || '');
  const measures = doc.querySelector('part')?.querySelectorAll(':scope > measure').length || 0;
  return { title, parts, measures };
}

/* ---------- Note names ---------- */

const LETTERS = 'CDEFGAB';
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
/* Major-key tonic letter for key signatures from 7 flats to 7 sharps. */
const TONIC_LETTER = [0, 4, 1, 5, 2, 6, 3, 0, 4, 1, 5, 2, 6, 3, 0];
const SYL = ['do', 're', 'mi', 'fa', 'so', 'la', 'ti'];
const SYL_UP = { do: 'di', re: 'ri', fa: 'fi', so: 'si', la: 'li' };
const SYL_DOWN = { re: 'ra', mi: 'me', so: 'se', la: 'le', ti: 'te' };

export function letterName(letter, alter) {
  return LETTERS[letter] + (alter > 0 ? '♯'.repeat(alter) : '♭'.repeat(-alter));
}

/* Moveable do; minor keys are la-based, so do is the relative major's tonic. */
export function solfege(letter, alter, fifths) {
  const f = Math.max(-7, Math.min(7, fifths | 0));
  const doLetter = TONIC_LETTER[f + 7];
  const doPc = ((f * 7) % 12 + 12) % 12;
  const deg = (letter - doLetter + 7) % 7;
  const pc = (LETTER_PC[letter] + alter + 12) % 12;
  let diff = (pc - doPc - LETTER_PC[deg] + 24) % 12;
  if (diff > 6) diff -= 12;
  const base = SYL[deg];
  if (diff === 1) return SYL_UP[base] || base;
  if (diff === -1) return SYL_DOWN[base] || base;
  return base;
}
