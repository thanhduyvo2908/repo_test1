import { describe, expect, it } from "vitest";
import { fullNumber, shortNumber } from "./format";

describe("shortNumber", () => {
  it("keeps small numbers whole", () => {
    expect(shortNumber(0, "en")).toBe("0");
    expect(shortNumber(9_999, "en")).toBe("9,999");
    expect(shortNumber(9_999, "vi")).toBe("9.999");
  });

  it("uses K and M in both languages, rounding down", () => {
    expect(shortNumber(161_190, "en")).toBe("161K");
    expect(shortNumber(91_738, "vi")).toBe("91K");
    expect(shortNumber(1_250_000, "en")).toBe("1.2M");
    expect(shortNumber(1_250_000, "vi")).toBe("1,2M");
    expect(shortNumber(12_900_000, "en")).toBe("12M");
  });

  it("keeps the sign", () => {
    expect(shortNumber(-25_000, "en")).toBe("-25K");
  });
});

describe("fullNumber", () => {
  it("groups digits by language", () => {
    expect(fullNumber(161_190, "en")).toBe("161,190");
    expect(fullNumber(161_190, "vi")).toBe("161.190");
  });
});
