import { describe, expect, it } from "vitest";
import type { Pack } from "../content/loader";
import {
  MAX_TEAM_SIZE,
  createNewGame,
  isBossUnlocked,
  isMapUnlocked,
  isStageUnlocked,
  recordBossVictory,
  recordStageResult,
  sanitizeGameState,
  setTeam,
  takeBattleSeed,
  teamMembers,
  type GameState,
} from "./progress";
import { pack } from "./testUtils";

const MAP = "training-grounds";
const STAGES = pack.maps.get(MAP)!.stages.length;

function clearAllStages(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < STAGES; i++) next = recordStageResult(next, MAP, i, { winner: "player" });
  return next;
}

/** A pack copy with a different balance, for forcing recruit and drop outcomes. */
function withBalance(changes: { recruitRate?: number; itemDropChance?: number }): Pack {
  return {
    ...pack,
    balance: {
      ...pack.balance,
      worlds: {
        training: { levelCap: 30, recruitRate: changes.recruitRate ?? 0.2 },
      },
      drops: { ...pack.balance.drops, itemDropChance: changes.itemDropChance ?? 0.5 },
    },
  };
}

describe("new game", () => {
  it("starts with only the starter in the roster and team", () => {
    const state = createNewGame(pack, 42);
    expect(state.roster).toEqual([{ characterId: "earth-cube", level: 1 }]);
    expect(state.team).toEqual(["earth-cube"]);
    expect(teamMembers(state)).toEqual([{ characterId: "earth-cube", level: 1 }]);
  });
});

describe("unlocks", () => {
  it("opens the first map and its first stage only", () => {
    const state = createNewGame(pack, 1);
    expect(isMapUnlocked(state, pack, MAP)).toBe(true);
    expect(isStageUnlocked(state, pack, MAP, 0)).toBe(true);
    expect(isStageUnlocked(state, pack, MAP, 1)).toBe(false);
    expect(isBossUnlocked(state, pack, MAP)).toBe(false);
  });

  it("opens stages in order and the boss after the last stage", () => {
    let state = createNewGame(pack, 1);
    state = recordStageResult(state, MAP, 0, { winner: "player" });
    expect(isStageUnlocked(state, pack, MAP, 1)).toBe(true);
    state = clearAllStages(state);
    expect(isBossUnlocked(state, pack, MAP)).toBe(true);
  });

  it("ignores losses, timeouts and replays of earlier stages", () => {
    let state = createNewGame(pack, 1);
    state = recordStageResult(state, MAP, 0, { winner: "enemy" });
    state = recordStageResult(state, MAP, 0, { winner: null });
    expect(isStageUnlocked(state, pack, MAP, 1)).toBe(false);
    state = recordStageResult(state, MAP, 0, { winner: "player" });
    state = recordStageResult(state, MAP, 0, { winner: "player" });
    expect(state.maps[MAP]?.stagesCleared).toBe(1);
  });
});

describe("battle seeds", () => {
  it("gives a different seed per battle and the same sequence for the same save", () => {
    const a = takeBattleSeed(createNewGame(pack, 7));
    const b = takeBattleSeed(a.state);
    expect(a.seed).not.toBe(b.seed);
    expect(takeBattleSeed(createNewGame(pack, 7)).seed).toBe(a.seed);
    expect(b.state.battleCounter).toBe(2);
  });
});

