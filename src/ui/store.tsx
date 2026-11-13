import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Pack } from "../content/loader";
import { claimOfflineReward, markSeen, type OfflineReward } from "../core/offline";
import {
  createDemoGame,
  createNewGame,
  sanitizeGameState,
  type ActionError,
  type ActionResult,
  type GameState,
} from "../core/progress";
import { localize, translate, type Lang, type LocalizedText, type StringKey, type TemplateParams } from "../i18n";
import { loadSave, writeSave, type SaveData, type SaveStorage } from "../save";
import { fullNumber, shortNumber } from "./format";

interface StoreValue {
  pack: Pack;
  save: SaveData;
  game: GameState;
  /** Applies a change to the game state and writes the save. */
  updateGame: (change: (game: GameState) => GameState) => GameState;
  /** Runs a core action; on failure leaves the state alone and returns the reason. */
  runAction: (action: (game: GameState) => ActionResult) => ActionError | null;
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** After a stage win, move on to the next stage instead of repeating. */
  autoAdvance: boolean;
  setAutoAdvance: (on: boolean) => void;
  t: (key: StringKey, params?: TemplateParams) => string;
  l: (text: LocalizedText) => string;
  /** Formats a number with the active language's digit grouping. */
  n: (value: number) => string;
  /** Short number with K and M, for tight spots. */
  ns: (value: number) => string;
  /** Offline reward collected on load, waiting to be shown. */
  offlineReward: OfflineReward | null;
  dismissOfflineReward: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

/** How often the "last seen" time is saved while the game is open. */
const SEEN_INTERVAL_MS = 30_000;

/** A fresh save seed. Randomness is fine here: the UI picks seeds, the core only consumes them. */
function freshSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

/** A new game: the demo build starts with every character. */
function startGame(pack: Pack, seed: number): GameState {
  return pack.demo ? createDemoGame(pack, seed) : createNewGame(pack, seed);
}

/** Today's calendar day in the player's time zone, used for daily side dungeon limits. */
export function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function initialSave(storage: SaveStorage, pack: Pack): { save: SaveData; offline: OfflineReward | null } {
  const save = loadSave(storage);
  const game = save.game ? sanitizeGameState(save.game, pack) : startGame(pack, freshSeed());
  const claimed = claimOfflineReward(game, pack, Date.now());
  const ready = { ...save, game: claimed.state };
  writeSave(storage, ready);
  return { save: ready, offline: claimed.reward.battles > 0 ? claimed.reward : null };
}

export function StoreProvider({
  pack,
  storage,
  children,
}: {
  pack: Pack;
  storage: SaveStorage;
  children: ReactNode;
}) {
  const [initial] = useState(() => initialSave(storage, pack));
  const [save, setSave] = useState<SaveData>(initial.save);
  const [offlineReward, setOfflineReward] = useState<OfflineReward | null>(initial.offline);
  // Mirrors the latest save so several updates in one tick build on each other.
  const latest = useRef(save);

  const commit = useCallback(
    (next: SaveData) => {
      latest.current = next;
      writeSave(storage, next);
      setSave(next);
    },
    [storage],
  );

  const updateGame = useCallback(
    (change: (game: GameState) => GameState) => {
      const current = latest.current;
      const game = change(current.game ?? startGame(pack, freshSeed()));
      commit({ ...current, game });
      return game;
    },
    [commit, pack],
  );

  const runAction = useCallback(
    (action: (game: GameState) => ActionResult): ActionError | null => {
      const current = latest.current.game;
      if (!current) return null;
      const result = action(current);
      if (!result.ok) return result.reason;
      updateGame(() => result.state);
      return null;
    },
    [updateGame],
  );

  const setLang = useCallback(
    (lang: Lang) => {
      const current = latest.current;
      commit({ ...current, settings: { ...current.settings, lang } });
    },
    [commit],
  );

  const setAutoAdvance = useCallback(
    (autoAdvance: boolean) => {
      const current = latest.current;
      commit({ ...current, settings: { ...current.settings, autoAdvance } });
    },
    [commit],
  );

  // Keep "last seen" fresh so offline rewards start from when the player actually left.
  useEffect(() => {
    const touch = () => updateGame((game) => markSeen(game, Date.now()));
    const timer = setInterval(touch, SEEN_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") touch();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", touch);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", touch);
    };
  }, [updateGame]);

  const value = useMemo<StoreValue>(() => {
    const lang = save.settings.lang;
    return {
      n: (value) => fullNumber(value, lang),
      ns: (value) => shortNumber(value, lang),
      pack,
      save,
      game: save.game ?? startGame(pack, 0),
      updateGame,
      runAction,
      lang,
      setLang,
      autoAdvance: save.settings.autoAdvance,
      setAutoAdvance,
      t: (key, params) => translate(lang, key, params),
      l: (text) => localize(text, lang),
      offlineReward,
      dismissOfflineReward: () => setOfflineReward(null),
    };
  }, [pack, save, updateGame, runAction, setLang, setAutoAdvance, offlineReward]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}

/** Translation key for an action error. */
export function errorKey(reason: ActionError): StringKey {
  switch (reason) {
    case "levelCap":
    case "notEnoughGold":
    case "notEnoughFood":
    case "notEnoughDust":
    case "notEnoughMaterial":
    case "milestoneLocked":
      return `error.${reason}`;
    default:
      return "error.generic";
  }
}
