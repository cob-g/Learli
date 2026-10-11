import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { tutorProfiles } from "../../src/lib/db/schema";
import {
  createAccount,
  openWorld,
  closeWorld,
  type World,
} from "../integration/support";
let world: World;
const baseURL = process.env.APP_URL ?? "http://127.0.0.1:3112";
async function openTutor(browser: Browser, profile = true) {
  const account = await createAccount(
    world,
    ["tutor"],
    "Synthetic time-off tutor",
  );
  if (profile)
    await world.owner.db.insert(tutorProfiles).values({
      userId: account.id,
      slug: `time-off-${randomUUID()}`,
      headline: "Synthetic",
      bio: "Synthetic",
      teachingBackground: "Synthetic",
      timezone: "America/New_York",
    });
  const context = await browser.newContext({ baseURL });
  await context.addCookies(
    account.cookie.split("; ").map((part) => {
      const split = part.indexOf("=");
      return {
        name: part.slice(0, split),
        value: part.slice(split + 1),
        url: baseURL,
      };
    }),
  );
  return { page: await context.newPage(), context, account };
}
async function accessible(page: Page) {
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
const add = {
  operation: "add",
  version: 0,
  timezone: "America/New_York",
  startLocal: "2026-10-13T23:00",
  endLocal: "2026-10-14T01:00",
};
test.beforeAll(() => {
  world = openWorld();
});
test.beforeEach(async () => {
  await world.owner.pool.query("TRUNCATE rate_limit");
}); // Synthetic test throttles only; production guards unchanged.
test.afterAll(async () => {
  await closeWorld(world);
});

test("time off is linked, keyboard accessible, dated, persisted and removable at responsive widths", async ({
  browser,
}, info) => {
  const { page, context } = await openTutor(browser);
  await page.goto("/tutor/availability");
  await page.getByRole("link", { name: "Manage time off" }).click();
  await expect(
    page.getByRole("heading", { name: "Time off", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No time off saved.", { exact: false }),
  ).toBeVisible();
  await accessible(page);
  await page.getByRole("button", { name: "Add time off", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByLabel("Start date and time", { exact: true }),
  ).toBeFocused();
  await page.getByLabel("Start date and time").fill(add.startLocal);
  await page.getByLabel("End date and time").fill("2026-10-13T22:00");
  await page.getByRole("button", { name: "Add time off", exact: true }).click();
  await expect(page.getByLabel("End date and time")).toBeFocused();
  await expect(
    page.getByText("Choose an end date and time after the start."),
  ).toBeVisible();
  await page.getByLabel("End date and time").fill(add.endLocal);
  await page.getByRole("button", { name: "Add time off", exact: true }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Time off added.",
  );
  await expect(page.getByRole("main").getByRole("status")).toBeFocused();
  await expect(page.locator("time")).toHaveCount(2);
  await expect(page.locator("time").first()).toContainText("Oct 13, 2026");
  await expect(page.locator("time").last()).toContainText("Oct 14, 2026");
  await expect(page.locator("time").first()).toContainText("GMT-4");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await accessible(page);
    if ([320, 1440].includes(width))
      await page.screenshot({
        path: info.outputPath(`time-off-${width}.png`),
        fullPage: true,
      });
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 400 });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("time-off-forced-colors.png"),
    fullPage: true,
  });
  await page.emulateMedia({
    forcedColors: "none",
    reducedMotion: "no-preference",
  });
  await page.reload();
  await expect(page.locator("time")).toHaveCount(2);
  const remove = page.getByRole("button", {
    name: /^Remove time off starting/,
  });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Time off removed.",
  );
  await expect(page.getByRole("main").getByRole("status")).toBeFocused();
  await page.reload();
  await expect(
    page.getByText("No time off saved.", { exact: false }),
  ).toBeVisible();
  await context.close();
});

