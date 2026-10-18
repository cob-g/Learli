import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createDatabase } from "../../src/lib/db/connection";
import {
  localMailbox,
  type LocalMessage,
} from "../../src/lib/email/local-mail";

// Never record auth cookies, passwords, verification tokens or reset URLs in traces.
test.use({ trace: "off", screenshot: "off" });
test.describe.configure({ mode: "serial" });
const password = "Browser-synthetic-passphrase-123";
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
test.beforeEach(async () => {
  await owner.pool.query("DELETE FROM rate_limit");
});
test.afterAll(async () => {
  await owner.pool.end();
});
async function mail(email: string, kind: LocalMessage["kind"]) {
  for (const file of (await readdir(localMailbox("test")))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()) {
    const capture = JSON.parse(
      await readFile(path.join(localMailbox("test"), file), "utf8"),
    ) as LocalMessage;
    if (capture.to === email && capture.kind === kind) return capture;
  }
  throw new Error("Local mail capture was not created.");
}

test("Parent selection survives UI registration and verification, and explicit enrollment grants no child access", async ({
  page,
}) => {
  const email = `parent-onboarding-${randomUUID()}@learli.test`;
  await page.goto("/sign-up");
  await page
    .getByRole("radio", { name: "Parent or guardian", exact: true })
    .check();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Parent onboarding tester");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Registration request received.",
  );
  const id = (
    await owner.pool.query('SELECT id FROM "user" WHERE email=$1', [email])
  ).rows[0].id as string;
  const roles = async () =>
    (
      await owner.pool.query(
        "SELECT role FROM user_roles WHERE user_id=$1 ORDER BY role",
        [id],
      )
    ).rows.map((r) => r.role);
  expect(await roles()).toEqual([]);
  await page.goto((await mail(email, "verification")).url);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("next")).toBe(
    "/parent/onboarding",
  );
  expect(await roles()).toEqual([]);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/parent/onboarding");
  expect(await roles()).toEqual([]);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
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
  const button = page.getByRole("button", {
    name: "Continue as parent",
    exact: true,
  });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/parent");
  await expect(
    page.getByRole("heading", { name: "Parent Dashboard", exact: true }),
  ).toBeVisible();
  expect(await roles()).toEqual(["parent"]);
  expect(
    (
      await owner.pool.query(
        "SELECT count(*)::int AS count FROM audit_events WHERE target_user_id=$1 AND action='parent_role.self_granted'",
        [id],
      )
    ).rows[0].count,
  ).toBe(1);
  expect(
    (
      await owner.pool.query(
        "SELECT count(*)::int AS count FROM guardian_learner_links WHERE guardian_user_id=$1",
        [id],
      )
    ).rows[0].count,
  ).toBe(0);
  const replay = await page.request.post("/api/account/parent-onboarding", {
    headers: { origin: process.env.APP_URL! },
    data: {},
  });
  expect(replay.status()).toBe(200);
  expect(await replay.json()).toEqual({ ready: true, granted: false });
  const forged = await page.request.post("/api/account/parent-onboarding", {
    headers: { origin: process.env.APP_URL! },
    data: { role: "admin" },
  });
  expect(forged.status()).toBe(400);
  expect(await roles()).toEqual(["parent"]);
  await page.goto("/parent/onboarding");
  await expect(page).toHaveURL("/parent");
  expect(
    (
      await owner.pool.query(
        "SELECT count(*)::int AS count FROM audit_events WHERE target_user_id=$1 AND action='parent_role.self_granted'",
        [id],
      )
    ).rows[0].count,
  ).toBe(1);
});

