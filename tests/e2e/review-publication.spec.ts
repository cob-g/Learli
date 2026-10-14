import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID, createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { createDatabase } from "../../src/lib/db/connection";
import {
  assertOwnedReadinessDatabase,
  screeningMirrorOrigin,
} from "../support/readiness-placement";
import { restoreW6BrowserTutor } from "../support/w6-browser-fixtures";
import { totpCode } from "../support/admin-mfa";
import {
  validatePublicationCapability,
  type EnabledPublicationPolicy,
} from "../../src/features/review-publication/policy";
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "serial" });
test.setTimeout(180000);
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true),
  contexts: BrowserContext[] = [];
const account = z.object({ id: z.string(), email: z.email() });
const workflowFixture = z.object({
  parent: account.extend({ learnerId: z.uuid(), learnerName: z.string() }),
  tutor: account.extend({ profileId: z.uuid(), slug: z.string() }),
  reviewer: account,
  password: z.string(),
  booking: z.object({ policyId: z.uuid(), admissionPolicyId: z.uuid() }),
  origin: z.string(),
  sourceRoot: z.string(),
});
let fixture: z.infer<typeof workflowFixture>,
  publication: EnabledPublicationPolicy,
  moderator: z.infer<typeof account>,
  staff: Page,
  staffContext: BrowserContext,
  parent: Page,
  parentContext: BrowserContext,
  secret: string;
async function login(browser: Browser, email: string, secondFactor?: string) {
  // Late in a full run every page's session check has accumulated on the one
  // loopback address, so reset /get-session too or the shell cannot load roles.
  await owner.pool.query(
    "UPDATE rate_limit SET count=0 WHERE key LIKE '%/sign-in/email%' OR key LIKE '%/two-factor/%' OR key LIKE '%/get-session%'",
  );
  const context = await browser.newContext({ baseURL: screeningMirrorOrigin }),
    page = await context.newPage();
  contexts.push(context);
  await page.goto("/sign-in");
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (secondFactor) {
    await expect(page).toHaveURL(
      screeningMirrorOrigin + "/two-factor?next=%2Faccount",
    );
    await page
      .getByLabel("Authenticator code", { exact: true })
      .fill(totpCode(secondFactor));
    await page
      .getByRole("button", { name: "Verify administrator access", exact: true })
      .click();
  }
  await expect(page).toHaveURL(screeningMirrorOrigin + "/account");
  return { context, page };
}
test.beforeAll(async ({ browser }) => {
  assertOwnedReadinessDatabase(process.cwd());
  fixture = workflowFixture.parse(
    JSON.parse(
      await readFile(".local/booking-workflows/browser-fixture.json", "utf8"),
    ),
  );
  const data = z
    .object({
      publication: z.unknown(),
      reviewer: account,
      password: z.string(),
      origin: z.string(),
      sourceRoot: z.string(),
    })
    .parse(
      JSON.parse(
        await readFile(
          ".local/review-publication/browser-fixture.json",
          "utf8",
        ),
      ),
    );
  expect(fixture.sourceRoot).toBe(process.cwd());
  expect(data.sourceRoot).toBe(process.cwd());
  expect(fixture.origin).toBe(screeningMirrorOrigin);
  expect(data.origin).toBe(screeningMirrorOrigin);
  expect(data.password).toBe(fixture.password);
  const policy = validatePublicationCapability(data.publication, "test");
  if (policy.authority === "disabled")
    throw new Error("Own publication capability required");
  publication = policy;
  moderator = data.reviewer;
  const factorsPath = ".local/review-publication/browser-authenticators.json";
  let factors: Record<string, string> = {};
  try {
    factors = z
      .record(z.string(), z.string().min(1))
      .parse(JSON.parse(await readFile(factorsPath, "utf8")));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  secret = factors[moderator.id];
  const admin = await login(browser, moderator.email, secret);
  staff = admin.page;
  staffContext = admin.context;
  await staff.goto("/account/security");
  if (!secret) {
    await staff
      .getByLabel("Current password", { exact: true })
      .fill(fixture.password);
    await staff.getByRole("button", { name: "Set up authenticator" }).click();
    await expect(staff.locator("[data-mfa-secret]").first()).toBeVisible();
    secret =
      (await staff.locator("[data-mfa-secret]").first().textContent()) ?? "";
    await staff
      .getByLabel("Authenticator code", { exact: true })
      .fill(totpCode(secret));
    await staff
      .getByRole("button", { name: "Verify administrator access" })
      .click();
    factors[moderator.id] = secret;
    await writeFile(factorsPath, JSON.stringify(factors), { mode: 0o600 });
  }
  await expect(
    staff.getByText("Administrator verification is current.", { exact: false }),
  ).toBeVisible();
  const tutor = await login(browser, fixture.tutor.email);
  await restoreW6BrowserTutor(owner, tutor.context, staffContext, {
    ...fixture,
    reviewer: moderator,
  });
  const earlier = await owner.pool.query<{ start: Date | null }>(
    "SELECT min(start_at_utc) AS start FROM bookings WHERE tutor_id=$1 AND start_at_utc < clock_timestamp()",
    [fixture.tutor.profileId],
  );
  historicalBase = Math.min(
    Date.now(),
    earlier.rows[0].start?.getTime() ?? Date.now(),
  );
  const family = await login(browser, fixture.parent.email);
  parent = family.page;
  parentContext = family.context;
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
  await owner.pool.end();
});
async function accessible(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
    })),
  ).toEqual([]);
}
let historicalIndex = 0,
  historicalBase = Date.now();
