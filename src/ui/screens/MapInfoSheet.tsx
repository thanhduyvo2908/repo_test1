import { ITEM_TIERS } from "../../content/schema";
import { isBossUnlocked, isStageUnlocked, mapOrder, mapProgress } from "../../core/progress";
import { frontStage, useAdventure } from "../adventure";
import { ElementBadge, Sheet, SkillRow } from "../common";
import { useNav } from "../nav";
import { Figure, Portrait } from "../SpriteFrame";
import { useStore } from "../store";
import { CounterHint, enemyRanges } from "./AdventureScreen";

/** Everything the player needs to plan a map: enemies, boss kit, drop, recruit chance, stages. */
export function MapInfoSheet({ mapId, onClose }: { mapId: string; onClose: () => void }) {
  const { pack, game, t, l } = useStore();
  const { grind, grindStage, fightBoss, battle } = useAdventure();
  const { closeAllSheets, setTab } = useNav();
  const entries = mapOrder(pack);
  const entry = entries.find((e) => e.map.id === mapId);
  if (!entry) return null;
  const { map, worldId } = entry;
  const worldMaps = entries.filter((e) => e.worldId === worldId);
  const number = worldMaps.findIndex((e) => e.map.id === mapId) + 1;
  const progress = mapProgress(game, mapId);
  const boss = pack.characters.get(map.boss.characterId);
  const dropItem = map.boss.dropItemId ? pack.items.get(map.boss.dropItemId) : undefined;
  const recruitRate = map.boss.recruitRate ?? pack.balance.worlds[worldId]?.recruitRate ?? 0;
  const owned = game.roster.some((c) => c.characterId === map.boss.characterId);
  const bossOpen = isBossUnlocked(game, pack, mapId);
  const front = frontStage(game, map);
  const here = grind.mapId === mapId;
  const ranges = enemyRanges(map.stages);
  const sizes = map.stages.map((s) => s.enemies.length);
  const firstEnemy = [...ranges.keys()][0];
  const firstEnemyDef = firstEnemy ? pack.enemies.get(firstEnemy) : undefined;
  const busyWithBoss = battle !== null && battle.target.kind !== "stage";

  const goGrind = (stageIndex: number) => {
    grindStage(mapId, stageIndex);
    closeAllSheets();
    setTab("adventure");
  };

  const state = progress.bossDefeated ? `✓ ${t("mapInfo.defeated")}` : here ? `▶ ${t("mapInfo.inProgress")}` : null;

  const banner = (
    <div className="banner">
      {state && <span className="chip px banner-state">{state}</span>}
      <button type="button" className="iconbtn banner-close" onClick={onClose} aria-label={t("nav.close")}>
        ✕
      </button>
      {firstEnemy && (
        <span className="banner-enemy">
          <Figure id={firstEnemy} scale={1.5} face="left" element={firstEnemyDef?.element} name={firstEnemyDef ? l(firstEnemyDef.name) : ""} />
        </span>
      )}
      <span className="banner-boss">
        <Figure id={map.boss.characterId} scale={2} face="left" element={boss?.element} name={boss ? l(boss.name) : ""} />
      </span>
    </div>
  );

  const footer = (
    <>
      <button type="button" className="btn ghost" onClick={() => goGrind(front)}>
        {t("mapInfo.grindStage", { n: front + 1 })}
      </button>
      <button
        type="button"
        className="btn"
        disabled={!bossOpen || busyWithBoss}
        onClick={() => {
          fightBoss(mapId);
          closeAllSheets();
          setTab("adventure");
        }}
      >
        {bossOpen ? t("mapInfo.fightBoss") : `${t("adventure.boss")} 🔒`}
      </button>
    </>
  );

  return (
    <Sheet labelledBy="mapinfo-title" banner={banner} footer={footer} onClose={onClose}>
      <div className="mapinfo-title">
        <div className="small muted">
          {map.arc ? `${l(map.arc)} · ` : ""}
          {t("adventure.mapOf", { n: number, total: worldMaps.length })}
        </div>
        <h2 className="px" id="mapinfo-title">
          {l(map.name)}
        </h2>
      </div>

      <div className="facts">
        <div className="fact">
          <div className="k">{t("mapInfo.boss")}</div>
          <div className="v px">
            {boss ? l(boss.name) : "?"} {boss && <ElementBadge element={boss.element} />}
          </div>
        </div>
        <div className="fact">
          <div className="k">{t("mapInfo.bossLevel")}</div>
          <div className="v px">{map.boss.level}</div>
        </div>
        <div className="fact">
          <div className="k">{t("mapInfo.recruitChance")}</div>
          <div className="v px">{owned ? t("mapInfo.owned") : `${Math.round(recruitRate * 100)}%`}</div>
        </div>
        <div className="fact">
          <div className="k">{t("mapInfo.drop")}</div>
          <div className="v px">{dropItem ? `${Math.round(pack.balance.drops.itemDropChance * 100)}%` : "—"}</div>
        </div>
      </div>

      {!bossOpen && (
        <p className="small muted pad">{t("adventure.bossLocked", { count: Math.max(0, map.stages.length - progress.stagesCleared) })}</p>
      )}

      {boss && (
        <section className="card">
          <h3 className="h px">
            {t("mapInfo.skills")} <span className="right small">{map.boss.skills.length + 1}</span>
          </h3>
          <ul className="skill-list">
            {[map.boss.basicAttack, ...map.boss.skills].map((skill) => (
              <SkillRow key={skill.id} skill={skill} element={boss.element} />
            ))}
          </ul>
        </section>
      )}

      {dropItem && (
        <section className="card">
          <h3 className="h px">{t("mapInfo.drops")}</h3>
          <div className="row">
            <span className="item-icon">◈</span>
            <div className="grow">
              <div className="px">{l(dropItem.name)}</div>
              <div className="small muted">{l(dropItem.description)}</div>
            </div>
          </div>
          <div className="tiers">
            {ITEM_TIERS.map((tier) => (
              <span key={tier} className={`tier-chip t-${tier}`}>
                {t("tier.bonus", { tier: t(`tier.${tier}`), percent: Math.round(dropItem.effect.valueByTier[tier] * 100) })}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h3 className="h px">{t("mapInfo.enemies")}</h3>
        <ul className="enemy-list">
          {[...ranges].map(([enemyId, range]) => {
            const enemy = pack.enemies.get(enemyId);
            if (!enemy) return null;
            return (
              <li key={enemyId} className="enemy">
                <Portrait id={enemyId} size={32} element={enemy.element} name={l(enemy.name)} face="left" />
                <span className="small">
                  {l(enemy.name)}
                  <br />
                  <ElementBadge element={enemy.element} />{" "}
                  <span className="muted">
                    {t("mapInfo.levelRange", { min: range.min, max: range.max })} ·{" "}
                    {t("mapInfo.perStage", { min: Math.min(...sizes), max: Math.max(...sizes) })}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <CounterHint mapId={mapId} />
      </section>

      <section className="card">
        <h3 className="h px">
          {t("mapInfo.stages")}
          <span className="right small">
            {Math.min(progress.stagesCleared, map.stages.length)}/{map.stages.length}
          </span>
        </h3>
        <ol className="stages">
          {map.stages.map((stage, index) => {
            const open = isStageUnlocked(game, pack, mapId, index);
            const cleared = index < progress.stagesCleared;
            const cur = here && index === grind.stageIndex;
            return (
              <li key={index}>
                <button
                  type="button"
                  className={`stage px${cleared ? " done" : ""}${cur ? " cur" : ""}`}
                  disabled={!open}
                  onClick={() => goGrind(index)}
                  aria-label={`${t("mapInfo.stage", { n: index + 1 })} · ${t("mapInfo.enemyCount", { count: stage.enemies.length })}`}
                >
                  {open ? index + 1 : "🔒"}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </Sheet>
  );
}

