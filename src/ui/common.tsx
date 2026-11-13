import { Fragment, useEffect, useRef, type ReactNode } from "react";
import type { Element, Skill } from "../content/schema";
import type { StringKey, TemplateParams } from "../i18n";
import { useStore } from "./store";

export function ElementBadge({ element }: { element: Element }) {
  const { t } = useStore();
  return <span className={`el el-${element}`}>{t(`element.${element}`)}</span>;
}

/** HP or progress bar. `ratio` is clamped to 0..1. */
export function Bar({ ratio, kind = "hp", className = "" }: { ratio: number; kind?: "hp" | "progress"; className?: string }) {
  const value = Math.max(0, Math.min(1, ratio));
  const tone = kind === "progress" ? "prog" : value < 0.25 ? "crit" : value < 0.5 ? "low" : "";
  return (
    <span className={`bar ${tone} ${className}`.trim()} aria-hidden="true">
      <span style={{ width: `${value * 100}%` }} />
    </span>
  );
}

/**
 * A translated string with some placeholders filled by React nodes, e.g. bold names.
 * Plain string params are filled first; `nodes` replace their {name} markers in place.
 */
export function Rich({
  k,
  params,
  nodes,
}: {
  k: StringKey;
  params?: TemplateParams;
  nodes: Record<string, ReactNode>;
}) {
  const { t } = useStore();
  const markers: TemplateParams = { ...params };
  for (const name of Object.keys(nodes)) markers[name] = `\u0000${name}\u0000`;
  const parts = t(k, markers).split("\u0000");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{i % 2 === 1 ? nodes[part] : part}</Fragment>
      ))}
    </>
  );
}

/** One skill with its usage, power, target and description. */
export function SkillRow({ skill, element, extra }: { skill: Skill; element: Element; extra?: ReactNode }) {
  const { t, l } = useStore();
  const usage =
    skill.usage.kind === "basic"
      ? t("skill.basic")
      : skill.usage.kind === "cooldown"
        ? t("skill.cooldown", { rounds: skill.usage.rounds })
        : t("skill.oncePerBattle");
  const facts = [usage, t(`skill.target.${skill.target}`), skill.power > 0 ? t("skill.power", { power: skill.power }) : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="skill">
      <div className="skill-top">
        <span className="px">{l(skill.name)}</span>
        <ElementBadge element={skill.element ?? element} />
        <span className="skill-facts">{facts}</span>
      </div>
      <p>{l(skill.description)}</p>
      {extra}
    </li>
  );
}

/** Closes on Escape. */
function useEscape(onClose: () => void) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") latest.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** A panel that slides up over the current tab: full width on phones, centered on wider screens. */
export function Sheet({
  title,
  subtitle,
  onClose,
  banner,
  footer,
  children,
  labelledBy,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  /** Replaces the header, e.g. the map banner. */
  banner?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  labelledBy?: string;
}) {
  const { t } = useStore();
  useEscape(onClose);
  return (
    <div className="sheet-layer">
      <div className="sheet-dim" onClick={onClose} aria-hidden="true" />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {banner ?? (
          <header className="sheet-head">
            <div className="grow">
              {title && (
                <h2 className="px" id={labelledBy}>
                  {title}
                </h2>
              )}
              {subtitle && <div className="small muted">{subtitle}</div>}
            </div>
            <button type="button" className="iconbtn" onClick={onClose} aria-label={t("nav.close")}>
              ✕
            </button>
          </header>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </section>
    </div>
  );
}

/** A centered dialog over everything. */
export function Dialog({
  onClose,
  labelledBy,
  className = "",
  children,
}: {
  onClose?: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  useEscape(() => onClose?.());
  return (
    <div className="dialog-layer">
      <div className="sheet-dim" onClick={onClose} aria-hidden="true" />
      <section className={`dialog ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </section>
    </div>
  );
}
