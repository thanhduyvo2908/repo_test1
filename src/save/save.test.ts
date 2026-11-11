import { describe, expect, it } from "vitest";
import { createNewGame } from "../core/progress";
import { pack } from "../core/testUtils";
import {
  SAVE_VERSION,
  createDefaultSave,
  deserializeSave,
  loadSave,
  serializeSave,
  writeSave,
  type SaveStorage,
} from "./index";

function memoryStorage(): SaveStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("save", () => {
  it("starts in English with no game", () => {
    expect(createDefaultSave()).toEqual({ version: SAVE_VERSION, settings: { lang: "en", autoAdvance: false }, game: null });
  });

  it("round-trips settings and game state", () => {
    const storage = memoryStorage();
    const game = createNewGame(pack, 1234);
    writeSave(storage, { version: SAVE_VERSION, settings: { lang: "vi", autoAdvance: false }, game });
    const loaded = loadSave(storage);
    expect(loaded.settings.lang).toBe("vi");
    expect(loaded.game).toEqual(game);
  });

  it("falls back to a fresh save for missing, corrupt or future data", () => {
    expect(deserializeSave(null)).toEqual(createDefaultSave());
    expect(deserializeSave("{not json")).toEqual(createDefaultSave());
    expect(deserializeSave(JSON.stringify({ version: 99, settings: { lang: "vi" } }))).toEqual(
      createDefaultSave(),
    );
  });

  it("ignores an unknown language but keeps the game", () => {
    const game = createNewGame(pack, 1);
    const text = serializeSave({ version: SAVE_VERSION, settings: { lang: "fr" as "en", autoAdvance: false }, game });
    const loaded = deserializeSave(text);
    expect(loaded.settings.lang).toBe("en");
    expect(loaded.game).toEqual(game);
  });

  it("drops a damaged game section but keeps the language", () => {
    const text = JSON.stringify({ version: SAVE_VERSION, settings: { lang: "vi", autoAdvance: false }, game: { seed: "x" } });
    expect(deserializeSave(text)).toEqual({ version: SAVE_VERSION, settings: { lang: "vi", autoAdvance: false }, game: null });
  });
});

describe("migrations", () => {
  it("upgrades a v1 save (settings only) with no game", () => {
    const v1 = JSON.stringify({ version: 1, settings: { lang: "vi" } });
    expect(deserializeSave(v1)).toEqual({ version: SAVE_VERSION, settings: { lang: "vi", autoAdvance: false }, game: null });
  });

  it("upgrades a v2 save: keeps progress, adds growth fields and empty resources", () => {
    const v2 = JSON.stringify({
      version: 2,
      settings: { lang: "en" },
      game: {
        seed: 9,
        battleCounter: 4,
        roster: [
          { characterId: "earth-cube", level: 7 },
          { characterId: "water-sphere", level: 3 },
        ],
        team: ["water-sphere", "earth-cube"],
        maps: { "training-grounds": { stagesCleared: 10, bossDefeated: true } },
        items: [{ uid: 1, itemId: "sphere-shard", tier: "rare" }],
        nextItemUid: 2,
        completedWorlds: ["training"],
      },
    });
    const loaded = deserializeSave(v2);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.game).toMatchObject({
      seed: 9,
      battleCounter: 4,
      team: ["water-sphere", "earth-cube"],
      maps: { "training-grounds": { stagesCleared: 10, bossDefeated: true } },
      items: [{ uid: 1, itemId: "sphere-shard", tier: "rare" }],
      gold: 0,
      food: 0,
      dust: 0,
      starMaterial: 0,
      sideDungeon: { day: "", used: 0 },
      lastSeenAt: null,
    });
    expect(loaded.game?.roster[0]).toEqual({
      characterId: "earth-cube",
      level: 7,
      stars: 1,
      points: {},
      skillOrder: null,
      itemUid: null,
    });
  });

  it("upgrades a v2 save with no game", () => {
    const v2 = JSON.stringify({ version: 2, settings: { lang: "vi" }, game: null });
    expect(deserializeSave(v2)).toEqual({ version: SAVE_VERSION, settings: { lang: "vi", autoAdvance: false }, game: null });
  });

  it("upgrades a v3 save: keeps the game, adds auto-advance off", () => {
    const game = createNewGame(pack, 5);
    const v3 = JSON.stringify({ version: 3, settings: { lang: "vi" }, game });
    expect(deserializeSave(v3)).toEqual({
      version: SAVE_VERSION,
      settings: { lang: "vi", autoAdvance: false },
      game,
    });
  });

  it("round-trips auto-advance", () => {
    const text = serializeSave({ version: SAVE_VERSION, settings: { lang: "en", autoAdvance: true }, game: null });
    expect(deserializeSave(text).settings.autoAdvance).toBe(true);
  });
});
