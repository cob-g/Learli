import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  PrivateStudentBrowser,
  resetPrivateBrowserAuthAttempts,
} from "../support/private-student-browser";

// Provider credentials, cookies and captured links must not enter recordings.
test.use({ trace: "off", screenshot: "off", video: "off" });
const h = new PrivateStudentBrowser();
const initialPassword = "Fictional-student-browser-passphrase-123";
const replacementPassword = "Fictional-security-replacement-passphrase-456";

test.beforeAll(async () => {
  h.load();
  await resetPrivateBrowserAuthAttempts(h.owner);
});
test.afterAll(() => h.close());

function authResponse(endpoint: string) {
  return (response: { url(): string; request(): { method(): string } }) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === `/api/auth/${endpoint}`;
}

async function visibleNotice(
  page: Page,
  role: "alert" | "status",
  message: string,
) {
  // Next's empty route announcer shares the alert role. Target the actual
  // feature feedback by its expected content rather than an arbitrary position.
  const notice = page.getByRole(role).filter({ hasText: message });
  await expect(notice).toHaveText(message);
  await expect(notice).toBeVisible();
  return notice;
}

async function signIn(
  page: Page,
  email: string,
  password: string,
  expectedStatus = 200,
) {
  await page.goto("/sign-in?next=%2Faccount");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const response = page.waitForResponse(authResponse("sign-in/email"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await response).status()).toBe(expectedStatus);
  if (expectedStatus === 200) {
    await expect(page).toHaveURL((url) => url.pathname === "/account");
    await expect(
      page.getByRole("heading", { name: "Your account", exact: true }),
    ).toBeVisible();
  } else {
    await visibleNotice(
      page,
      "alert",
      "Sign-in could not be completed. Check your details and verify your email. If you have tried repeatedly, wait a minute before retrying.",
    );
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled();
  }
}

async function accountStatus(context: BrowserContext, userId: string) {
  return (await context.request.get(`/api/account/${userId}`)).status();
}

async function expectLoginRequired(page: Page) {
  await page.goto("/account");
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/sign-in" &&
      url.searchParams.get("next") === "/account",
  );
  await expect(
    page.getByRole("heading", { name: "Your account", exact: true }),
  ).toHaveCount(0);
}

async function resetRequest(page: Page, email: string) {
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  const response = page.waitForResponse(authResponse("request-password-reset"));
  await page
    .getByRole("button", { name: "Request reset link", exact: true })
    .click();
  expect((await response).status()).toBe(200);
  const notice = await visibleNotice(
    page,
    "status",
    "If an account matches this address, a reset message is available in your local mailbox.",
  );
  return notice.textContent();
}

async function capturedReset(email: string) {
  const directory = path.join(process.cwd(), ".local/mail/test");
  const file = readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse()
    .map(
      (name) =>
        JSON.parse(readFileSync(path.join(directory, name), "utf8")) as {
          to: string;
          kind: string;
          url: string;
        },
    )
    .find((message) => message.to === email && message.kind === "reset");
  if (!file)
    throw new Error("Expected the owned local password-reset capture.");
  const destination = new URL(file.url);
  // Assert booleans only: a failed assertion must never print the captured URL.
  expect(destination.origin === h.packet.origin).toBe(true);
  expect(
    /^\/api\/auth\/reset-password\/[^/]+$/.test(destination.pathname),
  ).toBe(true);
  return destination.href;
}

