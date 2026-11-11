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
}

/** The PixiJS battle scene, driven by the playback step of the battle screen. */
export function BattleCanvas({ packId, units, log, step, state, statusLabel, animFor }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<BattleScene | null>(null);
  /** Units of the battle the scene was last set up for, with sheets attached. */
  const [ready, setReady] = useState<{ source: CanvasUnit[]; units: SceneUnit[] } | null>(null);
  const shown = useRef<{ units: SceneUnit[] | null; step: number }>({ units: null, step: 0 });
  const callbacks = useRef({ statusLabel, animFor });
  callbacks.current = { statusLabel, animFor };

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
    });
    void BattleScene.create(element, options()).then((s) => {
      if (cancelled) {
        s.destroy();
        return;
      }
      created = s;
      setScene(s);
    });
    const observer = new ResizeObserver(() => created?.resize());
    observer.observe(element);
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const refresh = () => created?.setOptions(options());
    dark.addEventListener("change", refresh);
    motion.addEventListener("change", refresh);
    return () => {
      cancelled = true;
      observer.disconnect();
      dark.removeEventListener("change", refresh);
      motion.removeEventListener("change", refresh);
      created?.destroy();
      shown.current = { units: null, step: 0 };
    };
  }, []);

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
