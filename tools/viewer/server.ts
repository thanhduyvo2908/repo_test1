// Dev-server handler for the character viewer (tools/viewer/index.html). It reads MUGEN
// characters and GBA sheets straight from assets-raw/, packs every animation into atlas pages
// and caches them under tools/out/viewer/ (git-ignored).
//
// Routes, under /__viewer/:
//   list.json[?refresh=1]          every source, game sources first
//   char.json?key=<source>         frames, animations, moves and physics of one source
//   atlas.png?key=<source>&p=<n>   atlas page n
//   thumb.png?key=<source>         small picture for the select screen
//   game/<id>/sprite.json|atlas.png  the exported game sprite (packs/<pack>/assets/<id>/)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { parseAir } from '../mugen/air';
import { findCharacterDefs, loadCharacter, readText, resolveCharFile } from '../mugen/character';
import { findSection, getValue, parseIni, unquote } from '../mugen/ini';
import type { IniSection } from '../mugen/ini';
import { encodePngRgba } from '../mugen/png';
import { readAct, readSff } from '../mugen/sff';
import { loadImage } from '../sheet/image';
import { crop, findBackground, removeBackground, sliceSheet } from '../sheet/slice';
import type { Box, Image } from '../sheet/slice';
import { EXPORTS } from '../sprite-export-config';
import { extractMoves } from './moves';
import { DEFAULT_PHYSICS } from './types';
import type { ViewerAnim, ViewerAnimFrame, ViewerChar, ViewerFrame, ViewerList, ViewerListItem, ViewerPhysics } from './types';

/** Bump when the shape of char.json or the atlas packing changes, to drop old caches. */
const CACHE_VERSION = 1;
const PAGE_WIDTH = 2048;
const PAGE_HEIGHT = 4096;
const SHEET_EXT = new Set(['.gif', '.png']);

interface Paths {
  root: string;
  raw: string;
  cache: string;
}

// ---------- Listing ----------

function gameIdsBySource(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of EXPORTS) {
    const src = 'mugen' in e ? e.mugen : e.sheet;
    map.set(src, [...(map.get(src) ?? []), e.id]);
  }
  return map;
}

/** Game sprite id -> pack folder, for every exported atlas. */
function exportedSprites(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const packs = join(root, 'packs');
  if (!existsSync(packs)) return out;
  for (const pack of readdirSync(packs)) {
    const assets = join(packs, pack, 'assets');
    if (!existsSync(assets) || !statSync(assets).isDirectory()) continue;
    for (const id of readdirSync(assets)) {
      if (existsSync(join(assets, id, 'sprite.json')) && existsSync(join(assets, id, 'atlas.png'))) out[id] ??= pack;
    }
  }
  return out;
}

function defInfo(defPath: string): { name: string; author: string } {
  const info = findSection(parseIni(readText(defPath)), 'Info');
  const v = (k: string) => (info ? unquote(getValue(info, k)) : undefined);
  return { name: v('displayname') || v('name') || basename(defPath, '.def'), author: v('author') ?? '' };
}

const toKey = (raw: string, path: string): string => relative(raw, path).split(sep).join('/');

function listSources(p: Paths): ViewerList {
  const ids = gameIdsBySource();
  const items: ViewerListItem[] = [];
  if (existsSync(p.raw)) {
    for (const def of findCharacterDefs(p.raw, 5)) {
      const key = toKey(p.raw, def);
      try {
        items.push({ key, kind: 'mugen', ...defInfo(def), gameIds: ids.get(key) ?? [] });
      } catch {
        // Unreadable .def: leave it out of the list.
      }
    }
    for (const folder of readdirSync(p.raw)) {
      const dir = join(p.raw, folder);
      if (!statSync(dir).isDirectory()) continue;
      for (const file of readdirSync(dir)) {
        if (!SHEET_EXT.has(extname(file).toLowerCase()) || !statSync(join(dir, file)).isFile()) continue;
        const key = `${folder}/${file}`;
        items.push({ key, kind: 'sheet', name: `${folder.replace(/-gba$/, '')} · ${file}`, author: '', gameIds: ids.get(key) ?? [] });
      }
    }
  }
  const order = new Map(EXPORTS.map((e, i) => ['mugen' in e ? e.mugen : e.sheet, i] as const));
  items.sort((a, b) => {
    const oa = order.get(a.key) ?? Infinity;
    const ob = order.get(b.key) ?? Infinity;
    if (oa !== ob) return oa - ob;
    if (a.kind !== b.kind) return a.kind === 'mugen' ? -1 : 1;
    return a.name.localeCompare(b.name) || a.key.localeCompare(b.key);
  });
  return { items, exported: exportedSprites(p.root) };
}

