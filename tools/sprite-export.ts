// Exports game sprites: for each entry in tools/sprite-export-config.ts, packs the frames of
// the animation slots (idle, basic, s1..s3, hit, ko) and the portrait into one atlas.
//
// Output, per pack id: packs/onepiece/assets/<id>/atlas.png and sprite.json, plus
// packs/onepiece/assets/index.json listing every exported id. The folder is git-ignored.
//
// sprite.json, version 1 (sizes in source pixels; 60 ticks = 1 second):
//   {
//     version: 1, id, source,
//     facing: "right" | "left",   // direction the source art faces; flip for the other side
//     height: number,             // body height of the first idle frame
//     scale: number,              // size relative to a 52 px reference body (0.8 to 1.6), so a
//                                 // renderer that normalises heights keeps relative sizes
//     frames: [{ x, y, w, h, ax, ay }],   // atlas rect + anchor at the feet
//     anims: { <slot>: { frames: [{ f, dx, dy, ticks, flipH }], loopStart, hitTick? } },
//     portrait: f | null
//   }
// `ticks` -1 holds the frame. `hitTick` (attack slots only) is the tick, from the start of the
// animation, at which the hit lands. Slots missing from the source are left out.
//
// Usage: npm run sprite:export [-- <id> ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCharacter } from './mugen/character';
import type { MugenCharacter } from './mugen/character';
import { encodePngRgba } from './mugen/png';
import { EXPORTS, SLOTS } from './sprite-export-config';
import type { ActionPick, ExportEntry, Slot } from './sprite-export-config';
import { loadImage } from './sheet/image';
import { forwardReachTick, hitDefTick, middleTick, tickOfFrame } from './sprite-hit';
import { crop, findBackground, removeBackground, sliceSheet } from './sheet/slice';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'assets-raw');
const OUT = join(ROOT, 'packs', 'onepiece', 'assets');
const FORMAT_VERSION = 1;
const ATTACK_SLOTS: Slot[] = ['basic', 's1', 's2', 's3'];

interface FrameImage {
  w: number;
  h: number;
  ax: number;
  ay: number;
  rgba: Uint8Array;
}

interface AnimFrame {
  f: number;
  dx: number;
  dy: number;
  ticks: number;
  flipH: boolean;
}

interface Anim {
  frames: AnimFrame[];
  loopStart: number;
  hitTick?: number;
}

interface Exported {
  images: FrameImage[];
  anims: Partial<Record<Slot, Anim>>;
  portrait: number | null;
  notes: string[];
}

// ---------- MUGEN ----------

interface SlotPick {
  action: number;
  /** The state the move runs in, used to read its HitDef timing. */
  state?: number;
  /** Frame range of the action to keep (0-based, inclusive). */
  from?: number;
  to?: number;
}

/** Default slot choice: first plain attack, then specials that are not throws and need no fightfx. */
export function pickMugenSlots(c: MugenCharacter): Partial<Record<Slot, SlotPick>> {
  const exists = (id: number) => c.air.get(id)?.frames.some((f) => c.sff.get(f.group, f.image)) ?? false;
  const first = (ids: number[]) => {
    const action = ids.find(exists);
    return action === undefined ? undefined : { action };
  };
  const clean = c.moves.filter((m) => !m.flags.throwReasons.length && !m.flags.fightfxAnims.length && m.anims.some(exists));
  const pick = (m: (typeof clean)[number] | undefined): SlotPick | undefined =>
    m ? { action: m.anims.find(exists)!, state: m.state } : undefined;
  const normals = clean.filter((m) => m.state < 1000);
  const specials = clean.filter((m) => m.state >= 1000 && m.flags.powerCost < 3000);
  const supers = clean.filter((m) => m.flags.powerCost >= 3000);
  return {
    idle: first([0]),
    basic: pick(normals.find((m) => m.state === 200) ?? normals[0]),
    s1: pick(specials[0]),
    s2: pick(specials[1]),
    s3: pick(supers[0] ?? specials[2]),
    hit: first([5000, 5001, 5002, 5010]),
    ko: first([5150, 5140, 5110, 5100]),
  };
}

/** The state that plays an action: the pick's own state, else one whose anim is that action. */
function stateOfAction(c: MugenCharacter, p: SlotPick): number | undefined {
  if (p.state !== undefined) return p.state;
  for (const [id, st] of c.states) if (st.anim !== undefined && Number(st.anim) === p.action) return id;
  return c.moves.find((m) => m.anims.includes(p.action))?.state;
}

