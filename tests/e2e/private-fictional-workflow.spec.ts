import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type Locator,
  type Request,
  type Route,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createDatabase } from "../../src/lib/db/connection";
import {
  parsePrivateWorkflow,
  type PrivateWorkflowBinding,
  type PrivateWorkflowPacket,
} from "../../src/features/private-workflow/config";
import { runPrivateWorkflowOperation } from "../../src/features/private-workflow/operator";
import { totpCode } from "../support/admin-mfa";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import { resetPrivateBrowserAuthAttempts } from "../support/private-student-browser";
import { historicalWorkflowBooking } from "../support/booking-workflows-fixtures";
import type {
  WorkflowReceipt,
  WorkflowState,
} from "../../src/features/booking-workflows/model";
import { formatLessonTime } from "../../src/features/bookings/format-time";
import { bookingStatusLabel } from "../../src/features/private-workflow/notice";
import type {
  BookingDetail,
  BookingPage,
} from "../../src/features/bookings/read-model";
import type { StaffBooking } from "../../src/features/booking-workflows/staff-read";

test.use({ trace: "off", screenshot: "off", video: "off" });
const password = "Fictional-browser-workflow-passphrase-123";
const contexts: BrowserContext[] = [];
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
let packet: PrivateWorkflowPacket;
let binding: PrivateWorkflowBinding;
const emailFor = (role: string) =>
  packet.accountEmails.find(
    (email) =>
      email.startsWith(`${role}-`) &&
      (role.includes("other") || !email.startsWith(`${role}-other-`)),
  )!;
type Actor = Awaited<ReturnType<typeof register>>;
type CreateInput = {
  learnerId: string;
  tutorSlug: string;
  subjectSlug: string;
  displayTimezone: string;
  startAtUtc: string;
  endAtUtc: string;
  idempotencyKey: string;
};
type ChangeInput = {
  requestId: string;
  expectedRevision: number;
  reasonCode: string;
  startAtUtc?: string;
  endAtUtc?: string;
  displayTimezone?: string;
};
type SavedBooking = {
  id: string;
  logical_booking_id: string;
  replaces_booking_id: string | null;
  revision: number;
  workflow_revision: number;
  state: string;
  start_at_utc: Date;
  end_at_utc: Date;
  learner_id: string;
  tutor_id: string;
  subject_slug: string;
};

test.beforeAll(async () => {
  assertOwnedReadinessDatabase(process.cwd());
  const raw = JSON.parse(
    readFileSync(process.env.PRIVATE_WORKFLOW_CONFIG_FILE!, "utf8"),
  );
  binding = { origin: process.env.APP_URL!, database: raw.database };
  packet = parsePrivateWorkflow(raw, binding);
  await resetPrivateBrowserAuthAttempts(owner);
});
test.afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()));
  await owner.pool.end();
});

async function operate(
  command: Parameters<typeof runPrivateWorkflowOperation>[3],
) {
  const client = await owner.pool.connect();
  try {
    return await runPrivateWorkflowOperation(client, packet, binding, command);
  } finally {
    client.release();
  }
}

