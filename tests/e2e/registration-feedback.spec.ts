import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// Presentation cases intercept the provider. Real signup, verification and
// sign-in remain covered separately in auth.spec.ts against isolated PostgreSQL.
// Never capture credentials, tokens or real customer information.
test.use({ trace: "off", screenshot: "off", video: "off" });
const credential = "Fictional-browser-passphrase-123";
const email = "registration-feedback@example.test";
const next = "/tutors?subject=science&level=college_support";

async function fillSignup(page: Page) {
  await page.getByLabel("Display name", { exact: true }).fill("QA visitor");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(credential);
}

async function inspect(page: Page, width: number, state: string) {
  // Screenshots are optional private evidence; the CI assertions always run.
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
  if (process.env.LEARLI_REGISTRATION_CAPTURE_DIR) {
    const directory = path.resolve(process.env.LEARLI_REGISTRATION_CAPTURE_DIR);
    if (!directory.startsWith(`${process.cwd()}/.local/`))
      throw new Error(
        "Registration captures require a private local directory.",
      );
    await mkdir(directory, { recursive: true, mode: 0o700 });
    // Keep the real focus assertions above. Full-page Chromium captures retain
    // a sticky header's scrolled position unless the document is reset first.
    await page.evaluate(() =>
      window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
    );
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({
      path: path.join(directory, `${width}-${state}.png`),
      fullPage: true,
    });
  }
}

for (const width of [1440, 390, 320]) {
  test(`signup correction, pending, safe failure and received states at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    let requests = 0;
    let release: (() => void) | undefined;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/auth/sign-up/email", async (route) => {
      requests++;
      if (requests === 1) {
        await waiting;
        await route.fulfill({
          status: 503,
          json: { message: "PRIVATE_PROVIDER_DETAIL", code: "UNAVAILABLE" },
        });
      } else {
        await route.fulfill({
          status: 200,
          json: { token: null, user: { id: "synthetic-response" } },
        });
      }
    });
    try {
      await page.goto(`/sign-up?${new URLSearchParams({ next })}`);
      await fillSignup(page);
      await page
        .getByLabel("Email", { exact: true })
        .fill("synthetic@example.com");
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await expect(
        page.locator(".sign-up-form").getByRole("alert"),
      ).toContainText(/highlighted fields/i);
      await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(
        page.getByText(/This preview only accepts addresses ending in \.test/),
      ).toBeVisible();
      expect(requests).toBe(0);
      await page.getByLabel("Password", { exact: true }).fill("");
      await inspect(page, width, "correction");

      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(credential);
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      const pending = page.getByRole("button", {
        name: "Creating account…",
        exact: true,
      });
      await expect(pending).toBeDisabled();
      await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
        "",
      );
      await expect(page.locator(".sign-up-form")).toHaveAttribute(
        "aria-busy",
        "true",
      );
      await page.locator(".sign-up-form").evaluate((form) => {
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });
      await inspect(page, width, "pending");
      expect(requests).toBe(1);
      release!();
      const failure = page.locator(".sign-up-form").getByRole("alert");
      await expect(failure).toBeVisible();
      await expect(failure).toBeFocused();
      await expect(failure).not.toContainText("PRIVATE_PROVIDER_DETAIL");
      await expect(
        page.getByLabel("Display name", { exact: true }),
      ).toHaveValue("QA visitor");
      await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
        email,
      );
      await expect(
        page.getByRole("button", { name: "Create account", exact: true }),
      ).toBeEnabled();
      await inspect(page, width, "failure");

      await page.getByLabel("Password", { exact: true }).fill(credential);
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Verify your email", exact: true }),
      ).toBeVisible();
      const received = page
        .getByRole("status")
        .filter({ hasText: "Registration request received" });
      await expect(received).toBeFocused();
      await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Create account", exact: true }),
      ).toHaveCount(0);
      await expect(
        page
          .getByRole("region", { name: "Verify your email", exact: true })
          .getByRole("link", { name: "Sign in", exact: true }),
      ).toHaveAttribute("href", `/sign-in?next=${encodeURIComponent(next)}`);
      expect(requests).toBe(2);
      await inspect(page, width, "received");

      if (width === 1440) {
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "200%";
        });
        await inspect(page, width, "received-text-200");
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "";
        });
      }

      await page.emulateMedia({
        reducedMotion: "reduce",
        forcedColors: "active",
      });
      await inspect(page, width, "received-accessible");
      await page
        .getByRole("button", { name: "Use a different email", exact: true })
        .click();
      await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
        "",
      );
      await expect(
        page.getByLabel("Password", { exact: true }),
      ).toHaveAttribute("type", "password");
      await expect(
        page.getByRole("button", { name: "Create account", exact: true }),
      ).toBeEnabled();
      expect(new URL(page.url()).searchParams.has("email")).toBe(false);
      expect(
        await page.evaluate(() =>
          Object.keys(localStorage).some((key) =>
            /registration|password|email/i.test(key),
          ),
        ),
      ).toBe(false);
    } finally {
      release?.();
    }
  });
}

test("rate limiting and interrupted signup give safe recovery without a completion state", async ({
  page,
}) => {
  let attempt = 0;
  await page.route("**/api/auth/sign-up/email", async (route) => {
    attempt++;
    if (attempt === 1)
      await route.fulfill({
        status: 429,
        json: { message: "PRIVATE_THROTTLE_DETAIL" },
      });
    else await route.abort("connectionfailed");
  });
  await page.goto("/sign-up");
  await fillSignup(page);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".sign-up-form").getByRole("alert")).toContainText(
    /wait|too many/i,
  );
  await expect(
    page.locator(".sign-up-form").getByRole("alert"),
  ).not.toContainText("PRIVATE_THROTTLE_DETAIL");
  await expect(page.locator(".sign-up-form").getByRole("alert")).toBeFocused();
  await page.getByLabel("Password", { exact: true }).fill(credential);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".sign-up-form").getByRole("alert")).toContainText(
    /try again|connection/i,
  );
  await expect(page.locator(".sign-up-form").getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Verify your email", exact: true }),
  ).toHaveCount(0);
});

test("signup stays inert without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/sign-up`);
    await expect(page.getByLabel("Email", { exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Create account", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText(/Enable JavaScript to use account forms here/),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
