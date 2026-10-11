import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";

// Only synthetic data. Auth cookies/passwords are never captured in traces.
test.use({ trace: "off", screenshot: "off" });
const baseURL = process.env.APP_URL!;
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const password = "Synthetic-browser-learner-passphrase-123";
async function actor(
  browser: Browser,
  role: "parent" | "student" | "tutor",
  profiles = 0,
) {
  const context = await browser.newContext({ baseURL });
  const email = `learner-${randomUUID()}@learli.test`;
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic test account" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query(
    'UPDATE "user" SET email_verified = true WHERE id = $1',
    [id],
  );
  await owner.pool.query(
    "INSERT INTO user_roles (user_id, role) VALUES ($1,$2)",
    [id, role],
  );
  const signIn = await context.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL },
    data: { email, password },
  });
  expect(signIn.status()).toBe(200);
  const ids: string[] = [];
  for (let ordinal = 0; ordinal < profiles; ordinal++) {
    const result = await owner.pool.query(
      "INSERT INTO learner_profiles (fixture_key,source,management,user_id,display_name,level,timezone) VALUES ($1,'local_fixture',$2,$3,$4,$5,'Asia/Manila') RETURNING id",
      [
        randomUUID(),
        role === "student" ? "self" : "guardian",
        role === "student" ? id : null,
        `Synthetic private learner ${ordinal}`,
        role === "student" ? "college_support" : "elementary",
      ],
    );
    const learnerId = result.rows[0].id as string;
    if (role === "parent")
      await owner.pool.query(
        "INSERT INTO guardian_learner_links (guardian_user_id,learner_id,source,status) VALUES ($1,$2,'local_fixture','authorized')",
        [id, learnerId],
      );
    ids.push(learnerId);
  }
  return { context, page: await context.newPage(), id, ids };
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
// Reset only synthetic test throttle counters; application rate limits stay enabled.
test.beforeEach(async () => {
  await owner.pool.query("UPDATE rate_limit SET count = 0");
});
test.afterAll(() => owner.pool.end());

test("parent lists and edits authorized profiles with keyboard, responsive validation and error states", async ({
  browser,
}, info) => {
  const parent = await actor(browser, "parent", 2);
  const page = parent.page;
  await page.goto("/parent");
  await page.getByRole("link", { name: "Your learners", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /Edit profile for/ }),
  ).toHaveCount(2);
  await page
    .getByRole("link", { name: "Edit profile for Synthetic private learner 0" })
    .click();
  await expect(page).toHaveTitle("Edit learner profile | Learli");
  const longName =
    "Synthetic Álex María With A Long Multiword Learner Display Name For Testing";
  await page.getByLabel("Display name", { exact: true }).fill(longName);
  await page.getByLabel("Level", { exact: true }).selectOption("high_school");
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("America/New_York");
  await page.getByRole("button", { name: "Save profile", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Profile saved" }),
  ).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    longName,
  );
  await expect(page.getByLabel("Level", { exact: true })).toHaveValue(
    "high_school",
  );
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "America/New_York",
  );
  for (const [width, height] of [
    [390, 844],
    [320, 720],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole("button", { name: "Save profile", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Loading learner profiles…", { exact: true }),
    ).toHaveCount(0);
    await accessible(page);
    await page.screenshot({
      path: info.outputPath(`learner-form-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByLabel("Display name", { exact: true }).fill(" ");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Enter a display name.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "Profile could not be saved" }),
  ).toBeFocused();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic unsaved value");
  await page.route("**/api/learners/*", (route) => route.abort());
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Profile could not be saved" }),
  ).toContainText("Check your connection");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Synthetic unsaved value",
  );
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("learner-save-error.png"),
    fullPage: true,
  });
  await parent.context.close();
});

test("self learner needs no guardian and foreign records stay private", async ({
  browser,
}, info) => {
  const self = await actor(browser, "student", 1);
  const parent = await actor(browser, "parent", 1);
  const page = self.page;
  await page.goto("/student");
  await page.getByRole("link", { name: "Your learners", exact: true }).click();
  await page.getByRole("link", { name: /Edit profile for/ }).click();
  await expect(page.getByLabel("Level", { exact: true })).toHaveValue(
    "college_support",
  );
  await expect(
    page.getByLabel("Level", { exact: true }).locator("option"),
  ).toHaveCount(1);
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic independent learner");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Profile saved" }),
  ).toBeVisible();
  const own = await page.request.get(`/api/learners/${self.ids[0]}`);
  expect(own.headers()["cache-control"]).toContain("private, no-store");
  const html = await page.request.get(`/learners/${self.ids[0]}`);
  expect(html.headers()["cache-control"]).toContain("no-store");
  expect(
    (await html.text()).match(/<meta name="robots"[^>]+>/g)?.join(),
  ).toContain("noindex");
  await parent.page.goto(`/learners/${self.ids[0]}`);
  await expect(
    parent.page.getByRole("heading", { name: "Learner profile unavailable" }),
  ).toBeVisible();
  await expect(
    parent.page.getByText("Synthetic independent learner"),
  ).toHaveCount(0);
  expect(
    (
      await parent.page.request.patch(`/api/learners/${self.ids[0]}`, {
        headers: { origin: baseURL },
        data: {
          displayName: "Forged",
          level: "college_support",
          timezone: "UTC",
        },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post("/api/learners", {
        headers: { origin: baseURL },
        data: { learnerId: parent.ids[0] },
      })
    ).status(),
  ).toBe(405);
  const anonymous = await browser.newContext({ baseURL });
  const visitor = await anonymous.newPage();
  await visitor.goto(`/learners/${self.ids[0]}`);
  await expect(visitor).toHaveURL(/\/sign-in\?next=/);
  for (const route of ["/", "/tutors", "/subjects"])
    expect(await (await anonymous.request.get(route)).text()).not.toContain(
      "Synthetic independent learner",
    );
  await parent.page.setViewportSize({ width: 390, height: 844 });
  await accessible(parent.page);
  await parent.page.screenshot({
    path: info.outputPath("learner-unavailable.png"),
    fullPage: true,
  });
  await Promise.all([
    self.context.close(),
    parent.context.close(),
    anonymous.close(),
  ]);
});

test("empty profiles, wrong-role and suspended access are honest", async ({
  browser,
}, info) => {
  const parent = await actor(browser, "parent");
  const tutor = await actor(browser, "tutor");
  await parent.page.goto("/learners");
  await expect(
    parent.page.getByRole("heading", { name: "No learner profiles available" }),
  ).toBeVisible();
  await parent.page.setViewportSize({ width: 390, height: 844 });
  await accessible(parent.page);
  await parent.page.screenshot({
    path: info.outputPath("learner-empty.png"),
    fullPage: true,
  });
  await tutor.page.goto("/learners");
  await expect(
    tutor.page.getByRole("heading", { name: "Learner profiles unavailable" }),
  ).toBeVisible();
  await owner.pool.query(
    "UPDATE user_access SET status='suspended' WHERE user_id=$1",
    [parent.id],
  );
  await parent.page.reload();
  await expect(
    parent.page.getByRole("heading", { name: "Learner profiles unavailable" }),
  ).toBeVisible();
  await Promise.all([parent.context.close(), tutor.context.close()]);
});
