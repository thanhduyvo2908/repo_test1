import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the rule from CLAUDE.md: src/core stays pure and deterministic.
const coreDir = join(import.meta.dirname, ".");
const sources = readdirSync(coreDir).filter(
  (file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "testUtils.ts",
);

const forbidden: [RegExp, string][] = [
  [/Math\.random\s*\(/, "Math.random"],
  [/Date\.now\s*\(/, "Date.now"],
  [/new Date\s*\(/, "new Date"],
  [/from\s+["'](react|react-dom|pixi\.js)[^"']*["']/, "React/PixiJS import"],
  [/\b(window|document|localStorage)\./, "DOM access"],
];

describe("src/core purity", () => {
  it.each(sources)("%s has no randomness, clock or UI dependencies", (file) => {
    const code = readFileSync(join(coreDir, file), "utf8");
    for (const [pattern, label] of forbidden) {
      expect(pattern.test(code), `${file} uses ${label}`).toBe(false);
    }
  });
});
