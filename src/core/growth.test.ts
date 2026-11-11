import { describe, expect, it } from "vitest";
import { buildAtStars } from "./characterBuild";
import { canEnterDungeon, dungeonAttemptsLeft, recordDungeonResult } from "./dungeons";
import { buildCharacterUnit, equippedSlots } from "./encounters";
import {
  levelUp,
  levelUpCost,
  nextStarStatus,
  pointBudget,
  setPoints,
  setSkillOrder,
  starUp,
} from "./growth";
import { decomposeItem, equipItem, exchangeDust, exchangeableItems, wearerOf } from "./inventory";
import { claimOfflineReward, computeOfflineReward } from "./offline";
import {
  createNewGame,
  levelCap,
  newOwnedCharacter,
  recordBossVictory,
  recordStageResult,
  stageRewards,
  teamMembers,
  type GameState,
} from "./progress";
import { pack } from "./testUtils";

const MAP = "training-grounds";
const STARTER = "earth-cube";

function rich(overrides: Partial<GameState> = {}): GameState {
  return { ...createNewGame(pack, 1), gold: 1_000_000, food: 1_000_000, ...overrides };
}

function bossBeaten(state: GameState): GameState {
  return { ...state, maps: { [MAP]: { stagesCleared: 10, bossDefeated: true } } };
}

function expectOk(result: ReturnType<typeof levelUp>): GameState {
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.state;
}

describe("stage and boss rewards", () => {
  it("pays gold and food for every stage win, including replays", () => {
    const stage = pack.maps.get(MAP)!.stages[0]!;
    const reward = stageRewards(pack, stage);
    expect(reward).toEqual({ gold: 5, food: 3 }); // one level-1 enemy
    let state = createNewGame(pack, 1);
    state = recordStageResult(state, pack, MAP, 0, { winner: "player" });
    state = recordStageResult(state, pack, MAP, 0, { winner: "player" });
    state = recordStageResult(state, pack, MAP, 0, { winner: "enemy" });
    expect(state.gold).toBe(10);
    expect(state.food).toBe(6);
  });

  it("pays boss level × multiplier on a boss win", () => {
    const { state, rewards } = recordBossVictory(createNewGame(pack, 1), pack, MAP, 1);
    // level 3 × 5 gold × 10
    expect(rewards.resources).toEqual({ gold: 150, food: 90 });
    expect(state.gold).toBe(150);
  });
});

describe("level up", () => {
  it("costs gold and food on a curve", () => {
    expect(levelUpCost(pack, 1)).toEqual({ gold: 20, food: 10 });
    expect(levelUpCost(pack, 10).gold).toBe(Math.floor(20 * 10 ** 1.6));
  });

  it("spends resources and raises the level", () => {
    const state = expectOk(levelUp(rich(), pack, STARTER));
    expect(state.roster[0]?.level).toBe(2);
    expect(state.gold).toBe(1_000_000 - 20);
  });

  it("fails without enough gold or food", () => {
    expect(levelUp(createNewGame(pack, 1), pack, STARTER)).toEqual({ ok: false, reason: "notEnoughGold" });
    expect(levelUp(rich({ food: 0 }), pack, STARTER)).toEqual({ ok: false, reason: "notEnoughFood" });
  });

  it("stops at the level cap of the furthest world reached", () => {
    expect(levelCap(createNewGame(pack, 1), pack)).toBe(30);
    const capped = rich({ roster: [newOwnedCharacter(STARTER, 30)] });
    expect(levelUp(capped, pack, STARTER)).toEqual({ ok: false, reason: "levelCap" });
  });
});