// ---------- Source files and cache ----------

/** Resolves a key to a file inside assets-raw/, refusing anything outside it. */
function sourcePath(p: Paths, key: string): string {
  const full = resolve(p.raw, key);
  if (!full.startsWith(p.raw + sep) || !existsSync(full) || !statSync(full).isFile()) throw new HttpError(404, `unknown source: ${key}`);
  const ext = extname(full).toLowerCase();
  if (ext !== '.def' && !SHEET_EXT.has(ext)) throw new HttpError(400, `not a .def or sheet: ${key}`);
  return full;
}

/** Changes whenever a source file (or the sheet's slot config) changes. */
function stampOf(p: Paths, full: string): string {
  const files: string[] = [];
  if (extname(full).toLowerCase() === '.def') {
    for (const n of readdirSync(dirname(full))) files.push(join(dirname(full), n));
  } else {
    files.push(full);
    files.push(join(p.root, 'tools', 'sheets', `${basename(dirname(full))}.json`));
  }
  const h = createHash('sha1').update(String(CACHE_VERSION));
  for (const f of files) {
    if (!existsSync(f)) continue;
    const st = statSync(f);
    if (st.isFile()) h.update(`${f}:${st.size}:${st.mtimeMs};`);
  }
  return h.digest('hex').slice(0, 16);
}

const cacheDir = (p: Paths, key: string): string => join(p.cache, createHash('sha1').update(key).digest('hex').slice(0, 16));

interface Built {
  stamp: string;
  data: ViewerChar;
  pages: Buffer[];
}

const memory = new Map<string, Built>();

function getChar(p: Paths, key: string): Built {
  const full = sourcePath(p, key);
  const stamp = stampOf(p, full);
  const hit = memory.get(key);
  if (hit?.stamp === stamp) return hit;
  const dir = cacheDir(p, key);
  const metaPath = join(dir, 'meta.json');
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { stamp: string };
      if (meta.stamp === stamp) {
        const data = JSON.parse(readFileSync(join(dir, 'char.json'), 'utf8')) as ViewerChar;
        const pages = Array.from({ length: data.pages }, (_, i) => readFileSync(join(dir, `atlas-${i}.png`)));
        return remember(key, { stamp, data, pages });
      }
    } catch {
      // Broken cache: rebuild below.
    }
  }
  const built = extname(full).toLowerCase() === '.def' ? buildMugen(p, key, full) : buildSheet(p, key, full);
  const result = { stamp, ...built };
  mkdirSync(dir, { recursive: true });
  result.pages.forEach((png, i) => writeFileSync(join(dir, `atlas-${i}.png`), png));
  writeFileSync(join(dir, 'char.json'), JSON.stringify(result.data));
  writeFileSync(metaPath, JSON.stringify({ stamp, key }));
  return remember(key, result);
}

function remember(key: string, built: Built): Built {
  memory.delete(key);
  memory.set(key, built);
  while (memory.size > 6) memory.delete(memory.keys().next().value!);
  return built;
}

// ---------- Atlas packing ----------

interface Sprite {
  w: number;
  h: number;
  ax: number;
  ay: number;
  src: string;
  rgba: Uint8Array;
}

