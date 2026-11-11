import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { placeholderPackData } from "../packs/placeholder";
import { loadPack } from "./content/loader";
import type { SaveStorage } from "./save";
import { App } from "./ui/App";
import { StoreProvider } from "./ui/store";
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

const pack = loadPack(placeholderPackData);
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <StoreProvider pack={pack} storage={browserStorage()}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