test("existing roleless account can choose Parent, while native setup GET and form fallback cannot grant it", async ({
  browser,
  page,
}) => {
  const email = `parent-existing-${randomUUID()}@learli.test`;
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: { origin: process.env.APP_URL! },
        data: {
          email,
          password,
          name: "Existing parent tester",
          callbackURL: "/account",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto((await mail(email, "verification")).url);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/account");
  const id = (
    await owner.pool.query('SELECT id FROM "user" WHERE email=$1', [email])
  ).rows[0].id as string;
  const native = await browser.newContext({
    storageState: await page.context().storageState(),
    javaScriptEnabled: false,
  });
  try {
    const nativePage = await native.newPage();
    await nativePage.goto(`${process.env.APP_URL}/parent/onboarding`);
    await expect(
      nativePage.getByRole("button", {
        name: "Continue as parent",
        exact: true,
      }),
    ).toBeDisabled();
    const fallback = await native.request.post(
      `${process.env.APP_URL}/api/account/parent-onboarding`,
      { headers: { origin: process.env.APP_URL! }, form: {} },
    );
    expect(fallback.status()).toBe(400);
    expect(
      (
        await owner.pool.query("SELECT role FROM user_roles WHERE user_id=$1", [
          id,
        ])
      ).rows,
    ).toEqual([]);
  } finally {
    await native.close();
  }
  await page
    .getByRole("link", { name: "Set up parent workspace", exact: true })
    .click();
  await expect(page).toHaveURL("/parent/onboarding");
  await page
    .getByRole("button", { name: "Continue as parent", exact: true })
    .click();
  await expect(page).toHaveURL("/parent");
  expect(
    (
      await owner.pool.query("SELECT role FROM user_roles WHERE user_id=$1", [
        id,
      ])
    ).rows,
  ).toEqual([{ role: "parent" }]);
});

test("parent setup preserves the original safe tutor search after verification and enrollment", async ({
  page,
}) => {
  const email = `parent-return-${randomUUID()}@learli.test`;
  const next = "/tutors?subject=math&level=middle_school";
  await page.goto(`/sign-up?${new URLSearchParams({ next })}`);
  await page
    .getByRole("radio", { name: "Parent or guardian", exact: true })
    .check();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Parent return tester");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Registration request received.",
  );
  await page.goto((await mail(email, "verification")).url);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/parent/onboarding\\?next="));
  await page
    .getByRole("button", { name: "Continue as parent", exact: true })
    .click();
  await expect(page).toHaveURL(next);
});

test("local signup, verification, safe return, settings and logout work end to end", async ({
  page,
}) => {
  const email = `browser-${randomUUID()}@learli.test`;
  const external: string[] = [];
  page.on("request", (request) => {
    const origin = new URL(request.url()).origin;
    if (origin !== (process.env.APP_URL ?? "http://127.0.0.1:3100"))
      external.push(origin);
  });
  await page.goto("/sign-up?next=%2Ftutors%3Fsubject%3Dmath");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Browser learner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Registration request received.",
  );
  await page.goto((await mail(email, "verification")).url);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/tutors?subject=math");
  const header = page.getByRole("banner");
  const account = header.getByRole("button", {
    name: "Account Browser learner",
  });
  await expect(account).toBeVisible();
  await expect(
    header.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await account.click();
  await header.getByRole("link", { name: "Account settings" }).click();
  await expect(page).toHaveURL("/account");
  const response = await page.goto("/account");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.getByRole("heading", { name: "Your account" }),
  ).toBeVisible();
  await expect(
    page.getByText("No workspace role has been assigned"),
  ).toBeVisible();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Updated browser learner");
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Manila");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toHaveText("Account settings saved.");
  // App settings use PATCH rather than a provider mutation signal. A public
  // client navigation must revalidate the header's display name.
  await page.getByRole("link", { name: "Visit website" }).click();
  await expect(page).toHaveURL("/");
  await header.getByRole("link", { name: "Subjects", exact: true }).click();
  await expect(page).toHaveURL("/subjects");
  await expect(
    header.getByRole("button", { name: "Account Updated browser learner" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    header.getByRole("button", { name: "Account Updated browser learner" }),
  ).toBeVisible();
  await page.goto("/account");
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Updated browser learner",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  // The closed header disclosure must not duplicate the account-page action.
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toHaveCount(1);
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [768, 900],
    [1024, 900],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    const trigger = header.getByRole("button", {
      name: "Account Updated browser learner",
    });
    await trigger.click();
    await expect(
      header.getByRole("link", { name: "Account settings" }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
  await header
    .getByRole("button", { name: "Account Updated browser learner" })
    .click();
  await header.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/sign-in");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Your account" })).toHaveCount(
    0,
  );
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  expect(external).toEqual([]);
});

