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

// ---------------------------------------------------------------------------
// Status effects. Four groups: control, damage over time, stat changes and cooldowns,
// protection and recovery. Every effect is data; the engine has no per-skill code.

export const DOT_TYPES = ["poison", "burn", "bleed"] as const;
/** Stats that stat stages can change. HP is not one of them. */
export const STAGE_STATS = ["atk", "def", "spa", "spd", "spe"] as const;

/** A value computed from a stat: e.g. 25% of the caster's max HP. `hp` means max HP. */
export const amountSchema = z.object({
  stat: statKeySchema,
  ratio: positive,
  of: z.enum(["caster", "target"]).default("caster"),
});

const fractionOfMaxHp = z.number().gt(0).max(1);

export const statusSpecSchema = z.discriminatedUnion("kind", [
  // Control: the unit loses its turn (stun, sleep) or can only use its basic attack (silence).
  // Sleep also ends when the unit takes damage from a hit.
  z.object({ kind: z.literal("stun") }),
  z.object({ kind: z.literal("sleep") }),
  z.object({ kind: z.literal("silence") }),
  // Damage over time: loses a share of max HP at the end of each of its turns.
  z.object({ kind: z.literal("dot"), type: z.enum(DOT_TYPES), percentMaxHp: fractionOfMaxHp }),
  // Stat changes in Pokémon-style stages (±1 to ±6).
  z.object({
    kind: z.literal("statStage"),
    stat: z.enum(STAGE_STATS),
    stages: z
      .int()
      .min(-6)
      .max(6)
      .refine((n) => n !== 0, "stages cannot be 0"),
  }),
  // Protection and recovery.
  z.object({ kind: z.literal("shield"), amount: amountSchema }),
  z.object({ kind: z.literal("regen"), percentMaxHp: fractionOfMaxHp }),
  z.object({ kind: z.literal("immunity") }),
  z.object({ kind: z.literal("taunt") }),
  z.object({
    kind: z.literal("damageReduction"),
    damageType: damageTypeSchema.optional(),
    ratio: z.number().gt(0).lt(1),
  }),
]);

/** "targets" = whoever the skill targets (enemies or allies); "self" = the user. */
const effectTargetSchema = z.enum(["targets", "self"]).default("targets");

export const skillEffectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("status"),
    status: statusSpecSchema,
    target: effectTargetSchema,
    chance: probability.default(1),
    /** In the owner's turns. null = lasts the whole battle (passives). */
    duration: z.int().min(1).nullable(),
  }),
  z.object({ kind: z.literal("heal"), target: effectTargetSchema, amount: amountSchema }),
  /** Heals the user by a share of the damage this skill dealt. */
  z.object({ kind: z.literal("lifesteal"), ratio: positive }),
  /** Changes the remaining cooldowns of every cooldown skill: positive delays, negative speeds up. */
  z.object({
    kind: z.literal("cooldown"),
    target: effectTargetSchema,
    rounds: z.int().refine((n) => n !== 0, "rounds cannot be 0"),
  }),
]);

export const passiveEffectSchema = z.discriminatedUnion("trigger", [
  /** Applied to the owner when the battle starts. */
  z.object({ trigger: z.literal("battleStart"), effect: skillEffectSchema }),
  /** Fires once per battle, the first time the owner's HP drops below the threshold. */
  z.object({
    trigger: z.literal("hpBelow"),
    threshold: z.number().gt(0).lt(1),
    effect: skillEffectSchema,
  }),
]);

export const skillSchema = z.object({
  id,
  name: localizedTextSchema,
  description: localizedTextSchema,
  /** Defaults to the owner's element. */
  element: elementSchema.optional(),
  /** 0 for skills that deal no damage (shields, buffs). */
  power: z.number().min(0),
  /** The stats the skill's damage scales with; A in the damage formula is the weighted sum. */
  scaling: z.array(z.object({ stat: statKeySchema, weight: positive })).min(1),
  target: z.enum(SKILL_TARGETS),
  usage: skillUsageSchema,
  effects: z.array(skillEffectSchema).default([]),
});

