import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
test.use({ trace: "off", screenshot: "off" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const baseURL = process.env.APP_URL!;
const password = "Synthetic-booking-browser-passphrase-123";
async function fixture(
  browser: Browser,
  role: "parent" | "student" = "parent",
  profiles = 1,
) {
  const context = await browser.newContext({ baseURL });
  const email = `booking-${randomUUID()}@learli.test`;
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic booking account" },
  });
  expect(signup.status()).toBe(200);
  const userId = (await signup.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    userId,
  ]);
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES ($1,$2)",
    [userId, role],
  );
  expect(
    (
      await context.request.post("/api/auth/sign-in/email", {
        headers: { origin: baseURL },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  const ids: string[] = [];
  for (let i = 0; i < profiles; i++) {
    const result = await owner.pool.query(
      "INSERT INTO learner_profiles(fixture_key,source,management,user_id,display_name,level,timezone) VALUES ($1,'local_fixture',$2,$3,$4,$5,'Asia/Manila') RETURNING id",
      [
        randomUUID(),
        role === "student" ? "self" : "guardian",
        role === "student" ? userId : null,
        `Synthetic booking learner ${i}`,
        role === "student" ? "college_support" : "elementary",
      ],
    );
    ids.push(result.rows[0].id as string);
    if (role === "parent")
      await owner.pool.query(
        "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES ($1,$2,'local_fixture','authorized')",
        [userId, ids[i]],
      );
  }
  const tutorId = randomUUID();
  const slug = `browser-booking-${tutorId}`;
  await owner.pool.query(
    'INSERT INTO "user"(id,name,email,email_verified) VALUES ($1,$2,$3,true)',
    [
      tutorId,
      "Synthetic Zoë Müller-Castañeda With A Long Tutor Name",
      `tutor-${tutorId}@learli.test`,
    ],
  );
  await owner.pool.query("INSERT INTO user_access(user_id) VALUES ($1)", [
    tutorId,
  ]);
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES ($1,'tutor')",
    [tutorId],
  );
  const profile = await owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,'Synthetic tutoring','Synthetic tutor profile only.','Test fixture only.','Asia/Manila','approved') RETURNING id",
    [tutorId, slug],
  );
  const profileId = profile.rows[0].id as string;
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['elementary','college_support'] FROM subjects WHERE slug='math'",
    [profileId],
  );
  for (let day = 1; day <= 7; day++)
    await owner.pool.query(
      "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) VALUES ($1,$2,480,1200)",
      [profileId, day],
    );
  return {
    context,
    page: await context.newPage(),
    userId,
    ids,
    slug,
    profileId,
  };
}
async function choose(page: Page, slug: string, multiple = false) {
  await page.goto("/bookings/demo");
  await expect(page).toHaveTitle("Simulated booking | Learli");
  if (multiple) await page.locator('input[name="learner"]').first().check();
  await page.getByLabel("Tutor", { exact: true }).selectOption(slug);
  await page.getByLabel("Subject", { exact: true }).selectOption("math");
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("America/New_York");
  await page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  await expect(page.locator('input[name="time"]').first()).toBeVisible();
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

test("parent chooses linked learner and time by keyboard, recovers a lost response and stays accessible", async ({
  browser,
}, info) => {
  const actor = await fixture(browser, "parent", 2);
  const page = actor.page;
  await choose(page, actor.slug, true);
  const submit = page.getByRole("button", {
    name: "Create simulated reservation",
    exact: true,
  });
  await submit.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose who this lesson" }),
  ).toBeFocused();
  await page.locator('input[name="time"]').first().focus();
  await page.keyboard.press("Space");
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("booking-selected-phone.png"),
    fullPage: true,
  });
  let dropped = false;
  let firstKey = "";
  await page.route("**/api/bookings/demo", async (route) => {
    if (!dropped) {
      dropped = true;
      firstKey = route.request().postDataJSON().idempotencyKey;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort();
    } else {
      expect(route.request().postDataJSON().idempotencyKey).toBe(firstKey);
      await route.continue();
    }
  });
  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "request result is unknown" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Simulated reservation saved",
      exact: true,
    }),
  ).toBeFocused();
  await expect(page.getByText("Expires at", { exact: true })).toBeVisible();
  const saved = await owner.pool.query(
    "SELECT count(*)::int AS count FROM bookings WHERE tutor_id=$1",
    [actor.profileId],
  );
  expect(saved.rows[0].count).toBe(1);
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
    await page.screenshot({
      path: info.outputPath(`booking-saved-${width}.png`),
      fullPage: true,
    });
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 400 });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("booking-forced-reflow.png"),
    fullPage: true,
  });
  expect(
    (await actor.context.request.get("/bookings/demo")).headers()[
      "cache-control"
    ],
  ).toContain("no-store");
  await actor.context.close();
});

