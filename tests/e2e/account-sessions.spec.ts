import { randomUUID } from "node:crypto";
import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";

test.use({ trace: "off", screenshot: "off" });
const baseURL = process.env.APP_URL!;
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const password = "Synthetic-session-browser-passphrase-123";
async function actor(browser: Browser) {
  const context = await browser.newContext({ baseURL });
  const email = `session-${randomUUID()}@learli.test`;
  const response = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic session account" },
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).user.id as string;
  await owner.pool.query(
    'UPDATE "user" SET email_verified = true WHERE id = $1',
    [id],
  );
  await signIn(context, email);
  return { context, page: await context.newPage(), id, email };
}
async function signIn(context: BrowserContext, email: string) {
  const response = await context.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
}
async function summaries(context: BrowserContext) {
  const response = await context.request.get("/api/account/sessions");
  expect(response.status()).toBe(200);
  return (await response.json()).sessions as { id: string; current: boolean }[];
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
test.beforeEach(async () => {
  await owner.pool.query("UPDATE rate_limit SET count = 0");
});
test.afterAll(() => owner.pool.end());

test("two browser sessions, keyboard confirmation and immediate revoked-access denial", async ({
  browser,
}, info) => {
  const account = await actor(browser);
  const other = await browser.newContext({ baseURL });
  await signIn(other, account.email);
  const otherPage = await other.newPage();
  await otherPage.goto("/account");
  await account.page.goto("/account");
  await account.page
    .getByRole("link", { name: "Manage account sessions" })
    .click();
  const page = account.page;
  await expect(page).toHaveTitle("Account sessions | Learli");
  await expect(
    page.getByRole("heading", { name: "Current session", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "End other session 1" }),
  ).toBeVisible();
  await expect(
    page.getByText("Session refreshed", { exact: true }),
  ).toHaveCount(2);
  const privateRows = await owner.pool.query(
    "SELECT token, ip_address, user_agent FROM session WHERE user_id = $1",
    [account.id],
  );
  const listResponse = await page.request.get("/api/account/sessions");
  const listText = await listResponse.text();
  const htmlResponse = await page.request.get("/account/sessions");
  const html = await htmlResponse.text();
  expect(htmlResponse.headers()["cache-control"]).toContain("no-store");
  expect(html).toContain("noindex");
  for (const row of privateRows.rows) {
    expect(listText.includes(row.token)).toBe(false);
    expect(html.includes(row.token)).toBe(false);
  }
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [768, 900],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
    const button = page.getByRole("button", { name: "End other session 1" });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: info.outputPath(`sessions-${width}.png`),
      fullPage: true,
    });
  }
  const trigger = page.getByRole("button", { name: "End other session 1" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "End this other session?" }),
  ).toBeVisible();
  await accessible(page);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End session", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Session ended." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /End other session/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Session ended." }),
  ).toBeFocused();
  expect((await other.request.get("/api/account/sessions")).status()).toBe(401);
  await otherPage.reload();
  await expect(otherPage).toHaveURL(/\/sign-in\?next=/);
  await expect(
    page.getByRole("heading", { name: "Current session", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/account/sessions");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fsessions/);
  await Promise.all([account.context.close(), other.close()]);
});

test("foreign and current IDs, forbidden raw APIs and account gates stay protected", async ({
  browser,
}) => {
  const attacker = await actor(browser);
  const victim = await actor(browser);
  const foreign = (await summaries(victim.context))[0].id;
  const current = (await summaries(attacker.context))[0].id;
  for (const [sessionId, status] of [
    [foreign, 404],
    [current, 409],
  ] as const) {
    const response = await attacker.context.request.post(
      "/api/account/sessions/revoke",
      { headers: { origin: baseURL }, data: { sessionId } },
    );
    expect(response.status()).toBe(status);
  }
  expect(
    (
      await attacker.context.request.post("/api/account/sessions/revoke", {
        headers: { origin: "https://foreign.test" },
        data: { sessionId: foreign },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await attacker.context.request.get("/api/auth/list-sessions")).status(),
  ).toBe(404);
  expect(
    (await victim.context.request.get("/api/account/sessions")).status(),
  ).toBe(200);
  await owner.pool.query(
    "UPDATE user_access SET status='suspended' WHERE user_id=$1",
    [attacker.id],
  );
  expect(
    (await attacker.context.request.get("/api/account/sessions")).status(),
  ).toBe(403);
  await attacker.page.goto("/account/sessions");
  await expect(
    attacker.page.getByRole("heading", {
      name: "Account sessions unavailable",
    }),
  ).toBeVisible();
  await expect(
    attacker.page.getByRole("heading", {
      name: "Current session",
      exact: true,
    }),
  ).toHaveCount(0);
  await Promise.all([attacker.context.close(), victim.context.close()]);
});

test("honest loading, empty, network and uncertain mutation states", async ({
  browser,
}, info) => {
  const account = await actor(browser);
  const other = await browser.newContext({ baseURL });
  await signIn(other, account.email);
  const page = account.page;
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/account/sessions", async (route) => {
    await held;
    await route.fulfill({ json: { sessions: [] } });
  });
  await page.goto("/account/sessions");
  await expect(
    page.getByText("Loading sessions…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No active sessions returned", { exact: true }),
  ).toHaveCount(0);
  release!();
  await expect(
    page.getByRole("heading", { name: "No active sessions returned" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("sessions-empty.png"),
    fullPage: true,
  });
  await page.unroute("**/api/account/sessions");
  await page.route("**/api/account/sessions", (route) => route.abort());
  await page.getByRole("button", { name: "Refresh sessions" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Sessions could not be loaded" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No active sessions returned" }),
  ).toHaveCount(0);
  await page.unroute("**/api/account/sessions");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "End other session 1" }),
  ).toBeVisible();
  await page.route("**/api/account/sessions/revoke", (route) => route.abort());
  await page.getByRole("button", { name: "End other session 1" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End session", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "We could not confirm" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "End other session 1" }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("sessions-network-error.png"),
    fullPage: true,
  });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 400 });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("sessions-forced-colors.png"),
    fullPage: true,
  });
  await Promise.all([account.context.close(), other.close()]);
});

test("stale sign-in shows provider recovery and expired other sessions disappear", async ({
  browser,
}, info) => {
  const account = await actor(browser);
  const other = await browser.newContext({ baseURL });
  await signIn(other, account.email);
  const remote = (await summaries(other)).find((item) => item.current)!;
  await owner.pool.query(
    "UPDATE session SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1",
    [remote.id],
  );
  await account.page.goto("/account/sessions");
  await expect(
    account.page.getByRole("heading", { name: "Current session", exact: true }),
  ).toBeVisible();
  await expect(
    account.page.getByRole("button", { name: /End other session/ }),
  ).toHaveCount(0);
  await owner.pool.query(
    "UPDATE session SET created_at = NOW() - INTERVAL '25 hours' WHERE user_id=$1",
    [account.id],
  );
  await account.page.reload();
  await expect(
    account.page
      .getByRole("alert")
      .filter({ hasText: "Sign out, then sign in again" }),
  ).toBeVisible();
  await account.page.setViewportSize({ width: 390, height: 844 });
  await accessible(account.page);
  await account.page.screenshot({
    path: info.outputPath("sessions-freshness.png"),
    fullPage: true,
  });
  await account.page
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(account.page).toHaveURL(/\/sign-in$/);
  await Promise.all([account.context.close(), other.close()]);
});
