import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// Tabs and the stack of sheets that slide over them. The browser back button closes the top sheet.

export type Tab = "adventure" | "team" | "items";

export type SheetEntry =
  | { kind: "world" }
  | { kind: "map"; mapId: string }
  | { kind: "character"; characterId: string }
  | { kind: "settings" };

interface NavValue {
  tab: Tab;
  /** Switches tab and closes every sheet. */
  setTab: (tab: Tab) => void;
  sheets: SheetEntry[];
  openSheet: (entry: SheetEntry) => void;
  closeSheet: () => void;
  closeAllSheets: () => void;
}

const NavContext = createContext<NavValue | null>(null);

/** History entries pushed for sheets carry the stack depth they open. */
interface SheetHistoryState {
  xidleSheetDepth: number;
}

function depthOf(state: unknown): number {
  const depth = (state as Partial<SheetHistoryState> | null)?.xidleSheetDepth;
  return typeof depth === "number" ? depth : 0;
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>("adventure");
  const [sheets, setSheetsState] = useState<SheetEntry[]>([]);
  // Mirrors the stack so history calls stay outside state updaters (StrictMode runs those twice).
  const stack = useRef<SheetEntry[]>([]);
  const setSheets = useCallback((next: SheetEntry[]) => {
    stack.current = next;
    setSheetsState(next);
  }, []);

  // Back (browser or ✕) lands on an entry whose depth tells how many sheets stay open.
  useEffect(() => {
    const onPop = (event: PopStateEvent) => setSheets(stack.current.slice(0, depthOf(event.state)));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setSheets]);

  const openSheet = useCallback(
    (entry: SheetEntry) => {
      const next = [...stack.current, entry];
      setSheets(next);
      window.history.pushState({ xidleSheetDepth: next.length } satisfies SheetHistoryState, "");
    },
    [setSheets],
  );

  const closeSheet = useCallback(() => {
    if (depthOf(window.history.state) > 0) window.history.back();
    else setSheets(stack.current.slice(0, -1));
  }, [setSheets]);

  const closeAllSheets = useCallback(() => {
    const depth = depthOf(window.history.state);
    if (depth > 0) window.history.go(-depth);
    setSheets([]);
  }, [setSheets]);

  const setTab = useCallback(
    (next: Tab) => {
      closeAllSheets();
      setTabState(next);
      window.scrollTo({ top: 0 });
    },
    [closeAllSheets],
  );

  const value = useMemo<NavValue>(
    () => ({ tab, setTab, sheets, openSheet, closeSheet, closeAllSheets }),
    [tab, setTab, sheets, openSheet, closeSheet, closeAllSheets],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavValue {
  const value = useContext(NavContext);
  if (!value) throw new Error("useNav must be used inside NavProvider");
  return value;
}

export type Layout = "phone" | "tablet" | "desktop";

const TABLET = "(min-width: 720px)";
const DESKTOP = "(min-width: 1100px)";

function currentLayout(): Layout {
  if (window.matchMedia(DESKTOP).matches) return "desktop";
  if (window.matchMedia(TABLET).matches) return "tablet";
  return "phone";
}

/** phone below 720px, tablet from 720px, desktop from 1100px. */
export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(currentLayout);
  useEffect(() => {
    const queries = [window.matchMedia(TABLET), window.matchMedia(DESKTOP)];
    const update = () => setLayout(currentLayout());
    queries.forEach((q) => q.addEventListener("change", update));
    return () => queries.forEach((q) => q.removeEventListener("change", update));
  }, []);
  return layout;
}
