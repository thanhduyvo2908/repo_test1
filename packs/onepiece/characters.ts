import { placeholderKit, text, type CharacterInput, type StatsInput } from "./kit";

// World 1 characters. Elements were approved by the user on 2026-11-11 (docs/world-1.md).
// Base stats, damage types and every kit except Luffy's are proposals (Đề xuất) until approved.

const PENDING_PASSIVE = {
  name: text("Passive (pending)", "Nội tại (chờ thiết kế)"),
  description: text("No effect yet.", "Chưa có hiệu ứng."),
  effects: [],
};

interface Draft {
  id: string;
  name: string;
  element: CharacterInput["element"];
  damageType: CharacterInput["damageType"];
  baseStats: StatsInput;
  itemId?: string;
}

/** A character whose skills and passive are still placeholders. */
function pending(d: Draft): CharacterInput {
  return {
    id: d.id,
    name: text(d.name, d.name),
    element: d.element,
    damageType: d.damageType,
    baseStats: d.baseStats,
    passive: { id: `${d.id}-passive`, ...PENDING_PASSIVE },
    ...placeholderKit(d.id, d.damageType === "physical" ? "atk" : "spa"),
    ...(d.itemId ? { itemId: d.itemId } : {}),
  };
}

// Luffy: the proposed kit from docs/characters/luffy.md, field for field.
const pistol = (power: number, lifesteal: number, extra: CharacterInput["skills"][number]["effects"] = []) => ({
  id: power === 80 ? "luffy-pistol" : "luffy-pistol-star2",
  name: text("Gum-Gum Pistol", "Gomu Gomu Pistol"),
  description:
    power === 80
      ? text(
          "Stretches an arm for a long-range punch. Restores HP equal to 30% of the damage dealt.",
          "Vươn tay đấm từ xa. Hồi HP bằng 30% sát thương gây ra.",
        )
      : text(
          "Stretches an arm for a long-range punch. Restores HP equal to 40% of the damage dealt. 20% chance to lower the target's Defense by 1 stage for 2 turns.",
          "Vươn tay đấm từ xa. Hồi HP bằng 40% sát thương gây ra. 20% giảm 1 bậc Thủ vật lý của mục tiêu trong 2 lượt.",
        ),
  power,
  scaling: [{ stat: "atk" as const, weight: 1 }],
  target: "enemy" as const,
  usage: { kind: "cooldown" as const, rounds: 2 },
  effects: [{ kind: "lifesteal" as const, ratio: lifesteal }, ...extra],
});

const bazooka = (stunChance: number) => ({
  id: stunChance === 0.3 ? "luffy-bazooka" : "luffy-bazooka-star2",
  name: text("Gum-Gum Bazooka", "Gomu Gomu Bazooka"),
  description: text(
    `A two-handed palm strike. ${stunChance * 100}% chance to stun the target for 1 turn.`,
    `Hai tay đẩy mạnh. ${stunChance * 100}% làm choáng mục tiêu 1 lượt.`,
  ),
  power: 150,
  scaling: [{ stat: "atk" as const, weight: 1 }],
  target: "enemy" as const,
  usage: { kind: "oncePerBattle" as const },
  effects: [
    { kind: "status" as const, target: "targets" as const, chance: stunChance, duration: 1, status: { kind: "stun" as const } },
  ],
});

