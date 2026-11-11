import type { Pack } from "../content/loader";
import { ITEM_TIERS, type GameMap, type ItemTier } from "../content/schema";
import type { BattleResult } from "./battle";
import type { TeamMember } from "./encounters";
import { createRng, type Rng } from "./rng";

// Player progression for the minimal loop: unlocks, stage clears, boss rewards, team.

export const MAX_TEAM_SIZE = 5;

export interface OwnedCharacter {
  characterId: string;
  level: number;
}

export interface OwnedItem {
  uid: number;
  itemId: string;
  tier: ItemTier;
}

export interface MapProgress {
  /** Number of stages cleared, in order. Stage index `stagesCleared` is the next one to beat. */
  stagesCleared: number;
  bossDefeated: boolean;
}

export interface GameState {
  /** Base seed of this save. Battle seeds derive from it and `battleCounter`. */
  seed: number;
  battleCounter: number;
  roster: OwnedCharacter[];
  /** Character ids in battle order. 1 to MAX_TEAM_SIZE entries, all owned. */
  team: string[];
  maps: Record<string, MapProgress>;
  items: OwnedItem[];
  nextItemUid: number;
  completedWorlds: string[];
}

export interface MapEntry {
  worldId: string;
  map: GameMap;
  /** Position across all worlds, in story order. */
  index: number;
  isLastInWorld: boolean;
}

export function createNewGame(pack: Pack, seed: number): GameState {
  const starter = pack.manifest.starterCharacterId;
  return {
    seed: seed >>> 0,
    battleCounter: 0,
    roster: [{ characterId: starter, level: 1 }],
    team: [starter],
    maps: {},
    items: [],
    nextItemUid: 1,
    completedWorlds: [],
  };
}

/** All maps of all worlds in story order. */
export function mapOrder(pack: Pack): MapEntry[] {
  const entries: MapEntry[] = [];
  for (const world of pack.worlds) {
    world.maps.forEach((map, i) => {
      entries.push({
        worldId: world.id,
        map,
        index: entries.length,
        isLastInWorld: i === world.maps.length - 1,
      });
    });
  }
  return entries;
}

function requireEntry(pack: Pack, mapId: string): MapEntry {
  const entry = mapOrder(pack).find((e) => e.map.id === mapId);
  if (!entry) throw new Error(`Unknown map "${mapId}"`);
  return entry;
}

export function mapProgress(state: GameState, mapId: string): MapProgress {
  return state.maps[mapId] ?? { stagesCleared: 0, bossDefeated: false };
}

/** The first map is always open; each later map opens when the previous boss falls for the first time. */
export function isMapUnlocked(state: GameState, pack: Pack, mapId: string): boolean {
  const entry = requireEntry(pack, mapId);
  if (entry.index === 0) return true;
  const previous = mapOrder(pack)[entry.index - 1];
  return previous ? mapProgress(state, previous.map.id).bossDefeated : false;
}

export function isStageUnlocked(
  state: GameState,
  pack: Pack,
  mapId: string,
  stageIndex: number,
): boolean {
  return (
    isMapUnlocked(state, pack, mapId) && stageIndex <= mapProgress(state, mapId).stagesCleared
  );
}

/** The boss opens once every stage of the map is cleared. */
export function isBossUnlocked(state: GameState, pack: Pack, mapId: string): boolean {
  const { map } = requireEntry(pack, mapId);
  return (
    isMapUnlocked(state, pack, mapId) &&
    mapProgress(state, mapId).stagesCleared >= map.stages.length
  );
}