/** Shelf packing, tallest first, into pages of at most PAGE_WIDTH x PAGE_HEIGHT. */
function packPages(sprites: Sprite[]): { frames: ViewerFrame[]; pages: Buffer[] } {
  const order = sprites.map((_, i) => i).sort((a, b) => sprites[b]!.h - sprites[a]!.h);
  const frames: ViewerFrame[] = new Array(sprites.length);
  const pages: { width: number; height: number; items: number[] }[] = [];
  let page = { width: 1, height: 1, items: [] as number[] };
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const i of order) {
    const s = sprites[i]!;
    const w = Math.min(s.w, PAGE_WIDTH);
    if (x + w > PAGE_WIDTH && x > 0) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    if (y + s.h > PAGE_HEIGHT && page.items.length) {
      pages.push(page);
      page = { width: 1, height: 1, items: [] };
      x = 0;
      y = 0;
      shelf = 0;
    }
    frames[i] = { p: pages.length, x, y, w, h: s.h, ax: s.ax, ay: s.ay, src: s.src };
    page.items.push(i);
    x += w + 1;
    shelf = Math.max(shelf, s.h);
    page.width = Math.max(page.width, x);
    page.height = Math.max(page.height, y + s.h);
  }
  if (page.items.length || !pages.length) pages.push(page);
  const pngs = pages.map((pg) => {
    const rgba = new Uint8Array(pg.width * pg.height * 4);
    for (const i of pg.items) {
      const s = sprites[i]!;
      const f = frames[i]!;
      for (let row = 0; row < s.h; row++) {
        rgba.set(s.rgba.subarray(row * s.w * 4, row * s.w * 4 + f.w * 4), ((f.y + row) * pg.width + f.x) * 4);
      }
    }
    return encodePngRgba(pg.width, pg.height, rgba);
  });
  return { frames, pages: pngs };
}

// ---------- MUGEN ----------

const num = (v: string | undefined, fallback: number): number => {
  const n = Number.parseFloat(v ?? '');
  return Number.isFinite(n) ? n : fallback;
};
const pair = (v: string | undefined, fallback: [number, number]): [number, number] => {
  const parts = (v ?? '').split(',');
  return [num(parts[0], fallback[0]), num(parts[1], fallback[1])];
};

function readPhysics(cns: IniSection[]): ViewerPhysics {
  const vel = findSection(cns, 'Velocity');
  const mov = findSection(cns, 'Movement');
  const v = (k: string) => (vel ? getValue(vel, k) : undefined);
  const d = DEFAULT_PHYSICS;
  const walkFwd = num(v('walk.fwd'), d.walkFwd);
  const runFwd = num(v('run.fwd'), d.runFwd);
  const runBack = pair(v('run.back'), d.runBack);
  const jumpNeu = pair(v('jump.neu'), d.jumpNeu);
  return {
    walkFwd,
    walkBack: num(v('walk.back'), d.walkBack),
    // Characters that run in their own state often leave run.fwd at 0.
    runFwd: runFwd > 0 ? runFwd : Math.max(walkFwd * 2, d.runFwd),
    runBack: runBack[0] < 0 ? runBack : d.runBack,
    jumpNeu: jumpNeu[1] < 0 ? jumpNeu : d.jumpNeu,
    jumpFwd: num(v('jump.fwd'), d.jumpFwd),
    jumpBack: num(v('jump.back'), d.jumpBack),
    yAccel: num(mov ? getValue(mov, 'yaccel') : undefined, d.yAccel) || d.yAccel,
  };
}

