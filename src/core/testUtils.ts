// Shared helpers for core tests. Not used by game code.
import { placeholderPackData } from "../../packs/placeholder";
import { loadPack, type Pack } from "../content/loader";
import type { Balance, Skill } from "../content/schema";
import type { BattleUnit } from "./battle";

export const pack: Pack = loadPack(placeholderPackData);

/** Placeholder balance with crits off and a fixed roll of 1, so damage is exact. */
export const exactBalance: Balance = {
  ...pack.balance,
  damage: { ...pack.balance.damage, critChance: 0, randomMin: 1, randomMax: 1 },
};

export function skill(overrides: Partial<Skill> & Pick<Skill, "id">): Skill {
  return {
    name: { en: overrides.id },
    description: { en: overrides.id },
    power: 40,
    scaling: [{ stat: "atk", weight: 1 }],
    target: "enemy",
    usage: { kind: "basic" },
    effects: [],
    ...overrides,
  };
}

export function unit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    kind: "character",
    sourceId: "test-unit",
    level: 10,
    element: "metal",
    damageType: "physical",
    stats: { hp: 100, atk: 30, def: 30, spa: 30, spd: 30, spe: 30 },
    basicAttack: skill({ id: "basic" }),
    skills: [],
    ...overrides,
  };
}
