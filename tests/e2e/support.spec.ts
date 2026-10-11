import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import {
  assignFixtureCase,
  authorizeFixtureReviewer,
} from "../../src/features/support/fixture-tooling";
const baseURL = process.env.APP_URL!;
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
async function actor(browser: Browser, admin = false) {
  const context = await browser.newContext({ baseURL });
  const email = `support-${randomUUID()}@learli.test`,
    password = "Synthetic-support-browser-123";
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic support account" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query(
    'UPDATE "user" SET email_verified = true WHERE id=$1',
    [id],
  );
  if (admin)
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES ($1,'admin')",
      [id],
    );
  expect(
    (
      await context.request.post("/api/auth/sign-in/email", {
        headers: { origin: baseURL },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  return { context, id, page: await context.newPage() };
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
async function create(
  page: Page,
  subject = "Fictional concern for local testing",
) {
  const response = await page.request.post("/api/support", {
    headers: { origin: baseURL },
    data: {
      requestKey: randomUUID(),
      category: "safety",
      subject,
      body: "Synthetic-only case description",
    },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).id as string;
}
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(() => owner.pool.end());

test("fictional report form is responsive, keyboard accessible and persists safe text with errors/pending states", async ({
  browser,
}, info) => {
  const user = await actor(browser);
  const page = user.page;
  await page.goto("/support");
  await expect(
    page.getByRole("heading", { name: "No reports on this account" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create fictional report" }).click();
  await expect(
    page.getByRole("heading", { name: "Contact support", exact: true }),
  ).toBeVisible();
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [768, 900],
    [1024, 900],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
    if ([320, 390, 1440].includes(width))
      await page.screenshot({
        path: info.outputPath(`support-form-${width}.png`),
        fullPage: true,
      });
  }
  await page
    .getByRole("button", { name: "Save fictional report", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Enter a subject.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Subject", { exact: true })).toBeFocused();
  const subject = "Synthetic report <img src=x onerror=alert(1)>";
  await page.getByLabel("Subject", { exact: true }).fill(subject);
  await page
    .getByLabel("Fictional description")
    .fill("Fictional text <script>window.fake=true</script>");
  await page.route("**/api/support", (route) => route.abort());
  await page
    .getByRole("button", { name: "Save fictional report", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Check your connection" }),
  ).toBeVisible();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    subject,
  );
  await page.unroute("**/api/support");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/support", async (route) => {
    requests++;
    await gate;
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Save fictional report", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saving fictional report…" }),
  ).toHaveAttribute("aria-disabled", "true");
  await page
    .getByRole("button", { name: "Saving fictional report…" })
    .press("Enter");
  expect(requests).toBe(1);
  release();
  await expect(page).toHaveURL(/\/support\/[a-f0-9-]+$/);
  await expect(
    page.getByRole("heading", { name: subject, exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => "fake" in window)).toBe(false);
  await expect(page.locator("main img, main script")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Fictional report saved", { exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("support-detail-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("support-detail-phone.png"),
    fullPage: true,
  });
  const id = page.url().split("/").pop()!;
  const html = await page.request.get(`/support/${id}`);
  expect(html.headers()["cache-control"]).toContain("no-store");
  expect(await html.text()).toContain("noindex");
  expect(await page.title()).toBe("Support case | Learli");
  const response = await page.request.get(`/api/support/${id}`);
  expect(response.headers()["cache-control"]).toContain("private, no-store");
  expect(await response.text()).not.toContain(user.id);
  await user.context.close();
});

test("assigned reviewer can change statuses and stale/reassigned cases remain private", async ({
  browser,
}, info) => {
  const user = await actor(browser),
    staff = await actor(browser, true),
    otherStaff = await actor(browser, true);
  await authorizeFixtureReviewer(owner, staff.id);
  await authorizeFixtureReviewer(owner, otherStaff.id);
  const id = await create(user.page);
  await assignFixtureCase(owner, id, staff.id);
  const page = staff.page;
  await page.goto("/admin/support");
  await page
    .getByRole("link", {
      name: "Fictional concern for local testing",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Change local status" }),
  ).toBeVisible();
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
    .getByRole("button", { name: "Save case status", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Case status saved" }),
  ).toBeVisible();
  await expect(page.getByLabel("Next status")).toHaveValue("closed");
  await page.screenshot({
    path: info.outputPath("support-reviewer-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("support-reviewer-phone.png"),
    fullPage: true,
  });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 400 });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("support-reviewer-reflow-forced.png"),
    fullPage: true,
  });
  await page.emulateMedia({
    forcedColors: "none",
    reducedMotion: "no-preference",
  });
  // Another authorized operation makes the still-open browser revision stale.
  const direct = await page.request.patch(`/api/admin/support/${id}/status`, {
    headers: { origin: baseURL },
    data: { revision: 2, status: "closed" },
  });
  expect(direct.status()).toBe(200);
  await page
    .getByRole("button", { name: "Save case status", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "This case changed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reload case" }).click();
  await expect(page.getByLabel("Next status")).toHaveValue("in_review");
  await assignFixtureCase(owner, id, otherStaff.id);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Case unavailable" }),
  ).toBeVisible();
  await expect(page.getByText("Synthetic-only case description")).toHaveCount(
    0,
  );
  await otherStaff.page.goto(`/admin/support/${id}`);
  await expect(
    otherStaff.page.getByRole("heading", { name: "Change local status" }),
  ).toBeVisible();
  await user.page.goto(`/support/${id}`);
  await expect(
    user.page.getByText("Reviewer reassigned by local tooling", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    user.page.getByRole("button", { name: "Save case status" }),
  ).toHaveCount(0);
  await Promise.all([
    user.context.close(),
    staff.context.close(),
    otherStaff.context.close(),
  ]);
});

test("signed-out entries, cross-requester/reviewer denial, admin no-bypass and suspension are honest", async ({
  browser,
}, info) => {
  const user = await actor(browser),
    foreign = await actor(browser),
    admin = await actor(browser, true);
  const id = await create(
    user.page,
    "Synthetic private case hidden from unrelated people",
  );
  await foreign.page.goto(`/support/${id}`);
  await expect(
    foreign.page.getByRole("heading", { name: "Case unavailable" }),
  ).toBeVisible();
  await expect(
    foreign.page.getByText("Synthetic-only case description"),
  ).toHaveCount(0);
  expect(
    (await foreign.context.request.get(`/api/support/${id}`)).status(),
  ).toBe(404);
  await admin.page.goto(`/admin/support/${id}`);
  await expect(
    admin.page.getByRole("heading", { name: "Case unavailable" }),
  ).toBeVisible();
  expect(
    (await admin.context.request.get(`/api/admin/support/${id}`)).status(),
  ).toBe(403);
  const anon = await browser.newContext({ baseURL });
  const page = await anon.newPage();
  await page.goto("/report-a-concern");
  await expect(
    page.getByRole("heading", { name: "Sign in for fictional testing" }),
  ).toBeVisible();
  await expect(
    page.getByText(/not monitored and is not an emergency/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).last().click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await page.goto(`/support/${id}`);
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  expect((await anon.request.get(`/api/support/${id}`)).status()).toBe(401);
  for (const route of ["/", "/tutors", "/contact"])
    expect(await (await anon.request.get(route)).text()).not.toContain(
      "Synthetic private case hidden from unrelated people",
    );
  await owner.pool.query(
    "UPDATE user_access SET status='suspended' WHERE user_id=$1",
    [user.id],
  );
  await user.page.goto("/contact");
  await expect(
    user.page.getByRole("heading", { name: "Local reporting unavailable" }),
  ).toBeVisible();
  await expect(
    user.page.getByRole("button", { name: "Save fictional report" }),
  ).toHaveCount(0);
  await foreign.page.setViewportSize({ width: 320, height: 720 });
  await accessible(foreign.page);
  await foreign.page.screenshot({
    path: info.outputPath("support-unavailable.png"),
    fullPage: true,
  });
  await Promise.all([
    user.context.close(),
    foreign.context.close(),
    admin.context.close(),
    anon.close(),
  ]);
});
