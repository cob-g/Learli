import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import {
  screeningMirrorOrigin,
  assertOwnedReadinessDatabase,
} from "../support/readiness-placement";
import {
  admin,
  ensureOwner,
  closeOwner,
  fixture as staffFixture,
} from "./w8-fixtures";
import { totpCode } from "../support/admin-mfa";
import { inspectW6BrowserPrivacy } from "../support/w6-browser-privacy";

process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
test.describe.configure({ mode: "serial" });
test.setTimeout(180000);
test.use({ trace: "off", screenshot: "off", video: "off" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
type Fixture = {
  sourceRoot: string;
  origin: string;
  password: string;
  parent: { id: string; email: string; learnerId: string; learnerName: string };
  college: {
    id: string;
    email: string;
    learnerId: string;
    learnerName: string;
  };
  reviewer: { id: string; email: string };
  tutor: { id: string; email: string; slug: string; profileId: string };
  booking: { policyId: string; admissionPolicyId: string };
};
let fixture: Fixture;
const contexts: BrowserContext[] = [];
const exercisedFactors: string[] = [];
test.beforeAll(async () => {
  assertOwnedReadinessDatabase(process.cwd());
  ensureOwner();
  fixture = JSON.parse(
    readFileSync(".local/booking-workflows/browser-fixture.json", "utf8"),
  );
  expect(fixture.sourceRoot).toBe(process.cwd());
  expect(fixture.origin).toBe(screeningMirrorOrigin);
  // Earlier ordinary browser reset may have recreated this exact fixture tutor
  // through W6's real application flow. Read its current public slug rather than
  // trusting the startup JSON's earlier profile identity.
  const currentTutor = await owner.pool.query(
    "SELECT id,slug FROM tutor_profiles WHERE user_id=$1",
    [fixture.tutor.id],
  );
  expect(currentTutor.rows).toHaveLength(1);
  fixture.tutor.slug = currentTutor.rows[0].slug;
  fixture.tutor.profileId = currentTutor.rows[0].id;
});
test.afterAll(async () => {
  for (const context of contexts) await context.close();
  await owner.pool.end();
  await closeOwner();
});
function drain(eventId: string, mode = "accepted") {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "tests/support/transactional-delivery-drain.ts",
        eventId,
        mode,
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        timeout: 30000,
      },
    ),
  );
}
async function event(id: string, kind: string) {
  const r = await owner.pool.query(
    "SELECT id FROM booking_lifecycle_events WHERE coalesce(replacement_booking_id,booking_id)=$1 AND event=$2 ORDER BY created_at DESC LIMIT 1",
    [id, kind],
  );
  expect(r.rows).toHaveLength(1);
  return r.rows[0].id as string;
}
async function due(eventId: string) {
  await expect
    .poll(
      async () => {
        const result = await owner.pool.query(
          "SELECT bool_and(next_attempt_at<=clock_timestamp()) AS ready FROM transactional_deliveries WHERE event_id=$1 AND state IN ('retryable','uncertain')",
          [eventId],
        );
        return result.rows[0].ready;
      },
      { timeout: 10000 },
    )
    .toBe(true);
}
async function signIn(page: Page, email: string, secondFactor?: string) {
  await owner.pool.query(
    "UPDATE rate_limit SET count=0 WHERE key LIKE '%/sign-in/email%'",
  );
  await page.goto(`${fixture.origin}/sign-in`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  const submitted = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/sign-in/email" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const response = await submitted;
  expect(response.status()).toBe(200);
  await expect(page).toHaveURL(
    (url) =>
      url.origin === fixture.origin &&
      (url.pathname === "/account" || url.pathname === "/two-factor"),
  );
  if (new URL(page.url()).pathname === "/two-factor") {
    if (!secondFactor) throw new Error("Owned fixture authenticator required.");
    exercisedFactors.push(secondFactor);
    await expect(page).toHaveURL(
      fixture.origin + "/two-factor?next=%2Faccount",
    );
    await page
      .getByLabel("Authenticator code", { exact: true })
      .fill(totpCode(secondFactor));
    await page
      .getByRole("button", { name: "Verify administrator access", exact: true })
      .click();
  }
  await expect(page).toHaveURL(fixture.origin + "/account");
}
test("actual browser booking/confirmation/move/cancel commits survive SDK failure and minimal current notices", async ({
  browser,
}) => {
  const staff = await admin(browser, "reviewer");
  contexts.push(staff.context);
  const parent = await browser.newContext({ baseURL: fixture.origin }),
    page = await parent.newPage();
  contexts.push(parent);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, fixture.parent.email);
  await page.goto("/readiness/tutors/" + fixture.tutor.slug);
  await page
    .getByRole("link", { name: "Review synthetic booking options" })
    .click();
  await page
    .getByLabel("Learner", { exact: true })
    .selectOption(fixture.parent.learnerId);
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
  await expect(page).toHaveURL(/\/bookings\/[a-f0-9-]+\?scope=guardian/);
  const id = new URL(page.url()).pathname.split("/")[2],
    provisional = await event(id, "workflow_provisional");
  expect(drain(provisional, "503").retryable).toBe(2);
  expect(
    (await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [id]))
      .rows[0].state,
  ).toBe("provisional");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic provisional booking",
      exact: true,
    }),
  ).toBeVisible();
  const staffId = staff.id;
  const logical = (
    await owner.pool.query(
      "SELECT logical_booking_id FROM bookings WHERE id=$1",
      [id],
    )
  ).rows[0].logical_booking_id;
  await owner.pool.query(
    "INSERT INTO booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference) VALUES($1,$2,'confirm',true,clock_timestamp()+interval '2 hours',$3)",
    [logical, staffId, `synthetic:${randomUUID()}`],
  );
  await staff.page.goto("/admin/bookings/" + id);
  await staff.page
    .getByRole("button", {
      name: "Confirm synthetic prerequisites",
      exact: true,
    })
    .click();
  await expect(
    staff.page.getByText(/confirmed.*administrative software testing/),
  ).toBeVisible();
  const confirmed = await event(id, "workflow_confirmed");
  expect(drain(confirmed, "503").retryable).toBe(2);
  expect(
    (await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [id]))
      .rows[0].state,
  ).toBe("confirmed");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic booking confirmed",
      exact: true,
    }),
  ).toBeVisible();
  await due(confirmed);
  expect(drain(confirmed).providerAccepted).toBe(2);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id),
  ).toEqual([]);
  await page.emulateMedia({
    forcedColors: "none",
    reducedMotion: "no-preference",
  });
  await page
    .getByRole("link", { name: "Move synthetic booking", exact: true })
    .click();
  await page.locator("input[name=slot]").nth(9).check();
  await page
    .getByRole("button", { name: "Move synthetic booking", exact: true })
    .click();
  await expect(page).toHaveURL(/\/bookings\/[a-f0-9-]+\?scope=guardian/);
  const moved = new URL(page.url()).pathname.split("/")[2];
  expect(moved).not.toBe(id);
  const moveEvent = await event(moved, "workflow_rescheduled");
  expect(drain(moveEvent).providerAccepted).toBe(2);
  await page
    .locator("summary")
    .filter({ hasText: "Cancel synthetic booking" })
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
  const cancelled = await event(moved, "workflow_cancelled");
  expect(drain(cancelled, "timeout").uncertain).toBe(2);
  expect(
    (await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [moved]))
      .rows[0].state,
  ).toBe("cancelled");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic booking cancelled",
      exact: true,
    }),
  ).toBeVisible();
  await due(cancelled);
  expect(drain(cancelled).providerAccepted).toBe(2);
  expect(drain(cancelled).providerAccepted).toBe(0);
  const native = await browser.newContext({
    baseURL: fixture.origin,
    storageState: await parent.storageState(),
    javaScriptEnabled: false,
  });
  contexts.push(native);
  const plain = await native.newPage();
  await plain.goto(`/bookings/${moved}?scope=guardian`);
  await expect(
    plain.getByRole("heading", {
      name: "Synthetic booking cancelled",
      exact: true,
    }),
  ).toBeVisible();
  const unrelated = await browser.newContext({ baseURL: fixture.origin });
  contexts.push(unrelated);
  const denial = await unrelated.request.get(
    `/api/bookings/${moved}?scope=guardian`,
  );
  expect([401, 404]).toContain(denial.status());
  expect(await denial.text()).not.toContain(fixture.parent.learnerName);
  const outcomeEvents: string[] = [];
  // Exact accepted W6 historical fixture construction with every guard enabled.
  // These owner-only synthetic records are not runtime attendance/prerequisite proof.
  const subjectId = (
    await owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  for (const [index, action] of ["complete", "no_show"].entries()) {
    const historicalId = randomUUID(),
      key = randomUUID(),
      start = new Date(Date.now() - (index + 3) * 7200000),
      end = new Date(start.getTime() + 3600000),
      created = new Date(start.getTime() - 7200000),
      expires = new Date(created.getTime() + 600000),
      client = await owner.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id) VALUES($1,'synthetic_readiness',$2,$3,$4,$5,$6,$7,'UTC',$8,$9,'confirmed',$10,$11,$12,$13)",
        [
          historicalId,
          fixture.tutor.profileId,
          fixture.parent.learnerId,
          fixture.parent.id,
          subjectId,
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
          historicalId,
          staff.id,
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
    await owner.pool.query(
      "INSERT INTO booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference) VALUES($1,$2,$3,true,clock_timestamp()+interval '2 hours',$4)",
      [historicalId, staff.id, action, `synthetic:${randomUUID()}`],
    );
    await staff.page.goto("/admin/bookings/" + historicalId);
    await staff.page
      .getByRole("button", {
        name:
          action === "complete"
            ? "Record administrative completion"
            : "Record administrative no-show",
        exact: true,
      })
      .click();
    await expect(
      staff.page.getByText(
        /administrative software testing, never attendance evidence/,
      ),
    ).toContainText(
      action === "complete"
        ? "administrative completion"
        : "administrative no-show",
    );
    const outcome = await event(
      historicalId,
      action === "complete" ? "workflow_completed" : "workflow_no_show",
    );
    outcomeEvents.push(outcome);
    expect(drain(outcome).providerAccepted).toBe(2);
    expect(drain(outcome).providerAccepted).toBe(0);
    expect(
      (
        await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
          historicalId,
        ])
      ).rows[0].state,
    ).toBe(action === "complete" ? "completed" : "no_show");
  }
  const directory = path.resolve(".local/transactional-delivery/browser-sdk");
  const records = readdirSync(directory)
    .map((name) => JSON.parse(readFileSync(path.join(directory, name), "utf8")))
    .filter((r) =>
      [provisional, confirmed, moveEvent, cancelled, ...outcomeEvents].includes(
        r.eventId,
      ),
    );
  expect(records.length).toBe(16);
  for (const retried of [confirmed, cancelled]) {
    const attempts = records.filter((r) => r.eventId === retried);
    for (const email of [...new Set(attempts.map((r) => r.body.to[0]))]) {
      const pair = attempts.filter((r) => r.body.to[0] === email);
      expect(pair).toHaveLength(2);
      expect(pair[0].body).toEqual(pair[1].body);
      expect(pair[0].key).toBe(pair[1].key);
    }
  }
  for (const record of records) {
    const text = JSON.stringify(record.body);
    expect(text).not.toContain(fixture.parent.learnerName);
    expect(text).not.toContain(fixture.parent.learnerId);
    expect(text).not.toMatch(/meet\.google|zoom\.us/);
    expect(record.body.text).toContain("Synthetic readiness");
    expect(record.body.text).toContain(
      "Administrative outcomes do not establish attendance",
    );
  }
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  const assertPrivateCleared = async (restoredDeniedRoute = false) => {
    let html = await page.content();
    const currentPath = new URL(page.url()).pathname;
    if (restoredDeniedRoute)
      expect(["/account", "/sign-in", `/bookings/${moved}`]).toContain(
        currentPath,
      );
    if (restoredDeniedRoute && currentPath === `/bookings/${moved}`) {
      await expect(
        page.getByRole("heading", {
          name: /We can.t find that booking on this account/,
        }),
      ).toBeVisible();
      // Only these exact current-route fields may carry the requested URL ID.
      // No generic needle removal: prior details and every other ID hit fail.
      for (const routeField of [
        String.raw`\"n\":\"bookingId\",\"t\":\"d\",\"k\":\"${moved}\"`,
        String.raw`\"c\":[\"\",\"bookings\",\"${moved}?scope=guardian\"]`,
      ]) {
        expect(html.split(routeField)).toHaveLength(2);
        html = html.replace(
          routeField,
          routeField.replace(moved, "[requested-route]"),
        );
      }
      await expect(
        page.getByRole("heading", {
          name: "Saved booking history",
          exact: true,
        }),
      ).toHaveCount(0);
    }
    for (const privateValue of [
      moved,
      id,
      fixture.parent.learnerId,
      fixture.parent.learnerName,
      fixture.parent.id,
      fixture.parent.email,
      String.raw`\"learner\":`,
      String.raw`\"meetingSection\":`,
      String.raw`\"booking\":`,
    ])
      expect(html.includes(privateValue)).toBe(false);
  };
  await assertPrivateCleared();
  const outsiders = await staffFixture();
  const secrets = JSON.parse(
    readFileSync(
      ".local/screening-safeguarding/browser-authenticators.json",
      "utf8",
    ),
  );
  await signIn(
    page,
    outsiders.accounts.outsider.email,
    secrets[outsiders.accounts.outsider.id],
  );
  await assertPrivateCleared();
  await page.goBack();
  await assertPrivateCleared(true);
  const foreign = await parent.request.get(
    `/api/bookings/${moved}?scope=guardian`,
  );
  expect([403, 404]).toContain(foreign.status());
  expect(await foreign.text()).not.toContain(fixture.parent.learnerName);
  for (const factor of new Set([secrets[staff.id], ...exercisedFactors]))
    await inspectW6BrowserPrivacy(fixture, factor);
});
