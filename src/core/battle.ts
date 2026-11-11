import type {
  Balance,
  DamageType,
  Element,
  Item,
  ItemTier,
  Skill,
  StatBlock,
} from "../content/schema";
import { computeDamage } from "./damage";
import { elementMultiplier } from "./element";
import { createRng, type Rng } from "./rng";
import { SkillPicker } from "./skillPicker";

export type Side = "player" | "enemy";

/**
 * duel: mini stages. Each side fields one unit at a time, in order; the next steps in when one falls.
 * boss: the whole player team fights one boss at the same time.
 */
export type BattleMode = "duel" | "boss";

export interface BattleUnit {
  kind: "character" | "enemy" | "boss";
  /** Id of the character or enemy in the content pack. */
  sourceId: string;
  level: number;
  element: Element;
  damageType: DamageType;
  stats: StatBlock;
  basicAttack: Skill;
  /** Unlocked skills in the order the player arranged them. */
  skills: Skill[];
  item?: { effect: Item["effect"]; tier: ItemTier };
}

export interface BattleInput {
  mode: BattleMode;
  players: BattleUnit[];
  enemies: BattleUnit[];
  seed: number;
  roundLimit: number;
  balance: Pick<Balance, "damage" | "elementChart">;
}

export interface UnitSummary {
  uid: number;
  side: Side;
  kind: BattleUnit["kind"];
  sourceId: string;
  level: number;
  maxHp: number;
}

/** Battle log events. Data only: the UI turns them into sentences in the active language. */
export type BattleEvent =
  | { type: "roundStart"; round: number }
  | { type: "enter"; unit: number }
  | { type: "action"; actor: number; skillId: string; slot: number | null }
  | {
      type: "damage";
      actor: number;
      target: number;
      skillId: string;
      amount: number;
      crit: boolean;
      effectiveness: number;
      hpAfter: number;
    }
  | { type: "defeated"; unit: number }
  | { type: "battleEnd"; winner: Side | null; rounds: number };

export interface BattleResult {
  /** null when the round limit ran out. A timeout counts as a loss for the player. */
  winner: Side | null;
  rounds: number;
  units: UnitSummary[];
  /** Remaining HP per unit uid, in the same order as `units`. */
  finalHp: number[];
  log: BattleEvent[];
}

interface Combatant {
  uid: number;
  side: Side;
  unit: BattleUnit;
  hp: number;
  picker: SkillPicker;
}

export function simulateBattle(input: BattleInput): BattleResult {
  if (input.players.length === 0 || input.enemies.length === 0) {
    throw new Error("simulateBattle needs at least one unit on each side");
  }
  const rng = createRng(input.seed);
  const log: BattleEvent[] = [];

  const combatants: Combatant[] = [];
  const addSide = (side: Side, units: BattleUnit[]) => {
    for (const unit of units) {
      combatants.push({
        uid: combatants.length,
        side,
        unit,
        hp: unit.stats.hp,
        picker: new SkillPicker(unit.skills, unit.basicAttack),
      });
    }
  };
  addSide("player", input.players);
  addSide("enemy", input.enemies);

  const alive = (side: Side) => combatants.filter((c) => c.side === side && c.hp > 0);
  /** Units currently on the field: everyone in boss mode, the first living unit per side in duels. */
  const onField = (side: Side) => {
    const living = alive(side);
    return input.mode === "boss" ? living : living.slice(0, 1);
  };
  const opponent = (side: Side): Side => (side === "player" ? "enemy" : "player");

  for (const side of ["player", "enemy"] as const) {
    for (const c of onField(side)) log.push({ type: "enter", unit: c.uid });
  }

  let winner: Side | null = null;
  let round = 0;

  while (winner === null && round < input.roundLimit) {
    round += 1;
    log.push({ type: "roundStart", round });

    for (const actor of turnOrder([...onField("player"), ...onField("enemy")], rng)) {
      if (actor.hp <= 0) continue;
      takeTurn(actor);
      if (alive("enemy").length === 0) winner = "player";
      else if (alive("player").length === 0) winner = "enemy";
      if (winner) break;
    }
  }

  log.push({ type: "battleEnd", winner, rounds: round });

  return {
    winner,
    rounds: round,
    units: combatants.map((c) => ({
      uid: c.uid,
      side: c.side,
      kind: c.unit.kind,
      sourceId: c.unit.sourceId,
      level: c.unit.level,
      maxHp: c.unit.stats.hp,
    })),
    finalHp: combatants.map((c) => c.hp),
    log,
  };

  function takeTurn(actor: Combatant): void {
    const { skill, index } = actor.picker.pick();
    log.push({ type: "action", actor: actor.uid, skillId: skill.id, slot: index });

    const targets = pickTargets(actor, skill);
    for (const target of targets) {
      hit(actor, target, skill, targets.length > 1);
    }
    actor.picker.endTurn();
  }

  function pickTargets(actor: Combatant, skill: Skill): Combatant[] {
    // Skills without power deal no damage; their effects arrive with the status effect system.
    if (skill.power === 0) return [];
    const foes = onField(opponent(actor.side));
    switch (skill.target) {
      case "enemy":
        // The first living opponent in team order, unless a skill says otherwise.
        return foes.slice(0, 1);
      case "allEnemies":
        return foes;
      case "self":
      case "ally":
      case "allAllies":
        // Support effects arrive with the status effect system.
        return [];
    }
  }

  function hit(actor: Combatant, target: Combatant, skill: Skill, spread: boolean): void {
    const { balance } = input;
    const skillElement = skill.element ?? actor.unit.element;
    const attack = skill.scaling.reduce(
      (sum, { stat, weight }) => sum + actor.unit.stats[stat] * weight,
      0,
    );
    const defense =
      actor.unit.damageType === "physical" ? target.unit.stats.def : target.unit.stats.spd;
    const effectiveness = elementMultiplier(balance.elementChart, skillElement, target.unit.element);
    const crit = rng.chance(balance.damage.critChance);
    const roll = rng.range(balance.damage.randomMin, balance.damage.randomMax);

    const amount = computeDamage(
      {
        level: actor.unit.level,
        power: skill.power,
        attack,
        defense,
        crit,
        roll,
        stab: skillElement === actor.unit.element,
        effectiveness,
        spread,
        other: itemMultiplier(actor.unit, skillElement),
      },
      balance,
    );

    target.hp = Math.max(0, target.hp - amount);
    log.push({
      type: "damage",
      actor: actor.uid,
      target: target.uid,
      skillId: skill.id,
      amount,
      crit,
      effectiveness,
      hpAfter: target.hp,
    });

    if (target.hp === 0) {
      log.push({ type: "defeated", unit: target.uid });
      if (input.mode === "duel") {
        const next = onField(target.side)[0];
        if (next) log.push({ type: "enter", unit: next.uid });
      }
    }
  }
}

/** Faster units act first. Speed ties are broken by the seeded generator. */
function turnOrder(units: Combatant[], rng: Rng): Combatant[] {
  const keyed = units.map((c) => ({ c, tie: rng.next() }));
  keyed.sort((a, b) => b.c.unit.stats.spe - a.c.unit.stats.spe || a.tie - b.tie);
  return keyed.map((k) => k.c);
}

function itemMultiplier(unit: BattleUnit, skillElement: Element): number {
  if (!unit.item) return 1;
  const { effect, tier } = unit.item;
  if (effect.kind !== "damageBonus") return 1;
  if (effect.condition.element && effect.condition.element !== skillElement) return 1;
  if (effect.condition.damageType && effect.condition.damageType !== unit.damageType) return 1;
  return 1 + effect.valueByTier[tier];
}
