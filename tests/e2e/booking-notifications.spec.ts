import { completeHistoricalDemoFixture } from "../../src/features/bookings/fixture-tooling";
import type { LifecycleNoticeKind } from "../../src/features/booking-notifications/kinds";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { test, expect, type Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import {
  bookingNoticeKey,
  bookingNoticeMailbox,
} from "../../src/features/booking-notifications/local-capture";

test.use({ trace: "off", screenshot: "off" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const baseURL = process.env.APP_URL!;
async function fixture(browser: Browser) {
  const context = await browser.newContext({ baseURL });
  const email = `notice-browser-${randomUUID()}@learli.test`;
  const password = "Synthetic-notice-browser-passphrase-123";
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic notice account" },
  });
  expect(signup.status()).toBe(200);
  const userId = (await signup.json()).user.id as string;
  await owner.pool.query(
    'UPDATE "user" SET email_verified=true,timezone=$2 WHERE id=$1',
    [userId, "America/New_York"],
  );
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'parent')",
    [userId],
  );
  expect(
    (
      await context.request.post("/api/auth/sign-in/email", {
        headers: { origin: baseURL },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  const learner = await owner.pool.query(
    "INSERT INTO learner_profiles(fixture_key,source,management,display_name,level,timezone) VALUES($1,'local_fixture','guardian','Private synthetic notice browser learner','elementary','Australia/Brisbane') RETURNING id",
    [randomUUID()],
  );
  const learnerId = learner.rows[0].id as string;
  await owner.pool.query(
    "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
    [userId, learnerId],
  );
  const tutorUserId = randomUUID(),
    slug = `notice-browser-${randomUUID()}`;
  await owner.pool.query(
    "INSERT INTO \"user\"(id,name,email,email_verified,timezone) VALUES($1,'Synthetic notice browser tutor',$2,true,'Europe/Paris')",
    [tutorUserId, `notice-tutor-${tutorUserId}@learli.test`],
  );
  await owner.pool.query("INSERT INTO user_access(user_id) VALUES($1)", [
    tutorUserId,
  ]);
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor')",
    [tutorUserId],
  );
  const tutor = await owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic tutoring','Synthetic fixture.','Local test only.','Asia/Manila','approved') RETURNING id",
    [tutorUserId, slug],
  );
  const tutorId = tutor.rows[0].id as string;
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['elementary'] FROM subjects WHERE slug='math'",
    [tutorId],
  );
  for (let day = 1; day <= 7; day++)
    await owner.pool.query(
      "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) VALUES($1,$2,0,1440)",
      [tutorId, day],
    );
  const choice = {
    learnerId,
    tutorSlug: slug,
    subjectSlug: "math",
    displayTimezone: "Asia/Manila",
  };
  const candidates = await context.request.get(
    `/api/bookings/demo/candidates?${new URLSearchParams(choice)}`,
    { headers: { origin: baseURL } },
  );
  expect(candidates.status()).toBe(200);
  const time = (await candidates.json()).times[0] as {
    startAtUtc: string;
    endAtUtc: string;
  };
  const creation = await context.request.post("/api/bookings/demo", {
    headers: { origin: baseURL },
    data: {
      ...choice,
      startAtUtc: time.startAtUtc,
      endAtUtc: time.endAtUtc,
      idempotencyKey: randomUUID(),
    },
  });
  expect(creation.status()).toBe(200);
  const bookingId = (await creation.json()).id as string;
  const events = await owner.pool.query(
    "SELECT id FROM booking_events WHERE booking_id=$1 AND event='demo_reserved'",
    [bookingId],
  );
  const eventId = events.rows[0].id as string;
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "scripts/local-booking-notifications.ts",
      "--test",
      "--limit=2",
      `--event=${eventId}`,
    ],
    { cwd: process.cwd(), env: process.env },
  );
  expect(stdout).toContain(
    "Local capture only. No email was sent. No confirmed lesson.",
  );
  expect(stdout).toContain("Captured: 2");
  expect(stdout.includes(email)).toBe(false);
  const html = await readFile(
    path.join(
      bookingNoticeMailbox("test"),
      `${bookingNoticeKey(eventId, userId)}.html`,
    ),
    "utf8",
  );
  return { context, userId, learnerId, bookingId, eventId, html, choice };
}

