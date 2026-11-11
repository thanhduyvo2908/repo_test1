import { describe, expect, it } from "vitest";
import { placeholderPackData } from "../../packs/placeholder";
import { loadPack, PackError } from "./loader";

/** Collects every localized text object ({ en, vi? }) found anywhere in the data. */
function findLocalizedTexts(value: unknown, path = "", out: [string, unknown][] = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findLocalizedTexts(entry, `${path}[${index}]`, out));
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.includes("en") && keys.every((key) => key === "en" || key === "vi")) {
      out.push([path, record.en]);
    } else {
      for (const [key, child] of Object.entries(record)) {
        findLocalizedTexts(child, path ? `${path}.${key}` : key, out);
      }
    }
  }
  return out;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe("placeholder pack", () => {
  it("loads without errors", () => {
    const pack = loadPack(placeholderPackData);
    expect(pack.characters.has(pack.manifest.starterCharacterId)).toBe(true);
    expect(pack.maps.size).toBeGreaterThan(0);
  });

  it("has English text for every localized entry", () => {
    const texts = findLocalizedTexts(placeholderPackData);
    expect(texts.length).toBeGreaterThan(0);
    for (const [path, en] of texts) {
      expect(typeof en === "string" && en.trim().length > 0, path).toBe(true);
    }
  });
});

describe("loadPack validation", () => {
  it("rejects an unknown starter character", () => {
    const data = clone(placeholderPackData) as { manifest: { starterCharacterId: string } };
    data.manifest.starterCharacterId = "nobody";
    expect(() => loadPack(data)).toThrow(PackError);
  });

  it("rejects a stage that references an unknown enemy", () => {
    const data = clone(placeholderPackData) as {
      worlds: { maps: { stages: { enemies: { enemyId: string }[] }[] }[] }[];
    };
    const enemy = data.worlds[0]?.maps[0]?.stages[0]?.enemies[0];
    if (!enemy) throw new Error("placeholder pack has no first enemy");
    enemy.enemyId = "ghost";
    expect(() => loadPack(data)).toThrow(/unknown enemy "ghost"/);
  });

  it("rejects a once-per-battle skill in the S1 slot", () => {
    const data = clone(placeholderPackData) as {
      characters: { skills: { usage: unknown }[] }[];
    };
    const s1 = data.characters[0]?.skills[0];
    if (!s1) throw new Error("placeholder pack has no S1");
    s1.usage = { kind: "oncePerBattle" };
    expect(() => loadPack(data)).toThrow(/S1 must use kind "cooldown"/);
  });

  it("rejects text without English", () => {
    const data = clone(placeholderPackData) as { manifest: { name: unknown } };
    data.manifest.name = { vi: "Chỉ có tiếng Việt" };
    expect(() => loadPack(data)).toThrow(PackError);
  });
});
