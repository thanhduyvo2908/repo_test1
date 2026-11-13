// Hit timing for exported attack animations (`hitTick` in sprite.json): the tick, from the
// start of the animation, at which the hit lands. Pure helpers used by tools/sprite-export.ts.

interface TimedFrame {
  ticks: number;
}

/** Tick at which frame `index` (0-based) starts. Held frames (-1) count as 0. */
export function tickOfFrame(frames: TimedFrame[], index: number): number {
  return frames.slice(0, index).reduce((n, f) => n + Math.max(0, f.ticks), 0);
}

/** Fallback hit timing: the start of the middle frame. */
export function middleTick(frames: TimedFrame[]): number {
  return tickOfFrame(frames, Math.floor(frames.length / 2));
}

export interface HitDefRange {
  /** The AIR action that was exported. Trigger lines that test `Anim = n` for other actions are skipped. */
  action?: number;
  /** Kept frames of the action, 0-based and inclusive. */
  from?: number;
  to?: number;
}

/**
 * Tick of the first HitDef in a state that lands inside the kept frames `from`..`to` (0-based,
 * into the whole action), from `AnimElem = n` or `Time = t` triggers. `Time` counts from the
 * start of the state, so it only applies when the range starts at the first frame.
 * `triggers` holds the trigger lines of each HitDef controller, in state order.
 */
export function hitDefTick(triggers: string[][], frames: TimedFrame[], range: HitDefRange = {}): number | undefined {
  const from = range.from ?? 0;
  const to = range.to ?? Number.POSITIVE_INFINITY;
  for (const ctrl of triggers) {
    for (const t of ctrl) {
      // A state can change animation midway; its AnimElem counts then refer to that animation.
      const anims = [...t.matchAll(/\banim\s*=\s*(\d+)/gi)].map((m) => Number(m[1]));
      if (range.action !== undefined && anims.length && !anims.includes(range.action)) continue;
      for (const m of t.matchAll(/animelem\s*=\s*(\d+)/gi)) {
        const i = Number(m[1]) - 1;
        if (i >= from && i <= to) return tickOfFrame(frames, i - from);
      }
      const time = /\btime\s*=\s*(\d+)/i.exec(t);
      if (time && from === 0) return Number(time[1]);
    }
  }
  return undefined;
}

export interface ReachFrame extends TimedFrame {
  dx: number;
  flipH: boolean;
  /** Image width and horizontal axis, in source pixels. */
  w: number;
  ax: number;
}

/**
 * Fallback hit timing for a cut-out range with no HitDef inside it: the frame that reaches
 * furthest forward (the extended limb). Width alone is not enough, since a wind-up that throws
 * the arm behind the body can be the widest frame.
 */
export function forwardReachTick(frames: ReachFrame[], facing: 'right' | 'left'): number {
  const reach = (f: ReachFrame) => {
    // Horizontal extent of the drawn frame, relative to the character's axis.
    const right = f.dx + (f.flipH ? f.ax : f.w - f.ax);
    const left = f.dx - (f.flipH ? f.w - f.ax : f.ax);
    return facing === 'right' ? right : -left;
  };
  const best = frames.reduce((b, f, i) => (reach(f) > reach(frames[b]!) ? i : b), 0);
  return tickOfFrame(frames, best);
}
