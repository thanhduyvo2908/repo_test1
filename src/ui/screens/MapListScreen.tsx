import { dungeonAttemptsLeft, isDungeonUnlocked } from "../../core/dungeons";
import { isMapUnlocked, mapOrder, mapProgress } from "../../core/progress";
import { ElementBadge } from "../common";
import { todayKey, useStore } from "../store";

export function MapListScreen({
  onOpenMap,
  onEnterDungeon,
}: {
  onOpenMap: (mapId: string) => void;
  onEnterDungeon: (dungeonId: string) => void;
}) {
  const { pack, game, t, l } = useStore();
  const entries = mapOrder(pack);
  const left = dungeonAttemptsLeft(game, pack, todayKey());
  const maxAttempts = pack.balance.sideDungeon.attemptsPerDay;

  return (
    <>
      {pack.worlds.map((world) => (
        <section key={world.id}>
          <h2>{l(world.name)}</h2>
          <ul className="card-list">
            {entries
              .filter((entry) => entry.worldId === world.id)
              .map(({ map }) => {
                const unlocked = isMapUnlocked(game, pack, map.id);
                const progress = mapProgress(game, map.id);
                const boss = pack.characters.get(map.boss.characterId);
                return (
                  <li key={map.id}>
                    <button
                      type="button"
                      className="card card-button"
                      disabled={!unlocked}
                      onClick={() => onOpenMap(map.id)}
                    >
                      <strong>{l(map.name)}</strong>
                      {unlocked ? (
                        <>
                          <span>
                            {t("map.progress", {
                              cleared: Math.min(progress.stagesCleared, map.stages.length),
                              total: map.stages.length,
                            })}
                            {progress.bossDefeated && ` · ${t("map.bossDefeated")}`}
                          </span>
                          {boss && (
                            <span>
                              {t("map.boss", { name: l(boss.name), level: map.boss.level })}{" "}
                              <ElementBadge element={boss.element} />
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="muted">🔒 {t("map.locked")}</span>
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      {pack.sideDungeons.size > 0 && (
        <section>
          <h2>{t("dungeon.title")}</h2>
          <p className="small muted">{t("dungeon.attemptsLeft", { left, max: maxAttempts })}</p>
          <ul className="card-list">
            {[...pack.sideDungeons.values()].map((dungeon) => {
              const unlocked = isDungeonUnlocked(game, pack, dungeon.id);
              const boss = pack.characters.get(dungeon.boss.characterId);
              const afterMap = pack.maps.get(dungeon.unlockAfterMapId);
              return (
                <li key={dungeon.id} className="card">
                  <div className="row">
                    <strong>{l(dungeon.name)}</strong>
                    {boss && <ElementBadge element={boss.element} />}
                    <span className="muted small">{t("mapInfo.level", { level: dungeon.boss.level })}</span>
                  </div>
                  <p className="small">{t("dungeon.reward", { amount: dungeon.rewards.starMaterial })}</p>
                  {unlocked ? (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={left <= 0}
                      onClick={() => onEnterDungeon(dungeon.id)}
                    >
                      {left > 0 ? t("dungeon.fight") : t("dungeon.noAttempts")}
                    </button>
                  ) : (
                    <p className="small muted">
                      🔒 {t("dungeon.locked", { map: afterMap ? l(afterMap.name) : dungeon.unlockAfterMapId })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
