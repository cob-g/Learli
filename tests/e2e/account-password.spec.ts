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
const password = "Synthetic-password-browser-passphrase-123";
const replacement = "Changed-password-browser-passphrase-123";
async function signIn(context: BrowserContext, email: string, pass = password) {
  return context.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL },
    data: { email, password: pass },
  });
}
async function actor(browser: Browser, javaScriptEnabled = true) {
  const context = await browser.newContext({ baseURL, javaScriptEnabled });
  const email = `password-${randomUUID()}@learli.test`;
  const response = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic password account" },
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  expect((await signIn(context, email)).status()).toBe(200);
  return { context, page: await context.newPage(), email, id };
}
async function fill(page: Page, current = password, changed = replacement) {
  await page.getByLabel("Current password", { exact: true }).fill(current);
  await page.getByLabel("New password", { exact: true }).fill(changed);
  await page.getByLabel("Confirm new password", { exact: true }).fill(changed);
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
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
  await owner.pool.query("UPDATE rate_limit SET count=0");
});
test.afterAll(() => owner.pool.end());

test("password rotation, two browser sessions, keyboard/paste and responsive safe states", async ({
  browser,
}, info) => {
  const account = await actor(browser);
  const other = await browser.newContext({ baseURL });
  try {
    expect((await signIn(other, account.email)).status()).toBe(200);
    await account.page.goto("/account");
    const page = account.page;
    await expect(
      page.getByRole("heading", { name: "Change password" }),
    ).toBeVisible();
    await expect(page.getByLabel("Current password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    await expect(
      page.getByLabel("New password", { exact: true }),
    ).toHaveAttribute("autocomplete", "new-password");
    for (const [width, height] of [
      [320, 720],
      [390, 844],
      [768, 900],
      [1024, 900],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await accessible(page);
      const button = page.getByRole("button", {
        name: "Change password",
        exact: true,
      });
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({
        path: info.outputPath(`password-empty-${width}.png`),
        fullPage: true,
        mask: [page.getByText(/^Signed in as/)],
      });
    }
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(page.getByLabel("Current password")).toBeFocused();
    await expect(page.getByLabel("Current password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await accessible(page);
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill("different");
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    const summary = page.getByRole("alert", {
      name: "Check these password fields",
    });
    await expect(summary).toBeVisible();
    await expect(
      page.getByLabel("Current password", { exact: true }),
    ).toBeFocused();
    await summary.focus();
    await expect(summary).toBeFocused();
    for (const label of [
      "Current password",
      "New password",
      "Confirm new password",
    ]) {
      const field = page.getByLabel(label, { exact: true });
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(field).toHaveAttribute("aria-describedby", /-error$/);
      const link = summary.getByRole("link", {
        name: new RegExp(`^${label}:`),
      });
      await link.focus();
      await page.keyboard.press("Enter");
      await expect(field).toBeFocused();
    }
    // Clear all entered values before any capture; errors remain until resubmit.
    await page.getByLabel("New password", { exact: true }).fill("");
    await page.getByLabel("Confirm new password", { exact: true }).fill("");
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await accessible(page);
      await page.screenshot({
        path: info.outputPath(`password-summary-${width}.png`),
        fullPage: true,
        mask: [page.getByText(/^Signed in as/)],
      });
    }
    await fill(page, "Wrong synthetic password");
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Change password", exact: true })
        .getByRole("alert"),
    ).toHaveText(/Check your current password/);
    await expect(summary).toHaveCount(0);
    await expect(
      page
        .getByRole("region", { name: "Change password", exact: true })
        .getByRole("alert"),
    ).toBeFocused();
    await expect(page.getByLabel("Current password")).toHaveValue("");
    await accessible(page);
    await page.screenshot({
      path: info.outputPath("password-refused.png"),
      fullPage: true,
      mask: [page.getByText(/^Signed in as/)],
    });
    // Fill uses native editable controls; actual paste has no interception.
    await page.getByLabel("Current password").focus();
    await page.evaluate((value) => {
      const input = document.querySelector<HTMLInputElement>(
        "#password-currentPassword",
      )!;
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      });
      event.clipboardData!.setData("text/plain", value);
      if (!input.dispatchEvent(event)) throw Error("Paste was prevented");
    }, password);
    await fill(page);
    const result = page.waitForResponse((response) =>
      response.url().endsWith("/api/account/password"),
    );
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    const response = await result;
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ status: true });
    const rows = await owner.pool.query(
      "SELECT token FROM session WHERE user_id=$1",
      [account.id],
    );
    for (const row of rows.rows) expect(text.includes(row.token)).toBe(false);
    const notice = page
      .getByRole("status")
      .filter({ hasText: "Password changed. Other sessions ended." });
    await expect(notice).toBeVisible();
    await expect(notice).toBeFocused();
    expect((await other.request.get("/api/account/sessions")).status()).toBe(
      401,
    );
    expect((await page.request.get("/api/account/sessions")).status()).toBe(
      200,
    );
    const html = await page.request.get("/account");
    expect(html.headers()["cache-control"]).toContain("no-store");
    const markup = await html.text();
    expect(markup).toContain("noindex");
    for (const row of rows.rows) expect(markup.includes(row.token)).toBe(false);
    expect((await signIn(other, account.email, password)).status()).toBe(401);
    expect((await signIn(other, account.email, replacement)).status()).toBe(
      200,
    );
    await accessible(page);
    await page.screenshot({
      path: info.outputPath("password-changed.png"),
      fullPage: true,
      mask: [page.getByText(/^Signed in as/)],
    });
  } finally {
    await account.context.close();
    await other.close();
  }
});

