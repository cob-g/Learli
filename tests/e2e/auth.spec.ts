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
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create test account" }).click();
  await expect(page.getByRole("status")).toContainText("verification message");
  await page.goto((await mail(email, "verification")).url);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/tutors?subject=math");
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
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/sign-in");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Your account" })).toHaveCount(
    0,
  );
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  expect(external).toEqual([]);
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
  await page.getByLabel("Test email", { exact: true }).fill(email);
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
  await page.getByLabel("Test email", { exact: true }).fill(email);
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
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/account");
  await page.getByRole("link", { name: "Parent workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Bookings", exact: true }),
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
    await page.getByLabel("Test email", { exact: true }).focus();
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
