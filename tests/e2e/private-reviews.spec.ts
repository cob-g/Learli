import {
  enrollBrowserAdmin,
  completeBrowserAdminChallenge,
} from "../support/browser-admin-mfa";
import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import { completeHistoricalDemoFixture } from "../../src/features/bookings/fixture-tooling";
import {
  provisionReviewModerator,
  provisionReviewGrant,
} from "../../src/features/private-reviews/fixture-tooling";
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true),
  baseURL = process.env.APP_URL!;
const password = "Synthetic-private-review-browser-123";
test.use({ trace: "off", screenshot: "off" });
async function account(
  browser: Browser,
  role: "parent" | "tutor" | "admin",
  javaScriptEnabled = true,
) {
  const context = await browser.newContext({ baseURL, javaScriptEnabled });
  const email = `review-${randomUUID()}@learli.test`;
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic review account" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
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
  if (role === "admin") await enrollBrowserAdmin(context, password);
  return { context, page: await context.newPage(), id, email };
}
async function world(browser: Browser, javaScriptEnabled = true) {
  await owner.pool.query("UPDATE rate_limit SET count=0");
  const parent = await account(browser, "parent", javaScriptEnabled),
    tutor = await account(browser, "tutor"),
    admin = await account(browser, "admin");
  const learner = (
    await owner.pool.query(
      "INSERT INTO learner_profiles(fixture_key,source,management,display_name,level,timezone) VALUES($1,'local_fixture','guardian','Synthetic review learner','elementary','UTC') RETURNING id",
      [randomUUID()],
    )
  ).rows[0].id;
  await owner.pool.query(
    "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
    [parent.id, learner],
  );
  const slug = `private-review-${randomUUID()}`,
    profile = (
      await owner.pool.query(
        "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic tutor only','Synthetic biography','Fixture','UTC','approved') RETURNING id",
        [tutor.id, slug],
      )
    ).rows[0].id;
  const subject = (
    await owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES($1,$2,ARRAY['elementary'])",
    [profile, subject],
  );
  const booking = randomUUID(),
    start = new Date(Date.now() - 5 * 86400000);
  await owner.pool.query(
    "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES($1,'local_simulation',$2,$3,$4,$5,$6,$7,'UTC',$8,$9,'demo_reserved',clock_timestamp(),clock_timestamp()+interval '10 minutes')",
    [
      booking,
      profile,
      learner,
      parent.id,
      subject,
      start,
      new Date(start.getTime() + 3600000),
      randomUUID(),
      "a".repeat(64),
    ],
  );
  await owner.pool.query(
    "INSERT INTO booking_events(booking_id,event) VALUES($1,'demo_reserved')",
    [booking],
  );
  await completeHistoricalDemoFixture(owner, booking);
  const close = async () => {
    await parent.context.close();
    await tutor.context.close();
    await admin.context.close();
  };
  return { parent, tutor, admin, booking, profile, learner, slug, close };
}
async function accessible(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}
test.afterAll(() => owner.pool.end());
for (const [label, width, height] of [
  ["phone", 390, 844],
  ["desktop", 1440, 900],
  ["narrow", 320, 720],
] as const) {
  test(`${label} keyboard submission/private moderation/text safety and public truth`, async ({
    browser,
  }, info) => {
    const f = await world(browser);
    try {
      const page = f.parent.page;
      await page.setViewportSize({ width, height });
      await page.goto(`/bookings/${f.booking}?scope=guardian`);
      await page
        .getByRole("link", {
          name: "Add private synthetic review",
          exact: true,
        })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Private synthetic review for Synthetic review learner",
      );
      await accessible(page);
      await expect(page.getByLabel("Rating from 1 to 5")).toBeEnabled();
      await page.getByLabel("Rating from 1 to 5").focus();
      await expect(page.getByLabel("Rating from 1 to 5")).toBeFocused();
      await page.keyboard.press("2");
      await expect(page.getByLabel("Rating from 1 to 5")).toHaveValue("2");
      await page.keyboard.press("Tab");
      expect(
        await page
          .getByLabel(/Comment/)
          .evaluate((e) => e === document.activeElement),
      ).toBe(true);
      const token = `Synthetic private text ${randomUUID()} <img src=x onerror=evil()> ${"long".repeat(80)}`;
      await page.getByLabel(/Comment/).fill(token);
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Save private synthetic review" }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("heading", { name: "Saved private review" }),
      ).toBeVisible();
      await expect(page.getByText(token, { exact: true })).toBeVisible();
      expect(await page.locator('img[src="x"]').count()).toBe(0);
      expect(new URL(page.url()).search).toBe("");
      await accessible(page);
      await page.screenshot({
        path: info.outputPath(`${label}-private-author.png`),
        fullPage: true,
      });
      await page
        .getByRole("link", { name: "Return to booking details" })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/bookings/${f.booking}\\?scope=guardian`),
      );
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Fixture completion",
      );
      await page
        .getByRole("link", {
          name: "View private synthetic review",
          exact: true,
        })
        .click();
      const review = (
        await owner.pool.query(
          "SELECT id FROM private_booking_reviews WHERE booking_id=$1",
          [f.booking],
        )
      ).rows[0].id;
      const denied = await f.admin.context.request.get(
        `/api/admin/reviews/${review}`,
      );
      expect(denied.status()).toBe(404);
      expect(await denied.text()).not.toContain(token);
      await provisionReviewModerator(owner, f.admin.id, "authorized");
      await provisionReviewGrant(owner, f.admin.id, review, "authorized");
      const admin = f.admin.page;
      await admin.setViewportSize({ width, height });
      await admin.goto("/admin");
      // Narrow screens keep the admin work areas behind the workspace menu.
      const menu = admin.getByRole("button", { name: "Workspace menu" });
      if (await menu.isVisible()) await menu.click();
      await admin
        .getByRole("link", { name: "Private synthetic reviews", exact: true })
        .click();
      await admin.getByRole("link", { name: "Open scoped review 1" }).click();
      await expect(admin.getByText(token, { exact: true })).toBeVisible();
      await accessible(admin);
      await admin
        .getByLabel("Next local state")
        .selectOption("locally_approved");
      await admin
        .getByRole("button", { name: "Save private local state" })
        .click();
      await expect(
        admin.getByText("Locally approved · private", { exact: true }).first(),
      ).toBeVisible();
      await expect(
        admin.getByLabel("Next local state").locator("option"),
      ).toHaveText(["Pending local moderation"]);
      await accessible(admin);
      await admin.screenshot({
        path: info.outputPath(`${label}-private-moderator.png`),
        fullPage: true,
      });
      await admin.getByLabel("Next local state").selectOption("pending");
      await admin
        .getByRole("button", { name: "Save private local state" })
        .click();
      await expect(
        admin.getByText("Pending local moderation", { exact: true }).first(),
      ).toBeVisible();
      await expect(
        admin.getByLabel("Next local state").locator("option"),
      ).toHaveCount(2);
      await page.reload();
      await expect(page.getByText(token, { exact: true })).toBeVisible();
      await f.tutor.page.goto(`/tutors/${f.slug}`);
      for (const publicPath of [`/tutors/${f.slug}`, "/tutors"]) {
        await f.tutor.page.goto(publicPath);
        const html = await f.tutor.page.content();
        expect(html).not.toContain(token);
        expect(html).not.toContain(f.learner);
        expect(html).not.toContain("Synthetic review learner");
        await expect(
          f.tutor.page.getByText(
            /average rating|[1-5] out of 5|[0-9]+ reviews|[0-9]+ stars/i,
          ),
        ).toHaveCount(0);
      }
      await provisionReviewGrant(owner, f.admin.id, review, "revoked");
      await admin.reload();
      await expect(
        admin.getByRole("heading", { name: "Private review unavailable" }),
      ).toBeVisible();
      expect(await admin.content()).not.toContain(token);
    } finally {
      await f.close();
    }
  });
}
test("no-JavaScript POST safety and fully awaited private read", async ({
  browser,
}) => {
  const f = await world(browser, false);
  try {
    await f.parent.page.goto(`/bookings/${f.booking}/review`);
    await expect(
      f.parent.page.getByText(/Enable JavaScript to save/),
    ).toBeVisible();
    await expect(f.parent.page.getByLabel("Rating from 1 to 5")).toBeDisabled();
    await expect(f.parent.page.locator("form")).toHaveAttribute(
      "method",
      "post",
    );
    expect(new URL(f.parent.page.url()).search).toBe("");
  } finally {
    await f.close();
  }
});
test("stale moderation, uncertain retry, session expiry and account-switch Back privacy", async ({
  browser,
}) => {
  const f = await world(browser);
  try {
    const page = f.parent.page,
      token = `Synthetic review privacy ${randomUUID()}`;
    await page.goto(`/bookings/${f.booking}/review`);
    await page.getByLabel("Rating from 1 to 5").selectOption("4");
    await page.getByLabel(/Comment/).fill(token);
    let fail = true;
    await page.route(`**/api/bookings/${f.booking}/review`, async (route) => {
      if (fail) {
        fail = false;
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        await route.abort("failed");
      } else await route.continue();
    });
    await page
      .getByRole("button", { name: "Save private synthetic review" })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "result is uncertain" }),
    ).toContainText("result is uncertain");
    await expect(
      page.getByRole("alert").filter({ hasText: "result is uncertain" }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Save private synthetic review" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Saved private review" }),
    ).toBeVisible();
    expect(
      (
        await owner.pool.query(
          "SELECT count(*)::int n FROM private_booking_reviews WHERE booking_id=$1",
          [f.booking],
        )
      ).rows[0].n,
    ).toBe(1);
    const review = (
      await owner.pool.query(
        "SELECT id FROM private_booking_reviews WHERE booking_id=$1",
        [f.booking],
      )
    ).rows[0].id;
    await provisionReviewModerator(owner, f.admin.id, "authorized");
    await provisionReviewGrant(owner, f.admin.id, review, "authorized");
    await f.admin.page.goto(`/admin/reviews/${review}`);
    const newer = await f.admin.context.request.patch(
      `/api/admin/reviews/${review}`,
      {
        headers: { origin: baseURL },
        data: {
          expectedRevision: 0,
          requestId: randomUUID(),
          state: "locally_rejected",
        },
      },
    );
    expect(newer.status()).toBe(200);
    await f.admin.page
      .getByRole("button", { name: "Save private local state" })
      .click();
    await expect(
      f.admin.page.getByRole("alert").filter({ hasText: "review changed" }),
    ).toContainText("review changed");
    await expect(
      f.admin.page.getByRole("alert").filter({ hasText: "review changed" }),
    ).toBeFocused();
    await owner.pool.query(
      "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
      [f.parent.id],
    );
    await page.reload();
    await expect(page).toHaveURL(/\/sign-in/);
    expect(await page.content()).not.toContain(token);
    // A different actor signs in through the real form in the same browser document.
    await page.getByLabel("Email", { exact: true }).fill(f.admin.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await completeBrowserAdminChallenge(page, f.admin.email);
    await expect(
      page.getByRole("heading", { name: "Private review unavailable" }),
    ).toBeVisible();
    expect(await page.content()).not.toContain(token);
    await page.goBack();
    await page.waitForLoadState("load");
    // Locator evaluation resolves in the restored document across the navigation
    // boundary; inspect the whole HTML, including private bootstrap scripts.
    expect(
      await page.locator("html").evaluate((element) => element.outerHTML),
    ).not.toContain(token);
  } finally {
    await f.close();
  }
});
