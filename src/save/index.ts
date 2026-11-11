import { DEFAULT_LANG, isLang, type Lang } from "../i18n";

// Versioned save file. Bump SAVE_VERSION and add a migration whenever the shape changes.

export const SAVE_VERSION = 1;

export interface SaveData {
  version: typeof SAVE_VERSION;
  settings: {
    lang: Lang;
  };
}

/** Where saves are stored. The UI passes localStorage; tests pass an in-memory store. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = "xidle.save";

/** migrations[n] upgrades a version-n save to version n + 1. */
const migrations: Record<number, (save: Record<string, unknown>) => Record<string, unknown>> = {};

export function createDefaultSave(): SaveData {
  return { version: SAVE_VERSION, settings: { lang: DEFAULT_LANG } };
}

function migrate(save: Record<string, unknown>): Record<string, unknown> | null {
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

/** Parses a serialized save. Corrupt, unknown or newer saves fall back to a fresh save. */
export function deserializeSave(text: string | null): SaveData {
  if (!text) return createDefaultSave();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return createDefaultSave();
  }
  if (!parsed || typeof parsed !== "object") return createDefaultSave();
  const migrated = migrate(parsed as Record<string, unknown>);
  if (!migrated) return createDefaultSave();

  const fresh = createDefaultSave();
  const settings = migrated.settings as Record<string, unknown> | undefined;
  return {
    version: SAVE_VERSION,
    settings: {
      lang: isLang(settings?.lang) ? settings.lang : fresh.settings.lang,
    },
  };
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
