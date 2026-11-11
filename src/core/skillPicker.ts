import type { Skill } from "../content/schema";

/**
 * Tracks which skill a combatant uses each turn.
 *
 * - Opening: every equipped skill is used once, in the order the player arranged.
 * - Afterwards: the first cooldown skill (in arranged order) that is ready; otherwise the basic attack.
 * - Once-per-battle skills are spent after their single use.
 * - A cooldown of N means the skill sits out the owner's next N turns. Cooldowns tick at the end of
 *   each of the owner's turns, including turns lost to crowd control.
 */
export class SkillPicker {
  private readonly cooldowns: number[];
  private readonly spent: boolean[];
  private openingIndex = 0;
  private lastUsed: number | null = null;

  constructor(
    private readonly skills: readonly Skill[],
    private readonly basicAttack: Skill,
  ) {
    this.cooldowns = skills.map(() => 0);
    this.spent = skills.map(() => false);
  }

  /** Picks the skill for this turn and marks it used. Returns its index, or null for the basic attack. */
  pick(): { skill: Skill; index: number | null } {
    let index: number | null = null;

    while (this.openingIndex < this.skills.length && index === null) {
      const candidate = this.openingIndex++;
      if (this.isReady(candidate)) index = candidate;
    }

    if (index === null) {
      const ready = this.skills.findIndex(
        (skill, i) => skill.usage.kind === "cooldown" && this.isReady(i),
      );
      if (ready >= 0) index = ready;
    }

    if (index === null) {
      this.lastUsed = null;
      return { skill: this.basicAttack, index: null };
    }

    const skill = this.skills[index] as Skill;
    if (skill.usage.kind === "cooldown") this.cooldowns[index] = skill.usage.rounds;
    if (skill.usage.kind === "oncePerBattle") this.spent[index] = true;
    this.lastUsed = index;
    return { skill, index };
  }

  /** Call at the end of the owner's turn (also when the turn was skipped). */
  endTurn(): void {
    for (let i = 0; i < this.cooldowns.length; i++) {
      if (i === this.lastUsed) continue;
      const remaining = this.cooldowns[i] ?? 0;
      if (remaining > 0) this.cooldowns[i] = remaining - 1;
    }
    this.lastUsed = null;
  }

  private isReady(index: number): boolean {
    return !this.spent[index] && (this.cooldowns[index] ?? 0) === 0;
  }
}