test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(() => owner.pool.end());

test("owned CLI capture is accessible and links by keyboard to authenticated current details", async ({
  browser,
}, info) => {
  const data = await fixture(browser);
  const page = await data.context.newPage();
  await page.setContent(data.html);
  await expect(
    page.getByRole("heading", { name: "Simulated reservation created" }),
  ).toBeVisible();
  await expect(
    page.getByText("Local capture only. No email was sent."),
  ).toBeVisible();
  await expect(page.getByText("This is not a confirmed lesson.")).toBeVisible();
  expect(data.html.includes("Private synthetic notice browser learner")).toBe(
    false,
  );
  expect(data.html.includes(data.learnerId)).toBe(false);
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
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
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: info.outputPath(`notice-capture-${width}.png`),
        fullPage: true,
      });
  }
  const link = page.getByRole("link", { name: "View simulated reservation" });
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    `${baseURL}/bookings/${data.bookingId}?scope=guardian`,
  );
  await expect(
    page
      .locator("dd")
      .filter({ hasText: "Private synthetic notice browser learner" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Go to your bookings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your bookings", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Booking view").selectOption("active");
  await page.getByRole("button", { name: "Apply booking view" }).click();
  await expect(page).toHaveURL(/filter=active/);
  await expect(
    page.locator(`a[href="/bookings/${data.bookingId}?scope=guardian"]`),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Booking view")).toHaveValue("all");
  const noJs = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    storageState: await data.context.storageState(),
  });
  const staticPage = await noJs.newPage();
  await staticPage.goto(`/bookings/${data.bookingId}?scope=guardian`);
  await expect(
    staticPage
      .locator("dd")
      .filter({ hasText: "Private synthetic notice browser learner" }),
  ).toBeVisible();
  await staticPage
    .getByRole("link", { name: "Go to your bookings", exact: true })
    .click();
  await staticPage.getByLabel("Booking view").selectOption("active");
  await staticPage.getByRole("button", { name: "Apply booking view" }).click();
  await expect(staticPage).toHaveURL(/filter=active/);
  await expect(
    staticPage.locator(`a[href="/bookings/${data.bookingId}?scope=guardian"]`),
  ).toBeVisible();
  await noJs.close();
  await data.context.close();
});

test("a captured link does not grant access after sign-out or guardian revocation", async ({
  browser,
}) => {
  const data = await fixture(browser);
  const outsider = await browser.newContext({ baseURL });
  const page = await outsider.newPage();
  await page.goto(`/bookings/${data.bookingId}?scope=guardian`);
  expect(
    (await page.content()).includes("Private synthetic notice browser learner"),
  ).toBe(false);
  await owner.pool.query(
    "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
    [data.userId, data.learnerId],
  );
  const response = await data.context.request.get(
    `/bookings/${data.bookingId}?scope=guardian`,
  );
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("find that booking on this account");
  expect(
    (await response.text()).includes(
      "Private synthetic notice browser learner",
    ),
  ).toBe(false);
  const deniedApi = await data.context.request.get(
    `/api/bookings/${data.bookingId}?scope=guardian`,
    { headers: { origin: baseURL } },
  );
  expect(deniedApi.status()).toBe(404);
  expect(
    (await deniedApi.text()).includes(
      "Private synthetic notice browser learner",
    ),
  ).toBe(false);
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "scripts/local-booking-notifications.ts",
      "--test",
      `--event=${data.eventId}`,
    ],
    { cwd: process.cwd(), env: process.env },
  );
  expect(stdout).toContain("Captured: 0");
  await outsider.close();
  await data.context.close();
});

