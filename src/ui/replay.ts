import type { StatusSpec } from "../content/schema";
import type { BattleEvent, UnitSummary } from "../core/battle";

// Rebuilds what the screen shows after a number of log events. Reads the log only; never computes damage.

export interface ShownStatus {
  id: number;
  spec: StatusSpec;
  /** Shield points left, for shields. */
  shield: number | undefined;
}

export interface ReplayView {
  hp: number[];
  onField: Set<number>;
  statuses: Map<number, ShownStatus>[];
  /** Latest round started, 0 before the first. */
  round: number;
}

/** HP, statuses, who is on the field and the round, after the given events. */
export function replay(units: readonly UnitSummary[], events: readonly BattleEvent[]): ReplayView {
  const hp = units.map((u) => u.maxHp);
  const onField = new Set<number>();
  const statuses: Map<number, ShownStatus>[] = units.map(() => new Map());
  let round = 0;
  const shrinkShields = (uid: number, absorbed: number) => {
    let left = absorbed;
    for (const s of statuses[uid]?.values() ?? []) {
      if (s.shield === undefined || left <= 0) continue;
      const used = Math.min(s.shield, left);
      s.shield -= used;
      left -= used;
    }
  };
  for (const event of events) {
    switch (event.type) {
      case "roundStart":
        round = event.round;
        break;
      case "enter":
        onField.add(event.unit);
        break;
      case "damage":
        hp[event.target] = event.hpAfter;
        shrinkShields(event.target, event.absorbed);
        break;
      case "dot":
        hp[event.unit] = event.hpAfter;
        shrinkShields(event.unit, event.absorbed);
        break;
      case "heal":
        hp[event.unit] = event.hpAfter;
        break;
      case "statusApplied":
        statuses[event.unit]?.set(event.statusId, { id: event.statusId, spec: event.status, shield: event.shield });
        break;
      case "statusExpired":
        statuses[event.unit]?.delete(event.statusId);
        break;
      case "defeated":
        onField.delete(event.unit);
        statuses[event.unit]?.clear();
        break;
    }
  }
  return { hp, onField, statuses, round };
}
