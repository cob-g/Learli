import {
  assertOwnedReadinessDatabase,
  screeningMirrorOrigin,
} from "../support/readiness-placement";
import {
  test,
  expect,
  type Page,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import { readFile, mkdir, chmod } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../../src/lib/db/connection";
import { inspectW6BrowserPrivacy } from "../support/w6-browser-privacy";
import { restoreW6BrowserTutor } from "../support/w6-browser-fixtures";
import { totpCode } from "../support/admin-mfa";
test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "serial" });
test.setTimeout(180000);
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true),
  contexts: BrowserContext[] = [];
type Fixture = {
  parent: { id: string; email: string; learnerId: string; learnerName: string };
  college: {
    id: string;
    email: string;
    learnerId: string;
    learnerName: string;
  };
  reviewer: { id: string; email: string };
  tutor: { id: string; email: string; profileId: string; slug: string };
  password: string;
  booking: { policyId: string; admissionPolicyId: string };
  origin: string;
  sourceRoot: string;
};
let fixture: Fixture,
  staff: Page,
  staffContext: BrowserContext,
  staffSecret: string;
test.beforeAll(async ({ browser }) => {
  assertOwnedReadinessDatabase(process.cwd());
  fixture = JSON.parse(
    await readFile(".local/booking-workflows/browser-fixture.json", "utf8"),
  );
  expect(fixture.sourceRoot).toBe(process.cwd());
  expect(fixture.origin).toBe(screeningMirrorOrigin);
  const admin = await login(browser, fixture.reviewer.email);
  staff = admin.page;
  staffContext = admin.context;
  await staff.goto("/account/security");
  await staff
    .getByLabel("Current password", { exact: true })
    .fill(fixture.password);
  await staff.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(staff.locator("[data-mfa-secret]").first()).toBeVisible();
  staffSecret = (await staff
    .locator("[data-mfa-secret]")
    .first()
    .textContent())!;
  await staff
    .getByLabel("Authenticator code", { exact: true })
    .fill(totpCode(staffSecret));
  await staff
    .getByRole("button", { name: "Verify administrator access" })
    .click();
  await expect(
    staff.getByText("Administrator verification is current.", { exact: false }),
  ).toBeVisible();
  const tutor = await login(browser, fixture.tutor.email);
  await restoreW6BrowserTutor(owner, tutor.context, staffContext, fixture);
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
  await owner.pool.end();
});
async function login(browser: Browser, email: string) {
  await owner.pool.query(
    "UPDATE rate_limit SET count=0 WHERE key LIKE '%/sign-in/email%' OR key LIKE '%/two-factor/%'",
  );
  const context = await browser.newContext({ baseURL: fixture.origin }),
    page = await context.newPage();
  contexts.push(context);
  await page.goto("/sign-in");
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(fixture.origin + "/account");
  return { context, page };
}
async function accessible(page: Page) {
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function grant(id: string) {
  const logical = (
    await owner.pool.query(
      "SELECT logical_booking_id FROM bookings WHERE id=$1",
      [id],
    )
  ).rows[0].logical_booking_id;
  for (const action of ["confirm", "complete", "no_show"])
    await owner.pool.query(
      "INSERT INTO booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference) VALUES($1,$2,$3,true,clock_timestamp()+interval '2 hours',$4) ON CONFLICT DO NOTHING",
      [logical, fixture.reviewer.id, action, `synthetic:${randomUUID()}`],
    );
}
async function request(
  page: Page,
  learner: Fixture["parent"],
  scope = "guardian",
) {
  await page.goto("/readiness/tutors/" + fixture.tutor.slug);
  await page
    .getByRole("link", { name: "Review synthetic booking options" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic booking request",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Learner", { exact: true })
    .selectOption(learner.learnerId);
  await page
    .getByLabel("Tutor", { exact: true })
    .selectOption(fixture.tutor.slug);
  await page.getByLabel("Subject", { exact: true }).selectOption("math");
  await page.getByRole("button", { name: "Load synthetic times" }).click();
  await expect(
    page.getByRole("button", {
      name: "Request synthetic booking",
      exact: true,
    }),
  ).toBeEnabled();
  await page.locator("input[name=slot]").nth(8).check();
  await page
    .getByRole("button", { name: "Request synthetic booking", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    new RegExp("/bookings/[0-9a-f-]+\\?scope=" + scope),
  );
  const id = new URL(page.url()).pathname.split("/")[2];
  await expect(
    page.getByRole("heading", {
      name: "Synthetic provisional booking",
      exact: true,
    }),
  ).toBeVisible();
  await grant(id);
  return id;
}
async function confirm(id: string) {
  await staff.goto("/admin/bookings/" + id);
  await staff
    .getByRole("button", {
      name: "Confirm synthetic prerequisites",
      exact: true,
    })
    .click();
  await expect(
    staff.getByText(/confirmed.*administrative software testing/),
  ).toBeVisible();
}
test("default policy denies confirmation and body collection; native private reads need authorization", async ({
  browser,
}) => {
  const c = await browser.newContext({ baseURL: process.env.APP_URL });
  contexts.push(c);
  const r = await c.request.post(
    "/api/bookings/" + randomUUID() + "/workflow/confirm",
    {
      headers: { origin: process.env.APP_URL! },
      data: { confirmed: true, body: "must-not-collect" },
    },
  );
  expect(r.status()).toBe(503);
  expect((await r.text()).includes("must-not-collect")).toBe(false);
  const p = await c.newPage();
  await p.goto("/bookings/" + randomUUID() + "?scope=guardian");
  await expect(
    p.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
test("parent request -> assigned browser MFA confirmation -> private link -> move/conflict -> cancel/history/dispute with phone/keyboard/axe/privacy", async ({
  browser,
}) => {
  const parent = await login(browser, fixture.parent.email),
    page = parent.page;
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await request(page, fixture.parent);
  await accessible(page);
  await confirm(id);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic booking confirmed",
      exact: true,
    }),
  ).toBeVisible();
  const tutor = await login(browser, fixture.tutor.email);
  await tutor.page.goto("/bookings/" + id + "?scope=tutor");
  await tutor.page
    .getByLabel("Zoom or Google Meet test link", { exact: true })
    .fill("https://meet.google.com/abc-defg-hij");
  await tutor.page
    .getByRole("button", { name: "Save test meeting link", exact: true })
    .click();
  await expect(
    tutor.page.getByText("Test meeting link saved. No meeting was arranged.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Open test link on Google Meet/ }),
  ).toBeVisible();
  const opened = await parent.context.request.get(
    "/api/bookings/" + id + "/meeting-link?open=1",
    { maxRedirects: 0 },
  );
  expect([302, 303, 307]).toContain(opened.status());
  expect(opened.headers().location).toBe(
    "https://meet.google.com/abc-defg-hij",
  );
  await page
    .getByRole("link", { name: "Move synthetic booking", exact: true })
    .click();
  await page.locator("input[name=slot]").nth(9).check();
  await page
    .getByRole("button", { name: "Move synthetic booking", exact: true })
    .click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+\?scope=guardian/);
  const moved = new URL(page.url()).pathname.split("/")[2];
  expect(moved).not.toBe(id);
  expect(
    (
      await owner.pool.query(
        "SELECT workflow_policy_id FROM bookings WHERE id=$1",
        [moved],
      )
    ).rows[0].workflow_policy_id,
  ).toBe(fixture.booking.policyId);
  await expect(page.getByRole("link", { name: /Open test link/ })).toHaveCount(
    0,
  );
  const prior = (
    await owner.pool.query(
      "SELECT state,workflow_revision,start_at_utc FROM bookings WHERE id=$1",
      [moved],
    )
  ).rows[0];
  const conflict = await parent.context.request.post(
    "/api/bookings/" + moved + "/workflow/reschedule",
    {
      headers: { origin: fixture.origin },
      data: {
        requestId: randomUUID(),
        expectedRevision: prior.workflow_revision,
        reasonCode: "synthetic_participant_change",
        startAtUtc: new Date(prior.start_at_utc).toISOString(),
        endAtUtc: new Date(
          new Date(prior.start_at_utc).getTime() + 3600000,
        ).toISOString(),
        displayTimezone: "UTC",
      },
    },
  );
  expect(conflict.status()).toBe(409);
  expect(
    (await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [moved]))
      .rows[0].state,
  ).toBe("confirmed");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await accessible(page);
    await mkdir(".local/booking-workflows/screens", {
      recursive: true,
      mode: 0o700,
    });
    const screenshot = `.local/booking-workflows/screens/${test.info().project.name}-${width}.png`;
    await page.screenshot({ path: screenshot, fullPage: true });
    await chmod(screenshot, 0o600);
  }
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await accessible(page);
  await page.emulateMedia({
    reducedMotion: "no-preference",
    forcedColors: "none",
  });
  await page
    .getByText("Cancel synthetic booking", { exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Cancel synthetic booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic booking cancelled",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic time replacement saved", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "Request synthetic booking dispute",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Fictional subject", { exact: true })
    .fill("Fictional outcome dispute");
  await page
    .getByLabel("Fictional description", { exact: true })
    .fill("Fictional cancellation dispute; no attendance or payment evidence.");
  await page
    .getByRole("button", {
      name: "Save synthetic booking dispute",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/safeguarding\/cases\/[0-9a-f-]+/);
  const caseId = new URL(page.url()).pathname.split("/")[3];
  expect(
    (
      await owner.pool.query(
        "SELECT booking_id FROM support_case_bookings WHERE case_id=$1",
        [caseId],
      )
    ).rows[0].booking_id,
  ).toBe(moved);
  await expect(
    page.getByRole("heading", {
      name: "Related synthetic readiness booking",
      exact: true,
    }),
  ).toBeVisible();
  await accessible(page);
  const native = await browser.newContext({
    baseURL: fixture.origin,
    javaScriptEnabled: false,
    storageState: await parent.context.storageState(),
  });
  contexts.push(native);
  const np = await native.newPage();
  await np.goto("/bookings/" + moved + "?scope=guardian");
  await expect(
    np.getByRole("heading", {
      name: "Synthetic booking cancelled",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    np.getByRole("heading", { name: "Saved booking history" }),
  ).toBeVisible();
  await np.goto("/bookings/" + moved + "/dispute");
  await expect(
    np.getByRole("button", { name: "Save synthetic booking dispute" }),
  ).toBeDisabled();
  expect(await np.locator("form").getAttribute("method")).toBe("post");
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  expect((await page.content()).includes(moved)).toBe(false);
  await page
    .getByLabel("Test email", { exact: true })
    .fill(fixture.college.email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(fixture.origin + "/account");
  expect((await page.content()).includes(moved)).toBe(false);
  await page.goBack();
  expect((await page.content()).includes(moved)).toBe(false);
});
test("independent College booking and foreign/outcome denials preserve current authority", async ({
  browser,
}) => {
  const college = await login(browser, fixture.college.email),
    id = await request(college.page, fixture.college, "student");
  await confirm(id);
  await college.page.reload();
  await expect(
    college.page.getByRole("heading", {
      name: "Synthetic booking confirmed",
      exact: true,
    }),
  ).toBeVisible();
  const other = await login(browser, fixture.parent.email);
  await other.page.goto("/bookings/" + id + "?scope=guardian");
  await expect(
    other.page.getByRole("heading", { name: /We can.t find that booking/ }),
  ).toBeVisible();
  const before = (
    await owner.pool.query(
      "SELECT workflow_revision FROM bookings WHERE id=$1",
      [id],
    )
  ).rows[0].workflow_revision;
  const denied = await staffContext.request.post(
    "/api/bookings/" + id + "/workflow/complete",
    {
      headers: { origin: fixture.origin },
      data: {
        requestId: randomUUID(),
        expectedRevision: before,
        reasonCode: "synthetic_completed",
      },
    },
  );
  expect(denied.status()).toBe(409);
  await staff.goto("/admin/bookings/" + id);
  await staff
    .getByRole("button", {
      name: "Record administrative completion",
      exact: true,
    })
    .click();
  const actionError = staff
    .getByRole("alert")
    .filter({ hasText: /booking.*changed/ });
  await expect(actionError).toBeVisible();
  await expect(actionError).toBeFocused();
  expect(
    (
      await owner.pool.query(
        "SELECT state,workflow_revision FROM bookings WHERE id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual({ state: "confirmed", workflow_revision: before });

  await college.page.route("**/api/bookings/*/workflow/cancel", (route) =>
    route.abort("failed"),
  );
  await college.page
    .getByText("Cancel synthetic booking", { exact: true })
    .first()
    .click();
  await college.page
    .getByRole("button", { name: "Cancel synthetic booking", exact: true })
    .click();
  const uncertain = college.page
    .getByRole("alert")
    .filter({ hasText: "The result is uncertain." });
  await expect(uncertain).toBeVisible();
  await expect(uncertain).toBeFocused();
  await expect(
    college.page.getByRole("button", {
      name: "Cancel synthetic booking",
      exact: true,
    }),
  ).toBeDisabled();
  expect(
    (await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [id]))
      .rows[0].state,
  ).toBe("confirmed");
  await college.page.unroute("**/api/bookings/*/workflow/cancel");
  const forged = await college.context.request.post(
    "/api/bookings/" + id + "/workflow/confirm",
    {
      headers: { origin: fixture.origin },
      data: {
        requestId: randomUUID(),
        expectedRevision: 0,
        reasonCode: "synthetic_prerequisite_review",
        paid: true,
      },
    },
  );
  expect([400, 403]).toContain(forged.status());
  await owner.pool.query(
    "DELETE FROM user_roles WHERE user_id=$1 AND role='student'",
    [fixture.college.id],
  );
  await college.page.reload();
  await expect(
    college.page.getByRole("heading", { name: /We can.t find that booking/ }),
  ).toBeVisible();
  expect(
    (await college.page.content()).includes("https://meet.google.com"),
  ).toBe(false);
});

test("assigned browser MFA administrative completion and no-show preserve explicit provenance and dispute path", async () => {
  const subject = (
    await owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  for (const [index, action] of ["complete", "no_show"].entries()) {
    const id = randomUUID(),
      key = randomUUID(),
      now = Date.now(),
      start = new Date(now - (index + 3) * 7200000),
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
          "a".repeat(64),
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
          fixture.reviewer.id,
          key,
          "a".repeat(64),
          created,
          fixture.booking.policyId,
        ],
      );
      await client.query("COMMIT");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    await grant(id);
    await staff.goto("/admin/bookings/" + id);
    await staff
      .getByRole("button", {
        name:
          action === "complete"
            ? "Record administrative completion"
            : "Record administrative no-show",
        exact: true,
      })
      .click();
    await expect(
      staff.getByText(
        /administrative software testing, never attendance evidence/,
      ),
    ).toContainText(
      action === "complete"
        ? "administrative completion"
        : "administrative no-show",
    );
    await expect(
      staff.getByRole("link", {
        name: "Dispute an administrative outcome",
        exact: true,
      }),
    ).toHaveAttribute("href", "/support");
    expect(
      (await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [id]))
        .rows[0].state,
    ).toBe(action === "complete" ? "completed" : "no_show");
    expect(
      (
        await owner.pool.query(
          "SELECT count(*)::int n FROM booking_lifecycle_events WHERE booking_id=$1 AND event=$2",
          [
            id,
            action === "complete" ? "workflow_completed" : "workflow_no_show",
          ],
        )
      ).rows[0].n,
    ).toBe(1);
    await accessible(staff);
  }
});

test("public/auth HTML, anonymous errors and emitted clients omit current private fixture and transient MFA values", async () => {
  await inspectW6BrowserPrivacy(fixture, staffSecret);
});
