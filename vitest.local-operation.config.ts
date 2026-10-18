import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Opt-in only. The ordinary operating database is never a standard test target. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/local-operation/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
