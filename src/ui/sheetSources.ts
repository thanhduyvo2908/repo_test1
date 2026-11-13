// Where the exported sprite files of a pack live. Only some ids have sprites (the placeholder pack
// has none), so any of them may be missing. Kept free of PixiJS so plain React screens (portraits)
// can read frames without it.

const sheetJson = import.meta.glob("/packs/*/assets/*/sprite.json", { import: "default" }) as Record<
  string,
  () => Promise<unknown>
>;
const atlasUrls = import.meta.glob("/packs/*/assets/*/atlas.png", {
  query: "?url",
  import: "default",
}) as Record<string, () => Promise<string>>;

export interface SheetSource {
  /** Parsed sprite.json, unchecked. */
  raw: unknown;
  atlasUrl: string;
}

const cache = new Map<string, Promise<SheetSource | null>>();

/** The sprite.json and atlas URL of one character or enemy, or null when it was not exported. */
export function sheetSource(packId: string, sourceId: string): Promise<SheetSource | null> {
  const key = `${packId}/${sourceId}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const base = `/packs/${packId}/assets/${sourceId}`;
  const json = sheetJson[`${base}/sprite.json`];
  const atlas = atlasUrls[`${base}/atlas.png`];
  const promise =
    json && atlas
      ? Promise.all([json(), atlas()])
          .then(([raw, atlasUrl]) => ({ raw, atlasUrl }))
          .catch(() => null)
      : Promise.resolve(null);
  cache.set(key, promise);
  return promise;
}

/** True when the pack has a sprite for this id, without loading it. */
export function hasSheet(packId: string, sourceId: string): boolean {
  return `/packs/${packId}/assets/${sourceId}/sprite.json` in sheetJson;
}