async function lifecycleCapture(
  eventId: string,
  recipient: string,
  kind: LifecycleNoticeKind,
) {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "scripts/local-booking-notifications.ts",
      "--test",
      `--event=${eventId}`,
    ],
    { cwd: process.cwd(), env: process.env },
  );
  expect(stdout).toContain("Captured: 2");
  return readFile(
    path.join(
      bookingNoticeMailbox("test"),
      `${bookingNoticeKey(eventId, recipient, kind)}.html`,
    ),
    "utf8",
  );
}

test("cancelled capture has responsive keyboard access and current authenticated terminal details", async ({
  browser,
}, info) => {
  const f = await fixture(browser);
  const response = await f.context.request.post(
    `/api/bookings/${f.bookingId}/cancel`,
    {
      headers: { origin: baseURL },
      data: { requestId: randomUUID(), expectedRevision: 0 },
    },
  );
  expect(response.status()).toBe(200);
  const result = await response.json();
  const html = await lifecycleCapture(
    result.eventId,
    f.userId,
    "simulated_reservation_cancelled",
  );
  for (const privateValue of [
    f.learnerId,
    f.userId,
    "Private synthetic notice browser learner",
    "meet.google.com",
    "zoom.us",
  ])
    expect(html.includes(privateValue)).toBe(false);
  const page = await f.context.newPage();
  await page.setContent(html);
  await expect(
    page.getByRole("heading", {
      name: "Simulated reservation cancelled",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("This is not a confirmed lesson.")).toBeVisible();
  await expect(page.getByText("Simulation expires at")).toHaveCount(0);
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
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
    if (width !== 320)
      await page.screenshot({
        path: info.outputPath(`lifecycle-cancel-${width}.png`),
        fullPage: true,
      });
  }
  const link = page.getByRole("link", { name: "View simulated reservation" });
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    `${baseURL}/bookings/${f.bookingId}?scope=guardian`,
  );
  await expect(
    page.getByRole("heading", {
      name: "Simulation cancelled",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await f.context.request.post("/api/auth/sign-out", {
    headers: { origin: baseURL },
    data: {},
  });
  await page.reload();
  expect(
    (await page.content()).includes("Private synthetic notice browser learner"),
  ).toBe(false);
  await page.goBack();
  expect(
    (await page.content()).includes("Private synthetic notice browser learner"),
  ).toBe(false);
  await f.context.close();
});

test("rescheduled capture links the new head and remains private after recipient revocation", async ({
  browser,
}, info) => {
  const f = await fixture(browser);
  const choices = await f.context.request.get(
    `/api/bookings/demo/candidates?${new URLSearchParams(f.choice)}`,
  );
  expect(choices.status()).toBe(200);
  const time = (await choices.json()).times[0];
  const response = await f.context.request.post(
    `/api/bookings/${f.bookingId}/reschedule`,
    {
      headers: { origin: baseURL },
      data: {
        requestId: randomUUID(),
        expectedRevision: 0,
        startAtUtc: time.startAtUtc,
        endAtUtc: time.endAtUtc,
        displayTimezone: "Asia/Manila",
      },
    },
  );
  expect(response.status()).toBe(200);
  const result = await response.json();
  const html = await lifecycleCapture(
    result.eventId,
    f.userId,
    "simulated_reservation_rescheduled",
  );
  expect(html).toContain(`/bookings/${result.id}?scope=guardian`);
  expect(html).not.toContain(`/bookings/${f.bookingId}?`);
  const page = await f.context.newPage();
  await page.setContent(html);
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole("heading", { name: "Simulated reservation rescheduled" }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`lifecycle-move-${width}.png`),
      fullPage: true,
    });
  }
  await owner.pool.query(
    "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
    [f.userId, f.learnerId],
  );
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "View simulated reservation" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("We can't find that booking on this account", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await page.content()).includes("Private synthetic notice browser learner"),
  ).toBe(false);
  expect(
    (
      await f.context.request.get(`/api/bookings/${result.id}?scope=guardian`)
    ).status(),
  ).toBe(404);
  await page.goBack();
  expect(
    (await page.content()).includes("Private synthetic notice browser learner"),
  ).toBe(false);
  await f.context.close();
});

