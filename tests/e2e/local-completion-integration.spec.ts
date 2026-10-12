import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { dispatchPendingBookingNotices } from "../../src/features/booking-notifications/dispatch";
import {
  bookingNoticeKey,
  bookingNoticeMailbox,
} from "../../src/features/booking-notifications/local-capture";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import { bookingSelectionHref } from "../../src/features/bookings/selection";

const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const baseURL = process.env.APP_URL!;
const password = "Synthetic-local-wave-browser-passphrase-123";
test.use({ trace: "off", screenshot: "off" });
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(() => owner.pool.end());

async function actor(browser: Browser, role: "parent" | "tutor") {
  const context = await browser.newContext({ baseURL });
  const email = `local-wave-${randomUUID()}@learli.test`;
  const response = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic local wave account" },
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).user.id as string;
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
  return { id, context, page: await context.newPage() };
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

test("public choice survives local learner creation, then replacement and cancellation preserve private history", async ({
  browser,
}, info) => {
  const parent = await actor(browser, "parent");
  const peer = await actor(browser, "parent");
  const tutor = await actor(browser, "tutor");
  const slug = `local-wave-${randomUUID()}`;
  const profile = (
    await owner.pool.query(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic local tutor','Synthetic fixture only.','Local fixture','Asia/Manila','approved') RETURNING id",
      [tutor.id, slug],
    )
  ).rows[0].id as string;
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['elementary'] FROM subjects WHERE slug='math'",
    [profile],
  );
  for (let day = 1; day <= 7; day++)
    await owner.pool.query(
      "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) VALUES($1,$2,480,1200)",
      [profile, day],
    );
  const page = parent.page;
  const privateName = "Fictional local wave learner";
  try {
    const availability = await parent.context.request.get(
      `/api/tutors/${slug}/availability?${new URLSearchParams({ subjectSlug: "math", level: "elementary", displayTimezone: "Asia/Manila" })}`,
    );
    expect(availability.status()).toBe(200);
    const time = (await availability.json()).tutors[0].times[0] as {
      startAtUtc: string;
      endAtUtc: string;
    };
    const selected = bookingSelectionHref({
      tutorSlug: slug,
      subjectSlug: "math",
      level: "elementary",
      displayTimezone: "Asia/Manila",
      startAtUtc: time.startAtUtc,
      endAtUtc: time.endAtUtc,
    });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(selected);
    await page
      .getByRole("link", { name: "Create a local learner", exact: true })
      .click();
    await expect(page).toHaveURL(/\/learners\/new\?next=/);
    await page.getByLabel("Display name", { exact: true }).fill(privateName);
    await page.getByLabel("Level", { exact: true }).selectOption("elementary");
    await page
      .getByLabel("Time zone", { exact: true })
      .selectOption("Asia/Manila");
    await page
      .getByRole("button", { name: "Create local learner", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Local learner created" }),
    ).toBeVisible();
    expect(page.url()).not.toContain("displayName");
    await accessible(page);
    await page.screenshot({
      path: info.outputPath("combined-created-return-320.png"),
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Return to selected time", exact: true })
      .click();
    await expect(page.getByLabel("Tutor", { exact: true })).toHaveValue(slug);
    await expect(page.locator('input[name="time"]:checked')).toHaveValue(
      time.startAtUtc,
    );
    await page
      .getByRole("button", {
        name: "Create simulated reservation",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Simulated reservation saved",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "View booking details", exact: true })
      .click();
    await expect(page).toHaveURL(/\/bookings\/[a-f0-9-]+\?scope=guardian$/);
    const originalId = new URL(page.url()).pathname.split("/").pop()!;
    const original = (
      await owner.pool.query(
        "SELECT learner_id,logical_booking_id,expires_at,start_at_utc FROM bookings WHERE id=$1",
        [originalId],
      )
    ).rows[0];
    expect(original.logical_booking_id).toBe(originalId);
    expect(
      (
        await peer.context.request.get(
          `/api/bookings/${originalId}?scope=guardian`,
        )
      ).status(),
    ).toBe(404);

    await tutor.page.goto(`/bookings/${originalId}?scope=tutor`);
    await tutor.page
      .getByLabel("Zoom or Google Meet test link")
      .fill("https://meet.google.com/abc-defg-hij");
    await tutor.page
      .getByRole("button", { name: "Save test meeting link", exact: true })
      .click();
    await expect(
      tutor.page
        .getByRole("status")
        .filter({ hasText: "Test meeting link saved." }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("link", { name: "Reschedule simulation", exact: true })
      .click();
    await page.locator('input[name="time"]').first().check();
    await page
      .getByRole("button", { name: "Move simulated reservation", exact: true })
      .click();
    await expect(page).toHaveURL(/\/bookings\/[a-f0-9-]+\?scope=guardian$/);
    const replacementId = new URL(page.url()).pathname.split("/").pop()!;
    expect(replacementId).not.toBe(originalId);
    const replacement = (
      await owner.pool.query(
        "SELECT learner_id,logical_booking_id,replaces_booking_id,expires_at FROM bookings WHERE id=$1",
        [replacementId],
      )
    ).rows[0];
    expect(replacement.logical_booking_id).toBe(originalId);
    expect(replacement.replaces_booking_id).toBe(originalId);
    expect(replacement.learner_id).toBe(original.learner_id);
    expect(replacement.expires_at).toEqual(original.expires_at);
    const oldLink = await parent.context.request.get(
      `/api/bookings/${originalId}/meeting-link?open=1`,
      { maxRedirects: 0 },
    );
    expect(oldLink.status()).not.toBe(303);
    expect(oldLink.headers().location).toBeUndefined();
    expect(
      (
        await owner.pool.query(
          "SELECT count(*)::int AS n FROM booking_meeting_links WHERE booking_id=$1",
          [replacementId],
        )
      ).rows[0].n,
    ).toBe(0);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await accessible(page);
    }
    await page.getByText("Cancel simulation", { exact: true }).click();
    await page
      .getByRole("button", {
        name: "Confirm simulated cancellation",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Simulation cancelled", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Reschedule simulation", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath("combined-cancelled-desktop.png"),
      fullPage: true,
    });
    const history = await owner.pool.query(
      "SELECT id,event FROM booking_lifecycle_events WHERE logical_booking_id=$1 ORDER BY created_at,id",
      [originalId],
    );
    expect(history.rows.map((row: { event: string }) => row.event)).toEqual([
      "demo_rescheduled",
      "demo_cancelled",
    ]);
    // The A replacement/cancellation path must feed B without another created notice.
    expect(
      (
        await owner.pool.query(
          "SELECT count(*)::int n FROM booking_notification_deliveries d JOIN booking_events e ON e.id=d.event_id WHERE e.booking_id=$1",
          [replacementId],
        )
      ).rows[0].n,
    ).toBe(0);
    const notices = createDatabase(process.env.DATABASE_URL ?? "", true);
    try {
      const runtime = {
        pool: notices.pool,
        environment: "test" as const,
        origin: baseURL,
      };
      expect(
        (
          await dispatchPendingBookingNotices(runtime, {
            eventId: history.rows[0].id,
          })
        ).suppressed,
      ).toBe(2);
      expect(
        (
          await dispatchPendingBookingNotices(runtime, {
            eventId: history.rows[1].id,
          })
        ).captured,
      ).toBe(2);
      expect(
        (
          await dispatchPendingBookingNotices(runtime, {
            eventId: history.rows[1].id,
          })
        ).captured,
      ).toBe(0);
      const capture = await readFile(
        path.join(
          bookingNoticeMailbox("test"),
          `${bookingNoticeKey(history.rows[1].id, parent.id, "simulated_reservation_cancelled")}.html`,
        ),
        "utf8",
      );
      for (const privateValue of [
        privateName,
        original.learner_id,
        "https://meet.google.com/abc-defg-hij",
      ])
        expect(capture).not.toContain(privateValue);
      expect(capture).toContain(`/bookings/${replacementId}`);
    } finally {
      await notices.pool.end();
    }
    expect(
      (
        await peer.context.request.get(
          `/api/bookings/${replacementId}?scope=guardian`,
        )
      ).status(),
    ).toBe(404);
    const publicHtml = await (
      await peer.context.request.get(`/tutors/${slug}`)
    ).text();
    for (const value of [
      privateName,
      original.learner_id,
      originalId,
      replacementId,
    ])
      expect(publicHtml.includes(value)).toBe(false);
  } finally {
    await owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
      [profile],
    );
    await Promise.all([
      parent.context.close(),
      peer.context.close(),
      tutor.context.close(),
    ]);
  }
});
