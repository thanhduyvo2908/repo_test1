// Finds individual frames on a sprite sheet: background removal, connected components,
// merging of nearby pieces, and reading-order numbering.

export interface Image {
  width: number;
  height: number;
  rgba: Uint8Array;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Opaque pixel count. */
  pixels: number;
}

export interface SliceOptions {
  /** Pieces whose bounding boxes are at most this many pixels apart become one frame. */
  gap: number;
  /** Pieces with fewer opaque pixels are dropped (dust, stray pixels). */
  minPixels: number;
}

const px = (img: Image, i: number): number =>
  ((img.rgba[i * 4] ?? 0) << 16) | ((img.rgba[i * 4 + 1] ?? 0) << 8) | (img.rgba[i * 4 + 2] ?? 0);

/** Background = most common colour among the four corners, unless the image is transparent there. */
export function findBackground(img: Image): number | undefined {
  const corners = [0, img.width - 1, (img.height - 1) * img.width, img.height * img.width - 1];
  if (corners.every((i) => (img.rgba[i * 4 + 3] ?? 0) === 0)) return undefined;
  const counts = new Map<number, number>();
  for (const i of corners) counts.set(px(img, i), (counts.get(px(img, i)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Makes background pixels transparent, in place. */
export function removeBackground(img: Image, bg: number | undefined): void {
  if (bg === undefined) return;
  for (let i = 0; i < img.width * img.height; i++) if (px(img, i) === bg) img.rgba[i * 4 + 3] = 0;
}

function components(img: Image, minPixels: number): Box[] {
  const { width, height } = img;
  const seen = new Uint8Array(width * height);
  const boxes: Box[] = [];
  const stack: number[] = [];
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || (img.rgba[start * 4 + 3] ?? 0) === 0) continue;
    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;
    let count = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop() ?? 0;
      const x = p % width;
      const y = (p - x) / width;
      count++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (seen[q] || (img.rgba[q * 4 + 3] ?? 0) === 0) continue;
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (count >= minPixels) boxes.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, pixels: count });
  }
  return boxes;
}

function gapBetween(a: Box, b: Box): number {
  const gx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const gy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.max(gx, gy);
}

function mergeClose(boxes: Box[], gap: number): Box[] {
  const list = [...boxes];
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a || !b || gapBetween(a, b) > gap) continue;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        list[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y, pixels: a.pixels + b.pixels };
        list.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return list;
}

/** Sorts boxes into rows (by vertical overlap), then left to right. */
function readingOrder(boxes: Box[]): Box[] {
  const sorted = [...boxes].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows: Box[][] = [];
  for (const box of sorted) {
    const mid = box.y + box.h / 2;
    const row = rows.find((r) => r.some((o) => mid >= o.y && mid <= o.y + o.h));
    if (row) row.push(box);
    else rows.push([box]);
  }
  rows.sort((a, b) => Math.min(...a.map((o) => o.y)) - Math.min(...b.map((o) => o.y)));
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x));
}

export function sliceSheet(img: Image, opts: SliceOptions): Box[] {
  return readingOrder(mergeClose(components(img, opts.minPixels), opts.gap));
}

export function crop(img: Image, box: Box): Uint8Array {
  const out = new Uint8Array(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const src = ((box.y + y) * img.width + box.x) * 4;
    out.set(img.rgba.subarray(src, src + box.w * 4), y * box.w * 4);
  }
  return out;
}