async function register(browser: Browser, role: string, next = "/account") {
  const context = await browser.newContext({ baseURL: packet.origin });
  contexts.push(context);
  const page = await context.newPage();
  const email = emailFor(role);
  await page.goto(`/sign-up?next=${encodeURIComponent(next)}`);
  await expect(
    page.getByRole("complementary", { name: "Private staging" }),
  ).toBeVisible();
  await page
    .getByLabel("Display name", { exact: true })
    .fill(`Fictional ${role}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  if (role.startsWith("parent"))
    await page.getByLabel("Account type").selectOption("parent");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText(/a verification message is available/),
  ).toBeVisible();
  const messages = readdirSync(path.join(process.cwd(), ".local/mail/test"))
    .filter((file) => file.endsWith(".json"))
    .map(
      (file) =>
        JSON.parse(
          readFileSync(
            path.join(process.cwd(), ".local/mail/test", file),
            "utf8",
          ),
        ) as { to: string; kind: string; url: string },
    );
  const notice = messages.findLast(
    (message) => message.to === email && message.kind === "verification",
  );
  expect(Boolean(notice)).toBe(true);
  await page.goto(notice!.url);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
  const id = (
    await owner.pool.query<{ id: string }>(
      'SELECT id FROM public."user" WHERE email=$1 AND email_verified',
      [email],
    )
  ).rows[0]?.id;
  expect(Boolean(id)).toBe(true);
  if (role.startsWith("parent")) {
    await expect(
      page.getByRole("button", { name: "Continue as parent", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Continue as parent", exact: true })
      .click();
    await expect(page).toHaveURL(/\/parent$/);
  }
  return { context, page, email, id: id! };
}

async function enroll(page: Page) {
  await page.goto("/account/security");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Set up authenticator", exact: true })
    .click();
  const key = page.locator("[data-mfa-secret]").first();
  await expect(key).toBeVisible();
  const secret = (await key.textContent())!;
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totpCode(secret));
  await page
    .getByRole("button", { name: "Verify administrator access", exact: true })
    .click();
  await expect(
    page.getByText("Administrator verification is current.", { exact: false }),
  ).toBeVisible();
}

async function responsive(page: Page) {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    // Do not include private document content in a failing assertion artifact.
    expect(results.violations.map(({ id }) => id)).toEqual([]);
  }
}

async function savedBooking(id: string) {
  return (
    await owner.pool.query<SavedBooking>(
      "SELECT b.id,b.logical_booking_id,b.replaces_booking_id,b.revision,b.workflow_revision,b.state,b.start_at_utc,b.end_at_utc,b.learner_id,b.tutor_id,s.slug subject_slug FROM bookings b JOIN subjects s ON s.id=b.subject_id WHERE b.id=$1",
      [id],
    )
  ).rows[0];
}

async function counts(logicalId: string) {
  return (
    await owner.pool.query<{
      bookings: number;
      events: number;
      intents: number;
      active: number;
    }>(
      "SELECT (SELECT count(*)::int FROM bookings WHERE logical_booking_id=$1) bookings,(SELECT count(*)::int FROM booking_lifecycle_events WHERE logical_booking_id=$1) events,(SELECT count(*)::int FROM booking_workflow_notice_intents i JOIN booking_lifecycle_events e ON e.id=i.event_id WHERE e.logical_booking_id=$1) intents,(SELECT count(*)::int FROM bookings WHERE logical_booking_id=$1 AND (state='confirmed' OR (state='provisional' AND expires_at>clock_timestamp()))) active",
      [logicalId],
    )
  ).rows[0];
}

async function assertEvent(
  receipt: WorkflowReceipt,
  actor: Actor,
  event: string,
  recipients: string[],
) {
  expect(
    (
      await owner.pool.query(
        "SELECT booking_id,actor_user_id,event,workflow_revision FROM booking_lifecycle_events WHERE id=$1",
        [receipt.eventId],
      )
    ).rows,
  ).toEqual([
    {
      booking_id:
        event === "workflow_rescheduled"
          ? (await savedBooking(receipt.id)).replaces_booking_id
          : receipt.id,
      actor_user_id: actor.id,
      event,
      workflow_revision:
        event === "workflow_rescheduled" ? 2 : receipt.workflowRevision,
    },
  ]);
  expect(
    (
      await owner.pool.query<{ recipient_user_id: string; kind: string }>(
        "SELECT recipient_user_id,kind FROM booking_workflow_notice_intents WHERE event_id=$1 ORDER BY recipient_user_id",
        [receipt.eventId],
      )
    ).rows,
  ).toEqual(
    recipients
      .sort()
      .map((recipient_user_id) => ({ recipient_user_id, kind: event })),
  );
}

async function submit<T>(page: Page, endpoint: string, button: Locator) {
  await expect(button).toBeEnabled();
  const url = new URL(endpoint, packet.origin).href;
  let resolve!: (value: { input: T; receipt: WorkflowReceipt }) => void;
  let reject!: (error: unknown) => void;
  const captured = new Promise<{ input: T; receipt: WorkflowReceipt }>(
    (yes, no) => {
      resolve = yes;
      reject = no;
    },
  );
  const passthrough = async (route: Route) => {
    try {
      expect(route.request().method()).toBe("POST");
      const input = route.request().postDataJSON() as T;
      const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 });
      expect(response.status()).toBe(200);
      const receipt = (await response.json()) as WorkflowReceipt;
      await route.fulfill({ response });
      resolve({ input, receipt });
    } catch (error) {
      reject(error);
      await route.abort().catch(() => {});
    }
  };
  try {
    await page.route(url, passthrough, { times: 1 });
    const [result] = await Promise.all([captured, button.click()]);
    return result;
  } finally {
    await page.unroute(url, passthrough);
  }
}

async function replay(
  actor: Actor,
  endpoint: string,
  input: object,
  receipt: WorkflowReceipt,
) {
  const before = await counts(receipt.logicalBookingId);
  const result = await actor.context.request.post(endpoint, {
    headers: { origin: packet.origin },
    data: input,
  });
  expect(result.status()).toBe(200);
  const value = (await result.json()) as WorkflowReceipt;
  expect(value.id).toBe(receipt.id);
  expect(value.eventId).toBe(receipt.eventId);
  expect(value.logicalBookingId).toBe(receipt.logicalBookingId);
  expect(await counts(receipt.logicalBookingId)).toEqual(before);
}

async function interruptedCreate(parent: Actor) {
  const endpoint = new URL("/api/bookings/demo", packet.origin).href;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let resolve!: (value: {
    input: CreateInput;
    receipt: WorkflowReceipt;
  }) => void;
  let reject!: (error: unknown) => void;
  const committed = new Promise<{
    input: CreateInput;
    receipt: WorkflowReceipt;
  }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  let finish!: () => void;
  const finished = new Promise<void>((yes) => {
    finish = yes;
  });
  let posts = 0;
  const count = (request: Request) => {
    if (request.url() === endpoint && request.method() === "POST") posts++;
  };
  const withhold = async (route: Route) => {
    try {
      expect(route.request().method()).toBe("POST");
      const input = route.request().postDataJSON() as CreateInput;
      // The database and real application commit once; only delivery to the
      // requesting document is interrupted. No success receipt is synthesized.
      const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 });
      expect(response.status()).toBe(200);
      const receipt = (await response.json()) as WorkflowReceipt;
      resolve({ input, receipt });
      await gate;
      await route.abort().catch(() => {});
    } catch (error) {
      reject(error);
      await route.abort().catch(() => {});
    } finally {
      finish();
    }
  };
  parent.page.on("request", count);
  try {
    const button = parent.page.getByRole("button", {
      name: "Request booking",
      exact: true,
    });
    await expect(button).toBeEnabled();
    await parent.page.route(endpoint, withhold, { times: 1 });
    const [saved] = await Promise.all([committed, button.dblclick()]);
    expect(posts).toBe(1);
    expect(saved.receipt.state).toBe("provisional");
    expect(await counts(saved.receipt.logicalBookingId)).toEqual({
      bookings: 1,
      events: 1,
      intents: 2,
      active: 1,
    });
    // Hard reload before the still-gated POST has delivered any response.
    expect(new URL(parent.page.url()).pathname).toBe("/bookings/new");
    await parent.page.reload();
    release();
    await finished;
    await parent.page.goto("/parent");
    await expect(
      parent.page
        .locator(`a[href="/bookings/${saved.receipt.id}?scope=guardian"]`)
        .first(),
    ).toBeVisible();
    await replay(parent, "/api/bookings/demo", saved.input, saved.receipt);
    const conflict = await parent.context.request.post("/api/bookings/demo", {
      headers: { origin: packet.origin },
      data: { ...saved.input, idempotencyKey: randomUUID() },
    });
    expect(conflict.status()).toBe(409);
    expect(await counts(saved.receipt.logicalBookingId)).toEqual({
      bookings: 1,
      events: 1,
      intents: 2,
      active: 1,
    });
    expect(
      (
        await owner.pool.query(
          "SELECT id FROM bookings WHERE booked_by_user_id=$1",
          [parent.id],
        )
      ).rows,
    ).toEqual([{ id: saved.receipt.id }]);
    const recovered = await parent.context.request.get(
      "/api/bookings?scope=guardian&filter=active",
    );
    expect(recovered.status()).toBe(200);
    const active = (await recovered.json()) as BookingPage;
    expect(
      active.items.map((item) => ({ id: item.id, state: item.state })),
    ).toEqual([{ id: saved.receipt.id, state: "provisional" }]);
    return saved;
  } finally {
    release();
    parent.page.off("request", count);
    await parent.page.unroute(endpoint, withhold);
  }
}

async function freshPage(page: Page, href: string) {
  const target = new URL(href, packet.origin).href;
  if (page.url() === target) await page.reload();
  else await page.goto(target);
}

async function sameViews(
  parent: Actor,
  tutor: Actor,
  admin: Actor,
  id: string,
  state: WorkflowState,
) {
  const saved = await savedBooking(id);
  expect(saved.state).toBe(state);
  for (const [actor, scope] of [
    [parent, "guardian"],
    [tutor, "tutor"],
  ] as const) {
    const response = await actor.context.request.get(
      `/api/bookings/${id}?scope=${scope}`,
    );
    expect(response.status()).toBe(200);
    const detail = (await response.json()) as BookingDetail;
    const account = (
      await owner.pool.query<{ timezone: string }>(
        'SELECT timezone FROM public."user" WHERE id=$1',
        [actor.id],
      )
    ).rows[0];
    expect(detail.id).toBe(id);
    expect(detail.logicalBookingId).toBe(saved.logical_booking_id);
    expect(detail.revision).toBe(saved.revision);
    expect(detail.state).toBe(state);
    expect(detail.learner).toEqual({
      id: saved.learner_id,
      displayName: "Student A fictional",
      level: "middle_school",
    });
    expect(detail.tutor.displayName).toBe("Fictional tutor");
    expect(detail.subject).toEqual({ slug: "math", name: "Math" });
    expect(detail.time.startAtUtc).toBe(saved.start_at_utc.toISOString());
    expect(detail.time.endAtUtc).toBe(saved.end_at_utc.toISOString());
    expect(detail.viewerTimezone).toBe(account.timezone);
    expect(detail.time).toEqual(
      formatLessonTime(
        saved.start_at_utc,
        saved.end_at_utc,
        detail.viewerTimezone,
      ),
    );
    await freshPage(actor.page, `/bookings/${id}?scope=${scope}`);
    await expect(
      actor.page.locator(`time[datetime="${detail.time.startAtUtc}"]`).first(),
    ).toBeVisible();
    await expect(
      actor.page.getByRole("heading", {
        name: bookingStatusLabel(state, true),
        exact: true,
      }),
    ).toBeVisible();
    if (["replaced", "cancelled", "completed"].includes(state)) {
      await actor.page.goto(`/bookings?scope=${scope}&filter=history`);
      await expect(
        actor.page.locator(`a[href="/bookings/${id}?scope=${scope}"]`),
      ).toBeVisible();
      const historyResponse = await actor.context.request.get(
        `/api/bookings?scope=${scope}&filter=history`,
      );
      expect(historyResponse.status()).toBe(200);
      const history = (await historyResponse.json()) as BookingPage;
      expect(history.items.find((item) => item.id === id)?.state).toBe(state);
    }
  }
  const staffResponse = await admin.context.request.get(
    `/api/admin/bookings?q=${id}&state=all`,
  );
  expect(staffResponse.status()).toBe(200);
  const staff = (await staffResponse.json()) as { items: StaffBooking[] };
  expect(staff.items).toHaveLength(1);
  const item = staff.items[0];
  expect(item).toMatchObject({
    id,
    logicalBookingId: saved.logical_booking_id,
    revision: saved.revision,
    state,
    subject: "Math",
    tutorName: "Fictional tutor",
    learnerName: "Student A fictional",
    learnerLevel: "middle_school",
    requesterName: "Fictional parent",
    relationship: "guardian",
  });
  expect(new Date(item.start).toISOString()).toBe(
    saved.start_at_utc.toISOString(),
  );
  expect(new Date(item.end).toISOString()).toBe(saved.end_at_utc.toISOString());
  expect(item.time).toEqual(
    formatLessonTime(saved.start_at_utc, saved.end_at_utc, item.timezone),
  );
  expect(item.timezone).toBe(
    (
      await owner.pool.query<{ timezone: string }>(
        'SELECT timezone FROM public."user" WHERE id=$1',
        [admin.id],
      )
    ).rows[0].timezone,
  );
  expect(
    /meet\.google\.com|zoom\.us|"url"|"email"|"meeting"/i.test(
      JSON.stringify(staff),
    ),
  ).toBe(false);
  await freshPage(admin.page, `/admin/bookings?q=${id}&state=all`);
  await expect(admin.page.locator(`li[data-booking-id="${id}"]`)).toContainText(
    "Student A fictional",
  );
  await admin.page.goto(`/admin/bookings/${id}`);
  await expect(
    admin.page.getByText(`Math · ${bookingStatusLabel(state, true)}`, {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    (await admin.page.content()).includes("https://meet.google.com/"),
  ).toBe(false);
  expect(
    (
      await admin.context.request.get(`/api/bookings/${id}/meeting-link`)
    ).status(),
  ).toBe(404);
}

async function noMeeting(
  actor: Actor,
  id: string,
  state: "missing" | "expired",
) {
  const response = await actor.context.request.get(
    `/api/bookings/${id}/meeting-link`,
  );
  expect(response.status()).toBe(200);
  const value = await response.json();
  expect(value.state).toBe(state);
  expect("url" in value).toBe(false);
  expect(
    (
      await actor.context.request.get(
        `/api/bookings/${id}/meeting-link?open=1`,
        { maxRedirects: 0 },
      )
    ).status(),
  ).toBe(404);
}

async function saveMeeting(tutor: Actor, id: string, url: string) {
  await tutor.page.goto(`/bookings/${id}?scope=tutor`);
  await tutor.page
    .getByLabel("Zoom or Google Meet link", { exact: true })
    .fill(url);
  await tutor.page
    .getByRole("button", { name: /^(Save|Replace) meeting link$/ })
    .click();
  await expect(
    tutor.page
      .getByRole("status")
      .filter({ hasText: "Private meeting link saved." }),
  ).toBeVisible();
}

async function openMeeting(
  actor: Actor,
  id: string,
  scope: "guardian" | "tutor",
  url: string,
) {
  await actor.page.goto(`/bookings/${id}?scope=${scope}`);
  await actor.page
    .getByRole("button", { name: "Reload meeting link", exact: true })
    .click();
  const response = await actor.context.request.get(
    `/api/bookings/${id}/meeting-link`,
  );
  expect(response.status()).toBe(200);
  const value = await response.json();
  expect(value.state).toBe("present");
  expect(value.url === url).toBe(true);
  await actor.context.route("https://meet.google.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<title>Intercepted fictional meeting</title>",
    }),
  );
  const popup = actor.context.waitForEvent("page");
  await actor.page
    .getByRole("link", {
      name: "Open meeting on Google Meet (new tab)",
      exact: true,
    })
    .click();
  const external = await popup;
  await external.waitForLoadState();
  expect(external.url() === url).toBe(true);
  await external.close();
}

async function candidateStarts(
  parent: Actor,
  learnerId: string,
  tutorSlug: string,
) {
  const query = new URLSearchParams({
    learnerId,
    tutorSlug,
    subjectSlug: "math",
    displayTimezone: "Asia/Manila",
  });
  await parent.page.goto(`/bookings/new?${query}`);
  await expect(
    parent.page.getByRole("button", { name: "Request booking", exact: true }),
  ).toBeEnabled();
  return parent.page
    .locator('input[name="slot"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLInputElement).value),
    );
}

test("normal private build connects guardian booking interruption, cross-role changes and separate historical completion", async ({
  browser,
}) => {
  // No copied source, factory overrides, automated approval, factor receipts or guardian links.
  const admin = await register(browser, "admin");
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
    [admin.id],
  );
  await enroll(admin.page);
  await operate({ action: "prepare", apply: true, reviewerEmail: admin.email });

  const parent = await register(browser, "parent");
  const otherParent = await register(browser, "parent-other");
  const tutor = await register(browser, "tutor");
  const otherTutor = await register(browser, "tutor-other");
  await otherTutor.page.goto("/become-a-tutor");
  await otherTutor.page
    .getByRole("button", { name: "Start tutor application", exact: true })
    .click();
  await expect(otherTutor.page).toHaveURL(/\/tutor\/profile$/);
  await tutor.page.goto("/become-a-tutor");
  await tutor.page
    .getByRole("button", { name: "Start tutor application", exact: true })
    .click();
  await expect(tutor.page).toHaveURL(/\/tutor\/profile$/);
  await tutor.page
    .getByLabel("Headline")
    .fill("Fictional Mathematics tutoring");
  await tutor.page
    .getByLabel("Introduction")
    .fill("A fictional tutor for the private workflow test.");
  await tutor.page
    .getByLabel("Teaching background")
    .fill("Fictional education and teaching experience for QA only.");
  await tutor.page.getByLabel("Time zone").selectOption("Asia/Manila");
  await tutor.page
    .getByRole("group", { name: "Math", exact: true })
    .getByLabel("Middle School", { exact: true })
    .check();
  await tutor.page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(tutor.page.getByRole("status")).toHaveText(
    "Application submitted.",
  );
  const profile = (
    await owner.pool.query<{ id: string; slug: string }>(
      "SELECT id,slug FROM tutor_profiles WHERE user_id=$1",
      [tutor.id],
    )
  ).rows[0];
  await tutor.page.reload();
  await expect(tutor.page.getByLabel("Introduction")).toHaveValue(
    "A fictional tutor for the private workflow test.",
  );
  const unapprovedResponse = await parent.page.goto(`/tutors/${profile.slug}`);
  expect(unapprovedResponse?.status()).toBe(404);
  await expect(
    parent.page.getByRole("heading", { name: "Fictional tutor", exact: true }),
  ).toHaveCount(0);

  console.info("Private workflow: accounts verified and Tutor profile saved.");
  await tutor.page.goto("/tutor/screening");
  await tutor.page
    .getByRole("button", { name: "Request synthetic screening", exact: true })
    .click();
  await expect(tutor.page.getByText(/Screening status: pending/)).toBeVisible();
  await operate({
    action: "assign-screening",
    apply: true,
    tutorId: profile.id,
    reviewerEmail: admin.email,
    validUntil: packet.screening.validUntil,
  });
  await admin.page.goto(`/admin/tutors/${profile.id}`);
  // Required evidence cannot be skipped even by a current, assigned MFA admin.
  await admin.page
    .getByRole("button", { name: "Approve synthetic screening", exact: true })
    .click();
  await admin.page
    .getByRole("button", { name: "Confirm screening decision", exact: true })
    .click();
  await expect(
    admin.page.locator("#main-content").getByRole("alert"),
  ).toContainText("required");
  for (const code of packet.screening.requiredCheckCodes) {
    await admin.page.getByLabel("Required check").selectOption(code);
    await admin.page
      .getByLabel("Evidence reference")
      .fill(`screening:${randomUUID()}`);
    await admin.page
      .getByLabel("Checked at (UTC ISO date)")
      .fill(new Date(Date.now() - 60_000).toISOString());
    await admin.page
      .getByLabel("Expires at (UTC ISO date)")
      .fill(packet.screening.validUntil);
    await admin.page
      .getByRole("button", { name: "Record check", exact: true })
      .click();
    await expect(
      admin.page.getByText(`${code}: Current passed evidence`, { exact: true }),
    ).toBeVisible();
  }
  await admin.page
    .getByRole("button", { name: "Approve synthetic screening", exact: true })
    .click();
  await admin.page
    .getByRole("button", { name: "Confirm screening decision", exact: true })
    .click();
  await expect(admin.page.getByText(/State: approved\./)).toBeVisible();

  console.info("Private workflow: Tutor screening approved.");
  const availability = {
    version: 0,
    timezone: "Asia/Manila",
    windows: Array.from({ length: 7 }, (_, i) => ({
      isoWeekday: i + 1,
      startMinute: 0,
      endMinute: 1440,
    })),
  };
  expect(
    (
      await tutor.context.request.put("/api/tutor/availability", {
        headers: { origin: packet.origin },
        data: availability,
      })
    ).status(),
  ).toBe(200);
  await tutor.page.goto("/tutor/availability");
  await expect(
    tutor.page.getByRole("heading", {
      name: "Weekly availability",
      exact: true,
    }),
  ).toBeVisible();

  await parent.page.goto("/learners");
  await parent.page
    .getByRole("link", { name: "Add a learner", exact: true })
    .click();
  await parent.page
    .getByLabel("Learner display name", { exact: true })
    .fill("Student A fictional");
  await parent.page
    .getByLabel("Learner level", { exact: true })
    .selectOption("middle_school");
  await parent.page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Manila");
  await parent.page
    .getByRole("button", { name: "Request admission review", exact: true })
    .click();
  await expect(parent.page).toHaveURL(/\/learner-admission\/[a-f0-9-]+$/);
  const admissionId = new URL(parent.page.url()).pathname.split("/").at(-1)!;
  await expect(
    parent.page.getByText(/Learner access is not authorized/),
  ).toBeVisible();
  const pending = (
    await owner.pool.query<{ id: string; status: string; links: number }>(
      "SELECT l.id,l.status,(SELECT count(*)::int FROM guardian_learner_links g WHERE g.learner_id=l.id) links FROM learner_admissions a JOIN learner_profiles l ON l.id=a.learner_id WHERE a.id=$1",
      [admissionId],
    )
  ).rows[0];
  expect(pending.status).toBe("inactive");
  expect(pending.links).toBe(0);
  expect(
    (
      await parent.context.request.post("/api/learners", {
        headers: { origin: packet.origin },
        data: {
          displayName: "Bypass attempt",
          level: "middle_school",
          timezone: "Asia/Manila",
          management: "guardian",
          requestId: randomUUID(),
        },
      })
    ).status(),
  ).toBe(503);
  expect(
    (
      await otherParent.context.request.get(
        `/api/learner-admission/${admissionId}`,
      )
    ).status(),
  ).toBe(404);
  await operate({
    action: "assign-admission",
    apply: true,
    admissionId,
    reviewerEmail: admin.email,
  });
  await admin.page.goto(`/admin/learner-admission/${admissionId}`);
  for (const check of ["guardian_authority", "guardian_notice"]) {
    await admin.page.getByLabel("Review check").selectOption(check);
    const reference = `browser:${randomUUID()}`;
    await admin.page.getByLabel("Opaque test reference").fill(reference);
    await admin.page
      .getByRole("button", { name: "Record evidence", exact: true })
      .click();
    await expect(
      admin.page.getByText(reference, { exact: false }),
    ).toBeVisible();
  }
  await admin.page
    .getByRole("button", { name: "Save admission decision", exact: true })
    .click();
  await expect(admin.page.getByText(/Status: authorized\./)).toBeVisible();
  console.info("Private workflow: learner review authorized.");
  await parent.page.goto("/learners");
  await expect(
    parent.page.getByRole("heading", {
      name: "Student A fictional",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (
      await otherParent.context.request.get(`/api/learners/${pending.id}`)
    ).status(),
  ).toBe(404);

  await parent.page.goto("/tutors");
  const filters = parent.page.getByRole("search", {
    name: "Filter tutors",
    exact: true,
  });
  await filters.getByLabel("Subject", { exact: true }).selectOption("math");
  await filters
    .getByLabel("Level", { exact: true })
    .selectOption("middle_school");
  await filters
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(parent.page.getByRole("status")).toHaveText("1 tutor");
  await parent.page
    .getByRole("link", { name: "View profile: Fictional tutor", exact: true })
    .click();
  await expect(parent.page).toHaveURL(
    new RegExp(`/tutors/${profile.slug}(?:\\?|$)`),
  );
  await expect(
    parent.page.getByRole("heading", { name: "Fictional tutor", exact: true }),
  ).toBeVisible();
  await expect(
    parent.page.getByText(
      "Fictional education and teaching experience for QA only.",
      { exact: true },
    ),
  ).toBeVisible();
  await parent.page.getByLabel("Subject", { exact: true }).selectOption("math");
  await parent.page
    .getByLabel("Level", { exact: true })
    .selectOption("middle_school");
  await parent.page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Manila");
  await parent.page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  const intervals = await parent.page
    .locator('input[name="time"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLInputElement).value),
    );
  const selectedInterval = intervals.find(
    (value) => Date.parse(value.split("|")[0]) >= Date.now() + 4 * 3600000,
  );
  expect(Boolean(selectedInterval)).toBe(true);
  await parent.page
    .locator(`input[name="time"][value="${selectedInterval}"]`)
    .check();
  await parent.page
    .getByRole("button", { name: "Review booking", exact: true })
    .click();
  await expect(parent.page).toHaveURL(/\/bookings\/new\?/);
  await parent.page
    .getByLabel("Learner", { exact: true })
    .selectOption(pending.id);
  await parent.page
    .getByRole("button", { name: "Show available times", exact: true })
    .click();
  await expect(parent.page.getByRole("radio").first()).toBeChecked();
  const requestedStart = await parent.page
    .getByRole("radio")
    .first()
    .getAttribute("value");
  expect(requestedStart).toBe(selectedInterval!.split("|")[0]);
  const create =
    await test.step("double-click commits once and a hard reload recovers the withheld response", () =>
      interruptedCreate(parent));
  const bookingId = create.receipt.id;
  await parent.page.goto(`/bookings/${bookingId}?scope=guardian`);
  await expect(
    parent.page.getByRole("heading", {
      name: "Provisional booking",
      exact: true,
    }),
  ).toBeVisible();
  const booking = (
    await owner.pool.query<{
      logical_booking_id: string;
      state: string;
      start_at_utc: Date;
      subject_slug: string;
      learner_id: string;
      tutor_id: string;
    }>(
      "SELECT b.logical_booking_id,b.state,b.start_at_utc,s.slug subject_slug,b.learner_id,b.tutor_id FROM bookings b JOIN subjects s ON s.id=b.subject_id WHERE b.id=$1",
      [bookingId],
    )
  ).rows[0];
  expect(booking.state).toBe("provisional");
  expect(booking.start_at_utc.toISOString()).toBe(requestedStart);
  expect(booking.learner_id).toBe(pending.id);
  expect(booking.tutor_id).toBe(profile.id);
  expect(booking.subject_slug).toBe("math");
  await assertEvent(create.receipt, parent, "workflow_provisional", [
    parent.id,
    tutor.id,
  ]);
  // Admin role and MFA alone do not make a just-created record visible.
  const unassigned = await admin.context.request.get(
    `/api/admin/bookings?q=${bookingId}&state=all`,
  );
  expect(unassigned.status()).toBe(200);
  expect((await unassigned.json()).items).toEqual([]);
  expect(
    (
      await parent.context.request.get(
        `/api/bookings/${bookingId}?scope=student`,
      )
    ).status(),
  ).toBe(404);
  await operate({
    action: "grant-confirmation",
    apply: true,
    bookingId,
    reviewerEmail: admin.email,
    validUntil: packet.screening.validUntil,
  });
  await admin.page.goto(`/admin/bookings/${bookingId}`);
  await sameViews(parent, tutor, admin, bookingId, "provisional");
  const confirmation = await submit<ChangeInput>(
    admin.page,
    `/api/bookings/${bookingId}/workflow/confirm`,
    admin.page.getByRole("button", {
      name: "Confirm booking prerequisites",
      exact: true,
    }),
  );
  await expect(admin.page.getByText(/Math · Confirmed/)).toBeVisible();
  await replay(
    admin,
    `/api/bookings/${bookingId}/workflow/confirm`,
    confirmation.input,
    confirmation.receipt,
  );
  await assertEvent(confirmation.receipt, admin, "workflow_confirmed", [
    parent.id,
    tutor.id,
  ]);
  await sameViews(parent, tutor, admin, bookingId, "confirmed");
  console.info("Private workflow: shared booking confirmed.");
  await parent.page.goto("/parent");
  await expect(
    parent.page
      .locator(`a[href="/bookings/${bookingId}?scope=guardian"]`)
      .first(),
  ).toBeVisible();
  await tutor.page.goto("/tutor");
  await expect(
    tutor.page.locator(`a[href="/bookings/${bookingId}?scope=tutor"]`).first(),
  ).toBeVisible();
  await tutor.page.goto(`/bookings/${bookingId}?scope=tutor`);
  await expect(
    tutor.page.getByRole("heading", { name: "Confirmed", exact: true }),
  ).toBeVisible();
  await expect(
    tutor.page.getByText("Student A fictional · Middle School", {
      exact: true,
    }),
  ).toBeVisible();
  await tutor.page
    .getByLabel("Zoom or Google Meet link", { exact: true })
    .fill("https://meet.google.com/abc-defg-hij");
  await tutor.page
    .getByRole("button", { name: "Save meeting link", exact: true })
    .click();
  await expect(
    tutor.page
      .getByRole("status")
      .filter({ hasText: "Private meeting link saved." }),
  ).toBeVisible();
  await tutor.page.reload();
  await parent.page.goto(`/bookings/${bookingId}?scope=guardian`);
  for (const actor of [parent, tutor]) {
    await actor.context.route("https://meet.google.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<title>Intercepted fictional meeting</title>",
      }),
    );
    const popup = actor.context.waitForEvent("page");
    await actor.page
      .getByRole("link", {
        name: "Open meeting on Google Meet (new tab)",
        exact: true,
      })
      .click();
    const external = await popup;
    await external.waitForLoadState();
    expect(external.url() === "https://meet.google.com/abc-defg-hij").toBe(
      true,
    );
    await external.close();
  }
  expect(
    (
      await otherParent.context.request.get(
        `/api/bookings/${bookingId}?scope=guardian`,
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await otherParent.context.request.get(
        `/api/bookings/${bookingId}/meeting-link`,
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await tutor.context.request.post("/api/admin/subjects", {
        headers: { origin: packet.origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const premature = await tutor.context.request.post(
    `/api/bookings/${bookingId}/workflow/complete`,
    {
      headers: { origin: packet.origin },
      data: {
        requestId: randomUUID(),
        expectedRevision: 1,
        reasonCode: "synthetic_completed",
      },
    },
  );
  expect(premature.status()).toBe(409);
  expect(
    (
      await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
        bookingId,
      ])
    ).rows[0].state,
  ).toBe("confirmed");
  await parent.page.goto("/bookings?scope=guardian&filter=all");
  await expect(
    parent.page.locator(`a[href="/bookings/${bookingId}?scope=guardian"]`),
  ).toBeVisible();
  await responsive(parent.page);
  await tutor.page.goto("/admin");
  await expect(
    tutor.page.getByRole("heading", { name: /Admin workspace/ }),
  ).toHaveCount(0);
  const foreign = await parent.context.request.get(`/tutors/${profile.slug}`);
  expect(
    (await foreign.text()).includes("https://meet.google.com/abc-defg-hij"),
  ).toBe(false);

  await test.step("Tutor replacement link reaches fresh authorized reads and never foreign or Admin views", async () => {
    const updated = "https://meet.google.com/klm-nopq-rst";
    await saveMeeting(tutor, bookingId, updated);
    await openMeeting(parent, bookingId, "guardian", updated);
    await openMeeting(tutor, bookingId, "tutor", updated);
    for (const [actor, scope] of [
      [otherParent, "guardian"],
      [otherTutor, "tutor"],
    ] as const) {
      expect(
        (
          await actor.context.request.get(
            `/api/bookings/${bookingId}?scope=${scope}`,
          )
        ).status(),
      ).toBe(404);
      expect(
        (
          await actor.context.request.get(
            `/api/bookings/${bookingId}/meeting-link`,
          )
        ).status(),
      ).toBe(404);
      expect(
        (
          await actor.context.request.get(
            `/api/bookings/${bookingId}/meeting-link?open=1`,
            { maxRedirects: 0 },
          )
        ).status(),
      ).toBe(404);
    }
    await sameViews(parent, tutor, admin, bookingId, "confirmed");
    const publicResult = await otherParent.context.request.get(
      `/tutors/${profile.slug}`,
    );
    const publicHtml = await publicResult.text();
    expect(publicHtml.includes(updated)).toBe(false);
    expect(publicHtml.includes("https://meet.google.com/abc-defg-hij")).toBe(
      false,
    );
  });

  let replacementId = "";
  await test.step("Parent rescheduling preserves one logical chain and updates Tutor and exact Admin reads", async () => {
    const initial = await savedBooking(bookingId);
    await parent.page.goto(`/bookings/${bookingId}?scope=guardian`);
    await parent.page
      .getByRole("link", { name: "Reschedule booking", exact: true })
      .click();
    await expect(
      parent.page.getByRole("heading", {
        name: "Reschedule booking",
        exact: true,
      }),
    ).toBeVisible();
    const options = await parent.page
      .locator('input[name="slot"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLInputElement).value),
      );
    const start = options.find(
      (value) =>
        Date.parse(value) >=
        Math.max(
          Date.now() + 4 * 3600000,
          initial.end_at_utc.getTime() + 3600000,
        ),
    );
    expect(Boolean(start)).toBe(true);
    await parent.page.locator(`input[name="slot"][value="${start}"]`).check();
    const move = await submit<ChangeInput>(
      parent.page,
      `/api/bookings/${bookingId}/workflow/reschedule`,
      parent.page.getByRole("button", {
        name: "Reschedule booking",
        exact: true,
      }),
    );
    replacementId = move.receipt.id;
    expect(replacementId === bookingId).toBe(false);
    expect(move.receipt.logicalBookingId).toBe(create.receipt.logicalBookingId);
    expect(move.receipt.state).toBe("confirmed");
    await expect(parent.page).toHaveURL(
      new RegExp(`/bookings/${replacementId}\\?scope=guardian$`),
    );
    await replay(
      parent,
      `/api/bookings/${bookingId}/workflow/reschedule`,
      move.input,
      move.receipt,
    );
    const replacement = await savedBooking(replacementId);
    expect(replacement.replaces_booking_id).toBe(bookingId);
    expect(replacement.logical_booking_id).toBe(initial.logical_booking_id);
    expect(replacement.revision).toBe(initial.revision + 1);
    expect(replacement.start_at_utc.toISOString()).toBe(start);
    expect(replacement.learner_id).toBe(initial.learner_id);
    expect(replacement.tutor_id).toBe(initial.tutor_id);
    expect(replacement.subject_slug).toBe(initial.subject_slug);
    const retired = await savedBooking(bookingId);
    expect(retired.state).toBe("replaced");
    expect(retired.start_at_utc).toEqual(initial.start_at_utc);
    expect(retired.end_at_utc).toEqual(initial.end_at_utc);
    expect(await counts(initial.logical_booking_id)).toEqual({
      bookings: 2,
      events: 4,
      intents: 6,
      active: 1,
    });
    await assertEvent(move.receipt, parent, "workflow_rescheduled", [
      parent.id,
      tutor.id,
    ]);
    await sameViews(parent, tutor, admin, bookingId, "replaced");
    await sameViews(parent, tutor, admin, replacementId, "confirmed");
    const openTimes = await candidateStarts(parent, pending.id, profile.slug);
    expect(openTimes).toContain(initial.start_at_utc.toISOString());
    expect(openTimes).not.toContain(replacement.start_at_utc.toISOString());
    for (const actor of [parent, tutor]) {
      await noMeeting(actor, bookingId, "expired");
      await noMeeting(actor, replacementId, "missing");
    }
    const replacementLink = "https://meet.google.com/uvw-xyza-bcd";
    await saveMeeting(tutor, replacementId, replacementLink);
    await openMeeting(parent, replacementId, "guardian", replacementLink);
    await openMeeting(tutor, replacementId, "tutor", replacementLink);
    await sameViews(parent, tutor, admin, replacementId, "confirmed");
  });

  await test.step("Parent cancellation synchronizes all permitted histories, denies joining and releases the slot", async () => {
    const replacement = await savedBooking(replacementId);
    await parent.page.goto(`/bookings/${replacementId}?scope=guardian`);
    await parent.page
      .locator("summary")
      .filter({ hasText: /^Cancel booking$/ })
      .click();
    const cancel = await submit<ChangeInput>(
      parent.page,
      `/api/bookings/${replacementId}/workflow/cancel`,
      parent.page.getByRole("button", { name: "Cancel booking", exact: true }),
    );
    expect(cancel.receipt.state).toBe("cancelled");
    await expect(
      parent.page.getByRole("heading", { name: "Cancelled", exact: true }),
    ).toBeVisible();
    await replay(
      parent,
      `/api/bookings/${replacementId}/workflow/cancel`,
      cancel.input,
      cancel.receipt,
    );
    await assertEvent(cancel.receipt, parent, "workflow_cancelled", [
      parent.id,
      tutor.id,
    ]);
    expect(await counts(create.receipt.logicalBookingId)).toEqual({
      bookings: 2,
      events: 5,
      intents: 8,
      active: 0,
    });
    await sameViews(parent, tutor, admin, bookingId, "replaced");
    await sameViews(parent, tutor, admin, replacementId, "cancelled");
    for (const actor of [parent, tutor])
      await noMeeting(actor, replacementId, "expired");
    const released = await candidateStarts(parent, pending.id, profile.slug);
    expect(released).toContain(booking.start_at_utc.toISOString());
    expect(released).toContain(replacement.start_at_utc.toISOString());
    await parent.page.goto("/bookings?scope=guardian&filter=history");
    await responsive(parent.page);
  });

  await test.step("separate already-ended guardian fixture completes through Tutor UI and all permitted histories", async () => {
    // This is a separate historical fixture, never edited future-booking times,
    // an elapsed newly booked lesson, an operator approval or video attendance.
    const now = Date.now();
    const historical = await historicalWorkflowBooking(
      { owner },
      {
        profile,
        learner: pending,
        requester: parent,
        booking: packet.booking,
        admission: packet.admission,
      },
      admin,
      {
        state: "confirmed",
        start: new Date(now - 2 * 3600000),
        end: new Date(now - 3600000),
        created: new Date(now - 86400000),
        expires: new Date(now - 86400000 + 600000),
      },
    );
    expect([bookingId, replacementId].includes(historical.id)).toBe(false);
    // Exact test assignment metadata only. No confirmation/outcome is performed
    // through owner SQL; the assigned Tutor must execute the real completion UI.
    await owner.pool.query(
      "INSERT INTO booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference) VALUES($1,$2,'confirm',true,$3::timestamptz,$4)",
      [
        historical.logicalBookingId,
        admin.id,
        packet.screening.validUntil,
        `synthetic:${randomUUID()}`,
      ],
    );
    await parent.page.goto(`/bookings/${historical.id}?scope=guardian`);
    await expect(
      parent.page.getByRole("button", {
        name: "Mark session completed",
        exact: true,
      }),
    ).toHaveCount(0);
    await tutor.page.goto(`/bookings/${historical.id}?scope=tutor`);
    const completion = await submit<ChangeInput>(
      tutor.page,
      `/api/bookings/${historical.id}/workflow/complete`,
      tutor.page.getByRole("button", {
        name: "Mark session completed",
        exact: true,
      }),
    );
    expect(completion.receipt.state).toBe("completed");
    await expect(
      tutor.page.getByRole("heading", { name: "Completed", exact: true }),
    ).toBeVisible();
    await replay(
      tutor,
      `/api/bookings/${historical.id}/workflow/complete`,
      completion.input,
      completion.receipt,
    );
    await assertEvent(completion.receipt, tutor, "workflow_completed", [
      parent.id,
      tutor.id,
    ]);
    expect(await counts(historical.logicalBookingId)).toEqual({
      bookings: 1,
      events: 2,
      intents: 4,
      active: 0,
    });
    await sameViews(parent, tutor, admin, historical.id, "completed");
    for (const actor of [parent, tutor])
      await noMeeting(actor, historical.id, "expired");
    expect(
      (
        await otherParent.context.request.get(
          `/api/bookings/${historical.id}?scope=guardian`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await otherTutor.context.request.get(
          `/api/bookings/${historical.id}?scope=tutor`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await parent.context.request.get(
          `/api/bookings/${historical.id}?scope=student`,
        )
      ).status(),
    ).toBe(404);
    expect((await savedBooking(bookingId)).state).toBe("replaced");
    expect((await savedBooking(replacementId)).state).toBe("cancelled");
  });
});
