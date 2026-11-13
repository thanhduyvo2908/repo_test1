// Data the character viewer's dev middleware (server.ts) sends to the page (main.ts).
// No Node or DOM imports: both sides use these types.

export type SourceKind = 'mugen' | 'sheet';

export interface ViewerListItem {
  /** Source path relative to assets-raw/, with forward slashes. Used as the id in URLs. */
  key: string;
  name: string;
  kind: SourceKind;
  author: string;
  /** Game sprite ids exported from this source (tools/sprite-export-config.ts). */
  gameIds: string[];
}

export interface ViewerList {
  items: ViewerListItem[];
  /** Game sprite ids that have an exported atlas under packs/<pack>/assets/. */
  exported: Record<string, string>;
}

/** A sprite in an atlas page, with its anchor (MUGEN axis, or the feet for sheets). */
export interface ViewerFrame {
  p: number;
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
  /** Where the sprite came from: "group,image" for MUGEN, "#n" for a sheet box. */
  src: string;
}

export interface ViewerAnimFrame {
  f: number;
  dx: number;
  dy: number;
  /** 60 ticks per second; -1 holds the frame forever. */
  ticks: number;
  flipH: boolean;
  flipV?: boolean;
}

export interface ViewerAnim {
  frames: ViewerAnimFrame[];
  loopStart: number;
  /** Game slots only: tick at which the hit lands. */
  hitTick?: number;
}

export type Stance = 'S' | 'C' | 'A';

/** One way to trigger a move: all of `cmd` active, none of `notCmd`, stance allowed. */
export interface ViewerCondition {
  cmd: string[];
  notCmd: string[];
  /** Allowed stances; empty means any. */
  stance: Stance[];
}

export type MoveKind = 'normal' | 'special' | 'super' | 'movement';

export interface ViewerMove {
  /** Section title in the .cmd file, e.g. "Gomu Gomu no Pistol Shoot". */
  name: string;
  state: number;
  kind: MoveKind;
  power: number;
  /** Any one of these triggers the move. */
  conditions: ViewerCondition[];
  /** AIR actions the move plays, in order. */
  anims: number[];
  /** Animations of projectiles, helpers and explods spawned by the move. */
  effectAnims: number[];
  /** Grabs, fightfx effects: the move may look incomplete outside MUGEN. */
  notes: string[];
}

export interface ViewerCommand {
  name: string;
  input: string;
  /** Ticks allowed to enter the whole input. */
  time: number;
}

export interface ViewerPhysics {
  walkFwd: number;
  walkBack: number;
  runFwd: number;
  runBack: [number, number];
  jumpNeu: [number, number];
  jumpFwd: number;
  jumpBack: number;
  yAccel: number;
}

export interface ViewerChar {
  key: string;
  name: string;
  author: string;
  kind: SourceKind;
  /** Number of atlas pages, fetched one by one. */
  pages: number;
  frames: ViewerFrame[];
  /** MUGEN: keyed by AIR action number. Sheets: keyed by slot name. */
  anims: Record<string, ViewerAnim>;
  moves: ViewerMove[];
  /** Keyed by lower-cased name; MUGEN allows several inputs under one name. */
  commands: Record<string, ViewerCommand[]>;
  physics: ViewerPhysics;
  /** Draw size per source pixel: [Size] xscale/yscale times 320 / localcoord width. */
  spriteScale: [number, number];
  /** Local units to 320-wide stage units, for velocities. */
  coordScale: number;
  /** Direction the art faces. */
  facing: 'right' | 'left';
  gameIds: string[];
  notes: string[];
}

/** packs/<pack>/assets/<id>/sprite.json, as written by tools/sprite-export.ts. */
export interface GameSprite {
  id: string;
  source: string;
  facing: 'right' | 'left';
  height: number | null;
  scale: number;
  frames: { x: number; y: number; w: number; h: number; ax: number; ay: number }[];
  anims: Record<string, ViewerAnim>;
  portrait: number | null;
}

export const DEFAULT_PHYSICS: ViewerPhysics = {
  walkFwd: 2.4,
  walkBack: -2.2,
  runFwd: 4.6,
  runBack: [-4.5, -3.8],
  jumpNeu: [0, -8.4],
  jumpFwd: 2.5,
  jumpBack: -2.55,
  yAccel: 0.44,
};
