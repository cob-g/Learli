import { enrollBrowserAdmin } from "../support/browser-admin-mfa";
import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import { provisionFixtureDispatch } from "../../src/features/support/dispatch-tooling";
import { authorizeFixtureReviewer } from "../../src/features/support/fixture-tooling";
const baseURL = process.env.APP_URL!,
  owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
async function actor(browser: Browser, name: string, admin = false) {
  const context = await browser.newContext({ baseURL }),
    email = `support-dispatch-${randomUUID()}@learli.test`,
    password = "Synthetic-dispatch-browser-123";
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
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
  if (admin) await enrollBrowserAdmin(context, password);
  return { context, id, email, page: await context.newPage() };
}
async function fixture(browser: Browser) {
  const requester = await actor(browser, "Private requester fixture"),
    dispatcher = await actor(browser, "Dispatcher fixture", true),
    reviewer = await actor(browser, "Reviewer fixture", true),
    alternate = await actor(browser, "Alternate reviewer fixture", true);
  const response = await requester.context.request.post("/api/support", {
    headers: { origin: baseURL },
    data: {
      requestKey: randomUUID(),
      category: "safety",
      subject: "Private synthetic support subject",
      body: "Private synthetic support body sentinel",
    },
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).id as string;
  await authorizeFixtureReviewer(owner, reviewer.id);
  await authorizeFixtureReviewer(owner, alternate.id);
  await provisionFixtureDispatch(
    owner,
    id,
    dispatcher.id,
    "dispatcher",
    "authorized",
  );
  for (const staff of [reviewer, alternate])
    await provisionFixtureDispatch(
      owner,
      id,
      staff.id,
      "reviewer_choice",
      "authorized",
    );
  return {
    id,
    requester,
    dispatcher,
    reviewer,
    alternate,
    async close() {
      for (const staff of [requester, dispatcher, reviewer, alternate])
        await staff.context.close();
    },
  };
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
async function save(page: Page, reviewer: string, kind?: string) {
  await page
    .getByLabel("Reviewer fixture", { exact: true })
    .selectOption(reviewer);
  if (kind) await page.getByLabel("Local action").selectOption(kind);
  await page.getByRole("button", { name: "Record local assignment" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Local assignment recorded" }),
  ).toBeVisible();
}
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(() => owner.pool.end());
test("exact dispatcher assignment and escalation work on phone/desktop keyboard without private projection", async ({
  browser,
}, info) => {
  const f = await fixture(browser),
    page = f.dispatcher.page;
  await page.goto("/admin/support");
  await page
    .getByRole("link", { name: "Manage local assignments", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Local support assignments" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Manage local assignment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Local case assignment", exact: true }),
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
    expect(await page.locator("main").innerText()).not.toContain(
      "Private synthetic support",
    );
    if ([320, 390, 1440].includes(width))
      await page.screenshot({
        path: info.outputPath(`assignment-${width}.png`),
        fullPage: true,
      });
  }
  await page
    .getByRole("button", { name: "Record local assignment" })
    .press("Enter");
  await expect(
    page.getByLabel("Reviewer fixture", { exact: true }),
  ).toBeFocused();
  await expect(
    page.getByText("Choose a reviewer.", { exact: true }),
  ).toBeVisible();
  await save(page, f.reviewer.id);
  await expect(page.getByLabel("Local action")).toHaveValue("reassign");
  await f.reviewer.page.goto(`/admin/support/${f.id}`);
  await expect(
    f.reviewer.page.getByRole("heading", { name: "Change local status" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await save(page, f.alternate.id, "escalate");
  await expect(
    page.getByText("Local escalation reassigned reviewer · You"),
  ).toBeVisible();
  await accessible(page);
  await f.reviewer.page.reload();
  await expect(
    f.reviewer.page.getByRole("heading", { name: "Case unavailable" }),
  ).toBeVisible();
  expect(
    (
      await f.reviewer.context.request.get(`/api/admin/support/${f.id}`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await f.reviewer.context.request.patch(
        `/api/admin/support/${f.id}/status`,
        {
          headers: { origin: baseURL },
          data: { revision: 1, status: "in_review" },
        },
      )
    ).status(),
  ).toBe(404);
  await f.alternate.page.goto(`/admin/support/${f.id}`);
  await expect(
    f.alternate.page.getByRole("heading", { name: "Change local status" }),
  ).toBeVisible();
  const response = await page.request.get(
      `/api/admin/support/dispatch/${f.id}`,
    ),
    dto = await response.text();
  expect(response.headers()["cache-control"]).toContain("private, no-store");
  for (const secret of [
    f.requester.id,
    f.requester.email,
    f.reviewer.email,
    f.alternate.email,
    "Private synthetic support",
    '"body"',
    '"booking"',
    '"learner"',
    '"url"',
    '"requestKey"',
  ])
    expect(dto).not.toContain(secret);
  expect(await page.title()).toBe("Local case assignment | Learli");
  const html = await (
    await page.request.get(`/admin/support/dispatch/${f.id}`)
  ).text();
  expect(html).toContain("noindex");
  for (const secret of [
    f.requester.id,
    f.requester.email,
    f.reviewer.email,
    f.alternate.email,
    "Private synthetic support",
  ])
    expect(html).not.toContain(secret);
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 400 });
  await accessible(page);
  await page.emulateMedia({
    forcedColors: "none",
    reducedMotion: "no-preference",
  });
  // The inherited reviewer path is now awaited HTML too, with current exact assignment.
  const reviewerNative = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    storageState: await f.alternate.context.storageState(),
  });
  const reviewerPage = await reviewerNative.newPage();
  await reviewerPage.goto(`/admin/support/${f.id}`);
  await expect(
    reviewerPage.getByRole("heading", {
      name: "Private synthetic support subject",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    reviewerPage.getByText("Reviewer reassigned by local dispatcher", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    reviewerPage.getByRole("button", { name: "Save case status", exact: true }),
  ).toBeDisabled();
  await expect(
    reviewerPage.getByText(/Enable JavaScript to change local case status/),
  ).toBeVisible();
  expect(await reviewerPage.locator("form").getAttribute("method")).toBe(
    "post",
  );
  await reviewerNative.close();
  // Delay the native GET, then prove its completed document checks current authority.
  let releaseNavigation!: () => void, observedNavigation!: () => void;
  let navigationComplete = false,
    heldMethod = "",
    heldPath = "";
  const navigationGate = new Promise<void>((resolve) => {
    releaseNavigation = resolve;
  });
  const observedGate = new Promise<void>((resolve) => {
    observedNavigation = resolve;
  });
  await page.route("**/admin/support/dispatch", async (route) => {
    heldMethod = route.request().method();
    heldPath = new URL(route.request().url()).pathname;
    observedNavigation();
    await navigationGate;
    await route.continue();
  });
  const navigation = page
    .getByRole("link", { name: "Local assignments", exact: true })
    .click()
    .then(() => {
      navigationComplete = true;
    });
  try {
    await observedGate;
    expect(heldMethod).toBe("GET");
    expect(heldPath).toBe("/admin/support/dispatch");
    expect(navigationComplete).toBe(false);
    await provisionFixtureDispatch(
      owner,
      f.id,
      f.dispatcher.id,
      "dispatcher",
      "revoked",
    );
  } finally {
    releaseNavigation();
  }
  await navigation;
  await expect(
    page.getByRole("heading", {
      name: "Local support assignments",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "No cases provisioned for dispatch",
      exact: true,
    }),
  ).toBeVisible();
  const freshHtml = await page.content();
  for (const value of [
    f.id,
    f.reviewer.id,
    f.alternate.id,
    "Private synthetic support",
  ])
    expect(freshHtml).not.toContain(value);
  expect(
    (await page.request.get(`/api/admin/support/dispatch/${f.id}`)).status(),
  ).toBe(404);
  await page.unroute("**/admin/support/dispatch");
  await f.close();
});
test("pending/stale/unknown outcomes recover safely and closed cases need explicit reviewer reopening", async ({
  browser,
}) => {
  const f = await fixture(browser),
    page = f.dispatcher.page;
  await page.goto(`/admin/support/dispatch/${f.id}`);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route(`**/api/admin/support/dispatch/${f.id}`, async (route) => {
    requests++;
    await gate;
    await route.continue();
  });
  await page
    .getByLabel("Reviewer fixture", { exact: true })
    .selectOption(f.reviewer.id);
  await page.getByRole("button", { name: "Record local assignment" }).click();
  await expect(
    page.getByRole("button", { name: "Recording assignment…" }),
  ).toBeDisabled();
  await page.keyboard.press("Enter");
  expect(requests).toBe(1);
  release();
  await expect(page.getByLabel("Local action")).toHaveValue("reassign");
  await page.unroute(`**/api/admin/support/dispatch/${f.id}`);
  expect(
    (
      await f.reviewer.context.request.patch(
        `/api/admin/support/${f.id}/status`,
        {
          headers: { origin: baseURL },
          data: { revision: 1, status: "in_review" },
        },
      )
    ).status(),
  ).toBe(200);
  await page
    .getByLabel("Reviewer fixture", { exact: true })
    .selectOption(f.alternate.id);
  await page.getByRole("button", { name: "Record local assignment" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "This case or request changed" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Record local assignment" }),
  ).toBeDisabled();
  await page
    .getByRole("link", { name: "Reload assignment", exact: true })
    .click();
  expect(
    (
      await f.reviewer.context.request.patch(
        `/api/admin/support/${f.id}/status`,
        {
          headers: { origin: baseURL },
          data: { revision: 2, status: "closed" },
        },
      )
    ).status(),
  ).toBe(200);
  await page.reload();
  await expect(
    page.getByText(/currently authorized reviewer must reopen/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record local assignment" }),
  ).toHaveCount(0);
  expect(
    (
      await f.reviewer.context.request.patch(
        `/api/admin/support/${f.id}/status`,
        {
          headers: { origin: baseURL },
          data: { revision: 3, status: "in_review" },
        },
      )
    ).status(),
  ).toBe(200);
  await page.reload();
  await page.route(`**/api/admin/support/dispatch/${f.id}`, (route) =>
    route.abort(),
  );
  await page
    .getByLabel("Reviewer fixture", { exact: true })
    .selectOption(f.alternate.id);
  await page.getByRole("button", { name: "Record local assignment" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not confirm" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Record local assignment" }),
  ).toBeDisabled();
  await page.unroute(`**/api/admin/support/dispatch/${f.id}`);
  await f.close();
});
test("no-JS reads, scope denial, empty choices and revoked auth navigation remain private", async ({
  browser,
}) => {
  const f = await fixture(browser),
    page = f.dispatcher.page;
  const nojs = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      storageState: await f.dispatcher.context.storageState(),
    }),
    native = await nojs.newPage();
  await native.goto(`/admin/support/dispatch/${f.id}`);
  await expect(
    native.getByRole("heading", { name: "Local case assignment", exact: true }),
  ).toBeVisible();
  await expect(
    native.getByRole("button", { name: "Record local assignment" }),
  ).toBeDisabled();
  await expect(native.getByText(/Enable JavaScript/)).toBeVisible();
  await native
    .getByRole("link", { name: "Local assignments", exact: true })
    .click();
  await expect(
    native.getByRole("heading", { name: "Local support assignments" }),
  ).toBeVisible();
  await native.goto(`/admin/support/dispatch/${f.id}`);
  await native.screenshot({
    path: test.info().outputPath("assignment-nojs-desktop.png"),
    fullPage: true,
  });
  await nojs.close();
  await f.reviewer.page.goto("/admin/support/dispatch");
  await expect(
    f.reviewer.page.getByRole("heading", {
      name: "No cases provisioned for dispatch",
    }),
  ).toBeVisible();
  await f.reviewer.page.goto(`/admin/support/dispatch/${f.id}`);
  await expect(
    f.reviewer.page.getByRole("heading", { name: "Assignment unavailable" }),
  ).toBeVisible();
  await provisionFixtureDispatch(
    owner,
    f.id,
    f.reviewer.id,
    "reviewer_choice",
    "revoked",
  );
  await provisionFixtureDispatch(
    owner,
    f.id,
    f.alternate.id,
    "reviewer_choice",
    "revoked",
  );
  await page.goto(`/admin/support/dispatch/${f.id}`);
  await expect(
    page.getByText(/No eligible alternative reviewer/),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: test.info().outputPath("assignment-empty-phone.png"),
    fullPage: true,
  });
  await owner.pool.query("DELETE FROM session WHERE user_id=$1", [
    f.dispatcher.id,
  ]);
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  let html = await page.content();
  for (const value of [f.id, f.reviewer.id, f.alternate.id])
    expect(html).not.toContain(value);
  await page.goBack();
  await expect(page).toHaveURL(/\/sign-in/);
  html = await page.content();
  // The explicit requested case reference is permitted in validated auth return URLs,
  // but the prior private record/choice payload and identities must be gone.
  expect(new URL(page.url()).searchParams.get("next")).toBe(
    `/admin/support/dispatch/${f.id}`,
  );
  for (const value of [
    f.reviewer.id,
    f.alternate.id,
    f.reviewer.email,
    f.alternate.email,
    "Private synthetic support",
    "Reviewer fixture",
    "Alternate reviewer fixture",
    "Current reviewer fixture",
  ])
    expect(html).not.toContain(value);
  const bootstrap = html.replaceAll(String.fromCharCode(92), "");
  expect(bootstrap).not.toContain(`"id":"${f.id}"`);
  expect(bootstrap).not.toContain('"choices":');
  expect(bootstrap).not.toContain('"history":');
  await f.close();
});
