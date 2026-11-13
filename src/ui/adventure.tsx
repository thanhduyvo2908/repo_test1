import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Pack } from "../content/loader";
import type { GameMap, ItemTier } from "../content/schema";
import type { BattleEvent, BattleResult } from "../core/battle";
import { canEnterDungeon, recordDungeonResult } from "../core/dungeons";
import { runBoss, runSideDungeon, runStage } from "../core/encounters";
import {
  isBossUnlocked,
  isMapUnlocked,
  isStageUnlocked,
  mapOrder,
  mapProgress,
  recordBossVictory,
  recordStageResult,
  setTeam,
  stageRewards,
  takeBattleSeed,
  teamMembers,
  type BossRewards,
  type GameState,
  type Resources,
} from "../core/progress";
import { todayKey, useStore } from "./store";

// The idle loop, kept at app level so it keeps running whatever tab is open.
// Mini stages run on a fixed beat that matches the offline reward (3600 / battlesPerHour seconds).
// Playback speed only changes how fast the log is shown, never how often battles run. When the
// playback of a battle ends after the beat, the next battle waits for it: simpler than dropping
// the rest of the playback, and the beat can only get slower, never faster.
// Results are written to the save as soon as a battle is simulated; playback is only for show.

export type StageTarget = { kind: "stage"; mapId: string; stageIndex: number };
export type AdventureTarget = StageTarget | { kind: "boss"; mapId: string } | { kind: "dungeon"; dungeonId: string };

export type Speed = 1 | 2 | 4;
export const SPEEDS: readonly Speed[] = [1, 2, 4];

/** playing: replaying the log. waiting: stage won, next one on the beat. lost: stage lost, loop stopped. result: boss or dungeon card. */
export type Phase = "playing" | "waiting" | "lost" | "result";

export interface Battle {
  id: number;
  target: AdventureTarget;
  result: BattleResult;
  /** Boss win rewards. */
  rewards: BossRewards | null;
  /** Gold and food from a stage win. */
  resources: Resources | null;
  /** Star stones from a side dungeon win. */
  starMaterial: number;
  /** Map opened by this boss win, if any. */
  nextMapId: string | null;
  /** Wall-clock start, for the beat. */
  startedAt: number;
}

type NewsBody =
  | { kind: "recruited"; characterId: string }
  | { kind: "item"; itemId: string; tier: ItemTier; bossId: string }
  | { kind: "mapOpened"; mapId: string }
  | { kind: "bossOpen"; mapId: string }
  | { kind: "worldComplete"; worldId: string }
  | { kind: "dungeonWin"; dungeonId: string; amount: number }
  | { kind: "stageLost"; mapId: string; stageIndex: number }
  | { kind: "noAttempts" };

export type NewsItem = NewsBody & { id: number };

interface AdventureValue {
  battle: Battle | null;
  /** Events played so far. */
  step: number;
  phase: Phase;
  /** The stage the idle loop repeats, and returns to after a boss or dungeon fight. */
  grind: StageTarget;
  speed: Speed;
  setSpeed: (speed: Speed) => void;
  /** Stage wins this session. */
  wins: number;
  /** When the next stage battle starts, in ms since epoch, while waiting. */
  nextAt: number | null;
  /** Newest first. */
  news: NewsItem[];
  grindStage: (mapId: string, stageIndex: number) => void;
  fightBoss: (mapId: string) => void;
  /** Returns false when no attempts are left today. */
  enterDungeon: (dungeonId: string) => boolean;
  skip: () => void;
  /** Runs the current target again: after a lost stage, or from a boss or dungeon result. */
  retry: () => void;
  /** After a lost stage: grind the stage before it. */
  stepBack: () => void;
  /** Closes the boss or dungeon result and goes back to grinding, or to the map it opened. */
  closeResult: (where: "grind" | "nextMap") => void;
  /** Puts a newly recruited character in the team if there is room. */
  addToTeam: (characterId: string) => void;
}

const AdventureContext = createContext<AdventureValue | null>(null);

/** Playback pace in ms per event at ×1. Actions wait longer so attack animations can play. */
function eventDelay(event: BattleEvent | undefined): number {
  if (!event) return 0;
  if (event.type === "roundStart") return 60;
  if (event.type === "action") return 420;
  return 160;
}

/** Shortest pause between the end of a playback and the next stage battle. */
const MIN_GAP_MS = 800;
const MAX_NEWS = 30;

