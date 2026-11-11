import type { Pack } from "../content/loader";
import { STAT_KEYS } from "../content/schema";
import { buildAtStars } from "./characterBuild";
import {
  fail,
  findOwned,
  levelCap,
  ok,
  updateOwned,
  type ActionResult,
  type GameState,
  type Resources,
} from "./progress";
import type { StatPoints } from "./stats";

// Character growth: level ups, allocated stat points, skill order, stars.

/** Gold and food to go from `level` to `level + 1`. */
export function levelUpCost(pack: Pack, level: number): Resources {
  const { gold, food } = pack.balance.economy.levelCost;
  return {
    gold: Math.floor(gold.base * level ** gold.exponent),
    food: Math.floor(food.base * level ** food.exponent),
  };
}

export function levelUp(state: GameState, pack: Pack, characterId: string): ActionResult {
  const owned = findOwned(state, characterId);
  if (!owned) return fail("unknownCharacter");
  if (owned.level >= levelCap(state, pack)) return fail("levelCap");
  const cost = levelUpCost(pack, owned.level);
  if (state.gold < cost.gold) return fail("notEnoughGold");
  if (state.food < cost.food) return fail("notEnoughFood");
  const paid = { ...state, gold: state.gold - cost.gold, food: state.food - cost.food };
  return ok(updateOwned(paid, characterId, (c) => ({ ...c, level: c.level + 1 })));
}

/** Total points a character of this level can allocate. */
export function pointBudget(pack: Pack, level: number): number {
  return pack.balance.stats.pointsPerLevel * level;
}

/** Most points a single stat can take at this level. */
export function pointCapPerStat(pack: Pack, level: number): number {
  return pack.balance.stats.maxPointsPerStatPerLevel * level;
}

export function pointsSpent(points: StatPoints): number {
  return STAT_KEYS.reduce((sum, stat) => sum + (points[stat] ?? 0), 0);
}

export function arePointsValid(pack: Pack, level: number, points: StatPoints): boolean {
  const cap = pointCapPerStat(pack, level);
  for (const stat of STAT_KEYS) {
    const value = points[stat] ?? 0;
    if (!Number.isInteger(value) || value < 0 || value > cap) return false;
  }
  return pointsSpent(points) <= pointBudget(pack, level);
}

/** Replaces the allocation. Resetting is free: pass an empty object. */
export function setPoints(
  state: GameState,
  pack: Pack,
  characterId: string,
  points: StatPoints,
): ActionResult {
  const owned = findOwned(state, characterId);
  if (!owned) return fail("unknownCharacter");
  if (!arePointsValid(pack, owned.level, points)) return fail("invalidPoints");
  return ok(updateOwned(state, characterId, (c) => ({ ...c, points: { ...points } })));
}

/** Sets the skill slot order. It must list each slot of the character at most once. */
export function setSkillOrder(
  state: GameState,
  pack: Pack,
  characterId: string,
  order: number[],
): ActionResult {
  const owned = findOwned(state, characterId);
  const character = pack.characters.get(characterId);
  if (!owned || !character) return fail("unknownCharacter");
  const valid =
    order.every((slot) => Number.isInteger(slot) && slot >= 0 && slot < character.skills.length) &&
    new Set(order).size === order.length;
  if (!valid) return fail("invalidSkillOrder");
  return ok(updateOwned(state, characterId, (c) => ({ ...c, skillOrder: [...order] })));
}

export type StarStatus =
  | { kind: "max" }
  | { kind: "locked"; requiresBossOf: string; cost: number }
  | { kind: "ready"; cost: number };

/** What the next star level needs. */
export function nextStarStatus(state: GameState, pack: Pack, characterId: string): StarStatus | null {
  const owned = findOwned(state, characterId);
  const character = pack.characters.get(characterId);
  if (!owned || !character) return null;
  const next = character.stars[owned.stars - 1];
  if (!next) return { kind: "max" };
  const cost = pack.balance.stars.materialCost[owned.stars - 1] ?? Infinity;
  const milestoneMet = state.maps[next.requiresBossOf]?.bossDefeated === true;
  return milestoneMet ? { kind: "ready", cost } : { kind: "locked", requiresBossOf: next.requiresBossOf, cost };
}

/** Raises the star level: needs the story milestone (a boss defeated) and enough star material. */
export function starUp(state: GameState, pack: Pack, characterId: string): ActionResult {
  const status = nextStarStatus(state, pack, characterId);
  if (!status) return fail("unknownCharacter");
  if (status.kind === "max") return fail("maxStars");
  if (status.kind === "locked") return fail("milestoneLocked");
  if (state.starMaterial < status.cost) return fail("notEnoughMaterial");
  const paid = { ...state, starMaterial: state.starMaterial - status.cost };
  return ok(updateOwned(paid, characterId, (c) => ({ ...c, stars: c.stars + 1 })));
}

/** The character's current skills (after star overrides), for the skill order screen. */
export function currentSkills(state: GameState, pack: Pack, characterId: string) {
  const owned = findOwned(state, characterId);
  const character = pack.characters.get(characterId);
  if (!owned || !character) return [];
  return buildAtStars(character, owned.stars).skills;
}
