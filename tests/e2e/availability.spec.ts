import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  createAccount,
  openWorld,
  closeWorld,
  type World,
} from "../integration/support";
import { tutorProfiles } from "../../src/lib/db/schema";
let world: World;
const baseURL = process.env.APP_URL ?? "http://127.0.0.1:3100";
async function openTutor(browser: Browser) {
  const account = await createAccount(
    world,
    ["tutor"],
    "Synthetic availability tutor",
  );
  await world.owner.db.insert(tutorProfiles).values({
    userId: account.id,
    slug: `availability-${randomUUID()}`,
    headline: "Synthetic",
    bio: "Synthetic",
    teachingBackground: "Synthetic",
    timezone: "Asia/Manila",
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
test.beforeAll(() => {
  world = openWorld();
});
test.afterAll(async () => {
  await closeWorld(world);
});

test("weekly hours save, validate, survive reload and clear with accessible controls", async ({
  browser,
}, info) => {
  const { page, context } = await openTutor(browser);
  await page.goto("/tutor");
  await page.getByRole("link", { name: "Availability", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Weekly availability" }),
  ).toBeVisible();
  await expect(
    page.getByText("No weekly hours set.", { exact: false }),
  ).toBeVisible();
  const monday = page.getByRole("group", { name: "Monday", exact: true });
  await monday.getByRole("button", { name: "Add time range" }).focus();
  await page.keyboard.press("Enter");
  await expect(monday.getByLabel("Start time", { exact: true })).toBeFocused();
  await monday.getByLabel("Start time", { exact: true }).fill("23:00");
  await monday.getByLabel("End time", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(monday.getByLabel("End time", { exact: true })).toBeFocused();
  await expect(monday.getByText("Enter a valid end time.")).toBeVisible();
  await monday.getByLabel("End time", { exact: true }).fill("01:00");
  await page
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(monday.getByLabel("End time", { exact: true })).toBeFocused();
  await expect(monday.getByText("End time must follow")).toBeVisible();
  await monday.getByLabel("Ends next day").check();
  await page.getByLabel("Teaching time zone").selectOption("America/New_York");
  await expect(
    page.getByText("Time zone changed. Review every day before saving."),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await accessible(page);
    if ([320, 1440].includes(width))
      await page.screenshot({
        path: info.outputPath(`availability-${width}.png`),
        fullPage: true,
      });
  }
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.setViewportSize({ width: 640, height: 400 }); // 1280×800 at 200% equivalent CSS layout.
  await accessible(page);
  await expect(
    page.getByRole("button", { name: "Save availability", exact: true }),
  ).toHaveCSS("border-top-style", "solid");
  await expect(
    page.getByRole("button", { name: "Save availability", exact: true }),
  ).toHaveCSS("border-top-width", "1px");
  await page.screenshot({
    path: info.outputPath("availability-forced-colors.png"),
    fullPage: true,
  });
  await page.emulateMedia({
    reducedMotion: "no-preference",
    forcedColors: "none",
  });
  await page
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Availability saved.");
  await expect(page.getByRole("status")).toBeFocused();
  await page.reload();
  await expect(monday.getByLabel("Start time", { exact: true })).toHaveValue(
    "23:00",
  );
  await expect(monday.getByLabel("End time", { exact: true })).toHaveValue(
    "01:00",
  );
  await expect(monday.getByLabel("Ends next day")).toBeChecked();
  await expect(page.getByLabel("Teaching time zone")).toHaveValue(
    "America/New_York",
  );
  await monday
    .getByRole("button", { name: "Remove Monday time range 1" })
    .click();
  await expect(
    monday.getByRole("button", { name: "Add time range" }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Availability saved.");
  await page.reload();
  await expect(
    page.getByText("No weekly hours set.", { exact: false }),
  ).toBeVisible();
  await context.close();
});

test("stale tabs and network errors preserve edits; pending saves disable row changes", async ({
  browser,
}) => {
  const { page, context } = await openTutor(browser);
  await page.goto("/tutor/availability");
  const other = await context.newPage();
  await other.goto("/tutor/availability");
  const monday = page.getByRole("group", { name: "Monday", exact: true });
  await monday.getByRole("button", { name: "Add time range" }).click();
  await page.route("**/api/tutor/availability", (route) => route.abort());
  await page
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "couldn't reach Learli",
  );
  await expect(monday.getByLabel("Start time", { exact: true })).toHaveValue(
    "09:00",
  );
  await page.unroute("**/api/tutor/availability");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/tutor/availability", async (route) => {
    await gate;
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saving availability…" }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(monday.getByLabel("Start time", { exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole("status")).toHaveText("Availability saved.");
  const tuesday = other.getByRole("group", { name: "Tuesday", exact: true });
  await tuesday.getByRole("button", { name: "Add time range" }).click();
  await other
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(other.getByRole("main").getByRole("alert")).toContainText(
    "another tab",
  );
  await expect(tuesday.getByLabel("Start time", { exact: true })).toHaveValue(
    "09:00",
  );
  await page.reload();
  await expect(monday.getByLabel("Start time", { exact: true })).toHaveValue(
    "09:00",
  );
  await expect(
    page
      .getByRole("group", { name: "Tuesday", exact: true })
      .getByLabel("Start time", { exact: true }),
  ).toHaveCount(0);
  await context.close();
});

test("signed-out and suspended tutors cannot use the editor", async ({
  browser,
  page,
}) => {
  await page.goto("/tutor/availability");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  expect((await page.request.get("/api/tutor/availability")).status()).toBe(
    401,
  );
  const opened = await openTutor(browser);
  await world.owner.db
    .update(tutorProfiles)
    .set({ reviewStatus: "suspended" })
    .where(eq(tutorProfiles.userId, opened.account.id));
  await opened.page.goto("/tutor/availability");
  await expect(
    opened.page.getByText("Your tutor profile is suspended.", { exact: false }),
  ).toBeVisible();
  await expect(opened.page.getByRole("form")).toHaveCount(0);
  await opened.context.close();
});
