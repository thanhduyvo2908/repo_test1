import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/content/loader";
import { mapOrder } from "../../src/core/progress";
import { onepiecePackData } from "./index";

describe("One Piece pack", () => {
  const pack = loadPack(onepiecePackData);

  it("loads with Luffy as the starter", () => {
    expect(pack.manifest.starterCharacterId).toBe("luffy");
    expect(pack.characters.size).toBe(13);
  });

  it("has 12 maps with 148 stages in story order, ending with Don Krieg", () => {
    const maps = mapOrder(pack).map((e) => e.map);
    expect(maps).toHaveLength(12);
    expect(maps.reduce((sum, m) => sum + m.stages.length, 0)).toBe(148);
    expect(maps.map((m) => m.boss.characterId)).toEqual([
      "alvida", "zoro", "morgan", "nami", "cabaji", "buggy",
      "usopp", "jango", "kuro", "sanji", "gin", "don-krieg",
    ]);
    expect(maps.at(-1)?.boss.level).toBe(30);
  });

  it("recruits Straw Hat members at 10% and drops only their items", () => {
    const strawHats = new Set(["zoro", "nami", "usopp", "sanji"]);
    for (const map of pack.maps.values()) {
      const isStrawHat = strawHats.has(map.boss.characterId);
      expect(map.boss.recruitRate ?? pack.balance.worlds["east-blue"]?.recruitRate).toBe(isStrawHat ? 0.1 : 0.2);
      expect(map.boss.dropItemId !== undefined).toBe(isStrawHat);
    }
  });

  it("grows stages from 1 to 5 enemies with rising levels", () => {
    const first = mapOrder(pack)[0]!.map;
    expect(first.stages[0]!.enemies).toHaveLength(1);
    expect(first.stages.at(-1)!.enemies).toHaveLength(5);
    expect(first.stages[0]!.enemies[0]!.level).toBe(1);
    expect(first.stages.at(-1)!.enemies[0]!.level).toBe(3);
  });
});