test("private authentication rejects duplicates and invalid input, resets once, expires and recovers through the real provider", async ({
  browser,
}) => {
  const actor = await h.register(browser, "security-a");
  const anonymous = await h.context(browser);
  const recovery = await anonymous.newPage();
  const otherContext = await h.context(browser);
  const otherPage = await otherContext.newPage();
  const endpoint = `/api/account/${actor.id}`;
  const original = (
    await h.owner.pool.query<{
      id: string;
      name: string;
      timezone: string;
      credential_id: string;
      password: string;
      roles: string[];
    }>(
      `SELECT u.id,u.name,u.timezone,a.id credential_id,a.password,
              ARRAY(SELECT role::text FROM user_roles WHERE user_id=u.id ORDER BY role) roles
         FROM public."user" u JOIN account a ON a.user_id=u.id AND a.provider_id='credential'
        WHERE u.id=$1 AND u.email=$2 AND u.email_verified`,
      [actor.id, actor.email],
    )
  ).rows[0];
  expect(Boolean(original)).toBe(true);
  expect(original.roles).toEqual([]);
  await expect(
    actor.page.getByLabel("Display name", { exact: true }),
  ).toHaveValue(original.name);
  await actor.page.reload();
  expect(await accountStatus(actor.context, actor.id)).toBe(200);

  // Native required/email constraints prevent an invalid request; the following
  // actual provider failure separately verifies server-side credential denial.
  await recovery.goto("/sign-in?next=%2Faccount");
  let invalidPosts = 0;
  const countInvalid = (request: { method(): string; url(): string }) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/auth/sign-in/email"
    )
      invalidPosts++;
  };
  recovery.on("request", countInvalid);
  await recovery.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(recovery.getByLabel("Email", { exact: true })).toBeFocused();
  await recovery.getByLabel("Email", { exact: true }).fill("invalid-address");
  await recovery
    .getByLabel("Password", { exact: true })
    .fill("Incorrect-synthetic-passphrase-123");
  await recovery.getByRole("button", { name: "Sign in", exact: true }).click();
  expect(
    await recovery
      .getByLabel("Email", { exact: true })
      .evaluate((element: HTMLInputElement) => element.validity.typeMismatch),
  ).toBe(true);
  expect(invalidPosts).toBe(0);
  recovery.off("request", countInvalid);
  const sessionsBefore = (
    await h.owner.pool.query<{ n: number }>(
      "SELECT count(*)::int n FROM session WHERE user_id=$1",
      [actor.id],
    )
  ).rows[0].n;
  await signIn(
    recovery,
    actor.email,
    "Incorrect-synthetic-passphrase-123",
    401,
  );
  expect(await accountStatus(anonymous, actor.id)).toBe(401);
  expect(
    (
      await h.owner.pool.query<{ n: number }>(
        "SELECT count(*)::int n FROM session WHERE user_id=$1",
        [actor.id],
      )
    ).rows[0].n,
  ).toBe(sessionsBefore);
  await expectLoginRequired(recovery);

  // A duplicate receives the same safe wording as h.register's fresh signup.
  await recovery.goto("/sign-up");
  await recovery.getByLabel("Display name", { exact: true }).fill("Duplicate");
  await recovery.getByLabel("Email", { exact: true }).fill(actor.email);
  await recovery
    .getByLabel("Password", { exact: true })
    .fill("Different-duplicate-synthetic-passphrase-123");
  const duplicate = recovery.waitForResponse(authResponse("sign-up/email"));
  await recovery
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  expect((await duplicate).status()).toBe(200);
  await visibleNotice(recovery, "status", "Registration request received.");
  expect(
    (
      await h.owner.pool.query<{ n: number; credentials: number }>(
        `SELECT count(*)::int n,
                (SELECT count(*)::int FROM account WHERE user_id=$2 AND provider_id='credential') credentials
           FROM public."user" WHERE email=$1`,
        [actor.email, actor.id],
      )
    ).rows[0],
  ).toEqual({ n: 1, credentials: 1 });
  const unchanged = (
    await h.owner.pool.query<{
      name: string;
      credential_id: string;
      password: string;
      roles: string[];
    }>(
      `SELECT u.name,a.id credential_id,a.password,
              ARRAY(SELECT role::text FROM user_roles WHERE user_id=u.id ORDER BY role) roles
         FROM public."user" u JOIN account a ON a.user_id=u.id AND a.provider_id='credential'
        WHERE u.id=$1 AND u.email=$2 AND u.email_verified`,
      [actor.id, actor.email],
    )
  ).rows[0];
  expect(Boolean(unchanged)).toBe(true);
  expect(unchanged.name).toBe(original.name);
  expect(unchanged.roles).toEqual(original.roles);
  expect(unchanged.credential_id === original.credential_id).toBe(true);
  expect(unchanged.password === original.password).toBe(true);

  // Representative account input boundaries reject malformed writes atomically.
  for (const input of [
    { name: " ", timezone: "UTC" },
    { name: "x".repeat(101), timezone: "UTC" },
    { name: original.name, timezone: "Not/A_Timezone" },
    { name: original.name, timezone: "UTC", role: "admin" },
  ]) {
    const response = await actor.context.request.patch(endpoint, {
      headers: { origin: h.packet.origin },
      data: input,
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({
      message:
        "Enter a display name and a valid IANA time zone. Other fields cannot be changed here.",
    });
  }
  const accountResponse = await actor.context.request.get(endpoint);
  expect(accountResponse.status()).toBe(200);
  const account = await accountResponse.json();
  expect(account.name).toBe(original.name);
  expect(account.timezone).toBe(original.timezone);
  expect(account.roles).toEqual(original.roles);
  expect(
    (
      await h.owner.pool.query<{ n: number }>(
        "SELECT count(*)::int n FROM audit_events WHERE target_user_id=$1 AND action='account.updated'",
        [actor.id],
      )
    ).rows[0].n,
  ).toBe(0);

  const name = actor.page.getByLabel("Display name", { exact: true });
  await name.fill("");
  await actor.page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(name).toBeFocused();
  expect(
    await name.evaluate(
      (element: HTMLInputElement) => element.validity.valueMissing,
    ),
  ).toBe(true);
  await expect(name).toHaveAttribute("maxlength", "100");
  const retainedName = "Fictional safely retried account";
  await name.fill(retainedName);
  const updateUrl = new URL(endpoint, h.packet.origin).href;
  await actor.page.route(updateUrl, (route) => route.abort("failed"), {
    times: 1,
  });
  await actor.page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await visibleNotice(
    actor.page,
    "alert",
    "The account service could not be reached. Try again.",
  );
  await expect(name).toHaveValue(retainedName);
  await expect(
    actor.page.getByRole("button", { name: "Save settings", exact: true }),
  ).toBeEnabled();
  expect(
    (
      await h.owner.pool.query<{ name: string }>(
        'SELECT name FROM public."user" WHERE id=$1',
        [actor.id],
      )
    ).rows[0].name,
  ).toBe(original.name);
  await actor.page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page: actor.page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await actor.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const retry = actor.page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === endpoint,
  );
  await actor.page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  expect((await retry).status()).toBe(200);
  await visibleNotice(actor.page, "status", "Account settings saved.");
  await actor.page.reload();
  await expect(name).toHaveValue(retainedName);
  await actor.page.setViewportSize({ width: 1440, height: 900 });

  // Both sessions were created by the real provider, not injected cookies.
  await signIn(otherPage, actor.email, initialPassword);
  expect(await accountStatus(otherContext, actor.id)).toBe(200);
  const unknown = h.packet.accountEmails.find((email) =>
    email.startsWith("security-b-"),
  );
  expect(Boolean(unknown)).toBe(true);
  const unknownNotice = await resetRequest(recovery, unknown!);
  const knownNotice = await resetRequest(recovery, actor.email);
  expect(knownNotice).toBe(unknownNotice);
  const link = await capturedReset(actor.email);
  // Sanitizing this navigation failure keeps its private token out of reports.
  try {
    await recovery.goto(link);
  } catch {
    throw new Error(
      "Owned local password-reset navigation failed. Details omitted.",
    );
  }
  expect(new URL(recovery.url()).pathname).toBe("/reset-password");
  const token = new URL(recovery.url()).searchParams.get("token");
  expect(Boolean(token)).toBe(true);
  await recovery
    .getByLabel("New password", { exact: true })
    .fill(replacementPassword);
  const reset = recovery.waitForResponse(authResponse("reset-password"));
  await recovery
    .getByRole("button", { name: "Save new password", exact: true })
    .click();
  expect((await reset).status()).toBe(200);
  await visibleNotice(
    recovery,
    "status",
    "Your password was changed. Sign in with your new password.",
  );
  expect(await accountStatus(actor.context, actor.id)).toBe(401);
  expect(await accountStatus(otherContext, actor.id)).toBe(401);
  await expectLoginRequired(actor.page);
  await expectLoginRequired(otherPage);
  const replay = await anonymous.request.post("/api/auth/reset-password", {
    headers: { origin: h.packet.origin },
    data: { token, newPassword: replacementPassword },
  });
  expect(replay.status()).toBe(400);
  await signIn(recovery, actor.email, initialPassword, 401);
  await signIn(recovery, actor.email, replacementPassword);
  await expect(
    recovery.getByLabel("Display name", { exact: true }),
  ).toHaveValue(retainedName);
  expect(await accountStatus(anonymous, actor.id)).toBe(200);

  // Controlled fixture fault injection: expire only the safe ID of this exact
  // fresh provider session in the already owner-guarded isolated test database.
  const sessions = await anonymous.request.get("/api/account/sessions");
  expect(sessions.status()).toBe(200);
  const current = (await sessions.json()).sessions.filter(
    (item: { id: string; current: boolean }) => item.current,
  ) as { id: string; current: boolean }[];
  expect(current.length).toBe(1);
  const ownedSession = await h.owner.pool.query<{
    id: string;
    user_id: string;
  }>(
    `SELECT s.id,s.user_id FROM session s JOIN public."user" u ON u.id=s.user_id
      WHERE s.id=$1 AND s.user_id=$2 AND u.email=$3 AND s.expires_at>clock_timestamp()`,
    [current[0].id, actor.id, actor.email],
  );
  expect(ownedSession.rows).toEqual([{ id: current[0].id, user_id: actor.id }]);
  const expired = await h.owner.pool.query<{ id: string }>(
    `UPDATE session SET expires_at=clock_timestamp()-interval '1 minute'
      WHERE id=$1 AND user_id=$2
        AND EXISTS(SELECT 1 FROM public."user" WHERE id=$2 AND email=$3)
      RETURNING id`,
    [current[0].id, actor.id, actor.email],
  );
  expect(expired.rowCount).toBe(1);
  expect(await accountStatus(anonymous, actor.id)).toBe(401);
  await expectLoginRequired(recovery);
  await signIn(recovery, actor.email, replacementPassword);
  await recovery.reload();
  await expect(
    recovery.getByLabel("Display name", { exact: true }),
  ).toHaveValue(retainedName);
  expect(await accountStatus(anonymous, actor.id)).toBe(200);
  const logout = recovery.waitForResponse(authResponse("sign-out"));
  await recovery
    .getByRole("main")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  expect((await logout).status()).toBe(200);
  await expect(recovery).toHaveURL((url) => url.pathname === "/sign-in");
  expect(await accountStatus(anonymous, actor.id)).toBe(401);
  await expectLoginRequired(recovery);
});
