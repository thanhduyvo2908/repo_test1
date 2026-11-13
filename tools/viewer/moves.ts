// Reads a MUGEN character's move list for the viewer: the [Command] inputs of the .cmd file
// and the ChangeState controllers of state -1 that start each move, with the command and
// stance (statetype) conditions the viewer can check. Other trigger conditions (ctrl, power,
// variables) are treated as met.
import { getValue, parseIni, unquote } from '../mugen/ini';
import { traceMove } from '../mugen/states';
import type { StateDef } from '../mugen/states';
import type { MoveKind, Stance, ViewerCommand, ViewerCondition, ViewerMove } from './types';

const ALL_STANCES: Stance[] = ['S', 'C', 'A'];

export function parseCommandList(cmdText: string): Record<string, ViewerCommand[]> {
  const sections = parseIni(cmdText);
  const defaults = sections.find((s) => s.name.toLowerCase() === 'defaults');
  const defaultTime = Number(defaults ? getValue(defaults, 'command.time') : undefined) || 15;
  const out: Record<string, ViewerCommand[]> = {};
  for (const s of sections) {
    if (s.name.toLowerCase() !== 'command') continue;
    const name = unquote(getValue(s, 'name'));
    const input = getValue(s, 'command');
    if (!name || !input) continue;
    const time = Number(getValue(s, 'time')) || defaultTime;
    (out[name.toLowerCase()] ??= []).push({ name, input, time });
  }
  return out;
}

interface Predicates {
  cmd: string[];
  notCmd: string[];
  stance: Set<Stance>;
  power: number;
}

function readPredicates(lines: string[]): Predicates {
  const p: Predicates = { cmd: [], notCmd: [], stance: new Set(ALL_STANCES), power: 0 };
  for (const line of lines) {
    for (const m of line.matchAll(/command\s*(!?=)\s*"([^"]+)"/gi)) {
      (m[1] === '=' ? p.cmd : p.notCmd).push(m[2]!.toLowerCase());
    }
    for (const m of line.matchAll(/statetype\s*(!?=)\s*([sca])\b/gi)) {
      const st = m[2]!.toUpperCase() as Stance;
      if (m[1] === '=') p.stance = new Set([...p.stance].filter((s) => s === st));
      else p.stance.delete(st);
    }
    for (const m of line.matchAll(/power\s*>=?\s*(\d+)/gi)) p.power = Math.max(p.power, Number(m[1]));
  }
  return p;
}

/** Target state of a ChangeState value: a number, or the first known state in an expression. */
function targetState(value: string | undefined, states: Map<number, StateDef>, animExists: (id: number) => boolean): number | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (/^-?\d+$/.test(v)) return Number(v);
  // Expressions such as ifelse(pos y >= 0, 60, 65): 0 is a comparison, never a move.
  const nums = [...v.matchAll(/\b\d+\b/g)].map((m) => Number(m[0])).filter((n) => n > 0);
  return nums.find((n) => states.has(n)) ?? nums.find(animExists);
}

function isSimpleInput(commands: Record<string, ViewerCommand[]>, names: string[]): boolean {
  return names.every((n) => (commands[n] ?? []).every((c) => c.input.split(',').filter((s) => s.trim()).length <= 2 && !/[DUFB]\s*,\s*[DUFB]/.test(c.input)));
}

function kindOf(state: number, power: number, simple: boolean): MoveKind {
  if (state < 200) return 'movement';
  if (power >= 3000 || (state >= 3000 && state < 5000)) return 'super';
  if (state < 1000 && simple) return 'normal';
  return 'special';
}

export function extractMoves(
  cmdText: string,
  states: Map<number, StateDef>,
  animExists: (id: number) => boolean,
): { moves: ViewerMove[]; commands: Record<string, ViewerCommand[]> } {
  const commands = parseCommandList(cmdText);
  const moves: ViewerMove[] = [];
  const byKey = new Map<string, ViewerMove>();
  for (const sid of [-1, -2, -3]) {
    for (const c of states.get(sid)?.controllers ?? []) {
      if (c.type !== 'changestate') continue;
      const state = targetState(getValue(c.section, 'value'), states, animExists);
      // State 0 (back to standing) and the get-hit states are not moves.
      if (state === undefined || state === 0 || (state >= 5000 && state < 6000)) continue;
      const groups = new Map<string, string[]>();
      for (const l of c.section.lines) {
        const m = /^trigger(all|\d+)$/.exec(l.key);
        if (m) groups.set(m[1]!, [...(groups.get(m[1]!) ?? []), l.value]);
      }
      const all = groups.get('all') ?? [];
      const conditions: ViewerCondition[] = [];
      let power = 0;
      for (const [k, lines] of groups) {
        if (k === 'all') continue;
        const p = readPredicates([...all, ...lines]);
        power = Math.max(power, p.power);
        if (!p.cmd.length || p.stance.size === 0) continue;
        // Cancels (from inside another move, or on contact) need a state the viewer never is in.
        if (lines.some((l) => /\bstateno\s*=\s*\d|\bmove(contact|hit|guarded|reversed)\b|\bprevstateno\s*=/i.test(l))) continue;
        const cond: ViewerCondition = { cmd: p.cmd, notCmd: p.notCmd, stance: p.stance.size === 3 ? [] : [...p.stance] };
        if (!conditions.some((x) => JSON.stringify(x) === JSON.stringify(cond))) conditions.push(cond);
      }
      if (!conditions.length) continue;
      const title = c.section.name.replace(/^state\s+-?\d+\s*,?/i, '').trim() || `State ${state}`;
      const key = `${state}|${title.toLowerCase()}`;
      const existing = byKey.get(key);
      if (existing) {
        for (const cond of conditions) {
          if (!existing.conditions.some((x) => JSON.stringify(x) === JSON.stringify(cond))) existing.conditions.push(cond);
        }
        continue;
      }
      const trace = traceMove(state, states, animExists, { skipCombos: true });
      const anims = trace.anims.filter(animExists);
      if (!anims.length && animExists(state)) anims.push(state);
      const notes = [
        ...(trace.flags.throwReasons.length ? ['grab'] : []),
        ...(trace.flags.fightfxAnims.length ? ['fightfx'] : []),
      ];
      const names = [...new Set(conditions.flatMap((x) => x.cmd))];
      const move: ViewerMove = {
        name: title,
        state,
        kind: kindOf(state, power, isSimpleInput(commands, names)),
        power,
        conditions,
        anims,
        effectAnims: trace.effectAnims.filter(animExists),
        notes,
      };
      byKey.set(key, move);
      moves.push(move);
    }
  }
  return { moves, commands };
}
