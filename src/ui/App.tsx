import type { Pack } from "../content/loader";
import { LANGUAGES, isLang } from "../i18n";
import { useI18n } from "./i18n";

export function App({ pack }: { pack: Pack }) {
  const { t, l, lang, setLang } = useI18n();
  const starter = pack.characters.get(pack.manifest.starterCharacterId);

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>{t("app.title")}</h1>
          <p className="muted">{t("app.tagline")}</p>
        </div>
        <label className="lang-picker">
          <span>{t("settings.language")}</span>
          <select
            value={lang}
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

      {starter && (
        <p className="starter">
          {t("home.starter", { name: l(starter.name) })}{" "}
          <span className={`element element-${starter.element}`}>
            {t(`element.${starter.element}`)}
          </span>
        </p>
      )}

      {pack.worlds.map((world) => (
        <section key={world.id} className="world">
          <h2>{l(world.name)}</h2>
          <h3 className="muted">{t("home.maps")}</h3>
          <ul className="map-list">
            {world.maps.map((map) => {
              const boss = pack.characters.get(map.boss.characterId);
              const recruitRate =
                map.boss.recruitRate ?? pack.balance.worlds[world.id]?.recruitRate ?? 0;
              return (
                <li key={map.id} className="map-card">
                  <strong>{l(map.name)}</strong>
                  <span>{t("map.stageCount", { count: map.stages.length })}</span>
                  {boss && (
                    <span>
                      {t("map.boss", { name: l(boss.name), level: map.boss.level })}{" "}
                      <span className={`element element-${boss.element}`}>
                        {t(`element.${boss.element}`)}
                      </span>
                    </span>
                  )}
                  <span className="muted">
                    {t("map.recruitRate", { percent: Math.round(recruitRate * 100) })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
