import type { PackInput } from "../../src/content/schema";

// Small helpers for writing the One Piece pack. They only build data; the schema checks it on load.

export type CharacterInput = PackInput["characters"][number];
export type EnemyInput = PackInput["enemies"][number];
export type SkillInput = CharacterInput["skills"][number];
export type StatsInput = CharacterInput["baseStats"];
export type BossInput = PackInput["worlds"][number]["maps"][number]["boss"];

export const text = (en: string, vi: string) => ({ en, vi });

const PENDING = text("Placeholder skill; design pending.", "Skill tạm, chờ thiết kế.");

function skill(
  id: string,
  name: { en: string; vi: string },
  power: number,
  stat: "atk" | "spa",
  target: SkillInput["target"],
  usage: SkillInput["usage"],
): SkillInput {
  return { id, name, description: PENDING, power, scaling: [{ stat, weight: 1 }], target, usage };
}

/** Basic attack plus S1–S4 placeholders for a character whose kit is not designed yet. */
export function placeholderKit(id: string, stat: "atk" | "spa") {
  return {
    basicAttack: skill(`${id}-basic`, text("Basic Attack", "Đánh thường"), 40, stat, "enemy", { kind: "basic" }),
    skills: [
      skill(`${id}-s1`, text("Skill 1", "Skill 1"), 60, stat, "enemy", { kind: "cooldown", rounds: 2 }),
      skill(`${id}-s2`, text("Skill 2", "Skill 2"), 80, stat, "enemy", { kind: "cooldown", rounds: 3 }),
      skill(`${id}-s3`, text("Skill 3", "Skill 3"), 120, stat, "enemy", { kind: "oncePerBattle" }),
      skill(`${id}-s4`, text("Skill 4", "Skill 4"), 150, stat, "enemy", { kind: "oncePerBattle" }),
    ],
  };
}

/** Basic attack and one skill for a soldier type. */
export function soldierKit(id: string, stat: "atk" | "spa") {
  return {
    basicAttack: skill(`${id}-basic`, text("Attack", "Tấn công"), 40, stat, "enemy", { kind: "basic" }),
    skills: [skill(`${id}-s1`, text("Heavy Blow", "Đòn mạnh"), 60, stat, "enemy", { kind: "cooldown", rounds: 3 })],
  };
}

/** Placeholder boss kit: a single-target skill, a team-wide skill and a once-per-battle finisher. */
export function bossKit(id: string, stat: "atk" | "spa") {
  return {
    basicAttack: skill(`boss-${id}-basic`, text("Basic Attack", "Đánh thường"), 40, stat, "enemy", { kind: "basic" }),
    skills: [
      skill(`boss-${id}-strike`, text("Strike", "Đòn đánh"), 60, stat, "enemy", { kind: "cooldown", rounds: 2 }),
      skill(`boss-${id}-sweep`, text("Sweep", "Quét"), 50, stat, "allEnemies", { kind: "cooldown", rounds: 3 }),
      skill(`boss-${id}-finisher`, text("Finisher", "Tuyệt chiêu"), 110, stat, "enemy", { kind: "oncePerBattle" }),
    ],
  };
}

/**
 * Boss-version stats: the character's base stats with HP multiplied, since the whole team fights
 * the boss at once. Placeholder until balancing.
 */
export function bossStats(base: StatsInput, hpMultiplier: number, otherMultiplier: number): StatsInput {
  return {
    hp: Math.round(base.hp * hpMultiplier),
    atk: Math.round(base.atk * otherMultiplier),
    def: Math.round(base.def * otherMultiplier),
    spa: Math.round(base.spa * otherMultiplier),
    spd: Math.round(base.spd * otherMultiplier),
    spe: Math.round(base.spe * otherMultiplier),
  };
}