async function historicalConfirmed(complete = true) {
  const id = randomUUID(),
    key = randomUUID(),
    subject = (
      await owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
    ).rows[0].id,
    start = new Date(historicalBase - (++historicalIndex + 2) * 7200000),
    end = new Date(start.getTime() + 3600000),
    created = new Date(start.getTime() - 7200000),
    expires = new Date(created.getTime() + 600000),
    client = await owner.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id) VALUES($1,'synthetic_readiness',$2,$3,$4,$5,$6,$7,'UTC',$8,$9,'confirmed',$10,$11,$12,$13)",
      [
        id,
        fixture.tutor.profileId,
        fixture.parent.learnerId,
        fixture.parent.id,
        subject,
        start,
        end,
        key,
        "c".repeat(64),
        created,
        expires,
        fixture.booking.policyId,
        fixture.booking.admissionPolicyId,
      ],
    );
    await client.query(
      "INSERT INTO booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES($1,$1,$2,'workflow_confirmed',$3,$4,$5,$6,0,'synthetic_prerequisite_review')",
      [
        id,
        moderator.id,
        key,
        "c".repeat(64),
        created,
        fixture.booking.policyId,
      ],
    );
    await client.query("COMMIT");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  await owner.pool.query(
    "INSERT INTO booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference) VALUES($1,$2,'complete',true,clock_timestamp()+interval '2 hours',$3)",
    [id, moderator.id, `synthetic:${randomUUID()}`],
  );
  if (!complete) return id;
  await staff.goto("/admin/bookings/" + id);
  await staff
    .getByRole("button", {
      name: "Record administrative completion",
      exact: true,
    })
    .click();
  await expect(
    staff.getByText(
      /administrative software testing, never attendance evidence/,
    ),
  ).toContainText("administrative completion");
  return id;
}
async function authorSubmit(
  id: string,
  comment: string,
  networkStates = false,
) {
  await parent.goto(`/bookings/${id}?scope=guardian`);
  await parent
    .getByRole("link", {
      name: "Add synthetic publication review",
      exact: true,
    })
    .click();
  await expect(parent.getByRole("heading", { level: 1 })).toHaveText(
    "Synthetic publication review",
  );
  await expect(parent.getByLabel("Rating from 1 to 5")).toBeEnabled();
  await parent.getByLabel("Rating from 1 to 5").selectOption("4");
  await parent.getByLabel(/Comment/).fill(comment);
  const path = `**/api/bookings/${id}/publication-review`,
    payloads: string[] = [];
  let release = () => {};
  if (networkStates) {
    const gate = new Promise<void>((r) => {
      release = r;
    });
    await parent.route(path, async (route) => {
      payloads.push(route.request().postData() ?? "");
      if (payloads.length === 1) await route.abort("failed");
      else {
        await gate;
        await route.continue();
      }
    });
  }
  await parent
    .getByRole("button", { name: "Save synthetic review", exact: true })
    .focus();
  await parent.keyboard.press("Enter");
  if (networkStates) {
    const alert = parent
      .getByRole("alert")
      .filter({ hasText: "The result is uncertain" });
    await expect(alert).toContainText("The result is uncertain");
    await expect(alert).toBeFocused();
    await parent
      .getByRole("button", { name: "Save synthetic review", exact: true })
      .focus();
    await parent.keyboard.press("Enter");
    try {
      await expect.poll(() => payloads.length).toBe(2);
      await expect(parent.locator("form[aria-busy=true]")).toBeVisible();
      await expect(
        parent.getByRole("button", {
          name: "Saving review…",
          exact: true,
        }),
      ).toBeDisabled();
    } finally {
      release();
    }
    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toBe(payloads[1]);
  }
  await expect(
    parent.getByRole("heading", { name: "Saved review", exact: true }),
  ).toBeVisible();
  if (networkStates) await parent.unroute(path);
  const r = await owner.pool.query(
    "SELECT id FROM publication_reviews WHERE booking_id=$1",
    [id],
  );
  if (!r.rows[0]) throw new Error("Actual saved review required");
  await owner.pool.query(
    "INSERT INTO publication_moderator_grants(review_id,moderator_user_id,policy_id,active,valid_until,reference) VALUES($1,$2,$3,true,clock_timestamp()+interval '2 hours',$4)",
    [
      r.rows[0].id,
      moderator.id,
      publication.policyId,
      `synthetic:${randomUUID()}`,
    ],
  );
  return r.rows[0].id as string;
}
async function moderate(id: string, state: string, privacy: boolean) {
  await staff.goto("/admin/publication-reviews/" + id);
  await staff.getByLabel("Next review state").selectOption(state);
  if (privacy) await staff.getByRole("checkbox").check();
  await staff
    .getByRole("button", { name: "Save moderation decision", exact: true })
    .focus();
  await staff.keyboard.press("Enter");
  await expect(
    staff.getByRole("heading", { name: "Saved review", exact: true }),
  ).toBeVisible();
  await expect(staff.getByLabel("Next review state")).not.toHaveValue(state);
}
for (const [label, width, height] of [
  ["narrow", 320, 720],
  ["phone", 390, 844],
  ["desktop", 1440, 900],
] as const) {
  test(`${label} actual submit/manual moderation/anonymous profile/withdraw and privacy`, async ({
    browser,
  }, info) => {
    await parent.setViewportSize({ width, height });
    await staff.setViewportSize({ width, height });
    const id = await historicalConfirmed(),
      comment = `Fictional ${label} feedback <img src=x onerror=window.publicationXss=1>`;
    const reviewId = await authorSubmit(id, comment, label === "narrow");
    await accessible(parent);
    await parent
      .getByRole("link", { name: "Return to booking details" })
      .focus();
    await expect(
      parent.getByRole("link", { name: "Return to booking details" }),
    ).toBeFocused();
    await moderate(reviewId, "approved", true);
    const stale = await staffContext.request.patch(
      `/api/admin/publication-reviews/${reviewId}`,
      {
        headers: { origin: screeningMirrorOrigin },
        data: {
          requestId: randomUUID(),
          expectedRevision: 0,
          state: "published",
          privacyChecked: true,
        },
      },
    );
    expect(stale.status()).toBe(409);
    expect(stale.headers()["cache-control"]).toContain("no-store");
    const staleBody = await stale.text();
    for (const needle of [id, reviewId, fixture.parent.learnerId, secret])
      expect(staleBody.includes(needle), "Stale response is minimal").toBe(
        false,
      );
    await moderate(reviewId, "published", true);
    await accessible(staff);
    const visitor = await browser.newContext({
      baseURL: screeningMirrorOrigin,
      viewport: { width, height },
    });
    contexts.push(visitor);
    const page = await visitor.newPage();
    await page.goto("/tutors/" + fixture.tutor.slug);
    const reviews = page.locator(
      "section[aria-labelledby=published-reviews-title]",
    );
    await expect(
      reviews.getByText("1 review · Average 4 out of 5", { exact: true }),
    ).toBeVisible();
    await expect(reviews.getByText("Customer", { exact: true })).toBeVisible();
    await expect(reviews.getByText(comment, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Load open times", exact: true }),
    ).toHaveCount(0);
    const handoff = page.getByRole("link", {
      name: "Review synthetic booking options",
      exact: true,
    });
    const handoffHref = await handoff.getAttribute("href");
    expect(handoffHref).toBe(
      `/bookings/demo?tutorSlug=${fixture.tutor.slug}&subjectSlug=math`,
    );
    expect(await page.evaluate(() => "publicationXss" in window)).toBe(false);
    await accessible(page);
    const body = await page.content();
    for (const needle of [
      id,
      reviewId,
      fixture.parent.id,
      fixture.parent.learnerId,
      fixture.parent.learnerName,
      fixture.parent.email,
      fixture.tutor.id,
      fixture.tutor.profileId,
      moderator.id,
      publication.policyId,
      secret,
      "https://meet.google.com/",
    ])
      expect(body.includes(needle), "Private fixture needle absent").toBe(
        false,
      );
    await mkdir(".local/review-publication/screens", {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(
      `.local/review-publication/public-${info.project.name}-${width}.html`,
      body,
      { mode: 0o600 },
    );
    await page.screenshot({
      path: `.local/review-publication/screens/public-${info.project.name}-${width}.png`,
      fullPage: true,
    });
    await staff.screenshot({
      path: `.local/review-publication/screens/moderator-${info.project.name}-${width}.png`,
      fullPage: true,
    });
    await parent.goto("/tutors/" + fixture.tutor.slug);
    await parent
      .getByRole("link", {
        name: "Review synthetic booking options",
        exact: true,
      })
      .focus();
    await parent.keyboard.press("Enter");
    await expect(
      parent.getByRole("heading", {
        name: "Synthetic booking request",
        exact: true,
      }),
    ).toBeVisible();
    await expect(parent.getByLabel("Tutor", { exact: true })).toHaveValue(
      fixture.tutor.slug,
    );
    await expect(parent.getByLabel("Subject", { exact: true })).toHaveValue(
      "math",
    );
    await parent
      .getByLabel("Learner", { exact: true })
      .selectOption(fixture.parent.learnerId);
    await parent
      .getByRole("button", { name: "Load synthetic times", exact: true })
      .focus();
    await parent.keyboard.press("Enter");
    await expect(
      parent.getByRole("button", {
        name: "Request synthetic booking",
        exact: true,
      }),
    ).toBeEnabled();
    await moderate(reviewId, "withdrawn", false);
    await page.reload();
    await expect(
      reviews.getByText("No reviews yet", { exact: true }),
    ).toBeVisible();
    await expect(reviews.getByText(comment, { exact: true })).toHaveCount(0);
    await expect(reviews.getByText(/Average/)).toHaveCount(0);
    const anonymous = await visitor.request.post(
      `/api/bookings/${id}/publication-review`,
      {
        headers: { origin: screeningMirrorOrigin },
        data: {
          requestId: randomUUID(),
          bookingRevision: 1,
          completionEventId: randomUUID(),
          rating: 4,
          comment: "Fictional",
        },
      },
    );
    expect(anonymous.status()).toBe(401);
    await writeFile(
      `.local/review-publication/public-${info.project.name}-${width}-observation.json`,
      JSON.stringify({
        viewport: { width, height },
        publicHtmlSha256: createHash("sha256").update(body).digest("hex"),
        privateNeedleHits: 0,
        anonymousSubmissionStatus: anonymous.status(),
        staleDecisionStatus: stale.status(),
        publishedThenWithdrawn: true,
      }),
      { mode: 0o600 },
    );
  });
}
test("foreign actor/noncompleted/default-disabled and no-JS/private document lifetime", async ({
  browser,
}) => {
  const id = await historicalConfirmed(),
    reviewId = await authorSubmit(id, "Fictional private lifetime review");
  const noncompleted = await historicalConfirmed(false);
  expect(
    (
      await parentContext.request.get(
        `/api/bookings/${noncompleted}/publication-review`,
      )
    ).status(),
  ).toBe(404);
  const unsaved = await historicalConfirmed();
  const visitor = await browser.newContext({
    baseURL: screeningMirrorOrigin,
    javaScriptEnabled: false,
  });
  contexts.push(visitor);
  const p = await visitor.newPage();
  const wrong = await visitor.request.get(
    `/api/admin/publication-reviews/${reviewId}`,
  );
  expect([401, 403]).toContain(wrong.status());
  const tutor = await login(browser, fixture.tutor.email);
  const denied = await tutor.context.request.get(
    `/api/bookings/${id}/publication-review`,
  );
  expect(denied.status()).toBe(404);
  await parent.goto(`/bookings/${id}/publication-review?scope=guardian`);
  const api = await parentContext.request.get(
    `/api/bookings/${id}/publication-review`,
  );
  expect(api.headers()["cache-control"]).toContain("no-store");
  const nojs = await browser.newContext({
    baseURL: screeningMirrorOrigin,
    javaScriptEnabled: false,
  });
  contexts.push(nojs);
  await nojs.addCookies(await parentContext.cookies());
  const native = await nojs.newPage();
  await native.goto(`/bookings/${id}/publication-review?scope=guardian`);
  await expect(
    native.getByText("Fictional private lifetime review", { exact: true }),
  ).toBeVisible();
  await native.goto(`/bookings/${unsaved}/publication-review?scope=guardian`);
  await expect(native.getByLabel("Rating from 1 to 5")).toBeDisabled();
  await expect(
    native.getByText(/Enable JavaScript to save a synthetic review/),
  ).toBeVisible();
  const plainPost = await nojs.request.post(
    `/api/bookings/${unsaved}/publication-review`,
    {
      headers: {
        origin: screeningMirrorOrigin,
        "content-type": "application/x-www-form-urlencoded",
      },
      data: "comment=Fictional+private+text",
    },
  );
  expect(plainPost.status()).toBe(400);
  expect(new URL(native.url()).searchParams.has("comment")).toBe(false);
  await parent.goto("/sign-in");
  await expect(parent.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    (await parent.content()).includes("Fictional private lifetime review"),
  ).toBe(false);
  await parent.goBack({ waitUntil: "commit", timeout: 15000 });
  await expect(parent.getByRole("heading", { level: 1 })).toBeVisible();
  await parent.goto(`/bookings/${id}/publication-review?scope=guardian`);
  await parent
    .getByRole("link", { name: "Find a tutor", exact: true })
    .first()
    .click();
  await expect(parent).toHaveURL(screeningMirrorOrigin + "/tutors");
  await expect(parent.getByRole("heading", { level: 1 })).toBeVisible();
  await parent.goto("/account");
  await parent.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(parent).toHaveURL(/\/sign-in/);
  expect(
    (await parent.content()).includes("Fictional private lifetime review"),
  ).toBe(false);
  await parent.goBack({ waitUntil: "commit", timeout: 15000 });
  await expect(parent).toHaveURL(screeningMirrorOrigin + "/tutors");
  await expect(parent.getByRole("heading", { level: 1 })).toBeVisible();
  await expect
    .poll(async () => {
      try {
        const html = await parent.content();
        return [
          id,
          reviewId,
          fixture.parent.learnerId,
          fixture.parent.learnerName,
          fixture.parent.email,
          secret,
          "Fictional private lifetime review",
        ].some((needle) => html.includes(needle));
      } catch {
        return true; // The existing restored-document guard may still be reloading.
      }
    })
    .toBe(false);
  expect(
    (await nojs.request.get(`/api/bookings/${id}/publication-review`)).status(),
  ).toBe(401);
  await parent.goto("/sign-in");
  await parent
    .getByLabel("Test email", { exact: true })
    .fill(fixture.parent.email);
  await parent
    .getByLabel("Password", { exact: true })
    .fill("Fictional-wrong-password-only");
  await parent.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    parent
      .getByRole("alert")
      .filter({ hasText: "Sign-in could not be completed" }),
  ).toContainText("Sign-in could not be completed");
  expect(
    (await parent.content()).includes("Fictional private lifetime review"),
  ).toBe(false);
  await parent
    .getByLabel("Test email", { exact: true })
    .fill(fixture.tutor.email);
  await parent.getByLabel("Password", { exact: true }).fill(fixture.password);
  await parent.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(parent).toHaveURL(screeningMirrorOrigin + "/account");
  await parent.goto(`/bookings/${id}/publication-review?scope=guardian`);
  await expect(
    parent.getByRole("heading", { name: "Review unavailable" }),
  ).toBeVisible();
  expect(
    (await parent.content()).includes("Fictional private lifetime review"),
  ).toBe(false);
  await owner.pool.query(
    "UPDATE publication_moderator_grants SET active=false WHERE review_id=$1 AND moderator_user_id=$2",
    [reviewId, moderator.id],
  );
  const revoked = await staffContext.request.get(
    `/api/admin/publication-reviews/${reviewId}`,
  );
  expect(revoked.status()).toBe(404);
  expect(
    (await revoked.text()).includes("Fictional private lifetime review"),
  ).toBe(false);
  const ordinary = await browser.newContext({ baseURL: process.env.APP_URL });
  contexts.push(ordinary);
  const ordinaryPage = await ordinary.newPage();
  await ordinaryPage.goto(`/bookings/${id}/publication-review?scope=guardian`);
  await expect(
    ordinaryPage.getByRole("heading", { name: "Review unavailable" }),
  ).toBeVisible();
  const response = await ordinary.request.post(
    `/api/bookings/${id}/publication-review`,
    { headers: { origin: process.env.APP_URL! }, data: {} },
  );
  expect(response.status()).toBe(503);
  await p.goto("/tutors/" + fixture.tutor.slug);
  await expect(p.getByText("No reviews yet", { exact: true })).toBeVisible();
});
