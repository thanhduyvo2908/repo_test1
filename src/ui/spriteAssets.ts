import { loadSpriteSheet, type SpriteSheet } from "../render/sprites";
import { sheetSource } from "./sheetSources";

// PixiJS sprite sheets for the battle scene. Missing sheets fall back to shapes in the scene.

const cache = new Map<string, Promise<SpriteSheet | null>>();

export function loadSheet(packId: string, sourceId: string): Promise<SpriteSheet | null> {
  const key = `${packId}/${sourceId}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const promise = sheetSource(packId, sourceId).then((source) =>
    source ? loadSpriteSheet(source.raw, source.atlasUrl).catch(() => null) : null,
  );
  cache.set(key, promise);
  return promise;
}

/** Loads the sheets for several units at once, keyed by source id. */
export async function loadSheets(packId: string, sourceIds: string[]): Promise<Map<string, SpriteSheet>> {
  const unique = [...new Set(sourceIds)];
  const sheets = await Promise.all(unique.map((id) => loadSheet(packId, id)));
  const byId = new Map<string, SpriteSheet>();
  unique.forEach((id, i) => {
    const sheet = sheets[i];
    if (sheet) byId.set(id, sheet);
  });
  return byId;
}
