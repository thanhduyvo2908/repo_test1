import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_PACK, packLoaders } from "../packs";
import { loadPack, toDemoPack } from "./content/loader";
import type { SaveStorage } from "./save";
import { App } from "./ui/App";
import { StoreProvider } from "./ui/store";
// Tiny5 pixel font (OFL), bundled so the game works offline. See CREDITS.md.
import "@fontsource/tiny5/latin.css";
import "@fontsource/tiny5/latin-ext.css";
import "./ui/styles.css";

/** localStorage can be missing or throw (private mode, blocked storage); keep the game running. */
function browserStorage(): SaveStorage {
  const memory = new Map<string, string>();
  return {
    getItem(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        memory.set(key, value);
      }
    },
  };
}

/** Each pack keeps its own save, and demo mode its own on top; the default pack keeps the original key. */
function storageFor(packId: string, demo: boolean, base: SaveStorage): SaveStorage {
  const suffix = [packId === DEFAULT_PACK ? "" : `.${packId}`, demo ? ".demo" : ""].join("");
  if (!suffix) return base;
  return {
    getItem: (key) => base.getItem(`${key}${suffix}`),
    setItem: (key, value) => base.setItem(`${key}${suffix}`, value),
  };
}

/** ?demo=1 opens every map and skill, with a separate save. For testing and showing the game. */
function isDemo(): boolean {
  const value = new URLSearchParams(window.location.search).get("demo");
  return value !== null && value !== "0" && value !== "false";
}

/** Pack chosen with ?pack=<id>, then the build-time VITE_PACK, then the placeholder pack. */
function chosenPack(): string {
  const fromUrl = new URLSearchParams(window.location.search).get("pack");
  const fromEnv = import.meta.env.VITE_PACK as string | undefined;
  for (const id of [fromUrl, fromEnv]) if (id && id in packLoaders) return id;
  return DEFAULT_PACK;
}

async function start() {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing #root element");
  const packId = chosenPack();
  const demo = isDemo();
  const loaded = loadPack(await packLoaders[packId]!());
  const pack = demo ? toDemoPack(loaded) : loaded;
  createRoot(root).render(
    <StrictMode>
      <StoreProvider pack={pack} storage={storageFor(packId, demo, browserStorage())}>
        <App />
      </StoreProvider>
    </StrictMode>,
  );
}

void start();
