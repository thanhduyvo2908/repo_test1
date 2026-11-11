// Slices GBA sprite sheet rips into numbered frames and builds an HTML preview, so frames
// can be grouped into animations (idle, attack, S1..S3, hit, KO, portrait).
//
// Usage:
//   npm run sheet:preview -- <id>                reads every .gif/.png in assets-raw/<id>/
//   npm run sheet:preview -- <folder|file> [--gap <px>] [--min <pixels>] [--scale <n>]
//
// Animations are declared in tools/sheets/<id>.json (committed, contains no images):
//   { "sheets": { "DonKrieg.gif": { "gap": 3, "slots": { "idle": { "frames": [0, 1, 2], "ticks": 8 } } } } }
// A slot may add "offsets": [[dx, dy], ...] per frame. Frames are aligned bottom-centre.
//
// Output: tools/out/sheets/<id>/<sheet>/index.html, sheet.png, frames/<n>.png, frames.json.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeGif } from './mugen/gif';
import { decodePng, encodePngRgba } from './mugen/png';
import { crop, findBackground, removeBackground, sliceSheet } from './sheet/slice';
import type { Box, Image } from './sheet/slice';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface SlotDef {
  frames: number[];
  ticks?: number;
  offsets?: [number, number][];
}

interface SheetConfig {
  gap?: number;
  minPixels?: number;
  slots?: Record<string, SlotDef>;
}

interface Options {
  target: string;
  gap?: number;
  minPixels?: number;
  scale: number;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { target: '', scale: 2 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--gap') opts.gap = Number(argv[++i]);
    else if (a === '--min') opts.minPixels = Number(argv[++i]);
    else if (a === '--scale') opts.scale = Number(argv[++i] ?? 2) || 2;
    else if (!opts.target) opts.target = a;
  }
  if (!opts.target) {
    console.error('Usage: npm run sheet:preview -- <id | folder | file> [--gap <px>] [--min <pixels>] [--scale <n>]');
    process.exit(1);
  }
  return opts;
}

