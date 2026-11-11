import { soldierKit, text, type EnemyInput } from "./kit";

// World 1 soldier types (docs/world-1.md). Stats and elements are proposals (Đề xuất): soldiers take
// the element of the boss of the map where they mostly appear.

function soldier(
  id: string,
  en: string,
  vi: string,
  element: EnemyInput["element"],
  damageType: EnemyInput["damageType"],
  baseStats: EnemyInput["baseStats"],
): EnemyInput {
  return {
    id,
    name: text(en, vi),
    element,
    damageType,
    baseStats,
    ...soldierKit(id, damageType === "physical" ? "atk" : "spa"),
  };
}

export const enemies: EnemyInput[] = [
  soldier("alvida-pirate", "Alvida Pirate", "Hải tặc Alvida", "water", "physical",
    { hp: 55, atk: 60, def: 50, spa: 30, spd: 40, spe: 50 }),
  soldier("marine-soldier", "Marine Soldier", "Lính hải quân", "metal", "physical",
    { hp: 55, atk: 60, def: 55, spa: 30, spd: 45, spe: 50 }),
  soldier("marine-officer", "Marine Officer", "Sĩ quan hải quân", "metal", "physical",
    { hp: 65, atk: 70, def: 60, spa: 35, spd: 50, spe: 55 }),
  soldier("buggy-pirate", "Buggy Pirate", "Hải tặc Buggy", "fire", "physical",
    { hp: 55, atk: 65, def: 50, spa: 30, spd: 40, spe: 55 }),
  soldier("circus-performer", "Circus Performer", "Nghệ sĩ xiếc", "fire", "magic",
    { hp: 50, atk: 35, def: 45, spa: 70, spd: 55, spe: 65 }),
  soldier("black-cat-scout", "Black Cat Scout", "Thám báo Mèo Đen", "wood", "physical",
    { hp: 50, atk: 60, def: 45, spa: 30, spd: 45, spe: 70 }),
  soldier("black-cat-pirate", "Black Cat Pirate", "Hải tặc Mèo Đen", "wood", "physical",
    { hp: 60, atk: 70, def: 55, spa: 30, spd: 45, spe: 60 }),
  soldier("baratie-cook", "Baratie Cook", "Đầu bếp Baratie", "fire", "physical",
    { hp: 60, atk: 70, def: 55, spa: 35, spd: 50, spe: 55 }),
  soldier("krieg-pirate", "Krieg Pirate", "Hải tặc Krieg", "metal", "physical",
    { hp: 65, atk: 75, def: 60, spa: 35, spd: 50, spe: 55 }),
];
