import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import {
  owner,
  ensureOwner,
  closeOwner,
  fixture,
  register,
  admin,
  accessible,
  noJs,
  mirrorOrigin,
} from "./w8-fixtures";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import { assignAdmissionReviewer } from "../support/learner-admission-fixtures";
import { restoreW6BrowserTutor } from "../support/w6-browser-fixtures";
import {
  provisionResponseGrant,
  provisionSafetyRestriction,
} from "../../src/features/safeguarding/fixture-tooling";

test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "serial" });
test.setTimeout(240000);
const contexts: BrowserContext[] = [];
test.beforeAll(() => {
  assertOwnedReadinessDatabase(process.cwd());
  ensureOwner();
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
  await closeOwner();
});

async function event(bookingId: string, kind: string) {
  const result = await owner.pool.query<{ id: string }>(
    "SELECT id FROM booking_lifecycle_events WHERE booking_id=$1 AND event=$2 ORDER BY created_at DESC LIMIT 1",
    [bookingId, kind],
  );
  expect(result.rows).toHaveLength(1);
  return result.rows[0].id;
}
function drain(eventId: string, mode = "accepted") {
  const result = execFileSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "tests/support/transactional-delivery-drain.ts",
      eventId,
      mode,
    ],
    { cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 30000 },
  );
  return z
    .object({
      providerAccepted: z.number(),
      retryable: z.number(),
      uncertain: z.number(),
    })
    .parse(JSON.parse(result));
}
async function bookingGrant(id: string, staffId: string, action: string) {
  await owner.pool.query(
    "INSERT INTO booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference) SELECT logical_booking_id,$2,$3,true,clock_timestamp()+interval '2 hours',$4 FROM bookings WHERE id=$1 ON CONFLICT DO NOTHING",
    [id, staffId, action, "synthetic:" + randomUUID()],
  );
}
async function evidence(page: Page, code: string) {
  const reference = "browser:" + randomUUID();
  await page.getByLabel("Review check").selectOption(code);
  await page.getByLabel("Opaque synthetic reference").fill(reference);
  await page
    .getByRole("button", { name: "Record evidence", exact: true })
    .click();
  await expect(page.getByText(reference, { exact: false })).toBeVisible();
}
/** Explicit owner-only elapsed-clock fixture, using the SAME newly admitted
 * learner and screened tutor. It is a separate historical booking, not a claim
 * that this test waited for or observed the upcoming lesson. Completion itself
 * goes through the actual assigned-MFA browser action. */
