// Content packs the app can load. The placeholder pack is the default; others load on demand.

export const DEFAULT_PACK = "placeholder";

export const packLoaders: Record<string, () => Promise<unknown>> = {
  placeholder: async () => (await import("./placeholder")).placeholderPackData,
  onepiece: async () => (await import("./onepiece")).onepiecePackData,
};
