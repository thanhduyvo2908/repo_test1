import { describe, expect, it } from "vitest";
import { SkillPicker } from "./skillPicker";
import { skill } from "./testUtils";

const basic = skill({ id: "basic" });
const s1 = skill({ id: "s1", usage: { kind: "cooldown", rounds: 2 } });
const s2 = skill({ id: "s2", usage: { kind: "cooldown", rounds: 3 } });
const s3 = skill({ id: "s3", usage: { kind: "oncePerBattle" } });

function sequence(picker: SkillPicker, turns: number): string[] {
  const used: string[] = [];
  for (let i = 0; i < turns; i++) {
    used.push(picker.pick().skill.id);
    picker.endTurn();
  }
  return used;
}

describe("SkillPicker", () => {
  it("uses each skill once in arranged order, then follows cooldowns", () => {
    const picker = new SkillPicker([s1, s2, s3], basic);
    expect(sequence(picker, 8)).toEqual(["s1", "s2", "s3", "s1", "basic", "s2", "s1", "basic"]);
  });

  it("respects a custom arrangement in the opening and in priority", () => {
    const picker = new SkillPicker([s3, s2, s1], basic);
    // Opening: s3, s2, s1. Both cooldown skills then sit out two turns; s2 ranks above s1.
    expect(sequence(picker, 7)).toEqual(["s3", "s2", "s1", "basic", "basic", "s2", "s1"]);
  });

  it("makes a cooldown of N sit out the next N turns", () => {
    const picker = new SkillPicker([s2], basic);
    expect(sequence(picker, 6)).toEqual(["s2", "basic", "basic", "basic", "s2", "basic"]);
  });

  it("never reuses a once-per-battle skill", () => {
    const picker = new SkillPicker([s3], basic);
    expect(sequence(picker, 4)).toEqual(["s3", "basic", "basic", "basic"]);
  });

  it("falls back to the basic attack with no skills", () => {
    expect(sequence(new SkillPicker([], basic), 2)).toEqual(["basic", "basic"]);
  });
});
