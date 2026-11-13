import { describe, expect, it } from "vitest";
import { layoutBattle, type LayoutUnit } from "./layout";

const W = 400;
const H = 240;

function inside(slot: { x: number; y: number; size: number }) {
  return (
    slot.x - slot.size / 2 >= -1 &&
    slot.x + slot.size / 2 <= W + 1 &&
    slot.y - slot.size / 2 >= -1 &&
    slot.y + slot.size / 2 <= H + 1
  );
}

describe("layoutBattle", () => {
  it("duel: fighting units stand large in the middle, the rest wait on the bench", () => {
    const units: LayoutUnit[] = [
      { uid: 0, side: "player", kind: "character" },
      { uid: 1, side: "player", kind: "character" },
      { uid: 2, side: "enemy", kind: "enemy" },
      { uid: 3, side: "enemy", kind: "enemy" },
      { uid: 4, side: "enemy", kind: "enemy" },
    ];
    const slots = layoutBattle(units, { onField: new Set([0, 3]), hp: [10, 10, 0, 10, 10] }, W, H);
    expect(slots.get(0)?.role).toBe("field");
    expect(slots.get(3)?.role).toBe("field");
    expect(slots.get(1)?.role).toBe("bench");
    expect(slots.get(2)?.role).toBe("fallen");
    expect(slots.get(4)?.role).toBe("bench");
    expect(slots.get(0)!.x).toBeLessThan(W / 2);
    expect(slots.get(3)!.x).toBeGreaterThan(W / 2);
    expect(slots.get(0)!.size).toBeGreaterThan(slots.get(1)!.size);
    for (const slot of slots.values()) expect(inside(slot)).toBe(true);
  });

  it("boss fight: five players on the left, the boss large on the right, all on screen", () => {
    const units: LayoutUnit[] = [
      ...[0, 1, 2, 3, 4].map((uid) => ({ uid, side: "player" as const, kind: "character" as const })),
      { uid: 5, side: "enemy", kind: "boss" },
    ];
    const slots = layoutBattle(units, { onField: new Set(), hp: [1, 1, 0, 1, 1, 1] }, W, H);
    expect(slots.get(5)?.role).toBe("field");
    expect(slots.get(2)?.role).toBe("fallen");
    const boss = slots.get(5)!;
    for (const uid of [0, 1, 2, 3, 4]) {
      const slot = slots.get(uid)!;
      expect(slot.x).toBeLessThan(boss.x);
      expect(slot.size).toBeLessThan(boss.size);
    }
    for (const slot of slots.values()) expect(inside(slot)).toBe(true);
  });

  it("keeps a bottom inset clear for the caption", () => {
    const units = [
      { uid: 0, side: "player" as const, kind: "character" as const },
      { uid: 1, side: "player" as const, kind: "character" as const },
      { uid: 2, side: "enemy" as const, kind: "enemy" as const },
    ];
    const state = { onField: new Set([0, 2]), hp: [100, 100, 100] };
    const slots = layoutBattle(units, state, 400, 236, 38);
    for (const slot of slots.values()) expect(slot.y + slot.size / 2).toBeLessThanOrEqual(236 - 38);
  });

  it("keeps players from overlapping in a full boss fight", () => {
    const units: LayoutUnit[] = [
      ...[0, 1, 2, 3, 4].map((uid) => ({ uid, side: "player" as const, kind: "character" as const })),
      { uid: 5, side: "enemy", kind: "boss" },
    ];
    const slots = layoutBattle(units, { onField: new Set(), hp: [1, 1, 1, 1, 1, 1] }, W, H);
    const players = [0, 1, 2, 3, 4].map((uid) => slots.get(uid)!);
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i]!;
        const b = players[j]!;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        expect(distance).toBeGreaterThanOrEqual((a.size + b.size) / 2 - 1);
      }
    }
  });
});

describe("spriteDisplayHeight", () => {
  it("sizes sprites by the exporter's scale and keeps them inside the headroom", async () => {
    const { spriteDisplayHeight } = await import("./BattleScene");
    const luffy = spriteDisplayHeight(80, 47, 0.9);
    const krieg = spriteDisplayHeight(80, 78, 1.5);
    expect(krieg / luffy).toBeCloseTo(1.5 / 0.9);
    expect(spriteDisplayHeight(120, 78, 1.5, 150)).toBe(150);
  });
});
