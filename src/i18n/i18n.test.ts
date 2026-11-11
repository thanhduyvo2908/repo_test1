import { describe, expect, it } from "vitest";
import { en } from "./strings/en";
import { vi } from "./strings/vi";
import { format, localize, placeholdersOf, translate } from "./index";

describe("string tables", () => {
  it("has a non-empty English string for every key", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("has no Vietnamese keys missing from English", () => {
    const enKeys = new Set(Object.keys(en));
    for (const key of Object.keys(vi)) {
      expect(enKeys.has(key), key).toBe(true);
    }
  });

  it("uses the same placeholders in both languages", () => {
    for (const [key, value] of Object.entries(vi)) {
      const english = en[key as keyof typeof en];
      expect(placeholdersOf(value ?? ""), key).toEqual(placeholdersOf(english));
    }
  });
});

describe("translate", () => {
  it("fills placeholders", () => {
    expect(translate("en", "map.stageCount", { count: 10 })).toBe("10 stages");
    expect(translate("vi", "map.stageCount", { count: 10 })).toBe("10 màn");
  });

  it("falls back to English when a Vietnamese string is missing", () => {
    const missing = Object.keys(en).find((key) => !(key in vi));
    if (missing) {
      const key = missing as keyof typeof en;
      expect(translate("vi", key)).toBe(en[key]);
    }
  });

  it("leaves unknown placeholders untouched", () => {
    expect(format("{a} {b}", { a: 1 })).toBe("1 {b}");
  });
});

describe("localize", () => {
  it("falls back to English when there is no Vietnamese text", () => {
    expect(localize({ en: "Cube" }, "vi")).toBe("Cube");
    expect(localize({ en: "Cube", vi: "Khối" }, "vi")).toBe("Khối");
    expect(localize({ en: "Cube", vi: "Khối" }, "en")).toBe("Cube");
  });
});
