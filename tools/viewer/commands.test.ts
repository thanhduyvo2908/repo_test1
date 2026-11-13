import { describe, expect, it } from 'vitest';
import { DIR, InputHistory, commandActive, inputGlyphs, parseCommand } from './commands';
import type { Button } from './commands';

const { U, D, F, B } = DIR;

/** Feeds a list of [dir, buttons, ticks] into a fresh history. */
function play(seq: [number, Button[], number][]): InputHistory {
  const h = new InputHistory();
  for (const [dir, buttons, ticks] of seq) for (let i = 0; i < ticks; i++) h.push(dir, buttons);
  return h;
}

describe('parseCommand', () => {
  it('reads prefixes, directions and buttons', () => {
    const c = parseCommand('~D, DF, F, x')!;
    expect(c.steps).toHaveLength(4);
    expect(c.steps[0]![0]).toMatchObject({ kind: 'dir', dir: D, release: true });
    expect(c.steps[1]![0]).toMatchObject({ kind: 'dir', dir: D | F });
    expect(c.steps[3]![0]).toMatchObject({ kind: 'button', button: 'x' });
    expect(parseCommand('/$F')!.steps[0]![0]).toMatchObject({ hold: true, loose: true, dir: F });
    expect(parseCommand('~30$B, F, a')!.steps[0]![0]).toMatchObject({ release: true, loose: true, dir: B });
    expect(parseCommand('a+b')!.steps[0]).toHaveLength(2);
  });

  it('rejects unknown tokens', () => {
    expect(parseCommand('D, Q')).toBeNull();
    expect(parseCommand('')).toBeNull();
  });
});

describe('commandActive', () => {
  const qcf = parseCommand('~D, DF, F, x', 15)!;

  it('matches a quarter circle forward with a button', () => {
    const h = play([
      [0, [], 3],
      [D, [], 2],
      [D | F, [], 2],
      [F, [], 2],
      [F, ['x'], 1],
    ]);
    expect(commandActive(qcf, h)).toBe(true);
  });

  it('accepts the button on the same tick as the last direction', () => {
    const h = play([
      [D, [], 2],
      [D | F, [], 2],
      [F, ['x'], 1],
    ]);
    expect(commandActive(qcf, h)).toBe(true);
  });

  it('fails when the motion is too slow or the button is held from before', () => {
    const slow = play([
      [D, [], 2],
      [D | F, [], 20],
      [F, [], 2],
      [F, ['x'], 1],
    ]);
    expect(commandActive(qcf, slow)).toBe(false);
    const heldButton = play([
      [D, ['x'], 2],
      [D | F, ['x'], 2],
      [F, ['x'], 2],
    ]);
    expect(commandActive(qcf, heldButton)).toBe(false);
  });

  it('only fires on the tick of the last step', () => {
    const h = play([
      [D, [], 2],
      [D | F, [], 2],
      [F, ['x'], 1],
      [F, ['x'], 1],
    ]);
    expect(commandActive(qcf, h)).toBe(false);
  });

  it('needs two separate taps for a double tap', () => {
    const ff = parseCommand('F, F', 10)!;
    expect(commandActive(ff, play([[F, [], 6]]))).toBe(false);
    expect(commandActive(ff, play([[F, [], 3], [0, [], 2], [F, [], 1]]))).toBe(true);
  });

  it('treats hold commands as active while held', () => {
    const holdDown = parseCommand('/$D')!;
    expect(commandActive(holdDown, play([[D | B, [], 5]]))).toBe(true);
    expect(commandActive(holdDown, play([[B, [], 5]]))).toBe(false);
  });

  it('matches buttons pressed together within a couple of ticks', () => {
    const ab = parseCommand('a+b')!;
    expect(commandActive(ab, play([[0, [], 2], [0, ['a'], 1], [0, ['a', 'b'], 1]]))).toBe(true);
    expect(commandActive(ab, play([[0, [], 2], [0, ['a'], 5], [0, ['a', 'b'], 1]]))).toBe(false);
  });

  it('matches a release followed by a press in the same tick', () => {
    const superJump = parseCommand('~D, U', 10)!;
    expect(commandActive(superJump, play([[D, [], 4], [U, [], 1]]))).toBe(true);
  });
});

describe('inputGlyphs', () => {
  it('shows motions as arrows and buttons by name', () => {
    expect(inputGlyphs('~D, DF, F, a').map((g) => g.text)).toEqual(['↓', '↘', '→', 'a']);
    expect(inputGlyphs('/F, a')[0]).toMatchObject({ kind: 'dir', text: '→', hold: true });
    expect(inputGlyphs('x+y').map((g) => g.text)).toEqual(['x', '+', 'y']);
  });
});
