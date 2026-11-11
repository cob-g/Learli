import { test, expect, devices, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createDatabase } from "../../src/lib/db/connection";
import { nameInitials } from "../../src/lib/initials";

// The landing page's "Tutors on Learli" photo grid (owner's Tutor List
// reference). TUTOR_GRID_EVIDENCE=<dir> also saves screenshots for review.
test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "serial" });

const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const origin = process.env.APP_URL ?? "http://127.0.0.1:3100";
const password = "Synthetic-grid-passphrase-123";
const evidence = process.env.TUTOR_GRID_EVIDENCE;
const run = randomUUID().slice(0, 6);
// "AAA" sorts these first, so they fill the home page's eight cards.
const names = Array.from(
  { length: 8 },
  (_, i) => `AAA Grid ${String.fromCharCode(65 + i)} ${run}`,
);
const longBio =
  "Synthetic profile only. Patient step-by-step explanations with worked examples, short practice questions after each idea, and a calm recap at the end of every lesson so nothing is left unclear.";
const profiles: string[] = [];

async function shot(page: Page, name: string) {
  if (!evidence) return;
  await mkdir(evidence, { recursive: true });
  await page
    .locator("section", {
      has: page.getByRole("heading", { name: "Tutors on Learli" }),
    })
    .screenshot({ path: path.join(evidence, `${name}.png`) });
}
const tile = (page: Page, i: number) =>
  page.getByRole("article", { name: `${names[i]}, Math` });
const sheetOpen = (page: Page, i: number) =>
  tile(page, i)
    .locator(".tutor-tile-sheet")
    .evaluate(
      (el) =>
        getComputedStyle(el).transform === "none" ||
        getComputedStyle(el).transform === "matrix(1, 0, 0, 1, 0, 0)",
    );

test.beforeAll(async ({ browser }) => {
  await owner.pool.query("DELETE FROM rate_limit");
  for (const [i, name] of names.entries()) {
    const context = await browser.newContext({ baseURL: origin });
    const email = `grid-${randomUUID()}@learli.test`;
    const signUp = await context.request.post("/api/auth/sign-up/email", {
      headers: { origin },
      data: { email, password, name },
    });
    const id = (await signUp.json()).user.id as string;
    await owner.pool.query(
      'UPDATE "user" SET email_verified=true WHERE id=$1',
      [id],
    );
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor')",
      [id],
    );
    const profile = await owner.pool.query<{ id: string }>(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,'Synthetic math support',$3,'Synthetic fixture only.','Asia/Manila','approved') RETURNING id",
      [id, `grid-${run}-${i}`, longBio],
    );
    profiles.push(profile.rows[0].id);
    await owner.pool.query(
      "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['middle_school','high_school']::text[] FROM subjects WHERE slug='math'",
      [profile.rows[0].id],
    );
    if (i === 0) {
      // A real upload through the app; approval is trusted test setup.
      await context.request.post("/api/auth/sign-in/email", {
        headers: { origin },
        data: { email, password },
      });
      const upload = await context.request.put("/api/tutor/photo", {
        headers: { origin },
        multipart: {
          photo: {
            name: "headshot.jpg",
            mimeType: "image/jpeg",
            buffer: await sharp({
              create: {
                width: 800,
                height: 1000,
                channels: 3,
                background: "#3a6f8f",
              },
            })
              .jpeg()
              .toBuffer(),
          },
        },
      });
      expect(upload.status()).toBe(200);
      await owner.pool.query(
        "UPDATE tutor_photos SET status='approved', reviewed_at=clock_timestamp() WHERE tutor_id=$1",
        [profile.rows[0].id],
      );
    }
    await context.close();
  }
});
test.afterAll(async () => {
  // Leave no extra public tutors for later specs.
  await owner.pool.query(
    "UPDATE tutor_profiles SET review_status='suspended' WHERE id = ANY($1::uuid[])",
    [profiles],
  );
  await owner.pool.end();
});

