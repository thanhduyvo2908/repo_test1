import type { Pack } from "../content/loader";
import type { LocalizedText } from "../i18n";
import type { Skill } from "../content/schema";
import type { UnitSummary } from "../core/battle";

/** Display name of a battle unit. */
export function unitName(pack: Pack, unit: Pick<UnitSummary, "kind" | "sourceId">): LocalizedText {
  const source =
    unit.kind === "enemy" ? pack.enemies.get(unit.sourceId) : pack.characters.get(unit.sourceId);
  return source?.name ?? { en: unit.sourceId };
}

/** Passive name by passive id. */
export function passiveName(pack: Pack, passiveId: string): LocalizedText {
  for (const c of pack.characters.values()) {
    if (c.passive.id === passiveId) return c.passive.name;
  }
  return { en: passiveId };
}

const skillCache = new WeakMap<Pack, Map<string, Skill>>();

/** Every skill in the pack by id: character, enemy and boss skills, including basic attacks. */
export function skillsById(pack: Pack): Map<string, Skill> {
  const cached = skillCache.get(pack);
  if (cached) return cached;
  const byId = new Map<string, Skill>();
  const add = (skill: Skill) => byId.set(skill.id, skill);
  for (const c of pack.characters.values()) [c.basicAttack, ...c.skills].forEach(add);
  for (const e of pack.enemies.values()) [e.basicAttack, ...e.skills].forEach(add);
  for (const m of pack.maps.values()) [m.boss.basicAttack, ...m.boss.skills].forEach(add);
  skillCache.set(pack, byId);
  return byId;
}
