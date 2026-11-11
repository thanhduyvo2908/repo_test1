// Links .cmd commands to states and states to animations, and flags moves that are
// hard to reuse outside MUGEN (throws, effects drawn from the shared fightfx file).
import { getValue, parseIni, unquote } from './ini';
import type { IniSection } from './ini';

export interface Controller {
  type: string;
  section: IniSection;
  triggers: string[];
}

export interface StateDef {
  id: number;
  anim?: string;
  controllers: Controller[];
}

export interface CommandDef {
  name: string;
  input: string;
}

export interface MoveFlags {
  /** Grabs the opponent: HitDef p2stateno, TargetState, TargetBind or ChangeAnim2. */
  throwReasons: string[];
  /** Animations taken from fightfx.air (values written as F123). */
  fightfxAnims: string[];
  /** Hit sparks taken from fightfx. Common and harmless, listed for information. */
  fightfxSparks: string[];
  /** Animation values that are expressions rather than numbers. */
  dynamicAnims: string[];
  /** Highest "power >= N" requirement seen on the command triggers. */
  powerCost: number;
}

export interface MoveInfo {
  state: number;
  commands: CommandDef[];
  /** Animations of the move itself, in the order they were found. */
  anims: number[];
  /** Animations used by helpers, projectiles and explods spawned by the move. */
  effectAnims: number[];
  /** Every state visited while following the move. */
  states: number[];
  flags: MoveFlags;
}

export function parseStates(texts: string[]): Map<number, StateDef> {
  const states = new Map<number, StateDef>();
  for (const text of texts) {
    let current: StateDef | undefined;
    for (const section of parseIni(text)) {
      const def = /^statedef\s+(-?\d+)/i.exec(section.name);
      if (def) {
        const id = Number(def[1]);
        current = states.get(id) ?? { id, controllers: [] };
        const anim = getValue(section, 'anim');
        if (anim !== undefined) current.anim = anim;
        states.set(id, current);
        continue;
      }
      const ctrl = /^state\s+(-?\d+)/i.exec(section.name);
      if (!ctrl) continue;
      const headerId = Number(ctrl[1]);
      // Negative states (-1, -2, -3) are often written without a [Statedef -1] header.
      let target = current;
      if (headerId < 0 && current?.id !== headerId) {
        target = states.get(headerId) ?? { id: headerId, controllers: [] };
        states.set(headerId, target);
      }
      if (!target) continue;
      target.controllers.push({
        type: (getValue(section, 'type') ?? '').toLowerCase(),
        section,
        triggers: section.lines.filter((l) => /^trigger(all|\d+)$/.test(l.key)).map((l) => l.value),
      });
    }
  }
  return states;
}

export function parseCommands(cmdText: string): Map<string, CommandDef> {
  const commands = new Map<string, CommandDef>();
  for (const section of parseIni(cmdText)) {
    if (section.name.toLowerCase() !== 'command') continue;
    const name = unquote(getValue(section, 'name'));
    if (!name || commands.has(name.toLowerCase())) continue;
    commands.set(name.toLowerCase(), { name, input: getValue(section, 'command') ?? '' });
  }
  return commands;
}

/** Command names a trigger requires (ignores "command != ..."). */
function commandsIn(trigger: string): string[] {
  const out: string[] = [];
  for (const m of trigger.matchAll(/command\s*(!?=)\s*"([^"]+)"/gi)) {
    if (m[1] === '=' && m[2]) out.push(m[2].toLowerCase());
  }
  return out;
}

function powerIn(trigger: string): number {
  let max = 0;
  for (const m of trigger.matchAll(/power\s*>=?\s*(\d+)/gi)) max = Math.max(max, Number(m[1]));
  return max;
}

function intLiteral(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const v = value.trim();
  return /^-?\d+$/.test(v) ? Number(v) : undefined;
}

/** States that belong to the common engine (movement, guard, get-hit) and are not followed. */
function isCommonState(id: number): boolean {
  return id < 200 || (id >= 5000 && id <= 5999);
}