test("completed owner fixture capture is visibly synthetic on phone and desktop without attendance claims", async ({
  browser,
}, info) => {
  const f = await fixture(browser);
  const id = randomUUID();
  await owner.pool.query(
    "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) SELECT $1,source,tutor_id,learner_id,booked_by_user_id,subject_id,now()-interval '2 hours',now()-interval '1 hour',display_timezone,$2,repeat('a',64),'demo_reserved',now(),now()+interval '10 minutes' FROM bookings WHERE id=$3",
    [id, randomUUID(), f.bookingId],
  );
  await owner.pool.query(
    "INSERT INTO booking_events(booking_id,event) VALUES($1,'demo_reserved')",
    [id],
  );
  await completeHistoricalDemoFixture(owner, id);
  const events = await owner.pool.query(
    "SELECT id,event FROM booking_lifecycle_events WHERE booking_id=$1",
    [id],
  );
  const eventId = events.rows.find((e) => e.event === "demo_completed")
    .id as string;
  const html = await lifecycleCapture(
    eventId,
    f.userId,
    "simulated_fixture_completed",
  );
  expect(html.includes(f.learnerId)).toBe(false);
  const page = await f.context.newPage();
  await page.setContent(html);
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole("heading", { name: "Synthetic fixture marked completed" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Owner-provisioned synthetic fixture only. This does not establish a real lesson, payment or attendance.",
      ),
    ).toBeVisible();
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
    if (width !== 320)
      await page.screenshot({
        path: info.outputPath(`lifecycle-completed-${width}.png`),
        fullPage: true,
      });
  }
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "View simulated reservation" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Fixture completion",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  const outsider = await browser.newContext({ baseURL });
  const denied = await outsider.request.get(
    `/api/bookings/${id}?scope=guardian`,
  );
  expect(denied.status()).toBe(401);
  await outsider.close();
  await f.context.close();
});

test("confirmed owner fixture capture keeps synthetic wording and meaningful TTL on phone and desktop", async ({
  browser,
}, info) => {
  const f = await fixture(browser),
    eventId = randomUUID();
  const client = await owner.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE bookings SET state='demo_confirmed' WHERE id=$1",
      [f.bookingId],
    );
    await client.query(
      "INSERT INTO booking_lifecycle_events(id,logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint) VALUES($1,$2,$2,$3,'demo_confirmed',$4,repeat('a',64))",
      [eventId, f.bookingId, f.userId, randomUUID()],
    );
    await client.query("COMMIT");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  const html = await lifecycleCapture(
    eventId,
    f.userId,
    "simulated_fixture_confirmed",
  );
  expect(html.includes(f.learnerId)).toBe(false);
  const page = await f.context.newPage();
  await page.setContent(html);
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole("heading", { name: "Synthetic fixture marked confirmed" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Owner-provisioned synthetic fixture only. This does not establish a real lesson, payment or attendance.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Simulation expires at", { exact: true }),
    ).toBeVisible();
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
    if (width !== 320)
      await page.screenshot({
        path: info.outputPath(`lifecycle-confirmed-${width}.png`),
        fullPage: true,
      });
  }
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "View simulated reservation" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Booking details",
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator("main span").filter({ hasText: /^Fixture confirmation$/ }),
  ).toBeVisible();
  const noJs = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    storageState: await f.context.storageState(),
  });
  const staticPage = await noJs.newPage();
  await staticPage.goto(`/bookings/${f.bookingId}?scope=guardian`);
  await expect(
    staticPage.getByRole("heading", {
      name: "Booking details",
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    staticPage
      .locator("main span")
      .filter({ hasText: /^Fixture confirmation$/ }),
  ).toBeVisible();
  await noJs.close();
  await f.context.close();
});
