import { z } from "zod";
import { ITEM_TIERS, STAT_KEYS } from "../content/schema";
import type { GameState } from "../core/progress";
import { DEFAULT_LANG, LANGUAGES, type Lang } from "../i18n";

// Versioned save file. Bump SAVE_VERSION and add a migration whenever the shape changes.

export const SAVE_VERSION = 4;

export interface SaveData {
  version: typeof SAVE_VERSION;
  settings: {
    lang: Lang;
    /** After a mini stage win, move on to the next stage instead of repeating. */
    autoAdvance: boolean;
  };
  /** null until the first game starts. */
  game: GameState | null;
}

/** Where saves are stored. The UI passes localStorage; tests pass an in-memory store. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = "xidle.save";

type RawSave = Record<string, unknown>;

/** migrations[n] upgrades a version-n save to version n + 1. */
export const migrations: Record<number, (save: RawSave) => RawSave> = {
  // v1 → v2: progression added. v1 saves only held settings.
  1: (save) => ({ ...save, version: 2, game: null }),
  // v2 → v3: growth (stars, points, skill order, equipped item), resources, side dungeons, offline time.
  2: (save) => {
    const game = save.game as Record<string, unknown> | null | undefined;
    if (!game || typeof game !== "object") return { ...save, version: 3, game: null };
    const roster = Array.isArray(game.roster) ? game.roster : [];
    return {
      ...save,
      version: 3,
      game: {
        ...game,
        roster: roster.map((c: Record<string, unknown>) => ({
          ...c,
          stars: 1,
          points: {},
          skillOrder: null,
          itemUid: null,
        })),
        gold: 0,
        food: 0,
        dust: 0,
        starMaterial: 0,
        sideDungeon: { day: "", used: 0 },
        lastSeenAt: null,
      },
    };
  },
  // v3 → v4: auto-advance setting for mini stages, off by default.
  3: (save) => {
    const settings = (save.settings as Record<string, unknown> | undefined) ?? {};
    return { ...save, version: 4, settings: { ...settings, autoAdvance: false } };
  },
};

const count = z.int().min(0);

const gameStateSchema = z.object({
  seed: count,
  battleCounter: count,
  roster: z.array(
    z.object({
      characterId: z.string(),
      level: z.int().min(1),
      stars: z.int().min(1),
      points: z.partialRecord(z.enum(STAT_KEYS), count),
      skillOrder: z.array(count).nullable(),
      itemUid: z.int().nullable(),
    }),
  ),
  team: z.array(z.string()),
  maps: z.record(z.string(), z.object({ stagesCleared: count, bossDefeated: z.boolean() })),
  items: z.array(z.object({ uid: z.int(), itemId: z.string(), tier: z.enum(ITEM_TIERS) })),
  nextItemUid: z.int().min(1),
  completedWorlds: z.array(z.string()),
  gold: count,
  food: count,
  dust: count,
  starMaterial: count,
  sideDungeon: z.object({ day: z.string(), used: count }),
  lastSeenAt: z.number().nullable(),
});

const saveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  settings: z.object({
    lang: z.enum(LANGUAGES).catch(DEFAULT_LANG),
    autoAdvance: z.boolean().catch(false),
  }),
  game: gameStateSchema.nullable().catch(null),
});

export function createDefaultSave(): SaveData {
  return { version: SAVE_VERSION, settings: { lang: DEFAULT_LANG, autoAdvance: false }, game: null };
}

function migrate(save: RawSave): RawSave | null {
  let current = save;
  let version = typeof current.version === "number" ? current.version : NaN;
  if (!Number.isInteger(version) || version < 1 || version > SAVE_VERSION) return null;
  while (version < SAVE_VERSION) {
    const step = migrations[version];
    if (!step) return null;
    current = step(current);
    version += 1;
  }
  return current;
}

/**
 * Parses a serialized save. Corrupt, unknown or newer saves fall back to a fresh save; a damaged
 * game section is dropped while the settings are kept.
 */
export function deserializeSave(text: string | null): SaveData {
  if (!text) return createDefaultSave();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return createDefaultSave();
  }
  if (!parsed || typeof parsed !== "object") return createDefaultSave();
  const migrated = migrate(parsed as RawSave);
  if (!migrated) return createDefaultSave();
  const result = saveSchema.safeParse(migrated);
  return result.success ? (result.data as SaveData) : createDefaultSave();
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}

export function loadSave(storage: SaveStorage): SaveData {
  return deserializeSave(storage.getItem(SAVE_KEY));
}

export function writeSave(storage: SaveStorage, save: SaveData): void {
  storage.setItem(SAVE_KEY, serializeSave(save));
}
