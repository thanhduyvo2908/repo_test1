import { en, type StringKey } from "./strings/en";
import { vi } from "./strings/vi";

export type { StringKey } from "./strings/en";

export const LANGUAGES = ["en", "vi"] as const;
export type Lang = (typeof LANGUAGES)[number];
export const DEFAULT_LANG: Lang = "en";

/** Text that lives in a content pack. English is required, Vietnamese is optional. */
export interface LocalizedText {
  en: string;
  vi?: string;
}

export type TemplateParams = Record<string, string | number>;

const tables: Record<Lang, Partial<Record<StringKey, string>>> = { en, vi };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/** Replaces {name} placeholders. Unknown placeholders are left as they are. */
export function format(template: string, params?: TemplateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Looks up a UI string, falling back to English when the translation is missing. */
export function translate(lang: Lang, key: StringKey, params?: TemplateParams): string {
  const template = tables[lang][key] ?? en[key];
  return format(template, params);
}

/** Picks the content-pack text for a language, falling back to English. */
export function localize(text: LocalizedText, lang: Lang): string {
  if (lang === "vi" && text.vi) return text.vi;
  return text.en;
}

/** Placeholder names used in a template, sorted. Exported for tests. */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
}

export const stringTables = tables;
