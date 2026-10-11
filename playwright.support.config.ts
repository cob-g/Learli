import { defineConfig, devices } from "@playwright/test";
const baseURL = process.env.APP_URL!;
const target = new URL(baseURL);
if (
  target.protocol !== "http:" ||
  target.hostname !== "127.0.0.1" ||
  !target.port
)
  throw new Error("Support browsers require explicit loopback test origin.");
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "support.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/support" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1440, height: 900 },
    trace: "off",
    screenshot: "off",
  },
  webServer: {
    command: `npm run start -- --port ${target.port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