test("photo cards reveal a tutor's summary on hover and keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tutors on Learli", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByText("Hover a tutor to see their summary"),
  ).toBeVisible();
  await expect(page.getByText("Tap a tutor to see their summary")).toBeHidden();
  for (const i of [0, 1, 2, 3]) await expect(tile(page, i)).toBeVisible();

  // Photo for the tutor with one; initials on mint for the others.
  await expect(tile(page, 0).locator("img")).toHaveAttribute(
    "src",
    /^\/api\/tutor-photos\//,
  );
  await expect(tile(page, 1).locator(".tutor-tile-initials")).toHaveText(
    nameInitials(names[1]),
  );
  expect(
    await tile(page, 1).evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(232, 246, 241)");

  // Four columns; the 2nd and 4th sit 40px lower.
  const top = async (i: number) => (await tile(page, i).boundingBox())!.y;
  expect(Math.round((await top(1)) - (await top(0)))).toBe(40);
  expect(Math.round((await top(2)) - (await top(0)))).toBe(0);
  expect(Math.round((await top(3)) - (await top(0)))).toBe(40);
  await shot(page, "rest-1440");
  expect(
    (
      await new AxeBuilder({ page })
        .include(".tutor-grid")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  // Hover opens one card; the rest fade.
  expect(await sheetOpen(page, 1)).toBe(false);
  await tile(page, 1).hover();
  await expect.poll(() => sheetOpen(page, 1)).toBe(true);
  await expect
    .poll(() =>
      tile(page, 2).evaluate(
        (el) => getComputedStyle(el.parentElement!).opacity,
      ),
    )
    .toBe("0.55");
  // The name reads white on the navy panel.
  const name = tile(page, 1).getByRole("heading", { name: names[1], level: 3 });
  await expect(name).toBeVisible();
  expect(await name.evaluate((el) => getComputedStyle(el).color)).toBe(
    "rgb(255, 255, 255)",
  );
  const summary = tile(page, 1).locator(".tutor-tile-summary");
  await expect(summary).toHaveText(longBio);
  // Three whole lines at this width: never squeezed mid-line.
  const lines = await summary.evaluate(
    (el) =>
      el.getBoundingClientRect().height /
      parseFloat(getComputedStyle(el).lineHeight),
  );
  expect(lines).toBeCloseTo(3, 1);
  const panel = (await tile(page, 1)
    .locator(".tutor-tile-panel")
    .boundingBox())!;
  const card = (await tile(page, 1).boundingBox())!;
  expect(panel.height / card.height).toBeGreaterThanOrEqual(0.63);
  expect(panel.height / card.height).toBeLessThanOrEqual(0.89);
  await page.waitForTimeout(700);
  await shot(page, "hover-1440");

  // Keyboard: Tab reaches a card, Enter goes to View profile, Escape closes.
  await page.mouse.move(2, 2);
  await page.getByRole("link", { name: "Browse all tutors" }).focus();
  await page.keyboard.press("Tab");
  await expect(tile(page, 0)).toBeFocused();
  await expect.poll(() => sheetOpen(page, 0)).toBe(true);
  // The site's teal focus ring (the reference's lighter teal is too faint
  // on the light page); inside the navy panel it switches to that teal.
  expect(
    await tile(page, 0).evaluate((el) => getComputedStyle(el).outlineColor),
  ).toBe("rgb(10, 117, 102)");
  await page.keyboard.press("Enter");
  const view = page.getByRole("link", { name: `View profile: ${names[0]}` });
  await expect(view).toBeFocused();
  await expect.poll(() => sheetOpen(page, 0)).toBe(true);
  expect(await view.evaluate((el) => getComputedStyle(el).outlineColor)).toBe(
    "rgb(54, 201, 166)",
  );
  await page.waitForTimeout(700);
  await shot(page, "keyboard-1440");
  await page.keyboard.press("Escape");
  await expect(tile(page, 0)).toBeFocused();
  await expect.poll(() => sheetOpen(page, 0)).toBe(false);
  await page.keyboard.press("Enter");
  await expect(view).toBeFocused();
  await view.press("Enter");
  await expect(page).toHaveURL(`/tutors/grid-${run}-0`);
});

test("staggered columns at every breakpoint", async ({ page }) => {
  await page.goto("/");
  const top = async (i: number) => (await tile(page, i).boundingBox())!.y;
  const left = async (i: number) => (await tile(page, i).boundingBox())!.x;
  for (const [width, columns, offsets] of [
    [1024, 3, [0, 40, 0]],
    [700, 2, [0, 28]],
    [400, 1, [0]],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => {
        const xs = new Set<number>();
        for (const i of [0, 1, 2, 3]) xs.add(Math.round(await left(i)));
        return xs.size;
      })
      .toBe(columns);
    if (columns > 1)
      for (const [i, offset] of offsets.entries())
        expect(Math.round((await top(i)) - (await top(0)))).toBe(offset);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await shot(page, `rest-${width}`);
  }
  // Below 1240px the summary keeps two whole lines.
  await page.setViewportSize({ width: 1024, height: 900 });
  await tile(page, 1).hover();
  await expect.poll(() => sheetOpen(page, 1)).toBe(true);
  const lines = await tile(page, 1)
    .locator(".tutor-tile-summary")
    .evaluate(
      (el) =>
        el.getBoundingClientRect().height /
        parseFloat(getComputedStyle(el).lineHeight),
    );
  expect(lines).toBeCloseTo(2, 1);
});

test("a tap toggles one card at a time on touch screens", async ({
  browser,
}) => {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    baseURL: origin,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(
    page.getByText("Tap a tutor to see their summary"),
  ).toBeVisible();
  await expect(
    page.getByText("Hover a tutor to see their summary"),
  ).toBeHidden();
  await tile(page, 0).scrollIntoViewIfNeeded();
  await tile(page, 0).tap({ position: { x: 40, y: 60 } });
  await expect(tile(page, 0)).toHaveAttribute("data-open", "true");
  await expect.poll(() => sheetOpen(page, 0)).toBe(true);
  await page.waitForTimeout(700);
  if (evidence)
    await tile(page, 0).screenshot({
      path: path.join(evidence, "touch-open.png"),
    });
  // Other cards stay at full strength.
  expect(
    await tile(page, 1).evaluate(
      (el) => getComputedStyle(el.parentElement!).opacity,
    ),
  ).toBe("1");
  await tile(page, 1).scrollIntoViewIfNeeded();
  await tile(page, 1).tap({ position: { x: 40, y: 60 } });
  await expect(page.locator(".tutor-tile[data-open]")).toHaveCount(1);
  await expect(tile(page, 1)).toHaveAttribute("data-open", "true");
  await tile(page, 1).tap({ position: { x: 40, y: 60 } });
  await expect(page.locator(".tutor-tile[data-open]")).toHaveCount(0);
  await context.close();
});

test("reduced motion turns every transition off", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: origin,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/");
  for (const part of [
    ".tutor-tile-sheet",
    ".tutor-tile-photo",
    ".tutor-tile-band",
    ".tutor-tile-orb",
    ".tutor-tile-tag",
  ])
    expect(
      await tile(page, 1)
        .locator(part)
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe("0s");
  await context.close();
});