function exportMugen(entry: Extract<ExportEntry, { mugen: string }>): Exported {
  const c = loadCharacter(join(RAW, entry.mugen));
  const picks: Partial<Record<Slot, SlotPick>> = { ...pickMugenSlots(c) };
  for (const [slot, pick] of Object.entries(entry.actions ?? {}) as [Slot, ActionPick][]) {
    picks[slot] = typeof pick === 'number' ? { action: pick } : { ...pick };
  }
  const images: FrameImage[] = [];
  const index = new Map<string, number>();
  const notes: string[] = [];
  const sprite = (g: number, i: number): number | undefined => {
    const k = `${g},${i}`;
    if (index.has(k)) return index.get(k);
    const s = c.sff.get(g, i);
    if (!s) return undefined;
    images.push({ w: s.width, h: s.height, ax: s.axisX, ay: s.axisY, rgba: s.decode() });
    index.set(k, images.length - 1);
    return images.length - 1;
  };
  const anims: Exported['anims'] = {};
  for (const slot of SLOTS) {
    const p = picks[slot];
    const action = p ? c.air.get(p.action) : undefined;
    if (!p || !action) {
      notes.push(`${slot}: missing`);
      continue;
    }
    const ranged = p.from !== undefined || p.to !== undefined;
    const source = action.frames.slice(p.from ?? 0, (p.to ?? action.frames.length - 1) + 1);
    const frames: AnimFrame[] = [];
    for (const fr of source) {
      const f = sprite(fr.group, fr.image);
      if (f !== undefined) frames.push({ f, dx: fr.x, dy: fr.y, ticks: fr.time, flipH: fr.flipH });
    }
    const loopStart = ranged ? 0 : Math.min(action.loopStart, Math.max(0, frames.length - 1));
    const anim: Anim = { frames, loopStart };
    if (ATTACK_SLOTS.includes(slot) && frames.length) {
      // The move's own HitDef timing first. A cut-out range only takes HitDefs inside it, and
      // falls back to its furthest-reaching frame.
      const state = stateOfAction(c, p);
      const hitDefs = (state !== undefined ? (c.states.get(state)?.controllers ?? []) : [])
        .filter((ctrl) => ctrl.type === 'hitdef')
        .map((ctrl) => ctrl.triggers);
      const fromHitDef = hitDefTick(hitDefs, frames, { action: p.action, from: p.from ?? 0, to: p.to ?? action.frames.length - 1 });
      anim.hitTick =
        fromHitDef ??
        (ranged
          ? forwardReachTick(frames.map((fr) => ({ ...fr, w: images[fr.f]!.w, ax: images[fr.f]!.ax })), entry.facing ?? 'right')
          : middleTick(frames));
    }
    anims[slot] = anim;
    const range = ranged ? `[${p.from ?? 0}-${p.to ?? action.frames.length - 1}]` : '';
    notes.push(`${slot}: ${p.action}${range}${anim.hitTick !== undefined ? `@${anim.hitTick}` : ''}`);
  }
  // Portrait: an explicit sprite, else 9000,1 when it is a real portrait. Compilations such as
  // One Piece Mugen V14 replace 9000,1 with a full select screen; then crop the head and
  // shoulders from the first idle frame instead.
  let portrait: number | null = null;
  const large = c.sff.get(9000, 1);
  const [pg, pi] = entry.portrait ?? (large && large.width <= 320 ? [9000, 1] : [-1, -1]);
  if (pg >= 0) portrait = sprite(pg, pi) ?? null;
  const idleFirst = anims.idle?.frames[0];
  if (portrait === null && idleFirst) {
    const src = images[idleFirst.f]!;
    const h = Math.min(src.h, Math.round(src.w * 1.1));
    images.push({ w: src.w, h, ax: Math.floor(src.w / 2), ay: h, rgba: src.rgba.slice(0, src.w * h * 4) });
    portrait = images.length - 1;
    notes.push('portrait: cropped from idle');
  }
  return { images, anims, portrait, notes };
}

// ---------- GBA sheets ----------

interface SheetSlot {
  frames: number[];
  ticks?: number;
  offsets?: [number, number][];
  /** Index into `frames` of the frame where the hit lands; defaults to the middle frame. */
  hitFrame?: number;
}

function exportSheet(entry: Extract<ExportEntry, { sheet: string }>): Exported {
  const [folder, file] = entry.sheet.split('/') as [string, string];
  const configPath = join(ROOT, 'tools', 'sheets', `${folder}.json`);
  const config = existsSync(configPath)
    ? ((JSON.parse(readFileSync(configPath, 'utf8')) as { sheets?: Record<string, { gap?: number; minPixels?: number; slots?: Record<string, SheetSlot> }> }).sheets?.[file] ?? {})
    : {};
  const img = loadImage(join(RAW, folder, file));
  removeBackground(img, findBackground(img));
  const boxes = sliceSheet(img, { gap: config.gap ?? 3, minPixels: config.minPixels ?? 4 });
  const images: FrameImage[] = [];
  const index = new Map<number, number>();
  const notes: string[] = [];
  const frame = (n: number): number | undefined => {
    if (index.has(n)) return index.get(n);
    const b = boxes[n];
    if (!b) return undefined;
    images.push({ w: b.w, h: b.h, ax: Math.floor(b.w / 2), ay: b.h, rgba: crop(img, b) });
    index.set(n, images.length - 1);
    return images.length - 1;
  };
  const slots = config.slots ?? {};
  const anims: Exported['anims'] = {};
  for (const slot of SLOTS) {
    const def = slots[slot];
    if (!def) {
      notes.push(`${slot}: missing`);
      continue;
    }
    const frames: AnimFrame[] = [];
    def.frames.forEach((n, k) => {
      const f = frame(n);
      const [dx, dy] = def.offsets?.[k] ?? [0, 0];
      if (f !== undefined) frames.push({ f, dx, dy, ticks: def.ticks ?? 6, flipH: false });
      else notes.push(`${slot}: frame ${n} does not exist`);
    });
    const anim: Anim = { frames, loopStart: 0 };
    if (ATTACK_SLOTS.includes(slot)) anim.hitTick = def.hitFrame !== undefined ? tickOfFrame(frames, def.hitFrame) : middleTick(frames);
    anims[slot] = anim;
    notes.push(`${slot}: [${def.frames.join(',')}]`);
  }
  const portraitDef = slots['portrait'];
  const portrait = portraitDef?.frames[0] !== undefined ? (frame(portraitDef.frames[0]) ?? null) : null;
  return { images, anims, portrait, notes };
}

