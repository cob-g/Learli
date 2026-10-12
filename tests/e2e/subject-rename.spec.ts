import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";

const baseURL = process.env.APP_URL!;
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
test.use({ trace: "off", screenshot: "off" });
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(() => owner.pool.end());

async function setup(browser: Browser) {
  const context = await browser.newContext({ baseURL });
  const email = `subject-browser-${randomUUID()}@learli.test`;
  const password = "Synthetic-subject-browser-123";
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic catalog admin" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
    [id],
  );
  const signin = await context.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL },
    data: { email, password },
  });
  expect(signin.status()).toBe(200);
  const created = await context.request.post("/api/admin/subjects", {
    headers: { origin: baseURL },
    data: { name: `Synthetic ${randomUUID()}` },
  });
  expect(created.status()).toBe(200);
  const subject = (await created.json()) as {
    id: string;
    name: string;
    slug: string;
  };
  return { context, page: await context.newPage(), subject };
}
function editor(page: Page, subjectId: string) {
  return page.locator("details").filter({
    has: page.locator(`#subject-name-${subjectId}`),
  });
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
async function capture(page: Page, name: string) {
  await mkdir(".local/next-wave/screenshots", { recursive: true });
  await page.screenshot({
    path: `.local/next-wave/screenshots/${name}.png`,
    fullPage: true,
  });
}
async function waitForLock() {
  for (let i = 0; i < 100; i++) {
    const r = await owner.pool.query(
      "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%subjects%') AS waiting",
    );
    if (r.rows[0].waiting) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Expected an actual PostgreSQL subject lock wait.");
}

test("admin corrects name by keyboard and existing public references read it truthfully", async ({
  browser,
}) => {
  const { context, page, subject } = await setup(browser);
  try {
    const tutorId = randomUUID(),
      profileId = randomUUID(),
      slug = `specialist-${randomUUID()}`;
    await owner.pool.query(
      'INSERT INTO "user"(id,name,email,email_verified) VALUES($1,$2,$3,true)',
      [tutorId, "Synthetic subject specialist", `tutor-${tutorId}@learli.test`],
    );
    await owner.pool.query(
      "INSERT INTO user_access(user_id,status) VALUES($1,'active')",
      [tutorId],
    );
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor')",
      [tutorId],
    );
    await owner.pool.query(
      "INSERT INTO tutor_profiles(id,user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,$3,'Synthetic specialist','Local fixture only.','Local fixture only.','UTC','approved')",
      [profileId, tutorId, slug],
    );
    await owner.pool.query(
      "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES($1,$2,ARRAY['college_support'])",
      [profileId, subject.id],
    );
    await owner.pool.query(
      "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT $1,day,0,1440 FROM generate_series(1,7) day",
      [profileId],
    );
    await page.goto("/admin/subjects");
    const form = editor(page, subject.id);
    await form.locator("summary").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    const input = form.getByLabel("Display name");
    await expect(input).toBeFocused();
    await input.fill("<script>");
    await form.getByRole("button", { name: "Save subject name" }).click();
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription(/2 to 60/);
    const name = `Applied Statistics ${randomUUID().slice(0, 8)}`;
    await input.fill(`  ${name}  `);
    await input.press("Tab");
    await page.keyboard.press("Enter");
    await expect(form.getByRole("status")).toHaveText("Subject name saved.");
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    const row = (
      await owner.pool.query(
        "SELECT slug,category,is_active,name_revision FROM subjects WHERE id=$1",
        [subject.id],
      )
    ).rows[0];
    expect(row).toEqual({
      slug: subject.slug,
      category: "specialized",
      is_active: true,
      name_revision: 1,
    });
    await page.goto(`/tutors?subject=${subject.slug}&level=college_support`);
    await expect(
      page
        .locator("li")
        .filter({
          has: page.getByRole("link", {
            name: "View profile: Synthetic subject specialist",
            exact: true,
          }),
        })
        .getByText(name, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "View profile: Synthetic subject specialist",
        exact: true,
      }),
    ).toBeVisible();
    await accessible(page);
    await page.goto(`/tutors/${slug}`);
    await expect(
      page
        .getByRole("region", { name: "Subjects and levels" })
        .getByText(name, { exact: true }),
    ).toBeVisible();
    await accessible(page);
    await page.goto(`/get-matched?level=college_support`);
    await expect(page.getByRole("radio", { name, exact: true })).toBeVisible();
    await page.goto(
      `/get-matched?level=college_support&subject=${subject.slug}&when=any&timezone=UTC`,
    );
    await expect(
      page.getByRole("main").locator("p").filter({ hasText: name }).first(),
    ).toBeVisible();
    await expect(page.getByRole("main")).toContainText(
      "Synthetic subject specialist",
    );
    await accessible(page);
  } finally {
    await context.close();
  }
});

