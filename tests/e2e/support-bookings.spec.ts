import { enrollBrowserAdmin } from "../support/browser-admin-mfa";
import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import {
  familyLearner,
  familyTutor,
  familyReservation,
} from "../support/family-fixtures";
import {
  assignFixtureCase,
  authorizeFixtureReviewer,
} from "../../src/features/support/fixture-tooling";
const baseURL = process.env.APP_URL!;
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const ownedTutors: string[] = [];
async function actor(browser: Browser, role = "parent") {
  const context = await browser.newContext({ baseURL });
  const email = `support-booking-${randomUUID()}@learli.test`,
    password = "Synthetic-only-browser-123";
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic support participant" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES ($1,$2)",
    [id, role],
  );
  expect(
    (
      await context.request.post("/api/auth/sign-in/email", {
        headers: { origin: baseURL },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  if (role === "admin") await enrollBrowserAdmin(context, password);
  return { context, id, page: await context.newPage() };
}
async function reservation(actorId: string, expired = false) {
  const learnerId = await familyLearner(
    owner.pool,
    actorId,
    "guardian",
    "PRIVATE FAMILY NAME NEVER SHOWN IN SUPPORT",
  );
  const tutorId = await familyTutor(owner.pool);
  ownedTutors.push(tutorId);
  const bookingId = await familyReservation(owner.pool, {
    actorId,
    learnerId,
    tutorId,
    expired,
  });
  return { learnerId, bookingId };
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(async () => {
  if (ownedTutors.length)
    await owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=ANY($1::uuid[])",
      [ownedTutors],
    );
  await owner.pool.end();
});

test("participant form to exact reviewer retains minimal context, timezone, metadata and revocation privacy", async ({
  browser,
}, info) => {
  const user = await actor(browser),
    staff = await actor(browser, "admin");
  await authorizeFixtureReviewer(owner, staff.id);
  const { bookingId, learnerId } = await reservation(user.id);
  const page = user.page;
  await page.goto(`/contact?bookingId=${bookingId}`);
  await expect(
    page.getByRole("heading", { name: "Related simulated booking" }),
  ).toBeVisible();
  await expect(
    page.getByText("PRIVATE FAMILY NAME NEVER SHOWN IN SUPPORT"),
  ).toHaveCount(0);
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [768, 900],
    [1024, 900],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
  }
  await page
    .getByLabel("Subject", { exact: true })
    .fill("Synthetic booking issue");
  await page
    .getByLabel("Fictional description")
    .fill("Fictional local coordination issue only");
  await page
    .getByRole("button", { name: "Save fictional report", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/support\/[a-f0-9-]+$/);
  const id = page.url().split("/").pop()!;
  await assignFixtureCase(owner, id, staff.id);
  await owner.pool.query('UPDATE "user" SET timezone=$1 WHERE id=$2', [
    "America/Los_Angeles",
    staff.id,
  ]);
  await staff.page.goto(`/admin/support/${id}`);
  await expect(
    staff.page.getByRole("heading", { name: "Related simulated booking" }),
  ).toBeVisible();
  await expect(staff.page.getByText(/Pacific Time/).first()).toBeVisible();
  await expect(staff.page.getByText("Learner", { exact: true })).toHaveCount(0);
  await expect(
    staff.page.getByText("PRIVATE FAMILY NAME NEVER SHOWN IN SUPPORT"),
  ).toHaveCount(0);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await staff.page.setViewportSize({ width, height: 900 });
    await accessible(staff.page);
    if ([390, 1440].includes(width))
      await staff.page.screenshot({
        path: info.outputPath(`linked-case-${width}.png`),
        fullPage: true,
      });
  }
  await staff.page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await staff.page.setViewportSize({ width: 640, height: 400 });
  await accessible(staff.page);
  await staff.page.emulateMedia({
    forcedColors: "none",
    reducedMotion: "no-preference",
  });
  const response = await staff.context.request.get(`/api/admin/support/${id}`);
  expect(response.headers()["cache-control"]).toContain("private, no-store");
  const body = await response.text();
  for (const value of [
    learnerId,
    user.id,
    bookingId,
    "PRIVATE FAMILY NAME",
    "meetingUrl",
    "notification",
  ])
    expect(body).not.toContain(value);
  expect(await staff.page.title()).toBe("Support case | Learli");
  const html = await staff.context.request.get(`/admin/support/${id}`);
  expect(html.headers()["cache-control"]).toContain("no-store");
  expect(await html.text()).toContain("noindex");
  await owner.pool.query(
    "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
    [user.id, learnerId],
  );
  await staff.page.reload();
  await expect(
    staff.page.getByText(/Booking context is unavailable/),
  ).toBeVisible();
  await expect(staff.page.getByText("Tutor", { exact: true })).toHaveCount(0);
  await user.page.reload();
  await expect(
    user.page.getByText(/Booking context is unavailable/),
  ).toBeVisible();
  await user.page.goto(`/contact?bookingId=${bookingId}`);
  await expect(
    user.page.getByRole("heading", { name: "Booking context unavailable" }),
  ).toBeVisible();
  await expect(
    user.page.getByRole("button", { name: "Save fictional report" }),
  ).toHaveCount(0);
  await Promise.all([user.context.close(), staff.context.close()]);
});

test("wrong owner guessed booking and reassigned reviewer cannot disclose booking context", async ({
  browser,
}) => {
  const user = await actor(browser),
    foreign = await actor(browser),
    staff = await actor(browser, "admin"),
    next = await actor(browser, "admin");
  await authorizeFixtureReviewer(owner, staff.id);
  await authorizeFixtureReviewer(owner, next.id);
  const { bookingId } = await reservation(user.id);
  for (const id of [bookingId, randomUUID(), "not-a-uuid"]) {
    await foreign.page.goto(`/contact?bookingId=${id}`);
    await expect(
      foreign.page.getByRole("heading", {
        name: "Booking context unavailable",
      }),
    ).toBeVisible();
    await expect(foreign.page.getByText("Tutor", { exact: true })).toHaveCount(
      0,
    );
  }
  const saved = await user.context.request.post("/api/support", {
    headers: { origin: baseURL },
    data: {
      requestKey: randomUUID(),
      category: "general",
      subject: "Synthetic assignment case",
      body: "Fictional only",
      bookingId,
    },
  });
  expect(saved.status()).toBe(200);
  const id = (await saved.json()).id;
  await assignFixtureCase(owner, id, staff.id);
  await staff.page.goto(`/admin/support/${id}`);
  await expect(
    staff.page.getByRole("heading", { name: "Related simulated booking" }),
  ).toBeVisible();
  await assignFixtureCase(owner, id, next.id);
  await staff.page.reload();
  await expect(
    staff.page.getByRole("heading", { name: "Case unavailable" }),
  ).toBeVisible();
  await expect(staff.page.getByText("Math", { exact: true })).toHaveCount(0);
  await next.page.goto(`/admin/support/${id}`);
  await expect(
    next.page.getByRole("heading", { name: "Related simulated booking" }),
  ).toBeVisible();
  const anon = await browser.newContext({ baseURL });
  expect((await anon.request.get(`/api/support/${id}`)).status()).toBe(401);
  for (const route of ["/", "/tutors", "/contact"])
    expect(await (await anon.request.get(route)).text()).not.toContain(
      "Synthetic assignment case",
    );
  await Promise.all([
    user.context.close(),
    foreign.context.close(),
    staff.context.close(),
    next.context.close(),
    anon.close(),
  ]);
});

test("linked submission pending and service refusal preserve fields; expired context uses stored history", async ({
  browser,
}) => {
  const user = await actor(browser);
  const { bookingId } = await reservation(user.id, true);
  const page = user.page;
  await page.goto(`/contact?bookingId=${bookingId}`);
  await expect(
    page.getByText("Simulation expired", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Simulation created", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Simulation expiry saved", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Subject", { exact: true }).fill("Synthetic retry");
  await page.getByLabel("Fictional description").fill("Fictional only");
  await page.route("**/api/support", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message: "This service is unavailable. Try again later.",
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Save fictional report", exact: true })
    .click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Try again later",
  );
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Synthetic retry",
  );
  await page.unroute("**/api/support");
  const blocker = await owner.pool.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      [`support:${user.id}`],
    );
    await page
      .getByRole("button", { name: "Save fictional report", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Saving fictional report…" }),
    ).toBeVisible();
    await blocker.query("COMMIT");
    await expect(page).toHaveURL(/\/support\/[a-f0-9-]+$/);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
  await expect(
    page.getByRole("heading", { name: "Synthetic retry", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Support case | Learli");
  await accessible(page);
  await user.context.close();
});

test("without JavaScript report text cannot enter a navigation URL", async ({
  browser,
}) => {
  const user = await actor(browser);
  const { bookingId } = await reservation(user.id);
  const context = await browser.newContext({
    baseURL,
    storageState: await user.context.storageState(),
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  const marker = `synthetic-private-report-${randomUUID()}`;
  const navigations: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest()) navigations.push(request.url());
  });
  await page.goto(`/contact?bookingId=${bookingId}`);
  await expect(
    page.getByText("Saving fictional reports requires JavaScript.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Related simulated booking" }),
  ).toBeVisible();
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  await expect(
    page.getByRole("button", { name: "Save fictional report" }),
  ).toBeDisabled();
  await page.getByLabel("Subject", { exact: true }).fill(marker);
  await page.getByLabel("Fictional description").fill(marker);
  await page.getByLabel("Subject", { exact: true }).press("Enter");
  expect(new URL(page.url()).searchParams.has("subject")).toBe(false);
  // Exercise the browser's native fallback even if a pre-hydration submit is
  // forced. The page does not support native mutations and must send POST.
  const request = page.waitForRequest(
    (item) => item.isNavigationRequest() && item.method() === "POST",
  );
  await page
    .locator("form")
    .evaluate((form) => HTMLFormElement.prototype.submit.call(form));
  const nativeSubmission = await request;
  expect(nativeSubmission.postData()).toContain(marker);
  expect(navigations.every((url) => !url.includes(marker))).toBe(true);
  expect(new URL(nativeSubmission.url()).searchParams.has("body")).toBe(false);
  expect(
    (
      await owner.pool.query(
        "SELECT count(*)::int AS count FROM support_cases WHERE subject=$1",
        [marker],
      )
    ).rows[0].count,
  ).toBe(0);
  await context.close();
  await user.context.close();
});