test("stale-session reauthentication preserves safe return and suspended account denial", async ({
  browser,
}) => {
  const account = await actor(browser);
  try {
    await owner.pool.query(
      "UPDATE session SET created_at=clock_timestamp()-interval '25 hours' WHERE user_id=$1",
      [account.id],
    );
    await account.page.goto("/account");
    await fill(account.page);
    await account.page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(
      account.page
        .getByRole("region", { name: "Change password", exact: true })
        .getByRole("alert"),
    ).toHaveText(/Sign out, then sign in again/);
    await expect(
      account.page.getByRole("link", { name: "Sign in again" }),
    ).toHaveAttribute("href", "/sign-in?next=%2Faccount");
    await account.page
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await account.page.goto("/sign-in?next=%2Faccount");
    await account.page.getByLabel("Test email").fill(account.email);
    await account.page.getByLabel("Password", { exact: true }).fill(password);
    await account.page
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(account.page).toHaveURL(/\/account$/);
    await owner.pool.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [account.id],
    );
    const response = await account.context.request.post(
      "/api/account/password",
      {
        headers: { origin: baseURL },
        data: {
          currentPassword: password,
          newPassword: replacement,
          confirmPassword: replacement,
        },
      },
    );
    expect(response.status()).toBe(403);
    await account.page.reload();
    await expect(
      account.page.getByRole("heading", { name: "Account access unavailable" }),
    ).toBeVisible();
  } finally {
    await account.context.close();
  }
});

test("real database pending state and uncertain service recovery remain accessible with empty fields", async ({
  browser,
}, info) => {
  const account = await actor(browser);
  const client = await owner.pool.connect();
  try {
    await account.page.goto("/account");
    await fill(account.page);
    await client.query("BEGIN");
    await client.query("LOCK TABLE session IN ACCESS EXCLUSIVE MODE");
    await account.page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(
      account.page
        .getByRole("status")
        .filter({ hasText: "Changing your password." }),
    ).toBeVisible();
    await expect(account.page.getByLabel("Current password")).toHaveValue("");
    await expect(
      account.page.getByRole("button", { name: "Changing password…" }),
    ).toBeDisabled();
    await accessible(account.page);
    await account.page.screenshot({
      path: info.outputPath("password-pending.png"),
      fullPage: true,
      mask: [account.page.getByText(/^Signed in as/)],
    });
    await client.query("COMMIT");
    await expect(
      account.page.getByRole("status").filter({ hasText: "Password changed." }),
    ).toBeVisible();
    await account.page.route("**/api/account/password", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "private provider internals" }),
      }),
    );
    await fill(account.page, replacement, "Another-synthetic-password-123");
    await account.page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(
      account.page
        .getByRole("region", { name: "Change password", exact: true })
        .getByRole("alert"),
    ).toHaveText(/couldn't confirm the password change/);
    await expect(
      account.page.getByRole("link", { name: "Reset password" }),
    ).toHaveAttribute("href", "/forgot-password");
    await accessible(account.page);
    await account.page.screenshot({
      path: info.outputPath("password-uncertain.png"),
      fullPage: true,
      mask: [account.page.getByText(/^Signed in as/)],
    });
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await account.context.close();
  }
});

test("no-JS controls cannot submit credentials and HTTP boundary denies origin/throttle bypass", async ({
  browser,
}) => {
  const native = await actor(browser, false);
  const enhanced = await actor(browser);
  try {
    await native.page.goto("/account");
    await expect(
      native.page.getByText("Enable JavaScript to change your password here."),
    ).toBeVisible();
    await expect(native.page.getByLabel("Current password")).toBeDisabled();
    await expect(
      native.page.getByRole("button", { name: "Change password", exact: true }),
    ).toBeDisabled();
    const body = {
      currentPassword: "Wrong synthetic password",
      newPassword: replacement,
      confirmPassword: replacement,
    };
    expect(
      (
        await enhanced.context.request.post("/api/account/password", {
          headers: { origin: "https://foreign.test" },
          data: body,
        })
      ).status(),
    ).toBe(403);
    for (let i = 0; i < 6; i++) {
      const response = await enhanced.context.request.post(
        "/api/account/password",
        {
          headers: { origin: baseURL, "x-forwarded-for": `192.0.2.${i + 1}` },
          data: body,
        },
      );
      expect(response.status()).toBe(i < 5 ? 400 : 429);
    }
    const anonymous = await browser.newContext({ baseURL });
    try {
      expect(
        (
          await anonymous.request.post("/api/account/password", {
            headers: { origin: baseURL },
            data: body,
          })
        ).status(),
      ).toBe(401);
    } finally {
      await anonymous.close();
    }
  } finally {
    await native.context.close();
    await enhanced.context.close();
  }
});
