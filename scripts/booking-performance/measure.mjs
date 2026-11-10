import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

if (
  !process.env.LEARLI_PERFORMANCE_ROOT ||
  realpathSync(process.env.LEARLI_PERFORMANCE_ROOT) !==
    realpathSync(process.cwd()) ||
  !realpathSync(process.cwd()).startsWith(
    `${realpathSync("/tmp")}/learli-booking-perf-`,
  )
)
  throw new Error("Explicit owned performance copy required");
const fixture = JSON.parse(
  readFileSync(".local/performance-fixture.json", "utf8"),
);
if (fixture.origin !== "http://127.0.0.1:3410")
  throw new Error("Owned origin required");
const label = process.argv[2];
if (!/^(before|formatting|after)$/.test(label))
  throw new Error("Choose before, formatting or after");
const browser = await chromium.launch();
const result = {
  label,
  pages: [],
  sessionRequests: [],
  responsiveness: [],
  idle: {},
  started: Date.now(),
};
const contexts = [];
try {
  const actors = {};
  for (const role of ["parent", "student", "tutor"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    contexts.push(context);
    await context.addCookies(
      fixture[role].cookie.split("; ").map((part) => {
        const index = part.indexOf("=");
        return {
          name: part.slice(0, index),
          value: part.slice(index + 1),
          url: fixture.origin,
        };
      }),
    );
    const page = await context.newPage();
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === "/api/auth/get-session")
        result.sessionRequests.push({
          status: response.status(),
          at: Date.now(),
        });
    });
    actors[role] = { context, page };
  }
  const choice = new URLSearchParams({
    learnerId: fixture.parent.learnerId,
    tutorSlug: fixture.tutor.slug,
    subjectSlug: "math",
    displayTimezone: "UTC",
  });
  const routes = [
    ["directory", "parent", "/tutors?subject=math&level=high_school"],
    [
      "timed-directory",
      "parent",
      "/tutors?subject=math&level=high_school&when=any&timezone=UTC",
    ],
    ["booking", "parent", `/bookings/new?${choice}`],
    [
      "reschedule",
      "parent",
      `/bookings/${fixture.parent.bookingId}/reschedule?scope=guardian`,
    ],
    ["parent-dashboard", "parent", "/parent"],
    ["student-dashboard", "student", "/student"],
    ["tutor-dashboard", "tutor", "/tutor"],
  ];
  for (let iteration = 0; iteration < 7; iteration++) {
    for (const [operation, role, route] of routes) {
      const page = actors[role].page;
      const start = performance.now();
      const response = await page.goto(`${fixture.origin}${route}`, {
        waitUntil: "load",
      });
      const ms = performance.now() - start;
      // The load event and complete navigation response are separate metrics;
      // neither is a claim that React hydration or every later task has settled.
      if (
        response?.status() !== 200 ||
        new URL(page.url()).pathname === "/sign-in"
      )
        throw new Error(
          `Current workflow ${operation} failed HTTP ${response?.status()}`,
        );
      const timing = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        return {
          responseMs: navigation.responseEnd - navigation.startTime,
          domMs: navigation.domContentLoadedEventEnd - navigation.startTime,
        };
      });
      if (iteration > 0)
        result.pages.push({ operation, iteration, ms, ...timing });
    }
  }
  // Keep two visible documents for each role: no DevTools or visibility override.
  for (const role of ["parent", "student", "tutor"]) {
    const page = await actors[role].context.newPage();
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === "/api/auth/get-session")
        result.sessionRequests.push({
          status: response.status(),
          at: Date.now(),
        });
    });
    await page.goto(`${fixture.origin}/${role}`, { waitUntil: "load" });
  }
  result.idle.start = Date.now();
  await delay(65000);
  result.idle.end = Date.now();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 1,
  });
  contexts.push(mobile);
  const home = await mobile.newPage();
  await home.addInitScript(() => {
    window.__perfLongTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        window.__perfLongTasks.push(entry.duration);
    }).observe({ type: "longtask", buffered: true });
  });
  await home.goto(fixture.origin, { waitUntil: "load" });
  const frames = await home.evaluate(async () => {
    const intervals = [];
    let prior = performance.now();
    for (let step = 0; step < 120; step++) {
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      intervals.push(now - prior);
      prior = now;
      window.scrollTo(0, step * 20);
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: step % 390,
          clientY: 200,
          bubbles: true,
        }),
      );
    }
    return {
      intervals,
      longTasks: window.__perfLongTasks,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  result.responsiveness.push({ viewport: "390x844", ...frames });
  result.ended = Date.now();
  writeFileSync(
    `.local/performance-${label}.json`,
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
  console.log(
    `Recorded ${result.pages.length} current-workflow page samples and six-tab idle period (${label}).`,
  );
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}
