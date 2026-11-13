import { describe, expect, it } from 'vitest';
import { forwardReachTick, hitDefTick, middleTick, tickOfFrame } from './sprite-hit';

const timed = (...ticks: number[]) => ticks.map((t) => ({ ticks: t }));

describe('tickOfFrame and middleTick', () => {
  it('sums the ticks before a frame, counting held frames as 0', () => {
    expect(tickOfFrame(timed(5, -1, 3, 4), 3)).toBe(8);
    expect(tickOfFrame(timed(5, 3), 0)).toBe(0);
    expect(middleTick(timed(2, 2, 2, 2))).toBe(4);
  });
});

describe('hitDefTick', () => {
  const frames = timed(2, 2, 2, 2, 2, 2);

  it('reads the first AnimElem of the first HitDef', () => {
    expect(hitDefTick([['animelem = 3'], ['animelem = 5']], frames)).toBe(4);
  });

  it('reads Time when the range starts at the first frame', () => {
    expect(hitDefTick([['Time = 7']], frames)).toBe(7);
    expect(hitDefTick([['time = 7']], frames, { from: 2, to: 5 })).toBeUndefined();
  });

  it('takes only HitDefs inside a cut-out range, timed from the range start', () => {
    // A Gatling hits on elements 4, 6, 8 and 10; the Pistol that follows hits on element 20.
    const hitDefs = [['animelem = 4||animelem = 6||animelem = 8||animelem = 10'], ['animelem = 20']];
    const kept = timed(2, 1, 2, 2, 30, 1, 1, 1, 5, 20, 7); // action frames 11..21
    expect(hitDefTick(hitDefs, kept, { from: 11, to: 21 })).toBe(40);
    expect(hitDefTick(hitDefs, timed(2, 2, 2, 2), { from: 0, to: 10 })).toBe(6);
  });

  it('skips trigger lines that time another animation of the state', () => {
    // The state charges in action 3000, then changes to 3001 or 3002 where the hits land.
    const hitDefs = [['anim = 3001 && (animelem = 6||animelem = 8)', '(anim = 3002||anim = 3003) && (animelem = 2||animelem = 4)']];
    expect(hitDefTick(hitDefs, frames, { action: 3000, from: 0, to: 3 })).toBeUndefined();
    expect(hitDefTick(hitDefs, frames, { action: 3002 })).toBe(2);
    // `Anim != n` does not name the animation being timed.
    expect(hitDefTick([['anim != 3003 && animelem = 3']], frames, { action: 3000 })).toBe(4);
  });

  it('returns undefined without a HitDef', () => {
    expect(hitDefTick([], frames)).toBeUndefined();
  });
});

describe('forwardReachTick', () => {
  const frame = (ticks: number, w: number, ax: number, dx = 0, flipH = false) => ({ ticks, w, ax, dx, flipH });

  it('skips a wide wind-up that reaches behind and picks the forward punch', () => {
    // Arm thrown back: 195 px wide but only 30 px in front of the axis.
    const frames = [frame(2, 32, 16), frame(30, 195, 165), frame(1, 72, 20), frame(5, 48, 24)];
    expect(forwardReachTick(frames, 'right')).toBe(32);
  });

  it('measures the other side for art that faces left', () => {
    const frames = [frame(2, 32, 16), frame(3, 100, 90), frame(4, 100, 10)];
    expect(forwardReachTick(frames, 'left')).toBe(2);
    expect(forwardReachTick(frames, 'right')).toBe(5);
  });

  it('accounts for flipped frames and offsets', () => {
    // Flipped, the 90 px side of the image lands in front of the axis.
    const frames = [frame(2, 60, 10, 0, false), frame(3, 100, 90, 0, true), frame(4, 40, 20, 50)];
    expect(forwardReachTick(frames, 'right')).toBe(2);
  });
});
