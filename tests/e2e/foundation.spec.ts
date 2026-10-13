import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("public shell is truthful, accessible, and fits the viewport", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("tutor");
  await expect(
    page.getByRole("heading", { name: "No tutors are listed right now" }),
  ).toBeVisible();
  await expect(page.getByText(/College Support learners/)).toBeVisible();
  expect(await page.locator("input").count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: true,
  });
});

test("navigation reaches discovery from the bar or the small-screen dock", async ({
  page,
}) => {
  await page.goto("/");
  // One main navigation is displayed at every width: the bar on wide screens,
  // the floating dock below them. There is no menu button to open.
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }),
  ).toHaveCount(0);
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation).toHaveCount(1);
  await navigation
    .getByRole("link", { name: "Find a tutor", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tutors$/);
  await expect(
    page.getByRole("heading", { name: "No tutors are listed right now" }),
  ).toBeVisible();
});

test("key routes expose no fake forms or private data", async ({ page }) => {
  for (const path of [
    "/get-matched",
    "/subjects",
    "/become-a-tutor",
    "/how-it-works",
    "/contact",
    "/report-a-concern",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(await page.locator("h1").count(), path).toBe(1);
    expect(await page.locator("form").count(), path).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      path,
    ).toBe(true);
  }
  await page.goto("/get-matched");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("health and unknown routes have accurate contracts", async ({
  request,
  page,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(health.headers()["cache-control"]).toContain("no-store");
  expect(await health.json()).toEqual({ status: "ok" });
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "We can't find that page" }),
  ).toBeVisible();
  // Next adds a 404 noindex tag alongside our site-wide development exclusion.
  const robotsDirectives = await page
    .locator('meta[name="robots"]')
    .evaluateAll((tags) => tags.map((tag) => tag.getAttribute("content")));
  expect(robotsDirectives.length).toBeGreaterThan(0);
  for (const directives of robotsDirectives) {
    expect(directives?.split(/\s*,\s*/)).toContain("noindex");
  }
});

test("the shell remains light with a dark system preference", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/tutors");
  expect(
    await page
      .locator("html")
      .evaluate((element) => getComputedStyle(element).colorScheme),
  ).toBe("light");
  expect(
    await page
      .locator("body")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(245, 248, 246)");
});

test("anonymous visitors cannot open private workspaces", async ({ page }) => {
  for (const path of ["/account", "/student", "/parent", "/tutor", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Signed in as", { exact: false })).toHaveCount(
      0,
    );
  }
});
