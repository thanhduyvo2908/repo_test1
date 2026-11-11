import { isMapUnlocked, mapOrder, mapProgress } from "../../core/progress";
import { ElementBadge } from "../common";
import { useStore } from "../store";

export function MapListScreen({ onOpenMap }: { onOpenMap: (mapId: string) => void }) {
  const { pack, game, t, l } = useStore();
  const entries = mapOrder(pack);

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
    </>
  );
}
