import { defineConfig, devices } from "@playwright/test";
import { isLoopbackOrigin } from "./src/lib/local-mode";
const baseURL = process.env.APP_URL ?? "http://127.0.0.1:3102";
if (process.env.APP_ENV !== "test" || !isLoopbackOrigin(baseURL))
  throw new Error(
    "Learner browser checks require isolated local test configuration.",
  );
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "learners.spec.ts",
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "off",
    screenshot: "off",
  },
  webServer: {
    command: `npm run start -- --port ${new URL(baseURL).port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