/**
 * The renderer normalises every sprite to one height and multiplies by `scale`. To keep the
 * sizes the artists drew (Krieg towers over Luffy, grunts are a bit smaller), scale is the idle
 * height relative to a reference body, clamped so nothing becomes unreadable or huge.
 */
const REFERENCE_HEIGHT = 52;
function relativeScale(height: number | null): number {
  if (!height) return 1;
  return Math.round(Math.min(1.6, Math.max(0.8, height / REFERENCE_HEIGHT)) * 100) / 100;
}

// ---------- Atlas ----------

/** Shelf packing, tallest first, 1px padding. Returns rects in input order and the atlas size. */
function pack(images: FrameImage[], maxWidth = 1024): { rects: { x: number; y: number }[]; width: number; height: number } {
  const order = images.map((_, i) => i).sort((a, b) => images[b]!.h - images[a]!.h);
  const rects: { x: number; y: number }[] = new Array(images.length);
  let x = 0;
  let y = 0;
  let shelf = 0;
  let width = 0;
  for (const i of order) {
    const im = images[i]!;
    if (x + im.w + 1 > maxWidth && x > 0) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    rects[i] = { x, y };
    x += im.w + 1;
    shelf = Math.max(shelf, im.h);
    width = Math.max(width, x);
  }
  return { rects, width: Math.max(1, width), height: Math.max(1, y + shelf) };
}

function writeAtlas(entry: ExportEntry, source: string, ex: Exported): void {
  const { rects, width, height } = pack(ex.images);
  const atlas = new Uint8Array(width * height * 4);
  ex.images.forEach((im, i) => {
    const r = rects[i]!;
    for (let row = 0; row < im.h; row++) atlas.set(im.rgba.subarray(row * im.w * 4, (row + 1) * im.w * 4), ((r.y + row) * width + r.x) * 4);
  });
  const dir = join(OUT, entry.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'atlas.png'), encodePngRgba(width, height, atlas));
  const idleFrame = ex.anims.idle?.frames[0];
  const bodyHeight = idleFrame ? ex.images[idleFrame.f]!.h : null;
  const json = {
    version: FORMAT_VERSION,
    id: entry.id,
    source,
    facing: entry.facing ?? 'right',
    height: bodyHeight,
    scale: entry.scale ?? relativeScale(bodyHeight),
    frames: ex.images.map((im, i) => ({ x: rects[i]!.x, y: rects[i]!.y, w: im.w, h: im.h, ax: im.ax, ay: im.ay })),
    anims: ex.anims,
    portrait: ex.portrait,
  };
  writeFileSync(join(dir, 'sprite.json'), JSON.stringify(json));
}

// ---------- Main ----------

const only = new Set(process.argv.slice(2));
const done: string[] = [];
for (const entry of EXPORTS) {
  if (only.size && !only.has(entry.id)) continue;
  try {
    const ex = 'mugen' in entry ? exportMugen(entry) : exportSheet(entry);
    const source = 'mugen' in entry ? entry.mugen : entry.sheet;
    if (ex.images.length === 0) {
      console.log(`${entry.id.padEnd(16)} skipped: no slot is declared yet`);
      continue;
    }
    writeAtlas(entry, source, ex);
    done.push(entry.id);
    console.log(`${entry.id.padEnd(16)} ${String(ex.images.length).padStart(3)} frames  ${ex.notes.join(' | ')}`);
  } catch (e) {
    console.error(`${entry.id}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
const indexPath = join(OUT, 'index.json');
const previous: string[] = existsSync(indexPath) ? (JSON.parse(readFileSync(indexPath, 'utf8')) as { ids: string[] }).ids : [];
mkdirSync(OUT, { recursive: true });
writeFileSync(indexPath, JSON.stringify({ version: FORMAT_VERSION, ids: [...new Set([...previous, ...done])].sort() }, null, 2));
