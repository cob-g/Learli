import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import {
  familyLearner,
  familyReservation,
  familyTutor,
} from "../support/family-fixtures";

test.use({ trace: "off", screenshot: "off" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const baseURL = process.env.APP_URL!;
async function actor(
  browser: Browser,
  role: "student" | "parent",
  noJs = false,
) {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: !noJs,
  });
  const email = `family-${randomUUID()}@learli.test`;
  const password = "Synthetic-family-test-passphrase-123";
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic family actor" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query(
    'UPDATE "user" SET email_verified=true,timezone=$2 WHERE id=$1',
    [id, "America/New_York"],
  );
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
  return { id, context, page: await context.newPage() };
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
test.afterAll(() => owner.pool.end());

test("parent filters currently linked learners without JavaScript and sees private simulated history", async ({
  browser,
}, info) => {
  const parent = await actor(browser, "parent", true);
  const alex = await familyLearner(
    owner.pool,
    parent.id,
    "guardian",
    "Synthetic dashboard Alex",
  );
  const zoe = await familyLearner(
    owner.pool,
    parent.id,
    "guardian",
    "Synthetic dashboard Zoë",
  );
  const tutor = await familyTutor(owner.pool);
  await familyReservation(owner.pool, {
    actorId: parent.id,
    learnerId: alex,
    tutorId: tutor,
  });
  await familyReservation(owner.pool, {
    actorId: parent.id,
    learnerId: zoe,
    tutorId: tutor,
    startMinutes: 360,
  });
  const expired = await familyReservation(owner.pool, {
    actorId: parent.id,
    learnerId: zoe,
    tutorId: tutor,
    expired: true,
    startMinutes: 540,
  });
  await parent.page.goto("/parent");
  await expect(
    parent.page.getByRole("radio", { name: "All learners" }),
  ).toBeChecked();
  await expect(
    parent.page.getByText("For Synthetic dashboard Alex"),
  ).toBeVisible();
  await expect(
    parent.page.getByText("For Synthetic dashboard Zoë"),
  ).toHaveCount(2);
  await expect(
    parent.page.getByText("Simulation expired", { exact: true }),
  ).toBeVisible();
  // Real no-JS assertions/screenshots stay above/below. Axe's injected script
  // runs in an equivalent authenticated JS-enabled context.
  const auditContext = await browser.newContext({
    baseURL,
    storageState: await parent.context.storageState(),
  });
  const auditPage = await auditContext.newPage();
  await auditPage.goto("/parent");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await parent.page.setViewportSize({
      width,
      height: width >= 768 ? 900 : 844,
    });
    await auditPage.setViewportSize({
      width,
      height: width >= 768 ? 900 : 844,
    });
    await accessible(auditPage);
    if (width === 390 || width === 1440)
      await parent.page.screenshot({
        path: info.outputPath(`family-parent-${width}.png`),
        fullPage: true,
      });
  }
  await parent.page
    .getByRole("radio", { name: /Synthetic dashboard Alex/ })
    .focus();
  await parent.page.keyboard.press("Space");
  await parent.page.getByRole("button", { name: "Show bookings" }).click();
  await expect(parent.page.getByRole("heading", { level: 1 })).toHaveText(
    "Parent Dashboard",
  );
  await expect(
    parent.page.getByText("Bookings for Synthetic dashboard Alex", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    parent.page.getByText("For Synthetic dashboard Zoë"),
  ).toHaveCount(0);
  await expect(
    parent.page.getByText("No reservation history yet.", { exact: false }),
  ).toBeVisible();
  await parent.page.goto(`/parent?learner=${zoe}`);
  await parent.page
    .getByRole("link", { name: /View booking for Synthetic dashboard Zoë/ })
    .last()
    .click();
  await expect(parent.page).toHaveURL(
    new RegExp(`/bookings/${expired}\\?scope=guardian`),
  );
  await expect(
    parent.page.getByRole("heading", { name: "Booking details", exact: true }),
  ).toBeVisible();
  await expect(
    parent.page.getByText("Simulation expired", { exact: true }),
  ).toBeVisible();
  await expect(
    parent.page.getByText("Synthetic dashboard Zoë · Elementary", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    parent.page.getByRole("link", { name: /Join on|Cancel lesson|Pay/ }),
  ).toHaveCount(0);
  await parent.page.setViewportSize({ width: 390, height: 844 });
  await auditPage.goto(parent.page.url());
  await auditPage.setViewportSize({ width: 390, height: 844 });
  await accessible(auditPage);
  await parent.page.screenshot({
    path: info.outputPath("family-linked-detail-phone.png"),
    fullPage: true,
  });
  await parent.page.getByRole("link", { name: "Go to your bookings" }).click();
  await parent.page.getByLabel("Learner", { exact: true }).selectOption("");
  await parent.page.getByRole("button", { name: "Apply booking view" }).click();
  await expect(
    parent.page.getByRole("heading", { name: "Your bookings", exact: true }),
  ).toBeVisible();
  await expect(
    parent.page.getByRole("link", { name: /View booking for/ }),
  ).toHaveCount(3);
  const html = await parent.context.request.get("/parent");
  expect(html.headers()["cache-control"]).toContain("no-store");
  const source = await html.text();
  expect(source.match(/<meta name="robots"[^>]+>/g)?.join()).toContain(
    "noindex",
  );
  expect(source.match(/<title>[^<]+/g)?.join()).not.toContain(
    "Synthetic dashboard",
  );
  await Promise.all([parent.context.close(), auditContext.close()]);
});

test("multi-role student sees only own self-managed learner and parent only guardian learners", async ({
  browser,
}, info) => {
  const self = await actor(browser, "student");
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES ($1,'parent')",
    [self.id],
  );
  const selfId = await familyLearner(
    owner.pool,
    self.id,
    "self",
    "Synthetic independent dashboard",
  );
  const childId = await familyLearner(
    owner.pool,
    self.id,
    "guardian",
    "Synthetic guardian dashboard",
  );
  const tutor = await familyTutor(owner.pool);
  await familyReservation(owner.pool, {
    actorId: self.id,
    learnerId: selfId,
    tutorId: tutor,
  });
  await familyReservation(owner.pool, {
    actorId: self.id,
    learnerId: childId,
    tutorId: tutor,
    startMinutes: 360,
  });
  await self.page.goto("/student");
  await expect(self.page.getByRole("heading", { level: 1 })).toHaveText(
    "Your bookings",
  );
  await expect(self.page.getByRole("radio")).toHaveCount(0);
  await expect(
    self.page.getByRole("link", {
      name: /View booking for Synthetic independent/,
    }),
  ).toHaveCount(1);
  expect(await self.page.locator("main").innerText()).not.toContain(
    "Synthetic guardian dashboard",
  );
  const noJs = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    storageState: await self.context.storageState(),
  });
  const noJsStudent = await noJs.newPage();
  await noJsStudent.goto("/student");
  await expect(
    noJsStudent.getByRole("heading", { name: "Your bookings", exact: true }),
  ).toBeVisible();
  await expect(
    noJsStudent.getByRole("link", {
      name: /View booking for Synthetic independent/,
    }),
  ).toBeVisible();
  await noJs.close();
  await self.page.setViewportSize({ width: 390, height: 844 });
  await accessible(self.page);
  await self.page.screenshot({
    path: info.outputPath("family-student-phone.png"),
    fullPage: true,
  });
  await self.page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await self.page.setViewportSize({ width: 640, height: 400 });
  await accessible(self.page);
  await self.page.screenshot({
    path: info.outputPath("family-forced-reflow.png"),
    fullPage: true,
  });
  await self.page.goto("/parent");
  await expect(self.page.getByRole("heading", { level: 1 })).toHaveText(
    "Parent Dashboard",
  );
  await expect(
    self.page.getByText("Bookings for Synthetic guardian dashboard", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await self.page.locator("main").innerText()).not.toContain(
    "Synthetic independent dashboard",
  );
  await self.context.close();
});

