import type { Pack } from "../content/loader";
import type { BattleResult } from "./battle";
import { fail, mapProgress, ok, type ActionResult, type GameState } from "./progress";

// Side dungeons: a shared daily allowance of wins, paid in star material.
// The UI passes a calendar day key (e.g. "2026-11-11"); the core never reads the clock.

export function isDungeonUnlocked(state: GameState, pack: Pack, dungeonId: string): boolean {
  const dungeon = pack.sideDungeons.get(dungeonId);
  return dungeon ? mapProgress(state, dungeon.unlockAfterMapId).bossDefeated : false;
}

/** Wins left today across all side dungeons. Only wins use up the allowance. */
export function dungeonAttemptsLeft(state: GameState, pack: Pack, day: string): number {
  const max = pack.balance.sideDungeon.attemptsPerDay;
  const used = state.sideDungeon.day === day ? state.sideDungeon.used : 0;
  return Math.max(0, max - used);
}

/** Checks a fight may start. */
export function canEnterDungeon(state: GameState, pack: Pack, dungeonId: string, day: string): ActionResult {
  if (!isDungeonUnlocked(state, pack, dungeonId)) return fail("dungeonLocked");
  if (dungeonAttemptsLeft(state, pack, day) <= 0) return fail("noAttemptsLeft");
  return ok(state);
}

/** Applies a side dungeon result: a win uses one attempt and pays star material. */
export function recordDungeonResult(
  state: GameState,
  pack: Pack,
  dungeonId: string,
  day: string,
  result: Pick<BattleResult, "winner">,
): { state: GameState; starMaterial: number } {
  const dungeon = pack.sideDungeons.get(dungeonId);
  if (!dungeon || result.winner !== "player") return { state, starMaterial: 0 };
  const used = state.sideDungeon.day === day ? state.sideDungeon.used : 0;
  const reward = dungeon.rewards.starMaterial;
  return {
    state: {
      ...state,
      sideDungeon: { day, used: used + 1 },
      starMaterial: state.starMaterial + reward,
    },
    starMaterial: reward,
  };
}
