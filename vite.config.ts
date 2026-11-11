import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the static build works from any folder or sub-path.
  base: "./",
  test: {
    include: ["src/**/*.test.ts", "packs/**/*.test.ts", "tools/**/*.test.ts"],
    environment: "node",
  },
});