/** What one star level changes. The story milestone is a boss that must have been defeated. */
export const starLevelSchema = z.object({
  requiresBossOf: id,
  baseStatBonus: statBlockSchema.partial().default({}),
  /** Replacement skills by slot (0 = S1). The new skill keeps the slot's usage rules. */
  skillOverrides: z.array(z.object({ slot: z.int().min(0).max(3), skill: skillSchema })).default([]),
  /** Extra passive effects added on top of the character's passive. */
  passiveEffects: z.array(passiveEffectSchema).default([]),
});

export const passiveSchema = z.object({
  id,
  name: localizedTextSchema,
  description: localizedTextSchema,
  effects: z.array(passiveEffectSchema).default([]),
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
  /** The character's own item. Optional: some characters have none yet. */
  itemId: id.optional(),
  /** Star levels above 1★, in order: index 0 is 2★. Each one adds on top of the previous. */
  stars: z.array(starLevelSchema).default([]),
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
  /** Story arc the map belongs to. The world screen groups maps by it; maps without one are not grouped. */
  arc: localizedTextSchema.optional(),
  stages: z.array(stageSchema).min(10).max(15),
  boss: bossSchema,
});

export const worldSchema = z.object({
  id,
  name: localizedTextSchema,
  maps: z.array(mapSchema).min(1),
});

/** Side dungeons: daily 5v1 fights against stronger bosses that pay out star materials. */
export const sideDungeonSchema = z.object({
  id,
  name: localizedTextSchema,
  /** Opens once this map's boss has been defeated. */
  unlockAfterMapId: id,
  boss: bossSchema.omit({ recruitRate: true, dropItemId: true }),
  rewards: z.object({ starMaterial: z.int().min(1) }),
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
  offline: z.object({
    maxHours: positive,
    /** Battles credited per hour away, at the best stage cleared so far. */
    battlesPerHour: positive,
    /** Shorter absences give nothing. */
    minMinutes: z.number().min(0),
  }),
  economy: z.object({
    /** Gold and food per stage win: rate × sum of enemy levels in the stage. */
    stageReward: z.object({ goldPerEnemyLevel: z.number().min(0), foodPerEnemyLevel: z.number().min(0) }),
    /** Boss wins pay rate × boss level × this multiplier. */
    bossRewardMultiplier: z.number().min(0),
    /** Cost to go from level L to L + 1: floor(base × L ^ exponent). */
    levelCost: z.object({
      gold: z.object({ base: positive, exponent: z.number().min(0) }),
      food: z.object({ base: positive, exponent: z.number().min(0) }),
    }),
  }),
  stars: z.object({
    /** Star material cost per star level: index 0 is the cost of 2★. */
    materialCost: z.array(z.int().min(0)).min(1),
  }),
  status: z.object({
    /** Stat stages are clamped to ±maxStage. */
    maxStage: z.int().min(1),
    /** Each stage multiplies the stat by (1 + step × n), or divides by it for negative stages. */
    stageStep: positive,
  }),
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
  sideDungeons: z.array(sideDungeonSchema).default([]),
});

export type Element = z.infer<typeof elementSchema>;
export type DamageType = z.infer<typeof damageTypeSchema>;
export type StatKey = z.infer<typeof statKeySchema>;
export type ItemTier = z.infer<typeof itemTierSchema>;
export type StatBlock = z.infer<typeof statBlockSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type StatusSpec = z.infer<typeof statusSpecSchema>;
export type SkillEffect = z.infer<typeof skillEffectSchema>;
export type PassiveEffect = z.infer<typeof passiveEffectSchema>;
export type Amount = z.infer<typeof amountSchema>;
export type StageStat = (typeof STAGE_STATS)[number];
export type Character = z.infer<typeof characterSchema>;
export type Enemy = z.infer<typeof enemySchema>;
export type Item = z.infer<typeof itemSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type Boss = z.infer<typeof bossSchema>;
export type GameMap = z.infer<typeof mapSchema>;
export type World = z.infer<typeof worldSchema>;
export type StarLevel = z.infer<typeof starLevelSchema>;
export type SideDungeon = z.infer<typeof sideDungeonSchema>;
export type Balance = z.infer<typeof balanceSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type RawPack = z.infer<typeof rawPackSchema>;
/** Pack data as authored, before defaults are filled in. Packs written in TypeScript use this. */
export type PackInput = z.input<typeof rawPackSchema>;
