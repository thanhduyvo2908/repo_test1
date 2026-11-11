import { describe, expect, it } from "vitest";
import type { SkillEffect, StatusSpec } from "../content/schema";
import { simulateBattle, type BattleEvent, type BattleInput, type BattleUnit } from "./battle";
import { exactBalance, skill, unit } from "./testUtils";

type EventOf<T extends BattleEvent["type"]> = Extract<BattleEvent, { type: T }>;
function events<T extends BattleEvent["type"]>(log: BattleEvent[], type: T): EventOf<T>[] {
  return log.filter((e): e is EventOf<T> => e.type === type);
}

const tough = { hp: 500, atk: 30, def: 30, spa: 30, spd: 30, spe: 30 };
const fast = { ...tough, spe: 99 };
const slow = { ...tough, spe: 1 };

function battle(overrides: Partial<BattleInput>) {
  return simulateBattle({
    mode: "duel",
    players: [unit({ stats: fast })],
    enemies: [unit({ stats: slow })],
    seed: 1,
    roundLimit: 4,
    balance: exactBalance,
    ...overrides,
  });
}

function status(spec: StatusSpec, duration: number | null, extra: Partial<SkillEffect> = {}): SkillEffect {
  return { kind: "status", status: spec, target: "targets", chance: 1, duration, ...extra } as SkillEffect;
}

/** A unit whose opening skill applies the given effects, then falls back to a basic attack. */
function caster(effects: SkillEffect[], overrides: Partial<BattleUnit> = {}, power = 0, target: "enemy" | "self" = "enemy") {
  return unit({
    stats: fast,
    skills: [skill({ id: "cast", power, target, usage: { kind: "oncePerBattle" }, effects })],
    ...overrides,
  });
}

describe("control", () => {
  it("stun makes the target lose its next turn, then wears off", () => {
    const result = battle({ players: [caster([status({ kind: "stun" }, 1)])] });
    const skipped = events(result.log, "turnSkipped");
    expect(skipped).toEqual([{ type: "turnSkipped", unit: 1, reason: "stun" }]);
    // The enemy acts normally from round 2.
    expect(events(result.log, "action").filter((e) => e.actor === 1)).toHaveLength(3);
  });

  it("sleep ends early when the sleeper is hit", () => {
    const sleeper = caster([status({ kind: "sleep" }, 3)], {}, 0);
    // Round 1: sleep. Rounds 2+: the basic attack hits and wakes the target.
    const result = battle({ players: [sleeper] });
    expect(events(result.log, "turnSkipped").map((e) => e.reason)).toEqual(["sleep"]);
    expect(events(result.log, "statusExpired")).toHaveLength(1);
  });

  it("silence forces the basic attack without spending the opening", () => {
    const silencer = caster([status({ kind: "silence" }, 1)]);
    const victim = unit({
      stats: slow,
      skills: [skill({ id: "big", power: 80, usage: { kind: "oncePerBattle" } })],
    });
    const result = battle({ players: [silencer], enemies: [victim] });
    const victimActions = events(result.log, "action").filter((e) => e.actor === 1).map((e) => e.skillId);
    expect(victimActions.slice(0, 2)).toEqual(["basic", "big"]);
  });

  it("immunity blocks negative statuses", () => {
    const guarded = unit({
      stats: slow,
      passive: {
        id: "guard",
        effects: [{ trigger: "battleStart", effect: status({ kind: "immunity" }, null, { target: "self" }) }],
      },
    });
    const result = battle({ players: [caster([status({ kind: "stun" }, 1)])], enemies: [guarded] });
    expect(events(result.log, "statusResisted")).toHaveLength(1);
    expect(events(result.log, "turnSkipped")).toHaveLength(0);
  });
});

