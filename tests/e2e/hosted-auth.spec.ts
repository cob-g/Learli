import { hostedTlsPort } from "../support/hosted-auth-placement";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
} from "node:fs";
import path from "node:path";
import { Pool, type PoolConfig } from "pg";
import { readHostedAuthPacket } from "../../src/features/hosted-auth/config-file";
import { grantHostedTestAdmin } from "../support/hosted-auth-runtime";
import { totpCode } from "../support/admin-mfa";
import { hostedBrowserOrigin } from "../support/hosted-auth-proxy";
import {
  parseVisitTimeZone,
  visitTimeZoneKey,
} from "../../src/features/public-availability/visit-timezone";

test.describe.configure({ mode: "serial" });
const password = "W3-browser-fictional-credential-only";
let activeEmail = "hosted@example.test",
  activePassword = password;
type State = {
  version: number;
  mirror: string;
  captures: string;
  origin: string;
  ownerSettings: PoolConfig;
  startup: { deniedPeer: number; wrongCaDenied: boolean };
  privateMarkers: string[];
  bundlePrivacy: { scanned: number; privateMarkersAbsent: boolean };
};
function state() {
  const value = readHostedAuthPacket(
    process.cwd(),
    path.resolve(".local/hosted-auth/browser-state.json"),
  ) as State;
  if (
    value.version !== 1 ||
    value.origin !== hostedBrowserOrigin ||
    value.ownerSettings.host !== "127.0.0.1" ||
    value.ownerSettings.port !== hostedTlsPort ||
    value.ownerSettings.database !== "learli_staging" ||
    value.ownerSettings.user !== "learli_migrator"
  )
    throw new Error("Owned browser fixture required.");
  return value;
}
async function owner<T>(operation: (pool: Pool) => Promise<T>) {
  const pool = new Pool(state().ownerSettings);
  try {
    return await operation(pool);
  } finally {
    await pool.end();
  }
}
function mail(email: string, subject: string) {
  const directory = state().captures;
  const records = readdirSync(directory)
    .filter((name) => name !== "response.json")
    .sort()
    .map(
      (name) =>
        JSON.parse(readFileSync(path.join(directory, name), "utf8")) as {
          body: { to: string[]; subject: string; text: string };
        },
    );
  const result = records
    .filter((v) => v.body.to[0] === email && v.body.subject === subject)
    .at(-1);
  if (!result) throw new Error("Actual SDK proof capture missing.");
  return result.body.text;
}
function proofLink(email: string, subject: string) {
  const value = mail(email, subject)
    .split("\n")
    .find((line) => line.startsWith(`${hostedBrowserOrigin}/api/auth/`));
  if (!value) throw new Error("Proof link missing");
  return value;
}
function proofCode(email: string, subject: string) {
  const value = /code in your signed-in account: (\d{6})/.exec(
    mail(email, subject),
  );
  if (!value) throw new Error("Proof code missing");
  return value[1];
}
async function signIn(
  page: Page,
  email = activeEmail,
  credential = activePassword,
  navigate = true,
) {
  if (navigate) await page.goto("/sign-in?next=%2Faccount");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(credential);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${hostedBrowserOrigin}/account`);
}
async function register(page: Page, email: string) {
  await page.goto("/sign-up?next=%2Faccount");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic HTTPS owner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Registration request received." }),
  ).toBeVisible();
  await page.goto(proofLink(email, "Verify your Learli email"));
  await expect(page).toHaveURL(/\/sign-in\?verified=1/);
}
test.beforeEach(async () => {
  await owner((pool) => pool.query("DELETE FROM rate_limit"));
});
test.afterEach(async ({ page }) => {
  // Remove transient credential regions before automatic failure context capture.
  await page
    .locator("[data-mfa-secret]")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
    .catch(() => undefined);
  await page
    .locator('input[type="password"]')
    .evaluateAll((nodes) =>
      nodes.forEach((node) => {
        if (node instanceof HTMLInputElement) node.value = "";
      }),
    )
    .catch(() => undefined);
});

test("actual HTTPS registration, verification, sign-in, host-only secure cookies and scoped account access", async ({
  page,
  context,
}) => {
  expect(state().startup.deniedPeer).toBe(403);
  expect(state().startup.wrongCaDenied).toBe(true);
  expect(state().bundlePrivacy.scanned).toBeGreaterThan(0);
  expect(state().bundlePrivacy.privateMarkersAbsent).toBe(true);
  await register(page, activeEmail);
  await signIn(page);
  const cookies = await context.cookies();
  const preference = cookies.find((cookie) => cookie.name === visitTimeZoneKey);
  expect(preference).toMatchObject({
    secure: true,
    httpOnly: false,
    sameSite: "Lax",
    domain: "127.0.0.1",
    path: "/",
    expires: -1,
  });
  expect(parseVisitTimeZone(preference?.value)).toBeTruthy();
  const authCookies = cookies.filter(
    (cookie) => cookie.name !== visitTimeZoneKey,
  );
  expect(authCookies.length).toBeGreaterThan(0);
  for (const cookie of authCookies) {
    expect(cookie.secure).toBe(true);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(cookie.domain).toBe("127.0.0.1");
  }
  expect(
    (await owner((pool) => pool.query("SELECT count(*) FROM user_roles")))
      .rows[0].count,
  ).toBe("0");
  const foreign = await page.request.get(
    `${hostedBrowserOrigin}/api/account/foreign`,
  );
  expect(foreign.status()).toBe(404);
  expect(foreign.headers()["cache-control"]).toContain("no-store");
  const rejected = await page.request.post(
    `${hostedBrowserOrigin}/api/auth/sign-up/email`,
    {
      headers: { origin: hostedBrowserOrigin },
      data: { email: "unlisted@example.test", name: "Synthetic", password },
    },
  );
  expect(rejected.status()).toBe(400);
  const csrf = await page.request.post(
    `${hostedBrowserOrigin}/api/auth/sign-out`,
    { headers: { origin: "https://attacker.test" }, data: {} },
  );
  expect(csrf.status()).toBe(403);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(await page.content()).not.toContain(activeEmail);
});

test("proxy overwrites forwarded identity and enforces actual persisted HTTP throttles", async ({
  page,
}) => {
  for (let index = 0; index < 10; index++) {
    const response = await page.request.post(
      `${hostedBrowserOrigin}/api/auth/sign-in/email`,
      {
        headers: {
          origin: hostedBrowserOrigin,
          "x-forwarded-host": "attacker.test",
          "x-forwarded-proto": "http",
          "x-forwarded-for": `192.0.2.${index + 1}`,
          "x-learli-client-ip": `198.51.100.${index + 1}`,
          "x-learli-ingress-token": "browser-forged",
        },
        data: {
          email: activeEmail,
          password: "W3-browser-invalid-password-only",
        },
      },
    );
    expect(response.status()).toBe(401);
  }
  expect(
    (
      await page.request.post(`${hostedBrowserOrigin}/api/auth/sign-in/email`, {
        headers: {
          origin: hostedBrowserOrigin,
          "x-forwarded-for": "203.0.113.99",
        },
        data: { email: activeEmail, password: activePassword },
      })
    ).status(),
  ).toBe(429);
  const keys = (
    await owner((pool) =>
      pool.query<{ key: string }>("SELECT key FROM rate_limit"),
    )
  ).rows
    .map((row) => row.key)
    .join(" ");
  expect(keys).toContain("0.0.0.0");
  expect(keys).not.toMatch(/192\.0\.2|198\.51\.100|203\.0\.113/);
});
test("current/new email proofs, password change and own-session revocation use actual browser forms", async ({
  page,
  browser,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await owner((pool) =>
    pool.query('UPDATE public."user" SET timezone=$1 WHERE email=$2', [
      "Africa/Asmera",
      activeEmail,
    ]),
  );
  await signIn(page);
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "Africa/Asmera",
  );
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Manila");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Account settings saved." }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
  const other = await browser.newContext({
    baseURL: hostedBrowserOrigin,
    ignoreHTTPSErrors: true,
  });
  try {
    const otherPage = await other.newPage();
    await signIn(otherPage);
    await page
      .getByRole("link", { name: "Change account email", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Send current-address code" })
      .click();
    await page.getByLabel("New test email").fill("new@example.test");
    await page
      .getByLabel("Current-address code", { exact: true })
      .fill(proofCode(activeEmail, "Confirm your current Learli email"));
    await page
      .getByRole("button", { name: "Confirm current address", exact: true })
      .click();
    await expect(
      page.getByLabel("New-address code", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("New-address code", { exact: true })
      .fill(proofCode("new@example.test", "Confirm your new Learli email"));
    await page
      .getByRole("button", { name: "Confirm new address", exact: true })
      .click();
    activeEmail = "new@example.test";
    await expect(page).toHaveURL(`${hostedBrowserOrigin}/account`);
    await expect(
      page.getByText(`Signed in as ${activeEmail}`, { exact: true }),
    ).toBeVisible();
    expect(
      (
        await otherPage.request.get(
          `${hostedBrowserOrigin}/api/account/sessions`,
        )
      ).status(),
    ).toBe(401);
    await signIn(otherPage);
    await page
      .getByLabel("Current password", { exact: true })
      .fill(activePassword);
    activePassword = "W3-browser-new-fictional-password-only";
    await page.getByLabel("New password", { exact: true }).fill(activePassword);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(activePassword);
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Password changed. Other sessions ended." }),
    ).toBeVisible();
    expect(
      (
        await otherPage.request.get(
          `${hostedBrowserOrigin}/api/account/sessions`,
        )
      ).status(),
    ).toBe(401);
    await signIn(otherPage);
    await page.getByRole("link", { name: "Manage account sessions" }).click();
    await expect(
      page.getByRole("heading", { name: "Current session", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /^End other session/ })
      .first()
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "End session", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "ended" }),
    ).toBeVisible();
    expect(
      (
        await otherPage.request.get(
          `${hostedBrowserOrigin}/api/account/sessions`,
        )
      ).status(),
    ).toBe(401);
  } finally {
    await other.close();
  }
});

test("unknown reset is generic, real reset ends sessions and expired/reused provider tokens fail", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("unknown@example.test");
  await page.getByRole("button", { name: "Request reset link" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "If an account matches" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(activeEmail);
  const requested = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/request-password-reset" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Request reset link" }).click();
  expect((await requested).status()).toBe(200);
  const first = proofLink(activeEmail, "Reset your Learli password");
  const token = new URL(first).pathname.split("/").at(-1)!;
  const expired = await owner((pool) =>
    pool.query(
      "UPDATE verification SET expires_at=(clock_timestamp() AT TIME ZONE 'UTC')-interval '1 second' WHERE identifier=$1 RETURNING expires_at < (clock_timestamp() AT TIME ZONE 'UTC') AS expired",
      [`reset-password:${token}`],
    ),
  );
  expect(expired.rowCount).toBe(1);
  expect(expired.rows[0].expired).toBe(true);
  await page.goto(first);
  await expect(
    page.getByRole("alert").filter({ hasText: "missing or expired" }),
  ).toBeVisible();
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(activeEmail);
  const requestedAgain = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/request-password-reset" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Request reset link" }).click();
  expect((await requestedAgain).status()).toBe(200);
  const fresh = proofLink(activeEmail, "Reset your Learli password");
  expect(fresh === first).toBe(false);
  await page.goto(fresh);
  activePassword = "W3-browser-reset-fictional-password-only";
  await page.getByLabel("New password", { exact: true }).fill(activePassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "password was changed" }),
  ).toBeVisible();
  expect(
    (
      await page.request.get(`${hostedBrowserOrigin}/api/account/sessions`)
    ).status(),
  ).toBe(401);
  await page.goto(fresh);
  await expect(
    page.getByRole("alert").filter({ hasText: "missing or expired" }),
  ).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  const reused = await page.request.post(
    `${hostedBrowserOrigin}/api/auth/reset-password`,
    {
      headers: { origin: hostedBrowserOrigin },
      data: {
        token: new URL(fresh).pathname.split("/").at(-1)!,
        newPassword: "W3-browser-reuse-must-not-change-password",
      },
    },
  );
  expect(reused.status()).toBe(400);
  await signIn(page);
});

test("real TOTP enrollment/password challenge, recovery reuse, rotation and disable never grant password-only admin access", async ({
  page,
}) => {
  await register(page, "admin@example.test");
  await owner((pool) => grantHostedTestAdmin(pool, "admin@example.test"));
  await signIn(page, "admin@example.test", password);
  await page.getByRole("link", { name: "Administrator security" }).click();
  await expect(
    page.getByRole("button", { name: "Set up authenticator" }),
  ).toBeEnabled();
  await page.getByLabel("Current password", { exact: true }).fill(password);
  const enrollment = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/two-factor/enable" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const enrolled = await enrollment;
  expect(enrolled.status()).toBe(200);
  expect(typeof (await enrolled.json()).secret === "string").toBe(true);
  const secret = await page.locator("p[data-mfa-secret]").textContent();
  expect(secret).toBeTruthy();
  const recovery = await page
    .locator("ul[data-mfa-secret] li")
    .allTextContents();
  expect(recovery.length).toBeGreaterThan(0);
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totpCode(secret!));
  await page
    .getByRole("button", { name: "Verify administrator access", exact: true })
    .click();
  await expect(
    page.getByText("Administrator verification is current.", { exact: false }),
  ).toBeVisible();
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/two-factor/);
  expect(
    (
      await page.request.get(`${hostedBrowserOrigin}/api/account/sessions`)
    ).status(),
  ).toBe(401);
  await page
    .getByRole("button", { name: "Use recovery code", exact: true })
    .click();
  await page.getByLabel("Recovery code", { exact: true }).fill(recovery[0]);
  await page
    .getByRole("button", { name: "Verify administrator access", exact: true })
    .click();
  await expect(page).toHaveURL(`${hostedBrowserOrigin}/account`);
  expect(await page.content()).not.toContain(secret!);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/two-factor/);
  await page
    .getByRole("button", { name: "Use recovery code", exact: true })
    .click();
  await page.getByLabel("Recovery code", { exact: true }).fill(recovery[0]);
  await page
    .getByRole("button", { name: "Verify administrator access", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be completed" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use authenticator code", exact: true })
    .click();
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totpCode(secret!));
  await page
    .getByRole("button", { name: "Verify administrator access", exact: true })
    .click();
  await expect(page).toHaveURL(`${hostedBrowserOrigin}/account`);
  await page.getByRole("link", { name: "Administrator security" }).click();
  await page.getByLabel("Current password for security change").fill(password);
  await page.getByRole("button", { name: "Replace recovery codes" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Recovery codes replaced" }),
  ).toBeVisible();
  expect(await page.content()).not.toContain(secret!);
  await page.getByRole("link", { name: "Close recovery codes" }).click();
  await expect(
    page.getByRole("button", {
      name: "Verify administrator access",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totpCode(secret!));
  const reverified = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/two-factor/verify-totp" &&
      response.request().method() === "POST",
  );
  const refreshed = page.waitForEvent("load");
  await page
    .getByRole("button", { name: "Verify administrator access", exact: true })
    .click();
  expect((await reverified).status()).toBe(200);
  await refreshed;
  await expect(
    page.getByRole("button", { name: "Disable authenticator" }),
  ).toBeEnabled();
  await page.getByLabel("Current password for security change").fill(password);
  const disabled = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/two-factor/disable" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Disable authenticator" }).click();
  expect((await disabled).status()).toBe(200);
  await expect(
    page.getByRole("button", { name: "Set up authenticator" }),
  ).toBeVisible();
  const assured = await owner((pool) =>
    pool.query(
      "SELECT count(*) FROM admin_assurance_receipts r JOIN admin_security_epochs e ON e.user_id=r.user_id AND e.epoch=r.epoch JOIN public.\"user\" u ON u.id=r.user_id AND u.two_factor_enabled WHERE u.email='admin@example.test'",
    ),
  );
  expect(assured.rows[0].count).toBe("0");
});

test("320/390/1440 keyboard and axe; no-JS mutation safety; SDK error and truthful unavailable recovery", async ({
  page,
  browser,
}) => {
  const directory = path.join(state().mirror, ".local/browser-safe");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto("/sign-in");
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByLabel("Email", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
    const capture = path.join(directory, `sign-in-${width}.png`);
    await page.screenshot({ path: capture });
    chmodSync(capture, 0o600);
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/sign-in");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({
    forcedColors: "none",
    reducedMotion: "no-preference",
  });
  await signIn(page);
  const native = await browser.newContext({
    baseURL: hostedBrowserOrigin,
    ignoreHTTPSErrors: true,
    javaScriptEnabled: false,
  });
  try {
    await native.addCookies(await page.context().cookies());
    const nativePage = await native.newPage();
    await nativePage.goto("/sign-in");
    await expect(
      nativePage.getByText("Enable JavaScript to use account forms here.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      nativePage.getByLabel("Password", { exact: true }),
    ).toBeDisabled();
    expect(await nativePage.locator("form").getAttribute("method")).toBe(
      "post",
    );
    await nativePage.getByRole("link", { name: "Create account" }).click();
    await expect(nativePage.getByRole("heading", { level: 1 })).toBeVisible();
    expect(nativePage.url()).not.toMatch(/password|name=/);
    await nativePage.goto("/account");
    await expect(nativePage.getByLabel("Display name")).toBeDisabled();
    await expect(nativePage.getByLabel("Time zone")).toBeDisabled();
    await expect(nativePage.getByLabel("Time zone")).toHaveValue("Asia/Manila");
    expect(
      await nativePage
        .getByRole("button", { name: "Save settings", exact: true })
        .locator("xpath=ancestor::form")
        .getAttribute("method"),
    ).toBe("post");
  } finally {
    await native.close();
  }
  writeFileSync(
    path.join(state().captures, "response.json"),
    JSON.stringify("500"),
    { mode: 0o600 },
  );
  try {
    await page.goto("/sign-up");
    await page
      .getByLabel("Display name", { exact: true })
      .fill("Synthetic refused delivery");
    await page
      .getByLabel("Email", { exact: true })
      .fill("failure@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "We couldn't confirm that your registration request finished.",
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Create account", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("heading", { name: "Verify your email", exact: true }),
    ).toHaveCount(0);
  } finally {
    writeFileSync(
      path.join(state().captures, "response.json"),
      JSON.stringify("accepted"),
      { mode: 0o600 },
    );
  }
});

test("revoked cookie/failed reauthentication and account switch clear old private document bootstrap and storage", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByLabel("Display name", { exact: true })).toBeEnabled();
  expect((await page.locator("script").allTextContents()).join("\n")).toContain(
    activeEmail,
  );
  const account = await owner((pool) =>
    pool.query<{ id: string }>('SELECT id FROM public."user" WHERE email=$1', [
      activeEmail,
    ]),
  );
  await owner((pool) =>
    pool.query("DELETE FROM session WHERE user_id=$1", [account.rows[0].id]),
  );
  expect(
    (await page.request.get(`/api/account/${account.rows[0].id}`)).status(),
  ).toBe(401);
  const isSessionsSignIn = (url: URL) =>
    url.origin === hostedBrowserOrigin &&
    url.pathname === "/sign-in" &&
    url.search === "?next=%2Faccount%2Fsessions" &&
    url.hash === "";
  const clientNavigation = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.origin === hostedBrowserOrigin &&
      url.pathname === "/account/sessions" &&
      request.headers().rsc === "1"
    );
  });
  const publicDocument = page.waitForResponse(
    (response) =>
      response.request().isNavigationRequest() &&
      response.request().frame() === page.mainFrame() &&
      isSessionsSignIn(new URL(response.url())) &&
      response.status() === 200,
  );
  // The workspace has no Sign in link. Its guarded client link exercises
  // private-to-auth replacement without discarding the old document in the test.
  await page
    .getByRole("link", { name: "Manage account sessions", exact: true })
    .click();
  await clientNavigation;
  await (await publicDocument).finished();
  await page.waitForLoadState("load");
  await expect(page.getByLabel("Email", { exact: true })).toBeEnabled();
  await expect(page).toHaveURL(isSessionsSignIn);
  expect(await page.content()).not.toContain(activeEmail);
  await page.getByLabel("Email", { exact: true }).fill("unlisted@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("W3-incorrect-private-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be completed" }),
  ).toBeVisible();
  expect(await page.content()).not.toContain(activeEmail);
  const restoredPublicDocument = page.waitForResponse(
    (response) =>
      response.request().isNavigationRequest() &&
      response.request().frame() === page.mainFrame() &&
      new URL(response.url()).pathname === "/sign-in" &&
      response.status() === 200,
  );
  await page.goBack();
  // The old form can still be visible while the privacy reload is in flight.
  // Observe the fresh public document before interacting with its hydrated form.
  await (await restoredPublicDocument).finished();
  await page.waitForLoadState("load");
  await expect(page.getByLabel("Email", { exact: true })).toBeEnabled();
  await expect(
    page.getByText(`Signed in as ${activeEmail}`, { exact: true }),
  ).toHaveCount(0);
  expect(await page.content()).not.toContain(activeEmail);
  await signIn(page, activeEmail, activePassword, false);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await register(page, "second@example.test");
  await signIn(page, "second@example.test", password);
  await expect(
    page.getByText("Signed in as second@example.test", { exact: true }),
  ).toBeVisible();
  expect(await page.content()).not.toContain(activeEmail);
  const storage = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(storage).not.toContain(activeEmail);
  expect(storage).not.toContain(password);
  for (const route of [
    "sign-in",
    "sign-up",
    "forgot-password",
    "reset-password",
    "verify-email",
  ]) {
    await page.goto(`/${route}`);
    const document = await page.content();
    expect(
      state().privateMarkers.some((marker) => document.includes(marker)),
    ).toBe(false);
  }
});

test("hosted parent enrollment uses current membership and ingress without granting a guardian relationship", async ({
  page,
}) => {
  await signIn(page, "second@example.test", password);
  const id = await owner(
    async (pool) =>
      (
        await pool.query('SELECT id FROM "user" WHERE email=$1', [
          "second@example.test",
        ])
      ).rows[0].id as string,
  );
  expect(
    (
      await owner((pool) =>
        pool.query("SELECT role FROM user_roles WHERE user_id=$1", [id]),
      )
    ).rows,
  ).toEqual([]);
  await page.goto("/parent/onboarding?next=%2Ftutors");
  await expect(
    page.getByRole("heading", {
      name: "Set up your parent workspace",
      exact: true,
    }),
  ).toBeVisible();
  const csrf = await page.request.post("/api/account/parent-onboarding", {
    headers: { origin: "https://unrelated.test" },
    data: {},
  });
  expect(csrf.status()).toBe(403);
  const forged = await page.request.post("/api/account/parent-onboarding", {
    headers: { origin: hostedBrowserOrigin },
    data: { role: "admin" },
  });
  expect(forged.status()).toBe(400);
  expect(
    (
      await owner((pool) =>
        pool.query("SELECT role FROM user_roles WHERE user_id=$1", [id]),
      )
    ).rows,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Continue as parent", exact: true })
    .click();
  await expect(page).toHaveURL(`${hostedBrowserOrigin}/tutors`);
  expect(
    (
      await owner((pool) =>
        pool.query("SELECT role FROM user_roles WHERE user_id=$1", [id]),
      )
    ).rows,
  ).toEqual([{ role: "parent" }]);
  expect(
    (
      await owner((pool) =>
        pool.query(
          "SELECT count(*)::int AS count FROM guardian_learner_links WHERE guardian_user_id=$1",
          [id],
        ),
      )
    ).rows[0].count,
  ).toBe(0);
  expect(
    (
      await owner((pool) =>
        pool.query(
          "SELECT count(*)::int AS count FROM audit_events WHERE target_user_id=$1 AND action='parent_role.self_granted'",
          [id],
        ),
      )
    ).rows[0].count,
  ).toBe(1);
});
