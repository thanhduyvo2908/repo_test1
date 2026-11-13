// The viewer's playable character: an animation player and a small fighting-game controller
// (stand, walk, crouch, jump, run, back dash, moves from the .cmd file). No DOM: main.ts feeds
// it input once per tick and render.ts draws it.
import { BUTTONS, DIR, InputHistory, commandActive, parseCommand } from './commands';
import type { Button, ParsedCommand } from './commands';
import type { Stance, ViewerAnim, ViewerAnimFrame, ViewerChar, ViewerMove, ViewerPhysics } from './types';

/** A frame held forever (-1) ends after this many ticks when it is part of a move. */
export const HOLD_IN_MOVE = 30;

export class AnimPlayer {
  elem = 0;
  elemTick = 0;
  /** Ticks since the start, restarting at each loop. */
  tick = 0;
  done = false;

  constructor(
    readonly anim: ViewerAnim,
    readonly loop: boolean,
  ) {
    this.skipEmpty();
  }

  get frame(): ViewerAnimFrame | undefined {
    return this.anim.frames[this.elem];
  }

  /** Total ticks of one pass; held frames count as 0. */
  get total(): number {
    return this.anim.frames.reduce((n, f) => n + Math.max(0, f.ticks), 0);
  }

  step(): void {
    if (this.done) return;
    const f = this.frame;
    if (!f) {
      this.done = true;
      return;
    }
    this.elemTick++;
    this.tick++;
    const limit = f.ticks < 0 ? (this.loop ? Infinity : HOLD_IN_MOVE) : f.ticks;
    if (this.elemTick >= limit) this.advance();
  }

  /** Jumps to an element (for frame stepping while paused). */
  seek(elem: number): void {
    const n = this.anim.frames.length;
    if (!n) return;
    this.elem = ((elem % n) + n) % n;
    this.elemTick = 0;
    this.tick = this.anim.frames.slice(0, this.elem).reduce((s, f) => s + Math.max(0, f.ticks), 0);
    this.done = false;
  }

  private advance(): void {
    this.elem++;
    this.elemTick = 0;
    if (this.elem >= this.anim.frames.length) {
      if (this.loop) {
        this.elem = Math.min(this.anim.loopStart, this.anim.frames.length - 1);
        this.tick = this.anim.frames.slice(0, this.elem).reduce((s, f) => s + Math.max(0, f.ticks), 0);
      } else {
        this.elem = this.anim.frames.length - 1;
        this.done = true;
        return;
      }
    }
    this.skipEmpty();
  }

  /** Zero-tick frames are passed over at once (guarded against all-zero loops). */
  private skipEmpty(): void {
    for (let guard = 0; guard < this.anim.frames.length; guard++) {
      if ((this.frame?.ticks ?? 1) !== 0) return;
      this.elem++;
      if (this.elem >= this.anim.frames.length) {
        if (!this.loop) {
          this.elem = this.anim.frames.length - 1;
          this.done = true;
          return;
        }
        this.elem = Math.min(this.anim.loopStart, this.anim.frames.length - 1);
      }
    }
  }
}

/** Where an animation comes from: the raw source ("src") or an exported game sprite ("game:<id>"). */
export interface AnimRef {
  source: string;
  key: string;
}

export interface FighterInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  buttons: Set<Button>;
}

export type Mode =
  | 'stand'
  | 'walk'
  | 'crouchDown'
  | 'crouch'
  | 'crouchUp'
  | 'jumpStart'
  | 'air'
  | 'land'
  | 'run'
  | 'backdash'
  | 'move'
  | 'show';

const CONTROLLABLE: Mode[] = ['stand', 'walk', 'crouch', 'crouchDown', 'crouchUp', 'air', 'run', 'land'];

/** Sheet sources have no .cmd: buttons play the game slots instead. */
const SHEET_BUTTONS: Partial<Record<Button, string>> = { x: 'basic', y: 's1', z: 's2', a: 's3', b: 'hit', c: 'ko' };

interface MoveCheck {
  move: ViewerMove;
  /** "run" and "dash" are double taps handled as locomotion. */
  role: 'run' | 'dash' | 'move';
}

export class Fighter {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  /** 1 faces right, -1 faces left. */
  facing: 1 | -1 = 1;
  mode: Mode = 'stand';
  player: AnimPlayer;
  ref: AnimRef = { source: 'src', key: '0' };
  /** Name of the move being played, for the status bar. */
  moveName = '';
  /** Ticks left of the "hit lands here" marker (game slots only). */
  hitFlash = 0;
  /** Half-width of the stage, in local units; set by the renderer. */
  bound = 150;
  /** Loop picked animations in "show" mode. */
  loopShow = true;

