import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  {
    path: "/privacy",
    title: "Privacy draft",
    decision: /Record-retention periods/,
  },
  {
    path: "/terms",
    title: "Terms draft",
    decision: /Who receives customer money/,
  },
  {
    path: "/cancellations",
    title: "Cancellations draft",
    decision: /Who may cancel or reschedule/,
  },
] as const;

for (const { path, title, decision } of routes) {
  test(`${title} is accessible preparation on phone and desktop`, async ({
    page,
  }, testInfo) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).hostname !== "127.0.0.1")
        externalRequests.push(request.resourceType());
    });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(`${title} | Learli`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(
        page.getByText(/Draft for local preparation only/),
      ).toBeVisible();
      await expect(page.getByText(decision)).toBeVisible();
      await expect(
        page.locator("main form, main input, main button"),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const directives = await page
        .locator('meta[name="robots"]')
        .getAttribute("content");
      expect(directives?.split(/\s*,\s*/)).toEqual(
        expect.arrayContaining(["noindex", "nofollow"]),
      );
      if (width === 390 || width === 1440) {
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`draft-${width}.png`),
          fullPage: true,
        });
      }
    }
    expect(externalRequests).toEqual([]);
  });
}

test("footer drafts support keyboard navigation, Back and native no-JavaScript reading", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/privacy");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  for (const { path, title } of routes) {
    const link = page
      .getByRole("navigation", { name: "Footer navigation" })
      .getByRole("link", { name: title });
    // Traverse real tab order through help links and footer; no scripted focus shortcut.
    for (
      let tabs = 0;
      !(await link.evaluate((element) => element === document.activeElement)) &&
      tabs < 25;
      tabs++
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(link).toBeFocused();
    expect(
      await link.evaluate((element) => getComputedStyle(element).outlineStyle),
    ).toBe("solid");
    expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  }
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Terms draft",
  );

  const native = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  try {
    const nativePage = await native.newPage();
    await nativePage.goto("/privacy");
    for (const { path, title } of routes) {
      await nativePage
        .getByRole("navigation", { name: "Footer navigation" })
        .getByRole("link", { name: title })
        .click();
      await expect(nativePage).toHaveURL(new RegExp(`${path}$`));
      await expect(nativePage.getByRole("heading", { level: 1 })).toHaveText(
        title,
      );
      await expect(
        nativePage.getByText(/Draft for local preparation only/),
      ).toBeVisible();
    }
  } finally {
    await native.close();
  }
});

test("drafts remain public static content with no private projection or acceptance controls", async ({
  page,
  request,
}) => {
  for (const { path } of routes) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toMatch(
      /https:\/\/(?:[^\s"<>]*zoom\.us|meet\.google\.com)\//,
    );
    expect(html).not.toMatch(
      /postgresql:\/\/|learli_(?:owner|app):|"learnerId"|"bookingId"|"sessionToken"/,
    );
    await page.goto(path);
    await expect(
      page.locator("main form, main input, main textarea, main select"),
    ).toHaveCount(0);
    await page.emulateMedia({
      reducedMotion: "reduce",
      forcedColors: "active",
    });
    await page.setViewportSize({ width: 640, height: 400 });
    await page.reload();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Decisions still open" }),
    ).toBeVisible();
  }
});
