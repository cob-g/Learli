import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import {
  localMailbox,
  type LocalMessage,
} from "../../src/lib/email/local-mail";
import {
  bookingNoticeKey,
  bookingNoticeMailbox,
} from "../../src/features/booking-notifications/local-capture";

test.use({ trace: "off", screenshot: "off" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const baseURL = process.env.APP_URL!;
const password = "Synthetic-combined-passphrase-123";
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
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(() => owner.pool.end());

test("one matching choice survives verification into private family/tutor views and a revocable local notice link", async ({
  browser,
}, info) => {
  const tutorContext = await browser.newContext({ baseURL });
  const tutorEmail = `combined-tutor-${randomUUID()}@learli.test`;
  const tutorSignup = await tutorContext.request.post(
    "/api/auth/sign-up/email",
    {
      headers: { origin: baseURL },
      data: {
        email: tutorEmail,
        password,
        name: "AAA synthetic combined tutor",
      },
    },
  );
  expect(tutorSignup.status()).toBe(200);
  const tutorUserId = (await tutorSignup.json()).user.id as string;
  await owner.pool.query(
    'UPDATE "user" SET email_verified=true,timezone=$2 WHERE id=$1',
    [tutorUserId, "Europe/Paris"],
  );
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor')",
    [tutorUserId],
  );
  expect(
    (
      await tutorContext.request.post("/api/auth/sign-in/email", {
        headers: { origin: baseURL },
        data: { email: tutorEmail, password },
      })
    ).status(),
  ).toBe(200);
  const slug = `combined-${randomUUID()}`;
  const tutorId = (
    await owner.pool.query(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic support','Local synthetic fixture.','Local synthetic fixture.','UTC','approved') RETURNING id",
      [tutorUserId, slug],
    )
  ).rows[0].id as string;
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['elementary'] FROM subjects WHERE slug='study-skills'",
    [tutorId],
  );
  await owner.pool.query(
    "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT $1,day,0,1440 FROM generate_series(1,7) day",
    [tutorId],
  );

  const context = await browser.newContext({
    baseURL,
    timezoneId: "Asia/Manila",
  });
  const page = await context.newPage();
  await page.goto(
    "/get-matched?level=elementary&subject=study-skills&timezone=Asia%2FManila&when=any",
  );
  const profileLink = page.getByRole("link", {
    name: "View profile: AAA synthetic combined tutor",
    exact: true,
  });
  await expect(profileLink).toBeVisible();
  const selected = new URL((await profileLink.getAttribute("href"))!, baseURL);
  const start = selected.searchParams.get("startAtUtc")!;
  const end = selected.searchParams.get("endAtUtc")!;
  expect(!!start && !!end).toBe(true);
  await profileLink.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('input[name="time"]:checked')).toHaveValue(
    `${start}|${end}`,
  );
  await page.getByRole("button", { name: "Review simulated booking" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  const next = new URL(page.url()).searchParams.get("next")!;
  expect(next.includes("learnerId")).toBe(false);
  await page
    .getByRole("link", { name: "Create test account", exact: true })
    .click();
  const email = `combined-parent-${randomUUID()}@learli.test`;
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic combined parent");
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create test account", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "verification message" }),
  ).toBeVisible();
  const parentId = (
    await owner.pool.query('SELECT id FROM "user" WHERE email=$1', [email])
  ).rows[0].id as string;
  let verification: LocalMessage | undefined;
  for (const file of await readdir(localMailbox("test"))) {
    if (!file.endsWith(".json")) continue;
    const message = JSON.parse(
      await readFile(path.join(localMailbox("test"), file), "utf8"),
    ) as LocalMessage;
    if (message.to === email && message.kind === "verification")
      verification = message;
  }
  expect(!!verification).toBe(true);
  await page.goto(verification!.url);
  expect(new URL(page.url()).searchParams.get("next")).toBe(next);
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'parent')",
    [parentId],
  );
  await owner.pool.query('UPDATE "user" SET timezone=$2 WHERE id=$1', [
    parentId,
    "Asia/Manila",
  ]);
  const learnerId = (
    await owner.pool.query(
      "INSERT INTO learner_profiles(fixture_key,source,management,display_name,level,timezone) VALUES($1,'local_fixture','guardian','Private synthetic combined learner','elementary','Australia/Brisbane') RETURNING id",
      [randomUUID()],
    )
  ).rows[0].id as string;
  await owner.pool.query(
    "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
    [parentId, learnerId],
  );
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/bookings\/demo\?/);
  await expect(page.locator('input[name="time"]:checked')).toHaveValue(start);
  await page
    .getByRole("button", { name: "Create simulated reservation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Simulated reservation saved" }),
  ).toBeVisible();
  const booking = (
    await owner.pool.query(
      "SELECT id,start_at_utc,end_at_utc,state,source FROM bookings WHERE tutor_id=$1 AND booked_by_user_id=$2",
      [tutorId, parentId],
    )
  ).rows[0];
  expect(booking.start_at_utc.toISOString()).toBe(start);
  expect(booking.end_at_utc.toISOString()).toBe(end);
  expect(booking.state).toBe("demo_reserved");
  expect(booking.source).toBe("local_simulation");
  const request = {
    learnerId,
    tutorSlug: slug,
    subjectSlug: "study-skills",
    displayTimezone: "Asia/Manila",
    startAtUtc: start,
    endAtUtc: end,
    idempotencyKey: randomUUID(),
  };
  expect(
    (
      await context.request.post("/api/bookings/demo", {
        headers: { origin: baseURL },
        data: request,
      })
    ).status(),
  ).toBe(409);
  await page.goto("/parent");
  await expect(
    page.getByRole("heading", {
      name: "Bookings for Private synthetic combined learner",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /View booking/ }).first(),
  ).toHaveAttribute("href", `/bookings/${booking.id}?scope=guardian`);
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
    await page.screenshot({
      path: info.outputPath(`combined-parent-${width}.png`),
      fullPage: true,
    });
  }
  const tutorPage = await tutorContext.newPage();
  await tutorPage.goto("/tutor");
  await expect(
    tutorPage.getByRole("heading", { name: "Your bookings", exact: true }),
  ).toBeVisible();
  await expect(
    tutorPage.getByRole("link", {
      name: /View booking for Private synthetic combined learner/,
    }),
  ).toHaveAttribute("href", `/bookings/${booking.id}?scope=tutor`);
  await accessible(tutorPage);
  await tutorPage
    .getByRole("link", {
      name: /View booking for Private synthetic combined learner/,
    })
    .click();
  await expect(
    tutorPage.getByRole("heading", {
      name: "Booking details",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    tutorPage.getByText("Simulated reservation", { exact: true }),
  ).toBeVisible();
  const eventId = (
    await owner.pool.query(
      "SELECT id FROM booking_events WHERE booking_id=$1 AND event='demo_reserved'",
      [booking.id],
    )
  ).rows[0].id as string;
  const capture = await promisify(execFile)(
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
  expect(capture.stdout.includes("Captured: 2")).toBe(true);
  const html = await readFile(
    path.join(
      bookingNoticeMailbox("test"),
      `${bookingNoticeKey(eventId, parentId)}.html`,
    ),
    "utf8",
  );
  expect(
    html.includes(learnerId) ||
      html.includes("Private synthetic combined learner"),
  ).toBe(false);
  await page.setContent(html);
  await page.getByRole("link").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/bookings/${booking.id}?scope=guardian`);
  await expect(
    page.getByRole("heading", { name: "Booking details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Simulated reservation", { exact: true }),
  ).toBeVisible();
  const anonymous = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  expect(
    (
      await anonymous.request.get(`/api/bookings/${booking.id}?scope=guardian`)
    ).status(),
  ).toBe(401);
  await owner.pool.query(
    "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
    [parentId, learnerId],
  );
  expect(
    (
      await context.request.get(`/api/bookings/${booking.id}?scope=guardian`)
    ).status(),
  ).toBe(404);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "We can't find that booking on this account",
    }),
  ).toBeVisible();
  expect(
    (
      await tutorContext.request.get(`/api/bookings/${booking.id}?scope=tutor`)
    ).status(),
  ).toBe(200);
  await owner.pool.query(
    "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
    [tutorId],
  );
  expect((await anonymous.request.get(`/tutors/${slug}`)).status()).toBe(404);
  await Promise.all([context.close(), tutorContext.close(), anonymous.close()]);
});
