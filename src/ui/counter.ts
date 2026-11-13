import type { Pack } from "../content/loader";
import type { Element } from "../content/schema";
import { elementMultiplier } from "../core/element";
import type { GameState } from "../core/progress";

// Element counter hints for a map. Reads the element chart from the balance config; never computes damage.

export interface CounterLine {
  /** An element found on the map. */
  defender: Element;
  /** Elements that hit it for more than ×1. */
  attackers: Element[];
  /** Roster characters with one of those elements. */
  characterIds: string[];
}

export interface CounterHints {
  strong: CounterLine[];
  /** Team members that one of the map's elements hits for more than ×1. */
  weakInTeam: string[];
}

export function counterHints(pack: Pack, game: GameState, mapElements: readonly Element[]): CounterHints {
  const chart = pack.balance.elementChart;
  const elements = [...new Set(mapElements)];
  const strong = elements.flatMap((defender): CounterLine[] => {
    const attackers = [...new Set(chart.filter((r) => r.defender === defender && r.multiplier > 1).map((r) => r.attacker))];
    if (attackers.length === 0) return [];
    const characterIds = game.roster
      .map((c) => c.characterId)
      .filter((id) => {
        const element = pack.characters.get(id)?.element;
        return element !== undefined && attackers.includes(element);
      });
    return [{ defender, attackers, characterIds }];
  });
  const weakInTeam = game.team.filter((id) => {
    const element = pack.characters.get(id)?.element;
    return element !== undefined && elements.some((attacker) => elementMultiplier(chart, attacker, element) > 1);
  });
  return { strong, weakInTeam };
}

/** Elements of a map: its enemies and its boss. */
export function mapElements(pack: Pack, mapId: string): Element[] {
  const map = pack.maps.get(mapId);
  if (!map) return [];
  const elements: Element[] = [];
  for (const stage of map.stages) {
    for (const { enemyId } of stage.enemies) {
      const element = pack.enemies.get(enemyId)?.element;
      if (element) elements.push(element);
    }
  }
  const boss = pack.characters.get(map.boss.characterId)?.element;
  if (boss) elements.push(boss);
  return [...new Set(elements)];
}