test("phone account navigation preserves session recovery and header logout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const email = `header-phone-${randomUUID()}@learli.test`;
  await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: process.env.APP_URL ?? "http://127.0.0.1:3100" },
    data: { email, name: "Phone learner", password, callbackURL: "/sign-in" },
  });
  await page.goto((await mail(email, "verification")).url);
  await page.goto("/sign-in?next=%2Fsubjects");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/subjects");
  const header = page.getByRole("banner");
  const account = header.getByRole("button", { name: "Account Phone learner" });
  await expect(account).toBeVisible();
  await expect(
    header.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".site-dock")
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await expect(account).toBeVisible();
  await page.reload();
  await expect(account).toBeVisible();

  const unavailable = async (route: import("@playwright/test").Route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Service unavailable" }),
    });
  };
  await page.route("**/api/auth/get-session**", unavailable);
  await page
    .locator(".site-dock")
    .getByRole("link", { name: "Subjects", exact: true })
    .click();
  await expect(header.getByText("Account status unavailable.")).toBeVisible();
  await expect(
    header.getByRole("link", { name: "Account", exact: true }),
  ).toBeVisible();
  await expect(
    header.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await expect(account).toHaveCount(0);
  await page.unroute("**/api/auth/get-session**", unavailable);
  await header.getByRole("button", { name: "Try again" }).click();
  await expect(account).toBeVisible();

  await page.route("**/api/auth/sign-out", unavailable);
  await account.click();
  await header.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(header.getByRole("alert")).toHaveText(
    "Sign-out could not be completed. Try again.",
  );
  await expect(page).toHaveURL("/subjects");
  await expect(account).toBeVisible();
  await page.unroute("**/api/auth/sign-out", unavailable);
  await header.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/sign-in");
  await expect(
    header.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
});

test("password recovery stays local and produces a usable new login", async ({
  page,
}) => {
  const email = `reset-${randomUUID()}@learli.test`;
  await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: process.env.APP_URL ?? "http://127.0.0.1:3100" },
    data: { email, name: "Reset learner", password, callbackURL: "/sign-in" },
  });
  await page.goto((await mail(email, "verification")).url);
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Request reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account matches");
  await page.goto((await mail(email, "reset")).url);
  const newPassword = "Browser-new-synthetic-passphrase-456";
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your password was changed",
  );
  await page.goto("/sign-in?next=https%3A%2F%2Fexample.com");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/account");
});

test("workspace pages enforce trusted role grants", async ({ page }) => {
  const email = `roles-${randomUUID()}@learli.test`;
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: process.env.APP_URL ?? "http://127.0.0.1:3100" },
    data: { email, name: "Role learner", password, callbackURL: "/sign-in" },
  });
  const { user } = await response.json();
  await page.goto((await mail(email, "verification")).url);
  // Trusted, test-only fixture setup; no public role-grant endpoint exists.
  await owner.pool.query(
    "INSERT INTO user_roles (user_id, role) VALUES ($1, 'parent'), ($1, 'tutor')",
    [user.id],
  );
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/account");
  await page
    .getByRole("main")
    .getByRole("navigation", { name: "Your workspaces" })
    .getByRole("link", { name: "Parent Dashboard", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Parent Dashboard", exact: true }),
  ).toBeVisible();
  await page.goto("/tutor");
  await expect(
    page.getByRole("heading", { name: "Your bookings", exact: true }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Workspace access unavailable" }),
  ).toBeVisible();
  await expect(page.getByText(email, { exact: false })).toHaveCount(0);
});

test("auth forms are accessible and fit desktop, phone and narrow screens", async ({
  page,
}, info) => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 720],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/sign-in");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByLabel("Email", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
    await page.getByRole("heading", { name: "Sign in", exact: true }).click();
    await page.screenshot({
      path: info.outputPath(`sign-in-${width}.png`),
      fullPage: true,
    });
  }
  await page.goto("/reset-password?error=INVALID_TOKEN");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "missing or expired",
  );
});