test("stale tabs retain input, reload current name, recover and preserve activation", async ({
  browser,
}) => {
  const { context, page, subject } = await setup(browser);
  const second = await context.newPage();
  try {
    await page.goto("/admin/subjects");
    await second.goto("/admin/subjects");
    const a = editor(page, subject.id),
      b = editor(second, subject.id);
    await a.locator("summary").click();
    await b.locator("summary").click();
    const firstName = `First correction ${randomUUID().slice(0, 8)}`,
      secondName = `Second correction ${randomUUID().slice(0, 8)}`;
    await a.getByLabel("Display name").fill(firstName);
    await a.getByRole("button", { name: "Save subject name" }).click();
    await expect(page.getByText(firstName, { exact: true })).toBeVisible();
    await b.getByLabel("Display name").fill(secondName);
    await b.getByRole("button", { name: "Save subject name" }).click();
    await expect(b.getByRole("alert")).toContainText("This subject changed");
    await expect(b.getByLabel("Display name")).toHaveValue(secondName);
    await b.getByRole("link", { name: "Reload current name" }).click();
    await expect(second.getByText(firstName, { exact: true })).toBeVisible();
    const reloaded = editor(second, subject.id);
    await reloaded.locator("summary").click();
    await expect(reloaded.getByLabel("Display name")).toHaveValue(firstName);
    await reloaded.getByLabel("Display name").fill(secondName);
    await reloaded.getByRole("button", { name: "Save subject name" }).click();
    await expect(second.getByText(secondName, { exact: true })).toBeVisible();
    await second
      .getByRole("button", { name: `Deactivate ${secondName}`, exact: true })
      .click();
    await expect(
      second.getByRole("button", {
        name: `Activate ${secondName}`,
        exact: true,
      }),
    ).toBeVisible();
    const renamed = editor(second, subject.id);
    await renamed.getByLabel("Display name").fill("Math");
    await renamed.getByRole("button", { name: "Save subject name" }).click();
    await expect(renamed.getByRole("alert")).toContainText("already exists");
    expect(
      (
        await owner.pool.query(
          "SELECT name_revision,is_active FROM subjects WHERE id=$1",
          [subject.id],
        )
      ).rows[0],
    ).toEqual({ name_revision: 2, is_active: false });
    await accessible(second);
  } finally {
    await context.close();
  }
});