describe("stat points", () => {
  const at10 = rich({ roster: [newOwnedCharacter(STARTER, 10)] });

  it("allows level × 3 points with at most level points per stat", () => {
    expect(pointBudget(pack, 10)).toBe(30);
    const state = expectOk(setPoints(at10, pack, STARTER, { atk: 10, hp: 10, spe: 10 }));
    expect(state.roster[0]?.points).toEqual({ atk: 10, hp: 10, spe: 10 });
  });

  it("rejects too many points in total or in one stat, and negative or fractional points", () => {
    expect(setPoints(at10, pack, STARTER, { atk: 11 }).ok).toBe(false);
    expect(setPoints(at10, pack, STARTER, { atk: 10, def: 10, spa: 10, spd: 1 }).ok).toBe(false);
    expect(setPoints(at10, pack, STARTER, { atk: -1 }).ok).toBe(false);
    expect(setPoints(at10, pack, STARTER, { atk: 1.5 }).ok).toBe(false);
  });

  it("raises battle stats: 0.5 per point, 1 per HP point", () => {
    const state = expectOk(setPoints(at10, pack, STARTER, { atk: 10, hp: 10 }));
    const plain = buildCharacterUnit(pack, teamMembers(at10)[0]!);
    const boosted = buildCharacterUnit(pack, teamMembers(state)[0]!);
    expect(boosted.stats.atk - plain.stats.atk).toBe(5);
    expect(boosted.stats.hp - plain.stats.hp).toBe(10);
  });

  it("resets for free", () => {
    const spent = expectOk(setPoints(at10, pack, STARTER, { atk: 10 }));
    const reset = expectOk(setPoints(spent, pack, STARTER, {}));
    expect(reset.roster[0]?.points).toEqual({});
    expect(reset.gold).toBe(spent.gold);
  });
});

describe("skill order", () => {
  it("stores a valid order and rejects duplicates or unknown slots", () => {
    const state = expectOk(setSkillOrder(rich(), pack, STARTER, [2, 0, 1]));
    expect(state.roster[0]?.skillOrder).toEqual([2, 0, 1]);
    expect(setSkillOrder(rich(), pack, STARTER, [0, 0]).ok).toBe(false);
    expect(setSkillOrder(rich(), pack, STARTER, [7]).ok).toBe(false);
  });

  it("uses the arranged order, appends unlisted slots and drops locked ones", () => {
    // Unlocks at 1, 20, 30, 50.
    expect(equippedSlots(4, 35, [1, 20, 30, 50], [2, 0])).toEqual([2, 0, 1]);
    expect(equippedSlots(4, 1, [1, 20, 30, 50], [2, 1, 0])).toEqual([0]);
  });
});

describe("items and dust", () => {
  const withItems = (): GameState =>
    rich({
      roster: [newOwnedCharacter(STARTER, 1), newOwnedCharacter("water-sphere", 3)],
      items: [
        { uid: 1, itemId: "sphere-shard", tier: "epic" },
        { uid: 2, itemId: "cube-core", tier: "common" },
      ],
      nextItemUid: 3,
    });

  it("equips an item and moves it off its previous wearer", () => {
    let state = expectOk(equipItem(withItems(), STARTER, 1));
    expect(wearerOf(state, 1)).toBe(STARTER);
    state = expectOk(equipItem(state, "water-sphere", 1));
    expect(wearerOf(state, 1)).toBe("water-sphere");
    expect(state.roster[0]?.itemUid).toBeNull();
  });

  it("passes the equipped item into battle", () => {
    const state = expectOk(equipItem(withItems(), STARTER, 2));
    expect(teamMembers(state)[0]?.item).toEqual({ itemId: "cube-core", tier: "common" });
    expect(buildCharacterUnit(pack, teamMembers(state)[0]!).item?.tier).toBe("common");
  });

  it("decomposes into dust by tier and unequips first", () => {
    const equipped = expectOk(equipItem(withItems(), STARTER, 1));
    const state = expectOk(decomposeItem(equipped, pack, 1));
    expect(state.dust).toBe(5); // epic
    expect(state.items.map((i) => i.uid)).toEqual([2]);
    expect(state.roster[0]?.itemUid).toBeNull();
  });

  it("trades 50 dust for a legendary boss item of the player's choice", () => {
    expect(exchangeableItems(pack)).toEqual(["sphere-shard"]);
    const state = expectOk(exchangeDust(rich({ dust: 55 }), pack, "sphere-shard"));
    expect(state.dust).toBe(5);
    expect(state.items.at(-1)).toEqual({ uid: 1, itemId: "sphere-shard", tier: "legendary" });
    expect(exchangeDust(rich({ dust: 49 }), pack, "sphere-shard")).toEqual({ ok: false, reason: "notEnoughDust" });
    // The starter's item never drops, so it cannot be bought either.
    expect(exchangeDust(rich({ dust: 99 }), pack, "cube-core")).toEqual({ ok: false, reason: "notExchangeable" });
  });
});

