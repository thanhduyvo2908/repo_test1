import type { Balance } from "../content/schema";

export interface DamageInput {
  /** Attacker level. */
  level: number;
  /** Skill power. */
  power: number;
  /** Weighted sum of the stats the skill scales with. */
  attack: number;
  /** Target's physical or magic defense, by the attacker's damage type. */
  defense: number;
  crit: boolean;
  /** Random roll in [randomMin, randomMax]. */
  roll: number;
  stab: boolean;
  /** Element chart multiplier. */
  effectiveness: number;
  /** The skill hits more than one target. */
  spread: boolean;
  /** Product of other multipliers (items, buffs). 1 when there are none. */
  other: number;
}

/**
 * Pokémon VGC damage formula:
 *   ((2 × L / 5 + 2) × Power × A / D / 50 + 2) × crit × random × STAB × type × spread × other
 * Rounded down at the end, never below balance.damage.minDamage.
 */
export function computeDamage(input: DamageInput, balance: Pick<Balance, "damage">): number {
  const d = balance.damage;
  const defense = Math.max(1, input.defense);
  const base = (((2 * input.level) / 5 + 2) * input.power * input.attack) / defense / 50 + 2;
  const total =
    base *
    (input.crit ? d.critMultiplier : 1) *
    input.roll *
    (input.stab ? d.stab : 1) *
    input.effectiveness *
    (input.spread ? d.multiTarget : 1) *
    input.other;
  return Math.max(d.minDamage, Math.floor(total));
}
