import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import {
  localMailbox,
  type LocalMessage,
} from "../../src/lib/email/local-mail";
import { bookingSelectionHref } from "../../src/features/bookings/selection";
import { publicProfileHref } from "../../src/features/public-availability/links";

test.use({ trace: "off", screenshot: "off" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const baseURL = process.env.APP_URL!;
const password = "Synthetic-preview-passphrase-123";
const ownedProfileIds: string[] = [];
async function publicTutor(empty = false) {
  const userId = randomUUID(),
    slug = `profile-preview-${randomUUID()}`;
  await owner.pool.query(
    'INSERT INTO "user"(id,name,email,email_verified) VALUES ($1,$2,$3,true)',
    [userId, "Synthetic Profile Tutor", `preview-${userId}@learli.test`],
  );
  await owner.pool.query("INSERT INTO user_access(user_id) VALUES ($1)", [
    userId,
  ]);
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES ($1,'tutor')",
    [userId],
  );
  const profile = await owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,'Academic support','Synthetic public fixture.','Synthetic local fixture.','America/New_York','approved') RETURNING id",
    [userId, slug],
  );
  const id = profile.rows[0].id as string;
  ownedProfileIds.push(id);
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['elementary','college_support'] FROM subjects WHERE slug='math'",
    [id],
  );
  if (!empty)
    for (let day = 1; day <= 7; day++)
      await owner.pool.query(
        "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) VALUES ($1,$2,480,1200)",
        [id, day],
      );
  return { id, slug, userId };
}
async function linkedLearners(userId: string, count = 1) {
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES ($1,'parent') ON CONFLICT DO NOTHING",
    [userId],
  );
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const row = await owner.pool.query(
      "INSERT INTO learner_profiles(fixture_key,source,management,display_name,level,timezone) VALUES ($1,'local_fixture','guardian',$2,'elementary','Asia/Manila') RETURNING id",
      [randomUUID(), `Private synthetic continuation learner ${i}`],
    );
    ids.push(row.rows[0].id);
    await owner.pool.query(
      "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES ($1,$2,'local_fixture','authorized')",
      [userId, ids[i]],
    );
  }
  return ids;
}
async function actor(browser: Browser, learners = 1) {
  const context = await browser.newContext({ baseURL });
  const email = `preview-parent-${randomUUID()}@learli.test`;
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic continuation parent" },
  });
  expect(signup.status()).toBe(200);
  const userId = (await signup.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    userId,
  ]);
  const ids = await linkedLearners(userId, learners);
  return { context, email, userId, ids };
}
async function login(page: Page, email: string) {
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/bookings\/demo\?/);
}
async function preview(page: Page, slug: string) {
  await page.goto(
    publicProfileHref({
      tutorSlug: slug,
      subjectSlug: "math",
      level: "elementary",
      displayTimezone: "Asia/Manila",
    }),
  );
  await expect(
    page.getByRole("heading", { name: "Choose a time" }),
  ).toBeVisible();
  const radio = page.locator('input[name="time"]').first();
  await expect(radio).toBeVisible();
  const interval = (await radio.getAttribute("value"))!.split("|");
  return {
    tutorSlug: slug,
    subjectSlug: "math",
    level: "elementary" as const,
    displayTimezone: "Asia/Manila",
    startAtUtc: interval[0],
    endAtUtc: interval[1],
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
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function capturedVerification(email: string) {
  for (const file of (await readdir(localMailbox("test")))
    .filter((f) => f.endsWith(".json"))
    .reverse()) {
    const message = JSON.parse(
      await readFile(path.join(localMailbox("test"), file), "utf8"),
    ) as LocalMessage;
    if (message.to === email && message.kind === "verification")
      return message.url;
  }
  throw new Error("Expected local verification capture");
}
async function count(tutorId: string) {
  return (
    await owner.pool.query(
      "SELECT count(*)::int AS count FROM bookings WHERE tutor_id=$1",
      [tutorId],
    )
  ).rows[0].count as number;
}
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(async () => {
  try {
    if (ownedProfileIds.length)
      await owner.pool.query(
        "UPDATE tutor_profiles SET review_status='suspended' WHERE id=ANY($1::uuid[])",
        [ownedProfileIds],
      );
  } finally {
    await owner.pool.end();
  }
});

test("public actual dates are private, keyboard accessible, responsive and native without JavaScript", async ({
  browser,
}, info) => {
  const tutor = await publicTutor();
  const parent = await actor(browser);
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const choice = await preview(page, tutor.slug);
  const response = await context.request.get(
    `/api/tutors/${tutor.slug}/availability?${new URLSearchParams({ subjectSlug: "math", level: "elementary", displayTimezone: "Asia/Manila" })}`,
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.text(),
    html = await (await context.request.get(page.url())).text();
  const payload = JSON.parse(body) as {
    tutors: { times: { startAtUtc: string }[] }[];
  };
  const calendar = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const actualDays = [
    ...new Set(
      payload.tutors[0].times.map((time) =>
        calendar.format(new Date(time.startAtUtc)),
      ),
    ),
  ];
  expect(
    await page
      .locator('form[action="/bookings/demo"] > div > fieldset > legend')
      .allTextContents(),
  ).toEqual(actualDays.slice(0, 3));
  for (const value of [
    parent.userId,
    ...parent.ids,
    tutor.id,
    tutor.userId,
    parent.email,
    "Private synthetic continuation learner",
  ]) {
    expect(body.includes(value)).toBe(false);
    expect(html.includes(value)).toBe(false);
  }
  await page.locator('input[name="time"]').first().focus();
  await page.keyboard.press("Space");
  await expect(page.locator('input[name="time"]:checked')).toHaveCount(1);
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
    if (width === 320 || width === 1440)
      await page.screenshot({
        path: info.outputPath(`profile-preview-${width}.png`),
        fullPage: true,
      });
  }
  // A matching consumer can carry a later selected actual date into this picker.
  const laterInterval = (await page
    .locator('details input[name="time"]')
    .first()
    .getAttribute("value"))!.split("|");
  await page.goto(
    publicProfileHref({
      ...choice,
      startAtUtc: laterInterval[0],
      endAtUtc: laterInterval[1],
    }),
  );
  await expect(page.locator("details")).toHaveAttribute("open", "");
  await expect(page.locator('input[name="time"]:checked')).toHaveValue(
    laterInterval.join("|"),
  );
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 400 });
  await accessible(page);
  expect(await count(tutor.id)).toBe(0);
  const native = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const nativePage = await native.newPage();
  await preview(nativePage, tutor.slug);
  await nativePage.locator('input[name="time"]').first().check();
  await nativePage
    .getByRole("button", { name: "Review simulated booking" })
    .click();
  await expect(nativePage).toHaveURL(/\/sign-in\?next=/);
  expect(new URL(nativePage.url()).searchParams.get("next")).toBe(
    bookingSelectionHref(choice),
  );
  await expect(
    nativePage.getByRole("heading", {
      name: "Your simulated booking choice",
      exact: true,
    }),
  ).toBeVisible();
  expect(await count(tutor.id)).toBe(0);
  await Promise.all([native.close(), context.close(), parent.context.close()]);
});