test("DST errors, pending/network failures and stale tabs preserve entered times", async ({
  browser,
}, info) => {
  const { page, context } = await openTutor(browser);
  await page.goto("/tutor/time-off");
  await accessible(page);
  const other = await context.newPage();
  await other.goto("/tutor/time-off");
  const weekly = await context.newPage();
  await weekly.goto("/tutor/availability");
  await page.getByLabel("Start date and time").fill("2026-03-08T02:30");
  await expect(page.getByLabel("Start date and time")).toHaveValue(
    "2026-03-08T02:30",
  );
  await page.getByLabel("End date and time").fill("2026-03-08T03:30");
  await expect(page.getByLabel("Start date and time")).toHaveValue(
    "2026-03-08T02:30",
  );
  await page.getByRole("button", { name: "Add time off", exact: true }).click();
  await expect(
    page.getByText("This local time does not exist", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Start date and time")).toBeFocused();
  const fold = await page.request.post("/api/tutor/time-off", {
    headers: { origin: baseURL },
    data: {
      ...add,
      startLocal: "2026-11-01T01:30",
      endLocal: "2026-11-01T02:30",
    },
  });
  expect(fold.status()).toBe(400);
  expect((await fold.json()).fields.startLocal).toContain("occurs twice");
  await page.getByLabel("Start date and time").fill(add.startLocal);
  await page.getByLabel("End date and time").fill(add.endLocal);
  await page.route("**/api/tutor/time-off", (route) => route.abort());
  await page.getByRole("button", { name: "Add time off", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "couldn't confirm the change",
  );
  await expect(page.getByLabel("Start date and time")).toHaveValue(
    add.startLocal,
  );
  await page.screenshot({
    path: info.outputPath("time-off-network-error.png"),
    fullPage: true,
  });
  await page.unroute("**/api/tutor/time-off");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/tutor/time-off", async (route) => {
    await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Add time off", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Adding time off…" }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByLabel("Start date and time")).toBeDisabled();
  release();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Time off added.",
  );
  await other.getByLabel("Start date and time").fill("2026-10-15T09:00");
  await other.getByLabel("End date and time").fill("2026-10-15T10:00");
  await other
    .getByRole("button", { name: "Add time off", exact: true })
    .click();
  await expect(other.getByRole("main").getByRole("alert")).toContainText(
    "another tab",
  );
  await expect(other.getByLabel("Start date and time")).toHaveValue(
    "2026-10-15T09:00",
  );
  await other.screenshot({
    path: info.outputPath("time-off-stale.png"),
    fullPage: true,
  });
  await weekly
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(weekly.getByRole("main").getByRole("alert")).toContainText(
    "another tab",
  );
  await other.getByRole("button", { name: "Reload saved time off" }).click();
  await expect(other.locator("time")).toHaveCount(2);
  await context.close();
});

test("private boundaries deny strangers and suspension and handle missing profiles", async ({
  browser,
  page,
}) => {
  await page.goto("/tutor/time-off");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  expect((await page.request.get("/api/tutor/time-off")).status()).toBe(401);
  expect(
    (
      await page.request.post("/api/tutor/time-off", {
        headers: { origin: baseURL },
        data: add,
      })
    ).status(),
  ).toBe(401);
  const a = await openTutor(browser),
    b = await openTutor(browser);
  const added = await b.page.request.post("/api/tutor/time-off", {
    headers: { origin: baseURL },
    data: add,
  });
  expect(added.status()).toBe(200);
  const { exceptions } = await added.json();
  expect(
    (
      await a.page.request.post("/api/tutor/time-off", {
        headers: { origin: baseURL },
        data: { operation: "remove", version: 0, id: exceptions[0].id },
      })
    ).status(),
  ).toBe(404);
  const own = await a.page.request.get("/api/tutor/time-off");
  expect(own.headers()["cache-control"]).toContain("no-store");
  expect((await own.json()).schedule.exceptions).toEqual([]);
  await a.page.goto("/tutor/time-off");
  await expect(a.page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(a.page).toHaveTitle("Time off | Learli");
  await world.owner.db
    .update(tutorProfiles)
    .set({ reviewStatus: "suspended" })
    .where(eq(tutorProfiles.userId, a.account.id));
  await a.page.reload();
  await expect(
    a.page.getByText("Time off cannot be changed", { exact: false }),
  ).toBeVisible();
  await expect(a.page.getByRole("form")).toHaveCount(0);
  expect(
    (
      await a.page.request.post("/api/tutor/time-off", {
        headers: { origin: baseURL },
        data: add,
      })
    ).status(),
  ).toBe(409);
  const empty = await openTutor(browser, false);
  await empty.page.goto("/tutor/time-off");
  await expect(
    empty.page.getByText("before adding time off.", { exact: false }),
  ).toBeVisible();
  await expect(empty.page.getByRole("form")).toHaveCount(0);
  await a.context.close();
  await b.context.close();
  await empty.context.close();
});
