import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { localize, translate, type Lang, type LocalizedText, type StringKey, type TemplateParams } from "../i18n";
import { loadSave, writeSave, type SaveStorage } from "../save";

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, params?: TemplateParams) => string;
  l: (text: LocalizedText) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ storage, children }: { storage: SaveStorage; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => loadSave(storage).settings.lang);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      const save = loadSave(storage);
      writeSave(storage, { ...save, settings: { ...save.settings, lang: next } });
    },
    [storage],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, params) => translate(lang, key, params),
      l: (text) => localize(text, lang),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
