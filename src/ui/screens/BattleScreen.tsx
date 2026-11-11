import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StatusSpec } from "../../content/schema";
import type { BattleEvent, BattleResult, UnitSummary } from "../../core/battle";
import type { StringKey, TemplateParams } from "../../i18n";
import { runBoss, runStage } from "../../core/encounters";
import {
  mapOrder,
  recordBossVictory,
  recordStageResult,
  takeBattleSeed,
  teamMembers,
  type BossRewards,
} from "../../core/progress";
import { BackButton, ElementBadge } from "../common";
import { passiveName, skillsById, unitName } from "../content";
import { useStore } from "../store";

export type BattleTarget = { mapId: string; kind: "stage"; stageIndex: number } | { mapId: string; kind: "boss" };

interface Outcome {
  result: BattleResult;
  rewards: BossRewards | null;
  /** True when this boss win opened the next map. */
  nextMapOpened: boolean;
}

const STEP_MS = 160;
const ROUND_MS = 60;
const REPEAT_DELAY_MS = 1200;
const LOG_LINES = 8;

/** Plays back a battle log. Stages repeat automatically until the player stops or loses. */
export function BattleScreen({ target, onBack }: { target: BattleTarget; onBack: () => void }) {
  const { pack, updateGame, t, l } = useStore();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [step, setStep] = useState(0);
  const [repeat, setRepeat] = useState(true);
  const [wins, setWins] = useState(0);
  const started = useRef(false);

  const entry = mapOrder(pack).find((e) => e.map.id === target.mapId);

  const start = useCallback(() => {
    let next: Outcome | null = null;
    updateGame((game) => {
      const { seed, state } = takeBattleSeed(game);
      const team = teamMembers(state);
      if (target.kind === "stage") {
        const result = runStage(pack, target.mapId, target.stageIndex, team, seed);
        next = { result, rewards: null, nextMapOpened: false };
        return recordStageResult(state, target.mapId, target.stageIndex, result);
      }
      const result = runBoss(pack, target.mapId, team, seed);
      if (result.winner !== "player") {
        next = { result, rewards: null, nextMapOpened: false };
        return state;
      }
      const rewardSeed = takeBattleSeed(state);
      const victory = recordBossVictory(rewardSeed.state, pack, target.mapId, rewardSeed.seed);
      const nextMap = entry ? mapOrder(pack)[entry.index + 1] : undefined;
      next = {
        result,
        rewards: victory.rewards,
        nextMapOpened: victory.rewards.firstClear && nextMap !== undefined,
      };
      return victory.state;
    });
    setOutcome(next);
    setStep(0);
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
    const timer = setTimeout(() => setStep((s) => s + 1), event?.type === "roundStart" ? ROUND_MS : STEP_MS);
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
  useEffect(() => {
    if (!won || target.kind !== "stage" || !repeat) return;
    const timer = setTimeout(start, REPEAT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [won, repeat, start, target.kind]);

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

  const title = entry
    ? target.kind === "stage"
      ? t("battle.stageTitle", { map: l(entry.map.name), n: target.stageIndex + 1 })
      : t("battle.bossTitle", { map: l(entry.map.name) })
    : "";

  return (
    <>
      <BackButton onClick={onBack} />
      <h2>{title}</h2>
      {target.kind === "stage" && <p className="small muted">{t("battle.wins", { count: wins })}</p>}

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
          {outcome.rewards && entry && (
            <Rewards
              rewards={outcome.rewards}
              bossId={entry.map.boss.characterId}
              nextMapOpened={outcome.nextMapOpened}
            />
          )}
          {target.kind === "stage" && won && repeat ? (
            <>
              <p className="small muted">{t("battle.repeating")}</p>
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
  const { pack, t, l } = useStore();
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

function isHarmful(spec: StatusSpec): boolean {
  return (
    spec.kind === "stun" ||
    spec.kind === "sleep" ||
    spec.kind === "silence" ||
    spec.kind === "dot" ||
    (spec.kind === "statStage" && spec.stages < 0)
  );
}

/** Short display name of a status, e.g. "Attack +1" or "Shield 25". */
function statusLabel(
  spec: StatusSpec,
  t: (key: StringKey, params?: TemplateParams) => string,
  shield?: number,
): string {
  switch (spec.kind) {
    case "stun":
    case "sleep":
    case "silence":
    case "regen":
    case "immunity":
    case "taunt":
      return t(`status.${spec.kind}`);
    case "dot":
      return t(`status.${spec.type}`);
    case "statStage":
      return t("status.statStage", {
        stat: t(`stat.${spec.stat}`),
        change: spec.stages > 0 ? `+${spec.stages}` : `−${-spec.stages}`,
      });
    case "shield":
      return t("status.shield", { amount: shield ?? "" }).trim();
    case "damageReduction": {
      const percent = Math.round(spec.ratio * 100);
      return spec.damageType
        ? t("status.damageReductionTyped", { percent, type: t(`damageType.${spec.damageType}`).toLowerCase() })
        : t("status.damageReduction", { percent });
    }
  }
}
