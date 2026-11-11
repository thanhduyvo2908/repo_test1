import type { Pack } from "../content/loader";
import type { Boss, GameMap, ItemTier, SideDungeon } from "../content/schema";
import { simulateBattle, type BattleResult, type BattleUnit } from "./battle";
import { buildAtStars } from "./characterBuild";
import { computeStats, type StatPoints } from "./stats";

/** One character in the player's team, as the progression system stores it. */
export interface TeamMember {
  characterId: string;
  level: number;
  /** 1 when omitted. */
  stars?: number;
  points?: StatPoints;
  /** Skill slot indexes (0 = S1) in the order the player arranged them. Defaults to S1..S4. */
  skillOrder?: number[];
  item?: { itemId: string; tier: ItemTier };
}

function requireMap(pack: Pack, mapId: string): GameMap {
  const map = pack.maps.get(mapId);
  if (!map) throw new Error(`Unknown map "${mapId}"`);
  return map;
}

/** Slot indexes in battle order: the player's arrangement, then any unlocked slot it left out. */
export function equippedSlots(skillCount: number, level: number, unlockLevels: number[], order?: number[]): number[] {
  const all = Array.from({ length: skillCount }, (_, slot) => slot);
  const arranged = (order ?? all).filter((slot, i, list) => slot >= 0 && slot < skillCount && list.indexOf(slot) === i);
  const withRest = [...arranged, ...all.filter((slot) => !arranged.includes(slot))];
  return withRest.filter((slot) => level >= (unlockLevels[slot] ?? Infinity));
}

export function buildCharacterUnit(pack: Pack, member: TeamMember): BattleUnit {
  const character = pack.characters.get(member.characterId);
  if (!character) throw new Error(`Unknown character "${member.characterId}"`);
  const build = buildAtStars(character, member.stars ?? 1);

  const skills = equippedSlots(
    build.skills.length,
    member.level,
    pack.balance.skills.unlockLevels,
    member.skillOrder,
  ).map((slot) => build.skills[slot]!);

  let item: BattleUnit["item"];
  if (member.item) {
    const def = pack.items.get(member.item.itemId);
    if (!def) throw new Error(`Unknown item "${member.item.itemId}"`);
    item = { effect: def.effect, tier: member.item.tier };
  }

  return {
    kind: "character",
    sourceId: character.id,
    level: member.level,
    element: character.element,
    damageType: character.damageType,
    stats: computeStats(build.baseStats, member.level, member.points ?? {}, pack.balance),
    basicAttack: character.basicAttack,
    skills,
    item,
    passive: { id: character.passive.id, effects: build.passiveEffects },
  };
}

export function buildEnemyUnit(pack: Pack, enemyId: string, level: number): BattleUnit {
  const enemy = pack.enemies.get(enemyId);
  if (!enemy) throw new Error(`Unknown enemy "${enemyId}"`);
  return {
    kind: "enemy",
    sourceId: enemy.id,
    level,
    element: enemy.element,
    damageType: enemy.damageType,
    stats: computeStats(enemy.baseStats, level, {}, pack.balance),
    basicAttack: enemy.basicAttack,
    skills: enemy.skills,
  };
}

/** The boss version of a character: its own base stats and skills, declared in the map or dungeon. */
export function buildBossUnit(
  pack: Pack,
  boss: Pick<Boss, "characterId" | "level" | "baseStats" | "basicAttack" | "skills">,
): BattleUnit {
  const character = pack.characters.get(boss.characterId);
  if (!character) throw new Error(`Unknown boss character "${boss.characterId}"`);
  return {
    kind: "boss",
    sourceId: character.id,
    level: boss.level,
    element: character.element,
    damageType: character.damageType,
    stats: computeStats(boss.baseStats, boss.level, {}, pack.balance),
    basicAttack: boss.basicAttack,
    skills: boss.skills,
  };
}

/** Runs one mini stage: a 1v1 duel against the stage's enemies in order. */
export function runStage(
  pack: Pack,
  mapId: string,
  stageIndex: number,
  team: TeamMember[],
  seed: number,
): BattleResult {
  const map = requireMap(pack, mapId);
  const stage = map.stages[stageIndex];
  if (!stage) throw new Error(`Map "${mapId}" has no stage ${stageIndex + 1}`);
  return simulateBattle({
    mode: "duel",
    players: team.map((member) => buildCharacterUnit(pack, member)),
    enemies: stage.enemies.map(({ enemyId, level }) => buildEnemyUnit(pack, enemyId, level)),
    seed,
    roundLimit: pack.balance.rounds.stage,
    balance: pack.balance,
  });
}

/** Runs the boss fight of a map: the whole team against the boss. */
export function runBoss(pack: Pack, mapId: string, team: TeamMember[], seed: number): BattleResult {
  const map = requireMap(pack, mapId);
  return simulateBattle({
    mode: "boss",
    players: team.map((member) => buildCharacterUnit(pack, member)),
    enemies: [buildBossUnit(pack, map.boss)],
    seed,
    roundLimit: pack.balance.rounds.boss,
    balance: pack.balance,
  });
}

/** Runs a side dungeon: the whole team against a stronger boss, like a boss fight. */
export function runSideDungeon(
  pack: Pack,
  dungeon: SideDungeon,
  team: TeamMember[],
  seed: number,
): BattleResult {
  return simulateBattle({
    mode: "boss",
    players: team.map((member) => buildCharacterUnit(pack, member)),
    enemies: [buildBossUnit(pack, dungeon.boss)],
    seed,
    roundLimit: pack.balance.rounds.sideDungeon,
    balance: pack.balance,
  });
}
