import { useState } from "react";
import { LANGUAGES } from "../../i18n";
import { useAdventure, type NewsItem } from "../adventure";
import { Dialog } from "../common";
import { useStore } from "../store";

/** Welcome-back dialog. The reward is already in the save when it shows, so the button only closes it. */
export function OfflineDialog() {
  const { offlineReward, dismissOfflineReward, pack, t, n } = useStore();
  if (!offlineReward) return null;
  const minutes = Math.floor(offlineReward.elapsedMs / 60_000);
  const capped = offlineReward.elapsedMs >= pack.balance.offline.maxHours * 3_600_000;
  return (
    <Dialog labelledBy="offline-title" onClose={dismissOfflineReward} className="offline">
      <h2 className="px" id="offline-title">
        {t("offline.title")}
      </h2>
      <p className="small">
        {t("offline.body", { hours: Math.floor(minutes / 60), minutes: minutes % 60, battles: n(offlineReward.battles) })}
      </p>
      <div className="row px offline-res">
        <span className="res">
          <i className="coin" />+{n(offlineReward.gold)}
        </span>
        <span className="res">
          <i className="food" />+{n(offlineReward.food)}
        </span>
      </div>
      {capped && <p className="small muted">{t("offline.capped", { hours: pack.balance.offline.maxHours })}</p>}
      <p className="small muted">{t("offline.added")}</p>
      <button type="button" className="btn block" onClick={dismissOfflineReward}>
        {t("offline.ok")}
      </button>
    </Dialog>
  );
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { pack, game, lang, setLang, t, n } = useStore();
  return (
    <Dialog labelledBy="settings-title" onClose={onClose} className="settings">
      <header className="row">
        <h2 className="px grow" id="settings-title">
          {t("settings.title")}
        </h2>
        <button type="button" className="iconbtn" onClick={onClose} aria-label={t("nav.close")}>
          ✕
        </button>
      </header>
      <h3 className="h px">{t("settings.language")}</h3>
      <div className="segmented" role="group" aria-label={t("settings.language")}>
        {LANGUAGES.map((code) => (
          <button key={code} type="button" className={code === lang ? "on" : ""} aria-pressed={code === lang} onClick={() => setLang(code)}>
            {t(`lang.${code}`)}
          </button>
        ))}
      </div>
      <h3 className="h px">{t("settings.resources")}</h3>
      <ul className="resource-list">
        <li>
          <i className="coin" /> {t("resource.gold")} <strong className="px">{n(game.gold)}</strong>
        </li>
        <li>
          <i className="food" /> {t("resource.food")} <strong className="px">{n(game.food)}</strong>
        </li>
        <li>
          <span className="glyph">◈</span> {t("resource.dust")} <strong className="px">{n(game.dust)}</strong>
        </li>
        <li>
          <span className="glyph gold">★</span> {t("resource.starMaterial")} <strong className="px">{n(game.starMaterial)}</strong>
        </li>
      </ul>
      {pack.demo && <p className="small demo-note">{t("app.demo")}</p>}
      <p className="small muted">{t("settings.credits")}</p>
    </Dialog>
  );
}

/** Short sentence for a news item. */
export function useNewsText(): (item: NewsItem) => string {
  const { pack, t, l } = useStore();
  const character = (id: string) => {
    const c = pack.characters.get(id);
    return c ? l(c.name) : id;
  };
  const mapName = (id: string) => {
    const m = pack.maps.get(id);
    return m ? l(m.name) : id;
  };
  return (item) => {
    switch (item.kind) {
      case "recruited":
        return t("news.recruited", { name: character(item.characterId) });
      case "item": {
        const def = pack.items.get(item.itemId);
        return t("news.item", { boss: character(item.bossId), item: def ? l(def.name) : item.itemId, tier: t(`tier.${item.tier}`) });
      }
      case "mapOpened":
        return t("news.mapOpened", { map: mapName(item.mapId) });
      case "bossOpen":
        return t("news.bossOpen", { map: mapName(item.mapId) });
      case "worldComplete": {
        const world = pack.worlds.find((w) => w.id === item.worldId);
        return t("news.worldComplete", { world: world ? l(world.name) : item.worldId });
      }
      case "dungeonWin": {
        const dungeon = pack.sideDungeons.get(item.dungeonId);
        return t("news.dungeonWin", { name: dungeon ? l(dungeon.name) : item.dungeonId, amount: item.amount });
      }
      case "stageLost":
        return t("news.stageLost", { map: mapName(item.mapId), n: item.stageIndex + 1 });
      case "noAttempts":
        return t("dungeon.noAttempts");
    }
  };
}

/** One line of the player's own news; tap for the whole session. */
export function NewsTicker({ inline = false }: { inline?: boolean }) {
  const { t } = useStore();
  const { news, battle } = useAdventure();
  const text = useNewsText();
  const [open, setOpen] = useState(false);
  const fighting = battle !== null && battle.target.kind !== "stage";
  const latest = news[0];
  const line = fighting ? t("news.bossFight") : latest ? text(latest) : t("news.empty");
  return (
    <div className={`ticker${inline ? " inline" : ""}`}>
      <button
        type="button"
        className="ticker-line"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={news.length === 0}
      >
        <span aria-hidden="true">⚑</span> <span className={latest && !fighting ? "fresh" : ""}>{line}</span>
      </button>
      {open && news.length > 0 && (
        <ol className="ticker-list" aria-label={t("news.title")}>
          {news.map((item) => (
            <li key={item.id}>{text(item)}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
