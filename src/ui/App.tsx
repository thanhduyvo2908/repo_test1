import { useState } from "react";
import { LANGUAGES, isLang } from "../i18n";
import { BattleScreen, type BattleTarget } from "./screens/BattleScreen";
import { CharacterScreen } from "./screens/CharacterScreen";
import { ItemsScreen } from "./screens/ItemsScreen";
import { MapInfoScreen } from "./screens/MapInfoScreen";
import { MapListScreen } from "./screens/MapListScreen";
import { TeamScreen } from "./screens/TeamScreen";
import { useStore } from "./store";

type Screen =
  | { name: "maps" }
  | { name: "map"; mapId: string }
  | { name: "battle"; target: BattleTarget }
  | { name: "team" }
  | { name: "character"; characterId: string }
  | { name: "items" };

type Tab = "maps" | "team" | "items";

function tabOf(screen: Screen): Tab {
  if (screen.name === "team" || screen.name === "character") return "team";
  if (screen.name === "items") return "items";
  return "maps";
}

export function App() {
  const { t, lang, setLang, pack } = useStore();
  const [screen, setScreen] = useState<Screen>({ name: "maps" });
  const tab = tabOf(screen);

  const backFromBattle = (target: BattleTarget): Screen =>
    target.kind === "dungeon" ? { name: "maps" } : { name: "map", mapId: target.mapId };

  return (
    <div className="app" lang={lang}>
      <header className="app-header">
        <h1>{t("app.title")}</h1>
        <label className="lang-picker">
          <span className="visually-hidden">{t("settings.language")}</span>
          <select
            value={lang}
            aria-label={t("settings.language")}
            onChange={(event) => {
              if (isLang(event.target.value)) setLang(event.target.value);
            }}
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {t(`lang.${code}`)}
              </option>
            ))}
          </select>
        </label>
      </header>

      {pack.demo && <p className="demo-banner small">{t("app.demo")}</p>}
      <ResourceBar />

      <nav className="tabs">
        {(["maps", "team", "items"] as const).map((name) => (
          <button
            key={name}
            type="button"
            className={tab === name ? "tab active" : "tab"}
            onClick={() => setScreen({ name } as Screen)}
          >
            {t(`nav.${name}`)}
          </button>
        ))}
      </nav>

      <main>
        {screen.name === "maps" && (
          <MapListScreen
            onOpenMap={(mapId) => setScreen({ name: "map", mapId })}
            onEnterDungeon={(dungeonId) => setScreen({ name: "battle", target: { kind: "dungeon", dungeonId } })}
          />
        )}
        {screen.name === "map" && (
          <MapInfoScreen
            mapId={screen.mapId}
            onBack={() => setScreen({ name: "maps" })}
            onFightStage={(stageIndex) =>
              setScreen({ name: "battle", target: { mapId: screen.mapId, kind: "stage", stageIndex } })
            }
            onFightBoss={() => setScreen({ name: "battle", target: { mapId: screen.mapId, kind: "boss" } })}
          />
        )}
        {screen.name === "battle" && (
          <BattleScreen
            key={JSON.stringify(screen.target)}
            target={screen.target}
            onBack={() => setScreen(backFromBattle(screen.target))}
            onAdvance={(stageIndex) => {
              const current = screen.target;
              if (current.kind === "dungeon") return;
              setScreen({ name: "battle", target: { kind: "stage", mapId: current.mapId, stageIndex } });
            }}
          />
        )}
        {screen.name === "team" && (
          <TeamScreen onOpenCharacter={(characterId) => setScreen({ name: "character", characterId })} />
        )}
        {screen.name === "character" && (
          <CharacterScreen characterId={screen.characterId} onBack={() => setScreen({ name: "team" })} />
        )}
        {screen.name === "items" && <ItemsScreen />}
      </main>

      <OfflineRewardDialog />
    </div>
  );
}

function ResourceBar() {
  const { game, t, n } = useStore();
  const entries = [
    ["gold", game.gold],
    ["food", game.food],
    ["dust", game.dust],
    ["starMaterial", game.starMaterial],
  ] as const;
  return (
    <ul className="resource-bar small" aria-label="Resources">
      {entries.map(([key, amount]) => (
        <li key={key} className={`resource resource-${key}`}>
          <span className="muted">{t(`resource.${key}`)}</span> <strong>{n(amount)}</strong>
        </li>
      ))}
    </ul>
  );
}

function OfflineRewardDialog() {
  const { offlineReward, dismissOfflineReward, t, n } = useStore();
  if (!offlineReward) return null;
  const minutes = Math.floor(offlineReward.elapsedMs / 60_000);
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog card" role="dialog" aria-modal="true" aria-labelledby="offline-title">
        <h2 id="offline-title">{t("offline.title")}</h2>
        <p className="small">
          {t("offline.body", {
            hours: Math.floor(minutes / 60),
            minutes: minutes % 60,
            battles: n(offlineReward.battles),
          })}
        </p>
        <p>
          <strong>{t("rewards.resources", { gold: n(offlineReward.gold), food: n(offlineReward.food) })}</strong>
        </p>
        <button type="button" className="primary-button" onClick={dismissOfflineReward}>
          {t("offline.claim")}
        </button>
      </div>
    </div>
  );
}
