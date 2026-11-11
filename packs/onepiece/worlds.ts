import type { PackInput } from "../../src/content/schema";
import { characters } from "./characters";
import { bossKit, bossStats, text, type BossInput } from "./kit";

// World 1: East Blue, 12 maps from Alvida to Don Krieg (docs/world-1.md).
// Stage counts and level ranges follow the proposal there. Boss stats and kits are placeholders
// until the user designs them; balancing comes in roadmap step 6.

type WorldInput = PackInput["worlds"][number];
type MapInput = WorldInput["maps"][number];
type StageInput = MapInput["stages"][number];

interface MapSpec {
  id: string;
  name: { en: string; vi: string };
  stages: number;
  /** Soldier types, mixed across the map's stages. */
  pool: string[];
  levels: [number, number];
  boss: string;
  bossLevel: number;
  dropItemId?: string;
  /** Straw Hat members recruit at 10% instead of the world's 20%. */
  recruitRate?: number;
}

/** Boss versions: base stats with this HP multiplier and this multiplier on the rest. */
const BOSS_HP = 5;
const BOSS_OTHER = 1.1;
const STRAW_HAT_RECRUIT = 0.1;

const specs: MapSpec[] = [
  { id: "alvida-ship", name: text("Alvida's Ship", "Tàu của Alvida"), stages: 10,
    pool: ["alvida-pirate"], levels: [1, 3], boss: "alvida", bossLevel: 3 },
  { id: "shells-execution-yard", name: text("Shells Town Execution Yard", "Bãi hành hình thị trấn Shells"), stages: 12,
    pool: ["marine-soldier"], levels: [3, 5], boss: "zoro", bossLevel: 5,
    dropItemId: "wado-ichimonji", recruitRate: STRAW_HAT_RECRUIT },
  { id: "shells-marine-base", name: text("Shells Town Marine Base", "Căn cứ hải quân Shells"), stages: 15,
    pool: ["marine-soldier", "marine-officer"], levels: [5, 8], boss: "morgan", bossLevel: 8 },
  { id: "orange-town-streets", name: text("Orange Town Streets", "Phố Orange Town"), stages: 10,
    pool: ["buggy-pirate"], levels: [8, 10], boss: "nami", bossLevel: 10,
    dropItemId: "nami-staff", recruitRate: STRAW_HAT_RECRUIT },
  { id: "orange-town-square", name: text("Orange Town Square", "Quảng trường Orange Town"), stages: 12,
    pool: ["buggy-pirate", "circus-performer"], levels: [10, 13], boss: "cabaji", bossLevel: 13 },
  { id: "buggy-rooftop", name: text("Buggy's Rooftop", "Sân thượng quán rượu của Buggy"), stages: 15,
    pool: ["buggy-pirate", "circus-performer"], levels: [13, 15], boss: "buggy", bossLevel: 15 },
  { id: "syrup-village-shore", name: text("Syrup Village Shore", "Bờ biển làng Syrup"), stages: 10,
    pool: ["black-cat-scout"], levels: [15, 18], boss: "usopp", bossLevel: 18,
    dropItemId: "slingshot", recruitRate: STRAW_HAT_RECRUIT },
  { id: "north-slope", name: text("North Slope", "Con dốc phía bắc"), stages: 12,
    pool: ["black-cat-pirate"], levels: [18, 20], boss: "jango", bossLevel: 20 },
  { id: "kaya-mansion", name: text("Kaya's Mansion", "Dinh thự của Kaya"), stages: 15,
    pool: ["black-cat-pirate"], levels: [20, 23], boss: "kuro", bossLevel: 23 },
  { id: "baratie-restaurant", name: text("Baratie Restaurant", "Nhà hàng Baratie"), stages: 10,
    pool: ["baratie-cook", "marine-soldier"], levels: [23, 25], boss: "sanji", bossLevel: 25,
    dropItemId: "chef-shoes", recruitRate: STRAW_HAT_RECRUIT },
  { id: "baratie-deck", name: text("Baratie Deck", "Sàn ngoài của Baratie"), stages: 12,
    pool: ["krieg-pirate"], levels: [25, 28], boss: "gin", bossLevel: 28 },
  { id: "krieg-galleon", name: text("Krieg's Wrecked Galleon", "Xác tàu của Krieg"), stages: 15,
    pool: ["krieg-pirate"], levels: [28, 30], boss: "don-krieg", bossLevel: 30 },
];

/**
 * Later stages are harder: the enemy count grows from 1 to 5 and the level climbs evenly through
 * the map's range. Soldier types rotate through the pool.
 */
export function buildStages(count: number, pool: string[], [low, high]: [number, number]): StageInput[] {
  return Array.from({ length: count }, (_, i) => {
    const size = Math.min(5, 1 + Math.floor((i * 5) / count));
    const level = low + Math.round(((high - low) * i) / Math.max(1, count - 1));
    return {
      enemies: Array.from({ length: size }, (_, j) => ({
        enemyId: pool[(i + j) % pool.length]!,
        level,
      })),
    };
  });
}

export function bossFor(characterId: string, level: number, hp = BOSS_HP, other = BOSS_OTHER): BossInput {
  const character = characters.find((c) => c.id === characterId);
  if (!character) throw new Error(`Unknown boss character ${characterId}`);
  const stat = character.damageType === "magic" ? "spa" : "atk";
  return {
    characterId,
    level,
    baseStats: bossStats(character.baseStats, hp, other),
    ...bossKit(characterId, stat),
  };
}

export const worlds: WorldInput[] = [
  {
    id: "east-blue",
    name: text("East Blue", "East Blue"),
    maps: specs.map(
      (s): MapInput => ({
        id: s.id,
        name: s.name,
        stages: buildStages(s.stages, s.pool, s.levels),
        boss: {
          ...bossFor(s.boss, s.bossLevel),
          ...(s.dropItemId ? { dropItemId: s.dropItemId } : {}),
          ...(s.recruitRate !== undefined ? { recruitRate: s.recruitRate } : {}),
        },
      }),
    ),
  },
];
