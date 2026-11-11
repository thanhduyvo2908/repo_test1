// Reader for MUGEN sprite files: SFF v1 (PCX sprites) and SFF v2 (raw, RLE8, RLE5, LZ5, PNG).
import { decodePng } from './png';

export interface SffSprite {
  group: number;
  image: number;
  width: number;
  height: number;
  axisX: number;
  axisY: number;
  /** Decodes to RGBA; palette index 0 becomes transparent. */
  decode(): Uint8Array;
}

export interface Sff {
  version: 1 | 2;
  sprites: SffSprite[];
  get(group: number, image: number): SffSprite | undefined;
}

const key = (g: number, i: number): string => `${g},${i}`;

/** Byte read that never returns undefined (out of range reads give 0). */
function at(a: Uint8Array, i: number): number {
  return a[i] ?? 0;
}

function finish(version: 1 | 2, sprites: SffSprite[]): Sff {
  const map = new Map<string, SffSprite>();
  for (const s of sprites) if (!map.has(key(s.group, s.image))) map.set(key(s.group, s.image), s);
  return { version, sprites, get: (g, i) => map.get(key(g, i)) };
}

/** Indexed pixels + RGB palette (768 bytes) to RGBA, index 0 transparent. */
function toRgba(pixels: Uint8Array, palette: Uint8Array | undefined, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const idx = at(pixels, p);
    if (idx === 0) continue;
    const o = p * 4;
    if (palette) {
      out[o] = at(palette, idx * 3);
      out[o + 1] = at(palette, idx * 3 + 1);
      out[o + 2] = at(palette, idx * 3 + 2);
    } else {
      out[o] = idx;
      out[o + 1] = idx;
      out[o + 2] = idx;
    }
    out[o + 3] = 255;
  }
  return out;
}

/**
 * Reads a .act palette. ACT files store colours in reverse order (entry 255 first),
 * so entry i of the file maps to palette index 255 - i.
 */
export function readAct(buf: Uint8Array): Uint8Array {
  const pal = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    const src = (255 - i) * 3;
    pal[i * 3] = at(buf, src);
    pal[i * 3 + 1] = at(buf, src + 1);
    pal[i * 3 + 2] = at(buf, src + 2);
  }
  return pal;
}

export function readSff(input: Uint8Array, actPalette?: Uint8Array): Sff {
  const buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (buf.toString('latin1', 0, 11) !== 'ElecbyteSpr') throw new Error('not an SFF file');
  const major = buf.readUInt8(15);
  if (major === 1) return readSffV1(buf, actPalette);
  if (major === 2) return readSffV2(buf);
  throw new Error(`unsupported SFF version ${major}`);
}

// ---------- SFF v1 ----------

interface PcxImage {
  width: number;
  height: number;
  pixels: Uint8Array;
}

function pcxPalette(data: Buffer): Uint8Array | undefined {
  if (data.length < 128 + 769) return undefined;
  if (data.readUInt8(data.length - 769) !== 0x0c) return undefined;
  return new Uint8Array(data.subarray(data.length - 768));
}

function decodePcx(data: Buffer, hasPalette: boolean): PcxImage {
  const xmin = data.readUInt16LE(4);
  const ymin = data.readUInt16LE(6);
  const xmax = data.readUInt16LE(8);
  const ymax = data.readUInt16LE(10);
  const planes = data.readUInt8(65);
  const bytesPerLine = data.readUInt16LE(66);
  if (data.readUInt8(3) !== 8 || planes !== 1) throw new Error('only 8-bit single-plane PCX is supported');
  const width = xmax - xmin + 1;
  const height = ymax - ymin + 1;
  const end = data.length - (hasPalette ? 769 : 0);
  const raw = new Uint8Array(bytesPerLine * height);
  let p = 128;
  let i = 0;
  while (i < raw.length && p < end) {
    let c = data.readUInt8(p++);
    let n = 1;
    if ((c & 0xc0) === 0xc0) {
      n = c & 0x3f;
      c = p < data.length ? data.readUInt8(p++) : 0;
    }
    while (n-- > 0 && i < raw.length) raw[i++] = c;
  }
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) pixels.set(raw.subarray(y * bytesPerLine, y * bytesPerLine + width), y * width);
  return { width, height, pixels };
}

