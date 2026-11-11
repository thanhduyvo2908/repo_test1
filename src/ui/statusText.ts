import type { StatusSpec } from "../content/schema";
import type { StringKey, TemplateParams } from "../i18n";

// Display helpers for statuses, shared by the battle log and the battle scene.

export function isHarmful(spec: StatusSpec): boolean {
  return (
    spec.kind === "stun" ||
    spec.kind === "sleep" ||
    spec.kind === "silence" ||
    spec.kind === "dot" ||
    (spec.kind === "statStage" && spec.stages < 0)
  );
}

/** Short display name of a status, e.g. "Attack +1" or "Shield 25". */
export function statusLabel(
  spec: StatusSpec,
  t: (key: StringKey, params?: TemplateParams) => string,
  shield?: number,
): string {
  switch (spec.kind) {
    case "stun":
    case "sleep":
    case "silence":
    case "regen":
    case "immunity":
    case "taunt":
      return t(`status.${spec.kind}`);
    case "dot":
      return t(`status.${spec.type}`);
    case "statStage":
      return t("status.statStage", {
        stat: t(`stat.${spec.stat}`),
        change: spec.stages > 0 ? `+${spec.stages}` : `−${-spec.stages}`,
      });
    case "shield":
      return t("status.shield", { amount: shield ?? "" }).trim();
    case "damageReduction": {
      const percent = Math.round(spec.ratio * 100);
      return spec.damageType
        ? t("status.damageReductionTyped", { percent, type: t(`damageType.${spec.damageType}`).toLowerCase() })
        : t("status.damageReduction", { percent });
    }
  }
}
