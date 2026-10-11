import { defineConfig, devices } from "@playwright/test";
import baseline from "./playwright.config";
export default defineConfig({
  ...baseline,
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: "time-off",
      testMatch: "time-off.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
  ],
});
