import { ITEM_TIERS } from "../../content/schema";
import { isBossUnlocked, isStageUnlocked, mapOrder, mapProgress } from "../../core/progress";
import { BackButton, ElementBadge, SkillRow } from "../common";
import { useStore } from "../store";

interface Props {
  mapId: string;
  onBack: () => void;
  onFightStage: (stageIndex: number) => void;
  onFightBoss: () => void;
}

/** Everything the player needs to plan a map: enemies, boss kit, drop, recruit chance. */
export function MapInfoScreen({ mapId, onBack, onFightStage, onFightBoss }: Props) {
  const { pack, game, t, l } = useStore();
  const entry = mapOrder(pack).find((e) => e.map.id === mapId);
  if (!entry) return null;
  const { map, worldId } = entry;
  const progress = mapProgress(game, mapId);
  const boss = pack.characters.get(map.boss.characterId);
  const dropItem = map.boss.dropItemId ? pack.items.get(map.boss.dropItemId) : undefined;
  const recruitRate = map.boss.recruitRate ?? pack.balance.worlds[worldId]?.recruitRate ?? 0;
  const owned = game.roster.some((c) => c.characterId === map.boss.characterId);
  const bossUnlocked = isBossUnlocked(game, pack, mapId);

  // Enemy types with the level range they appear at in this map.
  const enemyLevels = new Map<string, { min: number; max: number }>();
  for (const stage of map.stages) {
    for (const { enemyId, level } of stage.enemies) {
      const range = enemyLevels.get(enemyId);
      enemyLevels.set(enemyId, {
        min: Math.min(range?.min ?? level, level),
        max: Math.max(range?.max ?? level, level),
      });
    }
  }

  return (
    <>
      <BackButton onClick={onBack} />
      <h2>{l(map.name)}</h2>

      <section>
        <h3>{t("mapInfo.enemies")}</h3>
        <ul className="card-list">
          {[...enemyLevels].map(([enemyId, range]) => {
            const enemy = pack.enemies.get(enemyId);
            if (!enemy) return null;
            return (
              <li key={enemyId} className="card row">
                <strong>{l(enemy.name)}</strong>
                <ElementBadge element={enemy.element} />
                <span className="muted">
                  {t("mapInfo.levelRange", { min: range.min, max: range.max })}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {boss && (
        <section>
          <h3>{t("mapInfo.boss")}</h3>
          <div className="card">
            <div className="row">
              <strong>{l(boss.name)}</strong>
              <ElementBadge element={boss.element} />
              <span className="muted">{t("mapInfo.level", { level: map.boss.level })}</span>
            </div>
            <p className="small">
              {owned
                ? t("mapInfo.alreadyOwned")
                : t("map.recruitRate", { percent: Math.round(recruitRate * 100) })}
            </p>
            <h4>{t("mapInfo.skills")}</h4>
            <ul className="skill-list">
              {[map.boss.basicAttack, ...map.boss.skills].map((skill) => (
                <SkillRow key={skill.id} skill={skill} element={boss.element} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {dropItem && (
        <section>
          <h3>{t("mapInfo.drop")}</h3>
          <div className="card">
            <strong>{l(dropItem.name)}</strong>
            <p className="small">{l(dropItem.description)}</p>
            <p className="small muted">
              {t("mapInfo.dropChance", {
                percent: Math.round(pack.balance.drops.itemDropChance * 100),
              })}
            </p>
            <ul className="tier-list small">
              {ITEM_TIERS.map((tier) => (
                <li key={tier} className={`tier tier-${tier}`}>
                  {t("tier.bonus", {
                    tier: t(`tier.${tier}`),
                    percent: Math.round(dropItem.effect.valueByTier[tier] * 100),
                  })}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section>
        <h3>{t("mapInfo.stages")}</h3>
        <ul className="stage-grid">
          {map.stages.map((stage, index) => {
            const unlocked = isStageUnlocked(game, pack, mapId, index);
            const cleared = index < progress.stagesCleared;
            return (
              <li key={index}>
                <button
                  type="button"
                  className={`stage-button${cleared ? " cleared" : ""}`}
                  disabled={!unlocked}
                  onClick={() => onFightStage(index)}
                >
                  <strong>{t("mapInfo.stage", { n: index + 1 })}</strong>
                  <span className="small muted">
                    {unlocked
                      ? cleared
                        ? t("mapInfo.cleared")
                        : t("mapInfo.enemyCount", { count: stage.enemies.length })
                      : "🔒"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="primary-button boss-button"
          disabled={!bossUnlocked}
          onClick={onFightBoss}
        >
          {t("mapInfo.fightBoss")}
        </button>
        {!bossUnlocked && <p className="small muted">{t("mapInfo.bossLocked")}</p>}
      </section>
    </>
  );
}
