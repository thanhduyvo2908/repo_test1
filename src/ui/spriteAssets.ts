import { loadSpriteSheet, type SpriteSheet } from "../render/sprites";

// Finds exported sprite sheets for a pack. Assets are not committed, so any of them may be missing;
// missing sheets fall back to shapes in the battle scene.

const sheetJson = import.meta.glob("/packs/*/assets/*/sprite.json", { import: "default" }) as Record<
  string,
  () => Promise<unknown>
>;
const atlasUrls = import.meta.glob("/packs/*/assets/*/atlas.png", {
  query: "?url",
  import: "default",
}) as Record<string, () => Promise<string>>;

const cache = new Map<string, Promise<SpriteSheet | null>>();

export function loadSheet(packId: string, sourceId: string): Promise<SpriteSheet | null> {
  const key = `${packId}/${sourceId}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const base = `/packs/${packId}/assets/${sourceId}`;
  const json = sheetJson[`${base}/sprite.json`];
  const atlas = atlasUrls[`${base}/atlas.png`];
  const promise =
    json && atlas
      ? Promise.all([json(), atlas()]).then(([raw, url]) => loadSpriteSheet(raw, url)).catch(() => null)
      : Promise.resolve(null);
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
