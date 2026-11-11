import {
  rawPackSchema,
  type Balance,
  type Character,
  type Enemy,
  type GameMap,
  type Item,
  type Manifest,
  type SideDungeon,
  type World,
} from "./schema";

export interface Pack {
  manifest: Manifest;
  balance: Balance;
  characters: ReadonlyMap<string, Character>;
  enemies: ReadonlyMap<string, Enemy>;
  items: ReadonlyMap<string, Item>;
  worlds: readonly World[];
  maps: ReadonlyMap<string, GameMap>;
  sideDungeons: ReadonlyMap<string, SideDungeon>;
  /** Demo build: every map, stage and boss is open. Never set by pack data, only by `toDemoPack`. */
  demo?: boolean;
}

/**
 * A copy of a pack for demos and testing: all skills unlock at level 1 and every map is open.
 * Balance numbers are otherwise unchanged.
 */
export function toDemoPack(pack: Pack): Pack {
  const unlockLevels = pack.balance.skills.unlockLevels.map(() => 1);
  return { ...pack, balance: { ...pack.balance, skills: { ...pack.balance.skills, unlockLevels } }, demo: true };
}

export class PackError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid content pack:\n- ${issues.join("\n- ")}`);
    this.name = "PackError";
  }
}

function indexById<T extends { id: string }>(
  list: readonly T[],
  kind: string,
  issues: string[],
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const entry of list) {
    if (byId.has(entry.id)) issues.push(`duplicate ${kind} id "${entry.id}"`);
    byId.set(entry.id, entry);
  }
  return byId;
}

/** Validates raw pack data (shape and cross references) and indexes it by id. */
export function loadPack(input: unknown): Pack {
  const parsed = rawPackSchema.safeParse(input);
  if (!parsed.success) {
    throw new PackError(
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }
  const raw = parsed.data;
  const issues: string[] = [];

  const characters = indexById(raw.characters, "character", issues);
  const enemies = indexById(raw.enemies, "enemy", issues);
  const items = indexById(raw.items, "item", issues);
  const worldIds = indexById(raw.worlds, "world", issues);
  const maps = indexById(
    raw.worlds.flatMap((world) => world.maps),
    "map",
    issues,
  );

  const { manifest, balance } = raw;
  if (!characters.has(manifest.starterCharacterId)) {
    issues.push(`starter character "${manifest.starterCharacterId}" does not exist`);
  }
  for (const reward of manifest.worldCompletionRewards) {
    if (!worldIds.has(reward.worldId)) issues.push(`reward world "${reward.worldId}" does not exist`);
    if (!items.has(reward.itemId)) issues.push(`reward item "${reward.itemId}" does not exist`);
  }

  for (const character of characters.values()) {
    if (character.itemId && !items.has(character.itemId)) {
      issues.push(`character "${character.id}" has unknown item "${character.itemId}"`);
    }
    if (character.basicAttack.usage.kind !== "basic") {
      issues.push(`character "${character.id}" basic attack must use kind "basic"`);
    }
    character.skills.forEach((skill, slot) => {
      // S1 and S2 use cooldowns; S3 and S4 fire once per battle.
      const expected = slot < 2 ? "cooldown" : "oncePerBattle";
      if (skill.usage.kind !== expected) {
        issues.push(`character "${character.id}" skill S${slot + 1} must use kind "${expected}"`);
      }
    });
    if (character.stars.length > balance.stars.materialCost.length) {
      issues.push(`character "${character.id}" has more star levels than balance.stars.materialCost`);
    }
    character.stars.forEach((star, i) => {
      const label = `character "${character.id}" ${i + 2}★`;
      if (!maps.has(star.requiresBossOf)) {
        issues.push(`${label} requires unknown map "${star.requiresBossOf}"`);
      }
      for (const { slot, skill } of star.skillOverrides) {
        const original = character.skills[slot];
        if (!original) issues.push(`${label} overrides missing skill slot S${slot + 1}`);
        else if (original.usage.kind !== skill.usage.kind) {
          issues.push(`${label} override for S${slot + 1} must keep usage kind "${original.usage.kind}"`);
        }
      }
    });
  }

  for (const item of items.values()) {
    if (!characters.has(item.ownerId)) {
      issues.push(`item "${item.id}" has unknown owner "${item.ownerId}"`);
    }
  }

  for (const world of raw.worlds) {
    if (!balance.worlds[world.id]) issues.push(`balance has no settings for world "${world.id}"`);
    for (const map of world.maps) {
      map.stages.forEach((stage, index) => {
        for (const { enemyId } of stage.enemies) {
          if (!enemies.has(enemyId)) {
            issues.push(`map "${map.id}" stage ${index + 1} has unknown enemy "${enemyId}"`);
          }
        }
      });
      const { boss } = map;
      if (!characters.has(boss.characterId)) {
        issues.push(`map "${map.id}" boss "${boss.characterId}" is not a character`);
      }
      if (boss.dropItemId && !items.has(boss.dropItemId)) {
        issues.push(`map "${map.id}" drops unknown item "${boss.dropItemId}"`);
      }
    }
  }

  const sideDungeons = indexById(raw.sideDungeons, "side dungeon", issues);
  for (const dungeon of sideDungeons.values()) {
    if (!maps.has(dungeon.unlockAfterMapId)) {
      issues.push(`side dungeon "${dungeon.id}" unlocks after unknown map "${dungeon.unlockAfterMapId}"`);
    }
    if (!characters.has(dungeon.boss.characterId)) {
      issues.push(`side dungeon "${dungeon.id}" boss "${dungeon.boss.characterId}" is not a character`);
    }
  }

  if (balance.damage.randomMin > balance.damage.randomMax) {
    issues.push("balance.damage.randomMin is greater than randomMax");
  }

  if (issues.length > 0) throw new PackError(issues);

  return {
    manifest,
    balance,
    characters,
    enemies,
    items,
    worlds: raw.worlds,
    maps,
    sideDungeons,
  };
}
