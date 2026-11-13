// MUGEN command inputs (the `command = ~D, DF, F, x` lines of a .cmd file): parsing, a tick
// history of the controller, and a forgiving matcher, so the viewer can be played like the
// fighting game the sprites come from. Pure TypeScript, used by the page and by tests.
//
// Simplifications against MUGEN: ">" (no other input in between) is ignored, "/" holds and "$"
// directions match loosely, and "~N" charge times are not enforced.

/** Direction bits, relative to facing. */
export const DIR = { U: 1, D: 2, F: 4, B: 8 } as const;

const DIR_NAMES: Record<string, number> = {
  U: DIR.U,
  D: DIR.D,
  F: DIR.F,
  B: DIR.B,
  UF: DIR.U | DIR.F,
  UB: DIR.U | DIR.B,
  DF: DIR.D | DIR.F,
  DB: DIR.D | DIR.B,
};

export const BUTTONS = ['x', 'y', 'z', 'a', 'b', 'c', 's', 'd', 'w'] as const;
export type Button = (typeof BUTTONS)[number];

export interface InputElement {
  kind: 'dir' | 'button';
  /** Direction bits, or the button name. */
  dir: number;
  button: Button | '';
  /** "/": held rather than pressed. */
  hold: boolean;
  /** "~": released rather than pressed. */
  release: boolean;
  /** "$": a direction also matches the diagonals that contain it. */
  loose: boolean;
}

/** One comma-separated step; several elements joined by "+" happen together. */
export type InputStep = InputElement[];

export interface ParsedCommand {
  steps: InputStep[];
  time: number;
}

function parseElement(token: string): InputElement | null {
  let rest = token.trim();
  const el: InputElement = { kind: 'dir', dir: 0, button: '', hold: false, release: false, loose: false };
  for (;;) {
    const c = rest[0];
    if (c === '>') rest = rest.slice(1);
    else if (c === '/') {
      el.hold = true;
      rest = rest.slice(1);
    } else if (c === '$') {
      el.loose = true;
      rest = rest.slice(1);
    } else if (c === '~') {
      el.release = true;
      rest = rest.slice(1).replace(/^\d+/, '');
    } else break;
    rest = rest.trimStart();
  }
  const dir = DIR_NAMES[rest];
  if (dir !== undefined) {
    el.dir = dir;
    return el;
  }
  const b = rest.toLowerCase() as Button;
  if ((BUTTONS as readonly string[]).includes(b)) {
    el.kind = 'button';
    el.button = b;
    return el;
  }
  return null;
}

/** Parses a .cmd input. Returns null when any part is not understood. */
export function parseCommand(input: string, time = 15): ParsedCommand | null {
  const steps: InputStep[] = [];
  for (const part of input.split(',')) {
    if (!part.trim()) continue;
    const step: InputStep = [];
    for (const token of part.split('+')) {
      const el = parseElement(token);
      if (!el) return null;
      step.push(el);
    }
    steps.push(step);
  }
  return steps.length ? { steps, time } : null;
}

// ---------- Input history ----------

export interface InputSnapshot {
  dir: number;
  buttons: number;
}

const buttonBit = (b: Button): number => 1 << BUTTONS.indexOf(b);

/** The last few seconds of controller state, one snapshot per tick. */
export class InputHistory {
  private readonly snaps: InputSnapshot[] = [];
  private tick = -1;

  constructor(private readonly capacity = 180) {}

  /** Records the state for the next tick. `buttons` lists the buttons held. */
  push(dir: number, buttons: Iterable<Button>): void {
    let bits = 0;
    for (const b of buttons) bits |= buttonBit(b);
    this.snaps.push({ dir, buttons: bits });
    if (this.snaps.length > this.capacity) this.snaps.shift();
    this.tick++;
  }

  /** Current tick number (0 after the first push). */
  get now(): number {
    return this.tick;
  }

  /** Snapshot at an absolute tick, or an empty one outside the buffer. */
  at(tick: number): InputSnapshot {
    const i = this.snaps.length - 1 - (this.tick - tick);
    return this.snaps[i] ?? { dir: 0, buttons: 0 };
  }

  /** Oldest tick still in the buffer. */
  get oldest(): number {
    return this.tick - this.snaps.length + 1;
  }

