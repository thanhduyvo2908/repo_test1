// Raw data of the default placeholder pack. Validate it with `loadPack` before use.
import manifest from "./manifest.json";
import balance from "./balance.json";
import characters from "./characters.json";
import enemies from "./enemies.json";
import items from "./items.json";
import worlds from "./worlds.json";

export const placeholderPackData: unknown = {
  manifest,
  balance,
  characters,
  enemies,
  items,
  worlds,
};
