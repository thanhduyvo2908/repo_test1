import type { GameMap } from "../../content/schema";
import { dungeonAttemptsLeft, isDungeonUnlocked } from "../../core/dungeons";
import { isMapUnlocked, levelCap, mapOrder, mapProgress, type MapEntry } from "../../core/progress";
import { useAdventure } from "../adventure";
import { Bar, ElementBadge, Sheet } from "../common";
import { useNav } from "../nav";
import { Portrait } from "../SpriteFrame";
import { todayKey, useStore } from "../store";
import { enemyRanges } from "./AdventureScreen";

/** Maps of every world, grouped by arc, with side dungeons after the map that opens them. */
export function WorldSheet({ onClose }: { onClose: () => void }) {
  const { pack, game, t, l } = useStore();
  const entries = mapOrder(pack);
  const cap = levelCap(game, pack);
  return (
    <Sheet
      onClose={onClose}
      labelledBy="world-title"
      title={pack.worlds.length === 1 && pack.worlds[0] ? l(pack.worlds[0].name) : t("world.title")}
      subtitle={pack.worlds.length === 1 ? worldSummary(pack.worlds[0]!.id) : t("world.levelCap", { cap })}
    >
      {pack.worlds.map((world, worldIndex) => {
        const maps = entries.filter((e) => e.worldId === world.id);
        return (
          <div key={world.id}>
            {pack.worlds.length > 1 && <h3 className="world-head px">{l(world.name)}</h3>}
            {groupByArc(maps).map((group, i) => (
              <ArcGroup key={i} entries={group} worldIndex={worldIndex} />
            ))}
          </div>
        );
      })}
    </Sheet>
  );

  function worldSummary(worldId: string): string {
    const maps = entries.filter((e) => e.worldId === worldId);
    const defeated = maps.filter((e) => mapProgress(game, e.map.id).bossDefeated).length;
    const worldNumber = pack.worlds.findIndex((w) => w.id === worldId) + 1;
    return t("world.summary", {
      n: worldNumber,
      defeated,
      total: maps.length,
      cap: pack.balance.worlds[worldId]?.levelCap ?? cap,
    });
  }
}

function groupByArc(entries: MapEntry[]): MapEntry[][] {
  const groups: MapEntry[][] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    const arc = entry.map.arc?.en;
    if (last && last[0]?.map.arc?.en === arc) last.push(entry);
    else groups.push([entry]);
  }
  return groups;
}