export function analyzeMoves(
  cmdText: string,
  states: Map<number, StateDef>,
  animExists: (id: number) => boolean,
): MoveInfo[] {
  const commands = parseCommands(cmdText);
  const byState = new Map<number, { commands: Map<string, CommandDef>; power: number }>();
  for (const id of [-1, -2, -3]) {
    for (const c of states.get(id)?.controllers ?? []) {
      if (c.type !== 'changestate') continue;
      const target = intLiteral(getValue(c.section, 'value'));
      if (target === undefined || isCommonState(target)) continue;
      const names = c.triggers.flatMap(commandsIn);
      if (names.length === 0) continue;
      const entry = byState.get(target) ?? { commands: new Map<string, CommandDef>(), power: 0 };
      for (const n of names) entry.commands.set(n, commands.get(n) ?? { name: n, input: '(not defined in .cmd)' });
      entry.power = Math.max(entry.power, ...c.triggers.map(powerIn));
      byState.set(target, entry);
    }
  }

  const moves: MoveInfo[] = [];
  for (const [state, entry] of [...byState].sort((a, b) => a[0] - b[0])) {
    const move: MoveInfo = {
      state,
      commands: [...entry.commands.values()],
      anims: [],
      effectAnims: [],
      states: [],
      flags: { throwReasons: [], fightfxAnims: [], fightfxSparks: [], dynamicAnims: [], powerCost: entry.power },
    };
    const visited = new Set<number>();
    const addAnim = (list: number[], value: string | undefined, where: string) => {
      if (value === undefined) return;
      const v = value.trim();
      if (/^f\s*\d+$/i.test(v)) {
        move.flags.fightfxAnims.push(`${v.toUpperCase().replace(/\s/g, '')} (${where})`);
        return;
      }
      if (/^s\s*\d+$/i.test(v)) {
        const n = Number(v.replace(/\D/g, ''));
        if (!list.includes(n)) list.push(n);
        return;
      }
      const n = intLiteral(v);
      if (n !== undefined) {
        if (!list.includes(n)) list.push(n);
        return;
      }
      // Expression: keep any literal that names an existing action.
      move.flags.dynamicAnims.push(`${v} (${where})`);
      for (const m of v.matchAll(/\b\d+\b/g)) {
        const cand = Number(m[0]);
        if (animExists(cand) && !list.includes(cand)) list.push(cand);
      }
    };
    const visit = (id: number, asHelper: boolean, depth: number) => {
      if (visited.has(id) || depth > 8) return;
      visited.add(id);
      move.states.push(id);
      const def = states.get(id);
      if (!def) return;
      const animList = asHelper ? move.effectAnims : move.anims;
      addAnim(animList, def.anim, `statedef ${id}`);
      for (const c of def.controllers) {
        const get = (k: string) => getValue(c.section, k);
        switch (c.type) {
          case 'changeanim':
            addAnim(animList, get('value'), `state ${id}`);
            break;
          case 'changeanim2':
            move.flags.throwReasons.push(`ChangeAnim2 in state ${id}`);
            break;
          case 'hitdef': {
            if (get('p2stateno') !== undefined) move.flags.throwReasons.push(`HitDef p2stateno=${get('p2stateno')} in state ${id}`);
            for (const k of ['sparkno', 'guard.sparkno']) {
              const s = get(k)?.trim();
              if (s && !/^s/i.test(s) && s !== '-1') move.flags.fightfxSparks.push(`${k}=${s}`);
            }
            const p1 = intLiteral(get('p1stateno'));
            if (p1 !== undefined && !isCommonState(p1)) visit(p1, asHelper, depth + 1);
            break;
          }
          case 'targetstate':
          case 'targetbind':
            move.flags.throwReasons.push(`${c.type} in state ${id}`);
            break;
          case 'explod':
            addAnim(move.effectAnims, get('anim'), `explod in state ${id}`);
            break;
          case 'projectile':
            for (const k of ['projanim', 'projhitanim', 'projremanim']) addAnim(move.effectAnims, get(k), `${k} in state ${id}`);
            break;
          case 'helper': {
            const h = intLiteral(get('stateno'));
            if (h !== undefined) visit(h, true, depth + 1);
            break;
          }
          case 'changestate':
          case 'selfstate': {
            const next = intLiteral(get('value'));
            if (next !== undefined && !isCommonState(next)) visit(next, asHelper, depth + 1);
            break;
          }
        }
      }
    };
    visit(state, false, 0);
    move.flags.fightfxSparks = [...new Set(move.flags.fightfxSparks)];
    move.flags.throwReasons = [...new Set(move.flags.throwReasons)];
    moves.push(move);
  }
  return moves;
}
