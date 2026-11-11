import { STAT_KEYS, type Balance, type StatBlock, type StatKey } from "../content/schema";

/** Points the player allocated to each stat. Missing stats count as 0. */
export type StatPoints = Partial<Record<StatKey, number>>;

/**
 * Pokémon stat formula without IVs or natures, plus allocated points:
 *   HP    = 2 × base × L / 100 + L + 10 + points × pointValue.hp
 *   other = 2 × base × L / 100 + 5      + points × pointValue.other
 * Rounded down once, after every part is added.
 */
export function computeStat(
  stat: StatKey,
  base: number,
  level: number,
  points: number,
  balance: Pick<Balance, "stats">,
): number {
  const scaled = (2 * base * level) / 100;
  if (stat === "hp") {
    return Math.floor(scaled + level + 10 + points * balance.stats.pointValue.hp);
  }
  return Math.floor(scaled + 5 + points * balance.stats.pointValue.other);
}

export function computeStats(
  base: StatBlock,
  level: number,
  points: StatPoints,
  balance: Pick<Balance, "stats">,
): StatBlock {
  const result = {} as StatBlock;
  for (const stat of STAT_KEYS) {
    result[stat] = computeStat(stat, base[stat], level, points[stat] ?? 0, balance);
  }
  return result;
}

/** Adds star bonuses (or any other base-stat bonus) to a base stat block. */
export function addBaseStats(base: StatBlock, bonus: Partial<StatBlock>): StatBlock {
  const result = { ...base };
  for (const stat of STAT_KEYS) result[stat] += bonus[stat] ?? 0;
  return result;
}
