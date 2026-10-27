/* Minimal zip reader: enough to open a .pptx in the browser.
   Reads the central directory, then inflates each entry on demand with the
   built-in DecompressionStream, so there is no library to ship. */

export async function openZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // End of central directory: the last record, within 64 KB of the end.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This file is not a PowerPoint (.pptx) file.');

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = new Map();
  const utf8 = new TextDecoder();

  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Damaged .pptx file.');
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, size, local });
    p += 46 + nameLen + extraLen + commentLen;
  }

  async function raw(name) {
    const e = entries.get(name);
    if (!e) return null;
    const lp = e.local;
    const start = lp + 30 + view.getUint16(lp + 26, true) + view.getUint16(lp + 28, true);
    const data = bytes.subarray(start, start + e.size);
    if (e.method === 0) return data.slice();
    if (e.method !== 8) throw new Error('Unsupported compression in ' + name);
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  return {
    names: () => [...entries.keys()],
    has: (name) => entries.has(name),
    bytes: raw,
    text: async (name) => {
      const b = await raw(name);
      return b ? utf8.decode(b) : null;
    }
  };
}
