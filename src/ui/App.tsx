import { useState } from "react";
import { LANGUAGES, isLang } from "../i18n";
import { BattleScreen, type BattleTarget } from "./screens/BattleScreen";
import { MapInfoScreen } from "./screens/MapInfoScreen";
import { MapListScreen } from "./screens/MapListScreen";
import { TeamScreen } from "./screens/TeamScreen";
import { useStore } from "./store";

type Screen =
  | { name: "maps" }
  | { name: "map"; mapId: string }
  | { name: "battle"; target: BattleTarget }
  | { name: "team" };

export function App() {
  const { t, lang, setLang } = useStore();
  const [screen, setScreen] = useState<Screen>({ name: "maps" });
  const tab = screen.name === "team" ? "team" : "maps";

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

      <nav className="tabs">
        <button
          type="button"
          className={tab === "maps" ? "tab active" : "tab"}
          onClick={() => setScreen({ name: "maps" })}
        >
          {t("nav.maps")}
        </button>
        <button
          type="button"
          className={tab === "team" ? "tab active" : "tab"}
          onClick={() => setScreen({ name: "team" })}
        >
          {t("nav.team")}
        </button>
      </nav>

      <main>
        {screen.name === "maps" && (
          <MapListScreen onOpenMap={(mapId) => setScreen({ name: "map", mapId })} />
        )}
        {screen.name === "map" && (
          <MapInfoScreen
            mapId={screen.mapId}
            onBack={() => setScreen({ name: "maps" })}
            onFightStage={(stageIndex) =>
              setScreen({ name: "battle", target: { mapId: screen.mapId, kind: "stage", stageIndex } })
            }
            onFightBoss={() =>
              setScreen({ name: "battle", target: { mapId: screen.mapId, kind: "boss" } })
            }
          />
        )}
        {screen.name === "battle" && (
          <BattleScreen
            key={JSON.stringify(screen.target)}
            target={screen.target}
            onBack={() => setScreen({ name: "map", mapId: screen.target.mapId })}
          />
        )}
        {screen.name === "team" && <TeamScreen />}
      </main>
    </div>
  );
}
