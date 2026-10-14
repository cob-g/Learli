import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";

test.use({ trace: "off", screenshot: "off" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const baseURL = process.env.APP_URL!;
const password = "Synthetic-tutor-dashboard-passphrase-123";

async function fixture(browser: Browser, javaScriptEnabled = true) {
  const context = await browser.newContext({ baseURL, javaScriptEnabled });
  const email = `tutor-dashboard-${randomUUID()}@learli.test`;
  const response = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic dashboard tutor" },
  });
  expect(response.status()).toBe(200);
  const userId = (await response.json()).user.id as string;
  await owner.pool.query(
    "UPDATE \"user\" SET email_verified=true, timezone='America/New_York' WHERE id=$1",
    [userId],
  );
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor')",
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
  const result = await owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic tutoring','Synthetic tutor biography','Synthetic background','Asia/Manila','approved') RETURNING id",
    [userId, `dashboard-${randomUUID()}`],
  );
  const tutorId = result.rows[0].id as string;
  // A separate fixture owner/learner, with no relationship to the tutor beyond the assigned bookings.
  const familyId = randomUUID();
  await owner.pool.query(
    "INSERT INTO \"user\"(id,name,email,email_verified) VALUES($1,'Synthetic guardian',$2,true)",
    [familyId, `family-${randomUUID()}@learli.test`],
  );
  await owner.pool.query("INSERT INTO user_access(user_id) VALUES($1)", [
    familyId,
  ]);
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'parent')",
    [familyId],
  );
  const learner = await owner.pool.query(
    "INSERT INTO learner_profiles(fixture_key,source,management,display_name,level,timezone) VALUES($1,'local_fixture','guardian',$2,'elementary','Asia/Manila') RETURNING id",
    [randomUUID(), "Synthetic Zoë Learner With A Long Display Name"],
  );
  const learnerId = learner.rows[0].id as string;
  await owner.pool.query(
    "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
    [familyId, learnerId],
  );
  const subject = await owner.pool.query(
    "SELECT id FROM subjects WHERE slug='math'",
  );
  const subjectId = subject.rows[0].id as string;
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES($1,$2,ARRAY['elementary'])",
    [tutorId, subjectId],
  );
  const page = await context.newPage();
  return { context, page, userId, tutorId, familyId, learnerId, subjectId };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function reservation(
  actor: Fixture,
  { expired = false, hours = 24, ttlSeconds = 600 } = {},
) {
  const id = randomUUID();
  await owner.pool.query(
    "WITH clock AS (SELECT clock_timestamp() AS now), times AS (SELECT now,date_bin('30 minutes',now,'2000-01-01'::timestamptz) AS start_base FROM clock), prepared AS (SELECT *,LEAST(now+(($10::int-600)::text||' seconds')::interval,start_base+($6::text||' hours')::interval-interval '60 minutes') AS created FROM times) INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) SELECT $1,'local_simulation',$2,$3,$4,$5,start_base+($6::text||' hours')::interval,start_base+(($6::int+1)::text||' hours')::interval,'Asia/Manila',$7,$8,$9,created,created+interval '600 seconds' FROM prepared",
    [
      id,
      actor.tutorId,
      actor.learnerId,
      actor.familyId,
      actor.subjectId,
      hours,
      randomUUID(),
      "a".repeat(64),
      expired ? "demo_expired" : "demo_reserved",
      expired ? -600 : ttlSeconds,
    ],
  );
  await owner.pool.query(
    "INSERT INTO booking_events(booking_id,event,created_at) SELECT id,'demo_reserved',created_at FROM bookings WHERE id=$1",
    [id],
  );
  if (expired)
    await owner.pool.query(
      "INSERT INTO booking_events(booking_id,event,created_at) SELECT id,'demo_expired',expires_at FROM bookings WHERE id=$1",
      [id],
    );
  return id;
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
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(() => owner.pool.end());

test("assigned tutor sees truthful next simulation, agenda/history and private accessible layout", async ({
  browser,
}, info) => {
  const actor = await fixture(browser);
  const next = await reservation(actor);
  await reservation(actor, { hours: 26 });
  await reservation(actor, { expired: true, hours: -24 });
  const unrelated = await fixture(browser);
  const foreignId = await reservation(unrelated);
  const response = await actor.page.goto("/tutor");
  expect(response?.headers()["cache-control"]).toMatch(/private|no-store/);
  await expect(actor.page).toHaveTitle("Your bookings | Learli");
  await expect(
    actor.page.getByRole("heading", { name: "Next future simulation" }),
  ).toBeVisible();
  await expect(
    actor.page.getByText("Simulation expired", { exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByText("This is a local simulation, not a confirmed lesson."),
  ).toBeVisible();
  await expect(
    actor.page.locator(`a[href="/bookings/${next}?scope=tutor"]`),
  ).toBeVisible();
  await expect(actor.page.locator(`a[href*="${foreignId}"]`)).toHaveCount(0);
  expect(await actor.page.locator("main").innerText()).not.toMatch(
    /Asia\/|America\/|@learli.test|Join on|Add meeting|Payment|Attendance/,
  );
  await expect(actor.page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  const metaSafe = await actor.page.evaluate(
    () =>
      !Array.from(document.head.querySelectorAll("title,meta")).some((node) =>
        node.outerHTML.includes("Synthetic Zoë"),
      ),
  );
  expect(metaSafe).toBe(true);
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ]) {
    await actor.page.setViewportSize({ width, height });
    await accessible(actor.page);
    if (width === 390 || width === 1440)
      await actor.page.screenshot({
        path: info.outputPath(`tutor-populated-${width}.png`),
        fullPage: true,
      });
  }
  await actor.page.setViewportSize({ width: 640, height: 400 });
  await actor.page.emulateMedia({
    reducedMotion: "reduce",
    forcedColors: "active",
  });
  await accessible(actor.page);
  await actor.page.screenshot({
    path: info.outputPath("tutor-forced-reflow.png"),
    fullPage: true,
  });
  // At this width the work areas sit behind the workspace menu.
  await actor.page.getByRole("button", { name: "Workspace menu" }).focus();
  await actor.page.keyboard.press("Enter");
  await actor.page.getByRole("link", { name: "Time off", exact: true }).focus();
  await actor.page.keyboard.press("Enter");
  await expect(actor.page).toHaveURL(/\/tutor\/time-off$/);
  await unrelated.context.close();
  await actor.context.close();
});

test("empty tutor dashboard and navigation work without JavaScript", async ({
  browser,
}, info) => {
  const actor = await fixture(browser, false);
  await actor.page.goto("/tutor");
  await expect(
    actor.page.getByRole("heading", { name: "No future simulations" }),
  ).toBeVisible();
  await actor.page.setViewportSize({ width: 390, height: 844 });
  expect(
    await actor.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // axe injects scripts. Audit the same authenticated empty state in a settled
  // JS-enabled context, while this context keeps native no-script assertions.
  const audit = await browser.newContext({
    baseURL,
    storageState: await actor.context.storageState(),
    viewport: { width: 390, height: 844 },
  });
  const auditPage = await audit.newPage();
  await auditPage.goto("/tutor");
  await expect(
    auditPage.getByRole("heading", { name: "No future simulations" }),
  ).toBeVisible();
  await accessible(auditPage);
  await audit.close();
  await actor.page.screenshot({
    path: info.outputPath("tutor-empty-phone.png"),
    fullPage: true,
  });
  await actor.page
    .getByRole("link", { name: "Set availability", exact: true })
    .focus();
  await actor.page.keyboard.press("Enter");
  await expect(actor.page).toHaveURL(/\/tutor\/availability$/);
  await actor.page.goto("/tutor");
  await actor.page.getByRole("button", { name: "Refresh bookings" }).click();
  await expect(
    actor.page.getByRole("heading", { name: "No future simulations" }),
  ).toBeVisible();
  await reservation(actor);
  await actor.page.getByRole("button", { name: "Refresh bookings" }).click();
  await expect(
    actor.page.getByRole("heading", { name: "Next future simulation" }),
  ).toBeVisible();
  await actor.page
    .getByRole("link", {
      name: "View booking for Synthetic Zoë Learner With A Long Display Name",
      exact: true,
    })
    .click();
  await expect(
    actor.page.getByRole("heading", { name: "Booking details" }),
  ).toBeVisible();
  await expect(
    actor.page
      .locator("dd")
      .filter({ hasText: "Synthetic Zoë Learner With A Long Display Name" }),
  ).toBeVisible();
  await actor.page.goto("/tutor");
  await actor.page
    .getByRole("link", { name: "Availability", exact: true })
    .focus();
  await actor.page.keyboard.press("Enter");
  await expect(actor.page).toHaveURL(/\/tutor\/availability$/);
  await actor.context.close();
});

test("effective TTL expires on refresh without making a confirmed or attended lesson", async ({
  browser,
}) => {
  const actor = await fixture(browser);
  await reservation(actor, { ttlSeconds: 4 });
  await actor.page.goto("/tutor");
  await expect(
    actor.page.getByRole("heading", { name: "Next future simulation" }),
  ).toBeVisible();
  await expect
    .poll(
      async () => {
        await actor.page.reload();
        return actor.page
          .getByText("Simulation expired", { exact: true })
          .count();
      },
      { timeout: 15_000 },
    )
    .toBe(1);
  await expect(
    actor.page.getByRole("heading", { name: "No future simulations" }),
  ).toBeVisible();
  expect(await actor.page.locator("main").innerText()).not.toMatch(
    /paid|attended|completed/i,
  );
  await actor.context.close();
});

test("current role, verification, account/profile suspension and revoked session deny private content", async ({
  browser,
}, info) => {
  for (const refusal of [
    "role",
    "verification",
    "account",
    "profile",
    "session",
    "expired_session",
  ] as const) {
    const actor = await fixture(browser);
    await reservation(actor);
    if (refusal === "role")
      await owner.pool.query(
        "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
        [actor.userId],
      );
    if (refusal === "verification")
      await owner.pool.query(
        'UPDATE "user" SET email_verified=false WHERE id=$1',
        [actor.userId],
      );
    if (refusal === "account")
      await owner.pool.query(
        "UPDATE user_access SET status='suspended' WHERE user_id=$1",
        [actor.userId],
      );
    if (refusal === "profile")
      await owner.pool.query(
        "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
        [actor.tutorId],
      );
    if (refusal === "session")
      await owner.pool.query('DELETE FROM "session" WHERE user_id=$1', [
        actor.userId,
      ]);
    if (refusal === "expired_session")
      await owner.pool.query(
        "UPDATE \"session\" SET expires_at=now()-interval '1 second' WHERE user_id=$1",
        [actor.userId],
      );
    await actor.page.goto("/tutor");
    if (refusal === "session" || refusal === "expired_session")
      await expect(actor.page).toHaveURL(/\/sign-in\?next=%2Ftutor$/);
    else
      await expect(
        actor.page.getByRole("heading", {
          name: "Workspace access unavailable",
        }),
      ).toBeVisible();
    await expect(
      actor.page.getByText("Synthetic Zoë Learner With A Long Display Name", {
        exact: true,
      }),
    ).toHaveCount(0);
    if (refusal === "profile") {
      await actor.page.setViewportSize({ width: 390, height: 844 });
      await accessible(actor.page);
      await actor.page.screenshot({
        path: info.outputPath("tutor-denied-phone.png"),
        fullPage: true,
      });
    }
    await actor.context.close();
  }
});

test("refresh loading is announced while a real private read waits and clears when it completes", async ({
  browser,
}, info) => {
  const actor = await fixture(browser);
  await reservation(actor);
  await actor.page.goto("/tutor");
  await expect(
    actor.page.getByRole("heading", { name: "Next future simulation" }),
  ).toBeVisible();
  const lock = await owner.pool.connect();
  try {
    await lock.query("BEGIN");
    await lock.query("LOCK TABLE bookings IN ACCESS EXCLUSIVE MODE");
    await actor.page.getByRole("button", { name: "Refresh bookings" }).click();
    await expect(actor.page.getByRole("status")).toHaveText(
      "Loading your assigned bookings…",
    );
    await actor.page.screenshot({
      path: info.outputPath("tutor-loading.png"),
      fullPage: true,
    });
    await lock.query("COMMIT");
    await expect(actor.page.getByRole("status")).toHaveCount(0);
    await expect(
      actor.page.getByRole("heading", { name: "Next future simulation" }),
    ).toBeVisible();
    await actor.page
      .getByRole("link", {
        name: "View booking for Synthetic Zoë Learner With A Long Display Name",
        exact: true,
      })
      .click();
    await expect(actor.page).toHaveURL(/\/bookings\/[a-f0-9-]+\?scope=tutor$/);
  } finally {
    await lock.query("ROLLBACK");
    lock.release();
    await actor.context.close();
  }
});

test("a real booking read failure shows safe recovery and reveals no learner context", async ({
  browser,
}, info) => {
  const actor = await fixture(browser);
  await reservation(actor);
  try {
    await owner.pool.query("REVOKE SELECT ON bookings FROM learli_app");
    await actor.page.goto("/tutor");
    await expect(
      actor.page.getByRole("heading", { name: "Workspace access unavailable" }),
    ).toBeVisible();
    await expect(
      actor.page.getByText("Synthetic Zoë Learner With A Long Display Name", {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      actor.page.getByRole("link", { name: "Try again", exact: true }),
    ).toBeVisible();
    await actor.page.setViewportSize({ width: 390, height: 844 });
    await accessible(actor.page);
    await actor.page.screenshot({
      path: info.outputPath("tutor-error-phone.png"),
      fullPage: true,
    });
  } finally {
    await owner.pool.query("GRANT SELECT ON bookings TO learli_app");
  }
  await actor.page
    .getByRole("link", { name: "Try again", exact: true })
    .click();
  await expect(
    actor.page.getByRole("heading", { name: "Next future simulation" }),
  ).toBeVisible();
  await actor.context.close();
});

test("bounded tutor history opens assigned provider pages with native filters, pending and Back restoration", async ({
  browser,
}, info) => {
  const actor = await fixture(browser);
  await reservation(actor);
  for (let index = 0; index < 21; index++)
    await reservation(actor, { expired: true, hours: -24 - index * 2 });
  const invariants = await owner.pool.query(
    "SELECT bool_and(start_at_utc>=created_at+interval '60 minutes' AND start_at_utc<=created_at+interval '14 days' AND end_at_utc=start_at_utc+interval '60 minutes' AND expires_at=created_at+interval '600 seconds' AND date_bin('30 minutes',start_at_utc,'2000-01-01'::timestamptz)=start_at_utc) AS valid FROM bookings WHERE tutor_id=$1",
    [actor.tutorId],
  );
  expect(invariants.rows[0].valid).toBe(true);
  await actor.page.goto("/tutor");
  await expect(
    actor.page
      .getByRole("region", { name: "Simulation history" })
      .getByRole("link", { name: /View booking for/ }),
  ).toHaveCount(20);
  await actor.page
    .getByRole("link", { name: "View all simulation history", exact: true })
    .focus();
  await actor.page.keyboard.press("Enter");
  await expect(actor.page).toHaveURL(/scope=tutor&filter=history$/);
  await expect(actor.page.getByLabel("Booking view")).toHaveValue("history");
  await actor.page.getByLabel("Booking view").selectOption("all");
  const lock = await owner.pool.connect();
  try {
    await lock.query("BEGIN");
    await lock.query("LOCK TABLE bookings IN ACCESS EXCLUSIVE MODE");
    await actor.page
      .getByRole("button", { name: "Apply booking view" })
      .click();
    await expect(actor.page.getByRole("status")).toHaveText(
      "Loading your bookings…",
    );
    await actor.page.screenshot({
      path: info.outputPath("tutor-history-pending.png"),
    });
    await lock.query("COMMIT");
    await expect(actor.page.getByRole("status")).toHaveCount(0);
    await expect(actor.page).toHaveURL(/filter=all/);
    await expect(actor.page.getByLabel("Booking view")).toHaveValue("all");
  } finally {
    await lock.query("ROLLBACK");
    lock.release();
  }
  await actor.page.goBack();
  await expect(actor.page).toHaveURL(/filter=history/);
  await expect(actor.page.getByLabel("Booking view")).toHaveValue("history");
  await actor.page
    .getByRole("link", { name: "Next bookings", exact: true })
    .focus();
  await actor.page.keyboard.press("Enter");
  await expect(actor.page).toHaveURL(/page=2/);
  await expect(
    actor.page.getByRole("link", { name: /View booking for/ }),
  ).toHaveCount(1);
  await actor.page.setViewportSize({ width: 390, height: 844 });
  await accessible(actor.page);
  await actor.page.screenshot({
    path: info.outputPath("tutor-history-phone.png"),
    fullPage: true,
  });
  const native = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    storageState: await actor.context.storageState(),
  });
  const nativePage = await native.newPage();
  await nativePage.goto("/tutor");
  await nativePage
    .getByRole("link", { name: "View all simulation history", exact: true })
    .click();
  await expect(nativePage.getByLabel("Booking view")).toHaveValue("history");
  await nativePage.getByLabel("Booking view").selectOption("active");
  await nativePage.getByRole("button", { name: "Apply booking view" }).click();
  await expect(nativePage).toHaveURL(/filter=active/);
  await expect(
    nativePage.getByRole("link", { name: /View booking for/ }),
  ).toHaveCount(1);
  await native.close();
  await actor.context.close();
});
