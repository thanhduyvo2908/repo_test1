import type { Pack } from "../content/loader";
import type { StatusSpec } from "../content/schema";
import type { BattleEvent, UnitSummary } from "../core/battle";
import type { LocalizedText, StringKey, TemplateParams } from "../i18n";
import { passiveName, skillsById, unitName } from "./content";
import { statusLabel } from "./statusText";

// Turns battle log events into sentences in the active language. The log holds data only.

export interface LogContext {
  pack: Pack;
  units: readonly UnitSummary[];
  t: (key: StringKey, params?: TemplateParams) => string;
  l: (text: LocalizedText) => string;
  /** Status specs by status id, from the whole log, so expiry lines can name the status. */
  statusById: ReadonlyMap<number, StatusSpec>;
}

export interface LogLine {
  text: string;
  /** strong: super effective. weak: not very effective. round: round marker. */
  tone: "normal" | "strong" | "weak" | "round";
}

export function statusesById(log: readonly BattleEvent[]): Map<number, StatusSpec> {
  const byId = new Map<number, StatusSpec>();
  for (const event of log) if (event.type === "statusApplied") byId.set(event.statusId, event.status);
  return byId;
}

export function unitLabel(ctx: Pick<LogContext, "pack" | "units" | "l">, uid: number): string {
  const unit = ctx.units[uid];
  return unit ? ctx.l(unitName(ctx.pack, unit)) : "?";
}

export function skillLabel(ctx: Pick<LogContext, "pack" | "l">, skillId: string): string {
  const skill = skillsById(ctx.pack).get(skillId);
  return skill ? ctx.l(skill.name) : skillId;
}

export function describeEvent(event: BattleEvent, ctx: LogContext): LogLine | null {
  const { t } = ctx;
  const name = (uid: number) => unitLabel(ctx, uid);
  const label = (spec: StatusSpec | undefined) => (spec ? statusLabel(spec, t) : "?");
  const line = (text: string, tone: LogLine["tone"] = "normal"): LogLine => ({ text, tone });
  switch (event.type) {
    case "roundStart":
      return line(t("battle.round", { round: event.round }), "round");
    case "enter":
      return line(t("battle.enter", { name: name(event.unit) }));
    case "action":
      return line(t("battle.uses", { name: name(event.actor), skill: skillLabel(ctx, event.skillId) }));
    case "turnSkipped":
      return line(t(event.reason === "stun" ? "battle.skippedStun" : "battle.skippedSleep", { name: name(event.unit) }));
    case "damage": {
      const notes = [
        event.absorbed > 0 ? t("battle.absorbed", { amount: event.absorbed }) : "",
        event.crit ? t("battle.crit") : "",
        event.effectiveness > 1 ? t("battle.strong") : "",
        event.effectiveness < 1 ? t("battle.weak") : "",
      ].filter(Boolean);
      const tone = event.effectiveness > 1 ? "strong" : event.effectiveness < 1 ? "weak" : "normal";
      return line([t("battle.damage", { target: name(event.target), amount: event.amount }), ...notes].join(" "), tone);
    }
    case "dot":
      return line(
        t("battle.dot", {
          name: name(event.unit),
          amount: event.amount + event.absorbed,
          status: label(ctx.statusById.get(event.statusId)),
        }),
      );
    case "heal":
      return line(t("battle.heal", { name: name(event.unit), amount: event.amount }));
    case "statusApplied": {
      const status = statusLabel(event.status, t, event.shield);
      return line(
        event.duration === null
          ? t("battle.statusPermanent", { name: name(event.unit), status })
          : t("battle.statusTimed", { name: name(event.unit), status, turns: event.duration }),
      );
    }
    case "statusResisted":
      return line(t("battle.statusResisted", { name: name(event.unit), status: label(event.status) }));
    case "statusExpired":
      return line(t("battle.statusExpired", { name: name(event.unit), status: label(ctx.statusById.get(event.statusId)) }));
    case "cooldownChanged":
      return line(
        t(event.rounds > 0 ? "battle.cooldownDelayed" : "battle.cooldownHastened", {
          name: name(event.unit),
          rounds: Math.abs(event.rounds),
        }),
      );
    case "passive":
      return line(t("battle.passive", { name: name(event.unit), passive: ctx.l(passiveName(ctx.pack, event.passiveId)) }));
    case "defeated":
      return line(t("battle.defeated", { name: name(event.unit) }));
    case "battleEnd":
      return null;
  }
}
