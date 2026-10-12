// Scoped worker verification only; root owns normal-project registration.
import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import base from "../../playwright.config";
export default defineConfig({
  ...base,
  testDir: fileURLToPath(new URL(".", import.meta.url)),
  globalSetup: fileURLToPath(new URL("./global-setup.ts", import.meta.url)),
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: "support-assignment",
      testMatch: [
        "support-assignment.spec.ts",
        "support.spec.ts",
        "support-bookings.spec.ts",
      ],
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