describe("damage over time and regeneration", () => {
  it("poison takes a share of max HP at the end of each of the holder's turns", () => {
    const result = battle({
      players: [caster([status({ kind: "dot", type: "poison", percentMaxHp: 0.1 }, 2)])],
    });
    const dots = events(result.log, "dot");
    expect(dots.map((d) => d.amount)).toEqual([50, 50]);
  });

  it("can defeat a unit and bring in the next one", () => {
    const frail = unit({ stats: { ...slow, hp: 10 } });
    const result = battle({
      players: [caster([status({ kind: "dot", type: "burn", percentMaxHp: 1 }, 1)])],
      enemies: [frail, unit({ stats: slow })],
    });
    const defeatedIndex = result.log.findIndex((e) => e.type === "defeated" && e.unit === 1);
    expect(result.log[defeatedIndex - 1]?.type).toBe("dot");
    expect(result.log[defeatedIndex + 1]).toEqual({ type: "enter", unit: 2 });
  });

  it("regen heals at the end of the holder's turns, capped at max HP", () => {
    const hitter = unit({ stats: { ...fast, atk: 200 } });
    const regen = unit({
      stats: slow,
      skills: [
        skill({
          id: "regen",
          power: 0,
          target: "self",
          usage: { kind: "oncePerBattle" },
          effects: [status({ kind: "regen", percentMaxHp: 0.05 }, 3)],
        }),
      ],
    });
    const result = battle({ players: [hitter], enemies: [regen] });
    const heals = events(result.log, "heal").filter((h) => h.unit === 1);
    expect(heals.length).toBeGreaterThan(0);
    expect(heals.every((h) => h.amount === 25)).toBe(true);
  });
});

describe("stat stages", () => {
  it("raises damage with +1 attack (×1.5) and lowers it with -1 (÷1.5)", () => {
    const base = battle({ players: [unit({ stats: fast })] });
    const buffed = battle({
      players: [caster([status({ kind: "statStage", stat: "atk", stages: 1 }, 3)], {}, 0, "self")],
    });
    const firstHit = (log: BattleEvent[]) => events(log, "damage").find((d) => d.actor === 0)?.amount;
    // Unbuffed: (6 × 40 × 30 / 30 / 50 + 2) × 1.5 STAB = 10.2 → 10. Buffed A = 45: (7.2 + 2) × 1.5 = 13.8 → 13.
    expect(firstHit(base.log)).toBe(10);
    expect(firstHit(buffed.log)).toBe(13);
  });

  it("changes turn order from the next round", () => {
    const slower = caster([status({ kind: "statStage", stat: "spe", stages: -2 }, 3, { target: "self" })]);
    const rival = unit({ stats: { ...tough, spe: 60 } });
    const result = battle({ players: [slower], enemies: [rival] });
    const firstActors = (round: number) => {
      const start = result.log.findIndex((e) => e.type === "roundStart" && e.round === round);
      return result.log.slice(start).find((e) => e.type === "action" || e.type === "turnSkipped");
    };
    expect(firstActors(1)).toMatchObject({ actor: 0 });
    // spe 99 at -2 stages = 49.5 < 60
    expect(firstActors(2)).toMatchObject({ actor: 1 });
  });
});

describe("protection", () => {
  it("a shield soaks damage before HP and breaks when emptied", () => {
    const shielded = unit({
      stats: fast,
      skills: [
        skill({
          id: "shield",
          power: 0,
          target: "self",
          usage: { kind: "oncePerBattle" },
          effects: [status({ kind: "shield", amount: { stat: "hp", ratio: 0.03, of: "caster" } }, 3)],
        }),
      ],
    });
    const result = battle({ players: [shielded], enemies: [unit({ stats: slow })] });
    const applied = events(result.log, "statusApplied")[0];
    expect(applied?.shield).toBe(15);
    const hits = events(result.log, "damage").filter((d) => d.target === 0);
    // The enemy deals 10 per hit: the first goes fully into the 15-point shield, the second splits.
    expect(hits[0]).toMatchObject({ amount: 0, absorbed: 10, hpAfter: 500 });
    expect(hits[1]).toMatchObject({ amount: 5, absorbed: 5, hpAfter: 495 });
    // The breaking hit is logged before the shield expires.
    const breakIndex = result.log.indexOf(hits[1]!);
    expect(result.log[breakIndex + 1]).toMatchObject({ type: "statusExpired", unit: 0 });
  });

  it("damage reduction cuts matching damage", () => {
    const reducer = unit({
      stats: slow,
      passive: {
        id: "rubber",
        effects: [
          {
            trigger: "battleStart",
            effect: status({ kind: "damageReduction", damageType: "physical", ratio: 0.5 }, null, {
              target: "self",
            }),
          },
        ],
      },
    });
    const result = battle({ enemies: [reducer] });
    // 10.2 × 0.5 = 5.1 → 5
    expect(events(result.log, "damage").find((d) => d.actor === 0)?.amount).toBe(5);
    expect(events(result.log, "passive")).toEqual([{ type: "passive", unit: 1, passiveId: "rubber" }]);
  });

  it("taunt pulls the boss's single-target attacks", () => {
    const taunter = unit({
      stats: fast,
      skills: [
        skill({
          id: "taunt",
          power: 0,
          target: "self",
          usage: { kind: "oncePerBattle" },
          effects: [status({ kind: "taunt" }, 2)],
        }),
      ],
    });
    const result = simulateBattle({
      mode: "boss",
      players: [unit({ stats: fast }), taunter],
      enemies: [unit({ kind: "boss", stats: { ...tough, hp: 5000, spe: 50 } })],
      seed: 1,
      roundLimit: 4,
      balance: exactBalance,
    });
    const bossTargets = events(result.log, "damage").filter((d) => d.actor === 2).map((d) => d.target);
    // A self-applied status of 2 turns ends with the taunter's 2nd turn after casting (round 3),
    // so the slower boss is pulled in rounds 1 and 2, then returns to the front member.
    expect(bossTargets).toEqual([1, 1, 0, 0]);
  });
});

