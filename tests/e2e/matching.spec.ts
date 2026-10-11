import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../../src/lib/db/connection";

test.use({ trace: "off", screenshot: "off" });
test.describe.configure({ mode: "serial" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const slug = `matching-${randomUUID()}`;
const name = "Synthetic matching college tutor";
let profileId: string;
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
test.beforeAll(async () => {
  const id = randomUUID();
  await owner.pool.query(
    'INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at) VALUES ($1,$2,$3,true,now(),now())',
    [id, name, `matching-${id}@learli.test`],
  );
  await owner.pool.query("INSERT INTO user_access(user_id) VALUES ($1)", [id]);
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES ($1,'tutor')",
    [id],
  );
  profileId = (
    await owner.pool.query(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,'Synthetic tutor','Fictional local profile.','Synthetic only.','Asia/Manila','approved') RETURNING id",
      [id, slug],
    )
  ).rows[0].id;
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['college_support']::text[] FROM subjects WHERE slug='math'",
    [profileId],
  );
  await owner.pool.query(
    "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT $1,day,0,1440 FROM generate_series(1,7) day",
    [profileId],
  );
});
test.afterAll(async () => {
  await owner.pool.query(
    "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
    [profileId],
  );
  await owner.pool.end();
});

test("three questions restore URL answers, filter real times, and render across viewports", async ({
  browser,
}, info) => {
  const context = await browser.newContext({ timezoneId: "Asia/Manila" });
  const page = await context.newPage();
  await page.goto("/get-matched");
  await expect(page.getByText("Question 1 of 3")).toBeVisible();
  await page.getByLabel("College Support", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Question 2 of 3")).toBeVisible();
  await page.getByLabel("Math", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Question 3 of 3")).toBeVisible();
  await expect(page.getByLabel("Your time zone")).toHaveValue("Asia/Manila");
  await page.getByLabel("Preferred days and times", { exact: true }).check();
  await page.getByLabel("Monday", { exact: true }).check();
  await page
    .getByLabel("Morning (6:00 AM – 12:00 PM)", { exact: true })
    .check();
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [768, 900],
    [1024, 900],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: info.outputPath(`when-${width}.png`),
        fullPage: true,
      });
  }
  let resume!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  await page.route("**/get-matched?*", async (route) => {
    if (route.request().url().includes("submit=results")) await gate;
    await route.continue();
  });
  const submit = page
    .getByRole("button", { name: "Show matching tutors" })
    .click();
  try {
    // Locator actions wait for native navigation. Observe the still-visible
    // document while this navigation's response is intentionally held.
    await expect
      .poll(() =>
        page.evaluate(() => ({
          busy: [...document.querySelectorAll("form")]
            .find((form) => form.getBoundingClientRect().height > 0)
            ?.getAttribute("aria-busy"),
          action: [...document.querySelectorAll('button[type="submit"]')]
            .find((button) => button.getBoundingClientRect().height > 0)
            ?.textContent?.trim(),
        })),
      )
      .toEqual({ busy: "true", action: "Finding matching tutors…" });
  } finally {
    resume();
  }
  await submit;
  await page.unroute("**/get-matched?*");
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("teach");
  await expect(
    page
      .getByText("Has an open time within your chosen weekdays and time range.")
      .first(),
  ).toBeVisible();
  const resultURL = page.url();
  await page.goBack();
  await expect(page).toHaveURL(/days=1/);
  await expect(page.getByLabel("Monday", { exact: true })).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Show matching tutors" }),
  ).toBeVisible();
  await page.goto(resultURL);
  await page.reload();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
    if (width === 1440) {
      const leftEdges = await page
        .getByText("Next open time", { exact: true })
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().left),
        );
      expect(Math.max(...leftEdges) - Math.min(...leftEdges)).toBeLessThan(1);
    }
    await page.screenshot({
      path: info.outputPath(`results-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByRole("link", { name: "Change answers", exact: true }).click();
  await expect(page.getByLabel("Monday", { exact: true })).toBeChecked();
  await expect(
    page.getByLabel("Morning (6:00 AM – 12:00 PM)", { exact: true }),
  ).toBeChecked();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Math", { exact: true })).toBeChecked();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(
    page.getByLabel("College Support", { exact: true }),
  ).toBeChecked();
  await page.goto(resultURL);
  const html = await page.content();
  expect(html.includes("@learli.test")).toBe(false);
  expect(html.includes("learnerId")).toBe(false);
  expect(html.includes("requestFingerprint")).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.setViewportSize({ width: 640, height: 400 });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("results-forced-reflow.png"),
    fullPage: true,
  });
  await context.close();
});

test("Any time and Back work without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/get-matched");
  await page.getByLabel("College Support", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Math", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Your time zone").selectOption("America/Los_Angeles");
  await page.getByLabel("Any time", { exact: true }).check();
  await page.getByRole("button", { name: "Show matching tutors" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("link", { name: "Change answers", exact: true }).click();
  await expect(page.getByLabel("Any time", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Your time zone")).toHaveValue(
    "America/Los_Angeles",
  );
  await context.close();
});

test("invalid preferences retain safe answers, expose helpful errors and focus", async ({
  page,
}, info) => {
  await page.goto("/get-matched?level=invalid");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Choose a level",
  );
  await expect(page.locator('[name="level"]').first()).toBeFocused();
  await page.goto(
    "/get-matched?level=college_support&subject=math&timezone=UTC&when=preferred&days=1&range=bad&submit=results&learnerId=PRIVATE_CANARY",
  );
  await expect(
    page.getByText("Choose a time-of-day range", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[name="range"]').first()).toBeFocused();
  await expect(page.getByLabel("Monday", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Your time zone")).toHaveValue("UTC");
  expect((await page.content()).includes("PRIVATE_CANARY")).toBe(false);
  await page.getByLabel("Any time", { exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Show matching tutors" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  expect(page.url()).not.toContain("learnerId");
  await page.goto(
    "/get-matched?level=college_support&subject=science&timezone=UTC&when=any",
  );
  await expect(
    page.getByRole("heading", { name: "No tutors match your answers" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("empty-390.png"),
    fullPage: true,
  });
});

test("bounded catalog overflow is a retry state rather than a partial or empty match", async ({
  page,
}, info) => {
  const group = randomUUID();
  await owner.pool.query(
    "INSERT INTO \"user\" (id,name,email,email_verified,created_at,updated_at) SELECT $1 || n,'Synthetic bounded matching tutor', $1 || n || '@learli.test',true,now(),now() FROM generate_series(1,101) n",
    [group],
  );
  await owner.pool.query(
    'INSERT INTO user_access(user_id) SELECT id FROM "user" WHERE id LIKE $1',
    [`${group}%`],
  );
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) SELECT id,'tutor' FROM \"user\" WHERE id LIKE $1",
    [`${group}%`],
  );
  await owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) SELECT id,'bounded-'||id,'Synthetic','Fictional','Fixture','UTC','approved' FROM \"user\" WHERE id LIKE $1",
    [`${group}%`],
  );
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT p.id,s.id,ARRAY['college_support']::text[] FROM tutor_profiles p CROSS JOIN subjects s WHERE p.user_id LIKE $1 AND s.slug='math'",
    [`${group}%`],
  );
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      "/get-matched?level=college_support&subject=math&timezone=UTC&when=any",
    );
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "couldn't load matching times",
    );
    await expect(
      page.getByRole("link", { name: "Try again", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No tutors match your answers" }),
    ).toHaveCount(0);
    await accessible(page);
    await page.screenshot({
      path: info.outputPath("unavailable-390.png"),
      fullPage: true,
    });
  } finally {
    await owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE user_id LIKE $1",
      [`${group}%`],
    );
  }
});
