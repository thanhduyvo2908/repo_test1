import type { SceneTheme } from "../render/BattleScene";

// Colors for the battle scene, read from the CSS theme so the canvas matches the page.
// Kept apart from BattleCanvas so screens can use them without loading PixiJS.

/** Reads a CSS color variable as a 0xRRGGBB number. */
function cssColor(name: string, fallback: number): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  return match ? Number.parseInt(match[1]!, 16) : fallback;
}

export function readSceneTheme(): SceneTheme {
  return {
    text: cssColor("--text", 0xeef0f7),
    muted: cssColor("--muted", 0x9aa3c0),
    hpTrack: cssColor("--bar-track", 0x0a0b12),
    hp: cssColor("--hp", 0x4cc46a),
    hpLow: cssColor("--hp-crit", 0xe2453c),
    damage: cssColor("--lose", 0xe2453c),
    heal: cssColor("--win", 0x4cc46a),
    status: cssColor("--el-dark", 0x8a5cd6),
    highlight: cssColor("--gold", 0xf4c245),
  };
}

export function elementColor(element: string): number {
  return cssColor(`--el-${element}`, 0x888888);
}
