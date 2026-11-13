import { useEffect, useRef, useState } from "react";
import type { BattleEvent } from "../core/battle";
import { BattleScene, type SceneUnit } from "../render/BattleScene";
import type { LayoutState } from "../render/layout";
import { readSceneTheme } from "./sceneColors";
import { loadSheets } from "./spriteAssets";

export type CanvasUnit = Omit<SceneUnit, "sheet"> & { sourceId: string };

interface Props {
  /** Pack whose exported sprites to use. */
  packId: string;
  /** A new array (new battle) resets the scene. */
  units: CanvasUnit[];
  log: BattleEvent[];
  /** Number of events played so far. */
  step: number;
  /** State after `step` events. */
  state: LayoutState;
  statusLabel: (event: Extract<BattleEvent, { type: "statusApplied" }>) => string;
  animFor: (unitUid: number, skillId: string) => string;
  /** Playback speed: 1, 2 or 4. */
  speed: number;
  /** Pixels kept clear at the top (corner controls) and bottom (caption). */
  topInset: number;
  bottomInset: number;
  /** Called once the scene and the battle's sprites are ready to show. */
  onReady?: () => void;
}

/** The PixiJS battle scene, driven by the playback step of the idle loop. */
export function BattleCanvas({
  packId,
  units,
  log,
  step,
  state,
  statusLabel,
  animFor,
  speed,
  topInset,
  bottomInset,
  onReady,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<BattleScene | null>(null);
  /** Units of the battle the scene was last set up for, with sheets attached. */
  const [ready, setReady] = useState<{ source: CanvasUnit[]; units: SceneUnit[] } | null>(null);
  const shown = useRef<{ units: SceneUnit[] | null; step: number }>({ units: null, step: 0 });
  const callbacks = useRef({ statusLabel, animFor, onReady, insets: { topInset, bottomInset } });
  callbacks.current = { statusLabel, animFor, onReady, insets: { topInset, bottomInset } };

  // Create the PixiJS app once; tear it down on unmount.
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let created: BattleScene | null = null;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const options = () => ({
      theme: readSceneTheme(),
      reducedMotion: motion.matches,
      statusLabel: (event: Extract<BattleEvent, { type: "statusApplied" }>) => callbacks.current.statusLabel(event),
      animFor: (uid: number, skillId: string) => callbacks.current.animFor(uid, skillId),
      ...callbacks.current.insets,
    });
    void BattleScene.create(element, options()).then((s) => {
      if (cancelled) {
        s.destroy();
        return;
      }
      created = s;
      s.setPaused(document.visibilityState === "hidden");
      setScene(s);
    });
    const observer = new ResizeObserver(() => created?.resize());
    observer.observe(element);
    const refresh = () => created?.setOptions(options());
    motion.addEventListener("change", refresh);
    // No drawing while the browser tab is hidden; the idle loop itself keeps running.
    const onVisibility = () => created?.setPaused(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    // The pixel font may arrive after the scene is built; names are redrawn with it.
    void document.fonts?.ready.then(() => {
      if (!cancelled) refresh();
    });
    return () => {
      cancelled = true;
      observer.disconnect();
      motion.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      created?.destroy();
      shown.current = { units: null, step: 0 };
    };
  }, []);

  useEffect(() => {
    scene?.setSpeed(speed);
  }, [scene, speed]);

  // Load sprite sheets for a new battle. Units without a sheet are drawn as shapes.
  useEffect(() => {
    let cancelled = false;
    void loadSheets(packId, units.map((u) => u.sourceId)).then((sheets) => {
      if (cancelled) return;
      setReady({
        source: units,
        units: units.map((u) => {
          const sheet = sheets.get(u.sourceId);
          return sheet ? { ...u, sheet } : { ...u };
        }),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [packId, units]);

  // Follow the playback: animate single steps, jump on anything else (new battle, skip).
  useEffect(() => {
    if (!scene || !ready || ready.source !== units) return;
    if (shown.current.units !== ready.units) {
      scene.setup(ready.units);
      shown.current = { units: ready.units, step: 0 };
      callbacks.current.onReady?.();
    }
    const previous = shown.current.step;
    if (step === previous + 1) {
      const event = log[step - 1];
      if (event) scene.play(event, state);
    } else if (step !== previous) {
      scene.sync(state);
    }
    shown.current.step = step;
  }, [scene, ready, units, log, step, state]);

  return <div ref={host} className="battle-canvas" />;
}