test("foreign, revoked, archived and unavailable states never leak unrelated learner data", async ({
  browser,
}, info) => {
  const parent = await actor(browser, "parent");
  const other = await actor(browser, "parent");
  const hidden = await familyLearner(
    owner.pool,
    other.id,
    "guardian",
    "Synthetic hidden dashboard learner",
  );
  await parent.page.goto(`/parent?learner=${hidden}`);
  await expect(
    parent.page.getByRole("heading", { name: "Parent Dashboard unavailable" }),
  ).toBeVisible();
  expect(await parent.page.locator("main").innerText()).not.toContain(
    "Synthetic hidden dashboard learner",
  );
  await parent.page.goto("/parent?learner=invalid");
  await expect(
    parent.page.getByRole("heading", { name: "Parent Dashboard unavailable" }),
  ).toBeVisible();
  await parent.page.setViewportSize({ width: 390, height: 844 });
  await accessible(parent.page);
  await parent.page.screenshot({
    path: info.outputPath("family-unavailable-phone.png"),
    fullPage: true,
  });
  await parent.page.goto("/parent");
  await expect(
    parent.page.getByRole("heading", {
      name: "No authorized learner available",
    }),
  ).toBeVisible();
  await parent.page.screenshot({
    path: info.outputPath("family-no-learner-phone.png"),
    fullPage: true,
  });
  const own = await familyLearner(
    owner.pool,
    parent.id,
    "guardian",
    "Synthetic removed dashboard learner",
  );
  const archive = await familyLearner(
    owner.pool,
    parent.id,
    "guardian",
    "Synthetic archived dashboard learner",
  );
  await owner.pool.query(
    "UPDATE guardian_learner_links SET status='revoked' WHERE learner_id=$1",
    [own],
  );
  await owner.pool.query(
    "UPDATE learner_profiles SET status='inactive' WHERE id=$1",
    [archive],
  );
  await parent.page.reload();
  expect(await parent.page.locator("main").innerText()).not.toContain(
    "Synthetic removed dashboard learner",
  );
  expect(await parent.page.locator("main").innerText()).not.toContain(
    "Synthetic archived dashboard learner",
  );
  await familyLearner(
    owner.pool,
    parent.id,
    "guardian",
    "Synthetic empty dashboard learner",
  );
  await parent.page.reload();
  await expect(
    parent.page.getByText(/No active simulated reservations\./),
  ).toBeVisible();
  await parent.page.screenshot({
    path: info.outputPath("family-no-reservations-phone.png"),
    fullPage: true,
  });
  await owner.pool.query(
    "UPDATE user_access SET status='suspended' WHERE user_id=$1",
    [parent.id],
  );
  await parent.page.reload();
  await expect(
    parent.page.getByRole("heading", { name: "Parent Dashboard unavailable" }),
  ).toBeVisible();
  const visitor = await browser.newContext({ baseURL });
  const page = await visitor.newPage();
  await page.goto("/student");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  for (const path of ["/", "/tutors", "/subjects"])
    expect(await (await visitor.request.get(path)).text()).not.toContain(
      "Synthetic hidden dashboard learner",
    );
  await Promise.all([
    parent.context.close(),
    other.context.close(),
    visitor.close(),
  ]);
});

