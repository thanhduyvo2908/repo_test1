// Batch battle simulation for balance checks.
//
//   npm run sim                      every stage and boss of every map, starter alone
//   npm run sim -- --runs 500        more seeds per fight
//   npm run sim -- --levels 1,3,5    team levels to try
import { loadPack } from "../src/content/loader";
import type { BattleResult } from "../src/core/battle";
import { runBoss, runStage, type TeamMember } from "../src/core/encounters";
import { placeholderPackData } from "../packs/placeholder";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const runs = Number(arg("runs") ?? 200);
const levels = (arg("levels") ?? "1,3,5,10").split(",").map(Number);

const pack = loadPack(placeholderPackData);
const starter = pack.manifest.starterCharacterId;

interface Summary {
  winRate: number;
  avgRounds: number;
  timeouts: number;
  avgHpLeft: number;
}

function summarize(results: BattleResult[]): Summary {
  let wins = 0;
  let rounds = 0;
  let timeouts = 0;
  let hpLeft = 0;
  for (const result of results) {
    if (result.winner === "player") wins += 1;
    if (result.winner === null) timeouts += 1;
    rounds += result.rounds;
    const players = result.units.filter((u) => u.side === "player");
    const hp = players.reduce((sum, u) => sum + (result.finalHp[u.uid] ?? 0), 0);
    const max = players.reduce((sum, u) => sum + u.maxHp, 0);
    hpLeft += hp / max;
  }
  return {
    winRate: wins / results.length,
    avgRounds: rounds / results.length,
    timeouts,
    avgHpLeft: hpLeft / results.length,
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(5);

console.log(`Pack "${pack.manifest.id}", ${runs} runs per fight, team: ${starter} alone.\n`);

for (const map of pack.maps.values()) {
  console.log(`== ${map.id} ==`);
  console.log(`${"fight".padEnd(10)}${levels.map((l) => `Lv ${l}`.padStart(22)).join("")}`);
  console.log(`${"".padEnd(10)}${levels.map(() => "win  rounds  hpLeft".padStart(22)).join("")}`);

  const fights: [string, (team: TeamMember[], seed: number) => BattleResult][] = [
    ...map.stages.map(
      (_, i) =>
        [`stage ${i + 1}`, (team: TeamMember[], seed: number) => runStage(pack, map.id, i, team, seed)] as [
          string,
          (team: TeamMember[], seed: number) => BattleResult,
        ],
    ),
    ["boss", (team, seed) => runBoss(pack, map.id, team, seed)],
  ];

  for (const [label, fight] of fights) {
    const cells = levels.map((level) => {
      const team: TeamMember[] = [{ characterId: starter, level }];
      const results = Array.from({ length: runs }, (_, seed) => fight(team, seed + 1));
      const s = summarize(results);
      return `${pct(s.winRate)}  ${s.avgRounds.toFixed(1).padStart(6)}  ${pct(s.avgHpLeft)}`.padStart(22);
    });
    console.log(`${label.padEnd(10)}${cells.join("")}`);
  }
  console.log();
}
