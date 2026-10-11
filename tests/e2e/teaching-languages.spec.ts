import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";

test.use({ trace: "off", screenshot: "off" });
const baseURL = process.env.APP_URL!;
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const password = "Synthetic-language-browser-passphrase-123";
const sizes = [
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [320, 720],
];

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
async function actor(browser: Browser) {
  const context = await browser.newContext({ baseURL });
  const email = `language-${randomUUID()}@learli.test`;
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic language tutor" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query(
    'UPDATE "user" SET email_verified = true WHERE id = $1',
    [id],
  );
  await owner.pool.query(
    "INSERT INTO user_roles (user_id,role) VALUES ($1,'tutor')",
    [id],
  );
  const signIn = await context.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL },
    data: { email, password },
  });
  expect(signIn.status()).toBe(200);
  return { context, id, page: await context.newPage() };
}
async function fixture(name: string, languages: string[], status = "approved") {
  const userId = randomUUID();
  const tutorId = randomUUID();
  const slug = `language-${tutorId}`;
  await owner.pool.query(
    'INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at) VALUES ($1,$2,$3,true,now(),now())',
    [userId, name, `${userId}@learli.test`],
  );
  await owner.pool.query(
    "INSERT INTO user_access (user_id,status) VALUES ($1,'active')",
    [userId],
  );
  await owner.pool.query(
    "INSERT INTO user_roles (user_id,role) VALUES ($1,'tutor')",
    [userId],
  );
  await owner.pool.query(
    "INSERT INTO tutor_profiles (id,user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,$3,'Synthetic tutor','Fictional introduction','Fictional background','Asia/Manila',$4)",
    [tutorId, userId, slug, status],
  );
  await owner.pool.query(
    "INSERT INTO tutor_subjects (tutor_id,subject_id,levels) SELECT $1,id,ARRAY['elementary','college_support'] FROM subjects WHERE slug='math'",
    [tutorId],
  );
  for (const language of languages)
    await owner.pool.query(
      "INSERT INTO tutor_teaching_languages VALUES ($1,$2)",
      [tutorId, language],
    );
  return { tutorId, slug };
}
test.beforeEach(async () => {
  await owner.pool.query("TRUNCATE TABLE tutor_profiles CASCADE");
  await owner.pool.query("DELETE FROM rate_limit");
});
test.afterAll(async () => {
  await owner.pool.end();
});

test("role removal excludes every discovery projection and language inventory", async ({
  page,
}) => {
  const revoked = await fixture("Synthetic revoked role tutor", ["fr"]);
  await owner.pool.query(
    "DELETE FROM user_roles WHERE user_id=(SELECT user_id FROM tutor_profiles WHERE id=$1) AND role='tutor'",
    [revoked.tutorId],
  );
  for (const route of [
    "/",
    "/tutors",
    "/get-matched?level=elementary&subject=math",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByText("Synthetic revoked role tutor", { exact: true }),
    ).toHaveCount(0);
  }
  await page.goto("/tutors");
  await expect(
    page.locator('select[name="language"] option[value="fr"]'),
  ).toHaveCount(0);
  expect((await page.request.get(`/tutors/${revoked.slug}`)).status()).toBe(
    404,
  );
});

