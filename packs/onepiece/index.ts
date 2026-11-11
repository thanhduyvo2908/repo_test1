// World 1 (One Piece, East Blue). Data only; sprites live in packs/onepiece/assets/, which git ignores.
// Validate with `loadPack` before use.
import manifest from "./manifest.json";
import balance from "./balance.json";
import { characters } from "./characters";
import { enemies } from "./enemies";
import { items } from "./items";
import { sideDungeons } from "./sideDungeons";
import { worlds } from "./worlds";

export const onepiecePackData: unknown = {
  manifest,
  balance,
  characters,
  enemies,
  items,
  worlds,
  sideDungeons,
};
