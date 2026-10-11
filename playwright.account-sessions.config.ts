import { defineConfig, devices } from "@playwright/test";
import baseline from "./playwright.config";

export default defineConfig({
  ...baseline,
  workers: 1,
  projects: [
    {
      name: "account-sessions",
      testMatch: "account-sessions.spec.ts",
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
  ],
});