  clear(): void {
    this.snaps.length = 0;
    this.tick = -1;
  }
}

// ---------- Matching ----------

function dirMatches(el: InputElement, dir: number): boolean {
  if (el.loose || el.hold) return (dir & el.dir) === el.dir;
  return dir === el.dir;
}

function held(el: InputElement, s: InputSnapshot): boolean {
  return el.kind === 'dir' ? dirMatches(el, s.dir) : (s.buttons & buttonBit(el.button as Button)) !== 0;
}

/** True if the element happens exactly at `tick` (held elements: is held then). */
function happensAt(el: InputElement, h: InputHistory, tick: number): boolean {
  const cur = h.at(tick);
  if (el.hold) return held(el, cur);
  const prev = h.at(tick - 1);
  if (el.release) return held(el, prev) && !held(el, cur);
  return held(el, cur) && !held(el, prev);
}

/** Ticks of slack between buttons pressed "together" (a+b). */
const TOGETHER = 2;

function stepAt(step: InputStep, h: InputHistory, tick: number): boolean {
  let exact = false;
  for (const el of step) {
    if (happensAt(el, h, tick)) {
      exact = true;
      continue;
    }
    if (el.hold) return false;
    let near = false;
    for (let t = tick - 1; t >= tick - TOGETHER; t--) if (happensAt(el, h, t)) near = true;
    if (!near) return false;
  }
  return exact;
}

/**
 * True if the command's last step happens within the last `buffer` ticks and every earlier
 * step happens before it, all within the command's time window.
 */
export function commandActive(cmd: ParsedCommand, h: InputHistory, buffer = 1): boolean {
  const last = cmd.steps[cmd.steps.length - 1];
  if (!last || h.now < 0) return false;
  for (let end = h.now; end > h.now - buffer && end >= h.oldest; end--) {
    if (!stepAt(last, h, end)) continue;
    if (earlierSteps(cmd, h, end)) return true;
  }
  return false;
}

function earlierSteps(cmd: ParsedCommand, h: InputHistory, end: number): boolean {
  const start = Math.max(h.oldest, end - cmd.time);
  let next = end;
  for (let i = cmd.steps.length - 2; i >= 0; i--) {
    const step = cmd.steps[i]!;
    const following = cmd.steps[i + 1]!;
    // A release and the press that follows it happen in the same tick (D to DF releases D),
    // and a button may land on the same tick as the direction before it.
    const sameTick =
      step.every((el) => el.release || el.hold) ||
      (step.every((el) => el.kind === 'dir') && following.every((el) => el.kind === 'button'));
    let found = -1;
    for (let t = sameTick ? next : next - 1; t >= start; t--) {
      if (stepAt(step, h, t)) {
        found = t;
        break;
      }
    }
    if (found < 0) return false;
    next = found;
  }
  return true;
}

// ---------- Display ----------

const ARROWS: Record<string, string> = {
  U: '↑',
  D: '↓',
  F: '→',
  B: '←',
  UF: '↗',
  UB: '↖',
  DF: '↘',
  DB: '↙',
};

export interface InputGlyph {
  /** "dir" glyphs are arrows; "button" glyphs name a MUGEN button. */
  kind: 'dir' | 'button' | 'sep';
  text: string;
  hold?: boolean;
}

/**
 * Turns `~D, DF, F, x` into glyphs for the move list. Releases at the start of a motion
 * (`~D`) are shown as the direction itself, since that is what the player presses.
 */
export function inputGlyphs(input: string): InputGlyph[] {
  const out: InputGlyph[] = [];
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean);
  parts.forEach((part, i) => {
    if (i > 0 && out.length && out[out.length - 1]!.kind === 'button') out.push({ kind: 'sep', text: ',' });
    part.split('+').forEach((token, j) => {
      if (j > 0) out.push({ kind: 'sep', text: '+' });
      const raw = token.trim();
      const hold = raw.includes('/');
      const name = raw.replace(/^[>~/$\d\s]+/, '');
      if (ARROWS[name]) out.push({ kind: 'dir', text: ARROWS[name]!, hold });
      else out.push({ kind: 'button', text: name.toLowerCase(), hold });
    });
  });
  return out;
}
