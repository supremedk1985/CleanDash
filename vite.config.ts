import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
let commit = "";
try { commit = execSync("git rev-parse --short HEAD").toString().trim(); } catch { /* not a git checkout */ }

// The dashboard lives in src-www and is built into www/, which ioBroker uploads and the web adapter serves
// under /cleandash/. Relative paths, so it works under any prefix.
export default defineConfig({
  root: "src-www",
  base: "./",
  plugins: [vue()],
  define: { __APP_VERSION__: JSON.stringify(`${version}${commit ? ` (${commit})` : ""}`) },
  build: { outDir: "../www", emptyOutDir: true, chunkSizeWarningLimit: 600 },
  test: { root: ".", include: ["test/**/*.test.ts"], environment: "node" },
});