test("real lock pending and uncertain network failure provide bounded accessible recovery", async ({
  browser,
}) => {
  const { context, page, subject } = await setup(browser);
  const lock = await owner.pool.connect();
  try {
    await page.goto("/admin/subjects");
    const form = editor(page, subject.id);
    await form.locator("summary").click();
    const name = `Pending correction ${randomUUID().slice(0, 8)}`;
    await form.getByLabel("Display name").fill(name);
    await lock.query("BEGIN");
    await lock.query("SELECT id FROM subjects WHERE id=$1 FOR UPDATE", [
      subject.id,
    ]);
    await form.getByRole("button", { name: "Save subject name" }).click();
    await waitForLock();
    await expect(form.locator("form")).toHaveAttribute("aria-busy", "true");
    await expect(form.getByLabel("Display name")).toBeDisabled();
    await form.getByRole("button", { name: "Saving name…" }).press("Enter");
    await lock.query("COMMIT");
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    const renamed = editor(page, subject.id);
    await page.route("**/api/admin/subjects/*/name", (route) => route.abort());
    await renamed.getByLabel("Display name").fill("Retained correction");
    await renamed.getByRole("button", { name: "Save subject name" }).click();
    await expect(renamed.getByRole("alert")).toContainText("couldn't confirm");
    await expect(renamed.getByLabel("Display name")).toHaveValue(
      "Retained correction",
    );
    await expect(
      renamed.getByRole("link", { name: "Reload current name" }),
    ).toBeVisible();
    expect(
      (
        await owner.pool.query(
          "SELECT count(*)::int AS n FROM audit_events WHERE target_subject_id=$1 AND action='subject.renamed'",
          [subject.id],
        )
      ).rows[0].n,
    ).toBe(1);
    await accessible(page);
  } finally {
    await lock.query("ROLLBACK");
    lock.release();
    await context.close();
  }
});

test("phone and desktop long-name editing stays keyboard accessible without clipping", async ({
  browser,
}) => {
  const { context, page, subject } = await setup(browser);
  const name = `Specialized ${"C".repeat(48)}`;
  try {
    const result = await context.request.patch(
      `/api/admin/subjects/${subject.id}/name`,
      { headers: { origin: baseURL }, data: { name, expectedRevision: 0 } },
    );
    expect(result.status()).toBe(200);
    await page.goto("/admin/subjects");
    const form = editor(page, subject.id);
    await form.locator("summary").click();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(form.getByLabel("Display name")).toBeVisible();
      await accessible(page);
      if (width === 390 || width === 1440)
        await capture(page, `subject-${width}`);
    }
    await page.emulateMedia({
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    await page.setViewportSize({ width: 640, height: 400 });
    await accessible(page);
    await capture(page, "subject-forced-reflow");
    await form.getByLabel("Display name").focus();
    await page.keyboard.press("Tab");
    await expect(
      form.getByRole("button", { name: "Save subject name" }),
    ).toBeFocused();
  } finally {
    await context.close();
  }
});

test("no-JavaScript server reads expose fixed names and disable new mutation safely", async ({
  browser,
}) => {
  const { context, page, subject } = await setup(browser);
  const native = await browser.newContext({
    baseURL,
    storageState: await context.storageState(),
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const nativePage = await native.newPage();
  try {
    await nativePage.goto("/admin/subjects");
    await expect(
      nativePage.getByText(subject.name, { exact: true }),
    ).toBeVisible();
    const form = editor(nativePage, subject.id);
    await form.locator("summary").click();
    await expect(
      form.getByText("Enable JavaScript to edit subject names."),
    ).toBeVisible();
    await expect(form.getByLabel("Display name")).toBeDisabled();
    await expect(
      form.getByRole("button", { name: "Save subject name" }),
    ).toBeDisabled();
    await expect(form.locator("form")).toHaveAttribute("method", "post");
    expect(new URL(nativePage.url()).search).toBe("");
    const math = nativePage
      .locator("li")
      .filter({ has: nativePage.getByText("Math", { exact: true }) });
    await expect(math.locator("details")).toHaveCount(0);
    await page.goto("/admin/subjects");
    await accessible(page);
    const post = await native.request.post(
      `/api/admin/subjects/${subject.id}/name`,
      { form: { name: "Should never change" } },
    );
    expect(post.status()).toBe(405);
    expect(
      (
        await owner.pool.query(
          "SELECT name_revision FROM subjects WHERE id=$1",
          [subject.id],
        )
      ).rows[0].name_revision,
    ).toBe(0);
    await capture(nativePage, "subject-no-js-phone");
  } finally {
    await native.close();
    await context.close();
  }
});