const luffy: CharacterInput = {
  id: "luffy",
  name: text("Luffy", "Luffy"),
  element: "earth",
  damageType: "physical",
  baseStats: { hp: 90, atk: 100, def: 75, spa: 40, spd: 70, spe: 85 },
  passive: {
    id: "luffy-rubber-body",
    name: text("Rubber Body", "Thân cao su"),
    description: text(
      "Takes 20% less physical damage. The first time HP drops below 50% in a battle, restores 20% of max HP.",
      "Nhận ít hơn 20% sát thương vật lý. Lần đầu HP xuống dưới 50% trong một trận, hồi 20% HP tối đa.",
    ),
    effects: [
      {
        trigger: "battleStart",
        effect: {
          kind: "status",
          target: "self",
          chance: 1,
          duration: null,
          status: { kind: "damageReduction", damageType: "physical", ratio: 0.2 },
        },
      },
      {
        trigger: "hpBelow",
        threshold: 0.5,
        effect: { kind: "heal", target: "self", amount: { stat: "hp", ratio: 0.2, of: "caster" } },
      },
    ],
  },
  basicAttack: {
    id: "luffy-punch",
    name: text("Punch", "Đấm"),
    description: text("A basic punch.", "Cú đấm thường."),
    power: 40,
    scaling: [{ stat: "atk", weight: 1 }],
    target: "enemy",
    usage: { kind: "basic" },
  },
  skills: [
    pistol(80, 0.3),
    {
      id: "luffy-balloon",
      name: text("Gum-Gum Balloon", "Gomu Gomu Fusen"),
      description: text(
        "Inflates into a balloon: gains a shield worth 25% of max HP and taunts all enemies for 2 turns.",
        "Phồng thân thành bóng: nhận khiên bằng 25% HP tối đa và khiêu khích mọi địch trong 2 lượt.",
      ),
      power: 0,
      scaling: [{ stat: "hp", weight: 1 }],
      target: "self",
      usage: { kind: "cooldown", rounds: 4 },
      effects: [
        {
          kind: "status",
          target: "self",
          chance: 1,
          duration: 2,
          status: { kind: "shield", amount: { stat: "hp", ratio: 0.25, of: "caster" } },
        },
        { kind: "status", target: "self", chance: 1, duration: 2, status: { kind: "taunt" } },
      ],
    },
    bazooka(0.3),
    {
      id: "luffy-s4",
      name: text("Skill 4", "Skill 4"),
      description: text("Belongs to a later world.", "Thuộc World sau."),
      power: 150,
      scaling: [{ stat: "atk", weight: 1 }],
      target: "enemy",
      usage: { kind: "oncePerBattle" },
    },
  ],
  itemId: "straw-hat",
  stars: [
    {
      // 2★: defeat Don Krieg (map 12).
      requiresBossOf: "krieg-galleon",
      baseStatBonus: { hp: 5, atk: 5, def: 5 },
      skillOverrides: [
        {
          slot: 0,
          skill: pistol(90, 0.4, [
            {
              kind: "status",
              target: "targets",
              chance: 0.2,
              duration: 2,
              status: { kind: "statStage", stat: "def", stages: -1 },
            },
          ]),
        },
        { slot: 2, skill: bazooka(0.5) },
      ],
      // Raises the below-50% heal from 20% to 30%: both heals fire at the same moment.
      passiveEffects: [
        {
          trigger: "hpBelow",
          threshold: 0.5,
          effect: { kind: "heal", target: "self", amount: { stat: "hp", ratio: 0.1, of: "caster" } },
        },
      ],
    },
  ],
};

export const characters: CharacterInput[] = [
  luffy,
  pending({ id: "alvida", name: "Alvida", element: "water", damageType: "physical",
    baseStats: { hp: 85, atk: 85, def: 80, spa: 30, spd: 60, spe: 50 } }),
  pending({ id: "zoro", name: "Zoro", element: "metal", damageType: "physical", itemId: "wado-ichimonji",
    baseStats: { hp: 80, atk: 115, def: 80, spa: 30, spd: 60, spe: 85 } }),
  pending({ id: "morgan", name: "Morgan", element: "metal", damageType: "physical",
    baseStats: { hp: 95, atk: 100, def: 90, spa: 25, spd: 55, spe: 45 } }),
  pending({ id: "nami", name: "Nami", element: "water", damageType: "magic", itemId: "nami-staff",
    baseStats: { hp: 70, atk: 50, def: 60, spa: 100, spd: 85, spe: 100 } }),
  pending({ id: "cabaji", name: "Cabaji", element: "fire", damageType: "physical",
    baseStats: { hp: 70, atk: 95, def: 65, spa: 50, spd: 55, spe: 90 } }),
  pending({ id: "buggy", name: "Buggy", element: "fire", damageType: "magic",
    baseStats: { hp: 85, atk: 60, def: 70, spa: 100, spd: 70, spe: 70 } }),
  pending({ id: "usopp", name: "Usopp", element: "wood", damageType: "magic", itemId: "slingshot",
    baseStats: { hp: 70, atk: 55, def: 60, spa: 105, spd: 70, spe: 90 } }),
  pending({ id: "jango", name: "Jango", element: "wood", damageType: "magic",
    baseStats: { hp: 75, atk: 70, def: 65, spa: 95, spd: 70, spe: 85 } }),
  pending({ id: "kuro", name: "Kuro", element: "dark", damageType: "physical",
    baseStats: { hp: 75, atk: 110, def: 70, spa: 40, spd: 65, spe: 120 } }),
  pending({ id: "sanji", name: "Sanji", element: "fire", damageType: "physical", itemId: "chef-shoes",
    baseStats: { hp: 80, atk: 110, def: 75, spa: 40, spd: 65, spe: 100 } }),
  pending({ id: "gin", name: "Gin", element: "earth", damageType: "physical",
    baseStats: { hp: 90, atk: 105, def: 85, spa: 30, spd: 70, spe: 80 } }),
  pending({ id: "don-krieg", name: "Don Krieg", element: "metal", damageType: "physical",
    baseStats: { hp: 110, atk: 105, def: 110, spa: 60, spd: 80, spe: 50 } }),
];
