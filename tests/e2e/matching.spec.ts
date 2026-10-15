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

test("six real preferred-time matches paginate without duplicates and retain URL history", async ({
  page,
}) => {
  const group = randomUUID();
  const subject = `matching-page-${group}`;
  const names = Array.from(
    { length: 6 },
    (_, i) =>
      `Synthetic matching pager tutor ${String(i + 1).padStart(2, "0")}`,
  );
  const identities = names.map(
    (_, i) => `/tutors/matching-page-${group}-${i + 1}`,
  );
  const parameters = new URLSearchParams({
    level: "college_support",
    subject,
    timezone: "Asia/Manila",
    when: "preferred",
    range: "morning",
  });
  parameters.append("days", "1");
  parameters.append("days", "3");
  const firstURL = `/get-matched?${parameters}`;
  const assertFilters = (href: string, expectedPage: number) => {
    const url = new URL(href, "http://127.0.0.1");
    expect(url.pathname).toBe("/get-matched");
    expect(url.searchParams.get("level")).toBe("college_support");
    expect(url.searchParams.get("subject")).toBe(subject);
    expect(url.searchParams.get("timezone")).toBe("Asia/Manila");
    expect(url.searchParams.get("when")).toBe("preferred");
    expect(url.searchParams.getAll("days")).toEqual(["1", "3"]);
    expect(url.searchParams.get("range")).toBe("morning");
    expect(Number(url.searchParams.get("page") ?? "1")).toBe(expectedPage);
  };
  const profileLinks = page.getByRole("link", { name: /^View profile:/ });
  const assertPage = async (number: number) => {
    const expected =
      number === 1 ? identities.slice(0, 5) : identities.slice(5);
    const expectedNames = number === 1 ? names.slice(0, 5) : names.slice(5);
    await expect(page.getByRole("status")).toHaveText(
      "6 tutors teach Synthetic matching pager subject at College Support with an open time that fits.",
    );
    await expect(profileLinks).toHaveCount(expected.length);
    const rows = await profileLinks.evaluateAll((links) =>
      links.map((link) => ({
        identity: new URL((link as HTMLAnchorElement).href).pathname,
        label: link.getAttribute("aria-label"),
      })),
    );
    expect(rows).toEqual(
      expected.map((identity, i) => ({
        identity,
        label: `View profile: ${expectedNames[i]}`,
      })),
    );
    const pager = page.getByRole("navigation", {
      name: "Matching result pages",
    });
    await expect(
      pager.getByText(`Page ${number} of 2`, { exact: true }),
    ).toBeVisible();
    await expect(
      pager.getByRole("link", { name: "More tutors", exact: true }),
    ).toHaveCount(number === 1 ? 1 : 0);
    await expect(
      pager.getByRole("link", { name: "Previous tutors", exact: true }),
    ).toHaveCount(number === 2 ? 1 : 0);
    const link = pager.getByRole("link");
    const href = await link.getAttribute("href");
    expect(href).not.toBeNull();
    assertFilters(href ?? "", number === 1 ? 2 : 1);
    assertFilters(page.url(), number);
    return rows.map((row) => row.identity);
  };
  try {
    await owner.pool.query(
      "INSERT INTO subjects(slug,name,category,is_active) VALUES ($1,'Synthetic matching pager subject','specialized',true)",
      [subject],
    );
    // Reverse insertion makes the asserted name order independent of row insertion.
    await owner.pool.query(
      "INSERT INTO \"user\" (id,name,email,email_verified,created_at,updated_at) SELECT $1 || '-' || n,'Synthetic matching pager tutor ' || lpad(n::text,2,'0'),$1 || '-' || n || '@learli.test',true,now(),now() FROM generate_series(8,1,-1) n",
      [group],
    );
    await owner.pool.query(
      'INSERT INTO user_access(user_id) SELECT id FROM "user" WHERE id LIKE $1',
      [`${group}-%`],
    );
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) SELECT id,'tutor' FROM \"user\" WHERE id LIKE $1",
      [`${group}-%`],
    );
    await owner.pool.query(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) SELECT id,'matching-page-'||id,'Synthetic','Fictional pager fixture','Local only','UTC','approved' FROM \"user\" WHERE id LIKE $1",
      [`${group}-%`],
    );
    await owner.pool.query(
      "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT p.id,s.id,ARRAY['college_support']::text[] FROM tutor_profiles p CROSS JOIN subjects s WHERE p.user_id LIKE $1 AND s.slug=$2",
      [`${group}-%`, subject],
    );
    // 00:00–01:00 UTC is 08:00–09:00 Manila. All six have the same actual
    // next time, exercising the accepted name tie-break over two viewer weekdays.
    // Control 07 fits the days but only the evening; 08 fits mornings on other days.
    await owner.pool.query(
      "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT p.id,day,CASE WHEN right(p.user_id,2)='-7' THEN 600 ELSE 0 END,CASE WHEN right(p.user_id,2)='-7' THEN 660 ELSE 60 END FROM tutor_profiles p CROSS JOIN generate_series(1,4) day WHERE p.user_id LIKE $1 AND ((right(p.user_id,2)='-8' AND day IN (2,4)) OR (right(p.user_id,2)<>'-8' AND day IN (1,3)))",
      [`${group}-%`],
    );
    // Both negative controls have genuine actual-date candidates without preferences.
    await page.goto(
      `/get-matched?level=college_support&subject=${subject}&timezone=Asia%2FManila&when=any`,
    );
    await expect(page.getByRole("status")).toHaveText(
      "8 tutors teach Synthetic matching pager subject at College Support with an open time that fits.",
    );
    await page.goto(firstURL);
    const first = await assertPage(1);
    await page.getByRole("link", { name: "More tutors", exact: true }).click();
    const second = await assertPage(2);
    expect([...first, ...second]).toEqual(identities);
    expect(new Set([...first, ...second]).size).toBe(6);
    await page.reload();
    await assertPage(2);
    await page
      .getByRole("link", { name: "Previous tutors", exact: true })
      .click();
    await assertPage(1);
    await page.goBack();
    await assertPage(2);
    await page.goBack();
    await assertPage(1);
  } finally {
    // Preserve synthetic records/history, removing only this fixture's public eligibility.
    await owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE user_id LIKE $1",
      [`${group}-%`],
    );
  }
});
