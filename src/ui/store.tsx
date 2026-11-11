import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Pack } from "../content/loader";
import { createNewGame, sanitizeGameState, type GameState } from "../core/progress";
import { localize, translate, type Lang, type LocalizedText, type StringKey, type TemplateParams } from "../i18n";
import { loadSave, writeSave, type SaveData, type SaveStorage } from "../save";

interface StoreValue {
  pack: Pack;
  save: SaveData;
  game: GameState;
  /** Applies a change to the game state and writes the save. */
  updateGame: (change: (game: GameState) => GameState) => GameState;
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, params?: TemplateParams) => string;
  l: (text: LocalizedText) => string;
}

const StoreContext = createContext<StoreValue | null>(null);

/** A fresh save seed. Randomness is fine here: the UI picks seeds, the core only consumes them. */
function freshSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

function initialSave(storage: SaveStorage, pack: Pack): SaveData {
  const save = loadSave(storage);
  const game = save.game ? sanitizeGameState(save.game, pack) : createNewGame(pack, freshSeed());
  const ready = { ...save, game };
  writeSave(storage, ready);
  return ready;
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
  const [save, setSave] = useState<SaveData>(() => initialSave(storage, pack));
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
      const game = change(current.game ?? createNewGame(pack, freshSeed()));
      commit({ ...current, game });
      return game;
    },
    [commit, pack],
  );

  const setLang = useCallback(
    (lang: Lang) => {
      const current = latest.current;
      commit({ ...current, settings: { ...current.settings, lang } });
    },
    [commit],
  );

  const value = useMemo<StoreValue>(() => {
    const lang = save.settings.lang;
    return {
      pack,
      save,
      game: save.game ?? createNewGame(pack, 0),
      updateGame,
      lang,
      setLang,
      t: (key, params) => translate(lang, key, params),
      l: (text) => localize(text, lang),
    };
  }, [pack, save, updateGame, setLang]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
