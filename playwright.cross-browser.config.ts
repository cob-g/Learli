import { screeningMirrorOrigin } from "./tests/support/readiness-placement";
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
    {
      name: "account-password-firefox",
      testMatch: "account-password.spec.ts",
      use: { browserName: "firefox" },
    },
    {
      name: "account-password-webkit",
      testMatch: "account-password.spec.ts",
      use: { browserName: "webkit" },
    },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
    {
      name: "admin-security-firefox",
      testMatch: "admin-security.spec.ts",
      use: { browserName: "firefox" },
    },
    {
      name: "admin-security-webkit",
      testMatch: "admin-security.spec.ts",
      use: { browserName: "webkit" },
    },
    {
      name: "learner-admission-firefox",
      testMatch: "learner-admission.spec.ts",
      use: { browserName: "firefox" },
    },
    {
      name: "learner-admission-webkit",
      testMatch: "learner-admission.spec.ts",
      use: { browserName: "webkit" },
    },
    {
      name: "screening-safeguarding-firefox",
      testMatch: ["tutor-screening.spec.ts", "safeguarding-response.spec.ts"],
      timeout: 240000,
      use: { browserName: "firefox", baseURL: screeningMirrorOrigin },
    },
    {
      name: "screening-safeguarding-webkit",
      testMatch: ["tutor-screening.spec.ts", "safeguarding-response.spec.ts"],
      timeout: 240000,
      use: { browserName: "webkit", baseURL: screeningMirrorOrigin },
    },
    {
      name: "policy-booking-firefox",
      testMatch: "policy-booking.spec.ts",
      timeout: 180000,
      use: { browserName: "firefox", baseURL: screeningMirrorOrigin },
    },
    {
      name: "policy-booking-webkit",
      testMatch: "policy-booking.spec.ts",
      timeout: 180000,
      use: { browserName: "webkit", baseURL: screeningMirrorOrigin },
    },
    {
      name: "review-publication-firefox",
      testMatch: "review-publication.spec.ts",
      timeout: 180000,
      use: { browserName: "firefox", baseURL: screeningMirrorOrigin },
    },
    {
      name: "review-publication-webkit",
      testMatch: "review-publication.spec.ts",
      timeout: 180000,
      use: { browserName: "webkit", baseURL: screeningMirrorOrigin },
    },
    {
      name: "transactional-delivery-firefox",
      testMatch: "transactional-delivery.spec.ts",
      timeout: 180000,
      use: { browserName: "firefox", baseURL: screeningMirrorOrigin },
    },
    {
      name: "transactional-delivery-webkit",
      testMatch: "transactional-delivery.spec.ts",
      timeout: 180000,
      use: { browserName: "webkit", baseURL: screeningMirrorOrigin },
    },
    {
      name: "hosted-workflows-integration-firefox",
      testMatch: "hosted-workflows-integration.spec.ts",
      timeout: 240000,
      use: { browserName: "firefox", baseURL: screeningMirrorOrigin },
    },
    {
      name: "hosted-workflows-integration-webkit",
      testMatch: "hosted-workflows-integration.spec.ts",
      timeout: 240000,
      use: { browserName: "webkit", baseURL: screeningMirrorOrigin },
    },
  ],
  // No inherited destructive global setup. Every fixture has its own teardown.
  webServer: [
    {
      command: `npm run start -- --hostname 127.0.0.1 --port ${target.port}`,
      url: `${baseURL}/api/health`,
      reuseExistingServer: false,
      env: { APP_ENV: "test", AUTH_MODE: "local", APP_URL: baseURL },
      timeout: 60_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "node --import tsx scripts/w6-readiness-mirror.ts serve",
      url: `${screeningMirrorOrigin}/api/health`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
