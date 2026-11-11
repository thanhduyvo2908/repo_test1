import type { PackInput } from "../../src/content/schema";
import { text } from "./kit";
import { bossFor } from "./worlds";

// Side dungeons (proposal in docs/world-1.md): stronger versions of each arc's final boss, opened
// once that boss falls. They pay star stones. Mihawk can join once his sprite is in.

type DungeonInput = PackInput["sideDungeons"] extends (infer T)[] | undefined ? T : never;

function trial(
  id: string,
  name: { en: string; vi: string },
  afterMapId: string,
  characterId: string,
  level: number,
  starMaterial: number,
): DungeonInput {
  const { characterId: bossId, level: bossLevel, baseStats, basicAttack, skills } = bossFor(
    characterId,
    level,
    6,
    1.2,
  );
  return {
    id,
    name,
    unlockAfterMapId: afterMapId,
    boss: { characterId: bossId, level: bossLevel, baseStats, basicAttack, skills },
    rewards: { starMaterial },
  };
}

export const sideDungeons: DungeonInput[] = [
  trial("morgan-trial", text("Trial: Axe-Hand Morgan", "Thử thách: Morgan Tay Rìu"), "shells-marine-base", "morgan", 12, 5),
  trial("buggy-trial", text("Trial: Buggy the Clown", "Thử thách: Buggy Chú Hề"), "buggy-rooftop", "buggy", 19, 8),
  trial("kuro-trial", text("Trial: Captain Kuro", "Thử thách: Thuyền trưởng Kuro"), "kaya-mansion", "kuro", 27, 12),
  trial("krieg-trial", text("Trial: Don Krieg", "Thử thách: Don Krieg"), "krieg-galleon", "don-krieg", 34, 15),
];
