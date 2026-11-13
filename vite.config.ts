import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Character viewer (tools/viewer/): serves /__viewer/ during `npm run dev` only. The handler is
 * loaded through Vite on the first request, so the config itself imports no tool code and edits
 * to tools/viewer/server.ts apply without a restart.
 */
function characterViewer(): Plugin {
  return {
    name: "xidle-character-viewer",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__viewer", (req, res, next) => {
        server
          .ssrLoadModule("/tools/viewer/server.ts")
          .then((mod) => mod.handleViewer(server.config.root, req, res, (msg: string) => server.config.logger.error(msg)))
          .catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), characterViewer()],
  // Relative base so the static build works from any folder or sub-path.
  base: "./",
  test: {
    include: ["src/**/*.test.ts", "packs/**/*.test.ts", "tools/**/*.test.ts"],
    environment: "node",
  },
});
