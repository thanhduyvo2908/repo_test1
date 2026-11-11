// Frame timing for sprite animations. Pure, so it can be tested without PixiJS.
// Times are in ticks: 60 ticks = 1 second, as in MUGEN. A frame with ticks -1 holds forever.

export const TICKS_PER_SECOND = 60;

export interface AnimFrame {
  /** Index into the sheet's frame list. */
  f: number;
  dx: number;
  dy: number;
  ticks: number;
  flipH: boolean;
}

export interface SpriteAnim {
  frames: AnimFrame[];
  /** Looping animations restart here. */
  loopStart: number;
}

export interface AnimState {
  index: number;
  /** Ticks spent on the current frame. */
  elapsed: number;
  done: boolean;
}

export const startState = (): AnimState => ({ index: 0, elapsed: 0, done: false });

/**
 * Advances an animation. A looping animation wraps to `loopStart`; a one-shot animation stops on
 * its last frame and reports `done`.
 */
export function advance(state: AnimState, anim: SpriteAnim, ticks: number, loop: boolean): AnimState {
  if (anim.frames.length === 0) return { ...state, done: true };
  let { index, elapsed } = state;
  let left = elapsed + ticks;
  for (let guard = 0; guard < 10_000; guard++) {
    const frame = anim.frames[index];
    if (!frame || frame.ticks < 0) return { index, elapsed: left, done: !loop };
    const length = Math.max(1, frame.ticks);
    if (left < length) return { index, elapsed: left, done: false };
    left -= length;
    if (index + 1 < anim.frames.length) {
      index += 1;
    } else if (loop) {
      index = Math.min(Math.max(0, anim.loopStart), anim.frames.length - 1);
    } else {
      return { index, elapsed: length, done: true };
    }
  }
  return { index, elapsed: 0, done: false };
}

/** Total length of a one-shot animation in ticks, or Infinity if a frame holds forever. */
export function durationTicks(anim: SpriteAnim): number {
  let total = 0;
  for (const frame of anim.frames) {
    if (frame.ticks < 0) return Infinity;
    total += Math.max(1, frame.ticks);
  }
  return total;
}

/** Animation keys in fallback order: an attack without its own animation uses `basic`, then `idle`. */
export function fallbackChain(name: string): string[] {
  if (name === "idle") return ["idle"];
  if (name === "hit" || name === "ko") return [name, "idle"];
  return [name, "basic", "idle"];
}
