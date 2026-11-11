import type { PackInput } from "../../src/content/schema";
import { text } from "./kit";

// World 1 items: only the Straw Hat members for now (decided 2026-11-11). Effects are proposals
// following the CLAUDE.md pattern: more damage for skills of the owner's element and damage type.

type ItemInput = PackInput["items"][number];

const TIERS = { common: 0.05, rare: 0.1, epic: 0.2, legendary: 0.3 };

function item(
  id: string,
  ownerId: string,
  name: { en: string; vi: string },
  element: ItemInput["effect"]["condition"]["element"],
  damageType: ItemInput["effect"]["condition"]["damageType"],
  description: { en: string; vi: string },
): ItemInput {
  return {
    id,
    name,
    description,
    ownerId,
    effect: { kind: "damageBonus", condition: { element, damageType }, valueByTier: TIERS },
  };
}

export const items: ItemInput[] = [
  item("straw-hat", "luffy", text("Straw Hat", "Mũ rơm"), "earth", "physical",
    text("Raises physical damage of Earth skills.", "Tăng sát thương vật lý của skill hệ Thổ.")),
  item("wado-ichimonji", "zoro", text("Wado Ichimonji", "Wado Ichimonji"), "metal", "physical",
    text("Raises physical damage of Metal skills.", "Tăng sát thương vật lý của skill hệ Kim.")),
  item("nami-staff", "nami", text("Nami's Staff", "Gậy của Nami"), "water", "magic",
    text("Raises magic damage of Water skills.", "Tăng sát thương phép của skill hệ Thủy.")),
  item("slingshot", "usopp", text("Slingshot", "Ná cao su"), "wood", "magic",
    text("Raises magic damage of Wood skills.", "Tăng sát thương phép của skill hệ Mộc.")),
  item("chef-shoes", "sanji", text("Chef's Shoes", "Giày đầu bếp"), "fire", "physical",
    text("Raises physical damage of Fire skills.", "Tăng sát thương vật lý của skill hệ Hỏa.")),
];
