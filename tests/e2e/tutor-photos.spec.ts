import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createDatabase } from "../../src/lib/db/connection";
import { provisionScreeningAssignment } from "../../src/features/tutor-screening/fixture-tooling";
import { enrollBrowserAdmin } from "../support/browser-admin-mfa";

// Never record auth cookies or passwords in traces.
test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "serial" });

const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const origin = process.env.APP_URL ?? "http://127.0.0.1:3100";
const password = "Synthetic-photo-passphrase-123";
const run = randomUUID().slice(0, 8);
const tutorName = `Photo Tutor ${run}`;
let profile: { id: string; slug: string };

/** Synthetic account through the real sign-up; roles from trusted setup. */
async function signIn(browser: Browser, roles: string[], name: string) {
  const context = await browser.newContext({ baseURL: origin });
  const page = await context.newPage();
  const email = `photo-${randomUUID()}@learli.test`;
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { email, password, name },
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  for (const role of roles)
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,$2)",
      [id, role],
    );
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        headers: { origin },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  if (roles.includes("admin")) await enrollBrowserAdmin(context, password);
  return { page, id };
}
async function avatarImage(page: Page) {
  return page.locator(`main img[src^="/api/tutor-photos/"]`);
}
async function loaded(image: ReturnType<Page["locator"]>) {
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBe(512);
}

test.beforeAll(async () => {
  await owner.pool.query("DELETE FROM rate_limit");
});
test.afterAll(async () => {
  // Leave no extra public tutor for later specs.
  if (profile)
    await owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
      [profile.id],
    );
  await owner.pool.end();
});

test("a tutor's photo shows publicly only after an admin approves it", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const tutor = await signIn(browser, ["tutor"], tutorName);
  profile = (
    await owner.pool.query<{ id: string; slug: string }>(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,'Synthetic science support','Synthetic profile only.','Synthetic fixture only.','Asia/Manila','approved') RETURNING id,slug",
      [tutor.id, `photo-${run}`],
    )
  ).rows[0];
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['high_school']::text[] FROM subjects WHERE slug='science'",
    [profile.id],
  );

  // The tutor uploads from Account settings; it waits for review.
  await tutor.page.goto("/account");
  const panel = tutor.page.getByRole("region", { name: "Profile settings" });
  await expect(panel.getByText("Profile photo", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Remove photo" })).toHaveCount(
    0,
  );
  const upload = panel.getByRole("button", { name: "Upload photo" });
  await expect(upload).toBeEnabled();
  const chooser = tutor.page.waitForEvent("filechooser");
  await upload.click();
  await (
    await chooser
  ).setFiles({
    name: "headshot.jpg",
    mimeType: "image/jpeg",
    buffer: await sharp({
      create: { width: 900, height: 700, channels: 3, background: "#16936f" },
    })
      .jpeg()
      .toBuffer(),
  });
  await expect(panel.getByText("Pending review")).toBeVisible();
  await expect(
    panel.getByText(
      "Photo uploaded. It shows on your profile after an admin approves it.",
    ),
  ).toBeVisible();
  const pending = panel.locator('img[src^="/api/tutor-photos/"]');
  await loaded(pending);
  const pendingUrl = (await pending.getAttribute("src"))!;
  expect(
    (
      await new AxeBuilder({ page: tutor.page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  // Nobody else sees it yet: the public keeps the initials.
  const visitor = await browser.newPage({ baseURL: origin });
  expect((await visitor.request.get(pendingUrl)).status()).toBe(404);
  await visitor.goto(`/tutors/${profile.slug}`);
  await expect(
    visitor.getByRole("heading", { name: tutorName, level: 1 }),
  ).toBeVisible();
  await expect(await avatarImage(visitor)).toHaveCount(0);

  // An assigned admin finds it in the queue and approves it.
  const admin = await signIn(browser, ["admin"], `Photo Admin ${run}`);
  await provisionScreeningAssignment(
    owner,
    profile.id,
    admin.id,
    "local_fixture",
    new Date(Date.now() + 3600000),
  );
  await admin.page.goto("/admin/tutors");
  // The default queue shows pending applications; this tutor is approved.
  await admin.page.getByLabel("Status").selectOption("photo");
  await admin.page.getByRole("button", { name: "Apply filters" }).click();
  await expect(admin.page).toHaveURL(/status=photo/);
  const row = admin.page.getByRole("listitem").filter({ hasText: tutorName });
  await expect(row.getByText("Photo to review")).toBeVisible();
  await row.getByRole("link", { name: tutorName }).click();
  await loaded(
    admin.page.getByRole("img", {
      name: `Photo ${tutorName} submitted for review`,
    }),
  );
  await admin.page.getByRole("button", { name: "Approve photo" }).click();
  await expect(
    admin.page.getByText(
      "Photo approved. It now shows on the tutor's public profile.",
    ),
  ).toBeVisible();

  // Now public, on the profile and in the directory.
  const published = await visitor.request.get(pendingUrl);
  expect(published.status()).toBe(200);
  expect(published.headers()["content-type"]).toBe("image/webp");
  expect(published.headers()["cache-control"]).toBe("public, max-age=3600");
  await visitor.goto(`/tutors/${profile.slug}`);
  await loaded(await avatarImage(visitor));
  await visitor.goto("/tutors");
  await loaded(
    visitor
      .getByRole("listitem")
      .filter({ hasText: tutorName })
      .locator('img[src^="/api/tutor-photos/"]'),
  );

  // Removing it brings the initials back everywhere.
  await tutor.page.reload();
  await expect(panel.getByText("Pending review")).toHaveCount(0);
  await panel.getByRole("button", { name: "Remove photo" }).click();
  await expect(
    panel.getByText("Photo removed. Families see your initials."),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Upload photo" }),
  ).toBeVisible();
  expect((await visitor.request.get(pendingUrl)).status()).toBe(404);
  await visitor.goto(`/tutors/${profile.slug}`);
  await expect(await avatarImage(visitor)).toHaveCount(0);
});

test("the photo control fits a phone", async ({ browser }) => {
  const tutor = await signIn(browser, ["tutor"], `Phone ${tutorName}`);
  await owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone) VALUES ($1,$2,'Synthetic headline','Synthetic bio.','Synthetic background.','Asia/Manila')",
    [tutor.id, `photo-phone-${run}`],
  );
  await tutor.page.setViewportSize({ width: 320, height: 720 });
  await tutor.page.goto("/account");
  const upload = tutor.page.getByRole("button", { name: "Upload photo" });
  await expect(upload).toBeVisible();
  const box = (await upload.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(
    await tutor.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
