import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// The dashboard lives in src-www and is built into www/, which ioBroker uploads and the web adapter serves
// under /cleandash/. Relative paths, so it works under any prefix.
export default defineConfig({
  root: "src-www",
  base: "./",
  plugins: [vue()],
  build: { outDir: "../www", emptyOutDir: true, chunkSizeWarningLimit: 600 },
  test: { root: ".", include: ["test/**/*.test.ts"], environment: "node" },
});
