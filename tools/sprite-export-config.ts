// What tools/sprite-export.ts exports: one entry per game sprite id.
//
// MUGEN entries pick animation slots automatically (see pickMugenSlots in sprite-export.ts);
// `actions` overrides a slot with a specific AIR action number.
// Sheet entries take their slots from tools/sheets/<folder>.json (frame indices from
// `npm run sheet:preview`), under the sheet's file name.

export const SLOTS = ['idle', 'basic', 's1', 's2', 's3', 'hit', 'ko'] as const;
export type Slot = (typeof SLOTS)[number];

interface Common {
  /** Pack id: the folder name under packs/onepiece/assets/. */
  id: string;
  /** Direction the source art faces. Defaults to "right". */
  facing?: 'right' | 'left';
  /** Size multiplier for the whole source set. Defaults to 1. */
  scale?: number;
}

/**
 * A slot override: an AIR action number, or part of an action. `from` and `to` are 0-based
 * frame indices (inclusive); use them when one MUGEN move chains several techniques.
 */
export type ActionPick = number | { action: number; from?: number; to?: number };

export type ExportEntry =
  | (Common & { mugen: string; actions?: Partial<Record<Slot, ActionPick>>; portrait?: [number, number] })
  | (Common & { sheet: string });

export const EXPORTS: ExportEntry[] = [
  // Playable and bosses, MUGEN (One Piece Mugen V14).
  {
    id: 'luffy',
    mugen: 'op14/chars/Luffy_Start/Luffy_Start.def',
    // S1 Gum-Gum Pistol: the straight punch that ends action 1500 (frames 0-10 are a Gatling).
    // Action 1000, the automatic pick, punches diagonally upward.
    actions: { s1: { action: 1500, from: 11, to: 21 } },
  },
  { id: 'zoro', mugen: 'op14/chars/Zoro_JUS/Zoro_JUS.def' },
  { id: 'morgan', mugen: 'op14/chars/Morgan_JUS/Morgan_JUS.def' },
  { id: 'nami', mugen: 'op14/chars/Nami/Nami.def' },
  { id: 'buggy', mugen: 'op14/chars/Buggy/Buggy.def' },
  { id: 'usopp', mugen: 'op14/chars/Usopp/Usopp.def' },
  { id: 'kuro', mugen: 'op14/chars/Kuro/Kuro.def' },
  { id: 'sanji', mugen: 'op14/chars/Sanji_V2/Sanji_V2/Sanji_V2.def' },
  { id: 'don-krieg', mugen: 'op14/chars/Krieg/Krieg.def' },
  // Bosses and grunts from GBA sheets.
  { id: 'alvida', sheet: 'alvida-gba/Alvida.gif' },
  { id: 'jango', sheet: 'jango-gba/Django.gif' },
  { id: 'gin', sheet: 'gin-gba/Ghin.gif' },
  { id: 'cabaji', sheet: 'cabaji-gba/Cabaji-paddy.png' },
  // Grunts: ids match packs/onepiece/enemies.ts. Crews share a base sheet until recolours exist.
  { id: 'alvida-pirate', sheet: 'pirate-gba/SwdPirates.gif' },
  { id: 'buggy-pirate', sheet: 'pirate-gba/SwdPirates.gif' },
  { id: 'black-cat-pirate', sheet: 'pirate-gba/SwdPirates.gif' },
  { id: 'krieg-pirate', sheet: 'pirate-gba/SwdPirates.gif' },
  { id: 'marine-soldier', sheet: 'marine-gba/MarineSword.gif', facing: 'left' },
  { id: 'marine-officer', sheet: 'marine-gba/MarineSword.gif', facing: 'left' },
];