test("sign-in preserves public selection, chooses owned learner after auth and requires explicit reserve", async ({
  browser,
}) => {
  const tutor = await publicTutor(),
    parent = await actor(browser);
  const page = await parent.context.newPage();
  const choice = await preview(page, tutor.slug);
  await page.locator('input[name="time"]').first().check();
  await page.getByRole("button", { name: "Review simulated booking" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await expect(
    page.getByRole("heading", {
      name: "Your simulated booking choice",
      exact: true,
    }),
  ).toBeVisible();
  await login(page, parent.email);
  expect(new URL(page.url()).searchParams.has("learnerId")).toBe(false);
  await expect(page.getByLabel("Tutor", { exact: true })).toHaveValue(
    tutor.slug,
  );
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("math");
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "Asia/Manila",
  );
  await expect(page.locator('input[name="time"]:checked')).toHaveValue(
    choice.startAtUtc,
  );
  expect(await count(tutor.id)).toBe(0);
  const accountZone = (
    await owner.pool.query('SELECT timezone FROM "user" WHERE id=$1', [
      parent.userId,
    ])
  ).rows[0].timezone as string;
  await page.goto(`/tutors/${tutor.slug}?subject=math&level=elementary`);
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    accountZone,
  );
  expect(new URL(page.url()).searchParams.has("displayTimezone")).toBe(false);
  await page.goto(
    bookingSelectionHref({ ...choice, level: "college_support" }),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "level differs" }),
  ).toBeVisible();
  await expect(page.locator('input[name="time"]:checked')).toHaveCount(0);
  expect(await count(tutor.id)).toBe(0);
  await page.goto(bookingSelectionHref(choice));
  await expect(page.locator('input[name="time"]:checked')).toHaveValue(
    choice.startAtUtc,
  );
  let releaseCandidates!: () => void;
  const candidatesPaused = new Promise<void>((resolve) => {
    releaseCandidates = resolve;
  });
  await page.route(
    "**/api/bookings/demo/candidates?**",
    async (route) => {
      await candidatesPaused;
      await route.continue();
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  try {
    await expect(
      page.getByRole("button", {
        name: "Create simulated reservation",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Loading open times…", exact: true }),
    ).toBeDisabled();
  } finally {
    releaseCandidates();
  }
  await expect(
    page.getByRole("button", {
      name: "Create simulated reservation",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(page.locator('input[name="time"]:checked')).toHaveValue(
    choice.startAtUtc,
  );
  await page
    .getByRole("button", { name: "Create simulated reservation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Simulated reservation saved" }),
  ).toBeVisible();
  expect(await count(tutor.id)).toBe(1);
  const row = await owner.pool.query(
    "SELECT learner_id,start_at_utc,source,state FROM bookings WHERE tutor_id=$1",
    [tutor.id],
  );
  expect(row.rows[0].learner_id === parent.ids[0]).toBe(true);
  expect(row.rows[0].start_at_utc.toISOString()).toBe(choice.startAtUtc);
  expect(row.rows[0].source).toBe("local_simulation");
  expect(row.rows[0].state).toBe("demo_reserved");
  await parent.context.close();
});

test("sign-up and resend verification retain selection without granting roles or booking automatically", async ({
  browser,
}) => {
  const tutor = await publicTutor();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const choice = await preview(page, tutor.slug);
  await page.goto(
    `/sign-in?next=${encodeURIComponent(bookingSelectionHref(choice))}`,
  );
  await page
    .getByRole("link", { name: "Create test account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Your simulated booking choice",
      exact: true,
    }),
  ).toBeVisible();
  const email = `verify-preview-${randomUUID()}@learli.test`;
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic verification parent");
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create test account", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "verification message" }),
  ).toBeVisible();
  const created = await owner.pool.query(
    'SELECT id FROM "user" WHERE email=$1',
    [email],
  );
  const id = created.rows[0].id as string;
  expect(
    (
      await owner.pool.query(
        "SELECT count(*)::int AS count FROM user_roles WHERE user_id=$1",
        [id],
      )
    ).rows[0].count,
  ).toBe(0);
  await page.goto(
    `/verify-email?next=${encodeURIComponent(bookingSelectionHref(choice))}`,
  );
  await expect(
    page.getByRole("heading", {
      name: "Your simulated booking choice",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Resend verification" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "message is available" }),
  ).toBeVisible();
  await page.goto(await capturedVerification(email));
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("next")).toBe(
    bookingSelectionHref(choice),
  );
  await linkedLearners(id, 2);
  await login(page, email);
  await expect(page.locator('input[name="learner"]:checked')).toHaveCount(0);
  await expect(page.locator('input[name="time"]:checked')).toHaveCount(0);
  expect(await count(tutor.id)).toBe(0);
  await page.locator('input[name="learner"]').first().check();
  await page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  await expect(page.locator('input[name="time"]:checked')).toHaveValue(
    choice.startAtUtc,
  );
  await page.goto("/sign-in?next=%2Fbookings%2Fdemo&next=%2Faccount");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  const repeatedHref = await page
    .getByRole("link", { name: "Create test account", exact: true })
    .getAttribute("href");
  expect(new URL(repeatedHref!, baseURL).searchParams.get("next")).toBe(
    "/account",
  );
  expect(await count(tutor.id)).toBe(0);
  await context.close();
});

test("stale resume and stale create show current alternatives without automatic reservation", async ({
  browser,
}) => {
  const tutor = await publicTutor(),
    parent = await actor(browser);
  const page = await parent.context.newPage();
  const choice = await preview(page, tutor.slug);
  await owner.pool.query(
    "INSERT INTO tutor_availability_exceptions(tutor_id,start_at_utc,end_at_utc) VALUES ($1,$2,$3)",
    [tutor.id, choice.startAtUtc, choice.endAtUtc],
  );
  await page.goto(
    `/sign-in?next=${encodeURIComponent(bookingSelectionHref(choice))}`,
  );
  await login(page, parent.email);
  await expect(
    page.getByRole("alert").filter({ hasText: "no longer available" }),
  ).toBeVisible();
  await expect(page.locator('input[name="time"]:checked')).toHaveCount(0);
  const alternative = page.locator('input[name="time"]').first();
  await expect(alternative).toBeVisible();
  await alternative.check();
  const start = (await alternative.getAttribute("value"))!;
  await owner.pool.query(
    "INSERT INTO tutor_availability_exceptions(tutor_id,start_at_utc,end_at_utc) VALUES ($1,$2,$3)",
    [tutor.id, start, new Date(new Date(start).getTime() + 3600000)],
  );
  await page
    .getByRole("button", { name: "Create simulated reservation", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "no longer available" }),
  ).toBeFocused();
  await expect(page.locator('input[name="time"]:checked')).toHaveCount(0);
  await expect(page.locator('input[name="time"]').first()).toBeVisible();
  expect(await count(tutor.id)).toBe(0);
  await parent.context.close();
});

test("empty and invalid offerings remain truthful and unsafe/private continuation is stripped", async ({
  browser,
}) => {
  const tutor = await publicTutor(true);
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto(
    publicProfileHref({
      tutorSlug: tutor.slug,
      subjectSlug: "math",
      level: "college_support",
      displayTimezone: "UTC",
    }),
  );
  await expect(
    page.getByRole("heading", { name: "No open times right now" }),
  ).toBeVisible();
  await page.getByLabel("Level", { exact: true }).selectOption("high_school");
  await page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "does not offer" }),
  ).toBeVisible();
  await expect(page.locator('input[name="time"]')).toHaveCount(0);
  await accessible(page);
  const forged = `/bookings/demo?learnerId=forged&next=https://evil.test`;
  await page.goto(`/sign-in?next=${encodeURIComponent(forged)}`);
  const href = await page
    .getByRole("link", { name: "Create test account", exact: true })
    .getAttribute("href");
  expect(new URL(href!, baseURL).searchParams.get("next")).toBe(
    "/bookings/demo",
  );
  await expect(
    page.getByRole("heading", {
      name: "Your simulated booking choice",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/sign-in?next=%2Fbookings%2Fdemo&next=%2Faccount");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  const repeatedHref = await page
    .getByRole("link", { name: "Create test account", exact: true })
    .getAttribute("href");
  expect(new URL(repeatedHref!, baseURL).searchParams.get("next")).toBe(
    "/account",
  );
  expect(await count(tutor.id)).toBe(0);
  await context.close();
});

test("browser visit zone, native pending feedback and unavailable preview stay honest", async ({
  browser,
}, info) => {
  const tutor = await publicTutor();
  const context = await browser.newContext({
    baseURL,
    timezoneId: "Pacific/Auckland",
  });
  const page = await context.newPage();
  await page.goto(`/tutors/${tutor.slug}?subject=math&level=elementary`);
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("displayTimezone") === "Pacific/Auckland",
  );
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "Pacific/Auckland",
  );
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Manila");
  let pendingView: {
    busy: boolean;
    status: boolean;
    disabled: boolean;
  } | null = null;
  await page.exposeFunction(
    "capturePreviewPending",
    (value: typeof pendingView) => {
      pendingView = value;
    },
  );
  await page.evaluate(() => {
    document.addEventListener("submit", (event) => {
      const form = event.target as HTMLFormElement;
      const report = (
        window as unknown as { capturePreviewPending: (value: unknown) => void }
      ).capturePreviewPending;
      report({
        busy: form.getAttribute("aria-busy") === "true",
        status:
          form.querySelector('[role="status"]')?.textContent ===
          "Loading open times",
        disabled:
          (form.querySelector("button") as HTMLButtonElement | null)
            ?.disabled === true,
      });
    });
  });
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/tutors/${tutor.slug}?**`,
    async (route) => {
      await paused;
      await route.continue();
    },
    { times: 1 },
  );
  const navigation = page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  try {
    await expect
      .poll(() => pendingView)
      .toEqual({ busy: true, status: true, disabled: true });
  } finally {
    release();
  }
  await navigation;
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "Asia/Manila",
  );
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Load open times", exact: true }),
  ).toBeEnabled();
  await page.goto(
    publicProfileHref({
      tutorSlug: tutor.slug,
      subjectSlug: "math",
      level: "elementary",
      displayTimezone: "Asia/Manila",
    }),
  );
  await page.goto(`/tutors/${tutor.slug}?subject=math&level=elementary`);
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "Asia/Manila",
  );
  await owner.pool.query(
    "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT $1,1,n,n+1 FROM generate_series(0,840) n",
    [tutor.id],
  );
  await page.goto(
    publicProfileHref({
      tutorSlug: tutor.slug,
      subjectSlug: "math",
      level: "elementary",
      displayTimezone: "Asia/Manila",
    }),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be loaded" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No open times right now" }),
  ).toHaveCount(0);
  await expect(page.locator('input[name="time"]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("profile-preview-unavailable-phone.png"),
    fullPage: true,
  });
  expect(await count(tutor.id)).toBe(0);
  await context.close();
});
