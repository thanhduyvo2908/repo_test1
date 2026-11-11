// Minimal PNG encoder (RGBA) and decoder (8-bit or lower, non-interlaced) on top of node:zlib.
import { deflateSync, inflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePngRgba(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

export interface DecodedPng {
  width: number;
  height: number;
  /** Palette indices, set for colour type 3. */
  indices?: Uint8Array;
  /** RGBA pixels, set for every other colour type. */
  rgba?: Uint8Array;
  /** PLTE as RGB triplets, if present. */
  palette?: Uint8Array;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function decodePng(input: Uint8Array): DecodedPng {
  const buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 0;
  let interlace = 0;
  let palette: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  const idat: Buffer[] = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      interlace = data.readUInt8(12);
    } else if (type === 'PLTE') palette = new Uint8Array(data);
    else if (type === 'tRNS') trns = new Uint8Array(data);
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (interlace) throw new Error('interlaced PNG not supported');
  if (bitDepth > 8) throw new Error(`PNG bit depth ${bitDepth} not supported`);
  const channelsByType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (!channels) throw new Error(`PNG colour type ${colorType} not supported`);
  const bitsPerPixel = channels * bitDepth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const raw = inflateSync(Buffer.concat(idat));
  const lines = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw.readUInt8(y * (stride + 1));
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw.readUInt8(src + x);
      const a = x >= bpp ? (lines[dst + x - bpp] ?? 0) : 0;
      const b = y > 0 ? (lines[dst - stride + x] ?? 0) : 0;
      const c = x >= bpp && y > 0 ? (lines[dst - stride + x - bpp] ?? 0) : 0;
      let out = v;
      if (filter === 1) out = v + a;
      else if (filter === 2) out = v + b;
      else if (filter === 3) out = v + ((a + b) >> 1);
      else if (filter === 4) out = v + paeth(a, b, c);
      lines[dst + x] = out & 0xff;
    }
  }
  const sample = (y: number, x: number, ch: number): number => {
    const bitIndex = (x * channels + ch) * bitDepth;
    const byte = lines[y * stride + (bitIndex >> 3)] ?? 0;
    if (bitDepth === 8) return byte;
    const shift = 8 - bitDepth - (bitIndex & 7);
    return (byte >> shift) & ((1 << bitDepth) - 1);
  };
  if (colorType === 3) {
    const indices = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) indices[y * width + x] = sample(y, x, 0);
    return { width, height, indices, ...(palette ? { palette } : {}) };
  }
  const scale = 255 / ((1 << bitDepth) - 1);
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (colorType === 0 || colorType === 4) {
        const g = sample(y, x, 0) * scale;
        rgba[o] = g;
        rgba[o + 1] = g;
        rgba[o + 2] = g;
        rgba[o + 3] = colorType === 4 ? sample(y, x, 1) * scale : 255;
      } else {
        rgba[o] = sample(y, x, 0) * scale;
        rgba[o + 1] = sample(y, x, 1) * scale;
        rgba[o + 2] = sample(y, x, 2) * scale;
        rgba[o + 3] = colorType === 6 ? sample(y, x, 3) * scale : 255;
      }
    }
  }
  void trns; // tRNS for RGB images is rare in MUGEN files; ignored.
  return { width, height, rgba, ...(palette ? { palette } : {}) };
}
