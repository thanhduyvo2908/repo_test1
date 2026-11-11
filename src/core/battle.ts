import type {
  Amount,
  Balance,
  DamageType,
  Element,
  Item,
  ItemTier,
  PassiveEffect,
  Skill,
  SkillEffect,
  StatBlock,
  StatusSpec,
} from "../content/schema";
import { computeDamage } from "./damage";
import { elementMultiplier } from "./element";
import { createRng } from "./rng";
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
  passive?: { id: string; effects: PassiveEffect[] };
}

export interface BattleInput {
  mode: BattleMode;
  players: BattleUnit[];
  enemies: BattleUnit[];
  seed: number;
  roundLimit: number;
  balance: Pick<Balance, "damage" | "elementChart" | "status">;
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
  | { type: "turnSkipped"; unit: number; reason: "stun" | "sleep" }
  | {
      type: "damage";
      actor: number;
      target: number;
      skillId: string;
      /** HP lost. */
      amount: number;
      /** Damage taken by a shield instead of HP. */
      absorbed: number;
      crit: boolean;
      effectiveness: number;
      hpAfter: number;
    }
  | { type: "dot"; unit: number; statusId: number; amount: number; absorbed: number; hpAfter: number }
  | { type: "heal"; unit: number; source: number; amount: number; hpAfter: number }
  | {
      type: "statusApplied";
      unit: number;
      source: number;
      statusId: number;
      status: StatusSpec;
      /** Remaining turns, null for the whole battle. */
      duration: number | null;
      /** Shield points, for shields. */
      shield?: number;
    }
  | { type: "statusResisted"; unit: number; source: number; status: StatusSpec }
  | { type: "statusExpired"; unit: number; statusId: number }
  | { type: "cooldownChanged"; unit: number; source: number; rounds: number }
  | { type: "passive"; unit: number; passiveId: string }
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

interface StatusInstance {
  id: number;
  spec: StatusSpec;
  /** Owner turns left; null lasts the whole battle. */
  remaining: number | null;
  /** Applied during the owner's own turn: that turn does not count down. */
  fresh: boolean;
  /** Skill or passive that applied it. Re-applying from the same origin refreshes instead of stacking. */
  origin: string;
  source: number;
  shield: number;
}

interface Combatant {
  uid: number;
  side: Side;
  unit: BattleUnit;
  hp: number;
  picker: SkillPicker;
  statuses: StatusInstance[];
  /** Passive effect indexes that already fired this battle (hpBelow triggers). */
  firedPassives: Set<number>;
}

/** Statuses that hurt their holder. Immunity blocks these. */
function isNegative(spec: StatusSpec): boolean {
  switch (spec.kind) {
    case "stun":
    case "sleep":
    case "silence":
    case "dot":
      return true;
    case "statStage":
      return spec.stages < 0;
    default:
      return false;
  }
}

export function simulateBattle(input: BattleInput): BattleResult {
  if (input.players.length === 0 || input.enemies.length === 0) {
    throw new Error("simulateBattle needs at least one unit on each side");
  }
  const { balance } = input;
  const rng = createRng(input.seed);
  const log: BattleEvent[] = [];
  let nextStatusId = 1;
  /** The unit whose turn is running, so statuses it gives itself skip this turn's countdown. */
  let currentActor: Combatant | null = null;

  const combatants: Combatant[] = [];
  const addSide = (side: Side, units: BattleUnit[]) => {
    for (const unit of units) {
      combatants.push({
        uid: combatants.length,
        side,
        unit,
        hp: unit.stats.hp,
        picker: new SkillPicker(unit.skills, unit.basicAttack),
        statuses: [],
        firedPassives: new Set(),
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
  for (const c of combatants) firePassives(c, "battleStart");

  let winner: Side | null = null;
  let round = 0;
  const checkWinner = () => {
    if (alive("enemy").length === 0) winner = "player";
    else if (alive("player").length === 0) winner = "enemy";
  };

  while (winner === null && round < input.roundLimit) {
    round += 1;
    log.push({ type: "roundStart", round });

    for (const actor of turnOrder([...onField("player"), ...onField("enemy")])) {
      if (actor.hp <= 0) continue;
      takeTurn(actor);
      checkWinner();
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

  // -------------------------------------------------------------------------
  // Turn flow

  /** Faster units act first, using speed after stat stages. Ties are broken by the seeded generator. */
  function turnOrder(units: Combatant[]): Combatant[] {
    const keyed = units.map((c) => ({ c, speed: effectiveStat(c, "spe"), tie: rng.next() }));
    keyed.sort((a, b) => b.speed - a.speed || a.tie - b.tie);
    return keyed.map((k) => k.c);
  }

  function takeTurn(actor: Combatant): void {
    currentActor = actor;
    const control = actor.statuses.find((s) => s.spec.kind === "stun" || s.spec.kind === "sleep");
    if (control) {
      log.push({ type: "turnSkipped", unit: actor.uid, reason: control.spec.kind as "stun" | "sleep" });
    } else {
      const silenced = actor.statuses.some((s) => s.spec.kind === "silence");
      const { skill, index } = actor.picker.pick(silenced);
      log.push({ type: "action", actor: actor.uid, skillId: skill.id, slot: index });
      useSkill(actor, skill);
    }
    actor.picker.endTurn();
    if (actor.hp > 0) endOfTurn(actor);
    currentActor = null;
  }

  function useSkill(actor: Combatant, skill: Skill): void {
    const targets = pickTargets(actor, skill);
    const hitsFoes = skill.target === "enemy" || skill.target === "allEnemies";
    let dealt = 0;
    if (skill.power > 0 && hitsFoes) {
      for (const target of targets) {
        if (target.hp > 0) dealt += hit(actor, target, skill, targets.length > 1);
      }
    }
    for (const effect of skill.effects) {
      applyEffect(actor, effect, targets, skill.id, dealt);
    }
  }

  /** Damage over time, regeneration and status countdowns at the end of the owner's turn. */
  function endOfTurn(unit: Combatant): void {
    for (const status of [...unit.statuses]) {
      if (unit.hp <= 0) return;
      const { spec } = status;
      if (spec.kind === "dot") {
        const raw = Math.max(1, Math.floor(unit.unit.stats.hp * spec.percentMaxHp));
        const { lost, absorbed } = takeDamage(unit, raw);
        log.push({ type: "dot", unit: unit.uid, statusId: status.id, amount: lost, absorbed, hpAfter: unit.hp });
        dropBrokenShields(unit);
        afterDamage(unit);
      } else if (spec.kind === "regen") {
        heal(unit, unit, Math.floor(unit.unit.stats.hp * spec.percentMaxHp));
      }
    }
    if (unit.hp <= 0) return;
    for (const status of [...unit.statuses]) {
      if (status.remaining === null) continue;
      if (status.fresh) {
        status.fresh = false;
        continue;
      }
      status.remaining -= 1;
      if (status.remaining <= 0) removeStatus(unit, status);
    }
  }

  // -------------------------------------------------------------------------
  // Targeting

  function pickTargets(actor: Combatant, skill: Skill): Combatant[] {
    const foes = onField(opponent(actor.side));
    const allies = onField(actor.side);
    switch (skill.target) {
      case "enemy": {
        // A taunting foe draws single-target skills; otherwise the first living foe in team order.
        const taunter = foes.find((f) => f.statuses.some((s) => s.spec.kind === "taunt"));
        return taunter ? [taunter] : foes.slice(0, 1);
      }
      case "allEnemies":
        return foes;
      case "self":
        return [actor];
      case "ally": {
        // The ally with the lowest share of HP left (the user itself when alone).
        const sorted = [...allies].sort(
          (a, b) => a.hp / a.unit.stats.hp - b.hp / b.unit.stats.hp || a.uid - b.uid,
        );
        return sorted.slice(0, 1);
      }
      case "allAllies":
        return allies;
    }
  }

  // -------------------------------------------------------------------------
  // Damage

  function effectiveStat(c: Combatant, stat: keyof StatBlock): number {
    const base = c.unit.stats[stat];
    if (stat === "hp") return base;
    let stages = 0;
    for (const s of c.statuses) {
      if (s.spec.kind === "statStage" && s.spec.stat === stat) stages += s.spec.stages;
    }
    const max = balance.status.maxStage;
    stages = Math.max(-max, Math.min(max, stages));
    const step = balance.status.stageStep;
    return stages >= 0 ? base * (1 + step * stages) : base / (1 + step * -stages);
  }

  function hit(actor: Combatant, target: Combatant, skill: Skill, spread: boolean): number {
    const skillElement = skill.element ?? actor.unit.element;
    const attack = skill.scaling.reduce(
      (sum, { stat, weight }) => sum + effectiveStat(actor, stat) * weight,
      0,
    );
    const defense =
      actor.unit.damageType === "physical" ? effectiveStat(target, "def") : effectiveStat(target, "spd");
    const effectiveness = elementMultiplier(balance.elementChart, skillElement, target.unit.element);
    const crit = rng.chance(balance.damage.critChance);
    const roll = rng.range(balance.damage.randomMin, balance.damage.randomMax);

    const raw = computeDamage(
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
        other:
          itemMultiplier(actor.unit, skillElement) *
          reductionMultiplier(target, actor.unit.damageType),
      },
      balance,
    );

    const { lost, absorbed } = takeDamage(target, raw);
    log.push({
      type: "damage",
      actor: actor.uid,
      target: target.uid,
      skillId: skill.id,
      amount: lost,
      absorbed,
      crit,
      effectiveness,
      hpAfter: target.hp,
    });
    dropBrokenShields(target);
    wakeUp(target);
    afterDamage(target);
    return lost + absorbed;
  }

  /**
   * Shields soak damage first; whatever is left comes off HP. Emptied shields stay until
   * `dropBrokenShields`, so the log shows the hit before the shield breaking.
   */
  function takeDamage(target: Combatant, raw: number): { lost: number; absorbed: number } {
    let remaining = raw;
    let absorbed = 0;
    for (const status of target.statuses) {
      if (status.spec.kind !== "shield" || remaining <= 0) continue;
      const soaked = Math.min(status.shield, remaining);
      status.shield -= soaked;
      remaining -= soaked;
      absorbed += soaked;
    }
    const lost = Math.min(target.hp, remaining);
    target.hp -= lost;
    return { lost, absorbed };
  }

  function dropBrokenShields(unit: Combatant): void {
    for (const status of [...unit.statuses]) {
      if (status.spec.kind === "shield" && status.shield <= 0) removeStatus(unit, status);
    }
  }

  function wakeUp(target: Combatant): void {
    for (const status of [...target.statuses]) {
      if (status.spec.kind === "sleep") removeStatus(target, status);
    }
  }

  /** Handles a unit falling, or its HP crossing a passive threshold. */
  function afterDamage(target: Combatant): void {
    if (target.hp <= 0) {
      target.statuses = [];
      log.push({ type: "defeated", unit: target.uid });
      if (input.mode === "duel") {
        const next = onField(target.side)[0];
        if (next) log.push({ type: "enter", unit: next.uid });
      }
      return;
    }
    firePassives(target, "hpBelow");
  }

  // -------------------------------------------------------------------------
  // Effects

  function applyEffect(
    user: Combatant,
    effect: SkillEffect,
    targets: Combatant[],
    origin: string,
    dealt: number,
  ): void {
    switch (effect.kind) {
      case "status": {
        const recipients = effect.target === "self" ? [user] : targets;
        for (const target of recipients) {
          if (target.hp <= 0) continue;
          if (effect.chance < 1 && !rng.chance(effect.chance)) continue;
          addStatus(user, target, effect.status, effect.duration, origin);
        }
        return;
      }
      case "heal": {
        const recipients = effect.target === "self" ? [user] : targets;
        for (const target of recipients) {
          if (target.hp > 0) heal(user, target, amountOf(effect.amount, user, target));
        }
        return;
      }
      case "lifesteal":
        if (dealt > 0 && user.hp > 0) heal(user, user, Math.floor(dealt * effect.ratio));
        return;
      case "cooldown": {
        const recipients = effect.target === "self" ? [user] : targets;
        for (const target of recipients) {
          if (target.hp <= 0) continue;
          target.picker.adjustCooldowns(effect.rounds);
          log.push({ type: "cooldownChanged", unit: target.uid, source: user.uid, rounds: effect.rounds });
        }
        return;
      }
    }
  }

  function amountOf(amount: Amount, caster: Combatant, target: Combatant): number {
    const from = amount.of === "target" ? target : caster;
    return Math.floor(effectiveStat(from, amount.stat) * amount.ratio);
  }

  function heal(source: Combatant, target: Combatant, amount: number): void {
    const healed = Math.max(0, Math.min(amount, target.unit.stats.hp - target.hp));
    if (healed === 0) return;
    target.hp += healed;
    log.push({ type: "heal", unit: target.uid, source: source.uid, amount: healed, hpAfter: target.hp });
  }

  function addStatus(
    source: Combatant,
    target: Combatant,
    spec: StatusSpec,
    duration: number | null,
    origin: string,
  ): void {
    if (isNegative(spec) && target.statuses.some((s) => s.spec.kind === "immunity")) {
      log.push({ type: "statusResisted", unit: target.uid, source: source.uid, status: spec });
      return;
    }
    // Re-applying the same status from the same skill refreshes it instead of stacking.
    const key = JSON.stringify(spec);
    const existing = target.statuses.find((s) => s.origin === origin && JSON.stringify(s.spec) === key);
    if (existing) removeStatus(target, existing);

    const status: StatusInstance = {
      id: nextStatusId++,
      spec,
      remaining: duration,
      fresh: currentActor === target,
      origin,
      source: source.uid,
      shield: spec.kind === "shield" ? amountOf(spec.amount, source, target) : 0,
    };
    target.statuses.push(status);
    log.push({
      type: "statusApplied",
      unit: target.uid,
      source: source.uid,
      statusId: status.id,
      status: spec,
      duration,
      ...(spec.kind === "shield" ? { shield: status.shield } : {}),
    });
  }

  function removeStatus(unit: Combatant, status: StatusInstance): void {
    const index = unit.statuses.indexOf(status);
    if (index < 0) return;
    unit.statuses.splice(index, 1);
    log.push({ type: "statusExpired", unit: unit.uid, statusId: status.id });
  }

  function firePassives(unit: Combatant, trigger: PassiveEffect["trigger"]): void {
    const passive = unit.unit.passive;
    if (!passive || unit.hp <= 0) return;
    passive.effects.forEach((entry, index) => {
      if (entry.trigger !== trigger || unit.firedPassives.has(index)) return;
      if (entry.trigger === "hpBelow" && unit.hp >= unit.unit.stats.hp * entry.threshold) return;
      unit.firedPassives.add(index);
      log.push({ type: "passive", unit: unit.uid, passiveId: passive.id });
      applyEffect(unit, entry.effect, [unit], `${passive.id}#${index}`, 0);
    });
  }

  function reductionMultiplier(target: Combatant, damageType: DamageType): number {
    let multiplier = 1;
    for (const s of target.statuses) {
      if (s.spec.kind !== "damageReduction") continue;
      if (s.spec.damageType && s.spec.damageType !== damageType) continue;
      multiplier *= 1 - s.spec.ratio;
    }
    return multiplier;
  }
}

function itemMultiplier(unit: BattleUnit, skillElement: Element): number {
  if (!unit.item) return 1;
  const { effect, tier } = unit.item;
  if (effect.kind !== "damageBonus") return 1;
  if (effect.condition.element && effect.condition.element !== skillElement) return 1;
  if (effect.condition.damageType && effect.condition.damageType !== unit.damageType) return 1;
  return 1 + effect.valueByTier[tier];
}
