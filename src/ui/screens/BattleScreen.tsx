import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StatusSpec } from "../../content/schema";
import type { BattleEvent, BattleResult, UnitSummary } from "../../core/battle";
import type { CanvasUnit } from "../BattleCanvas";
import { elementColor } from "../sceneColors";
import { isHarmful, statusLabel } from "../statusText";
import { canEnterDungeon, recordDungeonResult } from "../../core/dungeons";
import { runBoss, runSideDungeon, runStage } from "../../core/encounters";
import {
  isStageUnlocked,
  mapOrder,
  recordBossVictory,
  recordStageResult,
  stageRewards,
  takeBattleSeed,
  teamMembers,
  type BossRewards,
  type Resources,
} from "../../core/progress";
import { BackButton, ElementBadge } from "../common";
import { animKeyFor, passiveName, skillsById, unitName } from "../content";
import { todayKey, useStore } from "../store";

// PixiJS is large, so the scene loads only when a battle opens.
const BattleCanvas = lazy(() => import("../BattleCanvas").then((m) => ({ default: m.BattleCanvas })));

export type BattleTarget =
  | { kind: "stage"; mapId: string; stageIndex: number }
  | { kind: "boss"; mapId: string }
  | { kind: "dungeon"; dungeonId: string };

interface Outcome {
  result: BattleResult;
  rewards: BossRewards | null;
  /** Gold and food from a stage win. */
  resources: Resources | null;
  /** Star material from a side dungeon win. */
  starMaterial: number;
  /** True when this boss win opened the next map. */
  nextMapOpened: boolean;
}

const STEP_MS = 160;
/** Actions wait longer so sprite attack animations have time to play. */
const ACTION_MS = 420;
const ROUND_MS = 60;
const REPEAT_DELAY_MS = 1200;
const LOG_LINES = 8;

