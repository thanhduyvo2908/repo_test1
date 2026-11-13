import type { Lang } from "../i18n";

// Number formatting for the UI. Grouping and decimal marks follow the language.

function locale(lang: Lang): string {
  return lang === "vi" ? "vi-VN" : "en-US";
}

/** Full number with digit grouping: 161,190 (en) or 161.190 (vi). */
export function fullNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(locale(lang)).format(value);
}

/**
 * Short number for tight spots: below 10,000 the full number, then K and M in both languages.
 * Rounds down so the bar never shows more than the player has: 161,190 → 161K, 1,250,000 → 1.2M.
 */
export function shortNumber(value: number, lang: Lang): string {
  const abs = Math.abs(value);
  if (abs < 10_000) return fullNumber(value, lang);
  const [divisor, suffix] = abs >= 1_000_000 ? [1_000_000, "M"] : [1_000, "K"];
  const scaled = abs / divisor;
  const digits = scaled < 10 ? 1 : 0;
  const factor = 10 ** digits;
  const rounded = Math.floor(scaled * factor) / factor;
  const text = new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(rounded);
  return `${value < 0 ? "-" : ""}${text}${suffix}`;
}