function buildMugen(p: Paths, key: string, defPath: string): Omit<Built, 'stamp'> {
  const c = loadCharacter(defPath);
  const defDir = dirname(defPath);
  const def = parseIni(readText(defPath));
  const files = findSection(def, 'Files');
  const info = findSection(def, 'Info');
  const file = (k: string) => (files ? resolveCharFile(defDir, getValue(files, k)) : undefined);
  const cnsPath = file('cns');
  const cns = cnsPath ? parseIni(readText(cnsPath)) : [];
  const size = findSection(cns, 'Size');
  const localW = pair(info ? getValue(info, 'localcoord') : undefined, [320, 240])[0] || 320;
  const coordScale = 320 / localW;
  const xs = num(size ? getValue(size, 'xscale') : undefined, 1) || 1;
  const ys = num(size ? getValue(size, 'yscale') : undefined, 1) || 1;

  const sprites: Sprite[] = [];
  const index = new Map<string, number>();
  const sprite = (g: number, i: number): number => {
    const k = `${g},${i}`;
    const known = index.get(k);
    if (known !== undefined) return known;
    const s = c.sff.get(g, i);
    if (!s || s.width <= 0 || s.height <= 0) {
      index.set(k, -1);
      return -1;
    }
    let rgba: Uint8Array;
    try {
      rgba = s.decode();
    } catch {
      index.set(k, -1);
      return -1;
    }
    sprites.push({ w: s.width, h: s.height, ax: s.axisX, ay: s.axisY, src: k, rgba });
    index.set(k, sprites.length - 1);
    return sprites.length - 1;
  };
  const anims: Record<string, ViewerAnim> = {};
  for (const [id, action] of [...c.air].sort((a, b) => a[0] - b[0])) {
    const frames: ViewerAnimFrame[] = action.frames.map((fr) => ({
      f: sprite(fr.group, fr.image),
      dx: fr.x,
      dy: fr.y,
      ticks: fr.time,
      flipH: fr.flipH,
      ...(fr.flipV ? { flipV: true } : {}),
    }));
    if (frames.length) anims[String(id)] = { frames, loopStart: action.loopStart };
  }
  const cmdPath = file('cmd');
  const animExists = (id: number) => anims[String(id)] !== undefined;
  const { moves, commands } = extractMoves(cmdPath ? readText(cmdPath) : '', c.states, animExists);
  const { frames, pages } = packPages(sprites);
  const notes = [`SFF v${c.sff.version}`, `${c.air.size} actions`, `${sprites.length} sprites`];
  if (c.missingStateFiles.length) notes.push(`missing: ${c.missingStateFiles.join(', ')}`);
  if (localW !== 320) notes.push(`localcoord ${localW}`);
  const entry = EXPORTS.find((e) => 'mugen' in e && e.mugen === key);
  return {
    data: {
      key,
      name: c.name,
      author: c.author,
      kind: 'mugen',
      pages: pages.length,
      frames,
      anims,
      moves,
      commands,
      physics: readPhysics(cns),
      spriteScale: [xs * coordScale, ys * coordScale],
      coordScale,
      facing: entry?.facing ?? 'right',
      gameIds: gameIdsBySource().get(key) ?? [],
      notes,
    },
    pages,
  };
}

// ---------- GBA sheets ----------

interface SheetSlot {
  frames: number[];
  ticks?: number;
  offsets?: [number, number][];
}

interface SheetConfig {
  gap?: number;
  minPixels?: number;
  slots?: Record<string, SheetSlot>;
}

function sheetConfig(p: Paths, full: string): SheetConfig {
  const path = join(p.root, 'tools', 'sheets', `${basename(dirname(full))}.json`);
  if (!existsSync(path)) return {};
  const all = JSON.parse(readFileSync(path, 'utf8')) as { sheets?: Record<string, SheetConfig> };
  return all.sheets?.[basename(full)] ?? {};
}

function sliceFile(p: Paths, full: string): { img: Image; boxes: Box[]; config: SheetConfig } {
  const config = sheetConfig(p, full);
  const img = loadImage(full);
  removeBackground(img, findBackground(img));
  return { img, boxes: sliceSheet(img, { gap: config.gap ?? 3, minPixels: config.minPixels ?? 4 }), config };
}

function buildSheet(p: Paths, key: string, full: string): Omit<Built, 'stamp'> {
  const { img, boxes, config } = sliceFile(p, full);
  const sprites: Sprite[] = boxes.map((b, n) => ({ w: b.w, h: b.h, ax: Math.floor(b.w / 2), ay: b.h, src: `#${n}`, rgba: crop(img, b) }));
  const anims: Record<string, ViewerAnim> = {};
  for (const [slot, def] of Object.entries(config.slots ?? {})) {
    if (slot === 'portrait') continue;
    const frames = def.frames
      .filter((n) => n >= 0 && n < boxes.length)
      .map((n, k) => ({ f: n, dx: def.offsets?.[k]?.[0] ?? 0, dy: def.offsets?.[k]?.[1] ?? 0, ticks: def.ticks ?? 6, flipH: false }));
    if (frames.length) anims[slot] = { frames, loopStart: 0 };
  }
  const { frames, pages } = packPages(sprites);
  const entry = EXPORTS.find((e) => 'sheet' in e && e.sheet === key);
  return {
    data: {
      key,
      name: basename(full),
      author: '',
      kind: 'sheet',
      pages: pages.length,
      frames,
      anims,
      moves: [],
      commands: {},
      physics: DEFAULT_PHYSICS,
      spriteScale: [1, 1],
      coordScale: 1,
      facing: entry?.facing ?? 'right',
      gameIds: gameIdsBySource().get(key) ?? [],
      notes: [`${boxes.length} frames`, Object.keys(anims).length ? `slots: ${Object.keys(anims).join(', ')}` : 'no slots in tools/sheets yet'],
    },
    pages,
  };
}

