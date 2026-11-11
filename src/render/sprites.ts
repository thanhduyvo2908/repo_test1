import { Assets, Rectangle, Texture } from "pixi.js";
import { fallbackChain, type SpriteAnim } from "./animClock";

// Sprite sheets exported by tools/sprite-export.ts: one atlas.png plus sprite.json per character.
// Sprites face right; frames anchor at the feet (ax, ay) in source pixels.

export interface SheetFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

export interface SheetData {
  version?: number;
  id: string;
  /** Direction the source frames face. */
  facing?: "right" | "left";
  /** Standing height in source pixels, used to size characters alike. */
  height?: number;
  /** Extra size factor chosen by the exporter. */
  scale?: number;
  frames: SheetFrame[];
  anims: Record<string, SpriteAnim & { hitTick?: number }>;
  portrait?: number;
}

/** Sheet format versions this renderer understands. */
const SUPPORTED_VERSIONS = [undefined, 1];

/** Light shape check: the file comes from our own exporter, but a bad file must not crash a battle. */
export function parseSheetData(raw: unknown): SheetData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<SheetData>;
  if (typeof data.id !== "string" || !Array.isArray(data.frames) || !data.anims) return null;
  if (!SUPPORTED_VERSIONS.includes(data.version)) return null;
  const frameCount = data.frames.length;
  for (const anim of Object.values(data.anims)) {
    if (!Array.isArray(anim.frames)) return null;
    if (anim.frames.some((f) => typeof f.f !== "number" || f.f < 0 || f.f >= frameCount)) return null;
  }
  if (!data.anims.idle) return null;
  return data as SheetData;
}

export class SpriteSheet {
  constructor(
    readonly data: SheetData,
    readonly textures: Texture[],
  ) {}

  /** The animation for a key, falling back to basic and then idle when the sheet lacks it. */
  anim(name: string): { name: string; anim: SpriteAnim } {
    for (const key of fallbackChain(name)) {
      const anim = this.data.anims[key];
      if (anim && anim.frames.length > 0) return { name: key, anim };
    }
    return { name: "idle", anim: this.data.anims.idle! };
  }

  /** Standing height in source pixels: the exporter's value, else the first idle frame's top-to-feet. */
  get standingHeight(): number {
    if (this.data.height && this.data.height > 0) return this.data.height;
    const first = this.data.anims.idle?.frames[0];
    const frame = first ? this.data.frames[first.f] : undefined;
    return Math.max(1, frame?.ay ?? frame?.h ?? 60);
  }

  /** 1 if the frames face right, -1 if they face left. */
  get facingSign(): number {
    return this.data.facing === "left" ? -1 : 1;
  }

  get extraScale(): number {
    return this.data.scale && this.data.scale > 0 ? this.data.scale : 1;
  }
}

/** Loads a sheet from its JSON data and atlas URL. Returns null if anything is missing or broken. */
export async function loadSpriteSheet(raw: unknown, atlasUrl: string): Promise<SpriteSheet | null> {
  const data = parseSheetData(raw);
  if (!data) return null;
  try {
    const atlas = await Assets.load<Texture>(atlasUrl);
    atlas.source.scaleMode = "nearest";
    const textures = data.frames.map(
      (f) => new Texture({ source: atlas.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }),
    );
    return new SpriteSheet(data, textures);
  } catch {
    return null;
  }
}
