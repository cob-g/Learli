import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../../src/lib/db/connection";

test.use({ trace: "off", screenshot: "off" });
test.describe.configure({ mode: "serial" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const group = randomUUID();
const subject = `directory-${group}`;
const name = (i: number) =>
  `Synthetic directory tutor ${String(i).padStart(2, "0")}`;
const plain = `/tutors?subject=${subject}&level=college_support&language=en`;
const filtered = `${plain}&when=preferred&timezone=UTC&days=1&range=morning`;
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
async function provision(count: number, prefix: string, openTimes: boolean) {
  await owner.pool.query(
    "INSERT INTO \"user\" (id,name,email,email_verified,created_at,updated_at) SELECT $1 || n,$2 || lpad(n::text,2,'0'), $1 || n || '@learli.test',true,now(),now() FROM generate_series(0,$3::int-1) n",
    [prefix, "Synthetic directory tutor ", count],
  );
  await owner.pool.query(
    'INSERT INTO user_access(user_id) SELECT id FROM "user" WHERE id LIKE $1',
    [`${prefix}%`],
  );
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) SELECT id,'tutor' FROM \"user\" WHERE id LIKE $1",
    [`${prefix}%`],
  );
  await owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) SELECT id,'directory-'||id,'Synthetic','Fictional local fixture','Local only','UTC','approved' FROM \"user\" WHERE id LIKE $1",
    [`${prefix}%`],
  );
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT p.id,s.id,ARRAY['college_support']::text[] FROM tutor_profiles p CROSS JOIN subjects s WHERE p.user_id LIKE $1 AND s.slug=$2",
    [`${prefix}%`, subject],
  );
  await owner.pool.query(
    "INSERT INTO tutor_teaching_languages(tutor_id,language_code) SELECT id,'en' FROM tutor_profiles WHERE user_id LIKE $1",
    [`${prefix}%`],
  );
  if (openTimes)
    await owner.pool.query(
      "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT p.id,day,540,1020 FROM tutor_profiles p CROSS JOIN generate_series(1,7) day WHERE p.user_id LIKE $1",
      [`${prefix}%`],
    );
}
test.beforeAll(async () => {
  await owner.pool.query(
    "INSERT INTO subjects(slug,name,category,is_active) VALUES ($1,'Synthetic directory subject','specialized',true)",
    [subject],
  );
  await provision(21, group, true);
});
test.afterAll(async () => {
  await owner.pool.query(
    "UPDATE tutor_profiles SET review_status='suspended' WHERE user_id LIKE $1",
    [`${group}%`],
  );
  await owner.pool.end();
});

test("opt-in GET filters preserve complete counts, order, paging, Back, keyboard and accessible layouts", async ({
  page,
}) => {
  await page.goto(plain);
  await expect(page.getByRole("status")).toHaveText("21 tutors");
  await expect(page.getByText("Next time that fits")).toHaveCount(0);
  await page.getByText("Lesson time (optional)", { exact: true }).click();
  await page.getByLabel("Availability filter").selectOption("preferred");
  await page.getByLabel("Your time zone").selectOption("UTC");
  await page.getByLabel("Monday", { exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByLabel("Preferred time of day").selectOption("morning");
  let observed: { busy: string | null; action?: string } | undefined;
  await page.exposeFunction(
    "recordDirectoryPending",
    (value: typeof observed) => {
      observed = value;
    },
  );
  await page.evaluate(() => {
    const form = document.querySelector('form[role="search"]')!;
    const record = (
      window as typeof window & {
        recordDirectoryPending: (value: {
          busy: string | null;
          action?: string;
        }) => Promise<void>;
      }
    ).recordDirectoryPending;
    new MutationObserver(() => {
      void record({
        busy: form.getAttribute("aria-busy"),
        action: form
          .querySelector('button[type="submit"]')
          ?.textContent?.trim(),
      });
    }).observe(form, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  let resume!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  await page.route("**/tutors?*", async (route) => {
    if (route.request().url().includes("when=preferred")) await gate;
    await route.continue();
  });
  const submit = page.getByRole("button", { name: "Apply filters" }).click();
  try {
    await expect
      .poll(() => observed)
      .toEqual({ busy: "true", action: "Loading tutors…" });
  } finally {
    resume();
  }
  await submit;
  await page.unroute("**/tutors?*");
  await expect(page.getByRole("status")).toHaveText("21 tutors");
  await expect(
    page.getByRole("heading", { name: name(0), exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Next time that fits")).toHaveCount(20);
  await expect(page.getByText(/Local simulation: actual dated/)).toBeVisible();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: name(20), exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("21 tutors");
  await expect(page).toHaveURL(/days=1.*range=morning.*page=2/);
  await page.goBack();
  await expect(page.getByLabel("Monday", { exact: true })).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeVisible();
  await page.reload();
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
    if (width !== 320)
      await page.screenshot({
        path: `.local/next-wave/directory-${width}.png`,
        fullPage: true,
      });
  }
  const html = await page.content();
  for (const privateKey of [
    "@learli.test",
    "learnerId",
    "requestFingerprint",
    "meetingUrl",
  ])
    expect(html.includes(privateKey)).toBe(false);
  const href = await page
    .getByRole("link", { name: `View profile: ${name(0)}`, exact: true })
    .getAttribute("href");
  expect(href).toContain("displayTimezone=UTC");
});

test("native no-JS form and page links retain the selected days, band and viewer zone", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(plain);
  await page.getByText("Lesson time (optional)", { exact: true }).click();
  await page.getByLabel("Availability filter").selectOption("preferred");
  await page.getByLabel("Your time zone").selectOption("UTC");
  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Preferred time of day").selectOption("morning");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("status")).toHaveText("21 tutors");
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(page.getByLabel("Monday", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Your time zone")).toHaveValue("UTC");
  await expect(page.getByLabel("Preferred time of day")).toHaveValue("morning");
  await expect(
    page.getByRole("heading", { name: name(20), exact: true }),
  ).toBeVisible();
  await context.close();
});

test("malformed input is safe and focusable, and genuine empty times are separate from unavailable", async ({
  page,
}) => {
  await page.goto(
    `${filtered.replace("range=morning", "range=bad")}&learnerId=PRIVATE_CANARY`,
  );
  await expect(page.getByLabel("Preferred time of day")).toBeFocused();
  await expect(
    page.getByText("Choose a time-of-day range", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect((await page.content()).includes("PRIVATE_CANARY")).toBe(false);
  await page.goto(filtered.replace("range=morning", "range=evening"));
  await expect(
    page.getByRole("heading", { name: "No tutors match these filters" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible(page);
  await page.screenshot({
    path: ".local/next-wave/directory-empty.png",
    fullPage: true,
  });
});

test("over-cap results show no partial count or list while ordinary browse remains uncapped", async ({
  page,
}) => {
  const overflow = `${group}-overflow-`;
  await provision(80, overflow, false);
  try {
    await page.goto(filtered);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "temporarily unavailable",
    );
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /^View profile:/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "No tutors match these filters" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Clear lesson time filter" }).click();
    await expect(page.getByRole("status")).toHaveText("101 tutors");
  } finally {
    await owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE user_id LIKE $1",
      [`${overflow}%`],
    );
  }
});
