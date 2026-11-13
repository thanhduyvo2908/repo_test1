// Where each unit stands in the battle scene. Pure math, no PixiJS, so it can be tested in Node.

export interface LayoutUnit {
  uid: number;
  side: "player" | "enemy";
  kind: "character" | "enemy" | "boss";
}

export interface Slot {
  x: number;
  y: number;
  /** Body size in pixels (width of the shape). */
  size: number;
  /** field: fighting now. bench: waiting in a duel. fallen: defeated. */
  role: "field" | "bench" | "fallen";
}

export interface LayoutState {
  onField: ReadonlySet<number>;
  hp: readonly number[];
}

/** Boss fights field the whole team; duels field one unit per side. */
export function isBossFight(units: readonly LayoutUnit[]): boolean {
  return units.some((u) => u.kind === "boss");
}

/**
 * Lays out a battle in a width × height box. Players stand on the left, enemies on the right.
 * Duel: the fighting unit of each side stands large near the middle; the rest wait small in a
 * row along the bottom of their half. Boss fight: up to five players in a staggered column,
 * the boss large on the right.
 */
export function layoutBattle(
  units: readonly LayoutUnit[],
  state: LayoutState,
  width: number,
  sceneHeight: number,
  /** Space kept free at the bottom, e.g. for a caption box drawn over the scene. */
  bottomInset = 0,
): Map<number, Slot> {
  const slots = new Map<number, Slot>();
  const height = Math.max(1, sceneHeight - bottomInset);
  const unit = Math.min(width / 6, height / 3.2);
  const groundY = height * 0.58;

  for (const side of ["player", "enemy"] as const) {
    const members = units.filter((u) => u.side === side);
    const towardCenter = side === "player" ? 1 : -1;
    const homeX = side === "player" ? width * 0.27 : width * 0.73;
    const benchStartX = side === "player" ? width * 0.06 : width * 0.94;

    if (isBossFight(units)) {
      if (side === "enemy") {
        for (const m of members) {
          slots.set(m.uid, {
            x: homeX,
            y: groundY,
            size: unit * 1.9,
            role: (state.hp[m.uid] ?? 1) > 0 ? "field" : "fallen",
          });
        }
        continue;
      }
      // Staggered column so five members fit in a short scene.
      const rows = Math.max(1, members.length);
      const top = height * 0.18;
      const bottom = height * 0.86;
      const step = rows > 1 ? (bottom - top) / (rows - 1) : 0;
      members.forEach((m, i) => {
        const stagger = i % 2 === 0 ? 0 : unit * 0.55;
        slots.set(m.uid, {
          x: width * 0.12 + stagger + unit * 0.4,
          y: rows > 1 ? top + step * i : groundY,
          size: rows > 3 ? unit * 0.7 : unit * 0.9,
          role: (state.hp[m.uid] ?? 1) > 0 ? "field" : "fallen",
        });
      });
      continue;
    }

    let benchIndex = 0;
    for (const m of members) {
      const fallen = (state.hp[m.uid] ?? 1) <= 0;
      if (state.onField.has(m.uid) && !fallen) {
        slots.set(m.uid, { x: homeX, y: groundY, size: unit * 1.3, role: "field" });
        continue;
      }
      const benchSize = unit * 0.45;
      slots.set(m.uid, {
        x: benchStartX + towardCenter * (benchSize * 1.25) * benchIndex,
        y: height - benchSize * 0.9,
        size: benchSize,
        role: fallen ? "fallen" : "bench",
      });
      benchIndex += 1;
    }
  }
  return slots;
}
