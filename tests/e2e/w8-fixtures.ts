import { screeningMirrorOrigin } from "../support/readiness-placement";
import { randomUUID } from "node:crypto";
import { readFile, readdir, writeFile, mkdir, chmod } from "node:fs/promises";
import path from "node:path";
import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import { totpCode } from "../support/admin-mfa";
export const mirrorOrigin = screeningMirrorOrigin;
export let owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
let ownerClosed = false;
export function ensureOwner() {
  if (ownerClosed) {
    owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
    ownerClosed = false;
  }
}
export async function closeOwner() {
  if (!ownerClosed) {
    await owner.pool.end();
    ownerClosed = true;
  }
}
export async function fixture() {
  return JSON.parse(
    await readFile(
      ".local/screening-safeguarding/browser-fixture.json",
      "utf8",
    ),
  ) as {
    accounts: Record<string, { id: string; name: string; email: string }>;
    password: string;
    screening: { version: string; validUntil: string };
    safeguarding: { version: string; validUntil: string };
  };
}
async function verificationUrl(email: string) {
  const directory = ".local/screening-safeguarding/mirror/.local/mail/test";
  for (const file of (await readdir(directory))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()) {
    const m = JSON.parse(await readFile(path.join(directory, file), "utf8"));
    if (m.to === email && m.kind === "verification") return m.url as string;
  }
  throw new Error("Expected own synthetic capture.");
}
export async function register(browser: Browser, name: string) {
  const f = await fixture(),
    context = await browser.newContext({ baseURL: mirrorOrigin }),
    page = await context.newPage(),
    errors: string[] = [],
    email = `w8-${randomUUID()}@learli.test`;
  page.on("request", (r) => {
    if (r.isNavigationRequest()) {
      const u = new URL(r.url());
      if (
        ["/sign-in", "/account", "/api/auth/verify-email"].includes(u.pathname)
      )
        console.log("W8 auth navigation metadata", {
          method: r.method(),
          path: u.pathname,
          queryKeys: Array.from(u.searchParams.keys()),
        });
    }
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("pageerror", (e) =>
    console.log(
      "W8 client startup error",
      e.name,
      e.message.replace(/https?:\/\/\S+/g, "[url omitted]"),
    ),
  );
  page.on("requestfailed", (r) =>
    console.log(
      "W8 failed asset/request",
      new URL(r.url()).pathname,
      r.failure()?.errorText,
    ),
  );
  await owner.pool.query("DELETE FROM rate_limit");
  const response = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: mirrorOrigin },
    data: { email, name, password: f.password, callbackURL: "/sign-in" },
  });
  expect(response.status()).toBe(200);
  const { user } = await response.json();
  const verified = await page.goto(await verificationUrl(email));
  expect(verified?.status()).toBe(200);
  expect(
    (
      await owner.pool.query('SELECT email_verified FROM "user" WHERE id=$1', [
        user.id,
      ])
    ).rows[0].email_verified,
  ).toBe(true);
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  const submitted = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/auth/sign-in/email" &&
      r.request().method() === "POST",
    { timeout: 30000 },
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await submitted).status()).toBe(200);
  await expect(page).toHaveURL(mirrorOrigin + "/account");
  await expect(
    page.getByRole("button", { name: "Save settings", exact: true }),
  ).toBeEnabled();
  expect(
    errors.filter((e) => /hydration|server rendered|didn.t match/i.test(e)),
  ).toEqual([]);
  const native = await browser.newContext({
      baseURL: mirrorOrigin,
      storageState: await context.storageState(),
      javaScriptEnabled: false,
    }),
    nativePage = await native.newPage();
  await nativePage.goto("/account");
  await expect(
    nativePage.getByLabel("Display name", { exact: true }),
  ).toBeDisabled();
  await expect(
    nativePage.getByLabel("Time zone", { exact: true }),
  ).toBeDisabled();
  await expect(
    nativePage.getByRole("button", { name: "Save settings", exact: true }),
  ).toBeDisabled();
  const settings = nativePage.locator('form[action^="/api/account/"]').filter({
    has: nativePage.getByRole("button", {
      name: "Save settings",
      exact: true,
    }),
  });
  expect(await settings.getAttribute("method")).toBe("post");
  expect(
    await settings.evaluate((f) =>
      Array.from(new FormData(f as HTMLFormElement).keys()),
    ),
  ).toEqual([]);
  await native.close();
  return { context, page, id: user.id as string, email };
}
export async function admin(browser: Browser, name: string) {
  const f = await fixture(),
    account = f.accounts[name],
    context = await browser.newContext({ baseURL: mirrorOrigin }),
    page = await context.newPage();
  await owner.pool.query("DELETE FROM rate_limit");
  const response = await context.request.post("/api/auth/sign-in/email", {
    headers: { origin: mirrorOrigin },
    data: { email: account.email, password: f.password },
  });
  expect(response.status()).toBe(200);
  const result = await response.json(),
    file = ".local/screening-safeguarding/browser-authenticators.json";
  let secrets: Record<string, string> = {};
  try {
    secrets = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
  }
  if (result.twoFactorRedirect) {
    expect(secrets[account.id]).toBeTruthy();
    const v = await context.request.post("/api/auth/two-factor/verify-totp", {
      headers: { origin: mirrorOrigin },
      data: { code: totpCode(secrets[account.id]) },
    });
    expect(v.status()).toBe(200);
  } else {
    const current = await (
      await context.request.get("/api/auth/get-session")
    ).json();
    if (!current.user.twoFactorEnabled) {
      const enabled = await context.request.post(
        "/api/auth/two-factor/enable",
        { headers: { origin: mirrorOrigin }, data: { password: f.password } },
      );
      expect(enabled.status()).toBe(200);
      secrets[account.id] = (await enabled.json()).secret;
      await writeFile(file, JSON.stringify(secrets), { mode: 0o600 });
    }
    const v = await context.request.post("/api/auth/two-factor/verify-totp", {
      headers: { origin: mirrorOrigin },
      data: { code: totpCode(secrets[account.id]) },
    });
    expect(v.status()).toBe(200);
  }
  await page.goto("/account");
  return { context, page, id: account.id };
}
export async function accessible(page: Page, info?: TestInfo, prefix = "w8") {
  const submit = page
    .locator(
      'form[method="post"] button[type="submit"],form[method="post"] button:not([type])',
    )
    .first();
  if (await submit.count()) await expect(submit).toBeEnabled();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
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
    if (info) {
      const directory = ".local/screening-safeguarding/screenshots";
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const file = path.join(
        directory,
        `${prefix}-${info.project.name}-${width}.png`,
      );
      await page.screenshot({ path: file, fullPage: true });
      await chmod(file, 0o600);
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({
    reducedMotion: "no-preference",
    forcedColors: "none",
  });
}
export async function decision(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Change synthetic screening?",
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Confirm screening decision" })
    .click();
}
export async function noJs(
  browser: Browser,
  context: BrowserContext,
  url: string,
) {
  const c = await browser.newContext({
      baseURL: mirrorOrigin,
      storageState: await context.storageState(),
      javaScriptEnabled: false,
    }),
    p = await c.newPage();
  await p.goto(url);
  await expect(p.getByText(/Enable JavaScript/).first()).toBeVisible();
  expect(await p.locator('form[method="post"]').count()).toBeGreaterThan(0);
  for (const button of await p
    .locator(
      'form[method="post"] button[type="submit"],form[method="post"] button:not([type])',
    )
    .all())
    await expect(button).toBeDisabled();
  await c.close();
}
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
