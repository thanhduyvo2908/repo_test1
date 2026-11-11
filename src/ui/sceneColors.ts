import type { SceneTheme } from "../render/BattleScene";

// Colors for the battle scene, read from the CSS theme so the canvas follows light and dark mode.
// Kept apart from BattleCanvas so screens can use them without loading PixiJS.

/** Reads a CSS color variable as a 0xRRGGBB number. */
function cssColor(name: string, fallback: number): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  return match ? Number.parseInt(match[1]!, 16) : fallback;
}

export function readSceneTheme(): SceneTheme {
  return {
    text: cssColor("--text", 0x1f2328),
    muted: cssColor("--muted", 0x6b7078),
    hpTrack: cssColor("--surface", 0xffffff),
    hp: cssColor("--hp", 0x3f8f4a),
    hpLow: cssColor("--hp-low", 0xc8442b),
    damage: cssColor("--lose", 0xb42318),
    heal: cssColor("--win", 0x2f7d3b),
    status: cssColor("--tier-epic", 0x7a3fb3),
  };
}

export function elementColor(element: string): number {
  return cssColor(`--el-${element}`, 0x888888);
}
