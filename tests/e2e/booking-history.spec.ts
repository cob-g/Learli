import { randomUUID } from "node:crypto";
import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";

test.use({ trace: "off", screenshot: "off" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const baseURL = process.env.APP_URL!;
const password = "Synthetic-history-browser-passphrase-123";
async function account(
  browser: Browser,
  role: "parent" | "student" | "tutor" | "admin",
  javaScriptEnabled = true,
) {
  const context = await browser.newContext({ baseURL, javaScriptEnabled });
  const email = `history-${randomUUID()}@learli.test`;
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic history account" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query(
    'UPDATE "user" SET email_verified=true,timezone=$2 WHERE id=$1',
    [id, role === "tutor" ? "Asia/Manila" : "America/New_York"],
  );
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES ($1,$2)",
    [id, role],
  );
  expect(
    (
      await context.request.post("/api/auth/sign-in/email", {
        headers: { origin: baseURL },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  return { context, id, page: await context.newPage() };
}
async function fixture(
  browser: Browser,
  role: "parent" | "student" = "parent",
  javaScriptEnabled = true,
) {
  const actor = await account(browser, role, javaScriptEnabled);
  const assigned = await account(browser, "tutor");
  const learner = await owner.pool.query(
    "INSERT INTO learner_profiles(fixture_key,source,management,user_id,display_name,level,timezone) VALUES ($1,'local_fixture',$2,$3,$4,$5,'Pacific/Auckland') RETURNING id",
    [
      randomUUID(),
      role === "student" ? "self" : "guardian",
      role === "student" ? actor.id : null,
      "Synthetic Zoë With A Long Private Learner Label",
      role === "student" ? "college_support" : "elementary",
    ],
  );
  const learnerId = learner.rows[0].id as string;
  if (role === "parent")
    await owner.pool.query(
      "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES ($1,$2,'local_fixture','authorized')",
      [actor.id, learnerId],
    );
  const profile = await owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,'Synthetic tutoring','Synthetic profile only.','Synthetic test.','Asia/Manila','approved') RETURNING id",
    [assigned.id, `history-${randomUUID()}`],
  );
  await owner.pool.query('UPDATE "user" SET name=$2 WHERE id=$1', [
    assigned.id,
    "Synthetic María With A Long Tutor Display Name",
  ]);
  const profileId = profile.rows[0].id as string;
  const subject = await owner.pool.query(
    "SELECT id FROM subjects WHERE slug='math'",
  );
  const subjectId = subject.rows[0].id as string;
  let counter = 0;
  async function booking({
    expired = false,
    materialized = false,
    remainingMs = 600000,
  } = {}) {
    const id = randomUUID();
    const start =
      new Date("2026-11-01T05:30Z").getTime() + counter++ * 86400000;
    const created = new Date(
      Date.now() - (expired ? 1200000 : 600000 - remainingMs),
    );
    await owner.pool.query(
      "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES ($1,'local_simulation',$2,$3,$4,$5,$6,$7,'Pacific/Auckland',$8,$9,$10,$11,$12)",
      [
        id,
        profileId,
        learnerId,
        actor.id,
        subjectId,
        new Date(start),
        new Date(start + 3600000),
        randomUUID(),
        "a".repeat(64),
        materialized ? "demo_expired" : "demo_reserved",
        created,
        new Date(created.getTime() + 600000),
      ],
    );
    await owner.pool.query(
      "INSERT INTO booking_events(booking_id,event,created_at) VALUES ($1,'demo_reserved',$2)",
      [id, created],
    );
    if (materialized)
      await owner.pool.query(
        "INSERT INTO booking_events(booking_id,event,created_at) VALUES ($1,'demo_expired',clock_timestamp())",
        [id],
      );
    return id;
  }
  return {
    ...actor,
    assigned,
    learnerId,
    booking,
    scope: role === "parent" ? "guardian" : "student",
  };
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await fitsViewport(page);
}
async function fitsViewport(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function close(...contexts: BrowserContext[]) {
  for (const context of contexts) await context.close();
}
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(() => owner.pool.end());

test("guardian history/details are current, local, accessible and truthful at desktop and narrow widths", async ({
  browser,
}, info) => {
  const actor = await fixture(browser);
  const active = await actor.booking();
  const elapsed = await actor.booking({ expired: true });
  await actor.page.goto("/bookings?scope=guardian");
  await expect(
    actor.page.getByRole("heading", { name: "Your bookings", exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByText("Simulated reservation", { exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByText("Simulation expired", { exact: true }),
  ).toBeVisible();
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 720],
  ]) {
    await actor.page.setViewportSize({ width, height });
    await accessible(actor.page);
    await actor.page.screenshot({
      path: info.outputPath(`history-${width}.png`),
      fullPage: true,
    });
  }
  await actor.page.getByLabel("Booking view", { exact: true }).focus();
  await actor.page.keyboard.press("h");
  await actor.page
    .getByLabel("Booking view", { exact: true })
    .selectOption("history");
  await actor.page
    .getByRole("button", { name: "Apply booking view", exact: true })
    .focus();
  await actor.page.keyboard.press("Enter");
  await expect(
    actor.page.getByRole("heading", { name: "Your bookings", exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByText("Simulation expired", { exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByText("Simulated reservation", { exact: true }),
  ).toHaveCount(0);
  await actor.page.goBack();
  await expect(
    actor.page.getByLabel("Booking view", { exact: true }),
  ).toHaveValue("all");
  await expect(
    actor.page.getByText("Simulated reservation", { exact: true }),
  ).toBeVisible();
  await actor.page.goForward();
  await expect(
    actor.page.getByLabel("Booking view", { exact: true }),
  ).toHaveValue("history");
  await actor.page.goBack();
  await actor.page
    .getByLabel("Learner", { exact: true })
    .selectOption(actor.learnerId);
  await actor.page
    .getByLabel("Booking view", { exact: true })
    .selectOption("active");
  await actor.page
    .getByRole("button", { name: "Apply booking view", exact: true })
    .click();
  await expect(
    actor.page.getByRole("heading", {
      name: "Bookings for Synthetic Zoë With A Long Private Learner Label",
      exact: true,
    }),
  ).toBeVisible();
  await actor.page.goBack();
  await expect(actor.page.getByLabel("Learner", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    actor.page.getByLabel("Booking view", { exact: true }),
  ).toHaveValue("all");
  await actor.page.goForward();
  await expect(actor.page.getByLabel("Learner", { exact: true })).toHaveValue(
    actor.learnerId,
  );
  await expect(
    actor.page.getByLabel("Booking view", { exact: true }),
  ).toHaveValue("active");
  await actor.page.goto(`/bookings/${active}?scope=guardian`);
  await expect(actor.page).toHaveTitle("Booking details | Learli");
  await expect(
    actor.page.getByText(
      "Synthetic Zoë With A Long Private Learner Label · Elementary",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    actor.page.getByText("1:30 AM GMT-4 – 1:30 AM GMT-5", { exact: true }),
  ).toBeVisible();
  for (const width of [320, 1440]) {
    await actor.page.setViewportSize({
      width,
      height: width === 320 ? 720 : 900,
    });
    await accessible(actor.page);
    await actor.page.screenshot({
      path: info.outputPath(`detail-${width}.png`),
      fullPage: true,
    });
  }
  expect(await actor.page.title()).not.toContain("Zoë");
  await actor.page.goto(`/bookings/${elapsed}?scope=guardian`);
  await expect(
    actor.page.getByText("Simulation expired", { exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByRole("heading", {
      name: "Simulation expiry saved",
      exact: true,
    }),
  ).toHaveCount(0);
  await actor.page.screenshot({
    path: info.outputPath("detail-elapsed.png"),
    fullPage: true,
  });
  expect(
    (
      await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
        elapsed,
      ])
    ).rows[0].state,
  ).toBe("demo_reserved");
  await close(actor.context, actor.assigned.context);
});

test("own college learner and assigned tutor have separate current local views, with real saved history", async ({
  browser,
}) => {
  const actor = await fixture(browser, "student");
  const id = await actor.booking({ expired: true, materialized: true });
  for (const [page, scope] of [
    [actor.page, "student"],
    [actor.assigned.page, "tutor"],
  ] as const) {
    await page.goto(`/bookings/${id}?scope=${scope}`);
    await expect(
      page.getByRole("heading", { name: "Booking details", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Simulation expiry saved",
        exact: true,
      }),
    ).toBeVisible();
    await accessible(page);
  }
  await expect(
    actor.assigned.page.getByText("India", { exact: false }),
  ).toHaveCount(0);
  await expect(
    actor.assigned.page
      .getByText("Philippine Standard Time (GMT+8)", { exact: true })
      .first(),
  ).toBeVisible();
  const response = await actor.assigned.context.request.get(
    `/api/bookings/${id}?scope=tutor`,
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const serialized = JSON.stringify(await response.json());
  for (const key of [
    "Pacific/Auckland",
    "America/New_York",
    "requestFingerprint",
    "idempotencyKey",
    "bookedByUserId",
    "email",
    "token",
  ])
    expect(serialized.includes(key)).toBe(false);
  await close(actor.context, actor.assigned.context);
});

test("foreign admin/guardian/tutor, revoked link/session and anonymous reads reveal no private record", async ({
  browser,
}, info) => {
  const actor = await fixture(browser);
  const id = await actor.booking();
  const strangers = [
    await account(browser, "parent", false),
    await account(browser, "tutor", false),
    await account(browser, "admin"),
  ];
  for (const [index, stranger] of strangers.entries()) {
    const scope = index === 1 ? "tutor" : "guardian";
    await stranger.page.goto(`/bookings/${id}?scope=${scope}`);
    await expect(
      stranger.page.getByRole("heading", {
        name: "We can't find that booking on this account",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      stranger.page.getByText("Synthetic Zoë", { exact: false }),
    ).toHaveCount(0);
    expect(
      (
        await stranger.context.request.get(`/api/bookings/${id}?scope=${scope}`)
      ).status(),
    ).toBe(404);
  }
  await strangers[0].page.setViewportSize({ width: 320, height: 720 });
  await fitsViewport(strangers[0].page);
  await strangers[0].page.screenshot({
    path: info.outputPath("detail-unavailable-no-js-320.png"),
    fullPage: true,
  });
  await strangers[2].page.setViewportSize({ width: 320, height: 720 });
  await accessible(strangers[2].page);
  await strangers[2].page.screenshot({
    path: info.outputPath("detail-unavailable-320.png"),
    fullPage: true,
  });
  await owner.pool.query(
    "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1",
    [actor.id],
  );
  await actor.page.goto(`/bookings/${id}?scope=guardian`);
  await expect(
    actor.page.getByRole("heading", {
      name: "We can't find that booking on this account",
      exact: true,
    }),
  ).toBeVisible();
  const revoked = await actor.context.request.get(
    "/api/bookings?scope=guardian",
  );
  const result = await revoked.json();
  expect(result.items).toEqual([]);
  expect(result.learners).toEqual([]);
  await owner.pool.query('DELETE FROM "session" WHERE user_id=$1', [actor.id]);
  expect(
    (
      await actor.context.request.get(`/api/bookings/${id}?scope=guardian`)
    ).status(),
  ).toBe(401);
  const anonymous = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const page = await anonymous.newPage();
  await page.goto(`/bookings/${id}?scope=guardian`);
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  expect(
    (
      await anonymous.request.get(`/api/bookings/${id}?scope=guardian`)
    ).status(),
  ).toBe(401);
  await close(
    actor.context,
    actor.assigned.context,
    anonymous,
    ...strangers.map((stranger) => stranger.context),
  );
});

test("history filters, named learner and pagination work without JavaScript", async ({
  browser,
}, info) => {
  const actor = await fixture(browser, "parent", false);
  await actor.booking();
  await actor.booking({ expired: true });
  await actor.booking({ expired: true });
  await actor.page.goto("/bookings?scope=guardian&pageSize=1");
  await actor.page
    .getByRole("button", { name: "Apply booking view", exact: true })
    .click();
  await expect(
    actor.page.getByRole("heading", { name: "Your bookings", exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByRole("link", { name: "Next bookings", exact: true }),
  ).toBeVisible();
  await actor.page
    .getByRole("link", { name: "Next bookings", exact: true })
    .click();
  await expect(actor.page).toHaveURL(/page=2/);
  await actor.page
    .getByLabel("Learner", { exact: true })
    .selectOption(actor.learnerId);
  await actor.page
    .getByLabel("Booking view", { exact: true })
    .selectOption("active");
  await actor.page
    .getByRole("button", { name: "Apply booking view", exact: true })
    .click();
  await expect(
    actor.page.getByRole("heading", {
      name: "Bookings for Synthetic Zoë With A Long Private Learner Label",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    actor.page.getByText("Simulated reservation", { exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByText("Simulation expired", { exact: true }),
  ).toHaveCount(0);
  await actor.page.getByRole("link", { name: /View booking for/ }).click();
  await expect(
    actor.page.getByRole("heading", { name: "Booking details", exact: true }),
  ).toBeVisible();
  await actor.page.screenshot({
    path: info.outputPath("detail-no-js.png"),
    fullPage: true,
  });
  await actor.page.setViewportSize({ width: 320, height: 720 });
  await fitsViewport(actor.page);
  await actor.page.screenshot({
    path: info.outputPath("detail-no-js-320.png"),
    fullPage: true,
  });
  await close(actor.context, actor.assigned.context);
});

test("native GET and detail-link pending feedback retain content and stay accessible", async ({
  browser,
}, info) => {
  const actor = await fixture(browser);
  const id = await actor.booking();
  await actor.page.goto("/bookings?scope=guardian");
  await actor.page.setViewportSize({ width: 320, height: 720 });
  await actor.page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(actor.page.getByRole("dialog")).toBeVisible();
  await actor.page.keyboard.press("Escape");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await actor.page.route("**/bookings?**", async (route) => {
    await gate;
    await route.continue();
  });
  const submission = actor.page
    .getByRole("button", { name: "Apply booking view", exact: true })
    .click();
  await expect(actor.page.getByRole("status")).toHaveText(
    "Loading your bookings…",
  );
  for (const width of [320, 1440]) {
    await actor.page.setViewportSize({
      width,
      height: width === 320 ? 720 : 900,
    });
    await accessible(actor.page);
    await actor.page.screenshot({
      path: info.outputPath(`history-loading-${width}.png`),
      fullPage: true,
    });
  }
  release();
  await submission;
  await actor.page.unroute("**/bookings?**");
  await expect(actor.page.getByRole("status")).toHaveCount(0);
  await expect(
    actor.page.getByRole("heading", { name: "Your bookings", exact: true }),
  ).toBeVisible();
  let releaseDetail!: () => void;
  const detailGate = new Promise<void>((resolve) => {
    releaseDetail = resolve;
  });
  await actor.page.route("**/bookings/**", async (route) => {
    await detailGate;
    await route.continue();
  });
  const navigation = actor.page
    .getByRole("link", { name: /View booking for/ })
    .click();
  await expect(
    actor.page.getByText("Loading booking details…", { exact: true }),
  ).toBeVisible();
  for (const width of [320, 1440]) {
    await actor.page.setViewportSize({
      width,
      height: width === 320 ? 720 : 900,
    });
    await accessible(actor.page);
    await actor.page.screenshot({
      path: info.outputPath(`detail-loading-${width}.png`),
      fullPage: true,
    });
  }
  releaseDetail();
  await navigation;
  await expect(actor.page).toHaveURL(
    `${baseURL}/bookings/${id}?scope=guardian`,
  );
  await expect(
    actor.page.getByRole("heading", { name: "Booking details", exact: true }),
  ).toBeVisible();
  await close(actor.context, actor.assigned.context);
});

test("visible status becomes expired at its deadline without inventing an event; empty view stays honest", async ({
  browser,
}, info) => {
  const actor = await fixture(browser);
  await actor.page.goto("/bookings?scope=guardian");
  await expect(
    actor.page.getByRole("heading", {
      name: "No bookings in this view",
      exact: true,
    }),
  ).toBeVisible();
  await actor.page.setViewportSize({ width: 320, height: 720 });
  await accessible(actor.page);
  await actor.page.screenshot({
    path: info.outputPath("history-empty-320.png"),
    fullPage: true,
  });
  const id = await actor.booking({ remainingMs: 8000 });
  await actor.context.addInitScript(() => {
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + 86400000;
  });
  await actor.page.goto(`/bookings/${id}?scope=guardian`);
  await expect(
    actor.page.getByText("Simulated reservation", { exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByText("Simulation expired", { exact: true }),
  ).toBeVisible({ timeout: 12000 });
  await expect(
    actor.page.getByRole("heading", {
      name: "Simulation expiry saved",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    (
      await owner.pool.query(
        "SELECT count(*)::int AS count FROM booking_events WHERE booking_id=$1",
        [id],
      )
    ).rows[0].count,
  ).toBe(1);
  await close(actor.context, actor.assigned.context);
});