/** Mixes the save seed with the battle counter into a well-spread 32-bit seed. */
function mixSeed(seed: number, counter: number): number {
  let h = (seed ^ Math.imul(counter + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Returns the seed for the next battle and the state with the counter advanced. */
export function takeBattleSeed(state: GameState): { seed: number; state: GameState } {
  return {
    seed: mixSeed(state.seed, state.battleCounter),
    state: { ...state, battleCounter: state.battleCounter + 1 },
  };
}

/** The team as battle input. Characters missing from the roster are skipped. */
export function teamMembers(state: GameState): TeamMember[] {
  return state.team.flatMap((characterId) => {
    const owned = state.roster.find((c) => c.characterId === characterId);
    return owned ? [{ characterId, level: owned.level }] : [];
  });
}

/** Sets the battle order. Ignores unknown or duplicate ids and keeps at most MAX_TEAM_SIZE. */
export function setTeam(state: GameState, characterIds: string[]): GameState {
  const owned = new Set(state.roster.map((c) => c.characterId));
  const team = characterIds
    .filter((id, i) => owned.has(id) && characterIds.indexOf(id) === i)
    .slice(0, MAX_TEAM_SIZE);
  if (team.length === 0) return state;
  return { ...state, team };
}

export function recordStageResult(
  state: GameState,
  mapId: string,
  stageIndex: number,
  result: Pick<BattleResult, "winner">,
): GameState {
  if (result.winner !== "player") return state;
  const progress = mapProgress(state, mapId);
  if (stageIndex !== progress.stagesCleared) return state;
  return {
    ...state,
    maps: { ...state.maps, [mapId]: { ...progress, stagesCleared: progress.stagesCleared + 1 } },
  };
}

export interface BossRewards {
  firstClear: boolean;
  /** The chance that applied, or null when the boss was already owned. */
  recruitChance: number | null;
  recruited: OwnedCharacter | null;
  item: OwnedItem | null;
  /** Set when this victory completed a world for the first time. */
  worldCompleted: string | null;
  completionItems: OwnedItem[];
}

function rollTier(rng: Rng, weights: Record<ItemTier, number>): ItemTier {
  const total = ITEM_TIERS.reduce((sum, tier) => sum + weights[tier], 0);
  let roll = rng.next() * total;
  for (const tier of ITEM_TIERS) {
    roll -= weights[tier];
    if (roll < 0) return tier;
  }
  return "common";
}

/**
 * Applies a boss victory: recruit roll, item drop, map and world completion.
 * Recruited characters join at the boss's level, capped by the world's level cap.
 */
export function recordBossVictory(
  state: GameState,
  pack: Pack,
  mapId: string,
  seed: number,
): { state: GameState; rewards: BossRewards } {
  const entry = requireEntry(pack, mapId);
  const { boss } = entry.map;
  const worldBalance = pack.balance.worlds[entry.worldId];
  const rng = createRng(seed);
  const progress = mapProgress(state, mapId);
  const firstClear = !progress.bossDefeated;

  let next: GameState = {
    ...state,
    maps: { ...state.maps, [mapId]: { ...progress, bossDefeated: true } },
  };
  let nextItemUid = state.nextItemUid;

  const alreadyOwned = state.roster.some((c) => c.characterId === boss.characterId);
  const recruitChance = alreadyOwned ? null : (boss.recruitRate ?? worldBalance?.recruitRate ?? 0);
  let recruited: OwnedCharacter | null = null;
  if (recruitChance !== null && rng.chance(recruitChance)) {
    const level = Math.min(boss.level, worldBalance?.levelCap ?? boss.level);
    recruited = { characterId: boss.characterId, level };
    next = { ...next, roster: [...next.roster, recruited] };
  }

  let item: OwnedItem | null = null;
  const { drops } = pack.balance;
  if (boss.dropItemId && rng.chance(drops.itemDropChance)) {
    item = { uid: nextItemUid++, itemId: boss.dropItemId, tier: rollTier(rng, drops.tierWeights) };
    next = { ...next, items: [...next.items, item] };
  }

  let worldCompleted: string | null = null;
  const completionItems: OwnedItem[] = [];
  if (entry.isLastInWorld && !state.completedWorlds.includes(entry.worldId)) {
    worldCompleted = entry.worldId;
    for (const reward of pack.manifest.worldCompletionRewards) {
      if (reward.worldId !== entry.worldId) continue;
      completionItems.push({ uid: nextItemUid++, itemId: reward.itemId, tier: reward.tier });
    }
    next = {
      ...next,
      completedWorlds: [...next.completedWorlds, entry.worldId],
      items: [...next.items, ...completionItems],
    };
  }

  next = { ...next, nextItemUid };
  return {
    state: next,
    rewards: { firstClear, recruitChance, recruited, item, worldCompleted, completionItems },
  };
}

/**
 * Drops anything the pack no longer knows (removed characters, maps or items) and repairs the
 * invariants: the starter is owned and the team is not empty.
 */
export function sanitizeGameState(state: GameState, pack: Pack): GameState {
  const roster = state.roster.filter(
    (c, i) =>
      pack.characters.has(c.characterId) &&
      state.roster.findIndex((o) => o.characterId === c.characterId) === i,
  );
  const starter = pack.manifest.starterCharacterId;
  if (!roster.some((c) => c.characterId === starter)) {
    roster.unshift({ characterId: starter, level: 1 });
  }
  const maps = Object.fromEntries(
    Object.entries(state.maps).filter(([mapId]) => pack.maps.has(mapId)),
  );
  const items = state.items.filter((item) => pack.items.has(item.itemId));
  const next: GameState = { ...state, roster, maps, items };
  const withTeam = setTeam(next, state.team);
  return withTeam.team.length > 0 && withTeam.team.every((id) => roster.some((c) => c.characterId === id))
    ? withTeam
    : { ...next, team: [starter] };
}
