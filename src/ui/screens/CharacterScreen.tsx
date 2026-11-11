import { useState } from "react";
import { STAT_KEYS, type StatKey } from "../../content/schema";
import { buildCharacterUnit } from "../../core/encounters";
import {
  currentSkills,
  levelUp,
  levelUpCost,
  nextStarStatus,
  pointBudget,
  pointCapPerStat,
  pointsSpent,
  setPoints,
  setSkillOrder,
  starUp,
} from "../../core/growth";
import { equipItem, wearerOf } from "../../core/inventory";
import type { ActionError, ActionResult, GameState } from "../../core/progress";
import { findOwned, levelCap, teamMembers } from "../../core/progress";
import { BackButton, ElementBadge, SkillRow } from "../common";
import { errorKey, useStore } from "../store";

/** Growth for one character: level, stat points, skill order, item and stars. */
export function CharacterScreen({ characterId, onBack }: { characterId: string; onBack: () => void }) {
  const { pack, game, runAction, t, l } = useStore();
  const [error, setError] = useState<ActionError | null>(null);
  const character = pack.characters.get(characterId);
  const owned = findOwned(game, characterId);
  if (!character || !owned) return null;

  const act = (action: (g: GameState) => ActionResult) => setError(runAction(action));

  // Stats as they fight, using the same builder as battles.
  const member = teamMembers({ ...game, team: [characterId] })[0];
  const stats = member ? buildCharacterUnit(pack, member).stats : character.baseStats;

  const cap = levelCap(game, pack);
  const cost = levelUpCost(pack, owned.level);
  const budget = pointBudget(pack, owned.level);
  const perStat = pointCapPerStat(pack, owned.level);
  const spent = pointsSpent(owned.points);

  const changePoint = (stat: StatKey, delta: number) =>
    act((g) => setPoints(g, pack, characterId, { ...owned.points, [stat]: (owned.points[stat] ?? 0) + delta }));

  const skills = currentSkills(game, pack, characterId);
  const order = owned.skillOrder ?? skills.map((_, slot) => slot);
  const fullOrder = [...order, ...skills.map((_, slot) => slot).filter((slot) => !order.includes(slot))];
  const moveSkillUp = (index: number) => {
    const next = [...fullOrder];
    const [slot] = next.splice(index, 1);
    if (slot !== undefined) next.splice(index - 1, 0, slot);
    act((g) => setSkillOrder(g, pack, characterId, next));
  };

  const star = nextStarStatus(game, pack, characterId);
  const mapName = (mapId: string) => {
    const map = pack.maps.get(mapId);
    return map ? l(map.name) : mapId;
  };

  return (
    <>
      <BackButton onClick={onBack} />
      <div className="row">
        <h2>{l(character.name)}</h2>
        <ElementBadge element={character.element} />
        <span className="stars">{t("character.stars", { stars: owned.stars })}</span>
      </div>
      <p className="small muted">
        {t("team.level", { level: owned.level })} · {t(`damageType.${character.damageType}`)}
      </p>

      {error && (
        <p className="error small" role="alert">
          {t(errorKey(error))}
        </p>
      )}

      <section className="card">
        <h3>{t("character.stats")}</h3>
        <table className="stat-table small">
          <tbody>
            {STAT_KEYS.map((stat) => (
              <tr key={stat}>
                <th scope="row">{t(`stat.${stat}`)}</th>
                <td className="num">{stats[stat]}</td>
                <td className="point-controls">
                  <button
                    type="button"
                    aria-label={`− ${t(`stat.${stat}`)}`}
                    disabled={(owned.points[stat] ?? 0) <= 0}
                    onClick={() => changePoint(stat, -1)}
                  >
                    −
                  </button>
                  <span className="num">{owned.points[stat] ?? 0}</span>
                  <button
                    type="button"
                    aria-label={`+ ${t(`stat.${stat}`)}`}
                    disabled={spent >= budget || (owned.points[stat] ?? 0) >= perStat}
                    onClick={() => changePoint(stat, 1)}
                  >
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">
          {t("character.pointsLeft", { left: budget - spent, total: budget, cap: perStat })}
        </p>
        <button
          type="button"
          className="secondary-button"
          disabled={spent === 0}
          onClick={() => act((g) => setPoints(g, pack, characterId, {}))}
        >
          {t("character.resetPoints")}
        </button>
      </section>

      <section className="card">
        <h3>{t("character.levelUp")}</h3>
        {owned.level >= cap ? (
          <p className="small">{t("character.levelCap", { cap })}</p>
        ) : (
          <>
            <p className="small">{t("character.levelUpCost", { gold: cost.gold, food: cost.food })}</p>
            <button
              type="button"
              className="primary-button"
              disabled={game.gold < cost.gold || game.food < cost.food}
              onClick={() => act((g) => levelUp(g, pack, characterId))}
            >
              {t("character.levelUp")} → {t("team.level", { level: owned.level + 1 })}
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h3>{t("character.skillOrder")}</h3>
        <p className="small muted">{t("character.skillOrderHint")}</p>
        <ol className="skill-list">
          {fullOrder.map((slot, index) => {
            const skill = skills[slot];
            if (!skill) return null;
            const unlock = pack.balance.skills.unlockLevels[slot] ?? 1;
            const locked = owned.level < unlock;
            return (
              <li key={slot} className={`skill-order-row${locked ? " locked" : ""}`}>
                <div className="row">
                  <span className="order-number">{index + 1}</span>
                  <span className="muted small">S{slot + 1}</span>
                  {index > 0 && (
                    <button type="button" className="link-button push-right" onClick={() => moveSkillUp(index)}>
                      ↑ {t("team.moveUp")}
                    </button>
                  )}
                </div>
                <ul className="skill-list">
                  <SkillRow skill={skill} element={character.element} />
                </ul>
                {locked && <p className="small muted">{t("character.skillLocked", { level: unlock })}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card">
        <h3>{t("character.item")}</h3>
        <select
          className="select"
          value={owned.itemUid ?? ""}
          aria-label={t("character.item")}
          onChange={(event) => {
            const value = event.target.value;
            act((g) => equipItem(g, characterId, value === "" ? null : Number(value)));
          }}
        >
          <option value="">{t("character.noItem")}</option>
          {game.items.map((item) => {
            const def = pack.items.get(item.itemId);
            const wearer = wearerOf(game, item.uid);
            const wearerName = wearer && wearer !== characterId ? pack.characters.get(wearer)?.name : undefined;
            return (
              <option key={item.uid} value={item.uid}>
                {def ? l(def.name) : item.itemId} ({t(`tier.${item.tier}`)})
                {wearerName ? ` · ${t("items.wornBy", { name: l(wearerName) })}` : ""}
              </option>
            );
          })}
        </select>
        {owned.itemUid !== null && (
          <p className="small muted">
            {(() => {
              const item = game.items.find((i) => i.uid === owned.itemUid);
              const def = item && pack.items.get(item.itemId);
              return def ? l(def.description) : "";
            })()}
          </p>
        )}
      </section>

      <section className="card">
        <h3>{t("character.stars", { stars: owned.stars })}</h3>
        {star?.kind === "max" && <p className="small">{t("character.maxStars")}</p>}
        {star && star.kind !== "max" && (
          <>
            <p className="small">{t("character.starCost", { cost: star.cost })}</p>
            {star.kind === "locked" && (
              <p className="small muted">{t("character.starLocked", { map: mapName(star.requiresBossOf) })}</p>
            )}
            <button
              type="button"
              className="primary-button"
              disabled={star.kind === "locked" || game.starMaterial < star.cost}
              onClick={() => act((g) => starUp(g, pack, characterId))}
            >
              {t("character.starUp", { stars: owned.stars + 1 })}
            </button>
          </>
        )}
      </section>
    </>
  );
}
