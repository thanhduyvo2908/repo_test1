import { lazy, Suspense, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { StatusSpec } from "../../content/schema";
import type { BattleEvent, UnitSummary } from "../../core/battle";
import { isBossUnlocked, isStageUnlocked, mapOrder, mapProgress, stageRewards } from "../../core/progress";
import { SPEEDS, useAdventure, useCountdown } from "../adventure";
import type { CanvasUnit } from "../BattleCanvas";
import { describeEvent, skillLabel, statusesById, unitLabel } from "../battleText";
import { Bar, ElementBadge, Rich } from "../common";
import { animKeyFor, unitName } from "../content";
import { counterHints, mapElements } from "../counter";
import { useNav, type Layout } from "../nav";
import { replay, type ReplayView } from "../replay";
import { elementColor } from "../sceneColors";
import { Portrait } from "../SpriteFrame";
import { isHarmful, statusLabel } from "../statusText";
import { useStore } from "../store";

// PixiJS is large, so the scene loads after the first paint.
const BattleCanvas = lazy(() => import("../BattleCanvas").then((m) => ({ default: m.BattleCanvas })));

const LOG_COLLAPSED = 3;

/** The current battle's units and the state after the events played so far. */
export function useBattleView() {
  const { battle, step } = useAdventure();
  const units = battle?.result.units ?? EMPTY_UNITS;
  const log = battle?.result.log ?? EMPTY_LOG;
  const view = useMemo(() => replay(units, log.slice(0, step)), [units, log, step]);
  const statusById = useMemo(() => statusesById(log), [log]);
  return { battle, step, units, log, view, statusById };
}

const EMPTY_UNITS: UnitSummary[] = [];
const EMPTY_LOG: BattleEvent[] = [];

/**
 * The Adventure tab: the idle battle always running, with the team and the current map.
 * From tablet width the map card sits in the sidebar; on desktop "Found here" moves to the right column.
 */
export function AdventureScreen({ layout }: { layout: Layout }) {
  return (
    <div className="adventure">
      <StageStrip />
      <BossCard />
      <ScenePanel />
      <TeamStrip />
      <IdleRow />
      {layout === "phone" && <MapCard />}
      {layout === "tablet" && <FoundHere withBossButton />}
      {layout === "phone" && <FoundHere />}
      <BattleLog />
    </div>
  );
}

// ---------------------------------------------------------------------------

function StageStrip() {
  const { pack, game, t } = useStore();
  const { grind, battle, grindStage } = useAdventure();
  const { openSheet } = useNav();
  const map = pack.maps.get(grind.mapId);
  if (!map) return null;
  const cleared = mapProgress(game, map.id).stagesCleared;
  const onBoss = battle?.target.kind === "boss" && battle.target.mapId === map.id;
  return (
    <div className="strip">
      <span className="strip-name px">
        {onBoss ? t("adventure.boss") : t("mapInfo.stage", { n: grind.stageIndex + 1 })}
      </span>
      <ol className="dots">
        {map.stages.map((_, index) => {
          const open = isStageUnlocked(game, pack, map.id, index);
          const state = index === grind.stageIndex && !onBoss ? "cur" : index < cleared ? "done" : open ? "open" : "";
          return (
            <li key={index}>
              <button
                type="button"
                className={`dot ${state}`}
                disabled={!open}
                aria-label={t("mapInfo.stage", { n: index + 1 })}
                aria-current={state === "cur" ? "step" : undefined}
                onClick={() => grindStage(map.id, index)}
              >
                <i />
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className={`dot boss${onBoss ? " cur" : ""}${mapProgress(game, map.id).bossDefeated ? " done" : ""}`}
            aria-label={t("adventure.boss")}
            onClick={() => openSheet({ kind: "map", mapId: map.id })}
          >
            <i />
          </button>
        </li>
      </ol>
      <span className="strip-count px">
        {Math.min(grind.stageIndex + 1, map.stages.length)}/{map.stages.length}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Boss name, HP and round over the scene during boss and side dungeon fights. */
function BossCard() {
  const { pack, t, l } = useStore();
  const { units, view } = useBattleView();
  const { battle } = useAdventure();
  if (!battle || battle.target.kind === "stage") return null;
  const boss = units.find((u) => u.kind === "boss");
  if (!boss) return null;
  const character = pack.characters.get(boss.sourceId);
  const hp = view.hp[boss.uid] ?? boss.maxHp;
  const limit = battle.target.kind === "boss" ? pack.balance.rounds.boss : pack.balance.rounds.sideDungeon;
  const statuses = [...(view.statuses[boss.uid]?.values() ?? [])];
  return (
    <div className="card boss-card">
      <div className="row">
        <span className="px boss-name">{l(unitName(pack, boss))}</span>
        {character && <ElementBadge element={character.element} />}
        <span className="muted small">{t("mapInfo.level", { level: boss.level })}</span>
        <span className="grow" />
        <span className="px gold small">{t("adventure.round", { round: Math.max(1, view.round), limit })}</span>
      </div>
      <Bar ratio={hp / boss.maxHp} className="big" />
      {statuses.length > 0 && (
        <ul className="status-chips">
          {statuses.map((s) => (
            <li key={s.id} className={`status-chip ${isHarmful(s.spec) ? "harmful" : "helpful"}`}>
              {statusLabel(s.spec, t, s.shield)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** The battle scene with its overlays. `compact` is the small copy shown beside other tabs. */
export function ScenePanel({ compact = false }: { compact?: boolean }) {
  const { pack, t, l } = useStore();
  const { battle, phase, speed, setSpeed, wins, skip } = useAdventure();
  const { units, log, step, view } = useBattleView();
  const [readyId, setReadyId] = useState<number | null>(null);
  const battleId = useRef<number | null>(null);
  battleId.current = battle?.id ?? null;
  const onReady = useCallback(() => setReadyId(battleId.current), []);

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

  const isDuel = battle?.target.kind === "stage";
  const enemies = units.filter((u) => u.side === "enemy");
  const enemiesDown = enemies.filter((u) => (view.hp[u.uid] ?? 1) <= 0).length;
  const foe = Math.min(enemies.length, enemiesDown + 1);

  return (
    <div className={`scene${compact ? " compact" : ""}`}>
      {battle && (
        <Suspense fallback={null}>
          <BattleCanvas
            packId={pack.manifest.id}
            units={sceneUnits}
            log={log}
            step={step}
            state={view}
            speed={speed}
            topInset={compact ? 4 : 34}
            bottomInset={compact ? 28 : 38}
            animFor={(uid, skillId) => {
              const unit = units[uid];
              return unit ? animKeyFor(pack, unit, skillId) : "basic";
            }}
            statusLabel={(event) => (isHarmful(event.status) ? statusLabel(event.status, t, event.shield) : "")}
            onReady={onReady}
          />
        </Suspense>
      )}
      {(!battle || readyId !== battle.id) && <div className="scene-loading px">{t("adventure.loading")}</div>}
      {!compact && (
        <div className="ovl tl">
          {isDuel && <span className="chip px">{t("adventure.wins", { count: wins })}</span>}
          {isDuel && enemies.length > 0 && (
            <span className="chip px">{t("adventure.foe", { n: foe, total: enemies.length })}</span>
          )}
        </div>
      )}
      {!compact && (
        <div className="ovl tr speed" role="group" aria-label={t("adventure.speed")}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={s === speed ? "on" : ""}
              aria-pressed={s === speed}
              onClick={() => setSpeed(s)}
            >
              ×{s}
            </button>
          ))}
          <button type="button" onClick={skip} disabled={phase !== "playing"} aria-label={t("battle.skip")}>
            ⏭
          </button>
        </div>
      )}
      <Caption log={log} step={step} units={units} />
      {phase === "lost" && !compact && <LostCard />}
    </div>
  );
}

/** One line at the bottom of the scene: what just happened, or when the next battle starts. */
function Caption({ log, step, units }: { log: BattleEvent[]; step: number; units: UnitSummary[] }) {
  const { pack, t, l } = useStore();
  const { phase, nextAt, battle } = useAdventure();
  const seconds = useCountdown(phase === "waiting" ? nextAt : null);
  const ctx = { pack, units, l };
  let content: ReactNode = "…";
  if (phase === "waiting" && seconds !== null) {
    content = t("adventure.nextIn", { seconds });
  } else if (phase === "lost") {
    content = t("adventure.teamLost");
  } else if (phase === "result" && battle) {
    content = battle.result.winner === "player" ? t("battle.victory") : t("battle.defeat");
  } else {
    for (let i = Math.min(step, log.length) - 1; i >= 0; i--) {
      const event = log[i];
      if (event?.type === "action") {
        content = (
          <Rich
            k="adventure.caption"
            nodes={{ name: <em>{unitLabel(ctx, event.actor)}</em>, skill: <em>{skillLabel(ctx, event.skillId)}</em> }}
          />
        );
        break;
      }
      if (event?.type === "enter" && units[event.unit]?.side === "enemy") {
        content = <Rich k="adventure.appears" nodes={{ name: <em>{unitLabel(ctx, event.unit)}</em> }} />;
        break;
      }
    }
  }
  return (
    <div className="caption px" aria-live="polite">
      {content}
    </div>
  );
}

/** Shown on the scene when a mini stage is lost: the loop stops until the player picks. */
function LostCard() {
  const { t } = useStore();
  const { grind, retry, stepBack } = useAdventure();
  return (
    <div className="lost-card" role="alert">
      <div className="px lost-title">{t("adventure.teamLost")}</div>
      <div className="row">
        <button type="button" className="btn" onClick={retry}>
          {t("adventure.retry")}
        </button>
        {grind.stageIndex > 0 && (
          <button type="button" className="btn ghost" onClick={stepBack}>
            {t("adventure.backTo", { n: grind.stageIndex })}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Biggest status on a team member, as a one-character icon. */
function statusIcon(statuses: Map<number, { spec: StatusSpec }> | undefined): { icon: string; harmful: boolean } | null {
  if (!statuses || statuses.size === 0) return null;
  const order: StatusSpec["kind"][] = ["stun", "sleep", "silence", "dot", "statStage", "taunt", "shield", "damageReduction", "immunity", "regen"];
  const specs = [...statuses.values()].map((s) => s.spec).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const spec = specs[0];
  if (!spec) return null;
  const icons: Record<StatusSpec["kind"], string> = {
    stun: "✶",
    sleep: "z",
    silence: "∅",
    dot: "♨",
    statStage: spec.kind === "statStage" && spec.stages < 0 ? "▼" : "▲",
    taunt: "!",
    shield: "◆",
    damageReduction: "◇",
    immunity: "○",
    regen: "+",
  };
  return { icon: icons[spec.kind], harmful: isHarmful(spec) };
}

export function TeamStrip() {
  const { pack, game, t, l } = useStore();
  const { openSheet } = useNav();
  const { units, view } = useBattleView();
  return (
    <ul className="team-strip">
      {game.team.map((characterId) => {
        const character = pack.characters.get(characterId);
        const owned = game.roster.find((c) => c.characterId === characterId);
        if (!character || !owned) return null;
        const unit = units.find((u) => u.side === "player" && u.sourceId === characterId);
        const hp = unit ? (view.hp[unit.uid] ?? unit.maxHp) : 1;
        const max = unit?.maxHp ?? 1;
        const out = unit !== undefined && hp <= 0;
        const active = unit !== undefined && !out && view.onField.has(unit.uid);
        const icon = unit ? statusIcon(view.statuses[unit.uid] as ReplayView["statuses"][number]) : null;
        return (
          <li key={characterId}>
            <button
              type="button"
              className={`member${active ? " active" : ""}${out ? " out" : ""}`}
              onClick={() => openSheet({ kind: "character", characterId })}
              aria-label={`${l(character.name)} · ${t("team.level", { level: owned.level })}`}
            >
              <Portrait id={characterId} size={40} element={character.element} name={l(character.name)} />
              <span className="lv px">{out ? t("adventure.ko") : t("team.levelShort", { level: owned.level })}</span>
              <Bar ratio={hp / max} />
              {icon && <span className={`member-status ${icon.harmful ? "harmful" : "helpful"}`}>{icon.icon}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------

function IdleRow() {
  const { pack, t, ns, autoAdvance, setAutoAdvance } = useStore();
  const { grind } = useAdventure();
  const stage = pack.maps.get(grind.mapId)?.stages[grind.stageIndex];
  const perHour = stage ? stageRewards(pack, stage).gold * pack.balance.offline.battlesPerHour : 0;
  return (
    <div className="idle-row">
      <div className="card">
        <div className="small muted">{t("adventure.perHour")}</div>
        <div className="kv px">
          +{ns(perHour)} <span className="small muted">{t("adventure.goldUnit")}</span>
        </div>
      </div>
      <label className="card toggle-card">
        <span className="small muted">{t("battle.autoAdvance")}</span>
        <span className="row">
          <input
            type="checkbox"
            className="switch"
            checked={autoAdvance}
            onChange={(event) => setAutoAdvance(event.target.checked)}
          />
          <span className="small">{autoAdvance ? t("adventure.on") : t("adventure.off")}</span>
        </span>
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** The map being grinded, with the boss state. Opens the world sheet. */
export function MapCard({ showProgress = false }: { showProgress?: boolean }) {
  const { pack, game, t, l, ns } = useStore();
  const { grind, fightBoss, battle } = useAdventure();
  const { openSheet } = useNav();
  const entries = mapOrder(pack);
  const entry = entries.find((e) => e.map.id === grind.mapId);
  if (!entry) return null;
  const { map } = entry;
  const world = pack.worlds.find((w) => w.id === entry.worldId);
  const worldMaps = entries.filter((e) => e.worldId === entry.worldId);
  const number = worldMaps.findIndex((e) => e.map.id === map.id) + 1;
  const boss = pack.characters.get(map.boss.characterId);
  const progress = mapProgress(game, map.id);
  const bossOpen = isBossUnlocked(game, pack, map.id);
  const left = Math.max(0, map.stages.length - progress.stagesCleared);
  const fightingBoss = battle !== null && battle.target.kind !== "stage";
  const stage = map.stages[grind.stageIndex];
  const perHour = stage ? stageRewards(pack, stage).gold * pack.balance.offline.battlesPerHour : 0;
  return (
    <div className="card map-card">
      <button type="button" className="map-card-main" onClick={() => openSheet({ kind: "world" })}>
        <Portrait id={map.boss.characterId} size={44} element={boss?.element} name={boss ? l(boss.name) : ""} />
        <span className="grow">
          <span className="small muted block">
            {map.arc ? l(map.arc) : world ? l(world.name) : ""} · {t("adventure.mapOf", { n: number, total: worldMaps.length })}
          </span>
          <span className="px block map-card-name">{l(map.name)}</span>
          {showProgress ? (
            <>
              <Bar kind="progress" ratio={Math.min(progress.stagesCleared, map.stages.length) / map.stages.length} />
              <span className="small muted block">
                {t("mapInfo.stage", { n: grind.stageIndex + 1 })}/{map.stages.length} · +{ns(perHour)}{" "}
                {t("adventure.goldPerHour")}
              </span>
            </>
          ) : (
            <span className="small muted block">
              {fightingBoss
                ? t("news.bossFight")
                : progress.bossDefeated
                ? t("adventure.bossDefeated")
                : bossOpen
                  ? t("adventure.bossReady")
                  : t("adventure.bossLocked", { count: left })}
            </span>
          )}
        </span>
        <span className="chev" aria-hidden="true">
          ▾
        </span>
      </button>
      {bossOpen && !showProgress && (
        <button type="button" className="btn block" disabled={fightingBoss} onClick={() => fightBoss(map.id)}>
          {progress.bossDefeated ? t("adventure.fightAgain") : t("mapInfo.fightBoss")}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Enemies and boss of the current map, with element counter hints. */
export function FoundHere({ withBossButton = false }: { withBossButton?: boolean }) {
  const { pack, game, t, l } = useStore();
  const { grind, battle, fightBoss } = useAdventure();
  const { openSheet } = useNav();
  const map = pack.maps.get(grind.mapId);
  if (!map) return null;
  const ranges = enemyRanges(map.stages);
  const boss = pack.characters.get(map.boss.characterId);
  const owned = game.roster.some((c) => c.characterId === map.boss.characterId);
  const world = mapOrder(pack).find((e) => e.map.id === map.id)?.worldId ?? "";
  const rate = map.boss.recruitRate ?? pack.balance.worlds[world]?.recruitRate ?? 0;
  return (
    <section className="card found-here">
      <h3 className="h px">
        {t("adventure.foundHere")}
        <button
          type="button"
          className="iconbtn small-icon right"
          onClick={() => openSheet({ kind: "map", mapId: map.id })}
          aria-label={t("adventure.mapInfo")}
        >
          ⓘ
        </button>
      </h3>
      <ul className="enemy-list">
        {[...ranges].map(([enemyId, range]) => {
          const enemy = pack.enemies.get(enemyId);
          if (!enemy) return null;
          return (
            <li key={enemyId} className="enemy">
              <Portrait id={enemyId} size={32} element={enemy.element} name={l(enemy.name)} face="left" />
              <span className="small">
                {l(enemy.name)}
                <br />
                <ElementBadge element={enemy.element} />{" "}
                <span className="muted">{t("mapInfo.levelRange", { min: range.min, max: range.max })}</span>
              </span>
            </li>
          );
        })}
        {boss && (
          <li className="enemy">
            <Portrait id={boss.id} size={32} element={boss.element} name={l(boss.name)} face="left" />
            <span className="small">
              {l(boss.name)} · {t("adventure.boss")}
              <br />
              <ElementBadge element={boss.element} />{" "}
              <span className="muted">
                {t("mapInfo.level", { level: map.boss.level })} ·{" "}
                {owned ? t("mapInfo.owned") : `${Math.round(rate * 100)}%`}
              </span>
            </span>
          </li>
        )}
      </ul>
      <CounterHint mapId={map.id} />
      {withBossButton && <BossButton mapId={map.id} busy={battle !== null && battle.target.kind !== "stage"} onFight={fightBoss} />}
    </section>
  );
}

/** Fight the boss, or how many stages are left before it opens. */
function BossButton({ mapId, busy, onFight }: { mapId: string; busy: boolean; onFight: (mapId: string) => void }) {
  const { pack, game, t } = useStore();
  const map = pack.maps.get(mapId);
  if (!map) return null;
  const progress = mapProgress(game, mapId);
  const open = isBossUnlocked(game, pack, mapId);
  const left = Math.max(0, map.stages.length - progress.stagesCleared);
  return (
    <button type="button" className="btn block boss-button" disabled={!open || busy} onClick={() => onFight(mapId)}>
      {open
        ? progress.bossDefeated
          ? t("adventure.fightAgain")
          : t("mapInfo.fightBoss")
        : t("adventure.bossLocked", { count: left })}
    </button>
  );
}

/** "Counter: Metal beats Wood — Zoro." and who in the team is weak here. */
export function CounterHint({ mapId }: { mapId: string }) {
  const { pack, game, t, l } = useStore();
  const hints = counterHints(pack, game, mapElements(pack, mapId));
  const name = (id: string) => {
    const c = pack.characters.get(id);
    return c ? l(c.name) : id;
  };
  if (hints.strong.length === 0 && hints.weakInTeam.length === 0) return null;
  return (
    <div className="hint small">
      {hints.strong.map((line) => (
        <div key={line.defender}>
          <Rich
            k={line.characterIds.length > 0 ? "counter.beats" : "counter.beatsNobody"}
            params={{ names: line.characterIds.map(name).join(", ") }}
            nodes={{
              attackers: <b>{line.attackers.map((e) => t(`element.${e}`)).join(", ")}</b>,
              defender: <b>{t(`element.${line.defender}`)}</b>,
            }}
          />
        </div>
      ))}
      {hints.weakInTeam.length > 0 && (
        <div>
          <Rich k="counter.weak" nodes={{ names: <b>{hints.weakInTeam.map(name).join(", ")}</b> }} />
        </div>
      )}
    </div>
  );
}

/** Enemy types with the level range they appear at. */
export function enemyRanges(stages: { enemies: { enemyId: string; level: number }[] }[]) {
  const ranges = new Map<string, { min: number; max: number }>();
  for (const stage of stages) {
    for (const { enemyId, level } of stage.enemies) {
      const range = ranges.get(enemyId);
      ranges.set(enemyId, { min: Math.min(range?.min ?? level, level), max: Math.max(range?.max ?? level, level) });
    }
  }
  return ranges;
}

// ---------------------------------------------------------------------------

function BattleLog() {
  const { pack, t, l } = useStore();
  const { units, log, step, statusById } = useBattleView();
  const [open, setOpen] = useState(false);
  const lines = useMemo(() => {
    const ctx = { pack, units, t, l, statusById };
    return log
      .slice(0, step)
      .map((event) => describeEvent(event, ctx))
      .filter((line) => line !== null);
  }, [pack, units, t, l, statusById, log, step]);
  const shown = open ? lines : lines.filter((line) => line.tone !== "round").slice(-LOG_COLLAPSED);
  return (
    <section className="card">
      <h3 className="h px">
        {t("adventure.log")}
        <button type="button" className="link right small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? t("adventure.collapse") : t("adventure.expand")}
        </button>
      </h3>
      <ol className={`log${open ? " open" : ""}`} aria-live="off">
        {shown.map((line, i) => (
          <li key={`${step}-${i}`} className={line.tone}>
            {line.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
