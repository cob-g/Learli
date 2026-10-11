import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  workers: 1,
  fullyParallel: false,
  projects: [
    {
      name: "languages",
      testMatch: "teaching-languages.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
  ],
});
