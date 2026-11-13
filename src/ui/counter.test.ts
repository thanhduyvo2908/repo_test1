import { describe, expect, it } from "vitest";
import { createNewGame } from "../core/progress";
import { pack } from "../core/testUtils";
import { frontStage, initialGrind } from "./adventure";
import { counterHints, mapElements } from "./counter";

describe("counter hints", () => {
  it("reads the element chart: earth beats the water map; nobody in the team is weak to water", () => {
    const game = createNewGame(pack, 1);
    const elements = mapElements(pack, "training-grounds");
    expect(elements).toEqual(["water"]);
    const hints = counterHints(pack, game, elements);
    expect(hints.strong).toEqual([{ defender: "water", attackers: ["earth"], characterIds: ["earth-cube"] }]);
    expect(hints.weakInTeam).toEqual([]);
  });

  it("flags team members the map's elements hit hard", () => {
    const game = createNewGame(pack, 1);
    // Wood beats earth in the placeholder chart, so the earth starter is weak on a wood map.
    expect(counterHints(pack, game, ["wood"]).weakInTeam).toEqual(["earth-cube"]);
    expect(counterHints(pack, game, ["water"]).weakInTeam).toEqual([]);
  });
});

describe("idle loop start", () => {
  it("starts a new game on the first map's first stage", () => {
    const game = createNewGame(pack, 1);
    expect(initialGrind(pack, game)).toEqual({ kind: "stage", mapId: "training-grounds", stageIndex: 0 });
  });

  it("resumes at the front stage, and stays on the last stage once all are cleared", () => {
    const map = pack.maps.get("training-grounds")!;
    const game = createNewGame(pack, 1);
    expect(frontStage({ ...game, maps: { [map.id]: { stagesCleared: 4, bossDefeated: false } } }, map)).toBe(4);
    expect(frontStage({ ...game, maps: { [map.id]: { stagesCleared: 99, bossDefeated: false } } }, map)).toBe(
      map.stages.length - 1,
    );
  });
});
