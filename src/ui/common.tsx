import type { Element, Skill } from "../content/schema";
import { useStore } from "./store";

export function ElementBadge({ element }: { element: Element }) {
  const { t } = useStore();
  return <span className={`element element-${element}`}>{t(`element.${element}`)}</span>;
}

export function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useStore();
  return (
    <button type="button" className="link-button" onClick={onClick}>
      ← {t("nav.back")}
    </button>
  );
}

/** One skill with its usage and description, as shown on the map info screen. */
export function SkillRow({ skill, element }: { skill: Skill; element: Element }) {
  const { t, l } = useStore();
  const usage =
    skill.usage.kind === "basic"
      ? t("skill.basic")
      : skill.usage.kind === "cooldown"
        ? t("skill.cooldown", { rounds: skill.usage.rounds })
        : t("skill.oncePerBattle");
  return (
    <li className="skill-row">
      <div className="skill-head">
        <strong>{l(skill.name)}</strong>
        <ElementBadge element={skill.element ?? element} />
      </div>
      <div className="muted small">
        {usage}
        {skill.power > 0 && ` · ${t("skill.power", { power: skill.power })}`}
      </div>
      <p className="small">{l(skill.description)}</p>
    </li>
  );
}
