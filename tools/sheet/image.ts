// Loads a GIF or PNG sprite sheet as RGBA.
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { decodeGif } from '../mugen/gif';
import { decodePng } from '../mugen/png';
import type { Image } from './slice';

export function loadImage(path: string): Image {
  const bytes = new Uint8Array(readFileSync(path));
  if (extname(path).toLowerCase() === '.gif') return decodeGif(bytes);
  const png = decodePng(bytes);
  if (png.rgba) return { width: png.width, height: png.height, rgba: png.rgba };
  const rgba = new Uint8Array(png.width * png.height * 4);
  const pal = png.palette;
  (png.indices ?? new Uint8Array(0)).forEach((idx, i) => {
    rgba[i * 4] = pal?.[idx * 3] ?? 0;
    rgba[i * 4 + 1] = pal?.[idx * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = pal?.[idx * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = 255;
  });
  return { width: png.width, height: png.height, rgba };
}
