import { defineConfig } from "@playwright/test";

const baseURL = process.env.APP_URL;
if (
  !baseURL ||
  process.env.APP_ENV !== "test" ||
  process.env.AUTH_MODE !== "local"
)
  throw new Error(
    "Cross-browser acceptance requires dedicated local test configuration.",
  );
const target = (() => {
  try {
    return new URL(baseURL);
  } catch {
    throw new Error(
      "Cross-browser acceptance requires a valid loopback origin; values omitted.",
    );
  }
})();
if (
  target.protocol !== "http:" ||
  target.hostname !== "127.0.0.1" ||
  !target.port ||
  target.username ||
  target.password ||
  target.pathname !== "/" ||
  target.search ||
  target.hash ||
  baseURL !== target.origin
)
  throw new Error(
    "Cross-browser acceptance requires an explicit loopback origin.",
  );

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "cross-browser*.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: ".local/readiness-wave/browser-results",
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "America/New_York",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  // No inherited destructive global setup. Every fixture has its own teardown.
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${target.port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    env: { APP_ENV: "test", AUTH_MODE: "local", APP_URL: baseURL },
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