describe("recovery", () => {
  it("lifesteal heals a share of the damage dealt", () => {
    const vampire = unit({
      stats: fast,
      skills: [
        skill({
          id: "drain",
          power: 40,
          usage: { kind: "oncePerBattle" },
          effects: [{ kind: "lifesteal", ratio: 0.5 }],
        }),
      ],
    });
    const hurtFirst = { ...fast, hp: 500 };
    const result = battle({
      players: [unit({ ...vampire, stats: hurtFirst })],
      enemies: [unit({ stats: { ...tough, spe: 100, atk: 60 } })],
    });
    const drain = events(result.log, "damage").find((d) => d.skillId === "drain");
    const heal = events(result.log, "heal").find((h) => h.unit === 0);
    expect(heal?.amount).toBe(Math.floor((drain?.amount ?? 0) * 0.5));
  });

  it("an hpBelow passive fires once, the first time HP drops under the threshold", () => {
    const phoenix = unit({
      stats: { ...slow, hp: 100 },
      passive: {
        id: "second-wind",
        effects: [
          {
            trigger: "hpBelow",
            threshold: 0.5,
            effect: { kind: "heal", target: "targets", amount: { stat: "hp", ratio: 0.2, of: "caster" } },
          },
        ],
      },
    });
    const result = battle({
      players: [unit({ stats: { ...fast, atk: 120 } })],
      enemies: [phoenix],
      roundLimit: 10,
    });
    expect(events(result.log, "passive")).toHaveLength(1);
    expect(events(result.log, "heal").filter((h) => h.unit === 1).map((h) => h.amount)).toEqual([20]);
  });

  it("cooldown effects delay the target's skills", () => {
    const victim = unit({
      stats: slow,
      skills: [skill({ id: "cd", power: 40, usage: { kind: "cooldown", rounds: 1 } })],
    });
    // Round 1 the victim opens with "cd" (cooldown 1). The caster then adds 2 more turns.
    const delayer = unit({
      stats: { ...fast, spe: 20 },
      skills: [
        skill({
          id: "delay",
          power: 0,
          usage: { kind: "oncePerBattle" },
          effects: [{ kind: "cooldown", target: "targets", rounds: 2 }],
        }),
      ],
    });
    const result = battle({ players: [delayer], enemies: [{ ...victim, stats: { ...slow, spe: 30 } }], roundLimit: 5 });
    const victimSkills = events(result.log, "action").filter((e) => e.actor === 1).map((e) => e.skillId);
    // Without the delay: cd, basic, cd, basic, cd. With it: cd, basic, basic, basic, cd.
    expect(victimSkills).toEqual(["cd", "basic", "basic", "basic", "cd"]);
  });

  it("re-applying a status from the same skill refreshes it instead of stacking", () => {
    const stacker = unit({
      stats: fast,
      skills: [
        skill({
          id: "poke",
          power: 0,
          usage: { kind: "cooldown", rounds: 1 },
          effects: [status({ kind: "statStage", stat: "def", stages: -1 }, 5)],
        }),
      ],
    });
    const result = battle({ players: [stacker], roundLimit: 5 });
    const applied = events(result.log, "statusApplied").filter((e) => e.unit === 1);
    const expired = events(result.log, "statusExpired").filter((e) => e.unit === 1);
    expect(applied.length).toBeGreaterThan(1);
    expect(applied.length - expired.length).toBe(1);
  });
});

describe("chance", () => {
  it("applies a 50% status about half the time", () => {
    let applied = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const result = battle({
        seed,
        roundLimit: 1,
        players: [caster([status({ kind: "stun" }, 1, { chance: 0.5 })])],
      });
      if (events(result.log, "statusApplied").length > 0) applied += 1;
    }
    expect(applied / 400).toBeGreaterThan(0.42);
    expect(applied / 400).toBeLessThan(0.58);
  });
});
