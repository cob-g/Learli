import { screeningMirrorOrigin } from "./tests/support/readiness-placement";
import { hostedBrowserOrigin } from "./tests/support/hosted-auth-placement";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.APP_URL ?? "http://127.0.0.1:3100";
const target = new URL(baseURL);
const hostedBrowser = process.env.LEARLI_HOSTED_BROWSER ?? "chromium";
if (!["chromium", "firefox", "webkit"].includes(hostedBrowser))
  throw new Error("Unsupported owned hosted browser engine.");
const hostedDevice =
  hostedBrowser === "firefox"
    ? devices["Desktop Firefox"]
    : hostedBrowser === "webkit"
      ? devices["Desktop Safari"]
      : devices["Desktop Chrome"];
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
      name: "hosted-auth",
      testMatch: "hosted-auth.spec.ts",
      fullyParallel: false,
      use: {
        ...hostedDevice,
        baseURL: hostedBrowserOrigin,
        ignoreHTTPSErrors: true,
        trace: "off",
        screenshot: "off",
        video: "off",
        viewport: { width: 1440, height: 900 },
      },
    },
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
      testMatch: [
        "auth.spec.ts",
        "header-navigation.spec.ts",
        "workspace-shell.spec.ts",
        "private-document-identity.spec.ts",
      ],
      // Isolated auth fixtures share test throttle rows, so run one worker.
      workers: 1,
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
    {
      name: "account-password",
      testMatch: "account-password.spec.ts",
      dependencies: ["six-feature-integration"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "booking-meeting-links",
      testMatch: "booking-meeting-links.spec.ts",
      dependencies: ["account-password"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "support-bookings",
      testMatch: "support-bookings.spec.ts",
      dependencies: ["booking-meeting-links"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "account-restrictions",
      testMatch: "account-restrictions.spec.ts",
      dependencies: ["support-bookings"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "four-feature-integration",
      testMatch: "four-feature-integration.spec.ts",
      dependencies: ["account-restrictions"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "directory-time-filters",
      testMatch: "directory-time-filters.spec.ts",
      dependencies: ["four-feature-integration"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "subject-rename",
      testMatch: "subject-rename.spec.ts",
      dependencies: ["directory-time-filters"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "account-email",
      testMatch: "account-email.spec.ts",
      dependencies: ["subject-rename"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "three-feature-integration",
      testMatch: "three-feature-integration.spec.ts",
      dependencies: ["account-email"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "draft-policies",
      testMatch: "draft-policies.spec.ts",
      dependencies: ["three-feature-integration"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "support-assignment",
      testMatch: "support-assignment.spec.ts",
      dependencies: ["draft-policies"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "private-reviews",
      testMatch: "private-reviews.spec.ts",
      dependencies: ["support-assignment"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "local-completion-integration",
      testMatch: "local-completion-integration.spec.ts",
      dependencies: ["private-reviews"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "admin-security",
      testMatch: "admin-security.spec.ts",
      dependencies: ["local-completion-integration"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
    {
      name: "learner-admission",
      testMatch: "learner-admission.spec.ts",
      dependencies: ["admin-security"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
    {
      name: "screening-safeguarding",
      timeout: 240000,
      testMatch: ["tutor-screening.spec.ts", "safeguarding-response.spec.ts"],
      dependencies: ["learner-admission"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: screeningMirrorOrigin,
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
    {
      name: "policy-booking",
      testMatch: "policy-booking.spec.ts",
      dependencies: ["screening-safeguarding"],
      fullyParallel: false,
      timeout: 180000,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: screeningMirrorOrigin,
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
    {
      name: "review-publication",
      timeout: 180000,
      testMatch: "review-publication.spec.ts",
      dependencies: ["policy-booking"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: screeningMirrorOrigin,
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
    {
      name: "transactional-delivery",
      testMatch: "transactional-delivery.spec.ts",
      dependencies: ["review-publication"],
      fullyParallel: false,
      timeout: 180000,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: screeningMirrorOrigin,
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
    {
      name: "hosted-workflows-integration",
      testMatch: "hosted-workflows-integration.spec.ts",
      dependencies: ["transactional-delivery"],
      fullyParallel: false,
      timeout: 240000,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: screeningMirrorOrigin,
        viewport: { width: 1440, height: 900 },
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
  ],
  webServer: [
    {
      command: `npm run start -- --hostname 127.0.0.1 --port ${target.port}`,
      url: `${baseURL}/api/health`,
      reuseExistingServer: false,
      env: { APP_ENV: "test", APP_URL: baseURL },
      timeout: 60_000,
    },
    {
      command: "node --import tsx scripts/w6-readiness-mirror.ts serve",
      url: `${screeningMirrorOrigin}/api/health`,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "node --import tsx tests/support/hosted-auth-app.ts",
      url: `${hostedBrowserOrigin}/api/health`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 240_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 30_000 },
    },
  ],
});
