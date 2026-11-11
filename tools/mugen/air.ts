// Parser for MUGEN .air animation files.
import { parseIni } from './ini';

export interface AirFrame {
  group: number;
  image: number;
  x: number;
  y: number;
  /** Duration in ticks (60 per second); -1 means "hold forever". */
  time: number;
  flipH: boolean;
  flipV: boolean;
}

export interface AirAction {
  id: number;
  frames: AirFrame[];
  /** Index of the frame the animation loops back to. */
  loopStart: number;
}

export function parseAir(text: string): Map<number, AirAction> {
  const actions = new Map<number, AirAction>();
  for (const section of parseIni(text)) {
    const m = /^begin\s+action\s+(-?\d+)/i.exec(section.name);
    if (!m) continue;
    const action: AirAction = { id: Number(m[1]), frames: [], loopStart: 0 };
    for (const line of section.lines) {
      const raw = line.raw.trim();
      if (/^loopstart/i.test(raw)) {
        action.loopStart = action.frames.length;
        continue;
      }
      if (/^(clsn|interpolate)/i.test(raw)) continue;
      const parts = raw.split(',').map((p) => p.trim());
      if (parts.length < 5) continue;
      const [group, image, x, y, time] = parts.slice(0, 5).map((p) => Number.parseInt(p, 10));
      if (group === undefined || image === undefined || x === undefined || y === undefined || time === undefined) continue;
      if ([group, image, x, y, time].some((n) => Number.isNaN(n))) continue;
      const flip = (parts[5] ?? '').toUpperCase();
      action.frames.push({ group, image, x, y, time, flipH: flip.includes('H'), flipV: flip.includes('V') });
    }
    if (action.loopStart >= action.frames.length) action.loopStart = 0;
    actions.set(action.id, action);
  }
  return actions;
}

export function totalTicks(action: AirAction): number {
  return action.frames.reduce((sum, f) => sum + (f.time < 0 ? 0 : f.time), 0);
}