/** Plays back a battle log. Stages repeat automatically until the player stops or loses. */
export function BattleScreen({
  target,
  onBack,
  onAdvance,
}: {
  target: BattleTarget;
  onBack: () => void;
  /** Opens another stage of the same map (auto-advance). */
  onAdvance: (stageIndex: number) => void;
}) {
  const { pack, game, updateGame, t, l, n, autoAdvance, setAutoAdvance } = useStore();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [step, setStep] = useState(0);
  const [repeat, setRepeat] = useState(true);
  const [wins, setWins] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const started = useRef(false);

  const entry = target.kind === "dungeon" ? undefined : mapOrder(pack).find((e) => e.map.id === target.mapId);
  const dungeon = target.kind === "dungeon" ? pack.sideDungeons.get(target.dungeonId) : undefined;

  const start = useCallback(() => {
    let next: Outcome | null = null;
    let refused = false;
    updateGame((game) => {
      if (target.kind === "dungeon" && !canEnterDungeon(game, pack, target.dungeonId, todayKey()).ok) {
        refused = true;
        return game;
      }
      const { seed, state } = takeBattleSeed(game);
      const team = teamMembers(state);
      const base = { rewards: null, resources: null, starMaterial: 0, nextMapOpened: false };
      if (target.kind === "stage") {
        const result = runStage(pack, target.mapId, target.stageIndex, team, seed);
        const stage = pack.maps.get(target.mapId)?.stages[target.stageIndex];
        const resources = result.winner === "player" && stage ? stageRewards(pack, stage) : null;
        next = { ...base, result, resources };
        return recordStageResult(state, pack, target.mapId, target.stageIndex, result);
      }
      if (target.kind === "dungeon") {
        const found = pack.sideDungeons.get(target.dungeonId);
        if (!found) return state;
        const result = runSideDungeon(pack, found, team, seed);
        const recorded = recordDungeonResult(state, pack, target.dungeonId, todayKey(), result);
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
      const nextMap = entry ? mapOrder(pack)[entry.index + 1] : undefined;
      next = {
        ...base,
        result,
        rewards: victory.rewards,
        nextMapOpened: victory.rewards.firstClear && nextMap !== undefined,
      };
      return victory.state;
    });
    setBlocked(refused);
    if (!refused) {
      setOutcome(next);
      setStep(0);
    }
  }, [entry, pack, target, updateGame]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  const log = outcome?.result.log ?? [];
  const done = outcome !== null && step >= log.length;

  // Advance the playback one event at a time.
  useEffect(() => {
    if (!outcome || done) return;
    const event = log[step];
    const timer = setTimeout(() => setStep((s) => s + 1), event?.type === "roundStart" ? ROUND_MS : event?.type === "action" ? ACTION_MS : STEP_MS);
    return () => clearTimeout(timer);
  }, [outcome, done, log, step]);

  // When a stage is won, count it and start the next run if auto-repeat is on.
  const won = done && outcome?.result.winner === "player";
  const counted = useRef<Outcome | null>(null);
  useEffect(() => {
    if (!won || counted.current === outcome) return;
    counted.current = outcome;
    setWins((w) => w + 1);
  }, [won, outcome]);
  // The next stage of this map, if auto-advance should move there after a win.
  const nextStage =
    target.kind === "stage" &&
    autoAdvance &&
    target.stageIndex + 1 < (pack.maps.get(target.mapId)?.stages.length ?? 0) &&
    isStageUnlocked(game, pack, target.mapId, target.stageIndex + 1)
      ? target.stageIndex + 1
      : null;
  useEffect(() => {
    if (!won || target.kind !== "stage" || !repeat) return;
    const timer = setTimeout(() => {
      if (nextStage !== null) onAdvance(nextStage);
      else start();
    }, REPEAT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [won, repeat, start, target.kind, nextStage, onAdvance]);

  const units = outcome?.result.units ?? [];
  const view = useMemo(() => replay(units, log.slice(0, step)), [units, log, step]);
  const statusById = useMemo(() => {
    const byId = new Map<number, StatusSpec>();
    for (const event of log) if (event.type === "statusApplied") byId.set(event.statusId, event.status);
    return byId;
  }, [log]);
  const skills = skillsById(pack);
  const name = (uid: number) => {
    const unit = units[uid];
    return unit ? l(unitName(pack, unit)) : "?";
  };

  const label = (spec: StatusSpec | undefined) => (spec ? statusLabel(spec, t) : "?");

  // Units for the PixiJS scene. A new array per battle tells the scene to reset.
  const sceneUnits = useMemo<CanvasUnit[]>(
    () =>
      units.map((u) => {
        const source = u.kind === "enemy" ? pack.enemies.get(u.sourceId) : pack.characters.get(u.sourceId);
        return {
          uid: u.uid,
          side: u.side,
          kind: u.kind,
          maxHp: u.maxHp,
          sourceId: u.sourceId,
          label: l(unitName(pack, u)),
          color: elementColor(source?.element ?? "metal"),
        };
      }),
    // Labels follow the language at battle start; the scene resets every battle.
    [units],
  );

  function describe(event: BattleEvent): string | null {
    switch (event.type) {
      case "roundStart":
        return `— ${t("battle.round", { round: event.round })} —`;
      case "enter":
        return t("battle.enter", { name: name(event.unit) });
      case "action": {
        const skill = skills.get(event.skillId);
        return t("battle.uses", { name: name(event.actor), skill: skill ? l(skill.name) : event.skillId });
      }
      case "turnSkipped":
        return t(event.reason === "stun" ? "battle.skippedStun" : "battle.skippedSleep", {
          name: name(event.unit),
        });
      case "damage": {
        const notes = [
          event.absorbed > 0 ? t("battle.absorbed", { amount: event.absorbed }) : "",
          event.crit ? t("battle.crit") : "",
          event.effectiveness > 1 ? t("battle.strong") : "",
          event.effectiveness < 1 ? t("battle.weak") : "",
        ].filter(Boolean);
        return [t("battle.damage", { target: name(event.target), amount: event.amount }), ...notes].join(" ");
      }
      case "dot":
        return t("battle.dot", {
          name: name(event.unit),
          amount: event.amount + event.absorbed,
          status: label(statusById.get(event.statusId)),
        });
      case "heal":
        return t("battle.heal", { name: name(event.unit), amount: event.amount });
      case "statusApplied": {
        const status = statusLabel(event.status, t, event.shield);
        return event.duration === null
          ? t("battle.statusPermanent", { name: name(event.unit), status })
          : t("battle.statusTimed", { name: name(event.unit), status, turns: event.duration });
      }
      case "statusResisted":
        return t("battle.statusResisted", { name: name(event.unit), status: label(event.status) });
      case "statusExpired":
        return t("battle.statusExpired", {
          name: name(event.unit),
          status: label(statusById.get(event.statusId)),
        });
      case "cooldownChanged":
        return t(event.rounds > 0 ? "battle.cooldownDelayed" : "battle.cooldownHastened", {
          name: name(event.unit),
          rounds: Math.abs(event.rounds),
        });
      case "passive":
        return t("battle.passive", { name: name(event.unit), passive: l(passiveName(pack, event.passiveId)) });
      case "defeated":
        return t("battle.defeated", { name: name(event.unit) });
      case "battleEnd":
        return null;
    }
  }

  const lines = log
    .slice(0, step)
    .map(describe)
    .filter((line): line is string => line !== null)
    .slice(-LOG_LINES);

  const title =
    target.kind === "dungeon"
      ? t("battle.dungeonTitle", { name: dungeon ? l(dungeon.name) : target.dungeonId })
      : entry
        ? target.kind === "stage"
          ? t("battle.stageTitle", { map: l(entry.map.name), n: target.stageIndex + 1 })
          : t("battle.bossTitle", { map: l(entry.map.name) })
        : "";

  return (
    <>
      <BackButton onClick={onBack} />
      <h2>{title}</h2>
      {target.kind === "stage" && (
        <div className="row small">
          <span className="muted">{t("battle.wins", { count: wins })}</span>
          <label className="toggle push-right">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(event) => setAutoAdvance(event.target.checked)}
            />
            {t("battle.autoAdvance")}
          </label>
        </div>
      )}
      {blocked && (
        <p className="error small" role="alert">
          {t("dungeon.noAttempts")}
        </p>
      )}

      {outcome && (
        <Suspense fallback={<div className="battle-canvas" />}>
          <BattleCanvas
            packId={pack.manifest.id}
            units={sceneUnits}
            animFor={(uid, skillId) => {
              const unit = units[uid];
              return unit ? animKeyFor(pack, unit, skillId) : "basic";
            }}
            log={log}
            step={step}
            state={view}
            statusLabel={(event) => (isHarmful(event.status) ? statusLabel(event.status, t, event.shield) : "")}
          />
        </Suspense>
      )}

      <div className="battle-field">
        {(["player", "enemy"] as const).map((side) => (
          <ul key={side} className={`battle-side side-${side}`}>
            {units
              .filter((u) => u.side === side)
              .map((u) => {
                const hp = view.hp[u.uid] ?? u.maxHp;
                const state = hp <= 0 ? "fallen" : view.onField.has(u.uid) ? "active" : "waiting";
                const source = u.kind === "enemy" ? pack.enemies.get(u.sourceId) : pack.characters.get(u.sourceId);
                return (
                  <li key={u.uid} className={`battle-unit ${state}`}>
                    <div className="row">
                      <strong>{name(u.uid)}</strong>
                      {source && <ElementBadge element={source.element} />}
                    </div>
                    <div className="small muted">
                      {t("mapInfo.level", { level: u.level })} · {hp}/{u.maxHp}
                    </div>
                    <div className="hp-bar">
                      <div className="hp-fill" style={{ width: `${(100 * hp) / u.maxHp}%` }} />
                    </div>
                    {hp > 0 && (view.statuses[u.uid]?.size ?? 0) > 0 && (
                      <ul className="status-chips">
                        {[...(view.statuses[u.uid]?.values() ?? [])].map((s) => (
                          <li key={s.id} className={`status-chip ${isHarmful(s.spec) ? "harmful" : "helpful"}`}>
                            {statusLabel(s.spec, t, s.shield)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
          </ul>
        ))}
      </div>

      <ol className="battle-log small" aria-live="polite">
        {lines.map((line, i) => (
          <li key={`${step}-${i}`}>{line}</li>
        ))}
      </ol>

      {!done && outcome && (
        <button type="button" className="secondary-button" onClick={() => setStep(log.length)}>
          {t("battle.skip")}
        </button>
      )}

      {done && outcome && (
        <div className="card result">
          <strong className={outcome.result.winner === "player" ? "win" : "lose"}>
            {outcome.result.winner === "player" ? t("battle.victory") : t("battle.defeat")}
          </strong>
          {outcome.result.winner === null && <p className="small">{t("battle.timeout")}</p>}
          {outcome.resources && (
            <p className="small">{t("rewards.resources", { gold: n(outcome.resources.gold), food: n(outcome.resources.food) })}</p>
          )}
          {outcome.starMaterial > 0 && (
            <p className="small">{t("rewards.starMaterial", { amount: outcome.starMaterial })}</p>
          )}
          {outcome.rewards && entry && (
            <Rewards
              rewards={outcome.rewards}
              bossId={entry.map.boss.characterId}
              nextMapOpened={outcome.nextMapOpened}
            />
          )}
          {target.kind === "stage" && won && repeat ? (
            <>
              <p className="small muted">{nextStage !== null ? t("battle.advancing") : t("battle.repeating")}</p>
              <button type="button" className="secondary-button" onClick={() => setRepeat(false)}>
                {t("battle.stop")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setRepeat(true);
                start();
              }}
            >
              {t("battle.retry")}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function Rewards({
  rewards,
  bossId,
  nextMapOpened,
}: {
  rewards: BossRewards;
  bossId: string;
  nextMapOpened: boolean;
}) {
  const { pack, t, l, n } = useStore();
  const bossName = (id: string) => {
    const c = pack.characters.get(id);
    return c ? l(c.name) : id;
  };
  const itemLine = (itemId: string, tier: string) => {
    const item = pack.items.get(itemId);
    return t("rewards.item", {
      item: item ? l(item.name) : itemId,
      tier: t(`tier.${tier as "common"}`),
    });
  };
  return (
    <div className="rewards">
      <h4>{t("rewards.title")}</h4>
      <ul className="small">
        <li>{t("rewards.resources", { gold: n(rewards.resources.gold), food: n(rewards.resources.food) })}</li>
        {rewards.recruited && <li>{t("rewards.recruited", { name: bossName(rewards.recruited.characterId) })}</li>}
        {!rewards.recruited && rewards.recruitChance !== null && rewards.recruitChance > 0 && (
          <li>
            {t("rewards.notRecruited", {
              name: bossName(bossId),
              percent: Math.round(rewards.recruitChance * 100),
            })}
          </li>
        )}
        <li>{rewards.item ? itemLine(rewards.item.itemId, rewards.item.tier) : t("rewards.noItem")}</li>
        {rewards.worldCompleted && <li>{t("rewards.worldComplete")}</li>}
        {rewards.completionItems.map((item) => (
          <li key={item.uid}>{itemLine(item.itemId, item.tier)}</li>
        ))}
        {nextMapOpened && <li>{t("rewards.nextMap")}</li>}
      </ul>
    </div>
  );
}

interface ShownStatus {
  id: number;
  spec: StatusSpec;
  /** Shield points left, for shields. */
  shield: number | undefined;
}

/** HP, statuses and who is on the field, after the given events. */
function replay(units: UnitSummary[], events: BattleEvent[]) {
  const hp = units.map((u) => u.maxHp);
  const onField = new Set<number>();
  const statuses: Map<number, ShownStatus>[] = units.map(() => new Map());
  const shrinkShields = (uid: number, absorbed: number) => {
    let left = absorbed;
    for (const s of statuses[uid]?.values() ?? []) {
      if (s.shield === undefined || left <= 0) continue;
      const used = Math.min(s.shield, left);
      s.shield -= used;
      left -= used;
    }
  };
  for (const event of events) {
    switch (event.type) {
      case "enter":
        onField.add(event.unit);
        break;
      case "damage":
        hp[event.target] = event.hpAfter;
        shrinkShields(event.target, event.absorbed);
        break;
      case "dot":
        hp[event.unit] = event.hpAfter;
        shrinkShields(event.unit, event.absorbed);
        break;
      case "heal":
        hp[event.unit] = event.hpAfter;
        break;
      case "statusApplied":
        statuses[event.unit]?.set(event.statusId, {
          id: event.statusId,
          spec: event.status,
          shield: event.shield,
        });
        break;
      case "statusExpired":
        statuses[event.unit]?.delete(event.statusId);
        break;
      case "defeated":
        onField.delete(event.unit);
        statuses[event.unit]?.clear();
        break;
    }
  }
  return { hp, onField, statuses };
}

