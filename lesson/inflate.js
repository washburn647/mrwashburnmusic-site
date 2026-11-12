/* Raw DEFLATE (RFC 1951) in plain JavaScript, for browsers without
   DecompressionStream('deflate-raw') (iPadOS and iOS before 16.4).
   inflate(Uint8Array) -> Uint8Array. */

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/* A Huffman table from code lengths: counts per length and symbols in code order. */
function table(lengths) {
  const count = new Uint16Array(16);
  for (const l of lengths) count[l]++;
  count[0] = 0;
  const offs = new Uint16Array(16);
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
  const sym = new Uint16Array(lengths.length);
  for (let i = 0; i < lengths.length; i++) if (lengths[i]) sym[offs[lengths[i]]++] = i;
  return { count, sym };
}

let FIXED = null;
function fixed() {
  if (!FIXED) {
    const l = new Uint8Array(288);
    l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
    FIXED = [table(l), table(new Uint8Array(30).fill(5))];
  }
  return FIXED;
}

export function inflate(src) {
  let pos = 0, bit = 0;
  let out = new Uint8Array(Math.max(1024, src.length * 4));
  let n = 0;
  const need = (k) => {
    if (n + k <= out.length) return;
    let size = out.length * 2;
    while (size < n + k) size *= 2;
    const bigger = new Uint8Array(size);
    bigger.set(out.subarray(0, n));
    out = bigger;
  };
  const bits = (k) => {
    let v = 0;
    for (let i = 0; i < k; i++) {
      if (pos >= src.length) throw new Error('inflate: data ends early');
      v |= ((src[pos] >> bit) & 1) << i;
      if (++bit === 8) { bit = 0; pos++; }
    }
    return v;
  };
  const decode = (t) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const c = t.count[len];
      if (code - c < first) return t.sym[index + (code - first)];
      index += c;
      first += c;
      first <<= 1;
      code <<= 1;
    }
    throw new Error('inflate: bad code');
  };

  let last = 0;
  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      if (bit) { bit = 0; pos++; }
      if (pos + 4 > src.length) throw new Error('inflate: data ends early');
      const len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      if (pos + len > src.length) throw new Error('inflate: data ends early');
      need(len);
      out.set(src.subarray(pos, pos + len), n);
      n += len;
      pos += len;
      continue;
    }
    let lt, dt;
    if (type === 1) [lt, dt] = fixed();
    else if (type === 2) {
      const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) cl[CLORDER[i]] = bits(3);
      const ct = table(cl);
      const lens = new Uint8Array(hlit + hdist);
      for (let i = 0; i < hlit + hdist;) {
        const s = decode(ct);
        if (s < 16) lens[i++] = s;
        else {
          let rep, val = 0;
          if (s === 16) { if (!i) throw new Error('inflate: bad lengths'); val = lens[i - 1]; rep = 3 + bits(2); }
          else if (s === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          if (i + rep > hlit + hdist) throw new Error('inflate: bad lengths');
          lens.fill(val, i, i + rep);
          i += rep;
        }
      }
      lt = table(lens.subarray(0, hlit));
      dt = table(lens.subarray(hlit));
    } else throw new Error('inflate: bad block');
    for (;;) {
      let s = decode(lt);
      if (s < 256) { need(1); out[n++] = s; continue; }
      if (s === 256) break;
      s -= 257;
      if (s >= 29) throw new Error('inflate: bad length');
      const len = LBASE[s] + bits(LEXT[s]);
      const d = decode(dt);
      if (d >= 30) throw new Error('inflate: bad distance');
      const dist = DBASE[d] + bits(DEXT[d]);
      if (dist > n) throw new Error('inflate: bad distance');
      need(len);
      for (let i = 0; i < len; i++, n++) out[n] = out[n - dist];
    }
  }
  return out.slice(0, n);
}

/* Inflate with the browser when it can, else with the code above. */
export async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    } catch { /* 'deflate-raw' not supported here */ }
  }
  return inflate(bytes);
}

/* Deflate with the browser, or null where it can't (the caller stores the bytes as they are). */
export async function deflateRaw(bytes) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  } catch { return null; }
}
