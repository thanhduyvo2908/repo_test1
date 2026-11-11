import { describe, expect, it } from "vitest";
import { pack } from "../core/testUtils";
import { runBoss, runSideDungeon, runStage } from "../core/encounters";
import { animKeyFor, skillsById } from "./content";

describe("animKeyFor", () => {
  it("maps basic attacks and skill slots, including star overrides and boss kits", () => {
    const hero = { kind: "character" as const, sourceId: "earth-cube" };
    expect(animKeyFor(pack, hero, "earth-cube-basic")).toBe("basic");
    expect(animKeyFor(pack, hero, "earth-cube-s3")).toBe("s3");
    expect(animKeyFor(pack, hero, "earth-cube-s1-star2")).toBe("s1");
    const boss = { kind: "boss" as const, sourceId: "water-sphere" };
    expect(animKeyFor(pack, boss, "boss-water-sphere-basic")).toBe("basic");
    expect(animKeyFor(pack, boss, "boss-water-sphere-bubble")).toBe("s2");
    expect(animKeyFor(pack, boss, "trial-water-sphere-wave")).toBe("s1");
    const pawn = { kind: "enemy" as const, sourceId: "water-knight" };
    expect(animKeyFor(pack, pawn, "water-knight-s1")).toBe("s1");
  });
});

describe("skillsById", () => {
  it("knows every skill that can appear in a battle log", () => {
    const skills = skillsById(pack);
    const dungeon = [...pack.sideDungeons.values()][0]!;
    const team = [{ characterId: "earth-cube", level: 30, stars: 2 }];
    const logs = [
      runStage(pack, "training-grounds", 9, team, 1).log,
      runBoss(pack, "training-grounds", team, 1).log,
      runSideDungeon(pack, dungeon, team, 1).log,
    ];
    for (const log of logs) {
      for (const event of log) {
        if (event.type === "action") expect(skills.has(event.skillId), event.skillId).toBe(true);
      }
    }
  });
});
