import type { Pack } from "../content/loader";
import { fail, findOwned, ok, type ActionResult, type GameState } from "./progress";

// Items: equip, decompose into dust, trade dust for a legendary item.

/** Equips an item (or unequips with null). An item moves off whoever wore it before. */
export function equipItem(state: GameState, characterId: string, itemUid: number | null): ActionResult {
  if (!findOwned(state, characterId)) return fail("unknownCharacter");
  if (itemUid !== null && !state.items.some((i) => i.uid === itemUid)) return fail("unknownItem");
  return ok({
    ...state,
    roster: state.roster.map((c) => {
      if (c.characterId === characterId) return { ...c, itemUid };
      if (itemUid !== null && c.itemUid === itemUid) return { ...c, itemUid: null };
      return c;
    }),
  });
}

/** Who wears an item, if anyone. */
export function wearerOf(state: GameState, itemUid: number): string | null {
  return state.roster.find((c) => c.itemUid === itemUid)?.characterId ?? null;
}

/** Breaks an item into dust by its tier. Equipped items come off first. */
export function decomposeItem(state: GameState, pack: Pack, itemUid: number): ActionResult {
  const item = state.items.find((i) => i.uid === itemUid);
  if (!item) return fail("unknownItem");
  return ok({
    ...state,
    items: state.items.filter((i) => i.uid !== itemUid),
    roster: state.roster.map((c) => (c.itemUid === itemUid ? { ...c, itemUid: null } : c)),
    dust: state.dust + pack.balance.drops.dustPerTier[item.tier],
  });
}

/** Items that can be bought with dust: any item a boss drops (the starter's item never drops). */
export function exchangeableItems(pack: Pack): string[] {
  const ids = new Set<string>();
  for (const map of pack.maps.values()) if (map.boss.dropItemId) ids.add(map.boss.dropItemId);
  return [...ids];
}

/** Trades dust for a legendary copy of an item the player picks. */
export function exchangeDust(state: GameState, pack: Pack, itemId: string): ActionResult {
  if (!exchangeableItems(pack).includes(itemId)) return fail("notExchangeable");
  const cost = pack.balance.drops.dustForLegendary;
  if (state.dust < cost) return fail("notEnoughDust");
  return ok({
    ...state,
    dust: state.dust - cost,
    items: [...state.items, { uid: state.nextItemUid, itemId, tier: "legendary" }],
    nextItemUid: state.nextItemUid + 1,
  });
}
