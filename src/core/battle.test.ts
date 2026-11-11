import { describe, expect, it } from "vitest";
import { simulateBattle, type BattleEvent, type BattleInput } from "./battle";
import { runBoss, runStage, type TeamMember } from "./encounters";
import { exactBalance, pack, skill, unit } from "./testUtils";

function damageEvents(log: BattleEvent[]) {
  return log.filter((e): e is Extract<BattleEvent, { type: "damage" }> => e.type === "damage");
}

function battle(overrides: Partial<BattleInput>) {
  return simulateBattle({
    mode: "duel",
    players: [unit()],
    enemies: [unit()],
    seed: 1,
    roundLimit: 100,
    balance: exactBalance,
    ...overrides,
  });
}

describe("determinism", () => {
  const team: TeamMember[] = [{ characterId: "earth-cube", level: 5 }];

  it("gives the same log for the same seed", () => {
    expect(runStage(pack, "training-grounds", 9, team, 123)).toEqual(
      runStage(pack, "training-grounds", 9, team, 123),
    );
    expect(runBoss(pack, "training-grounds", team, 9)).toEqual(
      runBoss(pack, "training-grounds", team, 9),
    );
  });

  it("varies with the seed", () => {
    // A close fight, so rolls and crits change HP totals instead of being lost to overkill.
    const close: TeamMember[] = [{ characterId: "earth-cube", level: 3 }];
    const logs = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        JSON.stringify(runStage(pack, "training-grounds", 9, close, seed).log),
      ),
    );
    expect(logs.size).toBeGreaterThan(1);
  });
});

describe("duel (mini stage)", () => {
  it("sends enemies in one at a time, in order", () => {
    const result = battle({
      players: [unit({ stats: { hp: 500, atk: 200, def: 30, spa: 30, spd: 30, spe: 50 } })],
      enemies: [unit(), unit(), unit()],
    });
    expect(result.winner).toBe("player");
    const entered = result.log.filter((e) => e.type === "enter").map((e) => e.unit);
    expect(entered).toEqual([0, 1, 2, 3]);
    const defeated = result.log.filter((e) => e.type === "defeated").map((e) => e.unit);
    expect(defeated).toEqual([1, 2, 3]);
  });

  it("keeps the player's HP from one enemy to the next", () => {
    const result = battle({
      players: [unit({ stats: { hp: 500, atk: 200, def: 30, spa: 30, spd: 30, spe: 50 } })],
      enemies: [unit(), unit()],
    });
    const hits = damageEvents(result.log).filter((e) => e.target === 0);
    const hpTrail = hits.map((e) => e.hpAfter);
    expect(hpTrail).toEqual([...hpTrail].sort((a, b) => b - a));
    expect(result.finalHp[0]).toBe(hpTrail.at(-1) ?? 500);
  });

  it("brings in the next team member when one falls", () => {
    const result = battle({
      players: [unit({ stats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 } }), unit()],
      enemies: [unit({ stats: { hp: 100, atk: 30, def: 30, spa: 30, spd: 30, spe: 99 } })],
    });
    const enters = result.log.filter((e) => e.type === "enter").map((e) => e.unit);
    expect(enters).toEqual([0, 2, 1]);
  });

  it("lets the faster unit act first", () => {
    const result = battle({
      players: [unit({ stats: { hp: 100, atk: 30, def: 30, spa: 30, spd: 30, spe: 10 } })],
      enemies: [unit({ stats: { hp: 100, atk: 30, def: 30, spa: 30, spd: 30, spe: 90 } })],
    });
    const firstAction = result.log.find((e) => e.type === "action");
    expect(firstAction).toMatchObject({ actor: 1 });
  });

  it("ends with no winner at the round limit", () => {
    const wall = { hp: 9999, atk: 1, def: 999, spa: 1, spd: 999, spe: 1 };
    const result = battle({
      players: [unit({ stats: wall })],
      enemies: [unit({ stats: wall })],
      roundLimit: 3,
    });
    expect(result.winner).toBeNull();
    expect(result.rounds).toBe(3);
    expect(result.log.at(-1)).toEqual({ type: "battleEnd", winner: null, rounds: 3 });
  });
});

