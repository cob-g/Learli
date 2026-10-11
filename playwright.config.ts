import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.APP_URL ?? "http://127.0.0.1:3100";
const target = new URL(baseURL);
if (
  target.hostname !== "127.0.0.1" ||
  target.protocol !== "http:" ||
  !target.port
)
  throw new Error("Browser tests require an explicit loopback port.");

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testMatch: "foundation.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "phone",
      testMatch: "foundation.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "narrow",
      testMatch: "foundation.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 320, height: 720 },
      },
    },
    {
      name: "auth",
      testMatch: "auth.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "catalog",
      testMatch: "tutor-catalog.spec.ts",
      // Finish empty-inventory checks and auth throttle assertions before catalog setup.
      dependencies: ["desktop", "phone", "narrow", "auth"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "availability",
      testMatch: "availability.spec.ts",
      dependencies: ["catalog"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "learners",
      testMatch: "learners.spec.ts",
      // Learner cases reset test-only throttle counters; finish other auth work first.
      dependencies: ["auth", "availability"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "bookings",
      testMatch: "bookings.spec.ts",
      dependencies: ["languages"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "languages",
      testMatch: "teaching-languages.spec.ts",
      dependencies: ["learners"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "time-off",
      testMatch: "time-off.spec.ts",
      dependencies: ["bookings"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "support",
      testMatch: "support.spec.ts",
      dependencies: ["time-off"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "account-sessions",
      testMatch: "account-sessions.spec.ts",
      dependencies: ["support"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "booking-history",
      testMatch: "booking-history.spec.ts",
      dependencies: ["account-sessions"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "profile-booking",
      testMatch: "profile-booking.spec.ts",
      dependencies: ["booking-history"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "family-dashboard",
      testMatch: "family-dashboard.spec.ts",
      dependencies: ["profile-booking"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "tutor-dashboard",
      testMatch: "tutor-dashboard.spec.ts",
      dependencies: ["family-dashboard"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "matching",
      testMatch: "matching.spec.ts",
      dependencies: ["tutor-dashboard"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "booking-notifications",
      testMatch: "booking-notifications.spec.ts",
      dependencies: ["matching"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "six-feature-integration",
      testMatch: "six-feature-integration.spec.ts",
      dependencies: ["booking-notifications"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${target.port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    env: { APP_ENV: "test", APP_URL: baseURL },
    timeout: 60_000,
  },
});
