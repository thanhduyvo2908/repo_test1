import { dungeonAttemptsLeft } from "../core/dungeons";
import { AdventureProvider } from "./adventure";
import { NavProvider, useLayout, useNav, type SheetEntry, type Tab } from "./nav";
import { AdventureScreen, FoundHere, MapCard, ScenePanel } from "./screens/AdventureScreen";
import { CharacterSheet } from "./screens/CharacterSheet";
import { ItemsScreen } from "./screens/ItemsScreen";
import { MapInfoSheet } from "./screens/MapInfoSheet";
import { NewsTicker, OfflineDialog, SettingsDialog } from "./screens/Overlays";
import { ResultDialog } from "./screens/ResultDialog";
import { TeamScreen } from "./screens/TeamScreen";
import { WorldSheet } from "./screens/WorldSheet";
import { todayKey, useStore } from "./store";

export function App() {
  return (
    <AdventureProvider>
      <NavProvider>
        <Shell />
      </NavProvider>
    </AdventureProvider>
  );
}

/**
 * Phone (< 720px): top bar, news line, tab content, bottom tab bar.
 * Tablet (720–1099px): a sidebar replaces the bottom bar.
 * Desktop (≥ 1100px): three columns; the right one shows what is on the map, or a small copy of
 * the battle when another tab is open, so the idle fight stays in sight.
 */
function Shell() {
  const { lang } = useStore();
  const { tab, sheets, closeSheet } = useNav();
  const layout = useLayout();
  const top = sheets[sheets.length - 1];
  return (
    <div className={`app layout-${layout}`} lang={lang}>
      <TopBar wide={layout === "desktop"} />
      {layout !== "desktop" && <NewsTicker />}
      <div className="body">
        {layout !== "phone" && <Sidebar />}
        <main className="content">
          {tab === "adventure" && <AdventureScreen layout={layout} />}
          {tab === "team" && <TeamScreen />}
          {tab === "items" && <ItemsScreen />}
        </main>
        {layout === "desktop" && (
          <aside className="right-col">
            {tab === "adventure" ? (
              <FoundHere withBossButton />
            ) : (
              <>
                <ScenePanel compact />
                <MapCard />
              </>
            )}
          </aside>
        )}
      </div>
      {layout === "phone" && <BottomNav />}
      {sheets.map((entry, i) => (
        <SheetView key={i} entry={entry} onClose={closeSheet} hidden={entry !== top} />
      ))}
      <ResultDialog />
      <OfflineDialog />
    </div>
  );
}

function SheetView({ entry, onClose, hidden }: { entry: SheetEntry; onClose: () => void; hidden: boolean }) {
  // Lower sheets stay mounted (scroll position kept) but only the top one shows.
  return (
    <div className="sheet-slot" hidden={hidden}>
      {entry.kind === "world" && <WorldSheet onClose={onClose} />}
      {entry.kind === "map" && <MapInfoSheet mapId={entry.mapId} onClose={onClose} />}
      {entry.kind === "character" && <CharacterSheet characterId={entry.characterId} onClose={onClose} />}
      {entry.kind === "settings" && <SettingsDialog onClose={onClose} />}
    </div>
  );
}

function TopBar({ wide }: { wide: boolean }) {
  const { game, lang, setLang, t, n, ns } = useStore();
  const { openSheet } = useNav();
  const amount = wide ? n : ns;
  return (
    <header className="topbar">
      <span className="logo px">{t("app.title").toUpperCase()}</span>
      {wide && <NewsTicker inline />}
      <span className="res px" title={t("resource.gold")}>
        <i className="coin" aria-hidden="true" />
        <span className="visually-hidden">{t("resource.gold")}</span>
        {amount(game.gold)}
      </span>
      <span className="res px" title={t("resource.food")}>
        <i className="food" aria-hidden="true" />
        <span className="visually-hidden">{t("resource.food")}</span>
        {amount(game.food)}
      </span>
      {wide && (
        <>
          <span className="res px" title={t("resource.dust")}>
            <span aria-hidden="true">◈</span>
            <span className="visually-hidden">{t("resource.dust")}</span> {n(game.dust)}
          </span>
          <span className="res px" title={t("resource.starMaterial")}>
            <span className="gold" aria-hidden="true">
              ★
            </span>
            <span className="visually-hidden">{t("resource.starMaterial")}</span> {n(game.starMaterial)}
          </span>
          <button
            type="button"
            className="iconbtn px"
            onClick={() => setLang(lang === "en" ? "vi" : "en")}
            aria-label={t("settings.language")}
          >
            {lang.toUpperCase()}
          </button>
        </>
      )}
      <button type="button" className="iconbtn" onClick={() => openSheet({ kind: "settings" })} aria-label={t("settings.title")}>
        ⚙
      </button>
    </header>
  );
}

interface NavItem {
  key: Tab | "world";
  icon: string;
}

const NAV: NavItem[] = [
  { key: "adventure", icon: "⚔" },
  { key: "world", icon: "⚑" },
  { key: "team", icon: "☺" },
  { key: "items", icon: "◈" },
];

function useNavItems() {
  const { pack, game, t } = useStore();
  const { tab, setTab, sheets, openSheet } = useNav();
  const worldOpen = sheets.some((s) => s.kind === "world" || s.kind === "map");
  const attempts = pack.sideDungeons.size > 0 ? dungeonAttemptsLeft(game, pack, todayKey()) : 0;
  return NAV.map((item) => {
    const active = item.key === "world" ? worldOpen : !worldOpen && tab === item.key;
    return {
      ...item,
      active,
      label: t(`nav.${item.key}`),
      badge: item.key === "world" && attempts > 0 ? attempts : null,
      onClick: () => {
        if (item.key === "world") {
          if (!worldOpen) openSheet({ kind: "world" });
        } else {
          setTab(item.key);
        }
      },
    };
  });
}

function BottomNav() {
  const items = useNavItems();
  return (
    <nav className="bottomnav">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`${item.active ? "on" : ""} nav-${item.key}`}
          aria-current={item.active ? "page" : undefined}
          onClick={item.onClick}
        >
          <span className="ico" aria-hidden="true">
            {item.icon}
          </span>
          <span className="px">{item.label}</span>
          {item.badge !== null && <span className="badge px">{item.badge}</span>}
        </button>
      ))}
    </nav>
  );
}

function Sidebar() {
  const items = useNavItems();
  const { pack, t } = useStore();
  return (
    <aside className="sidebar">
      <MapCard showProgress />
      <nav className="side-nav">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`navitem px${item.active ? " on" : ""}`}
            aria-current={item.active ? "page" : undefined}
            onClick={item.onClick}
          >
            <span aria-hidden="true">{item.icon}</span> {item.label}
            {item.badge !== null && <span className="badge px">{item.badge}</span>}
          </button>
        ))}
      </nav>
      {pack.demo && <p className="small demo-note">{t("app.demoShort")}</p>}
    </aside>
  );
}
