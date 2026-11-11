import type { Pack } from "../content/loader";
import { addResources, mapProgress, stageRewards, type GameState, type Resources } from "./progress";

// Offline rewards: time away pays as if the best cleared stage kept repeating.
// The UI passes the current time; the core never reads the clock.

const HOUR_MS = 3_600_000;

export interface OfflineReward extends Resources {
  /** Time credited, after the cap. */
  elapsedMs: number;
  battles: number;
}

/** The richest stage the player has cleared, or null before the first clear. */
function bestStageReward(state: GameState, pack: Pack): Resources | null {
  let best: Resources | null = null;
  for (const map of pack.maps.values()) {
    const cleared = Math.min(mapProgress(state, map.id).stagesCleared, map.stages.length);
    for (const stage of map.stages.slice(0, cleared)) {
      const reward = stageRewards(pack, stage);
      if (!best || reward.gold > best.gold) best = reward;
    }
  }
  return best;
}

export function computeOfflineReward(state: GameState, pack: Pack, now: number): OfflineReward {
  const none = { gold: 0, food: 0, elapsedMs: 0, battles: 0 };
  if (state.lastSeenAt === null) return none;
  const { maxHours, battlesPerHour, minMinutes } = pack.balance.offline;
  const away = now - state.lastSeenAt;
  if (away < minMinutes * 60_000) return none;
  const elapsedMs = Math.min(away, maxHours * HOUR_MS);
  const perBattle = bestStageReward(state, pack);
  if (!perBattle) return { ...none, elapsedMs };
  const battles = Math.floor((elapsedMs / HOUR_MS) * battlesPerHour);
  return { gold: perBattle.gold * battles, food: perBattle.food * battles, elapsedMs, battles };
}

/** Pays the offline reward and marks the player as here now. */
export function claimOfflineReward(
  state: GameState,
  pack: Pack,
  now: number,
): { state: GameState; reward: OfflineReward } {
  const reward = computeOfflineReward(state, pack, now);
  return { state: { ...addResources(state, reward), lastSeenAt: now }, reward };
}

/** Records that the game is open right now. */
export function markSeen(state: GameState, now: number): GameState {
  return { ...state, lastSeenAt: now };
}
