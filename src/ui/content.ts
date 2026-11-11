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

/**
 * Sprite animation key for a skill: "basic" for basic attacks, "s1".."s4" by the skill's slot.
 * Star overrides keep their slot; boss and dungeon kits map their skills to s1, s2, s3 in order.
 */
export function animKeyFor(pack: Pack, unit: Pick<UnitSummary, "kind" | "sourceId">, skillId: string): string {
  const bySlot = (basicId: string, skills: readonly { id: string }[]) => {
    if (skillId === basicId) return "basic";
    const index = skills.findIndex((s) => s.id === skillId);
    return index >= 0 ? `s${index + 1}` : null;
  };
  if (unit.kind === "enemy") {
    const enemy = pack.enemies.get(unit.sourceId);
    return (enemy && bySlot(enemy.basicAttack.id, enemy.skills)) ?? "basic";
  }
  if (unit.kind === "boss") {
    const kits = [
      ...[...pack.maps.values()].map((m) => m.boss),
      ...[...pack.sideDungeons.values()].map((d) => d.boss),
    ].filter((b) => b.characterId === unit.sourceId);
    for (const kit of kits) {
      const key = bySlot(kit.basicAttack.id, kit.skills);
      if (key) return key;
    }
    return "basic";
  }
  const character = pack.characters.get(unit.sourceId);
  if (!character) return "basic";
  const key = bySlot(character.basicAttack.id, character.skills);
  if (key) return key;
  for (const star of character.stars) {
    const override = star.skillOverrides.find((o) => o.skill.id === skillId);
    if (override) return `s${override.slot + 1}`;
  }
  return "basic";
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
  for (const c of pack.characters.values()) {
    [c.basicAttack, ...c.skills].forEach(add);
    for (const star of c.stars) for (const { skill } of star.skillOverrides) add(skill);
  }
  for (const e of pack.enemies.values()) [e.basicAttack, ...e.skills].forEach(add);
  for (const m of pack.maps.values()) [m.boss.basicAttack, ...m.boss.skills].forEach(add);
  for (const d of pack.sideDungeons.values()) [d.boss.basicAttack, ...d.boss.skills].forEach(add);
  skillCache.set(pack, byId);
  return byId;
}