test("TTL refresh projects expiry without mutations and GET controls show honest pending feedback", async ({
  browser,
}, info) => {
  const parent = await actor(browser, "parent");
  const learner = await familyLearner(
    owner.pool,
    parent.id,
    "guardian",
    "Synthetic expiring dashboard learner",
  );
  const tutor = await familyTutor(owner.pool);
  const id = await familyReservation(owner.pool, {
    actorId: parent.id,
    learnerId: learner,
    tutorId: tutor,
    expiresInSeconds: 5,
  });
  // Device wall-clock skew must not alter server status or refresh timing.
  await parent.page.addInitScript(() => {
    const actualNow = Date.now.bind(Date);
    Date.now = () => actualNow() + 3_600_000;
  });
  await parent.page.goto("/parent");
  await expect(
    parent.page.getByText("Simulated reservation", { exact: true }),
  ).toBeVisible();
  await expect(
    parent.page.getByText("Simulation expired", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    parent.page.getByRole("heading", { name: "Next simulated reservation" }),
  ).toHaveCount(0);
  const saved = await owner.pool.query(
    "SELECT state,(SELECT count(*)::int FROM booking_events WHERE booking_id=$1) AS events FROM bookings WHERE id=$1",
    [id],
  );
  expect(saved.rows[0].state).toBe("demo_reserved");
  expect(saved.rows[0].events).toBe(1);
  await parent.page.setViewportSize({ width: 390, height: 844 });
  await accessible(parent.page);
  await parent.page.screenshot({
    path: info.outputPath("family-expired-phone.png"),
    fullPage: true,
  });
  await familyLearner(
    owner.pool,
    parent.id,
    "guardian",
    "Synthetic second pending learner",
  );
  await parent.page.reload();
  await parent.page
    .getByRole("radio", { name: /Synthetic expiring dashboard learner/ })
    .check();
  const blocker = await owner.pool.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query('LOCK TABLE "user" IN ACCESS EXCLUSIVE MODE');
    await parent.page
      .getByRole("button", { name: "Show bookings" })
      .click({ noWaitAfter: true });
    await expect(
      parent.page
        .getByRole("status")
        .filter({ hasText: "Loading your bookings" }),
    ).toHaveCount(1);
    await parent.page.screenshot({
      path: info.outputPath("family-pending-phone.png"),
      fullPage: true,
    });
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
  await expect(
    parent.page.getByText("Bookings for Synthetic expiring dashboard learner", {
      exact: true,
    }),
  ).toBeVisible();
  await parent.page.goBack();
  await expect(
    parent.page.getByRole("radio", { name: "All learners" }),
  ).toBeChecked();
  await expect(
    parent.page
      .getByRole("status")
      .filter({ hasText: "Loading your bookings" }),
  ).toHaveCount(0);
  // A relationship revoked while a real read waits must not survive that read.
  await parent.page
    .getByRole("radio", { name: /Synthetic expiring dashboard learner/ })
    .check();
  const revoke = await owner.pool.connect();
  try {
    await revoke.query("BEGIN");
    await revoke.query('LOCK TABLE "user" IN ACCESS EXCLUSIVE MODE');
    await parent.page.getByRole("button", { name: "Show bookings" }).click();
    await expect(
      parent.page
        .getByRole("status")
        .filter({ hasText: "Loading your bookings" }),
    ).toBeVisible();
    await revoke.query(
      "UPDATE guardian_learner_links SET status='revoked' WHERE learner_id=$1",
      [learner],
    );
    await revoke.query("COMMIT");
  } finally {
    await revoke.query("ROLLBACK");
    revoke.release();
  }
  await expect(
    parent.page.getByRole("heading", { name: "Parent Dashboard unavailable" }),
  ).toBeVisible();
  expect(await parent.page.locator("main").innerText()).not.toContain(
    "Synthetic expiring dashboard learner",
  );
  await parent.context.close();
});
