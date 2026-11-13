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
import type { Pack } from "../../content/loader";
import { Bar, ElementBadge, Sheet, SkillRow } from "../common";
import { Figure, Portrait } from "../SpriteFrame";
import { errorKey, useStore } from "../store";

type Section = "stats" | "skills" | "gear";

/** Levels a character as far as gold, food and the cap allow. Calls the core level-up step in a loop. */
function levelUpMax(state: GameState, pack: Pack, characterId: string): ActionResult {
  let current = levelUp(state, pack, characterId);
  if (!current.ok) return current;
  for (;;) {
    const next = levelUp(current.state, pack, characterId);
    if (!next.ok) return current;
    current = next;
  }
}

/** How many levels "Max" would buy right now. */
function affordableLevels(state: GameState, pack: Pack, characterId: string): number {
  let count = 0;
  let current = state;
  for (let guard = 0; guard < 1000; guard++) {
    const next = levelUp(current, pack, characterId);
    if (!next.ok) break;
    current = next.state;
    count += 1;
  }
  return count;
}

/** Growth for one character: level, stat points, skill order, item and stars. Proposal 5.8. */
export function CharacterSheet({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const { pack, game, runAction, t, l, n } = useStore();
  const [error, setError] = useState<ActionError | null>(null);
  const [section, setSection] = useState<Section>("stats");
  const character = pack.characters.get(characterId);
  const owned = findOwned(game, characterId);
  if (!character || !owned) return null;

  const act = (action: (g: GameState) => ActionResult) => setError(runAction(action));
  const cap = levelCap(game, pack);
  const cost = levelUpCost(pack, owned.level);
  const affordable = owned.level < cap ? affordableLevels(game, pack, characterId) : 0;

  const banner = (
    <header className="char-head">
      <span className="char-art">
        <Figure id={characterId} scale={1.6} element={character.element} name={l(character.name)} />
      </span>
      <span className="grow">
        <h2 className="px" id="char-title">
          {l(character.name)}
        </h2>
        <span className="row small">
          <ElementBadge element={character.element} />
          <span className="pill px">{t(`damageType.${character.damageType}`)}</span>
          <span className="gold px">{"★".repeat(owned.stars)}</span>
        </span>
        <span className="px char-level">
          {t("team.levelShort", { level: owned.level })}
          <span className="muted small"> / {cap}</span>
        </span>
      </span>
      <button type="button" className="iconbtn" onClick={onClose} aria-label={t("nav.close")}>
        ✕
      </button>
    </header>
  );

  return (
    <Sheet labelledBy="char-title" banner={banner} onClose={onClose}>
      <section className="card level-card">
        {owned.level >= cap ? (
          <p className="small">{t("character.levelCap", { cap })}</p>
        ) : (
          <>
            <p className="small">
              {t("character.levelUpCost", { gold: n(cost.gold), food: n(cost.food) })}
            </p>
            <div className="row">
              <button
                type="button"
                className="btn"
                disabled={game.gold < cost.gold || game.food < cost.food}
                onClick={() => act((g) => levelUp(g, pack, characterId))}
              >
                {t("character.levelUpOne")}
              </button>
              <button
                type="button"
                className="btn gold"
                disabled={affordable === 0}
                onClick={() => act((g) => levelUpMax(g, pack, characterId))}
              >
                {t("character.levelUpMax", { count: affordable })}
              </button>
            </div>
          </>
        )}
        {error && (
          <p className="error small" role="alert">
            {t(errorKey(error))}
          </p>
        )}
      </section>

      <div className="segmented" role="tablist">
        {(["stats", "skills", "gear"] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={section === s} className={section === s ? "on" : ""} onClick={() => setSection(s)}>
            {t(`character.section.${s}`)}
          </button>
        ))}
      </div>

      {section === "stats" && <StatsSection characterId={characterId} act={act} />}
      {section === "skills" && <SkillsSection characterId={characterId} act={act} />}
      {section === "gear" && <GearSection characterId={characterId} act={act} />}
    </Sheet>
  );
}

type Act = (action: (g: GameState) => ActionResult) => void;