/** The last stage open on a map: the next one to beat, or the last stage once all are cleared. */
export function frontStage(game: GameState, map: GameMap): number {
  return Math.min(mapProgress(game, map.id).stagesCleared, map.stages.length - 1);
}

/** Where a session starts: the first open map whose boss still stands, at its front stage. */
export function initialGrind(pack: Pack, game: GameState): StageTarget {
  const entries = mapOrder(pack);
  const open = entries.filter((e) => isMapUnlocked(game, pack, e.map.id));
  const current = open.find((e) => !mapProgress(game, e.map.id).bossDefeated) ?? open[open.length - 1] ?? entries[0]!;
  return { kind: "stage", mapId: current.map.id, stageIndex: frontStage(game, current.map) };
}

export function AdventureProvider({ children }: { children: ReactNode }) {
  const { pack, game, updateGame, autoAdvance } = useStore();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [grind, setGrind] = useState<StageTarget>(() => initialGrind(pack, game));
  const [speed, setSpeed] = useState<Speed>(1);
  const [wins, setWins] = useState(0);
  const [nextAt, setNextAt] = useState<number | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const ids = useRef({ battle: 0, news: 0 });
  const beatMs = 3_600_000 / pack.balance.offline.battlesPerHour;

  const addNews = useCallback((items: NewsBody[]) => {
    if (items.length === 0) return;
    // Items arrive oldest first; the list is newest first.
    const fresh = [...items].reverse().map((item) => ({ ...item, id: ++ids.current.news }) as NewsItem);
    setNews((current) => [...fresh, ...current].slice(0, MAX_NEWS));
  }, []);

  /** Simulates a battle, records it in the save, and starts its playback. */
  const run = useCallback(
    (target: AdventureTarget): boolean => {
      let next: Battle | null = null;
      const found: NewsBody[] = [];
      updateGame((current) => {
        if (target.kind === "dungeon" && !canEnterDungeon(current, pack, target.dungeonId, todayKey()).ok) {
          return current;
        }
        const { seed, state } = takeBattleSeed(current);
        const team = teamMembers(state);
        const base = {
          id: ++ids.current.battle,
          target,
          rewards: null,
          resources: null,
          starMaterial: 0,
          nextMapId: null,
          startedAt: Date.now(),
        };
        if (target.kind === "stage") {
          const result = runStage(pack, target.mapId, target.stageIndex, team, seed);
          const stage = pack.maps.get(target.mapId)?.stages[target.stageIndex];
          const resources = result.winner === "player" && stage ? stageRewards(pack, stage) : null;
          const recorded = recordStageResult(state, pack, target.mapId, target.stageIndex, result);
          if (!pack.demo && !isBossUnlocked(state, pack, target.mapId) && isBossUnlocked(recorded, pack, target.mapId)) {
            found.push({ kind: "bossOpen", mapId: target.mapId });
          }
          next = { ...base, result, resources };
          return recorded;
        }
        if (target.kind === "dungeon") {
          const dungeon = pack.sideDungeons.get(target.dungeonId);
          if (!dungeon) return current;
          const result = runSideDungeon(pack, dungeon, team, seed);
          const recorded = recordDungeonResult(state, pack, target.dungeonId, todayKey(), result);
          if (recorded.starMaterial > 0) {
            found.push({ kind: "dungeonWin", dungeonId: target.dungeonId, amount: recorded.starMaterial });
          }
          next = { ...base, result, starMaterial: recorded.starMaterial };
          return recorded.state;
        }
        const result = runBoss(pack, target.mapId, team, seed);
        if (result.winner !== "player") {
          next = { ...base, result };
          return state;
        }
        const rewardSeed = takeBattleSeed(state);
        const victory = recordBossVictory(rewardSeed.state, pack, target.mapId, rewardSeed.seed);
        const entries = mapOrder(pack);
        const index = entries.findIndex((e) => e.map.id === target.mapId);
        const nextEntry = entries[index + 1];
        const nextMapId = victory.rewards.firstClear && nextEntry ? nextEntry.map.id : null;
        const bossId = pack.maps.get(target.mapId)?.boss.characterId ?? "";
        const { rewards } = victory;
        if (rewards.recruited) found.push({ kind: "recruited", characterId: rewards.recruited.characterId });
        if (rewards.item) found.push({ kind: "item", itemId: rewards.item.itemId, tier: rewards.item.tier, bossId });
        if (nextMapId) found.push({ kind: "mapOpened", mapId: nextMapId });
        if (rewards.worldCompleted) found.push({ kind: "worldComplete", worldId: rewards.worldCompleted });
        next = { ...base, result, rewards, nextMapId };
        return victory.state;
      });
      if (!next) {
        if (target.kind === "dungeon") addNews([{ kind: "noAttempts" }]);
        return false;
      }
      addNews(found);
      setBattle(next);
      setStep(0);
      setPhase("playing");
      setNextAt(null);
      return true;
    },
    [addNews, pack, updateGame],
  );

  // Start the idle loop once. StrictMode runs effects twice in development; the ref keeps one battle.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run(grind);
  }, [grind, run]);

  // Playback: one event at a time, then decide what comes next.
  useEffect(() => {
    if (!battle || phase !== "playing") return;
    const log = battle.result.log;
    if (step < log.length) {
      const timer = setTimeout(() => setStep((s) => s + 1), eventDelay(log[step]) / speed);
      return () => clearTimeout(timer);
    }
    if (battle.target.kind !== "stage") {
      setPhase("result");
      return;
    }
    if (battle.result.winner === "player") {
      setWins((w) => w + 1);
      setNextAt(Math.max(battle.startedAt + beatMs, Date.now() + MIN_GAP_MS));
      setPhase("waiting");
    } else {
      addNews([{ kind: "stageLost", mapId: battle.target.mapId, stageIndex: battle.target.stageIndex }]);
      setPhase("lost");
    }
  }, [addNews, battle, beatMs, phase, speed, step]);

  // On the beat: repeat the stage, or move on to the next open stage with auto-advance.
  useEffect(() => {
    if (phase !== "waiting" || nextAt === null) return;
    const timer = setTimeout(() => {
      let target = grind;
      const map = pack.maps.get(grind.mapId);
      const following = grind.stageIndex + 1;
      if (autoAdvance && map && following < map.stages.length && isStageUnlocked(game, pack, grind.mapId, following)) {
        target = { ...grind, stageIndex: following };
        setGrind(target);
      }
      run(target);
    }, Math.max(0, nextAt - Date.now()));
    return () => clearTimeout(timer);
  }, [autoAdvance, game, grind, nextAt, pack, phase, run]);

  const value = useMemo<AdventureValue>(
    () => ({
      battle,
      step,
      phase,
      grind,
      speed,
      setSpeed,
      wins,
      nextAt,
      news,
      grindStage: (mapId, stageIndex) => {
        const target: StageTarget = { kind: "stage", mapId, stageIndex };
        setGrind(target);
        const current = battle?.target;
        const same = current?.kind === "stage" && current.mapId === mapId && current.stageIndex === stageIndex;
        // Picking the stage already running keeps the beat instead of starting a battle early.
        if (!same || phase === "lost" || phase === "result") run(target);
      },
      fightBoss: (mapId) => {
        run({ kind: "boss", mapId });
      },
      enterDungeon: (dungeonId) => run({ kind: "dungeon", dungeonId }),
      skip: () => {
        if (battle) setStep(battle.result.log.length);
      },
      retry: () => {
        run(battle?.target ?? grind);
      },
      stepBack: () => {
        const target: StageTarget = { ...grind, stageIndex: Math.max(0, grind.stageIndex - 1) };
        setGrind(target);
        run(target);
      },
      closeResult: (where) => {
        if (where === "nextMap" && battle?.nextMapId) {
          const target: StageTarget = { kind: "stage", mapId: battle.nextMapId, stageIndex: 0 };
          setGrind(target);
          run(target);
          return;
        }
        run(grind);
      },
      addToTeam: (characterId) => {
        updateGame((g) => (g.team.includes(characterId) ? g : setTeam(g, [...g.team, characterId])));
      },
    }),
    [battle, grind, nextAt, news, phase, run, speed, step, updateGame, wins],
  );

  return <AdventureContext.Provider value={value}>{children}</AdventureContext.Provider>;
}

export function useAdventure(): AdventureValue {
  const value = useContext(AdventureContext);
  if (!value) throw new Error("useAdventure must be used inside AdventureProvider");
  return value;
}

/** Re-renders every second while `until` is in the future; returns the seconds left. */
export function useCountdown(until: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  return until === null ? null : Math.max(0, Math.ceil((until - now) / 1000));
}
