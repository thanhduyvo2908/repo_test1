import { describe, expect, it } from "vitest";
import { computeDamage, type DamageInput } from "./damage";
import { elementMultiplier } from "./element";
import { createRng } from "./rng";
import { addBaseStats, computeStats } from "./stats";
import { pack } from "./testUtils";

describe("rng", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("gives different sequences for different seeds", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("keeps values in range", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
});

describe("stats", () => {
  const base = { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 };

  it("follows the Pokémon formula (CLAUDE.md example)", () => {
    const stats = computeStats(base, 30, {}, pack.balance);
    expect(stats.atk).toBe(65);
    expect(stats.hp).toBe(100);
  });

  it("adds allocated points: 0.5 per point, 1 per point for HP", () => {
    const stats = computeStats(base, 30, { atk: 30, hp: 30 }, pack.balance);
    expect(stats.atk).toBe(80);
    expect(stats.hp).toBe(130);
  });

  it("matches the Luffy draft table at level 30", () => {
    const luffy = { hp: 90, atk: 100, def: 75, spa: 40, spd: 70, spe: 85 };
    expect(computeStats(luffy, 30, {}, pack.balance)).toEqual({
      hp: 94,
      atk: 65,
      def: 50,
      spa: 29,
      spd: 47,
      spe: 56,
    });
  });

  it("adds star bonuses to base stats", () => {
    expect(addBaseStats(base, { hp: 5, atk: 5 })).toMatchObject({ hp: 105, atk: 105, def: 100 });
  });
});

describe("element chart", () => {
  const chart = pack.balance.elementChart;

  it("doubles damage on a counter and halves it the other way", () => {
    expect(elementMultiplier(chart, "earth", "water")).toBe(2);
    expect(elementMultiplier(chart, "water", "earth")).toBe(0.5);
    expect(elementMultiplier(chart, "metal", "wood")).toBe(2);
    expect(elementMultiplier(chart, "wood", "metal")).toBe(0.5);
  });

  it("has light and dark counter each other both ways", () => {
    expect(elementMultiplier(chart, "light", "dark")).toBe(2);
    expect(elementMultiplier(chart, "dark", "light")).toBe(2);
  });

  it("is neutral for unrelated pairs", () => {
    expect(elementMultiplier(chart, "metal", "light")).toBe(1);
    expect(elementMultiplier(chart, "fire", "fire")).toBe(1);
    expect(elementMultiplier(chart, "earth", "fire")).toBe(1);
  });
});

describe("damage formula", () => {
  const plain: DamageInput = {
    level: 30,
    power: 60,
    attack: 65,
    defense: 50,
    crit: false,
    roll: 1,
    stab: false,
    effectiveness: 1,
    spread: false,
    other: 1,
  };

  it("computes the base Pokémon formula", () => {
    // (2 × 30 / 5 + 2) × 60 × 65 / 50 / 50 + 2 = 23.84
    expect(computeDamage(plain, pack.balance)).toBe(23);
  });

  it("applies STAB, effectiveness, crit and spread", () => {
    expect(computeDamage({ ...plain, stab: true }, pack.balance)).toBe(35); // 35.76
    expect(computeDamage({ ...plain, stab: true, effectiveness: 2 }, pack.balance)).toBe(71);
    expect(computeDamage({ ...plain, crit: true }, pack.balance)).toBe(35); // 35.76
    expect(computeDamage({ ...plain, spread: true }, pack.balance)).toBe(17); // 17.88
    expect(computeDamage({ ...plain, roll: 0.85 }, pack.balance)).toBe(20); // 20.264
    expect(computeDamage({ ...plain, other: 1.3 }, pack.balance)).toBe(30); // 30.992
  });

  it("never goes below the minimum", () => {
    expect(computeDamage({ ...plain, effectiveness: 0.01 }, pack.balance)).toBe(1);
  });
});
