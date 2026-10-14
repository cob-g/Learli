import { test, expect, type Page, type Route } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDatabase } from "../../src/lib/db/connection";

// Only synthetic accounts in the isolated test database. No credential traces.
test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "default" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const origin = process.env.APP_URL ?? "http://127.0.0.1:3100";
const name = "Navigation test learner";
const evidence = process.env.NAVIGATION_EVIDENCE_DIR;
test.beforeEach(async () => {
  await owner.pool.query("DELETE FROM rate_limit");
});
test.afterAll(async () => {
  await owner.pool.end();
});

async function signIn(page: Page, displayName = name) {
  const email = `navigation-${randomUUID()}@learli.test`;
  const password = "Synthetic-navigation-passphrase-123";
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { email, password, name: displayName },
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).user.id;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        headers: { origin },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
}

async function positions(page: Page) {
  return page.evaluate(() => {
    const box = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const nav = [
      ...document.querySelectorAll('nav[aria-label="Main navigation"]'),
    ].find((element) => element.getBoundingClientRect().width > 0)!;
    return {
      header: box(document.querySelector(".site-header-bar")!),
      brand: box(document.querySelector(".brand-home")!),
      navigation: box(nav),
      links: [...nav.querySelectorAll("a")].map(box),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
}
type Positions = Awaited<ReturnType<typeof positions>>;
function stable(before: Positions, after: Positions) {
  for (const target of ["header", "brand", "navigation"] as const) {
    for (const axis of ["x", "y", "width", "height"] as const) {
      expect
        .soft(
          Math.abs(after[target][axis] - before[target][axis]),
          `${target}.${axis}`,
        )
        .toBeLessThanOrEqual(2);
    }
  }
  expect.soft(after.overflow).toBe(false);
}
async function record(page: Page, label: string) {
  const measured = await positions(page);
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await writeFile(
      path.join(evidence, `${label}.json`),
      JSON.stringify(measured, null, 2),
    );
    await page.screenshot({ path: path.join(evidence, `${label}.png`) });
  }
  return measured;
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

for (const width of [1024, 1440, 320, 390]) {
  for (const signedIn of [false, true]) {
    test(`${width}px ${signedIn ? "signed-in" : "anonymous"} navigation stays stable during session revalidation`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      if (signedIn) await signIn(page);
      await page.goto("/how-it-works");
      await page.evaluate(() => document.fonts.ready);
      const header = page.getByRole("banner");
      const settled = signedIn
        ? header.getByRole("button", { name: `Account ${name}`, exact: true })
        : header.getByRole("link", { name: "Sign in", exact: true });
      await expect(settled).toBeVisible();
      for (const [index, destination] of [
        "/become-a-tutor",
        "/subjects",
        "/get-matched",
      ].entries()) {
        const label = `${width}-${signedIn ? "signed" : "anonymous"}-${index}`;
        const before = await record(page, `${label}-before`);
        const session = gate();
        const sessionHandler = async (route: Route) => {
          await session.promise;
          await route.continue();
        };
        await page.route("**/api/auth/get-session**", sessionHandler);
        const navigation = gate();
        const routeHandler = async (route: Route) => {
          if (route.request().headers().rsc === "1") await navigation.promise;
          await route.continue();
        };
        await page.route(`**${destination}?**`, routeHandler);
        const nav =
          width >= 1024
            ? page.locator(".site-header nav")
            : page.locator(".site-dock");
        const click = nav.locator(`a[href="${destination}"]`).click();
        await expect(page.locator(".navigation-progress-track")).toBeVisible();
        stable(before, await record(page, `${label}-route-pending`));
        navigation.release();
        await click;
        await expect(page).toHaveURL(destination);
        await expect(
          header.getByText("Checking account…", { exact: true }),
        ).toBeVisible();
        await expect(settled).toHaveCount(0);
        const pending = await record(page, `${label}-session-pending`);
        session.release();
        await expect(settled).toBeVisible();
        const after = await record(page, `${label}-after`);
        stable(before, pending);
        stable(before, after);
        // Dock selection may redistribute tabs on narrow screens; session state
        // must not move any tab once the destination has become current.
        for (const [i, link] of pending.links.entries()) {
          expect.soft(after.links[i]).toEqual(link);
        }
        await page.unroute("**/api/auth/get-session**", sessionHandler);
        await page.unroute(`**${destination}?**`, routeHandler);
      }
    });
  }
}

for (const width of [1024, 1440, 320, 390]) {
  test(`${width}px initial session, error and retry keep the header footprint`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    let pending = gate();
    let fail = true;
    const handler = async (route: Route) => {
      await pending.promise;
      if (fail)
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Unavailable" }),
        });
      else await route.continue();
    };
    await page.route("**/api/auth/get-session**", handler);
    await page.goto("/subjects");
    await page.evaluate(() => document.fonts.ready);
    const header = page.getByRole("banner");
    await expect(
      header.getByText("Checking account…", { exact: true }),
    ).toBeVisible();
    const before = await record(page, `${width}-initial-pending`);
    pending.release();
    await expect(header.getByText("Account status unavailable.")).toBeVisible();
    stable(before, await record(page, `${width}-initial-error`));
    await expect(
      header.getByRole("button", { name: `Account ${name}`, exact: true }),
    ).toHaveCount(0);
    await expect(
      header.getByRole("link", { name: "Account", exact: true }),
    ).toHaveAttribute("href", "/account");
    pending = gate();
    fail = false;
    await header.getByRole("button", { name: "Try again" }).click();
    // The provider clears the previous error as soon as retry starts.
    await expect(
      header.getByText("Checking account…", { exact: true }),
    ).toBeVisible();
    await expect(header.getByRole("button", { name: "Try again" })).toHaveCount(
      0,
    );
    stable(before, await record(page, `${width}-retry-pending`));
    pending.release();
    await expect(
      header.getByRole("button", { name: `Account ${name}`, exact: true }),
    ).toBeVisible();
    stable(before, await record(page, `${width}-retry-resolved`));
  });
}