  readonly history = new InputHistory();
  private readonly commands = new Map<string, ParsedCommand[]>();
  private readonly checks: MoveCheck[] = [];
  private chain: AnimRef[] = [];
  private moveStance: Stance = 'S';
  private pendingAir: { move: ViewerMove; delay: number } | null = null;
  private airDir: 0 | 1 | -1 = 0;
  private activeCache = new Map<string, boolean>();

  constructor(
    readonly ch: ViewerChar,
    readonly sources: Record<string, Record<string, ViewerAnim>>,
  ) {
    for (const [name, defs] of Object.entries(ch.commands)) {
      const parsed = defs.map((d) => parseCommand(d.input, d.time)).filter((p): p is ParsedCommand => p !== null);
      if (parsed.length) this.commands.set(name, parsed);
    }
    for (const move of ch.moves) {
      if (!move.anims.length) continue;
      this.checks.push({ move, role: this.roleOf(move) });
    }
    this.player = new AnimPlayer(this.anim(this.ref) ?? { frames: [], loopStart: 0 }, true);
    this.setLoop(this.standKeys());
  }

  get phys(): ViewerPhysics {
    return this.ch.physics;
  }

  get stance(): Stance {
    if (this.mode === 'air' || this.mode === 'jumpStart' || this.y < 0) return 'A';
    if (this.mode === 'crouch' || this.mode === 'crouchDown') return 'C';
    return 'S';
  }

  get grounded(): boolean {
    return this.y >= 0 && this.vy >= 0;
  }

  anim(ref: AnimRef): ViewerAnim | undefined {
    return this.sources[ref.source]?.[ref.key];
  }

  has(key: string): boolean {
    return this.sources['src']?.[key] !== undefined;
  }

  /** First key that exists in the raw source. */
  private pick(keys: string[]): AnimRef | null {
    for (const key of keys) if (this.has(key)) return { source: 'src', key };
    return null;
  }

  private standKeys(): string[] {
    return ['0', 'idle'];
  }

  private play(ref: AnimRef | null, loop: boolean): void {
    if (!ref) return;
    const anim = this.anim(ref);
    if (!anim) return;
    this.ref = ref;
    this.player = new AnimPlayer(anim, loop);
  }

  /** Loops one of `keys`, unless it is already playing. */
  private setLoop(keys: string[]): void {
    const ref = this.pick(keys);
    if (!ref || (ref.source === this.ref.source && ref.key === this.ref.key && this.player.loop)) return;
    this.play(ref, true);
  }

  private once(keys: string[]): boolean {
    const ref = this.pick(keys);
    if (!ref) return false;
    this.play(ref, false);
    return true;
  }

  private roleOf(move: ViewerMove): MoveCheck['role'] {
    if (move.kind !== 'movement') return 'move';
    for (const c of move.conditions) {
      for (const name of c.cmd) {
        for (const p of this.commands.get(name) ?? []) {
          const dirs = p.steps.map((s) => (s.length === 1 && s[0]!.kind === 'dir' && !s[0]!.hold ? s[0]!.dir : -1));
          if (dirs.length === 2 && dirs.every((d) => d === DIR.F)) return 'run';
          if (dirs.length === 2 && dirs.every((d) => d === DIR.B)) return 'dash';
        }
      }
    }
    return 'move';
  }