function loadImage(path: string): Image {
  const bytes = new Uint8Array(readFileSync(path));
  const ext = extname(path).toLowerCase();
  if (ext === '.gif') return decodeGif(bytes);
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

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

function buildSheet(file: string, outDir: string, config: SheetConfig, opts: Options): void {
  const gap = opts.gap ?? config.gap ?? 3;
  const minPixels = opts.minPixels ?? config.minPixels ?? 4;
  const img = loadImage(file);
  mkdirSync(join(outDir, 'frames'), { recursive: true });
  writeFileSync(join(outDir, 'sheet.png'), encodePngRgba(img.width, img.height, img.rgba));
  const bg = findBackground(img);
  removeBackground(img, bg);
  const boxes = sliceSheet(img, { gap, minPixels });
  boxes.forEach((b, n) => writeFileSync(join(outDir, 'frames', `${n}.png`), encodePngRgba(b.w, b.h, crop(img, b))));
  writeFileSync(join(outDir, 'frames.json'), JSON.stringify({ sheet: basename(file), gap, minPixels, background: bg ?? null, frames: boxes }, null, 2));

  const slots = config.slots ?? {};
  const badRefs = Object.entries(slots).flatMap(([name, s]) => s.frames.filter((f) => !boxes[f]).map((f) => `${name}: ${f}`));
  const bgHex = bg === undefined ? 'trong suốt' : `#${bg.toString(16).padStart(6, '0')}`;
  const thumbScale = img.width > 900 ? 900 / img.width : 1;
  const frameCard = (b: Box, n: number) =>
    `<figure class="f" id="f${n}"><img src="frames/${n}.png" style="width:${b.w * opts.scale}px"><figcaption>#${n} · ${b.w}×${b.h}</figcaption></figure>`;

  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(basename(file))} · sheet preview</title>
<style>
:root{color-scheme:light dark;--bg:#f6f6f4;--fg:#1d1d1b;--card:#fff;--line:#ddd;--muted:#666;--stage:#cfd8dc}
@media (prefers-color-scheme:dark){:root{--bg:#18191b;--fg:#e8e8e6;--card:#232427;--line:#3a3b3f;--muted:#9a9a9a;--stage:#37474f}}
body{margin:0;padding:16px;font:14px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
h2{margin:28px 0 8px;border-bottom:1px solid var(--line)}.meta{color:var(--muted)}
.grid{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}
.f{margin:0;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:4px;text-align:center;font-size:11px}
.f img,.sheet img,canvas{image-rendering:pixelated;background:var(--stage)}
.sheet{position:relative;display:inline-block;max-width:100%;overflow:auto}
.sheet a{position:absolute;border:1px solid #e53935;color:#e53935;font:10px/1 monospace;text-decoration:none}
.slot{display:inline-block;margin:6px;text-align:center;font-size:12px}
.bad{color:#c62828}
</style></head><body>
<h1>${esc(basename(file))}</h1>
<p class="meta">${img.width}×${img.height} · nền ${bgHex} · ${boxes.length} khung · gap ${gap}px · tối thiểu ${minPixels} điểm ảnh. Khung bị dính nhau thì chạy lại với <code>--gap</code> nhỏ hơn; khung bị vỡ thành nhiều mảnh thì tăng <code>--gap</code>.</p>
${badRefs.length ? `<p class="bad">Slot trỏ tới khung không tồn tại: ${esc(badRefs.join(', '))}</p>` : ''}
<h2>Hoạt ảnh đã khai báo</h2>
${Object.keys(slots).length ? Object.entries(slots).map(([name, s]) => `<div class="slot"><canvas data-slot="${esc(name)}"></canvas><br><b>${esc(name)}</b> · khung ${s.frames.join(', ')}</div>`).join('') : '<p class="meta">Chưa có. Khai báo trong <code>tools/sheets/&lt;id&gt;.json</code>.</p>'}
<h2>Sheet gốc, có đánh số khung</h2>
<div class="sheet" style="width:${Math.round(img.width * thumbScale)}px"><img src="sheet.png" style="width:${Math.round(img.width * thumbScale)}px">${boxes
    .map((b, n) => `<a href="#f${n}" style="left:${b.x * thumbScale}px;top:${b.y * thumbScale}px;width:${b.w * thumbScale}px;height:${b.h * thumbScale}px">${n}</a>`)
    .join('')}</div>
<h2>Từng khung</h2>
<div class="grid">${boxes.map(frameCard).join('')}</div>
<script>
const FRAMES=${JSON.stringify(boxes.map((b) => [b.w, b.h]))};
const SLOTS=${JSON.stringify(slots)};
const SCALE=${opts.scale};
const imgs=FRAMES.map((_,n)=>{const i=new Image();i.src='frames/'+n+'.png';return i;});
const players=[...document.querySelectorAll('canvas[data-slot]')].map(c=>{
 const s=SLOTS[c.dataset.slot];const fr=s.frames.filter(n=>FRAMES[n]);const off=s.offsets||[];
 let minX=0,maxX=0,minY=0;fr.forEach((n,k)=>{const [w,h]=FRAMES[n];const [dx,dy]=off[k]||[0,0];minX=Math.min(minX,dx-Math.floor(w/2));maxX=Math.max(maxX,dx-Math.floor(w/2)+w);minY=Math.min(minY,dy-h);});
 const pad=4;c.width=(maxX-minX+pad*2)*SCALE;c.height=(-minY+pad*2)*SCALE;
 return {c,fr,off,ticks:s.ticks||6,ox:-minX+pad,oy:-minY+pad,k:0,t:0};});
setInterval(()=>{for(const p of players){if(!p.fr.length)continue;const ctx=p.c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,p.c.width,p.c.height);
 const n=p.fr[p.k];const [w,h]=FRAMES[n];const [dx,dy]=p.off[p.k]||[0,0];const im=imgs[n];
 if(im.complete)ctx.drawImage(im,(p.ox+dx-Math.floor(w/2))*SCALE,(p.oy+dy-h)*SCALE,w*SCALE,h*SCALE);
 if(++p.t>=p.ticks){p.t=0;p.k=(p.k+1)%p.fr.length;}}},1000/60);
</script>
</body></html>`;
  writeFileSync(join(outDir, 'index.html'), html);
  console.log(`${basename(file)}: ${boxes.length} frames (background ${bgHex}) -> ${join(outDir, 'index.html')}`);
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  let target = resolve(opts.target);
  let id = basename(target, extname(target));
  if (!existsSync(target)) {
    target = join(ROOT, 'assets-raw', opts.target);
    id = opts.target;
  }
  if (!existsSync(target)) {
    console.error(`Not found: ${opts.target} (also tried assets-raw/${opts.target})`);
    process.exit(1);
  }
  const files = statSync(target).isDirectory()
    ? readdirSync(target).filter((n) => /\.(gif|png)$/i.test(n)).map((n) => join(target, n))
    : [target];
  if (files.length === 0) {
    console.error(`No .gif or .png sheet in ${target}`);
    process.exit(1);
  }
  const configPath = join(ROOT, 'tools', 'sheets', `${id}.json`);
  const config: { sheets?: Record<string, SheetConfig> } = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {};
  for (const file of files) {
    const name = basename(file);
    try {
      buildSheet(file, join(ROOT, 'tools', 'out', 'sheets', id, name.replace(/\./g, '_')), config.sheets?.[name] ?? {}, opts);
    } catch (e) {
      console.error(`${file}: ${(e as Error).stack ?? e}`);
      process.exitCode = 1;
    }
  }
}

main();