function StatsSection({ characterId, act }: { characterId: string; act: Act }) {
  const { pack, game, t } = useStore();
  const owned = findOwned(game, characterId)!;
  const character = pack.characters.get(characterId)!;
  // Stats as they fight, using the same builder as battles.
  const member = teamMembers({ ...game, team: [characterId] })[0];
  const stats = member ? buildCharacterUnit(pack, member).stats : character.baseStats;
  const budget = pointBudget(pack, owned.level);
  const perStat = pointCapPerStat(pack, owned.level);
  const spent = pointsSpent(owned.points);
  const top = Math.max(...STAT_KEYS.filter((k) => k !== "hp").map((k) => stats[k]), 1);

  const setPoint = (stat: StatKey, value: number) => {
    const others = spent - (owned.points[stat] ?? 0);
    const clamped = Math.max(0, Math.min(perStat, budget - others, Math.floor(value)));
    act((g) => setPoints(g, pack, characterId, { ...owned.points, [stat]: clamped }));
  };

  return (
    <section className="card">
      <p className="small muted">{t("character.pointsLeft", { left: budget - spent, total: budget, cap: perStat })}</p>
      <table className="stat-table">
        <tbody>
          {STAT_KEYS.map((stat) => {
            const points = owned.points[stat] ?? 0;
            return (
              <tr key={stat}>
                <th scope="row" className="small">
                  {t(`stat.${stat}`)}
                </th>
                <td className="num px">{stats[stat]}</td>
                <td className="stat-bar">{stat !== "hp" && <Bar kind="progress" ratio={stats[stat] / top} />}</td>
                <td className="point-controls">
                  <button
                    type="button"
                    className="iconbtn"
                    aria-label={`− ${t(`stat.${stat}`)}`}
                    disabled={points <= 0}
                    onClick={() => setPoint(stat, points - 1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className="num-input px"
                    min={0}
                    max={perStat}
                    value={points}
                    aria-label={t("character.pointsFor", { stat: t(`stat.${stat}`) })}
                    onChange={(event) => setPoint(stat, Number(event.target.value) || 0)}
                  />
                  <button
                    type="button"
                    className="iconbtn"
                    aria-label={`+ ${t(`stat.${stat}`)}`}
                    disabled={spent >= budget || points >= perStat}
                    onClick={() => setPoint(stat, points + 1)}
                  >
                    +
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" className="btn ghost" disabled={spent === 0} onClick={() => act((g) => setPoints(g, pack, characterId, {}))}>
        {t("character.resetPoints")}
      </button>
    </section>
  );
}

function SkillsSection({ characterId, act }: { characterId: string; act: Act }) {
  const { pack, game, t, l } = useStore();
  const owned = findOwned(game, characterId)!;
  const character = pack.characters.get(characterId)!;
  const skills = currentSkills(game, pack, characterId);
  const order = owned.skillOrder ?? skills.map((_, slot) => slot);
  const fullOrder = [...order, ...skills.map((_, slot) => slot).filter((slot) => !order.includes(slot))];
  const move = (index: number, by: -1 | 1) => {
    const next = [...fullOrder];
    const [slot] = next.splice(index, 1);
    if (slot !== undefined) next.splice(index + by, 0, slot);
    act((g) => setSkillOrder(g, pack, characterId, next));
  };
  return (
    <section className="card">
      <p className="small muted">{t("character.skillOrderHint")}</p>
      <h3 className="h px">{t("character.passive")}</h3>
      <div className="skill passive">
        <div className="skill-top">
          <span className="px">{l(character.passive.name)}</span>
        </div>
        <p>{l(character.passive.description)}</p>
      </div>
      <h3 className="h px">{t("character.skillOrder")}</h3>
      <ol className="skill-list">
        {fullOrder.map((slot, index) => {
          const skill = skills[slot];
          if (!skill) return null;
          const unlock = pack.balance.skills.unlockLevels[slot] ?? 1;
          const locked = owned.level < unlock;
          return (
            <SkillRow
              key={slot}
              skill={skill}
              element={character.element}
              extra={
                <div className="row skill-order">
                  <span className="order-number px">{index + 1}</span>
                  <span className="muted small">S{slot + 1}</span>
                  {locked && <span className="small muted">🔒 {t("character.skillLocked", { level: unlock })}</span>}
                  <span className="grow" />
                  <button type="button" className="iconbtn" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t("team.moveUp")}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    disabled={index === fullOrder.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={t("team.moveDown")}
                  >
                    ↓
                  </button>
                </div>
              }
            />
          );
        })}
      </ol>
      <h3 className="h px">{t("character.basic")}</h3>
      <ul className="skill-list">
        <SkillRow skill={character.basicAttack} element={character.element} />
      </ul>
    </section>
  );
}

function GearSection({ characterId, act }: { characterId: string; act: Act }) {
  const { pack, game, t, l, n } = useStore();
  const owned = findOwned(game, characterId)!;
  const hasStarLevels = (pack.characters.get(characterId)?.stars.length ?? 0) > 0;
  const star = hasStarLevels ? nextStarStatus(game, pack, characterId) : null;
  const mapName = (mapId: string) => {
    const map = pack.maps.get(mapId);
    return map ? l(map.name) : mapId;
  };
  return (
    <>
      <section className="card">
        <h3 className="h px">{t("character.item")}</h3>
        {game.items.length === 0 ? (
          <p className="small muted">{t("items.empty")}</p>
        ) : (
          <ul className="item-grid">
            {game.items.map((item) => {
              const def = pack.items.get(item.itemId);
              const wearer = wearerOf(game, item.uid);
              const worn = owned.itemUid === item.uid;
              const wearerChar = wearer && wearer !== characterId ? pack.characters.get(wearer) : undefined;
              return (
                <li key={item.uid}>
                  <button
                    type="button"
                    className={`item-card tier-${item.tier}${worn ? " selected" : ""}`}
                    aria-pressed={worn}
                    onClick={() => act((g) => equipItem(g, characterId, worn ? null : item.uid))}
                  >
                    <span className="px item-name">{def ? l(def.name) : item.itemId}</span>
                    <span className={`small t-${item.tier}`}>
                      {t(`tier.${item.tier}`)}
                      {def && ` · +${Math.round(def.effect.valueByTier[item.tier] * 100)}%`}
                    </span>
                    {wearerChar && (
                      <span className="item-wearer" title={t("items.wornBy", { name: l(wearerChar.name) })}>
                        <Portrait id={wearerChar.id} size={22} element={wearerChar.element} name={l(wearerChar.name)} />
                      </span>
                    )}
                    {worn && <span className="small win">{t("character.equipped")}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
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
        <h3 className="h px">{t("character.starsTitle")}</h3>
        {star?.kind === "max" && <p className="small">{t("character.maxStars")}</p>}
        {!star && <p className="small muted">{t("character.noStars")}</p>}
        {star && star.kind !== "max" && (
          <>
            <p className="small">
              {t("character.starCost", { cost: star.cost })} · {t("character.starHave", { have: n(game.starMaterial) })}
            </p>
            {star.kind === "locked" && <p className="small muted">🔒 {t("character.starLocked", { map: mapName(star.requiresBossOf) })}</p>}
            <button
              type="button"
              className="btn gold"
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
