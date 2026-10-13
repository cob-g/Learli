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
import { totpCode } from "../support/admin-mfa";
const origin = process.env.APP_URL!;
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const password = "Synthetic-W1-browser-passphrase-123";
async function actor(browser: Browser, admin = true) {
  const context = await browser.newContext({ baseURL: origin });
  const email = `w1-browser-${randomUUID()}@learli.test`;
  const result = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { email, password, name: "Synthetic W1 administrator" },
  });
  if (!result.ok()) throw new Error("Owned synthetic signup failed.");
  const id = (await result.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  if (admin)
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
      [id],
    );
  await context.request.post("/api/auth/sign-in/email", {
    headers: { origin },
    data: { email, password },
  });
  return { context, page: await context.newPage(), email, id };
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function enable(page: Page) {
  await page.goto("/account/security");
  const passwordField = page.getByLabel("Current password", { exact: true });
  await passwordField.focus();
  await page.keyboard.insertText(password);
  // macOS WebKit uses Option+Tab to include native buttons in keyboard traversal.
  await passwordField.press(
    page.context().browser()?.browserType().name() === "webkit" &&
      process.platform === "darwin"
      ? "Alt+Tab"
      : "Tab",
  );
  await expect(
    page.getByRole("button", { name: "Set up authenticator" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-mfa-secret]").first()).toBeVisible();
  const secret = (await page
    .locator("[data-mfa-secret]")
    .first()
    .textContent())!;
  const codes = await page.locator("[data-mfa-secret] li").allTextContents();
  const factorField = page.getByLabel("Authenticator code", { exact: true });
  await factorField.focus();
  await page.keyboard.insertText(totpCode(secret));
  await factorField.press("Enter");
  await expect(
    page.getByText("Administrator verification is current.", { exact: false }),
  ).toBeVisible();
  return { secret, codes };
}
async function signIn(page: Page, email: string) {
  await page.goto("/sign-in?next=%2Fadmin");
  await page.getByLabel("Test email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Verify administrator access" }),
  ).toBeVisible();
}
async function stepUp(page: Page, secret: string) {
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totpCode(secret));
  const navigation = page.waitForEvent(
    "framenavigated",
    (frame) => frame === page.mainFrame(),
  );
  await page
    .getByRole("button", { name: "Verify administrator access" })
    .click();
  await navigation;
  await expect(
    page.getByText("Administrator verification is current.", { exact: false }),
  ).toBeVisible();
}
async function signOut(context: BrowserContext) {
  await context.request.post("/api/auth/sign-out", {
    headers: { origin },
    data: {},
  });
}
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(() => owner.pool.end());
test("real enrollment, password challenge and TOTP protect a scoped administrative mutation", async ({
  browser,
}, info) => {
  const a = await actor(browser);
  const page = a.page;
  await page.goto("/admin");
  await expect(page).toHaveURL(/account\/security/);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await accessible(page);
    await page.keyboard.press("Tab");
    await page.screenshot({
      path: info.outputPath(`security-unenrolled-${width}.png`),
      fullPage: true,
    });
  }
  const { secret } = await enable(page);
  await signOut(a.context);
  await signIn(page, a.email);
  expect((await a.context.request.get("/api/auth/get-session")).ok()).toBe(
    true,
  );
  expect(
    await (await a.context.request.get("/api/auth/get-session")).json(),
  ).toBeNull();
  await page.getByLabel("Authenticator code").fill(totpCode(secret));
  await page
    .getByRole("button", { name: "Verify administrator access" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Admin workspace" }),
  ).toBeVisible();
  const result = await page.request.post("/api/admin/subjects", {
    headers: { origin },
    data: { name: `W1 browser ${randomUUID()}` },
  });
  expect(result.status()).toBe(200);
  const html = await page.content();
  expect(html.includes(secret)).toBe(false);
  await a.context.close();
});
test("provider recovery code signs in once and reuse is denied without an admin document", async ({
  browser,
}) => {
  const a = await actor(browser),
    page = a.page;
  const { secret, codes } = await enable(page);
  await signOut(a.context);
  await signIn(page, a.email);
  await page.getByRole("button", { name: "Use recovery code" }).click();
  await page.getByLabel("Recovery code", { exact: true }).fill(codes[0]);
  await page
    .getByRole("button", { name: "Verify administrator access" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Admin workspace" }),
  ).toBeVisible();
  await signOut(a.context);
  await owner.pool.query("UPDATE rate_limit SET count=0");
  await signIn(page, a.email);
  await page.getByRole("button", { name: "Use recovery code" }).click();
  await page.getByLabel("Recovery code", { exact: true }).fill(codes[0]);
  await page
    .getByRole("button", { name: "Verify administrator access" })
    .click();
  await expect(
    page
      .getByRole("alert", { name: "", exact: true })
      .filter({ hasText: "Security verification could not" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Admin workspace" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Use authenticator code" }).click();
  await page.getByLabel("Authenticator code").fill(totpCode(secret));
  await page
    .getByRole("button", { name: "Verify administrator access" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Admin workspace" }),
  ).toBeVisible();
  await a.context.close();
});
test("rotation and disabling need fresh factor/password and remove privileged access", async ({
  browser,
}) => {
  const a = await actor(browser),
    page = a.page;
  const { secret, codes } = await enable(page);
  await owner.pool.query(
    "UPDATE admin_assurance_receipts SET verified_at=now()-interval '6 minutes' WHERE user_id=$1",
    [a.id],
  );
  await page.getByLabel("Current password for security change").fill(password);
  await page.getByRole("button", { name: "Replace recovery codes" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Security verification could not" }),
  ).toBeVisible();
  await stepUp(page, secret);
  await page.getByLabel("Current password for security change").fill(password);
  await page.getByRole("button", { name: "Replace recovery codes" }).click();
  await expect(
    page.getByRole("heading", { name: "Save recovery codes privately" }),
  ).toBeVisible();
  const rotated = await page.locator("[data-mfa-secret] li").allTextContents();
  expect(rotated.length).toBe(10);
  expect(
    (
      await page.request.post("/api/admin/subjects", {
        headers: { origin },
        data: { name: "Password-only denied" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/auth/two-factor/verify-backup-code", {
        headers: { origin },
        data: { code: codes[0] },
      })
    ).status(),
  ).toBe(401);
  await page.getByRole("link", { name: "Close recovery codes" }).click();
  await stepUp(page, secret);
  await page.getByLabel("Current password for security change").fill(password);
  await page.getByRole("button", { name: "Disable authenticator" }).click();
  await expect(
    page.getByRole("button", { name: "Set up authenticator" }),
  ).toBeVisible();
  expect(
    (
      await page.request.post("/api/admin/subjects", {
        headers: { origin },
        data: { name: "Disabled admin denied" },
      })
    ).status(),
  ).toBe(403);
  await a.context.close();
});
test("safe no-JavaScript setup, transient-key navigation and account-switch Back privacy", async ({
  browser,
}) => {
  const a = await actor(browser),
    page = a.page;
  await page.goto("/account/security");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(page.locator("[data-mfa-secret]").first()).toBeVisible();
  const secret = (await page
    .locator("[data-mfa-secret]")
    .first()
    .textContent())!;
  const stored = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(stored.includes(secret)).toBe(false);
  expect(page.url().includes(secret)).toBe(false);
  await page.getByRole("link", { name: "Return to account" }).click();
  await expect(
    page.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Set up authenticator" }),
  ).toBeVisible();
  expect((await page.content()).includes(secret)).toBe(false);
  await signOut(a.context);
  await page.goto("/sign-in");
  expect((await page.content()).includes(secret)).toBe(false);
  const b = await actor(browser, false);
  await a.context.addCookies(await b.context.cookies());
  await page.goto("/account");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  // The inherited private-document guard can start a second current-auth reload
  // after Back. Require readable, secret-free actual HTML; navigation is not PASS.
  await expect
    .poll(async () => {
      try {
        return !(await page.content()).includes(secret);
      } catch {
        return false;
      }
    })
    .toBe(true);
  const nojs = await browser.newContext({
    baseURL: origin,
    javaScriptEnabled: false,
  });
  await nojs.addCookies(await b.context.cookies());
  const deniedPage = await nojs.newPage();
  await deniedPage.goto("/account/security");
  await expect(
    deniedPage.getByRole("heading", { name: "Security access unavailable" }),
  ).toBeVisible();
  // A verified admin's setup also has a truthful no-script state and inert POST.
  const c = await actor(browser);
  await nojs.addCookies(await c.context.cookies());
  await deniedPage.goto("/account/security");
  await expect(
    deniedPage.getByText(
      "JavaScript is required for secure authenticator setup and verification. No security change is made without it.",
    ),
  ).toBeVisible();
  await expect(
    deniedPage.getByRole("button", { name: "Set up authenticator" }),
  ).toBeDisabled();
  const native = await nojs.request.post("/api/auth/two-factor/enable", {
    headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    data: `password=synthetic`,
  });
  expect(native.status()).toBe(400);
  await c.context.close();
  await nojs.close();
  await b.context.close();
  await a.context.close();
});

// Installed Playwright1.64 omits failure DOM snapshots with this switch; keys/codes
// must never enter error-context artifacts. Status/error assertions remain intact.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