describe("boss fight", () => {
  it("fields the whole team and has the boss hit the first living member", () => {
    const boss = unit({
      kind: "boss",
      stats: { hp: 2000, atk: 60, def: 30, spa: 30, spd: 30, spe: 99 },
    });
    const result = simulateBattle({
      mode: "boss",
      players: [unit(), unit(), unit()],
      enemies: [boss],
      seed: 5,
      roundLimit: 30,
      balance: exactBalance,
    });
    const bossHits = damageEvents(result.log).filter((e) => e.actor === 3);
    const firstDeath = result.log.findIndex((e) => e.type === "defeated" && e.unit === 0);
    expect(firstDeath).toBeGreaterThan(0);
    // Before member 0 falls, every boss hit lands on member 0; afterwards on member 1.
    for (const event of bossHits) {
      const index = result.log.indexOf(event);
      expect(event.target).toBe(index < firstDeath ? 0 : event.target);
      if (index > firstDeath) expect(event.target).not.toBe(0);
    }
    // All three players act in round 1.
    const round1 = result.log.slice(0, result.log.findIndex((e) => e.type === "roundStart" && e.round === 2));
    const actors = new Set(round1.filter((e) => e.type === "action").map((e) => e.actor));
    expect(actors).toEqual(new Set([0, 1, 2, 3]));
  });

  it("hits every team member with an all-enemies skill at reduced power", () => {
    const wave = skill({
      id: "wave",
      power: 60,
      target: "allEnemies",
      usage: { kind: "oncePerBattle" },
    });
    const boss = unit({
      kind: "boss",
      stats: { hp: 2000, atk: 60, def: 30, spa: 30, spd: 30, spe: 99 },
      skills: [wave],
    });
    const result = simulateBattle({
      mode: "boss",
      players: [unit(), unit()],
      enemies: [boss],
      seed: 1,
      roundLimit: 1,
      balance: exactBalance,
    });
    const waveHits = damageEvents(result.log).filter((e) => e.skillId === "wave");
    expect(waveHits.map((e) => e.target)).toEqual([0, 1]);
    // Level 10, power 60, A 60, D 30: (6 × 60 × 60 / 30 / 50 + 2) × STAB 1.5 × spread 0.75 = 18.45.
    expect(waveHits[0]?.amount).toBe(18);
  });
});

describe("damage modifiers in battle", () => {
  function firstHit(attacker: Parameters<typeof unit>[0], defender: Parameters<typeof unit>[0]) {
    const result = battle({
      players: [unit({ ...attacker, stats: { hp: 100, atk: 60, def: 30, spa: 30, spd: 30, spe: 99 } })],
      enemies: [unit(defender)],
      roundLimit: 1,
    });
    return damageEvents(result.log).find((e) => e.actor === 0);
  }

  it("applies the element chart and STAB", () => {
    // metal attacker on a wood defender: 2×, and STAB since the basic attack is metal.
    const hit = firstHit({ element: "metal" }, { element: "wood" });
    expect(hit?.effectiveness).toBe(2);
    // (6 × 40 × 60 / 30 / 50 + 2) = 11.6 × 1.5 × 2 = 34.8
    expect(hit?.amount).toBe(34);
  });

  it("uses magic defense for magic attackers", () => {
    const hit = firstHit(
      { damageType: "magic", basicAttack: skill({ id: "basic", scaling: [{ stat: "atk", weight: 1 }] }) },
      { stats: { hp: 100, atk: 30, def: 30, spa: 30, spd: 60, spe: 1 } },
    );
    // D = 60: (6 × 40 × 60 / 60 / 50 + 2) = 6.8 × 1.5 = 10.2
    expect(hit?.amount).toBe(10);
  });

  it("adds item bonuses only when the condition matches", () => {
    const effect = {
      kind: "damageBonus" as const,
      condition: { element: "metal" as const, damageType: "physical" as const },
      valueByTier: { common: 0.05, rare: 0.1, epic: 0.2, legendary: 0.3 },
    };
    const withItem = firstHit({ item: { effect, tier: "legendary" } }, {});
    const without = firstHit({}, {});
    // A fire attacker's skills are fire, so the metal-only bonus does not apply (earth target: neutral).
    const mismatch = firstHit({ item: { effect, tier: "legendary" }, element: "fire" }, { element: "earth" });
    // 11.6 × 1.5 = 17.4 → 17; × 1.3 = 22.62 → 22
    expect(without?.amount).toBe(17);
    expect(withItem?.amount).toBe(22);
    expect(mismatch?.amount).toBe(17);
  });
});

describe("placeholder content", () => {
  it("lets the starter clear the first stage at level 3", () => {
    const team: TeamMember[] = [{ characterId: "earth-cube", level: 3 }];
    const wins = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(
      (seed) => runStage(pack, "training-grounds", 0, team, seed).winner === "player",
    );
    expect(wins.length).toBe(10);
  });

  it("only equips skills unlocked at the member's level", () => {
    const team: TeamMember[] = [{ characterId: "earth-cube", level: 25 }];
    const result = runStage(pack, "training-grounds", 0, team, 1);
    const used = new Set(
      result.log.filter((e) => e.type === "action" && e.actor === 0).map((e) => e.type === "action" && e.skillId),
    );
    expect(used.has("earth-cube-s3")).toBe(false);
  });
});