function samePalette(a: Uint8Array | undefined, b: Uint8Array | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function readSffV1(buf: Buffer, act?: Uint8Array): Sff {
  const count = buf.readUInt32LE(20);
  let off = buf.readUInt32LE(24);
  interface Raw {
    data: Buffer;
    axisX: number;
    axisY: number;
    group: number;
    image: number;
    link: number;
    usesPrevPalette: boolean;
  }
  const raws: Raw[] = [];
  for (let i = 0; i < count && off > 0 && off + 32 <= buf.length; i++) {
    const next = buf.readUInt32LE(off);
    const len = buf.readUInt32LE(off + 4);
    raws.push({
      data: buf.subarray(off + 32, off + 32 + len),
      axisX: buf.readInt16LE(off + 8),
      axisY: buf.readInt16LE(off + 10),
      group: buf.readUInt16LE(off + 12),
      image: buf.readUInt16LE(off + 14),
      link: buf.readUInt16LE(off + 16),
      usesPrevPalette: buf.readUInt8(off + 18) === 1,
    });
    if (next <= off) break;
    off = next;
  }
  // Index of the sprite that actually holds the pixel data (follows links).
  const dataIndex = (i: number): number => {
    let j = i;
    for (let guard = 0; guard < 64; guard++) {
      const r = raws[j];
      if (!r || r.data.length > 0) return j;
      j = r.link;
    }
    return j;
  };
  // Index of the sprite whose PCX palette applies.
  const paletteSource: number[] = [];
  raws.forEach((r, i) => {
    const prev = paletteSource[i - 1];
    paletteSource[i] = r.usesPrevPalette && prev !== undefined ? prev : dataIndex(i);
  });
  const paletteCache = new Map<number, Uint8Array | undefined>();
  const paletteOf = (i: number): Uint8Array | undefined => {
    if (!paletteCache.has(i)) paletteCache.set(i, pcxPalette(raws[i]?.data ?? Buffer.alloc(0)));
    return paletteCache.get(i);
  };
  const firstPalette = raws.length > 0 ? paletteOf(dataIndex(0)) : undefined;

  const sprites: SffSprite[] = [];
  raws.forEach((r, i) => {
    const d = dataIndex(i);
    const src = raws[d];
    if (!src || src.data.length < 128) return;
    const head = src.data;
    const width = head.readUInt16LE(8) - head.readUInt16LE(4) + 1;
    const height = head.readUInt16LE(10) - head.readUInt16LE(6) + 1;
    sprites.push({
      group: r.group,
      image: r.image,
      width,
      height,
      axisX: r.axisX,
      axisY: r.axisY,
      decode: () => {
        const own = paletteOf(paletteSource[i] ?? d);
        // The selected .act replaces the shared character palette; portraits (group 9000)
        // and sprites with a palette of their own keep it.
        const palette = act && r.group !== 9000 && (own === undefined || samePalette(own, firstPalette)) ? act : (own ?? firstPalette);
        const pcx = decodePcx(src.data, pcxPalette(src.data) !== undefined);
        return toRgba(pcx.pixels, palette, pcx.width, pcx.height);
      },
    });
  });
  return finish(1, sprites);
}

// ---------- SFF v2 ----------

function rle8(d: Uint8Array, size: number): Uint8Array {
  const p = new Uint8Array(size);
  let i = 0;
  let j = 0;
  while (j < size && i < d.length) {
    let n = 1;
    let c = at(d, i++);
    if ((c & 0xc0) === 0x40) {
      n = c & 0x3f;
      c = at(d, i++);
    }
    for (; n > 0 && j < size; n--) p[j++] = c;
  }
  return p;
}

// Port of Ikemen GO's Rle5Decode.
function rle5(d: Uint8Array, size: number): Uint8Array {
  const p = new Uint8Array(size);
  if (d.length === 0) return p;
  let i = 0;
  let j = 0;
  const step = () => {
    if (i < d.length - 1) i++;
  };
  while (j < size) {
    let rl = at(d, i);
    step();
    let dl = at(d, i) & 0x7f;
    let c = 0;
    if (at(d, i) >> 7 !== 0) {
      step();
      c = at(d, i);
    }
    step();
    for (;;) {
      if (j < size) p[j++] = c;
      rl--;
      if (rl < 0) {
        dl--;
        if (dl < 0) break;
        c = at(d, i) & 0x1f;
        rl = at(d, i) >> 5;
        step();
      }
    }
  }
  return p;
}

// Port of Ikemen GO's Lz5Decode.
function lz5(d: Uint8Array, size: number): Uint8Array {
  const p = new Uint8Array(size);
  if (d.length === 0) return p;
  let i = 0;
  let j = 0;
  const step = () => {
    if (i < d.length - 1) i++;
  };
  let ct = at(d, i);
  let cts = 0;
  let rb = 0;
  let rbc = 0;
  step();
  while (j < size) {
    let v = at(d, i);
    step();
    if (ct & (1 << cts)) {
      let n: number;
      if ((v & 0x3f) === 0) {
        v = ((v << 2) | at(d, i)) + 1;
        step();
        n = at(d, i) + 2;
        step();
      } else {
        rb |= (v & 0xc0) >> rbc;
        rbc += 2;
        n = v & 0x3f;
        if (rbc < 8) {
          v = at(d, i) + 1;
          step();
        } else {
          v = rb + 1;
          rb = 0;
          rbc = 0;
        }
      }
      for (;;) {
        if (j < size) {
          p[j] = j - v >= 0 ? at(p, j - v) : 0;
          j++;
        }
        n--;
        if (n < 0) break;
      }
    } else {
      let n: number;
      if ((v & 0xe0) === 0) {
        n = at(d, i) + 8;
        step();
      } else {
        n = v >> 5;
        v &= 0x1f;
      }
      for (; n > 0; n--) if (j < size) p[j++] = v;
    }
    cts++;
    if (cts >= 8) {
      ct = at(d, i);
      cts = 0;
      step();
    }
  }
  return p;
}

function readSffV2(buf: Buffer): Sff {
  const spriteOffset = buf.readUInt32LE(36);
  const spriteCount = buf.readUInt32LE(40);
  const paletteOffset = buf.readUInt32LE(44);
  const paletteCount = buf.readUInt32LE(48);
  const ldata = buf.readUInt32LE(52);
  const tdata = buf.readUInt32LE(60);

  const palettes: Uint8Array[] = [];
  for (let k = 0; k < paletteCount; k++) {
    const o = paletteOffset + k * 16;
    const colors = buf.readUInt16LE(o + 4);
    const link = buf.readUInt16LE(o + 6);
    const off = buf.readUInt32LE(o + 8);
    const len = buf.readUInt32LE(o + 12);
    if (len === 0) {
      palettes.push(palettes[link] ?? new Uint8Array(768));
      continue;
    }
    const pal = new Uint8Array(768);
    for (let c = 0; c < Math.min(colors, 256); c++) {
      const s = ldata + off + c * 4;
      pal[c * 3] = buf.readUInt8(s);
      pal[c * 3 + 1] = buf.readUInt8(s + 1);
      pal[c * 3 + 2] = buf.readUInt8(s + 2);
    }
    palettes.push(pal);
  }

  interface Node {
    group: number;
    image: number;
    width: number;
    height: number;
    axisX: number;
    axisY: number;
    link: number;
    format: number;
    data: Buffer;
    palette: number;
  }
  const nodes: Node[] = [];
  for (let k = 0; k < spriteCount; k++) {
    const o = spriteOffset + k * 28;
    const flags = buf.readUInt16LE(o + 26);
    const base = flags & 1 ? tdata : ldata;
    const off = buf.readUInt32LE(o + 16);
    const len = buf.readUInt32LE(o + 20);
    nodes.push({
      group: buf.readUInt16LE(o),
      image: buf.readUInt16LE(o + 2),
      width: buf.readUInt16LE(o + 4),
      height: buf.readUInt16LE(o + 6),
      axisX: buf.readInt16LE(o + 8),
      axisY: buf.readInt16LE(o + 10),
      link: buf.readUInt16LE(o + 12),
      format: buf.readUInt8(o + 14),
      data: buf.subarray(base + off, base + off + len),
      palette: buf.readUInt16LE(o + 24),
    });
  }
  const dataNode = (k: number): Node | undefined => {
    let j = k;
    for (let guard = 0; guard < 64; guard++) {
      const n = nodes[j];
      if (!n || n.data.length > 0) return n;
      j = n.link;
    }
    return nodes[j];
  };

  const sprites: SffSprite[] = [];
  nodes.forEach((n, k) => {
    const src = dataNode(k);
    if (!src) return;
    sprites.push({
      group: n.group,
      image: n.image,
      width: src.width,
      height: src.height,
      axisX: n.axisX,
      axisY: n.axisY,
      decode: () => {
        const size = src.width * src.height;
        const palette = palettes[src.palette] ?? palettes[0];
        const body = src.data.subarray(4); // every compressed format starts with a 4-byte length
        switch (src.format) {
          case 0:
            return toRgba(src.data, palette, src.width, src.height);
          case 2:
            return toRgba(rle8(body, size), palette, src.width, src.height);
          case 3:
            return toRgba(rle5(body, size), palette, src.width, src.height);
          case 4:
            return toRgba(lz5(body, size), palette, src.width, src.height);
          case 10:
          case 11:
          case 12: {
            const png = decodePng(body);
            if (png.indices) return toRgba(png.indices, palette ?? png.palette, png.width, png.height);
            return png.rgba ?? new Uint8Array(size * 4);
          }
          default:
            throw new Error(`unsupported SFF v2 sprite format ${src.format}`);
        }
      },
    });
  });
  return finish(2, sprites);
}
