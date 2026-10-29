import { randomUUID } from "node:crypto";
import { test, expect, type Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
test.use({ trace: "off", screenshot: "off" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const baseURL = process.env.APP_URL!;
async function account(
  browser: Browser,
  role: "tutor" | "parent",
  javaScriptEnabled = true,
) {
  const context = await browser.newContext({ baseURL, javaScriptEnabled });
  await context.route("https://**/*", (route) => route.abort());
  await owner.pool.query("UPDATE rate_limit SET count=0");
  const email = `meet-ui-${randomUUID()}@learli.test`,
    password = "Synthetic-meet-browser-password-123";
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic meeting account" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  await owner.pool.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [
    id,
    role,
  ]);
  expect(
    (
      await context.request.post("/api/auth/sign-in/email", {
        headers: { origin: baseURL },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  return { context, page: await context.newPage() };
}
test.afterAll(() => owner.pool.end());
test("optional meeting setup is truthful, accessible and fits phone and desktop", async ({
  browser,
}) => {
  const tutor = await account(browser, "tutor");
  try {
    for (const width of [1440, 390, 320]) {
      await tutor.page.setViewportSize({ width, height: 900 });
      await tutor.page.goto("/tutor/meetings?result=connected");
      await expect(
        tutor.page.getByRole("heading", { name: "Meeting setup", exact: true }),
      ).toBeVisible();
      await expect(
        tutor.page.getByText("Not connected", { exact: true }),
      ).toBeVisible();
      await expect(
        tutor.page.getByText(/not configured in this environment/),
      ).toBeVisible();
      await expect(
        tutor.page.getByRole("button", { name: "Connect Google account" }),
      ).toHaveCount(0);
      await expect(
        tutor.page.getByText(/Google account connected\./),
      ).toHaveCount(0);
      expect(
        await tutor.page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    expect(
      (await new AxeBuilder({ page: tutor.page }).analyze()).violations,
    ).toEqual([]);
    await tutor.page.getByRole("link", { name: "Return to bookings" }).focus();
    await expect(
      tutor.page.getByRole("link", { name: "Return to bookings" }),
    ).toBeFocused();
    await tutor.page.reload();
    await expect(
      tutor.page.getByText("Not connected", { exact: true }),
    ).toBeVisible();
  } finally {
    await tutor.context.close();
  }
});
test("non-tutors and visitors cannot use Tutor meeting setup; no-JS fallback stays readable", async ({
  browser,
}) => {
  const parent = await account(browser, "parent"),
    tutor = await account(browser, "tutor", false),
    anonymous = await browser.newContext({ baseURL });
  try {
    await parent.page.goto("/tutor/meetings");
    await expect(
      parent.page.getByRole("heading", { name: "Meeting setup unavailable" }),
    ).toBeVisible();
    await tutor.page.goto("/tutor/meetings");
    await expect(
      tutor.page.getByText(
        /Enable JavaScript to manage this optional connection/,
      ),
    ).toBeVisible();
    const page = await anonymous.newPage();
    await page.goto("/tutor/meetings");
    await expect(page).toHaveURL(/\/sign-in\?/);
    const result = await parent.context.request.post(
      "/api/tutor/meeting-providers/google/connect",
      { headers: { origin: baseURL }, data: { consent: true } },
    );
    expect(result.status()).toBe(503);
    expect(await result.text()).not.toContain("accounts.google.com");
  } finally {
    await parent.context.close();
    await tutor.context.close();
    await anonymous.close();
  }
});
