// Loads a MUGEN character from its .def file: sprites, animations, states and moves.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { parseAir } from './air';
import type { AirAction } from './air';
import { findSection, getValue, parseIni, unquote } from './ini';
import { readAct, readSff } from './sff';
import type { Sff } from './sff';
import { analyzeMoves, parseStates } from './states';
import type { MoveInfo, StateDef } from './states';

export const readText = (p: string): string => readFileSync(p, 'latin1');

/** Character .def files under a folder. Storyboards (intro.def, ending.def) have no [Files] and are skipped. */
export function findCharacterDefs(dir: string, depth = 3): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory() && depth > 0) out.push(...findCharacterDefs(p, depth - 1));
    else if (st.isFile() && extname(name).toLowerCase() === '.def' && /^\s*\[files\]/im.test(readText(p))) out.push(p);
  }
  return out;
}

/** Resolves a path written in a .def file, tolerating wrong folders and letter case. */
export function resolveCharFile(defDir: string, value: string | undefined): string | undefined {
  const v = unquote(value)?.trim();
  if (!v) return undefined;
  const direct = resolve(defDir, v);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const base = basename(v.replace(/\\/g, '/')).toLowerCase();
  const hit = readdirSync(defDir).find((n) => n.toLowerCase() === base);
  return hit ? join(defDir, hit) : undefined;
}

export interface MugenCharacter {
  defPath: string;
  name: string;
  author: string;
  mugenVersion: string;
  sff: Sff;
  air: Map<number, AirAction>;
  states: Map<number, StateDef>;
  moves: MoveInfo[];
  missingStateFiles: string[];
  readmes: string[];
}

export function loadCharacter(defPath: string): MugenCharacter {
  const defDir = dirname(defPath);
  const def = parseIni(readText(defPath));
  const info = findSection(def, 'Info');
  const files = findSection(def, 'Files');
  if (!files) throw new Error(`${defPath}: missing [Files]`);
  const file = (k: string) => resolveCharFile(defDir, getValue(files, k));
  const sffPath = file('sprite');
  const airPath = file('anim');
  if (!sffPath || !airPath) throw new Error(`${defPath}: sprite or anim file not found`);
  const stateKeys = ['cns', 'st', ...Array.from({ length: 10 }, (_, i) => `st${i}`), 'stcommon'];
  const statePaths = [...new Set(stateKeys.map(file).filter((p): p is string => p !== undefined))];
  const missingStateFiles = stateKeys.filter((k) => getValue(files, k) && !file(k)).map((k) => `${k} = ${getValue(files, k)}`);
  const actPath = file('pal1');
  const sff = readSff(readFileSync(sffPath), actPath ? readAct(readFileSync(actPath)) : undefined);
  const air = parseAir(readText(airPath));
  const cmdPath = file('cmd');
  const cmdText = cmdPath ? readText(cmdPath) : '';
  const states = parseStates([cmdText, ...statePaths.map(readText)]);
  const moves = analyzeMoves(cmdText, states, (id) => air.has(id));
  const infoValue = (k: string) => (info ? unquote(getValue(info, k)) : undefined);
  return {
    defPath,
    name: infoValue('displayname') || infoValue('name') || basename(defPath),
    author: infoValue('author') ?? '',
    mugenVersion: infoValue('mugenversion') ?? '',
    sff,
    air,
    states,
    moves,
    missingStateFiles,
    readmes: readdirSync(defDir).filter((n) => /readme|leeme|\.txt$/i.test(n)),
  };
}