test("independent College Support learner books without guardian and stale selections fail safely", async ({
  browser,
}, info) => {
  const actor = await fixture(browser, "student");
  const page = actor.page;
  await choose(page, actor.slug);
  await expect(page.getByText(/Booking for you/)).toBeVisible();
  await page.locator('input[name="time"]').first().check();
  await owner.pool.query("DELETE FROM tutor_availability WHERE tutor_id=$1", [
    actor.profileId,
  ]);
  await page
    .getByRole("button", { name: "Create simulated reservation", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "no longer available" }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "No open times" }),
  ).toBeVisible();
  for (let day = 1; day <= 7; day++)
    await owner.pool.query(
      "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) VALUES ($1,$2,480,1200)",
      [actor.profileId, day],
    );
  await page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  await page.locator('input[name="time"]').first().check();
  await page
    .getByRole("button", { name: "Create simulated reservation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Simulated reservation saved",
      exact: true,
    }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("booking-self.png"),
    fullPage: true,
  });
  await actor.context.close();
});

test("empty/error/no-access states and API ownership keep learner data private", async ({
  browser,
}, info) => {
  const actor = await fixture(browser);
  const other = await fixture(browser, "parent", 0);
  const anonymous = await browser.newContext({ baseURL });
  const visitor = await anonymous.newPage();
  await visitor.goto("/bookings/demo");
  await expect(visitor).toHaveURL(/\/sign-in\?next=/);
  await other.page.goto("/bookings/demo");
  await expect(
    other.page.getByRole("heading", {
      name: "No authorized learner available",
    }),
  ).toBeVisible();
  await accessible(other.page);
  await other.page.screenshot({
    path: info.outputPath("booking-empty.png"),
    fullPage: true,
  });
  await choose(actor.page, actor.slug);
  await actor.page.route("**/api/bookings/demo/candidates?**", (route) =>
    route.abort(),
  );
  await actor.page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  await expect(
    actor.page.getByRole("alert").filter({ hasText: "could not be loaded" }),
  ).toBeFocused();
  await accessible(actor.page);
  const forged = await other.context.request.get(
    `/api/bookings/demo/candidates?${new URLSearchParams({ learnerId: actor.ids[0], tutorSlug: actor.slug, subjectSlug: "math", displayTimezone: "UTC" })}`,
  );
  expect(forged.status()).toBe(404);
  expect(await forged.text()).not.toContain(actor.ids[0]);
  const html = await actor.context.request.get("/bookings/demo");
  expect(
    (await html.text()).match(/<meta name="robots"[^>]+>/g)?.join(),
  ).toContain("noindex");
  for (const route of ["/", "/tutors", "/subjects"])
    expect(await (await anonymous.request.get(route)).text()).not.toContain(
      "Synthetic booking learner",
    );
  await owner.pool.query(
    "UPDATE user_access SET status='suspended' WHERE user_id=$1",
    [actor.userId],
  );
  await actor.page.reload();
  await expect(
    actor.page.getByRole("heading", { name: "Simulated bookings unavailable" }),
  ).toBeVisible();
  await accessible(actor.page);
  await Promise.all([
    actor.context.close(),
    other.context.close(),
    anonymous.close(),
  ]);
});
