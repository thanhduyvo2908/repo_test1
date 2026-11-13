import { useEffect, useState } from "react";
import type { Element } from "../content/schema";
import { sheetSource } from "./sheetSources";
import { useStore } from "./store";

// Static sprite frames for React screens: a portrait or a standing figure cut from the exported
// atlas, scaled with nearest-neighbour. Characters without an exported sprite get a plain tile.

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FrameInfo {
  atlasUrl: string;
  /** First frame of the idle animation. */
  idle: Box;
  /** The exporter's portrait frame, when the sheet has one. */
  portrait: Box | null;
  /** 1 if the source frames face right, -1 if left. */
  facing: 1 | -1;
}

const infoCache = new Map<string, Promise<FrameInfo | null>>();

function isBox(value: unknown): value is Box {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return ["x", "y", "w", "h"].every((k) => typeof b[k] === "number");
}

function readInfo(raw: unknown, atlasUrl: string): FrameInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as {
    frames?: unknown[];
    anims?: Record<string, { frames?: { f?: unknown }[] }>;
    portrait?: unknown;
    facing?: unknown;
  };
  if (!Array.isArray(data.frames)) return null;
  const idleIndex = data.anims?.idle?.frames?.[0]?.f;
  const idle = typeof idleIndex === "number" ? data.frames[idleIndex] : undefined;
  if (!isBox(idle)) return null;
  const portraitFrame = typeof data.portrait === "number" ? data.frames[data.portrait] : undefined;
  return {
    atlasUrl,
    idle,
    portrait: isBox(portraitFrame) ? portraitFrame : null,
    facing: data.facing === "left" ? -1 : 1,
  };
}

function frameInfo(packId: string, sourceId: string): Promise<FrameInfo | null> {
  const key = `${packId}/${sourceId}`;
  let promise = infoCache.get(key);
  if (!promise) {
    promise = sheetSource(packId, sourceId).then((s) => (s ? readInfo(s.raw, s.atlasUrl) : null));
    infoCache.set(key, promise);
  }
  return promise;
}

/** Frame info for a source id: undefined while loading, null when there is no sprite. */
function useFrameInfo(sourceId: string): FrameInfo | null | undefined {
  const { pack } = useStore();
  const packId = pack.manifest.id;
  const [info, setInfo] = useState<{ key: string; value: FrameInfo | null } | null>(null);
  const key = `${packId}/${sourceId}`;
  useEffect(() => {
    let cancelled = false;
    void frameInfo(packId, sourceId).then((value) => {
      if (!cancelled) setInfo({ key, value });
    });
    return () => {
      cancelled = true;
    };
  }, [packId, sourceId, key]);
  return info?.key === key ? info.value : undefined;
}

function Cut({ url, box, scale, flip }: { url: string; box: Box; scale: number; flip: boolean }) {
  const width = Math.round(box.w * scale);
  const height = Math.round(box.h * scale);
  return (
    <span className="sprite" style={{ width, height }}>
      <span
        style={{
          width: box.w,
          height: box.h,
          backgroundImage: `url(${url})`,
          backgroundPosition: `-${box.x}px -${box.y}px`,
          transform: flip ? `translateX(${box.w * scale}px) scale(${-scale}, ${scale})` : `scale(${scale})`,
        }}
      />
    </span>
  );
}

interface Props {
  /** Character or enemy id. */
  id: string;
  /** Fallback tile: element color and first letter of the name. */
  element?: Element;
  name?: string;
  /** Which way the figure should look. */
  face?: "right" | "left";
}

/** A square portrait, `size` pixels wide. Uses the sheet's portrait frame, else the top of the idle frame. */
export function Portrait({ id, size, element, name, face = "right", dim }: Props & { size: number; dim?: boolean }) {
  const info = useFrameInfo(id);
  const style = { width: size, height: size };
  const className = `portrait${dim ? " dim" : ""}`;
  if (!info) {
    return (
      <span className={`${className} portrait-fallback el-bg-${element ?? "none"}`} style={style} aria-hidden="true">
        {info === null ? (name?.slice(0, 1) ?? "?") : ""}
      </span>
    );
  }
  const box = info.portrait ?? { ...info.idle, h: Math.min(info.idle.h, Math.round(info.idle.w * 1.1)) };
  const scale = Math.min((size - 4) / box.w, (size - 4) / box.h);
  const flip = (face === "right" ? 1 : -1) !== info.facing;
  return (
    <span className={className} style={style} aria-hidden="true">
      <Cut url={info.atlasUrl} box={box} scale={scale} flip={flip} />
    </span>
  );
}

/** A standing figure from the first idle frame, `scale` times its source size. */
export function Figure({ id, scale, element, name, face = "right" }: Props & { scale: number }) {
  const info = useFrameInfo(id);
  if (!info) {
    const size = Math.round(48 * scale);
    return (
      <span
        className={`figure-fallback el-bg-${element ?? "none"}`}
        style={{ width: Math.round(size * 0.7), height: size }}
        aria-hidden="true"
      >
        {info === null ? (name?.slice(0, 1) ?? "?") : ""}
      </span>
    );
  }
  const flip = (face === "right" ? 1 : -1) !== info.facing;
  return <Cut url={info.atlasUrl} box={info.idle} scale={scale} flip={flip} />;
}
