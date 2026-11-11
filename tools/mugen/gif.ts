// Minimal GIF decoder: returns the first image as RGBA. Enough for sprite sheet rips.

export interface DecodedGif {
  width: number;
  height: number;
  rgba: Uint8Array;
  /** True when the image declares a transparent colour. */
  hasTransparency: boolean;
}

function lzwDecode(data: Uint8Array, minCodeSize: number, pixelCount: number): Uint8Array {
  const out = new Uint8Array(pixelCount);
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const prefix = new Int16Array(4096).fill(-1);
  const suffix = new Uint8Array(4096);
  const first = new Uint8Array(4096);
  for (let i = 0; i < clear; i++) {
    suffix[i] = i;
    first[i] = i;
  }
  const stack = new Uint8Array(4097);
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let prev = -1;
  let bitBuf = 0;
  let bitCount = 0;
  let pos = 0;
  let o = 0;

  const emit = (code: number, extra: number) => {
    let sp = 0;
    if (extra >= 0) stack[sp++] = extra;
    let c = code;
    while (c >= 0 && sp < stack.length) {
      stack[sp++] = suffix[c] ?? 0;
      c = c >= clear ? (prefix[c] ?? -1) : -1;
    }
    while (sp > 0 && o < pixelCount) out[o++] = stack[--sp] ?? 0;
  };

  while (pos < data.length || bitCount >= codeSize) {
    while (bitCount < codeSize && pos < data.length) {
      bitBuf |= (data[pos++] ?? 0) << bitCount;
      bitCount += 8;
    }
    if (bitCount < codeSize) break;
    const code = bitBuf & ((1 << codeSize) - 1);
    bitBuf >>>= codeSize;
    bitCount -= codeSize;

    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = eoi + 1;
      prev = -1;
      continue;
    }
    if (code === eoi) break;
    if (prev < 0) {
      emit(code, -1);
      prev = code;
      continue;
    }
    let firstChar: number;
    if (code < next) {
      emit(code, -1);
      firstChar = first[code] ?? 0;
    } else {
      // KwKwK case: the code being defined right now.
      firstChar = first[prev] ?? 0;
      emit(prev, firstChar);
    }
    if (next < 4096) {
      prefix[next] = prev;
      suffix[next] = firstChar;
      first[next] = first[prev] ?? 0;
      next++;
      if (next === 1 << codeSize && codeSize < 12) codeSize++;
    }
    prev = code;
    if (o >= pixelCount) break;
  }
  return out;
}

export function decodeGif(input: Uint8Array): DecodedGif {
  const b = input;
  const sig = String.fromCharCode(...b.subarray(0, 6));
  if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('not a GIF');
  const u16 = (p: number) => (b[p] ?? 0) | ((b[p + 1] ?? 0) << 8);
  const width = u16(6);
  const height = u16(8);
  const packed = b[10] ?? 0;
  let pos = 13;
  let globalTable: Uint8Array | undefined;
  if (packed & 0x80) {
    const size = 3 * (1 << ((packed & 7) + 1));
    globalTable = b.subarray(pos, pos + size);
    pos += size;
  }
  let transparentIndex = -1;
  const skipSubBlocks = () => {
    while (pos < b.length) {
      const len = b[pos++] ?? 0;
      if (len === 0) return;
      pos += len;
    }
  };
  while (pos < b.length) {
    const block = b[pos++];
    if (block === 0x21) {
      const label = b[pos++];
      if (label === 0xf9) {
        const flags = b[pos + 1] ?? 0;
        if (flags & 1) transparentIndex = b[pos + 4] ?? -1;
      }
      skipSubBlocks();
    } else if (block === 0x2c) {
      const left = u16(pos);
      const top = u16(pos + 2);
      const w = u16(pos + 4);
      const h = u16(pos + 6);
      const ipacked = b[pos + 8] ?? 0;
      pos += 9;
      let table = globalTable;
      if (ipacked & 0x80) {
        const size = 3 * (1 << ((ipacked & 7) + 1));
        table = b.subarray(pos, pos + size);
        pos += size;
      }
      const interlaced = (ipacked & 0x40) !== 0;
      const minCodeSize = b[pos++] ?? 2;
      const chunks: Uint8Array[] = [];
      while (pos < b.length) {
        const len = b[pos++] ?? 0;
        if (len === 0) break;
        chunks.push(b.subarray(pos, pos + len));
        pos += len;
      }
      const data = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let off = 0;
      for (const c of chunks) {
        data.set(c, off);
        off += c.length;
      }
      const indices = lzwDecode(data, minCodeSize, w * h);
      // Row order for interlaced images: passes start at 0,4,2,1 with steps 8,8,4,2.
      const rows: number[] = [];
      if (interlaced) {
        for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]] as const) for (let y = start; y < h; y += step) rows.push(y);
      } else for (let y = 0; y < h; y++) rows.push(y);
      const rgba = new Uint8Array(width * height * 4);
      rows.forEach((y, srcRow) => {
        for (let x = 0; x < w; x++) {
          const idx = indices[srcRow * w + x] ?? 0;
          if (idx === transparentIndex) continue;
          const dx = left + x;
          const dy = top + y;
          if (dx >= width || dy >= height) continue;
          const o = (dy * width + dx) * 4;
          rgba[o] = table?.[idx * 3] ?? 0;
          rgba[o + 1] = table?.[idx * 3 + 1] ?? 0;
          rgba[o + 2] = table?.[idx * 3 + 2] ?? 0;
          rgba[o + 3] = 255;
        }
      });
      return { width, height, rgba, hasTransparency: transparentIndex >= 0 };
    } else {
      break; // trailer (0x3b) or unknown block
    }
  }
  throw new Error('GIF has no image');
}