function ArcGroup({ entries }: { entries: MapEntry[]; worldIndex: number }) {
  const { pack, game, l } = useStore();
  const arc = entries[0]?.map.arc;
  const defeated = entries.filter((e) => mapProgress(game, e.map.id).bossDefeated).length;
  return (
    <section>
      {arc && (
        <h3 className="arc px">
          {l(arc)}
          <span>
            {defeated}/{entries.length}
          </span>
        </h3>
      )}
      <ul className="map-rows">
        {entries.map((entry) => (
          <li key={entry.map.id}>
            <MapRow entry={entry} />
            {[...pack.sideDungeons.values()]
              .filter((d) => d.unlockAfterMapId === entry.map.id)
              .map((d) => (
                <DungeonRow key={d.id} dungeonId={d.id} />
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MapRow({ entry }: { entry: MapEntry }) {
  const { pack, game, t, l } = useStore();
  const { grind } = useAdventure();
  const { openSheet } = useNav();
  const { map } = entry;
  const unlocked = isMapUnlocked(game, pack, map.id);
  const progress = mapProgress(game, map.id);
  const boss = pack.characters.get(map.boss.characterId);
  const current = grind.mapId === map.id;
  const ownsBoss = game.roster.some((c) => c.characterId === map.boss.characterId);
  const ownsItem = map.boss.dropItemId !== undefined && game.items.some((i) => i.itemId === map.boss.dropItemId);
  const number = String(entry.index + 1).padStart(2, "0");
  const state = current ? "cur" : !unlocked ? "locked" : progress.bossDefeated ? "done" : "";
  const previousBoss = previousBossName(entry);
  return (
    <button
      type="button"
      className={`maprow ${state}`}
      disabled={!unlocked}
      onClick={() => openSheet({ kind: "map", mapId: map.id })}
    >
      <span className="no px">{number}</span>
      {unlocked ? (
        <Portrait id={map.boss.characterId} size={44} element={boss?.element} name={boss ? l(boss.name) : ""} />
      ) : (
        <span className="portrait portrait-fallback" style={{ width: 44, height: 44 }}>
          ?
        </span>
      )}
      <span className="grow">
        <span className="t px block">{l(map.name)}</span>
        <span className="meta">
          {unlocked ? (
            <>
              {levelRange(map, t)}
              {boss && <ElementBadge element={boss.element} />}
              {current && (
                <>
                  <Bar kind="progress" ratio={Math.min(progress.stagesCleared, map.stages.length) / map.stages.length} />
                  {Math.min(progress.stagesCleared, map.stages.length)}/{map.stages.length}
                </>
              )}
            </>
          ) : (
            <>🔒 {previousBoss ? t("world.defeatToOpen", { name: previousBoss }) : t("map.locked")}</>
          )}
        </span>
      </span>
      {current ? (
        <span className="pill on px">{t("world.here")}</span>
      ) : (
        unlocked && (
          <span className="flags" aria-label={flagLabel()}>
            {progress.bossDefeated && <span title={t("map.bossDefeated")}>✓</span>}
            {ownsBoss && <span title={t("world.flagRecruited")}>★</span>}
            {ownsItem && <span title={t("world.flagItem")}>◈</span>}
          </span>
        )
      )}
    </button>
  );

  function flagLabel(): string {
    return [
      progress.bossDefeated ? t("map.bossDefeated") : "",
      ownsBoss ? t("world.flagRecruited") : "",
      ownsItem ? t("world.flagItem") : "",
    ]
      .filter(Boolean)
      .join(", ");
  }

  function previousBossName(e: MapEntry): string | null {
    const previous = mapOrder(pack)[e.index - 1];
    const c = previous ? pack.characters.get(previous.map.boss.characterId) : undefined;
    return c ? l(c.name) : null;
  }
}

function levelRange(map: GameMap, t: ReturnType<typeof useStore>["t"]): string {
  let min = Infinity;
  let max = 0;
  for (const range of enemyRanges(map.stages).values()) {
    min = Math.min(min, range.min);
    max = Math.max(max, range.max);
  }
  return Number.isFinite(min) ? t("mapInfo.levelRange", { min, max }) : "";
}

function DungeonRow({ dungeonId }: { dungeonId: string }) {
  const { pack, game, t, l } = useStore();
  const { enterDungeon } = useAdventure();
  const { closeAllSheets, setTab } = useNav();
  const dungeon = pack.sideDungeons.get(dungeonId);
  if (!dungeon) return null;
  const unlocked = isDungeonUnlocked(game, pack, dungeon.id);
  const left = dungeonAttemptsLeft(game, pack, todayKey());
  const boss = pack.characters.get(dungeon.boss.characterId);
  const afterMap = pack.maps.get(dungeon.unlockAfterMapId);
  return (
    <div className={`maprow side${unlocked ? "" : " locked"}`}>
      <span className="no px">⚑</span>
      <Portrait id={dungeon.boss.characterId} size={44} element={boss?.element} name={boss ? l(boss.name) : ""} dim={!unlocked} />
      <span className="grow">
        <span className="t px block">{l(dungeon.name)}</span>
        <span className="meta">
          {unlocked
            ? t("world.dungeonMeta", { level: dungeon.boss.level, amount: dungeon.rewards.starMaterial })
            : `🔒 ${t("dungeon.locked", { map: afterMap ? l(afterMap.name) : dungeon.unlockAfterMapId })}`}
        </span>
      </span>
      {unlocked && (
        <button
          type="button"
          className="pill px"
          disabled={left <= 0}
          onClick={() => {
            if (enterDungeon(dungeon.id)) {
              closeAllSheets();
              setTab("adventure");
            }
          }}
        >
          {left > 0 ? t("dungeon.fight") : t("world.noneLeft")}
        </button>
      )}
    </div>
  );
}
