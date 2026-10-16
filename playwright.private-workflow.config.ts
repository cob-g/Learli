import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Separate from the legacy fixture mirrors: exercise this checkout's actual build.
const origin = "http://127.0.0.1:3121";
process.env.APP_URL = origin;
process.env.BETTER_AUTH_URL = origin;
process.env.PRIVATE_WORKFLOW_CONFIG_FILE = path.join(
  process.cwd(),
  ".local/private-fictional-workflow-browser/packet.json",
);
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "private-fictional-workflow.spec.ts",
    "private-fictional-student.spec.ts",
    "private-fictional-admin.spec.ts",
    "private-fictional-security.spec.ts",
  ],
  globalSetup: "./tests/support/private-workflow-browser-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: origin,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: 1440, height: 900 },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npm run start -- --port 3121",
    url: `${origin}/api/health`,
    reuseExistingServer: false,
    env: {
      APP_ENV: "test",
      AUTH_MODE: "local",
      DATABASE_MODE: "local",
      NEON_DEVELOPMENT_CONFIG_FILE: "",
      APP_URL: origin,
      BETTER_AUTH_URL: origin,
      PRIVATE_WORKFLOW_CONFIG_FILE: process.env.PRIVATE_WORKFLOW_CONFIG_FILE,
    },
    timeout: 60_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
