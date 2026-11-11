// Scans assets-raw/ and writes tools/out/sprite-inventory.json: one entry per MUGEN character
// and per GBA sheet, with the facts needed to pick sprite sources (author, moves, which
// animation slots exist, sprite height).
//
// Usage: npm run sprite:inventory
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCharacterDefs, loadCharacter } from './mugen/character';
import type { MugenCharacter } from './mugen/character';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'assets-raw');

export interface MugenEntry {
  kind: 'mugen';
  folder: string;
  def: string;
  name: string;
  author: string;
  mugenVersion: string;
  sffVersion: number;
  sprites: number;
  actions: number;
  moves: number;
  supers: number;
  throws: number;
  /** Moves that are neither throws nor use fightfx effects. */
  cleanMoves: number;
  idle: boolean;
  hit: boolean;
  ko: boolean;
  portraitSmall: boolean;
  portraitLarge: boolean;
  /** Height in pixels of the first idle frame; compares sprite scale across sources. */
  idleHeight: number | null;
  readmes: string[];
  error?: string;
}

export interface SheetEntry {
  kind: 'sheet';
  folder: string;
  file: string;
  frames: number | null;
}

/** An action exists and at least one of its frames has a sprite. */
function hasAction(c: MugenCharacter, ids: number[]): boolean {
  return ids.some((id) => c.air.get(id)?.frames.some((f) => c.sff.get(f.group, f.image)) ?? false);
}

function idleHeight(c: MugenCharacter): number | null {
  const f = c.air.get(0)?.frames.find((fr) => c.sff.get(fr.group, fr.image));
  return f ? (c.sff.get(f.group, f.image)?.height ?? null) : null;
}

function scanMugen(): MugenEntry[] {
  const out: MugenEntry[] = [];
  const defs = findCharacterDefs(RAW, 5);
  defs.forEach((defPath, i) => {
    const folder = relative(RAW, dirname(defPath)).replace(/\\/g, '/');
    const def = relative(RAW, defPath).replace(/\\/g, '/');
    process.stdout.write(`\r[${i + 1}/${defs.length}] ${folder.padEnd(60).slice(0, 60)}`);
    try {
      const c = loadCharacter(defPath);
      out.push({
        kind: 'mugen',
        folder,
        def,
        name: c.name,
        author: c.author,
        mugenVersion: c.mugenVersion,
        sffVersion: c.sff.version,
        sprites: c.sff.sprites.length,
        actions: c.air.size,
        moves: c.moves.length,
        supers: c.moves.filter((m) => m.flags.powerCost >= 1000).length,
        throws: c.moves.filter((m) => m.flags.throwReasons.length > 0).length,
        cleanMoves: c.moves.filter((m) => !m.flags.throwReasons.length && !m.flags.fightfxAnims.length).length,
        idle: hasAction(c, [0]),
        hit: hasAction(c, [5000, 5001, 5002, 5010]),
        ko: hasAction(c, [5150, 5140, 5110]),
        portraitSmall: c.sff.get(9000, 0) !== undefined,
        portraitLarge: c.sff.get(9000, 1) !== undefined,
        idleHeight: idleHeight(c),
        readmes: c.readmes,
      });
    } catch (e) {
      out.push({
        kind: 'mugen', folder, def, name: '', author: '', mugenVersion: '', sffVersion: 0, sprites: 0, actions: 0, moves: 0,
        supers: 0, throws: 0, cleanMoves: 0, idle: false, hit: false, ko: false, portraitSmall: false, portraitLarge: false,
        idleHeight: null, readmes: [], error: (e as Error).message,
      });
    }
  });
  process.stdout.write('\n');
  return out;
}

function scanSheets(): SheetEntry[] {
  const out: SheetEntry[] = [];
  for (const folder of readdirSync(RAW)) {
    const dir = join(RAW, folder);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir).filter((n) => /\.(gif|png)$/i.test(n))) {
      const framesJson = join(ROOT, 'tools', 'out', 'sheets', folder, file.replace(/\./g, '_'), 'frames.json');
      const frames = existsSync(framesJson) ? (JSON.parse(readFileSync(framesJson, 'utf8')) as { frames: unknown[] }).frames.length : null;
      out.push({ kind: 'sheet', folder, file, frames });
    }
  }
  return out;
}

const mugen = scanMugen();
const sheets = scanSheets();
mkdirSync(join(ROOT, 'tools', 'out'), { recursive: true });
writeFileSync(join(ROOT, 'tools', 'out', 'sprite-inventory.json'), JSON.stringify({ mugen, sheets }, null, 2));
console.log(`${mugen.length} MUGEN characters (${mugen.filter((m) => m.error).length} with errors), ${sheets.length} sheets -> tools/out/sprite-inventory.json`);