// ---------- Thumbnails ----------

function thumbnail(p: Paths, key: string): Buffer | null {
  const full = sourcePath(p, key);
  const path = join(p.cache, 'thumbs', `${createHash('sha1').update(key).digest('hex').slice(0, 16)}-${stampOf(p, full)}.png`);
  if (existsSync(path)) return readFileSync(path);
  const png = extname(full).toLowerCase() === '.def' ? mugenThumb(full) : sheetThumb(p, full);
  if (!png) return null;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
  return png;
}

function mugenThumb(defPath: string): Buffer | null {
  const defDir = dirname(defPath);
  const files = findSection(parseIni(readText(defPath)), 'Files');
  if (!files) return null;
  const file = (k: string) => resolveCharFile(defDir, getValue(files, k));
  const sffPath = file('sprite');
  if (!sffPath) return null;
  const actPath = file('pal1');
  const sff = readSff(readFileSync(sffPath), actPath ? readAct(readFileSync(actPath)) : undefined);
  const small = sff.get(9000, 0);
  let pick = small && small.width <= 200 && small.height <= 200 ? small : undefined;
  if (!pick) {
    const airPath = file('anim');
    const first = airPath ? parseAir(readText(airPath)).get(0)?.frames[0] : undefined;
    pick = (first ? sff.get(first.group, first.image) : undefined) ?? sff.get(0, 0);
  }
  if (!pick) return null;
  return encodePngRgba(pick.width, pick.height, pick.decode());
}

function sheetThumb(p: Paths, full: string): Buffer | null {
  const { img, boxes, config } = sliceFile(p, full);
  const n = config.slots?.['portrait']?.frames[0] ?? config.slots?.['idle']?.frames[0] ?? boxes.findIndex((b) => b.h >= 24);
  const b = boxes[n];
  return b ? encodePngRgba(b.w, b.h, crop(img, b)) : null;
}

// ---------- HTTP ----------

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function send(res: ServerResponse, status: number, type: string, body: string | Buffer, cache = false): void {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache ? 'max-age=3600' : 'no-store');
  res.end(body);
}

let listCache: ViewerList | null = null;

function handle(p: Paths, req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://viewer');
  const key = url.searchParams.get('key') ?? '';
  const route = url.pathname.replace(/^\/+/, '');
  if (route === 'list.json') {
    if (!listCache || url.searchParams.has('refresh')) listCache = listSources(p);
    return send(res, 200, 'application/json', JSON.stringify(listCache));
  }
  if (route === 'char.json') return send(res, 200, 'application/json', JSON.stringify(getChar(p, key).data));
  if (route === 'atlas.png') {
    const built = getChar(p, key);
    const png = built.pages[Number(url.searchParams.get('p') ?? 0)];
    if (!png) throw new HttpError(404, 'no such page');
    return send(res, 200, 'image/png', png, true);
  }
  if (route === 'thumb.png') {
    const png = thumbnail(p, key);
    if (!png) throw new HttpError(404, 'no thumbnail');
    return send(res, 200, 'image/png', png, true);
  }
  const game = /^game\/([a-z0-9-]+)\/(sprite\.json|atlas\.png)$/.exec(route);
  if (game) {
    const pack = exportedSprites(p.root)[game[1]!];
    if (!pack) throw new HttpError(404, 'not exported');
    const body = readFileSync(join(p.root, 'packs', pack, 'assets', game[1]!, game[2]!));
    return send(res, 200, game[2] === 'atlas.png' ? 'image/png' : 'application/json', body);
  }
  throw new HttpError(404, `unknown route: ${route}`);
}

/**
 * Answers one /__viewer/ request (`req.url` without the prefix). vite.config.ts loads this
 * module on demand during `npm run dev`; it is not part of the game build.
 */
export function handleViewer(root: string, req: IncomingMessage, res: ServerResponse, logError: (msg: string) => void): void {
  const base = resolve(root);
  const paths: Paths = { root: base, raw: join(base, 'assets-raw'), cache: join(base, 'tools', 'out', 'viewer') };
  try {
    handle(paths, req, res);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) logError(`[viewer] ${(e as Error).stack ?? e}`);
    send(res, status, 'application/json', JSON.stringify({ error: (e as Error).message }));
  }
}
