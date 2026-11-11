import { z } from "zod";

// Content pack schema. Every pack file is validated against these shapes on load.

export const ELEMENTS = ["metal", "wood", "water", "fire", "earth", "light", "dark"] as const;
export const DAMAGE_TYPES = ["physical", "magic"] as const;
export const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
export const ITEM_TIERS = ["common", "rare", "epic", "legendary"] as const;
export const SKILL_TARGETS = ["enemy", "allEnemies", "self", "ally", "allAllies"] as const;

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ids are kebab-case");
const positive = z.number().positive();
const probability = z.number().min(0).max(1);

export const localizedTextSchema = z.object({
  en: z.string().trim().min(1),
  vi: z.string().trim().min(1).optional(),
});

export const elementSchema = z.enum(ELEMENTS);
export const damageTypeSchema = z.enum(DAMAGE_TYPES);
export const statKeySchema = z.enum(STAT_KEYS);
export const itemTierSchema = z.enum(ITEM_TIERS);

export const statBlockSchema = z.object({
  hp: positive,
  atk: positive,
  def: positive,
  spa: positive,
  spd: positive,
  spe: positive,
});

/** How a skill is used: basic attacks have no limit, S1/S2 use cooldowns, S3/S4 fire once per battle. */
export const skillUsageSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("basic") }),
  z.object({ kind: z.literal("cooldown"), rounds: z.int().min(1) }),
  z.object({ kind: z.literal("oncePerBattle") }),
]);

export const skillSchema = z.object({
  id,
  name: localizedTextSchema,
  description: localizedTextSchema,
  /** Defaults to the owner's element. */
  element: elementSchema.optional(),
  power: positive,
  /** The stats the skill's damage scales with; A in the damage formula is the weighted sum. */
  scaling: z.array(z.object({ stat: statKeySchema, weight: positive })).min(1),
  target: z.enum(SKILL_TARGETS),
  usage: skillUsageSchema,
});

export const passiveSchema = z.object({
  id,
  name: localizedTextSchema,
  description: localizedTextSchema,
});

export const characterSchema = z.object({
  id,
  name: localizedTextSchema,
  element: elementSchema,
  damageType: damageTypeSchema,
  baseStats: statBlockSchema,
  passive: passiveSchema,
  basicAttack: skillSchema,
  /** Slot order: S1, S2, S3, S4. Unlock levels live in the balance config. */
  skills: z.array(skillSchema).min(1).max(4),
  itemId: id,
});

export const enemySchema = z.object({
  id,
  name: localizedTextSchema,
  element: elementSchema,
  damageType: damageTypeSchema,
  baseStats: statBlockSchema,
  basicAttack: skillSchema,
  skills: z.array(skillSchema).max(4),
});

export const itemSchema = z.object({
  id,
  name: localizedTextSchema,
  description: localizedTextSchema,
  ownerId: id,
  effect: z.object({
    kind: z.literal("damageBonus"),
    condition: z.object({
      element: elementSchema.optional(),
      damageType: damageTypeSchema.optional(),
    }),
    /** Bonus as a fraction, e.g. 0.3 = +30%. */
    valueByTier: z.object({
      common: z.number().min(0),
      rare: z.number().min(0),
      epic: z.number().min(0),
      legendary: z.number().min(0),
    }),
  }),
});

export const stageSchema = z.object({
  enemies: z
    .array(z.object({ enemyId: id, level: z.int().min(1) }))
    .min(1)
    .max(5),
});

export const bossSchema = z.object({
  characterId: id,
  level: z.int().min(1),
  /** Boss-version base stats, separate from the recruitable character's. */
  baseStats: statBlockSchema,
  basicAttack: skillSchema,
  skills: z.array(skillSchema).min(1),
  /** Overrides the world's recruit rate. */
  recruitRate: probability.optional(),
  dropItemId: id.optional(),
});

export const mapSchema = z.object({
  id,
  name: localizedTextSchema,
  stages: z.array(stageSchema).min(10).max(15),
  boss: bossSchema,
});

export const worldSchema = z.object({
  id,
  name: localizedTextSchema,
  maps: z.array(mapSchema).min(1),
});

const tierNumbers = z.object({
  common: z.number().min(0),
  rare: z.number().min(0),
  epic: z.number().min(0),
  legendary: z.number().min(0),
});

export const balanceSchema = z.object({
  stats: z.object({
    pointsPerLevel: z.int().min(0),
    /** A stat can take at most level × this many points. */
    maxPointsPerStatPerLevel: z.int().min(0),
    pointValue: z.object({ hp: z.number().min(0), other: z.number().min(0) }),
  }),
  skills: z.object({
    /** Level at which each skill slot (S1..S4) unlocks. */
    unlockLevels: z.array(z.int().min(1)).length(4),
  }),
  damage: z.object({
    critChance: probability,
    critMultiplier: positive,
    randomMin: positive,
    randomMax: positive,
    stab: positive,
    multiTarget: positive,
    minDamage: z.int().min(0),
  }),
  /** Attacker → defender multipliers. Pairs not listed are neutral (×1). */
  elementChart: z.array(
    z.object({ attacker: elementSchema, defender: elementSchema, multiplier: positive }),
  ),
  rounds: z.object({
    stage: z.int().min(1),
    boss: z.int().min(1),
    sideDungeon: z.int().min(1),
  }),
  worlds: z.record(id, z.object({ levelCap: z.int().min(1), recruitRate: probability })),
  drops: z.object({
    itemDropChance: probability,
    tierWeights: tierNumbers,
    dustPerTier: tierNumbers,
    dustForLegendary: z.int().min(1),
  }),
  sideDungeon: z.object({ attemptsPerDay: z.int().min(0) }),
  offline: z.object({ maxHours: positive }),
});

export const manifestSchema = z.object({
  id,
  name: localizedTextSchema,
  starterCharacterId: id,
  /** Item given at a fixed tier when a world is completed for the first time. */
  worldCompletionRewards: z.array(
    z.object({ worldId: id, itemId: id, tier: itemTierSchema }),
  ),
});

export const rawPackSchema = z.object({
  manifest: manifestSchema,
  balance: balanceSchema,
  characters: z.array(characterSchema),
  enemies: z.array(enemySchema),
  items: z.array(itemSchema),
  worlds: z.array(worldSchema).min(1),
});

export type Element = z.infer<typeof elementSchema>;
export type DamageType = z.infer<typeof damageTypeSchema>;
export type StatKey = z.infer<typeof statKeySchema>;
export type ItemTier = z.infer<typeof itemTierSchema>;
export type StatBlock = z.infer<typeof statBlockSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Character = z.infer<typeof characterSchema>;
export type Enemy = z.infer<typeof enemySchema>;
export type Item = z.infer<typeof itemSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type Boss = z.infer<typeof bossSchema>;
export type GameMap = z.infer<typeof mapSchema>;
export type World = z.infer<typeof worldSchema>;
export type Balance = z.infer<typeof balanceSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type RawPack = z.infer<typeof rawPackSchema>;