async function elapsedConfirmed(input: {
  tutorId: string;
  learnerId: string;
  parentId: string;
  staffId: string;
  bookingPolicyId: string;
  admissionPolicyId: string;
}) {
  const id = randomUUID(),
    key = randomUUID(),
    now = Date.now();
  const client = await owner.pool.connect();
  try {
    await client.query("BEGIN");
    const subject = (
      await client.query<{ id: string }>(
        "SELECT id FROM subjects WHERE slug='math'",
      )
    ).rows[0].id;
    await client.query(
      "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id) VALUES($1,'synthetic_readiness',$2,$3,$4,$5,$6,$7,'UTC',$8,$9,'confirmed',$10,$11,$12,$13)",
      [
        id,
        input.tutorId,
        input.learnerId,
        input.parentId,
        subject,
        new Date(now - 7200000),
        new Date(now - 3600000),
        key,
        "d".repeat(64),
        new Date(now - 10800000),
        new Date(now - 10200000),
        input.bookingPolicyId,
        input.admissionPolicyId,
      ],
    );
    await client.query(
      "INSERT INTO booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES($1,$1,$2,'workflow_confirmed',$3,$4,$5,$6,0,'synthetic_prerequisite_review')",
      [
        id,
        input.staffId,
        key,
        "d".repeat(64),
        new Date(now - 10800000),
        input.bookingPolicyId,
      ],
    );
    await client.query("COMMIT");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  await bookingGrant(id, input.staffId, "complete");
  return id;
}

test("new verified guardian and tutor cross admission, screening, booking, SDK notices, outcome, publication and safety restriction", async ({
  browser,
}) => {
  const f = await fixture();
  const staff = await admin(browser, "reviewer");
  const parent = await register(browser, "Fictional integrated guardian");
  const tutor = await register(browser, "Fictional integrated tutor");
  contexts.push(staff.context, parent.context, tutor.context);
  const learnerName = "Fictional integrated learner " + randomUUID();
  // New accounts have no owner-seeded family relationship or tutor screening.
  await tutor.page.goto("/become-a-tutor");
  await tutor.page
    .getByRole("button", { name: "Start tutor application", exact: true })
    .click();
  await expect(tutor.page).toHaveURL(mirrorOrigin + "/tutor/profile");
  const tutorFixture = {
    origin: mirrorOrigin,
    reviewer: { id: staff.id },
    tutor: { id: tutor.id, profileId: randomUUID(), slug: "not-created-yet" },
  };
  await restoreW6BrowserTutor(
    owner,
    tutor.context,
    staff.context,
    tutorFixture,
  );

  // Anonymous discovery must survive actual sign-in and the admission detour.
  const discovery = `/bookings/demo?tutorSlug=${tutorFixture.tutor.slug}&subjectSlug=math`;
  await parent.page.goto("/account");
  await parent.page
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(parent.page).toHaveURL(/\/sign-in/);
  await parent.page.goto("/tutors/" + tutorFixture.tutor.slug);
  await parent.page
    .getByRole("link", {
      name: "Review synthetic booking options",
      exact: true,
    })
    .click();
  await expect(parent.page).toHaveURL(/\/sign-in\?/);
  expect(new URL(parent.page.url()).searchParams.get("next")).toBe(discovery);
  await parent.page
    .getByLabel("Test email", { exact: true })
    .fill(parent.email);
  await parent.page.getByLabel("Password", { exact: true }).fill(f.password);
  await parent.page
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(parent.page).toHaveURL(mirrorOrigin + discovery);
  const detour = parent.page.getByRole("link", {
    name: "Learner admission and review",
    exact: true,
  });
  expect(await detour.getAttribute("href")).toBe(
    `/learner-admission/new?next=${encodeURIComponent(discovery)}`,
  );
  await detour.click();
  await expect(parent.page).toHaveURL(
    mirrorOrigin +
      `/learner-admission/new?next=${encodeURIComponent(discovery)}`,
  );
  // Origin storage must not prevent a real cookie-authenticated no-JS visit.
  await parent.page.evaluate(() =>
    localStorage.setItem("synthetic-no-js-regression", "not-authentication"),
  );
  expect(
    (await parent.context.storageState()).origins.some(
      (origin) =>
        origin.origin === mirrorOrigin &&
        origin.localStorage.some(
          (entry) => entry.name === "synthetic-no-js-regression",
        ),
    ),
  ).toBe(true);
  await noJs(
    browser,
    parent.context,
    `/learner-admission/new?next=${encodeURIComponent(discovery)}`,
  );
  await parent.page.getByLabel("Fictional display name").fill(learnerName);
  await parent.page.getByLabel("Learner level").selectOption("high_school");
  await parent.page
    .getByRole("button", { name: "Request admission review", exact: true })
    .click();
  await expect(parent.page).toHaveURL(/\/learner-admission\/[a-f0-9-]+$/);
  const admissionId = new URL(parent.page.url()).pathname.split("/").at(-1)!;
  await expect(
    parent.page.getByText("Learner access is not authorized.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    (
      await owner.pool.query(
        "SELECT count(*)::int n FROM guardian_learner_links WHERE guardian_user_id=$1",
        [parent.id],
      )
    ).rows[0].n,
  ).toBe(0);
  await assignAdmissionReviewer(owner.pool, admissionId, staff.id);
  await staff.page.goto("/admin/learner-admission/" + admissionId);
  await evidence(staff.page, "guardian_authority");
  await evidence(staff.page, "guardian_notice");
  await staff.page
    .getByRole("button", { name: "Save admission decision", exact: true })
    .click();
  await expect(
    staff.page.getByText("Status: authorized.", { exact: true }),
  ).toBeVisible();
  const admitted = (
    await owner.pool.query<{ learner_id: string; policy_id: string }>(
      "SELECT learner_id,policy_id FROM learner_admissions WHERE id=$1",
      [admissionId],
    )
  ).rows[0];
  expect(admitted.learner_id).toBeTruthy();

  await parent.page.reload();
  const continued = parent.page.getByRole("link", {
    name: "Return to selected tutor and subject",
    exact: true,
  });
  await expect(continued).toHaveAttribute("href", discovery);
  await continued.click();
  await expect(parent.page).toHaveURL(mirrorOrigin + discovery);
  await expect(parent.page.getByLabel("Tutor", { exact: true })).toHaveValue(
    tutorFixture.tutor.slug,
  );
  await expect(parent.page.getByLabel("Subject", { exact: true })).toHaveValue(
    "math",
  );
  await parent.page
    .getByLabel("Learner", { exact: true })
    .selectOption(admitted.learner_id);
  await parent.page
    .getByLabel("Tutor", { exact: true })
    .selectOption(tutorFixture.tutor.slug);
  await parent.page.getByLabel("Subject", { exact: true }).selectOption("math");
  await parent.page
    .getByRole("button", { name: "Load synthetic times" })
    .click();
  await expect(
    parent.page.getByRole("button", {
      name: "Request synthetic booking",
      exact: true,
    }),
  ).toBeEnabled();
  await parent.page.locator("input[name=slot]").nth(8).check();
  await parent.page
    .getByRole("button", { name: "Request synthetic booking", exact: true })
    .click();
  await expect(parent.page).toHaveURL(/\/bookings\/[a-f0-9-]+\?scope=guardian/);
  const bookingId = new URL(parent.page.url()).pathname.split("/")[2];
  expect(
    drain(await event(bookingId, "workflow_provisional"), "503").retryable,
  ).toBe(2);
  expect(
    (
      await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
        bookingId,
      ])
    ).rows[0].state,
  ).toBe("provisional");
  await bookingGrant(bookingId, staff.id, "confirm");
  await staff.page.goto("/admin/bookings/" + bookingId);
  await staff.page
    .getByRole("button", {
      name: "Confirm synthetic prerequisites",
      exact: true,
    })
    .click();
  await expect(
    staff.page.getByText(/confirmed.*administrative software testing/),
  ).toBeVisible();
  expect(
    drain(await event(bookingId, "workflow_confirmed")).providerAccepted,
  ).toBe(2);
  await tutor.page.goto("/bookings/" + bookingId + "?scope=tutor");
  const meeting = "https://meet.google.com/abc-defg-hij";
  await tutor.page
    .getByLabel("Zoom or Google Meet test link", { exact: true })
    .fill(meeting);
  await tutor.page
    .getByRole("button", { name: "Save test meeting link", exact: true })
    .click();
  await expect(
    tutor.page.getByText("Test meeting link saved. No meeting was arranged.", {
      exact: true,
    }),
  ).toBeVisible();
  await parent.page.reload();
  await expect(
    parent.page.getByRole("link", { name: /Open test link on Google Meet/ }),
  ).toBeVisible();
  await accessible(parent.page);
  const deniedVisitor = await browser.newContext({ baseURL: mirrorOrigin });
  contexts.push(deniedVisitor);
  expect([401, 404]).toContain(
    (
      await deniedVisitor.request.get(
        "/api/bookings/" + bookingId + "/meeting-link",
      )
    ).status(),
  );
  // Keep the real upcoming booking intact; use a disclosed elapsed-clock fixture.
  const policy = (
    await owner.pool.query<{ workflow_policy_id: string }>(
      "SELECT workflow_policy_id FROM bookings WHERE id=$1",
      [bookingId],
    )
  ).rows[0];
  const historical = await elapsedConfirmed({
    tutorId: tutorFixture.tutor.profileId,
    learnerId: admitted.learner_id,
    parentId: parent.id,
    staffId: staff.id,
    bookingPolicyId: policy.workflow_policy_id,
    admissionPolicyId: admitted.policy_id,
  });
  await staff.page.goto("/admin/bookings/" + historical);
  await staff.page
    .getByRole("button", {
      name: "Record administrative completion",
      exact: true,
    })
    .click();
  await expect(
    staff.page.getByText(
      /administrative software testing, never attendance evidence/,
    ),
  ).toContainText("administrative completion");
  expect(
    drain(await event(historical, "workflow_completed")).providerAccepted,
  ).toBe(2);
  await parent.page.goto("/bookings/" + historical + "?scope=guardian");
  await parent.page
    .getByRole("link", {
      name: "Add synthetic publication review",
      exact: true,
    })
    .click();
  const comment = "Fictional integrated review <b>plain text only</b>";
  await parent.page.getByLabel("Rating from 1 to 5").selectOption("4");
  await parent.page.getByLabel(/Comment/).fill(comment);
  await parent.page
    .getByRole("button", { name: "Save synthetic review", exact: true })
    .click();
  await expect(
    parent.page.getByRole("heading", { name: "Saved review", exact: true }),
  ).toBeVisible();
  const publication = (
    await owner.pool.query<{ id: string; policy_id: string }>(
      "SELECT id,policy_id FROM publication_reviews WHERE booking_id=$1",
      [historical],
    )
  ).rows[0];
  await owner.pool.query(
    "INSERT INTO publication_moderator_grants(review_id,moderator_user_id,policy_id,active,valid_until,reference) VALUES($1,$2,$3,true,clock_timestamp()+interval '2 hours',$4)",
    [
      publication.id,
      staff.id,
      publication.policy_id,
      "synthetic:" + randomUUID(),
    ],
  );
  for (const state of ["approved", "published"]) {
    await staff.page.goto("/admin/publication-reviews/" + publication.id);
    await staff.page.getByLabel("Next review state").selectOption(state);
    await staff.page.getByRole("checkbox").check();
    await staff.page
      .getByRole("button", { name: "Save moderation decision", exact: true })
      .click();
    await expect(staff.page.getByLabel("Next review state")).not.toHaveValue(
      state,
    );
  }
  const visitor = await deniedVisitor.newPage();
  await visitor.goto("/tutors/" + tutorFixture.tutor.slug);
  await expect(visitor.getByText(comment, { exact: true })).toBeVisible();
  expect(
    await visitor.locator("b", { hasText: "plain text only" }).count(),
  ).toBe(0);
  const publicHtml = await visitor
    .locator("html")
    .evaluate((el) => el.outerHTML);
  for (const privateValue of [
    learnerName,
    parent.id,
    parent.email,
    admitted.learner_id,
    bookingId,
    historical,
    meeting,
  ])
    expect(publicHtml.includes(privateValue)).toBe(false);

  // An actual report and assignment precede a separately scoped restriction.
  const concern = "Fictional integrated concern " + randomUUID();
  await parent.page.goto("/safeguarding/report");
  await parent.page
    .getByLabel("Report subject")
    .fill("Fictional integrated report");
  await parent.page.getByLabel("Concern", { exact: true }).fill(concern);
  await parent.page
    .getByRole("button", { name: "Save synthetic report" })
    .click();
  await expect(parent.page).toHaveURL(/\/safeguarding\/cases\/[^/]+$/);
  const caseId = new URL(parent.page.url()).pathname.split("/").at(-1)!;
  const dispatcher = await admin(browser, "dispatcher");
  contexts.push(dispatcher.context);
  const expiry = new Date(f.safeguarding.validUntil);
  await provisionResponseGrant(
    owner,
    caseId,
    dispatcher.id,
    "dispatcher",
    expiry,
  );
  await provisionResponseGrant(
    owner,
    caseId,
    staff.id,
    "reviewer_choice",
    expiry,
  );
  await dispatcher.page.goto(
    "/admin/safeguarding/" + caseId + "?scope=dispatcher",
  );
  expect(
    (
      await dispatcher.page.locator("html").evaluate((el) => el.outerHTML)
    ).includes(concern),
  ).toBe(false);
  await dispatcher.page
    .getByLabel("Exact permitted reviewer")
    .selectOption(staff.id);
  await dispatcher.page
    .getByRole("button", { name: "Save assignment" })
    .click();
  await expect(dispatcher.page.getByText(/Revision 1/).first()).toBeVisible();
  await staff.page.goto("/admin/safeguarding/" + caseId);
  await expect(staff.page.getByText(concern, { exact: true })).toBeVisible();
  await staff.page
    .getByRole("button", { name: "Acknowledge assignment" })
    .click();
  await expect(
    staff.page.getByText("Current assignment acknowledged", { exact: true }),
  ).toBeVisible();
  await provisionSafetyRestriction(owner, staff.id, tutor.id, expiry);
  await staff.page.goto("/admin/safeguarding/accounts/" + tutor.id);
  await staff.page
    .getByRole("button", { name: "Restrict synthetic account" })
    .click();
  await staff.page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm access action" })
    .click();
  await expect(staff.page.getByText(/suspended/)).toBeVisible();
  const linkDenied = await parent.context.request.get(
    "/api/bookings/" + bookingId + "/meeting-link",
  );
  expect([403, 404]).toContain(linkDenied.status());
  expect((await linkDenied.text()).includes(meeting)).toBe(false);
  await visitor.reload();
  await expect(visitor.getByText(comment, { exact: true })).toHaveCount(0);

  // Same browser signs out, changes account, and revisits the prior private document.
  const outsider = await register(
    browser,
    "Fictional integrated unrelated account",
  );
  contexts.push(outsider.context);
  await parent.page.goto("/safeguarding/cases/" + caseId);
  await expect(parent.page.getByText(concern, { exact: true })).toBeVisible();
  expect(
    (
      await parent.context.request.post("/api/auth/sign-out", {
        headers: { origin: mirrorOrigin },
        data: {},
      })
    ).status(),
  ).toBe(200);
  await parent.page.goto("/sign-in");
  await parent.page
    .getByLabel("Test email", { exact: true })
    .fill(outsider.email);
  await parent.page.getByLabel("Password", { exact: true }).fill(f.password);
  await parent.page
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(parent.page).toHaveURL(mirrorOrigin + "/account");
  const privateNeedles = [
    concern,
    "Fictional integrated report",
    learnerName,
    parent.id,
    parent.email,
    tutor.id,
    tutor.email,
    admitted.learner_id,
    admissionId,
    bookingId,
    historical,
    meeting,
    comment,
    publication.id,
    String.raw`\"learner\":`,
    String.raw`\"meetingSection\":`,
    String.raw`\"booking\":`,
    String.raw`\"history\":`,
  ];
  const assertCleared = async () => {
    const current = new URL(parent.page.url());
    expect(["/account", "/safeguarding/cases/" + caseId]).toContain(
      current.pathname,
    );
    const isDeniedCase = current.pathname === "/safeguarding/cases/" + caseId;
    await expect(parent.page.getByRole("heading", { level: 1 })).toBeVisible();
    if (isDeniedCase) {
      await expect(
        parent.page.getByText("This case is unavailable to this account.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        parent.page.getByRole("heading", {
          name: "Saved action history",
          exact: true,
        }),
      ).toHaveCount(0);
    } else {
      await expect(
        parent.page.getByText(`Signed in as ${outsider.email}`, {
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect
      .poll(async () => {
        try {
          let html = await parent.page.content();
          if (isDeniedCase) {
            // Known current URL metadata may name the requested case. Every other
            // occurrence remains forbidden, including a previous private payload.
            for (const routeField of [
              String.raw`\"n\":\"caseId\",\"t\":\"d\",\"k\":\"${caseId}\"`,
              String.raw`\"c\":[\"\",\"safeguarding\",\"cases\",\"${caseId}\"]`,
            ]) {
              if (html.split(routeField).length !== 2) return false;
              html = html.replace(
                routeField,
                routeField.replace(caseId, "[requested-route]"),
              );
            }
          }
          return [...privateNeedles, caseId].every((value) =>
            [
              value,
              encodeURIComponent(value),
              JSON.stringify(value).slice(1, -1),
            ].every((needle) => !html.includes(needle)),
          );
        } catch {
          // A restored document may be reloading; no readable proof is unsafe.
          return false;
        }
      })
      .toBe(true);
  };
  await assertCleared();
  await parent.page.goBack({ waitUntil: "commit", timeout: 15000 });
  await expect(parent.page).toHaveURL(
    mirrorOrigin + "/safeguarding/cases/" + caseId,
  );
  await assertCleared();
  await parent.page.goto("/safeguarding/cases/" + caseId);
  await expect(parent.page).toHaveURL(
    mirrorOrigin + "/safeguarding/cases/" + caseId,
  );
  await assertCleared();
  expect(
    (
      await parent.context.request.get("/api/safeguarding/cases/" + caseId)
    ).status(),
  ).toBe(404);
});