  // ---------- Public actions ----------

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.chain = [];
    this.pendingAir = null;
    this.moveName = '';
    this.toStand();
  }

  turn(): void {
    this.facing = this.facing === 1 ? -1 : 1;
  }

  /** Plays one animation in place ("show" mode), from the list or the game slots. */
  show(ref: AnimRef): void {
    if (!this.anim(ref)) return;
    this.chain = [];
    this.pendingAir = null;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.mode = 'show';
    this.moveName = '';
    this.play(ref, this.loopShow);
  }

  /** Starts a move as if its input had been entered. Air-only moves jump first. */
  perform(move: ViewerMove): void {
    const stances = move.conditions.flatMap((c) => c.stance);
    if (stances.length && stances.every((s) => s === 'A') && this.grounded) {
      this.reset();
      this.launchJump(0);
      this.pendingAir = { move, delay: 10 };
      return;
    }
    const role = this.checks.find((c) => c.move === move)?.role ?? 'move';
    // A run only lasts while forward is held; from the list, loop its animation instead.
    if (role === 'run') return this.show({ source: 'src', key: String(move.anims[0]) });
    if (this.mode === 'show') this.toStand();
    this.start({ move, role });
  }

  /** Plays a game slot the way a button does for sheet sources. */
  private startSlot(slot: string): void {
    if (!this.sources['src']?.[slot]) return;
    this.chain = [{ source: 'src', key: slot }];
    this.mode = 'move';
    this.moveStance = this.stance;
    this.moveName = slot;
    if (this.grounded) this.vx = 0;
    this.nextInChain();
  }

  // ---------- Tick ----------

  update(input: FighterInput): void {
    const fwd = this.facing === 1 ? input.right : input.left;
    const back = this.facing === 1 ? input.left : input.right;
    const dir = (input.up ? DIR.U : 0) | (input.down ? DIR.D : 0) | (fwd && !back ? DIR.F : 0) | (back && !fwd ? DIR.B : 0);
    this.history.push(dir, input.buttons);
    this.activeCache.clear();
    if (this.hitFlash > 0) this.hitFlash--;

    if (this.mode === 'show') {
      const prev = this.history.at(this.history.now - 1);
      const now = this.history.at(this.history.now);
      if ((now.dir & ~prev.dir) !== 0 || (now.buttons & ~prev.buttons) !== 0) this.toStand();
      else {
        this.stepAnim();
        return;
      }
    }

    if (this.pendingAir) {
      if (--this.pendingAir.delay <= 0 && this.y < 0) {
        const move = this.pendingAir.move;
        this.pendingAir = null;
        this.start({ move, role: 'move' });
      }
    } else if (CONTROLLABLE.includes(this.mode)) {
      const hit = this.findMove();
      if (hit) this.start(hit);
      else if (this.ch.kind === 'sheet' || !this.checks.length) {
        const pressed = BUTTONS.find((b) => input.buttons.has(b) && this.pressedNow(b));
        const slot = pressed ? SHEET_BUTTONS[pressed] : undefined;
        if (slot) this.startSlot(slot);
      }
    }

    if (CONTROLLABLE.includes(this.mode) || this.mode === 'jumpStart') this.locomotion(dir);
    this.physics();
    this.stepAnim();
  }

  private pressedNow(b: Button): boolean {
    const bit = 1 << BUTTONS.indexOf(b);
    const now = this.history.at(this.history.now).buttons;
    const prev = this.history.at(this.history.now - 1).buttons;
    return (now & bit) !== 0 && (prev & bit) === 0;
  }

  private active(name: string): boolean {
    const cached = this.activeCache.get(name);
    if (cached !== undefined) return cached;
    const value = (this.commands.get(name) ?? []).some((p) => commandActive(p, this.history));
    this.activeCache.set(name, value);
    return value;
  }

  /** A command that can fire on its own: its last step is pressed, not just held. */
  private isEvent(name: string): boolean {
    return (this.commands.get(name) ?? []).some((p) => p.steps[p.steps.length - 1]!.some((el) => !el.hold));
  }

  /**
   * First move whose input was just entered. Moves that name the current stance win over moves
   * that allow any stance, so an air attack is not shadowed by a standing one.
   */
  private findMove(): MoveCheck | null {
    const stance = this.stance;
    for (const strict of [true, false]) {
      for (const check of this.checks) {
        for (const c of check.move.conditions) {
          if (strict ? !c.stance.includes(stance) : c.stance.length > 0) continue;
          if (!c.cmd.some((n) => this.isEvent(n))) continue;
          if (c.cmd.every((n) => this.active(n)) && !c.notCmd.some((n) => this.active(n))) return check;
        }
      }
    }
    return null;
  }

  private start(check: MoveCheck): void {
    const { move, role } = check;
    this.moveName = move.name;
    if (role === 'run' && this.grounded) {
      this.mode = 'run';
      this.play({ source: 'src', key: String(move.anims[0]) }, true);
      return;
    }
    if (role === 'dash' && this.grounded) {
      this.mode = 'backdash';
      this.play({ source: 'src', key: String(move.anims[0]) }, false);
      this.vx = -Math.abs(this.phys.runBack[0]) * this.facing;
      this.vy = this.phys.runBack[1];
      this.y = Math.min(this.y, -0.01);
      return;
    }
    this.moveStance = this.stance;
    this.chain = move.anims.map((a) => ({ source: 'src', key: String(a) }));
    this.mode = 'move';
    if (this.grounded) this.vx = 0;
    this.nextInChain();
  }

  private nextInChain(): void {
    const next = this.chain.shift();
    if (next && this.anim(next)) this.play(next, false);
    else this.endMove();
  }

  private endMove(): void {
    this.chain = [];
    this.moveName = '';
    if (!this.grounded) {
      this.mode = 'air';
      this.airAnim();
    } else if (this.moveStance === 'C' && this.history.at(this.history.now).dir & DIR.D) {
      this.mode = 'crouch';
      this.setLoop(['11', '0', 'idle']);
    } else this.toStand();
  }

  private toStand(): void {
    this.mode = 'stand';
    this.vx = 0;
    this.setLoop(this.standKeys());
  }

  private launchJump(dirX: 0 | 1 | -1): void {
    this.mode = 'air';
    this.airDir = dirX;
    this.vy = this.phys.jumpNeu[1];
    this.vx = dirX === 0 ? this.phys.jumpNeu[0] * this.facing : (dirX === 1 ? this.phys.jumpFwd : this.phys.jumpBack) * this.facing;
    this.y = -0.01;
    this.airAnim(true);
  }

  private airAnim(force = false): void {
    const rising = this.vy < -2;
    const keys =
      this.airDir === 1 ? (rising ? ['42', '41'] : ['45', '44', '42', '41']) : this.airDir === -1 ? (rising ? ['43', '41'] : ['46', '44', '43', '41']) : rising ? ['41'] : ['44', '41'];
    if (force) {
      const ref = this.pick([...keys, ...this.standKeys()]);
      if (ref) this.play(ref, true);
    } else this.setLoop([...keys, ...this.standKeys()]);
  }

  private locomotion(dir: number): void {
    const down = (dir & DIR.D) !== 0;
    const up = (dir & DIR.U) !== 0;
    const fwd = (dir & DIR.F) !== 0;
    const back = (dir & DIR.B) !== 0;
    switch (this.mode) {
      case 'air':
        this.airAnim();
        return;
      case 'run':
        if (!fwd) return this.toStand();
        this.vx = this.phys.runFwd * this.facing;
        if (up) this.launchJump(1);
        return;
      case 'jumpStart':
      case 'land':
      case 'crouchUp':
        if (!this.player.done) return;
        if (this.mode === 'jumpStart') return this.launchJump(fwd ? 1 : back ? -1 : 0);
        this.mode = 'stand';
        break;
      case 'crouchDown':
        if (!down) {
          this.mode = this.once(['12']) ? 'crouchUp' : 'stand';
          return;
        }
        if (this.player.done) {
          this.mode = 'crouch';
          this.setLoop(['11', '0', 'idle']);
        }
        return;
      case 'crouch':
        if (!down) {
          this.mode = this.once(['12']) ? 'crouchUp' : 'stand';
          if (this.mode === 'stand') this.setLoop(this.standKeys());
        }
        return;
      default:
        break;
    }
    // Standing or walking.
    if (up) {
      this.vx = 0;
      if (this.once(['40'])) this.mode = 'jumpStart';
      else this.launchJump(fwd ? 1 : back ? -1 : 0);
      return;
    }
    if (down) {
      this.vx = 0;
      if (this.once(['10'])) this.mode = 'crouchDown';
      else {
        this.mode = 'crouch';
        this.setLoop(['11', '0', 'idle']);
      }
      return;
    }
    if (fwd || back) {
      this.mode = 'walk';
      this.vx = (fwd ? this.phys.walkFwd : this.phys.walkBack) * this.facing;
      this.setLoop(fwd ? ['20', '0', 'idle'] : ['21', '20', '0', 'idle']);
      return;
    }
    this.toStand();
  }

  private physics(): void {
    if (this.mode === 'show') return;
    if (this.y < 0 || this.vy < 0) {
      this.vy += this.phys.yAccel;
      this.y += this.vy;
      if (this.y >= 0) {
        this.y = 0;
        this.vy = 0;
        this.vx = 0;
        this.chain = [];
        this.moveName = '';
        this.mode = this.once(['47']) ? 'land' : 'stand';
        if (this.mode === 'stand') this.setLoop(this.standKeys());
      }
    }
    this.x += this.vx;
    if (Math.abs(this.x) > this.bound) this.x = Math.sign(this.x) * this.bound;
  }

  private stepAnim(): void {
    this.player.step();
    const hitTick = this.player.anim.hitTick;
    if (hitTick !== undefined && this.player.tick === hitTick) this.hitFlash = 10;
    if (!this.player.done) return;
    if (this.mode === 'move') this.nextInChain();
    else if (this.mode === 'backdash' && this.grounded) this.toStand();
  }
}
