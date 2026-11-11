import { describe, expect, it } from "vitest";
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
  it("starts in English", () => {
    expect(createDefaultSave().settings.lang).toBe("en");
  });

  it("round-trips the language setting", () => {
    const storage = memoryStorage();
    writeSave(storage, { version: SAVE_VERSION, settings: { lang: "vi" } });
    expect(loadSave(storage).settings.lang).toBe("vi");
  });

  it("falls back to a fresh save for missing, corrupt or future data", () => {
    expect(deserializeSave(null)).toEqual(createDefaultSave());
    expect(deserializeSave("{not json")).toEqual(createDefaultSave());
    expect(deserializeSave(serializeSave({ ...createDefaultSave(), version: 99 as 1 }))).toEqual(
      createDefaultSave(),
    );
  });

  it("ignores an unknown language", () => {
    const text = JSON.stringify({ version: SAVE_VERSION, settings: { lang: "fr" } });
    expect(deserializeSave(text).settings.lang).toBe("en");
  });
});