test("owner declares, retries, persists and clears languages with accessible controls", async ({
  browser,
}, info) => {
  const tutor = await actor(browser);
  const publicContext = await browser.newContext({ baseURL });
  const page = tutor.page;
  try {
    await page.goto("/tutor/profile");
    await page.getByLabel("Headline").fill("Synthetic mathematics tutor");
    await page
      .getByLabel("Introduction")
      .fill("Synthetic language test introduction");
    await page
      .getByLabel("Teaching background")
      .fill("Fictional teaching background");
    await page.getByLabel("Time zone").selectOption("Asia/Manila");
    await page
      .getByRole("group", { name: "Math", exact: true })
      .getByLabel("College Support")
      .check();
    const languages = page.getByRole("group", {
      name: "Teaching languages (optional)",
      exact: true,
    });
    await expect(
      languages.getByLabel("English", { exact: true }),
    ).not.toBeChecked();
    await languages.getByLabel("English", { exact: true }).focus();
    await page.keyboard.press("Space");
    await languages.getByLabel("Filipino", { exact: true }).check();
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await accessible(page);
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: info.outputPath(`editor-${width}.png`),
          fullPage: true,
        });
    }
    await page.route("**/api/tutor/profile", (route) =>
      route.fulfill({
        status: 400,
        json: {
          message: "Check the fields marked below.",
          fields: {
            teachingLanguages:
              "Choose each teaching language once from the listed options.",
          },
        },
      }),
    );
    await page
      .getByRole("button", { name: "Submit application", exact: true })
      .click();
    await expect(languages.getByLabel("Arabic", { exact: true })).toBeFocused();
    await expect(
      languages.getByText("Choose each teaching language once"),
    ).toBeVisible();
    await expect(
      languages.getByLabel("English", { exact: true }),
    ).toBeChecked();
    await accessible(page);
    await page.unroute("**/api/tutor/profile");
    await page.route("**/api/tutor/profile", (route) => route.abort());
    await page
      .getByRole("button", { name: "Submit application", exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Check your connection",
    );
    await expect(
      languages.getByLabel("Filipino", { exact: true }),
    ).toBeChecked();
    await page.unroute("**/api/tutor/profile");
    await page
      .getByRole("button", { name: "Submit application", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Application submitted.");
    await page.reload();
    await expect(
      languages.getByLabel("English", { exact: true }),
    ).toBeChecked();
    await expect(
      languages.getByLabel("Filipino", { exact: true }),
    ).toBeChecked();
    const rows = await owner.pool.query<{ slug: string }>(
      "UPDATE tutor_profiles SET review_status='approved' WHERE user_id=$1 RETURNING slug",
      [tutor.id],
    );
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/tutors/${rows.rows[0].slug}`);
    await expect(
      publicPage.getByText("English · Filipino", { exact: true }),
    ).toBeVisible();
    await expect(
      publicPage.getByText("Declared by the tutor.", { exact: false }),
    ).toContainText("has not checked language proficiency");
    for (const width of [1440, 390, 320]) {
      await publicPage.setViewportSize({ width, height: 900 });
      await accessible(publicPage);
      if (width !== 320)
        await publicPage.screenshot({
          path: info.outputPath(`public-${width}.png`),
          fullPage: true,
        });
    }
    await page.reload();
    await languages.getByLabel("English", { exact: true }).uncheck();
    await languages.getByLabel("Filipino", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Profile saved.");
    await publicPage.reload();
    await expect(
      publicPage.getByText("No teaching languages listed", { exact: true }),
    ).toBeVisible();
    await publicPage.goto("/tutors");
    await expect(
      publicPage.getByLabel("Teaching language", { exact: true }),
    ).toHaveCount(0);
    await publicPage.close();
  } finally {
    await publicContext.close();
    await tutor.context.close();
  }
});

test("directory composes filters, retains pagination/removal and excludes ineligible declarations", async ({
  page,
}, info) => {
  for (let index = 0; index < 22; index++)
    await fixture(
      `Synthetic tutor ${String(index).padStart(2, "0")}`,
      index === 0 ? ["en", "fil"] : ["en"],
    );
  const missing = await fixture("Synthetic without languages", []);
  const pending = await fixture("Pending synthetic", ["es"], "pending");
  await fixture("Suspended synthetic", ["ar"], "suspended");
  await page.goto("/tutors?subject=math&level=college_support&language=en");
  await expect(page.getByRole("status")).toHaveText("22 tutors");
  await expect(
    page.getByLabel("Teaching language", { exact: true }).locator("option"),
  ).toHaveText(["Any teaching language", "English", "Filipino"]);
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await accessible(page);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: info.outputPath(`directory-${width}.png`),
        fullPage: true,
      });
  }
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(page).toHaveURL(
    /subject=math&level=college_support&language=en&page=2$/,
  );
  await expect(page.getByRole("link", { name: /View profile:/ })).toHaveCount(
    2,
  );
  await expect(
    page.getByRole("link", { name: "Remove filter: Math", exact: true }),
  ).toHaveAttribute("href", "/tutors?level=college_support&language=en");
  await page
    .getByRole("link", {
      name: "Remove filter: Teaching language: English",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/subject=math&level=college_support$/);
  await expect(page.getByRole("status")).toHaveText("23 tutors");
  await page
    .getByLabel("Teaching language", { exact: true })
    .selectOption("fil");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("1 tutor");
  await page.getByLabel("Level", { exact: true }).selectOption("high_school");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "No tutors match these filters",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Remove filter: Teaching language: Filipino",
      exact: true,
    }),
  ).toHaveAttribute("href", "/tutors?subject=math&level=high_school");
  await page.screenshot({ path: info.outputPath("empty.png"), fullPage: true });
  await page.goto("/tutors?language=es");
  await expect(
    page.getByRole("heading", {
      name: "No tutors match these filters",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByLabel("Teaching language", { exact: true })
      .locator("option:checked"),
  ).toHaveText("Spanish (no tutors listed)");
  await page.goto("/tutors?subject=english&language=en");
  await expect(
    page.getByRole("link", { name: "Remove filter: English", exact: true }),
  ).toHaveAttribute("href", "/tutors?language=en");
  await expect(
    page.getByRole("link", {
      name: "Remove filter: Teaching language: English",
      exact: true,
    }),
  ).toHaveAttribute("href", "/tutors?subject=english");
  expect((await page.goto(`/tutors/${pending.slug}`))?.status()).toBe(404);
  await page.goto(`/tutors/${missing.slug}`);
  await expect(
    page.getByText("No teaching languages listed", { exact: true }),
  ).toBeVisible();
  await page.goto("/tutors?language=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
  await expect(page.getByRole("status")).toHaveText("23 tutors");
  await expect(page.getByRole("main")).not.toContainText("alert(1)");
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 400 });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("forced-colors-reflow.png"),
    fullPage: true,
  });
});

test("language GET filter works without JavaScript", async ({ browser }) => {
  await fixture("Synthetic English tutor", ["en"]);
  await fixture("Synthetic Filipino tutor", ["fil"]);
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/tutors");
    await page
      .getByLabel("Teaching language", { exact: true })
      .selectOption("fil");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await expect(page).toHaveURL(/language=fil$/);
    await expect(page.getByRole("status")).toHaveText("1 tutor");
    await expect(
      page.getByRole("heading", {
        name: "Synthetic Filipino tutor",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic English tutor",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});
