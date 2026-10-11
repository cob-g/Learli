import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import {
  provisionRestrictionTarget,
  authorizeRestrictionTarget,
  revokeRestrictionTarget,
} from "../../src/features/account-restrictions/fixture-tooling";
const baseURL = process.env.APP_URL!,
  owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
test.use({ trace: "off", screenshot: "off" });
async function actor(browser: Browser, admin = false) {
  const context = await browser.newContext({ baseURL }),
    email = `restriction-browser-${randomUUID()}@learli.test`,
    password = "Synthetic-browser-restriction-123";
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: {
      email,
      password,
      name: admin ? "Synthetic staff fixture" : "Synthetic target fixture",
    },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  if (admin)
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
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
  return { context, page: await context.newPage(), id };
}
async function setup(browser: Browser) {
  const staff = await actor(browser, true),
    target = await actor(browser);
  await provisionRestrictionTarget(owner, target.id);
  await authorizeRestrictionTarget(owner, staff.id, target.id);
  return { staff, target };
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
async function openConfirmation(page: Page, restore = false) {
  await page
    .getByLabel("Local test reason")
    .selectOption(restore ? "local_restore_test" : "local_access_test");
  await page
    .getByRole("button", {
      name: restore ? "Restore local account" : "Suspend local account",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function waitForLock() {
  for (let i = 0; i < 100; i++) {
    const r = await owner.pool.query(
      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%change_local_account_access%'",
    );
    if (r.rows[0].count > 0) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error("Expected real function lock wait.");
}
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(() => owner.pool.end());

test("scoped list/detail, keyboard confirmation, suspension and restoration preserve stored sessions", async ({
  browser,
}, info) => {
  const { staff, target } = await setup(browser),
    page = staff.page;
  await page.goto("/admin/accounts");
  await expect(
    page.getByRole("heading", {
      name: "Authorized local accounts",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Synthetic target fixture", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Account access for Synthetic target fixture",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Suspend local account", exact: true })
    .click();
  await expect(page.getByLabel("Local test reason")).toBeFocused();
  await expect(
    page.getByText("Choose a local test reason.", { exact: true }),
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
        path: info.outputPath(`restriction-active-${width}.png`),
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("restriction-forced-colors-320.png"),
    fullPage: true,
  });
  await page.emulateMedia({
    forcedColors: "none",
    reducedMotion: "no-preference",
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("restriction-text-zoom-1440.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  await openConfirmation(page);
  await accessible(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Suspend local account", exact: true }),
  ).toBeFocused();
  await openConfirmation(page);
  await page
    .getByRole("button", { name: "Suspend account access", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Local action recorded");
  await expect(
    page.getByText("Suspended access", { exact: true }),
  ).toBeVisible();
  expect(
    (await target.context.request.get(`/api/account/${target.id}`)).status(),
  ).toBe(403);
  expect(
    (
      await owner.pool.query(
        "SELECT count(*)::int AS n FROM session WHERE user_id=$1",
        [target.id],
      )
    ).rows[0].n,
  ).toBeGreaterThan(0);
  await page.screenshot({
    path: info.outputPath("restriction-suspended-1440.png"),
    fullPage: true,
  });
  await openConfirmation(page, true);
  await page
    .getByRole("button", { name: "Restore account access", exact: true })
    .click();
  await expect(page.getByText("Active access", { exact: true })).toBeVisible();
  expect(
    (await target.context.request.get(`/api/account/${target.id}`)).status(),
  ).toBe(200);
  await expect(
    page.getByText("Local restoration test", { exact: false }),
  ).toBeVisible();
  const response = await page.request.get(`/api/admin/accounts/${target.id}`);
  expect(response.headers()["cache-control"]).toBe(
    "private, no-store, max-age=0",
  );
  expect(await page.title()).not.toContain("Synthetic target");
  expect(
    await page.locator('meta[name="robots"]').getAttribute("content"),
  ).toContain("noindex");
  await staff.context.close();
  await target.context.close();
});

test("empty/foreign/revoked and native no-JS reads disclose only exact targets", async ({
  browser,
}, info) => {
  const { staff, target } = await setup(browser),
    other = await actor(browser, true);
  await other.page.goto("/admin/accounts");
  await expect(
    other.page.getByRole("heading", { name: "No accounts authorized for you" }),
  ).toBeVisible();
  await accessible(other.page);
  await other.page.screenshot({
    path: info.outputPath("restriction-empty.png"),
    fullPage: true,
  });
  await other.page.goto(`/admin/accounts/${target.id}`);
  await expect(
    other.page.getByRole("heading", {
      name: "Account unavailable",
      exact: true,
    }),
  ).toBeVisible();
  expect(await other.page.locator("body").innerText()).not.toContain(
    "Synthetic target",
  );
  await accessible(other.page);
  await other.page.screenshot({
    path: info.outputPath("restriction-denied.png"),
    fullPage: true,
  });
  const native = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      storageState: await staff.context.storageState(),
    }),
    page = await native.newPage();
  await page.goto("/admin/accounts");
  await page
    .getByRole("link", { name: "Synthetic target fixture", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Account access for Synthetic target fixture",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("No local access actions have been recorded."),
  ).toBeVisible();
  await expect(
    page.getByText("Enable JavaScript", { exact: false }),
  ).toBeVisible();
  await revokeRestrictionTarget(owner, staff.id, target.id);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Account unavailable", exact: true }),
  ).toBeVisible();
  await native.close();
  await other.context.close();
  await staff.context.close();
  await target.context.close();
});

test("actual lock pending, stale edit conflict and retry reload remain accessible", async ({
  browser,
}, info) => {
  const { staff, target } = await setup(browser),
    page = staff.page;
  await page.goto(`/admin/accounts/${target.id}`);
  const readBlocker = await owner.pool.connect();
  try {
    await readBlocker.query("BEGIN");
    await readBlocker.query(
      "LOCK TABLE account_restriction_targets IN ACCESS EXCLUSIVE MODE",
    );
    await page
      .getByRole("button", { name: "Reload account", exact: true })
      .click();
    for (let i = 0; i < 100; i++) {
      const result = await owner.pool.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%account_restriction_targets%' AND query NOT LIKE '%change_local_account_access%'",
      );
      if (result.rows[0].n > 0) break;
      if (i === 99)
        throw Error("Expected real private restriction read lock wait.");
      await new Promise((r) => setTimeout(r, 20));
    }
    await expect(
      page.getByText("Loading account…", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Account access for Synthetic target fixture",
      }),
    ).toBeVisible();
    await accessible(page);
    await page.screenshot({
      path: info.outputPath("restriction-read-pending.png"),
      fullPage: true,
    });
    await readBlocker.query("COMMIT");
    await expect(
      page.getByText("Loading account…", { exact: true }),
    ).not.toBeVisible();
  } finally {
    await readBlocker.query("ROLLBACK");
    readBlocker.release();
  }
  await openConfirmation(page);
  const blocker = await owner.pool.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query(
      "SELECT user_id FROM account_restriction_targets WHERE user_id=$1 FOR UPDATE",
      [target.id],
    );
    await page
      .getByRole("button", { name: "Suspend account access", exact: true })
      .click();
    await waitForLock();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Recording local action…" }),
    ).toHaveAttribute("aria-disabled", "true");
    await accessible(page);
    await page.screenshot({
      path: info.outputPath("restriction-pending.png"),
      fullPage: true,
    });
    await expect(
      page
        .getByRole("dialog")
        .getByText(
          "Closing this dialog cannot cancel the submitted local action.",
        ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close confirmation", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const pendingButton = page.getByRole("button", {
      name: "Recording local action…",
      exact: true,
    });
    await expect(pendingButton).toHaveAttribute("aria-disabled", "true");
    await pendingButton.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await blocker.query("COMMIT");
    await expect(
      page.getByText("Suspended access", { exact: true }),
    ).toBeVisible();
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
  // Keep the displayed revision stale while another exact action restores access.
  const response = await staff.context.request.patch(
    `/api/admin/accounts/${target.id}`,
    {
      headers: { origin: baseURL },
      data: {
        revision: 1,
        status: "active",
        reason: "local_restore_test",
        requestKey: randomUUID(),
      },
    },
  );
  expect(response.status()).toBe(200);
  await openConfirmation(page, true);
  await page
    .getByRole("button", { name: "Restore account access", exact: true })
    .click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "This account or request changed",
  );
  await expect(page.locator("p[role=alert]")).toBeFocused();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("restriction-conflict.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Reload account", exact: true })
    .click();
  await expect(page.getByText("Active access", { exact: true })).toBeVisible();
  await staff.context.close();
  await target.context.close();
});

test("failed mutation shows safe error and retries the same request identity", async ({
  browser,
}, info) => {
  const { staff, target } = await setup(browser),
    page = staff.page;
  await page.goto(`/admin/accounts/${target.id}`);
  let firstKey = "";
  await page.route(`**/api/admin/accounts/${target.id}`, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    firstKey = route.request().postDataJSON().requestKey;
    await route.fulfill({
      status: 503,
      json: {
        message: "Local account restrictions are unavailable. Try again later.",
      },
    });
  });
  await openConfirmation(page);
  await page
    .getByRole("button", { name: "Suspend account access", exact: true })
    .click();
  await expect(page.locator("p[role=alert]")).toContainText("unavailable");
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("restriction-error.png"),
    fullPage: true,
  });
  await page.unroute(`**/api/admin/accounts/${target.id}`);
  await openConfirmation(page);
  const request = page.waitForRequest(
    (r) => r.method() === "PATCH" && r.url().endsWith(target.id),
  );
  await page
    .getByRole("button", { name: "Suspend account access", exact: true })
    .click();
  expect((await request).postDataJSON().requestKey).toBe(firstKey);
  await expect(
    page.getByText("Suspended access", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await owner.pool.query(
        "SELECT count(*)::int AS n FROM account_restriction_events WHERE target_user_id=$1",
        [target.id],
      )
    ).rows[0].n,
  ).toBe(1);
  await staff.context.close();
  await target.context.close();
});
