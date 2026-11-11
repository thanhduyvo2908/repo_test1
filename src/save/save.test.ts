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
    expect(createDefaultSave()).toEqual({ version: SAVE_VERSION, settings: { lang: "en" }, game: null });
  });

  it("round-trips settings and game state", () => {
    const storage = memoryStorage();
    const game = createNewGame(pack, 1234);
    writeSave(storage, { version: SAVE_VERSION, settings: { lang: "vi" }, game });
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
    const text = serializeSave({ version: SAVE_VERSION, settings: { lang: "fr" as "en" }, game });
    const loaded = deserializeSave(text);
    expect(loaded.settings.lang).toBe("en");
    expect(loaded.game).toEqual(game);
  });

  it("drops a damaged game section but keeps the language", () => {
    const text = JSON.stringify({ version: SAVE_VERSION, settings: { lang: "vi" }, game: { seed: "x" } });
    expect(deserializeSave(text)).toEqual({ version: SAVE_VERSION, settings: { lang: "vi" }, game: null });
  });
});

describe("migrations", () => {
  it("upgrades a v1 save (settings only) to v2 with no game", () => {
    const v1 = JSON.stringify({ version: 1, settings: { lang: "vi" } });
    expect(deserializeSave(v1)).toEqual({ version: 2, settings: { lang: "vi" }, game: null });
  });
});
