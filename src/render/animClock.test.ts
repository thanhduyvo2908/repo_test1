import { describe, expect, it } from "vitest";
import { advance, durationTicks, fallbackChain, startState, type SpriteAnim } from "./animClock";

const frame = (f: number, ticks: number) => ({ f, dx: 0, dy: 0, ticks, flipH: false });

const walk: SpriteAnim = { frames: [frame(0, 4), frame(1, 4), frame(2, 4)], loopStart: 1 };

describe("advance", () => {
  it("moves to the next frame once a frame's ticks run out", () => {
    expect(advance(startState(), walk, 3, true)).toEqual({ index: 0, elapsed: 3, done: false });
    expect(advance(startState(), walk, 4, true)).toEqual({ index: 1, elapsed: 0, done: false });
    expect(advance(startState(), walk, 9, true)).toEqual({ index: 2, elapsed: 1, done: false });
  });

  it("loops back to loopStart", () => {
    // 12 ticks finish all three frames; looping restarts at frame 1.
    expect(advance(startState(), walk, 13, true)).toEqual({ index: 1, elapsed: 1, done: false });
  });

  it("stops on the last frame of a one-shot animation", () => {
    const state = advance(startState(), walk, 50, false);
    expect(state.index).toBe(2);
    expect(state.done).toBe(true);
  });

  it("holds a frame with ticks -1", () => {
    const hold: SpriteAnim = { frames: [frame(0, 2), frame(1, -1)], loopStart: 0 };
    expect(advance(startState(), hold, 500, true)).toMatchObject({ index: 1, done: false });
    expect(advance(startState(), hold, 500, false)).toMatchObject({ index: 1, done: true });
  });
});

describe("helpers", () => {
  it("measures one-shot length", () => {
    expect(durationTicks(walk)).toBe(12);
    expect(durationTicks({ frames: [frame(0, -1)], loopStart: 0 })).toBe(Infinity);
  });

  it("falls back from a missing skill animation to basic, then idle", () => {
    expect(fallbackChain("s3")).toEqual(["s3", "basic", "idle"]);
    expect(fallbackChain("hit")).toEqual(["hit", "idle"]);
  });
});