describe("boss victory", () => {
  it("recruits the boss at its level when the roll succeeds", () => {
    const sure = withBalance({ recruitRate: 1, itemDropChance: 0 });
    const { state, rewards } = recordBossVictory(clearAllStages(createNewGame(sure, 1)), sure, MAP, 3);
    expect(rewards.recruitChance).toBe(1);
    expect(rewards.recruited).toEqual({ characterId: "water-sphere", level: 3 });
    expect(state.roster.map((c) => c.characterId)).toContain("water-sphere");
    expect(state.maps[MAP]?.bossDefeated).toBe(true);
  });

  it("never recruits with a 0% rate and never recruits an owned character twice", () => {
    const never = withBalance({ recruitRate: 0 });
    expect(recordBossVictory(createNewGame(never, 1), never, MAP, 3).rewards.recruited).toBeNull();

    const sure = withBalance({ recruitRate: 1 });
    const first = recordBossVictory(createNewGame(sure, 1), sure, MAP, 3).state;
    const second = recordBossVictory(first, sure, MAP, 4);
    expect(second.rewards.recruitChance).toBeNull();
    expect(second.state.roster.filter((c) => c.characterId === "water-sphere")).toHaveLength(1);
  });

  it("recruits at roughly the configured rate", () => {
    const state = createNewGame(pack, 1);
    let recruits = 0;
    for (let seed = 0; seed < 2000; seed++) {
      if (recordBossVictory(state, pack, MAP, seed).rewards.recruited) recruits += 1;
    }
    expect(recruits / 2000).toBeGreaterThan(0.17);
    expect(recruits / 2000).toBeLessThan(0.23);
  });

  it("drops the boss item with a tier when the roll succeeds", () => {
    const sure = withBalance({ itemDropChance: 1, recruitRate: 0 });
    const { state, rewards } = recordBossVictory(createNewGame(sure, 1), sure, MAP, 5);
    expect(rewards.item?.itemId).toBe("sphere-shard");
    expect(["common", "rare", "epic", "legendary"]).toContain(rewards.item?.tier);
    expect(state.items).toContainEqual(rewards.item);
  });

  it("completes the world once and grants the completion reward", () => {
    const quiet = withBalance({ itemDropChance: 0, recruitRate: 0 });
    const first = recordBossVictory(createNewGame(quiet, 1), quiet, MAP, 1);
    expect(first.rewards.firstClear).toBe(true);
    expect(first.rewards.worldCompleted).toBe("training");
    expect(first.rewards.completionItems).toEqual([
      { uid: 1, itemId: "cube-core", tier: "legendary" },
    ]);

    const again = recordBossVictory(first.state, quiet, MAP, 2);
    expect(again.rewards.firstClear).toBe(false);
    expect(again.rewards.worldCompleted).toBeNull();
    expect(again.state.items).toHaveLength(1);
  });

  it("is deterministic for the same seed", () => {
    const state = createNewGame(pack, 1);
    expect(recordBossVictory(state, pack, MAP, 99)).toEqual(recordBossVictory(state, pack, MAP, 99));
  });
});

describe("team", () => {
  it("keeps owned, unique ids up to the team size", () => {
    const state: GameState = {
      ...createNewGame(pack, 1),
      roster: [
        { characterId: "earth-cube", level: 1 },
        { characterId: "water-sphere", level: 3 },
      ],
    };
    const next = setTeam(state, ["water-sphere", "ghost", "water-sphere", "earth-cube"]);
    expect(next.team).toEqual(["water-sphere", "earth-cube"]);
    expect(setTeam(state, []).team).toEqual(state.team);
    expect(MAX_TEAM_SIZE).toBe(5);
  });
});

describe("sanitize", () => {
  it("drops unknown content and keeps the starter in the team", () => {
    const broken: GameState = {
      ...createNewGame(pack, 1),
      roster: [{ characterId: "removed-hero", level: 9 }],
      team: ["removed-hero"],
      maps: { "removed-map": { stagesCleared: 3, bossDefeated: true } },
      items: [{ uid: 1, itemId: "removed-item", tier: "rare" }],
    };
    const fixed = sanitizeGameState(broken, pack);
    expect(fixed.roster).toEqual([{ characterId: "earth-cube", level: 1 }]);
    expect(fixed.team).toEqual(["earth-cube"]);
    expect(fixed.maps).toEqual({});
    expect(fixed.items).toEqual([]);
  });
});
