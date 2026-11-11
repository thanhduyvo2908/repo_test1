import type { Character, PassiveEffect, Skill, StatBlock } from "../content/schema";
import { addBaseStats } from "./stats";

/** A character as it fights at a given star level: star bonuses, skill swaps and extra passives applied. */
export interface CharacterBuild {
  baseStats: StatBlock;
  skills: Skill[];
  passiveEffects: PassiveEffect[];
  maxStars: number;
}

export function buildAtStars(character: Character, stars: number): CharacterBuild {
  let baseStats = character.baseStats;
  const skills = [...character.skills];
  const passiveEffects = [...character.passive.effects];
  // stars[0] is 2★, so a 3★ character has applied stars[0] and stars[1].
  for (const level of character.stars.slice(0, Math.max(0, stars - 1))) {
    baseStats = addBaseStats(baseStats, level.baseStatBonus);
    for (const { slot, skill } of level.skillOverrides) skills[slot] = skill;
    passiveEffects.push(...level.passiveEffects);
  }
  return { baseStats, skills, passiveEffects, maxStars: character.stars.length + 1 };
}