describe("stars", () => {
  it("needs the story milestone, then star material", () => {
    expect(nextStarStatus(rich(), pack, STARTER)).toEqual({
      kind: "locked",
      requiresBossOf: MAP,
      cost: 10,
    });
    expect(starUp(rich({ starMaterial: 99 }), pack, STARTER)).toEqual({ ok: false, reason: "milestoneLocked" });
    expect(starUp(bossBeaten(rich({ starMaterial: 9 })), pack, STARTER)).toEqual({
      ok: false,
      reason: "notEnoughMaterial",
    });
    const state = expectOk(starUp(bossBeaten(rich({ starMaterial: 12 })), pack, STARTER));
    expect(state.roster[0]?.stars).toBe(2);
    expect(state.starMaterial).toBe(2);
    expect(starUp(state, pack, STARTER)).toEqual({ ok: false, reason: "maxStars" });
  });

  it("applies stat bonuses and skill overrides at the new star level", () => {
    const character = pack.characters.get(STARTER)!;
    const one = buildAtStars(character, 1);
    const two = buildAtStars(character, 2);
    expect(two.baseStats.atk - one.baseStats.atk).toBe(5);
    expect(one.skills[0]?.id).toBe("earth-cube-s1");
    expect(two.skills[0]?.id).toBe("earth-cube-s1-star2");
    expect(two.maxStars).toBe(2);

    const member = { characterId: STARTER, level: 1, stars: 2 };
    expect(buildCharacterUnit(pack, member).skills[0]?.id).toBe("earth-cube-s1-star2");
  });
});

describe("side dungeons", () => {
  const DUNGEON = "sphere-trial";
  const DAY = "2026-11-11";

  it("opens after its map's boss and allows 3 wins a day", () => {
    expect(canEnterDungeon(rich(), pack, DUNGEON, DAY)).toEqual({ ok: false, reason: "dungeonLocked" });
    let state = bossBeaten(rich());
    expect(dungeonAttemptsLeft(state, pack, DAY)).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(canEnterDungeon(state, pack, DUNGEON, DAY).ok).toBe(true);
      state = recordDungeonResult(state, pack, DUNGEON, DAY, { winner: "player" }).state;
    }
    expect(state.starMaterial).toBe(15);
    expect(canEnterDungeon(state, pack, DUNGEON, DAY)).toEqual({ ok: false, reason: "noAttemptsLeft" });
    // A new day resets the allowance.
    expect(dungeonAttemptsLeft(state, pack, "2026-11-12")).toBe(3);
  });

  it("does not use an attempt on a loss", () => {
    const state = recordDungeonResult(bossBeaten(rich()), pack, DUNGEON, DAY, { winner: "enemy" }).state;
    expect(dungeonAttemptsLeft(state, pack, DAY)).toBe(3);
    expect(state.starMaterial).toBe(0);
  });
});

describe("offline rewards", () => {
  const HOUR = 3_600_000;
  const cleared = (n: number): GameState => ({
    ...createNewGame(pack, 1),
    maps: { [MAP]: { stagesCleared: n, bossDefeated: false } },
    lastSeenAt: 0,
  });

  it("pays nothing on the first visit or before any clear", () => {
    expect(computeOfflineReward(createNewGame(pack, 1), pack, HOUR).gold).toBe(0);
    expect(computeOfflineReward(cleared(0), pack, HOUR).gold).toBe(0);
  });

  it("pays the best cleared stage per battle, for battles per hour away", () => {
    const state = cleared(10);
    const best = stageRewards(pack, pack.maps.get(MAP)!.stages[9]!);
    const reward = computeOfflineReward(state, pack, 2 * HOUR);
    expect(reward.battles).toBe(240);
    expect(reward.gold).toBe(best.gold * 240);
  });

  it("caps at 8 hours and ignores very short absences", () => {
    expect(computeOfflineReward(cleared(1), pack, 100 * HOUR).elapsedMs).toBe(8 * HOUR);
    expect(computeOfflineReward(cleared(1), pack, 30_000).gold).toBe(0);
  });

  it("claiming pays out and resets the clock", () => {
    const { state, reward } = claimOfflineReward(cleared(1), pack, HOUR);
    expect(state.gold).toBe(reward.gold);
    expect(state.lastSeenAt).toBe(HOUR);
    expect(computeOfflineReward(state, pack, HOUR).gold).toBe(0);
  });
});