test("long account names and 200% text remain readable through navigation", async ({
  page,
}) => {
  const longName =
    "Alexandria International Learner With A Very Long Display Name And Multiple Family Names";
  await signIn(page, longName);
  await page.goto("/subjects");
  const header = page.getByRole("banner");
  const account = header.getByRole("button", {
    name: `Account ${longName}`,
    exact: true,
  });
  await expect(account).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  for (const width of [320, 390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await record(page, `${width}-enlarged-long-name`);
    expect(before.overflow).toBe(false);
    await expect(account.locator("bdi")).toHaveText(longName);
    expect(
      await account.locator("bdi").evaluate((element) => {
        const css = getComputedStyle(element);
        return (
          css.textOverflow !== "ellipsis" &&
          element.scrollWidth <= element.clientWidth + 1
        );
      }),
    ).toBe(true);
    const pending = gate();
    const handler = async (route: Route) => {
      await pending.promise;
      await route.continue();
    };
    await page.route("**/api/auth/get-session**", handler);
    const destination =
      new URL(page.url()).pathname === "/subjects"
        ? "/become-a-tutor"
        : "/subjects";
    const nav =
      width >= 1024
        ? page.locator(".site-header nav")
        : page.locator(".site-dock");
    await nav.locator(`a[href="${destination}"]`).click();
    await expect(
      header.getByText("Checking account…", { exact: true }),
    ).toBeVisible();
    const during = await record(page, `${width}-enlarged-pending`);
    // Full names can add header height; top-aligned navigation and branding
    // must retain their position while the identity is withheld on refetch.
    for (const target of ["brand", "navigation"] as const) {
      expect(during[target].x).toBe(before[target].x);
      expect(during[target].y).toBe(before[target].y);
    }
    expect(during.overflow).toBe(false);
    pending.release();
    await expect(account).toBeVisible();
    await page.unroute("**/api/auth/get-session**", handler);
    await account.click();
    await page.keyboard.press("Tab");
    await expect(
      header.getByRole("link", { name: "Account settings" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      header.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(account).toBeFocused();
    await page.evaluate(() => scrollTo(0, 0));
  }
});
